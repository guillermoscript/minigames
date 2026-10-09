'use strict';
// Exercise the actual worker against a file-backed network, then disconnect it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
test('complete offline shell, isolated cache cleanup, fresh online files and API bypass', async () => {
  const handlers = {}, stores = new Map([['another-app', new Map()], ['claudeware-v3', new Map()]]);
  let offline = false, fresh = null, claimed = false;
  const key = r => typeof r === 'string' ? r : r.url || r.href;
  const fetch = async r => {
    if (offline) throw new Error('Offline');
    if (fresh) return new Response(fresh);
    const url = new URL(key(r));
    const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    try { return new Response(await fs.readFile(path.join(root, filename))); }
    catch (_) { return new Response('Not found', { status: 404 }); }
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        put: async (r, res) => { store.set(key(r), res.clone()); },
        match: async r => store.get(key(r))?.clone(),
        addAll: async requests => {
          for (const r of requests) { const res = await fetch(r); assert.ok(res.ok, key(r)); store.set(key(r), res); }
        }
      };
    }
  };
  const self = { location: { href: 'https://game.test/sw.js' }, addEventListener: (n, fn) => { handlers[n] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => { claimed = true; } } };
  vm.runInNewContext(await fs.readFile(path.join(root, 'sw.js'), 'utf8'), { self, caches, fetch, URL, Request, Response });
  let task;
  handlers.install({ waitUntil: p => { task = p; } }); await task;
  handlers.activate({ waitUntil: p => { task = p; } }); await task;
  assert.ok(claimed); assert.ok(stores.has('another-app')); assert.ok(!stores.has('claudeware-v3'));
  const store = stores.get('claudeware-v4-dev');
  assert.ok([...store.keys()].some(k => k.includes('three.min.js')));
  assert.ok([...store.keys()].some(k => k.endsWith('icon-180.png')));
  async function get(url, method = 'GET') {
    let response; const pending = [];
    handlers.fetch({ request: new Request(url, { method }), respondWith: p => { response = p; }, waitUntil: p => pending.push(p) });
    const res = await response; await Promise.all(pending); return res;
  }
  offline = true;
  assert.match(await (await get('https://game.test/?lang=es')).text(), /MiniCaos/);
  assert.match(await (await get('https://game.test/index.html')).text(), /MiniCaos/);
  for (const url of store.keys()) assert.equal((await get(url)).status, 200, url);
  assert.equal(await get('https://game.test/api/collections/users'), undefined);
  assert.equal(await get('https://game.test/_/'), undefined);
  assert.equal(await get('https://game.test/api/party/sig', 'POST'), undefined);
  offline = false; fresh = 'new deploy';
  assert.equal(await (await get('https://game.test/')).text(), fresh);
  offline = true;
  assert.equal(await (await get('https://game.test/')).text(), fresh);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = await fs.readFile(path.join(root, icon.src));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
  }
});
test('install UI follows supported browsers, language, game state and installation', async () => {
  const handlers = {}, clicks = {}, button = { addEventListener: (n, fn) => { clicks[n] = fn; } };
  let tick, registered = false, prompted = false;
  const context = {
    document: { getElementById: () => button }, navigator: { userAgent: 'Chrome', serviceWorker: { register: async (url, opts) => { assert.equal(url, 'sw.js'); assert.equal(opts.updateViaCache, 'none'); registered = true; } } },
    matchMedia: () => ({ matches: false }), addEventListener: (n, fn) => { handlers[n] = fn; }, setInterval: fn => { tick = fn; },
    I18N: { lang: 'es' }, state: 'title', console
  };
  vm.runInNewContext(await fs.readFile(path.join(root, 'js/pwa.js'), 'utf8'), context);
  assert.equal(button.hidden, true);
  handlers.load(); await Promise.resolve(); assert.ok(registered);
  handlers.beforeinstallprompt({ preventDefault() {}, prompt: async () => { prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.equal(button.hidden, false); assert.equal(button.textContent, 'INSTALAR APP');
  context.state = 'play'; tick(); assert.equal(button.hidden, true);
  context.state = 'menu'; context.I18N.lang = 'en'; tick(); assert.equal(button.hidden, false); assert.equal(button.textContent, 'INSTALL APP');
  await clicks.click(); assert.ok(prompted);
  handlers.appinstalled(); tick(); assert.equal(button.hidden, true);
});
