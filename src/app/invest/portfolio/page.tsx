"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronLeft, Plus, Trash2, TrendingUp, TrendingDown,
  BarChart2, Coins, Globe, X, Wallet, PieChart,
  ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles,
} from "lucide-react";
import InvestNav from "@/components/InvestNav";

const PortfolioChart = dynamic(() => import("@/components/PortfolioChart"), { ssr: false });

// ── 타입 ──────────────────────────────────────────────
interface Asset {
  id: string; portfolioId: string;
  assetType: string; symbol: string; name: string;
  quantity: number; avgPrice: number;
}
interface Portfolio {
  id: string; name: string; createdAt: string;
  assets: Asset[];
}
interface PriceMap { [symbol: string]: number; }

// ── 유틸 ──────────────────────────────────────────────
const fmt    = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

const ASSET_TYPES = [
  { key: "STOCK_KR", label: "국내 주식", icon: BarChart2,  color: "text-blue-400",   bg: "bg-blue-500/10"   },
  { key: "STOCK_US", label: "미국 주식", icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10" },
  { key: "CRYPTO",   label: "암호화폐", icon: Coins,      color: "text-yellow-400", bg: "bg-yellow-500/10" },
];

// ── 마크다운 렌더러 (리밸런싱 결과용) ─────────────────
function RenderMd({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return <h2 key={i} className="text-base font-black text-zinc-100 mt-4 mb-2">{line.replace(/^## /, "")}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} className="text-sm font-bold text-zinc-200 mt-3 mb-1.5">{line.replace(/^### /, "")}</h3>;
        if (line.startsWith("> "))
          return (
            <div key={i} className="flex gap-2 mt-3 p-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
              <p className="text-[11px] text-zinc-500">{line.replace(/^> /, "")}</p>
            </div>
          );
        if (line.startsWith("- ") || line.match(/^\d+\./))
          return <p key={i} className="text-sm text-zinc-300 leading-relaxed pl-2">{line}</p>;
        if (line === "") return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j} className="text-zinc-200 font-semibold">{p.slice(2, -2)}</strong>
            : p
        );
        return <p key={i} className="text-sm text-zinc-300 leading-relaxed">{parts}</p>;
      })}
    </div>
  );
}

// ── 종목 추가 모달 ─────────────────────────────────────
function AddAssetModal({
  portfolioId, onClose, onSuccess,
}: { portfolioId: string; onClose: () => void; onSuccess: () => void; }) {
  const [assetType, setAssetType] = useState("STOCK_KR");
  const [symbol,   setSymbol]    = useState("");
  const [name,     setName]      = useState("");
  const [quantity, setQuantity]  = useState("");
  const [avgPrice, setAvgPrice]  = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isUS = assetType === "STOCK_US";
  const total =
    quantity && avgPrice
      ? parseFloat(quantity) * parseFloat(avgPrice)
      : 0;

  const handleSubmit = async () => {
    if (!symbol.trim() || !name.trim() || !quantity || !avgPrice) {
      alert("모든 항목을 입력하세요"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invest/portfolio/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId,
          assetType,
          symbol:   symbol.trim().toUpperCase(),
          name:     name.trim(),
          quantity: parseFloat(quantity),
          avgPrice: parseFloat(avgPrice),
        }),
      });
      if (res.ok) { onSuccess(); onClose(); }
      else { const d = await res.json(); alert(d.error ?? "추가 실패"); }
    } catch { alert("추가 중 오류가 발생했습니다"); }
    finally { setSubmitting(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h3 className="font-semibold text-zinc-100">종목 추가</h3>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-300 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 자산 유형 */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">자산 유형</p>
            <div className="flex gap-2">
              {ASSET_TYPES.map(({ key, label, icon: Icon, color, bg }) => (
                <button key={key} onClick={() => setAssetType(key)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs border transition-all ${
                    assetType === key
                      ? `${bg} ${color} border-current/20`
                      : "bg-zinc-800/60 text-zinc-500 border-zinc-700"
                  }`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* 심볼 + 종목명 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">
                심볼 {assetType === "STOCK_KR" ? "(예: 005930)" : assetType === "STOCK_US" ? "(예: AAPL)" : "(예: BTC)"}
              </p>
              <input
                value={symbol} onChange={(e) => setSymbol(e.target.value)}
                placeholder={assetType === "STOCK_KR" ? "005930" : assetType === "STOCK_US" ? "AAPL" : "BTC"}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">종목명</p>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder={assetType === "STOCK_KR" ? "삼성전자" : assetType === "STOCK_US" ? "애플" : "비트코인"}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
          </div>

          {/* 수량 + 평균단가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">보유 수량</p>
              <input
                type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">
                평균 단가 {isUS ? "(USD)" : "(KRW)"}
              </p>
              <input
                type="number" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)}
                placeholder={isUS ? "150.00" : "75000"}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
          </div>

          {/* 총 투자금 미리보기 */}
          {total > 0 && (
            <div className="p-3 bg-zinc-800/50 rounded-xl border border-white/4 text-center">
              <p className="text-[10px] text-zinc-600 mb-0.5">총 투자금</p>
              <p className="text-sm font-bold text-zinc-200">
                {isUS ? fmtUSD(total) : `${fmt(Math.round(total))}원`}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">
            취소
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
            {submitting ? "추가 중..." : "종목 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 리밸런싱 모달 ──────────────────────────────────────
function RebalanceModal({
  portfolio, onClose,
}: { portfolio: Portfolio; onClose: () => void; }) {
  const [text,       setText]       = useState("");
  const [rebalancing, setRebalancing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const res = await fetch("/api/invest/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: portfolio.id }),
      });
      if (!res.ok || !res.body) { setRebalancing(false); return; }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
      if (!cancelled) setRebalancing(false);
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-100 text-sm">AI 리밸런싱 제안</p>
              <p className="text-[10px] text-zinc-600">{portfolio.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-300 transition-all">
            <X size={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
          {text.length === 0 && rebalancing ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex gap-1.5">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="text-xs text-zinc-600">포트폴리오를 분석하고 있습니다...</p>
            </div>
          ) : (
            <>
              <RenderMd text={text} />
              {rebalancing && (
                <span className="inline-block w-2 h-4 bg-violet-500 rounded-sm animate-pulse ml-0.5" />
              )}
            </>
          )}
        </div>

        {!rebalancing && (
          <div className="px-5 pb-5 shrink-0">
            <button onClick={onClose}
              className="w-full py-2.5 bg-white/4 hover:bg-white/6 border border-white/6 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 transition-all">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────
export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [portfolios,     setPortfolios]     = useState<Portfolio[]>([]);
  const [activeId,       setActiveId]       = useState<string | null>(null);
  const [priceMap,       setPriceMap]       = useState<PriceMap>({});
  const [loading,        setLoading]        = useState(true);
  const [priceLoading,   setPriceLoading]   = useState(false);
  const [showAddAsset,   setShowAddAsset]   = useState(false);
  const [showNewPort,    setShowNewPort]    = useState(false);
  const [showRebalance,  setShowRebalance]  = useState(false);
  const [newPortName,    setNewPortName]    = useState("");
  const [creating,       setCreating]       = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // ── 포트폴리오 목록 불러오기 ─────────────────────────
  const fetchPortfolios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invest/portfolio");
      if (res.ok) {
        const data = await res.json();
        const list: Portfolio[] = data.portfolios ?? [];
        setPortfolios(list);
        if (list.length > 0 && !activeId) setActiveId(list[0].id);
      }
    } catch { alert("포트폴리오를 불러오지 못했습니다"); }
    finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { if (session) fetchPortfolios(); }, [session]);

  // ── 현재가 조회 ───────────────────────────────────────
  const fetchPrices = useCallback(async (portfolio: Portfolio) => {
    if (!portfolio?.assets.length) return;
    setPriceLoading(true);
    try {
      const [krStocks, usStocks, crypto] = await Promise.allSettled([
        fetch("/api/invest/stocks").then((r) => r.json()),
        fetch("/api/invest/us-stocks").then((r) => r.json()),
        fetch("/api/invest/crypto").then((r) => r.json()),
      ]);
      const map: PriceMap = {};
      const addS = (items: any[]) => items?.forEach((s) => {
        map[s.symbol.replace(".KS","").replace(".KQ","")] = s.price;
      });
      const addC = (items: any[]) => items?.forEach((c) => { map[c.symbol] = c.price; });
      if (krStocks.status === "fulfilled") addS(krStocks.value.stocks ?? []);
      if (usStocks.status === "fulfilled") addS(usStocks.value.stocks ?? []);
      if (crypto.status   === "fulfilled") addC(crypto.value.coins   ?? []);
      setPriceMap(map);
    } finally { setPriceLoading(false); }
  }, []);

  const activePortfolio = portfolios.find((p) => p.id === activeId) ?? null;

  useEffect(() => {
    if (activePortfolio) fetchPrices(activePortfolio);
  }, [activeId, portfolios]);

  // ── 포트폴리오 생성 ───────────────────────────────────
  const handleCreatePortfolio = async () => {
    if (!newPortName.trim()) { alert("포트폴리오 이름을 입력하세요"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/invest/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPortName.trim() }),
      });
      if (res.ok) {
        setNewPortName(""); setShowNewPort(false);
        await fetchPortfolios();
      } else alert("생성 실패");
    } finally { setCreating(false); }
  };

  // ── 포트폴리오 삭제 ───────────────────────────────────
  const handleDeletePortfolio = async (id: string) => {
    if (!confirm("포트폴리오와 모든 종목이 삭제됩니다. 계속하시겠습니까?")) return;
    const res = await fetch(`/api/invest/portfolio?id=${id}`, { method: "DELETE" });
    if (res.ok) { setActiveId(null); fetchPortfolios(); }
    else alert("삭제 실패");
  };

  // ── 종목 삭제 ─────────────────────────────────────────
  const handleDeleteAsset = async (id: string, name: string) => {
    if (!confirm(`${name}을(를) 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/invest/portfolio/assets?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchPortfolios();
    else alert("삭제 실패");
  };

  // ── 손익 계산 ─────────────────────────────────────────
  const calcPnL = (asset: Asset) => {
    const key = asset.symbol.replace(".KS","").replace(".KQ","");
    const currentPrice = priceMap[key] ?? 0;
    if (!currentPrice) return null;
    const invested = asset.avgPrice * asset.quantity;
    const current  = currentPrice   * asset.quantity;
    const pnl      = current - invested;
    const pnlRate  = (pnl / invested) * 100;
    return { currentPrice, invested, current, pnl, pnlRate };
  };

  // ── 전체 포트폴리오 손익 ──────────────────────────────
  const totalStats = activePortfolio?.assets.reduce(
    (acc, asset) => {
      const calc = calcPnL(asset);
      if (!calc) return acc;
      return { invested: acc.invested + calc.invested, current: acc.current + calc.current };
    },
    { invested: 0, current: 0 }
  ) ?? null;

  const totalPnL     = totalStats ? totalStats.current - totalStats.invested : null;
  const totalPnLRate =
    totalStats && totalStats.invested > 0
      ? (totalPnL! / totalStats.invested) * 100
      : null;

  // ── 로딩 / 미인증 ─────────────────────────────────────
  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 배경 그라데이션 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-600/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invest"
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Wallet size={13} className="text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">포트폴리오</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => activePortfolio && fetchPrices(activePortfolio)}
              disabled={priceLoading}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200 disabled:opacity-40">
              <RefreshCw size={15} className={priceLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowNewPort(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors">
              <Plus size={13} /> 새 포트폴리오
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 relative space-y-4">

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse h-24 bg-white/3 rounded-2xl border border-white/4" />
            ))}
          </div>
        ) : portfolios.length === 0 ? (

          /* ── 비어있을 때 ─────────────────────────── */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
              <PieChart size={28} className="text-zinc-700" />
            </div>
            <p className="text-zinc-500 font-medium">포트폴리오가 없습니다</p>
            <p className="text-zinc-700 text-xs mt-1">첫 번째 포트폴리오를 만들어보세요</p>
            <button
              onClick={() => setShowNewPort(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
              <Plus size={14} /> 포트폴리오 만들기
            </button>
          </div>

        ) : (
          <>
            {/* ── 포트폴리오 탭 선택 ───────────────────── */}
            {portfolios.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {portfolios.map((p) => (
                  <button key={p.id} onClick={() => setActiveId(p.id)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      activeId === p.id
                        ? "bg-white/8 text-zinc-100 border-white/15"
                        : "text-zinc-500 border-zinc-800 hover:border-zinc-600"
                    }`}>
                    {p.name}
                    <span className="ml-1.5 text-zinc-600">{p.assets.length}</span>
                  </button>
                ))}
              </div>
            )}

            {activePortfolio && (
              <>
                {/* ── 요약 카드 ────────────────────────── */}
                <div className="bg-gradient-to-br from-violet-600/10 to-blue-600/10 border border-violet-500/20 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-zinc-500">{activePortfolio.name}</p>
                      <p className="text-2xl font-black text-zinc-100 mt-0.5">
                        {totalStats
                          ? `${fmt(Math.round(totalStats.current))}원`
                          : `${activePortfolio.assets.length}개 종목`
                        }
                      </p>
                      {totalStats && (
                        <p className="text-xs text-zinc-600 mt-0.5">
                          투자원금 {fmt(Math.round(totalStats.invested))}원
                        </p>
                      )}
                    </div>
                    {totalPnL !== null && totalPnLRate !== null && (
                      <div className={`text-right ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        <div className="flex items-center gap-1 justify-end text-lg font-black">
                          {totalPnL >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                          {fmtPct(totalPnLRate)}
                        </div>
                        <p className="text-xs opacity-80">
                          {totalPnL >= 0 ? "+" : ""}{fmt(Math.round(totalPnL))}원
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 하단 액션 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600">
                      {activePortfolio.assets.length}개 종목
                    </span>
                    <button
                      onClick={() => handleDeletePortfolio(activePortfolio.id)}
                      className="flex items-center gap-1 text-[11px] text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 size={11} /> 포트폴리오 삭제
                    </button>
                  </div>
                </div>

                {/* ── 수익률 차트 ──────────────────────── */}
                {activePortfolio.assets.length > 0 && (
                  <PortfolioChart
                    assetData={activePortfolio.assets.map((a) => ({
                      symbol:    a.symbol,
                      assetType: a.assetType,
                      quantity:  a.quantity,
                      avgPrice:  a.avgPrice,
                    }))}
                  />
                )}

                {/* ── AI 리밸런싱 버튼 ─────────────────── */}
                {activePortfolio.assets.length > 0 && (
                  <button
                    onClick={() => setShowRebalance(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600/10 hover:bg-violet-600/15 border border-violet-500/20 hover:border-violet-500/40 rounded-2xl text-xs text-violet-400 font-semibold transition-all">
                    <Sparkles size={14} />
                    AI 리밸런싱 제안받기
                  </button>
                )}

                {/* ── 종목 추가 버튼 ───────────────────── */}
                <button
                  onClick={() => setShowAddAsset(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl text-xs text-zinc-600 hover:text-violet-400 transition-all">
                  <Plus size={14} /> 종목 추가
                </button>

                {/* ── 보유 종목 목록 ───────────────────── */}
                {activePortfolio.assets.length === 0 ? (
                  <div className="text-center py-10 text-zinc-600 text-xs">
                    종목을 추가하면 수익률을 확인할 수 있습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activePortfolio.assets.map((asset) => {
                      const calc  = calcPnL(asset);
                      const aType = ASSET_TYPES.find((t) => t.key === asset.assetType);
                      const Icon  = aType?.icon ?? BarChart2;
                      const isUS  = asset.assetType === "STOCK_US";

                      return (
                        <div key={asset.id}
                          className="group flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">

                          {/* 아이콘 */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${aType?.bg ?? "bg-zinc-800"}`}>
                            <Icon size={16} className={aType?.color ?? "text-zinc-400"} />
                          </div>

                          {/* 종목 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-zinc-200">{asset.name}</p>
                              <span className="text-[9px] text-zinc-600">{asset.symbol}</span>
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-0.5">
                              {asset.quantity}주 · 평균{" "}
                              {isUS ? fmtUSD(asset.avgPrice) : `${fmt(asset.avgPrice)}원`}
                            </p>
                          </div>

                          {/* 손익 */}
                          <div className="text-right shrink-0">
                            {calc ? (
                              <>
                                <p className="text-sm font-bold text-zinc-100">
                                  {isUS ? fmtUSD(calc.current) : `${fmt(Math.round(calc.current))}원`}
                                </p>
                                <div className={`flex items-center gap-0.5 justify-end text-xs font-semibold ${
                                  calc.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}>
                                  {calc.pnl >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                  {fmtPct(calc.pnlRate)}
                                </div>
                                <p className={`text-[10px] ${calc.pnl >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                                  {calc.pnl >= 0 ? "+" : ""}{isUS ? fmtUSD(calc.pnl) : `${fmt(Math.round(calc.pnl))}원`}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-zinc-600">
                                {priceLoading ? "조회 중..." : "시세 없음"}
                              </p>
                            )}
                          </div>

                          {/* 삭제 버튼 */}
                          <button
                            onClick={() => handleDeleteAsset(asset.id, asset.name)}
                            className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── 자산 배분 요약 ───────────────────── */}
                {activePortfolio.assets.length > 0 && totalStats && totalStats.current > 0 && (
                  <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">자산 배분</p>
                    <div className="space-y-2">
                      {ASSET_TYPES.map(({ key, label, color, bg }) => {
                        const typeAssets = activePortfolio.assets.filter((a) => a.assetType === key);
                        if (typeAssets.length === 0) return null;
                        const typeValue = typeAssets.reduce((s, a) => {
                          const calc = calcPnL(a);
                          return s + (calc ? calc.current : a.avgPrice * a.quantity);
                        }, 0);
                        const ratio = (typeValue / totalStats.current) * 100;
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`font-medium ${color}`}>{label}</span>
                              <span className="text-zinc-500">{ratio.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${bg.replace("bg-", "bg-").replace("/10", "/60")}`}
                                style={{ width: `${ratio}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── 새 포트폴리오 모달 ────────────────────────── */}
      {showNewPort && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowNewPort(false)}>
          <div
            className="bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-100 mb-4">새 포트폴리오</h3>
            <input
              value={newPortName}
              onChange={(e) => setNewPortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePortfolio()}
              placeholder="포트폴리오 이름 (예: 장기투자, 단기매매)"
              autoFocus
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 mb-4 transition-colors" />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewPort(false)}
                className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">
                취소
              </button>
              <button
                onClick={handleCreatePortfolio} disabled={creating}
                className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
                {creating ? "생성 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 종목 추가 모달 ────────────────────────────── */}
      {showAddAsset && activePortfolio && (
        <AddAssetModal
          portfolioId={activePortfolio.id}
          onClose={() => setShowAddAsset(false)}
          onSuccess={fetchPortfolios}
        />
      )}

      {/* ── AI 리밸런싱 모달 ──────────────────────────── */}
      {showRebalance && activePortfolio && (
        <RebalanceModal
          portfolio={activePortfolio}
          onClose={() => setShowRebalance(false)}
        />
      )}

      <InvestNav />
    </div>
  );
}
