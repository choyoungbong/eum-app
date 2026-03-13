"use client";
// src/app/chat/[id]/page.tsx

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRoom } from "@/hooks/useSocket";
import { toast } from "@/components/Toast";

const MESSAGE_LIMIT = 30;

export default function ChatRoomPage() {
  const { data: session }  = useSession();
  const params             = useParams();
  const router             = useRouter();
  const chatRoomId         = typeof params?.id === "string" ? params.id : "";

  // ── 데이터 상태 ────────────────────────────────────────
  const [allMessages,      setAllMessages]      = useState<any[]>([]);
  const [chatRoom,         setChatRoom]         = useState<any>(null);
  const [input,            setInput]            = useState("");
  const [isSending,        setIsSending]        = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore,    setIsLoadingMore]    = useState(false);
  const [hasMore,          setHasMore]          = useState(true);
  const oldestDateRef      = useRef<string | null>(null);

  // ── 스크롤 refs ───────────────────────────────────────
  const scrollRef          = useRef<HTMLDivElement>(null);
  const bottomRef          = useRef<HTMLDivElement>(null);
  const shouldScrollBottom = useRef(true);
  const topSentinelRef     = useRef<HTMLDivElement>(null);

  // ── 비디오/오디오 refs ───────────────────────────────
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // ── 통화 UI 상태 ──────────────────────────────────────
  const [audioMuted,      setAudioMuted]      = useState(false);
  const [cameraOff,       setCameraOff]       = useState(false);
  const [currentCallType, setCurrentCallType] = useState<"VOICE" | "VIDEO">("VOICE");
  const [callTimer,       setCallTimer]       = useState(0);
  const callTimerRef      = useRef<NodeJS.Timeout | null>(null);

  // ✅ 추가: 삭제 관련 상태
  const [showMenu,     setShowMenu]     = useState(false);
  const [confirmDelete,setConfirmDelete]= useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── useChatRoom ────────────────────────────────────────
  const {
    socket, socketMessages, typingUsers,
    incomingCall, localStream, remoteStream, callStatus,
    initiateCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera,
  } = useChatRoom(chatRoomId);

  // ── 초기 로드 ──────────────────────────────────────────
  useEffect(() => {
    if (!chatRoomId) return;
    let cancelled = false;

    Promise.all([
      fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}`),
      fetch(`/api/chat/rooms/${chatRoomId}`),
    ]).then(async ([msgRes, roomRes]) => {
      if (cancelled) return;
      if (msgRes.ok) {
        const d    = await msgRes.json();
        const msgs = d.messages || [];
        setAllMessages(msgs);
        if (msgs.length > 0) oldestDateRef.current = msgs[0].createdAt;
        setHasMore(msgs.length === MESSAGE_LIMIT);
      }
      if (roomRes.ok) setChatRoom((await roomRes.json()).chatRoom);
    }).catch(console.error).finally(() => {
      if (!cancelled) setIsInitialLoading(false);
    });

    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(() => {});

    return () => { cancelled = true; };
  }, [chatRoomId]);

  // ── 이전 메시지 로드 ──────────────────────────────────
  const fetchMore = useCallback(async () => {
    if (!oldestDateRef.current || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const prevH = scrollRef.current?.scrollHeight || 0;
    try {
      const res = await fetch(
        `/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}&before=${encodeURIComponent(
          oldestDateRef.current
        )}`
      );
      if (res.ok) {
        const d = await res.json();
        const older = d.messages || [];
        if (!older.length) { setHasMore(false); return; }
        setAllMessages((p) => [...older, ...p]);
        setHasMore(older.length === MESSAGE_LIMIT);
        oldestDateRef.current = older[0].createdAt;
        requestAnimationFrame(() => {
          if (scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevH;
        });
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatRoomId, isLoadingMore, hasMore]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchMore(); },
      { rootMargin: "100px" }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [fetchMore]);

  // ── 실시간 메시지 추가 ────────────────────────────────
  useEffect(() => {
    if (!socketMessages.length) return;
    const msg = socketMessages[socketMessages.length - 1];
    setAllMessages((p) => (p.some((m) => m.id === msg.id) ? p : [...p, msg]));
    shouldScrollBottom.current = true;
    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(() => {});
  }, [socketMessages, chatRoomId]);

  // ── 자동 스크롤 ───────────────────────────────────────
  useEffect(() => {
    if (shouldScrollBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollBottom.current = false;
    }
  }, [allMessages]);

  useEffect(() => {
    if (!isInitialLoading) {
      shouldScrollBottom.current = true;
      bottomRef.current?.scrollIntoView();
    }
  }, [isInitialLoading]);

  // ── 스트림 연결 ───────────────────────────────────────
  useEffect(() => {
    if (localStream && localVideoRef.current)
      localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const remoteStreamRef = useRef<MediaStream | null>(null);

  const attachRemoteStream = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== stream) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!remoteStream) return;
    remoteStreamRef.current = remoteStream;
    attachRemoteStream();
  }, [remoteStream, attachRemoteStream]);

  useEffect(() => {
    const active = ["calling", "connected", "incoming", "ended"].includes(callStatus);
    if (active) requestAnimationFrame(() => attachRemoteStream());
  }, [callStatus, attachRemoteStream]);

  useEffect(() => {
    if (incomingCall?.callType) setCurrentCallType(incomingCall.callType);
  }, [incomingCall]);

  // ── 통화 타이머 ───────────────────────────────────────
  useEffect(() => {
    if (callStatus === "connected") {
      setCallTimer(0);
      callTimerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      setCallTimer(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callStatus]);

  // ✅ 추가: 메뉴 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── 메시지 전송 ───────────────────────────────────────
  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    const content = input;
    setInput("");
    setIsSending(true);
    socket?.emit("typing:stop", { chatRoomId });
    shouldScrollBottom.current = true;
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TEXT", content }),
      });
      const result = await res.json();
      if (result.data) {
        setAllMessages((p) =>
          p.some((m) => m.id === result.data.id) ? p : [...p, result.data]
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

  // ✅ 추가: 삭제 실행
  const handleDeleteRoom = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}`, { method: "DELETE" });
      if (res.ok) {
        const isDirect = chatRoom?.type === "DIRECT";
        toast.success(isDirect ? "대화방이 삭제되었습니다" : "채팅방에서 나갔습니다");
        router.replace("/chat");
      } else {
        const data = await res.json();
        toast.error(data.error || "삭제 실패");
        setConfirmDelete(false);
      }
    } catch {
      toast.error("서버 오류가 발생했습니다");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── 유틸 ──────────────────────────────────────────────
  const formatTime = (d: any) => {
    const dt = new Date(d);
    return isNaN(dt.getTime())
      ? ""
      : dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  const isDirect    = chatRoom?.type === "DIRECT";
  const otherMember = isDirect
    ? chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id)
    : null;
  const roomName    = isDirect
    ? (otherMember?.user?.name || "채팅")
    : (chatRoom?.name || "그룹 채팅");
  const roomInitial = roomName[0]?.toUpperCase() || "?";

  const isVideoCall = currentCallType === "VIDEO";
  const isInCall    = ["calling", "connected", "incoming", "ended"].includes(callStatus);

  const handleCall = (type: "VOICE" | "VIDEO") => {
    if (!chatRoom) { alert("채팅방 정보가 아직 로드되지 않았습니다."); return; }
    if (!isDirect) { alert("1:1 채팅에서만 통화할 수 있습니다."); return; }
    const other = chatRoom.members?.find((m: any) => m.user?.id !== session?.user?.id);
    if (!other?.user?.id) { alert("상대 유저 정보를 찾을 수 없습니다."); return; }
    if (other.user.id === session?.user?.id) { alert("자기 자신에게는 통화할 수 없습니다."); return; }
    setCurrentCallType(type);
    initiateCall(type, other.user.id);
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-gray-50 dark:bg-zinc-950 overflow-hidden">

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20" height="20" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-gray-600 dark:text-gray-400"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm shrink-0">
            {roomInitial}
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {roomName}
            </p>
            {callStatus !== "idle" && callStatus !== "ended" && (
              <p className="text-xs text-green-500 font-medium animate-pulse">
                {callStatus === "calling"   && "연결 중..."}
                {callStatus === "connected" && `통화 중 ${formatTimer(callTimer)}`}
                {callStatus === "incoming"  && `${isVideoCall ? "📹" : "📞"} 수신 중`}
              </p>
            )}
            {callStatus === "idle" && isDirect && otherMember?.user?.isOnline && (
              <p className="text-xs text-green-500">온라인</p>
            )}
          </div>
        </div>

        {/* 오른쪽 버튼 영역 */}
        <div className="flex items-center gap-1">
          {/* 통화 버튼 (1:1만) */}
          {callStatus === "idle" && isDirect && otherMember && (
            <>
              <button
                onClick={() => handleCall("VOICE")}
                title="음성 통화"
                className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow active:scale-90 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                </svg>
              </button>
              <button
                onClick={() => handleCall("VIDEO")}
                title="영상 통화"
                className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white shadow active:scale-90 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 10l4.553-2.369A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </button>
            </>
          )}

          {/* ✅ 추가: ⋮ 메뉴 버튼 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              title="메뉴"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24" className="text-gray-500 dark:text-zinc-400">
                <circle cx="12" cy="5"  r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-11 w-44 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                <button
                  onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  {isDirect ? "대화방 삭제" : "채팅방 나가기"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 메시지 영역 ──────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin"
      >
        <div ref={topSentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-gray-300 dark:bg-zinc-600 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {!hasMore && allMessages.length > 0 && (
          <p className="text-center text-xs text-gray-400 dark:text-zinc-600 py-2">
            — 대화 시작 —
          </p>
        )}

        {isInitialLoading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div
                  className={`h-10 rounded-2xl animate-pulse bg-gray-200 dark:bg-zinc-800 ${
                    i % 2 === 0 ? "w-40" : "w-52"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {allMessages.map((msg, idx) => {
              const senderId = msg.sender?.id || msg.senderId;
              const isMe     = senderId === session?.user?.id;
              const prevMsg  = allMessages[idx - 1];
              const showDate =
                idx === 0 ||
                new Date(msg.createdAt).toDateString() !==
                  new Date(prevMsg?.createdAt).toDateString();

              if (msg.type === "CALL_LOG" || msg.type === "SYSTEM") {
                return (
                  <div key={msg.id || idx} className="flex justify-center my-3">
                    <span className="text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800/60 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id || idx}>
                  {showDate && (
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                      <span className="text-xs text-gray-400 dark:text-zinc-500 px-2 whitespace-nowrap">
                        {new Date(msg.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
                    </div>
                  )}

                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`flex flex-col max-w-[75vw] sm:max-w-[60%] ${
                        isMe ? "items-end" : "items-start"
                      }`}
                    >
                      {!isMe && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 ml-1">
                          {msg.sender?.name || "상대방"}
                        </span>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-700 rounded-tl-sm"
                        }`}
                      >
                        {msg.type === "FILE" && msg.file ? (
                          <a
                            href={`/api/files/${msg.file.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline flex items-center gap-1.5"
                          >
                            <span>📎</span>
                            <span>{msg.file.originalName || msg.file.filename || "파일"}</span>
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
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
          <div className="flex justify-start mt-2">
            <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── 입력창 ───────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e as any);
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="w-11 h-11 bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-zinc-700 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </form>
      </div>

      {/* ✅ 추가: 삭제 확인 다이얼로그 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setConfirmDelete(false)}
          />
          <div className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 text-center mb-2">
                {isDirect ? "대화방 삭제" : "채팅방 나가기"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400 text-center leading-relaxed">
                {isDirect ? (
                  <>
                    <span className="text-gray-800 dark:text-zinc-200 font-medium">{roomName}</span>
                    님과의 대화방이 삭제됩니다.<br />
                    <span className="text-gray-400 dark:text-zinc-600 text-xs">
                      상대방 대화방은 유지되며, 새 메시지가 오면 다시 나타납니다.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-800 dark:text-zinc-200 font-medium">{roomName}</span>
                    에서 나갑니다.<br />
                    <span className="text-gray-400 dark:text-zinc-600 text-xs">
                      다른 멤버들의 대화는 계속 유지됩니다.
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex border-t border-gray-100 dark:border-white/8">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 py-4 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <div className="w-px bg-gray-100 dark:bg-white/8" />
              <button
                onClick={handleDeleteRoom}
                disabled={deleting}
                className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    처리 중...
                  </span>
                ) : isDirect ? "삭제" : "나가기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ 통화 모달 ════════════════════════════════════ */}
      {isInCall && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/98 flex flex-col items-center justify-between p-6 pb-12 animate-fade-in">
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          {!isVideoCall && <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />}
          {!isVideoCall && <video ref={localVideoRef}  autoPlay playsInline muted className="hidden" />}

          <div className="w-full flex justify-center pt-2">
            <span className="text-xs text-white/40 bg-white/10 px-4 py-1.5 rounded-full font-medium">
              {isVideoCall ? "📹 영상 통화" : "📞 음성 통화"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {isVideoCall && callStatus !== "incoming" && (
              <div className="relative w-full aspect-[3/4] bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className={`absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20 ${cameraOff ? "opacity-30" : ""}`}>
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  {cameraOff && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xl">📷</div>
                  )}
                </div>
              </div>
            )}

            {(!isVideoCall || callStatus === "incoming") && (
              <div className="text-center">
                <div className={`w-28 h-28 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-white border-4 border-white/10 shadow-2xl ${callStatus === "calling" ? "animate-pulse" : ""}`}>
                  {roomInitial}
                </div>
                <h2 className="text-2xl font-bold text-white">{roomName}</h2>
                <p className="text-white/50 text-sm mt-2">
                  {callStatus === "calling"   && "전화 거는 중..."}
                  {callStatus === "incoming"  && `${isVideoCall ? "영상" : "음성"} 통화 수신 중`}
                  {callStatus === "connected" && `통화 중 ${formatTimer(callTimer)}`}
                  {callStatus === "ended"     && "통화가 종료되었습니다"}
                </p>
              </div>
            )}
          </div>

          <div className="w-full">
            {callStatus === "incoming" && (
              <div className="flex justify-center items-end gap-16">
                <div className="flex flex-col items-center gap-3">
                  <button onClick={rejectCall} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                  <span className="text-white/50 text-xs">거절</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button onClick={acceptCall} className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                    </svg>
                  </button>
                  <span className="text-white/50 text-xs">수락</span>
                </div>
              </div>
            )}

            {(callStatus === "calling" || callStatus === "connected") && (
              <div className="flex justify-center items-end gap-6">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setAudioMuted(toggleMute())}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${audioMuted ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}
                  >
                    {audioMuted ? "🔇" : "🎤"}
                  </button>
                  <span className="text-white/50 text-xs">{audioMuted ? "음소거 중" : "마이크"}</span>
                </div>

                {isVideoCall && (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => setCameraOff(toggleCamera())}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${cameraOff ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}
                    >
                      {cameraOff ? "📷" : "📹"}
                    </button>
                    <span className="text-white/50 text-xs">{cameraOff ? "카메라 꺼짐" : "카메라"}</span>
                  </div>
                )}

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => endCall()}
                    className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/30 active:scale-95 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 24 24" className="text-white rotate-[135deg]">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
                    </svg>
                  </button>
                  <span className="text-white/50 text-xs">종료</span>
                </div>
              </div>
            )}

            {callStatus === "ended" && (
              <p className="text-center text-white/40 text-sm">통화가 종료되었습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
