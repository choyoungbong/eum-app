"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Cloud, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  Search
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 회원가입 성공 후 리다이렉트 되었는지 확인
  const isSignupSuccess = searchParams.get("signup") === "success";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("로그인 중 서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0c29] text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* 배경 장식 (Blobs) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[100px] rounded-full -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full -z-10" />

      <div className="max-w-md w-full">
        {/* 로고 영역 */}
        <div className="text-center mb-10 flex flex-col items-center">
          <Link href="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <Cloud size={28} fill="currentColor" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black tracking-tighter italic leading-none">EUM</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mt-1">Personal Cloud</p>
            </div>
          </Link>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] backdrop-blur-2xl shadow-2xl relative">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">로그인</h2>
            <p className="text-white/50 text-sm">이음에 오신 것을 환영합니다 👋</p>
          </div>

          {/* 회원가입 성공 알림 */}
          {isSignupSuccess && !error && (
            <div className="mb-6 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-sm animate-fade-in">
              <AlertCircle size={18} />
              <p>회원가입 완료! 생성한 계정으로 로그인하세요.</p>
            </div>
          )}

          {/* 에러 알림 */}
          {error && (
            <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* 이메일 입력 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-purple-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all placeholder:text-white/10"
                  required
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-purple-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all placeholder:text-white/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 아이디/비밀번호 찾기 (기존 로직 유지) */}
            <div className="flex justify-end gap-3 px-1">
              <Link href="/find-email" className="text-xs text-white/30 hover:text-purple-400 transition-colors flex items-center gap-1">
                <Search size={12} />
                이메일 찾기
              </Link>
              <span className="text-white/10 text-xs">|</span>
              <Link href="/reset-password" className="text-xs text-white/30 hover:text-purple-400 transition-colors">
                비밀번호 재설정
              </Link>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  로그인
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* 회원가입 링크 (경로: /register) */}
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-white/40 text-sm">
              아직 계정이 없으신가요?{" "}
              <Link href="/register" className="text-white font-bold hover:text-purple-400 transition-colors underline underline-offset-4">
                회원가입
              </Link>
            </p>
          </div>
        </div>
        
        <p className="text-center mt-10 text-white/10 text-[10px] font-medium tracking-[0.3em] uppercase">
          © 2026 EUM Cloud Service
        </p>
      </div>
    </div>
  );
}