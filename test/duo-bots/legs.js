'use strict';
/* bots for du_legs (WOBBLE WALK). Role-honest: each leg only uses what its own screen shows: the stones, its own foot and landing
   marker, and the friend's foot (planted where / lifted or not, as received). Same strategy for both legs:
   - when both feet are down and MY foot is the one behind (tie: the left leg goes first), wait a human-ish beat, then hold;
   - while holding, let go when the marker reaches the farthest stone (or bank) that the reach cap allows. */
const leg = role => (g) => {
  const st = { ready: -1 };
  return {
    tick(T) {
      const d = g.dbg, m = d.me(), f = d.fr();
      if (m.up) {
        let tgt = m.a;
        for (let k = 0; k <= d.LAST; k++) {
          const s = d.F[k], lo = k === d.LAST ? s.x0 + 6 : s.x0 + 8, hi = k === d.LAST ? s.x0 + 44 : s.c;
          if (lo <= m.cap && lo > m.a) tgt = Math.max(tgt, Math.min(hi, m.cap));
        }
        if (m.x >= tgt - 3) g.up();
        return;
      }
      const mine = !m.locked && !f.up && (m.a < f.a - .5 || (Math.abs(m.a - f.a) <= .5 && role === 0)) && !(m.k === d.LAST);
      if (!mine) { st.ready = -1; return; }
      if (st.ready < 0) st.ready = T + .1;
      if (T >= st.ready) { st.ready = -1; g.down({ x: 400, y: 300 }); }
    },
  };
};
module.exports = { du_legs: [leg(0), leg(1)] };
