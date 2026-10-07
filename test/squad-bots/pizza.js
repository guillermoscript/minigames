'use strict';
/* bots for sq_pizza (PIZZA RUSH). Role-honest: each bot reads only its own station through g.dbg (the pizza at my station, my beat,
   my spiral, which spot glows, my heat) and drives the public handlers like a hand: a human reaction time, a limited pointer speed. */
const step = (from, to, max) => { const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy); return d <= max ? to.slice() : [from[0] + dx / d * max, from[1] + dy / d * max]; };
const REACT = .16;                                           // seconds between "it glows" and the tap
const dough = g => { let last = -1; return { tick(T, dt) { const d = g.dbg; if (!d.ready()) return; const b = d.beatIn(), k = Math.round((T + dt) / d.bp); if (b <= dt * 1.2 && k !== last) { last = k; g.down({ x: 400, y: 420 }); g.up({ x: 400, y: 420 }); } } }; };
const sauce = g => { let ptr = null, down = false; return { tick(T, dt) {
  const d = g.dbg; if (!ptr) ptr = d.spiral(0).slice();
  if (!d.ready() || !d.sauceNow()) { if (down) { down = false; g.up({ x: ptr[0], y: ptr[1] }); } return; }
  const tgt = d.spiral(down ? Math.min(1, d.prog() + .07) : d.prog()); ptr = step(ptr, tgt, 520 * dt); g.move({ x: ptr[0], y: ptr[1] });
  if (!down && Math.hypot(ptr[0] - d.spiral(d.prog())[0], ptr[1] - d.spiral(d.prog())[1]) < 14) { down = true; g.down({ x: ptr[0], y: ptr[1] }); }
}, reset() { down = false; } }; };
const tops = g => { let seen = -1, at = 0; return { tick(T, dt) {
  const d = g.dbg; if (!d.ready() || !d.topsNow()) { seen = -1; return; }
  const l = d.lit(); if (l < 0) { seen = -1; return; }
  if (seen !== l && seen !== -2) { seen = l; at = T; }
  if (seen === l && T - at >= REACT && d.lock() <= 0) { const [dx, dy] = d.SPOT[l]; g.down({ x: d.PC[0] + dx, y: d.PC[1] + dy }); g.up({ x: d.PC[0] + dx, y: d.PC[1] + dy }); seen = -2; }
} }; };
const oven = g => { let held = false; return { tick(T, dt) {
  const d = g.dbg;
  if (!held) { if (d.ready() && d.lock() <= 0 && d.heat() < .05) { held = true; g.down({ x: 400, y: 420 }); } return; }
  if (!d.armed()) { held = false; g.up({ x: 400, y: 420 }); return; }
  const [lo, hi] = d.zone(); if (d.heat() >= (lo + hi) / 2 - .01) { held = false; g.up({ x: 400, y: 420 }); }
} }; };
const both = (a, b) => g => { const A = a(g), B = b(g); return { tick(T, dt) { if (g.dbg.sauceNow()) A.tick(T, dt); else { if (A.reset) A.reset(); B.tick(T, dt); } } }; };
module.exports = { sq_pizza: n => n === 4 ? [dough, sauce, tops, oven] : [dough, both(sauce, tops), oven] };
