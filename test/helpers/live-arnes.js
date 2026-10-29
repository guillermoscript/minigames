'use strict';
/* LA FIESTA · arnés de red de los minijuegos EN VIVO (M2, extraído en M3-TEAMS DM3-11).
   crearSala(o) lleva la sala REAL de party.js hasta la tarjeta del primer minijuego y fuerza juego/formato; arnes(o) conecta N clientes reales
   (fiesta-net + LIVE.create) a un relé en memoria con retardo, jitter y pérdida (helpers/mem-relay.js).
   Opciones de formato (M3): tipo 'ffa'|'1v1'|'2v2'|'1v3' (2v2: a+b contra c+d, o `eq` explícito; 1v3: `solo` = letra del solo, por defecto 'a'; el reductor
   pone al solo al final de la lista de jueces), `as` (duelo 1v1), humans 1..4 (el resto son CPU), game, dur, lv, delay, jitter, loss, p2p, cpuNivel, seed.
   Este archivo NO registra juegos: cada prueba hace require() del/los archivos fiesta-juego-*.js que usa. */
const assert = require('node:assert/strict'), path = require('path');
const root = path.join(__dirname, '..', '..'), SL = path.join(root, 'docs/style-lab');
/* ───────────── el navegador mínimo que los juegos esperan: window = globalThis ───────────── */
globalThis.window = globalThis;
const LIVE = require(path.join(SL, 'fiesta-live.js'));
globalThis.FIESTA.rng = require(path.join(SL, 'fiesta-rng.js'));
globalThis.FIESTA.reglas = require(path.join(SL, 'fiesta-reglas.js'));
const NET = require(path.join(SL, 'fiesta-net.js'));
const P = require(path.join(root, 'pocketbase/pb_hooks/party.js'));
const R0 = P.reglas();
const { memRelay, mulberry32 } = require('./mem-relay.js');
const CAT = {}; R0.CATALOGO.forEach(x => { CAT[x.g] = x; });
const STEP = [33, 33, 34];                                   // 30 fps en milisegundos enteros (el reloj del servidor es entero)

/* ───────────── servidor: la sala REAL de party.js, llevada hasta la tarjeta del primer minijuego ───────────── */
function memStore() {                                        // la misma forma que ghostLimiter de party_routes.js
  const m = new Map();
  return { get: k => m.get(k), set: (k, v) => { m.set(k, v); }, update: (k, fn) => { m.set(k, fn(m.get(k))); }, remove: k => { m.delete(k); }, m };
}
function crearSala(o) {
  const rand = mulberry32(o.seed * 7919 + 13), store = memStore(), t0 = o.t0;
  const F = (room, action, body, now) => P.fiesta(room, action, body || {}, now === undefined ? t0 : now, rand, action === 'join' ? body : null, store);
  const srv = P.fiestaNew('ABCD', t0), keys = {}, ids = [];
  for (let i = 0; i < o.humans; i++) { const j = F(srv, 'join', { name: 'Pana' + i }); keys[j.you.id] = j.you.key; ids.push(j.you.id); }
  if (o.cpuNivel) { srv.board.cfg.cpuNivel = o.cpuNivel; }
  ids.forEach(s => F(srv, 'ready', { id: s }, t0 + 1000));
  F(srv, 'start', { id: 'a' }, t0 + 2000);
  let now = t0 + 2000;
  for (let i = 0; i < 6000 && !(srv.board.f === 'carta' && srv.board.mj && !srv.board.mj.duelo); i++) {          // el tablero se juega solo (los humanos pasan a AFK/CPU)
    for (const s of ids) if (srv.board.pj[s].cpu === 'afk') F(srv, 'back', { id: s }, now);
    now = Math.max(now, srv.board.nextAt || now) + 1; P.fiestaTick(srv, now, store);
  }
  if (!(srv.board.f === 'carta' && srv.board.mj && !srv.board.mj.duelo)) throw new Error('crearSala: no se llegó a un minijuego');
  const mj = srv.board.mj, cat = CAT[o.game];
  mj.cola = [Object.assign({}, mj.cola[0], { g: o.game, dur: o.dur || cat.dur, lv: o.lv || 1, modelo: cat.mo, seed: (o.seed * 104729 + 17) >>> 0 })];
  if (o.as) mj.as = o.as.slice();                              // duelo 1v1: el resto de los humanos mira
  mj.tipo = o.as ? '1v1' : (o.tipo || 'ffa'); mj.eq = mj.as.map(s => [s]); mj.solo = null; mj.rel = 0; mj.clase = cat.cl;
  if (mj.tipo === '1v3') { const so = o.solo || mj.as[0]; mj.solo = so; mj.eq = [[so], mj.as.filter(s => s !== so)]; }   // 1v3: el reductor pone al solo al final de los candidatos a juez
  if (mj.tipo === '2v2') mj.eq = o.eq ? o.eq.map(t => t.slice()) : [[mj.as[0], mj.as[1]], [mj.as[2], mj.as[3]]];             // 2v2: a+b contra c+d (como `equipos` del reductor)
  const hum = ids.filter(s => mj.as.indexOf(s) >= 0);
  if (mj.tipo === '1v3') hum.sort((a, b) => (a === mj.solo) - (b === mj.solo));
  mj.juez = hum[0]; mj.suc = hum.slice(1); mj.e = 0; mj.jz = 0; mj.startAt = null; mj.listos = {};
  srv.ver++; srv.board.ver = srv.ver;
  return { srv, keys, ids, store, rand, now, F };
}

/* ───────────── arnés: N clientes reales (fiesta-net + LIVE.create) sobre el relé en memoria ───────────── */
async function arnes(o) {
  o = Object.assign({ game: 'f_mecate', humans: 3, delay: 150, jitter: null, loss: 0.05, seed: 1, lv: 1, dur: 14, p2p: false, cpuNivel: 2 }, o);
  if (o.jitter === null) o.jitter = Math.round(o.delay / 3);
  const t0 = 1790000000000 + 5000;
  const S = crearSala(Object.assign({ t0 }, o));
  const R = memRelay({ seed: o.seed * 31 + 5, seats: [], http: { delay: o.delay, jitter: o.jitter, loss: 0 }, sse: { delay: Math.round(o.delay / 2), jitter: Math.round(o.jitter / 2), loss: 0 },
    p2p: o.p2p ? Object.assign({ pairs: {}, def: 'open' }, typeof o.p2p === 'object' ? o.p2p : {}) : {}, epoch: t0 });
  R.t = S.now - t0 + 100;                                     // el reloj virtual arranca justo después de la preparación del servidor
  const { srv, store } = S, cache = P.relayCache(store);
  const H = { fallo: {}, perdidas: [], R, srv, store, ids: S.ids, keys: S.keys, o, net: {}, sess: {}, bot: {}, dead: {}, out: [], sigLog: [], calls: [], tipos: new Set(), rechazos: [], reqsOk: 0 };
  const view = () => { const v = JSON.parse(JSON.stringify(P.publicRoom(srv))); v.id = 'room1'; return v; };
  let lastSig = '';
  function mirror() {
    const v = view(), sg = JSON.stringify([v.ver, v.board, v.extra && v.extra.mjw]);
    if (sg === lastSig) return false;
    lastSig = sg;
    if (v.board.f === 'res' && H.resAt === undefined) H.resAt = R.t;
    for (const k of Object.keys(R.room)) delete R.room[k];
    Object.assign(R.room, v);
    R.broadcast('rooms/room1', { action: 'update', record: JSON.parse(JSON.stringify(v)) });
    return true;
  }
  mirror();
  const err = e => { if (e instanceof P.PartyError) return { status: e.status, body: { error: e.message, room: view() } }; throw e; };
  const call = (action, body, client) => {
    const now = R.serverNow();
    try {
      if (action !== 'tick' && action !== 'join') P.auth(srv, String(body.id || ''), String(body.key || ''));
      const before = JSON.stringify([srv.board, srv.extra]);
      const x = P.fiesta(srv, action, body, now, S.rand, action === 'join' ? Object.assign({}, body) : null, store);
      if (JSON.stringify([srv.board, srv.extra]) !== before) cache.invalidate(srv.code);          // DM2-12: invalidar tras el commit
      const out = Object.assign({ room: view() }, x); delete out.del; delete out.back; delete out.took;
      H.calls.push({ at: R.t, action, id: body.id, status: 200, body: { e: body.e, q: body.q } });
      mirror();
      return { status: 200, body: out };
    } catch (e) {
      const r = err(e);
      H.calls.push({ at: R.t, action, id: body.id, status: r.status, error: r.body.error });
      return r;
    }
  };
  ['join', 'ready', 'juez', 'mjfin', 'mjack', 'tick', 'back', 'pick', 'cfg', 'start', 'act', 'commit', 'mine', 'leave'].forEach(a => { R.handlers[a] = (body, client) => call(a, body, client); });
  R.handlers.sig = (body) => {
    const now = R.serverNow();
    try {
      const slim = cache.get(srv.code, () => P.slimRoom(srv), now);                // el relé de producción lee la sala delgada en caché
      P.auth(slim, String(body.id || ''), String(body.key || ''));
      const m = body.m;
      const rec = { at: R.t, from: body.id, sc: body.sc, n: Array.isArray(m) ? m.length : 0, bytes: JSON.stringify(m || []).length, types: [], lens: [] };
      if (Array.isArray(m)) m.forEach(x => { rec.types.push(x && x.t); rec.lens.push(JSON.stringify(x && x.d).length); });
      const msg = P.sigPayload(slim, String(body.id), body.round | 0, m, now, store, body.sc);
      rec.status = 200; rec.dropped = msg === null; H.sigLog.push(rec);
      rec.types.forEach(t => H.tipos.add(t));
      if (msg === null) return { status: 200, body: { ok: true, n: 0, dropped: Array.isArray(m) ? m.length : 1 } };
      R.broadcast('rooms/room1/sig', msg);
      return { status: 200, body: { ok: true, n: 1 } };
    } catch (e) {
      const r = err(e), ts = Array.isArray(body.m) ? body.m.map(x => x && x.t) : [];
      H.rechazos.push({ at: R.t, from: body.id, sc: body.sc, types: ts, status: r.status, error: r.body.error }); H.sigLog.push({ at: R.t, from: body.id, sc: body.sc, status: r.status, types: [], lens: [], bytes: 0, n: 0 });
      return { status: r.status, body: { error: r.body.error } };
    }
  };
  H.gt = () => srv.board.mj && srv.board.mj.startAt != null ? (R.serverNow() - srv.board.mj.startAt) / 1000 : -999;
  H.mj = () => srv.board.mj;

  /* clientes sentados (reentrada con sesión guardada, como tras recargar la página) */
  H.ids.forEach(s => { R.keys[s] = S.keys[s]; });                 // para el vsig (señalización WebRTC) del relé de juguete
  H.ids.forEach(s => {
    const storage = R.storage({ [NET.K.SESION]: JSON.stringify({ code: srv.code, id: s, key: S.keys[s], ts: R.epoch + R.t }) });
    const cl = R.client(s, { storage, rtc: o.p2p ? undefined : false }), f0 = cl.fetch;
    cl.fetch = (url, init) => {                                 // inyección de fallos: la petición NUNCA llega ni responde (el cliente la da por perdida a los 2,5/10 s)
      const m = /\/api\/party\/(\w+)$/.exec(String(url)), a = m && m[1];
      if (a && H.fallo[a] > 0) { H.fallo[a]--; H.perdidas.push({ at: R.t, a, s }); return new Promise(() => {}); }
      return f0(url, init);
    };
    H.net[s] = NET.create(cl);
  });
  const js = H.ids.map(s => H.net[s].join(srv.code, {}));
  await R.advance(3000 + 2 * o.delay);
  for (const j of js) assert.equal((await j).status, 200, 'join');
  H.abrir = () => H.ids.forEach(s => { if (!H.sess[s] && !H.dead[s]) H.sess[s] = LIVE.create({ net: H.net[s], yo: s, strict: true, onGo: x => H.out.push({ s, onGo: x }) }); });

  /* bots: 'idle' (nada) | {skill} (el propio `ai` del juego manejando sess.in) */
  const hold = { };
  const apiBot = (s) => {
    const I = H.sess[s].in;
    return { press: b => I.tap(b || 'a'), hold: (b, v) => { const k = s + b; if (v && !hold[k]) { hold[k] = 1; I.down(b); } else if (!v && hold[k]) { hold[k] = 0; I.up(b); } }, eje: (x, y) => I.axis(x, y) };
  };
  H.eventos = [];
  /* arranque: sesiones abiertas en la tarjeta, ~2,5 s de presencia (para la elección del juez por RTT) y LISTO de todos */
  H.arrancar = async () => {
    R.http.loss = o.loss;
    H.abrir();
    await H.correr(2.6);
    H.ids.forEach(s => H.sess[s].ready());                    // UN solo toque de ¡LISTO!: si la petición se pierde, el runtime la repite
    const t0 = R.t;
    for (let i = 0; i < 400 && H.mj().startAt == null; i++) await H.correr(0.1);
    H.tListo = (R.t - t0) / 1000;
    assert.ok(H.mj().startAt != null, 'startAt fijado');
  };
  H.paso = 0; H.goAt = {}; H.evN = {}; H.log = []; H.solape = 0; H.solapeMax = 0;
  H.correr = async (seg, op) => {
    op = op || {};
    const n = Math.round(seg * 30);
    for (let i = 0; i < n; i++) {
      const ms = STEP[H.paso++ % 3], dt = ms / 1000;
      await R.advance(ms);
      const gt = H.gt();
      const juecesYa = H.ids.filter(s => !H.dead[s] && H.sess[s] && H.sess[s].phase === 'juego' && H.sess[s].esJuez()).length;   // ¿cuántas pantallas se creen juez ahora?
      if (juecesYa > 1) { H.solape += ms; H.solapeMax = Math.max(H.solapeMax, H.solape); } else H.solape = 0;
      for (const ev of H.eventos) if (!ev.hecho && gt >= ev.en) { ev.hecho = true; ev.fn(H); }
      for (const s of H.ids) {
        if (H.dead[s] || !H.sess[s]) continue;
        const sess = H.sess[s], b = H.bot[s];
        if (b && b !== 'idle' && sess.c.yo >= 0 && sess.phase === 'juego' && sess.g && !sess.over) {
          const yo = sess.c.yo; sess.c.skill[yo] = b.skill;
          sess.g.ai(yo, dt, apiBot(s));
        }
        sess.update(dt);
        const t = H.net[s].tickIfDue(); if (t) t.then(null, () => {});
        if (sess.go && H.goAt[s] === undefined) H.goAt[s] = R.t;
        const ev = sess.stats.eventos; for (; (H.evN[s] || 0) < ev.length; H.evN[s] = (H.evN[s] || 0) + 1) H.log.push({ s, rt: R.t, ev: ev[H.evN[s] || 0] });
      }
    }
  };
  /* hasta que el servidor cierre el juego (board.f === 'res') y 3 s más */
  H.cerrar = async (maxSeg) => {
    const lim = H.R.t + (maxSeg || 40) * 1000;
    while (H.srv.board.f !== 'res' && R.t < lim) await H.correr(0.5);
    await H.correr(3);
  };
  H.matar = (s) => { R.offline[s] = true; H.dead[s] = true; };
  H.veredictos = () => { const v = {}; H.ids.forEach(s => { const x = !H.dead[s] && H.sess[s] && H.sess[s].verdict; if (x) v[s] = { h: x.h, sc: x.sc, pl: x.pl, fuente: x.fuente, e: x.e }; }); return v; };
  H.res = () => srv.board.mj && srv.board.mj.res;
  H.jueces = () => { const l = []; H.ids.forEach(s => { if (H.sess[s]) H.sess[s].stats.jueces.forEach(j => l.push({ e: j.e, seat: s })); }); return l; };
  H.mjfin = () => H.calls.filter(c => c.action === 'mjfin');
  /* peticiones por segundo (ventana móvil de 1 s), por cliente y de toda la sala */
  H.reqPorSeg = () => {
    const per = {}, all = R.log.req.map(r => r.at).sort((a, b) => a - b);
    R.log.req.forEach(r => { (per[r.owner] = per[r.owner] || []).push(r.at); });
    const pico = ts => { let mx = 0, j = 0; ts.sort((a, b) => a - b); for (let i = 0; i < ts.length; i++) { while (ts[i] - ts[j] >= 1000) j++; mx = Math.max(mx, i - j + 1); } return mx; };
    const r = { sala: pico(all.slice()) }; Object.keys(per).forEach(s => { r[s] = pico(per[s]); });
    return r;
  };
  H.cerrarTodo = () => { H.ids.forEach(s => { try { H.sess[s] && H.sess[s].close(); H.net[s].destroy(); } catch (e) {} }); };
  return H;
}

module.exports = { arnes: arnes, crearSala: crearSala, memStore: memStore, LIVE: LIVE, CAT: CAT, NET: NET, P: P, R0: R0, STEP: STEP, root: root, SL: SL };
