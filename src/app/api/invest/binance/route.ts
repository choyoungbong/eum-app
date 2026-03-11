import { NextResponse } from "next/server";

const BINANCE_TICKERS = [
  { symbol: "BTCUSDT",  name: "비트코인",  ticker: "BTC"  },
  { symbol: "ETHUSDT",  name: "이더리움",  ticker: "ETH"  },
  { symbol: "BNBUSDT",  name: "BNB",       ticker: "BNB"  },
  { symbol: "XRPUSDT",  name: "리플",      ticker: "XRP"  },
  { symbol: "SOLUSDT",  name: "솔라나",    ticker: "SOL"  },
  { symbol: "ADAUSDT",  name: "에이다",    ticker: "ADA"  },
  { symbol: "DOGEUSDT", name: "도지코인",  ticker: "DOGE" },
  { symbol: "AVAXUSDT", name: "아발란체",  ticker: "AVAX" },
  { symbol: "DOTUSDT",  name: "폴카닷",    ticker: "DOT"  },
  { symbol: "MATICUSDT",name: "폴리곤",    ticker: "MATIC"},
];

export async function GET() {
  try {
    const symbols = JSON.stringify(BINANCE_TICKERS.map((t) => `"${t.symbol}"`).join(","));
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${BINANCE_TICKERS.map((t) => `"${t.symbol}"`).join(",")}]`;

    const res  = await fetch(url, { next: { revalidate: 30 } });
    const data = await res.json();

    const coins = data.map((item: any) => {
      const meta       = BINANCE_TICKERS.find((t) => t.symbol === item.symbol)!;
      const price      = parseFloat(item.lastPrice);
      const change     = parseFloat(item.priceChange);
      const changeRate = parseFloat(item.priceChangePercent);
      const volume24h  = parseFloat(item.quoteVolume);
      const high24h    = parseFloat(item.highPrice);
      const low24h     = parseFloat(item.lowPrice);

      return {
        symbol:     meta.symbol,
        ticker:     meta.ticker,
        name:       meta.name,
        price,
        change,
        changeRate,
        volume24h,
        high24h,
        low24h,
        currency:   "USDT",
        exchange:   "Binance",
      };
    });

    return NextResponse.json({ coins });
  } catch (e) {
    console.error("Binance API error:", e);
    return NextResponse.json({ coins: [] });
  }
}