"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function ErrorPage({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 클라이언트 에러 로깅
    fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack:   error.stack,
        digest:  error.digest,
        url:     window.location.href,
        ts:      new Date().toISOString(),
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto">
          <AlertTriangle size={36} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-2">페이지 오류</h1>
          <p className="text-gray-500 dark:text-slate-400">
            이 페이지를 불러오는 중 오류가 발생했습니다.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-3 text-left text-[10px] bg-gray-900 text-red-300 rounded-xl p-4 overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
            <RefreshCw size={15} /> 다시 시도
          </button>
          <a href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl transition hover:bg-gray-50 dark:hover:bg-slate-700">
            <Home size={15} /> 홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
