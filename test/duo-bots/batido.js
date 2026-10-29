'use strict';
/* bots for du_batido (BATIDO DE MAMEY). Role-honest, through the public handlers only:
   - the COCTELERA bot reads its cup (g.dbg.view(): its own shaking energy and whether the lid is on). While the lid is on it waves the pointer left-right
     at a constant speed and nudges that speed with a small integrator until the energy it feels is about half the tube; with the lid off it stops.
     It has no recipe and no green zone: the half-way target is the "do not shake like crazy" rule of thumb.
   - the TAPA bot reads its screen (g.dbg.view(): recipe ticket, how many ingredients are in, how mixed the glass is, the lid, whether it is ready):
     holds the lid while the glass is not mixed, lets go and taps the next ingredient of the ticket when it is, and lets go of the lid when everything is ready. */
module.exports = {
  du_batido: [
    (g) => {
      let started = false, x = 400, d = 1, spd = 1250, last = 0;
      return {
        tick(T) {
          const v = g.dbg.view(), dt = Math.max(0, T - last); last = T;
          if (!started) { started = true; g.down({ x, y: 300 }); }
          if (!v.lid) { spd = 1250; return; }
          spd = Math.max(300, Math.min(2800, spd + (.52 - v.e) * 2500 * dt));
          x += d * spd * dt; if (x > 600) { x = 600; d = -1; } else if (x < 200) { x = 200; d = 1; }
          g.move({ x, y: 300 });
        },
      };
    },
    (g) => {
      let lastTap = -9;
      return {
        tick(T) {
          const v = g.dbg.view();
          if (v.ready) { g.up(); return; }
          if (v.n < g.dbg.NIN && v.m >= v.n - .02) {
            if (v.lid) { g.up(); return; }
            if (T - lastTap > .2) { lastTap = T; const pl = v.plates[v.recipe[v.n]]; g.down({ x: pl.x, y: pl.y }); g.up(); }
          } else if (!v.lid) g.down({ x: v.lidPos.x, y: v.lidPos.y });
        },
      };
    },
  ],
};
