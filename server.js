// server.js (프로젝트 루트)
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { initSocketServer } from "./src/lib/socket-server.js";

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const app  = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ✅ API route에서 (global as any).io 로 접근할 수 있도록 전역 등록
  global.io = io;

  initSocketServer(io);

  httpServer.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`🔌 Socket.IO listening on /api/socket`);
  });
});