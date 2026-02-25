"use client";
// src/components/LikeBookmarkButtons.tsx
// 게시글 상세/목록 페이지에서 사용

import { useState, useEffect } from "react";
import { Heart, Bookmark } from "lucide-react";
import { toast } from "@/components/Toast";

interface Props {
  postId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  initialBookmarked?: boolean;
  compact?: boolean;
}

export default function LikeBookmarkButtons({
  postId, initialLiked = false, initialLikeCount = 0, initialBookmarked = false, compact = false,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // 마운트 시 최신 상태 조회
  useEffect(() => {
    Promise.all([
      fetch(`/api/posts/${postId}/like`).then((r) => r.json()),
      fetch(`/api/posts/${postId}/bookmark`).then((r) => r.json()),
    ]).then(([likeData, bookmarkData]) => {
      setLiked(likeData.liked);
      setLikeCount(likeData.count);
      setBookmarked(bookmarkData.bookmarked);
    }).catch(() => {});
  }, [postId]);

  const toggleLike = async () => {
    setLikeLoading(true);
    const prev = { liked, likeCount };
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.count);
    } catch {
      setLiked(prev.liked);
      setLikeCount(prev.likeCount);
      toast.error("오류가 발생했습니다");
    } finally {
      setLikeLoading(false);
    }
  };

  const toggleBookmark = async () => {
    setBookmarkLoading(true);
    setBookmarked(!bookmarked);
    try {
      const res = await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" });
      const data = await res.json();
      setBookmarked(data.bookmarked);
      toast.success(data.bookmarked ? "북마크에 추가됐습니다" : "북마크에서 제거됐습니다");
    } catch {
      setBookmarked(bookmarked);
      toast.error("오류가 발생했습니다");
    } finally {
      setBookmarkLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLike}
          disabled={likeLoading}
          className={`flex items-center gap-1 text-xs transition-colors ${
            liked ? "text-red-500" : "text-gray-400 dark:text-slate-500 hover:text-red-400"
          }`}
        >
          <Heart size={13} fill={liked ? "currentColor" : "none"} />
          {likeCount}
        </button>
        <button
          onClick={toggleBookmark}
          disabled={bookmarkLoading}
          className={`transition-colors ${
            bookmarked ? "text-yellow-500" : "text-gray-400 dark:text-slate-500 hover:text-yellow-400"
          }`}
        >
          <Bookmark size={13} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* 좋아요 */}
      <button
        onClick={toggleLike}
        disabled={likeLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          liked
            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 border border-transparent"
        } disabled:opacity-60`}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} className="transition-transform active:scale-125" />
        좋아요 {likeCount > 0 && <span className="font-bold">{likeCount}</span>}
      </button>

      {/* 북마크 */}
      <button
        onClick={toggleBookmark}
        disabled={bookmarkLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          bookmarked
            ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-500 border border-transparent"
        } disabled:opacity-60`}
      >
        <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
        {bookmarked ? "저장됨" : "저장"}
      </button>
    </div>
  );
}
