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

  // ==================== 기존 채팅 로직 (100% 유지) ====================

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

  // 2. 실시간 메시지 추가
  useEffect(() => {
    if (socketMessages.length > 0) {
      const newMsg = socketMessages[socketMessages.length - 1];
      setAllMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    }
  }, [socketMessages]);

  // 3. 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, typingUsers]);

  // 4. 메시지 전송
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session || isSending) return;

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

  // ==================== WebRTC 통화 기능 ====================

  // 비디오 스트림 연결
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // 통화 상태 감지
  useEffect(() => {
    if (localStream || remoteStream) {
      setIsCalling(true);
    } else {
      setIsCalling(false);
      setAudioMuted(false);
      setVideoOff(false);
    }
  }, [localStream, remoteStream]);

  const getOtherMember = () => {
    if (!chatRoom) return null;
    return chatRoom.members?.find((m: any) => m.user.id !== session?.user?.id);
  };

  const handleVoiceCall = () => {
    const otherMember = getOtherMember();
    if (!otherMember) return alert("상대방을 찾을 수 없습니다.");
    initiateCall("VOICE", otherMember.user.id);
  };

  const handleVideoCall = () => {
    const otherMember = getOtherMember();
    if (!otherMember) return alert("상대방을 찾을 수 없습니다.");
    initiateCall("VIDEO", otherMember.user.id);
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoOff(!videoOff);
    }
  };

  const handleEndCall = () => {
    const otherMember = getOtherMember();
    if (otherMember) {
      endCall(otherMember.user.id);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-black font-sans">
      {/* 상단 헤더 */}
      <div className="p-4 border-b font-bold flex gap-3 items-center bg-white sticky top-0 z-20 shadow-sm justify-between">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="hover:bg-gray-100 p-1 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link> 
          <span className="text-lg">대화방</span>
        </div>

        {/* 통화 버튼 */}
        {chatRoom?.type === "DIRECT" && !isCalling && (
          <div className="flex gap-2">
            <button
              onClick={handleVoiceCall}
              className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
              </svg>
            </button>
            <button
              onClick={handleVideoCall}
              className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white hover:bg-blue-600 transition-colors shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 7l-7 5 7 5V7zM16 7a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7z"/>
              </svg>
            </button>
          </div>
        )}
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

      {/* 하단 입력바 */}
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

      {/* 통화 수신 오버레이 */}
      {incomingCall && !isCalling && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl font-bold text-white animate-pulse">
              {getOtherMember()?.user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold mb-1 text-gray-900">
              {getOtherMember()?.user.name}
            </h2>
            <p className="text-gray-500 mb-10 text-sm">
              {incomingCall.callType === "VIDEO" ? "영상" : "음성"} 통화 요청
            </p>
            <div className="flex gap-4">
              <button
                onClick={rejectCall}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
              >
                거절
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold hover:bg-green-600 transition-all"
              >
                수락
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 통화 화면 */}
      {isCalling && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
          {/* 원격 비디오 */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* 로컬 비디오 */}
          <div className="absolute top-10 right-10 w-32 h-44 bg-gray-900 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* 통화 컨트롤 */}
          <div className="absolute bottom-16 flex items-center gap-6">
            <button
              onClick={toggleAudio}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                audioMuted
                  ? "bg-red-500 text-white"
                  : "bg-white/20 backdrop-blur-md text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {audioMuted ? (
                  <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                    <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                )}
              </svg>
            </button>

            <button
              onClick={handleEndCall}
              className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-xl shadow-red-500/40 hover:scale-110 transition-transform"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white rotate-[135deg]">
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
              </svg>
            </button>

            <button
              onClick={toggleVideo}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                videoOff
                  ? "bg-red-500 text-white"
                  : "bg-white/20 backdrop-blur-md text-white"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {videoOff ? (
                  <>
                    <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <path d="M23 7l-7 5 7 5V7zM16 7a2 2 0 00-2-2H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7z" />
                )}
              </svg>
            </button>
          </div>

          {/* 통화 상태 */}
          <div className="absolute top-10 left-10 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full">
            <p className="text-sm font-bold text-white">
              {getOtherMember()?.user.name}
            </p>
            <p className="text-xs text-white/70">
              {remoteStream ? "연결됨" : "연결 중..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
