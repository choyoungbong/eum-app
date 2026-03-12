// src/app/api/files/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

// GET — 파일 메타 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { fileTags: { include: { tag: true } } },
  });

  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  return NextResponse.json(file);
}

// DELETE — 휴지통으로 이동 (soft delete) / 영구 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

    const file = await prisma.file.findUnique({ where: { id: params.id } });
    if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
    if (file.userId !== session.user.id)
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

    // 이미 삭제된 파일이면 영구 삭제
    if (file.deletedAt) {
      // ✅ [품질-3] 물리 파일 삭제
      if (existsSync(file.filepath)) {
        await unlink(file.filepath);
      }

      // ✅ [품질-3] 썸네일 삭제 버그 수정
      // 기존: file.thumbnailUrl("/api/files/thumbnail/thumb_xxx.jpg")을 파일 경로로 직접 사용 → 삭제 안 됨
      // 개선: URL에서 파일명만 추출 후 실제 스토리지 경로로 변환
      if (file.thumbnailUrl) {
        const thumbFilename = basename(file.thumbnailUrl); // "thumb_xxx.jpg"
        const thumbPath = join(STORAGE_PATH, "thumbnails", thumbFilename);
        if (existsSync(thumbPath)) {
          await unlink(thumbPath);
        }
      }

      await prisma.file.delete({ where: { id: params.id } });
      return NextResponse.json({ message: "파일이 영구 삭제되었습니다", permanent: true });
    }

    // 처음 삭제: 휴지통으로 이동 (물리 파일은 유지)
    await prisma.file.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "파일이 휴지통으로 이동되었습니다", permanent: false });
  } catch (error) {
    console.error("File delete error:", error);
    return NextResponse.json({ error: "파일 삭제 중 오류가 발생했습니다" }, { status: 500 });
  }
}