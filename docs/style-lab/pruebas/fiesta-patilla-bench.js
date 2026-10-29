'use strict';
/* Banco headless de f_patilla (1v3, modelo B). Mide el balance del solo y deja afinar la perilla.
     node docs/style-lab/pruebas/fiesta-patilla-bench.js                 balance: % de victorias del solo, 200 semillas × 3 niveles × habilidades .35/.6/.85
     node docs/style-lab/pruebas/fiesta-patilla-bench.js --sweep         barre PERILLA.N (6 … 12) y marca qué valores caen en 38-52 % en los 3 niveles
     node docs/style-lab/pruebas/fiesta-patilla-bench.js --red           lo mismo sobre el stack REAL (fiesta-net + fiesta-live + servidor en memoria) con 0/150/300 ms de retardo
   Sin red (modo por defecto): UN solo contexto `c` falso con los 4 asientos «míos» (como la práctica); el ganador sale de FIESTA.reglas.compara (M3 DM3-4),
   nunca de un hook del juego. «Igual habilidad» = las 4 CPU con la misma skill: lo que define esa habilidad (lapsos, error de apuntado, reacción) vive en
   `ai` y NO se toca una vez medido; las perillas que se mueven son PERILLA.N y RK por nivel. Exporta cargar/mkCtx/jugar/medir para las pruebas. */
const fs = require('fs'), path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-patilla.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_patilla')[0];
const LO = 0.38, HI = 0.52;                              // objetivo del doc 08 §11.2 #11

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_patilla;
}

/* contexto falso: n asientos, todos míos; el ev se devuelve por eco local y c.send('xtiro') se entrega a c.on del propio juego */
function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, solo = o.solo === undefined ? 0 : o.solo;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, handlers: {}, sent: [], evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 1 : o.yo, modo: '1v3', solo, equipos: Array.from({ length: n }, (_, i) => (i === solo ? 0 : 1)), lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i === solo ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false), skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); },
    out: () => {}, send: (t, d) => { st.sent.push({ t, d }); return true; }, on: (t, fn) => { st.handlers[t] = fn; }, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* corre una partida a 30 fps; modos[p] = 'cpu' | 'idle' | función(st, p, dt, api). Devuelve scores(). Para al cumplirse done() (tras el mínimo del servidor) o al llegar a dur. */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  const lim = hasta || c.dur;
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    if (st.gt >= Math.min(CAT.lim.minT, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}
const ganaSolo = (st) => reglas.compara('1v3', st.c.equipos, st.g.scores()).puestos[st.c.solo] === 1;

/* % de victorias del solo con las 4 CPU de la misma habilidad; devuelve {win, n, golpes:[histograma 0..9], t:[duración media]} */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, lv = o.lv || 1, skill = o.skill == null ? 0.6 : o.skill, dur = o.dur || DEF.dur;
  let w = 0, tt = 0; const h = new Array(10).fill(0);
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv, seed, skill, dur, solo: o.solo === undefined ? 0 : o.solo });
    jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], dur);
    if (ganaSolo(st)) w++;
    h[Math.min(9, st.g.vista().hits)]++; tt += st.gt;
  }
  return { win: w / N, n: N, golpes: h, t: tt / N };
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';
const dentro = (x) => x >= LO && x <= HI;

function balance(DEF) {
  console.log('f_patilla · balance del solo (4 CPU de igual habilidad, 200 semillas; objetivo ' + LO * 100 + '-' + HI * 100 + ' %)');
  console.log('  perilla: ' + JSON.stringify(DEF.perilla));
  let todoOk = true;
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir(DEF, { lv, skill: sk });
      fila.push('skill ' + sk + ': ' + pct(r.win) + (sk === 0.6 ? (dentro(r.win) ? ' ok ' : ' FUERA') : '      ') + ' (fin ' + r.t.toFixed(1) + ' s)');
      if (sk === 0.6 && !dentro(r.win)) todoOk = false;
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
  console.log(todoOk ? 'OK: skill .6 dentro de rango en los 3 niveles (.35 y .85 son informativos)' : 'FUERA DE RANGO: afina PERILLA.N / RK');
  return todoOk;
}
function sweep(DEF) {
  const original = DEF.perilla.N;
  console.log('f_patilla · barrido de PERILLA.N, las bombas por partida (skill .6, 200 semillas por celda)');
  console.log('  N    lv1      lv2      lv3     (¿los 3 en rango?)');
  for (let w = +(process.env.W0 || 6); w <= +(process.env.W1 || 12); w += +(process.env.WS || 1)) {
    DEF.perilla.N = w; const r = [1, 2, 3].map((lv) => medir(DEF, { lv, skill: 0.6 }).win);
    console.log('  ' + String(w).padStart(2) + '  ' + r.map(pct).join('  ') + '   ' + (r.every(dentro) ? 'EN RANGO' : ''));
  }
  DEF.perilla.N = original;
}

/* sobre el stack real: 4 humanos-bot, retardo fijo, sin pérdida; el solo sale de la sala del arnés. Más lento (~0,15 s por partida). */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes } = require(path.join(__dirname, '../../../test/fiesta-live.test.js'));
  require(SRC);
  const N = +(process.env.N || 60);
  console.log('f_patilla · stack REAL (fiesta-net + fiesta-live + party.js), ' + N + ' partidas por celda, skill .6, sin pérdida; el solo es humano-bot (a)');
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const delay of [0, 150, 300]) {
      let w = 0, tot = 0;
      for (let seed = 1; seed <= N; seed++) {
        const H = await arnes({ game: 'f_patilla', tipo: '1v3', dur: 35, humans: 4, loss: 0, delay: delay || 1, seed, lv, solo: 'a' });
        H.bot = {}; H.ids.forEach((s) => { H.bot[s] = { skill: 0.6 }; });
        await H.arrancar(); await H.cerrar();
        const res = H.res(); if (res) { tot++; if (res.puestos[0] === 1) w++; }
        H.cerrarTodo && H.cerrarTodo();
      }
      fila.push('retardo ' + String(delay).padStart(3) + ' ms: ' + pct(w / Math.max(1, tot)) + ' (' + tot + ')');
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
}

module.exports = { cargar, mkCtx, jugar, medir, ganaSolo, LO, HI, CAT };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else {
    const DEF = cargar();
    if (process.argv.includes('--sweep')) sweep(DEF);
    else process.exit(balance(DEF) ? 0 : 1);
  }
}
