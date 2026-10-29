'use strict';
/* Banco headless de f_silbon (1v3, modelo B). Mide el balance del solo (el Silbón) y deja afinar la perilla.
     node docs/style-lab/pruebas/fiesta-silbon-bench.js              balance: % de victorias del solo, 200 semillas × 3 niveles × habilidades .35/.6/.85
     node docs/style-lab/pruebas/fiesta-silbon-bench.js --sweep      barre PERILLA.NEED (6 … 11) y marca qué valores caen en 38-52 % por nivel
     node docs/style-lab/pruebas/fiesta-silbon-bench.js --ocioso     ociosos contra CPU activas (el solo ocioso pierde; el trío ocioso pierde)
     node docs/style-lab/pruebas/fiesta-silbon-bench.js --red        lo mismo sobre el stack REAL con 0/150/300 ms de retardo (N=40 por celda; lento)
   Sin red: UN solo contexto `c` falso con los 4 asientos «míos» (como la práctica); c.claim concede al instante pasando por claimOk/concede del juego
   (como el juez en práctica, ventana 0). El ganador sale de FIESTA.reglas.compara (M3 DM3-4), nunca de un hook del juego.
   «Igual habilidad» = las 4 CPU con la misma skill: lo que define esa habilidad (reacción, error, lapsos) vive en `ai` y NO se toca una vez medido;
   la única perilla que se mueve es PERILLA.NEED (cuántos mangos hay que juntar, por nivel). Exporta cargar/mkCtx/jugar/medir/ventajaJuez para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-silbon.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const LO = 0.38, HI = 0.52;                              // objetivo del doc 08 §11.2 #11
/* el catálogo aún no trae lim ni live para f_silbon: se completa EN MEMORIA (el integrador copia la línea de CATALOGO) */
const LIM = { scoreMax: 16, scoreRate: 8, minT: 5, finTemprano: 1 };
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_silbon')[0];
if (!CAT.lim) Object.assign(CAT, { dur: 45, live: 1, lim: LIM });

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_silbon;
}

function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, solo = o.solo === undefined ? 0 : o.solo, yo = o.yo === undefined ? 1 : o.yo;
  const st = { gt: -3, taps: new Array(n).fill(0), holds: new Array(n).fill(false), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, handlers: {}, sent: [], evs: [], claims: [] };
  const c = {
    n, yo, modo: '1v3', solo, equipos: Array.from({ length: n }, (_, i) => (i === solo ? 0 : 1)), lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i === solo ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p) => st.gt >= 0 && st.holds[p],
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false), skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); },
    out: () => {}, send: (t, d) => { st.sent.push({ t, d }); return true; }, on: (t, fn) => { st.handlers[t] = fn; },
    claim: (id, cb) => {                                   // el juez en práctica: ventana 0, gana el primero que pasa claimOk
      const t = Math.round(st.gt * 1000), ok = st.g.claimOk(id, yo, t) !== false;
      st.claims.push({ id, ok });
      if (ok) st.g.concede(id, yo);
      cb(ok ? 'ok' : 'no');
    },
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
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); else st.axes[p] = { x: 0, y: 0 }; }
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
  let w = 0, tt = 0, atr = 0, ent = 0, sil = 0;
  const s0 = (o.seed0 || +process.env.SEED0 || 0);
  for (let seed = s0 + 1; seed <= s0 + N; seed++) {
    const st = mkCtx(DEF, { lv, seed, skill, dur, solo: o.solo === undefined ? 0 : o.solo, yo: o.yo });
    jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], dur);
    if (ganaSolo(st)) w++;
    const v = st.g.vista(); tt += st.gt; atr += v.atr; ent += v.ent; sil += v.silbos;
  }
  return { win: w / N, n: N, t: tt / N, atrapados: atr / N, mangos: ent / N, silbos: sil / N };
}
/* simetría de asientos: el solo en el asiento 0 o en el 2 (misma habilidad) debe ganar casi lo mismo */
function ventajaJuez(DEF, o) {
  o = o || {}; const a = medir(DEF, Object.assign({}, o, { solo: 0, yo: 1 })), b = medir(DEF, Object.assign({}, o, { solo: 2, yo: 0 }));
  return { a: a.win, b: b.win, dif: Math.abs(a.win - b.win) };
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';
const dentro = (x) => x >= LO && x <= HI;

function balance(DEF) {
  console.log('f_silbon · balance del solo (4 CPU de igual habilidad, ' + (+process.env.N || 200) + ' semillas; objetivo ' + LO * 100 + '-' + HI * 100 + ' %)');
  console.log('  perilla: NEED=' + JSON.stringify(DEF.perilla.NEED) + '  MANGOS=' + DEF.perilla.MANGOS);
  let todoOk = true;
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir(DEF, { lv, skill: sk });
      fila.push('skill ' + sk + ': ' + pct(r.win) + (sk === 0.6 ? (dentro(r.win) ? ' ok ' : ' FUERA') : '      ') + ' (fin ' + r.t.toFixed(1) + ' s, mangos ' + r.mangos.toFixed(1) + ', atrapados ' + r.atrapados.toFixed(1) + ', silbidos ' + r.silbos.toFixed(1) + ')');
      if (sk === 0.6 && !dentro(r.win)) todoOk = false;
    }
    console.log('  lv' + lv + '  ' + fila.join('\n       '));
  }
  console.log(todoOk ? 'OK: skill .6 dentro de rango en los 3 niveles (.35 y .85 son informativos)' : 'FUERA DE RANGO: afina PERILLA.NEED');
  return todoOk;
}
function sweep(DEF) {
  const original = DEF.perilla.NEED.slice();
  console.log('f_silbon · barrido de PERILLA.NEED (MANGOS=' + DEF.perilla.MANGOS + ', skill .6, ' + (+process.env.N || 200) + ' semillas por celda)');
  console.log('  NEED   lv1      lv2      lv3');
  for (let w = +(process.env.W0 || 6); w <= +(process.env.W1 || 11); w++) {
    DEF.perilla.NEED[0] = DEF.perilla.NEED[1] = DEF.perilla.NEED[2] = w;
    const r = [1, 2, 3].map((lv) => medir(DEF, { lv, skill: 0.6 }).win);
    console.log('  ' + String(w).padStart(3) + '  ' + r.map((x) => pct(x) + (dentro(x) ? '*' : ' ')).join(' '));
  }
  for (let i = 0; i < 3; i++) DEF.perilla.NEED[i] = original[i];
}
function ocioso(DEF) {
  const N = +process.env.N || 60;
  console.log('f_silbon · ociosos contra CPU activas (' + N + ' semillas por nivel)');
  for (const lv of [1, 2, 3]) {
    let soloIdle = 0, trioIdle = 0;
    for (let seed = 1; seed <= N; seed++) {
      const a = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(a, ['idle', 'cpu', 'cpu', 'cpu'], 45); if (ganaSolo(a)) soloIdle++;
      const b = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(b, ['cpu', 'idle', 'idle', 'idle'], 45); if (ganaSolo(b)) trioIdle++;
    }
    console.log('  lv' + lv + '  solo ocioso gana ' + pct(soloIdle / N) + '   trío ocioso: gana el solo ' + pct(trioIdle / N));
  }
}

/* sobre el stack real (fiesta-net + fiesta-live + servidor en memoria): 4 humanos-bot skill .6, retardo fijo, sin pérdida; el solo es el humano-bot 'a'. */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes, CAT: C2 } = require(path.join(__dirname, '../../../test/helpers/live-arnes.js'));
  Object.assign(C2.f_silbon, { dur: 45, live: 1, lim: LIM });
  require(SRC);
  const N = +(process.env.N || 40);
  console.log('f_silbon · stack REAL, ' + N + ' partidas por celda, skill .6, sin pérdida; el solo es humano-bot (a)');
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const delay of [0, 150, 300]) {
      let w = 0, tot = 0, atr = 0;
      for (let seed = 1; seed <= N; seed++) {
        const H = await arnes({ game: 'f_silbon', tipo: '1v3', dur: 45, humans: 4, loss: 0, delay: delay || 1, seed, lv, solo: 'a' });
        H.bot = {}; H.ids.forEach((s) => { H.bot[s] = { skill: 0.6 }; });
        await H.arrancar(); await H.cerrar(60);
        const res = H.res(); if (res) { tot++; if (res.puestos[0] === 1) w++; }
        atr += H.sess.b.g.vista().atr;
        H.cerrarTodo && H.cerrarTodo();
      }
      fila.push('retardo ' + String(delay).padStart(3) + ' ms: ' + pct(w / Math.max(1, tot)) + ' (atrapados ' + (atr / N).toFixed(1) + ')');
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
}

module.exports = { cargar, mkCtx, jugar, medir, ventajaJuez, ganaSolo, LO, HI, CAT, LIM };
if (require.main === module && process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
else if (require.main === module) {
  const DEF = cargar();
  if (process.argv.includes('--sweep')) sweep(DEF);
  else if (process.argv.includes('--ocioso')) ocioso(DEF);
  else process.exit(balance(DEF) ? 0 : 1);
}
