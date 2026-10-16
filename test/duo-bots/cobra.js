'use strict';
/* bots for du_cobra (COBRA EL PASAJE). Role-honest:
   - the COLECTOR bot reads only its van (g.dbg.cview(): the hands held up with their seat position, whether a passenger is asking to get
     off and the button is not jammed). It reacts ~0.2 s after something appears, taps one hand at a time through the pointer handlers and
     rings PARADA by pressing the button.
   - the CHOFER bot reads only its windscreen (g.dbg.dview(): own speed and lane, the bell lamp, the signs and potholes ahead as distances).
     It keeps the pedal down, brakes to stop in the zone of the next sign ONLY while the lamp is lit, and picks a lane free of potholes
     in the next ~300 px, steering by dragging the pointer. */
const LANEX = [130, 400, 670];
module.exports = {
  du_cobra: [
    (g, role, { every }) => {
      let lastAct = -9, bubbleSince = -9;
      return {
        tick(T) {
          const D = g.dbg, v = D.cview();
          if (v.bubble && !v.jam) { if (bubbleSince < 0) bubbleSince = T; } else bubbleSince = -9;
          if (T - lastAct < .13) return;
          const h = v.hands.find(q => q.age > .2);
          if (h) { g.down({ x: h.x, y: h.y }); g.up(); lastAct = T; return; }
          if (v.bubble && !v.jam && bubbleSince >= 0 && T - bubbleSince > .25) { g.down({ x: D.BTN.x, y: D.BTN.y }); g.up(); lastAct = T; }
        },
      };
    },
    (g, role, { every }) => {
      let on = false;
      return {
        tick(T, dt) {
          const D = g.dbg, v = D.dview(), B = D.BR;
          const sign = v.signs.reduce((m, s) => (!m || s.d < m.d) ? s : m, null);
          let go = true;
          if (v.lamp && sign) { const need = v.v * v.v / (2 * B) + 22; if (sign.d <= need && sign.d > -D.ZN) go = false; if (v.v < 12 && sign.d > D.ZN - 10) go = true; }
          // lane with no pothole in the next 320 px (the closest one first, staying put when it is free)
          const blocked = l => v.holes.some(h => h.l === l && h.d > -40 && h.d < 320);
          let lane = Math.round(v.laneT);
          if (blocked(lane)) { const c = [lane - 1, lane + 1, lane - 2, lane + 2].filter(l => l >= 0 && l <= 2 && !blocked(l)); if (c.length) lane = c[0]; }
          if (go) { g.down({ x: LANEX[lane], y: 300 }); on = true; }
          else { if (on) { g.up(); on = false; } }
          if (!go) return;
        },
      };
    },
  ],
};
