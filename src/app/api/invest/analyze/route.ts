import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { symbol, name, price, changeRate, assetType, extra } = await req.json();

  const typeLabel =
    assetType === "STOCK_KR" ? "한국 주식" :
    assetType === "STOCK_US" ? "미국 주식" : "암호화폐";

  const prompt = `당신은 전문 투자 분석가입니다. 아래 종목에 대해 간결하고 명확한 분석 리포트를 한국어로 작성하세요.

종목 정보:
- 종류: ${typeLabel}
- 종목명: ${name}
- 심볼: ${symbol}
- 현재가: ${price}
- 등락률: ${changeRate > 0 ? "+" : ""}${changeRate}%
${extra ? `- 추가 정보: ${extra}` : ""}

다음 항목을 포함해 분석하세요:
1. **종목 개요** (2~3줄)
2. **현재 시황 해석** (등락률 기반)
3. **투자 포인트** (긍정 요인 2~3가지)
4. **리스크 요인** (주의 사항 2~3가지)
5. **단기 전망** (1~4주 관점)

마지막에 반드시 아래 면책 문구를 추가하세요:
> ⚠️ 본 분석은 AI가 생성한 참고용 정보이며, 투자 결정의 책임은 투자자 본인에게 있습니다.`;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
