'use strict';
/* Banco headless de f_chocones (2v2, modelo C). SOLO jugabilidad (no dibuja).
     node docs/style-lab/pruebas/fiesta-chocones-bench.js        resumen: simetría de lados por nivel, empates, habilidad, ociosos, puntos (LIVE.sim = create() REAL con 4 CPU)
     N=100 node …                                                semillas por celda (por defecto 400)
   Dos formas de jugar:
     · medir(): LIVE.sim('f_chocones', …) = sesión real con los 4 asientos CPU (juez, terminar, compara, hash).
     · mkCtx()/jugar(): contexto falso con control fino por asiento: 'cpu' (ai del juego dentro del juez), 'idle' (null) o función(st,p,api) con api.press/hold/eje.
   El ganador sale de FIESTA.reglas.compara (M3 DM3-4). «Igual habilidad» = las 4 CPU con la misma skill.
   El catálogo compartido aún no trae f_chocones: este banco lo inyecta EN MEMORIA (CAT, con lim) antes de cargar el juego, así LIVE.add valida la paridad.
   Exporta cargar/mkCtx/tick/jugar/medir/medirCtx para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
globalThis.window = globalThis;
globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng: require(path.join(SL, 'fiesta-rng.js')), reglas: require(path.join(SL, 'fiesta-reglas.js')) });
const LIVE = require(path.join(SL, 'fiesta-live.js'));
const SRC = path.join(SL, 'fiesta-juego-chocones.js');
const rng = globalThis.FIESTA.rng, reglas = globalThis.FIESTA.reglas;
/* lo que debe llevar el catálogo (fiesta-reglas.js) — lo añade quien tenga ese archivo */
const LIM = { scoreMax: 30, scoreRate: 1.5, minT: 33, finTemprano: 1 };
const CAT = { g: 'f_chocones', m: ['2v2'], cl: 'binary', dur: 40, mo: 'C', live: 1, lim: LIM };
if (!reglas.CATALOGO.some((x) => x.g === 'f_chocones')) reglas.CATALOGO.push(CAT);

function cargar() { if (!LIVE.get('f_chocones')) { delete require.cache[SRC]; require(SRC); } return LIVE.get('f_chocones'); }

function mkCtx(DEF, o) {
  o = o || {};
  const n = 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, yo = o.yo === undefined ? 0 : o.yo;
  const humanos = o.humanos || [];
  const st = { gt: 0, in: Array.from({ length: n }, () => ({ tap: 0, a: false, x: 0, y: 0 })), g: null, handlers: {}, sent: [], evs: [] };
  const c = {
    n, yo, modo: '2v2', solo: -1, equipos: o.equipos || [0, 0, 1, 1], lv, dur, practica: false, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i < 2 ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p) => !!st.in[p].a, tap: (p) => { const v = st.in[p].tap; st.in[p].tap = 0; return v; }, eje: (p) => ({ x: st.in[p].x, y: st.in[p].y }),
    cpu: Array.from({ length: n }, (_, i) => humanos.indexOf(i) < 0),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => o.juez !== false, mio: () => true, remoto: () => null, ev(ty, d) { st.evs.push({ ty, d }); }, out() {}, claim() {},
    send: (t, d) => { st.sent.push({ t, d }); return true; }, on: (t, fn) => { st.handlers[t] = fn; },
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* un tick del juez: ai/guion de cada asiento -> step -> update. modos[p] = 'cpu' | null (ocioso) | función(st,p,api) */
function tick(st, modos) {
  const n = st.c.n;
  const api = (p) => ({ press: () => { st.in[p].tap++; }, hold: (b, v) => { st.in[p].a = !!v; }, eje: (x, y) => { st.in[p].x = Math.max(-1, Math.min(1, x)); st.in[p].y = Math.max(-1, Math.min(1, y)); } });
  for (let p = 0; p < n; p++) {
    const f = (modos || [])[p];
    if (f === 'cpu') st.g.ai(p, 1 / 30, api(p));
    else if (typeof f === 'function') f(st, p, api(p));
  }
  st.g.step(1 / 30); st.gt += 1 / 30; st.g.update(1 / 30);
}
/* juega `segs` (por defecto dur) o hasta done() como el runtime (finTemprano tras minT) */
function jugar(st, modos, segs, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30), minT = Math.min(33, st.c.dur - 1);
  for (let i = 0; i < t; i++) { tick(st, modos); if (m) m(st); if (segs == null && st.gt >= minT && st.g.done()) break; }
  return st.g.scores();
}
const veredicto = (st) => reglas.compara('2v2', st.c.equipos, st.g.scores());
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

/* N partidas con LIVE.sim (sesión real, 4 CPU). Devuelve recuentos por lado. */
function medir(DEF, o) {
  o = o || {}; void DEF;
  const N = o.N || +process.env.N || 400, dur = o.dur || 40;
  const r = { N, w0: 0, w1: 0, emp: 0, sc: [], pts: 0, hits: 0, rear: 0, maxSeat: 0, sd: 0, kk: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const x = LIVE.sim('f_chocones', { tipo: '2v2', seed: o.seedBase ? seed + o.seedBase : seed, lv: o.lv || 1, dur, skill: o.skill == null ? 0.6 : o.skill });
    if (x.ganaLado === 'eq0') r.w0++; else if (x.ganaLado === 'eq1') r.w1++; else r.emp++;
    const v = x.vista; r.sc.push(x.sc);
    x.sc.forEach((q) => { r.pts += q; r.maxSeat = Math.max(r.maxSeat, q); });
    v.hits.forEach((q) => { r.hits += q; }); v.rear.forEach((q) => { r.rear += q; });
    if (v.k > v.regT) r.sd++;
    r.kk += x.kk;
  }
  return r;
}
/* partidas con el contexto falso (control por asiento); recuentos por lado con compara */
function medirCtx(DEF, o) {
  o = o || {};
  const N = o.N || 100, r = { N, w0: 0, w1: 0, emp: 0, sc: [], hits: [0, 0, 0, 0] };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed, dur: o.dur || 40, skill: o.skill == null ? 0.6 : o.skill, humanos: o.humanos });
    jugar(st, o.modos || CPU4, null);
    const ve = veredicto(st); r.sc.push(st.g.scores());
    if (ve.puestos[0] === ve.puestos[2]) r.emp++; else if (ve.puestos[0] === 1) r.w0++; else r.w1++;
    const v = st.g.vista(); for (let j = 0; j < 4; j++) r.hits[j] += v.hits[j];
  }
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
function fila(r) { return 'eq0 ' + pct(r.w0 / r.N) + ' eq1 ' + pct(r.w1 / r.N) + ' empate ' + pct(r.emp / r.N) + ' · |Δ| ' + (Math.abs(r.w0 - r.w1) / r.N * 100).toFixed(1) + ' pp' + (r.sc.length ? ' · pts/partido ' + (r.pts / r.N).toFixed(1) + ' · golpes ' + (r.hits / r.N).toFixed(1) + ' (por detrás ' + (r.rear / r.N).toFixed(1) + ') · máx asiento ' + r.maxSeat + ' · muerte súbita ' + pct(r.sd / r.N) + ' · dura ' + (r.kk / r.N / 30).toFixed(1) + ' s' : ''); }

function resumen(DEF) {
  console.log('f_chocones · banco (N=' + (+process.env.N || 400) + ' semillas por celda; LIVE.sim = sesión real con 4 CPU; gana quien decide compara)');
  let ok = true;
  for (const lv of [1, 2, 3]) { const r = medir(DEF, { lv, skill: 0.6 }); console.log('  lv' + lv + ' skill .6   ' + fila(r)); if (Math.abs(r.w0 - r.w1) / r.N > 0.1 || r.emp / r.N > 0.1 || r.maxSeat > LIM.scoreMax) ok = false; }
  for (const sk of [0.35, 0.85]) { const r = medir(DEF, { lv: 1, skill: sk }); console.log('  lv1 skill ' + sk + '  ' + fila(r)); }
  for (const lv of [1, 2, 3]) {
    const f = medir(DEF, { lv, skill: [0.9, 0.9, 0.3, 0.3] }), g = medir(DEF, { lv, skill: [0.3, 0.3, 0.9, 0.9] });
    console.log('  lv' + lv + ' .9+.9 vs .3+.3   fuerte gana ' + pct((f.w0 + g.w1) / (f.N + g.N)) + ' (eq0 fuerte ' + pct(f.w0 / f.N) + ', eq1 fuerte ' + pct(g.w1 / g.N) + ') · empate ' + pct((f.emp + g.emp) / (f.N + g.N)));
    if ((f.w0 + g.w1) / (f.N + g.N) < 0.85) ok = false;
  }
  const ocio = medirCtx(DEF, { N: 100, modos: [null, null, 'cpu', 'cpu'] }); console.log('  2 ociosos (eq0) vs 2 CPU .6   eq0 gana ' + pct(ocio.w0 / ocio.N) + ' · empate ' + pct(ocio.emp / ocio.N) + ' · eq1 ' + pct(ocio.w1 / ocio.N));
  const ocio2 = medirCtx(DEF, { N: 100, lv: 3, modos: ['cpu', 'cpu', null, null] }); console.log('  2 CPU .6 vs 2 ociosos (eq1), lv3   eq0 gana ' + pct(ocio2.w0 / ocio2.N) + ' · empate ' + pct(ocio2.emp / ocio2.N) + ' · eq1 ' + pct(ocio2.w1 / ocio2.N));
  if (ocio.w0 + ocio.emp > 0 || ocio2.w1 + ocio2.emp > 0) ok = false;
  const uno = medirCtx(DEF, { N: 100, modos: ['cpu', null, 'cpu', 'cpu'] }); console.log('  1 CPU + 1 ocioso (eq0) vs 2 CPU .6   eq0 gana ' + pct(uno.w0 / uno.N) + ' · empate ' + pct(uno.emp / uno.N) + ' · eq1 ' + pct(uno.w1 / uno.N));
  console.log(ok ? 'OK: simetría ±10 pp, empates ≤10 %, fuerte ≥85 %, ociosos pierden siempre, puntos ≤ scoreMax' : 'FUERA DE RANGO: revisa simetría / empates / habilidad / ociosos');
  return ok;
}

module.exports = { cargar, mkCtx, tick, jugar, medir, medirCtx, veredicto, CAT, CPU4, LIVE, LIM };
if (require.main === module) { const DEF = cargar(); process.exit(resumen(DEF) ? 0 : 1); }
