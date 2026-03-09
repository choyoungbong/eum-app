import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ✅ [수정] route → lib/auth
import { prisma } from "@/lib/db";
import logger from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const postId = params.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다" }, { status: 404 });
    }

    const isOwner = post.userId === session.user.id;
    const isPublic = post.visibility === "PUBLIC";

    let isShared = false;
    if (!isOwner && !isPublic && post.visibility === "SHARED") {
      const shareCheck = await prisma.sharedResource.findFirst({
        where: { resourceType: "POST", resourceId: postId, sharedWithId: session.user.id },
      });
      isShared = !!shareCheck;
    }

    const canView = isOwner || isPublic || isShared;

    logger.debug("post_access_check", {
      postId, userId: session.user.id, visibility: post.visibility,
      isOwner, isPublic, isShared, canView,
    });

    if (!canView) {
      return NextResponse.json({ error: "접근 권한이 없습니다" }, { status: 403 });
    }

    return NextResponse.json({ post });

  } catch (error) {
    logger.error("post_fetch_error", { error });
    return NextResponse.json({ error: "게시글 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const postId = params.id;
    const body = await request.json();

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다" }, { status: 404 });
    }

    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: "수정 권한이 없습니다" }, { status: 403 });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { title: body.title, content: body.content, visibility: body.visibility },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ message: "게시글이 수정되었습니다", post: updatedPost });

  } catch (error) {
    logger.error("post_update_error", { error });
    return NextResponse.json({ error: "게시글 수정 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const postId = params.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다" }, { status: 404 });
    }

    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
    }

    await prisma.post.delete({ where: { id: postId } });

    return NextResponse.json({ message: "게시글이 삭제되었습니다" });

  } catch (error) {
    logger.error("post_delete_error", { error });
    return NextResponse.json({ error: "게시글 삭제 중 오류가 발생했습니다" }, { status: 500 });
  }
}
