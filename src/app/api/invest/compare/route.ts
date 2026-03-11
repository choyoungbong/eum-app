import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { a, b } = await req.json();
  // a, b: { symbol, name, price, changeRate, assetType }

  const prompt = `당신은 전문 투자 분석가입니다. 아래 두 종목을 비교 분석하세요.

종목 A: ${a.name}(${a.symbol}) — 현재가 ${a.price?.toLocaleString()} / ${a.changeRate>0?"+":""}${a.changeRate?.toFixed(2)}%
종목 B: ${b.name}(${b.symbol}) — 현재가 ${b.price?.toLocaleString()} / ${b.changeRate>0?"+":""}${b.changeRate?.toFixed(2)}%

다음 형식으로 비교하세요:

## ⚔️ ${a.name} vs ${b.name}

### 📌 종목 개요 비교

| 항목 | ${a.name} | ${b.name} |
|---|---|---|
| 현재 흐름 | | |
| 업종/섹터 | | |
| 리스크 수준 | | |

### 💪 각 종목의 강점

**${a.name}**
- 강점 2~3가지

**${b.name}**
- 강점 2~3가지

### ⚠️ 각 종목의 주의점

### 🏆 투자 관점 비교 결론
- 단기(1개월 이내) 관점에서는?
- 장기(6개월~1년) 관점에서는?
- 어떤 투자 성향에 적합한가?

> AI 참고용 분석이며 투자 결정 책임은 본인에게 있습니다.`;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type==="content_block_delta"&&chunk.delta.type==="text_delta")
          controller.enqueue(encoder.encode(chunk.delta.text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
