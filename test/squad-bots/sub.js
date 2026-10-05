'use strict';
/* bots for sq_sub (SUB CREW). Role-honest: each reads only what its own screen shows (g.dbg.*View()).
   - PILOT: heads for the lane whose next visible danger is farthest away (flagged ones and those inside the sonar), after a reaction delay.
   - SCOPE: flags every danger as soon as it is within view (lane by lane, one tap each).
   - TORPEDO: fires at flagged GIANT puffers (the ones nobody can dodge) as soon as the tube is loaded.
   - ENGINE: shovels whenever the reactor is below the middle of the green band.
   - STOKER (3 seats): both jobs. */
const flagger = g => {
  let last = -9;
  return T => {
    if (T - last < .15) return;
    const v = g.dbg.scopeView(), open = v.hz.filter(z => !z.flag && z.dx > 150), h = open.filter(z => z.dx > 200 && z.dx < 600).sort((a, b) => a.dx - b.dx)[0]; if (!h) return;
    for (const l of h.mask) { const near = open.filter(z => z.mask.includes(l)).sort((a, b) => a.dx - b.dx)[0]; if (near.i === h.i) { last = T; g.flag(l); return; } }   // a lane where this danger is the next one
  };
};
const gunner = g => {
  let last = -9;
  return T => {
    const v = g.dbg.torView(); if (v.reload > 0 || T - last < .3) return;
    const big = v.hz.filter(z => z.dx > 200 && z.dx < 640 && z.kind === 3).sort((a, b) => a.dx - b.dx)[0]; if (!big) return;
    for (const l of [0, 1, 2]) {                                       // a lane where the giant is the nearest flagged danger (the torpedo locks onto the nearest one)
      const near = v.hz.filter(z => z.mask.includes(l) && z.dx > 150).sort((a, b) => a.dx - b.dx)[0];
      if (near && near.i === big.i) { last = T; g.fire(l); return; }
    }
  };
};
const stoker = g => {
  let acc = 0;
  return (T, dt) => { const v = g.dbg.engView(); acc += dt; if (v.temp < (v.LO + v.HI) / 2 && acc >= .12) { acc = 0; g.shovel(); } };
};
module.exports = {
  sq_sub: n => {
    const pilot = g => {
      let tgt = 1, since = 0;
      if (process.env.SQDBG) g.dbgLog = m => console.log('LOSE', m, g.dbg.HZ.map(h => h.kind + '@' + Math.round(h.p) + 'L' + h.mask.join('') + (h.dead ? 'x' : '') + (h.hit ? 'h' : '')).join(' '));
      return {
        tick(T, dt) {
          const v = g.dbg.pilotView(), clear = l => { let d = 9999; for (const h of v.hz) if (h.mask.includes(l) && h.dx > -h.w - 62) d = Math.min(d, h.dx); return d; };
          let best = Math.round(v.tgt), bd = clear(best);
          for (const l of [0, 1, 2]) { const d = clear(l) - Math.abs(l - v.lane) * 18; if (d > bd + 40) { best = l; bd = d; } }
          if (best !== tgt) { if (since === 0) since = T; if (T - since > .1) { tgt = best; g.setLane(best); since = 0; } } else since = 0;
        },
      };
    };
    const scope = g => { const f = flagger(g); return { tick(T) { f(T); } }; };
    if (n === 4) return [
      pilot,
      scope,
      g => { const f = gunner(g); return { tick(T) { f(T); } }; },
      g => { const f = stoker(g); return { tick(T, dt) { f(T, dt); } }; },
    ];
    return [pilot, scope, g => { const a = gunner(g), b = stoker(g); return { tick(T, dt) { a(T); b(T, dt); } }; }];
  },
};
