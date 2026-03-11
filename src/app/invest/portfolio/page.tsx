"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Plus, Trash2, TrendingUp, TrendingDown,
  BarChart2, Coins, Globe, X, Wallet, PieChart,
  ArrowUpRight, ArrowDownRight, RefreshCw,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import InvestNav from "@/components/InvestNav";

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
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

const ASSET_TYPES = [
  { key: "STOCK_KR", label: "국내 주식", icon: BarChart2, color: "text-blue-400",    bg: "bg-blue-500/10" },
  { key: "STOCK_US", label: "미국 주식", icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10" },
  { key: "CRYPTO",   label: "암호화폐", icon: Coins,      color: "text-yellow-400", bg: "bg-yellow-500/10" },
];

// ── 종목 추가 모달 ─────────────────────────────────────
function AddAssetModal({
  portfolioId, onClose, onSuccess,
}: { portfolioId: string; onClose: () => void; onSuccess: () => void }) {
  const [assetType, setAssetType] = useState("STOCK_KR");
  const [symbol,   setSymbol]    = useState("");
  const [name,     setName]      = useState("");
  const [quantity, setQuantity]  = useState("");
  const [avgPrice, setAvgPrice]  = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showRebalance, setShowRebalance] = useState(false);
  const [rebalanceText, setRebalanceText] = useState("");
  const [rebalancing,   setRebalancing]   = useState(false);
  const rebalanceRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!symbol.trim() || !name.trim() || !quantity || !avgPrice) {
      toast.warning("모든 항목을 입력하세요"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invest/portfolio/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId, assetType,
          symbol: symbol.trim().toUpperCase(),
          name: name.trim(),
          quantity: parseFloat(quantity),
          avgPrice: parseFloat(avgPrice),
        }),
      });
      if (res.ok) { toast.success("종목이 추가되었습니다"); onSuccess(); onClose(); }
      else { const d = await res.json(); toast.error(d.error ?? "추가 실패"); }
    } catch { toast.error("추가 중 오류가 발생했습니다"); }
    finally { setSubmitting(false); }
  };

  const handleRebalance = async () => {
    if (!activePortfolio) return;
    setRebalanceText(""); setShowRebalance(true); setRebalancing(true);
    const res = await fetch("/api/invest/rebalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioId: activePortfolio.id }),
    });
    if (!res.ok || !res.body) { setRebalancing(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setRebalanceText((prev) => prev + decoder.decode(value, { stream: true }));
      rebalanceRef.current?.scrollTo({ top: rebalanceRef.current.scrollHeight, behavior: "smooth" });
    }
    setRebalancing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h3 className="font-semibold text-zinc-100">종목 추가</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-300 transition-all">
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
                    assetType === key ? `${bg} ${color} border-current/20` : "bg-zinc-800/60 text-zinc-500 border-zinc-700"
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
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)}
                placeholder={assetType === "STOCK_KR" ? "005930" : assetType === "STOCK_US" ? "AAPL" : "BTC"}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">종목명</p>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder={assetType === "STOCK_KR" ? "삼성전자" : assetType === "STOCK_US" ? "애플" : "비트코인"}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
          </div>

          {/* 수량 + 평균단가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">보유 수량</p>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 mb-1.5">
                평균 단가 {assetType === "STOCK_US" ? "(USD)" : "(KRW)"}
              </p>
              <input type="number" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)}
                placeholder={assetType === "STOCK_US" ? "150.00" : "75000"}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
            </div>
          </div>

          {/* 예상 투자금 */}
          {quantity && avgPrice && (
            <div className="p-3 bg-zinc-800/50 rounded-xl border border-white/4 text-center">
              <p className="text-[10px] text-zinc-600 mb-0.5">총 투자금</p>
              <p className="text-sm font-bold text-zinc-200">
                {assetType === "STOCK_US"
                  ? fmtUSD(parseFloat(quantity) * parseFloat(avgPrice))
                  : `${fmt(Math.round(parseFloat(quantity) * parseFloat(avgPrice)))}원`
                }
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

// ── 메인 페이지 ───────────────────────────────────────
export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { confirmDialog, openConfirm } = useConfirm();

  const [portfolios,    setPortfolios]    = useState<Portfolio[]>([]);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [priceMap,      setPriceMap]      = useState<PriceMap>({});
  const [loading,       setLoading]       = useState(true);
  const [priceLoading,  setPriceLoading]  = useState(false);
  const [showAddAsset,  setShowAddAsset]  = useState(false);
  const [showNewPort,   setShowNewPort]   = useState(false);
  const [newPortName,   setNewPortName]   = useState("");
  const [creating,      setCreating]      = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

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
    } catch { toast.error("포트폴리오를 불러오지 못했습니다"); }
    finally { setLoading(false); }
  }, [activeId]);

  useEffect(() => { if (session) fetchPortfolios(); }, [session]);

  // 현재가 조회 (보유 종목 기반)
  const fetchPrices = useCallback(async (portfolio: Portfolio) => {
    if (!portfolio?.assets.length) return;
    setPriceLoading(true);
    try {
      const [stocks, usStocks, crypto] = await Promise.allSettled([
        fetch("/api/invest/stocks").then((r) => r.json()),
        fetch("/api/invest/us-stocks").then((r) => r.json()),
        fetch("/api/invest/crypto").then((r) => r.json()),
      ]);
      const map: PriceMap = {};
      if (stocks.status   === "fulfilled") (stocks.value.stocks   ?? []).forEach((s: any) => { map[s.symbol.replace(".KS","")] = s.price; });
      if (usStocks.status === "fulfilled") (usStocks.value.stocks ?? []).forEach((s: any) => { map[s.symbol] = s.price; });
      if (crypto.status   === "fulfilled") (crypto.value.coins    ?? []).forEach((c: any) => { map[c.symbol] = c.price; });
      setPriceMap(map);
    } finally { setPriceLoading(false); }
  }, []);

  const activePortfolio = portfolios.find((p) => p.id === activeId) ?? null;

  useEffect(() => {
    if (activePortfolio) fetchPrices(activePortfolio);
  }, [activeId, portfolios]);

  const handleCreatePortfolio = async () => {
    if (!newPortName.trim()) { toast.warning("포트폴리오 이름을 입력하세요"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/invest/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPortName.trim() }),
      });
      if (res.ok) {
        toast.success("포트폴리오가 생성되었습니다");
        setNewPortName(""); setShowNewPort(false);
        await fetchPortfolios();
      } else toast.error("생성 실패");
    } finally { setCreating(false); }
  };

  const handleDeletePortfolio = (id: string) => {
    openConfirm({
      title: "포트폴리오 삭제",
      message: "포트폴리오와 모든 종목이 삭제됩니다. 계속하시겠습니까?",
      confirmLabel: "삭제", variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/invest/portfolio?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("삭제되었습니다");
          setActiveId(null);
          fetchPortfolios();
        } else toast.error("삭제 실패");
      },
    });
  };

  const handleDeleteAsset = (id: string, name: string) => {
    openConfirm({
      title: `${name} 삭제`,
      message: "보유 종목에서 삭제하시겠습니까?",
      confirmLabel: "삭제", variant: "danger",
      onConfirm: async () => {
        const res = await fetch(`/api/invest/portfolio/assets?id=${id}`, { method: "DELETE" });
        if (res.ok) { toast.success("삭제되었습니다"); fetchPortfolios(); }
        else toast.error("삭제 실패");
      },
    });
  };

  // 손익 계산
  const calcPnL = (asset: Asset) => {
    const symbolKey = asset.assetType === "STOCK_KR"
      ? asset.symbol.replace(".KS", "").replace(".KQ", "")
      : asset.symbol;
    const currentPrice = priceMap[symbolKey] ?? 0;
    if (!currentPrice) return null;
    const invested  = asset.avgPrice * asset.quantity;
    const current   = currentPrice * asset.quantity;
    const pnl       = current - invested;
    const pnlRate   = (pnl / invested) * 100;
    return { currentPrice, invested, current, pnl, pnlRate };
  };

  // 포트폴리오 전체 손익
  const totalStats = activePortfolio?.assets.reduce((acc, asset) => {
    const calc = calcPnL(asset);
    if (!calc) return acc;
    return {
      invested: acc.invested + calc.invested,
      current:  acc.current  + calc.current,
    };
  }, { invested: 0, current: 0 }) ?? null;

  const totalPnL     = totalStats ? totalStats.current - totalStats.invested : null;
  const totalPnLRate = totalStats && totalStats.invested > 0
    ? (totalPnL! / totalStats.invested) * 100 : null;

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {confirmDialog}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-blue-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
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
            <button onClick={() => activePortfolio && fetchPrices(activePortfolio)} disabled={priceLoading}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200 disabled:opacity-40">
              <RefreshCw size={15} className={priceLoading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowNewPort(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors">
              <Plus size={13} /> 새 포트폴리오
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-20 py-6 relative space-y-4">

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse h-20 bg-white/3 rounded-2xl border border-white/4" />
            ))}
          </div>
        ) : portfolios.length === 0 ? (
          /* 포트폴리오 없음 */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
              <PieChart size={28} className="text-zinc-700" />
            </div>
            <p className="text-zinc-500 font-medium">포트폴리오가 없습니다</p>
            <p className="text-zinc-700 text-xs mt-1">첫 번째 포트폴리오를 만들어보세요</p>
            <button onClick={() => setShowNewPort(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
              <Plus size={14} /> 포트폴리오 만들기
            </button>
          </div>
        ) : (
          <>
            {/* 포트폴리오 탭 선택 */}
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
                {/* 포트폴리오 요약 카드 */}
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
                    </div>
                    {totalPnL !== null && (
                      <div className={`text-right ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        <div className="flex items-center gap-1 justify-end">
                          {totalPnL >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          <span className="text-lg font-black">{fmtPct(totalPnLRate!)}</span>
                        </div>
                        <p className="text-xs mt-0.5 opacity-80">
                          {totalPnL >= 0 ? "+" : ""}{fmt(Math.round(totalPnL))}원
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-600">
                    {totalStats && (
                      <>
                        <span>투자금 <span className="text-zinc-400">{fmt(Math.round(totalStats.invested))}원</span></span>
                        <span>·</span>
                        <span>종목 <span className="text-zinc-400">{activePortfolio.assets.length}개</span></span>
                      </>
                    )}
                    <button onClick={() => handleDeletePortfolio(activePortfolio.id)}
                      className="ml-auto flex items-center gap-1 text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 size={11} /> 삭제
                    </button>
                  </div>
                </div>

                // 버튼 (요약 카드 아래):
                <button onClick={handleRebalance} disabled={rebalancing || !activePortfolio?.assets.length}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600/10 hover:bg-violet-600/15 border border-violet-500/20 hover:border-violet-500/40 rounded-2xl text-xs text-violet-400 font-semibold transition-all disabled:opacity-40">
                  <Sparkles size={14} className={rebalancing ? "animate-pulse" : ""} />
                  {rebalancing ? "AI 분석 중..." : "AI 리밸런싱 제안받기"}
                </button>

                {/* 종목 추가 버튼 */}
                <button onClick={() => setShowAddAsset(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 hover:border-violet-500/40 rounded-2xl text-xs text-zinc-600 hover:text-violet-400 transition-all">
                  <Plus size={14} /> 종목 추가
                </button>

                {/* 보유 종목 목록 */}
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
                              {asset.quantity}주 · 평균 {isUS ? fmtUSD(asset.avgPrice) : `${fmt(asset.avgPrice)}원`}
                            </p>
                          </div>

                          {/* 손익 */}
                          <div className="text-right shrink-0">
                            {calc ? (
                              <>
                                <p className="text-sm font-bold text-zinc-100">
                                  {isUS ? fmtUSD(calc.current) : `${fmt(Math.round(calc.current))}원`}
                                </p>
                                <div className={`flex items-center gap-0.5 justify-end text-xs font-semibold ${calc.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {calc.pnl >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                  {fmtPct(calc.pnlRate)}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-zinc-600">시세 없음</p>
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
              </>
            )}
          </>
        )}
      </main>

      {/* 새 포트폴리오 모달 */}
      {showNewPort && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowNewPort(false)}>
          <div className="bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-100 mb-4">새 포트폴리오</h3>
            <input value={newPortName} onChange={(e) => setNewPortName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreatePortfolio()}
              placeholder="포트폴리오 이름 (예: 장기투자, 단기매매)"
              autoFocus
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 mb-4 transition-colors" />
            <div className="flex gap-2">
              <button onClick={() => setShowNewPort(false)}
                className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">취소</button>
              <button onClick={handleCreatePortfolio} disabled={creating}
                className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
                {creating ? "생성 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 종목 추가 모달 */}
      {showAddAsset && activePortfolio && (
        <AddAssetModal
          portfolioId={activePortfolio.id}
          onClose={() => setShowAddAsset(false)}
          onSuccess={fetchPortfolios}
        />
      )}

      // AI 리밸런싱 결과 모달
      {showRebalance && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShowRebalance(false)}>
          <div className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl flex flex-col" style={{maxHeight:"85vh"}} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                <p className="font-semibold text-zinc-100 text-sm">AI 리밸런싱 제안</p>
              </div>
              <button onClick={()=>setShowRebalance(false)} className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500"><X size={16} /></button>
            </div>
            <div ref={rebalanceRef} className="flex-1 overflow-y-auto px-5 py-5">
              {rebalanceText.length === 0 && rebalancing && (
                <div className="flex items-center gap-2 text-zinc-500">
                  {[0,150,300].map(d=><div key={d} className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                  <span className="text-xs ml-1">포트폴리오를 분석하고 있습니다...</span>
                </div>
              )}
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{rebalanceText}</div>
              {rebalancing && <span className="inline-block w-2 h-4 bg-violet-500 rounded-sm animate-pulse ml-0.5" />}
            </div>
          </div>
        </div>
      )}
      <InvestNav />
    </div>
  );
}
