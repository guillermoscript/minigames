'use strict';
/* bots for du_cafe (CAFÉ COLADO). Role-honest, through the public handlers only:
   - the JARRA bot reads its kettle (g.dbg.view(): the stream thickness it feels and the water left) and holds the tilt with a small integrator so
     the stream stays at a gentle, steady thickness. It never sees the cloth, so it cannot know the sock is filling: it just pours slow.
   - the PAÑO bot reads its screen (g.dbg.view(): where the stream is falling now, where its cloth is) and slides the cloth under it. */
module.exports = {
  du_cafe: [
    (g) => {
      let started = false, bx = 400, last = 0;
      return {
        tick(T) {
          const v = g.dbg.view(), dt = Math.max(0, T - last); last = T;
          if (!started) { started = true; g.down({ x: 400, y: 300 }); }
          if (T < .6) return;
          bx = Math.max(400, Math.min(720, bx + (.26 - v.flow) * 700 * dt));
          g.move({ x: bx, y: 300 });
        },
      };
    },
    (g) => {
      let started = false;
      return {
        tick() {
          const v = g.dbg.view();
          if (!started) { started = true; g.down({ x: 400, y: 300 }); }
          g.move({ x: v.sx, y: 300 });
        },
      };
    },
  ],
};
