'use strict';
/* bots for sq_movers (SOFA MOVERS). Role-honest: each bot reads only what its own screen knows (g.dbg: the position it sees, the handle heights
   it sees, its own green band) and drives the public handlers like a hand would.
   - the FOREMAN holds the walk button while the next ~75 px of road is clear with the heights it sees, and lets go otherwise.
   - a CARRIER moves its handle to the middle of the green band its gauge shows (or to the middle when there is no obstacle in sight). */
module.exports = {
  sq_movers: n => Array.from({ length: n }, (_, r) => r === 0
    ? (g) => {
      let held = false;
      return {
        tick(T) {
          const want = T > .1 && g.dbg.safe(); if (want && !held) { held = true; g.down({ x: 0, y: 0 }); } else if (!want && held) { held = false; g.up({ x: 0, y: 0 }); }
        },
      };
    }
    : (g, role, { every }) => {
      const st = {}; let tgt = .5;
      return {
        tick(T) {
          if (every(T, st, .12)) { const b = g.dbg.band(); tgt = b && !b.free ? (b.lo + b.hi) / 2 : .5; }
          g.move({ x: 100, y: g.dbg.yOfH(tgt) });
        },
      };
    }),
};
