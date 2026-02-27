#!/bin/bash
# scripts/setup.sh — 서버 최초 초기화 스크립트
# 실행: bash scripts/setup.sh
# 대상: Ubuntu 22.04 / 24.04 LTS

set -euo pipefail

# ── 색상 출력 ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[·]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── 변수 ─────────────────────────────────────────────────
APP_DIR="/opt/eum"
APP_USER="deploy"
DOMAIN="${DOMAIN:-eum.app}"

info "이음 서버 초기화를 시작합니다..."

# root 확인
[[ $EUID -ne 0 ]] && err "root 권한이 필요합니다 (sudo bash scripts/setup.sh)"

# ── 시스템 업데이트 ───────────────────────────────────────
info "시스템 패키지 업데이트..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 필수 패키지 ───────────────────────────────────────────
info "필수 패키지 설치..."
apt-get install -y -qq \
  curl wget git ufw fail2ban \
  ca-certificates gnupg lsb-release \
  certbot python3-certbot-nginx

# ── Docker 설치 ───────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  info "Docker 설치..."
  curl -fsSL https://get.docker.com | sh
  log "Docker 설치 완료"
else
  log "Docker 이미 설치됨: $(docker --version)"
fi

# ── 배포 사용자 생성 ──────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  info "배포 사용자 생성: $APP_USER"
  useradd -m -s /bin/bash "$APP_USER"
  usermod -aG docker "$APP_USER"
  mkdir -p /home/$APP_USER/.ssh
  cp ~/.ssh/authorized_keys /home/$APP_USER/.ssh/ 2>/dev/null || true
  chown -R $APP_USER:$APP_USER /home/$APP_USER/.ssh
  log "사용자 $APP_USER 생성 완료"
fi

# ── 앱 디렉토리 ───────────────────────────────────────────
info "앱 디렉토리 설정..."
mkdir -p $APP_DIR/{storage,logs,nginx/conf.d}
chown -R $APP_USER:$APP_USER $APP_DIR

# ── 방화벽 설정 ───────────────────────────────────────────
info "UFW 방화벽 설정..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "방화벽 설정 완료"

# ── Fail2ban ─────────────────────────────────────────────
info "Fail2ban 설정..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
EOF
systemctl enable fail2ban && systemctl restart fail2ban
log "Fail2ban 활성화 완료"

# ── SSL 인증서 ────────────────────────────────────────────
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  warn "SSL 인증서 발급 (도메인 DNS가 이 서버를 가리켜야 합니다)"
  certbot certonly --standalone \
    --non-interactive --agree-tos \
    --email "admin@$DOMAIN" \
    -d "$DOMAIN" -d "www.$DOMAIN" || warn "SSL 발급 실패 — DNS 확인 후 수동 실행하세요"
else
  log "SSL 인증서 이미 존재함"
fi

# ── cron: SSL 자동 갱신 ───────────────────────────────────
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.yml exec nginx nginx -s reload") | crontab -

echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  초기화 완료! 다음 단계:${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo "  1. 앱 파일 복사:"
echo "     scp -r . $APP_USER@$DOMAIN:$APP_DIR"
echo ""
echo "  2. 환경변수 설정:"
echo "     cp $APP_DIR/.env.example $APP_DIR/.env"
echo "     nano $APP_DIR/.env"
echo ""
echo "  3. 앱 시작:"
echo "     cd $APP_DIR && bash scripts/deploy.sh"
echo ""
