/* f_abuela: humo sin red. Carga el juego contra un FIESTA.LIVE mínimo y un contexto `c` falso (todos los asientos son míos, como la práctica)
   y comprueba reglas, CPU, límites, determinismo y que el dibujo no revienta en vertical (340) y apaisado (800). La red real (mismos puestos a 50/150/300 ms,
   juez muerto, asiento caído...) está en test/fiesta-live-abuela.test.js.  node --test test/fiesta-juego-abuela.test.js */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-abuela.js');
const LIM = { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 };

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC];
  require(SRC);
  return defs.f_abuela;
}
const DEF = cargar();

function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 45, lv = o.lv || 1;
  const st = { gt: -3, ta: new Array(n).fill(0), tb: new Array(n).fill(0), ey: new Array(n).fill(0), outs: [], g: null, cpu: new Array(n).fill(false) };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p, b) => { const arr = b === 'b' ? st.tb : st.ta, v = arr[p]; arr[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => ({ x: 0, y: st.ey[p] }), cpu: st.cpu, skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.outs.push({ ty, d, p }); if (st.g && st.g.onEv) st.g.onEv(ty, p, d, st.gt); },
    out: (p, kk) => c.ev('out', { kk: kk === undefined ? Math.floor(st.gt * 30) : kk }, p),
    send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* modos[p]: 'idle' | 'cpu' | 'bot' (perfecto a T+0,2) | función(st, p, vista) */
function jugar(st, modos, dur) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, V = g.vista();
  const api = (p) => ({ press: (b) => { (b === 'b' ? st.tb : st.ta)[p]++; }, hold: () => {}, eje: () => {} });
  while (st.gt < dur + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) {
      const m = modos[p];
      if (m === 'cpu') g.ai(p, dt, api(p));
      else if (m === 'bot') { for (const R of V.rondas) if (R[3]) R[5].forEach((b, i) => { const at = R[0] + 0.2 + i * 0.25; if (st.gt >= at && st.gt - dt < at + 1e-9) (b ? st.tb : st.ta)[p]++; }); }
      else if (typeof m === 'function') m(st, p, V);
    }
    g.update(dt);
    if (st.gt >= Math.min(3, dur - 1) && g.done()) break;
    if (st.gt >= dur) break;
  }
  return g.scores();
}
/* avanza hasta gt, soltando un toque (a/b) en los instantes de `toques` */
function guion(st, toques, hasta) {
  const dt = 1 / 30; let i = 0; toques.sort((x, y) => x[0] - y[0]);
  while (st.gt < hasta) {
    st.gt += dt;
    while (i < toques.length && toques[i][0] <= st.gt) { (toques[i][1] === 'b' ? st.tb : st.ta)[0]++; if (toques[i][2]) (toques[i][1] === 'b' ? st.ta : st.tb)[0]++; i++; }
    st.g.update(dt);
  }
}

test('registro: parámetros de la ficha 13 y del catálogo', () => {
  assert.strictEqual(DEF.modelo, 'A'); assert.strictEqual(DEF.clase, 'survival'); assert.deepStrictEqual(DEF.modos, ['ffa', '1v1']);
  assert.strictEqual(DEF.dur, 45); assert.strictEqual(DEF.botones, 2); assert.deepStrictEqual(DEF.cuerpo, ['pose', 'st', 'sc']);
  assert.deepStrictEqual(DEF.limites, LIM);
  const R = require('../docs/style-lab/fiesta-reglas.js'), cat = R.CATALOGO.filter((x) => x.g === 'f_abuela')[0];
  assert.strictEqual(cat.mo, 'A'); assert.strictEqual(cat.cl, 'survival'); assert.strictEqual(cat.dur, 45); assert.deepStrictEqual(cat.m, DEF.modos);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin mensajes propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/])
    assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(\s*'/.test(s));
});

test('mundo: mismas órdenes con la misma semilla (da igual n) y distintas con otra; ventanas y trampas por nivel', () => {
  for (const lv of [1, 2, 3]) assert.strictEqual(mkCtx({ seed: 7, lv }).g.vista().mundoHash, mkCtx({ seed: 7, lv, n: 2 }).g.vista().mundoHash);
  assert.notStrictEqual(mkCtx({ seed: 7, lv: 2 }).g.vista().mundoHash, mkCtx({ seed: 8, lv: 2 }).g.vista().mundoHash);
  const w0 = { 1: 1.2, 2: 0.9, 3: 0.6 };
  for (const lv of [1, 2, 3]) {
    let tr = 0, tot = 0, abuelo = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const V = mkCtx({ seed, lv }).g.vista();
      assert.ok(Math.abs(V.rondas[0][1] - w0[lv]) < 0.05, 'ventana inicial lv' + lv);
      assert.ok(V.rondas[0][3] && V.rondas[1][3] && V.rondas[2][3], 'las 3 primeras son reales');
      let racha = 0;
      V.rondas.forEach((R, i) => {
        tot++; if (!R[3]) { tr++; racha++; assert.ok(racha <= 2); } else racha = 0; if (R[4] === 1) { abuelo++; assert.ok(lv === 3 && !R[3]); }
        assert.ok(R[0] + R[1] <= 45 - 0.2 + 1e-6);
      });
      const solos = V.rondas.filter((R) => R[5].length === 1 && !R[6] && R[4] !== 3);   // sin combos ni bloques que estiran la ventana
      assert.ok(solos[solos.length - 1][1] < V.rondas[0][1], 'la ventana se encoge');
    }
    const f = tr / tot; assert.ok(f > { 1: 0.1, 2: 0.18, 3: 0.25 }[lv] && f < { 1: 0.26, 2: 0.34, 3: 0.42 }[lv], `trampas lv${lv}: ${f}`);
    if (lv === 3) assert.ok(abuelo > 0, 'hay voz del abuelo en el nivel 3');
  }
});

test('humano ocioso cae en la primera orden (kk = plazo·30, ≥ minT) y queda último', () => {
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 2, lv }); const sc = jugar(st, ['idle', 'cpu'], 45), V = st.g.vista();
    assert.strictEqual(V.st[0], 1); assert.strictEqual(sc[0], Math.floor((V.rondas[0][0] + V.rondas[0][1]) * 30));
    assert.ok(sc[0] >= 3 * 30, 'no antes de minT'); assert.ok(sc[1] > sc[0]);
  }
});

test('reglas: orden real con el botón correcto pasa; botón equivocado, ambos a la vez y tarde fallan; las trampas castigan el toque, no el silencio', () => {
  const caso = (lv, seed, fn) => { const st = mkCtx({ n: 1, lv, seed }); fn(st, st.g.vista().rondas); return st; };
  const V0 = mkCtx({ n: 1, lv: 1, seed: 3 }).g.vista(), R0 = V0.rondas[0], btn = R0[2] ? 'b' : 'a', otro = R0[2] ? 'a' : 'b';
  assert.strictEqual(caso(1, 3, (st, R) => guion(st, [[R[0][0] + 0.3, btn]], R[0][0] + R[0][1] + 0.2)).g.vista().st[0], 0, 'correcto');
  assert.strictEqual(caso(1, 3, (st, R) => guion(st, [[R[0][0] + 0.3, otro]], R[0][0] + R[0][1] + 0.2)).g.vista().st[0], 1, 'equivocado');
  assert.strictEqual(caso(1, 3, (st, R) => guion(st, [[R[0][0] + 0.3, btn, true]], R[0][0] + R[0][1] + 0.2)).g.vista().st[0], 1, 'ambos a la vez');
  assert.strictEqual(caso(1, 3, (st, R) => guion(st, [[R[0][0] + R[0][1] + 0.2, btn]], R[0][0] + R[0][1] + 0.5)).g.vista().st[0], 1, 'tarde');
  assert.strictEqual(caso(1, 3, (st, R) => guion(st, [[R[0][0] - 0.3, btn]], R[0][0] + R[0][1] + 0.2)).g.vista().st[0], 1, 'adelantarse no vale: la pose se reinicia en la orden');
  assert.strictEqual(caso(1, 3, (st, R) => guion(st, [[R[0][0] + 0.3, otro], [R[0][0] + 0.5, btn]], R[0][0] + R[0][1] + 0.2)).g.vista().st[0], 1, 'el primer toque decide');
  /* trampa: busca una semilla con una trampa y comprueba toque (cae) vs silencio (pasa) con el resto perfecto */
  let seed = 1; for (; seed < 200; seed++) if (mkCtx({ n: 1, lv: 1, seed }).g.vista().rondas.some((R) => !R[3])) break;
  const Vt = mkCtx({ n: 1, lv: 1, seed }).g.vista(), it = Vt.rondas.findIndex((R) => !R[3]);
  const perfecto = (extra) => { const tq = []; Vt.rondas.forEach((R, i) => { if (R[3]) R[5].forEach((b, j) => tq.push([R[0] + 0.25 + j * 0.25, b ? 'b' : 'a'])); else if (i === it && extra) tq.push([R[0] + 0.2, 'a']); }); return tq; };
  const hasta = Vt.rondas[it][0] + Vt.rondas[it][1] + 0.4;
  assert.strictEqual(caso(1, seed, (st) => guion(st, perfecto(false), hasta)).g.vista().st[0], 0, 'quieto en la trampa pasa');
  const caido = caso(1, seed, (st) => guion(st, perfecto(true), hasta));
  assert.strictEqual(caido.g.vista().st[0], 1, 'tocar en la trampa cae'); assert.strictEqual(caido.g.scores()[0], Math.floor((Vt.rondas[it][0] + Vt.rondas[it][1]) * 30));
});

test('escalada: fases por gt/dur, combos desde la mitad, eventos del patio sembrados (loro trampa, apagón, al revés) y juzgados toque a toque', () => {
  const V = mkCtx({ seed: 12, lv: 1 }).g.vista(), k = V.evs.map((e) => e[0]).sort();
  assert.deepStrictEqual(k, ['apagon', 'loro', 'reves']);
  assert.deepStrictEqual(mkCtx({ seed: 12, lv: 1, n: 2 }).g.vista().evs, V.evs, 'mismos eventos en todas las pantallas');
  V.rondas.forEach((R) => { if (R[5].length > 1) assert.ok(R[8] >= 1, 'combos solo desde la mitad'); if (R[6]) assert.strictEqual(R[8], 2, 'al revés en el final'); });
  const lo = V.evs.find((e) => e[0] === 'loro'), RL = V.rondas[lo[1] + 1];
  assert.ok(!RL[3] && RL[4] === 3, 'la 2.ª orden del bloque del loro es trampa');
  for (let i = 0; i < V.N; i++) assert.ok(!V.rondas[i][3] ? (i < 2 || V.rondas[i - 1][3] || V.rondas[i - 2][3]) : true, 'sin tres trampas seguidas');
  /* combo: los dos toques en orden pasan; solo el primero no alcanza; el segundo equivocado cae */
  let seed = 1, ic = -1; for (; seed < 300; seed++) { const W = mkCtx({ n: 1, lv: 1, seed }).g.vista(); ic = W.rondas.findIndex((R) => R[3] && R[5].length > 1 && R[5][0] !== R[5][1]); if (ic > 0) break; }
  const Vc = mkCtx({ n: 1, lv: 1, seed }).g.vista(), RC = Vc.rondas[ic], fin = RC[0] + RC[1] + 0.3;
  const previo = () => { const tq = []; Vc.rondas.slice(0, ic).forEach((R) => { if (R[3]) R[5].forEach((b, j) => tq.push([R[0] + 0.25 + j * 0.25, b ? 'b' : 'a'])); }); return tq; };
  const corre = (extra) => { const st = mkCtx({ n: 1, lv: 1, seed }); guion(st, previo().concat(extra), fin); return st.g.vista().st[0]; };
  const b = (x) => (x ? 'b' : 'a');
  assert.strictEqual(corre([[RC[0] + 0.2, b(RC[5][0])], [RC[0] + 0.45, b(RC[5][1])]]), 0, 'combo completo pasa');
  assert.strictEqual(corre([[RC[0] + 0.2, b(RC[5][0])]]), 1, 'combo a medias cae');
  assert.strictEqual(corre([[RC[0] + 0.2, b(RC[5][0])], [RC[0] + 0.45, b(RC[5][0])]]), 1, 'segundo toque equivocado cae');
  /* al revés: el botón esperado es el contrario de lo que dice la abuela */
  const ir = V.rondas.findIndex((R) => R[6] && R[3]);
  if (ir >= 0) assert.strictEqual(V.rondas[ir][5][0], 1 - V.rondas[ir][2]);
  /* relámpago (dur 10): también pasa algo */
  let conEv = 0; for (let s2 = 1; s2 <= 20; s2++) if (mkCtx({ seed: s2, lv: 2, dur: 10 }).g.vista().evs.length) conEv++;
  assert.ok(conEv >= 10, 'eventos en relámpago: ' + conEv);
});

test('teclado: flecha arriba = A, flecha abajo = B (por el eje)', () => {
  const st = mkCtx({ n: 1, lv: 1, seed: 3 }), R0 = st.g.vista().rondas[0];
  const dt = 1 / 30; let sube = false;
  while (st.gt < R0[0] + R0[1] + 0.3) { st.gt += dt; if (st.gt >= R0[0] + 0.25 && !sube) { sube = true; st.ey[0] = R0[2] ? 1 : -1; } if (st.gt >= R0[0] + 0.4) st.ey[0] = 0; st.g.update(dt); }
  assert.strictEqual(st.g.vista().st[0], 0, 'la flecha correcta pasa');
});

test('un bot perfecto sobrevive los tres niveles; cada caída manda c.out una sola vez por jugador', () => {
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 3, lv, dur: 30, seed: 11 + lv }); const sc = jugar(st, ['bot', 'idle', 'idle'], 30);
    assert.strictEqual(sc[0], 30 * 30 + 1, 'lv' + lv + ' bot vivo'); assert.ok(st.g.vista().st[1] && st.g.vista().st[2]);
    assert.deepStrictEqual(st.outs.filter((e) => e.ty === 'out').map((e) => e.p).sort(), [1, 2]);
  }
});

test('CPU nivel 2 (skill .6): terminan con puestos distintos casi siempre; un ocioso nunca le gana a una CPU', () => {
  let llegan = 0, ganaOcioso = 0, empates = 0; const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const st = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 45);
    if (st.g.vista().vivos >= 2) llegan++;
    if (new Set(sc).size < 4) empates++;
    const s2 = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const r = jugar(s2, ['idle', 'cpu', 'cpu', 'cpu'], 45);
    if (r[0] > Math.min.apply(null, r.slice(1))) ganaOcioso++;
  }
  assert.ok(llegan <= N * 0.8, 'demasiadas CPU aguantan los 45 s: ' + llegan + '/' + N);
  assert.strictEqual(ganaOcioso, 0);
});

test('CPU: error 3-15 % según la habilidad (las torpes fallan más que las diestras) y reacción humana (≥ 180 ms)', () => {
  const caidas = (sk) => { let m = 0; for (let seed = 1; seed <= 60; seed++) { const st = mkCtx({ n: 1, lv: 1, seed, skill: sk }); jugar(st, ['cpu'], 45); if (st.g.vista().st[0]) m++; } return m; };
  assert.ok(caidas(0.2) > caidas(0.95), 'las torpes caen más');
  const st = mkCtx({ n: 1, lv: 1, seed: 4, skill: 1 }), R0 = st.g.vista().rondas[0]; let primera = null;
  const dt = 1 / 30, api = { press: () => { if (primera === null) primera = st.gt; }, hold() {}, eje() {} };
  while (st.gt < R0[0] + 1) { st.gt += dt; st.g.ai(0, dt, api); st.g.update(dt); }
  assert.ok(primera === null || primera - R0[0] >= 0.18);
});

test('puntajes dentro de límites (enteros, 0..scoreMax, ≤ scoreRate·(t+1,5)); dur corto no falla', () => {
  for (const dur of [4, 10, 45]) for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 12; seed++) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv + seed }); const sc = jugar(st, ['bot', 'cpu', 'cpu', 'idle'], dur);
    const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= LIM.scoreMax && v <= LIM.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('remotos: cuerpo entrante marca pose y eliminación; alHum/alCpu no revientan', () => {
  const st = mkCtx({ n: 2, yo: 0 }), c = st.c, cuerpos = { 1: { pose: 1, st: 0, sc: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 1; st.g.update(1 / 30); assert.strictEqual(st.g.vista().pose[1], 1);
  cuerpos[1] = { pose: 0, st: 1, sc: 99 }; st.g.update(1 / 30);
  assert.strictEqual(st.g.vista().st[1], 1); assert.strictEqual(st.g.vista().sc[1], 99);
  st.g.alCpu(1); st.g.alHum(1, { pose: 0, st: 1, sc: 99 });
  assert.strictEqual(st.g.scores()[1], 99); assert.strictEqual(st.g.cuerpo(1).st, 1);
  assert.ok(/orden|primera|abuela/.test(st.g.destacado()));
});

test('dibujo: draw() no revienta en 340x600 y 800x600, en los tres niveles, con vivos y eliminados (solo primitivas del lab)', () => {
  const calls = {};
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls[nm] = (calls[nm] || 0) + 1; };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  globalThis.BUS = { AP: { CAST: { mama: {}, abuela: {}, tio: {} } } };
  for (const ancho of [340, 372, 800]) for (const lv of [1, 2, 3]) {
    globalThis.GAME_VIEW = { width: ancho, offsetX: 0 };
    const st = mkCtx({ n: 4, lv });
    for (const gt of [-2, 0.2, 2.7, 3.2, 5, 9]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 45); st.g.draw();
    const s1 = mkCtx({ n: 1, lv }); jugar(s1, ['idle'], 45); s1.g.draw();
  }
  delete globalThis.GAME_VIEW;
  assert.ok(Object.keys(calls).every((k) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(k)) && calls.rr > 100);
});
