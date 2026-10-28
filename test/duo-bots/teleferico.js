'use strict';
/* bots for du_teleferico (TELEFÉRICO DE MÉRIDA). Role-honest, through the public handlers only:
   - the CABIN bot reads what its window shows (g.dbg.view(): the tilt of the horizon and how fast it is swinging) and presses the sack on the
     side that brings the car back: it pushes against the swing, and when the fog rushes in from a side it leans a little against that side first.
   - the STATION bot reads its desk (g.dbg.view(): where the car is on the cable, its speed, the wind forecast) and works the lever: climbs, slows to
     a crawl for the last stretch, lets go early enough for the brake lag, and eases off while a gust is blowing. */
module.exports = {
  du_teleferico: [
    (g) => {
      let side = 0;
      const press = s => { if (s === side) return; if (side) g.up(); side = s; if (s) g.down({ x: s < 0 ? 100 : 700, y: 500 }); };
      return {
        tick() {
          const v = g.dbg.view();
          const e = v.th + v.w * .55 + v.fog.k * v.fog.dir * .06;           // where the car is heading, plus a nudge against the incoming gust
          press(Math.abs(e) < .015 ? 0 : e > 0 ? -1 : 1);
        },
      };
    },
    (g) => {
      let on = false, last = -9;
      return {
        tick(T) {
          if (T - last < .08) return; last = T;
          const v = g.dbg.view(), d = g.dbg;
          if (!v.seen) { if (!on) { on = true; g.down({ x: 400, y: 500 }); } return; }
          const aim = d.LO + (d.HI - d.LO) * .38, lat = .6;
          const dist = aim - v.P - v.v * lat;
          let vd = dist <= 0 ? 0 : Math.min(d.VMAX, Math.max(24, Math.sqrt(2 * 100 * dist)));
          if (v.gusts.some(u => u.eta < .5 && u.eta > -1.3)) vd = Math.min(vd, 80);   // ease off while a gust is blowing
          const want = v.v < vd;
          if (want && !on) { on = true; g.down({ x: 400, y: 500 }); } else if (!want && on) { on = false; g.up(); }
        },
      };
    },
  ],
};
