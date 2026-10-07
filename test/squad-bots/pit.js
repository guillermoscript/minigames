'use strict';
/* bots for sq_pit (PIT STOP). Role-honest: each bot reads only its own screen through g.dbg.view().
   - JACK pumps whenever the car sinks below ~.85 until it hears the wheels are done, then lets it down.
   - WHEELS taps (a bit over 6 a second) once its screen shows the car up.
   - FUEL holds the nozzle and lets go with the gauge in the middle of the green.
   - LOLLIPOP (4 players) raises the sign, then lets go ~.3 s after every lamp is green on its screen (a human reaction time). */
module.exports = {
  sq_pit: n => {
    const bots = [
      (g, role, { every }) => { const st = { n: -1 }; return { tick(T) { const v = g.dbg.view(); if (T > v.ARR + .05 && !v.wd && v.jack < .85 && every(T, st, .2)) g.down({ x: 100, y: 100 }); } }; },
      (g, role, { every }) => { const st = { n: -1 }; return { tick(T) { const v = g.dbg.view(); if (T > v.ARR + .05 && !v.wd && v.jack >= v.UP + .08 && every(T, st, .15)) g.down({ x: 100, y: 100 }); } }; },
      (g, role) => { let held = false; return { tick(T) { const v = g.dbg.view(); if (v.fd || T < v.ARR + .1) return;
        if (!held && !v.stun && v.F < v.zl + .02) { held = true; g.down({ x: 1, y: 1 }); }
        else if (held && (v.F >= v.zl + .09 || v.stun)) { held = false; g.up({ x: 1, y: 1 }); } } }; },
    ];
    if (n === 4) bots.push((g, role) => { let up = false, since = -1; return { tick(T) { const v = g.dbg.view();
      if (!up && T > v.ARR + .2) { up = true; g.down({ x: 1, y: 1 }); }
      if (up) { if (v.green) { if (since < 0) since = T; if (T - since > .3) { up = false; g.up({ x: 1, y: 1 }); } } else since = -1; } } }; });
    return bots;
  },
};
