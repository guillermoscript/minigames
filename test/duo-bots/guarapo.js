'use strict';
/* bots for du_guarapo (GUARAPO). Role-honest, they only read g.dbg.view() and use the public handlers:
   - the CRANK bot circles its "finger" round the flywheel at the speed of the dial band it is aiming for. Like two friends on a call it picks
     the band from the tally it can see: each time the tally of full glasses grows the friend asks for another lane (1, 0, 2, 1, 0).
   - the GLASS bot watches where the juice lands and puts the glass in the nearest lane (tap on that lane). */
module.exports = {
  du_guarapo: [
    (g) => {
      let ang = 0, w = 0, down = false;
      return {
        tick(T, dt) {
          const v = g.dbg.view(), seq = [1, 0, 2, 1, 0], k = seq[Math.min(v.cups, seq.length - 1)], target = v.bands[k].center;
          w += (target - w) * Math.min(1, (dt || 1 / 60) * 6);
          ang += w * 2 * Math.PI * (dt || 1 / 60);
          const p = { x: v.cx + Math.cos(ang) * 90, y: v.cy + Math.sin(ang) * 90 };
          if (!down) { down = true; g.down(p); } else g.move(p);
        },
      };
    },
    (g) => ({
      tick() {
        const v = g.dbg.view(); if (!v.jetOn) return;
        let best = 0; v.laneX.forEach((x, i) => { if (Math.abs(x - v.jx) < Math.abs(v.laneX[best] - v.jx)) best = i; });
        if (best !== v.lane) { g.down({ x: v.laneX[best], y: 560 }); g.up(); }
      },
    }),
  ],
};
