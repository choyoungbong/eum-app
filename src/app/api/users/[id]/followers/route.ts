// src/app/api/users/[id]/followers/route.ts
// GET /api/users/[id]/followers?type=followers|following

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const type = new URL(request.url).searchParams.get("type") ?? "followers";

  const users =
    type === "followers"
      ? await prisma.follow.findMany({
          where: { followingId: params.id },
          include: { follower: { select: { id: true, name: true, email: true, isOnline: true } } },
          orderBy: { createdAt: "desc" },
        }).then((r) => r.map((f) => ({ ...f.follower, followedAt: f.createdAt })))
      : await prisma.follow.findMany({
          where: { followerId: params.id },
          include: { following: { select: { id: true, name: true, email: true, isOnline: true } } },
          orderBy: { createdAt: "desc" },
        }).then((r) => r.map((f) => ({ ...f.following, followedAt: f.createdAt })));

  return NextResponse.json({ users });
}
