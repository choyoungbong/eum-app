// src/app/api/posts/[id]/bookmark/route.ts
// POST — 북마크 토글

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

  const existing = await prisma.postBookmark.findUnique({
    where: { postId_userId: { postId: params.id, userId: session.user.id } },
  });

  if (existing) {
    await prisma.postBookmark.delete({ where: { id: existing.id } });
    return NextResponse.json({ bookmarked: false });
  } else {
    await prisma.postBookmark.create({ data: { postId: params.id, userId: session.user.id } });
    return NextResponse.json({ bookmarked: true });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ bookmarked: false });

  const bookmark = await prisma.postBookmark.findUnique({
    where: { postId_userId: { postId: params.id, userId: session.user.id } },
  });

  return NextResponse.json({ bookmarked: !!bookmark });
}
