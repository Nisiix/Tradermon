// Service worker minimo: rete prima, cache se offline; mai per /api.
// Copre landing (./) e gioco (./gioca/): sta alla radice del sito.
const CACHE = 'tradermon-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './gioca/', './manifest.webmanifest']))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== location.origin) return;
  const page = url.pathname.includes('/gioca/') ? './gioca/' : './';
  e.respondWith(
    fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || (e.request.mode === 'navigate' ? caches.match(page) : undefined)))
  );
});
