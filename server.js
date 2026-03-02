// server.js
// ✅ Railway 배포용 커스텀 서버
// - process.env.PORT 사용 (Railway가 동적으로 주입)
// - hostname 0.0.0.0 바인딩 (외부 접근 필수)
// - Socket.IO + WebRTC 시그널링 초기화

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ── Socket.IO 서버 초기화 ─────────────────────────────
  const io = new Server(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e7,
    cors: {
      origin:
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // ── WebRTC 시그널링 + 채팅 이벤트 등록 ──────────────
  // standalone 빌드에서는 src/ 폴더가 없으므로
  // tsconfig.server.json으로 별도 컴파일된 server-dist/ 경로 사용
  try {
    const { initSocketServer } = require("./server-dist/lib/socket-server");
    initSocketServer(io);
    console.log("✅ Socket.IO 이벤트 핸들러 등록 완료");
  } catch (err) {
    console.error("❌ socket-server 초기화 실패:", err.message);
    // 소켓 서버 없이도 Next.js는 정상 동작 — 서버는 계속 기동
  }

  // ── 전역 io 저장 (App Router API Route에서 emitToUser 사용) ──
  global.io = io;

  // ── 서버 시작 ────────────────────────────────────────
  httpServer.listen(port, hostname, () => {
    console.log(`✅ 서버 시작: http://${hostname}:${port}`);
    console.log(`   NODE_ENV : ${process.env.NODE_ENV}`);
    console.log(`   Socket.IO: /api/socket/io`);
  });
});
