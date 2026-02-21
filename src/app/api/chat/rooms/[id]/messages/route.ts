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
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const chatRoomId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    const membership = await prisma.chatRoomMember.findFirst({
      where: {
        chatRoomId,
        userId: session.user.id,
      },
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
        ...(before && {
          createdAt: {
            lt: new Date(before),
          },
        }),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        file: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    const sortedMessages = messages.reverse();

    return NextResponse.json({
      messages: sortedMessages,
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json(
      { error: "메시지 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const chatRoomId = params.id;
    const body = await request.json();
    const { type, content, fileId } = body;

    const membership = await prisma.chatRoomMember.findFirst({
      where: {
        chatRoomId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "채팅방에 참여하지 않았습니다" },
        { status: 403 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: "메시지 타입을 지정하세요" },
        { status: 400 }
      );
    }

    if (type === "TEXT" && !content) {
      return NextResponse.json(
        { error: "메시지 내용을 입력하세요" },
        { status: 400 }
      );
    }

    if (type === "FILE" && !fileId) {
      return NextResponse.json(
        { error: "파일 ID를 지정하세요" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type,
        content: type === "TEXT" ? content : null,
        fileId: type === "FILE" ? fileId : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        file: true,
      },
    });

    const members = await prisma.chatRoomMember.findMany({
      where: {
        chatRoomId,
        userId: {
          not: session.user.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            fcmToken: true,
          },
        },
      },
    });

    if (type === "FILE" && fileId) {
      for (const member of members) {
        const existingShare = await prisma.sharedResource.findFirst({
          where: {
            resourceType: "FILE",
            resourceId: fileId,
            sharedWithId: member.userId,
          },
        });

        if (!existingShare) {
          await prisma.sharedResource.create({
            data: {
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

    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

    // ========== FCM 푸시 알림 발송 ==========
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
          console.log(`✅ 푸시 알림: ${member.user.name}`);
        } catch (error) {
          console.error(`❌ 푸시 실패 (${member.user.name}):`, error);
        }
      }
    }

    return NextResponse.json(
      {
        message: "메시지가 전송되었습니다",
        data: message,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Message send error:", error);
    return NextResponse.json(
      { error: "메시지 전송 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
