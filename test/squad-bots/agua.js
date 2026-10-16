'use strict';
/* bots for sq_agua (LLEGÓ EL AGUA). Role-honest: each bot reads only g.dbg.view() of its own role and acts through the public handlers.
   AZOTEA sees every tank (and the lines): it keeps the roof tank between two marks with the main valve (Space) and switches a floor's lamp
   (keys 1 / 2 / 3) to OPEN while that floor's displayed level is under its band's lower part, to CLOSE once it is in the band. A FLOOR sees its own level, the pipe
   pressure and the lamp: it holds its valve (down / up) while the lamp says OPEN, opens anyway when dry and closes anyway near the brim.
   Reaction latency ~0.12 s. */
const key = (g, code) => { const e = { code }; g.key(e); g.keyup(e); };
const bot = (g, role) => {
  const react = .12; let want = null, since = 0;
  if (role === 0) {
    const cd = [0, 0, 0];
    return {
      tick(T, dt) {
        const v = g.dbg.view(); if (!v.judge) return;
        if (T > .3) {
          if (!v.main && v.A < v.lineA + .06) key(g, 'Space'); else if (v.main && v.A > v.lineA + .12) key(g, 'Space');
        }
        v.floors.forEach((f, i) => {
          if (cd[i] > T) return;
          const need = f.L < f.line + .03;
          if (need && f.sig !== 1) { key(g, 'Digit' + (i + 1)); cd[i] = T + .25; }
          else if (!need && f.sig === 1) { key(g, 'Digit' + (i + 1)); cd[i] = T + .25; }
        });
      },
    };
  }
  let held = false;
  return {
    tick(T, dt) {
      const v = g.dbg.view(); if (v.judge) return;
      let d = v.lamp === 1 || v.L < .1; if (v.L > .9) d = false;
      if (d !== want) { want = d; since = T; }
      if (want !== null && T - since >= react && want !== held) { held = want; if (held) g.down({ x: 400, y: 510 }); else g.up({ x: 400, y: 510 }); }
    },
  };
};
module.exports = { sq_agua: n => Array.from({ length: n }, () => bot) };
