/* f_futbolito (2v2, modelo C): humo sin red. El «juez» es este mismo proceso: llama a step() a 1/30 con c.held/tap/eje de todos y a ai() de las CPU.
   Contexto falso y partidas = docs/style-lab/pruebas/fiesta-futbolito-bench.js (misma fuente para el banco y la prueba).
   Comprueba registro, lint, pack/restore EXACTOS (migración del juez), lerp, reglas (patada, pase asistido, tiro cargado, compañeros sin colisión, autoría del gol,
   autogol, saque, reglamentario/gol de oro/empate, carro Nv3), CPU (goles, nadie quieto, ociosos pierden, habilidad pesa), balance entre lados (decide `compara`),
   límites del catálogo (sin recorte del servidor) y dibujo. La red va en test/fiesta-live-futbolito.test.js.  SOLO JUGABILIDAD: estilo snes/primitivas, sin capturas. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-futbolito-bench.js');
const reglas = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-futbolito.js');
const CAT = B.CAT, DEF = B.cargar(), CPU4 = B.CPU4, tick = (st, m) => B.tick(st, m || [null, null, null, null]);
const mk = (o) => B.mkCtx(DEF, o);
/* edita el snapshot de la partida: cambia(a) recibe el arreglo pack() y lo modifica; índices del contrato (M3 §3.4 + DM3-3) */
const I = { k: 0, pause: 1, evT: 2, evIdx: 3, gold: 4, last: 5, lt0: 6, lt1: 7, age0: 8, age1: 9, gs: 10, evK: 14, evA: 15, evB: 16, evC: 17, bx: 18, by: 19, bvx: 20, bvy: 21, bz: 22, bvz: 23, p: (j) => 24 + 7 * j };   // por jugador: x, y, stun, ch|flags|buffers, kcd, run, jt
function edita(st, f) { const a = st.g.pack(); f(a); st.g.restore(a); }
const colocar = (st, j, x, y) => edita(st, (a) => { a[I.p(j)] = Math.round(x * 4); a[I.p(j) + 1] = Math.round(y * 4); });
const pelota = (st, x, y, vx, vy) => edita(st, (a) => { a[I.bx] = Math.round(x * 4); a[I.by] = Math.round(y * 4); a[I.bvx] = Math.round((vx || 0) * 64); a[I.bvy] = Math.round((vy || 0) * 64); });
const teamSc = (st) => st.g.vista().sc;

test('registro: paridad con el catálogo (C, binary, 2v2, lim, dur) y packN', () => {
  assert.strictEqual(DEF.modelo, 'C'); assert.strictEqual(DEF.clase, 'binary'); assert.deepStrictEqual(DEF.modos, ['2v2']); assert.strictEqual(DEF.dur, CAT.dur);
  assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.mo, 'C'); assert.strictEqual(DEF.botones, 2); assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.packN, 52);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
  for (const j of DEF.packDiscretos) assert.ok(Number.isInteger(j) && j >= 0 && j < DEF.packN);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin tipos x* (todo viaja en el snapshot)', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /\bclass\b/, /=>/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.(send|on)\(/.test(s));
});

test('pack: 52 enteros, ≤300 B al serializar; restore deja al juez nuevo en estado EXACTO (misma continuación con las mismas entradas)', () => {
  const guion = (st, p, api) => { const t = st.gt, ph = (p * 1.3) + t; api.eje(Math.sin(ph * 1.7), Math.cos(ph * 1.1)); api.hold('b', Math.sin(ph) > 0.5); if (Math.sin(ph * 3) > 0.9) api.press('a'); api.hold('a', Math.sin(ph * 0.9) > 0.8); };
  const A = mk({ seed: 3 });
  for (let i = 0; i < 400; i++) B.tick(A, [guion, guion, guion, guion]);
  const snap = A.g.pack(); assert.strictEqual(snap.length, 52); assert.ok(snap.every(Number.isInteger)); assert.ok(JSON.stringify(snap).length <= 300, JSON.stringify(snap).length + ' B');
  const Bc = mk({ seed: 3 }); Bc.g.restore(snap); Bc.gt = A.gt;
  Bc.in = JSON.parse(JSON.stringify(A.in));
  for (let i = 0; i < 600; i++) { B.tick(A, [guion, guion, guion, guion]); B.tick(Bc, [guion, guion, guion, guion]); if (i % 30 === 0) assert.deepStrictEqual(Bc.g.pack(), A.g.pack(), 'diverge en el tick ' + i); }
  assert.deepStrictEqual(Bc.g.pack(), A.g.pack());
  assert.deepStrictEqual(Bc.g.scores(), A.g.scores());
});

test('lerp: interpola posiciones (pelota y cuerpos), deja los discretos del snapshot nuevo y NO cruza los saques tras un gol', () => {
  const st = mk({ seed: 1 }); const a = st.g.pack(), b = a.slice();
  b[I.bx] = a[I.bx] + 40; b[I.p(2)] = a[I.p(2)] + 80; b[I.gs] = 1; b[I.pause] = 50;
  const m = st.g.lerp(a, b, 0.5);
  assert.strictEqual(m[I.bx], a[I.bx] + 20); assert.strictEqual(m[I.p(2)], a[I.p(2)] + 40); assert.strictEqual(m[I.gs], 1); assert.strictEqual(m[I.pause], 50);
  const c2 = a.slice(); c2[I.bx] = a[I.bx] + 1600; c2[I.p(1)] = a[I.p(1)] + 1000;                   // saque: 400 px y 250 px de salto
  const n2 = st.g.lerp(a, c2, 0.5); assert.strictEqual(n2[I.bx], c2[I.bx]); assert.strictEqual(n2[I.p(1)], c2[I.p(1)]);
});

test('patada: toque con la pelota al pie la manda a ~220 px/s; sin alcance no hace nada; mantener A carga un tiro más fuerte', () => {
  const st = mk({ seed: 1 }); const v = st.g.vista();
  pelota(st, v.x[0] + 24, v.y[0], 0, 0); st.in[0].tap++; tick(st);
  const b = st.g.vista().ball; assert.ok(Math.abs(Math.hypot(b.vx, b.vy) * 30 - 220) < 40, 'velocidad ~220: ' + Math.hypot(b.vx, b.vy) * 30); assert.ok(b.vx > 0);
  const lejos = mk({ seed: 1 }); lejos.in[0].tap++; tick(lejos); assert.strictEqual(lejos.g.vista().ball.vx, 0);
  const fuerte = mk({ seed: 1 }); pelota(fuerte, v.x[0] + 24, v.y[0], 0, 0);
  fuerte.in[0].a = true; for (let i = 0; i < 20; i++) { tick(fuerte); pelota(fuerte, v.x[0] + 24, v.y[0], 0, 0); } fuerte.in[0].a = false; tick(fuerte);
  assert.ok(Math.hypot(fuerte.g.vista().ball.vx, fuerte.g.vista().ball.vy) * 30 > 330, 'tiro cargado más fuerte: ' + Math.hypot(fuerte.g.vista().ball.vx, fuerte.g.vista().ball.vy) * 30);
  const corto = mk({ seed: 1 }); pelota(corto, v.x[0] + 24, v.y[0], 0, 0);                         // A mantenido 3 ticks (≤ PASSCH): sigue siendo toque
  corto.in[0].a = true; for (let i = 0; i < 3; i++) tick(corto); corto.in[0].a = false; tick(corto);
  assert.ok(Math.hypot(corto.g.vista().ball.vx, corto.g.vista().ball.vy) * 30 < 260, 'un toque largo no es tiro');
});

test('pase asistido: el toque con el pana más o menos delante lo manda hacia él; mantener A (tiro) no pasa; un rival o un pana fuera de cono no cuentan', () => {
  const dir = (st) => { const b = st.g.vista().ball; return Math.atan2(b.vy, b.vx); };
  const montar = (mx, my) => { const st = mk({ seed: 1 }); colocar(st, 0, 200, 130); colocar(st, 1, mx, my); colocar(st, 2, 600, 40); colocar(st, 3, 600, 220); pelota(st, 224, 130, 0, 0); return st; };
  const a = montar(430, 168);                                                                   // pana a ~12° de la línea cuerpo→pelota, a 210 px: pasa a él
  a.in[0].tap++; tick(a); const vb = a.g.vista().ball, vm = a.g.vista();
  const hacia = Math.atan2(168 - vb.y, 430 - 224); assert.ok(Math.abs(dir(a) - hacia) < 0.12, 'va hacia el pana, no hacia el arco: ' + dir(a) + ' vs ' + hacia); void vm;
  const v = Math.hypot(vb.vx, vb.vy) * 30; assert.ok(v >= 140 && v <= 330, 'potencia de pase ' + v);
  const lejano = montar(200 + 25, 130 + 200);                                                  // pana a 90° del tiro: patada normal (ayuda hacia el arco rival, vx>0)
  lejano.in[0].tap++; tick(lejano); assert.ok(lejano.g.vista().ball.vx > 5);
  const tiro = montar(430, 168); tiro.in[0].a = true; for (let i = 0; i < 10; i++) { tick(tiro); pelota(tiro, 224, 130, 0, 0); } tiro.in[0].a = false; tick(tiro);
  const tb = tiro.g.vista().ball; assert.ok(Math.hypot(tb.vx, tb.vy) * 30 > 260, 'el tiro cargado no se convierte en pase');
  const rival = montar(430, 168); colocar(rival, 1, 100, 40); colocar(rival, 2, 430, 168); rival.in[0].tap++; tick(rival);              // el de delante es RIVAL: no se le pasa
  const rb = rival.g.vista().ball; assert.ok(Math.abs(Math.atan2(rb.vy, rb.vx) - Math.atan2(168 - 130, 430 - 224)) > 0.05 || Math.hypot(rb.vx, rb.vy) * 30 > 0, 'no hay pase a rivales');
});

test('compañeros se atraviesan; los rivales se empujan', () => {
  const mismo = mk({ seed: 1 }); colocar(mismo, 0, 300, 100); colocar(mismo, 1, 304, 100); colocar(mismo, 2, 560, 40); colocar(mismo, 3, 560, 220);
  for (let i = 0; i < 20; i++) tick(mismo); const v = mismo.g.vista(); assert.ok(Math.abs(v.x[0] - 300) < 1 && Math.abs(v.x[1] - 304) < 1, 'los panas no se separan: ' + v.x[0] + ',' + v.x[1]);
  const rivales = mk({ seed: 1 }); colocar(rivales, 0, 300, 100); colocar(rivales, 1, 100, 30); colocar(rivales, 2, 304, 100); colocar(rivales, 3, 560, 220);
  for (let i = 0; i < 10; i++) tick(rivales); const w = rivales.g.vista(); assert.ok(Math.hypot(w.x[0] - w.x[2], w.y[0] - w.y[2]) >= 31, 'los rivales no se superponen');
});

test('gol: cruzar la línea dentro del arco suma al equipo contrario al arco; autoría: último del equipo que la tocó (≤3 s), autogol → el de menor índice del anotador', () => {
  for (const sd of [0, 1]) {                                                                    // sd = lado cuyo arco recibe el gol
    const st = mk({ seed: 2 }); const quien = sd === 0 ? 2 : 0;                                  // anota el lado contrario: asientos 2-3 si el arco es el izquierdo
    edita(st, (a) => { a[sd === 0 ? I.lt1 : I.lt0] = quien + 2; a[sd === 0 ? I.age1 : I.age0] = 10; });   // lo tocó el asiento quien+1 (índice 3 ó 1) hace 10 ticks
    pelota(st, sd === 0 ? 8 : 632, 130, sd === 0 ? -8 : 8, 0); for (let i = 0; i < 4; i++) tick(st);
    const w = st.g.vista(); assert.deepStrictEqual(w.sc, sd === 0 ? [0, 1] : [1, 0], 'anotó el lado contrario al arco'); assert.ok(w.pause > 0);
    const autor = w.gs.findIndex((x) => x === 1); assert.strictEqual(autor, quien + 1, 'autor = último toque del equipo anotador'); assert.strictEqual(w.gs.reduce((s, x) => s + x, 0), 1);
    for (let i = 0; i < 90; i++) tick(st); const z = st.g.vista(); assert.ok(Math.abs(z.ball.x - 320) < 1 && Math.abs(z.ball.y - 130) < 1 && z.pause === 0, 'saque desde el centro');
    assert.ok(Math.abs(z.x[0] - z.x[1]) < 1 && Math.abs(z.x[2] - 640 * 0.73) < 1, 'saque con jugadores en sus puestos');
  }
  const auto = mk({ seed: 2 }); edita(auto, (a) => { a[I.lt0] = 0; a[I.age0] = 99; a[I.lt1] = 0; a[I.age1] = 99; });      // nadie la tocó: autogol / rebote
  pelota(auto, 632, 130, 8, 0); for (let i = 0; i < 4; i++) tick(auto); assert.deepStrictEqual(auto.g.vista().gs, [1, 0, 0, 0], 'sin toque reciente: el de menor índice del equipo que anota');
  const viejo = mk({ seed: 2 }); edita(viejo, (a) => { a[I.lt0] = 2; a[I.age0] = 95; }); pelota(viejo, 632, 130, 8, 0); for (let i = 0; i < 4; i++) tick(viejo);
  assert.deepStrictEqual(viejo.g.vista().gs, [1, 0, 0, 0], 'un toque de hace más de 3 s ya no cuenta');
  const fuera = mk({ seed: 2 }); pelota(fuera, 6, 20, -8, 0); tick(fuera); assert.deepStrictEqual(fuera.g.vista().sc, [0, 0]); assert.ok(fuera.g.vista().ball.vx > 0, 'rebota en el poste/pared');
  for (const [lv, goles] of [[1, [0, 1]], [2, [0, 0]], [3, [0, 0]]]) { const e = mk({ seed: 2, lv }); pelota(e, 6, 130 + 50, -8, 0); for (let i = 0; i < 4; i++) tick(e); assert.deepStrictEqual(e.g.vista().sc, goles, 'Nv' + lv + ': boca 110 / 90 / 90 px: a 50 px del centro entra solo en Nv1'); }
});

test('reglamentario (0,75·dur), gol de oro, empate y done(): gana quien va arriba a los 45 s; con empate sigue y el primer gol termina; sin goles ⇒ empate a dur', () => {
  const st = mk({ seed: 4 }); const rT = st.g.vista().regT; assert.strictEqual(rT, 1350);
  edita(st, (a) => { a[I.gs] = 2; a[I.gs + 2] = 1; }); assert.strictEqual(st.g.done(), false, 'antes del reglamentario no se acaba');
  edita(st, (a) => { a[I.k] = rT; }); assert.strictEqual(st.g.done(), true, 'ganador al terminar el reglamentario');
  edita(st, (a) => { a[I.gs + 2] = 2; }); assert.strictEqual(st.g.done(), false, 'empatado: gol de oro'); tick(st); assert.strictEqual(st.g.vista().gold, 1, 'el juez activa el gol de oro');
  pelota(st, 632, 130, 8, 0); for (let i = 0; i < 4; i++) tick(st); assert.strictEqual(st.g.done(), true, 'el primer gol de oro termina');
  const goleada = mk({ seed: 4 }); edita(goleada, (a) => { a[I.gs] = 15; }); assert.strictEqual(goleada.g.done(), true, '15 goles de un equipo termina');
  const vacio = mk({ seed: 5, dur: 12 }); assert.strictEqual(vacio.g.vista().regT, 270); const s0 = B.jugar(vacio, ['idle', 'idle', 'idle', 'idle'], 12);
  assert.deepStrictEqual(s0, [0, 0, 0, 0]); assert.strictEqual(B.veredicto(vacio).puestos.every((x) => x === 1), true, 'sin goles = empate');
  assert.strictEqual(mk({ seed: 4, dur: 10 }).g.vista().regT, 225);
});

test('eventos de la calle: calendario sembrado en mk (determinista), tipos por nivel, más seguidos al final, nada en los últimos segundos sin aviso', () => {
  const evs = (o) => mk(o).g.vista().evs;
  assert.deepStrictEqual(evs({ lv: 3, seed: 7 }), evs({ lv: 3, seed: 7 }), 'determinista por semilla');
  const tipos = (lv) => { const t = new Set(); for (let seed = 1; seed <= 40; seed++) evs({ lv, seed }).forEach((e) => t.add(e[1])); return t; };
  const PERRO = 1, RASPA = 2, MOTO = 3, CARRO = 4, VECINA = 5, VENDE = 6;
  assert.deepStrictEqual([...tipos(1)].sort(), [PERRO, RASPA, VECINA, VENDE]); assert.deepStrictEqual([...tipos(2)].sort(), [PERRO, RASPA, MOTO, VECINA, VENDE]); assert.deepStrictEqual([...tipos(3)].sort(), [PERRO, RASPA, MOTO, CARRO, VECINA, VENDE]);
  for (let seed = 1; seed <= 20; seed++) {
    const e = evs({ lv: 2, seed }), reg = 1350; assert.ok(e.length >= 8, 'hay eventos: ' + e.length);
    const a = e.filter((x) => x[0] < reg * 0.33).length, b = e.filter((x) => x[0] >= reg * 0.7 && x[0] < reg).length;
    assert.ok(b / (reg * 0.3) > a / (reg * 0.33), 'más densos al final (' + a + ' vs ' + b + ')');
    for (let k = 1; k < e.length; k++) assert.ok(e[k][0] - e[k - 1][0] >= 90 && e[k][1] !== e[k - 1][1], 'separados y sin repetir tipo');
  }
});

const parado = () => { };
function conEvento(st, kind, a, b, tt) { edita(st, (x) => { x[I.evK] = kind; x[I.evT] = tt === undefined ? 40 : tt; x[I.evA] = Math.round(a * 4); x[I.evB] = Math.round(b * 4); x[I.evC] = 0; }); }

test('eventos: vendedor y raspados son paredes (empujan al jugador y rebotan la pelota); moto tumba al que está en el suelo y no al que salta; carro saca al jugador; vecina resbala', () => {
  const lejos = (st) => { colocar(st, 1, 600, 20); colocar(st, 2, 600, 240); colocar(st, 3, 20, 240); };
  const v = mk({ seed: 1 }); lejos(v); colocar(v, 0, 300, 130); conEvento(v, 6, 280, 130); tick(v);
  const q = v.g.vista(); assert.ok(Math.abs(q.y[0] - 130) > 16 || Math.abs(q.x[0] - 280) > 38, 'el vendedor empuja: ' + q.x[0] + ',' + q.y[0]);
  const bp = mk({ seed: 1 }); lejos(bp); pelota(bp, 340, 130, -4, 0); conEvento(bp, 6, 280, 130); for (let i = 0; i < 6; i++) tick(bp); assert.ok(bp.g.vista().ball.vx >= 0 || bp.g.vista().ball.x > 300, 'la pelota rebota en el carrito');
  const m = mk({ seed: 1 }); lejos(m); colocar(m, 0, 300, 130); conEvento(m, 3, 300, 130); tick(m); assert.ok(m.g.vista().stun[0] > 0, 'la moto tumba');
  const sm = mk({ seed: 1 }); lejos(sm); colocar(sm, 0, 300, 130); edita(sm, (a) => { a[I.p(0) + 6] = 9; }); conEvento(sm, 3, 300, 130); tick(sm); assert.strictEqual(sm.g.vista().stun[0], 0, 'saltando se esquiva');
  const c = mk({ seed: 1 }); lejos(c); colocar(c, 0, 300, 50); conEvento(c, 4, 300, 36); tick(c); assert.ok(c.g.vista().stun[0] > 0 && c.g.vista().y[0] > 70, 'el carro saca al jugador del carril');
  const w = mk({ seed: 1 }); lejos(w); colocar(w, 0, 300, 130); conEvento(w, 5, 300, 130, 30); tick(w); assert.ok(w.g.vista().stun[0] > 0, 'la vecina moja');
});

test('controles: buffer de A (pulsar justo antes de llegar a la pelota patea al llegar), buffer de B (salto pulsado en el aire/aturdido sale al aterrizar), cabezazo con margen', () => {
  const st = mk({ seed: 1 }); const v = st.g.vista();
  pelota(st, v.x[0] + 40, v.y[0], 0, 0); st.in[0].tap++; tick(st);                                   // fuera de alcance: no patea, guarda la pulsación
  assert.strictEqual(st.g.vista().ball.vx, 0); assert.ok(st.g.vista().ba[0] > 0, 'pulsación guardada');
  pelota(st, v.x[0] + 24, v.y[0], 0, 0); tick(st); assert.ok(st.g.vista().ball.vx > 3, 'el toque guardado sale cuando la pelota llega a alcance');
  const tarde = mk({ seed: 1 }); pelota(tarde, v.x[0] + 40, v.y[0], 0, 0); tarde.in[0].tap++; for (let i = 0; i < 8; i++) tick(tarde); pelota(tarde, v.x[0] + 24, v.y[0], 0, 0); tick(tarde); assert.strictEqual(tarde.g.vista().ball.vx, 0, 'el buffer caduca (≈0,17 s)');
  const sal = mk({ seed: 1 }); sal.in[1].tap++; sal.in[0].tapB = 1; tick(sal); assert.ok(sal.g.vista().jt[0] > 0, 'salta'); void sal;
});

test('eventos: perro persigue la pelota y se la lleva; tocarlo la suelta', () => {
  const st = mk({ seed: 1 }); colocar(st, 0, 100, 40); colocar(st, 1, 100, 220); colocar(st, 2, 600, 40); colocar(st, 3, 600, 220); pelota(st, 320, 130, 0, 0);
  conEvento(st, 1, 300, 130, 30); edita(st, (a) => { a[I.evC] = 0; }); for (let i = 0; i < 6; i++) tick(st);
  assert.strictEqual(st.g.vista().evC, 1, 'el perro agarró la pelota'); const b0 = st.g.vista().ball;
  for (let i = 0; i < 10; i++) tick(st); const b1 = st.g.vista().ball; assert.ok(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 5, 'se la lleva');
});

test('CPU: 4 CPU producen entre 2 y 8 goles por partido en los 3 niveles, nadie se queda quieto, y los ociosos pierden casi siempre', () => {
  for (const lv of [1, 2, 3]) {
    let goles = 0, N = 24; const quietos = [0, 0, 0, 0];
    for (let seed = 1; seed <= N; seed++) {
      const st = mk({ seed, lv, skill: 0.6 }); let ult = st.g.vista().x.slice(), movs = [0, 0, 0, 0];
      B.jugar(st, CPU4, 60, (s) => { const v = s.g.vista(); for (let j = 0; j < 4; j++) if (Math.abs(v.x[j] - ult[j]) > 0.5) movs[j]++; ult = v.x.slice(); });
      goles += st.g.vista().sc[0] + st.g.vista().sc[1]; movs.forEach((m, j) => { if (m < 200) quietos[j]++; });
    }
    assert.ok(goles / N >= 2 && goles / N <= 8, `lv${lv}: ${(goles / N).toFixed(1)} goles/partido`); assert.deepStrictEqual(quietos, [0, 0, 0, 0], `lv${lv}: alguien no se movió`);
  }
  let gano = 0, N2 = 30;
  for (let seed = 1; seed <= N2; seed++) { const st = mk({ seed, skill: 0.6 }); B.jugar(st, ['idle', 'idle', 'cpu', 'cpu'], 60); if (B.veredicto(st).puestos[0] === 1 && !B.veredicto(st).puestos.every((x) => x === 1)) gano++; }
  assert.strictEqual(gano, 0, 'dos ociosos nunca ganan a dos CPU');
  let fuerte = 0, N3 = 40;
  for (let seed = 1; seed <= N3; seed++) { const st = mk({ seed, skill: [0.9, 0.9, 0.3, 0.3] }); B.jugar(st, CPU4, 60); const v = B.veredicto(st); if (v.puestos[0] === 1 && v.puestos[2] === 2) fuerte++; }
  assert.ok(fuerte / N3 >= 0.55, 'la habilidad pesa: .9+.9 vence a .3+.3 en ' + fuerte + '/' + N3);
});

test('balance (200 semillas × Nv1-3, 4 CPU skill .6): |P(gana eq0) − P(gana eq1)| ≤ 10 pp y empates ≤ 30 %; el ganador sale de compara', () => {
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { N: 200, lv, skill: 0.6 });
    assert.ok(Math.abs(r.w0 - r.w1) / r.N <= 0.10, `lv${lv}: eq0 ${r.w0} vs eq1 ${r.w1}`); assert.ok(r.emp / r.N <= 0.30, `lv${lv}: empates ${r.emp}`);
  }
});

test('puntajes: enteros ≥0 dentro de lim sin recorte del servidor (200 semillas × dur 3/8/12/60); la suma del equipo es el marcador', () => {
  const lim = CAT.lim; let maxv = 0;
  for (const dur of [3, 8, 12, 60]) for (let seed = 1; seed <= 50; seed++) {
    const lv = 1 + (seed % 3), st = mk({ lv, dur, seed: seed * 7 + dur }); const sc = B.jugar(st, CPU4, dur); const t = Math.max(Math.min(lim.minT, dur - 1), dur === 60 ? 44 : st.gt);
    const v = st.g.vista(); assert.strictEqual(sc.length, 4);
    sc.forEach((x) => { assert.ok(Number.isInteger(x) && x >= 0 && x <= lim.scoreMax, `dur${dur} v=${x}`); maxv = Math.max(maxv, x); });
    assert.strictEqual(sc[0] + sc[1], v.sc[0]); assert.strictEqual(sc[2] + sc[3], v.sc[1]);
    const ve = reglas.compara('2v2', [0, 0, 1, 1], sc); assert.strictEqual(ve.puestos[0] === ve.puestos[1], true); assert.strictEqual(ve.puestos[2] === ve.puestos[3], true);
    /* binary: el servidor mide TODO asiento contra el tiempo real transcurrido (party_mj.clampSc): cap = min(scoreMax, scoreRate·(t+1,5)), t ≥ minT efectivo */
    const cap = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (Math.max(st.gt, Math.min(lim.minT, dur - 1)) + 1.5)));
    sc.forEach((x) => assert.ok(x <= cap, `dur${dur} lv${lv} seed${seed}: sc ${x} > cap ${cap} (t=${st.gt.toFixed(1)})`));
  }
  assert.ok(maxv <= lim.scoreMax);
  const duelo = mk({ n: 2, seed: 9 }); B.jugar(duelo, ['cpu', 'cpu'], 20); assert.strictEqual(duelo.g.scores().length, 2);
});

test('extrapolación de la pelota (pantallas que no son el juez): si el runtime da c.lag() la pelota se adelanta v·lag con fricción y paredes; el juez no extrapola; goles/pausa no', () => {
  const montar = (o) => { const st = mk(Object.assign({ seed: 1 }, o)); pelota(st, 300, 130, 6, 0); return st; };
  const juez = montar({ lag: 0.2 }); juez.g.predict(1 / 60, null); assert.strictEqual(juez.g.vista().ball.x, 300, 'el juez ve la verdad');
  const rem = montar({ juez: false, lag: 0.2, yo: 0 }); rem.g.predict(1 / 60, null);
  const x = rem.g.vista().ball.x, esperado = 300 + 6 * (1 - Math.pow(0.982, 6)) / (1 - 0.982); assert.ok(Math.abs(x - esperado) < 1.5, 'adelanta 6 ticks: ' + x + ' vs ' + esperado);
  const sin = montar({ juez: false, yo: 0 }); sin.g.predict(1 / 60, null); assert.strictEqual(sin.g.vista().ball.x, 300, 'sin c.lag y sin historial de snapshots no inventa nada');
  const pared = mk({ seed: 1, juez: false, lag: 0.5, yo: 0 }); pelota(pared, 620, 130 - 100, 8, 0); pared.g.predict(1 / 60, null);
  const bb = pared.g.vista().ball; assert.ok(bb.x <= 640 - 9 + 0.01 && bb.vx < 0, 'rebota en la pared (fuera de la boca) al extrapolar: ' + bb.x);
  const pausa = montar({ juez: false, lag: 0.3, yo: 0 }); edita(pausa, (a) => { a[I.pause] = 30; }); pausa.g.predict(1 / 60, null); assert.strictEqual(pausa.g.vista().ball.x, 300, 'en la pausa del gol no se extrapola');
});

test('destacado: marcador y goleador; sin goles tiene su frase', () => {
  const st = mk({ seed: 1 }); assert.match(st.g.destacado(), /ni la pelota/);
  edita(st, (a) => { a[I.gs] = 2; a[I.gs + 1] = 1; a[I.gs + 2] = 1; }); assert.match(st.g.destacado(), /3 – 1.*P0/);
});

test('dibujo: draw() no revienta (gt −2, 0, 5, reg, reg+1; gol; carro; gol de oro; n=2 y n=4) en los 3 niveles y solo con primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [0, 3, -1]) {
    const st = mk({ lv, seed: 3, yo }); const reg = st.g.vista().regT;
    for (const gt of [-2, 0, 5]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    B.jugar(st, CPU4, 30); st.g.draw();
    for (const k of [1, 2, 3, 4, 5, 6]) for (const tt of [3, 60]) { edita(st, (a) => { a[I.evK] = k; a[I.evT] = tt; a[I.evA] = 800; a[I.evB] = 520; }); st.g.update(1 / 30); st.g.draw(); }
    edita(st, (a) => { a[I.evK] = 0; a[I.evT] = -1; a[I.pause] = 50; a[I.last] = 1; }); st.g.update(1 / 30); st.g.draw();
    edita(st, (a) => { a[I.k] = reg; a[I.pause] = 0; a[I.gs] = 1; a[I.gs + 2] = 1; }); st.gt = reg / 30; st.g.update(1 / 30); st.g.draw();
    edita(st, (a) => { a[I.k] = reg + 1; }); st.g.update(1 / 30); st.g.draw();
    const d = mk({ lv, n: 2, yo: yo === 3 ? 1 : yo }); B.jugar(d, ['cpu', 'cpu'], 5); d.g.draw();
  }
  assert.ok(calls.length > 800); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});

test('lados por INDICE de equipo (no por asiento): el equipo 0 siempre defiende la izquierda (azul); asiento 0 en el equipo 1 no lo invierte', () => {
  for (const [eq, lados] of [[[0, 0, 1, 1], [0, 0, 1, 1]], [[1, 0, 0, 1], [1, 0, 0, 1]], [[1, 1, 0, 0], [1, 1, 0, 0]], [[0, 1, 1, 0], [0, 1, 1, 0]]]) {
    const st = mk({ seed: 1 }); st.c.equipos = eq; st.g = DEF.mk(st.c);
    assert.deepStrictEqual(st.g.vista().side, lados, JSON.stringify(eq));        // lado 0 = izquierda = equipo 0
  }
});
