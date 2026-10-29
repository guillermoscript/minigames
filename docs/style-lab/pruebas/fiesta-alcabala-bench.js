'use strict';
/* Banco headless de f_alcabala (1v3, modelo B). Mide el balance del solo y deja afinar la perilla.
     node docs/style-lab/pruebas/fiesta-alcabala-bench.js              balance: % de victorias del solo, 200 semillas × 3 niveles × habilidades .35/.6/.85
     node docs/style-lab/pruebas/fiesta-alcabala-bench.js --sweep      barre PERILLA.RL (30 … 62) y marca qué valores caen en 38-52 % en los 3 niveles
     node docs/style-lab/pruebas/fiesta-alcabala-bench.js --red        lo mismo sobre el stack REAL con 0/150/300 ms de retardo
     node docs/style-lab/pruebas/fiesta-alcabala-bench.js --ocioso     ociosos contra CPU activas (el solo ocioso pierde; el trío ocioso pierde)
   Sin red: UN solo contexto `c` falso con los 4 asientos «míos» (como la práctica); el ganador sale de FIESTA.reglas.compara (M3 DM3-4), nunca de un hook del juego.
   «Igual habilidad» = las 4 CPU con la misma skill: lo que define esa habilidad (reacción, error de apuntado, lapsos) vive en `ai` y NO se toca una vez medido;
   la única perilla que se mueve es PERILLA.RL (y RK por nivel). Exporta cargar/mkCtx/jugar/medir/ventajaJuez para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-alcabala.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const LO = 0.40, HI = 0.56;                              // objetivo: ~50 % (el dueño, oct 2026; antes 38-52 del doc 08 §11.2 #11)
/* el catálogo aún no trae lim ni live para f_alcabala: se completa EN MEMORIA (el integrador copia la línea de CATALOGO) */
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_alcabala')[0];
if (!CAT.lim) Object.assign(CAT, { dur: 40, live: 1, lim: { scoreMax: 30, scoreRate: 8, minT: 5, finTemprano: 1 } });

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_alcabala;
}

function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, solo = o.solo === undefined ? 0 : o.solo;
  const st = { gt: -3, taps: new Array(n).fill(0), holds: new Array(n).fill(false), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, handlers: {}, sent: [], evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 1 : o.yo, modo: '1v3', solo, equipos: Array.from({ length: n }, (_, i) => (i === solo ? 0 : 1)), lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i === solo ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p) => st.gt >= 0 && st.holds[p],
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
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: (b, v) => { st.holds[p] = !!v; }, eje: (x, y) => { st.axes[p] = { x, y }; } });
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

/* % de victorias del solo con las 4 CPU de la misma habilidad */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, lv = o.lv || 1, skill = o.skill == null ? 0.6 : o.skill, dur = o.dur || DEF.dur;
  let w = 0, tt = 0; const h = new Array(4).fill(0); let par = 0;
  const s0 = (o.seed0 || +process.env.SEED0 || 0);
  for (let seed = s0 + 1; seed <= s0 + N; seed++) {
    const st = mkCtx(DEF, { lv, seed, skill, dur, solo: o.solo === undefined ? 0 : o.solo });
    jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], dur);
    if (ganaSolo(st)) w++;
    const v = st.g.vista(); h[Math.min(3, v.nPas)]++; tt += st.gt; par += v.totalPar;
  }
  return { win: w / N, n: N, pasaron: h, t: tt / N, paradas: par / N };
}
/* ventaja del juez: el solo a veces es el asiento del juez, a veces no; en el stack real el juez ve la luz sin retardo. Aquí se mide la diferencia entre jugar
   con el solo en el asiento 0 y en el 2 (misma habilidad): debe ser ~0 (simetría de asientos). */
function ventajaJuez(DEF, o) {
  o = o || {}; const a = medir(DEF, Object.assign({}, o, { solo: 0 })), b = medir(DEF, Object.assign({}, o, { solo: 2 }));
  return { a: a.win, b: b.win, dif: Math.abs(a.win - b.win) };
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';
const dentro = (x) => x >= LO && x <= HI;

function balance(DEF) {
  console.log('f_alcabala · balance del solo (4 CPU de igual habilidad, ' + (+process.env.N || 200) + ' semillas; objetivo ' + LO * 100 + '-' + HI * 100 + ' %)');
  console.log('  perilla: RL=' + DEF.perilla.RL + '  RK=' + JSON.stringify(DEF.perilla.RK) + '  FK=' + DEF.perilla.FK + '  CD=' + DEF.perilla.CD + '  CATCH=' + DEF.perilla.CATCH);
  let todoOk = true;
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir(DEF, { lv, skill: sk });
      fila.push('skill ' + sk + ': ' + pct(r.win) + (sk === 0.6 ? (dentro(r.win) ? ' ok ' : ' FUERA') : '      ') + ' (fin ' + r.t.toFixed(1) + ' s, paradas ' + r.paradas.toFixed(1) + ', pasaron 0/1/2/3 ' + r.pasaron.join('/') + ')');
      if (sk === 0.6 && !dentro(r.win)) todoOk = false;
    }
    console.log('  lv' + lv + '  ' + fila.join('\n       '));
  }
  console.log(todoOk ? 'OK: skill .6 dentro de rango en los 3 niveles (.35 y .85 son informativos)' : 'FUERA DE RANGO: afina PERILLA.RL / RK');
  return todoOk;
}
function sweep(DEF) {
  const original = DEF.perilla.RL, rk = DEF.perilla.RK.slice();
  console.log('f_alcabala · barrido de PERILLA.RL (RK = ' + JSON.stringify(rk) + ', skill .6, ' + (+process.env.N || 200) + ' semillas por celda)');
  console.log('  RL     lv1      lv2      lv3     (¿los 3 en rango?)');
  for (let w = +(process.env.W0 || 30); w <= +(process.env.W1 || 62.01); w += +(process.env.WS || 4)) {
    DEF.perilla.RL = w; const r = [1, 2, 3].map((lv) => medir(DEF, { lv, skill: 0.6 }).win);
    console.log('  ' + w.toFixed(0).padStart(3) + '  ' + r.map(pct).join('  ') + '   ' + (r.every(dentro) ? 'EN RANGO' : ''));
  }
  DEF.perilla.RL = original;
}
function ocioso(DEF) {
  console.log('f_alcabala · ociosos contra CPU activas (' + (+process.env.N || 60) + ' semillas por nivel)');
  const N = +process.env.N || 60;
  for (const lv of [1, 2, 3]) {
    let soloIdle = 0, trioIdle = 0;
    for (let seed = 1; seed <= N; seed++) {
      const a = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(a, ['idle', 'cpu', 'cpu', 'cpu'], 40); if (ganaSolo(a)) soloIdle++;
      const b = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(b, ['cpu', 'idle', 'idle', 'idle'], 40); if (ganaSolo(b)) trioIdle++;
    }
    console.log('  lv' + lv + '  solo ocioso gana ' + pct(soloIdle / N) + '   trío ocioso: gana el solo ' + pct(trioIdle / N));
  }
}

/* sobre el stack real (fiesta-net + fiesta-live + servidor en memoria): 4 humanos-bot, retardo fijo, sin pérdida; el solo es el humano-bot 'a' (el juez es un miembro del trío).
   Mide si el retardo y el reparto de papeles (quién ve la luz sin retardo: el juez) mueven el balance del solo. Más lento (~0,3 s por partida). */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes, CAT: C2 } = require(path.join(__dirname, '../../../test/helpers/live-arnes.js'));
  Object.assign(C2.f_alcabala, { dur: 40, live: 1, lim: CAT.lim });
  require(SRC);
  const N = +(process.env.N || 40);
  console.log('f_alcabala · stack REAL (fiesta-net + fiesta-live + party.js), ' + N + ' partidas por celda, skill .6, sin pérdida; el solo es humano-bot (a)');
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const delay of [0, 150, 300]) {
      let w = 0, tot = 0;
      for (let seed = 1; seed <= N; seed++) {
        const H = await arnes({ game: 'f_alcabala', tipo: '1v3', dur: 40, humans: 4, loss: 0, delay: delay || 1, seed, lv, solo: 'a' });
        H.bot = {}; H.ids.forEach((s) => { H.bot[s] = { skill: 0.6 }; });
        await H.arrancar(); await H.cerrar(60);
        const res = H.res(); if (res) { tot++; if (res.puestos[0] === 1) w++; }
        H.cerrarTodo && H.cerrarTodo();
      }
      fila.push('retardo ' + String(delay).padStart(3) + ' ms: ' + pct(w / Math.max(1, tot)) + ' (' + tot + ')');
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
}

module.exports = { cargar, mkCtx, jugar, medir, ventajaJuez, ganaSolo, LO, HI, CAT };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else {
  const DEF = cargar();
  if (process.argv.includes('--sweep')) sweep(DEF);
  else if (process.argv.includes('--ocioso')) ocioso(DEF);
  else process.exit(balance(DEF) ? 0 : 1);
}
}
