// src/lib/notification.ts
import { prisma } from "@/lib/db";

type NotificationType =
  | "COMMENT"
  | "SHARE"
  | "CHAT"
  | "SYSTEM"
  | "FILE_UPLOAD"
  | "CALL";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;   // ✅ 필수 (스키마 message String)
  body?: string;     // 선택 (스키마 body String?)
  link?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    return await prisma.notification.create({
      data: {
        userId:  input.userId,
        type:    input.type,
        title:   input.title,
        message: input.message,   // ✅ 추가
        body:    input.body,
        link:    input.link,
      },
    });
  } catch (error) {
    console.error("createNotification error:", error);
  }
}