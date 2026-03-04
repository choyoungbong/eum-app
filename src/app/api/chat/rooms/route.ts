import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// ✅ 채팅방 목록 조회 (구조 유지 + 성능 개선판)
export async function GET(request: NextRequest) {
  const apiStart = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 1️⃣ 내가 속한 채팅방 + 멤버 정보 (members 유지)
    const membershipStart = Date.now();

    const chatRoomMembers = await prisma.chatRoomMember.findMany({
      where: { userId: session.user.id },
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
          },
        },
      },
      orderBy: {
        chatRoom: { updatedAt: "desc" },
      },
    });

    console.log(
      "Membership+Members:",
      Date.now() - membershipStart,
      "ms"
    );

    const roomIds = chatRoomMembers.map((m) => m.chatRoomId);

    if (!roomIds.length) {
      return NextResponse.json({ chatRooms: [] });
    }

    // 2️⃣ 모든 채팅방 메시지 한 번에 조회 (마지막 메시지 + unread 계산용)
    const messageStart = Date.now();

    const allMessages = await prisma.chatMessage.findMany({
      where: {
        chatRoomId: { in: roomIds },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log("Message query:", Date.now() - messageStart, "ms");

    // 🔥 마지막 메시지 + unread 계산 (메모리에서 처리)
    const lastMessageMap = new Map<string, any>();
    const unreadMap: Record<string, number> = {};

    for (const msg of allMessages) {
      // 마지막 메시지 (desc 정렬이라 첫 번째가 최신)
      if (!lastMessageMap.has(msg.chatRoomId)) {
        lastMessageMap.set(msg.chatRoomId, msg);
      }

      // unread 계산
      if (msg.senderId !== session.user.id) {
        unreadMap[msg.chatRoomId] =
          (unreadMap[msg.chatRoomId] || 0) + 1;
      }
    }

    // 3️⃣ 기존 구조 그대로 반환
    const chatRooms = chatRoomMembers.map((member: any) => {
      const lastMessage = lastMessageMap.get(member.chatRoomId);

      return {
        ...member.chatRoom,

        // 🔥 기존 page.tsx가 기대하는 구조 유지
        messages: lastMessage ? [lastMessage] : [],

        unreadCount: unreadMap[member.chatRoomId] || 0,

        myMembership: {
          lastReadAt: member.lastReadAt,
        },
      };
    });

    console.log("API total:", Date.now() - apiStart, "ms");

    return NextResponse.json({ chatRooms });
  } catch (error) {
    console.error("Chat rooms fetch error:", error);
    return NextResponse.json(
      { error: "채팅방 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
