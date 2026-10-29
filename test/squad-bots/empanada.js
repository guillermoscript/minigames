'use strict';
/* bots for sq_empanada (EMPANADA EN EL AIRE). Each role plays through the public helpers the pointer / keys use (holdOn/release, toss, setTray).
   Role-honest: the fryer reacts ~250 ms after an order shows up and lets go in the middle of the golden zone; the tosser reads only his dial
   (acting on the angle he saw ~100 ms ago and anticipating the green zone); a tray reads the chalk marks (spot + wind) of its own side and then
   the published landing x of every toss that it owns. */
const bot = (g, role) => {
  const hist = [];
  return {
    tick(T, dt) {
      const v = g.dbg.view();
      if (role === 0) {
        if (!v.holding) { if (v.cur >= 0 && v.S - v.next[v.cur].c >= .25) g.holdOn(); }
        else if (v.h >= (v.GO0 + v.GO1) / 2 + .02) g.release();
      } else if (role === 1) {
        hist.push(v.hand && v.hand.ready ? v.hand.ang : null); if (hist.length > 7) hist.shift();
        const seen = hist[0];
        if (seen !== null && seen !== undefined && seen > -.7 && seen < -.3) g.toss();
      } else {
        const mine = v.items.filter(q => q.own === role);
        let x = null;
        if (mine.length) x = mine[0].xl;
        else for (let i = 0; i < v.next.length; i++) {
          if (v.res[i] || v.items.some(q => q.i === i)) continue;
          if (v.S < v.next[i].c - 1.0) break;
          if (v.n === 3 || v.owner(v.next[i].x) === role) { x = v.next[i].x; break; }
        }
        if (x !== null) g.setTray(x);
      }
    },
  };
};
module.exports = { sq_empanada: n => Array.from({ length: n }, () => bot) };
