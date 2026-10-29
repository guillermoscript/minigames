'use strict';
/* bots for sq_bolas (BOLAS CRIOLLAS). Role-honest: each one reads only what its own screen shows (g.dbg.view()) and drives the public handlers.
   - MEDIDOR (0): after a ball stopped, looks at how far it is from the boliche and presses "más cerca" (key 2) / "más lejos" (key 1) after a short reaction.
   - LANZADOR (1): blind to the boliche. Starts with a guess, then corrects the power by the arrows of the Medidor's last call. Holds (public down) until HIS gauge
                   reaches the target and lets go (public up).
   - APUNTADOR (2): sees the boliche and the throw line, slides the slider (public down/up) to the angle that points at it.
   - DESPEJADOR (3): taps the dog / the leaf whenever it sees them on the way. */
const ARROW = 45, DSPAN = 290;
const medidor = (g, role) => {
  let key = '', since = 0;
  return {
    tick(T, dt) {
      const v = g.dbg.view(); if (!v.pending) { key = ''; return; }
      const k = v.k + ':' + v.pending; if (k !== key) { key = k; since = T; }
      if (T - since < .25) return;
      const e = { code: v.along > 0 ? 'Digit2' : 'Digit1' }; g.key(e); g.keyup(e);
    },
  };
};
const lanzador = (g, role) => {
  let target = .62, seenK = -1, readyAt = -1;
  return {
    tick(T, dt) {
      const v = g.dbg.view();
      if (v.fb && v.fb.k !== seenK) { seenK = v.fb.k; target = Math.max(.05, Math.min(1, target + v.fb.dir * (v.fb.lvl - .5) * ARROW / DSPAN)); }
      if (v.holding) { if (v.meter >= target) g.up({ x: 400, y: 560 }); return; }
      const ready = v.k === 0 || (v.fb && v.fb.k === v.k - 1);
      if (!ready || v.locked) { readyAt = -1; return; }
      if (readyAt < 0) readyAt = T; if (T - readyAt < .2 || T < .5) return;
      g.down({ x: 400, y: 560 });
    },
  };
};
const apuntador = (g, role) => {
  return {
    tick(T, dt) {
      if (T < .2) return; const v = g.dbg.view(), want = Math.atan2(v.bx - v.sx, v.sy - v.by) * 180 / Math.PI;
      if (Math.abs(v.ang - want) > .15) { const p = { x: 400 + want / 45 * 240, y: 560 }; g.down(p); g.up(p); }
    },
  };
};
const despejador = (g, role) => {
  let dogT = -9, leafT = -9;
  return {
    tick(T, dt) {
      const v = g.dbg.view();
      if ((v.dog.on || v.dog.left < 2) && T - dogT > .4) { dogT = T; g.down({ x: v.dog.x, y: v.dog.y }); g.up({ x: v.dog.x, y: v.dog.y }); }
      if ((v.leaf.on || v.leaf.left < 2) && T - leafT > .4) { leafT = T; g.down({ x: v.leaf.x, y: v.leaf.y }); g.up({ x: v.leaf.x, y: v.leaf.y }); }
    },
  };
};
module.exports = { sq_bolas: n => [medidor, lanzador, apuntador, despejador].slice(0, n) };
