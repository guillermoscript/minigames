'use strict';
/* bots for du_squeegee (SQUIRT & WIPE). Role-honest:
   - the WIPER bot reads only its own screen (g.dbg.wiperView(): my arm, the gunk that is still on the glass and how much each
     one SHINES, i.e. is wet). It never sees how thick a gunk is. It waits (about 0.15 s of reaction time) until some gunk shines,
     then swings the arm back and forth over it (and over any other shiny gunk next to it), and holds still while the glass is dry.
     It turns the dial like a hand: the pointer circles the hub at limited angular speed.
   - the SPRAYER bot reads only its screen (g.dbg.sprayerView(): the gunk with its thickness ring, my aim and jug, the wiper arm
     as drawn ~0.3 s late). It picks the thickest gunk near the arm, squirts it until it is clean (or it has had its turn), rests
     the jet when the jug is low, and moves the pointer at a human speed. */
const step = (from, to, max) => { const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy); return d <= max ? to.slice() : [from[0] + dx / d * max, from[1] + dy / d * max]; };
module.exports = {
  du_squeegee: [
    (g) => {
      let ang = null, dir = 1, seen = {}, goal = null, T0 = 0;
      return {
        tick(T, dt) {
          const v = g.dbg.wiperView(); if (ang === null) { ang = v.th; goal = v.th; }
          const wet = [];
          for (const b of v.blobs) { if (!b.live) { delete seen[b.i]; continue; } if (b.wet > .3) { if (seen[b.i] === undefined) seen[b.i] = T; if (T - seen[b.i] > .15) wet.push(b); } else delete seen[b.i]; }
          if (wet.length) {
            wet.sort((p, q) => q.wet - p.wet);
            const lead = wet[0], grp = wet.filter(b => Math.abs(b.a - lead.a) < .9);
            const hw = b => Math.asin(Math.min(.98, b.r * .8 / b.d)) + .06;
            const lo = Math.min(...grp.map(b => b.a - hw(b))), hi = Math.max(...grp.map(b => b.a + hw(b)));
            if (ang <= lo + .03) dir = 1; else if (ang >= hi - .03) dir = -1;
            if (v.th < lo - .5 || v.th > hi + .5) dir = v.th < lo ? 1 : -1;
            goal = dir > 0 ? hi : lo;
          } else goal = ang;
          const d = goal - ang; ang += Math.max(-1, Math.min(1, d / (5.2 * dt))) * Math.min(Math.abs(d), 5.2 * dt);
          g.move({ x: v.PX + Math.cos(ang) * 210, y: v.PY + Math.sin(ang) * 210 });
        },
      };
    },
    (g) => {
      let ptr = null, held = false, tgt = -1, t0 = 0;
      return {
        tick(T, dt) {
          const v = g.dbg.sprayerView(); if (!ptr) ptr = v.aim.slice();
          const open = v.blobs.filter(b => b.live && b.hp > .05);
          if (!open.length) { if (held) { held = false; g.up({ x: ptr[0], y: ptr[1] }); } return; }
          let s = open.find(b => b.i === tgt);
          if (!s || T - t0 > 2.4) { s = open.slice().sort((p, q) => (q.hp - Math.abs(q.a - v.arm) * .35) - (p.hp - Math.abs(p.a - v.arm) * .35))[0]; if (s.i !== tgt) { tgt = s.i; t0 = T; } else t0 = T; }
          ptr = step(ptr, [s.x, s.y], 1300 * dt); g.move({ x: ptr[0], y: ptr[1] });
          const onIt = Math.hypot(v.aim[0] - s.x, v.aim[1] - s.y) < 22;
          const want = onIt && !v.dry && (v.P > .1 || held) && (s.wet < .95);
          if (want && !held) { held = true; g.down({ x: ptr[0], y: ptr[1] }); }
          else if (!want && held) { held = false; g.up({ x: ptr[0], y: ptr[1] }); }
        },
      };
    },
  ],
};
