"use client";
// src/components/MentionTextarea.tsx
// @유저명 자동완성이 있는 텍스트 입력창
// 댓글 작성, 채팅 메시지 입력에 사용

import { useState, useRef, useEffect, useCallback } from "react";

interface MentionUser {
  id: string;
  name: string;
  isOnline: boolean;
}

interface Props {
  value: string;
  onChange: (value: string, mentionedUserIds: string[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  onSubmit?: () => void;
}

// @이후 텍스트 추출
function getMentionQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match  = before.match(/@(\w*)$/);
  return match ? match[1] : null;
}

// 텍스트에서 @멘션된 사용자 ID 목록 추출
function extractMentionIds(text: string, resolvedMentions: Map<string, string>): string[] {
  const ids: string[] = [];
  const regex = /@(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const id = resolvedMentions.get(m[1]);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

export default function MentionTextarea({
  value, onChange, placeholder = "댓글을 입력하세요...",
  rows = 3, className = "", onSubmit,
}: Props) {
  const [suggestions, setSuggestions]   = useState<MentionUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const resolvedRef  = useRef(new Map<string, string>()); // name → userId
  const debounceRef  = useRef<NodeJS.Timeout>();

  const fetchSuggestions = useCallback(async (q: string) => {
    clearTimeout(debounceRef.current);
    if (!q && q !== "") { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/users/mention-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.users ?? []);
      setSelectedIdx(0);
    }, 200);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal    = e.target.value;
    const cursor    = e.target.selectionStart;
    const query     = getMentionQuery(newVal, cursor);

    if (query !== null) {
      setMentionStart(cursor - query.length - 1); // @ 위치
      setShowDropdown(true);
      fetchSuggestions(query);
    } else {
      setShowDropdown(false);
      setMentionStart(null);
    }

    const ids = extractMentionIds(newVal, resolvedRef.current);
    onChange(newVal, ids);
  };

  const selectUser = (user: MentionUser) => {
    if (mentionStart === null) return;
    const before  = value.slice(0, mentionStart);            // @ 이전
    const cursor  = textareaRef.current?.selectionStart ?? 0;
    const after   = value.slice(cursor);                      // 커서 이후
    const newVal  = `${before}@${user.name} ${after}`;

    resolvedRef.current.set(user.name, user.id);
    const ids = extractMentionIds(newVal, resolvedRef.current);
    onChange(newVal, ids);
    setShowDropdown(false);

    // 커서를 멘션 뒤로 이동
    requestAnimationFrame(() => {
      const pos = before.length + user.name.length + 2; // @name<space>
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectUser(suggestions[selectedIdx]); return; }
      if (e.key === "Escape")    { setShowDropdown(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // 텍스트 내 @멘션 하이라이트 렌더링 (미리보기용)
  const renderHighlighted = (text: string) =>
    text.replace(/@(\S+)/g, (m, name) =>
      resolvedRef.current.has(name)
        ? `<mark class="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded px-0.5">${m}</mark>`
        : m
    );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full resize-none rounded-xl border border-gray-200 dark:border-slate-600 
                    bg-white dark:bg-slate-700 dark:text-slate-100 px-4 py-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />

      {/* 자동완성 드롭다운 */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 bottom-full mb-1 left-0 right-0 max-h-48 overflow-y-auto
                        bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-xl">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); selectUser(u); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                i === selectedIdx
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-slate-700/50"
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {u.name[0]}
                </div>
                {u.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-slate-800" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{u.name}</span>
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">@{u.name}</span>
            </button>
          ))}
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center py-1.5 border-t border-gray-100 dark:border-slate-700">
            ↑↓ 선택 · Enter/Tab 확정 · Esc 닫기
          </p>
        </div>
      )}
    </div>
  );
}
