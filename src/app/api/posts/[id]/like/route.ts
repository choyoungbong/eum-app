// src/app/api/posts/[id]/like/route.ts
// POST — 좋아요 토글 (있으면 취소, 없으면 추가)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: params.id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
    const count = await prisma.postLike.count({ where: { postId: params.id } });
    return NextResponse.json({ liked: false, count });
  } else {
    await prisma.postLike.create({ data: { postId: params.id, userId: session.user.id } });
    const count = await prisma.postLike.count({ where: { postId: params.id } });
    return NextResponse.json({ liked: true, count });
  }
}

// GET — 좋아요 상태 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ liked: false, count: 0 });

  const [liked, count] = await Promise.all([
    prisma.postLike.findUnique({
      where: { postId_userId: { postId: params.id, userId: session.user.id } },
    }),
    prisma.postLike.count({ where: { postId: params.id } }),
  ]);

  return NextResponse.json({ liked: !!liked, count });
}
