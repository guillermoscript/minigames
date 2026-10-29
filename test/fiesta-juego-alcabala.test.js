/* f_alcabala (1v3, modelo B): humo sin red. Contexto `c` falso (banco docs/style-lab/pruebas/fiesta-alcabala-bench.js: todos los asientos son «míos»,
   ev se devuelve por eco local y c.send('xalto') se entrega a c.on). Comprueba registro, lint, escenario idéntico por semilla, destello determinista,
   reglas (luz 0,5 s => parado; agachado junto a un escondite => invisible; solo se cruza por un paso), puntaje/veredicto por compara(), CPU de los dos lados,
   balance del solo (38-52 % en 200 semillas por nivel), ociosos contra CPU activas y límites. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-alcabala-bench.js');
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-alcabala.js');
const DEF = B.cargar(), CAT = B.CAT, { mkCtx, jugar, ganaSolo } = B;
const TODOS_CPU = ['cpu', 'cpu', 'cpu', 'cpu'];
const SOLO = 0, T1 = 1;
const api = (st, p) => ({ press: () => { st.taps[p]++; }, hold: (b, v) => { st.holds[p] = !!v; }, eje: (x, y) => { st.axes[p] = { x, y }; } });
/* un paso de simulación con las entradas ya puestas en st.axes / st.holds / st.taps */
function paso(st) { st.gt += 1 / 30; st.g.update(1 / 30); }
function hasta(st, seg, fn) { const t1 = st.gt + seg; while (st.gt < t1) { if (fn) fn(st); paso(st); } }
function guia(st, p, x, y, um) {                       // pone el stick de p hacia (x,y); true si ya llegó
  const v = st.g.vista(), px = p === SOLO ? v.aim[0] : v.x[p], py = p === SOLO ? v.aim[1] : v.y[p], dx = x - px, dy = y - py, d = Math.hypot(dx, dy);   // el solo se guía por su punto de mira (la luz lo sigue 0,45 s después)
  if (d <= (um || 5)) { st.axes[p] = { x: 0, y: 0 }; return true; }
  st.axes[p] = { x: dx / d, y: dy / d }; return false;
}
function ir(st, p, x, y, max) { let t = 0; while (!guia(st, p, x, y) && t < (max || 12)) { paso(st); t += 1 / 30; } paso(st); if (p === SOLO) hasta(st, 0.6); }   // para el solo se espera a que la luz llegue al mira

const paradas = (st) => st.evs.filter((e) => e.ty === 'para').length, pasos = (st) => st.evs.filter((e) => e.ty === 'paso').length;
const nuevo = (o) => { const st = mkCtx(DEF, Object.assign({ lv: 1, seed: 7, n: 4 }, o)); st.gt = 0.001; return st; };

test('registro: paridad con el catálogo y parámetros de la ficha', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'binary'); assert.deepStrictEqual(DEF.modos, ['1v3']);
  assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true); assert.strictEqual(DEF.dur, 40);
  assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.live, 1);
  assert.strictEqual(CAT.mo, DEF.modelo); assert.strictEqual(CAT.cl, DEF.clase); assert.deepStrictEqual(CAT.m, DEF.modos);
  assert.ok(DEF.carta.roles.solo.obj && DEF.carta.roles.trio.como);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, solo tipos x* propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/]) assert.ok(!re.test(s), String(re));
  const tipos = (s.match(/c\.(send|on)\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1'));
  assert.ok(tipos.length > 0 && tipos.every((t) => /^x[a-z0-9]{1,11}$/.test(t)), tipos.join());
});

test('el escenario sale de la semilla: misma semilla => mismos escondites y pasos en todas las pantallas; niveles 1-3 distintos', () => {
  for (const lv of [1, 2, 3]) {
    const a = nuevo({ lv, seed: 11 }).g.vista(), b = nuevo({ lv, seed: 11, n: 3, solo: 2 }).g.vista(), c2 = nuevo({ lv, seed: 12 }).g.vista();
    assert.deepStrictEqual(a.covers, b.covers); assert.notDeepStrictEqual(a.covers, c2.covers);
    assert.strictEqual(!!a.dog, lv === 3, 'el perro solo en el nivel 3');
  }
  assert.ok(nuevo({ lv: 1 }).g.vista().cov > nuevo({ lv: 2 }).g.vista().cov, 'el nivel 2 es más abierto');
});

test('el ¡ALTO! es determinista, cabe en x* (≤200 B), gana el que cae primero y el enfriamiento se respeta', () => {
  const A = nuevo(), Bc = nuevo({ n: 3, solo: 2 });
  hasta(A, 3.2);                                                       // pasa el primer enfriamiento (3 s)
  A.taps[SOLO]++; paso(A);
  const al = () => A.sent.filter((m) => m.t === 'xalto');
  assert.ok(al().length >= 1); assert.ok(A.sent.every((m) => /^x[a-z0-9]{1,11}$/.test(m.t)) && A.sent.every((m) => JSON.stringify({ q: 0, d: m.d }).length <= 200));
  Bc.gt = 3.3; Bc.handlers.xalto(al()[0].d, 2); Bc.handlers.xalto(al()[0].d, 2);   // duplicado ignorado
  assert.strictEqual(Bc.g.vista().altos.length, 1);
  Bc.handlers.xalto({ i: 0, x: 50, y: 50, tl: al()[0].d.tl - 100 }, 1);             // otro que cae antes: gana
  assert.strictEqual(Bc.g.vista().altos[0][3] * 1000, al()[0].d.tl - 100);
  Bc.handlers.xalto({ i: 0, x: 50, y: 50, tl: al()[0].d.tl + 500 }, 1);             // otro que cae después: se ignora
  assert.strictEqual(Bc.g.vista().altos[0][3] * 1000, al()[0].d.tl - 100);
  A.taps[SOLO]++; paso(A); assert.strictEqual(A.g.vista().altos.length, 1, 'sin enfriamiento no hay segundo destello');
  for (const mal of [null, {}, { i: 99, x: 1, y: 1, tl: 1 }, { i: 0, x: NaN, y: 1, tl: 1 }, { i: 1.5, x: 1, y: 1, tl: 1 }]) assert.doesNotThrow(() => Bc.handlers.xalto(mal, 1));
  assert.strictEqual(Bc.g.vista().altos.length, 1);
  hasta(A, 5); A.taps[SOLO]++; paso(A); assert.strictEqual(A.g.vista().altos.length, 2, 'cuando se recarga (4 s tras caer el destello) sí');
  assert.ok(al().filter((m) => m.d.i === 0).length >= 2 && al().filter((m) => m.d.i === 0).length <= 4, 'el primer destello se reenvía un par de veces, no más');
});

test('regla de la luz: 0,5 s encima y te paran; agachado junto a un escondite la luz no te ve', () => {
  const run = (agacha) => {
    const st = nuevo({ n: 2, solo: SOLO, yo: T1, seed: 21 });
    const cv = st.g.vista().covers.filter((k) => k[1] > 150)[0] || st.g.vista().covers[0];
    ir(st, SOLO, 24, 42);                                                 // la luz se va a una esquina
    ir(st, T1, cv[0], cv[1] + 6);                                         // el miembro del trío llega al escondite
    if (agacha) st.holds[T1] = true;
    hasta(st, 0.6, (s) => guia(s, SOLO, cv[0], cv[1], 3));               // la luz se le pone encima
    hasta(st, 2.5, (s) => guia(s, SOLO, cv[0], cv[1], 3));
    return st;
  };
  assert.strictEqual(paradas(run(true)), 0, 'agachado y escondido: nadie lo para');
  const st = run(false); assert.ok(paradas(st) >= 1, 'de pie bajo la luz: lo paran'); assert.strictEqual(st.g.vista().paradas[T1], paradas(st));
});

test('parado: vuelve al inicio, queda quieto 1 s y puede volver a intentarlo; la cuenta n es idempotente', () => {
  const st = nuevo({ n: 2, solo: SOLO, yo: T1, seed: 5 });
  ir(st, SOLO, 220, 262);                                                 // la luz cae sobre el inicio del trío
  hasta(st, 1.2);
  assert.ok(paradas(st) >= 1);
  const ev = st.evs.filter((e) => e.ty === 'para')[0];
  st.g.onEv('para', T1, ev.d, st.gt);                                     // el mismo n otra vez: no cuenta
  assert.strictEqual(st.g.vista().paradas[T1], paradas(st)); assert.strictEqual(st.g.vista().totalPar, paradas(st));
  assert.ok(st.g.vista().y[T1] >= 255, 'de vuelta al inicio');
});

test('el paso: solo se cruza la raya por uno de los dos pasos; fuera de ellos la hilera de conos lo impide', () => {
  const ok = nuevo({ n: 2, solo: SOLO, yo: T1, seed: 31 });
  /* los pasos no se exportan: se encuentran probando: se sube por una columna y se mira si cruza */
  const cruza = (x) => { const st = nuevo({ n: 2, solo: SOLO, yo: T1, seed: 31 }); ir(st, SOLO, 424, 290); ir(st, T1, x, 200); hasta(st, 5, (s) => { s.axes[T1] = { x: 0, y: -1 }; }); return pasos(st) > 0; };
  assert.ok(!cruza(14), 'en la esquina no hay paso');
  let hay = false; for (let x = 100; x <= 380; x += 6) if (cruza(x)) { hay = true; break; }
  assert.ok(hay, 'en alguna columna sí se cruza (por un paso)');
  assert.strictEqual(ok.g.vista().nPas, 0);
});

test('puntaje aditivo: solo 10 por cada miembro que no pasó, trío 15 fijo; el solo gana si pasaron <=1 (compara 1v3 del reductor)', () => {
  const eq = [0, 1, 1, 1];
  for (let pas = 0; pas <= 3; pas++) {
    const sc = [(3 - pas) * 10, 15, 15, 15], pu = REGLAS.compara('1v3', eq, sc).puestos;
    assert.strictEqual(pu[0] === 1 && pu[1] === 2, pas <= 1, 'pasaron=' + pas);
  }
  const st = nuevo(); assert.deepStrictEqual(st.g.scores(), [30, 15, 15, 15]);
  const s2 = mkCtx(DEF, { n: 2, solo: 1, yo: 0, seed: 3 }); assert.deepStrictEqual(s2.g.scores(), [5, 10], 'con un solo miembro del trío: 1 pase basta (W=1)');
});

test('CPU: solo CPU contra trío ocioso gana el solo; solo ocioso contra trío CPU lo pierde (los 3 niveles)', () => {
  for (const lv of [1, 2, 3]) {
    let a = 0, b = 0; const N = 40;
    for (let seed = 1; seed <= N; seed++) {
      const x = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(x, ['cpu', 'idle', 'idle', 'idle'], 40); if (ganaSolo(x)) a++;
      const y = mkCtx(DEF, { lv, seed, skill: 0.6 }); jugar(y, ['idle', 'cpu', 'cpu', 'cpu'], 40); if (ganaSolo(y)) b++;
    }
    assert.strictEqual(a, N, 'lv' + lv + ' trío ocioso: gana el solo ' + a + '/' + N);
    assert.ok(b <= 4, 'lv' + lv + ' solo ocioso gana ' + b + '/' + N);
  }
});

test('BALANCE: con CPU de igual habilidad el solo gana ~50 % (40-56 %, 200 semillas por nivel)', () => {
  const res = {};
  for (const lv of [1, 2, 3]) res[lv] = B.medir(DEF, { lv, N: 200, skill: 0.6, seed0: 0 }).win;
  console.log('  balance solo (skill .6):', JSON.stringify(res));
  for (const lv of [1, 2, 3]) assert.ok(res[lv] >= B.LO && res[lv] <= B.HI, 'lv' + lv + ' solo gana ' + (res[lv] * 100).toFixed(0) + ' %');
});

test('puntajes dentro de límites del catálogo y enteros; dur=3,8,40 no revienta', () => {
  for (const dur of [3, 8, 40]) for (const lv of [1, 2, 3]) {
    const st = mkCtx(DEF, { lv, dur, seed: dur + lv }); const sc = jugar(st, TODOS_CPU, dur);
    const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('dibujo: draw() no revienta con gt<0, destello, pasos y los 3 niveles (solo primitivas del lab)', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx(DEF, { lv, n: 4, seed: 3 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, TODOS_CPU, 40); st.g.draw();
    const st2 = mkCtx(DEF, { lv, n: 2, yo: 0 }); st2.gt = 5; st2.g.update(1 / 30); st2.g.draw();
  }
  assert.ok(calls.length > 200);
  assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});

/* ───── la noche se complica: escalada y eventos (oct 2026) ───── */
test('escalada: 3 fases por fracción de dur (10 y 40 s); los eventos salen de la semilla, iguales en todas las pantallas', () => {
  for (const dur of [10, 40]) {
    const st = mkCtx(DEF, { lv: 1, seed: 9, dur });
    const fz = (t) => { st.gt = t; st.g.update(1 / 30); return st.g.vista().fase; };
    assert.deepStrictEqual([fz(0.2 * dur), fz(0.5 * dur), fz(0.8 * dur)], [0, 1, 2], 'dur ' + dur);
  }
  for (const lv of [1, 2, 3]) {
    const a = nuevo({ lv, seed: 11 }).g.vista(), b = nuevo({ lv, seed: 11, n: 3, solo: 2 }).g.vista(), c2 = nuevo({ lv, seed: 12 }).g.vista();
    assert.deepStrictEqual([a.gandolas, a.apag, a.nieb, a.nCarros], [b.gandolas, b.apag, b.nieb, b.nCarros]);
    assert.notDeepStrictEqual([a.gandolas, a.apag, a.nieb], [c2.gandolas, c2.apag, c2.nieb]);
    assert.ok(a.nCarros >= 5 && a.gandolas.length === 2 && a.apag[1] > a.apag[0] && a.nieb[1] > a.nieb[0], 'lv' + lv + ': hay carros, dos gandolas, apagón y neblina');
  }
  const st = mkCtx(DEF, { lv: 1, seed: 4 }); st.gt = 0.8 * 40; st.g.update(1 / 30);
  assert.ok(st.g.vista().dog, 'en los últimos segundos sueltan al perro también en el nivel 1');
});

test('carro a la revisión: agachado pegado al carro la luz no te ve; sin el carro, en el mismo sitio, sí', () => {
  const op = { n: 2, solo: SOLO, yo: T1, seed: 3 };
  const scan = nuevo(op); let car = null;
  while (!car && scan.gt < 30) { paso(scan); car = scan.g.vista().carros.filter((k) => k[2])[0]; }
  assert.ok(car, 'algún carro se para en la revisión'); const tRev = scan.gt;
  const libre = (x, y) => scan.g.vista().covers.every((k) => Math.hypot(x - k[0], (y - k[1]) * 1.2) > k[2] + 13);   // un lado del carro sin escondite fijo cerca
  const sy = car[1] + 4, sx = libre(car[0] + 34, sy) ? car[0] + 34 : car[0] - 34;
  assert.ok(libre(sx, sy), 'hay un costado del carro sin escondite fijo');
  const st = nuevo(op);
  ir(st, SOLO, 424, 290);
  ir(st, T1, sx, sy, 20);
  st.holds[T1] = true;
  hasta(st, Math.max(0, tRev - st.gt - 0.2));
  const p0 = paradas(st);
  hasta(st, 1.9, (s) => guia(s, SOLO, sx, sy, 3));                     // la luz encima mientras el carro está parado al lado
  assert.strictEqual(paradas(st), p0, 'pegado al carro (agachado): nadie lo para');
  hasta(st, 6, (s) => guia(s, SOLO, sx, sy, 3));                       // el carro se va: el mismo sitio ya no tapa
  assert.ok(paradas(st) > p0, 'sin el carro, en el mismo sitio, lo paran');
});

test('apagón: mientras no hay luz el ¡ALTO! no prende; cuando vuelve, sí', () => {
  const st = nuevo({ n: 2, solo: SOLO, yo: T1, seed: 8 }), ap = st.g.vista().apag;
  hasta(st, ap[0] + 0.1 - st.gt);
  st.taps[SOLO]++; paso(st);
  const n0 = st.g.vista().altos.filter((a) => a[3] >= ap[0]).length;
  assert.strictEqual(n0, 0, 'sin luz no hay destello');
  hasta(st, ap[1] + 0.1 - st.gt); st.taps[SOLO]++; paso(st);
  assert.ok(st.g.vista().altos.filter((a) => a[3] >= ap[1]).length >= 1, 'volvió la luz: ¡ALTO!');
});

test('gandola: su sombra tapa la luz aunque estés de pie; cuando pasa, te ven', () => {
  const st = nuevo({ n: 2, solo: SOLO, yo: T1, seed: 6 }), gd = st.g.vista().gandolas[0], px = 220, py = gd[1] + 34;
  const tC = gd[0] + (220 + 90 + 10) / 80;                             // la gandola pasa por el centro
  ir(st, SOLO, 424, 290); ir(st, T1, px, py);
  hasta(st, tC - 0.8 - st.gt, (s) => guia(s, SOLO, 424, 290));
  const p0 = paradas(st);
  hasta(st, 1.5, (s) => guia(s, SOLO, px, py, 3));
  assert.strictEqual(paradas(st), p0, 'en la sombra de la gandola: nadie lo para');
  hasta(st, 4, (s) => { guia(s, SOLO, px, py, 3); s.axes[T1] = { x: 0, y: 0 }; });
  assert.ok(paradas(st) > p0, 'pasó la gandola: lo ven');
});
