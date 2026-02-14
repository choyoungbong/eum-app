"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setSent(true);
      else setError(data.error || "오류가 발생했습니다");
    } catch {
      setError("오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eum-root">
      <div className="eum-bg">
        <div className="eum-blob b1" />
        <div className="eum-blob b2" />
      </div>
      <div className="eum-container">
        <Link href="/login" className="eum-back">← 로그인으로 돌아가기</Link>
        <div className="eum-card">
          <div className="eum-icon-wrap">🔐</div>
          <h2 className="eum-title">비밀번호 재설정</h2>
          {!sent ? (
            <>
              <p className="eum-sub">
                가입한 이메일 주소를 입력하면<br />
                비밀번호 재설정 링크를 보내드립니다
              </p>
              <form onSubmit={handleSubmit} className="eum-form">
                {error && <div className="eum-error">⚠️ {error}</div>}
                <div className="eum-field">
                  <label className="eum-label">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="가입한 이메일 주소"
                    className="eum-input"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="eum-btn">
                  {loading ? "전송 중..." : "재설정 링크 받기"}
                </button>
              </form>
            </>
          ) : (
            <div className="eum-success">
              <div className="eum-success-icon">📨</div>
              <p className="eum-success-msg">메일을 발송했습니다!</p>
              <p className="eum-success-sub">
                <strong>{email}</strong>로 전송된<br />
                링크를 클릭해 비밀번호를 재설정하세요<br />
                <span className="eum-expire">링크는 15분간 유효합니다</span>
              </p>
              <Link
                href="/login"
                className="eum-btn"
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: "16px" }}
              >
                로그인으로 돌아가기
              </Link>
            </div>
          )}
        </div>
      </div>
      <style>{EUM_FIND_STYLE}</style>
    </div>
  );
}

const EUM_FIND_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .eum-root { min-height: 100vh; min-height: 100dvh; background: #0f0c29; display: flex; align-items: center; justify-content: center; padding: 24px 20px; position: relative; overflow: hidden; font-family: 'Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif; }
  .eum-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
  .eum-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.25; }
  .b1 { width: 380px; height: 380px; background: #7c3aed; top: -100px; left: -100px; }
  .b2 { width: 320px; height: 320px; background: #2563eb; bottom: -80px; right: -80px; }
  .eum-container { position: relative; z-index: 1; width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 16px; }
  .eum-back { font-size: 13px; color: rgba(255,255,255,0.4); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: color 0.2s; }
  .eum-back:hover { color: rgba(255,255,255,0.7); }
  .eum-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 36px 28px; backdrop-filter: blur(20px); box-shadow: 0 25px 50px rgba(0,0,0,0.4); }
  .eum-icon-wrap { font-size: 40px; text-align: center; margin-bottom: 16px; }
  .eum-title { font-size: 22px; font-weight: 700; color: white; text-align: center; margin-bottom: 8px; }
  .eum-sub { font-size: 14px; color: rgba(255,255,255,0.5); text-align: center; line-height: 1.6; margin-bottom: 24px; }
  .eum-form { display: flex; flex-direction: column; gap: 16px; }
  .eum-field { display: flex; flex-direction: column; gap: 7px; }
  .eum-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
  .eum-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 13px 16px; color: white; font-size: 16px; transition: all 0.2s; outline: none; width: 100%; -webkit-appearance: none; }
  .eum-input::placeholder { color: rgba(255,255,255,0.25); }
  .eum-input:focus { border-color: #7c3aed; background: rgba(124,58,237,0.1); box-shadow: 0 0 0 3px rgba(124,58,237,0.2); }
  .eum-error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 13px; padding: 12px 14px; border-radius: 12px; }
  .eum-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #7c3aed, #2563eb); border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; min-height: 50px; box-shadow: 0 4px 20px rgba(124,58,237,0.35); -webkit-tap-highlight-color: transparent; }
  .eum-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .eum-success { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .eum-success-icon { font-size: 52px; }
  .eum-success-msg { font-size: 20px; font-weight: 700; color: white; }
  .eum-success-sub { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.7; }
  .eum-expire { font-size: 12px; color: rgba(255,165,0,0.8); }
`;
