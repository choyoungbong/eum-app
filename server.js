// Custom Next.js Server with Socket.IO
// 위치: apps/web/server.js

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";  // ← localhost → 0.0.0.0 으로 변경!
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 온라인 사용자 관리
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Socket.IO 설정
  const io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "http://localhost:3000",
        /\.up\.railway\.app$/,
        /\.mooo\.com$/,
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Socket.IO 미들웨어 - 인증
  io.use((socket, next) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      return next(new Error("Authentication error"));
    }
    socket.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId} (${socket.id})`);

    // 사용자 온라인 상태 등록
    onlineUsers.set(socket.userId, socket.id);
    userSockets.set(socket.id, socket.userId);

    // 온라인 상태 브로드캐스트
    io.emit("user:online", { userId: socket.userId });

    // ==================== 채팅방 입장 ====================
    socket.on("chat:join", (chatRoomId) => {
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 User ${socket.userId} joined chat ${chatRoomId}`);
    });

    // ==================== 채팅방 퇴장 ====================
    socket.on("chat:leave", (chatRoomId) => {
      socket.leave(`chat:${chatRoomId}`);
      console.log(`📤 User ${socket.userId} left chat ${chatRoomId}`);
    });

    // ==================== 메시지 전송 ====================
    socket.on("message:send", (data) => {
      const { chatRoomId, message } = data;
      
      // 같은 채팅방에 있는 모든 사용자에게 전송
      io.to(`chat:${chatRoomId}`).emit("message:new", message);
      
      console.log(`💬 Message sent to chat ${chatRoomId}`);
    });

    // ==================== 타이핑 중 ====================
    socket.on("typing:start", (data) => {
      const { chatRoomId } = data;
      socket.to(`chat:${chatRoomId}`).emit("typing:user", {
        userId: socket.userId,
        chatRoomId,
      });
    });

    socket.on("typing:stop", (data) => {
      const { chatRoomId } = data;
      socket.to(`chat:${chatRoomId}`).emit("typing:stop", {
        userId: socket.userId,
        chatRoomId,
      });
    });

    // ==================== 읽음 표시 ====================
    socket.on("message:read", (data) => {
      const { chatRoomId, messageId } = data;
      socket.to(`chat:${chatRoomId}`).emit("message:read", {
        userId: socket.userId,
        chatRoomId,
        messageId,
      });
    });

    // ==================== 통화 시그널링 ====================
    
    // 통화 요청
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
        console.log(`📞 Call request from ${socket.userId} to ${receiverId}`);
      } else {
        socket.emit("call:failed", { reason: "User offline" });
      }
    });

    // 통화 수락
    socket.on("call:accept", (data) => {
      const { callerId, answer } = data;
      const callerSocketId = onlineUsers.get(callerId);
      
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:accepted", {
          receiverId: socket.userId,
          answer,
        });
        console.log(`✅ Call accepted by ${socket.userId}`);
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
        console.log(`❌ Call rejected by ${socket.userId}`);
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
      console.log(`📴 Call ended by ${socket.userId}`);
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
      console.log(`❌ User disconnected: ${socket.userId} (${socket.id})`);
      
      // 온라인 상태 제거
      onlineUsers.delete(socket.userId);
      userSockets.delete(socket.id);
      
      // 오프라인 상태 브로드캐스트
      io.emit("user:offline", { userId: socket.userId });
    });
  });

  // 서버 시작
  httpServer.listen(port, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🚀 Server ready!                     ║
║   📡 Socket.IO enabled                 ║
║   🌐 http://${hostname}:${port}             ║
╚════════════════════════════════════════╝
    `);
  });
});
