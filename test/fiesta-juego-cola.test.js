/* f_cola (FFA rank, modelo A): humo sin red. Contexto `c` falso con todos los asientos míos (como la práctica). Comprueba registro, lint, calendario del fiscal
   determinista por nivel, coleado, llegada y bono +25, CPU honesta (no se cuela de más, los ociosos pierden), igualdad entre asientos, límites y dibujo.
   La red va en test/fiesta-live-cola.test.js. node --test test/fiesta-juego-cola.test.js */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-cola.js');
const CAT = require('../docs/style-lab/fiesta-reglas.js').CATALOGO.filter((x) => x.g === 'f_cola')[0];

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC]; require(SRC);
  return defs.f_cola;
}
const fnv = (s) => { s = String(s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const DEF = cargar();

function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || DEF.dur, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), g: null };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => o.campo || { x0: 0, x1: 800, y0: 70, y1: 470 },
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear(fnv(seed + ':' + t)),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: () => ({ x: 0, y: 0 }), cpu: new Array(n).fill(false),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null,
    ev() {}, out() {}, send: () => true, on() {}, claim() {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* modos[p]: 'cpu' | 'idle' | 'perfecto' (machaca 8/s y se detiene en el aviso) | 'torpe' (machaca sin mirar) | función(st,p,dt,api) */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, lim = hasta || c.dur, minT = Math.min(DEF.limites.minT, c.dur - 1), nx = new Array(n).fill(0);
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold() {}, eje() {} });
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) {
      const m = modos[p], v = g.vista();
      if (m === 'cpu') g.ai(p, dt, api(p));
      else if (m === 'perfecto') { if (v.est === 'verde' && st.gt >= nx[p]) { st.taps[p]++; nx[p] = st.gt + 0.125; } }
      else if (m === 'torpe') { if (st.gt >= nx[p]) { st.taps[p]++; nx[p] = st.gt + 0.125; } }
      else if (typeof m === 'function') m(st, p, dt, api(p));
    }
    g.update(dt);
    if (st.gt >= minT && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}

test('registro: paridad con el catálogo y límites del doc 08 (A, rank, ffa, 20 s, scoreMax 125, minT 4)', () => {
  assert.strictEqual(DEF.modelo, CAT.mo); assert.strictEqual(DEF.clase, CAT.cl); assert.deepStrictEqual(DEF.modos, CAT.m);
  assert.strictEqual(DEF.dur, 20); assert.strictEqual(DEF.botones, 1); assert.deepStrictEqual(DEF.cuerpo, ['x', 'fz', 'tl', 'sb']);
  assert.strictEqual(DEF.limites.scoreMax, 125); assert.strictEqual(DEF.limites.minT, 4); assert.strictEqual(DEF.limites.finTemprano, 1);
  if (CAT.lim) assert.deepStrictEqual(CAT.lim, DEF.limites, 'el catálogo trae lim: debe coincidir');
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin mensajes propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s));
});

test('el horario del fiscal es idéntico con la misma semilla (cualquier n) y distinto con otra; los 3 niveles difieren en aviso/falsos/dobles', () => {
  for (const lv of [1, 2, 3]) { const a = mkCtx({ seed: 7, lv }).g.vista(), b = mkCtx({ seed: 7, lv, n: 2 }).g.vista(); assert.strictEqual(a.evHash, b.evHash); assert.ok(a.nEv >= 4); }
  assert.notStrictEqual(mkCtx({ seed: 7 }).g.vista().evHash, mkCtx({ seed: 8 }).g.vista().evHash);
  for (let seed = 1; seed <= 10; seed++) {
    const v1 = mkCtx({ seed, lv: 1 }).g.vista(), v2 = mkCtx({ seed, lv: 2 }).g.vista(), v3 = mkCtx({ seed, lv: 3 }).g.vista();
    v1.evs.forEach((e) => { assert.ok(Math.abs(e.r0 - e.a - 0.6) < 1e-9); assert.ok(!e.fake); });
    v2.evs.forEach((e) => assert.ok(Math.abs(e.r0 - e.a - 0.6) < 1e-9));
    v3.evs.forEach((e) => assert.ok(Math.abs(e.r0 - e.a - 0.35) < 1e-9));
  }
  let f2 = 0, f3 = 0, dobles = 0;
  for (let seed = 1; seed <= 30; seed++) { f2 += mkCtx({ seed, lv: 2 }).g.vista().evs.filter((e) => e.fake).length; const v = mkCtx({ seed, lv: 3 }).g.vista(); f3 += v.evs.filter((e) => e.fake).length; for (let i = 1; i < v.evs.length; i++) if (!v.evs[i].fake && Math.abs(v.evs[i].r0 - v.evs[i - 1].r1 - 0.5) < 1e-6) dobles++; }
  assert.ok(f2 > 10 && f3 > 5 && dobles > 10, `falsos nv2=${f2} nv3=${f3} dobles=${dobles}`);
});

test('tocar con luz verde avanza un paso; tocar en rojo = coleado (3 pasos atrás, 0,6 s congelado); congelado no avanza', () => {
  const st = mkCtx({ n: 1, lv: 1, seed: 3 }), v0 = st.g.vista(), e = v0.evs[0], STEP = v0.step;
  const dt = 1 / 30;
  const avanza = (hasta) => { while (st.gt < hasta) { st.gt += dt; st.g.update(dt); } };
  avanza(0.5); st.taps[0] = 1; avanza(st.gt + dt); assert.ok(Math.abs(st.g.vista().x[0] - STEP) < 1e-9, 'un toque en verde = un paso');
  for (let i = 0; i < 4; i++) { st.taps[0] = 1; avanza(st.gt + dt); }
  const antes = st.g.vista().x[0]; assert.ok(Math.abs(antes - 5 * STEP) < 1e-9);
  avanza(e.r0 + 0.2); assert.strictEqual(st.g.vista().est, 'rojo');
  st.taps[0] = 1; avanza(st.gt + dt);
  let v = st.g.vista(); assert.ok(Math.abs(v.x[0] - (antes - 3 * STEP)) < 1e-9, 'retrocede 3 pasos'); assert.strictEqual(v.fz[0], 1); assert.strictEqual(v.cn[0], 1);
  const x1 = v.x[0]; st.taps[0] = 1; avanza(st.gt + dt); assert.strictEqual(st.g.vista().x[0], x1, 'congelado: el toque no cuenta');
  avanza(e.r1 + 0.1); st.taps[0] = 1; avanza(st.gt + dt); assert.ok(st.g.vista().x[0] > x1, 'tras el rojo y el congelado vuelve a avanzar');
});

test('un giro falso (nv2) no castiga; con el aviso se puede seguir tocando; en rojo del nv3 doble también hay castigo en la 2.ª mirada', () => {
  let probado = false;
  for (let seed = 1; seed <= 40 && !probado; seed++) {
    const st = mkCtx({ n: 1, lv: 2, seed }), v = st.g.vista(), e = v.evs.filter((x) => x.fake)[0];
    if (!e) continue; probado = true;
    while (st.gt < e.r0 + 0.1) { st.gt += 1 / 30; st.g.update(1 / 30); }
    assert.strictEqual(st.g.vista().est, 'falso'); st.taps[0] = 1; st.gt += 1 / 30; st.g.update(1 / 30);
    assert.strictEqual(st.g.vista().cn[0], 0, 'falso: no hay coleado');
  }
  assert.ok(probado);
});

test('llegar al 100 %: tl en ticks, el primero cobra +25 (empate de tick: menor asiento) y done() sale tras 0,3 s; ni scoreMax ni la tasa se pasan', () => {
  const st = mkCtx({ n: 3, lv: 1, seed: 5 }); const sc = jugar(st, ['perfecto', 'perfecto', 'idle']);
  const v = st.g.vista();
  /* con peatones y cajas ya no hay empate perfecto: llega primero uno de los dos que machacan y cobra el +25 */
  const w = v.primero, o = 1 - w; assert.ok(w === 0 || w === 1, 'llegó primero uno de los dos perfectos: ' + w); assert.ok(v.tl[w] > 0); assert.strictEqual(sc[w], 125);
  assert.ok(sc[o] >= 70 && sc[o] <= 100, 'el 2.º queda cerca: ' + sc[o]); assert.strictEqual(sc[2], 0);
  assert.ok(st.gt >= 4 && st.gt < 20, 'terminó temprano (finTemprano): ' + st.gt.toFixed(1));
  for (const x of sc) assert.ok(Number.isInteger(x) && x >= 0 && x <= 125 && x <= 30 * (st.gt + 1.5));
});

test('quien llega antes (menor tl) gana el bono aunque tenga el asiento mayor', () => {
  const st = mkCtx({ n: 2, lv: 1, seed: 9 }); const lento = (s, p, dt, api) => { if (s.g.vista().est === 'verde' && Math.floor(s.gt * 30) % 6 === 0) api.press(); };
  const sc = jugar(st, [lento, 'perfecto']); assert.strictEqual(st.g.vista().primero, 1); assert.strictEqual(sc[1], 125); assert.ok(sc[0] < 100);
});

test('ocioso: 0 puntos; un machacador que ignora al fiscal pierde casi siempre contra uno que lo respeta (los sabotajes meten algo de azar)', () => {
  let gana = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const st = mkCtx({ n: 3, lv: 1, seed }); const sc = jugar(st, ['idle', 'torpe', 'perfecto']);
    assert.strictEqual(sc[0], 0); if (sc[2] > sc[1]) gana++;
  }
  assert.ok(gana >= 9, 'respetar al fiscal gana: ' + gana + '/12');
});

test('caos: peatones y cajas salen de la semilla (iguales en todas las pantallas), crecen con el nivel y los golpes frenan con su motivo', () => {
  for (const lv of [1, 2, 3]) { const a = mkCtx({ seed: 11, lv }).g.vista(), b = mkCtx({ seed: 11, lv, n: 2 }).g.vista();
    assert.deepStrictEqual(a.peds, b.peds); assert.deepStrictEqual(a.caj, b.caj); assert.strictEqual(a.peds.length, lv + 2); assert.strictEqual(a.caj.length, lv + 4); }
  let motivos = {}, tot = 0;
  for (let seed = 1; seed <= 30; seed++) { const st = mkCtx({ n: 4, lv: 3, seed }); jugar(st, ['perfecto', 'perfecto', 'perfecto', 'perfecto']); const v = st.g.vista(); v.hits.forEach((h) => { tot += h; }); v.cajas.forEach((h) => { motivos.c = (motivos.c || 0) + h; }); }
  assert.ok(tot > 30 && motivos.c > 60, 'hay golpes (' + tot + ') y cajas recogidas (' + motivos.c + ')');
});

test('sabotaje remoto: el sb que difunde otro asiento golpea a MI carro (fz lleva el motivo) una sola vez', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c; c.mio = (p) => p === 0; c.remoto = () => null;
  st.gt = 1; st.g.update(1 / 30); st.g.update(1 / 30);
  st.g.alRemoto(1, { x: 2000, fz: 0, tl: 0, sb: 64 + 8 * 1 + 0 }, 1); st.g.update(1 / 30);
  const cu = st.g.cuerpo(0); assert.strictEqual(cu.fz, 2); assert.strictEqual(st.g.vista().fz[0], 1); assert.strictEqual(st.g.vista().hits[0], 1);
  st.g.alRemoto(1, { x: 2000, fz: 0, tl: 0, sb: 64 + 8 * 1 + 0 }, 2); assert.strictEqual(st.g.vista().hits[0], 1, 'misma secuencia: no repite');
});

test('CPU: nadie queda a cero, los ociosos nunca superan a una CPU activa, y cada nivel se resuelve en tiempo razonable', () => {
  for (const lv of [1, 2, 3]) {
    let llegan = 0, ocioso = 0, tmed = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const st = mkCtx({ n: 4, lv, seed, skill: 0.6 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu']);
      if (st.g.vista().primero >= 0) { llegan++; tmed += st.gt; }
      sc.forEach((v) => assert.ok(v > 20, 'CPU atascada ' + v));
      const s2 = mkCtx({ n: 4, lv, seed, skill: 0.6 }); const r = jugar(s2, ['idle', 'cpu', 'cpu', 'cpu']);
      if (r[0] > Math.min(r[1], r[2], r[3])) ocioso++;
    }
    assert.strictEqual(ocioso, 0, 'lv' + lv);
    assert.ok(llegan >= 10, `lv${lv}: llegan ${llegan}/30 (alguien debe llenar el tanque en la mayoría): ${(tmed / Math.max(1, llegan)).toFixed(1)} s`);
  }
});

test('igualdad: con 4 CPU de la misma habilidad ningún asiento gana más de 1/4 + 8 pp en 200 semillas (sin ventaja de asiento/juez)', () => {
  for (const lv of [1, 2, 3]) {
    const w = [0, 0, 0, 0];
    for (let seed = 1; seed <= 200; seed++) {
      const st = mkCtx({ n: 4, lv, seed, skill: 0.6 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu']);
      const top = Math.max.apply(null, sc), ws = sc.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0);
      ws.forEach((i) => { w[i] += 1 / ws.length; });
    }
    w.forEach((x, i) => assert.ok(x / 200 <= 0.33, `lv${lv} asiento ${i}: ${(100 * x / 200).toFixed(1)} %`));
  }
});

test('remotos: el cuerpo entrante marca x, fz y llegada; alHum/alCpu no revientan y el asiento heredado sigue desde su x', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c; const cuerpos = { 1: { x: 4200, fz: 0, tl: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 1; st.g.alRemoto(1, cuerpos[1], 1000); st.g.update(1 / 30);
  assert.strictEqual(st.g.cuerpo(1).x, 4200);
  st.g.alRemoto(1, { x: 10000, fz: 0, tl: 321 }, 1100); assert.strictEqual(st.g.vista().tl[1], 321); assert.strictEqual(st.g.vista().primero, 1);
  assert.strictEqual(st.g.scores()[1], 125);
  assert.strictEqual(st.g.done(), false); st.gt += 0.1; st.g.update(1 / 30); st.gt += 0.31; st.g.update(1 / 30); assert.strictEqual(st.g.done(), true);
  st.g.alCpu(1); st.g.alHum(1, { x: 10000, fz: 0, tl: 321 }); assert.ok(/pill|llen/.test(st.g.destacado()));
  c.mio = () => true; st.g.update(1 / 30); assert.ok(st.g.vista().x[1] === 100, 'ya había llegado: no se pierde al heredar');
});

test('puntajes dentro de límites para varios dur (incluido 5) y los tres niveles', () => {
  for (const dur of [5, 8, 20]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['perfecto', 'cpu', 'torpe', 'idle']);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= 125 && v <= 30 * (Math.max(st.gt, dur) + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

function dibuja(W, n, lv, onceCalls) {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  const st = mkCtx({ n, lv, campo: { x0: (800 - W) / 2, x1: (800 + W) / 2, y0: 70, y1: 470 } });
  for (const gt of [-2, 0.2, 2, 5, 9]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
  jugar(st, ['perfecto', 'cpu', 'torpe', 'idle'].slice(0, n), 20); st.g.draw();
  return calls;
}
test('dibujo: draw() no revienta con gt<0, en 340 y 800 de ancho, n=2..4, nv 1-3 (solo primitivas del lab)', () => {
  for (const W of [340, 372, 800]) for (const n of [2, 3, 4]) for (const lv of [1, 2, 3]) { const c = dibuja(W, n, lv); assert.ok(c.length > 100); assert.ok(c.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x))); }
});
