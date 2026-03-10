import { NextResponse } from "next/server";

// 환율: Yahoo Finance FX 심볼
const FX_PAIRS = [
  { symbol: "USDKRW=X", name: "달러/원",     base: "USD", quote: "KRW" },
  { symbol: "JPYKRW=X", name: "엔/원",       base: "JPY", quote: "KRW" },
  { symbol: "EURKRW=X", name: "유로/원",     base: "EUR", quote: "KRW" },
  { symbol: "CNYKRW=X", name: "위안/원",     base: "CNY", quote: "KRW" },
  { symbol: "GBPKRW=X", name: "파운드/원",   base: "GBP", quote: "KRW" },
];

// 원자재: Yahoo Finance Futures 심볼
const COMMODITIES = [
  { symbol: "GC=F",  name: "금",     unit: "USD/oz" },
  { symbol: "SI=F",  name: "은",     unit: "USD/oz" },
  { symbol: "CL=F",  name: "WTI 유가", unit: "USD/배럴" },
  { symbol: "NG=F",  name: "천연가스", unit: "USD/MMBtu" },
  { symbol: "HG=F",  name: "구리",   unit: "USD/lb" },
];

async function fetchYahoo(symbol: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Failed: ${symbol}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No meta: ${symbol}`);
  return meta;
}

export async function GET() {
  try {
    const [fxResults, commodityResults] = await Promise.all([
      Promise.allSettled(
        FX_PAIRS.map(async ({ symbol, name, base, quote }) => {
          const meta = await fetchYahoo(symbol);
          const price = meta.regularMarketPrice ?? 0;
          const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
          const change = price - prevClose;
          const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;
          return {
            symbol, name, base, quote,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changeRate: Math.round(changeRate * 100) / 100,
          };
        })
      ),
      Promise.allSettled(
        COMMODITIES.map(async ({ symbol, name, unit }) => {
          const meta = await fetchYahoo(symbol);
          const price = meta.regularMarketPrice ?? 0;
          const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
          const change = price - prevClose;
          const changeRate = prevClose > 0 ? (change / prevClose) * 100 : 0;
          return {
            symbol, name, unit,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changeRate: Math.round(changeRate * 100) / 100,
          };
        })
      ),
    ]);

    const forex = fxResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const commodities = commodityResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ forex, commodities, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "환율/원자재 조회 실패" }, { status: 500 });
  }
}
