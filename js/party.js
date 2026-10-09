'use strict';
/* PARTY mode: play microgames live with friends in a room (2-4 players, VERSUS or TEAM).
   Server side lives in pocketbase/pb_hooks/party*.js: a room is one record, every action is a POST to /api/party/<action>, and the
   room record is pushed to everyone through PocketBase realtime (SSE, with a slow poll as safety net).
   This file = network + room state machine + the lobby / waiting / results / final screens. The microgame itself runs through the
   normal game loop in main.js (mode === 'party'), built from the room's seed so everyone gets the same puzzle. */

const PSESSION = 'claudeware-party-v1', GUEST_KEY = 'claudeware-guest';
const PINVITE = (() => {                                   // ?r=ABCD (from /r/ABCD): offer to join on the title screen
  try { const c = (new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); return c.length === 4 ? c : null; } catch (e) { return null; }
})();
const balloonBetween = R => R && R.mode === 'balloon' ? (R.last && R.last.final ? 2.8 : .9) : 4.2;   // keep in sync with BETWEEN_MS_BALLOON in the server
const balloonPre = R => R && R.mode === 'balloon' ? 1.4 : R && R.mode === 'cards' ? R.extra.phase === 'draw' ? 0 : 2.2 : 4;   // CARDS flows: a deck pick has no instruction card (keep in sync with preTurn in the server)
const NEXT_ROUND_S = 4.2;                                  // results stay up this long before anyone asks for the next round

const party = {
  view: 'menu',          // menu | joining | lobby | play | wait | between | end
  room: null,            // latest room record from the server (never contains the secret keys)
  you: null,             // { id, key }: my seat and its secret
  busy: false, msg: '', msgCol: '#FF4D4D',
  guideTab: 0, previewMode: null,
  es: null, sseOK: false,
  played: -1,            // round I have already started locally
  pending: null,         // my result for the current round, until the server has it
  seenAt: 0, lastPoll: 0, lastTick: 0, lastAdv: 0, lastRep: 0,
  from: 'title',
  watch: { round: -1, frames: {}, target: null },
  sig: { q: [], buf: [], busy: false, last: 0, hbAt: 0, round: -1, handler: null, rx: 0, since: 0 },   // DUO live relay state (see duoCtx)
};
const inCode = document.getElementById('in-code');
if (inCode) inCode.addEventListener('input', () => { inCode.value = inCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });

/* ───────────── identity + network ───────────── */
function partyIdentity() {
  if (net.user) return { name: net.user.username, color: net.user.color };
  let g = null; try { g = JSON.parse(localStorage.getItem(GUEST_KEY)); } catch (e) {}
  if (!g || !g.name) {
    g = { name: 'GUEST ' + (1000 + Math.floor(Math.random() * 9000)), color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] };
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch (e) {}
  }
  return g;
}
async function pcall(action, body) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), action === 'sig' ? 2500 : 10000);
  try {
    const h = { 'Content-Type': 'application/json' }; if (net.token) h.Authorization = net.token;
    const r = await fetch(API_BASE + '/api/party/' + action, { method: 'POST', headers: h, signal: controller.signal, body: JSON.stringify(body || {}) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: j };
  } catch (e) { return { ok: false, status: 0, data: { error: 'Server unreachable' } }; } finally { clearTimeout(timer); }
}
const auth = () => ({ code: party.room.code, id: party.you.id, key: party.you.key });
const me = () => party.room && party.you ? party.room.players.find(p => p.id === party.you.id) : null;
const isHost = () => !!party.room && !!party.you && party.room.host === party.you.id;
const pName = (R, id) => { const p = R.players.find(q => q.id === id); return p ? p.name : '?'; };
const pColor = (R, id) => { const p = R.players.find(q => q.id === id); return p ? p.color : '#9a98ad'; };
const saveSession = () => { try { party.room ? sessionStorage.setItem(PSESSION, JSON.stringify({ code: party.room.code, id: party.you.id, key: party.you.key })) : sessionStorage.removeItem(PSESSION); } catch (e) {} };
const partyErr = r => r.status === 0 ? 'CAN\'T REACH SERVER' : r.status === 429 ? 'SLOW DOWN - TRY AGAIN IN A MOMENT' : String(r.data.error || 'ERROR').toUpperCase();

function partyConnect() {
  partyDisconnect();
  const id = party.room.id; let es;
  try { es = new EventSource(API_BASE + '/api/realtime'); } catch (e) { return; }
  party.es = es;
  es.addEventListener('PB_CONNECT', async ev => {
    try {
      const r = await fetch(API_BASE + '/api/realtime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: ev.lastEventId, subscriptions: ['rooms/' + id, 'rooms/' + id + '/sig', 'rooms/' + id + '/vsig'] }) });
      party.sseOK = r.ok;
    } catch (e) { party.sseOK = false; }
  });
  es.addEventListener('rooms/' + id, ev => { try { const d = JSON.parse(ev.data); if (d.action === 'delete') roomGone(); else applyRoom(d.record); } catch (e) {} });
  es.addEventListener('rooms/' + id + '/sig', ev => { try { onSig(JSON.parse(ev.data)); } catch (e) {} });   // NB: PocketBase's SSE frames have no space after the colons
  es.addEventListener('rooms/' + id + '/vsig', ev => { try { { const d = JSON.parse(ev.data); onVsig(d); onLinkSig(d); } } catch (e) {} });
  es.onerror = () => { party.sseOK = false; };           // EventSource reconnects by itself and fires PB_CONNECT again
}
function partyDisconnect() { if (party.es) { try { party.es.close(); } catch (e) {} } party.es = null; party.sseOK = false; }
async function partyPoll() {
  party.lastPoll = now;
  try {
    const r = await fetch(API_BASE + '/api/collections/rooms/records/' + party.room.id);
    if (r.status === 404) return roomGone();
    if (r.ok) applyRoom(await r.json());
  } catch (e) {}
}

/* ───────────── entering / leaving ───────────── */
function goParty(from) {
  if (net.user && !fr.list) loadFriends();
  party.from = from || state; party.view = 'menu'; party.msg = ''; party.busy = false;
  if (party.room) { state = 'party'; st = 0; party.view = roomView(); return; }   // still in a room (e.g. came back to the title): resume it
  state = 'party'; st = 0; mode = 'stage';
}
const roomView = () => { const R = party.room; return R.state === 'lobby' ? 'lobby' : R.state === 'between' ? 'between' : R.state === 'done' ? 'end' : (party.pending || party.played === R.round) && state === 'party' ? 'wait' : 'play'; };
function enterRoom(r) {
  party.busy = false;
  if (!r.ok) { party.msg = partyErr(r); party.msgCol = '#FF4D4D'; party.view = 'menu'; state = 'party'; st = 0; return false; }
  party.room = r.data.room; party.you = r.data.you; party.played = -1; party.pending = null; party.msg = ''; party.guideTab = 0; party.previewMode = null;
  saveSession(); partyConnect(); state = 'party'; st = 0; mode = 'stage';
  onRoom(party.room, null);
  return true;
}
async function partyCreate() {
  if (party.busy) return;
  party.busy = true; party.msg = 'ONE MOMENT...'; party.msgCol = '#fff';
  const idn = partyIdentity(), r = await pcall('create', { name: idn.name, color: idn.color, mode: 'versus' });
  if (enterRoom(r)) track('party_create', { signed_in: !!net.user });
}
async function partyJoin(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) { party.msg = 'TYPE THE 4-LETTER ROOM CODE'; party.msgCol = '#FF4D4D'; return; }
  if (party.busy) return;
  party.busy = true; party.msg = 'ONE MOMENT...'; party.msgCol = '#fff'; if (state !== 'party') { state = 'party'; st = 0; }
  let old = null; try { old = JSON.parse(sessionStorage.getItem(PSESSION)); } catch (e) {}
  const idn = partyIdentity(), r = await pcall('join', { code, name: idn.name, color: idn.color, id: old && old.code === code ? old.id : undefined, key: old && old.code === code ? old.key : undefined });
  if (enterRoom(r)) track('party_join', { signed_in: !!net.user, invited: code === PINVITE });
}
const joinTyped = () => partyJoin(inCode ? inCode.value : '');
function joinInvite() { PINVITE_USED = true; partyJoin(PINVITE); }
let PINVITE_USED = false;
const inviteOpen = () => !!PINVITE && !PINVITE_USED;

function partyCleanup() {
  sigSeen.clear();
  voiceStop(false); linkClose(); link.tries = 0; link.tryFor = ''; partyDisconnect(); party.ghost = null; party.cards = null; party.wait = null; party.sig = { q: [], buf: [], busy: false, last: 0, hbAt: 0, round: -1, handler: null, rx: 0, since: 0 }; party.watch = { round: -1, frames: {}, target: null }; party.room = null; party.you = null; party.pending = null; party.played = -1; saveSession();
}
function partyLeave(to) {
  voiceStop(true); if (party.room && party.you) pcall('leave', auth());
  partyCleanup(); mode = 'stage'; parts.length = 0;
  if (to === 'menu') { party.view = 'menu'; party.msg = ''; state = 'party'; st = 0; } else goTitle();
}
function roomGone() {
  if (!party.room) return;
  partyCleanup(); mode = 'stage'; party.view = 'menu'; party.msg = 'ROOM CLOSED'; party.msgCol = '#FFE14D'; state = 'party'; st = 0;
}
/* pagehide also fires when a phone locks, switches app or freezes the tab: that must never kick the player out. Only a real tab close on a
   computer, while still in the lobby, says goodbye; a silent player is closed out by the server's round tick instead. */
const COARSE = matchMedia('(pointer: coarse)').matches;   // not TOUCH: core.js already declares that
addEventListener('pagehide', e => {
  if (COARSE || e.persisted || !party.room || party.room.state !== 'lobby') return;
  if (party.room && party.you) { try { navigator.sendBeacon(API_BASE + '/api/party/leave', new Blob([JSON.stringify(auth())], { type: 'application/json' })); } catch (e) {} }
});

/* ───────────── DUO live relay ─────────────
   Players of a DUO round exchange small input messages {t: type, d: data} through POST /api/party/sig; the server pushes them to the
   other player over the realtime connection (topic rooms/<id>/sig). One request in flight at a time keeps the order, and a message
   type sent with `latest` replaces an older queued one (positions), so slow links just send fewer, fresher updates. */
const SIG_GAP = .05, SIG_HB = .5, SIG_AWAY = 2;
let sigSequence = 0;
const sigEpoch = Math.random().toString(36).slice(2, 10);
const sigSeen = new Map();
function sigStamp(m) { if (!m.n) { m.n = ++sigSequence; m.v = sigEpoch; } return m; }
function sigRestore(S, batch, R) {
  if (party.sig !== S || !party.room || party.room.id !== R.id || party.room.round !== R.round || party.room.state !== 'round' || S.round !== R.round) return false;
  const retry = batch.filter(m => !m.l || !S.q.some(q => q.l && q.t === m.t));
  S.q.unshift(...retry);
  return true;
}
// Spectators receive images only: they never run a friend's game or submit its result.
function partyReceiveFrame(from, data, round) {
  const R = party.room, p = R && R.players.find(p => p.id === from && !p.left);
  if (!R || R.state !== 'round' || round !== R.round || !p || from === (party.you && party.you.id)) return;
  if (partyElimination(R) && p.lives <= 0 || partyTurnMode(R) && from !== R.extra.actor) return;
  if (!data || data.cmd !== undefined && (typeof data.cmd !== 'string' || data.cmd.length > 120) || typeof data.image !== 'string' || data.image.length > 60000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.image)) return;
  if (party.watch.round !== round || party.watch.roomId !== R.id) party.watch = { round, roomId: R.id, frames: {}, target: null };
  const watch = party.watch, previous = watch.frames[from], entry = { image: previous && previous.image, at: previous && previous.at, cmd: typeof data.cmd === 'string' ? data.cmd.slice(0, 120) : '', time: Number.isFinite(data.time) ? Math.max(0, data.time) : 0 };
  watch.frames[from] = entry;
  const image = new Image();
  image.onload = () => {
    const room = party.room, seat = room && room.players.find(p => p.id === from && !p.left);
    if (party.watch !== watch || watch.frames[from] !== entry || !room || room.state !== 'round' || room.round !== round || room.id !== watch.roomId || !seat || partyElimination(room) && seat.lives <= 0) return;
    entry.image = image; entry.at = now;
  };
  image.src = data.image;
}
function partySendFrame(data) {
  const R = party.room, S = party.sig;
  if (!R || R.state !== 'round' || R.mode === 'duo') return;              // DUO: both seats are playing and nobody else can be in the round, so no one watches; frames would only clog the input link
  if (S.round !== R.round) {
    if (R.mode === 'duo' || partyTurnMode(R)) return;
    Object.assign(S, { q: [], buf: [], round: R.round, handler: null, busy: false, frameBusy: false, retryAt: 0, frameRetry: 0, last: 0, hbAt: now });
  }
  const old = S.q.find(m => m.t === 'frame' && m.l);
  if (old) { old.d = data; delete old.n; }
  else S.q.push({ t: 'frame', d: data, l: true });
}
function onSig(d) {
  const S = party.sig, R = party.room; if (!R || !d || !Array.isArray(d.m) || d.from === (party.you && party.you.id)) return;
  S.rx = now;
  d = Object.assign({}, d, { m: d.m.filter(m => {                                // hb / ping / pong are ours, not the game's
    if (Number.isSafeInteger(m.n) && m.n > 0) {
      const key = d.from + ':' + d.round + ':' + (m.v || '') + ':' + (m.l ? m.t : m.n);
      if (sigSeen.has(key) && (!m.l || sigSeen.get(key) >= m.n)) return false;
      sigSeen.set(key, m.n);
      if (sigSeen.size > 1024) sigSeen.delete(sigSeen.keys().next().value);
    }
    if (m.t === 'frame') { partyReceiveFrame(d.from, m.d, d.round); return partyTurnMode(R); }
    if (m.t === '_net_ping') { S.q.unshift({ t: '_net_pong', d: m.d, l: true }); return false; }
    if (m.t === '_net_pong') { gotPong(m.d, 'relay'); return false; }
    return m.t !== 'hb';
  }) });
  if (S.handler && d.round === S.round) { for (const m of d.m) S.handler(m.t, m.d, d.from); return; }
  if (d.round < R.round) return;                                                  // late message from a finished round
  for (const m of d.m) S.buf.push({ round: d.round, t: m.t, d: m.d, from: d.from });   // partner started first: keep it for my own constructor
  if (S.buf.length > 80) S.buf.splice(0, S.buf.length - 80);
}
/* context handed to a DUO microgame: { role: 0|1, partner, send(type, data, latest), onMsg(fn(type, data, senderRole, senderId)), away() } */
function duoCtx(R) {
  const S = party.sig, act = R.players.filter(p => !p.left), n = act.length, i = act.findIndex(p => p.id === party.you.id), pn = act.find(p => p.id !== party.you.id);
  Object.assign(S, { q: [], busy: false, frameBusy: false, retryAt: 0, frameRetry: 0, last: 0, hbAt: now, round: R.round, handler: null, rx: now, since: now });
  S.buf = S.buf.filter(x => x.round === R.round);
  const roleOfSeat = k => (k + R.round) % n, seats = act.map((p, k) => ({ id: p.id, name: p.name, color: p.color, role: roleOfSeat(k), you: k === i }));
  const fromRole = id => { const s = seats.find(x => x.id === id); return s ? s.role : -1; };
  return {
    role: roleOfSeat(i), roles: n, partner: pn ? { name: pn.name, color: pn.color } : null,
    seats, byRole: seats.slice().sort((a, b) => a.role - b.role),   // everybody at the table: byRole[r] = who plays role r
    send(type, data, latest) {
      if (latest) { const k = S.q.findIndex(m => m.t === type && m.l); if (k >= 0) { S.q[k].d = data; delete S.q[k].n; return; } }
      S.q.push({ t: type, d: data === undefined ? null : data, l: !!latest });
    },
    onMsg(fn) { S.handler = (t, d, from) => fn(t, d, fromRole(from), from); S.buf.splice(0).forEach(x => x.round === S.round && S.handler(x.t, x.d, x.from)); },   // fn(type, data, senderRole, senderId): the turn modes (CARDS, BALLOON, LANTERN) key everything by id
  };
}
const duoAway = () => !!party.room && party.room.mode === 'duo' && party.sig.round === party.room.round && now - party.sig.since > SIG_AWAY && now - party.sig.rx > SIG_AWAY;
async function sigFlush() {
  const S = party.sig, R = party.room && Object.assign({}, party.room);
  if (!R || R.state !== 'round' || S.round !== R.round) { S.q.length = 0; return; }
  if (now - S.hbAt > SIG_HB) { S.hbAt = now; if (!S.q.length) S.q.push({ t: 'hb', d: null, l: true }); }
  // Frames have their own request: encoding/uploading a screen must never hold up inputs.
  const frames = S.q.filter(m => m.t === 'frame');
  if (frames.length && !S.frameBusy && now >= (S.frameRetry || 0)) {
    S.q = S.q.filter(m => m.t !== 'frame');
    const batch = [sigStamp(frames[frames.length - 1])], credentials = auth();
    S.frameBusy = batch;
    pcall('sig', Object.assign(credentials, { round: R.round, m: batch })).then(r => {
      if (!r.ok && (r.status === 0 || r.status === 429 || r.status >= 500)) { if (sigRestore(S, batch, R)) S.frameRetry = now + .5; }
      if (r.status === 404 && party.room && party.room.id === R.id) roomGone();
    }).finally(() => { if (S.frameBusy === batch) S.frameBusy = false; });
  }
  const inputs = S.q.filter(m => m.t !== 'frame');
  if (!inputs.length || now < (S.retryAt || 0)) return;
  if (linkUsable()) {
    if (now - S.last < .02) return;
    S.last = now;
    const batch = inputs.slice(0, 20).map(sigStamp), sent = linkSend(R.round, batch);
    S.q = S.q.filter(m => !sent.includes(m));
    return;
  }
  if (S.busy || now - S.last < SIG_GAP) return;
  const batch = []; let size = 0;
  for (const it of inputs) {
    sigStamp(it);
    const n = JSON.stringify(it).length;
    if (batch.length && (batch.length >= 10 || size + n > 500)) break;
    size += n; batch.push(it);
  }
  S.q = S.q.filter(m => !batch.includes(m));
  const credentials = auth();
  S.busy = batch; S.last = now;
  try {
    const r = await pcall('sig', Object.assign(credentials, { round: R.round, m: batch }));
    if (!r.ok && (r.status === 0 || r.status === 429 || r.status >= 500)) { if (sigRestore(S, batch, R)) S.retryAt = now + (r.status === 429 ? 1 : .25); }
    if (r.status === 404 && party.room && party.room.id === R.id) roomGone();
  } finally { if (S.busy === batch) S.busy = false; }
}

/* ───────────── room state machine ───────────── */
function applyRoom(R) {
  if (!R || !party.room || R.id !== party.room.id) return;
  const old = party.room;
  if (old.updated && R.updated && R.updated < old.updated) return;   // stale (poll lost the race with a push)
  party.room = R;
  if (!me()) { roomGone(); return; }                                 // my seat is gone (e.g. dropped while offline)
  onRoom(R, old);
}
function onRoom(R, old) {
  const entered = !old || old.state !== R.state || old.round !== R.round;
  if (R.state === 'lobby') {
    if (!old || old.mode !== R.mode) { party.previewMode = null; party.guideTab = 0; }
    if (R.mode !== 'duo') loadThree();   // every mode but DUO can draw a 3D solo game
    party.played = -1; party.pending = null; party.ghost = null; party.cards = null; party.wait = null;
    if (state === 'play' && mode === 'party') mode = 'stage';
    party.view = 'lobby'; if (state !== 'party') { state = 'party'; st = 0; }
  } else if (R.state === 'round') {
    if (party.played !== R.round) startLocalRound(R);
    else if (state === 'party' && party.view !== 'loading') party.view = 'wait';
  } else if (R.state === 'between') {
    if (state === 'play' && mode === 'party') { state = 'party'; st = 0; }   // the round closed before I finished
    if (entered) { party.seenAt = now; sfx.whoosh(true); }
    party.view = 'between'; if (state !== 'party') { state = 'party'; st = 0; }
  } else if (R.state === 'done') {
    if (entered) { track('party_done', { mode: R.mode, players: R.players.length }); confetti(W / 2, 220, 70); jingleWin(); }
    party.view = 'end'; if (state !== 'party') { state = 'party'; st = 0; }
  }
}
function startLocalRound(R) {
  party.played = R.round; party.pending = null;
  party.watch = { round: R.round, roomId: R.id, frames: {}, target: null };
  if (!partyTurnMode(R) && R.mode !== 'duo') Object.assign(party.sig, { q: [], buf: [], busy: false, frameBusy: false, retryAt: 0, frameRetry: 0, last: 0, hbAt: now, round: R.round, handler: null, rx: now, since: now });
  if (partyElimination(R) && me() && me().lives <= 0) { party.view = 'wait'; state = 'party'; st = 0; return; }
  if (!REGMAP[R.game] && R.game !== 'pc_draw') { party.pending = { round: R.round, r: 'lose', t: 1, pts: 0 }; party.view = 'wait'; state = 'party'; sendReport(); return; }
  mode = 'party'; stage = STAGES[0]; lastOut = null; parts.length = 0;
  const play = () => {
    if (!party.room || party.room.state !== 'round' || party.room.round !== R.round || party.room.id !== R.id || mode !== 'party') return;
    party.view = 'play'; jingleGo(); beginGame();
  };
  if (is3D(R.game) && typeof THREE === 'undefined') { party.view = 'loading'; state = 'party'; st = 0; loadThree().then(play); }
  else play();
}
/* called by main.js when my microgame ends */
function partyLocalDone(outcome) {
  const R = party.room; if (!R) return;
  party.pending = { round: R.round, r: outcome, t: +tt.toFixed(2), pts: Math.floor(cur.pts || 0) };
  state = 'party'; st = 0; party.view = R.state === 'round' ? 'wait' : roomView();
  sendReport();
}
async function sendReport() {
  const p = party.pending; if (!p || !party.room) return;
  party.lastRep = now;
  const r = await pcall('report', Object.assign(auth(), p));
  if (r.ok) { if (party.pending === p) party.pending = null; applyRoom(r.data.room); }
  else if (r.status === 404) roomGone();
  else if (r.status === 409 || r.status === 403) { if (party.pending === p) party.pending = null; partyPoll(); }   // round already over: just resync
}
/* runs every frame from main.js update(): timers for polling, ticking, auto-advance and report retries */
function partyUpdate(dt) {
  const R = party.room; if (!R) return;
  partyGhostUpdate(R, dt); partyWaitUpdate(R, dt);
  if (now - party.lastPoll > (party.sseOK ? 12 : 3)) partyPoll();
  if (state === 'play') sigFlush();
  if (partyTurnMode(R) && R.state === 'round' && now - party.lastTick > 2.5) { party.lastTick = now; pcall('tick', { code: R.code }).then(r => { if (r.ok) applyRoom(r.data.room); }); }
  if (party.pending && now - party.lastRep > 1.5) sendReport();
  if (state !== 'party') return;
  if (!partyTurnMode(R) && R.state === 'round' && !party.pending && now - party.lastTick > 2.5) {          // lets the server close a round a silent player never finished
    party.lastTick = now; pcall('tick', { code: R.code }).then(r => { if (r.ok) applyRoom(r.data.room); });
  }
  if (R.state === 'between' && now - party.seenAt > balloonBetween(R) && now - party.lastAdv > 1.5) {
    party.lastAdv = now; pcall('advance', Object.assign(auth(), { round: R.round })).then(r => { if (r.ok) applyRoom(r.data.room); });
  }
  if (party.view === 'end' && Math.random() < dt * 3 && st < 6) confetti(Math.random() * W, 80, 10);
}
async function partyAct(action, extra) {
  const r = await pcall(action, Object.assign(auth(), extra || {}));
  if (r.ok) { applyRoom(r.data.room); return true; }
  if (r.status === 404) roomGone(); else say(partyErr(r), '#FF4D4D');
  return false;
}
const canStart = R => { const n = R.players.filter(p => !p.left).length; return R.mode === 'duo' ? n >= 2 && n <= 4 : n >= 2; };
const partyStart = () => { if (isHost() && canStart(party.room)) { track('party_start', { mode: party.room.mode, players: party.room.players.length }); partyAct('start'); } };
const MODE_NEXT = { versus: 'team', team: 'duo', duo: 'survival', survival: 'knockout', knockout: 'lantern', lantern: 'cards', cards: 'balloon', balloon: 'versus' };
const partyMode = () => partyAct('mode', { mode: MODE_NEXT[party.room.mode] || 'versus' });
const partyAgain = () => partyAct('again');
async function partyInvite() {
  const R = party.room, url = location.origin + '/r/' + R.code, text = t('Join my MiniCaos room! Code: {code}', { code: R.code });
  track('share_click', { surface: 'party', native: !!navigator.share });
  const r = await shareText(text, url);
  if (r === 'copied') say('LINK COPIED! SEND IT TO YOUR FRIENDS', '#5CFF7A'); else if (r === 'failed') say('COULDN\'T SHARE', '#FF4D4D');
}

/* ───────────── drawing ───────────── */
/* The party shell is drawn in the DUO look (docs/ART-STYLE.md): inked rounded slabs with depth, base/shade/light, chunky plates and name tags, avatars with eyes.
   The shared kit is js/party-ui.js (PARTY_UI). It loads right after this file, so every piece below is built lazily on the first draw (never at load).
   Local extras the kit does not have (TODO: promote into the kit): panel, btn, chip, plaque, sign, heart, crown, fade. Art only: nothing here reads or writes game state,
   and cosmetic motion is a pure function of `now`. */
let PUI = null;
const pui = () => PUI || (PUI = buildPui(PARTY_UI));
function buildPui(U) {
  const { rr, ink, text, outBack, clamp, shade } = U;
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const lum = c => { const [r, g, b] = rgb(c); return (.299 * r + .587 * g + .114 * b) / 255; };
  const WHITE = ['#ffffff', '#b9b3cc'], PRE = { '#5cff7a': 'live', '#4db8ff': 'blue', '#ffe14d': 'yellow', '#ffd23f': 'yellow', '#ff4d4d': 'red', '#ff4d5e': 'red' };
  const faceOf = fill => {   // button fill -> [face, base]: the shared plate presets where they match, else the colour with its own shade
    const f = String(fill || '#fff').toLowerCase();
    if (PRE[f]) return U.PLATE[PRE[f]];
    if (/^#[0-9a-f]{6}$/.test(f) && f !== '#ffffff') return [fill, shade(fill, .36)];
    return WHITE;
  };
  /* text width in the same face text() draws (Fredoka + its spacing for INK, Arial Black otherwise) */
  function tw(s, size, dark) {
    s = t(String(s)); ctx.save();
    ctx.font = dark ? `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif` : `900 ${size}px "Arial Black", Impact, sans-serif`;
    const w = ctx.measureText(s).width + (dark ? s.length * Math.max(.5, size / 24) : 0);
    ctx.restore(); return w;
  }
  const fgOn = fill => (lum(fill) > .78 ? INK : '#fff');
  /* a chunky control plate. Same hit rectangle as core button(); the slab hangs 5-8 px below it. Returns how far the face sits from y (hover lifts, press sinks) so icons can follow */
  function btn(x, y, w, h, label, fn, o = {}) {
    const live = !o.off && !!fn, hv = live && hovered(x, y, w, h), pr = hv && pressing, D = o.depth || (h >= 56 ? 8 : h >= 36 ? 5 : 3);
    const [face, base] = o.off ? U.PLATE.off : faceOf(o.fill), dy = pr ? D - 2 : hv ? -2 : 0, r = Math.min(18, h * .42);
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,28,.26)'; rr(x + 2, y + D + 6, w, h, r); ctx.fill();
    rr(x, y + D, w, h, r); ink(base, 4);
    rr(x, y + dy, w, h, r); ink(face, 4);
    ctx.fillStyle = o.off ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.32)'; rr(x + 9, y + dy + 5, w - 18, clamp(h * .14, 4, 11), 4); ctx.fill();
    if (label) {
      if (o.off) ctx.globalAlpha *= .72;   /* INK keeps the dark Fredoka label (no outline): about 7:1 on the pale off face, still reads as inactive */
      text(label, x + w / 2 + (o.lx || 0), y + dy + h / 2 + 2 + (o.ly || 0), o.size || 26, o.off ? INK : (o.col || fgOn(face)), 'center', o.lw || w - 16);
    }
    ctx.restore();
    if (live) btns.push({ x, y, w, h, fn });
    return dy;
  }
  /* an inked rounded panel with a soft drop shadow, base over a crescent of its own shade, an optional header band / left edge in a colour, and one light strip */
  function panel(x, y, w, h, face, o = {}) {
    const r = o.r == null ? 16 : o.r, sh = o.sh == null ? 6 : o.sh;
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 8, w, h, r); ctx.fill();
    rr(x, y, w, h, r); ink(shade(face, .34), o.o || 4);
    ctx.save(); rr(x, y, w, h, r); ctx.clip();
    ctx.fillStyle = face; rr(x, y - sh, w, h, r); ctx.fill();
    if (o.edge) { ctx.fillStyle = o.edge; rr(x - 4, y, (o.edgeW || 8) + 4, h, 0); ctx.fill(); }
    if (o.band) { ctx.fillStyle = o.band; rr(x, y, w, o.bandH || 7, 0); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.09)'; rr(x + 10, y + (o.band ? (o.bandH || 7) + 4 : 5), w - 20, 5, 2.5); ctx.fill();
    ctx.restore(); ctx.restore();
  }
  /* a small fully round label (a name tag without the pointer). x = left edge, or the centre with o.center. Returns its width */
  function chip(x, y, label, fill, o = {}) {
    const size = o.size || 12, fg = o.fg || fgOn(fill), w = Math.min(o.maxW || 220, tw(label, size, fg === INK) + size * 1.7), h = size * 1.8, x0 = o.center ? x - w / 2 : x;
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,28,.22)'; rr(x0 + 1, y - h / 2 + 3, w, h, h / 2); ctx.fill();
    rr(x0, y - h / 2, w, h, h / 2); ink(fill, o.o || 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.34)'; rr(x0 + h * .3, y - h / 2 + 2, w - h * .6, h * .22, h * .11); ctx.fill();
    text(label, x0 + w / 2, y + 1, size, fg, 'center', w - size * .9);
    ctx.restore(); return w;
  }
  /* a dark rounded strip behind one line of text: status lines and countdowns stay readable over the spinning rays */
  function plaque(cx, cy, label, size, fg, o = {}) {
    if (!label) return 0;
    const w = clamp(tw(label, size, fg === INK) + size * 1.5, o.minW || 0, o.maxW || 744), h = size * 1.75;
    ctx.save(); ctx.globalAlpha *= o.a == null ? .9 : o.a;
    ctx.fillStyle = 'rgba(20,16,28,.25)'; rr(cx - w / 2 + 2, cy - h / 2 + 5, w, h, h / 2); ctx.fill();
    rr(cx - w / 2, cy - h / 2, w, h, h / 2); ink(o.fill || '#171c34', 3);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(cx - w / 2 + h * .35, cy - h / 2 + 3, w - h * .7, h * .16, h * .08); ctx.fill();
    ctx.restore();
    text(label, cx, cy + 1, size, fg, 'center', w - size * 1.2); return w;
  }
  /* a wooden sign on two strings that sways: the round counter */
  function sign(cx, label, size = 28, y = 12) {
    const w = clamp(tw(label, size, false) + 72, 220, 440), h = 42, x0 = cx - w / 2;
    ctx.save(); ctx.translate(cx, -4); ctx.rotate(Math.sin(now * 1.3) * .012); ctx.translate(-cx, 4);
    ctx.lineCap = 'round';
    for (const sx of [x0 + 26, x0 + w - 26]) {
      ctx.beginPath(); ctx.moveTo(sx, -4); ctx.lineTo(sx, y + 8); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#e6c58c'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,16,28,.28)'; rr(x0 + 3, y + 14, w, h, 12); ctx.fill();
    rr(x0, y + 6, w, h, 12); ink('#a5622c', 4);
    rr(x0, y, w, h, 12); ink('#d9944f', 4);
    ctx.strokeStyle = '#c98443'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x0 + 48, y + 9); ctx.quadraticCurveTo(cx - w * .2, y + 5, cx - w * .08, y + 9); ctx.moveTo(cx + w * .14, y + h - 8); ctx.quadraticCurveTo(cx + w * .3, y + h - 4, x0 + w - 46, y + h - 9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.26)'; rr(x0 + 10, y + 4, w - 20, 6, 3); ctx.fill();
    for (const sx of [x0 + 26, x0 + w - 26]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx, y + 8, 3.4, 0, 7); ctx.fill(); ctx.fillStyle = '#e6c58c'; ctx.beginPath(); ctx.arc(sx - 1, y + 7, 1.2, 0, 7); ctx.fill(); }
    text(label, cx, y + h / 2 + 3, size, '#FFE14D', 'center', w - 56);
    ctx.restore(); return w;
  }
  const HEART = 'M0 6 C-10 -1 -7 -9 0 -4 C7 -9 10 -1 0 6 Z', CROWN = 'M-11 6 L-13 -6 L-6 0 L0 -9 L6 0 L13 -6 L11 6 Z';
  function heart(x, y, s, col = '#ff5c8a') {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 8, s / 8);
    U.inkP(U.P(HEART), col, 2.4 * 8 / s);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-3.6, -2.6, 1.9, 1.2, -.6, 0, 7); ctx.fill(); ctx.restore();
  }
  function crown(x, y, s, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 10, s / 10);
    U.inkP(U.P(CROWN), '#FFE14D', 2.6 * 10 / s);
    ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(0, 1, 1.6, 0, 7); ctx.fill(); ctx.restore();
  }
  /* when a player/seat was first drawn: lets a seat pop in with outBack. Cosmetic memo only. */
  const SEEN = Object.create(null);
  const seen = key => { if (SEEN[key] === undefined) { if (Object.keys(SEEN).length > 200) for (const k in SEEN) delete SEEN[k]; SEEN[key] = now; } return now - SEEN[key]; };
  return { U, lum, tw, btn, panel, chip, plaque, sign, heart, crown, seen, fgOn };
}
/* the round-result mark: a glossy inked orb with a tick (win), a cross (lose) or a breathing socket (still playing). Same signature as before; the DUO HUD uses it too */
function statusDot(x, y, r, s) {
  const K = pui(), U = K.U;
  if (s === 'win' || s === 'lose') {
    U.orb(x, y, r, { col: s === 'win' ? '#5CFF7A' : '#ff4d5e', state: 'full', t: now });
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, r * .3); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (s === 'win') { ctx.moveTo(x - r * .48, y + r * .02); ctx.lineTo(x - r * .1, y + r * .42); ctx.lineTo(x + r * .52, y - r * .36); }
    else { ctx.moveTo(x - r * .36, y - r * .36); ctx.lineTo(x + r * .36, y + r * .36); ctx.moveTo(x + r * .36, y - r * .36); ctx.lineTo(x - r * .36, y + r * .36); }
    ctx.stroke(); ctx.restore();
  } else {
    U.orb(x, y, r, { state: 'empty', t: now });
    ctx.save(); ctx.strokeStyle = '#B49CFF'; ctx.globalAlpha = .45 + .45 * Math.sin(now * 8); ctx.lineWidth = Math.max(1.5, r * .22); ctx.beginPath(); ctx.arc(x, y, r * .5, 0, 7); ctx.stroke(); ctx.restore();
  }
}
const partyElimination = R => R.mode === 'survival' || R.mode === 'knockout';
const partyTeam = R => R.mode === 'team' || R.mode === 'duo' || R.mode === 'lantern';
const modeLabel = m => m === 'lantern' ? 'LANTERNS' : m === 'cards' ? 'CARDS' : m === 'balloon' ? 'BALLOON' : m === 'survival' ? 'SURVIVAL' : m === 'knockout' ? 'KNOCKOUT' : m === 'team' ? 'TEAM' : m === 'duo' ? 'CO-OP' : 'VERSUS';
const modeBlurb = m => m === 'lantern' ? 'ONE PLAYS IN THE DARK · THE OTHERS MOVE THE LIGHTS · 3 SHARED LIVES' : m === 'cards' ? 'DRAW CARDS · BEAT THE PILE TO KEEP IT · STEAL WHILE OTHERS PLAY' : m === 'balloon' ? 'ONE PLAYS · THE OTHERS PUMP · WIN TO PASS THE TURN · AVOID THE POP' : m === 'survival' ? '3 LIVES EACH · FAIL AND LOSE A LIFE · LAST PLAYER STANDING WINS' : m === 'knockout' ? 'ONE LIFE · ONE MISTAKE AND YOU ARE OUT · LAST PLAYER WINS' : m === 'duo' ? '2-4 PLAYERS · ONE GAME · A ROLE EACH · WIN OR LOSE TOGETHER' : m === 'team' ? 'TEAMWORK: SHARED LIVES · EVERYONE NEEDS TO PULL THEIR WEIGHT' : 'EVERYONE PLAYS THE SAME GAME · FASTEST AND BEST TAKE THE POINTS';
/* Each mode explains the actor, the companions and the stakes before anyone starts. */
const PARTY_HELP = {
  versus: ['EVERYONE PLAYS', 'EVERYONE: PLAY THE SAME MICROGAME', 'RACE: FINISH FAST TO EARN MORE POINTS', 'WIN: THE HIGHEST SCORE AFTER 6 ROUNDS', 'FOLLOW THE MICROGAME CONTROLS'],
  team: ['WIN TOGETHER', 'EVERYONE: PLAY THEIR MICROGAME', 'HELP: EVERY SUCCESS HELPS THE WHOLE TEAM', 'GOAL: CLEAR 8 ROUNDS WITH SHARED LIVES', 'FOLLOW THE MICROGAME CONTROLS'],
  duo: ['ONE ROLE EACH, ONE TEAM', 'YOU: DO THE ROLE SHOWN BEFORE EACH GAME', 'TEAMMATES: DO THE OTHER PARTS OF THE PUZZLE', 'GOAL: CLEAR 8 ROUNDS TOGETHER', '2 PLAYERS: DUO GAMES · 3-4 PLAYERS: SQUAD GAMES'],
  survival: ['LAST ONE STANDING', 'EVERYONE: PLAY THE SAME MICROGAME', 'FAIL: LOSE ONE OF YOUR 3 LIVES', 'WIN: BE THE LAST PLAYER WITH LIVES', 'OUT? BECOME A GHOST: WIN TRAPS, THEN BOO THE LIVING'],
  knockout: ['ONE MISTAKE AND OUT', 'EVERYONE: PLAY THE SAME MICROGAME', 'FAIL: YOUR ONLY LIFE IS GONE', 'WIN: BE THE LAST PLAYER STANDING', 'OUT? BECOME A GHOST: WIN TRAPS, THEN BOO THE LIVING'],
  lantern: ['LIGHT THE WAY TOGETHER', 'PLAYER: BEAT THE MICROGAME IN THE DARK', 'FRIENDS: MOVE THEIR LIGHTS TO HELP THEM SEE', 'GOAL: CLEAR 12 ROUNDS WITH 3 SHARED LIVES', 'LIGHT: MOUSE / DRAG / ARROW KEYS'],
  cards: ['BUILD A PILE, TAKE THE RISK', 'TURN: DRAW A CARD; PLAY MEANS BEAT THE PILE', 'FRIENDS: STEAL, WIN TRAPS, THEN SABOTAGE', 'WIN: MOST CARDS WHEN THE DECK RUNS OUT', 'FAIL THE PILE: YOUR CARDS GO TO THE POT'],
  balloon: ['PASS THE TURN BEFORE IT POPS', 'PLAYER: WIN THE MICROGAME TO PASS THE TURN', 'FRIENDS: PUMP · FIX JAMS · GRAB GOLD BUBBLES', 'LOSE: THE BALLOON POPS ON YOUR TURN', 'EVERYONE WATCHES THE PLAYER AND BALLOON']
};
const TURN_PRE = 4;   // see balloonPre()
function drawPartyModeIntro(left) {
  const R = party.room, actor = partyActor(R); if (!actor) return;
  const K = pui(), U = K.U, clamp = U.clamp, mine = actor.id === party.you.id, help = PARTY_HELP[R.mode], color = mine ? actor.color : '#FFE14D';
  const G = typeof PARTY_GUIDE !== 'undefined' && PARTY_GUIDE[R.mode], mc = G ? G.color : '#FFE14D', go = left < 1, T = now;
  /* ribbon: the mode's icon and name on a slab in the mode colour */
  const label = modeLabel(R.mode), rw = clamp(K.tw(label, 30, false) + 110, 220, 520), rx = W / 2 - rw / 2;
  ctx.save(); ctx.translate(W / 2, 38); ctx.rotate(Math.sin(T * 1.6) * .012); ctx.translate(-W / 2, -38);
  ctx.fillStyle = 'rgba(20,16,28,.3)'; U.rr(rx + 3, 24, rw, 50, 25); ctx.fill();
  U.rr(rx, 14, rw, 50, 25); U.ink(mc, 4);
  ctx.fillStyle = 'rgba(255,255,255,.34)'; U.rr(rx + 18, 19, rw - 36, 9, 4.5); ctx.fill();
  if (typeof partyModeIcon === 'function') partyModeIcon(R.mode, rx + 36, 39, 26, mc);
  txt(label, W / 2 + 22, 41, 30, '#fff', 'center', rw - 100);
  ctx.restore();
  /* the actor's banner */
  const dyb = K.btn(40, 78, 720, 62, '', null, { fill: color, depth: 7 });
  txt(mine ? 'YOUR TURN TO PLAY!' : t('{name} IS PLAYING', { name: actor.name.toUpperCase() }), W / 2, 110 + dyb, 36, INK, 'center', 640);
  /* the hero: Caos on a little stage, with its name tag */
  const bob = Math.abs(Math.sin(T * 3)) * 6;
  ctx.save(); ctx.fillStyle = 'rgba(20,16,28,.28)'; ctx.beginPath(); ctx.ellipse(W / 2 + 4, 258, 100 - bob, 12, 0, 0, 7); ctx.fill();
  U.rr(W / 2 - 84, 246, 168, 20, 10); U.ink(U.shade(actor.color, .38), 3);
  ctx.save(); U.rr(W / 2 - 84, 246, 168, 20, 10); ctx.clip(); ctx.fillStyle = actor.color; U.rr(W / 2 - 84, 242, 168, 20, 10); ctx.fill(); ctx.restore(); ctx.restore();
  caos(W / 2, 252 - bob, 7.4, { col: actor.color, mood: 'happy' });
  if (R.mode === 'balloon') {
    partyBalloonDraw(690, 190, 30, partyBalloonShown(R), {});
  }
  U.pill(W / 2, 280, mine ? t('YOU') : actor.name, actor.color, true, 12);
  txt(mine ? cur.cmd : R.mode === 'lantern' ? 'YOU MOVE THE LIGHT!' : R.mode === 'balloon' ? 'YOU PUMP THE BALLOON!' : R.extra.phase === 'draw' ? 'WATCH THE NEXT CARD!' : 'YOU CAN STEAL CARDS!', W / 2, 312, 42, '#fff', 'center', 730);
  /* the rule card */
  K.panel(40, 338, 720, 128, '#35406a', { r: 18, band: mc, bandH: 8 });
  txt(mine ? cur.hint : R.mode === 'lantern' ? help[4] : R.mode === 'balloon' ? help[2] : R.extra.phase === 'draw' ? 'THE PLAYER CHOOSES ONE OF THE FACE-DOWN CARDS' : 'TAP A RIVAL TO STEAL ONE CARD PER MICROGAME', W / 2, 372, 24, '#FFE14D', 'center', 680);
  txt(mine ? help[2] : R.mode === 'cards' ? 'WIN TRAPS TO CHARGE SABOTAGE' : help[1], W / 2, 412, 22, '#fff', 'center', 680);
  txt(help[3], W / 2, 446, 18, '#ddd', 'center', 680);
  /* GET READY! pops, then GO! */
  const pre = typeof preMax === 'number' && preMax > 0 ? preMax : 4, k = go ? U.outBack((1 - left) / .25) : 1, bump = go ? 1 + (1 - Math.min(1, (1 - left) / .25)) * .3 : 1 + Math.sin(T * 6) * .03;
  ctx.save(); ctx.translate(W / 2, 508); ctx.scale(bump, bump); txt(go ? 'GO!' : 'GET READY!', 0, 0, 42, '#5CFF7A'); ctx.restore();
  if (!go) U.dots(W / 2, 542, 5, clamp(Math.round(5 * (1 - left / pre)), 0, 5), { r: 7, col: '#5CFF7A', t: T });
  if (R.mode === 'cards') txt(partyCardReveal(R), W / 2, 566, 20, '#F28CB1', 'center', 730);
}
function mini(x, y, p, u) { caos(x, y, u, { col: p.color }); }

function drawParty() {
  const R = party.room, v = party.view;
  bg('#1f2a44', '#26335a', now);
  if (!R || v === 'menu' || v === 'joining') { drawPartyMenu(); vignette(.14); return; }   // no voice button before there is a room
  if (v === 'lobby') drawLobby(R);
  else if (v === 'between') drawBetween(R);
  else if (v === 'end') drawEnd(R);
  else drawWait(R);
  vignette(.14);
  voiceButton(W + OX - 164, 8, 150, 42);
}

function drawPartyMenu() {
  const K = pui(), U = K.U;
  const bob = Math.sin(now * 2) * 2;
  txt('PLAY WITH FRIENDS', 372, 44 + bob, 35, '#FFE14D', 'center', 410);
  K.btn(14, 10, 130, 56, '◄ BACK', () => { goTitle(); }, { size: 22 });
  K.btn(W + OX - 204, 10, 190, 56, 'MY FRIENDS', goFriends, { size: 20, fill: '#B49CFF' });
  if (net.user && frPending() > 0) { U.orb(W + OX - 20, 14, 14, { col: '#ff4d5e', t: now }); txt(String(frPending()), W + OX - 20, 15, 15, '#fff'); }
  ['INVITE FRIENDS', 'CHOOSE A MODE', 'PLAY TOGETHER'].forEach((label, i) => {
    const x = 68 + i * 247;
    U.orb(x, 113, 15, { col: i === 0 ? '#4DB8FF' : i === 1 ? '#B49CFF' : '#7BD88F', t: now, seed: i * 1.3 }); txt(String(i + 1), x, 114, 17, INK); txt(label, x + 24, 113, 15, '#fff', 'left', 192);
  });
  K.panel(40, 158, 720, 112, '#252c4b', { band: '#7BD88F' });
  txt('HOST A PARTY', 64, 192, 26, '#7BD88F', 'left', 330);
  txt('Create a room and invite your friends.', 64, 229, 16, '#fff', 'left', 350);
  K.btn(450, 180, 286, 66, 'CREATE ROOM', partyCreate, { fill: '#5CFF7A', size: 28 });
  K.panel(40, 290, 720, 142, '#252c4b', { band: '#4DB8FF' });
  txt('JOIN A ROOM', 400, 306, 17, '#4DB8FF');
  ctx.save(); U.rr(190, 316, 280, 76, 18); U.ink('#171c34', 4); ctx.restore();       // the slot the code box (a DOM input at 200,322) sits in
  K.btn(480, 322, 120, 64, 'JOIN', joinTyped, { fill: '#4DB8FF', size: 28 });
  txt('Enter the 4-character code shared by the host.', 400, 412, 16, '#ddd', 'center', 680);
  const idn = partyIdentity();
  K.panel(40, 458, 720, 82, '#171c34', { o: 3, sh: 4, edge: idn.color });
  U.avatar(88, 497, 24, idn.color, { mood: 'happy', t: now, bob: true });
  txt(t('PLAYING AS {name}', { name: idn.name.toUpperCase() }), 124, 485, 21, idn.color, 'left', 612);
  txt(net.user ? 'Ready to play with your profile.' : 'Guest play is ready. No account needed.', 124, 519, 16, '#ddd', 'left', 612);
  if (party.msg) K.plaque(W / 2, 571, party.msg, 20, party.msgCol, { maxW: 760 });
  else txt('2-4 PLAYERS · ONLINE · MOUSE, KEYBOARD OR TOUCH', W / 2, 571, 14, '#B49CFF', 'center', 740);
}

function drawLobby(R) {
  const K = pui(), U = K.U, n = R.players.filter(p => !p.left).length, m = partyGuideMode(R), preview = !isHost() && m !== R.mode;
  K.panel(24, 8, 206, 59, '#171c34', { r: 14, o: 3, sh: 4 });
  txt('ROOM CODE', 40, 21, 12, '#aaa', 'left'); txt(R.code, 215, 46, 37, '#FFE14D', 'right', 165);
  txt('YOUR PARTY', W / 2, 29 + Math.sin(now * 2) * 1.5, 28, '#FFE14D');
  txt(t(n === 1 ? '{n} PLAYER CONNECTED' : '{n} PLAYERS CONNECTED', { n }), W / 2, 58, 14, '#ddd');
  for (let i = 0; i < 4; i++) {
    const p = R.players[i], x = 24 + i * 190, y = 82, cy = y + 33, mine = !!p && !!party.you && p.id === party.you.id;
    if (p) {
      const k = U.outBack(K.seen(R.id + p.id) / .35);
      ctx.save(); ctx.translate(x + 88, y + 32); ctx.scale(.9 + .1 * k, .9 + .1 * k); ctx.globalAlpha = Math.min(1, k * 1.5); ctx.translate(-x - 88, -y - 32);
      K.panel(x, y, 176, 64, '#35406a', { r: 14, o: 3, sh: 4, edge: p.color });
      if (R.host === p.id) K.crown(x + 33, y + 8, 9, -.18);
      U.avatar(x + 34, cy + 2, 19, p.color, { mood: 'happy', t: now, seed: i * 1.7, bob: true });
      txt(p.name, x + 62, y + 22, 16, p.color, 'left', 108);
      K.chip(x + 62, y + 46, R.host === p.id ? 'HOST' : mine ? 'YOU' : 'READY', R.host === p.id ? '#FFE14D' : mine ? '#4DB8FF' : '#5b6aa0', { size: 11, maxW: 54 });
      ctx.restore();
      if (voice.on && !mine) {
        const vs = voiceState(p.id); if (vs !== 'none') U.orb(x + 164, y + 11, 5, { col: VCOL[vs], t: now, seed: i });
        if (talking(p.id)) { ctx.save(); ctx.strokeStyle = '#5CFF7A'; ctx.globalAlpha = .65 + .35 * Math.sin(now * 10); ctx.lineWidth = 4; U.rr(x - 2, y - 2, 180, 68, 16); ctx.stroke(); ctx.restore(); }
        K.btn(x + 118, y + 40, 51, 20, voice.mutedBy[p.id] ? 'MUTED' : 'HEAR', () => voiceMuteOther(p.id), { size: 10, fill: voice.mutedBy[p.id] ? '#FF4D4D' : '#fff', depth: 3 });
      }
    } else {
      K.panel(x, y, 176, 64, '#202840', { r: 14, o: 3, sh: 4 });
      ctx.save(); ctx.globalAlpha = .55; U.avatar(x + 34, cy, 19, '#8e8c9c', { ghost: true, mood: 'sleepy', t: now, seed: i * 2.3 }); ctx.restore();
      txt('WAITING...', x + 62, y + 32, 16, '#8e8c9c', 'left', 108);
    }
  }
  K.panel(24, 158, 246, 366, '#171c34', { r: 18 });
  txt(isHost() ? 'CHOOSE A MODE' : 'EXPLORE THE MODES', 40, 177, 15, '#ddd', 'left', 222);
  Object.keys(PARTY_GUIDE).forEach((id, i) => {
    const y = 192 + i * 41, selected = m === id, active = R.mode === id, col = PARTY_GUIDE[id].color;
    const dy = K.btn(34, y, 226, 34, '', () => partyChooseMode(id), { fill: selected ? col : '#303a5b' });
    partyModeIcon(id, 55, y + 17 + dy, 15, col);
    txt(modeLabel(id), 80, y + 18 + dy, 17, selected ? INK : '#fff', 'left', 155);
    if (active) U.orb(246, y + 17 + dy, 5.5, { col: '#5CFF7A', state: 'full', t: now, seed: i });
  });
  drawPartyGuide(R);
  const note = preview ? t('PREVIEW ONLY · ROOM MODE: {mode}', { mode: t(modeLabel(R.mode)) }) : isHost() ? canStart(R) ? 'ROOM READY · PICK A MODE AND START' : 'INVITE A FRIEND TO START' : 'THE HOST CHOOSES THE MODE AND STARTS';
  txt(note, W / 2, 539, 12, preview ? '#FFE14D' : '#ddd', 'center', 746);
  K.btn(24, 547, 134, 43, 'LEAVE', () => partyLeave('menu'), { size: 20, depth: 5 });
  K.btn(174, 547, 206, 43, 'INVITE FRIENDS', partyInvite, { fill: '#4DB8FF', size: 20 });
  if (isHost()) {
    if (canStart(R)) {
      const label = t('START {mode}', { mode: t(modeLabel(R.mode)) }), dy = K.btn(400, 547, 376, 43, label, partyStart, { fill: '#5CFF7A', size: 25, lw: 226, lx: -12 });
      U.keyCap(736, 547 + 21 + dy, 'ENTER');
    } else K.btn(400, 547, 376, 43, 'NEED 2+ PLAYERS', null, { off: true, size: 20, lw: 352 });
  } else K.btn(400, 547, 376, 43, t('WAITING FOR {name} TO START', { name: pName(R, R.host).toUpperCase() }), null, { off: true, size: 17, lw: 352 });
}

/* whom the spectator screens show: everybody else, the living ones among them, and the one being watched (the player's own pick, else whoever is still playing) */
function partyWatchPick(R) {
  const friends = R.players.filter(p => !p.left && p.id !== party.you.id);
  const alive = friends.filter(p => !partyElimination(R) || p.lives > 0), playing = alive.filter(p => !R.cur[p.id]);
  const watch = party.watch;
  if (!alive.some(p => p.id === watch.target) || !watch.manual && playing.length && !playing.some(p => p.id === watch.target)) {
    const candidates = playing.length ? playing : alive;
    watch.target = (candidates.find(p => watch.frames[p.id] && watch.frames[p.id].image) || candidates[0] || {}).id || null;
  }
  return { friends, alive, target: alive.find(p => p.id === watch.target), frame: watch.round === R.round && watch.frames[watch.target] };
}
function drawWait(R) {
  if (partyGhostOn(R)) { partyGhostDraw(R, partyWatchPick(R)); return; }   // SURVIVAL / KNOCKOUT: the eliminated play traps and haunt the living (js/party-ghost.js)
  if (partyWaitOn(R)) { partyWaitDraw(R, partyWatchPick(R)); return; }     // VERSUS / TEAM: a finished player plays traps to sabotage the racers / cheer the team (js/party-wait.js)
  const K = pui(), U = K.U, my = R.cur && party.you && R.cur[party.you.id] || party.pending;
  K.sign(W / 2, t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), 28);
  K.plaque(W / 2, 82, party.view === 'loading' ? 'LOADING 3D GAME...' : partyElimination(R) && me().lives <= 0 ? 'YOU ARE OUT · KEEP WATCHING' : my ? my.r === 'win' ? 'YOU DID IT! WATCH YOUR FRIENDS' : 'ROUND FINISHED · WATCH YOUR FRIENDS' : 'WATCH YOUR FRIENDS PLAY', 22, '#fff', { maxW: 760, a: .8 });
  const { friends, target, frame } = partyWatchPick(R), watch = party.watch, tc = target ? target.color : '#35406a';
  /* the live screen: a chunky inked TV frame in the watched player's colour, with a name tag that points at it */
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,28,.3)'; U.rr(20, 148, 560, 424, 20); ctx.fill();
  U.rr(16, 140, 560, 424, 20); U.ink(U.shade(tc, .3), 4);
  ctx.save(); U.rr(16, 140, 560, 424, 20); ctx.clip(); ctx.fillStyle = tc; U.rr(16, 134, 560, 424, 20); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; U.rr(30, 146, 300, 5, 2.5); ctx.fill();
  U.rr(20, 144, 552, 414, 12); U.ink('#19172d', 3);
  if (frame && frame.image) {
    ctx.save(); U.rr(20, 144, 552, 414, 12); ctx.clip(); ctx.drawImage(frame.image, 20, 144, 552, 414); ctx.restore();
    if (!R.cur[target.id] && now - frame.at > 3) K.plaque(296, 165, 'RECONNECTING TO THE PLAYER...', 18, '#FFE14D', { maxW: 540, a: .92 });
    else if (!R.cur[target.id]) { ctx.fillStyle = '#ff4d5e'; ctx.globalAlpha = .55 + .45 * Math.sin(now * 5); ctx.beginPath(); ctx.arc(550, 166, 6, 0, 7); ctx.fill(); }
  } else {
    ctx.save(); ctx.globalAlpha = .9; U.avatar(296, 330, 34, '#6b6880', { ghost: true, mood: 'sleepy', t: now }); ctx.restore();
    txt('CONNECTING TO THE PLAYER...', 296, 410, 24, '#FFE14D', 'center', 530);
  }
  ctx.restore();
  if (target) K.chip(296, 140, t('WATCHING: {name}', { name: target.name }), target.color, { size: 17, center: true, maxW: 520, o: 3 });
  else K.plaque(296, 119, 'WAITING FOR THE NEXT ROUND', 20, '#ddd', { maxW: 540 });
  txt(frame && frame.cmd || '', 296, 584, 18, '#fff', 'center', 552);
  txt('CHOOSE WHO TO WATCH', 686, 126, 16, '#FFE14D', 'center', 188);
  friends.forEach((p, i) => {
    const y = 154 + i * 124, dead = partyElimination(R) && p.lives <= 0, c = R.cur && R.cur[p.id], sel = p.id === watch.target;
    if (!dead) {
      const dy = K.btn(592, y, 188, 64, p.name, () => { watch.target = p.id; watch.manual = true; }, { size: 20, fill: sel ? '#FFE14D' : p.color, lx: 22, lw: 124 });
      U.avatar(625, y + 32 + dy, 19, p.color, { mood: c ? (c.r === 'win' ? 'happy' : 'sad') : 'eager', look: [-1, 0], t: now, seed: i * 1.9 });
    } else {
      K.btn(592, y, 188, 64, p.name, null, { off: true, size: 20, lx: 22, lw: 124 });
      ctx.save(); ctx.globalAlpha = .8; U.avatar(625, y + 32, 19, '#8e8c9c', { ghost: true, mood: 'sleepy', t: now, seed: i * 1.9 }); ctx.restore();
    }
    const tag = dead ? 'ELIMINATED' : c ? 'FINISHED' : 'PLAYING NOW', tcol = dead ? '#F28CB1' : c ? '#ddd' : '#7BD88F';
    const cw = K.chip(686, y + 90, tag, '#171c34', { size: 14, fg: tcol, center: true, maxW: 176 });
    if (!dead && !c && cw < 150) U.orb(686 - cw / 2 - 11, y + 90, 4.5, { col: '#5CFF7A', state: 'pulse', t: now, seed: i });
    if (partyElimination(R)) { const lbl = t('{n} LIVES', { n: p.lives }), w = K.tw(lbl, 15, false); txt(lbl, 686 + 9, y + 112, 15, '#ddd', 'center', 150); K.heart(686 + 9 - Math.min(w, 150) / 2 - 12, y + 112, 9, p.lives > 0 ? '#ff5c8a' : '#6b6880'); }
  });
  K.btn(14, 10, 130, 44, 'LEAVE', () => partyLeave(), { size: 18 });
}

function drawBetween(R) {
  const L = R.last; if (!L) return;
  const K = pui(), U = K.U;
  K.sign(W / 2, partyTurnMode(R) ? partyTurnLabel(R) : t('ROUND {n} / {total}', { n: L.round + 1, total: R.total }), 30);
  const g = REGMAP[L.game]; I18N.scope = I18N.scopeOf(L.game); K.plaque(W / 2, 82, g ? g.name : '', 22, '#fff', { maxW: 700, a: .85 }); I18N.scope = '';
  let y0 = 118;
  const leave = () => K.btn(14, 10, 130, 44, 'LEAVE', () => partyLeave(), { size: 18 });
  if (R.mode === 'balloon') {
    drawBalloonBetween(R, L);
    if (L.final) K.plaque(W / 2, 566, t('FINAL RESULTS IN {n}', { n: Math.max(0, Math.ceil(balloonBetween(R) - (now - party.seenAt))) }), 24, '#fff', { maxW: 700 });
    leave();
    return;
  }
  if (partyTeam(R)) {
    U.badge(L.teamWin ? 'TEAM WIN!' : 'TEAM FAILED!', W / 2, 130, 34, L.teamWin ? '#5CFF7A' : '#ff4d5e', '#fff', U.outBack(st / .3), L.teamWin ? -.03 : .03, 420);
    for (let i = 0; i < 4; i++) {
      const alive = i < R.lives;
      ctx.save(); if (!alive) ctx.globalAlpha = .85;
      U.avatar(W / 2 - 108 + i * 72, 184, 13, alive ? OR : '#6b6880', { mood: alive ? (L.teamWin ? 'happy' : 'panic') : 'sad', t: now, seed: i * 1.3, bob: alive });
      ctx.restore();
    }
    K.plaque(W / 2, 219, t('TEAM SCORE {n}', { n: R.teamScore }), 20, '#FFE14D', { maxW: 500 }); y0 = 240;
  }
  const rows = L.results.slice().sort((a, b) => b.award - a.award || (a.r === 'win' ? 0 : 1) - (b.r === 'win' ? 0 : 1) || a.t - b.t);
  const rh = partyTeam(R) ? 62 : 74, MEDAL = ['#FFE14D', '#cfd8e6', '#e0955a'];
  rows.forEach((x, i) => {
    const p = R.players.find(q => q.id === x.id); if (!p) return;
    const y = y0 + i * rh, h = rh - 10, cy = y + h / 2, k = easeOut((st - i * .1) / .25), gold = x.award > 0 && i === 0 && R.mode === 'versus';
    ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * 60, 0);
    K.panel(60, y, 680, h, gold ? '#5a4a2a' : '#35406a', { r: 16, o: 3, sh: 5, edge: p.color });
    if (R.mode === 'versus') { U.orb(96, cy, 17, { col: MEDAL[i] || '#8f88a6', t: now, seed: i }); txt('#' + (i + 1), 96, cy + 1, 16, INK, 'center', 28); }
    if (gold) K.crown(150, cy - h * .5 + 1, 9, -.2);
    U.avatar(150, cy + 1, Math.min(20, h * .4), p.color, { mood: x.r === 'win' ? 'happy' : x.r === 'lose' ? 'sad' : 'idle', t: now, seed: i * 1.7 });
    K.chip(184, cy, p.name, p.color, { size: 18, maxW: 230, o: 3 });
    statusDot(448, cy, 14, x.r);
    txt(x.pts > 0 ? t('{n} PTS', { n: x.pts }) : x.r === 'win' ? x.t.toFixed(1) + 's' : '-', 524, cy, 20, '#ddd', 'center', 90);
    if (partyElimination(R)) { const lbl = t('{n} LIVES', { n: p.lives }), w = Math.min(180, K.tw(lbl, 22, false)); txt(lbl, 716, cy, 22, p.lives ? '#5CFF7A' : '#FF4D4D', 'right', 180); K.heart(716 - w - 14, cy, 11, p.lives ? '#ff5c8a' : '#6b6880'); }
    if (R.mode === 'cards') txt(t('{n} CARDS', { n: p.score }), 716, cy, 22, '#FFE14D', 'right', 180);
    if (R.mode === 'balloon') txt(R.extra.loser === p.id ? 'POPPED!' : x.r === 'win' ? 'TURN PASSED!' : 'TRY AGAIN!', 716, cy, 20, '#FFE14D', 'right', 180);
    if (R.mode === 'versus') { if (x.award) K.chip(614, cy, '+' + x.award, '#FFE14D', { size: 17, center: true, maxW: 76, o: 3 }); txt(String(p.score), 720, cy, 26, '#fff', 'right', 70); }
    ctx.restore();
  });
  const left = Math.max(0, Math.ceil(balloonBetween(R) - (now - party.seenAt)));
  K.plaque(W / 2, 566, L.final ? t('FINAL RESULTS IN {n}', { n: left }) : t('NEXT ROUND IN {n}', { n: left }), 24, '#fff', { maxW: 700 });
  leave();
}

function drawEnd(R) {
  const K = pui(), U = K.U, team = partyTeam(R), sorted = R.players.filter(p => !p.left).slice().sort((a, b) => (partyElimination(R) ? b.lives - a.lives : 0) || b.score - a.score);
  const cleared = team && R.lives > 0;
  const tied = partyElimination(R) && sorted.length > 1 && sorted[0].lives === sorted[1].lives && sorted[0].score === sorted[1].score;
  const head = R.mode === 'balloon' ? (R.extra.loser ? t('{name} POPPED THE BALLOON!', { name: pName(R, R.extra.loser).toUpperCase() }) : 'DRAW!') : tied ? 'DRAW!' : team ? (cleared ? 'TEAM CLEARED!' : 'GAME OVER') : t('{name} WINS!', { name: sorted[0] ? sorted[0].name.toUpperCase() : '' });
  const gk = st < .14 ? 2.6 - 1.6 * easeOut(st / .14) : 1, hc = team && !cleared ? '#FF4D4D' : '#FFE14D';
  /* light rays behind the headline, and a star at each end (the legs headline) */
  ctx.save(); ctx.translate(W / 2, 92); ctx.fillStyle = team && !cleared ? 'rgba(255,77,94,.1)' : 'rgba(255,225,77,.11)';
  for (let i = 0; i < 14; i++) { const a0 = now * .25 + i * Math.PI / 7, a1 = a0 + .13; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * 270, Math.sin(a0) * 270); ctx.lineTo(Math.cos(a1) * 270, Math.sin(a1) * 270); ctx.fill(); }
  ctx.restore();
  /* the headline fits 600 px (it shrinks, never squeezes) so it stays clear of the voice button in the top-right corner */
  const hs = Math.min(56, Math.floor(56 * 600 / Math.max(1, K.tw(head, 56, false)))), hw = Math.min(600, K.tw(head, hs, false)) * gk;
  const hy = team ? 90 : 96;
  ctx.save(); ctx.translate(W / 2, hy); ctx.rotate(-.04); ctx.scale(gk, gk); txt(head, 5, 6, hs, '#14101d', 'center', 600); txt(head, 0, 0, hs, hc, 'center', 600); ctx.restore();
  if (st > .14 && hw < 640) for (const sd of [-1, 1]) { const sx = W / 2 + sd * Math.min(W / 2 - 34, hw / 2 + 36), sc = 1 + Math.sin(now * 5 + sd) * .12; ctx.save(); ctx.translate(sx, hy + Math.sin(now * 3 + sd) * 3); ctx.scale(sc, sc); star(0, 0, 17, 8, 5, now * 1.2 * sd, hc, 3); ctx.restore(); }
  if (team) K.plaque(W / 2, 142, t('TEAM SCORE {n}', { n: R.teamScore }), 30, '#fff', { maxW: 500 });
  const MEDAL = ['#FFE14D', '#cfd8e6', '#e0955a'];
  sorted.forEach((p, i) => {
    const y = 170 + i * 74, k = easeOut((st - .3 - i * .12) / .3), top = !team && i === 0, hop = top ? Math.abs(Math.sin(now * 6)) * 12 : 0;
    ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * 80, 0);
    K.panel(110, y, 580, 64, top ? '#5a4a2a' : '#35406a', { r: 16, o: 3, sh: 5, edge: p.color });
    if (!team) { U.orb(150, y + 32, 19, { col: MEDAL[i] || '#8f88a6', t: now, seed: i }); txt('#' + (i + 1), 150, y + 33, 18, INK, 'center', 30); }
    if (top) K.crown(224, y + 6 - hop, 11, -.2);
    U.avatar(224, y + 33 - hop, 22, p.color, { mood: team ? (cleared ? 'happy' : 'sad') : (top ? 'happy' : i === sorted.length - 1 && sorted.length > 2 ? 'sad' : 'idle'), t: now, seed: i * 1.7 });
    K.chip(262, y + 32, p.name, p.color, { size: 20, maxW: 280, o: 3 });
    if (!team) txt(R.mode === 'balloon' ? (p.id === R.extra.loser ? 'POPPED!' : 'SAFE!') : R.mode === 'cards' ? t('{n} CARDS', { n: p.score }) : String(p.score), 666, y + 32, 30, '#fff', 'right', 110);
    else if (R.lives > 0) { ctx.save(); ctx.translate(660, y + 32); ctx.rotate(Math.sin(now * 3 + i) * .12); star(0, 0, 20, 9, 5, -Math.PI / 2, '#FFE14D', 3); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-6, -6, 3.5, 2, -.6, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.restore();
  });
  drawParts();
  if (st > .6) {
    const pop = U.outBack((st - .6) / .3);
    if (isHost()) { const dy = K.btn(130, 500, 270, 70, 'PLAY AGAIN', partyAgain, { fill: '#5CFF7A', size: 28, ly: TOUCH ? 0 : -12 }); U.keyCap(265, 552 + dy, 'ENTER'); }
    else K.plaque(265, 535, 'WAITING FOR THE HOST...', 20, '#fff', { maxW: 260 });
    K.btn(420, 500, 250, 70, 'LEAVE', () => partyLeave(), { size: 30 });
  }
}

/* DUO: who is who. The intro card (before the game starts) shows both players side by side with their role and one short line;
   during play a coloured badge + a frame in YOUR colour keep reminding you which one you are. */
const DUO_T = 1.9, DUO_A = 2.4, DUO_B = 2.1, DUO_C = .9, DUO_PRE = DUO_T + DUO_A + DUO_B + DUO_C, DUO_WAIT = 1.5;   // THE TEAM (1.9 s) -> YOU (2.4 s) -> YOUR FRIEND (2.1 s) -> GO (.9 s); keep PRE_MS_DUO in pocketbase/pb_hooks/party.js in sync
function duoMeColor() { const m = me(); return m ? m.color : '#FFE14D'; }
function duoBadge(pn) {
  const c = duoMeColor(), K = pui(), U = K.U;
  ctx.save(); U.rr(4, 4, W - 8, H - 8, 18); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = c; ctx.stroke(); ctx.restore();   // an inked frame in YOUR colour
  const x = 10 - OX;
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,28,.28)'; U.rr(x + 2, 88 + 5, 300, 34, 17); ctx.fill();
  U.rr(x, 88, 300, 34, 17); U.ink(c, 3);
  ctx.fillStyle = 'rgba(255,255,255,.34)'; U.rr(x + 12, 91, 276, 7, 3.5); ctx.fill();
  ctx.restore();
  txt(t('YOU: {role}', { role: t(cur.roleLabel) }), 20 - OX, 106, 20, INK, 'left', 282);
  const R = party.room, act = R.players.filter(p => !p.left), n = act.length;
  if (cur.roles) act.filter(p => p.id !== party.you.id).forEach((p, k) => { const role = cur.roles[(act.findIndex(q => q.id === p.id) + R.round) % n]; if (role) txt(t('{name}: {role}', { name: p.name.toUpperCase(), role: t(role.label) }), 14 - OX, 140 + k * 17, 15, p.color, 'left', 290); });
}
/* intro card, four beats: 1 the game and who does what (the whole team at a glance), 2 what YOU do (animated demo + the control), 3 what your friend does, 4 get ready / GO */
function drawDuoIntro(left) {
  const R = party.room, m = me(), act = R.players.filter(p => !p.left), others = act.filter(p => p.id !== party.you.id); if (!m || !others.length || !cur.roles) return;
  const K = pui(), U = K.U;
  const n = act.length, roleOf = p => cur.roles[(act.findIndex(q => q.id === p.id) + R.round) % n], mine = cur.roles[cur.role];
  const el = DUO_PRE - left, beat = el < DUO_T ? 0 : el < DUO_T + DUO_A ? 1 : el < DUO_T + DUO_A + DUO_B ? 2 : 3, bt = el - [0, DUO_T, DUO_T + DUO_A, DUO_T + DUO_A + DUO_B][beat];
  const k = Math.min(1, bt / .22), pop = 1 + (1 - k) * .25, pulse = .5 + .5 * Math.sin(now * 9);
  const steps = ['THE TEAM', 'YOU', n > 2 ? 'YOUR TEAM' : 'YOUR FRIEND', 'GO!'], stepCol = ['#FFE14D', m.color, others[0].color, '#5CFF7A'];
  steps.forEach((sl, i) => {   // the three beats as plates: the current one is lit and bobs, the others sit dim
    const x = 106 + i * 196, on = i === beat, lbl = String(i + 1) + ' · ' + t(sl);
    ctx.save(); ctx.globalAlpha = on ? 1 : .45;
    K.btn(x - 90, 14 - (on ? Math.abs(Math.sin(now * 5)) * 2 : 0), 180, 34, lbl, null, { fill: on ? stepCol[i] : '#3a3550', size: 18, depth: 4, lw: 168, col: on ? (K.lum(stepCol[i]) > .6 ? INK : '#fff') : '#fff' });
    ctx.restore();
  });
  const card = (p, r, x, y, w, h, tag) => {   // one player's role card: avatar, name, role, one line
    K.panel(x, y, w, h, '#2b2845', { r: 18 });
    ctx.save(); ctx.strokeStyle = p.color; ctx.lineWidth = 6; U.rr(x + 3, y + 3, w - 6, h - 6, 15); ctx.stroke(); ctx.restore();
    U.avatar(x + 50, y + h / 2 + 8, Math.min(30, h * .2), p.color, { mood: 'happy', t: now, seed: x * .01 + y * .02, bob: true });
    txt(tag ? t('YOU') : p.name.toUpperCase(), x + w / 2 + 38, y + 34, 22, p.color, 'center', w - 110);
    txt(r.label, x + w / 2 + 38, y + h / 2 + 4, w > 300 ? 34 : 26, '#FFE14D', 'center', w - 110); txt(r.short, x + w / 2 + 38, y + h - 26, 15, '#fff', 'center', w - 110);
  };
  if (beat === 0) {   // the whole team at a glance: which game, and that every player has a different job
    ctx.save(); ctx.translate(W / 2, 330); ctx.scale(pop, pop); ctx.translate(-W / 2, -330); ctx.globalAlpha = k;
    const gm = REGMAP[R.game]; I18N.scope = I18N.scopeOf(R.game);
    K.btn(40, 64, 720, 62, '', null, { fill: '#FFE14D', depth: 7 });
    txt(gm ? t(gm.name) : '', W / 2, 100, 40, INK, 'center', 680); I18N.scope = '';
    txt('EVERYONE HAS A DIFFERENT JOB', W / 2, 160, 30, '#fff', 'center', 740);
    if (n === 2) [[m, mine, true, 40], [others[0], roleOf(others[0]), false, 420]].forEach(([p, r, tag, x]) => card(p, r, x, 196, 340, 190, tag));
    else act.forEach((p, j) => card(p, p === m ? mine : roleOf(p), 60 + (j % 2) * 340, 190 + Math.floor(j / 2) * 140, 320, 130, p === m));
    K.btn(80, 506, 640, 52, '', null, { fill: '#fff', depth: 6 });
    txt('WORK TOGETHER - A FAILED ROUND COSTS A SHARED LIFE', W / 2, 533, 22, INK, 'center', 610);
    ctx.restore();
  } else if (beat < 3 && (beat === 1 || n === 2)) {
    const you = beat === 1, p = you ? m : others[0], r = you ? mine : roleOf(others[0]);
    ctx.save(); ctx.translate(W / 2, 330); ctx.scale(pop, pop); ctx.translate(-W / 2, -330); ctx.globalAlpha = k;
    K.btn(40, 64, 650, 62, '', null, { fill: p.color, depth: 7 });
    txt(you ? 'YOU DO THIS' : t('{name} DOES THIS', { name: p.name.toUpperCase() }), 365, 100, 44, INK, 'center', 620);
    U.avatar(88, 184, 40, p.color, { mood: 'happy', t: now, bob: true });
    txt(r.label, 470, 168, 56, '#FFE14D', 'center', 560); txt(r.short, 470, 212, 26, '#fff', 'center', 560);
    K.panel(140, 236, 520, 240, '#2b2845', { r: 18 });
    ctx.save(); ctx.strokeStyle = p.color; ctx.lineWidth = 6; U.rr(143, 239, 514, 234, 15); ctx.stroke(); ctx.restore();
    ctx.save(); U.rr(146, 242, 508, 228, 12); ctx.clip(); ctx.translate(140, 236); try { r.demo(bt + (you ? 0 : 1.3)); } catch (e) {} ctx.restore();
    K.btn(160, 494, 480, 52, '', null, { fill: '#fff', depth: 6 });
    txt(r.how, W / 2, 522, 30, INK, 'center', 460);
    txt(you ? (n > 2 ? 'YOUR TEAM DOES THE OTHER PARTS ON THEIR OWN SCREENS' : 'YOUR FRIEND DOES THE OTHER PART ON THEIR OWN SCREEN') : 'YOU WATCH - THEY DO THIS ON THEIR SCREEN', W / 2, 584, 17, '#c9c6e0', 'center', 740);
    ctx.restore();
  } else if (beat === 2) {   // SQUAD: the whole team at once, one card per teammate
    ctx.save(); ctx.translate(W / 2, 330); ctx.scale(pop, pop); ctx.translate(-W / 2, -330); ctx.globalAlpha = k;
    txt('THE TEAM', W / 2, 108, 52, '#fff'); others.forEach((p, j) => card(p, roleOf(p), 60 + (j % 2) * 340, 140 + Math.floor(j / 2) * 200, 320, 180, false));
    txt('EACH DOES THEIR PART ON THEIR OWN SCREEN', W / 2, 584, 17, '#c9c6e0', 'center', 740); ctx.restore();
  } else {
    txt('GET READY!', W / 2, 112, 56, '#fff');
    if (n === 2) [[m, mine, true, 40], [others[0], roleOf(others[0]), false, 420]].forEach(([p, r, tag, x]) => card(p, r, x, 170, 340, 190, tag));
    else act.forEach((p, j) => card(p, p === m ? mine : roleOf(p), 60 + (j % 2) * 340, 140 + Math.floor(j / 2) * 140, 320, 130, p === m));
    ctx.save(); ctx.translate(W / 2, 470); ctx.scale(1 + pulse * .15, 1 + pulse * .15); txt('GO!', 0, n > 2 ? 90 : 40, n > 2 ? 90 : 120, '#5CFF7A', 'center', 600); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
/* in-game overlay for a party round: who has finished (live) + round counter. Called by main.js render() while playing. */
function drawPartyHud() {
  const R = party.room; if (!R) return;
  const K = pui(), U = K.U, act = R.players.filter(p => !p.left);
  ctx.save(); ctx.globalAlpha = .72; U.rr(10 - OX, 35, 24 + act.length * 44, 46, 16); U.ink('#171c34', 3); ctx.restore();   // a rounded tray for the player chips
  act.forEach((p, i) => { const c = R.cur && R.cur[p.id], x = 36 - OX + i * 44;
    U.avatar(x, 62, 13, p.color, { mood: c ? (c.r === 'win' ? 'happy' : 'sad') : 'idle', t: now, seed: i * 1.3 });
    if (c) statusDot(x + 13, 46, 8, c.r);
    if (voice.on && talking(p.id === party.you.id ? 'me' : p.id)) { ctx.save(); ctx.fillStyle = '#5CFF7A'; U.rr(x - 17, 76, 34, 5, 2.5); ctx.fill(); ctx.restore(); } });
  if (voice.on) txt(voice.muted ? 'MIC MUTED' : 'MIC ON', W + OX - 16, 84, 14, voice.muted ? '#FFE14D' : '#5CFF7A', 'right');
  txt(partyTurnMode(R) ? partyTurnLabel(R) : t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), W + OX - 16, 30, 22, '#fff', 'right', 200);
  if (R.mode === 'duo') {
    const pn = act.find(p => p.id !== party.you.id);
    if (pn && cur && cur.roleLabel) duoBadge(pn);
    if (linkLabel()) txt(linkLabel(), 14 - OX, 162, 13, link.via === 'p2p' ? '#5CFF7A' : '#ddd', 'left', 200);
    if (duoAway() && state === 'play' && !outcome) { ctx.save(); ctx.globalAlpha = .85; U.rr(40 - OX, 280, VW - 80, 70, 22); U.ink('#171c34', 4); ctx.restore(); txt(t('{name} IS AWAY', { name: pn ? pn.name.toUpperCase() : '?' }), W / 2, 315, 34, '#FFE14D', 'center', 760); }
  }
  if (partyTeam(R) || partyElimination(R)) txt(t('LIVES {n}', { n: partyElimination(R) ? me().lives : R.lives }), W + OX - 16, 60, 20, '#FF4D9E', 'right');
  else { const m = me(); if (m) txt(R.mode === 'cards' ? t('{n} CARDS', { n: m.score }) : R.mode === 'balloon' ? t('PLAYER: {name}', { name: partyActor(R).name }) : String(m.score), W + OX - 16, 60, 22, '#FFE14D', 'right'); }
  if (typeof sabPopsDraw === 'function') sabPopsDraw();   // toasts and badges of the sabotage module also reach a screen that draws no sabotage UI of its own (once per frame)
}
