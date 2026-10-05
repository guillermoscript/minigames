'use strict';
/* bots for sq_circus (CIRCUS TOWER). Every role balances its own level through the public tilt helper (the same u the keys / drag produce).
   Role-honest: a bot reads only its own tilt (and, for the unicycle, its position and the X), with a human-ish reaction time of ~120 ms,
   and it presses proportionally to what it saw. The unicycle leans toward the X (it rolls where it leans) and eases off as it arrives. */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bot = (g, role) => {
  const hist = [];                                   // the bot acts on what it saw ~120 ms ago
  return {
    tick(T, dt) {
      const v = g.dbg.view(); hist.push(v.a); if (hist.length > 8) hist.shift();
      const seen = hist[0], vel = (hist[hist.length - 1] - hist[0]) / Math.max(1, hist.length - 1);
      const tgt = role === 0 ? clamp((v.spot - v.x) / 240, -.3, .3) : 0;
      g.tilt(clamp(-((seen - tgt) * 9 + vel * 25), -1, 1));
    },
  };
};
module.exports = { sq_circus: n => Array.from({ length: n }, () => bot) };
