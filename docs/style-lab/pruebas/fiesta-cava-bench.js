'use strict';
/* Banco headless de f_cava (2v2 cooperativo, modelo B). Mide balance entre lados, empates, cuánto carga un equipo y el puntaje máximo (para los límites del catálogo).
     node docs/style-lab/pruebas/fiesta-cava-bench.js            balance: 200 semillas × 3 niveles × habilidades .35/.6/.85 (las 4 CPU de igual habilidad)
     node docs/style-lab/pruebas/fiesta-cava-bench.js --red      el mismo experimento sobre el stack REAL (fiesta-net + fiesta-live + servidor en memoria) con 0/150/300 ms:
                                                                  mide la ventaja del JUEZ (equipo del juez vs el otro; objetivo <= 1/n + 8 pp con n = 2 equipos => <= 58 %)
   Sin red: UN solo contexto `c` falso con los 4 asientos «míos» (como la práctica); el ganador sale de FIESTA.reglas.compara (suma por equipo), nunca de un hook del juego.
   «Igual habilidad» = las 4 CPU con la misma skill; lo que define esa habilidad (error de apuntado, reacción, probabilidad de espantar) vive en `ai` y NO se toca una vez medido.
   El catálogo real aún no trae `lim` para f_cava (lo registra otro agente): aquí se parchea EN MEMORIA con la línea propuesta (CAT_LINEA). Exporta cargar/mkCtx/jugar/medir. */
const fs = require('fs'), path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-cava.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const CAT_LINEA = { g: 'f_cava', m: ['2v2'], cl: 'binary', dur: 35, mo: 'B', live: 1, lim: { scoreMax: 30, scoreRate: 1, minT: 30, finTemprano: 0 } };
/* parche en memoria del catálogo (cliente y, si está cargado, el del servidor) */
function parchea(R) { const e = R && R.CATALOGO && R.CATALOGO.filter((x) => x.g === 'f_cava')[0]; if (e) Object.assign(e, CAT_LINEA); else if (R && R.CATALOGO) R.CATALOGO.push(Object.assign({}, CAT_LINEA)); }
parchea(reglas);
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_cava')[0];

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_cava;
}

/* contexto falso: 4 asientos, 2v2 (0,1 azul · 2,3 rojo), todos míos; el ev se devuelve por eco local; los claims se resuelven a fin de cuadro con claimOk/concede del propio juego */
function mkCtx(DEF, o) {
  o = o || {};
  const n = 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, handlers: {}, sent: [], evs: [], claims: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: '2v2', solo: -1, equipos: [0, 0, 1, 1], lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i < 2 ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(o.cpu === undefined ? true : !!o.cpu),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p === undefined ? c.yo : p, d, st.gt); },
    out: () => {}, send: (t, d) => { st.sent.push({ t, d }); return true; }, on: (t, fn) => { st.handlers[t] = fn; },
    claim: (id, cb) => { st.claims.push({ id, cb, t: Math.round(st.gt * 1000) }); },
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
function resuelveClaims(st) {
  const l = st.claims; st.claims = [];
  l.forEach((x) => {
    const m = /^g\d+_(\d+)$/.exec(x.id), p = m ? +m[1] : -1, ok = st.g.claimOk ? st.g.claimOk(x.id, p, x.t) !== false : true;
    st.g.concede(x.id, ok ? p : -1); x.cb(ok ? 'ok' : 'no');
  });
}
/* corre una partida a 30 fps; modos[p] = 'cpu' | 'idle' | función(st, p, dt, api). Devuelve scores(). Sin fin temprano: dura dur. */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  const lim = hasta || c.dur;
  while (st.gt < lim) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    resuelveClaims(st);
  }
  return g.scores();
}
const verdict = (st) => reglas.compara('2v2', st.c.equipos, st.g.scores()).puestos;

/* % de victorias de cada lado con las 4 CPU de la misma habilidad */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, lv = o.lv || 1, skill = o.skill == null ? 0.6 : o.skill, dur = o.dur || DEF.dur;
  const r = { w0: 0, w1: 0, emp: 0, n: N, V: 0, maxSc: 0, maxV: 0, lanzados: 0, atrapados: 0, robos: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv, seed, skill, dur });
    jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], dur);
    const pl = verdict(st), sc = st.g.scores(), v = st.g.vista();
    if (pl[0] === pl[2]) r.emp++; else if (pl[0] === 1) r.w0++; else r.w1++;
    r.V += (v.V[0] + v.V[1]) / 2; r.maxSc = Math.max(r.maxSc, ...sc); r.maxV = Math.max(r.maxV, ...v.V);
    r.lanzados += st.evs.filter((e) => e.ty === 'tiro').length; r.atrapados += st.evs.filter((e) => e.ty === 'cogio').length; r.robos += st.evs.filter((e) => e.ty === 'roba').length;
  }
  return r;
}
const pct = (x) => (x * 100).toFixed(1).padStart(5) + ' %';

function balance(DEF) {
  console.log('f_cava · balance entre lados (4 CPU de igual habilidad, ' + (+process.env.N || 200) + ' semillas)  — gana azul / gana rojo / empate · V medio · V máx · sc máx por asiento · atrapados/lanzados');
  let ok = true;
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const sk of [0.35, 0.6, 0.85]) {
      const r = medir(DEF, { lv, skill: sk });
      const a = r.w0 / r.n, b = r.w1 / r.n;
      fila.push('sk ' + sk + ': ' + pct(a) + '/' + pct(b) + '/' + pct(r.emp / r.n) + ' V ' + (r.V / r.n).toFixed(1) + ' máx ' + r.maxV + '/' + r.maxSc + ' ' + (r.atrapados / Math.max(1, r.lanzados) * 100).toFixed(0) + '%');
      if (sk === 0.6 && (Math.abs(a - b) > 0.15 || r.emp / r.n > 0.25)) ok = false;
    }
    console.log('  lv' + lv + '  ' + fila.join('  |  '));
  }
  console.log(ok ? 'OK: lados parejos (diferencia ≤15 pp por celda) y empates ≤25 % con skill .6' : 'REVISAR: lados desparejos o demasiados empates');
  return ok;
}

/* sobre el stack real: 4 humanos-bot con la misma habilidad; la ventaja del juez = victorias de su equipo - 50 % (los empates cuentan medio) */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes, CAT: CATS } = require(path.join(__dirname, '../../../test/fiesta-live.test.js'));
  parchea(CATS && CATS.f_cava ? { CATALOGO: [CATS.f_cava] } : null); Object.assign(CATS.f_cava, CAT_LINEA);
  require(SRC);
  const N = +(process.env.N || 40);
  console.log('f_cava · stack REAL (fiesta-net + fiesta-live + party.js), ' + N + ' partidas por celda, skill .6, sin pérdida; objetivo: equipo del juez <= 58 %');
  for (const lv of [1, 2, 3]) {
    const fila = [];
    for (const delay of [1, 150, 300]) {
      let w = 0, emp = 0, tot = 0;
      for (let seed = 1; seed <= N; seed++) {
        const H = await arnes({ game: 'f_cava', tipo: '2v2', dur: 35, humans: 4, loss: 0, delay, seed, lv });
        H.bot = {}; H.ids.forEach((s) => { H.bot[s] = { skill: 0.6 }; });
        await H.arrancar(); await H.cerrar(60);
        const res = H.res(); if (res) { tot++; const ji = H.ids.indexOf(H.mj().juez), pl = res.puestos; if (pl[0] === pl[2]) emp++; else if (pl[ji] === 1) w++; }
        H.cerrarTodo && H.cerrarTodo();
      }
      const noEmp = Math.max(1, tot - emp);
      fila.push('retardo ' + String(delay).padStart(3) + ' ms: juez gana ' + pct(w / noEmp) + ' de los no empatados (' + tot + ' partidas, ' + emp + ' empates)');
    }
    console.log('  lv' + lv + '  ' + fila.join('   '));
  }
}

module.exports = { cargar, mkCtx, jugar, medir, verdict, resuelveClaims, parchea, CAT, CAT_LINEA };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else { const DEF = cargar(); process.exit(balance(DEF) ? 0 : 1); }
}
