import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const base = process.env.NEXT_PUBLIC_APP_URL!;
  const [stocks, crypto, forex, fg] = await Promise.allSettled([
    fetch(`${base}/api/invest/stocks`).then(r=>r.json()),
    fetch(`${base}/api/invest/crypto`).then(r=>r.json()),
    fetch(`${base}/api/invest/forex`).then(r=>r.json()),
    fetch(`${base}/api/invest/fear-greed`).then(r=>r.json()),
  ]);

  const topStocks = stocks.status==="fulfilled"
    ? (stocks.value.stocks??[]).slice(0,5).map((s:any)=>`${s.name} ${s.changeRate>0?"+":""}${s.changeRate?.toFixed(2)}%`).join(", ") : "조회 실패";
  const topCoins  = crypto.status==="fulfilled"
    ? (crypto.value.coins??[]).slice(0,3).map((c:any)=>`${c.name} ${c.changeRate>0?"+":""}${c.changeRate?.toFixed(2)}%`).join(", ") : "조회 실패";
  const usd = forex.status==="fulfilled"
    ? (forex.value.forex??[]).find((f:any)=>f.base==="USD")?.price?.toLocaleString() : "조회 실패";
  const fgVal = fg.status==="fulfilled" ? `${fg.value.current?.value} (${fg.value.current?.labelKo})` : "조회 실패";

  const today = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"});

  const prompt = `당신은 전문 투자 애널리스트입니다. 아래 시장 데이터를 바탕으로 오늘의 투자 브리핑을 한국어로 작성하세요.

📅 날짜: ${today}
📊 코스피 주요 종목: ${topStocks}
🪙 암호화폐: ${topCoins}
💱 환율 (USD/KRW): ${usd}원
😨 공포탐욕지수: ${fgVal}

다음 형식으로 작성하세요:
## 📊 오늘의 시장 브리핑

### 🌍 글로벌 시황 요약 (2~3줄)

### 🇰🇷 국내 증시 포인트
- 주요 종목 흐름 분석 (2~3가지)

### 🪙 암호화폐 시장
- 시황 및 주목 포인트

### 💡 오늘의 투자 전략 (3가지)
1.
2.
3.

### ⚠️ 주요 리스크 요인

> 본 브리핑은 AI 참고용이며 투자 결정의 책임은 본인에게 있습니다.`;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type==="content_block_delta" && chunk.delta.type==="text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
