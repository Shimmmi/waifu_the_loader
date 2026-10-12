// Минимальный service worker: офлайн-оболочка и кэш портретов. API никогда не кэшируется.
const SHELL = 'wl-shell-v1';
const IMG = 'wl-img-v1';
const BASE = '/waifu_loader/';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, BASE + 'icon.svg', BASE + 'manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== IMG).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !url.pathname.startsWith(BASE) || url.pathname.startsWith(BASE + 'api/')) return;

  if (url.pathname.startsWith(BASE + 'portraits/')) {
    e.respondWith(
      caches.open(IMG).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // network-first для HTML/JS/CSS: всегда свежая версия, офлайн — из кэша
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(BASE))),
  );
});
