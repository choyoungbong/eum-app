// src/app/api/notifications/preferences/route.ts
// 알림 설정을 User.fcmToken 옆 별도 컬럼 대신 간단히 key-value로 관리
// DB 컬럼 추가 없이 즉시 동작: preferences는 localStorage에서 관리하고
// 서버는 GET(현재 설정 조회) / PATCH(설정 저장) 역할

// ⚠️ 이 방식은 prisma schema에 notificationPrefs Json? 컬럼을 추가하거나
//    아래처럼 별도 테이블 없이 User 업데이트로 처리합니다.
//    현재는 schema에 notificationPrefs 필드를 추가하는 방식 사용.
//
// schema.prisma User 모델에 아래 한 줄 추가 필요:
//   notificationPrefs Json? @map("notification_prefs")
// 추가 후: npx prisma db push

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export interface NotificationPreferences {
  pushEnabled: boolean;    // 브라우저 푸시 전체
  comment: boolean;        // 내 게시글에 댓글
  share: boolean;          // 파일/폴더 공유받음
  chat: boolean;           // 채팅 메시지
  call: boolean;           // 통화 요청
  system: boolean;         // 시스템 공지
  fileUpload: boolean;     // 파일 업로드 완료
  emailDigest: boolean;    // 이메일 주간 요약 (미구현 placeholder)
}

export const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  comment:     true,
  share:       true,
  chat:        true,
  call:        true,
  system:      true,
  fileUpload:  false,
  emailDigest: false,
};

// GET /api/notifications/preferences
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

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

// PATCH /api/notifications/preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();

    // 허용된 키만 저장
    const allowed = Object.keys(DEFAULT_PREFS) as (keyof NotificationPreferences)[];
    const prefs: Partial<NotificationPreferences> = {};
    for (const key of allowed) {
      if (typeof body[key] === "boolean") {
        prefs[key] = body[key];
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationPrefs: prefs },
    });

    return NextResponse.json({ prefs: { ...DEFAULT_PREFS, ...prefs } });
  } catch (error) {
    console.error("PATCH /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
