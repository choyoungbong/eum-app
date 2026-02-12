// Firebase Client SDK 설정
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 앱 초기화
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;

// 메시징 초기화 (브라우저에서만)
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
    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    
    if (permission !== "granted") {
      console.log("알림 권한이 거부되었습니다");
      return null;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.error("Firebase Messaging을 사용할 수 없습니다");
      return null;
    }

    // FCM 토큰 가져오기
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (token) {
      console.log("✅ FCM 토큰:", token);
      return token;
    } else {
      console.log("FCM 토큰을 가져올 수 없습니다");
      return null;
    }
  } catch (error) {
    console.error("FCM 토큰 요청 실패:", error);
    return null;
  }
}

/**
 * 포그라운드 메시지 수신 리스너
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log("📬 포그라운드 메시지:", payload);
    callback(payload);
  });
}

/**
 * FCM 토큰 서버에 등록
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
        console.log("✅ FCM 토큰이 서버에 등록되었습니다");
        return true;
      } else {
        console.error("FCM 토큰 등록 실패");
        return false;
      }
    } catch (error) {
      console.error("FCM 토큰 등록 중 오류:", error);
      return false;
    }
  }

  return false;
}

/**
 * FCM 토큰 서버에서 삭제
 */
export async function unregisterFCMToken() {
  try {
    const res = await fetch("/api/users/fcm-token", {
      method: "DELETE",
    });

    if (res.ok) {
      console.log("✅ FCM 토큰이 서버에서 삭제되었습니다");
      return true;
    }
  } catch (error) {
    console.error("FCM 토큰 삭제 중 오류:", error);
  }

  return false;
}