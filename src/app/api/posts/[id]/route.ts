import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 게시글 상세 조회
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

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "게시글을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    const isOwner = post.userId === session.user.id;
    const isPublic = post.visibility === "PUBLIC";

    // 공유 확인
    let isShared = false;
    if (!isOwner && !isPublic && post.visibility === "SHARED") {
      const shareCheck = await prisma.sharedResource.findFirst({
        where: {
          resourceType: "POST",
          resourceId: postId,
          sharedWithId: session.user.id,
        },
      });
      isShared = !!shareCheck;
    }

    // 접근 권한 확인
    const canView = isOwner || isPublic || isShared;

    console.log("=== 게시글 접근 확인 ===");
    console.log("사용자 ID:", session.user.id);
    console.log("게시글 소유자:", post.userId);
    console.log("공개 설정:", post.visibility);
    console.log("소유자:", isOwner);
    console.log("공개 글:", isPublic);
    console.log("공유받음:", isShared);
    console.log("접근 가능:", canView);

    if (!canView) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    return NextResponse.json({ post });

  } catch (error) {
    console.error("Post fetch error:", error);
    return NextResponse.json(
      { error: "게시글 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 게시글 수정
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

    const postId = params.id;
    const body = await request.json();

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
        { error: "수정 권한이 없습니다" },
        { status: 403 }
      );
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title: body.title,
        content: body.content,
        visibility: body.visibility,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "게시글이 수정되었습니다",
      post: updatedPost,
    });

  } catch (error) {
    console.error("Post update error:", error);
    return NextResponse.json(
      { error: "게시글 수정 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 게시글 삭제
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
        { error: "삭제 권한이 없습니다" },
        { status: 403 }
      );
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    return NextResponse.json({
      message: "게시글이 삭제되었습니다",
    });

  } catch (error) {
    console.error("Post delete error:", error);
    return NextResponse.json(
      { error: "게시글 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
