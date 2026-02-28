"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    socketMessages,
    socket,
    isConnected,
  } = useSocket(chatRoomId);

  /* ------------------ 초기 로딩 ------------------ */
  useEffect(() => {
    if (!chatRoomId) return;

    fetch(`/api/chat/rooms/${chatRoomId}`)
      .then((res) => res.json())
      .then((data) => setChatRoom(data.chatRoom));
  }, [chatRoomId]);

  /* ------------------ 소켓 메시지 ------------------ */
  useEffect(() => {
    if (socketMessages.length === 0) return;
    const newMsg = socketMessages[socketMessages.length - 1];
    setAllMessages((prev) =>
      prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
    );
  }, [socketMessages]);

  /* ------------------ 스크롤 하단 유지 ------------------ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  /* ------------------ 메시지 전송 ------------------ */
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
    } catch {
      toast.error("메시지 전송 실패");
    } finally {
      setIsSending(false);
    }
  };

  /* ------------------ UI ------------------ */

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">

      {/* 헤더 */}
      <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-20">
        <button onClick={() => router.back()}>←</button>
        <div className="flex items-center gap-2">
          <span className="font-bold">
            {chatRoom?.name || "대화방"}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-300"
            }`}
          />
        </div>
        <div />
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="space-y-4">
          {allMessages.map((msg, idx) => {
            const isMe = msg.senderId === session?.user?.id;
            return (
              <div
                key={idx}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 px-4 rounded-2xl max-w-[70%] text-sm shadow ${
                    isMe
                      ? "bg-blue-600 text-white"
                      : "bg-white border"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="bg-white border-t p-3">
        <form
          onSubmit={onSend}
          className="flex items-center gap-2 max-w-2xl mx-auto"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border rounded-full px-5 py-3 bg-gray-100 outline-none"
            placeholder="메시지 입력..."
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="bg-blue-600 text-white w-12 h-12 rounded-full"
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}