'use strict';
/* bots for du_mototaxi (MOTOTAXI EN EL CERRO). Role-honest, they read only g.dbg.view() and use the public handlers:
   - the DRIVER bot holds the throttle (g.down) and lets go (g.up) only when a crossing dog (visible on its screen, within ~280 px) would be on
     the moto's line when the moto reaches it. It never sees the potholes/hens far ahead, and it cannot steer.
   - the PASSENGER bot sees the whole street (pothole and hen positions) and plans the lean with a small Viterbi: the cheapest sideways path that
     keeps clear of every pothole/hen, then leans (g.move) towards the first planned position. It cannot brake. */
module.exports = {
  du_mototaxi: [
    (g) => {
      let held = false, last = -9;
      return {
        tick(T) {
          const v = g.dbg.view(), HW = g.dbg.HW, DOGX = g.dbg.DOGX;
          let brake = false;
          for (const o of v.near) {
            if (o.kind !== 'perro' || o.d < -6) continue;
            const tau = o.d / Math.max(v.v, 70);                       // seconds until the moto reaches the dog's line
            const pred = o.startIn > 0 ? -DOGX + o.dvx * Math.max(0, tau - o.startIn) : o.dx + o.dvx * tau;
            const pc = Math.max(-DOGX, Math.min(DOGX, pred));
            if (Math.abs(pc - v.x) < .55 + HW + .45 && o.d < 260) brake = true;
            if (o.d < 90 && Math.abs(o.dx - v.x) < .55 + HW + .5) brake = true;
          }
          if (T - last < .02) return; last = T;
          if (brake && held) { held = false; g.up(); } else if (!brake && !held) { held = true; g.down({ x: 400, y: 500 }); }
        },
      };
    },
    (g) => {
      let last = -9;
      return {
        tick(T) {
          const v = g.dbg.view(), HW = g.dbg.HW, XM = g.dbg.XM;
          const fl = v.far.filter(f => (f.kind === 'bache' || f.kind === 'gallina') && f.d > -24 && f.d < 1500).sort((a, b) => a.d - b.d);
          const slope = g.dbg.LS / g.dbg.VM * .9;
          const STEP = .05, N = Math.round(2 * XM / STEP) + 1, xs = Array.from({ length: N }, (_, i) => -XM + i * STEP);
          let cost = xs.map(c => Math.abs(c - v.x) <= slope * Math.max(10, fl.length ? Math.max(0, fl[0].d) : 0) ? Math.abs(c - v.x) : Infinity), back = [], prevD = 0;
          for (const f of fl) {
            const reach = slope * Math.max(1, f.d - prevD), nc = new Array(N).fill(Infinity), nb = new Array(N).fill(-1);
            for (let j = 0; j < N; j++) {
              if (Math.abs(xs[j] - f.x) < f.r + HW + .1) continue;
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
  ],
};
