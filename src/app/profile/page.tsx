"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatFileSize, storagePercent } from "@/lib/client-utils";

interface UserStats {
  totalFiles: number;
  totalPosts: number;
  totalComments: number;
  storageUsedBytes: number;
  storageUsedMB: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  isOnline: boolean;
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const { confirmDialog, openConfirm } = useConfirm();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 이름 변경 폼
  const [nameEdit, setNameEdit] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  // 비밀번호 변경 폼
  const [pwEdit, setPwEdit] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setStats(data.stats);
        setNewName(data.user.name);
      }
    } catch {
      toast.error("프로필 로드에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleNameSave = async () => {
    if (!newName.trim() || newName.trim() === user?.name) {
      setNameEdit(false);
      return;
    }
    setNameLoading(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, name: data.user.name } : prev);
        await updateSession({ name: data.user.name });
        toast.success("이름이 변경되었습니다");
        setNameEdit(false);
      } else {
        toast.error(data.error || "이름 변경에 실패했습니다");
      }
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.warning("모든 필드를 입력해주세요");
      return;
    }
    if (newPw !== confirmPw) {
      toast.warning("새 비밀번호가 일치하지 않습니다");
      return;
    }
    if (newPw.length < 8) {
      toast.warning("새 비밀번호는 8자 이상이어야 합니다");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("비밀번호가 변경되었습니다");
        setPwEdit(false);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        toast.error(data.error || "비밀번호 변경에 실패했습니다");
      }
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    openConfirm({
      title: "로그아웃",
      message: "로그아웃 하시겠습니까?",
      confirmLabel: "로그아웃",
      onConfirm: () => signOut({ callbackUrl: "/login" }),
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session || !user) return null;

  // 스토리지 사용률 (5GB 기준, client-utils)
  const usagePercent = stats ? storagePercent(stats.storageUsedBytes) : 0;
  const storageColor =
    usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-yellow-500" : "bg-blue-500";

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog}

      {/* 헤더 */}
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-bold text-gray-900">마이페이지</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* 프로필 카드 */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-4 mb-6">
            {/* 아바타 */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-500 text-sm">{user.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                user.role === "ADMIN"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {user.role === "ADMIN" ? "관리자" : "일반 사용자"}
              </span>
            </div>
          </div>

          {/* 통계 바 */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              {[
                { label: "파일", value: stats.totalFiles.toLocaleString() },
                { label: "게시글", value: stats.totalPosts.toLocaleString() },
                { label: "댓글", value: stats.totalComments.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 스토리지 */}
        {stats && (
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">☁️ 스토리지 사용량</h3>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{formatFileSize(stats.storageUsedBytes)} 사용 중</span>
              <span className="text-gray-400">/ 5 GB</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${storageColor}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{usagePercent.toFixed(1)}% 사용</p>
          </div>
        )}

        {/* 이름 변경 */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">✏️ 이름 변경</h3>
            {!nameEdit && (
              <button
                onClick={() => { setNameEdit(true); setNewName(user.name); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                변경
              </button>
            )}
          </div>

          {nameEdit ? (
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                placeholder="새 이름 입력"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setNameEdit(false); setNewName(user.name); }}
                  className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={handleNameSave}
                  disabled={nameLoading || !newName.trim()}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {nameLoading ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-900 font-medium">{user.name}</p>
          )}
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">🔒 비밀번호 변경</h3>
            {!pwEdit && (
              <button
                onClick={() => setPwEdit(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                변경
              </button>
            )}
          </div>

          {pwEdit ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                  placeholder="현재 비밀번호"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">새 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                  placeholder="새 비밀번호 (최소 8자)"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm ${
                    confirmPw && newPw !== confirmPw
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                  placeholder="새 비밀번호 재입력"
                />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setPwEdit(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
                  className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={handlePasswordSave}
                  disabled={pwLoading}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {pwLoading ? "변경 중..." : "변경하기"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">••••••••</p>
          )}
        </div>

        {/* 계정 정보 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">📋 계정 정보</h3>
          <dl className="space-y-3 text-sm">
            {[
              { label: "이메일", value: user.email },
              {
                label: "이메일 인증",
                value: user.emailVerified ? "✅ 인증 완료" : "⚠️ 미인증",
              },
              {
                label: "가입일",
                value: new Date(user.createdAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 빠른 이동 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🔗 바로가기</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/dashboard", label: "📁 파일 관리", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
              { href: "/posts", label: "📝 게시글", color: "bg-green-50 text-green-700 hover:bg-green-100" },
              { href: "/chat", label: "💬 채팅", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
              { href: "/search", label: "🔍 검색", color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
            ].map(({ href, label, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium transition ${color}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* 로그아웃 버튼 */}
        <div className="pb-8">
          <button
            onClick={handleLogout}
            className="w-full py-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition"
          >
            로그아웃
          </button>
        </div>
      </main>
    </div>
  );
}
