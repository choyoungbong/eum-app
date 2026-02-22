const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
// ✅ Railway 배포 환경에서는 '0.0.0.0' 바인딩이 안전함
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
      origin: "*",
      methods: ["GET", "POST"]
    },
    // ✅ 모바일은 Websocket 연결이 자주 끊기므로 polling 병행 및 타임아웃 완화
    transports: ["websocket", "polling"],
    pingTimeout: 60000, 
    pingInterval: 25000,
  });

  global.io = io;
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) return;

    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    console.log(`✅ 소켓 연결됨: ${userId} (${socket.id})`);

    // 채팅 로직
    socket.on("chat:join", (chatRoomId) => {
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 방 입장: chat:${chatRoomId}`);
    });

    socket.on("message:send", (data) => {
      io.to(`chat:${data.chatRoomId}`).emit("message:receive", data);
    });

    socket.on("typing:start", (data) => {
      socket.to(`chat:${data.chatRoomId}`).emit("typing:update", { userId: data.userId, isTyping: true });
    });

    socket.on("typing:stop", (data) => {
      socket.to(`chat:${data.chatRoomId}`).emit("typing:update", { userId: data.userId, isTyping: false });
    });

    // WebRTC 통화 로직
    socket.on("call:start", (data) => {
      const { receiverId, offer } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call:incoming", { callerId: socket.userId, offer });
      }
    });

    socket.on("call:accept", (data) => {
      const { callerId, answer } = data;
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call:accepted", { answer });
      }
    });

    socket.on("call:reject", (data) => {
      const callerSocketId = onlineUsers.get(data.callerId);
      if (callerSocketId) io.to(callerSocketId).emit("call:rejected");
    });

    socket.on("call:end", (data) => {
      const otherSocketId = onlineUsers.get(data.otherUserId);
      if (otherSocketId) io.to(otherSocketId).emit("call:ended");
    });

    socket.on("call:ice-candidate", (data) => {
      const otherSocketId = onlineUsers.get(data.otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("call:ice-candidate", { candidate: data.candidate });
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
      console.log(`❌ 연결 끊김: ${socket.userId}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`🚀 서버 시작: http://${hostname}:${port}`);
  });
});