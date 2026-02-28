# Dockerfile
# 멀티스테이지 빌드 — 최종 이미지 크기 최소화
# ─────────────────────────────────────────────

# ── 스테이지 1: 의존성 설치 ───────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── 스테이지 2: 빌드 ──────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드용 환경변수 (런타임 시크릿 제외)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Prisma 클라이언트 생성
RUN npx prisma generate

# Next.js 빌드
RUN npm run build

# ── 스테이지 3: 프로덕션 이미지 ──────────────
FROM node:20-alpine AS runner
WORKDIR /app

# 보안: 전용 비루트 사용자
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# sharp (이미지 최적화) 네이티브 의존성
RUN apk add --no-cache vips-dev

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 빌드 아티팩트 복사
COPY --from=builder /app/public          ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static    ./.next/static
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/server.ts       ./server.ts
COPY --from=builder /app/package.json    ./package.json

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
