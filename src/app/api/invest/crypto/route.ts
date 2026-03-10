import { NextResponse } from "next/server";

const MARKETS = [
  { market: "KRW-BTC",  name: "비트코인",  symbol: "BTC" },
  { market: "KRW-ETH",  name: "이더리움",  symbol: "ETH" },
  { market: "KRW-XRP",  name: "리플",      symbol: "XRP" },
  { market: "KRW-SOL",  name: "솔라나",    symbol: "SOL" },
  { market: "KRW-DOGE", name: "도지코인",  symbol: "DOGE" },
  { market: "KRW-ADA",  name: "에이다",    symbol: "ADA" },
  { market: "KRW-AVAX", name: "아발란체",  symbol: "AVAX" },
  { market: "KRW-DOT",  name: "폴카닷",    symbol: "DOT" },
  { market: "KRW-MATIC",name: "폴리곤",    symbol: "MATIC" },
  { market: "KRW-LINK", name: "체인링크",  symbol: "LINK" },
];

export async function GET() {
  try {
    const marketStr = MARKETS.map((m) => m.market).join(",");
    const res = await fetch(
      `https://api.upbit.com/v1/ticker?markets=${marketStr}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("Upbit API 실패");

    const data: any[] = await res.json();
    const nameMap = Object.fromEntries(MARKETS.map((m) => [m.market, m]));

    const coins = data.map((item) => {
      const info = nameMap[item.market];
      return {
        market: item.market,
        symbol: info?.symbol ?? item.market,
        name: info?.name ?? item.market,
        price: item.trade_price,
        change: item.signed_change_price,
        changeRate: Math.round(item.signed_change_rate * 10000) / 100,
        volume24h: Math.round(item.acc_trade_price_24h / 1_000_000), // 백만원 단위
        high24h: item.high_price,
        low24h: item.low_price,
      };
    });

    return NextResponse.json({ coins, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: "코인 시세 조회 실패" }, { status: 500 });
  }
}
