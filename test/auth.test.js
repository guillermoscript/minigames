'use strict';
/* Node harness for the Google sign-in layer in js/api.js (stubbed fetch / EventSource / localStorage).  Run: node test/auth.test.js */
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../js/api.js', 'utf8');

function world(opts = {}) {
  const store = {}, session = opts.session || {}, calls = [], esList = [];
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
    URL, Date, history: { replaceState(_, __, url) { ctx.location.href = url; } },
    sessionStorage: { getItem: k => session[k] || null, setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } },
    location: { origin: 'https://game.test', search: '', href: opts.href || 'https://game.test/', assign(url) { ctx.location.href = url; } }, STAGES: [1, 2, 3],
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src + '\n;globalThis.__x = { api, net };', ctx);
  const popup = { closed: false, loc: '', location: { set href(v) { popup.loc = v; popup.onNav && popup.onNav(v); } }, close() { popup.closed = true; } };
  return { api: ctx.__x.api, net: ctx.__x.net, calls, esList, popup, store, session, ctx };
}
const tick = ms => new Promise(r => setTimeout(r, ms));
const tests = [];
const T = (n, f) => tests.push([n, f]);

const pendingKey = 'claudeware-google-oauth-v1';
async function callback(opts = {}, query = 'state=S&code=CODE') {
  const first = world();
  assert.ok((await first.api.googleSignIn()).redirecting);
  return world({ ...opts, session: first.session, href: 'https://game.test/?oauth_callback=google&' + query });
}
T('disabled provider does not navigate or connect realtime', async () => {
  const w = world({ oauth: false });
  const r = await w.api.googleSignIn();
  assert.ok(!r.ok && r.unavailable && !w.esList.length);
  assert.strictEqual(w.ctx.location.href, 'https://game.test/');
});
T('same-tab redirect keeps provider state and PKCE in tab storage', async () => {
  const w = world(); assert.ok((await w.api.googleSignIn()).redirecting);
  const u = new URL(w.ctx.location.href);
  assert.strictEqual(u.searchParams.get('state'), 'S');
  assert.strictEqual(u.searchParams.get('code_challenge'), 'C');
  assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://game.test/?oauth_callback=google');
  assert.strictEqual(JSON.parse(w.session[pendingKey]).codeVerifier, 'V');
  assert.ok(!w.esList.length && !w.net.user);
});
T('redirect_uri is fixed even when started from a challenge/lang/index.html URL, and the page is restored after', async () => {
  const start = 'https://game.test/index.html?c=900&s=3&f=ANA&lang=es&fbclid=X';
  const first = world({ href: start }); assert.ok((await first.api.googleSignIn()).redirecting);
  assert.strictEqual(new URL(first.ctx.location.href).searchParams.get('redirect_uri'), 'https://game.test/?oauth_callback=google');
  const w = world({ session: first.session, href: 'https://game.test/?oauth_callback=google&state=S&code=CODE' });
  const r = await w.api.completeGoogleSignIn();
  assert.ok(r.ok); assert.strictEqual(w.calls[0].body.redirectURL, 'https://game.test/?oauth_callback=google');
  assert.strictEqual(w.ctx.location.href, start);
});
T('callback after reload exchanges exact redirectURL and saves session', async () => {
  const w = await callback({ isNew: true });
  const r = await w.api.completeGoogleSignIn();
  assert.ok(r.ok && r.data.isNew && r.data.progress.unlocked === 3);
  assert.deepStrictEqual(w.calls[0].body, { provider: 'google', code: 'CODE', codeVerifier: 'V', redirectURL: 'https://game.test/?oauth_callback=google' });
  assert.strictEqual(w.net.token, 'T');
  assert.ok(JSON.parse(w.store['claudeware-profile-v2']).token === 'T');
  assert.ok(!w.session[pendingKey] && !w.esList.length);
  assert.strictEqual(w.ctx.location.href, 'https://game.test/');
  assert.strictEqual(await w.api.completeGoogleSignIn(), null);
});
T('missing, expired, mismatched or replayed state never exchanges', async () => {
  for (const kind of ['missing', 'expired', 'mismatch']) {
    const w = await callback({}, kind === 'mismatch' ? 'state=evil&code=CODE' : 'state=S&code=CODE');
    if (kind === 'missing') delete w.session[pendingKey];
    if (kind === 'expired') { const p = JSON.parse(w.session[pendingKey]); p.created -= 11 * 60000; w.session[pendingKey] = JSON.stringify(p); }
    assert.ok(!(await w.api.completeGoogleSignIn()).ok && !w.calls.length && !w.net.user);
    assert.ok(!w.session[pendingKey]);
  }
});
T('Google cancellation is handled after return', async () => {
  const w = await callback({}, 'state=S&error=access_denied');
  const r = await w.api.completeGoogleSignIn(); assert.ok(!r.ok && r.cancelled && !w.calls.length);
});
T('cancel while methods are loading prevents navigation', async () => {
  const w = world(); const promise = w.api.googleSignIn(); w.api.cancelOAuth();
  assert.ok((await promise).cancelled); assert.strictEqual(w.ctx.location.href, 'https://game.test/');
});
T('blocked session storage prevents starting unusable OAuth flow', async () => {
  const w = world(); w.ctx.sessionStorage.setItem = () => { throw Error('blocked'); };
  assert.ok(!(await w.api.googleSignIn()).ok); assert.strictEqual(w.ctx.location.href, 'https://game.test/');
});
T('exchange failure returns error without saving session', async () => {
  const w = await callback({ exchange: 400 }); const r = await w.api.completeGoogleSignIn();
  assert.ok(!r.ok && /Google sign-in failed/.test(r.data.error) && !w.net.user);
});
T('normal game boot has no OAuth request', async () => {
  const w = world(); assert.strictEqual(await w.api.completeGoogleSignIn(), null); assert.ok(!w.calls.length);
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
  const r = await w.api.googleSignIn(); assert.ok(!r.ok && /unreachable/i.test(r.data.error));
});

(async () => {
  let bad = 0;
  for (const [n, f] of tests) { try { await f(); console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n  ' + (e.stack || e)); } }
  console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();
