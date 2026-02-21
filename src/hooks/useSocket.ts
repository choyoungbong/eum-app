import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 세션이 없으면 연결하지 않음
    if (!session?.user?.id) return;

    // 소켓 연결 설정
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000", {
      auth: { userId: session.user.id },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("✅ 소켓 서버 연결 성공:", socket.id);
      setIsConnected(true);
      
      // 온라인 상태 업데이트 API 호출
      fetch("/api/users/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: true }),
      }).catch(err => console.error("Presence update error:", err));
    });

    socket.on("disconnect", () => {
      console.log("❌ 소켓 서버 연결 끊김");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("⚠️ 소켓 연결 에러:", error);
    });

    socketRef.current = socket;

    return () => {
      if (socket) {
        // 연결 해제 시 오프라인 상태 업데이트
        fetch("/api/users/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isOnline: false }),
        }).catch(() => {});
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

    // 🌟 서버(server.js) 로직에 맞춰 채팅방 입장
    socket.emit("chat:join", chatRoomId);
    console.log(`📡 채팅방 입장 요청: ${chatRoomId}`);

    // 새 메시지 수신 핸들러
    const handleNewMessage = (message: any) => {
      console.log("📩 새 메시지 수신:", message);
      setMessages((prev) => {
        // 중복 방지: 이미 목록에 있는 ID라면 추가하지 않음
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    // 타이핑 상태 핸들러
    const handleTyping = (data: { userId: string }) => {
      if (data.userId !== socket.userId) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
      }
    };

    const handleTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    // 소켓 이벤트 리스너 등록
    socket.on("message:new", handleNewMessage);
    socket.on("typing:user", handleTyping);
    socket.on("typing:stop", handleTypingStop);

    // 컴포넌트 언마운트 시 리스너 해제 및 방 퇴장
    return () => {
      console.log(`📡 채팅방 퇴장: ${chatRoomId}`);
      socket.emit("chat:leave", chatRoomId);
      socket.off("message:new", handleNewMessage);
      socket.off("typing:user", handleTyping);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [socket, chatRoomId]);

  // 타이핑 시작 알림
  const startTyping = () => {
    if (socket && chatRoomId) {
      socket.emit("typing:start", { chatRoomId });
    }
  };

  // 타이핑 중단 알림
  const stopTyping = () => {
    if (socket && chatRoomId) {
      socket.emit("typing:stop", { chatRoomId });
    }
  };

  // 메시지 전송 (현재 구조에서는 API Route POST를 사용하므로 UI에서 직접 호출하는 용도)
  const sendMessage = (message: any) => {
    // API Route 성공 후 서버가 직접 emit 하므로 여기서는 수동 추가만 하거나 비워둠
    console.log("메시지는 API를 통해 전송되어야 실시간 DB 저장이 보장됩니다.");
  };

  return { 
    messages, 
    setMessages, 
    typingUsers, 
    sendMessage, 
    startTyping, 
    stopTyping, 
    isConnected 
  };
}