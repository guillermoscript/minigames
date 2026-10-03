'use strict';
/* i18n sanity: node test/i18n.test.js
   1. every translation dictionary parses, keeps {placeholders} intact and has no cross-file conflicts
   2. every user-visible string of every registered game (name, cmd, hint, thint) and stage has a translation in each language
   Games are built against a permissive stub of the canvas/DOM, so only construction-time strings are covered here;
   strings drawn at runtime are caught with ?i18n-debug in the browser (see js/i18n.js). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/vendor|analytics|api\.js|share\.js|party\.js|main\.js/.test(s));

const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
const sandbox = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {}, performance: { now: () => 0 },
  location: { search: '' }, navigator: { languages: ['en'], language: 'en' }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() },
  THREE: stub(), AudioContext: function () {}, Image: function () {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
sandbox.window = sandbox; vm.createContext(sandbox);
let bad = 0; const fail = m => { bad++; console.log('✗ ' + m); };

for (const src of scripts) {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  try {
    if (/^js\/i18n\//.test(src)) vm.runInContext('I18N.__cur = ' + JSON.stringify(src), sandbox);
    vm.runInContext(code, sandbox, { filename: src });
    if (/i18n\.js$/.test(src)) vm.runInContext('globalThis.__files = []; { const add = I18N.add; I18N.add = (c, d, sc) => { __files.push({ lang: c, file: I18N.__cur, dict: d, scope: sc || "" }); add(c, d, sc); }; }', sandbox);
    if (/core\.js$/.test(src)) vm.runInContext('globalThis.__REG = REG;', sandbox);
    if (/i18n\.js$/.test(src)) vm.runInContext('globalThis.__I18N = I18N;', sandbox);
  } catch (e) { fail(src + ' failed to load in the test sandbox: ' + e.message); }
}
vm.runInContext('globalThis.__LANGS = LANGS; globalThis.__STAGES = STAGES; globalThis.__t = t;', sandbox);
const files = sandbox.__files || [];
const placeholders = s => (s.match(/\{\w+\}/g) || []).sort().join();

for (const { code } of sandbox.__LANGS) {
  if (code === 'en') continue;
  const seen = {};
  for (const f of files.filter(f => f.lang === code)) for (const [k, v] of Object.entries(f.dict)) {
    if (typeof v !== 'string' || !v) fail(`${f.file}: empty translation for ${JSON.stringify(k)}`);
    else if (placeholders(k) !== placeholders(v)) fail(`${f.file}: placeholders differ in ${JSON.stringify(k)} -> ${JSON.stringify(v)}`);
    const id = f.scope + '\u0001' + k;
    if (seen[id] && seen[id].v !== v) fail(`conflict in scope '${f.scope}' for ${JSON.stringify(k)}: ${seen[id].f} says ${JSON.stringify(seen[id].v)}, ${f.file} says ${JSON.stringify(v)}`);
    seen[id] = seen[id] || { v, f: f.file };
  }
  // coverage
  const need = new Map();   // string -> scope it is shown in
  const add = (x, sc) => x && need.set(sc + '\u0001' + x, { s: x, sc });
  sandbox.__STAGES.forEach(s => { add(s.name, ''); add(s.tag, ''); });
  for (const r of sandbox.__REG) {
    const sc = sandbox.__I18N.scopeOf(r.id); add(r.name, sc);
    try { sandbox.__cur = r; const g = vm.runInContext('__cur.fn(1)', sandbox, { timeout: 300 }); [g.cmd, g.hint, g.thint].forEach(x => add(x, sc)); }
    catch (e) { console.log('· could not build ' + r.id + ' in the sandbox (' + e.message + '); its strings are not covered here'); }
  }
  let miss = 0;
  for (const { s, sc } of need.values()) if (/[A-Za-z]{2}/.test(s) && !(sc + '\u0001' + s in seen) && !(('' + '\u0001' + s) in seen)) { miss++; console.log(`  [${code}] untranslated${sc ? ' (' + sc + ')' : ''}: ${JSON.stringify(s)}`); }
  console.log(`${code}: ${Object.keys(seen).length} keys, ${miss} untranslated of ${need.size} checked`);
  if (miss) bad++;
}
console.log(bad ? `\n${bad} problem(s)` : '\nok');
process.exit(bad ? 1 : 0);
