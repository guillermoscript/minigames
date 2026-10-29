'use strict';
/* LA FIESTA · EN VIVO · f_tequeno · ¡TEQUEÑOS!  (modelo A: cocina propia, rank, 30 s, stick + 1 botón)
   Cumpleaños y la cocina es un caos: cada jugador tiene TRES sartenes en su hornilla y se mueve entre ellas con el stick (◄ ►).
   A sobre una sartén hace lo que toque: vacía = ECHA un tequeño; lado 1 friendo = lo VOLTEA (se juzga ese lado); lado 2 = lo SACA (se juzga y se sirve).
   Cada tequeño tiene su punto por lado (g1, g2 = segundos hasta el centro del DORADO), sembrado con c.rng en mk: la lista es la MISMA en todas las
   pantallas y cada jugador recorre la suya (el k-ésimo tequeño de todos es el mismo). Cada dueño juzga SU cocina.
   Puntos por lado (u = segundos fritos de ese lado, HW = 0,17 s de media ventana dorada):
     - PERFECTO (|u-g| <= 0,05) = 4; DORADO (|u-g| <= HW) = 3; crudo = 1 si pasaste del 80 % de g-HW, si no 0; quemado = 1 (0 si te pasaste de g+HW+0,4).
     - CARBÓN: si un lado llega a g+HW+0,9 se quema solo: 0 pts, se rompe el combo y la sartén queda sucia 1 s.
     - Tequeño GORDO (Nv3): g x1,4 y sus lados valen el doble.
   COMBO: tequeños seguidos con los dos lados dorados suman +1 el segundo, +2 el tercero y +3 desde el cuarto; un tequeño malo, un carbón o un quemón lo rompen.
   PEDIDOS de la abuela (lista sembrada): «quiero N dorados» con su paciencia; si lo completas suma 2N+2; si se acaba la paciencia se va y viene otro.
   CHISPAS de aceite (lista sembrada, igual para todos y en la misma sartén de cada cocina): la sartén avisa 0,8 s (aro rojo y burbujeo); si estás
   parado frente a ella cuando escupe, QUEMÓN: 0,9 s sin moverte ni hacer nada, y adiós combo. Los puntos nunca bajan (y el puntaje se topa en 300, el scoreMax del catálogo).
   Niveles: Nv1 día, tequeños lentos, pocas chispas, barra con la zona dorada. Nv2 atardecer, «¡MAMÁ SUBIÓ EL FUEGO!» (x1,35 desde ~45 % del
   tiempo, y más chispas), barra sin zona. Nv3 noche: chispas dobles, APAGÓN (2 ventanas de 3 s: solo se ven las burbujas) y tequeños gordos.
   Corte: los últimos 1,2 s ya no puntúan (el `o` rival llega antes del veredicto del juez).
   Cuerpo en red (o): pts, x (posición x100), p0/p1/p2 (sartenes: lado*100000 + tequeño*1000 + centésimas; 300000 = sucia), k (siguiente tequeño),
   cal (último resultado: 1 quemado, 2 crudo, 3 dorado, 4 perfecto, 5 carbón), nn (resultados), cb (combo), qm (quemones), ped (pedidos), oi, op.
   CPU (la corre el juez): va a la sartén más urgente, echa en las vacías, suelta en g ± gauss·(1-skill)·0,16 (x2 en el apagón), a veces se
   distrae, esquiva las chispas según su habilidad (con reacción >= 0,18 s) y las flojas solo usan dos sartenes.
   CURVA (ronda 3): la fritura se acelera con el tiempo (rampa), desde 1/3 hay 2 pedidos a la vez (Nv2-3), accidentes sembrados (ACC: aceite regado x1,7 / se acaba el gas:
   la sartén se congela y no se echa), la mamá MUEVE las sartenes (MV: x es el LUGAR, p0..p2 siguen por sartén) y desde el 72 % hay ENCARGOS ESPECIALES (N perfectos / N seguidos).
   Sin Math.random / Date.now: el azar sale de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético (c.fx, absT) no toca el juego. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_tequeno')) return;

var NP = 3, HW = 0.17, PERF = 0.05, CARB = 0.9, QUEM0 = 0.4, ACD = 0.16, SUCIO = 1.0, FUEGO = 1.35, CORTE = 1.2, APAG = 3.0;
var RAMPA = { 1: 0.1, 2: 0.16, 3: 0.22 }, GRASA = 1.7, ESPECIAL = 0.72;
var VX = 6, PARA = 0.3, STUN = 0.9, AVISO = 0.8, RADIO = 0.45, TOPE = 300;
var INKC = '#14101c';

/* paletas de la cocina por nivel (2D): 1 día, 2 atardecer, 3 noche */
var PAL = {
  1: { wall: '#ffe8a8', wall2: '#ffd98a', tile: '#f1c96e', mes: '#c98a5a', mes2: '#a96d40', card: '#fff6d8', txt: '#14101c' },
  2: { wall: '#ffb86b', wall2: '#ff9a5a', tile: '#e8864a', mes: '#a8693f', mes2: '#8a5230', card: '#ffe6c4', txt: '#14101c' },
  3: { wall: '#3a3478', wall2: '#2d2860', tile: '#4a4290', mes: '#5a4a68', mes2: '#463856', card: '#d9d4f0', txt: '#14101c' }
};
var CAL_TXT = { 1: '¡QUEMADO!', 2: 'CRUDO', 3: '¡DORADO!', 4: '¡PERFECTO!', 5: '¡CARBÓN!' };
var CAL_COL = { 1: '#8a3a12', 2: '#6a5a20', 3: '#c9830a', 4: '#d4137a', 5: '#3a2a2a' };
var CONF = ['#ff5c8a', '#ffd23f', '#3fa9ff', '#5cff7a', '#ff9a2e', '#b06cff'];

function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function r2(v) { return Math.round(v * 100) / 100; }
function hex(s) { return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)]; }
function mix(a, b, t) {
  var x = hex(a), y = hex(b), k = cl(t, 0, 1), o = [], i;
  for (i = 0; i < 3; i++) o.push(Math.round(x[i] + (y[i] - x[i]) * k));
  return 'rgb(' + o[0] + ',' + o[1] + ',' + o[2] + ')';
}
function mixHex(a, b, t) {
  var x = hex(a), y = hex(b), k = cl(t, 0, 1), s = '#', i, v;
  for (i = 0; i < 3; i++) { v = Math.round(x[i] + (y[i] - x[i]) * k); s += (v < 16 ? '0' : '') + v.toString(16); }
  return s;
}
function SND(f, d, ty, v) { try { if (typeof snd === 'function') snd(f, d, ty, v); } catch (e) { /* sin audio */ } }
function MIN2(a, b) { return a < b ? a : b; }
function MAX1(v) { return v < 0.05 ? 0.05 : v; }
/* el color de la masa según los segundos fritos u y el punto g del lado (hex: sirve para el 2D y para el material 3D) */
function colorMasa(u, g) {
  var lo = g - HW, hi = g + HW;
  if (u <= lo) return mixHex('#f3e3b0', '#ecc46a', u / lo);
  if (u <= g) return mixHex('#ecc46a', '#e9a13b', (u - lo) / HW);
  if (u <= hi) return mixHex('#e9a13b', '#d07a1c', (u - g) / HW);
  return mixHex('#d07a1c', '#3a190a', (u - hi) / (CARB - 0.1));
}
/* un lado: [cal, pts] */
function lado(u, g) {
  var lo = g - HW, hi = g + HW;
  if (u < lo) return [2, u / lo > 0.8 ? 1 : 0];
  if (u <= hi) return Math.abs(u - g) <= PERF ? [4, 4] : [3, 3];
  return [1, u < hi + QUEM0 ? 1 : 0];
}

FIESTA.LIVE.add('f_tequeno', {
  name: '¡TEQUEÑOS!', modos: ['ffa'], clase: 'rank', modelo: 'A', dur: 30,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 300, scoreRate: 10, minT: 27, finTemprano: 0 },
  cuerpo: ['pts', 'x', 'p0', 'p1', 'p2', 'k', 'cal', 'nn', 'cb', 'qm', 'ped', 'oi', 'op'],
  discretos: ['pts', 'p0', 'p1', 'p2', 'k', 'cal', 'nn', 'cb', 'qm', 'ped', 'oi', 'op'],
  carta: {
    obj: 'Tres sartenes a la vez: echa, voltea y saca tequeños DORADOS, cumple los pedidos y esquiva las chispas',
    gana: 'Más puntos. Cada lado dorado vale 3 (perfecto 4), los combos y los pedidos suman extra; quemado o crudo casi nada.',
    como: { tactil: 'Joystick ◄ ► para cambiar de sartén · A = echar / voltear / sacar', teclado: 'A/D o flechas para moverte · ESPACIO o J = echar / voltear / sacar' },
    demos: [{ id: 'freir', txt: 'Echa en la sartén vacía, voltea cuando el lado esté dorado y sácalo dorado del otro lado' },
      { id: 'chispa', txt: 'Si la sartén se pone roja, ¡quítate de enfrente!' }],
    roles: null
  },
  mk: function (c) {
    var n = c.n, dur = c.dur, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, pal = PAL[lv], rng = c.rng, i, k, absT = 0;
    var corte = dur - MIN2(CORTE, dur * 0.2);

    /* ───── el mundo: tequeños, fuego, apagones, gags, chispas y pedidos (idéntico en todas las pantallas; solo c.rng, solo aquí) ───── */
    var T = [];
    for (k = 0; k < 64; k++) {
      var base = lv === 1 ? 1.55 : lv === 2 ? 1.35 : 1.3, g1 = base + rng.next() * 0.7, g2 = base + rng.next() * 0.7, fat = false;
      if (lv === 3 && k > 0 && rng.next() < 0.16) { fat = true; g1 = g1 * 1.4; g2 = g2 * 1.4; }
      else if (lv === 3) rng.next();
      T.push({ g1: r2(g1), g2: r2(g2), fat: fat });
    }
    var fuegoAt = lv >= 2 ? dur * 0.4 + rng.next() * dur * 0.1 : 1e9;
    var apag = [];
    if (lv === 3) { apag.push(dur * 0.22 + rng.next() * 1.5); apag.push(dur * 0.6 + rng.next() * 1.5); } else { rng.next(); rng.next(); }
    var gags = [dur * 0.15 + rng.next() * 2, dur * 0.7 + rng.next() * 2];
    var burbs = [];                                           // posiciones de burbujas (cosmético sembrado, 2D)
    for (i = 0; i < 12; i++) burbs.push([rng.next(), rng.next(), rng.next()]);
    var S = [], st0 = 1.6, gap0 = lv === 1 ? 3.2 : lv === 2 ? 2.1 : 1.6;
    while (st0 < dur - 1) {
      var j0 = Math.floor(rng.next() * NP) % NP;
      S.push({ t: r2(st0), j: j0 });
      if (lv === 3) { var dbl = rng.next() < 0.3, j1 = (j0 + 1 + Math.floor(rng.next() * 2)) % NP; if (dbl) S.push({ t: r2(st0), j: j1 }); }
      st0 += (gap0 + rng.next() * gap0 * 0.6) * (st0 >= fuegoAt ? 0.75 : 1) * (st0 >= dur * 0.66 ? 0.8 : st0 >= dur * 0.33 ? 0.92 : 1);
    }
    var O = [];
    for (k = 0; k < 40; k++) { var on = 2 + Math.floor(rng.next() * (lv === 1 ? 2 : 3)); O.push({ n: on, tl: r2((on * (lv === 3 ? 2.7 : 3.1) + 2.5) * (1 - 0.035 * MIN2(k, 8))) }); }
    /* ───── lo nuevo (se siembra DESPUÉS de todo lo anterior: no mueve las listas de siempre) ─────
       ACC: accidentes de cocina {t, j, ty, d}: 1 = SE REGÓ EL ACEITE (esa sartén fríe x1,7), 2 = SE ACABÓ EL GAS (esa sartén se enfría: la masa se congela y no se echa).
       MV: la mamá MUEVE las sartenes (permutación de lugares {t, perm}); perm[j] = lugar donde queda la sartén j (x es el LUGAR del cocinero).
       OE: encargos ESPECIALES del final (desde el 72 % del tiempo): ty 1 = N PERFECTOS, ty 2 = N DORADOS SEGUIDOS (sin fallar). */
    var ACC = [], MV = [], OE = [], a0 = lv === 1 ? 0.52 : lv === 2 ? 0.42 : 0.34, na = lv === 1 ? 2 : lv === 2 ? 4 : 6, ag = lv === 1 ? 0.26 : lv === 2 ? 0.12 : 0.1;
    for (i = 0; i < na; i++) ACC.push({ t: r2(dur * a0 + i * dur * ag + rng.next() * 1.2), j: Math.floor(rng.next() * NP) % NP, ty: (i + (lv === 1 ? 0 : Math.floor(rng.next() * 2))) % 2 + 1, d: r2((i % 2 ? 3.4 : 4.4) + rng.next()) });
    var perm0 = [0, 1, 2], nm = lv === 1 ? 0 : lv === 2 ? 2 : 4;
    for (i = 0; i < nm; i++) {
      var s1 = Math.floor(rng.next() * NP) % NP, s2 = (s1 + 1 + Math.floor(rng.next() * 2)) % NP, tmp = perm0[s1];
      perm0 = perm0.slice(); perm0[s1] = perm0[s2]; perm0[s2] = tmp;
      MV.push({ t: r2(dur * (lv === 2 ? 0.5 : 0.3) + i * dur * (lv === 2 ? 0.27 : 0.19) + rng.next() * 1.5), perm: perm0 });
    }
    for (k = 0; k < 12; k++) { var oe = 2 + Math.floor(rng.next() * 2), oty = 1 + Math.floor(rng.next() * 2); OE.push({ n: oty === 1 ? oe : oe + 1, ty: oty, tl: r2((oty === 1 ? oe * 3.8 : (oe + 1) * 3.0) + 3.5) }); }

    function fase(gt) { return gt < dur * 0.33 ? 0 : gt < dur * 0.66 ? 1 : 2; }
    function accEn(j, gt) { var a; for (a = 0; a < ACC.length; a++) if (ACC[a].j === j && gt >= ACC[a].t && gt < ACC[a].t + ACC[a].d) return ACC[a].ty; return 0; }
    function permAt(gt) { var a, pm = [0, 1, 2]; for (a = 0; a < MV.length; a++) if (gt >= MV[a].t) pm = MV[a].perm; return pm; }
    function slotOf(j, gt) { return permAt(gt)[j]; }
    function panEn(sl, gt) { var pm = permAt(gt), j; for (j = 0; j < NP; j++) if (pm[j] === sl) return j; return sl; }
    function avisoMov(gt) { var a; for (a = 0; a < MV.length; a++) if (gt >= MV[a].t - 1.3 && gt < MV[a].t) return 1 - (MV[a].t - gt) / 1.3; return 0; }
    function ramp(gt) { return 1 + RAMPA[lv] * cl(gt / dur, 0, 1); }
    function speed(gt, j) {
      var e = j === undefined ? 0 : accEn(j, gt);
      return e === 2 ? 0 : (gt >= fuegoAt ? FUEGO : 1) * ramp(gt) * (e === 1 ? GRASA : 1);
    }
    function oscuro(gt) { var j; for (j = 0; j < apag.length; j++) if (gt >= apag[j] && gt < apag[j] + APAG) return true; return false; }
    function gLado(pa) { var t = T[pa.tq % T.length]; return pa.s === 2 ? t.g2 : t.g1; }
    function pedido(q) { return O[q.oi % O.length]; }
    /* los pedidos de la abuela: hasta 2 a la vez (Nv2-3 desde el segundo tercio). sl = {o: n.º de pedido, n, ty, tl, op, t0, esp}. */
    function nuevoPed(q, sl, gt) {
      var esp = gt >= dur * ESPECIAL && lv >= 1 && dur >= 12, o = esp ? OE[(q.nesp++) % OE.length] : O[(q.nxt++) % O.length], f = fase(gt);
      sl.n = o.n; sl.ty = esp ? o.ty : 0; sl.esp = esp; sl.tl = r2(o.tl * (esp ? 1 : 1 - 0.07 * f)); sl.op = 0; sl.t0 = gt + 0.6;
    }
    function nslots(gt) { return lv >= 2 && fase(gt) >= 1 ? 2 : 1; }
    function gastaPed(q, sl, gt, bono) {                       // el pedido se completó (bono > 0) o se fue (bono = 0)
      if (bono > 0) { q.ped++; q.pbn = bono; }
      q.oi++; nuevoPed(q, sl, gt);
    }

    /* ───── estado por jugador ───── */
    var P = [], cpuR = [];
    function sarten() { return { s: 0, u: 0, tq: 0, l1: 0, c1: 0, cd: 0 }; }
    function slotP() { return { n: 2, ty: 0, tl: 9, op: 0, t0: 0, esp: false }; }
    for (i = 0; i < n; i++) {
      P.push({ x: 1, dir: 0, k: 0, pan: [sarten(), sarten(), sarten()], code: [0, 0, 0], pts: 0, cal: 0, nn: 0, cb: 0, hits: 0, stun: 0, acd: 0,
        hOld: true, own: false, popT: -9, popCal: 0, popD: 0, si: 0, oi: 0, ped: 0, sv: 0, opR: 0, gasT: -9, nxt: 1, nesp: 0, pbn: 0, sl: [slotP(), slotP()], sl1: false,
        ai: { key: [-1, -1, -1], tg: [0, 0, 0], vis: {}, pT: -9, wj: -1, w: 0, tj: -1 } });
      cpuR.push(c.rngFor('cpu' + i));
      P[i].sl[0].n = O[0].n; P[i].sl[0].tl = O[0].tl;
    }
    function mio(p) { return c.mio(p); }
    function asiento(p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; }
    /* vista real: c.campo() en el navegador devuelve 0..800 (gameLeft es un const de script, no cuelga de window): si el motor está, se lee directo. */
    function vista() {
      var f = c.campo(), x0 = f.x0, x1 = f.x1;
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') { x0 = gameLeft(); x1 = gameRight(); }
      return { x0: x0, x1: x1, y0: f.y0, y1: f.y1 };
    }
    function strip() {
      var f = vista(), w = Math.min(f.x1 - f.x0, 800), m = (f.x0 + f.x1) / 2;
      return { x0: m - w / 2, x1: m + w / 2, y0: f.y0, y1: f.y1 };
    }
    function opT(q) { return q.own ? q.sl[0].op + (q.sl1 ? q.sl[1].op : 0) : q.opR; }
    function resultado(q, cal, pts, gt) { q.pts += pts; q.cal = cal; q.nn++; q.popT = gt; q.popCal = cal; q.popD = pts; }

    /* A sobre la sartén j: echar / voltear / sacar */
    function accion(q, j, gt) {
      var pa = q.pan[j], t, r;
      if (pa.s === 3) return;
      if (pa.s === 0 && accEn(j, gt) === 2) { q.gasT = gt; return; }          // sin gas no se echa
      if (pa.s === 0) { pa.s = 1; pa.u = 0; pa.tq = q.k++; pa.l1 = 0; pa.c1 = 0; return; }
      t = T[pa.tq % T.length]; r = lado(pa.u, gLado(pa));
      if (pa.s === 1) { pa.l1 = r[1]; pa.c1 = r[0]; pa.s = 2; pa.u = 0; return; }
      var bueno = pa.c1 >= 3 && r[0] >= 3, pts = (pa.l1 + r[1]) * (t.fat ? 2 : 1), cal = bueno ? (pa.c1 === 4 && r[0] === 4 ? 4 : 3) : MIN2(pa.c1, r[0]);
      var perf = bueno && pa.c1 === 4 && r[0] === 4, sl, a, el = null;
      if (bueno) {
        q.cb++; q.sv++; pts += MIN2(q.cb - 1, 3);
        for (a = 0; a < nslots(gt); a++) {                      // lo recibe el pedido más urgente que acepte este tequeño
          sl = q.sl[a];
          if (gt < sl.t0 || (sl.ty === 1 && !perf)) continue;
          if (!el || sl.tl - (gt - sl.t0) < el.tl - (gt - el.t0)) el = sl;
        }
        if (el) {
          el.op++;
          if (el.op >= el.n) { var bono = el.ty === 1 ? 3 * el.n + 4 : el.ty === 2 ? 3 * el.n + 3 : 2 * el.n + 2; pts += bono; gastaPed(q, el, gt, bono); }
        }
      } else {
        q.cb = 0;
        for (a = 0; a < 2; a++) if (q.sl[a].ty === 2) q.sl[a].op = 0;      // «seguidos»: un tequeño malo los rompe
      }
      pa.s = 0; pa.u = 0;
      resultado(q, cal, pts, gt);
    }
    function codigo(pa) { if (pa.s === 0) return 0; if (pa.s === 3) return 300000; return pa.s * 100000 + (pa.tq % 64) * 1000 + MIN2(999, Math.round(pa.u * 100)); }
    function decodifica(pa, code) {
      if (!code) { pa.s = 0; pa.u = 0; return; }
      if (code >= 300000) { pa.s = 3; pa.u = 0; pa.cd = SUCIO; return; }
      pa.s = Math.floor(code / 100000); pa.tq = Math.floor(code / 1000) % 100; pa.u = (code % 1000) / 100;
    }
    function aplicaRemoto(q, r, gt) {
      var antes = q.pts, j;
      if ((r.pts || 0) > q.pts) q.pts = r.pts;
      q.x = cl((r.x || 0) / 100, 0, NP - 1);
      if ((r.k || 0) > q.k) q.k = r.k || 0;
      for (j = 0; j < NP; j++) { var cd = r['p' + j] || 0; if (cd !== q.code[j]) { q.code[j] = cd; decodifica(q.pan[j], cd); } }
      if ((r.nn || 0) > q.nn) { q.nn = r.nn; q.cal = r.cal || 0; q.popT = gt; q.popCal = q.cal; q.popD = q.pts - antes; }
      q.cb = r.cb || 0;
      if ((r.qm || 0) > q.hits) { q.hits = r.qm; q.stun = STUN; }
      if ((r.ped || 0) > q.ped) q.ped = r.ped;
      if ((r.oi || 0) > q.oi) q.oi = r.oi;
      q.opR = r.op || 0;
    }

    function updJugador(p, dt, gt) {
      var q = P[p], r, j, pa;
      if (!mio(p)) {                                           // remoto: lo que manda su dueño (o el juez si es CPU)
        q.own = false; r = c.remoto(p);
        if (r) aplicaRemoto(q, r, gt);
        if (gt >= 0 && gt < corte) for (j = 0; j < NP; j++) { pa = q.pan[j]; if (pa.s === 1 || pa.s === 2) pa.u += dt * speed(gt, j); }   // la fritura sigue entre cuerpo y cuerpo (solo dibujo)
        q.stun = Math.max(0, q.stun - dt);
        while (q.si < S.length && S[q.si].t <= gt) q.si++;
        return;
      }
      if (!q.own) {                                            // empiezo o heredo (juez que toma una CPU): las chispas viejas no cuentan
        q.own = true; q.hOld = true;
        while (q.si < S.length && S[q.si].t <= gt) q.si++;
      }
      var h = c.held(p, 'a'), tp = c.tap(p, 'a') > 0, e = c.eje(p), ex = e && e.x ? e.x : 0;
      if (gt < 0) { q.hOld = h; return; }
      if (gt >= corte) { q.hOld = h; return; }                 // fin: ya no puntúa ni se mueve nada
      q.stun = Math.max(0, q.stun - dt); q.acd = Math.max(0, q.acd - dt);
      /* moverse entre sartenes: con el stick avanza; al soltarlo se acomoda en la sartén hacia donde iba */
      if (q.stun > 0) ex = 0;
      if (Math.abs(ex) > 0.35) { q.dir = ex > 0 ? 1 : -1; q.x += q.dir * VX * dt * MIN2(1, Math.abs(ex) * 1.3); }
      else {
        var tj = q.dir > 0 ? Math.ceil(q.x - 0.05) : q.dir < 0 ? Math.floor(q.x + 0.05) : Math.round(q.x), d = tj - q.x;
        q.x += Math.abs(d) <= VX * dt ? d : (d > 0 ? 1 : -1) * VX * dt;
        if (Math.abs(tj - q.x) < 1e-6) q.dir = 0;
      }
      q.x = cl(q.x, 0, NP - 1);
      /* fritura */
      for (j = 0; j < NP; j++) {
        pa = q.pan[j];
        if (pa.s === 3) { pa.cd -= dt; if (pa.cd <= 0) { pa.cd = 0; pa.s = 0; } continue; }
        if (pa.s !== 1 && pa.s !== 2) continue;
        pa.u += dt * speed(gt, j);
        if (pa.u > gLado(pa) + HW + CARB) { pa.s = 3; pa.cd = SUCIO; pa.u = 0; q.cb = 0; resultado(q, 5, 0, gt); }
      }
      /* chispas: si escupe la sartén que tienes enfrente, quemón */
      while (q.si < S.length && S[q.si].t <= gt) {
        var sp = S[q.si++];
        if (gt - sp.t < 0.25 && Math.abs(q.x - slotOf(sp.j, gt)) < RADIO && q.stun <= 0) { q.stun = STUN; q.cb = 0; q.hits++; }
      }
      /* pedidos que se van (y el segundo pedido que llega al llenarse la casa) */
      if (nslots(gt) >= 2 && !q.sl1) { q.sl1 = true; nuevoPed(q, q.sl[1], gt); }
      for (j = 0; j < 2; j++) {
        if (j === 1 && !q.sl1) continue;
        var sl = q.sl[j];
        if (gt >= sl.t0 && gt - sl.t0 > sl.tl) { q.oi++; nuevoPed(q, sl, gt); }
      }
      /* A */
      if ((tp || (h && !q.hOld)) && q.stun <= 0 && q.acd <= 0) {
        j = Math.round(q.x);
        if (Math.abs(q.x - j) < PARA) { accion(q, panEn(j, gt), gt); q.acd = ACD; }
      }
      q.hOld = h;
    }

    /* ───── lo cosmético: compara el estado cuadro a cuadro y deja en `cola` lo que pasó (sonidos y efectos; no toca la simulación) ───── */
    var cola = [], prev = [], wsi = 0, fuegoVisto = false, apagVisto = -1, accV = [], mvAv = [], faseV = 0, f1;
    for (i = 0; i < n; i++) prev.push({ s: [0, 0, 0], nn: 0, hits: 0, ped: 0, oi: 0, cb: 0 });
    function evC(ty, p, j, a) { if (cola.length < 80) cola.push({ ty: ty, p: p, j: j, a: a }); }
    function detectar(gt) {
      var p, j;
      for (p = 0; p < n; p++) {
        var q = P[p], pv = prev[p];
        for (j = 0; j < NP; j++) {
          var s0 = pv.s[j], s1 = q.pan[j].s;
          if (s0 !== s1) {
            if (s0 === 0 && s1 === 1) evC('echa', p, j);
            else if (s0 === 1 && s1 === 2) evC('voltea', p, j, q.pan[j].c1);
            else if (s1 === 3) evC('carbon', p, j);
            else if (s0 === 2 && s1 === 0) evC('saca', p, j, q.cal);
            pv.s[j] = s1;
          }
        }
        if (q.hits > pv.hits) { evC('quemon', p, Math.round(q.x)); pv.hits = q.hits; }
        if (q.ped > pv.ped) { evC('pedido', p, 0, q.pbn); pv.ped = q.ped; pv.oi = q.oi; }
        else if (q.oi > pv.oi) { evC('sefue', p, 0); pv.oi = q.oi; }
        if (q.cb >= 3 && q.cb > pv.cb) evC('combo', p, 0, q.cb);
        pv.cb = q.cb; pv.nn = q.nn;
      }
      while (wsi < S.length && S[wsi].t <= gt) { if (gt - S[wsi].t < 0.3) evC('chispa', -1, S[wsi].j); wsi++; }
      if (!fuegoVisto && gt >= fuegoAt) { fuegoVisto = true; evC('fuego', -1, 0); }
      for (j = 0; j < ACC.length; j++) {
        if (!accV[j] && gt >= ACC[j].t) { accV[j] = 1; if (gt - ACC[j].t < 0.5) evC(ACC[j].ty === 1 ? 'grasa' : 'gas', -1, ACC[j].j, j); }
        if (accV[j] === 1 && gt >= ACC[j].t + ACC[j].d) { accV[j] = 2; if (ACC[j].ty === 2 && gt - ACC[j].t - ACC[j].d < 0.5) evC('gasfin', -1, ACC[j].j, j); }
      }
      for (j = 0; j < MV.length; j++) {
        if (!mvAv[j] && gt >= MV[j].t - 1.3) { mvAv[j] = 1; if (MV[j].t - gt > 0) evC('muevea', -1, 0, j); }
        if (mvAv[j] < 2 && gt >= MV[j].t) { mvAv[j] = 2; if (gt - MV[j].t < 0.5) evC('mueve', -1, 0, j); }
      }
      f1 = fase(gt); if (f1 > faseV) { faseV = f1; if (f1 > 0 && gt < corte) evC('fase', -1, 0, f1); }
      for (j = 0; j < apag.length; j++) if (apagVisto < j && gt >= apag[j]) { apagVisto = j; evC('apagon', -1, j); }
      if (cola.length > 60) cola.splice(0, cola.length - 60);
    }
    function avisoChispa(j, gt) {                              // ¿la sartén j va a escupir pronto? 0..1 (1 = ya)
      var a, best = 0;
      for (a = wsi; a < S.length && S[a].t - gt < AVISO; a++) if (S[a].j === j && S[a].t >= gt) best = Math.max(best, 1 - (S[a].t - gt) / AVISO);
      return best;
    }

    /* ───── dibujo 2D (respaldo sin WebGL o con ?plano=1) ───── */
    function celda(p) {
      var cp = strip(), W = cp.x1 - cp.x0 - 12, H = cp.y1 - (cp.y0 + 70) - 4;
      var cols = W >= 560 ? n : MIN2(2, n), rows = Math.ceil(n / cols), cw = W / cols - 8, ch = H / rows - 8;
      var rw = Math.floor(p / cols), cc = p % cols, enFila = rw === rows - 1 ? n - rw * cols : cols;
      var x = cp.x0 + 6 + (W - enFila * (cw + 8)) / 2 + cc * (cw + 8) + 4, y = cp.y0 + 70 + rw * (ch + 8) + 4;
      return { x: x, y: y, w: cw, h: ch, s: MIN2(MIN2(cw / 190, ch / 230), 1.15) };
    }
    function tequeno(x, y, rot, s, u, gg, fat) {               // el tequeño: rr redondeada de masa + rayitas y asoma el queso si está listo
      var w = (fat ? 74 : 56) * s, h = (fat ? 26 : 19) * s, col = colorMasa(u, gg);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      rr(-w / 2, -h / 2, w, h, h / 2, col, 2.5);
      line([[-w * 0.2, -h * 0.28], [-w * 0.05, h * 0.28]], 2, 'rgba(90,45,10,.45)');
      line([[w * 0.12, -h * 0.28], [w * 0.27, h * 0.28]], 2, 'rgba(90,45,10,.45)');
      if (u >= gg - HW && u <= gg + HW) ell(w / 2 - 2 * s, 0, 3 * s, 4 * s, '#fff3a8', 0);
      ctx.restore();
    }
    function fondo(cp) {
      var x0 = cp.x0, x1 = cp.x1, k2, w = x1 - x0;
      rr(x0, 0, w, 330, 0, pal.wall, 0); rr(x0, 330, w, 300, 0, pal.wall2, 0);
      for (k2 = x0 - 20; k2 < x1; k2 += 54) line([[k2, 0], [k2 + 24, 620]], 2, pal.tile);
      for (k2 = 40; k2 < 620; k2 += 54) line([[x0, k2], [x1, k2]], 2, pal.tile);
      if (lv === 3) { ell(x1 - 46, 36, 22, 22, 'rgba(255,226,122,.25)', 0); ell(x1 - 46, 36, 9, 9, '#ffe27a', 2); }
    }
    function avisoTexto(gt) {
      var j;
      if (gt >= corte) return ['¡TIEMPO!', '#14101c', '#ffe27a'];
      for (j = 0; j < apag.length; j++) if (gt >= apag[j] && gt < apag[j] + 1.6) return ['¡SE FUE LA LUZ!', '#14101c', '#ffe27a'];
      if (gt >= fuegoAt && gt < fuegoAt + 2.4) return ['¡MAMÁ SUBIÓ EL FUEGO!', '#ffd23f', '#c4283a'];
      for (j = 0; j < MV.length; j++) {
        if (gt >= MV[j].t - 1.3 && gt < MV[j].t) return ['¡MAMÁ VA A MOVER LAS SARTENES!', '#14101c', '#ffe27a'];
        if (gt >= MV[j].t && gt < MV[j].t + 1.6) return ['¡SE MOVIERON LAS SARTENES!', '#fffdf2', '#2a6ad4'];
      }
      for (j = 0; j < ACC.length; j++) if (gt >= ACC[j].t && gt < ACC[j].t + 1.8) return ACC[j].ty === 1 ? ['¡SE REGÓ EL ACEITE!', '#fffdf2', '#c4551a'] : ['¡SE ACABÓ EL GAS!', '#fffdf2', '#2a6ad4'];
      if (lv >= 2 && gt >= dur * 0.33 && gt < dur * 0.33 + 2) return ['¡SE LLENÓ LA CASA! 2 PEDIDOS', '#ffd23f', '#d4137a'];
      if (gt >= dur * 0.66 && gt < dur * 0.66 + 2) return ['¡HORA PICO!', '#ffd23f', '#c4283a'];
      if (gt >= dur * ESPECIAL && gt < dur * ESPECIAL + 2.2 && dur >= 12) return ['¡ENCARGO ESPECIAL DE LA TÍA!', '#14101c', '#ffe27a'];
      for (j = 0; j < gags.length; j++) if (gt >= gags[j] && gt < gags[j] + 2.4) return ['¿QUIÉN SE COMIÓ EL DE BODEGÓN?', '#fffdf2', '#6a3a9a'];
      if (gt >= 0 && gt < 2.2 && !c.practica) return ['◄ ► SARTÉN · A = ECHA / VOLTEA / SACA', '#fffdf2', '#14101c'];
      return null;
    }
    function banner(cp, gt, y) {
      var a = avisoTexto(gt), mid = (cp.x0 + cp.x1) / 2;
      if (!a) return;
      var bw = Math.min(cp.x1 - cp.x0 - 24, 380);
      rr(mid - bw / 2, y, bw, 30, 12, a[1], 3.5);
      txt(a[0], mid, y + 15, bw < 340 ? 12 : 16, a[2], 0, true);
    }
    var TIPO_TXT = ['DORADOS', 'PERFECTOS', 'SEGUIDOS'];
    function ticket(cx, y, gt, s) {                             // tus pedidos de la abuela (1 o 2): cuántos van y la paciencia; el especial va en dorado
      if (c.yo < 0 || gt < 0 || gt >= corte) return;
      var q = P[c.yo], ns = nslots(gt), a, w = 190 * s, h = 30 * s, j;
      for (a = 0; a < ns; a++) {
        var sl = q.sl[a], yy = y + a * (h + 4 * s);
        rr(cx - w / 2, yy, w, h, 8, sl.esp ? '#ffe27a' : '#fffdf2', 2.5);
        if (gt < sl.t0) { txt(sl.esp ? '¡ENCARGO ESPECIAL!' : '¡OTRO PEDIDO!', cx, yy + h / 2, 12 * s, '#d4137a', 0, true); continue; }
        txt(sl.esp ? TIPO_TXT[sl.ty].substr(0, 4) : 'PEDIDO', cx - w / 2 + 34 * s, yy + h / 2, 10 * s, INKC, 0, true);
        var bw0 = MIN2(22 * s, 76 * s / sl.n);
        for (j = 0; j < sl.n; j++) { var bx = cx - 28 * s + j * bw0; rr(bx - 7 * s, yy + h / 2 - 5 * s, bw0 * 0.72, 10 * s, 5 * s, j < sl.op ? (sl.ty === 1 ? '#d4137a' : '#e9a13b') : '#e8e0c8', 1.5); }
        var resta = Math.max(0, sl.tl - (gt - sl.t0)), fr = cl(resta / sl.tl, 0, 1);
        rr(cx + w / 2 - 44 * s, yy + h / 2 - 5 * s, 38 * s, 10 * s, 4, '#e8e0c8', 1.5);
        if (fr > 0.02) rr(cx + w / 2 - 44 * s, yy + h / 2 - 5 * s, 38 * s * fr, 10 * s, 4, fr < 0.3 ? '#ff3b4e' : '#5cc95c', 0);
      }
    }
    function estacion2D(p, gt, dark) {
      var q = P[p], ce = celda(p), s = ce.s, x = ce.x, y = ce.y, w = ce.w, h = ce.h, st = asiento(p), yo = p === c.yo, j;
      var bh = 230 * s, oy = y + (h - bh) / 2, cx = x + w / 2;
      if (yo) rr(x - 5, y - 5, w + 10, h + 10, 18, '#d4137a', 3);      // el marco rosa es el tuyo
      rr(x, y, w, h, 14, pal.card, 3);
      c.util.pj(st.ch, x + 26 * s, oy + 26 * s, 46 * s, { animo: q.cal >= 3 && gt - q.popT < 1 ? 'celebrar' : (q.cal === 1 || q.cal === 5 || q.stun > 0) && gt - q.popT < 1 ? 'perder' : null, sombra: false });
      txt(yo ? 'TÚ' : String(st.name || '').substr(0, 8), cx, oy + 15 * s, 13 * s < 11 ? 11 : 13 * s, yo ? '#d4137a' : pal.txt, 0, true);
      txt(String(q.pts), x + w - 34 * s, oy + 36 * s, 28 * s, pal.txt, 0, true);
      if (q.cb >= 2) txt('COMBO x' + q.cb, cx, oy + 36 * s, 12 * s < 10 ? 10 : 12 * s, '#d4137a', 0, true);
      var py = oy + 130 * s, sw = w / 3, pw = Math.min(30 * s, sw * 0.4), ph = 12 * s;
      for (j = 0; j < NP; j++) {
        var px = x + sw * (slotOf(j, gt) + 0.5), pa = q.pan[j], av = avisoChispa(j, gt), ac = gt >= 0 ? accEn(j, gt) : 0, k2;
        for (k2 = -1; k2 <= 1; k2++) {
          var fh = (ac === 2 ? 3 : 8 + 4 * Math.sin(absT * 11 + k2 * 2 + p + j)) * s * (gt >= fuegoAt && ac !== 2 ? 1.6 : 1);
          poly([[px + k2 * 9 * s - 5 * s, py + 22 * s], [px + k2 * 9 * s, py + 22 * s + fh], [px + k2 * 9 * s + 5 * s, py + 22 * s]], ac === 2 ? '#5a8ae8' : gt >= fuegoAt ? '#ff3b4e' : '#ff9a2e', 1.5);
        }
        ell(px, py + 6 * s, pw, ph + 4 * s, av > 0 ? (Math.floor(absT * 12) % 2 ? '#ff3b4e' : '#2a2638') : '#2a2638', 3);
        ell(px, py + 4 * s, pw * 0.86, ph, pa.s === 3 ? '#5a4030' : ac === 1 ? '#ff7a2a' : ac === 2 ? '#8aa0c8' : pa.s ? '#e8b020' : '#d9a22a', 2);
        if (pa.s === 1 || pa.s === 2) {
          var gg = gLado(pa), t = T[pa.tq % T.length];
          tequeno(px, py + 2 * s, (pa.s === 2 ? 0.2 : -0.2) + Math.sin(absT * 16 + j) * 0.05, s * (t.fat ? 0.8 : 0.95), dark ? 0 : pa.u, gg, t.fat);
          if (dark) rr(px - pw, py - 10 * s, pw * 2, 24 * s, 8, 'rgba(8,6,28,.86)', 0);
          if (pa.u > gg + HW && !dark) ell(px, py - 18 * s, 8 * s, 6 * s, 'rgba(70,60,70,.5)', 0);
          if (yo && lv <= 2 && !dark) {
            var bw = sw * 0.8, bx = px - bw / 2, by = py - 34 * s, top = gg + HW + 0.5;
            rr(bx, by, bw, 8 * s, 4, '#fffdf2', 2);
            if (lv === 1) rr(bx + bw * (gg - HW) / top, by, bw * 2 * HW / top, 8 * s, 3, '#ffd23f', 0);
            var f = cl(pa.u / top, 0, 1); if (f > 0.01) rr(bx, by, bw * f, 8 * s, 4, colorMasa(pa.u, gg), 1.5);
            txt(pa.s === 1 ? '1' : '2', bx - 7 * s, by + 4 * s, 9 * s, INKC, 0, true);
          }
        }
        if (av > 0) txt('¡!', px, py - 48 * s, 18 * s, '#ff3b4e', 0, true);
      }
      /* el cocinero: un marcador bajo la sartén donde está parado */
      var mx = x + sw * (q.x + 0.5), my = py + 50 * s;
      poly([[mx - 9 * s, my + 12 * s], [mx, my], [mx + 9 * s, my + 12 * s]], q.stun > 0 ? '#ff3b4e' : asiento(p).color || '#ffd23f', 2);
      if (q.stun > 0) txt('¡AY!', mx, my + 24 * s, 13 * s, '#ff3b4e', 0, true);
      if (yo) ticket(cx, oy + 200 * s, gt, s * 0.9);
      var ed = gt - q.popT;
      if (ed >= 0 && ed < 1.1 && q.popCal) txt((q.popD > 0 ? '+' + q.popD + ' ' : '') + CAL_TXT[q.popCal], cx, oy + 70 * s - ed * 20 * s, 14 * s < 11 ? 11 : 14 * s, CAL_COL[q.popCal], 0, true);
    }
    function dibujar2D() {
      var cp = strip(), gt = c.ahora(), p, dark = oscuro(gt);
      while (cola.length) {                                   // los sonidos de siempre, solo los tuyos
        var e = cola.shift();
        if (e.p !== c.yo) continue;
        if (e.ty === 'echa') SND(520, 0.05, 'triangle', 0.04);
        else if (e.ty === 'voltea') SND(e.a >= 3 ? 880 : 420, 0.07, 'square', 0.04);
        else if (e.ty === 'saca') { if (e.a >= 3) SND(e.a === 4 ? 980 : 760, 0.12, 'square', 0.06); else SND(200, 0.2, 'sawtooth', 0.05); }
        else if (e.ty === 'carbon' || e.ty === 'quemon') SND(150, 0.3, 'sawtooth', 0.06);
        else if (e.ty === 'pedido') SND(1180, 0.18, 'square', 0.06);
      }
      fondo(vista());
      banner(cp, gt, cp.y0 + 6);
      for (p = 0; p < n; p++) estacion2D(p, gt, dark);
    }

    /* ───── 3D low poly (fiesta-3d.js): la cocina del cumpleaños. Solo dibujo: lee P, la lista de chispas y la `cola`; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var DXS = 5.2, DXP = 1.45, ZP = 0.35, ZJ = -1.0, ALTO = 1.12;
    function SX(p) { return (p - (n - 1) / 2) * DXS; }
    function PX(p, j) { return SX(p) + (j - 1) * DXP; }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#fff1d0', pared: '#ffe2a0', azul: '#7fc8e8', piso: '#f4ead8', piso2: '#d84a4a', mes: '#c98a5a', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', pared: '#ffc58a', azul: '#5fb0c8', piso: '#f0dcc0', piso2: '#c43a3a', mes: '#a8693f', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', pared: '#6a5a9a', azul: '#4a6aa8', piso: '#9a90b0', piso2: '#6a3a5a', mes: '#6a4a58', noche: 1 }
    };
    function montar3D() {
      var TH = THREE, pl = PAL3[lv], j, a;
      V3.pista('tequeno', { bpm: 152, acordes: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]],   // merengue de cumpleaños: I–IV–V–I en Do
        mel: [72, 0, 74, 76, 0, 74, 72, 0, 79, 0, 77, 76, 0, 74, 72, 0, 74, 0, 76, 77, 0, 79, 81, 0, 79, 77, 76, 74, 72, 0, 0, 0] });
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 90, 220], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-24, 14, 12);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, ancho = n * DXS + 3;
      /* piso de granito a cuadros (rojo y crema, de cocina venezolana) */
      var baldosa = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = pl.piso; x.fillRect(0, 0, w, h); x.fillStyle = pl.piso2; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2);
        x.fillStyle = 'rgba(0,0,0,.08)'; for (var i2 = 0; i2 < 40; i2++) x.fillRect((i2 * 37) % w, (i2 * 61) % h, 2, 2);
      }, [30, 12]);
      var piso = new TH.Mesh(new TH.PlaneGeometry(80, 30), new TH.MeshToonMaterial({ map: baldosa, gradientMap: V3.toon('#fff').gradientMap }));
      piso.rotation.x = -Math.PI / 2; piso.position.z = 4; piso.receiveShadow = true; S3.add(piso);
      /* la pared del fondo: azulejos abajo, pintura arriba */
      var pared = M(new TH.BoxGeometry(80, 10, .3), pl.pared, { borde: false, recibe: true }); pared.position.set(0, 5, -3.6); S3.add(pared);
      var azu = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = '#f8f4ea'; x.fillRect(0, 0, w, h); x.fillStyle = pl.azul;
        for (var i2 = 0; i2 < 4; i2++) for (var j2 = 0; j2 < 4; j2++) { x.fillRect(i2 * 32 + 3, j2 * 32 + 3, 26, 26); x.fillStyle = (i2 + j2) % 2 ? pl.azul : '#fdfaf2'; }
      }, [40, 2]);
      var azulejos = new TH.Mesh(new TH.PlaneGeometry(80, 3.4), new TH.MeshToonMaterial({ map: azu, gradientMap: V3.toon('#fff').gradientMap })); azulejos.position.set(0, 1.7, -3.44); azulejos.receiveShadow = true; S3.add(azulejos);
      /* la ventana con el cielo (las nubes o las estrellas pasan solas) */
      var cieloV = V3.texturaCanvas(256, 128, function (x, w, h) {
        var gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pl.cielo[0]); gr.addColorStop(1, pl.cielo[1]); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        if (pl.noche) { x.fillStyle = '#fff6c0'; for (var i2 = 0; i2 < 40; i2++) x.fillRect((i2 * 53) % w, (i2 * 29) % (h - 30), 2, 2); x.beginPath(); x.arc(200, 30, 14, 0, 6.3); x.fill(); }
        else { x.fillStyle = 'rgba(255,255,255,.9)'; for (var c2 = 0; c2 < 4; c2++) { x.beginPath(); x.arc(30 + c2 * 64, 40 + (c2 % 2) * 22, 16, 0, 6.3); x.arc(48 + c2 * 64, 36 + (c2 % 2) * 22, 20, 0, 6.3); x.arc(68 + c2 * 64, 42 + (c2 % 2) * 22, 14, 0, 6.3); x.fill(); } }
        x.fillStyle = pl.noche ? '#1a1a3a' : '#5a9a4a'; x.beginPath(); x.moveTo(0, h); for (var m2 = 0; m2 <= 8; m2++) x.lineTo(m2 * w / 8, h - 22 - (m2 % 3) * 10); x.lineTo(w, h); x.fill();   // el Ávila de fondo
      }, [1, 1]);
      cieloV.wrapS = TH.RepeatWrapping;
      var vent = new TH.Mesh(new TH.PlaneGeometry(4.4, 2.3), new TH.MeshBasicMaterial({ map: cieloV })); vent.position.set(0, 4.3, -3.43); S3.add(vent);
      var marco = [[0, 5.5, 4.8, .22], [0, 3.1, 4.8, .26], [-2.3, 4.3, .22, 2.6], [2.3, 4.3, .22, 2.6], [0, 4.3, .12, 2.4]];
      marco.forEach(function (r) { var mm = M(new TH.BoxGeometry(r[2], r[3], .2), '#fffdf2', { g: .03 }); mm.position.set(r[0], r[1], -3.36); S3.add(mm); });
      /* repisas con frascos, harina y plantas */
      function repisa(x) {
        var tb = M(new TH.BoxGeometry(3.4, .14, .6), '#a86a3a', { recibe: true }); tb.position.set(x, 4.2, -3.2); S3.add(tb);
        for (var i2 = 0; i2 < 4; i2++) {
          var col = ['#ffd23f', '#e8553d', '#7fd6c9', '#fffdf2'][i2], ob;
          if (i2 % 2) { ob = M(new TH.CylinderGeometry(.22, .22, .55, 8), col, { g: .05 }); ob.position.set(x - 1.2 + i2 * .8, 4.55, -3.15); }
          else { ob = M(new TH.BoxGeometry(.5, .75, .3), col, { g: .04 }); ob.position.set(x - 1.2 + i2 * .8, 4.65, -3.15); }   // paquetes de harina
          S3.add(ob);
        }
        var mat = M(new TH.CylinderGeometry(.22, .16, .35, 7), '#c4563a'); mat.position.set(x + 1.5, 4.45, -3.15); S3.add(mat);
        var hoja = M(new TH.IcosahedronGeometry(.32, 0), '#3fae4a', { g: .05 }); hoja.position.set(x + 1.5, 4.8, -3.15); S3.add(hoja);
      }
      repisa(-ancho / 2 + 2.2); repisa(ancho / 2 - 2.2);
      /* el letrero del cumpleaños, banderines y globos */
      var letrero = V3.texturaCanvas(512, 96, function (x, w, h) {
        x.fillStyle = '#ff5c8a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.fillRect(0, h - 10, w, 10);
        x.font = 'bold 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fffdf2'; x.fillText('¡FELIZ CUMPLE!', w / 2, h / 2);
      });
      var cartel = new TH.Mesh(new TH.PlaneGeometry(5.6, 1.05), new TH.MeshBasicMaterial({ map: letrero, transparent: true })); cartel.position.set(0, 6.35, -3.42); S3.add(cartel);
      var banderas = [], bombillos = [];
      function guirnalda(a0, a1, n2, caida) {
        var pts = [], i2;
        for (i2 = 0; i2 <= 24; i2++) { var u = i2 / 24; pts.push(new TH.Vector3(a0.x + (a1.x - a0.x) * u, a0.y + (a1.y - a0.y) * u - Math.sin(u * Math.PI) * caida, a0.z + (a1.z - a0.z) * u)); }
        var cur = new TH.CatmullRomCurve3(pts); S3.add(new TH.Mesh(new TH.TubeGeometry(cur, 30, .03, 4), tn('#14101c')));
        var tri = new TH.BufferGeometry(); tri.setAttribute('position', new TH.Float32BufferAttribute([-.3, 0, 0, .3, 0, 0, 0, -.62, 0], 3)); tri.computeVertexNormals();
        for (i2 = 0; i2 < n2; i2++) {
          var p2 = cur.getPoint((i2 + .5) / n2), f2 = new TH.Mesh(tri, new TH.MeshToonMaterial({ color: CONF[i2 % CONF.length], side: TH.DoubleSide, gradientMap: V3.toon('#fff').gradientMap }));
          f2.position.copy(p2); S3.add(f2); banderas.push(f2);
          if (i2 % 2) { var bo = new TH.Mesh(new TH.SphereGeometry(.12, 6, 4), tn('#fff6c0', { em: CONF[(i2 + 2) % CONF.length], emI: pl.noche ? 2 : .3, nuevo: true })); bo.position.copy(p2).y -= .05; S3.add(bo); bombillos.push(bo.material); }
        }
      }
      guirnalda(new TH.Vector3(-ancho / 2, 6.9, -3.3), new TH.Vector3(-3, 6.9, -3.3), 14, .7);
      guirnalda(new TH.Vector3(3, 6.9, -3.3), new TH.Vector3(ancho / 2, 6.9, -3.3), 14, .7);
      var globos = [];
      for (j = 0; j < 6; j++) {
        var gx = (j < 3 ? -1 : 1) * (3.3 + (j % 3) * .55), gb = M(new TH.SphereGeometry(.38, 9, 7), CONF[j % CONF.length], { g: .05 }); gb.scale.set(1, 1.15, 1);
        gb.position.set(gx, 5.9 + (j % 3) * .35, -3.05); S3.add(gb); globos.push({ m: gb, y: gb.position.y, f: j * 1.3 });
      }
      /* la piñata (una estrella) que se mece colgada del techo */
      var pina = new TH.Group(); pina.position.set(ancho / 2 - 1.2, 8.6, -2.2); S3.add(pina);
      var cuerda = M(new TH.CylinderGeometry(.02, .02, 2.2, 4), '#14101c', { borde: false }); cuerda.position.y = -1.1; pina.add(cuerda);
      var nucleo = M(new TH.SphereGeometry(.45, 8, 6), '#ffd23f', { g: .05 }); nucleo.position.y = -2.5; pina.add(nucleo);
      for (j = 0; j < 6; j++) { var pico = M(new TH.ConeGeometry(.2, .7, 5), CONF[j], { g: .05 }); var an = j / 6 * Math.PI * 2; pico.position.set(Math.cos(an) * .6, -2.5 + Math.sin(an) * .6, 0); pico.rotation.z = an - Math.PI / 2; pina.add(pico); }
      /* el mesón largo con las hornillas: una cocina por jugador */
      var meson = M(new TH.BoxGeometry(ancho, ALTO, 1.8), pl.mes, { recibe: true, g: .01 }); meson.position.set(0, ALTO / 2, ZP); S3.add(meson);
      var tope = M(new TH.BoxGeometry(ancho + .2, .1, 1.95), '#e8e2d4', { recibe: true, g: .015 }); tope.position.set(0, ALTO + .05, ZP); S3.add(tope);
      var pjs = [], panes = [], llamas = [], matLlama = new TH.MeshBasicMaterial({ color: 0xff8a2e }), matLlamaR = new TH.MeshBasicMaterial({ color: 0xff3b4e }), matLlamaB = new TH.MeshBasicMaterial({ color: 0x5a8aff });
      var cinta = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), colJ = s2.color && s2.color !== '#fff' ? s2.color : CONF[k % CONF.length];
        var puerta = M(new TH.BoxGeometry(DXS - .9, ALTO - .35, .06), colJ, { g: .02 }); puerta.position.set(SX(k), ALTO / 2, ZP + .92); S3.add(puerta);
        var asa = M(new TH.BoxGeometry(.9, .08, .08), '#fffdf2', { g: .05 }); asa.position.set(SX(k), ALTO - .3, ZP + .97); S3.add(asa);
        var hornilla = M(new TH.BoxGeometry(DXS - .7, .1, 1.3), '#3a3848', { recibe: true, g: .02 }); hornilla.position.set(SX(k), ALTO + .14, ZP); S3.add(hornilla);
        /* el plato de tequeños crudos al lado */
        var plato = M(new TH.CylinderGeometry(.42, .36, .06, 12), '#fffdf2', { g: .04 }); plato.position.set(SX(k) + DXS / 2 - .45, ALTO + .13, ZP + .62); S3.add(plato);
        for (a = 0; a < 3; a++) { var cr = M(new TH.CylinderGeometry(.07, .07, .4, 6), '#f3e3b0', { g: .05 }); cr.rotation.z = Math.PI / 2; cr.position.set(SX(k) + DXS / 2 - .45, ALTO + .22 + (a === 2 ? .1 : 0), ZP + .55 + (a % 2) * .15 - (a === 2 ? .07 : 0)); S3.add(cr); }
        var fila = [];
        for (j = 0; j < NP; j++) {
          var px = PX(k, j), sg = new TH.Group(); sg.position.set(px, ALTO + .2, ZP); S3.add(sg);
          var olla = M(new TH.CylinderGeometry(.62, .48, .22, 14), '#2a2638', { g: .04 }); sg.add(olla);
          var mango = M(new TH.BoxGeometry(.12, .07, .7), '#2a2638', { g: .06 }); mango.position.set(0, .06, -.9); sg.add(mango);
          var aceite = V3.malla(new TH.CylinderGeometry(.55, .55, .02, 14), null, { mat: V3.toon('#d9a22a', { em: '#ff9a2e', emI: .25, nuevo: true }), borde: false }); aceite.position.y = .1; sg.add(aceite);
          var aro = new TH.Mesh(new TH.TorusGeometry(.66, .06, 6, 20), new TH.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false })); aro.rotation.x = Math.PI / 2; aro.position.y = .12; sg.add(aro);
          var tq = new TH.Group(), mTq = V3.toon('#f3e3b0', { nuevo: true });
          var cuerpo = V3.malla(new TH.CylinderGeometry(.15, .15, .62, 8), null, { mat: mTq, g: .06 }); cuerpo.rotation.z = Math.PI / 2; tq.add(cuerpo);
          [-.31, .31].forEach(function (ex) { var pu = V3.malla(new TH.SphereGeometry(.15, 8, 6), null, { mat: mTq, g: .06 }); pu.position.x = ex; tq.add(pu); });
          var queso = M(new TH.SphereGeometry(.08, 6, 4), '#fff3a8', { g: .08 }); queso.position.set(.44, 0, 0); tq.add(queso);
          tq.position.y = .2; tq.visible = false; sg.add(tq);
          var ani = M(new TH.TorusGeometry(.4, .05, 5, 14), '#5a5868', { g: .04 }); ani.rotation.x = Math.PI / 2; ani.position.y = -.13; sg.add(ani);
          for (a = 0; a < 3; a++) { var ll = new TH.Mesh(new TH.ConeGeometry(.09, .3, 5), matLlama); var al = a / 3 * Math.PI * 2; ll.position.set(Math.cos(al) * .32, 0, Math.sin(al) * .32); sg.add(ll); llamas.push({ m: ll, f: k * 3 + j + a * .7, p: k, j: j }); }
          fila.push({ g: sg, aceite: aceite, aro: aro, tq: tq, mTq: mTq, queso: queso, flipT: -9, echaT: -9, burbT: 0, humoT: 0, s: 0, x: px, hiT: 0, fugaT: 0, sq: 0 });
        }
        panes.push(fila);
        /* el cocinero con su paleta */
        var pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        var x3 = PX(k, P[k].x); pj.g.position.set(x3, 0, ZJ); pj.g.rotation.order = 'YXZ'; S3.add(pj.g);
        try { var mano = pj.mano('der'); if (mano) { var paleta = M(new TH.BoxGeometry(.05, .5, .05), '#7a4a2a', { g: .08 }); paleta.position.y = -.2; mano.add(paleta); var hoja2 = M(new TH.BoxGeometry(.22, .2, .03), '#c9ccd6', { g: .08 }); hoja2.position.y = -.5; mano.add(hoja2); } } catch (e) { /* sin mano: sin paleta */ }
        pjs.push({ pj: pj, x: x3, px: x3, rumbo: 0, caraT: -9, caraK: 'normal', polvoT: 0, sq: 0, sqV: 0, giro: 0, saltoT: -9, mira: 0 });
        cinta.push(colJ);
      }
      /* mamá (el fuego) y la abuela (los pedidos), al fondo en las puntas del mesón */
      var usados = {}; for (k = 0; k < n; k++) usados[asiento(k).ch] = 1;
      var libres = ['mama', 'abuela', 'tio', 'portu', 'prima'].filter(function (id) { return !usados[id]; });
      var mama = V3.PJ.crear(libres[0] || 'mama', { prop: false, escala: 1.25 }); mama.g.position.set(-ancho / 2 - .6, 0, -2.1); S3.add(mama.g);
      var abuela = V3.PJ.crear(libres[1] || 'abuela', { prop: false, escala: 1.2 }); abuela.g.position.set(ancho / 2 + .6, 0, -2.1); S3.add(abuela.g);
      var flecha = M(new TH.ConeGeometry(.3, .6, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      /* los invitados del cumpleaños, entre una cocina y otra (miran, bailan y se alegran con los pedidos) */
      var invitados = [], ids = ['pana', 'tio', 'prima', 'portu', 'cobrador'], lugares = [];
      for (k = 1; k < n; k++) lugares.push((k - n / 2) * DXS);
      if (n < 4) { lugares.push(-n * DXS / 2); lugares.push(n * DXS / 2); }
      lugares.sort(function (u, w) { return u - w; });
      for (k = 0; k < lugares.length && k < 4; k++) {
        var inv = V3.PJ.crear(ids[(k + 1) % ids.length], { prop: false, escala: 1.0 }); inv.g.position.set(lugares[k], 0, -2.9); inv.g.rotation.y = (k % 2 ? -.25 : .25); S3.add(inv.g);
        invitados.push({ pj: inv, f: k * 1.7, x: lugares[k] });
      }
      /* la bombona de gas (amarilla) con su manguera: se acaba el gas y se ve */
      var bombona = new TH.Group(); bombona.position.set(-ancho / 2 + 1.0, 0, -2.4); S3.add(bombona);
      var cuerpoB = M(new TH.CylinderGeometry(.34, .34, 1.15, 10), '#f2c230', { g: .04 }); cuerpoB.position.y = .6; bombona.add(cuerpoB);
      var cupB = M(new TH.SphereGeometry(.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#f2c230', { g: .04 }); cupB.position.y = 1.17; bombona.add(cupB);
      var valB = M(new TH.CylinderGeometry(.08, .1, .2, 6), '#7a7a8a', { g: .05 }); valB.position.y = 1.58; bombona.add(valB);
      var rojoB = M(new TH.CylinderGeometry(.345, .345, .12, 10), '#c4283a', { g: .02, borde: false }); rojoB.position.y = .35; bombona.add(rojoB);
      /* pájaros que cruzan la ventana */
      var pajaros = [];
      for (k = 0; k < 3; k++) {
        var pg = new TH.Group(), ala1 = M(new TH.BoxGeometry(.3, .025, .12), pl.noche ? '#c8c8ff' : '#2a2638', { borde: false }), ala2 = M(new TH.BoxGeometry(.3, .025, .12), pl.noche ? '#c8c8ff' : '#2a2638', { borde: false });
        ala1.position.x = -.15; ala2.position.x = .15; var pa1 = new TH.Group(), pa2 = new TH.Group(); pa1.add(ala1); pa2.add(ala2); pg.add(pa1, pa2);
        pg.position.set(0, 4.5, -3.3); S3.add(pg); pajaros.push({ g: pg, a1: pa1, a2: pa2, f: k * 2.3 });
      }
      /* ventilador de pared que gira, y las cortinas de la ventana */
      var vent2 = new TH.Group(); vent2.position.set(ancho / 2 - 1.3, 3.1, -3.15); S3.add(vent2);
      var hub = M(new TH.CylinderGeometry(.1, .1, .12, 8), '#9aa0b0', { g: .03 }); hub.rotation.x = Math.PI / 2; vent2.add(hub);
      var aspas = new TH.Group(); vent2.add(aspas);
      for (k = 0; k < 4; k++) { var asp = M(new TH.BoxGeometry(.5, .16, .03), '#c8ccd8', { g: .03 }); asp.position.set(.3, 0, .05); var gr2 = new TH.Group(); gr2.rotation.z = k * Math.PI / 2; gr2.add(asp); aspas.add(gr2); }
      var cortinas = [-1, 1].map(function (sg2) { var ct = M(new TH.BoxGeometry(.7, 2.6, .08), sg2 < 0 ? '#ff5c8a' : '#ffd23f', { g: .03 }); ct.position.set(sg2 * 2.65, 4.3, -3.28); S3.add(ct); return ct; });
      if (pl.noche) {
        [-ancho / 4, ancho / 4].forEach(function (x) { var luz = new TH.PointLight(0xffc870, 1.1, 14, 2); luz.position.set(x, 4.6, 1.5); S3.add(luz); });
        var bom = M(new TH.SphereGeometry(.3, 8, 6), '#fff6c0', { em: '#ffd36a', emI: 1.6 }); bom.position.set(0, 7.6, 0); S3.add(bom);
      }
      var part = V3.particulas(esc, 700);
      var cam = { x: 0, w: ancho, h: 7.4 };
      esc.encuadrar(cam.w, cam.h, new TH.Vector3(0, 1.9, -.2), .42);
      return V3.ultimo = { esc: esc, pjs: pjs, panes: panes, llamas: llamas, matLlama: matLlama, matLlamaR: matLlamaR, matLlamaB: matLlamaB, invitados: invitados, bombona: bombona, pajaros: pajaros, aspas: aspas, cortinas: cortinas,
        gasT: -9, grasaT: -9, movT: -9, faseT: -9, hiss: 0, banderas: banderas, bombillos: bombillos, globos: globos,
        pina: pina, mama: mama, abuela: abuela, flecha: flecha, cieloV: cieloV, part: part, cam: cam, ancho: ancho, avisos: [], mamaT: -9, mamaK: 'saludar', mamaX: 0, abuT: -9, abuK: 'quieto', invT: -9, invTri: -9 };
    }
    function soltar3(x, y, z, nn, o) { o.esc = (o.esc || 1) * .55; v3.part.soltar(x, y, z, nn > 2 ? Math.ceil(nn * .4) : nn, o); }
    function aviso3D(tx, p, j, y, col, tam) {                  // texto corto que sube sobre el cocinero p; máximo 2 por cocinero, apilados
      var k2, c2 = 0;
      for (k2 = v3.avisos.length - 1; k2 >= 0; k2--) if (v3.avisos[k2].p === p && ++c2 >= 2) v3.avisos.splice(k2, 1);
      v3.avisos.push({ tx: tx, p: p, t: absT, col: col, tam: tam || 15 });
    }
    function caraPor(p, k2, seg) { var s3 = v3.pjs[p]; s3.caraK = k2; s3.caraT = absT + seg; }
    function efectos3D(gt) {
      var V = v3, e, sp, pq;
      if (cola.length > 10) cola.splice(0, cola.length - 10);              // tras una pausa no se reproducen eventos viejos de golpe
      while (cola.length) {
        e = cola.shift();
        var mio2 = e.p === c.yo, s3 = e.p >= 0 ? V.pjs[e.p] : null, pn = e.p >= 0 ? V.panes[e.p][e.j] : null;
        if (e.ty === 'echa') {
          pn.echaT = absT; s3.pj.uno('lanzar'); s3.sqV = -5;
          soltar3(pn.g.position.x, ALTO + .4, ZP, 6, { k: 'gota', cols: ['#fff3a8', '#ffd23f'], vel: 1.4, arriba: 2, g: 8, vida: .35, esc: .4 });
          if (mio2) V3.sfx('pop');
        } else if (e.ty === 'voltea') {
          pn.flipT = absT; s3.pj.uno(e.a >= 4 ? 'saltar' : 'lanzar'); s3.sqV = e.a >= 3 ? 4 : -4;
          soltar3(pn.g.position.x, ALTO + .45, ZP, 8, { k: 'gota', cols: ['#ffd23f', '#ff9a2e'], vel: 1.8, arriba: 2.5, g: 10, vida: .4, esc: .35 });
          if (mio2) { V3.sfx('whoosh'); aviso3D(e.a >= 4 ? '¡PERFECTO!' : e.a >= 3 ? '¡DORADO!' : e.a === 2 ? 'CRUDO' : 'QUEMADO', e.p, e.j, ALTO + 1.2, CAL_COL[e.a] || '#fffdf2', 13); }
        } else if (e.ty === 'saca') {
          var bueno = e.a >= 3;
          soltar3(pn.g.position.x, ALTO + .6, ZP, bueno ? 14 : 6, { k: bueno ? 'confeti' : 'gota', cols: bueno ? ['#ffd23f', '#e9a13b', '#fffdf2'] : ['#6a5a50', '#3a3038'], vel: 2.5, arriba: 3.5, g: bueno ? 6 : -1, vida: .8 });
          if (e.a === 4) { s3.pj.uno('festejo'); caraPor(e.p, 'feliz', 1); s3.giro = 1; s3.sqV = 7; } else if (bueno) { caraPor(e.p, 'feliz', .7); s3.pj.uno('lanzar'); s3.sqV = 5; } else { caraPor(e.p, 'triste', 1); s3.pj.uno('golpe'); s3.sqV = -6; }
          aviso3D((P[e.p].popD > 0 ? '+' + P[e.p].popD + ' ' : '') + CAL_TXT[e.a], e.p, e.j, ALTO + 1.5, CAL_COL[e.a], mio2 ? 17 : 12);
          if (mio2) V3.sfx(e.a === 4 ? 'moneda' : bueno ? 'ding' : 'error');
        } else if (e.ty === 'carbon') {
          soltar3(pn.g.position.x, ALTO + .5, ZP, 18, { k: 'gota', cols: ['#3a3038', '#5a5060', '#2a2028'], vel: .8, arriba: 1.5, g: -2.5, vida: 1.4, esc: 1.2 });
          caraPor(e.p, 'enojado', 1.2); s3.pj.uno('golpe'); s3.sqV = -6; aviso3D('¡CARBÓN!', e.p, e.j, ALTO + 1.5, '#3a2a2a', mio2 ? 17 : 12);
          if (mio2) { V3.sfx('error'); V.esc.sacudir(.4); }
        } else if (e.ty === 'quemon') {
          s3.pj.uno('tropezar'); caraPor(e.p, 'susto', 1);
          soltar3(s3.x, 2.2, ZJ, 10, { k: 'chispa', cols: ['#ffd23f', '#ff5c2a'], vel: 2.5, arriba: 2, vida: .5 });
          aviso3D('¡AY!', e.p, -1, 3.6, '#ff3b4e', mio2 ? 18 : 12);
          if (mio2) { V3.sfx('golpe'); V.esc.sacudir(1); }
        } else if (e.ty === 'pedido') {
          s3.pj.uno('festejo'); caraPor(e.p, 'feliz', 1.4);
          soltar3(s3.x, 3, ZJ + .5, 26, { k: 'confeti', cols: CONF, vel: 4, arriba: 5, g: 6, vida: 1.2 });
          aviso3D('¡PEDIDO!' + (e.a > 0 ? ' +' + e.a : ''), e.p, -1, 4.1, '#d4137a', mio2 ? 20 : 13);
          V.invT = absT + 1.6; V.abuT = absT + 1.4; V.abuela.uno('aplaudir');
          if (mio2) V3.sfx('aplauso');
        } else if (e.ty === 'sefue') {
          V.invTri = absT + 1.4; V.abuela.uno('golpe');
          if (mio2) { aviso3D('¡SE FUE!', e.p, -1, 4.1, '#6a3a9a', 16); V3.sfx('error'); }
        } else if (e.ty === 'combo') {
          aviso3D('¡COMBO x' + e.a + '!', e.p, -1, 4.4, '#ff9a2e', mio2 ? 19 : 12);
          if (mio2) V3.sfx('tambor');
        } else if (e.ty === 'chispa') {
          for (sp = 0; sp < n; sp++) {
            pq = V.panes[sp][e.j]; var px3 = pq.x;
            soltar3(px3, ALTO + .4, ZP - .2, 16, { k: 'chispa', cols: ['#ffd23f', '#ff9a2e', '#fffdf2'], vel: 3.2, arriba: 4.5, g: 12, vida: .6 });
            soltar3(px3, ALTO + .4, ZP - .4, 8, { k: 'gota', cols: ['#e9a13b', '#ffd23f'], vel: 2, arriba: 3, g: 12, vida: .5, esc: .5 });
          }
          V3.sfx('chispa');
        } else if (e.ty === 'grasa') {
          V.mama.uno('lanzar'); V.mama.uno('susto'); V.mamaT = absT + 2.2; V.mamaK = 'saludar'; V3.sfx('chispa'); V.esc.sacudir(.3);
          for (sp = 0; sp < n; sp++) { pq = V.panes[sp][e.j]; soltar3(pq.x, ALTO + .5, ZP, 20, { k: 'gota', cols: ['#ff7a2a', '#ffd23f', '#c4551a'], vel: 2.6, arriba: 4, g: 9, vida: .7, esc: .5 }); if (sp === c.yo || n < 3) aviso3D('¡ACEITE!', sp, -1, 0, '#ff7a2a', 13); }
        } else if (e.ty === 'gas') {
          V.mamaT = absT + 2.6; V.mamaK = 'empujar'; V.gasT = absT; V3.sfx('viento');
          for (sp = 0; sp < n; sp++) { pq = V.panes[sp][e.j]; soltar3(pq.x, ALTO + .4, ZP, 12, { k: 'gota', cols: ['#9ab0ff', '#fffdf2'], vel: 1.4, arriba: 1.6, g: -1, vida: .7, esc: .6 }); if (sp === c.yo || n < 3) aviso3D('¡SIN GAS!', sp, -1, 0, '#5a8aff', 13); }
        } else if (e.ty === 'gasfin') {
          V3.sfx('pop');
          for (sp = 0; sp < n; sp++) { pq = V.panes[sp][e.j]; soltar3(pq.x, ALTO + .4, ZP, 14, { k: 'chispa', cols: ['#ffd23f', '#ff9a2e', '#fffdf2'], vel: 2.6, arriba: 3.2, g: 8, vida: .5 }); }
        } else if (e.ty === 'muevea') {
          V.mamaT = absT + 3; V.mamaK = 'empujar'; V3.sfx('silbato');
        } else if (e.ty === 'mueve') {
          V3.sfx('whoosh'); V.esc.sacudir(.35); V.movT = absT;
          for (sp = 0; sp < n; sp++) soltar3(SX(sp), ALTO + .3, ZP, 14, { k: 'gota', cols: ['#fffdf2', '#c8c0b0'], vel: 2.4, arriba: 1.2, g: 2, vida: .5, esc: .5 });
        } else if (e.ty === 'fase') {
          V3.sfx('tambor'); V.esc.sacudir(.4); V.invT = absT + 2; V.abuT = absT + 2; V.abuela.uno('saltar');
          soltar3(0, 5.5, -1, 40, { k: 'confeti', cols: CONF, vel: 5, arriba: 6, g: 5, vida: 1.6 });
        } else if (e.ty === 'fuego') {
          V.mama.uno('gritar'); V.mamaT = absT + 2.4; V.mamaK = 'saludar'; V3.sfx('viento'); V.esc.sacudir(.5);
        } else if (e.ty === 'apagon') {
          V3.sfx('trueno'); V.esc.sacudir(.6);
        }
      }
    }
    function actualizar3D(dt, gt) {
      var TH = THREE, V = v3, p, j, k2, t = absT, dark = oscuro(gt), fin = gt >= corte, pl = PAL3[lv], avm = gt >= 0 ? avisoMov(gt) : 0, gasYa = false;
      efectos3D(gt);
      V.part.update(dt);
      /* lo que se mueve solo: banderines, globos, piñata, nubes, bombillos, llamas, ventilador, cortinas y pájaros */
      for (k2 = 0; k2 < V.banderas.length; k2++) V.banderas[k2].rotation.x = Math.sin(t * 2 + k2 * .7) * .3;
      for (k2 = 0; k2 < V.globos.length; k2++) { var gb = V.globos[k2]; gb.m.position.y = gb.y + Math.sin(t * 1.6 + gb.f) * .12; gb.m.rotation.z = Math.sin(t * 1.1 + gb.f) * .12; }
      V.pina.rotation.z = Math.sin(t * 1.3) * .22; V.pina.rotation.y = t * .4;
      V.cieloV.offset.x = (t * .015) % 1;
      for (k2 = 0; k2 < V.bombillos.length; k2++) V.bombillos[k2].emissiveIntensity = pl.noche ? 1.4 + Math.sin(t * 4 + k2) * .6 : .3;
      var fuerte = gt >= fuegoAt;
      V.aspas.rotation.z = -t * (fuerte ? 11 : 6);
      for (k2 = 0; k2 < V.cortinas.length; k2++) V.cortinas[k2].rotation.z = Math.sin(t * 1.3 + k2 * 2) * .05 + (fuerte ? Math.sin(t * 7 + k2) * .03 : 0);
      for (k2 = 0; k2 < V.pajaros.length; k2++) {
        var pb = V.pajaros[k2], u = ((t * .09 + pb.f * .31) % 1);
        pb.g.position.set(-2.9 + u * 5.8, 4.45 + Math.sin(t * 2.2 + pb.f) * .28 + (k2 % 2) * .3, -3.3);
        pb.a1.rotation.z = Math.sin(t * 13 + pb.f) * .75; pb.a2.rotation.z = -Math.sin(t * 13 + pb.f) * .75;
      }
      for (j = 0; j < ACC.length; j++) if (ACC[j].ty === 2 && gt >= ACC[j].t && gt < ACC[j].t + ACC[j].d) gasYa = true;
      V.hiss -= dt;
      if (gasYa && V.hiss < 0) { V.hiss = .07; soltar3(V.bombona.position.x, 1.7, V.bombona.position.z, 1, { k: 'gota', cols: ['#fffdf2', '#c8d4ff'], vel: .5, arriba: .9, g: -1.2, vida: .7, esc: .45, suelo: false }); }
      V.bombona.rotation.z = gasYa || t - V.gasT < .5 ? Math.sin(t * 38) * .045 : 0;
      for (k2 = 0; k2 < V.llamas.length; k2++) {
        var ll = V.llamas[k2], ac2 = gt >= 0 ? accEn(ll.j, gt) : 0, fl = (1 + .3 * Math.sin(t * 17 + ll.f * 3)) * (fuerte ? 1.7 : 1) * (ac2 === 2 ? .22 : ac2 === 1 ? 1.35 : 1);
        ll.m.scale.set(1, fl, 1); ll.m.material = ac2 === 2 ? V.matLlamaB : fuerte || ac2 === 1 ? V.matLlamaR : V.matLlama;
      }
      /* el apagón: casi todo a oscuras, solo el aceite y las llamas */
      var hemiI = dark ? .07 : pl.hemi[2], solI = dark ? .04 : pl.sol[1];
      V.esc.luces.hemi.intensity += (hemiI - V.esc.luces.hemi.intensity) * Math.min(1, dt * 8);
      V.esc.luces.sol.intensity += (solI - V.esc.luces.sol.intensity) * Math.min(1, dt * 8);
      /* las sartenes (se deslizan a su lugar cuando la mamá las mueve) */
      for (p = 0; p < n; p++) for (j = 0; j < NP; j++) {
        var pa = P[p].pan[j], pn = V.panes[p][j], fr = pa.s === 1 || pa.s === 2, gg = fr ? gLado(pa) : 1, tq = T[pa.tq % T.length], acc = gt >= 0 ? accEn(j, gt) : 0;
        var tx2 = PX(p, slotOf(j, gt)), ddx = tx2 - pn.x, desliz = Math.abs(ddx) > .02;
        pn.x += Math.abs(ddx) > 9 * dt ? (ddx > 0 ? 1 : -1) * 9 * dt : ddx;
        pn.g.position.x = pn.x; pn.g.rotation.z = avm > 0 ? Math.sin(t * 34 + j) * .07 * avm : desliz ? Math.sin(t * 20) * .05 : 0;
        pn.tq.visible = !!fr;
        if (fr) {
          var esc2 = tq.fat ? 1.35 : 1, ef = t - pn.flipT, ed = t - pn.echaT, y = .2;
          pn.tq.scale.setScalar(esc2);
          pn.mTq.color.set(dark ? '#2a2030' : colorMasa(pa.u, gg));
          pn.queso.visible = !dark && pa.u >= gg - HW && pa.u <= gg + HW + .2;
          pn.tq.rotation.set(0, .3 * (j - 1), Math.sin(t * 14 + j + p) * .04);
          if (ef >= 0 && ef < .45) { var u = ef / .45; y += Math.sin(u * Math.PI) * .6; pn.tq.rotation.x = u * Math.PI * 2; }
          if (ed >= 0 && ed < .22) y += (1 - ed / .22) * .55;
          pn.tq.position.y = y;
          /* burbujas: más a medida que se dora (y a lo loco con el aceite regado); humo si ya se pasó */
          pn.burbT -= dt * (acc === 2 ? 0 : (0.4 + 3 * cl(pa.u / gg, 0, 1.4)) * (acc === 1 ? 2.2 : 1));
          if (pn.burbT < 0) { pn.burbT = .12; soltar3(pn.g.position.x + (c.fx() - .5) * .8, ALTO + .34, ZP + (c.fx() - .5) * .6, 1, { k: 'gota', cols: dark ? ['#ffe9a0'] : ['#fffdf2', '#fff3c0'], vel: .2, arriba: .8, g: 2, vida: .35, esc: .3, suelo: false }); }
          if (pa.u > gg + HW) { pn.humoT -= dt; if (pn.humoT < 0) { pn.humoT = .1; soltar3(pn.g.position.x, ALTO + .5, ZP, 1, { k: 'gota', cols: ['#5a5060', '#7a7080'], vel: .3, arriba: .6, g: -2, vida: 1, esc: .9, suelo: false }); } }
        }
        if (acc === 1) {                                         // aceite regado: salpica sin parar
          pn.fugaT -= dt;
          if (pn.fugaT < 0) { pn.fugaT = .2; soltar3(pn.g.position.x + (c.fx() - .5) * .9, ALTO + .4, ZP + (c.fx() - .5) * .8, 1, { k: 'chispa', cols: ['#ff7a2a', '#ffd23f'], vel: 1.2, arriba: 2.6, g: 9, vida: .45 }); }
        }
        pn.aceite.material.color.set(pa.s === 3 ? '#4a3020' : acc === 1 ? '#ff7a2a' : acc === 2 ? '#8a9ab8' : fr ? '#f0b828' : '#d9a22a');
        pn.aceite.material.emissiveIntensity = dark ? .9 : acc === 1 ? .9 : acc === 2 ? 0 : fr ? .35 : .2;
        var av = gt >= 0 ? avisoChispa(j, gt) : 0;
        pn.aro.material.opacity = av > 0 ? .35 + .6 * Math.abs(Math.sin(t * (8 + av * 14))) : 0;
        pn.aro.visible = av > 0;
        pn.g.position.y = ALTO + .2 + (av > 0 ? Math.sin(t * 60) * .015 * av : 0) + (desliz ? .12 : 0) + (acc === 1 ? Math.sin(t * 50) * .01 : 0);
      }
      /* los cocineros: idle con balanceo, squash al actuar, inclinación y polvo al correr, mirada a la sartén más urgente */
      var mx = -1; for (p = 0; p < n; p++) mx = Math.max(mx, P[p].pts);
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], tx = PX(p, q.x), dx = tx - s3.x;
        s3.x += Math.abs(dx) > 14 * dt ? (dx > 0 ? 1 : -1) * 14 * dt : dx;
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3); s3.px = s3.x;
        var pj = s3.pj, friendo = q.pan[0].s % 3 + q.pan[1].s % 3 + q.pan[2].s % 3 > 0, ck = 'normal', correr = Math.abs(vx) > .6;
        var urg = 9, urgX = 0, avp = 0;
        for (j = 0; j < NP; j++) {
          var pu = q.pan[j]; if (pu.s !== 1 && pu.s !== 2) continue;
          var falta = gLado(pu) - pu.u; if (falta < urg) { urg = falta; urgX = PX(p, slotOf(j, gt)); }
          if (gt >= 0 && Math.abs(q.x - slotOf(j, gt)) < RADIO + .35) avp = Math.max(avp, avisoChispa(j, gt));
        }
        if (fin) { var gana = q.pts === mx && mx > 0; pj.anim(gana ? 'celebrar' : 'triste').cara(gana ? 'feliz' : 'triste').rumbo(0).mirar(0, 0); s3.lean = 0; }
        else if (q.stun > 0) { pj.anim('mojado').cara('mareado').rumbo(0).mirar(0, 0); s3.lean = -.18; }
        else {
          if (correr) { pj.anim(Math.abs(vx) > 4 ? 'correr' : 'caminar', { vel: Math.min(1, Math.abs(vx) / 8) }); s3.rumbo = vx > 0 ? Math.PI / 2 : -Math.PI / 2; }
          else { pj.anim(avp > .5 ? 'agacharse' : friendo ? 'quieto' : 'bailar', { vel: .6 }); s3.rumbo = avp > .3 ? 0 : urg < 9 ? cl((urgX - s3.x) * .25, -.5, .5) : Math.sin(t * .9 + p) * .25; }
          ck = absT < s3.caraT ? s3.caraK : avp > .3 || dark ? 'susto' : q.cb >= 3 ? 'feliz' : friendo ? 'concentrado' : 'normal';
          pj.cara(ck).rumbo(s3.rumbo).mirar(urg < 9 ? cl((urgX - s3.x) * .5, -1, 1) : 0, urg < .4 ? -.35 : 0);
          s3.lean = avp > .3 ? -.2 : correr ? Math.min(.3, Math.abs(vx) * .035) : urg < .35 ? .12 : 0;
        }
        pj.update(dt);
        /* squash/stretch sobre lo que pone el kit (resorte), giro de festejo y balanceo */
        s3.sqV += (-s3.sq * 160 - s3.sqV * 11) * dt; s3.sq = cl(s3.sq + s3.sqV * dt, -.4, .4);
        s3.giro = Math.max(0, s3.giro - dt * 1.6);
        var kk = 1.35, sg3 = 1 + s3.sq * .35;
        pj.g.scale.set(kk * (1 - s3.sq * .22), kk * sg3, kk * (1 - s3.sq * .22));
        if (s3.giro > 0) pj.g.rotation.y += (1 - s3.giro) * Math.PI * 2;                 // pirueta del tequeño perfecto
        pj.g.rotation.x += (s3.lean - pj.g.rotation.x) * Math.min(1, dt * 10);
        pj.g.rotation.z = fin || q.stun > 0 || correr ? 0 : Math.sin(t * 2.2 + p * 1.3) * .035;
        pj.g.position.set(s3.x, correr && Math.abs(vx) > 4 ? Math.abs(Math.sin(t * 16)) * .06 : 0, ZJ);
        if (correr && Math.abs(vx) > 3) {
          s3.polvoT -= dt;
          if (s3.polvoT < 0) { s3.polvoT = .07; soltar3(s3.x - (vx > 0 ? .3 : -.3), .05, ZJ + .1, 2, { k: 'gota', cols: ['#e8dcc0', '#c8b898'], vel: .6, arriba: .7, g: 2, vida: .4, esc: .5 }); }
        }
      }
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !fin;
      if (yo) V.flecha.position.set(yo.x, 3.75 + Math.abs(Math.sin(t * 4)) * .25, ZJ);
      /* mamá: corre a la bombona o a las sartenes cuando algo pasa; la abuela y los invitados reaccionan a los pedidos */
      var mamaOcup = t < V.mamaT, mHome = -V.ancho / 2 - .6, mTar = mamaOcup ? -V.ancho / 2 + 1.9 : mHome, mdx = mTar - V.mama.g.position.x, mmov = Math.abs(mdx) > .08;
      V.mama.g.position.x += Math.abs(mdx) > 5 * dt ? (mdx > 0 ? 1 : -1) * 5 * dt : mdx;
      if (mmov) V.mama.anim(Math.abs(mdx) > 1 ? 'correr' : 'caminar', { vel: .8 }).cara(dark ? 'susto' : 'enojado').rumbo(mdx > 0 ? Math.PI / 2 : -Math.PI / 2);
      else V.mama.anim(mamaOcup ? V.mamaK : 'bailar', { vel: .5 }).cara(mamaOcup ? 'enojado' : dark ? 'susto' : 'feliz').rumbo(mamaOcup ? 0 : .5);
      V.mama.update(dt);
      V.abuela.anim(t < V.abuT ? 'celebrar' : 'quieto').cara(t < V.abuT ? 'feliz' : t < V.invTri ? 'enojado' : 'normal').rumbo(-.5).update(dt);
      for (k2 = 0; k2 < V.invitados.length; k2++) {
        var iv = V.invitados[k2];
        iv.pj.anim(t < V.invT ? (k2 % 2 ? 'aplaudir' : 'celebrar') : t < V.invTri ? 'triste' : 'bailar', { vel: .35 + (k2 % 2) * .15 }).cara(t < V.invT ? 'feliz' : t < V.invTri ? 'triste' : dark ? 'susto' : 'normal').rumbo(iv.x < 0 ? .45 : -.45).mirar(Math.sin(t * .7 + iv.f) * .6, 0).update(dt);
      }
      /* cámara: en pantalla angosta sigue tu cocina; si no, todas */
      var f = vista(), angosta = f.x1 - f.x0 < 560 && c.yo >= 0, cx = angosta ? SX(c.yo) : 0, cw = angosta ? DXS * 1.2 : V.ancho;
      var kc = Math.min(1, dt * 3); V.cam.x += (cx - V.cam.x) * kc; V.cam.w += (cw - V.cam.w) * kc;
      V.esc.encuadrar(V.cam.w, V.cam.h * (angosta ? .8 : 1), new TH.Vector3(V.cam.x, 1.9, -.2), .42);
    }
    function marcador3D(f, gt) {
      var V = v3, p, j, cx = (f.x0 + f.x1) / 2, angosta = f.x1 - f.x0 < 560;
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], pn = V.esc.proyectar(s3.x, 3.35, ZJ), pp = V.esc.proyectar(SX(p), .55, ZP + 1);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pn.x, pn.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        txt(String(q.pts), pp.x, pp.y, angosta && p !== c.yo ? 14 : 22, '#fffdf2', 0, true);
        if (q.cb >= 2) txt('COMBO x' + q.cb, pp.x, pp.y + 20, 12, '#ffd23f', 0, true);
        for (j = 0; j < NP; j++) { var av = gt >= 0 ? avisoChispa(j, gt) : 0; if (av > 0) { var pa2 = V.esc.proyectar(V.panes[p][j].x, ALTO + 1.3, ZP); txt('¡!', pa2.x, pa2.y - av * 6, 16 + av * 6, '#ff3b4e', 0, true); } }
      }
      /* tus barras de fritura (Nv1 con zona dorada, Nv2 sin zona, Nv3 nada; en el apagón tampoco) */
      if (c.yo >= 0 && lv <= 2 && !oscuro(gt)) for (j = 0; j < NP; j++) {
        var pa = P[c.yo].pan[j];
        if (pa.s !== 1 && pa.s !== 2) continue;
        var gg = gLado(pa), top = gg + HW + .5, pb = V.esc.proyectar(V.panes[c.yo][j].x, ALTO + 1.05, ZP), bw = 54, bx = pb.x - bw / 2, by = pb.y;
        rr(bx, by, bw, 9, 4, '#fffdf2', 2);
        if (lv === 1) rr(bx + bw * (gg - HW) / top, by, bw * 2 * HW / top, 9, 3, '#ffd23f', 0);
        var fr = cl(pa.u / top, 0, 1); if (fr > .01) rr(bx, by, bw * fr, 9, 4, colorMasa(pa.u, gg), 1.5);
        txt(pa.s === 1 ? 'LADO 1' : 'LADO 2', pb.x, by - 8, 9, '#fffdf2', 0, true);
        if (lv === 1 && pa.u >= gg - HW && pa.u <= gg + HW) txt(pa.s === 1 ? '¡VOLTEA!' : '¡SACA!', pb.x, by - 22, 14, '#5cff7a', 0, true);
      }
      /* avisos que suben */
      var rk = {};
      for (j = V.avisos.length - 1; j >= 0; j--) {
        var a = V.avisos[j], ag = absT - a.t;
        if (ag > 1.1) { V.avisos.splice(j, 1); continue; }
        var r0 = rk[a.p] = (rk[a.p] === undefined ? 0 : rk[a.p] + 1), pt = V.esc.proyectar(a.p >= 0 ? SX(a.p) : 0, 4.15 + r0 * .55 + ag * .35, ZJ);
        txt(a.tx, pt.x, pt.y, a.tam, a.col, 0, true);
      }
      ticket(cx, 80, gt, angosta ? .9 : 1.05);
      var av2 = avisoTexto(gt);
      var ns3 = c.yo >= 0 && gt >= 0 ? nslots(gt) : 1, by2 = 84 + ns3 * 37;
      if (av2) { var bw2 = Math.min(f.x1 - f.x0 - 24, 380); rr(cx - bw2 / 2, by2, bw2, 28, 12, av2[1], 3); txt(av2[0], cx, by2 + 14, bw2 < 340 ? 12 : 15, av2[2], 0, true); }
    }
    function dibujar3D() {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), gt = c.ahora(); v3T = absT;   // reloj cosmético del juego (absT avanza en update)
      if (dt > 0) actualizar3D(dt, gt);                                          // sin update entre dos cuadros no hay nada que mover
      if (gt >= 0 && gt < corte + 1) V3.musica('tequeno');
      v3.esc.render(dt);
      marcador3D(vista(), gt);
    }

    var g = {
      update: function (dt) {
        var gt = c.ahora(), p;
        dt = dt > 0.1 ? 0.1 : dt;
        absT += dt;
        for (p = 0; p < n; p++) updJugador(p, dt, gt);
        detectar(gt);
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D();
        dibujar2D();
      },
      ai: function (p, dt, api) {
        var gt = c.ahora(), q = P[p], sk = c.skill[p], r = cpuR[p], A = q.ai, j, k2, pa, sl;
        if (gt < 0 || gt >= corte || q.stun > 0) { api.eje(0, 0); return; }
        var osc = oscuro(gt), maxP = sk < 0.45 ? 2 : 3;
        /* 1 · el punto al que piensa sacar cada lado (con su error); pa es la sartén j, sl su lugar */
        for (j = 0; j < NP; j++) {
          pa = q.pan[j];
          if (pa.s !== 1 && pa.s !== 2) continue;
          var key = pa.tq * 4 + pa.s;
          if (A.key[j] !== key) {
            A.key[j] = key; var g0 = gLado(pa), z = (r.next() + r.next() + r.next() - 1.5) * 2;
            A.tg[j] = g0 + z * (1 - sk) * 0.16 * (osc ? 2 : 1);
            if (r.next() < 0.07 * (1 - sk)) A.tg[j] = r.next() < 0.5 ? g0 * 0.6 : g0 + HW + 0.35;   // se distrajo con el chisme
          }
        }
        /* 2 · chispas que vio venir (por lugar: las sartenes se mueven) */
        var peligro = [0, 0, 0], huye = -1;
        for (k2 = q.si; k2 < S.length && S[k2].t - gt < AVISO; k2++) {
          if (S[k2].t < gt) continue;
          if (!A.vis[k2]) A.vis[k2] = { ve: S[k2].t - AVISO + 0.18 + (1 - sk) * 0.35 + r.next() * 0.1, esq: r.next() < 0.3 + 0.65 * sk };
          if (gt >= A.vis[k2].ve && A.vis[k2].esq) { sl = slotOf(S[k2].j, gt); peligro[sl] = 1; if (Math.abs(q.x - sl) < RADIO + 0.3) huye = 1; }
        }
        var tgtJ = -1;
        if (huye > 0) {
          var bd = 9; for (j = 0; j < NP; j++) if (!peligro[j] && Math.abs(j - q.x) < bd) { bd = Math.abs(j - q.x); tgtJ = j; }
        }
        if (tgtJ < 0) {
          /* urgencia de cada lugar: la que se pasa antes (contando el camino); una vacía espera su turno. Con histéresis para no ir y venir */
          var activos = 0, U = [1e9, 1e9, 1e9], bv = 1e9, pj2;
          for (j = 0; j < NP; j++) if (q.pan[j].s === 1 || q.pan[j].s === 2) activos++;
          for (j = 0; j < NP; j++) {
            pj2 = panEn(j, gt); pa = q.pan[pj2]; var trav = Math.abs(j - q.x) / VX + 0.15;
            if (peligro[j]) { /* ese lugar va a escupir: mejor no pararse ahí ahorita */ }
            else if (pa.s === 1 || pa.s === 2) U[j] = (A.tg[pj2] - pa.u) / MAX1(speed(gt, pj2)) - trav;
            else if (pa.s === 0 && accEn(pj2, gt) !== 2 && activos < maxP) U[j] = 0.5 + trav;
            if (U[j] < bv) { bv = U[j]; tgtJ = j; }
          }
          if (A.tj >= 0 && A.tj !== tgtJ && U[A.tj] < 1e8 && bv > U[A.tj] - 0.35) tgtJ = A.tj;
          if (tgtJ < 0) tgtJ = Math.round(q.x);
        }
        A.tj = tgtJ;
        var dx = tgtJ - q.x;
        api.eje(Math.abs(dx) > 0.12 ? (dx > 0 ? 1 : -1) : 0, 0);
        /* 3 · pulsar A */
        if (huye < 0 && Math.abs(dx) < 0.25 && q.acd <= 0 && gt - A.pT > 0.2) {
          var pt = panEn(tgtJ, gt); pa = q.pan[pt];
          if (pa.s === 0) {
            if (accEn(pt, gt) === 2) return;
            if (A.wj !== tgtJ) { A.wj = tgtJ; A.w = 0.12 + (1 - sk) * 0.35 + r.next() * 0.15; }
            A.w -= dt;
            if (A.w <= 0) { api.press('a'); A.pT = gt; A.wj = -1; }
          } else if ((pa.s === 1 || pa.s === 2) && pa.u >= A.tg[pt]) { api.press('a'); A.pT = gt; }
        }
      },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) out.push(MIN2(P[p].pts, TOPE) | 0);
        return out;
      },
      cuerpo: function (p) {
        var q = P[p];
        return { pts: q.pts, x: Math.round(q.x * 100), p0: codigo(q.pan[0]), p1: codigo(q.pan[1]), p2: codigo(q.pan[2]), k: q.k, cal: q.cal, nn: q.nn, cb: q.cb,
          qm: q.hits, ped: q.ped, oi: q.oi, op: opT(q) };
      },
      done: function () { return false; },
      alRemoto: function (p, o, t) { /* el estado se sincroniza en update desde c.remoto */ },
      alCpu: function (p) { P[p].own = false; },
      alHum: function (p, o) { var q = P[p]; q.own = false; if (o) aplicaRemoto(q, o, c.ahora()); },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0];
        if (!q) return '';
        return q.nn ? q.sv + ' tequeños dorados, ' + q.ped + (q.ped === 1 ? ' pedido' : ' pedidos') + ', ' + q.pts + ' pts' : 'ni un tequeño sacaste';
      },
      vista: function () {
        var h = 7, j;
        for (j = 0; j < T.length; j++) h = (Math.imul(h ^ Math.round(T[j].g1 * 100) ^ (Math.round(T[j].g2 * 100) << 10) ^ (T[j].fat ? 1 : 0), 16777619) >>> 0);
        return { gt: c.ahora(), lv: lv, corte: corte, hashT: h, T: T.map(function (t) { return [t.g1, t.g2]; }), fat: T.map(function (t) { return t.fat ? 1 : 0; }),
          fuegoAt: fuegoAt, ACC: ACC.map(function (a) { return [a.t, a.j, a.ty, a.d]; }), MV: MV.map(function (m) { return [m.t, m.perm.slice()]; }), OE: OE.map(function (o) { return [o.n, o.ty, o.tl]; }), perm: permAt(c.ahora()), ramp: ramp(c.ahora()), apag: apag.slice(), gags: gags.slice(), S: S.map(function (s) { return [s.t, s.j]; }), O: O.map(function (o) { return [o.n, o.tl]; }),
          HW: HW, PERF: PERF, NP: NP, STUN: STUN,
          pts: P.map(function (q) { return q.pts; }), x: P.map(function (q) { return q.x; }), k: P.map(function (q) { return q.k; }), nn: P.map(function (q) { return q.nn; }),
          cb: P.map(function (q) { return q.cb; }), ped: P.map(function (q) { return q.ped; }), oi: P.map(function (q) { return q.oi; }), op: P.map(function (q) { return opT(q); }),
          hits: P.map(function (q) { return q.hits; }), stun: P.map(function (q) { return q.stun; }), sv: P.map(function (q) { return q.sv; }),
          pan: P.map(function (q) { return q.pan.map(function (pa) { return { s: pa.s, u: pa.u, tq: pa.tq, c1: pa.c1 }; }); }) };
      }
    };
    return g;
  }
});
})();
