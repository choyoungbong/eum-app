// src/app/api/posts/bookmarks/route.ts
// GET — 내 북마크 목록

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const bookmarks = await prisma.postBookmark.findMany({
    where: { userId: session.user.id },
    include: {
      post: {
        select: {
          id: true, title: true, content: true, createdAt: true,
          user: { select: { id: true, name: true } },
          _count: { select: { comments: true, likes: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    posts: bookmarks.map((b) => ({ ...b.post, bookmarkedAt: b.createdAt })),
  });
}
