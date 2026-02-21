// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// ✅ 입력하신 Firebase 설정값 적용
const firebaseConfig = {
  apiKey: "AIzaSyDX5C589FJTRt7eSEEyBTYOhy3zOt61rww",
  authDomain: "personal-cloud-ca830.firebaseapp.com",
  projectId: "personal-cloud-ca830",
  storageBucket: "personal-cloud-ca830.firebasestorage.app",
  messagingSenderId: "531266228781",
  appId: "1:531266228781:web:7d2debc260ee30b1285ea4"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 메시지 수신
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] 백그라운드 메시지:', payload);

  const notificationTitle = payload.notification?.title || '새 메시지';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: payload.data,
    // 동일 채팅방 알림은 하나로 묶어 사용자 피로도를 줄임
    tag: payload.data?.chatRoomId || 'default',
    renotify: true,
    vibrate: [200, 100, 200],
  };

  // 통화 알림(incoming_call) 또는 호출 요청(call_request) 처리
  if (payload.data?.type === 'incoming_call' || payload.data?.type === 'call_request') {
    notificationOptions.requireInteraction = true; // 사용자가 응답할 때까지 유지
    notificationOptions.actions = [
      { action: 'accept', title: '✅ 수락' },
      { action: 'reject', title: '❌ 거절' },
    ];
    notificationOptions.vibrate = [500, 100, 500, 100, 500];
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;

  // 1. 통화 수락/거절 액션 버튼 처리
  if (event.action === 'accept') {
    const callUrl = `/call/${data.callId}?action=accept`;
    event.waitUntil(focusOrOpenWindow(callUrl));
    return;
  } 
  
  if (event.action === 'reject') {
    if (data.callId) {
      event.waitUntil(
        fetch('/api/calls/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: data.callId }),
        })
      );
    }
    return;
  }

  // 2. 일반 알림 클릭 시 이동 경로 설정
  let targetUrl = '/chat';
  if (data?.chatRoomId) {
    targetUrl = `/chat/${data.chatRoomId}`;
  } else if (data?.callId) {
    targetUrl = `/call/${data.callId}`;
  }

  event.waitUntil(focusOrOpenWindow(targetUrl));
});

/**
 * 중복 탭 방지: 이미 열린 창이 있으면 포커스, 없으면 새 창
 */
async function focusOrOpenWindow(url) {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  for (let client of windowClients) {
    // 상대 경로 포함 여부 확인
    if (client.url.includes(url) && 'focus' in client) {
      return client.focus();
    }
  }
  
  if (clients.openWindow) {
    return clients.openWindow(url);
  }
}