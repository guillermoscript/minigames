'use strict';
/* bots for sq_papagayo (PAPAGAYO EN ENERO). Role-honest, driving the public key handlers like a hand, with a human reaction time (~120 ms):
   OJO      sees the corridor, the gust arrows (the direction the wind will shove the kite and how big the lane jump is) and the windsock forecast.
            Before every lane change he presses LEFT / CENTRE / RIGHT for the lane the arrow announces, and LIGHT / HEAVY (or, with 3 seats, moves
            the tail himself) when the windsock changes.
   CARRETE  sees ONLY its own needle and the call on its screen: holds W / S until the needle sits in the band the call asks for.
   COLA     sees only the call and its own tail weight: holds W / S until the tail is at the weight of the call. */
const REACT = .12, LANE = [-.6, 0, .6], LV = [.25, .8];
const press = (g, code) => { const e = { code }; g.key(e); g.keyup(e); };
const delayed = () => { const q = []; return (T, v) => { q.push([T, v]); while (q.length > 1 && q[1][0] <= T - REACT) q.shift(); return q[0][1]; }; };

const ojo = n => g => {
  const done = new Set(); let lane = 1, lastCs = 0, lastCw = -1, held = 0; const seen = delayed(), seenFc = delayed();
  return { tick(T, dt) {
    const v = g.dbg.view();
    // steering: the arrow's direction and size tell how far the gap jumps (opposite to the shove); call that lane once the shift is close
    let want = lane;
    for (const a of v.arrows) {
      const to = Math.max(0, Math.min(2, lane + (-a.pd) * a.mag));
      if (v.S >= a.t) { if (!done.has(a.t)) { done.add(a.t); lane = to; } want = lane; }
      else if (a.t - v.S < .52) { want = to; break; }
    }
    const tgt = seen(T, want), cs = tgt - 1;
    if (cs !== lastCs) { lastCs = cs; press(g, 'Digit' + (cs + 2)); }
    // tail: from the windsock forecast
    const heavy = seenFc(T, v.fc > .5 ? 1 : 0);
    if (n === 4) { if (heavy !== lastCw) { lastCw = heavy; press(g, heavy ? 'KeyE' : 'KeyQ'); } }
    else {
      const goal = heavy ? LV[1] : LV[0], d = goal - v.val;
      const want2 = d > .03 ? 1 : d < -.03 ? -1 : 0;
      if (want2 !== held) { if (held) g.keyup({ code: held > 0 ? 'KeyE' : 'KeyQ' }); held = want2; if (held) g.key({ code: held > 0 ? 'KeyE' : 'KeyQ' }); }
    }
  } };
};
const carrete = (g, role) => {
  let held = 0; const seen = delayed();
  return { tick(T, dt) {
    const v = g.dbg.view(), cs = seen(T, v.cs);
    const tg = cs === 0 ? .5 : ((cs < 0) === (role === 1)) ? .72 : .28, d = tg - v.T;
    const want = d > .025 ? 1 : d < -.025 ? -1 : 0;
    if (want !== held) { if (held) g.keyup({ code: held > 0 ? 'KeyW' : 'KeyS' }); held = want; if (held) g.key({ code: held > 0 ? 'KeyW' : 'KeyS' }); }
  } };
};
const cola = g => {
  let held = 0; const seen = delayed();
  return { tick(T, dt) {
    const v = g.dbg.view(), cw = seen(T, v.cw);
    const goal = cw < 0 ? v.val : cw ? .8 : .25, d = goal - v.val;
    const want = d > .03 ? 1 : d < -.03 ? -1 : 0;
    if (want !== held) { if (held) g.keyup({ code: held > 0 ? 'KeyW' : 'KeyS' }); held = want; if (held) g.key({ code: held > 0 ? 'KeyW' : 'KeyS' }); }
  } };
};
module.exports = { sq_papagayo: n => n === 4 ? [ojo(4), carrete, carrete, cola] : [ojo(3), carrete, carrete] };
