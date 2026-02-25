// src/app/api/share/[token]/route.ts
// 공개 토큰으로 파일 정보 조회 (비로그인 접근 가능)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createReadStream } from "fs";
import { stat } from "fs/promises";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const file = await prisma.file.findUnique({
    where: { publicToken: params.token },
    select: {
      id: true, originalName: true, mimeType: true,
      size: true, filepath: true, thumbnailUrl: true,
      createdAt: true,
      user: { select: { name: true } },
      deletedAt: true,
    },
  });

  if (!file || file.deletedAt) {
    return NextResponse.json({ error: "파일을 찾을 수 없거나 만료된 링크입니다" }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download");

  // 메타데이터만 반환
  if (!download) {
    return NextResponse.json({
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size.toString(),
      thumbnailUrl: file.thumbnailUrl,
      createdAt: file.createdAt,
      ownerName: file.user.name,
    });
  }

  // 파일 스트림 반환 (다운로드)
  try {
    const fileStat = await stat(file.filepath);
    const stream = createReadStream(file.filepath);
    const readable = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "파일을 읽을 수 없습니다" }, { status: 500 });
  }
}
