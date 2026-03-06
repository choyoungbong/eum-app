// src/app/api/chat/rooms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── GET /api/chat/rooms — 채팅방 목록 조회 ──────────────
export async function GET(request: NextRequest) {
  const apiStart = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

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
      orderBy: { chatRoom: { updatedAt: "desc" } },
    });

    const roomIds = chatRoomMembers.map((m) => m.chatRoomId);

    if (!roomIds.length) {
      return NextResponse.json({ chatRooms: [] });
    }

    const allMessages = await prisma.chatMessage.findMany({
      where: { chatRoomId: { in: roomIds } },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    const lastMessageMap = new Map<string, any>();
    const unreadMap: Record<string, number> = {};

    for (const msg of allMessages) {
      if (!lastMessageMap.has(msg.chatRoomId)) {
        lastMessageMap.set(msg.chatRoomId, msg);
      }
      if (msg.senderId !== session.user.id) {
        unreadMap[msg.chatRoomId] = (unreadMap[msg.chatRoomId] || 0) + 1;
      }
    }

    const chatRooms = chatRoomMembers.map((member: any) => ({
      ...member.chatRoom,
      messages: lastMessageMap.has(member.chatRoomId)
        ? [lastMessageMap.get(member.chatRoomId)]
        : [],
      unreadCount: unreadMap[member.chatRoomId] || 0,
      myMembership: { lastReadAt: member.lastReadAt },
    }));

    console.log("GET /api/chat/rooms:", Date.now() - apiStart, "ms");

    return NextResponse.json({ chatRooms });
  } catch (error) {
    console.error("Chat rooms fetch error:", error);
    return NextResponse.json(
      { error: "채팅방 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ─── POST /api/chat/rooms — 채팅방 생성 ─────────────────
// ✅ 추가: 이 핸들러가 없어서 405 Method Not Allowed 발생
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { participantId, name, type = "DIRECT" } = body;

    if (!participantId) {
      return NextResponse.json(
        { error: "대화 상대를 선택해주세요" },
        { status: 400 }
      );
    }

    // 자기 자신과의 채팅 방지
    if (participantId === session.user.id) {
      return NextResponse.json(
        { error: "자기 자신과는 채팅할 수 없습니다" },
        { status: 400 }
      );
    }

    // 상대방 존재 확인
    const participant = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, name: true },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "존재하지 않는 사용자입니다" },
        { status: 404 }
      );
    }

    // DIRECT 채팅: 이미 존재하는 1:1 채팅방 재사용
    if (type === "DIRECT") {
      const existing = await prisma.chatRoom.findFirst({
        where: {
          type: "DIRECT",
          AND: [
            { members: { some: { userId: session.user.id } } },
            { members: { some: { userId: participantId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, isOnline: true } },
            },
          },
        },
      });

      if (existing) {
        return NextResponse.json({ chatRoom: existing, isExisting: true });
      }
    }

    // 채팅방 + 멤버 동시 생성
    const chatRoom = await prisma.chatRoom.create({
      data: {
        type: type === "GROUP" ? "GROUP" : "DIRECT",
        name: name ?? null,
        members: {
          create: [
            { userId: session.user.id },
            { userId: participantId },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, isOnline: true } },
          },
        },
      },
    });

    return NextResponse.json({ chatRoom, isExisting: false }, { status: 201 });
  } catch (error) {
    console.error("Chat room create error:", error);
    return NextResponse.json(
      { error: "채팅방 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
