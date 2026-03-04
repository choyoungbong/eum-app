// src/app/api/chat/rooms/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 채팅방 목록 조회
export async function GET(request: NextRequest) {
  const apiStart = Date.now();

  try {
    // 🔹 Session 측정
    const sessionStart = Date.now();
    const session = await getServerSession(authOptions);
    console.log("Session time:", Date.now() - sessionStart, "ms");

    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 🔹 채팅방 멤버 조회
    const dbMemberStart = Date.now();
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
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
    console.log(
      "DB chatRoomMember time:",
      Date.now() - dbMemberStart,
      "ms"
    );

    const roomIds = chatRoomMembers.map((m) => m.chatRoomId);

    // 🔹 unread 집계
    const unreadStart = Date.now();
    const unreadCounts = await prisma.chatMessage.groupBy({
      by: ["chatRoomId"],
      where: {
        chatRoomId: { in: roomIds },
        senderId: { not: session.user.id },
      },
      _count: {
        _all: true,
      },
    });
    console.log("Unread groupBy time:", Date.now() - unreadStart, "ms");

    const unreadMap: Record<string, number> = {};
    unreadCounts.forEach((u) => {
      unreadMap[u.chatRoomId] = u._count._all;
    });

    const chatRooms = chatRoomMembers.map((member: any) => {
      const unreadCount = unreadMap[member.chatRoomId] || 0;

      return {
        ...member.chatRoom,
        unreadCount,
        myMembership: {
          lastReadAt: member.lastReadAt,
        },
      };
    });

    console.log("API total time:", Date.now() - apiStart, "ms");

    return NextResponse.json({ chatRooms });
  } catch (error) {
    console.error("Chat rooms fetch error:", error);
    console.log("API total time (error):", Date.now() - apiStart, "ms");

    return NextResponse.json(
      { error: "채팅방 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
