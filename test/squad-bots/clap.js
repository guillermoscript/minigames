'use strict';
/* bots for sq_clap (COLA DEL CLAP). Role-honest: each bot reads only its own screen (g.dbg.view()) and drives the public handlers.
   - FOREMAN (0): sees the master list and which stretches are done (the green DONE!). Presses DICTATE (keys 1-3) for every stretch that is not done and whose order
                  was not dictated in the last ~5 s (the order stays on the owner's table for 7 s).
   - STRETCH owners: see their own people and, while it is up, the order the foreman dictated. They remember the last order they saw. Then, one action at a time with a
                  human reaction time and a limited pointer speed (drag = down, move, up):
                  1. a person waiting on an incoming lane whose ticket is in my order and I have an empty spot: take him (drag to the spot);
                  2. a person of mine that is not in my order: hand him to the neighbour on his side (lower than my order = left, higher = right) when that lane is free;
                  3. everybody here is mine: swap people until my order is right. */
const REACT = .22, SPEED = 640;
const foreman = (g, role) => {
  let next = 0;
  return { tick(T, dt) {
    const v = g.dbg.view(); if (T < .3 || T < next) return;
    for (let tr = 0; tr < v.S; tr++) if (!v.ok[tr] && v.dictAge[tr] > 5) { next = T + .22; const e = { code: 'Digit' + (tr + 1) }; g.key(e); g.keyup(e); return; }
  } };
};
const owner = (g, role) => {
  let list = null, ptr = null, plan = null, wait = 0, sig = '';
  const moveTo = (to, dt) => { const dx = to[0] - ptr[0], dy = to[1] - ptr[1], d = Math.hypot(dx, dy), m = SPEED * dt; if (d <= m) { ptr = to.slice(); return true; } ptr = [ptr[0] + dx / d * m, ptr[1] + dy / d * m]; return false; };
  return { tick(T, dt) {
    const v = g.dbg.view(); if (v.dict) list = v.dict;
    if (plan) {                                                   // a drag in progress
      if (plan.stage === 0) { ptr = plan.from.slice(); g.down({ x: ptr[0], y: ptr[1] }); plan.stage = 1; return; }
      if (plan.stage === 1) { if (moveTo(plan.to, dt)) plan.stage = 2; else g.move({ x: ptr[0], y: ptr[1] }); return; }
      g.move({ x: ptr[0], y: ptr[1] }); g.up({ x: ptr[0], y: ptr[1] }); plan = null; wait = T + REACT; return;
    }
    if (!list || v.dragging || T < wait) return;
    const mine = v.slots.filter(s => s.tk), empty = v.slots.find(s => !s.tk);
    const go = (from, to) => { plan = { from: [from.x, from.y], to: [to.x, to.y], stage: 0 }; };
    // 1. take someone I need
    const inc = v.inc.find(q => list.includes(q.tk));
    if (inc && empty) return go(inc, empty);
    // 2. hand over someone that is not mine
    for (const s of mine) if (!list.includes(s.tk)) {
      const dir = s.tk < list[0] ? 'L' : 'R', lane = v.out.find(o => o.dir === dir);
      if (lane && lane.free) return go(s, lane);
    }
    // 3. sort
    if (!empty && mine.every(s => list.includes(s.tk))) {
      for (let i = 0; i < list.length; i++) if (v.slots[i].tk !== list[i]) { const j = v.slots.findIndex(s => s.tk === list[i]); return go(v.slots[j], v.slots[i]); }
    }
  } };
};
module.exports = { sq_clap: n => Array.from({ length: n }, (_, r) => r === 0 ? foreman : owner) };
