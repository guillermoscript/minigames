'use strict';
/* Banco headless de f_bono (1v3, modelo B). Mide el balance del solo y deja afinar la perilla (PERILLA.SPD).
     node docs/style-lab/pruebas/fiesta-bono-bench.js                 balance: % de victorias del solo, 200 semillas × 3 niveles × habilidades .35/.6/.85
     node docs/style-lab/pruebas/fiesta-bono-bench.js --sweep         barre PERILLA.SPD (1.03 … 1.25) y marca qué valores caen en 38-52 % en los 3 niveles
     N=100 node …                                                    semillas por celda
   Usa LIVE.sim (el create() REAL del runtime: juez, scoresNorm, puestos, hash) con 4 asientos CPU y reloj virtual a 30 Hz. El ganador sale de `pl` (compara), nunca del juego.
   «Igual habilidad» = las 4 CPU con la misma skill: reacción, error de apuntado y lapsos viven en `ai` y NO se tocan una vez medido. Exporta cargar/medir/CAT. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-bono.js');
const LO = 0.50, HI = 0.60;
const stub = { g: 'f_bono', dur: 35, live: 1, lim: { scoreMax: 60, scoreRate: 8, minT: 6, finTemprano: 1 } };   // lo que pide SHARED_CHANGES_NEEDED (en memoria: no se toca fiesta-reglas.js)

function cargar() {
  globalThis.window = globalThis;
  const LIVE = require(path.join(SL, 'fiesta-live.js'));
  globalThis.FIESTA.rng = globalThis.FIESTA.rng || require(path.join(SL, 'fiesta-rng.js'));
  globalThis.FIESTA.reglas = globalThis.FIESTA.reglas || require(path.join(SL, 'fiesta-reglas.js'));
  const cat = globalThis.FIESTA.reglas.CATALOGO.filter((x) => x.g === 'f_bono')[0];
  if (cat && !cat.lim) { cat.dur = stub.dur; cat.live = 1; cat.lim = Object.assign({}, stub.lim); }
  if (!LIVE.get('f_bono')) require(SRC);
  return LIVE.get('f_bono');
}
function partida(DEF, o) {
  const LIVE = globalThis.FIESTA.LIVE;
  return LIVE.sim('f_bono', Object.assign({ tipo: '1v3', solo: 'a', skill: 0.6, lv: 1, seed: 1 }, o));
}
/* % de victorias del solo con las 4 CPU de la misma habilidad; devuelve {win, tie, net:[media de monedas perdidas netas], t, sw:[golpes], aj} */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, lv = o.lv || 1, skill = o.skill == null ? 0.6 : o.skill;
  let w = 0, tt = 0, lost = 0, hits = 0, sw = 0, rec = 0, sand = 0;
  const s0 = o.seed0 || +process.env.SEED0 || 0;
  for (let seed = s0 + 1; seed <= s0 + N; seed++) {
    const r = partida(DEF, { lv, seed, skill, dur: o.dur });
    if (r.ganaLado === 'solo') w++;
    lost += r.vista.net; hits += r.vista.hits; sw += r.vista.swings.length; rec += r.vista.rec; tt += r.kk / 30;
  }
  return { win: w / N, n: N, net: lost / N, hits: hits / N, t: tt / N, rec: rec / N };
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';
const dentro = (x) => x >= LO && x <= HI;
function balance(DEF) {
  console.log('f_bono · balance del solo (4 CPU de igual habilidad; objetivo ' + LO * 100 + '-' + HI * 100 + ' %)');
  console.log('  perilla: SPD=' + DEF.perilla.SPD + '  SK=' + JSON.stringify(DEF.perilla.SK));
  let todoOk = true;
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir(DEF, { lv, skill: sk });
      fila.push('skill ' + sk + ': ' + pct(r.win) + (sk === 0.6 ? (dentro(r.win) ? ' ok ' : ' FUERA') : '      ') + ' (perd ' + r.net.toFixed(1) + ', golpes ' + r.hits.toFixed(1) + ', rec ' + r.rec.toFixed(1) + ', fin ' + r.t.toFixed(1) + ' s)');
      if (sk === 0.6 && !dentro(r.win)) todoOk = false;
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
  console.log(todoOk ? 'OK: skill .6 dentro de rango en los 3 niveles (.35 y .85 son informativos)' : 'FUERA DE RANGO: afina PERILLA.SPD / SK');
  return todoOk;
}
function sweep(DEF) {
  const orig = DEF.perilla.SPD;
  console.log('f_bono · barrido de PERILLA.SPD (skill .6, ' + (+process.env.N || 200) + ' semillas por celda)');
  console.log('  SPD    lv1      lv2      lv3     (¿los 3 en rango?)');
  for (let s = +(process.env.S0 || 1.03); s <= +(process.env.S1 || 1.251); s += +(process.env.SS || 0.04)) {
    DEF.perilla.SPD = s; const r = [1, 2, 3].map((lv) => medir(DEF, { lv, skill: 0.6 }).win);
    console.log('  ' + s.toFixed(2) + '  ' + r.map(pct).join('  ') + '   ' + (r.every(dentro) ? 'EN RANGO' : ''));
  }
  DEF.perilla.SPD = orig;
}

/* contexto falso (como la práctica): n asientos, todos míos; ev se devuelve por eco local (como evSend del runtime). Para reglas finas y dibujo. */
function mkCtx(DEF, o) {
  o = o || {};
  const rng = globalThis.FIESTA.rng;
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, solo = o.solo === undefined ? 0 : o.solo;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: [], mine: o.mine || null };
  const c = {
    n, yo: o.yo === undefined ? 1 : o.yo, modo: '1v3', solo, equipos: Array.from({ length: n }, (_, i) => (i === solo ? 0 : 1)), lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: ['#ff7ab0', '#ffb36b', '#3fb0ff', '#4fd06a'][i], cpu: false, human: true, team: i === solo ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: (p) => (st.mine ? st.mine.indexOf(p) >= 0 : true), remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); },
    out: () => {}, send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* corre a 30 fps; modos[p] = 'cpu' | 'idle' | función(st, p, dt, api). Devuelve scores(). Para al cumplirse done() (tras minT) o al llegar a dur. */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  const lim = hasta || c.dur;
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    if (st.gt >= Math.min(6, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}

module.exports = { cargar, partida, medir, mkCtx, jugar, LO, HI, stub };
if (require.main === module) {
  const DEF = cargar();
  if (process.argv.includes('--sweep')) sweep(DEF);
  else process.exit(balance(DEF) ? 0 : 1);
}
