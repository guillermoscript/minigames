'use strict';
/* bots for du_lighthouse (LIGHTHOUSE KEEPER). Role-honest:
   - the KEEPER bot only reads what its chart shows (g.dbg.keyView(): every rock as a blob, the boat dot, the lamp angle). It plans the
     gap the boat should follow (a tiny path search over the rows ahead of the dot) and swings the lamp to light that path a little way
     ahead, by moving the pointer round the lamp (the pointer turns at most ~3.2 rad/s, acting on what it saw ~150 ms ago).
   - the CAPTAIN bot only reads what its fogged screen shows (g.dbg.capView(): the rocks lit now or still fading as ghosts, the beam
     angle it sees, its own boat, the harbour beacons). It plans through the rocks it can see, treating the dark (unlit) rows as
     uncertain (a cost), and slides the pointer along that path (~150 ms behind the screen, at a limited pointer speed). */
const R = 15, TURN = 3.2, PSPD = 520, STEP = 18, N = 20, BIN = 10;
/* cheapest way up the sea from x0: rows every STEP px ahead, sideways moves of up to ~2 px per px of sailing (the boat is slower than that) */
function plan(D, rocks, x0, unknown) {
  const nb = Math.round((D.LMAX - D.LMIN) / BIN) + 1, xb = j => D.LMIN + j * BIN, INF = 1e9, MAXJ = 3;
  let cost = Array(nb).fill(INF); const j0 = Math.max(0, Math.min(nb - 1, Math.round((x0 - D.LMIN) / BIN))); cost[j0] = 0;
  const par = [];
  for (let i = 1; i <= N; i++) {
    const y = D.BY - i * STEP, nc = Array(nb).fill(INF), pr = Array(nb).fill(-1);
    for (let j = 0; j < nb; j++) {
      const x = xb(j); if (rocks.some(o => Math.hypot(o.x - x, o.y - y) < o.r + R + 10)) continue;
      const u = unknown ? unknown(x, y) : 0;
      for (let k = Math.max(0, j - MAXJ); k <= Math.min(nb - 1, j + MAXJ); k++) { if (cost[k] >= INF) continue; const c = cost[k] + Math.abs(j - k) * .03 + u; if (c < nc[j]) { nc[j] = c; pr[j] = k; } }
    }
    if (nc.every(c => c >= INF)) { par.length = i - 1; break; }
    par.push(pr); cost = nc;
  }
  const rows = par.length; if (!rows) return [x0];
  let j = 0, bc = INF; for (let q = 0; q < nb; q++) if (cost[q] < bc) { bc = cost[q]; j = q; }
  const path = []; for (let i = rows - 1; i >= 0; i--) { path[i + 1] = xb(j); j = par[i][j]; } path[0] = x0;
  return path;
}
module.exports = {
  du_lighthouse: [
    (g, role, { every }) => {
      const st = {}, st2 = {}, seen = []; let pa = null, path = null;
      return {
        tick(T, dt) {
          const D = g.dbg;
          if (every(T, st, .05)) seen.push({ T, v: D.keyView() });
          while (seen.length > 1 && seen[1].T <= T - .15) seen.shift();
          if (!seen.length || seen[0].T > T - .15) return;
          const v = seen[0].v; if (every(T, st2, 1 / 12) || !path) path = plan(D, v.rocks, v.boat[0], null); const i = Math.min(path.length - 1, 7);
          const want = Math.atan2(D.BY - i * STEP - D.LY, path[i] - D.LX);
          if (pa === null) { pa = v.th; g.down({ x: D.LX + Math.cos(pa) * 150, y: D.LY + Math.sin(pa) * 150 }); }
          const d = Math.max(-TURN * dt, Math.min(TURN * dt, want - pa)); pa += d;
          g.move({ x: D.LX + Math.cos(pa) * 150, y: D.LY + Math.sin(pa) * 150 });
        },
      };
    },
    (g, role, { every }) => {
      const st = {}, st2 = {}, seen = []; let px = 470, path = null;
      return {
        tick(T, dt) {
          const D = g.dbg;
          if (every(T, st, .05)) seen.push({ T, v: D.capView() });
          while (seen.length > 1 && seen[1].T <= T - .15) seen.shift();
          if (!seen.length || seen[0].T > T - .15) return;
          const v = seen[0].v, unlit = (x, y) => Math.abs(Math.atan2(y - D.LY, x - D.LX) - v.th) < D.HALF * .95 ? 0 : .03;
          if (every(T, st2, 1 / 12) || !path) path = plan(D, v.rocks, v.boat[0], unlit); const goal = path[Math.min(path.length - 1, 4)];
          px += Math.max(-PSPD * dt, Math.min(PSPD * dt, goal - px)); g.move({ x: px });
        },
      };
    },
  ],
};
