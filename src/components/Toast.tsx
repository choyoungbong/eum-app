"use client";
// src/components/Toast.tsx (개선판 — 사운드 통합)
// 기존 Toast.tsx를 이 파일로 교체하세요

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { sound } from "@/lib/sound";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

const ICONS = {
  success: <CheckCircle   size={16} className="text-green-500 shrink-0" />,
  error:   <AlertCircle   size={16} className="text-red-500   shrink-0" />,
  info:    <Info           size={16} className="text-blue-500  shrink-0" />,
  warning: <AlertTriangle  size={16} className="text-amber-500 shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
  success: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30",
  error:   "border-red-200   dark:border-red-800   bg-red-50   dark:bg-red-900/30",
  info:    "border-blue-200  dark:border-blue-800  bg-blue-50  dark:bg-blue-900/30",
  warning: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30",
};

let globalAddToast: ToastContextValue["addToast"] | null = null;

// ── Provider ─────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-4), { id, type, message, duration }]);

    // 사운드 재생
    if (type === "success") sound.success();
    else if (type === "error") sound.error();
    else sound.notification();

    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  useEffect(() => { globalAddToast = addToast; return () => { globalAddToast = null; }; }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* 토스트 컨테이너 */}
      <div className="fixed top-4 right-4 z-[9997] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${STYLES[t.type]} animate-slide-in`}>
            {ICONS[t.type]}
            <p className="text-sm font-medium text-gray-800 dark:text-slate-200 flex-1 leading-snug">{t.message}</p>
            <button onClick={() => setToasts((t2) => t2.filter((x) => x.id !== t.id))}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 shrink-0 mt-0.5">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── 정적 API (컴포넌트 밖에서도 사용 가능) ─────────────────
export const toast = {
  success: (msg: string, dur?: number) => globalAddToast?.("success", msg, dur),
  error:   (msg: string, dur?: number) => globalAddToast?.("error",   msg, dur),
  info:    (msg: string, dur?: number) => globalAddToast?.("info",    msg, dur),
  warning: (msg: string, dur?: number) => globalAddToast?.("warning", msg, dur),
};

export function useToast() {
  return useContext(ToastContext);
}
