'use strict';
/* bots for sq_carro (CARRO DE EMPUJE). Role-honest: each reads only what its own screen shows (g.dbg.view()) and drives the public handlers.
   - VOLANTE (0): sees the obstacles ahead (distance, lane, kind) and his own lane. Steps to a lane that is free of the next obstacles (one key press every ~0.2 s).
   - EMPUJADOR (1): sees the beat clock of his ring and taps (public down) when it reaches the beat.
   - CLUTCH (2): presses the pedal, then lets go (public up) when the lamp is green AND his needle is well inside the green band.
   - CORREDOR (3): alternates left / right taps (A / D) all the time; jumps (Space) as soon as he sees the engine running. */
const volante = (g, role) => {
  let last = -9;
  return {
    tick(T) {
      const v = g.dbg.view(); if (!v.hz || T - last < .2) return;
      const ahead = v.hz.filter(h => !h.done && h.p - v.pos < .2);
      if (!ahead.length) return;
      const near = ahead.filter(h => h.p - v.pos < .16), set = new Set((near.length ? near : ahead).map(h => h.lane));
      let want = v.lane;
      if (set.has(v.lane)) {                                    // move to the closest lane that is not taken by the next obstacles
        const free = [-1, 0, 1].filter(l => !set.has(l)).sort((a, b) => Math.abs(a - v.lane) - Math.abs(b - v.lane));
        if (free.length) want = free[0];
      } else if (ahead.length > near.length) {                  // nothing right now: pre-position away from the one after
        const nx = ahead.find(h => !near.includes(h)); if (nx && nx.lane === v.lane) want = [-1, 0, 1].filter(l => l !== nx.lane && !set.has(l)).sort((a, b) => Math.abs(a - v.lane) - Math.abs(b - v.lane))[0] ?? v.lane;
      }
      if (want !== v.lane) { last = T; const e = { code: want < v.lane ? 'KeyA' : 'KeyD' }; g.key(e); g.keyup(e); }
    },
  };
};
const empujador = (g, role) => ({
  tick(T) {
    if (T < .05) return; const v = g.dbg.view(), d = Math.min(v.ph, v.beat - v.ph);
    if (!v.lock && d < .05) { g.down({ x: 400, y: 492 }); g.up({ x: 400, y: 492 }); }
  },
});
const clutch = (g, role) => ({
  tick(T) {
    if (T < .05) return; const v = g.dbg.view();
    if (!v.pressed) { if (!v.lock) g.down({ x: 150, y: 500 }); return; }
    if (v.ready && v.needle > v.win[0] + .05 && v.needle < v.win[1] - .05) g.up({ x: 150, y: 500 });
  },
});
const corredor = (g, role) => {
  let last = -9, side = 0, jt = -9;
  return {
    tick(T) {
      const v = g.dbg.view();
      if (T - last >= .11) { last = T; side ^= 1; const e = { code: side ? 'KeyA' : 'KeyD' }; g.key(e); g.keyup(e); }
      if (v.phase >= 1 && !v.jumped && T - jt > .3) { jt = T; const e = { code: 'Space' }; g.key(e); g.keyup(e); }
    },
  };
};
module.exports = { sq_carro: n => [volante, empujador, clutch, corredor].slice(0, n) };
