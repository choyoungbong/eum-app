// src/lib/emit-notification.ts
import { prisma } from "@/lib/db";

type NotificationType = "COMMENT" | "SHARE" | "CHAT" | "SYSTEM" | "FILE_UPLOAD" | "CALL";

interface EmitNotificationParams {
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  metadata?: any;
}

export async function emitNotification(
  userId: string,
  params: EmitNotificationParams
) {
  try {
    // 1. DB에 알림 저장
    const notification = await prisma.notification.create({
      data: {
        userId,
        title:    params.title,
        message:  params.message,
        type:     params.type,
        link:     params.link,
        metadata: params.metadata || {},
        isRead:   false,   // ✅ 수정: read → isRead (스키마 필드명)
      },
    });

    // 2. 실시간 소켓 전송
    const io = (global as any).io;
    if (io) {
      io.to(`user:${userId}`).emit("notification:new", notification);
    } else {
      console.warn(`[Notification] global.io 없음 — userId=${userId} DB만 저장`);
    }

    return notification;
  } catch (error) {
    console.error("emitNotification error:", error);
    return null;
  }
}
