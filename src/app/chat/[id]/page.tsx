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
  const [chatRoom, setChatRoom] = useState<any>(null);
  
  // WebRTC 상태
  const [isCalling, setIsCalling] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const {
    socketMessages,
    typingUsers,
    socket,
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useChatRoom(chatRoomId);

  // 1. 초기 데이터 로드
  useEffect(() => {
    if (chatRoomId) {
      fetch(`/api/chat/rooms/${chatRoomId}/messages`)
        .then(r => r.json())
        .then(data => setAllMessages(data.messages || []))
        .catch(err => console.error("메시지 로드 실패:", err));
      
      fetch(`/api/chat/rooms/${chatRoomId}`)
        .then(r => r.json())
        .then(data => setChatRoom(data.chatRoom))
        .catch(err => console.error("채팅방 로드 실패:", err));
    }
  }, [chatRoomId]);

  // 2. 실시간 메시지 추가 (중복 방지 및 즉시 반영)
  useEffect(() => {
    if (socketMessages.length > 0) {
      const newMsg = socketMessages[socketMessages.length - 1];
      setAllMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    }
  }, [socketMessages]);

  // 3. 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, typingUsers]);

  // 4. 메시지 전송
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session?.user?.id || isSending) return;

    const content = input;
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TEXT", content }),
      });

      const result = await res.json();
      
      if (result.data) {
        // 내 화면에 즉시 추가
        setAllMessages(prev => [...prev, result.data]);
        // 상대방에게 전송
        if (socket) {
          socket.emit("message:send", { chatRoomId, ...result.data });
        }
      }
      socket?.emit("typing:stop", { chatRoomId });
    } catch (error) {
      console.error("전송 에러:", error);
    } finally {
      setIsSending(false);
    }
  };

  // ✅ 날짜 오류 방어 함수
  const formatTime = (dateStr: any) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ==================== WebRTC 로직 ====================
  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const getOtherMember = () => chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id);

  const handleVoiceCall = () => {
    const otherMember = getOtherMember();
    if (otherMember) {
      setIsCalling(true);
      initiateCall("VOICE", otherMember.user.id);
    }
  };

  const handleEndCall = () => {
    const otherMember = getOtherMember();
    if (otherMember) endCall(otherMember.user.id);
    setIsCalling(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-black overflow-hidden relative">
      {/* 헤더 */}
      <div className="p-4 border-b font-bold flex gap-3 items-center bg-white sticky top-0 z-20 shadow-sm justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="hover:bg-gray-100 p-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button> 
          <span className="text-lg">대화방</span>
        </div>
        {!isCalling && (
          <button onClick={handleVoiceCall} className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shadow-md active:scale-90 transition-transform">📞</button>
        )}
      </div>

      {/* 메시지 리스트 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {allMessages.map((msg, idx) => {
          // ✅ 핵심 수정: 구조적 결함 방어 (id 에러 해결)
          const senderId = msg.sender?.id || msg.senderId || msg.userId;
          const isMe = senderId === session?.user?.id;
          const senderName = msg.sender?.name || "상대방";

          return (
            <div key={msg.id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && <span className="text-[10px] text-gray-400 mb-1 ml-1">{senderName}</span>}
                <div className={`p-3 px-4 rounded-2xl max-w-[85%] text-[14px] shadow-sm relative ${
                  isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-gray-200 text-black rounded-tl-none"
                }`}>
                  {msg.content}
                  <div className={`text-[8px] mt-1 opacity-50 ${isMe ? "text-right" : "text-left"}`}>
                     {formatTime(msg.createdAt || new Date())}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="text-[12px] text-blue-500 animate-pulse px-2 font-bold italic">입력 중...</div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* 하단 입력창 */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 z-30">
        <form onSubmit={onSend} className="flex items-center gap-2 max-w-4xl mx-auto">
          <input 
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.length > 0) socket?.emit("typing:start", { chatRoomId });
              else socket?.emit("typing:stop", { chatRoomId });
            }}
            // ✅ text-black으로 글자색 고정
            className="flex-1 border border-gray-300 rounded-full px-5 py-3 text-black bg-gray-100 outline-none focus:bg-white text-[15px]"
            placeholder="메시지를 입력하세요..."
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isSending} 
            className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full font-bold disabled:bg-gray-300 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>

      {/* 통화 모달 */}
      {(incomingCall || isCalling) && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md">
           <div className="text-white text-center mb-10">
              <div className="w-24 h-24 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold border-4 border-white/20 animate-pulse">
                {getOtherMember()?.user.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold">{isCalling ? "통화 중" : "전화 옴"}</h2>
              <p className="text-white/50 text-sm mt-2">{getOtherMember()?.user.name}</p>
           </div>
           
           <div className="relative w-full max-w-sm aspect-[3/4] bg-gray-900 rounded-[2rem] overflow-hidden mb-12 shadow-2xl border border-white/10">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
              </div>
           </div>

           <div className="flex gap-10">
              {incomingCall && !isCalling ? (
                <>
                  <button onClick={rejectCall} className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-xl active:scale-90 transition-transform">✕</button>
                  <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full text-white text-2xl shadow-xl active:scale-90 transition-transform">✓</button>
                </>
              ) : (
                <button onClick={handleEndCall} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/40 hover:scale-105 active:scale-95 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white rotate-[135deg]"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/></svg>
                </button>
              )}
           </div>
        </div>
      )}
    </div>
  );
}