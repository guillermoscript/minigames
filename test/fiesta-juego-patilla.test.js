/* f_patilla (1v3, modelo B): humo sin red. Contexto `c` falso con todos los asientos míos; ev se devuelve por eco local y c.send('xtiro') se entrega a c.on.
   Comprueba registro, lint, determinismo del tiro, reglas (golpe/esquiva/charco), CPU, balance del solo (38-52 % en 200 semillas por nivel) y límites. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-patilla.js');
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const CAT = REGLAS.CATALOGO.filter((x) => x.g === 'f_patilla')[0];
/* el ganador sale SOLO de compara() (M3 DM3-4): nunca de un hook del juego */
const ganaSolo = (st) => REGLAS.compara('1v3', st.c.equipos, st.g.scores()).puestos[st.c.solo] === 1;

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, reglas: REGLAS, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC];
  require(SRC);
  return defs.f_patilla;
}
const DEF = cargar();

function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 35, lv = o.lv || 1, solo = o.solo === undefined ? 0 : o.solo;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, handlers: {}, sent: [], evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 1 : o.yo, modo: '1v3', solo, equipos: Array.from({ length: n }, (_, i) => (i === solo ? 0 : 1)), lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i === solo ? 0 : 1 })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false), skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); },
    out: () => {}, send: (t, d) => { st.sent.push({ t, d }); return true; }, on: (t, fn) => { st.handlers[t] = fn; }, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* corre; modos[p] = 'cpu' | 'idle' | función(st, p, dt, api) */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  const lim = hasta || c.dur;
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    if (st.gt >= Math.min(6, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}
const TODOS_CPU = ['cpu', 'cpu', 'cpu', 'cpu'];

test('registro: paridad con el catálogo y parámetros de la ficha', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'binary'); assert.deepStrictEqual(DEF.modos, ['1v3']);
  assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.dur, CAT.dur);
  assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.live, 1);
  assert.strictEqual(CAT.mo, DEF.modelo); assert.strictEqual(CAT.cl, DEF.clase);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, solo tipos x* propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/]) assert.ok(!re.test(s), String(re));
  const tipos = (s.match(/c\.(send|on)\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1'));
  assert.ok(tipos.length > 0 && tipos.every((t) => /^x[a-z0-9]{1,11}$/.test(t)), tipos.join());
});

test('el tiro es determinista: misma (x,a,tl) => misma trayectoria en cualquier pantalla; el mensaje cabe en x* (≤200 B)', () => {
  for (const lv of [1, 2, 3]) {
    const A = mkCtx({ lv, seed: 5 }), B = mkCtx({ lv, seed: 5, n: 3, solo: 2 });
    A.gt = 3; A.g.update(1 / 30);
    A.axes[0] = { x: 0, y: 0.3 }; A.taps[0]++; A.g.update(1 / 30);
    assert.strictEqual(A.sent.length, 1, 'lv' + lv); assert.strictEqual(A.sent[0].t, 'xtiro');
    assert.ok(JSON.stringify({ q: 0, d: A.sent[0].d }).length <= 200);
    B.handlers.xtiro(A.sent[0].d, 2); B.handlers.xtiro(A.sent[0].d, 2);   // duplicado ignorado
    assert.strictEqual(B.g.vista().tiros.length, 1);
    const tl = A.sent[0].d.tl / 1000;
    for (const dt of [0.1, 0.9, 1.5, 2.3]) { A.gt = tl + dt; B.gt = tl + dt; assert.strictEqual(A.g.vista().activos, B.g.vista().activos); }
  }
});

test('el solo tiene nShots bombas con enfriamiento CD; un toque de más no suelta nada', () => {
  const st = mkCtx({ lv: 1, n: 4 });
  jugar(st, [(s, p, dt, api) => { api.eje(-1, 0); if (s.gt > 2.4) api.press('a'); }, 'idle', 'idle', 'idle'], 35);
  const v = st.g.vista(), t = v.tiros; assert.ok(v.nShots >= 6, 'nShots ' + v.nShots); assert.strictEqual(t.length, v.nShots);
  for (let i = 1; i < t.length; i++) assert.ok(t[i][3] - t[i - 1][3] >= v.cd + 0.29, 'enfriamiento ' + i);
});

test('ráfaga: el nivel 1 suelta 1 bomba por tiro, el 2 dos y el 3 tres', () => {
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ lv, n: 4 }); st.gt = 3; st.g.update(1 / 30); st.taps[0]++; st.g.update(1 / 30);
    assert.strictEqual(st.g.vista().gotas.length, lv, 'lv' + lv);
  }
});

/* el solo lleva la mira sobre el miembro 1 del trío y suelta una sola vez */
const apunta = (s, p, dt, api) => { const v = s.g.vista(), dx = v.x[1] - v.x[0], dy = v.y[1] - v.y[0]; api.eje(Math.abs(dx) > 6 ? Math.sign(dx) : 0, Math.abs(dy) > 6 ? Math.sign(dy) : 0); if (Math.abs(dx) <= 6 && Math.abs(dy) <= 6 && v.tiros.length === 0 && s.gt > 2.5) api.press('a'); };

test('golpe: un trío ocioso bajo la bomba se moja (una vez); esquivar a tiempo lo evita', () => {
  const quieto = mkCtx({ lv: 1, n: 2, solo: 0, yo: 1 });
  jugar(quieto, [apunta, 'idle'], 12);
  assert.strictEqual(quieto.g.vista().hits, 1, 'ocioso: 1 golpe');
  assert.deepStrictEqual(quieto.g.scores(), [10, 25]);
  const esq = mkCtx({ lv: 1, n: 2, solo: 0, yo: 1 });
  const huye = (s, p, dt, api) => { const v = s.g.vista(); if (!v.gotas.length) return; api.eje(1, 0); if (s.gt > v.gotas[0][4] - 0.35) api.press('a'); };
  jugar(esq, [apunta, huye], 12);
  assert.strictEqual(esq.g.vista().hits, 0, 'esquivó a tiempo');
});

test('charco: tras caer la bomba el piso resbala (en el charco no se puede dar la vuelta; en seco sí)', () => {
  const giro = (conCharco) => {
    const st = mkCtx({ lv: 1, n: 2, solo: 0, yo: 1 });
    let x0 = null, x1 = null;
    const t0 = 2.6 + 0.3 + 0.85 + 1.2;                                        // ~cuando ya cayó la bomba y pasó el aturdimiento
    const pisa = (s, p, dt, api) => {
      if (s.gt < t0) { api.eje(0, 0); return; }
      if (s.gt < t0 + 0.3) { api.eje(1, 0); return; }                        // arranca a la derecha
      if (x0 === null) x0 = s.g.vista().x[1];
      if (s.gt < t0 + 0.55) { api.eje(-1, 0); return; }                      // y quiere volver
      if (x1 === null) x1 = s.g.vista().x[1]; api.eje(0, 0);
    };
    jugar(st, [conCharco ? apunta : 'idle', pisa], t0 + 1);
    return x1 - x0;
  };
  const moja = giro(true), seco = giro(false);
  assert.ok(moja > -8, 'en el charco sigue patinando: ' + moja.toFixed(1));
  assert.ok(seco < -25, 'en seco se da la vuelta: ' + seco.toFixed(1));
});

test('puntaje aditivo: solo 10/golpe, trío 25 fijo; el solo gana con >=3 golpes (comparación 1v3 del reductor)', () => {
  const R = require('../docs/style-lab/fiesta-reglas.js');
  const eq = [0, 1, 1, 1];
  for (let hits = 0; hits <= 9; hits++) {
    const sc = [hits * 10, 25, 25, 25], pu = R.compara('1v3', eq, sc).puestos;
    assert.strictEqual(pu[0] === 1 && pu[1] === 2, hits >= 3, 'hits=' + hits);
  }
});

test('CPU: el solo CPU acierta a veces y el trío ocioso pierde casi siempre (lv1-2)', () => {
  for (const lv of [1, 2]) {
    let ganaSolo_ = 0;
    for (let seed = 1; seed <= 40; seed++) { const st = mkCtx({ lv, seed, skill: 0.6 }); const sc = jugar(st, ['cpu', 'idle', 'idle', 'idle'], 35); if (ganaSolo(st)) ganaSolo_++; assert.ok(sc[0] % 10 === 0); }
    assert.ok(ganaSolo_ >= 22, 'lv' + lv + ' trío ocioso pierde menos de lo esperado: ' + ganaSolo_ + '/40');
  }
});

test('BALANCE: con CPU de igual habilidad el solo gana 38-52 % (200 semillas por nivel)', () => {
  const res = {};
  for (const lv of [1, 2, 3]) {
    let w = 0; const N = 200;
    for (let seed = 1; seed <= N; seed++) { const st = mkCtx({ lv, seed, skill: 0.6 }); jugar(st, TODOS_CPU, 35); if (ganaSolo(st)) w++; }
    res[lv] = w / N;
  }
  console.log('  balance solo (skill .6):', JSON.stringify(res));
  for (const lv of [1, 2, 3]) assert.ok(res[lv] >= 0.38 && res[lv] <= 0.52, 'lv' + lv + ' solo gana ' + (res[lv] * 100).toFixed(0) + ' %');
});

test('puntajes dentro de límites del catálogo y enteros; dur=3,8,35 no revienta', () => {
  for (const dur of [3, 8, 35]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ lv, dur, seed: dur + lv }); const sc = jugar(st, TODOS_CPU, dur);
    const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('dibujo: draw() no revienta con gt<0, amago, patillas y los 3 niveles (solo primitivas del lab)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ lv, n: 4, seed: 3 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, TODOS_CPU, 35); st.g.draw();
    const st2 = mkCtx({ lv, n: 2 }); st2.gt = 5; st2.g.update(1 / 30); st2.g.draw();
  }
  assert.ok(calls.length > 200);
  assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});
