import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 채팅방 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 내가 참여한 채팅방 목록
    const chatRoomMembers = await prisma.chatRoomMember.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        chatRoom: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    isOnline: true,
                    lastSeenAt: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1, // 마지막 메시지만
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            _count: {
              select: {
                messages: true,
              },
            },
          },
        },
      },
      orderBy: {
        chatRoom: {
          updatedAt: "desc",
        },
      },
    });

    // 읽지 않은 메시지 개수 계산
    const chatRooms = await Promise.all(
      chatRoomMembers.map(async (member) => {
        const unreadCount = await prisma.chatMessage.count({
          where: {
            chatRoomId: member.chatRoomId,
            createdAt: {
              gt: member.lastReadAt || new Date(0),
            },
            senderId: {
              not: session.user.id, // 본인 메시지 제외
            },
          },
        });

        return {
          ...member.chatRoom,
          unreadCount,
          myMembership: {
            lastReadAt: member.lastReadAt,
          },
        };
      })
    );

    return NextResponse.json({ chatRooms });
  } catch (error) {
    console.error("Chat rooms fetch error:", error);
    return NextResponse.json(
      { error: "채팅방 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 채팅방 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, memberIds, name } = body;

    // 유효성 검사
    if (!type || !memberIds || !Array.isArray(memberIds)) {
      return NextResponse.json(
        { error: "잘못된 요청입니다" },
        { status: 400 }
      );
    }

    // 1:1 채팅인 경우 기존 채팅방 확인
    if (type === "DIRECT") {
      if (memberIds.length !== 1) {
        return NextResponse.json(
          { error: "1:1 채팅은 상대방 1명만 지정해야 합니다" },
          { status: 400 }
        );
      }

      const otherUserId = memberIds[0];

      // 이미 존재하는 1:1 채팅방 찾기
      const existingChatRoom = await prisma.chatRoom.findFirst({
        where: {
          type: "DIRECT",
          members: {
            every: {
              userId: {
                in: [session.user.id, otherUserId],
              },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  isOnline: true,
                },
              },
            },
          },
        },
      });

      if (existingChatRoom) {
        return NextResponse.json({
          message: "기존 채팅방을 반환합니다",
          chatRoom: existingChatRoom,
        });
      }
    }

    // 그룹 채팅인 경우 이름 필수
    if (type === "GROUP" && !name) {
      return NextResponse.json(
        { error: "그룹 채팅방 이름을 입력하세요" },
        { status: 400 }
      );
    }

    // 채팅방 생성
    const chatRoom = await prisma.chatRoom.create({
      data: {
        type,
        name: type === "GROUP" ? name : null,
        members: {
          create: [
            // 본인 추가
            {
              userId: session.user.id,
            },
            // 다른 멤버들 추가
            ...memberIds.map((userId: string) => ({
              userId,
            })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isOnline: true,
                lastSeenAt: true,
              },
            },
          },
        },
      },
    });

    // 시스템 메시지 생성 (그룹 채팅)
    if (type === "GROUP") {
      await prisma.chatMessage.create({
        data: {
          chatRoomId: chatRoom.id,
          senderId: session.user.id,
          type: "SYSTEM",
          content: `${session.user.name}님이 채팅방을 만들었습니다.`,
        },
      });
    }

    return NextResponse.json(
      {
        message: "채팅방이 생성되었습니다",
        chatRoom,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Chat room create error:", error);
    return NextResponse.json(
      { error: "채팅방 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
