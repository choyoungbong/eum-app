// src/app/api/health/route.ts
// Docker HEALTHCHECK + 로드밸런서 상태 확인용

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  // DB 연결 확인
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}

  const latencyMs = Date.now() - start;
  const status    = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status:    dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime:    process.uptime(),
      latencyMs,
      checks: {
        database: dbOk ? "ok" : "error",
        memory: {
          heapUsed:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: "MB",
        },
      },
    },
    { status }
  );
}
