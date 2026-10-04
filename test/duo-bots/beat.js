'use strict';
/* bots for du_beat (DUET). Role-honest: each singer bot only reads its own notes as it sees them fall (g.dbg.incoming():
   time left until each reaches its ring) and taps once per note when it meets the ring, with a small human-ish wobble. */
module.exports = {
  du_beat: [0, 1].map(lane => (g) => {
    let done = -1, k = 0;
    const wob = () => ((k++ * 37 + lane * 11) % 7 - 3) * .012;     // -36..+36 ms, deterministic
    let next = wob();
    return {
      tick() {
        const n = g.dbg.incoming()[0];
        if (!n || n.i === done) return;
        if (n.left <= next) { done = n.i; next = wob(); g.tap(); }
      },
    };
  }),
};
