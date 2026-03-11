import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId, marketType } = await req.json();

  const endpoints: Record<string, string> = {
    KOSPI:  "/api/invest/stocks",
    NASDAQ: "/api/invest/us-stocks",
    CRYPTO: "/api/invest/crypto",
  };
  const ep  = endpoints[marketType] ?? endpoints.KOSPI;
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${ep}`);
  const mktData = await res.json();

  const items = mktData.stocks ?? mktData.coins ?? [];
  const top5  = items.slice(0, 5).map((s: any) =>
    `- ${s.name} (${s.symbol}): ${s.price?.toLocaleString()} / ${s.changeRate > 0 ? "+" : ""}${s.changeRate?.toFixed(2)}%`
  ).join("\n");

  const prompt = `당신은 전문 투자 시그널 트레이더입니다.
현재 ${marketType} 시장 현황:
${top5}

위 시황을 바탕으로 아래 형식으로 간결한 AI 시그널 메시지를 작성하세요 (한국어, 150자 이내):
- 📊 시황 요약 1줄
- 🎯 주목 종목 1~2개 + 이유
- ⚡ 단기 전략 제안 1줄
- ⚠️ AI 참고용 메시지임을 1줄로 명시`;

  const aiResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (aiResponse.content[0] as { type: string; text: string }).text;

  // 리딩방에 AI 봇 메시지 저장
  const botMessage = await db.chatMessage.create({
    data: {
      content:    `🤖 AI 시그널\n\n${text}`,
      chatRoomId: roomId,
      senderId:   session.user.id,
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ message: botMessage, signal: text });
}