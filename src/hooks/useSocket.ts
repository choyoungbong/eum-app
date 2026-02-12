import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Socket.IO 연결
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      auth: {
        userId: session.user.id,
      },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected");
      setIsConnected(true);

      // 온라인 상태 업데이트
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: true }),
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
    });

    socketRef.current = socket;

    // 정리
    return () => {
      if (socket) {
        // 오프라인 상태 업데이트
        fetch("/api/users/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOnline: false }),
        });

        socket.disconnect();
      }
    };
  }, [session?.user?.id]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}

// 채팅방별 훅
export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !chatRoomId) return;

    // 채팅방 입장
    socket.emit("chat:join", chatRoomId);

    // 새 메시지 수신
    const handleNewMessage = (message: any) => {
      setMessages((prev) => [...prev, message]);
    };

    // 타이핑 중
    const handleTyping = (data: { userId: string }) => {
      setTypingUsers((prev) => new Set(prev).add(data.userId));
    };

    // 타이핑 중지
    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing:user", handleTyping);
    socket.on("typing:stop", handleTypingStop);

    // 정리
    return () => {
      socket.emit("chat:leave", chatRoomId);
      socket.off("message:new", handleNewMessage);
      socket.off("typing:user", handleTyping);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, chatRoomId]);

  // 메시지 전송
  const sendMessage = (message: any) => {
    if (socket && chatRoomId) {
      socket.emit("message:send", {
        chatRoomId,
        message,
      });
    }
  };

  // 타이핑 시작
  const startTyping = () => {
    if (socket && chatRoomId) {
      socket.emit("typing:start", { chatRoomId });
    }
  };

  // 타이핑 중지
  const stopTyping = () => {
    if (socket && chatRoomId) {
      socket.emit("typing:stop", { chatRoomId });
    }
  };

  return {
    messages,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
    isConnected,
  };
}
