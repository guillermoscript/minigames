'use strict';
/* Banco headless de f_mudanza (2v2 cooperativo, modelo C). SOLO jugabilidad (no dibuja).
     node docs/style-lab/pruebas/fiesta-mudanza-bench.js          resumen: simetría de lados por nivel, empates, llegadas y tiempos, fuerte contra débil, un ocioso, dos ociosos
     N=100 NS=800 node …                                          semillas por celda (por defecto 120) y en la simetría de lados (por defecto 1500)
   Dos formas de jugar:
     · medir(): LIVE.sim('f_mudanza', …) = sesión REAL con los 4 asientos CPU (juez, fin temprano, compara, hash).
     · mkCtx()/jugar(): contexto falso con control fino por asiento: 'cpu' (ai del juego), 'idle' (humano que no toca nada) o función(st,p,api) (guion: api.eje/hold).
       Los asientos que no son 'cpu' cuentan como HUMANOS para la CPU (c.cpu[p] = false): su pana CPU se alinea a su punta.
   El ganador sale de FIESTA.reglas.compara (M3 DM3-4). El catálogo compartido aún no trae f_mudanza: CAT/LIM es la entrada que debe llevar (se inyecta en memoria, nada compartido se toca).
   Exporta cargar/mkCtx/tick/jugar/medir/medirCtx para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
globalThis.window = globalThis;
globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng: require(path.join(SL, 'fiesta-rng.js')), reglas: require(path.join(SL, 'fiesta-reglas.js')) });
const LIVE = require(path.join(SL, 'fiesta-live.js'));
const SRC = path.join(SL, 'fiesta-juego-mudanza.js');
const rng = globalThis.FIESTA.rng, reglas = globalThis.FIESTA.reglas;
/* la entrada de catálogo que debe llevar fiesta-reglas.js (la añade quien tenga ese archivo) */
const LIM = { scoreMax: 100, scoreRate: 7, minT: 15, finTemprano: 1 };
const CAT0 = reglas.CATALOGO.filter((x) => x.g === 'f_mudanza')[0];
const CAT = Object.assign({ g: 'f_mudanza', m: ['2v2'], cl: 'binary', dur: 45, mo: 'C', live: 1 }, CAT0 || {}, (CAT0 && CAT0.lim) ? {} : { lim: LIM });

function cargar() { if (!LIVE.get('f_mudanza')) { delete require.cache[SRC]; require(SRC); } return LIVE.get('f_mudanza'); }

/* in[p] = {x,y,a,tap} */
function mkCtx(DEF, o) {
  o = o || {};
  const n = 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, modos = o.modos || CPU4;
  const st = { gt: 0, in: Array.from({ length: n }, () => ({ x: 0, y: 0, a: false, tap: 0 })), g: null, modos };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: '2v2', solo: -1, equipos: o.equipos || [0, 0, 1, 1], lv, dur, practica: false, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: modos[i] === 'cpu', human: modos[i] !== 'cpu', team: i < 2 ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p) => !!st.in[p].a, tap: (p) => { const v = st.in[p].tap; st.in[p].tap = 0; return v; }, eje: (p) => ({ x: st.in[p].x, y: st.in[p].y }),
    cpu: Array.from({ length: n }, (_, i) => modos[i] === 'cpu'),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => o.juez !== false, mio: () => true, remoto: () => null, ev() {}, out() {}, claim() {}, send: () => true, on() {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* un tick del juez: ai de las CPU / guiones -> step -> update */
function tick(st, modos) {
  modos = modos || st.modos;
  const api = (p) => ({ press: () => { st.in[p].tap++; }, hold: (b, v) => { if (b !== 'b') st.in[p].a = !!v; }, eje: (x, y) => { st.in[p].x = x; st.in[p].y = y; } });
  for (let p = 0; p < st.c.n; p++) { const f = modos[p]; if (f === 'cpu') st.g.ai(p, 1 / 30, api(p)); else if (typeof f === 'function') f(st, p, api(p)); else if (f === 'idle') { st.in[p].x = 0; st.in[p].y = 0; st.in[p].a = false; } }
  st.g.step(1 / 30); st.gt += 1 / 30; st.g.update(1 / 30);
}
/* juega hasta que done() lo permita (tras minT) o hasta dur; devuelve scores() */
function jugar(st, modos, segs, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30), minT = Math.min(LIM.minT, st.c.dur - 1);
  for (let i = 0; i < t; i++) { tick(st, modos); if (m) m(st); if (st.gt >= minT && st.g.done()) break; }
  return st.g.scores();
}
const veredicto = (st) => reglas.compara('2v2', st.c.equipos, st.g.scores());
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

function nuevo() { return { N: 0, w0: 0, w1: 0, emp: 0, llega: [0, 0], tLl: [0, 0], ray: [0, 0], alguno: 0, prog: [0, 0], fin: 0 }; }
function anota(r, ganaLado, v, gt) {
  r.N++;
  if (ganaLado === 'eq0') r.w0++; else if (ganaLado === 'eq1') r.w1++; else r.emp++;
  let al = false;
  for (let q = 0; q < 2; q++) { const T = v.T[q]; r.ray[q] += T.ray; r.prog[q] += T.arr ? 1 : T.prog / (v.SMAX - 2); if (T.arr) { r.llega[q]++; r.tLl[q] += T.arr / 30; al = true; } }
  if (al) r.alguno++;
  r.fin += gt;
}
/* N partidas con LIVE.sim (sesión real, 4 CPU) */
function medir(DEF, o) {
  o = o || {}; void DEF;
  const N = o.N || +process.env.N || 120, r = nuevo();
  for (let seed = 1; seed <= N; seed++) {
    const x = LIVE.sim('f_mudanza', { tipo: '2v2', seed: seed + (o.seedBase || 0), lv: o.lv || 1, dur: o.dur || 45, skill: o.skill == null ? 0.6 : o.skill });
    anota(r, x.ganaLado, x.vista, x.kk / 30);
  }
  return r;
}
/* partidas con el contexto falso (control por asiento) */
function medirCtx(DEF, o) {
  o = o || {};
  const N = o.N || 80, r = nuevo();
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed: seed + (o.seedBase || 0), dur: o.dur || 45, skill: o.skill == null ? 0.6 : o.skill, modos: o.modos || CPU4 });
    jugar(st, o.modos || CPU4, o.dur || 45);
    const ve = veredicto(st), p = ve.puestos;
    anota(r, p[0] === p[2] ? 'empate' : p[0] === 1 ? 'eq0' : 'eq1', st.g.vista(), st.gt);
  }
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
const f1 = (x) => x.toFixed(1).padStart(4);
function fila(r) {
  return 'eq0 ' + pct(r.w0 / r.N) + ' eq1 ' + pct(r.w1 / r.N) + ' emp ' + pct(r.emp / r.N) + ' · |Δ| ' + f1(Math.abs(r.w0 - r.w1) / r.N * 100) + ' pp · llegan ' + pct(r.llega[0] / r.N) + '/' + pct(r.llega[1] / r.N) +
    ' (alguno ' + pct(r.alguno / r.N) + ') en ' + f1(r.tLl[0] / Math.max(1, r.llega[0])) + '/' + f1(r.tLl[1] / Math.max(1, r.llega[1])) + ' s · rayones ' + f1(r.ray[0] / r.N) + '/' + f1(r.ray[1] / r.N) + ' · fin ' + f1(r.fin / r.N) + ' s';
}

/* espejo EXACTO: las CPU del equipo 1 con la misma corriente de azar que las del equipo 0 ⇒ los dos sofás canónicos deben ser idénticos en cada tick (y empatar) */
function espejo(DEF, o) {
  o = o || {};
  let dif = 0, emp = 0;
  for (let seed = 1; seed <= (o.N || 20); seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed }), c = st.c, orig = c.rngFor;
    c.rngFor = (t) => orig(t === 'cpu2' ? 'cpu0' : t === 'cpu3' ? 'cpu1' : t); c.rng = rng.crear(seed); st.g = DEF.mk(c);
    let d = false;
    for (let i = 0; i < Math.round(c.dur * 30) && !d; i++) { tick(st); const p = st.g.pack(); for (let z = 2; z < 12; z++) if (p[z] !== p[z + 10]) d = true; }
    if (d) dif++; const ve = veredicto(st); if (ve.puestos[0] === ve.puestos[2]) emp++;
  }
  return { dif, emp, N: o.N || 20 };
}

function resumen(DEF) {
  const N = +process.env.N || 120, NSIM = +process.env.NS || 1500;
  console.log('f_mudanza · banco (N=' + N + ' semillas por celda, ' + NSIM + ' en la simetría: con 50/50 real el ruido de |Δ| es ±' + (196 / Math.sqrt(NSIM)).toFixed(1) + ' pp al 95 %; LIVE.sim = sesión real con 4 CPU; gana quien decide compara)');
  let ok = true;
  const out = {};
  for (const lv of [1, 2, 3]) {
    const r = medir(DEF, { lv, skill: 0.6, N: NSIM }); out['lv' + lv] = r;
    console.log('  lv' + lv + ' skill .6   ' + fila(r));
    if (Math.abs(r.w0 - r.w1) / r.N > 0.1) ok = false;
    if (lv === 1 && (r.alguno / r.N < 0.8)) ok = false;
  }
  for (const lv of [1, 2, 3]) { const e = espejo(DEF, { lv }); console.log('  lv' + lv + ' espejo exacto (misma suerte en los dos equipos): ' + (e.N - e.dif) + '/' + e.N + ' idénticos tick a tick, ' + e.emp + '/' + e.N + ' empates'); if (e.dif) ok = false; }
  for (const sk of [0.35, 0.85]) { const r = medir(DEF, { lv: 1, skill: sk }); console.log('  lv1 skill ' + sk + '  ' + fila(r)); }
  let fw = 0, fN = 0;
  for (const lv of [1, 2, 3]) {
    const a = medir(DEF, { lv, skill: [0.9, 0.9, 0.3, 0.3], N: Math.ceil(N / 2) }), b = medir(DEF, { lv, skill: [0.3, 0.3, 0.9, 0.9], N: Math.ceil(N / 2), seedBase: 5000 });
    const w = a.w0 + b.w1, nn = a.N + b.N; fw += w; fN += nn;
    console.log('  lv' + lv + ' fuerte .9+.9 vs débil .3+.3 (los dos lados)   fuerte gana ' + pct(w / nn) + ' · empate ' + pct((a.emp + b.emp) / nn) + ' · fuerte llega en ' + f1((a.tLl[0] + b.tLl[1]) / Math.max(1, a.llega[0] + b.llega[1])) + ' s, débil llega ' + pct((a.llega[1] + b.llega[0]) / nn) + ' (la carrera cierra 2 s tras la primera llegada)');
  }
  if (fw / fN < 0.85) ok = false;
  const uno = medirCtx(DEF, { N: 60, modos: ['cpu', 'idle', 'cpu', 'cpu'] });
  console.log('  1 CPU + 1 ocioso (eq0) vs 2 CPU .6   eq0 gana ' + pct(uno.w0 / uno.N) + ' · llega ' + pct(uno.llega[0] / uno.N) + ' (eq1 ' + pct(uno.llega[1] / uno.N) + ') · subió ' + pct(uno.prog[0] / uno.N) + ' vs ' + pct(uno.prog[1] / uno.N));
  const uno2 = medirCtx(DEF, { N: 60, modos: ['idle', 'cpu', 'cpu', 'cpu'] });
  console.log('  1 ocioso + 1 CPU (eq0, la CPU atrás) vs 2 CPU   eq0 gana ' + pct(uno2.w0 / uno2.N) + ' · subió ' + pct(uno2.prog[0] / uno2.N) + ' vs ' + pct(uno2.prog[1] / uno2.N));
  const dos = medirCtx(DEF, { N: 60, modos: ['idle', 'idle', 'cpu', 'cpu'] });
  console.log('  2 ociosos (eq0) vs 2 CPU .6   eq0 gana ' + pct(dos.w0 / dos.N) + ' · empate ' + pct(dos.emp / dos.N) + ' · eq1 ' + pct(dos.w1 / dos.N));
  if (uno.w0 / uno.N > 0.2 || dos.w0 > 0) ok = false;
  const am = medirCtx(DEF, { N: 60, modos: ['idle', 'idle', 'idle', 'idle'] });
  console.log('  4 ociosos   empate ' + pct(am.emp / am.N));
  console.log(ok ? 'OK: simetría ±10 pp, lv1 termina, fuerte ≥85 %, ociosos pierden' : 'FUERA DE RANGO');
  return ok;
}

module.exports = { cargar, mkCtx, tick, jugar, medir, medirCtx, espejo, veredicto, CAT, CPU4, LIVE, LIM };
if (require.main === module) { const DEF = cargar(); process.exit(resumen(DEF) ? 0 : 1); }
