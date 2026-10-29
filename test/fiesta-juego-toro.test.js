/* f_toro (¡TOROS COLEADOS!, FFA/1v1 rank, modelo A): humo sin red con un contexto `c` falso (todos los asientos míos).
   Corral libre con un toro compartido: comprueba registro, lint, toro idéntico por semilla, las reglas (agarrar la cola, equilibrio, coleada,
   espuela y empujón, cornada, cola caliente, doble final), la CPU (más habilidad = más puntos; el ocioso no puntúa), límites del catálogo y el 2D. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-toro.js');
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const CAT = REGLAS.CATALOGO.filter((x) => x.g === 'f_toro')[0];

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, reglas: REGLAS, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC];
  require(SRC);
  return defs.f_toro;
}
const DEF = cargar();

function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 30, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: n === 2 ? '1v1' : 'ffa', lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff' })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }), ahora: () => st.gt, rng: rng.crear(seed),
    rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; }, eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]),
    skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: () => true, remoto: () => null, ev: () => {}, out: () => {}, send: () => true, on: () => {}, util: { pj: () => {} }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* modos[p] = 'cpu' | 'idle' | función(st, p, dt, api); cada cuadro comprueba los topes del servidor */
function jugar(st, modos, hasta, cada) {
  const g = st.g, c = st.c, dt = 1 / 30;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  while (st.gt < (hasta || c.dur)) {
    st.gt += dt;
    for (let p = 0; p < c.n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    if (cada) cada(st);
    if (st.gt > 0) g.scores().forEach((v) => assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (st.gt + 1.5), 'tope: ' + v + ' @' + st.gt.toFixed(2)));
  }
  return g.scores();
}
const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;

test('registro: paridad con el catálogo; capicúa queda registrado pero fuera de las rondas', () => {
  assert.ok(CAT && CAT.live === 1); assert.strictEqual(DEF.modelo, CAT.mo); assert.strictEqual(DEF.clase, CAT.cl); assert.deepStrictEqual(DEF.modos, CAT.m);
  assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(DEF.dur, CAT.dur); assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true);
  assert.strictEqual(REGLAS.CATALOGO.filter((x) => x.g === 'f_domino')[0].fuera, 1);
  const lim = require('../pocketbase/pb_hooks/party_mj.js').toString().match(/f_toro: \{[^}]+\}/);
  assert.ok(lim, 'party_mj LIM_DEFECTO trae f_toro');
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas ni sintaxis fuera de ES5', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /=>/, /\blet\b/, /\bconst\b/]) assert.ok(!re.test(s), String(re));
});

test('el toro es el mismo para todos: misma semilla => mismo hash (aunque cambie el número de jugadores); y su trayectoria se queda dentro de la cerca', () => {
  for (const lv of [1, 2, 3]) assert.strictEqual(mkCtx({ lv, seed: 9 }).g.vista().hash, mkCtx({ lv, seed: 9, n: 2 }).g.vista().hash);
  assert.notStrictEqual(mkCtx({ seed: 9 }).g.vista().hash, mkCtx({ seed: 10 }).g.vista().hash);
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ lv, seed: 5 }); const vistos = {};
    jugar(st, [], 30, (s) => { const B = s.g.vista().B; assert.ok(Math.abs(B.x) <= 20 && Math.abs(B.z) <= 11, 'el toro se sale'); vistos[B.s] = 1; });
    assert.ok(vistos[0] && vistos[1] && vistos[2], 'trota, escarba y embiste en lv' + lv);
  }
});

/* un jinete perfecto: se va a la cola, la agarra y contrarresta el tirón */
function contrarresta(v, p, g) { return Math.max(-1, Math.min(1, -(v.B.pull * v.gain) / 3.2 - v.q[p] * 2.2)); }
const perfecto = (st, p, dt, api) => {
  const v = st.g.vista(), B = v.B;
  if (v.st[p] === 1) { api.eje(contrarresta(v, p), 0); return; }
  if (v.st[p] === 2) { api.eje(0, 0); return; }
  const dx = B.tx - v.x[p], dz = B.tz - v.z[p], m = Math.hypot(dx, dz) || 1;
  api.eje(dx / m, dz / m);
  if (v.puede[p]) api.press('a');
};

test('agarrar la cola: A pegado a la cola cuelga; A lejos espolea (no agarra)', () => {
  const st = mkCtx({ n: 1, seed: 2 }); st.gt = 0.5; st.g.update(1 / 30);
  st.taps[0] = 1; st.gt += 1 / 30; st.g.update(1 / 30);
  assert.strictEqual(st.g.vista().st[0], 0); assert.strictEqual(st.g.vista().d[0], 1, 'espoleó');
  const s2 = mkCtx({ n: 1, seed: 2 }); jugar(s2, [perfecto], 12);
  assert.ok(s2.g.vista().nTum[0] >= 1 || s2.g.vista().st[0] === 1 || s2.g.vista().sc[0] > 0, 'el perfecto engancha y puntúa');
});

test('coleada: el perfecto cuelga, equilibra, llena la tumba y suma (la cola queda caliente); el que no equilibra se cae', () => {
  const st = mkCtx({ n: 2, seed: 6 });
  let caliente = false, colgado = 0;
  const idle = (s, p, dt, api) => { const v = s.g.vista(), B = v.B; if (v.st[p] === 1) { api.eje(0, 0); return; } const dx = B.tx - v.x[p], dz = B.tz - v.z[p], m = Math.hypot(dx, dz) || 1; api.eje(dx / m, dz / m); if (v.puede[p]) api.press('a'); };
  jugar(st, [perfecto, 'idle'], 30, (s) => { const v = s.g.vista(); if (v.st[0] === 1) colgado++; if (v.tailOff > s.gt) caliente = true; });
  const v = st.g.vista();
  assert.ok(v.nTum[0] >= 2, 'coleadas del perfecto: ' + v.nTum[0]); assert.ok(v.sc[0] >= 100, 'puntos: ' + v.sc[0]); assert.ok(caliente, 'la cola se calienta tras la coleada'); assert.ok(colgado > 30);
  assert.strictEqual(v.sc[1], 0, 'el ocioso no puntúa');
  const sinEq = mkCtx({ n: 1, seed: 6 }); let cayo = 0, ant = 0;
  jugar(sinEq, [(s, p, dt, api) => { const v2 = s.g.vista(); if (ant === 1 && v2.st[p] === 2) cayo++; ant = v2.st[p]; if (v2.st[p] === 1) { api.eje(0, 0); return; } perfecto(s, p, dt, api); }], 30);
  assert.ok(cayo >= 1, 'sin equilibrar te sueltas: ' + cayo);
});

test('espuela: empuja a otro jinete y le quita la cola al que la tenía', () => {
  let robos = 0, empujones = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const st = mkCtx({ n: 2, seed }); let prev = 0;
    const atacante = (s, p, dt, api) => {
      const v = s.g.vista(), B = v.B;
      if (v.st[0] === 1) { const dx = v.x[0] - v.x[1], dz = v.z[0] - v.z[1], m = Math.hypot(dx, dz) || 1; api.eje(dx / m, dz / m); if (m < 5 && v.dCd[1] <= s.gt) api.press('a'); return; }
      perfecto(s, p, dt, api);
    };
    jugar(st, [perfecto, atacante], 30, (s) => { const v = s.g.vista(); if (prev === 1 && v.st[0] === 2) robos++; prev = v.st[0]; if (v.d[1]) empujones++; });
  }
  assert.ok(empujones > 0 && robos > 0, 'empujones ' + empujones + ' · caídas del colgado ' + robos);
});

test('cornada: pararse de frente al toro que embiste te tumba (y la señal avisa antes)', () => {
  let cornadas = 0, aviso = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const st = mkCtx({ n: 1, seed, lv: 2 }); let ant = 0;
    jugar(st, [(s, p, dt, api) => { const v = s.g.vista(), B = v.B; if (B.s === 1) aviso++; const tx = B.x + B.cx * 3, tz = B.z + B.sz * 3, dx = tx - v.x[p], dz = tz - v.z[p], m = Math.hypot(dx, dz) || 1; api.eje(dx / m, dz / m); }], 30,
      (s) => { const v = s.g.vista(); if (ant !== 2 && v.st[0] === 2) cornadas++; ant = v.st[0]; });
  }
  assert.ok(cornadas > 0 && aviso > 0, 'cornadas ' + cornadas);
});

test('eventos: caporal, becerro, polvareda, lluvia y doble final existen en el reloj', () => {
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 1, lv, seed: 3 }); let cap = 0, bec = 0, llu = 0, dbl = 0;
    jugar(st, [], 30, (s) => { const v = s.g.vista(); if (v.cap.some((x) => x !== null)) cap++; if (v.bec) bec++; if (v.lluvia) llu++; if (v.mult === 2) dbl++; });
    assert.ok(cap > 30 && bec > 30 && llu > 30 && dbl > 30 && st.g.vista().polv >= 2, 'lv' + lv);
  }
});

test('CPU: más habilidad => más puntos en los tres niveles (40 semillas)', () => {
  for (const lv of [1, 2, 3]) {
    const bajo = [], alto = [];
    for (let seed = 1; seed <= 40; seed++) { const sc = jugar(mkCtx({ n: 2, lv, seed, skill: [0.3, 0.9] }), ['cpu', 'cpu']); bajo.push(sc[0]); alto.push(sc[1]); }
    console.log('  lv' + lv + ' CPU .3 media ' + media(bajo).toFixed(0) + ' · CPU .9 media ' + media(alto).toFixed(0));
    assert.ok(media(alto) > media(bajo) * 1.15, 'lv' + lv);
    assert.ok(media(bajo) > 20, 'la CPU floja también colea algo: lv' + lv);
  }
});

test('cuatro CPU pelean por la misma cola: reparto y topes', () => {
  for (const lv of [1, 2, 3]) { const sc = jugar(mkCtx({ n: 4, lv, seed: 7 + lv }), ['cpu', 'cpu', 'cpu', 'cpu']); assert.ok(Math.max.apply(null, sc) > 0, 'alguien puntúa: ' + sc); }
});

test('duraciones cortas (relámpago 10 s) y largas no revientan; puntajes enteros dentro del catálogo', () => {
  for (const dur of [3, 10, 30]) for (const lv of [1, 2, 3]) jugar(mkCtx({ lv, dur, seed: dur + lv }), ['cpu', 'cpu', 'cpu', 'cpu'], dur);
});

test('red: cuerpo() cabe y alRemoto lo reproduce (con el empate de la cola por marca h)', () => {
  const a = mkCtx({ n: 2, seed: 6 }); jugar(a, [perfecto, 'idle'], 12);
  const b = mkCtx({ n: 2, seed: 6 }); b.gt = 12; b.c.mio = (p) => p === 1;
  const o = a.g.cuerpo ? null : null; void o;
  const cuerpo = a.g.cuerpo(0); DEF.cuerpo.forEach((f) => assert.ok(Number.isInteger(cuerpo[f]), f));
  b.g.alRemoto(0, cuerpo); const v = b.g.vista();
  assert.strictEqual(v.sc[0], cuerpo.sc); assert.strictEqual(v.st[0], cuerpo.st); assert.ok(Math.abs(v.x[0] - cuerpo.x / 10) < 1e-9);
  assert.ok(JSON.stringify(cuerpo).length < 120);
});

test('dibujo 2D: draw() no revienta con gt<0, eventos y los 3 niveles (solo primitivas del lab)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ lv, seed: 3 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 30, (s) => { if (Math.round(s.gt * 30) % 20 === 0) s.g.draw(); }); st.g.draw();
  }
  assert.ok(calls.length > 200);
});
