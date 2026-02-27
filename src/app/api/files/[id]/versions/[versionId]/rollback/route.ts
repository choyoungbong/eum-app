// src/app/api/files/[id]/versions/[versionId]/rollback/route.ts
// POST — 특정 버전으로 롤백 (현재 파일을 버전 스냅샷으로 교체)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { copyFile } from "fs/promises";
import { existsSync } from "fs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const [file, version] = await Promise.all([
    prisma.file.findFirst({ where: { id: params.id, userId: session.user.id } }),
    prisma.fileVersion.findFirst({ where: { id: params.versionId, fileId: params.id } }),
  ]);

  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  if (!version) return NextResponse.json({ error: "버전을 찾을 수 없습니다" }, { status: 404 });
  if (!existsSync(version.filepath))
    return NextResponse.json({ error: "버전 스냅샷 파일이 없습니다" }, { status: 404 });

  // 롤백 전 현재 상태를 새 버전으로 저장
  const latest = await prisma.fileVersion.findFirst({
    where: { fileId: params.id }, orderBy: { versionNum: "desc" },
  });
  const nextVer = (latest?.versionNum ?? 0) + 1;
  const snapshotPath = version.filepath.replace(`_v${version.versionNum}`, `_v${nextVer}_before_rollback`);

  if (existsSync(file.filepath)) {
    await copyFile(file.filepath, snapshotPath);
    await prisma.fileVersion.create({
      data: {
        fileId: params.id, versionNum: nextVer,
        filepath: snapshotPath, size: file.size,
        createdBy: session.user.id,
        comment: `롤백 전 자동 저장 (v${version.versionNum}으로 롤백)`,
      },
    });
  }

  // 실제 롤백: 버전 스냅샷 → 현재 파일 경로로 복사
  await copyFile(version.filepath, file.filepath);
  await prisma.file.update({
    where: { id: params.id },
    data: { size: version.size, updatedAt: new Date() },
  });

  return NextResponse.json({
    message: `버전 ${version.versionNum}으로 롤백되었습니다`,
    versionNum: version.versionNum,
  });
}
