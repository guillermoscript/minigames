/* f_chancla (FFA survival, modelo B): humo sin red. Contexto `c` falso con todos los asientos míos (eco local de ev). Comprueba registro, lint, calendario determinista,
   golpe/vidas/inmunidad/mesa, CPU, tías chismosas (shot), teledirigida (tele), límites del catálogo y dibujo. La red va en test/fiesta-live-chancla.test.js. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-chancla.js');
const CAT = require('../docs/style-lab/fiesta-reglas.js').CATALOGO.filter((x) => x.g === 'f_chancla')[0];

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC]; require(SRC);
  return defs.f_chancla;
}
const DEF = cargar();
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 45, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false), skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p, at: st.gt }); if (st.g && st.g.onEv) st.g.onEv(ty, p === undefined ? c.yo : p, d, st.gt); },
    out: (p, kk) => c.ev('out', { kk: kk === undefined ? Math.floor(st.gt * 30) : kk }, p),
    send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, lim = hasta || c.dur;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    if (st.gt >= Math.min(3, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}

test('registro: paridad con el catálogo (B, survival, ffa, lim)', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'survival'); assert.deepStrictEqual(DEF.modos, ['ffa']);
  assert.strictEqual(DEF.dur, CAT.dur); assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.live, 1); assert.strictEqual(CAT.mo, 'B');
  assert.deepStrictEqual(DEF.cuerpo, ['x', 'y', 'vd', 'mesa', 'st', 'sc']);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin tipos x* propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s), 'usa solo ev fiable (hit/shot/tele/out)');
});

test('el calendario de chanclas es idéntico con la misma semilla (cualquier n) y distinto con otra; ritmo por nivel', () => {
  for (const lv of [1, 2, 3]) { const a = mkCtx({ seed: 7, lv }).g.vista(), b = mkCtx({ seed: 7, lv, n: 2 }).g.vista(); assert.strictEqual(a.hash, b.hash); assert.ok(a.nLanz > 20); }
  assert.notStrictEqual(mkCtx({ seed: 7 }).g.vista().hash, mkCtx({ seed: 8 }).g.vista().hash);
  const dens = (lv) => mkCtx({ seed: 3, lv }).g.vista().nLanz;
  assert.ok(dens(1) < dens(2) && dens(2) < dens(3), 'más chanclas por nivel: ' + [dens(1), dens(2), dens(3)]);
});

test('un jugador quieto en la sombra pierde 1 vida por golpe (inmune 0,9 s) y con 2 golpes queda fuera en el tick T de la chancla', () => {
  const st = mkCtx({ n: 2, seed: 4, lv: 1 });
  const L = st.g.vista().lanz;
  // ponemos al jugador 0 exactamente donde cae la primera chancla
  const stay = (s, p, dt, api) => { const v = s.g.vista(); const [T, x, y] = L[0]; if (s.gt < T - 0.5) { const dx = x - v.x[0], dy = y - v.y[0]; api.eje(Math.abs(dx) > 6 ? Math.sign(dx) : 0, Math.abs(dy) > 6 ? Math.sign(dy) : 0); } else api.eje(0, 0); };
  jugar(st, [stay, 'idle'], 6);
  const v = st.g.vista();
  assert.ok(v.vd[0] <= 1, 'perdió al menos 1 vida: ' + v.vd[0]);
  assert.ok(st.evs.filter((e) => e.ty === 'hit' && e.p === 0).length >= 1);
  const outs = st.evs.filter((e) => e.ty === 'out');
  if (outs.length) assert.strictEqual(outs[0].d.kk, Math.floor(L.filter((a) => a[0] <= st.gt).map((a) => a[0]).pop() * 30), 'kk = tick de la chancla que lo sacó');
});

test('la mesa (A) salva el golpe si cubre el instante T; enfriamiento de 2 s', () => {
  const st = mkCtx({ n: 1, seed: 4, lv: 1 }); const L = st.g.vista().lanz;
  const [T, x, y] = L[0];
  let pressed = false;
  const bot = (s, p, dt, api) => { const v = s.g.vista(); if (s.gt < T - 0.9) { const dx = x - v.x[0], dy = y - v.y[0]; api.eje(Math.abs(dx) > 5 ? Math.sign(dx) : 0, Math.abs(dy) > 5 ? Math.sign(dy) : 0); } else api.eje(0, 0); if (!pressed && s.gt >= T - 0.3) { pressed = true; api.press('a'); } };
  jugar(st, [bot], T + 0.05);
  assert.strictEqual(st.g.vista().vd[0], 2, 'a salvo bajo la mesa');
  assert.ok(st.g.vista().tm[0] > 0);
});

test('CPU nivel 2: sobreviven varias en nivel 1 y no todas en nivel 3; un ocioso nunca gana (a 3 CPU)', () => {
  const surv = { 1: 0, 3: 0 };
  for (const lv of [1, 3]) for (let seed = 1; seed <= 20; seed++) { const st = mkCtx({ n: 4, lv, seed, skill: 0.6 }); jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 45); surv[lv] += st.g.vista().vivos; }
  console.log('  CPU .6 vivos medios al cierre: lv1=' + (surv[1] / 20).toFixed(2) + ' lv3=' + (surv[3] / 20).toFixed(2));
  assert.ok(surv[1] / 20 >= 1 && surv[3] / 20 <= 3.2);
  let gano = 0;
  for (let seed = 1; seed <= 40; seed++) { const st = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 45); if (sc[0] > Math.max.apply(null, sc.slice(1))) gano++; }
  assert.strictEqual(gano, 0, 'un ocioso nunca gana (supera a la mejor CPU)');
});

test('tías chismosas (Nv2+): un eliminado lanza una chancla con aviso de 1 s que los demás ven y que golpea', () => {
  const st = mkCtx({ n: 2, seed: 9, lv: 2 }); const g = st.g;
  st.gt = 4; g.update(1 / 30);
  st.c.ev('out', { kk: 100 }, 1); assert.strictEqual(g.vista().st[1], 1);
  const v0 = g.vista(); st.axes[1] = { x: 0, y: 0 };
  // llevar la mira de la tía sobre el jugador 0 y lanzar
  for (let i = 0; i < 400 && st.evs.filter((e) => e.ty === 'shot').length === 0; i++) {
    st.gt += 1 / 30; const v = g.vista(); const dx = v.x[0] - v.x[1], dy = v.y[0] - v.y[1];
    st.axes[1] = { x: Math.abs(dx) > 4 ? Math.sign(dx) : 0, y: Math.abs(dy) > 4 ? Math.sign(dy) : 0 };
    if (Math.abs(dx) <= 6 && Math.abs(dy) <= 6) st.taps[1]++;
    g.update(1 / 30);
  }
  const shot = st.evs.filter((e) => e.ty === 'shot')[0]; assert.ok(shot, 'se lanzó');
  assert.ok(Math.abs(shot.d.tl / 1000 - (shot.at + 1.0)) < 0.05, 'cae 1 s después'); assert.strictEqual(g.vista().extras, 1);
  st.axes[0] = { x: 0, y: 0 };
  while (st.gt < shot.d.tl / 1000 + 0.2) { st.gt += 1 / 30; g.update(1 / 30); }
  assert.ok(g.vista().vd[0] <= 1 || st.evs.some((e) => e.ty === 'hit' && e.p === 0), 'la víctima (quieta) lo juzgó');
});

test('Nv3: el juez dispara «tele» sobre un vivo y solo el dueño del blanco la juzga (cae a los 3 s)', () => {
  const st = mkCtx({ n: 3, seed: 5, lv: 3, dur: 20, skill: 0.9 }); const g = st.g;
  jugar(st, ['cpu', 'cpu', 'cpu'], 12);
  const t = st.evs.filter((e) => e.ty === 'tele'); assert.ok(t.length >= 1, 'se emitió tele');
  assert.ok(t[0].d.to >= 0 && t[0].d.to < 3); assert.ok(Math.abs(t[0].d.tl / 1000 - t[0].at) < 0.2); assert.ok(g.vista().tele >= 1);
  const dup = st.evs.filter((e) => e.ty === 'tele' && e.d.i === t[0].d.i).length; assert.strictEqual(dup, 1, 'cada tele se emite una sola vez');
});

test('puntajes enteros dentro de los límites del catálogo; dur=3,8,45 no revienta', () => {
  for (const dur of [3, 8, 45]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['cpu', 'cpu', 'idle', 'idle'], dur); const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('remotos: cuerpo entrante actualiza posición/vidas/mesa y marca eliminación; alHum/alCpu no revientan', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c; const cuerpos = { 1: { x: 300, y: 120, vd: 1, mesa: 1, st: 0, sc: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 1; st.g.update(1 / 30); assert.strictEqual(st.g.vista().x[1], 300); assert.strictEqual(st.g.vista().vd[1], 1);
  cuerpos[1] = { x: 300, y: 120, vd: 0, mesa: 0, st: 1, sc: 99 }; st.g.update(1 / 30); assert.strictEqual(st.g.vista().st[1], 1); assert.strictEqual(st.g.scores()[1], 99);
  st.g.alCpu(1); st.g.alHum(1, cuerpos[1]); assert.strictEqual(st.g.cuerpo(1).st, 1); assert.ok(/aguant|chancletazo/.test(st.g.destacado()));
});

test('dibujo: draw() no revienta (gt<0, sombras, tele, tías) en los 3 niveles con solo primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, seed: 3 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['cpu', 'idle', 'idle', 'cpu'], 45); st.g.draw();
  }
  assert.ok(calls.length > 300); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});
