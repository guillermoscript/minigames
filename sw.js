'use strict';
/* Service worker, deliberately conservative: it must never serve stale code while the network works.
   Pages, scripts, styles and images are network-first (always the current deploy); the cache is only an offline fallback.
   Google Fonts files never change, so those are cache-first. The API is never touched. */
const CACHE = 'claudeware-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/') || u.pathname.startsWith('/_/')) return;
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== location.origin && !font) return;
  const put = res => { if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)); } return res; };
  if (font) { e.respondWith(caches.match(r).then(m => m || fetch(r).then(put))); return; }
  e.respondWith(fetch(r).then(put).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
