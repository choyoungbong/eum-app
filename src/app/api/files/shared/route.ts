// src/app/api/files/shared/route.ts
// ⚠️ 수정: SharedResource 모델에 file 직접 관계 없음
//    resourceId로 별도 File 조회로 변경

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    // 1. 공유받은 리소스 조회 (FILE 타입만)
    const sharedResources = await prisma.sharedResource.findMany({
      where: {
        resourceType: "FILE",
        sharedWithId: session.user.id,
      },
      include: {
        owner: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (sharedResources.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // 2. resourceId로 파일 정보 별도 조회
    const fileIds = sharedResources.map((sr: any) => sr.resourceId);
    const files = await prisma.file.findMany({
      where:  { id: { in: fileIds }, deletedAt: null },
      select: {
        id: true, filename: true, originalName: true,
        size: true, mimeType: true, thumbnailUrl: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    const fileMap = Object.fromEntries(files.map((f: any) => [f.id, f]));

    // 3. 조합
    const result = sharedResources
      .map((share: any) => {
        const file = fileMap[share.resourceId];
        if (!file) return null;
        return {
          id:            file.id,
          filename:      file.filename,
          originalName:  file.originalName,
          size:          file.size.toString(),
          mimeType:      file.mimeType,
          thumbnailUrl:  file.thumbnailUrl,
          createdAt:     file.createdAt,
          sharedBy:      share.owner.name,
          sharedByEmail: share.owner.email,
          permission:    share.permission,
          sharedAt:      share.createdAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ files: result });

  } catch (error) {
    console.error("Shared files fetch error:", error);
    return NextResponse.json(
      { error: "공유 파일 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
