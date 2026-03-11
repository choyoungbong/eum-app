"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Snapshot {
  date: string;  // YYYY-MM-DD
  value: number; // 평가금액
}

interface Props {
  assetData: { symbol: string; assetType: string; quantity: number; avgPrice: number }[];
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

// 투자 원금 계산
function calcInvested(assets: Props["assetData"]) {
  return assets.reduce((s, a) => s + a.quantity * a.avgPrice, 0);
}

// 간단한 SVG 라인차트
function LineChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 400; const h = 100; const pad = 4;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + ((max - v) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = [
    `${pad},${h - pad}`,
    ...data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + ((max - v) / range) * (h - pad * 2);
      return `${x},${y}`;
    }),
    `${w - pad},${h - pad}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#chartGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function PortfolioChart({ assetData }: Props) {
  // 실제로는 서버에서 히스토리를 저장해야 하지만
  // 현재는 로컬 세션 기반 시뮬레이션 (±3% 랜덤 변동)
  const [snapshots, setSnapshots]   = useState<Snapshot[]>([]);
  const [currentVal, setCurrentVal] = useState(0);
  const [period, setPeriod]         = useState<"1W" | "1M" | "3M">("1M");
  const initialized = useRef(false);

  useEffect(() => {
    const invested = calcInvested(assetData);
    if (invested === 0) return;

    // 시뮬레이션: 기간별 일수
    const days = period === "1W" ? 7 : period === "1M" ? 30 : 90;
    const now = new Date();
    const generated: Snapshot[] = [];

    let val = invested * (0.88 + Math.random() * 0.12); // 시작값 (약간 낮게)
    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      // 마지막 날은 현재 평가금액으로 수렴
      if (i === 0) val = invested * (0.95 + Math.random() * 0.15);
      else val *= (0.97 + Math.random() * 0.06); // ±3%
      generated.push({ date: d.toISOString().split("T")[0], value: Math.round(val) });
    }

    setSnapshots(generated);
    setCurrentVal(generated[generated.length - 1]?.value ?? 0);
    initialized.current = true;
  }, [period, assetData]);

  const invested  = calcInvested(assetData);
  const pnl       = currentVal - invested;
  const pnlRate   = invested > 0 ? (pnl / invested) * 100 : 0;
  const isUp      = pnl >= 0;
  const chartColor = isUp ? "#34d399" : "#f87171";
  const values     = snapshots.map((s) => s.value);

  if (invested === 0) return null;

  return (
    <div className="bg-white/3 border border-white/6 rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">수익률 추이</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-black text-zinc-100">{fmt(currentVal)}원</p>
            <p className="text-xs text-zinc-600 mt-0.5">투자원금 {fmt(Math.round(invested))}원</p>
          </div>
          <div className={`text-right ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            <div className="flex items-center gap-1 justify-end text-lg font-black">
              {isUp ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {isUp ? "+" : ""}{pnlRate.toFixed(2)}%
            </div>
            <p className="text-xs opacity-80">
              {isUp ? "+" : ""}{fmt(Math.round(pnl))}원
            </p>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="px-2 pb-1">
        <LineChart data={values} color={chartColor} />
      </div>

      {/* 날짜 범례 */}
      {snapshots.length > 0 && (
        <div className="flex justify-between px-4 pb-2 text-[9px] text-zinc-700">
          <span>{snapshots[0]?.date}</span>
          <span>오늘</span>
        </div>
      )}

      {/* 기간 선택 */}
      <div className="flex border-t border-white/5">
        {(["1W", "1M", "3M"] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-all ${
              period === p
                ? "text-zinc-100 bg-white/4"
                : "text-zinc-600 hover:text-zinc-400"
            }`}>
            {p === "1W" ? "1주" : p === "1M" ? "1개월" : "3개월"}
          </button>
        ))}
      </div>

      <p className="text-center text-[9px] text-zinc-700 pb-2">
        ※ 차트는 시뮬레이션 데이터입니다
      </p>
    </div>
  );
}
