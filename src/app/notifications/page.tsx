"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  BellOff,
  MessageCircle,
  Share2,
  FileUp,
  Phone,
  Info,
  MessageSquare,
  Trash2,
  CheckCheck,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/components/Toast";

type NotificationType = "COMMENT" | "SHARE" | "CHAT" | "SYSTEM" | "FILE_UPLOAD" | "CALL";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// 타입별 아이콘 + 색상
const TYPE_META: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  COMMENT:     { icon: MessageSquare, color: "text-blue-600",  bg: "bg-blue-50",   label: "댓글" },
  SHARE:       { icon: Share2,        color: "text-green-600", bg: "bg-green-50",  label: "공유" },
  CHAT:        { icon: MessageCircle, color: "text-purple-600",bg: "bg-purple-50", label: "채팅" },
  SYSTEM:      { icon: Info,          color: "text-gray-600 dark:text-slate-400",  bg: "bg-gray-50 dark:bg-slate-900",   label: "시스템" },
  FILE_UPLOAD: { icon: FileUp,        color: "text-orange-600",bg: "bg-orange-50", label: "파일" },
  CALL:        { icon: Phone,         color: "text-red-600",   bg: "bg-red-50",    label: "전화" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications${filter === "unread" ? "?unread=true" : ""}`
      );
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      toast.error("알림을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 단건 읽음
  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  };

  // 단건 삭제
  const deleteOne = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const wasUnread = notifications.find((n) => n.id === id)?.isRead === false;
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      toast.success("알림을 삭제했습니다");
    } catch {
      toast.error("삭제 중 오류가 발생했습니다");
    } finally {
      setDeletingId(null);
    }
  };

  // 전체 읽음
  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    toast.success("모든 알림을 읽음 처리했습니다");
  };

  // 전체 삭제
  const deleteAll = async () => {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
    setUnreadCount(0);
    toast.success("모든 알림을 삭제했습니다");
  };

  // 알림 클릭: 읽음 처리 후 링크 이동
  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:bg-slate-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Bell size={20} className="text-gray-800" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100">알림</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={fetchNotifications}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={16} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-700"
              }`}
            >
              {f === "all" ? "전체" : `읽지 않음 ${unreadCount > 0 ? `(${unreadCount})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* 일괄 액션 */}
        {notifications.length > 0 && (
          <div className="flex justify-end gap-2 mb-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <CheckCheck size={14} />
                모두 읽음
              </button>
            )}
            <button
              onClick={deleteAll}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              전체 삭제
            </button>
          </div>
        )}

        {/* 알림 목록 */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4">
              <BellOff size={28} className="text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-medium">알림이 없습니다</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
              {filter === "unread" ? "읽지 않은 알림이 없습니다" : "새 알림이 오면 여기 표시됩니다"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type];
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border transition-all ${
                    n.isRead ? "border-gray-100 dark:border-slate-700" : "border-blue-100 shadow-sm"
                  }`}
                >
                  <div
                    className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900 rounded-xl transition-colors ${
                      !n.isRead ? "bg-blue-50/40" : ""
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    {/* 아이콘 */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <Icon size={18} className={meta.color} />
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${n.isRead ? "text-gray-700 dark:text-slate-300" : "text-gray-900 dark:text-slate-100 font-semibold"}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                      </div>
                      {n.body && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex border-t border-gray-100 dark:border-slate-700">
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        className="flex-1 py-2 text-xs text-blue-600 font-medium hover:bg-blue-50 transition-colors rounded-bl-xl"
                      >
                        읽음 처리
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                      disabled={deletingId === n.id}
                      className={`${n.isRead ? "w-full rounded-b-xl" : "flex-1"} py-2 text-xs text-red-400 font-medium hover:bg-red-50 transition-colors ${n.isRead ? "rounded-bl-xl" : ""} rounded-br-xl`}
                    >
                      {deletingId === n.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
