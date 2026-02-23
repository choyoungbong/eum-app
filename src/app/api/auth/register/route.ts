import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs"; // ✅ bcrypt → bcryptjs
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo-mode";

const signupSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
  marketingConsent: z.boolean().optional(),
});

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
    const validation = signupSchema.safeParse(body);

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
