'use strict';
/* bots for du_seesaw (EGG DELIVERY). Role-honest: each carrier reads only its own screen (g.dbg.egg(): where the egg is and how fast
   it rolls there; g.dbg.wind(): how hard the wind blows now, as the streaks / leaves / cloud show it) and sets its own end the way a
   mouse player would (g.move to a y on the lever). Each one only lifts when the egg needs to roll AWAY from its own end. */
module.exports = {
  du_seesaw: [0, 1].map(role => (g) => ({
    tick() {
      const d = g.dbg, e = d.egg(), tilt = (-2.2 * e.s - .35 * e.v - d.WSP * d.wind() - d.KU * e.s) / d.G;   // tilt wanted = left end - right end
      const want = role === 0 ? Math.max(0, tilt) : Math.max(0, -tilt);
      g.move({ x: 400, y: d.yOf(Math.min(1, want)) });
    },
  })),
};
