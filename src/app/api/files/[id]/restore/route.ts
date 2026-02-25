// src/app/api/files/[id]/restore/route.ts
// POST — 휴지통에서 복구

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

  const file = await prisma.file.findUnique({ where: { id: params.id } });
  if (!file || file.userId !== session.user.id)
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  if (!file.deletedAt)
    return NextResponse.json({ error: "휴지통에 있는 파일이 아닙니다" }, { status: 400 });

  await prisma.file.update({
    where: { id: params.id },
    data: { deletedAt: null },
  });

  return NextResponse.json({ message: "파일이 복구되었습니다" });
}
