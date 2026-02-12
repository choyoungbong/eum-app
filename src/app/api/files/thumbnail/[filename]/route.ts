import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const thumbnailPath = join(STORAGE_PATH, "thumbnails", params.filename);

    if (!existsSync(thumbnailPath)) {
      return NextResponse.json(
        { error: "썸네일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(thumbnailPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
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