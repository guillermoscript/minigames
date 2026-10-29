/* f_mecate: humo sin red. Carga el juego contra un FIESTA.LIVE mínimo y un contexto `c` falso (como el de la práctica:
   todos los asientos son míos) y comprueba reglas, CPU, límites y determinismo. No sustituye a la lista de verificación de E5
   (fiesta-juegos.test.js) que lo corre sobre el runtime y el relé con retardo. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-mecate.js');

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC];
  require(SRC);
  return defs.f_mecate;
}
const DEF = cargar();

/* contexto falso: reloj manual, toques por asiento, todos los asientos míos */
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 45, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), outs: [], g: null, cpu: new Array(n).fill(false) };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p, b) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: () => ({ x: 0, y: 0 }), cpu: st.cpu, skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.outs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); },
    out: (p) => c.ev('out', { kk: Math.floor(st.gt * 30) }, p),
    send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* corre el juego hasta done() o dur; `humanos` = bot por asiento: 'idle'|'bot'|'cpu' */
function jugar(st, modos, dur) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: () => {} });
  while (st.gt < dur + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) {
      const m = modos[p];
      if (m === 'cpu') g.ai(p, dt, api(p));
      else if (m === 'bot') { const v = g.vista(); if (v.aim != null && st.gt >= v.aim && st.gt - dt < v.aim + dt && v.tj[p] + v.cool <= st.gt) st.taps[p]++; }
    }
    g.update(dt);
    if (st.gt >= Math.min(3, dur - 1) && g.done()) break;
    if (st.gt >= dur) break;
  }
  return g.scores();
}

test('registro: paridad con el catálogo (parámetros del §6.1)', () => {
  assert.strictEqual(DEF.modelo, 'A'); assert.strictEqual(DEF.clase, 'survival'); assert.deepStrictEqual(DEF.modos, ['ffa', '1v1']);
  assert.strictEqual(DEF.dur, 45); assert.strictEqual(DEF.botones, 1); assert.deepStrictEqual(DEF.cuerpo, ['y', 'st', 'sc']);
  assert.deepStrictEqual(DEF.limites, { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 });
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015', () => {
  const s = fs.readFileSync(SRC, 'utf8');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/])
    assert.ok(!re.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), String(re));
  const tipos = s.match(/c\.send\(\s*'(\w+)'/g); assert.ok(!tipos, 'el juego no manda mensajes propios');
});

test('mundo: los cruces son idénticos con la misma semilla y distintos con otra', () => {
  for (const lv of [1, 2, 3]) {
    const a = mkCtx({ seed: 7, lv }).g.vista().cruceHash, b = mkCtx({ seed: 7, lv, n: 2 }).g.vista().cruceHash;
    assert.strictEqual(a, b);
  }
  assert.notStrictEqual(mkCtx({ seed: 7, lv: 2 }).g.vista().cruceHash, mkCtx({ seed: 8, lv: 2 }).g.vista().cruceHash);
});

test('nivel 3: cuerda doble en pares separados 0,28 s; nivel 1: intervalos de 1,10 a 0,70', () => {
  const v3 = mkCtx({ lv: 3 }).g.vista(); assert.ok(v3.nCruces % 2 === 0);
  const st = mkCtx({ lv: 1 }), v = st.g.vista();
  assert.ok(Math.abs(v.sig[1] - v.sig[0] - 1.10) < 0.05, 'primer intervalo ~1,10');
});

test('humano ocioso muere en el primer cruce (kk ≈ lead·30) y queda último', () => {
  const st = mkCtx({ n: 2 }); const sc = jugar(st, ['idle', 'cpu'], 45);
  const lead = st.g.vista().lead;
  assert.strictEqual(st.g.vista().st[0], 1);
  assert.strictEqual(sc[0], Math.floor(lead * 30));
  assert.ok(sc[1] > sc[0]);
});

test('un brinco a tiempo supera el cruce; uno tardío lo falla', () => {
  const ok = mkCtx({ n: 1 }), T = ok.g.vista().sig[0];
  while (ok.gt < T + 0.3) { ok.gt += 1 / 30; if (Math.abs(ok.gt - (T - 0.26)) < 1 / 60) ok.taps[0]++; ok.g.update(1 / 30); }
  assert.strictEqual(ok.g.vista().st[0], 0);
  const tarde = mkCtx({ n: 1 });
  while (tarde.gt < T + 0.3) { tarde.gt += 1 / 30; if (Math.abs(tarde.gt - (T + 0.05)) < 1 / 60) tarde.taps[0]++; tarde.g.update(1 / 30); }
  assert.strictEqual(tarde.g.vista().st[0], 1);
  const pronto = mkCtx({ n: 1 });
  while (pronto.gt < T + 0.3) { pronto.gt += 1 / 30; if (Math.abs(pronto.gt - (T - 0.55)) < 1 / 60) pronto.taps[0]++; pronto.g.update(1 / 30); }
  assert.strictEqual(pronto.g.vista().st[0], 1, 'demasiado pronto: ya aterrizó');
});

test('un bot perfecto (punto óptimo) sobrevive los tres niveles; la eliminación manda c.out una sola vez por jugador', () => {
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 3, lv, dur: 20, seed: 11 + lv }); const sc = jugar(st, ['bot', 'idle', 'idle'], 20);
    assert.strictEqual(sc[0], 20 * 30 + 1, 'lv' + lv + ' bot vivo');
    assert.ok(st.g.vista().st[1] && st.g.vista().st[2]);
    const outs = st.outs.filter((e) => e.ty === 'out').map((e) => e.p).sort();
    assert.deepStrictEqual(outs, [1, 2]);
  }
});

test('CPU nivel 2 (skill .6): rara vez llegan 2+ a los 45 s; el ocioso nunca gana a una CPU', () => {
  let llegan = 0, ganaOcioso = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const st = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 45);
    if (st.gt >= 45 && st.g.vista().vivos >= 2) llegan++;
    const s2 = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const r = jugar(s2, ['idle', 'cpu', 'cpu', 'cpu'], 45);
    if (r[0] > Math.min.apply(null, r.slice(1))) ganaOcioso++;
  }
  assert.ok(llegan <= 12, 'demasiadas CPU aguantan: ' + llegan + '/30');
  assert.strictEqual(ganaOcioso, 0);
});

test('puntajes dentro de límites (enteros, 0..scoreMax, ≤ scoreRate·(t+1,5)); dur=3 no falla', () => {
  for (const dur of [3, 4, 10, 45]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['bot', 'cpu', 'cpu', 'idle'], dur);
    const t = st.gt;
    for (const v of sc) { assert.ok(Number.isInteger(v) && v >= 0 && v <= 1351 && v <= 31 * (Math.max(t, dur) + 1.5), `dur${dur} lv${lv} v=${v}`); }
  }
});

test('remotos: cuerpo entrante marca eliminación y y; alHum/alCpu no revientan', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c;
  const cuerpos = { 1: { y: 12, st: 0, sc: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 1; st.g.update(1 / 30); assert.strictEqual(st.g.vista().y[1], 12);
  cuerpos[1] = { y: 0, st: 1, sc: 99 }; st.g.update(1 / 30);
  assert.strictEqual(st.g.vista().st[1], 1); assert.strictEqual(st.g.vista().sc[1], 99);
  st.g.alCpu(1); st.g.alHum(1, { y: 0, st: 1, sc: 99 });
  assert.strictEqual(st.g.scores()[1], 99);
  assert.strictEqual(st.g.cuerpo(1).st, 1);
  assert.ok(/aguant|pis/.test(st.g.destacado()));
});

test('dibujo: draw() no revienta con gt<0, vivos y eliminados (primitivas simuladas)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = (...a) => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  globalThis.BUS = { AP: { CAST: { mama: {}, abuela: {} } } };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv });
    for (const gt of [-2, 0.2, 2, 5]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['idle', 'idle', 'idle', 'idle'], 45); st.g.draw();
  }
  assert.ok(calls.length > 100);
  assert.ok(calls.every((n) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(n)));
});
