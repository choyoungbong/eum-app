// src/app/api/files/[id]/route.ts (DELETE 메서드 교체)
// 기존 DELETE를 soft delete로 변경

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

// PATCH — 파일 메타 수정 (기존 유지)
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

// DELETE — 휴지통으로 이동 (soft delete)
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
      if (existsSync(file.filepath)) await unlink(file.filepath);
      if (file.thumbnailUrl && existsSync(file.thumbnailUrl)) await unlink(file.thumbnailUrl);
      await prisma.file.delete({ where: { id: params.id } });
      return NextResponse.json({ message: "파일이 영구 삭제되었습니다", permanent: true });
    }

    // 처음 삭제: 휴지통으로 이동
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
