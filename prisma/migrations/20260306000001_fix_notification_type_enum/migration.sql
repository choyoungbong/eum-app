-- prisma/migrations/20260306000001_fix_notification_type_enum/migration.sql
-- ⚠️  주의: 기존 notifications 테이블에 데이터가 있으면 아래 순서대로 실행해야 합니다.

-- 1. 새 enum 타입 생성
CREATE TYPE "NotificationType_new" AS ENUM (
  'SYSTEM',
  'FILE_SHARED',
  'POST_COMMENT',
  'POST_LIKE',
  'FOLLOW',
  'CALL_MISSED',
  'CHAT_MESSAGE'
);

-- 2. 기존 데이터 마이그레이션 (기존 값 → 새 값 매핑)
ALTER TABLE "notifications"
  ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType_new"
  USING (
    CASE "type"::text
      WHEN 'COMMENT'     THEN 'POST_COMMENT'
      WHEN 'SHARE'       THEN 'FILE_SHARED'
      WHEN 'CHAT'        THEN 'CHAT_MESSAGE'
      WHEN 'SYSTEM'      THEN 'SYSTEM'
      WHEN 'FILE_UPLOAD' THEN 'FILE_SHARED'
      WHEN 'CALL'        THEN 'CALL_MISSED'
      ELSE 'SYSTEM'
    END
  )::"NotificationType_new";

-- 3. 기존 enum 삭제 후 rename
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";

-- 4. default 복원
ALTER TABLE "notifications"
  ALTER COLUMN "type" SET DEFAULT 'SYSTEM'::"NotificationType";
