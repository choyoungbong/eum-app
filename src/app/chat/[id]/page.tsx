"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useChatRoom } from "@/hooks/useSocket";

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const chatRoomId = params.id as string;
  
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { socketMessages, typingUsers, socket } = useChatRoom(chatRoomId);

  // 1. 초기 메시지 로드 (기존 기능 유지)
  useEffect(() => {
    if (chatRoomId) {
      fetch(`/api/chat/rooms/${chatRoomId}/messages`)
        .then(r => r.json())
        .then(data => setAllMessages(data.messages || []))
        .catch(err => console.error("메시지 로드 실패:", err));
    }
  }, [chatRoomId]);

  // 2. 실시간 메시지 수신 시 리스트에 추가 (실시간 갱신 보장)
  useEffect(() => {
    if (socketMessages.length > 0) {
      const newMsg = socketMessages[socketMessages.length - 1];
      setAllMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    }
  }, [socketMessages]);

  // 3. 메시지 추가 시 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, typingUsers]);

  // 4. 메시지 전송 핸들러 (DB 저장 + 실시간 전파 + FCM 포함)
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session || isSending) return;

    const content = input;
    setInput("");
    setIsSending(true);

    try {
      // [DB 저장 및 FCM 발송 요청]
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TEXT", content }),
      });

      const result = await res.json();
      
      // [실시간 화면 갱신 보장]
      if (socket && result.data) {
        socket.emit("message:send", { chatRoomId, message: result.data });
      }
      
      socket?.emit("typing:stop", { chatRoomId });
    } catch (error) {
      console.error("전송 에러:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-black font-sans">
      {/* 상단 헤더 */}
      <div className="p-4 border-b font-bold flex gap-3 items-center bg-white sticky top-0 z-20 shadow-sm">
        <Link href="/chat" className="hover:bg-gray-100 p-1 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link> 
        <span className="text-lg">대화방</span>
      </div>

      {/* 메시지 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {allMessages.length === 0 && (
          <div className="text-center text-gray-400 mt-10 text-sm italic">
            대화 내용이 없습니다. 먼저 메시지를 보내보세요!
          </div>
        )}
        
        {allMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender.id === session?.user?.id ? "justify-end" : "justify-start"}`}>
            <div className={`flex flex-col ${msg.sender.id === session?.user?.id ? "items-end" : "items-start"}`}>
              {msg.sender.id !== session?.user?.id && (
                <span className="text-[11px] text-gray-500 mb-1 ml-1 font-medium">{msg.sender.name}</span>
              )}
              <div className={`p-3 px-4 rounded-2xl max-w-[85%] text-[14px] shadow-sm ${
                msg.sender.id === session?.user?.id 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white border border-gray-200 text-black rounded-tl-none"
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-blue-500 px-4 py-2 rounded-2xl rounded-tl-none text-[12px] shadow-sm animate-pulse font-medium flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </span>
              메시지 입력 중...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* 하단 입력바 (개선됨) */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <form onSubmit={onSend} className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <input 
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.length > 0) socket?.emit("typing:start", { chatRoomId });
                else socket?.emit("typing:stop", { chatRoomId });
              }}
              // ✅ 배경색을 연한 회색(bg-gray-100)으로 설정하고 테두리(border-gray-300)를 명확하게 주어 흰색 배경에서 잘 보이게 수정
              className="w-full border border-gray-300 rounded-full px-5 py-3 text-black bg-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-[15px] placeholder:text-gray-500"
              placeholder="메시지를 입력하세요..."
              style={{ color: 'black' }}
            />
          </div>
          <button 
            type="submit"
            disabled={!input.trim() || isSending}
            className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full font-bold active:scale-90 transition-all disabled:bg-gray-300 shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}