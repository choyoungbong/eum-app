"use client";
// src/app/chat/[id]/page.tsx
// ✅ 완전 재작성: 채팅 + 음성/영상 통화 지원
// - 음성 통화 버튼 (초록 📞), 영상 통화 버튼 (파란 📹)
// - 수신 통화 모달 (거절/수락)
// - 통화 중 모달 (음소거, 카메라 토글, 종료)

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRoom } from "@/hooks/useSocket";

import { toast } from "@/components/Toast";

const MESSAGE_LIMIT = 30;

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  // ✅ params null 안전 처리
  const chatRoomId = typeof params?.id === "string" ? params.id : "";

  // ── 채팅 상태 ─────────────────────────────────────────
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);

  // ── 페이지네이션 상태 ─────────────────────────────────
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const oldestMessageDateRef = useRef<string | null>(null);

  // ── 스크롤 refs ───────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);

  // ── 비디오 refs ───────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // ── 통화 UI 상태 ──────────────────────────────────────
  const [audioMuted, setAudioMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [currentCallType, setCurrentCallType] = useState<"VOICE" | "VIDEO">("VOICE");
  const [callTimer, setCallTimer] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── useChatRoom 훅 ────────────────────────────────────
  const {
    socketMessages,
    typingUsers,
    socket,
    incomingCall,
    localStream,
    remoteStream,
    callStatus,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useChatRoom(chatRoomId);

  // ── 초기 데이터 로드 ──────────────────────────────────
  useEffect(() => {
    if (!chatRoomId) return;

    Promise.all([
      fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}`),
      fetch(`/api/chat/rooms/${chatRoomId}`),
    ])
      .then(async ([msgRes, roomRes]) => {
        if (msgRes.ok) {
          const data = await msgRes.json();
          const msgs = data.messages || [];
          setAllMessages(msgs);
          if (msgs.length > 0) {
            oldestMessageDateRef.current = msgs[0].createdAt;
          }
          setHasMore(msgs.length === MESSAGE_LIMIT);
        }
        if (roomRes.ok) {
          const data = await roomRes.json();
          setChatRoom(data.chatRoom);
        }
      })
      .catch(console.error)
      .finally(() => setIsInitialLoading(false));

    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(() => {});
  }, [chatRoomId]);

  // ── 이전 메시지 로드 ──────────────────────────────────
  const fetchMoreMessages = useCallback(async () => {
    if (!oldestMessageDateRef.current || isLoadingMore) return;
    setIsLoadingMore(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      const res = await fetch(
        `/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}&before=${encodeURIComponent(
          oldestMessageDateRef.current
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        const older = data.messages || [];
        if (older.length === 0) { setHasMore(false); return; }

        setAllMessages((prev) => [...older, ...prev]);
        setHasMore(older.length === MESSAGE_LIMIT);
        if (older.length > 0) oldestMessageDateRef.current = older[0].createdAt;

        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (e) {
      console.error("이전 메시지 로드 실패:", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatRoomId, isLoadingMore]);

  // ── 상단 무한스크롤 감지 (IntersectionObserver 직접 구현) ─
  const topObserverRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && hasMore && !isLoadingMore) {
            fetchMoreMessages();
          }
        },
        { rootMargin: "100px" }
      );
      observer.observe(el);
      return () => observer.disconnect();
    },
    [hasMore, isLoadingMore, fetchMoreMessages]
  );

  // ── 실시간 메시지 추가 ────────────────────────────────
  useEffect(() => {
    if (socketMessages.length === 0) return;
    const newMsg = socketMessages[socketMessages.length - 1];
    setAllMessages((prev) =>
      prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
    );
    shouldScrollToBottomRef.current = true;
    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(() => {});
  }, [socketMessages, chatRoomId]);

  // ── 자동 스크롤 ───────────────────────────────────────
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollToBottomRef.current = false;
    }
  }, [allMessages]);

  useEffect(() => {
    if (!isInitialLoading) {
      shouldScrollToBottomRef.current = true;
      bottomRef.current?.scrollIntoView();
    }
  }, [isInitialLoading]);

  // ── 로컬 스트림 → 비디오 태그 연결 ──────────────────
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // ── 원격 스트림 → 오디오/비디오 태그 연결 ────────────
  useEffect(() => {
    if (!remoteStream) return;

    // 영상 통화: video 태그에 연결
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
    // 음성 통화: audio 태그에 연결 (muted 없음)
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // ── 수신 전화 callType 저장 ────────────────────────────
  useEffect(() => {
    if (incomingCall?.callType) {
      setCurrentCallType(incomingCall.callType);
    }
  }, [incomingCall]);

  // ── 통화 연결 시 타이머 시작 ──────────────────────────
  useEffect(() => {
    if (callStatus === "connected") {
      setCallTimer(0);
      callTimerRef.current = setInterval(() => {
        setCallTimer((t) => t + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallTimer(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callStatus]);

  // ── 메시지 전송 ───────────────────────────────────────
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session?.user?.id || isSending) return;

    const content = input;
    setInput("");
    setIsSending(true);
    socket?.emit("typing:stop", { chatRoomId });
    shouldScrollToBottomRef.current = true;

    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TEXT", content }),
      });
      const result = await res.json();
      if (result.data) {
        setAllMessages((prev) =>
          prev.some((m) => m.id === result.data.id) ? prev : [...prev, result.data]
        );
        socket?.emit("message:send", { chatRoomId, ...result.data });
      } else {
        toast.error("메시지 전송 실패");
        setInput(content);
      }
    } catch {
      toast.error("오류가 발생했습니다");
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  // ── 유틸 ──────────────────────────────────────────────
  const formatTime = (dateStr: any) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatCallTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getOtherMember = () =>
    chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id);

  // ── 통화 핸들러 ───────────────────────────────────────
  const handleVoiceCall = () => {
    const other = getOtherMember();
    if (!other) return toast.error("상대방 정보를 불러올 수 없습니다");
    setCurrentCallType("VOICE");
    initiateCall("VOICE", other.user.id);
  };

  const handleVideoCall = () => {
    const other = getOtherMember();
    if (!other) return toast.error("상대방 정보를 불러올 수 없습니다");
    setCurrentCallType("VIDEO");
    initiateCall("VIDEO", other.user.id);
  };

  const handleEndCall = () => {
    endCall(getOtherMember()?.user?.id);
  };

  const handleToggleMute = () => {
    setAudioMuted(toggleMute());
  };

  const handleToggleCamera = () => {
    setCameraOff(toggleCamera());
  };

  const isInCall =
    callStatus === "calling" ||
    callStatus === "connected" ||
    callStatus === "incoming" ||
    callStatus === "ended";

  const callStatusLabel: Record<string, string> = {
    calling: "연결 중...",
    incoming: "",
    connected: formatCallTimer(callTimer),
    ended: "통화 종료",
  };

  const isVideoCall = currentCallType === "VIDEO";
  const otherMember = getOtherMember();

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-black overflow-hidden">

      {/* ════ 헤더 ════ */}
      <div className="p-4 border-b flex gap-3 items-center bg-white sticky top-0 z-20 shadow-sm justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="hover:bg-gray-100 p-1 rounded-full transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div>
            <p className="font-bold text-base leading-tight">
              {otherMember?.user?.name || "대화방"}
            </p>
            {callStatus !== "idle" && callStatus !== "ended" && (
              <p className="text-xs text-green-500 font-medium animate-pulse">
                {callStatus === "calling" && "연결 중..."}
                {callStatus === "connected" && `통화 중 ${formatCallTimer(callTimer)}`}
                {callStatus === "incoming" &&
                  `${isVideoCall ? "📹 영상" : "📞 음성"} 통화 수신 중`}
              </p>
            )}
          </div>
        </div>

        {/* ✅ 음성/영상 통화 버튼 분리 */}
        {callStatus === "idle" && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleVoiceCall}
              title="음성 통화"
              className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white text-lg shadow-md active:scale-90 transition-all"
            >
              📞
            </button>
            <button
              onClick={handleVideoCall}
              title="영상 통화"
              className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white text-lg shadow-md active:scale-90 transition-all"
            >
              📹
            </button>
          </div>
        )}
      </div>

      {/* ════ 메시지 영역 ════ */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-2 pb-28">
        <div ref={topObserverRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {!hasMore && allMessages.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-3">— 대화 시작 —</p>
        )}

        {isInitialLoading ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className={`h-10 rounded-2xl animate-pulse bg-gray-200 ${i % 2 === 0 ? "w-40" : "w-52"}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {allMessages.map((msg, idx) => {
              const senderId = msg.sender?.id || msg.senderId || msg.userId;
              const isMe = senderId === session?.user?.id;
              const senderName = msg.sender?.name || "상대방";

              const showDateDivider =
                idx === 0 ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(allMessages[idx - 1]?.createdAt).toDateString();

              // 시스템/통화 로그 메시지
              if (msg.type === "CALL_LOG" || msg.type === "SYSTEM") {
                return (
                  <div key={msg.id || idx} className="flex justify-center my-2">
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id || idx}>
                  {showDateDivider && (
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 px-2">
                        {new Date(msg.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}

                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <span className="text-[10px] text-gray-400 mb-1 ml-1">{senderName}</span>
                      )}
                      <div
                        className={`p-3 px-4 rounded-2xl max-w-[80vw] sm:max-w-[60%] text-[14px] shadow-sm ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-white border border-gray-200 text-black rounded-tl-none"
                        }`}
                      >
                        {msg.type === "FILE" && msg.file ? (
                          <a href={msg.file.url} target="_blank" rel="noopener noreferrer"
                            className="underline">
                            📎 {msg.file.originalName || msg.file.name}
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        <div className={`text-[9px] mt-1 opacity-60 ${isMe ? "text-right" : "text-left"}`}>
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {typingUsers.size > 0 && (
          <div className="flex justify-start mt-4">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ════ 입력창 ════ */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 z-30">
        <form onSubmit={onSend} className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              socket?.emit(
                e.target.value.length > 0 ? "typing:start" : "typing:stop",
                { chatRoomId }
              );
            }}
            className="flex-1 border border-gray-300 rounded-full px-5 py-3 text-black bg-gray-100 outline-none focus:bg-white text-[15px]"
            placeholder="메시지를 입력하세요..."
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full disabled:bg-gray-300 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
      </div>

      {/* ════ 통화 모달 ════ */}
      {isInCall && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-between p-6 pb-12">

          {/* 상단: 통화 타입 배지 */}
          <div className="w-full flex justify-center pt-4">
            <span className="text-xs font-semibold text-white/50 bg-white/10 px-4 py-1.5 rounded-full">
              {isVideoCall ? "📹 영상 통화" : "📞 음성 통화"}
            </span>
          </div>

          {/* 중앙: 상대방 정보 + 영상 */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {/* 영상 통화: video 영역 */}
            {isVideoCall && callStatus !== "incoming" && (
              <div className="relative w-full aspect-[3/4] bg-gray-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
                {/* 상대방 영상 */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  // ✅ muted 없음 → 상대방 소리 들림
                  className="w-full h-full object-cover"
                />
                {/* 내 영상 (작은 창) */}
                <div className={`absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-lg ${cameraOff ? "opacity-30" : ""}`}>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted  // ✅ 로컬은 음소거 (하울링 방지)
                    className="w-full h-full object-cover"
                  />
                  {cameraOff && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-2xl">
                      📷
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 음성 통화 또는 연결 전: 아바타 */}
            {(!isVideoCall || callStatus === "incoming") && (
              <div className="text-white text-center">
                <div
                  className={`w-28 h-28 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold border-4 border-white/20 shadow-2xl ${
                    callStatus === "calling" ? "animate-pulse" : ""
                  }`}
                >
                  {otherMember?.user?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {otherMember?.user?.name || "알 수 없음"}
                </h2>
                <p className="text-white/60 text-sm mt-2">
                  {callStatus === "calling" && "전화 거는 중..."}
                  {callStatus === "incoming" && `${isVideoCall ? "영상" : "음성"} 통화 수신`}
                  {callStatus === "connected" && `통화 중 ${formatCallTimer(callTimer)}`}
                  {callStatus === "ended" && "통화가 종료되었습니다"}
                </p>
              </div>
            )}

            {/* 음성 통화: 숨겨진 오디오 태그 (음성 재생용) */}
            {/* ✅ video 태그도 hidden으로 넣어서 오디오만 재생 */}
            {!isVideoCall && (
              <>
                <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
                <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
              </>
            )}
          </div>

          {/* 하단: 버튼 영역 */}
          <div className="w-full">
            {/* 수신 중: 거절/수락 */}
            {callStatus === "incoming" && (
              <div className="flex justify-center items-end gap-16">
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={rejectCall}
                    className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl shadow-xl active:scale-90 transition-transform hover:bg-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                  <span className="text-white/60 text-xs font-medium">거절</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-xl active:scale-90 transition-transform hover:bg-green-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                      fill="currentColor">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
                    </svg>
                  </button>
                  <span className="text-white/60 text-xs font-medium">수락</span>
                </div>
              </div>
            )}

            {/* 통화 중: 컨트롤 버튼 */}
            {(callStatus === "calling" || callStatus === "connected") && (
              <div className="flex justify-center items-end gap-8">
                {/* 음소거 */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleToggleMute}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
                      audioMuted
                        ? "bg-red-500 text-white"
                        : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                  >
                    {audioMuted ? "🔇" : "🎤"}
                  </button>
                  <span className="text-white/60 text-xs">
                    {audioMuted ? "음소거 중" : "음소거"}
                  </span>
                </div>

                {/* 카메라 (영상 통화만) */}
                {isVideoCall && (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleToggleCamera}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
                        cameraOff
                          ? "bg-red-500 text-white"
                          : "bg-white/20 text-white hover:bg-white/30"
                      }`}
                    >
                      {cameraOff ? "📷" : "📹"}
                    </button>
                    <span className="text-white/60 text-xs">
                      {cameraOff ? "카메라 꺼짐" : "카메라"}
                    </span>
                  </div>
                )}

                {/* 종료 */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleEndCall}
                    className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/30 active:scale-95 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"
                      viewBox="0 0 24 24" fill="currentColor" className="text-white rotate-[135deg]">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
                    </svg>
                  </button>
                  <span className="text-white/60 text-xs">종료</span>
                </div>
              </div>
            )}

            {/* 통화 종료 상태 */}
            {callStatus === "ended" && (
              <div className="text-center">
                <p className="text-white/60 text-sm">통화가 종료되었습니다</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
