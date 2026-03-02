"use client";
// src/app/providers.tsx

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/Toast";
import OnboardingTour from "@/components/OnboardingTour";
import MobileBottomNav from "@/components/MobileBottomNav";
import SystemNoticeBanner from "@/components/SystemNoticeBanner";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useSocketConnection, useSocketNotifications } from "@/lib/socket-client";
import { useCallback, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { sound } from "@/lib/sound";

// ── FCM 등록 브릿지 ──────────────────────────────────────
function FCMBridge() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (typeof window === "undefined") return;
    if (Notification.permission === "granted") {
      import("@/lib/firebase")
        .then(({ registerFCMToken }) => registerFCMToken())
        .catch((e) => console.error("FCM 초기화 실패:", e));
    }
  }, [status, session?.user]);

  return null;
}

// ── 소켓 알림 브릿지 ─────────────────────────────────────
function SocketBridge() {
  const connected = useSocketConnection();
  const { addToast } = useToast();

  const onNotification = useCallback(
    (n: { type: string; message: string }) => {
      sound.notification();
      addToast("info", n.message);
    },
    [addToast]
  );

  useSocketNotifications(onNotification);
  return null;
}

// ── 최상위 Providers ──────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider>
          <SocketBridge />
          <FCMBridge />
          <SystemNoticeBanner />
          {children}
          <UploadProgressOverlay />
          <MobileBottomNav />
          <OnboardingTour />
          {/* KeyboardShortcuts 제거 — e.key undefined 에러 원인 */}
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
