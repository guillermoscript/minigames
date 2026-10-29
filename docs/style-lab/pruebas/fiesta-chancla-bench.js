'use strict';
/* Banco headless de f_chancla (FFA supervivencia, modelo B): sin red, UN contexto `c` falso con los 4 asientos «míos».
     node docs/style-lab/pruebas/fiesta-chancla-bench.js [semillas=60]
   Por nivel y habilidad (.3/.6/.9): CPU vivas al cierre, en qué fase cae cada chancletazo (la ESCALADA tiene que notarse: F1 calma, F2 más, F3 a millón),
   chanclas por segundo en cada fase, eventos del patio, chanclas que se robó el perro, ollas agarradas / golpes parados, tumbadas del perro.
   Y la prueba de relámpago (dur 10). */
const path = require('path');
const SL = path.join(__dirname, '..'), SRC = path.join(SL, 'fiesta-juego-chancla.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC]; require(SRC);
  return defs.f_chancla;
}
function mkCtx(DEF, o) {
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 45, lv = o.lv || 1;
  const st = { gt: -3, ta: new Array(n).fill(0), ax: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: [] };
  const c = {
    n, yo: 0, modo: 'ffa', lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }), ahora: () => st.gt, rng: rng.crear(seed),
    rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false, tap: (p) => { const v = st.ta[p]; st.ta[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.ax[p]), cpu: new Array(n).fill(false), skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p, at: st.gt }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); }, out: (p, kk) => c.ev('out', { kk }, p),
    send: () => true, on: () => {}, claim: () => {}, util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c); return st;
}
function jugar(st) {
  const g = st.g, n = st.c.n, dt = 1 / 30, api = (p) => ({ press: () => { st.ta[p]++; }, hold() {}, eje: (x, y) => { st.ax[p] = { x, y }; } });
  let tumbos = 0; const prev = new Array(n).fill(-9);
  while (st.gt < st.c.dur + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) g.ai(p, dt, api(p));
    g.update(dt);
    const v = g.vista(); for (let p = 0; p < n; p++) if (v.stun[p] !== prev[p]) { prev[p] = v.stun[p]; if (v.stun[p] > 0) tumbos++; }
    if (st.gt >= Math.min(3, st.c.dur - 1) && g.done()) break;
    if (st.gt >= st.c.dur) break;
  }
  return tumbos;
}

const DEF = cargar(), N = +process.argv[2] || 60;
for (const dur of [45, 10]) for (const lv of [1, 2, 3]) for (const sk of dur === 45 ? [0.3, 0.6, 0.9] : [0.6]) {
  let vivos = 0, hitsF = [0, 0, 0], ollaT = 0, ollaPar = 0, tumbos = 0, rob = 0, nev = 0, tiempo = 0, cpsF = [0, 0, 0];
  for (let s = 1; s <= N; s++) {
    const st = mkCtx(DEF, { lv, dur, seed: s, skill: sk }); const v0 = st.g.vista();
    tumbos += jugar(st); const v = st.g.vista();
    vivos += v.vivos; rob += v.robadas; nev += v.evs.length; tiempo += Math.min(st.gt, dur);
    const fz = (t) => (t >= v.P3 ? 2 : t >= v.P2 ? 1 : 0), len = [v.P2 - v0.lead, v.P3 - v.P2, dur - v.P3];
    v0.lanz.forEach((a) => { cpsF[fz(a[0])] += 1 / Math.max(0.5, len[fz(a[0])]) / N; });
    st.evs.forEach((e) => { if (e.ty === 'hit') { if (e.d.ol) ollaPar++; else hitsF[fz(e.at)]++; } if (e.ty === 'olla') ollaT++; });
  }
  const f = (x) => (x / N).toFixed(2);
  console.log(`dur${dur} lv${lv} sk${sk}: vivos ${f(vivos)}/4 · golpes F1/F2/F3 ${hitsF.map(f).join('/')} · chanclas/s F1/F2/F3 ${cpsF.map((x) => x.toFixed(1)).join('/')} · eventos ${f(nev)} · robadas ${f(rob)} · ollas ${f(ollaT)} (paró ${f(ollaPar)}) · tumbos ${f(tumbos)} · dura ${f(tiempo)} s`);
}
