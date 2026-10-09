'use strict';
/* Optional online profile layer, talking straight to PocketBase's REST API (plain fetch, no SDK).
   Everything here fails soft: the game never waits on the network.
   window.CLAUDEWARE_API may point at another origin (default: same origin, under /api/). */
const API_BASE = (typeof window !== 'undefined' && window.CLAUDEWARE_API) || '';
const PROFILE_KEY = 'claudeware-profile-v2', QUEUE_KEY = 'claudeware-queue-v2';
const AVATAR_COLORS = ['#FF6B3D', '#6EA8FE', '#7BD88F', '#F28CB1', '#B49CFF', '#FFD23F', '#FF6B4D', '#4DD0E1'];
const PER_BOARD = 20;

const net = {
  user: null,          // { id, username, color } when logged in (cached from last login; verified on boot)
  token: '',           // PocketBase auth token, sent as the raw `Authorization` header
  online: true,        // last request reached the server
  lastStatus: 200,     // HTTP status of the last request (0 = network failure); lets the UI say SLOW DOWN
  queue: [],           // pending { kind:'score'|'progress', ... } kept across reloads
  flushing: false
};
try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); if (p && p.token && p.user && p.user.username) { net.token = p.token; net.user = p.user; } } catch (e) {}
try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY)); if (Array.isArray(q)) net.queue = q.slice(-50); } catch (e) {}
const saveProfile = () => { try { net.user ? localStorage.setItem(PROFILE_KEY, JSON.stringify({ token: net.token, user: net.user })) : localStorage.removeItem(PROFILE_KEY); } catch (e) {} };
const saveQueue = () => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(net.queue)); } catch (e) {} };
const dropSession = () => { net.user = null; net.token = ''; saveProfile(); };
const setSession = (token, rec) => { net.token = token; net.user = { id: rec.id, username: rec.username, color: rec.color }; saveProfile(); };

const qs = o => Object.keys(o).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); // for PocketBase filter strings
const COLL = '/collections/';

/* turn a PocketBase error body into a short, shouty, human message */
function friendly(status, data, path) {
  if (status === 0) return 'Server unreachable';
  if (status === 429) return 'Slow down';
  const f = data && data.data || {};
  for (const k of Object.keys(f)) {
    const e = f[k] || {}, code = e.code || '';
    if (k === 'username' && /unique/.test(code)) return 'Username taken';
    if (k === 'username') return 'Username: 3-16 letters, numbers, _ -';
    if (e.message) return String(e.message).replace(/\.$/, '');
  }
  if (/auth-with-oauth2/.test(path || '') && status >= 400 && status < 500) return 'Google sign-in failed - try again';
  if (status === 404) return 'Not found';
  return (data && data.message ? String(data.message).replace(/\.$/, '') : 'Error');
}

/* returns { ok, status, data } and never throws; on failure data.error is a friendly string */
async function call(method, path, body, timeout = 8000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const tm = ctl && setTimeout(() => ctl.abort(), timeout);
  try {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (net.token) headers.Authorization = net.token;
    const r = await fetch(API_BASE + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined });
    let data = null; try { data = await r.json(); } catch (e) {}
    net.online = true; net.lastStatus = r.status;
    data = data || {};
    if (!r.ok) data = Object.assign({}, data, { error: friendly(r.status, data, path) });
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    net.online = false; net.lastStatus = 0; return { ok: false, status: 0, data: { error: 'Server unreachable' } };
  } finally { if (tm) clearTimeout(tm); }
}

const arr = (a, n) => Array.from({ length: n }, (_, i) => (Array.isArray(a) ? a[i] | 0 : 0));
const progressOfRec = rec => {
  const n = STAGES.length;
  return { unlocked: Math.min(n, Math.max(1, rec.unlocked | 0)), stars: arr(rec.stars, n), best: arr(rec.best, n) };
};
const retryable = r => r.status === 0 || r.status === 429 || r.status >= 500;

/* ---- scores ---- */
/* number of score rows on a stage that beat `score` (+1 = rank); null on failure */
async function stageRank(stage, score) {
  const r = await call('GET', COLL + 'scores/records?' + qs({ filter: `(stage=${stage | 0} && score>${score | 0})`, perPage: 1, page: 1, skipTotal: 'false', fields: 'id' }));
  return r.ok && typeof r.data.totalItems === 'number' ? 1 + r.data.totalItems : null;
}
const myScoreRec = async (uid, stage) => {
  const r = await call('GET', COLL + 'scores/records?' + qs({ filter: `(user='${esc(uid)}' && stage=${stage | 0})`, perPage: 1 }));
  return r.ok ? { ok: true, rec: (r.data.items || [])[0] || null } : { ok: false, r };
};
/* Upsert my (stage) score only if higher. Returns { ok, r?, result? }. */
async function writeScore(stage, score, stars) {
  const uid = net.user.id, got = await myScoreRec(uid, stage);
  if (!got.ok) return { ok: false, r: got.r };
  const rec = got.rec;
  let best = score, bestStars = stars, newBest = true;
  if (!rec) {
    const w = await call('POST', COLL + 'scores/records', { user: uid, stage, score, stars });
    if (!w.ok) return { ok: false, r: w };
  } else if (score > rec.score) {
    const w = await call('PATCH', COLL + 'scores/records/' + rec.id, { score, stars });
    if (!w.ok) return { ok: false, r: w };
  } else { best = rec.score; bestStars = Math.max(rec.stars | 0, stars); newBest = false; }
  const rank = await stageRank(stage, best);
  return { ok: true, result: { stage, best, stars: bestStars, newBest, rank } };
}

/* Push queued items; stop at first transient failure. Drops items the server rejects permanently. */
async function flushQueue() {
  if (net.flushing || !net.user || !net.queue.length) return;
  net.flushing = true;
  try {
    while (net.queue.length && net.user) {
      const it = net.queue[0];
      let r;
      if (it.kind === 'score') { const w = await writeScore(it.stage, it.score, it.stars); r = w.ok ? { ok: true, status: 200 } : w.r; }
      else r = await call('PATCH', COLL + 'users/records/' + net.user.id, it.progress);
      if (r.status === 401) { dropSession(); break; }
      if (!r.ok && retryable(r)) break;
      net.queue.shift(); saveQueue();
    }
  } finally { net.flushing = false; }
}
setInterval(flushQueue, 30000);
addEventListener('online', flushQueue);

const enqueue = item => {
  if (item.kind === 'progress') net.queue = net.queue.filter(x => x.kind !== 'progress'); // only latest snapshot matters
  net.queue.push(item); net.queue = net.queue.slice(-50); saveQueue();
};
const maxArr = (a, b, n) => Array.from({ length: n }, (_, i) => Math.max(a[i] | 0, b[i] | 0));
const sum = a => (Array.isArray(a) ? a : []).reduce((s, x) => s + (x | 0), 0);

/* Manual OAuth2 code exchange: preserve PKCE/state across same-tab navigation.
   The callback is the game URL, not PocketBase's realtime popup endpoint. */
const OAUTH_KEY = 'claudeware-google-oauth-v1';
let oauthAttempt = 0;
const oauthFailure = error => ({ ok: false, status: 0, data: { error } });

const api = {
  /* merge server progress into local `save` (max); also uploads stage scores the server doesn't have yet */
  async mergeProgress(save, serverProg) {
    const n = STAGES.length, before = serverProg ? serverProg.best || [] : [];
    if (serverProg) {
      save.unlocked = Math.max(save.unlocked, serverProg.unlocked | 0);
      save.stars = maxArr(save.stars, serverProg.stars || [], n);
      save.best = maxArr(save.best, serverProg.best || [], n);
    }
    if (net.user) for (let i = 0; i < n; i++) if (save.best[i] > (before[i] | 0)) enqueue({ kind: 'score', stage: i, score: Math.min(2000, save.best[i]), stars: Math.min(3, Math.max(1, save.stars[i] | 0)) });
    return { unlocked: save.unlocked, stars: save.stars.slice(0, n), best: save.best.slice(0, n) };
  },
  /* ---- Google sign-in (OAuth2 authorization-code + PKCE, plain fetch; PocketBase does the token exchange with Google) ---- */
  /* { ok, available, provider? } ; ok=false only when the server can't be reached */
  async authMethods() {
    const r = await call('GET', COLL + 'users/auth-methods');
    if (!r.ok) return { ok: false, status: r.status, available: false, error: r.data.error };
    const o = r.data.oauth2 || {}, g = o.enabled ? (o.providers || []).find(p => p.name === 'google' && p.authURL) : null;
    return { ok: true, status: 200, available: !!g, provider: g || null };
  },
  async googleSignIn(navigate = url => location.assign(url)) {
    const attempt = ++oauthAttempt;
    const m = await api.authMethods();
    if (attempt !== oauthAttempt) return Object.assign(oauthFailure('Sign-in cancelled'), { cancelled: true });
    if (!m.ok) return { ok: false, status: m.status, data: { error: m.error || 'Server unreachable' } };
    if (!m.available) return Object.assign(oauthFailure('Sign-in not available right now'), { unavailable: true });
    const g = m.provider;
    // One fixed callback URI (origin + '/'), whatever URL the player started from (challenge links, ?lang=, fbclid...);
    // Google only accepts exact registered URIs. The page they were on is restored after sign-in via returnTo.
    const redirectURL = location.origin + '/?oauth_callback=google';
    const returnTo = location.href.split('#')[0];
    try {
      // sessionStorage keeps the verifier in this tab and survives the Google round trip.
      sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ name: g.name, state: g.state, codeVerifier: g.codeVerifier, redirectURL, returnTo, created: Date.now() }));
      navigate(g.authURL + encodeURIComponent(redirectURL));
      return { ok: true, redirecting: true };
    } catch (e) {
      try { sessionStorage.removeItem(OAUTH_KEY); } catch (_) {}
      return oauthFailure('Could not open Google');
    }
  },
  async completeGoogleSignIn() {
    const url = new URL(location.href);
    if (url.searchParams.get('oauth_callback') !== 'google') return null;
    const code = url.searchParams.get('code'), state = url.searchParams.get('state'), error = url.searchParams.get('error');
    let pending;
    try {
      pending = JSON.parse(sessionStorage.getItem(OAUTH_KEY));
      sessionStorage.removeItem(OAUTH_KEY);
    } catch (_) {}
    // Remove credentials from the address bar before any network exchange.
    for (const key of ['oauth_callback', 'code', 'state', 'error', 'error_description', 'error_uri', 'scope', 'authuser', 'prompt', 'hd']) url.searchParams.delete(key);
    let back = url.href;
    try { if (pending && pending.returnTo && new URL(pending.returnTo).origin === location.origin) back = pending.returnTo; } catch (_) {}
    history.replaceState(null, '', back);
    if (!pending || !state || pending.state !== state || !pending.codeVerifier ||
        !Number.isFinite(pending.created) || Date.now() - pending.created > 10 * 60000 || pending.created > Date.now()) {
      return oauthFailure('Sign-in could not be verified - try again');
    }
    if (error) return Object.assign(oauthFailure(error === 'access_denied' ? 'Sign-in cancelled' : 'Google said no - try again'), { cancelled: error === 'access_denied' });
    if (!code) return oauthFailure('Sign-in could not be verified - try again');
    const r = await call('POST', COLL + 'users/auth-with-oauth2', {
      provider: pending.name, code, codeVerifier: pending.codeVerifier, redirectURL: pending.redirectURL
    }, 30000);
    if (!r.ok) return r;
    setSession(r.data.token, r.data.record);
    return { ok: true, status: 200, data: { user: net.user, progress: progressOfRec(r.data.record), isNew: !!(r.data.meta && r.data.meta.isNew) } };
  },
  cancelOAuth() {
    ++oauthAttempt;
    try { sessionStorage.removeItem(OAUTH_KEY); } catch (_) {}
  },
  async rename(name) {
    if (!net.user) return { ok: false, status: 401, data: { error: 'Not signed in' } };
    if (!/^[A-Za-z0-9_-]{3,16}$/.test(name)) return { ok: false, status: 400, data: { error: 'Name: 3-16 letters, numbers, _ -' } };
    const r = await call('PATCH', COLL + 'users/records/' + net.user.id, { username: name });
    if (r.ok) { net.user.username = r.data.username || name; saveProfile(); }
    return r;
  },
  async logout() { dropSession(); net.queue = []; saveQueue(); return { ok: true, status: 200, data: {} }; },
  /* verify the stored session (auth-refresh); drops it if the server says it's no good */
  async me() {
    if (!net.token) return { ok: false, status: 401, data: { error: 'Not logged in' } };
    const r = await call('POST', COLL + 'users/auth-refresh');
    if (r.ok) { setSession(r.data.token, r.data.record); return { ok: true, status: 200, data: { user: net.user, progress: progressOfRec(r.data.record) } }; }
    if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404) dropSession();
    return r;
  },
  async setColor(color) {
    if (!net.user) return { ok: false, status: 401, data: { error: 'Not logged in' } };
    const r = await call('PATCH', COLL + 'users/records/' + net.user.id, { color });
    if (r.ok) { net.user.color = r.data.color || color; saveProfile(); }
    return r;
  },
  pushProgress(prog) {
    if (!net.user) return Promise.resolve({ ok: false, status: 401, data: {} });
    const body = { unlocked: prog.unlocked, stars: prog.stars, best: prog.best };
    return call('PATCH', COLL + 'users/records/' + net.user.id, body).then(r => { if (!r.ok && retryable(r)) enqueue({ kind: 'progress', progress: body }); return r; });
  },
  /* score submit; resolves with { stage, best, stars, newBest, rank } or null (queued for retry) */
  async submitScore(stage, score, stars) {
    if (!net.user) return null;
    score = Math.max(0, Math.min(2000, score | 0)); stars = Math.max(0, Math.min(3, stars | 0));
    const w = await writeScore(stage, score, stars);
    if (w.ok) { flushQueue(); return w.result; }
    if (retryable(w.r)) enqueue({ kind: 'score', stage, score, stars });
    else if (w.r.status === 401) dropSession();
    return null;
  },
  /* { stage, players, entries:[{rank,username,color,score,stars}], me } */
  async leaderboard(stage) {
    const total = stage === 'total', uid = net.user && net.user.id;
    const listP = total
      ? call('GET', COLL + 'users/records?' + qs({ filter: '(total>0)', sort: '-total,created', perPage: PER_BOARD, skipTotal: 'false', fields: 'id,username,color,total,stars' }))
      : call('GET', COLL + 'scores/records?' + qs({ filter: `(stage=${stage | 0})`, sort: '-score,created', perPage: PER_BOARD, expand: 'user', skipTotal: 'false', fields: 'id,score,stars,user,expand.user.username,expand.user.color' }));
    const meP = !uid ? null : total
      ? call('GET', COLL + 'users/records/' + uid + '?' + qs({ fields: 'id,username,total,stars' })).then(async r => {
          if (!r.ok || !(r.data.total > 0)) return null;
          const c = await call('GET', COLL + 'users/records?' + qs({ filter: `(total>${r.data.total | 0})`, perPage: 1, skipTotal: 'false', fields: 'id' }));
          return { username: r.data.username, score: r.data.total, stars: sum(r.data.stars), rank: c.ok ? 1 + c.data.totalItems : null };
        })
      : myScoreRec(uid, stage).then(async g => {
          if (!g.ok || !g.rec) return null;
          return { username: net.user.username, score: g.rec.score, stars: g.rec.stars, rank: await stageRank(stage, g.rec.score) };
        });
    const [r, me] = await Promise.all([listP, meP]);
    if (!r.ok) return r;
    const items = r.data.items || [];
    const entries = items.map((it, i) => total
      ? { rank: i + 1, username: it.username, color: it.color, score: it.total, stars: sum(it.stars) }
      : { rank: i + 1, username: (it.expand && it.expand.user || {}).username || '?', color: (it.expand && it.expand.user || {}).color || '#9a98ad', score: it.score, stars: it.stars });
    return { ok: true, status: 200, data: { stage, players: r.data.totalItems | 0, entries, me: me && me.rank ? me : null } };
  },
  async profile(name) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) return { ok: false, status: 404, data: { error: 'No such player' } };
    const r = await call('GET', COLL + 'users/records?' + qs({ filter: `(username='${esc(name)}')`, perPage: 1, fields: 'id,username,color,created,unlocked,stars,best,total' }));
    if (!r.ok) return r;
    const u = (r.data.items || [])[0];
    if (!u) return { ok: false, status: 404, data: { error: 'No such player' } };
    const p = progressOfRec(u), total = u.total | 0;
    const rankP = total > 0
      ? call('GET', COLL + 'users/records?' + qs({ filter: `(total>${total})`, perPage: 1, skipTotal: 'false', fields: 'id' })).then(c => c.ok ? 1 + c.data.totalItems : null)
      : Promise.resolve(null);
    /* the scores collection is authoritative for per-stage bests/stars; the user's own arrays fill any gaps */
    const sr = await call('GET', COLL + 'scores/records?' + qs({ filter: `(user='${esc(u.id)}')`, perPage: 100, fields: 'stage,score,stars' }));
    if (sr.ok) for (const it of sr.data.items || []) if (it.stage >= 0 && it.stage < p.best.length) { p.best[it.stage] = Math.max(p.best[it.stage], it.score | 0); p.stars[it.stage] = Math.max(p.stars[it.stage], it.stars | 0); }
    const ranks = await Promise.all(p.best.map((b, i) => b > 0 ? stageRank(i, b) : null));
    return { ok: true, status: 200, data: { uid: u.id, username: u.username, color: u.color, joined: u.created, unlocked: p.unlocked, stars: p.stars, best: p.best, total, totalStars: sum(p.stars), rank: await rankP, stageRanks: ranks } };
  },
  /* ---- friends = follows (two follows pointing at each other = mutual friends) ---- */
  /* { ok, data:{ list:[{uid, username, color, total, following, followsMe, rec}] } }; `rec` = my follow row id (to unfollow) */
  async friends() {
    if (!net.user) return { ok: false, status: 401, data: { error: 'Not signed in' } };
    const uid = net.user.id, f = 'id,from,to,expand.from.username,expand.from.color,expand.from.total,expand.to.username,expand.to.color,expand.to.total';
    const [a, b] = await Promise.all([
      call('GET', COLL + 'friends/records?' + qs({ filter: `(from='${esc(uid)}')`, expand: 'to', perPage: 200, sort: '-created', fields: f })),
      call('GET', COLL + 'friends/records?' + qs({ filter: `(to='${esc(uid)}')`, expand: 'from', perPage: 200, sort: '-created', fields: f }))
    ]);
    if (!a.ok) return a;
    if (!b.ok) return b;
    const m = new Map(), put = (id, u, patch) => {
      const cur = m.get(id) || { uid: id, username: '?', color: '#9a98ad', total: 0, following: false, followsMe: false, rec: '' };
      m.set(id, Object.assign(cur, { username: u.username || cur.username, color: u.color || cur.color, total: u.total | 0 }, patch));
    };
    for (const it of a.data.items || []) put(it.to, (it.expand && it.expand.to) || {}, { following: true, rec: it.id });
    for (const it of b.data.items || []) put(it.from, (it.expand && it.expand.from) || {}, { followsMe: true });
    return { ok: true, status: 200, data: { list: [...m.values()] } };
  },
  /* exact (case-insensitive) username lookup -> { ok, data:{ uid, username } } */
  async findUser(name) {
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) return { ok: false, status: 404, data: { error: 'No such player' } };
    const r = await call('GET', COLL + 'users/records?' + qs({ filter: `(username~'${esc(name)}')`, perPage: 20, fields: 'id,username' }));
    if (!r.ok) return r;
    const u = (r.data.items || []).find(x => x.username.toLowerCase() === name.toLowerCase());
    return u ? { ok: true, status: 200, data: { uid: u.id, username: u.username } } : { ok: false, status: 404, data: { error: 'No such player' } };
  },
  async follow(uid) {
    if (!net.user) return { ok: false, status: 401, data: { error: 'Not signed in' } };
    return call('POST', COLL + 'friends/records', { from: net.user.id, to: uid });
  },
  async unfollow(rec) { return call('DELETE', COLL + 'friends/records/' + rec); },
  flushQueue
};
