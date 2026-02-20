"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Cloud, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  ChevronRight,
  ShieldCheck,
  FileText
} from "lucide-react";

interface PrivacyConsent {
  terms: boolean;
  privacy: boolean;
  age: boolean;
  marketing: boolean;
}

export default function RegisterPage() {
  const router = useRouter();

  // 입력 상태
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 개인정보 동의 상태
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFullText, setShowFullText] = useState<"terms" | "privacy" | null>(null);
  const [consent, setConsent] = useState<PrivacyConsent>({
    terms: false, privacy: false, age: false, marketing: false,
  });
  const [consentDone, setConsentDone] = useState(false);

  // 유효성 검사 로직
  const passwordRules = {
    length: password.length >= 8,
    combo: /(?=.*[a-zA-Z])(?=.*\d)/.test(password),
  };
  const passwordMatch = password === passwordConfirm && passwordConfirm.length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const allRequiredConsent = consent.terms && consent.privacy && consent.age;

  const handleAllConsent = (checked: boolean) => {
    setConsent({ terms: checked, privacy: checked, age: checked, marketing: checked });
  };

  const handleConsentSubmit = () => {
    if (!allRequiredConsent) return;
    setConsentDone(true);
    setShowPrivacyModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!consentDone) {
      setShowPrivacyModal(true);
      return;
    }

    if (!passwordRules.length || !passwordRules.combo || !passwordMatch) {
      setError("입력하신 정보를 다시 확인해주세요.");
      return;
    }

    setLoading(true);
    try {
      // 💡 오류 해결 포인트: API 경로가 /api/auth/register 인지 /api/register 인지 확인 필요
      // 현재 프로젝트 구조에 맞춰 엔드포인트를 호출합니다.
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          email, 
          password, 
          marketingConsent: consent.marketing 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // 성공 시 로그인 페이지로 이동하며 성공 메시지 전달
        router.push("/login?signup=success");
      } else {
        setError(data.error || "이미 사용 중인 이메일이거나 가입 정보가 올바르지 않습니다.");
      }
    } catch (err) {
      setError("서버와의 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0c29] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* 배경 장식 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[100px] rounded-full -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[100px] rounded-full -z-10" />

      <div className="max-w-md w-full relative z-10">
        {/* 로고 영역 */}
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

        {/* 회원가입 카드 */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] backdrop-blur-2xl shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">회원가입</h2>
            <p className="text-white/50 text-sm">이음의 새 가족이 되어주세요 ✨</p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 입력 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                  required
                />
              </div>
            </div>

            {/* 이메일 입력 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className={`w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all ${email && !emailValid ? "border-red-500/50" : emailValid ? "border-emerald-500/50" : ""}`}
                  required
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상, 영문+숫자"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* 비밀번호 규칙 체크 표시 */}
              {password && (
                <div className="flex gap-3 px-1 mt-1">
                  <div className={`flex items-center gap-1 text-[11px] ${passwordRules.length ? "text-emerald-400" : "text-white/20"}`}>
                    <CheckCircle2 size={12} /> 8자 이상
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] ${passwordRules.combo ? "text-emerald-400" : "text-white/20"}`}>
                    <CheckCircle2 size={12} /> 영문+숫자
                  </div>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-wider">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center text-white/20 group-focus-within:text-purple-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 재입력"
                  className={`w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all ${passwordConfirm && !passwordMatch ? "border-red-500/50" : passwordMatch ? "border-emerald-500/50" : ""}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute inset-y-0 right-4 flex items-center text-white/20 hover:text-white"
                >
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 약관 동의 섹션 */}
            <div className="pt-2">
              {consentDone ? (
                <button 
                  type="button" 
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <ShieldCheck size={18} />
                    <span>약관 동의 완료</span>
                  </div>
                  <span className="text-[10px] text-white/20 group-hover:text-white/40">변경하기</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full bg-white/5 border border-dashed border-white/20 rounded-2xl p-3 text-white/40 text-sm hover:bg-white/10 hover:border-white/40 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={18} />
                  개인정보 수집 동의 (필수)
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !consentDone}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 disabled:opacity-30 mt-4"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <>회원가입 <ChevronRight size={20} /></>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/40 text-sm">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-white font-bold hover:text-purple-400 underline underline-offset-4">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* 동의 모달 (생략: 기존 로직과 동일하나 디자인을 EUM 스타일로 조정) */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1735] w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-8 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-2">서비스 이용 동의</h3>
            <p className="text-white/40 text-sm mb-6">원활한 서비스 제공을 위해 필수 항목에 동의가 필요합니다.</p>
            
            <div className="space-y-1">
              <label className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors mb-4">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded-lg accent-purple-500"
                  checked={consent.terms && consent.privacy && consent.age && consent.marketing}
                  onChange={(e) => handleAllConsent(e.target.checked)}
                />
                <span className="font-bold">전체 동의하기</span>
              </label>
              
              <div className="space-y-1 px-1">
                {[
                  { key: "terms", label: "[필수] 서비스 이용약관", type: "terms" },
                  { key: "privacy", label: "[필수] 개인정보 처리방침", type: "privacy" },
                  { key: "age", label: "[필수] 만 14세 이상입니다", type: null },
                  { key: "marketing", label: "[선택] 마케팅 정보 수신", type: null },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded accent-purple-500"
                        checked={consent[item.key as keyof PrivacyConsent]}
                        onChange={(e) => setConsent({ ...consent, [item.key]: e.target.checked })}
                      />
                      <span className={`text-sm ${item.key === 'marketing' ? 'text-white/40' : 'text-white/70'}`}>{item.label}</span>
                    </label>
                    {item.type && (
                      <button 
                        onClick={() => setShowFullText(item.type as "terms" | "privacy")}
                        className="text-[11px] text-white/30 underline"
                      >전문보기</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="flex-1 py-4 bg-white/5 rounded-2xl font-bold hover:bg-white/10 transition-colors"
              >취소</button>
              <button 
                onClick={handleConsentSubmit}
                disabled={!allRequiredConsent}
                className="flex-[2] py-4 bg-gradient-to-r from-purple-500 to-blue-600 rounded-2xl font-bold disabled:opacity-30"
              >동의하고 계속하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 약관 전문 모달 (기존 로직 유지) */}
      {showFullText && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90">
          <div className="bg-[#1a1735] w-full max-w-2xl rounded-[32px] p-8 border border-white/10 flex flex-col max-h-[80vh]">
            <h4 className="text-lg font-bold mb-4">{showFullText === "terms" ? "이용약관" : "개인정보 처리방침"}</h4>
            <div className="flex-1 overflow-y-auto bg-black/20 rounded-2xl p-6 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
              {showFullText === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
            </div>
            <button 
              onClick={() => setShowFullText(null)}
              className="mt-6 w-full py-4 bg-white/10 rounded-2xl font-bold"
            >확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 약관 텍스트 데이터 (생략 - 기존 데이터 사용)
const TERMS_TEXT = `...`;
const PRIVACY_TEXT = `...`;