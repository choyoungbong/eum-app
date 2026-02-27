// src/lib/request-logger.ts
// API route 요청/응답 로깅 + 슬로우 쿼리 감지 미들웨어

import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

const SLOW_THRESHOLD_MS = 1000; // 1초 이상은 경고

interface RequestLogMeta {
  method:     string;
  url:        string;
  status:     number;
  durationMs: number;
  userId?:    string;
  ip?:        string;
  userAgent?: string;
}

/**
 * API Route 핸들러를 감싸는 로깅 래퍼
 *
 * 사용법:
 * export const GET = withRequestLog(async (req) => {
 *   ...
 *   return NextResponse.json({ ... });
 * });
 */
export function withRequestLog<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const start  = Date.now();
    const method = req.method;
    const url    = req.nextUrl.pathname + req.nextUrl.search;
    const ip     = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const ua     = req.headers.get("user-agent") ?? "";

    let response: NextResponse;
    let status = 500;

    try {
      response = await handler(req, ...args);
      status   = response.status;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      logger.error("API 핸들러 예외", {
        method, url, durationMs, ip,
        error: err?.message,
        stack: err?.stack,
      });
      // 표준 에러 응답 반환
      return NextResponse.json(
        { success: false, error: "서버 오류가 발생했습니다", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    const durationMs = Date.now() - start;
    const meta: RequestLogMeta = { method, url, status, durationMs, ip, userAgent: ua };

    if (durationMs >= SLOW_THRESHOLD_MS) {
      logger.warn(`🐢 슬로우 응답 [${durationMs}ms]`, meta);
    } else if (status >= 500) {
      logger.error(`❌ 서버 에러 [${status}]`, meta);
    } else if (status >= 400) {
      logger.warn(`⚠️  클라이언트 에러 [${status}]`, meta);
    } else {
      logger.debug(`✅ ${method} ${url} [${status}] ${durationMs}ms`, meta);
    }

    return response;
  };
}

/**
 * 슬로우 DB 쿼리 감지용 Prisma 미들웨어
 * prisma/client.ts 또는 src/lib/db.ts에 추가
 *
 * prisma.$use(async (params, next) => {
 *   const before = Date.now();
 *   const result = await next(params);
 *   const after  = Date.now();
 *   const ms     = after - before;
 *   if (ms > 500) {
 *     logger.warn("🐢 슬로우 DB 쿼리", {
 *       model:  params.model,
 *       action: params.action,
 *       ms,
 *     });
 *   }
 *   return result;
 * });
 */
