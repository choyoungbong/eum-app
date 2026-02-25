// src/app/api/users/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;

  if (q.length < 1) return NextResponse.json({ users: [], total: 0 });

  const where = {
    OR: [
      { name:  { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
    id: { not: session.user.id },
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true,
        role: true, isOnline: true, createdAt: true,
        _count: { select: { files: true, posts: true } },
        followers: { where: { followerId: session.user.id }, select: { id: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isOnline: "desc" }, { name: "asc" }],
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({ ...u, isFollowing: u.followers.length > 0, followers: undefined })),
    total,
    totalPages: Math.ceil(total / limit),
  });
}
