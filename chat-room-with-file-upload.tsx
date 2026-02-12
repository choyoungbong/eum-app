"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useChatRoom } from "@/hooks/useSocket";

interface Message {
  id: string;
  type: "TEXT" | "FILE" | "CALL_LOG" | "SYSTEM";
  content: string | null;
  fileId: string | null;
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
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages: socketMessages, sendMessage, startTyping, stopTyping, typingUsers } =
    useChatRoom(chatRoomId);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && chatRoomId) {
      fetchChatRoom();
      fetchMessages();
    }
  }, [session, chatRoomId]);

  useEffect(() => {
    if (socketMessages.length > 0) {
      setMessages((prev) => [...prev, ...socketMessages]);
    }
  }, [socketMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (chatRoomId && messages.length > 0) {
      markAsRead();
    }
  }, [chatRoomId, messages.length]);

  const fetchChatRoom = async () => {
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}`);
      if (res.ok) {
        const data = await res.json();
        setChatRoom(data.chatRoom);
      } else {
        alert("채팅방을 찾을 수 없습니다");
        router.push("/chat");
      }
    } catch (err) {
      console.error("Failed to fetch chat room:", err);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/chat/rooms/${chatRoomId}/read`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim()) return;

    try {
      const res = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TEXT",
          content: inputMessage.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        sendMessage(data.data);
        setInputMessage("");
      } else {
        alert("메시지 전송 실패");
      }
    } catch (err) {
      alert("메시지 전송 중 오류가 발생했습니다");
    }
  };

  // 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // 1. 파일 업로드
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("파일 업로드 실패");
      }

      const uploadData = await uploadRes.json();
      const fileId = uploadData.file.id;

      // 2. 파일 메시지 전송
      const messageRes = await fetch(`/api/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "FILE",
          fileId,
        }),
      });

      if (messageRes.ok) {
        const messageData = await messageRes.json();
        sendMessage(messageData.data);
        alert("파일이 공유되었습니다!");
      } else {
        throw new Error("파일 메시지 전송 실패");
      }
    } catch (err) {
      console.error("File upload error:", err);
      alert("파일 전송 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    
    if (e.target.value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getChatRoomName = () => {
    if (!chatRoom) return "채팅방";

    if (chatRoom.type === "GROUP") {
      return chatRoom.name || "그룹 채팅";
    }

    const otherMember = chatRoom.members.find(
      (member: any) => member.user.id !== session?.user?.id
    );
    return otherMember?.user.name || "알 수 없음";
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 파일 미리보기 표시
  const handleFilePreview = (fileId: string) => {
    setPreviewImage(`/api/files/${fileId}/thumbnail`);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        로딩 중...
      </div>
    );
  }

  if (!session || !chatRoom) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/chat" className="text-blue-600 hover:text-blue-700">
                ← 뒤로
              </Link>
              <h1 className="text-lg font-semibold">{getChatRoomName()}</h1>
              {chatRoom.type === "DIRECT" && (
                <span className="text-sm text-gray-500">
                  {chatRoom.members.find(
                    (m: any) => m.user.id !== session.user.id
                  )?.user.isOnline && (
                    <span className="text-green-600">● 온라인</span>
                  )}
                </span>
              )}
            </div>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-800">
              홈
            </Link>
          </div>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => {
          const isMyMessage = message.sender.id === session.user.id;
          const showSender =
            index === 0 ||
            messages[index - 1].sender.id !== message.sender.id;

          return (
            <div
              key={message.id}
              className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-xs ${isMyMessage ? "items-end" : "items-start"} flex flex-col`}>
                {!isMyMessage && showSender && (
                  <span className="text-xs text-gray-500 mb-1 px-2">
                    {message.sender.name}
                  </span>
                )}
                
                {message.type === "SYSTEM" ? (
                  <div className="text-center w-full">
                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {message.content}
                    </span>
                  </div>
                ) : message.type === "FILE" ? (
                  <div
                    className={`px-4 py-2 rounded-2xl cursor-pointer ${
                      isMyMessage
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200"
                    }`}
                    onClick={() => message.fileId && handleFilePreview(message.fileId)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📎</span>
                      <div>
                        <p className="font-medium">파일</p>
                        <p className="text-xs opacity-75">클릭하여 보기</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isMyMessage
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                )}
                
                <span className="text-xs text-gray-400 mt-1 px-2">
                  {formatTime(message.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl">
              <span className="text-gray-500 text-sm">
                <span className="animate-pulse">●●●</span>
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="bg-white border-t p-4">
        <form onSubmit={handleSendMessage} className="max-w-7xl mx-auto flex gap-2 items-center">
          {/* 파일 첨부 버튼 */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-3 text-gray-600 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
            title="파일 첨부"
          >
            {uploading ? "⏳" : "📎"}
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onBlur={stopTyping}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            전송
          </button>
        </form>
      </div>

      {/* 파일 미리보기 모달 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-screen object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}