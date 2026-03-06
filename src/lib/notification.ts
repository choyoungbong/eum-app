// src/lib/notification.ts
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ✅ 수정: DB schema NotificationType enum과 일치 (emit-notification.ts와 동일)
type NotificationType =
  | "SYSTEM"
  | "FILE_SHARED"
  | "POST_COMMENT"
  | "POST_LIKE"
  | "FOLLOW"
  | "CALL_MISSED"
  | "CHAT_MESSAGE";

interface CreateNotificationInput {
  userId:   string;
  type:     NotificationType;
  title:    string;
  message:  string;
  body?:    string;
  link?:    string;
  metadata?: Prisma.InputJsonValue; // ✅ 추가: emit-notification.ts와 인터페이스 통일
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        userId:   input.userId,
        type:     input.type,
        title:    input.title,
        message:  input.message,
        body:     input.body,
        link:     input.link,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error("createNotification error:", error);
    return null;
  }
}