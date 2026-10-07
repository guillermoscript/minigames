'use strict';
// The art of the table emotes, the emote tray and the guess decks (js/party-react.js on top of js/party-ui.js): every state draws on a recording context,
// save/restore stays balanced, nothing is a fillRect box and a frame is deterministic. Run: node test/party-react-art.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
function rec() {
  const log = []; let depth = 0, min = 0;
  const st = { globalAlpha: 1, lineWidth: 1, font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', textAlign: 'start', textBaseline: 'alphabetic', letterSpacing: '0px', lineJoin: 'miter', lineCap: 'butt' };
  const fmt = a => a.map(v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : typeof v === 'object' ? 'obj' : String(v)).join(',');
  return new Proxy({ log, get depth() { return depth; }, get min() { return min; }, reset() { log.length = 0; depth = 0; min = 0; } }, {
    get(t, k) {
      if (k in t) return t[k]; if (k in st) return st[k];
      if (k === 'measureText') return s => ({ width: String(s).length * 9 });
      if (k === 'save') return () => { depth++; log.push('save'); }; if (k === 'restore') return () => { depth--; min = Math.min(min, depth); log.push('restore'); };
      return (...a) => { log.push(k + '(' + fmt(a) + ')'); };
    },
    set(t, k, v) { if (k in st) { st[k] = v; log.push(k + '=' + v); } return true; }, has: (t, k) => k in st || k in t,
  });
}
const C = rec();
const mk = () => {
  const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout, addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
    location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => ({ getContext: () => C, addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub() }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
    Path2D: function () { for (const m of ['moveTo', 'lineTo', 'arc', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'ellipse', 'rect']) this[m] = () => {}; },
    party: { you: { id: 'a' } }, btns: [], buttons: [], button: (...a) => sb.buttons.push(a) };
  sb.window = sb; vm.createContext(sb);
  for (const file of ['js/i18n.js', 'js/core.js', 'js/party-ui.js', 'js/party-sab.js', 'js/party-react.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
  return sb;
};
const sb = mk(), run = s => vm.runInContext(s, sb);
const R = { id: 'r1', round: 0, mode: 'cards', players: [{ id: 'a', name: 'A', color: '#D97757' }, { id: 'b', name: 'B', color: '#6EA8FE' }, { id: 'c', name: 'C', color: '#7BD88F' }, { id: 'd', name: 'D', color: '#FF7CBC' }] };
sb.R = R; sb.relay = { send() {} };
run('now = 5; globalThis.rx = createReactions(R, relay, { origin: id => ({ x: 120 + R.players.findIndex(p => p.id === id) * 180, y: 516 }) }); globalThis.gs = createGuess(R, relay, {})');

// draws `fn` on the recording context that the sandbox's canvas hands out (core's ctx, which the kit targets by default)
const frame = fn => { C.reset(); fn(); return { log: [...C.log], depth: C.depth, min: C.min }; };
const lets = (c, what) => { assert.equal(c.depth, 0, what + ': save/restore balanced'); assert.ok(c.min >= 0, what + ': never restores more than it saved'); assert.ok(!c.log.some(l => l.startsWith('fillRect')), what + ': no fillRect boxes'); assert.ok(c.log.length > 10, what + ': draws something'); };

// the stickers: every kind, plain and with the die-cut halo, at the sizes the game uses
for (const k of ['heart', 'star', 'laugh', 'wow', 'fire']) for (const o of ['{}', '{ halo: true, rot: .2, t: 3.3 }', '{ sx: 1.1, sy: .9, t: 1 }']) lets(frame(() => run(`reactDraw('${k}', 100, 100, ${o === '{}' ? '.55' : '1.2'}, ${o})`)), 'sticker ' + k + o);

// the tray: idle, hovered, pressed, mid-pop and on a streak
for (const [name, setup] of [['idle', ''], ['hover', 'hp = { x: 330, y: 450 }'], ['press', 'hp = { x: 330, y: 450 }; pressing = true'], ['pop', 'rx.pops.heart = now - .1'], ['streak', 'rx.last = now - .2; rx.streak = 6']]) {
  run('globalThis.hp = { x: -9, y: -9 }; globalThis.pressing = false; globalThis.hovered = (x, y, w, h) => hp.x >= x && hp.x <= x + w && hp.y >= y && hp.y <= y + h; ' + setup); sb.buttons.length = 0;
  const c = frame(() => run('rx.bar(244, 432, 312, 36)')); lets(c, 'tray ' + name); assert.equal(sb.buttons.length, 5, 'tray ' + name + ': one hit region per emote');
}
assert.ok(sb.buttons.every(b => b[2] > 40 && b[3] === 36), 'the hit regions keep the same size');

// floaters: a new throw, a mid-flight one, one about to fade; plus a sender who left the table
run('rx.items.length = 0; for (const [k, id, age] of [["heart","a",.05],["star","b",.3],["laugh","c",.7],["wow","ghost",1.1],["fire","d",1.6]]) rx.items.push({ k, id, at: now - age, seed: 2.5 })');
lets(frame(() => run('rx.draw()')), 'floaters'); assert.equal(run('rx.items.length'), 5);
const a = frame(() => run('rx.draw()')), b = frame(() => run('rx.draw()')); assert.deepEqual(a.log, b.log, 'the same frame draws the same calls');

// the guess decks: empty, with hopping bets (more than a row), and lit
for (const [name, o] of [['empty', '{}'], ['bets', '{ bets: ["a", "b", "c"], t: 2 }'], ['crowd', '{ bets: ["a", "b", "c", "d", "a", "b"], t: 1 }'], ['lit', '{ lit: true, bets: ["d"], t: 3 }']]) lets(frame(() => run(`gs.drawDeck(180, 268, 'left', ${o})`)), 'deck ' + name);

// the source rules: no Math.random, no fillRect, no seeded RNG
const src = fs.readFileSync('js/party-react.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.ok(!/Math\.random|fillRect|\bR\(\)/.test(src), 'cosmetic art uses no Math.random, fillRect or game RNG');
console.log('party react art: stickers, tray, floaters and decks draw cleanly OK');
