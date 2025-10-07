// Service Worker for PWA
const CACHE_NAME = "okparts-v1";
const urlsToCache = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
];

// 설치 이벤트
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 활성화 이벤트
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch 이벤트 - Network First 전략
self.addEventListener("fetch", (event) => {
  // chrome-extension:// 등 외부 스킴은 무시
  if (!event.request.url.startsWith("http")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 응답이 유효하면 캐시에 저장
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 반환
        return caches.match(event.request);
      })
  );
});

// Background Sync for offline upload queue
self.addEventListener("sync", (event) => {
  if (event.tag === "upload-queue") {
    event.waitUntil(processUploadQueue());
  }
});

async function processUploadQueue() {
  // IndexedDB에서 대기 중인 업로드 가져오기
  // 실제 구현은 더 복잡하지만, 기본 구조만 제공
  console.log("Processing upload queue...");
}
