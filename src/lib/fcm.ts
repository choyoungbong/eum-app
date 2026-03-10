import * as admin from "firebase-admin";
import { prisma } from "@/lib/db";

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
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firebase Admin 초기화 성공!");
    return true;
  } catch (error: any) {
    console.error("❌ Firebase 초기화 에러:", error.message);
    return false;
  }
}

// ✅ 단일 토큰 전송 (기존 유지)
export async function sendPushNotification(
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (!initFirebase()) return { success: false, error: "Initialization failed" };
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
          requireInteraction: payload.data?.type === "call_request",
        },
        fcmOptions: { link: payload.data?.click_action || "/chat" },
      },
      android: {
        priority: "high",
        notification: { sound: "default", clickAction: "FLUTTER_NOTIFICATION_CLICK" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1, contentAvailable: true } },
      },
    };
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error: any) {
    return { success: false, error: error.code || error.message };
  }
}

// ✅ 멀티 디바이스 전송 — userId 기준으로 모든 토큰에 전송
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (!initFirebase()) return { success: false, error: "Initialization failed" };

  const tokenRecords = await prisma.userFcmToken.findMany({
    where: { userId },
    select: { id: true, token: true },
  });

  if (tokenRecords.length === 0) {
    return { success: false, error: "No FCM tokens found" };
  }

  const tokens = tokenRecords.map((r) => r.token);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "/icon-192x192.png",
          badge: "/badge-72x72.png",
          requireInteraction: payload.data?.type === "call_request",
        },
        fcmOptions: { link: payload.data?.click_action || "/chat" },
      },
      android: {
        priority: "high",
        notification: { sound: "default" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1, contentAvailable: true } },
      },
    });

    // ✅ 만료/유효하지 않은 토큰 자동 정리
    const expiredIds: string[] = [];
    response.responses.forEach((res, idx) => {
      if (
        !res.success &&
        (res.error?.code === "messaging/registration-token-not-registered" ||
          res.error?.code === "messaging/invalid-registration-token")
      ) {
        expiredIds.push(tokenRecords[idx].id);
      }
    });

    if (expiredIds.length > 0) {
      await prisma.userFcmToken.deleteMany({
        where: { id: { in: expiredIds } },
      });
      console.log(`🧹 만료된 FCM 토큰 ${expiredIds.length}개 삭제`);
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error: any) {
    console.error("FCM multicast error:", error);
    return { success: false, error: error.message };
  }
}

// ✅ 통화 알림 — sendPushToUser로 교체
export async function sendCallNotification(
  userId: string, // ← token 대신 userId로 변경
  senderName: string,
  callType: string,
  callId: string,
  chatRoomId: string
) {
  const isVideo = callType === "VIDEO";
  return sendPushToUser(userId, {
    title: `📞 ${senderName}님으로부터 통화 요청`,
    body: `${isVideo ? "영상 통화" : "음성 통화"} 요청이 왔습니다.`,
    data: {
      type: "call_request",
      callId,
      chatRoomId,
      callType,
      click_action: `/chat/${chatRoomId}?callId=${callId}`,
    },
  });
}

export async function sendChatMessageNotification(
  userId: string, // ← token 대신 userId로 변경
  senderName: string,
  content: string,
  chatRoomId: string
) {
  return sendPushToUser(userId, {
    title: senderName,
    body: content || "새 메시지가 도착했습니다.",
    data: { type: "chat_message", chatRoomId, click_action: `/chat/${chatRoomId}` },
  });
}

export async function sendFileSharedNotification(
  userId: string, // ← token 대신 userId로 변경
  senderName: string,
  fileName: string,
  chatRoomId: string
) {
  return sendPushToUser(userId, {
    title: `📎 ${senderName}님의 파일 공유`,
    body: fileName,
    data: { type: "file_shared", chatRoomId, click_action: `/chat/${chatRoomId}` },
  });
}

export { admin };
