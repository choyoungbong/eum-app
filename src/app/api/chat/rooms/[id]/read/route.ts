import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ✅ [수정-1] route → lib/auth
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

    // ✅ [수정-2] 레이스 컨디션 제거: findFirst → updateMany로 단일 쿼리 처리
    // 기존: findFirst로 membership 조회 후 update → 두 쿼리 사이에 membership이
    //       삭제되면 update가 존재하지 않는 id를 참조해 에러 발생 가능
    // 개선: updateMany + where 조건으로 조회와 업데이트를 원자적으로 처리
    const result = await prisma.chatRoomMember.updateMany({
      where: {
        chatRoomId,
        userId: session.user.id,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    // updateMany는 존재하지 않아도 에러가 아닌 count: 0을 반환
    if (result.count === 0) {
      return NextResponse.json(
        { error: "채팅방에 참여하지 않았습니다" },
        { status: 403 }
      );
    }

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
