"use client";

import { useState, useEffect } from "react";

interface Share {
  id: string;
  sharedWith: {
    id: string;
    email: string;
    name: string;
  };
  permission: string;
  createdAt: string;
}

interface FileShareModalProps {
  fileId: string | null;
  fileName: string;
  onClose: () => void;
}

export default function FileShareModal({ fileId, fileName, onClose }: FileShareModalProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("VIEW");
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 공유 목록 불러오기
  useEffect(() => {
    if (fileId) {
      fetchShares();
    }
  }, [fileId]);

  const fetchShares = async () => {
    if (!fileId) return;

    try {
      const res = await fetch(`/api/files/${fileId}/share`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares);
      }
    } catch (err) {
      console.error("Failed to fetch shares:", err);
    }
  };

  // 공유 추가
  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileId || !email) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/files/${fileId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithEmail: email, permission }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "공유 실패");
        setLoading(false);
        return;
      }

      alert("파일이 공유되었습니다!");
      setEmail("");
      fetchShares();
    } catch (err) {
      setError("공유 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 공유 삭제
  const handleDeleteShare = async (shareId: string) => {
    if (!fileId || !confirm("공유를 취소하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/files/${fileId}/share?shareId=${shareId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("공유가 취소되었습니다");
        fetchShares();
      } else {
        alert("공유 취소 실패");
      }
    } catch (err) {
      alert("오류가 발생했습니다");
    }
  };

  if (!fileId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            파일 공유: {fileName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* 공유 추가 폼 */}
          <form onSubmit={handleShare} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              공유할 사용자 이메일
            </label>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="VIEW">보기</option>
                <option value="EDIT">편집</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "공유 중..." : "공유하기"}
            </button>
          </form>

          {/* 공유 목록 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              공유 중인 사용자 ({shares.length})
            </h4>

            {shares.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                아직 공유된 사용자가 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {share.sharedWith.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {share.sharedWith.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                        {share.permission === "VIEW" ? "보기" : "편집"}
                      </span>
                      <button
                        onClick={() => handleDeleteShare(share.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}