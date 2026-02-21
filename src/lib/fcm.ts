import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK 초기화 (중복 초기화 방지)
 */
function initFirebase() {
  // 이미 앱이 초기화되어 있다면 추가 실행 안 함
  if (admin.apps.length > 0) return true;

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountVar) {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.");
    return false;
  }

  try {
    let configStr = serviceAccountVar.trim();
    if (configStr.startsWith("'") && configStr.endsWith("'")) configStr = configStr.slice(1, -1);
    if (configStr.startsWith('"') && configStr.endsWith('"')) configStr = configStr.slice(1, -1);

    const serviceAccount = JSON.parse(configStr);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin 초기화 성공!");
    return true;
  } catch (error: any) {
    console.error("❌ Firebase 초기화 실패:", error.message);
    return false;
  }
}

/**
 * 기본 푸시 알림 전송 함수 (중복 발송 최적화)
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (!initFirebase()) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      // [중복 방지 핵심] notification 필드를 제거하고 webpush 설정에 집중하거나, 
      // 혹은 notification만 사용하고 webpush 내부의 notification은 생략하는 것이 좋습니다.
      // 여기서는 '웹 푸시' 환경에 최적화하여 notification은 공통으로 두고 webpush 전용 설정을 분리합니다.
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
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
      webpush: {
        headers: {
          Urgency: "high",
        },
        // webpush 내부의 notification 필드가 공통 notification과 충돌할 수 있으므로 
        // 필요한 옵션(icon, badge 등)만 정의합니다.
        notification: {
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
          requireInteraction: payload.data?.type === "call_request",
        },
        fcmOptions: {
          link: payload.data?.click_action || "/chat",
        },
      },
    };

    const response = await admin.messaging().send(message);
    
    // 로그가 2번 찍히는 것을 방지하기 위해 여기서 한 번만 찍습니다.
    console.log(`✅ 푸시 알림 전송 성공 [대상: ${payload.title}]`);
    return { success: true, messageId: response };
  } catch (error: any) {
    if (error.code === 'messaging/registration-token-not-registered') {
      console.warn("⚠️ 유효하지 않은 FCM 토큰입니다.");
    }
    console.error("❌ 푸시 알림 발송 에러:", error.message);
    return { success: false, error };
  }
}

/**
 * 채팅/파일/통화 알림 함수들
 */
export async function sendChatMessageNotification(token: string, senderName: string, content: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: senderName,
    body: (content && content.length > 50) ? content.slice(0, 50) + "..." : content || "새 메시지가 도착했습니다.",
    data: { type: "chat_message", chatRoomId, click_action: `/chat/${chatRoomId}` },
  });
}

export async function sendFileSharedNotification(token: string, senderName: string, fileName: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: `📎 ${senderName}님의 파일 공유`,
    body: fileName,
    data: { type: "file_shared", chatRoomId, click_action: `/chat/${chatRoomId}` },
  });
}

export async function sendCallNotification(token: string, callerName: string, callType: "VOICE" | "VIDEO", callId: string) {
  const typeText = callType === "VOICE" ? "음성 통화" : "영상 통화";
  return sendPushNotification(token, {
    title: `📞 ${typeText} 요청`,
    body: `${callerName}님이 ${typeText}를 요청했습니다.`,
    data: { type: "call_request", callId, callType, click_action: `/call/${callId}` },
  });
}

export { admin };