'use strict';
/* bots for du_bridge (PLANK & NAIL). Role-honest:
   - the CARRIER bot reads only its own screen (g.dbg.carView(): its basket and swing, the planks as the judge last reported them, the
     ghost landing it draws, whether the hook is locked). It slides the pointer (limited speed) over the next empty gap, waits for the
     swing to settle and for the ghost to turn green, then lets go after a human reaction time.
   - the HAMMERER bot reads only its screen (g.dbg.hamView(): its boat, the hammer angle as drawn, the planks with their rings, the
     parade). It rows under the most urgent loose plank (a bent nail first) and taps when it expects the head to be in the green
     by the time its reaction has passed. */
const step = (from, to, max) => Math.abs(to - from) <= max ? to : from + Math.sign(to - from) * max;
const rng = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
const cx = i => 159 + 118 * i + 59;
module.exports = {
  du_bridge: [
    (g, role) => {
      let ptr = null, want = -9, since = 0; const R = rng(7 + role);
      return {
        tick(T, dt) {
          const v = g.dbg.carView(); if (ptr === null) ptr = v.x;
          const tgt = v.next >= 0 ? cx(v.next) : v.x;
          ptr = step(ptr, tgt, 600 * dt); g.move({ x: ptr });
          const gh = v.ghost, ok = v.have && !v.locked && gh.s === v.next && gh.e < 1.0 && Math.abs(v.om) < 1.6 && Math.abs(v.v) < 160;
          if (ok) { if (want < 0) { want = T + .15 + R() * .15; } if (T >= want) { want = -9; g.down({ x: ptr }); } } else want = -9;
        },
      };
    },
    (g, role) => {
      let ptr = null, last = -9, fireAt = -1; const R = rng(11 + role);
      return {
        tick(T, dt) {
          const v = g.dbg.hamView(); if (ptr === null) ptr = v.hx;
          let tgt = -1, best = 1e9;
          v.slots.forEach((s, i) => { if (!s.has || s.nails >= 2) return; const k = (s.bent ? -100 : 0) + s.t; if (k < best) { best = k; tgt = i; } });
          if (tgt < 0) { const nx = v.slots.findIndex(s => !s.has); tgt = nx < 0 ? 0 : nx; }
          ptr = step(ptr, cx(tgt), 650 * dt); g.move({ x: ptr });
          const s = v.slots[tgt];
          if (s.has && s.nails < 2 && Math.abs(v.hx - cx(tgt)) < 22 && T - last > .5) {
            const rt = .15 + R() * .12, pp = v.phi + v.dphi * rt;
            if (fireAt < 0 && Math.abs(pp) < .1) { last = T; fireAt = T + rt + (R() - .5) * .08; }      // I see the head coming, my hand lands rt later
          }
          if (fireAt >= 0 && T >= fireAt) { fireAt = -1; g.down({ x: ptr }); }
        },
      };
    },
  ],
};
