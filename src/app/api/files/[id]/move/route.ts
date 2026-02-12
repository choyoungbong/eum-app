import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 파일 이동
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

    const fileId = params.id;
    const body = await request.json();
    const { folderId } = body; // null이면 루트로 이동

    // 파일 확인
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 대상 폴더 확인 (있는 경우)
    if (folderId) {
      const targetFolder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!targetFolder) {
        return NextResponse.json(
          { error: "대상 폴더를 찾을 수 없습니다" },
          { status: 404 }
        );
      }

      if (targetFolder.userId !== session.user.id) {
        return NextResponse.json(
          { error: "대상 폴더에 대한 권한이 없습니다" },
          { status: 403 }
        );
      }
    }

    // 파일 이동
    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        folderId: folderId || null,
      },
    });

    return NextResponse.json({
      message: "파일이 이동되었습니다",
      file: {
        ...updatedFile,
        size: updatedFile.size.toString(),
      },
    });

  } catch (error) {
    console.error("File move error:", error);
    return NextResponse.json(
      { error: "파일 이동 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
