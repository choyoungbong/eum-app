"use client";
// src/components/ErrorBoundary.tsx
// React 에러 바운더리 — 페이지/컴포넌트 단위 크래시 격리

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children:   ReactNode;
  fallback?:  ReactNode;
  level?:     "page" | "section" | "inline";
  onError?:   (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError:     boolean;
  error:        Error | null;
  showDetails:  boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 에러 로깅 (서버로 전송)
    this.props.onError?.(error, info);
    reportError(error, {
      componentStack: info.componentStack,
      level:          this.props.level ?? "section",
    });
  }

  reset = () => this.setState({ hasError: false, error: null, showDetails: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    // 커스텀 fallback이 있으면 사용
    if (this.props.fallback) return this.props.fallback;

    const { level = "section", error } = { ...this.props, ...this.state };

    // ── inline (토스트/카드 수준) ─────────────────────────
    if (level === "inline") {
      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400 flex-1">
            이 섹션을 불러오는 데 실패했습니다
          </p>
          <button onClick={this.reset} className="text-xs text-red-500 hover:text-red-700 font-medium">
            재시도
          </button>
        </div>
      );
    }

    // ── section (카드/패널 수준) ──────────────────────────
    if (level === "section") {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl border-2 border-dashed border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
            이 섹션에서 오류가 발생했습니다
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
            {error?.message ?? "알 수 없는 오류"}
          </p>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
          >
            <RefreshCw size={13} /> 다시 시도
          </button>
        </div>
      );
    }

    // ── page (전체 페이지 수준) ───────────────────────────
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
        <div className="max-w-md w-full text-center">
          {/* 아이콘 */}
          <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertTriangle size={36} className="text-red-500" />
          </div>

          <h1 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-2">
            예기치 않은 오류
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mb-8">
            페이지를 불러오는 중 문제가 발생했습니다.
            <br />다시 시도하거나 홈으로 돌아가세요.
          </p>

          {/* 에러 상세 (개발 환경) */}
          {process.env.NODE_ENV === "development" && error && (
            <div className="mb-6 text-left">
              <button
                onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 mb-2"
              >
                {this.state.showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                에러 상세 (개발 환경)
              </button>
              {this.state.showDetails && (
                <pre className="text-left text-[10px] bg-gray-900 text-red-300 rounded-xl p-4 overflow-auto max-h-40 whitespace-pre-wrap">
                  {error.message}{"\n\n"}{error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.reset}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
            >
              <RefreshCw size={15} /> 다시 시도
            </button>
            <a
              href="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-xl transition"
            >
              <Home size={15} /> 홈으로
            </a>
          </div>
        </div>
      </div>
    );
  }
}

// ── 에러 리포팅 함수 ──────────────────────────────────────
async function reportError(error: Error, context?: object) {
  if (process.env.NODE_ENV === "development") {
    console.error("[ErrorBoundary]", error, context);
    return;
  }
  // 프로덕션에서 서버로 에러 전송
  try {
    await fetch("/api/errors/report", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack:   error.stack,
        context,
        url:     window.location.href,
        ua:      navigator.userAgent,
        ts:      new Date().toISOString(),
      }),
    });
  } catch {}
}

// ── 래퍼 컴포넌트 (편의용) ───────────────────────────────
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="page">{children}</ErrorBoundary>;
}
export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="section">{children}</ErrorBoundary>;
}
export function InlineErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="inline">{children}</ErrorBoundary>;
}
