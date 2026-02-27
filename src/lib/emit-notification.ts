// src/lib/emit-notification.ts
import { emitToUser } from "@/lib/socket-server";
import { prisma } from "@/lib/db";

type NotificationType = "COMMENT" | "SHARE" | "CHAT" | "SYSTEM" | "FILE_UPLOAD" | "CALL";

interface CreateNotificationOptions {
  userId:  string;
  type:    NotificationType;
  title:   string;   // ⚠️ 구 "message" → "title" (Notification 스키마 일치)
  body?:   string;
  link?:   string;
}

export async function createNotification(opts: CreateNotificationOptions) {
  const notification = await prisma.notification.create({
    data: { userId: opts.userId, type: opts.type, title: opts.title, body: opts.body ?? null, link: opts.link ?? null, isRead: false },
  }).catch(() => null);

  try {
    emitToUser(opts.userId, "notification:new", {
      id: notification?.id, type: opts.type, title: opts.title,
      body: opts.body, link: opts.link, createdAt: new Date().toISOString(), isRead: false,
    });
  } catch {}

  return notification;
}

export function broadcastChatMessage(roomId: string, message: unknown) {
  try { const { getIO } = require("@/lib/socket-server"); getIO().to(`room:${roomId}`).emit("chat:message:new", message); } catch {}
}
