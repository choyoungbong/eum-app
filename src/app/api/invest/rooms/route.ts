import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const PRESET_ROOMS = [
  { name: "AI 코스피 리딩방",  type: "AI_SIGNAL",  category: "KOSPI",  description: "코스피 AI 매매 신호 및 종목 분석" },
  { name: "AI 코스닥 리딩방",  type: "AI_SIGNAL",  category: "KOSDAQ", description: "코스닥 AI 매매 신호 및 종목 분석" },
  { name: "AI 나스닥 리딩방",  type: "AI_SIGNAL",  category: "NASDAQ", description: "나스닥 AI 매매 신호 및 종목 분석" },
  { name: "AI 코인 리딩방",    type: "AI_SIGNAL",  category: "CRYPTO", description: "암호화폐 AI 매매 신호 및 분석" },
  { name: "자유 투자 토론방",  type: "COMMUNITY",  category: "FREE",   description: "자유로운 투자 의견 공유" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 프리셋 방이 없으면 자동 생성
  for (const preset of PRESET_ROOMS) {
    await db.chatRoom.upsert({
      where: { name: preset.name },
      create: {
        name: preset.name,
        type: preset.type as any,
        metadata: JSON.stringify({ category: preset.category, description: preset.description }),
      },
      update: {},
    });
  }

  const rooms = await db.chatRoom.findMany({
    where: {
      type: { in: ["AI_SIGNAL", "COMMUNITY"] as any[] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, type: true, metadata: true, createdAt: true,
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, user: { select: { name: true } } },
      },
    },
  });

  const parsed = rooms.map((r) => ({
    ...r,
    meta: (() => { try { return JSON.parse(r.metadata ?? "{}"); } catch { return {}; } })(),
  }));

  return NextResponse.json({ rooms: parsed });
}
