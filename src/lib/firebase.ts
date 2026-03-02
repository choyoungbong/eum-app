// src/lib/firebase.ts
// ✅ 개선판: Service Worker 무한루프 버그 수정
// - registration.ready 사용으로 SW 활성화 대기 (안전)
// - 에러 처리 강화

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 앱 초기화 (중복 방지)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let messaging: Messaging | null = null;

/**
 * 메시징 객체 초기화 (클라이언트 전용)
 */
export const getFirebaseMessaging = (): Messaging | null => {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error("Firebase Messaging 초기화 실패:", error);
      return null;
    }
  }
  return messaging;
};

/**
 * FCM 토큰 요청 및 알림 권한 획득
 * ✅ 수정: while 무한루프 → navigator.serviceWorker.ready 사용
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    if (!("Notification" in window)) {
      console.warn("⚠️ 이 브라우저는 알림을 지원하지 않습니다.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("⚠️ 알림 권한이 거부되었습니다.");
      return null;
    }

    const msg = getFirebaseMessaging();
    if (!msg) return null;

    // ✅ 수정: navigator.serviceWorker.ready를 사용해
    // SW가 활성화될 때까지 안전하게 대기 (타임아웃 포함)
    let registration: ServiceWorkerRegistration;
    try {
      // 먼저 SW 등록 시도
      registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

      // SW 활성화 대기 (최대 10초)
      const readyWithTimeout = Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("SW ready timeout")), 10000)
        ),
      ]);
      await readyWithTimeout;

      console.log("✅ 서비스 워커 활성화 확인됨");
    } catch (swError) {
      console.error("❌ 서비스 워커 등록/활성화 실패:", swError);
      // SW 없이 토큰 요청 시도
      try {
        const token = await getToken(msg, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });
        return token || null;
      } catch {
        return null;
      }
    }

    // 토큰 요청 (등록된 SW 전달)
    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("✅ FCM 토큰 생성 성공");
      return token;
    }

    console.warn("⚠️ FCM 토큰 발급 실패 (VAPID 키 또는 설정 확인)");
    return null;
  } catch (error) {
    console.error("❌ FCM 토큰 요청 실패:", error);
    return null;
  }
}

/**
 * 포그라운드 메시지 수신 리스너
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};

  return onMessage(msg, (payload) => {
    console.log("📬 포그라운드 메시지 수신:", payload);
    callback(payload);
  });
}

/**
 * FCM 토큰 서버 등록
 * ✅ 개선: 기존 토큰과 동일하면 재등록 스킵
 */
export async function registerFCMToken(): Promise<boolean> {
  const token = await requestNotificationPermission();
  if (!token) return false;

  // localStorage에 저장된 토큰과 같으면 재전송 불필요
  const lastToken = typeof window !== "undefined"
    ? localStorage.getItem("fcm_token")
    : null;
  if (lastToken === token) return true;

  try {
    const res = await fetch("/api/users/fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcmToken: token }),
    });

    if (res.ok) {
      console.log("✅ FCM 토큰 서버 등록 성공");
      if (typeof window !== "undefined") {
        localStorage.setItem("fcm_token", token);
      }
      return true;
    }
  } catch (error) {
    console.error("FCM 토큰 서버 전송 오류:", error);
  }
  return false;
}

/**
 * FCM 토큰 삭제
 */
export async function unregisterFCMToken(): Promise<boolean> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("fcm_token");
  }
  try {
    const res = await fetch("/api/users/fcm-token", { method: "DELETE" });
    return res.ok;
  } catch (error) {
    console.error("FCM 토큰 삭제 오류:", error);
    return false;
  }
}
