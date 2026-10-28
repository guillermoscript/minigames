'use strict';
/* bots for du_caucho (CAMBIO DE CAUCHO). Role-honest, through the public handlers only:
   - the JACK bot reads its gauge (g.dbg.view(): height, wobble, nuts tight) and holds / releases the lift with a little hysteresis, so it keeps
     the car in the middle of the green band; once the wheel is on (5 nuts tight) it lets go and lets the car sink.
   - the LUGS bot reads its screen (the car height it sees, the lamp, the next numbered nut) and taps the next nut only while the lamp is green
     and the height is comfortably inside the band, one tap every 0.28 s (a human-ish pace). */
module.exports = {
  du_caucho: [
    (g) => {
      let on = false;
      return {
        tick() {
          const v = g.dbg.view();
          const want = v.nn >= v.need ? false : on ? v.h < .7 : v.h < .62;
          if (want && !on) { on = true; g.down({ x: 590, y: 222 }); }
          else if (!want && on) { on = false; g.up(); }
        },
      };
    },
    (g) => {
      let last = -9;
      return {
        tick(T) {
          const v = g.dbg.view();
          if (v.next < 0 || T - last < .28) return;
          if (v.hv < v.lo + .04 || v.hv > v.hi - .04) return;
          last = T; const p = g.dbg.nut(v.next); g.down(p); g.up();
        },
      };
    },
  ],
};
