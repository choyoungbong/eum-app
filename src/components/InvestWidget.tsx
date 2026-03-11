"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, ChevronRight, RefreshCw, Flame } from "lucide-react";

interface StockItem { name: string; price: number; changeRate: number; currency: string; }
interface CoinItem  { name: string; ticker: string; price: number; changeRate: number; }
interface FearGreed { value: number; labelKo: string; color: string; }

const fmt    = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MiniTicker({ name, price, changeRate, usd = false }: { name: string; price: number; changeRate: number; usd?: boolean }) {
  const up   = changeRate > 0;
  const down = changeRate < 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
      <span className="text-xs text-zinc-400 truncate mr-2">{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-zinc-200">{usd ? fmtUSD(price) : `${fmt(price)}원`}</span>
        <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${
          up ? "bg-emerald-500/10 text-emerald-400" : down ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-500"
        }`}>
          {up ? <TrendingUp size={9} /> : down ? <TrendingDown size={9} /> : null}
          {up ? "+" : ""}{changeRate.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function InvestWidget() {
  const [kospi,     setKospi]     = useState<StockItem[]>([]);
  const [crypto,    setCrypto]    = useState<CoinItem[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [usdKrw,    setUsdKrw]   = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [s, c, fg, fx] = await Promise.allSettled([
      fetch("/api/invest/stocks").then((r) => r.json()),
      fetch("/api/invest/crypto").then((r) => r.json()),
      fetch("/api/invest/fear-greed").then((r) => r.json()),
      fetch("/api/invest/forex").then((r) => r.json()),
    ]);

    if (s.status  === "fulfilled") setKospi((s.value.stocks  ?? []).slice(0, 4));
    if (c.status  === "fulfilled") setCrypto((c.value.coins  ?? []).slice(0, 3));
    if (fg.status === "fulfilled") setFearGreed(fg.value.current ?? null);
    if (fx.status === "fulfilled") {
      const usd = (fx.value.forex ?? []).find((f: any) => f.base === "USD");
      if (usd) setUsdKrw(usd.price);
    }
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="bg-white/3 border border-white/6 rounded-2xl overflow-hidden">
      {/* 위젯 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center">
            <TrendingUp size={11} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-300">AI Invest</span>
          {updatedAt && (
            <span className="text-[9px] text-zinc-700">
              {new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={fetchData} disabled={loading}
            className="p-1 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-400 transition-all disabled:opacity-40">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/invest"
            className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
            전체보기 <ChevronRight size={11} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse flex justify-between py-2 border-b border-white/4 last:border-0">
              <div className="h-3 bg-white/6 rounded w-20" />
              <div className="h-3 bg-white/6 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-white/4">
          {/* 환율 + 공포탐욕 요약 */}
          <div className="px-4 py-2.5 flex items-center gap-3">
            {usdKrw && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wider">USD/KRW</span>
                <span className="text-xs font-semibold text-zinc-300">{fmt(usdKrw)}원</span>
              </div>
            )}
            {fearGreed && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Flame size={11} style={{ color: fearGreed.color }} />
                <span className="text-[10px] font-semibold" style={{ color: fearGreed.color }}>
                  {fearGreed.labelKo} {fearGreed.value}
                </span>
              </div>
            )}
          </div>

          {/* 코스피 주요 종목 */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">코스피</span>
              <Link href="/invest" className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors">더보기</Link>
            </div>
            {kospi.map((s) => (
              <MiniTicker key={s.name} name={s.name} price={s.price} changeRate={s.changeRate} />
            ))}
          </div>

          {/* 코인 주요 시세 */}
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">암호화폐</span>
              <Link href="/invest?tab=crypto" className="text-[9px] text-zinc-700 hover:text-zinc-500 transition-colors">더보기</Link>
            </div>
            {crypto.map((c) => (
              <MiniTicker key={c.ticker} name={c.name} price={c.price} changeRate={c.changeRate} />
            ))}
          </div>
        </div>
      )}

      {/* 바로가기 버튼 */}
      <div className="grid grid-cols-3 border-t border-white/5">
        {[
          { label: "시세 조회", href: "/invest",             color: "text-emerald-400" },
          { label: "리딩방",    href: "/invest/reading",     color: "text-violet-400"  },
          { label: "포트폴리오", href: "/invest/portfolio",  color: "text-blue-400"    },
        ].map(({ label, href, color }) => (
          <Link key={href} href={href}
            className={`py-2.5 text-center text-[10px] font-semibold border-r border-white/5 last:border-0 hover:bg-white/4 transition-colors ${color}`}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
