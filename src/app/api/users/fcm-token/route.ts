import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_TOKENS_PER_USER = 5; // 디바이스 최대 등록 수

// FCM 토큰 등록
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { fcmToken, deviceId, userAgent } = body;

    if (!fcmToken) {
      return NextResponse.json({ error: "FCM 토큰을 제공하세요" }, { status: 400 });
    }

    // ✅ upsert — 같은 토큰이면 updatedAt만 갱신, 없으면 새로 생성
    await prisma.userFcmToken.upsert({
      where: { token: fcmToken },
      update: {
        userId: session.user.id, // 다른 유저가 같은 기기 로그인 시 소유권 이전
        deviceId: deviceId ?? null,
        userAgent: userAgent ?? null,
      },
      create: {
        userId: session.user.id,
        token: fcmToken,
        deviceId: deviceId ?? null,
        userAgent: userAgent ?? null,
      },
    });

    // ✅ 오래된 토큰 정리 — 유저당 최대 5개 유지
    const allTokens = await prisma.userFcmToken.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (allTokens.length > MAX_TOKENS_PER_USER) {
      const idsToDelete = allTokens
        .slice(MAX_TOKENS_PER_USER)
        .map((t) => t.id);

      await prisma.userFcmToken.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    return NextResponse.json({ message: "FCM 토큰이 등록되었습니다" });
  } catch (error) {
    console.error("FCM token registration error:", error);
    return NextResponse.json(
      { error: "토큰 등록 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// FCM 토큰 삭제 (로그아웃 시 — 현재 기기 토큰만 삭제)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { fcmToken } = body;

    if (fcmToken) {
      // ✅ 특정 토큰만 삭제 (현재 기기 로그아웃)
      await prisma.userFcmToken.deleteMany({
        where: { userId: session.user.id, token: fcmToken },
      });
    } else {
      // ✅ 토큰 없이 요청 시 — 해당 유저 전체 토큰 삭제 (전체 로그아웃)
      await prisma.userFcmToken.deleteMany({
        where: { userId: session.user.id },
      });
    }

    return NextResponse.json({ message: "FCM 토큰이 삭제되었습니다" });
  } catch (error) {
    console.error("FCM token deletion error:", error);
    return NextResponse.json(
      { error: "토큰 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
