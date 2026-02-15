import * as admin from "firebase-admin";

// Firebase 초기화 상태
let firebaseInitialized = false;

function initFirebase() {
  // 이미 초기화됐으면 스킵
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  // 환경 변수 없으면 스킵 (개발 환경)
  let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey || serviceAccountKey.trim() === "") {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT_KEY 없음 - 푸시 알림 비활성화");
    return false;
  }

  try {
    // 1. 혹시 문자열이 이중 따옴표로 감싸져 있는 경우 처리
    if (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')) {
      serviceAccountKey = JSON.parse(serviceAccountKey);
    }

    // 2. JSON 파싱
    const serviceAccount = typeof serviceAccountKey === 'string' 
      ? JSON.parse(serviceAccountKey) 
      : serviceAccountKey;

    // 3. Private Key의 줄바꿈 문자(\n)를 실제 줄바꿈으로 치환 (에러 해결의 핵심)
    if (serviceAccount && serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log("✅ Firebase Admin 초기화 완료");
    return true;
  } catch (error) {
    console.error("❌ Firebase 초기화 실패 (JSON 파싱 오류):", error);
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY 형식을 확인하세요");
    return false;
  }
}

// 앱 시작 시 초기화 시도
initFirebase();

// ========== 푸시 알림 전송 함수들 ==========

/**
 * 단일 사용자에게 푸시 알림 전송
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
): Promise<{ success: boolean; messageId?: string; error?: any }> {
  // Firebase 미설정 시 조용히 스킵
  if (!firebaseInitialized || admin.apps.length === 0) {
    console.log("📵 Firebase 미설정 - 푸시 알림 스킵:", payload.title);
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "personal_cloud",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error: any) {
    // 토큰 만료/유효하지 않은 경우
    if (
      error.code === "messaging/registration-token-not-registered" ||
      error.code === "messaging/invalid-registration-token"
    ) {
      console.warn("⚠️  FCM 토큰 만료:", fcmToken.slice(0, 20) + "...");
    } else {
      console.error("❌ 푸시 알림 전송 실패:", error);
    }
    return { success: false, error };
  }
}

/**
 * 여러 사용자에게 푸시 알림 전송
 */
export async function sendMulticastNotification(
  fcmTokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
): Promise<{ success: boolean; successCount?: number; failureCount?: number }> {
  if (!firebaseInitialized || admin.apps.length === 0) {
    return { success: false };
  }

  if (fcmTokens.length === 0) return { success: true, successCount: 0, failureCount: 0 };

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "personal_cloud",
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("❌ 멀티캐스트 알림 실패:", error);
    return { success: false };
  }
}

/**
 * 채팅 메시지 알림
 */
export async function sendChatMessageNotification(
  recipientFcmToken: string,
  senderName: string,
  messageContent: string,
  chatRoomId: string
): Promise<void> {
  await sendPushNotification(recipientFcmToken, {
    title: senderName,
    body:
      messageContent.length > 50
        ? messageContent.slice(0, 50) + "..."
        : messageContent,
    data: {
      type: "chat_message",
      chatRoomId,
      click_action: `/chat/${chatRoomId}`,
    },
  });
}

/**
 * 통화 요청 알림
 */
export async function sendCallNotification(
  recipientFcmToken: string,
  callerName: string,
  callType: "VOICE" | "VIDEO",
  callId: string,
  chatRoomId: string
): Promise<void> {
  const title = callType === "VOICE" ? "📞 음성 통화" : "🎥 영상 통화";
  const body = `${callerName}님이 ${callType === "VOICE" ? "음성" : "영상"} 통화를 요청했습니다`;

  await sendPushNotification(recipientFcmToken, {
    title,
    body,
    data: {
      type: "call_request",
      callId,
      chatRoomId,
      callType,
      click_action: `/call/${callId}`,
    },
  });
}

/**
 * 파일 공유 알림
 */
export async function sendFileSharedNotification(
  recipientFcmToken: string,
  senderName: string,
  fileName: string,
  chatRoomId: string
): Promise<void> {
  await sendPushNotification(recipientFcmToken, {
    title: `📎 ${senderName}님이 파일을 공유했습니다`,
    body: fileName,
    data: {
      type: "file_shared",
      chatRoomId,
      click_action: `/chat/${chatRoomId}`,
    },
  });
}