// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── GET /api/notifications ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page       = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit      = Math.min(100, parseInt(searchParams.get("limit") || "30")); // ✅ 최대 100 제한
    const onlyUnread = searchParams.get("unread") === "true";
    const skip       = (page - 1) * limit;

    // ✅ 수정: where 타입을 any 대신 Prisma 타입으로
    const where: Prisma.NotificationWhereInput = { userId: session.user.id };
    if (onlyUnread) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "알림을 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/notifications ─────────────────────────────
// body 없음 → 전체 읽음 처리
// body { ids: string[] } → 선택한 알림만 읽음 처리
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    // ✅ 추가: 특정 id 배열이 오면 해당 알림만 읽음 처리
    let ids: string[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.ids) && body.ids.length > 0) ids = body.ids;
    } catch {
      // body 없는 요청도 허용
    }

    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id,
      isRead: false,
      ...(ids ? { id: { in: ids } } : {}),
    };

    const { count } = await prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    return NextResponse.json({
      message: `${count}개의 알림을 읽음 처리했습니다`,
      count,
    });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}

// ─── DELETE /api/notifications ────────────────────────────
// body 없음 → 전체 삭제
// body { ids: string[] } → 선택한 알림만 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    // ✅ 추가: 특정 id 배열이 오면 해당 알림만 삭제
    let ids: string[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.ids) && body.ids.length > 0) ids = body.ids;
    } catch {
      // body 없는 요청도 허용
    }

    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id,
      ...(ids ? { id: { in: ids } } : {}),
    };

    const { count } = await prisma.notification.deleteMany({ where });

    return NextResponse.json({
      message: `${count}개의 알림을 삭제했습니다`,
      count,
    });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
