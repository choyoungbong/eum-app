// src/app/api/notifications/preferences/route.ts
// ⚠️ 수정: export const/interface → @/lib/notification-prefs 로 분리

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { NotificationPreferences, DEFAULT_PREFS } from "@/lib/notification-prefs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true },
    });

    const prefs = (user?.notificationPrefs as NotificationPreferences | null) ?? DEFAULT_PREFS;
    return NextResponse.json({ prefs: { ...DEFAULT_PREFS, ...prefs } });
  } catch (error) {
    console.error("GET /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

    const body = await request.json();
    const allowed = Object.keys(DEFAULT_PREFS) as (keyof NotificationPreferences)[];
    const prefs: Partial<NotificationPreferences> = {};
    for (const key of allowed) {
      if (typeof body[key] === "boolean") prefs[key] = body[key];
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data:  { notificationPrefs: prefs },
    });

    return NextResponse.json({ prefs: { ...DEFAULT_PREFS, ...prefs } });
  } catch (error) {
    console.error("PATCH /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
