'use strict';
// Shared party UI kit (js/party-ui.js): loads in a sandbox, every function smoke-draws on a recording context, stays balanced, deterministic and art-rule clean.
// Run: node test/party-ui.test.js
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const stub = () => new Proxy(function () {}, { get: (_, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), set: () => true });
const mkSb = touch => { const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout,
  addEventListener() {}, setInterval() {}, performance: { now: () => 0 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ getContext: () => stub() }), addEventListener() {}, body: stub() }, AudioContext: function () {}, Image: function () {},
  Path2D: function () { for (const m of ['moveTo', 'lineTo', 'arc', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'ellipse', 'rect']) this[m] = () => {}; },
  party: { you: { id: 'a' } }, btns: [], button() {},
};
sb.window = sb; sb.navigator.maxTouchPoints = touch ? 1 : 0; vm.createContext(sb);
for (const file of ['js/i18n.js', 'js/core.js', 'js/party-ui.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sb, { filename: file });
return sb; };
const sb = mkSb(false);
const run = s => vm.runInContext(s, sb);

// a recording 2D context with real property state, a save/restore stack and a call log
function rec() {
  const log = [], stack = []; let depth = 0, maxDepth = 0;
  const st = { globalAlpha: 1, lineWidth: 1, font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', textAlign: 'start', textBaseline: 'alphabetic', letterSpacing: '0px', lineJoin: 'miter', lineCap: 'butt' };
  const keep = ['globalAlpha', 'lineWidth', 'font', 'fillStyle', 'strokeStyle', 'textAlign', 'textBaseline', 'letterSpacing', 'lineJoin', 'lineCap'];
  const o = { log, st, get depth() { return depth; }, get maxDepth() { return maxDepth; } };
  const fmt = a => a.map(v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : typeof v === 'object' ? 'obj' : String(v)).join(',');
  return new Proxy(o, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in st) return st[k];
      if (k === 'measureText') return s => ({ width: String(s).length * 9 });
      if (k === 'save') return () => { stack.push(keep.map(p => st[p])); depth++; maxDepth = Math.max(maxDepth, depth); log.push('save'); };
      if (k === 'restore') return () => { const s = stack.pop(); if (s) keep.forEach((p, i) => { st[p] = s[i]; }); depth--; log.push('restore'); };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...a) => { log.push(k + '(' + fmt(a) + ')'); };
    },
    set(t, k, v) { if (k in st) { st[k] = v; if (k !== 'globalAlpha') log.push(k + '=' + v); else log.push('a=' + Math.round(v * 1000) / 1000); } return true; },
    has(t, k) { return k in st || k in t; },
  });
}
sb.rec = rec;

// 1. the kit loads and exposes the documented API
const API = ['target', 'clamp', 'ease', 'outBack', 'lerp', 'mix', 'shade', 'lite', 'hash', 'rng', 'rr', 'el', 'ink', 'inkP', 'cel', 'glint', 'P', 'shadow', 'text', 'pill', 'badge', 'keyCap', 'plate', 'plateLabel', 'orb', 'orbRow', 'dots', 'toast', 'avatar', 'eye'];
for (const k of API) assert.equal(run(`typeof PARTY_UI.${k}`), 'function', 'PARTY_UI.' + k + ' exists');
for (const k of ['green', 'red', 'yellow', 'live', 'blue', 'off']) assert.ok(run(`PARTY_UI.PLATE.${k}`).length === 2, 'plate preset ' + k);

// 2. maths helpers
assert.equal(run('PARTY_UI.ease(0)'), 0); assert.equal(run('PARTY_UI.ease(1)'), 1); assert.equal(run('PARTY_UI.ease(.5)'), .5);
assert.ok(Math.abs(run('PARTY_UI.outBack(0)')) < 1e-9); assert.equal(run('PARTY_UI.outBack(1)'), 1); assert.ok(run('PARTY_UI.outBack(.8)') > 1, 'outBack overshoots');
assert.equal(run('PARTY_UI.lerp(10, 20, .5)'), 15); assert.equal(run('PARTY_UI.clamp(5, 0, 3)'), 3);
assert.equal(run('PARTY_UI.mix("#000000", "#ffffff", .5)'), '#808080'); assert.equal(run('PARTY_UI.mix("#ff0000", "#ff0000", .3)'), '#ff0000');
assert.match(run('PARTY_UI.shade("#FFE14D")'), /^#[0-9a-f]{6}$/); assert.match(run('PARTY_UI.lite("#FFE14D")'), /^#[0-9a-f]{6}$/);
assert.equal(run('PARTY_UI.hash(7)'), run('PARTY_UI.hash(7)')); assert.notEqual(run('PARTY_UI.hash(7)'), run('PARTY_UI.hash(8)'));
assert.equal(run('(() => { const a = PARTY_UI.rng(5), b = PARTY_UI.rng(5); return a() === b() && a() === b(); })()'), true, 'rng is a seeded stream');
for (let i = 0; i < 50; i++) { const v = run(`PARTY_UI.hash(${i})`); assert.ok(v >= 0 && v < 1); }

// 3. every drawing function smoke-draws; save/restore stays balanced; the context state comes back; nothing is a fillRect box
const CALLS = [
  ['rr+ink', 'PARTY_UI.rr(10, 10, 80, 40, 12); PARTY_UI.ink("#fff", 3)'],
  ['el', 'PARTY_UI.el(10, 10, 20, 10, .3); PARTY_UI.ink("#fff", 3)'],
  ['inkP/cel/glint', 'const p = new Path2D(); PARTY_UI.cel(p, "#fff", "#ccc", 3, 4, 3); PARTY_UI.inkP(p, "#fff", 3); PARTY_UI.glint(p, 1, 2, 3, 4, "#fff", .1); PARTY_UI.P("M0 0L5 5")'],
  ['shadow', 'PARTY_UI.shadow(100, 100, 40, 10, .3)'],
  ['text light', 'PARTY_UI.text("HELLO", 100, 100, 28, "#fff", "center", 120)'],
  ['text ink', 'PARTY_UI.text("hello", 100, 100, 17, INK, "left")'],
  ['pill', 'PARTY_UI.pill(100, 100, "YOU", "#FFE14D"); PARTY_UI.pill(100, 100, "YOUR FRIEND", "#2b2540", true, 20)'],
  ['badge', 'PARTY_UI.badge("YUM!", 100, 100, 30, "#ff9f1c", "#FFE14D", 1, .05); PARTY_UI.badge("POP", 100, 100, 30, "#f00", "#fff", .4, 0); PARTY_UI.badge("GONE", 1, 1, 30, "#f00", "#fff", 0, 0)'],
  ['keyCap', 'PARTY_UI.keyCap(100, 100, "SPACE", { force: true }); PARTY_UI.keyCap(100, 100, "W", { force: true, down: true }); PARTY_UI.keyCap(100, 100, "W")'],
  ['plate', 'const b = [22, 446, 176, 96]; for (const c of ["green", "red", "yellow", "live", "blue"]) { PARTY_UI.plate(b, c, 0, false, true, false); PARTY_UI.plate(b, c, 0, true, false, false); } PARTY_UI.plate(b, "#4fd06a", "#24803a", false, true, true); PARTY_UI.plateLabel(b, 0, "HOLD", "SPACE"); PARTY_UI.plateLabel(b, 6, "FULL!", "W", { off: true, size: 24 })'],
  ['orb', 'for (const s of ["full", "empty", "pulse", "off"]) PARTY_UI.orb(100, 100, 24, { col: "#FFE14D", state: s, t: 1.3, seed: 2 }); PARTY_UI.orb(100, 100, 24, { k: .5 }); PARTY_UI.orb(1, 1, 24, { k: 0 })'],
  ['orbRow', 'PARTY_UI.orbRow(400, 100, 2, 3, 22, "#5CFF7A", 2.2, { pulse: true, at: [1, 2] }); PARTY_UI.orbRow(400, 100, 0, 3, 22, "#5CFF7A", 2.2)'],
  ['dots', 'PARTY_UI.dots(400, 100, 6, 3, { r: 8, col: "#FFE14D", t: 1.1, at: [0, 1, 1.05] }); PARTY_UI.dots(400, 100, 4, 0)'],
  ['toast', 'PARTY_UI.toast(400, 100, "PEPE SABOTEA A ANA", "#FFE14D", { k: 1, from: "#6EA8FE", to: "#FF7CBC", t: 1 }); PARTY_UI.toast(400, 100, "INK!"); PARTY_UI.toast(400, 100, "X", "#fff", { k: .3, a: .5 }); PARTY_UI.toast(400, 100, "X", "#fff", { k: 0 })'],
  ['avatar', 'for (const m of ["idle", "eager", "happy", "sad", "panic", "sleepy", "dizzy", "bonk", "smug"]) for (const g of [false, true]) PARTY_UI.avatar(100, 100, 24, "#6EA8FE", { mood: m, ghost: g, t: 2.7, seed: 3, look: [1, -1], bob: true }); PARTY_UI.avatar(100, 100, 24, "#fff"); PARTY_UI.avatar(1, 1, 24, "#fff", { k: 0 })'],
  ['eye', 'for (const m of ["idle", "happy", "panic", "bonk", "dizzy", "sleepy"]) { PARTY_UI.eye(10, 10, 6, m, [1, 0], 1, 0); PARTY_UI.eye(10, 10, 6, m, null, 1, 1); }'],
];
const KEYS = ['globalAlpha', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'letterSpacing', 'lineJoin', 'lineCap'];
for (const [name, code] of CALLS) {
  const c = rec(); sb.c = c;
  const prev = run('PARTY_UI.target(c)'); assert.ok(prev, 'target() hands back the previous context');
  const before = KEYS.map(k => c.st[k]);
  try { run(`(function () { ${code} })()`); } catch (e) { run('PARTY_UI.target(null)'); throw new Error(name + ' threw: ' + e.stack); }
  run('PARTY_UI.target(null)');
  assert.equal(c.depth, 0, name + ': save/restore balanced');
  assert.ok(c.log.length > 0, name + ' drew something');
  assert.ok(!c.log.some(l => l.startsWith('fillRect')), name + ': UI objects are rounded, never fillRect boxes');
  if (!/^(rr|el|inkP|shadow)/.test(name)) assert.deepEqual(KEYS.map(k => c.st[k]), before, name + ': context state restored');
}

// 4. target(): everything lands on the chosen context, and null goes back to the global one
{
  const a = rec(), g = rec(); sb.a = a; sb.g = g;
  run('PARTY_UI.target(a); PARTY_UI.pill(10, 10, "A", "#fff"); PARTY_UI.target(null)');
  assert.ok(a.log.length > 0, 'drew on the target');
  const n = a.log.length; run('PARTY_UI.pill(10, 10, "A", "#fff")'); assert.equal(a.log.length, n, 'target(null) stops drawing on it');
}

// 5. keyCap draws nothing on touch devices unless forced; plateLabel centres the label then
{
  const c = rec(); sb.c = c;
  run('PARTY_UI.target(c); PARTY_UI.keyCap(10, 10, "W", { force: true })'); const withKey = c.log.length; assert.ok(withKey > 0);
  const c2 = rec(); sb.c2 = c2; assert.equal(run('TOUCH'), false, 'sandbox is a desktop');
  run('PARTY_UI.target(c2); PARTY_UI.keyCap(10, 10, "W")'); assert.equal(c2.log.length, withKey, 'desktop: the cap is drawn');
  run('PARTY_UI.target(null)');
  const tsb = mkSb(true), trun = s => vm.runInContext(s, tsb); assert.equal(trun('TOUCH'), true, 'touch sandbox');
  const c3 = rec(), c4 = rec(), c5 = rec(); tsb.c3 = c3; tsb.c4 = c4; tsb.c5 = c5;
  trun('PARTY_UI.target(c3); PARTY_UI.keyCap(10, 10, "W"); PARTY_UI.target(null)'); assert.equal(c3.log.length, 0, 'touch: no key cap');
  trun('PARTY_UI.target(c4); PARTY_UI.keyCap(10, 10, "W", { force: true }); PARTY_UI.target(null)'); assert.ok(c4.log.length > 0, 'touch: force draws it');
  const b = '[22, 446, 176, 96]'; sb.c6 = rec(); const c6 = sb.c6;
  run(`PARTY_UI.target(c6); PARTY_UI.plateLabel(${b}, 0, "HOLD", "SPACE"); PARTY_UI.target(null)`);
  trun(`PARTY_UI.target(c5); PARTY_UI.plateLabel(${b}, 0, "HOLD", "SPACE"); PARTY_UI.target(null)`);
  assert.ok(c5.log.length > 0 && c5.log.length < c6.log.length, 'touch: plate label only, no cap under it');
}

// 6. a frame is deterministic: the same inputs draw the same calls, and the kit never uses Math.random or the game RNG
{
  const frame = () => { const c = rec(); sb.c = c; run(`PARTY_UI.target(c); (function () { ${CALLS.map(x => x[1]).join(';')} })(); PARTY_UI.target(null)`); return c.log.join('|'); };
  assert.equal(frame(), frame(), 'same call -> same pixels');
  const src = fs.readFileSync('js/party-ui.js', 'utf8');
  assert.ok(!/Math\.random|\bR\(|\brand\(|withSeed|fillRect/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'no Math.random, no game RNG, no fillRect in the kit');
}

// 7. index.html loads the kit before the party files that draw UI
{
  const html = fs.readFileSync('index.html', 'utf8'), at = f => html.indexOf('js/' + f + '.js');
  assert.ok(at('party-ui') > at('core') && at('party-ui') > 0, 'party-ui.js after core.js');
  for (const f of ['party-sab', 'party-react', 'party-modes', 'party-ghost', 'party-wait', 'party-guide']) assert.ok(at('party-ui') < at(f), 'party-ui.js before ' + f + '.js');
  assert.match(html, /js\/party-ui\.js\?v=\d{10}/, 'cache buster on the kit');
}
console.log('party-ui OK');
