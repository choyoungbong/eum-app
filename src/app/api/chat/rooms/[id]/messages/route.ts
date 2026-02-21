import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessageNotification, sendFileSharedNotification } from "@/lib/fcm";

// BigInt 및 Date 객체를 JSON 안전한 형태로 변환하는 유틸리티
function serialize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

// 1. 메시지 목록 조회 (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const chatRoomId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    const membership = await prisma.chatRoomMember.findFirst({
      where: { chatRoomId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "채팅방에 참여하지 않았습니다" }, { status: 403 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        file: { select: { id: true, originalName: true, size: true, mimeType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 클라이언트에서는 시간 순서대로 보여줘야 하므로 reverse
    return NextResponse.json(serialize({ messages: messages.reverse() }));
  } catch (error) {
    console.error("GET Messages Error:", error);
    return NextResponse.json({ error: "메시지 조회 실패" }, { status: 500 });
  }
}

// 2. 메시지 전송 및 실시간 전파 (POST)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const chatRoomId = params.id;
    const { type, content, fileId, callId } = await request.json();

    // 메시지 생성
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type,
        content: type === "TEXT" || type === "CALL_LOG" || type === "SYSTEM" ? content : null,
        fileId: type === "FILE" ? fileId : null,
        callId: callId || null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        file: true,
      },
    });

    const serializedMessage = serialize(message);

    // ✅ [핵심] 소켓 실시간 전송 (server.js의 global.io 사용)
    const io = (global as any).io;
    if (io) {
      // server.js에서 정의한 방 이름 규칙 'chat:ID'를 준수합니다.
      io.to(`chat:${chatRoomId}`).emit("message:new", serializedMessage);
      console.log(`📡 [Socket] 메시지 브로드캐스트 성공: chat:${chatRoomId}`);
    } else {
      console.warn("⚠️ [Socket] global.io를 찾을 수 없습니다. 소켓 서버 상태를 확인하세요.");
    }

    // 채팅방 멤버 조회 (푸시 및 권한 처리용)
    const members = await prisma.chatRoomMember.findMany({
      where: { chatRoomId },
      include: { user: { select: { id: true, name: true, fcmToken: true } } },
    });

    // 파일 공유 시 다른 멤버들에게 권한 부여 (기존 로직 유지)
    if (type === "FILE" && fileId) {
      for (const member of members) {
        if (member.userId !== session.user.id) {
          await prisma.filePermission.upsert({
            where: {
              resourceType_resourceId_sharedWithId: {
                resourceType: "FILE",
                resourceId: fileId,
                sharedWithId: member.userId,
              },
            },
            update: {},
            create: {
              resourceType: "FILE",
              resourceId: fileId,
              ownerId: session.user.id,
              sharedWithId: member.userId,
              permission: "VIEW",
            },
          });
        }
      }
    }

    // 채팅방 마지막 업데이트 시간 갱신
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    // ✅ FCM 푸시 알림 발송 (나를 제외한 멤버들에게)
    for (const member of members) {
      if (member.userId !== session.user.id && member.user.fcmToken) {
        try {
          if (type === "TEXT") {
            await sendChatMessageNotification(
              member.user.fcmToken,
              session.user.name || "사용자",
              content,
              chatRoomId
            );
          } else if (type === "FILE" && message.file) {
            await sendFileSharedNotification(
              member.user.fcmToken,
              session.user.name || "사용자",
              message.file.originalName,
              chatRoomId
            );
          }
        } catch (error) {
          console.error(`❌ 푸시 실패 (${member.user.name}):`, error);
        }
      }
    }

    return NextResponse.json({ data: serializedMessage }, { status: 201 });
  } catch (error) {
    console.error("POST Message Error:", error);
    return NextResponse.json({ error: "메시지 전송 실패" }, { status: 500 });
  }
}