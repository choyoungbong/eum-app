// src/app/api/users/me/onboarding/route.ts
// POST — 온보딩 완료 기록 (DB에 저장)
// GET  — 온보딩 완료 여부 확인

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingDone: true },
  });

  return NextResponse.json({ message: "온보딩 완료" });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ onboardingDone: false });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingDone: true },
  });

  return NextResponse.json({ onboardingDone: user?.onboardingDone ?? false });
}
