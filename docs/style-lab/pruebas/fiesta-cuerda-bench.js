'use strict';
/* Banco headless de f_cuerda (2v2, modelo C). SOLO jugabilidad (no dibuja).
     node docs/style-lab/pruebas/fiesta-cuerda-bench.js          resumen: simetría de lados, empates, habilidad, ociosos, ritmo (LIVE.sim = create() REAL con 4 CPU)
     N=100 node …                                                 semillas por celda (por defecto 200)
     node docs/style-lab/pruebas/fiesta-cuerda-bench.js --red     ventaja del juez sobre el stack REAL (arnés de red) a 1/150/300 ms; FAIR=0 usa el runtime tal cual (sin c.fair), FAIR=1 inyecta c.fair()
   Dos formas de jugar:
     · medir(): LIVE.sim('f_cuerda', …) = sesión real con los 4 asientos CPU (juez, terminar, compara, hash).
     · mkCtx()/jugar(): contexto falso con control fino por asiento: 'cpu' (ai del juego dentro del juez), 'idle', función(st,p,api), 'net' (humano remoto: su pulsación llega al juez por el
       manejador xtir con retardo/pérdida simulados y un sello = hora REAL de pulsar) y `yo` humano (el juez lee su pulsación por c.tap(), retrasada por c.fair()).
   El ganador sale de FIESTA.reglas.compara (M3 DM3-4). «Igual habilidad» = las 4 CPU con la misma skill. Exporta cargar/mkCtx/jugar/medir para las pruebas. */
const path = require('path');
const SL = path.join(__dirname, '..');
globalThis.window = globalThis;
globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng: require(path.join(SL, 'fiesta-rng.js')), reglas: require(path.join(SL, 'fiesta-reglas.js')) });
const LIVE = require(path.join(SL, 'fiesta-live.js'));
const SRC = path.join(SL, 'fiesta-juego-cuerda.js');
const rng = globalThis.FIESTA.rng, reglas = globalThis.FIESTA.reglas;
const CATALOGO = reglas.CATALOGO.filter((x) => x.g === 'f_cuerda')[0];
/* el catálogo compartido aún no trae `lim` para f_cuerda (M4: lo añade quien tenga fiesta-reglas.js); esto es lo que debe llevar */
const LIM = { scoreMax: 39, scoreRate: 1.4, minT: 29, finTemprano: 0 };
const CAT = Object.assign({}, CATALOGO, CATALOGO.lim ? {} : { lim: LIM });

function cargar() { if (!LIVE.get('f_cuerda')) { delete require.cache[SRC]; require(SRC); } return LIVE.get('f_cuerda'); }

function mkCtx(DEF, o) {
  o = o || {};
  const n = 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1, yo = o.yo === undefined ? 0 : o.yo;
  const humanos = o.humanos || [];                                              // asientos «remotos»: su entrada llega por xtir
  const st = { gt: 0, in: Array.from({ length: n }, () => ({ tap: 0 })), g: null, handlers: {}, netq: [], sent: [], evs: [], rnd: rng.crear(seed * 7 + 1), perdidos: 0 };
  const c = {
    n, yo, modo: '2v2', solo: -1, equipos: o.equipos || [0, 0, 1, 1], lv, dur, practica: false, modelo: 'C', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i < 2 ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false, tap: (p) => { const v = st.in[p].tap; st.in[p].tap = 0; return v; }, eje: () => ({ x: 0, y: 0 }),
    cpu: Array.from({ length: n }, (_, i) => !(humanos.indexOf(i) >= 0 || (o.yoHumano && i === yo))),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => o.juez !== false, mio: () => true, remoto: () => null, ev(ty, d) { st.evs.push({ ty, d }); }, out() {}, claim() {},
    send: (t, d) => { st.sent.push({ t, d }); return true; }, on: (t, fn) => { st.handlers[t] = fn; },
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  if (o.fair != null) c.fair = () => o.fair;
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* un tick del juez: ai de las CPU y de los 'net' -> entregas de red -> step -> update. modos[p] = 'cpu' | 'idle' | 'net' | función(st,p,api) */
function tick(st, modos, red) {
  const n = st.c.n; red = red || {};
  const api = (p, net) => ({
    press: () => { if (net) { net.stamps.push(Math.round(st.gt * 1000)); if (net.stamps.length > 3) net.stamps.shift(); const perdido = st.rnd.next() < (red.loss || 0); if (perdido) st.perdidos++; else st.netq.push({ at: st.gt + ((red.lat || 0) + st.rnd.next() * (red.jit || 0)) / 1000, p, d: { t: net.stamps.slice() } }); st.netq.push({ at: st.gt + 0.2 + (red.lat || 0) / 1000, p, d: { t: net.stamps.slice() } }); } else st.in[p].tap++; },
    hold() {}, eje() {}
  });
  st.netst = st.netst || [null, null, null, null];
  for (let p = 0; p < n; p++) {
    const f = (modos || [])[p];
    if (f === 'cpu') st.g.ai(p, 1 / 30, api(p, null));
    else if (f === 'net') { st.netst[p] = st.netst[p] || { stamps: [] }; st.g.ai(p, 1 / 30, api(p, st.netst[p])); }
    else if (typeof f === 'function') f(st, p, api(p, null));
  }
  if (st.netq.length) { const due = st.netq.filter((e) => e.at <= st.gt + 1e-9); st.netq = st.netq.filter((e) => e.at > st.gt + 1e-9); due.forEach((e) => st.handlers.xtir && st.handlers.xtir(e.d, e.p)); }
  st.g.step(1 / 30); st.gt += 1 / 30; st.g.update(1 / 30);
}
function jugar(st, modos, segs, red, m) {
  const t = Math.round((segs == null ? st.c.dur : segs) * 30);
  for (let i = 0; i < t; i++) { tick(st, modos, red); if (m) m(st); }
  return st.g.scores();
}
const veredicto = (st) => reglas.compara('2v2', st.c.equipos, st.g.scores());
const CPU4 = ['cpu', 'cpu', 'cpu', 'cpu'];

/* N partidas con LIVE.sim (sesión real, 4 CPU). Devuelve recuentos por lado. */
function medir(DEF, o) {
  o = o || {}; void DEF;
  const N = o.N || +process.env.N || 200, dur = o.dur || 30;
  const r = { N, w0: 0, w1: 0, emp: 0, tandas: [0, 0, 0], sc: [], dobles: 0, fouls: 0, pulls: 0, margen: 0, rondas: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const x = LIVE.sim('f_cuerda', { tipo: '2v2', seed: o.seedBase ? seed + o.seedBase : seed, lv: o.lv || 1, dur, skill: o.skill == null ? 0.6 : o.skill });
    if (x.ganaLado === 'eq0') r.w0++; else if (x.ganaLado === 'eq1') r.w1++; else r.emp++;
    const v = x.vista; r.sc.push(x.sc);
    v.pulls.forEach((q) => { r.pulls += q; }); v.fouls.forEach((q) => { r.fouls += q; });
    v.res.forEach((q) => { r.rondas++; r.margen += Math.abs(q); r.tandas[q > 0 ? 0 : q < 0 ? 1 : 2]++; });
  }
  return r;
}
/* partidas con el contexto falso (control por asiento); devuelve recuentos por lado con compara */
function medirCtx(DEF, o) {
  o = o || {};
  const N = o.N || 100, r = { N, w0: 0, w1: 0, emp: 0, sc: [], pulls: [0, 0, 0, 0], fouls: [0, 0, 0, 0] };
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { lv: o.lv || 1, seed, dur: o.dur || 30, skill: o.skill == null ? 0.6 : o.skill, humanos: o.humanos, yoHumano: o.yoHumano, fair: o.fair });
    jugar(st, o.modos || CPU4, o.dur || 30, o.red);
    const ve = veredicto(st);
    if (ve.puestos[0] === ve.puestos[2]) r.emp++; else if (ve.puestos[0] === 1) r.w0++; else r.w1++;
    const v = st.g.vista(); for (let j = 0; j < 4; j++) { r.pulls[j] += v.pulls[j]; r.fouls[j] += v.fouls[j]; }
  }
  return r;
}
const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
function fila(r) { return 'eq0 ' + pct(r.w0 / r.N) + ' eq1 ' + pct(r.w1 / r.N) + ' empate ' + pct(r.emp / r.N) + ' · |Δ| ' + (Math.abs(r.w0 - r.w1) / r.N * 100).toFixed(1) + ' pp' + (r.rondas ? ' · tandas eq0/eq1/emp ' + r.tandas.join('/') + ' · margen medio ' + (r.margen / r.rondas).toFixed(0) + ' · tirones/partido ' + (r.pulls / r.N).toFixed(1) + ' · fueras/partido ' + (r.fouls / r.N).toFixed(1) : ''); }

function resumen(DEF) {
  console.log('f_cuerda · banco (N=' + (+process.env.N || 200) + ' semillas por celda; LIVE.sim = sesión real con 4 CPU; gana quien decide compara)');
  let ok = true;
  for (const lv of [1, 2, 3]) { const r = medir(DEF, { lv, skill: 0.6 }); console.log('  lv' + lv + ' skill .6   ' + fila(r)); if (Math.abs(r.w0 - r.w1) / r.N > 0.1 || r.emp / r.N > 0.3) ok = false; }
  for (const sk of [0.35, 0.85]) { const r = medir(DEF, { lv: 1, skill: sk }); console.log('  lv1 skill ' + sk + '  ' + fila(r)); }
  const fuerte = medir(DEF, { lv: 1, skill: [0.9, 0.9, 0.3, 0.3] }); console.log('  .9+.9 (eq0) vs .3+.3 (eq1)  eq0 gana ' + pct(fuerte.w0 / fuerte.N) + ' · empate ' + pct(fuerte.emp / fuerte.N) + ' · eq1 ' + pct(fuerte.w1 / fuerte.N));
  const ocio = medirCtx(DEF, { N: 100, modos: ['idle', 'idle', 'cpu', 'cpu'] }); console.log('  2 ociosos (eq0) vs 2 CPU .6   eq0 gana ' + pct(ocio.w0 / ocio.N) + ' · empate ' + pct(ocio.emp / ocio.N) + ' · eq1 ' + pct(ocio.w1 / ocio.N));
  const uno = medirCtx(DEF, { N: 100, modos: ['cpu', 'idle', 'cpu', 'cpu'] }); console.log('  1 CPU + 1 ocioso (eq0) vs 2 CPU .6   eq0 gana ' + pct(uno.w0 / uno.N) + ' · empate ' + pct(uno.emp / uno.N) + ' · eq1 ' + pct(uno.w1 / uno.N));
  console.log(ok ? 'OK: simetría ±10 pp y empates ≤30 % en los 3 niveles (skill .6)' : 'FUERA DE RANGO: revisa simetría / empates');
  return ok;
}

/* sobre el stack REAL (arnés de red: fiesta-net + fiesta-live + party.js en memoria): 4 bots (el propio `ai` del juego sobre sess.in), retardo fijo, sin pérdida por defecto.
   Mide la ventaja del juez: qué equipo gana, el del juez o el otro. FAIR=1 inyecta c.fair() = fairDelayEq (la mejora pedida al runtime); sin FAIR se usa el runtime actual. */
async function red() {
  const A = require(path.join(__dirname, '../../../test/helpers/live-arnes.js'));
  cargar();
  const R0 = A.R0.CATALOGO.filter((x) => x.g === 'f_cuerda')[0]; if (!R0.lim) R0.lim = Object.assign({}, LIM);
  const N = +(process.env.N || 40), DUR = +(process.env.DUR || 30), FAIR = process.env.FAIR === '1', LOSS = process.env.LOSS == null ? 0.05 : +process.env.LOSS;
  console.log('f_cuerda · stack REAL, ' + N + ' partidas por celda, 4 bots skill .6, pérdida ' + LOSS + ', dur ' + DUR + ' s, ' + (FAIR ? 'con c.fair() inyectado' : 'runtime actual (sin c.fair)'));
  for (const delay of [50, 150, 300]) {
    let jw = 0, ow = 0, emp = 0, tot = 0;
    for (let seed = 1; seed <= N; seed++) {
      const H = await A.arnes({ game: 'f_cuerda', tipo: '2v2', dur: DUR, humans: 4, loss: LOSS, delay, seed, lv: 1 + (seed % 3) });
      H.bot = {}; H.ids.forEach((sid) => { H.bot[sid] = { skill: 0.6 }; });
      H.abrir();
      if (FAIR) H.ids.forEach((sid) => { const s = H.sess[sid]; s.c.fair = () => { const f = s.fair(); return f ? Math.min(0.5, 2 * f + 0.04) : 0; }; });
      await H.arrancar(); await H.cerrar(60);
      const res = H.res(); if (!res) { H.cerrarTodo(); continue; }
      tot++;
      const jt = H.ids.indexOf(H.mj().juez) < 2 ? 0 : 1, p = res.puestos;
      if (p[0] === p[2]) emp++; else if ((p[0] === 1 ? 0 : 1) === jt) jw++; else ow++;
      H.cerrarTodo();
    }
    const dec = Math.max(1, jw + ow);
    console.log('  retardo ' + String(delay).padStart(3) + ' ms: gana el equipo del juez ' + pct(jw / Math.max(1, tot)) + ' · el otro ' + pct(ow / Math.max(1, tot)) + ' · empate ' + pct(emp / Math.max(1, tot)) + ' (' + tot + ' partidas; entre decididas: juez ' + pct(jw / dec) + ')');
  }
}

module.exports = { cargar, mkCtx, tick, jugar, medir, medirCtx, veredicto, red, CAT, CPU4, LIVE, LIM };
if (require.main === module) {
  if (process.argv.includes('--red')) red().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  else { const DEF = cargar(); process.exit(resumen(DEF) ? 0 : 1); }
}
