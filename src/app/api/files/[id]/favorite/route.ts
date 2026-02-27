// src/app/api/files/[id]/favorite/route.ts
// POST — 즐겨찾기 토글 (starred)
// PATCH — 핀 고정 토글 (pinned)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// POST — 즐겨찾기 토글
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, isStarred: true },
  });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });

  const updated = await prisma.file.update({
    where: { id: params.id },
    data: { isStarred: !file.isStarred },
    select: { id: true, isStarred: true },
  });

  return NextResponse.json({ starred: updated.isStarred });
}

// PATCH — 핀 고정 토글
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true, isPinned: true },
  });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });

  // 핀 고정은 최대 10개
  if (!file.isPinned) {
    const pinnedCount = await prisma.file.count({
      where: { userId: session.user.id, isPinned: true },
    });
    if (pinnedCount >= 10)
      return NextResponse.json({ error: "핀 고정은 최대 10개까지 가능합니다" }, { status: 400 });
  }

  const updated = await prisma.file.update({
    where: { id: params.id },
    data: { isPinned: !file.isPinned },
    select: { id: true, isPinned: true },
  });

  return NextResponse.json({ pinned: updated.isPinned });
}

// ── schema.prisma File 모델에 추가할 필드 ──────────────────
// isStarred  Boolean  @default(false) @map("is_starred")
// isPinned   Boolean  @default(false) @map("is_pinned")
// @@index([userId, isStarred])
// @@index([userId, isPinned])
