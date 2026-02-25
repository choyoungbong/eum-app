// src/app/api/auth/2fa/disable/route.ts
// DELETE → 2FA 비활성화 (현재 OTP 코드 또는 백업 코드 확인 후)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { code } = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true, twoFactorBackups: true },
    });

    if (!user?.twoFactorEnabled) {
      return NextResponse.json({ error: "2단계 인증이 활성화되어 있지 않습니다" }, { status: 400 });
    }

    // TOTP 또는 백업 코드 검증
    let valid = false;

    if (user.twoFactorSecret) {
      const totp = new OTPAuth.TOTP({
        algorithm: "SHA1", digits: 6, period: 30,
        secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
      });
      valid = totp.validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null;
    }

    // 백업 코드 확인
    if (!valid && user.twoFactorBackups?.includes(code.toUpperCase())) {
      valid = true;
    }

    if (!valid) {
      return NextResponse.json({ error: "코드가 올바르지 않습니다" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackups: [],
      },
    });

    return NextResponse.json({ message: "2단계 인증이 비활성화되었습니다" });
  } catch (error) {
    console.error("DELETE /api/auth/2fa/disable error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
