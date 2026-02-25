"use client";
// src/components/PWAInstaller.tsx
// layout.tsx에 추가하면 SW 등록 + 설치 배너 표시

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstaller() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 서비스 워커 등록
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.warn("SW registration failed:", err));
    }

    // 설치 프롬프트 이벤트 캐치
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // 이미 설치됐거나 배너 닫은 경우 무시
      const wasDismissed = localStorage.getItem("pwa-dismissed");
      if (!wasDismissed) setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setInstallPrompt(null);
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-dismissed", "true");
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50
                    bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700
                    p-4 flex items-start gap-3 animate-slide-up">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-lg shrink-0">
        ☁️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">앱으로 설치하기</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">홈 화면에 추가하면 더 빠르게 이용할 수 있습니다</p>
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={install}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            설치
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-gray-500 dark:text-slate-400 text-xs hover:text-gray-700 dark:hover:text-slate-200"
          >
            나중에
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none shrink-0">×</button>
    </div>
  );
}
