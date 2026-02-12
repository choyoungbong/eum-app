import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 태그 목록 조회
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
    const search = searchParams.get("search") || "";

    // 모든 태그 조회 (사용 횟수 포함)
    const tags = await prisma.tag.findMany({
      where: search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {},
      include: {
        _count: {
          select: {
            fileTags: true,
            postTags: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      tags: tags.map((tag) => ({
        ...tag,
        usageCount: tag._count.fileTags + tag._count.postTags,
      })),
    });
  } catch (error) {
    console.error("Tags fetch error:", error);
    return NextResponse.json(
      { error: "태그 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 태그 생성
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
    const { name, color } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "태그 이름을 입력하세요" },
        { status: 400 }
      );
    }

    // 중복 확인
    const existingTag = await prisma.tag.findUnique({
      where: { name: name.trim().toLowerCase() },
    });

    if (existingTag) {
      return NextResponse.json(
        { error: "이미 존재하는 태그입니다", tag: existingTag },
        { status: 409 }
      );
    }

    // 태그 생성
    const tag = await prisma.tag.create({
      data: {
        name: name.trim().toLowerCase(),
        color: color || null,
      },
    });

    return NextResponse.json(
      {
        message: "태그가 생성되었습니다",
        tag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tag create error:", error);
    return NextResponse.json(
      { error: "태그 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
