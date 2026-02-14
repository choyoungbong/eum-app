"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

  // 개인정보 동의
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFullText, setShowFullText] = useState<"terms" | "privacy" | null>(null);
  const [consent, setConsent] = useState<PrivacyConsent>({
    terms: false, privacy: false, age: false, marketing: false,
  });
  const [consentDone, setConsentDone] = useState(false);

  // 유효성 검사
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
    if (!allRequiredConsent) {
      alert("필수 항목에 동의해주세요");
      return;
    }
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
    if (!passwordRules.length || !passwordRules.combo) {
      setError("비밀번호는 8자 이상, 영문+숫자 조합이어야 합니다");
      return;
    }
    if (!passwordMatch) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, marketingConsent: consent.marketing }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/login?registered=true");
      } else {
        setError(data.error || "회원가입 실패");
      }
    } catch {
      setError("회원가입 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eum-root">
      <div className="eum-bg">
        <div className="eum-blob eum-blob-1" />
        <div className="eum-blob eum-blob-2" />
      </div>

      <div className="eum-container">
        {/* 로고 */}
        <div className="eum-logo-wrap">
          <div className="eum-logo-icon">
            <svg viewBox="0 0 40 40" fill="none">
              <circle cx="12" cy="20" r="6" fill="white" fillOpacity="0.9"/>
              <circle cx="28" cy="12" r="5" fill="white" fillOpacity="0.7"/>
              <circle cx="28" cy="28" r="5" fill="white" fillOpacity="0.7"/>
              <line x1="17.5" y1="17" x2="23.5" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="17.5" y1="23" x2="23.5" y2="26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="eum-brand">이음</h1>
            <p className="eum-tagline">사람과 파일을 잇다</p>
          </div>
        </div>

        <div className="eum-card">
          <h2 className="eum-card-title">회원가입</h2>
          <p className="eum-card-sub">이음과 함께 시작해보세요 ✨</p>

          {error && <div className="eum-error"><span>⚠️</span> {error}</div>}

          <form onSubmit={handleSubmit} className="eum-form">
            {/* 이름 */}
            <div className="eum-field">
              <label className="eum-label">이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="홍길동" className="eum-input eum-input-plain" required />
            </div>

            {/* 이메일 */}
            <div className="eum-field">
              <label className="eum-label">이메일</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com" className={`eum-input eum-input-plain ${email && !emailValid ? "eum-input-error" : email && emailValid ? "eum-input-ok" : ""}`}
                required />
              {email && !emailValid && <p className="eum-hint eum-hint-error">올바른 이메일 형식이 아닙니다</p>}
            </div>

            {/* 비밀번호 */}
            <div className="eum-field">
              <label className="eum-label">비밀번호</label>
              <div className="eum-input-wrap">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상, 영문+숫자"
                  className={`eum-input eum-input-pr ${password && (!passwordRules.length || !passwordRules.combo) ? "eum-input-error" : password && passwordRules.length && passwordRules.combo ? "eum-input-ok" : ""}`}
                  required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="eum-eye-btn" tabIndex={-1}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
              {/* 비밀번호 규칙 */}
              {password.length > 0 && (
                <div className="eum-rules">
                  <span className={passwordRules.length ? "eum-rule-ok" : "eum-rule-no"}>
                    {passwordRules.length ? "✅" : "○"} 8자 이상
                  </span>
                  <span className={passwordRules.combo ? "eum-rule-ok" : "eum-rule-no"}>
                    {passwordRules.combo ? "✅" : "○"} 영문+숫자 조합
                  </span>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="eum-field">
              <label className="eum-label">비밀번호 확인</label>
              <div className="eum-input-wrap">
                <input type={showPasswordConfirm ? "text" : "password"} value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className={`eum-input eum-input-pr ${passwordConfirm && !passwordMatch ? "eum-input-error" : passwordMatch ? "eum-input-ok" : ""}`}
                  required />
                <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="eum-eye-btn" tabIndex={-1}>
                  {showPasswordConfirm ? "🙈" : "👁️"}
                </button>
              </div>
              {passwordConfirm && (
                <p className={`eum-hint ${passwordMatch ? "eum-hint-ok" : "eum-hint-error"}`}>
                  {passwordMatch ? "✅ 비밀번호가 일치합니다" : "❌ 비밀번호가 일치하지 않습니다"}
                </p>
              )}
            </div>

            {/* 개인정보 동의 */}
            <div className="eum-consent-wrap">
              {consentDone ? (
                <div className="eum-consent-done">
                  ✅ 개인정보 수집 및 이용에 동의하였습니다
                  <button type="button" onClick={() => setShowPrivacyModal(true)} className="eum-consent-reopen">
                    다시 확인
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowPrivacyModal(true)} className="eum-consent-btn">
                  📋 개인정보 수집 동의 (필수)
                </button>
              )}
            </div>

            <button type="submit" disabled={loading || !consentDone} className="eum-btn-primary">
              {loading ? <span className="eum-spinner" /> : "회원가입"}
            </button>
          </form>

          <p className="eum-signup-text">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="eum-signup-link">로그인</Link>
          </p>
        </div>
      </div>

      {/* ===== 개인정보 동의 모달 ===== */}
      {showPrivacyModal && (
        <div className="eum-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="eum-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="eum-modal-title">개인정보 수집 및 이용 동의</h3>
            <p className="eum-modal-sub">서비스 이용을 위해 아래 항목에 동의해 주세요</p>

            {/* 전체 동의 */}
            <label className="eum-check-all">
              <input type="checkbox"
                checked={consent.terms && consent.privacy && consent.age && consent.marketing}
                onChange={(e) => handleAllConsent(e.target.checked)} />
              <span>전체 동의</span>
            </label>

            <div className="eum-check-divider" />

            {/* 필수 항목들 */}
            {[
              { key: "terms", label: "[필수] 서비스 이용약관 동의", type: "terms" as const },
              { key: "privacy", label: "[필수] 개인정보 수집 및 이용 동의", type: "privacy" as const },
              { key: "age", label: "[필수] 만 14세 이상 확인", type: null },
            ].map((item) => (
              <div key={item.key} className="eum-check-row">
                <label className="eum-check-label">
                  <input type="checkbox"
                    checked={consent[item.key as keyof PrivacyConsent]}
                    onChange={(e) => setConsent({ ...consent, [item.key]: e.target.checked })} />
                  <span>{item.label}</span>
                </label>
                {item.type && (
                  <button type="button" onClick={() => setShowFullText(item.type as "terms" | "privacy")} className="eum-view-btn">
                    전문 보기
                  </button>
                )}
              </div>
            ))}

            {/* 선택 항목 */}
            <div className="eum-check-row">
              <label className="eum-check-label">
                <input type="checkbox" checked={consent.marketing}
                  onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })} />
                <span className="eum-optional">[선택] 마케팅 정보 수신 동의</span>
              </label>
            </div>

            {/* 수집 정보 요약 */}
            <div className="eum-privacy-summary">
              <p className="eum-privacy-title">📋 개인정보 수집 항목 안내</p>
              <table className="eum-privacy-table">
                <thead>
                  <tr><th>수집 항목</th><th>수집 목적</th><th>보유 기간</th></tr>
                </thead>
                <tbody>
                  <tr><td>이름</td><td>서비스 내 식별 및 표시</td><td rowSpan={3}>회원 탈퇴 시까지</td></tr>
                  <tr><td>이메일</td><td>로그인 ID, 비밀번호 찾기, 알림</td></tr>
                  <tr><td>비밀번호</td><td>계정 보안 (암호화 저장)</td></tr>
                </tbody>
              </table>
              <p className="eum-privacy-note">※ 귀하는 개인정보 수집에 동의하지 않을 권리가 있으나, 필수 항목 미동의 시 서비스 이용이 제한됩니다.</p>
            </div>

            <button type="button" onClick={handleConsentSubmit}
              disabled={!allRequiredConsent}
              className="eum-modal-confirm">
              동의하고 계속하기
            </button>
            <button type="button" onClick={() => setShowPrivacyModal(false)} className="eum-modal-cancel">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 약관 전문 모달 */}
      {showFullText && (
        <div className="eum-modal-overlay" onClick={() => setShowFullText(null)}>
          <div className="eum-modal eum-modal-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="eum-modal-title">
              {showFullText === "terms" ? "서비스 이용약관" : "개인정보 처리방침"}
            </h3>
            <div className="eum-full-text">
              {showFullText === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
            </div>
            <button type="button" onClick={() => setShowFullText(null)} className="eum-modal-confirm">
              확인
            </button>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .eum-root {
          min-height: 100vh; min-height: 100dvh;
          background: #0f0c29;
          display: flex; align-items: center; justify-content: center;
          padding: 20px; position: relative; overflow: hidden;
          font-family: 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif;
        }
        .eum-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .eum-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.3; }
        .eum-blob-1 { width: 400px; height: 400px; background: #7c3aed; top: -100px; left: -100px; }
        .eum-blob-2 { width: 350px; height: 350px; background: #2563eb; bottom: -80px; right: -80px; }
        .eum-container { position: relative; z-index: 1; width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
        .eum-logo-wrap { display: flex; align-items: center; gap: 14px; }
        .eum-logo-icon { width: 52px; height: 52px; background: linear-gradient(135deg, #7c3aed, #2563eb); border-radius: 16px; display: flex; align-items: center; justify-content: center; padding: 10px; box-shadow: 0 8px 32px rgba(124,58,237,0.4); }
        .eum-brand { font-size: 32px; font-weight: 800; color: white; letter-spacing: -1px; line-height: 1; }
        .eum-tagline { font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 3px; }
        .eum-card { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 32px 28px; backdrop-filter: blur(20px); box-shadow: 0 25px 50px rgba(0,0,0,0.4); }
        .eum-card-title { font-size: 22px; font-weight: 700; color: white; margin-bottom: 6px; }
        .eum-card-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 24px; }
        .eum-error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 13px; padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .eum-form { display: flex; flex-direction: column; gap: 16px; }
        .eum-field { display: flex; flex-direction: column; gap: 7px; }
        .eum-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
        .eum-input-wrap { position: relative; display: flex; align-items: center; }
        .eum-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 13px 16px; color: white; font-size: 15px; transition: all 0.2s; outline: none; width: 100%; -webkit-appearance: none; }
        .eum-input-plain { padding: 13px 16px; }
        .eum-input-pr { padding: 13px 44px 13px 16px; }
        .eum-input::placeholder { color: rgba(255,255,255,0.25); }
        .eum-input:focus { border-color: #7c3aed; background: rgba(124,58,237,0.1); box-shadow: 0 0 0 3px rgba(124,58,237,0.2); }
        .eum-input-ok { border-color: #10b981 !important; }
        .eum-input-error { border-color: #ef4444 !important; }
        .eum-eye-btn { position: absolute; right: 12px; background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; }
        .eum-rules { display: flex; gap: 12px; flex-wrap: wrap; }
        .eum-rule-ok { font-size: 12px; color: #6ee7b7; }
        .eum-rule-no { font-size: 12px; color: rgba(255,255,255,0.35); }
        .eum-hint { font-size: 12px; margin-top: 2px; }
        .eum-hint-ok { color: #6ee7b7; }
        .eum-hint-error { color: #fca5a5; }
        .eum-consent-wrap { margin-top: 4px; }
        .eum-consent-btn { width: 100%; padding: 13px; background: rgba(124,58,237,0.2); border: 1px dashed rgba(124,58,237,0.5); border-radius: 12px; color: #c4b5fd; font-size: 14px; cursor: pointer; text-align: center; transition: all 0.2s; }
        .eum-consent-btn:hover { background: rgba(124,58,237,0.3); }
        .eum-consent-done { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 12px 16px; color: #6ee7b7; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
        .eum-consent-reopen { font-size: 12px; color: rgba(255,255,255,0.4); text-decoration: underline; background: none; border: none; cursor: pointer; }
        .eum-btn-primary { width: 100%; padding: 15px; background: linear-gradient(135deg, #7c3aed, #2563eb); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; min-height: 52px; box-shadow: 0 4px 20px rgba(124,58,237,0.35); -webkit-tap-highlight-color: transparent; }
        .eum-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(124,58,237,0.5); }
        .eum-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .eum-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .eum-signup-text { text-align: center; font-size: 14px; color: rgba(255,255,255,0.45); margin-top: 20px; }
        .eum-signup-link { color: #a78bfa; font-weight: 600; text-decoration: none; }

        /* 모달 */
        .eum-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: flex; align-items: flex-end; justify-content: center; padding: 0; backdrop-filter: blur(4px); }
        .eum-modal { background: #1a1735; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px 24px 0 0; padding: 28px 24px 36px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
        .eum-modal-full { max-height: 85vh; }
        .eum-modal-title { font-size: 18px; font-weight: 700; color: white; margin-bottom: 6px; }
        .eum-modal-sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 20px; }
        .eum-check-all { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 0; color: white; font-weight: 700; font-size: 15px; }
        .eum-check-all input { width: 18px; height: 18px; accent-color: #7c3aed; cursor: pointer; }
        .eum-check-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 4px 0 12px; }
        .eum-check-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .eum-check-label { display: flex; align-items: center; gap: 10px; cursor: pointer; color: rgba(255,255,255,0.75); font-size: 14px; }
        .eum-check-label input { width: 16px; height: 16px; accent-color: #7c3aed; cursor: pointer; }
        .eum-optional { color: rgba(255,255,255,0.45); }
        .eum-view-btn { font-size: 11px; color: rgba(255,255,255,0.35); text-decoration: underline; background: none; border: none; cursor: pointer; white-space: nowrap; }
        .eum-privacy-summary { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 16px; margin: 16px 0; }
        .eum-privacy-title { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
        .eum-privacy-table { width: 100%; border-collapse: collapse; font-size: 12px; color: rgba(255,255,255,0.6); }
        .eum-privacy-table th { background: rgba(255,255,255,0.06); padding: 8px; text-align: left; font-weight: 600; }
        .eum-privacy-table td { padding: 7px 8px; border-top: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
        .eum-privacy-note { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 10px; line-height: 1.5; }
        .eum-modal-confirm { width: 100%; padding: 14px; background: linear-gradient(135deg, #7c3aed, #2563eb); border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 16px; }
        .eum-modal-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
        .eum-modal-cancel { width: 100%; padding: 12px; background: none; border: none; color: rgba(255,255,255,0.35); font-size: 14px; cursor: pointer; margin-top: 8px; }
        .eum-full-text { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.8; white-space: pre-wrap; max-height: 50vh; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 10px; padding: 16px; margin: 16px 0; }
        @media (min-width: 480px) { .eum-modal-overlay { align-items: center; } .eum-modal { border-radius: 24px; } }
        @media (max-width: 480px) { .eum-input { font-size: 16px; } }
      `}</style>
    </div>
  );
}

// ===== 약관 전문 =====
const TERMS_TEXT = `이음(Eum) 서비스 이용약관

제1조 (목적)
본 약관은 이음(Eum, 이하 "서비스")이 제공하는 모든 서비스의 이용 조건 및 절차, 이용자와 서비스의 권리, 의무, 책임사항을 규정함을 목적으로 합니다.

제2조 (용어의 정의)
① "서비스"란 이음이 제공하는 파일 공유, 메시징, 커뮤니케이션 등 일체의 서비스를 말합니다.
② "이용자"란 본 약관에 따라 서비스를 이용하는 자를 말합니다.
③ "계정"이란 이용자가 서비스 이용을 위해 등록한 이메일 및 비밀번호의 조합을 말합니다.

제3조 (약관의 효력 및 변경)
① 본 약관은 서비스를 이용하고자 하는 모든 이용자에 대하여 효력을 발생합니다.
② 서비스는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지를 통해 고지합니다.

제4조 (서비스 이용)
① 이용자는 본 약관에 동의함으로써 서비스를 이용할 수 있습니다.
② 이용자는 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.
③ 이용자는 서비스를 통해 불법적인 콘텐츠를 업로드하거나 배포해서는 안 됩니다.

제5조 (개인정보 보호)
서비스는 관련 법령에 따라 이용자의 개인정보를 보호합니다. 자세한 내용은 개인정보 처리방침을 참고하세요.

제6조 (면책조항)
서비스는 천재지변, 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.

부칙
본 약관은 2025년 1월 1일부터 적용됩니다.`;

const PRIVACY_TEXT = `이음(Eum) 개인정보 처리방침

이음(Eum)은 이용자의 개인정보를 중요시하며, 「개인정보 보호법」을 준수합니다.

1. 수집하는 개인정보 항목
- 필수 항목: 이름, 이메일 주소, 비밀번호(암호화 저장)
- 선택 항목: 마케팅 수신 동의 여부

2. 개인정보 수집 목적
- 회원 식별 및 서비스 제공
- 비밀번호 찾기 등 본인 확인
- 서비스 관련 고지 및 안내
- (선택) 이벤트 및 서비스 개선 정보 제공

3. 개인정보 보유 및 이용 기간
- 회원 탈퇴 시까지
- 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관

4. 개인정보의 제3자 제공
이음은 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 경우는 예외로 합니다.

5. 개인정보의 파기
이용자의 개인정보는 수집 및 이용 목적이 달성된 후에는 지체 없이 파기합니다.

6. 이용자의 권리
이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며, 개인정보 처리에 대한 동의를 철회할 수 있습니다.

7. 개인정보 보호책임자
- 이름: 개인정보 보호책임자
- 이메일: privacy@eum.app

본 방침은 2025년 1월 1일부터 적용됩니다.`;
