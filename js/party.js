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
const NEXT_ROUND_S = 4.2;                                  // results stay up this long before anyone asks for the next round

const party = {
  view: 'menu',          // menu | joining | lobby | play | wait | between | end
  room: null,            // latest room record from the server (never contains the secret keys)
  you: null,             // { id, key }: my seat and its secret
  busy: false, msg: '', msgCol: '#FF4D4D',
  es: null, sseOK: false,
  played: -1,            // round I have already started locally
  pending: null,         // my result for the current round, until the server has it
  seenAt: 0, lastPoll: 0, lastTick: 0, lastAdv: 0, lastRep: 0,
  from: 'title',
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
  try {
    const h = { 'Content-Type': 'application/json' }; if (net.token) h.Authorization = net.token;
    const r = await fetch(API_BASE + '/api/party/' + action, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: j };
  } catch (e) { return { ok: false, status: 0, data: { error: 'Server unreachable' } }; }
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
  party.room = r.data.room; party.you = r.data.you; party.played = -1; party.pending = null; party.msg = '';
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
  voiceStop(false); linkClose(); link.tries = 0; link.tryFor = ''; partyDisconnect(); party.sig = { q: [], buf: [], busy: false, last: 0, hbAt: 0, round: -1, handler: null, rx: 0, since: 0 }; party.room = null; party.you = null; party.pending = null; party.played = -1; saveSession();
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
addEventListener('pagehide', () => {
  if (party.room && party.you) { try { navigator.sendBeacon(API_BASE + '/api/party/leave', new Blob([JSON.stringify(auth())], { type: 'application/json' })); } catch (e) {} }
});

/* ───────────── DUO live relay ─────────────
   Players of a DUO round exchange small input messages {t: type, d: data} through POST /api/party/sig; the server pushes them to the
   other player over the realtime connection (topic rooms/<id>/sig). One request in flight at a time keeps the order, and a message
   type sent with `latest` replaces an older queued one (positions), so slow links just send fewer, fresher updates. */
const SIG_GAP = .1, SIG_HB = .5, SIG_AWAY = 2;
function onSig(d) {
  const S = party.sig, R = party.room; if (!R || !d || !d.m || d.from === (party.you && party.you.id)) return;
  S.rx = now;
  d = Object.assign({}, d, { m: d.m.filter(m => {                                // hb / ping / pong are ours, not the game's
    if (m.t === 'ping') { S.q.unshift({ t: 'pong', d: m.d, l: true }); return false; }
    if (m.t === 'pong') { gotPong(m.d, 'relay'); return false; }
    return m.t !== 'hb';
  }) });
  if (S.handler && d.round === S.round) { for (const m of d.m) S.handler(m.t, m.d); return; }
  if (d.round < R.round) return;                                                  // late message from a finished round
  for (const m of d.m) S.buf.push({ round: d.round, t: m.t, d: m.d });   // partner started first: keep it for my own constructor
  if (S.buf.length > 80) S.buf.splice(0, S.buf.length - 80);
}
/* context handed to a DUO microgame: { role: 0|1, partner, send(type, data, latest), onMsg(fn(type, data)), away() } */
function duoCtx(R) {
  const S = party.sig, act = R.players.filter(p => !p.left), i = act.findIndex(p => p.id === party.you.id), pn = act.find(p => p.id !== party.you.id);
  Object.assign(S, { q: [], busy: false, last: 0, hbAt: now, round: R.round, handler: null, rx: now, since: now });
  S.buf = S.buf.filter(x => x.round === R.round);
  return {
    role: (i + R.round) % 2, roles: 2, partner: pn ? { name: pn.name, color: pn.color } : null,
    send(type, data, latest) {
      if (latest) { const k = S.q.findIndex(m => m.t === type && m.l); if (k >= 0) { S.q[k].d = data; return; } }
      S.q.push({ t: type, d: data === undefined ? null : data, l: !!latest });
    },
    onMsg(fn) { S.handler = fn; S.buf.splice(0).forEach(x => x.round === S.round && fn(x.t, x.d)); },
  };
}
const duoAway = () => !!party.room && party.room.mode === 'duo' && party.sig.round === party.room.round && now - party.sig.since > SIG_AWAY && now - party.sig.rx > SIG_AWAY;
async function sigFlush() {
  const S = party.sig, R = party.room; if (!R || R.mode !== 'duo' || R.state !== 'round' || S.round !== R.round) { S.q.length = 0; return; }
  if (now - S.hbAt > SIG_HB) { S.hbAt = now; if (!S.q.length) S.q.push({ t: 'hb', d: null, l: true }); }
  const direct = linkUsable();                                                   // DataChannel to the partner: no HTTP round trip
  if (direct) { if (!S.q.length || now - S.last < .03) return; S.last = now; linkSend(R.round, S.q.splice(0, 20)); return; }
  if (S.busy || !S.q.length || now - S.last < SIG_GAP) return;
  const m = []; let size = 0;
  while (S.q.length && m.length < 10) { const n = JSON.stringify(S.q[0]).length; if (m.length && size + n > 440) break; size += n; const it = S.q.shift(); m.push({ t: it.t, d: it.d }); }
  S.busy = true; S.last = now;
  try { const r = await pcall('sig', Object.assign(auth(), { round: R.round, m })); if (r.status === 404) roomGone(); } finally { S.busy = false; }
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
    party.played = -1; party.pending = null;
    if (state === 'play' && mode === 'party') mode = 'stage';
    party.view = 'lobby'; if (state !== 'party') { state = 'party'; st = 0; }
  } else if (R.state === 'round') {
    if (party.played !== R.round) startLocalRound(R);
    else if (state === 'party') party.view = 'wait';
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
  if (!REGMAP[R.game]) { party.pending = { round: R.round, r: 'lose', t: 1, pts: 0 }; party.view = 'wait'; state = 'party'; sendReport(); return; }
  mode = 'party'; stage = STAGES[0]; lastOut = null; parts.length = 0;
  party.view = 'play'; jingleGo(); beginGame();
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
  if (now - party.lastPoll > (party.sseOK ? 12 : 3)) partyPoll();
  if (R.mode === 'duo' && state === 'play') sigFlush();
  if (party.pending && now - party.lastRep > 1.5) sendReport();
  if (state !== 'party') return;
  if (R.state === 'round' && !party.pending && now - party.lastTick > 2.5) {          // lets the server close a round a silent player never finished
    party.lastTick = now; pcall('tick', { code: R.code }).then(r => { if (r.ok) applyRoom(r.data.room); });
  }
  if (R.state === 'between' && now - party.seenAt > NEXT_ROUND_S && now - party.lastAdv > 1.5) {
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
const canStart = R => { const n = R.players.filter(p => !p.left).length; return R.mode === 'duo' ? n === 2 : n >= 2; };
const partyStart = () => { if (isHost() && canStart(party.room)) { track('party_start', { mode: party.room.mode, players: party.room.players.length }); partyAct('start'); } };
const MODE_NEXT = { versus: 'team', team: 'duo', duo: 'versus' };
const partyMode = () => partyAct('mode', { mode: MODE_NEXT[party.room.mode] || 'versus' });
const partyAgain = () => partyAct('again');
async function partyInvite() {
  const R = party.room, url = location.origin + '/r/' + R.code, text = t('Join my Claude Ware room! Code: {code}', { code: R.code });
  track('share_click', { surface: 'party', native: !!navigator.share });
  const r = await shareText(text, url);
  if (r === 'copied') say('LINK COPIED! SEND IT TO YOUR FRIENDS', '#5CFF7A'); else if (r === 'failed') say('COULDN\'T SHARE', '#FF4D4D');
}

/* ───────────── drawing ───────────── */
function statusDot(x, y, r, s) {
  if (s === 'win') { circ(x, y, r, '#5CFF7A', 3); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r * .5, y); ctx.lineTo(x - r * .1, y + r * .45); ctx.lineTo(x + r * .55, y - r * .4); ctx.stroke(); }
  else if (s === 'lose') { circ(x, y, r, '#FF4D4D', 3); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r * .4, y - r * .4); ctx.lineTo(x + r * .4, y + r * .4); ctx.moveTo(x + r * .4, y - r * .4); ctx.lineTo(x - r * .4, y + r * .4); ctx.stroke(); }
  else { circ(x, y, r * (.7 + Math.sin(now * 8) * .08), '#6b6880', 3); }
}
const modeLabel = m => m === 'team' ? 'TEAM' : m === 'duo' ? 'DUO' : 'VERSUS';
const modeBlurb = m => m === 'duo' ? 'TWO PLAYERS · ONE GAME · DIFFERENT ROLES · WIN OR LOSE TOGETHER' : m === 'team' ? 'TEAMWORK: SHARED LIVES · EVERYONE NEEDS TO PULL THEIR WEIGHT' : 'EVERYONE PLAYS THE SAME GAME · FASTEST AND BEST TAKE THE POINTS';
function mini(x, y, p, u) { claude(x, y, u, { col: p.color }); }

function drawParty() {
  const R = party.room, v = party.view;
  bg('#1f2a44', '#26335a', now);
  if (!R || v === 'menu' || v === 'joining') return drawPartyMenu();
  if (v === 'lobby') drawLobby(R);
  else if (v === 'between') drawBetween(R);
  else if (v === 'end') drawEnd(R);
  else drawWait(R);
  voiceButton(W + OX - 164, 8, 150, 42);
}

function drawPartyMenu() {
  txt('PLAY WITH FRIENDS', W / 2, 46, 44, '#FFE14D', 'center', 430);
  button(14, 10, 130, 56, '◄ BACK', () => { goTitle(); }, { size: 22 });
  button(W + OX - 204, 10, 190, 56, 'MY FRIENDS', goFriends, { size: 20, fill: '#B49CFF' });
  if (net.user && frPending() > 0) { circ(W + OX - 20, 14, 14, '#FF4D4D', 3); txt(String(frPending()), W + OX - 20, 15, 15, '#fff'); }
  txt('LIVE 5-SECOND MICROGAMES · 2-4 PLAYERS', W / 2, 108, 22, '#fff', 'center', 740);
  button(200, 150, 400, 92, 'CREATE ROOM', partyCreate, { fill: '#5CFF7A', size: 36 });
  txt('OR JOIN WITH A CODE', W / 2, 290, 24, '#fff');
  button(480, 322, 120, 64, 'JOIN', joinTyped, { fill: '#4DB8FF', size: 28 });
  const idn = partyIdentity();
  txt(t('PLAYING AS {name}', { name: idn.name.toUpperCase() }), W / 2, 440, 24, idn.color, 'center', 740);
  if (!net.user) txt('SIGN IN WITH GOOGLE (PROFILE) TO USE YOUR OWN NAME', W / 2, 474, 17, '#ddd', 'center', 740);
  if (party.msg) txt(party.msg, W / 2, 528, 22, party.msgCol, 'center', 740);
  claude(110, 410, 5, { col: idn.color, mood: 'happy' });
}

function drawLobby(R) {
  txt('ROOM CODE', W / 2, 30, 20, '#ddd');
  const pop = easeBack(st / .4);
  ctx.save(); ctx.translate(W / 2, 92); ctx.scale(pop, pop); txt(R.code, 5, 6, 92, INK); txt(R.code, 0, 0, 92, '#FFE14D'); ctx.restore();
  txt(location.host + '/r/' + R.code, W / 2, 152, 18, '#ddd', 'center', 740);
  if (R.mode === 'duo' && partnerOf(R)) txt(link.state === 'open' ? (linkLabel() ? t('DIRECT LINK READY · {label}', { label: linkLabel() }) : 'DIRECT LINK READY') : link.tries >= 4 ? 'USING THE SERVER RELAY' : 'CONNECTING DIRECTLY...', W / 2, 172, 14, link.state === 'open' ? '#5CFF7A' : '#FFE14D', 'center', 740);
  for (let i = 0; i < 4; i++) {
    const p = R.players[i], x = 40 + i * 188, y = 186, k = easeOut((st - i * .06) / .3);
    ctx.save(); ctx.translate(0, (1 - k) * 30); ctx.globalAlpha = k;
    box3(x, y, 172, 178, p ? '#35406a' : '#2a3354', 4, 6);
    if (p) {
      shadow(x + 86, y + 124, 40, 8, .3);
      claude(x + 86, y + 122 - Math.abs(Math.sin(now * 3 + i)) * 8, 6, { col: p.color, mood: 'happy' });
      txt(p.name, x + 86, y + 150, 20, p.color, 'center', 156);
      if (R.host === p.id) star(x + 22, y + 22, 16, 7, 5, -Math.PI / 2, '#FFE14D', 3);
      if (party.you && p.id === party.you.id) txt('YOU', x + 150, y + 20, 15, '#fff', 'center', 40);
      voiceCardMarks(p, x, y);
    } else {
      claude(x + 86, y + 122, 6, { col: '#4a4558', mood: null }); txt('WAITING...', x + 86, y + 150, 17, '#8e8c9c', 'center', 156);
    }
    ctx.restore();
  }
  if (isHost()) button(200, 380, 400, 54, t('MODE: {mode}', { mode: t(modeLabel(R.mode)) }), partyMode, { fill: R.mode === 'team' ? '#B49CFF' : R.mode === 'duo' ? '#7BD88F' : '#FFE14D', size: 26 });
  else txt(t('MODE: {mode}', { mode: t(modeLabel(R.mode)) }), W / 2, 408, 28, '#FFE14D');
  txt(modeBlurb(R.mode), W / 2, 456, 16, '#ddd', 'center', 760);
  button(40, 488, 230, 74, 'INVITE', partyInvite, { fill: '#4DB8FF', size: 30 });
  const n = R.players.filter(p => !p.left).length;
  if (isHost()) {
    if (canStart(R)) button(290, 488, 260, 74, 'START!', partyStart, { fill: '#5CFF7A', size: 36 });
    else { box3(290, 488, 260, 74, '#9a98a8', 5, 5); txt(R.mode === 'duo' ? 'DUO NEEDS EXACTLY 2' : 'NEED 2+ PLAYERS', 420, 526, 22, '#fff', 'center', 240); }
  } else txt(t('WAITING FOR {name} TO START', { name: pName(R, R.host).toUpperCase() }), 420, 526, 20, '#fff', 'center', 260);
  button(570, 488, 190, 74, 'LEAVE', () => partyLeave('menu'), { fill: '#fff', size: 28 });
}

function drawWait(R) {
  txt(t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), W / 2, 44, 36, '#FFE14D');
  const my = R.cur && party.you && R.cur[party.you.id] || party.pending;
  if (my) txt(my.r === 'win' ? 'YOU DID IT!' : 'NOT THIS TIME', W / 2, 120, 44, my.r === 'win' ? '#5CFF7A' : '#FF4D4D');
  txt('WAITING FOR THE OTHERS...', W / 2, 190, 26, '#fff');
  R.players.filter(p => !p.left).forEach((p, i) => {
    const x = 120, y = 240 + i * 62, c = R.cur && R.cur[p.id];
    box3(x, y, 560, 52, '#35406a', 3, 4); mini(x + 34, y + 48, p, 2.3);
    txt(p.name, x + 74, y + 27, 22, p.color, 'left', 340); statusDot(x + 520, y + 26, 16, c ? c.r : null);
  });
  if (!TOUCH) txt('KEEP CALM - THE ROUND ENDS WHEN EVERYONE IS DONE', W / 2, 560, 16, '#ddd');
  button(14, 10, 130, 44, 'LEAVE', () => partyLeave(), { size: 18, fill: 'rgba(255,255,255,.85)' });
}

function drawBetween(R) {
  const L = R.last; if (!L) return;
  txt(t('ROUND {n} / {total}', { n: L.round + 1, total: R.total }), W / 2, 36, 30, '#FFE14D');
  const g = REGMAP[L.game]; I18N.scope = I18N.scopeOf(L.game); txt(g ? g.name : '', W / 2, 78, 22, '#fff'); I18N.scope = '';
  let y0 = 118;
  if (R.mode !== 'versus') {
    txt(L.teamWin ? 'TEAM WIN!' : 'TEAM FAILED!', W / 2, 118, 54, L.teamWin ? '#5CFF7A' : '#FF4D4D');
    for (let i = 0; i < 4; i++) claude(W / 2 - 108 + i * 72, 190, 2.6, i < R.lives ? { col: OR } : { col: '#4a4558', mood: 'sad' });
    txt(t('TEAM SCORE {n}', { n: R.teamScore }), W / 2, 214, 24, '#FFE14D'); y0 = 240;
  }
  const rows = L.results.slice().sort((a, b) => b.award - a.award || (a.r === 'win' ? 0 : 1) - (b.r === 'win' ? 0 : 1) || a.t - b.t);
  const rh = R.mode !== 'versus' ? 62 : 74;
  rows.forEach((x, i) => {
    const p = R.players.find(q => q.id === x.id); if (!p) return;
    const y = y0 + i * rh, k = easeOut((st - i * .1) / .25);
    ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * 60, 0);
    box3(60, y, 680, rh - 10, x.award > 0 && i === 0 && R.mode === 'versus' ? '#5a4a2a' : '#35406a', 3, 4);
    if (R.mode === 'versus') txt('#' + (i + 1), 92, y + (rh - 10) / 2, 26, '#fff', 'center', 60);
    mini(150, y + rh - 14, p, 2.4);
    txt(p.name, 190, y + (rh - 10) / 2, 22, p.color, 'left', 250);
    statusDot(470, y + (rh - 10) / 2, 14, x.r);
    txt(x.pts > 0 ? t('{n} PTS', { n: x.pts }) : x.r === 'win' ? x.t.toFixed(1) + 's' : '-', 540, y + (rh - 10) / 2, 20, '#ddd', 'center', 90);
    if (R.mode === 'versus') { txt(x.award ? '+' + x.award : '', 618, y + (rh - 10) / 2, 26, '#FFE14D', 'center', 70); txt(String(p.score), 706, y + (rh - 10) / 2, 26, '#fff', 'right', 60); }
    ctx.restore();
  });
  const left = Math.max(0, Math.ceil(NEXT_ROUND_S - (now - party.seenAt)));
  txt(L.final ? t('FINAL RESULTS IN {n}', { n: left }) : t('NEXT ROUND IN {n}', { n: left }), W / 2, 566, 24, '#fff');
  button(14, 10, 130, 44, 'LEAVE', () => partyLeave(), { size: 18, fill: 'rgba(255,255,255,.85)' });
}

function drawEnd(R) {
  const team = R.mode !== 'versus', sorted = R.players.filter(p => !p.left).slice().sort((a, b) => b.score - a.score);
  const cleared = team && R.lives > 0;
  const head = team ? (cleared ? 'TEAM CLEARED!' : 'GAME OVER') : t('{name} WINS!', { name: sorted[0] ? sorted[0].name.toUpperCase() : '' });
  const gk = st < .14 ? 2.6 - 1.6 * easeOut(st / .14) : 1;
  ctx.save(); ctx.translate(W / 2, 80); ctx.rotate(-.04); ctx.scale(gk, gk); txt(head, 5, 6, 56, INK, 'center', 740); txt(head, 0, 0, 56, team && !cleared ? '#FF4D4D' : '#FFE14D', 'center', 740); ctx.restore();
  if (team) txt(t('TEAM SCORE {n}', { n: R.teamScore }), W / 2, 140, 34, '#fff');
  sorted.forEach((p, i) => {
    const y = 170 + i * 74, k = easeOut((st - .3 - i * .12) / .3), top = !team && i === 0;
    ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * 80, 0);
    box3(110, y, 580, 64, top ? '#5a4a2a' : '#35406a', 3, 4);
    if (!team) txt('#' + (i + 1), 146, y + 32, 28, '#fff', 'center', 60);
    claude(220, y + 56 - (top ? Math.abs(Math.sin(now * 6)) * 12 : 0), 2.8, { col: p.color, mood: team ? (cleared ? 'happy' : 'sad') : (top ? 'happy' : null) });
    txt(p.name, 262, y + 32, 24, p.color, 'left', 270);
    if (!team) txt(String(p.score), 666, y + 32, 30, '#fff', 'right', 110);
    else if (R.lives > 0) star(660, y + 32, 20, 9, 5, -Math.PI / 2, '#FFE14D', 3);
    ctx.restore();
  });
  drawParts();
  if (st > .6) {
    if (isHost()) button(130, 500, 270, 70, 'PLAY AGAIN', partyAgain, { fill: '#5CFF7A', size: 30 });
    else txt('WAITING FOR THE HOST...', 265, 535, 20, '#fff', 'center', 250);
    button(420, 500, 250, 70, 'LEAVE', () => partyLeave(), { fill: '#fff', size: 30 });
  }
}

/* DUO: who is who. The intro card (before the game starts) shows both players side by side with their role and one short line;
   during play a coloured badge + a frame in YOUR colour keep reminding you which one you are. */
const DUO_A = 1.9, DUO_B = 1.7, DUO_C = .9, DUO_PRE = DUO_A + DUO_B + DUO_C;   // YOU (1.9 s) -> YOUR FRIEND (1.7 s) -> GO (.9 s); keep PRE_MS_DUO in pocketbase/pb_hooks/party.js in sync
function duoMeColor() { const m = me(); return m ? m.color : '#FFE14D'; }
function duoBadge(pn) {
  const c = duoMeColor();
  ctx.save(); ctx.lineWidth = 8; ctx.strokeStyle = c; ctx.strokeRect(4, 4, W - 8, H - 8); ctx.restore();
  box(10 - OX, 88, 300, 34, c, 3); txt(t('YOU: {role}', { role: t(cur.roleLabel) }), 20 - OX, 106, 20, INK, 'left', 282);
  if (cur.roles && pn) txt(t('{name}: {role}', { name: pn.name.toUpperCase(), role: t(cur.roles[1 - cur.role].label) }), 14 - OX, 140, 15, '#fff', 'left', 290);
}
/* intro card, three beats: 1 what YOU do (animated demo + the control), 2 what your friend does, 3 get ready / GO */
function drawDuoIntro(left) {
  const R = party.room, m = me(), pn = R.players.find(p => !p.left && p.id !== party.you.id); if (!m || !pn || !cur.roles) return;
  const el = DUO_PRE - left, beat = el < DUO_A ? 0 : el < DUO_A + DUO_B ? 1 : 2, bt = beat === 0 ? el : beat === 1 ? el - DUO_A : el - DUO_A - DUO_B;
  const k = Math.min(1, bt / .22), pop = 1 + (1 - k) * .25, pulse = .5 + .5 * Math.sin(now * 9);
  const steps = ['YOU', 'YOUR FRIEND', 'GO!'], stepCol = [m.color, pn.color, '#5CFF7A'];
  steps.forEach((sl, i) => { const x = 150 + i * 250, on = i === beat; ctx.globalAlpha = on ? 1 : .4; box(x - 100, 14, 200, 34, on ? stepCol[i] : '#3a3550', 3); txt(String(i + 1) + ' · ' + t(sl), x, 40, 20, on ? INK : '#fff', 'center', 188); }); ctx.globalAlpha = 1;
  if (beat < 2) {
    const you = beat === 0, p = you ? m : pn, r = cur.roles[you ? cur.role : 1 - cur.role];
    ctx.save(); ctx.translate(W / 2, 330); ctx.scale(pop, pop); ctx.translate(-W / 2, -330); ctx.globalAlpha = k;
    box(40, 64, 650, 62, p.color, 4); txt(you ? 'YOU DO THIS' : t('{name} DOES THIS', { name: pn.name.toUpperCase() }), 365, 108, 44, INK, 'center', 620);
    claude(84, 196, 4.6, { col: p.color, mood: 'happy' });
    txt(r.label, 470, 168, 56, '#FFE14D', 'center', 560); txt(r.short, 470, 212, 26, '#fff', 'center', 560);
    box(140, 236, 520, 240, '#2b2845', 4); ctx.lineWidth = 6; ctx.strokeStyle = p.color; ctx.strokeRect(140, 236, 520, 240);
    ctx.save(); ctx.beginPath(); ctx.rect(142, 238, 516, 236); ctx.clip(); ctx.translate(140, 236); try { r.demo(bt + (you ? 0 : 1.3)); } catch (e) {} ctx.restore();
    box(160, 494, 480, 52, '#fff', 4); txt(r.how, W / 2, 532, 30, INK, 'center', 460);
    txt(you ? 'YOUR FRIEND DOES THE OTHER PART ON THEIR OWN SCREEN' : 'YOU WATCH - THEY DO THIS ON THEIR SCREEN', W / 2, 584, 17, '#c9c6e0', 'center', 740);
    ctx.restore();
  } else {
    txt('GET READY!', W / 2, 112, 56, '#fff'); [[m, cur.roles[cur.role], 'YOU', 40], [pn, cur.roles[1 - cur.role], null, 420]].forEach(([p, r, tag, x]) => {
      box(x, 170, 340, 190, '#2b2845', 4); ctx.lineWidth = 7; ctx.strokeStyle = p.color; ctx.strokeRect(x, 170, 340, 190);
      claude(x + 60, 290, 3.6, { col: p.color, mood: 'happy' }); txt(tag ? t('YOU') : p.name.toUpperCase(), x + 205, 220, 24, p.color, 'center', 200); txt(r.label, x + 205, 280, 34, '#FFE14D', 'center', 200); txt(r.short, x + 205, 326, 17, '#fff', 'center', 200);
    });
    ctx.save(); ctx.translate(W / 2, 470); ctx.scale(1 + pulse * .15, 1 + pulse * .15); txt('GO!', 0, 40, 120, '#5CFF7A', 'center', 600); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
/* in-game overlay for a party round: who has finished (live) + round counter. Called by main.js render() while playing. */
function drawPartyHud() {
  const R = party.room; if (!R) return;
  const act = R.players.filter(p => !p.left);
  ctx.fillStyle = 'rgba(20,16,28,.4)'; ctx.fillRect(10 - OX, 36, 22 + act.length * 44, 44);
  act.forEach((p, i) => { const c = R.cur && R.cur[p.id]; claude(36 - OX + i * 44, 74, 1.6, { col: p.color }); if (c) statusDot(48 - OX + i * 44, 44, 9, c.r);
    if (voice.on && talking(p.id === party.you.id ? 'me' : p.id)) { ctx.fillStyle = '#5CFF7A'; ctx.fillRect(18 - OX + i * 44, 78, 36, 4); } });
  if (voice.on) txt(voice.muted ? 'MIC MUTED' : 'MIC ON', W + OX - 16, 84, 14, voice.muted ? '#FFE14D' : '#5CFF7A', 'right');
  txt(t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), W + OX - 16, 30, 22, '#fff', 'right');
  if (R.mode === 'duo') {
    const pn = act.find(p => p.id !== party.you.id);
    if (pn && cur && cur.roleLabel) duoBadge(pn);
    if (duoAway() && state === 'play' && !outcome) { ctx.fillStyle = 'rgba(20,16,28,.6)'; ctx.fillRect(-OX, 280, VW, 70); txt(t('{name} IS AWAY', { name: pn ? pn.name.toUpperCase() : '?' }), W / 2, 315, 34, '#FFE14D', 'center', 760); }
  }
  if (R.mode !== 'versus') txt(t('LIVES {n}', { n: R.lives }), W + OX - 16, 60, 20, '#FF4D9E', 'right');
  else { const m = me(); if (m) txt(String(m.score), W + OX - 16, 60, 22, '#FFE14D', 'right'); }
}
    if (linkLabel()) txt(linkLabel(), 14 - OX, 162, 13, link.via === 'p2p' ? '#5CFF7A' : '#ddd', 'left', 200);
