"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Activity, FileUp, Trash2, Download, Share2,
  FolderPlus, FolderMinus, FileText, MessageSquare, User,
  Lock, LogIn, LogOut, MessageCircle, Phone, PhoneOff,
  RefreshCw, ChevronLeft as Prev, ChevronRight as Next,
  Filter,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

type ActivityAction =
  | "FILE_UPLOAD" | "FILE_DELETE" | "FILE_DOWNLOAD" | "FILE_SHARE"
  | "FOLDER_CREATE" | "FOLDER_DELETE"
  | "POST_CREATE" | "POST_DELETE"
  | "COMMENT_CREATE" | "COMMENT_DELETE"
  | "PROFILE_UPDATE" | "PASSWORD_CHANGE"
  | "LOGIN" | "LOGOUT"
  | "CHAT_MESSAGE" | "CALL_START" | "CALL_END";

interface ActivityLog {
  id: string;
  action: ActivityAction;
  target?: string;
  targetId?: string;
  meta?: Record<string, string>;
  createdAt: string;
}

const ACTION_META: Record<ActivityAction, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  FILE_UPLOAD:    { label: "파일 업로드",    icon: FileUp,       color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/30" },
  FILE_DELETE:    { label: "파일 삭제",      icon: Trash2,       color: "text-red-600",    bg: "bg-red-50 dark:bg-red-900/30" },
  FILE_DOWNLOAD:  { label: "파일 다운로드",  icon: Download,     color: "text-green-600",  bg: "bg-green-50 dark:bg-green-900/30" },
  FILE_SHARE:     { label: "파일 공유",      icon: Share2,       color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30" },
  FOLDER_CREATE:  { label: "폴더 생성",      icon: FolderPlus,   color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-900/30" },
  FOLDER_DELETE:  { label: "폴더 삭제",      icon: FolderMinus,  color: "text-red-600",    bg: "bg-red-50 dark:bg-red-900/30" },
  POST_CREATE:    { label: "게시글 작성",    icon: FileText,     color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
  POST_DELETE:    { label: "게시글 삭제",    icon: Trash2,       color: "text-red-600",    bg: "bg-red-50 dark:bg-red-900/30" },
  COMMENT_CREATE: { label: "댓글 작성",      icon: MessageSquare,color: "text-cyan-600",   bg: "bg-cyan-50 dark:bg-cyan-900/30" },
  COMMENT_DELETE: { label: "댓글 삭제",      icon: Trash2,       color: "text-red-600",    bg: "bg-red-50 dark:bg-red-900/30" },
  PROFILE_UPDATE: { label: "프로필 수정",    icon: User,         color: "text-gray-600",   bg: "bg-gray-50 dark:bg-gray-800" },
  PASSWORD_CHANGE:{ label: "비밀번호 변경",  icon: Lock,         color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" },
  LOGIN:          { label: "로그인",         icon: LogIn,        color: "text-green-600",  bg: "bg-green-50 dark:bg-green-900/30" },
  LOGOUT:         { label: "로그아웃",       icon: LogOut,       color: "text-gray-600",   bg: "bg-gray-50 dark:bg-gray-800" },
  CHAT_MESSAGE:   { label: "채팅 메시지",    icon: MessageCircle,color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30" },
  CALL_START:     { label: "통화 시작",      icon: Phone,        color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-900/30" },
  CALL_END:       { label: "통화 종료",      icon: PhoneOff,     color: "text-gray-600",   bg: "bg-gray-50 dark:bg-gray-800" },
};

const ACTION_GROUPS = [
  { label: "전체", value: "" },
  { label: "파일", value: "FILE_UPLOAD" },
  { label: "공유", value: "FILE_SHARE" },
  { label: "게시글", value: "POST_CREATE" },
  { label: "로그인", value: "LOGIN" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityLogPage() {
  const { confirmDialog, openConfirm } = useConfirm();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (filter) params.set("action", filter);
      const res = await fetch(`/api/activity-logs?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      toast.error("활동 로그를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [filter]);

  const clearLogs = async () => {
    const ok = await openConfirm({
      title: "활동 로그 전체 삭제",
      message: "모든 활동 내역을 삭제할까요? 복구할 수 없습니다.",
      confirmText: "삭제",
      confirmVariant: "danger",
    });
    if (!ok) return;
    await fetch("/api/activity-logs", { method: "DELETE" });
    setLogs([]);
    setTotal(0);
    toast.success("활동 로그를 삭제했습니다");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {confirmDialog}

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Activity size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">
            활동 내역
            {total > 0 && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-slate-400">({total}건)</span>}
          </h1>
          <button onClick={fetchLogs} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={16} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {ACTION_GROUPS.map((g) => (
            <button
              key={g.value}
              onClick={() => setFilter(g.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === g.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* 전체 삭제 */}
        {logs.length > 0 && (
          <div className="flex justify-end mb-3">
            <button
              onClick={clearLogs}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={12} /> 전체 삭제
            </button>
          </div>
        )}

        {/* 로그 목록 */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700/50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Activity size={28} className="text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-medium">활동 내역이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {logs.map((log) => {
                const meta = ACTION_META[log.action];
                const Icon = meta.icon;
                return (
                  <div key={log.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <Icon size={15} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{meta.label}</p>
                      {log.target && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{log.target}</p>
                      )}
                      {log.meta?.ip && (
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">IP: {log.meta.ip}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{timeAgo(log.createdAt)}</span>
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                >
                  <Prev size={16} className="text-gray-600 dark:text-slate-400" />
                </button>
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                >
                  <Next size={16} className="text-gray-600 dark:text-slate-400" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
