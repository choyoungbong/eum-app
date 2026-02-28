"use client";
// src/app/chat/[id]/page.tsx  ✅ 완전 재작성

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useChatRoom } from "@/hooks/useSocket";
import { toast } from "@/components/Toast";

const MESSAGE_LIMIT = 30;

export default function ChatRoomPage() {
  const { data: session }   = useSession();
  const params              = useParams();
  const router              = useRouter();
  const chatRoomId          = typeof params?.id === "string" ? params.id : "";

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

  // ── 비디오/오디오 refs ───────────────────────────────
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // ── 통화 UI 상태 ──────────────────────────────────────
  const [audioMuted,      setAudioMuted]      = useState(false);
  const [cameraOff,       setCameraOff]       = useState(false);
  const [currentCallType, setCurrentCallType] = useState<"VOICE"|"VIDEO">("VOICE");
  const [callTimer,       setCallTimer]       = useState(0);
  const callTimerRef      = useRef<NodeJS.Timeout | null>(null);

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
    Promise.all([
      fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}`),
      fetch(`/api/chat/rooms/${chatRoomId}`),
    ]).then(async ([msgRes, roomRes]) => {
      if (msgRes.ok) {
        const d   = await msgRes.json();
        const msgs = d.messages || [];
        setAllMessages(msgs);
        if (msgs.length > 0) oldestDateRef.current = msgs[0].createdAt;
        setHasMore(msgs.length === MESSAGE_LIMIT);
      }
      if (roomRes.ok) setChatRoom((await roomRes.json()).chatRoom);
    }).catch(console.error).finally(() => setIsInitialLoading(false));

    fetch(`/api/chat/rooms/${chatRoomId}/read`, { method: "POST" }).catch(() => {});
  }, [chatRoomId]);

  // ── 이전 메시지 로드 ──────────────────────────────────
  const fetchMore = useCallback(async () => {
    if (!oldestDateRef.current || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const prevH = scrollRef.current?.scrollHeight || 0;
    try {
      const res = await fetch(
        `/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}&before=${encodeURIComponent(oldestDateRef.current)}`
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
    } finally { setIsLoadingMore(false); }
  }, [chatRoomId, isLoadingMore, hasMore]);

  // IntersectionObserver로 상단 감지
  const topRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) fetchMore(); }, { rootMargin: "100px" });
    ob.observe(el);
    return () => ob.disconnect();
  }, [fetchMore]);

  // ── 실시간 메시지 추가 ────────────────────────────────
  useEffect(() => {
    if (!socketMessages.length) return;
    const msg = socketMessages[socketMessages.length - 1];
    setAllMessages((p) => p.some((m) => m.id === msg.id) ? p : [...p, msg]);
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
    if (!isInitialLoading) { shouldScrollBottom.current = true; bottomRef.current?.scrollIntoView(); }
  }, [isInitialLoading]);

  // ── 스트림 연결 ───────────────────────────────────────
  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!remoteStream) return;
    if (remoteVideoRef.current) { remoteVideoRef.current.srcObject = remoteStream; remoteVideoRef.current.play().catch(() => {}); }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = remoteStream; remoteAudioRef.current.play().catch(() => {}); }
  }, [remoteStream]);

  useEffect(() => { if (incomingCall?.callType) setCurrentCallType(incomingCall.callType); }, [incomingCall]);

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
        setAllMessages((p) => p.some((m) => m.id === result.data.id) ? p : [...p, result.data]);
        socket?.emit("message:send", { chatRoomId, ...result.data });
      } else {
        toast.error("메시지 전송 실패"); setInput(content);
      }
    } catch { toast.error("오류가 발생했습니다"); setInput(content); }
    finally { setIsSending(false); }
  };

  // ── 유틸 ──────────────────────────────────────────────
  const formatTime = (d: any) => {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const otherMember = chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id);
  const isVideoCall = currentCallType === "VIDEO";
  const isInCall    = ["calling","connected","incoming","ended"].includes(callStatus);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-zinc-950 overflow-hidden">

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-400">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          {/* 아바타 */}
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm shrink-0">
            {otherMember?.user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {otherMember?.user?.name || "채팅"}
            </p>
            {callStatus !== "idle" && callStatus !== "ended" && (
              <p className="text-xs text-green-500 font-medium animate-pulse">
                {callStatus === "calling" && "연결 중..."}
                {callStatus === "connected" && `통화 중 ${formatTimer(callTimer)}`}
                {callStatus === "incoming" && `${isVideoCall ? "📹" : "📞"} 수신 중`}
              </p>
            )}
            {callStatus === "idle" && otherMember?.user?.isOnline && (
              <p className="text-xs text-green-500">온라인</p>
            )}
          </div>
        </div>

        {/* 음성/영상 통화 버튼 */}
        {callStatus === "idle" && (
          <div className="flex gap-2">
            <button onClick={() => { setCurrentCallType("VOICE"); initiateCall("VOICE", otherMember?.user?.id); }}
              title="음성 통화"
              className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow active:scale-90 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
              </svg>
            </button>
            <button onClick={() => { setCurrentCallType("VIDEO"); initiateCall("VIDEO", otherMember?.user?.id); }}
              title="영상 통화"
              className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white shadow active:scale-90 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15 10l4.553-2.369A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── 메시지 영역 ──────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        <div ref={topRef as any} className="h-1" />

        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <div className="flex gap-1">
              {[0,1,2].map((i) => (
                <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}/>
              ))}
            </div>
          </div>
        )}

        {!hasMore && allMessages.length > 0 && (
          <p className="text-center text-xs text-gray-400 dark:text-zinc-600 py-2">— 대화 시작 —</p>
        )}

        {isInitialLoading ? (
          <div className="space-y-3 pt-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className={`flex ${i%2===0 ? "justify-end":"justify-start"}`}>
                <div className={`h-10 rounded-2xl animate-pulse bg-gray-200 dark:bg-zinc-800 ${i%2===0?"w-40":"w-52"}`}/>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {allMessages.map((msg, idx) => {
              const senderId = msg.sender?.id || msg.senderId;
              const isMe     = senderId === session?.user?.id;
              const prevMsg  = allMessages[idx - 1];
              const showDate = idx === 0 ||
                new Date(msg.createdAt).toDateString() !== new Date(prevMsg?.createdAt).toDateString();

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
                      <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800"/>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 px-2 whitespace-nowrap">
                        {new Date(msg.createdAt).toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric" })}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800"/>
                    </div>
                  )}
                  <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col max-w-[75vw] sm:max-w-[60%] ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 ml-1">
                          {msg.sender?.name || "상대방"}
                        </span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-700 rounded-tl-sm"
                      }`}>
                        {msg.type === "FILE" && msg.file ? (
                          <a href={`/api/files/${msg.file.id}/download`} className="underline flex items-center gap-1.5">
                            <span>📎</span>
                            <span>{msg.file.originalName || msg.file.filename}</span>
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
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
          <div className="flex justify-start mt-2">
            <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-3">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i*0.15}s` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── 입력창 ───────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
        <form onSubmit={onSend} className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              socket?.emit(e.target.value.length > 0 ? "typing:start" : "typing:stop", { chatRoomId });
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(e); } }}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button type="submit" disabled={!input.trim() || isSending}
            className="w-11 h-11 bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-zinc-700 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </form>
      </div>

      {/* ════ 통화 모달 ════════════════════════════════════ */}
      {isInCall && (
        <div className="fixed inset-0 z-[100] bg-zinc-950/98 flex flex-col items-center justify-between p-6 pb-12">
          {/* 오디오 태그 (항상 렌더링) */}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden"/>
          {!isVideoCall && <video ref={remoteVideoRef} autoPlay playsInline className="hidden"/>}
          {!isVideoCall && <video ref={localVideoRef}  autoPlay playsInline muted className="hidden"/>}

          {/* 상단 배지 */}
          <div className="w-full flex justify-center pt-2">
            <span className="text-xs text-white/40 bg-white/10 px-4 py-1.5 rounded-full font-medium">
              {isVideoCall ? "📹 영상 통화" : "📞 음성 통화"}
            </span>
          </div>

          {/* 중앙 */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {/* 영상 통화 화면 */}
            {isVideoCall && callStatus !== "incoming" && (
              <div className="relative w-full aspect-[3/4] bg-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10">
                <video ref={remoteVideoRef} autoPlay playsInline
                  className="w-full h-full object-cover"/>
                {/* 내 화면 (작은 창) */}
                <div className={`absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20 ${cameraOff?"opacity-30":""}`}>
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
                  {cameraOff && <div className="absolute inset-0 flex items-center justify-center text-white text-xl">📷</div>}
                </div>
              </div>
            )}

            {/* 음성 통화 / 수신 중: 아바타 */}
            {(!isVideoCall || callStatus === "incoming") && (
              <div className="text-center">
                <div className={`w-28 h-28 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-white border-4 border-white/10 shadow-2xl ${callStatus==="calling"?"animate-pulse":""}`}>
                  {otherMember?.user?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <h2 className="text-2xl font-bold text-white">{otherMember?.user?.name || "알 수 없음"}</h2>
                <p className="text-white/50 text-sm mt-2">
                  {callStatus === "calling"   && "전화 거는 중..."}
                  {callStatus === "incoming"  && `${isVideoCall?"영상":"음성"} 통화 수신 중`}
                  {callStatus === "connected" && `통화 중 ${formatTimer(callTimer)}`}
                  {callStatus === "ended"     && "통화가 종료되었습니다"}
                </p>
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="w-full">
            {/* 수신 중 */}
            {callStatus === "incoming" && (
              <div className="flex justify-center items-end gap-16">
                <div className="flex flex-col items-center gap-3">
                  <button onClick={rejectCall}
                    className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                  </button>
                  <span className="text-white/50 text-xs">거절</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button onClick={acceptCall}
                    className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
                    </svg>
                  </button>
                  <span className="text-white/50 text-xs">수락</span>
                </div>
              </div>
            )}

            {/* 통화 중 컨트롤 */}
            {(callStatus === "calling" || callStatus === "connected") && (
              <div className="flex justify-center items-end gap-6">
                {/* 음소거 */}
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => setAudioMuted(toggleMute())}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${audioMuted ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}>
                    {audioMuted ? "🔇" : "🎤"}
                  </button>
                  <span className="text-white/50 text-xs">{audioMuted ? "음소거 중" : "마이크"}</span>
                </div>
                {/* 카메라 (영상만) */}
                {isVideoCall && (
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={() => setCameraOff(toggleCamera())}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${cameraOff ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}>
                      {cameraOff ? "📷" : "📹"}
                    </button>
                    <span className="text-white/50 text-xs">{cameraOff ? "카메라 꺼짐" : "카메라"}</span>
                  </div>
                )}
                {/* 종료 */}
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => endCall(otherMember?.user?.id)}
                    className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/30 active:scale-95 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor"
                      viewBox="0 0 24 24" className="text-white rotate-[135deg]">
                      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.29 21 3 13.71 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
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
