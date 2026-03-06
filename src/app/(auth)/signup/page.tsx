"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff, Cloud, AlertCircle, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 유효성 체크
  const passwordRules = {
    length: password.length >= 8,
    combo: /(?=.*[a-zA-Z])(?=.*\d)/.test(password),
  };
  const passwordMatch = passwordConfirm.length > 0 && password === passwordConfirm;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!passwordRules.length || !passwordRules.combo) {
      setError("비밀번호는 8자 이상, 영문+숫자 조합이어야 합니다.");
      return;
    }
    if (!passwordMatch) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      // ✅ 수정: /api/auth/signup → /api/auth/register (실제 존재하는 엔드포인트)
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }
      router.push("/login?signup=success");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0c29] text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* 로고 */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <Cloud size={28} fill="currentColor" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-black tracking-tighter italic leading-none">EUM</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mt-1">Personal Cloud</p>
            </div>
          </Link>
        </div>

        {/* 카드 */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] backdrop-blur-2xl shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">회원가입</h2>
            <p className="text-white/50 text-sm">이음의 새 가족이 되어주세요 ✨</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            {/* 이메일 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className={`w-full bg-white/5 border rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-white/25 outline-none focus:bg-white/10 transition-all ${
                    email && !emailValid
                      ? "border-red-500/50 focus:border-red-500/70"
                      : email && emailValid
                      ? "border-emerald-500/50 focus:border-emerald-500/70"
                      : "border-white/10 focus:border-purple-500/50"
                  }`}
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상, 영문+숫자"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder:text-white/25 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* 비밀번호 규칙 표시 */}
              {password && (
                <div className="flex gap-3 px-1 mt-1">
                  <div className={`flex items-center gap-1 text-[11px] transition-colors ${passwordRules.length ? "text-emerald-400" : "text-white/25"}`}>
                    <CheckCircle2 size={12} /> 8자 이상
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] transition-colors ${passwordRules.combo ? "text-emerald-400" : "text-white/25"}`}>
                    <CheckCircle2 size={12} /> 영문+숫자
                  </div>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  required
                  className={`w-full bg-white/5 border rounded-2xl py-3.5 pl-12 pr-12 text-white placeholder:text-white/25 outline-none focus:bg-white/10 transition-all ${
                    passwordConfirm && !passwordMatch
                      ? "border-red-500/50 focus:border-red-500/70"
                      : passwordMatch
                      ? "border-emerald-500/50 focus:border-emerald-500/70"
                      : "border-white/10 focus:border-purple-500/50"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white/60 transition-colors"
                >
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordConfirm && (
                <p className={`text-[11px] px-1 transition-colors ${passwordMatch ? "text-emerald-400" : "text-red-400"}`}>
                  {passwordMatch ? "✅ 비밀번호가 일치합니다" : "❌ 비밀번호가 일치하지 않습니다"}
                </p>
              )}
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 disabled:opacity-40 mt-2"
            >
              {loading
                ? <Loader2 size={20} className="animate-spin" />
                : <><span>회원가입</span><ChevronRight size={20} /></>
              }
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/40 text-sm">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-white font-bold hover:text-purple-400 underline underline-offset-4 transition-colors">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
