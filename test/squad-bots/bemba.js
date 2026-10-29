'use strict';
/* bot for sq_bemba (RADIO BEMBA). Role-honest: it reads only what its own screen shows (g.dbg.view()) and presses the cards through the public g.down.
   - STARTER (0): sees the picture; says it with the card whose phrase belongs to that picture (the dictionary g.dbg.PH is the "everyone in the queue knows what
                  these phrases mean" knowledge a human has).
   - EARS: see the previous phrase with some chunks eaten by static (null): they look for the one phrase of that list that fits the chunks left, then press the
                  card of their own list that says the same.
   - LAST EAR (judge): same, but presses the picture.
   Each waits ~0.35 s after something new shows up (reading the rumour). */
const REACT = .35;
const mean = (PH, list, heard) => {
  const ok = []; for (let m = 0; m < 6; m++) if (heard.every((c, i) => c === null || PH[list][m][i] === c)) ok.push(m);
  return ok.length === 1 ? ok[0] : -1;
};
const bot = (g, role) => {
  let key = '', since = 0;
  return {
    tick(T) {
      const v = g.dbg.view(); if (!v.ready) { key = ''; return; }
      const k = v.round + ':' + (v.heard ? v.heard.join('|') : v.icon); if (k !== key) { key = k; since = T; }
      if (T - since < REACT) return;
      const PH = g.dbg.PH; let m;
      if (v.icon !== undefined) m = v.icon; else if (v.heard) m = mean(PH, v.list, v.heard); else return;
      if (m < 0) return;
      const o = v.opts.find(q => q.id !== undefined ? q.id === m : q.chunks.every((c, i) => c === PH[v.me][m][i])); if (!o) return;
      g.down({ x: o.x, y: o.y }); g.up({ x: o.x, y: o.y }); key = '';
    },
  };
};
module.exports = { sq_bemba: n => Array.from({ length: n }, () => bot) };
