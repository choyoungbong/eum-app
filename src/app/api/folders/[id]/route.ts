import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 폴더 상세 조회
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

    const folderId = params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        _count: {
          select: {
            children: true,
            files: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    return NextResponse.json({ folder });

  } catch (error) {
    console.error("Folder fetch error:", error);
    return NextResponse.json(
      { error: "폴더 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 폴더 수정 (이름 변경)
export async function PUT(
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
    const { name, color, icon } = body;

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

    // 이름 변경 시 중복 확인
    if (name && name !== folder.name) {
      const existingFolder = await prisma.folder.findFirst({
        where: {
          userId: session.user.id,
          parentId: folder.parentId,
          name: name.trim(),
          id: { not: folderId },
        },
      });

      if (existingFolder) {
        return NextResponse.json(
          { error: "같은 이름의 폴더가 이미 존재합니다" },
          { status: 409 }
        );
      }
    }

    // 폴더 수정
    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: {
        name: name?.trim() || folder.name,
        color: color !== undefined ? color : folder.color,
        icon: icon !== undefined ? icon : folder.icon,
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
      message: "폴더가 수정되었습니다",
      folder: updatedFolder,
    });

  } catch (error) {
    console.error("Folder update error:", error);
    return NextResponse.json(
      { error: "폴더 수정 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 폴더 삭제
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

    const folderId = params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        _count: {
          select: {
            children: true,
            files: true,
          },
        },
      },
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

    // 하위 폴더나 파일이 있으면 경고
    if (folder._count.children > 0 || folder._count.files > 0) {
      return NextResponse.json(
        { 
          error: "폴더가 비어있지 않습니다",
          info: `하위 폴더 ${folder._count.children}개, 파일 ${folder._count.files}개`
        },
        { status: 400 }
      );
    }

    // 폴더 삭제
    await prisma.folder.delete({
      where: { id: folderId },
    });

    return NextResponse.json({
      message: "폴더가 삭제되었습니다",
    });

  } catch (error) {
    console.error("Folder delete error:", error);
    return NextResponse.json(
      { error: "폴더 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
