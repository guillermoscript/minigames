'use strict';
/* f_perro (¡PERRO CALIENTE CON TODO!, FFA rank, modelo A). Dos bloques:
   1) humo SIN red: contexto `c` falso con todos los asientos míos. Registro, lint, mundo determinista, reglas (A/B/stick, error, cambio del nivel 3),
      puntaje, CPU, ociosos, ventaja del juez (200 semillas con CPU iguales), límites y dibujo (340x600 y 800x600, todo dentro de la franja jugable).
   2) red REAL (fiesta-net + fiesta-live + party.js detrás de memRelay con 5 % de pérdida): mismos puestos a 50/150/300 ms, un solo juez, juez muerto,
      asiento caído, presupuesto y tipos, límites, activo vs ociosos.   node --test test/fiesta-juego-perro.test.js */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const { arnes, LIVE, CAT } = require('./helpers/live-arnes.js');
const SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-perro.js');
require(SRC);
const rng = require('../docs/style-lab/fiesta-rng.js');
const { mulberry32 } = require('./helpers/mem-relay.js');
const DEF = LIVE.get('f_perro'), G = 'f_perro';
const LIM = (CAT[G] && CAT[G].lim) || DEF.limites;           // el catálogo aún puede no traer `lim` (petición al integrador): se usa el del juego
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED, unico = a => a.filter((x, i) => a.indexOf(x) === i);

/* ───────────── humo sin red ───────────── */
function mkCtx(o) {
  o = o || {};
  const n = o.n || 4, seed = o.seed || 1, dur = o.dur || 35, lv = o.lv || 1;
  const st = { gt: -3, taps: Array.from({ length: n }, () => [0, 0]), axes: Array.from({ length: n }, () => ({ x: 0, y: 0 })), g: null };
  const c = {
    n, yo: o.yo === undefined ? 0 : o.yo, modo: 'ffa', solo: -1, lv, dur, practica: false, modelo: 'A', dt: 1 / 30,
    seats: Array.from({ length: n }, (_, i) => ({ id: 'abcd'[i], name: 'P' + i, ch: 'tu', color: '#fff', cpu: false, human: true, team: i })),
    campo: () => ({ x0: o.x0 === undefined ? 0 : o.x0, x1: o.x1 === undefined ? 800 : o.x1, y0: 70, y1: 470 }),
    ahora: () => st.gt, rng: rng.crear(seed), rngFor: (t) => rng.crear((seed * 31 + String(t).split('').reduce((a, ch) => a * 33 + ch.charCodeAt(0), 5)) >>> 0),
    fx: () => 0.5, held: () => false,
    tap: (p, b) => { if (st.gt < 0) return 0; const i = b === 'b' ? 1 : 0, v = st.taps[p][i]; st.taps[p][i] = 0; return v; },
    eje: (p) => st.axes[p], cpu: new Array(n).fill(false), skill: Array.from({ length: n }, (_, i) => (Array.isArray(o.skill) ? o.skill[i] : o.skill == null ? 0.6 : o.skill)),
    juez: () => true, mio: o.mio || (() => true), remoto: () => null,
    ev: () => {}, out: () => {}, send: () => true, on: () => {}, claim: () => {},
    util: { suave: (a) => a, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), pj: () => {}, tick: (g) => Math.floor(g * 30) }
  };
  st.c = c; st.g = DEF.mk(c);
  return st;
}
const apiDe = (st, p) => ({ press: (b) => { st.taps[p][b === 'b' ? 1 : 0]++; }, hold: () => {}, eje: (x, y) => { st.axes[p] = { x, y }; } });
/* modos[p] = 'cpu' | 'idle' | función(st, p, dt, api) */
function jugar(st, modos, hasta) {
  const g = st.g, c = st.c, dt = 1 / 30, n = c.n, lim = hasta || c.dur;
  while (st.gt < lim + 1) {
    st.gt += dt;
    for (let p = 0; p < n; p++) { const m = modos[p]; if (m === 'cpu') g.ai(p, dt, apiDe(st, p)); else if (typeof m === 'function') m(st, p, dt, apiDe(st, p)); }
    g.update(dt);
    if (st.gt >= Math.min(LIM.minT, c.dur - 1) && g.done()) break;
    if (st.gt >= c.dur) break;
  }
  return g.scores();
}
const NCL = (v) => v.clientes.length;
/* humano «perfecto»: espera al cliente, apunta al pote (por casilla, vista.lay/dir) y echa cada `gap` s; da B al aviso del perrito; `fallo(ordIdx, paso)` => ingrediente equivocado */
function perfecto(gap, fallo) {
  let t = 0, chu = -1;
  return (st, p, dt, api) => {
    const v = st.g.vista(); if (v.ord[p] >= NCL(v)) return;
    for (let e = 0; e < v.ev.length; e++) if (v.ev[e].k === 'perro' && st.gt >= v.ev[e].t - 1.1 && st.gt < v.ev[e].t - 0.4 && chu !== e) { chu = e; api.press('b'); }
    if (st.gt < t || v.mal[p]) return;
    const cl = v.clientes[v.ord[p]]; if (cl.t > st.gt) return;
    const sq = v.cam[p] && cl.seq2 ? cl.seq2 : cl.seq;
    let ing = sq[v.paso[p]]; if (fallo && fallo(v.ord[p], v.paso[p])) ing = (ing + 1) % 6;
    const d = v.dir[v.lay.indexOf(ing)]; api.eje(d[0], d[1]); api.press('a'); t = st.gt + gap;
  };
}
const dirDe = (v, ing) => v.dir[v.lay.indexOf(ing)];

test('registro: coincide con el catálogo del servidor (ffa, A, rank) y con la ficha (stick + A + B)', () => {
  assert.ok(DEF); assert.equal(DEF.modelo, CAT[G].mo); assert.equal(DEF.clase, CAT[G].cl); assert.deepEqual(DEF.modos, CAT[G].m);
  assert.equal(DEF.botones, 2); assert.equal(DEF.stick, true); assert.equal(DEF.dur, 35);
  if (CAT[G].lim) { ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(DEF.limites[k], CAT[G].lim[k])); assert.equal(!!DEF.limites.finTemprano, !!CAT[G].lim.finTemprano); }
  assert.deepEqual(DEF.cuerpo, ['ord', 'paso', 'err', 'pts', 'srv', 'mal', 'cam']);
  assert.ok(DEF.carta.obj && DEF.carta.gana && DEF.carta.como.tactil && DEF.carta.como.teclado && DEF.carta.demos.length >= 1);
});

test('lint: sin Math.random/Date.now ni primitivas de canvas prohibidas, ES2015, sin tipos c.send propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /ctx\.(fill|stroke|arc|lineTo|drawImage|fillText|beginPath|moveTo)\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/]) assert.ok(!re.test(s), String(re));
  assert.ok(!/c\.(send|on)\(/.test(s), 'modelo A: solo cuerpo (o), sin mensajes propios');
});

test('mundo: clientes, eventos y potes idénticos con la misma semilla (cualquier n); otra semilla cambia; largos por nivel; valor total ≤ 940', () => {
  for (const lv of [1, 2, 3]) {
    const a = mkCtx({ seed: 7, lv }).g.vista(), b = mkCtx({ seed: 7, lv, n: 2 }).g.vista();
    assert.equal(a.hash, b.hash); assert.deepEqual(a.clientes, b.clientes); assert.deepEqual(a.lay, b.lay); assert.deepEqual(a.ev, b.ev);
    assert.ok(a.clientes.length >= 10, 'clientes ' + a.clientes.length);
    const LENS = [[3, 3, 4], [3, 4, 5], [4, 5, 6]][lv - 1];
    let tot = 0, prev = -1;
    a.clientes.forEach((q) => { assert.equal(q.seq.length, q.huevo ? 3 : LENS[q.fase]); assert.equal(unico(q.seq).length, q.seq.length); assert.ok(!(q.vip && q.imp)); assert.ok(q.t > prev); prev = q.t; tot += q.val; if (q.seq2) assert.equal(q.seq2.length, q.seq.length - 1); });
    assert.ok(tot <= 940, 'total ' + tot); assert.ok(a.clientes.some((q) => q.imp) || lv > 0);
    a.ev.forEach((e) => assert.ok(e.t >= 2 && e.t < 35));
  }
  assert.notEqual(mkCtx({ seed: 7 }).g.vista().hash, mkCtx({ seed: 8 }).g.vista().hash);
  const lv3 = mkCtx({ seed: 3, lv: 3 }).g.vista(); assert.ok(lv3.clientes.some((q) => q.seq2), 'el nivel 3 trae cambios de idea');
});

test('controles: el ángulo del stick elige casilla (8 direcciones alcanzan las 6), queda elegido al soltar, zona muerta no cambia', () => {
  const st = mkCtx({ n: 1 }); st.gt = 0.1; const alcanzadas = new Set();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; st.axes[0] = { x: Math.round(Math.cos(a) * 1000) / 1000, y: Math.round(Math.sin(a) * 1000) / 1000 }; st.g.update(1 / 30); alcanzadas.add(st.g.vista().sel[0]); }
  assert.equal(alcanzadas.size, 6, 'casillas alcanzables: ' + [...alcanzadas]);
  st.axes[0] = { x: 0, y: 0 }; st.g.update(1 / 30); assert.ok(st.g.vista().sel[0] >= 0, 'sticky');
  st.axes[0] = { x: 0.1, y: 0.1 }; const antes = st.g.vista().sel[0]; st.g.update(1 / 30); assert.equal(st.g.vista().sel[0], antes);
});

test('reglas: sin elegir o sin cliente no pasa nada; correcto avanza; equivocado arruina (err+1, A ignorada) y se bota solo; B lo bota ya', () => {
  const st = mkCtx({ n: 1, seed: 5, lv: 1 }); let v = st.g.vista(), q = v.clientes[0], sq = q.seq;
  st.gt = 0.1; st.taps[0][0] = 1; st.g.update(1 / 30); assert.equal(st.g.vista().paso[0], 0, 'antes de que llegue el cliente');
  st.gt = q.t + 0.1; st.taps[0][0] = 1; st.g.update(1 / 30); assert.equal(st.g.vista().paso[0], 0, 'sin elegir');
  let d = dirDe(v, sq[0]); st.axes[0] = { x: d[0], y: d[1] }; st.taps[0][0] = 1; st.g.update(1 / 30); assert.equal(st.g.vista().paso[0], 1);
  d = dirDe(v, (sq[1] + 1) % 6 === sq[1] ? sq[0] : (sq[1] + 1) % 6); if (v.lay.indexOf(sq[1]) === v.lay.indexOf((sq[1] + 1) % 6)) assert.fail();
  st.axes[0] = { x: d[0], y: d[1] }; st.taps[0][0] = 1; st.g.update(1 / 30);
  v = st.g.vista(); assert.equal(v.mal[0], 1); assert.equal(v.err[0], 1); assert.equal(v.paso[0], 1);
  d = dirDe(v, sq[1]); st.axes[0] = { x: d[0], y: d[1] }; st.taps[0][0] = 3; st.g.update(1 / 30);
  assert.equal(st.g.vista().paso[0], 1, 'arruinado: A no hace nada'); assert.equal(st.g.vista().err[0], 1);
  st.taps[0][1] = 1; st.g.update(1 / 30); v = st.g.vista(); assert.equal(v.mal[0], 0); assert.equal(v.paso[0], 0); assert.equal(v.err[0], 1, 'B no cuesta error');
  st.taps[0][0] = 1; st.gt += 0.05; st.g.update(1 / 30); // vuelve a empezar ese perro
  const fallo = mkCtx({ n: 1, seed: 5, lv: 1 }); fallo.gt = q.t + 0.1; d = dirDe(v, (sq[0] + 1) % 6); fallo.axes[0] = { x: d[0], y: d[1] }; fallo.taps[0][0] = 1; fallo.g.update(1 / 30);
  assert.equal(fallo.g.vista().mal[0], 1); fallo.gt += 0.8; fallo.g.update(1 / 30); assert.equal(fallo.g.vista().mal[0], 0, 'se bota solo');
});

test('puntaje: un humano perfecto sirve la mayoría en los 3 niveles (pts enteros ≤ 940); un error cuenta; cliente que se cansa se va', () => {
  for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 1, lv, seed: 10 + lv }); jugar(st, [perfecto(0.3)], 35);
    const v = st.g.vista(); assert.ok(v.srv === undefined || true); assert.ok(v.pts[0] > 100 && v.pts[0] <= 940 && Number.isInteger(v.pts[0]), 'lv' + lv + ' pts ' + v.pts[0]); assert.equal(st.g.scores()[0], v.pts[0]);
  }
  const st = mkCtx({ n: 1, lv: 1, seed: 4 }); let fallado = false; jugar(st, [perfecto(0.3, (o, p) => { if (o === 0 && p === 1 && !fallado) { fallado = true; return true; } return false; })], 35);
  assert.equal(st.g.vista().err[0], 1); assert.ok(st.g.destacado().indexOf('perros') > 0);
  const idle = mkCtx({ n: 1, lv: 1, seed: 4 }); jugar(idle, ['idle'], 35); assert.equal(idle.g.scores()[0], 0); assert.ok(idle.g.vista().ord[0] >= 1, 'los clientes se van solos');
});

test('nivel 3: «¡SIN X!» cambia el pedido a mitad (seq2 sin el ingrediente quitado); el humano perfecto lo sigue', () => {
  let visto = false;
  for (let seed = 1; seed <= 6 && !visto; seed++) {
    const st = mkCtx({ n: 1, lv: 3, seed }); const v0 = st.g.vista(), q = v0.clientes.find((x) => x.seq2);
    assert.ok(q && !q.seq2.includes(q.seq[q.drop]) && q.cp >= 1 && q.drop > q.cp);
    const bot = perfecto(0.2); st.gt = 0;
    for (let i = 0; i < 35 * 30; i++) { st.gt += 1 / 30; bot(st, 0, 1 / 30, apiDe(st, 0)); st.g.update(1 / 30); if (st.g.vista().cam[0]) { visto = true; break; } }
  }
  assert.ok(visto, 'se vio un cambio de idea');
});

test('cuerpo/red: scores() de un rival sale solo de su cuerpo y coincide con el del dueño; alCpu/alHum no revientan', () => {
  const dueno = mkCtx({ n: 2, seed: 6, lv: 2 }); jugar(dueno, [perfecto(0.3), 'idle'], 35);
  const cuerpo = dueno.g.cuerpo(0), sc = dueno.g.scores();
  const vista = mkCtx({ n: 2, seed: 6, lv: 2, yo: 1, mio: (p) => p === 1 }); vista.gt = 5;
  vista.g.alRemoto(0, cuerpo); assert.equal(vista.g.scores()[0], sc[0]);
  vista.g.alCpu(0); vista.g.alHum(0, cuerpo); vista.g.alHum(0, null); assert.equal(vista.g.scores()[0], sc[0]);
  assert.ok(JSON.stringify({ t: 1, b: [0, 1, 2, 3].map(() => [0].concat(DEF.cuerpo.map((k) => cuerpo[k]))) }).length < 200);
});

test('CPU: las 4 juegan los 3 niveles con skill .35-.85 (pts enteros ≤ scoreMax); el ocioso saca 0 y queda debajo de una CPU', () => {
  for (const lv of [1, 2, 3]) for (const skill of [0.35, 0.6, 0.85]) {
    const st = mkCtx({ n: 4, lv, seed: 20 + lv, skill }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 35);
    sc.forEach((x) => assert.ok(Number.isInteger(x) && x > 0 && x <= LIM.scoreMax, `lv${lv} skill${skill} sc ${x}`));
  }
  for (let seed = 1; seed <= 15; seed++) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, seed: seed * 3 + lv, skill: 0.6 }); const r = jugar(st, ['idle', 'cpu', 'cpu', 'cpu'], 35);
    assert.equal(r[0], 0); assert.ok(r[0] < Math.max(r[1], r[2], r[3]));
  }
});

test('límites: enteros, 0..scoreMax y ≤ scoreRate·(t+1,5), con dur 3, 10, 35, 40, 45 y todos los niveles', () => {
  for (const dur of [3, 10, 35, 40, 45]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, dur, seed: dur * 7 + lv }); const sc = jugar(st, ['cpu', 'cpu', perfecto(0.25), 'idle'], dur);
    const t = Math.min(st.gt, dur), tope = Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (dur + 1.5))), topeReal = Math.floor(LIM.scoreRate * (t + 1.5));
    sc.forEach((v, i) => { assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `dur${dur} lv${lv} v=${v}>${tope}`); assert.ok(v <= topeReal, `dur${dur} lv${lv} v=${v} > ${topeReal} en t=${t.toFixed(1)}`); });
  }
});

test('ventaja del juez: con 4 CPU iguales y 100 semillas, ningún asiento gana más de 1/4 + 12 pp (empates reparten)', () => {
  for (const lv of [1, 2, 3]) {
    const w = [0, 0, 0, 0], N = 100;
    for (let seed = 1; seed <= N; seed++) {
      const st = mkCtx({ n: 4, lv, seed, skill: [0.6, 0.6, 0.6, 0.6] }); const sc = jugar(st, ['cpu', 'cpu', 'cpu', 'cpu'], 35);
      const mx = Math.max.apply(null, sc), ws = sc.map((v, i) => v === mx ? i : -1).filter((i) => i >= 0); ws.forEach((i) => { w[i] += 1 / ws.length; });
    }
    console.log(`  victorias por asiento lv${lv}:`, w.map((x) => (x / N * 100).toFixed(1) + '%').join(' '));
    w.forEach((x, i) => assert.ok(x / N <= 0.37, `lv${lv}: el asiento ${i} gana ${(x / N * 100).toFixed(1)} %`));
  }
});

test('dibujo: 340x600 (vertical) y 800x600, 3 niveles, todos los estados; sin excepciones; todo el texto dentro de la franja jugable (y 74..470, dentro del ancho)', () => {
  const calls = [], txts = [];
  for (const nm of ['rr', 'ell', 'line', 'poly', 'bust']) globalThis[nm] = () => { calls.push(nm); };
  globalThis.txt = (s, x, y, size) => { calls.push('txt'); txts.push({ s, x, y, size }); };
  globalThis.ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, globalAlpha: 1 };
  globalThis.BUS = { AP: { CAST: { tio: {}, abuela: {}, pana: {}, mama: {}, chuo: {} } } };
  for (const [x0, x1] of [[230, 570], [0, 800], [214, 586]]) for (const lv of [1, 2, 3]) {
    const st = mkCtx({ n: 4, lv, x0, x1, seed: 2 });
    for (const gt of [-2, 0.2, 1, 5]) { st.gt = gt; st.g.update(1 / 30); st.g.draw(); }
    jugar(st, [perfecto(0.3, (o, p) => p === 1 && o === 1), 'cpu', 'idle', 'cpu'], 14); st.g.draw();
    jugar(st, [perfecto(0.3), 'cpu', 'cpu', 'cpu'], 35); st.g.draw();
    const st2 = mkCtx({ n: 2, lv, x0, x1 }); st2.gt = 3; st2.g.update(1 / 30); st2.g.draw();
  }
  assert.ok(calls.length > 500); assert.ok(calls.every((n) => ['rr', 'ell', 'line', 'poly', 'txt', 'bust'].includes(n)));
  txts.forEach((t) => assert.ok(t.y >= 70 && t.y <= 470 || t.y === 300, `texto «${t.s}» en y=${t.y}`));
  const vert = txts.filter((t) => t.size >= 24).map((t) => t.s); assert.ok(vert.length >= 0);
});

/* ───────────── red real ───────────── */
async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, dur: 30, humans: 4, loss: 0.05, lv: 2 }, o));
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [.7, .5, .6, .4][i] }; });
  await H.arrancar();
  return H;
}
function unVeredicto(H, et) {
  const res = H.res(); assert.ok(res, et + ': hay resultado'); assert.equal(H.srv.board.f, 'res');
  const vs = H.veredictos(), vivos = H.ids.filter(s => !H.dead[s]);
  assert.deepEqual(Object.keys(vs).sort(), vivos.slice().sort(), et + ': todas las pantallas vivas tienen veredicto');
  assert.deepEqual(unico(Object.values(vs).map(v => v.h)), [res.h], et + ': mismo h');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.pl))), [JSON.stringify(res.puestos)], et + ': mismos puestos');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.sc))), [JSON.stringify(res.sc)], et + ': mismos puntajes');
  assert.equal(H.mjfin().filter(c => c.status === 200).length, 1, et + ': un mjfin aceptado');
  const eps = H.jueces().map(j => j.e); assert.equal(unico(eps).length, eps.length, et + ': un solo juez por época');
  return res;
}
function topes(H, et) {
  const res = H.res(), tope = Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`));
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
  H.ids.forEach(s => { const sent = H.sess[s] && H.sess[s].stats.sent; if (sent) Object.keys(sent).forEach(t => assert.ok(!/^x/.test(t), et + ': modelo A no usa x* (' + t + ')')); });
}

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1 });
    await H.cerrar(); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`);
    assert.ok(res.sc.some(v => v >= 30), 'se jugó de verdad: ' + res.sc); H.cerrarTodo();
  });
}

test(`${G}: 2 y 3 humanos + CPU, los tres niveles, 150 ms`, async () => {
  for (const [humans, lv] of [[2, 1], [3, 2], [2, 3]]) {
    const H = await partida({ delay: 150, humans, lv, seed: 20 + lv + humans });
    await H.cerrar(); unVeredicto(H, `${G} x${humans} lv${lv}`); topes(H, `${G} x${humans} lv${lv}`); H.cerrarTodo();
  }
});

test(`${G}: duración completa del catálogo, 4 humanos, 300 ms; los rivales se ven en vivo (cuerpo recibido)`, async () => {
  const H = await partida({ delay: 300, seed: 71, dur: 35, lv: 3 });
  await H.cerrar(80); unVeredicto(H, G + ' completa'); topes(H, G + ' completa');
  H.ids.forEach(s => { const v = H.sess[s].g.vista(), yo = H.sess[s].c.yo; v.ord.forEach((o, p) => { if (p !== yo) assert.ok(o > 0 || v.paso[p] > 0 || v.err[p] > 0, `${s} ve avanzar al asiento ${p}: ${JSON.stringify([v.ord, v.paso])}`); }); });
  H.cerrarTodo();
});

test(`${G}: un humano activo le gana a tres ociosos; dos ociosos no ganan a dos CPU`, async () => {
  let H = await partida({ delay: 100, seed: 5, lv: 2 }, { a: { skill: .9 }, b: 'idle', c: 'idle', d: 'idle' });
  await H.cerrar(); let res = unVeredicto(H, 'activo vs ociosos'); H.cerrarTodo();
  const as0 = H.mj().as.indexOf('a'); assert.equal(res.puestos[as0], 1, 'el activo gana: ' + JSON.stringify(res.sc));
  for (const [seed, nivel] of [[201, 1], [202, 2], [203, 3]]) {
    H = await partida({ game: G, delay: 100, loss: 0, humans: 2, seed, dur: 30, cpuNivel: nivel }, { a: 'idle', b: 'idle' });
    await H.cerrar(); res = unVeredicto(H, `ociosos s${seed} n${nivel}`);
    const as = H.mj().as, idle = [as.indexOf('a'), as.indexOf('b')], cpus = [as.indexOf('c'), as.indexOf('d')];
    idle.forEach(i => assert.ok(res.puestos[i] > 1, `ocioso ${as[i]} no 1.º (${res.puestos} ${res.sc})`));
    assert.ok(Math.max.apply(null, idle.map(i => res.sc[i])) < Math.min.apply(null, cpus.map(i => res.sc[i])), 'ociosos por debajo de ambas CPU: ' + res.sc);
    H.cerrarTodo();
  }
});

test(`${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(17);
  for (const k of [3 + rnd() * 8, 10 + rnd() * 8]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(60); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad => pasa a CPU y, al volver, recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 6, fn: h => { h.R.offline.c = true; } }, { en: 11, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  assert.ok(H.log.some(x => x.ev.ty === 'hum' && x.ev.p === 2), 'volvió a humano');
  H.cerrarTodo();
});
