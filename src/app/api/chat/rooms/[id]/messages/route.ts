import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessageNotification, sendFileSharedNotification } from "@/lib/fcm";

// BigInt 변환 및 JSON 안전 처리를 위한 헬퍼 함수
function serialize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const messages = await prisma.chatMessage.findMany({
      where: { chatRoomId: params.id },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        file: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(serialize({ messages: messages.reverse() }));
  } catch (error) {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const chatRoomId = params.id;
    const { type, content, fileId } = await request.json();

    // 1. 메시지 저장
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type,
        content: type === "TEXT" ? content : null,
        fileId: type === "FILE" ? fileId : null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        file: true,
      },
    });

    const serializedData = serialize(message);

    // 2. 🌟 실시간 소켓 전송 (server.js의 방 이름 규칙 chat:ID 준수)
    const io = (global as any).io;
    if (io) {
      io.to(`chat:${chatRoomId}`).emit("message:new", serializedData);
      console.log(`📡 [Socket] 발송 성공: chat:${chatRoomId}`);
    }

    // 3. 상대방 조회 및 FCM 푸시 (기존 로직 유지)
    const members = await prisma.chatRoomMember.findMany({
      where: { chatRoomId, userId: { not: session.user.id } },
      include: { user: { select: { id: true, name: true, fcmToken: true } } },
    });

    for (const member of members) {
      if (member.user.fcmToken) {
        try {
          if (type === "TEXT") {
            await sendChatMessageNotification(member.user.fcmToken, session.user.name || "사용자", content, chatRoomId);
          } else if (type === "FILE" && message.file) {
            await sendFileSharedNotification(member.user.fcmToken, session.user.name || "사용자", message.file.originalName, chatRoomId);
          }
        } catch (e) {
          console.error("FCM 전송 에러:", e);
        }
      }
    }

    return NextResponse.json({ data: serializedData }, { status: 201 });
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json({ error: "전송 실패" }, { status: 500 });
  }
}