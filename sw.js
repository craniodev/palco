/* Cifra de Palco — service worker
   Caches the app shell + Google Fonts so it runs fully offline after the
   first online load. The repertoire itself is fetched by the page from its
   raw link and kept in localStorage, so it stays available offline too. */
const CACHE = 'cifra-v31';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.host);

  // App pages: network-first (to pick up updates), fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); return res; })
        .catch(() => caches.match(req).then(h => h || caches.match('./index.html')))
    );
    return;
  }

  // Same-origin assets and Google Fonts: cache-first, refresh in background.
  if (url.origin === location.origin || isFont) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  // Everything else (e.g. the repertoire raw URL): let it hit the network;
  // the page handles offline via its own saved copy.
});
