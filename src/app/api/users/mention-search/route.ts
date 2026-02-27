// src/app/api/users/mention-search/route.ts
// GET /api/users/mention-search?q=검색어&limit=5
// @멘션 자동완성용 빠른 사용자 검색

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { withCache, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ users: [] });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ users: [] });

  const users = await withCache(
    `mention-search:${q.toLowerCase()}`,
    () => prisma.user.findMany({
      where: {
        id:   { not: session.user.id },
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, isOnline: true },
      take:   6,
      orderBy: [{ isOnline: "desc" }, { name: "asc" }],
    }),
    TTL.SHORT
  );

  return NextResponse.json({ users });
}
