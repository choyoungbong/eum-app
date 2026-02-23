"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────
// 타입
// ─────────────────────────────────────
export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ─────────────────────────────────────
// 전역 Toast 이벤트 (어디서든 호출 가능)
// ─────────────────────────────────────
type ToastListener = (toast: Omit<Toast, "id">) => void;
let listener: ToastListener | null = null;

export const toast = {
  success: (message: string) => listener?.({ message, type: "success" }),
  error: (message: string) => listener?.({ message, type: "error" }),
  info: (message: string) => listener?.({ message, type: "info" }),
  warning: (message: string) => listener?.({ message, type: "warning" }),
};

// ─────────────────────────────────────
// ToastContainer — layout.tsx에 추가
// ─────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    listener = addToast;
    return () => {
      listener = null;
    };
  }, [addToast]);

  if (!mounted) return null;

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  const colors: Record<ToastType, string> = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    warning: "bg-yellow-500",
  };

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white
            text-sm font-medium max-w-xs pointer-events-auto
            animate-in slide-in-from-right duration-300
            ${colors[t.type]}
          `}
        >
          <span className="text-base font-bold">{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
