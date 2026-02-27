"use client";
// src/app/admin/stats/page.tsx — 관리자 통계 & 관리 대시보드

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Users, HardDrive, FileText, MessageSquare,
  TrendingUp, Ban, Bell, RefreshCw, Plus, Trash2, X,
  AlertTriangle, CheckCircle, Info, Wrench,
} from "lucide-react";
import { formatFileSize } from "@/lib/client-utils";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface Stats {
  summary: {
    totalUsers: number; activeUsers: number; bannedUsers: number;
    totalFiles: number; totalStorage: string;
    totalPosts: number; totalComments: number;
    newUsersLast30: number; newFilesLast30: number;
  };
  topStorageUsers: { id: string; name: string; email: string; storageUsed: string }[];
  filesByType: { type: string; count: number; size: string }[];
  dailySignups: { date: string; count: number }[];
  dailyUploads: { date: string; count: number }[];
}

interface Notice {
  id: string; title: string; content: string; type: string;
  isActive: boolean; endsAt: string | null; createdAt: string;
}

const NOTICE_ICONS = {
  INFO:        <Info size={14} className="text-blue-500" />,
  WARNING:     <AlertTriangle size={14} className="text-amber-500" />,
  MAINTENANCE: <Wrench size={14} className="text-purple-500" />,
};

// 간단한 바 차트 컴포넌트
function MiniBarChart({ data, label }: { data: { date: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-3">{label}</p>
      <div className="flex items-end gap-1 h-20">
        {data.slice(-14).map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-blue-500/20 dark:bg-blue-400/20 hover:bg-blue-500/40 rounded-sm transition-all"
              style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
              {d.date}: {d.count}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-gray-400 dark:text-slate-500">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export default function AdminStatsPage() {
  const { confirmDialog, openConfirm } = useConfirm();
  const [stats, setStats] = useState<Stats | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "users" | "notices">("overview");

  // 공지 폼
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: "", content: "", type: "INFO", endsAt: "" });
  const [savingNotice, setSavingNotice] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, noticesRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/notices"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (noticesRes.ok) setNotices((await noticesRes.json()).notices ?? []);
    } catch { toast.error("데이터를 불러오지 못했습니다"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const banUser = async (id: string, name: string) => {
    const ok = await openConfirm({ title: "사용자 정지", message: `${name}을 정지하시겠습니까?`, confirmText: "정지", confirmVariant: "danger" });
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${id}/ban`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "관리자 결정" }) });
    if (res.ok) { toast.success(`${name}이 정지되었습니다`); fetchAll(); }
  };

  const unbanUser = async (id: string, name: string) => {
    const res = await fetch(`/api/admin/users/${id}/ban`, { method: "DELETE" });
    if (res.ok) { toast.success(`${name}의 정지가 해제되었습니다`); fetchAll(); }
  };

  const saveNotice = async () => {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) { toast.error("제목과 내용을 입력해주세요"); return; }
    setSavingNotice(true);
    try {
      const res = await fetch("/api/admin/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(noticeForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotices((n) => [data.notice, ...n]);
      setShowNoticeForm(false);
      setNoticeForm({ title: "", content: "", type: "INFO", endsAt: "" });
      toast.success("공지가 등록되었습니다");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingNotice(false); }
  };

  const deleteNotice = async (id: string) => {
    const ok = await openConfirm({ title: "공지 삭제", message: "이 공지를 삭제하시겠습니까?", confirmText: "삭제", confirmVariant: "danger" });
    if (!ok) return;
    await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
    setNotices((n) => n.filter((x) => x.id !== id));
    toast.success("공지가 삭제되었습니다");
  };

  const s = stats?.summary;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {confirmDialog}

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <TrendingUp size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">통계 & 관리</h1>
          <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
            <RefreshCw size={16} className={`text-gray-500 dark:text-slate-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {/* 탭 */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-1">
          {(["overview", "users", "notices"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? "bg-blue-600 text-white" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"}`}>
              {{ overview: "📊 개요", users: "👥 사용자", notices: "📢 공지" }[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── 개요 탭 ── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* KPI 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "전체 사용자", value: s?.totalUsers ?? 0, sub: `신규 +${s?.newUsersLast30 ?? 0}/30일`, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                { label: "전체 파일", value: s?.totalFiles ?? 0, sub: `신규 +${s?.newFilesLast30 ?? 0}/30일`, icon: HardDrive, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
                { label: "총 저장 용량", value: formatFileSize(s?.totalStorage ?? "0"), sub: "사용 중", icon: HardDrive, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
                { label: "게시글", value: s?.totalPosts ?? 0, sub: `댓글 ${s?.totalComments ?? 0}개`, icon: FileText, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
              ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                    <Icon size={18} className={color} />
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-slate-100">{value.toLocaleString()}</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mt-0.5">{label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* 차트 */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
                {stats?.dailySignups && stats.dailySignups.length > 0
                  ? <MiniBarChart data={stats.dailySignups} label="일별 신규 가입자 (최근 14일)" />
                  : <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">데이터 없음</p>}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
                {stats?.dailyUploads && stats.dailyUploads.length > 0
                  ? <MiniBarChart data={stats.dailyUploads} label="일별 파일 업로드 (최근 14일)" />
                  : <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">데이터 없음</p>}
              </div>
            </div>

            {/* 파일 타입 분포 */}
            {stats?.filesByType && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4">파일 타입별 분포</p>
                <div className="space-y-2">
                  {stats.filesByType.map(({ type, count, size }) => {
                    const total = stats.filesByType.reduce((a, b) => a + b.count, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-xs text-gray-700 dark:text-slate-300 w-12">{type}</span>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-slate-400 w-16 text-right">{count}개 ({pct}%)</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 w-16 text-right">{formatFileSize(size)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 저장 사용량 Top 10 */}
            {stats?.topStorageUsers && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4">저장 사용량 Top 10</p>
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {stats.topStorageUsers.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-xs font-bold text-gray-400 dark:text-slate-500 w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{u.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{formatFileSize(u.storageUsed)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 사용자 탭 ── */}
        {tab === "users" && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">저장 사용량 상위 사용자</p>
              {s && <span className="text-xs text-gray-400 dark:text-slate-500">정지: {s.bannedUsers}명</span>}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {(stats?.topStorageUsers ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email} · {formatFileSize(u.storageUsed)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => banUser(u.id, u.name)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg transition">
                      <Ban size={11} /> 정지
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 공지 탭 ── */}
        {tab === "notices" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowNoticeForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
                <Plus size={14} /> 공지 등록
              </button>
            </div>

            {/* 공지 등록 폼 */}
            {showNoticeForm && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">새 공지 등록</h3>
                  <button onClick={() => setShowNoticeForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"><X size={16} /></button>
                </div>
                <div className="flex gap-2">
                  {["INFO", "WARNING", "MAINTENANCE"].map((t) => (
                    <button key={t} onClick={() => setNoticeForm((f) => ({ ...f, type: t }))}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${noticeForm.type === t ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400"}`}>
                      {t === "INFO" ? "ℹ️ 안내" : t === "WARNING" ? "⚠️ 경고" : "🔧 점검"}
                    </button>
                  ))}
                </div>
                <input type="text" value={noticeForm.title} onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="공지 제목" className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <textarea value={noticeForm.content} onChange={(e) => setNoticeForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="공지 내용" rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500 dark:text-slate-400">종료일:</label>
                  <input type="datetime-local" value={noticeForm.endsAt} onChange={(e) => setNoticeForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowNoticeForm(false)} className="flex-1 py-2.5 text-sm text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 rounded-xl transition">취소</button>
                  <button onClick={saveNotice} disabled={savingNotice} className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                    {savingNotice ? "등록 중..." : "등록"}
                  </button>
                </div>
              </div>
            )}

            {/* 공지 목록 */}
            {notices.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-center">
                <Bell size={32} className="text-gray-300 dark:text-slate-600 mb-3" />
                <p className="text-gray-500 dark:text-slate-400 font-medium">등록된 공지가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notices.map((n) => (
                  <div key={n.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-start gap-3">
                    <div className="mt-0.5">{NOTICE_ICONS[n.type as keyof typeof NOTICE_ICONS] ?? NOTICE_ICONS.INFO}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.content}</p>
                      {n.endsAt && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">~{new Date(n.endsAt).toLocaleString("ko-KR")}</p>}
                    </div>
                    <button onClick={() => deleteNotice(n.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
