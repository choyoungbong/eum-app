"use client";
// src/components/StorageQuotaBar.tsx
// 대시보드 사이드바 또는 헤더에 삽입

import { useState, useEffect } from "react";
import { HardDrive, AlertTriangle } from "lucide-react";

function formatBytes(bytes: string | bigint): string {
  const n = typeof bytes === "string" ? parseInt(bytes) : Number(bytes);
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)}GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)}MB`;
  if (n >= 1024)      return `${(n / 1024).toFixed(0)}KB`;
  return `${n}B`;
}

export default function StorageQuotaBar() {
  const [data, setData] = useState<{
    storageUsed: string; storageLimit: string; percentage: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/users/me/storage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const isWarning  = data.percentage >= 80;
  const isCritical = data.percentage >= 95;

  return (
    <div className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-1.5">
        {isCritical
          ? <AlertTriangle size={13} className="text-red-500 shrink-0" />
          : <HardDrive size={13} className={`shrink-0 ${isWarning ? "text-amber-500" : "text-gray-500 dark:text-slate-400"}`} />
        }
        <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 flex-1">저장 공간</span>
        <span className={`text-[10px] font-bold ${
          isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-gray-500 dark:text-slate-400"
        }`}>
          {data.percentage}%
        </span>
      </div>

      {/* 바 */}
      <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${Math.min(data.percentage, 100)}%` }}
        />
      </div>

      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
        {formatBytes(data.storageUsed)} / {formatBytes(data.storageLimit)}
      </p>

      {isCritical && (
        <p className="text-[9px] text-red-500 font-semibold mt-1">
          ⚠️ 저장 공간이 거의 가득 찼습니다. 파일을 정리하세요.
        </p>
      )}
    </div>
  );
}
