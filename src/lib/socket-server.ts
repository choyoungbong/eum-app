import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/db";

// 전역 변수로 IO 인스턴스 관리
let globalIo: SocketIOServer | null = null;

export const initSocketServer = (httpServer: NetServer) => {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  globalIo = io;

  io.on("connection", (socket: any) => {
    const userId = socket.handshake.query.userId;
    if (!userId) return;
    
    socket.join(`user:${userId}`);

    // 통화 요청
    socket.on("call:initiate", async ({ chatRoomId, receiverId, callType, offer }: any) => {
      try {
        const call = await prisma.call.create({
          data: {
            chatRoomId,
            initiatorId: userId,
            receiverId,
            type: callType,
            // ✅ status를 "RINGING" 대신 Prisma Enum 표준인 "PENDING"으로 수정
            status: "PENDING", 
          },
        });
        
        io.to(`user:${receiverId}`).emit("call:incoming", {
          callId: call.id,
          from: userId,
          callerName: socket.user?.name || "상대방",
          callType,
          offer,
        });
      } catch (error) { 
        console.error("Call creation error:", error); 
      }
    });

    socket.on("call:accept", ({ callerId, answer }: any) => {
      io.to(`user:${callerId}`).emit("call:accepted", { answer });
    });

    socket.on("call:ice-candidate", ({ otherUserId, candidate }: any) => {
      io.to(`user:${otherUserId}`).emit("call:ice-candidate", { candidate });
    });

    socket.on("call:reject", async ({ callerId }: any) => {
      try {
        await prisma.call.updateMany({
          where: { 
            initiatorId: callerId, 
            receiverId: userId, 
            status: "PENDING" // ✅ 여기도 PENDING으로 수정
          },
          data: { status: "REJECTED" },
        });
        io.to(`user:${callerId}`).emit("call:rejected");
      } catch (error) {
        console.error("Call reject error:", error);
      }
    });

    socket.on("call:end", ({ otherUserId }: any) => {
      io.to(`user:${otherUserId}`).emit("call:ended");
    });

    socket.on("disconnect", () => { 
      socket.leave(`user:${userId}`); 
    });
  });

  return io;
};

// 알림 전송용 함수
export const emitToUser = (userId: string, event: string, data: any) => {
  if (globalIo) {
    globalIo.to(`user:${userId}`).emit(event, data);
  } else {
    console.warn("Socket.io server is not initialized yet.");
  }
};