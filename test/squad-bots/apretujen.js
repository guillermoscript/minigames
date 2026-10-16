'use strict';
/* bots for sq_apretujen (¡APRETUJEN!). Role-honest: each bot reads only what its seat sees through g.dbg (own pile and the needle, the queue, the road
   for the driver) with a ~120 ms reaction delay, and acts through the public handlers (tilt() = the same u the keys / drag produce, down()/up() = a tap). */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const collector = (g, role) => {
  let last = -9;
  return { tick(T, dt) {
    const v = g.dbg.view();
    if (T < .6 || T - last < 1.15 || !v.ready || v.aboard >= 12) return;
    if (Math.abs(v.tilt) > .42) return;                                  // wait for the needle to come back before pulling the next one in
    last = T; g.down({ x: 100, y: 400 }); g.up({ x: 100, y: 400 });
  } };
};
const passenger = (g, role) => {
  const hist = [];
  return { tick(T, dt) {
    const v = g.dbg.view(); hist.push([v.p, v.tilt]); if (hist.length > 8) hist.shift();
    const [p, tl] = hist[0];
    g.tilt(clamp(-(p * 1.5 + tl * .5), -1, 1));
  } };
};
const driver = (g, role) => {
  const hist = [];
  return { tick(T, dt) {
    const v = g.dbg.view(); hist.push(v.lane); if (hist.length > 8) hist.shift();
    const seen = hist[0], nx = v.next;
    let tgt = .5; if (nx && nx.s0 - v.S < 2.4) tgt = nx.x >= .5 ? .08 : .92;
    g.tilt(clamp((tgt - seen) * 8, -1, 1));
  } };
};
module.exports = { sq_apretujen: n => n === 4 ? [collector, passenger, passenger, driver] : [collector, passenger, passenger] };
