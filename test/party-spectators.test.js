'use strict';
// Delayed image decoding exercises the real spectator cache, never a second game simulation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const images = [];
class DelayedImage {
  constructor() { images.push(this); }
  set src(value) { this.url = value; }
  complete() { if (this.onload) this.onload(); }
}
const sb = {
  console, Image: DelayedImage, URLSearchParams, Math, Date, JSON, Promise,
  partyTurnMode: R => ['lantern', 'cards', 'balloon'].includes(R.mode),
  now: 20, document: { getElementById: () => null },
  location: { search: '' }, navigator: {},
  matchMedia: () => ({ matches: false }), addEventListener() {},
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync('js/party.js', 'utf8'), sb, { filename: 'js/party.js' });
const run = code => vm.runInContext(code, sb);
run(`party.you = { id: 'a', key: 'secret' }; party.room = {
  id: 'room-one', code: 'ABCD', mode: 'versus', state: 'round', round: 3,
  players: [{ id: 'a', name: 'A', lives: 3 }, { id: 'b', name: 'B', lives: 3 }, { id: 'c', name: 'C', lives: 3, left: true }], cur: {},
};`);
const frame = { image: 'data:image/jpeg;base64,/9j/ZmFrZQ==', cmd: 'MASH!', hint: 'PRESS SPACE', elapsed: 1 };
sb.testFrame = frame;
function receive(from, round = 3, data = frame) {
  sb.testFrame = data;
  run(`partyReceiveFrame(${JSON.stringify(from)}, testFrame, ${round})`);
}
// Bad identities and formats must not even allocate an image decoder.
for (const from of ['a', 'c', 'unknown']) receive(from);
receive('b', 2);
receive('b', 4);
receive('b', 3, null);
receive('b', 3, { ...frame, cmd: 'A'.repeat(121) });
receive('b', 3, { ...frame, image: 'javascript:alert(1)' });
receive('b', 3, { ...frame, image: 'data:image/jpeg;base64,' + 'A'.repeat(60001) });
assert.equal(images.length, 0, 'reject self, absent/left seats, wrong rounds and invalid frames');
receive('b');
assert.equal(images.length, 1);
images[0].complete();
assert.ok(run('party.watch.frames.b'), 'valid remote snapshot becomes visible');
// Decode can finish after the server advanced; it cannot revive the previous round.
receive('b');
const late = images.at(-1);
run('party.room.round = 4; party.watch = { round: 4, frames: {} };');
late.complete();
assert.equal(run('Object.keys(party.watch.frames).length'), 0, 'old decode cannot populate a new round');
// Out-of-order decoders must retain the newest incoming image.
receive('b', 4, { ...frame, cmd: 'FIRST' });
const first = images.at(-1);
receive('b', 4, { ...frame, cmd: 'SECOND' });
const second = images.at(-1);
second.complete();
first.complete();
assert.equal(run('party.watch.frames.b.cmd'), 'SECOND', 'late older decode cannot replace the latest snapshot');
// Switching rooms with the same round number cannot finish an old image decode.
receive('b', 4);
const otherRoom = images.at(-1);
run("party.room.id = 'room-two';");
otherRoom.complete();
assert.notEqual(run('party.watch.frames.b.image'), otherRoom);
run("party.room.id = 'room-one'; party.room.mode = 'knockout'; party.room.players[1].lives = 0;");
const decodersBeforeEliminated = images.length;
receive('b', 4);
assert.equal(images.length, decodersBeforeEliminated, 'eliminated players cannot supply a live view');
run("party.room.mode = 'versus'; party.room.players[1].lives = 3;");
// Leaving the room while decoding has the same invalidation semantics.
receive('b', 4);
const leaving = images.at(-1);
run('party.room = null;');
leaving.complete();
// Producers on slow connections replace their queued snapshot instead of accumulating JPEGs.
run(`party.room = { id: 'room-one', mode: 'versus', state: 'round', round: 5, players: [{id:'a'}, {id:'b'}] }; party.sig.q = []; party.sig.round = -1;`);
for (let i = 0; i < 100; i++) { sb.testFrame = { ...frame, cmd: 'FRAME ' + i }; run('partySendFrame(testFrame)'); }
assert.equal(run("party.sig.q.filter(x => x.t === 'frame').length"), 1, 'only latest frame is queued');
assert.equal(run("party.sig.q.find(x => x.t === 'frame').d.cmd"), 'FRAME 99');
assert.equal(run('party.sig.round'), 5);
// Existing DUO input handler survives spectator production.
run("party.room.mode = 'duo'; party.sig.handler = function inputHandler() {}; globalThis.beforeHandler = party.sig.handler;");
run('partySendFrame(testFrame)');
assert.equal(run('party.sig.handler === beforeHandler'), true);
run("party.room.state = 'between'; party.sig.q = [];");
run('partySendFrame(testFrame)');
assert.equal(run('party.sig.q.length'), 0, 'completed rounds stop publishing');
console.log('party spectators: validation, delayed decode, latest-frame queue and input-handler isolation OK');
