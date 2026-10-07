'use strict';
/* bots for du_frog (LAZY FROG). Role-honest:
   - the SPINNER bot reads only what its screen shows (g.dbg.spinView(): the bugs on its own pad, the pad speed, the glowing marker the
     frog's eyes make = aim angle + colour, and whether the tongue is out). It holds the pad with a "pointer" going round the pad at a limited
     speed, brings the fly nearest to the marker under it, and keeps the pad still while the tongue is out or the marker turns red.
   - the TONGUE bot reads only its screen (g.dbg.tongView(): the real bugs, its own aim, its tired tongue). It waits for a fly near the middle
     of the arc, aims at where the fly will be when the tongue lands, and flicks after a human reaction time if no ladybug is on the line. */
const PI = Math.PI, TAU = PI * 2, wrap = a => { a %= TAU; if (a > PI) a -= TAU; else if (a < -PI) a += TAU; return a; };
const CX = 400, CY = 290, SQ = .66, AC = PI / 2, AH = .96, HW = 27;
const at = (r, a) => ({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) * SQ });
module.exports = {
  du_frog: [
    (g) => {
      let ptr = 0, held = false, seen = {}, ban = {}, still = 0, last = -1;
      return {
        tick(T, dt) {
          const v = g.dbg.spinView();
          if (v.out) { still = 0; return; }                                       // the tongue is out: keep the pad still (the pointer, if held, does not move)
          const cand = v.items.filter(q => q.type !== 2 && q.t === 0 && !(ban[q.i] > T));
          for (const q of cand) if (seen[q.i] === undefined) seen[q.i] = T;
          const ready = cand.filter(q => T - seen[q.i] > .15);
          if (!ready.length) return;
          if (v.gate === 3 && last >= 0) { ban[last] = T + 1.6; last = -1; }      // red glow: a ladybug is in front, move on to another fly
          ready.sort((a, b) => Math.abs(wrap(v.aim - a.a)) - Math.abs(wrap(v.aim - b.a)));
          const q = ready[0]; last = q.i;
          const d = wrap(v.aim - q.a);
          if (!held) { held = true; ptr = 0; const p = at(150, ptr); g.down(p); }
          const want = Math.max(-3.4, Math.min(3.4, d * 7)), stepA = Math.abs(d) < .03 ? 0 : want * dt;
          ptr += stepA; const p = at(150, ptr); g.move(p);
          if (Math.abs(d) < .05) { still += dt; if (still > 1.1) { ban[q.i] = T + 1.6; still = 0; } } else still = 0;
        },
      };
    },
    (g) => {
      let ptr = null, seen = {}, react = 0;
      return {
        tick(T, dt) {
          const v = g.dbg.tongView(); if (ptr === null) ptr = v.aim; if (process.env.FROGLOG && v.pts >= v.need && !g._lg) { g._lg = 1; console.log('win at', T.toFixed(2), 'strikes', v.strikes); }
          const good = v.items.filter(q => q.type !== 2 && q.t === 0), pred = q => q.a + v.w * .22;
          for (const q of good) if (seen[q.i] === undefined) seen[q.i] = T;
          // the fly nearest to the middle of the arc (gold first when it is close enough)
          const near = good.filter(q => T - seen[q.i] > .15 && Math.abs(wrap(pred(q) - AC)) < AH + .1).sort((a, b) => Math.abs(wrap(pred(a) - AC)) - Math.abs(wrap(pred(b) - AC)));
          const tgt = near[0];
          let want = AC;
          if (tgt) want = Math.max(AC - AH, Math.min(AC + AH, AC + wrap(pred(tgt) - AC)));
          const dd = wrap(want - ptr), st = Math.max(-7 * dt, Math.min(7 * dt, dd)); ptr += st;
          const p = at(200, ptr); g.move(p);
          if (!tgt || v.cd > 0 || v.busy || Math.abs(v.w) > 1.2) { react = 0; return; }
          // would the tongue land on it? (perpendicular distance of the predicted spot from my line) and is a ladybug in the way?
          const hit = q => { const a = pred(q) , px = q.r * Math.cos(a), py = q.r * Math.sin(a), ux = Math.cos(ptr), uy = Math.sin(ptr); return { along: px * ux + py * uy, perp: Math.abs(px * uy - py * ux) }; };
          const h = hit(tgt); if (h.perp > 11 || h.along < 66 || h.along > 188) { react = 0; return; }
          const bad = v.items.some(q => q.type === 2 && q.t < .5 && (() => { const k = hit(q); return k.perp < HW + 9 && k.along > 50 && k.along < h.along + 20; })());
          if (bad) { react = 0; return; }
          react += dt; if (react > .15) { react = 0; g.down(p); }
        },
      };
    },
  ],
};
