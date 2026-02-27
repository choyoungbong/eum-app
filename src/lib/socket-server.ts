// src/lib/socket-server.ts
// Socket.IO 서버 이벤트 핸들러 전체 (알림 / 타이핑 / 프레즌스 / 업로드 진행률)

import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

// ── 전역 소켓 인스턴스 (API route에서 emit용) ──────────────
let _io: SocketIOServer | null = null;
export function getIO(): SocketIOServer {
  if (!_io) throw new Error("Socket.IO 서버가 초기화되지 않았습니다");
  return _io;
}

// userId → socketId(s) 매핑
const userSockets = new Map<string, Set<string>>();

function joinUser(userId: string, socketId: string) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socketId);
}
function leaveUser(userId: string, socketId: string) {
  userSockets.get(userId)?.delete(socketId);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}
export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}
export function emitToUser(userId: string, event: string, data: unknown) {
  const sids = userSockets.get(userId);
  if (!sids) return;
  for (const sid of sids) _io?.to(sid).emit(event, data);
}

// ── 인증 미들웨어 ─────────────────────────────────────────
async function authenticate(socket: Socket): Promise<string | null> {
  try {
    const cookies = socket.handshake.headers.cookie ?? "";
    const cookieObj: Record<string, string> = {};
    cookies.split(";").forEach((c) => {
      const [k, v] = c.trim().split("=");
      if (k && v) cookieObj[k] = decodeURIComponent(v);
    });

    const token = await getToken({
      req: { headers: { cookie: cookies }, cookies: cookieObj } as any,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    return (token?.sub as string) ?? null;
  } catch {
    return null;
  }
}

// ── 메인 초기화 ──────────────────────────────────────────
export function initSocketServer(io: SocketIOServer) {
  _io = io;

  io.use(async (socket, next) => {
    const userId = await authenticate(socket);
    if (!userId) return next(new Error("인증 실패"));
    (socket as any).userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    const userId: string = (socket as any).userId;
    joinUser(userId, socket.id);

    // 개인 룸 참가 (알림 수신용)
    socket.join(`user:${userId}`);

    // DB 온라인 상태 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeenAt: new Date() },
    }).catch(() => {});

    // 친구/팔로워에게 온라인 알림
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }).catch(() => []);
    for (const { followerId } of followers) {
      emitToUser(followerId, "presence:update", { userId, isOnline: true });
    }

    console.log(`🔌 ${userId} connected (${socket.id})`);

    // ── 채팅방 참가 ──────────────────────────────────────
    socket.on("chat:join", (roomId: string) => {
      socket.join(`room:${roomId}`);
    });
    socket.on("chat:leave", (roomId: string) => {
      socket.leave(`room:${roomId}`);
    });

    // ── 타이핑 인디케이터 ────────────────────────────────
    socket.on("chat:typing:start", ({ roomId }: { roomId: string }) => {
      socket.to(`room:${roomId}`).emit("chat:typing:update", {
        userId, roomId, isTyping: true,
      });
    });
    socket.on("chat:typing:stop", ({ roomId }: { roomId: string }) => {
      socket.to(`room:${roomId}`).emit("chat:typing:update", {
        userId, roomId, isTyping: false,
      });
    });

    // ── 업로드 진행률 브로드캐스트 ──────────────────────
    // 클라이언트가 XHR progress 이벤트를 받아 소켓으로 전달
    socket.on("upload:progress", ({ fileId, progress, filename }: {
      fileId: string; progress: number; filename: string;
    }) => {
      // 본인의 다른 기기에게도 브로드캐스트
      socket.to(`user:${userId}`).emit("upload:progress:update", { fileId, progress, filename });
    });
    socket.on("upload:done", ({ fileId, filename }: { fileId: string; filename: string }) => {
      socket.to(`user:${userId}`).emit("upload:done:update", { fileId, filename });
      io.to(`user:${userId}`).emit("notification:new", {
        type: "UPLOAD_DONE",
        message: `"${filename}" 업로드 완료`,
        createdAt: new Date().toISOString(),
      });
    });

    // ── 연결 해제 ────────────────────────────────────────
    socket.on("disconnect", async () => {
      leaveUser(userId, socket.id);
      const stillOnline = isUserOnline(userId);
      if (!stillOnline) {
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeenAt: new Date() },
        }).catch(() => {});
        for (const { followerId } of followers) {
          emitToUser(followerId, "presence:update", { userId, isOnline: false });
        }
      }
      console.log(`❌ ${userId} disconnected (${socket.id})`);
    });
  });
}
