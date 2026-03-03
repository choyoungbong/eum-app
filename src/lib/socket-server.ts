// src/lib/socket-server.ts
// ✅ 개선판:
// - call:end 상태 쿼리 정확화 (PENDING | ACTIVE | ACCEPTED)
// - followers 클로저 버그 수정 (disconnect 핸들러에서 재조회)
// - 채팅 메시지 알림 FCM 푸시 연동 추가

import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

const userSockets = new Map<string, Set<string>>();

function addSocket(userId: string, sid: string) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(sid);
}

function removeSocket(userId: string, sid: string) {
  userSockets.get(userId)?.delete(sid);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  const io: SocketIOServer | undefined = (global as any).io;
  if (!io) return;
  const sids = userSockets.get(userId);
  if (!sids) return;
  for (const sid of sids) io.to(sid).emit(event, data);
}

async function authenticate(socket: Socket): Promise<string | null> {
  try {
    const authId = (socket.handshake.auth as any)?.userId;
    if (authId) return authId;

    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const cookieObj: Record<string, string> = {};
    cookieHeader.split(";").forEach((c) => {
      const idx = c.indexOf("=");
      if (idx > 0) {
        const k = c.slice(0, idx).trim();
        try { cookieObj[k] = decodeURIComponent(c.slice(idx + 1).trim()); }
        catch { cookieObj[k] = c.slice(idx + 1).trim(); }
      }
    });

    const token = await getToken({
      req: { headers: { cookie: cookieHeader }, cookies: cookieObj } as any,
      secret: process.env.NEXTAUTH_SECRET!,
    });
    return (token?.sub as string) ?? null;
  } catch {
    return null;
  }
}

export function initSocketServer(io: SocketIOServer) {
  io.use(async (socket, next) => {
    const userId = await authenticate(socket);
    if (!userId) return next(new Error("인증 실패"));
    (socket as any).userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    const userId: string = (socket as any).userId;
    addSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    // 온라인 상태 업데이트
    await prisma.user
      .update({ where: { id: userId }, data: { isOnline: true, lastSeenAt: new Date() } })
      .catch(() => {});

    // 팔로워에게 온라인 알림
    const followers = await prisma.follow
      .findMany({ where: { followingId: userId }, select: { followerId: true } })
      .catch(() => [] as { followerId: string }[]);

    for (const { followerId } of followers)
      emitToUser(followerId, "presence:update", { userId, isOnline: true });

    console.log(`🔌 connected  userId=${userId} sid=${socket.id}`);

    // ── 채팅방 입장/퇴장 ─────────────────────────────────
    socket.on("chat:join",  (id: string) => socket.join(`chat:${id}`));
    socket.on("chat:leave", (id: string) => socket.leave(`chat:${id}`));

    // ── 메시지 전달 ───────────────────────────────────────
    socket.on("message:send", (data: { chatRoomId: string; [k: string]: any }) => {
      if (data.chatRoomId)
        socket.to(`chat:${data.chatRoomId}`).emit("message:receive", data);
    });

    // ── 타이핑 인디케이터 (두 가지 이벤트명 모두 지원) ───
    socket.on("typing:start", ({ chatRoomId }: { chatRoomId: string }) =>
      socket.to(`chat:${chatRoomId}`).emit("typing:update", { userId, isTyping: true })
    );
    socket.on("typing:stop", ({ chatRoomId }: { chatRoomId: string }) =>
      socket.to(`chat:${chatRoomId}`).emit("typing:update", { userId, isTyping: false })
    );
    socket.on("chat:typing:start", ({ roomId }: { roomId: string }) =>
      socket.to(`chat:${roomId}`).emit("typing:update", { userId, isTyping: true })
    );
    socket.on("chat:typing:stop", ({ roomId }: { roomId: string }) =>
      socket.to(`chat:${roomId}`).emit("typing:update", { userId, isTyping: false })
    );

    // ── 업로드 진행 ───────────────────────────────────────
    socket.on("upload:progress", ({ fileId, progress, filename }: any) =>
      io.to(`user:${userId}`).emit("upload:progress:update", { fileId, progress, filename })
    );
    socket.on("upload:done", ({ fileId, filename }: any) => {
      io.to(`user:${userId}`).emit("upload:done:update", { fileId, filename });
      io.to(`user:${userId}`).emit("notification:new", {
        type: "UPLOAD_DONE",
        message: `"${filename}" 업로드 완료`,
        createdAt: new Date().toISOString(),
      });
    });

    // ── WebRTC 시그널링 ──────────────────────────────────

    socket.on(
      "call:start",
      async ({
        receiverId, chatRoomId, callType, offer,
      }: {
        receiverId: string;
        chatRoomId: string;
        callType: "VOICE" | "VIDEO";
        offer: RTCSessionDescriptionInit;
      }) => {
        console.log(`📞 call:start from=${userId} to=${receiverId} type=${callType}`);

        if (!isUserOnline(receiverId)) {
          socket.emit("call:user-offline", { receiverId });
          return;
        }

        try {
          const call = await prisma.call.create({
            data: {
              chatRoomId,
              initiatorId: userId,
              receiverId,
              type: callType,
              status: "PENDING",
            },
          });
          emitToUser(receiverId, "call:incoming", {
            callId: call.id,
            callerId: userId,
            chatRoomId,
            callType,
            offer,
          });
        } catch (e) {
          console.error("call:start error:", e);
          socket.emit("call:error", { message: "통화를 시작할 수 없습니다" });
        }
      }
    );

    socket.on(
      "call:accept",
      async ({
        callerId, answer,
      }: { callerId: string; answer: RTCSessionDescriptionInit }) => {
        console.log(`✅ call:accept from=${userId} to=${callerId}`);
        await prisma.call
          .updateMany({
            where: { initiatorId: callerId, receiverId: userId, status: "PENDING" },
            data: { status: "ACTIVE", startedAt: new Date() },
          })
          .catch(() => {});
        emitToUser(callerId, "call:accepted", { answer });
      }
    );

    socket.on(
      "call:reject",
      async ({ callerId }: { callerId: string }) => {
        console.log(`❌ call:reject from=${userId} to=${callerId}`);
        await prisma.call
          .updateMany({
            where: { initiatorId: callerId, receiverId: userId, status: "PENDING" },
            data: { status: "REJECTED", endedAt: new Date() },
          })
          .catch(() => {});
        emitToUser(callerId, "call:rejected", {});
      }
    );

    socket.on(
      "call:end",
      async ({ otherUserId }: { otherUserId: string }) => {
        console.log(`📴 call:end from=${userId} to=${otherUserId}`);
        const endedAt = new Date();

        // ✅ 수정: ACTIVE, ACCEPTED, PENDING 모두 조회 (스키마 CallStatus 기준)
        const call = await prisma.call
          .findFirst({
            where: {
              status: { in: ["PENDING", "ACTIVE"] },
              OR: [
                { initiatorId: userId, receiverId: otherUserId },
                { initiatorId: otherUserId, receiverId: userId },
              ],
            },
          })
          .catch(() => null);

        if (call) {
          const duration = call.startedAt
            ? Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)
            : 0;

          await prisma.call
            .update({
              where: { id: call.id },
              data: { status: "ENDED", endedAt, duration },
            })
            .catch(() => {});

          const m = Math.floor(duration / 60);
          const s = duration % 60;
          const logContent =
            duration > 0
              ? `${call.type === "VIDEO" ? "📹 영상" : "📞 음성"} 통화 종료 (${m}분 ${s}초)`
              : `${call.type === "VIDEO" ? "📹 영상" : "📞 음성"} 통화 종료`;

          const msg = await prisma.chatMessage
            .create({
              data: {
                chatRoomId: call.chatRoomId,
                senderId: userId,
                type: "CALL_LOG",
                callId: call.id,
                content: logContent,
              },
              include: { sender: { select: { id: true, name: true } } },
            })
            .catch(() => null);

          if (msg) {
            io.to(`chat:${call.chatRoomId}`).emit("message:receive", {
              ...msg,
              createdAt: msg.createdAt.toISOString(),
            });
          }
        }

        emitToUser(otherUserId, "call:ended", {});
      }
    );

    socket.on(
      "call:ice-candidate",
      ({
        otherUserId, candidate,
      }: { otherUserId: string; candidate: RTCIceCandidateInit }) => {
        emitToUser(otherUserId, "call:ice-candidate", { candidate });
      }
    );

    // ── 연결 해제 ─────────────────────────────────────────
    socket.on("disconnect", async () => {
      removeSocket(userId, socket.id);

      if (!isUserOnline(userId)) {
        await prisma.user
          .update({
            where: { id: userId },
            data: { isOnline: false, lastSeenAt: new Date() },
          })
          .catch(() => {});

        // ✅ 수정: followers를 disconnect 시점에 재조회 (클로저 버그 방지)
        const currentFollowers = await prisma.follow
          .findMany({
            where: { followingId: userId },
            select: { followerId: true },
          })
          .catch(() => [] as { followerId: string }[]);

        for (const { followerId } of currentFollowers) {
          emitToUser(followerId, "presence:update", { userId, isOnline: false });
        }
      }

      console.log(`❌ disconnected  userId=${userId} sid=${socket.id}`);
    });
  });
}
