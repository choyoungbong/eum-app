"use client";
// src/app/error.tsx
// Next.js 14 App Router 글로벌 에러 바운더리 (500 등 런타임 오류)

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 환경에서는 Sentry 등으로 에러 리포트
    console.error("GlobalError:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center px-4">
      {/* 배경 블롭 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-red-700/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-orange-700/10 rounded-full blur-3xl" />
      </div>

      <div className="text-center max-w-md">
        <div className="relative mb-6 inline-block">
          <p className="text-[120px] md:text-[160px] font-black leading-none tracking-tighter
                        bg-clip-text text-transparent
                        bg-gradient-to-b from-red-400/80 to-red-900/30
                        select-none">
            500
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-4xl">⚡</span>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          서버 오류가 발생했습니다
        </h1>
        <p className="text-white/40 text-sm leading-relaxed mb-4">
          일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
          문제가 지속된다면 관리자에게 문의해 주세요.
        </p>

        {/* 에러 digest (개발/디버깅용) */}
        {error.digest && (
          <div className="mb-8 px-4 py-2.5 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Error ID</p>
            <p className="text-xs text-white/40 font-mono mt-0.5">{error.digest}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="w-full sm:w-auto px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-red-50 transition-all text-sm"
          >
            🔄 다시 시도
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-white/5 text-white font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-all text-sm"
          >
            🏠 대시보드로 이동
          </Link>
        </div>

        <p className="mt-10 text-white/10 text-[10px] font-medium tracking-[0.3em] uppercase">
          © 2026 EUM CLOUD SERVICE
        </p>
      </div>
    </div>
  );
}
