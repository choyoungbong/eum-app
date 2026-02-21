import * as admin from "firebase-admin";

let firebaseInitialized = false;

function initFirebase() {
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountVar) {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY 가 환경변수에 설정되지 않았습니다.");
    return false;
  }

  try {
    let configStr = serviceAccountVar.trim();
    
    if (configStr.startsWith("'") && configStr.endsWith("'")) {
      configStr = configStr.slice(1, -1);
    } else if (configStr.startsWith('"') && configStr.endsWith('"')) {
      configStr = configStr.slice(1, -1);
    }

    const serviceAccount = JSON.parse(configStr);

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log("✅ Firebase Admin 초기화 성공!");
    return true;
  } catch (error: any) {
    console.error("❌ Firebase 초기화 실패:", error.message);
    return false;
  }
}

// 초기화 실행
initFirebase();

/**
 * 기본 푸시 알림 전송 함수 (개선됨)
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  // 매번 전송 전 초기화 상태 확인
  if (!firebaseInitialized && !initFirebase()) {
    console.error("❌ 알림 발송 실패: Firebase가 초기화되지 않았습니다.");
    return { success: false };
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      // 1. 공통 알림 설정
      notification: { 
        title: payload.title, 
        body: payload.body 
      },
      // 2. 데이터 페이로드 (Service Worker에서 읽음)
      data: payload.data || {},
      // 3. Android 설정
      android: { 
        priority: "high", 
        notification: { sound: "default", clickAction: "FLUTTER_NOTIFICATION_CLICK" } 
      },
      // 4. iOS 설정
      apns: { 
        payload: { aps: { sound: "default", badge: 1 } } 
      },
      // 5. 웹 푸시 설정 (중요: 웹 브라우저에서의 동작 최적화)
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
          requireInteraction: payload.data?.type === "call_request", // 통화는 수동으로 닫을 때까지 유지
        },
        fcmOptions: {
          // 웹 푸시 클릭 시 이동할 URL (상대 경로가 아닌 전체 URL 권장되나 환경에 따라 조절)
          link: payload.data?.click_action || "/chat",
        },
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error: any) {
    // 만약 토큰이 유효하지 않다면 (사용자가 로그아웃했거나 앱 삭제) 에러 로그 출력
    if (error.code === 'messaging/registration-token-not-registered') {
      console.warn("⚠️ 유효하지 않은 FCM 토큰입니다. DB에서 제거가 필요할 수 있습니다.");
    }
    console.error("❌ 푸시 알림 발송 에러:", error);
    return { success: false, error };
  }
}

/**
 * 채팅 메시지 알림
 */
export async function sendChatMessageNotification(token: string, senderName: string, content: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: senderName,
    body: (content && content.length > 50) ? content.slice(0, 50) + "..." : content || "새 메시지가 도착했습니다.",
    data: { 
      type: "chat_message", 
      chatRoomId, 
      click_action: `/chat/${chatRoomId}` 
    },
  });
}

/**
 * 파일 공유 알림
 */
export async function sendFileSharedNotification(token: string, senderName: string, fileName: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: `📎 ${senderName}님의 파일 공유`,
    body: fileName,
    data: { 
      type: "file_shared", 
      chatRoomId, 
      click_action: `/chat/${chatRoomId}` 
    },
  });
}

/**
 * 통화 알림 함수
 */
export async function sendCallNotification(
  token: string, 
  callerName: string, 
  callType: "VOICE" | "VIDEO", 
  callId: string
) {
  const typeText = callType === "VOICE" ? "음성 통화" : "영상 통화";
  return sendPushNotification(token, {
    title: `📞 ${typeText} 요청`,
    body: `${callerName}님이 ${typeText}를 요청했습니다.`,
    data: { 
      type: "call_request", 
      callId, 
      callType, 
      click_action: `/call/${callId}` 
    },
  });
}

export { admin };