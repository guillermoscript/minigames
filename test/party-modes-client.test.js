'use strict';
// Exercises the real wrappers with a delayed in-memory input relay and canvas stubs.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub(), toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==' }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () { Object.defineProperty(this, 'src', { set: () => this.onload && this.onload() }); },
  modeLabel: m => m.toUpperCase(), pressing: false, party: { you: { id: 'a' } }, pendingMoves: [], button() {}, pcall: async () => ({ ok: false, status: 409 }), auth: () => ({}), applyRoom() {}, roomGone() {}, partyErr: () => '', say() {}, me: () => ({ color: '#fff' }),
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
  assert.equal(actor.partyScene, true); assert.equal(helper.partyScene, true);
  const snapshot = messages.find(m => m.type === 'frame');
  assert.ok(snapshot, mode + ': actor broadcasts the actual rendered scene');
  handlers.b(snapshot.type, snapshot.d, snapshot.from);
  assert.equal(helper.pts, undefined, 'helpers never run their own divergent simulation');
  sb.party.you.id = 'b'; helper.draw(0); helper.move({ x: 400, y: 340 }); helper.update(.2, .2);
  if (mode === 'lantern') {
    assert.ok(messages.some(m => m.type === 'light'));
    messages.splice(0).forEach(m => handlers.a(m.type, m.d, m.from));
    for (let i = 0; i < 30; i++) actor.key({ code: 'Space', key: ' ', repeat: false });
    messages.splice(0).forEach(m => handlers.b(m.type, m.d, m.from));
    actor.update(.1, .1); helper.update(.1, .1);
    assert.ok(actor.pts >= actor.need); assert.equal(helper.result, undefined);
    sb.party.you.id = 'a'; actor.draw(.1); // multiple light cutouts render without exceptions
  }
  for (let i = 0; i < 30; i++) actor.key({ code: 'Space', key: ' ', repeat: false });
  actor.update(.1, .1); assert.equal(actor.timeWin, true, 'mash can win at accelerated timeout');
}
// Pointer input and global mouse readers use original 800×600 game coordinates inside the framed television.
vm.runInContext(`REGMAP.scene_pointer = { fn: () => ({ dur: 5, cmd: 'TEST', update() { globalThis.scenePointer = { x: mouse.x, y: mouse.y, held: pressing }; }, draw() {} }) };`, sb);
const pointerRoom = makeRoom('cards'); pointerRoom.game = 'scene_pointer';
const pointerGame = build(pointerRoom, 'a');
pointerGame.down({ x: 304, y: 340 }); pointerGame.update(.1, .1);
assert.deepEqual({ x: sb.scenePointer.x, y: sb.scenePointer.y }, { x: 400, y: 300 });
assert.equal(sb.scenePointer.held, true);
pointerGame.up({ x: 799, y: 599 }); pointerGame.update(.1, .2);
assert.equal(sb.scenePointer.held, false); assert.equal(sb.scenePointer.x, 800);
vm.runInContext(`REGMAP.scene_pointer.fn = () => { throw new Error('Helpers must not construct the actor game'); };`, sb);
assert.equal(build(pointerRoom, 'b').partyHelper, true);
const cards = makeRoom('cards'); cards.game = 'pc_draw'; cards.extra.phase = 'draw';
for (const id of ['a', 'b']) { const game = build(cards, id); game.draw(0); game.key({ code: 'KeyX' }); }
const versus = makeRoom('versus'), mash = build(versus, 'a');
for (let i = 0; i < 30; i++) mash.key({ code: 'Space', repeat: false });
mash.update(.1, .1); assert.equal(mash.timeWin, true);
// Passive spectator capture leaves every competitive game and DUO input channel untouched.
const passiveFrames = []; sb.partySendFrame = data => passiveFrames.push(data);
vm.runInContext(`REGMAP.scene_passive = { fn: (sp, dc) => {
  const game = { dur: 8, wide: true, result: 'win', cmd: 'WATCH', hint: 'AIM', update() {}, key() {}, draw(t, extra) { if (this !== game) throw new Error('draw lost receiver'); globalThis.passiveDraw = { t, extra }; return 17; } };
  if (dc) dc.onMsg(() => {});
  return game;
} };`, sb);
for (const mode of ['versus', 'team', 'survival', 'knockout', 'duo']) {
  const room = makeRoom(mode); room.game = 'scene_passive'; room.sp = 4;
  let handlerCount = 0;
  sb.passiveDC = { onMsg: () => handlerCount++, send() {} };
  sb.party.room = room; sb.party.you.id = 'a';
  sb.duoCtx = () => { throw new Error('Passive capture must not reset the DUO relay'); };
  const game = vm.runInContext('partyBuildGame(party.room, party.room.sp, passiveDC)', sb);
  assert.equal(handlerCount, 1); assert.equal(game.wide, true); assert.equal(game.dur, 8); assert.equal(game.result, 'win');
  const originalKey = game.key, originalUpdate = game.update;
  vm.runInContext('now += 1', sb);
  const before = passiveFrames.length;
  assert.equal(game.draw(1.25, 'argument'), 17);
  assert.equal(sb.passiveDraw.extra, 'argument');
  assert.equal(passiveFrames.length, before + 1); assert.equal(passiveFrames.at(-1).time, 2.75);
  assert.ok(passiveFrames.at(-1).image.startsWith('data:image/jpeg;base64,'));
  game.draw(1.3); assert.equal(passiveFrames.length, before + 1, 'snapshot cadence is bounded');
  assert.equal(game.key, originalKey); assert.equal(game.update, originalUpdate);
}
const originalCreate = sb.document.createElement;
sb.document.createElement = () => { throw new Error('canvas unavailable'); };
const failingRoom = makeRoom('versus'); failingRoom.game = 'scene_passive';
const safeGame = build(failingRoom, 'a'); vm.runInContext('now += 1', sb);
assert.equal(safeGame.draw(1), 17, 'capture failures never stop the game');
sb.document.createElement = originalCreate;
console.log('party modes client: rendering, role isolation, shared scenes, visual snapshots, light relay and accelerated verdicts OK');
