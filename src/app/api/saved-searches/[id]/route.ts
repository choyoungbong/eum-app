import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 저장된 검색 삭제
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

    const searchId = params.id;

    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id: searchId },
    });

    if (!savedSearch) {
      return NextResponse.json(
        { error: "저장된 검색을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (savedSearch.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    await prisma.savedSearch.delete({
      where: { id: searchId },
    });

    return NextResponse.json({
      message: "저장된 검색이 삭제되었습니다",
    });
  } catch (error) {
    console.error("Saved search delete error:", error);
    return NextResponse.json(
      { error: "삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
