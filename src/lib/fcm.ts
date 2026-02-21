import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK 초기화 (싱글톤 패턴)
 */
function initFirebase() {
  if (admin.apps.length > 0) return true;

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountVar) {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY 미설정");
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
    console.error("❌ Firebase 초기화 에러:", error.message);
    return false;
  }
}

/**
 * 핵심 푸시 전송 로직
 */
export async function sendPushNotification(
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (!initFirebase()) return { success: false, error: "Initialization failed" };

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
          requireInteraction: payload.data?.type === "call_request",
        },
        fcmOptions: {
          link: payload.data?.click_action || "/chat",
        },
      },
      android: { 
        priority: "high",
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK"
        }
      },
      apns: { 
        payload: { 
          aps: { 
            sound: "default", 
            badge: 1,
            contentAvailable: true 
          } 
        } 
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error: any) {
    console.error("FCM Send Error:", error);
    return { success: false, error: error.code || error.message };
  }
}

/**
 * 통화 요청 알림 전송 (추가된 부분)
 */
export async function sendCallNotification(
  token: string, 
  senderName: string, 
  callType: string, 
  callId: string, 
  chatRoomId: string
) {
  const isVideo = callType === "VIDEO";
  return sendPushNotification(token, {
    title: `📞 ${senderName}님으로부터 통화 요청`,
    body: `${isVideo ? "영상 통화" : "음성 통화"} 요청이 왔습니다.`,
    data: {
      type: "call_request",
      callId,
      chatRoomId,
      callType,
      click_action: `/chat/${chatRoomId}?callId=${callId}`
    },
  });
}

/**
 * 채팅 메시지 알림 전송
 */
export async function sendChatMessageNotification(token: string, senderName: string, content: string, chatRoomId: string) {
  return sendPushNotification(token, {
    title: senderName,
    body: content || "새 메시지가 도착했습니다.",
    data: { 
      type: "chat_message", 
      chatRoomId, 
      click_action: `/chat/${chatRoomId}` 
    },
  });
}

/**
 * 파일 공유 알림 전송
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

export { admin };