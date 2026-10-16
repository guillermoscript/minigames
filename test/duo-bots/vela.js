'use strict';
/* bots for du_vela (BLACKOUT). Role-honest:
   - the FLASHLIGHT bot only reads what its screen shows (g.dbg.linView(): its beam, the friend's candle, the true kind of what the beam covers).
     It has no idea where the shapes are: it carries the beam to the friend's candle (that is how the candle "points") and holds it there.
   - the CANDLE bot only reads what its screen shows (g.dbg.velaView(): every shape as an anonymous lump, the revealed ones with their kind).
     It hovers over an unexamined lump until the friend's light reveals it; roach -> swat, anything else -> remember and move on.
   Both act on a view ~150 ms old and move the pointer at a limited speed. */
const PSPD_L = 900, PSPD_C = 470, SEE = .15;
module.exports = {
  du_vela: [
    (g, role, { every }) => {
      const st = {}, seen = []; let px = 400, py = 430;
      return {
        tick(T, dt) {
          const D = g.dbg;
          if (every(T, st, .05)) seen.push({ T, v: D.linView() });
          while (seen.length > 1 && seen[1].T <= T - SEE) seen.shift();
          if (!seen.length || seen[0].T > T - SEE) return;
          const c = seen[0].v.candle || [400, 430], dx = c[0] - px, dy = c[1] - py, d = Math.hypot(dx, dy), s = Math.min(d, PSPD_L * dt);
          if (d > 1e-6) { px += dx / d * s; py += dy / d * s; }
          g.move({ x: px, y: py });
        },
      };
    },
    (g, role, { every }) => {
      const st = {}, seen = []; let px = 400, py = 430, goal = null, since = 0, cool = 0; const skip = new Map();
      return {
        tick(T, dt) {
          const D = g.dbg;
          if (every(T, st, .05)) seen.push({ T, v: D.velaView() });
          while (seen.length > 1 && seen[1].T <= T - SEE) seen.shift();
          if (!seen.length || seen[0].T > T - SEE) return;
          const v = seen[0].v; let tx = px, ty = py, act = null;
          for (const r of v.rev) if (r.kind !== 'roach') skip.set(r.i, T + 6);
          const roach = v.rev.filter(r => r.kind === 'roach').sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
          if (roach) { tx = roach.x; ty = roach.y; goal = null; if (Math.hypot(roach.x - px, roach.y - py) < 10 && T > cool) act = 'whack'; }
          else {
            const cand = v.sil.filter(s => !(skip.get(s.i) > T)).sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
            if (!goal || !cand.some(s => s.i === goal.i)) { goal = cand[0] ? { i: cand[0].i } : null; since = T; }
            if (goal) { const s = cand.find(q => q.i === goal.i); tx = s.x; ty = s.y; if (T - since > 1.9) { skip.set(goal.i, T + 2.5); goal = null; } }
          }
          const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy), s = Math.min(d, PSPD_C * dt);
          if (d > 1e-6) { px += dx / d * s; py += dy / d * s; }
          g.move({ x: px, y: py });
          if (act) { cool = T + .5; g.down({ x: px, y: py }); g.up(); }
        },
      };
    },
  ],
};
