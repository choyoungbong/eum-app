// ══════════════════════════════════════════════════════════
// src/app/api/admin/notices/route.ts — 시스템 공지 CRUD
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// GET — 활성 공지 (모든 사용자 접근 가능)
export async function GET() {
  const notices = await prisma.systemNotice.findMany({
    where: {
      isActive: true,
      OR: [
        { endsAt: null },
        { endsAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({ notices });
}

// POST — 공지 생성 (관리자 전용)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  const { title, content, type = "INFO", startsAt, endsAt } = await request.json();
  if (!title?.trim() || !content?.trim())
    return NextResponse.json({ error: "제목과 내용이 필요합니다" }, { status: 400 });

  const notice = await prisma.systemNotice.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      type,
      createdBy: session.user.id,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt:   endsAt   ? new Date(endsAt)   : null,
    },
  });

  return NextResponse.json({ notice, message: "공지가 등록되었습니다" });
}
