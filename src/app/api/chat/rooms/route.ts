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

    // 1️⃣ 내가 속한 채팅방 ID만 가져오기 (가벼움)
    const memberStart = Date.now();
    const memberships = await prisma.chatRoomMember.findMany({
      where: { userId: session.user.id },
      select: {
        chatRoomId: true,
        lastReadAt: true,
      },
      orderBy: {
        chatRoom: { updatedAt: "desc" },
      },
    });
    console.log("Membership query:", Date.now() - memberStart, "ms");

    const roomIds = memberships.map((m) => m.chatRoomId);

    if (roomIds.length === 0) {
      return NextResponse.json({ chatRooms: [] });
    }

    // 2️⃣ 채팅방 기본 정보만 조회
    const roomStart = Date.now();
    const rooms = await prisma.chatRoom.findMany({
      where: { id: { in: roomIds } },
    });
    console.log("Room query:", Date.now() - roomStart, "ms");

    // 3️⃣ 마지막 메시지 한 번에 조회
    const messageStart = Date.now();
    const lastMessages = await prisma.chatMessage.findMany({
      where: { chatRoomId: { in: roomIds } },
      orderBy: { createdAt: "desc" },
    });
    console.log("Message query:", Date.now() - messageStart, "ms");

    const lastMessageMap = new Map<string, any>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.chatRoomId)) {
        lastMessageMap.set(msg.chatRoomId, msg);
      }
    }

    // 4️⃣ unread 집계
    const unreadStart = Date.now();
    const unreadCounts = await prisma.chatMessage.groupBy({
      by: ["chatRoomId"],
      where: {
        chatRoomId: { in: roomIds },
        senderId: { not: session.user.id },
      },
      _count: { _all: true },
    });
    console.log("Unread groupBy:", Date.now() - unreadStart, "ms");

    const unreadMap: Record<string, number> = {};
    unreadCounts.forEach((u) => {
      unreadMap[u.chatRoomId] = u._count._all;
    });

    // 5️⃣ 조합
    const chatRooms = rooms.map((room) => {
      const membership = memberships.find(
        (m) => m.chatRoomId === room.id
      );

      return {
        ...room,
        lastMessage: lastMessageMap.get(room.id) || null,
        unreadCount: unreadMap[room.id] || 0,
        myMembership: membership,
      };
    });

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
