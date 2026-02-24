// src/app/api/auth/verify-email/route.ts
// 이메일 인증 재발송 + 토큰 검증 API

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

// POST /api/auth/verify-email — 인증 이메일 발송 (로그인 상태)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: "이미 인증된 이메일입니다" }, { status: 400 });
    }

    // 기존 토큰 삭제 후 새 토큰 생성
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email/confirm?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "[이음] 이메일 인증을 완료해주세요",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1e293b; margin-bottom: 8px;">이음 이메일 인증</h1>
          <p style="color: #475569; margin-bottom: 24px;">
            안녕하세요, <strong>${user.name}</strong>님!<br/>
            아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
          </p>
          <a href="${verifyUrl}"
             style="display: inline-block; background: #2563eb; color: white;
                    padding: 12px 28px; border-radius: 8px; text-decoration: none;
                    font-weight: bold; font-size: 15px;">
            이메일 인증하기
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            이 링크는 24시간 후 만료됩니다.<br/>
            본인이 요청하지 않았다면 이 이메일을 무시해주세요.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ message: "인증 이메일을 발송했습니다" });
  } catch (error) {
    console.error("POST /api/auth/verify-email error:", error);
    return NextResponse.json({ error: "이메일 발송 중 오류가 발생했습니다" }, { status: 500 });
  }
}
