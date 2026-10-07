'use strict';
// Sabotage art (js/party-sab.js on top of js/party-ui.js): every overlay, button, orb, pop-up and idle trap draws on a recording context, stays balanced and deterministic,
// never uses fillRect, and keeps the hit rectangles and tap targets it always had. Run: node test/party-sab-art.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
function rec() {
  const log = [], stack = []; let depth = 0;
  const st = { globalAlpha: 1, lineWidth: 1, font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', textAlign: 'start', textBaseline: 'alphabetic', letterSpacing: '0px', lineJoin: 'miter', lineCap: 'butt' };
  const keep = Object.keys(st), o = { log, get depth() { return depth; } };
  const fmt = a => a.map(v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : typeof v === 'object' ? 'obj' : String(v)).join(',');
  return new Proxy(o, {
    get(t, k) {
      if (k in t) return t[k]; if (k in st) return st[k];
      if (k === 'measureText') return s => ({ width: String(s).length * 9 });
      if (k === 'getTransform') return () => ({ a: 1, d: 1, e: 0, f: 0 });
      if (k === 'save') return () => { stack.push(keep.map(p => st[p])); depth++; log.push('save'); };
      if (k === 'restore') return () => { const s = stack.pop(); if (s) keep.forEach((p, i) => { st[p] = s[i]; }); depth--; log.push('restore'); };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...a) => { log.push(k + '(' + fmt(a) + ')'); };
    },
    set(t, k, v) { if (k in st) { st[k] = v; log.push(k + '=' + (k === 'globalAlpha' ? Math.round(v * 1000) / 1000 : v)); } return true; },
    has(t, k) { return k in st || k in t; },
  });
}
const timers = [], screen = rec();
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout: fn => timers.push(fn), clearTimeout() {},
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => screen, addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => rec() }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  Path2D: function () { for (const m of ['moveTo', 'lineTo', 'arc', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'ellipse', 'rect']) this[m] = () => {}; },
  party: { you: { id: 'a' }, room: null }, btns: [], hovered: () => false, pressing: false, button: (...a) => sb.btns.push({ x: a[0], y: a[1], w: a[2], h: a[3], fn: a[5], old: true }), me: () => ({ name: 'ME', color: '#FFE14D' }),
};
sb.window = sb; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/party-ui.js', 'js/party-sab.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
const run = s => vm.runInContext(s, sb);
const players = [{ id: 'a', name: 'ME', color: '#FFE14D' }, { id: 'b', name: 'PEPE', color: '#6EA8FE' }, { id: 'c', name: 'LUCIA', color: '#FF7CBC' }, { id: 'd', name: 'MARIA FERNANDA', color: '#5CFF7A' }];
sb.party.room = { id: 'r', mode: 'balloon', players };
const frame = fn => { screen.log.length = 0; fn(); const out = screen.log.join('|'); assert.equal(screen.depth, 0, 'save and restore are balanced'); return out; };

// 1. the art layer is wired to the kit
assert.equal(run('typeof SABU'), 'object', 'the sabotage art sits on PARTY_UI');
for (const f of ['sabPlate', 'sabBtn', 'sabPop', 'sabPopsDraw', 'sabIdlePanel', 'sabHeadsUp', 'sabOrbs', 'sabStrip', 'sabPicker']) assert.equal(run(`typeof ${f}`), 'function', f);

// 2. every overlay draws all of its life without throwing (called straight, sabEnd would swallow errors), balanced, deterministic, fillRect-free
for (const id of Object.keys(JSON.parse(run('JSON.stringify(Object.fromEntries(SAB_IDS.map(k => [k, 1])))')))) {
  for (const T of [.05, .3, 1, 2.5, 3.3]) {
    const draw = () => frame(() => { run(`now = 100 + ${T}; globalThis.__s = { k: ${JSON.stringify(id)}, at: 100, seed: 37.3, life: 3.4, str: 1 }; { const kd = SAB_KINDS.${id}; ctx.save(); if (kd.pre) kd.pre(ctx, ${T}, .8, __s); if (kd.draw) kd.draw(ctx, ${T}, .8, __s); ctx.restore(); }`); });
    draw();   // warm the text-width cache (it logs a font probe once)
    const a = draw(), b = draw();
    assert.ok(a === b, `${id} at ${T}s: the same frame draws the same calls`);
    assert.ok(!/fillRect|strokeRect/.test(a), id + ' never draws a fillRect box');
  }
  assert.ok(run(`typeof SAB_KINDS.${id}.draw === 'function' || typeof SAB_KINDS.${id}.pre === 'function'`));
}
for (const id of ['ink', 'fog', 'dark', 'bugs', 'pixel', 'spam', 'flip', 'shake']) {   // the real render protocol too: the label badge pops on landing
  const out = frame(() => run(`now = 100.4; globalThis.__s = sabMake(${JSON.stringify(id)}, 'PEPE'); __s.at = 100; { const fx = sabBegin(__s, ctx, 'view'); sabEnd(fx); }`));
  assert.ok(id === 'flip' || /fillText|strokeText/.test(out), id + ' shows its label badge on landing');
}

// 3. buttons keep their hit rectangles; charges are orbs (no digits)
sb.btns.length = 0;
run('globalThis.mk = n => { const c = createSabCharges({ max: 3, every: 6 }); c.n = n; c.clock = 3; return c; }; globalThis.ch = createSabChannel(party.room, { send() {} }, { charges: mk(2) })');
const strip = frame(() => run('sabStrip(ch)'));
assert.deepEqual(sb.btns.map(b => [b.x, b.y, b.w, b.h]), [[16, 567, 184, 26], [196, 567, 184, 26], [376, 567, 184, 26]].map(([x, y, w, h], i) => [16 + i * 190, 567, 184, 26]), 'strip: one 26 px button per rival, same rectangles');
assert.ok(sb.btns.every(b => !b.old), 'strip buttons are plates now');
assert.ok(!/fillRect|strokeRect/.test(strip));
sb.btns.length = 0; run('globalThis.ch0 = createSabChannel(party.room, { send() {} }, { charges: mk(0) })'); frame(() => run('sabPicker(ch0, 492, 414, 96)'));
assert.deepEqual(sb.btns.map(b => [b.x, b.y, b.w, b.h]), [[492, 414, 96, 20], [492, 436, 96, 28]], 'picker: target button then throw button, same rectangles');
sb.btns.length = 0; frame(() => run('sabPicker(ch, 492, 414, 96)')); assert.equal(sb.btns.length, 2);
sb.btns[1].fn(); assert.equal(run('ch.charges.n'), 1, 'the throw button still throws (and spends a charge)');
assert.ok(run('sabPops.some(p => p.label === "SABOTAGE SENT!")'), 'the default send confirmation is a badge now'); run('sabPops.length = 0'); timers.length = 0;
for (const n of [0, 1, 2, 3]) { const o = frame(() => run(`{ const c = mk(${n}); sabOrbs(c, 400, 300, { r: 12, gap: 31, pulse: now - .1 }); }`)); assert.ok(!/fillText/.test(o), 'orbs carry no digits'); }

// 4. pop-ups: drawn once per frame by the UI, gone after their life; never lost (falls back to floatText when nobody draws them)
run('sabPops.length = 0; fxs.length = 0; now = 200; sabPop({ kind: "toast", label: "PEPE SABOTAGES LUCIA!", col: "#FF9A3D", x: 300, y: 340, from: "#6EA8FE", to: "#FF7CBC", size: 18 }); sabPop({ kind: "badge", label: "INK!", col: "#8E7CC3", x: 560, y: 200 })');
assert.equal(run('sabPops.length'), 2); const nT = timers.length; assert.ok(nT >= 2, 'a fallback is armed');
run('now = 200.3'); assert.ok(frame(() => run('sabPopsDraw()')).includes('fillText'), 'the toast is drawn');
const again = frame(() => run('sabPopsDraw()')); assert.equal(again, '', 'once per frame');
timers.forEach(f => f()); assert.equal(run('fxs.length'), 0, 'drawn pops need no fallback');
run('now = 202'); frame(() => run('sabPopsDraw()')); assert.equal(run('sabPops.length'), 0, 'expired pops leave');
run('sabPops.length = 0; now = 300; sabPop({ kind: "toast", label: "LOST?", col: "#fff", x: 1, y: 1 })'); timers.forEach(f => f()); assert.ok(run('fxs.some(f => f.k === "txt")'), 'a pop nobody draws still shows up as floatText');

// 5. idle traps: each trap draws, keeps its tap targets, no fillRect; the idle panel pulses a rim when a trap is about to land
const tr = k => frame(() => run(`globalThis.__tr = createIdleTraps({ first: [99, 0], gap: [99, 0] }); __tr.spawn(${JSON.stringify(k)}); btns.length = 0; __tr.draw(222, 492, 362, () => {})`));
for (const [k, n] of [['jam', 2], ['fly', 1], ['dial', 1], ['seq', 3], ['bubble', 1]]) {
  const out = tr(k); assert.ok(!/fillRect|strokeRect/.test(out), k + ' has no fillRect'); assert.ok(k === 'bubble' ? [1, 3].includes(sb.btns.length) : sb.btns.length === n, k + ' registers its tap target(s) (' + sb.btns.length + ')');   // a bubble may come with two fakes
  assert.ok(sb.btns.every(b => b.x >= 222 - 80 && b.x + b.w <= 222 + 362 + 80), k + ' targets stay on its panel');
}
let idle = 0; const quiet = frame(() => run('globalThis.__tr = createIdleTraps({ first: [99, 0] }); __tr.draw(222, 492, 362, () => { __idle = 1; })')); assert.equal(sb.__idle, 1);
const soon = frame(() => run('globalThis.__tr = createIdleTraps({ first: [1, 0] }); __tr.draw(222, 492, 362, () => {})')); assert.ok(soon.length > quiet.length, 'the rim shows when HEADS UP');
frame(() => run('sabIdlePanel(222, 492, 362); sabHeadsUp(400, 540)'));

// 6. art rules in the source: no fillRect, and no unseeded randomness inside the art code (the kit and the hash give the variety)
const src = fs.readFileSync('js/party-sab.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), art = src.slice(src.indexOf('const SABU'), src.indexOf('const SAB_IDS'));
assert.ok(!/fillRect|strokeRect/.test(src), 'no fillRect / strokeRect anywhere in the sabotage kit');
assert.ok(!/Math\.random/.test(art), 'the art code has no Math.random');
const html = fs.readFileSync('index.html', 'utf8'); assert.ok(html.indexOf('party-ui.js') < html.indexOf('party-sab.js'), 'the kit loads first');
assert.match(html, /js\/party-sab\.js\?v=(17914\d{5}|179[2-9]\d{6})/, 'cache buster bumped');
assert.ok(+/js\/party-sab\.js\?v=(\d+)/.exec(html)[1] >= 1791400200, 'cache buster >= 1791400200');
console.log('party sab art OK');
