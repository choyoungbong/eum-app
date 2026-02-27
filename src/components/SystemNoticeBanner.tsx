"use client";
// src/components/SystemNoticeBanner.tsx
// providers.tsx에 포함 — 활성 시스템 공지를 상단에 표시

import { useState, useEffect } from "react";
import { X, AlertTriangle, Info, Wrench } from "lucide-react";

interface Notice {
  id: string; title: string; content: string; type: string;
}

const STYLES = {
  INFO:        "bg-blue-600 text-white",
  WARNING:     "bg-amber-500 text-white",
  MAINTENANCE: "bg-purple-700 text-white",
};
const ICONS = {
  INFO:        <Info size={14} className="shrink-0" />,
  WARNING:     <AlertTriangle size={14} className="shrink-0" />,
  MAINTENANCE: <Wrench size={14} className="shrink-0" />,
};

export default function SystemNoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/notices")
      .then((r) => r.json())
      .then((d) => setNotices(d.notices ?? []))
      .catch(() => {});
  }, []);

  const visible = notices.filter((n) => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  const top = visible[0];
  const style = STYLES[top.type as keyof typeof STYLES] ?? STYLES.INFO;
  const icon  = ICONS[top.type  as keyof typeof ICONS]  ?? ICONS.INFO;

  return (
    <div className={`${style} px-4 py-2 flex items-center gap-2 text-sm font-medium z-[9990]`}>
      {icon}
      <span className="flex-1 text-center text-xs">{top.title}: {top.content}</span>
      <button onClick={() => setDismissed((s) => new Set([...s, top.id]))} className="opacity-70 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}
