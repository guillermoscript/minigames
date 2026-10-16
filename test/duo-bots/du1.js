'use strict';
/* bots for the four original DUO games (du_catch, du_decode, du_steer, du_gun). Same shape as the other files here:
   { du_x: [botRole0, botRole1] }, each bot (g, role, h) -> { tick(T, dt)?, on(type, data)? }. Used by test/duo.test.js and the in-game CPU partner (js/coop-bots.js). */
const every = (T, st, k) => { const n = Math.floor(T / k); if (n !== st.n) { st.n = n; return true; } return false; };
module.exports = {
  du_catch: [(g, role) => { const items = []; return { on(t, d) { if (t === 'drop') items.push({ x: d.x, b: d.b, at: g.c }); }, tick() { const it = items.find(i => !i.b && g.c - i.at < 1.1); if (it) g.move({ x: it.x }); else { const bomb = items.find(i => i.b && g.c - i.at < 1.1); if (bomb) g.move({ x: bomb.x < 400 ? bomb.x + 200 : bomb.x - 200 }); } } }; },
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .5)) g.drop(); } }; }],
  du_decode: [(g) => { const st = { at: 0, ping: 0 }; return { on(t, d) { if (t === 'press') { st.at = d.at; st.wait = 0; } }, tick(T) { if (T - (st.sent === undefined ? -9 : st.sent) > (st.wait || 0)) { st.sent = T; st.wait = .9; g.ping(g.dbg.code[st.at]); } } }; },
    (g) => ({ on(t, d) { if (t === 'sym') g.press(d); } })],
  du_steer: [(g) => ({ tick() { const { p, x } = g.dbg.pos(); let tx = x; const near = g.dbg.ROCK.filter(o => o.p - p > -40 && o.p - p < 230); for (const cand of [x, 90, 250, 400, 550, 710]) { if (near.every(o => Math.abs(o.x - cand) > o.w / 2 + 40)) { tx = cand; break; } } g.move({ x: tx }); } }),
    (g) => { const st = {}; return { tick(T) { if (every(T, st, .17)) g.boost(); } }; }],
  du_gun: [(g) => { const st = {}; return { tick(T) { const d = g.dbg; let best = null; for (const t of d.tg) if (d.live(t) && t.c === d.ammo() && (!best || d.ty(t) > d.ty(best))) best = t; if (best) { g.move({ x: best.x }); g.fire(); } } }; },
    (g) => ({ tick() { const d = g.dbg; let best = null; for (const t of d.tg) if (d.live(t) && (!best || d.ty(t) > d.ty(best))) best = t; if (best && d.ammo() !== best.c) g.pick(best.c); } })],
};
