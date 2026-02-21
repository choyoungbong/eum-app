// Custom Next.js Server with Socket.IO
// 위치: apps/web/server.js

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
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

  // 🌟 [핵심 수정] API Route(route.ts)에서 소켓을 사용할 수 있도록 전역 객체에 등록
  global.io = io;
  console.log("✅ Socket.IO registered to global.io");

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
      // 🌟 클라이언트 useSocket.ts와 동일하게 'chat:ID' 형식으로 join
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 User ${socket.userId} joined room: chat:${chatRoomId}`);
    });

    // ==================== 채팅방 퇴장 ====================
    socket.on("chat:leave", (chatRoomId) => {
      socket.leave(`chat:${chatRoomId}`);
      console.log(`📤 User ${socket.userId} left room: chat:${chatRoomId}`);
    });

    // ==================== 메시지 전송 (소켓 직접 전송 시) ====================
    socket.on("message:send", (data) => {
      const { chatRoomId, message } = data;
      // API를 통하지 않고 소켓으로 직접 보낼 때 사용하는 로직
      io.to(`chat:${chatRoomId}`).emit("message:new", message);
      console.log(`💬 Message broadcasted to chat:${chatRoomId}`);
    });

    // ==================== 타이핑/읽음/통화 로직 (기존 유지) ====================
    socket.on("typing:start", (data) => {
      const { chatRoomId } = data;
      socket.to(`chat:${chatRoomId}`).emit("typing:user", { userId: socket.userId, chatRoomId });
    });

    socket.on("typing:stop", (data) => {
      const { chatRoomId } = data;
      socket.to(`chat:${chatRoomId}`).emit("typing:stop", { userId: socket.userId, chatRoomId });
    });

    socket.on("message:read", (data) => {
      const { chatRoomId, messageId } = data;
      socket.to(`chat:${chatRoomId}`).emit("message:read", { userId: socket.userId, chatRoomId, messageId });
    });

    socket.on("call:request", (data) => {
      const { receiverId, chatRoomId, callType, offer } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:incoming", { callerId: socket.userId, chatRoomId, callType, offer });
      } else {
        socket.emit("call:failed", { reason: "User offline" });
      }
    });

    socket.on("call:accept", (data) => {
      const { callerId, answer } = data;
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:accepted", { receiverId: socket.userId, answer });
      }
    });

    socket.on("call:reject", (data) => {
      const { callerId } = data;
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:rejected", { receiverId: socket.userId });
      }
    });

    socket.on("call:end", (data) => {
      const { otherUserId } = data;
      const otherSocketId = onlineUsers.get(otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("call:ended", { userId: socket.userId });
      }
    });

    socket.on("call:ice-candidate", (data) => {
      const { otherUserId, candidate } = data;
      const otherSocketId = onlineUsers.get(otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("call:ice-candidate", { userId: socket.userId, candidate });
      }
    });

    // ==================== 연결 해제 ====================
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId} (${socket.id})`);
      onlineUsers.delete(socket.userId);
      userSockets.delete(socket.id);
      io.emit("user:offline", { userId: socket.userId });
    });
  });

  // 서버 시작
  httpServer.listen(port, () => {
    console.log(`
╔════════════════════════════════════════╗
║    🚀 Server ready!                    ║
║    📡 Socket.IO enabled                ║
║    🌐 http://${hostname}:${port}             ║
╚════════════════════════════════════════╝
    `);
  });
});