const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      // ✅ 와일드카드(*) 대신 실제 도메인으로 제한
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ✅ API route에서 사용할 수 있도록 전역 등록
  global.io = io;

  // userId → socketId 매핑
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      console.warn("⚠️ userId 없는 소켓 연결 거부");
      socket.disconnect();
      return;
    }

    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    console.log(`✅ 소켓 연결: ${userId} (${socket.id}) | 온라인: ${onlineUsers.size}명`);

    // ─────────────────────────────────────
    // 채팅
    // ─────────────────────────────────────

    socket.on("chat:join", (chatRoomId) => {
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 방 입장: chat:${chatRoomId} (${userId})`);
    });

    socket.on("chat:leave", (chatRoomId) => {
      socket.leave(`chat:${chatRoomId}`);
    });

    // 클라이언트가 직접 emit할 때 — API route의 global.io와 동일한 이벤트명 사용
    socket.on("message:send", (data) => {
      // ✅ "message:receive"로 통일 (이전: message:receive 와 message:new 혼용)
      socket.to(`chat:${data.chatRoomId}`).emit("message:receive", data);
    });

    socket.on("typing:start", (data) => {
      socket.to(`chat:${data.chatRoomId}`).emit("typing:update", {
        userId: data.userId || userId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (data) => {
      socket.to(`chat:${data.chatRoomId}`).emit("typing:update", {
        userId: data.userId || userId,
        isTyping: false,
      });
    });

    // ─────────────────────────────────────
    // WebRTC 시그널링
    // ─────────────────────────────────────

    // 1) 발신자 → 수신자: 통화 요청 + Offer
    socket.on("call:start", (data) => {
      const { receiverId, offer, callType, chatRoomId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);

      console.log(`📞 call:start | ${userId} → ${receiverId} (${callType})`);

      if (!receiverSocketId) {
        // ✅ 수신자가 오프라인이면 발신자에게 알림
        socket.emit("call:user-offline", {
          message: "상대방이 오프라인 상태입니다.",
        });
        return;
      }

      io.to(receiverSocketId).emit("call:incoming", {
        callerId: userId,
        offer,
        // ✅ callType 전달 — 수신자가 VIDEO인지 VOICE인지 알 수 있음
        callType: callType || "VOICE",
        chatRoomId,
      });
    });

    // 2) 수신자 → 발신자: 통화 수락 + Answer
    socket.on("call:accept", (data) => {
      const { callerId, answer } = data;
      const callerSocketId = onlineUsers.get(callerId);

      console.log(`✅ call:accept | ${userId} → ${callerId}`);

      if (callerSocketId) {
        io.to(callerSocketId).emit("call:accepted", { answer });
      }
    });

    // 3) 수신자 → 발신자: 통화 거절
    socket.on("call:reject", (data) => {
      const callerSocketId = onlineUsers.get(data.callerId);

      console.log(`❌ call:reject | ${userId} → ${data.callerId}`);

      if (callerSocketId) {
        io.to(callerSocketId).emit("call:rejected");
      }
    });

    // 4) 통화 종료
    socket.on("call:end", (data) => {
      const otherSocketId = onlineUsers.get(data.otherUserId);

      console.log(`📵 call:end | ${userId} → ${data.otherUserId}`);

      if (otherSocketId) {
        io.to(otherSocketId).emit("call:ended");
      }
    });

    // 5) ICE Candidate 중계
    socket.on("call:ice-candidate", (data) => {
      const { otherUserId, candidate } = data;
      const otherSocketId = onlineUsers.get(otherUserId);

      if (otherSocketId && candidate) {
        io.to(otherSocketId).emit("call:ice-candidate", { candidate });
      }
    });

    // ─────────────────────────────────────
    // 연결 해제
    // ─────────────────────────────────────

    socket.on("disconnect", (reason) => {
      onlineUsers.delete(userId);
      console.log(`❌ 소켓 해제: ${userId} | 이유: ${reason} | 온라인: ${onlineUsers.size}명`);

      // ✅ 통화 중이었다면 상대방에게 통화 종료 알림
      // (현재는 단순 broadcast — 추후 통화 상태 Map으로 정교화 가능)
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`🚀 서버 시작: http://${hostname}:${port}`);
  });
});
