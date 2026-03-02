"use client";
// src/app/chat/page.tsx
// ✅ 개선판: 다크모드 완전 지원 + UI/UX 개선

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "@/components/Toast";

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
  const router                    = useRouter();
  const { socket, isConnected }   = useSocket();

  const [chatRooms,         setChatRooms]         = useState<ChatRoom[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [showNewChatModal,  setShowNewChatModal]  = useState(false);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchResults,     setSearchResults]     = useState<any[]>([]);
  const [isSearching,       setIsSearching]       = useState(false);
  const [isCreating,        setIsCreating]        = useState(false);
  const [creatingUserId,    setCreatingUserId]    = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/rooms");
      if (res.ok) {
        const data = await res.json();
        setChatRooms(data.chatRooms || []);
      }
    } catch {
      console.error("채팅방 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchChatRooms();
  }, [session, fetchChatRooms]);

  // ── 실시간: 새 메시지 오면 목록 순서/미리보기 갱신 ────
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      setChatRooms((prev) => {
        const roomIndex = prev.findIndex((r) => r.id === data.chatRoomId);
        if (roomIndex === -1) return prev;

        const updated = [...prev];
        const room = { ...updated[roomIndex] };

        room.messages  = [data];
        room.updatedAt = data.createdAt || new Date().toISOString();

        if (data.senderId !== session?.user?.id) {
          room.unreadCount = (room.unreadCount || 0) + 1;
        }

        updated.splice(roomIndex, 1);
        return [room, ...updated];
      });
    };

    socket.on("message:receive", handleNewMessage);
    socket.on("message:new",     handleNewMessage);

    return () => {
      socket.off("message:receive", handleNewMessage);
      socket.off("message:new",     handleNewMessage);
    };
  }, [socket, session?.user?.id]);

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
        if ((data.users || []).length === 0) {
          toast.info("검색 결과가 없습니다");
        }
      }
    } catch {
      toast.error("사용자 검색에 실패했습니다");
    } finally {
      setIsSearching(false);
    }
  };

  const createChatRoom = async (otherUserId: string) => {
    setIsCreating(true);
    setCreatingUserId(otherUserId);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DIRECT", memberIds: [otherUserId] }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/chat/${data.chatRoom.id}`);
      } else {
        toast.error("채팅방 생성에 실패했습니다");
      }
    } catch {
      toast.error("채팅방 생성 중 오류가 발생했습니다");
    } finally {
      setIsCreating(false);
      setCreatingUserId(null);
    }
  };

  const closeModal = () => {
    setShowNewChatModal(false);
    setSearchResults([]);
    setSearchQuery("");
  };

  const getChatRoomName = (chatRoom: ChatRoom) => {
    if (chatRoom.type === "GROUP") return chatRoom.name || "그룹 채팅";
    const other = chatRoom.members.find((m) => m.user.id !== session?.user?.id);
    return other?.user.name || "알 수 없음";
  };

  const getChatRoomInitial = (chatRoom: ChatRoom) => {
    const name = getChatRoomName(chatRoom);
    return name[0]?.toUpperCase() || "?";
  };

  const isOnline = (chatRoom: ChatRoom) => {
    if (chatRoom.type !== "DIRECT") return false;
    const other = chatRoom.members.find((m) => m.user.id !== session?.user?.id);
    return other?.user?.isOnline ?? false;
  };

  const getLastMessage = (chatRoom: ChatRoom) => {
    if (!chatRoom.messages?.length) return "메시지가 없습니다";
    const last = chatRoom.messages[0];
    if (last.type === "FILE")     return "📎 파일";
    if (last.type === "CALL_LOG") return "📞 통화";
    if (last.type === "SYSTEM")   return last.content || "시스템 메시지";
    return last.content || "메시지가 없습니다";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "어제";
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* ── 헤더 ── */}
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              💬 채팅
            </h1>
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isConnected ? "bg-green-500" : "bg-gray-300 dark:bg-zinc-600"
              }`}
              title={isConnected ? "연결됨" : "연결 중..."}
            />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"
            >
              ← 대시보드
            </Link>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              + 새 채팅
            </button>
          </div>
        </div>
      </header>

      {/* ── 채팅방 목록 ── */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 rounded-xl p-4 flex gap-3 animate-pulse"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-700 flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : chatRooms.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">💬</p>
            <p className="text-gray-500 dark:text-zinc-400 mb-4">
              아직 대화가 없어요
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              첫 채팅 시작하기
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {chatRooms.map((chatRoom) => {
              const online = isOnline(chatRoom);
              return (
                <Link
                  key={chatRoom.id}
                  href={`/chat/${chatRoom.id}`}
                  className="flex items-center gap-3 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl p-4 transition-colors"
                >
                  {/* 아바타 (온라인 표시) */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-lg">
                      {getChatRoomInitial(chatRoom)}
                    </div>
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900" />
                    )}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                        {getChatRoomName(chatRoom)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 flex-shrink-0 ml-2">
                        {formatDate(chatRoom.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                        {getLastMessage(chatRoom)}
                      </p>
                      {chatRoom.unreadCount > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
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

      {/* ── 새 채팅 모달 ── */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              새 채팅 시작
            </h3>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                placeholder="이름 또는 이메일로 검색"
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white bg-gray-50 dark:bg-zinc-800 text-sm transition-colors"
                autoFocus
              />
              <button
                onClick={searchUsers}
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {isSearching ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                ) : (
                  "검색"
                )}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => createChatRoom(user.id)}
                    disabled={isCreating}
                    className="w-full p-3 text-left border border-gray-100 dark:border-zinc-700 rounded-xl hover:bg-blue-50 dark:hover:bg-zinc-800 hover:border-blue-200 dark:hover:border-blue-700 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm">
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                          {user.email}
                        </p>
                      </div>
                      {creatingUserId === user.id && isCreating && (
                        <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
