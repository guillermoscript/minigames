'use strict';
/* bots for du_pesa (PESA JUSTO). Role-honest:
   - the VENDOR bot only reads what its screen shows (g.dbg.view(): the pile weight, the hint bubble that is lit). While MORE is lit it taps the
     fruit bin every 0.26 s, while LESS is lit it takes one off; on DONE! (or no hint) it waits. It never sees the list.
   - the SHOPPER bot reads the list and the dial (g.dbg.view(): target kilos and the weight it sees), and taps MORE / LESS / DONE! when what it
     sees changes (DONE! again every 0.6 s while the needle sits in the green and nothing happened). */
module.exports = {
  du_pesa: [
    (g) => {
      let last = -9;
      return {
        tick(T) {
          const v = g.dbg.view(); if (!v.ready || T - last < .26) return;
          if (v.hint === 0) { last = T; g.down(g.dbg.btn('bin')); g.up(); }
          else if (v.hint === 1 && v.pieces > 0) { last = T; g.down(g.dbg.btn('off')); g.up(); }
        },
      };
    },
    (g) => {
      let idx = -1, sent = -1, at = -9;
      return {
        tick(T) {
          const v = g.dbg.view(); if (v.target <= 0) return;
          if (v.idx !== idx) { idx = v.idx; sent = -1; at = -9; }
          const need = v.weight < v.target - v.margin ? 0 : v.weight > v.target + v.margin ? 1 : (v.weight > 0 ? 2 : 0);
          if (T - at < .15) return;
          if (need !== sent || (need === 2 && T - at > .6)) { sent = need; at = T; g.down(g.dbg.btn(need === 0 ? 'more' : need === 1 ? 'less' : 'done')); g.up(); }
        },
      };
    },
  ],
};
