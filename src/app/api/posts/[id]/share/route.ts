import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 게시글 공유 생성
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
    const { sharedWithEmail, permission = "VIEW" } = body;

    console.log("=== 게시글 공유 시도 ===");
    console.log("게시글 ID:", postId);
    console.log("공유 대상:", sharedWithEmail);
    console.log("권한:", permission);

    if (!sharedWithEmail) {
      return NextResponse.json(
        { error: "공유할 사용자 이메일을 입력하세요" },
        { status: 400 }
      );
    }

    // 게시글 확인 (관계 없이)
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    console.log("게시글 존재:", post ? "✅" : "❌");

    if (!post) {
      return NextResponse.json(
        { error: "게시글을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (post.userId !== session.user.id) {
      return NextResponse.json(
        { error: "게시글 소유자만 공유할 수 있습니다" },
        { status: 403 }
      );
    }

    // 공유 대상 사용자 확인
    const sharedWithUser = await prisma.user.findUnique({
      where: { email: sharedWithEmail },
    });

    console.log("공유 대상 존재:", sharedWithUser ? "✅" : "❌");

    if (!sharedWithUser) {
      return NextResponse.json(
        { error: "해당 이메일의 사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 본인에게 공유 방지
    if (sharedWithUser.id === session.user.id) {
      return NextResponse.json(
        { error: "본인에게는 공유할 수 없습니다" },
        { status: 400 }
      );
    }

    // 이미 공유된 경우 확인
    const existingShare = await prisma.sharedResource.findFirst({
      where: {
        resourceType: "POST",
        resourceId: postId,
        sharedWithId: sharedWithUser.id,
      },
    });

    if (existingShare) {
      return NextResponse.json(
        { error: "이미 공유된 게시글입니다" },
        { status: 409 }
      );
    }

    console.log("공유 데이터:", {
      resourceType: "POST",
      resourceId: postId,
      ownerId: session.user.id,
      sharedWithId: sharedWithUser.id,
      permission,
    });

    // 공유 생성 (관계 없이)
    const share = await prisma.sharedResource.create({
      data: {
        resourceType: "POST",
        resourceId: postId,
        ownerId: session.user.id,
        sharedWithId: sharedWithUser.id,
        permission,
      },
    });

    console.log("✅ 공유 성공:", share.id);

    // 공유 대상 정보 수동 조회
    const shareWithUser = await prisma.user.findUnique({
      where: { id: share.sharedWithId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        message: "게시글이 공유되었습니다",
        share: {
          ...share,
          sharedWith: shareWithUser,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("=== 게시글 공유 오류 ===");
    console.error("Error:", error);
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    
    return NextResponse.json(
      { error: "게시글 공유 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 게시글 공유 목록 조회
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

    if (post.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 공유 목록 조회
    const shares = await prisma.sharedResource.findMany({
      where: {
        resourceType: "POST",
        resourceId: postId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 각 공유의 사용자 정보 수동 조회
    const sharesWithUsers = await Promise.all(
      shares.map(async (share) => {
        const sharedWith = await prisma.user.findUnique({
          where: { id: share.sharedWithId },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });

        return {
          ...share,
          sharedWith,
        };
      })
    );

    return NextResponse.json({ shares: sharesWithUsers });

  } catch (error) {
    console.error("Share list error:", error);
    return NextResponse.json(
      { error: "공유 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 공유 삭제
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

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("shareId");

    if (!shareId) {
      return NextResponse.json(
        { error: "공유 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 공유 확인
    const share = await prisma.sharedResource.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      return NextResponse.json(
        { error: "공유 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (share.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 공유 삭제
    await prisma.sharedResource.delete({
      where: { id: shareId },
    });

    return NextResponse.json({
      message: "공유가 취소되었습니다",
    });

  } catch (error) {
    console.error("Share delete error:", error);
    return NextResponse.json(
      { error: "공유 취소 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
