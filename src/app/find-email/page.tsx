// =============================================
// 파일 1: src/app/find-email/page.tsx
// =============================================
"use client";

import { useState } from "react";
import Link from "next/link";

export default function FindEmailPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ maskedEmail: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/find-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok) {
        // ✅ [수정] 보안상 API는 항상 200 반환 → maskedEmail === null로 미존재 계정 판별
        // 기존: res.ok만 체크 → maskedEmail이 null이어도 result에 세팅되어 빈 화면 표시
        if (data.maskedEmail === null) {
          setError("일치하는 계정을 찾을 수 없습니다");
        } else {
          setResult(data);
        }
      } else {
        setError(data.error || "오류가 발생했습니다");
      }
    } catch {
      setError("오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleSendFull = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/find-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) setSent(true);
      else setError("이메일 발송 실패");
    } catch {
      setError("발송 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eum-root">
      <div className="eum-bg"><div className="eum-blob b1"/><div className="eum-blob b2"/></div>
      <div className="eum-container">
        <Link href="/login" className="eum-back">← 로그인으로 돌아가기</Link>

        <div className="eum-card">
          <div className="eum-icon-wrap">📧</div>
          <h2 className="eum-title">이메일 찾기</h2>
          <p className="eum-sub">가입 시 입력한 이름으로 이메일을 찾을 수 있습니다</p>

          {!result && !sent && (
            <form onSubmit={handleFind} className="eum-form">
              {error && <div className="eum-error">⚠️ {error}</div>}
              <div className="eum-field">
                <label className="eum-label">이름</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="가입 시 입력한 이름" className="eum-input" required />
              </div>
              <button type="submit" disabled={loading} className="eum-btn">
                {loading ? "찾는 중..." : "이메일 찾기"}
              </button>
            </form>
          )}

          {result && !sent && (
            <div className="eum-result">
              <p className="eum-result-label">가입된 이메일</p>
              <p className="eum-result-email">{result.maskedEmail}</p>
              <p className="eum-result-desc">전체 이메일 주소를 받으시겠습니까?</p>
              <button onClick={handleSendFull} disabled={loading} className="eum-btn">
                {loading ? "발송 중..." : "이메일로 전체 주소 받기"}
              </button>
              <Link href="/login" className="eum-link-btn">로그인으로 돌아가기</Link>
            </div>
          )}

          {sent && (
            <div className="eum-success">
              <div className="eum-success-icon">✅</div>
              <p className="eum-success-msg">이메일이 발송되었습니다!</p>
              <p className="eum-success-sub">받은 메일함을 확인해주세요<br/>(스팸함도 확인해보세요)</p>
              <Link href="/login" className="eum-btn" style={{display:"block",textAlign:"center",textDecoration:"none",marginTop:"16px"}}>
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
  .eum-result { text-align: center; display: flex; flex-direction: column; gap: 12px; }
  .eum-result-label { font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; }
  .eum-result-email { font-size: 22px; font-weight: 700; color: #a78bfa; letter-spacing: 1px; }
  .eum-result-desc { font-size: 13px; color: rgba(255,255,255,0.5); }
  .eum-link-btn { text-align: center; font-size: 13px; color: rgba(255,255,255,0.35); text-decoration: none; margin-top: 4px; display: block; }
  .eum-success { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .eum-success-icon { font-size: 52px; }
  .eum-success-msg { font-size: 20px; font-weight: 700; color: white; }
  .eum-success-sub { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.7; }
  .eum-expire { font-size: 12px; color: rgba(255,165,0,0.8); }
`;