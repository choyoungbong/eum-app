"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Star, Plus, Trash2, Bell, BellOff,
  TrendingUp, TrendingDown, BarChart2, Coins, X, RefreshCw,
} from "lucide-react";

interface WatchItem {
  id: string; assetType: string; symbol: string;
  name: string; targetPrice: number | null; createdAt: string;
}
interface PriceInfo { price: number; changeRate: number; }

const fmt    = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  STOCK_KR: { label: "국내",   icon: BarChart2,  color: "text-blue-400",   bg: "bg-blue-500/10"   },
  STOCK_US: { label: "미국",   icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10" },
  CRYPTO:   { label: "코인",   icon: Coins,      color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

// ── 종목 추가 모달 ─────────────────────────────────────
function AddModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetType,   setAssetType]   = useState("STOCK_KR");
  const [symbol,      setSymbol]      = useState("");
  const [name,        setName]        = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [saving,      setSaving]      = useState(false);

  const handleSave = async () => {
    if (!symbol.trim() || !name.trim()) { alert("심볼과 종목명을 입력하세요"); return; }
    setSaving(true);
    const res = await fetch("/api/invest/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType, symbol: symbol.trim().toUpperCase(), name: name.trim(),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      }),
    });
    setSaving(false);
    if (res.ok) { onSuccess(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-100">관심종목 추가</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500"><X size={16} /></button>
        </div>

        {/* 자산 유형 */}
        <div className="flex gap-2">
          {Object.entries(TYPE_META).map(([key, m]) => {
            const Icon = m.icon;
            return (
              <button key={key} onClick={() => setAssetType(key)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs border transition-all ${
                  assetType === key ? `${m.bg} ${m.color} border-current/20` : "bg-zinc-800/60 text-zinc-500 border-zinc-700"
                }`}>
                <Icon size={14} />{m.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-zinc-600 mb-1.5">심볼</p>
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

        <div>
          <p className="text-[10px] text-zinc-600 mb-1.5">
            목표가 <span className="text-zinc-700">(선택 · 도달 시 알림)</span>
          </p>
          <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)}
            placeholder={assetType === "STOCK_US" ? "200.00" : "90000"}
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────
export default function WatchlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [list,      setList]      = useState<WatchItem[]>([]);
  const [prices,    setPrices]    = useState<Record<string, PriceInfo>>({});
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/invest/watchlist");
    if (res.ok) { const d = await res.json(); setList(d.list ?? []); }
    setLoading(false);
  }, []);

  const fetchPrices = useCallback(async () => {
    setRefreshing(true);
    const [kr, us, coin] = await Promise.allSettled([
      fetch("/api/invest/stocks").then((r) => r.json()),
      fetch("/api/invest/us-stocks").then((r) => r.json()),
      fetch("/api/invest/crypto").then((r) => r.json()),
    ]);
    const map: Record<string, PriceInfo> = {};
    const addStocks = (items: any[]) => items?.forEach((s) => {
      const key = s.symbol?.replace(".KS","").replace(".KQ","");
      map[key] = { price: s.price, changeRate: s.changeRate };
    });
    const addCoins = (items: any[]) => items?.forEach((c) => {
      map[c.symbol] = { price: c.price, changeRate: c.changeRate };
    });
    if (kr.status  === "fulfilled") addStocks(kr.value.stocks  ?? []);
    if (us.status  === "fulfilled") addStocks(us.value.stocks  ?? []);
    if (coin.status === "fulfilled") addCoins(coin.value.coins ?? []);
    setPrices(map);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (session) { fetchList(); fetchPrices(); } }, [session]);

  const handleDelete = async (symbol: string, name: string) => {
    if (!confirm(`${name}을(를) 관심종목에서 삭제하시겠습니까?`)) return;
    await fetch(`/api/invest/watchlist?symbol=${symbol}`, { method: "DELETE" });
    setList((prev) => prev.filter((i) => i.symbol !== symbol));
  };

  const getPriceInfo = (item: WatchItem) => {
    const key = item.symbol.replace(".KS","").replace(".KQ","");
    return prices[key] ?? null;
  };

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Star size={13} className="text-white" />
              </div>
              <h1 className="text-lg font-bold">관심종목</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPrices} disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors">
              <Plus size={13} /> 추가
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-20 bg-white/3 rounded-2xl border border-white/4" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
              <Star size={28} className="text-zinc-700" />
            </div>
            <p className="text-zinc-500 font-medium">관심종목이 없습니다</p>
            <p className="text-zinc-700 text-xs mt-1">관심 있는 종목을 추가해보세요</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
              <Plus size={14} /> 종목 추가
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((item) => {
              const meta   = TYPE_META[item.assetType] ?? TYPE_META.STOCK_KR;
              const Icon   = meta.icon;
              const pi     = getPriceInfo(item);
              const isUS   = item.assetType === "STOCK_US";
              const up     = (pi?.changeRate ?? 0) > 0;
              const down   = (pi?.changeRate ?? 0) < 0;
              const reachedTarget = item.targetPrice && pi && pi.price >= item.targetPrice;

              return (
                <div key={item.id}
                  className={`group flex items-center gap-4 p-4 border rounded-2xl transition-all ${
                    reachedTarget
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-white/3 hover:bg-white/5 border-white/6 hover:border-white/10"
                  }`}>
                  {/* 아이콘 */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                    <Icon size={16} className={meta.color} />
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-zinc-200">{item.name}</p>
                      <span className="text-[9px] text-zinc-600">{item.symbol}</span>
                      {reachedTarget && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-md font-semibold">목표 도달</span>
                      )}
                    </div>
                    {item.targetPrice ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Bell size={9} className="text-yellow-500" />
                        <span className="text-[10px] text-zinc-600">
                          목표가 {isUS ? fmtUSD(item.targetPrice) : `${fmt(item.targetPrice)}원`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <BellOff size={9} className="text-zinc-700" />
                        <span className="text-[10px] text-zinc-700">목표가 미설정</span>
                      </div>
                    )}
                  </div>

                  {/* 현재가 */}
                  <div className="text-right shrink-0">
                    {pi ? (
                      <>
                        <p className="text-sm font-bold text-zinc-100">
                          {isUS ? fmtUSD(pi.price) : `${fmt(pi.price)}원`}
                        </p>
                        <div className={`flex items-center justify-end gap-0.5 text-xs font-semibold ${
                          up ? "text-emerald-400" : down ? "text-red-400" : "text-zinc-500"
                        }`}>
                          {up ? <TrendingUp size={10} /> : down ? <TrendingDown size={10} /> : null}
                          {up ? "+" : ""}{pi.changeRate.toFixed(2)}%
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-600">시세 없음</p>
                    )}
                  </div>

                  {/* 삭제 */}
                  <button onClick={() => handleDelete(item.symbol, item.name)}
                    className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSuccess={fetchList} />}
    </div>
  );
}
