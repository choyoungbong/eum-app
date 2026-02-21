"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useChatRoom } from "@/hooks/useSocket";

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const params = useParams();
  const chatRoomId = params.id as string;
  
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 실시간 메시지 수신 훅
  const { messages: socketMessages, startTyping, stopTyping } = useChatRoom(chatRoomId);

  // 1. 초기 메시지 로드
  useEffect(() => {
    if (session) {
      fetch(`/api/chat/rooms/${chatRoomId}/messages`)
        .then(res => res.json())
        .then(data => setMessages(data.messages || []));
    }
  }, [chatRoomId, session]);

  // 2. 소켓으로 새 메시지가 오면 목록에 추가 (중복 방지)
  useEffect(() => {
    if (socketMessages.length > 0) {
      const lastMsg = socketMessages[socketMessages.length - 1];
      setMessages((prev) => {
        if (prev.some(m => m.id === lastMsg.id)) return prev;
        return [...prev, lastMsg];
      });
    }
  }, [socketMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const content = inputMessage;
    setInputMessage("");
    stopTyping();

    // API Route 호출 -> 여기서 DB 저장 후 소켓을 쏴줌
    await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "TEXT", content }),
    });
  };

  if (!session) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <Link href="/chat" className="text-black font-bold text-xl">←</Link>
        <h1 className="font-bold text-black">대화방</h1>
      </div>

      {/* 메시지 리스트 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 bg-gray-50">
        {messages.map((msg) => {
          const isMe = msg.sender.id === session.user.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-gray-400 mb-1 px-1">{msg.sender.name}</span>
                <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? "bg-blue-600 text-white" : "bg-white border text-black"}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 (글자색 검정 강제) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
        <form onSubmit={onSend} className="flex gap-2 max-w-5xl mx-auto">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              if (e.target.value) startTyping(); else stopTyping();
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-3 border rounded-full text-black bg-white outline-none focus:ring-2 focus:ring-blue-500"
            style={{ color: 'black' }} // ✅ 확실한 검정색
          />
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold">
            전송
          </button>
        </form>
      </div>
    </div>
  );
}