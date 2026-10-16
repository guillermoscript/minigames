'use strict';
/* bots for sq_balde (PASA EL BALDE). Role-honest: each bot reads only what its seat shows (its own hands, whether the NEXT seat's ready ring is green
   for the bucket it holds and whether that seat's hands are full, the cat sitting by the barrel) and drives the public handlers like a hand,
   with a human reaction time of ~120 ms. */
const REACT = .12;
const pila = g => { let down = false; return { tick(T, dt) {
  const v = g.dbg.view();
  if (!down) { if (v.hand === null && !v.filling) { g.down({ x: 400, y: 300 }); down = true; } return; }
  if (v.hand === null || !v.filling) { down = false; g.up({ x: 400, y: 300 }); return; }
  if (v.hand >= .7 && !v.busyNext && g.dbg.open(v.hand, 0)) { down = false; g.up({ x: 400, y: 300 }); }
} }; };
const medio = g => { let got = -1; return { tick(T, dt) {
  const v = g.dbg.view();
  if (v.hand === null) { got = -1; return; }
  if (got < 0) got = T;
  if (T - got >= REACT && !v.busyNext && g.dbg.open(v.hand, 0)) { g.down({ x: 400, y: 300 }); g.up({ x: 400, y: 300 }); got = -1; }
} }; };
const cocina = g => { let got = -1, seen = -1; return { tick(T, dt) {
  const v = g.dbg.view(), c = g.dbg.cat();
  if (c) { if (seen < 0) seen = T; if (T - seen >= REACT) { g.down({ x: c.x, y: c.y }); g.up({ x: c.x, y: c.y }); seen = -1; return; } } else seen = -1;
  if (v.hand === null) { got = -1; return; }
  if (got < 0) got = T;
  if (T - got >= REACT) { g.down({ x: 300, y: 300 }); g.up({ x: 300, y: 300 }); got = -1; }
} }; };
module.exports = { sq_balde: n => n === 4 ? [pila, medio, medio, cocina] : [pila, medio, cocina] };
