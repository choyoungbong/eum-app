import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { portfolioId } = await req.json();

  const portfolio = await (db as any).portfolio.findFirst({
    where: { id: portfolioId, userId: session.user.id },
    include: { assets: true },
  });
  if (!portfolio) return new Response("Not found", { status: 404 });

  const assetList = portfolio.assets.map((a: any) =>
    `- ${a.name}(${a.symbol}) / ${a.assetType} / ${a.quantity}주 / 평균단가 ${a.avgPrice.toLocaleString()}`
  ).join("\n");

  const prompt = `당신은 전문 포트폴리오 매니저입니다.
아래 포트폴리오를 분석하고 리밸런싱 제안을 한국어로 작성하세요.

포트폴리오명: ${portfolio.name}
보유 종목:
${assetList}

다음 항목을 포함해 분석하세요:
## 📊 포트폴리오 분석

### 현재 구성 평가
- 자산 배분 및 섹터 편중 여부

### ⚖️ 리밸런싱 제안
- 비중 조절이 필요한 종목 (이유 포함)
- 추가 매수/매도 제안

### 🛡️ 리스크 관리
- 현재 포트폴리오의 주요 리스크
- 헤지 방안

### 💡 추가 분산 제안
- 현재 없는 섹터/자산군 추천

> AI 참고용 분석이며 투자 결정 책임은 본인에게 있습니다.`;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type==="content_block_delta"&&chunk.delta.type==="text_delta") {
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
