import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    // 공유받은 파일 조회
    const sharedResources = await prisma.sharedResource.findMany({
      where: {
        resourceType: "FILE",
        sharedWithId: session.user.id,
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            size: true,
            mimeType: true,
            thumbnailUrl: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 파일 정보 변환
    const files = sharedResources.map((share) => ({
      id: share.file?.id,
      filename: share.file?.filename,
      originalName: share.file?.originalName,
      size: share.file?.size.toString(),
      mimeType: share.file?.mimeType,
      thumbnailUrl: share.file?.thumbnailUrl,
      createdAt: share.file?.createdAt,
      sharedBy: share.owner.name,
      sharedByEmail: share.owner.email,
      permission: share.permission,
      sharedAt: share.createdAt,
    }));

    return NextResponse.json({ files });

  } catch (error) {
    console.error("Shared files fetch error:", error);
    return NextResponse.json(
      { error: "공유 파일 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}