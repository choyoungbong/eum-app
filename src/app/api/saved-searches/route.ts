import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 저장된 검색 목록
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const savedSearches = await prisma.savedSearch.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ savedSearches });
  } catch (error) {
    console.error("Saved searches fetch error:", error);
    return NextResponse.json(
      { error: "저장된 검색 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 검색 저장
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
    const { name, query } = body;

    if (!name || !query) {
      return NextResponse.json(
        { error: "이름과 검색 조건을 입력하세요" },
        { status: 400 }
      );
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        name,
        query,
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      {
        message: "검색이 저장되었습니다",
        savedSearch,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Save search error:", error);
    return NextResponse.json(
      { error: "검색 저장 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
