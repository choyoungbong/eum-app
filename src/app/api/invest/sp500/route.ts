import { NextResponse } from "next/server";

const STOCKS = [
  { symbol: "JPM",  name: "JP모건" },
  { symbol: "V",    name: "비자" },
  { symbol: "JNJ",  name: "존슨앤존슨" },
  { symbol: "WMT",  name: "월마트" },
  { symbol: "BAC",  name: "뱅크오브아메리카" },
  { symbol: "XOM",  name: "엑슨모빌" },
  { symbol: "UNH",  name: "유나이티드헬스" },
  { symbol: "PG",   name: "프록터앤갬블" },
  { symbol: "HD",   name: "홈디포" },
  { symbol: "MA",   name: "마스터카드" },
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
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changeRate: Math.round(changeRate * 100) / 100,
          volume: meta.regularMarketVolume ?? 0,
          exchange: "S&P 500",
          currency: "USD",
        };
      })
    );

    const stocks = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ stocks, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "S&P 500 시세 조회 실패" }, { status: 500 });
  }
}
