'use strict';
/* bots for PANIC PANEL (js/games/duo/panic.js). Role-honest: a bot only uses what its own screen shows - its own order cards
   (g.dbg.cards(): icon + word on each card), its own three controls (g.dbg.mine) and the icons its friend shouts ('yell' bubbles:
   each bubble belongs to one shouted order, so a second shout of the same order is not a second job). */
function bot(g) {
  const seen = new Map(), todo = [], did = new Set();
  return {
    on(t, d) { if (t === 'yell' && !did.has(d.i) && !todo.some(q => q.i === d.i)) todo.push({ k: d.k, i: d.i, at: g.c + .3 }); },   // the bubble flashes: find that control, press it
    tick() {
      const mine = g.dbg.mine;
      for (const o of g.dbg.cards()) {                                          // read a card, then press it (mine) or shout it (friend's)
        if (!seen.has(o.id)) seen.set(o.id, { at: g.c, last: -9 });
        const s = seen.get(o.id); if (g.c - s.at < .35 || g.c - s.last < 1.2) continue;
        const ok = mine.includes(o.ctl) ? g.press(mine.indexOf(o.ctl)) : g.shout(o.id);
        if (ok) s.last = g.c;
      }
      for (let i = todo.length - 1; i >= 0; i--) {
        if (g.c < todo[i].at) continue; const k = todo[i].k;
        if (!mine.includes(k) || g.press(mine.indexOf(k))) { did.add(todo[i].i); todo.splice(i, 1); }
      }
    },
  };
}
module.exports = { du_panic: [bot, bot] };
