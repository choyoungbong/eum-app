"use client";
// src/app/chat/page.tsx — EUM 브랜딩 고도화 + 모바일 검색버튼 overflow 수정

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "@/components/Toast";
import {
  MessageSquare, Plus, ChevronLeft, Search,
  Phone, Video, Users, Wifi, WifiOff,
} from "lucide-react";

interface ChatRoom {
  id: string;
  name: string | null;
  type: "DIRECT" | "GROUP";
  members: any[];
  messages: any[];
  unreadCount: number;
  updatedAt: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { socket, isConnected } = useSocket();

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/rooms");
      if (res.ok) setChatRooms((await res.json()).chatRooms || []);
    } catch { console.error("채팅방 목록 로드 실패"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (session) fetchChatRooms();
  }, [session, fetchChatRooms]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (data: any) => {
      setChatRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === data.chatRoomId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const room = { ...updated[idx] };
        room.messages = [data];
        room.updatedAt = data.createdAt || new Date().toISOString();
        if (data.senderId !== session?.user?.id) room.unreadCount = (room.unreadCount || 0) + 1;
        updated.splice(idx, 1);
        return [room, ...updated];
      });
    };
    socket.on("message:receive", handleNewMessage);
    socket.on("message:new", handleNewMessage);
    return () => { socket.off("message:receive", handleNewMessage); socket.off("message:new", handleNewMessage); };
  }, [socket, session?.user?.id]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
        if ((data.users || []).length === 0) toast.info("검색 결과가 없습니다");
      }
    } catch { toast.error("사용자 검색에 실패했습니다"); }
    finally { setIsSearching(false); }
  };

  const createChatRoom = async (otherUserId: string) => {
    setIsCreating(true);
    setCreatingUserId(otherUserId);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: otherUserId, type: "DIRECT" }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/chat/${data.chatRoom.id}`);
      } else {
        toast.error("채팅방 생성에 실패했습니다");
      }
    } catch { toast.error("채팅방 생성 중 오류가 발생했습니다"); }
    finally { setIsCreating(false); setCreatingUserId(null); }
  };

  const closeModal = () => { setShowNewChatModal(false); setSearchResults([]); setSearchQuery(""); };

  const getChatRoomName = (chatRoom: ChatRoom) => {
    if (chatRoom.type === "GROUP") return chatRoom.name || "그룹 채팅";
    const other = chatRoom.members.find((m) => m.user.id !== session?.user?.id);
    return other?.user.name || "알 수 없음";
  };

  const isOnline = (chatRoom: ChatRoom) => {
    if (chatRoom.type !== "DIRECT") return false;
    const other = chatRoom.members.find((m) => m.user.id !== session?.user?.id);
    return other?.user?.isOnline ?? false;
  };

  const getLastMessage = (chatRoom: ChatRoom) => {
    if (!chatRoom.messages?.length) return "메시지가 없습니다";
    const last = chatRoom.messages[0];
    if (last.type === "FILE") return "📎 파일";
    if (last.type === "CALL_LOG") return "📞 통화";
    if (last.type === "SYSTEM") return last.content || "시스템 메시지";
    return last.content || "메시지가 없습니다";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    if (date.toDateString() === now.toDateString())
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "어제";
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 배경 장식 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-violet-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
              <ChevronLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <MessageSquare size={14} className="text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">채팅</h1>
              {/* 연결 상태 */}
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700"
              }`}>
                {isConnected ? <Wifi size={9} /> : <WifiOff size={9} />}
                {isConnected ? "연결됨" : "연결 중"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            새 채팅
          </button>
        </div>
      </header>

      {/* 채팅방 목록 */}
      <main className="max-w-2xl mx-auto px-4 py-4 relative">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/3 rounded-2xl p-4 flex gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-white/5 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/3 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : chatRooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-1">아직 대화가 없어요</p>
            <p className="text-zinc-600 text-sm mb-6">새 채팅을 시작해보세요</p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} />첫 채팅 시작하기
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {chatRooms.map((chatRoom) => {
              const online = isOnline(chatRoom);
              const name = getChatRoomName(chatRoom);
              const initial = name[0]?.toUpperCase() || "?";
              return (
                <Link
                  key={chatRoom.id}
                  href={`/chat/${chatRoom.id}`}
                  className="flex items-center gap-3 bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all duration-200 group"
                >
                  {/* 아바타 */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/8 flex items-center justify-center text-blue-300 font-bold text-lg">
                      {initial}
                    </div>
                    {chatRoom.type === "GROUP" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <Users size={10} className="text-zinc-400" />
                      </div>
                    )}
                    {online && chatRoom.type === "DIRECT" && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-zinc-950" />
                    )}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-zinc-100 text-sm group-hover:text-white transition-colors">{name}</span>
                      <span className="text-xs text-zinc-600 shrink-0 ml-2">{formatDate(chatRoom.updatedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-500 truncate">{getLastMessage(chatRoom)}</p>
                      {chatRoom.unreadCount > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center shrink-0 font-medium">
                          {chatRoom.unreadCount > 99 ? "99+" : chatRoom.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* 새 채팅 모달 */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 border border-white/8 rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1 text-zinc-100">새 채팅 시작</h3>
            <p className="text-xs text-zinc-500 mb-4">이름 또는 이메일로 사용자를 검색하세요</p>

            {/* ✅ 모바일 overflow 수정: flex-1 min-w-0 on input wrapper + shrink-0 on button */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 min-w-0 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                  placeholder="이름 또는 이메일로 검색"
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 focus:border-blue-500 rounded-xl outline-none text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors"
                  autoFocus
                />
              </div>
              <button
                onClick={searchUsers}
                disabled={isSearching || !searchQuery.trim()}
                className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSearching
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                  : "검색"}
              </button>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => createChatRoom(user.id)}
                    disabled={isCreating}
                    className="w-full p-3 text-left bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/40 rounded-xl transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/8 flex items-center justify-center text-blue-300 font-bold">
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-900" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-100 text-sm">{user.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {creatingUserId === user.id && isCreating
                          ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          : (
                            <div className="flex gap-1">
                              <span className="p-1.5 rounded-lg bg-zinc-700/50 text-zinc-400"><Phone size={12} /></span>
                              <span className="p-1.5 rounded-lg bg-zinc-700/50 text-zinc-400"><Video size={12} /></span>
                            </div>
                          )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-xl transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
