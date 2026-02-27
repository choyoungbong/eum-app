"use client";
// src/app/providers.tsx — 최종 통합본 (소켓 포함)

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/Toast";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OnboardingTour from "@/components/OnboardingTour";
import MobileBottomNav from "@/components/MobileBottomNav";
import SystemNoticeBanner from "@/components/SystemNoticeBanner";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useSocketConnection, useSocketNotifications } from "@/lib/socket-client";
import { useCallback } from "react";
import { useToast } from "@/components/Toast";
import { sound } from "@/lib/sound";

// 소켓 알림 브릿지 (내부 컴포넌트)
function SocketBridge() {
  const connected = useSocketConnection();
  const { addToast } = useToast();

  const onNotification = useCallback((n: { type: string; message: string }) => {
    sound.notification();
    addToast("info", n.message);
  }, [addToast]);

  useSocketNotifications(onNotification);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider>
          <SocketBridge />
          <SystemNoticeBanner />
          {children}
          <UploadProgressOverlay />
          <MobileBottomNav />
          <OnboardingTour />
          <KeyboardShortcuts />
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
