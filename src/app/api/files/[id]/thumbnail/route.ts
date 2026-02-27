import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import sharp from "sharp";
import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

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

    // 파일 정보 조회
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    const isOwner = file.userId === session.user.id;

    // 공유 확인
    let isShared = false;
    if (!isOwner) {
      const shareCheck = await prisma.sharedResource.findFirst({
        where: {
          resourceType: "FILE",
          resourceId: fileId,
          sharedWithId: session.user.id,
        },
      });
      isShared = !!shareCheck;
    }

    const canView = isOwner || isShared;

    if (!canView) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 이미지 파일만 썸네일 생성
    if (!file.mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "이미지 파일만 썸네일을 생성할 수 있습니다" },
        { status: 400 }
      );
    }

    const thumbnailDir = join(STORAGE_PATH, "thumbnails");
    const thumbnailPath = join(thumbnailDir, `${fileId}.jpg`);

    // 썸네일이 이미 존재하면 반환
    if (existsSync(thumbnailPath)) {
      const thumbnailBuffer = await sharp(thumbnailPath).toBuffer();
      return new NextResponse(new Uint8Array(thumbnailBuffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    }

    // 원본 파일 존재 확인
    if (!existsSync(file.filepath)) {
      return NextResponse.json(
        { error: "원본 파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 썸네일 디렉토리 생성
    if (!existsSync(thumbnailDir)) {
      await mkdir(thumbnailDir, { recursive: true });
    }

    // 썸네일 생성
    const thumbnailBuffer = await sharp(file.filepath)
      .resize(300, 300, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // 썸네일 저장
    await writeFile(thumbnailPath, thumbnailBuffer);

    // DB 업데이트
    await prisma.file.update({
      where: { id: fileId },
      data: {
        thumbnailUrl: `/api/files/${fileId}/thumbnail`,
      },
    });

    return new NextResponse(new Uint8Array(thumbnailBuffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });

  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return NextResponse.json(
      { error: "썸네일 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
