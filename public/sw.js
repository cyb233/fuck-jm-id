const CACHE_NAME = 'shortlink-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只处理 GET
  if (req.method !== 'GET') {
    return event.respondWith(fetch(req));
  }

  const url = new URL(req.url);

  // 只处理 http / https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  // ===== HTML：Network First =====
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone(); // 👈 先 clone
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, resClone);
          });
          return res; // 👈 再 return
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ===== 其他资源：Stale-While-Revalidate =====
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, resClone);
          });
          return res;
        });
      return cached || fetchPromise;
    })
  );
});
