#!/bin/bash
# scripts/deploy.sh — 무중단 배포 스크립트
# 사용: bash scripts/deploy.sh [--first-run]

set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
info() { echo -e "${BLUE}[·] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
err()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }

APP_DIR="${APP_DIR:-/opt/eum}"
FIRST_RUN="${1:-}"

cd "$APP_DIR"

# .env 존재 확인
[ ! -f ".env" ] && err ".env 파일이 없습니다. cp .env.example .env 후 설정해 주세요."

echo ""
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}  이음 배포 시작${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo ""

# ── 최신 이미지 풀 ───────────────────────────────────────
info "최신 Docker 이미지 받는 중..."
docker compose pull app db nginx 2>/dev/null || true
log "이미지 최신화 완료"

# ── 첫 실행: DB 초기화 ────────────────────────────────────
if [ "$FIRST_RUN" = "--first-run" ]; then
  info "첫 실행 — DB 컨테이너 시작..."
  docker compose up -d db
  info "DB 준비 대기 중..."
  sleep 10

  info "Prisma 마이그레이션 실행..."
  docker compose run --rm app npx prisma migrate deploy
  log "DB 초기화 완료"
fi

# ── 일반 배포: 마이그레이션 ──────────────────────────────
if [ "$FIRST_RUN" != "--first-run" ]; then
  info "DB 마이그레이션 적용..."
  docker compose run --rm \
    -e DATABASE_URL="$(grep DATABASE_URL .env | cut -d= -f2-)" \
    app npx prisma migrate deploy || warn "마이그레이션 없음 또는 이미 최신"
fi

# ── 앱 무중단 재시작 ─────────────────────────────────────
info "앱 무중단 재시작..."
docker compose up -d --no-deps --force-recreate app nginx
log "앱 재시작 완료"

# ── 헬스체크 확인 ────────────────────────────────────────
info "헬스체크 확인 중..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  STATUS=$(curl -sf http://localhost:3000/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || echo "")
  if [ "$STATUS" = "ok" ]; then
    log "헬스체크 통과 (${WAITED}초 소요)"
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  warn "헬스체크 시간 초과 — 로그를 확인하세요: docker compose logs app"
fi

# ── 이전 이미지 정리 ─────────────────────────────────────
info "미사용 이미지 정리..."
docker image prune -f --filter "until=24h" > /dev/null
log "정리 완료"

# ── 현재 상태 출력 ───────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  배포 완료! 🎉${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
docker compose ps
echo ""
echo "  📊 로그 보기:   docker compose logs -f app"
echo "  🔄 재시작:      docker compose restart app"
echo "  🛑 중지:        docker compose down"
echo ""
