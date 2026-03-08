import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo-mode";
// ✅ [UI/UX-2] 로컬 signupSchema 제거 → 공통 registerSchema 사용
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    if (DEMO_MODE) {
      return NextResponse.json(
        {
          error: "데모 모드에서는 회원가입이 불가능합니다.",
          demoAccount: "reviewer@appstore.com / Demo2024!Review",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    // ✅ [UI/UX-2] registerSchema는 validators.ts의 공통 passwordSchema를 사용
    // → register / reset-password / change-password 규칙이 항상 동일하게 유지됨
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "USER",
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "회원가입이 완료되었습니다", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}