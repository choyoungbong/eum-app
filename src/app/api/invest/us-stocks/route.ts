import { NextResponse } from "next/server";

const STOCKS = [
  { symbol: "AAPL",  name: "애플" },
  { symbol: "MSFT",  name: "마이크로소프트" },
  { symbol: "NVDA",  name: "엔비디아" },
  { symbol: "GOOGL", name: "알파벳" },
  { symbol: "AMZN",  name: "아마존" },
  { symbol: "META",  name: "메타" },
  { symbol: "TSLA",  name: "테슬라" },
  { symbol: "AVGO",  name: "브로드컴" },
  { symbol: "ASML",  name: "ASML" },
  { symbol: "AMD",   name: "AMD" },
];

export async function GET() {
  try {
    const results = await Promise.allSettled(
      STOCKS.map(async ({ symbol, name }) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
          {
            headers: { "User-Agent": "Mozilla/5.0" },
            next: { revalidate: 30 },
          }
        );
        if (!res.ok) throw new Error(`Failed: ${symbol}`);
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error(`No meta: ${symbol}`);

        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
        const change = price - prevClose;
        const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;

        return {
          symbol,
          name,
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changeRate: Math.round(changeRate * 100) / 100,
          volume: meta.regularMarketVolume ?? 0,
          currency: "USD",
          exchange: "NASDAQ",
        };
      })
    );

    const stocks = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "미국 주식 시세 조회 실패" }, { status: 500 });
  }
}
