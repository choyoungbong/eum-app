"use client";

import { useState } from "react";
import { toast } from "@/components/Toast";

interface FolderCreateModalProps {
  parentId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FolderCreateModal({ parentId, onClose, onSuccess }: FolderCreateModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("폴더 이름을 입력하세요"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "폴더 생성 실패");
        return;
      }
      // ✅ alert() → toast
      toast.success("폴더가 생성되었습니다");
      onSuccess();
      onClose();
    } catch {
      setError("폴더 생성 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">새 폴더 만들기</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="폴더 이름을 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-gray-900"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "폴더 만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
