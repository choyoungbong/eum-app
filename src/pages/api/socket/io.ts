// src/pages/api/socket/io.ts
// ✅ 개선판: initSocketServer를 사용하여 실제 WebRTC 시그널링 처리
// 기존 레거시 파일은 WebRTC 이벤트가 없어 통화 기능이 작동하지 않았음

import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Socket } from "net";
import { Server as SocketIOServer } from "socket.io";
import { initSocketServer } from "@/lib/socket-server";

export type NextApiResponseServerIo = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    console.log("🔌 Socket.IO 서버 초기화 중...");

    const httpServer: NetServer = res.socket.server as any;
    const io = new SocketIOServer(httpServer, {
      path: "/api/socket/io",
      addTrailingSlash: false,
      pingTimeout: 60000,
      pingInterval: 25000,
      cors: {
        origin:
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      // 대용량 메시지 허용 (파일 공유 등)
      maxHttpBufferSize: 1e7, // 10MB
    });

    // ✅ 핵심: initSocketServer를 통해 WebRTC + 채팅 + 알림 이벤트 등록
    initSocketServer(io);

    // 전역 io 저장 (emitToUser 등에서 사용)
    (global as any).io = io;
    res.socket.server.io = io;

    console.log("✅ Socket.IO 서버 초기화 완료");
  }

  res.end();
};

export default ioHandler;
