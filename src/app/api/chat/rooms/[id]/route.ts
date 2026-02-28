import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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

    // 참여자 확인
    const isMember = chatRoom.members.some(
      (member: any) => member.userId === session.user.id
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

// 채팅방 나가기
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

    // 멤버십 확인
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

    // 멤버 제거
    await prisma.chatRoomMember.delete({
      where: {
        id: membership.id,
      },
    });

    // 시스템 메시지 생성
    await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId: session.user.id,
        type: "SYSTEM",
        content: `${session.user.name}님이 채팅방을 나갔습니다.`,
      },
    });

    // 남은 멤버 확인
    const remainingMembers = await prisma.chatRoomMember.count({
      where: { chatRoomId },
    });

    // 멤버가 없으면 채팅방 삭제
    if (remainingMembers === 0) {
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
