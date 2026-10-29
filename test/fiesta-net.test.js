'use strict';
/* fiesta-net.js (M0.5, doc 07 §10 aceptación 2 y 3; doc 09 §14.2): transporte de LA FIESTA sobre el relé en memoria
   (test/helpers/mem-relay.js): fusión latest, deduplicación P2P + relé, mezcla por par, reproducción del búfer, ausencia por hb,
   desfase de reloj, topes de tamaño/tasa, reentrada, orden por ver, y conformidad: bots de DUO/SQUAD sobre channel() sin cambios.
   node --test test/fiesta-net.test.js */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const net = require('../docs/style-lab/fiesta-net.js');
const { memRelay } = require('./helpers/mem-relay.js');
const K = net.K;

/* sienta a `id` con su sesión guardada (reentrada) y espera a que entre */
async function sentar(R, ids, opt = {}) {
  const Ns = ids.map(id => net.create(R.client(id, Object.assign({ storage: R.storage({ [K.SESION]: JSON.stringify(R.session(id)) }) }, opt[id] || opt.all || {}))));
  const ps = Ns.map(N => N.join(R.room.code, {}));
  await R.advance(1500);
  for (const p of ps) assert.equal((await p).status, 200);
  return Ns;
}
const oye = (ch) => { const got = []; ch.onMsg((t, d, role, from) => got.push({ t, d, role, from })); return got; };
const sigDe = (R, id, desde = 0) => R.log.sig.filter(x => x.from === id && x.at >= desde);
function topesRespetados(R) {
  for (const x of R.log.sig) {
    assert.ok(x.count <= 10, `lote de ${x.count} mensajes`);
    assert.ok(x.bytes <= 512, `lote de ${x.bytes} B`);
    assert.ok(![400, 413, 429].includes(x.status), `el relé rechazó un lote (${x.status})`);
  }
}

test('fusión latest: un tipo l se reemplaza en la cola; los fiables llegan todos, en orden y una vez', async () => {
  const R = memRelay({ seed: 3, seats: ['a', 'b'], http: { delay: 75, jitter: 20 } });
  const [A, B] = await sentar(R, ['a', 'b'], { all: { rtc: false } });
  const ca = A.channel('m'), got = oye(B.channel('m'));
  const t0 = R.t;
  for (let i = 0; i < 100; i++) { ca.send('o', { i }, true); ca.send('ev', { i }, false); await R.advance(10); }
  await R.advance(4000);
  const os = got.filter(m => m.t === 'o').map(m => m.d.i), evs = got.filter(m => m.t === 'ev').map(m => m.d.i);
  assert.deepEqual(evs, Array.from({ length: 100 }, (_, i) => i), 'todos los ev, en orden, sin duplicados');
  assert.ok(os.length < 40, `los o se fusionan (${os.length} de 100 llegaron)`);
  assert.equal(os[os.length - 1], 99, 'el último o siempre llega');
  assert.ok(os.every((v, k) => k === 0 || v > os[k - 1]), 'los o nunca retroceden');
  assert.ok(got.every(m => m.role === 0 && m.from === 'a'), 'rol y id del emisor');
  const reqs = sigDe(R, 'a', t0);
  for (let s = t0; s < R.t; s += 250) assert.ok(reqs.filter(x => x.at >= s && x.at < s + 1000).length <= 20, '≤20 peticiones/s');
  topesRespetados(R);
});

test('deduplicación: P2P + relé solapados (con duplicados del relé) entregan cada mensaje una sola vez', async () => {
  const R = memRelay({ seed: 5, seats: ['a', 'b', 'c'], http: { delay: 60, jitter: 30, dup: .25 }, sse: { delay: 20, dup: .25 }, p2p: { pairs: { 'a-b': 'open' } } });
  const [A, B, C] = await sentar(R, ['a', 'b', 'c']);
  await R.advance(3000);
  assert.equal(A.via('b'), 'p2p'); assert.equal(A.via('c'), 'relay');
  const ca = A.channel('m'), gb = oye(B.channel('m')), gc = oye(C.channel('m'));
  for (let i = 0; i < 40; i++) { ca.send('ev', { i }, false); ca.send('o', { i }, true); await R.advance(30); }
  await R.advance(3000);
  for (const [who, got] of [['b', gb], ['c', gc]]) {
    const evs = got.filter(m => m.t === 'ev').map(m => m.d.i);
    assert.equal(new Set(evs).size, evs.length, `${who}: sin ev duplicados`);
    assert.equal(evs.length, 40, `${who}: llegan los 40 ev`);
    const os = got.filter(m => m.t === 'o').map(m => m.d.i);
    assert.ok(os.every((v, k) => k === 0 || v > os[k - 1]), `${who}: o sin duplicados ni retrocesos`);
    assert.equal(os[os.length - 1], 39);
  }
  assert.ok(B._dbg && B.stats.drop > 0, 'b recibió copias por los dos caminos y las descartó');
});

test('envío por par: P2P hacia los abiertos, relé solo si falta alguno; caída automática al relé', async () => {
  const R = memRelay({ seed: 7, seats: ['a', 'b'], http: { delay: 50, jitter: 10 }, p2p: { pairs: { 'a-b': 'open' } } });
  const [A, B] = await sentar(R, ['a', 'b']);
  await R.advance(3000);
  assert.equal(A.via('b'), 'p2p'); assert.match(A.label(), /MS · DIRECTO$/);
  const ca = A.channel('m'), got = oye(B.channel('m'));
  const t0 = R.t, p0 = A.stats.p2p;
  for (let i = 0; i < 100; i++) { ca.send('o', { i }, true); A.pump(); await R.advance(20); }   // pump() = requestAnimationFrame
  await R.advance(500);
  const os = got.filter(m => m.t === 'o');
  assert.ok(os.length >= 60, `con P2P casi no se fusiona (${os.length})`);
  assert.ok(A.stats.p2p - p0 >= 60, 'salió por el canal f');
  const rel = sigDe(R, 'a', t0);
  assert.ok(rel.every(x => x.types.every(t => t === 'hb')), 'con todos los pares abiertos, al relé solo va la presencia');
  assert.ok(rel.length >= 1 && rel.length <= 3, `presencia cada 2 s por HTTP aunque haya P2P (${rel.length})`);
  // el par se cae (agujero negro): en ≤2,5 s deja de estar listo y todo pasa por el relé, sin perder los fiables
  R.setPair('a-b', 'down');
  const t1 = R.t;
  for (let i = 0; i < 40; i++) { ca.send('ev', { i }, false); await R.advance(100); }
  await R.advance(3000);
  assert.equal(A.via('b'), 'relay');
  const evs = got.filter(m => m.t === 'ev').map(m => m.d.i);
  const tarde = evs.filter(i => i >= 30);
  assert.deepEqual(tarde, [30, 31, 32, 33, 34, 35, 36, 37, 38, 39], 'tras la caída, los fiables llegan por el relé');
  assert.ok(sigDe(R, 'a', t1).some(x => x.types.includes('ev')), 'el relé lleva los ev');
  assert.match(A.label(), /RELÉ$/);
  topesRespetados(R);
});

test('mezcla por par con 4 asientos: los pares P2P abiertos y los que no, todos reciben', async () => {
  const R = memRelay({ seed: 11, seats: ['a', 'b', 'c', 'd'], http: { delay: 70, jitter: 40 }, p2p: { pairs: { 'a-b': 'open', 'a-c': 'open', 'b-c': 'open', 'a-d': 'fail', 'b-d': 'fail', 'c-d': 'fail' } } });
  const Ns = await sentar(R, ['a', 'b', 'c', 'd']);
  await R.advance(3000);
  assert.deepEqual(['b', 'c', 'd'].map(id => Ns[0].via(id)), ['p2p', 'p2p', 'relay']);
  const chs = Ns.map(N => N.channel('m')), gots = chs.map(oye);
  for (let i = 0; i < 20; i++) { chs.forEach((ch, k) => ch.send('ev', { k, i }, false)); await R.advance(50); }
  await R.advance(3000);
  gots.forEach((got, me) => {
    for (let k = 0; k < 4; k++) if (k !== me) assert.deepEqual(got.filter(m => m.d.k === k).map(m => m.d.i), Array.from({ length: 20 }, (_, i) => i), `${me} recibe todo de ${k}`);
  });
  assert.equal(Ns[3].seats().find(s => s.id === 'a').via, 'relay');
  assert.ok(Ns[0].seats().every(s => s.you || s.online), 'todos en línea');
});

test('reproducción del búfer: lo que llega antes de onMsg se entrega al registrarse, en orden', async () => {
  const R = memRelay({ seed: 13, seats: ['a', 'b'], http: { delay: 40 } });
  const [A, B] = await sentar(R, ['a', 'b'], { all: { rtc: false } });
  const ca = A.channel('m');
  for (let i = 0; i < 5; i++) ca.send('ev', { i }, false);
  ca.send('xtiro', { p: 1 }, false);
  await R.advance(1500);                                     // b todavía no abrió su canal
  const cb = B.channel('m'), got = [];
  await R.advance(500);
  cb.onMsg((t, d, role, from) => got.push([t, d.i, role, from]));
  assert.deepEqual(got.map(x => x[0]), ['ev', 'ev', 'ev', 'ev', 'ev', 'xtiro']);
  assert.deepEqual(got.slice(0, 5).map(x => x[1]), [0, 1, 2, 3, 4]);
  assert.ok(got.every(x => x[2] === 0 && x[3] === 'a'));
  // los mensajes de un minijuego viejo no se guardan
  R.room.board.mj.k = 2; R.push(); await R.advance(500);
  A.channel('m:1').send('ev', { i: 99 }, false);             // a sigue en m:1 por un instante
  await R.advance(800);
  const c2 = B.channel('m'); assert.equal(c2.scope, 'm:2'); const g2 = oye(c2);
  assert.equal(g2.length, 0, 'nada de m:1 en el búfer de m:2');
});

test('silence(id): segundos desde el último mensaje de cualquier tipo (también hb); Infinity si nunca llegó; crece tras R.offline (DM2-16)', async () => {
  const R = memRelay({ seed: 21, seats: ['a', 'b'], http: { delay: 60, jitter: 20 }, p2p: { pairs: { 'a-b': 'open' } } });
  const [A, B] = await sentar(R, ['a', 'b']);
  assert.equal(typeof A.silence, 'function');
  assert.equal(A.silence('zz'), Infinity, 'asiento del que nunca llegó nada');
  A.channel('m'); B.channel('m');
  await R.advance(3000);
  assert.ok(A.silence('b') < 1.2, 'b manda hb a menudo: silencio corto (' + A.silence('b') + ')');
  R.offline.b = true;
  await R.advance(2500);
  const s1 = A.silence('b'); assert.ok(s1 > 1.8 && s1 < 4, 'tras 2,5 s sin red de b: ' + s1);
  await R.advance(2000); assert.ok(A.silence('b') > s1 + 1.5, 'sigue creciendo');
  R.offline.b = false; await R.advance(2500);
  assert.ok(A.silence('b') < 1.5, 'vuelve a bajar al regresar b');
});

test('ausencia: sin hb durante 2 s el par está ausente; la presencia va por HTTP cada 2 s', async () => {
  const R = memRelay({ seed: 17, seats: ['a', 'b'], http: { delay: 60, jitter: 20 }, p2p: { pairs: { 'a-b': 'open' } } });
  const [A, B] = await sentar(R, ['a', 'b']);
  const ca = A.channel('m'); B.channel('m');
  await R.advance(4000);
  assert.equal(ca.away('b'), false, 'b presente (latido por P2P)');
  assert.ok(R.serverNow() - R.presence.b.at <= 2500 && R.presence.b.vis === 1, 'presencia de b anotada en el servidor (D20)');
  assert.ok(typeof R.presence.b.rtt === 'number' && R.presence.b.rtt > 0, 'el hb lleva el rtt');
  B.setVisible(false);                                       // pestaña oculta: no se manda hb (nunca leave)
  await R.advance(1500); assert.equal(ca.away('b'), false, 'todavía no');
  await R.advance(1200); assert.equal(ca.away('b'), true, 'ausente tras >2 s sin hb');
  const pres = R.presence.b.at;
  await R.advance(3000); assert.equal(R.presence.b.at, pres, 'oculto no manda presencia');
  assert.ok(!R.log.req.some(x => x.owner === 'b' && x.action === 'leave'));
  B.setVisible(true);
  await R.advance(1500); assert.equal(ca.away('b'), false, 'vuelve al estar visible');
  R.offline.b = true;                                        // se le fue el internet
  await R.advance(2600); assert.equal(ca.away('b'), true);
  assert.equal(A.seats().find(s => s.id === 'b').online, true, 'online (6 s) tarda más que away (2 s)');
  await R.advance(4000); assert.equal(A.seats().find(s => s.id === 'b').online, false);
});

async function desfase(seed, http) {
  const R = memRelay({ seed, seats: ['a'], http });
  const skew = Math.round((R.rnd() - .5) * 600000);          // reloj del sistema hasta ±5 min corrido
  const [A] = await sentar(R, ['a'], { all: { skew, rtc: false } });
  const p = A.sync(5, 150); await R.advance(3000); await p;   // ráfaga de la tarjeta
  await R.advance(8000);                                     // más muestras de las respuestas normales (presencia)
  assert.ok(Math.abs(A.at(R.serverNow() + 1000) - A.at(R.serverNow()) - 1) < 1e-6, 'at(): epoch ms → segundos locales');
  return Math.abs(A.serverNow() - R.serverNow());
}
test('reloj: desfase dentro de ±30 ms con 150 ms de jitter en el RTT (25 semillas)', async () => {
  const errs = []; for (let seed = 1; seed <= 25; seed++) errs.push(await desfase(seed, { delay: 30, jitter: 75 }));   // cada tramo U[0,75]: RTT entre 60 y 210 ms
  assert.ok(Math.max(...errs) <= 30, `peor error ${Math.max(...errs).toFixed(1)} ms (${errs.map(e => e.toFixed(0)).join(' ')})`);
});
test('reloj, caso duro: 150 ms de jitter POR TRAMO: ≥95 % dentro de ±30 ms y ninguno pasa de 60', async () => {
  const errs = []; for (let seed = 1; seed <= 40; seed++) errs.push(await desfase(seed, { delay: 30, jitter: 150 }));
  const ok = errs.filter(e => e <= 30).length;
  assert.ok(ok >= .95 * errs.length && Math.max(...errs) <= 60, `${ok}/${errs.length} dentro de ±30; peor ${Math.max(...errs).toFixed(1)} ms`);
});

test('topes del relé: ≤10 mensajes, ≤512 B por lote, ≤25 msg/s; lo que nunca cabe se descarta', async () => {
  const R = memRelay({ seed: 19, seats: ['a', 'b'], http: { delay: 40, jitter: 30 } });
  const logs = [];
  const [A, B] = await sentar(R, ['a', 'b'], { all: { rtc: false }, a: { rtc: false, log: m => logs.push(m) } });
  const ca = A.channel('m'), got = oye(B.channel('m'));
  const t0 = R.t;
  for (let k = 0; k < 30; k++) {                             // inundación: 30 tipos latest + 5 fiables de ~100 B cada 100 ms
    for (let j = 0; j < 30; j++) ca.send('x' + j, { k, pad: 'x'.repeat(30) }, true);
    for (let j = 0; j < 5; j++) ca.send('ev', { k, j, pad: 'y'.repeat(80) }, false);
    await R.advance(100);
  }
  ca.send('xgordo', { pad: 'z'.repeat(600) }, false);
  await R.advance(8000);
  topesRespetados(R);
  const mine = sigDe(R, 'a', t0);
  for (let s = t0; s < R.t; s += 250) {
    const win = mine.filter(x => x.at >= s && x.at < s + 1000);
    assert.ok(win.reduce((a, x) => a + x.count, 0) <= K.MSG_BURST + K.MSG_RATE, 'ventana de 1 s dentro del presupuesto del cliente');
    assert.ok(win.length <= 20, '≤20 peticiones/s');
  }
  const total = mine.reduce((a, x) => a + x.count, 0), segs = (mine[mine.length - 1].at - t0) / 1000;
  assert.ok(total <= 40 + 25 * segs + 1, `media ≤25 msg/s (${total} en ${segs.toFixed(1)} s)`);
  assert.ok(!got.some(m => m.t === 'xgordo') && logs.some(l => /demasiado grande/.test(l)), 'el mensaje de >500 B no se manda');
  const evs = got.filter(m => m.t === 'ev').map(m => m.d.k * 10 + m.d.j);
  assert.ok(evs.every((v, i) => i === 0 || v > evs[i - 1]), 'los fiables que llegan van en orden y sin duplicados');
  for (let j = 0; j < 30; j++) { const xs = got.filter(m => m.t === 'x' + j); assert.equal(xs[xs.length - 1].d.k, 29, `el último x${j} llega`); }
});

test('sesión: salir en partida conserva la clave (afk) y resume() recupera el asiento; en el lobby se borra', async () => {
  const R = memRelay({ seed: 23, seats: ['a', 'b'] });
  const store = R.storage();
  const A = net.create(R.client('z', { storage: store, rtc: false }));
  let p = A.join(R.room.code, { name: 'NUEVA' }); await R.advance(800); const r = await p;
  assert.equal(r.status, 200); const id = A.you.id; assert.equal(id, 'c');
  assert.equal(JSON.parse(store.getItem(K.SESION)).id, 'c');
  p = A.leave(); await R.advance(800); await p;
  assert.equal(R.room.board.pj.c.cpu, 'afk', 'en partida, salir = afk');
  assert.ok(store.getItem(K.SESION), 'la clave se conserva (D13)');
  const A2 = net.create(R.client('z', { storage: store, rtc: false }));
  let gone = 0; A2.onGone(() => gone++);
  p = A2.resume(); await R.advance(800); const r2 = await p;
  assert.equal(r2.status, 200); assert.equal(A2.you.id, 'c'); assert.equal(R.room.board.pj.c.cpu, null, 'volvió: ya no es afk');
  // clave inválida (asiento tomado por otro): 403 → se borra la sesión
  store.setItem(K.SESION, JSON.stringify({ code: R.room.code, id: 'c', key: 'vieja', ts: R.serverNow() }));
  const A3 = net.create(R.client('z', { storage: store, rtc: false }));
  p = A3.resume(); await R.advance(800); assert.equal((await p).status, 403); assert.equal(store.getItem(K.SESION), null);
  // sesión vieja (>6 h): ni se intenta
  store.setItem(K.SESION, JSON.stringify({ code: R.room.code, id: 'c', key: R.keys.c, ts: R.serverNow() - 7 * 3600e3 }));
  assert.equal(await net.create(R.client('z', { storage: store, rtc: false })).resume(), null);
  // en el lobby, salir libera: se borra la sesión
  R.room.board.f = 'lobby'; R.push(); await R.advance(500);
  p = A2.leave(); await R.advance(500); await p;
  assert.equal(store.getItem(K.SESION), null);
  // sala borrada → onGone
  const [B] = await sentar(R, ['b'], { all: { rtc: false } });
  let fue = 0; B.onGone(() => fue++); R.kill(); await R.advance(500);
  assert.equal(fue, 1); assert.equal(B.room, null);
});

test('sala: se ordena por ver (lo viejo se ignora), SSE + sondeo, espectador sin clave', async () => {
  const R = memRelay({ seed: 29, seats: ['a', 'b', 'c', 'd'] });
  const [A] = await sentar(R, ['a'], { all: { rtc: false } });
  const vistos = []; A.onRoom((room, old) => vistos.push(room.ver));
  R.room.board.f = 'turno'; R.push(); await R.advance(400);
  assert.equal(A.board.f, 'turno'); assert.equal(A.ver, R.room.ver);
  const viejo = JSON.parse(JSON.stringify(R.room)); viejo.ver = 1; viejo.board.f = 'lobby';
  assert.equal(A.applyRoom(viejo), false); assert.equal(A.board.f, 'turno');
  // sin SSE (cae), el sondeo trae los cambios
  const es = R.room; es.board.f = 'carta'; es.ver++;           // cambio sin empuje SSE
  await R.advance(9000);
  assert.equal(A.board.f, 'carta', 'el sondeo de respaldo lo trajo');
  assert.deepEqual(vistos.slice().sort((x, y) => x - y), vistos, 'ver monótono');
  // espectador: sala llena
  const S = net.create(R.client('s', { rtc: false }));
  const p = S.join(R.room.code, { name: 'MIRÓN' }); await R.advance(800); await p;
  assert.equal(S.spectating, true); assert.equal(S.you, null);
  const cs = S.channel('m'); assert.equal(cs.role, -1); cs.send('ev', {}, false); await R.advance(500);
  assert.ok(!R.log.sig.some(x => x.from === undefined), 'el espectador no manda');
  // tickIfDue: solo con nextAt vencido
  const n0 = R.log.req.filter(x => x.action === 'tick').length;
  R.room.board.nextAt = R.serverNow() + 5000; R.push(); await R.advance(300);
  A.tickIfDue(); await R.advance(300);
  assert.equal(R.log.req.filter(x => x.action === 'tick').length, n0);
  await R.advance(5000); A.tickIfDue(); await R.advance(300);
  assert.equal(R.log.req.filter(x => x.action === 'tick').length, n0 + 1);
});

test('act: lleva eid del aviso y aid; reintento con el mismo aid; voz sin micrófono', async () => {
  const R = memRelay({ seed: 31, seats: ['a', 'b'] });
  const bodies = [];
  R.handlers.act = b => {
    bodies.push(b);
    if (bodies.length === 3) { R.offline.a = true; R.later(500, () => { R.offline.a = false; }); }   // el servidor lo aplica pero la respuesta se pierde
    return bodies.length === 2 ? { status: 409, body: { error: 'Stale', room: Object.assign(JSON.parse(JSON.stringify(R.room)), { ver: R.room.ver + 5 }) } } : null;
  };
  const [A] = await sentar(R, ['a'], { all: { rtc: false } });
  R.room.board.esp = { id: 7, s: 'a', k: 'DADO' }; R.push(); await R.advance(300);
  let p = A.act({ t: 'TIRAR' }); await R.advance(500); await p;
  assert.equal(bodies[0].eid, 7); assert.equal(bodies[0].a.t, 'TIRAR'); assert.ok(bodies[0].aid);
  p = A.act({ t: 'TIRAR' }); await R.advance(500); const r = await p;
  assert.equal(r.status, 409); assert.equal(A.ver, R.room.ver + 5, 'ante 409 adopta el room del cuerpo');
  p = A.act({ t: 'TIRAR' }); await R.advance(11500); const r3 = await p;
  assert.equal(r3.status, 200, 'tras el timeout se reintenta');
  assert.equal(bodies.length, 4); assert.equal(bodies[3].aid, bodies[2].aid, 'el reintento lleva el mismo aid (idempotente)');
  assert.equal(A.voice.toggle(), false); assert.equal(A.voice.stream, null); assert.equal(A.voice.state('b'), 'none');
});

/* ───────────── conformidad: bots y juegos DUO/SQUAD sobre channel(), sin tocar duo.test.js ni squad.test.js ───────────── */
const root = path.join(__dirname, '..');
const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : stub(), apply: () => stub(), construct: () => stub(), set: () => true });
function sandbox(dirs) {
  const sb = { console, Math, Date, JSON, Array, Object, String, Number, Set, Map, Promise, setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, requestAnimationFrame() {}, addEventListener() {}, performance: { now: () => 0 },
    location: { search: '' }, navigator: { languages: ['en'], language: 'en', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => ({ getContext: () => stub(), addEventListener() {}, style: {} }), documentElement: {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => stub(), addEventListener() {}, body: stub() },
    THREE: stub(), AudioContext: function () {}, Image: function () {}, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
  sb.window = sb; vm.createContext(sb);
  for (const f of ['js/i18n.js', 'js/core.js', 'js/games/du1.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
  for (const f of dirs) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
  vm.runInContext('globalThis.__REGMAP = REGMAP; globalThis.__withSeed = withSeed; globalThis.__setNow = v => { now = v; };', sb);
  return sb;
}
const every = (T, st, k) => { const n = Math.floor(T / k); if (n !== st.n) { st.n = n; return true; } return false; };
/* una ronda con n asientos humanos sobre fiesta-net (mismo bucle que duo.test.js/squad.test.js: 60 Hz, espera del juez 1,5 s) */
async function jugar(sb, id, n, seed, bots, rel) {
  const seats = 'abcd'.slice(0, n).split('');
  const R = memRelay(Object.assign({ seed, seats }, rel));
  const Ns = await sentar(R, seats, { all: { tickMs: 100 } });
  await R.advance(2500);                                     // la malla se calienta durante la tarjeta
  const chs = Ns.map(N => N.channel('m')), e = sb.__REGMAP[id];
  sb.__setNow(0);
  const g = chs.map(ch => sb.__withSeed(seed, () => e.fn(1, ch)));
  g.forEach((x, i) => assert.equal(x.role === undefined ? chs[i].role : x.role, i));
  const bot = bots.map((b, i) => b(g[i], i, { every }));
  chs.forEach((ch, i) => { const orig = ch.h; ch.h = (t, d, from) => { orig(t, d, from); if (bot[i].on) bot[i].on(t, d, ch.seats.find(s => s.id === from).role); }; });
  const dur = g[0].dur, dt = 1 / 60, W8 = 1.5;
  for (let T = 0; T < dur + W8 + .5; T += dt) {
    sb.__setNow(T);
    await R.advance(dt * 1000);
    Ns.forEach(N => N.pump());                               // como requestAnimationFrame
    for (let i = 0; i < n; i++) { const end = dur + (g[i].duoWait ? W8 : 0); if (!g[i].result && T < end) { if (T < dur) bot[i].tick && bot[i].tick(T, dt); g[i].update(dt, T); if (!g[i].result && T + dt >= end) g[i].result = 'lose'; } }
  }
  g.forEach(x => { if (!x.result) x.result = 'lose'; });
  if (process.env.FIESTA_NET_LOG) console.log(id, n, seed, g.map(x => x.result).join('/'), 'dur', dur, 'sig', R.log.sig.length, 'p2p', R.log.p2p, 'rx', Ns.map(N => N.stats.rx).join(','));
  Ns.forEach(N => N.destroy());
  topesRespetados(R);
  return g.map(x => x.result);
}
const REDES = {
  'relé 150 ms': { http: { delay: 60, jitter: 30 }, p2p: { def: 'fail' } },
  'mezcla P2P/relé': { http: { delay: 90, jitter: 40 }, p2p: { pairs: { 'a-b': 'open', 'b-c': 'open' }, def: 'fail', f: { delay: 30, jitter: 15, loss: .05, reorder: .1 } } },
};
const bots = d => fs.readdirSync(path.join(__dirname, d)).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
const DUO = bots('duo-bots'), SQUAD = bots('squad-bots');
REDES['relé 300 ms'] = { http: { delay: 140, jitter: 40 }, p2p: { def: 'fail' } };
test('conformidad DUO: los bots de test/duo-bots juegan sobre channel() y ambas pantallas coinciden', { timeout: 600000 }, async () => {
  const files = DUO.filter(f => fs.existsSync(path.join(root, 'js/games/duo', f + '.js'))).map(f => 'js/games/duo/' + f + '.js');
  const sb = sandbox(files);
  const BOTS = {}; DUO.forEach(f => { const p = path.join(__dirname, 'duo-bots', f + '.js'); if (fs.existsSync(p)) Object.assign(BOTS, require(p)); });
  const ids = Object.keys(BOTS).filter(id => sb.__REGMAP[id] && sb.__REGMAP[id].duo);
  assert.ok(ids.length >= 2, 'hay juegos DUO con bots: ' + ids.join(', '));
  for (const id of ids) for (const red of Object.keys(REDES)) {
    let wins = 0, mismatch = 0; const S = 3;
    for (let k = 1; k <= S; k++) { const r = await jugar(sb, id, 2, 1000 * k + 7, BOTS[id], REDES[red]); if (r.every(x => x === 'win')) wins++; if (new Set(r).size > 1) mismatch++; }
    assert.equal(mismatch, 0, `${id} · ${red}: ambas pantallas coinciden`);
    assert.ok(wins >= S - 1, `${id} · ${red}: los bots ganan ${wins}/${S}`);
  }
  for (const id of ids) { const r = await jugar(sb, id, 2, 4242, [() => ({}), () => ({})], REDES['relé 150 ms']); assert.deepEqual(r, ['lose', 'lose'], `${id}: nadie gana si nadie juega`); }
});
test('conformidad SQUAD: 3 y 4 asientos sobre channel(), un juez y el mismo veredicto en todas las pantallas', { timeout: 600000 }, async () => {
  const files = SQUAD.filter(f => fs.existsSync(path.join(root, 'js/games/squad', f + '.js'))).map(f => 'js/games/squad/' + f + '.js');
  const sb = sandbox(files);
  const BOTS = {}; SQUAD.forEach(f => { const p = path.join(__dirname, 'squad-bots', f + '.js'); if (fs.existsSync(p)) Object.assign(BOTS, require(p)); });
  const ids = Object.keys(BOTS).filter(id => sb.__REGMAP[id] && sb.__REGMAP[id].squad);
  assert.ok(ids.length >= 1, 'hay juegos SQUAD con bots: ' + ids.join(', '));
  for (const id of ids) for (const n of [3, 4]) for (const red of Object.keys(REDES)) {
    let wins = 0, mismatch = 0; const S = 2;
    for (let k = 1; k <= S; k++) { const r = await jugar(sb, id, n, 1000 * k + 7, BOTS[id](n), REDES[red]); if (r.every(x => x === 'win')) wins++; if (new Set(r).size > 1) mismatch++; }
    assert.equal(mismatch, 0, `${id} x${n} · ${red}: todas las pantallas coinciden`);
    assert.ok(wins >= S - 1, `${id} x${n} · ${red}: los bots ganan ${wins}/${S}`);
  }
});
