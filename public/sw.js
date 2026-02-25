// public/sw.js
// 이음 PWA 서비스 워커 — 오프라인 지원 + 캐싱 전략

const CACHE_NAME = "eum-v1";
const OFFLINE_URL = "/offline";

// 앱 셸 — 항상 캐싱할 정적 자산
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/dashboard",
  "/manifest.json",
];

// ── 설치 ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 일부 캐싱 실패해도 설치 계속
      });
    })
  );
  self.skipWaiting();
});

// ── 활성화 — 구버전 캐시 삭제 ──────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch 전략 ───────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청: Network Only (캐싱 안 함)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "오프라인 상태입니다" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // 이미지/파일: Cache First
  if (
    request.destination === "image" ||
    url.pathname.startsWith("/storage/") ||
    url.pathname.startsWith("/thumbnails/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 정적 자산 (JS, CSS, fonts): Stale While Revalidate
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
        return cached ?? networkFetch;
      })
    );
    return;
  }

  // HTML 페이지: Network First → 오프라인 시 캐시 → /offline 폴백
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached ?? caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }
});

// ── 푸시 알림 (FCM 보완) ─────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const title = data.notification?.title ?? "이음 알림";
  const options = {
    body: data.notification?.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png",
    data: { url: data.data?.link ?? "/notifications" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});
