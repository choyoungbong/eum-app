"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, ChevronLeft, RefreshCw,
  BarChart2, Coins, Clock, Globe, Flame, Ticket,
  DollarSign, AlertTriangle,
} from "lucide-react";

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
interface ForexItem {
  symbol: string; name: string; base: string; quote: string;
  price: number; change: number; changeRate: number;
}
interface CommodityItem {
  symbol: string; name: string; unit: string;
  price: number; change: number; changeRate: number;
}
interface FearGreedItem {
  value: number; label: string; labelKo: string; color: string; date: string;
}
interface FearGreedData {
  current: FearGreedItem;
  comparison: { yesterday: FearGreedItem | null; weekAgo: FearGreedItem | null; monthAgo: FearGreedItem | null };
  history: FearGreedItem[];
}
interface LottoResult {
  round: number; date: string; numbers: number[]; bonus: number;
  firstWinAmount: number; firstWinCount: number;
}
interface LottoData {
  latest: LottoResult | null;
  frequency: { top10: { num: number; cnt: number }[]; bottom10: { num: number; cnt: number }[]; analyzedRounds: number };
  recommendations: { highFreq: number[]; lowFreq: number[]; mixed: number[]; random: number[] };
}

// ── 유틸 ──────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const fmtRate = (r: number) => `${r > 0 ? "+" : ""}${r.toFixed(2)}%`;

const LOTTO_COLORS: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-blue-500 text-white",
  3: "bg-red-500 text-white",
  4: "bg-zinc-600 text-white",
  5: "bg-emerald-500 text-white",
};
const lottoColor = (n: number) => {
  if (n <= 10) return LOTTO_COLORS[1];
  if (n <= 20) return LOTTO_COLORS[2];
  if (n <= 30) return LOTTO_COLORS[3];
  if (n <= 40) return LOTTO_COLORS[4];
  return LOTTO_COLORS[5];
};

// ── 공통 컴포넌트 ──────────────────────────────────────
function ChangeChip({ rate, change, suffix = "" }: { rate: number; change: number; suffix?: string }) {
  const up = rate > 0; const zero = rate === 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${zero ? "text-zinc-500" : up ? "text-emerald-400" : "text-red-400"}`}>
      {!zero && (up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      <span>{fmtRate(rate)}</span>
      <span className="text-[10px] font-normal opacity-70">({up ? "+" : ""}{change > 0 && !up ? "" : ""}{typeof change === "number" ? (suffix === "원" ? fmt(Math.round(change)) : change.toFixed(2)) : change}{suffix})</span>
    </div>
  );
}

function SubTab({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 mb-4 bg-zinc-900/60 rounded-xl p-1 border border-white/5">
      {tabs.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${active === key ? "bg-white/8 text-zinc-100 border border-white/10" : "text-zinc-500 hover:text-zinc-300"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function StockCard({ item, usd = false }: { item: Stock; usd?: boolean }) {
  const up = item.changeRate > 0; const down = item.changeRate < 0;
  return (
    <div className="flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${up ? "bg-emerald-500/15 text-emerald-400" : down ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
        {up ? <TrendingUp size={16} /> : down ? <TrendingDown size={16} /> : <BarChart2 size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-zinc-100">{item.name}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{item.symbol.replace(".KS", "").replace(".KQ", "")} · {item.exchange}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm text-zinc-100">{usd ? fmtUSD(item.price) : `${fmt(item.price)}원`}</p>
        <div className="mt-0.5 flex justify-end">
          <ChangeChip rate={item.changeRate} change={item.change} suffix={usd ? "" : "원"} />
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block w-20">
        <p className="text-[10px] text-zinc-600">거래량</p>
        <p className="text-xs text-zinc-400">{fmt(item.volume)}</p>
      </div>
    </div>
  );
}

function CoinCard({ item }: { item: Coin }) {
  const up = item.changeRate > 0; const down = item.changeRate < 0;
  const isKRW = item.currency === "KRW";
  return (
    <div className="flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[9px] font-bold shrink-0 ${up ? "bg-emerald-500/15 text-emerald-400" : down ? "bg-red-500/15 text-red-400" : "bg-zinc-800 text-zinc-500"}`}>
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
      <div className="text-right shrink-0 hidden sm:block w-24">
        <p className="text-[10px] text-zinc-600">거래대금</p>
        <p className="text-xs text-zinc-400">{isKRW ? `${fmt(item.volume24h)}백만` : `$${fmt(Math.round(item.volume24h / 1_000_000))}M`}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return <div className="text-center py-16 text-zinc-600 text-sm">데이터를 불러오는 중...</div>;
}

// ── 탭별 컨텐츠 ───────────────────────────────────────

function StockTab({ kospi, kosdaq }: { kospi: Stock[]; kosdaq: Stock[] }) {
  const [sub, setSub] = useState("kospi");
  const list = sub === "kospi" ? kospi : kosdaq;
  return (
    <div>
      <SubTab tabs={[{ key: "kospi", label: "코스피" }, { key: "kosdaq", label: "코스닥" }]} active={sub} onChange={setSub} />
      <div className="space-y-2">
        {list.length === 0 ? <EmptyState /> : list.map((s) => <StockCard key={s.symbol} item={s} />)}
      </div>
    </div>
  );
}

function USStockTab({ nasdaq, sp500 }: { nasdaq: Stock[]; sp500: Stock[] }) {
  const [sub, setSub] = useState("nasdaq");
  const list = sub === "nasdaq" ? nasdaq : sp500;
  return (
    <div>
      <SubTab tabs={[{ key: "nasdaq", label: "나스닥" }, { key: "sp500", label: "S&P 500" }]} active={sub} onChange={setSub} />
      <div className="space-y-2">
        {list.length === 0 ? <EmptyState /> : list.map((s) => <StockCard key={s.symbol} item={s} usd />)}
      </div>
    </div>
  );
}

function CryptoTab({ upbit, binance }: { upbit: Coin[]; binance: Coin[] }) {
  const [sub, setSub] = useState("upbit");
  const list = sub === "upbit" ? upbit : binance;
  return (
    <div>
      <SubTab tabs={[{ key: "upbit", label: "업비트 KRW" }, { key: "binance", label: "바이낸스 USDT" }]} active={sub} onChange={setSub} />
      <div className="space-y-2">
        {list.length === 0 ? <EmptyState /> : list.map((c) => <CoinCard key={c.symbol} item={c} />)}
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
                  <div className="mt-0.5 flex justify-end">
                    <ChangeChip rate={f.changeRate} change={f.change} suffix="원" />
                  </div>
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
                  <div className="mt-0.5 flex justify-end">
                    <ChangeChip rate={c.changeRate} change={c.change} />
                  </div>
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
    const startAngle = 180; const endAngle = 0;
    const angle = startAngle - (value / 100) * 180;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const px = cx + r * Math.cos(toRad(angle));
    const py = cy - r * Math.sin(toRad(angle));
    return (
      <svg viewBox="0 0 180 100" className="w-48 mx-auto">
        {/* 배경 호 */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#27272a" strokeWidth="12" />
        {/* 색상 호 */}
        {[
          { from: 0, to: 25, color: "#ef4444" },
          { from: 25, to: 45, color: "#f97316" },
          { from: 45, to: 55, color: "#eab308" },
          { from: 55, to: 75, color: "#84cc16" },
          { from: 75, to: 100, color: "#22c55e" },
        ].map(({ from, to, color }) => {
          const a1 = 180 - (from / 100) * 180;
          const a2 = 180 - (to / 100) * 180;
          const x1 = cx + r * Math.cos(toRad(a1)); const y1 = cy - r * Math.sin(toRad(a1));
          const x2 = cx + r * Math.cos(toRad(a2)); const y2 = cy - r * Math.sin(toRad(a2));
          return <path key={from} d={`M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="12" />;
        })}
        {/* 바늘 */}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="white" />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* 게이지 카드 */}
      <div className="bg-white/3 border border-white/6 rounded-2xl p-6 text-center">
        <p className="text-xs text-zinc-500 mb-4 uppercase tracking-wider">코인 공포·탐욕 지수</p>
        <GaugeArc value={current.value} />
        <p className="text-5xl font-black mt-2" style={{ color: current.color }}>{current.value}</p>
        <p className="text-lg font-semibold mt-1" style={{ color: current.color }}>{current.labelKo}</p>
        <p className="text-xs text-zinc-600 mt-1">{current.date} 기준</p>
      </div>

      {/* 비교 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "어제", data: comparison.yesterday },
          { label: "1주일 전", data: comparison.weekAgo },
          { label: "1개월 전", data: comparison.monthAgo },
        ].map(({ label, data: d }) => d && (
          <div key={label} className="bg-white/3 border border-white/6 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-600 mb-1">{label}</p>
            <p className="text-2xl font-black" style={{ color: d.color }}>{d.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: d.color }}>{d.labelKo}</p>
          </div>
        ))}
      </div>

      {/* 히스토리 바 차트 */}
      <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
        <p className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">최근 30일 추이</p>
        <div className="flex items-end gap-0.5 h-16">
          {history.map((h, i) => (
            <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${h.value}%`, backgroundColor: h.color, opacity: 0.8 }} title={`${h.date}: ${h.value} (${h.labelKo})`} />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-zinc-700 mt-1">
          <span>30일 전</span><span>오늘</span>
        </div>
      </div>

      {/* 범례 */}
      <div className="grid grid-cols-5 gap-1">
        {[
          { label: "극단적 공포", color: "#ef4444", range: "0-25" },
          { label: "공포", color: "#f97316", range: "25-45" },
          { label: "중립", color: "#eab308", range: "45-55" },
          { label: "탐욕", color: "#84cc16", range: "55-75" },
          { label: "극단적 탐욕", color: "#22c55e", range: "75-100" },
        ].map(({ label, color, range }) => (
          <div key={range} className="text-center">
            <div className="w-full h-1.5 rounded-full mb-1" style={{ backgroundColor: color }} />
            <p className="text-[8px] text-zinc-600 leading-tight">{label}</p>
            <p className="text-[8px] text-zinc-700">{range}</p>
          </div>
        ))}
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
        {numbers.map((n) => (
          <span key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${lottoColor(n)}`}>{n}</span>
        ))}
      </div>
    </div>
  );

  const addPick = () => {
    const pool = Array.from({ length: 45 }, (_, i) => i + 1);
    const pick = pool.sort(() => Math.random() - 0.5).slice(0, 6).sort((a, b) => a - b);
    setPicked((prev) => [pick, ...prev].slice(0, 5));
  };

  return (
    <div className="space-y-4">
      {/* 최근 당첨 결과 */}
      {latest && (
        <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">제 {latest.round}회 당첨번호</p>
            <p className="text-xs text-zinc-600">{latest.date}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center mb-4">
            {latest.numbers.map((n) => (
              <span key={n} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${lottoColor(n)}`}>{n}</span>
            ))}
            <span className="text-zinc-500 text-sm">+</span>
            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-2 border-zinc-500 ${lottoColor(latest.bonus)}`}>{latest.bonus}</span>
          </div>
          <div className="flex gap-4 justify-center text-center">
            <div>
              <p className="text-[10px] text-zinc-600">1등 당첨금</p>
              <p className="text-sm font-bold text-yellow-400">{fmt(latest.firstWinAmount)}원</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600">1등 당첨자</p>
              <p className="text-sm font-bold text-zinc-300">{latest.firstWinCount}명</p>
            </div>
          </div>
        </div>
      )}

      {/* AI 추천 번호 */}
      <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
          AI 추천 번호 <span className="text-zinc-700 normal-case font-normal">· 최근 {frequency.analyzedRounds}회 분석</span>
        </p>
        <div className="space-y-2">
          <RecommendRow label="🔥 고빈도" numbers={recommendations.highFreq} color="text-orange-400" />
          <RecommendRow label="❄️ 미출현" numbers={recommendations.lowFreq} color="text-blue-400" />
          <RecommendRow label="🤖 AI 혼합" numbers={recommendations.mixed} color="text-violet-400" />
          <RecommendRow label="🎲 완전랜덤" numbers={recommendations.random} color="text-zinc-400" />
        </div>
      </div>

      {/* 빈도 분석 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">🔥 자주 나온 번호</p>
          <div className="space-y-1.5">
            {frequency.top10.map(({ num, cnt }) => (
              <div key={num} className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${lottoColor(num)}`}>{num}</span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${(cnt / (frequency.top10[0]?.cnt || 1)) * 100}%` }} />
                </div>
                <span className="text-[10px] text-zinc-500 w-6 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">❄️ 안 나온 번호</p>
          <div className="space-y-1.5">
            {frequency.bottom10.map(({ num, cnt }) => (
              <div key={num} className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${lottoColor(num)}`}>{num}</span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${(cnt / (frequency.top10[0]?.cnt || 1)) * 100}%` }} />
                </div>
                <span className="text-[10px] text-zinc-500 w-6 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 즉석 번호 생성 */}
      <div className="bg-white/3 border border-white/6 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">즉석 번호 생성</p>
          <button onClick={addPick} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg font-medium transition-colors">
            번호 생성
          </button>
        </div>
        {picked.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">버튼을 눌러 번호를 생성하세요</p>
        ) : (
          <div className="space-y-2">
            {picked.map((nums, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-zinc-900/60 rounded-xl">
                <span className="text-[10px] text-zinc-600 w-4">{i + 1}</span>
                <div className="flex gap-1.5">
                  {nums.map((n) => (
                    <span key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${lottoColor(n)}`}>{n}</span>
                  ))}
                </div>
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

// ── 메인 페이지 ───────────────────────────────────────
const MAIN_TABS = [
  { key: "stock",     label: "국내 주식", icon: BarChart2 },
  { key: "usstock",   label: "미국 주식", icon: TrendingUp },
  { key: "crypto",    label: "암호화폐",  icon: Coins },
  { key: "forex",     label: "환율/원자재", icon: Globe },
  { key: "feargreed", label: "공포탐욕",  icon: Flame },
  { key: "lotto",     label: "로또",      icon: Ticket },
  { key: "community", label: "토론",  icon: MessageSquare },
] as const;

type MainTab = typeof MAIN_TABS[number]["key"];

export default function InvestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<MainTab>("stock");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [kospi, setKospi]         = useState<Stock[]>([]);
  const [kosdaq, setKosdaq]       = useState<Stock[]>([]);
  const [nasdaq, setNasdaq]       = useState<Stock[]>([]);
  const [sp500, setSp500]         = useState<Stock[]>([]);
  const [upbit, setUpbit]         = useState<Coin[]>([]);
  const [binance, setBinance]     = useState<Coin[]>([]);
  const [forex, setForex]         = useState<ForexItem[]>([]);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [lotto, setLotto]         = useState<LottoData | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s1, s2, s3, s4, c1, c2, fx, fg, lt] = await Promise.allSettled([
      fetch("/api/invest/stocks").then((r) => r.json()),
      fetch("/api/invest/kosdaq").then((r) => r.json()),
      fetch("/api/invest/us-stocks").then((r) => r.json()),
      fetch("/api/invest/sp500").then((r) => r.json()),
      fetch("/api/invest/crypto").then((r) => r.json()),
      fetch("/api/invest/binance").then((r) => r.json()),
      fetch("/api/invest/forex").then((r) => r.json()),
      fetch("/api/invest/fear-greed").then((r) => r.json()),
      fetch("/api/invest/lotto").then((r) => r.json()),
    ]);

    if (s1.status === "fulfilled") setKospi(s1.value.stocks ?? []);
    if (s2.status === "fulfilled") setKosdaq(s2.value.stocks ?? []);
    if (s3.status === "fulfilled") setNasdaq(s3.value.stocks ?? []);
    if (s4.status === "fulfilled") setSp500(s4.value.stocks ?? []);
    if (c1.status === "fulfilled") setUpbit(c1.value.coins ?? []);
    if (c2.status === "fulfilled") setBinance(c2.value.coins ?? []);
    if (fx.status === "fulfilled") { setForex(fx.value.forex ?? []); setCommodities(fx.value.commodities ?? []); }
    if (fg.status === "fulfilled") setFearGreed(fg.value);
    if (lt.status === "fulfilled") setLotto(lt.value);

    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchAll();
  }, [session, fetchAll]);

  useEffect(() => {
    if (!autoRefresh || !session) return;
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, session, fetchAll]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
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
                {new Date(updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${autoRefresh ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800/60 border-zinc-700 text-zinc-500"}`}>
              자동
            </button>
            <button onClick={fetchAll} disabled={loading}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200 disabled:opacity-40">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 메인 탭 — 가로 스크롤 */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-none">
          {MAIN_TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                tab === key ? "bg-white/8 text-zinc-100 border border-white/10" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 relative">
        {tab === "stock"     && <StockTab kospi={kospi} kosdaq={kosdaq} />}
        {tab === "usstock"   && <USStockTab nasdaq={nasdaq} sp500={sp500} />}
        {tab === "crypto"    && <CryptoTab upbit={upbit} binance={binance} />}
        {tab === "forex"     && <ForexTab forex={forex} commodities={commodities} />}
        {tab === "feargreed" && <FearGreedTab data={fearGreed} />}
        {tab === "lotto"     && <LottoTab data={lotto} />}
        {tab === "community" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-zinc-500 text-sm">종목 토론 게시판으로 이동합니다</p>
            <Link href="/invest/community"
              className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
              <MessageSquare size={15} /> 토론 게시판 열기
            </Link>
          </div>
        )}

        <p className="text-center text-[10px] text-zinc-700 mt-6">
          시세는 실시간이 아니며 참고용입니다 · 30초마다 자동 갱신
        </p>
      </main>
    </div>
  );
}
