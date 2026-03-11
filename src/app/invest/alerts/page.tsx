"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Bell, BellOff, RefreshCw, CheckCircle2, Edit2, X } from "lucide-react";
import InvestNav from "@/components/InvestNav";

interface WatchItem {
  id: string; assetType: string; symbol: string;
  name: string; targetPrice: number | null;
}

const fmt    = (n: number) => n.toLocaleString("ko-KR");
const fmtUSD = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [list,    setList]    = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result,  setResult]  = useState<{ checked: number; triggered: string[] } | null>(null);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/invest/watchlist");
    if (res.ok) { const d = await res.json(); setList(d.list ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { if (session) fetchList(); }, [session]);

  const handleCheck = async () => {
    setChecking(true); setResult(null);
    const res = await fetch("/api/invest/price-alert");
    if (res.ok) { const d = await res.json(); setResult(d); }
    setChecking(false);
  };

  const handleSetTarget = async (symbol: string) => {
    const price = parseFloat(editVal);
    if (!price || price <= 0) return;
    const item = list.find((i) => i.symbol === symbol);
    if (!item) return;
    await fetch("/api/invest/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, targetPrice: price }),
    });
    setList((prev) => prev.map((i) => i.symbol === symbol ? { ...i, targetPrice: price } : i));
    setEditId(null); setEditVal("");
  };

  const handleRemoveTarget = async (item: WatchItem) => {
    await fetch("/api/invest/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, targetPrice: null }),
    });
    setList((prev) => prev.map((i) => i.id === item.id ? { ...i, targetPrice: null } : i));
  };

  const withTarget    = list.filter((i) => i.targetPrice !== null);
  const withoutTarget = list.filter((i) => i.targetPrice === null);

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
            <Link href="/invest/watchlist" className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-500 to-red-500 flex items-center justify-center">
                <Bell size={13} className="text-white" />
              </div>
              <h1 className="text-lg font-bold">가격 알림 관리</h1>
            </div>
          </div>
          <button onClick={handleCheck} disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
            <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
            {checking ? "확인 중..." : "목표가 확인"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-5">
        {/* 확인 결과 */}
        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
            result.triggered.length > 0
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-zinc-800/40 border-zinc-700"
          }`}>
            <CheckCircle2 size={16} className={result.triggered.length > 0 ? "text-emerald-400 shrink-0 mt-0.5" : "text-zinc-600 shrink-0 mt-0.5"} />
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                {result.triggered.length > 0
                  ? `${result.triggered.length}개 종목이 목표가에 도달했습니다!`
                  : "목표가에 도달한 종목이 없습니다"
                }
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{result.checked}개 종목 확인 완료</p>
              {result.triggered.length > 0 && (
                <p className="text-xs text-emerald-400 mt-1">{result.triggered.join(", ")}</p>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="animate-pulse h-16 bg-white/3 rounded-2xl border border-white/4" />)}</div>
        ) : (
          <>
            {/* 목표가 설정된 종목 */}
            {withTarget.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2 px-1">
                  알림 활성 <span className="text-zinc-500 ml-1">{withTarget.length}</span>
                </p>
                <div className="space-y-2">
                  {withTarget.map((item) => {
                    const isUS = item.assetType === "STOCK_US";
                    return (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-yellow-500/4 border border-yellow-500/15 rounded-2xl">
                        <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                          <Bell size={14} className="text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-zinc-200">{item.name}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{item.symbol}</p>
                        </div>
                        {editId === item.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <input type="number" value={editVal} onChange={(e)=>setEditVal(e.target.value)}
                              className="w-24 px-2 py-1.5 bg-zinc-800 border border-violet-500 rounded-lg outline-none text-xs text-zinc-100"
                              autoFocus onKeyDown={(e)=>e.key==="Enter"&&handleSetTarget(item.symbol)} />
                            <button onClick={()=>handleSetTarget(item.symbol)}
                              className="px-2 py-1.5 bg-violet-600 text-white rounded-lg text-xs">확인</button>
                            <button onClick={()=>{setEditId(null);setEditVal("");}} className="p-1.5 text-zinc-600 hover:text-zinc-400">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-yellow-400">
                              {isUS ? fmtUSD(item.targetPrice!) : `${fmt(item.targetPrice!)}원`}
                            </span>
                            <button onClick={()=>{setEditId(item.id);setEditVal(String(item.targetPrice));}}
                              className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-600 hover:text-zinc-400 transition-colors">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={()=>handleRemoveTarget(item)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors">
                              <BellOff size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 목표가 미설정 */}
            {withoutTarget.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-2 px-1">
                  알림 미설정 <span className="text-zinc-500 ml-1">{withoutTarget.length}</span>
                </p>
                <div className="space-y-2">
                  {withoutTarget.map((item) => {
                    const isUS = item.assetType === "STOCK_US";
                    return (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-white/3 border border-white/6 rounded-2xl">
                        <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                          <BellOff size={14} className="text-zinc-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-zinc-400">{item.name}</p>
                          <p className="text-[10px] text-zinc-700 mt-0.5">{item.symbol}</p>
                        </div>
                        {editId === item.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <input type="number" value={editVal} onChange={(e)=>setEditVal(e.target.value)}
                              placeholder={isUS?"200.00":"90000"}
                              className="w-24 px-2 py-1.5 bg-zinc-800 border border-violet-500 rounded-lg outline-none text-xs text-zinc-100"
                              autoFocus onKeyDown={(e)=>e.key==="Enter"&&handleSetTarget(item.symbol)} />
                            <button onClick={()=>handleSetTarget(item.symbol)}
                              className="px-2 py-1.5 bg-violet-600 text-white rounded-lg text-xs">설정</button>
                            <button onClick={()=>{setEditId(null);setEditVal("");}} className="p-1.5 text-zinc-600"><X size={12} /></button>
                          </div>
                        ) : (
                          <button onClick={()=>{setEditId(item.id);setEditVal("");}}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs rounded-xl transition-colors">
                            <Bell size={11} /> 목표가 설정
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {list.length === 0 && (
              <div className="text-center py-20">
                <p className="text-zinc-600 text-sm">관심종목을 추가하면 여기서 목표가를 관리할 수 있어요</p>
                <Link href="/invest/watchlist"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm transition-colors">
                  관심종목 추가
                </Link>
              </div>
            )}
          </>
        )}
      </main>
      <InvestNav />
    </div>
  );
}
