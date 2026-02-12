import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 파일 공유 생성
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

    const fileId = params.id;
    const body = await request.json();
    const { sharedWithEmail, permission = "VIEW" } = body;

    if (!sharedWithEmail) {
      return NextResponse.json(
        { error: "공유할 사용자 이메일을 입력하세요" },
        { status: 400 }
      );
    }

    // 파일 확인
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { error: "파일 소유자만 공유할 수 있습니다" },
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
        resourceType: "FILE",
        resourceId: fileId,
        sharedWithId: sharedWithUser.id,
      },
    });

    if (existingShare) {
      return NextResponse.json(
        { error: "이미 공유된 파일입니다" },
        { status: 409 }
      );
    }

    // 공유 생성
    const share = await prisma.sharedResource.create({
      data: {
        resourceType: "FILE",
        resourceId: fileId,
        ownerId: session.user.id,
        sharedWithId: sharedWithUser.id,
        permission,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "파일이 공유되었습니다",
        share,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("File share error:", error);
    return NextResponse.json(
      { error: "파일 공유 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 파일 공유 목록 조회
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

    const fileId = params.id;

    // 파일 확인 및 권한 체크
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { error: "권한이 없습니다" },
        { status: 403 }
      );
    }

    // 공유 목록 조회
    const shares = await prisma.sharedResource.findMany({
      where: {
        resourceType: "FILE",
        resourceId: fileId,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ shares });

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
