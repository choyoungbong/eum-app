import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_MODE, isDemoUser } from "@/lib/demo-mode";

// 입력 검증 스키마
const signupSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
});

export async function POST(request: NextRequest) {
  try {
    // 데모 모드에서는 회원가입 차단
    if (DEMO_MODE) {
      return NextResponse.json(
        { 
          error: "데모 모드에서는 회원가입이 불가능합니다. 데모 계정을 사용해주세요.",
          demoAccount: "reviewer@appstore.com / Demo2024!Review"
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // 입력값 검증
    const validation = signupSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다" },
        { status: 409 }
      );
    }

    // 비밀번호 해싱
    const passwordHash = await hash(password, 12);

    // 사용자 생성
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
      }
    });

    return NextResponse.json(
      { 
        message: "회원가입이 완료되었습니다",
        user 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}