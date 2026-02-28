// src/lib/socket-server.ts
// Socket.IO 서버 이벤트 핸들러 전체
// ✅ 수정: call:start/accept/reject/end/ice-candidate 시그널링 핸들러 추가
// ✅ 수정: chat:join 룸 이름 "chat:" prefix 사용 (messages API와 일치)
// ✅ 수정: typing 이벤트 클라이언트와 일치
// server.js에서 initSocketServer(io) 형태로 호출

import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/db";
import { getToken } from "next-auth/jwt";

// ── 전역 소켓 인스턴스 (API route에서 emit용) ──────────────
let _io: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!_io) throw new Error("Socket.IO 서버가 초기화되지 않았습니다");
  return _io;
}

// ── userId → socketId(s) 매핑 ──────────────────────────────
const userSockets = new Map<string, Set<string>>();

function addUserSocket(userId: string, socketId: string) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socketId);
}

function removeUserSocket(userId: string, socketId: string) {
  userSockets.get(userId)?.delete(socketId);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  const sids = userSockets.get(userId);
  if (!sids || !_io) return;
  for (const sid of sids) {
    _io.to(sid).emit(event, data);
  }
}

// ── JWT 쿠키 인증 ──────────────────────────────────────────
async function authenticateSocket(socket: Socket): Promise<string | null> {
  try {
    // 1) handshake.auth.userId (클라이언트가 명시적으로 전달하는 경우)
    const authUserId = (socket.handshake.auth as any)?.userId;
    if (authUserId) return authUserId;

    // 2) JWT 쿠키 파싱
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const cookieObj: Record<string, string> = {};
    cookieHeader.split(";").forEach((c) => {
      const idx = c.indexOf("=");
      if (idx > 0) {
        const k = c.slice(0, idx).trim();
        const v = c.slice(idx + 1).trim();
        try { cookieObj[k] = decodeURIComponent(v); } catch { cookieObj[k] = v; }
      }
    });

    const token = await getToken({
      req: {
        headers: { cookie: cookieHeader },
        cookies: cookieObj,
      } as any,
      secret: process.env.NEXTAUTH_SECRET!,
    });

    return (token?.sub as string) ?? null;
  } catch (e) {
    console.error("Socket auth error:", e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// 메인 초기화 — server.js 에서 initSocketServer(io) 로 호출
// ══════════════════════════════════════════════════════════
export function initSocketServer(io: SocketIOServer) {
  _io = io;

  // ── 인증 미들웨어 ────────────────────────────────────────
  io.use(async (socket, next) => {
    const userId = await authenticateSocket(socket);
    if (!userId) {
      return next(new Error("인증 실패"));
    }
    (socket as any).userId = userId;
    next();
  });

  // ── 연결 핸들러 ──────────────────────────────────────────
  io.on("connection", async (socket) => {
    const userId: string = (socket as any).userId;
    addUserSocket(userId, socket.id);

    // 개인 룸 참가 (알림 수신용)
    socket.join(`user:${userId}`);

    // DB 온라인 상태 업데이트
    await prisma.user
      .update({ where: { id: userId }, data: { isOnline: true, lastSeenAt: new Date() } })
      .catch(() => {});

    // 팔로워에게 온라인 알림
    const followers = await prisma.follow
      .findMany({ where: { followingId: userId }, select: { followerId: true } })
      .catch(() => [] as { followerId: string }[]);

    for (const { followerId } of followers) {
      emitToUser(followerId, "presence:update", { userId, isOnline: true });
    }

    console.log(`🔌 connected  userId=${userId}  socketId=${socket.id}`);

    // ══════════════════════════════════════════════════════
    // 채팅방 입장/퇴장
    // ══════════════════════════════════════════════════════
    socket.on("chat:join", (chatRoomId: string) => {
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 chat:join  userId=${userId}  room=chat:${chatRoomId}`);
    });

    socket.on("chat:leave", (chatRoomId: string) => {
      socket.leave(`chat:${chatRoomId}`);
    });

    // ══════════════════════════════════════════════════════
    // 메시지 브로드캐스트 (클라이언트가 직접 emit하는 경우 대비)
    // ══════════════════════════════════════════════════════
    socket.on("message:send", (data: { chatRoomId: string; [key: string]: any }) => {
      if (data.chatRoomId) {
        socket.to(`chat:${data.chatRoomId}`).emit("message:receive", data);
      }
    });

    // ══════════════════════════════════════════════════════
    // 타이핑 인디케이터
    // emit: typing:start / typing:stop  { chatRoomId }
    // recv: typing:update  { userId, isTyping }
    // ══════════════════════════════════════════════════════
    socket.on("typing:start", ({ chatRoomId }: { chatRoomId: string }) => {
      socket.to(`chat:${chatRoomId}`).emit("typing:update", { userId, isTyping: true });
    });

    socket.on("typing:stop", ({ chatRoomId }: { chatRoomId: string }) => {
      socket.to(`chat:${chatRoomId}`).emit("typing:update", { userId, isTyping: false });
    });

    // 구버전 이벤트명 호환
    socket.on("chat:typing:start", ({ roomId }: { roomId: string }) => {
      socket.to(`chat:${roomId}`).emit("typing:update", { userId, isTyping: true });
    });
    socket.on("chat:typing:stop", ({ roomId }: { roomId: string }) => {
      socket.to(`chat:${roomId}`).emit("typing:update", { userId, isTyping: false });
    });

    // ══════════════════════════════════════════════════════
    // 업로드 진행률
    // ══════════════════════════════════════════════════════
    socket.on("upload:progress", ({ fileId, progress, filename }: { fileId: string; progress: number; filename: string }) => {
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

    // ══════════════════════════════════════════════════════
    // WebRTC 통화 시그널링
    // ══════════════════════════════════════════════════════

    // ── 1. 통화 요청 (발신자 → 서버 → 수신자) ──────────────
    socket.on(
      "call:start",
      async ({
        receiverId,
        chatRoomId,
        callType,
        offer,
      }: {
        receiverId: string;
        chatRoomId: string;
        callType: "VOICE" | "VIDEO";
        offer: RTCSessionDescriptionInit;
      }) => {
        console.log(`📞 call:start  from=${userId}  to=${receiverId}  type=${callType}`);

        // 수신자 오프라인 체크
        if (!isUserOnline(receiverId)) {
          socket.emit("call:user-offline", { receiverId });
          return;
        }

        // DB 통화 기록 생성
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

          // 수신자에게 전달
          emitToUser(receiverId, "call:incoming", {
            callId: call.id,
            callerId: userId,      // 누가 걸었는지
            chatRoomId,
            callType,
            offer,
          });
        } catch (e) {
          console.error("call:start DB error:", e);
          socket.emit("call:error", { message: "통화를 시작할 수 없습니다" });
        }
      }
    );

    // ── 2. 통화 수락 (수신자 → 서버 → 발신자) ──────────────
    socket.on(
      "call:accept",
      async ({
        callerId,
        answer,
      }: {
        callerId: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        console.log(`✅ call:accept  from=${userId}  to=${callerId}`);

        // DB 업데이트
        await prisma.call
          .updateMany({
            where: { initiatorId: callerId, receiverId: userId, status: "PENDING" },
            data: { status: "ACCEPTED", startedAt: new Date() },
          })
          .catch(() => {});

        // 발신자에게 answer 전달
        emitToUser(callerId, "call:accepted", { answer });
      }
    );

    // ── 3. 통화 거절 (수신자 → 서버 → 발신자) ──────────────
    socket.on("call:reject", async ({ callerId }: { callerId: string }) => {
      console.log(`❌ call:reject  from=${userId}  to=${callerId}`);

      await prisma.call
        .updateMany({
          where: { initiatorId: callerId, receiverId: userId, status: "PENDING" },
          data: { status: "REJECTED", endedAt: new Date() },
        })
        .catch(() => {});

      emitToUser(callerId, "call:rejected", {});
    });

    // ── 4. 통화 종료 (양방향) ──────────────────────────────
    socket.on("call:end", async ({ otherUserId }: { otherUserId: string }) => {
      console.log(`📴 call:end  from=${userId}  to=${otherUserId}`);

      const endedAt = new Date();

      // 진행 중인 통화 찾기
      const call = await prisma.call
        .findFirst({
          where: {
            status: { in: ["PENDING", "ACCEPTED", "ACTIVE"] },
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
          .update({ where: { id: call.id }, data: { status: "ENDED", endedAt, duration } })
          .catch(() => {});

        // 통화 로그 메시지
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const logContent =
          duration > 0
            ? `${call.type === "VIDEO" ? "📹 영상" : "📞 음성"} 통화 종료 (${minutes}분 ${seconds}초)`
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

        // 통화 로그 메시지를 채팅방에 브로드캐스트
        if (msg) {
          io.to(`chat:${call.chatRoomId}`).emit("message:receive", {
            ...msg,
            createdAt: msg.createdAt.toISOString(),
          });
        }
      }

      // 상대방에게 종료 알림
      emitToUser(otherUserId, "call:ended", {});
    });

    // ── 5. ICE Candidate 교환 (양방향 중계) ──────────────
    socket.on(
      "call:ice-candidate",
      ({ otherUserId, candidate }: { otherUserId: string; candidate: RTCIceCandidateInit }) => {
        emitToUser(otherUserId, "call:ice-candidate", { candidate });
      }
    );

    // ══════════════════════════════════════════════════════
    // 연결 해제
    // ══════════════════════════════════════════════════════
    socket.on("disconnect", async () => {
      removeUserSocket(userId, socket.id);
      const stillOnline = isUserOnline(userId);

      if (!stillOnline) {
        await prisma.user
          .update({ where: { id: userId }, data: { isOnline: false, lastSeenAt: new Date() } })
          .catch(() => {});

        for (const { followerId } of followers) {
          emitToUser(followerId, "presence:update", { userId, isOnline: false });
        }
      }

      console.log(`❌ disconnected  userId=${userId}  socketId=${socket.id}`);
    });
  });
}
