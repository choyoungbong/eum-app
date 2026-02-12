"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";

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
  const { isConnected } = useSocket();

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchChatRooms();
    }
  }, [session]);

  const fetchChatRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/rooms");
      if (res.ok) {
        const data = await res.json();
        setChatRooms(data.chatRooms || []);
      }
    } catch (err) {
      console.error("Failed to fetch chat rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (err) {
      console.error("User search failed:", err);
    }
  };

  const createChatRoom = async (otherUserId: string) => {
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DIRECT",
          memberIds: [otherUserId],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/chat/${data.chatRoom.id}`);
      } else {
        alert("채팅방 생성 실패");
      }
    } catch (err) {
      alert("채팅방 생성 중 오류가 발생했습니다");
    }
  };

  const getChatRoomName = (chatRoom: ChatRoom) => {
    if (chatRoom.type === "GROUP") {
      return chatRoom.name || "그룹 채팅";
    }

    // 1:1 채팅: 상대방 이름
    const otherMember = chatRoom.members.find(
      (member) => member.user.id !== session?.user?.id
    );
    return otherMember?.user.name || "알 수 없음";
  };

  const getLastMessage = (chatRoom: ChatRoom) => {
    if (chatRoom.messages.length === 0) return "메시지가 없습니다";

    const lastMessage = chatRoom.messages[0];
    if (lastMessage.type === "TEXT") {
      return lastMessage.content;
    } else if (lastMessage.type === "FILE") {
      return "📎 파일";
    } else if (lastMessage.type === "CALL_LOG") {
      return "📞 통화";
    } else {
      return lastMessage.content;
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">💬 채팅</h1>
              {isConnected && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  ● 연결됨
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
                ← 대시보드
              </Link>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + 새 채팅
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center text-gray-500 py-8">로딩 중...</div>
        ) : chatRooms.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4">채팅방이 없습니다</p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              새 채팅 시작하기
            </button>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg divide-y">
            {chatRooms.map((chatRoom) => (
              <Link
                key={chatRoom.id}
                href={`/chat/${chatRoom.id}`}
                className="block p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {getChatRoomName(chatRoom)}
                      </h3>
                      {chatRoom.unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {chatRoom.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {getLastMessage(chatRoom)}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(chatRoom.updatedAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 새 채팅 모달 */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">새 채팅 시작</h3>

            {/* 사용자 검색 */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이메일 또는 이름으로 검색"
                  className="flex-1 px-3 py-2 border rounded-md"
                  onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                />
                <button
                  onClick={searchUsers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  검색
                </button>
              </div>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => createChatRoom(user.id)}
                    className="w-full p-3 text-left border rounded-md hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      {user.isOnline && (
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
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
