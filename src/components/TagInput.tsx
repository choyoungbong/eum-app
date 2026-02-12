"use client";

import { useState, useEffect } from "react";

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface TagInputProps {
  resourceId: string;
  resourceType: "file" | "post";
  onTagsChange?: () => void;
}

export default function TagInput({
  resourceId,
  resourceType,
  onTagsChange,
}: TagInputProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTags();
    fetchAllTags();
  }, [resourceId]);

  // 현재 태그 조회
  const fetchTags = async () => {
    try {
      const res = await fetch(`/api/${resourceType}s/${resourceId}/tags`);
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  };

  // 전체 태그 목록 조회
  const fetchAllTags = async () => {
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to fetch all tags:", err);
    }
  };

  // 태그 추가
  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/${resourceType}s/${resourceId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagName: tagName.trim() }),
      });

      if (res.ok) {
        await fetchTags();
        setInputValue("");
        setSuggestions([]);
        onTagsChange?.();
      } else {
        const data = await res.json();
        alert(data.error || "태그 추가 실패");
      }
    } catch (err) {
      alert("태그 추가 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 태그 제거
  const handleRemoveTag = async (tagId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/${resourceType}s/${resourceId}/tags?tagId=${tagId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchTags();
        onTagsChange?.();
      } else {
        alert("태그 제거 실패");
      }
    } catch (err) {
      alert("태그 제거 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 입력값 변경 시 자동완성
  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (value.trim()) {
      const filtered = allTags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(value.toLowerCase()) &&
          !tags.some((t) => t.id === tag.id)
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  // Enter로 태그 추가
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  return (
    <div className="space-y-3">
      {/* 현재 태그 */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
          >
            #{tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              disabled={loading}
              className="hover:text-blue-900 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* 태그 입력 */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="태그 입력 후 Enter"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />

        {/* 자동완성 */}
        {suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  handleAddTag(tag.name);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
