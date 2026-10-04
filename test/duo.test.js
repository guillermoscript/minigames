'use strict';
/* DUO microgames, headless: node test/duo.test.js
   Builds BOTH roles of every du_* game from the same seed, links them with an in-memory relay that has a one-way delay (like the
   PocketBase broker), and lets a bot play each role through the public handlers (move/down/key). Checks that the pair can win,
   that both screens agree on the verdict, and that nobody wins without their partner. No browser, no network. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {}, performance: { now: () => 0 },
  location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() },
  THREE: stub(), AudioContext: function () {}, Image: function () {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
sb.window = sb; vm.createContext(sb);
const duoFiles = fs.readdirSync(path.join(root, 'js/games/duo')).filter(f => f.endsWith('.js')).sort().map(f => 'js/games/duo/' + f);
const only = process.argv[2];                                            // node test/duo.test.js du_hippo  -> just that game
for (const f of ['js/i18n.js', 'js/core.js', 'js/games/du1.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
for (const f of duoFiles.filter(f => !only || f === 'js/games/duo/' + only.replace(/^du_/, '') + '.js')) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
vm.runInContext('globalThis.__REGMAP = REGMAP; globalThis.__withSeed = withSeed; globalThis.__setNow = v => { now = v; };', sb);
let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } else console.log('✓ ' + m); };

const RESERVED = ['ping', 'pong', 'hb', 'frame'], reserved = new Set();   // party.js keeps these for itself (latency probe, heartbeat, spectator frames): a game message with that type never arrives
/* one round: returns { r0, r1, t } (results of role 0 and role 1) */
function play(id, seed, sp, delay, bots, opts = {}) {
  const q = [], handlers = [null, null]; let T = 0;
  const mk = role => ({ role, roles: 2, partner: { name: 'P', color: '#fff' },
    send(t, d, latest) { if (RESERVED.includes(t)) reserved.add(id + ':' + t); if (opts.drop && opts.drop(role, t)) return; q.push({ at: T + delay, to: 1 - role, t, d: JSON.parse(JSON.stringify(d === undefined ? null : d)) }); },
    onMsg(fn) { handlers[role] = fn; } });
  const e = sb.__REGMAP[id], g = [null, null];
  for (const role of [0, 1]) g[role] = sb.__withSeed(seed, () => e.fn(sp, mk(role)));
  const dur = g[0].dur / Math.sqrt(sp), dt = 1 / 60, spy = [[], []];
  const bot = [bots[0](g[0], 0, { every }), bots[1](g[1], 1, { every })];
  handlers.forEach((h, i) => { const orig = h; handlers[i] = (t, d) => { orig(t, d); if (bot[i].on) bot[i].on(t, d); }; });
  const W8 = 1.5;                                                         // main.js DUO_WAIT: the non-judge waits this long past the limit for the judge's verdict
  for (T = 0; T < dur + W8 + .5; T += dt) {
    sb.__setNow(T);
    const due = q.filter(m => m.at <= T); if (due.length) { q.splice(0, q.length, ...q.filter(m => m.at > T)); due.forEach(m => handlers[m.to](m.t, m.d)); }   // delivered in send order
    for (const i of [0, 1]) { const end = dur + (g[i].duoWait ? W8 : 0); if (!g[i].result && T < end) { if (T < dur) bot[i].tick && bot[i].tick(T, dt); g[i].update(dt, T); if (!g[i].result && T + dt >= end) g[i].result = 'lose'; } }
  }
  for (const i of [0, 1]) if (!g[i].result) g[i].result = 'lose';          // what main.js does when tt >= dur
  return { r0: g[0].result, r1: g[1].result };
}
const every = (T, st, k) => { const n = Math.floor(T / k); if (n !== st.n) { st.n = n; return true; } return false; };
const BOTS = {
  du_catch: [(g, role) => { const items = []; return { on(t, d) { if (t === 'drop') items.push({ x: d.x, b: d.b, at: g.c }); }, tick() { const it = items.find(i => !i.b && g.c - i.at < 1.1); if (it) g.move({ x: it.x }); else { const bomb = items.find(i => i.b && g.c - i.at < 1.1); if (bomb) g.move({ x: bomb.x < 400 ? bomb.x + 200 : bomb.x - 200 }); } } }; },
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .5)) g.drop(); } }; }],
  du_decode: [(g) => { const st = { at: 0, ping: 0 }; return { on(t, d) { if (t === 'press') { st.at = d.at; st.wait = 0; } }, tick(T) { if (T - (st.sent === undefined ? -9 : st.sent) > (st.wait || 0)) { st.sent = T; st.wait = .9; g.ping(g.dbg.code[st.at]); } } }; },
    (g) => ({ on(t, d) { if (t === 'sym') g.press(d); } })],
  du_steer: [(g) => ({ tick() { const { p, x } = g.dbg.pos(); let tx = x; const near = g.dbg.ROCK.filter(o => o.p - p > -40 && o.p - p < 230); for (const cand of [x, 90, 250, 400, 550, 710]) { if (near.every(o => Math.abs(o.x - cand) > o.w / 2 + 40)) { tx = cand; break; } } g.move({ x: tx }); } }),
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .17)) g.boost(); } }; }],
  du_gun: [(g) => { const st = {}; return { tick(T) { const d = g.dbg; let best = null; for (const t of d.tg) if (d.live(t) && t.c === d.ammo() && (!best || d.ty(t) > d.ty(best))) best = t; if (best) { g.move({ x: best.x }); g.fire(); } } }; },
    (g) => ({ tick() { const d = g.dbg; let best = null; for (const t of d.tg) if (d.live(t) && (!best || d.ty(t) > d.ty(best))) best = t; if (best && d.ammo() !== best.c) g.pick(best.c); } })],
};
/* bots for the games in js/games/duo/ live next to this file: test/duo-bots/<name>.js exports { du_x: [botRole0, botRole1] },
   each bot (g, role, { every }) -> { tick(T, dt)?, on(type, data)? } */
const BOTDIR = path.join(__dirname, 'duo-bots');
for (const f of fs.readdirSync(BOTDIR).filter(f => f.endsWith('.js') && (!only || f === only.replace(/^du_/, '') + '.js')).sort()) Object.assign(BOTS, require(path.join(BOTDIR, f)));
for (const id of Object.keys(sb.__REGMAP)) if (sb.__REGMAP[id].duo && (!only || id === only)) check(BOTS[id], `${id} has bots`);
const idle = () => ({});
for (const id of Object.keys(BOTS).filter(id => !only || id === only)) {
  for (const [sp, delay] of [[1, .05], [1.49, .15], [1.2, .3]]) {
    let wins = 0, mismatch = 0; const N = 8;
    for (let k = 1; k <= N; k++) { const r = play(id, 1000 * k + 7, sp, delay, BOTS[id]); if (r.r0 === 'win' && r.r1 === 'win') wins++; if (r.r0 !== r.r1) mismatch++; }
    check(wins >= N - 1, `${id} sp ${sp} lag ${delay * 1000}ms: bots win ${wins}/${N}`);
    check(mismatch === 0, `${id} sp ${sp} lag ${delay * 1000}ms: both screens agree on the verdict (${mismatch} mismatches)`);
  }
  const lazy = play(id, 4242, 1, .1, [idle, idle]); check(lazy.r0 === 'lose' && lazy.r1 === 'lose', `${id}: nobody wins when nobody plays`);
  const noPartner = play(id, 99, 1, .1, [BOTS[id][0], idle]); const noPartner2 = play(id, 99, 1, .1, [idle, BOTS[id][1]]);
  check(!(noPartner.r0 === 'win' || noPartner.r1 === 'win') && !(noPartner2.r0 === 'win' || noPartner2.r1 === 'win'), `${id}: a single role cannot win alone`);
}
check(!reserved.size, `no DUO game sends a message type the transport reserves (${RESERVED.join(', ')})${reserved.size ? ': ' + [...reserved].join(', ') : ''}`);
console.log(bad ? `\n${bad} problem(s)` : '\nduo.test.js OK'); process.exit(bad ? 1 : 0);
