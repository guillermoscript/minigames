'use strict';
/* bots for du_gasolina (COLA DE GASOLINA). Role-honest:
   - the VIVO bot only reads what its screen shows (g.dbg.vivoView(): the guard's gaze state / how far he looks away, our spot in the line,
     whether the marker is held), ~150 ms late. It starts holding the marker early in the guard's FRONT stare (so the friend's honk lands
     before he sweeps to the back), cancels if he starts sweeping back, and lets go once he has turned away.
   - the DRIVER bot only reads its dash (g.dbg.dashView(): the lamp): it honks ~250 ms after the lamp lights, once per request. */
module.exports = {
  du_gasolina: [
    (g, role, { every }) => {
      const st = {}, seen = []; let armedAt = -9, busy = 0;
      return {
        tick(T, dt) {
          const D = g.dbg;
          if (every(T, st, .05)) seen.push({ T, v: D.vivoView() });
          while (seen.length > 1 && seen[1].T <= T - .15) seen.shift();
          if (!seen.length || seen[0].T > T - .15) return;
          const v = seen[0].v, live = D.vivoView();
          if (T < busy) return;
          if (live.armed) {
            if (v.win || v.w > .7) { g.up(); busy = T + .25; armedAt = -9; }                             // he turned away: let go
            else if (v.gs !== 'F' || T - armedAt > 2.2) { g.move({ x: D.SX, y: D.slotY(live.p) }); g.up(); busy = T + .3; armedAt = -9; }   // too late: cancel
          } else if (!live.stun && live.p > 0 && v.gs === 'F' && v.gt > .1 && v.gt < v.fdw * .4 && !v.win) {
            g.down({ x: D.SX, y: D.slotY(Math.max(0, live.p - 2)) }); armedAt = T;
          }
        },
      };
    },
    (g, role, { every }) => {
      let was = false, at = 0;
      return {
        tick(T) {
          const lamp = g.dbg.dashView().lamp;
          if (lamp && !was) at = T + .25;
          if (lamp && at && T >= at) { g.down({ x: g.dbg.HX, y: g.dbg.HY }); g.up(); at = 0; }
          if (!lamp) at = 0;
          was = lamp;
        },
      };
    },
  ],
};
