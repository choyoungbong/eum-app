"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

interface ThemeToggleProps {
  /** 'icon' = 아이콘만, 'full' = 아이콘 + 라벨 드롭다운 */
  variant?: "icon" | "full";
  className?: string;
}

export default function ThemeToggle({ variant = "icon", className = "" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // SSR hydration mismatch 방지
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  // 단순 아이콘 토글 (light ↔ dark)
  if (variant === "icon") {
    const isDark = resolvedTheme === "dark";
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={`relative w-9 h-9 flex items-center justify-center rounded-lg 
          hover:bg-slate-100 dark:hover:bg-slate-700 
          text-slate-500 dark:text-slate-400
          transition-colors ${className}`}
        title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
        aria-label="테마 전환"
      >
        {/* Sun – 다크일 때 보임 (클릭하면 라이트로) */}
        <Sun
          size={18}
          className={`absolute transition-all duration-300 ${
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75"
          }`}
        />
        {/* Moon – 라이트일 때 보임 (클릭하면 다크로) */}
        <Moon
          size={18}
          className={`absolute transition-all duration-300 ${
            !isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
          }`}
        />
      </button>
    );
  }

  // 풀 드롭다운 (light / dark / system)
  const options = [
    { value: "light", label: "라이트", icon: Sun },
    { value: "dark",  label: "다크",   icon: Moon },
    { value: "system",label: "시스템", icon: Monitor },
  ] as const;

  return (
    <div className={`flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 ${className}`}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            theme === value
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
