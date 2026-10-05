'use strict';
// Actual app registrations, conservative duration limits and shuffled turn-mode catalog.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { catalog, render } = require('../scripts/party-catalog.js');
const P = require('../pocketbase/pb_hooks/party.js');
const root = path.resolve(__dirname, '..');
assert.equal(fs.readFileSync(path.join(root, 'pocketbase/pb_hooks/party_catalog.js'), 'utf8'), render());
const generated = catalog();
assert.equal(Object.keys(generated).length, 156);
assert.deepEqual(P.TURN_IDS, Object.keys(generated));
assert.ok(P.TURN_IDS.includes('td_crane') && P.TURN_IDS.includes('ap_arepa'));
assert.ok(P.TURN_IDS.every(id => !id.startsWith('du_') && !id.startsWith('boss')));
// Construct the real 2D games at multiple speeds. No handlers or rendering are mocked into the games.
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {}, performance: { now: () => 0 }, location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} }, document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
sb.window = sb; vm.createContext(sb);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = ['js/i18n.js', 'js/core.js', ...[...html.matchAll(/<script src="(js\/(?:games|art)\/[^"?]+)(?:\?[^" ]*)?"/g)].map(m => m[1]).filter(f => !/\/td\d|\/td_core|\/du1|\/duo\/|\/squad\/|microgame-gags/.test(f))];
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
vm.runInContext('globalThis.games = REGMAP;', sb);
let constructed = 0;
for (const id of P.TURN_IDS.filter(id => !id.startsWith('td_'))) {
  for (const sp of [1, 1.5, 1.84, 2.5]) {
    const g = sb.games[id].fn(sp);
    assert.ok(g.dur > 0 && g.dur <= generated[id].dur, `${id}: runtime duration ${g.dur} exceeds server bound`);
    assert.equal(typeof g.update, 'function', id);
    assert.equal(typeof g.draw, 'function', id);
    constructed++;
  }
}
// 3D metadata stays conservative even on devices that use the shorter WebGL fallback.
for (const id of P.TURN_IDS.filter(id => id.startsWith('td_'))) assert.ok(generated[id].dur >= 6 && generated[id].dur <= 9);
let seed = 47;
const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const make = mode => { const r = P.newRoom('TEST', mode, 0); for (const name of ['A', 'B']) P.addPlayer(r, { name }, rand); P.start(r, 'a', 1000, rand); return r; };
for (const mode of ['lantern', 'balloon']) {
  const room = make(mode), seen = [room.game];
  for (let i = 1; i < P.TURN_IDS.length * 3; i++) { room.game = P.takeTurnGame(room, rand); assert.notEqual(room.game, seen.at(-1)); seen.push(room.game); }
  for (let i = 0; i < 3; i++) assert.equal(new Set(seen.slice(i * 156, (i + 1) * 156)).size, 156);
  assert.ok(!('keys' in P.publicRoom(room)));
}
for (const mode of ['versus', 'team', 'survival', 'knockout']) {
  const room = make(mode), seen = [room.game];
  for (let i = 1; i < P.GAME_IDS.length * 3; i++) { room.game = P.takeRoomGame(room, rand, P.GAME_IDS); assert.notEqual(room.game, seen.at(-1)); seen.push(room.game); }
  for (let i = 0; i < 3; i++) assert.equal(new Set(seen.slice(i * P.GAME_IDS.length, (i + 1) * P.GAME_IDS.length)).size, P.GAME_IDS.length);
}
for (let i = 0; i < 10; i++) {
  const room = make('cards'), games = room.keys._deck.filter(id => id !== 'play');
  assert.equal(room.keys._deck.length, 24); assert.equal(games.length, 16); assert.equal(new Set(games).size, 16);
  assert.ok(games.every(id => P.TURN_IDS.includes(id)));
}
assert.deepEqual(P.GAME_IDS, ['pt_mash', 'pt_sync', 'pt_memo', 'pt_grab']);
for (const mode of ['versus', 'team', 'survival', 'knockout']) assert.ok(P.GAME_IDS.includes(make(mode).game));
assert.ok(P.DUO_IDS.includes(make('duo').game));
console.log(`Catalog tests passed: 156 games, ${constructed} real 2D constructions, 3 complete shuffle cycles, unique card decks, original pools preserved.`);
