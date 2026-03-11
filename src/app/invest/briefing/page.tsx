"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, RefreshCw, Copy, Check } from "lucide-react";
import InvestNav from "@/components/InvestNav";

export default function BriefingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [copied,  setCopied]  = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const fetchBriefing = async () => {
    setText(""); setDone(false); setLoading(true);
    try {
      const res = await fetch("/api/invest/briefing");
      if (!res.ok || !res.body) { setLoading(false); return; }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
      setDone(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (session) fetchBriefing(); }, [session]);

  const renderMd = (raw: string) => {
    return raw.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h2 key={i} className="text-base font-black text-zinc-100 mt-4 mb-2">{line.replace(/^## /,"")}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-zinc-200 mt-3 mb-1.5">{line.replace(/^### /,"")}</h3>;
      if (line.startsWith("> ")) return (
        <div key={i} className="flex gap-2 mt-3 p-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
          <p className="text-[11px] text-zinc-500">{line.replace(/^> /,"")}</p>
        </div>
      );
      if (line.startsWith("- ") || line.match(/^\d+\./)) return <p key={i} className="text-sm text-zinc-300 leading-relaxed pl-2">{line}</p>;
      if (line === "") return <div key={i} className="h-1" />;
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p,j)=>
        p.startsWith("**")&&p.endsWith("**")
          ? <strong key={j} className="text-zinc-200 font-semibold">{p.slice(2,-2)}</strong>
          : p
      );
      return <p key={i} className="text-sm text-zinc-300 leading-relaxed">{parts}</p>;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles size={13} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-none">AI 일일 브리핑</h1>
                <p className="text-[10px] text-zinc-600 mt-0.5">{new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {done && (
              <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 text-xs transition-all">
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? "복사됨" : "복사"}
              </button>
            )}
            <button onClick={fetchBriefing} disabled={loading}
              className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main ref={scrollRef} className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <div className="bg-white/3 border border-white/6 rounded-2xl p-5 min-h-64">
          {text.length === 0 && loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex gap-1.5">
                {[0,150,300].map((d)=>(
                  <div key={d} className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />
                ))}
              </div>
              <p className="text-xs text-zinc-600">오늘의 시장 데이터를 분석하고 있습니다...</p>
            </div>
          )}
          {text.length > 0 && (
            <div className="space-y-0.5">
              {renderMd(text)}
              {!done && <span className="inline-block w-2 h-4 bg-violet-500 rounded-sm animate-pulse ml-0.5" />}
            </div>
          )}
        </div>
      </main>
      <InvestNav />
    </div>
  );
}
