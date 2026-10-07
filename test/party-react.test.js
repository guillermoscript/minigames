'use strict';
// Table reactions and deck guesses (js/party-react.js) plus the CARDS rules that go with them. Run: node test/party-react.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const P = require('../pocketbase/pb_hooks/party.js');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub() }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  party: { you: { id: 'a' } }, btns: [], buttons: [], button: (...a) => sb.buttons.push(a),
};
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/party-sab.js', 'js/party-react.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const run = s => vm.runInContext(s, sb), plain = s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', sb));
const rejects = (fn, status) => assert.throws(fn, e => e instanceof P.PartyError && e.status === status);

// 1. The server lists and the client registry are the same lists; only modes with idle watchers opt in.
assert.deepEqual(plain('REACT_IDS'), P.REACT_KINDS, 'client REACT_IDS must match REACT_KINDS in pocketbase/pb_hooks/party.js');
assert.deepEqual(plain('REACT_MODES'), P.REACT_MODES, 'client REACT_MODES must match REACT_MODES in the hook');
assert.deepEqual(plain('GUESS_SIDES'), P.GUESS_SIDES, 'client GUESS_SIDES must match GUESS_SIDES in the hook');
for (const coop of ['team', 'lantern', 'duo', 'squad']) assert.ok(!P.REACT_MODES.includes(coop), coop + ' has no idle players');
assert.ok(P.REACT_MODES.includes('cards') && P.SAB_MODES.includes('cards'));

// 2. Server: reactions and guesses are validated relay messages, only in modes that opted in.
let seed = 5; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const room = mode => { const r = P.newRoom('TEST', mode, 0); ['A', 'B', 'C'].forEach(name => P.addPlayer(r, { name }, rand)); P.start(r, 'a', 1000, rand); return r; };
const cards = room('cards');
assert.equal(cards.extra.phase, 'draw'); assert.equal(cards.extra.actor, 'a');
for (const k of P.REACT_KINDS) for (const who of ['a', 'b']) assert.deepEqual(P.sigPayload(cards, who, 0, [{ t: 'react', d: { k } }]).m[0].d, { k }, who + ' may send ' + k);
rejects(() => P.sigPayload(cards, 'b', 0, [{ t: 'react', d: { k: 'nuke' } }]), 400);
rejects(() => P.sigPayload(cards, 'b', 0, [{ t: 'react', d: { k: 'constructor' } }]), 400);
rejects(() => P.sigPayload(cards, 'b', 0, [{ t: 'react' }]), 400);
for (const s of P.GUESS_SIDES) assert.deepEqual(P.sigPayload(cards, 'b', 0, [{ t: 'guess', d: { s } }]).m[0].d, { s });
rejects(() => P.sigPayload(cards, 'b', 0, [{ t: 'guess', d: { s: 'middle' } }]), 400);
rejects(() => P.sigPayload(cards, 'b', 0, [{ t: 'guess' }]), 400);
rejects(() => P.sigPayload(cards, 'a', 0, [{ t: 'guess', d: { s: 'left' } }]), 400);   // the player who draws does not bet on their own pick
rejects(() => P.sigPayload(cards, 'b', 1, [{ t: 'react', d: { k: 'star' } }]), 409);   // wrong round
for (const mode of ['versus', 'team', 'lantern', 'balloon', 'survival']) {
  const r = room(mode);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'react', d: { k: 'heart' } }]), 409);
  rejects(() => P.sigPayload(r, 'b', 0, [{ t: 'guess', d: { s: 'left' } }]), 409);
}
const duo = P.newRoom('TEST', 'duo', 0); ['A', 'B'].forEach(name => P.addPlayer(duo, { name }, rand)); P.start(duo, 'a', 1000, rand);
assert.equal(P.sigPayload(duo, 'b', 0, [{ t: 'react', d: { anything: 1 } }]).m[0].t, 'react', 'DUO keeps relaying its own messages untouched');
// a guess is only for a deck pick: in a challenge there is nothing to bet on
cards.keys._deck = ['pt_sync', 'play', 'pt_grab', 'play']; cards.extra.deck = 4;
P.drawCard(cards, 'a', 0, 'left', 3000, rand); assert.equal(cards.extra.side, 'left', 'the hook records which deck was picked');
P.drawCard(cards, 'b', cards.round, 'right', 4000, rand); assert.equal(cards.extra.side, 'right'); assert.equal(cards.extra.phase, 'challenge');
rejects(() => P.sigPayload(cards, 'a', cards.round, [{ t: 'guess', d: { s: 'left' } }]), 400);
rejects(() => P.sigPayload(cards, 'c', cards.round, [{ t: 'guess', d: { s: 'left' } }]), 400);
assert.equal(P.sigPayload(cards, 'c', cards.round, [{ t: 'react', d: { k: 'fire' } }]).m[0].t, 'react', 'emotes are fine in any phase');
assert.equal(P.sigPayload(cards, 'c', cards.round, [{ t: 'sab', d: { k: 'ink', to: 'b' } }]).m[0].t, 'sab');

// 3. CARDS pace: a deck pick has no instruction card, the pile card is read in 2.2 s (lantern keeps its 4 s).
const pace = room('cards');
assert.equal(pace.extra.phase, 'draw'); assert.equal(P.roundMs(pace), Math.round(30000 / Math.sqrt(pace.sp)), 'a draw round is just the deck pick: no instruction card');
pace.keys._deck = ['pt_sync', 'play', 'pt_grab', 'play']; pace.extra.deck = 4;
P.drawCard(pace, 'a', 0, 'left', 3000, rand); P.drawCard(pace, 'b', pace.round, 'left', 4000, rand);
assert.equal(pace.extra.phase, 'challenge');
pace.players[0].score = 0; pace.players[2].score = 2;
P.stealCard(pace, 'a', pace.round, 'c', pace.roundAt + P.PRE_MS_CARDS - 10); assert.equal((pace.extra.stealing || {}).a, undefined, 'no stealing while the pile card is shown');
P.stealCard(pace, 'a', pace.round, 'c', pace.roundAt + P.PRE_MS_CARDS + 10); assert.ok(pace.extra.stealing.a, 'stealing opens as soon as the card has been read');
assert.ok(P.PRE_MS_CARDS < P.PRE_MS_TURN, 'CARDS waits less than the 4 s of LANTERNS');
const lan = room('lantern'); assert.equal(P.roundMs(lan), Math.round(P.GAMES[lan.game].dur / Math.sqrt(lan.sp) * 1000) + P.PRE_MS_TURN, 'LANTERNS keeps its instruction card');

// 4. Client: the emote bar.
const R = { id: 'r1', round: 0, mode: 'cards', players: [{ id: 'a', name: 'A', color: '#D97757' }, { id: 'b', name: 'B', color: '#6EA8FE' }, { id: 'c', name: 'C', color: '#7BD88F' }] };
sb.R = R; sb.sent = []; sb.taps = [];
sb.relay = { send: (type, d, latest) => sb.sent.push({ type, d, latest }) };
run(`now = 10; globalThis.rx = createReactions(R, relay, { origin: id => ({ x: 100, y: 500 }), onTap: (n, k) => taps.push([n, k]) })`);
assert.equal(run('rx.send("heart")'), true); assert.deepEqual(plain('sent[0]'), { type: 'react', d: { k: 'heart' } });
assert.equal(run('rx.send("star")'), false, 'two taps in the same instant: the second is ignored');
for (let i = 2; i <= 12; i++) { run('now += .1'); assert.equal(run('rx.send("star")'), true); }
assert.deepEqual(plain('taps.at(-1)'), [12, 'star'], 'quick taps build a streak');
assert.equal(run('rx.streakNow()'), 12); run('now += 1'); assert.equal(run('rx.streakNow()'), 0, 'a pause ends the streak');
run('now += .1'); run('rx.send("fire")'); assert.deepEqual(plain('taps.at(-1)'), [1, 'fire']);
assert.equal(run('rx.send("nuke")'), false); assert.equal(run('rx.send("constructor")'), false);
const mine = run('rx.items.length');
assert.equal(run('rx.receive("react", { k: "wow" }, "b")'), true); assert.equal(run('rx.items.length'), mine + 1);
assert.equal(run('rx.receive("react", { k: "wow" }, "a")'), false, 'my own emote comes back from nowhere');
assert.equal(run('rx.receive("react", { k: "nuke" }, "b")'), false); assert.equal(run('rx.receive("react", null, "b")'), false);
assert.equal(run('rx.receive("react", { k: "wow" }, 3)'), false, 'a seat number is not a sender');
assert.equal(run('rx.receive("guess", { k: "wow" }, "b")'), false);
for (let i = 0; i < 30; i++) run('rx.receive("react", { k: "heart" }, "c")');
assert.equal(run('rx.items.filter(i => i.id === "c").length'), 12, 'one noisy friend cannot bury the table');
// drawing the floaters and the bar never throws and expires old emotes
run('now += .2'); sb.buttons.length = 0; run('rx.bar(244, 432, 312, 36)'); assert.equal(sb.buttons.length, 5, 'one button per emote');
sb.buttons.forEach((b, i) => { b[5](); assert.equal(sb.sent.at(-1).d.k, P.REACT_KINDS[i], 'button ' + i + ' throws emote ' + i); run('now += .2'); });
run('rx.draw()'); assert.ok(run('rx.items.length') > 0);
run('now += 5; rx.draw()'); assert.equal(run('rx.items.length'), 0, 'emotes float away');
for (const k of P.REACT_KINDS) run(`reactDraw(${JSON.stringify(k)}, 100, 100, 1.2)`);

// 5. Client: guesses.
sb.sent.length = 0;
run(`globalThis.picked = []; globalThis.gs = createGuess(R, relay, { onPick: s => picked.push(s) })`);
assert.equal(run('gs.pick("middle")'), false); assert.equal(sb.sent.length, 0);
assert.equal(run('gs.pick("left")'), true); assert.deepEqual(plain('sent[0]'), { type: 'guess', d: { s: 'left' }, latest: true }, 'a guess is a "latest" message: changing your mind replaces it');
assert.equal(run('gs.pick("left")'), true); assert.equal(sb.sent.length, 1, 'the same bet twice is sent once');
assert.equal(run('gs.receive("guess", { s: "right" }, "b")'), true); assert.equal(run('gs.receive("guess", { s: "up" }, "c")'), false);
assert.equal(run('gs.receive("guess", { s: "left" }, "a")'), false); assert.equal(run('gs.receive("react", { s: "left" }, "c")'), false);
assert.deepEqual(plain('gs.sides()'), { left: ['a'], right: ['b'] });
run('gs.pick("right")'); assert.deepEqual(plain('gs.sides()'), { left: [], right: ['a', 'b'] }); assert.deepEqual(plain('picked'), ['left', 'left', 'right']);

// 6. Shared orbs: no numbers, every state draws.
run('globalThis.cg = createSabCharges()');
for (const n of [0, 1, 2, 3]) { run(`cg.n = ${n}; sabOrbs(cg, 400, 300, { r: 12, gap: 31, pulse: now - .1 })`); }
console.log('party react: server rules, emote bar, guesses, pace and parity OK');
