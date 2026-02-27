// src/app/api/errors/report/route.ts
// 클라이언트 에러 수신 및 서버 로깅

import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";
import { withRequestLog } from "@/lib/request-logger";

interface ErrorReport {
  message: string;
  stack?:  string;
  context?: object;
  url?:    string;
  ua?:     string;
  ts?:     string;
}

export const POST = withRequestLog(async (request: NextRequest) => {
  let body: ErrorReport;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // 파싱 실패해도 204
  }

  logger.error("[Client Error]", {
    message: body.message?.slice(0, 500),
    stack:   body.stack?.slice(0, 2000),
    url:     body.url,
    ua:      body.ua?.slice(0, 200),
    ts:      body.ts,
    context: body.context,
    ip:      request.headers.get("x-forwarded-for") ?? "unknown",
  });

  return NextResponse.json({ ok: true });
});
