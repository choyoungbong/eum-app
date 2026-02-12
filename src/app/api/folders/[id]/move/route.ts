import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 폴더 이동
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

    const folderId = params.id;
    const body = await request.json();
    const { parentId } = body; // null이면 루트로 이동

    // 폴더 확인
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "폴더를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (folder.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 자기 자신으로 이동 방지
    if (parentId === folderId) {
      return NextResponse.json(
        { error: "폴더를 자기 자신으로 이동할 수 없습니다" },
        { status: 400 }
      );
    }

    // 대상 폴더 확인 (있는 경우)
    if (parentId) {
      const targetFolder = await prisma.folder.findUnique({
        where: { id: parentId },
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

      // 순환 참조 방지 (자식 폴더로 이동 불가)
      const isDescendant = await checkIsDescendant(parentId, folderId);
      if (isDescendant) {
        return NextResponse.json(
          { error: "하위 폴더로는 이동할 수 없습니다" },
          { status: 400 }
        );
      }
    }

    // 같은 위치에 같은 이름의 폴더가 있는지 확인
    const existingFolder = await prisma.folder.findFirst({
      where: {
        userId: session.user.id,
        parentId: parentId || null,
        name: folder.name,
        id: { not: folderId },
      },
    });

    if (existingFolder) {
      return NextResponse.json(
        { error: "대상 위치에 같은 이름의 폴더가 이미 존재합니다" },
        { status: 409 }
      );
    }

    // 폴더 이동
    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        parentId: parentId || null,
      },
      include: {
        _count: {
          select: {
            children: true,
            files: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "폴더가 이동되었습니다",
      folder: updatedFolder,
    });

  } catch (error) {
    console.error("Folder move error:", error);
    return NextResponse.json(
      { error: "폴더 이동 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 순환 참조 확인 헬퍼 함수
async function checkIsDescendant(
  targetId: string,
  ancestorId: string
): Promise<boolean> {
  let currentId: string | null = targetId;

  while (currentId) {
    if (currentId === ancestorId) {
      return true;
    }

    const folder = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    currentId = folder?.parentId || null;
  }

  return false;
}
