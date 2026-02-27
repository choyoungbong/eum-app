// src/app/api/posts/[id]/share/route.ts
// ✅ 수정: catch(error) → catch(err) with type cast
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function POST(
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
    const { sharedWithEmail, permission = "VIEW" } = body;

    if (!sharedWithEmail) {
      return NextResponse.json({ error: "공유할 사용자 이메일을 입력하세요" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return NextResponse.json({ error: "게시글을 찾을 수 없습니다" }, { status: 404 });
    }
    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const sharedWithUser = await prisma.user.findUnique({
      where: { email: sharedWithEmail },
    });
    if (!sharedWithUser) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    }
    if (sharedWithUser.id === session.user.id) {
      return NextResponse.json({ error: "자기 자신에게는 공유할 수 없습니다" }, { status: 400 });
    }

    const existing = await prisma.sharedResource.findFirst({
      where: { resourceType: "POST", resourceId: postId, sharedWithId: sharedWithUser.id },
    });

    if (existing) {
      const updated = await prisma.sharedResource.update({
        where: { id: existing.id },
        data: { permission },
      });
      return NextResponse.json({ message: "공유 권한이 업데이트되었습니다", share: updated });
    }

    const share = await prisma.sharedResource.create({
      data: {
        resourceType: "POST",
        resourceId:   postId,
        ownerId:      session.user.id,
        sharedWithId: sharedWithUser.id,
        permission,
      },
    });

    return NextResponse.json({ message: "게시글이 공유되었습니다", share }, { status: 201 });

  } catch (err: unknown) {
    const e = err as any;
    console.error("게시글 공유 오류:", e?.message ?? err);
    return NextResponse.json({ error: "게시글 공유 중 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const shares = await prisma.sharedResource.findMany({
      where: { resourceType: "POST", resourceId: params.id, ownerId: session.user.id },
      include: { sharedWith: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ shares });
  } catch (err: unknown) {
    console.error("게시글 공유 목록 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
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

    const { shareId } = await request.json();
    const share = await prisma.sharedResource.findUnique({ where: { id: shareId } });
    if (!share || share.ownerId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    await prisma.sharedResource.delete({ where: { id: shareId } });
    return NextResponse.json({ message: "공유가 취소되었습니다" });
  } catch (err: unknown) {
    console.error("게시글 공유 취소 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
