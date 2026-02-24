-- Migration: Add notifications table
-- Path: prisma/migrations/20260224000000_add_notifications/migration.sql

CREATE TYPE "NotificationType" AS ENUM (
  'COMMENT',
  'SHARE',
  'CHAT',
  'SYSTEM',
  'FILE_UPLOAD',
  'CALL'
);

CREATE TABLE "notifications" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "type"       "NotificationType" NOT NULL DEFAULT 'SYSTEM',
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "link"       TEXT,
  "is_read"    BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
