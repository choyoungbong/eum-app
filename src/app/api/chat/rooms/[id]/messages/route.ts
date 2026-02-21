import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendChatMessageNotification, sendFileSharedNotification } from "@/lib/fcm";

// 메시지 목록 조회
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
        file: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json({ error: "메시지 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}

// 메시지 전송
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const chatRoomId = params.id;
    const body = await request.json();
    const { type, content, fileId } = body;

    const membership = await prisma.chatRoomMember.findFirst({
      where: { chatRoomId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "채팅방에 참여하지 않았습니다" }, { status: 403 });
    }

    // 메시지 생성
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

    // 상대방 정보 가져오기 (본인 제외)
    const members = await prisma.chatRoomMember.findMany({
      where: { chatRoomId, userId: { not: session.user.id } },
      include: { user: { select: { id: true, name: true, fcmToken: true } } },
    });

    // 파일 공유 권한 처리
    if (type === "FILE" && fileId) {
      for (const member of members) {
        await prisma.sharedResource.upsert({
          where: {
            resourceType_resourceId_sharedWithId: {
              resourceType: "FILE",
              resourceId: fileId,
              sharedWithId: member.userId,
            }
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

    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    // ========== FCM 푸시 알림 발송 (이곳에서만 관리) ==========
    for (const member of members) {
      if (member.user.fcmToken) {
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
          // fcm.ts에서 이미 성공 로그를 찍으므로 여기서는 생략하거나 하나만 남깁니다.
        } catch (error) {
          console.error(`❌ 푸시 실패 (${member.user.name}):`, error);
        }
      }
    }

    return NextResponse.json({ message: "메시지가 전송되었습니다", data: message }, { status: 201 });
  } catch (error) {
    console.error("Message send error:", error);
    return NextResponse.json({ error: "메시지 전송 중 오류가 발생했습니다" }, { status: 500 });
  }
}