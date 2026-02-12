import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 폴더 공유 생성
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

    const folderId = params.id;
    const body = await request.json();
    const { sharedWithEmail, permission = "VIEW" } = body;

    if (!sharedWithEmail) {
      return NextResponse.json(
        { error: "공유할 사용자 이메일을 입력하세요" },
        { status: 400 }
      );
    }

    // 폴더 확인
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "폴더를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (folder.userId !== session.user.id) {
      return NextResponse.json(
        { error: "폴더 소유자만 공유할 수 있습니다" },
        { status: 403 }
      );
    }

    // 공유 대상 사용자 확인
    const sharedWithUser = await prisma.user.findUnique({
      where: { email: sharedWithEmail },
    });

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
        resourceType: "FOLDER",
        resourceId: folderId,
        sharedWithId: sharedWithUser.id,
      },
    });

    if (existingShare) {
      return NextResponse.json(
        { error: "이미 공유된 폴더입니다" },
        { status: 409 }
      );
    }

    // 공유 생성
    const share = await prisma.sharedResource.create({
      data: {
        resourceType: "FOLDER",
        resourceId: folderId,
        ownerId: session.user.id,
        sharedWithId: sharedWithUser.id,
        permission,
      },
    });

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
        message: "폴더가 공유되었습니다",
        share: {
          ...share,
          sharedWith: shareWithUser,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Folder share error:", error);
    return NextResponse.json(
      { error: "폴더 공유 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 폴더 공유 목록 조회
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

    // 폴더 확인
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

    // 공유 목록 조회
    const shares = await prisma.sharedResource.findMany({
      where: {
        resourceType: "FOLDER",
        resourceId: folderId,
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
