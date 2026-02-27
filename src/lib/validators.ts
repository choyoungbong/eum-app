// src/lib/validators.ts
// Zod 기반 API 입력값 스키마 정의
// npm install zod

import { z } from "zod";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-response";
import type { NextResponse } from "next/server";

// ── 공통 스키마 ──────────────────────────────────────────
export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idSchema = z.string().cuid({ message: "유효하지 않은 ID입니다" });

// ── 인증 ─────────────────────────────────────────────────
export const registerSchema = z.object({
  name:     z.string().min(2, "이름은 2자 이상이어야 합니다").max(50),
  email:    z.string().email("올바른 이메일 형식이 아닙니다"),
  password: z.string()
    .min(8,  "비밀번호는 8자 이상이어야 합니다")
    .max(100)
    .regex(/[A-Z]/,  "대문자를 포함해야 합니다")
    .regex(/[0-9]/,  "숫자를 포함해야 합니다")
    .regex(/[^A-Za-z0-9]/, "특수문자를 포함해야 합니다"),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
  newPassword:     z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다"),
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: "새 비밀번호는 현재 비밀번호와 달라야 합니다",
  path:    ["newPassword"],
});

// ── 파일 ─────────────────────────────────────────────────
export const fileUploadSchema = z.object({
  folderId: z.string().cuid().optional().nullable(),
});

export const fileEncryptSchema = z.object({
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다").max(100),
});

export const fileVersionSchema = z.object({
  comment: z.string().max(200).optional(),
});

// ── 게시글 ───────────────────────────────────────────────
export const createPostSchema = z.object({
  title:      z.string().min(1, "제목을 입력해주세요").max(200),
  content:    z.string().min(1, "내용을 입력해주세요").max(50_000),
  visibility: z.enum(["PUBLIC", "PRIVATE", "SHARED"]).default("PUBLIC"),
  tags:       z.array(z.string().max(30)).max(10).optional(),
});

export const createCommentSchema = z.object({
  content:    z.string().min(1, "댓글을 입력해주세요").max(2000),
  mentionIds: z.array(z.string().cuid()).max(20).optional(),
});

// ── 채팅 ─────────────────────────────────────────────────
export const createRoomSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  memberIds:   z.array(z.string().cuid()).min(1).max(50),
  type:        z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
});

export const sendMessageSchema = z.object({
  type:     z.enum(["TEXT", "FILE", "SYSTEM"]).default("TEXT"),
  content:  z.string().max(10_000).optional(),
  fileId:   z.string().cuid().optional(),
}).refine((d) => d.content || d.fileId, {
  message: "메시지 내용 또는 파일이 필요합니다",
});

// ── 알림 설정 ─────────────────────────────────────────────
export const notificationSettingsSchema = z.object({
  emailNotifications:  z.boolean().optional(),
  pushNotifications:   z.boolean().optional(),
  chatNotifications:   z.boolean().optional(),
  mentionNotifications: z.boolean().optional(),
});

// ── API 키 ────────────────────────────────────────────────
export const createApiKeySchema = z.object({
  name:           z.string().min(1, "이름을 입력해주세요").max(100),
  scopes:         z.array(z.string()).min(1, "권한을 하나 이상 선택해주세요"),
  expiresInDays:  z.number().int().min(0).max(365).optional(),
});

// ── 시스템 공지 ───────────────────────────────────────────
export const createNoticeSchema = z.object({
  title:    z.string().min(1).max(200),
  content:  z.string().min(1).max(5000),
  type:     z.enum(["INFO", "WARNING", "MAINTENANCE"]).default("INFO"),
  startsAt: z.string().datetime().optional(),
  endsAt:   z.string().datetime().optional(),
});

// ── 유효성 검사 헬퍼 ─────────────────────────────────────
/**
 * request body를 파싱하고 Zod 스키마로 검증
 * 실패 시 422 응답 반환 (NextResponse)
 */
export async function parseBody<T>(
  request:  NextRequest,
  schema:   z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { data: null, error: ApiError.validation("요청 본문이 유효한 JSON이 아닙니다") };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field:   e.path.join("."),
      message: e.message,
    }));
    return {
      data:  null,
      error: ApiError.validation(details[0]?.message ?? "입력값이 올바르지 않습니다", details),
    };
  }

  return { data: result.data, error: null };
}

/**
 * URL 쿼리 파라미터 검증
 */
export function parseQuery<T>(
  request: NextRequest,
  schema:  z.ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field:   e.path.join("."),
      message: e.message,
    }));
    return { data: null, error: ApiError.validation("쿼리 파라미터가 올바르지 않습니다", details) };
  }
  return { data: result.data, error: null };
}
