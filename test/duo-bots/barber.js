'use strict';
/* bots for du_barber (BARBER BALANCE). Role-honest:
   - the CUSTOMER bot only reads its own spirit level (g.dbg.tilt(): how its head leans) and the sneeze it feels coming
     (g.dbg.cue(): the panel says GET READY, then LEAN NOW! and which way). It nudges the pointer against the lean (like a hand
     chasing the bubble, updated ~30 times a second) and jerks the way the arrow says 150-300 ms after LEAN NOW! shows up.
   - the BARBER bot only reads the dotted line as its screen draws it (g.dbg.view() + g.dbg.scr(): the head angle it received,
     the cut, how far it got) and its own scissors. It glides the scissors to the cut, holds, and drags along the dots while the
     line is level (waits on the line when it is not); its hand follows what it saw ~160 ms ago (a human reaction time). */
const CMAX = .8;
module.exports = {
  du_barber: [
    (g, role, { every }) => {
      const st = {}; let c = 0, prev = null, om = 0, sawAt = -1, n = 0;
      return {
        tick(T, dt) {
          const th = g.dbg.tilt(); if (prev !== null) om += ((th - prev) / dt - om) * .5; prev = th;
          if (!every(T, st, 1 / 30)) return;
          c = Math.max(-CMAX, Math.min(CMAX, c + (-7 * th - .35 * om) / 30));
          const q = g.dbg.cue();
          if (q.k !== 2) sawAt = -1; else if (sawAt === -1) { sawAt = T; n++; }  // LEAN NOW! just showed up
          const jit = ((n * 7919 + 13) % 11) / 11;                  // a human is never on the beat: 150-300 ms to react, a bit too weak or strong
          if (sawAt >= 0 && T - sawAt > .15 + .15 * jit) { sawAt = -2; c = Math.max(-CMAX, Math.min(CMAX, c + q.dir * (.45 + .1 * jit))); }
          g.move({ x: 400 + c / CMAX * 260, y: 300 });
        },
      };
    },
    (g, role, { every }) => {
      const st = {}, seen = []; let tgt = null, held = false;
      return {
        tick(T, dt) {
          const v = g.dbg.view(), S = g.dbg.SEG[v.seg];
          if (!S) { if (held) { held = false; g.up({ x: 0, y: 0 }); } return; }
          if (every(T, st, .06)) {                                  // look at the screen: where the front of the cut is drawn now ...
            const along = v.eng ? v.f + (v.level ? 60 : 2) : v.f;
            seen.push({ T, p: g.dbg.scr(S.a + S.d * Math.min(S.L + 6, along), S.y) });
          }
          while (seen.length > 1 && seen[1].T <= T - .16) seen.shift();   // ... and the hand reacts ~160 ms later
          if (seen.length && seen[0].T <= T - .16) tgt = seen[0].p;
          if (!tgt) return;
          const [x, y] = v.tip, dx = tgt[0] - x, dy = tgt[1] - y, d = Math.hypot(dx, dy), step = 260 * dt;
          const nx = d <= step ? tgt[0] : x + dx / d * step, ny = d <= step ? tgt[1] : y + dy / d * step;
          g.move({ x: nx, y: ny });
          if (!held && d < 14) { held = true; g.down({ x: nx, y: ny }); }
        },
      };
    },
  ],
};
