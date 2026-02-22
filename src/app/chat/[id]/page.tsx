"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useChatRoom } from "@/hooks/useSocket"; // 경로 확인 필요

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

  // 1. 초기 데이터 로드 (기존 기능 유지)
  useEffect(() => {
    if (!chatRoomId) return;
    const fetchInitialData = async () => {
      try {
        const [roomRes, msgRes] = await Promise.all([
          fetch(`/api/chat/rooms/${chatRoomId}`),
          fetch(`/api/chat/rooms/${chatRoomId}/messages`)
        ]);
        if (roomRes.ok) setChatRoom(await roomRes.json());
        if (msgRes.ok) {
          const data = await msgRes.json();
          setAllMessages(data.messages);
        }
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      }
    };
    fetchInitialData();
  }, [chatRoomId]);

  // 2. 실시간 소켓 메시지 반영 (핵심 수정 사항)
  useEffect(() => {
    if (socketMessages.length > 0) {
      const lastMsg = socketMessages[socketMessages.length - 1];
      setAllMessages((prev) => {
        // 이미 존재하는 메시지(내가 보낸 것 등)는 중복 추가하지 않음
        if (prev.find(m => m.id === lastMsg.id)) return prev;
        return [...prev, lastMsg];
      });
    }
  }, [socketMessages]);

  // 3. 스크롤 제어
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages]);

  // 4. 비디오 스트림 연결
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

  // 메시지 전송 핸들러
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session?.user?.id || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });

      if (res.ok) {
        const newMessage = await res.json();
        // 소켓으로 타 사용자에게 알림
        socket?.emit("message:send", { ...newMessage, chatRoomId });
        setAllMessages((prev) => [...prev, newMessage]);
        setInput("");
      }
    } catch (error) {
      console.error("메시지 전송 실패:", error);
    } finally {
      setIsSending(false);
    }
  };

  // 통화 제어 함수들
  const startVoiceCall = () => {
    const otherUser = chatRoom?.participants.find((p: any) => p.user.id !== session?.user?.id);
    if (otherUser) {
      setIsCalling(true);
      initiateCall(otherUser.user.id);
    }
  };

  const handleEndCall = () => {
    const otherUser = chatRoom?.participants.find((p: any) => p.user.id !== session?.user?.id);
    endCall(otherUser?.user.id);
    setIsCalling(false);
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = audioMuted;
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = videoOff;
      setVideoOff(!videoOff);
    }
  };

  if (!chatRoom) return <div className="p-10 text-center font-black">로딩 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] overflow-hidden">
      {/* 헤더 */}
      <header className="bg-white border-b px-6 h-16 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-xl">←</button>
          <h1 className="font-black text-lg">{chatRoom.name || "대화방"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={startVoiceCall}
            className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl shadow-sm"
          >
            📞
          </button>
        </div>
      </header>

      {/* 메시지 영역 */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.map((msg, idx) => {
          const isMe = msg.userId === session?.user?.id;
          return (
            <div key={msg.id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm font-bold shadow-sm ${
                isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none"
              }`}>
                {msg.content}
                <div className={`text-[9px] mt-1 opacity-60 ${isMe ? "text-right" : "text-left"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="text-[10px] font-black text-slate-400 animate-pulse">상대방이 입력 중입니다...</div>
        )}
      </main>

      {/* 입력 영역 */}
      <footer className="bg-white border-t p-4 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2 max-w-5xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button 
            type="submit" 
            disabled={isSending}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-blue-500/30 disabled:opacity-50"
          >
            전송
          </button>
        </form>
      </footer>

      {/* 📞 WebRTC 통화 모달 (수신/통화 중 UI) */}
      {(incomingCall || isCalling || remoteStream) && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 backdrop-blur-xl">
          <div className="relative w-full max-w-md aspect-[3/4] bg-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
            {/* 상대방 화면 */}
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl animate-bounce">👤</div>
                <p className="font-black text-xl">{isCalling ? "연결 중..." : "전화 오는 중..."}</p>
              </div>
            )}

            {/* 내 화면 (작게) */}
            <div className="absolute top-6 right-6 w-32 aspect-[3/4] bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
            </div>

            {/* 제어 버튼 */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-6">
              {incomingCall && !remoteStream ? (
                <>
                  <button onClick={rejectCall} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center text-2xl shadow-lg">✕</button>
                  <button onClick={acceptCall} className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center text-2xl shadow-lg">✓</button>
                </>
              ) : (
                <>
                  <button onClick={toggleAudio} className={`w-14 h-14 rounded-full flex items-center justify-center ${audioMuted ? "bg-red-500" : "bg-white/10 text-white"}`}>
                    {audioMuted ? "🔇" : "🎤"}
                  </button>
                  <button onClick={handleEndCall} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center text-3xl shadow-xl">📞</button>
                  <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center ${videoOff ? "bg-red-500" : "bg-white/10 text-white"}`}>
                    {videoOff ? "🚫" : "📹"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}