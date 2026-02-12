import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

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

    const fileId = params.id;

    // 파일 정보 조회
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { error: "파일 삭제 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 실제 파일 삭제
    if (existsSync(file.filepath)) {
      await unlink(file.filepath);
    }

    // 썸네일 삭제 (있는 경우)
    if (file.thumbnailUrl && existsSync(file.thumbnailUrl)) {
      await unlink(file.thumbnailUrl);
    }

    // DB에서 삭제 (Cascade로 SharedResource도 자동 삭제)
    await prisma.file.delete({
      where: { id: fileId },
    });

    return NextResponse.json({
      message: "파일이 삭제되었습니다",
    });

  } catch (error) {
    console.error("File delete error:", error);
    return NextResponse.json(
      { error: "파일 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}