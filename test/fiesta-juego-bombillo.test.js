/* f_bombillo (FFA survival, modelo B): humo sin red. Contexto `c` falso con todos los asientos míos (eco local de ev). Comprueba registro, lint, rondas deterministas,
   telegrafía (≥1,5 s entre apagarse y caer), la luz se muda, caída propia con kk = tick de apertura, saltico que cruza huecos, empujón juzgado por la víctima,
   Don Corte en espiral (Nv3), CPU, ociosos, límites del catálogo, remotos y dibujo. La red va en test/fiesta-live-bombillo.test.js.
   NOTA: el catálogo trae f_bombillo sin live/lim: aquí se completa EN MEMORIA con la línea que debe ir al catálogo. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-bombillo.js');
const LINEA = { g: 'f_bombillo', m: ['ffa'], cl: 'survival', dur: 45, mo: 'B', live: 1, lim: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 } };
const CAT = require('../docs/style-lab/fiesta-reglas.js').CATALOGO.filter((x) => x.g === 'f_bombillo')[0];
Object.assign(CAT, LINEA);

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC]; require(SRC);
  return defs.f_bombillo;
}
const DEF = cargar();
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 45, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false), skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => true, mio: () => true, remoto: () => null,
    ev: (ty, d, p) => { st.evs.push({ ty, d, p, at: st.gt }); if (st.g && st.g.onEv) st.g.onEv(ty, p === undefined ? c.yo : p, d, st.gt); },
    out: (p, kk) => c.ev('out', { kk: kk === undefined ? Math.floor(st.gt * 30) : kk }, p),
    send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
function jugar(st, modos, hasta, sinFin) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, lim = hasta || c.dur;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); else st.axes[p] = { x: 0, y: 0 }; }
    g.update(dt);
    if (!sinFin && st.gt >= Math.min(3, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur || st.gt >= lim) break;
  }
  return g.scores();
}
const TW = 80, TH = 54, centro = (k) => ({ x: (k % 7 + 0.5) * TW, y: (Math.floor(k / 7) + 0.5) * TH });
const ir = (tx, ty) => (s, p, dt, api) => { const v = s.g.vista(), dx = tx - v.x[p], dy = ty - v.y[p]; api.eje(Math.abs(dx) > 4 ? Math.sign(dx) : 0, Math.abs(dy) > 4 ? Math.sign(dy) : 0); };
const segs = (R) => R.safe.map((s, k) => (s ? k : -1)).filter((k) => k >= 0);
const dmin = (R) => Math.min.apply(null, R.drop.filter((d, k) => !R.safe[k]));

test('registro: paridad con la línea propuesta del catálogo (B, survival, ffa, lim)', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'survival'); assert.deepStrictEqual(DEF.modos, ['ffa']);
  assert.strictEqual(DEF.dur, CAT.dur); assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.mo, 'B');
  assert.deepStrictEqual(DEF.cuerpo, ['x', 'y', 'h', 'st', 'sc', 'it', 'pk']);
  const k = DEF.carta; assert.ok(k.obj && k.gana && k.como.tactil && k.como.teclado && k.demos.length >= 1);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin tipos x* propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /=>/, /\blet\b/, /\bconst\b/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s), 'usa solo ev fiable (out)');
});

test('las rondas son idénticas con la misma semilla (cualquier n) y distintas con otra; menos prendidas por nivel; telegrafía ≥1,5 s', () => {
  for (const lv of [1, 2, 3]) {
    const a = mkCtx({ seed: 7, lv }).g.vista(), b = mkCtx({ seed: 7, lv, n: 2 }).g.vista();
    assert.strictEqual(a.hash, b.hash); assert.ok(a.nRondas >= 7, 'rondas lv' + lv + ': ' + a.nRondas);
    for (const R of a.rondas) for (let k = 0; k < 35; k++) if (!R.safe[k]) {
      if (R.hot[k]) { assert.ok(R.drop[k] - R.hot[k] >= 1.5 - 1e-9, 'subidón: avisa 1,5 s antes de caer'); continue; }
      assert.ok(R.drop[k] - R.off[k] >= 1.5 - 1e-9, 'cae 1,5 s después de apagarse');
      assert.ok(R.off[k] - R.S >= 0.29, 'titila antes de apagarse');
    }
  }
  assert.notStrictEqual(mkCtx({ seed: 7 }).g.vista().hash, mkCtx({ seed: 8 }).g.vista().hash);
  const prom = (lv) => { let s = 0, m = 0; for (let seed = 1; seed <= 10; seed++) mkCtx({ seed, lv }).g.vista().rondas.forEach((R) => { if (!R.spir) { s += segs(R).length; m++; } }); return s / m; };
  assert.ok(prom(1) > prom(2) && prom(2) > prom(3), 'menos prendidas por nivel: ' + [prom(1), prom(2), prom(3)]);
});

test('la luz se muda (ninguna prendida toca a una de la ronda anterior); la 1.ª ronda apaga las salidas; la última deja un solo bombillo', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const v = mkCtx({ seed, lv: 1 + (seed % 2) }).g.vista();
    for (let i = 1; i < v.rondas.length; i++) {
      const prev = v.rondas[i - 1].safe, R = v.rondas[i];
      if (R.spir || R.uno) continue;
      for (const k of segs(R)) { assert.ok(!prev[k], 'no repite'); }
    }
    for (const k of [15, 19, 10, 24]) assert.strictEqual(v.rondas[0].safe[k], 0, 'la salida ' + k + ' se apaga en la 1.ª ronda');
    const ult = v.rondas[v.rondas.length - 1]; assert.ok(ult.uno); assert.strictEqual(segs(ult).length, 1);
  }
});

test('quedarse en la baldosa de salida: cae al abrirse el hueco y kk = tick exacto de la apertura', () => {
  const st = mkCtx({ n: 2, seed: 4, lv: 1 });
  const R0 = st.g.vista().rondas[0];
  jugar(st, ['idle', 'idle'], dmin(R0) + 0.3);
  const outs = st.evs.filter((e) => e.ty === 'out');
  assert.strictEqual(outs.length, 2, 'los dos ociosos caen');
  outs.forEach((o) => assert.strictEqual(o.d.kk, Math.floor(R0.drop[o.p === 0 ? 15 : 19] * 30 + 1e-6)));
  assert.deepStrictEqual(st.g.vista().st, [1, 1]);
  assert.ok(st.g.done());
});

test('el que corre a una prendida sobrevive la ronda; y puede caer después si camina a un hueco abierto', () => {
  const st = mkCtx({ n: 1, seed: 4, lv: 1 }); const R0 = st.g.vista().rondas[0];
  const meta = centro(segs(R0)[0]);
  jugar(st, [ir(meta.x, meta.y)], dmin(R0) + 0.4, true);
  assert.strictEqual(st.g.vista().st[0], 0, 'a salvo');
  // ahora camina hacia un hueco abierto (la baldosa apagada más cercana) sin saltar
  const hu = R0.safe.map((s, k) => (s ? -1 : k)).filter((k) => k >= 0).sort((a, b) => { const A = centro(a), B = centro(b); return Math.hypot(A.x - meta.x, A.y - meta.y) - Math.hypot(B.x - meta.x, B.y - meta.y); })[0];
  const hc = centro(hu), t0 = st.gt;
  jugar(st, [ir(hc.x, hc.y)], R0.Tback - 0.05, true);
  const o = st.evs.filter((e) => e.ty === 'out')[0];
  assert.ok(o, 'cayó en el hueco'); assert.ok(o.d.kk >= Math.floor(t0 * 30), 'kk = su propio instante (entró después de abrirse)');
});

test('el saltico (A) cruza un hueco abierto: en el aire no cae, aterrizando en firme sigue vivo', () => {
  // buscamos una 1.ª ronda con dos prendidas en la misma fila separadas por UNA apagada
  for (let seed = 1; seed <= 200; seed++) {
    const st = mkCtx({ n: 1, seed, lv: 1 }), R = st.g.vista().rondas[0];
    const s = segs(R), par = s.find((k) => s.indexOf(k + 2) >= 0 && !R.safe[k + 1] && (k % 7) <= 4);
    if (par === undefined) continue;
    const a = centro(par), b = centro(par + 2);
    let salto = -1;
    const bot = (s2, p, dt, api) => {
      const vv = s2.g.vista();
      if (s2.gt < dmin(R) + 0.1) { ir(a.x + 28, a.y)(s2, p, dt, api); return; }
      if (salto < 0) { api.eje(1, 0); if (vv.x[0] >= a.x + 30) { salto = s2.gt; api.press('a'); } return; }
      api.eje(vv.x[0] < b.x - 10 ? 1 : 0, 0);
    };
    jugar(st, [bot], Math.min(R.Tback - 0.02, dmin(R) + 1.2), true);
    const vv = st.g.vista();
    assert.ok(salto > dmin(R), 'saltó con el hueco abierto');
    assert.strictEqual(vv.st[0], 0, 'no cayó (seed ' + seed + ')');
    assert.ok(vv.x[0] > a.x + TW / 2 + 20, 'cruzó al otro lado: x=' + vv.x[0]);
    assert.ok(vv.hopT[0] >= salto - 0.05);
    return;
  }
  assert.fail('no se encontró una ronda para cruzar con saltico');
});

test('empujón: la víctima (dueña) se empuja sola al ver aterrizar a otro cerca, y queda tambaleando', () => {
  const st = mkCtx({ n: 2, seed: 2, lv: 1 }); const g = st.g;
  st.gt = 0.5; g.update(1 / 30);
  const v0 = g.vista();
  // el 0 salta hacia el 1 (que está quieto)
  const dx = v0.x[1] - v0.x[0];
  st.axes[0] = { x: Math.sign(dx) * 0.9, y: 0 }; st.taps[0] = 1;
  for (let i = 0; i < 40; i++) { st.gt += 1 / 30; g.update(1 / 30); if (i === 0) st.axes[0] = { x: Math.sign(dx), y: 0 }; }
  // a mitad de camino seguimos caminando: cuando el 0 aterrice cerca del 1, el 1 sale disparado
  const st2 = mkCtx({ n: 2, seed: 2, lv: 1 }); const g2 = st2.g;
  st2.gt = 0.5; g2.update(1 / 30);
  const w = g2.vista(), gap = Math.abs(w.x[1] - w.x[0]);
  // acercamos al 0 caminando hasta 50 px del 1 y entonces salta
  let x1 = w.x[1], saltado = false;
  for (let i = 0; i < 200; i++) {
    st2.gt += 1 / 30; const vv = g2.vista(), d = vv.x[1] - vv.x[0];
    st2.axes[0] = { x: Math.abs(d) > 52 ? Math.sign(d) : (saltado ? 0 : Math.sign(d) * 0.3), y: Math.abs(vv.y[1] - vv.y[0]) > 3 ? Math.sign(vv.y[1] - vv.y[0]) : 0 };
    if (!saltado && Math.abs(d) <= 52) { saltado = true; st2.taps[0] = 1; }
    g2.update(1 / 30);
    if (saltado && g2.vista().kv[1] > 140) break;
  }
  assert.ok(gap > 60 && saltado);
  assert.ok(g2.vista().kv[1] > 140, 'el 1 recibió el empujón: ' + g2.vista().kv[1]);
  st2.axes[1] = { x: -1, y: 0 }; const xa = g2.vista().x[1]; st2.gt += 1 / 30; g2.update(1 / 30);
  assert.ok(Math.sign(g2.vista().x[1] - xa) === Math.sign(xa - x1 || 1) || g2.vista().x[1] === xa, 'tambalea: el stick no lo frena mientras vuela');
});

test('Nv3: Don Corte apaga en espiral desde el borde y deja las 3 del centro', () => {
  const v = mkCtx({ seed: 5, lv: 3 }).g.vista();
  const sp = v.rondas.filter((R) => R.spir && !R.uno);
  assert.ok(sp.length >= 2, 'hay rondas de Don Corte');
  for (const R of sp) {
    assert.deepStrictEqual(segs(R), [16, 17, 18], 'quedan las del centro');
    const offs = R.off.map((t, k) => [t, k]).filter((x) => !R.safe[x[1]]).sort((a, b) => a[0] - b[0]);
    const borde = (k) => { const c0 = k % 7, r0 = Math.floor(k / 7); return c0 === 0 || c0 === 6 || r0 === 0 || r0 === 4; };
    offs.slice(0, 20).forEach((x) => assert.ok(borde(x[1]), 'primero el borde'));
    offs.slice(20).forEach((x) => assert.ok(!borde(x[1]), 'después el anillo de adentro'));
    for (let i = 1; i < offs.length; i++) assert.ok(offs[i][0] - offs[i - 1][0] > 0.05, 'una a la vez');
  }
  assert.ok(mkCtx({ seed: 5, lv: 1 }).g.vista().rondas.every((R) => !R.spir), 'en Nv1 no hay espiral');
});

test('CPU: hay bajas en todos los niveles, la habilidad importa y un ocioso nunca gana (a 3 CPU)', () => {
  const vivos = { 1: 0, 2: 0, 3: 0 };
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 20; seed++) { const st = mkCtx({ n: 4, lv, seed, skill: 0.6 }); jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 45); vivos[lv] += st.g.vista().vivos; }
  console.log('  CPU .6 vivos medios al cierre: lv1=' + (vivos[1] / 20).toFixed(2) + ' lv2=' + (vivos[2] / 20).toFixed(2) + ' lv3=' + (vivos[3] / 20).toFixed(2));
  for (const lv of [1, 2, 3]) assert.ok(vivos[lv] / 20 >= 0.8 && vivos[lv] / 20 <= 2.6, 'lv' + lv);
  let gano = 0;
  for (let seed = 1; seed <= 40; seed++) { const st = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 45); if (sc[0] >= Math.max.apply(null, sc.slice(1))) gano++; }
  assert.strictEqual(gano, 0, 'un ocioso nunca gana ni empata arriba');
});

test('puntajes enteros dentro de los límites del catálogo; dur=3,8,45 no revienta', () => {
  for (const dur of [3, 8, 45]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['cpu', 'cpu', 'idle', 'idle'], dur); const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('remotos: cuerpo entrante actualiza posición/salto y marca eliminación; alHum/alCpu no revientan', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c; const cuerpos = { 1: { x: 300, y: 120, h: 1, st: 0, sc: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 1; st.g.update(1 / 30); assert.strictEqual(st.g.vista().x[1], 300); assert.strictEqual(st.g.vista().h[1], 1);
  cuerpos[1] = { x: 300, y: 120, h: 0, st: 1, sc: 99 }; st.g.update(1 / 30); assert.strictEqual(st.g.vista().st[1], 1); assert.strictEqual(st.g.scores()[1], 99);
  st.g.alCpu(1); st.g.alHum(1, cuerpos[1]); assert.strictEqual(st.g.cuerpo(1).st, 1); assert.ok(/luz|prendido/.test(st.g.destacado()));
});

test('empujón remoto: un rival remoto que aterriza (h 1 -> 0) al lado de mi cuerpo me empuja; uno lejos, no', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c, g = st.g;
  c.mio = (p) => p === 0;
  st.gt = 0.5; g.update(1 / 30);
  const me = g.vista(); let cuerpo = { x: Math.round(me.x[0] + 200), y: Math.round(me.y[0]), h: 1, st: 0, sc: 0 };
  c.remoto = () => cuerpo;
  st.gt += 1 / 30; g.update(1 / 30); cuerpo = { x: cuerpo.x, y: cuerpo.y, h: 0, st: 0, sc: 0 }; st.gt += 1 / 30; g.update(1 / 30);
  assert.ok(g.vista().kv[0] < 1, 'lejos: nada');
  cuerpo = { x: Math.round(me.x[0] + 20), y: Math.round(me.y[0]), h: 1, st: 0, sc: 0 }; st.gt += 1 / 30; g.update(1 / 30);
  cuerpo = { x: cuerpo.x, y: cuerpo.y, h: 0, st: 0, sc: 0 }; st.gt += 1 / 30; g.update(1 / 30);
  assert.ok(g.vista().kv[0] > 140, 'cerca: empujón ' + g.vista().kv[0]);
});

test('dibujo: draw() no revienta (gt<0, aviso, huecos, espiral, caídos con vela) en los 3 niveles con solo primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, seed: 3 });
    for (const gt of [-2, 0.2, 3, 4.2, 5.2]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['cpu', 'idle', 'idle', 'cpu'], 45); st.g.draw();
    for (let i = 0; i < 25; i++) { st.gt += 0.5; st.g.update(1 / 30); st.g.draw(); }
  }
  assert.ok(calls.length > 300); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});
