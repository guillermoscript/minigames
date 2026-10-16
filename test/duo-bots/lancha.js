'use strict';
/* bots for du_lancha (LANCHA A LOS ROQUES). Role-honest:
   - the PILOT bot holds the throttle and only reacts to what its screen shows (g.dbg.pview(): its own position and the FLAGS in view -
     never the unflagged hazards). It simulates its own path forward and steers to the nearest lateral position that clears every flag.
   - the LOOKOUT bot only reads what its screen shows (g.dbg.lview(): obstacles under the water and whether they already carry a flag)
     and taps the nearest unflagged one every 0.15 s. */
module.exports = {
  du_lancha: [
    (g) => {
      let started = false, last = -9;
      return {
        tick(T) {
          const v = g.dbg.pview(), HW = g.dbg.HW, XM = g.dbg.XM;
          if (!started) { started = true; g.down({ x: 400, y: 500 }); }
          const fl = v.flags.filter(f => f.d > -24 && f.d < 1500).sort((a, b) => a.d - b.d);
          const slope = v.LS / v.VM * .9;                                            // sideways units per px of travel (conservative)
          const STEP = .05, N = Math.round(2 * XM / STEP) + 1, xs = Array.from({ length: N }, (_, i) => -XM + i * STEP);
          // Viterbi over the flags in order: cheapest path (least sideways travel) that keeps clear of every danger circle
          let cost = xs.map(c => Math.abs(c - v.x) <= slope * Math.max(10, fl.length ? Math.max(0, fl[0].d) : 0) ? Math.abs(c - v.x) : Infinity), back = [], prevD = 0;
          for (const f of fl) {
            const reach = slope * Math.max(1, f.d - prevD), nc = new Array(N).fill(Infinity), nb = new Array(N).fill(-1);
            for (let j = 0; j < N; j++) {
              if (Math.abs(xs[j] - f.x) < f.r + HW + .08) continue;
              for (let i = 0; i < N; i++) if (cost[i] < Infinity && Math.abs(xs[j] - xs[i]) <= reach) { const c = cost[i] + Math.abs(xs[j] - xs[i]) * .2 + Math.abs(xs[j]) * .01; if (c < nc[j]) { nc[j] = c; nb[j] = i; } }
            }
            back.push(nb); cost = nc; prevD = f.d;
          }
          let best = v.xT;
          if (fl.length) {
            let bj = -1, bc = Infinity; cost.forEach((c, j) => { if (c < bc) { bc = c; bj = j; } });
            if (bj >= 0) { for (let k = back.length - 1; k >= 0; k--) { if (k === 0) best = xs[bj]; bj = back[k][bj]; } }
            else { let bg = -9; for (const c of xs) { const gap = Math.min(...fl.slice(0, 2).map(f => Math.abs(f.x - c) - (f.r + HW))); if (gap > bg) { bg = gap; best = c; } } }
          } else best = 0;
          if (T - last > .03) { last = T; g.move({ x: g.dbg.toPx(best), y: 500 }); }
        },
      };
    },
    (g) => {
      let last = -9;
      return {
        tick(T) {
          if (T - last < .15) return;
          const v = g.dbg.lview(); const c = v.items.filter(o => !o.flagged && o.d > 10).sort((a, b) => a.d - b.d)[0];
          if (c) { last = T; g.down({ x: c.sx, y: c.sy }); g.up(); }
        },
      };
    },
  ],
};
