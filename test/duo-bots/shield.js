'use strict';
/* bots for du_shield (BODYGUARD). Role-honest: the pilot only reads its own saucer and the star it can see; the shield only reads
   the saucer and the orbs as its own screen shows them.
   du_shield.cheese holds two NEGATIVE checks for balance runs (they must lose most rounds with the real pilot bot):
   spin = a shield that just holds → forever; fixed = a shield pointed once at the right wall and never moved again. */
const touchOn = () => typeof TOUCH !== 'undefined' && TOUCH;
const pilot = (g) => ({ tick() {
  const s = g.dbg.goal(); if (!s) return;
  if (touchOn()) {   // on a touch screen the pilot drags relative to where the finger went down (gain 1.3)
    const p = g.dbg.pos(); g.down({ x: p.x, y: p.y }); g.move({ x: p.x + (s.x - p.x) / 1.3, y: p.y + (s.y - p.y) / 1.3 }); g.up({ x: 0, y: 0 });
  } else g.move({ x: s.x, y: s.y });
} });
const shield = (g) => ({ tick() {
  const P = g.dbg.ship(); let best = null, bt = 1e9;
  for (const o of g.dbg.orbs()) {
    const dx = P.x - o.x, dy = P.y - o.y, d = Math.hypot(dx, dy) || 1, closing = (dx * Math.cos(o.a) + dy * Math.sin(o.a)) / d;
    if (closing < .15) continue; const tt = (d - g.dbg.RS) / closing; if (tt < bt) { bt = tt; best = o; }
  }
  if (best) g.move({ x: best.x, y: best.y });
  else { const c = g.dbg.charging(); if (c) g.move({ x: c[0], y: c[1] }); }
} });
const pair = [pilot, shield];
pair.cheese = {
  spin: (g) => ({ tick() { g.key({ code: 'ArrowRight', repeat: true }); } }),
  fixed: (g) => ({ tick() { g.move({ x: 800, y: 300 }); } }),
};
module.exports = { du_shield: pair };
