'use strict';
/* bots for sq_relay (RELAY RACE). Role-honest: each bot reads only what its own screen draws (g.dbg.view(): my position in my leg, the obstacles
   I can SEE, my green zone, and, as a coach, the runner I coach) and acts through the public handlers like a hand would.
   - RUNNER: hurdles = tap just before a visible hurdle; mud = mash while in / about to enter a patch; wind = hold while in a gust;
     puddles = move to the lane without the next visible puddle; everybody presses PASS once deep inside the green zone.
   - COACH (waiting for the baton, or the first runner once it has passed): flashes the next obstacle of the runner in front, ~4 times a second. */
module.exports = {
  sq_relay: n => Array.from({ length: n }, () => (g, role, { every }) => {
    const st = {}, ms = {}; let jumped = -1, downed = false;
    const tap = y => { g.down({ x: 400, y }); g.up({ x: 400, y }); };
    return {
      tick(T) {
        const v = g.dbg.view();
        if (v.mode === 'coach') { if (every(T, st, .25) && v.coach.next) tap(300); return; }
        if (v.mode !== 'run') { if (downed) { downed = false; g.up({ x: 0, y: 0 }); } return; }
        if (!v.last && !v.passed && v.x >= v.Z0 && (v.x - v.Z0) / (v.L - v.Z0) >= .62) { if (downed) { downed = false; g.up({ x: 0, y: 0 }); } tap(v.laneY); return; }
        const nx = v.obs.find(o => o.x + (o.w || 0) > v.x);
        const k = g.dbg.kind;
        if (k === 'hurdle') { if (nx && nx.k === 'hurdle' && nx.x - v.x < v.V * .2 && nx.i !== jumped) { jumped = nx.i; tap(v.laneY); } }
        else if (k === 'mud') { const inM = v.obs.find(o => v.x >= o.x - 40 && v.x <= o.x + o.w); if (inM && every(T, ms, .06)) tap(v.laneY); }
        else if (k === 'wind') {
          const w = v.obs.find(o => v.x >= o.x - 15 && v.x <= o.x + o.w);
          if (w && !downed) { downed = true; g.down({ x: 400, y: v.laneY }); } else if (!w && downed) { downed = false; g.up({ x: 400, y: v.laneY }); }
        } else {
          const p = v.obs.find(o => o.k === 'puddle' && o.x - v.x < 260 && o.x - v.x > -30);
          g.move({ x: 400, y: v.laneYOf(p ? 1 - p.lane : v.lane) });
        }
      },
    };
  }),
};
