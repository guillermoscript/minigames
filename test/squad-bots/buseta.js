'use strict';
/* bots for sq_buseta (LA BUSETA). Role-honest: each reads only what its own screen shows (g.dbg.*View()) and drives the public handlers.
   - DRIVER: heads for the lane whose next visible hazard (flagged ones and those inside the smog radius) is farthest away, after a reaction delay;
             slows down for flagged bumps / the cop, stops at called bus stops and waits until every passenger there is resolved.
   - LOOKOUT: flags every hazard as soon as it is within view (lane by lane, one tap each).
   - CONDUCTOR: rings the bell as soon as a stop is in view, charges every ready passenger after a human reaction time.
   - DOOR HELPER: holds the door while the bus is still and there are passengers left to board. */
const REACT = .16;
const driver = g => {
  let tgt = 1, since = 0, brake = false;
  return {
    tick(T, dt) {
      const d = g.dbg, v = d.drvView(), SPD = d.SPD, DEC = d.DEC;
      const clear = l => { let m = 9999; for (const h of v.hz) if (h.kind < 2 && h.mask.includes(l)) m = Math.min(m, h.dx - d.WIN[h.kind]); return m; };
      let best = Math.round(v.tgt), bd = clear(best);
      for (const l of [0, 1, 2]) { const c = clear(l) - Math.abs(l - v.lane) * 20; if (c > bd + 40) { best = l; bd = c; } }
      if (best !== tgt) { if (since === 0) since = T; if (T - since > .1) { tgt = best; g.setLane(best); since = 0; } } else since = 0;
      let want = false;
      for (const h of v.hz) if (h.kind >= 2) {
        const tv = d.THR[h.kind] - .14, need = v.v > tv ? SPD * (v.v * v.v - tv * tv) / (2 * DEC) : 0;
        if (h.dx > -d.WIN[h.kind] - 8 && h.dx - d.WIN[h.kind] <= need + 28 && v.v > tv - .02) want = true;
      }
      const s = v.st.filter(z => z.done < z.m).sort((a, b) => a.dx - b.dx)[0];
      if (s) {
        if (Math.abs(s.dx) <= d.ZH) { if (v.v > .04 || s.done < s.m) want = true; }
        else if (s.dx > 0) { const need = SPD * v.v * v.v / (2 * DEC); if (s.dx - 60 <= need + 12) want = true; }
      }
      if (want !== brake) { brake = want; g.brake(want); }
    },
  };
};
const lookout = g => {
  let last = -9;
  return {
    tick(T) {
      if (T - last < .15) return;
      const v = g.dbg.lookView(), open = v.hz, h = open.filter(z => z.dx < g.dbg.RANGE - 40).sort((a, b) => a.dx - b.dx)[0]; if (!h) return;
      for (const l of h.mask) { const near = open.filter(z => z.mask.includes(l)).sort((a, b) => a.dx - b.dx)[0]; if (near.i === h.i) { last = T; g.flag(l); return; } }
    },
  };
};
const conductor = g => {
  let last = -9, seen = -1, seenAt = 0;
  return {
    tick(T) {
      const v = g.dbg.cobView();
      const st = v.stops.filter(z => z.dx < g.dbg.RANGE - 40).sort((a, b) => a.dx - b.dx)[0];
      if (st) { if (seen !== st.k) { seen = st.k; seenAt = T; } if (T - seenAt >= REACT && T - last > .15) { last = T; g.call(); return; } } else seen = -1;
      const r = v.ready.filter(z => z.age >= REACT).sort((a, b) => b.age - a.age)[0];
      if (r && T - last > .12) { last = T; g.down({ x: r.x, y: r.y }); g.up({ x: r.x, y: r.y }); }
    },
  };
};
const door = g => {
  let held = false;
  return {
    tick() {
      const v = g.dbg.doorView(), want = v.still && v.pending;
      if (want && !held) { held = true; g.down({ x: 400, y: 300 }); } else if (!want && held) { held = false; g.up({ x: 400, y: 300 }); }
    },
  };
};
const both = (a, b) => g => { const A = a(g), B = b(g); return { tick(T, dt) { A.tick(T, dt); B.tick(T, dt); } }; };
module.exports = { sq_buseta: n => n === 4 ? [driver, lookout, conductor, door] : [driver, lookout, conductor] };
