FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ✅ socket-server.ts + 의존 파일을 CommonJS JS로 별도 컴파일
COPY tsconfig.server.json ./tsconfig.server.json
RUN npx tsc --project tsconfig.server.json || true

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# ✅ 커스텀 server.js 복사
COPY --from=builder /app/server.js ./server.js

# ✅ 컴파일된 서버 모듈 복사 (socket-server.js, db.js, fcm.js)
COPY --from=builder /app/.next/server-dist ./server-dist

RUN mkdir -p \
    /app/storage/files \
    /app/storage/thumbnails \
    /app/storage/optimized \
    /app/storage/avatars \
    /app/storage/covers \
    /app/storage/versions \
    /app/logs \
    && chown -R nextjs:nodejs /app

USER nextjs

ENV PORT=3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
