'use strict';
/* Banco headless de f_futbolito (2v2, modelo C). SOLO jugabilidad (no dibuja; el estilo no importa).
     node docs/style-lab/pruebas/fiesta-futbolito-bench.js              resumen: goles, empates, simetría de lados, habilidad, ociosos, ritmo
     N=100 node …                                                       semillas por celda (por defecto 120)
     node docs/style-lab/pruebas/fiesta-futbolito-bench.js --red        lo mismo sobre el stack REAL con 1/150/300 ms: ventaja del juez (informativo)
   Un solo contexto falso con los 4 asientos «míos» (como la práctica): este proceso hace de juez, llama a ai() de las CPU y a step() a 1/30.
   El ganador sale de FIESTA.reglas.compara (M3 DM3-4), nunca de un hook del juego. «Igual habilidad» = las 4 CPU con la misma skill.
   Exporta cargar/mkCtx/jugar/medir para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-futbolito.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_futbolito')[0];

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_futbolito;
}

/* inputs[p] = {x,y,a,b,tap}; los toques se consumen en cada lectura (como c.tap del runtime) */
function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: 0, in: Array.from({ length: n }, () => ({ x: 0, y: 0, a: false, b: false, tap: 0, tapB: 0 })), g: null, evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: n === 4 ? '2v2' : '1v1', solo: -1, equipos: n === 4 ? [0, 0, 1, 1] : [0, 1], lv, dur, practica: false, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: ['#ff7ab0', '#ffb36b', '#3fb0ff', '#4fd06a'][i], cpu: false, human: true, team: i < 2 ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p, b) => (b === 'b' ? st.in[p].b : st.in[p].a), tap: (p, b) => { const k = b === 'b' ? 'tapB' : 'tap', v = st.in[p][k]; st.in[p][k] = 0; return v; },
    eje: (p) => ({ x: st.in[p].x, y: st.in[p].y }), cpu: new Array(n).fill(false),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => o.juez !== false, lag: o.lag == null ? undefined : () => o.lag, mio: () => true, remoto: () => null, ev(ty, d) { st.evs.push({ ty, d }); }, out() {}, send: () => true, on() {}, claim() {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* un tick del juez: ai de las CPU -> step -> update. modos[p] = 'cpu' | 'idle' | función(st,p,api) */
function tick(st, modos, m) {
  const n = st.c.n, api = (p) => ({ press: (b) => { st.in[p][b === 'b' ? 'tapB' : 'tap']++; }, hold: (b, v) => { st.in[p][b === 'b' ? 'b' : 'a'] = !!v; }, eje: (x, y) => { st.in[p].x = x; st.in[p].y = y; } });
  for (let p = 0; p < n; p++) { const f = modos[p]; if (f === 'cpu') st.g.ai(p, 1 / 30, api(p)); else if (typeof f === 'function') f(st, p, api(p)); }
  st.g.step(1 / 30); st.gt += 1 / 30; st.g.update(1 / 30);
  if (m) m(st);
}
/* juega hasta que done() lo permita (tras minT) o hasta dur; devuelve scores() */
function jugar(st, modos, segs, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30), minT = Math.min(CAT.lim.minT, st.c.dur - 1);
  for (let i = 0; i < t; i++) { tick(st, modos, m); if (st.gt >= minT && st.g.done()) break; }
  return st.g.scores();
}
const veredicto = (st) => reglas.compara('2v2', st.c.equipos, st.g.scores());
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

/* Resumen de N partidas. modos/skill/dur configurables. */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 120, dur = o.dur || DEF.dur, modos = o.modos || CPU4;
  const r = { N, w0: 0, w1: 0, emp: 0, goles: 0, g0: 0, g1: 0, oro: 0, tFin: 0, quieta: 0, mitad0: 0, ticks: 0, sinGol: 0, gTot: [] };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed, dur, skill: o.skill == null ? 0.6 : o.skill });
    let still = 0, q = 0, half0 = 0, tk = 0;
    jugar(st, modos, dur, (s) => { const v = s.g.vista(); if (v.pause === 0) { tk++; if (Math.hypot(v.ball.vx, v.ball.vy) < 0.05) q++; if (v.ball.x < 320) half0++; } void still; });
    const v = st.g.vista(), sc = v.sc, ve = veredicto(st);
    r.goles += sc[0] + sc[1]; r.g0 += sc[0]; r.g1 += sc[1]; r.gTot.push(sc[0] + sc[1]); if (sc[0] + sc[1] === 0) r.sinGol++;
    if (ve.puestos[0] === ve.puestos[2]) r.emp++; else if (ve.puestos[0] === 1) r.w0++; else r.w1++;
    if (v.k > v.regT) r.oro++;
    r.tFin += st.gt; r.quieta += q; r.mitad0 += half0; r.ticks += tk;
  }
  r.golesPP = r.goles / N; r.fin = r.tFin / N; r.pQuieta = r.quieta / Math.max(1, r.ticks); r.pMitad0 = r.mitad0 / Math.max(1, r.ticks);
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
function fila(r) { return 'g/partido ' + r.golesPP.toFixed(1).padStart(4) + ' · sin goles ' + pct(r.sinGol / r.N) + ' · eq0 ' + pct(r.w0 / r.N) + ' eq1 ' + pct(r.w1 / r.N) + ' empate ' + pct(r.emp / r.N) + ' · oro ' + pct(r.oro / r.N) + ' · fin ' + r.fin.toFixed(0) + ' s · pelota quieta ' + pct(r.pQuieta) + ' · mitad izq ' + pct(r.pMitad0); }

function resumen(DEF) {
  console.log('f_futbolito · banco (N=' + (+process.env.N || 120) + ' semillas por celda; 4 CPU salvo que se diga otra cosa; gana quien decide compara)');
  let ok = true;
  for (const lv of [1, 2, 3]) { const r = medir(DEF, { lv, skill: 0.6 }); console.log('  lv' + lv + ' skill .6   ' + fila(r)); if (Math.abs(r.w0 - r.w1) / r.N > 0.1 || r.emp / r.N > 0.3 || r.golesPP < 2 || r.golesPP > 8) ok = false; }
  for (const sk of [0.35, 0.85]) { const r = medir(DEF, { lv: 1, skill: sk }); console.log('  lv1 skill ' + sk + '  ' + fila(r)); }
  const fuerte = medir(DEF, { lv: 1, skill: [0.9, 0.9, 0.3, 0.3] }); console.log('  .9+.9 (eq0) vs .3+.3 (eq1)  eq0 gana ' + pct(fuerte.w0 / fuerte.N) + ' · empate ' + pct(fuerte.emp / fuerte.N) + ' · eq1 ' + pct(fuerte.w1 / fuerte.N));
  const ocio = medir(DEF, { lv: 1, skill: 0.6, modos: ['idle', 'idle', 'cpu', 'cpu'] }); console.log('  2 ociosos (eq0) vs 2 CPU .6   eq0 gana ' + pct(ocio.w0 / ocio.N) + ' · empate ' + pct(ocio.emp / ocio.N) + ' · eq1 ' + pct(ocio.w1 / ocio.N));
  const uno = medir(DEF, { lv: 1, skill: 0.6, modos: ['cpu', 'idle', 'cpu', 'cpu'] }); console.log('  1 CPU + 1 ocioso (eq0) vs 2 CPU .6   eq0 gana ' + pct(uno.w0 / uno.N) + ' · empate ' + pct(uno.emp / uno.N) + ' · eq1 ' + pct(uno.w1 / uno.N));
  console.log(ok ? 'OK: simetría ±10 pp, empates ≤30 %, 2-8 goles por partido en los 3 niveles (skill .6)' : 'FUERA DE RANGO: revisa simetría / empates / goles por partido');
  return ok;
}

/* sobre el stack REAL (fiesta-net + fiesta-live + party.js en memoria): 4 humanos-bot, retardo fijo, sin pérdida. Mide la ventaja del juez (qué equipo gana: el del juez o el otro)
   y que el veredicto sea único. N partidas por celda (por defecto 40). Informativo: LIVE_FULL / M3 DM3-12 (b), no bloquea. */
async function red() {
  process.env.LIVE_DBG = '1';
  const { arnes } = require(path.join(__dirname, '../../../test/fiesta-live.test.js'));
  require(SRC);
  const N = +(process.env.N || 40), DUR = +(process.env.DUR || 50);
  console.log('f_futbolito · stack REAL, ' + N + ' partidas por celda, 4 bots skill .6, sin pérdida, dur ' + DUR + ' s');
  for (const delay of [1, 150, 300]) {
    let jw = 0, ow = 0, emp = 0, tot = 0, g = 0;
    for (let seed = 1; seed <= N; seed++) {
      const H = await arnes({ game: 'f_futbolito', tipo: '2v2', dur: DUR, humans: 4, loss: 0, delay, seed, lv: 1 + (seed % 3) });
      H.bot = {}; H.ids.forEach((sid) => { H.bot[sid] = { skill: 0.6 }; });
      await H.arrancar(); await H.cerrar(80);
      const res = H.res(); if (!res) { H.cerrarTodo && H.cerrarTodo(); continue; }
      tot++; g += res.sc.reduce((a, b) => a + b, 0);
      const jt = H.ids.indexOf(H.mj().juez) < 2 ? 0 : 1, p = res.puestos;
      if (p[0] === p[2]) emp++; else if ((p[0] === 1 ? 0 : 1) === jt) jw++; else ow++;
      H.cerrarTodo && H.cerrarTodo();
    }
    console.log('  retardo ' + String(delay).padStart(3) + ' ms: gana el equipo del juez ' + pct(jw / Math.max(1, tot)) + ' · el otro ' + pct(ow / Math.max(1, tot)) + ' · empate ' + pct(emp / Math.max(1, tot)) + ' · goles/partido ' + (g / Math.max(1, tot)).toFixed(1) + ' (' + tot + ' partidas)');
  }
}

module.exports = { cargar, mkCtx, tick, jugar, medir, veredicto, CAT, CPU4 };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else { const DEF = cargar(); process.exit(resumen(DEF) ? 0 : 1); }
}
