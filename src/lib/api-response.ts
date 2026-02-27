// src/lib/api-response.ts
// 전체 API에서 사용할 표준화된 응답 형식
//
// 성공: { success: true,  data: T,      meta?: M }
// 실패: { success: false, error: string, code: ErrorCode, details?: unknown }

import { NextResponse } from "next/server";

// ── 에러 코드 체계 ────────────────────────────────────────
export const ErrorCode = {
  // 인증
  UNAUTHORIZED:        "UNAUTHORIZED",
  FORBIDDEN:           "FORBIDDEN",
  SESSION_EXPIRED:     "SESSION_EXPIRED",
  ACCOUNT_BANNED:      "ACCOUNT_BANNED",

  // 입력값
  VALIDATION_ERROR:    "VALIDATION_ERROR",
  MISSING_FIELD:       "MISSING_FIELD",
  INVALID_FORMAT:      "INVALID_FORMAT",

  // 리소스
  NOT_FOUND:           "NOT_FOUND",
  ALREADY_EXISTS:      "ALREADY_EXISTS",
  CONFLICT:            "CONFLICT",

  // 제한
  RATE_LIMITED:        "RATE_LIMITED",
  STORAGE_QUOTA:       "STORAGE_QUOTA",
  FILE_TOO_LARGE:      "FILE_TOO_LARGE",
  MAX_LIMIT_REACHED:   "MAX_LIMIT_REACHED",

  // 서버
  INTERNAL_ERROR:      "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR:      "DATABASE_ERROR",
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ── 타입 정의 ─────────────────────────────────────────────
interface SuccessResponse<T, M = undefined> {
  success: true;
  data:    T;
  meta?:   M;
}
interface ErrorResponse {
  success: false;
  error:   string;
  code:    ErrorCode;
  details?: unknown;
}
interface PaginatedMeta {
  page:     number;
  limit:    number;
  total:    number;
  hasMore:  boolean;
}

// ── 응답 빌더 ─────────────────────────────────────────────
export function ok<T>(data: T, status = 200): NextResponse {
  const body: SuccessResponse<T> = { success: true, data };
  return NextResponse.json(body, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function paginated<T>(
  items:    T[],
  meta:     PaginatedMeta,
  status = 200
): NextResponse {
  const body: SuccessResponse<T[], PaginatedMeta> = { success: true, data: items, meta };
  return NextResponse.json(body, { status });
}

export function error(
  message: string,
  code:    ErrorCode,
  status:  number,
  details?: unknown
): NextResponse {
  const body: ErrorResponse = { success: false, error: message, code, details };
  return NextResponse.json(body, { status });
}

// ── 자주 쓰는 에러 단축키 ────────────────────────────────
export const ApiError = {
  unauthorized:     (msg = "인증이 필요합니다") =>
    error(msg, ErrorCode.UNAUTHORIZED, 401),

  forbidden:        (msg = "권한이 없습니다") =>
    error(msg, ErrorCode.FORBIDDEN, 403),

  notFound:         (resource = "리소스") =>
    error(`${resource}를 찾을 수 없습니다`, ErrorCode.NOT_FOUND, 404),

  conflict:         (msg: string) =>
    error(msg, ErrorCode.CONFLICT, 409),

  validation:       (msg: string, details?: unknown) =>
    error(msg, ErrorCode.VALIDATION_ERROR, 422, details),

  rateLimited:      () =>
    error("너무 많은 요청입니다. 잠시 후 다시 시도해주세요", ErrorCode.RATE_LIMITED, 429),

  storageQuota:     () =>
    error("저장 용량이 부족합니다", ErrorCode.STORAGE_QUOTA, 413),

  internal:         (msg = "서버 오류가 발생했습니다") =>
    error(msg, ErrorCode.INTERNAL_ERROR, 500),
};

// ── 사용 예시 ─────────────────────────────────────────────
// import { ok, created, paginated, ApiError } from "@/lib/api-response";
//
// // 성공
// return ok({ file });
// return created({ file });
// return paginated(files, { page, limit, total, hasMore });
//
// // 에러
// return ApiError.unauthorized();
// return ApiError.notFound("파일");
// return ApiError.validation("이메일 형식이 올바르지 않습니다", { field: "email" });
