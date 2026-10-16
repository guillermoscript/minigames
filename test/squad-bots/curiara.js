'use strict';
/* bots for sq_curiara (CURIARA EN EL CAÑO). Role-honest: the guide steers with the tiller (public down/move) towards the gap between the two hazards of the next
   row, using only what the guide sees (hazards ahead, his own heading); the oarsmen hold and let go when THEIR OWN gauge reaches the green band (a little
   jitter per seat, so the oars never pull exactly the same); the bailer taps when HIS leak meter is over a level. With 3 seats the guide bails too. */
const jit = r => [0, -.05, .06, 0][r];
const guide = (g, role) => {
  let down = false, bailT = -9;
  return {
    tick(T, dt) {
      const v = g.dbg.view(); if (!v.hz) return;
      const ahead = v.hz.filter(q => q.y > v.y - 55).sort((a, b) => a.y - b.y);
      const zone = rowQ => { const row = rowQ.sort((a, b) => a.x - b.x); const sw = q => q.kind === 1 ? 18 : q.kind === 2 ? 10 : 0;
        return [row[0].x + row[0].r + 19 + 6 + sw(row[0]), row[1].x - row[1].r - 19 - 6 - sw(row[1])]; };
      let tx = v.x;
      if (ahead.length >= 2 && ahead.filter(q => Math.abs(q.y - ahead[0].y) < 20).length === 2) {
        const A = ahead.filter(q => Math.abs(q.y - ahead[0].y) < 20), rest = ahead.filter(q => q.y > ahead[0].y + 50), B = rest.length ? rest.filter(q => Math.abs(q.y - rest[0].y) < 20) : [];
        const [la, ha] = zone(A), mid = B.length === 2 ? (zone(B)[0] + zone(B)[1]) / 2 : (la + ha) / 2;
        tx = la < ha ? Math.max(la + 4, Math.min(ha - 4, mid)) : (la + ha) / 2;
      }
      const dh = Math.atan2(tx - v.x, 90), want = Math.max(-.8, Math.min(.8, dh)), rud = Math.max(-1, Math.min(1, (want - v.h) * 3 + want * .9));
      const p = { x: (g.roles.length === 3 ? 300 : 400) + rud * 200, y: 500 };
      if (!down) { down = true; g.down(p); } else g.move(p);
      if (g.dbg.view().water !== undefined && v.water > .5 && T - bailT > .3 && g.roles && g.roles.length === 3) { bailT = T; const e = { code: 'Space' }; g.key(e); g.keyup(e); }
    },
  };
};
const rower = (g, role) => {
  let was = false;
  return {
    tick(T, dt) {
      const v = g.dbg.view();
      if (!v.pull && !v.lock && !was && T > .05) { was = true; g.down({ x: 400, y: 500 }); }
      else if (v.pull && v.c >= .74 + jit(role)) { was = false; g.up({ x: 400, y: 500 }); }
    },
  };
};
const bailer = (g, role) => {
  let last = -9;
  return {
    tick(T, dt) { const v = g.dbg.view(); if (v.water > .42 && T - last > .16) { last = T; g.down({ x: 400, y: 520 }); g.up({ x: 400, y: 520 }); } },
  };
};
module.exports = { sq_curiara: n => [guide, rower, rower, bailer].slice(0, n) };
