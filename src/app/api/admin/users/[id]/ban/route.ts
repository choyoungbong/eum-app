// src/app/api/admin/users/[id]/ban/route.ts
// POST — 사용자 정지 / DELETE — 정지 해제

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  if (params.id === session.user.id)
    return NextResponse.json({ error: "자신을 정지할 수 없습니다" }, { status: 400 });

  const { reason } = await request.json();

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { isBanned: true, banReason: reason ?? "관리자 결정", bannedAt: new Date() },
    select: { id: true, name: true, email: true, isBanned: true },
  });

  return NextResponse.json({ user, message: `${user.name}이 정지되었습니다` });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { isBanned: false, banReason: null, bannedAt: null },
    select: { id: true, name: true, isBanned: true },
  });

  return NextResponse.json({ user, message: `${user.name}의 정지가 해제되었습니다` });
}
