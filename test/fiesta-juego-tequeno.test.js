/* f_tequeno: humo sin red. Carga el juego contra un FIESTA.LIVE mínimo y un contexto `c` falso (todos los asientos míos) y comprueba reglas,
   CPU, límites, determinismo y dibujo. La red (puestos iguales a 50/150/300 ms, juez muerto, etc.) está en test/fiesta-live-tequeno.test.js.
   La cocina con tres sartenes (echar / voltear / sacar), combos, pedidos y chispas reemplazó al «mantén y suelta» (27 oct 2026). */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-tequeno.js');

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC];
  require(SRC);
  return defs.f_tequeno;
}
const DEF = cargar();
const LIM = DEF.limites;

function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 30, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), held: new Array(n).fill(false), ax: new Array(n).fill(0), g: null };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: o.w || 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: (p) => st.held[p],
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return v; },
    eje: (p) => ({ x: st.ax[p], y: 0 }), cpu: new Array(n).fill(false), skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null, ev: () => {}, out: () => {}, send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
const DT = 1 / 30;
const V = (st) => st.g.vista();
function paso(st, k) { for (let i = 0; i < (k || 1); i++) { st.gt += DT; st.g.update(DT); } }
function pulsa(st, p) { st.taps[p || 0]++; paso(st); }
function listo(st, gt) { st.gt = gt - DT; st.g.update(DT); st.gt = gt; }
/* espera hasta que el lado de la sartén j llegue a su punto + off (s) y pulsa: el juicio cae a menos de medio cuadro del objetivo */
function pulsaEn(st, j, off) {
  for (let i = 0; i < 400; i++) {
    const pa = V(st).pan[0][j], tq = V(st).T[pa.tq % 64], g = pa.s === 2 ? tq[1] : tq[0];
    if (pa.u + DT >= g + (off || 0) - DT / 2) break;
    paso(st);
  }
  pulsa(st, 0);
}
/* una sartén libre de chispas entre t0 y t1 (en la cocina del jugador 0, que arranca en la del medio) */
function sartenSegura(st, t0, t1) {
  const S = V(st).S;
  for (const j of [1, 0, 2]) if (!S.some(([t, sj]) => sj === j && t >= t0 - 0.3 && t <= t1 + 0.3)) return j;
  return -1;
}
function irA(st, j) { for (let i = 0; i < 60 && Math.abs(V(st).x[0] - j) > 1e-6; i++) { st.ax[0] = j > V(st).x[0] ? 1 : -1; paso(st); if (Math.abs(V(st).x[0] - j) < 0.25) st.ax[0] = 0; } st.ax[0] = 0; paso(st, 2); }
/* partida: 'cpu' = g.ai (con su habilidad), 'idle' = no toca nada */
function jugar(st, modos, dur) {
  const g = st.g, n = st.c.n;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: (b, v) => { st.held[p] = !!v; }, eje: (x) => { st.ax[p] = x; } });
  while (st.gt < dur) {
    st.gt += DT;
    for (let p = 0; p < n; p++) if (modos[p] === 'cpu') g.ai(p, DT, api(p));
    g.update(DT);
  }
  return g.scores();
}

test('registro: parámetros de la ficha (A, rank, 30 s, stick + 1 botón)', () => {
  assert.strictEqual(DEF.modelo, 'A'); assert.strictEqual(DEF.clase, 'rank'); assert.deepStrictEqual(DEF.modos, ['ffa']);
  assert.strictEqual(DEF.dur, 30); assert.strictEqual(DEF.botones, 1); assert.strictEqual(DEF.stick, true);
  assert.deepStrictEqual(LIM, { scoreMax: 300, scoreRate: 10, minT: 27, finTemprano: 0 });
  assert.deepStrictEqual(DEF.cuerpo, ['pts', 'x', 'p0', 'p1', 'p2', 'k', 'cal', 'nn', 'cb', 'qm', 'ped', 'oi', 'op']);
  assert.ok(DEF.discretos.indexOf('x') < 0 && DEF.discretos.indexOf('p0') >= 0, 'x se interpola, las sartenes no');
  assert.ok(DEF.carta.obj && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES5, sin mensajes propios', () => {
  const s = fs.readFileSync(SRC, 'utf8'), sinCom = s.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /=>/, /\blet\s/, /\bconst\s/])
    assert.ok(!re.test(sinCom), String(re));
  assert.ok(!/c\.send\(\s*'/.test(s), 'el juego no manda mensajes propios (solo el cuerpo o)');
});

test('mundo: tequeños, fuego, apagones, gags, chispas y pedidos idénticos con la misma semilla (sin depender de n) y distintos con otra', () => {
  for (const lv of [1, 2, 3]) {
    const a = mkCtx({ seed: 7, lv }).g.vista(), b = mkCtx({ seed: 7, lv, n: 2 }).g.vista();
    assert.strictEqual(a.hashT, b.hashT);
    assert.deepStrictEqual([a.fuegoAt, a.apag, a.gags, a.S, a.O], [b.fuegoAt, b.apag, b.gags, b.S, b.O]);
    assert.notStrictEqual(a.hashT, mkCtx({ seed: 8, lv }).g.vista().hashT);
  }
});

test('niveles: Nv1 sin fuego ni gordos ni apagón y pocas chispas; Nv2 con fuego; Nv3 con apagón, gordos y chispas dobles', () => {
  const v1 = mkCtx({ lv: 1 }).g.vista(), v2 = mkCtx({ lv: 2 }).g.vista(), v3 = mkCtx({ lv: 3, seed: 3 }).g.vista();
  assert.ok(v1.fuegoAt > 1e8 && !v1.apag.length && !v1.fat.some(Boolean));
  assert.ok(v2.fuegoAt > 10 && v2.fuegoAt < 20 && !v2.apag.length);
  assert.strictEqual(v3.apag.length, 2); assert.ok(v3.fat.some(Boolean));
  assert.ok(v1.T.every(([a, b]) => a >= 1.55 && a <= 2.25 && b >= 1.55 && b <= 2.25));
  assert.ok(v1.S.length >= 5 && v1.S.length < v2.S.length && v2.S.length < v3.S.length, `chispas ${v1.S.length}/${v2.S.length}/${v3.S.length}`);
  assert.ok(v3.S.some(([t], i) => i > 0 && v3.S[i - 1][0] === t), 'Nv3 trae chispas dobles');
  assert.ok(v1.O.every(([n]) => n >= 2 && n <= 3) && v3.O.some(([n]) => n === 4));
});

test('echar, voltear y sacar: lado perfecto 4, dorado 3; quemado 1, crudo 0; el combo suma desde el segundo dorado', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const st = mkCtx({ n: 1, seed }); listo(st, 0);
    const j = sartenSegura(st, 0, 12); if (j < 0) continue;
    irA(st, j);
    pulsa(st); assert.strictEqual(V(st).pan[0][j].s, 1, 'echó');
    pulsaEn(st, j, 0); assert.strictEqual(V(st).pan[0][j].s, 2); assert.strictEqual(V(st).pan[0][j].c1, 4, 'lado 1 perfecto');
    pulsaEn(st, j, 0); assert.strictEqual(V(st).pan[0][j].s, 0); assert.strictEqual(V(st).nn[0], 1);
    assert.strictEqual(V(st).pts[0], 8, 'dos lados perfectos = 8'); assert.strictEqual(V(st).cb[0], 1);
    paso(st, 6); pulsa(st);
    pulsaEn(st, j, 0.12); assert.strictEqual(V(st).pan[0][j].c1, 3, 'lado dorado');
    pulsaEn(st, j, 0.12);
    const bono = V(st).ped[0] ? 2 * V(st).O[0][0] + 2 : 0;                // si el pedido era de 2, ya se cumplió
    assert.strictEqual(V(st).pts[0], 8 + 6 + 1 + bono, 'segundo dorado seguido: +1 de combo'); assert.strictEqual(V(st).cb[0], 2);
    paso(st, 6); pulsa(st);
    pulsaEn(st, j, 0.35);                                            // quemado leve: 1
    paso(st, 6); pulsa(st);                                          // sacar crudo al toque: 0
    assert.strictEqual(V(st).pts[0], 15 + bono + 1, 'quemado + crudo = 1'); assert.strictEqual(V(st).cb[0], 0, 'tequeño malo rompe el combo');
    return;
  }
  assert.fail('ninguna semilla con una sartén sin chispas');
});

test('pedido: el que completa N dorados a tiempo suma 2N+2; si se acaba la paciencia se va sin restar', () => {
  let hecho = false;
  for (let seed = 1; seed <= 300 && !hecho; seed++) {
    const st = mkCtx({ n: 1, seed }); const v = V(st);
    if (v.O[0][0] !== 2 || v.T[0][0] + v.T[0][1] + v.T[1][0] + v.T[1][1] > 7.3) continue;
    listo(st, 0);
    const j = sartenSegura(st, 0, 9); if (j < 0) continue;
    irA(st, j);
    for (let k = 0; k < 2; k++) { pulsa(st); pulsaEn(st, j, 0); pulsaEn(st, j, 0); paso(st, 5); }
    assert.strictEqual(V(st).ped[0], 1, 'seed ' + seed); assert.strictEqual(V(st).oi[0], 1);
    assert.strictEqual(V(st).pts[0], 8 + 9 + 6, 'dos perfectos (8 + 8+1) + pedido de 2 (6)');
    hecho = true;
  }
  assert.ok(hecho, 'hay una semilla con pedido de 2 alcanzable');
  const st = mkCtx({ n: 1, seed: 5 }); listo(st, 0); const tl = V(st).O[0][1];
  paso(st, Math.ceil((tl + 0.2) * 30));
  assert.strictEqual(V(st).oi[0], 1); assert.strictEqual(V(st).ped[0], 0); assert.strictEqual(V(st).pts[0], 0);
});

test('carbón: si no lo volteas se quema solo (0 pts, combo roto) y la sartén queda sucia 1 s', () => {
  const st = mkCtx({ n: 1, seed: 4 }); listo(st, 0); pulsa(st);
  const v0 = V(st), j = Math.round(v0.x[0]), g = v0.T[0][0];
  paso(st, Math.ceil((g + 0.17 + 0.9 + 0.1) * 30));
  assert.strictEqual(V(st).pan[0][j].s, 3); assert.strictEqual(V(st).nn[0], 1); assert.strictEqual(V(st).pts[0], 0);
  if (V(st).stun[0] <= 0) { pulsa(st); assert.strictEqual(V(st).pan[0][j].s, 3, 'sucia: A no hace nada'); }
  paso(st, 32); assert.strictEqual(V(st).pan[0][j].s, 0, 'limpia otra vez');
});

test('chispa: pararse frente a la sartén que escupe = quemón (0,9 s sin moverse ni actuar); al lado no pasa nada', () => {
  const st = mkCtx({ n: 2, seed: 2, lv: 2 }), S = V(st).S, [t, j] = S[0];
  const otra = (j + 1) % 3;
  listo(st, 0);
  st.ax[0] = j > 1 ? 1 : j < 1 ? -1 : 0; st.ax[1] = otra > 1 ? 1 : otra < 1 ? -1 : 0; paso(st, 8); st.ax.fill(0); paso(st, 4);
  assert.strictEqual(V(st).x[0], j); assert.strictEqual(V(st).x[1], otra);
  while (st.gt < t + DT) paso(st);
  assert.strictEqual(V(st).hits[0], 1); assert.strictEqual(V(st).hits[1], 0);
  assert.ok(V(st).stun[0] > 0.8);
  st.ax[0] = j === 2 ? -1 : 1; st.taps[0]++; paso(st, 5);
  assert.strictEqual(V(st).x[0], j, 'no se mueve'); assert.strictEqual(V(st).pan[0][j].s, 0, 'no echa');
  st.ax[0] = 0; paso(st, 30); st.taps[0]++; paso(st); assert.strictEqual(V(st).pan[0][j].s, 1, 'pasado el quemón vuelve a cocinar');
});

test('stick: empuja y se mueve de sartén en sartén; al soltar se acomoda hacia donde iba', () => {
  const st = mkCtx({ n: 1, seed: 1 }); listo(st, 0);
  assert.strictEqual(V(st).x[0], 1);
  st.ax[0] = 1; paso(st, 2); st.ax[0] = 0; paso(st, 6); assert.strictEqual(V(st).x[0], 2, 'un toque a la derecha = una sartén');
  st.ax[0] = -1; paso(st, 12); st.ax[0] = 0; paso(st, 4); assert.strictEqual(V(st).x[0], 0, 'empujado hasta el borde');
  st.ax[0] = 0.2; paso(st, 6); assert.strictEqual(V(st).x[0], 0, 'zona muerta');
});

test('machacar A sin mirar casi no da puntos', () => {
  const st = mkCtx({ n: 1, seed: 2 }); listo(st, 0);
  for (let i = 0; i < 30 * 28; i++) pulsa(st);
  assert.ok(V(st).pts[0] <= 10, 'machacar: ' + V(st).pts[0]);
});

test('fuego (Nv2+): desde fuegoAt la fritura corre x1,35', () => {
  const st = mkCtx({ n: 1, lv: 2, seed: 9, dur: 30 }), v = V(st); listo(st, v.fuegoAt + 0.1);
  pulsa(st); const j = Math.round(V(st).x[0]), c0 = V(st).pan[0][j].u; paso(st);
  const ac = V(st).ACC.find((a) => a[1] === j && st.gt >= a[0] && st.gt < a[0] + a[3]), fa = ac ? (ac[2] === 1 ? 1.7 : 0) : 1;
  assert.ok(Math.abs((V(st).pan[0][j].u - c0) - DT * 1.35 * V(st).ramp * fa) < 1e-9, 'x1,35 y la rampa de la hora pico');
});

test('corte: en los últimos 1,2 s no se puntúa ni se mueve nada', () => {
  const st = mkCtx({ n: 1, seed: 3, dur: 10 }); listo(st, 8.0); pulsa(st);
  const j = Math.round(V(st).x[0]), g = V(st).T[0][0];
  while (st.gt < 8.9) paso(st);
  const u = V(st).pan[0][j].u; paso(st, 3); assert.strictEqual(V(st).pan[0][j].u, u, 'la fritura se congela');
  pulsa(st); assert.strictEqual(V(st).pan[0][j].s, 1); assert.strictEqual(V(st).pts[0], 0); void g;
});

test('CPU: ocioso nunca gana ni empata con una CPU activa (3 niveles, 3 habilidades); CPU buena > CPU floja; tope del bot casi perfecto', () => {
  for (const lv of [1, 2, 3]) for (const skill of [0.35, 0.6, 0.85]) for (let seed = 1; seed <= 3; seed++) {
    const st = mkCtx({ n: 4, lv, seed, skill }); const sc = jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 30);
    assert.strictEqual(sc[0], 0); assert.ok(Math.min(sc[1], sc[2], sc[3]) > 0, `lv${lv} sk${skill} s${seed}: ${sc}`);
  }
  for (const lv of [1, 2, 3]) {
    let hi = 0, lo = 0, mx = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const a = jugar(mkCtx({ n: 1, lv, seed, skill: 0.9 }), ['cpu'], 30)[0], b = jugar(mkCtx({ n: 1, lv, seed, skill: 0.35 }), ['cpu'], 30)[0];
      const m = jugar(mkCtx({ n: 1, lv, seed, skill: 1 }), ['cpu'], 30)[0];
      hi += a; lo += b; mx = Math.max(mx, m);
      assert.ok(m >= 40, `lv${lv} s${seed}: CPU perfecta ${m}`);
    }
    assert.ok(hi > lo * 1.2, `lv${lv}: skill .9 (${hi}) debe superar a .35 (${lo})`);
    assert.ok(mx <= LIM.scoreMax * 0.8, `lv${lv}: la CPU perfecta llega a ${mx}, el tope es ${LIM.scoreMax}`);
  }
});

test('CPU: esquiva chispas según su habilidad, nunca pulsa más de 7 veces por segundo y espera >= 0,12 s antes de echar', () => {
  let hHi = 0, hLo = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const a = mkCtx({ n: 1, lv: 3, seed, skill: 0.95 }); jugar(a, ['cpu'], 30); hHi += V(a).hits[0];
    const b = mkCtx({ n: 1, lv: 3, seed, skill: 0.3 }); jugar(b, ['cpu'], 30); hLo += V(b).hits[0];
  }
  assert.ok(hHi < hLo, `quemones: hábil ${hHi} vs floja ${hLo}`);
  const st = mkCtx({ n: 1, seed: 6, skill: 1 }), g = st.g; let pres = 0, primer = null;
  const api = { press() { pres++; if (primer === null) primer = st.gt; st.taps[0]++; }, hold() {}, eje: (x) => { st.ax[0] = x; } };
  st.gt = -DT; g.update(DT); st.gt = 0;
  for (let i = 0; i < 30 * 28; i++) { st.gt += DT; g.ai(0, DT, api); g.update(DT); }
  assert.ok(pres <= 7 * 28 && pres >= 20, 'pulsaciones ' + pres); assert.ok(primer >= 0.12, 'primera ' + primer);
});

test('puntajes dentro de límites (enteros, 0..scoreMax, <= scoreRate·(t+1,5)); dur=3 no revienta', () => {
  for (const dur of [3, 4, 10, 30]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv, skill: 1 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'idle'], dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= LIM.scoreMax && v <= LIM.scoreRate * (dur + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('remotos: el cuerpo entrante marca puntos, sartenes, quemón y resultado; alHum/alCpu no revientan; el cuerpo propio es de enteros', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c;
  const cuerpos = { 1: { pts: 22, x: 200, p0: 0, p1: 1 * 100000 + 3 * 1000 + 70, p2: 2 * 100000 + 2 * 1000 + 15, k: 4, cal: 4, nn: 2, cb: 2, qm: 0, ped: 1, oi: 1, op: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 5; st.g.update(DT);
  let v = V(st); assert.strictEqual(v.pts[1], 22); assert.strictEqual(v.k[1], 4); assert.strictEqual(v.x[1], 2); assert.strictEqual(v.nn[1], 2);
  assert.deepStrictEqual([v.pan[1][1].s, v.pan[1][1].tq], [1, 3]); assert.ok(Math.abs(v.pan[1][1].u - 0.7 - DT * v.ramp) < 1e-9, 'sigue friendo entre cuerpos');
  assert.strictEqual(v.pan[1][2].s, 2); assert.strictEqual(v.ped[1], 1);
  cuerpos[1] = Object.assign({}, cuerpos[1], { p1: 300000, qm: 1, nn: 3, cal: 5 }); st.g.update(DT);
  v = V(st); assert.strictEqual(v.pan[1][1].s, 3); assert.strictEqual(v.hits[1], 1); assert.ok(v.stun[1] > 0);
  st.g.alCpu(1); st.g.alHum(1, { pts: 30, x: 100, p0: 0, p1: 0, p2: 0, k: 5, cal: 3, nn: 4, cb: 0, qm: 1, ped: 1, oi: 2, op: 0 }); assert.strictEqual(st.g.scores()[1], 30);
  const cu = st.g.cuerpo(0); DEF.cuerpo.forEach((k) => assert.ok(Number.isInteger(cu[k]), k));
  assert.ok(/tequeño|ni un/.test(st.g.destacado()));
});

test('dibujo 2D: draw() no revienta con gt<0, fritura, chispas, apagón, fuego, corte; en 340x600 y 800x600 (primitivas simuladas)', () => {
  const calls = [], usadas = new Set();
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { usadas.add(nm); calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  globalThis.BUS = { AP: { CAST: { mama: {}, abuela: {} } } };
  for (const w of [340, 372, 800]) for (const lv of [1, 2, 3]) for (const n of [2, 3, 4]) {
    const st = mkCtx({ n, lv, w });
    for (const gt of [-2, 0.2, 2, 5]) { st.gt = gt; st.g.update(DT); st.g.draw(); }
    const v = V(st);
    for (const gt of [v.fuegoAt > 1e8 ? 8 : v.fuegoAt + 0.5, v.apag.length ? v.apag[0] + 0.5 : 9, v.gags[0] + 0.5, v.S[1][0] - 0.3, 29.8]) { st.gt = gt; st.g.update(DT); st.g.draw(); }
    jugar(st, ['cpu', 'cpu', 'idle', 'cpu'].slice(0, n), 30); st.g.draw();
  }
  assert.ok(calls.length > 500); assert.deepStrictEqual([...usadas].sort(), ['ell', 'line', 'poly', 'rr', 'txt']);
});

test('curva: accidentes (aceite x1,7 / sin gas congela y no deja echar), sartenes que se mueven, 2 pedidos y encargos especiales al final', () => {
  const v1 = mkCtx({ lv: 1 }).g.vista(), v2 = mkCtx({ lv: 2 }).g.vista(), v3 = mkCtx({ lv: 3 }).g.vista();
  assert.ok(v1.ACC.length < v2.ACC.length && v2.ACC.length < v3.ACC.length && !v1.MV.length && v2.MV.length < v3.MV.length);
  assert.ok(v1.ACC.every(([t]) => t >= 14) && v3.OE.some(([, ty]) => ty === 1) && v3.OE.some(([, ty]) => ty === 2));
  const st = mkCtx({ n: 1, lv: 3, seed: 3 }), v = V(st), ga = v.ACC.find((a) => a[2] === 2), gr = v.ACC.find((a) => a[2] === 1);
  listo(st, ga[0] + 0.1); st.ax[0] = ga[1] > 1 ? 1 : ga[1] < 1 ? -1 : 0;
  const perm = V(st).perm; const slot = perm[ga[1]];
  st.ax[0] = slot > 1 ? 1 : slot < 1 ? -1 : 0; paso(st, 8); st.ax[0] = 0; paso(st, 4);
  if (V(st).x[0] === slot && !V(st).ACC.some((a) => a !== ga && a[1] === ga[1] && a[0] <= st.gt && st.gt < a[0] + a[3])) { pulsa(st); assert.strictEqual(V(st).pan[0][ga[1]].s, 0, 'sin gas no se echa'); }
  assert.ok(gr[3] > 3);
  let perms = new Set(); for (let t = 0; t < 30; t += 0.5) { listo(mkCtx({ lv: 3, seed: 3 }), 0); } void perms;
  const sm = mkCtx({ n: 1, lv: 3, seed: 3 }); listo(sm, sm.g.vista().MV[0][0] + 0.1);
  assert.deepStrictEqual(V(sm).perm, V(sm).MV[0][1]); assert.notDeepStrictEqual(V(sm).perm, [0, 1, 2]);
});
