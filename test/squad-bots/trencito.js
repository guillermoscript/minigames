'use strict';
/* bots for sq_trencito (TRENCITO). Role-honest, ~100 ms reaction:
   role 0 (uncle) sees the obstacles ahead and his own y: steers toward the nearest free gap;
   roles 1 / 3 (aunt, cousin) see the beat lane: tap when the arepa reaches the plate;
   role 2 (grandma) sees the tension gauge: pulls when it climbs past the green band. */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const head = (g) => {
  return { tick() {
    const v = g.dbg.view(); let tgt = clamp(v.y, 372, 520);
    const near = v.ob.filter(o => o.st - v.S > -(o.hw + 30) / 230 && o.st - v.S < 1.5).sort((a, b) => a.st - b.st);
    if (near.length) {
      const o = near[0], span = o.kind === 2 ? [-.3, -.15, 0, .15, .3].map(d => o.at(o.st + d)) : [o.oy];
      const lo = Math.min(...span) - o.hh - 34, hi = Math.max(...span) + o.hh + 34;
      const up = lo >= 356, dn = hi <= 532, goUp = v.y < o.oy ? up || !dn : !dn && up;
      tgt = goUp ? lo - 4 : hi + 4;
    }
    g.steer(clamp((tgt - v.y) / 30 - v.vy / 110, -1, 1));
  } };
};
const beat = (g, role) => {
  let k = 0;
  return { tick() {
    const v = g.dbg.view(), b = g.dbg.beatT(role, k);
    if (k < 14 && v.S >= b + .02) { g.tap(); k++; }
  } };
};
const pull = (g) => { let last = -9; return { tick(T) { const v = g.dbg.view(); if (v.ten > .35 && T - last > .45) { last = T; g.tap(); } } }; };
module.exports = { sq_trencito: n => Array.from({ length: n }, (_, r) => r === 0 ? head : r === 2 ? pull : beat) };
