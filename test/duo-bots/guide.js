'use strict';
/* bots for du_guide (DARK STEPS). Role-honest:
   - the WALKER bot only reads the NEXT shout in its bubble (g.dbg.next(), the button that glows) and presses that arrow.
   - the GUIDE bot reads the lake (g.dbg.pit: it sees the thin ice), where it last heard the walker is (g.dbg.seen()) and its own
     shouts not walked yet (g.dbg.pend()); it plans a safe route (left / right / up only) and keeps up to 2 shouts in flight. */
const KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];
function route(g, from) {                               // BFS to the far shore (row -1), returns the list of moves
  const { pit, sc, C, RW } = g.dbg, prev = new Map(), k = (c, r) => c + ',' + r, q = [from]; prev.set(k(...from), null);
  while (q.length) {
    const [c, r] = q.shift();
    if (r === -1) { const out = []; let cur = k(c, r); while (prev.get(cur)) { const p = prev.get(cur); out.unshift(p.d); cur = k(p.c, p.r); } return out; }
    for (let d = 0; d < 3; d++) {
      if (r === RW && d !== 1) continue;
      const nc = r === RW ? sc : c + [-1, 0, 1][d], nr = r + [0, -1, 0][d];
      if (nc < 0 || nc >= C || (nr >= 0 && pit[nr][nc]) || prev.has(k(nc, nr))) continue;
      prev.set(k(nc, nr), { c, r, d }); q.push([nc, nr]);
    }
  }
  return [];
}
module.exports = {
  du_guide: [
    (g) => {
      const st = { at: -9, seenAt: null, d: null };
      return { tick(T) {
        const d = g.dbg.next(); if (d === null) { st.seenAt = null; return; }
        if (st.seenAt === null || d !== st.d) { st.seenAt = T; st.d = d; }
        if (T - st.seenAt < .15 || T - st.at < .22) return;      // a human-ish reaction time
        st.at = T; st.seenAt = null; g.key({ code: KEYS[d], repeat: false });
      } };
    },
    (g) => {
      const st = { at: -9 };
      return { tick(T) {
        if (T - st.at < .25) return;
        const s = g.dbg.seen(), pend = g.dbg.pend(); if (pend.length >= 2) return;
        let c = s.c, r = s.r;
        for (const d of pend) { if (r === g.dbg.RW) c = g.dbg.sc; c += [-1, 0, 1][d]; r += [0, -1, 0][d]; }
        const plan = route(g, [c, r]); if (!plan.length) return;
        st.at = T; g.key({ code: KEYS[plan[0]], repeat: false });
      } };
    },
  ],
};
