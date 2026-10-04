'use strict';
/* bots for du_hose (HOSE & MOP). Role-honest:
   - the HOSE bot reads only its own screen (g.dbg.hoseView(): the stains with the mud my friend reported, my aim, my pressure and
     my friend's mop as it is drawn, ~lag behind). It soaks the stain nearest to the mop, never with the mop's body in the splash,
     and rests the jet when the tank is low. It moves the pointer like a hand (limited speed), not by teleporting.
   - the MOPPER bot reads only its screen (g.dbg.mopView(): which stains shine wet, my mop, whether I'm knocked over). It parks the mop
     on the nearest stain, and scrubs back and forth (drag) as soon as one shines, after a human reaction time. */
const step = (from, to, max) => { const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy); return d <= max ? to.slice() : [from[0] + dx / d * max, from[1] + dy / d * max]; };
module.exports = {
  du_hose: [
    (g) => {
      let ptr = null, held = false, tgt = -1;
      return {
        tick(T, dt) {
          const v = g.dbg.hoseView(); if (!ptr) ptr = v.aim.slice();
          const live = v.stains.filter(s => s.live && s.hp > .03);
          if (!v.mop || !live.length) { if (held) { held = false; g.up({ x: ptr[0], y: ptr[1] }); } return; }
          const [mx, my] = v.mop, bx = mx + g.dbg.BOFF[0], by = my + g.dbg.BOFF[1] - 24;
          const near = live.slice().sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my));
          let s = near.find(q => q.i === tgt && Math.hypot(q.x - mx, q.y - my) < 90) || near[0]; tgt = s.i;
          ptr = step(ptr, [s.x, s.y], 1300 * dt); g.move({ x: ptr[0], y: ptr[1] });
          const onIt = Math.hypot(v.aim[0] - s.x, v.aim[1] - s.y) < 20, safe = Math.hypot(s.x - bx, (s.y - by) / .8) > g.dbg.BODYR + 34;
          const want = onIt && safe && !v.dry && s.wet < .7 && (v.P > .12 || held);
          if (want && !held) { held = true; g.down({ x: ptr[0], y: ptr[1] }); }
          else if (!want && held) { held = false; g.up({ x: ptr[0], y: ptr[1] }); }
        },
      };
    },
    (g) => {
      let ptr = null, wetSeen = -1, since = 0, ph = 0;
      return {
        tick(T, dt) {
          const v = g.dbg.mopView(); if (!ptr) ptr = v.mop.slice();
          if (v.stun) return;
          const live = v.stains.filter(s => s.live);
          if (!live.length) return;
          const [mx, my] = v.mop, wet = live.filter(s => s.wet > .05).sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
          if (wet && wet.i !== wetSeen) { wetSeen = wet.i; since = T; }
          if (wet && T - since > .15) {                                    // reaction time, then go and scrub
            const d = Math.hypot(wet.x - mx, wet.y - my);
            if (d > 30) ptr = step(ptr, [wet.x, wet.y], 1400 * dt);
            else { ph += dt * 24; ptr = [wet.x + Math.sin(ph) * 40, wet.y + Math.cos(ph * .5) * 4]; }
          } else {
            const s = live.sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
            ptr = step(ptr, [s.x - 6, s.y], 1000 * dt);                     // park on the nearest stain and wait for the water
          }
          g.move({ x: ptr[0], y: ptr[1] });
        },
      };
    },
  ],
};
