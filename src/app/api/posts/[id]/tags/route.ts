import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 게시글의 태그 목록 조회
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

    const postId = params.id;

    // 게시글 확인
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json(
        { error: "게시글을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 태그 조회
    const postTags = await prisma.postTag.findMany({
      where: { postId },
      include: {
        tag: true,
      },
    });

    return NextResponse.json({
      tags: postTags.map((pt) => pt.tag),
    });
  } catch (error) {
    console.error("Post tags fetch error:", error);
    return NextResponse.json(
      { error: "태그 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 게시글에 태그 추가
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

    const postId = params.id;
    const body = await request.json();
    const { tagName } = body;

    if (!tagName) {
      return NextResponse.json(
        { error: "태그 이름을 입력하세요" },
        { status: 400 }
      );
    }

    // 게시글 확인
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json(
        { error: "게시글을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (post.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 태그 찾기 또는 생성
    let tag = await prisma.tag.findUnique({
      where: { name: tagName.trim().toLowerCase() },
    });

    if (!tag) {
      tag = await prisma.tag.create({
        data: { name: tagName.trim().toLowerCase() },
      });
    }

    // 이미 추가된 태그인지 확인
    const existingPostTag = await prisma.postTag.findUnique({
      where: {
        postId_tagId: {
          postId,
          tagId: tag.id,
        },
      },
    });

    if (existingPostTag) {
      return NextResponse.json(
        { error: "이미 추가된 태그입니다" },
        { status: 409 }
      );
    }

    // 태그 추가
    await prisma.postTag.create({
      data: {
        postId,
        tagId: tag.id,
      },
    });

    return NextResponse.json(
      {
        message: "태그가 추가되었습니다",
        tag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Post tag add error:", error);
    return NextResponse.json(
      { error: "태그 추가 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 게시글에서 태그 제거
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

    const postId = params.id;
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json(
        { error: "태그 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 게시글 확인
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json(
        { error: "게시글을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (post.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 태그 제거
    await prisma.postTag.delete({
      where: {
        postId_tagId: {
          postId,
          tagId,
        },
      },
    });

    return NextResponse.json({
      message: "태그가 제거되었습니다",
    });
  } catch (error) {
    console.error("Post tag remove error:", error);
    return NextResponse.json(
      { error: "태그 제거 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
