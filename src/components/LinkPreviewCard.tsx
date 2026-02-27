"use client";
// src/components/LinkPreviewCard.tsx
// 채팅 메시지 / 게시글 내 URL 자동 감지 후 OG 카드 표시

import { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface OGData {
  title:       string | null;
  description: string | null;
  image:       string | null;
  siteName:    string | null;
  url:         string;
  favicon:     string | null;
}

// 텍스트에서 첫 번째 URL 추출
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
export function extractFirstUrl(text: string): string | null {
  return text.match(URL_REGEX)?.[0] ?? null;
}

// 텍스트를 URL 링크로 변환 (렌더링용)
export function linkifyText(text: string): React.ReactNode {
  const parts = text.split(URL_REGEX);
  const urls  = text.match(URL_REGEX) ?? [];
  return parts.reduce<React.ReactNode[]>((acc, part, i) => {
    acc.push(part);
    if (urls[i]) {
      acc.push(
        <a key={i} href={urls[i]} target="_blank" rel="noopener noreferrer"
           className="text-blue-600 dark:text-blue-400 hover:underline break-all">
          {urls[i]}
        </a>
      );
    }
    return acc;
  }, []);
}

interface Props {
  url:       string;
  compact?:  boolean;
  className?: string;
}

export default function LinkPreviewCard({ url, compact = false, className = "" }: Props) {
  const [og, setOg]       = useState<OGData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setOg)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-100 dark:bg-slate-700 rounded-xl h-16 ${className}`} />
    );
  }
  if (error || !og) return null;

  if (compact) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
         className={`flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl border border-gray-100 dark:border-slate-600 transition-colors group ${className}`}>
        {og.favicon
          ? <img src={og.favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          : <Globe size={14} className="text-gray-400 shrink-0" />
        }
        <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate flex-1">{og.title ?? url}</span>
        <ExternalLink size={12} className="text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className={`block bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group ${className}`}>
      {og.image && (
        <div className="h-40 overflow-hidden bg-gray-100 dark:bg-slate-700">
          <img
            src={og.image}
            alt={og.title ?? ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {og.favicon
            ? <img src={og.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            : <Globe size={12} className="text-gray-400" />
          }
          <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide">{og.siteName}</span>
        </div>
        {og.title && (
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 line-clamp-2 mb-1">{og.title}</p>
        )}
        {og.description && (
          <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{og.description}</p>
        )}
      </div>
    </a>
  );
}

// ──────────────────────────────────────────────────────────
// 사용 예시 (채팅 메시지 렌더링)
// ──────────────────────────────────────────────────────────
// import LinkPreviewCard, { extractFirstUrl, linkifyText } from "@/components/LinkPreviewCard";
//
// function ChatMessage({ content }: { content: string }) {
//   const previewUrl = extractFirstUrl(content);
//   return (
//     <div>
//       <p>{linkifyText(content)}</p>
//       {previewUrl && <LinkPreviewCard url={previewUrl} compact className="mt-2" />}
//     </div>
//   );
// }
