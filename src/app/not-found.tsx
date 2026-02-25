// src/app/not-found.tsx
// Next.js 14 App Router 글로벌 404 페이지

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center px-4">
      {/* 배경 블롭 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-700/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-700/15 rounded-full blur-3xl" />
      </div>

      <div className="text-center max-w-md">
        {/* 404 */}
        <div className="relative mb-6 inline-block">
          <p className="text-[120px] md:text-[160px] font-black leading-none tracking-tighter
                        bg-clip-text text-transparent
                        bg-gradient-to-b from-white/80 to-white/10
                        select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center animate-pulse">
              <span className="text-4xl">🔍</span>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-white/40 text-sm leading-relaxed mb-10">
          요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있습니다.
          입력한 주소를 다시 확인해 주세요.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-purple-50 transition-all text-sm"
          >
            🏠 대시보드로 이동
          </Link>
          <Link
            href="javascript:history.back()"
            className="w-full sm:w-auto px-6 py-3 bg-white/5 text-white font-semibold rounded-xl border border-white/10 hover:bg-white/10 transition-all text-sm"
          >
            ← 이전 페이지
          </Link>
        </div>

        <p className="mt-10 text-white/10 text-[10px] font-medium tracking-[0.3em] uppercase">
          © 2026 EUM CLOUD SERVICE
        </p>
      </div>
    </div>
  );
}
