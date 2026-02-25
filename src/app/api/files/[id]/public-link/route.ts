// src/app/api/files/[id]/public-link/route.ts
// POST → 공개 공유 링크 생성 (토큰 발급)
// DELETE → 공개 링크 비활성화

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import crypto from "crypto";

// POST — 공개 링크 생성
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findUnique({ where: { id: params.id } });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  if (file.userId !== session.user.id)
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  // 이미 토큰 있으면 재사용, 없으면 새로 발급
  const token = file.publicToken ?? crypto.randomBytes(24).toString("hex");

  await prisma.file.update({
    where: { id: params.id },
    data: { publicToken: token },
  });

  const link = `${process.env.NEXTAUTH_URL}/share/${token}`;
  return NextResponse.json({ token, link });
}

// DELETE — 공개 링크 비활성화
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const file = await prisma.file.findUnique({ where: { id: params.id } });
  if (!file || file.userId !== session.user.id)
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  await prisma.file.update({ where: { id: params.id }, data: { publicToken: null } });
  return NextResponse.json({ message: "공개 링크가 비활성화되었습니다" });
}
