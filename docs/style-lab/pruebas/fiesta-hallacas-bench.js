'use strict';
/* Banco headless de f_hallacas (2v2, modelo B). SOLO jugabilidad (no dibuja; el estilo no importa).
     node docs/style-lab/pruebas/fiesta-hallacas-bench.js              balance: 200 semillas × 3 niveles × habilidades .35/.6/.85 (P equipo0, P equipo1, empates, media por rol)
     node docs/style-lab/pruebas/fiesta-hallacas-bench.js --sweep       barre PERILLA.TOL_MASA (0.06 … 0.16) a skill .6
     node docs/style-lab/pruebas/fiesta-hallacas-bench.js --roles       masero ocioso, amarrador ocioso, equipo fuerte contra débil, ayuda con B (contexto falso con hold)
     node docs/style-lab/pruebas/fiesta-hallacas-bench.js --red         sobre el stack REAL con 50/150/300 ms y 5 % de pérdida (informativo; N=12 por celda)
     N=100 node …                                                       semillas por celda
   El modo por defecto usa LIVE.sim (el create() REAL: juez, terminar, puestos, hash) con 4 CPU del mismo skill; el ganador sale de compara (M3 DM3-4), nunca de un hook del juego.
   «Igual habilidad» = las 4 CPU con el mismo skill; lo que define esa habilidad vive en `ai` y NO se toca una vez medido; la única perilla es PERILLA.TOL_MASA.
   Exporta cargar/mkCtx/jugar/medir para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-hallacas.js');
globalThis.window = globalThis;
const LIVE = require(path.join(SL, 'fiesta-live.js'));
const rng = globalThis.FIESTA.rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = globalThis.FIESTA.reglas = require(path.join(SL, 'fiesta-reglas.js'));
const ID = 'f_hallacas';

function cargar() { require(SRC); return LIVE.get(ID); }

/* contexto falso: n asientos, todos míos (como la práctica); c.held/c.tap/c.eje salen de st.in[p] que llenan las CPU (api) o la prueba */
function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: -3, in: Array.from({ length: n }, () => ({ x: 0, y: 0, a: false, b: false, ta: 0, tb: 0 })), g: null, evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: '2v2', solo: -1, equipos: o.equipos || (n === 4 ? [0, 0, 1, 1] : Array.from({ length: n }, (_, i) => i % 2)), lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: ['#ff7ab0', '#ffb36b', '#3fb0ff', '#4fd06a'][i % 4], cpu: false, human: true, team: i < 2 ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p, b) => (st.gt < 0 ? false : b === 'b' ? st.in[p].b : st.in[p].a),
    tap: (p, b) => { const I = st.in[p], k = b === 'b' ? 'tb' : 'ta', v = I[k]; I[k] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : { x: st.in[p].x, y: st.in[p].y }), cpu: new Array(n).fill(false),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: (p) => (o.mio ? o.mio(p) : true), remoto: (p) => (o.remoto ? o.remoto(p) : null), ev(ty, d) { st.evs.push({ ty, d }); }, out() {}, send: () => true, on() {}, claim() {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
const apiDe = (st, p) => ({ press: (b) => { st.in[p][b === 'b' ? 'tb' : 'ta']++; }, hold: (b, v) => { st.in[p][b === 'b' ? 'b' : 'a'] = !!v; }, eje: (x, y) => { st.in[p].x = x; st.in[p].y = y; } });
/* un cuadro: modos[p] = 'cpu' | 'idle' | función(st,p,dt,api) -> ai/fn de cada asiento -> update */
function cuadro(st, modos, dt) {
  dt = dt || 1 / 30; st.gt += dt;
  for (let p = 0; p < st.c.n; p++) { const m = modos[p]; if (m === 'cpu') st.g.ai(p, dt, apiDe(st, p)); else if (typeof m === 'function') m(st, p, dt, apiDe(st, p)); }
  st.g.update(dt);
}
function jugar(st, modos, hasta) {
  const lim = hasta || st.c.dur;
  while (st.gt < lim) cuadro(st, modos);
  return st.g.scores();
}
const gana = (st) => reglas.compara('2v2', st.c.equipos, st.g.scores());

/* % de victorias por equipo con LIVE.sim (4 CPU); skill número o arreglo [s0,s1,s2,s3] */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, lv = o.lv || 1, skill = o.skill == null ? 0.6 : o.skill, dur = o.dur;
  let w0 = 0, w1 = 0, emp = 0; const mean = [0, 0, 0, 0]; let maxSc = 0;
  for (let seed = 1; seed <= N; seed++) {
    const r = LIVE.sim(ID, { tipo: '2v2', seed, lv, skill, dur });
    if (r.ganaLado === 'eq0') w0++; else if (r.ganaLado === 'eq1') w1++; else emp++;
    r.sc.forEach((v, i) => { mean[i] += v; if (v > maxSc) maxSc = v; });
  }
  return { p0: w0 / N, p1: w1 / N, tie: emp / N, mean: mean.map((x) => x / N), n: N, maxSc };
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';
const LIM = { dif: 0.1, emp: 0.3 };
const dentro = (r) => Math.abs(r.p0 - r.p1) <= LIM.dif && r.tie <= LIM.emp;

function balance(DEF) {
  console.log('f_hallacas · balance 2v2 (4 CPU, ' + (process.env.N || 200) + ' semillas; objetivo |P0-P1| <= ' + LIM.dif * 100 + ' pp y empates <= ' + LIM.emp * 100 + ' %)');
  console.log('  perilla: TOL_MASA=' + DEF.perilla.TOL_MASA);
  let todoOk = true;
  for (const lv of [1, 2, 3]) {
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir(DEF, { lv, skill: sk });
      const ok = dentro(r);
      if (sk === 0.6 && !ok) todoOk = false;
      console.log('  lv' + lv + ' skill ' + sk + ': eq0 ' + pct(r.p0) + '  eq1 ' + pct(r.p1) + '  empate ' + pct(r.tie) + '  |dif| ' + (Math.abs(r.p0 - r.p1) * 100).toFixed(1).padStart(4) + ' pp ' + (sk === 0.6 ? (ok ? 'ok   ' : 'FUERA') : '     ') +
        ' media por asiento [masero0 amarr0 masero1 amarr1] ' + r.mean.map((x) => x.toFixed(1)).join(' ') + ' (max ' + r.maxSc + ')');
    }
  }
  console.log(todoOk ? 'OK: skill .6 dentro de rango en los 3 niveles' : 'FUERA DE RANGO en skill .6');
  return todoOk;
}
function sweep(DEF) {
  const original = DEF.perilla.TOL_MASA;
  console.log('f_hallacas · barrido de PERILLA.TOL_MASA (skill .6)');
  for (let t = 0.06; t <= 0.1601; t += 0.02) {
    DEF.perilla.TOL_MASA = +t.toFixed(3);
    const r = [1, 2, 3].map((lv) => medir(DEF, { lv, skill: 0.6 }));
    console.log('  TOL ' + t.toFixed(2) + '  ' + r.map((x, i) => 'lv' + (i + 1) + ' ' + pct(x.p0) + '/' + pct(x.p1) + ' emp ' + pct(x.tie) + ' masero ' + x.mean[0].toFixed(1) + ' amarr ' + x.mean[1].toFixed(1)).join('   '));
  }
  DEF.perilla.TOL_MASA = original;
}
function roles(DEF) {
  const N = +process.env.N || 60;
  console.log('f_hallacas · roles (contexto falso con hold; skill .6; ' + N + ' semillas por nivel)');
  for (const lv of [1, 2, 3]) {
    let mIdle = 0, mIdleA = 0, aIdle = 0, aIdleM = 0, fuerte = 0, debil = 0, empF = 0;
    for (let seed = 1; seed <= N; seed++) {
      let st = mkCtx(DEF, { lv, seed }); let sc = jugar(st, ['idle', 'cpu', 'cpu', 'cpu']);
      if (gana(st).puestos[0] > 1) mIdle++; mIdleA += sc[1];
      st = mkCtx(DEF, { lv, seed }); sc = jugar(st, ['cpu', 'idle', 'cpu', 'cpu']);
      if (gana(st).puestos[0] > 1) aIdle++; aIdleM += sc[0];
      st = mkCtx(DEF, { lv, seed, skill: [0.9, 0.9, 0.3, 0.3] }); jugar(st, ['cpu', 'cpu', 'cpu', 'cpu']);
      const pu = gana(st).puestos; if (pu[0] === 1 && pu[2] === 2) fuerte++; else if (pu[0] === pu[2]) empF++; else debil++;
    }
    console.log('  lv' + lv + ': masero ocioso pierde ' + pct(mIdle / N) + ' (amarrador suma ' + (mIdleA / N).toFixed(1) + ') · amarrador ocioso pierde ' + pct(aIdle / N) + ' (masero suma ' + (aIdleM / N).toFixed(1) + ') · .9+.9 vs .3+.3: gana el fuerte ' + pct(fuerte / N) + ' empate ' + pct(empF / N) + ' gana el débil ' + pct(debil / N));
  }
}
async function red() {
  process.env.LIVE_DBG = '1';
  const A = require(path.join(__dirname, '../../../test/helpers/live-arnes.js'));
  [A.CAT, A.R0.CATALOGO.reduce((o, x) => { o[x.g] = x; return o; }, {})].forEach((C) => { if (C[ID]) { C[ID].live = 1; C[ID].lim = { scoreMax: 16, scoreRate: 0.45, minT: 44, finTemprano: 0 }; } });
  cargar();
  const N = +process.env.N || 12;
  console.log('f_hallacas · stack REAL (fiesta-net + fiesta-live + party.js), ' + N + ' partidas por celda, 4 humanos-bot skill .6, 5 % de pérdida');
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const delay of [50, 150, 300]) {
      let w0 = 0, w1 = 0, e = 0, tot = 0;
      for (let seed = 1; seed <= N; seed++) {
        const H = await A.arnes({ game: ID, tipo: '2v2', dur: 45, humans: 4, loss: 0.05, delay, seed, lv });
        H.bot = {}; H.ids.forEach((s) => { H.bot[s] = { skill: 0.6 }; });
        await H.arrancar(); await H.cerrar(80);
        const res = H.res(); if (res) { tot++; if (res.puestos[0] === 1 && res.puestos[2] === 2) w0++; else if (res.puestos[2] === 1 && res.puestos[0] === 2) w1++; else e++; }
        H.cerrarTodo();
      }
      fila.push(delay + ' ms: eq0 ' + w0 + ' eq1 ' + w1 + ' emp ' + e + ' (' + tot + ')');
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
}

module.exports = { cargar, mkCtx, cuadro, jugar, medir, gana, apiDe, LIVE, ID, LIM };
if (require.main === module) {
  const DEF = cargar();
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else if (process.argv.includes('--sweep')) sweep(DEF);
  else if (process.argv.includes('--roles')) roles(DEF);
  else process.exit(balance(DEF) ? 0 : 1);
}
