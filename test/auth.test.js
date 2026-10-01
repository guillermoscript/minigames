'use strict';
/* Node harness for the Google sign-in layer in js/api.js (stubbed fetch / EventSource / localStorage).  Run: node test/auth.test.js */
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../js/api.js', 'utf8');

function world(opts = {}) {
  const store = {}, calls = [], esList = [];
  const server = Object.assign({ oauth: true, exchange: 200, patch: 200, patchBody: null }, opts);
  class ES {
    constructor(url) { this.url = url; this.l = {}; this.readyState = 1; esList.push(this); setTimeout(() => this.emit('PB_CONNECT', { lastEventId: 'cid1' }), 1); }
    addEventListener(n, f) { this.l[n] = f; } emit(n, ev) { this.l[n] && this.l[n](ev); } close() { this.readyState = 2; }
  }
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetch = async (url, o = {}) => {
    const path = url.replace(/^.*\/api/, ''), body = o.body ? JSON.parse(o.body) : null;
    calls.push({ method: o.method || 'GET', path, body, headers: o.headers });
    if (path === '/collections/users/auth-methods') return json(200, { oauth2: server.oauth ? { enabled: true, providers: [{ name: 'google', state: 'S', codeVerifier: 'V', codeChallenge: 'C', codeChallengeMethod: 'S256', authURL: 'https://accounts.google.com/o/oauth2/auth?client_id=x&state=S&code_challenge=C&redirect_uri=' }] } : { enabled: false, providers: [] } });
    if (path === '/realtime') return json(204, {});
    if (path === '/collections/users/auth-with-oauth2') return server.exchange === 200 ? json(200, { token: 'T', record: { id: 'u1', username: 'google_ann', color: '#D97757', unlocked: 3, stars: [3, 1], best: [500, 100] }, meta: { isNew: !!server.isNew } }) : json(server.exchange, { message: 'Failed to authenticate.' });
    if (/^\/collections\/users\/records\/u1/.test(path) && o.method === 'PATCH') return server.patch === 200 ? json(200, Object.assign({ id: 'u1' }, body)) : json(server.patch, server.patchBody || {});
    return json(404, {});
  };
  const ctx = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval, addEventListener() {}, AbortController, EventSource: ES, fetch,
    location: { origin: 'https://game.test', search: '' }, STAGES: [1, 2, 3],
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src + '\n;globalThis.__x = { api, net };', ctx);
  const popup = { closed: false, loc: '', location: { set href(v) { popup.loc = v; popup.onNav && popup.onNav(v); } }, close() { popup.closed = true; } };
  return { api: ctx.__x.api, net: ctx.__x.net, calls, esList, popup, store };
}
const tick = ms => new Promise(r => setTimeout(r, ms));
const tests = [];
const T = (n, f) => tests.push([n, f]);

T('auth-methods disabled -> unavailable, popup closed, no realtime', async () => {
  const w = world({ oauth: false });
  assert.deepStrictEqual((await w.api.authMethods()).available, false);
  const r = await w.api.googleSignIn(w.popup);
  assert.ok(!r.ok && r.unavailable && w.popup.closed && !w.esList.length);
});
T('auth-methods enabled', async () => { const m = await world().api.authMethods(); assert.ok(m.ok && m.available && m.provider.name === 'google'); });
T('popup success: state=clientId, redirect to /api/oauth2-redirect, exchange body, session stored', async () => {
  const w = world({ isNew: true });
  w.popup.onNav = () => setTimeout(() => w.esList[0].emit('@oauth2', { data: JSON.stringify({ state: 'cid1', code: 'CODE' }) }), 5);
  const r = await w.api.googleSignIn(w.popup);
  assert.ok(r.ok && r.data.isNew && r.data.user.username === 'google_ann' && r.data.progress.unlocked === 3);
  const u = new URL(w.popup.loc);
  assert.strictEqual(u.searchParams.get('state'), 'cid1');
  assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://game.test/api/oauth2-redirect');
  assert.strictEqual(u.searchParams.get('code_challenge'), 'C');
  assert.deepStrictEqual(w.calls.find(c => /subscribe|realtime/.test(c.path) && c.method === 'POST').body, { clientId: 'cid1', subscriptions: ['@oauth2'] });
  assert.deepStrictEqual(w.calls.find(c => /oauth2$/.test(c.path)).body, { provider: 'google', code: 'CODE', codeVerifier: 'V', redirectURL: 'https://game.test/api/oauth2-redirect' });
  assert.strictEqual(w.net.token, 'T'); assert.ok(JSON.parse(w.store['claudeware-profile-v2']).token === 'T');
  assert.ok(w.popup.closed && w.esList[0].readyState === 2);
});
T('state mismatch rejected, no exchange', async () => {
  const w = world();
  w.popup.onNav = () => setTimeout(() => w.esList[0].emit('@oauth2', { data: JSON.stringify({ state: 'evil', code: 'CODE' }) }), 5);
  const r = await w.api.googleSignIn(w.popup);
  assert.ok(!r.ok && !w.calls.some(c => /auth-with-oauth2/.test(c.path)) && !w.net.user);
});
T('provider error (access_denied) -> cancelled', async () => {
  const w = world();
  w.popup.onNav = () => setTimeout(() => w.esList[0].emit('@oauth2', { data: JSON.stringify({ state: 'cid1', error: 'access_denied' }) }), 5);
  const r = await w.api.googleSignIn(w.popup);
  assert.ok(!r.ok && r.cancelled && !w.net.user);
});
T('user cancel button', async () => {
  const w = world(); const p = w.api.googleSignIn(w.popup); await tick(30); w.api.cancelOAuth();
  const r = await p; assert.ok(!r.ok && r.cancelled && w.popup.closed && w.esList[0].readyState === 2);
});
T('exchange failure -> friendly error, no session', async () => {
  const w = world({ exchange: 400 });
  w.popup.onNav = () => setTimeout(() => w.esList[0].emit('@oauth2', { data: JSON.stringify({ state: 'cid1', code: 'X' }) }), 5);
  const r = await w.api.googleSignIn(w.popup);
  assert.ok(!r.ok && /Google sign-in failed/.test(r.data.error) && !w.net.user);
});
T('rename success / taken / invalid / rate limit', async () => {
  const w = world(); w.net.user = { id: 'u1', username: 'google_ann', color: '#fff' }; w.net.token = 'T';
  assert.ok((await w.api.rename('ab')).data.error.startsWith('Name:'));
  assert.ok((await w.api.rename('bad name!')).status === 400);
  const ok = await w.api.rename('Ann_99'); assert.ok(ok.ok && w.net.user.username === 'Ann_99');
  const w2 = world({ patch: 400, patchBody: { message: 'x', data: { username: { code: 'validation_not_unique', message: 'The username is already in use.' } } } });
  w2.net.user = { id: 'u1', username: 'a', color: '#fff' };
  assert.strictEqual((await w2.api.rename('taken_1')).data.error, 'Username taken');
  const w3 = world({ patch: 429 }); w3.net.user = { id: 'u1', username: 'a', color: '#fff' };
  assert.strictEqual((await w3.api.rename('slowdown')).data.error, 'Slow down');
});
T('guest unaffected: no session, nothing stored, submitScore is a no-op, mergeProgress offline-safe', async () => {
  const w = world(); assert.strictEqual(w.net.user, null);
  assert.strictEqual(await w.api.submitScore(0, 100, 1), null);
  const save = { unlocked: 1, stars: [0, 0, 0], best: [0, 0, 0] };
  await w.api.mergeProgress(save, null); assert.strictEqual(save.unlocked, 1);
  assert.ok(!w.calls.length && !w.store['claudeware-profile-v2']);
});
T('server unreachable on sign-in', async () => {
  const w = world(); const orig = w.api.authMethods; w.api.authMethods = async () => ({ ok: false, status: 0, available: false });
  const r = await w.api.googleSignIn(w.popup); assert.ok(!r.ok && /unreachable/i.test(r.data.error) && w.popup.closed);
});

(async () => {
  let bad = 0;
  for (const [n, f] of tests) { try { await f(); console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n  ' + (e.stack || e)); } }
  console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
