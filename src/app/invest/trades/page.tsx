"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Plus, Trash2, ArrowUpRight, ArrowDownRight,
  BarChart2, Coins, TrendingUp, X, Receipt,
} from "lucide-react";

interface Trade {
  id: string; assetType: string; symbol: string; name: string;
  side: "BUY" | "SELL"; quantity: number; price: number;
  fee: number; memo: string | null; tradedAt: string; createdAt: string;
}

const fmt    = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
  STOCK_KR: { icon: BarChart2,  color: "text-blue-400",   bg: "bg-blue-500/10"   },
  STOCK_US: { icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10" },
  CRYPTO:   { icon: Coins,      color: "text-yellow-400", bg: "bg-yellow-500/10" },
};

// ── 거래 추가 모달 ─────────────────────────────────────
function AddTradeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetType, setAssetType] = useState("STOCK_KR");
  const [side,      setSide]      = useState<"BUY" | "SELL">("BUY");
  const [symbol,    setSymbol]    = useState("");
  const [name,      setName]      = useState("");
  const [quantity,  setQuantity]  = useState("");
  const [price,     setPrice]     = useState("");
  const [fee,       setFee]       = useState("");
  const [memo,      setMemo]      = useState("");
  const [tradedAt,  setTradedAt]  = useState(new Date().toISOString().slice(0, 16));
  const [saving,    setSaving]    = useState(false);

  const total = quantity && price ? parseFloat(quantity) * parseFloat(price) : 0;
  const isUS  = assetType === "STOCK_US";

  const handleSave = async () => {
    if (!symbol || !name || !quantity || !price) { alert("필수 항목을 입력하세요"); return; }
    setSaving(true);
    const res = await fetch("/api/invest/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetType, symbol: symbol.trim().toUpperCase(), name: name.trim(),
        side, quantity: parseFloat(quantity), price: parseFloat(price),
        fee: fee ? parseFloat(fee) : 0, memo: memo || null,
        tradedAt: new Date(tradedAt).toISOString(),
      }),
    });
    setSaving(false);
    if (res.ok) { onSuccess(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-100">거래 기록 추가</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500"><X size={16} /></button>
        </div>

        {/* 매수/매도 */}
        <div className="flex gap-2">
          {(["BUY", "SELL"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                side === s
                  ? s === "BUY"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                  : "bg-zinc-800/60 text-zinc-500 border-zinc-700"
              }`}>
              {s === "BUY" ? "📈 매수" : "📉 매도"}
            </button>
          ))}
        </div>

        {/* 자산 유형 */}
        <div className="flex gap-2">
          {["STOCK_KR", "STOCK_US", "CRYPTO"].map((k) => (
            <button key={k} onClick={() => setAssetType(k)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-all ${
                assetType === k ? "bg-white/8 text-zinc-200 border-white/15" : "text-zinc-600 border-zinc-800"
              }`}>
              {k === "STOCK_KR" ? "국내 주식" : k === "STOCK_US" ? "미국 주식" : "코인"}
            </button>
          ))}
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
              placeholder={assetType === "STOCK_KR" ? "삼성전자" : "애플"}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-zinc-600 mb-1.5">수량</p>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 mb-1.5">{side === "BUY" ? "매수가" : "매도가"} {isUS ? "(USD)" : "(KRW)"}</p>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
              placeholder={isUS ? "150.00" : "75000"}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-zinc-600 mb-1.5">수수료 {isUS ? "(USD)" : "(KRW)"}</p>
            <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0"
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 mb-1.5">거래일시</p>
            <input type="datetime-local" value={tradedAt} onChange={(e) => setTradedAt(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-xs text-zinc-100 transition-colors" />
          </div>
        </div>

        <div>
          <p className="text-[10px] text-zinc-600 mb-1.5">메모 (선택)</p>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="거래 메모"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />
        </div>

        {/* 거래 금액 요약 */}
        {total > 0 && (
          <div className={`p-3 rounded-xl border text-center ${
            side === "BUY" ? "bg-emerald-500/5 border-emerald-500/15" : "bg-red-500/5 border-red-500/15"
          }`}>
            <p className="text-[10px] text-zinc-600 mb-0.5">{side === "BUY" ? "총 매수금액" : "총 매도금액"}</p>
            <p className={`text-sm font-bold ${side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
              {isUS ? fmtUSD(total) : `${fmt(Math.round(total))}원`}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-white/4 transition-all">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors">
            {saving ? "저장 중..." : "기록 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────
export default function TradesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [trades,  setTrades]  = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter,  setFilter]  = useState<"ALL" | "BUY" | "SELL">("ALL");

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/invest/trades");
    if (res.ok) { const d = await res.json(); setTrades(d.trades ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { if (session) fetchTrades(); }, [session]);

  const handleDelete = async (id: string) => {
    if (!confirm("거래 내역을 삭제하시겠습니까?")) return;
    await fetch(`/api/invest/trades?id=${id}`, { method: "DELETE" });
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  const filtered = trades.filter((t) => filter === "ALL" || t.side === filter);

  // 통계
  const totalBuy  = trades.filter((t) => t.side === "BUY" ).reduce((s, t) => s + t.price * t.quantity, 0);
  const totalSell = trades.filter((t) => t.side === "SELL").reduce((s, t) => s + t.price * t.quantity, 0);
  const realized  = totalSell - trades.filter((t) => t.side === "SELL").reduce((s, t) => s + t.fee, 0);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Receipt size={13} className="text-white" />
              </div>
              <h1 className="text-lg font-bold">거래 내역</h1>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors">
            <Plus size={13} /> 기록 추가
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 요약 카드 */}
        {trades.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/3 border border-white/6 rounded-2xl p-4 text-center">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">총 매수</p>
              <p className="text-xs font-bold text-emerald-400">{fmt(Math.round(totalBuy))}원</p>
            </div>
            <div className="bg-white/3 border border-white/6 rounded-2xl p-4 text-center">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">총 매도</p>
              <p className="text-xs font-bold text-red-400">{fmt(Math.round(totalSell))}원</p>
            </div>
            <div className="bg-white/3 border border-white/6 rounded-2xl p-4 text-center">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">실현 손익</p>
              <p className={`text-xs font-bold ${realized >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {realized >= 0 ? "+" : ""}{fmt(Math.round(realized))}원
              </p>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="flex gap-1 bg-zinc-900/60 rounded-xl p-1 border border-white/5">
          {(["ALL", "BUY", "SELL"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f ? "bg-white/8 text-zinc-100 border border-white/10" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {f === "ALL" ? "전체" : f === "BUY" ? "📈 매수" : "📉 매도"}
            </button>
          ))}
        </div>

        {/* 거래 목록 */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-20 bg-white/3 rounded-2xl border border-white/4" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
              <Receipt size={28} className="text-zinc-700" />
            </div>
            <p className="text-zinc-500 font-medium">거래 내역이 없습니다</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
              <Plus size={14} /> 첫 거래 기록
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((trade) => {
              const meta  = TYPE_META[trade.assetType] ?? TYPE_META.STOCK_KR;
              const Icon  = meta.icon;
              const isUS  = trade.assetType === "STOCK_US";
              const total = trade.price * trade.quantity;
              const d     = new Date(trade.tradedAt);

              return (
                <div key={trade.id}
                  className="group flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
                  {/* 아이콘 */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative ${meta.bg}`}>
                    <Icon size={16} className={meta.color} />
                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                      trade.side === "BUY" ? "bg-emerald-500" : "bg-red-500"
                    }`}>
                      {trade.side === "BUY"
                        ? <ArrowUpRight size={9} className="text-white" />
                        : <ArrowDownRight size={9} className="text-white" />
                      }
                    </span>
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-zinc-200">{trade.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                        trade.side === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>{trade.side === "BUY" ? "매수" : "매도"}</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {trade.quantity}주 × {isUS ? fmtUSD(trade.price) : `${fmt(trade.price)}원`}
                      {trade.fee > 0 && ` · 수수료 ${isUS ? fmtUSD(trade.fee) : `${fmt(trade.fee)}원`}`}
                    </p>
                    {trade.memo && <p className="text-[10px] text-zinc-700 mt-0.5">"{trade.memo}"</p>}
                  </div>

                  {/* 금액 + 날짜 */}
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${trade.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                      {trade.side === "BUY" ? "-" : "+"}{isUS ? fmtUSD(total) : `${fmt(Math.round(total))}원`}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      {" "}{d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* 삭제 */}
                  <button onClick={() => handleDelete(trade.id)}
                    className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAdd && <AddTradeModal onClose={() => setShowAdd(false)} onSuccess={fetchTrades} />}
    </div>
  );
}
