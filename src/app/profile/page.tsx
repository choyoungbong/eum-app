"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatFileSize, storagePercent } from "@/lib/client-utils";

// --- 인터페이스 정의 ---
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

// --- 실제 로직이 담긴 컨텐츠 컴포넌트 ---
function ProfileContent() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams(); // 이제 Suspense 내부에서 안전하게 호출됩니다.
  const { confirmDialog, openConfirm } = useConfirm();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // URL 파라미터 체크 (인증 완료 후 진입 시)
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("이메일 인증이 완료되었습니다!");
    }
  }, [searchParams]);

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
        setUser((prev) => (prev ? { ...prev, name: data.user.name } : prev));
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

  const sendVerificationEmail = async () => {
    setSendingVerification(true);
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerificationSent(true);
      toast.success("인증 이메일을 발송했습니다. 받은편지함을 확인해주세요.");
    } catch (e: any) {
      toast.error(e.message || "이메일 발송에 실패했습니다");
    } finally {
      setSendingVerification(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "계정삭제") return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });
      if (!res.ok) throw new Error();
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("계정 삭제에 실패했습니다. 다시 시도해주세요.");
      setIsDeleting(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session || !user) return null;

  const usagePercent = stats ? storagePercent(stats.storageUsedBytes) : 0;
  const storageColor =
    usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-yellow-500" : "bg-blue-500";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {confirmDialog}

      <header className="bg-white dark:bg-slate-800 shadow dark:shadow-slate-700/30 sticky top-0 z-10 border-b border-gray-100 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 flex items-center gap-2 text-sm">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">마이페이지</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 프로필 카드 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">{user.name}</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm">{user.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                user.role === "ADMIN"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400"
              }`}>
                {user.role === "ADMIN" ? "관리자" : "일반 사용자"}
              </span>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              {[
                { label: "파일", value: stats.totalFiles.toLocaleString() },
                { label: "게시글", value: stats.totalPosts.toLocaleString() },
                { label: "댓글", value: stats.totalComments.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 스토리지 */}
        {stats && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">☁️ 스토리지 사용량</h3>
            <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400 mb-2">
              <span>{formatFileSize(stats.storageUsedBytes)} 사용 중</span>
              <span className="text-gray-400 dark:text-slate-500">/ 5 GB</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5">
              <div className={`h-2.5 rounded-full transition-all ${storageColor}`} style={{ width: `${usagePercent}%` }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">{usagePercent.toFixed(1)}% 사용</p>
          </div>
        )}

        {/* 이름 변경 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">✏️ 이름 변경</h3>
            {!nameEdit && (
              <button onClick={() => { setNameEdit(true); setNewName(user.name); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
                placeholder="새 이름 입력"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setNameEdit(false); setNewName(user.name); }} className="px-4 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  취소
                </button>
                <button onClick={handleNameSave} disabled={nameLoading || !newName.trim()} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {nameLoading ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-900 dark:text-slate-100 font-medium">{user.name}</p>
          )}
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">🔒 비밀번호 변경</h3>
            {!pwEdit && (
              <button onClick={() => setPwEdit(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                변경
              </button>
            )}
          </div>
          {pwEdit ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
                  placeholder="현재 비밀번호"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">새 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm"
                  placeholder="새 비밀번호 (최소 8자)"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm ${
                    confirmPw && newPw !== confirmPw ? "border-red-400" : "border-gray-300 dark:border-slate-600"
                  }`}
                  placeholder="새 비밀번호 재입력"
                />
                {confirmPw && newPw !== confirmPw && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setPwEdit(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} className="px-4 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  취소
                </button>
                <button onClick={handlePasswordSave} disabled={pwLoading} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {pwLoading ? "변경 중..." : "변경하기"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 dark:text-slate-500 text-sm">••••••••</p>
          )}
        </div>

        {/* 계정 정보 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">📋 계정 정보</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-slate-400">이메일</dt>
              <dd className="font-medium text-gray-900 dark:text-slate-100">{user.email}</dd>
            </div>
            <div className="flex justify-between items-start">
              <dt className="text-gray-500 dark:text-slate-400">이메일 인증</dt>
              <dd className="text-right">
                <p className="font-medium text-gray-900 dark:text-slate-100">{user.emailVerified ? "✅ 인증 완료" : "⚠️ 미인증"}</p>
                {!user.emailVerified && (
                  <button onClick={sendVerificationEmail} disabled={sendingVerification || verificationSent} className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                    {verificationSent ? "발송됨 ✓" : sendingVerification ? "발송 중..." : "인증 이메일 재발송"}
                  </button>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-slate-400">가입일</dt>
              <dd className="font-medium text-gray-900 dark:text-slate-100">
                {new Date(user.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              </dd>
            </div>
          </dl>
        </div>

        {/* 바로가기 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">🔗 바로가기</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/dashboard", label: "📁 파일 관리", color: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300" },
              { href: "/posts", label: "📝 게시글", color: "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300" },
              { href: "/chat", label: "💬 채팅", color: "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300" },
              { href: "/search", label: "🔍 검색", color: "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300" },
              { href: "/notifications", label: "🔔 알림", color: "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-slate-700 dark:text-slate-300" },
              ...(user.role === "ADMIN" ? [{ href: "/admin", label: "🛡️ 관리자", color: "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300" }] : []),
            ].map(({ href, label, color }) => (
              <Link key={href} href={href} className={`flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium transition ${color}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* 로그아웃 & 삭제 */}
        <div className="space-y-4 pb-12">
          <button onClick={handleLogout} className="w-full py-3 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800 transition">
            로그아웃
          </button>

          <div className="text-center">
            <button onClick={() => setShowDeleteSection(!showDeleteSection)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 transition">
              {showDeleteSection ? "▲ 접기" : "계정 삭제..."}
            </button>
            {showDeleteSection && (
              <div className="mt-3 p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 space-y-3 text-left">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ 계정 영구 삭제</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  계정을 삭제하면 모든 데이터가 <strong>영구 삭제</strong>됩니다. 복구할 수 없습니다.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="계정삭제"
                  className="w-full border border-red-300 dark:border-red-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 bg-white dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "계정삭제" || isDeleting}
                  className="w-full py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 rounded-lg transition"
                >
                  {isDeleting ? "삭제 중..." : "계정 영구 삭제"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- 메인 Export: Suspense 경계 설정 ---
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}