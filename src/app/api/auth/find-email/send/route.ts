import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });

    if (!user) {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
    }

    await sendEmail({
      to: user.email,
      subject: "[이음] 이메일 찾기 안내",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">이음 (Eum)</h2>
          <p style="color: #666; margin-bottom: 24px;">사람과 파일을 잇다</p>
          <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;"/>
          <h3 style="color: #111; margin-bottom: 16px;">이메일 찾기</h3>
          <p style="color: #444; margin-bottom: 8px;">안녕하세요, <strong>${user.name}</strong>님!</p>
          <p style="color: #444; margin-bottom: 24px;">
            요청하신 이음 계정의 이메일 주소입니다:
          </p>
          <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 20px; font-weight: 700; color: #7c3aed; margin: 0;">${user.email}</p>
          </div>
          <p style="color: #888; font-size: 13px;">
            본인이 요청하지 않으셨다면 이 메일을 무시해 주세요.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
          <p style="color: #aaa; font-size: 12px;">© 2025 이음(Eum)</p>
        </div>
      `,
    });

    return NextResponse.json({ message: "이메일이 발송되었습니다" });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json({ error: "이메일 발송 실패" }, { status: 500 });
  }
}