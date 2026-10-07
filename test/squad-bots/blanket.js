'use strict';
/* bots for sq_blanket (FIRE RESCUE). Role-honest: each bot reads only what its own screen draws (g.dbg.view()) and acts through the pointer
   (g.move) with a limited pointer speed and a 0.15 s decision rate. Every bot does the same thing for ITS corner, because that is all anybody can see:
   - a window is open / a victim is falling: put my corner under it (every corner at the same x = the blanket's centre is there) and lift it
     just before the landing (heavy things: all the way)
   - a victim rides the blanket: carry it until the right edge reaches the ambulance doors, then LEFT corners up / RIGHT corners down (tilt) */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
module.exports = {
  sq_blanket: n => Array.from({ length: n }, () => (g, role, { every }) => {
    const st = { n: -1 }; let px = 400, py = 453, tx = 400, th = .3, started = false;
    function decide() {
      const v = g.dbg.view(), its = v.items, riding = its.find(i => i.st === 3);
      const coming = its.filter(i => i.st <= 2 && (i.tel || i.st >= 1)).sort((a, b) => a.eta - b.eta)[0];
      let cT = 400, h = .42;
      const left = riding && riding.xw < 325, range = riding && (left ? v.xL <= v.XL0 + 30 : v.xR >= v.XM0 - 30), low = left ? 0 : 1;
      const leaving = false;
      if (riding && !leaving && !(coming && coming.eta < .55 && !(Math.abs(riding.u) > v.hw * .4))) {            // the near exit: the mattress on the left or the ambulance on the right
        cT = left ? Math.min(riding.xw, v.XL0 - 50 + v.hw) : Math.max(riding.xw, v.XM0 + 50 - v.hw);   // stay put when the edge is already past the door
        h = v.side === low ? (range ? .06 : .5) : .96;
      } else if (coming) {
        cT = coming.st === 2 ? coming.x : coming.xw;
        const need = coming.heavy ? .98 : .86;
        h = coming.st === 2 || coming.eta < .8 ? need : .42;
      }
      tx = clamp(cT, 24, 776); th = h;       // everybody's pointer at the same x puts the blanket's centre there
    }
    return {
      tick(T, dt) {
        if (every(T, st, .15)) decide();
        px += clamp(tx - px, -1500 * dt, 1500 * dt);
        const ty = 540 - th * 290; py += clamp(ty - py, -2200 * dt, 2200 * dt);
        g.move({ x: px, y: py });
      },
    };
  }),
};
