import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: "유효하지 않은 요청입니다" }, { status: 400 });
    }

    if (password.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return NextResponse.json(
        { error: "비밀번호는 8자 이상, 영문+숫자 조합이어야 합니다" },
        { status: 400 }
      );
    }

    // Prisma ORM으로 토큰 조회
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "링크가 만료됐거나 유효하지 않습니다. 다시 요청해주세요." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: hashedPassword },
    });

    // 토큰 삭제
    await prisma.passwordResetToken.delete({
      where: { token },
    });

    return NextResponse.json({ message: "비밀번호가 변경되었습니다" });
  } catch (error) {
    console.error("Confirm reset error:", error);
    return NextResponse.json({ error: "오류가 발생했습니다" }, { status: 500 });
  }
}
