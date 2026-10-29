// LA FIESTA · DIRECTOR del tablero en vivo (M1; doc 07 §5.3 y §7, doc 09 §9.3). Sin DOM, puro, con reloj inyectado.
// Recibe registros de sala (board S con `ver` y el anillo `fx`) por SSE/sondeo: desordenados, duplicados o con huecos.
// Arma una cola ORDENADA y sin duplicados de lotes fx ya resueltos y la reproduce como pasos con duración
// (FIESTA.reglas.FX_MS), aplicando cada efecto al tablero mostrado con reglas.aplicaFx. El renderer SOLO lee `D`.
//
// API: FIESTA.director.create(opts) -> d          (Node: require('./fiesta-director.js').create)
//   opts = { yo:'a'|null, clock:()=>ms, serverNow:()=>ms, reglas, mapa, fxMs, maxV:6, maxMs:6000, gapMs:300, skipMs:1600,
//            onPrompt(vista|null, esp|null), onSkip({why, lines, ver}), onDesync({ver, hD, hS}), onStep(paso), onIdle(ver) }
//   d.push(roomOrBoard)  -> 'nuevo'|'viejo'|'dup'|'nulo'   acepta {ver, board} (registro de sala) o el board directo
//   d.update(dt?)        -> D    avanza dt ms (sin dt: usa opts.clock()). Llamar una vez por cuadro.
//   d.local(ev)          encola un evento SOLO cosmético {k, ms, txt?, s?, keep?} en orden con la cola (no toca el tablero)
//   d.tap()              toque en pantalla: ×3 durante K.TAP_MS (solo local)
//   d.rollLocal()        el dado de `yo` gira ya (ocultar latencia); se detiene con el fx `dado` o a los K.ROLL_MS
//   d.skip(why?)         salto inmediato a S (p. ej. a startAt-3000 del minijuego); d.reset() olvida todo; d.setYo(s)
//   getters: isIdle() skipping() speed() ver() target() board() hash() hashS() pos(s) coins(s) stars(s) dice(s) star()
//            step() toasts() prompt() espera() pending() stats()
//   D = { board, ver, target, idle, speed, skipping, fichas:{s:{x,y,nodo,salto,hop,modo}}, mon:{s}, est:{s},
//         dados:{s:{v,dados,de,t,rolling,cara,resto,local}}, estrella:{nodo,x,y,de,t,moving,precio,i}, estrellas:[{nodo,x,y,de,t,moving,precio,i}] (1 o 2; estrella = la primera), paso:{k,f,t,ms,v,local}|null,
//         toasts:[{id,k,s,txt,t,born,ms}], golpe:{s:0..1}, prompt, espera, resumen:{why,lines,t}|null, log }
// Reglas:
//   · Un board con ver <= S.ver no reemplaza a S (pero su anillo sí aporta lotes que falten). Lotes por `v`, sin duplicados.
//   · Hueco (falta el lote shownV+1 y la cola ya se vació): espera gapMs por si llega desordenado; luego salto D = S.
//   · Atraso: más de maxV versiones sin mostrar, o lo que queda DESPUÉS del lote en curso tarda > maxMs a la velocidad
//     actual ⇒ salto sin animación con la tarjeta «Mientras no estabas…» (D.resumen, skipping() durante skipMs).
//   · Velocidad: pendientes <=1 ×1, <=3 ×2, si no ×3; tocar = ×3 adicional.
//   · En reposo: hash(D.board) === hash(S); si no, D = S y onDesync (nunca debería pasar: proyectar == aplicar).
//   · Aviso: visible cuando el tablero mostrado ya llegó a la versión que lo creó (D.ver >= S.esp.id) y es de `yo`
//     según reglas.vista(S, yo) — nunca un aviso viejo (se lee de S), y nunca bloquea la cola (la cola no espera avisos).
(function (root) {
'use strict';
var F = root.FIESTA = root.FIESTA || {};
var NODE = typeof require !== 'undefined' && typeof module !== 'undefined';
function REG() { return F.reglas || (NODE ? require('./fiesta-reglas.js') : null); }
var K = { MAX_V: 6, MAX_MS: 6000, GAP_MS: 300, SKIP_MS: 1600, TAP_MS: 1500, TAP_X: 3, TOAST_MS: 2200, TOASTS: 4,
  ROLL_MS: 3000, DT_MAX: 10000, GUARD: 20000, GOLPE_MS: 600, FAN: 18, RESUMEN: 6 };
var TOAST_K = { turno: 1, ronda: 1, est: 1, ataque: 1, evento: 1, afk: 1, vuelve: 1, llega: 1, bonus: 1, fin: 1, mjIni: 1, mjRes: 1, ruleta: 1, obj: 1, estrellaMueve: 1 };
function clon(x) { return x === undefined || x === null ? x : JSON.parse(JSON.stringify(x)); }
function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function create(o) {
  o = o || {};
  var R = o.reglas || REG(), MAPA = o.mapa || R.mapa, FX = o.fxMs || R.FX_MS;
  var k = {}; Object.keys(K).forEach(function (x) { k[x] = K[x]; });
  if (o.maxV != null) k.MAX_V = o.maxV; if (o.maxMs != null) k.MAX_MS = o.maxMs;
  if (o.gapMs != null) k.GAP_MS = o.gapMs; if (o.skipMs != null) k.SKIP_MS = o.skipMs;
  var clk = o.clock || null, srvNow = o.serverNow || null, yo = o.yo || null;
  var noop = function () {};
  var hk = { prompt: o.onPrompt || noop, skip: o.onSkip || noop, desync: o.onDesync || noop, step: o.onStep || noop, idle: o.onIdle || noop };

  var S = null, B = null;                 // S = último board por ver; B = tablero mostrado (se muta con aplicaFx)
  var lotes = {}, lastQV = -1, q = [], cur = null, T = 0, lastClk = null;
  var tapUntil = -1, skipUntil = -1, gapAt = null, promptKey = null, hashedAt = -1, toastId = 0;
  var A = { mon: {}, est: {}, dados: {}, golpe: {}, estrella: {}, toasts: [], resumen: null, roll: null };
  var st = { recibidos: 0, dup: 0, viejos: 0, nulos: 0, saltos: 0, desync: 0, pasos: 0, lotes: 0, huecos: 0 };
  var D = { board: null, ver: -1, target: -1, idle: true, speed: 1, skipping: false, fichas: {}, mon: {}, est: {}, dados: {},
    estrella: null, estrellas: [], paso: null, toasts: [], golpe: {}, prompt: null, espera: null, resumen: null, log: [] };

  function shownV() { return B ? B.ver : -1; }
  function nombre(s) { return B && s && B.pj[s] ? B.pj[s].name : (s || ''); }
  function nodoXY(n) { var x = MAPA && MAPA.nodos[n]; return x ? { x: x.x, y: x.y } : { x: 0, y: 0 }; }

  /* ───── entrada ───── */
  function harvest(ring) {
    if (!ring || !ring.length || !B) return;
    for (var i = 0; i < ring.length; i++) {
      var b = ring[i]; if (!b || typeof b.v !== 'number' || !b.fx) continue;
      if (b.v > lastQV && !lotes[b.v]) lotes[b.v] = b;
    }
  }
  function enqueue() {
    while (lotes[lastQV + 1]) {
      var b = lotes[lastQV + 1]; delete lotes[lastQV + 1]; lastQV++; st.lotes++;
      for (var i = 0; i < b.fx.length; i++) { var f = b.fx[i]; q.push({ k: f.k, f: f, ms: FX[f.k] || 0, v: b.v, s: b.s, el: 0 }); }
    }
  }
  function push(x) {
    if (!x || typeof x !== 'object') { st.nulos++; return 'nulo'; }
    var b = x.board !== undefined ? x.board : x;
    if (!b || typeof b !== 'object' || !b.pj) { st.nulos++; return 'nulo'; }
    var v = typeof b.ver === 'number' ? b.ver : (typeof x.ver === 'number' ? x.ver : null);
    if (v === null) { st.nulos++; return 'nulo'; }
    st.recibidos++;
    if (S && v < S.ver) { st.viejos++; harvest(b.fx); enqueue(); return 'viejo'; }
    if (S && v === S.ver) { st.dup++; return 'dup'; }
    S = clon(b); if (S.ver !== v) S.ver = v;
    if (!B) { snap(null); return 'nuevo'; }
    harvest(S.fx); enqueue();
    if (gapAt === null && S.ver > lastQV && !lotes[lastQV + 1]) gapAt = T;   // el plazo del hueco corre desde que se nota
    atraso();
    return 'nuevo';
  }

  /* ───── velocidad, atraso y saltos ───── */
  function pendientes() { return S && B ? Math.max(0, S.ver - B.ver) : 0; }
  function speed() { var p = pendientes(), x = p <= 1 ? 1 : p <= 3 ? 2 : 3; if (T < tapUntil) x *= k.TAP_X; return x; }
  function atraso() {
    if (!S || !B) return false;
    if (pendientes() > k.MAX_V) { skip('atras'); return true; }
    var curV = cur && !cur.local ? cur.v : null, ms = 0, i;
    if (curV === null) for (i = 0; i < q.length; i++) if (!q[i].local) { curV = q[i].v; break; }
    for (i = 0; i < q.length; i++) if (!q[i].local && q[i].v !== curV) ms += q[i].ms;
    for (var v in lotes) if (+v > lastQV) ms += R.fxMs(lotes[v].fx);
    if (ms / speed() > k.MAX_MS) { skip('cola'); return true; }
    return false;
  }
  function perdidas(viejo, nuevo) {          // líneas del log que no se vieron (para «Mientras no estabas…»)
    nuevo = nuevo || []; if (!viejo || !viejo.length) return nuevo.slice(-k.RESUMEN);
    var ult = viejo[viejo.length - 1], j = nuevo.lastIndexOf(ult);
    var l = j >= 0 ? nuevo.slice(j + 1) : nuevo.slice(-k.RESUMEN);
    return l.slice(-k.RESUMEN);
  }
  function snap(why) {
    var viejoLog = B ? B.log : null;
    B = clon(S); lastQV = B.ver; lotes = {}; gapAt = null;
    q = q.filter(function (s) { return s.local && s.keep; }); if (cur && !(cur.local && cur.keep)) cur = null;
    A.mon = {}; A.est = {}; A.dados = {}; A.golpe = {}; A.estrella = {}; A.roll = null;
    hashedAt = B.ver;
    if (why) {
      st.saltos++; skipUntil = T + k.SKIP_MS;
      A.resumen = { why: why, lines: perdidas(viejoLog, B.log), t0: T };
      hk.skip({ why: why, lines: A.resumen.lines, ver: B.ver });
    }
  }
  function skip(why) { if (!S) return; snap(why || 'manual'); }

  /* ───── reproducción ───── */
  function shownMon(s) { var a = A.mon[s]; if (!a) return B.pj[s] ? B.pj[s].mon : 0; return a.from + (a.to - a.from) * c01(a.ms ? (T - a.t0) / a.ms : 1); }
  function shownEst(s) { var a = A.est[s]; if (!a) return B.pj[s] ? B.pj[s].est : 0; return a.from + (a.to - a.from) * c01(a.ms ? (T - a.t0) / a.ms : 1); }
  function toast(kind, s, txt, ms) {
    A.toasts.push({ id: ++toastId, k: kind, s: s || null, txt: txt, born: T, ms: Math.max(ms || 0, k.TOAST_MS) });
    while (A.toasts.length > k.TOASTS) A.toasts.shift();
  }
  function textoDe(f) {
    var n = nombre(f.s);
    switch (f.k) {
      case 'turno': return '¡LE TOCA A ' + String(n).toUpperCase() + '!';
      case 'ronda': return 'RONDA ' + f.r + '/' + (B ? B.tot : '');
      case 'est': return n + (f.d > 0 ? ' ganó ' : ' perdió ') + Math.abs(f.d) + ' ★';
      case 'ataque': return n + ' → ' + nombre(f.a) + ': ' + ((R.OBJ[f.item] || {}).n || f.item);
      case 'evento': return f.txt || f.id;
      case 'afk': return n + ' se fue a la hamaca 💤';
      case 'vuelve': return '¡VOLVIÓ ' + n + '!';
      case 'llega': return '¡LLEGÓ ' + f.name + '!';
      case 'bonus': return 'Bonus ' + f.id + ': ' + n + ' +1 ★';
      case 'fin': return '¡Ganó ' + (f.gan || []).map(nombre).join(' y ') + '!';
      case 'mjIni': return f.rel ? '¡RELÁMPAGO!' : f.tipo === '2v2' ? '¡2 CONTRA 2!' : f.tipo === '1v3' ? '¡1 CONTRA 3!' : f.tipo === '1v1' ? '¡DUELO!' : '¡TODOS CONTRA TODOS!';
      case 'mjRes': return f.empate ? 'Se fue la luz: empate' : 'Resultados del minijuego';
      case 'ruleta': return 'Ruleta: ' + f.que;
      case 'obj': return f.que === 'compra' ? n + ' compró ' + ((R.OBJ[f.item] || {}).n || f.item) : null;
      case 'estrellaMueve': return (B && B.estrella && B.estrella.b ? 'La Abuela de ' + ((MAPA.nodos[f.de] || {}).n || f.de) + ' se muda a ' : 'La Abuela se muda a ') + ((MAPA.nodos[f.a] || {}).n || f.a);
    }
    return null;
  }
  function begin(p) {
    var sp = speed(), f = p.f, s = f && f.s;
    if (p.local) { if (f && f.txt) toast(p.k, s, f.txt, p.ms); hk.step(p); return true; }
    var mon0 = s && B.pj[s] ? shownMon(s) : 0, est0 = s && B.pj[s] ? shownEst(s) : 0;
    try { R.aplicaFx(B, f); } catch (e) { desync('fx:' + f.k); return false; }
    var ms = p.ms / sp;
    if (f.k === 'mon') A.mon[s] = { from: mon0, to: f.tot, t0: T, ms: ms };
    else if (f.k === 'est') A.est[s] = { from: est0, to: f.tot, t0: T, ms: ms };
    else if (f.k === 'dado') { A.dados[s] = { v: f.v, dados: f.dados || [f.v], de: f.de, t0: T, ms: ms, resto: f.v }; if (s === yo) A.roll = null; }
    else if (f.k === 'hop') { var d = A.dados[s]; if (d && f.pasos) d.resto = Math.max(0, d.resto - f.pasos); }
    else if (f.k === 'estrellaMueve') A.estrella[f.i === 1 ? 1 : 0] = { de: f.de, a: f.a, t0: T, ms: ms };
    else if (f.k === 'turno' || f.k === 'ronda' || f.k === 'mjIni') A.dados = {};
    else if (f.k === 'ataque') A.golpe[f.a] = T;
    if (TOAST_K[f.k]) { var tx = textoDe(f); if (tx) toast(f.k, s || f.a || null, tx, p.ms); }
    hk.step(p);
    return true;
  }
  function desync(why) {
    st.desync++;
    var hD = B ? R.hash(B) : 0, hS = S ? R.hash(S) : 0;
    snap(null); hk.desync({ ver: S ? S.ver : -1, hD: hD, hS: hS, why: why });
  }
  function alReposo() {
    if (!S || !B || B.ver !== S.ver || hashedAt === S.ver) return;
    hashedAt = S.ver;
    if (R.hash(B) !== R.hash(S)) { desync('hash'); return; }
    hk.idle(S.ver);
  }
  function pull() {
    enqueue();
    if (!q.length) {
      if (S && B && S.ver > B.ver) {                     // falta un lote: quizá llega desordenado; si no, salto
        if (gapAt === null) gapAt = T;
        if (T - gapAt >= k.GAP_MS) { st.huecos++; skip('hueco'); }
        return false;
      }
      gapAt = null; alReposo(); return false;
    }
    if (!q[0].local && atraso()) return q.length ? pull() : false;
    cur = q.shift(); cur.el = 0; st.pasos++;
    if (!begin(cur)) { cur = null; return false; }
    return true;
  }
  function update(dt) {
    if (dt == null) { if (clk) { var c = clk(); dt = lastClk === null ? 0 : c - lastClk; lastClk = c; } else dt = 16; }
    dt = Math.max(0, Math.min(+dt || 0, k.DT_MAX)); T += dt;
    if (S && B && srvNow && S.mj && S.mj.startAt && B.ver < S.ver && srvNow() >= S.mj.startAt - 3000) skip('mj');
    var budget = dt, g = 0;
    while (B && g++ < k.GUARD) {
      if (!cur && !pull()) break;
      var sp = speed(), need = (cur.ms - cur.el) / sp;
      if (budget >= need) { budget -= need; cur.el = cur.ms; cur = null; }
      else { cur.el += budget * sp; budget = 0; break; }
    }
    if (B && !cur && !q.length) alReposo();
    refresh();
    return D;
  }

  /* ───── estado de animación para el renderer ───── */
  function isIdle() { return !cur && !q.length && (!S || !B || B.ver === S.ver); }
  function prompt() {
    if (!S || !B || yo === null || !S.pj || !S.pj[yo]) return null;
    var v = R.vista(S, yo), e = S.esp;
    if (v.listo && B.f === 'carta' && B.mj && S.mj && B.mj.k === S.mj.k && B.mj.i === S.mj.i) return v;
    if (v.mio && e && B.ver >= e.id) return v;
    return null;
  }
  function fichas() {
    var out = {}, en = {};
    Object.keys(B.pj).forEach(function (s) {
      var p = B.pj[s], hop = cur && !cur.local && cur.k === 'hop' && cur.f.s === s ? cur : null, x;
      if (hop) {
        var t = c01(hop.ms ? hop.el / hop.ms : 1), a = nodoXY(hop.f.de), b = nodoXY(hop.f.a);
        x = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nodo: hop.f.a, de: hop.f.de, salto: Math.sin(Math.PI * t), hop: true, modo: hop.f.modo || null, t: t };
      } else { var c = nodoXY(p.nodo); x = { x: c.x, y: c.y, nodo: p.nodo, de: null, salto: 0, hop: false, modo: null, t: 1 }; (en[p.nodo] = en[p.nodo] || []).push(s); }
      out[s] = x;
    });
    Object.keys(en).forEach(function (n) { var l = en[n]; l.forEach(function (s, i) { out[s].x += (i - (l.length - 1) / 2) * k.FAN; }); });
    return out;
  }
  function refresh() {
    if (!B) { D.board = null; D.ver = -1; D.target = S ? S.ver : -1; D.idle = true; D.prompt = null; firePrompt(null); return; }
    var sp = speed(), seats = Object.keys(B.pj), i;
    D.board = B; D.ver = B.ver; D.target = S.ver; D.idle = isIdle(); D.speed = sp; D.skipping = T < skipUntil; D.log = B.log;
    D.fichas = fichas(); D.mon = {}; D.est = {}; D.dados = {}; D.golpe = {};
    for (i = 0; i < seats.length; i++) {
      var s = seats[i]; D.mon[s] = Math.round(shownMon(s)); D.est[s] = Math.round(shownEst(s));
      var d = A.dados[s];
      if (d) { var t = c01(d.ms ? (T - d.t0) / d.ms : 1);
        D.dados[s] = { v: d.v, dados: d.dados, de: d.de, t: t, rolling: t < 0.6, cara: t < 0.6 ? 1 + (Math.floor(T / 70) + i * 3) % 10 : d.v, resto: d.resto, local: false }; }
      if (s === yo && A.roll && !d) {
        if (T - A.roll.t0 > k.ROLL_MS) A.roll = null;
        else D.dados[s] = { v: null, dados: null, de: 'local', t: 0, rolling: true, cara: 1 + (Math.floor(T / 70) + i * 3) % 10, resto: null, local: true };
      }
      if (A.golpe[s] != null) { var gt = (T - A.golpe[s]) / k.GOLPE_MS; if (gt < 1) D.golpe[s] = 1 - gt; else delete A.golpe[s]; }
    }
    var ens = B.estrella ? [B.estrella.nodo, B.estrella.b] : [], ls = [];
    for (i = 0; i < ens.length; i++) { if (!ens[i]) continue;
      var en = ens[i], ex = nodoXY(en), em = A.estrella[i], et = em ? c01(em.ms ? (T - em.t0) / em.ms : 1) : 1;
      if (em && et >= 1) delete A.estrella[i];
      ls.push({ nodo: en, x: ex.x, y: ex.y, de: em && et < 1 ? em.de : null, t: et, moving: !!(em && et < 1), precio: B.estrella.precio, i: i }); }
    D.estrellas = ls; D.estrella = ls.length && ls[0].i === 0 ? ls[0] : null;
    D.paso = cur ? { k: cur.k, f: cur.f, t: c01(cur.ms ? cur.el / cur.ms : 1), ms: cur.ms, v: cur.v, local: !!cur.local } : null;
    A.toasts = A.toasts.filter(function (x) { return T - x.born < x.ms; });
    D.toasts = A.toasts.map(function (x) { return { id: x.id, k: x.k, s: x.s, txt: x.txt, born: x.born, ms: x.ms, t: c01((T - x.born) / x.ms) }; });
    if (A.resumen && T - A.resumen.t0 >= k.SKIP_MS) A.resumen = null;
    D.resumen = A.resumen ? { why: A.resumen.why, lines: A.resumen.lines, t: c01((T - A.resumen.t0) / k.SKIP_MS) } : null;
    D.espera = B.esp && S.esp && B.ver >= S.esp.id ? S.esp : null;
    D.prompt = prompt(); firePrompt(D.prompt);
  }
  function firePrompt(v) {
    var key = v ? JSON.stringify([v.esp ? v.esp.id : null, v.esp ? v.esp.k : null, v.listo, v.f, S && S.mj ? S.mj.k : null]) : '';
    if (key === promptKey) return; var habia = promptKey !== null && promptKey !== ''; promptKey = key;
    if (v || habia) hk.prompt(v || null, v ? v.esp : null);
  }

  var d = {
    K: k, D: D, push: push, update: update, skip: skip,
    local: function (ev) { ev = ev || {}; q.push({ k: ev.k || 'local', f: ev, ms: ev.ms || 0, local: true, keep: !!ev.keep, v: null, el: 0 }); },
    tap: function () { tapUntil = T + k.TAP_MS; },
    rollLocal: function () { if (yo) A.roll = { t0: T }; },
    setYo: function (s) { yo = s || null; promptKey = null; },
    reset: function () { S = null; B = null; lotes = {}; lastQV = -1; q = []; cur = null; gapAt = null; promptKey = null; hashedAt = -1;
      A = { mon: {}, est: {}, dados: {}, golpe: {}, estrella: {}, toasts: [], resumen: null, roll: null }; refresh(); },
    isIdle: isIdle, skipping: function () { return T < skipUntil; }, speed: speed,
    ver: function () { return shownV(); }, target: function () { return S ? S.ver : -1; },
    board: function () { return B; }, hash: function () { return B ? R.hash(B) : 0; }, hashS: function () { return S ? R.hash(S) : 0; },
    pos: function (s) { return D.fichas[s] || null; }, coins: function (s) { return D.mon[s]; }, stars: function (s) { return D.est[s]; },
    dice: function (s) { return D.dados[s] || null; }, star: function () { return D.estrella; }, step: function () { return D.paso; },
    toasts: function () { return D.toasts; }, prompt: function () { return D.prompt; }, espera: function () { return D.espera; },
    pending: pendientes, stats: function () { var o = {}; for (var x in st) o[x] = st[x]; o.cola = q.length; o.T = T; return o; },
    now: function () { return T; }
  };
  return d;
}

F.director = { create: create, K: K };
if (typeof module !== 'undefined') module.exports = F.director;
})(typeof window !== 'undefined' ? window : globalThis);
