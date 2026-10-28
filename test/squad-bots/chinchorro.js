'use strict';
/* bots for sq_chinchorro (CHINCHORRO). Role-honest, they only read g.dbg.view() and use the public handlers.
   - EN EL CHINCHORRO (0, judge): sees how much the hammock tilts and sags. From tilt + sag he works out how slack each rope is (tL = mean - tilt/2,
               tR = mean + tilt/2, a little ahead of time using how fast it moves) and holds the plates (keys Q A / E D) that pull both ropes back to the middle.
   - AMARRE (1, 2): sees only its own tension meter and the shout. Holds W (tighter) or S (looser) while the arrow shows, ~100 ms after it appears.
   - ZANCUDOS (3): sees the mosquitoes. Taps each one ~350 ms after it appeared (position read at that moment). */
const judge = (g, role) => {
  /* He sees tilt and sag, so he knows how slack each rope is (tL = mean - tilt/2, tR = mean + tilt/2). The ropes answer a shout late, so he looks ahead using
     how fast each one is moving, and shouts every rope that is off the middle. */
  let prev = null, held = { l: 0, r: 0 };
  const set = (code, on, was) => { if (on && !was) g.key({ code }); else if (!on && was) g.keyup({ code }); };
  return {
    tick(T, dt) {
      const v = g.dbg.view(), cur = { l: v.mean - v.tilt / 2, r: v.mean + v.tilt / 2 };
      const vel = prev ? { l: (cur.l - prev.l) / dt, r: (cur.r - prev.r) / dt } : { l: 0, r: 0 }; prev = cur;
      const pl = cur.l + vel.l * LEAD - .52, pr = cur.r + vel.r * LEAD - .52;
      const dec = (e, h) => Math.abs(e) < (h ? .04 : .07) ? 0 : e < 0 ? 1 : -1;
      const l = dec(pl, held.l), r = dec(pr, held.r);
      set('KeyQ', l > 0, held.l > 0); set('KeyA', l < 0, held.l < 0); set('KeyE', r > 0, held.r > 0); set('KeyD', r < 0, held.r < 0);
      held = { l, r };
    },
  };
};
const LEAD = .5;
const rope = (g, role) => {
  let seen = 0, held = 0;
  return {
    tick(T, dt) {
      const v = g.dbg.view(), cue = v.cue;
      if (cue !== 0) { if (!seen) seen = T; } else seen = 0;
      const want = cue !== 0 && T - seen >= .1 ? cue : 0;
      if (want !== held) { if (held > 0) g.keyup({ code: 'KeyW' }); else if (held < 0) g.keyup({ code: 'KeyS' }); if (want > 0) g.key({ code: 'KeyW' }); else if (want < 0) g.key({ code: 'KeyS' }); held = want; }
    },
  };
};
const swatter = (g, role) => {
  const first = new Map();
  return {
    tick(T, dt) {
      for (const m of g.dbg.view().mos) {
        if (!first.has(m.id)) first.set(m.id, T);
        if (T - first.get(m.id) >= .35) { first.set(m.id, T + 1); g.down({ x: m.x, y: m.y }); g.up({ x: m.x, y: m.y }); }
      }
    },
  };
};
module.exports = { sq_chinchorro: n => [judge, rope, rope, swatter].slice(0, n) };
