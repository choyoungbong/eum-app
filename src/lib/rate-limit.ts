import { NextRequest } from "next/server";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export function rateLimit(
  limit: number = 100, // 요청 횟수
  windowMs: number = 60 * 1000 // 시간 윈도우 (1분)
) {
  return async (request: NextRequest): Promise<{ success: boolean; remaining: number }> => {
    // IP 주소 또는 사용자 ID로 식별
    const identifier = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";
    
    const now = Date.now();
    const record = store[identifier];

    // 첫 요청이거나 윈도우가 만료된 경우
    if (!record || now > record.resetTime) {
      store[identifier] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return { success: true, remaining: limit - 1 };
    }

    // 제한 초과
    if (record.count >= limit) {
      return { success: false, remaining: 0 };
    }

    // 카운트 증가
    record.count++;
    return { success: true, remaining: limit - record.count };
  };
}

// 주기적으로 만료된 항목 정리
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 60 * 1000); // 1분마다