"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useChatRoom } from "@/hooks/useSocket";
import { registerFCMToken, onForegroundMessage } from "@/lib/firebase"; 

interface Message {
  id: string;
  type: "TEXT" | "FILE" | "CALL_LOG" | "SYSTEM";
  content: string | null;
  sender: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export default function ChatRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const chatRoomId = params.id as string;

  const [chatRoom, setChatRoom] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [callingType, setCallingType] = useState<"VOICE" | "VIDEO" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages: socketMessages, sendMessage, startTyping, stopTyping, typingUsers } =
    useChatRoom(chatRoomId);

  // 1. 인증 및 푸시 토큰 등록
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (session) {
      console.log("🚀 FCM 토큰 등록 및 리스너 활성화...");
      registerFCMToken();

      // 포그라운드(앱 실행 중) 알림 수신 처리
      const unsubscribe = onForegroundMessage((payload) => {
        console.log("📬 실시간 알림 수신:", payload);
        
        // 만약 전화 요청 신호라면 즉시 대응
        if (payload.data?.type === 'call_request' || payload.data?.type === 'incoming_call') {
          const callId = payload.data.callId;
          const callerName = payload.notification?.title || "누군가";
          
          if (window.confirm(`${callerName}님에게 전화가 왔습니다. 받으시겠습니까?`)) {
            router.push(`/call/${callId}`);
          }
        }
      });

      return () => unsubscribe();
    }
  }, [session, status, router]);

  // 2. 초기 데이터 페칭 (채팅방 정보 및 기존 메시지)
  useEffect(() => {
    if (session && chatRoomId) {
      fetchChatRoom();
      fetchMessages();
    }
  }, [session, chatRoomId]);

  // 3. 소켓 메시지 중복 필터링 및 병합
  useEffect(() => {
    if (socketMessages.length > 0) {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMessages = socketMessages.filter((m) => !existingIds.has(m.id));
        if (newMessages.length === 0) return prev;
        return [...prev, ...newMessages];
      });
    }
  }, [socketMessages]);

  // 4. UI 제어 (스크롤 및 읽음 처리)
  useEffect(() => {
    scrollToBottom();
    if (chatRoomId && messages.length > 0) {
      markAsRead();
    }
  }, [messages, chatRoomId]);

  const fetchChatRoom = async () => {
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}`);
      if (res.ok) {
        const data = await res.json();
        setChatRoom(data.chatRoom);
      } else {
        router.push("/chat");
      }
    } catch (err) {
      console.error("채팅방 정보를 가져오지 못했습니다:", err);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("메시지를 가져오지 못했습니다:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" });
    } catch (err) {
      console.error("읽음 처리 실패:", err);
    }
  };

  const getOtherMember = () => {
    if (!chatRoom) return null;
    return chatRoom.members.find((m: any) => m.user.id !== session?.user?.id);
  };

  const handleStartCall = async (callType: "VOICE" | "VIDEO") => {
    const otherMember = getOtherMember();
    if (!otherMember) return alert("상대방을 찾을 수 없습니다.");
    if (callingType) return;

    setCallingType(callType);
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatRoomId,
          receiverId: otherMember.user.id,
          callType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/call/${data.call.id}`);
      } else {
        const err = await res.json();
        alert(err.error || "통화 요청 실패");
        setCallingType(null);
      }
    } catch (err) {
      alert("통화 연결 중 오류가 발생했습니다.");
      setCallingType(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    setInputMessage("");

    // 낙관적 업데이트
    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      type: "TEXT",
      content: trimmedMessage,
      sender: { id: session!.user.id, name: session!.user.name || "나" },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TEXT", content: trimmedMessage }),
      });

      if (res.ok) {
        const { data } = await res.json();
        sendMessage(data); // 소켓 전송
        setMessages((prev) => prev.map((msg) => (msg.id === tempId ? data : msg)));
      } else {
        throw new Error();
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setInputMessage(trimmedMessage);
      alert("전송 실패");
    } finally {
      setIsSending(false);
      stopTyping();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (e.target.value.length > 0) startTyping();
    else stopTyping();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getChatRoomName = () => {
    if (!chatRoom) return "채팅방";
    if (chatRoom.type === "GROUP") return chatRoom.name || "그룹 채팅";
    return getOtherMember()?.user.name || "알 수 없음";
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-white text-gray-900">로딩 중...</div>;
  }

  if (!session || !chatRoom) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/chat" className="text-blue-600 text-sm font-medium">← 뒤로</Link>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                {getChatRoomName().charAt(0).toUpperCase()}
              </div>
              {chatRoom.type === "DIRECT" && (
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${getOtherMember()?.user.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
              )}
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{getChatRoomName()}</h1>
              <p className="text-xs text-gray-400">
                {chatRoom.type === "DIRECT" ? (getOtherMember()?.user.isOnline ? "온라인" : "오프라인") : `${chatRoom.members.length}명 참여 중`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chatRoom.type === "DIRECT" && (
              <>
                <button onClick={() => handleStartCall("VOICE")} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-green-100 hover:text-green-600 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/></svg>
                </button>
                <button onClick={() => handleStartCall("VIDEO")} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => {
          const isMyMessage = message.sender.id === session.user.id;
          return (
            <div key={message.id} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] flex flex-col ${isMyMessage ? "items-end" : "items-start"}`}>
                {!isMyMessage && (index === 0 || messages[index-1].sender.id !== message.sender.id) && (
                  <span className="text-xs text-gray-500 mb-1 px-1">{message.sender.name}</span>
                )}
                <div className={`px-4 py-2 rounded-2xl shadow-sm text-sm ${isMyMessage ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border text-gray-900 rounded-tl-none"}`}>
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="bg-white border-t p-4">
        <form onSubmit={handleSendMessage} className="max-w-7xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            disabled={isSending}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-3 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
          />
          <button type="submit" disabled={!inputMessage.trim() || isSending} className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold">
            {isSending ? "..." : "전송"}
          </button>
        </form>
      </div>
    </div>
  );
}