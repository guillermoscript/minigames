'use strict';
/* bots for sq_band (GARAGE BAND). Role-honest: the conductor presses the pad of the part it sees on the score (public key handler) at the start of
   each calling window; an instrument taps (public down/up) on the notes its lane shows, which only exist once the conductor's call arrived.
   Unknown bars are never played. A small human-ish latency (~10 ms) after the note time. */
const bot = (g, role) => {
  const done = new Set();
  if (role === 0) return {
    tick(T, dt) {
      const v = g.dbg.view(); if (v.tb >= v.kinds.length) return;
      const key = v.tb + ':' + v.called[v.tb];
      if (v.called[v.tb] !== v.kinds[v.tb] && !done.has(key)) { done.add(key); const e = { code: 'Digit' + (v.kinds[v.tb] + 1) }; g.key(e); g.keyup(e); }
    },
  };
  return {
    tick(T, dt) {
      const v = g.dbg.view();
      for (const t of v.notes) {
        if (done.has(t)) continue;
        if (t < v.S - .05) { done.add(t); continue; }            // already gone (the call came late): do not tap strays
        if (v.S >= t + .01) { done.add(t); g.down({ x: 400, y: 300 }); g.up({ x: 400, y: 300 }); }
      }
    },
  };
};
module.exports = { sq_band: n => Array.from({ length: n }, () => bot) };
