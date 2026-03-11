"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  TrendingUp, TrendingDown, ChevronLeft, RefreshCw,
  BarChart2, Coins, Clock, Globe, Flame, Ticket,
  DollarSign, AlertTriangle, MessageSquare, Zap,
  Sparkles, Star, Newspaper,
} from "lucide-react";
import InvestNav from "@/components/InvestNav";

const AnalyzeModal = dynamic(() => import("@/components/AnalyzeModal"), { ssr: false });

// ── 타입 ──────────────────────────────────────────────
interface Stock {
  symbol: string; name: string; price: number;
  change: number; changeRate: number; volume: number;
  exchange: string; currency: string;
}
interface Coin {
  symbol: string; ticker: string; name: string; price: number;
  change: number; changeRate: number; volume24h: number;
  high24h: number; low24h: number; currency: string; exchange?: string;
}
interface ForexItem  { symbol: string; name: string; base: string; quote: string; price: number; change: number; changeRate: number; }
interface CommodityItem { symbol: string; name: string; unit: string; price: number; change: number; changeRate: number; }
interface FearGreedItem { value: number; label: string; labelKo: string; color: string; date: string; }
interface FearGreedData {
  current: FearGreedItem;
  comparison: { yesterday: FearGreedItem | null; weekAgo: FearGreedItem | null; monthAgo: FearGreedItem | null };
  history: FearGreedItem[];
}
interface LottoResult { round: number; date: string; numbers: number[]; bonus: number; firstWinAmount: number; firstWinCount: number; }
interface LottoData {
  latest: LottoResult | null;
  frequency: { top10: { num: number; cnt: number }[]; bottom10: { num: number; cnt: number }[]; analyzedRounds: number };
  recommendations: { highFreq: number[]; lowFreq: number[]; mixed: number[]; random: number[] };
}
interface AnalyzeTarget { symbol: string; name: string; price: number; changeRate: number; assetType: string; }

// ── 유틸 ──────────────────────────────────────────────
const fmt    = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const fmtRate = (r: number) => `${r > 0 ? "+" : ""}${r.toFixed(2)}%`;

const LOTTO_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900", 2: "bg-blue-500 text-white",
  3: "bg-red-500 text-white",         4: "bg-zinc-600 text-white",
  5: "bg-emerald-500 text-white",
};
const lottoColor = (n: number) => {
  if (n <= 10) return LOTTO_COLORS[1]; if (n <= 20) return LOTTO_COLORS[2];
  if (n <= 30) return LOTTO_COLORS[3]; if (n <= 40) return LOTTO_COLORS[4];
  return LOTTO_COLORS[5];
};

// ── 즐겨찾기 훅 ───────────────────────────────────────
function useWatchlist() {
  const [watchSet, setWatchSet] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch("/api/invest/watchlist");
    if (res.ok) {
      const d = await res.json();
      setWatchSet(new Set((d.list ?? []).map((i: any) => i.symbol)));
    }
  }, []);

  useEffect(() => { load(); }, []);

  const toggle = useCallback(async (item: { symbol: string; name: string; assetType: string }) => {
    const has = watchSet.has(item.symbol);
    if (has) {
      await fetch(`/api/invest/watchlist?symbol=${item.symbol}`, { method: "DELETE" });
      setWatchSet((prev) => { const s = new Set(prev); s.delete(item.symbol); return s; });
    } else {
      await fetch("/api/invest/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item }),
      });
      setWatchSet((prev) => new Set([...prev, item.symbol]));
    }
  }, [watchSet]);

  return { watchSet, toggle };
}

// ── 공통 컴포넌트 ──────────────────────────────────────
function ChangeChip({ rate, change, suffix = "" }: { rate: number; change: number; suffix?: string }) {
  const up = rate > 0; const zero = rate === 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${zero ? "text-zinc-500" : up ? "text-emerald-400" : "text-red-400"}`}>
      {!zero && (up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      <span>{fmtRate(rate)}</span>
      <span className="text-[10px] font-normal opacity-70">
        ({up ? "+" : ""}{typeof change === "number" ? (suffix === "원" ? fmt(Math.round(change)) : change.toFixed(2)) : change}{suffix})
      </span>
    </div>
  );
}

function SubTab({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 mb-4 bg-zinc-900/60 rounded-xl p-1 border border-white/5">
      {tabs.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            active === key ? "bg-white/8 text-zinc-100 border border-white/10" : "text-zinc-500 hover:text-zinc-300"
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function CardActions({
  item, assetType, usd, watchSet, onToggleWatch, onAnalyze,
}: {
  item: Stock | Coin; assetType: string; usd: boolean;
  watchSet: Set<string>; onToggleWatch: () => void; onAnalyze: () => void;
}) {
  const starred = watchSet.has((item as any).symbol);
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={onToggleWatch}
        className={`p-1.5 rounded-lg transition-all ${starred ? "text-yellow-400 hover:text-yellow-300" : "text-zinc-700 hover:text-yellow-400"}`}
        title={starred ? "관심 해제" : "관심 추가"}>
        <Star size={13} fill={starred ? "currentColor" : "none"} />
      </button>
      <button onClick={onAnalyze}
        className="p-1.5 rounded-lg text-zinc-700 hover:text-violet-400 transition-all" title="AI 분석">
        <Sparkles size={13} />
      </button>
    </div>
  );
}

function StockCard({
  item, usd = false, assetType = "STOCK_KR", watchSet, onToggleWatch, onAnalyze,
}: {
  item: Stock; usd?: boolean; assetType?: string;
  watchSet: Set<string>; onToggleWatch: () => void; onAnalyze: () => void;
}) {
  const up = item.changeRate > 0; const down = item.changeRate < 0;
  return (
    <div className="flex items-center gap-3 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        up ? "bg-emerald-500/15 text-emerald-400" : down ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"
      }`}>
        {up ? <TrendingUp size={16} /> : down ? <TrendingDown size={16} /> : <BarChart2 size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-zinc-100">{item.name}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{item.symbol.replace(".KS","").replace(".KQ","")} · {item.exchange}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm text-zinc-100">{usd ? fmtUSD(item.price) : `${fmt(item.price)}원`}</p>
        <div className="mt-0.5 flex justify-end">
          <ChangeChip rate={item.changeRate} change={item.change} suffix={usd ? "" : "원"} />
        </div>
      </div>
      <CardActions item={item} assetType={assetType} usd={usd} watchSet={watchSet} onToggleWatch={onToggleWatch} onAnalyze={onAnalyze} />
    </div>
  );
}

function CoinCard({
  item, watchSet, onToggleWatch, onAnalyze,
}: { item: Coin; watchSet: Set<string>; onToggleWatch: () => void; onAnalyze: () => void; }) {
  const up = item.changeRate > 0; const down = item.changeRate < 0;
  const isKRW = item.currency === "KRW";
  return (
    <div className="flex items-center gap-3 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[9px] font-bold shrink-0 ${
        up ? "bg-emerald-500/15 text-emerald-400" : down ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"
      }`}>
        {item.ticker}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-zinc-100">{item.name}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">고 {isKRW ? fmt(item.high24h) : fmtUSD(item.high24h)} · 저 {isKRW ? fmt(item.low24h) : fmtUSD(item.low24h)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm text-zinc-100">{isKRW ? `${fmt(item.price)}원` : fmtUSD(item.price)}</p>
        <div className="mt-0.5 flex justify-end">
          <ChangeChip rate={item.changeRate} change={item.change} suffix={isKRW ? "원" : ""} />
        </div>
      </div>
      <CardActions item={item} assetType="CRYPTO" usd={!isKRW} watchSet={watchSet} onToggleWatch={onToggleWatch} onAnalyze={onAnalyze} />
    </div>
  );
}

function EmptyState() {
  return <div className="text-center py-16 text-zinc-600 text-sm">데이터를 불러오는 중...</div>;
}

// ── 퀵 배너 ───────────────────────────────────────────
function QuickBanner({ fearGreed, usdKrw, btc }: {
  fearGreed: FearGreedData | null; usdKrw: number | null; btc: Coin | null;
}) {
  if (!fearGreed && !usdKrw && !btc) return null;
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4">
      {fearGreed && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/6 rounded-xl">
          <Flame size={12} style={{ color: fearGreed.current.color }} />
          <div>
            <p className="text-[9px] text-zinc-600">공포탐욕</p>
            <p className="text-xs font-bold" style={{ color: fearGreed.current.color }}>
              {fearGreed.current.value} {fearGreed.current.labelKo}
            </p>
          </div>
        </div>
      )}
      {usdKrw && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/6 rounded-xl">
          <Globe size={12} className="text-blue-400" />
          <div>
            <p className="text-[9px] text-zinc-600">USD/KRW</p>
            <p className="text-xs font-bold text-zinc-200">{fmt(usdKrw)}원</p>
          </div>
        </div>
      )}
      {btc && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white/3 border border-white/6 rounded-xl">
          <Coins size={12} className="text-yellow-400" />
          <div>
            <p className="text-[9px] text-zinc-600">BTC</p>
            <p className={`text-xs font-bold ${btc.changeRate > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {fmt(btc.price)}원 {btc.changeRate > 0 ? "+" : ""}{btc.changeRate.toFixed(2)}%
            </p>
          </div>
        </div>
      )}
      <Link href="/invest/watchlist"
        className="shrink-0 flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl hover:border-yellow-500/30 transition-colors">
        <Star size={12} className="text-yellow-400" />
        <span className="text-xs text-yellow-400 font-medium">관심종목</span>
      </Link>
      <Link href="/invest/briefing"
        className="shrink-0 flex items-center gap-2 px-3 py-2 bg-violet-500/5 border border-violet-500/15 rounded-xl hover:border-violet-500/30 transition-colors">
        <Sparkles size={12} className="text-violet-400" />
        <span className="text-xs text-violet-400 font-medium">AI 브리핑</span>
      </Link>
    </div>
  );
}

// ── 탭별 컨텐츠 ───────────────────────────────────────
function StockTab({ kospi, kosdaq, watchSet, onToggleWatch, onAnalyze }: {
  kospi: Stock[]; kosdaq: Stock[];
  watchSet: Set<string>; onToggleWatch: (s: Stock, t: string) => void; onAnalyze: (t: AnalyzeTarget) => void;
}) {
  const [sub, setSub] = useState("kospi");
  const list = sub === "kospi" ? kospi : kosdaq;
  const type = sub === "kospi" ? "STOCK_KR" : "STOCK_KR";
  return (
    <div>
      <SubTab tabs={[{ key: "kospi", label: "코스피" }, { key: "kosdaq", label: "코스닥" }]} active={sub} onChange={setSub} />
      <div className="space-y-2">
        {list.length === 0 ? <EmptyState /> : list.map((s) => (
          <StockCard key={s.symbol} item={s} assetType={type} watchSet={watchSet}
            onToggleWatch={() => onToggleWatch(s, type)}
            onAnalyze={() => onAnalyze({ symbol: s.symbol, name: s.name, price: s.price, changeRate: s.changeRate, assetType: type })} />
        ))}
      </div>
    </div>
  );
}

function USStockTab({ nasdaq, sp500, watchSet, onToggleWatch, onAnalyze }: {
  nasdaq: Stock[]; sp500: Stock[];
  watchSet: Set<string>; onToggleWatch: (s: Stock, t: string) => void; onAnalyze: (t: AnalyzeTarget) => void;
}) {
  const [sub, setSub] = useState("nasdaq");
  const list = sub === "nasdaq" ? nasdaq : sp500;
  return (
    <div>
      <SubTab tabs={[{ key: "nasdaq", label: "나스닥" }, { key: "sp500", label: "S&P 500" }]} active={sub} onChange={setSub} />
      <div className="space-y-2">
        {list.length === 0 ? <EmptyState /> : list.map((s) => (
          <StockCard key={s.symbol} item={s} usd assetType="STOCK_US" watchSet={watchSet}
            onToggleWatch={() => onToggleWatch(s, "STOCK_US")}
            onAnalyze={() => onAnalyze({ symbol: s.symbol, name: s.name, price: s.price, changeRate: s.changeRate, assetType: "STOCK_US" })} />
        ))}
      </div>
    </div>
  );
}

function CryptoTab({ upbit, binance, watchSet, onToggleWatch, onAnalyze }: {
  upbit: Coin[]; binance: Coin[];
  watchSet: Set<string>; onToggleWatch: (c: Coin) => void; onAnalyze: (t: AnalyzeTarget) => void;
}) {
  const [sub, setSub] = useState("upbit");
  const list = sub === "upbit" ? upbit : binance;
  return (
    <div>
      <SubTab tabs={[{ key: "upbit", label: "업비트 KRW" }, { key: "binance", label: "바이낸스 USDT" }]} active={sub} onChange={setSub} />
      <div className="space-y-2">
        {list.length === 0 ? <EmptyState /> : list.map((c) => (
          <CoinCard key={c.symbol} item={c} watchSet={watchSet}
            onToggleWatch={() => onToggleWatch(c)}
            onAnalyze={() => onAnalyze({ symbol: c.symbol, name: c.name, price: c.price, changeRate: c.changeRate, assetType: "CRYPTO" })} />
        ))}
      </div>
    </div>
  );
}

function ForexTab({ forex, commodities }: { forex: ForexItem[]; commodities: CommodityItem[] }) {
  const [sub, setSub] = useState("forex");
  return (
    <div>
      <SubTab tabs={[{ key: "forex", label: "환율" }, { key: "commodity", label: "원자재" }]} active={sub} onChange={setSub} />
      {sub === "forex" && (
        <div className="space-y-2">
          {forex.length === 0 ? <EmptyState /> : forex.map((f) => {
            const up = f.changeRate > 0; const down = f.changeRate < 0;
            return (
              <div key={f.symbol} className="flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${up ? "bg-emerald-500/15 text-emerald-400" : down ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
                  <Globe size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-zinc-100">{f.name}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{f.base} → {f.quote}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-zinc-100">{fmt(f.price)}원</p>
                  <div className="mt-0.5 flex justify-end"><ChangeChip rate={f.changeRate} change={f.change} suffix="원" /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {sub === "commodity" && (
        <div className="space-y-2">
          {commodities.length === 0 ? <EmptyState /> : commodities.map((c) => {
            const up = c.changeRate > 0; const down = c.changeRate < 0;
            return (
              <div key={c.symbol} className="flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${up ? "bg-emerald-500/15 text-emerald-400" : down ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
                  <DollarSign size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-zinc-100">{c.name}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{c.unit}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-zinc-100">{fmtUSD(c.price)}</p>
                  <div className="mt-0.5 flex justify-end"><ChangeChip rate={c.changeRate} change={c.change} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FearGreedTab({ data }: { data: FearGreedData | null }) {
  if (!data) return <EmptyState />;
  const { current, comparison, history } = data;
  const GaugeArc = ({ value }: { value: number }) => {
    const r = 70; const cx = 90; const cy = 90;
    const angle = 180 - (value / 100) * 180;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const px = cx + r * Math.cos(toRad(angle));
    const py = cy - r * Math.sin(toRad(angle));
    return (
      <svg viewBox="0 0 180 100" className="w-48 mx-auto">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#27272a" strokeWidth="12" />
        {[{from:0,to:25,color:"#ef4444"},{from:25,to:45,color:"#f97316"},{from:45,to:55,color:"#eab308"},{from:55,to:75,color:"#84cc16"},{from:75,to:100,color:"#22c55e"}].map(({from,to,color}) => {
          const a1=180-(from/100)*180; const a2=180-(to/100)*180;
          const x1=cx+r*Math.cos(toRad(a1)); const y1=cy-r*Math.sin(toRad(a1));
          const x2=cx+r*Math.cos(toRad(a2)); const y2=cy-r*Math.sin(toRad(a2));
          return <path key={from} d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="12" />;
        })}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="white" />
      </svg>
    );
  };
  return (
    <div className="space-y-4">
      <div className="bg-white/3 border border-white/6 rounded-2xl p-6 text-center">
        <p className="text-xs text-zinc-500 mb-4 uppercase tracking-wider">코인 공포·탐욕 지수</p>
        <GaugeArc value={current.value} />
        <p className="text-5xl font-black mt-2" style={{ color: current.color }}>{current.value}</p>
        <p className="text-lg font-semibold mt-1" style={{ color: current.color }}>{current.labelKo}</p>
        <p className="text-xs text-zinc-600 mt-1">{current.date} 기준</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{label:"어제",data:comparison.yesterday},{label:"1주일 전",data:comparison.weekAgo},{label:"1개월 전",data:comparison.monthAgo}].map(({label,data:d}) => d && (
          <div key={label} className="bg-white/3 border border-white/6 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-600 mb-1">{label}</p>
            <p className="text-2xl font-black" style={{ color: d.color }}>{d.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: d.color }}>{d.labelKo}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
        <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">최근 30일 추이</p>
        <div className="flex items-end gap-0.5 h-16">
          {history.map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height:`${h.value}%`, backgroundColor:h.color, opacity:0.8 }} title={`${h.date}: ${h.value}`} />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-zinc-700 mt-1"><span>30일 전</span><span>오늘</span></div>
      </div>
    </div>
  );
}

function LottoTab({ data }: { data: LottoData | null }) {
  const [picked, setPicked] = useState<number[][]>([]);
  if (!data) return <EmptyState />;
  const { latest, frequency, recommendations } = data;
  const RecommendRow = ({ label, numbers, color }: { label: string; numbers: number[]; color: string }) => (
    <div className="flex items-center gap-3 p-3 bg-zinc-900/60 rounded-xl border border-white/4">
      <span className={`text-xs font-semibold shrink-0 w-20 ${color}`}>{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {numbers.map((n) => <span key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${lottoColor(n)}`}>{n}</span>)}
      </div>
    </div>
  );
  const addPick = () => {
    const pool = Array.from({length:45},(_,i)=>i+1);
    const pick = pool.sort(()=>Math.random()-0.5).slice(0,6).sort((a,b)=>a-b);
    setPicked((prev)=>[pick,...prev].slice(0,5));
  };
  return (
    <div className="space-y-4">
      {latest && (
        <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">제 {latest.round}회 당첨번호</p>
            <p className="text-xs text-zinc-600">{latest.date}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center mb-4">
            {latest.numbers.map((n) => <span key={n} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${lottoColor(n)}`}>{n}</span>)}
            <span className="text-zinc-500 text-sm">+</span>
            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-2 border-zinc-500 ${lottoColor(latest.bonus)}`}>{latest.bonus}</span>
          </div>
          <div className="flex gap-4 justify-center text-center">
            <div><p className="text-[10px] text-zinc-600">1등 당첨금</p><p className="text-sm font-bold text-yellow-400">{fmt(latest.firstWinAmount)}원</p></div>
            <div><p className="text-[10px] text-zinc-600">1등 당첨자</p><p className="text-sm font-bold text-zinc-300">{latest.firstWinCount}명</p></div>
          </div>
        </div>
      )}
      <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">AI 추천 번호 <span className="text-zinc-700 normal-case font-normal">· 최근 {frequency.analyzedRounds}회 분석</span></p>
        <div className="space-y-2">
          <RecommendRow label="🔥 고빈도"   numbers={recommendations.highFreq} color="text-orange-400" />
          <RecommendRow label="❄️ 미출현"   numbers={recommendations.lowFreq}  color="text-blue-400"   />
          <RecommendRow label="🤖 AI 혼합"  numbers={recommendations.mixed}    color="text-violet-400" />
          <RecommendRow label="🎲 완전랜덤" numbers={recommendations.random}   color="text-zinc-400"   />
        </div>
      </div>
      <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">즉석 번호 생성</p>
          <button onClick={addPick} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg font-medium transition-colors">번호 생성</button>
        </div>
        {picked.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">버튼을 눌러 번호를 생성하세요</p>
        ) : (
          <div className="space-y-2">
            {picked.map((nums, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-zinc-900/60 rounded-xl">
                <span className="text-[10px] text-zinc-600 w-4">{i+1}</span>
                <div className="flex gap-1.5">{nums.map((n)=><span key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${lottoColor(n)}`}>{n}</span>)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 p-3 bg-zinc-900/40 rounded-xl border border-white/4">
        <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
        <p className="text-[10px] text-zinc-600">추천 번호는 통계 기반 참고용이며, 당첨을 보장하지 않습니다.</p>
      </div>
    </div>
  );
}

function NewsTab() {
  const [query,   setQuery]   = useState("korea stock market");
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const QUICK = [
    { label: "코스피",   q: "KOSPI korea stock"      },
    { label: "나스닥",   q: "NASDAQ tech stocks"     },
    { label: "비트코인", q: "bitcoin crypto"          },
    { label: "환율",     q: "USD KRW forex exchange"  },
  ];
  const fetchNews = useCallback(async (q: string) => {
    setLoading(true);
    try { const res = await fetch(`/api/invest/news?q=${encodeURIComponent(q)}`); const d = await res.json(); setItems(d.items ?? []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchNews(query); }, []);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {QUICK.map(({ label, q }) => (
          <button key={q} onClick={() => { setQuery(q); fetchNews(q); }}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs border transition-all ${query === q ? "bg-white/8 text-zinc-200 border-white/15" : "text-zinc-500 border-zinc-800 hover:border-zinc-600"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&fetchNews(query)}
          placeholder="뉴스 검색..."
          className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
        <button onClick={()=>fetchNews(query)} disabled={loading}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
          <RefreshCw size={14} className={loading?"animate-spin":""} />
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_,i)=>(
          <div key={i} className="animate-pulse flex gap-3 p-4 bg-white/3 rounded-2xl border border-white/4">
            <div className="w-16 h-16 bg-white/6 rounded-xl shrink-0" /><div className="flex-1 space-y-2"><div className="h-3 bg-white/6 rounded w-3/4" /><div className="h-3 bg-white/6 rounded w-1/2" /></div>
          </div>
        ))}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-zinc-600 text-sm">뉴스를 찾을 수 없습니다</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
              className="flex gap-3 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all group">
              {item.thumbnail && <img src={item.thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-zinc-800" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 group-hover:text-white line-clamp-2 leading-snug transition-colors">{item.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-zinc-600">{item.publisher}</span>
                  <span className="text-zinc-800">·</span>
                  <span className="text-[10px] text-zinc-700">{new Date(item.publishedAt).toLocaleDateString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityTab() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/invest/community" className="group flex flex-col gap-3 p-5 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-violet-500/30 rounded-2xl transition-all">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center"><MessageSquare size={18} className="text-violet-400" /></div>
          <div><p className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">종목 토론</p><p className="text-[11px] text-zinc-600 mt-0.5">코스피·코스닥·나스닥·코인</p></div>
        </Link>
        <Link href="/invest/reading" className="group flex flex-col gap-3 p-5 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-emerald-500/30 rounded-2xl transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Zap size={18} className="text-emerald-400" /></div>
          <div><p className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors">AI 리딩방</p><p className="text-[11px] text-zinc-600 mt-0.5">실시간 채팅 리딩방</p></div>
        </Link>
      </div>
      <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">카테고리별 바로가기</p>
        <div className="flex flex-wrap gap-2">
          {[
            {label:"코스피 토론",href:"/invest/community?category=KOSPI",  color:"text-blue-400    bg-blue-500/10    border-blue-500/20"},
            {label:"코스닥 토론",href:"/invest/community?category=KOSDAQ", color:"text-emerald-400 bg-emerald-500/10 border-emerald-500/20"},
            {label:"나스닥 토론",href:"/invest/community?category=NASDAQ", color:"text-violet-400  bg-violet-500/10  border-violet-500/20"},
            {label:"코인 토론",  href:"/invest/community?category=CRYPTO", color:"text-yellow-400  bg-yellow-500/10  border-yellow-500/20"},
          ].map(({label,href,color})=>(
            <Link key={label} href={href} className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all hover:opacity-80 ${color}`}>{label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 메인 탭 ───────────────────────────────────────────
const MAIN_TABS = [
  { key: "stock",     label: "국내 주식",   icon: BarChart2     },
  { key: "usstock",   label: "미국 주식",   icon: TrendingUp    },
  { key: "crypto",    label: "암호화폐",    icon: Coins         },
  { key: "forex",     label: "환율/원자재", icon: Globe         },
  { key: "feargreed", label: "공포탐욕",    icon: Flame         },
  { key: "lotto",     label: "로또",        icon: Ticket        },
  { key: "news",      label: "뉴스",        icon: Newspaper     },
  { key: "community", label: "커뮤니티",    icon: MessageSquare },
] as const;
type MainTab = typeof MAIN_TABS[number]["key"];

export default function InvestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { watchSet, toggle: toggleWatch } = useWatchlist();

  const [tab,         setTab]         = useState<MainTab>("stock");
  const [loading,     setLoading]     = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [updatedAt,   setUpdatedAt]   = useState<string | null>(null);
  const [analyzeTarget, setAnalyzeTarget] = useState<AnalyzeTarget | null>(null);

  const [kospi,       setKospi]       = useState<Stock[]>([]);
  const [kosdaq,      setKosdaq]      = useState<Stock[]>([]);
  const [nasdaq,      setNasdaq]      = useState<Stock[]>([]);
  const [sp500,       setSp500]       = useState<Stock[]>([]);
  const [upbit,       setUpbit]       = useState<Coin[]>([]);
  const [binance,     setBinance]     = useState<Coin[]>([]);
  const [forex,       setForex]       = useState<ForexItem[]>([]);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [fearGreed,   setFearGreed]   = useState<FearGreedData | null>(null);
  const [lotto,       setLotto]       = useState<LottoData | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s1,s2,s3,s4,c1,c2,fx,fg,lt] = await Promise.allSettled([
      fetch("/api/invest/stocks").then(r=>r.json()),
      fetch("/api/invest/kosdaq").then(r=>r.json()),
      fetch("/api/invest/us-stocks").then(r=>r.json()),
      fetch("/api/invest/sp500").then(r=>r.json()),
      fetch("/api/invest/crypto").then(r=>r.json()),
      fetch("/api/invest/binance").then(r=>r.json()),
      fetch("/api/invest/forex").then(r=>r.json()),
      fetch("/api/invest/fear-greed").then(r=>r.json()),
      fetch("/api/invest/lotto").then(r=>r.json()),
    ]);
    if (s1.status==="fulfilled") setKospi(s1.value.stocks??[]);
    if (s2.status==="fulfilled") setKosdaq(s2.value.stocks??[]);
    if (s3.status==="fulfilled") setNasdaq(s3.value.stocks??[]);
    if (s4.status==="fulfilled") setSp500(s4.value.stocks??[]);
    if (c1.status==="fulfilled") setUpbit(c1.value.coins??[]);
    if (c2.status==="fulfilled") setBinance(c2.value.coins??[]);
    if (fx.status==="fulfilled") { setForex(fx.value.forex??[]); setCommodities(fx.value.commodities??[]); }
    if (fg.status==="fulfilled") setFearGreed(fg.value);
    if (lt.status==="fulfilled") setLotto(lt.value);
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => { if (session) fetchAll(); }, [session, fetchAll]);
  useEffect(() => {
    if (!autoRefresh || !session) return;
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, session, fetchAll]);

  const usdKrw = forex.find((f) => f.base === "USD")?.price ?? null;
  const btc     = upbit.find((c) => c.ticker === "BTC") ?? null;

  const handleToggleStock = (s: Stock, type: string) =>
    toggleWatch({ symbol: s.symbol, name: s.name, assetType: type });
  const handleToggleCoin = (c: Coin) =>
    toggleWatch({ symbol: c.symbol, name: c.name, assetType: "CRYPTO" });

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center">
                <TrendingUp size={13} className="text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">AI Invest</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock size={10} />
                {new Date(updatedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
              </span>
            )}
            <button onClick={()=>setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${autoRefresh?"bg-emerald-500/10 border-emerald-500/30 text-emerald-400":"bg-zinc-800/60 border-zinc-700 text-zinc-500"}`}>
              자동
            </button>
            <button onClick={fetchAll} disabled={loading}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200 disabled:opacity-40">
              <RefreshCw size={15} className={loading?"animate-spin":""} />
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-none">
          {MAIN_TABS.map(({key,label,icon:Icon})=>(
            <button key={key} onClick={()=>setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                tab===key?"bg-white/8 text-zinc-100 border border-white/10":"text-zinc-500 hover:text-zinc-300"
              }`}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-24 relative">
        <QuickBanner fearGreed={fearGreed} usdKrw={usdKrw} btc={btc} />
        {tab==="stock"     && <StockTab   kospi={kospi} kosdaq={kosdaq} watchSet={watchSet} onToggleWatch={handleToggleStock} onAnalyze={setAnalyzeTarget} />}
        {tab==="usstock"   && <USStockTab nasdaq={nasdaq} sp500={sp500} watchSet={watchSet} onToggleWatch={handleToggleStock} onAnalyze={setAnalyzeTarget} />}
        {tab==="crypto"    && <CryptoTab  upbit={upbit} binance={binance} watchSet={watchSet} onToggleWatch={handleToggleCoin} onAnalyze={setAnalyzeTarget} />}
        {tab==="forex"     && <ForexTab   forex={forex} commodities={commodities} />}
        {tab==="feargreed" && <FearGreedTab data={fearGreed} />}
        {tab==="lotto"     && <LottoTab   data={lotto} />}
        {tab==="news"      && <NewsTab />}
        {tab==="community" && <CommunityTab />}
        <p className="text-center text-[10px] text-zinc-700 mt-6">시세는 실시간이 아니며 참고용입니다 · 30초마다 자동 갱신</p>
      </main>

      <InvestNav />
      {analyzeTarget && <AnalyzeModal {...analyzeTarget} onClose={() => setAnalyzeTarget(null)} />}
    </div>
  );
}
