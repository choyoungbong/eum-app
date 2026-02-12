import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 메시지 읽음 처리
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

    // 멤버십 조회
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

    // lastReadAt 업데이트
    await prisma.chatRoomMember.update({
      where: {
        id: membership.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "읽음 처리되었습니다",
    });
  } catch (error) {
    console.error("Read message error:", error);
    return NextResponse.json(
      { error: "읽음 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
