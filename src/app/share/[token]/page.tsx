"use client";
// src/app/share/[token]/page.tsx — 공개 공유 링크 페이지 (비로그인 접근)

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Download, File, Cloud, AlertCircle } from "lucide-react";
import { getFileIcon, formatFileSize } from "@/lib/client-utils";

interface ShareMeta {
  originalName: string;
  mimeType: string;
  size: string;
  thumbnailUrl: string | null;
  createdAt: string;
  ownerName: string;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setMeta)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const isImage = meta?.mimeType.startsWith("image/");
  const isVideo = meta?.mimeType.startsWith("video/");
  const isAudio = meta?.mimeType.startsWith("audio/");

  return (
    <div className="min-h-screen bg-[#0f0c29] flex flex-col items-center justify-center px-4 text-white">
      {/* 배경 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-700/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-700/10 rounded-full blur-[80px]" />
      </div>

      {/* 로고 */}
      <Link href="/" className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <Cloud size={16} className="text-white" />
        </div>
        <span className="text-lg font-black">이음</span>
      </Link>

      {loading && (
        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      )}

      {error && (
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">파일을 찾을 수 없습니다</h2>
          <p className="text-white/40 text-sm">링크가 만료되었거나 삭제된 파일입니다.</p>
        </div>
      )}

      {meta && !error && (
        <div className="w-full max-w-lg">
          <div className="bg-white/5 border border-white/10 rounded-[28px] overflow-hidden">
            {/* 미리보기 */}
            <div className="bg-black/20 min-h-48 flex items-center justify-center p-6">
              {isImage && (
                <img
                  src={`/api/share/${token}?download=1`}
                  alt={meta.originalName}
                  className="max-h-72 max-w-full rounded-xl object-contain shadow-2xl"
                />
              )}
              {isVideo && (
                <video
                  src={`/api/share/${token}?download=1`}
                  controls
                  className="max-h-72 max-w-full rounded-xl"
                />
              )}
              {isAudio && (
                <div className="text-center space-y-4">
                  <div className="text-6xl">{getFileIcon(meta.mimeType)}</div>
                  <audio src={`/api/share/${token}?download=1`} controls className="w-full" />
                </div>
              )}
              {!isImage && !isVideo && !isAudio && (
                <div className="text-center">
                  <span className="text-7xl">{getFileIcon(meta.mimeType)}</span>
                </div>
              )}
            </div>

            {/* 파일 정보 */}
            <div className="p-6 space-y-4">
              <div>
                <h1 className="text-lg font-bold break-all">{meta.originalName}</h1>
                <p className="text-sm text-white/40 mt-1">
                  {formatFileSize(meta.size)} · {meta.ownerName}이 공유 · {new Date(meta.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>

              {/* 다운로드 버튼 */}
              <a
                href={`/api/share/${token}?download=1`}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-white text-black font-bold rounded-2xl hover:bg-purple-50 transition-all"
              >
                <Download size={18} />
                파일 다운로드
              </a>

              <p className="text-center text-xs text-white/20">
                이음 퍼스널 클라우드로 공유됨 ·{" "}
                <Link href="/register" className="hover:text-white/50 underline">
                  무료로 시작하기
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
