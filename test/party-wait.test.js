'use strict';
// WAITING in VERSUS and TEAM (js/party-wait.js): server rules (who may sabotage / cheer whom, when, how often) and the client kit
// (traps charge, SABOTAGE hits players still playing, CHEER sparkles the team, the rest of the round is untouched). Run: node test/party-wait.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const P = require('../pocketbase/pb_hooks/party.js');
const rejects = (fn, status) => assert.throws(fn, e => e instanceof P.PartyError && e.status === status, 'expected ' + status);

// ───────────── server ─────────────
const rand = Math.random;
function match(mode, n = 4) {
  const r = P.newRoom('WAIT', mode, 0); for (let i = 0; i < n; i++) P.addPlayer(r, { name: 'P' + i }, rand); P.start(r, 'a', 1000, rand);
  return r;
}
const sab = (r, from, to, k = 'ink', now, lim) => P.sigPayload(r, from, r.round, [{ t: 'sab', d: { k, to } }], now, lim);
const cheer = (r, from, k = 'sparkle', now, lim) => P.sigPayload(r, from, r.round, [{ t: 'cheer', d: { k } }], now, lim);
const mapLimiter = () => { const m = new Map(); return { get: k => m.get(k), set: (k, v) => m.set(k, v) }; };
const finish = (r, id, res = 'win') => { r.cur[id] = { r: res, t: 2, pts: 0 }; };

assert.deepEqual(P.RACE_MODES, ['versus']); assert.deepEqual(P.CHEER_MODES, ['team']);
assert.ok(!P.RACE_MODES.includes('team') && !P.SAB_MODES.includes('team') && !P.GHOST_MODES.includes('team'), 'TEAM never has sabotage');
assert.ok(!P.CHEER_MODES.includes('versus'), 'VERSUS is a race: no cheering');
assert.ok(P.GHOST_KINDS.every(k => P.SAB_KINDS.includes(k)) && P.CHEER_KINDS.length >= 4);

// VERSUS: only a player whose result is in may sabotage, only at one whose result is not
{
  const r = match('versus'), t0 = r.roundAt, now = t0 + 5000;
  rejects(() => sab(r, 'a', 'b', 'ink', now), 409);                         // still playing myself: no
  assert.equal(P.sabAllowed(r, 'a', 'b'), false);
  finish(r, 'a');
  assert.equal(P.sabAllowed(r, 'a', 'b'), true); assert.equal(P.sabAllowed(r, 'b', 'a'), false, 'the one still playing cannot throw');
  for (const k of P.GHOST_KINDS) { const o = sab(r, 'a', 'b', k, now); assert.deepEqual(o.m[0].d, { k, to: 'b' }); assert.equal(o.from, 'a'); }
  for (const bad of ['fog', 'dark', 'flip', 'nuke', null, 7]) rejects(() => sab(r, 'a', 'b', bad, now), 400);   // only the soft kinds that never block the game
  rejects(() => sab(r, 'a', 'a', 'ink', now), 400); rejects(() => sab(r, 'a', 'zz', 'ink', now), 400); rejects(() => sab(r, 'a', 7, 'ink', now), 400);
  rejects(() => P.sigPayload(r, 'a', r.round, [{ t: 'sab' }], now), 400);
  finish(r, 'b', 'lose');
  rejects(() => sab(r, 'a', 'b', 'ink', now), 400);                         // b already has a result (a failed one counts): nobody is hit after that
  assert.equal(P.sabAllowed(r, 'b', 'c'), true, 'a player who FAILED early waits too, and may sabotage');
  assert.equal(sab(r, 'b', 'c', 'bugs', now).m[0].d.to, 'c');
  rejects(() => sab(r, 'a', 'b', 'ink', t0 + 100), 400);                    // (target finished) wins over timing...
  rejects(() => sab(r, 'a', 'c', 'ink', t0 + 100), 409);                    // ...and not before the instruction card is over
  rejects(() => sab(r, 'a', 'c', 'ink', now + 1e9 * 0, undefined) && sab(r, 'a', 'c', 'ink', t0 + 100), 409);
  // the relay never writes to the room: the round is exactly as before
  const before = JSON.stringify(r); sab(r, 'a', 'c', 'spam', now); assert.equal(JSON.stringify(r), before, 'a sabotage stores nothing');
  // the round still ends the moment the last player reports, whatever was sent
  finish(r, 'c', 'win'); const left = r.players.find(p => !r.cur[p.id]); P.report(r, left.id, r.round, 'win', 3, 0, t0 + 6000); assert.equal(r.state, 'between', 'waiting never keeps a round open');
  rejects(() => sab(r, 'a', 'c', 'ink', r.betweenAt + 100), 409);           // results screen: nothing
  // a finished player who leaves cannot throw; a target who left is gone
  const l = match('versus', 3); finish(l, 'a'); P.leave(l, 'b', l.roundAt + 10); rejects(() => sab(l, 'a', 'b', 'ink', l.roundAt + 5000), 400);
}
// rate limits: per thrower, per victim, per thrower per round (tighter in time than the ghosts: rounds last 5 to 8 s)
{
  const r = match('versus'), lim = mapLimiter(), t0 = r.roundAt + 2500; finish(r, 'a'); finish(r, 'b');
  assert.ok(P.RACE_GAP_MS < P.GHOST_GAP_MS && P.RACE_ROUND_MAX === 2);
  sab(r, 'a', 'c', 'ink', t0, lim);
  rejects(() => sab(r, 'a', 'd', 'ink', t0 + P.RACE_GAP_MS - 100, lim), 429);           // same thrower, too soon
  rejects(() => sab(r, 'b', 'c', 'bugs', t0 + P.RACE_HIT_GAP_MS - 100, lim), 429);       // same victim, too soon, even from another thrower
  sab(r, 'b', 'd', 'bugs', t0 + 100, lim);                                               // another thrower, another victim: fine
  sab(r, 'a', 'd', 'pixel', t0 + P.RACE_GAP_MS + 100, lim);
  rejects(() => sab(r, 'a', 'c', 'spam', t0 + P.RACE_GAP_MS * 2 + 300, lim), 429);       // a third one this round
  r.round++; r.roundAt = t0 + 9000; r.state = 'round'; r.cur = {}; finish(r, 'a');       // a new round gives a fresh allowance
  sab(r, 'a', 'c', 'ink', r.roundAt + 3000, lim);
  assert.ok(P.RACE_GAP_MS >= 2000 && P.RACE_GAP_MS < 2400, 'the server gap stays just under the 2.4 s client cooldown');
}
// TEAM: no sabotage between teammates, ever; only harmless cheers, from a finished player
for (const n of [2, 3, 4]) {
  const r = match('team', n), t0 = r.roundAt, now = t0 + 5000;
  rejects(() => sab(r, 'a', 'b', 'ink', now), 409); finish(r, 'a'); rejects(() => sab(r, 'a', 'b', 'ink', now), 409);
  assert.equal(P.sabAllowed(r, 'a', 'b'), false, 'sabotage is never allowed in TEAM, finished or not');
  rejects(() => sab(r, 'b', 'a', 'ink', now), 409);
  rejects(() => cheer(r, 'b', 'sparkle', now), 409);                                    // only once my own result is in
  for (const k of P.CHEER_KINDS) { const o = cheer(r, 'a', k, now); assert.deepEqual(o.m[0].d, { k }); assert.equal(o.from, 'a'); }
  for (const bad of ['nuke', 'ink', 'constructor', null, 7]) rejects(() => cheer(r, 'a', bad, now), 400);
  rejects(() => P.sigPayload(r, 'a', r.round, [{ t: 'cheer' }], now), 400);
  rejects(() => cheer(r, 'a', 'sparkle', t0 + 100), 409);                               // not before the instruction card is over
  rejects(() => P.sigPayload(r, 'a', r.round + 1, [{ t: 'cheer', d: { k: 'sparkle' } }], now), 409);   // wrong round
  const before = JSON.stringify(r); cheer(r, 'a', 'party', now); assert.equal(JSON.stringify(r), before, 'a cheer stores nothing: no score, no life, no timer');
}
{
  const r = match('team'), lim = mapLimiter(), t0 = r.roundAt + 2500; finish(r, 'a');
  cheer(r, 'a', 'sparkle', t0, lim); rejects(() => cheer(r, 'a', 'hearts', t0 + P.CHEER_GAP_MS - 100, lim), 429);
  for (let i = 1; i < P.CHEER_ROUND_MAX; i++) cheer(r, 'a', 'hearts', t0 + i * (P.CHEER_GAP_MS + 100), lim);
  rejects(() => cheer(r, 'a', 'party', t0 + P.CHEER_ROUND_MAX * (P.CHEER_GAP_MS + 100), lim), 429);
  const done = match('team'); done.state = 'between'; finish(done, 'a'); rejects(() => cheer(done, 'a', 'sparkle', done.roundAt + 5000), 409);
  // the team round still closes the moment everybody has reported
  const q = match('team', 3); finish(q, 'a'); cheer(q, 'a', 'rainbow', q.roundAt + 5000); P.report(q, 'b', q.round, 'win', 2, 0, q.roundAt + 6000); P.report(q, 'c', q.round, 'lose', 2, 0, q.roundAt + 6100);
  assert.equal(q.state, 'between');
}
// cheers do not exist anywhere else, and nothing else changed
for (const mode of ['versus', 'survival', 'knockout', 'balloon', 'cards', 'lantern']) { const r = match(mode, 3); finish(r, 'b'); rejects(() => cheer(r, 'b', 'sparkle', r.roundAt + 5000), 409); }
{
  const duo = P.newRoom('WAIT', 'duo', 0); ['A', 'B'].forEach(name => P.addPlayer(duo, { name }, rand)); P.start(duo, 'a', 1000, rand);
  assert.equal(P.sigPayload(duo, 'b', 0, [{ t: 'cheer', d: { anything: 1 } }]).m[0].t, 'cheer', 'DUO keeps relaying its own messages untouched');
  assert.equal(P.sigPayload(duo, 'b', 0, [{ t: 'sab', d: { anything: 1 } }]).m[0].t, 'sab');
  const bal = match('balloon', 3); assert.equal(P.sigPayload(bal, 'b', 0, [{ t: 'sab', d: { k: 'fog', to: 'a' } }], 9e5).m[0].d.k, 'fog', 'BALLOON keeps every kind');
}
console.log('wait server rules OK');

// ───────────── client ─────────────
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const calls = [];
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub(), toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==' }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  modeLabel: m => m.toUpperCase(), pressing: false, btns: [], button(x, y, w, h, label, fn) { sb.btns.push({ x, y, w, h, label, fn }); }, auth: () => ({ code: 'WAIT', id: sb.party.you.id, key: 'k' }),
  applyRoom() {}, roomGone() { sb.gone = true; }, partyErr: () => '', say() {}, partyLeave() {}, sigStamp: m => Object.assign(m, { n: 1, v: 'x' }),
  pcall: async (action, body) => { calls.push({ action, body }); return sb.reply; }, reply: { ok: true, status: 200, data: {} },
};
sb.party = { you: { id: 'a' }, view: 'wait', watch: { round: 0, frames: {}, target: null }, sig: { q: [], buf: [], round: 0, handler: null }, pending: null };
sb.me = () => sb.party.room.players.find(p => p.id === sb.party.you.id);
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/games/pt1.js', 'js/party-sab.js', 'js/party-react.js', 'js/party-modes.js', 'js/party-ghost.js', 'js/party-wait.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const run = s => vm.runInContext(s, sb), plain = s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', sb));
const mkRoom = mode => ({ id: 'rid', code: 'WAIT', mode, state: 'round', round: 0, total: 6, seed: 79, sp: 1, game: 'pt_mash', cur: {}, extra: {}, lives: 4,
  players: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: 'P' + i, color: ['#D97757', '#6EA8FE', '#7BD88F', '#F28CB1'][i], score: 0, lives: 3 })) });
const flush = () => new Promise(r => setTimeout(r, 5));
const seat = (room, id, view = 'wait') => { sb.party.room = room; sb.party.you.id = id; sb.party.view = view; sb.party.wait = null; sb.party.pending = null; sb.party.sig = { q: [], buf: [], round: 0, handler: null }; calls.length = 0; sb.gone = false; sb.reply = { ok: true, status: 200, data: {} }; run('now = 100'); };

// 1. the client lists are the server lists
assert.deepEqual(plain('CHEER_IDS'), P.CHEER_KINDS, 'client CHEER_IDS must match CHEER_KINDS in pocketbase/pb_hooks/party.js');
assert.deepEqual(plain('WAIT_CHEER_MODES'), P.CHEER_MODES); assert.deepEqual(plain('SAB_RACE_MODES'), P.RACE_MODES);
for (const id of P.CHEER_KINDS) {
  const kd = plain(`CHEER_KINDS[${JSON.stringify(id)}]`);
  assert.ok(kd.label && /^#[0-9a-fA-F]{6}$/.test(kd.col) && kd.life >= 2 && kd.life <= 3, id + ' has label, colour and a 2-3 s life'); assert.equal(run(`typeof CHEER_KINDS.${id}.draw`), 'function');
  for (const t of [0, .5, 1.7]) run(`CHEER_KINDS.${id}.draw(ctx, ${t}, 1, { seed: 42 })`);   // called straight (cheerDraw swallows errors): every kind draws
}

(async () => {
  // 2. when does the waiting screen show
  const vs = mkRoom('versus'); seat(vs, 'a');
  assert.equal(run('partyWaitOn(party.room)'), false, 'still playing: no waiting screen');
  vs.cur.a = { r: 'win' }; assert.equal(run('partyWaitOn(party.room)'), true, 'my result is in');
  delete vs.cur.a; sb.party.pending = { round: 0, r: 'lose' }; assert.equal(run('partyWaitOn(party.room)'), true, 'my result is on its way to the server');
  sb.party.pending = null; vs.cur.a = { r: 'win' };
  for (const [view, state] of [['play', 'round'], ['wait', 'between'], ['between', 'round']]) { sb.party.view = view; vs.state = state; assert.equal(run('partyWaitOn(party.room)'), false, view + '/' + state); }
  sb.party.view = 'wait'; vs.state = 'round';
  for (const mode of ['survival', 'knockout', 'lantern', 'cards', 'balloon', 'duo']) { const o = mkRoom(mode); o.cur.a = { r: 'win' }; sb.party.room = o; assert.equal(run('partyWaitOn(party.room)'), false, mode + ' has its own idle story'); }
  sb.party.room = vs;

  // 3. VERSUS kit: traps charge, time charges, SABOTAGE goes to players still playing, the cooldown and the cap hold
  seat(vs, 'a'); vs.cur.a = { r: 'win' };
  run('partyWaitUpdate(party.room, .1)'); assert.equal(run('party.wait.charges.max'), 2); assert.equal(run('!!party.wait.ch && !party.wait.cc'), true);
  run('partyWaitKey({ code: "KeyE" })'); assert.equal(calls.length, 0, 'no sabotage without a charge');
  run('party.wait.traps.spawn("bubble"); party.wait.traps.hitBubble()'); assert.equal(run('party.wait.charges.n'), 1, 'winning a trap charges');
  run('party.wait.charges.tick(60)'); assert.equal(run('party.wait.charges.n'), 2, 'so does time, up to the cap');
  run('party.wait.traps.spawn("dial"); party.wait.traps.dialStop(); party.wait.traps.spawn("seq")'); assert.equal(run('party.wait.charges.n'), 2);
  vs.cur.b = { r: 'win' }; run('party.watch.target = "b"; partyWaitKey({ code: "KeyE" })');
  assert.equal(calls.length, 1); assert.equal(calls[0].action, 'sig'); assert.equal(calls[0].body.round, 0);
  const m1 = calls[0].body.m[0]; assert.equal(m1.t, 'sab'); assert.ok(['c', 'd'].includes(m1.d.to), 'a player who finished is not hit, the key falls back to one still playing'); assert.ok(P.GHOST_KINDS.includes(m1.d.k), m1.d.k + ' is a soft kind');
  assert.equal(run('party.wait.charges.n'), 1);
  run('partyWaitKey({ code: "KeyE" })'); assert.equal(calls.length, 1, '2.4 s cooldown between two throws');
  run('party.wait.charges.tick(2.5); party.watch.target = "c"; partyWaitKey({ code: "KeyE" })'); assert.equal(calls.length, 2); assert.equal(calls[1].body.m[0].d.to, 'c'); assert.notEqual(calls[1].body.m[0].d.k, m1.d.k, 'never the same kind twice');
  // the server may refuse (the target just finished, a rate limit): the charge comes back; being out of the round does not refund
  await flush(); run('party.wait.charges.n = 1; party.wait.charges.cd = 0'); sb.reply = { ok: false, status: 429, data: {} };
  run('partyWaitKey({ code: "KeyE" })'); assert.equal(run('party.wait.charges.n'), 0); await flush(); assert.equal(run('party.wait.charges.n'), 1, 'a refused throw gives the charge back');
  sb.reply = { ok: false, status: 409, data: {} }; run('party.wait.charges.cd = 0; partyWaitKey({ code: "KeyE" })'); await flush(); assert.equal(run('party.wait.charges.n'), 1, 'a 409 (target already finished) refunds too');
  sb.reply = { ok: false, status: 404, data: {} }; run('party.wait.charges.cd = 0; partyWaitKey({ code: "KeyE" })'); await flush(); assert.equal(sb.gone, true, 'a vanished room closes the screen');
  sb.reply = { ok: true, status: 200, data: {} };

  // drawing: one SABOTAGE! card per other player, enabled only for players still playing; every trap renders; the toast pops
  seat(vs, 'a'); vs.cur = { a: { r: 'lose' }, b: { r: 'win' } }; run('partyWaitUpdate(party.room, .1); party.wait.charges.n = 2; party.wait.charges.cd = 0');
  sb.pick = { friends: vs.players.filter(p => p.id !== 'a'), alive: vs.players.filter(p => p.id !== 'a'), target: vs.players[2], frame: false };
  sb.btns.length = 0; run('partyWaitDraw(party.room, pick)');
  assert.equal(sb.btns.filter(b => b.label === 'SABOTAGE!').length, 4, 'one SABOTAGE! per other player plus the big one'); assert.ok(sb.btns.some(b => b.label === 'LEAVE'));
  const before = calls.length; sb.btns.filter(b => b.label === 'SABOTAGE!')[1].fn(); assert.equal(calls.length, before + 1); assert.equal(calls.at(-1).body.m[0].d.to, 'c', 'a card throws at its own player');
  assert.ok(run('fxs.some(f => f.k === "txt")'), 'the throw pops a toast');
  run('party.wait.charges.cd = 0; party.wait.charges.n = 2'); const n0 = calls.length; sb.btns.filter(b => b.label === 'SABOTAGE!')[0].fn(); assert.equal(calls.length, n0, 'the card of a player who already finished throws nothing');
  for (const spawn of ['bubble', 'dial', 'seq']) { run(`party.wait.traps.spawn("${spawn}")`); run('partyWaitDraw(party.room, pick)'); }
  run('now += .2; party.wait.flash = { k: "ink", at: now - .1, to: "c" }; party.watch.target = "c"; partyWaitDraw(party.room, pick)'); run('now += 5; partyWaitDraw(party.room, pick)');
  // a new round keeps the charges and starts new traps; leaving the waiting screen only lets the cooldown run
  run('party.wait.charges.n = 1'); vs.round = 1; vs.cur = { a: { r: 'win' } }; run('partyWaitUpdate(party.room, .1)'); assert.equal(run('party.wait.charges.n'), 1); assert.equal(run('party.wait.round'), 1); assert.equal(run('party.wait.traps.active()'), '');
  const cdBefore = run('party.wait.charges.cd = 3, 3'); vs.state = 'between'; run('partyWaitUpdate(party.room, 1)'); assert.equal(run('party.wait.charges.cd'), 2, 'the cooldown keeps running on the results screen'); assert.equal(run('party.wait.charges.n'), 1, 'but nothing else ticks'); vs.state = 'round';

  // 4. TEAM kit: only cheers. A channel for sabotage cannot even be built or used.
  const tm = mkRoom('team'); seat(tm, 'a'); tm.cur.a = { r: 'win' };
  run('partyWaitUpdate(party.room, .1)'); assert.equal(run('party.wait.charges.max'), 3); assert.equal(run('!!party.wait.cc && !party.wait.ch'), true, 'TEAM has a cheer channel and no sabotage channel');
  assert.equal(run('createSabChannel(party.room, { send() {} }, { charges: party.wait.charges, wait: true }).send("b")'), false, 'the shared sabotage channel refuses TEAM even when asked');
  run('party.wait.charges.n = 0; party.wait.charges.cd = 0; partyWaitKey({ code: "KeyE" })'); assert.equal(calls.length, 0, 'no cheer without a charge');
  run('party.wait.traps.spawn("bubble"); party.wait.traps.hitBubble()'); assert.equal(run('party.wait.charges.n'), 1);
  run('partyWaitKey({ code: "KeyE" })'); assert.equal(calls.length, 1); const c1 = calls[0].body.m[0]; assert.equal(c1.t, 'cheer'); assert.ok(P.CHEER_KINDS.includes(c1.d.k)); assert.equal(c1.d.to, undefined, 'a cheer goes to the whole team');
  assert.equal(run('party.wait.charges.n'), 0);
  run('party.wait.charges.n = 3; partyWaitKey({ code: "KeyE" })'); assert.equal(calls.length, 1, '1.6 s cooldown between cheers');
  run('party.wait.charges.tick(1.7); partyWaitKey({ code: "KeyQ" })'); assert.equal(calls.length, 2); assert.notEqual(calls[1].body.m[0].d.k, c1.d.k, 'never the same cheer twice');
  assert.ok(calls.every(c => c.body.m[0].t === 'cheer'), 'TEAM never sends a sab');
  await flush(); run('party.wait.charges.n = 1; party.wait.charges.cd = 0'); sb.reply = { ok: false, status: 429, data: {} }; run('partyWaitKey({ code: "KeyE" })'); await flush(); assert.equal(run('party.wait.charges.n'), 1, 'a refused cheer gives the charge back'); sb.reply = { ok: true, status: 200, data: {} };
  tm.cur.b = { r: 'win' }; sb.pick = { friends: tm.players.filter(p => p.id !== 'a'), alive: tm.players.filter(p => p.id !== 'a'), target: tm.players[2], frame: false };
  run('party.wait.charges.n = 2; party.wait.charges.cd = 0'); sb.btns.length = 0; run('partyWaitDraw(party.room, pick)');
  assert.ok(!sb.btns.some(b => b.label === 'SABOTAGE!'), 'no SABOTAGE! button anywhere in TEAM'); assert.equal(sb.btns.filter(b => b.label === 'CHEER!').length, 1);
  run('party.wait.hits = {}'); const k0 = calls.length; sb.btns.find(b => b.label === 'CHEER!').fn(); assert.equal(calls.length, k0 + 1); assert.equal(calls.at(-1).body.m[0].t, 'cheer');
  assert.equal(run('Object.keys(party.wait.hits).sort().join()'), 'c,d', 'the teammates still playing light up (b already finished)');
  for (const spawn of ['bubble', 'dial', 'seq']) { run(`party.wait.traps.spawn("${spawn}")`); run('partyWaitDraw(party.room, pick)'); }
  run('now += .2; partyWaitDraw(party.room, pick)');

  // 5. the players still playing: VERSUS takes the thrower's soft hit, TEAM sees the cheer; nothing else lands
  seat(vs, 'b', 'play'); vs.round = 0; vs.cur = { a: { r: 'win' } }; sb.party.sig = { q: [], buf: [{ round: 0, t: 'sab', d: { k: 'ink', to: 'c' }, from: 'a' }], round: 0, handler: null }; run('now = 1000');
  const seen = []; { const real = sb.sabBegin; sb.sabBegin = (st, c, where) => { seen.push(st); return real(st, c, where); }; }
  const vgame = run('partyBuildGame(party.room, party.room.sp)');
  assert.equal(typeof sb.party.sig.handler, 'function', 'a player still playing attaches a receiver'); assert.equal(sb.party.sig.buf.length, 0);
  const recv = (type, d, from) => sb.party.sig.handler(type, d, from), last = () => seen.at(-1);
  run('fxs.length = 0'); recv('sab', { k: 'ink', to: 'c' }, 'a'); assert.ok(run('fxs.some(f => f.k === "txt")'), 'a hit on somebody else is a toast');
  for (const [k, from] of [['fog', 'a'], ['flip', 'a'], ['dark', 'a'], ['nuke', 'a'], ['ink', 'zz']]) { recv('sab', { k, to: 'b' }, from); vgame.draw(0); assert.equal(last(), null, k + ' from ' + from + ' must not land'); }
  recv('sab', { k: 'pixel', to: 'b' }, 'a'); vgame.draw(0);
  const hit = last(); assert.ok(hit && hit.k === 'pixel' && hit.name === 'P0'); assert.equal(hit.str, .6, 'soft like a ghost: 60% strength'); assert.ok(Math.abs(hit.life - 3.6 * .75) < 1e-9, 'and 75% as long');
  run('now += 4'); vgame.draw(0); assert.equal(last(), null, 'it expires on its own');
  for (const k of P.GHOST_KINDS) { recv('sab', { k, to: 'b' }, 'c'); run('now += .5'); vgame.draw(.1); assert.equal(last().k, k, k + ' lands'); run('now += 4'); }
  recv('cheer', { k: 'sparkle' }, 'a'); vgame.draw(0);   // a cheer in VERSUS means nothing
  seat(tm, 'b', 'play'); tm.cur = { a: { r: 'win' } }; sb.party.sig = { q: [], buf: [{ round: 0, t: 'cheer', d: { k: 'hearts' }, from: 'a' }], round: 0, handler: null }; run('now = 1000');
  run('fxs.length = 0'); const tgame = run('partyBuildGame(party.room, party.room.sp)'); assert.equal(typeof sb.party.sig.handler, 'function', 'TEAM players attach a receiver too'); seen.length = 0;
  tgame.draw(0); tgame.draw(.1);   // the buffered cheer is on me: the overlay and the pill draw without throwing
  assert.ok(run('fxs.some(f => f.k === "txt")'), 'the cheer toast');
  for (const k of P.CHEER_KINDS) { sb.sparks = 0; recv('cheer', { k }, 'c'); for (const dt of [0, .3, 1, 2]) { run(`now += ${dt}`); tgame.draw(.2); } run('now += 5'); tgame.draw(.2); }
  for (const bad of [{ k: 'ink' }, { k: 'nuke' }, null, {}]) recv('cheer', bad, 'a');
  recv('cheer', { k: 'sparkle' }, 'b'); recv('cheer', { k: 'sparkle' }, 'zz');   // my own and a stranger's are ignored
  recv('sab', { k: 'ink', to: 'b' }, 'a'); tgame.draw(0); assert.equal(seen.every(s => s === null), true, 'TEAM never takes a sabotage, even if one were relayed');
  run('now += 5; cheerBanner(null); cheerDraw(null)');
  // a cheer is only overlay + toast: it does not alter the game or its result
  assert.equal(tgame.result, undefined);
  // the lobby / leaving resets the kit
  assert.equal(fs.readFileSync('js/party.js', 'utf8').includes('party.wait = null'), true);
  console.log('wait client kit OK');
})().catch(e => { console.error(e); process.exit(1); });
