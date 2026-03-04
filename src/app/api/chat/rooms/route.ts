// src/app/api/chat/rooms/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const apiStart = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🔥 1️⃣ membership + room 한 번에
    const membershipStart = Date.now();

    const memberships = await prisma.chatRoomMember.findMany({
      where: { userId: session.user.id },
      include: {
        chatRoom: true,
      },
      orderBy: {
        chatRoom: { updatedAt: "desc" },
      },
    });

    console.log("Membership+Room:", Date.now() - membershipStart, "ms");

    const roomIds = memberships.map((m) => m.chatRoomId);
    if (!roomIds.length) {
      return NextResponse.json({ chatRooms: [] });
    }

    // 🔥 2️⃣ 마지막 메시지 + unread 한 번에
    const messageStart = Date.now();

    const messages = await prisma.chatMessage.findMany({
      where: { chatRoomId: { in: roomIds } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        chatRoomId: true,
        content: true,
        senderId: true,
        createdAt: true,
      },
    });

    console.log("Message query:", Date.now() - messageStart, "ms");

    const lastMessageMap = new Map<string, any>();
    const unreadMap: Record<string, number> = {};

    for (const m of messages) {
      // 마지막 메시지
      if (!lastMessageMap.has(m.chatRoomId)) {
        lastMessageMap.set(m.chatRoomId, m);
      }

      // unread
      if (m.senderId !== session.user.id) {
        unreadMap[m.chatRoomId] =
          (unreadMap[m.chatRoomId] || 0) + 1;
      }
    }

    // 🔥 3️⃣ 최종 조합
    const chatRooms = memberships.map((m) => ({
      ...m.chatRoom,
      lastMessage: lastMessageMap.get(m.chatRoomId) || null,
      unreadCount: unreadMap[m.chatRoomId] || 0,
      myMembership: {
        id: m.id,
        lastReadAt: m.lastReadAt,
      },
    }));

    console.log("API total:", Date.now() - apiStart, "ms");

    return NextResponse.json({ chatRooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "채팅방 조회 오류" },
      { status: 500 }
    );
  }
}
