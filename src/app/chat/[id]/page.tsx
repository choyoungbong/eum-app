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
  const [uploading, setUploading] = useState(false);

  // WebRTC 통화 상태
  const [isCalling, setIsCalling] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages: socketMessages,
    sendMessage,
    startTyping,
    stopTyping,
    typingUsers,
    isConnected,
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useChatRoom(chatRoomId);

  // FCM 초기화
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (session) {
      registerFCMToken();
      const unsubscribe = onForegroundMessage((payload) => {
        if (
          payload.data?.type === "call_request" ||
          payload.data?.type === "incoming_call"
        ) {
          const callId = payload.data.callId;
          const callerName = payload.notification?.title || "누군가";
          if (
            window.confirm(`${callerName}님에게 전화가 왔습니다. 받으시겠습니까?`)
          ) {
            router.push(`/call/${callId}`);
          }
        }
      });
      return () => unsubscribe();
    }
  }, [session, status, router]);

  // 초기 데이터 로드
  useEffect(() => {
    if (session && chatRoomId) {
      fetchChatRoom();
      fetchMessages();
    }
  }, [session, chatRoomId]);

  // 소켓 메시지 동기화
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

  // 자동 스크롤 & 읽음 처리
  useEffect(() => {
    scrollToBottom();
    if (chatRoomId && messages.length > 0) {
      markAsRead();
    }
  }, [messages, chatRoomId]);

  // 로컬/원격 비디오 표시
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
      console.error("채팅방 정보 로드 실패:", err);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/chat/rooms/${chatRoomId}/messages?limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("메시지 로드 실패:", err);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    setInputMessage("");

    // 낙관적 UI 업데이트
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
        sendMessage(data);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? data : msg))
        );
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("roomId", chatRoomId);

    try {
      const res = await fetch("/api/chat/rooms/files/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const { message } = await res.json();
        setMessages((prev) => [...prev, message]);
      } else {
        alert("파일 업로드 실패");
      }
    } catch (error) {
      console.error("File upload error:", error);
      alert("파일 업로드 중 오류 발생");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (e.target.value.length > 0) startTyping();
    else stopTyping();
  };

  const handleVoiceCall = () => {
    const otherMember = getOtherMember();
    if (!otherMember) return;
    initiateCall("VOICE", otherMember.user.id);
  };

  const handleVideoCall = () => {
    const otherMember = getOtherMember();
    if (!otherMember) return;
    initiateCall("VIDEO", otherMember.user.id);
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setAudioMuted(!audioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getChatRoomName = () => {
    if (!chatRoom) return "채팅방";
    if (chatRoom.type === "GROUP") return chatRoom.name || "그룹 채팅";
    return getOtherMember()?.user.name || "알 수 없음";
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        로딩 중...
      </div>
    );
  }

  if (!session || !chatRoom) return null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-x-hidden">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="text-blue-600 text-sm font-medium"
            >
              ← 뒤로
            </Link>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                {getChatRoomName().charAt(0).toUpperCase()}
              </div>
              {chatRoom.type === "DIRECT" && (
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    getOtherMember()?.user.isOnline
                      ? "bg-green-500"
                      : "bg-gray-400"
                  }`}
                />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-semibold text-gray-900 truncate">
                {getChatRoomName()}
              </h1>
              <p className="text-[10px] text-gray-400">
                {chatRoom.type === "DIRECT"
                  ? getOtherMember()?.user.isOnline
                    ? "온라인"
                    : "오프라인"
                  : `${chatRoom.members.length}명 참여 중`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {chatRoom.type === "DIRECT" && (
              <>
                <button
                  onClick={handleVoiceCall}
                  disabled={isCalling}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-green-100 hover:text-green-600 transition disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                  </svg>
                </button>
                <button
                  onClick={handleVideoCall}
                  disabled={isCalling}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-blue-100 hover:text-blue-600 transition disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {messages.map((message, index) => {
          const isMyMessage = message.sender.id === session.user.id;
          return (
            <div
              key={message.id}
              className={`flex ${
                isMyMessage ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] flex flex-col ${
                  isMyMessage ? "items-end" : "items-start"
                }`}
              >
                {!isMyMessage &&
                  (index === 0 ||
                    messages[index - 1].sender.id !== message.sender.id) && (
                    <span className="text-[11px] text-gray-500 mb-1 px-1">
                      {message.sender.name}
                    </span>
                  )}
                <div
                  className={`px-4 py-2 rounded-2xl shadow-sm text-sm break-all ${
                    isMyMessage
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white border text-gray-900 rounded-tl-none"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="text-xs text-gray-400 animate-pulse">입력 중...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
        <form
          onSubmit={handleSendMessage}
          className="flex items-center gap-2 max-w-7xl mx-auto"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,application/pdf,.doc,.docx"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            disabled={isSending}
            placeholder="메시지 입력..."
            className="flex-1 min-w-0 px-4 py-2.5 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 bg-gray-50"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="flex-shrink-0 px-5 py-2.5 bg-blue-600 text-white rounded-full font-bold text-sm disabled:bg-gray-300 transition-colors"
          >
            {isSending ? "..." : "전송"}
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-white rotate-[135deg]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
