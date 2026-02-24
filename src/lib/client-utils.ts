/**
 * src/lib/client-utils.ts
 * 클라이언트 공통 유틸 함수 모음
 */

// ── 파일 크기 ────────────────────────────────────
export function formatFileSize(bytes: number | string): string {
  const n = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (!n || isNaN(n)) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// ── 상대 시간 ────────────────────────────────────
export function relativeTime(dateStr: string | Date): string {
  const now = Date.now();
  const ts = typeof dateStr === "string" ? new Date(dateStr).getTime() : dateStr.getTime();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

// ── 절대 날짜/시간 ──────────────────────────────
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function formatTime(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

// ── 파일 타입 아이콘 ─────────────────────────────
export function getFileIcon(mimeType: string): string {
  if (!mimeType) return "📁";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📑";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("tar")) return "🗜️";
  if (mimeType.includes("text/plain")) return "📃";
  if (mimeType.includes("html")) return "🌐";
  if (mimeType.includes("json")) return "🔧";
  if (mimeType.includes("javascript") || mimeType.includes("typescript")) return "⚙️";
  if (mimeType.includes("python")) return "🐍";
  return "📁";
}

// ── 파일 색상 (카드 배경) ──────────────────────
export function getFileColor(mimeType: string): string {
  if (!mimeType) return "bg-gray-50";
  if (mimeType.startsWith("image/")) return "bg-pink-50";
  if (mimeType.startsWith("video/")) return "bg-purple-50";
  if (mimeType.startsWith("audio/")) return "bg-yellow-50";
  if (mimeType.includes("pdf")) return "bg-red-50";
  if (mimeType.includes("word") || mimeType.includes("document")) return "bg-blue-50";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "bg-green-50";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "bg-orange-50";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "bg-amber-50";
  return "bg-gray-50";
}

// ── 파일 확장자 추출 ─────────────────────────────
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
}

// ── 클립보드 복사 ────────────────────────────────
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

// ── 바이트 → 퍼센트 (용량 제한 기준) ────────────
export function storagePercent(usedBytes: number, limitBytes: number = 5 * 1024 ** 3): number {
  return Math.min((usedBytes / limitBytes) * 100, 100);
}
