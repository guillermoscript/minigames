'use strict';
// Exercises the real wrappers with a delayed in-memory input relay and canvas stubs.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub(), toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==' }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () { Object.defineProperty(this, 'src', { set: () => this.onload && this.onload() }); },
  modeLabel: m => m.toUpperCase(), pressing: false, party: { you: { id: 'a' } }, pendingMoves: [], btns: [], button() {}, pcall: async () => ({ ok: false, status: 409 }), auth: () => ({}), applyRoom() {}, roomGone() {}, partyErr: () => '', say() {}, me: () => ({ color: '#fff' }),
};
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/games/pt1.js', 'js/party-sab.js', 'js/party-react.js', 'js/party-modes.js', 'js/party-ghost.js', 'js/party-wait.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const makeRoom = mode => ({ mode, round: 0, state: 'round', seed: 79, sp: 1.49, game: 'pt_mash', players: [{ id: 'a', name: 'A', color: '#D97757', score: 3 }, { id: 'b', name: 'B', color: '#6EA8FE', score: 2 }, { id: 'c', name: 'C', color: '#7BD88F', score: 1 }], extra: { actor: 'a', balloon: 30, phase: 'challenge', pile: ['pt_mash'], remaining: ['pt_mash'], pot: 0, stolen: {}, deck: 8 } });
const build = (room, id) => { sb.party.room = room; sb.party.you = { id }; return vm.runInContext('withSeed(party.room.seed, () => partyBuildGame(party.room, party.room.sp))', sb); };
// All modes render both roles; helpers never acquire the actor's result.
for (const mode of ['cards', 'balloon', 'lantern']) {
  const handlers = {}, messages = [];
  sb.duoCtx = () => { const from = sb.party.you.id; return { send: (type, d) => messages.push({ from, type, d }), onMsg: fn => { handlers[from] = (type, data, id) => fn(type, data, 7, id); } }; };   // like the real duoCtx: (type, data, senderRole, senderId), the role is a seat number and never an id
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
// FLIP mirrors the actor's pointer and arrow keys while the picture is turned around, and nothing else; every other kind leaves input alone.
vm.runInContext(`REGMAP.scene_flip = { fn: () => ({ dur: 5, cmd: 'TEST', update() { globalThis.flipSeen = { x: mouse.x }; }, key(e) { globalThis.flipKey = e.code + '/' + e.key; }, keyup(e) { globalThis.flipUp = e.code; }, draw() {} }) };`, sb);
const sabHandlers = {};
sb.duoCtx = () => { const from = sb.party.you.id; return { send() {}, onMsg: fn => { sabHandlers[from] = (type, data, id) => fn(type, data, 7, id); } }; };
const sabRoom = makeRoom('balloon'); sabRoom.game = 'scene_flip';
const sabActor = build(sabRoom, 'a');
const sabTurn = kind => { sabHandlers.a('sab', { k: kind, to: 'a' }, 'b'); vm.runInContext('now += 1', sb); };
sabActor.draw(0); sabActor.down({ x: 160, y: 340 }); sabActor.update(.1, .1); assert.equal(Math.round(sb.flipSeen.x), 200, 'unsabotaged pointer is untouched');
sabActor.key({ code: 'ArrowLeft', key: 'ArrowLeft' }); assert.equal(sb.flipKey, 'ArrowLeft/ArrowLeft');
sabTurn('shake'); sabActor.draw(.1); sabActor.down({ x: 160, y: 340 }); sabActor.update(.1, .2); assert.equal(Math.round(sb.flipSeen.x), 200, 'shake never touches input');
vm.runInContext('now += 9', sb);
sabTurn('flip'); sabActor.draw(.1); sabActor.down({ x: 160, y: 340 }); sabActor.update(.1, .3); assert.equal(Math.round(sb.flipSeen.x), 600, 'flip mirrors the pointer');
sabActor.key({ code: 'ArrowLeft', key: 'ArrowLeft' }); assert.equal(sb.flipKey, 'ArrowRight/ArrowRight', 'flip swaps left and right');
sabActor.key({ code: 'Space', key: ' ' }); assert.equal(sb.flipKey, 'Space/ ');
vm.runInContext('now += 9', sb);
sabActor.keyup({ code: 'ArrowLeft' }); assert.equal(sb.flipUp, 'ArrowRight', 'a key released after the flip ended is released as the key that was pressed');
sabActor.down({ x: 160, y: 340 }); sabActor.update(.1, .4); assert.equal(Math.round(sb.flipSeen.x), 200, 'input is back to normal after the flip');
// a helper takes every kind on its screen without breaking the frame and sends a throw only with a charge
const sabHelper = build(sabRoom, 'b'); sb.party.you.id = 'b';
for (const kind of ['ink', 'fog', 'dark', 'bugs', 'shake', 'flip', 'pixel', 'spam']) { sabHandlers.b('sab', { k: kind, to: 'b' }, 'c'); vm.runInContext('now += .6', sb); sabHelper.draw(.1); vm.runInContext('now += 9', sb); sabHelper.draw(.1); }
sb.party.you.id = 'a';
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

// Stealing completes only after the server deadline, once despite repeated updates.
sb.duoCtx = () => ({ send() {}, onMsg() {} });
const timedCards = makeRoom('cards');
const timedHelper = build(timedCards, 'b');
const moves = [];
vm.runInContext('partyMoveAction = (action, data, round) => { pendingMoves.push({ action, data, round }); return new Promise(() => {}); };', sb);
timedCards.extra.stealing = { b: { round: 0, target: 'a', readyAt: Date.now() + 10000 } };
timedHelper.update(.1, .1); assert.equal(sb.pendingMoves.length, 0);
timedCards.extra.stealing.b.readyAt = Date.now() - 1;
timedHelper.update(.1, .2); timedHelper.update(.1, .3);
assert.equal(sb.pendingMoves.length, 1); assert.equal(sb.pendingMoves[0].action, 'steal');
assert.equal(sb.pendingMoves[0].data.target, 'a');

// CARDS watchers: big STEAL buttons, one sabotage button per rival, charges that survive from round to round, guesses and emotes that earn them.
{
  const log = [], sent = [], handlers = {};
  sb.button = (...a) => log.push(a);
  sb.duoCtx = () => { const from = sb.party.you.id; return { send: (type, d, latest) => sent.push({ from, type, d, latest }), onMsg: fn => { handlers[from] = (type, data, id) => fn(type, data, 7, id); } }; };
  sb.pendingMoves.length = 0; sb.party.cards = null; sb.party.stealBusy = null;
  const room = makeRoom('cards'); room.id = 'room-cards'; room.extra.stolen = {};
  // a sabotage goes straight to the server (sabSendDirect), not through the relay queue: record it like the relay sends, and let the test refuse one
  const directReply = { ok: true, status: 200 }, realPcall = sb.pcall, realParty = sb.party.room;
  sb.party.room = room; sb.sigStamp = m => m;
  sb.pcall = async (action, body) => { if (action === 'sig') body.m.forEach(m => sent.push({ from: sb.party.you.id, type: m.t, d: m.d })); return directReply; };
  const watcher = build(room, 'b'); sb.party.you.id = 'b';
  watcher.draw(0);
  const steals = log.filter(b => b[0] === 608), sabs = log.filter(b => b[0] === 492);
  assert.equal(steals.length, 2, 'one big STEAL button for every rival that holds cards');
  assert.ok(steals.every(b => b[3] >= 86), 'the STEAL buttons are big');
  assert.equal(sabs.length, 2, 'one sabotage button per rival, the player at the table included');
  steals[0][5](); assert.equal(sb.pendingMoves.at(-1).action, 'steal'); assert.equal(sb.pendingMoves.at(-1).data.target, 'a');
  room.players[2].score = 0; log.length = 0; watcher.draw(0.1);
  assert.equal(log.filter(b => b[0] === 608).length, 1, 'rivals without cards cannot be stolen from');
  // sabotage needs a charge, goes to whoever was tapped and is a normal sab message the server accepts
  log.filter(b => b[0] === 492)[0][5](); assert.equal(sent.filter(m => m.type === 'sab').length, 0, 'no charge, no sabotage');
  sb.party.cards.charges.n = 2; sb.party.cards.charges.cd = 0;
  log.length = 0; watcher.draw(.2); log.filter(b => b[0] === 492)[1][5]();
  const hit = sent.find(m => m.type === 'sab'); assert.ok(hit && hit.d.to === 'c' && hit.from === 'b', 'tapping a rival throws the sabotage at them');
  assert.equal(sb.party.cards.charges.n, 1);
  // the charges belong to the room, not to the round: the next game starts with what was earned
  const again = build(Object.assign({}, room, { round: 1 }), 'b'); assert.equal(sb.party.cards.charges.n, 1, 'charges carry over to the next round');
  sb.party.cards.charges.cd = 0; again.key({ code: 'KeyE', key: 'e', repeat: false }); assert.equal(sent.filter(m => m.type === 'sab').length, 2, 'E throws at the current target');
  assert.equal(sb.party.cards.charges.n, 0);
  // a trap takes the keys before E does, and the helper's frame is drawn from the actor's snapshot (the sender id is the 4th argument of onMsg, never the seat number)
  const shown = build(Object.assign({}, room, { round: 2 }), 'b'); handlers.b('frame', { image: 'data:image/jpeg;base64,ZmFrZQ==', cmd: 'GO', time: 5, duration: 9 }, 'a');
  shown.draw(0); assert.equal(sb.party.cards.charges.n, 0);

  // a deck pick: bet on a side, settle it when the next round shows which deck was picked
  const draw = makeRoom('cards'); draw.id = 'room-cards'; draw.game = 'pc_draw'; draw.round = 5; draw.extra.phase = 'draw'; draw.extra.pile = []; draw.extra.pot = 0;
  sb.party.cards = null; sent.length = 0;
  const guesser = build(draw, 'b'); sb.party.you.id = 'b'; guesser.draw(0);
  guesser.key({ code: 'ArrowLeft', repeat: false });
  assert.equal(JSON.stringify(sent.at(-1).d), '{"s":"left"}'); assert.equal(sent.at(-1).type, 'guess'); assert.equal(sb.party.cards.bet.side, 'left');
  handlers.b('guess', { s: 'right' }, 'c'); guesser.draw(.1);   // somebody else's bet shows up on the table
  const was = sb.party.cards.charges.n;
  build(Object.assign({}, draw, { round: 6, extra: Object.assign({}, draw.extra, { actor: 'b', side: 'left' }) }), 'b');
  assert.equal(sb.party.cards.charges.n, was + 1, 'a right guess pays a charge'); assert.equal(sb.party.cards.bet, null);
  const g2 = build(Object.assign({}, draw, { round: 7, extra: Object.assign({}, draw.extra, { actor: 'a' }) }), 'b'); g2.key({ code: 'ArrowRight', repeat: false });
  const wrong = sb.party.cards.charges.n; build(Object.assign({}, draw, { round: 8, extra: Object.assign({}, draw.extra, { actor: 'c', side: 'left' }) }), 'b');
  assert.equal(sb.party.cards.charges.n, wrong, 'a wrong guess pays nothing');
  const g3 = build(Object.assign({}, draw, { round: 9 }), 'b'); g3.key({ code: 'ArrowLeft', repeat: false });
  build(Object.assign({}, draw, { round: 12, extra: Object.assign({}, draw.extra, { side: 'left' }) }), 'b'); assert.equal(sb.party.cards.charges.n, wrong, 'a bet from a long gone round is never paid');
  // emotes: a run of quick taps pays a charge too (keys 1-5), and the player at the table has no bar
  const tapper = build(Object.assign({}, draw, { round: 20 }), 'b'); const n0 = sb.party.cards.charges.n; sb.party.cards.charges.n = 0;
  for (let i = 0; i < 10; i++) { vm.runInContext('now += .1', sb); tapper.key({ code: 'Digit' + (1 + i % 5), repeat: false }); }
  assert.equal(sent.filter(m => m.type === 'react').length, 10); assert.equal(sb.party.cards.charges.n, 1, 'ten quick emotes charge a sabotage');
  sb.party.cards.charges.n = 3; for (let i = 0; i < 10; i++) { vm.runInContext('now += .1', sb); tapper.key({ code: 'Digit1', repeat: false }); } assert.equal(sb.party.cards.charges.n, 3, 'a full kit stays full');
  sent.length = 0; sb.party.you.id = 'a'; const picker = build(Object.assign({}, draw, { round: 21 }), 'a'); picker.key({ code: 'Digit2', repeat: false }); assert.equal(sent.length, 0, 'the player drawing has no emotes');
  // a refused throw (rate limit) gives the charge back; a connection that died does not
  sb.party.cards.charges.n = 1; sb.party.cards.charges.cd = 0; sb.party.you.id = 'b'; Object.assign(directReply, { ok: false, status: 429 });
  const retry = build(Object.assign({}, room, { round: 30 }), 'b'); retry.key({ code: 'KeyE', key: 'e', repeat: false });
  assert.equal(sb.party.cards.charges.n, 0); setTimeout(() => assert.equal(sb.party.cards.charges.n, 1, 'a throw the server refused is refunded'), 0);
  sb.pcall = realPcall; sb.party.room = realParty;
  sb.button = () => {};
  console.log('party modes client: CARDS watchers (steal buttons, sabotage, carried charges, guesses, emotes) OK');
}
