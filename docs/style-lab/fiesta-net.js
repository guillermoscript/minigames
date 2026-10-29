// LA FIESTA · red (M0.5). Transporte autónomo del mundo Venezuela (doc 07 D11/D12/D15/D20/D21, §5.2; doc 09 §§4-8):
// pcall a /api/party/<acción>, SSE + sondeo ordenado por `ver`, cola sig con dos carriles HTTP (latest y fiable, 1 petición en
// vuelo cada uno, ≤10 msg / 512 B por lote, ≤25 msg/s), malla WebRTC POR PAR con caída automática al relé, reloj del servidor
// (muestra de menor RTT de las últimas 10), presencia `hb {rtt, vis}` cada 2 s por HTTP, visibilidad, sesión en localStorage y
// reentrada. Es una ADAPTACIÓN de js/party.js (capa sig), js/link.js y la interfaz de js/voice.js: no los carga ni toca sus globales.
// Todo se inyecta (fetch, EventSource, RTC, reloj, timers, storage), así que corre en Node con fakes (test/helpers/mem-relay.js).
// Sin ?. ni ?? ni spread ni async/await (mismo dialecto que el resto de fiesta-*.js). UMD: window.FIESTA.net / module.exports.
(function (root) {
'use strict';
var F = root.FIESTA = root.FIESTA || {};
var K = {
  SESION: 'minicaos-fiesta-v1', SESION_MS: 6 * 3600 * 1000,
  SIG_GAP: .05, P2P_GAP: .012, HB: .5, PRES: 2, AWAY: 2, ONLINE: 6, AFK_MUDO: 10,
  MAX_B: 500, MAX_N: 10, MSG_RATE: 20, MSG_BURST: 30,   // margen bajo los 25 msg/s (ráfaga 40) del servidor: el jitter junta lotes al llegar
  REQ_RATE: 20, FIABLE_TTL: 5, BUF: 80,
  LINK_OK: 2.5, LINK_DEAD: 5, T_SIG: 2500, T_HTTP: 10000, MUESTRAS: 10, TICK_MS: 100
};
var STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
var NUCLEO = { hb: 1, _net_ping: 1, _net_pong: 1 };     // los consume el transporte: nunca llegan al juego
var noop = function () {};
var parse = function (s) { try { return JSON.parse(s); } catch (e) { return null; } };
var rnd36 = function (n) { var s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); };
var limpio = function (c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); };
var prom = function (x) { return x && typeof x.then === 'function' ? x : Promise.resolve(x); };
var mediana = function (a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; };

function create(o) {
  o = o || {};
  var api = o.api || '';
  var fetchF = o.fetch || function (u, i) { return root.fetch(u, i); };
  var ES = o.EventSource !== undefined ? o.EventSource : (root.EventSource || null);
  var RTC = o.RTC !== undefined ? o.RTC : (root.RTCPeerConnection || null);
  var AC = o.AbortController !== undefined ? o.AbortController : (root.AbortController || null);
  var ice = o.ice || function () { var s = root.CLAUDEWARE_ICE_SERVERS; return Array.isArray(s) && s.length ? s : STUN; };
  var clk = o.clock || function () { return (root.performance ? root.performance.now() : Date.now()) / 1000; };   // nunca el `now` del motor
  var wall = o.wall || function () { return Date.now(); };
  var tSet = o.setTimeout || function (f, ms) { return setTimeout(f, ms); };
  var tClr = o.clearTimeout || function (h) { clearTimeout(h); };
  var iSet = o.setInterval || function (f, ms) { return setInterval(f, ms); };
  var iClr = o.clearInterval || function (h) { clearInterval(h); };
  var store = o.storage !== undefined ? o.storage : (root.localStorage || null);
  var log = o.log || noop, track = o.track || noop, token = o.token || function () { return null; };

  var N = { room: null, board: null, ver: -1, you: null, priv: null, spectating: false, sseOK: false, visible: true,
    stats: { req: 0, msgs: 0, p2p: 0, rx: 0, drop: 0 }, K: K };
  var lis = { room: [], gone: [] };
  var es = null, seq = 0, epoca = rnd36(8);
  var seen = {}, seenK = [], buf = {}, chans = {}, cerrados = {}, pares = {}, links = {};
  var pend = [], lanes = { l: { q: [], busy: false, last: -9, retry: 0 }, r: { q: [], busy: false, last: -9, retry: 0 } };
  var reqAt = [], tokens = K.MSG_BURST, tokAt = clk();
  var hbAt = -99, presAt = -99, relePingAt = -99, p2pAt = -99, linkAt = -99, pollAt = clk(), tickAt = -99;
  var muestras = [];
  var timer = null;

  /* ───────────── HTTP (mismas convenciones que js/party.js pcall) ───────────── */
  function pcall(action, body) {
    var c0 = clk(), h = { 'Content-Type': 'application/json' }, tk = token();
    if (tk) h.Authorization = tk;
    return new Promise(function (res) {
      var hecho = false, ctl = null;
      try { ctl = AC ? new AC() : null; } catch (e) { ctl = null; }
      var fin = function (r) { if (hecho) return; hecho = true; tClr(tm); res(r); };
      var caido = function () { fin({ ok: false, status: 0, data: { error: 'Server unreachable' } }); };
      var tm = tSet(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } caido(); }, action === 'sig' ? K.T_SIG : K.T_HTTP);
      var init = { method: 'POST', headers: h, body: JSON.stringify(body || {}) };
      if (ctl) init.signal = ctl.signal;
      var p; try { p = prom(fetchF(api + '/api/party/' + action, init)); } catch (e) { return caido(); }
      p.then(function (r) {
        return prom(r.json()).then(null, function () { return {}; }).then(function (j) {
          j = j || {};
          if (typeof j.now === 'number') muestra(j.now, c0, clk());
          fin({ ok: !!r.ok, status: r.status, data: j });
        });
      }).then(null, caido);
    });
  }
  var aut = function (b) { b = b || {}; if (N.room) b.code = N.room.code; if (N.you) { b.id = N.you.id; b.key = N.you.key; } return b; };
  var esPerdida = function (r) { return r.status === 404 && r.data && /room not found/i.test(String(r.data.error || '')); };
  function llamar(action, body) {
    return pcall(action, body).then(function (r) {
      if (r.data && r.data.room) aplicar(r.data.room);
      if (esPerdida(r)) perdida();
      return r;
    });
  }

  /* ───────────── reloj del servidor (D15, doc 09 §5.1) ─────────────
     Muestra = {off = now_servidor - punto medio local, rtt}. Base local = reloj monótono (`clk`), así un salto del Date.now() del
     sistema no envenena las muestras. Se usa la de menor RTT de las últimas 10: error ≤ rtt_min / 2. */
  function muestra(now, c0, c1) {
    var rtt = (c1 - c0) * 1000; if (!(rtt >= 0) || rtt > 30000) return;
    muestras.push({ off: now - (c0 + c1) * 500, rtt: rtt });
    if (muestras.length > K.MUESTRAS) muestras.shift();
  }
  /* Cada muestra acota el desfase real en [off - rtt/2, off + rtt/2] (la hora del servidor cae entre el envío y la respuesta).
     Se cruzan los intervalos de las 10 muestras: el resultado nunca es peor que la de menor RTT, que queda como respaldo si el
     cruce sale vacío (deriva, reloj del servidor que salta). */
  function mejor() {
    var b = null, lo = -Infinity, hi = Infinity;
    for (var i = 0; i < muestras.length; i++) {
      var m = muestras[i]; if (!b || m.rtt < b.rtt) b = m;
      lo = Math.max(lo, m.off - m.rtt / 2 - 1); hi = Math.min(hi, m.off + m.rtt / 2 + 1);   // ±1: `now` del servidor es entero
    }
    if (!b) return null;
    return lo <= hi ? { off: (lo + hi) / 2, rtt: Math.min(b.rtt, hi - lo) } : b;
  }
  N.serverNow = function () { var m = mejor(); return m ? clk() * 1000 + m.off : wall(); };
  N.at = function (ms) { var m = mejor(); return m ? (ms - m.off) / 1000 : clk() + (ms - wall()) / 1000; };   // epoch ms → segundos de `clock`
  N.clockErr = function () { var m = mejor(); return m ? m.rtt / 2 : Infinity; };
  N.sync = function (n, gap) {                      // ráfaga a /time (tarjeta del minijuego, volver a primer plano)
    n = n || 5; gap = gap === undefined ? 150 : gap;
    return new Promise(function (res) {
      var i = 0;
      (function uno() { pcall('time', {}).then(function () { if (++i >= n) res(N.serverNow()); else tSet(uno, gap); }); })();
    });
  };

  /* ───────────── sala: SSE + sondeo, orden por `ver` ───────────── */
  N.onRoom = function (fn) { lis.room.push(fn); return function () { lis.room = lis.room.filter(function (f) { return f !== fn; }); }; };
  N.onGone = function (fn) { lis.gone.push(fn); return function () { lis.gone = lis.gone.filter(function (f) { return f !== fn; }); }; };
  function emit(k, a, b) { lis[k].slice().forEach(function (f) { try { f(a, b); } catch (e) { log('[fiesta-net] ' + k + ': ' + e); } }); }
  function masNuevo(R, old) {
    if (typeof R.ver === 'number' && typeof old.ver === 'number') return R.ver > old.ver;   // dos escrituras pueden caer en el mismo ms: manda ver
    if (R.updated && old.updated) return R.updated > old.updated;
    return true;
  }
  function aplicar(R) {
    if (!R || !N.room || R.id !== N.room.id) return false;
    var old = N.room;
    if (!masNuevo(R, old)) return false;
    N.room = R; N.board = R.board || null; if (typeof R.ver === 'number') N.ver = R.ver;
    if (N.you && Array.isArray(R.players) && !R.players.some(function (p) { return p.id === N.you.id; })) { perdida(); return false; }
    emit('room', R, old);
    return true;
  }
  N.applyRoom = aplicar;
  function conectar() {
    desconectar();
    if (!ES || !N.room) return;
    var id = N.room.id, e;
    try { e = new ES(api + '/api/realtime'); } catch (x) { return; }
    es = e;
    e.addEventListener('PB_CONNECT', function (ev) {
      prom(fetchF(api + '/api/realtime', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: ev.lastEventId, subscriptions: ['rooms/' + id, 'rooms/' + id + '/sig', 'rooms/' + id + '/vsig'] }) }))
        .then(function (r) { if (es === e) N.sseOK = !!r.ok; }, function () { if (es === e) N.sseOK = false; });
    });
    e.addEventListener('rooms/' + id, function (ev) { var d = parse(ev.data); if (!d) return; if (d.action === 'delete') perdida(); else aplicar(d.record); });
    e.addEventListener('rooms/' + id + '/sig', function (ev) { var d = parse(ev.data); if (d) recibir(d); });   // PocketBase: sin espacio tras ':'
    e.addEventListener('rooms/' + id + '/vsig', function (ev) { var d = parse(ev.data); if (d) { onLinkSig(d); voz.rx(d); } });
    e.onerror = function () { if (es === e) N.sseOK = false; };    // EventSource reconecta solo y vuelve a disparar PB_CONNECT
  }
  function desconectar() { if (es) { try { es.close(); } catch (x) {} } es = null; N.sseOK = false; }
  function sondear() {
    if (!N.room) return;
    pollAt = clk();
    var id = N.room.id;
    prom(fetchF(api + '/api/collections/rooms/records/' + id)).then(function (r) {
      if (!N.room || N.room.id !== id) return;
      if (r.status === 404) return perdida();
      if (r.ok) return prom(r.json()).then(aplicar);
    }).then(null, noop);
  }
  function cadaSondeo() {                                  // doc 07 §8.4: 8 s con SSE sano; 2 s en el tablero sin SSE; 1 s en mj sin SSE
    if (N.sseOK) return 8;
    var f = N.board && N.board.f;
    return f === 'mj' || f === 'carta' ? 1 : 2;
  }

  /* ───────────── entrar / salir / sesión (D13: salir en partida = afk, se conserva la clave) ───────────── */
  function leerSesion() { if (!store) return null; try { var s = JSON.parse(store.getItem(K.SESION)); return s && s.code && s.id && s.key ? s : null; } catch (e) { return null; } }
  function guardar() { if (!store || !N.room || !N.you) return; try { store.setItem(K.SESION, JSON.stringify({ code: N.room.code, id: N.you.id, key: N.you.key, ts: wall() })); } catch (e) {} }
  function borrar() { if (!store) return; try { store.removeItem(K.SESION); } catch (e) {} }
  function limpiar() {
    desconectar();
    Object.keys(links).forEach(function (id) { cerrarLink(links[id]); });
    links = {}; pares = {}; seen = {}; seenK = []; buf = {}; chans = {}; cerrados = {}; pend = [];
    lanes.l.q = []; lanes.r.q = []; lanes.l.busy = lanes.r.busy = false;
    N.room = null; N.board = null; N.ver = -1; N.you = null; N.priv = null; N.spectating = false;
    voz.cerrar();
  }
  function entrar(data) {
    limpiar();
    N.room = data.room; N.board = data.room && data.room.board || null; N.ver = data.room && typeof data.room.ver === 'number' ? data.room.ver : -1;
    if (data.spectate || !data.you) { N.you = null; N.spectating = true; } else { N.you = data.you; guardar(); }
    conectar(); pollAt = clk(); hbAt = presAt = -99;
    emit('room', N.room, null);
    N.sync(3, 150);
  }
  N.session = leerSesion;
  N.create = function (op) {
    op = op || {};
    return pcall('create', { mode: 'fiesta', name: op.name, color: op.color, ch: op.ch, cfg: op.cfg }).then(function (r) {
      if (r.ok && r.data.room) { entrar(r.data); track('fiesta_create', {}); }
      return r;
    });
  };
  N.join = function (code, op) {
    op = op || {}; code = limpio(code);
    if (code.length !== 4) return Promise.resolve({ ok: false, status: 400, data: { error: 'Bad code' } });
    var s = leerSesion(), body = { code: code, name: op.name, color: op.color, ch: op.ch };
    if (op.seat) body.seat = op.seat;
    var mia = !!s && s.code === code;
    if (mia) { body.id = s.id; body.key = s.key; }              // reentrada automática (también a un asiento afk)
    return pcall('join', body).then(function (r) {
      if (!r.ok) { if (mia && (r.status === 403 || r.status === 404)) borrar(); return r; }
      entrar(r.data);
      track('fiesta_join', { back: mia, spectate: !!r.data.spectate });
      return r;
    });
  };
  N.takeover = function (code, seat, op) {                    // toma de asiento de CPU (D14): es un `join` que pide ese asiento
    op = op || {};
    return N.join(code, { name: op.name, color: op.color, ch: op.ch, seat: seat });
  };
  N.resume = function () {                                     // al arrancar: 'minicaos-fiesta-v1' con menos de 6 h
    var s = leerSesion();
    if (!s) return Promise.resolve(null);
    if (!(wall() - (s.ts || 0) < K.SESION_MS)) { borrar(); return Promise.resolve(null); }
    return N.join(s.code, {});
  };
  N.leave = function () {
    if (!N.room) return Promise.resolve({ ok: true, status: 200, data: {} });
    var lobby = !N.board || N.board.f === 'lobby', p = N.you ? pcall('leave', aut({})) : Promise.resolve({ ok: true, status: 200, data: {} });
    limpiar();
    if (lobby) borrar();                                       // en partida la clave se queda: `resume`/`back` recuperan el asiento
    return p;
  };
  function perdida() { if (!N.room) return; var R = N.room; borrar(); limpiar(); emit('gone', R); }

  /* ───────────── tablero autoritativo (D17: act va contra el aviso) ───────────── */
  N.call = function (action, extra) { return llamar(action, aut(extra)); };
  N.act = function (a) {
    var esp = N.board && N.board.esp, body = aut({ eid: esp ? esp.id : null, aid: rnd36(8), a: a });
    return llamar('act', body).then(function (r) { return r.status === 0 ? llamar('act', body) : r; });   // mismo aid: el reintento es idempotente
  };
  N.commit = function (k, v) { var b = aut({ k: k, aid: rnd36(8), v: v }); return llamar('commit', b).then(function (r) { return r.status === 0 ? llamar('commit', b) : r; }); };
  N.mine = function () { return llamar('mine', aut({})).then(function (r) { if (r.ok && r.data) N.priv = r.data.priv || null; return r; }); };
  N.tick = function () { tickAt = clk(); return N.room ? llamar('tick', { code: N.room.code }) : Promise.resolve(null); };
  N.tickIfDue = function () {
    var b = N.board;
    if (!N.room || !b || !b.nextAt || N.serverNow() < b.nextAt || clk() - tickAt < 1) return null;
    return N.tick();
  };
  ['back', 'ready', 'pick', 'cfg', 'start', 'juez', 'mjfin', 'mjack'].forEach(function (k) {
    N[k] = function (extra) {
      if (k === 'ready' && typeof extra !== 'object') extra = { on: extra !== false };
      if (k === 'pick' && typeof extra === 'string') extra = { ch: extra };
      return N.call(k, extra);
    };
  });

  /* ───────────── recepción: deduplicación, búfer y entrega ───────────── */
  function par(id) { return pares[id] || (pares[id] = { rx: -99, hb: -99, rtt: 0, vis: 1, rr: 0, rrAt: -99 }); }
  function marcar(k, n) { if (seen[k] === undefined) seenK.push(k); seen[k] = n; if (seenK.length > 2048) delete seen[seenK.shift()]; }
  function mjK() { var b = N.board; return b && b.mj && typeof b.mj.k === 'number' ? b.mj.k : null; }
  function viejo(sc) { var k = mjK(); return sc.charAt(0) === 'm' && k !== null && +sc.slice(2) < k; }
  /* d = {from, sc, at?, m:[{t,d,n,l,v}]} del relé, o {from, sc, m} de un par P2P */
  function recibir(d, via) {
    if (!d || !Array.isArray(d.m) || !d.from) return;
    var yo = N.you ? N.you.id : null;
    if (d.from === yo) return;
    var sc = String(d.sc || 'b'), P = par(d.from), t = clk();
    P.rx = t;
    for (var i = 0; i < d.m.length; i++) {
      var m = d.m[i]; if (!m || typeof m.t !== 'string') continue;
      if (typeof m.n === 'number' && m.n > 0 && m.n === Math.floor(m.n)) {     // misma clave para P2P y relé: el duplicado se descarta
        var key = d.from + ':' + sc + ':' + (m.v || '') + ':' + (m.l ? m.t : m.n), s = seen[key];
        if (s !== undefined && (!m.l || s >= m.n)) { N.stats.drop++; continue; }
        marcar(key, m.n);
      }
      N.stats.rx++;
      if (m.t === '_net_ping') {
        // el pong vuelve por el alcance del ping SOLO si tengo canal en él; quien mira un minijuego ajeno (su asiento no está en mj.as) no puede hablar en m:<k>: el relé le contestaría 403 «Not in this round»
        if (yo && N.visible) encolar(sc === 'b' || chans[sc] ? sc : 'b', '_net_pong', { p: m.d, a: d.from }, true);
        continue;
      }
      if (m.t === '_net_pong') { if (m.d && m.d.a === yo) pong(d.from, m.d.p, 'relay'); continue; }
      if (m.t === 'hb') { P.hb = t; if (m.d) { if (typeof m.d.rtt === 'number') P.rtt = m.d.rtt; P.vis = m.d.vis === 0 ? 0 : 1; } continue; }
      entregar(sc, m.t, m.d, d.from);
    }
  }
  function entregar(sc, t, d, from) {
    var C = chans[sc];
    if (C && C.h) { try { C.h(t, d, from); } catch (e) { log('[fiesta-net] onMsg: ' + e); } return; }
    if (cerrados[sc] || viejo(sc)) return;                     // mensaje tardío de un alcance cerrado
    var b = buf[sc] || (buf[sc] = []);
    b.push({ t: t, d: d, from: from });
    if (b.length > K.BUF) b.splice(0, b.length - K.BUF);
  }

  /* ───────────── envío: cola por alcance, fusión latest, reparto por par, dos carriles HTTP ───────────── */
  function encolar(sc, t, d, l, http) {
    if (!N.you) return;
    if (l) for (var i = 0; i < pend.length; i++) { var p = pend[i]; if (p.l && p.t === t && p.sc === sc) { p.d = d; p.n = 0; if (http) p.http = true; return; } }
    pend.push({ sc: sc, t: t, d: d === undefined ? null : d, l: !!l, n: 0, v: '', http: !!http, at: clk() });
  }
  N.send = function (sc, t, d, l, op) { encolar(sc, t, d, l, !!(op && op.via === 'relay')); };
  function sellar(it) { if (!it.n) { it.n = ++seq; it.v = epoca; } return it; }
  function wire(it) { return { t: it.t, d: it.d, n: it.n, l: it.l, v: it.v }; }
  function seatsHumanos() {                                    // los pares que necesitan recibir: humanos sentados, no yo
    var R = N.room, t = clk(); if (!R || !R.players || !N.you) return [];
    var pj = N.board && N.board.pj || {};
    return R.players.filter(function (p) {
      if (p.left || p.id === N.you.id) return false;
      var q = pj[p.id] || {};
      if (q.cpu === 'auto') return false;
      if (q.cpu === 'afk' && t - par(p.id).rx > K.AFK_MUDO) return false;   // afk que no da señales: no fuerza el relé
      return true;
    }).map(function (p) { return p.id; });
  }
  function aCarril(it) {
    var Ln = it.l ? lanes.l : lanes.r;
    if (it.l) for (var i = 0; i < Ln.q.length; i++) { var q = Ln.q[i]; if (q.t === it.t && q.sc === it.sc) { Ln.q[i] = it; return; } }
    it.at = clk(); Ln.q.push(it);
  }
  /* D12: P2P hacia los pares abiertos; al relé (difusión) solo si falta algún par, si el envío P2P falló o si se pide (`hb` de presencia, `w`) */
  function repartir() {
    var items = pend.splice(0), ps = seatsHumanos(), abiertos = [], falta = false;
    ps.forEach(function (id) { if (listo(links[id])) abiertos.push(id); else falta = true; });
    items.forEach(sellar);
    var fallo = {};
    if (abiertos.length) {
      var grupos = {};
      items.forEach(function (it) { var g = it.sc + '|' + (it.l ? 'f' : 'r'); (grupos[g] = grupos[g] || []).push(it); });
      Object.keys(grupos).forEach(function (g) {
        var its = grupos[g], w = g.slice(-1), paq = { sc: its[0].sc, m: its.map(wire) };
        abiertos.forEach(function (id) { if (crudo(w, paq, links[id])) N.stats.p2p++; else its.forEach(function (it) { fallo[it.n] = 1; }); });
      });
    }
    items.forEach(function (it) { if (it.http || falta || fallo[it.n]) aCarril(it); });
  }
  function recargar(t) { tokens = Math.min(K.MSG_BURST, tokens + (t - tokAt) * K.MSG_RATE); tokAt = t; }
  function restaurar(Ln, batch) {
    var otra = batch.filter(function (m) { return !m.l || !Ln.q.some(function (q) { return q.l && q.t === m.t && q.sc === m.sc; }); });
    Ln.q = otra.concat(Ln.q);
  }
  function carril(nm, t) {
    var Ln = lanes[nm];
    if (nm === 'r') Ln.q = Ln.q.filter(function (it) { return t - it.at <= K.FIABLE_TTL; });   // un fiable que no sale en 5 s se descarta
    if (!Ln.q.length || Ln.busy || t - Ln.last < K.SIG_GAP || t < Ln.retry) return;
    reqAt = reqAt.filter(function (x) { return t - x < 1; });
    if (reqAt.length >= K.REQ_RATE) return;
    recargar(t);
    if (tokens < 1) return;
    var sc = Ln.q[0].sc, batch = [], size = 2;
    for (var i = 0; i < Ln.q.length; i++) {
      var it = Ln.q[i]; if (it.sc !== sc) continue;
      var w = JSON.stringify(wire(sellar(it))).length;
      if (w + 2 > K.MAX_B) { log('[fiesta-net] mensaje demasiado grande para el relé: ' + it.t + ' (' + w + ' B)'); Ln.q.splice(i--, 1); continue; }
      if (batch.length >= K.MAX_N || batch.length >= Math.floor(tokens) || size + w + (batch.length ? 1 : 0) > K.MAX_B) break;
      size += w + (batch.length ? 1 : 0); batch.push(it);
    }
    if (!batch.length) return;
    Ln.q = Ln.q.filter(function (x) { return batch.indexOf(x) < 0; });
    tokens -= batch.length; reqAt.push(t); Ln.busy = batch; Ln.last = t; N.stats.req++; N.stats.msgs += batch.length;
    var R = N.room;
    pcall('sig', aut({ sc: sc, m: batch.map(wire) })).then(function (r) {
      if (Ln.busy === batch) Ln.busy = false;
      if (r.ok || N.room !== R) return;
      if (r.status === 0 || r.status === 429 || r.status >= 500) { restaurar(Ln, batch); Ln.retry = clk() + (r.status === 429 ? 1 : .25); }
      else if (esPerdida(r)) perdida();
      else log('[fiesta-net] sig ' + r.status + ' ' + sc + ': ' + (r.data && r.data.error));   // 400/403/409/413: el lote se descarta
    });
  }
  function flush(t) {
    if (!N.you || !N.room) { pend.length = 0; return; }
    if (pend.length && t - p2pAt >= K.P2P_GAP) { p2pAt = t; repartir(); }
    carril('l', t); carril('r', t);
  }

  /* ───────────── presencia (D20) y latido ───────────── */
  function scVivo(sc) {
    if (sc === 'b') return true;
    var b = N.board; if (!b || !b.mj) return !b;              // sin tablero (pruebas): cualquier alcance
    return sc === 'm:' + b.mj.k && (b.f === 'carta' || b.f === 'mj');
  }
  function scHb() { var best = 'b', at = -1; Object.keys(chans).forEach(function (sc) { var C = chans[sc]; if (sc !== 'b' && C.since > at && scVivo(sc)) { best = sc; at = C.since; } }); return best; }
  function rttMed() {
    var a = seatsHumanos().map(function (id) { return N.rtt(id); }).filter(function (x) { return x > 0; });
    return a.length ? mediana(a) : N.rtt();
  }
  function latir(t) {
    if (!N.you || !N.visible || t - hbAt < K.HB) return;
    hbAt = t;
    var sc = scHb(), pres = t - presAt >= K.PRES;
    if (pres) presAt = t;
    if (!pres && sc === 'b') return;                           // en el tablero basta la presencia de 2 s
    var ocupado = pend.some(function (it) { return it.sc === sc && it.t !== 'hb'; }) || lanes.l.q.some(function (it) { return it.sc === sc; });
    if (!pres && ocupado) return;                              // ya sale algo: eso marca vida
    encolar(sc, 'hb', { rtt: Math.round(rttMed()), vis: 1 }, true, pres);
  }

  /* ───────────── malla WebRTC por par (port de js/link.js) ───────────── */
  function nuevoLink(id) { return { id: id, pc: null, f: null, r: null, state: 'off', s: '', early: {}, since: 0, rx: 0, hello: -99, tries: 0, rtt: 0, pong: -99, pingAt: -99 }; }
  function link(id) { return links[id] || (links[id] = nuevoLink(id)); }
  function listo(L) { return !!L && L.state === 'open' && clk() - L.rx < K.LINK_OK; }
  function canal(w, L) { var c = w === 'f' ? L.f : L.r; return c && c.readyState === 'open' ? c : null; }
  function crudo(w, obj, L) { var c = L && canal(w, L); if (c && (c.bufferedAmount || 0) < (w === 'f' ? 16384 : 65536)) { try { c.send(JSON.stringify(obj)); return true; } catch (e) {} } return false; }
  function cerrarLink(L) {
    [L.f, L.r].forEach(function (ch) { if (ch) ch.onmessage = ch.onopen = ch.onclose = null; });
    try { if (L.pc) { L.pc.onicecandidate = L.pc.onconnectionstatechange = L.pc.ondatachannel = null; L.pc.close(); } } catch (e) {}
    L.pc = L.f = L.r = null; L.state = 'off'; L.early = {}; L.rtt = 0;
  }
  function pong(id, ts, via) {
    var r = clk() - ts; if (!(r >= 0 && r <= 10)) return;
    if (via === 'p2p') { var L = link(id); L.rtt = L.rtt ? L.rtt * .7 + r * .3 : r; L.pong = clk(); }
    else { var P = par(id); P.rr = P.rr ? P.rr * .7 + r * .3 : r; P.rrAt = clk(); }
  }
  function rxLink(raw, L) {
    var d = parse(raw); if (!d) return;
    L.rx = clk();
    if (d.p !== undefined) { crudo('f', { q: d.p }, L); return; }      // ping → pong de vuelta
    if (d.q !== undefined) { pong(L.id, d.q, 'p2p'); return; }
    if (d.m && L.id) recibir({ from: L.id, sc: d.sc, m: d.m }, 'p2p');
  }
  function enganchar(ch, L) {
    ch.onmessage = function (e) { rxLink(e.data, L); };
    var chk = function () { if (canal('f', L) && canal('r', L)) { L.state = 'open'; L.rx = clk(); } };
    ch.onopen = chk; ch.onclose = function () { if (L.state === 'open') L.state = 'bad'; };
    chk();
  }
  function vsend(to, k, d) { if (N.room && N.you) pcall('vsig', aut({ to: to, k: k, d: d === undefined ? null : d })); }
  function armar(X, L) {
    cerrarLink(L); L.id = X; L.state = 'wait'; L.since = clk();
    var pc = L.pc = new RTC({ iceServers: ice() });
    pc.onicecandidate = function (e) { if (e && e.candidate && L.pc === pc) vsend(X, 'dice', { s: L.s, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.onconnectionstatechange = function () { if (L.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) L.state = 'bad'; };
    pc.ondatachannel = function (e) { L[e.channel.label === 'f' ? 'f' : 'r'] = e.channel; enganchar(e.channel, L); };
    return pc;
  }
  function temprano(L) {
    var pc = L.pc, lista = L.early[L.s] || []; delete L.early[L.s];
    return lista.reduce(function (p, c) { return p.then(function () { return prom(pc.addIceCandidate(c)).then(null, noop); }); }, Promise.resolve());
  }
  function ofrecer(X, L) {
    if (L.tries >= 4) return;
    L.tries++;
    var pc = armar(X, L); L.s = rnd36(6);
    L.f = pc.createDataChannel('f', { ordered: false, maxRetransmits: 0 }); L.r = pc.createDataChannel('r');
    enganchar(L.f, L); enganchar(L.r, L);
    prom(pc.createOffer()).then(function (of) {
      return prom(pc.setLocalDescription(of)).then(function () { if (L.pc === pc) vsend(X, 'doffer', { s: L.s, t: of.type, sdp: of.sdp }); });
    }).then(null, function () { if (L.pc === pc) L.state = 'bad'; });
  }
  /* mensaje de montaje de un par (tema rooms/<id>/vsig, tipos d*): el id menor ofrece, así no hay choque */
  function onLinkSig(d) {
    if (!d || !N.you || !RTC || d.to !== N.you.id || !/^d/.test(d.k)) return;
    var X = d.from; if (seatsHumanos().indexOf(X) < 0) return;
    var L = link(X), mio = N.you.id, g = d.d || {};
    try {
      if (d.k === 'dhello') { if (mio < X && L.state !== 'open' && (!L.pc || clk() - L.since > 1.5)) ofrecer(X, L); }
      else if (d.k === 'doffer' && mio > X && g.sdp) {
        var early = L.early[g.s], pc = armar(X, L);
        if (early) L.early[g.s] = early;
        L.s = g.s;
        prom(pc.setRemoteDescription({ type: g.t, sdp: g.sdp })).then(function () {
          if (L.pc !== pc) return;
          return temprano(L).then(function () { return pc.createAnswer(); }).then(function (a) {
            return prom(pc.setLocalDescription(a)).then(function () { if (L.pc === pc) vsend(X, 'danswer', { s: g.s, t: a.type, sdp: a.sdp }); });
          });
        }).then(null, noop);
      } else if (d.k === 'danswer' && L.pc && g.s === L.s && g.sdp && L.pc.signalingState === 'have-local-offer') {
        prom(L.pc.setRemoteDescription({ type: g.t, sdp: g.sdp })).then(function () { return temprano(L); }).then(null, noop);
      } else if (d.k === 'dice' && g.c) {
        if (L.pc && g.s === L.s && L.pc.remoteDescription) prom(L.pc.addIceCandidate(g.c)).then(null, noop);
        else { var q = L.early[g.s] = L.early[g.s] || []; if (q.length < 40) q.push(g.c); }
      }
    } catch (e) {}
  }
  function mallar(t) {
    var vivos = seatsHumanos();
    Object.keys(links).forEach(function (id) { if (vivos.indexOf(id) < 0) { cerrarLink(links[id]); delete links[id]; } });
    if (!vivos.length || !N.you) return;
    var relePing = false;
    vivos.forEach(function (X) {
      if (!RTC) { relePing = true; return; }
      var L = link(X);
      if (L.state === 'open' && t - L.rx > K.LINK_DEAD) { L.state = 'bad'; L.since = t - 7; }
      if (L.tries >= 4 && t - L.since > 30) L.tries = 0;
      if (L.state !== 'open' && L.tries < 4) {
        if (N.you.id < X) { if (!L.pc || L.id !== X || t - L.since > 6) ofrecer(X, L); }
        else if (t - L.hello > 1.5) { L.hello = t; vsend(X, 'dhello'); }
      }
      if (t - L.pingAt > 1) { L.pingAt = t; if (L.state === 'open') crudo('f', { p: t }, L); else relePing = true; }
    });
    if (relePing && N.visible && t - relePingAt > 1) { relePingAt = t; encolar(scHb(), '_net_ping', t, true); }
  }

  /* ───────────── canal en vivo: forma de duoCtx (js/party.js:207-222) ─────────────
     ch.role/roles/partner/seats/byRole/peers, send(t, d, latest[, {via:'relay'}]), onMsg(fn(t, d, rolDelEmisor, idDelEmisor)) con
     reproducción del búfer, away(id), close(). Así DUO.wire y los bots de duo/squad corren sin cambios (prueba de conformidad). */
  N.channel = function (scope, op) {
    op = op || {};
    var k = mjK(), sc = scope === 'm' ? 'm:' + (k === null ? 0 : k) : String(scope || 'b');
    if (chans[sc]) chans[sc].close();
    delete cerrados[sc];
    var R = N.room || { players: [] }, pj = N.board && N.board.pj || {};
    var lista = op.seats || R.players.filter(function (p) { return !p.left; }).map(function (p) { return p.id; });
    var n = lista.length, yo = N.you ? lista.indexOf(N.you.id) : -1, rot = op.rot || 0;
    var rolDe = function (i) { return n ? (i + rot) % n : 0; };
    var seats = lista.map(function (id, i) {
      var p = R.players.filter(function (q) { return q.id === id; })[0] || { id: id }, q = pj[id] || {};
      return { id: id, name: p.name, color: p.color, ch: q.ch || p.ch || null, cpu: q.cpu || null, role: rolDe(i), you: i === yo };
    });
    var otro = seats.filter(function (s) { return !s.you; })[0];
    var rolId = function (id) { for (var i = 0; i < seats.length; i++) if (seats[i].id === id) return seats[i].role; return -1; };
    var C = {
      scope: sc, role: yo >= 0 ? rolDe(yo) : -1, roles: n, seats: seats,
      byRole: seats.slice().sort(function (a, b) { return a.role - b.role; }),
      peers: seats.filter(function (s) { return !s.you; }).map(function (s) { return s.id; }),
      partner: otro ? { id: otro.id, name: otro.name, color: otro.color } : null,
      since: clk(), h: null,
      isJudge: function () { var mj = N.board && N.board.mj; return !!(mj && N.you && mj.juez === N.you.id); },
      send: function (t, d, latest, o2) {
        if (chans[sc] !== C || !N.you) return;
        if (!N.visible && t === 'aim') return;                  // oculto: no se manda aim (doc 07 §8.4)
        encolar(sc, String(t), d, !!latest, !!(o2 && o2.via === 'relay'));
      },
      onMsg: function (fn) {
        C.h = function (t, d, from) { fn(t, d, rolId(from), from); };
        var b = buf[sc] || []; delete buf[sc];
        b.forEach(function (x) { if (C.h) C.h(x.t, x.d, x.from); });
      },
      away: function (id) { var t = clk(); id = id || (otro && otro.id); return t - C.since > K.AWAY && t - par(id).rx > K.AWAY; },
      close: function () {
        if (chans[sc] !== C) return;
        delete chans[sc]; delete buf[sc]; cerrados[sc] = 1; C.h = null;
        pend = pend.filter(function (it) { return it.sc !== sc; });
        lanes.l.q = lanes.l.q.filter(function (it) { return it.sc !== sc; });
        lanes.r.q = lanes.r.q.filter(function (it) { return it.sc !== sc; });
      }
    };
    Object.defineProperty(C, 'judge', { get: function () { var mj = N.board && N.board.mj; return mj ? mj.juez : null; } });
    Object.defineProperty(C, 'epoch', { get: function () { var mj = N.board && N.board.mj; return mj ? mj.e || 0 : 0; } });
    chans[sc] = C;
    return C;
  };
  N.away = function (id) { return clk() - par(id).rx > K.AWAY; };
  // segundos desde el último mensaje (de CUALQUIER tipo, también el hb que el transporte se queda) del asiento `id`; Infinity si nunca llegó nada (M2, DM2-16)
  N.silence = function (id) { var P = pares[id]; return P && P.rx > -90 ? clk() - P.rx : Infinity; };

  /* ───────────── asientos, latencia, etiqueta ───────────── */
  N.rtt = function (id) {
    if (!id) { var m = mejor(); return m ? Math.round(m.rtt) : 0; }
    var L = links[id], P = pares[id], t = clk();
    if (listo(L) && L.rtt && t - L.pong < 4) return Math.round(L.rtt * 1000);
    if (P && P.rr && t - P.rrAt < 4) return Math.round(P.rr * 1000);
    return 0;
  };
  N.via = function (id) { return listo(links[id]) ? 'p2p' : 'relay'; };
  N.seats = function () {
    var R = N.room; if (!R || !R.players) return [];
    var pj = N.board && N.board.pj || {}, t = clk();
    return R.players.map(function (p) {
      var q = pj[p.id] || {}, yo = !!N.you && p.id === N.you.id, P = pares[p.id];
      return { id: p.id, name: p.name, color: p.color, ch: q.ch || p.ch || null, cpu: q.cpu || null, left: !!p.left, you: yo,
        online: yo ? N.visible : !!P && t - P.rx < K.ONLINE, vis: yo ? (N.visible ? 1 : 0) : (P ? P.vis : 0),
        rtt: yo ? N.rtt() : N.rtt(p.id), via: yo ? null : N.via(p.id) };
    });
  };
  N.label = function () {
    var ms = Math.round(rttMed()); if (!ms) return '';
    var ps = seatsHumanos(), directo = ps.length > 0 && ps.every(function (id) { return listo(links[id]); });
    return ms + ' MS · ' + (directo ? 'DIRECTO' : 'RELÉ');
  };

  /* ───────────── voz: solo la interfaz (el port real de js/voice.js llega después; NUNCA abre el micrófono) ───────────── */
  var voz = (function () {
    var mudos = {};
    return {
      on: false, muted: false, stream: null,
      toggle: function () { log('[fiesta-net] voz: todavía no disponible'); return false; },
      state: function () { return 'none'; },
      talking: function () { return false; },
      mute: function (id) { mudos[id] = !mudos[id]; return !!mudos[id]; },
      isMuted: function (id) { return !!mudos[id]; },
      rx: noop, cerrar: noop
    };
  })();
  N.voice = voz;

  /* ───────────── visibilidad (doc 07 §8.4) ───────────── */
  N.setVisible = function (v) {
    v = !!v; if (v === N.visible) return;
    N.visible = v;
    if (v) { if (N.room) { conectar(); sondear(); if (N.you) N.mine(); N.sync(3, 150); N.tickIfDue(); } }
    else {                                                     // oculto: se dejan de mandar hb y aim; NUNCA leave
      pend = pend.filter(function (it) { return it.t !== 'hb' && it.t !== 'aim'; });
      lanes.l.q = lanes.l.q.filter(function (it) { return it.t !== 'hb' && it.t !== 'aim'; });
    }
  };
  if (o.doc && o.doc.addEventListener) o.doc.addEventListener('visibilitychange', function () { N.setVisible(!o.doc.hidden); });

  /* ───────────── bucle: setInterval de 100 ms (sigue vivo con la pestaña oculta o el motor quieto) + pump() desde rAF ───────────── */
  N.pump = function () {
    if (!N.room) return;
    var t = clk();
    if (t - linkAt >= .2) { linkAt = t; mallar(t); }
    latir(t);
    flush(t);
    if (t - pollAt > cadaSondeo()) sondear();
  };
  N.destroy = function () { if (timer !== null) iClr(timer); timer = null; limpiar(); };
  N._dbg = function () { return { pend: pend, lanes: lanes, links: links, pares: pares, buf: buf, muestras: muestras, tokens: tokens }; };
  if (o.timers !== false) timer = iSet(N.pump, o.tickMs || K.TICK_MS);
  return N;
}

F.net = { create: create, K: K, STUN: STUN };
if (typeof module !== 'undefined') module.exports = F.net;
})(typeof window !== 'undefined' ? window : globalThis);
