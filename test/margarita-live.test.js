'use strict';
/* Isla de Margarita EN LÍNEA (doc 14 §9, M3): 4 clientes reales (fiesta-net) sobre el relé en memoria, contra la sala REAL de party.js
   con board.tab 'margarita'. Cada «pantalla» hace lo que hace la página: anima el anillo de lotes con MARGA.red.pendientes (salta si le
   falta alguno), contesta SOLO su aviso (con la política de la CPU, como un humano que elige), marca LISTO en la tarjeta y, si es el
   juez, manda mjfin. Una se cae a mitad de partida (su asiento pasa a AFK y lo juega la CPU) y vuelve con su sesión guardada.
   Al final las 4 pantallas muestran exactamente el tablero del servidor (mismo hash), y hubo minijuego de ronda y BRONCA.
   Run: node --test test/margarita-live.test.js */
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
globalThis.window = globalThis;
const root = path.join(__dirname, '..');
const NET = require(path.join(root, 'docs/style-lab/fiesta-net.js'));
const P = require(path.join(root, 'pocketbase/pb_hooks/party.js'));
const RG = P.reglas('margarita');
const G = require(path.join(root, 'docs/margarita/margarita-grafo.js'));
const CPU = require(path.join(root, 'docs/margarita/margarita-cpu.js'));
const RED = require(path.join(root, 'docs/margarita/margarita-red.js'));
const { memRelay, mulberry32 } = require('./helpers/mem-relay.js');
const clone = (x) => JSON.parse(JSON.stringify(x));
const azar = (sem) => { const r = mulberry32(sem); return { next: r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: (l) => l[Math.floor(r() * l.length)] }; };   // la forma del RNG que usa margarita-cpu

// el tablero de hoy no tiene casillas D (¡BRONCA!): para la prueba, una de cada 4 azules lo es (el mismo objeto que lee el reductor del servidor)
G.nodos.filter((n) => n.t === 'B').forEach((n, i) => { if (i % 4 === 1) n.t = 'D'; });

function memStore() {
  const m = new Map();
  return { get: (k) => m.get(k), set: (k, v) => { m.set(k, v); }, update: (k, fn) => { m.set(k, fn(m.get(k))); }, remove: (k) => { m.delete(k); }, m };
}

test('Margarita en línea: 4 pantallas, minijuego de ronda y bronca, una se cae y vuelve; todas terminan iguales al servidor', async () => {
  const t0 = 1790000000000 + 5000, rand = mulberry32(77), store = memStore();
  const F = (room, action, body, now) => P.fiesta(room, action, body || {}, now, rand, action === 'join' ? body : null, store);
  /* ── el servidor: lobby con 4 humanos, 3 rondas ── */
  const srv = P.fiestaNew('MARG', t0, { tab: 'margarita' }), keys = {};
  srv.board.cfg.tot = 3;                                              // el lobby solo ofrece 10/15/20: la prueba corta a 3 rondas
  ['Ana', 'Beto', 'Caro', 'Dani'].forEach((name) => { const j = F(srv, 'join', { name }, t0); keys[j.you.id] = j.you.key; });
  ['b', 'c', 'd'].forEach((s) => F(srv, 'ready', { id: s }, t0 + 1000));
  F(srv, 'start', { id: 'a' }, t0 + 2000);
  assert.equal(srv.board.tab, 'margarita'); assert.equal(srv.board.f, 'orden');

  /* ── el relé: cada acción va a la sala real de party.js; cada cambio sale por el SSE falso (igual que live-arnes.js) ── */
  const R = memRelay({ seed: 9, seats: [], http: { delay: 40, jitter: 20, loss: 0 }, sse: { delay: 20, jitter: 10, loss: 0 }, code: 'MARG', epoch: t0 });
  R.t = 2100;
  const view = () => { const v = clone(P.publicRoom(srv)); v.id = 'room1'; return v; };
  let lastSig = '';
  const mirror = () => {
    const v = view(), sg = JSON.stringify([v.ver, v.board, v.extra && v.extra.mjw]);
    if (sg === lastSig) return;
    lastSig = sg;
    for (const k of Object.keys(R.room)) delete R.room[k];
    Object.assign(R.room, v);
    R.broadcast('rooms/room1', { action: 'update', record: clone(v) });
  };
  mirror();
  const llamadas = [];
  const call = (action, body) => {
    const now = R.serverNow();
    try {
      if (action !== 'tick' && action !== 'join') P.auth(srv, String(body.id || ''), String(body.key || ''));
      const x = P.fiesta(srv, action, body, now, rand, action === 'join' ? Object.assign({}, body) : null, store);
      const out = Object.assign({ room: view() }, x); delete out.del; delete out.back; delete out.took;
      llamadas.push({ at: R.t, action, id: body.id, status: 200 });
      mirror();
      return { status: 200, body: out };
    } catch (e) {
      if (!(e instanceof P.PartyError)) throw e;
      llamadas.push({ at: R.t, action, id: body.id, status: e.status, error: e.message });
      return { status: e.status, body: { error: e.message, room: view() } };
    }
  };
  ['join', 'ready', 'juez', 'mjfin', 'mjack', 'tick', 'back', 'act', 'mine', 'leave'].forEach((a) => { R.handlers[a] = (body) => call(a, body); });
  R.handlers.sig = () => ({ status: 200, body: { ok: true, n: 0 } });   // la página de Margarita no usa el relé de mensajes (el minijuego en vivo vive en su iframe)
  Object.assign(R.keys, keys);

  /* ── las pantallas ── */
  const vistos = { mjRonda: 0, bronca: 0, mjRes: 0, afkC: false, vuelveC: false };
  function conectar(s, sem) {
    const storage = R.storage({ [NET.K.SESION]: JSON.stringify({ code: 'MARG', id: s, key: keys[s], ts: R.epoch + R.t }) });
    const N = NET.create(R.client(s, { storage, rtc: false }));
    const X = { s, N, D: null, snaps: 0, lotes: 0, busy: false, rng: azar(sem), esp: null, fin: null, caida: false, desfases: 0 };
    const ocupar = (p) => { X.busy = true; p.then((r) => { X.busy = false; if (r && !r.ok && r.status !== 409) X.error = (X.error || []).concat([r.status + ' ' + (r.data && r.data.error)]); }); };
    X.paso = () => {
      const B = N.board;
      if (X.caida || !B || B.f === 'lobby') return;
      if (!X.D) { X.D = clone(B); X.snaps++; }
      const p = RED.pendientes(X.D.ver, B);
      if (p.snap) { X.D = clone(B); X.snaps++; }
      for (const l of p.lotes) {
        X.D = RG.proyectar(X.D, l.fx); X.lotes++;
        if (s === 'a') l.fx.forEach((f) => { if (f.k === 'mjIni') { if (f.duelo) vistos.bronca++; else vistos.mjRonda++; } if (f.k === 'mjRes') vistos.mjRes++; });
      }
      if (RG.hash(X.D) !== RG.hash(B)) X.desfases++;                     // al día con la sala, la foto ES el tablero
      N.tickIfDue();
      if (X.busy) return;
      const e = RED.espera(B, s), mj = B.mj;
      if (e === 'mio' && X.esp !== B.esp.id) {
        X.esp = B.esp.id;
        const a = CPU.decide(X.D, RG.vista(X.D, s), s, X.rng) || RG.defecto(X.D, s);
        ocupar(N.act(a));
      } else if (e === 'mj' && B.f === 'carta' && mj.as.indexOf(s) >= 0 && B.pj[s].cpu === null && !mj.listos[s]) ocupar(N.ready({ on: true }));
      else if (e === 'mj' && B.f === 'mj' && mj.juez === s && mj.startAt != null && N.serverNow() >= mj.startAt + mj.cola[mj.i].dur * 1000 + 200 && X.fin !== mj.k + ':' + mj.i) {
        X.fin = mj.k + ':' + mj.i;
        const sc = mj.as.map(() => X.rng.int(0, 40)), cpu = mj.as.filter((q) => B.pj[q].cpu !== null);
        ocupar(N.mjfin({ q: mj.i, e: mj.e, kk: X.rng.int(1, 1000), sc, cpu }));
      }
    };
    return X;
  }
  const P4 = {};
  ['a', 'b', 'c', 'd'].forEach((s, i) => { P4[s] = conectar(s, 100 + i); });
  const joins = Object.keys(P4).map((s) => P4[s].N.join('MARG', {}));
  await R.advance(500);
  for (const j of joins) assert.equal((await j).status, 200, 'cada pantalla entra con su sesión guardada');

  /* ── la partida: pasos de 100 ms de reloj virtual; 'c' se cae en la ronda 2 y vuelve 90 s después ── */
  let caidaAt = null;
  for (let i = 0; i < 20000 && srv.board.f !== 'fin'; i++) {
    await R.advance(100);
    for (const s in P4) P4[s].paso();
    if (caidaAt === null && srv.board.r >= 2 && srv.board.f === 'turno') { caidaAt = R.t; P4.c.caida = true; P4.c.N.destroy(); }
    if (srv.board.pj.c.cpu === 'afk') vistos.afkC = true;
    if (caidaAt !== null && !vistos.vuelveC && R.t - caidaAt > 90000) {
      vistos.vuelveC = true;
      P4.c = conectar('c', 200);
      const r = await Promise.race([P4.c.N.join('MARG', {}), R.advance(500).then(() => null)]);
      assert.ok(r === null || r.status === 200, 'vuelve con su sesión');
    }
  }
  for (let i = 0; i < 40; i++) { await R.advance(100); for (const s in P4) P4[s].paso(); }   // las pantallas terminan de animar

  assert.equal(srv.board.f, 'fin', 'la partida terminó'); assert.equal(srv.state, 'done'); assert.equal(srv.board.r, 3);
  assert.ok(vistos.mjRonda >= 1, 'hubo minijuego de ronda'); assert.ok(vistos.bronca >= 1, 'hubo ¡BRONCA!'); assert.ok(vistos.mjRes >= 2, 'y se pagaron');
  assert.ok(vistos.afkC, 'el asiento de la que se cayó pasó a AFK (lo jugó la CPU)'); assert.ok(vistos.vuelveC);
  const H = RG.hash(srv.board);
  for (const s in P4) {
    const X = P4[s];
    assert.equal(RG.hash(X.D), H, s + ': la pantalla termina igual al servidor');
    assert.equal(X.desfases, 0, s + ': al día, la foto siempre fue el tablero');
    assert.ok(!X.error, s + ': sin errores de red: ' + JSON.stringify(X.error));
  }
  console.log('lotes animados:', Object.keys(P4).map((s) => s + '=' + P4[s].lotes).join(' '), '· rondas de minijuego', vistos.mjRonda, '· broncas', vistos.bronca, '· llamadas', llamadas.length, '· 409', llamadas.filter((c) => c.status === 409).length);
  ['a', 'b', 'd'].forEach((s) => { assert.equal(P4[s].snaps, 1, s + ': un solo salto (al llegar); lo demás, animado'); assert.ok(P4[s].lotes > 40, s + ': animó la partida lote a lote'); });
  assert.equal(P4.c.snaps, 1, 'la que volvió salta una vez a donde va la partida');
  assert.ok(!llamadas.some((c) => c.status >= 500), 'sin errores del servidor');
  const rechazos = llamadas.filter((c) => c.status >= 400 && c.status !== 409);
  assert.deepEqual(rechazos, [], 'sin jugadas inválidas (los 409 son avisos vencidos: carreras normales)');
});
