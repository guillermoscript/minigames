'use strict';
/* f_vagon (FFA survival, modelo C): humo sin red. El «juez» es este mismo proceso: llama a step() a 1/30 con c.held/tap/eje de todos y a ai() de las CPU.
   Contexto falso y partidas = docs/style-lab/pruebas/fiesta-vagon-bench.js (misma fuente para el banco y la prueba).
   Comprueba registro, lint, pack/restore EXACTOS (migración del juez), lerp, reglas (empujón con carga, enfriamiento, golpe que corta la carga, dominó, puertas
   y andén, umbral, puerta que escupe, marea, frenazo Nv2+, vendedor Nv3), puntajes survival y límites, CPU (salidas, nadie quieto, ociosos pierden, habilidad pesa),
   balance por asiento (≤ 1/n + 8 pp, 200 semillas), telegrafía, predicción de las pantallas que no son el juez y dibujo. La red va en test/fiesta-live-vagon.test.js.
   SOLO JUGABILIDAD: estilo snes/primitivas, sin capturas. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-vagon-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-vagon.js');
const DEF = B.cargar(), CAT = B.CAT, LIM = B.lim(DEF), CPU4 = B.CPU4, tick = (st, m) => B.tick(st, m || [null, null, null, null]);
const mk = (o) => B.mkCtx(DEF, Object.assign({ sinGente: true }, o));   // las pruebas de mecánica sueltas van sin pasajeros; el CPU/balance usan la partida completa
/* índices del snapshot: [k, golpes, kr] + 8 por jugador: x·4, y·4, vx·64, vy·64, stun|wind<<5|cd<<10, face|lh<<4, sc, lt|ko<<7 */
const I = { k: 0, golpes: 1, kr: 2, p: (j) => 5 + 8 * j };
const WIND = 9, WARN = 30, OPEN = 90, FRZ_WARN = 21, FH = 170, RP = 17;
function edita(st, f) { const a = st.g.pack(); f(a); st.g.restore(a); }
const colocar = (st, j, x, y, vx, vy) => edita(st, (a) => { const o = I.p(j); a[o] = Math.round(x * 4); a[o + 1] = Math.round(y * 4); a[o + 2] = Math.round((vx || 0) * 64); a[o + 3] = Math.round((vy || 0) * 64); });
const ponK = (st, k) => edita(st, (a) => { a[I.k] = k; });
const lejos = (st, ...js) => { const P = [[30, 30], [570, 140], [30, 140], [570, 30]]; js.forEach((j, i) => colocar(st, j, P[i][0], P[i][1])); };
const V = (st) => st.g.vista();

test('registro: modelo C, FFA survival 50 s, packN 37, 1 botón + stick, carta completa; límites = catálogo (si ya los trae)', () => {
  assert.strictEqual(DEF.modelo, 'C'); assert.strictEqual(DEF.clase, 'survival'); assert.deepStrictEqual(DEF.modos, ['ffa']); assert.strictEqual(DEF.dur, 50);
  assert.strictEqual(CAT.mo, 'C'); assert.strictEqual(CAT.cl, 'survival'); assert.deepStrictEqual(CAT.m, ['ffa']); assert.strictEqual(CAT.dur, 50);
  if (CAT.lim) assert.deepStrictEqual(DEF.limites, CAT.lim);
  assert.deepStrictEqual(DEF.limites, { scoreMax: 1501, scoreRate: 31, minT: 6, finTemprano: 1 }); assert.strictEqual(DEF.limites.scoreMax, DEF.dur * 30 + 1);
  assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.packN, 37); assert.strictEqual(DEF.migra, true);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
  for (const j of DEF.packDiscretos) assert.ok(Number.isInteger(j) && j >= 0 && j < DEF.packN);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES5, un solo tipo x* (xlag: el retraso de vista que se le informa al juez)', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/, /\blet\b/, /\bconst\b/]) assert.ok(!re.test(s), String(re));
  const envios = s.match(/c\.(send|on)\('([^']*)'/g) || []; assert.ok(envios.every((m) => /'xlag'$/.test(m)), 'solo xlag (retraso de vista informado al juez): ' + envios);
  assert.ok(!/c\.(send|on)\([^']/.test(s), 'tipos x* literales');
});

test('pack: 37 enteros, ≤200 B al serializar; restore deja al juez nuevo en estado EXACTO (misma continuación con las mismas entradas)', () => {
  const guion = (st, p, api) => { const t = st.gt, ph = (p * 1.3) + t; api.eje(Math.sin(ph * 1.7), Math.cos(ph * 1.1)); if (Math.sin(ph * 3) > 0.93) api.press('a'); };
  for (const lv of [1, 2, 3]) {
    const A = mk({ seed: 3, lv });
    for (let i = 0; i < 400; i++) B.tick(A, [guion, guion, guion, 'cpu']);
    const snap = A.g.pack(); assert.strictEqual(snap.length, 37); assert.ok(snap.every(Number.isInteger)); assert.ok(JSON.stringify(snap).length <= 200, JSON.stringify(snap).length + ' B');
    const Bc = mk({ seed: 3, lv }); Bc.g.restore(snap); Bc.gt = A.gt;
    Bc.in = JSON.parse(JSON.stringify(A.in));
    for (let i = 0; i < 900; i++) { B.tick(A, [guion, guion, guion, guion]); B.tick(Bc, [guion, guion, guion, guion]); if (i % 30 === 0) assert.deepStrictEqual(Bc.g.pack(), A.g.pack(), `lv${lv}: diverge en el tick ${i}`); }
    assert.deepStrictEqual(Bc.g.pack(), A.g.pack()); assert.deepStrictEqual(Bc.g.scores(), A.g.scores());
  }
});

test('lerp: interpola posiciones, deja los discretos del snapshot nuevo y NO interpola a quien acaba de salir al andén ni los saltos grandes', () => {
  const st = mk({ seed: 1 }); const a = st.g.pack(), b = a.slice();
  b[I.p(1)] = a[I.p(1)] + 80; b[I.p(1) + 2] = 999; b[I.k] = 30;
  const m = st.g.lerp(a, b, 0.5);
  assert.strictEqual(m[I.p(1)], a[I.p(1)] + 40); assert.strictEqual(m[I.p(1) + 2], 999); assert.strictEqual(m[I.k], 30);
  const c2 = a.slice(); c2[I.p(2) + 1] = -68; c2[I.p(2) + 6] = 200; const n2 = st.g.lerp(a, c2, 0.5); assert.strictEqual(n2[I.p(2) + 1], -68, 'salida al andén: sin interpolar');
  const c3 = a.slice(); c3[I.p(3)] = a[I.p(3)] + 1000; assert.strictEqual(st.g.lerp(a, c3, 0.5)[I.p(3)], c3[I.p(3)], 'salto > 200 px: sin interpolar');
});

test('empujón: 0,3 s de carga sin efecto, luego despide al rival cercano (≥60 px) y lo aturde; fuera de alcance no; enfriamiento; un golpe corta la carga', () => {
  const st = mk({ seed: 1 }); colocar(st, 0, 300, 85); colocar(st, 1, 340, 85); lejos(st, 2, 3);
  st.in[0].tap++; tick(st); assert.strictEqual(V(st).wind[0], WIND, 'empieza la carga');
  for (let i = 0; i < WIND - 1; i++) { tick(st); assert.strictEqual(V(st).stun[1], 0, 'la carga no pega todavía (tick ' + i + ')'); }
  tick(st); const v = V(st); assert.ok(v.stun[1] > 0 && v.vx[1] > 9, 'sale el empujón: aturdido y despedido ' + v.vx[1]); assert.strictEqual(v.lh[1], 1, 'quién lo empujó'); assert.ok(v.cd[0] > 0, 'enfriamiento');
  for (let i = 0; i < 25; i++) tick(st); assert.ok(V(st).x[1] > 400, 'lo mandó lejos: ' + V(st).x[1]);
  const cd = mk({ seed: 1 }); colocar(cd, 0, 300, 85); colocar(cd, 1, 340, 85); lejos(cd, 2, 3); cd.in[0].tap++; for (let i = 0; i < WIND + 1; i++) tick(cd);
  colocar(cd, 1, 340, 85); cd.in[0].tap++; tick(cd); assert.strictEqual(V(cd).wind[0], 0, 'con enfriamiento A no carga');
  const lej = mk({ seed: 1 }); colocar(lej, 0, 300, 85); colocar(lej, 1, 380, 85); lejos(lej, 2, 3); lej.in[0].tap++; for (let i = 0; i < WIND + 2; i++) tick(lej); assert.strictEqual(V(lej).stun[1], 0, 'a 80 px no llega');
  const corta = mk({ seed: 1 }); colocar(corta, 0, 300, 85); colocar(corta, 1, 345, 85); lejos(corta, 2, 3);
  corta.in[1].tap++; tick(corta); for (let i = 0; i < 3; i++) tick(corta); corta.in[0].tap++; tick(corta); assert.ok(V(corta).wind[0] > 0);
  for (let i = 0; i < WIND; i++) tick(corta); assert.ok(V(corta).stun[0] > 0 && V(corta).wind[0] === 0, 'el que cargaba después recibe primero y pierde su carga'); assert.strictEqual(V(corta).stun[1], 0, 'su empujón no salió');
});

test('dominó: el empujado choca con otro y le pasa el golpe (lo aturde y le hereda el autor)', () => {
  const st = mk({ seed: 1 }); colocar(st, 0, 200, 85); colocar(st, 1, 240, 85); colocar(st, 2, 282, 85); colocar(st, 3, 570, 30);
  st.in[0].tap++; for (let i = 0; i < WIND + 6; i++) tick(st);
  const v = V(st); assert.ok(v.vx[2] > 2 && v.stun[2] > 0, 'el tercero salió rodando: ' + v.vx[2]); assert.strictEqual(v.lh[2], 1, 'autor heredado');
});

test('puertas: calendario sembrado (lados alternos, aviso 1 s, abiertas 3 s); cerrada no deja salir; abierta por el hueco = andén (sc = tick); entre puertas no', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = V(mk({ seed })).stations; assert.ok(s.length >= 4 && s.length <= 6, 'seed ' + seed + ': ' + s.length + ' estaciones');
    for (let i = 1; i < s.length; i++) { assert.strictEqual(s[i].side, 1 - s[i - 1].side, 'alternan'); assert.ok(s[i].t - s[i - 1].t >= WARN + OPEN + 4 * 30); }
    assert.ok(s[0].t >= 5.5 * 30 && s[0].t + WARN >= DEF.limites.minT * 30, 'la primera abre pasados 6,5 s (≥ minT: nadie sale antes)');
  }
  assert.deepStrictEqual(V(mk({ seed: 7 })).stations, V(mk({ seed: 7 })).stations); assert.deepStrictEqual(V(mk({ seed: 7, lv: 3 })).stations, V(mk({ seed: 7, lv: 1 })).stations, 'mismo calendario en los 3 niveles');
  const st0 = mk({ seed: 2 }); const S0 = V(st0).stations[0];
  ponK(st0, S0.t + 2); assert.strictEqual(V(st0).door.ph, 1); ponK(st0, S0.t + WARN); assert.strictEqual(V(st0).door.ph, 2); ponK(st0, S0.t + WARN + OPEN); assert.strictEqual(V(st0).door.ph, 0);
  for (const abierta of [false, true]) for (const enHueco of [true, false]) {
    const st = mk({ seed: 2 }); const s = V(st).stations[0], sd = s.side, x = enHueco ? 225 : 300;
    ponK(st, abierta ? s.t + WARN + 4 : s.t - 60);
    colocar(st, 1, x, sd === 0 ? 45 : FH - 45); colocar(st, 0, x, sd === 0 ? 85 : FH - 85); lejos(st, 2, 3);
    st.in[0].tap++; for (let i = 0; i < 26; i++) tick(st);
    const v = V(st);
    if (abierta && enHueco) { assert.ok(v.sc[1] > 0, 'abierta y por el hueco: al andén'); assert.ok(v.sc[1] >= s.t + WARN && v.sc[1] <= s.t + WARN + 30); assert.strictEqual(st.g.vivo(1), false); }
    else { assert.strictEqual(v.sc[1], 0, `abierta=${abierta} hueco=${enHueco}: sigue adentro`); assert.ok(v.y[1] >= RP - 0.01 && v.y[1] <= FH - RP + 0.01); }
  }
});

test('umbral: la puerta que cierra con alguien en el hueco lo escupe pa\' dentro; la marea arrastra hacia la puerta abierta', () => {
  const st = mk({ seed: 2 }); const s = V(st).stations[0], sd = s.side;
  ponK(st, s.t + WARN + OPEN - 1); colocar(st, 1, 225, sd === 0 ? -3 : FH + 3); lejos(st, 0, 2, 3);
  tick(st); tick(st); const v = V(st); assert.strictEqual(v.sc[1], 0); assert.ok(sd === 0 ? v.y[1] >= RP - 0.01 : v.y[1] <= FH - RP + 0.01, 'escupido: ' + v.y[1]);
  const m = mk({ seed: 2 }); ponK(m, s.t + WARN); colocar(m, 1, 225, 85); lejos(m, 0, 2, 3);
  for (let i = 0; i < 60; i++) tick(m); const y = V(m).y[1]; assert.ok(sd === 0 ? y < 65 : y > 105, 'la marea lo lleva hacia la puerta: ' + y);
  const c0 = mk({ seed: 2 }); ponK(c0, s.t - 90); colocar(c0, 1, 225, 85); lejos(c0, 0, 2, 3); for (let i = 0; i < 60; i++) tick(c0); assert.ok(Math.abs(V(c0).y[1] - 85) < 0.5, 'sin puerta abierta no hay marea');
});

test('frenazo: solo Nv2-3, sembrado, con aviso de 0,7 s; luego todos salen rodando hacia un extremo', () => {
  for (let seed = 1; seed <= 20; seed++) assert.deepStrictEqual(V(mk({ seed, lv: 1 })).frz, []);
  let vistos = 0;
  for (const lv of [2, 3]) for (let seed = 1; seed <= 20; seed++) {
    const z = V(mk({ seed, lv })).frz; if (!z.length) continue; vistos++;
    const st = mk({ seed, lv }); ponK(st, z[0].t + FRZ_WARN - 1); colocar(st, 0, 300, 85); lejos(st, 1, 2, 3);
    tick(st); assert.ok(Math.abs(V(st).vx[0]) < 0.01, 'durante el aviso no pasa nada');
    tick(st); assert.ok(V(st).vx[0] * z[0].sgn > 5 && V(st).stun[0] > 0, 'frenazo: ' + V(st).vx[0]);
  }
  assert.ok(vistos >= 20, 'hay frenazos en la mayoría de semillas: ' + vistos);
  assert.ok(FRZ_WARN / 30 >= 0.5);
});

test('vendedor: solo Nv3; recorre el pasillo y aparta a empujones a quien se le atraviesa', () => {
  assert.strictEqual(V(mk({ seed: 4, lv: 1 })).sellT, -1); assert.strictEqual(V(mk({ seed: 4, lv: 2 })).sellT, -1);
  for (let seed = 1; seed <= 10; seed++) {
    const st = mk({ seed, lv: 3 }); const T = V(st).sellT; assert.ok(T >= 7 * 30 && T <= 11 * 30);
    ponK(st, T); const s0 = V(st).seller; assert.ok(s0 && (s0.x < 0 || s0.x > 600), 'entra desde fuera del vagón (se ve venir)');
    const w = Math.round(Math.abs(300 - s0.x) / (50 / 30)); ponK(st, T + w - 20); const s1 = V(st).seller;
    colocar(st, 0, s1.x + s1.dir * 36, 85); lejos(st, 1, 2, 3);
    for (let i = 0; i < 40; i++) tick(st); assert.ok(Math.abs(V(st).y[0] - 85) > 25, `seed ${seed}: el vendedor lo apartó (y=${V(st).y[0]})`);
  }
});

test('puntajes survival: vivo = dur·30+1, fuera = tick de salida; done() con ≤1 adentro; enteros dentro de lim sin recorte del servidor (dur 3/8/12/20/50)', () => {
  const st = mk({ seed: 1 }); assert.deepStrictEqual(st.g.scores(), [1501, 1501, 1501, 1501]); assert.strictEqual(st.g.done(), false);
  edita(st, (a) => { a[I.p(0) + 6] = 300; a[I.p(2) + 6] = 410; }); assert.deepStrictEqual(st.g.scores(), [300, 1501, 410, 1501]); assert.strictEqual(st.g.done(), false);
  edita(st, (a) => { a[I.p(3) + 6] = 500; }); assert.strictEqual(st.g.done(), true); assert.strictEqual(st.g.vivo(1), true); assert.strictEqual(st.g.vivo(3), false);
  for (const dur of [3, 8, 12, 20, 50]) for (let seed = 1; seed <= 30; seed++) {
    const lv = 1 + (seed % 3), g = mk({ lv, dur, seed: seed * 7 + dur }); const sc = B.jugar(g, CPU4, dur), t = g.gt;
    const top = Math.max.apply(null, sc);
    sc.forEach((x) => {
      assert.ok(Number.isInteger(x) && x >= 1 && x <= LIM.scoreMax, `dur${dur} v=${x}`);
      const cap = x === top ? Math.min(LIM.scoreMax, LIM.scoreRate * (dur + 1.5)) : Math.min(LIM.scoreMax, LIM.scoreRate * (Math.max(t, Math.min(LIM.minT, dur - 1)) + 1.5));
      assert.ok(x <= cap, `dur${dur} seed${seed}: ${x} > ${cap}`);
    });
    const pl = reglas.puestos('ffa', [0, 1, 2, 3], sc, 'survival'); assert.strictEqual(pl.length, 4);
  }
});

test('CPU: 4 CPU sacan gente (≥1,5 por partida) en los 3 niveles, nadie se queda quieto, los ociosos nunca ganan, y la habilidad pesa', () => {
  for (const lv of [1, 2, 3]) { const r = B.medir(DEF, { N: 30, lv, skill: 0.6 }); assert.ok(r.salidasPP >= 1.5, `lv${lv}: ${r.salidasPP} salidas`); assert.strictEqual(r.quietos, 0, `lv${lv}: CPU quietas`); assert.ok(r.todos / r.N <= 0.1); }
  for (const lv of [1, 2, 3]) { const o = B.medir(DEF, { N: 40, lv, skill: 0.6, modos: ['idle', 'idle', 'cpu', 'cpu'] }); assert.strictEqual(o.cuota[0] + o.cuota[1], 0, `lv${lv}: los ociosos ganaron ${o.cuota[0] + o.cuota[1]}`); }
  const f = B.medir(DEF, { N: 120, lv: 2, skill: [0.9, 0.3, 0.9, 0.3] }); assert.ok(f.cuota[0] + f.cuota[2] >= 0.55, 'la habilidad pesa: los .9 ganan ' + (f.cuota[0] + f.cuota[2]).toFixed(2));
});

test('balance (200 semillas × Nv1-3, 4 CPU skill .6): ningún asiento gana más de 1/n + 8 pp; el puesto sale de reglas.puestos', () => {
  for (const lv of [1, 2, 3]) { const r = B.medir(DEF, { N: 200, lv, skill: 0.6 }); r.cuota.forEach((x, i) => assert.ok(x <= 0.25 + 0.08, `lv${lv} asiento ${i}: ${(x * 100).toFixed(1)}%`)); }
});

test('telegrafía (08 §11.2 #12): puerta avisa 1 s, frenazo 0,7 s, el vendedor se ve ≥0,5 s antes de entrar; el empujón carga 0,3 s visibles (lo que pide la carta)', () => {
  assert.ok(WARN / 30 >= 1); assert.ok(FRZ_WARN / 30 >= 0.5); assert.strictEqual(WIND / 30, 0.3);
  const st = mk({ seed: 5, lv: 3 }); const T = V(st).sellT; ponK(st, T); const s = V(st).seller; const ticks = (s.dir > 0 ? (0 - s.x) : (s.x - 600)) / (50 / 30); assert.ok(ticks / 30 >= 0.5, 'vendedor visible antes de entrar: ' + ticks / 30);
  const a = mk({ seed: 5 }); colocar(a, 0, 300, 85); a.in[0].tap++; tick(a); assert.ok(V(a).wind[0] > 0, 'la carga viaja en el snapshot (los demás la ven)');
});

test('predicción (pantallas que no son el juez): los empujados ruedan adelantados lo que va la vista; el cuerpo propio responde al stick al instante; el juez no toca nada', () => {
  const juez = mk({ seed: 1, lag: 0.3 }); colocar(juez, 1, 300, 85, 8, 0); edita(juez, (a) => { a[I.p(1) + 4] = 10; }); juez.g.predict(1 / 60); assert.strictEqual(V(juez).x[1], 300);
  const rem = mk({ seed: 1, juez: false, lag: 0.3, yo: 0 }); colocar(rem, 1, 300, 85, 8, 0); edita(rem, (a) => { a[I.p(1) + 4] = 10; }); rem.g.predict(1 / 60);
  const esperado = 300 + 8 * (1 - Math.pow(0.9, 9)) / 0.1; assert.ok(Math.abs(V(rem).x[1] - esperado) < 2, 'rueda 9 ticks con fricción: ' + V(rem).x[1] + ' vs ' + esperado);
  const yo = mk({ seed: 1, juez: false, lag: 0.2, yo: 0 }); const x0 = V(yo).x[0]; yo.in[0].x = 1;
  for (let i = 0; i < 30; i++) { yo.gt += 1 / 30; yo.g.predict(1 / 30); }
  assert.ok(V(yo).mp.x - x0 > 60, 'el cuerpo propio avanza sin esperar al juez: ' + (V(yo).mp.x - x0)); assert.strictEqual(V(yo).x[0], x0, 'el estado del juez no cambia');
  const sin = mk({ seed: 1, juez: false, yo: 0 }); colocar(sin, 1, 300, 85, 8, 0); edita(sin, (a) => { a[I.p(1) + 4] = 10; }); sin.g.predict(1 / 60); assert.strictEqual(V(sin).x[1], 300, 'sin c.lag ni historial no inventa nada');
});

test('práctica (1v1): dos asientos, corre entera, la CPU se mueve', () => {
  const d = mk({ n: 2, seed: 9, dur: 20 }); const x0 = V(d).x.slice(); B.jugar(d, ['cpu', 'cpu'], 20); assert.strictEqual(d.g.scores().length, 2); assert.ok(V(d).x[1] !== x0[1]);
});

test('destacado: quién sacó a más; sin salidas tiene su frase', () => {
  const st = mk({ seed: 1 }); assert.match(st.g.destacado(), /nadie se bajó/);
  edita(st, (a) => { a[I.p(2) + 7] = 2 << 7; a[I.p(1) + 6] = 100; }); assert.match(st.g.destacado(), /P2 sacó a 2/);
});

test('dibujo: draw() no revienta (gt −2, 0, 5; aviso, puertas abiertas, andén, frenazo, vendedor, fuera; n=2 y n=4; yo −1/0/3) y solo con primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [0, 3, -1]) {
    const st = mk({ lv, seed: 3, yo }); const v0 = V(st), s = v0.stations[0];
    for (const gt of [-2, 0, 5]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    ponK(st, s.t + 3); st.g.update(1 / 30); st.g.draw(); ponK(st, s.t + WARN + 5); st.g.update(1 / 30); st.g.draw();
    edita(st, (a) => { a[I.p(1) + 6] = s.t + WARN + 2; a[I.p(1) + 1] = -68; a[I.p(0) + 4] = 4 << 5; a[I.p(2) + 4] = 10; }); st.g.update(1 / 30); st.g.draw();
    if (v0.frz.length) { ponK(st, v0.frz[0].t + 5); st.g.update(1 / 30); st.g.draw(); }
    if (v0.sellT > 0) { ponK(st, v0.sellT + 200); st.g.update(1 / 30); st.g.draw(); }
    B.jugar(st, CPU4, 20); st.g.draw();
    const d = mk({ lv, n: 2, yo: yo === 3 ? 1 : yo }); B.jugar(d, ['cpu', 'cpu'], 5); d.g.draw();
    const r = mk({ lv, seed: 3, yo: 0, juez: false, lag: 0.25 }); r.g.predict(1 / 60); r.g.update(1 / 30); r.g.draw();
  }
  assert.ok(calls.length > 800); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});
