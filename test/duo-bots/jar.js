'use strict';
/* bots for du_jar (JAR WARS). Role-honest:
   - the HOLDER bot reads only its own screen (g.dbg.holdView(): the green zone, my bubble, the twist power I see, the next kick arrow). It chases the
     centre of the green zone as it was ~0.15 s ago (reaction time) with a limited pointer speed, like a hand on a mouse.
   - the TWISTER bot reads only its screen (g.dbg.twistView(): how the jar leans, my power). It circles the pointer around the lid at a speed that
     depends on what it saw ~0.15 s ago: full power while the jar looks steady, eases off when it leans or shudders. */
const LVX = 372, LVS = 128;
module.exports = {
  du_jar: [
    (g) => {
      let px = LVX; const hist = [];
      return {
        tick(T, dt) {
          const v = g.dbg.holdView(); hist.push([T, v.ring]); while (hist.length > 1 && hist[1][0] <= T - .15) hist.shift();
          const want = LVX + Math.max(-1.3, Math.min(1.3, hist[0][1])) * LVS, d = want - px, m = 1500 * dt;
          px += Math.abs(d) <= m ? d : Math.sign(d) * m; g.move({ x: px, y: 520 });
        },
      };
    },
    (g) => {
      let a = 0, ptr = null; const hist = [];
      return {
        tick(T, dt) {
          const v = g.dbg.twistView(); hist.push([T, v.th]); while (hist.length > 1 && hist[1][0] <= T - .15) hist.shift();
          const h0 = hist[0], dth = (v.th - h0[1]) / Math.max(.05, T - h0[0]), th = Math.abs(h0[1] + dth * .12), want = th < .26 ? 1 : th < .4 ? .35 : 0;
          a += want * v.FULL * 1.05 * dt;
          const r = 70, c = v.center; g.move({ x: c[0] + Math.cos(a) * r, y: c[1] + Math.sin(a) * r });
        },
      };
    },
  ],
};
