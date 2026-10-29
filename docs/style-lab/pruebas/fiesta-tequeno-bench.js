'use strict';
/* Banco headless de f_tequeno (¡TEQUEÑOS!, modelo A).  node docs/style-lab/pruebas/fiesta-tequeno-bench.js [--quiet]
   Sin navegador ni red real: carga fiesta-juego-tequeno.js en un vm con las primitivas del laboratorio como stubs (graba qué se pinta y que NO se
   use ctx.fill/stroke/arc/...) y simula n pantallas con un mini-runtime del modelo A (cuerpos `o` a 12 Hz con retardo, jitter y 5 % de pérdida;
   el juez corre `ai` de las CPU y emite el veredicto en dur, con los `o` que le llegaron). NO es fiesta-live.js (eso lo cubre
   test/fiesta-live-tequeno.test.js): sirve para (1) ventaja del juez con bots de igual habilidad en 200 semillas, (2) bots vs ociosos,
   (3) humo de dibujo en 340x600 y 800x600. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', '..', '..');
const quiet = process.argv.includes('--quiet'); let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } else if (!quiet) console.log('✓ ' + m); };
const FORBID = ['fill', 'stroke', 'arc', 'lineTo', 'moveTo', 'drawImage', 'fillText', 'strokeText', 'beginPath', 'fillRect'];
function sandbox() {
  const calls = { rr: 0, ell: 0, line: 0, poly: 0, txt: 0, bust: 0, pj: 0, forbidden: [], throws: 0 };
  const ctx = new Proxy({}, { get: (t, k) => { if (FORBID.includes(k)) { calls.forbidden.push(k); } return () => {}; }, set: () => true });
  const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, ctx,
    rr() { calls.rr++; }, ell() { calls.ell++; }, line() { calls.line++; }, poly() { calls.poly++; }, txt() { calls.txt++; }, bust() { calls.bust++; }, snd() {} };
  sb.window = sb; sb.BUS = { AP: { CAST: { mama: {}, abuela: {} } } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/style-lab/fiesta-rng.js'), 'utf8'), sb);
  const defs = {}; sb.FIESTA.LIVE = { add(id, d) { defs[id] = d; }, get(id) { return defs[id] || null; } };
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/style-lab/fiesta-juego-tequeno.js'), 'utf8'), sb, { filename: 'fiesta-juego-tequeno.js' });
  return { sb, def: defs.f_tequeno, calls };
}
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/* mini-runtime modelo A. o: n, humans (asientos humanos; el resto CPU que corre el juez), judge, skills[], lv, seed, delay, jitter, loss, w, draw */
function sim(o) {
  const { sb, def, calls } = sandbox();
  const n = o.n || 4, humans = o.humans || [0, 1, 2, 3], seed = o.seed || 1, lv = o.lv || 1, dur = o.dur || 30, judge = o.judge == null ? humans[0] : o.judge;
  const delay = (o.delay == null ? 150 : o.delay) / 1000, jit = (o.jitter == null ? 50 : o.jitter) / 1000, loss = o.loss == null ? 0.05 : o.loss;
  const lr = sb.FIESTA.rng.crear(seed * 7 + 1), net = []; let T = -3.5;
  const send = fn => { if (lr.next() < loss) return; net.push({ at: T + delay + lr.next() * jit, fn }); };
  const cpuSeat = []; for (let p = 0; p < n; p++) cpuSeat[p] = !humans.includes(p);
  const seats = []; for (let p = 0; p < n; p++) seats.push({ id: 'abcd'[p], name: 'P' + (p + 1), ch: 'pana', color: '#ff7ab0', cpu: cpuSeat[p], human: !cpuSeat[p], team: p });
  const skill = o.skills || [0.6, 0.6, 0.6, 0.6];
  const clients = [];
  for (let i = 0; i < n; i++) {
    if (!humans.includes(i) && i !== judge) { clients.push(null); continue; }
    const K = { i, held: Array(n).fill(false), taps: Array(n).fill(0), ax: Array(n).fill(0), last: Array(n).fill(null), skew: (lr.next() - 0.5) * 0.04 };
    K.c = { n, yo: i, seats, modo: 'ffa', equipos: seats.map((_, p) => p), solo: -1, lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
      campo: () => ({ x0: 0, x1: o.w || 800, y0: 70, y1: 470 }), ahora: () => T + K.skew, rng: sb.FIESTA.rng.crear(seed), rngFor: tag => sb.FIESTA.rng.crear(fnv(seed + ':' + tag)), fx: () => 0.5,
      held: p => K.held[p], tap: p => { const v = K.taps[p]; K.taps[p] = 0; return v; }, eje: p => ({ x: K.ax[p], y: 0 }), cpu: cpuSeat.slice(), skill: skill.slice(),
      juez: () => judge === i, mio: p => p === i || (judge === i && cpuSeat[p]), remoto: p => K.last[p], ev() {}, out() {}, send() { return true; }, on() {}, claim() {},
      util: { suave: (a, b) => b, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), pj() { calls.pj++; }, tick: g => Math.floor(g * 30) } };
    K.g = def.mk(K.c); K.api = p => ({ press() { K.taps[p]++; }, hold: (b, v) => { K.held[p] = !!v; }, eje: (x) => { K.ax[p] = x; } });
    clients.push(K);
  }
  const bots = o.bots || humans.map(() => 'bot');
  const dt = 1 / 30; let nextBody = 0;
  const cuerpoTx = (K, p) => { const b = K.g.cuerpo(p); for (const R of clients) if (R && R.i !== K.i) send(() => { if (!R.c.mio(p)) R.last[p] = b; }); };
  while (T < dur + 3) {
    T += dt;
    for (let q = net.length - 1; q >= 0; q--) if (net[q].at <= T) net.splice(q, 1)[0].fn();
    if (T < 0) continue;
    for (const K of clients) {
      if (!K) continue;
      const hi = humans.indexOf(K.i);
      if (hi >= 0 && bots[hi] === 'bot') K.g.ai(K.i, dt, K.api(K.i));          // el humano-bot juega con el mismo ai y su habilidad
      if (K.i === judge) for (let p = 0; p < n; p++) if (cpuSeat[p]) K.g.ai(p, dt, K.api(p));
      if (T < dur) K.g.update(dt); else K.g.update(dt);
    }
    if (T >= nextBody) { nextBody = T + 1 / 12; for (const K of clients) { if (!K) continue; if (!cpuSeat[K.i]) cuerpoTx(K, K.i); if (K.i === judge) for (let p = 0; p < n; p++) if (cpuSeat[p]) cuerpoTx(K, p); } }
    if (o.vereditoEn == null && T >= dur && !sim.v) { /* el veredicto se toma abajo */ }
    if (T >= dur && !o._v) o._v = clients[judge].g.scores();
    if (o.draw && T > 0 && Math.floor(T * 30) % 15 === 0) { try { clients[humans[0]].g.draw(); } catch (e) { calls.throws++; calls.err = e.message; } }
  }
  return { sc: o._v, calls, clients, sb };
}
const puestos = sc => { const idx = sc.map((_, i) => i).sort((a, b) => sc[b] - sc[a]); const pl = Array(sc.length); idx.forEach((p, r) => { pl[p] = r > 0 && sc[idx[r - 1]] === sc[p] ? pl[idx[r - 1]] : r + 1; }); return pl; };

/* 1 · registro */
{
  const { def } = sandbox();
  check(def.modelo === 'A' && def.clase === 'rank' && def.dur === 30 && def.botones === 1 && def.stick === true && def.modos.join() === 'ffa', 'f_tequeno: modelo A, rank, 30 s, stick + 1 botón, ffa');
  check(JSON.stringify(def.limites) === JSON.stringify({ scoreMax: 300, scoreRate: 10, minT: 27, finTemprano: 0 }), 'límites {300, 10, 27, 0}');
}

/* 2 · ventaja del juez: 4 bots de igual habilidad, el juez rota por semilla; 200 semillas por nivel; porcentaje de victoria del asiento juez (empates reparten) */
for (const lv of [1, 2, 3]) {
  let w = 0, N = 200, tot = 0, maxv = 0;
  for (let seed = 1; seed <= N; seed++) {
    const judge = seed % 4, r = sim({ n: 4, judge, lv, seed: seed * 17 + lv, skills: [0.6, 0.6, 0.6, 0.6] });
    const pl = puestos(r.sc), win = pl.filter(x => x === 1).length;
    if (pl[judge] === 1) w += 1 / win;
    tot += r.sc.reduce((a, b) => a + b, 0) / 4; maxv = Math.max(maxv, ...r.sc);
  }
  const pct = w / N * 100;
  check(pct <= 25 + 8, `lv${lv}: el asiento-juez gana ${pct.toFixed(1)} % con bots iguales en ${N} semillas (<= 1/n + 8 pp = 33 %); media ${(tot / N).toFixed(0)} pts, máximo ${maxv}`);
  check(maxv <= 300, `lv${lv}: ningún puntaje supera scoreMax 300 (máx ${maxv})`);
}

/* 3 · ociosos vs CPU activas, y habilidad */
for (const lv of [1, 2, 3]) for (const seed of [1, 2, 3]) {
  const r = sim({ n: 4, humans: [0, 1], judge: 0, lv, seed, bots: ['idle', 'idle'], skills: [0.6, 0.6, 0.6, 0.6] }), sc = r.sc, pl = puestos(sc);
  check(sc[0] === 0 && sc[1] === 0 && Math.min(sc[2], sc[3]) > 0 && pl[0] >= 3, `2 ociosos + 2 CPU lv${lv} s${seed}: ${sc.join('/')}`);
}
{
  let a = 0, b = 0;
  for (let seed = 1; seed <= 20; seed++) { const r = sim({ n: 2, humans: [0, 1], judge: 0, seed, skills: [0.9, 0.35], loss: 0 }); a += r.sc[0]; b += r.sc[1]; }
  check(a > b * 1.15, `el bot hábil (.9) supera al flojo (.35): ${a} vs ${b} en 20 partidas`);
}

/* 4 · humo de dibujo en vertical 340x600 (ancho lógico 340) y apaisado 800x600, 3 niveles, 2-4 asientos */
for (const w of [340, 372, 800]) for (const lv of [1, 2, 3]) for (const n of [2, 3, 4]) {
  const r = sim({ n, humans: [0, 1].filter(x => x < n), judge: 0, lv, seed: 9, w, draw: true, skills: [0.6, 0.6, 0.6, 0.6] });
  check(r.calls.throws === 0 && !r.calls.forbidden.length && r.calls.rr > 500 && r.calls.txt > 100, `dibujo ${w}x600 lv${lv} n${n}: sin excepciones${r.calls.err ? ' (' + r.calls.err + ')' : ''}, rr=${r.calls.rr} txt=${r.calls.txt}, sin ctx.* prohibido`);
}
console.log(bad ? `\n${bad} fallos` : '\nTodo bien'); process.exit(bad ? 1 : 0);
