'use strict';
// Exercises the real wrappers with a delayed in-memory input relay and canvas stubs.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  party: { you: { id: 'a' } }, pendingMoves: [], button() {}, pcall: async () => ({ ok: false, status: 409 }), auth: () => ({}), applyRoom() {}, roomGone() {}, partyErr: () => '', say() {}, me: () => ({ color: '#fff' }),
};
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/games/pt1.js', 'js/party-modes.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const makeRoom = mode => ({ mode, round: 0, state: 'round', seed: 79, sp: 1.49, game: 'pt_mash', players: [{ id: 'a', name: 'A', color: '#D97757', score: 3 }, { id: 'b', name: 'B', color: '#6EA8FE', score: 2 }, { id: 'c', name: 'C', color: '#7BD88F', score: 1 }], extra: { actor: 'a', balloon: 30, phase: 'challenge', pile: ['pt_mash'], remaining: ['pt_mash'], pot: 0, stolen: {}, deck: 8 } });
const build = (room, id) => { sb.party.room = room; sb.party.you = { id }; return vm.runInContext('withSeed(party.room.seed, () => partyBuildGame(party.room, party.room.sp))', sb); };
// All modes render both roles; helpers never acquire the actor's result.
for (const mode of ['cards', 'balloon', 'lantern']) {
  const handlers = {}, messages = [];
  sb.duoCtx = () => { const from = sb.party.you.id; return { send: (type, d) => messages.push({ from, type, d }), onMsg: fn => { handlers[from] = fn; } }; };
  const room = makeRoom(mode), actor = build(room, 'a'), helper = build(room, 'b');
  assert.equal(actor.partyHelper, false); assert.equal(helper.partyHelper, true);
  sb.party.you.id = 'a'; actor.draw(0);
  sb.party.you.id = 'b'; helper.draw(0); helper.move({ x: 400, y: 340 }); helper.update(.2, .2);
  if (mode === 'lantern') {
    assert.ok(messages.some(m => m.type === 'light'));
    messages.splice(0).forEach(m => handlers.a(m.type, m.d, m.from));
    for (let i = 0; i < 30; i++) actor.key({ code: 'Space', key: ' ', repeat: false });
    messages.splice(0).forEach(m => handlers.b(m.type, m.d, m.from));
    actor.update(.1, .1); helper.update(.1, .1);
    assert.ok(actor.pts >= actor.need); assert.equal(helper.result, undefined);
    sb.party.you.id = 'a'; actor.draw(.1); // multiple light cutouts and replayed inputs render without exceptions
  }
  for (let i = 0; i < 30; i++) actor.key({ code: 'Space', key: ' ', repeat: false });
  actor.update(.1, .1); assert.equal(actor.timeWin, true, 'mash can win at accelerated timeout');
}
const cards = makeRoom('cards'); cards.game = 'pc_draw'; cards.extra.phase = 'draw';
for (const id of ['a', 'b']) { const game = build(cards, id); game.draw(0); game.key({ code: 'KeyX' }); }
const versus = makeRoom('versus'), mash = build(versus, 'a');
for (let i = 0; i < 30; i++) mash.key({ code: 'Space', repeat: false });
mash.update(.1, .1); assert.equal(mash.timeWin, true);
console.log('party modes client: rendering, role isolation, light/input relay and accelerated verdicts OK');
