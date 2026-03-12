import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 채팅방 상세 조회
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

    // 채팅방 조회
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
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

    if (!chatRoom) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // ✅ 변경: hiddenAt: null 조건 추가 — 내가 삭제한 방은 접근 불가
    const isMember = chatRoom.members.some(
      (member: any) =>
        member.userId === session.user.id && member.hiddenAt === null
    );

    if (!isMember) {
      return NextResponse.json(
        { error: "채팅방에 참여하지 않았습니다" },
        { status: 403 }
      );
    }

    return NextResponse.json({ chatRoom });
  } catch (error) {
    console.error("Chat room fetch error:", error);
    return NextResponse.json(
      { error: "채팅방 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 채팅방 나가기 / 삭제
export async function DELETE(
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

    // 채팅방 + 멤버 전체 조회
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      include: {
        members: true,
      },
    });

    if (!chatRoom) {
      return NextResponse.json(
        { error: "채팅방을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 내 멤버십 확인 (hiddenAt 상관없이 — 이미 숨긴 방에 재요청하는 경우 대비)
    const membership = chatRoom.members.find(
      (m) => m.userId === session.user.id
    );

    if (!membership) {
      return NextResponse.json(
        { error: "채팅방에 참여하지 않았습니다" },
        { status: 403 }
      );
    }

    // ── 1:1 채팅방 ──────────────────────────────────────────────
    if (chatRoom.type === "DIRECT") {
      // ✅ 변경: delete → hiddenAt 설정 (상대방 대화방은 유지)
      await prisma.chatRoomMember.update({
        where: { id: membership.id },
        data: { hiddenAt: new Date() },
      });

      return NextResponse.json({
        message: "대화방이 삭제되었습니다",
      });
    }

    // ── 그룹 채팅방 ─────────────────────────────────────────────
    // ✅ 변경: delete → hiddenAt 설정
    await prisma.chatRoomMember.update({
      where: { id: membership.id },
      data: { hiddenAt: new Date() },
    });

    // 시스템 메시지 생성 (그룹만)
    await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type: "SYSTEM",
        content: `${session.user.name}님이 채팅방을 나갔습니다.`,
      },
    });

    // ✅ 변경: hiddenAt이 null인 멤버(활성 멤버)가 0명이면 방 삭제
    const activeCount = await prisma.chatRoomMember.count({
      where: { chatRoomId, hiddenAt: null },
    });

    if (activeCount === 0) {
      await prisma.chatRoom.delete({
        where: { id: chatRoomId },
      });
    }

    return NextResponse.json({
      message: "채팅방을 나갔습니다",
    });
  } catch (error) {
    console.error("Chat room leave error:", error);
    return NextResponse.json(
      { error: "채팅방 나가기 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}