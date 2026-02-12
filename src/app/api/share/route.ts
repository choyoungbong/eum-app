import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 공유 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    // 내가 공유받은 목록
    const sharedWithMe = await prisma.sharedResource.findMany({
      where: { sharedWithId: session.user.id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 내가 공유한 목록
    const sharedByMe = await prisma.sharedResource.findMany({
      where: { ownerId: session.user.id },
      include: {
        sharedWith: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sharedWithMe, sharedByMe });
  } catch (error) {
    console.error("Share list error:", error);
    return NextResponse.json(
      { error: "공유 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 공유 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { resourceType, resourceId, sharedWithEmail, permission } = body;

    // 필수값 확인
    if (!resourceType || !resourceId || !sharedWithEmail) {
      return NextResponse.json(
        { error: "resourceType, resourceId, sharedWithEmail 은 필수입니다" },
        { status: 400 }
      );
    }

    // 공유 대상 사용자 찾기 (이메일로)
    const sharedWithUser = await prisma.user.findUnique({
      where: { email: sharedWithEmail.trim().toLowerCase() },
    });

    if (!sharedWithUser) {
      return NextResponse.json(
        { error: "해당 이메일의 사용자를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 자기 자신에게 공유 방지
    if (sharedWithUser.id === session.user.id) {
      return NextResponse.json(
        { error: "자기 자신에게는 공유할 수 없습니다" },
        { status: 400 }
      );
    }

    // 리소스 존재 + 소유자 확인
    if (resourceType === "FILE") {
      const file = await prisma.file.findUnique({
        where: { id: resourceId },
      });
      if (!file) {
        return NextResponse.json(
          { error: "파일을 찾을 수 없습니다" },
          { status: 404 }
        );
      }
      if (file.userId !== session.user.id) {
        return NextResponse.json(
          { error: "파일 소유자만 공유할 수 있습니다" },
          { status: 403 }
        );
      }
    } else if (resourceType === "FOLDER") {
      const folder = await prisma.folder.findUnique({
        where: { id: resourceId },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "폴더를 찾을 수 없습니다" },
          { status: 404 }
        );
      }
      if (folder.userId !== session.user.id) {
        return NextResponse.json(
          { error: "폴더 소유자만 공유할 수 있습니다" },
          { status: 403 }
        );
      }
    } else if (resourceType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: resourceId },
      });
      if (!post) {
        return NextResponse.json(
          { error: "게시글을 찾을 수 없습니다" },
          { status: 404 }
        );
      }
      if (post.authorId !== session.user.id) {
        return NextResponse.json(
          { error: "게시글 작성자만 공유할 수 있습니다" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "올바르지 않은 resourceType 입니다 (FILE | FOLDER | POST)" },
        { status: 400 }
      );
    }

    // 이미 공유 중인지 확인
    const existing = await prisma.sharedResource.findFirst({
      where: {
        resourceType,
        resourceId,
        sharedWithId: sharedWithUser.id,
      },
    });

    if (existing) {
      // 이미 있으면 권한만 업데이트
      const updated = await prisma.sharedResource.update({
        where: { id: existing.id },
        data: { permission: permission || "VIEW" },
      });
      return NextResponse.json({
        message: "공유 권한이 업데이트되었습니다",
        share: updated,
      });
    }

    // 새 공유 생성
    const share = await prisma.sharedResource.create({
      data: {
        resourceType,
        resourceId,
        ownerId: session.user.id,        // ← sharedById → ownerId 수정
        sharedWithId: sharedWithUser.id,
        permission: permission || "VIEW",
      },
    });

    return NextResponse.json(
      { message: "공유가 완료되었습니다", share },
      { status: 201 }
    );
  } catch (error) {
    console.error("Share create error:", error);
    return NextResponse.json(
      { error: "공유 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}