"use client";
// src/app/posts/page.tsx — EUM 브랜딩 고도화

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import {
  PenSquare, Globe, Lock, Share2, MessageSquare,
  ChevronLeft, Sparkles, BookOpen, Users,
} from "lucide-react";

interface Post {
  id: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: string;
  user: { id: string; name: string };
  _count: { comments: number };
  isOwner: boolean;
  isShared: boolean;
  sharedBy?: string;
}

const FILTERS = [
  { key: "all",    label: "전체",     icon: BookOpen,  active: "bg-violet-600 text-white border-violet-600",   inactive: "text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200" },
  { key: "my",     label: "내 글",    icon: PenSquare, active: "bg-violet-600 text-white border-violet-600",   inactive: "text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200" },
  { key: "public", label: "공개",     icon: Globe,     active: "bg-emerald-600 text-white border-emerald-600", inactive: "text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200" },
  { key: "shared", label: "공유받음", icon: Share2,    active: "bg-blue-600 text-white border-blue-600",       inactive: "text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200" },
] as const;

const VISIBILITY_META = {
  PUBLIC:  { label: "공개",   icon: Globe,   cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  SHARED:  { label: "공유",   icon: Share2,  cls: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  PRIVATE: { label: "비공개", icon: Lock,    cls: "bg-zinc-700/60 text-zinc-400 border border-zinc-600/30" },
};

export default function PostsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "my" | "public" | "shared">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchPosts();
  }, [session, filter, searchQuery]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("visibility", filter);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/posts?${params}`);
      if (res.ok) setPosts((await res.json()).posts);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 배경 장식 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                <BookOpen size={14} className="text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">게시판</h1>
            </div>
          </div>
          <Link
            href="/posts/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <PenSquare size={14} />
            글쓰기
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 relative">

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(({ key, label, icon: Icon, active, inactive }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                filter === key ? active : inactive
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="mb-5">
          <SearchBar onSearch={setSearchQuery} placeholder="게시글 검색..." />
        </div>

        {/* 공개 설정 안내 배너 */}
        <div className="mb-6 p-4 rounded-xl bg-white/3 border border-white/6 text-sm text-zinc-400 flex gap-3">
          <Sparkles size={16} className="text-violet-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-zinc-300 font-medium block mb-1">공개 설정 안내</span>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
              <span><Lock size={11} className="inline mr-1 text-zinc-500" />비공개: 나만</span>
              <span><Share2 size={11} className="inline mr-1 text-blue-400" />공유: 특정 사용자</span>
              <span><Globe size={11} className="inline mr-1 text-emerald-400" />공개: 전체</span>
            </div>
          </div>
        </div>

        {/* 게시글 목록 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/3 rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-white/5 rounded w-2/3 mb-3" />
                <div className="h-3 bg-white/4 rounded w-full mb-2" />
                <div className="h-3 bg-white/4 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={28} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-1">게시글이 없습니다</p>
            <p className="text-zinc-600 text-sm mb-6">
              {filter === "shared" ? "공유받은 글이 없습니다" : "첫 게시글을 작성해보세요"}
            </p>
            <Link href="/posts/new" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
              <PenSquare size={14} />글 작성하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const vis = VISIBILITY_META[post.visibility as keyof typeof VISIBILITY_META] ?? VISIBILITY_META.PRIVATE;
              const VisIcon = vis.icon;
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className={`group block bg-white/3 hover:bg-white/5 border rounded-2xl p-5 transition-all duration-200 ${
                    post.isShared ? "border-blue-500/20 hover:border-blue-500/30" : "border-white/5 hover:border-white/10"
                  }`}
                >
                  {post.isShared && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-blue-400 bg-blue-500/8 px-3 py-1.5 rounded-lg border border-blue-500/15 w-fit">
                      <Share2 size={11} />
                      <span><strong>{post.sharedBy}님</strong>이 공유한 글</span>
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors line-clamp-1 mb-1.5">
                        {post.title}
                      </h3>
                      <p className="text-sm text-zinc-500 line-clamp-2 mb-3 leading-relaxed">{post.content}</p>
                      <div className="flex items-center gap-3 text-xs text-zinc-600">
                        <span className="flex items-center gap-1"><Users size={11} />{post.isShared ? post.sharedBy : post.user.name}</span>
                        <span>·</span>
                        <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><MessageSquare size={11} />{post._count.comments}</span>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full shrink-0 font-medium ${vis.cls}`}>
                      <VisIcon size={10} />{vis.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
