"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRoom } from "@/hooks/useSocket";
import { toast } from "@/components/Toast";

const MESSAGE_LIMIT = 30; // 한 번에 불러올 메시지 수

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

  // ✅ 페이지네이션 상태
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const oldestMessageDateRef = useRef<string | null>(null);

  // 스크롤 위치 보존용
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

  // ─── 초기 메시지 로드 (최근 30개) ────────────────────────
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

    // ✅ 채팅방 입장 시 읽음 처리 — 안 읽은 배지 즉시 제거
    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(
      () => {}
    );
  }, [chatRoomId]);

  // ─── 이전 메시지 더 불러오기 ──────────────────────────────
  const fetchMoreMessages = useCallback(async () => {
    if (!oldestMessageDateRef.current || isLoadingMore) return;

    setIsLoadingMore(true);

    // 스크롤 위치 보존: 로드 전 현재 스크롤 높이 기록
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

        // ✅ 스크롤 위치 보존: 새 메시지 높이만큼 아래로 보정
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

  // ✅ useInfiniteScroll — 스크롤 맨 위에 닿으면 fetchMoreMessages 실행
  const topObserverRef = useCallback((el: HTMLDivElement | null) => {
  if (!el) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && hasMore && !isLoadingMore) fetchMoreMessages();
  }, { rootMargin: "100px" });
  observer.observe(el);
  return () => observer.disconnect();
}, [hasMore, isLoadingMore, fetchMoreMessages]);

  // ─── 실시간 메시지 추가 ───────────────────────────────────
  useEffect(() => {
    if (socketMessages.length === 0) return;
    const newMsg = socketMessages[socketMessages.length - 1];
    setAllMessages((prev) =>
      prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
    );
    shouldScrollToBottomRef.current = true;

    // ✅ 새 메시지 도착 시에도 읽음 처리 (채팅방 열려있으면)
    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(
      () => {}
    );
  }, [socketMessages, chatRoomId]);

  // ─── 자동 스크롤 (새 메시지 / 초기 로드 시만) ────────────
  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollToBottomRef.current = false;
    }
  }, [allMessages]);

  // 초기 로드 완료 시 맨 아래로
  useEffect(() => {
    if (!isInitialLoading) {
      shouldScrollToBottomRef.current = true;
      bottomRef.current?.scrollIntoView();
    }
  }, [isInitialLoading]);

  // ─── 비디오 스트림 연결 ───────────────────────────────────
  useEffect(() => {
    if (localStream && localVideoRef.current)
      localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current)
      remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // ─── 메시지 전송 ──────────────────────────────────────────
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
          prev.some((m) => m.id === result.data.id)
            ? prev
            : [...prev, result.data]
        );
        socket?.emit("message:send", { chatRoomId, ...result.data });
      } else {
        toast.error("메시지 전송에 실패했습니다");
        setInput(content); // 실패 시 입력 복원
      }
    } catch {
      toast.error("메시지 전송 중 오류가 발생했습니다");
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  // ─── 유틸 ─────────────────────────────────────────────────
  const formatTime = (dateStr: any) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getOtherMember = () =>
    chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id);

  // ─── 통화 핸들러 ──────────────────────────────────────────
  const handleVoiceCall = () => {
    const other = getOtherMember();
    if (!other) return;
    initiateCall("VOICE", other.user.id);
  };

  const handleEndCall = () => {
    endCall(getOtherMember()?.user?.id);
  };

  const handleToggleMute = () => {
    setAudioMuted(toggleMute());
  };

  const isInCall =
    callStatus === "calling" ||
    callStatus === "connected" ||
    callStatus === "incoming";

  const callStatusLabel: Record<string, string> = {
    calling: "연결 중...",
    incoming: "전화 옴",
    connected: "통화 중",
  };

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

        {callStatus === "idle" && (
          <button
            onClick={handleVoiceCall}
            className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white shadow-md active:scale-90 transition-transform"
          >
            📞
          </button>
        )}
      </div>

      {/* ── 메시지 영역 ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 pb-28"
      >
        {/* ✅ 상단 감지 트리거 — 여기 닿으면 이전 메시지 로드 */}
        <div ref={topObserverRef} className="h-1" />

        {/* 이전 메시지 로딩 인디케이터 */}
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

        {/* 더 이상 메시지 없음 */}
        {!hasMore && allMessages.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-3">
            — 대화 시작 —
          </p>
        )}

        {/* 초기 로딩 스켈레톤 */}
        {isInitialLoading ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`h-10 rounded-2xl animate-pulse bg-gray-200 ${
                    i % 2 === 0 ? "w-40" : "w-52"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {allMessages.map((msg, idx) => {
              const senderId = msg.sender?.id || msg.senderId || msg.userId;
              const isMe = senderId === session?.user?.id;
              const senderName = msg.sender?.name || "상대방";

              // 날짜 구분선
              const showDateDivider =
                idx === 0 ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(allMessages[idx - 1]?.createdAt).toDateString();

              return (
                <div key={msg.id || idx}>
                  {/* 날짜 구분선 */}
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
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}
                        <div
                          className={`text-[9px] mt-1 opacity-60 ${
                            isMe ? "text-right" : "text-left"
                          }`}
                        >
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
          <div className="text-white text-center mb-10">
            <div className="w-24 h-24 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold border-4 border-white/20 animate-pulse">
              {getOtherMember()?.user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <h2 className="text-2xl font-bold">{callStatusLabel[callStatus]}</h2>
            <p className="text-white/50 text-sm mt-2">
              {getOtherMember()?.user?.name}
            </p>
          </div>

          <div className="relative w-full max-w-sm aspect-[3/4] bg-gray-900 rounded-[2rem] overflow-hidden mb-12 shadow-2xl border border-white/10">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-lg">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="flex gap-6 items-center">
            {callStatus === "incoming" && (
              <>
                <button
                  onClick={rejectCall}
                  className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                >
                  ✕
                </button>
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 bg-green-500 rounded-full text-white text-2xl shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                >
                  ✓
                </button>
              </>
            )}

            {(callStatus === "calling" || callStatus === "connected") && (
              <>
                <button
                  onClick={handleToggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl transition-all ${
                    audioMuted ? "bg-red-500" : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {audioMuted ? "🔇" : "🎤"}
                </button>
                <button
                  onClick={handleEndCall}
                  className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/40 active:scale-95 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white rotate-[135deg]">
                    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
