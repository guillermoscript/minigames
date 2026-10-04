'use strict';
/* bots for du_hippo (FEED THE HIPPO). Role-honest:
   - the FEEDER bot reads only the waiting bag through its X-ray (g.dbg.slot(): ready, trash, warned): it warns trash, then tosses.
   - the HIPPO bot reads only what flies at it (g.dbg.incoming(): skull sign + time to the lips): open for plain bags, shut for skulls. */
module.exports = {
  du_hippo: [
    (g) => {
      const st = { readyAt: null, id: -1 };
      return {
        tick(T) {
          const sl = g.dbg.slot();
          if (!sl.ready) { st.readyAt = null; return; }
          if (sl.id !== st.id) { st.id = sl.id; st.readyAt = T; }
          if (T - st.readyAt < .12) return;                       // a human-ish reaction time
          if (sl.trash && !sl.warned) { g.key({ code: 'KeyW', repeat: false }); return; }
          if (T - st.readyAt >= .2) g.key({ code: 'Space', repeat: false });
        },
      };
    },
    (g) => {
      let held = false;
      return {
        tick() {
          const inc = g.dbg.incoming().filter(f => f.left > -.2).sort((a, b) => a.left - b.left);
          const next = inc[0], want = !!next && !next.w && next.left < .35;
          if (want && !held) { held = true; g.down({ x: 400, y: 400 }); }
          else if (!want && held) { held = false; g.up({ x: 400, y: 400 }); }
        },
      };
    },
  ],
};
