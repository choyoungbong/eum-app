/**
 * XSS 방지를 위한 HTML 이스케이프
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * 파일명 sanitize (경로 조작 방지)
 */
export function sanitizeFilename(filename: string): string {
  // 위험한 문자 제거
  return filename
    .replace(/[\/\\]/g, '_')      // 슬래시 제거
    .replace(/\.\./g, '_')         // 상위 디렉토리 접근 방지
    .replace(/[<>:"|?*]/g, '_')    // 파일시스템 예약 문자
    .slice(0, 255);                // 길이 제한
}

/**
 * URL 파라미터 검증
 */
export function validateUrlParam(param: string, type: 'id' | 'email' | 'string'): boolean {
  switch (type) {
    case 'id':
      // CUID 형식 검증
      return /^c[a-z0-9]{24}$/.test(param);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(param);
    case 'string':
      return param.length > 0 && param.length <= 1000;
    default:
      return false;
  }
}