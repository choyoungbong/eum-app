// src/app/api/notifications/preferences/route.ts
// ✅ 수정: 기존 notifications/route.ts 에 있던 설정 로직을 올바른 경로로 이동

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface NotificationPreferences {
  pushEnabled: boolean;
  comment: boolean;
  share: boolean;
  chat: boolean;
  system: boolean;
  fileUpload: boolean;
  marketing: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  comment:     true,
  share:       true,
  chat:        true,
  system:      true,
  fileUpload:  true,
  marketing:   false,
};

// ─── GET /api/notifications/preferences ──────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { notificationPrefs: true },
    });

    const rawData: any = user?.notificationPrefs;
    const prefs = rawData || DEFAULT_PREFS;

    return NextResponse.json({ prefs: { ...DEFAULT_PREFS, ...prefs } });
  } catch (error) {
    console.error("GET /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "설정을 불러오지 못했습니다" }, { status: 500 });
  }
}

// ─── POST /api/notifications/preferences ─────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { prefs } = body;

    await prisma.user.update({
      where: { id: session.user.id },
      data:  { notificationPrefs: prefs as any },
    });

    return NextResponse.json({ message: "알림 설정이 저장되었습니다" });
  } catch (error) {
    console.error("POST /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "설정 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
