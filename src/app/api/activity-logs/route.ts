// src/app/api/activity-logs/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// GET /api/activity-logs?page=1&limit=30&action=FILE_UPLOAD
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "30"));
    const action = searchParams.get("action") ?? undefined;
    const skip   = (page - 1) * limit;

    const where: any = { userId: session.user.id };
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/activity-logs error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE /api/activity-logs — 내 로그 전체 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    await prisma.activityLog.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ message: "활동 로그를 모두 삭제했습니다" });
  } catch (error) {
    console.error("DELETE /api/activity-logs error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
