"use client";
// src/app/chat/[id]/page.tsx
// ✅ 수정: 음성/영상 통화 버튼 분리
// ✅ 수정: remoteVideo autoPlay + playsInline (음소거 제거 → 음성 들림)
// ✅ 수정: 통화 UI 개선 (통화 타입 표시, 카메라 토글 추가)

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRoom } from "@/hooks/useSocket";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { toast } from "@/components/Toast";

const MESSAGE_LIMIT = 30;

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const chatRoomId = params.id as string;

  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [currentCallType, setCurrentCallType] = useState<"VOICE" | "VIDEO">("VOICE");

  // 페이지네이션 상태
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const oldestMessageDateRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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
  } = useChatRoom(chatRoomId);

  // ── 초기 메시지 로드 ──────────────────────────────────
  useEffect(() => {
    if (!chatRoomId) return;

    Promise.all([
      fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}`),
      fetch(`/api/chat/rooms/${chatRoomId}`),
    ])
      .then(async ([msgRes, roomRes]) => {
        if (msgRes.ok) {
          const data = await msgRes.json();
          const messages = data.messages || [];
          setAllMessages(messages);
          if (messages.length > 0) {
            oldestMessageDateRef.current = messages[0].createdAt;
          }
          setHasMore(messages.length === MESSAGE_LIMIT);
        }
        if (roomRes.ok) {
          const data = await roomRes.json();
          setChatRoom(data.chatRoom);
        }
      })
      .catch((err) => console.error("초기 로드 실패:", err))
      .finally(() => setIsInitialLoading(false));

    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(() => {});
  }, [chatRoomId]);

  // ── 이전 메시지 더 불러오기 ───────────────────────────
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
        const olderMessages = data.messages || [];

        if (olderMessages.length === 0) {
          setHasMore(false);
          return;
        }

        setAllMessages((prev) => [...olderMessages, ...prev]);
        setHasMore(olderMessages.length === MESSAGE_LIMIT);

        if (olderMessages.length > 0) {
          oldestMessageDateRef.current = olderMessages[0].createdAt;
        }

        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("이전 메시지 로드 실패:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatRoomId, isLoadingMore]);

  const { setSentinel: topObserverRef } = useInfiniteScroll({
  fetcher: async (page) => {
      // 1페이지(초기 로딩)는 이미 useEffect에서 처리하므로 
      // 여기서는 '이전 메시지 더 가져오기' 로직만 연결합니다.
      if (page > 1) {
        await fetchMoreMessages();
      }
      return { items: [], hasMore: hasMore }; // items는 채팅방에서 별도로 관리하므로 빈 배열
    },
    deps: [chatRoomId], // 채팅방이 바뀌면 리셋
  });

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

  // ── 비디오 스트림 연결 ────────────────────────────────
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      // ✅ 수신 스트림 자동 재생 보장
      remoteVideoRef.current.play().catch((e) => {
        console.warn("remoteVideo autoplay 실패:", e);
      });
    }
  }, [remoteStream]);

  // ✅ 수신 전화 타입 저장
  useEffect(() => {
    if (incomingCall?.callType) {
      setCurrentCallType(incomingCall.callType);
    }
  }, [incomingCall]);

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
        toast.error("메시지 전송에 실패했습니다");
        setInput(content);
      }
    } catch {
      toast.error("메시지 전송 중 오류가 발생했습니다");
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  // ── 유틸 ─────────────────────────────────────────────
  const formatTime = (dateStr: any) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getOtherMember = () =>
    chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id);

  // ── 통화 핸들러 ───────────────────────────────────────
  const handleVoiceCall = () => {
    const other = getOtherMember();
    if (!other) return;
    setCurrentCallType("VOICE");
    initiateCall("VOICE", other.user.id);
  };

  const handleVideoCall = () => {
    const other = getOtherMember();
    if (!other) return;
    setCurrentCallType("VIDEO");
    initiateCall("VIDEO", other.user.id);
  };

  const handleEndCall = () => {
    endCall(getOtherMember()?.user?.id);
  };

  const handleToggleMute = () => {
    setAudioMuted(toggleMute());
  };

  const handleToggleVideo = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoOff(!videoTrack.enabled);
  };

  const isInCall =
    callStatus === "calling" ||
    callStatus === "connected" ||
    callStatus === "incoming";

  const callStatusLabel: Record<string, string> = {
    calling: "연결 중...",
    incoming: `${incomingCall?.callType === "VIDEO" ? "📹 영상" : "📞 음성"} 통화 수신`,
    connected: "통화 중",
  };

  const isVideoCall = currentCallType === "VIDEO";

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-black overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="p-4 border-b flex gap-3 items-center bg-white sticky top-0 z-20 shadow-sm justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="hover:bg-gray-100 p-1 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <p className="font-bold text-base">
              {getOtherMember()?.user?.name || "대화방"}
            </p>
            {isInCall && (
              <p className="text-xs text-green-500 font-medium animate-pulse">
                {callStatusLabel[callStatus]}
              </p>
            )}
          </div>
        </div>

        {/* ✅ 음성/영상 통화 버튼 분리 */}
        {callStatus === "idle" && (
          <div className="flex items-center gap-2">
            {/* 음성 통화 */}
            <button
              onClick={handleVoiceCall}
              title="음성 통화"
              className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shadow-md active:scale-90 transition-transform hover:bg-green-600"
            >
              📞
            </button>
            {/* 영상 통화 */}
            <button
              onClick={handleVideoCall}
              title="영상 통화"
              className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-md active:scale-90 transition-transform hover:bg-blue-600"
            >
              📹
            </button>
          </div>
        )}
      </div>

      {/* ── 메시지 영역 ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 pb-28"
      >
        <div ref={topObserverRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
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

              // 시스템 메시지 (통화 로그)
              if (msg.type === "CALL_LOG" || msg.type === "SYSTEM") {
                return (
                  <div key={msg.id || idx} className="flex justify-center">
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
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}

                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <span className="text-[10px] text-gray-400 mb-1 ml-1">
                          {senderName}
                        </span>
                      )}
                      <div
                        className={`p-3 px-4 rounded-2xl max-w-[80vw] sm:max-w-[60%] text-[14px] shadow-sm ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-white border border-gray-200 text-black rounded-tl-none"
                        }`}
                      >
                        {msg.type === "FILE" && msg.file ? (
                          <a
                            href={msg.file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
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
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 입력창 ── */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 z-30">
        <form
          onSubmit={onSend}
          className="flex items-center gap-2 max-w-2xl mx-auto"
        >
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
      </div>

      {/* ── 통화 모달 ── */}
      {isInCall && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md">

          {/* 통화 타입 배지 */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2">
            <span className="text-xs font-semibold text-white/60 bg-white/10 px-3 py-1 rounded-full">
              {isVideoCall ? "📹 영상 통화" : "📞 음성 통화"}
            </span>
          </div>

          {/* 상대방 정보 */}
          <div className="text-white text-center mb-8">
            <div className={`w-24 h-24 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold border-4 border-white/20 ${callStatus === "calling" ? "animate-pulse" : ""}`}>
              {getOtherMember()?.user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <h2 className="text-2xl font-bold">{getOtherMember()?.user?.name}</h2>
            <p className="text-white/50 text-sm mt-1">{callStatusLabel[callStatus]}</p>
          </div>

          {/* ✅ 영상 영역 — 음성 통화 시 숨김 */}
          {isVideoCall && (
            <div className="relative w-full max-w-sm aspect-[3/4] bg-gray-900 rounded-[2rem] overflow-hidden mb-8 shadow-2xl border border-white/10">
              {/* ✅ remoteVideo: muted 없음 → 상대방 소리가 들림 */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* 내 화면 (작은 창) */}
              <div className="absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted  // ✅ 로컬 비디오만 음소거 (하울링 방지)
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* ✅ 음성 통화 시: remoteVideo를 숨겨서 오디오만 재생 */}
          {!isVideoCall && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="hidden"  // 화면은 숨기되 오디오는 재생됨
            />
          )}

          {/* 로컬 오디오 연결용 (음성 통화) */}
          {!isVideoCall && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="hidden"
            />
          )}

          {/* 컨트롤 버튼 */}
          <div className="flex gap-6 items-center mt-4">
            {/* 수신 중: 거절/수락 버튼 */}
            {callStatus === "incoming" && (
              <>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={rejectCall}
                    className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                  >
                    ✕
                  </button>
                  <span className="text-white/60 text-xs">거절</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={acceptCall}
                    className="w-16 h-16 bg-green-500 rounded-full text-white text-2xl shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                  >
                    ✓
                  </button>
                  <span className="text-white/60 text-xs">수락</span>
                </div>
              </>
            )}

            {/* 통화 중: 컨트롤 버튼 */}
            {(callStatus === "calling" || callStatus === "connected") && (
              <>
                {/* 음소거 토글 */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleToggleMute}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl transition-all ${
                      audioMuted ? "bg-red-500" : "bg-white/20 hover:bg-white/30"
                    }`}
                  >
                    {audioMuted ? "🔇" : "🎤"}
                  </button>
                  <span className="text-white/60 text-xs">{audioMuted ? "음소거 해제" : "음소거"}</span>
                </div>

                {/* 영상 통화 시: 카메라 토글 */}
                {isVideoCall && (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleToggleVideo}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl transition-all ${
                        videoOff ? "bg-red-500" : "bg-white/20 hover:bg-white/30"
                      }`}
                    >
                      {videoOff ? "📷" : "📹"}
                    </button>
                    <span className="text-white/60 text-xs">{videoOff ? "카메라 켜기" : "카메라 끄기"}</span>
                  </div>
                )}

                {/* 통화 종료 */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleEndCall}
                    className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/40 active:scale-95 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white rotate-[135deg]">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                    </svg>
                  </button>
                  <span className="text-white/60 text-xs">종료</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
