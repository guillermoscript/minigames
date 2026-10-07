'use strict';
/* bots for sq_storm (STORM SHIP). Role-honest: each reads only what its own screen shows (g.dbg.*View()), acts through the public handlers
   (down/move/up on the wheel, the rope, the plate) with a ~0.15 s reaction and a limited pointer speed.
   - HELM: steers toward the first flag it can see (the lookout's), turning the wheel by circling the pointer (max ~5.5 rad/s).
   - LOOKOUT: plants a flag in the middle of the next gap as soon as a row shows up; rings the bell ~1.4 s before each big wave.
   - SAILS: keeps the rope in the middle of the green zone, switching to the preview zone when it lights up.
   - BAILER: taps ~7/s while there is water. DECK (3 seats): rope + bucket.
   - Everybody except the lookout: holds the BRACE plate while the bell alert is on their screen. */
const RT = +process.env.SQR || .15, PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkBrace = g => {
  const st = { since: -1, held: false };
  return T => {
    const v = g.dbg.braceView();
    if (v.alert) { if (st.since < 0) st.since = T; if (!st.held && T - st.since >= RT) { g.up({ x: 1, y: 1 }); g.down({ x: 400, y: 505 }); st.held = true; } }
    else { st.since = -1; if (st.held) { g.up({ x: 1, y: 1 }); st.held = false; } }
    return st.held;
  };
};
const helm = g => {
  const brace = mkBrace(g); let down = false, ang = 0, tgt = 0, every = -9, ROT = 5.5;
  return {
    tick(T, dt) {
      if (brace(T)) { down = false; return; }
      const v = g.dbg.helmView();
      if (T - every >= RT) { every = T; const w = v.wps[0]; const e = w ? w.x - v.x : 0; tgt = clamp(e / 150 - v.hd * .35, -1, 1) * PI; }
      if (!down) { ang = Math.atan2(0, 1); g.down({ x: v.WX + 60 * Math.cos(ang), y: v.WY + 60 * Math.sin(ang) }); down = true; }
      const step = clamp(tgt - v.a, -ROT * dt, ROT * dt); ang += step; g.move({ x: v.WX + 60 * Math.cos(ang), y: v.WY + 60 * Math.sin(ang) });
    },
  };
};
const lookout = () => g => {
  let last = -9; const rung = {}; let seenAt = -1, jit = 0;
  return {
    tick(T) {
      const v = g.dbg.lookView();
      if (v.waveIn !== null && v.waveIn <= 1.5 && !rung[v.wavek]) { if (seenAt < 0) seenAt = T; if (T - seenAt >= RT) { rung[v.wavek] = 1; seenAt = -1; g.down({ x: 400, y: 505 }); g.up({ x: 400, y: 505 }); } }
      if (T - last < .3) return;
      const r = v.rows.filter(q => !q.set && q.dp > 40).sort((a, b) => a.dp - b.dp)[0]; if (!r) return;
      last = T; jit = ((r.i * 37) % 21) - 10; g.down({ x: r.cs + jit, y: g.dbg.SHIPY - r.dp * .58 }); g.up({ x: 1, y: 1 });
    },
  };
};
const sailsCore = g => {
  let down = false, tgt = .5, every = -9;
  return (T, dt, braced) => {
    if (braced) { down = false; return; }
    const v = g.dbg.sailsView();
    if (T - every >= RT) { every = T; tgt = v.left < .5 ? v.next : v.opt; }
    const y = t => v.ROPE_Y0 + (v.ROPE_Y1 - v.ROPE_Y0) * t;
    if (!down) { g.down({ x: v.ROPE_X, y: y(v.trim) }); down = true; }
    const nx = v.trim + clamp(tgt - v.trim, -1.4 * dt, 1.4 * dt); g.move({ x: v.ROPE_X, y: y(nx) });
  };
};
const bailCore = g => { let last = -9; return T => { if (g.dbg.bailView().wl > .1 && T - last >= .14) { last = T; g.down({ x: 380, y: 300 }); } }; };
module.exports = {
  sq_storm: n => {
    const sails = g => { const brace = mkBrace(g), core = sailsCore(g); return { tick(T, dt) { core(T, dt, brace(T)); } }; };
    const bail = g => { const brace = mkBrace(g), core = bailCore(g); return { tick(T) { if (!brace(T)) core(T); } }; };
    const deck = g => { const brace = mkBrace(g), a = sailsCore(g), b = bailCore(g); return { tick(T, dt) { const h = brace(T); a(T, dt, h); if (!h) b(T); } }; };
    return n === 4 ? [helm, lookout(), sails, bail] : [helm, lookout(), deck];
  },
};
