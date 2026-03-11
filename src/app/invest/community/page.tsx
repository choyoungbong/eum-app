"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Plus, MessageSquare, TrendingUp, X,
  BarChart2, Coins, Globe, Ticket, Layers, Eye, Lock,
  ChevronRight, Clock, Tag as TagIcon, Send,
} from "lucide-react";
import { toast } from "@/components/Toast";
import InvestNav from "@/components/InvestNav";

// ── 타입 ──────────────────────────────────────────────
interface Post {
  id: string; title: string; content: string;
  category: string; visibility: string; createdAt: string;
  user: { id: string; name: string };
  _count: { comments: number };
  postTags: { tag: { id: string; name: string } }[];
}
interface Pagination { total: number; page: number; limit: number; hasNext: boolean; }

// ── 상수 ──────────────────────────────────────────────
const CATEGORIES = [
  { key: "ALL",    label: "전체",    icon: Layers,    color: "text-zinc-400",   bg: "bg-zinc-800" },
  { key: "KOSPI",  label: "코스피",  icon: BarChart2, color: "text-blue-400",   bg: "bg-blue-500/10" },
  { key: "KOSDAQ", label: "코스닥",  icon: BarChart2, color: "text-emerald-400",bg: "bg-emerald-500/10" },
  { key: "NASDAQ", label: "나스닥",  icon: TrendingUp,color: "text-violet-400", bg: "bg-violet-500/10" },
  { key: "SP500",  label: "S&P500",  icon: Globe,     color: "text-orange-400", bg: "bg-orange-500/10" },
  { key: "CRYPTO", label: "코인",    icon: Coins,     color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { key: "LOTTO",  label: "로또",    icon: Ticket,    color: "text-pink-400",   bg: "bg-pink-500/10" },
  { key: "FREE",   label: "자유",    icon: MessageSquare, color: "text-zinc-400", bg: "bg-zinc-700/40" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

const getCatInfo = (key: string) =>
  CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

// ── 글쓰기 모달 ───────────────────────────────────────
function WriteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [category, setCategory] = useState<string>("FREE");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]         = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t) && tags.length < 5) { setTags([...tags, t]); setTagInput(""); }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { toast.warning("제목과 내용을 입력하세요"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invest/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category, visibility, tags }),
      });
      if (res.ok) { toast.success("게시글이 등록되었습니다"); onSuccess(); onClose(); }
      else { const d = await res.json(); toast.error(d.error ?? "등록 실패"); }
    } catch { toast.error("등록 중 오류가 발생했습니다"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-zinc-900 border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 sticky top-0 bg-zinc-900 rounded-t-3xl sm:rounded-t-2xl">
          <h3 className="font-semibold text-zinc-100">글쓰기</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-300 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 카테고리 */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">카테고리</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter((c) => c.key !== "ALL").map(({ key, label, icon: Icon, color, bg }) => (
                <button key={key} onClick={() => setCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    category === key
                      ? `${bg} ${color} border-current/30`
                      : "bg-zinc-800/60 text-zinc-500 border-zinc-700 hover:border-zinc-500"
                  }`}>
                  <Icon size={11} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors" />

          {/* 내용 */}
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="종목 분석, 투자 의견을 자유롭게 작성하세요..."
            rows={6}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 resize-none transition-colors" />

          {/* 태그 */}
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">태그 (최대 5개)</p>
            <div className="flex gap-2">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="#삼성전자"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl outline-none text-xs text-zinc-100 placeholder:text-zinc-600 transition-colors" />
              <button onClick={addTag} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-xs text-zinc-300 transition-colors">추가</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-violet-500/10 text-violet-400 text-xs rounded-full">
                    #{t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-400 transition-colors"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 공개 설정 */}
          <div className="flex items-center gap-2">
            {(["PUBLIC", "PRIVATE"] as const).map((v) => (
              <button key={v} onClick={() => setVisibility(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${
                  visibility === v
                    ? "bg-white/8 text-zinc-200 border-white/15"
                    : "text-zinc-500 border-zinc-700 hover:border-zinc-500"
                }`}>
                {v === "PUBLIC" ? <Eye size={11} /> : <Lock size={11} />}
                {v === "PUBLIC" ? "전체 공개" : "비공개"}
              </button>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-5">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            <Send size={14} />
            {submitting ? "등록 중..." : "게시글 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────
export default function CommunityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [category, setCategory] = useState<CategoryKey>("ALL");
  const [posts, setPosts]       = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [showWrite, setShowWrite] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchPosts = useCallback(async (cat: CategoryKey, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (cat !== "ALL") params.set("category", cat);
      const res = await fetch(`/api/invest/community?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
        setPagination(data.pagination ?? null);
      }
    } catch { toast.error("게시글을 불러오는데 실패했습니다"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchPosts(category, page);
  }, [session, category, page, fetchPosts]);

  const handleCategoryChange = (cat: CategoryKey) => {
    setCategory(cat); setPage(1);
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 배경 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                <MessageSquare size={13} className="text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">종목 토론</h1>
            </div>
          </div>
          <button onClick={() => setShowWrite(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors">
            <Plus size={13} /> 글쓰기
          </button>
        </div>

        {/* 카테고리 탭 */}
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          {CATEGORIES.map(({ key, label, icon: Icon, color }) => (
            <button key={key} onClick={() => handleCategoryChange(key as CategoryKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all border ${
                category === key
                  ? `bg-white/8 ${color} border-white/10`
                  : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/4"
              }`}>
              <Icon size={11} />{label}
              {category === key && pagination && (
                <span className="ml-0.5 text-zinc-600">{pagination.total}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-20 py-4 relative">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 bg-white/3 rounded-2xl border border-white/4">
                <div className="flex gap-3 items-start">
                  <div className="w-16 h-5 bg-white/6 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/6 rounded w-3/4" />
                    <div className="h-3 bg-white/4 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-zinc-700" />
            </div>
            <p className="text-zinc-500 font-medium">아직 게시글이 없습니다</p>
            <p className="text-zinc-700 text-xs mt-1">첫 번째 투자 의견을 남겨보세요</p>
            <button onClick={() => setShowWrite(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
              <Plus size={14} /> 글쓰기
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {posts.map((post) => {
                const cat = getCatInfo(post.category);
                const Icon = cat.icon;
                return (
                  <Link key={post.id} href={`/posts/${post.id}`}
                    className="block p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all group">
                    <div className="flex items-start gap-3">
                      {/* 카테고리 뱃지 */}
                      <div className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold ${cat.bg} ${cat.color} border border-current/20`}>
                        <Icon size={10} />{cat.label}
                      </div>
                      {/* 공개 여부 */}
                      {post.visibility !== "PUBLIC" && (
                        <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] bg-zinc-800 text-zinc-500 border border-zinc-700">
                          <Lock size={9} /> 비공개
                        </div>
                      )}
                    </div>

                    <h3 className="mt-2.5 font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                      {post.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600 line-clamp-1">{post.content}</p>

                    {/* 태그 */}
                    {post.postTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {post.postTags.map(({ tag }) => (
                          <span key={tag.id} className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] bg-violet-500/8 text-violet-400/80 rounded-full">
                            <TagIcon size={9} />{tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 메타 */}
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-600">
                      <span className="font-medium text-zinc-500">{post.user.name}</span>
                      <span className="flex items-center gap-1"><Clock size={9} />{timeAgo(post.createdAt)}</span>
                      <span className="flex items-center gap-1 ml-auto"><MessageSquare size={9} />{post._count.comments}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {pagination && (pagination.page > 1 || pagination.hasNext) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/6">
                <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft size={13} /> 이전
                </button>
                <span className="text-xs text-zinc-600">
                  {page} / {Math.ceil((pagination.total || 1) / pagination.limit)} 페이지
                  <span className="ml-1.5 text-zinc-700">· 총 {pagination.total}개</span>
                </span>
                <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNext || loading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  다음 <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 글쓰기 모달 */}
      {showWrite && (
        <WriteModal
          onClose={() => setShowWrite(false)}
          onSuccess={() => fetchPosts(category, 1)}
        />
      )}
      <InvestNav />
    </div>
  );
}
