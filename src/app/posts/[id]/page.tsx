"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}

interface Post {
  id: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  comments: Comment[];
}

// PostShareModal은 기존 컴포넌트 그대로 사용
import PostShareModal from "@/components/PostShareModal";

export default function PostDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { confirmDialog, openConfirm } = useConfirm();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session && postId) fetchPost();
  }, [session, postId]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
      } else {
        // ✅ alert() → toast + router.push
        toast.error("게시글을 불러올 수 없습니다");
        router.push("/posts");
      }
    } catch {
      toast.error("게시글 로드 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });

      if (res.ok) {
        setComment("");
        fetchPost();
      } else {
        toast.error("댓글 작성에 실패했습니다");
      }
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    // ✅ confirm() → ConfirmDialog
    openConfirm({
      title: "댓글 삭제",
      message: "댓글을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
          if (res.ok) {
            fetchPost();
          } else {
            toast.error("댓글 삭제에 실패했습니다");
          }
        } catch {
          toast.error("오류가 발생했습니다");
        }
      },
    });
  };

  const handleDeletePost = () => {
    // ✅ confirm() → ConfirmDialog
    openConfirm({
      title: "게시글 삭제",
      message: "게시글을 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "danger",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
          if (res.ok) {
            toast.success("게시글이 삭제되었습니다");
            router.push("/posts");
          } else {
            toast.error("삭제에 실패했습니다");
          }
        } catch {
          toast.error("오류가 발생했습니다");
        }
      },
    });
  };

  const getVisibilityBadge = (visibility: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      PUBLIC: { text: "공개", color: "bg-green-100 text-green-700" },
      SHARED: { text: "공유", color: "bg-blue-100 text-blue-700" },
      PRIVATE: { text: "비공개", color: "bg-gray-100 text-gray-700" },
    };
    return badges[visibility] || badges.PRIVATE;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (!session || !post) return null;

  const isAuthor = post.user.id === session.user.id;
  const badge = getVisibilityBadge(post.visibility);

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmDialog}

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/posts" className="text-gray-600 hover:text-gray-900">
            ← 목록으로
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 게시글 본문 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{post.user.name}</span>
                <span>•</span>
                <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
                  {badge.text}
                </span>
              </div>
            </div>
            {isAuthor && (
              <div className="flex gap-2">
                {post.visibility === "SHARED" && (
                  <button
                    onClick={() => setShareModalOpen(true)}
                    className="px-3 py-1 text-sm text-blue-600 border border-blue-300 hover:bg-blue-50 rounded"
                  >
                    공유 관리
                  </button>
                )}
                <button
                  onClick={handleDeletePost}
                  className="px-3 py-1 text-sm text-red-600 border border-red-300 hover:bg-red-50 rounded"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          {post.visibility === "SHARED" && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                🔗 이 게시글은 <strong>특정 사용자에게만 공유</strong>된 상태입니다.
                {isAuthor && <> "공유 관리" 버튼을 클릭하여 공유 대상을 관리할 수 있습니다.</>}
              </p>
            </div>
          )}

          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-gray-700">{post.content}</p>
          </div>
        </div>

        {/* 댓글 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            댓글 ({post.comments.length})
          </h2>

          <form onSubmit={handleCommentSubmit} className="mb-6">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 text-gray-900"
              placeholder="댓글을 입력하세요"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {submitting ? "작성 중..." : "댓글 작성"}
              </button>
            </div>
          </form>

          <div className="space-y-4">
            {post.comments.length === 0 ? (
              <p className="text-center text-gray-500 py-4">첫 댓글을 작성해보세요</p>
            ) : (
              post.comments.map((c) => (
                <div key={c.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{c.user.name}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-gray-700">{c.content}</p>
                    </div>
                    {c.user.id === session.user.id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-red-500 hover:text-red-700 text-sm ml-4 flex-shrink-0"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {shareModalOpen && (
        <PostShareModal
          postId={postId}
          postTitle={post.title}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  );
}
