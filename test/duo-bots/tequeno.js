'use strict';
/* bots for du_tequeno (TEQUEÑOS A TIEMPO). Role-honest, ~120 ms behind what the screen shows:
   - the FRYER bot reads only the timer rings (g.dbg.fryView(): which tequeños are in the oil and where their ring is) and taps one
     when the ring has just entered the golden arc.
   - the SAUCE bot reads only the plates (g.dbg.salView(): plate x, the tag with what the tío wants, whether the tequeño is on it and
     what sauce it has). It picks the bottle with Z / X and taps the belt where the plate will be. */
const LAG = .12;
module.exports = {
  du_tequeno: [
    (g, role, { every }) => {
      const st = {}, seen = []; const taken = new Set();
      return {
        tick(T) {
          const D = g.dbg; if (every(T, st, .03)) seen.push({ T, v: D.fryView() });
          while (seen.length > 1 && seen[1].T <= T - LAG) seen.shift();
          if (!seen.length || seen[0].T > T - LAG) return;
          for (const c of seen[0].v) if (!taken.has(c.i) && c.d >= -.3) { taken.add(c.i); g.down({ x: c.x, y: c.y }); }
        },
      };
    },
    (g, role, { every }) => {
      const st = {}, seen = []; const tried = new Set();
      return {
        tick(T) {
          const D = g.dbg; if (every(T, st, .03)) seen.push({ T, v: D.salView() });
          while (seen.length > 1 && seen[1].T <= T - LAG) seen.shift();
          if (!seen.length || seen[0].T > T - LAG) return;
          for (const p of seen[0].v.plates) {
            if (tried.has(p.i) || p.q !== 1 || p.want === 2 || p.sauce >= 0 || p.x < 130 || p.x > 540) continue;
            tried.add(p.i); g.key({ code: p.want ? 'KeyX' : 'KeyZ' }); g.down({ x: p.x + D.BV * LAG, y: 380 }); break;
          }
        },
      };
    },
  ],
};
