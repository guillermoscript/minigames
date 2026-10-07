'use strict';
// Shared sabotage kit: registry, charge economy, channel, idle traps and the server/client kind lists. Run: node test/party-sab.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const P = require('../pocketbase/pb_hooks/party.js');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub() }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  party: { you: { id: 'a' } }, btns: [], button() {},
};
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/party-sab.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const run = s => vm.runInContext(s, sb), plain = s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', sb));

// 1. The server list and the client registry are the same list, in the same order; co-op modes never opt in.
assert.deepEqual(plain('SAB_IDS'), P.SAB_KINDS, 'client SAB_IDS must match SAB_KINDS in pocketbase/pb_hooks/party.js');
assert.deepEqual(plain('SAB_MODES'), P.SAB_MODES, 'client SAB_MODES must match SAB_MODES in the hook');
assert.deepEqual(plain('SAB_GHOST_MODES'), P.GHOST_MODES, 'client SAB_GHOST_MODES must match GHOST_MODES in the hook');
assert.deepEqual(plain('SAB_RACE_MODES'), P.RACE_MODES, 'client SAB_RACE_MODES must match RACE_MODES in the hook');
assert.deepEqual(plain('SAB_IDS.filter(k => SAB_KINDS[k].ghost)'), P.GHOST_KINDS, 'the client `ghost` kinds must match GHOST_KINDS in the hook');
for (const k of P.GHOST_KINDS) assert.ok(P.SAB_KINDS.includes(k) && !run(`SAB_KINDS.${k}.tvOnly`), k + ' is a real kind a living player can take');
assert.ok(!P.GHOST_KINDS.includes('flip') && !P.GHOST_KINDS.includes('fog') && !P.GHOST_KINDS.includes('dark'), 'ghosts never mirror the controls or black the game out');
for (const coop of ['team', 'lantern', 'duo', 'squad']) assert.ok(!P.SAB_MODES.includes(coop) && !P.GHOST_MODES.includes(coop) && !P.RACE_MODES.includes(coop), coop + ' is co-op: no sabotage');
for (const k of ['ink', 'fog', 'dark', 'bugs']) assert.ok(P.SAB_KINDS.includes(k), 'original kind kept: ' + k);
assert.ok(P.SAB_KINDS.length >= 8);
// every kind is a complete registry entry: short (3-5 s) and able to render something
for (const id of P.SAB_KINDS) {
  const kind = run(`SAB_KINDS[${JSON.stringify(id)}]`);
  assert.equal(kind.id, id); assert.ok(kind.label && kind.icon && /^#[0-9a-fA-F]{6}$/.test(kind.col), id + ' has label, icon, colour');
  assert.ok(kind.life >= 3 && kind.life <= 5, id + ' lasts 3-5 s'); assert.ok(typeof kind.draw === 'function' || typeof kind.pre === 'function', id + ' renders');
}

// 2. Render protocol: balanced save/restore, per-role scopes, and every kind survives a full life without throwing.
const rec = () => { const c = { saves: 0, restores: 0 }; return new Proxy(c, { get: (o, k) => k in o ? o[k] : k === 'save' ? () => o.saves++ : k === 'restore' ? () => o.restores++ : k === 'getTransform' ? () => ({ a: 1, d: 1, e: 0, f: 0 }) : () => {}, set: () => true }); };
for (const id of P.SAB_KINDS) {
  const full = !!run(`SAB_KINDS.${id}.full`);
  for (const where of ['view', 'tv', 'full']) {
    run(`globalThis.s = sabMake(${JSON.stringify(id)}, 'X')`);
    const c = rec();
    for (const step of [.1, 1, 2, 3.2]) {
      run(`now = s.at + ${step}`);
      sb.c = c; run('globalThis.fx = sabBegin(s, c, ' + JSON.stringify(where) + '); sabEnd(fx)');
      const applies = where === 'view' || (where === 'full') === full;
      assert.equal(sb.fx !== null, applies, `${id} in ${where}: applies ${applies}`);
    }
    assert.equal(c.saves, c.restores, `${id}/${where}: save and restore stay balanced`);
  }
  run('now = s.at + 99'); assert.equal(run('sabLive(s)'), false); sb.c = rec(); assert.equal(run('sabBegin(s, c, "view")'), null, 'an expired hit draws nothing');
}
// a helper's whole screen is never mirrored (its buttons would stop matching), and nobody throws mirror at a helper
assert.equal(run('SAB_KINDS.flip.full'), undefined); assert.equal(run('SAB_KINDS.flip.tvOnly'), true);
// FLIP mirrors the actor's input only while the picture is turned around
run(`now = 100; globalThis.f = sabMake('flip', 'X')`);
run('now = f.at + .05'); assert.equal(run('sabMirrored(f)'), false);
run('now = f.at + 1'); assert.equal(run('sabMirrored(f)'), true);
run('now = f.at + 99'); assert.equal(run('sabMirrored(f)'), false); assert.equal(run('sabMirrored(null)'), false);
assert.deepEqual(JSON.parse(run(`JSON.stringify(sabMirrorKey({ code: 'ArrowLeft', key: 'ArrowLeft', repeat: false }))`)), { code: 'ArrowRight', key: 'ArrowRight', repeat: false });
assert.equal(run(`sabMirrorKey({ code: 'KeyA', key: 'a' }).key`), 'd'); assert.equal(run(`sabMirrorKey({ code: 'Space', key: ' ' }).code`), 'Space');

// 3. Charge economy.
run(`globalThis.cg = createSabCharges()`);
assert.equal(run('cg.ready()'), false, 'starts empty');
run('cg.tick(5.9)'); assert.equal(run('cg.n'), 0); run('cg.tick(.2)'); assert.equal(run('cg.n'), 1, 'one charge per 6 s');
assert.equal(run('cg.earn("trap")'), true); assert.equal(run('cg.n'), 2, 'a trap success earns one');
assert.equal(run('cg.earn("combo", 7)'), false); assert.equal(run('cg.earn("combo", 10)'), true); assert.equal(run('cg.n'), 3);
run('cg.earn("trap"); cg.tick(7)'); assert.equal(run('cg.n'), 3, 'capped at max 3');
assert.equal(run('cg.spend()'), true); assert.equal(run('cg.n'), 2); assert.equal(run('cg.ready()'), false, 'cooldown after a send');
assert.equal(run('cg.spend()'), false); run('cg.tick(2.9)'); assert.equal(run('cg.ready()'), false); run('cg.tick(.2)'); assert.equal(run('cg.ready()'), true);
run(`globalThis.c2 = createSabCharges({ max: 1, every: 2, trap: 5, comboEvery: 3, cooldown: 0 })`);
run('c2.earn("trap")'); assert.equal(run('c2.n'), 1, 'per-mode config caps too'); run('c2.spend()'); assert.equal(run('c2.ready()'), false);
assert.equal(run('c2.earn("combo", 3)'), true); assert.equal(run('c2.ready()'), true, 'cooldown 0 allows back to back');

// 4. Channel: send picks a kind + target, spends a charge and relays; receive validates against the registry.
const sent = [];
sb.relay = { send: (type, d) => sent.push({ type, d }) };
sb.room = { mode: 'balloon', players: [{ id: 'a', name: 'A', color: '#fff' }, { id: 'b', name: 'B', color: '#fff' }, { id: 'c', name: 'C', color: '#fff', left: true }, { id: 'd', name: 'D', color: '#fff' }] };
run(`now = 200; globalThis.ch = createSabChannel(room, relay, { charges: createSabCharges(), actorId: 'a' })`);
assert.equal(run('ch.send()'), false, 'no charge, no sabotage'); assert.equal(sent.length, 0);
assert.deepEqual(plain('ch.targets().map(p => p.id)'), ['b', 'd'], 'left players and yourself are not targets');
run('ch.charges.earn("trap"); ch.charges.earn("trap")');
assert.equal(run('ch.send()'), true); assert.equal(sent[0].type, 'sab'); assert.equal(sent[0].d.to, 'b'); assert.ok(P.SAB_KINDS.includes(sent[0].d.k));
assert.equal(run('ch.send()'), false, 'cooldown blocks the second throw'); run('ch.charges.tick(3)');
assert.equal(run('ch.send("d")'), true); assert.equal(sent[1].d.to, 'd'); assert.notEqual(sent[1].d.k, sent[0].d.k, 'never the same kind twice in a row');
for (let i = 0; i < 80; i++) assert.ok(run('ch.pick("b")') !== 'flip', 'a helper is never sent a television-only kind');
assert.ok(new Set(Array.from({ length: 200 }, () => run('ch.pick("a")'))).has('flip'), 'the actor can get any kind');
run('ch.charges.cd = 0'); assert.equal(run('ch.charges.n'), 0); assert.equal(run('ch.send()'), false);
for (const bad of [{ k: 'constructor', to: 'a' }, { k: '__proto__', to: 'a' }, { k: 'ink', to: 7 }, null, { to: 'a' }]) assert.equal(run('ch.receive("sab", ' + JSON.stringify(bad) + ', "b")'), false);
assert.equal(run('ch.receive("light", { k: "ink", to: "a" }, "b")'), false);
assert.equal(run('ch.receive("sab", { k: "fog", to: "a" }, "b")'), true); assert.equal(run('ch.active().k'), 'fog'); assert.equal(run('ch.active().name'), 'B');
assert.equal(run('ch.receive("sab", { k: "ink", to: "d" }, "b")'), true); assert.equal(run('ch.active().k'), 'fog', 'a hit on someone else changes nothing for me');
assert.equal(run('ch.receive("sab", { k: "ink", to: "a" }, "a")'), true); assert.equal(run('ch.active().k'), 'fog', 'you cannot sabotage yourself');
assert.equal(run('ch.receive("sab", { k: "ink", to: "a" }, "c")'), true); assert.equal(run('ch.active().k'), 'fog', 'a hit that lands while another is live does not restart it (no chained overlays)'); assert.equal(run('ch.active().name'), 'B');
run('now += 10'); assert.equal(run('ch.active()'), null, 'a hit expires on its own');
assert.equal(run('ch.receive("sab", { k: "ink", to: "a" }, "c")'), true); assert.equal(run('ch.active().k'), 'ink', 'once the last one is over the next lands');
run('now += 10');
sb.room.mode = 'team'; assert.equal(run('ch.receive("sab", { k: "fog", to: "a" }, "b")'), false, 'team never receives'); assert.equal(run('ch.send()'), false);

// 5. Idle traps: every trap spawns, pays out through the callback, and the pump gate behaves.
sb.rewards = [];
const fresh = () => run(`globalThis.tr = createIdleTraps({ first: [0, 0], gap: [0, 0], onReward: t => rewards.push(t) })`);
fresh(); assert.equal(run('tr.gate()'), 1); assert.equal(run('tr.active()'), '');
run('tr.update(.1)'); assert.notEqual(run('tr.active()'), '', 'a trap appears when due');
const wins = { jam: 'for (let i = 0; i < 8; i++) tr.wiggle(i % 2 ? 1 : -1)', bubble: 'tr.hitBubble()', seq: 'tr.seq.keys.slice().forEach(k => tr.seqPress(k))',
  dial: 'tr.dial.zone = .5 + .5 * Math.sin(tr.dial.seed + (0 - tr.dial.at) * 4.6); tr.dialStop()', fly: 'tr.swat()' };
for (const kind of Object.keys(wins)) {
  fresh(); run(`tr.spawn(${JSON.stringify(kind)})`); assert.equal(run('tr.active()'), kind);
  const before = sb.rewards.length; run(wins[kind]);
  assert.equal(run('tr.active()'), '', kind + ' is solved');
  assert.equal(sb.rewards.length, before + (['bubble', 'seq', 'dial'].includes(kind) ? 1 : 0), kind + ' reward callback');
}
assert.deepEqual(sb.rewards.slice().sort(), ['bubble', 'dial', 'seq'], 'only bubble, dial and sequence pay a charge');
// failing and timing out
fresh(); run('tr.spawn("dial"); tr.dial.zone = 2; tr.dialStop()'); assert.equal(run('tr.stuck()'), true, 'a missed dial stalls the pump for a moment'); assert.equal(run('tr.gate()'), 0);
fresh(); run('tr.spawn("seq"); tr.seqPress((tr.seq.keys[0] + 1) % 3)'); assert.equal(run('tr.seq.i'), 0, 'a wrong arrow restarts the sequence');
fresh(); run('tr.spawn("bubble")'); run('tr.update(3)'); assert.equal(run('tr.active()'), '', 'a bubble left alone just pops');
fresh(); run('tr.spawn("jam")'); assert.equal(run('tr.stuck()'), true); assert.equal(run('tr.gate()'), 0, 'a stuck valve swallows taps'); assert.equal(run('tr.shaking()'), true);
run('tr.update(30)'); assert.equal(run('tr.active()'), 'jam', 'a jam never times out');
assert.equal(run('tr.key("Space")'), false, 'the pump key is the host\'s'); assert.equal(run('tr.key("KeyD")'), true);
for (let i = 0; i < 8; i++) run(`tr.key(${i % 2 ? '"KeyD"' : '"KeyA"'})`);
assert.equal(run('tr.active()'), '', 'alternating A/D clears the jam'); assert.equal(run('tr.turboOn()'), true); assert.equal(run('tr.gate()'), 2, 'turbo doubles the air');
run('tr.spawn("fly")'); let eaten = 0; for (let i = 0; i < 400; i++) if (run('tr.gate()') === 0) eaten++; assert.ok(eaten > 150 && eaten < 290, 'a fly eats about 55% of taps (' + eaten + ')');
assert.equal(run('tr.key("KeyF")'), true); assert.equal(run('tr.active()'), '');
run(`globalThis.only = createIdleTraps({ first: [0, 0], gap: [0, 0], weights: { fly: 0, jam: 0, bubble: 1, dial: 0, seq: 0 } })`);
for (let i = 0; i < 5; i++) { run('only.update(.1)'); assert.equal(run('only.active()'), 'bubble', 'weights restrict the traps'); run('only.update(9)'); }
// drawing every trap against the stub canvas never throws and registers tap targets
for (const kind of Object.keys(wins)) { fresh(); run(`tr.spawn(${JSON.stringify(kind)}); btns.length = 0; tr.draw(222, 492, 362, () => {})`); if (kind === 'fly' || kind === 'bubble') assert.ok(sb.btns.length > 0, kind + ' registers its tap target'); }
fresh(); sb.idleDrawn = false; run('tr.draw(222, 492, 362, () => { idleDrawn = true; })'); assert.equal(sb.idleDrawn, true, 'no trap: the host draws its own panel');

// 6. Server: one helper decides who may sabotage whom; the relay validates kind, mode and target.
const room = mode => { const r = P.newRoom('TEST', mode, 0); ['A', 'B', 'C'].forEach(name => P.addPlayer(r, { name }, Math.random)); P.start(r, 'a', 1000, Math.random); return r; };
const rejects = (fn, status) => assert.throws(fn, e => e instanceof P.PartyError && e.status === status);
for (const mode of P.SAB_MODES) {
  const r = room(mode);
  assert.equal(P.sabAllowed(r, 'a', 'b'), true); assert.equal(P.sabAllowed(r, 'b', 'a'), true);
  assert.equal(P.sabAllowed(r, 'a', 'a'), false, 'not yourself'); assert.equal(P.sabAllowed(r, 'a', 'zz'), false); assert.equal(P.sabAllowed(r, 'a', 7), false);
  for (const k of P.SAB_KINDS) assert.equal(P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k, to: 'a' } }]).m[0].d.k, k, mode + ' relays ' + k);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'nuke', to: 'a' } }]), 400);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'ink', to: 'nobody' } }]), 400);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'ink', to: 'b' } }]), 400);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'ink' } }]), 400);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab' }]), 400);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'ink', to: 'a' } }]) && P.sigPayload(r, 'b', 1, [{ t: 'sab', d: { k: 'ink', to: 'a' } }]), 409);
}
// BALLOON / CARDS throws are rate limited too (a modified client cannot skip the charge economy): not before the instruction card is over, a gap per thrower, a long gap per victim
const limiterOf = () => { const m = new Map(); return { get: k => m.get(k), set: (k, v) => m.set(k, v) }; };
const lockedLimiterOf = () => { const m = new Map(); return { get: k => m.get(k), set: (k, v) => m.set(k, v), update: (k, fn) => m.set(k, fn(m.get(k))), m }; };
for (const mode of P.SAB_MODES) for (const mk of [limiterOf, lockedLimiterOf]) {
  const r = room(mode), lim = mk(), t0 = r.roundAt, go = (from, to, at, k = 'fog') => P.sigPayload(r, from, 0, [{ t: 'sab', d: { k, to } }], at, lim);
  if (mode === 'balloon') rejects(() => go('b', 'a', t0 + 200), 409);                      // the instruction card is still up (a CARDS deck pick has none)
  go('b', 'a', t0 + 5000);
  rejects(() => go('b', 'c', t0 + 5000 + P.SAB_GAP_MS - 100), 429);                       // same thrower, too soon
  rejects(() => go('c', 'a', t0 + 5000 + P.SAB_GAP_MS + 100), 429);                       // the same victim again before their breather is over, even from somebody else
  go('c', 'b', t0 + 5100);                                                                // another victim is fine
  go('b', 'a', t0 + 5000 + P.SAB_HIT_GAP_MS + 100, 'flip');                               // after the breather the same victim can be hit
  assert.ok(P.SAB_HIT_GAP_MS >= 4600, 'longer than the longest sabotage (4 s) so hits cannot be chained');
  assert.ok(P.SAB_GAP_MS <= 3000, 'at most the 3 s client cooldown, so honest throws are never refused');
  rejects(() => P.sigPayload(r, 'c', 0, [{ t: 'sab', d: { k: 'ink', to: 'a' } }, { t: 'sab', d: { k: 'ink', to: 'b' } }, { t: 'sab', d: { k: 'fog', to: 'a' } }], t0 + 60000, lim), 429);   // ten per request is not ten throws
  if (mk === lockedLimiterOf) assert.equal(lim.m.size, 1, 'one store key per room');
}
// the allowances of a finished game are not inherited by a rematch with the same room code: they belong to a round token (round + seed), not to the round number alone
{
  const r = P.newRoom('GHST', 'knockout', 0); for (let i = 0; i < 4; i++) P.addPlayer(r, { name: 'P' + i }, Math.random); P.start(r, 'a', 1000, Math.random);
  r.players.forEach(p => P.report(r, p.id, r.round, p.id === 'a' ? 'lose' : 'win', 1, 5, 1100)); P.advance(r, r.round, r.betweenAt + 5000, Math.random);
  const lim = lockedLimiterOf(), t0 = r.roundAt + 2000, go = (to, at) => P.sigPayload(r, 'a', r.round, [{ t: 'sab', d: { k: 'ink', to } }], at, lim);
  go('c', t0); go('d', t0 + P.GHOST_GAP_MS + 100); rejects(() => go('b', t0 + P.GHOST_GAP_MS * 2 + 200), 429);
  r.seed += 1; go('b', t0 + 60000);                                                       // same code, same round number, another game: a fresh allowance
  const tr = P.newRoom('TEAM', 'team', 0); for (let i = 0; i < 3; i++) P.addPlayer(tr, { name: 'P' + i }, Math.random); P.start(tr, 'a', 1000, Math.random);
  tr.cur = { a: { r: 'win' } }; const cl = lockedLimiterOf(), cheer = at => P.sigPayload(tr, 'a', tr.round, [{ t: 'cheer', d: { k: 'sparkle' } }], at, cl);
  for (let i = 0; i < P.CHEER_ROUND_MAX; i++) cheer(tr.roundAt + 3000 + i * 2000); rejects(() => cheer(tr.roundAt + 20000), 429);
  tr.seed += 1; cheer(tr.roundAt + 30000);
}
// emotes and bets: a burst, then one per REACT_REFILL_MS
{
  const r = room('cards'), lim = lockedLimiterOf(), em = at => P.sigPayload(r, 'b', 0, [{ t: 'react', d: { k: 'fire' } }], at, lim);
  for (let i = 0; i < P.REACT_BURST; i++) em(5000);
  rejects(() => em(5000), 429); em(5000 + P.REACT_REFILL_MS + 5);
  rejects(() => P.sigPayload(r, 'c', 0, Array.from({ length: 10 }, () => ({ t: 'react', d: { k: 'fire' } })), 9000, lim) && P.sigPayload(r, 'c', 0, Array.from({ length: 10 }, () => ({ t: 'react', d: { k: 'fire' } })), 9000, lim), 429);   // ten per request x two requests in the same ms
  for (let i = 0; i < 60; i++) em(20000 + i * 1000); // a slow honest tapper is never refused
}
for (const mode of ['lantern', 'team']) {
  let r; try { r = room(mode); } catch (_) { continue; }
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'ink', to: 'a' } }]), 409);
  assert.equal(P.sabAllowed(r, 'b', 'a'), false, mode + ' never opts in');
}
for (const mode of P.GHOST_MODES) {   // the living never sabotage each other in SURVIVAL / KNOCKOUT
  const r = room(mode);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'sab', d: { k: 'ink', to: 'a' } }]), 403);
  assert.equal(P.sabAllowed(r, 'b', 'a'), false, mode + ': an alive player cannot sabotage');
}
const duo = P.newRoom('TEST', 'duo', 0); ['A', 'B'].forEach(name => P.addPlayer(duo, { name }, Math.random)); P.start(duo, 'a', 1000, Math.random);
assert.equal(P.sigPayload(duo, 'b', 0, [{ t: 'sab', d: { anything: 1 } }]).m[0].t, 'sab', 'DUO keeps relaying its own messages untouched');
console.log('party sab: registry, server/client parity, charges, channel, idle traps and relay opt-in OK');
