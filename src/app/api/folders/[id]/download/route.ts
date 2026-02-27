// src/app/api/folders/[id]/download/route.ts
// GET — 폴더 전체를 ZIP으로 압축해 다운로드

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { existsSync, createReadStream } from "fs";
import path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";

// npm install archiver && npm install --save-dev @types/archiver

async function getFolderFiles(
  folderId: string,
  userId: string,
  prefix = ""
): Promise<{ filepath: string; archiveName: string }[]> {
  const [files, subFolders] = await Promise.all([
    prisma.file.findMany({
      where: { folderId, userId, deletedAt: null },
      select: { filepath: true, originalName: true },
    }),
    prisma.folder.findMany({
      where: { parentId: folderId, userId },
      select: { id: true, name: true },
    }),
  ]);

  const result: { filepath: string; archiveName: string }[] = [];

  for (const f of files) {
    if (existsSync(f.filepath)) {
      result.push({ filepath: f.filepath, archiveName: path.join(prefix, f.originalName) });
    }
  }

  for (const sf of subFolders) {
    const subFiles = await getFolderFiles(sf.id, userId, path.join(prefix, sf.name));
    result.push(...subFiles);
  }

  return result;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!folder) return NextResponse.json({ error: "폴더를 찾을 수 없습니다" }, { status: 404 });

  const files = await getFolderFiles(params.id, session.user.id, "");

  if (files.length === 0) {
    return NextResponse.json({ error: "폴더에 파일이 없습니다" }, { status: 400 });
  }

  // archiver로 ZIP 스트림 생성
  const passThrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err) => { passThrough.destroy(err); });
  archive.pipe(passThrough);

  for (const { filepath, archiveName } of files) {
    archive.append(createReadStream(filepath), { name: archiveName });
  }
  archive.finalize();

  const readable = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk) => controller.enqueue(chunk));
      passThrough.on("end", () => controller.close());
      passThrough.on("error", (err) => controller.error(err));
    },
  });

  const zipName = `${folder.name}.zip`;
  return new NextResponse(readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    },
  });
}
