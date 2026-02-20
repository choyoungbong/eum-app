import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_MODE } from "@/lib/demo-mode";

// 💡 입력 검증 스키마 수정 (marketingConsent 추가)
const signupSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
  marketingConsent: z.boolean().optional(), // 프론트에서 보내는 필드 추가
});

export async function POST(request: NextRequest) {
  try {
    // 1. 데모 모드 체크
    if (DEMO_MODE) {
      return NextResponse.json(
        { 
          error: "데모 모드에서는 회원가입이 불가능합니다.",
          demoAccount: "reviewer@appstore.com / Demo2024!Review"
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // 2. 입력값 검증 (Zod)
    const validation = signupSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 } // 여기서 400 에러가 발생했던 것입니다.
      );
    }

    const { email, password, name, marketingConsent } = validation.data;

    // 3. 이메일 중복 체크
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다" },
        { status: 409 }
      );
    }

    // 4. 비밀번호 해싱
    const passwordHash = await hash(password, 12);

    // 5. 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "USER",
        emailVerified: false,
        // DB 스키마(schema.prisma)에 marketing_consent 필드가 있다면 추가하세요.
        // 없다면 이 줄은 삭제해도 무방합니다.
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