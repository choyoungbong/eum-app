import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "이메일을 입력하세요" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // 보안: 사용자 존재 여부 노출 안 함
    if (!user) {
      return NextResponse.json({ message: "이메일이 발송되었습니다" });
    }

    // 토큰 생성 (15분 유효)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Prisma ORM으로 토큰 저장 (upsert)
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      update: { token, expiresAt },
      create: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/confirm?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "[이음] 비밀번호 재설정 안내",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">이음 (Eum)</h2>
          <p style="color: #666; margin-bottom: 24px;">사람과 파일을 잇다</p>
          <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;"/>
          <h3 style="color: #111; margin-bottom: 16px;">비밀번호 재설정</h3>
          <p style="color: #444; margin-bottom: 8px;">안녕하세요, <strong>${user.name}</strong>님!</p>
          <p style="color: #444; margin-bottom: 24px;">
            비밀번호 재설정을 요청하셨습니다.<br/>
            아래 버튼을 클릭해 새 비밀번호를 설정해주세요.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetUrl}"
              style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">
              비밀번호 재설정하기
            </a>
          </div>
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">
              ⏰ 이 링크는 <strong>15분</strong> 후 만료됩니다.
            </p>
          </div>
          <p style="color: #888; font-size: 13px;">
            본인이 요청하지 않으셨다면 이 메일을 무시해 주세요.<br/>
            비밀번호는 변경되지 않습니다.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
          <p style="color: #aaa; font-size: 12px;">© 2025 이음(Eum)</p>
        </div>
      `,
    });

    return NextResponse.json({ message: "이메일이 발송되었습니다" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다" }, { status: 500 });
  }
}
