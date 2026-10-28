'use strict';
/* bots for sq_velas (CANDLE CIRCLE). Role-honest: a bot only uses what its own cone shows (g.dbg.view()), its own corner, the table and the
   power meter. Item roles sweep a fan around their corner (away from the table) until the item is lit, hold the beam on it, carry it to the
   table bending around any floor junk the cone shows, then park the beam on the table to scare the cockroach. With 3 seats they tap the
   dynamo when the power is low. The generator (seat 3 of 4) mashes at ~4.5 taps/s. */
const bot = (g, role) => {
  let tapAt = -9, wp = null; const passed = new Set();
  return {
    tick(T) {
      const v = g.dbg.view();
      if (role === 3) { if (T - tapAt >= .22) { tapAt = T; g.tap(); } return; }
      if (v.n === 3 && v.P < .5 && T - tapAt >= .3) { tapAt = T; g.tap(); }
      const [tx, ty] = v.table;
      if (v.st === 2) { g.aim(tx, ty + 36); return; }
      if (v.st === 0) {
        wp = null; passed.clear();
        if (v.itemSeen) { g.aim(v.ix, v.iy); return; }
        const out = Math.atan2(v.home[1] - ty, v.home[0] - tx), a = out + 1.3 * Math.sin(T * 1.9), r = 75 + 40 * Math.sin(T * .8 + 1);
        g.aim(v.home[0] + Math.cos(a) * r, v.home[1] + Math.sin(a) * r); return;
      }
      // carrying: straight to the table, bending around junk that is on the way
      const dx = tx - v.bx, dy = ty - v.by, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      if (wp && Math.hypot(wp.x - v.bx, wp.y - v.by) < 20) { passed.add(wp.key); wp = null; }
      if (!wp) {
        let best = null;
        for (const [hx, hy] of v.haz) {
          const key = Math.round(hx) + ',' + Math.round(hy); if (passed.has(key)) continue;
          const px = hx - v.bx, py = hy - v.by, along = px * ux + py * uy, off = -px * uy + py * ux;
          if (along > -10 && along < l && Math.abs(off) < 52 && (!best || along < best.along)) best = { hx, hy, along, off, key };
        }
        if (best) {                                        // two ways round: take the one that keeps farther from any other junk in sight
          const cand = [1, -1].map(side => ({ x: Math.max(30, Math.min(770, best.hx - uy * side * 64)), y: Math.max(80, Math.min(540, best.hy + ux * side * 64)), key: best.key }));
          const score = c => Math.min(...v.haz.filter(([hx, hy]) => Math.round(hx) + ',' + Math.round(hy) !== best.key).map(([hx, hy]) => Math.hypot(hx - c.x, hy - c.y)), 999);
          const pick = score(cand[0]) >= score(cand[1]) ? cand[0] : cand[1];
          wp = Math.abs(score(cand[0]) - score(cand[1])) < 8 ? cand[best.off >= 0 ? 0 : 1] : pick;
        }
      }
      g.aim(wp ? wp.x : tx, wp ? wp.y : ty);
    },
  };
};
module.exports = { sq_velas: n => Array.from({ length: n }, () => bot) };
