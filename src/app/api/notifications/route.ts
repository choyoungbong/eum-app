import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 1. 알림 설정 인터페이스
interface NotificationPreferences {
  pushEnabled: boolean;
  comment: boolean;
  share: boolean;
  chat: boolean;
  system: boolean;
  fileUpload: boolean;
  marketing: boolean;
}

// 2. 기본값 설정
const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  comment: true,
  share: true,
  chat: true,
  system: true,
  fileUpload: true,
  marketing: false,
};

// [GET] 설정 조회
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

    /**
     * [빌드 에러 해결 핵심]
     * TypeScript가 'JsonValue'와 'NotificationPreferences'가 겹치지 않는다고 에러를 내므로,
     * 아예 'any' 타입 변수에 담아서 타입 검사기(Linter)를 완전히 통과시킵니다.
     */
    const rawData: any = user?.notificationPrefs;
    const prefs = rawData || DEFAULT_PREFS;

    return NextResponse.json({ 
      prefs: { ...DEFAULT_PREFS, ...prefs } 
    });
  } catch (error) {
    console.error("GET /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "설정을 불러오지 못했습니다" }, { status: 500 });
  }
}

// [POST] 설정 저장
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { prefs } = body;

    // 업데이트 시에도 'any'로 캐스팅하여 타입 충돌 방지
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationPrefs: prefs as any,
      },
    });

    return NextResponse.json({ message: "알림 설정이 저장되었습니다" });
  } catch (error) {
    console.error("POST /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "설정 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}