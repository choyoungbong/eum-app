// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

async function requireAdmin(selfId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// PATCH /api/admin/users/[id] — 역할 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  const admin = await requireAdmin(session.user.id);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  const { role } = await request.json();
  if (!["USER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "올바르지 않은 역할입니다" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { role },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/users/[id] — 계정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  const admin = await requireAdmin(session.user.id);
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  // 자신 삭제 방지
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "자신의 계정은 삭제할 수 없습니다" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "계정을 삭제했습니다" });
}
