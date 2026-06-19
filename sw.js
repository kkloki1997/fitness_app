const CACHE = 'lokifit-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (offline support) ───────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// ── Push Notifications ────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Loki Fitness 🔥';
  const options = {
    body: data.body || 'Time to check in with your training!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || './' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});

// ── Background Sync ───────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'lokifit-sync') {
    e.waitUntil(
      // Sync any queued log entries when back online
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE' }));
      })
    );
  }
});

// ── Periodic Background Sync ──────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'lokifit-daily') {
    e.waitUntil(
      // Daily reminder check
      self.registration.showNotification('Loki Fitness 🔥', {
        body: 'Daily check-in: log your weight, hit your protein goal, take your photo!',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { url: './' }
      })
    );
  }
});

// ── Message handler ───────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CACHE_URLS') {
    e.waitUntil(
      caches.open(CACHE).then(c => c.addAll(e.data.payload))
    );
  }
});
