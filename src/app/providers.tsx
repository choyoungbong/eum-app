"use client";
// src/app/providers.tsx — ✅ 개선판
// - FCM 토큰 등록 추가 (푸시 알림 수신을 위해 필수)
// - 소켓 싱글톤 통합 (socket-client.ts → hooks/useSocket.ts 공유)

import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/Toast";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OnboardingTour from "@/components/OnboardingTour";
import MobileBottomNav from "@/components/MobileBottomNav";
import SystemNoticeBanner from "@/components/SystemNoticeBanner";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { useSocketConnection, useSocketNotifications } from "@/lib/socket-client";
import { useCallback, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { sound } from "@/lib/sound";

// ── FCM 등록 브릿지 ──────────────────────────────────────
// 로그인한 경우에만 FCM 토큰을 요청/등록합니다
function FCMBridge() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (typeof window === "undefined") return;

    // 알림 권한이 이미 허용된 경우에만 자동 등록
    // (아직 denied/default인 경우 사용자 행동 후 별도 처리)
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

  // 개발 환경에서 연결 상태 표시 (선택 사항)
  if (process.env.NODE_ENV === "development" && !connected) {
    // 콘솔에만 표시, UI에는 노출 안 함
  }

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
          <KeyboardShortcuts />
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
