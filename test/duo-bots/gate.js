'use strict';
/* bots for du_crank (DRAGON GATE). Role-honest:
   - the GATEKEEPER bot only watches the dragon (g.dbg.threat(): how far the inhale is + when the fireball will reach the gate): it holds the
     lever, lets go a little before the fireball lands and grabs it again once it has splatted.
   - the CRANKER bot sees nothing special: it just drags circles around the winch at a human pace (about 1.6 turns a second). */
module.exports = {
  du_crank: [
    (g) => {
      let held = false;
      return {
        tick(T) {
          const th = g.dbg.threat(), want = T > .25 && !(th && th.left < .55);
          if (want && !held) { held = true; g.down({ x: 400, y: 490 }); }
          else if (!want && held) { held = false; g.up({ x: 400, y: 490 }); }
        },
      };
    },
    (g) => {
      const [hx, hy] = g.dbg.hub; let a = 0, down = false;
      return {
        tick(T, dt) {
          if (T < .2) return;
          a += 1.6 * Math.PI * 2 * dt; const p = { x: hx + Math.cos(a) * 70, y: hy + Math.sin(a) * 70 };
          if (!down) { down = true; g.down(p); } else g.move(p);
        },
      };
    },
  ],
};
