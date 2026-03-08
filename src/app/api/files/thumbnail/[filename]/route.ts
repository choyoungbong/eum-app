import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename, resolve } from "path";
import { existsSync } from "fs";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // ✅ [보안-1] Path Traversal 방지
    // basename()으로 디렉터리 경로 제거 (예: ../../etc/passwd → passwd)
    const safeFilename = basename(params.filename);

    // 빈 파일명 또는 숨김 파일 차단
    if (!safeFilename || safeFilename.startsWith(".")) {
      return NextResponse.json(
        { error: "잘못된 요청입니다" },
        { status: 400 }
      );
    }

    const thumbnailPath = join(STORAGE_PATH, "thumbnails", safeFilename);

    // ✅ resolve()로 최종 경로가 thumbnails 디렉터리 내부인지 2차 검증
    const resolvedPath = resolve(thumbnailPath);
    const resolvedBase = resolve(join(STORAGE_PATH, "thumbnails"));

    if (!resolvedPath.startsWith(resolvedBase + "/") && resolvedPath !== resolvedBase) {
      return NextResponse.json(
        { error: "잘못된 요청입니다" },
        { status: 400 }
      );
    }

    if (!existsSync(resolvedPath)) {
      return NextResponse.json(
        { error: "썸네일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(resolvedPath);

    // ✅ 확장자 기반 Content-Type 설정 (jpeg 고정 → 실제 파일 타입 반영)
    const ext = safeFilename.split(".").pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const contentType = contentTypeMap[ext ?? ""] ?? "image/jpeg";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Thumbnail serve error:", error);
    return NextResponse.json(
      { error: "썸네일 로딩 실패" },
      { status: 500 }
    );
  }
}