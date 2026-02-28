import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";

// 만약 types 파일이 따로 없다면 아래 인터페이스를 상단에 추가하세요
import { NextApiResponse } from "next";
import { Socket } from "net";
import { Server as SocketIOServer } from "socket.io";

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
    const path = "/api/socket/io";
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: path,
      addTrailingSlash: false,
      pingTimeout: 60000,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      // 룸 조인 및 기본 이벤트
      socket.on("join-room", (roomId: string) => {
        socket.join(roomId);
      });

      // 메시지 수신 및 전달
      socket.on("send-message", (data) => {
        io.to(data.roomId).emit("receive-message", data);
      });

      // WebRTC 시그널링
      socket.on("call-user", (data) => {
        socket.to(data.to).emit("call-made", { offer: data.offer, socket: socket.id });
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export default ioHandler;