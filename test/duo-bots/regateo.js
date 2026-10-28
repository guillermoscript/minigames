'use strict';
/* bots for du_regateo (REGATEO EN EL MERCADO). Role-honest, through the public handlers only:
   - the OFFER bot reads its screen (g.dbg.view(): the offer o and the seller's mood, never his lowest price): it holds the banknote and
     slides the price down while he smiles (mood 2); the moment he frowns (mood < 2) it jumps back up a little. So it hovers around his lowest price.
   - the EYE bot reads the chalk sign (view().lo / hi: a window that holds the seller's lowest price in its first 3 units) and rings the bell the moment the
     price it SEES is inside the safe part of the window [lo + 2, hi]: always accepted, and never more than the window above his minimum. */
module.exports = {
  du_regateo: [
    (g) => {
      let started = false, o = null, last = -9;
      return {
        tick(T, dt) {
          const w = g.dbg.view();
          if (!started) { started = true; o = w.o; g.down(g.dbg.pricePt(o)); }
          if (w.phase === 1) return;                                                  // the deal is being wrapped up
          if (Math.abs(o - w.o) > 6) o = w.o;                                         // a new round: the price jumped to the new asking price
          o = w.mood < 2 ? o + 4 : o - 40 * dt;                                       // frown: back up; smile: lower it
          if (T - last >= 1 / 60) { last = T; g.move(g.dbg.pricePt(o)); }
        },
      };
    },
    (g) => {
      let at = -9;
      return {
        tick(T) {
          const w = g.dbg.view();
          if (w.phase === 1 || T - at < .5) return;
          if (w.o >= w.lo + 2 && w.o <= w.hi) { at = T; g.down({ x: 400, y: 300 }); g.up(); }
        },
      };
    },
  ],
};
