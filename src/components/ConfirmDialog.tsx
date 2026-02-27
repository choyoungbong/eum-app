"use client";
// src/components/ConfirmDialog.tsx
// ✅ 수정사항:
// 1. openConfirm이 Promise<boolean> 반환 → await 패턴 지원
// 2. confirmText / confirmLabel 둘 다 허용 (하위 호환)
// 3. confirmVariant / variant 둘 다 허용 (하위 호환)

import { useEffect, useRef, useState, useCallback } from "react";

// ── UI 컴포넌트 ──────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen:         boolean;
  title:          string;
  message:        string;
  confirmLabel?:  string;
  cancelLabel?:   string;
  variant?:       "danger" | "default" | "primary";
  onConfirm:      () => void;
  onCancel:       () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel  = "취소",
  variant      = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => confirmBtnRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600"
                : variant === "primary"
                ? "bg-violet-600 hover:bg-violet-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hook ─────────────────────────────────────────────────

interface OpenConfirmOptions {
  title:           string;
  message:         string;
  // confirmText / confirmLabel 둘 다 허용
  confirmText?:    string;
  confirmLabel?:   string;
  cancelLabel?:    string;
  // confirmVariant / variant 둘 다 허용
  confirmVariant?: "danger" | "default" | "primary";
  variant?:        "danger" | "default" | "primary";
  // 콜백 패턴 (선택)
  onConfirm?:      () => void;
}

export function useConfirm() {
  const [state, setState] = useState<{
    isOpen:       boolean;
    title:        string;
    message:      string;
    confirmLabel: string;
    cancelLabel:  string;
    variant:      "danger" | "default" | "primary";
  }>({
    isOpen:       false,
    title:        "",
    message:      "",
    confirmLabel: "확인",
    cancelLabel:  "취소",
    variant:      "default",
  });

  // Promise resolve를 외부에서 저장
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  // ── Promise 반환 패턴 지원 ─────────────────────────────
  // await openConfirm({ ... }) → true(확인) / false(취소)
  const openConfirm = useCallback((opts: OpenConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen:       true,
        title:        opts.title,
        message:      opts.message,
        confirmLabel: opts.confirmText ?? opts.confirmLabel ?? "확인",
        cancelLabel:  opts.cancelLabel ?? "취소",
        variant:      opts.confirmVariant ?? opts.variant ?? "default",
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirmDialog, openConfirm };
}
