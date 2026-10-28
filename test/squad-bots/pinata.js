'use strict';
/* bots for sq_pinata (PIÑATA PARTY). Role-honest: each bot reads only what its own screen shows (g.dbg.view()) and acts through the public
   handlers (g.move / g.down for the batter and the rope, g.dbg.cue = the caller's button) at a 0.15 s decision rate.
   - BATTER   blindfolded: only the cue arrows. A valid L/R/U/D arrow = move that many slots; a NOW (and, with two callers, an OK too) = swing
              once nothing else is telling it to move and the bat has settled.
   - ROPE     holds the piñata at the centre slot, lowered (the wind does the rest) and lets go when its arms are spent.
   - CALLERS  compare the piñata with the bat, tell the batter to move; once they match: OK (side caller) / NOW (height caller or the lone caller). */
const COLX = c => 100 + 150 * c, ROWY = [250, 330, 410];
module.exports = {
  sq_pinata: n => {
    const bat = (g, role, { every }) => {
      const st = { n: -1 }; let c = 2, r = 1, movedAt = -9;
      return {
        tick(T, dt) {
          if (every(T, st, .15)) {
            const v = g.dbg.view(); c = v.col; r = v.row;
            if (!v.locked) {
              const dirs = v.cues.filter(q => 'LRUD'.includes(q.k)), last = dirs[dirs.length - 1];
              if (last) {
                if (last.k === 'L') c -= last.n; else if (last.k === 'R') c += last.n; else if (last.k === 'U') r -= last.n; else r += last.n;
                movedAt = T;
              } else if (T - movedAt >= .3 && v.cues.some(q => q.k === 'N') && (n === 3 || v.cues.some(q => q.k === 'O'))) {
                g.move({ x: COLX(c), y: ROWY[r] }); g.down({ x: COLX(c), y: ROWY[r] }); return;
              }
            }
          }
          g.move({ x: COLX(c), y: ROWY[r] });
        },
      };
    };
    const rope = (g, role, { every }) => {
      const st = { n: -1 };
      return { tick(T, dt) { if (every(T, st, .15)) g.move({ x: COLX(2), y: ROWY[1] }); } };
    };
    /* kind: 'a' (columns only), 'b' (heights + timing only), 'c' (everything) */
    const caller = kind => (g, role, { every }) => {
      const st = { n: -1 }; let sent = {};
      const send = (k, T) => { if (T - (sent[k] || -9) >= .3) { sent[k] = T; g.dbg.cue(k); } };
      return {
        tick(T, dt) {
          if (!every(T, st, .15)) return;
          const v = g.dbg.view();
          if (kind !== 'b' && v.pcol !== v.bcol) { send(v.pcol < v.bcol ? 'L' : 'R', T); return; }
          if (kind === 'a') { if (v.colStable >= .25) send('O', T); return; }
          if (!v.lowered || v.rowStable < .25) return;
          if (v.prow !== v.brow) send(v.prow < v.brow ? 'U' : 'D', T); else send('N', T);
        },
      };
    };
    return n === 4 ? [bat, rope, caller('a'), caller('b')] : [bat, rope, caller('c')];
  },
};
