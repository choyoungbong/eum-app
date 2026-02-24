// src/app/api/auth/verify-email/confirm/route.ts
// 이메일 인증 링크 클릭 시 호출되는 엔드포인트

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/profile?verified=error&reason=missing_token", request.url)
    );
  }

  try {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      return NextResponse.redirect(
        new URL("/profile?verified=error&reason=invalid_token", request.url)
      );
    }

    if (new Date() > record.expiresAt) {
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
      return NextResponse.redirect(
        new URL("/profile?verified=error&reason=expired", request.url)
      );
    }

    // 이메일 인증 완료
    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    // 토큰 삭제
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });

    return NextResponse.redirect(
      new URL("/profile?verified=success", request.url)
    );
  } catch (error) {
    console.error("GET /api/auth/verify-email/confirm error:", error);
    return NextResponse.redirect(
      new URL("/profile?verified=error&reason=server_error", request.url)
    );
  }
}
