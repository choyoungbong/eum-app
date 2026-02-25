// src/app/api/auth/2fa/setup/route.ts
// POST → 비밀키 생성 + QR코드 반환 (아직 활성화 안 됨)
// PATCH → OTP 검증 후 2FA 최종 활성화 + 백업 코드 발급

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";

// 백업 코드 8개 생성
function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

// POST /api/auth/2fa/setup — 비밀키 + QR코드 생성
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, twoFactorEnabled: true },
    });

    if (user?.twoFactorEnabled) {
      return NextResponse.json({ error: "이미 2단계 인증이 활성화되어 있습니다" }, { status: 400 });
    }

    // TOTP 비밀키 생성
    const secret = new OTPAuth.Secret();
    const totp = new OTPAuth.TOTP({
      issuer: "이음 (Eum)",
      label: user?.email ?? session.user.email ?? "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // 임시로 비밀키 저장 (아직 활성화 안 됨)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      manualKey: secret.base32.match(/.{1,4}/g)?.join(" "), // 가독성 좋게 4자리씩 분리
    });
  } catch (error) {
    console.error("POST /api/auth/2fa/setup error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH /api/auth/2fa/setup — OTP 검증 후 활성화
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "OTP 코드가 필요합니다" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorSecret) {
      return NextResponse.json({ error: "먼저 QR코드를 생성해주세요" }, { status: 400 });
    }

    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
    if (delta === null) {
      return NextResponse.json({ error: "OTP 코드가 올바르지 않습니다" }, { status: 400 });
    }

    const backupCodes = generateBackupCodes();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackups: backupCodes,
      },
    });

    return NextResponse.json({
      message: "2단계 인증이 활성화되었습니다",
      backupCodes,
    });
  } catch (error) {
    console.error("PATCH /api/auth/2fa/setup error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
