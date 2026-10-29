'use strict';
/* Banco headless de f_cerro (modelo A, rank). SOLO jugabilidad (no dibuja; el estilo no importa).
     node docs/style-lab/pruebas/fiesta-cerro-bench.js            resumen por nivel y habilidad: llegadas, tiempos, tobos, simetría de asientos, ociosos
     N=100 node …                                                 semillas por celda (por defecto 200)
   Un contexto falso con los 4 asientos «míos» (como la práctica): este proceso simula los 4 cuerpos con el mismo físico y llama a ai() de las CPU.
   Exporta cargar/mkCtx/jugar/medir para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-cerro.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_cerro;
}

function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: -3, in: Array.from({ length: n }, () => ({ x: 0, y: 0, a: false, tap: 0 })), g: null, evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, equipos: [0, 1, 2, 3].slice(0, n), lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: ['#ff7ab0', '#ffb36b', '#3fb0ff', '#4fd06a'][i], cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p) => st.in[p].a, tap: (p) => { const v = st.in[p].tap; st.in[p].tap = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => ({ x: st.in[p].x, y: st.in[p].y }), cpu: new Array(n).fill(false),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: o.mio || (() => true), remoto: o.remoto || (() => null), ev(ty, d) { st.evs.push({ ty, d }); }, out() {}, send: () => true, on() {}, claim() {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* un cuadro (dt = 1/30): ai de las CPU -> update. modos[p] = 'cpu' | 'idle' | función(st,p,api) */
function tick(st, modos, m) {
  const n = st.c.n, api = (p) => ({ press: () => { st.in[p].tap++; }, hold: (b, v) => { st.in[p].a = !!v; }, eje: (x, y) => { st.in[p].x = x; st.in[p].y = y; } });
  st.gt += 1 / 30;
  for (let p = 0; p < n; p++) { const f = modos[p]; if (f === 'cpu') st.g.ai(p, 1 / 30, api(p)); else if (typeof f === 'function') f(st, p, api(p)); }
  st.g.update(1 / 30);
  if (m) m(st);
}
const MINT = 8;
function jugar(st, modos, segs, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30);
  for (let i = 0; i < t + 90; i++) {
    tick(st, modos, m);
    if (st.gt >= st.c.dur) break;
    if (st.gt >= Math.min(MINT, st.c.dur - 1) && st.g.done()) break;
  }
  return st.g.scores();
}
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

/* N partidas con las mismas CPU de habilidad `skill` (cada asiento rngFor propio) */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, dur = o.dur || DEF.dur, modos = o.modos || CPU4;
  const r = { N, llega: 0, llegan: [0, 0, 0, 0, 0], tLlega: [], hits: 0, gana: [0, 0, 0, 0], empG: 0, finT: 0, sc: [0, 0, 0, 0], max: 0, saltosMax: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed, dur, skill: o.skill == null ? 0.6 : o.skill });
    const sc = jugar(st, modos, dur);
    const v = st.g.vista();
    let nl = 0;
    v.tf.forEach((tf, i) => { if (tf) { nl++; r.tLlega.push(tf / 30); r.llega++; } r.hits += v.hits[i]; });
    r.llegan[nl]++;
    const mx = Math.max.apply(null, sc), ws = sc.map((x, i) => (x === mx ? i : -1)).filter((i) => i >= 0);
    if (ws.length === 1) r.gana[ws[0]]++; else r.empG++;
    sc.forEach((x, i) => { r.sc[i] += x; r.max = Math.max(r.max, x); });
    r.finT += st.gt;
  }
  r.pLlega = r.llega / (N * st_n(modos)); r.fin = r.finT / N; r.hitsPP = r.hits / (N * 4);
  r.tLlega.sort((a, b) => a - b);
  r.med = r.tLlega.length ? r.tLlega[r.tLlega.length >> 1] : 0; r.min = r.tLlega.length ? r.tLlega[0] : 0;
  return r;
}
const st_n = (m) => m.length;
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
function fila(r) {
  return 'llegan ' + pct(r.pLlega) + ' · t min/med ' + r.min.toFixed(1) + '/' + r.med.toFixed(1) + ' s · fin medio ' + r.fin.toFixed(1) + ' s · tobos/jug ' + r.hitsPP.toFixed(1) +
    ' · gana asiento ' + r.gana.map((w) => pct(w / r.N)).join(' ') + ' · empate ' + pct(r.empG / r.N) + ' · llegadas por partida [0..4] ' + r.llegan.join('/') + ' · sc max ' + r.max;
}

module.exports = { cargar, mkCtx, tick, jugar, medir, fila, CPU4 };

if (require.main === module) {
  const DEF = cargar();
  for (const lv of [1, 2, 3]) for (const sk of [0.35, 0.6, 0.85]) console.log('lv' + lv + ' skill ' + sk + ' · ' + fila(medir(DEF, { lv, skill: sk })));
  const ocioso = ['idle', 'cpu', 'cpu', 'cpu']; let gana = 0;
  for (let seed = 1; seed <= (+process.env.N || 200); seed++) { const st = mkCtx(DEF, { lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ocioso, DEF.dur); if (sc[0] > Math.min(sc[1], sc[2], sc[3])) gana++; }
  console.log('ocioso (asiento 0) supera a alguna CPU nivel 2 en ' + gana + ' de ' + (+process.env.N || 200) + ' partidas');
}
