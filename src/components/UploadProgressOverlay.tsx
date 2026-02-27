"use client";
// src/components/UploadProgressOverlay.tsx
// 업로드 중인 파일 진행률을 하단 고정 오버레이로 표시
// providers.tsx에 추가 (MobileBottomNav 위에)

import { useUploadProgress } from "@/lib/socket-client";
import { X, Upload, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function UploadProgressOverlay() {
  const { uploads } = useUploadProgress();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = uploads.filter((u) => !dismissed.has(u.fileId));
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[9990] space-y-2 max-w-xs w-full">
      {visible.map((u) => (
        <div
          key={u.fileId}
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            {u.progress >= 100
              ? <CheckCircle size={14} className="text-green-500 shrink-0" />
              : <Upload size={14} className="text-blue-500 shrink-0 animate-bounce" />
            }
            <p className="text-xs font-medium text-gray-800 dark:text-slate-200 flex-1 truncate">
              {u.filename}
            </p>
            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
              {u.progress}%
            </span>
            {u.progress >= 100 && (
              <button
                onClick={() => setDismissed((s) => new Set([...s, u.fileId]))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                u.progress >= 100 ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${u.progress}%` }}
            />
          </div>
          {u.progress >= 100 && (
            <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-medium">
              ✓ 다른 기기에도 업로드 완료됨
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
