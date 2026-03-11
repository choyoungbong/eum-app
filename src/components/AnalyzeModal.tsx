"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Copy, Check } from "lucide-react";

interface Props {
  symbol: string; name: string; price: number;
  changeRate: number; assetType: string;
  onClose: () => void;
}

export default function AnalyzeModal({ symbol, name, price, changeRate, assetType, onClose }: Props) {
  const [text,    setText]    = useState("");
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState(false);
  const [copied,  setCopied]  = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch("/api/invest/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, name, price, changeRate, assetType }),
        });
        if (!res.ok || !res.body) { setError(true); return; }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone || cancelled) break;
          setText((prev) => prev + decoder.decode(value, { stream: true }));
          // 자동 스크롤
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }
        if (!cancelled) setDone(true);
      } catch { if (!cancelled) setError(true); }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 마크다운 굵게 처리 (간단)
  const renderMd = (raw: string) => {
    return raw.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={j} className="text-zinc-200 font-semibold">{part.slice(2, -2)}</strong>
          : part
      );
      const isQuote = line.startsWith(">");
      if (isQuote) return (
        <div key={i} className="flex gap-2 mt-3 p-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
          <span className="text-yellow-500 shrink-0">⚠️</span>
          <p className="text-[11px] text-zinc-500">{line.replace(/^>\s*⚠️?\s*/, "")}</p>
        </div>
      );
      return <p key={i} className={`text-sm text-zinc-300 leading-relaxed ${line === "" ? "mt-3" : ""}`}>{parts}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-100 text-sm">{name} AI 분석</p>
              <p className="text-[10px] text-zinc-600">{symbol} · {changeRate > 0 ? "+" : ""}{changeRate.toFixed(2)}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {done && (
              <button onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 text-xs transition-all">
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? "복사됨" : "복사"}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-1">
          {error ? (
            <div className="text-center py-10 text-zinc-600">
              <p className="text-sm">분석 중 오류가 발생했습니다.</p>
              <p className="text-xs mt-1">잠시 후 다시 시도해주세요.</p>
            </div>
          ) : text.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-500">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-xs ml-1">Claude가 분석 중입니다...</span>
            </div>
          ) : (
            <>
              {renderMd(text)}
              {!done && (
                <span className="inline-block w-2 h-4 bg-violet-500 rounded-sm animate-pulse ml-0.5" />
              )}
            </>
          )}
        </div>

        {done && (
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
