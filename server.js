// server.js
// Next.js + Socket.IO 통합 커스텀 서버
// npm run dev  → node server.js
// npm run start → cross-env NODE_ENV=production tsx server.js

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server: SocketIOServer } = require("socket.io");

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ── Socket.IO 초기화 ──────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  // ── global.io 등록 (API route에서 emit 가능하게) ───────
  global.io = io;

  // ── socket-server 핸들러 연결 ─────────────────────────
  // TypeScript 파일이면 tsx로 실행되므로 @/ 경로 대신 상대경로 사용
  try {
    const { initSocketServer } = require("./src/lib/socket-server");
    initSocketServer(io);
    console.log("✅ Socket.IO 핸들러 등록 완료");
  } catch (e) {
    console.error("❌ socket-server 로드 실패:", e.message);
    // 핸들러 없이도 서버는 구동됨
  }

  httpServer.listen(port, () => {
    console.log(`🚀 서버 구동: http://localhost:${port} (${dev ? "dev" : "prod"})`);
    console.log(`🔌 Socket.IO: http://localhost:${port}/api/socket/io`);
  });
});
