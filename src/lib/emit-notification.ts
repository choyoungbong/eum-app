// src/lib/emit-notification.ts
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type NotificationType =
  | "SYSTEM"
  | "FILE_SHARED"
  | "POST_COMMENT"
  | "POST_LIKE"
  | "FOLLOW"
  | "CALL_MISSED"
  | "CHAT_MESSAGE";

interface EmitNotificationParams {
  title:     string;
  message:   string;
  type:      NotificationType;
  link?:     string;
  // ✅ 수정: Record<string, unknown> → Prisma.InputJsonValue (빌드 타입 오류 해결)
  metadata?: Prisma.InputJsonValue;
}

// ─── 단건 알림 생성 ───────────────────────────────────────
export async function emitNotification(
  userId: string,
  params: EmitNotificationParams
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title:    params.title,
        message:  params.message,
        type:     params.type,
        link:     params.link     ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
        isRead:   false,
      },
    });

    const io = (global as any).io;
    if (io) {
      io.to(`user:${userId}`).emit("notification:new", notification);
    }

    return notification;
  } catch (error) {
    console.error("[emitNotification] 알림 저장 실패:", error);
    return null;
  }
}

// ─── 다수 유저에게 동시 알림 ──────────────────────────────
export async function emitNotificationToMany(
  userIds: string[],
  params: EmitNotificationParams
) {
  if (userIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title:    params.title,
        message:  params.message,
        type:     params.type,
        link:     params.link     ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
        isRead:   false,
      })),
      skipDuplicates: true,
    });

    const io = (global as any).io;
    if (io) {
      userIds.forEach((userId) => {
        io.to(`user:${userId}`).emit("notification:new", {
          type:    params.type,
          title:   params.title,
          message: params.message,
          link:    params.link,
        });
      });
    }
  } catch (error) {
    console.error("[emitNotificationToMany] 알림 저장 실패:", error);
  }
}