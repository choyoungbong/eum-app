import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessageNotification, sendFileSharedNotification } from "@/lib/fcm";

// BigInt 직렬화 유틸
function serialize(data: any) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

// ─── GET: 메시지 목록 조회 ───────────────────────────────
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

    // ✅ 변경: hiddenAt: null 추가 — 내가 삭제한 방은 메시지 조회 불가
    const membership = await prisma.chatRoomMember.findFirst({
      where: { chatRoomId, userId: session.user.id, hiddenAt: null },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "채팅방에 참여하지 않았습니다" },
        { status: 403 }
      );
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

    return NextResponse.json(serialize({ messages: messages.reverse() }));
  } catch (error) {
    console.error("GET Messages Error:", error);
    return NextResponse.json({ error: "메시지 조회 실패" }, { status: 500 });
  }
}

// ─── POST: 메시지 전송 ────────────────────────────────────
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

    // ✅ 추가: 상대방이 이 방을 숨긴 상태면 hiddenAt 해제 → 목록에 다시 표시
    await prisma.chatRoomMember.updateMany({
      where: {
        chatRoomId,
        userId: { not: session.user.id },
        hiddenAt: { not: null },
      },
      data: { hiddenAt: null },
    });

    // 메시지 생성
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type,
        content:
          type === "TEXT" || type === "CALL_LOG" || type === "SYSTEM"
            ? content
            : null,
        fileId: type === "FILE" ? fileId : null,
        callId: callId || null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        file: true,
      },
    });

    const serializedMessage = serialize(message);

    // 소켓 브로드캐스트
    const io = (global as any).io;
    if (io) {
      io.to(`chat:${chatRoomId}`).emit("message:receive", serializedMessage);
      console.log(`📡 소켓 브로드캐스트: chat:${chatRoomId}`);
    } else {
      console.warn("⚠️ global.io 없음 — 소켓 서버 상태 확인 필요");
    }

    // 채팅방 멤버 조회 (파일 권한 + FCM용)
    const members = await prisma.chatRoomMember.findMany({
      where: { chatRoomId },
      include: { user: { select: { id: true, name: true, fcmTokens: true } } },
    });

    // 파일 공유 시 멤버들에게 권한 부여
    if (type === "FILE" && fileId) {
      for (const member of members) {
        if (member.userId !== session.user.id) {
          await prisma.sharedResource.upsert({
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

    // 채팅방 updatedAt 갱신
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    // FCM 푸시 알림 (나 제외한 멤버들)
    for (const member of members) {
      if (member.userId !== session.user.id && member.user.fcmTokens?.length > 0) {
        for (const tokenObj of member.user.fcmTokens) {
          try {
            if (type === "TEXT") {
              await sendChatMessageNotification(
                tokenObj.token,
                session.user.name || "사용자",
                content,
                chatRoomId
              );
            } else if (type === "FILE" && message.file) {
              await sendFileSharedNotification(
                tokenObj.token,
                session.user.name || "사용자",
                (message.file as any).originalName,
                chatRoomId
              );
            }
          } catch (error) {
            console.error(`❌ FCM 실패 (${member.user.name}):`, error);
          }
        }
      }
    }

    return NextResponse.json({ data: serializedMessage }, { status: 201 });
  } catch (error) {
    console.error("POST Message Error:", error);
    return NextResponse.json({ error: "메시지 전송 실패" }, { status: 500 });
  }
}