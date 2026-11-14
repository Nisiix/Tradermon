// Service worker minimo; mai per /api né per altri siti. Copre landing (./) e gioco (./gioca/): sta alla radice.
// - Pagine e file senza impronta (boot.js, manifest, icone): rete prima, cache se offline (così un aggiornamento
//   del gioco arriva subito).
// - File del gioco con l'impronta nel nome (assets/nome-AbC123.js): non cambiano mai, quindi cache prima. Sul
//   telefono è la differenza più grande alla seconda apertura: niente più download né verifiche per ogni file.
const CACHE = 'tradermon-v3';
const ASSETS = 'tradermon-assets-v1';
/** File con impronta tenuti al massimo (i più vecchi escono): bastano per un paio di versioni del gioco. */
const MAX_ASSETS = 160;
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './gioca/', './manifest.webmanifest']))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

/** Toglie i file più vecchi oltre il limite (le chiavi della cache sono in ordine di inserimento). */
function trim(c) {
  return c.keys().then((ks) => Promise.all(ks.slice(0, Math.max(0, ks.length - MAX_ASSETS)).map((k) => c.delete(k))));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== location.origin) return;
  // nome con impronta di Vite: …/assets/qualcosa-XXXXXXXX.ext
  if (/\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/.test(url.pathname)) {
    e.respondWith(caches.open(ASSETS).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok && r.type === 'basic') { const copy = r.clone(); void c.put(e.request, copy).then(() => trim(c)).catch(() => undefined); }
      return r;
    }))));
    return;
  }
  const page = url.pathname.includes('/gioca/') ? './gioca/' : './';
  e.respondWith(
    fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((m) => m || (e.request.mode === 'navigate' ? caches.match(page) : undefined)))
  );
});
