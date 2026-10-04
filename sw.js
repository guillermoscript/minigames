'use strict';
// Online files stay network-first; a complete local shell supports offline guest play.
const CACHE = 'claudeware-v4-dev';
const ROOT = new URL('./', self.location.href);
self.addEventListener('install', e => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const response = await fetch(ROOT, { cache: 'reload' });
  if (!response.ok) throw new Error('Game shell unavailable');
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(m => new URL(m[1], ROOT))
    .filter(u => u.origin === ROOT.origin && /\.(js|css|png|webmanifest)$/.test(u.pathname));
  // The 3D engine is loaded on demand; include it so that stage also works offline.
  const main = assets.find(u => u.pathname.endsWith('/js/main.js'));
  const three = new URL('js/vendor/three.min.js', ROOT);
  if (main) three.search = main.search;
  assets.push(three, ...[192, 512].map(size => new URL(`img/icons/icon-${size}.png`, ROOT)));
  await cache.addAll([...new Set(assets.map(u => u.href))].map(url => new Request(url, { cache: 'reload' })));
  await cache.put(ROOT.href, response);
  await self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('claudeware-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/') || u.pathname.startsWith('/_/')) return;
  const font = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== ROOT.origin && !font) return;
  // Only cache game resources, never backend records, OAuth callbacks or admin pages.
  const shell = u.pathname === ROOT.pathname || u.pathname === new URL('index.html', ROOT).pathname;
  const asset = ['js/', 'css/', 'img/'].some(dir => u.pathname.startsWith(new URL(dir, ROOT).pathname)) || u.pathname === new URL('manifest.webmanifest', ROOT).pathname;
  if (!font && !shell && !asset) return;
  const save = async res => {
    if (res && (res.ok || (font && res.type === 'opaque'))) {
      const cache = await caches.open(CACHE);
      await cache.put(shell ? ROOT.href : r, res.clone());
    }
    return res;
  };
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = shell ? ROOT.href : r;
    if (font) { const hit = await cache.match(key); if (hit) return hit; }
    try {
      const res = await fetch(r, { cache: 'no-cache' });
      if (res.status >= 500) { const hit = await cache.match(key); if (hit) return hit; }
      // Cache failures must not discard a successful network response.
      e.waitUntil(save(res.clone()).catch(() => {}));
      return res;
    } catch (_) { return await cache.match(key) || Response.error(); }
  })());
});
