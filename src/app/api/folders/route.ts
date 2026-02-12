import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 폴더 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    // 특정 폴더의 하위 항목 조회
    const folders = await prisma.folder.findMany({
      where: {
        userId: session.user.id,
        parentId: parentId || null,
      },
      orderBy: {
        name: "asc",
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

    // 파일도 함께 조회
    const files = await prisma.file.findMany({
      where: {
        userId: session.user.id,
        folderId: parentId || null,
      },
      orderBy: {
        originalName: "asc",
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        size: true,
        mimeType: true,
        thumbnailUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      folders,
      files: files.map(f => ({
        ...f,
        size: f.size.toString(),
      })),
    });

  } catch (error) {
    console.error("Folders fetch error:", error);
    return NextResponse.json(
      { error: "폴더 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 폴더 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, parentId, color, icon } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "폴더 이름을 입력하세요" },
        { status: 400 }
      );
    }

    // 부모 폴더 확인 (있는 경우)
    if (parentId) {
      const parentFolder = await prisma.folder.findUnique({
        where: { id: parentId },
      });

      if (!parentFolder) {
        return NextResponse.json(
          { error: "부모 폴더를 찾을 수 없습니다" },
          { status: 404 }
        );
      }

      if (parentFolder.userId !== session.user.id) {
        return NextResponse.json(
          { error: "권한이 없습니다" },
          { status: 403 }
        );
      }
    }

    // 같은 이름의 폴더 확인
    const existingFolder = await prisma.folder.findFirst({
      where: {
        userId: session.user.id,
        parentId: parentId || null,
        name: name.trim(),
      },
    });

    if (existingFolder) {
      return NextResponse.json(
        { error: "같은 이름의 폴더가 이미 존재합니다" },
        { status: 409 }
      );
    }

    // 폴더 생성
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        userId: session.user.id,
        color: color || null,
        icon: icon || null,
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

    return NextResponse.json(
      {
        message: "폴더가 생성되었습니다",
        folder,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Folder create error:", error);
    return NextResponse.json(
      { error: "폴더 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
