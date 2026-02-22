const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  // 전역 변수 등록
  global.io = io;

  // 온라인 사용자 관리
  const onlineUsers = new Map(); // userId -> socketId

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    socket.userId = userId;
    
    // 온라인 상태 등록
    onlineUsers.set(userId, socket.id);
    
    console.log(`✅ 소켓 연결됨: ${userId} (${socket.id})`);

    // ==================== 채팅 ====================
    socket.on("chat:join", (chatRoomId) => {
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 방 입장: chat:${chatRoomId}`);
    });

    socket.on("message:send", (data) => {
      const { chatRoomId, message } = data;
      io.to(`chat:${chatRoomId}`).emit("message:new", message);
      console.log(`📡 소켓 직접 전파: chat:${chatRoomId}`);
    });

    socket.on("typing:start", ({ chatRoomId }) => {
      socket.to(`chat:${chatRoomId}`).emit("typing:user", { userId: socket.userId });
    });

    socket.on("typing:stop", ({ chatRoomId }) => {
      socket.to(`chat:${chatRoomId}`).emit("typing:stop", { userId: socket.userId });
    });

    // ==================== WebRTC 통화 시그널링 ====================

    // 통화 요청 (Offer)
    socket.on("call:request", (data) => {
      const { receiverId, chatRoomId, callType, offer } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:incoming", {
          callerId: socket.userId,
          chatRoomId,
          callType,
          offer,
        });
        console.log(`📞 통화 요청: ${socket.userId} → ${receiverId} (${callType})`);
      } else {
        socket.emit("call:failed", { reason: "User offline" });
        console.log(`❌ 통화 실패: ${receiverId} 오프라인`);
      }
    });

    // 통화 수락 (Answer)
    socket.on("call:accept", (data) => {
      const { callerId, answer } = data;
      const callerSocketId = onlineUsers.get(callerId);
      
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:accepted", {
          receiverId: socket.userId,
          answer,
        });
        console.log(`✅ 통화 수락: ${socket.userId} → ${callerId}`);
      }
    });

    // 통화 거절
    socket.on("call:reject", (data) => {
      const { callerId } = data;
      const callerSocketId = onlineUsers.get(callerId);
      
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:rejected", {
          receiverId: socket.userId,
        });
        console.log(`❌ 통화 거절: ${socket.userId}`);
      }
    });

    // 통화 종료
    socket.on("call:end", (data) => {
      const { otherUserId } = data;
      const otherSocketId = onlineUsers.get(otherUserId);
      
      if (otherSocketId) {
        io.to(otherSocketId).emit("call:ended", {
          userId: socket.userId,
        });
      }
      console.log(`📴 통화 종료: ${socket.userId}`);
    });

    // ICE Candidate 교환
    socket.on("call:ice-candidate", (data) => {
      const { otherUserId, candidate } = data;
      const otherSocketId = onlineUsers.get(otherUserId);
      
      if (otherSocketId) {
        io.to(otherSocketId).emit("call:ice-candidate", {
          userId: socket.userId,
          candidate,
        });
      }
    });

    // ==================== 연결 해제 ====================
    socket.on("disconnect", () => {
      console.log(`❌ 연결 끊김: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
    });
  });

  httpServer.listen(port, () => {
    console.log(`🚀 서버 시작: http://localhost:${port}`);
  });
});
