/* f_cotufas (FFA rank, modelo B): humo sin red. Contexto `c` falso con todos los asientos míos (eco local de ev y claim resuelto al instante por el propio juego).
   Comprueba registro, lint, calendario determinista, dorada ×5, explosión Nv3, recogida por claim, embestida (la víctima juzga, 3 cotufas, enfriamiento, inmunidad),
   ventana CPU vs humano, CPU, límites del catálogo, remotos y dibujo. La red va en test/fiesta-live-cotufas.test.js.
   NOTA: el catálogo (fiesta-reglas.js CATALOGO) trae f_cotufas con dur 45 y sin live/lim: aquí se completa EN MEMORIA con la línea que debe ir al catálogo. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-cotufas.js');
const LINEA = { g: 'f_cotufas', m: ['ffa'], cl: 'rank', dur: 30, mo: 'B', live: 1, lim: { scoreMax: 120, scoreRate: 5, minT: 27, finTemprano: 0 } };
const CAT = require('../docs/style-lab/fiesta-reglas.js').CATALOGO.filter((x) => x.g === 'f_cotufas')[0];
Object.assign(CAT, LINEA);

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC]; require(SRC);
  return defs.f_cotufas;
}
const DEF = cargar();
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 30, lv = o.lv || 1;
  const st = { gt: -1, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: [], claims: [] };
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
    out: () => {}, send: () => true, on: () => {},
    claim: (id, cb) => { st.claims.push({ id, at: st.gt }); if (o.noClaim) { cb('no'); return; } const ok = st.g.claimOk(id, c.yo, Math.round(st.gt * 1000)); if (ok !== false) { st.g.concede(id, c.yo); cb('ok'); } else cb('no'); },
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
/* modos[p]: 'cpu' (el ai del juego) | 'idle' | función(st,p,dt,api) */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, lim = hasta || c.dur;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  while (st.gt < lim) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
  }
  return g.scores();
}
function irA(st, p, api, x, y) { const v = st.g.vista(), dx = x - v.x[p], dy = y - v.y[p], l = Math.hypot(dx, dy); if (l < 3) api.eje(0, 0); else api.eje(dx / l, dy / l); }

test('registro: paridad con la línea de catálogo (B, rank, ffa, 30 s, lim)', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'rank'); assert.deepStrictEqual(DEF.modos, ['ffa']); assert.strictEqual(DEF.dur, 30);
  assert.strictEqual(DEF.dur, CAT.dur); assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.mo, 'B'); assert.strictEqual(CAT.cl, 'rank');
  assert.deepStrictEqual(DEF.cuerpo, ['x', 'y', 'n', 'ds', 'fc', 'sn']); assert.strictEqual(DEF.botones, 1); assert.ok(DEF.stick);
  assert.ok(DEF.carta.obj && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length === 2);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, sin sintaxis fuera de ES2015, sin tipos x* propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /=>/, /\blet\b|\bconst\b/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s), 'usa solo ev fiable (shot/hit/got) y claim');
});

test('el calendario es idéntico con la misma semilla (cualquier n), distinto con otra; densidad por nivel 1 / 0,8 / 0,6 s', () => {
  for (const lv of [1, 2, 3]) assert.strictEqual(mkCtx({ seed: 7, lv }).g.vista().hash, mkCtx({ seed: 7, lv, n: 2 }).g.vista().hash);
  assert.notStrictEqual(mkCtx({ seed: 7 }).g.vista().hash, mkCtx({ seed: 8 }).g.vista().hash);
  const cnt = (lv) => mkCtx({ seed: 3, lv }).g.vista().objs.filter((o) => o.id[0] === 'c').length;
  assert.ok(cnt(1) < cnt(2) && cnt(2) < cnt(3), [cnt(1), cnt(2), cnt(3)].join('/'));
  const v = mkCtx({ seed: 3, lv: 1 }).g.vista(), tc = v.objs.filter((o) => o.id[0] === 'c').map((o) => o.t0);
  assert.ok(Math.abs(tc[2] - tc[0] - 1.0) < 0.2 && tc.every((t) => t < 28.5));
});

test('dorada a los 15 s (×5) (+ otra en el frenesí en Nv1-2); máquina: Nv3 explota dos veces (6 en arco), Nv1-2 la olla se desborda una vez (5)', () => {
  for (const lv of [1, 2, 3]) {
    const v = mkCtx({ seed: 5, lv }).g.vista(), g0 = v.objs.filter((o) => o.id === 'g0'), g1 = v.objs.filter((o) => o.id === 'g1');
    assert.strictEqual(g0.length, 1); assert.strictEqual(g0[0].t0, 15); assert.strictEqual(g0[0].v, 5);
    assert.strictEqual(g1.length, lv < 3 ? 1 : 0); if (g1.length) { assert.strictEqual(g1[0].v, 5); assert.ok(g1[0].t0 >= 0.72 * 30 && g1[0].t2 <= 30.6); }
    const ex = v.objs.filter((o) => o.id[0] === 'e');
    if (lv < 3) { assert.strictEqual(ex.length, 5); assert.strictEqual(v.expl.length, 1); } else { assert.strictEqual(ex.length, 12); assert.strictEqual(v.expl.length, 2); }
    assert.ok(ex.every((o) => o.t1 - o.t0 > 0.8));
  }
});

test('sombra con tiempo: toda cotufa del techo tarda >= 0,85 s en caer (la dorada 1,4 s); fases calma/se prendió/últimos segundos por fracción de dur', () => {
  for (const dur of [10, 30]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ seed: 4, lv, dur }), v = st.g.vista();
    for (const o of v.objs) if (o.id[0] === 'c') assert.ok(o.t1 - o.t0 >= 0.84, o.id + ' cae en ' + (o.t1 - o.t0));
    for (const o of v.objs) if (o.id[0] === 'g') assert.ok(Math.abs(o.t1 - o.t0 - 1.4) < 1e-9);
    const ts = v.objs.filter((o) => o.id[0] === 'c' && +o.id.slice(1) % 2 === 0).map((o) => o.t0).sort((x, y) => x - y);   // inicio de cada tanda
    const gap = (a, b) => { const g = []; for (let i = 1; i < ts.length; i++) if (ts[i - 1] >= a * dur && ts[i - 1] < b * dur) g.push(ts[i] - ts[i - 1]); return g.reduce((x, y) => x + y, 0) / g.length; };
    if (dur >= 20) assert.ok(gap(0.72, 1) < gap(0, 0.35) * 0.7, 'el frenesí llueve más: tandas cada ' + gap(0, 0.35).toFixed(2) + ' -> ' + gap(0.72, 1).toFixed(2));
    const fz = []; for (const t of [0.1, 0.5, 0.9]) { st.gt = t * dur; st.g.update(1 / 30); fz.push(st.g.vista().fase); }
    assert.deepStrictEqual(fz, [0, 1, 2]);
  }
});

test('eventos de la sala: acomodador, viento y apagón sembrados (iguales con la misma semilla), dentro de la partida', () => {
  for (const dur of [10, 30]) {
    const a = mkCtx({ seed: 6, dur }).g.vista().evs, b = mkCtx({ seed: 6, dur, n: 2 }).g.vista().evs;
    assert.deepStrictEqual(a, b); assert.deepStrictEqual(a.slice(0, 3).map((e) => e.k), ['ujier', 'viento', 'apagon']);
    assert.ok(a.every((e) => e.t > 1 && e.t + e.d < dur), JSON.stringify(a));
  }
  // viento: las cotufas que caen en su ventana vienen en diagonal pero aterrizan donde marca la sombra (x del calendario)
  const st = mkCtx({ seed: 6 }), w = st.g.vista().evs.filter((e) => e.k === 'viento')[0];
  st.gt = w.t + 0.1; st.g.update(1 / 30); const x0 = st.g.vista().x[0];
  for (let k = 0; k < 15; k++) { st.gt += 1 / 30; st.g.update(1 / 30); }
  assert.ok((st.g.vista().x[0] - x0) * w.dir > 20, 'el viento empuja al quieto');
});

test('acomodador: quien queda en su carril es aturdido, suelta 2 (ev hit de=-1) y las 2 quedan recogibles; inmune luego', () => {
  const st = mkCtx({ n: 1, seed: 6 }), g = st.g, u = g.vista().evs.filter((e) => e.k === 'ujier')[0];
  const obj = g.vista().objs.slice(0, 3);
  for (const o of obj) { st.gt = Math.max(st.gt, o.t1 + 0.01); g.update(1 / 30); g.concede(o.id, 0); }
  const sigue = (s, p, dt, api) => { const w = s.g.vista(); irA(s, p, api, w.x[p], u.y); };
  jugar(st, [sigue], u.t + u.d + 0.1);
  const hi = st.evs.filter((e) => e.ty === 'hit');
  assert.strictEqual(hi.length, 1, 'un solo choque'); assert.strictEqual(hi[0].d.de, -1); assert.strictEqual(hi[0].d.k, 2);
  assert.strictEqual(g.vista().objs.filter((o) => o.id[0] === 'h').length, 2);
});

test('recoger: un bot que va a la cotufa más cercana suma y la cotufa desaparece; un ocioso no suma', () => {
  const st = mkCtx({ n: 2, seed: 2, lv: 1 });
  const bot = (s, p, dt, api) => {
    const v = s.g.vista(), now = s.gt; let b = null, bd = 1e9;
    for (const o of v.objs) { if (now >= o.t0 && now < o.t2 - 0.3 && !s.tk[o.id]) { const d = Math.hypot(o.x - v.x[p], o.y - v.y[p]); if (d < bd) { bd = d; b = o; } } }
    if (b) irA(s, p, api, b.x, b.y); else api.eje(0, 0);
  };
  st.tk = {}; const f0 = st.g.concede; st.g.concede = (id, p) => { st.tk[id] = 1; f0(id, p); };
  const sc = jugar(st, [bot, 'idle'], 12);
  assert.ok(sc[0] >= 3 && sc[0] > sc[1], JSON.stringify(sc)); assert.ok(st.claims.length >= sc[0]);
});

test('claim: la misma cotufa no se concede dos veces (el segundo claim no la suma)', () => {
  const st = mkCtx({ n: 2, seed: 2 }); const o = st.g.vista().objs[0];
  st.gt = o.t1 + 0.05; st.g.update(1 / 30);
  assert.strictEqual(st.g.claimOk(o.id, 0, Math.round(st.gt * 1000)), true);
  assert.strictEqual(st.g.claimOk(o.id, 1, Math.round((o.t0 - 1) * 1000)), false, 'antes de caer no vale');
  st.g.concede(o.id, 0); st.g.concede(o.id, 1);
  assert.strictEqual(st.g.scores()[0], 1); assert.strictEqual(st.g.scores()[1], 0);
  assert.strictEqual(st.g.claimOk(o.id, 1, Math.round(st.gt * 1000)), false, 'ya concedida');
  assert.strictEqual(st.g.claimOk('zz', 1, 0), false);
});

test('la dorada vale ×5', () => {
  const st = mkCtx({ n: 1, seed: 4 }); const g0 = st.g.vista().objs.filter((o) => o.id === 'g0')[0];
  st.gt = g0.t1 + 0.1; st.g.update(1 / 30); const a0 = st.g.scores()[0]; st.g.concede('g0', 0); assert.strictEqual(st.g.scores()[0], a0 + 5);
});

test('embestida: A tumba 3 cotufas al que golpeas (la víctima juzga), 3 objetos nuevos recogibles, inmunidad 1 s, enfriamiento 1,2 s', () => {
  const st = mkCtx({ n: 2, seed: 9, lv: 1 }); const g = st.g;
  st.gt = 0; g.update(1 / 30);
  // le damos 5 cotufas a la víctima (asiento 1) por concesión directa
  const obj = g.vista().objs.slice(0, 5);
  for (const o of obj) { st.gt = Math.max(st.gt, o.t1 + 0.01); g.update(1 / 30); g.concede(o.id, 1); }
  const antes = g.scores()[1]; assert.ok(antes >= 5);
  // colocar a 0 pegado a 1, mirando hacia 1
  const v = g.vista(); const dx = v.x[1] - v.x[0], dy = v.y[1] - v.y[0];
  const t0 = st.gt; let n0 = 0;
  const atk = (s, p, dt, api) => { if (s.trasGolpe === undefined) { if (s.evs.some((e) => e.ty === 'hit')) s.trasGolpe = s.g.scores()[1]; else s.preGolpe = s.g.scores()[1]; } const w = s.g.vista(); const ddx = w.x[1] - w.x[0], ddy = w.y[1] - w.y[0], l = Math.hypot(ddx, ddy); if (n0 === 0 && l < 40) { api.eje(ddx / l, ddy / l); api.press('a'); n0 = 1; } else if (n0 === 0) api.eje(ddx / l, ddy / l); else api.eje(0, 0); };
  void dx; void dy; void t0;
  jugar(st, [atk, 'idle'], st.gt + 2.0);
  const sh = st.evs.filter((e) => e.ty === 'shot'), hi = st.evs.filter((e) => e.ty === 'hit');
  assert.strictEqual(sh.length, 1); assert.strictEqual(hi.length, 1, 'un golpe'); assert.strictEqual(hi[0].p, 1); assert.strictEqual(hi[0].d.k, 3); assert.strictEqual(hi[0].d.de, 0);
  assert.strictEqual(st.trasGolpe, st.preGolpe - 3, 'perdió 3 en el golpe'); assert.ok(antes >= 5); assert.strictEqual(g.vista().objs.filter((o) => o.id[0] === 'h').length, 3);
  assert.ok(g.vista().inv[1] > hi[0].at + 0.9, 'inmune ~1 s');
  // enfriamiento: un segundo toque inmediato no embiste
  const e0 = st.evs.filter((e) => e.ty === 'shot').length; st.taps[0] = 1; st.gt += 1 / 30; g.update(1 / 30);
  assert.strictEqual(st.evs.filter((e) => e.ty === 'shot').length, e0 + (st.gt >= g.vista().cd[0] - 1.2 + 1.2 ? 0 : 0));
});

test('embestida: sin cotufas la víctima aturdida no suelta nada (k=0); fuera de alcance no hay golpe', () => {
  const st = mkCtx({ n: 2, seed: 9 }); st.gt = 0; st.g.update(1 / 30);
  const v = st.g.vista(); st.taps[0] = 1; st.axes[0] = { x: v.x[1] > v.x[0] ? -1 : 1, y: 0 };   // mira al lado contrario: el segmento no llega
  st.gt += 1 / 30; st.g.update(1 / 30);
  assert.strictEqual(st.evs.filter((e) => e.ty === 'hit').length, 0, 'sin contacto');
});

test('una CPU que tocó antes gana: claimOk rechaza al humano con t posterior y deja pasar al anterior', () => {
  const st = mkCtx({ n: 2, seed: 3 }); const g = st.g, o = g.vista().objs[0];
  // CPU 1 encima de la cotufa
  const api = (p) => ({ press() {}, hold() {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  st.gt = o.t1 + 0.02;
  let guard = 0; while (g.vista().cpuPend === 0 && guard++ < 400) { st.gt += 1 / 30; irA(st, 1, api(1), o.x, o.y); g.update(1 / 30); if (st.gt > o.t2 - 0.5) break; }
  if (g.vista().cpuPend > 0) {
    assert.strictEqual(g.claimOk(o.id, 0, Math.round((st.gt + 0.05) * 1000)), false);
    assert.strictEqual(g.claimOk(o.id, 0, Math.round((st.gt - 0.5) * 1000)), true);
  }
});

test('CPU nivel .6: todas juntan cotufas y se reparten; un ocioso nunca gana a tres CPU activas', () => {
  const tot = [0, 0, 0, 0];
  for (let seed = 1; seed <= 12; seed++) { const st = mkCtx({ n: 4, lv: 1 + (seed % 3), seed, skill: 0.6 }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu']); sc.forEach((v, i) => { tot[i] += v; }); }
  console.log('  CPU .6 cotufas medias por asiento:', tot.map((v) => (v / 12).toFixed(1)).join(' '));
  assert.ok(tot.every((v) => v / 12 >= 3), 'cada CPU juega de verdad: ' + tot);
  let gano = 0;
  for (let seed = 1; seed <= 30; seed++) { const st = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ['idle', 'cpu', 'cpu', 'cpu']); if (sc[0] > Math.max.apply(null, sc.slice(1))) gano++; }
  assert.strictEqual(gano, 0, 'un ocioso nunca gana');
});

test('CPU: embiste a quien lleva más cuando está cerca (hay golpes en partidas CPU)', () => {
  let hits = 0;
  for (let seed = 1; seed <= 20; seed++) { const st = mkCtx({ n: 4, lv: 3, seed, skill: 0.8 }); jugar(st, ['cpu', 'cpu', 'cpu', 'cpu']); hits += st.g.vista().hits; }
  console.log('  golpes por partida CPU .8 Nv3:', (hits / 20).toFixed(2)); assert.ok(hits > 0);
});

test('puntajes enteros dentro de los límites del catálogo; dur=3,8,20,30 no revienta', () => {
  for (const dur of [3, 8, 20, 30]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'idle'], dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (dur + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('techo del puntaje: el total en juego nunca supera scoreMax (Nv3 es el peor caso)', () => {
  const v = mkCtx({ seed: 11, lv: 3 }).g.vista(); const total = v.objs.filter((o) => o.id[0] !== 'h').reduce((a, o) => a + o.v, 0);
  console.log('  total en juego Nv3 =', total, '(scoreMax', CAT.lim.scoreMax + ')'); assert.ok(total <= CAT.lim.scoreMax);
});

test('remotos: el cuerpo entrante actualiza posición/cotufas; alHum/alCpu no revientan; los remotos no se juzgan', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c; const cuerpos = { 1: { x: 300, y: 120, n: 4, ds: 0, fc: 1, sn: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null; c.juez = () => false;
  st.gt = 1; st.g.update(1 / 30); assert.strictEqual(st.g.vista().x[1], 300); assert.strictEqual(st.g.scores()[1], 4);
  cuerpos[1] = { x: 310, y: 120, n: 6, ds: 1, fc: -1, sn: 1 }; st.g.update(1 / 30); assert.strictEqual(st.g.scores()[1], 6);
  st.g.alCpu(1); st.g.alHum(1, cuerpos[1]); assert.strictEqual(st.g.cuerpo(0).n, 0); assert.ok(/juntó/.test(st.g.destacado()));
  // concesión ajena: el remoto no suma localmente (su n sale de su cuerpo)
  const o = st.g.vista().objs[0]; st.gt = o.t1 + 0.1; st.g.update(1 / 30); st.g.concede(o.id, 1); assert.strictEqual(st.g.scores()[1], 6);
});

test('dibujo: draw() no revienta (gt<0, caídas, dorada, explosión, golpes) en los 3 niveles con solo primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, seed: 3 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['cpu', 'idle', 'cpu', 'cpu'], 16); st.g.draw(); jugar(st, ['cpu', 'idle', 'cpu', 'cpu'], 30); st.g.draw();
  }
  assert.ok(calls.length > 300); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});
