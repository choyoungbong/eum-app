// src/lib/cache.ts
// Redis 없이 메모리 기반 TTL 캐시
// Next.js 서버 프로세스 내에서 공유 (단일 서버 환경에 적합)

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    // 1분마다 만료 항목 정리
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.evictExpired(), 60_000);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number, tags: string[] = []): void {
    // LRU: 최대 크기 초과 시 가장 오래된 항목 삭제
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** 태그로 관련 캐시 일괄 무효화 */
  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) this.store.delete(key);
    }
  }

  /** 패턴으로 캐시 무효화 */
  invalidateByPattern(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  get size() { return this.store.size; }
}

// 전역 싱글턴
const cache = new MemoryCache(2000);
export default cache;

// ── 편의 래퍼 ─────────────────────────────────────────────

/**
 * 캐시에서 가져오거나 fetcher 실행 후 캐시에 저장
 * @example
 *   const data = await withCache(
 *     `stats:${userId}`,
 *     () => prisma.file.count({ where: { userId } }),
 *     60,           // TTL: 60초
 *     ["user-stats"] // 태그 (invalidateByTag로 일괄 무효화)
 *   );
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60,
  tags: string[] = []
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  cache.set(key, fresh, ttlSeconds, tags);
  return fresh;
}

// ── TTL 상수 ─────────────────────────────────────────────
export const TTL = {
  SHORT:    30,   // 30초 - 자주 변하는 데이터 (알림 수)
  MEDIUM:   300,  // 5분  - 보통 (파일 목록)
  LONG:     3600, // 1시간 - 자주 안 변하는 데이터 (통계)
  VERY_LONG: 86400, // 24시간 - 거의 안 변하는 데이터 (태그 목록)
};

// ── 사용 예시 ─────────────────────────────────────────────
// API route에서:
//
// import { withCache, cache, TTL } from "@/lib/cache";
//
// export async function GET() {
//   const stats = await withCache(
//     "admin:stats",
//     () => fetchExpensiveStats(),
//     TTL.LONG,
//     ["admin-stats"]
//   );
//   return NextResponse.json(stats);
// }
//
// // 데이터 변경 시 무효화:
// cache.invalidateByTag("admin-stats");
// cache.invalidateByPattern(`user:${userId}:`);
