# Dockerfile
# Multi-stage build (Debian 기반 - Prisma 안정 호환)

# ── Stage 1: Dependencies ─────────────────────
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# 필요한 기본 패키지 설치
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build ───────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Prisma Client 생성
RUN npx prisma generate

# Next.js standalone 빌드
RUN npm run build

# ── Stage 3: Production Runner ───────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# 최소 런타임 패키지
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 보안: 비루트 사용자 생성
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 빌드 결과 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 스토리지 / 로그 디렉토리 생성
RUN mkdir -p /app/storage/files \
             /app/storage/thumbnails \
             /app/storage/optimized \
             /app/storage/avatars \
             /app/storage/covers \
             /app/storage/versions \
             /app/logs \
 && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]