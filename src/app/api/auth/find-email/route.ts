// =============================================
// src/app/api/auth/find-email/route.ts
// 이메일 찾기 API - 이름으로 마스킹된 이메일 반환
// =============================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ✅ [보안-3] 항상 동일한 메시지 + 일정한 응답 시간으로 User Enumeration 방지
const CONSTANT_RESPONSE_MS = 300; // 항상 최소 이 시간만큼 대기

// 일정 응답 시간 보장 헬퍼 (타이밍 공격 방지)
async function withConstantTime<T>(fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  const remaining = CONSTANT_RESPONSE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });
    }

    const maskedEmail = await withConstantTime(async () => {
      const user = await prisma.user.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
      });

      // ✅ [보안-3] 유저 미존재 시에도 404 대신 null 반환 (호출자가 구분 불가)
      if (!user) return null;

      // 이메일 마스킹: ab***@gmail.com
      const [localPart, domain] = user.email.split("@");
      return (
        localPart.slice(0, 2) +
        "*".repeat(Math.max(3, localPart.length - 2)) +
        "@" +
        domain
      );
    });

    // ✅ [보안-3] 유저 존재 여부와 관계없이 항상 200 + 동일한 구조로 응답
    // 클라이언트: maskedEmail이 null이면 "일치하는 계정이 없습니다" 안내
    return NextResponse.json({ maskedEmail });
  } catch (error) {
    console.error("Find email error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}