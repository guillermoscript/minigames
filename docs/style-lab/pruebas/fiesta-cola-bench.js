'use strict';
/* Banco headless de f_cola (FFA rank, modelo A). SOLO jugabilidad (no dibuja).
     node docs/style-lab/pruebas/fiesta-cola-bench.js        N=100 node …  (semillas por celda, por defecto 100)
   Por nivel y habilidad (0,35 / 0,6 / 0,85): % de partidas con ganador por llegada, tiempo medio de llegada, coleadas por CPU y reparto de victorias por asiento
   con 4 CPU iguales; y un humano «perfecto» (8 toques/s, para en el aviso) contra 3 CPU de nivel 2. */
const path = require('path'), SL = path.join(__dirname, '..'), rng = require(path.join(SL, 'fiesta-rng.js'));
const fnv = (s) => { s = String(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const defs = {}; globalThis.window = globalThis;
globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
require(path.join(SL, 'fiesta-juego-cola.js')); const DEF = defs.f_cola;
function partida(lv, seed, skill, humano) {
  const n = 4, st = { gt: -3, taps: [0, 0, 0, 0] };
  const c = { n, yo: 0, modo: 'ffa', solo: -1, lv, dur: DEF.dur, practica: false, modelo: 'A', dt: 1 / 30, seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], ch: 'tu', color: '#fff' })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }), ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear(fnv(seed + ':' + t)),
    fx: () => 0.5, held: () => false, tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; }, eje: () => ({ x: 0, y: 0 }), cpu: [0, 0, 0, 0], skill: [skill, skill, skill, skill],
    juez: () => true, mio: () => true, remoto: () => null, ev() {}, out() {}, send: () => true, on() {}, claim() {}, util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj() {}, tick: (g) => Math.floor(g * 30) } };
  const g = DEF.mk(c), api = (p) => ({ press: () => { st.taps[p]++; }, hold() {}, eje() {} });
  let nx = 0;
  while (st.gt < DEF.dur + 1) {
    st.gt += 1 / 30;
    for (let p = 0; p < n; p++) { if (humano && p === 0) { if (g.vista().est === 'verde' && st.gt >= nx) { st.taps[0]++; nx = st.gt + 0.125; } } else g.ai(p, 1 / 30, api(p)); }
    g.update(1 / 30);
    if (st.gt >= DEF.limites.minT && g.done()) break;
    if (st.gt >= DEF.dur) break;
  }
  return { sc: g.scores(), v: g.vista(), t: st.gt };
}
const N = +process.env.N || 100;
for (const lv of [1, 2, 3]) for (const sk of [0.35, 0.6, 0.85]) {
  let llegan = 0, tt = 0, cn = 0; const w = [0, 0, 0, 0];
  for (let s = 1; s <= N; s++) { const r = partida(lv, s, sk); if (r.v.primero >= 0) { llegan++; tt += r.t; } cn += r.v.cn.reduce((a, b) => a + b, 0) / 4; const top = Math.max.apply(null, r.sc); r.sc.forEach((x, i) => { if (x === top) w[i]++; }); }
  console.log(`nv${lv} skill ${sk}: llegan ${(100 * llegan / N).toFixed(0)} %  t medio ${(tt / Math.max(1, llegan)).toFixed(1)} s  coleadas/CPU ${(cn / N).toFixed(2)}  victorias/asiento ${w.map((x) => (100 * x / N).toFixed(0)).join('/')}`);
}
for (const lv of [1, 2, 3]) { let g = 0, t = 0; for (let s = 1; s <= N; s++) { const r = partida(lv, s, 0.6, true); if (r.sc[0] === Math.max.apply(null, r.sc)) g++; t += r.t; } console.log(`humano perfecto (8/s) vs 3 CPU .6, nv${lv}: gana ${(100 * g / N).toFixed(0)} %  duración media ${(t / N).toFixed(1)} s`); }
