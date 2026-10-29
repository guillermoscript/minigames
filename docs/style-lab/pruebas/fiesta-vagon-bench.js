'use strict';
/* Banco headless de f_vagon (FFA survival, modelo C). SOLO jugabilidad (no dibuja; el estilo no importa).
     node docs/style-lab/pruebas/fiesta-vagon-bench.js              resumen: salidas por partida, primera salida, fin, cuota por asiento, ociosos, habilidad
     N=100 node …                                                   semillas por celda (por defecto 200)
     node docs/style-lab/pruebas/fiesta-vagon-bench.js --red        sobre el stack REAL a 50/150/300 ms: ventaja del juez (N=40 por celda; LOSS=0.05 para pérdida)
   Un solo contexto falso con los n asientos «míos» (como la práctica): este proceso hace de juez, llama a ai() de las CPU y a step() a 1/30.
   El puesto sale de FIESTA.reglas.puestos (survival: normSurvival + compara), nunca de un hook del juego. Cuota = 1/(empatados en 1.º) si el asiento es 1.º.
   Exporta cargar/mkCtx/tick/jugar/medir/puestos para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
const SRC = path.join(SL, 'fiesta-juego-vagon.js');
const rng = require(path.join(SL, 'fiesta-rng.js'));
const reglas = require(path.join(SL, 'fiesta-reglas.js'));
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_vagon')[0];

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC];
  require(SRC);
  return defs.f_vagon;
}
/* límites: los del catálogo cuando main los registre; mientras tanto, los del juego */
const lim = (DEF) => (CAT && CAT.lim) || DEF.limites;

/* inputs[p] = {x,y,a,tap}; los toques se consumen en cada lectura (como c.tap del runtime) */
function mkCtx(DEF, o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: 0, in: Array.from({ length: n }, () => ({ x: 0, y: 0, a: false, b: false, tap: 0 })), g: null };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, equipos: Array.from({ length: n }, (_, i) => i), lv, dur, practica: false, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: ['#ff7ab0', '#ffb36b', '#3fb0ff', '#4fd06a'][i], cpu: false, human: true, team: i })),
    sinGente: o.sinGente, campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p, b) => (b === 'b' ? st.in[p].b : st.in[p].a), tap: (p) => { const v = st.in[p].tap; st.in[p].tap = 0; return v; },
    eje: (p) => ({ x: st.in[p].x, y: st.in[p].y }), cpu: new Array(n).fill(false),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => o.juez !== false, lag: o.lag == null ? undefined : () => o.lag, mio: () => true, remoto: () => null, ev() {}, out() {}, send: () => true, on() {}, claim() {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* un tick del juez: ai de las CPU -> step -> update. modos[p] = 'cpu' | 'idle' | función(st,p,api) */
function tick(st, modos, m) {
  const n = st.c.n, api = (p) => ({ press: () => { st.in[p].tap++; }, hold: (b, v) => { st.in[p][b === 'b' ? 'b' : 'a'] = !!v; }, eje: (x, y) => { st.in[p].x = x; st.in[p].y = y; } });
  for (let p = 0; p < n; p++) { const f = modos[p]; if (f === 'cpu') st.g.ai(p, 1 / 30, api(p)); else if (typeof f === 'function') f(st, p, api(p)); }
  st.g.step(1 / 30); st.gt += 1 / 30; st.g.update(1 / 30);
  if (m) m(st);
}
/* juega hasta que done() lo permita (tras minT) o hasta dur; devuelve scores() */
function jugar(st, modos, segs, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30), minT = Math.min(6, st.c.dur - 1);   // minT del juego (6)
  for (let i = 0; i < t; i++) { tick(st, modos, m); if (st.gt >= minT && st.g.done()) break; }
  return st.g.scores();
}
const puestos = (st) => reglas.puestos('ffa', st.c.equipos, st.g.scores(), 'survival');
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

/* Resumen de N partidas. */
function medir(DEF, o) {
  o = o || {};
  const N = o.N || +process.env.N || 200, dur = o.dur || DEF.dur, n = o.n || 4, modos = o.modos || CPU4.slice(0, n);
  const r = { N, cuota: new Array(n).fill(0), salidas: 0, primera: 0, conPrimera: 0, fin: 0, finTemprano: 0, todos: 0, solo1: 0, kos: 0, golpes: 0, quietos: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed, dur, n, skill: o.skill == null ? 0.6 : o.skill });
    let ult = null; const movs = new Array(n).fill(0);
    jugar(st, modos, dur, (s) => { const v = s.g.vista(); if (ult) for (let j = 0; j < n; j++) if (!v.sc[j] && Math.hypot(v.x[j] - ult.x[j], v.y[j] - ult.y[j]) > 0.5) movs[j]++; ult = { x: v.x.slice(), y: v.y.slice() }; });
    const v = st.g.vista(), pl = puestos(st), top = pl.filter((x) => x === 1).length;
    pl.forEach((x, j) => { if (x === 1) r.cuota[j] += 1 / top; });
    const out = v.sc.filter((x) => x > 0); r.salidas += out.length; if (out.length) { r.primera += Math.min.apply(null, out) / 30; r.conPrimera++; }
    if (v.vivos === n) r.todos++; if (v.vivos === 1) r.solo1++;
    r.fin += st.gt; if (st.gt < dur - 0.1) r.finTemprano++;
    r.kos += v.ko.reduce((a, b) => a + b, 0); r.golpes += v.golpes;
    movs.forEach((mv, j) => { if (modos[j] === 'cpu' && mv < 150) r.quietos++; });
  }
  r.cuota = r.cuota.map((x) => x / N); r.salidasPP = r.salidas / N; r.primeraM = r.primera / Math.max(1, r.conPrimera); r.finM = r.fin / N;
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
function fila(r) {
  return 'salidas/partida ' + r.salidasPP.toFixed(2) + ' · 1.ª salida ' + r.primeraM.toFixed(1) + ' s · fin ' + r.finM.toFixed(0) + ' s (temprano ' + pct(r.finTemprano / r.N) + ') · queda 1 ' + pct(r.solo1 / r.N) +
    ' · nadie sale ' + pct(r.todos / r.N) + ' · cuota ' + r.cuota.map(pct).join(' ') + ' · CPU quietas ' + r.quietos;
}
function resumen(DEF) {
  const N = +process.env.N || 200;
  console.log('f_vagon · banco (N=' + N + ' semillas por celda; 4 CPU salvo que se diga otra cosa; el puesto lo decide reglas.puestos survival)');
  let ok = true;
  for (const lv of [1, 2, 3]) {
    const r = medir(DEF, { lv, skill: 0.6 }); console.log('  lv' + lv + ' skill .6   ' + fila(r));
    if (r.cuota.some((x) => x > 0.25 + 0.08) || r.salidasPP < 1.5 || r.todos / r.N > 0.1 || r.quietos > 0) ok = false;
  }
  for (const sk of [0.35, 0.85]) { const r = medir(DEF, { lv: 2, skill: sk }); console.log('  lv2 skill ' + sk + '  ' + fila(r)); }
  const fuerte = medir(DEF, { lv: 2, skill: [0.9, 0.3, 0.9, 0.3] }); console.log('  .9/.3/.9/.3 (lv2)  cuota ' + fuerte.cuota.map(pct).join(' ') + ' · los .9 juntos ' + pct(fuerte.cuota[0] + fuerte.cuota[2]));
  if (fuerte.cuota[0] + fuerte.cuota[2] < 0.57) ok = false;
  for (const lv of [1, 3]) {
    const ocio = medir(DEF, { lv, skill: 0.6, modos: ['idle', 'idle', 'cpu', 'cpu'] }); console.log('  lv' + lv + ' 2 ociosos (0,1) vs 2 CPU .6   cuota ociosos ' + pct(ocio.cuota[0] + ocio.cuota[1]) + ' · CPU ' + pct(ocio.cuota[2] + ocio.cuota[3]));
    if (ocio.cuota[0] + ocio.cuota[1] > 0.02) ok = false;
  }
  const duelo = medir(DEF, { lv: 1, n: 2, dur: 20, skill: 0.6 }); console.log('  práctica 1v1 dur 20   ' + fila(duelo));
  console.log(ok ? 'OK: cuota por asiento ≤ 1/n + 8 pp, ≥1,5 salidas por partida, ≤10 % sin salidas, ociosos no ganan, la habilidad pesa' : 'FUERA DE RANGO: revisa los números de arriba');
  return ok;
}

/* sobre el stack REAL (fiesta-net + fiesta-live + party.js en memoria): 4 humanos-bot skill .6, retardo fijo. Ventaja del juez FINAL (se lee tras cerrar:
   el provisional del arranque migra al de mejor RTT, M4 §2). Cuota del juez = 1/(empatados en 1.º) si el juez es 1.º. Puerta 08 §11.2 #10: ≤ 1/4 + 8 pp. */
async function red(o) {
  o = o || {};
  process.env.LIVE_DBG = '1';
  const { arnes } = require(path.join(__dirname, '../../../test/fiesta-live.test.js'));
  require(SRC);
  const N = o.N || +(process.env.N || 40), DUR = o.dur || +(process.env.DUR || 50), LOSS = o.loss != null ? o.loss : +(process.env.LOSS || 0), delays = o.delays || [50, 150, 300], base = o.base || 1;
  const out = {};
  if (!o.quiet) console.log('f_vagon · stack REAL, ' + N + ' partidas por celda, 4 bots skill .6, pérdida ' + LOSS + ', dur ' + DUR + ' s');
  for (const delay of delays) {
    let cuota = 0, tot = 0, sal = 0; const porAs = [0, 0, 0, 0];
    for (let seed = base; seed < base + N; seed++) {
      const H = await arnes({ game: 'f_vagon', dur: DUR, humans: 4, loss: LOSS, delay, seed, lv: 1 + (seed % 3) });
      H.bot = {}; H.ids.forEach((sid) => { H.bot[sid] = { skill: 0.6 }; });
      await H.arrancar(); await H.cerrar(90);
      const res = H.res(); if (!res) { H.cerrarTodo(); continue; }
      const ji = H.mj().as.indexOf(H.mj().juez), p = res.puestos, top = p.filter((x) => x === 1).length;
      tot++; if (p[ji] === 1) cuota += 1 / top; p.forEach((x, j) => { if (x === 1) porAs[j] += 1 / top; });
      sal += res.sc.filter((x) => x <= DUR * 30).length;
      H.cerrarTodo();
    }
    out[delay] = { cuota: cuota / Math.max(1, tot), tot, porAs: porAs.map((x) => x / Math.max(1, tot)), sal: sal / Math.max(1, tot) };
    if (!o.quiet) console.log('  retardo ' + String(delay).padStart(3) + ' ms: cuota del juez ' + pct(out[delay].cuota) + ' (puerta ≤ 33 %, ±' + (100 * Math.sqrt(0.25 * 0.75 / Math.max(1, tot))).toFixed(0) + ' pp) · por asiento ' + out[delay].porAs.map(pct).join(' ') + ' · salidas/partida ' + out[delay].sal.toFixed(2) + ' (' + tot + ' partidas)');
  }
  return out;
}

module.exports = { cargar, mkCtx, tick, jugar, medir, puestos, red, CAT, CPU4, lim };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else { const DEF = cargar(); process.exit(resumen(DEF) ? 0 : 1); }
}
