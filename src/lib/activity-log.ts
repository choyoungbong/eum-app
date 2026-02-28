// src/lib/activity-log.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

type ActivityAction =
  | "FILE_UPLOAD" | "FILE_DELETE" | "FILE_DOWNLOAD" | "FILE_SHARE"
  | "FOLDER_CREATE" | "FOLDER_DELETE"
  | "POST_CREATE" | "POST_DELETE"
  | "COMMENT_CREATE" | "COMMENT_DELETE"
  | "PROFILE_UPDATE" | "PASSWORD_CHANGE"
  | "LOGIN" | "LOGOUT"
  | "CHAT_MESSAGE" | "CALL_START" | "CALL_END";

interface LogActivityInput {
  userId:   string;
  action:   ActivityAction;
  target?:  string;
  targetId?: string;
  request?: NextRequest;
  extra?:   Record<string, unknown>;
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
        // ✅ Prisma.InputJsonValue 에러를 해결하기 위해 any로 캐스팅
        meta: Object.keys(meta).length
          ? (meta as any) 
          : undefined,
      },
    });
  } catch (err) {
    console.error("logActivity error:", err);
  }
}
