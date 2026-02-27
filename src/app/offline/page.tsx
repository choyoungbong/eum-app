"use client";
// src/app/offline/page.tsx
// ✅ 수정: "use client" 추가 — onClick 핸들러가 있어 Server Component로 렌더링 불가

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-slate-700/30 rounded-full blur-3xl" />
      </div>

      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6 animate-pulse">📡</div>
        <h1 className="text-2xl font-bold text-white mb-3">오프라인 상태입니다</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-8">
          인터넷 연결을 확인해주세요.<br />
          연결이 복구되면 자동으로 새로고침됩니다.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:bg-white/20 transition-all text-sm"
        >
          🔄 다시 시도
        </button>
        <p className="mt-8 text-white/10 text-[10px] font-medium tracking-[0.3em] uppercase">
          © 2026 EUM CLOUD SERVICE
        </p>
      </div>
    </div>
  );
}
