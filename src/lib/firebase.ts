import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 앱 초기화 (서버 사이드 에러 방지)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let messaging: Messaging | null = null;

/**
 * 메시징 객체 초기화
 */
export const getFirebaseMessaging = () => {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    if (!messaging) {
      try {
        messaging = getMessaging(app);
      } catch (error) {
        console.error("Firebase Messaging 초기화 실패:", error);
      }
    }
  }
  return messaging;
};

/**
 * FCM 토큰 요청
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;

    // 1. 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("⚠️ 알림 권한이 거부되었습니다.");
      return null;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) return null;

    // 2. 서비스 워커 등록 확인 (매우 중요)
    // 브라우저가 sw.js를 찾지 못하면 getToken이 무한 대기하거나 에러가 납니다.
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // 3. FCM 토큰 가져오기
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration, // 명시적으로 등록된 SW 전달
    });

    if (token) {
      return token;
    } else {
      console.error("❌ FCM 토큰을 가져올 수 없습니다. VAPID Key를 확인하세요.");
      return null;
    }
  } catch (error) {
    console.error("FCM 토큰 요청 실패:", error);
    return null;
  }
}

/**
 * 포그라운드 메시지 수신 리스너 (앱을 켜놓고 있을 때)
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};

  // 브라우저 탭이 활성화된 상태에서 푸시가 오면 이 로직이 실행됩니다.
  return onMessage(messaging, (payload) => {
    console.log("📬 포그라운드 메시지 수신:", payload);
    callback(payload);
  });
}

/**
 * FCM 토큰 서버 등록
 */
export async function registerFCMToken() {
  const token = await requestNotificationPermission();
  
  if (token) {
    try {
      const res = await fetch("/api/users/fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcmToken: token }),
      });

      if (res.ok) {
        console.log("✅ FCM 토큰 서버 등록 성공");
        return true;
      }
    } catch (error) {
      console.error("FCM 토큰 서버 전송 오류:", error);
    }
  }
  return false;
}

/**
 * FCM 토큰 삭제
 */
export async function unregisterFCMToken() {
  try {
    const res = await fetch("/api/users/fcm-token", {
      method: "DELETE",
    });
    return res.ok;
  } catch (error) {
    console.error("FCM 토큰 삭제 오류:", error);
    return false;
  }
}