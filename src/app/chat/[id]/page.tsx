"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket"; // useChatRoom -> useSocket으로 복구
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

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const oldestMessageDateRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // useSocket 사용
  const {
    socketMessages,
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
  } = useSocket(chatRoomId);

  useEffect(() => {
    if (!chatRoomId) return;
    Promise.all([
      fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}`),
      fetch(`/api/chat/rooms/${chatRoomId}`),
    ]).then(async ([msgRes, roomRes]) => {
      if (msgRes.ok) {
        const data = await msgRes.json();
        const messages = data.messages || [];
        setAllMessages(messages);
        if (messages.length > 0) oldestMessageDateRef.current = messages[0].createdAt;
        setHasMore(messages.length === MESSAGE_LIMIT);
      }
      if (roomRes.ok) {
        const data = await roomRes.json();
        setChatRoom(data.chatRoom);
      }
    }).finally(() => setIsInitialLoading(false));
  }, [chatRoomId]);

  const fetchMoreMessages = useCallback(async () => {
    if (!oldestMessageDateRef.current || isLoadingMore) return;
    setIsLoadingMore(true);
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=${MESSAGE_LIMIT}&before=${encodeURIComponent(oldestMessageDateRef.current)}`);
      if (res.ok) {
        const data = await res.json();
        const older = data.messages || [];
        if (older.length === 0) { setHasMore(false); return; }
        setAllMessages((prev) => [...older, ...prev]);
        setHasMore(older.length === MESSAGE_LIMIT);
        oldestMessageDateRef.current = older[0].createdAt;
        requestAnimationFrame(() => { if (container) container.scrollTop = container.scrollHeight - prevScrollHeight; });
      }
    } finally { setIsLoadingMore(false); }
  }, [chatRoomId, isLoadingMore]);

  const { setSentinel: topObserverRef } = useInfiniteScroll({
    fetcher: async (page) => {
      if (page > 1) await fetchMoreMessages();
      return { items: [], hasMore };
    },
    deps: [chatRoomId],
  });

  useEffect(() => {
    if (socketMessages.length === 0) return;
    const newMsg = socketMessages[socketMessages.length - 1];
    setAllMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    shouldScrollToBottomRef.current = true;
  }, [socketMessages]);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollToBottomRef.current = false;
    }
  }, [allMessages]);

  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(console.warn);
    }
  }, [remoteStream]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
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
        setAllMessages((prev) => [...prev, result.data]);
        socket?.emit("message:send", { chatRoomId, ...result.data });
      }
    } finally { setIsSending(false); }
  };

  const getOtherMember = () => chatRoom?.members?.find((m: any) => m.user.id !== session?.user?.id);

  const callStatusLabel: Record<string, string> = {
    calling: "연결 중...",
    incoming: "통화 수신 중",
    connected: "통화 중",
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-black overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <p className="font-bold">{getOtherMember()?.user?.name || "대화방"}</p>
            {callStatus !== "idle" && <p className="text-xs text-green-500 animate-pulse">{callStatusLabel[callStatus]}</p>}
          </div>
        </div>
        {callStatus === "idle" && (
          <div className="flex gap-2">
            <button onClick={() => initiateCall("VOICE", getOtherMember()?.user.id)} className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">📞</button>
            <button onClick={() => initiateCall("VIDEO", getOtherMember()?.user.id)} className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">📹</button>
          </div>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-2 pb-28">
        <div ref={topObserverRef} className="h-1" />
        <div className="space-y-4 mt-2">
          {allMessages.map((msg, idx) => {
            const isMe = msg.senderId === session?.user?.id;
            return (
              <div key={idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`p-3 px-4 rounded-2xl max-w-[70%] text-sm shadow-sm ${isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border text-black rounded-tl-none"}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t z-30">
        <form onSubmit={onSend} className="flex items-center gap-2 max-w-2xl mx-auto">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 border rounded-full px-5 py-3 bg-gray-100 outline-none focus:bg-white" placeholder="메시지 입력..." />
          <button type="submit" disabled={!input.trim() || isSending} className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-full shadow-lg disabled:bg-gray-300">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>

      {callStatus !== "idle" && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-md text-white">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">{getOtherMember()?.user?.name}</h2>
            <p className="text-white/50">{callStatusLabel[callStatus]}</p>
          </div>
          {callStatus === "connected" && (
            <div className="relative w-full max-w-sm aspect-[3/4] bg-gray-900 rounded-[2rem] overflow-hidden mb-8 border border-white/10">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute top-4 right-4 w-24 aspect-[3/4] bg-black rounded-xl overflow-hidden border-2 border-white/20">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          <div className="flex gap-6 items-center">
            {callStatus === "incoming" ? (
              <>
                <button onClick={rejectCall} className="w-16 h-16 bg-red-500 rounded-full text-2xl">✕</button>
                <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full text-2xl">✓</button>
              </>
            ) : (
              <>
                <button onClick={() => setAudioMuted(toggleMute())} className={`w-14 h-14 rounded-full flex items-center justify-center ${audioMuted ? "bg-red-500" : "bg-white/20"}`}>
                  {audioMuted ? "🔇" : "🎤"}
                </button>
                <button onClick={() => endCall(getOtherMember()?.user.id)} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center rotate-[135deg]">
                  📞
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}