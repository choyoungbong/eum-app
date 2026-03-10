import { NextResponse } from "next/server";

const STOCKS = [
  { symbol: "247540.KQ", name: "에코프로비엠" },
  { symbol: "086520.KQ", name: "에코프로" },
  { symbol: "196170.KQ", name: "알테오젠" },
  { symbol: "091990.KQ", name: "셀트리온헬스케어" },
  { symbol: "263750.KQ", name: "펄어비스" },
  { symbol: "293490.KQ", name: "카카오게임즈" },
  { symbol: "112040.KQ", name: "위메이드" },
  { symbol: "357780.KQ", name: "솔브레인" },
  { symbol: "145020.KQ", name: "휴젤" },
  { symbol: "041510.KQ", name: "에스엠" },
];

export async function GET() {
  try {
    const results = await Promise.allSettled(
      STOCKS.map(async ({ symbol, name }) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 30 } }
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
          exchange: "KOSDAQ",
          currency: "KRW",
        };
      })
    );

    const stocks = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "코스닥 시세 조회 실패" }, { status: 500 });
  }
}
