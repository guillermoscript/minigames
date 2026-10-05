'use strict';
/* bots for du_pump (DRAGON PUMP). Role-honest:
   - the PUMPER bot reads only what its screen shows (g.dbg.pumpView(): the handle, the dragon's size, how hard the neck trembles, the hiss).
     It works the bellows with the Space key at a human rhythm (~2.2 strokes/s), stops when it hears the hiss or sees the dragon full,
     and eases off when the neck trembles hard. It waits ~0.15 s before reacting to a change.
   - the VALVE bot reads only its screen (g.dbg.valveView(): gauge, red line, dragon size, knot needle). It holds the valve when the needle climbs
     into the yellow, lets go when it has fallen, and taps to tie when the dragon is full and the needle crosses the green zone. */
module.exports = {
  du_pump: [
    (g) => {
      let down = false, since = 0, chg = 0, lastHiss = false, lastJit = 0, react = [];
      return {
        tick(T, dt) {
          const v = g.dbg.pumpView();
          react.push([T, v.hiss, v.jit, v.full]); while (react.length && T - react[0][0] > .15) react.shift();
          const o = react[0] || [T, v.hiss, v.jit, v.full];                  // what I saw 0.15 s ago
          const stop = o[1] || o[3] || o[2] > .72;
          if (stop) { if (down) { down = false; g.keyup({ code: 'Space' }); } since = T; return; }
          if (T - since < (down ? .22 : .2)) return;                          // hold up .22 s, let go .2 s
          since = T; down = !down;
          if (down) g.key({ code: 'Space', repeat: false }); else g.keyup({ code: 'Space' });
        },
      };
    },
    (g) => {
      let open = false, seen = [], tapAt = -9, pressed = false, pAt = -9;
      return {
        tick(T, dt) {
          const v = g.dbg.valveView();
          seen.push([T, v]); while (seen.length > 1 && T - seen[1][0] > .15) seen.shift();
          const w = seen[0][1];                                               // reaction time
          if (pressed && T - pAt > .12) { pressed = false; g.up({ x: 470, y: 450 }); }
          if (w.full) {
            if (w.P > .6 || w.tight) { if (!open) { open = true; g.key({ code: 'Space', repeat: false }); } return; }
            if (open) { open = false; g.keyup({ code: 'Space' }); }
            if (!pressed && T - tapAt > .5 && Math.abs(v.needle) < .2) { tapAt = T; pressed = true; pAt = T; g.down({ x: 470, y: 450 }); }
            return;
          }
          const hi = w.lim - .36, lo = w.lim - .58;
          if (!open && w.P > hi) { open = true; g.key({ code: 'Space', repeat: false }); }
          else if (open && w.P < lo) { open = false; g.keyup({ code: 'Space' }); }
        },
      };
    },
  ],
};
