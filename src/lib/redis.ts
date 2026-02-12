import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// 헬퍼 함수들
export const redisHelpers = {
  // 세션 저장
  async setSession(sessionId: string, data: any, expirySeconds: number = 86400) {
    await redis.setex(\session:\\, expirySeconds, JSON.stringify(data));
  },

  // 세션 조회
  async getSession(sessionId: string) {
    const data = await redis.get(\session:\\);
    return data ? JSON.parse(data) : null;
  },

  // 세션 삭제
  async deleteSession(sessionId: string) {
    await redis.del(\session:\\);
  },

  // 트랜스코딩 진행률 저장
  async setTranscodeProgress(jobId: string, progress: number) {
    await redis.setex(\	ranscode:progress:\\, 3600, progress.toString());
  },

  // 트랜스코딩 진행률 조회
  async getTranscodeProgress(jobId: string): Promise<number | null> {
    const progress = await redis.get(\	ranscode:progress:\\);
    return progress ? parseFloat(progress) : null;
  },
};

export default redis;
