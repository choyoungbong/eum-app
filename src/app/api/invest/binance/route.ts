import { NextResponse } from "next/server";

const PAIRS = [
  { symbol: "BTCUSDT",  name: "비트코인",  ticker: "BTC" },
  { symbol: "ETHUSDT",  name: "이더리움",  ticker: "ETH" },
  { symbol: "BNBUSDT",  name: "바이낸스",  ticker: "BNB" },
  { symbol: "SOLUSDT",  name: "솔라나",    ticker: "SOL" },
  { symbol: "XRPUSDT",  name: "리플",      ticker: "XRP" },
  { symbol: "DOGEUSDT", name: "도지코인",  ticker: "DOGE" },
  { symbol: "ADAUSDT",  name: "에이다",    ticker: "ADA" },
  { symbol: "AVAXUSDT", name: "아발란체",  ticker: "AVAX" },
  { symbol: "DOTUSDT",  name: "폴카닷",    ticker: "DOT" },
  { symbol: "LINKUSDT", name: "체인링크",  ticker: "LINK" },
];

export async function GET() {
  try {
    const symbolList = PAIRS.map((p) => `"${p.symbol}"`).join(",");
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolList}]`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("Binance API 실패");
    const data: any[] = await res.json();

    const nameMap = Object.fromEntries(PAIRS.map((p) => [p.symbol, p]));

    const coins = data.map((item) => {
      const info = nameMap[item.symbol];
      const price = parseFloat(item.lastPrice);
      const change = parseFloat(item.priceChange);
      const changeRate = parseFloat(item.priceChangePercent);

      return {
        symbol: item.symbol,
        ticker: info?.ticker ?? item.symbol,
        name: info?.name ?? item.symbol,
        price: Math.round(price * 10000) / 10000,
        change: Math.round(change * 10000) / 10000,
        changeRate: Math.round(changeRate * 100) / 100,
        high24h: parseFloat(item.highPrice),
        low24h: parseFloat(item.lowPrice),
        volume24h: Math.round(parseFloat(item.quoteVolume)), // USDT 기준
        currency: "USDT",
        exchange: "Binance",
      };
    });

    return NextResponse.json({ coins, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "바이낸스 시세 조회 실패" }, { status: 500 });
  }
}
```

---

## 전체 API 파일 구조 정리
```
src/app/api/invest/
 ├ stocks/route.ts       ← 기존 (코스피)
 ├ kosdaq/route.ts       ← 신규
 ├ us-stocks/route.ts    ← 기존 (나스닥)
 ├ sp500/route.ts        ← 신규
 ├ crypto/route.ts       ← 기존 (업비트 KRW)
 ├ binance/route.ts      ← 신규
 ├ forex/route.ts        ← 신규 (환율 + 원자재)
 ├ fear-greed/route.ts   ← 신규
 └ lotto/route.ts        ← 기존
