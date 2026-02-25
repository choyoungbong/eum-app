// src/app/api/users/me/sessions/route.ts
// GET  — 내 활성 세션 목록
// DELETE — 특정 세션 또는 현재 외 모든 세션 로그아웃

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// GET — 세션 목록
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const sessions = await prisma.userSession.findMany({
    where: { userId: session.user.id },
    orderBy: { lastActive: "desc" },
    take: 20,
  });

  // 현재 세션 토큰 (쿠키에서)
  const currentToken = request.cookies.get("next-auth.session-token")?.value
    ?? request.cookies.get("__Secure-next-auth.session-token")?.value;

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      ...s,
      isCurrent: s.token === currentToken,
    })),
  });
}

// DELETE — 세션 종료
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { sessionId, revokeAll } = await request.json();

  if (revokeAll) {
    // 현재 세션 제외하고 전부 삭제
    const currentToken = request.cookies.get("next-auth.session-token")?.value
      ?? request.cookies.get("__Secure-next-auth.session-token")?.value;

    await prisma.userSession.deleteMany({
      where: {
        userId: session.user.id,
        token: currentToken ? { not: currentToken } : undefined,
      },
    });
    return NextResponse.json({ message: "다른 모든 기기에서 로그아웃되었습니다" });
  }

  if (sessionId) {
    const s = await prisma.userSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    });
    if (!s) return NextResponse.json({ error: "세션을 찾을 수 없습니다" }, { status: 404 });
    await prisma.userSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ message: "세션이 종료되었습니다" });
  }

  return NextResponse.json({ error: "sessionId 또는 revokeAll 필요" }, { status: 400 });
}
