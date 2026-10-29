'use strict';
// Núcleo de fiesta-live.js sin DOM ni servidor real: un `net` falso con retardo, jitter y pérdida (solo en mensajes `latest`), un
// "servidor" mínimo (CAS de juez, mjfin) y juegos de mentira, uno por modelo. Contrato: docs/mario-party/M2-SPEC.md §4.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const LIVE = require(path.join(__dirname, '..', 'docs/style-lab/fiesta-live.js'));
const U = LIVE.util;

/* ───────────── juegos de mentira ───────────── */
function limites(over) { return Object.assign({ scoreMax: 1000, scoreRate: 40, minT: 5, finTemprano: 0 }, over); }
const carta = { obj: 'x', gana: 'y', como: { tactil: 'A', teclado: 'ESPACIO' }, demos: [{ id: 'mover', txt: 'z' }] };

LIVE.add('f_fakea', {
  name: 'FAKE A', modos: ['ffa', '1v1'], clase: 'rank', modelo: 'A', dur: 10, botones: 1, migra: true, limites: limites(), carta,
  cuerpo: ['sc', 'nn'], discretos: ['nn'],
  mk(c) {
    const sc = [], nn = [];
    for (let p = 0; p < c.n; p++) { sc.push(0); nn.push(0); }
    const plan = c.rngFor('plan').int(1, 1000);
    const g = {
      plan, sc,
      update() { for (let p = 0; p < c.n; p++) { if (c.mio(p)) { const t = c.tap(p, 'a'); sc[p] += t * 10; nn[p] += t; } else { const r = c.remoto(p); if (r) { sc[p] = r.sc; nn[p] = r.nn; } } } },
      draw() {}, ai(p, dt, api) { if (c.rngFor('cpu' + p).next() >= 0) if (Math.floor(c.ahora() * 2) !== (g['l' + p] | 0)) { g['l' + p] = Math.floor(c.ahora() * 2); api.press('a'); } },
      scores() { return sc.slice(); }, cuerpo(p) { return { sc: sc[p], nn: nn[p] }; },
      alRemoto(p, v) { sc[p] = v.sc; nn[p] = v.nn; }
    };
    return g;
  }
});

LIVE.add('f_fakeb', {
  name: 'FAKE B', modos: ['ffa', '1v1'], clase: 'rank', modelo: 'B', dur: 10, botones: 1, migra: true, limites: limites(), carta,
  cuerpo: ['pts'], discretos: ['pts'],
  mk(c) {
    const pts = [], conc = {};
    for (let p = 0; p < c.n; p++) pts.push(0);
    return {
      conc, pts, draw() {}, ai() {}, scores() { return pts.slice(); }, cuerpo(p) { return { pts: pts[p] }; },
      update() { for (let p = 0; p < c.n; p++) if (c.mio(p) && c.tap(p, 'a')) { pts[p] += 1; } },
      claimOk() { return true; },
      concede(id, p) { conc[id] = p; if (p >= 0) pts[p] += 25; }
    };
  }
});

LIVE.add('f_fakec', {
  name: 'FAKE C', modos: ['ffa', '1v1'], clase: 'rank', modelo: 'C', dur: 10, botones: 1, stick: true, migra: true, limites: limites(), carta,
  packN: 9, packDiscretos: [0],
  mk(c) {
    const x = [], pts = [];
    for (let p = 0; p < c.n; p++) { x.push(0); pts.push(0); }
    let k = 0;
    const g = {
      x, pts, draw() {}, update() {}, ai(p, dt, api) { api.eje(c.skill[p] > 0 ? 1 : 0, 0); },
      step(dt) { for (let p = 0; p < c.n; p++) { const e = c.eje(p); x[p] += e.x * 100 * dt; pts[p] += Math.abs(e.x) * 100 * dt + c.tap(p, 'a') * 5; } k++; },
      scores() { return pts.map(v => Math.floor(v)); },
      pack() { return [k].concat(x.map(Math.round)).concat(pts.map(Math.round)).slice(0, 1 + 2 * c.n); },
      unpack(a) { k = a[0]; for (let p = 0; p < c.n; p++) { x[p] = a[1 + p]; pts[p] = a[1 + c.n + p]; } },
      restore(a) { g.unpack(a); },
      predict() {}
    };
    return g;
  }
});

/* 2v2 · C: los taps de cada asiento suman a SU asiento; el equipo es la suma (M3-TEAMS). Con 4 asientos. */
LIVE.add('f_cuerda', {
  name: 'FAKE 2v2', modos: ['2v2'], clase: 'binary', modelo: 'C', dur: 10, botones: 1, stick: true, migra: true, limites: limites({ finTemprano: 1 }), carta,
  packN: 5, packDiscretos: [0, 1, 2, 3, 4],
  mk(c) {
    const sc = [0, 0, 0, 0]; let k = 0;
    const g = {
      sc, draw() {}, update() {}, done: () => false, ai(p, dt, api) { if (c.rngFor('cpu' + p + ':' + Math.floor(c.ahora() * 3)).next() < .15 * c.skill[p]) api.press('a'); },
      step(dt) { for (let p = 0; p < c.n; p++) sc[p] += c.tap(p, 'a'); k++; },
      scores: () => sc.slice(), pack: () => [k].concat(sc), unpack(a) { k = a[0]; for (let p = 0; p < 4; p++) sc[p] = a[1 + p]; }, restore(a) { g.unpack(a); }, predict() {}
    };
    return g;
  }
});

/* ───────────── clúster falso ───────────── */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function cluster(o) {
  const rnd = mulberry(o.seed || 1), n = o.n || 3, letters = ['a', 'b', 'c', 'd'].slice(0, n), humans = o.humans || letters;
  const delay = o.delay === undefined ? 100 : o.delay, jitter = o.jitter === undefined ? 30 : o.jitter, loss = o.loss === undefined ? .05 : o.loss;
  const base = 1790000000000;
  const W = { t: 0, q: [], dead: {}, mute: {}, log: { types: new Set(), mjfin: [], juez: [], sent: [] }, res: null, sess: {}, net: {}, lastRx: {} };
  const board = { f: 'mj', cfg: { cpuNivel: 2 }, pj: {}, mj: { k: 7, i: 0, as: letters.slice(), tipo: o.tipo || 'ffa', eq: o.eq || letters.map(s => [s]), solo: o.solo || null, clase: o.tipo === '2v2' || o.tipo === '1v3' ? 'binary' : 'rank',
    cola: [{ g: o.game, seed: o.seed || 5, dur: o.dur || 10, lv: 1, modelo: 'A' }], juez: humans[0], e: 0, suc: humans.slice(1), startAt: base + 3500, listos: {}, res: null } };
  letters.forEach(s => { board.pj[s] = { cpu: humans.indexOf(s) >= 0 ? null : 'auto', ch: 'mama' }; });
  const room = { players: letters.map(s => ({ id: s, name: s.toUpperCase() })) };
  const lat = () => delay + rnd() * jitter;
  const chans = {};
  function deliver(from, to, t, d, latest) {
    if (W.dead[from] || W.dead[to] || W.mute[from]) return;
    if (latest && rnd() < loss) return;
    W.q.push({ at: W.t + lat(), to, from, t, d: JSON.parse(JSON.stringify(d)) });
  }
  humans.forEach(me => {
    W.lastRx[me] = {};
    letters.forEach(s => { W.lastRx[me][s] = 0; });
    const N = {
      board, room, you: { id: me }, serverNow: () => base + W.t,
      channel() {
        const ch = {
          h: null,
          send(t, d, latest) {
            if (W.dead[me]) return;
            W.log.types.add(t); W.log.sent.push({ me, t, len: JSON.stringify(d).length });
            humans.forEach(s => { if (s !== me) deliver(me, s, t, d, latest); });
          },
          onMsg(fn) { ch.h = fn; }, close() { ch.h = null; }
        };
        chans[me] = ch; return ch;
      },
      silence: id => (W.t - W.lastRx[me][id]) / 1000,
      rtt: () => delay * 2,
      ready() {}, mjack() {},
      juez(b) {
        return new Promise(res => W.q.push({ at: W.t + delay, fn() {
          if (board.mj.e === b.e && board.mj.as.indexOf(me) >= 0) { board.mj.juez = me; board.mj.e++; board.mj.suc = board.mj.suc.filter(x => x !== me); W.log.juez.push({ me, e: board.mj.e }); res({ ok: true, status: 200 }); }
          else res({ ok: false, status: 409 });
        } }));
      },
      mjfin(b) {
        return new Promise(res => W.q.push({ at: W.t + delay, fn() {
          const st = board.mj;
          if (W.res) return res({ ok: true, status: 200 });   // idempotente tras el primero
          if (b.e !== st.e || me !== st.juez) { W.log.mjfin.push({ me, e: b.e, status: 409 }); return res({ ok: false, status: 409 }); }
          W.res = { by: me, e: b.e, h: b.h, sc: b.sc, kk: b.kk }; board.f = 'res'; st.res = W.res;
          W.log.mjfin.push({ me, e: b.e, status: 200 }); res({ ok: true, status: 200 });
        } }));
      }
    };
    W.net[me] = N;
  });
  W.board = board;
  W.open = () => humans.forEach(me => { W.sess[me] = LIVE.create({ net: W.net[me], yo: me, strict: true }); });
  W.bots = {};
  W.eventos = o.eventos || [];
  W.run = async function (sec) {
    const end = W.t + sec * 1000, dt = 1000 / 30;
    while (W.t < end) {
      W.t += dt;
      W.q.sort((a, b) => a.at - b.at);
      while (W.q.length && W.q[0].at <= W.t) {
        const m = W.q.shift();
        if (m.fn) m.fn();
        else if (!W.dead[m.to] && !W.dead[m.from]) { W.lastRx[m.to][m.from] = W.t; const ch = chans[m.to]; if (ch && ch.h) ch.h(m.t, m.d, 0, m.from); }
      }
      // latidos (los consume el transporte real)
      if (Math.floor(W.t / 500) !== Math.floor((W.t - dt) / 500)) humans.forEach(s => { if (!W.dead[s] && !W.mute[s]) humans.forEach(r => { if (r !== s && !W.dead[r]) W.lastRx[r][s] = W.t; }); });
      W.eventos.forEach(ev => { if (!ev.hecho && W.t / 1000 >= ev.en) { ev.hecho = 1; ev.fn(W); } });
      humans.forEach(me => {
        if (W.dead[me]) return;
        const s = W.sess[me];
        const bot = W.bots[me];
        if (bot && s.phase === 'juego') { if (rnd() < bot) { s.in.tap('a'); } s.in.axis(1, 0); }
        s.update(1 / 30);
      });
      await new Promise(r => setImmediate(r));
    }
  };
  return W;
}

/* ───────────── pruebas ───────────── */
test('util: hashRes estable, normSurvival idempotente y con racimos', () => {
  assert.strictEqual(U.hashRes([1, 2], [2, 1], 30), U.hashRes([1, 2], [2, 1], 30));
  assert.notStrictEqual(U.hashRes([1, 2], [2, 1], 30), U.hashRes([1, 3], [2, 1], 30));
  const a = U.normSurvival([100, 98, 96, 50, 49, 10]);
  assert.deepStrictEqual(a, [100, 100, 100, 50, 50, 10]);
  assert.deepStrictEqual(U.normSurvival(a), a);
  assert.deepStrictEqual(U.puestos('ffa', [0, 1, 2], [5, 9, 5], 'rank'), [2, 1, 2]);
  assert.deepStrictEqual(U.puestos('1v1', [0, 1], [400, 398], 'survival'), [1, 1]);
  assert.strictEqual(U.suave(0, 5, 1), 0); assert.strictEqual(U.suave(0, 30, 1), 8); assert.strictEqual(U.suave(0, 90, 1), 90);
});

test('add: valida campos, modelo y catálogo', () => {
  assert.throws(() => LIVE.add('f_malo', { name: 'x' }), /falta/);
  assert.throws(() => LIVE.add('malo', {}), /id inválido/);
  assert.throws(() => LIVE.add('f_malo2', Object.assign({}, LIVE.get('f_fakea'), { modelo: 'Z' })), /modelo/);
  assert.throws(() => LIVE.add('f_malo3', Object.assign({}, LIVE.get('f_fakec'), { packN: 0 })), /packN|C exige/);
  assert.ok(LIVE.ids().indexOf('f_fakea') >= 0);
  assert.deepStrictEqual(LIVE.RESERVED.indexOf('hb') >= 0, true);
});

test('c.send: tipos reservados lanzan en strict, x* pasa', async () => {
  const W = cluster({ game: 'f_fakea', n: 2, seed: 3 });
  W.open();
  const c = W.sess.a.c;
  assert.throws(() => c.send('end', {}), /no permitido/);
  assert.throws(() => c.send('xTiro', {}), /no permitido/);
  assert.throws(() => c.send('xok', { s: 'x'.repeat(300) }), /200/);
  assert.strictEqual(c.send('xok', { v: 1 }), true);
});

for (const delay of [50, 150, 300]) {
  for (const game of ['f_fakea', 'f_fakec']) {
    test(`mismo veredicto en todas las pantallas (${game}, ${delay} ms, 5% pérdida)`, async () => {
      const W = cluster({ game, n: 3, humans: ['a', 'b', 'c'], delay, jitter: delay / 3, seed: delay + 1 });
      W.open(); W.bots = { a: .1, b: .05, c: 0 };
      await W.run(3.5 + 10 + 4);
      const vs = ['a', 'b', 'c'].map(s => W.sess[s].verdict);
      vs.forEach(v => assert.ok(v, 'todas tienen veredicto'));
      assert.strictEqual(new Set(vs.map(v => v.h)).size, 1, 'mismo h');
      assert.ok(W.res, 'el servidor aceptó un mjfin');
      assert.strictEqual(W.res.h, vs[0].h);
      assert.strictEqual(W.log.mjfin.filter(x => x.status === 200).length >= 1, true);
      assert.deepStrictEqual(W.log.sent.filter(m => m.len > 420), [], 'ningún mensaje > 420 B');
      // presupuesto: ≤ 20 req/s por cliente es del transporte; aquí, tipos
      W.log.types.forEach(t => assert.ok(LIVE.RESERVED.indexOf(t) >= 0 || /^x[a-z0-9]{1,11}$/.test(t), 'tipo permitido ' + t));
      // humano activo no queda detrás del ocioso
      assert.ok(vs[0].sc[0] >= vs[0].sc[2], 'activo >= ocioso');
    });
  }
}

test('exactamente un juez y un solo mjfin aceptado', async () => {
  const W = cluster({ game: 'f_fakea', n: 3, seed: 9 });
  W.open(); W.bots = { a: .1, b: .1, c: .1 };
  await W.run(18);
  const jueces = ['a', 'b', 'c'].filter(s => W.sess[s].esJuez());
  assert.deepStrictEqual(jueces, ['a']);
  const todos = ['a', 'b', 'c'].reduce((acc, s) => acc.concat(W.sess[s].stats.jueces), []);
  assert.strictEqual(todos.length, 1, 'solo un emisor de end por época');
  assert.strictEqual(W.log.mjfin.filter(x => x.status === 200).length, 1);
});

for (const [game, en] of [['f_fakea', 5.2], ['f_fakec', 7.9], ['f_fakea', 11.3]]) {
  test(`juez muerto a los ${en}s (${game}): migra, un solo veredicto aceptado, e=1`, async () => {
    const W = cluster({ game, n: 3, seed: 21, eventos: [{ en, fn: w => { w.dead.a = true; } }] });
    W.open(); W.bots = { a: .1, b: .1, c: .1 };
    await W.run(3.5 + 10 + 7);
    assert.strictEqual(W.board.mj.e, 1);
    assert.strictEqual(W.board.mj.juez, 'b');
    assert.ok(W.res, 'hay resultado');
    assert.strictEqual(W.res.e, 1);
    assert.strictEqual(W.log.mjfin.filter(x => x.status === 200).length, 1);
    const vb = W.sess.b.verdict, vc = W.sess.c.verdict;
    assert.ok(vb && vc);
    assert.strictEqual(vb.h, vc.h);
    assert.strictEqual(W.res.h, vb.h);
  });
}

test('asiento caído: ev cpu en [2.0, 3.5] s tras callar, regreso: ev hum', async () => {
  const W = cluster({ game: 'f_fakea', n: 3, seed: 4, dur: 14, eventos: [{ en: 7, fn: w => { w.mute.c = true; } }, { en: 11.5, fn: w => { w.mute.c = false; } }] });
  W.open(); W.bots = { a: .1, b: .1, c: .1 };
  const eventos = () => W.sess.a.stats.eventos;
  await W.run(3.5 + 14 + 3);
  const cpu = eventos().filter(e => e.ty === 'cpu' && e.p === 2)[0], hum = eventos().filter(e => e.ty === 'hum' && e.p === 2)[0];
  assert.ok(cpu, 'ev cpu'); assert.ok(hum, 'ev hum');
  const tCaida = 7 + 3.5 /* mute a gt 7 s ⇒ tiempo de mundo 7 */;
  const wAt = cpu.at;   // reloj de la sesión (s desde su creación)
  assert.ok(wAt > 0);
  assert.ok(hum.at > cpu.at);
  const silencio = (cpu.at - 7);
  assert.ok(silencio >= 1.9 && silencio <= 3.6, 'detección en ventana: ' + silencio);
  assert.ok(tCaida > 0);
  assert.ok(W.sess.b.stats.eventos.some(e => e.ty === 'cpu' && e.p === 2), 'el otro la vio');
  assert.ok(W.sess.a.hud().items[2].cpu === false, 'volvió a humano');
});

test('modelo B: dos reclamos simultáneos, gana el t menor y el otro recibe "no"', async () => {
  const W = cluster({ game: 'f_fakeb', n: 3, seed: 6, delay: 60, jitter: 10, loss: 0 });
  W.open();
  await W.run(3.5 + 1);
  const res = {};
  W.sess.b.c.claim('tr1', r => { res.b = r; });
  await W.run(.02);
  W.sess.c.c.claim('tr1', r => { res.c = r; });
  await W.run(1);
  assert.strictEqual(res.b, 'ok'); assert.strictEqual(res.c, 'no');
  assert.strictEqual(W.sess.a.g.conc.tr1, 1);
  assert.strictEqual(W.sess.c.g.conc.tr1, 1);
});

test('modelo B: el claim sin juez vivo expira a "no" por TTL', async () => {
  const W = cluster({ game: 'f_fakeb', n: 2, seed: 8, eventos: [{ en: 4.6, fn: w => { w.dead.a = true; } }] });
  W.open();
  await W.run(3.5 + 1);
  let r = null;
  W.sess.b.c.claim('tr9', x => { r = x; });
  await W.run(.1);
  assert.strictEqual(r, null);
  await W.run(3.5);
  assert.ok(r === 'no' || r === 'ok', 'resuelve');
});

test('verdict propio se reemplaza por un end tardío; el juez no marca fuente end', async () => {
  const W = cluster({ game: 'f_fakea', n: 2, seed: 12 });
  W.open(); W.bots = { a: .1, b: .1 };
  await W.run(3.5 + 10 + 0.5);
  await W.run(4);
  assert.strictEqual(W.sess.a.verdict.fuente, 'propio');
  assert.strictEqual(W.sess.b.verdict.fuente, 'end');
});

test('modelo C: fairDelay y predicción no rompen el veredicto; pack ≤ 300 B', async () => {
  const W = cluster({ game: 'f_fakec', n: 2, seed: 15, delay: 120, jitter: 20 });
  W.open(); W.bots = { a: .1, b: .1 };
  await W.run(3.5 + 6);
  assert.ok(W.sess.a.stats.sent.s > 20, 'el juez publica snapshots');
  assert.ok(!W.sess.b.stats.sent.s, 'el no juez no');
  assert.ok(W.log.sent.filter(m => m.t === 's').every(m => m.len <= 300));
  assert.ok(W.sess.b.g.pts[0] > 0, 'b ve avanzar a a');
});

test('práctica: no abre red, termina y reinicia', () => {
  const P = LIVE.practice('f_fakea', { seed: 7 });
  assert.strictEqual(P.sess.c.practica, true);
  let t = 0;
  while (!P.fin && t < 40) { P.in.tap('a'); P.update(1 / 30); t += 1 / 30; }
  assert.ok(P.fin, 'terminó');
  assert.ok(P.sess.verdict.sc.length === 2);
  P.reiniciar(); assert.strictEqual(P.fin, false);
  const C = LIVE.practice('f_fakec', { seed: 3 });
  for (let i = 0; i < 90; i++) { C.in.axis(1, 0); C.update(1 / 30); }
  assert.ok(C.sess.g.x[0] > 0);
  P.close(); C.close();
});

test('cuenta 3-2-1 y fases', async () => {
  const W = cluster({ game: 'f_fakea', n: 2, seed: 2 });
  W.open();
  const s = W.sess.a;
  W.board.mj.startAt = null; assert.strictEqual(s.phase, 'carta'); assert.strictEqual(s.cuenta(), null);
  W.board.mj.startAt = 1790000000000 + 3500;
  await W.run(.6);
  assert.strictEqual(s.phase, 'cuenta'); assert.strictEqual(s.cuenta().n, 3);
  await W.run(1); assert.strictEqual(s.cuenta().n, 2);
  await W.run(1); assert.strictEqual(s.cuenta().n, 1);
  await W.run(1.0); assert.strictEqual(s.cuenta().n, 0);
  await W.run(1); assert.strictEqual(s.phase, 'juego'); assert.strictEqual(s.cuenta(), null);
});


/* ───────────── M3-TEAMS: un 2v2 modelo C sobre la red falsa ───────────── */
for (const delay of [50, 150, 300]) {
  test(`2v2 C (${delay} ms, 5% pérdida): mismos puestos de EQUIPO en las 4 pantallas y = a los del servidor; el juez es uno solo`, async () => {
    const W = cluster({ game: 'f_cuerda', n: 4, humans: ['a', 'b', 'c', 'd'], tipo: '2v2', eq: [['a', 'b'], ['c', 'd']], delay, jitter: delay / 3, seed: delay + 7, dur: 10 });
    W.open(); W.bots = { a: .12, b: .12, c: .02, d: .02 };      // a+b teclean 6 veces más que c+d
    await W.run(3.5 + 10 + 4);
    const vs = ['a', 'b', 'c', 'd'].map(s => W.sess[s].verdict);
    vs.forEach(v => assert.ok(v, 'todas tienen veredicto'));
    assert.strictEqual(new Set(vs.map(v => v.h)).size, 1, 'mismo h'); assert.strictEqual(new Set(vs.map(v => v.pl.join())).size, 1, 'mismos puestos');
    const { sc, pl } = vs[0];
    assert.deepStrictEqual(pl, U.puestos('2v2', [0, 0, 1, 1], sc, 'binary'), 'los puestos salen de compara por equipos');
    assert.strictEqual(pl[0], pl[1], 'compañeros, mismo puesto'); assert.strictEqual(pl[2], pl[3]);
    assert.ok(sc[0] + sc[1] > sc[2] + sc[3] && pl[0] === 1 && pl[2] === 2, 'el equipo que más juega gana: ' + JSON.stringify(sc));
    assert.ok(W.res && W.res.h === vs[0].h, 'el servidor aceptó el mismo veredicto');
    assert.deepStrictEqual(['a', 'b', 'c', 'd'].filter(s => W.sess[s].esJuez()), ['a']);
    const h = W.sess.d.hud(); assert.strictEqual(h.tipo, '2v2'); assert.deepStrictEqual(h.items.map(x => x.mate), [false, false, true, false], 'd ve a c como su pana');
    assert.strictEqual(h.items[2].tsc, sc[2] + sc[3], 'marcador del equipo en el HUD de la pantalla remota');
  });
}
test('2v2 C: juez muerto a mitad => migra, un solo veredicto por equipos; asiento caído de un equipo pasa a CPU de ese equipo', async () => {
  const W = cluster({ game: 'f_cuerda', n: 4, humans: ['a', 'b', 'c', 'd'], tipo: '2v2', eq: [['a', 'b'], ['c', 'd']], seed: 31, dur: 10, eventos: [{ en: 5.5, fn: w => { w.dead.a = true; } }] });
  W.open(); W.bots = { a: .1, b: .1, c: .1, d: .1 };
  await W.run(3.5 + 10 + 7);
  assert.strictEqual(W.board.mj.e, 1); assert.strictEqual(W.board.mj.juez, 'b');
  assert.strictEqual(W.log.mjfin.filter(x => x.status === 200).length, 1);
  const vb = W.sess.b.verdict, vc = W.sess.c.verdict, vd = W.sess.d.verdict;
  assert.ok(vb && vc && vd && vb.h === vc.h && vc.h === vd.h && W.res.h === vb.h);
  assert.strictEqual(W.sess.c.hud().items[0].caido, true, 'a (equipo azul) figura como caída y la juega la CPU');
  assert.strictEqual(W.sess.c.hud().items[0].team, 0);
});
