'use strict';
/* bots for du_pago (PAGO MÓVIL). Role-honest, through the public handlers only. The two players talk by voice, which the test cannot carry,
   so the VOICE below stands for the voice chat: the bank bot may only put into it what its own screen showed (g.dbg.view().code while the code
   is on the phone), one symbol every SAY seconds, and the cashier bot only takes from it what has already been "said" (plus a human reaction time).
   - the BANK bot waits for its phone to show the code, dictates it, and when its screen reports a new mistake it taps the phone to see the code again
     and dictates the round again from the start.
   - the CASHIER bot never sees the code: it taps the key of the next symbol it has heard, for the round and position its keypad screen shows. */
const SAY = .4, REACT = .3;
const VOICE = { words: [], round: -1 };
module.exports = {
  du_pago: [
    (g) => {
      VOICE.words = []; VOICE.round = -1;
      let spoken = -1, errs = 0, last = -9;
      return {
        tick(T) {
          const v = g.dbg.view();
          if (v.errs > errs) { errs = v.errs; spoken = -1; if (T - last > .3) { last = T; g.down(g.dbg.tapPt()); } }   // a mistake: look at the phone again and repeat
          if (v.shown && v.code && spoken !== v.round) {
            spoken = v.round; VOICE.round = v.round; VOICE.words = v.code.map((s, i) => ({ s, at: T + SAY * (i + 1) }));
          }
        },
      };
    },
    (g) => {
      let last = -9;
      return {
        tick(T) {
          const v = g.dbg.view();
          if (T - last < .12 || VOICE.round !== v.round) return;
          const w = VOICE.words[v.pos]; if (!w || T < w.at + REACT) return;
          last = T; g.down(g.dbg.keyPt(w.s));
        },
      };
    },
  ],
};
