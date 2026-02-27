"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

interface Post {
  id: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
  _count: {
    comments: number;
  };
  isOwner: boolean;
  isShared: boolean;
  sharedBy?: string;
}

export default function PostsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "my" | "public" | "shared">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchPosts();
    }
  }, [session, filter, searchQuery]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.set("visibility", filter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const res = await fetch(`/api/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      } else {
        console.error("Failed to fetch posts");
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    const badges = {
      PUBLIC: { text: "공개", color: "bg-green-100 text-green-700" },
      SHARED: { text: "공유", color: "bg-blue-100 text-blue-700" },
      PRIVATE: { text: "비공개", color: "bg-gray-100 text-gray-700" },
    };
    return badges[visibility as keyof typeof badges] || badges.PRIVATE;
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-2xl">
              ☁️
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">게시판</h1>
          </div>
          <Link
            href="/posts/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            글쓰기
          </Link>
        </div>
      </header>

      {/* 메인 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 필터 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-md ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter("my")}
            className={`px-4 py-2 rounded-md ${
              filter === "my"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            내 글
          </button>
          <button
            onClick={() => setFilter("public")}
            className={`px-4 py-2 rounded-md ${
              filter === "public"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            공개 글
          </button>
          <button
            onClick={() => setFilter("shared")}
            className={`px-4 py-2 rounded-md ${
              filter === "shared"
                ? "bg-purple-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            공유받은 글
          </button>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="게시글 검색..."
          />
        </div>

        {/* 설명 */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>💡 공개 설정 안내:</strong>
            <br />
            • <strong>비공개</strong>: 나만 볼 수 있음
            <br />
            • <strong>공유</strong>: 특정 사용자에게만 공유 (파일처럼 이메일로 공유)
            <br />
            • <strong>공개</strong>: 모든 사용자가 볼 수 있음
          </p>
        </div>

        {/* 게시글 목록 */}
        {loading ? (
          <p className="text-center text-gray-500 py-8">로딩 중...</p>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">게시글이 없습니다</p>
            <Link
              href="/posts/new"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700"
            >
              첫 게시글을 작성해보세요
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const badge = getVisibilityBadge(post.visibility);
              
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className={`block bg-white rounded-lg shadow hover:shadow-md transition p-6 ${
                    post.isShared ? "border-2 border-purple-300" : ""
                  }`}
                >
                  {/* 공유받은 글 헤더 */}
                  {post.isShared && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-3 py-2 rounded">
                      <span>🔗</span>
                      <span><strong>{post.sharedBy}님</strong>이 공유한 글</span>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {post.title}
                        </h3>
                        {post.isShared && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                            공유받음
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{post.isShared ? post.sharedBy : post.user.name}</span>
                        <span>•</span>
                        <span>
                          {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                        <span>•</span>
                        <span>댓글 {post._count.comments}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs rounded-full ${badge.color}`}>
                      {badge.text}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
