// LA FIESTA · minijuegos EN VIVO (M2, E1). Contrato: docs/mario-party/M2-SPEC.md §4.
// FIESTA.LIVE = registro de juegos + sesión de red (modelos A cancha propia, B dueño+juez, C el juez simula, Ceq) + práctica.
// NÚCLEO SIN DOM (corre en Node con un `net` falso, ver test/fiesta-live-core.test.js) y una capa de navegador muy fina al final
// (LIVE.bindKeys / LIVE.run). Sin lockstep: cada pantalla simula lo suyo y el juez publica el veredicto.
// Sin ?. ni ?? ni spread de objetos ni async (mismo dialecto que el resto de fiesta-*.js). UMD: window.FIESTA.LIVE / module.exports.
(function (root) {
'use strict';
var F = root.FIESTA = root.FIESTA || {};
var noop = function () {};
var K = {
  CAIDA: 2.0, FRESCO: 0.5, SIL_JUEZ: 1.2, ESPERA_END: 1.5, REENVIO_END: [1.0, 2.5], BODY_HZ: 12, SNAP_HZ: 10, I_HZ: 20, I_KEEP_HZ: 4,
  VENTANA: 0.12, CLAIM_TTL: 2.5, D_MIN: 0.10, D_MAX: 0.25, FIJO: 1 / 30, TOQUES_MAX: 16, MAX_CATCHUP: 5, FAIR_MAX: 0.12, FAIR_TEAM_MAX: 0.5, FAIR_TEAM_BASE: 0.04, PENDIENTES_E: 8,
  PACK_SPLIT: 60, EXTRAP: 100, MSG_MAX: 420, X_MAX: 200, MJFIN_ESPERA: 0.5, MIGRA_REINTENTO: 1.5, READY_REINTENTO: 1.5,
  /* M3-LAG (compensación de lag del modelo C, docs/mario-party/M3-LAG-COMP.md) */
  REW_MAX: 0.5, FRAMES_I: 8, VREF_VEL: 0.5, SNAPS_MAX: 32, FRES_MAX: 1.0, V_VENTANA: 3, I_MSG_TOPE: 380
};
var RESERVED = ['i', 'o', 's', 's2', 'w', 'cl', 'ok', 'ev', 'end', 'hb', 'rdy', 'jg', 'aim', 'react', 'frame', '_net_ping', '_net_pong'];
var X_RE = /^x[a-z0-9]{1,11}$/;
var REG = {};
var FORMATOS = ['ffa', '1v1', '2v2', '1v3'];

/* ───────────── utilidades puras (compartibles con el servidor: ES5) ───────────── */
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function fnv(str) { str = String(str); var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function hashRes(sc, pl, kk) { return fnv(sc.join(',') + '|' + pl.join(',') + '|' + kk); }
function tickDe(gt) { return Math.floor(gt * 30); }
/* Une en un racimo los valores consecutivos (ordenados de mayor a menor) que difieren ≤3 ticks; el racimo toma su máximo. Idempotente. */
function normSurvival(sc) {
  var ix = sc.map(function (v, i) { return i; }).sort(function (a, b) { return sc[b] - sc[a] || a - b; }), out = sc.slice(), top = null, prev = null;
  for (var j = 0; j < ix.length; j++) {
    var v = sc[ix[j]];
    if (prev === null || prev - v > 3) top = v;
    out[ix[j]] = top; prev = v;
  }
  return out;
}
function comparaLocal(modo, eq, sc) {
  var team = {};
  eq.forEach(function (t, i) { (team[t] = team[t] || []).push(i); });
  var ts = Object.keys(team).map(function (t) {
    var ids = team[t], sum = 0; ids.forEach(function (i) { sum += sc[i]; });
    return { t: +t, ids: ids, v: modo === '1v3' ? (ids.length === 1 ? sc[ids[0]] : sum / ids.length) : sum };
  });
  ts.sort(function (a, b) { return b.v - a.v; });
  var pe = {};
  ts.forEach(function (x, i) { pe[x.t] = i > 0 && Math.abs(ts[i - 1].v - x.v) < 1e-9 ? pe[ts[i - 1].t] : i + 1; });
  return eq.map(function (t) { return pe[t]; });
}
function reglas() { return F.reglas || (typeof require !== 'undefined' ? safeRequire('./fiesta-reglas.js') : null); }
function safeRequire(p) { try { return require(p); } catch (e) { return null; } }
function puestos(tipo, eq, sc, clase) {
  var R = reglas();
  if (R && R.puestos) return R.puestos(tipo, eq, sc, clase);
  if (tipo === '1v1') tipo = 'ffa';
  if (clase === 'survival') sc = normSurvival(sc);
  return R && R.compara ? R.compara(tipo, eq, sc).puestos : comparaLocal(tipo, eq, sc);
}
function eqIdx(mj) {
  var R = reglas();
  if (R && typeof R.eqIdx === 'function') return R.eqIdx(mj);     // una sola definición del mapa asiento -> equipo (reductor); la copia de abajo es el respaldo
  return mj.as.map(function (s, i) {
    if (mj.tipo === 'ffa' || mj.tipo === '1v1') return i;
    for (var j = 0; j < (mj.eq || []).length; j++) if (mj.eq[j].indexOf(s) >= 0) return j;
    return i;
  });
}
function interp(a, b, u) { return a + (b - a) * u; }
function suave(cur, target, dt) {                      // error ≤6 px no corrige; 6-60 px corrige ≤8 px por cuadro; >60 salta
  var e = target - cur, ae = Math.abs(e);
  if (ae <= 6) return cur;
  if (ae > 60) return target;
  return cur + (e > 0 ? 1 : -1) * Math.min(8, ae);
}
function rngLib() { return F.rng || (typeof require !== 'undefined' ? safeRequire('./fiesta-rng.js') : null); }
function rngFrom(seed, tag) { var R = rngLib(); return R.crear(tag === undefined ? seed : fnv(seed + ':' + tag)); }
function pj(ch, cx, cy, h, op) {
  var ui = F.ui;
  if (ui && ui.dibujaPj) return ui.dibujaPj(ch, cx, cy, h, op);
  var B = root.BUS, C = B && B.AP && B.AP.CAST && B.AP.CAST[ch];
  if (C && typeof root.bust === 'function') return root.bust(C, cx, cy, h);
}
// TÚ (BUS.TU, el chamo de ¡CHANCLA!) no está en BUS.AP.CAST: los juegos que buscan la cara por ch (dominó) lo encuentran aquí
(function () { var B = root.BUS; if (B && B.AP && B.AP.CAST && !B.AP.CAST.tu && B.TU) B.AP.CAST.tu = B.TU; })();
function cara(ch) { var B = root.BUS; return B && B.AP && B.AP.CAST ? B.AP.CAST[ch] || null : null; }
var util = { fnv: fnv, hashRes: hashRes, puestos: puestos, normSurvival: normSurvival, tick: tickDe, clamp: clamp, interp: interp, suave: suave, rngFrom: rngFrom, pj: pj, cara: cara, eqIdx: eqIdx };

/* ───────────── registro ───────────── */
function add(id, def) {
  var bad = function (m) { throw new Error('LIVE.add(' + id + '): ' + m); };
  if (!/^f_[a-z0-9_]+$/.test(String(id))) bad('id inválido');
  if (!def || typeof def !== 'object') bad('def vacío');
  ['name', 'modos', 'clase', 'modelo', 'dur', 'botones', 'migra', 'limites', 'carta', 'mk'].forEach(function (f) { if (def[f] === undefined) bad('falta ' + f); });
  if (['A', 'B', 'C', 'Ceq'].indexOf(def.modelo) < 0) bad('modelo ' + def.modelo);
  if (['rank', 'survival', 'binary'].indexOf(def.clase) < 0) bad('clase ' + def.clase);
  if (typeof def.mk !== 'function') bad('mk no es función');
  var L = def.limites;
  ['scoreMax', 'scoreRate', 'minT', 'finTemprano'].forEach(function (f) { if (L[f] === undefined) bad('limites.' + f); });
  var c = def.carta;
  if (!c || !c.obj || !c.gana || !c.como || !c.demos) bad('carta incompleta');
  // M3-TEAMS (DM3-7): formatos de equipo. El veredicto sale de `sc` -> compara (DM3-3), y un 1v3 enseña a cada rol su propio texto.
  if (!Array.isArray(def.modos) || !def.modos.length) bad('modos vacío');
  def.modos.forEach(function (m) { if (FORMATOS.indexOf(m) < 0) bad('modo ' + m); });
  var deEquipo = def.modos.indexOf('2v2') >= 0 || def.modos.indexOf('1v3') >= 0;
  if (deEquipo && def.clase !== 'binary') bad('los formatos 2v2/1v3 exigen clase binary');
  if (def.modos.indexOf('1v3') >= 0) {
    var ro = c.roles, okRol = function (r) { return r && typeof r === 'object' && r.obj && r.como; };
    if (!ro || !okRol(ro.solo) || !okRol(ro.trio)) bad('1v3 exige carta.roles.solo y carta.roles.trio (con obj y como)');
  }
  if ((def.modelo === 'A' || def.modelo === 'B') && (!def.cuerpo || !def.cuerpo.length)) bad('A/B exigen cuerpo');
  if ((def.modelo === 'C' || def.modelo === 'Ceq') && !(def.packN > 0)) bad('C exige packN');
  var R = reglas(), cat = R && R.CATALOGO && R.CATALOGO.filter(function (x) { return x.g === id; })[0];
  if (cat) {
    if (cat.mo !== def.modelo) bad('modelo ' + def.modelo + ' ≠ catálogo ' + cat.mo);
    if (cat.cl !== def.clase) bad('clase ≠ catálogo ' + cat.cl);
    if (JSON.stringify(cat.m) !== JSON.stringify(def.modos)) bad('modos ≠ catálogo');
    if (cat.lim) ['scoreMax', 'scoreRate', 'minT'].forEach(function (f) { if (cat.lim[f] !== L[f]) bad('limites.' + f + ' ≠ catálogo'); });
    if (cat.lim && !!cat.lim.finTemprano !== !!L.finTemprano) bad('limites.finTemprano ≠ catálogo');
  }
  def.id = id;
  if (def.bodyHz === undefined) def.bodyHz = K.BODY_HZ;
  if (def.snapHz === undefined) def.snapHz = K.SNAP_HZ;
  REG[id] = def;
  return def;
}

/* ───────────── sesión ───────────── */
function create(opts) {
  opts = opts || {};
  var net = opts.net, strict = !!opts.strict, log = opts.log || noop, practica = !!opts.practica;
  var yoId = opts.yo !== undefined ? opts.yo : (net.you ? net.you.id : null);
  var B0 = net.board, mj0 = B0.mj, kMJ = mj0.k, qi = mj0.i, spec = mj0.cola[qi], def = REG[spec.g];
  if (!def) throw new Error('LIVE: juego no registrado: ' + spec.g);
  var as = mj0.as.slice(), n = as.length, yo = as.indexOf(yoId), dur = spec.dur, modelo = def.modelo;
  var esC = modelo === 'C' || modelo === 'Ceq', usaI = esC || !!def.entradas;
  var minTEf = Math.min(def.limites.minT, dur - 1);
  var tipoCo = mj0.tipo;

  var S = { key: kMJ + ':' + qi, k: kMJ, i: qi, id: spec.g, def: def, g: null, over: false, go: false, listos: {}, verdict: null,
    stats: { sent: {}, maxCarga: 0, req: 0, jueces: [], mjfin: [], eventos: [] } };
  var clock = 0, phaseCerrada = false, g = null, eqs = eqIdx(mj0);
  var ch = null, cpuAhora = [], cpuOrig = [], skill = [], inputs = [], aiIn = [], own, lastRx = {}, rem = [], snaps = [], snapPart = {}, lastSnapRaw = null;
  var handlers = {}, pendJ = [], pend = {}, claims = {}, transit = 0, conceded = {}, juezPrev = null, epPrev = 0, k30 = 0, accBody = 0, accSnap = 0;
  var accI = 0, iSent = null, iKeep = 0, tapBud = [], D = 0.15, arr = {}, ended = null, fx0 = 12345 + (yo + 2) * 977;
  var finClk = null, mjfinTries = 0, mjfinAt = -9, mjfinDone = false, migAt = -9, migTries = 0, readyAt = -9, endResent = [false, false], migradoE = -1, fresh = {};
  var ownHist = [], onGoDone = false, startedClk = 0, dCnt = 0;

  function B() { return net.board; }
  function MJ() { var b = net.board; return b && b.mj; }
  function juezId() { var m = MJ(); return m ? m.juez : null; }
  function epoch() { var m = MJ(); return m ? m.e || 0 : 0; }
  function esJuez() { return yo >= 0 && juezId() === yoId; }
  function gt() { var m = MJ(); return !m || m.startAt == null ? -999 : (net.serverNow() - m.startAt) / 1000; }
  function idxOf(letter) { return as.indexOf(letter); }

  for (var i = 0; i < n; i++) {
    var pj0 = (B0.pj || {})[as[i]] || {};
    cpuOrig[i] = pj0.cpu === 'auto'; cpuAhora[i] = !!pj0.cpu; rem[i] = [];
    inputs[i] = { a: false, b: false, ta: 0, tb: 0, ca: 0, cb: 0, x: 0, y: 0, bud: [K.TOQUES_MAX, K.TOQUES_MAX], rem: true };
    aiIn[i] = { a: false, b: false, ta: 0, tb: 0, ca: 0, cb: 0, x: 0, y: 0, bud: [99, 99], rem: false };
    var nv = { 1: .35, 2: .6, 3: .85 }[(B0.cfg && B0.cfg.cpuNivel) || 2] || .6;
    var rs = rngFrom(spec.seed, 'skill' + i);
    var sf = opts.skillFix;
    skill[i] = Array.isArray(sf) ? (sf[i] !== undefined ? sf[i] : sf[sf.length - 1]) : sf !== undefined ? sf : clamp(nv + 0.1 * (rs.next() * 2 - 1), 0.2, 0.95);
  }
  own = yo >= 0 ? inputs[yo] : { a: false, b: false, ta: 0, tb: 0, ca: 0, cb: 0, x: 0, y: 0, bud: [99, 99], rem: false };
  own.rem = false;
  var ownView = { a: false, b: false, ta: 0, tb: 0, ca: 0, cb: 0, x: 0, y: 0, bud: [99, 99], rem: false };
  var pulse = { a: false, b: false };

  function vivo() { return !S.over && gt() >= 0 && !phaseCerrada && g !== null; }
  function mio(p) {
    if (yo < 0 || p < 0 || p >= n) return false;
    if (practica) return true;
    if (modelo === 'C' || modelo === 'Ceq') return esJuez();
    return (p === yo && !cpuAhora[yo]) || (esJuez() && cpuAhora[p]);
  }
  function remoto(p) {
    if (esC || mio(p)) return null;
    var b = rem[p]; if (!b || !b.length) return null;
    var tr = (gt() - D) * 1000, last = b[b.length - 1], first = b[0], disc = {}, o = {}, j;
    (def.discretos || []).forEach(function (f) { disc[f] = 1; });
    var base;
    if (tr >= last.t) {
      base = last.v;
      var prev = b.length > 1 ? b[b.length - 2] : null, ex = Math.min(tr - last.t, K.EXTRAP);
      for (j = 0; j < def.cuerpo.length; j++) {
        var f = def.cuerpo[j], v = base[f];
        if (!disc[f] && prev && last.t > prev.t && ex > 0) v = v + (base[f] - prev.v[f]) / (last.t - prev.t) * ex;
        o[f] = v;
      }
      return o;
    }
    if (tr <= first.t) { for (j = 0; j < def.cuerpo.length; j++) o[def.cuerpo[j]] = first.v[def.cuerpo[j]]; return o; }
    var a = first, bb = last;
    for (j = b.length - 1; j > 0; j--) if (b[j - 1].t <= tr && tr <= b[j].t) { a = b[j - 1]; bb = b[j]; break; }
    var u = bb.t > a.t ? (tr - a.t) / (bb.t - a.t) : 1;
    def.cuerpo.forEach(function (f) { o[f] = disc[f] ? last.v[f] : interp(a.v[f], bb.v[f], u); });
    return o;
  }

  /* ── entradas ── */
  function getIn(p) {
    if (p < 0 || p >= n) return null;
    if (cpuAhora[p]) return aiIn[p];
    if (p === yo) return esC && esJuez() ? ownView : own;
    return usaI ? inputs[p] : null;
  }
  function held(p, b) { if (!vivo()) return false; var I = getIn(p); if (!I) return false; return b === 'b' ? !!I.b : !!I.a; }
  function tap(p, b) {
    if (!vivo()) return 0;
    var I = getIn(p); if (!I) return 0;
    var bi = b === 'b' ? 1 : 0, tot = bi ? I.tb : I.ta, cons = bi ? I.cb : I.ca, d = tot - cons;
    if (d <= 0) return 0;
    var r = d;
    if (I.rem) { r = Math.min(d, Math.floor(I.bud[bi])); I.bud[bi] -= r; }
    if (bi) I.cb = tot; else I.ca = tot;
    return r;
  }
  function eje(p) { if (!vivo()) return { x: 0, y: 0 }; var I = getIn(p); return I ? { x: I.x, y: I.y } : { x: 0, y: 0 }; }
  // El juez retrasa SU PROPIA entrada la mitad de la mediana del RTT de los humanos contra quienes compite. En equipos (DM3-16) esos son los RIVALES:
  // el compañero va en su mismo barco (su lag es de su equipo, no una ventaja del juez sobre el otro bando) y las CPU no cuentan.
  function fairDelay() {
    var rs = [], equipos = tipoCo === '2v2' || tipoCo === '1v3';
    for (var j = 0; j < n; j++) if (j !== yo && !cpuAhora[j] && net.rtt && !(equipos && yo >= 0 && eqs[j] === eqs[yo])) { var r = net.rtt(as[j]); if (r > 0) rs.push(r); }
    if (!rs.length) return 0;
    rs.sort(function (a, b) { return a - b; });
    return Math.min(K.FAIR_MAX, rs[Math.floor(rs.length / 2)] / 2000);
  }
  // Equipos (modelo C): el no-juez ve el mundo D atrasado (interpolación, >= D_MIN) y sus entradas salen a I_HZ (<= 1 periodo), así que con solo RTT/2 el juez
  // reacciona ~150 ms antes que sus rivales (medido: el bando del juez ganaba 68-100 %). Se retrasa 2x(RTT/2) + FAIR_TEAM_BASE (tope FAIR_TEAM_MAX). Mitigación PARCIAL: la ventaja restante (ve el mundo fresco) pide compensación de lag en el juez.
  function fairDelayEq() {
    var f = fairDelay(); if (!f || !(tipoCo === '2v2' || tipoCo === '1v3')) return f;
    return Math.min(K.FAIR_TEAM_MAX, 2 * f + K.FAIR_TEAM_BASE);
  }
  function refreshOwnView() {
    var d = esJuez() ? fairDelayEq() : 0, t = clock - d, h = null;
    for (var j = 0; j < ownHist.length; j++) if (ownHist[j].at <= t) h = ownHist[j]; else break;
    if (!h) h = { a: false, b: false, ta: 0, tb: 0, x: 0, y: 0 };
    ownView.a = h.a; ownView.b = h.b; ownView.ta = h.ta; ownView.tb = h.tb; ownView.x = h.x; ownView.y = h.y;
  }
  function pushOwnHist() {
    ownHist.push({ at: clock, a: own.a || pulse.a, b: own.b || pulse.b, ta: own.ta, tb: own.tb, x: own.x, y: own.y });
    while (ownHist.length > 40) ownHist.shift();
  }
  function apiDe(p) {
    return {
      press: function (b) { var I = aiIn[p]; if (b === 'b') I.tb++; else I.ta++; },
      hold: function (b, v) { var I = aiIn[p]; if (b === 'b') I.b = !!v; else I.a = !!v; },
      eje: function (x, y) { aiIn[p].x = clamp(x, -1, 1); aiIn[p].y = clamp(y, -1, 1); }
    };
  }

  /* ── red ── */
  function rawSend(t, d, latest) {
    if (!ch) return false;
    var len = JSON.stringify(d).length;
    if (len > K.MSG_MAX) { if (strict) throw new Error('LIVE: mensaje > 420 B: ' + t); log('[live] mensaje grande ' + t); return false; }
    S.stats.sent[t] = (S.stats.sent[t] || 0) + 1;
    if (len > S.stats.maxCarga) S.stats.maxCarga = len;
    if (practica) return true;
    ch.send(t, d, !!latest);
    return true;
  }
  function cSend(t, d, latest) {
    t = String(t);
    if (!X_RE.test(t) || RESERVED.indexOf(t) >= 0) { if (strict) throw new Error('LIVE: tipo no permitido en c.send: ' + t); log('[live] tipo no permitido ' + t); return false; }
    var w = { q: qi, d: d === undefined ? null : d };
    if (JSON.stringify(w).length > K.X_MAX) { if (strict) throw new Error('LIVE: x* > 200 B: ' + t); log('[live] x* grande'); return false; }
    return rawSend(t, w, latest);
  }
  function cOn(t, fn) { handlers[String(t)] = fn; }
  function evSend(ty, d, p) {
    if (p === undefined) p = yo;
    if (p !== yo && !mio(p)) return;
    var m = { q: qi, e: epoch(), ty: ty, p: p }; if (d !== undefined) m.d = d;
    if (ty !== 'cpu' && ty !== 'hum') rawSend('ev', m, false);
    S.stats.eventos.push({ at: clock, ty: ty, p: p });
    if (g && g.onEv && ty !== 'cpu' && ty !== 'hum') g.onEv(ty, p, d, tickDe(gt()) * 1000 / 30);
  }
  function claim(id, cb) {
    id = String(id);
    var t = Math.round(gt() * 1000);
    pend[id] = { cb: cb, t: t, at: clock };
    if (esJuez()) addClaim(id, yo, t);
    else rawSend('cl', { q: qi, id: id, t: t }, false);
  }
  function addClaim(id, p, t) {
    var c = claims[id];
    if (!c) c = claims[id] = { open: clock, list: [] };
    c.list.push({ p: p, t: t });
  }
  function resolverClaims() {
    Object.keys(claims).forEach(function (id) {
      var c = claims[id];
      if (clock - c.open < (practica ? 0 : K.VENTANA + transit)) return;     // la ventana espera lo que tarda un claim remoto en llegar: si no, el juez gana toda disputa con latencia
      delete claims[id];
      var win = -1, bt = Infinity;
      c.list.forEach(function (x) {
        if (g && g.claimOk && g.claimOk(id, x.p, x.t) === false) return;
        if (x.t < bt || (x.t === bt && x.p < win)) { bt = x.t; win = x.p; }
      });
      rawSend('ok', { q: qi, e: epoch(), id: id, p: win }, false);
      aplicaOk(id, win);
    });
  }
  function aplicaOk(id, p) {
    var dup = false;
    if (p >= 0) { if (conceded[id]) dup = true; else conceded[id] = 1; }
    if (!dup && g && g.concede) g.concede(id, p);
    var pd = pend[id];
    if (pd) { delete pend[id]; pd.cb(p === yo ? 'ok' : 'no'); }
  }

  /* ── recepción ── */
  function jvalid(from, d) { var m = MJ(); return m && from === m.juez && d && d.e === m.e && d.q === qi; }
  function onMsg(t, d, role, from) {
    lastRx[from] = clock;
    handle(t, d, from, true);
  }
  function handle(t, d, from, nuevo) {
    var m = MJ(); if (!m || phaseCerrada) return;
    var p = idxOf(from);
    if (p < 0) return;
    if (t === 'rdy') { S.listos[from] = true; return; }
    if (!d || typeof d !== 'object') return;
    var juezTipo = t === 's' || t === 's2' || t === 'w' || t === 'ok' || t === 'jg' || t === 'end' || (t === 'ev' && (d.ty === 'cpu' || d.ty === 'hum'));
    if (juezTipo) {
      if (d.q !== qi) return;
      if (!jvalid(from, d)) {
        if (d.e > m.e && nuevo && pendJ.length < K.PENDIENTES_E) pendJ.push({ t: t, d: d, from: from, at: clock });
        return;
      }
    } else if (d.q !== qi) return;
    var j;
    switch (t) {
      case 'i': {
        var I = inputs[p]; if (!I) return;
        I.a = !!(d.b & 1); I.b = !!(d.b & 2); I.x = clamp((d.x || 0) / 100, -1, 1); I.y = clamp((d.y || 0) / 100, -1, 1);
        if (d.a && d.a.length === 2) { I.ta = d.a[0]; I.tb = d.a[1]; }
        return;
      }
      case 'o': {
        if (!d.b || !def.cuerpo) return;
        var tt = +d.t || 0, a0 = arrive('o' + from);
        for (j = 0; j < d.b.length; j++) {
          var body = d.b[j], pi = body[0];
          if (!((pi === p && !cpuAhora[pi]) || (from === m.juez && cpuAhora[pi]))) continue;
          if (mio(pi)) continue;
          var v = {};
          for (var f = 0; f < def.cuerpo.length; f++) v[def.cuerpo[f]] = body[f + 1];
          var buf = rem[pi];
          if (buf.length && tt < buf[buf.length - 1].t) continue;
          buf.push({ t: tt, v: v }); if (buf.length > 8) buf.shift();
          if (g && g.alRemoto) g.alRemoto(pi, v, tt);
        }
        return;
      }
      case 's': case 's2': {
        if (!esC) return;
        arrive('s');
        var key = d.t, sp = snapPart[key] || (snapPart[key] = {});
        if (t === 's') sp.p = d.p; else sp.p2 = d.p;
        var full = def.packN > K.PACK_SPLIT ? (sp.p && sp.p2) : sp.p;
        if (full) {
          var arr2 = def.packN > K.PACK_SPLIT ? sp.p.concat(sp.p2) : sp.p;
          delete snapPart[key];
          var last = snaps.length ? snaps[snaps.length - 1] : null;
          if (!last || key > last.t) { snaps.push({ t: key, p: arr2 }); if (snaps.length > 12) snaps.shift(); lastSnapRaw = { t: key, p: arr2 }; }
        }
        var ks = Object.keys(snapPart); if (ks.length > 6) delete snapPart[ks[0]];
        return;
      }
      case 'ev': {
        if (d.ty === 'cpu') { cpuAhora[d.p] = true; S.stats.eventos.push({ at: clock, ty: 'cpu', p: d.p }); return; }
        if (d.ty === 'hum') {
          cpuAhora[d.p] = false; S.stats.eventos.push({ at: clock, ty: 'hum', p: d.p });
          var obj = null;
          if (def.cuerpo && d.d) { obj = {}; for (j = 0; j < def.cuerpo.length; j++) obj[def.cuerpo[j]] = d.d[j]; }
          if (g && g.alHum) g.alHum(d.p, obj);
          return;
        }
        if (p === yo) return;                 // solo el eco propio; un ev del juez en nombre de un humano que él marcó CPU (d.p === yo) SÍ se aplica (los juegos lo deduplican)
        S.stats.eventos.push({ at: clock, ty: d.ty, p: d.p });
        if (g && g.onEv) g.onEv(d.ty, d.p, d.d, 0);
        return;
      }
      case 'cl': {
        if (esJuez() && typeof d.id === 'string') {
          var tr = Math.max(0, Math.min(0.6, gt() - (+d.t || 0) / 1000));      // tránsito observado: sube rápido y baja despacio
          transit = tr > transit ? transit * 0.4 + tr * 0.6 : transit * 0.95 + tr * 0.05;
          addClaim(d.id, p, +d.t || 0);
        }
        return;
      }
      case 'ok': aplicaOk(d.id, d.p); return;
      case 'jg': return;
      case 'end': recibeEnd(d); return;
      default:
        if (X_RE.test(t) && handlers[t]) handlers[t](d.d, p);
    }
  }
  function arrive(src) {
    var a = arr[src] || (arr[src] = { last: null, mean: 0.1, v: 0 }), t = clock;
    if (a.last !== null) { var iv = t - a.last; a.mean += (iv - a.mean) * 0.1; a.v += (Math.abs(iv - a.mean) - a.v) * 0.1; }
    a.last = t;
  }
  function recalcD() {
    var ks = Object.keys(arr), ms = 0, sg = 0, c = 0;
    ks.forEach(function (k2) { var a = arr[k2]; if (a.last !== null && clock - a.last < 2) { ms += a.mean; sg += a.v; c++; } });
    if (!c) return;
    var nd = clamp(1.5 * (ms / c) + 2 * (sg / c), K.D_MIN, K.D_MAX);
    D = D + clamp(nd - D, -0.02, 0.02);
  }

  /* ── veredicto ── */
  function scoresNorm() {
    var raw = (g ? g.scores() : []).map(function (v) { return Math.max(0, Math.round(v)); });
    while (raw.length < n) raw.push(0);
    return def.clase === 'survival' ? normSurvival(raw) : raw;
  }
  function recibeEnd(d) {
    if (esJuez() || !d || !d.sc || d.sc.length !== n || !d.pl) return;
    if (hashRes(d.sc, d.pl, d.kk) !== d.h) return;
    if (S.verdict && S.verdict.fuente === 'end' && S.verdict.h === d.h && S.verdict.e === d.e) return;
    S.over = true;
    S.verdict = { e: d.e, kk: d.kk, sc: d.sc.slice(), pl: d.pl.slice(), h: d.h, cpu: d.cpu || [], fuente: 'end' };
    if (!practica) net.mjack({ q: qi, e: d.e, kk: d.kk, h: d.h, sc: d.sc });
  }
  function terminar() {
    if (ended !== null && ended === epoch()) return;
    ended = epoch();
    var sc = scoresNorm(), pl = puestos(tipoCo, eqs, sc, def.clase), kk = Math.round(Math.min(gt(), dur) * 30), h = hashRes(sc, pl, kk);
    var cpu = []; for (var j = 0; j < n; j++) if (cpuAhora[j]) cpu.push(as[j]);
    S.over = true;
    S.verdict = { e: epoch(), kk: kk, sc: sc, pl: pl, h: h, cpu: cpu, fuente: 'propio' };
    S.stats.jueces.push({ e: epoch(), seat: yoId });
    finClk = clock; endResent = [false, false]; mjfinDone = false; mjfinAt = -9; mjfinTries = 0;
    sendEnd();
  }
  function sendEnd() {
    var v = S.verdict; if (!v) return;
    rawSend('end', { q: qi, e: epoch(), kk: v.kk, sc: v.sc, pl: v.pl, h: v.h, cpu: v.cpu }, false);
  }
  function mjfinTick() {
    if (practica || mjfinDone || !S.verdict || ended !== epoch()) return;
    if (clock - finClk < K.MJFIN_ESPERA) return;     // el `end` sale primero por el relé: en cuanto mjfin cierra la sala, sig responde 409 «Round is over» y un `end` rezagado se pierde
    if (clock - mjfinAt < 1 || mjfinTries >= 12) return;
    // una petición perdida tarda T_HTTP (10 s) en caducar y el plazo del servidor es de 3 s: NO se espera su respuesta, se reintenta cada 1 s (el servidor es idempotente: tras el primero responde 409 «Not now»)
    var v = S.verdict, e = epoch();
    mjfinAt = clock; mjfinTries++;
    var info = { status: -1, at: clock, e: e };
    S.stats.mjfin.push(info);
    var pr = net.mjfin({ q: qi, e: e, kk: v.kk, sc: v.sc, h: v.h, cpu: v.cpu });
    Promise.resolve(pr).then(function (r) {
      info.status = r ? r.status : 0;
      if (r && (r.status === 200 || r.status === 409) && e === epoch()) mjfinDone = true;
    }, function () { info.status = 0; });
  }

  /* ── promoción / caídas / migración ── */
  function promover() {
    S.stats.eventos.push({ at: clock, ty: 'promovido', e: epoch() });
    // el juez anterior pudo marcarme «CPU» por un tropiezo de red; si ahora soy juez estoy vivo, y NADIE más (cuidarCaidas salta al propio asiento) me devolvería a humano:
    // sin esto mi entrada se ignoraría toda la partida y jugaría la IA en mi lugar
    if (yo >= 0 && cpuAhora[yo] && !cpuOrig[yo]) {
      cpuAhora[yo] = false; fresh[yo] = 0;
      S.stats.eventos.push({ at: clock, ty: 'hum', p: yo });
      if (g && g.alHum) g.alHum(yo, null);
      rawSend('ev', { q: qi, e: epoch(), ty: 'hum', p: yo }, false);
    }
    for (var j = 0; j < n; j++) aiIn[j].ca = aiIn[j].ta, aiIn[j].cb = aiIn[j].tb;
    for (j = 0; j < n; j++) { inputs[j].ca = inputs[j].ta; inputs[j].cb = inputs[j].tb; }
    if (g) {
      if (esC) {
        if (lastSnapRaw) { g.restore(lastSnapRaw.p); k30 = Math.round(lastSnapRaw.t * 30 / 1000); } else k30 = Math.max(0, tickDe(gt()));
      } else {
        for (j = 0; j < n; j++) if (cpuAhora[j] && g.alCpu) g.alCpu(j);
      }
    }
    Object.keys(pend).forEach(function (id) { addClaim(id, yo, pend[id].t); });
    rawSend('jg', { q: qi, e: epoch() }, false);
    if (S.over && S.verdict && (S.verdict.fuente === 'end' || S.verdict.fuente === 'propio')) {
      S.verdict.e = epoch();      // el juez viejo murió con el veredicto ya emitido: hay que cobrarlo igual
      ended = epoch(); finClk = clock; endResent = [false, false]; mjfinDone = false; mjfinAt = -9; mjfinTries = 0; sendEnd();
    } else if (!def.migra && g && !S.over) terminar();
  }
  function silencio(id) {
    var s = net.silence ? net.silence(id) : Infinity;
    if (s === Infinity || s === undefined) { var l = lastRx[id]; s = l === undefined ? clock - startedClk : clock - l; }
    return s;
  }
  function oyendo(excl) {            // este cliente recibe algo: SSE vivo y, si hay otros pares, alguno oído hace poco (si no, el sordo soy yo)
    if (net.sseOK === false) return false;
    var otros = 0, oido = 0;
    for (var j = 0; j < n; j++) { if (j === yo || cpuOrig[j] || as[j] === excl) continue; otros++; if (silencio(as[j]) < 1) oido++; }
    return otros === 0 || oido > 0;
  }
  function cuidarCaidas(dt) {
    var oye = oyendo(null);
    for (var j = 0; j < n; j++) {
      if (j === yo || cpuOrig[j]) continue;
      var s = silencio(as[j]);
      if (!cpuAhora[j]) {
        if (s > K.CAIDA && oye) {
          cpuAhora[j] = true; fresh[j] = 0;
          rawSend('ev', { q: qi, e: epoch(), ty: 'cpu', p: j }, false);
          S.stats.eventos.push({ at: clock, ty: 'cpu', p: j });
          if (g && g.alCpu) g.alCpu(j);
        }
      } else {
        if (s < K.FRESCO) fresh[j] = (fresh[j] || 0) + dt; else fresh[j] = 0;
        if (fresh[j] >= K.FRESCO) {
          cpuAhora[j] = false; fresh[j] = 0;
          var b = esC || !g || !g.cuerpo ? null : cuerpoDe(j);
          var m = { q: qi, e: epoch(), ty: 'hum', p: j }; if (b) m.d = b;
          rawSend('ev', m, false);
          S.stats.eventos.push({ at: clock, ty: 'hum', p: j });
          if (g && g.alHum) g.alHum(j, null);
        }
      }
    }
  }
  function cuerpoDe(p) {
    var o = g.cuerpo(p), a = [];
    for (var j = 0; j < def.cuerpo.length; j++) a.push(Math.round(o[def.cuerpo[j]] || 0));
    return a;
  }
  function migrar() {
    // `cpuAhora[yo]` NO excluye: el juez pudo marcarme «CPU» por un tropiezo de red (un sig perdido tarda 2,5 s) y, si muere, nadie más me devolvería a humano
    var m = MJ(); if (!m || esJuez() || yo < 0 || cpuOrig[yo] || S.over) return;
    if (migradoE === m.e && (clock - migAt < K.MIGRA_REINTENTO || migTries >= 8)) return;    // la petición pudo perderse (caduca a los 10 s): se repite hasta que la época cambie
    if (silencio(m.juez) <= K.SIL_JUEZ) return;
    if (!oyendo(m.juez)) return;          // si mi propia recepción está muerta no depongo a un juez sano
    var suc = m.suc || [];
    for (var j = 0; j < suc.length; j++) {
      var s = suc[j], vivoS = s === yoId || silencio(s) < 2;       // la vida de un sucesor se mide por su silencio real, no por la marca «CPU» que puso el juez (que acaba de caer)
      if (!vivoS) continue;
      if (s !== yoId) return;
      if (migradoE !== m.e) migTries = 0;
      migradoE = m.e; migAt = clock; migTries++;
      net.juez({ k: m.k, e: m.e, q: qi });
      return;
    }
  }

  /* ── contexto de juego ── */
  function fxRand() { fx0 = (Math.imul(fx0, 1664525) + 1013904223) >>> 0; return fx0 / 4294967296; }
  var rngMain = rngFrom(spec.seed);
  var soloI = mj0.solo ? as.indexOf(mj0.solo) : -1;
  // equipos (DM3-1/2.1): rol de un asiento, su compañero (2v2), los demás de su bando y los del bando contrario. ffa/1v1: nadie es compañero, todos son rivales.
  function rolDe(p) {
    if (p < 0 || p >= n) return 'ffa';
    if (tipoCo === '2v2') return 'eq' + eqs[p];
    if (tipoCo === '1v3') return p === soloI ? 'solo' : 'trio';
    return 'ffa';
  }
  function companerosDe(p) { var l = []; if (tipoCo === 'ffa' || tipoCo === '1v1') return l; for (var j = 0; j < n; j++) if (j !== p && eqs[j] === eqs[p]) l.push(j); return l; }
  function rivalesDe(p) { var l = []; for (var j = 0; j < n; j++) if (j !== p && (tipoCo === 'ffa' || tipoCo === '1v1' || eqs[j] !== eqs[p])) l.push(j); return l; }
  var c = {
    n: n, yo: yo, seats: [], modo: tipoCo, equipos: eqs, solo: soloI, lv: spec.lv || 1, dur: dur, practica: practica,
    modelo: modelo, dt: K.FIJO,
    rol: rolDe, mates: companerosDe, rivales: rivalesDe,
    mate: function (p) { return tipoCo === '2v2' ? (companerosDe(p)[0] === undefined ? -1 : companerosDe(p)[0]) : -1; },
    campo: function () {
      var x0 = typeof root.gameLeft === 'function' ? root.gameLeft() : 0, x1 = typeof root.gameRight === 'function' ? root.gameRight() : 800;
      return { x0: x0, x1: x1, y0: 70, y1: 470 };
    },
    ahora: function () { return gt(); },
    rng: rngMain, rngFor: function (tag) { return rngFrom(spec.seed, tag); }, fx: fxRand,
    held: held, tap: tap, eje: eje, cpu: cpuAhora, skill: skill,
    juez: esJuez, send: cSend, on: cOn, ev: evSend, claim: claim, mio: mio, remoto: remoto,
    out: function (p, kk) { evSend('out', { kk: kk === undefined ? tickDe(gt()) : Math.max(0, Math.round(kk)) }, p === undefined ? yo : p); },
    util: { suave: suave, clamp: clamp, pj: pj, tick: tickDe }
  };
  Object.defineProperty(c, 'epoch', { get: epoch });
  function refreshSeats() {
    var b = B(), players = (net.room && net.room.players) || [];
    c.seats.length = 0;
    for (var j = 0; j < n; j++) {
      var pl = players.filter(function (x) { return x.id === as[j]; })[0] || {}, q = ((b && b.pj) || {})[as[j]] || {};
      c.seats.push({ id: as[j], name: pl.name || as[j], ch: q.ch || pl.ch || null, color: pl.color || null, cpu: cpuAhora[j], human: !cpuOrig[j], team: eqs[j], rol: rolDe(j) });
    }
  }
  refreshSeats();
  S.c = c;

  /* ── API de sesión ── */
  S.esJuez = esJuez; S.epoch = epoch; S.gt = gt; S.fair = fairDelay;      // fair: retraso de la entrada propia del juez en s (lo mide el banco de ventaja del juez)
  S.cuenta = function () {
    var t = gt(); if (t <= -900 || t >= 0.8) return null;
    if (t >= 0) return { n: 0, frac: t / 0.8 };
    var nn = Math.ceil(-t); if (nn > 3) return null;
    return { n: nn, frac: 1 - (-t - (nn - 1)) };
  };
  Object.defineProperty(S, 'phase', { get: function () {
    var b = B(), m = MJ();
    if (phaseCerrada || !b || !m || m.k !== kMJ || m.i !== qi) return 'cerrada';
    if (b.f === 'res') return 'res';
    if (b.f !== 'carta' && b.f !== 'mj') return 'cerrada';
    if (m.startAt == null) return 'carta';
    if (S.over) return 'fin';
    return gt() < 0 ? 'cuenta' : 'juego';
  } });
  S.in = {
    down: function (b) { if (S.phase !== 'juego') return; if (b === 'b') { own.b = true; own.tb++; } else { own.a = true; own.ta++; } },
    up: function (b) { if (b === 'b') own.b = false; else own.a = false; },
    tap: function (b) { if (S.phase !== 'juego') return; if (b === 'b') { own.tb++; pulse.b = true; } else { own.ta++; pulse.a = true; } },
    axis: function (x, y) { if (S.phase !== 'juego') { return; } own.x = clamp(+x || 0, -1, 1); own.y = clamp(+y || 0, -1, 1); }
  };
  S.ready = function () {
    if (S.phase !== 'carta' || yo < 0) return;
    if (!practica) { var bq = B(), pq = bq && bq.pj && bq.pj[yoId]; if (pq && pq.cpu === 'afk') return; }       // quien mira no marca LISTO (el reductor contestaría 409)
    S.listos[yoId] = true; readyAt = clock;
    if (!practica) { net.ready({ on: true }); rawSend('rdy', {}, false); }
  };
  S.result = function () { var b = B(); return b && b.f === 'res' && b.mj ? b.mj.res || null : null; };
  S.hud = function () {
    var sc = []; try { sc = g ? g.scores() : []; } catch (e) { sc = []; }
    var m = MJ(), items = [], eq2 = tipoCo === '2v2', tsum = {};
    for (var j = 0; j < n; j++) tsum[eqs[j]] = (tsum[eqs[j]] || 0) + Math.max(0, Math.round(sc[j] || 0));
    for (j = 0; j < n; j++) {
      var s = c.seats[j] || {}, txt = null;
      if (g && g.hudChip) { try { var tv = g.hudChip(j); txt = tv === undefined || tv === null ? null : String(tv).slice(0, 8); } catch (e2) { txt = null; } }
      items.push({ i: j, id: as[j], name: s.name, ch: s.ch, color: s.color, team: eqs[j], yo: j === yo, cpu: cpuAhora[j], caido: cpuAhora[j] && !cpuOrig[j],
        vivo: g && g.vivo ? !!g.vivo(j) : true, sc: Math.max(0, Math.round(sc[j] || 0)),
        mate: eq2 && yo >= 0 && j !== yo && eqs[j] === eqs[yo], rol: rolDe(j), tsc: eq2 ? tsum[eqs[j]] : Math.max(0, Math.round(sc[j] || 0)), txt: txt });
    }
    var t = gt();
    return { gt: t, dur: dur, quedan: Math.max(0, dur - Math.max(0, t)), over: S.over, fase: S.phase, juez: m ? m.juez : null, tipo: tipoCo, solo: soloI, items: items };
  };
  S.draw = function () { if (g) g.draw(); };
  S.close = function () {
    if (phaseCerrada) return;
    phaseCerrada = true;
    if (ch && ch.close) { try { ch.close(); } catch (e) {} }
    ch = null;
  };

  /* ── apertura de canal ── */
  if (practica) ch = { send: noop, onMsg: noop, close: noop };
  else if (yo >= 0) { ch = net.channel('m'); ch.onMsg(onMsg); }     // quien mira (su asiento no está en mj.as) NO abre el alcance m:<k>: el relé le contestaría 403 «Not in this round» a cada latido
  else { ch = null; }
  startedClk = 0;

  /* ── bucle ── */
  function envioI() {
    if (!usaI || yo < 0 || cpuAhora[yo] || practica) return;
    var bits = (own.a || pulse.a ? 1 : 0) | (own.b || pulse.b ? 2 : 0), x = Math.round(own.x * 100), y = Math.round(own.y * 100);
    var key = bits + ':' + own.ta + ':' + own.tb + ':' + x + ':' + y, due = clock - accI >= 1 / K.I_HZ;
    if ((key !== iSent && due) || clock - iKeep >= 1 / K.I_KEEP_HZ) {
      iSent = key; accI = clock; iKeep = clock;
      rawSend('i', { q: qi, b: bits, a: [own.ta, own.tb], x: x, y: y }, true);
    }
  }
  function envioO() {
    var bodies = [];
    for (var j = 0; j < n; j++) if (mio(j)) { var o = g.cuerpo(j), a = [j]; for (var f = 0; f < def.cuerpo.length; f++) a.push(Math.round(o[def.cuerpo[f]] || 0)); bodies.push(a); }
    if (bodies.length) rawSend('o', { q: qi, t: Math.round(gt() * 1000), b: bodies }, true);
  }
  function envioS() {
    var p = g.pack(), t = Math.round(k30 * 1000 / 30);
    if (p.length > K.PACK_SPLIT) { rawSend('s', { q: qi, e: epoch(), t: t, p: p.slice(0, K.PACK_SPLIT) }, true); rawSend('s2', { q: qi, e: epoch(), t: t, p: p.slice(K.PACK_SPLIT) }, true); }
    else rawSend('s', { q: qi, e: epoch(), t: t, p: p }, true);
  }
  function lerpSnap(a, b, u) {
    if (g.lerp) return g.lerp(a, b, u);
    var disc = {}, out = [];
    (def.packDiscretos || []).forEach(function (x) { disc[x] = 1; });
    for (var j = 0; j < b.length; j++) out.push(disc[j] || a[j] === undefined ? b[j] : interp(a[j], b[j], u));
    return out;
  }
  function vistaSnap() {
    if (!snaps.length) return null;
    var tr = (gt() - D) * 1000, last = snaps[snaps.length - 1];
    if (tr >= last.t) return last.p;
    if (tr <= snaps[0].t) return snaps[0].p;
    for (var j = snaps.length - 1; j > 0; j--) if (snaps[j - 1].t <= tr && tr <= snaps[j].t) {
      var a = snaps[j - 1], b = snaps[j]; return lerpSnap(a.p, b.p, b.t > a.t ? (tr - a.t) / (b.t - a.t) : 1);
    }
    return last.p;
  }
  function reevaluaPendJ() {
    if (!pendJ.length) return;
    var l = pendJ; pendJ = [];
    l.forEach(function (x) { if (clock - x.at < 3) handle(x.t, x.d, x.from, false); });
  }
  var lastBoardE = epoch();

  S.update = function (dt) {
    dt = clamp(dt || 0, 0, 0.1);
    clock += dt;
    if (S.phase === 'cerrada') return;
    var m = MJ(), ph = S.phase;
    // 1 sincroniza con board
    var e = epoch();
    if (e !== lastBoardE) {
      lastBoardE = e;
      if (juezId() !== yoId) Object.keys(pend).forEach(function (id) { rawSend('cl', { q: qi, id: id, t: pend[id].t }, false); });
      reevaluaPendJ();
    }
    // LISTO perdido: la petición caduca a los 10 s y la tarjeta ya lo muestra marcado; se repite hasta que board.mj.listos lo confirme
    if (ph === 'carta' && !practica && S.listos[yoId] && !(m.listos && m.listos[yoId]) && clock - readyAt >= K.READY_REINTENTO) { readyAt = clock; net.ready({ on: true }); }
    if (m.startAt != null && !g) {
      // quien volvió de AFK (botón «¡YA VOLVÍ!» de la tarjeta) o se fue a AFK mientras tanto: el reparto humano/CPU de la cuenta es el del tablero de ESTE momento
      var bpj = (B() && B().pj) || {};
      for (var j0 = 0; j0 < n; j0++) { var q0 = bpj[as[j0]] || {}; cpuOrig[j0] = q0.cpu === 'auto'; cpuAhora[j0] = !!q0.cpu; }
      g = S.g = def.mk(c);
      refreshSeats();
    }
    if (ph === 'res') {
      // si el cierre llegó antes que el `end` (o el `end` se perdió), esta pantalla adopta el resultado del servidor: mismo h que ven las demás
      var rs = S.result();
      if (rs && rs.sc && rs.h !== undefined && (!S.verdict || S.verdict.h !== rs.h)) {
        S.over = true;
        S.verdict = { e: epoch(), kk: S.verdict ? S.verdict.kk : Math.round(dur * 30), sc: rs.sc.slice(), pl: (rs.puestos || rs.pl || []).slice(), h: rs.h, cpu: rs.cpu || [], fuente: 'res' };
      }
      return;
    }
    // 2 promoción
    var soyJuez = esJuez();
    if (soyJuez && ((juezPrev !== null && juezPrev !== yoId) || (juezPrev === null && epoch() > 0))) promover();
    juezPrev = juezId();
    if (!g) return;
    var t = gt();
    if (t < 0) return;
    if (!onGoDone) { onGoDone = true; S.go = true; if (opts.onGo) opts.onGo({ k: kMJ, i: qi, gt: t, wall: Date.now() }); }
    // reabastecer cubetas de toques
    for (var j = 0; j < n; j++) { inputs[j].bud[0] = Math.min(K.TOQUES_MAX, inputs[j].bud[0] + dt * K.TOQUES_MAX); inputs[j].bud[1] = Math.min(K.TOQUES_MAX, inputs[j].bud[1] + dt * K.TOQUES_MAX); }
    pushOwnHist();
    Object.keys(pend).forEach(function (id) {       // un `ok` perdido no deja la reclamación abierta para siempre
      if (clock - pend[id].at > K.CLAIM_TTL) { var pd = pend[id]; delete pend[id]; pd.cb('no'); }
    });
    if (!S.over) {
      if (!esC) {
        for (j = 0; j < n; j++) if (cpuAhora[j] && mio(j) && !practicaHumano(j)) g.ai(j, dt, apiDe(j));
        g.update(dt);
        accBody += dt;
        if (accBody >= 1 / def.bodyHz) { accBody = 0; envioO(); }
        if (soyJuez) { resolverClaims(); if (!practica) cuidarCaidas(dt); }
      } else {
        refreshOwnView();
        if (soyJuez) {
          if (!practica) cuidarCaidas(dt);
          var target = tickDe(t);
          if (target - k30 > K.MAX_CATCHUP) k30 = target - K.MAX_CATCHUP;
          var guard = 0;
          while (k30 < target && guard++ < K.MAX_CATCHUP) {
            for (j = 0; j < n; j++) if (cpuAhora[j]) g.ai(j, K.FIJO, apiDe(j));
            g.step(K.FIJO); k30++;
            if (k30 % Math.round(30 / def.snapHz) === 0) envioS();
          }
          g.update(dt);
        } else {
          var vv = vistaSnap();
          if (vv) { g.unpack(vv); if (g.predict) g.predict(dt, lastSnapRaw ? lastSnapRaw.p : vv); }
          g.update(dt);
        }
        accBody += dt;
      }
      if (usaI) envioI();
      if (soyJuez) {
        var done = g.done && g.done();
        if (t >= dur || (def.limites.finTemprano && done && t >= minTEf)) terminar();
      } else if (t > dur + K.ESPERA_END && !S.over) {
        S.over = true;
        var sc = scoresNorm(), pl = puestos(tipoCo, eqs, sc, def.clase), kk = Math.round(dur * 30), h = hashRes(sc, pl, kk);
        S.verdict = { e: epoch(), kk: kk, sc: sc, pl: pl, h: h, cpu: [], fuente: 'propio' };
        if (!practica) net.mjack({ q: qi, e: epoch(), kk: kk, h: h, sc: sc });
      }
      if (!soyJuez && !S.over) migrar();
    }
    if (soyJuez && S.over && finClk !== null) {
      mjfinTick();
      for (j = 0; j < 2; j++) if (!endResent[j] && clock - finClk >= K.REENVIO_END[j]) { endResent[j] = true; if (B().f === 'mj') sendEnd(); }
    }
    if (++dCnt % 30 === 0) recalcD();
    pulse.a = pulse.b = false;
  };
  function practicaHumano(j) { return practica && !opts.sim && j === yo; }

  return S;
}

/* ───────────── sesión local sin red: práctica y simulación (M3-TEAMS DM3-6) ───────────── */
var LOCAL_BASE = 1790000000000;
var LOCAL_CH = ['mama', 'abuela', 'tio', 'pana', 'chuo'];      // retratos que BUS.AP.CAST dibuja; los CPU toman los que el jugador no usa
var LOCAL_NOM = ['TÚ', 'PANA', 'PROFE', 'CHUO'];
// '1,2,3' o arreglo -> arreglo (los nombres vienen URI-codificados en la URL; fiesta-main ya los decodifica) · nada -> null
function lista(v) { if (v == null || v === '') return null; return Array.isArray(v) ? v : String(v).split(','); }
function soloEquipo(def) { return def.modos.indexOf('ffa') < 0 && def.modos.indexOf('1v1') < 0; }
/* Arma el tablero falso de una sesión local. Práctica de un juego que admite ffa/1v1: duelo 1v1 contra una CPU (comportamiento de M2, intacto).
   Juego solo de equipo: 4 asientos a..d. 2v2 -> eq [[a,b],[c,d]] (tú + pana CPU contra 2 CPU); 1v3 -> rol 'solo' (por defecto) = a, rol 'trio' = el solo es b (CPU).
   sim: sin humanos (todos 'auto'); tipo/eq/solo/n elegibles, por defecto el primer formato del juego. */
function localBoard(def, id, o, seed, dur, sim) {
  var yoId = o.yo || 'a', tipo, as, eq, solo = null, i;
  if (sim) tipo = o.tipo || def.modos[0];
  else tipo = o.tipo && def.modos.indexOf(o.tipo) >= 0 ? o.tipo : soloEquipo(def) ? def.modos[0] : '1v1';   // o.tipo: tablero local (docs/margarita) pide el formato de 4
  if (def.modos.indexOf(tipo) < 0 && !(tipo === '1v1' && def.modos.indexOf('ffa') >= 0)) throw new Error('LIVE: ' + id + ' no admite el formato ' + tipo);
  if (tipo === '1v1' && !sim) {
    var other = yoId === 'a' ? 'b' : 'a';
    as = [yoId, other].sort(); eq = [[yoId], [other]];
  } else if (tipo === '1v1') { as = ['a', 'b']; eq = [['a'], ['b']]; }
  else if (tipo === 'ffa') { as = ['a', 'b', 'c', 'd'].slice(0, Math.max(2, Math.min(4, o.n || 4))); eq = as.map(function (x) { return [x]; }); }
  else if (tipo === '2v2') { as = ['a', 'b', 'c', 'd']; eq = o.eq || [['a', 'b'], ['c', 'd']]; }
  else if (tipo === '1v3') {
    as = ['a', 'b', 'c', 'd'];
    solo = o.solo || (!sim && o.rol === 'trio' ? (yoId === 'b' ? 'a' : 'b') : sim ? 'a' : yoId);
    eq = [[solo], as.filter(function (x) { return x !== solo; })];
  } else throw new Error('LIVE: formato desconocido ' + tipo);
  if (as.indexOf(yoId) < 0) yoId = as[0];
  var board = { f: 'mj', cfg: { cpuNivel: o.cpuNivel || 2 }, pj: {}, mj: { k: 0, i: 0, as: as, tipo: tipo, eq: eq, solo: solo, clase: def.clase,
    cola: [{ g: id, seed: seed, dur: dur, lv: o.lv || 1, modelo: def.modelo }], juez: yoId, e: 0, suc: [], startAt: LOCAL_BASE + Math.max(0, +o.cuenta || 0) * 1000, listos: {}, res: null } };   // o.cuenta: s de «3·2·1» antes del juego
  // o.noms / o.chs (tablero de Margarita): nombres y personajes por ASIENTO (a,b,c,d -> índice 0..3; en 1v1 basta con 2). Sin ellos, lo de siempre.
  var noms = lista(o.noms), chs = lista(o.chs), porAs = function (l, x) { var v = l ? l['abcd'.indexOf(x)] : null; return v ? String(v) : null; };
  var usados = as.map(function (x) { return porAs(chs, x); }).concat([o.ch || 'mama']);
  var players = [], libres = LOCAL_CH.filter(function (x) { return usados.indexOf(x) < 0; }), k = 0;
  if (!libres.length) libres = LOCAL_CH.slice();
  as.forEach(function (x, j) {
    var humano = !sim && x === yoId, nm = porAs(noms, x), cx = porAs(chs, x);
    var chF = humano ? (o.ch || 'mama') : (tipo === '1v1' && !sim ? 'abuela' : libres[k++ % libres.length]);
    var nmF = tipo === '1v1' && !sim ? (humano ? 'TÚ' : 'PROFE') : (humano ? 'TÚ' : LOCAL_NOM[j] === 'TÚ' ? 'CPU ' + (j + 1) : LOCAL_NOM[j]);
    board.pj[x] = { cpu: humano ? null : 'auto', ch: cx || chF };
    if (nm) board.pj[x].name = nm;
    players.push({ id: x, name: nm || nmF });
  });
  return { board: board, players: players, yoId: yoId };
}
function localNet(L, clockRef) {
  return { board: L.board, you: { id: L.yoId }, room: { players: L.players },
    serverNow: function () { return LOCAL_BASE + clockRef.ms; }, channel: function () { return { send: noop, onMsg: noop, close: noop }; },
    silence: function () { return 0; }, rtt: function () { return 0; }, ready: noop, juez: noop, mjack: noop,
    mjfin: function () { return Promise.resolve({ ok: true, status: 200 }); } };
}

/* ───────────── práctica: sesión local sin red ───────────── */
function practice(id, o) {
  o = o || {};
  var def = REG[id]; if (!def) throw new Error('LIVE.practice: juego no registrado ' + id);
  var dur = o.dur || Math.min(def.dur, 20), clk = { ms: 0 }, sess = null, closed = false, L = null;
  var seed = o.seed || ((Date.now() % 2147483646) + 1);   // único sitio donde se permite el reloj de pared
  function mk() {
    L = localBoard(def, id, o, seed, dur, false);
    sess = create({ net: localNet(L, clk), yo: L.yoId, practica: true, strict: !!o.strict, log: o.log, skillFix: 0.5, onGo: o.onGo });
  }
  mk();
  var P = {
    update: function (dt) { if (closed) return; clk.ms += Math.min(.1, dt || 0) * 1000; sess.update(dt); },
    draw: function () { sess.draw(); },
    get in() { return sess.in; },
    hud: function () { return sess.hud(); },
    gt: function () { return sess.gt(); },
    get fin() { return !!sess.over; },
    get sess() { return sess; },
    get board() { return L.board; },
    reiniciar: function () { sess.close(); clk.ms = 0; seed = ((seed * 1103515245 + 12345) >>> 0) % 2147483646 + 1; mk(); },
    close: function () { closed = true; sess.close(); }
  };
  return P;
}

/* ───────────── simulación: una partida completa con TODOS los asientos CPU, sin red ni dibujo (bancos y pruebas) ─────────────
   LIVE.sim(id, {tipo, eq?, solo?, n?, seed, lv, dur?, skill: número|arreglo, cpuNivel?}) -> {sc, pl, h, kk, ganaLado, vista, eventos, tipo, eq, fin}
   Ejecuta el `create()` REAL (juez, terminar, puestos, hash) con un reloj virtual a 30 Hz; mismo seed => mismo resultado. ganaLado: 'eq0'|'eq1'|'solo'|'trio'|'ffa'|'empate'. */
var SIM_PASO = [33, 33, 34];
function sim(id, o) {
  o = o || {};
  var def = REG[id]; if (!def) throw new Error('LIVE.sim: juego no registrado ' + id);
  var seed = o.seed || 1, dur = o.dur || def.dur, clk = { ms: 0 }, L = localBoard(def, id, o, seed, dur, true);
  var sess = create({ net: localNet(L, clk), yo: L.yoId, practica: true, sim: true, strict: !!o.strict, log: o.log, skillFix: o.skill });
  var mj = L.board.mj, eqs = eqIdx(mj), soloI = mj.solo ? mj.as.indexOf(mj.solo) : -1, i = 0;
  var max = Math.ceil((dur + 3) * 30) + 30;
  for (; i < max && !sess.over; i++) { var ms = SIM_PASO[i % 3]; clk.ms += ms; sess.update(ms / 1000); }
  var v = sess.verdict, sc, pl, h, kk;
  if (v) { sc = v.sc.slice(); pl = v.pl.slice(); h = v.h; kk = v.kk; }
  else {
    sc = (sess.g ? sess.g.scores() : []).map(function (x) { return Math.max(0, Math.round(x)); });
    pl = puestos(mj.tipo, eqs, sc, def.clase); kk = Math.round(Math.min(sess.gt(), dur) * 30); h = hashRes(sc, pl, kk);
  }
  var todos = pl.every(function (x) { return x === pl[0]; }), gana;
  if (todos) gana = 'empate';
  else if (mj.tipo === '2v2') gana = 'eq' + eqs[pl.indexOf(1)];
  else if (mj.tipo === '1v3') gana = pl[soloI] === 1 ? 'solo' : 'trio';
  else gana = 'ffa';
  var out = { sc: sc, pl: pl, h: h, kk: kk, ganaLado: gana, tipo: mj.tipo, eq: eqs, fin: !!v, tics: i,
    vista: sess.g && sess.g.vista ? sess.g.vista() : null, eventos: sess.stats.eventos.slice() };
  sess.close();
  return out;
}

/* ───────────── capa de navegador (fina) ───────────── */
var KEYS = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  Space: 'a', KeyJ: 'a', Enter: 'a', ShiftLeft: 'b', ShiftRight: 'b', KeyK: 'b' };
function bindKeys(target, getIn) {
  if (!target || !target.addEventListener) return noop;
  var st = { u: 0, d: 0, l: 0, r: 0 };
  function eje() { var inp = getIn(); if (inp) inp.axis(st.r - st.l, st.d - st.u); }
  function h(down) {
    return function (ev) {
      var k = KEYS[ev.code]; if (!k) return;
      var inp = getIn(); if (!inp) return;
      if (k === 'a' || k === 'b') { if (down) { if (!ev.repeat) inp.down(k); } else inp.up(k); }
      else { st[k] = down ? 1 : 0; eje(); }
      if (ev.preventDefault) ev.preventDefault();
    };
  }
  var kd = h(true), ku = h(false);
  target.addEventListener('keydown', kd); target.addEventListener('keyup', ku);
  return function () { target.removeEventListener('keydown', kd); target.removeEventListener('keyup', ku); };
}
function run(obj, drawFn, raf) {
  raf = raf || root.requestAnimationFrame; var last = null, on = true;
  function frame(ts) {
    if (!on) return;
    var dt = last === null ? 0 : (ts - last) / 1000; last = ts;
    obj.update(Math.min(.1, dt)); if (drawFn) drawFn(); else obj.draw();
    raf(frame);
  }
  raf(frame);
  return function () { on = false; };
}

F.LIVE = {
  add: add, get: function (id) { return REG[id] || null; }, ids: function () { return Object.keys(REG); }, defs: REG,
  create: create, practice: practice, sim: sim, RESERVED: RESERVED, K: K, util: util, bindKeys: bindKeys, run: run
};
if (typeof module !== 'undefined') module.exports = F.LIVE;
})(typeof window !== 'undefined' ? window : globalThis);
