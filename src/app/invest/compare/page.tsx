"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, ArrowLeftRight, X } from "lucide-react";
import InvestNav from "@/components/InvestNav";

interface StockInput { symbol: string; name: string; price: string; changeRate: string; assetType: string; }
const EMPTY: StockInput = { symbol:"", name:"", price:"", changeRate:"", assetType:"STOCK_KR" };

export default function ComparePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [a,        setA]        = useState<StockInput>({ ...EMPTY });
  const [b,        setB]        = useState<StockInput>({ ...EMPTY });
  const [text,     setText]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const handleCompare = async () => {
    if (!a.symbol||!a.name||!b.symbol||!b.name) { alert("두 종목 정보를 모두 입력하세요"); return; }
    setText(""); setDone(false); setLoading(true);
    const res = await fetch("/api/invest/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        a: { ...a, price: parseFloat(a.price)||0, changeRate: parseFloat(a.changeRate)||0 },
        b: { ...b, price: parseFloat(b.price)||0, changeRate: parseFloat(b.changeRate)||0 },
      }),
    });
    if (!res.ok||!res.body) { setLoading(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done: d, value } = await reader.read();
      if (d) break;
      setText((prev) => prev + decoder.decode(value, { stream: true }));
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    setDone(true); setLoading(false);
  };

  const renderMd = (raw: string) => raw.split("\n").map((line, i) => {
    if (line.startsWith("## ")) return <h2 key={i} className="text-base font-black text-zinc-100 mt-4 mb-2">{line.replace(/^## /,"")}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-zinc-200 mt-3 mb-1.5">{line.replace(/^### /,"")}</h3>;
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-semibold text-zinc-200 mt-2">{line.slice(2,-2)}</p>;
    if (line.startsWith("|")) return <p key={i} className="text-xs text-zinc-400 font-mono">{line}</p>;
    if (line.startsWith("> ")) return <div key={i} className="p-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl mt-3"><p className="text-[11px] text-zinc-500">{line.replace(/^> /,"")}</p></div>;
    if (line==="") return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm text-zinc-300 leading-relaxed">{line}</p>;
  });

  const InputCard = ({ val, onChange, label }: { val: StockInput; onChange: (v: StockInput) => void; label: string }) => (
    <div className="flex-1 bg-white/3 border border-white/6 rounded-2xl p-4 space-y-3">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">{label}</p>
      <div className="flex gap-2">
        {["STOCK_KR","STOCK_US","CRYPTO"].map((k)=>(
          <button key={k} onClick={()=>onChange({...val,assetType:k})}
            className={`flex-1 py-1 rounded-lg text-[10px] border transition-all ${
              val.assetType===k?"bg-white/8 text-zinc-200 border-white/15":"text-zinc-600 border-zinc-800"
            }`}>
            {k==="STOCK_KR"?"국내":k==="STOCK_US"?"미국":"코인"}
          </button>
        ))}
      </div>
      {[
        {key:"symbol",placeholder:"심볼 (예: 005930 / AAPL / BTC)"},
        {key:"name",  placeholder:"종목명 (예: 삼성전자)"},
        {key:"price", placeholder:"현재가"},
        {key:"changeRate",placeholder:"등락률 (예: 1.5 또는 -2.3)"},
      ].map(({key,placeholder})=>(
        <input key={key} value={(val as any)[key]} onChange={(e)=>onChange({...val,[key]:e.target.value})}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-xs text-zinc-100 placeholder:text-zinc-600 transition-colors" />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <ArrowLeftRight size={13} className="text-white" />
            </div>
            <h1 className="text-lg font-bold">종목 비교 분석</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* 입력 */}
        <div className="flex gap-3 items-start">
          <InputCard val={a} onChange={setA} label="종목 A" />
          <div className="flex items-center justify-center pt-16 shrink-0">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <ArrowLeftRight size={13} className="text-zinc-500" />
            </div>
          </div>
          <InputCard val={b} onChange={setB} label="종목 B" />
        </div>

        <button onClick={handleCompare} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold transition-all">
          <Sparkles size={15} className={loading?"animate-pulse":""} />
          {loading ? "AI가 비교 분석 중..." : "AI 비교 분석 시작"}
        </button>

        {/* 결과 */}
        {(text.length > 0 || loading) && (
          <div ref={scrollRef} className="bg-white/3 border border-white/6 rounded-2xl p-5 space-y-1 overflow-y-auto" style={{maxHeight:"60vh"}}>
            {text.length===0&&loading ? (
              <div className="flex items-center gap-2 text-zinc-500">
                {[0,150,300].map(d=><div key={d} className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                <span className="text-xs ml-1">두 종목을 비교 분석하고 있습니다...</span>
              </div>
            ) : (
              <>
                {renderMd(text)}
                {!done && <span className="inline-block w-2 h-4 bg-violet-500 rounded-sm animate-pulse ml-0.5" />}
              </>
            )}
          </div>
        )}
      </main>
      <InvestNav />
    </div>
  );
}
