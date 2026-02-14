"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div className="eum-root">
      {/* 배경 */}
      <div className="eum-bg">
        <div className="eum-blob eum-blob-1" />
        <div className="eum-blob eum-blob-2" />
        <div className="eum-blob eum-blob-3" />
      </div>

      <div className="eum-container">
        {/* 로고 */}
        <div className="eum-logo-wrap">
          <div className="eum-logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        {/* 카드 */}
        <div className="eum-card">
          <h2 className="eum-card-title">로그인</h2>
          <p className="eum-card-sub">이음에 오신 것을 환영합니다 👋</p>

          {error && (
            <div className="eum-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="eum-form">
            {/* 이메일 */}
            <div className="eum-field">
              <label className="eum-label">이메일</label>
              <div className="eum-input-wrap">
                <span className="eum-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="eum-input"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="eum-field">
              <label className="eum-label">비밀번호</label>
              <div className="eum-input-wrap">
                <span className="eum-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="eum-input"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="eum-eye-btn"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 찾기 링크 */}
            <div className="eum-find-links">
              <Link href="/find-email" className="eum-find-link">이메일 찾기</Link>
              <span className="eum-divider-dot">·</span>
              <Link href="/reset-password" className="eum-find-link">비밀번호 재설정</Link>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="eum-btn-primary"
            >
              {loading ? (
                <span className="eum-spinner" />
              ) : "로그인"}
            </button>
          </form>

          {/* 회원가입 링크 */}
          <p className="eum-signup-text">
            아직 계정이 없으신가요?{" "}
            <Link href="/register" className="eum-signup-link">회원가입</Link>
          </p>
        </div>

        <p className="eum-footer-text">
          © 2025 이음(Eum). All rights reserved.
        </p>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .eum-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: #0f0c29;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          font-family: 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif;
        }

        /* 배경 블롭 */
        .eum-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .eum-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          animation: blobFloat 8s ease-in-out infinite;
        }
        .eum-blob-1 {
          width: 400px; height: 400px;
          background: #7c3aed;
          top: -100px; left: -100px;
          animation-delay: 0s;
        }
        .eum-blob-2 {
          width: 350px; height: 350px;
          background: #2563eb;
          bottom: -80px; right: -80px;
          animation-delay: 3s;
        }
        .eum-blob-3 {
          width: 250px; height: 250px;
          background: #06b6d4;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: 5s;
        }
        @keyframes blobFloat {
          0%, 100% { transform: scale(1) translate(0, 0); }
          33% { transform: scale(1.05) translate(10px, -10px); }
          66% { transform: scale(0.95) translate(-10px, 10px); }
        }

        /* 컨테이너 */
        .eum-container {
          position: relative; z-index: 1;
          width: 100%; max-width: 400px;
          display: flex; flex-direction: column;
          align-items: center; gap: 24px;
        }

        /* 로고 */
        .eum-logo-wrap {
          display: flex; align-items: center; gap: 14px;
        }
        .eum-logo-icon {
          width: 52px; height: 52px;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          padding: 10px;
          box-shadow: 0 8px 32px rgba(124,58,237,0.4);
        }
        .eum-brand {
          font-size: 32px; font-weight: 800;
          color: white; letter-spacing: -1px;
          line-height: 1;
        }
        .eum-tagline {
          font-size: 13px; color: rgba(255,255,255,0.55);
          margin-top: 3px; letter-spacing: 0.3px;
        }

        /* 카드 */
        .eum-card {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 24px;
          padding: 36px 32px;
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px rgba(0,0,0,0.4);
        }
        .eum-card-title {
          font-size: 22px; font-weight: 700;
          color: white; margin-bottom: 6px;
        }
        .eum-card-sub {
          font-size: 14px; color: rgba(255,255,255,0.5);
          margin-bottom: 28px;
        }

        /* 에러 */
        .eum-error {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          font-size: 13px; padding: 12px 14px;
          border-radius: 12px; margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
        }

        /* 폼 */
        .eum-form { display: flex; flex-direction: column; gap: 18px; }
        .eum-field { display: flex; flex-direction: column; gap: 8px; }
        .eum-label {
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,0.7); letter-spacing: 0.3px;
        }
        .eum-input-wrap {
          position: relative; display: flex; align-items: center;
        }
        .eum-input-icon {
          position: absolute; left: 14px;
          color: rgba(255,255,255,0.35); pointer-events: none;
          display: flex; align-items: center;
        }
        .eum-input {
          width: 100%;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 14px 44px 14px 42px;
          color: white; font-size: 15px;
          transition: all 0.2s;
          outline: none;
          -webkit-appearance: none;
        }
        .eum-input::placeholder { color: rgba(255,255,255,0.25); }
        .eum-input:focus {
          border-color: #7c3aed;
          background: rgba(124,58,237,0.1);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.2);
        }
        .eum-eye-btn {
          position: absolute; right: 14px;
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.4); padding: 4px;
          display: flex; align-items: center;
          transition: color 0.2s;
        }
        .eum-eye-btn:hover { color: rgba(255,255,255,0.8); }

        /* 찾기 링크 */
        .eum-find-links {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 8px; margin-top: -6px;
        }
        .eum-find-link {
          font-size: 12px; color: rgba(255,255,255,0.45);
          text-decoration: none; transition: color 0.2s;
        }
        .eum-find-link:hover { color: #a78bfa; }
        .eum-divider-dot { color: rgba(255,255,255,0.2); font-size: 12px; }

        /* 버튼 */
        .eum-btn-primary {
          width: 100%; padding: 15px;
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          border: none; border-radius: 12px;
          color: white; font-size: 16px; font-weight: 700;
          cursor: pointer; margin-top: 4px;
          transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
          min-height: 52px;
          box-shadow: 0 4px 20px rgba(124,58,237,0.35);
          -webkit-tap-highlight-color: transparent;
        }
        .eum-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(124,58,237,0.5);
        }
        .eum-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .eum-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* 스피너 */
        .eum-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* 회원가입 */
        .eum-signup-text {
          text-align: center; font-size: 14px;
          color: rgba(255,255,255,0.45); margin-top: 22px;
        }
        .eum-signup-link {
          color: #a78bfa; font-weight: 600; text-decoration: none;
          transition: color 0.2s;
        }
        .eum-signup-link:hover { color: #c4b5fd; }

        /* 푸터 */
        .eum-footer-text {
          font-size: 11px; color: rgba(255,255,255,0.2);
          text-align: center;
        }

        /* 모바일 최적화 */
        @media (max-width: 480px) {
          .eum-card { padding: 28px 22px; border-radius: 20px; }
          .eum-brand { font-size: 28px; }
          .eum-input { font-size: 16px; } /* iOS 줌 방지 */
        }
      `}</style>
    </div>
  );
}
