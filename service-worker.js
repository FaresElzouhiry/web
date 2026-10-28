/* BBQ — Riyadh 2027 · Service Worker
   ┌─────────────────────────────────────────────────────────────┐
   │  كل ما ترفع تعديل: غيّر رقم CACHE_VERSION هنا بس، وارفع الملفات.  │
   │  الزوار هيتحدث عندهم الموقع أوتوماتيك أول ما يفتحوه.            │
   └─────────────────────────────────────────────────────────────┘ */
const CACHE_VERSION = 'v1';

const CACHE = `bbq-${CACHE_VERSION}`;
const CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './assets/logo-mark.png',
  './assets/logo-flame-mark.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/arch.png'
];

// Install the new version and take over immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Delete every older version's cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bbq-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google Fonts etc. → network

  // Pages: network first (always fresh), cached copy when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CSS / JS / images: served from this version's cache, downloaded once per version
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req, { cache: 'reload' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
  );
});
