'use strict';
/* SQUAD microgames (3-4 players, one role each), headless: node test/squad.test.js [sq_pizza]
   Builds EVERY role of a game (3 and 4 seats) from the same seed, links them with an in-memory broadcast relay with a one-way delay
   (like the PocketBase broker: a message goes to everybody except the sender, handler gets (type, data, senderRole)), and lets a bot play
   each role through the public handlers (move/down/up/key/keyup + the game's own helpers). Checks that the team can win, that every
   screen agrees on the verdict, and that nobody wins when a role does nothing. No browser, no network.
   Bots live in test/squad-bots/<name>.js: module.exports = { sq_x: roles => [bot0, bot1, ...] } (roles = 3 or 4), each bot is
   (g, role, { every }) -> { tick(T, dt)?, on(type, data, fromRole)? } */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {}, performance: { now: () => 0 },
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() },
  THREE: stub(), AudioContext: function () {}, Image: function () {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
sb.window = sb; vm.createContext(sb);
const dir = path.join(root, 'js/games/squad');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort() : [];
const only = process.argv[2];
for (const f of ['js/i18n.js', 'js/core.js', 'js/games/du1.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
for (const f of files.filter(f => !only || f === only.replace(/^sq_/, '') + '.js')) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sb, { filename: 'js/games/squad/' + f });
vm.runInContext('globalThis.__REGMAP = REGMAP; globalThis.__withSeed = withSeed; globalThis.__setNow = v => { now = v; };', sb);
const P = require(path.join(root, 'pocketbase/pb_hooks/party.js'));
let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
const RESERVED = ['ping', 'pong', 'hb', 'frame', 'end'], reserved = new Set();   // 'end' is the judge's verdict (DUO.wire)

function play(id, n, seed, sp, delay, bots, opts = {}) {
  const q = [], handlers = Array(n).fill(null); let T = 0;
  const mk = role => ({ role, roles: n, partner: { name: 'P', color: '#fff' }, seats: [], byRole: [],
    send(t, d) { if (t !== 'end' && RESERVED.includes(t)) reserved.add(id + ':' + t); if (opts.drop && opts.drop(role, t)) return; const data = JSON.parse(JSON.stringify(d === undefined ? null : d)); for (let to = 0; to < n; to++) if (to !== role) q.push({ at: T + delay, to, from: role, t, d: data }); },
    onMsg(fn) { handlers[role] = fn; } });
  const e = sb.__REGMAP[id], g = [];
  for (let role = 0; role < n; role++) g[role] = sb.__withSeed(seed, () => e.fn(sp, mk(role)));
  const dur = g[0].dur / Math.sqrt(sp), dt = 1 / 60;
  const bot = bots.map((b, i) => b(g[i], i, { every }));
  handlers.forEach((h, i) => { const orig = h; handlers[i] = (t, d, from) => { orig(t, d, from); if (bot[i].on) bot[i].on(t, d, from); }; });
  const W8 = 1.5;                                                         // main.js DUO_WAIT: the non-judge waits this long past the limit for the judge's verdict
  for (T = 0; T < dur + W8 + .5; T += dt) {
    sb.__setNow(T);
    const due = q.filter(m => m.at <= T); if (due.length) { q.splice(0, q.length, ...q.filter(m => m.at > T)); due.forEach(m => handlers[m.to](m.t, m.d, m.from)); }
    for (let i = 0; i < n; i++) { const end = dur + (g[i].duoWait ? W8 : 0); if (!g[i].result && T < end) { if (T < dur) bot[i].tick && bot[i].tick(T, dt); g[i].update(dt, T); if (!g[i].result && T + dt >= end) g[i].result = 'lose'; } }
  }
  g.forEach(x => { if (!x.result) x.result = 'lose'; });
  return { res: g.map(x => x.result), g };
}
const every = (T, st, k) => { const m = Math.floor(T / k); if (m !== st.n) { st.n = m; return true; } return false; };
const BOTS = {};
const BOTDIR = path.join(__dirname, 'squad-bots');
if (fs.existsSync(BOTDIR)) for (const f of fs.readdirSync(BOTDIR).filter(f => f.endsWith('.js') && (!only || f === only.replace(/^sq_/, '') + '.js')).sort()) Object.assign(BOTS, require(path.join(BOTDIR, f)));
const ids = Object.keys(sb.__REGMAP).filter(id => sb.__REGMAP[id].squad && (!only || id === only));
check(ids.length > 0, `squad games registered: ${ids.join(', ') || 'none'}`);
const idle = () => ({});
for (const id of ids) {
  check(!!P.GAMES[id] && P.GAMES[id].duo && P.GAMES[id].min === 3 && P.GAMES[id].max === 4, `${id} is in the server catalog for 3-4 seats`);
  check(BOTS[id], `${id} has bots`); if (!BOTS[id]) continue;
  for (const n of [3, 4]) {
    const bots = BOTS[id](n); check(bots.length === n, `${id} x${n}: one bot per role`);
    const probe = play(id, n, 5, 1, .05, bots.map(() => idle)); check(probe.g.every(x => x.roles && x.roles.length === n && x.roles.every(r => r.label && r.short && r.how && typeof r.demo === 'function')), `${id} x${n}: intro card info (label, short, how, demo) for every role`);
    check(Math.abs(probe.g[0].dur - P.GAMES[id].dur) < 1e-9, `${id}: g.dur (${probe.g[0].dur}) matches the server's GAMES dur (${P.GAMES[id].dur})`);
    check(probe.g.filter(x => x.judge).length === 1, `${id} x${n}: exactly one judge`);
    for (const [sp, delay] of [[1, .05], [1.49, .15], [1.2, .3]]) {
      let wins = 0, mismatch = 0; const N = 8;
      for (let k = 1; k <= N; k++) { const r = play(id, n, 1000 * k + 7, sp, delay, bots).res; if (r.every(x => x === 'win')) wins++; if (new Set(r).size > 1) mismatch++; }
      check(wins >= N - 1, `${id} x${n} sp ${sp} lag ${delay * 1000}ms: bots win ${wins}/${N}`);
      check(mismatch === 0, `${id} x${n} sp ${sp} lag ${delay * 1000}ms: every screen agrees on the verdict (${mismatch} mismatches)`);
    }
    const lazy = play(id, n, 4242, 1, .1, bots.map(() => idle)).res; check(lazy.every(x => x === 'lose'), `${id} x${n}: nobody wins when nobody plays`);
    for (let r = 0; r < n; r++) { const res = play(id, n, 99, 1, .1, bots.map((b, i) => i === r ? idle : b)).res; check(!res.includes('win'), `${id} x${n}: the team cannot win without role ${r} (${bots.length ? 'it does nothing' : ''})`); }
  }
}
check(!reserved.size, `no SQUAD game sends a message type the transport reserves${reserved.size ? ': ' + [...reserved].join(', ') : ''}`);
console.log(bad ? `\n${bad} problem(s)` : '\nsquad.test.js OK'); process.exit(bad ? 1 : 0);
