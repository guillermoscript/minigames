'use strict';
/* bots for du_tendedero (¡RECOGE LA ROPA!). Role-honest:
   - the HEN bot only reads what the sky shows (g.dbg.sky(): the clouds, which side they come from and how long until they rain).
     When a cloud is about 1.8 s away it clucks once (left) or twice (right), tapping like a player.
   - the GRANNY bot only reads what her screen shows (g.dbg.view(): the lines, how wet each garment looks, rain on each side) plus the
     bells it hears. After a bell its line goes in until it has seen the rain come and go; otherwise the line hangs out to dry, and
     goes in when everything on it is dry. It turns the cranks with the keys (A D left line, ◄ ► right line). */
module.exports = {
  du_tendedero: [
    (g, role) => {
      const done = new Set(); const taps = [];
      return {
        tick(T) {
          const s = g.dbg.sky();
          for (const c of s.clouds) if (!done.has(c.id) && c.eta <= 1.8) {
            done.add(c.id); taps.push(T); if (c.side === 1) taps.push(T + .1);
          }
          while (taps.length && taps[0] <= T) { taps.shift(); g.down({ x: 400, y: 200 }); g.up({ x: 400, y: 200 }); }
        },
      };
    },
    (g, role) => {
      const danger = [false, false], saw = [false, false], since = [0, 0], held = [0, 0];
      const KEYS = [['KeyD', 'KeyA'], ['ArrowLeft', 'ArrowRight']];   // [in, out]
      return {
        on(t, d) { if (t === 'ck') { const s = d[0] ? 1 : 0; danger[s] = true; saw[s] = false; since[s] = g.c; } },
        tick(T) {
          const v = g.dbg.view();
          for (let s = 0; s < 2; s++) {
            if (v.rain[s]) saw[s] = true;
            if (danger[s] && ((saw[s] && !v.rain[s]) || g.c - since[s] > 6)) { danger[s] = false; saw[s] = false; }
            const own = [0, 1, 2].map(k => s * 3 + k), pres = own.filter(i => v.d[i] >= 0);
            const alldry = pres.length > 0 && pres.every(i => v.d[i] >= .99);
            const wantIn = danger[s] || alldry;
            const p = v.pos[s]; let dir = 0;
            if (wantIn && p < .985) dir = 1; else if (!wantIn && p > .015) dir = -1;
            if (dir !== held[s]) {
              if (held[s]) g.keyup({ code: KEYS[s][held[s] > 0 ? 0 : 1] });
              if (dir) g.key({ code: KEYS[s][dir > 0 ? 0 : 1] });
              held[s] = dir;
            }
          }
        },
      };
    },
  ],
};
