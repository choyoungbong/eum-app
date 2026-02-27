// src/lib/email-templates.ts
// 이음 이메일 템플릿 모음 — 기존 email.ts와 함께 사용

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://eum.app";

const baseLayout = (content: string, previewText = "") => `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>이음</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
    .wrapper { max-width: 580px; margin: 40px auto; }
    .card { background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
    .header { background: linear-gradient(135deg, #5b21b6 0%, #3730a3 100%); padding: 32px 40px; text-align: center; }
    .logo { display: inline-flex; align-items: center; gap: 10px; }
    .logo-icon { width: 36px; height: 36px; background: rgba(255,255,255,.15); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .logo-text { color: #fff; font-size: 20px; font-weight: 900; letter-spacing: -.5px; }
    .body { padding: 40px; }
    .title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 12px; line-height: 1.3; }
    .text { font-size: 15px; color: #555; line-height: 1.7; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 14px 32px; background: #5b21b6; color: #fff !important; font-size: 15px; font-weight: 700; border-radius: 12px; text-decoration: none; margin: 16px 0; }
    .btn:hover { background: #4c1d95; }
    .divider { height: 1px; background: #f0f0f3; margin: 24px 0; }
    .notice { background: #faf9ff; border: 1px solid #e8e3ff; border-radius: 12px; padding: 16px; font-size: 13px; color: #7c3aed; margin: 20px 0; }
    .code { font-family: 'Courier New', monospace; font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #5b21b6; text-align: center; padding: 20px; background: #faf9ff; border-radius: 12px; margin: 20px 0; }
    .footer { background: #f8f7ff; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #999; line-height: 1.8; }
    .footer a { color: #7c3aed; text-decoration: none; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">
          <div class="logo-icon">☁️</div>
          <div class="logo-text">이음</div>
        </div>
      </div>
      <div class="body">${content}</div>
    </div>
    <div class="footer">
      <p>이 이메일은 이음 퍼스널 클라우드에서 발송되었습니다.</p>
      <p><a href="${BASE_URL}">이음 방문하기</a> · <a href="${BASE_URL}/settings">알림 설정</a></p>
      <p style="margin-top:8px;color:#bbb;">© 2026 EUM CLOUD SERVICE</p>
    </div>
  </div>
</body>
</html>`;

// ① 이메일 인증
export function emailVerificationTemplate(name: string, code: string) {
  return baseLayout(`
    <h2 class="title">이메일 인증</h2>
    <p class="text">안녕하세요, <strong>${name}</strong>님!<br/>
    아래 인증 코드를 입력해 이음 계정을 활성화하세요.</p>
    <div class="code">${code}</div>
    <p class="text" style="font-size:13px;color:#999;">이 코드는 10분 후 만료됩니다. 본인이 요청하지 않았다면 무시하세요.</p>
  `, `[이음] 이메일 인증 코드: ${code}`);
}

// ② 비밀번호 재설정
export function passwordResetTemplate(name: string, resetUrl: string) {
  return baseLayout(`
    <h2 class="title">비밀번호 재설정</h2>
    <p class="text">안녕하세요, <strong>${name}</strong>님!<br/>
    비밀번호 재설정 요청이 접수되었습니다. 아래 버튼을 눌러 새 비밀번호를 설정하세요.</p>
    <div style="text-align:center;">
      <a href="${resetUrl}" class="btn">🔑 비밀번호 재설정</a>
    </div>
    <div class="notice">⏱ 이 링크는 1시간 후 만료됩니다. 본인이 요청하지 않았다면 즉시 비밀번호를 변경하세요.</div>
    <p class="text" style="font-size:13px;color:#999;">버튼이 작동하지 않으면 아래 링크를 복사하세요:<br/>
    <a href="${resetUrl}" style="color:#7c3aed;word-break:break-all;">${resetUrl}</a></p>
  `, "이음 비밀번호 재설정 링크가 도착했습니다");
}

// ③ 파일 공유 알림
export function fileSharedTemplate(
  recipientName: string, senderName: string,
  fileName: string, shareUrl: string, permission: "VIEW" | "EDIT" | "ADMIN"
) {
  const permLabel = { VIEW: "읽기", EDIT: "편집", ADMIN: "관리" }[permission];
  return baseLayout(`
    <h2 class="title">📁 파일이 공유되었습니다</h2>
    <p class="text">안녕하세요, <strong>${recipientName}</strong>님!<br/>
    <strong>${senderName}</strong>님이 파일을 공유했습니다.</p>
    <div class="notice">
      <strong>파일명:</strong> ${fileName}<br/>
      <strong>권한:</strong> ${permLabel}
    </div>
    <div style="text-align:center;">
      <a href="${shareUrl}" class="btn">📂 파일 보기</a>
    </div>
  `, `${senderName}님이 "${fileName}"을 공유했습니다`);
}

// ④ 팔로우 알림
export function followNotificationTemplate(
  recipientName: string, followerName: string, followerProfileUrl: string
) {
  return baseLayout(`
    <h2 class="title">👤 새 팔로워</h2>
    <p class="text">안녕하세요, <strong>${recipientName}</strong>님!<br/>
    <strong>${followerName}</strong>님이 회원님을 팔로우하기 시작했습니다.</p>
    <div style="text-align:center;">
      <a href="${followerProfileUrl}" class="btn">프로필 보기</a>
    </div>
  `, `${followerName}님이 팔로우했습니다`);
}

// ⑤ 주간 요약 다이제스트
export function weeklyDigestTemplate(
  name: string,
  stats: { newFiles: number; newComments: number; newFollowers: number; storageUsed: string }
) {
  return baseLayout(`
    <h2 class="title">📊 주간 활동 요약</h2>
    <p class="text">안녕하세요, <strong>${name}</strong>님! 이번 주 이음 활동을 확인하세요.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;">
      ${[
        { label: "📁 새 파일", value: stats.newFiles },
        { label: "💬 새 댓글", value: stats.newComments },
        { label: "👥 새 팔로워", value: stats.newFollowers },
        { label: "💾 저장 사용량", value: stats.storageUsed },
      ].map(({ label, value }) => `
        <div style="background:#faf9ff;border:1px solid #e8e3ff;border-radius:12px;padding:16px;text-align:center;">
          <p style="font-size:13px;color:#7c3aed;font-weight:600;">${label}</p>
          <p style="font-size:22px;font-weight:900;color:#111;margin-top:4px;">${value}</p>
        </div>
      `).join("")}
    </div>
    <div style="text-align:center;">
      <a href="${BASE_URL}/dashboard" class="btn">대시보드 보기</a>
    </div>
  `, `${name}님의 이번 주 이음 활동 요약`);
}

// ⑥ 계정 정지 알림
export function accountBannedTemplate(name: string, reason: string) {
  return baseLayout(`
    <h2 class="title" style="color:#dc2626;">🚫 계정이 정지되었습니다</h2>
    <p class="text">안녕하세요, <strong>${name}</strong>님.<br/>
    이음 이용 정책 위반으로 계정이 일시 정지되었습니다.</p>
    <div class="notice" style="background:#fff5f5;border-color:#fecaca;color:#dc2626;">
      <strong>사유:</strong> ${reason}
    </div>
    <p class="text">문의사항이 있으시면 <a href="mailto:support@eum.app" style="color:#7c3aed;">support@eum.app</a>으로 연락해 주세요.</p>
  `, "이음 계정 정지 안내");
}
