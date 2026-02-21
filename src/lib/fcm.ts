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
    // 1. JSON 파싱 전처리 (Railway/Docker 환경 대응)
    let configStr = serviceAccountVar.trim();
    
    // 따옴표로 감싸진 경우 제거 (환경변수 주입 방식에 따라 필요할 수 있음)
    if (configStr.startsWith("'") && configStr.endsWith("'")) {
      configStr = configStr.slice(1, -1);
    } else if (configStr.startsWith('"') && configStr.endsWith('"')) {
      configStr = configStr.slice(1, -1);
    }

    const serviceAccount = JSON.parse(configStr);

    // 2. private_key 내의 \n 문자열을 실제 줄바꿈으로 치환
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
 * 기본 푸시 알림 전송 함수
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (!firebaseInitialized || admin.apps.length === 0) {
    console.error("❌ 알림 발송 실패: Firebase가 초기화되지 않았습니다.");
    return { success: false };
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    };
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
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
    body: content && content.length > 50 ? content.slice(0, 50) + "..." : content || "새 메시지가 도착했습니다.",
    data: { type: "chat_message", chatRoomId, click_action: `/chat/${chatRoomId}` },
  });
}

/**
 * 파일 공유 알림
 */
export async function sendFileSharedNotification(token: string, senderName: string, fileName: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: `📎 ${senderName}님의 파일 공유`,
    body: fileName,
    data: { type: "file_shared", chatRoomId, click_action: `/chat/${chatRoomId}` },
  });
}

/**
 * ✅ [빌드 에러 해결] 통화 알림 함수 추가
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