import * as admin from "firebase-admin";

let firebaseInitialized = false;

function initFirebase() {
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountVar) return false;

  try {
    // 1. JSON 파싱 (양끝 따옴표 제거 후 파싱)
    const configStr = serviceAccountVar.trim();
    const serviceAccount = JSON.parse(configStr);

    // 2. private_key 내의 \n 문자열을 실제 줄바꿈으로 치환 (가장 핵심)
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

initFirebase();

export async function sendPushNotification(
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  // ✅ 전역 변수 체크
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

export async function sendChatMessageNotification(token: string, senderName: string, content: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: senderName,
    body: content && content.length > 50 ? content.slice(0, 50) + "..." : content || "새 메시지가 도착했습니다.",
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

export { admin };