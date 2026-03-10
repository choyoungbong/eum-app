import { NextResponse } from "next/server";

const STOCKS = [
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "000660.KS", name: "SK하이닉스" },
  { symbol: "035420.KS", name: "NAVER" },
  { symbol: "035720.KS", name: "카카오" },
  { symbol: "005380.KS", name: "현대차" },
  { symbol: "000270.KS", name: "기아" },
  { symbol: "051910.KS", name: "LG화학" },
  { symbol: "006400.KS", name: "삼성SDI" },
  { symbol: "068270.KS", name: "셀트리온" },
  { symbol: "105560.KS", name: "KB금융" },
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
          price,
          change: Math.round(change),
          changeRate: Math.round(changeRate * 100) / 100,
          volume: meta.regularMarketVolume ?? 0,
          currency: meta.currency ?? "KRW",
        };
      })
    );

    const stocks = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "시세 조회 실패" }, { status: 500 });
  }
}
