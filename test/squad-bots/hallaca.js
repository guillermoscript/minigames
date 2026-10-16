'use strict';
/* bots for sq_hallaca (HALLACAS EN FILA). Role-honest: each bot only looks at its own station through g.dbg (is there a hallaca in my hands,
   when is the next beat, which path I must trace and how far I got, which way I must swipe) and drives the public handlers like a hand:
   a human reaction time and a limited pointer speed. DOUGH taps on the beat, STEW / TIE drag along the guide, FOLD presses the lit arrow. */
const step = (from, to, max) => { const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy); return d <= max ? to.slice() : [from[0] + dx / d * max, from[1] + dy / d * max]; };
const masa = g => { let last = -1; return { tick(T, dt) {
  const d = g.dbg; if (!d.ready()) return; const b = d.beatIn(), k = d.beatK();
  if (b <= dt * d.TS * 1.1 && k !== last) { last = k; g.down({ x: 400, y: 430 }); g.up({ x: 400, y: 430 }); }
} }; };
const tracer = g => { let ptr = null, down = false; return { tick(T, dt) {
  const d = g.dbg, p = d.pts(); if (!ptr) ptr = (d.kind === 'guiso' ? d.SNAKES[0][0] : d.CROSS[0][0]).slice();
  if (!p) { if (down) { down = false; g.up({ x: ptr[0], y: ptr[1] }); } return; }
  const N = p.length - 1, u = d.prog();
  const tgt = down ? p[Math.min(N, Math.round((u + .06) * N))] : p[0];
  ptr = step(ptr, tgt, 560 * dt * d.TS); g.move({ x: ptr[0], y: ptr[1] });
  if (!down && Math.hypot(ptr[0] - p[0][0], ptr[1] - p[0][1]) < 12) { down = true; g.down({ x: ptr[0], y: ptr[1] }); }
} }; };
const tapar = g => { let at = -9; return { tick(T) {
  const dir = g.dbg.fold(); if (!dir || T - at < .14) return; at = T;
  const code = dir < 0 ? 'ArrowLeft' : 'ArrowRight'; g.key({ code }); g.keyup({ code });
} }; };
module.exports = { sq_hallaca: n => n === 4 ? [masa, tracer, tapar, tracer] : [masa, tracer, tracer] };
