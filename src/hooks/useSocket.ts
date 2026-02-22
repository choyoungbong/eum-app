import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const socket = io("http://localhost:3000", {
      auth: { userId: session.user.id },
      transports: ["websocket"],
    });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [session?.user?.id]);

  return { socket: socketRef.current };
}

export function useChatRoom(chatRoomId: string | null) {
  const { socket } = useSocket();
  const [socketMessages, setSocketMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !chatRoomId) return;

    socket.emit("chat:join", chatRoomId);

    socket.on("message:new", (msg) => {
      console.log("📩 메시지 수신!", msg);
      setSocketMessages((prev) => [...prev, msg]);
    });

    socket.on("typing:user", (data) => setTypingUsers(prev => new Set(prev).add(data.userId)));
    socket.on("typing:stop", (data) => setTypingUsers(prev => {
      const next = new Set(prev); next.delete(data.userId); return next;
    }));

    return () => {
      socket.off("message:new");
      socket.off("typing:user");
      socket.off("typing:stop");
    };
  }, [socket, chatRoomId]);

  return { socketMessages, typingUsers, socket };
}