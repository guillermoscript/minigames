'use strict';
/* Service worker: repeat visits start from cache (and work offline). Pages are network-first so a deploy shows up at once;
   scripts, styles, images and fonts are stale-while-revalidate. The API is never touched. */
const CACHE = 'claudeware-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/') || u.pathname.startsWith('/_/')) return;
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== location.origin && !font) return;
  const put = res => { if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)); } return res; };
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(put).catch(() => caches.match(r).then(m => m || caches.match('/')))); return; }
  e.respondWith(caches.match(r).then(m => {
    const net = fetch(r).then(put).catch(() => m);
    return m || net;
  }));
});
