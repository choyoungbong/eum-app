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

# ✅ 핵심: 소켓 로직이 인라인된 순수 JS server.js
# tsx, tsc, @/ alias 모두 불필요 — node로 직접 실행
COPY --from=builder /app/server.js ./server.js

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

# ✅ tsx 불필요 — 순수 node로 실행
CMD ["node", "server.js"]
