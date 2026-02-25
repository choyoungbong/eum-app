"use client";
// src/app/trash/page.tsx

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Trash2, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { getFileIcon, formatFileSize } from "@/lib/client-utils";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface TrashFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: string;
  thumbnailUrl: string | null;
  deletedAt: string;
  createdAt: string;
}

function daysLeft(deletedAt: string) {
  const deleted = new Date(deletedAt).getTime();
  const expiry = deleted + 30 * 24 * 60 * 60 * 1000; // 30일 후 자동 삭제 정책
  const remaining = Math.ceil((expiry - Date.now()) / 86400000);
  return Math.max(0, remaining);
}

export default function TrashPage() {
  const { confirmDialog, openConfirm } = useConfirm();
  const [files, setFiles] = useState<TrashFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/trash");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      toast.error("휴지통을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  const restore = async (id: string) => {
    const res = await fetch(`/api/files/${id}/restore`, { method: "POST" });
    if (res.ok) {
      setFiles((f) => f.filter((x) => x.id !== id));
      toast.success("파일이 복구되었습니다");
    } else toast.error("복구에 실패했습니다");
  };

  const permanentDelete = async (id: string) => {
    const ok = await openConfirm({
      title: "영구 삭제", message: "이 파일을 영구 삭제할까요? 복구할 수 없습니다.",
      confirmText: "영구 삭제", confirmVariant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((f) => f.filter((x) => x.id !== id));
      toast.success("영구 삭제되었습니다");
    }
  };

  const emptyTrash = async () => {
    const ok = await openConfirm({
      title: "휴지통 비우기",
      message: `${files.length}개 파일을 모두 영구 삭제할까요? 복구할 수 없습니다.`,
      confirmText: "모두 삭제", confirmVariant: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/files/trash", { method: "DELETE" });
    if (res.ok) { setFiles([]); toast.success("휴지통을 비웠습니다"); }
  };

  const restoreSelected = async () => {
    await Promise.all([...selected].map((id) => fetch(`/api/files/${id}/restore`, { method: "POST" })));
    setFiles((f) => f.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    toast.success(`${selected.size}개 파일이 복구되었습니다`);
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected(selected.size === files.length ? new Set() : new Set(files.map((f) => f.id)));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {confirmDialog}

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Trash2 size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">
            휴지통 {files.length > 0 && <span className="text-sm font-normal text-gray-400 dark:text-slate-500">({files.length})</span>}
          </h1>
          <button onClick={fetchTrash} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
            <RefreshCw size={16} className="text-gray-500 dark:text-slate-400" />
          </button>
          {files.length > 0 && (
            <button onClick={emptyTrash} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 transition">
              <Trash2 size={12} /> 비우기
            </button>
          )}
        </div>

        {/* 선택 액션 바 */}
        {selected.size > 0 && (
          <div className="max-w-4xl mx-auto px-4 pb-2 flex items-center gap-3">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{selected.size}개 선택됨</span>
            <button onClick={restoreSelected} className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline">
              <RotateCcw size={11} /> 선택 복구
            </button>
          </div>
        )}
      </div>

      {/* 안내 배너 */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            휴지통의 파일은 삭제 후 <strong>30일</strong>이 지나면 자동으로 영구 삭제됩니다.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse flex gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700/50 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Trash2 size={32} className="text-gray-300 dark:text-slate-600" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-medium">휴지통이 비어있습니다</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            {/* 전체 선택 */}
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
              <input type="checkbox" checked={selected.size === files.length} onChange={toggleAll}
                className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-xs text-gray-500 dark:text-slate-400">전체 선택</span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {files.map((f) => {
                const days = daysLeft(f.deletedAt);
                return (
                  <div key={f.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${selected.has(f.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleSelect(f.id)}
                      className="w-4 h-4 rounded accent-blue-600 shrink-0" />
                    <span className="text-2xl shrink-0">{getFileIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{f.originalName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(f.size)}</span>
                        <span className="text-xs text-gray-300 dark:text-slate-600">·</span>
                        <span className={`text-xs font-medium ${days <= 3 ? "text-red-500" : "text-gray-400 dark:text-slate-500"}`}>
                          {days > 0 ? `${days}일 후 자동 삭제` : "곧 삭제됨"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => restore(f.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition">
                        <RotateCcw size={11} /> 복구
                      </button>
                      <button onClick={() => permanentDelete(f.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
