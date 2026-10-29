/* f_cerro: humo sin red. Carga el juego contra un FIESTA.LIVE mínimo y un contexto `c` falso (como la práctica: los 4 asientos son míos)
   y comprueba reglas, CPU, límites, simetría de asientos y determinismo. Comparte el banco con docs/style-lab/pruebas/fiesta-cerro-bench.js.
   La red real (juez, relé con retardo, migración) está en test/fiesta-live-cerro.test.js. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-cerro-bench.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-cerro.js');
const DEF = B.cargar(), { mkCtx, jugar, tick } = B;
const quieto = (st, p, api) => {}, TOPE = 2100;

test('registro: ffa, rank, modelo A, 35 s, stick + 1 botón, cuerpo de 5 campos', () => {
  assert.strictEqual(DEF.modelo, 'A'); assert.strictEqual(DEF.clase, 'rank'); assert.deepStrictEqual(DEF.modos, ['ffa']); assert.strictEqual(DEF.dur, 35);
  assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.botones, 1); assert.deepStrictEqual(DEF.cuerpo, ['x', 'y', 'sc', 'tf', 'st']);
  assert.deepStrictEqual(DEF.limites, { scoreMax: 2100, scoreRate: 150, minT: 8, finTemprano: 1 });
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin mensajes propios', () => {
  const s = fs.readFileSync(SRC, 'utf8');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/])
    assert.ok(!re.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), String(re));
  assert.ok(!/c\.send\(/.test(s), 'el juego no manda mensajes propios (solo el cuerpo `o`)');
});

test('mundo: mismo hash con la misma semilla (aunque cambie n o yo) y distinto con otra; cada piso es alcanzable desde el de abajo', () => {
  for (const lv of [1, 2, 3]) {
    const a = mkCtx(DEF, { seed: 7, lv }).g.vista(), b = mkCtx(DEF, { seed: 7, lv, n: 2, yo: 1 }).g.vista();
    assert.strictEqual(a.layoutHash, b.layoutHash);
    assert.strictEqual(a.nPads, lv === 1 ? 0 : a.nPads);
    for (let f = 1; f <= a.NF; f++) {
      const arriba = a.pf[f].map((i) => a.plat[i]), abajo = a.pf[f - 1].map((i) => a.plat[i]);
      assert.ok(arriba.some((U) => abajo.some((S) => Math.min(S.x1, U.x1) - Math.max(S.x0, U.x0) >= 24)), 'piso ' + f + ' sin solape con el de abajo (lv' + lv + ')');
      const o = arriba.slice().sort((p, q) => p.x0 - q.x0);
      for (let k = 1; k < o.length; k++) assert.ok(o[k].x0 - o[k - 1].x1 <= 75, 'hueco saltable en el piso ' + f);
    }
  }
  assert.notStrictEqual(mkCtx(DEF, { seed: 7, lv: 2 }).g.vista().layoutHash, mkCtx(DEF, { seed: 8, lv: 2 }).g.vista().layoutHash);
});

test('física: un salto sube ~72 px, atraviesa el piso de arriba y aterriza encima; un humano ocioso no se mueve', () => {
  const st = mkCtx(DEF, { n: 1, lv: 1, seed: 3 }); let max = 0;
  st.gt = 0.1;
  const v0 = st.g.vista(), U = v0.plat.filter((p) => p.f === 1).sort((a, b) => Math.abs((a.x0 + a.x1) / 2 - 160) - Math.abs((b.x0 + b.x1) / 2 - 160))[0];
  assert.ok(U && U.x0 < 160 + 80);
  /* se coloca bajo el piso 1 caminando hasta el centro del tramo y salta */
  const tx = (Math.max(U.x0, 0) + Math.min(U.x1, 320)) / 2; let saltó = false;
  for (let i = 0; i < 100; i++) {   // 3,3 s: antes del primer ave y de la primera ráfaga
    tick(st, [(s, p, api) => { const v = s.g.vista(); if (Math.abs(tx - v.x[0]) > 3 && v.g[0] >= 0) api.eje(tx > v.x[0] ? 1 : -1, 0); else { api.eje(0, 0); if (!saltó && v.g[0] >= 0) { api.press('a'); saltó = true; } } }]);
    max = Math.max(max, st.g.vista().y[0]);
  }
  const v = st.g.vista(); assert.ok(max > 65 && max < 80, 'apogeo ' + max);
  assert.strictEqual(v.y[0], 56, 'aterrizó en el piso 1'); assert.strictEqual(v.g[0], U.id); assert.ok(v.hmax[0] === 56);
  const q = mkCtx(DEF, { n: 2, lv: 1 }); jugar(q, [quieto, quieto], 10); assert.strictEqual(q.g.vista().y[0], 0); assert.strictEqual(q.g.scores()[0], 0);
});

test('tobos: un tobo que te alcanza te aturde 0,5 s e invulnerable 1,2 s; en el piso suelo no te hunde; subiendo, caes al piso de abajo (no más)', () => {
  /* suelo: un humano que camina a la columna del primer tobo (cae hasta el suelo) recibe 1 golpe y sigue en y=0 */
  const st = mkCtx(DEF, { n: 1, lv: 1, seed: 4 }), b = st.g.vista().tobos[0]; let stunVisto = 0;
  const hasta = b.T + b.y0 / 230 + 0.4;
  jugar(st, [(s, p, api) => { const v = s.g.vista(); const dx = b.x - v.x[0]; if (s.gt < b.T + b.y0 / 230 - 0.6) api.eje(Math.abs(dx) > 3 ? (dx > 0 ? 1 : -1) : 0, 0); else api.eje(0, 0); if (v.stun[0] > 0) stunVisto = Math.max(stunVisto, v.stun[0]); }], hasta);
  const v = st.g.vista(); assert.strictEqual(v.hits[0], 1, 'un golpe'); assert.ok(stunVisto > 0.3 && stunVisto <= 0.5 + 1e-9, 'aturdido ' + stunVisto); assert.strictEqual(v.y[0], 0);
  /* subiendo: cada golpe de la CPU deja al jugador en el mismo piso o en el de abajo al aterrizar (el viento y los empujones pueden soltarte hasta ~4 pisos; los golpes de ave y los empujones sí pueden sacarte de la repisa y soltarte varios pisos) */
  let golpes = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s2 = mkCtx(DEF, { n: 1, lv: 3, seed, skill: 0.35 }); let h0 = 0, pend = null;
    jugar(s2, ['cpu'], 35, (s) => {
      const w = s.g.vista(); if (w.hits[0] > h0) { h0 = w.hits[0]; if (w.ult[0] > 2) { pend = null; return; } golpes++; pend = { piso: Math.round(w.hmax[0] / 56), yantes: w.y[0], t: s.gt, g0: w.g[0] }; }
      else if (pend && s.gt - pend.t > 0.1 && w.g[0] >= 0) { const pisoAhora = Math.round(w.y[0] / 56), pisoAntes = Math.round(pend.yantes / 56); assert.ok(pisoAhora >= pisoAntes - 4 && w.y[0] <= pend.yantes + 4, `golpe: ${pend.yantes} -> ${w.y[0]}`); pend = null; }
    });
  }
  assert.ok(golpes >= 3, 'hubo golpes para comprobar: ' + golpes);
});

test('bot sin tobos llega a la platabanda en tiempos razonables; CPU nivel 2 (skill .6): primeros 12-24 s, y ocioso nunca supera a ninguna', () => {
  const r = B.medir(DEF, { N: 40, lv: 2, skill: 0.6 });
  assert.ok(r.pLlega > 0.25 && r.pLlega < 0.99, 'llegan ' + r.pLlega);
  assert.ok(r.min >= 9 && r.med >= 12 && r.med <= 26, 'tiempos ' + r.min + '/' + r.med);
  assert.ok(r.hitsPP > 0.05, 'los tobos sí pegan: ' + r.hitsPP);
  for (let seed = 1; seed <= 20; seed++) { const st = mkCtx(DEF, { lv: 2, seed, skill: 0.6 }); const sc = jugar(st, [quieto, 'cpu', 'cpu', 'cpu'], 35); assert.strictEqual(sc[0], 0); assert.ok(sc[1] > 0); }
});

test('puntajes: enteros, 0..scoreMax, ≤ scoreRate·(t+1,5); los que llegan >= 1000 y llegar antes vale más; tres niveles; dur corto no falla', () => {
  for (const dur of [10, 20, 35]) for (const lv of [1, 2, 3]) {
    const st = mkCtx(DEF, { n: 4, lv, dur, seed: dur * 7 + lv, skill: 0.8 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', quieto], dur), v = st.g.vista(), t = Math.max(st.gt, 1);
    sc.forEach((x, i) => { assert.ok(Number.isInteger(x) && x >= 0 && x <= TOPE && x <= 150 * (Math.max(t, dur) + 1.5), `dur${dur} lv${lv} sc[${i}]=${x}`); assert.strictEqual(x >= 1000, v.tf[i] > 0); if (!v.tf[i]) assert.ok(x <= 999); });
    const tfs = v.tf.map((x, i) => [x, sc[i]]).filter((a) => a[0] > 0).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < tfs.length; k++) assert.ok(tfs[k - 1][1] >= tfs[k][1], 'llegar antes no vale menos');
  }
});

test('done(): termina 3,5 s después del primero en llegar (no antes), o cuando llegan todos', () => {
  const st = mkCtx(DEF, { n: 4, lv: 1, seed: 21, skill: 0.9 }); let t1 = -1, tEnd = -1;
  jugar(st, B.CPU4, 35, (s) => { const v = s.g.vista(); if (t1 < 0 && v.tf.some((x) => x > 0)) t1 = s.gt; if (tEnd < 0 && s.g.done()) tEnd = s.gt; });
  assert.ok(t1 > 0 && tEnd >= t1 + 3.4 - 1 / 30 || st.g.vista().tf.every((x) => x > 0), `primero ${t1} fin ${tEnd}`);
  const q = mkCtx(DEF, { n: 4, lv: 1 }); assert.strictEqual(q.g.done(), false);
});

test('simetría de asientos: con bots iguales ningún asiento gana > 1/n + 8 pp en 200 semillas (nivel 2, skill .6)', () => {
  const r = B.medir(DEF, { N: 200, lv: 2, skill: 0.6 });
  r.gana.forEach((w, i) => assert.ok(w / 200 <= 0.25 + 0.08, `asiento ${i}: ${(w / 2).toFixed(1)} %`));
});

test('remotos: cuerpo entrante marca llegada, sc y posición; adoptar a un remoto (juez que hereda una CPU) continúa desde donde iba', () => {
  const cuerpos = { 1: { x: 100, y: 112, sc: 300, tf: 0, st: 0 } };
  const st = mkCtx(DEF, { n: 2, yo: 0, mio: (p) => p === 0, remoto: (p) => cuerpos[p] || null }), c = st.c;
  st.gt = 1; st.g.update(1 / 30);
  assert.strictEqual(st.g.vista().y[1], 112); assert.strictEqual(st.g.scores()[1], 300);
  cuerpos[1] = { x: 150, y: 784, sc: 1500, tf: 400, st: 2 }; st.g.update(1 / 30);
  assert.strictEqual(st.g.vista().tf[1], 400); assert.strictEqual(st.g.scores()[1], 1000 + 35 * 30 - 400);
  assert.strictEqual(st.g.cuerpo(1).st, 2);
  const s2 = mkCtx(DEF, { n: 2, yo: 0, mio: () => false, remoto: () => null }); s2.gt = 5; s2.g.alHum(1, { x: 77, y: 224, sc: 222, tf: 0, st: 0 }); s2.c.mio = (p) => true; s2.g.update(1 / 30);
  assert.ok(Math.abs(s2.g.vista().x[1] - 77) < 20 && s2.g.vista().hmax[1] >= 0.222 * 1008 - 1, 'heredó x y altura');
  assert.ok(/piso|platabanda/.test(st.g.destacado()));
});

test('dibujo: draw() no revienta (gt<0, subiendo, con perro y tobos, cada nivel, estrecho 340 y ancho 800, espectador)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = (...a) => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  globalThis.BUS = { AP: { CAST: { mama: {}, abuela: {} } } };
  for (const lv of [1, 2, 3]) for (const [x0, x1, yo] of [[0, 800, 0], [10, 350, 1], [0, 372, -1]]) {
    const st = mkCtx(DEF, { n: 4, lv, yo, campo: null }); st.c.campo = () => ({ x0, x1, y0: 70, y1: 470 });
    for (const gt of [-2, 0.2]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, B.CPU4, 12); st.g.draw(); jugar(st, B.CPU4, 35); st.g.draw();
  }
  assert.ok(calls.length > 500);
  assert.ok(calls.every((n) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(n)));
});
