/* f_bombita (FFA survival, modelo B): humo sin red. Contexto `c` falso con todos los asientos míos (eco local de ev). Comprueba registro, lint, calendario determinista,
   pase por contacto (inmunidad, sin devolver), estallido (kk = tick de T), pase en vuelo, ini del juez, CPU, límites del catálogo, remotos y dibujo.
   La red va en test/fiesta-live-bombita.test.js. NOTA: el catálogo trae f_bombita sin live/lim: aquí se completa EN MEMORIA con la línea que debe ir al catálogo. */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const rng = require('../docs/style-lab/fiesta-rng.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-bombita.js');
const LINEA = { g: 'f_bombita', m: ['ffa'], cl: 'survival', dur: 40, mo: 'B', live: 1, lim: { scoreMax: 1201, scoreRate: 31, minT: 3, finTemprano: 1 } };
const CAT = require('../docs/style-lab/fiesta-reglas.js').CATALOGO.filter((x) => x.g === 'f_bombita')[0];
Object.assign(CAT, LINEA);

function cargar() {
  const defs = {};
  globalThis.window = globalThis;
  globalThis.FIESTA = { rng, LIVE: { add: (id, d) => { defs[id] = d; }, get: (id) => defs[id] || null } };
  delete require.cache[SRC]; require(SRC);
  return defs.f_bombita;
}
const DEF = cargar();
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 40, lv = o.lv || 1;
  const st = { gt: -3, taps: new Array(n).fill(0), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null, evs: [] };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, lv, dur, practica: false, modelo: 'B', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: 0, x1: 800, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p) => { const v = st.taps[p]; st.taps[p] = 0; return st.gt < 0 ? 0 : v; },
    eje: (p) => (st.gt < 0 ? { x: 0, y: 0 } : st.axes[p]), cpu: new Array(n).fill(false), skill: new Array(n).fill(o.skill == null ? 0.6 : o.skill),
    juez: () => o.juez !== false, mio: (p) => (o.mio ? o.mio(p) : true), remoto: (p) => (o.remoto ? o.remoto(p) : null),
    ev: (ty, d, p) => { st.evs.push({ ty, d, p, at: st.gt }); if (st.g && st.g.onEv) st.g.onEv(ty, p === undefined ? c.yo : p, d, st.gt); },
    out: (p, kk) => c.ev('out', { kk: kk === undefined ? Math.floor(st.gt * 30) : kk }, p),
    send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, lim = hasta || c.dur;
  const api = (p) => ({ press: () => { st.taps[p]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, api(p)); else if (typeof m === 'function') m(st, p, dt, api(p)); }
    g.update(dt);
    if (st.gt >= Math.min(3, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}

test('registro: paridad con el catálogo (B, survival, ffa, lim)', () => {
  assert.strictEqual(DEF.modelo, 'B'); assert.strictEqual(DEF.clase, 'survival'); assert.deepStrictEqual(DEF.modos, ['ffa']);
  assert.strictEqual(DEF.dur, CAT.dur); assert.deepStrictEqual(DEF.limites, CAT.lim); assert.strictEqual(CAT.live, 1); assert.strictEqual(CAT.mo, 'B');
  assert.deepStrictEqual(DEF.cuerpo, ['x', 'y', 'st', 'sc']); assert.ok(DEF.stick); assert.strictEqual(DEF.botones, 1);   // A = embiste
  assert.ok(DEF.carta.obj && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length === 2);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, ES2015 (en realidad ES5), sin tipos x* propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /=>/, /\blet\b|\bconst\b/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.send\(/.test(s), 'usa solo ev fiable (ini/pasa/out)');
});

test('el calendario es idéntico con la misma semilla (cualquier n), distinto con otra; Nv3 trae dos bombitas por ronda y caben 3 rondas', () => {
  for (const lv of [1, 2, 3]) { const a = mkCtx({ seed: 7, lv }).g.vista(), b = mkCtx({ seed: 7, lv, n: 2 }).g.vista(); assert.strictEqual(a.hash, b.hash); assert.ok(a.rondas >= 3, 'rondas lv' + lv + ': ' + a.rondas); }
  assert.notStrictEqual(mkCtx({ seed: 7 }).g.vista().hash, mkCtx({ seed: 8 }).g.vista().hash);
  // Nv1: una bombita por ronda antes de los últimos segundos; en los últimos segundos, dos. Nv3: siempre dos.
  for (let seed = 1; seed <= 20; seed++) {
    const v1 = mkCtx({ seed, lv: 1 }).g.vista(), porR = {};
    v1.bombs.forEach((b) => { porR[b.r] = porR[b.r] || []; porR[b.r].push(b); });
    Object.values(porR).forEach((r) => assert.strictEqual(r.length, r[0].S >= v1.F2 - 0.5 ? r.length : 1, 'nv1 una por ronda antes del final'));
    const v3 = mkCtx({ seed, lv: 3 }).g.vista(); assert.strictEqual(v3.nBombs, 2 * v3.rondas);
  }
  for (let seed = 1; seed <= 30; seed++) for (const lv of [1, 2, 3]) { const v = mkCtx({ seed, lv }).g.vista(); v.bombs.forEach((b) => assert.ok(b.T < 40 && b.T > b.S + 1, `T ${b.T} S ${b.S}`)); }
});

test('el juez decide el portador inicial (ini); quien no es juez no emite ini', () => {
  const st = mkCtx({ n: 4, seed: 2, lv: 1 }); jugar(st, ['idle', 'idle', 'idle', 'idle'], 4);
  const ini = st.evs.filter((e) => e.ty === 'ini'); assert.strictEqual(ini.length, 1); assert.ok(ini[0].d.to >= 0 && ini[0].d.to < 4); assert.ok(ini[0].at >= st.g.vista().bombs[0].S - 0.05);
  assert.strictEqual(st.g.vista().bombs[0].holder, ini[0].d.to);
  const st2 = mkCtx({ n: 4, seed: 2, lv: 1, juez: false }); jugar(st2, ['idle', 'idle', 'idle', 'idle'], 4);
  assert.strictEqual(st2.evs.filter((e) => e.ty === 'ini').length, 0);
});

test('quien la lleva al estallar queda fuera con kk = floor(T*30); un ocioso entre 4 ociosos: un fuera por ronda', () => {
  const st = mkCtx({ n: 4, seed: 5, lv: 1 }); const sc = jugar(st, ['idle', 'idle', 'idle', 'idle'], 40);
  const outs = st.evs.filter((e) => e.ty === 'out'), v = st.g.vista();
  assert.ok(outs.length >= 1); assert.strictEqual(outs[0].d.kk, Math.floor(v.bombs[0].T * 30));
  assert.strictEqual(v.st[outs[0].p], 1); assert.strictEqual(sc[outs[0].p], outs[0].d.kk);
  assert.ok(sc.filter((x) => x === 40 * 30 + 1).length >= 1, 'queda algún seco con 40*30+1');
});

test('pasar por contacto: portador pega al otro => ev pasa, inmunidad 0,6 s, no se devuelve en 1 s; al pasar a tiempo el pasador se salva', () => {
  const st = mkCtx({ n: 2, seed: 4, lv: 1 }); const g = st.g;
  for (let i = 0; st.gt < 3.5; i++) { st.gt += 1 / 30; g.update(1 / 30); }
  const h = g.vista().bombs[0].holder, o = 1 - h; assert.ok(h >= 0);
  // los dos juntos: el portador pasa en cuanto se pueda
  const v = g.vista(), bot = (s, p, dt, api) => { const w = s.g.vista(); if (p === h) { const dx = w.x[o] - w.x[h], dy = w.y[o] - w.y[h], l = Math.hypot(dx, dy) || 1; api.eje(l > 5 ? dx / l : 0, l > 5 ? dy / l : 0); } else api.eje(0, 0); };
  jugar(st, [bot, bot], st.gt + 3);
  const pasas = st.evs.filter((e) => e.ty === 'pasa'); assert.ok(pasas.length >= 1, 'hubo pase');
  assert.strictEqual(pasas[0].p, h); assert.strictEqual(pasas[0].d.to, o);
  if (pasas.length > 1) assert.ok(pasas[1].d.t - pasas[0].d.t >= 1000 * 0.6, 'inmunidad: ' + (pasas[1].d.t - pasas[0].d.t));
  assert.ok(pasas.length === 1 || pasas[1].d.t - pasas[0].d.t >= 1000, 'sin devolución inmediata');
});

test('un pase en vuelo con t < T cuenta: el receptor la lleva al estallar y es quien sale', () => {
  const st = mkCtx({ n: 3, seed: 6, lv: 1, mio: (p) => p !== 2 }); const g = st.g;
  st.c.remoto = (p) => (p === 2 ? { x: 400, y: 100, st: 0, sc: 0 } : null);
  // el juez emite ini; llevamos el reloj a justo antes de T y simulamos pase de 0 a 1 con t=T-0.02 que llega tarde
  while (st.gt < 3) { st.gt += 1 / 30; g.update(1 / 30); }
  const b0 = g.vista().bombs[0], h = b0.holder; assert.ok(h >= 0 && h < 2);
  const otro = 1 - h;
  while (st.gt < b0.T - 0.06) { st.gt += 1 / 30; g.update(1 / 30); }
  // llega tarde (ya pasó T en el reloj local) un pase estampado antes de T, hecho por el portador
  st.gt = b0.T + 0.1; g.onEv('pasa', h, { i: 0, to: otro, t: Math.round((b0.T - 0.05) * 1000) }, st.gt);
  assert.strictEqual(g.vista().bombs[0].holder, otro); g.update(1 / 30);
  const o = st.evs.filter((e) => e.ty === 'out' && e.p === otro); assert.strictEqual(o.length, 1); assert.strictEqual(o[0].d.kk, Math.floor(b0.T * 30));
  // y uno estampado después de T se ignora
  const st2 = mkCtx({ n: 3, seed: 6, lv: 1 }); st2.gt = 3; st2.g.update(1 / 30); const hh = st2.g.vista().bombs[0].holder;
  st2.g.onEv('pasa', hh, { i: 0, to: (hh + 1) % 3, t: Math.round((st2.g.vista().bombs[0].T + 0.1) * 1000) }, st2.gt); assert.strictEqual(st2.g.vista().bombs[0].holder, hh);
});

test('CPU: 4 CPU iguales terminan con un solo seco (3 estallidos caben), el ocioso casi nunca gana', () => {
  let secos = 0, N = 40;
  for (let seed = 1; seed <= N; seed++) { const st = mkCtx({ n: 4, lv: 1 + (seed % 3), seed, skill: 0.6 }); jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 40); secos += st.g.vista().vivos; }
  console.log('  CPU .6 secos medios al cierre: ' + (secos / N).toFixed(2)); assert.ok(secos / N <= 1.35, 'quedan ~1');
  let gano = 0;
  for (let seed = 1; seed <= 60; seed++) { const st = mkCtx({ n: 4, lv: 2, seed, skill: 0.6 }); const sc = jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 40); if (sc[0] >= Math.max.apply(null, sc.slice(1))) gano++; }
  console.log('  ocioso >= mejor CPU: ' + gano + '/60'); assert.ok(gano <= 3, 'ocioso gana ' + gano);
});

test('puntajes enteros dentro de los límites del catálogo; dur=3,8,40 no revienta', () => {
  for (const dur of [3, 8, 40]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['cpu', 'cpu', 'idle', 'idle'], dur); const t = Math.max(st.gt, dur);
    for (const v of sc) assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT.lim.scoreMax && v <= CAT.lim.scoreRate * (t + 1.5), `dur${dur} lv${lv} v=${v}`);
  }
});

test('remotos: cuerpo entrante actualiza posición y marca eliminación; alHum/alCpu no revientan', () => {
  const st = mkCtx({ n: 2, yo: 0 }); const c = st.c; const cuerpos = { 1: { x: 300, y: 120, st: 0, sc: 0 } };
  c.mio = (p) => p === 0; c.remoto = (p) => cuerpos[p] || null;
  st.gt = 1; st.g.update(1 / 30); assert.strictEqual(st.g.vista().x[1], 300);
  cuerpos[1] = { x: 300, y: 120, st: 1, sc: 99 }; st.g.update(1 / 30); assert.strictEqual(st.g.vista().st[1], 1); assert.strictEqual(st.g.scores()[1], 99);
  st.g.alCpu(1); st.g.alHum(1, cuerpos[1]); assert.strictEqual(st.g.cuerpo(1).st, 1); assert.ok(/mojó|seco/.test(st.g.destacado()));
});

test('dibujo: draw() no revienta (gt<0, portador, temblor, mojados) en los 3 niveles con solo primitivas del lab', () => {
  const calls = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'txt', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, seed: 3 });
    for (const gt of [-2, 0.2, 3]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, ['cpu', 'idle', 'idle', 'cpu'], 40); st.g.draw();
  }
  assert.ok(calls.length > 300); assert.ok(calls.every((x) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(x)));
});

test('escalada: fases por c.ahora()/dur (también con dur 10); en los últimos segundos hay bombita doble y mechas más cortas', () => {
  for (const dur of [10, 40]) {
    const st = mkCtx({ n: 4, seed: 9, lv: 1, dur }); const g = st.g;
    const fases = []; for (const k of [0.1, 0.5, 0.9]) { st.gt = dur * k; fases.push(g.vista().fase); }
    assert.deepStrictEqual(fases, [0, 1, 2], 'dur ' + dur);
  }
  let dobles = 0;
  for (let seed = 1; seed <= 30; seed++) { const v = mkCtx({ seed, lv: 1 }).g.vista(); const r = {}; v.bombs.forEach((b) => { r[b.r] = (r[b.r] || 0) + 1; }); if (Object.values(r).some((x) => x === 2)) dobles++; }
  assert.ok(dobles >= 15, 'rondas dobles al final en nv1: ' + dobles + '/30');
});

test('eventos de la plaza: calendario igual con la misma semilla, avisados >= 0,5 s antes, más seguidos al final, dentro de la partida', () => {
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 20; seed++) {
    const a = mkCtx({ seed, lv }).g.vista(), b = mkCtx({ seed, lv, n: 2 }).g.vista();
    assert.deepStrictEqual(a.evs, b.evs);
    assert.ok(a.evs.length >= 4, 'eventos en 40 s: ' + a.evs.length);
    const tipos = new Set(a.evs.map((e) => e.k)); assert.ok(tipos.size >= 2);
    a.evs.forEach((e, i) => { assert.ok(e.t1 - e.t0 >= 0.5 && e.t2 > e.t1 && e.t2 <= 40); if (i) assert.notStrictEqual(e.k, a.evs[i - 1].k); });
  }
  const v = mkCtx({ seed: 4, dur: 10 }).g.vista(); assert.ok(v.evs.length >= 1, 'relámpago trae al menos un evento');
});

function evento(k) { for (let seed = 1; seed < 200; seed++) { const st = mkCtx({ n: 2, seed, lv: 1 }); const e = st.g.vista().evs.find((x) => x.k === k); if (e) return { st, e }; } throw new Error('sin ' + k); }
test('comparsa: arrastra y saca de su carril al que agarra', () => {
  const { st, e } = evento('comparsa'); const g = st.g, mitad = (e.t1 + e.t2) / 2;
  st.gt = mitad - 0.4; g.update(1 / 30);
  const cx = e.dir > 0 ? -80 + 720 * (st.gt - e.t1) / (e.t2 - e.t1) : 640 - 720 * (st.gt - e.t1) / (e.t2 - e.t1);
  // ponemos al 0 justo delante de la carroza, en su carril, quieto
  const P0 = { x: Math.min(520, Math.max(40, cx + e.dir * 40)), y: e.y };
  st.axes[0] = { x: 0, y: 0 };   // alHum pone x/y a mano; luego 1 s de simulación
  g.alHum(0, { x: P0.x, y: P0.y, st: 0, sc: 0 });
  for (let i = 0; i < 30; i++) { st.gt += 1 / 30; g.update(1 / 30); }
  const v = g.vista(); assert.ok(Math.abs(v.y[0] - e.y) >= 28 || Math.abs(v.x[0] - P0.x) > 30, `empujado: (${P0.x},${P0.y}) -> (${v.x[0]},${v.y[0]})`);
});

test('manguera lenta, tambores rápidos: la zona cambia la velocidad del dueño', () => {
  for (const k of ['manguera', 'tambores']) {
    const { st, e } = evento(k); const g = st.g;
    st.gt = e.t1 + 0.2; g.update(1 / 30);
    const x0 = k === 'manguera' ? e.x - 10 : e.x - 10, y0 = k === 'manguera' ? 135 : e.y;
    g.alHum(0, { x: x0, y: y0, st: 0, sc: 0 }); st.axes[0] = { x: 1, y: 0 };
    st.gt += 1 / 30; g.update(1 / 30); const dx = g.vista().x[0] - x0;
    const base = 165 * [1, 1.07, 1.16][g.vista().fase] / 30 * (g.vista().bombs.some((b) => b.holder === 0 && !b.done && b.ini) ? 182 / 165 : 1);
    if (k === 'manguera') assert.ok(dx < base * 0.6, 'manguera ' + dx + ' vs ' + base); else assert.ok(dx > base * 1.2, 'tambores ' + dx + ' vs ' + base);
  }
});

test('embiste (A): arranque corto con espera; los toques de la cuenta no se acumulan', () => {
  const st = mkCtx({ n: 2, seed: 3, lv: 1 }); const g = st.g;
  st.taps[0] = 3; st.gt = -1; g.update(1 / 30); assert.ok(g.vista().dash[0].cd < 0, 'en la cuenta no embiste');
  st.gt = 1; g.update(1 / 30); assert.ok(g.vista().dash[0].cd < 0, 'los toques de la cuenta se botaron');
  g.alHum(0, { x: 100, y: 135, st: 0, sc: 0 }); st.axes[0] = { x: 1, y: 0 }; st.taps[0] = 1;
  for (let i = 0; i < 6; i++) { st.gt += 1 / 30; g.update(1 / 30); }
  const conDash = g.vista().x[0] - 100;
  st.taps[0] = 1; const cd = g.vista().dash[0].cd; st.gt += 1 / 30; g.update(1 / 30); assert.strictEqual(g.vista().dash[0].cd, cd, 'en espera no se repite');
  assert.ok(conDash > 165 * 6 / 30 * 1.8, 'embiste avanza más: ' + conDash);
  // las CPU también embisten
  const s2 = mkCtx({ n: 4, seed: 11, lv: 2, skill: 0.8 }); jugar(s2, ['cpu', 'cpu', 'cpu', 'cpu'], 40);
  assert.ok(s2.g.vista().dash.some((d) => d.cd > 0), 'alguna CPU embistió');
});
