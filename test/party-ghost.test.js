'use strict';
// GHOSTS in SURVIVAL / KNOCKOUT: server rules (who may sabotage whom, when, how often) and the client kit (traps charge BOOs, BOO sends, the living take the hit). Run: node test/party-ghost.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const P = require('../pocketbase/pb_hooks/party.js');
const rejects = (fn, status) => assert.throws(fn, e => e instanceof P.PartyError && e.status === status, 'expected ' + status);

// ───────────── server ─────────────
const rand = Math.random;
function match(mode, n = 4) {
  const r = P.newRoom('GHST', mode, 0); for (let i = 0; i < n; i++) P.addPlayer(r, { name: 'P' + i }, rand); P.start(r, 'a', 1000, rand);
  return r;
}
/* knock out `out` (ids) in one round, everyone else wins, then start the next round: returns the room in a live round, roundAt = its start */
function knockOut(r, out, at = 1000) {
  r.players.forEach(p => P.report(r, p.id, r.round, out.includes(p.id) ? 'lose' : 'win', 1, 5, at + 100));
  assert.equal(r.state, 'between'); P.advance(r, r.round, r.betweenAt + 5000, rand); assert.equal(r.state, 'round');
  return r;
}
const sab = (r, from, to, k = 'ink', now, lim) => P.sigPayload(r, from, r.round, [{ t: 'sab', d: { k, to } }], now, lim);
const mapLimiter = () => { const m = new Map(); return { get: k => m.get(k), set: (k, v) => m.set(k, v) }; };

assert.deepEqual(P.GHOST_MODES, ['survival', 'knockout']);
assert.ok(P.GHOST_KINDS.every(k => P.SAB_KINDS.includes(k)) && P.GHOST_KINDS.length >= 4);
for (const mode of P.GHOST_MODES) {
  const r = knockOut(match(mode === 'survival' ? 'knockout' : mode), ['a']);   // 'a' is out (knockout has one life; survival is exercised below by zeroing lives)
  if (mode === 'survival') { const s = match('survival'); s.players[0].lives = 0; s.players[1].lives = 1; assert.equal(P.sabAllowed(s, 'a', 'c'), true); }
  const ghost = 'a', t0 = r.roundAt;
  // the living never sabotage, nor send anything a ghost may not
  rejects(() => sab(r, 'b', 'c', 'ink', t0 + 5000), 403);
  assert.equal(P.sabAllowed(r, 'b', 'c'), false);
  // a ghost: only one sab and nothing else
  rejects(() => P.sigPayload(r, ghost, r.round, [{ t: 'hb', d: null }], t0 + 5000), 403);
  rejects(() => P.sigPayload(r, ghost, r.round, [{ t: 'frame', d: { image: 'data:image/jpeg;base64,AAAA' } }], t0 + 5000), 403);
  rejects(() => P.sigPayload(r, ghost, r.round, [{ t: 'sab', d: { k: 'ink', to: 'b' } }, { t: 'sab', d: { k: 'ink', to: 'c' } }], t0 + 5000), 403);
  rejects(() => P.sigPayload(r, ghost, r.round, [], t0 + 5000), 403);
  // not before the instruction card is over, not with kinds that block the game
  rejects(() => sab(r, ghost, 'b', 'ink', t0 + 100), 409);
  for (const bad of ['fog', 'dark', 'flip', 'nuke', null]) rejects(() => sab(r, ghost, 'b', bad, t0 + 5000), 400);
  // only at a living, unfinished, other player
  rejects(() => sab(r, ghost, ghost, 'ink', t0 + 5000), 400); rejects(() => sab(r, ghost, 'zz', 'ink', t0 + 5000), 400); rejects(() => sab(r, ghost, 7, 'ink', t0 + 5000), 400);
  const two = match('knockout'); knockOut(two, ['a', 'b']); const tt = two.roundAt;
  rejects(() => sab(two, 'a', 'b', 'ink', tt + 5000), 400);                          // another ghost is not a target
  P.report(two, 'c', two.round, 'win', 1, 0, tt + 2000); assert.equal(two.state, 'round');
  rejects(() => sab(two, 'a', 'c', 'ink', tt + 5000), 400);                          // c already finished its game
  for (const k of P.GHOST_KINDS) assert.equal(sab(r, ghost, 'b', k, t0 + 5000).m[0].d.k, k);   // every ghost kind relays (no limiter = timing rule only)
  const ok = sab(r, ghost, 'b', 'spam', t0 + 5000); assert.deepEqual(ok.m[0].d, { k: 'spam', to: 'b' }); assert.equal(ok.from, ghost);
  // between turns and after the game: nothing
  const b = match('knockout'); knockOut(b, ['a']); b.players.slice(1).forEach(p => P.report(b, p.id, b.round, 'win', 1, 5, b.roundAt + 2000)); assert.equal(b.state, 'between');
  rejects(() => sab(b, 'a', 'b', 'ink', b.betweenAt + 100), 409);
  const f = match('knockout'); f.state = 'done'; rejects(() => sab(f, 'a', 'b', 'ink', 9e9), 409);
}

// rate limits: per ghost, per victim, per ghost per round
{
  const r = match('knockout'); knockOut(r, ['a', 'b']); const lim = mapLimiter(), t0 = r.roundAt + 2000;
  sab(r, 'a', 'c', 'ink', t0, lim);
  rejects(() => sab(r, 'a', 'd', 'ink', t0 + P.GHOST_GAP_MS - 100, lim), 429);              // same ghost, too soon
  rejects(() => sab(r, 'b', 'c', 'bugs', t0 + P.GHOST_HIT_GAP_MS - 100, lim), 429);          // same victim, too soon, even from another ghost
  sab(r, 'b', 'd', 'bugs', t0 + 500, lim);                                                   // another ghost, another victim: fine
  sab(r, 'a', 'd', 'pixel', t0 + P.GHOST_GAP_MS + 100, lim);
  rejects(() => sab(r, 'a', 'c', 'spam', t0 + P.GHOST_GAP_MS * 2 + 200, lim), 429);          // third one this round
  assert.equal(P.GHOST_ROUND_MAX, 2);
  r.round++; r.roundAt = t0 + 9000; r.state = 'round'; r.cur = {};                           // a new round gives the ghost a fresh allowance
  sab(r, 'a', 'c', 'ink', r.roundAt + 3000, lim);
  rejects(() => sab(r, 'a', 'c', 'ink', r.roundAt + 3100, lim), 429);
  assert.ok(P.GHOST_GAP_MS >= 3000 && P.GHOST_GAP_MS <= 4000, 'the server gap stays just under the 4 s client cooldown');
}
// a ghost can leave without anyone being stuck, and other modes are untouched
{
  const r = match('knockout', 3); knockOut(r, ['a']); P.leave(r, 'a', r.roundAt + 50); rejects(() => sab(r, 'a', 'b', 'ink', r.roundAt + 5000), 403);
  const v = match('versus'); rejects(() => P.sigPayload(v, 'a', 0, [{ t: 'sab', d: { k: 'ink', to: 'b' } }], 9e5), 409);
  const bal = match('balloon', 3); assert.equal(P.sigPayload(bal, 'b', 0, [{ t: 'sab', d: { k: 'fog', to: 'a' } }], 9e5).m[0].d.k, 'fog', 'BALLOON keeps every kind');
}
console.log('ghost server rules OK');

// ───────────── client ─────────────
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const calls = [];
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub(), toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==' }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  modeLabel: m => m.toUpperCase(), pressing: false, btns: [], button(x, y, w, h, label, fn) { sb.btns.push({ x, y, w, h, label, fn }); }, auth: () => ({ code: 'GHST', id: sb.party.you.id, key: 'k' }),
  applyRoom() {}, roomGone() {}, partyErr: () => '', say() {}, partyLeave() {}, sigStamp: m => Object.assign(m, { n: 1, v: 'x' }),
  pcall: async (action, body) => { calls.push({ action, body }); return sb.reply; }, reply: { ok: true, status: 200, data: {} },
};
sb.party = { you: { id: 'a' }, view: 'wait', watch: { round: 0, frames: {}, target: null }, sig: { q: [], buf: [], round: 0, handler: null } };
sb.me = () => sb.party.room.players.find(p => p.id === sb.party.you.id);
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/games/pt1.js', 'js/party-sab.js', 'js/party-react.js', 'js/party-modes.js', 'js/party-ghost.js', 'js/party-wait.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const run = s => vm.runInContext(s, sb), plain = s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', sb));
const mkRoom = (mode, lives) => ({ id: 'rid', code: 'GHST', mode, state: 'round', round: 0, total: 30, seed: 79, sp: 1, game: 'pt_mash', cur: {}, extra: {},
  players: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: 'P' + i, color: ['#D97757', '#6EA8FE', '#7BD88F', '#F28CB1'][i], score: 0, lives: lives[i] })) });

const flush = () => new Promise(r => setTimeout(r, 5));
const sabSeen = []; { const real = sb.sabBegin; sb.sabBegin = (st, c, where) => { sabSeen.push(st); return real(st, c, where); }; }   // what the living's game was asked to draw over itself
(async () => {
for (const mode of ['survival', 'knockout']) {
  const room = mkRoom(mode, [0, 1, 1, 0]);                           // a and d are ghosts, b and c still play
  sb.party.room = room; sb.party.you.id = 'a'; sb.party.view = 'wait'; sb.party.ghost = null; sb.party.sig = { q: [], buf: [], round: 0, handler: null }; calls.length = 0; run('now = 100');
  assert.equal(run('partyGhostOn(party.room)'), true, mode + ': an eliminated player in a live round gets the ghost screen');
  for (const [id, view, state] of [['b', 'wait', 'round'], ['a', 'between', 'round'], ['a', 'wait', 'between']]) { sb.party.you.id = id; sb.party.view = view; room.state = state; assert.equal(run('partyGhostOn(party.room)'), false); }
  sb.party.you.id = 'a'; sb.party.view = 'wait'; room.state = 'round';
  const other = mkRoom('versus', [0, 1, 1, 0]); sb.party.room = other; assert.equal(run('partyGhostOn(party.room)'), false, 'only SURVIVAL and KNOCKOUT have ghosts'); sb.party.room = room;

  // the kit: nothing to haunt until the instruction card is over; charges come from time and from winning traps; the cap and the cooldown hold
  run('partyGhostUpdate(party.room, .1)');
  assert.equal(run('party.ghost.charges.max'), 2); assert.equal(run('party.ghost.live'), false);
  assert.equal(run('party.sig.handler === party.ghost.handler'), true, 'the relay handler is attached so ghosts see who hits whom');
  run('now += 1.6; partyGhostUpdate(party.room, .1)'); assert.equal(run('party.ghost.live'), true);
  run('partyGhostKey({ code: "KeyE" })'); assert.equal(calls.length, 0, 'no BOO without a charge');
  run('party.ghost.traps.spawn("bubble"); party.ghost.traps.hitBubble()'); assert.equal(run('party.ghost.charges.n'), 1, 'winning a trap charges a BOO');
  run('party.ghost.charges.tick(60)'); assert.equal(run('party.ghost.charges.n'), 2, 'time alone also charges, up to the cap of 2');
  run('party.ghost.traps.spawn("bubble"); party.ghost.traps.hitBubble()'); assert.equal(run('party.ghost.charges.n'), 2);
  run('party.ghost.charges.n = 1; party.watch.target = "b"; partyGhostKey({ code: "KeyE" })');
  assert.equal(calls.length, 1); assert.equal(calls[0].action, 'sig'); assert.equal(calls[0].body.round, 0);
  const msg = calls[0].body.m[0]; assert.equal(msg.t, 'sab'); assert.equal(msg.d.to, 'b'); assert.ok(P.GHOST_KINDS.includes(msg.d.k), 'only ghost kinds are thrown (' + msg.d.k + ')'); assert.equal(msg.n, 1);
  assert.equal(run('party.ghost.charges.n'), 0); run('party.ghost.charges.earn("trap"); partyGhostKey({ code: "KeyE" })'); assert.equal(calls.length, 1, '4 s cooldown between two BOOs');
  run('party.ghost.charges.tick(4.1)'); run('party.watch.target = "d"; partyGhostKey({ code: "KeyE" })');
  assert.equal(calls.length, 2); assert.ok(['b', 'c'].includes(calls[1].body.m[0].d.to), 'a ghost is never the target: the key falls back to a living player');
  assert.notEqual(calls[1].body.m[0].d.k, msg.d.k, 'never the same kind twice');
  room.cur.b = { r: 'win' }; run('party.ghost.charges.earn("trap"); party.ghost.charges.cd = 0; party.watch.target = "b"; partyGhostKey({ code: "KeyE" })');
  assert.equal(calls.length, 3); assert.equal(calls[2].body.m[0].d.to, 'c', 'a player who already finished is not haunted'); delete room.cur.b;
  // the server may refuse (the victim just finished, a rate limit): the BOO comes back; a forbidden connection does not
  await flush(); run('party.ghost.charges.n = 1; party.ghost.charges.cd = 0'); sb.reply = { ok: false, status: 429, data: {} };
  run('partyGhostKey({ code: "KeyE" })'); assert.equal(run('party.ghost.charges.n'), 0); await flush(); assert.equal(run('party.ghost.charges.n'), 1, 'a refused sabotage gives the BOO back');
  sb.reply = { ok: true, status: 200, data: {} };

  // drawing: every state of the ghost screen renders, with a BOO! button per living unfinished player and a way to switch whom to watch
  run('party.ghost.charges.n = 2; party.ghost.charges.cd = 0');
  sb.pick = { friends: room.players.filter(p => p.id !== 'a'), alive: room.players.filter(p => p.id === 'b' || p.id === 'c'), target: room.players[1], frame: false };
  sb.btns.length = 0; run('partyGhostDraw(party.room, pick)');
  assert.equal(sb.btns.filter(b => b.label === 'BOO!').length, 2, 'one BOO! per living player'); assert.ok(sb.btns.some(b => b.label === 'LEAVE'));
  const before = calls.length; sb.btns.find(b => b.label === 'BOO!').fn(); assert.equal(calls.length, before + 1); assert.equal(calls.at(-1).body.m[0].d.to, 'b', 'the BOO! button throws at its own card');
  assert.ok(run('fxs.some(f => f.k === "txt")'), 'the throw pops a toast');
  for (const spawn of ['bubble', 'dial', 'seq']) { run(`party.ghost.traps.spawn("${spawn}")`); run('partyGhostDraw(party.room, pick)'); }
  run('now += .2; party.ghost.flash = { k: "ink", at: now - .1, to: "b" }; party.watch.target = "b"; partyGhostDraw(party.room, pick)');
  room.cur.b = { r: 'win' }; sb.btns.length = 0; run('partyGhostDraw(party.room, pick)'); delete room.cur.b;
  assert.equal(sb.btns.filter(b => b.label === 'BOO!').length, 2, 'cards stay; the BOO! button just does nothing for a finished player');
  run('now += 5; partyGhostDraw(party.room, pick)');
  // a new round keeps the charges but starts new traps
  run('party.ghost.charges.n = 1'); room.round = 1; run('partyGhostUpdate(party.room, .1)'); assert.equal(run('party.ghost.charges.n'), 1); assert.equal(run('party.ghost.live'), false); assert.equal(run('party.ghost.round'), 1);
  assert.equal(run('party.ghost.traps.active()'), ''); room.round = 0; run('party.ghost = null');

  // the living: the same game, plus the receiving end. A ghost's hit is shorter and softer than a balloon hit; nothing else counts.
  sb.party.you.id = 'b'; sb.party.view = 'play'; sb.party.sig = { q: [], buf: [{ round: 0, t: 'sab', d: { k: 'ink', to: 'c' }, from: 'a' }], round: 0, handler: null }; run('now = 1000'); sabSeen.length = 0;
  const game = run('partyBuildGame(party.room, party.room.sp)');
  assert.equal(typeof sb.party.sig.handler, 'function', 'the living attach a receiver'); assert.equal(sb.party.sig.buf.length, 0, 'buffered hits are replayed, not kept');
  const recv = (type, d, from) => sb.party.sig.handler(type, d, from), last = () => sabSeen.at(-1);
  run('fxs.length = 0'); recv('sab', { k: 'ink', to: 'c' }, 'd'); assert.ok(run('fxs.some(f => f.k === "txt")'), 'a hit on somebody else is a toast');
  for (const [k, from] of [['fog', 'a'], ['flip', 'a'], ['dark', 'd'], ['ink', 'c'], ['ink', 'zz']]) { recv('sab', { k, to: 'b' }, from); game.draw(0); assert.equal(last(), null, k + ' from ' + from + ' must not land'); }
  recv('sab', { k: 'ink', to: 'b' }, 'a'); game.draw(0);
  const hit = last(); assert.ok(hit && hit.k === 'ink' && hit.name === 'P0'); assert.equal(hit.str, .6); assert.ok(Math.abs(hit.life - 3.4 * .75) < 1e-9, 'a ghost hit is 75% as long');
  sb.partyHit = hit; run('now = partyHit.at + 1'); assert.ok(run('sabEnvelope(partyHit)') <= .6 + 1e-9 && run('sabEnvelope(partyHit)') > .5, 'and never stronger than 60%');
  run('now += 1.7'); game.draw(0); assert.equal(last(), null, 'it expires on its own');
  for (const k of P.GHOST_KINDS) { recv('sab', { k, to: 'b' }, 'd'); run('now += .5'); game.draw(.1); assert.equal(last().k, k, k + ' lands'); run('now += 4'); }
  // the toast / banner and the draw never throw, mid hit and with the sabotage over
  recv('sab', { k: 'shake', to: 'b' }, 'a'); run('now += .4'); game.draw(.2); run('partyGhostBanner(null)');
}
// the rest of the family has no ghosts: versus and team get a receiver of their own (js/party-wait.js, test/party-wait.test.js), lantern none
for (const mode of ['versus', 'team', 'lantern']) { const room = mkRoom(mode, [1, 1, 1, 1]); sb.party.room = room; sb.party.you.id = 'b'; sb.party.sig = { q: [], buf: [], round: 0, handler: null }; if (mode !== 'lantern') run('partyBuildGame(party.room, party.room.sp)'); assert.equal(sb.party.sig.handler === null, mode === 'lantern', mode + ' ghosts'); assert.equal(run('partyGhostOn(party.room)'), false); }
console.log('ghost client kit OK');
})().catch(e => { console.error(e); process.exit(1); });
