/**
 * 데모 모드 설정
 * 앱스토어 심사용 데모 계정 및 샘플 데이터
 */

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// 심사관용 데모 계정
export const DEMO_USERS = [
  {
    id: 'demo-reviewer-001',
    email: 'reviewer@appstore.com',
    password: 'Demo2024!Review',
    name: 'App Store Reviewer',
    role: 'USER' as const,
  },
  {
    id: 'demo-user-001',
    email: 'testuser@demo.com',
    password: 'Demo2024!Test',
    name: 'Test User',
    role: 'USER' as const,
  },
];

// 데모 유저인지 확인
export function isDemoUser(email: string): boolean {
  return DEMO_USERS.some((user) => user.email === email);
}

// 데모 계정 정보 가져오기
export function getDemoUser(email: string) {
  return DEMO_USERS.find((user) => user.email === email);
}
