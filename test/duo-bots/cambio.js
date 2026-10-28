'use strict';
/* bots for du_cambio (CASA DE CAMBIO). Role-honest:
   - the CHALKBOARD bot reads what its screen shows (g.dbg.view(): the rate on the board and the client's order), waits a human-ish 0.15 s
     after anything changes, and taps the chip with rate x order.
   - the CASHIER bot only reads what its screen shows (the called total, its own tray) and taps the bills (greedy 5 / 2 / 1, UNDO when it is over),
     one tap every 0.13 s, then taps HAND OVER once the tray matches (and again every 0.6 s if nothing happened). */
module.exports = {
  du_cambio: [
    (g) => {
      let key = '', since = 0, last = -9;
      return {
        tick(T) {
          const v = g.dbg.view(), k = v.rate + ':' + v.order + ':' + v.ci;
          if (k !== key) { key = k; since = T; }
          const want = v.rate * v.order;
          if (T - since >= .15 && v.target !== want && T - last > .12) { last = T; g.down(g.dbg.chip(want)); g.up(); }
        },
      };
    },
    (g) => {
      let last = -9, gave = -9, stable = 0, lt = -1;
      return {
        tick(T) {
          const v = g.dbg.view(); if (v.target <= 0) { lt = -1; return; }
          if (T - last < .13) return;
          const key = v.target + ':' + v.ci;
          if (key !== lt) { lt = key; stable = T; }
          const tap = nm => { last = T; g.down(g.dbg.btn(nm)); g.up(); };
          if (v.tray > v.target) return tap('undo');
          if (v.tray < v.target) { const need = v.target - v.tray; return tap(need >= 5 ? 'b5' : need >= 2 ? 'b2' : 'b1'); }
          if (T - gave > .6) { gave = T; tap('give'); }
        },
      };
    },
  ],
};
