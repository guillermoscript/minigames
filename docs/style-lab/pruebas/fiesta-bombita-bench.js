'use strict';
/* Banco headless de f_bombita (FFA survival, modelo B). SOLO jugabilidad (no dibuja).
     node docs/style-lab/pruebas/fiesta-bombita-bench.js            resumen: reparto por asiento, bombita, golpes, habilidad, ociosos (un contexto falso: este proceso hace de juez y simula las 4 CPU)
     N=200 node …                                                   semillas por celda (por defecto 200)
     node docs/style-lab/pruebas/fiesta-bombita-bench.js --red      sobre el stack REAL con 1/150/300 ms: ventaja del juez (informativo; N=24 por defecto)
   «Igual habilidad» = las 4 CPU con la misma skill. Ganador = puesto 1 de LIVE.sim (empates reparten la victoria). Ventaja del juez <= 1/n + 8 pp = 33 %. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-bombita.js');
globalThis.window = globalThis;
const LIVE = require(path.join(SL, 'fiesta-live.js'));
globalThis.FIESTA.rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = globalThis.FIESTA.reglas = require(path.join(SL, 'fiesta-reglas.js'));
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_bombita')[0];
Object.assign(CAT, { dur: 40, live: 1, lim: { scoreMax: 1201, scoreRate: 31, minT: 3, finTemprano: 1 } });   // la línea propuesta, solo en memoria
require(SRC);

/* Un solo contexto falso (yo = -1): este proceso hace de juez y simula a las 4 CPU con el `ai` del juego, sin ventaja de «asiento humano» (todas por el camino de las CPU).
   modos[p] = 'cpu' | 'idle'. El ganador sale de los puntajes (los empates en el primer puesto reparten la victoria). */
const rng = globalThis.FIESTA.rng, DEF = LIVE.get('f_bombita');
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 40, lv = o.lv || 1;
  const st = { gt: -1, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: { pasa: 0, out: 0 } };
  const c = {
    n, yo: -1, modo: 'ffa', solo: -1, lv, dur, practica: false, modelo: 'B', dt: 1 / 30, seats: [], campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => LIVE.util.rngFrom(seed, t), fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; }, eje: (p) => st.axes[p],
    cpu: new Array(n).fill(true), skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null, claim() {}, out: (p, kk) => c.ev('out', { kk }, p), send: () => true, on() {},
    ev: (ty, d, p) => { if (st.evs[ty] !== undefined) st.evs[ty]++; st.g.onEv(ty, p, d, st.gt); }, util: { pj() {}, suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
function jugar(st, modos) {
  const n = st.c.n, dt = 1 / 30, api = (p) => ({ press: () => { st.taps[p]++; }, hold() {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  while (st.gt < st.c.dur) {
    if (st.gt >= 3 && st.g.done()) break; st.gt += dt; for (let p = 0; p < n; p++) if (!modos || modos[p] !== 'idle') st.g.ai(p, dt, api(p)); st.g.update(dt); }
  return st.g.scores();
}
function medir(o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, r = { N, win: [0, 0, 0, 0], sc: [0, 0, 0, 0], sum: 0, max: 0, empate1: 0, golpes: 0, embest: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx({ n: 4, seed, lv: o.lv || 1 + (seed % 3), dur: 40, skill: o.skill == null ? 0.6 : o.skill }), sc = jugar(st, o.modos);
    const m = Math.max.apply(null, sc), g = sc.filter((v) => v === m).length;
    sc.forEach((v, i) => { if (v === m) r.win[i] += 1 / g; r.sc[i] += v; r.max = Math.max(r.max, v); });
    r.sum += sc.reduce((a, b) => a + b, 0); if (g > 1) r.empate1++; r.golpes += st.evs.out; r.embest += st.evs.pasa;
  }
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
function fila(r) { return 'gana por asiento ' + r.win.map((w) => pct(w / r.N)).join(' ') + ' · bombita/asiento ' + r.sc.map((v) => (v / r.N).toFixed(1)).join(' ') + ' · total ' + (r.sum / r.N).toFixed(0) + ' · máx ' + r.max + ' · empate arriba ' + pct(r.empate1 / r.N) + ' · pases ' + (r.embest / r.N).toFixed(1) + ' estallidos ' + (r.golpes / r.N).toFixed(1); }

function resumen() {
  console.log('f_bombita · banco (N=' + (+process.env.N || 200) + ' semillas por celda; 4 CPU de igual habilidad; niveles 1-3 rotando salvo que se diga)');
  let ok = true; const lim = 1 / 4 + 0.08;
  const g = medir({ skill: 0.6 }); console.log('  skill .6 (lv rota)  ' + fila(g)); if (Math.max.apply(null, g.win) / g.N > lim) ok = false;
  for (const lv of [1, 2, 3]) { const r = medir({ lv, skill: 0.6 }); console.log('  lv' + lv + ' skill .6       ' + fila(r)); if (Math.max.apply(null, r.win) / r.N > lim) ok = false; }
  for (const sk of [0.35, 0.85]) { const r = medir({ skill: sk }); console.log('  skill ' + sk + '          ' + fila(r)); if (Math.max.apply(null, r.win) / r.N > lim) ok = false; }
  const N = +process.env.N || 200, w = [0, 0, 0, 0];
  for (let seed = 1; seed <= N; seed++) { const sc = jugar(mkCtx({ n: 4, seed, lv: 1 + (seed % 3), skill: [0.9, 0.6, 0.6, 0.3] })), m = Math.max.apply(null, sc), k = sc.filter((v) => v === m).length; sc.forEach((v, i) => { if (v === m) w[i] += 1 / k; }); }
  console.log('  skills .9/.6/.6/.3  gana por asiento ' + w.map((x) => pct(x / N)).join(' ')); if (!(w[0] > w[3])) ok = false;
  const oc = medir({ modos: ['idle', 'cpu', 'cpu', 'cpu'] }); console.log('  1 ocioso + 3 CPU    ' + fila(oc) + '   (el ocioso no debe ganar)'); if (oc.win[0] / oc.N > 0.02) ok = false;
  const oc2 = medir({ modos: ['idle', 'idle', 'cpu', 'cpu'] }); console.log('  2 ociosos + 2 CPU   ' + fila(oc2)); if ((oc2.win[0] + oc2.win[1]) / oc2.N > 0.02) ok = false;
  console.log(ok ? 'OK: ningún asiento gana más de 1/n + 8 pp (33 %) con bots iguales; la habilidad importa; los ociosos no ganan' : 'FUERA DE RANGO: revisa simetría de asientos / habilidad / ociosos');
  return ok;
}

/* sobre el stack REAL: 4 humanos-bot, retardo fijo, sin pérdida. Mide la ventaja del juez (el juez es el asiento a) y el veredicto único. */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes } = require(path.join(__dirname, '../../../test/helpers/live-arnes.js'));
  const N = +(process.env.N || 24);
  console.log('f_bombita · stack REAL, ' + N + ' partidas por celda, 4 bots skill .6, sin pérdida, dur 40 s');
  for (const delay of [1, 150, 300]) {
    let jw = 0, tot = 0, sc0 = 0, sci = 0;
    for (let seed = 1; seed <= N; seed++) {
      const H = await arnes({ game: 'f_bombita', dur: 40, humans: 4, loss: 0, delay, seed, lv: 1 + (seed % 3) });
      H.bot = {}; H.ids.forEach((sid) => { H.bot[sid] = { skill: 0.6 }; });
      await H.arrancar(); await H.cerrar(60);
      const res = H.res(); if (!res) { H.cerrarTodo(); continue; }
      tot++; const ji = H.ids.indexOf(H.mj().juez), g = res.puestos.filter((p) => p === 1).length;
      if (res.puestos[ji] === 1) jw += 1 / g;
      res.sc.forEach((v, i) => { if (i === ji) sc0 += v; else sci += v / 3; });
      H.cerrarTodo();
    }
    console.log('  retardo ' + String(delay).padStart(3) + ' ms: gana el juez ' + pct(jw / Math.max(1, tot)) + ' (límite 33 %) · bombita juez ' + (sc0 / Math.max(1, tot)).toFixed(1) + ' vs otros ' + (sci / Math.max(1, tot)).toFixed(1) + ' (' + tot + ' partidas)');
  }
}

module.exports = { mkCtx, jugar, medir, CAT };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else process.exit(resumen() ? 0 : 1);
}
