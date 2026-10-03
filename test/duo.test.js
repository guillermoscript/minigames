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
for (const f of ['js/i18n.js', 'js/core.js', 'js/games/du1.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
vm.runInContext('globalThis.__REGMAP = REGMAP; globalThis.__withSeed = withSeed; globalThis.__setNow = v => { now = v; };', sb);
let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } else console.log('✓ ' + m); };

/* one round: returns { r0, r1, t } (results of role 0 and role 1) */
function play(id, seed, sp, delay, bots, opts = {}) {
  const q = [], handlers = [null, null]; let T = 0;
  const mk = role => ({ role, roles: 2, partner: { name: 'P', color: '#fff' },
    send(t, d, latest) { if (opts.drop && opts.drop(role, t)) return; q.push({ at: T + delay, to: 1 - role, t, d: JSON.parse(JSON.stringify(d === undefined ? null : d)) }); },
    onMsg(fn) { handlers[role] = fn; } });
  const e = sb.__REGMAP[id], g = [null, null];
  for (const role of [0, 1]) g[role] = sb.__withSeed(seed, () => e.fn(sp, mk(role)));
  const dur = g[0].dur / Math.sqrt(sp), dt = 1 / 60, spy = [[], []];
  const bot = [bots[0](g[0], 0), bots[1](g[1], 1)];
  handlers.forEach((h, i) => { const orig = h; handlers[i] = (t, d) => { orig(t, d); if (bot[i].on) bot[i].on(t, d); }; });
  for (T = 0; T < dur + .5; T += dt) {
    sb.__setNow(T);
    const due = q.filter(m => m.at <= T); if (due.length) { q.splice(0, q.length, ...q.filter(m => m.at > T)); due.forEach(m => handlers[m.to](m.t, m.d)); }   // delivered in send order
    for (const i of [0, 1]) { if (!g[i].result && T < dur) { bot[i].tick && bot[i].tick(T, dt); g[i].update(dt, T); if (!g[i].result && T >= dur) g[i].result = 'lose'; } }
  }
  for (const i of [0, 1]) if (!g[i].result) g[i].result = 'lose';          // what main.js does when tt >= dur
  return { r0: g[0].result, r1: g[1].result };
}
const every = (T, st, k) => { const n = Math.floor(T / k); if (n !== st.n) { st.n = n; return true; } return false; };
const BOTS = {
  du_catch: [(g, role) => { const items = []; return { on(t, d) { if (t === 'drop') items.push({ x: d.x, b: d.b, at: g.c }); }, tick() { const it = items.find(i => !i.b && g.c - i.at < 1.1); if (it) g.move({ x: it.x }); else { const bomb = items.find(i => i.b && g.c - i.at < 1.1); if (bomb) g.move({ x: bomb.x < 400 ? bomb.x + 200 : bomb.x - 200 }); } } }; },
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .5)) g.drop(); } }; }],
  du_decode: [(g) => { const st = { at: 0, ping: 0 }; return { on(t, d) { if (t === 'press') { st.at = d.at; st.wait = 0; } }, tick(T) { if (T - (st.sent === undefined ? -9 : st.sent) > (st.wait || 0)) { st.sent = T; st.wait = .9; g.ping(g.dbg.code[st.at]); } } }; },
    (g) => ({ on(t, d) { if (t === 'ping') g.press(d); } })],
  du_crank: [(g) => { const sp = g.dbg.sparks; return { tick() { const live = sp.some(s => g.c >= s.a - .3 && g.c < s.b + .05); g.key({ code: live ? 'KeyZ' : 'Space' }); if (live) g.keyup({ code: 'Space' }); } }; },
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .09)) g.key({ code: 'Space', repeat: false }); } }; }],
  du_steer: [(g) => ({ tick() { const { p, x } = g.dbg.pos(); let tx = x; const near = g.dbg.ROCK.filter(o => o.p - p > -40 && o.p - p < 230); for (const cand of [x, 90, 250, 400, 550, 710]) { if (near.every(o => Math.abs(o.x - cand) > o.w / 2 + 40)) { tx = cand; break; } } g.move({ x: tx }); } }),
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .17)) g.boost(); } }; }],
  du_seesaw: [0, 1].map(side => (g) => { let prev = 0; return { tick(T, dt) { const b = g.dbg.ball(), v = (b - prev) / dt; prev = b; const f = b + .35 * v + .3 * g.dbg.wind(); if (side === 0 ? f < -.08 : f > .08) g.key({ code: 'Space' }); else g.keyup({ code: 'Space' }); } }; }),
  du_beat: [0, 1].map(lane => (g) => ({ tick() { if (g.dbg.notes.some(n => n.lane === lane && !n.hit && Math.abs(n.t - g.c) < .05)) g.tap(); } })),
  du_guide: [(g) => ({ on(t, d) { if (t === 'sig') g.act(d); } }),
    (g) => { const st = { last: null, at: -9 }; return { tick(T) {
      const pos = g.dbg.pos(), key = pos.join(), { pit, flag, C, RW } = g.dbg;
      if (key === st.last && T - st.at < 1.4) return; st.last = key; st.at = T;
      const prev = { [key]: null }, q = [pos]; let goal = null;
      while (q.length && !goal) { const [c, r] = q.shift(); if (r === 0 && c === flag) { goal = [c, r]; break; } for (let d = 0; d < 4; d++) { const nc = c + [-1, 0, 1, 0][d], nr = r + [0, -1, 0, 1][d], k = nc + ',' + nr; if (nc < 0 || nc >= C || nr < 0 || nr >= RW || pit[nr][nc] || k in prev) continue; prev[k] = [c, r, d]; q.push([nc, nr]); } }
      if (!goal) return; let cur = goal, dir = null; while (prev[cur.join()]) { const pv = prev[cur.join()]; dir = pv[2]; cur = [pv[0], pv[1]]; if (cur.join() === key) break; }
      if (dir !== null) g.signal(dir); } }; }],
  du_gun: [(g) => { const st = {}; return { tick(T) { const d = g.dbg; let best = null; for (const t of d.tg) if (d.live(t) && t.c === d.ammo() && (!best || d.ty(t) > d.ty(best))) best = t; if (best) { g.move({ x: best.x }); g.fire(); } } }; },
    (g) => ({ tick() { const d = g.dbg; let best = null; for (const t of d.tg) if (d.live(t) && (!best || d.ty(t) > d.ty(best))) best = t; if (best && d.ammo() !== best.c) g.pick(best.c); } })],
};
const idle = () => ({});
for (const id of Object.keys(BOTS)) {
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
console.log(bad ? `\n${bad} problem(s)` : '\nduo.test.js OK'); process.exit(bad ? 1 : 0);
