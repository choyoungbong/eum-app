import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      auth: { userId: session.user.id },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setIsConnected(true);
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: true }),
      });
    });

    socket.on("disconnect", () => setIsConnected(false));
    socketRef.current = socket;

    return () => {
      if (socket) {
        fetch("/api/users/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOnline: false }),
        });
        socket.disconnect();
      }
    };
  }, [session?.user?.id]);

  return { socket: socketRef.current, isConnected };
}

export function useChatRoom(chatRoomId: string | null) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !chatRoomId) return;

    socket.emit("chat:join", chatRoomId);

    const handleNewMessage = (message: any) => {
      setMessages((prev) => {
        // 중복 메시지 방지 체크
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handleTyping = (data: { userId: string }) => {
      setTypingUsers((prev) => new Set(prev).add(data.userId));
    };

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

    return () => {
      socket.emit("chat:leave", chatRoomId);
      socket.off("message:new", handleNewMessage);
      socket.off("typing:user", handleTyping);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, chatRoomId]);

  // [중요] 메시지 전송은 이제 API Route(POST)를 통해서 하므로, 
  // 소켓 emit은 필요한 경우에만(실시간 타이핑 멈춤 등) 사용합니다.
  const sendMessage = (message: any) => {
    // 만약 현재 채팅창 UI에서 API를 호출하고 있다면 이 함수는 비워두거나 
    // API 호출 로직으로 교체해야 합니다.
    console.log("소켓을 통한 메시지 발송은 중복 푸시를 방지하기 위해 API를 권장합니다.");
  };

  const startTyping = () => {
    if (socket && chatRoomId) socket.emit("typing:start", { chatRoomId });
  };

  const stopTyping = () => {
    if (socket && chatRoomId) socket.emit("typing:stop", { chatRoomId });
  };

  return { messages, setMessages, typingUsers, sendMessage, startTyping, stopTyping, isConnected };
}