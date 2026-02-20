"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react"; // Lucide 아이콘 권장

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        setError("이메일 또는 비밀번호가 올바르지 않습니다");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f0c29] overflow-hidden">
      
      {/* 고도화된 배경 애니메이션 (Blobs) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[100px] animate-bounce-slow" />
        <div className="absolute top-[30%] left-[20%] w-[200px] h-[200px] bg-cyan-500/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] space-y-8">
        
        {/* 상단 로고 섹션 */}
        <div className="flex flex-col items-center space-y-4 animate-fade-in-down">
          <div className="w-16 h-16 bg-gradient-to-br from-[#7c3aed] to-[#2563eb] rounded-2xl flex items-center justify-center shadow-[0_8px_32px_rgba(124,58,237,0.4)] transition-transform hover:scale-110 duration-300">
            <svg className="w-10 h-10 text-white" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="20" r="6" fill="currentColor" fillOpacity="0.9"/>
              <circle cx="28" cy="12" r="5" fill="currentColor" fillOpacity="0.7"/>
              <circle cx="28" cy="28" r="5" fill="currentColor" fillOpacity="0.7"/>
              <line x1="17.5" y1="17" x2="23.5" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="17.5" y1="23" x2="23.5" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-1">이음</h1>
            <p className="text-sm text-white/50 font-medium tracking-widest">사람과 파일을 잇다</p>
          </div>
        </div>

        {/* 메인 로그인 카드 */}
        <div className="eum-glass-effect rounded-[32px] p-8 md:p-10 shadow-2xl animate-fade-in-up">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">로그인</h2>
            <p className="text-white/40 text-sm">이음에 다시 오신 것을 환영합니다 👋</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-4 rounded-xl mb-6 animate-shake">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* 이메일 입력 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 ml-1 tracking-wider uppercase">이메일 주소</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#7c3aed] transition-colors" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-[#7c3aed] focus:bg-white/[0.08] transition-all"
                  required
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 ml-1 tracking-wider uppercase">비밀번호</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#7c3aed] transition-colors" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-white/20 outline-none focus:border-[#7c3aed] focus:bg-white/[0.08] transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 비밀번호 찾기 */}
            <div className="flex justify-end">
              <Link href="/reset-password" name="reset-password-link" className="text-xs text-white/40 hover:text-[#a78bfa] transition-colors">
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#2563eb] rounded-xl text-white font-bold text-lg shadow-lg shadow-purple-900/20 hover:shadow-purple-700/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  로그인 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-white/40 text-sm">
              계정이 없으신가요?{" "}
              <Link href="/register" className="text-[#a78bfa] font-bold hover:text-white transition-colors ml-1">
                지금 가입하세요
              </Link>
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <p className="text-center text-white/20 text-[10px] tracking-widest uppercase">
          &copy; 2026 EUM PROJECT. PRIVATE CLOUD STORAGE.
        </p>
      </div>
    </div>
  );
}
