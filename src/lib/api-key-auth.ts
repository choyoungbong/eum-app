// src/lib/api-key-auth.ts
// 외부 API 요청 시 Bearer API 키 검증 미들웨어

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

interface AuthResult {
  ok: boolean;
  userId?: string;
  scopes?: string[];
  error?: string;
}

export async function verifyApiKey(
  request: NextRequest,
  requiredScopes: string[] = []
): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer eum_"))
    return { ok: false, error: "API 키가 필요합니다" };

  const rawKey = authHeader.slice(7); // "Bearer " 제거
  const prefix = rawKey.slice(0, 12);

  // prefix로 후보 키 조회 (DB 풀스캔 방지)
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix },
  });

  for (const key of candidates) {
    const match = await bcrypt.compare(rawKey, key.keyHash);
    if (!match) continue;

    // 만료 확인
    if (key.expiresAt && key.expiresAt < new Date())
      return { ok: false, error: "만료된 API 키입니다" };

    // 스코프 확인
    for (const scope of requiredScopes) {
      if (!key.scopes.includes(scope))
        return { ok: false, error: `'${scope}' 권한이 없습니다` };
    }

    // 마지막 사용 시각 업데이트 (비동기, 응답 대기 안 함)
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { ok: true, userId: key.userId, scopes: key.scopes };
  }

  return { ok: false, error: "유효하지 않은 API 키입니다" };
}
