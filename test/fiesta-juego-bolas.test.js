/* f_bolas (FFA, modelo C): humo sin red. El «juez» es este mismo proceso: llama a ai() de las CPU, step() a 1/30 y update(); los humanos remotos se simulan
   con c.cpu[p] = false y el handler de `xtiro`. Contexto falso y partidas = docs/style-lab/pruebas/fiesta-bolas-bench.js (misma fuente para el banco y la prueba).
   Comprueba registro, lint, pack/restore EXACTOS (migración del juez), lerp, reglas (xtiro: vigente, deduplicado, ventana y gracia; medidor; choques; mingo; medición
   4/2/1/0; viento; patada del carajito; calendario dentro de dur), CPU (ociosos pierden, la habilidad pesa, asientos parejos), límites del catálogo, la sesión real
   (LIVE.sim y LIVE.practice) y el dibujo con primitivas del lab. La red va en test/fiesta-live-bolas.test.js.  SOLO JUGABILIDAD: estilo snes/primitivas. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-bolas-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-bolas.js');
const DEF = B.cargar(), LIM = B.LIM, I = B.I, IDLE = ['idle', 'idle', 'idle', 'idle'];
const mk = (o) => B.mkCtx(DEF, o), tick = (st, m) => B.tick(st, m || IDLE);
const CAT = reglas.CATALOGO.filter((x) => x.g === 'f_bolas')[0];

test('registro: C, rank, ffa como el catálogo; lim propuesto; carta; packN 81 y packDiscretos válidos', () => {
  assert.strictEqual(DEF.modelo, CAT.mo); assert.strictEqual(DEF.clase, CAT.cl); assert.deepStrictEqual(DEF.modos, CAT.m);
  if (CAT.lim) assert.deepStrictEqual(DEF.limites, CAT.lim); else assert.deepStrictEqual(DEF.limites, LIM);
  assert.strictEqual(DEF.dur, 35); assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.migra, true); assert.strictEqual(DEF.packN, 81);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 2 && DEF.carta.roles === null);
  for (const j of DEF.packDiscretos) assert.ok(Number.isInteger(j) && j >= 0 && j < DEF.packN);
});

test('lint: sin Math.random/Date.now ni canvas directo, dialecto ES5 de fiesta-*.js, solo el tipo propio xtiro', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/, /\blet\b/, /\bconst\b/]) assert.ok(!re.test(s), String(re));
  const tipos = (s.match(/c\.(send|on)\('([a-z0-9]+)'/g) || []).map((x) => x.replace(/.*'(.*)'/, '$1'));
  assert.ok(tipos.length >= 2 && tipos.every((t) => t === 'xtiro'), tipos.join(','));
  assert.ok(B.CALLS !== undefined);
});

test('pack: 81 enteros; s ≤420 B y s2 ≤420 B; restore deja al juez nuevo EXACTO (bolas rodando, mismos xtiro después)', () => {
  const rem = [1, 2, 3], A = mk({ seed: 9, lv: 2, remotos: rem });
  const remoto = (st) => { const v = st.g.vista(); if (v.fase !== 0) return; for (const p of rem) if (v.ft === 15 + p * 29 + v.r * 11) st.h.xtiro({ r: v.r, a: -250 + p * 140, f: 500 + p * 50 }, p); };
  let T = 0;
  for (; T < 900; T++) { remoto(A); tick(A); if (T > 100 && A.g.vista().b.filter((b) => b.act && (b.vx || b.vy)).length >= 2) { T++; break; } }
  const snap = A.g.pack(); assert.strictEqual(snap.length, 81); assert.ok(snap.every(Number.isInteger));
  assert.ok(JSON.stringify({ q: 0, e: 9, t: 99999, p: snap.slice(0, 60) }).length <= 420); assert.ok(JSON.stringify({ q: 0, e: 9, t: 99999, p: snap.slice(60) }).length <= 420);
  const Bc = mk({ seed: 9, lv: 2, remotos: rem }); Bc.g.restore(snap); Bc.gt = A.gt;
  for (let k = T; k < 1050; k++) { remoto(A); remoto(Bc); tick(A); tick(Bc); assert.deepStrictEqual(Bc.g.pack(), A.g.pack(), 'diverge en el tick ' + k); }
  assert.deepStrictEqual(Bc.g.scores(), A.g.scores()); assert.ok(A.g.done());
});

test('lerp: interpola posiciones de bolas activas y del mingo; las inactivas y los discretos salen del snapshot nuevo; no cruza saltos grandes', () => {
  const st = mk({ seed: 1 }); const a = st.g.pack(), b = a.slice();
  B.ponBola(a, 0, 300, 300); B.ponBola(b, 0, 320, 280); b[I.fase] = 1; b[I.mx] = a[I.mx] + 40; b[I.b(4) + 1] = 777;
  const m = st.g.lerp(a, b, 0.5);
  assert.strictEqual(m[I.b(0)], 310 * 4); assert.strictEqual(m[I.b(0) + 1], 290 * 4); assert.strictEqual(m[I.mx], a[I.mx] + 20); assert.strictEqual(m[I.fase], 1);
  assert.strictEqual(m[I.b(4) + 1], 777, 'bola inactiva: valor nuevo');
  const c2 = b.slice(); c2[I.b(0)] = a[I.b(0)] + 1200; assert.strictEqual(st.g.lerp(a, c2, 0.5)[I.b(0)], c2[I.b(0)]);
});

test('xtiro: el del lanzamiento vigente entra; repetido no cambia nada; de otro lanzamiento se ignora; si falta alguien la rodada lo espera ≤2,5 s', () => {
  const st = mk({ seed: 2, remotos: [1, 2, 3] });
  st.h.xtiro({ r: 0, a: 0, f: 600 }, 1); tick(st);
  const b = st.g.vista().b[3]; assert.strictEqual(b.act, 1); assert.ok(b.vy < -6 && Math.abs(b.vx) < 0.01);
  st.h.xtiro({ r: 0, a: 300, f: 999 }, 1); tick(st); assert.ok(Math.abs(st.g.vista().b[3].vx) < 0.01, 'dedup por bola');
  st.h.xtiro({ r: 2, a: 0, f: 600 }, 2); tick(st); assert.strictEqual(st.g.vista().b[8].act, 0); assert.strictEqual(st.g.vista().b[6].act, 0);
  st.h.xtiro({ r: 0, a: 0, f: 600 }, 9); tick(st);                                                                    // asiento inexistente: sin efecto ni excepción
  const v = st.g.vista(); for (let i = 0; i < v.AIMT + 60; i++) tick(st);
  assert.strictEqual(st.g.vista().fase, 1, 'faltan P0, P2 y P3: la rodada espera');
  st.h.xtiro({ r: 0, a: 50, f: 500 }, 2); tick(st); assert.strictEqual(st.g.vista().b[6].act, 1, 'tiro tardío dentro de la gracia');
  for (let i = 0; i < 40; i++) tick(st); assert.strictEqual(st.g.vista().fase, 2, 'pasada la gracia se mide');
  st.h.xtiro({ r: 0, a: 0, f: 500 }, 3); tick(st); assert.strictEqual(st.g.vista().b[9].act, 0, 'después de la gracia se pierde');
  const todos = mk({ seed: 2, remotos: [1, 2, 3] });                                                                   // si ya lanzaron todos, se mide en cuanto paran
  todos.in[0].a = true; tick(todos); tick(todos); todos.in[0].a = false;
  for (const p of [1, 2, 3]) todos.h.xtiro({ r: 0, a: -20 + p * 10, f: 300 }, p);
  for (let i = 0; i < todos.g.vista().AIMT + 30; i++) tick(todos);
  assert.strictEqual(todos.g.vista().fase, 2);
});

test('medidor y puntería del asiento local: el stick gira (60°/s, tope ±60°), mantener A sube y baja en 2,2 s, soltar lanza; al cerrar la ventana cargando, lanza solo', () => {
  const st = mk({ seed: 3, remotos: [1, 2, 3] }); st.in[0].x = -1; for (let i = 0; i < 90; i++) tick(st); assert.strictEqual(st.g.vista().th[0].ang, -60);
  const m = mk({ seed: 3, remotos: [1, 2, 3] }); m.in[0].a = true; for (let i = 0; i < 34; i++) tick(m);                   // 33 ticks cargando = 1,1 s = tope
  m.in[0].a = false; tick(m); const b = m.g.vista().b[0]; assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - (9.6 - 0.12)) < 0.05, 'fuerza 1 en la cima: ' + Math.hypot(b.vx, b.vy));
  const w = mk({ seed: 3, remotos: [1, 2, 3] }); w.in[0].a = true; for (let i = 0; i < 67; i++) tick(w);                   // 66 ticks = vuelta entera: fuerza ~0
  w.in[0].a = false; tick(w); const bw = w.g.vista().b[0]; assert.ok(Math.hypot(bw.vx, bw.vy) < 3.2, 'ida y vuelta: casi la mínima');
  const cierre = mk({ seed: 3, remotos: [1, 2, 3] }); cierre.in[0].a = true; for (let i = 0; i < cierre.g.vista().AIMT + 2; i++) tick(cierre);
  assert.strictEqual(cierre.g.vista().b[0].act, 1);
  const tarde = mk({ seed: 3, remotos: [1, 2, 3] }); for (let i = 0; i < tarde.g.vista().AIMT + 5; i++) tick(tarde);
  tarde.in[0].a = true; tick(tarde); tick(tarde); tarde.in[0].a = false; tick(tarde); assert.strictEqual(tarde.g.vista().b[0].act, 0, 'el asiento del juez no lanza fuera de la ventana');
});

test('física: una bola quieta sale con el golpe (¡clac! cuenta en choqN), el mingo liviano sale lejos, las tablas rebotan, fuerza 0,6 rueda ~200 px', () => {
  const st = mk({ seed: 4, remotos: [1, 2, 3] });
  B.edita(st, (a) => { B.ponBola(a, 3, 400, 250); B.ponBola(a, 0, 400, 330, 0, -6); a[I.mx] = 250 * 4; a[I.my] = 150 * 4; });
  const c0 = st.g.vista().choqN; for (let i = 0; i < 30; i++) tick(st);
  const v = st.g.vista(); assert.strictEqual(v.choqN, c0 + 1); assert.ok(v.b[3].y < 230 && Math.abs(v.b[0].vy) < 1);
  const mg = mk({ seed: 4, remotos: [1, 2, 3] }); B.edita(mg, (a) => { a[I.mx] = 400 * 4; a[I.my] = 250 * 4; B.ponBola(a, 0, 400, 330, 0, -6); });
  for (let i = 0; i < 60; i++) tick(mg); assert.ok(mg.g.vista().m.y < 225);
  const pared = mk({ seed: 4, remotos: [1, 2, 3] }); B.edita(pared, (a) => { B.ponBola(a, 0, 600, 300, 8, 0); }); for (let i = 0; i < 10; i++) tick(pared);
  assert.ok(pared.g.vista().b[0].x <= 632 - 11 && pared.g.vista().b[0].vx <= 0, 'rebota en la tabla');
  const r = mk({ seed: 4, remotos: [1, 2, 3] }); r.h.xtiro({ r: 0, a: 0, f: 600 }, 1); for (let i = 0; i < 120; i++) tick(r);
  const alc = 400 - r.g.vista().b[3].y; assert.ok(alc > 180 && alc < 240, 'alcance ' + alc);
});

test('medición: por la mejor bola de cada uno 4/2/1/0 (sin bola 0); empate exacto = mismos puntos; se suma a scores()', () => {
  const st = mk({ seed: 6, remotos: [1, 2, 3] });
  B.edita(st, (a) => { a[I.fase] = 1; a[I.ft] = 80; a[I.mx] = 400 * 4; a[I.my] = 200 * 4; B.ponBola(a, 0, 400, 260); B.ponBola(a, 1, 470, 200); B.ponBola(a, 3, 430, 200); B.ponBola(a, 4, 400, 230); B.ponBola(a, 6, 300, 300); });
  tick(st); const v = st.g.vista();
  assert.deepStrictEqual(v.lp, [2, 4, 1, 0]); assert.deepStrictEqual(st.g.scores(), [2, 4, 1, 0]); assert.strictEqual(v.fase, 2);
  const emp = mk({ seed: 6, remotos: [1, 2, 3] });
  B.edita(emp, (a) => { a[I.fase] = 1; a[I.ft] = 80; a[I.mx] = 400 * 4; a[I.my] = 200 * 4; B.ponBola(a, 0, 400, 240); B.ponBola(a, 3, 400, 160); B.ponBola(a, 6, 300, 200); B.ponBola(a, 9, 400, 320); });
  tick(emp); assert.deepStrictEqual(emp.g.vista().lp, [4, 4, 1, 0], 'empate exacto a 40 px');
  for (let i = 0; i < 60; i++) tick(st); assert.strictEqual(st.g.vista().r, 1); assert.strictEqual(st.g.vista().fase, 0);
});

test('niveles: Nv1 sin viento; Nv2-3 viento sembrado (±0,012-0,032) que desvía la bola; Nv3 el carajito patea el mingo (aviso 0,8 s, dentro de la ventana)', () => {
  assert.ok(mk({ lv: 1, seed: 5 }).g.vista().WX.every((w) => w === 0));
  for (let seed = 1; seed <= 20; seed++) { const v = mk({ lv: 2, seed }).g.vista(); assert.ok(v.WX.every((w) => Math.abs(w) >= 0.012 && Math.abs(w) <= 0.0325)); assert.deepStrictEqual(v, mk({ lv: 2, seed }).g.vista()); }
  const vto = mk({ lv: 2, seed: 3, remotos: [1, 2, 3] }), w0 = vto.g.vista().WX[0]; vto.h.xtiro({ r: 0, a: 0, f: 600 }, 1); for (let i = 0; i < 100; i++) tick(vto);
  const dx = vto.g.vista().b[3].x - vto.g.vista().XS[1]; assert.ok(Math.sign(dx) === Math.sign(w0) && Math.abs(dx) > 15, 'el viento la desvía ' + dx.toFixed(1));
  for (let seed = 1; seed <= 20; seed++) { const v = mk({ lv: 3, seed }).g.vista(); assert.ok(v.KICK.every((k) => k >= 34 && k <= v.AIMT - 30)); }
  const st = mk({ lv: 3, seed: 7, remotos: [1, 2, 3] }), K = st.g.vista().KICK[0], m0 = st.g.vista().m;
  for (let i = 0; i < K; i++) tick(st); assert.strictEqual(st.g.vista().pat, 0);
  for (let i = 0; i < 40; i++) tick(st); const m1 = st.g.vista().m; assert.strictEqual(st.g.vista().pat, 1); assert.ok(Math.hypot(m1.x - m0.x, m1.y - m0.y) > 25);
  const s2 = mk({ lv: 2, seed: 7 }); for (let i = 0; i < 400; i++) tick(s2); assert.strictEqual(s2.g.vista().pat, 0);
});

test('calendario: los lanzamientos caben en dur 35 (3), en la práctica de 20 s (2) y en el catálogo viejo de 50 s (3); done() tras minT', () => {
  for (const dur of [20, 35, 50]) for (let seed = 1; seed <= 15; seed++) {
    const st = mk({ seed, dur, lv: 1 + seed % 3 }); B.jugar(st, B.CPU4, dur);
    assert.ok(st.g.done(), `dur ${dur} seed ${seed}: terminó (${st.gt.toFixed(1)} s)`); assert.ok(st.gt <= dur); assert.strictEqual(st.g.vista().NR, dur >= 30 ? 3 : 2);
    if (dur >= 35) assert.ok(st.gt >= Math.min(LIM.minT, dur - 1), 'no antes de minT');
  }
});

test('red de seguridad: si dur llega antes de medir el último lanzamiento, scores() cuenta la cancha tal cual', () => {
  const st = mk({ seed: 6, remotos: [1, 2, 3] });
  B.edita(st, (a) => { a[I.r] = 2; a[I.fase] = 0; a[I.mx] = 400 * 4; a[I.my] = 200 * 4; B.ponBola(a, 3, 400, 230); });
  assert.deepStrictEqual(st.g.scores(), [0, 0, 0, 0], 'durante el juego, solo lo medido');
  st.gt = 35; assert.deepStrictEqual(st.g.scores(), [0, 4, 0, 0]);
});

test('CPU: ociosos nunca ganan; la habilidad pesa; con habilidad igual los 4 asientos ganan 15-35 % (puesto en la raya sorteado)', () => {
  let bad = 0; for (const lv of [1, 2, 3]) { const o = B.medir(DEF, { lv, N: 30, modos: ['idle', 'idle', 'cpu', 'cpu'] }); bad += o.win[0] + o.win[1]; }
  assert.strictEqual(bad, 0);
  const sk = B.medir(DEF, { lv: 1, N: 150, skill: [0.9, 0.3, 0.3, 0.3] }); assert.ok(sk.win[0] / sk.N >= 0.36, '.9 gana ' + sk.win[0] / sk.N);
  for (const lv of [1, 2, 3]) { const r = B.medir(DEF, { lv, N: 200 }); r.win.forEach((x, i) => assert.ok(x / r.N >= 0.15 && x / r.N <= 0.35, `lv${lv} asiento ${i}: ${(100 * x / r.N).toFixed(0)}%`)); }
});

test('límites: 200 semillas × Nv1-3 con 4 CPU: enteros en [0, scoreMax], ≤ scoreRate·(t+1,5), todos lanzan (suma ≥21) y el veredicto sale de compara', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const st = mk({ seed: seed * 13, lv: 1 + seed % 3 }); const sc = B.jugar(st, B.CPU4);
    sc.forEach((x) => { assert.ok(Number.isInteger(x) && x >= 0 && x <= LIM.scoreMax); assert.ok(x <= LIM.scoreRate * (st.gt + 1.5)); });
    assert.ok(sc.reduce((a, b) => a + b, 0) >= 21, 'seed ' + seed + ': ' + sc);
    const ve = reglas.compara('ffa', [0, 1, 2, 3], sc); assert.strictEqual(ve.puestos.length, 4);
  }
});

test('sesión real: LIVE.sim (4 CPU, juez, terminar, hash) determinista y dentro de lim; LIVE.practice (1v1 contra CPU) corre sin red', () => {
  globalThis.FIESTA.reglas = reglas;
  const LIVE = require('../docs/style-lab/fiesta-live.js');
  delete require.cache[SRC]; require(SRC);
  assert.ok(LIVE.get('f_bolas'));
  for (const lv of [1, 2, 3]) {
    const a = LIVE.sim('f_bolas', { tipo: 'ffa', seed: 40 + lv, lv, skill: 0.6, strict: true }), b = LIVE.sim('f_bolas', { tipo: 'ffa', seed: 40 + lv, lv, skill: 0.6 });
    assert.ok(a.fin); assert.strictEqual(a.h, b.h); assert.ok(a.kk / 30 >= LIM.minT && a.kk / 30 <= 35); assert.ok(a.sc.every((x) => x >= 0 && x <= 12)); assert.ok(a.sc.reduce((s, x) => s + x, 0) >= 21);
  }
  const P = LIVE.practice('f_bolas', { seed: 5, lv: 2, strict: true });
  for (let i = 0; i < 30 * 25 && !P.fin; i++) { if (i === 40) P.in.down('a'); if (i === 70) P.in.up('a'); P.update(1 / 30); P.draw(); }
  assert.ok(P.fin, 'la práctica (20 s) termina'); assert.ok(P.sess.verdict && P.sess.verdict.sc.length === 2);
  P.close();
});

test('dibujo: draw() solo con primitivas del lab (juez, no-juez, espectador, n=2..4, 3 niveles, todas las fases)', () => {
  B.BANNED.length = 0;
  for (const lv of [1, 2, 3]) for (const yo of [0, 2, -1]) for (const n of [2, 3, 4]) {
    if (yo >= n) continue;
    const st = mk({ lv, seed: 3, yo, n, juez: yo !== 2 });
    for (let k = 0; k < 1050 && !st.g.done(); k += 1) { B.tick(st, B.CPU4.slice(0, n)); if (k % 37 === 0) st.g.draw(); }
    st.g.draw(); st.g.destacado(); st.g.hudChip(0);
  }
  assert.deepStrictEqual([...new Set(B.BANNED)], []);
  assert.ok(B.CALLS.rr && B.CALLS.ell && B.CALLS.line && B.CALLS.poly && B.CALLS.txt);
});
