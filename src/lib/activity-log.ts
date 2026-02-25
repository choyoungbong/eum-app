// src/lib/activity-log.ts
// 다른 API route에서 import해서 활동을 기록하세요.
// 예: 파일 업로드 완료 후 → logActivity({ userId, action: "FILE_UPLOAD", target: file.originalName })

import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

type ActivityAction =
  | "FILE_UPLOAD" | "FILE_DELETE" | "FILE_DOWNLOAD" | "FILE_SHARE"
  | "FOLDER_CREATE" | "FOLDER_DELETE"
  | "POST_CREATE" | "POST_DELETE"
  | "COMMENT_CREATE" | "COMMENT_DELETE"
  | "PROFILE_UPDATE" | "PASSWORD_CHANGE"
  | "LOGIN" | "LOGOUT"
  | "CHAT_MESSAGE" | "CALL_START" | "CALL_END";

interface LogActivityInput {
  userId: string;
  action: ActivityAction;
  target?: string;       // 파일명, 게시글 제목 등
  targetId?: string;     // 해당 리소스 ID
  request?: NextRequest; // IP 추출용 (선택)
  extra?: Record<string, unknown>; // 추가 메타
}

export async function logActivity(input: LogActivityInput) {
  try {
    const meta: Record<string, unknown> = { ...(input.extra ?? {}) };
    if (input.request) {
      meta.ip = input.request.headers.get("x-forwarded-for")
             ?? input.request.headers.get("x-real-ip")
             ?? "unknown";
      meta.ua = input.request.headers.get("user-agent")?.slice(0, 120);
    }

    await prisma.activityLog.create({
      data: {
        userId:   input.userId,
        action:   input.action,
        target:   input.target,
        targetId: input.targetId,
        meta:     Object.keys(meta).length ? meta : undefined,
      },
    });
  } catch (err) {
    // 로그 실패는 조용히 처리 — 주요 기능 영향 없어야 함
    console.error("logActivity error:", err);
  }
}

// ──────────────────────────────────────────────
// 사용 예시
// ──────────────────────────────────────────────
//
// [파일 업로드] src/app/api/files/route.ts
// await logActivity({ userId, action: "FILE_UPLOAD", target: file.originalName, targetId: file.id, request });
//
// [파일 삭제]
// await logActivity({ userId, action: "FILE_DELETE", target: file.originalName, targetId: file.id });
//
// [게시글 작성]
// await logActivity({ userId, action: "POST_CREATE", target: post.title, targetId: post.id });
//
// [로그인] src/app/api/auth/[...nextauth]/route.ts → callbacks.signIn
// await logActivity({ userId: user.id, action: "LOGIN", request });
