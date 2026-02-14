// =============================================
// src/app/api/auth/find-email/route.ts
// 이메일 찾기 API - 이름으로 마스킹된 이메일 반환
// =============================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
      return NextResponse.json(
        { error: "해당 이름으로 가입된 계정을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 이메일 마스킹: ab***@gmail.com
    const [localPart, domain] = user.email.split("@");
    const masked =
      localPart.slice(0, 2) + "*".repeat(Math.max(3, localPart.length - 2)) + "@" + domain;

    return NextResponse.json({ maskedEmail: masked });
  } catch (error) {
    console.error("Find email error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
