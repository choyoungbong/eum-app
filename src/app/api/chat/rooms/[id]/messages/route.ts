import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

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
    const before = searchParams.get("before"); // 커서 기반 페이지네이션

    // 참여자 확인
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

    // 메시지 조회
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // 역순으로 정렬 (오래된 것부터)
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

    // 참여자 확인
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

    // 유효성 검사
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
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 파일 메시지인 경우 자동 공유 권한 부여
    if (type === "FILE" && fileId) {
      // 채팅방 멤버 조회
      const members = await prisma.chatRoomMember.findMany({
        where: {
          chatRoomId,
          userId: {
            not: session.user.id, // 본인 제외
          },
        },
      });

      // 각 멤버에게 파일 읽기 권한 부여
      for (const member of members) {
        // 이미 공유되었는지 확인
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

    // 채팅방 업데이트 시간 갱신
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });

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
