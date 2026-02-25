"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, UserCheck, UserPlus, Users, FileText, MessageSquare } from "lucide-react";
import { toast } from "@/components/Toast";

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isOnline: boolean;
  createdAt: string;
  _count: { files: number; posts: number; comments: number };
}

interface FollowInfo {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

interface FollowUser {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  followedAt: string;
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [followInfo, setFollowInfo] = useState<FollowInfo | null>(null);
  const [tab, setTab] = useState<"followers" | "following">("followers");
  const [tabUsers, setTabUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showTab, setShowTab] = useState(false);

  const isSelf = session?.user?.id === id;

  const fetchUser = useCallback(async () => {
    try {
      const [uRes, fRes] = await Promise.all([
        fetch(`/api/users/${id}/public`),
        fetch(`/api/users/${id}/follow`),
      ]);
      if (uRes.ok) setUser(await uRes.json());
      if (fRes.ok) setFollowInfo(await fRes.json());
    } catch {
      toast.error("사용자 정보를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTabUsers = useCallback(async () => {
    const res = await fetch(`/api/users/${id}/followers?type=${tab}`);
    if (res.ok) setTabUsers((await res.json()).users);
  }, [id, tab]);

  useEffect(() => { fetchUser(); }, [fetchUser]);
  useEffect(() => { if (showTab) fetchTabUsers(); }, [showTab, fetchTabUsers]);

  const toggleFollow = async () => {
    if (!session) { router.push("/login"); return; }
    if (!followInfo) return;
    setFollowLoading(true);
    try {
      const method = followInfo.isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/users/${id}/follow`, { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFollowInfo((f) => f ? {
        ...f,
        isFollowing: data.following,
        followerCount: f.followerCount + (data.following ? 1 : -1),
      } : f);
      toast.success(data.following ? "팔로우했습니다" : "팔로우를 취소했습니다");
    } catch (e: any) {
      toast.error(e.message || "오류가 발생했습니다");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 dark:text-slate-400">사용자를 찾을 수 없습니다</p>
      <Link href="/dashboard" className="text-blue-600 text-sm hover:underline">대시보드로</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1 truncate">
            {user.name}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 프로필 카드 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
          <div className="flex items-start gap-4">
            {/* 아바타 */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {user.name[0]}
              </div>
              <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${
                user.isOnline ? "bg-green-500" : "bg-gray-300"
              }`} />
            </div>

            {/* 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">{user.name}</h2>
                {user.role === "ADMIN" && (
                  <span className="text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">👑 관리자</span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{user.email}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                {user.isOnline ? "🟢 온라인" : "⚫ 오프라인"} · {new Date(user.createdAt).toLocaleDateString("ko-KR")} 가입
              </p>
            </div>

            {/* 팔로우 버튼 */}
            {!isSelf && session && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
                  followInfo?.isFollowing
                    ? "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-50`}
              >
                {followInfo?.isFollowing
                  ? <><UserCheck size={15} /> 팔로잉</>
                  : <><UserPlus size={15} /> 팔로우</>
                }
              </button>
            )}
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-5 border-t border-gray-100 dark:border-slate-700">
            {[
              { label: "팔로워", value: followInfo?.followerCount ?? 0, onClick: () => { setTab("followers"); setShowTab(true); } },
              { label: "팔로잉", value: followInfo?.followingCount ?? 0, onClick: () => { setTab("following"); setShowTab(true); } },
              { label: "게시글", value: user._count.posts, onClick: undefined },
              { label: "파일",   value: user._count.files, onClick: undefined },
            ].map(({ label, value, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={!onClick}
                className={`text-center ${onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg p-1 transition-colors" : "cursor-default"}`}
              >
                <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 팔로워/팔로잉 목록 */}
        {showTab && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
            <div className="flex border-b border-gray-100 dark:border-slate-700">
              {(["followers", "following"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    tab === t
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                  }`}
                >
                  {t === "followers" ? `팔로워 ${followInfo?.followerCount ?? 0}` : `팔로잉 ${followInfo?.followingCount ?? 0}`}
                </button>
              ))}
              <button onClick={() => setShowTab(false)} className="px-4 text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {tabUsers.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">
                  {tab === "followers" ? "팔로워가 없습니다" : "팔로잉 중인 사용자가 없습니다"}
                </p>
              ) : tabUsers.map((u) => (
                <Link key={u.id} href={`/users/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {u.name[0]}
                    </div>
                    {u.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white dark:border-slate-800" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 게시글 바로가기 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <Link href={`/posts?author=${id}`} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">작성한 게시글</span>
            </div>
            <span className="text-sm text-blue-600 dark:text-blue-400 group-hover:underline">보기 →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
