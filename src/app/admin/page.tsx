"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Files,
  MessageSquare,
  BarChart2,
  ShieldAlert,
  ChevronLeft,
  Search,
  UserX,
  UserCheck,
  Trash2,
  RefreshCw,
  Crown,
  User,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  isOnline: boolean;
  createdAt: string;
  _count: { files: number; posts: number; comments: number };
}

interface Stats {
  totalUsers: number;
  totalFiles: number;
  totalPosts: number;
  totalComments: number;
  onlineUsers: number;
  adminCount: number;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { confirmDialog, openConfirm } = useConfirm();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "USER" | "ADMIN">("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 권한 체크
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      toast.error("데이터를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 역할 변경 (USER ↔ ADMIN)
  const toggleRole = async (user: UserRow) => {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    const confirmed = await openConfirm({
      title: "역할 변경",
      message: `${user.name}님을 ${newRole === "ADMIN" ? "관리자" : "일반 사용자"}로 변경할까요?`,
      confirmText: "변경",
      confirmVariant: "primary",
    });
    if (!confirmed) return;

    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      toast.success(`역할을 ${newRole === "ADMIN" ? "관리자" : "일반 사용자"}로 변경했습니다`);
    } catch {
      toast.error("역할 변경에 실패했습니다");
    } finally {
      setActionLoading(null);
    }
  };

  // 계정 삭제
  const deleteUser = async (user: UserRow) => {
    if (user.id === session?.user?.id) {
      toast.error("자신의 계정은 삭제할 수 없습니다");
      return;
    }
    const confirmed = await openConfirm({
      title: "계정 삭제",
      message: `${user.name}님의 계정을 삭제할까요? 모든 데이터가 영구 삭제됩니다.`,
      confirmText: "삭제",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (stats) setStats({ ...stats, totalUsers: stats.totalUsers - 1 });
      toast.success("계정을 삭제했습니다");
    } catch {
      toast.error("삭제에 실패했습니다");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (status === "loading" || (session && (session.user as any)?.role !== "ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 dark:bg-slate-900">
      {confirmDialog}

      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <ShieldAlert size={20} className="text-red-500" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">관리자 대시보드</h1>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 dark:bg-slate-700 transition-colors"
          >
            <RefreshCw size={16} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "전체 사용자", value: stats.totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "접속 중", value: stats.onlineUsers, icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
              { label: "관리자", value: stats.adminCount, icon: Crown, color: "text-yellow-600", bg: "bg-yellow-50" },
              { label: "파일 수", value: stats.totalFiles, icon: Files, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "게시글 수", value: stats.totalPosts, icon: BarChart2, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "댓글 수", value: stats.totalComments, icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-50" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 dark:border-slate-700 p-4">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                    <Icon size={16} className={s.color} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* 사용자 관리 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 dark:border-slate-700">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">사용자 관리</h2>
            <div className="flex gap-2 flex-wrap">
              {/* 검색 */}
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="이름 또는 이메일 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 역할 필터 */}
              <div className="flex gap-1">
                {(["ALL", "USER", "ADMIN"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      roleFilter === r
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200"
                    }`}
                  >
                    {r === "ALL" ? "전체" : r === "USER" ? "일반" : "관리자"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">
                검색 결과가 없습니다
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">사용자</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">역할</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 hidden md:table-cell">활동</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 hidden lg:table-cell">가입일</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">상태</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-900 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {u.name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-1">
                              {u.name}
                              {u.id === session?.user?.id && (
                                <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded">나</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          u.role === "ADMIN"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400"
                        }`}>
                          {u.role === "ADMIN" ? "👑 관리자" : "일반"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
                          <div>파일 {u._count.files}개</div>
                          <div>게시글 {u._count.posts}개</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${u.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-xs text-gray-500 dark:text-slate-400">{u.isOnline ? "온라인" : "오프라인"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleRole(u)}
                            disabled={actionLoading === u.id || u.id === session?.user?.id}
                            title={u.role === "ADMIN" ? "일반 사용자로 변경" : "관리자로 승격"}
                            className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 hover:text-yellow-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {u.role === "ADMIN" ? <User size={14} /> : <Crown size={14} />}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            disabled={actionLoading === u.id || u.id === session?.user?.id}
                            title="계정 삭제"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500">
            총 {filtered.length}명 / {users.length}명
          </div>
        </div>
      </div>
    </div>
  );
}
