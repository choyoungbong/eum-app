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

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    socket.userId = userId;
    console.log(`✅ 소켓 연결됨: ${userId}`);

    socket.on("chat:join", (chatRoomId) => {
      socket.join(`chat:${chatRoomId}`);
      console.log(`📥 방 입장: chat:${chatRoomId}`);
    });

    // 🌟 [중요] 메시지 즉시 전파 로직 (API 실패 시 대비)
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

    socket.on("disconnect", () => console.log("❌ 연결 끊김"));
  });

  httpServer.listen(port, () => {
    console.log(`🚀 서버 시작: http://localhost:${port}`);
  });
});