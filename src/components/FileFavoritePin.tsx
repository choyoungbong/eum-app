"use client";
// src/components/FileFavoritePin.tsx
// ⚠️ 수정: PinnedFilesSection의 require("react") 버그 제거

import { useState, useEffect } from "react";
import { Star, Pin } from "lucide-react";
import { toast } from "@/components/Toast";

interface Props {
  fileId:    string;
  isStarred: boolean;
  isPinned:  boolean;
  onUpdate?: (starred: boolean, pinned: boolean) => void;
}

export default function FileFavoritePin({ fileId, isStarred: initStarred, isPinned: initPinned, onUpdate }: Props) {
  const [starred, setStarred] = useState(initStarred);
  const [pinned,  setPinned]  = useState(initPinned);
  const [loading, setLoading] = useState(false);

  async function toggleStar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { starred: s } = await res.json();
      setStarred(s);
      onUpdate?.(s, pinned);
      toast.success(s ? "즐겨찾기에 추가했습니다" : "즐겨찾기를 해제했습니다");
    } catch {
      toast.error("처리에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function togglePin() {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/favorite`, { method: "PATCH" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "처리에 실패했습니다");
        return;
      }
      const { pinned: p } = await res.json();
      setPinned(p);
      onUpdate?.(starred, p);
      toast.success(p ? "파일을 고정했습니다" : "고정을 해제했습니다");
    } catch {
      toast.error("처리에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={toggleStar} disabled={loading}
        className={`p-1.5 rounded-lg transition ${starred ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"}`}
        title={starred ? "즐겨찾기 해제" : "즐겨찾기"}>
        <Star size={14} fill={starred ? "currentColor" : "none"} />
      </button>
      <button onClick={togglePin} disabled={loading}
        className={`p-1.5 rounded-lg transition ${pinned ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
        title={pinned ? "고정 해제" : "고정"}>
        <Pin size={14} fill={pinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function PinnedFilesSection() {
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/files?pinned=true&limit=10")
      .then((r) => r.json())
      .then((d) => setFiles(d.files ?? []))
      .catch(() => {});
  }, []);

  if (files.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Pin size={14} className="text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">고정된 파일</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {files.map((f) => (
          <div key={f.id} className="shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 w-36 hover:shadow-md transition cursor-pointer">
            <div className="text-2xl mb-2 text-center">
              {f.mimeType?.startsWith("image/") && f.thumbnailUrl
                ? <img src={f.thumbnailUrl} alt={f.originalName} className="w-full h-16 object-cover rounded-lg" />
                : <span>📄</span>}
            </div>
            <p className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{f.originalName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
