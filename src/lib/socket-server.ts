// src/lib/socket-server.ts
// Socket.IO 서버 이벤트 핸들러 전체
// ✅ 수정: call:start/accept/reject/end/ice-candidate 시그널링 핸들러 추가
// ✅ 수정: typing 이벤트명 클라이언트와 일치하도록 수정

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

    // 팔로워에게 온라인 알림
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    }).catch(() => []);
    for (const { followerId } of followers) {
      emitToUser(followerId, "presence:update", { userId, isOnline: true });
    }

    console.log(`🔌 ${userId} connected (${socket.id})`);

    // ── 채팅방 참가/나가기 ────────────────────────────────
    socket.on("chat:join", (roomId: string) => {
      socket.join(`chat:${roomId}`);
    });
    socket.on("chat:leave", (roomId: string) => {
      socket.leave(`chat:${roomId}`);
    });

    // ── 타이핑 인디케이터 ─────────────────────────────────
    // ✅ 클라이언트가 "typing:start" / "typing:stop" 이벤트로 emit
    socket.on("typing:start", ({ chatRoomId }: { chatRoomId: string }) => {
      socket.to(`chat:${chatRoomId}`).emit("typing:update", {
        userId,
        chatRoomId,
        isTyping: true,
      });
    });
    socket.on("typing:stop", ({ chatRoomId }: { chatRoomId: string }) => {
      socket.to(`chat:${chatRoomId}`).emit("typing:update", {
        userId,
        chatRoomId,
        isTyping: false,
      });
    });

    // ── 업로드 진행률 브로드캐스트 ───────────────────────
    socket.on("upload:progress", ({ fileId, progress, filename }: {
      fileId: string; progress: number; filename: string;
    }) => {
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

    // ════════════════════════════════════════════════════════
    // ── WebRTC 통화 시그널링 ──────────────────────────────
    // ✅ 핵심 추가: 이 핸들러들이 없어서 통화가 안 됐음
    // ════════════════════════════════════════════════════════

    // 1. 통화 걸기 (발신자 → 서버 → 수신자)
    socket.on("call:start", async ({
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
      console.log(`📞 통화 요청: ${userId} → ${receiverId} (${callType})`);

      // 수신자가 온라인인지 확인
      if (!isUserOnline(receiverId)) {
        socket.emit("call:user-offline", { receiverId });
        return;
      }

      // DB에 통화 기록 생성
      try {
        const call = await prisma.call.create({
          data: {
            chatRoomId,
            //callerId: userId,
            initiatorId: userId,
            receiverId,
            type: callType,
            status: "PENDING",
          },
        });

        // 수신자에게 전달
        emitToUser(receiverId, "call:incoming", {
          callId: call.id,
          callerId: userId,
          chatRoomId,
          callType,
          offer,
        });
      } catch (e) {
        console.error("통화 생성 오류:", e);
        socket.emit("call:error", { message: "통화를 시작할 수 없습니다" });
      }
    });

    // 2. 통화 수락 (수신자 → 서버 → 발신자)
    socket.on("call:accept", async ({
      callerId,
      answer,
    }: {
      callerId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log(`✅ 통화 수락: ${userId} → ${callerId}`);

      // DB 상태 업데이트
      await prisma.call.updateMany({
        where: {
          initiatorId: callerId,
          receiverId: userId,
          status: "PENDING",
        },
        data: {
          status: "ACCEPTED",
          startedAt: new Date(),
        },
      }).catch(() => {});

      // 발신자에게 answer 전달
      emitToUser(callerId, "call:accepted", { answer });
    });

    // 3. 통화 거절 (수신자 → 서버 → 발신자)
    socket.on("call:reject", async ({ callerId }: { callerId: string }) => {
      console.log(`❌ 통화 거절: ${userId} → ${callerId}`);

      await prisma.call.updateMany({
        where: {
          initiatorId: callerId,
          receiverId: userId,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          endedAt: new Date(),
        },
      }).catch(() => {});

      emitToUser(callerId, "call:rejected", {});
    });

    // 4. 통화 종료 (양방향)
    socket.on("call:end", async ({ otherUserId }: { otherUserId: string }) => {
      console.log(`📴 통화 종료: ${userId} → ${otherUserId}`);

      const endedAt = new Date();

      // 진행 중인 통화 종료 처리
      const call = await prisma.call.findFirst({
        where: {
          status: { in: ["PENDING", "ACCEPTED", "ACTIVE"] },
          OR: [
            { initiatorId: userId, receiverId: otherUserId },
            { initiatorId: otherUserId, receiverId: userId },
          ],
        },
      }).catch(() => null);

      if (call) {
        const duration = call.startedAt
          ? Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)
          : 0;

        await prisma.call.update({
          where: { id: call.id },
          data: { status: "ENDED", endedAt, duration },
        }).catch(() => {});

        // 통화 로그 메시지 생성
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const logMsg = duration > 0
          ? `통화가 종료되었습니다. (${minutes}분 ${seconds}초)`
          : "통화가 종료되었습니다.";

        await prisma.chatMessage.create({
          data: {
            chatRoomId: call.chatRoomId,
            senderId: userId,
            type: "CALL_LOG",
            callId: call.id,
            content: logMsg,
          },
        }).catch(() => {});
      }

      // 상대방에게 종료 알림
      emitToUser(otherUserId, "call:ended", {});
    });

    // 5. ICE Candidate 교환 (양방향)
    socket.on("call:ice-candidate", ({
      otherUserId,
      candidate,
    }: {
      otherUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      // 상대방에게 ICE candidate 전달
      emitToUser(otherUserId, "call:ice-candidate", { candidate });
    });

    // ════════════════════════════════════════════════════════

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
