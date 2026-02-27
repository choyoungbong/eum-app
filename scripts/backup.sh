#!/bin/bash
# scripts/backup.sh — PostgreSQL 자동 백업
# cron 등록: 0 3 * * * /opt/eum/scripts/backup.sh >> /opt/eum/logs/backup.log 2>&1

set -euo pipefail

APP_DIR="/opt/eum"
BACKUP_DIR="$APP_DIR/backups"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

# .env에서 DB 정보 읽기
source <(grep -E "^POSTGRES_" "$APP_DIR/.env" | sed 's/^/export /')

DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="$BACKUP_DIR/eum_backup_$DATE.sql.gz"

echo "[$(date)] 백업 시작..."

# Docker 컨테이너에서 pg_dump 실행
docker compose -f "$APP_DIR/docker-compose.yml" exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[$(date)] 백업 완료: $FILENAME ($SIZE)"

# 오래된 백업 삭제
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] ${KEEP_DAYS}일 이전 백업 삭제 완료"

# ── 복원 방법 ─────────────────────────────────────────────
# gunzip -c eum_backup_YYYY-MM-DD_HH-MM-SS.sql.gz | \
#   docker compose exec -T db psql -U eum_user eum_db
