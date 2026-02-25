// src/app/api/users/[id]/follow/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// POST /api/users/[id]/follow — 팔로우
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "자신을 팔로우할 수 없습니다" }, { status: 400 });
  }

  try {
    await prisma.follow.create({
      data: { followerId: session.user.id, followingId: params.id },
    });

    // 팔로우 알림 생성 (notification.ts 유틸 사용)
    try {
      await prisma.notification.create({
        data: {
          userId: params.id,
          type: "SYSTEM",
          title: `${session.user.name}님이 팔로우했습니다`,
          link: `/users/${session.user.id}`,
        },
      });
    } catch {} // 알림 실패는 무시

    return NextResponse.json({ following: true });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "이미 팔로우 중입니다" }, { status: 409 });
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE /api/users/[id]/follow — 언팔로우
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followingId: params.id },
  });

  return NextResponse.json({ following: false });
}

// GET /api/users/[id]/follow — 팔로우 여부 + 카운트
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  const [followerCount, followingCount, isFollowing] = await Promise.all([
    prisma.follow.count({ where: { followingId: params.id } }),
    prisma.follow.count({ where: { followerId: params.id } }),
    session?.user
      ? prisma.follow.findFirst({
          where: { followerId: session.user.id, followingId: params.id },
        })
      : null,
  ]);

  return NextResponse.json({
    followerCount,
    followingCount,
    isFollowing: !!isFollowing,
  });
}
