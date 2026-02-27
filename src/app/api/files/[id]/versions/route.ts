// src/app/api/files/[id]/versions/route.ts
// GET  — 버전 목록 조회
// POST — 현재 파일을 새 버전으로 저장

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const VERSIONS_DIR = process.env.STORAGE_PATH
  ? path.join(process.env.STORAGE_PATH, "versions")
  : "./storage/versions";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });

  const versions = await prisma.fileVersion.findMany({
    where: { fileId: params.id },
    include: { user: { select: { name: true } } },
    orderBy: { versionNum: "desc" },
  });

  return NextResponse.json({ versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });

  const { comment } = await request.json().catch(() => ({}));

  // 최신 버전 번호
  const latest = await prisma.fileVersion.findFirst({
    where: { fileId: params.id },
    orderBy: { versionNum: "desc" },
  });
  const nextVer = (latest?.versionNum ?? 0) + 1;

  // 버전 스냅샷 저장
  if (!existsSync(VERSIONS_DIR)) await mkdir(VERSIONS_DIR, { recursive: true });
  const ext = path.extname(file.filepath);
  const snapshotPath = path.join(VERSIONS_DIR, `${params.id}_v${nextVer}${ext}`);

  if (!existsSync(file.filepath)) {
    return NextResponse.json({ error: "원본 파일을 찾을 수 없습니다" }, { status: 404 });
  }
  await copyFile(file.filepath, snapshotPath);

  const version = await prisma.fileVersion.create({
    data: {
      fileId: params.id,
      versionNum: nextVer,
      filepath: snapshotPath,
      size: file.size,
      createdBy: session.user.id,
      comment: comment ?? null,
    },
  });

  // 최대 10개 버전 유지 (가장 오래된 것 삭제)
  const allVersions = await prisma.fileVersion.findMany({
    where: { fileId: params.id },
    orderBy: { versionNum: "asc" },
  });
  if (allVersions.length > 10) {
    const toDelete = allVersions.slice(0, allVersions.length - 10);
    for (const v of toDelete) {
      try {
        const { unlink } = await import("fs/promises");
        if (existsSync(v.filepath)) await unlink(v.filepath);
        await prisma.fileVersion.delete({ where: { id: v.id } });
      } catch {}
    }
  }

  return NextResponse.json({ version, message: `버전 ${nextVer}이 저장되었습니다` });
}
