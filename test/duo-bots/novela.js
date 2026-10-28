'use strict';
/* bots for du_novela (SINTONIZA LA NOVELA). Role-honest, through the public handlers only:
   - the TUNER bot reads its screen (g.dbg.view(): dial n, the friend's fine lever v, the signal bar q) and estimates where the station is from the bar alone:
     the bar gives the distance d = (1 - q) * qw to the station, the sign is learned from how d changed after its own moves. It then parks the dial on the
     station that puts the friend's lever near the middle of its travel, and re-estimates whenever the bar contradicts its estimate (the station hopped).
   - the FINE bot only sees static: it sweeps the lever up and down (a triangle) and freezes the moment the static clears (view().locked), resuming the sweep when it comes back. */
module.exports = {
  du_novela: [
    (g) => {
      let started = false, last = -9, prev = null, fe = null;
      return {
        tick(T) {
          const w = g.dbg.view();
          if (!started) { started = true; g.down(g.dbg.dialPt(w.n)); }
          if (T - last < .1) return; last = T;
          const f = (w.n + w.v) / w.ns, d = (1 - w.q) * w.qw;
          if (w.q <= .001) { fe = null; prev = null; if (w.n !== 8) g.move(g.dbg.dialPt(8)); return; }
          if (fe !== null && Math.abs(Math.abs(fe - f) - d) > .02) fe = null;               // the bar contradicts the estimate: the station hopped
          if (fe === null) {
            if (prev) {                                                                       // two readings: pick the sign that explains both
              const c = [prev.f - prev.d, prev.f + prev.d], e = c.map(x => Math.abs(Math.abs(x - f) - d));
              if (Math.abs(e[0] - e[1]) > .004) fe = c[e[0] < e[1] ? 0 : 1];
            }
            if (fe === null) fe = f + d;                                                      // first guess; the next reading corrects it
          }
          prev = { f, d };
          const want = Math.max(0, Math.min(w.nMax, Math.round(fe * w.ns - .5)));
          if (want !== w.n) g.move(g.dbg.dialPt(want));
        },
      };
    },
    (g) => {
      let started = false, dir = -1, v = .5;
      return {
        tick(T, dt) {
          const w = g.dbg.view();
          if (!started) { started = true; g.down(g.dbg.knobPt(v)); }
          if (w.locked) return;                                                               // the static cleared: hold still
          v += dir * .7 * dt; if (v <= 0) { v = 0; dir = 1; } else if (v >= 1) { v = 1; dir = -1; }
          g.move(g.dbg.knobPt(v));
        },
      };
    },
  ],
};
