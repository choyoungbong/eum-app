// server.js — 순수 JavaScript (tsx/TypeScript 불필요)
// socket-server.ts 로직을 이 파일에 직접 인라인
// @/ alias 문제 완전 해소

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const { getToken } = require("next-auth/jwt");

// ── 설정 ─────────────────────────────────────────────────
const dev      = process.env.NODE_ENV !== "production";
const port     = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

// ── Prisma 싱글톤 ─────────────────────────────────────────
const prisma = globalThis._prisma ?? new PrismaClient({
  log: dev ? ["error", "warn"] : ["error"],
});
if (!globalThis._prisma) globalThis._prisma = prisma;

// ── 소켓 사용자 맵 ────────────────────────────────────────
const userSockets = new Map(); // userId → Set<socketId>

function addSocket(userId, sid) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(sid);
}
function removeSocket(userId, sid) {
  userSockets.get(userId)?.delete(sid);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}
function isUserOnline(userId) {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}
function emitToUser(io, userId, event, data) {
  const sids = userSockets.get(userId);
  if (!sids) return;
  for (const sid of sids) io.to(sid).emit(event, data);
}

// ── 소켓 인증 ─────────────────────────────────────────────
async function authenticate(socket) {
  try {
    const authId = socket.handshake.auth?.userId;
    if (authId) return authId;

    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const cookieObj = {};
    cookieHeader.split(";").forEach((c) => {
      const idx = c.indexOf("=");
      if (idx > 0) {
        const k = c.slice(0, idx).trim();
        try { cookieObj[k] = decodeURIComponent(c.slice(idx + 1).trim()); }
        catch { cookieObj[k] = c.slice(idx + 1).trim(); }
      }
    });

    const token = await getToken({
      req: { headers: { cookie: cookieHeader }, cookies: cookieObj },
      secret: process.env.NEXTAUTH_SECRET,
    });
    return token?.sub ?? null;
  } catch {
    return null;
  }
}

// ── Socket.IO 이벤트 등록 ─────────────────────────────────
function initSocketServer(io) {
  // 인증 미들웨어
  io.use(async (socket, next) => {
    const userId = await authenticate(socket);
    if (!userId) return next(new Error("인증 실패"));
    socket.userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    addSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    // 온라인 상태 업데이트
    await prisma.user
      .update({ where: { id: userId }, data: { isOnline: true, lastSeenAt: new Date() } })
      .catch(() => {});

    // 팔로워에게 온라인 알림
    const followers = await prisma.follow
      .findMany({ where: { followingId: userId }, select: { followerId: true } })
      .catch(() => []);
    for (const { followerId } of followers)
      emitToUser(io, followerId, "presence:update", { userId, isOnline: true });

    console.log(`🔌 connected  userId=${userId} sid=${socket.id}`);

    // 채팅방 입장/퇴장
    socket.on("chat:join",  (id) => socket.join(`chat:${id}`));
    socket.on("chat:leave", (id) => socket.leave(`chat:${id}`));

    // 메시지 전달
    socket.on("message:send", (data) => {
      if (data.chatRoomId)
        socket.to(`chat:${data.chatRoomId}`).emit("message:receive", data);
    });

    // 타이핑 인디케이터
    socket.on("typing:start", ({ chatRoomId }) =>
      socket.to(`chat:${chatRoomId}`).emit("typing:update", { userId, isTyping: true })
    );
    socket.on("typing:stop", ({ chatRoomId }) =>
      socket.to(`chat:${chatRoomId}`).emit("typing:update", { userId, isTyping: false })
    );
    socket.on("chat:typing:start", ({ roomId }) =>
      socket.to(`chat:${roomId}`).emit("typing:update", { userId, isTyping: true })
    );
    socket.on("chat:typing:stop", ({ roomId }) =>
      socket.to(`chat:${roomId}`).emit("typing:update", { userId, isTyping: false })
    );

    // 업로드 진행
    socket.on("upload:progress", ({ fileId, progress, filename }) =>
      io.to(`user:${userId}`).emit("upload:progress:update", { fileId, progress, filename })
    );
    socket.on("upload:done", ({ fileId, filename }) => {
      io.to(`user:${userId}`).emit("upload:done:update", { fileId, filename });
      io.to(`user:${userId}`).emit("notification:new", {
        type: "UPLOAD_DONE",
        message: `"${filename}" 업로드 완료`,
        createdAt: new Date().toISOString(),
      });
    });

    // ── WebRTC 시그널링 ──────────────────────────────────

    socket.on("call:start", async ({ receiverId, chatRoomId, callType, offer }) => {
      console.log(`📞 call:start from=${userId} to=${receiverId} type=${callType}`);
      if (!isUserOnline(receiverId)) {
        socket.emit("call:user-offline", { receiverId });
        return;
      }
      try {
        const call = await prisma.call.create({
          data: { chatRoomId, initiatorId: userId, receiverId, type: callType, status: "PENDING" },
        });
        emitToUser(io, receiverId, "call:incoming", {
          callId: call.id, callerId: userId, chatRoomId, callType, offer,
        });
      } catch (e) {
        console.error("call:start error:", e);
        socket.emit("call:error", { message: "통화를 시작할 수 없습니다" });
      }
    });

    socket.on("call:accept", async ({ callerId, answer }) => {
      console.log(`✅ call:accept from=${userId} to=${callerId}`);
      await prisma.call
        .updateMany({
          where: { initiatorId: callerId, receiverId: userId, status: "PENDING" },
          data: { status: "ACCEPTED", startedAt: new Date() },
        })
        .catch(() => {});
      emitToUser(io, callerId, "call:accepted", { answer });
    });

    socket.on("call:reject", async ({ callerId }) => {
      console.log(`❌ call:reject from=${userId} to=${callerId}`);
      await prisma.call
        .updateMany({
          where: { initiatorId: callerId, receiverId: userId, status: "PENDING" },
          data: { status: "REJECTED", endedAt: new Date() },
        })
        .catch(() => {});
      emitToUser(io, callerId, "call:rejected", {});
    });

    socket.on("call:end", async ({ otherUserId }) => {
      console.log(`📴 call:end from=${userId} to=${otherUserId}`);
      const endedAt = new Date();
      const call = await prisma.call
        .findFirst({
          where: {
            status: { in: ["PENDING", "ACTIVE", "ACCEPTED"] },
            OR: [
              { initiatorId: userId,      receiverId: otherUserId },
              { initiatorId: otherUserId, receiverId: userId },
            ],
          },
        })
        .catch(() => null);

      if (call) {
        const duration = call.startedAt
          ? Math.floor((endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000)
          : 0;
        await prisma.call
          .update({ where: { id: call.id }, data: { status: "ENDED", endedAt, duration } })
          .catch(() => {});

        const m = Math.floor(duration / 60);
        const s = duration % 60;
        const logContent = duration > 0
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
      emitToUser(io, otherUserId, "call:ended", {});
    });

    socket.on("call:ice-candidate", ({ otherUserId, candidate }) => {
      emitToUser(io, otherUserId, "call:ice-candidate", { candidate });
    });

    // 연결 해제
    socket.on("disconnect", async () => {
      removeSocket(userId, socket.id);
      if (!isUserOnline(userId)) {
        await prisma.user
          .update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } })
          .catch(() => {});

        const currentFollowers = await prisma.follow
          .findMany({ where: { followingId: userId }, select: { followerId: true } })
          .catch(() => []);
        for (const { followerId } of currentFollowers)
          emitToUser(io, followerId, "presence:update", { userId, isOnline: false });
      }
      console.log(`❌ disconnected  userId=${userId} sid=${socket.id}`);
    });
  });
}

// ── Next.js 앱 시작 ───────────────────────────────────────
const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e7,
    cors: {
      origin: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  initSocketServer(io);

  // App Router API Route에서 emitToUser 사용 가능하도록 전역 저장
  global.io = io;

  httpServer.listen(port, hostname, () => {
    console.log(`✅ 서버 시작: http://${hostname}:${port}`);
    console.log(`   NODE_ENV : ${process.env.NODE_ENV}`);
    console.log(`   Socket.IO: /api/socket/io`);
  });
});
