"use client";
// src/components/SoundToggle.tsx
// 알림 설정 페이지 또는 헤더에 추가

import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled, sound } from "@/lib/sound";

export default function SoundToggle({ compact = false }: { compact?: boolean }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => { setEnabled(isSoundEnabled()); }, []);

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
    if (next) sound.success(); // 켤 때 미리보기
  };

  if (compact) {
    return (
      <button onClick={toggle} title={enabled ? "알림 소리 끄기" : "알림 소리 켜기"}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
        {enabled
          ? <Volume2 size={18} className="text-blue-600 dark:text-blue-400" />
          : <VolumeX size={18} className="text-gray-400 dark:text-slate-500" />
        }
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
      <div className="flex items-center gap-3">
        {enabled
          ? <Volume2 size={18} className="text-blue-600 dark:text-blue-400" />
          : <VolumeX size={18} className="text-gray-400 dark:text-slate-500" />
        }
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">알림 사운드</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">메시지·알림·오류 소리</p>
        </div>
      </div>
      <button
        onClick={toggle}
        className={`w-11 h-6 rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-600"}`}
      >
        <span className={`block w-4.5 h-4.5 bg-white rounded-full shadow transition-transform mx-0.5 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
