// src/app/api/files/trash/route.ts
// GET  — 휴지통 파일 목록
// DELETE — 휴지통 비우기 (영구 삭제)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const files = await prisma.file.findMany({
    where: { userId: session.user.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true, originalName: true, mimeType: true,
      size: true, thumbnailUrl: true, deletedAt: true, createdAt: true,
    },
  });

  return NextResponse.json({ files });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const files = await prisma.file.findMany({
    where: { userId: session.user.id, deletedAt: { not: null } },
    select: { id: true, filepath: true, thumbnailUrl: true },
  });

  // 실제 파일 삭제
  await Promise.all(
    files.map(async (f) => {
      try {
        if (existsSync(f.filepath)) await unlink(f.filepath);
        if (f.thumbnailUrl && existsSync(f.thumbnailUrl)) await unlink(f.thumbnailUrl);
      } catch {}
    })
  );

  // DB 영구 삭제
  await prisma.file.deleteMany({
    where: { userId: session.user.id, deletedAt: { not: null } },
  });

  return NextResponse.json({ message: `${files.length}개 파일이 영구 삭제되었습니다`, count: files.length });
}
