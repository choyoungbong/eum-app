"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useChatRoom } from "@/hooks/useSocket";

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
  const [callingType, setCallingType] = useState<"VOICE" | "VIDEO" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages: socketMessages, sendMessage, startTyping, stopTyping, typingUsers } =
    useChatRoom(chatRoomId);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && chatRoomId) {
      fetchChatRoom();
      fetchMessages();
    }
  }, [session, chatRoomId]);

  useEffect(() => {
    if (socketMessages.length > 0) {
      setMessages((prev) => [...prev, ...socketMessages]);
    }
  }, [socketMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (chatRoomId && messages.length > 0) {
      markAsRead();
    }
  }, [chatRoomId, messages.length]);

  const fetchChatRoom = async () => {
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}`);
      if (res.ok) {
        const data = await res.json();
        setChatRoom(data.chatRoom);
      } else {
        alert("채팅방을 찾을 수 없습니다");
        router.push("/chat");
      }
    } catch (err) {
      console.error("Failed to fetch chat room:", err);
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
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/chat/rooms/${chatRoomId}/read`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const getOtherMember = () => {
    if (!chatRoom) return null;
    return chatRoom.members.find(
      (m: any) => m.user.id !== session?.user?.id
    );
  };

  const handleStartCall = async (callType: "VOICE" | "VIDEO") => {
    const otherMember = getOtherMember();
    if (!otherMember) {
      alert("통화 상대방을 찾을 수 없습니다");
      return;
    }
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
      alert("통화 요청 중 오류가 발생했습니다");
      setCallingType(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TEXT",
          content: inputMessage.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sendMessage(data.data);
        setInputMessage("");
      } else {
        alert("메시지 전송 실패");
      }
    } catch (err) {
      alert("메시지 전송 중 오류가 발생했습니다");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (e.target.value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getChatRoomName = () => {
    if (!chatRoom) return "채팅방";
    if (chatRoom.type === "GROUP") return chatRoom.name || "그룹 채팅";
    const otherMember = getOtherMember();
    return otherMember?.user.name || "알 수 없음";
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-900 bg-white">
        로딩 중...
      </div>
    );
  }

  if (!session || !chatRoom) return null;

  const otherMember = getOtherMember();
  const isOnline = otherMember?.user.isOnline;
  const isDirect = chatRoom.type === "DIRECT";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ===== 헤더 ===== */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/chat" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                ← 뒤로
              </Link>

              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                  {getChatRoomName().charAt(0).toUpperCase()}
                </div>
                {isDirect && (
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                )}
              </div>

              <div>
                <h1 className="text-base font-semibold leading-tight text-gray-900">
                  {getChatRoomName()}
                </h1>
                {isDirect ? (
                  <p className={`text-xs ${isOnline ? "text-green-600" : "text-gray-400"}`}>
                    {isOnline ? "온라인" : "오프라인"}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">{chatRoom.members.length}명</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isDirect && (
                <>
                  <button
                    onClick={() => handleStartCall("VOICE")}
                    disabled={!!callingType}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition ${callingType === "VOICE" ? "bg-green-500 text-white animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/></svg>
                  </button>
                  <button
                    onClick={() => handleStartCall("VIDEO")}
                    disabled={!!callingType}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition ${callingType === "VIDEO" ? "bg-blue-500 text-white animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                  </button>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                </>
              )}
              <Link href="/dashboard" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ===== 메시지 영역 ===== */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => {
          const isMyMessage = message.sender.id === session.user.id;
          const showSender = index === 0 || messages[index - 1].sender.id !== message.sender.id;

          return (
            <div key={message.id} className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isMyMessage ? "items-end" : "items-start"} flex flex-col`}>
                {!isMyMessage && showSender && (
                  <span className="text-xs text-gray-600 mb-1 px-2 font-semibold">
                    {message.sender.name}
                  </span>
                )}

                <div className={`px-4 py-2 rounded-2xl shadow-sm ${
                  isMyMessage 
                    ? "bg-blue-600 text-white rounded-tr-none" 
                    : "bg-white border border-gray-200 text-gray-900 rounded-tl-none"
                }`}>
                  {message.type === "TEXT" && (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.content}
                    </p>
                  )}
                  {message.type === "FILE" && <p className="text-sm">📎 파일이 공유되었습니다</p>}
                  {message.type === "CALL_LOG" && <p className="text-sm font-medium">📞 {message.content}</p>}
                </div>

                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {formatTime(message.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-1.5 rounded-full shadow-sm">
              <span className="text-gray-400 text-xs animate-pulse">상대방이 입력 중...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ===== 입력 영역 ===== */}
      <div className="bg-white border-t p-4 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="max-w-7xl mx-auto flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onBlur={stopTyping}
            placeholder="메시지를 입력하세요..."
            // text-gray-900 클래스를 추가하여 글자가 검정색으로 보이게 함
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400 transition-all"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-bold shadow-md"
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}