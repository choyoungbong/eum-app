import { NextRequest } from "next/server";
import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { initSocketServer } from "@/lib/socket-server";

export const dynamic = "force-dynamic";

let io: SocketIOServer;

export async function GET(req: NextRequest) {
  const res: any = req;
  const httpServer: NetServer & { io?: SocketIOServer } = res.socket?.server;

  if (!httpServer) {
    return new Response("No HTTP server", { status: 500 });
  }

  // ✅ 타입 확장된 방식으로 체크
  if (!httpServer.io) {
    io = initSocketServer(httpServer);
    httpServer.io = io;
    console.log("✅ Socket.io 서버 초기화 완료");
  } else {
    console.log("⚠️ Socket.io 이미 실행 중");
  }

  return new Response("Socket.io server running");
}