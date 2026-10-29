'use strict';
/* Banco headless de f_abuela (FFA supervivencia, modelo A): sin red, UN contexto `c` falso con los 4 asientos «míos» (como la práctica).
     node docs/style-lab/pruebas/fiesta-abuela-bench.js            por nivel y habilidad (.35/.6/.85): cuántas CPU aguantan los 45 s, duración media, empates y
                                                                    reparto de victorias por asiento (200 semillas); la «ventaja del juez» del doc 08 §11.2 #10 se mide aquí
                                                                    como sesgo por asiento (en el modelo A el juez no juega distinto: solo cambia su lag, que la red de abajo mide).
   El ganador se saca de FIESTA.reglas.puestos (el mismo criterio que el servidor). */
const path = require('path');
const SL = path.join(__dirname, '..'), SRC = path.join(SL, 'fiesta-juego-abuela.js');
const rng = require(path.join(SL, 'fiesta-rng.js')), reglas = require(path.join(SL, 'fiesta-reglas.js'));

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = Object.assign(globalThis.FIESTA || {}, { rng, reglas, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } });
  delete require.cache[SRC]; require(SRC);
  return defs.f_abuela;
}
function mkCtx(DEF, o) {
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 45, lv = o.lv || 1;
  const st = { gt: -3, ta: new Array(n).fill(0), tb: new Array(n).fill(0), g: null };
  const c = {
    n, yo: 0, modo: 'ffa', lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }), ahora: () => st.gt, rng: rng.crear(seed),
    rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false, tap: (p, b) => { const a = b === 'b' ? st.tb : st.ta, v = a[p]; a[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: () => ({ x: 0, y: 0 }), cpu: new Array(n).fill(false), skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); }, out: (p, kk) => c.ev('out', { kk }, p),
    send: () => true, on: () => {}, claim: () => {}, util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c); return st;
}
function jugar(st) {
  const g = st.g, n = st.c.n, dt = 1 / 30, api = (p) => ({ press: (b) => { (b === 'b' ? st.tb : st.ta)[p]++; }, hold() {}, eje() {} });
  while (st.gt < st.c.dur + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) g.ai(p, dt, api(p));
    g.update(dt);
    if (st.gt >= Math.min(3, st.c.dur - 1) && g.done()) break;
    if (st.gt >= st.c.dur) break;
  }
  return g.scores();
}
function medir(DEF, o) {
  const N = o.semillas || 200, n = 4, gana = new Array(n).fill(0); let llegan = 0, vivosFin = 0, tfin = 0, empateTop = 0;
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx(DEF, { n, seed, lv: o.lv, skill: o.skill, dur: 45 }), sc = jugar(st);
    const pl = reglas.puestos('ffa', [0, 1, 2, 3], sc, 'survival'), tops = pl.filter((x) => x === 1).length;
    pl.forEach((x, i) => { if (x === 1) gana[i] += 1 / tops; });
    if (tops > 1) empateTop++;
    const v = st.g.vista(); vivosFin += v.vivos; if (v.vivos >= 2) llegan++; tfin += st.gt;
  }
  return { gana: gana.map((x) => x / N), llegan: llegan / N, vivosFin: vivosFin / N, tfin: tfin / N, empateTop: empateTop / N };
}
module.exports = { cargar, mkCtx, jugar, medir };
if (require.main === module) {
  const DEF = cargar();
  for (const lv of [1, 2, 3]) for (const sk of [0.35, 0.6, 0.85]) {
    const r = medir(DEF, { lv, skill: sk });
    console.log(`lv${lv} skill ${sk}: llegan>=2 ${(r.llegan * 100).toFixed(0)}% · vivos al final ${r.vivosFin.toFixed(2)} · t medio ${r.tfin.toFixed(1)} s · empate en 1.º ${(r.empateTop * 100).toFixed(0)}% · victoria por asiento ${r.gana.map((x) => (x * 100).toFixed(0) + '%').join(' ')}`);
  }
}
