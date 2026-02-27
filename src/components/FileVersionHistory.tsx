"use client";
// src/components/FileVersionHistory.tsx
// 파일 상세/컨텍스트 메뉴에서 사용

import { useState, useEffect } from "react";
import { History, RotateCcw, Plus, X, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { formatFileSize } from "@/lib/client-utils";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface FileVersion {
  id: string;
  versionNum: number;
  size: bigint | string;
  comment: string | null;
  createdAt: string;
  user: { name: string };
}

interface Props {
  fileId: string;
  fileName: string;
  onRollback?: () => void;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  return `${days}일 전`;
}

export default function FileVersionHistory({ fileId, fileName, onRollback }: Props) {
  const { confirmDialog, openConfirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/files/${fileId}/versions`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions ?? []))
      .catch(() => toast.error("버전 기록을 불러오지 못했습니다"))
      .finally(() => setLoading(false));
  }, [open, fileId]);

  const saveVersion = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/files/${fileId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersions((v) => [data.version, ...v]);
      setComment("");
      setShowCommentInput(false);
      toast.success(data.message);
    } catch (e: any) {
      toast.error(e.message || "버전 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const rollback = async (version: FileVersion) => {
    const ok = await openConfirm({
      title: `버전 ${version.versionNum}으로 롤백`,
      message: `"${fileName}"을 버전 ${version.versionNum}으로 되돌립니다. 현재 상태는 자동으로 백업됩니다.`,
      confirmText: "롤백", confirmVariant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/files/${fileId}/versions/${version.id}/rollback`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast.success(data.message);
      onRollback?.();
      setOpen(false);
    } else toast.error(data.error || "롤백에 실패했습니다");
  };

  return (
    <div className="border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
      {confirmDialog}

      {/* 헤더 토글 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <History size={16} className="text-gray-500 dark:text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex-1 text-left">버전 기록</span>
        {versions.length > 0 && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
            {versions.length}개
          </span>
        )}
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          {/* 버전 저장 */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            {showCommentInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="버전 메모 (선택)"
                  className="flex-1 text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && saveVersion()}
                />
                <button onClick={saveVersion} disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button onClick={() => setShowCommentInput(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowCommentInput(true)}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">
                <Plus size={13} /> 현재 상태를 버전으로 저장
              </button>
            )}
          </div>

          {/* 버전 목록 */}
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
            {loading ? (
              <div className="p-4 flex justify-center">
                <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">저장된 버전이 없습니다</p>
            ) : versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  v{v.versionNum}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-slate-100">
                    {v.comment || `버전 ${v.versionNum}`}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock size={9} /> {timeAgo(v.createdAt)} · {v.user.name} · {formatFileSize(String(v.size))}
                  </p>
                </div>
                <button onClick={() => rollback(v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition shrink-0">
                  <RotateCcw size={10} /> 롤백
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-center text-gray-400 dark:text-slate-500 py-2">최대 10개 버전 보관</p>
        </div>
      )}
    </div>
  );
}
