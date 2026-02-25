"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Share2, Search, Download,
  LayoutGrid, List, RefreshCw, Eye,
} from "lucide-react";
import { getFileIcon, getFileColor, formatFileSize } from "@/lib/client-utils";
import FilePreviewModal from "@/components/FilePreviewModal";
import { toast } from "@/components/Toast";

interface SharedFile {
  id: string;
  filename: string;
  originalName: string;
  size: string;
  mimeType: string;
  thumbnailUrl: string | null;
  createdAt: string;
  sharedBy: string;
  sharedByEmail: string;
  permission: "VIEW" | "EDIT" | "ADMIN";
  sharedAt: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "오늘";
  if (days < 7) return `${days}일 전`;
  return new Date(d).toLocaleDateString("ko-KR");
}

export default function SharedPage() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"sharedAt" | "name" | "size">("sharedAt");
  const [preview, setPreview] = useState<SharedFile | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/shared");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      toast.error("공유 파일을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const filtered = files
    .filter((f) =>
      f.originalName.toLowerCase().includes(search.toLowerCase()) ||
      f.sharedBy.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.originalName.localeCompare(b.originalName);
      if (sortBy === "size") return Number(b.size) - Number(a.size);
      return new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime();
    });

  const permColor = {
    VIEW: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    EDIT: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    ADMIN: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400",
  };
  const permLabel = { VIEW: "읽기", EDIT: "편집", ADMIN: "관리" };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <FilePreviewModal
        file={preview ? { id: preview.id, originalName: preview.originalName, mimeType: preview.mimeType, size: preview.size } : null}
        onClose={() => setPreview(null)}
      />

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Share2 size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">
            공유받은 파일
            {files.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400 dark:text-slate-500">({files.length})</span>}
          </h1>
          <button onClick={fetch_} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={16} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* 검색 + 정렬 + 뷰 */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="파일명 또는 공유자 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none"
          >
            <option value="sharedAt">최신순</option>
            <option value="name">이름순</option>
            <option value="size">크기순</option>
          </select>
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode === "grid" ? "bg-white dark:bg-slate-700 shadow-sm" : ""}`}>
              <LayoutGrid size={15} className="text-gray-600 dark:text-slate-400" />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded ${viewMode === "list" ? "bg-white dark:bg-slate-700 shadow-sm" : ""}`}>
              <List size={15} className="text-gray-600 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" : "space-y-2"}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse aspect-square" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Share2 size={28} className="text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-medium">공유받은 파일이 없습니다</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">다른 사람이 파일을 공유하면 여기에 표시됩니다</p>
          </div>
        ) : viewMode === "grid" ? (
          /* 그리드 뷰 */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((f) => (
              <div key={f.id} className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all">
                {/* 썸네일 */}
                <div
                  className={`aspect-square flex items-center justify-center cursor-pointer ${
                    f.thumbnailUrl ? "bg-gray-50 dark:bg-slate-900" : getFileColor(f.mimeType)
                  }`}
                  onClick={() => setPreview(f)}
                >
                  {f.thumbnailUrl
                    ? <img src={f.thumbnailUrl} className="w-full h-full object-cover" alt={f.originalName} />
                    : <span className="text-4xl">{getFileIcon(f.mimeType)}</span>
                  }
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Eye size={20} className="text-white drop-shadow" />
                  </div>
                </div>
                {/* 정보 */}
                <div className="p-2.5">
                  <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{f.originalName}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{f.sharedBy} · {timeAgo(f.sharedAt)}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${permColor[f.permission]}`}>
                      {permLabel[f.permission]}
                    </span>
                    <a
                      href={`/api/files/${f.id}/download`}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      title="다운로드"
                    >
                      <Download size={12} className="text-gray-500 dark:text-slate-400" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 리스트 뷰 */
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">파일</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 hidden md:table-cell">공유자</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 hidden sm:table-cell">크기</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">권한</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 hidden lg:table-cell">공유일</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl shrink-0">{getFileIcon(f.mimeType)}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-[160px]">{f.originalName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600 dark:text-slate-400">{f.sharedBy}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500 dark:text-slate-400">{formatFileSize(f.size)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${permColor[f.permission]}`}>{permLabel[f.permission]}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400 dark:text-slate-500">{timeAgo(f.sharedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPreview(f)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="미리보기">
                          <Eye size={14} className="text-gray-500 dark:text-slate-400" />
                        </button>
                        <a href={`/api/files/${f.id}/download`} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="다운로드">
                          <Download size={14} className="text-gray-500 dark:text-slate-400" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
