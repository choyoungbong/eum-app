// src/lib/emit-notification.ts
import * as socketServer from "@/lib/socket-server";
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
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link,
        metadata: params.metadata || {},
        isRead: false,
      },
    });

    // 2. 실시간 소켓 전송 (안전한 방식)
    // socket-server에 emitToUser가 명시적으로 export 되지 않았을 경우를 대비해 any로 처리
    const server = socketServer as any;
    
    if (server && typeof server.emitToUser === "function") {
      server.emitToUser(userId, "notification", notification);
    } else if (server && server.io) {
      // 만약 io 객체가 직접 노출되어 있다면 해당 방식으로 전송
      server.io.to(userId).emit("notification", notification);
    } else {
      console.warn(`[Notification] Socket not connected for user ${userId}, but saved to DB.`);
    }

    return notification;
  } catch (error) {
    console.error("Emit notification error:", error);
    // 빌드 중단 방지를 위해 에러를 던지지 않고 로그만 남깁니다.
    return null;
  }
}