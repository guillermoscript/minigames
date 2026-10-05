'use strict';
/* bots for du_reel (REEL & RELEASE). Role-honest:
   - the REELER bot only sees its line (g.dbg.reelerView(): how much it shakes / sags, the fish distance) and a tiny ripple before a lunge. It
     drags circles around the reel at a human pace (turns / s), eases off when the line shakes and cranks harder when it sags, ~0.15 s late.
   - the ROD HAND bot reads only its screen (g.dbg.rodView(): the gauge needle, where the fish is, the lunge telegraph). It leans the pointer
     toward the fish (toward the telegraphed spot once the lunge is near), and moves the pointer height (= drag) to keep the needle green,
     ~0.15 s late, with a limited pointer speed. */
const step = (from, to, max) => { const d = to - from; return Math.abs(d) <= max ? to : from + Math.sign(d) * max; };
module.exports = {
  du_reel: [
    (g) => {
      let a = 0, down = false, wc = 1.8; const hist = [];
      return {
        tick(T, dt) {
          if (T < .2) return;
          const v = g.dbg.reelerView(); hist.push([T, v]); while (hist.length > 1 && hist[1][0] <= T - .15) hist.shift(); const s = hist[0][1];
          if (s.vib > .3) wc = Math.max(.3, wc - 2.6 * dt); else if (s.sag > .1 || s.vib < .12) wc = Math.min(2.6, wc + 1.4 * dt);
          a += wc * Math.PI * 2 * dt; const p = { x: 520 + Math.cos(a) * 70, y: 330 + Math.sin(a) * 70 };
          if (!down) { down = true; g.down(p); } else g.move(p);
        },
      };
    },
    (g) => {
      let px = 400, py = 330, dTarget = .45, dt0 = 0; const hist = [];
      return {
        tick(T, dt) {
          const v = g.dbg.rodView(); hist.push([T, v]); while (hist.length > 1 && hist[1][0] <= T - .15) hist.shift(); const s = hist[0][1];
          let lat = s.lat; if (s.tele && s.tele.left < .5) lat = s.tele.dir * s.tele.amp;
          const tx = 400 + lat * 230;
          // drag: aim for the middle of the green band (pointer height: 520 = loose, 200 = tight)
          const mid = (s.band[0] + s.band[1]) / 2, err = mid - s.T;
          dt0 = Math.min(dt, .05); dTarget = clamp01(dTarget + err * 1.3 * dt0);
          const ty = 330 - (dTarget - .45) / .0024;
          px = step(px, tx, 1500 * dt); py = step(py, ty, 480 * dt);
          g.move({ x: px, y: py });
        },
      };
    },
  ],
};
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
