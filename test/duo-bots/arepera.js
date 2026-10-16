'use strict';
/* bots for du_arepera (AREPERA). Role-honest, through the public handlers only:
   - the GRIDDLE bot reads its screen (g.dbg.view(): the order ticket of every customer, which plates are free, which arepas are golden) and drags a
     golden arepa to every free plate. It also SAYS each order out loud: `voice` models the players' chat (the only way the two roles can share the hidden info).
   - the COUNTER bot only sees the cooler (view().tubs with the filling names) and which plates hold an arepa. It listens to `voice` (after 0.5 s of "talking")
     and drags the filling it heard onto that plate. With nobody talking it does nothing (it never guesses). */
let voice = {};
module.exports = {
  du_arepera: [
    (g) => {
      voice = {}; let last = -9;
      return {
        tick(T) {
          const w = g.dbg.view();
          for (let k = 0; k < 3; k++) { const v = voice[k]; if (!v || v.n !== w.cust[k]) voice[k] = { n: w.cust[k], f: w.orders[k].f, at: T }; }   // read the ticket out loud
          if (T - last < .12) return; last = T;
          for (let k = 0; k < 3; k++) {
            if (!w.free[k]) continue;
            const i = [0, 1, 2].find(i => w.ready[i]); if (i === undefined) return;
            g.down(g.dbg.spotPt(i)); g.move(g.dbg.slotPt(k)); g.up(g.dbg.slotPt(k)); return;
          }
        },
      };
    },
    (g) => {
      let last = -9;
      return {
        tick(T) {
          if (T - last < .12) return; last = T;
          const w = g.dbg.view();
          for (let k = 0; k < 3; k++) {
            const v = voice[k]; if (!w.present[k] || !v || v.n !== w.cust[k] || T - v.at < .5) continue;
            const j = w.tubs.findIndex(x => x.f === v.f); if (j < 0) continue;
            g.down(g.dbg.tubPt(j)); g.move(g.dbg.slotPt(k)); g.up(g.dbg.slotPt(k)); return;
          }
        },
      };
    },
  ],
};
