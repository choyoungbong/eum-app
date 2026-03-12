#!/bin/bash
# =============================================================
# EUM 앱 일괄 수정 스크립트
# 실행: bash eum-fix.sh (프로젝트 루트에서)
# =============================================================

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== EUM 앱 일괄 수정 시작 ===${NC}"

# ─────────────────────────────────────────────────────────────
# FIX 1: authOptions import 경로 일괄 수정
# @/app/api/auth/[...nextauth]/route → @/lib/auth
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] authOptions import 경로 수정 중...${NC}"

FILES_TO_FIX=(
  "src/app/api/admin/users/[id]/storage/route.ts"
  "src/app/api/calls/[id]/route.ts"
  "src/app/api/chat/rooms/[id]/read/route.ts"
  "src/app/api/chat/rooms/[id]/route.ts"
  "src/app/api/comments/[id]/route.ts"
  "src/app/api/files/[id]/download/route.ts"
  "src/app/api/files/[id]/encrypt/route.ts"
  "src/app/api/files/[id]/favorite/route.ts"
  "src/app/api/files/[id]/move/route.ts"
  "src/app/api/files/[id]/public-link/route.ts"
  "src/app/api/files/[id]/restore/route.ts"
  "src/app/api/files/[id]/route.ts"
  "src/app/api/files/[id]/share/route.ts"
  "src/app/api/files/[id]/tags/route.ts"
  "src/app/api/files/[id]/thumbnail/route.ts"
  "src/app/api/files/[id]/versions/[versionId]/rollback/route.ts"
  "src/app/api/files/[id]/versions/route.ts"
  "src/app/api/files/route.ts"
  "src/app/api/files/shared/route.ts"
  "src/app/api/files/trash/route.ts"
  "src/app/api/files/upload/route.ts"
  "src/app/api/folders/[id]/download/route.ts"
  "src/app/api/folders/[id]/move/route.ts"
  "src/app/api/folders/[id]/route.ts"
  "src/app/api/folders/[id]/share/route.ts"
  "src/app/api/folders/route.ts"
  "src/app/api/notifications/[id]/route.ts"
  "src/app/api/notifications/preferences/route.ts"
  "src/app/api/notifications/route.ts"
  "src/app/api/posts/[id]/bookmark/route.ts"
  "src/app/api/posts/[id]/comments/route.ts"
  "src/app/api/posts/[id]/like/route.ts"
  "src/app/api/posts/[id]/route.ts"
  "src/app/api/posts/[id]/share/route.ts"
  "src/app/api/posts/[id]/tags/route.ts"
  "src/app/api/posts/bookmarks/route.ts"
  "src/app/api/posts/route.ts"
  "src/app/api/saved-searches/[id]/route.ts"
  "src/app/api/saved-searches/route.ts"
  "src/app/api/search/route.ts"
  "src/app/api/share/[token]/route.ts"
  "src/app/api/share/route.ts"
  "src/app/api/tags/route.ts"
  "src/app/api/users/[id]/follow/route.ts"
  "src/app/api/users/[id]/followers/route.ts"
  "src/app/api/users/[id]/public/route.ts"
  "src/app/api/users/fcm-token/route.ts"
  "src/app/api/users/me/api-keys/[keyId]/route.ts"
  "src/app/api/users/me/api-keys/route.ts"
  "src/app/api/users/me/avatar/route.ts"
  "src/app/api/users/me/export/route.ts"
  "src/app/api/users/me/onboarding/route.ts"
  "src/app/api/users/me/route.ts"
  "src/app/api/users/me/sessions/route.ts"
  "src/app/api/users/mention-search/route.ts"
  "src/app/api/users/presence/route.ts"
  "src/app/api/users/search/route.ts"
  "src/app/api/activity-logs/route.ts"
  "src/app/api/admin/notices/route.ts"
  "src/app/api/admin/stats/route.ts"
  "src/app/api/admin/users/[id]/ban/route.ts"
  "src/app/api/admin/users/[id]/route.ts"
  "src/app/api/admin/users/route.ts"
  "src/app/api/auth/2fa/disable/route.ts"
  "src/app/api/auth/2fa/setup/route.ts"
  "src/app/api/auth/verify-email/confirm/route.ts"
  "src/app/api/auth/verify-email/route.ts"
  "src/app/api/link-preview/route.ts"
  "src/app/api/errors/report/route.ts"
)

FIXED_COUNT=0
for f in "${FILES_TO_FIX[@]}"; do
  if [ -f "$f" ]; then
    if grep -q 'from "@/app/api/auth/\[\.\.\.nextauth\]/route"' "$f"; then
      sed -i 's|from "@/app/api/auth/\[\.\.\.nextauth\]/route"|from "@/lib/auth"|g' "$f"
      echo "  ✅ $f"
      ((FIXED_COUNT++))
    fi
  fi
done

# find로 남은 것들 한 번에 처리 (혹시 누락된 파일 대비)
find src/app/api -name "route.ts" | while read f; do
  if grep -q 'from "@/app/api/auth/\[\.\.\.nextauth\]/route"' "$f"; then
    sed -i 's|from "@/app/api/auth/\[\.\.\.nextauth\]/route"|from "@/lib/auth"|g' "$f"
    echo "  ✅ (추가) $f"
  fi
done

echo -e "  → ${FIXED_COUNT}개 파일 수정 완료"

# ─────────────────────────────────────────────────────────────
# FIX 2: signup 페이지 API 엔드포인트 수정
# /api/auth/signup → /api/auth/register
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] signup 페이지 API 경로 수정 중...${NC}"

SIGNUP_FILE="src/app/(auth)/signup/page.tsx"
if [ -f "$SIGNUP_FILE" ]; then
  if grep -q '"/api/auth/signup"' "$SIGNUP_FILE"; then
    sed -i 's|"/api/auth/signup"|"/api/auth/register"|g' "$SIGNUP_FILE"
    echo "  ✅ $SIGNUP_FILE (signup → register)"
  else
    echo "  ℹ️  이미 수정되어 있거나 해당 패턴 없음"
  fi
fi

# ─────────────────────────────────────────────────────────────
# FIX 3: admin storage route - 동적 import 제거 및 경로 수정
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/6] admin storage route 수정 중...${NC}"

ADMIN_STORAGE="src/app/api/admin/users/[id]/storage/route.ts"
if [ -f "$ADMIN_STORAGE" ]; then
cat > "$ADMIN_STORAGE" << 'HEREDOC'
// src/app/api/admin/users/[id]/storage/route.ts
// PATCH — 사용자 저장 용량 한도 조정 (관리자 전용)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  const { storageLimit } = await request.json();
  if (!storageLimit || storageLimit < 0)
    return NextResponse.json({ error: "올바른 용량을 입력해주세요" }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { storageLimit: BigInt(storageLimit) },
    select: { id: true, name: true, storageLimit: true },
  });

  return NextResponse.json({
    user: { ...user, storageLimit: user.storageLimit.toString() },
    message: `${user.name}의 저장 용량이 변경되었습니다`,
  });
}
HEREDOC
  echo "  ✅ $ADMIN_STORAGE"
fi

# ─────────────────────────────────────────────────────────────
# FIX 4: users/me/storage route 별도 파일로 분리
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/6] users/me/storage route 생성 중...${NC}"

ME_STORAGE_DIR="src/app/api/users/me/storage"
ME_STORAGE="$ME_STORAGE_DIR/route.ts"

mkdir -p "$ME_STORAGE_DIR"
if [ ! -f "$ME_STORAGE" ]; then
cat > "$ME_STORAGE" << 'HEREDOC'
// src/app/api/users/me/storage/route.ts
// GET — 내 저장 사용량 조회

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { storageUsed: true, storageLimit: true },
  });

  const used  = user?.storageUsed  ?? BigInt(0);
  const limit = user?.storageLimit ?? BigInt(5 * 1024 * 1024 * 1024);
  const pct   = limit > 0 ? Math.round(Number((used * BigInt(100)) / limit)) : 0;

  return NextResponse.json({
    storageUsed:  used.toString(),
    storageLimit: limit.toString(),
    percentage:   pct,
  });
}
HEREDOC
  echo "  ✅ $ME_STORAGE (신규 생성)"
else
  echo "  ℹ️  $ME_STORAGE 이미 존재"
fi

# ─────────────────────────────────────────────────────────────
# FIX 5: invest API 파일들 authOptions + import 수정
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[5/6] invest API 파일 수정 중...${NC}"

find src/app/api/invest -name "*.ts" 2>/dev/null | while read f; do
  CHANGED=0
  if grep -q 'from "@/app/api/auth/\[\.\.\.nextauth\]/route"' "$f"; then
    sed -i 's|from "@/app/api/auth/\[\.\.\.nextauth\]/route"|from "@/lib/auth"|g' "$f"
    CHANGED=1
  fi
  if grep -q 'import { db }' "$f"; then
    sed -i 's|import { db }|import { prisma as db }|g' "$f"
    CHANGED=1
  fi
  if [ $CHANGED -eq 1 ]; then
    echo "  ✅ $f"
  fi
done

# ─────────────────────────────────────────────────────────────
# FIX 6: invest page 파일들 authOptions import 수정
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] invest page 파일 수정 중...${NC}"

find src/app/invest -name "*.tsx" 2>/dev/null | while read f; do
  if grep -q 'from "@/app/api/auth/\[\.\.\.nextauth\]/route"' "$f"; then
    sed -i 's|from "@/app/api/auth/\[\.\.\.nextauth\]/route"|from "@/lib/auth"|g' "$f"
    echo "  ✅ $f"
  fi
done

echo ""
echo -e "${GREEN}=== 수정 완료! ===${NC}"
echo ""
echo "다음 단계:"
echo "  1. git diff 로 변경사항 확인"
echo "  2. npm run build 로 빌드 테스트"
echo "  3. git add -A && git commit -m 'fix: authOptions import path, signup route, storage endpoint'"
echo "  4. Railway에 push"
