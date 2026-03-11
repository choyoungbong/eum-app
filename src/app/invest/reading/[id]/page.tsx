"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import {
  ChevronLeft, Send, Zap, MoreVertical,
  BarChart2, Coins, Globe, MessageSquare, Loader2,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { Sparkles } from "lucide-react";

interface Message {
  id: string; content: string; createdAt: string;
  user: { id: string; name: string };
  isTemp?: boolean;
}

interface RoomInfo {
  id: string; name: string; type: string;
  meta: { category?: string; description?: string };
  _count: { messages: number };
}

const CATEGORY_COLOR: Record<string, string> = {
  KOSPI: "text-blue-400", KOSDAQ: "text-emerald-400",
  NASDAQ: "text-violet-400", CRYPTO: "text-yellow-400", FREE: "text-zinc-400",
};

const timeStr = (d: string) =>
  new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

// 날짜 구분선용
const dateLabel = (d: string) =>
  new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

export default function ReadingRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [room, setRoom]       = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [connected, setConnected] = useState(false);

  const [sendingSignal, setSendingSignal] = useState(false);
  const [signalSent,    setSignalSent]    = useState(false);

  const socketRef   = useRef<Socket | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const topRef      = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // 방 정보 조회
  useEffect(() => {
    if (!session || !id) return;
    fetch("/api/invest/rooms")
      .then((r) => r.json())
      .then((d) => {
        const found = d.rooms?.find((r: any) => r.id === id);
        if (found) setRoom(found);
      })
      .catch(() => {});
  }, [session, id]);

  // 메시지 초기 로드
  const loadMessages = useCallback(async (cur?: string) => {
    if (!id) return;
    const params = new URLSearchParams();
    if (cur) params.set("cursor", cur);
    const res = await fetch(`/api/invest/rooms/${id}/messages?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    return data;
  }, [id]);

  useEffect(() => {
    if (!session || !id) return;
    setLoading(true);
    loadMessages().then((data) => {
      if (!data) return;
      setMessages(data.messages ?? []);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      setLoading(false);
    });
  }, [session, id, loadMessages]);

  // 첫 로드 후 맨 아래로 스크롤
  useEffect(() => {
    if (!loading && isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      isFirstLoad.current = false;
    }
  }, [loading]);

  // Socket.IO 연결 (기존 EUM Socket.IO 서버 재활용)
  useEffect(() => {
    if (!session?.user?.id || !id) return;

    const socket = io({ path: "/api/socketio" });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_room", { roomId: id });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("receive_message", (msg: Message) => {
      setMessages((prev) => {
        // 임시 메시지 교체 or 추가
        const exists = prev.some((m) => m.id === msg.id);
        if (exists) return prev;
        const withoutTemp = prev.filter((m) => !m.isTemp);
        return [...withoutTemp, msg];
      });
      // 내 메시지면 자동 스크롤
      if (msg.user.id === session.user.id) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    });

    return () => {
      socket.emit("leave_room", { roomId: id });
      socket.disconnect();
    };
  }, [session, id]);

  // 더 불러오기 (위로 스크롤)
  const loadMore = async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    const prevHeight = topRef.current?.parentElement?.scrollHeight ?? 0;
    const data = await loadMessages(cursor);
    if (data) {
      setMessages((prev) => [...(data.messages ?? []), ...prev]);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      // 스크롤 위치 유지
      requestAnimationFrame(() => {
        const el = topRef.current?.parentElement;
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingMore(false);
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !socketRef.current) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    // 낙관적 업데이트
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId, content, isTemp: true,
      createdAt: new Date().toISOString(),
      user: { id: session!.user.id, name: session!.user.name ?? "나" },
    };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    socketRef.current.emit("send_message", { roomId: id, content });
    setSending(false);
    inputRef.current?.focus();
  };

  // 날짜 구분선 삽입 여부
  const showDateDivider = (idx: number) => {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].createdAt).toDateString();
    const curr = new Date(messages[idx].createdAt).toDateString();
    return prev !== curr;
  };

  // 핸들러 추가
  const handleSignal = async () => {
    setSendingSignal(true);
    const marketType =
      room?.metadata ? JSON.parse(room.metadata).category : "KOSPI";
    const res = await fetch("/api/invest/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, marketType }),
    });
    if (res.ok) {
      const d = await res.json();
      // 소켓으로 받거나 메시지 목록 새로고침
      setMessages((prev) => [...prev, d.message]);
      setSignalSent(true);
      setTimeout(() => setSignalSent(false), 3000);
    }
    setSendingSignal(false);
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  const catColor = CATEGORY_COLOR[room?.meta.category ?? "FREE"] ?? "text-zinc-400";

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* 배경 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="shrink-0 z-20 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={handleSignal} disabled={sendingSignal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
              signalSent
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:border-violet-500/40"
            }`}>
            <Sparkles size={12} className={sendingSignal ? "animate-pulse" : ""} />
            {sendingSignal ? "분석 중..." : signalSent ? "시그널 발송 완료" : "AI 시그널"}
          </button>
          <Link href="/invest/reading" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-zinc-100 truncate">{room?.name ?? "리딩방"}</h1>
              {room?.type === "AI_SIGNAL" && (
                <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                  <Zap size={8} /> AI
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium ${catColor}`}>
                {room?.meta.category ?? ""}
              </span>
              <span className="text-[10px] text-zinc-700">·</span>
              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                <MessageSquare size={9} />{room?._count.messages ?? 0}개 메시지
              </span>
              {/* 연결 상태 */}
              <span className={`ml-auto text-[9px] flex items-center gap-1 ${connected ? "text-emerald-500" : "text-zinc-700"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-700"}`} />
                {connected ? "연결됨" : "연결 중..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto px-4 py-4 relative" ref={topRef}>
        {/* 더 불러오기 */}
        {hasMore && (
          <div className="flex justify-center mb-4">
            <button onClick={loadMore} disabled={loadingMore}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 bg-white/3 border border-white/6 rounded-full transition-all disabled:opacity-50">
              {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null}
              {loadingMore ? "불러오는 중..." : "이전 메시지 보기"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center">
              <MessageSquare size={28} className="text-zinc-700" />
            </div>
            <div>
              <p className="text-zinc-500 text-sm font-medium">첫 번째 메시지를 남겨보세요</p>
              <p className="text-zinc-700 text-xs mt-1">{room?.meta.description}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1 pb-2">
            {messages.map((msg, idx) => {
              const isMe = msg.user.id === session.user.id;
              const showDate = showDateDivider(idx);
              const showName = !isMe && (idx === 0 || messages[idx - 1].user.id !== msg.user.id);

              return (
                <div key={msg.id}>
                  {/* 날짜 구분선 */}
                  {showDate && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-white/6" />
                      <span className="text-[10px] text-zinc-600 px-3 py-1 bg-zinc-900 rounded-full border border-white/6">
                        {dateLabel(msg.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-white/6" />
                    </div>
                  )}

                  <div className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
                    {/* 아바타 (상대방만) */}
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-0.5">
                        {msg.user.name?.[0] ?? "?"}
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                      {/* 이름 */}
                      {showName && (
                        <span className="text-[10px] text-zinc-500 mb-1 ml-1">{msg.user.name}</span>
                      )}

                      {/* 말풍선 */}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? `bg-violet-600 text-white rounded-br-sm ${msg.isTemp ? "opacity-60" : ""}`
                          : "bg-white/6 text-zinc-200 rounded-bl-sm"
                      }`}>
                        {msg.content}
                      </div>

                      {/* 시간 */}
                      <span className="text-[9px] text-zinc-700 mt-1 mx-1">
                        {msg.isTemp ? "전송 중..." : timeStr(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className="shrink-0 bg-zinc-950/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-2xl px-3 py-2 focus-within:border-violet-500/50 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-transparent outline-none text-sm text-zinc-100 placeholder:text-zinc-600 min-w-0"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || !connected}
              className="w-8 h-8 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            >
              {sending
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Send size={14} className="text-white" />
              }
            </button>
          </div>
          {!connected && (
            <p className="text-[10px] text-zinc-700 text-center mt-1">서버에 연결 중입니다...</p>
          )}
        </div>
      </div>
    </div>
  );
}
