"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {/* 
        attribute="class" → html 태그에 'dark' 클래스 토글
        defaultTheme="system" → OS 설정 자동 감지
        enableSystem → 시스템 다크모드 지원
        storageKey="eum-theme" → localStorage 키
      */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="eum-theme"
      >
        {children}
        <KeyboardShortcuts />
      </ThemeProvider>
    </SessionProvider>
  );
}
