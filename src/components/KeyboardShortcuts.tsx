"use client";
// src/components/KeyboardShortcuts.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
  action: () => void;
}

// ── 단축키 훅 ────────────────────────────────────────────
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ✅ 최우선 방어: e.key가 string이 아니면 즉시 종료 (IME, 특수키 등)
      if (!e || typeof e.key !== "string" || e.key === "") return;

      try {
        const tag = (e.target as HTMLElement)?.tagName ?? "";
        const isEditing =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          !!(e.target as HTMLElement)?.isContentEditable;

        const eKeyLower = e.key.toLowerCase();

        for (const shortcut of shortcuts) {
          if (!shortcut || !Array.isArray(shortcut.keys)) continue;

          // ✅ for...of로 순회하며 string만 추출 (find/map/filter 체인 제거)
          const keys: string[] = [];
          for (const k of shortcut.keys) {
            if (typeof k === "string" && k.length > 0) {
              keys.push(k.toLowerCase());
            }
          }
          if (keys.length === 0) continue;

          const needCtrl  = keys.includes("ctrl");
          const needShift = keys.includes("shift");
          const needAlt   = keys.includes("alt");

          const hasCtrl  = needCtrl  ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
          const hasShift = needShift ? e.shiftKey : !e.shiftKey;
          const hasAlt   = needAlt   ? e.altKey   : !e.altKey;

          // ✅ 수식키 제외한 메인 키를 for...of로 추출
          let main: string | undefined;
          for (const k of keys) {
            if (k !== "ctrl" && k !== "shift" && k !== "alt" && k !== "meta") {
              main = k;
              break;
            }
          }
          if (!main) continue;

          if (hasCtrl && hasShift && hasAlt && eKeyLower === main) {
            const isGlobal = needCtrl && !needShift;
            if (isEditing && !isGlobal) continue;
            e.preventDefault();
            shortcut.action();
            break;
          }
        }
      } catch {
        // 단축키 처리 중 오류는 앱에 영향을 주지 않도록 무시
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

// ── 단축키 팔레트 UI ─────────────────────────────────────
function ShortcutPalette({ onClose }: { onClose: () => void }) {
  const GROUPS = [
    {
      title: "탐색",
      shortcuts: [
        { keys: ["G", "D"], desc: "대시보드" },
        { keys: ["G", "P"], desc: "프로필" },
        { keys: ["G", "N"], desc: "알림" },
        { keys: ["G", "C"], desc: "채팅" },
        { keys: ["G", "S"], desc: "검색" },
        { keys: ["G", "T"], desc: "휴지통" },
      ],
    },
    {
      title: "파일",
      shortcuts: [
        { keys: ["U"], desc: "파일 업로드" },
        { keys: ["N"], desc: "새 폴더" },
        { keys: ["Del"], desc: "선택 삭제" },
      ],
    },
    {
      title: "전역",
      shortcuts: [
        { keys: ["Ctrl", "K"], desc: "단축키 보기" },
        { keys: ["Ctrl", "/"], desc: "검색" },
        { keys: ["?"], desc: "도움말" },
        { keys: ["Esc"], desc: "닫기 / 취소" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
          <Keyboard size={18} className="text-gray-600 dark:text-slate-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            키보드 단축키
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.shortcuts.map(({ keys, desc }) => (
                  <div key={desc} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-700 dark:text-slate-300">{desc}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <span key={i}>
                          <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded border border-gray-200 dark:border-slate-600">
                            {k}
                          </kbd>
                          {i < keys.length - 1 && (
                            <span className="text-gray-400 mx-0.5 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 전역 단축키 컴포넌트 ─────────────────────────────────
export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showPalette, setShowPalette] = useState(false);

  const shortcuts: Shortcut[] = [
    { keys: ["ctrl", "k"], description: "단축키 보기",   action: () => setShowPalette((v) => !v) },
    { keys: ["ctrl", "/"], description: "검색",          action: () => router.push("/search") },
    { keys: ["?"],         description: "단축키 도움말", action: () => setShowPalette(true) },
  ];

  useKeyboardShortcuts(shortcuts);

  // G + 다음 키 시퀀스
  useEffect(() => {
    let gPressed = false;
    let gTimer: NodeJS.Timeout;

    const handler = (e: KeyboardEvent) => {
      if (!e || typeof e.key !== "string") return;
      try {
        const tag = (e.target as HTMLElement)?.tagName ?? "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        if (e.key === "g" || e.key === "G") {
          gPressed = true;
          clearTimeout(gTimer);
          gTimer = setTimeout(() => { gPressed = false; }, 1000);
          return;
        }

        if (gPressed) {
          const map: Record<string, string> = {
            d: "/dashboard", D: "/dashboard",
            p: "/profile",   P: "/profile",
            n: "/notifications", N: "/notifications",
            c: "/chat",      C: "/chat",
            s: "/search",    S: "/search",
            t: "/trash",     T: "/trash",
          };
          if (map[e.key]) {
            e.preventDefault();
            router.push(map[e.key]);
          }
          gPressed = false;
          clearTimeout(gTimer);
        }
      } catch {
        // 무시
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearTimeout(gTimer);
    };
  }, [router]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e?.key === "Escape") setShowPalette(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return showPalette ? (
    <ShortcutPalette onClose={() => setShowPalette(false)} />
  ) : null;
}
