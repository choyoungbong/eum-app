"use client";
// src/app/settings/sessions/page.tsx

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Monitor, Smartphone, Tablet, LogOut, RefreshCw, Shield } from "lucide-react";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

function parseDevice(ua: string | null): { icon: typeof Monitor; label: string; detail: string } {
  if (!ua) return { icon: Monitor, label: "알 수 없는 기기", detail: "" };
  const isMobile = /Mobile|Android|iPhone/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const browser =
    ua.includes("Chrome") ? "Chrome" :
    ua.includes("Firefox") ? "Firefox" :
    ua.includes("Safari") ? "Safari" :
    ua.includes("Edge") ? "Edge" : "브라우저";
  const os =
    ua.includes("Windows") ? "Windows" :
    ua.includes("Mac") ? "macOS" :
    ua.includes("Linux") ? "Linux" :
    ua.includes("Android") ? "Android" :
    ua.includes("iOS") ? "iOS" : "";

  return {
    icon: isTablet ? Tablet : isMobile ? Smartphone : Monitor,
    label: `${browser}${os ? ` on ${os}` : ""}`,
    detail: isTablet ? "태블릿" : isMobile ? "모바일" : "데스크톱",
  };
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(d).toLocaleDateString("ko-KR");
}

export default function SessionsPage() {
  const { confirmDialog, openConfirm } = useConfirm();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me/sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      toast.error("세션 정보를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const revokeSession = async (id: string) => {
    const ok = await openConfirm({
      title: "세션 종료",
      message: "이 기기에서 로그아웃시킬까요?",
      confirmText: "로그아웃", confirmVariant: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/users/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.id !== id));
      toast.success("세션이 종료되었습니다");
    }
  };

  const revokeAll = async () => {
    const other = sessions.filter((s) => !s.isCurrent);
    if (other.length === 0) { toast.error("종료할 다른 세션이 없습니다"); return; }
    const ok = await openConfirm({
      title: "모든 기기 로그아웃",
      message: `현재 기기를 제외한 ${other.length}개 기기에서 로그아웃합니다.`,
      confirmText: "모두 로그아웃", confirmVariant: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/users/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revokeAll: true }),
    });
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.isCurrent));
      toast.success("다른 모든 기기에서 로그아웃되었습니다");
    }
  };

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {confirmDialog}

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Shield size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">로그인된 기기</h1>
          <button onClick={fetchSessions} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={16} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 전체 로그아웃 */}
        {otherCount > 0 && (
          <button
            onClick={revokeAll}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800 transition"
          >
            <LogOut size={15} /> 다른 모든 기기 로그아웃 ({otherCount}개)
          </button>
        )}

        {/* 세션 목록 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 animate-pulse flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700/50 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const device = parseDevice(s.userAgent);
              const Icon = device.icon;
              return (
                <div key={s.id} className={`bg-white dark:bg-slate-800 rounded-xl border transition-all p-4 flex items-center gap-3 ${
                  s.isCurrent
                    ? "border-blue-200 dark:border-blue-700 shadow-sm"
                    : "border-gray-100 dark:border-slate-700"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    s.isCurrent ? "bg-blue-50 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-slate-700"
                  }`}>
                    <Icon size={20} className={s.isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-slate-400"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{device.label}</p>
                      {s.isCurrent && (
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">현재 기기</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-slate-500">{device.detail}</span>
                      {s.ip && <><span className="text-gray-300 dark:text-slate-600">·</span><span className="text-xs text-gray-400 dark:text-slate-500 font-mono">{s.ip}</span></>}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                      마지막 활동: {timeAgo(s.lastActive)} · 로그인: {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => revokeSession(s.id)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      title="이 기기 로그아웃"
                    >
                      <LogOut size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-center text-gray-400 dark:text-slate-500 pb-4">
          의심스러운 기기가 있다면 즉시 로그아웃하고 비밀번호를 변경하세요.
        </p>
      </div>
    </div>
  );
}
