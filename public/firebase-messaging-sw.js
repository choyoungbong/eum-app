// Firebase Cloud Messaging Service Worker
// 파일 위치: public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase 설정
// 이 값들은 환경 변수에서 가져올 수 없으므로 직접 입력해야 합니다
// Firebase Console > 프로젝트 설정 > 일반 > 웹 앱에서 확인
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지:', payload);

  const notificationTitle = payload.notification?.title || '새 메시지';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png', // 앱 아이콘
    badge: '/badge-72x72.png',
    data: payload.data,
    tag: payload.data?.chatRoomId || 'default',
    requireInteraction: payload.data?.type === 'incoming_call', // 통화는 자동으로 닫히지 않음
  };

  // 통화 알림인 경우 추가 옵션
  if (payload.data?.type === 'incoming_call') {
    notificationOptions.actions = [
      { action: 'accept', title: '수락' },
      { action: 'reject', title: '거절' },
    ];
    notificationOptions.vibrate = [200, 100, 200, 100, 200];
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] 알림 클릭:', event);
  event.notification.close();

  const data = event.notification.data;

  // 통화 알림 액션 처리
  if (data?.type === 'incoming_call') {
    if (event.action === 'accept') {
      // 통화 수락 페이지로 이동
      event.waitUntil(
        clients.openWindow(`/call/${data.callId}?action=accept`)
      );
    } else if (event.action === 'reject') {
      // 통화 거절 API 호출 (백그라운드)
      fetch('/api/calls/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: data.callId }),
      });
    }
    return;
  }

  // 채팅 메시지 알림 - 채팅방으로 이동
  if (data?.chatRoomId) {
    event.waitUntil(
      clients.openWindow(`/chat/${data.chatRoomId}`)
    );
  }
});