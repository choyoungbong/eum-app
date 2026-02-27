"use client";
// src/app/users/search/page.tsx
// ✅ 수정: useSearchParams를 Suspense로 감싸는 패턴 적용

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Search, Users, UserPlus, UserCheck } from "lucide-react";
import { toast } from "@/components/Toast";

interface SearchUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isOnline: boolean;
  createdAt: string;
  isFollowing: boolean;
  _count: { files: number; posts: number };
}

// ✅ useSearchParams를 사용하는 부분을 별도 컴포넌트로 분리
function UserSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setUsers([]); setTotal(0); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      const init = new Set<string>(data.users.filter((u: SearchUser) => u.isFollowing).map((u: SearchUser) => u.id));
      setFollowing(init);
    } catch {
      toast.error("검색에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
      if (query) router.replace(`/users/search?q=${encodeURIComponent(query)}`, { scroll: false });
    }, 300);
  }, [query, search, router]);

  const toggleFollow = async (userId: string) => {
    const isNowFollowing = following.has(userId);
    const method = isNowFollowing ? "DELETE" : "POST";
    setFollowing((s) => { const n = new Set(s); isNowFollowing ? n.delete(userId) : n.add(userId); return n; });
    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method });
      if (!res.ok) throw new Error();
      toast.success(isNowFollowing ? "팔로우를 취소했습니다" : "팔로우했습니다");
    } catch {
      setFollowing((s) => { const n = new Set(s); isNowFollowing ? n.add(userId) : n.delete(userId); return n; });
      toast.error("오류가 발생했습니다");
    }
  };

  return (
    <>
      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 이메일로 검색"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {query && !loading && (
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 px-1">
            {total > 0 ? `"${query}" 검색 결과 ${total}명` : `"${query}"에 해당하는 사용자가 없습니다`}
          </p>
        )}

        {loading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700/50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!query && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Users size={28} className="text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-medium">사용자를 검색하세요</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">이름이나 이메일로 검색할 수 있습니다</p>
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <Link href={`/users/${u.id}`} className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      {u.name[0]}
                    </div>
                    {u.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                    )}
                  </Link>
                  <Link href={`/users/${u.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{u.name}</p>
                      {u.role === "ADMIN" && (
                        <span className="text-[9px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">관리자</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                      파일 {u._count.files} · 게시글 {u._count.posts}
                    </p>
                  </Link>
                  <button
                    onClick={() => toggleFollow(u.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                      following.has(u.id)
                        ? "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {following.has(u.id) ? <><UserCheck size={12} /> 팔로잉</> : <><UserPlus size={12} /> 팔로우</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ✅ 페이지 진입점 — Suspense로 감싸서 useSearchParams 허용
export default function UserSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }>
        <UserSearchContent />
      </Suspense>
    </div>
  );
}
