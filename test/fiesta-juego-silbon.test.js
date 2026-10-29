/* f_silbon (1v3, modelo B): humo sin red. Contexto `c` falso (banco docs/style-lab/pruebas/fiesta-silbon-bench.js: todos los asientos son «míos»,
   ev se devuelve por eco local y c.claim concede al instante por claimOk/concede). Comprueba registro, lint, escenario idéntico por semilla, silbido
   (revela 1 s, enfriamiento 3 s, idempotente), mangos por claim (uno a la vez, se entregan en el rancho), atrapado por contacto (lo juzga la víctima, +20 px
   si el Silbón llega por la red, chinchorro 6 s y el mango se cae), linterna, la luz del rancho, puntaje/veredicto por compara(), CPU de los dos lados,
   balance del solo (38-52 % en 200 semillas por nivel), ociosos contra CPU activas, límites y dibujo. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-silbon-bench.js');
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-silbon.js');
const DEF = B.cargar(), CAT = B.CAT, { mkCtx, jugar, ganaSolo } = B;
const TODOS_CPU = ['cpu', 'cpu', 'cpu', 'cpu'];
const SOLO = 0, T1 = 1;
function paso(st) { st.gt += 1 / 30; st.g.update(1 / 30); }
function hasta(st, seg, fn) { const t1 = st.gt + seg; while (st.gt < t1) { if (fn) fn(st); paso(st); } }
function guia(st, p, x, y, um) {                       // pone el stick de p hacia (x,y); true si ya llegó
  const v = st.g.vista(), dx = x - v.x[p], dy = y - v.y[p], d = Math.hypot(dx, dy);
  if (d <= (um || 3)) { st.axes[p] = { x: 0, y: 0 }; return true; }
  st.axes[p] = { x: dx / d, y: dy / d }; return false;
}
function ir(st, p, x, y, max) { let t = 0; while (!guia(st, p, x, y) && t < (max || 12)) { paso(st); t += 1 / 30; } st.axes[p] = { x: 0, y: 0 }; paso(st); }
const evs = (st, ty) => st.evs.filter((e) => e.ty === ty);
const nuevo = (o) => { const st = mkCtx(DEF, Object.assign({ lv: 1, seed: 7, n: 4 }, o)); st.gt = 0.001; return st; };
const lejos = (st) => { st.c.mio = () => true; };

test('registro: paridad con el catálogo y parámetros de la ficha', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'binary'); assert.deepStrictEqual(DEF.modos, ['1v3']);
  assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.dur, 45);
  assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.live, 1);
  assert.strictEqual(CAT.mo, DEF.modelo); assert.strictEqual(CAT.cl, DEF.clase); assert.deepStrictEqual(CAT.m, DEF.modos); assert.strictEqual(CAT.dur, DEF.dur);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
  assert.ok(DEF.carta.roles.solo.obj && DEF.carta.roles.solo.como && DEF.carta.roles.trio.obj && DEF.carta.roles.trio.como);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin tipos x* ni reservados', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /=>/, /\blet\b/, /\bconst\b/, /`/]) assert.ok(!re.test(s), String(re));
  const tipos = (s.match(/c\.(send|on)\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1'));
  assert.ok(tipos.every((t) => /^x[a-z0-9]{1,11}$/.test(t)), tipos.join());
  const evt = (s.match(/c\.ev\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1')).filter((x, i, a) => a.indexOf(x) === i).sort();
  assert.deepStrictEqual(evt, ['atrapado', 'entrega', 'got', 'silbo', 'toque']);
});

test('el escenario sale de la semilla: misma semilla => mismos árboles y calendario de mangos; más árboles por nivel', () => {
  for (const lv of [1, 2, 3]) {
    const a = nuevo({ lv, seed: 11 }).g.vista(), b = nuevo({ lv, seed: 11, n: 3, solo: 2 }).g.vista(), c2 = nuevo({ lv, seed: 12 }).g.vista();
    assert.deepStrictEqual(a.trees, b.trees); assert.deepStrictEqual(a.sched, b.sched); assert.notDeepStrictEqual(a.sched, c2.sched);
    assert.ok(a.sched.length >= a.need + 4, 'sobran mangos'); assert.ok(a.sched.every((m) => Math.hypot(m[1] - a.lamp[0], m[2] - a.lamp[1]) > 100), 'ningún mango pegado al rancho');
  }
  const t = [1, 2, 3].map((lv) => nuevo({ lv }).g.vista().trees.length);
  assert.ok(t[0] < t[1] && t[1] < t[2], 'más árboles por nivel: ' + t);
});

test('silbido: revela al trío 1 s, enfriamiento 3 s, ev idempotente por k y validado', () => {
  const st = nuevo();
  st.taps[SOLO]++; paso(st); assert.strictEqual(evs(st, 'silbo').length, 0, 'antes del primer segundo no se silba');
  hasta(st, 1.1); st.taps[SOLO]++; paso(st);
  assert.strictEqual(evs(st, 'silbo').length, 1); assert.ok(st.g.vista().rv, 'revela');
  st.taps[SOLO]++; paso(st); assert.strictEqual(evs(st, 'silbo').length, 1, 'en enfriamiento no');
  hasta(st, 1.0); assert.ok(!st.g.vista().rv, 'la revelación dura 1 s');
  const e0 = evs(st, 'silbo')[0]; st.g.onEv('silbo', SOLO, e0.d, st.gt); assert.strictEqual(st.g.vista().silbos, 1, 'el mismo k otra vez no cuenta');
  for (const mal of [null, {}, { k: 9, x: NaN, y: 1 }, { k: 'a', x: 1, y: 1 }]) assert.doesNotThrow(() => st.g.onEv('silbo', SOLO, mal, st.gt));
  st.g.onEv('silbo', T1, { k: 5, x: 1, y: 1 }, st.gt); assert.strictEqual(st.g.vista().silbos, 1, 'solo silba el Silbón');
  hasta(st, 2.1); st.taps[SOLO]++; paso(st); assert.strictEqual(evs(st, 'silbo').length, 2, 'recargado a los 3 s');
});

test('mangos: se recogen por claim (uno a la vez), se llevan al bombillo del rancho y cuentan una vez', () => {
  const st = nuevo({ n: 2, yo: T1, seed: 21 });
  ir(st, SOLO, 428, 260);                                               // el Silbón se va a una esquina (que no estorbe)
  const v0 = st.g.vista(), m = v0.mangos[0];
  ir(st, T1, m[1], m[2]);
  assert.strictEqual(st.g.vista().lleva[T1], m[0], 'lo lleva'); assert.strictEqual(st.claims.length, 1);
  const otro = st.g.vista().mangos[0]; ir(st, T1, otro[1], otro[2]);
  assert.strictEqual(st.g.vista().lleva[T1], m[0], 'no carga dos'); assert.strictEqual(st.claims.length, 1); assert.strictEqual(evs(st, 'atrapado').length, 0);
  ir(st, T1, v0.lamp[0], v0.lamp[1] - 10);
  assert.strictEqual(st.g.vista().ent, 1); assert.strictEqual(st.g.vista().lleva[T1], null);
  const e = evs(st, 'entrega')[0]; st.g.onEv('entrega', T1, e.d, st.gt); st.g.onEv('entrega', T1, { n: 99, id: 'm1' }, st.gt);
  assert.strictEqual(st.g.vista().ent, 1, 'idempotente y sin saltos');
  assert.strictEqual(st.g.claimOk(m[0], T1, st.gt * 1000), false, 'un mango entregado no se vuelve a conceder');
  assert.strictEqual(st.g.claimOk('nada', T1, st.gt * 1000), false); assert.strictEqual(st.g.claimOk(otro[0], SOLO, st.gt * 1000), false, 'el Silbón no recoge');
  const sc0 = st.g.vista().sched, fut = sc0[sc0.length - 1]; assert.ok(fut[3] > st.gt + 1); assert.strictEqual(st.g.claimOk(fut[0], T1, st.gt * 1000), false, 'un mango que aún no salió no');
});

test('atrapado: lo juzga la víctima por contacto; chinchorro 6 s, el mango se cae y otro lo puede recoger; n idempotente', () => {
  const st = nuevo({ n: 2, yo: T1, seed: 5 });
  const m = st.g.vista().mangos[0];
  ir(st, T1, m[1], m[2]); assert.ok(st.g.vista().lleva[T1]);
  hasta(st, 0.5);
  ir(st, SOLO, st.g.vista().x[T1], st.g.vista().y[T1], 8);
  assert.strictEqual(evs(st, 'atrapado').length, 1); const ev = evs(st, 'atrapado')[0];
  assert.strictEqual(ev.d.id, m[0]); assert.strictEqual(st.g.vista().frz[T1], 1); assert.strictEqual(st.g.vista().lleva[T1], null);
  const v = st.g.vista(); assert.ok(Math.hypot(v.x[T1] - v.lamp[0], v.y[T1] - v.lamp[1]) < 40, 'al chinchorro del rancho');
  assert.ok(v.mangos.some((x) => x[0] === 'r' + T1 + '_1') || v.caidos === 1, 'el mango se cayó donde lo agarraron');
  st.g.onEv('atrapado', T1, ev.d, st.gt); assert.strictEqual(st.g.vista().atr, 1, 'el mismo n no cuenta dos veces');
  st.axes[T1] = { x: 0, y: -1 }; hasta(st, 5.5); assert.strictEqual(st.g.vista().frz[T1], 1, 'quieto 6 s');
  hasta(st, 0.7); assert.strictEqual(st.g.vista().frz[T1], 0);
  hasta(st, 0.5); assert.ok(st.g.vista().y[T1] < v.y[T1] - 10, 'y vuelve a moverse');
  assert.strictEqual(evs(st, 'atrapado').length, 1, 'sin dobles atrapadas');
});

test('lag: el toque que ve el Silbón lo confirma la víctima contra SU posición en ese instante, con tolerancia que crece con el atraso (hasta +20 px)', () => {
  const run = (atraso, dx) => {
    const st = nuevo({ n: 2, yo: T1, seed: 9 });
    ir(st, T1, 220, 120); hasta(st, 0.6);
    const v = st.g.vista(), t0 = st.gt - atraso, h = { x: v.x[T1], y: v.y[T1] };   // quieto: su posición en t0 es la de ahora
    st.c.mio = (p) => p !== SOLO;                                                  // el Silbón llega por la red
    st.g.onEv('toque', SOLO, { v: T1, x: Math.round(h.x + dx), y: Math.round(h.y), t: Math.round(t0 * 1000) }, st.gt);
    return evs(st, 'atrapado').length;
  };
  assert.strictEqual(run(0, 30), 0, 'sin atraso, a 30 px: no (el mismo toque que en el banco)');
  assert.strictEqual(run(0, 12), 1, 'sin atraso, a 12 px: sí');
  assert.strictEqual(run(0.25, 30), 1, 'con 0,25 s de atraso, a 30 px: sí (tolerancia +20)');
  assert.strictEqual(run(0.25, 40), 0, 'más allá de +20 px: no');
  assert.strictEqual(run(3, 5), 0, 'un toque viejísimo no cuenta');
  const st = nuevo({ n: 2, yo: T1, seed: 9 }); st.c.mio = (p) => p !== SOLO;
  for (const mal of [null, {}, { v: 9, x: 1, y: 1, t: 1 }, { v: T1, x: NaN, y: 1, t: 1 }, { v: SOLO, x: 1, y: 1, t: 1 }]) assert.doesNotThrow(() => st.g.onEv('toque', SOLO, mal, st.gt));
  st.g.onEv('toque', T1, { v: T1, x: 220, y: 40, t: 0 }, st.gt); assert.strictEqual(evs(st, 'atrapado').length, 0, 'solo el Silbón manda toques');
});

test('el cuerpo remoto se juega donde está AHORA: imagen + velocidad × edad (tm)', () => {
  const st = nuevo({ n: 2, yo: T1, seed: 9 }); hasta(st, 1);
  let x = 100; st.c.mio = (p) => p !== SOLO;
  st.c.remoto = (p) => (p === SOLO ? { x: x, y: 100, l: 0, st: 0, tm: Math.round((st.gt - 0.3) * 20) } : null);
  hasta(st, 1, () => { x += 120 / 30; });                                          // la imagen va a 120 px/s y tiene 0,3 s de edad
  const v = st.g.vista();
  assert.ok(Math.abs(v.x[SOLO] - (x + 36)) < 8, 'adelantado ~36 px: ' + v.x[SOLO] + ' vs imagen ' + x);
});

test('el bombillo del rancho: el Silbón no entra y ahí el trío está a salvo', () => {
  const st = nuevo({ n: 2, yo: T1, seed: 3 });
  const L = st.g.vista().lamp;
  ir(st, T1, L[0], L[1]); ir(st, SOLO, L[0], L[1], 6);
  const v = st.g.vista();
  assert.ok(Math.hypot(v.x[SOLO] - L[0], v.y[SOLO] - L[1]) >= 57, 'el Silbón se queda afuera de la luz');
  assert.strictEqual(evs(st, 'atrapado').length, 0);
});

test('linterna: A enciende 2 s (va en el cuerpo `l`) y luego recarga', () => {
  const st = nuevo({ n: 2, yo: T1, seed: 4 });
  hasta(st, 1.1); st.taps[T1]++; paso(st);
  assert.strictEqual(st.g.cuerpo(T1).l, 1); hasta(st, 2.1); assert.strictEqual(st.g.cuerpo(T1).l, 0);
  st.taps[T1]++; paso(st); assert.strictEqual(st.g.cuerpo(T1).l, 0, 'en recarga');
  hasta(st, 4); st.taps[T1]++; paso(st); assert.strictEqual(st.g.cuerpo(T1).l, 1);
  assert.deepStrictEqual(Object.keys(st.g.cuerpo(T1)).sort(), DEF.cuerpo.slice().sort());
  assert.ok(JSON.stringify(st.g.cuerpo(T1)).length < 80);
});

test('puntaje aditivo: solo 2 por mango que falta, trío 1 fijo; el solo gana si falta alguno (compara 1v3 del reductor)', () => {
  const eq = [0, 1, 1, 1];
  for (let e = 0; e <= 7; e++) {
    const sc = [2 * (7 - e), 1, 1, 1], pu = REGLAS.compara('1v3', eq, sc).puestos;
    assert.strictEqual(pu[0] === 1 && pu[1] === 2, e < 7, 'entregados=' + e);
  }
  assert.deepStrictEqual(nuevo().g.scores(), [14, 1, 1, 1]);
  assert.deepStrictEqual(mkCtx(DEF, { n: 2, solo: 1, yo: 0, seed: 3 }).g.scores(), [1, 14]);
});

test('CPU: solo CPU contra trío ocioso gana el solo; solo ocioso contra trío CPU lo pierde (los 3 niveles)', () => {
  for (const lv of [1, 2, 3]) {
    let a = 0, b = 0; const N = 40;
    for (let seed = 1; seed <= N; seed++) {
      const x = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(x, ['cpu', 'idle', 'idle', 'idle'], 45); if (ganaSolo(x)) a++;
      const y = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(y, ['idle', 'cpu', 'cpu', 'cpu'], 45); if (ganaSolo(y)) b++;
    }
    assert.strictEqual(a, N, 'lv' + lv + ' trío ocioso: gana el solo ' + a + '/' + N);
    assert.ok(b <= 2, 'lv' + lv + ' solo ocioso gana ' + b + '/' + N);
  }
});

test('BALANCE: con CPU de igual habilidad el solo gana 38-52 % (200 semillas por nivel)', () => {
  const res = {};
  for (const lv of [1, 2, 3]) res[lv] = B.medir(DEF, { lv, N: 200, skill: 0.6, seed0: 0 }).win;
  console.log('  balance solo (skill .6):', JSON.stringify(res));
  for (const lv of [1, 2, 3]) assert.ok(res[lv] >= 0.38 && res[lv] <= 0.52, 'lv' + lv + ' solo gana ' + (res[lv] * 100).toFixed(0) + ' %');
});

test('simetría de asientos: el solo en el asiento 0 o en el 2 gana parecido (≤ 8 puntos)', () => {
  const r = B.ventajaJuez(DEF, { lv: 1, N: 200, skill: 0.6 });
  assert.ok(r.dif <= 0.08, JSON.stringify(r));
});

test('puntajes dentro de límites del catálogo y enteros; dur=3,8,45 no revienta', () => {
  for (const dur of [3, 8, 45]) for (const lv of [1, 2, 3]) {
    const st = mkCtx(DEF, { lv, dur, seed: dur + lv }); const sc = jugar(st, TODOS_CPU, dur);
    const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
    if (st.g.done()) assert.ok(st.gt >= CAT.lim.minT, 'fin temprano después de minT');
  }
});

test('dibujo: draw() no revienta con gt<0, silbido, linterna, atrapados, vistas de solo/trío/espectador y los 3 niveles (solo primitivas del lab)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) for (const yo of [0, 1, -1]) {
    const st = mkCtx(DEF, { lv, n: 4, seed: 3, yo });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, TODOS_CPU, 45); st.g.draw();
    const st2 = mkCtx(DEF, { lv, n: 2, yo: 0 }); st2.gt = 5; st2.g.update(1 / 30); st2.g.draw();
  }
  assert.ok(calls.length > 200);
  assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
  const st = nuevo(); assert.ok(typeof st.g.hudChip(0) === 'string' && typeof st.g.hudChip(1) === 'string' && typeof st.g.destacado() === 'string');
});
