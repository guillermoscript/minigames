'use strict';
/* LA FIESTA · EN VIVO · f_chancla · ¡LLUEVEN CHANCLAS!  (FFA, supervivencia, modelo B: dueño + juez)
   La sala de mamá. Mamá lanza chanclas: cada una es una SOMBRA ROJA en el piso 0,7 s antes de caer (telegrafía ≥0,5 s) y el calendario sale de c.rng en mk,
   idéntico en todas las pantallas (ritmo 1,2 / 0,9 / 0,6 s, con rampa y «¡LLUEVEN CHANCLAS!» los últimos 12 s). Cada dueño juzga SU cuerpo (la víctima juzga):
   a la hora T de caída, si estás a menos de R de la sombra, sin mesa y sin inmunidad: pierdes 1 vida (2 vidas = «chancletazo y medio»). Sin vidas = fuera, y la hora del fallo
   es T (determinista), así que kk = floor(T*30) es igual para cualquier observador. A = meterte bajo la mesa (0,6 s a salvo, enfriamiento 2 s).
   Desde Nv2 los eliminados son «TÍAS CHISMOSAS»: mueven una mira (stick) y con A lanzan una chancla (ev `shot {x,y,tl}`, cae 1 s después). Nv3 suma «¡LA CHANCLA TELEDIRIGIDA!»:
   el JUEZ decide el blanco (ev `tele {i,to,tl}`: el que va ganando) y una sombra lo persigue 2,4 s y cae a los 3 s; solo el dueño del blanco la juzga.
   ESCALADA (por fracción del tiempo de juego, sirve igual a dur 10 o 45): F1 «calma» = solo mamá, ráfagas cortas; F2 (33 %) «¡LLEGÓ LA ABUELA!» = dos lanzadoras,
   ráfagas más grandes, CHANCLÓN (sombra grande, aviso 1 s) y REBOTONA (cae y rebota a otra sombra 0,6 s después); F3 (70 %) «¡ÚLTIMOS SEGUNDOS!» = mamá + abuela + tía,
   más rápido, BARRIDAS (fila de chanclas con UN hueco: corre al hueco), música más rápida, luz roja y sacudidas. Todo eso sale del calendario de mk (c.rng).
   EVENTOS DEL PATIO (sembrados en mk, con aviso): EL PERRO cruza una fila (aviso 0,9 s): se roba las chanclas de su fila (esas no pegan: corre detrás de él) pero si te
   pasa por encima te tumba 0,6 s (la mesa te salva). LA MANGUERA del vecino moja una franja (aviso 1 s): el chorro te arrastra hacia adelante y deja un CHARCO que resbala 5 s.
   SE FUE LA LUZ (aviso 0,8 s): 2,6 s a oscuras, solo brillan las sombras. LA OLLA: aparece en el piso; quien la agarra la lleva de casco y le para UN chancletazo
   (ev `olla {i}`; el golpe parado va como `hit {ol:1}`). Todo lo del perro/manguera lo juzga el dueño de su cuerpo con el calendario común: no hace falta red.
   Puntaje: eliminado = tick del fallo; vivo = dur*30+1 (mismo contrato que f_mecate). done() = quedan <=1 vivos.
   Cuerpo en red (o): x, y (piso lógico 560x270), vd (vidas), mesa, st (fuera), sc. Sin Math.random/Date.now: azar de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético c.fx(). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_chancla')) return;

var AW = 560, AH = 270, R = 40, WARN = 0.7, SPD = 190, MESA = 0.6, MCD = 2.0, INV = 0.9, BODY = 6, TELE_CRAWL = 2.4, TELE_T = 3.0, TELE_V = 150, RT0 = 0.55, RT1 = 0.3, E0 = 110, E1 = 80;
var GIG = 1.55, DOGV = 330, DOGW = 0.9, DOGR = 30, STUN = 0.6, MANG_W = 1.0, MANG_D = 1.4, MANG_A = 58, CHARCO = 5, PUSH = 150, APAG_W = 0.8, APAG_D = 2.6, OLLA_R = 30, OLLA_V = 5.5;
var INK = '#14101c';
var PAL = {
  1: { pared: '#f3e3c3', pared2: '#e8cf9f', piso: '#d9b98a', piso2: '#c9a574', sofa: '#c0503c', luz: 0 },
  2: { pared: '#e9b98a', pared2: '#d89a6a', piso: '#b98a62', piso2: '#a67a55', sofa: '#9a3f4a', luz: 0 },
  3: { pared: '#3a3a6a', pared2: '#2c2c56', piso: '#5a4a56', piso2: '#4c3f4b', sofa: '#5a3a6a', luz: 1 }
};
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }

FIESTA.LIVE.add('f_chancla', {
  name: '¡LLUEVEN CHANCLAS!', modos: ['ffa'], clase: 'survival', modelo: 'B', dur: 45,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
  cuerpo: ['x', 'y', 'vd', 'mesa', 'st', 'sc'], discretos: ['vd', 'mesa', 'st', 'sc'],
  carta: {
    obj: 'Esquiva las chanclas de mamá. Al segundo chancletazo, ¡fuera!',
    gana: 'El último en pie. Si quedan varios, empatan arriba.',
    como: { tactil: 'Joystick para moverte · A para meterte bajo la mesa', teclado: 'WASD o flechas · ESPACIO' },
    roles: null,
    demos: [
      { id: 'mover', txt: 'Sal de la sombra roja antes de que caiga la chancla' },
      { id: 'saltar', txt: 'Sin salida: A te mete bajo la mesa 0,6 s' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], rng = c.rng;
    var lead = Math.min(2.6, 0.2 * dur), i;
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };

    /* ───── el mundo: calendario de chanclas, idéntico en todos (solo c.rng, solo aquí) ───── */
    /* fases: F1 calma, F2 desde el 33 % del tiempo de juego, F3 «¡ÚLTIMOS SEGUNDOS!» el último ~30 % */
    var jug = Math.max(1, dur - lead), P2 = lead + jug * 0.33, P3 = lead + jug * 0.70;
    function fase(t) { return t >= P3 ? 3 : t >= P2 ? 2 : 1; }
    var lanz = [], tv = lead, base = [1.25, 1.0, 0.82][lv - 1];
    function ch(T, x, y, by, w, r, k) { return { T: T, x: cl(x, 22, AW - 22), y: cl(y, 18, AH - 14), by: by, w: w, r: r, k: k, rob: 0 }; }
    while (tv < dur - 0.8) {
      var fz = fase(tv + WARN), u = Math.min(1, (tv - lead) / jug), j, x, y;
      var k = (lv === 1 ? 2 : 3) + (fz - 1), rr0 = rng.next(), rowY = 30 + rng.next() * (AH - 60), rowX = 40 + rng.next() * (AW - 80), rb = rng.next();
      var by = fz === 1 ? -1 : fz === 2 ? (rb < 0.5 ? -1 : -2) : (rb < 0.34 ? -1 : rb < 0.67 ? -2 : -3);
      if (fz === 3 && rr0 < 0.3) {                                    // BARRIDA: fila (o columna) de chanclas con UN hueco, cae de un lado al otro
        var col = rng.next() < 0.35, nb = col ? 4 : 7, hueco = Math.floor(rng.next() * nb), sent = rng.next() < 0.5;
        for (j = 0; j < nb; j++) {
          if (j === hueco) continue;
          var jj = sent ? j : nb - 1 - j;
          if (col) { x = rowX; y = 34 + j * (AH - 60) / (nb - 1); } else { x = 40 + j * (AW - 80) / (nb - 1); y = rowY; }
          lanz.push(ch(tv + WARN + 0.15 + jj * 0.08, x, y, by, WARN + 0.15, R, 'b'));
        }
        tv += 0.35;
      } else {
        var pat = rr0 > 0.75;
        for (j = 0; j < k; j++) {
          if (pat) { x = rowX + (j - (k - 1) / 2) * 2 * R * 0.95; y = rowY; } else { x = 26 + rng.next() * (AW - 52); y = 20 + rng.next() * (AH - 34); }
          var sp = fz >= 2 ? rng.next() : 1, T0 = tv + WARN + j * 0.1 + rng.next() * 0.06;
          if (sp < 0.13) lanz.push(ch(T0 + 0.3, x, y, by, WARN + 0.3, R * GIG, 'g'));            // CHANCLÓN: más grande, más aviso
          else if (sp < 0.27) {                                                                 // REBOTONA: cae y rebota a otra sombra
            var a1 = ch(T0, x, y, by, WARN, R, 'r'), dx2 = (rng.next() < 0.5 ? -1 : 1) * (70 + rng.next() * 60), dy2 = (rng.next() * 2 - 1) * 60;
            var a2 = ch(T0 + 0.6, a1.x + dx2, a1.y + dy2, by, 0.6, R, 'r2'); a2.fx = a1.x; a2.fy = a1.y;
            lanz.push(a1); lanz.push(a2);
          } else lanz.push(ch(T0, x, y, by, WARN, R, 'n'));
        }
      }
      tv += base * (fz === 1 ? 1.1 : fz === 2 ? 0.95 : 0.64) * (1 - 0.15 * u);
    }
    lanz.sort(function (a, b) { return a.T - b.T; });
    /* eventos del patio: el perro, la manguera, el apagón (desde F2; más seguidos en F3) */
    var EVS = [], tiposE = ['perro', 'manguera', 'apagon'], te = Math.max(lead + 1.5, P2 - 0.6), gapE = Math.max(2.6, jug * 0.15), ie = 0;
    if (rng.next() < 0.5) tiposE = ['manguera', 'perro', 'apagon'];                // el apagón nunca de primero (es de F2 en adelante); cada 3 eventos salen los 3
    while (te < dur - 1.6) {
      var kE = tiposE[ie % 3]; ie++;
      if (kE === 'apagon' && fase(te) < 2) kE = 'perro';
      if (kE === 'perro') { var dir = rng.next() < 0.5 ? 1 : -1; EVS.push({ k: 'perro', t0: te, tw: te - DOGW, y: 36 + rng.next() * (AH - 70), dir: dir, xs: dir > 0 ? -40 : AW + 40, t1: te + (AW + 80) / DOGV }); }
      else if (kE === 'manguera') EVS.push({ k: 'manguera', t0: te, tw: te - MANG_W, x: MANG_A + 20 + rng.next() * (AW - 2 * MANG_A - 40), t1: te + MANG_D + CHARCO });
      else EVS.push({ k: 'apagon', t0: te, tw: te - APAG_W, t1: te + APAG_D });
      te += gapE * (fase(te) === 3 ? 0.7 : 1) * (0.85 + rng.next() * 0.3);
    }
    /* el perro se roba las chanclas de su fila que todavía no han caído cuando él pasa */
    function robar(a) {
      for (var e = 0; e < EVS.length; e++) {
        var ev = EVS[e]; if (ev.k !== 'perro' || Math.abs(a.y - ev.y) > 48) continue;
        var td = ev.t0 + Math.abs(a.x - ev.xs) / DOGV;
        if (td >= a.T - a.w && td <= a.T) { a.rob = td; return; }
      }
    }
    for (i = 0; i < lanz.length; i++) robar(lanz[i]);
    /* las ollas (casco de un chancletazo) */
    var OLLAS = [], to = Math.max(lead + 1, P2 - 3), gapO = Math.max(4, jug * 0.26);
    while (to < dur - 2) { OLLAS.push({ t0: to, t1: to + OLLA_V, x: 50 + rng.next() * (AW - 100), y: 30 + rng.next() * (AH - 60), tom: -1 }); to += gapO * (fase(to) === 3 ? 0.75 : 1); }
    function dogX(ev, t) { return ev.xs + ev.dir * DOGV * (t - ev.t0); }
    function enCharco(x, t) { for (var e = 0; e < EVS.length; e++) { var ev = EVS[e]; if (ev.k === 'manguera' && t >= ev.t0 && t < ev.t1 && Math.abs(x - ev.x) < MANG_A) return true; } return false; }
    function chorro(x, t) { for (var e = 0; e < EVS.length; e++) { var ev = EVS[e]; if (ev.k === 'manguera' && t >= ev.t0 && t < ev.t0 + MANG_D && Math.abs(x - ev.x) < MANG_A) return true; } return false; }
    function evActivo(kk, t, conAviso) { for (var e = 0; e < EVS.length; e++) { var ev = EVS[e]; if (ev.k === kk && t >= (conAviso ? ev.tw : ev.t0) && t < ev.t1) return ev; } return null; }
    var teleT = lv >= 3 ? [Math.max(lead + 3, 0.45 * dur), Math.max(lead + 8, 0.75 * dur)] : [];
    if (dur < 20) teleT = teleT.slice(0, 1);
    var hash = 7; for (i = 0; i < lanz.length; i++) hash = (Math.imul(hash ^ Math.round(lanz[i].T * 1000) ^ Math.round(lanz[i].x) * 31 ^ Math.round(lanz[i].y) * 997, 16777619)) >>> 0;
    var nplafs = lanz.length;

    /* ───── estado ───── */
    var P = [], cpuR = [], plan = [];
    for (i = 0; i < n; i++) {
      P.push({ x: AW * (0.2 + 0.6 * (i + 0.5) / n), y: AH * 0.55, vd: 2, mesa: 0, st: 0, sc: 0, tm: -9, inv: -9, jt: -9, own: false, shotAt: 0, hurt: -9, outAt: -9, aimx: AW / 2, aimy: AH / 2, mood: 0, olla: 0, stun: -9, vx: 0, vy: 0 });
      cpuR.push(c.rngFor('cpu' + i)); plan.push({ dir: 0, re: -9, tia: null });
    }
    var tele = [], teleSent = [], absT = 0, banner = null, banT = 0, shake = 0, mamT = -9, plafs = [], lastVol = -1;
    var cp = function () { return c.campo(); };
    function geom() { var f = cp(); return { ox: (f.x0 + f.x1) / 2 - AW / 2, oy: 188 }; }
    function vivos() { var k = 0, p; for (p = 0; p < n; p++) if (!P[p].st) k++; return k; }
    function elim(p, kk) { var q = P[p]; if (q.st) return; q.st = 1; q.vd = 0; q.sc = Math.max(0, kk | 0); q.outAt = c.ahora(); q.mesa = 0; q.x = cl(q.x, 20, AW - 20); q.aimx = q.x; q.aimy = q.y; }
    function aim(p) { var q = P[p]; return { x: q.aimx, y: q.aimy }; }
    function lider() { var b = -1, bs = -1, p; for (p = 0; p < n; p++) if (!P[p].st) { var s = P[p].vd * 10 - P[p].hurt * 0.001 + (n - p) * 0.01; if (s > bs) { bs = s; b = p; } } return b; }

    /* ───── chanclas que andan (calendario + tías + teledirigida) ───── */
    function teleState(t, now) {            // posición de la sombra teledirigida en `now` (cada pantalla la integra con su vista del blanco)
      var tau = now - t.tl;
      if (tau < 0) return null;
      if (!t.sim) t.sim = { x: AW / 2, y: 0, at: t.tl };
      var s = t.sim, tgt = P[t.to];
      while (s.at < now - 1e-9 && s.at - t.tl < TELE_CRAWL) {
        var dt = Math.min(1 / 60, now - s.at), dx = tgt.x - s.x, dy = tgt.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        s.x += dx / d * TELE_V * dt; s.y += dy / d * TELE_V * dt; s.at += dt;
      }
      s.at = Math.max(s.at, Math.min(now, t.tl + TELE_CRAWL));
      return { x: s.x, y: s.y, vivo: tau < TELE_T + 0.4, aterriza: tau >= TELE_T };
    }
    function juzga(p, now) {
      var q = P[p], pr = q.jt, a, T;
      q.jt = now;
      if (q.st || pr < -5) return;
      for (a = 0; a < lanz.length; a++) {
        T = lanz[a].T;
        if (T > pr && T <= now && !lanz[a].rob) golpe(p, lanz[a].x, lanz[a].y, T, lanz[a].r);
        else if (T > now) { if (T > now + 1.2) break; }
      }
      for (a = 0; a < extras.length && !q.st; a++) { T = extras[a].T; if (T > pr && T <= now && !extras[a].rob) golpe(p, extras[a].x, extras[a].y, T, R); }
      for (a = 0; a < tele.length && !q.st; a++) {
        var t = tele[a]; if (t.to !== p || t.fin) continue;
        var tt = t.tl + TELE_T;
        if (tt > pr && tt <= now) { var sp = teleState(t, tt); t.fin = 1; if (sp) golpe(p, sp.x, sp.y, tt, R); }
      }
    }
    function golpe(p, cx, cy, T, r) {
      var q = P[p]; if (q.st) return;
      if (T < q.inv) return;                                           // inmune tras el golpe
      if (T >= q.tm && T <= q.tm + MESA) return;                        // bajo la mesa
      var dx = q.x - cx, dy = (q.y - cy) * 1.1;
      if (Math.sqrt(dx * dx + dy * dy) >= (r || R) + BODY) return;
      q.inv = T + INV; var kk = Math.floor(T * 30);
      if (q.olla) { q.olla = 0; c.ev('hit', { k: kk, x: Math.round(cx), y: Math.round(cy), ol: 1 }, p); return; }   // la olla para el chancletazo
      c.ev('hit', { k: kk, x: Math.round(cx), y: Math.round(cy) }, p);       // eco local -> onEv aplica la vida
      if (q.vd <= 0) c.out(p, kk);
    }

    /* ───── movimiento ───── */
    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        q.own = false;
        var r = c.remoto(p);
        if (r) { q.x = r.x; q.y = r.y; if (!q.st) { q.mesa = r.mesa; if (r.vd < q.vd) q.vd = r.vd; } if (r.st && !q.st) elim(p, r.sc); }
        return;
      }
      if (!q.own) { q.own = true; q.jt = Math.max(q.jt, now - 0.001); }
      var e = c.eje(p), taps = c.tap(p, 'a');
      if (q.st) {                                                      // tía chismosa: mira
        q.aimx = cl(q.aimx + e.x * 230 * dt, 10, AW - 10); q.aimy = cl(q.aimy + e.y * 230 * dt, 10, AH - 10); q.x = q.aimx; q.y = q.aimy;
        if (taps > 0 && lv >= 2 && now >= q.shotAt && now >= 0 && vivos() > 0) tiro(p, q.aimx, q.aimy, now);
        return;
      }
      if (now < 0) return;
      var mesa = now >= q.tm && now <= q.tm + MESA, stun = now < q.stun, a, ev;
      q.mesa = mesa ? 1 : 0;
      if (!mesa) {
        var tx = stun ? 0 : e.x * SPD, ty = stun ? 0 : e.y * SPD;
        if (enCharco(q.x, now)) { var kf = Math.min(1, 2.6 * dt); q.vx += (tx - q.vx) * kf; q.vy += (ty - q.vy) * kf; }   // charco: resbala
        else { q.vx = tx; q.vy = ty; }
        q.x = cl(q.x + q.vx * dt, 20, AW - 20); q.y = cl(q.y + (q.vy + (chorro(q.x, now) ? PUSH : 0)) * dt, 20, AH - 8);   // el chorro te arrastra hacia adelante
      } else { q.vx = 0; q.vy = 0; }
      if (taps > 0 && !stun && now >= q.tm + MCD) { q.tm = now; q.mesa = 1; mesa = true; if (p === c.yo && !v3) SND(300, 0.12, 'triangle', 0.05); }
      if (!mesa && !stun) for (a = 0; a < EVS.length; a++) {             // el perro: si te pasa por encima te tumba (bajo la mesa no)
        ev = EVS[a]; if (ev.k !== 'perro' || now < ev.t0 || now >= ev.t1) continue;
        if (Math.abs(q.x - dogX(ev, now)) < DOGR && Math.abs(q.y - ev.y) < 26) {
          q.stun = now + STUN; q.vx = ev.dir * 140;
          if (p === c.yo) { var ps = sobre(p, 4.4); S('¡EL PERRO TE TUMBÓ!', ps.x, ps.y, '#ffd23f'); }
          if (v3) tumbo3D(p);
        }
      }
      if (!q.olla) for (a = 0; a < OLLAS.length; a++) {                  // la olla: la agarras pasando por encima
        var ol = OLLAS[a]; if (ol.tom >= 0 || now < ol.t0 || now >= ol.t1) continue;
        var odx = q.x - ol.x, ody = (q.y - ol.y) * 1.1;
        if (odx * odx + ody * ody < (OLLA_R + BODY) * (OLLA_R + BODY)) { ol.tom = p; q.olla = 1; c.ev('olla', { i: a }, p); break; }
      }
      juzga(p, now);
    }
    function tiro(p, x, y, now) {                                       // la tía lanza: cae 1 s después, anunciado por ev fiable
      var q = P[p]; q.shotAt = now + (lv >= 3 ? 2.6 : 3.4) * (fase(now) === 3 ? 0.6 : 1);   // en los últimos segundos las tías lanzan más seguido
      c.ev('shot', { x: Math.round(x), y: Math.round(y), tl: Math.round((now + 1.0) * 1000) }, p);
    }

    /* ───── IA ───── */
    function aiVivo(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], rt = RT0 - RT1 * sk, th = [], a, d;
      if (now < 0) return;
      for (a = 0; a < lanz.length; a++) { var T = lanz[a].T, w = lanz[a].w; if (lanz[a].rob) continue; if (T >= now - 0.02 && T - w + rt <= now && T <= now + w + 0.1) th.push(lanz[a]); else if (T > now + 2) break; }
      for (a = 0; a < EVS.length; a++) {
        var ev = EVS[a];
        if (ev.k === 'perro' && now >= ev.tw + rt && now < ev.t1 && (dogX(ev, now) - q.x) * ev.dir < DOGR) th.push({ T: now + 0.6, x: q.x, y: ev.y, r: 30, fila: 1 });
        else if (ev.k === 'manguera' && now >= ev.tw + rt && now < ev.t0 + MANG_D) th.push({ T: now + 0.5, x: ev.x, y: q.y, r: MANG_A + 8, col: 1 });
      }
      for (a = 0; a < extras.length; a++) { var Te = extras[a].T; if (Te >= now - 0.02 && Te - 1.0 + rt <= now && Te <= now + 1.1) th.push(extras[a]); }
      for (a = 0; a < tele.length; a++) { var tt = tele[a]; if (tt.to === p && !tt.fin) { var st = teleState(tt, Math.min(now, tt.tl + TELE_CRAWL)); if (st && now >= tt.tl + rt) th.push({ T: tt.tl + TELE_T, x: st.x, y: st.y }); } }
      if (!th.length) {                                                 // sin amenazas: a la olla si hay una cerca, si no al centro de su zona con holgura
        var hx = AW * (0.18 + 0.64 * (p + 0.5) / n), hy = AH * 0.55, ob = 260;
        if (!q.olla) for (a = 0; a < OLLAS.length; a++) { var ol = OLLAS[a]; if (ol.tom < 0 && now >= ol.t0 + rt && now < ol.t1 - 0.3) { var od = Math.abs(ol.x - q.x) + Math.abs(ol.y - q.y); if (od < ob) { ob = od; hx = ol.x; hy = ol.y; } } }
        var ex = hx - q.x, ey = hy - q.y;
        api.eje(Math.abs(ex) > 24 ? (ex > 0 ? 1 : -1) : 0, Math.abs(ey) > 24 ? (ey > 0 ? 1 : -1) : 0); return;
      }
      if (now < pl.re) { var dd0 = DIRS[pl.dir]; api.eje(dd0[0], dd0[1]); }
      else {
        var bd = 0, bs = -1e9, errx = (R2.next() * 2 - 1) * (E0 - E1 * sk), erry = (R2.next() * 2 - 1) * (E0 - E1 * sk);
        for (d = 0; d < DIRS.length; d++) {
          var sc = 1e9, v = DIRS[d];
          for (a = 0; a < th.length; a++) {
            var dtl = Math.max(0, Math.min(th[a].T - now, 0.7)), px = cl(q.x + v[0] * SPD * dtl, 20, AW - 20), py = cl(q.y + v[1] * SPD * dtl, 20, AH - 8);
            var cx = px - th[a].x + errx, cy = (py - th[a].y + erry) * 1.1, cr;
            if (th[a].fila) cr = Math.abs(cy) - th[a].r; else if (th[a].col) cr = Math.abs(cx) - th[a].r; else cr = Math.sqrt(cx * cx + cy * cy) - ((th[a].r || R) + BODY);
            if (cr < sc) sc = cr;
          }
          sc += (d === 0 ? 0 : -0.1) + R2.next() * 0.2 - Math.abs(cl(px0(q, v), 0, AW) - AW / 2) * 0.002;
          if (sc > bs) { bs = sc; bd = d; }
        }
        pl.dir = bd; pl.re = now + 0.12; pl.last = bs;
        var dv = DIRS[bd]; api.eje(dv[0], dv[1]);
        if (bs < 2 && now >= q.tm + MCD) {                              // sin salida: a la mesa (para cubrir el instante de caída)
          var Tn = 9, b;
          for (b = 0; b < th.length; b++) if (th[b].T > now && th[b].T < Tn) Tn = th[b].T;
          if (Tn - now < MESA - 0.12 && Tn - now > 0.05 && R2.next() < 0.25 + 0.7 * sk) api.press('a');
        }
      }
    }
    function px0(q, v) { return q.x + v[0] * 40; }
    var DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    var extras = [];
    function aiTia(p, dt, api, now) {
      var q = P[p], R2 = cpuR[p], sk = c.skill[p], pl = plan[p], a;
      if (lv < 2 || now < 0 || vivos() < 1) { api.eje(0, 0); return; }
      if (!pl.tia || now > pl.re) {
        var cand = [];
        for (a = 0; a < n; a++) if (!P[a].st) cand.push(a);
        var tg = cand[Math.floor(R2.next() * cand.length)], err = (60 - 40 * sk);
        pl.tia = { x: cl(P[tg].x + (R2.next() * 2 - 1) * err, 10, AW - 10), y: cl(P[tg].y + (R2.next() * 2 - 1) * err, 10, AH - 10) }; pl.re = now + 0.7 + R2.next() * 0.8;
      }
      var dx = pl.tia.x - q.aimx, dy = pl.tia.y - q.aimy;
      api.eje(Math.abs(dx) > 12 ? (dx > 0 ? 1 : -1) : 0, Math.abs(dy) > 12 ? (dy > 0 ? 1 : -1) : 0);
      if (Math.abs(dx) <= 16 && Math.abs(dy) <= 16 && now >= q.shotAt && R2.next() < 0.15 + 0.2 * sk) api.press('a');
    }

    /* ───── dibujo ───── */
    function px(x) { return geom().ox + x; }
    function chancla(x, y, ang, s, col) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
      rr(-20, -8, 40, 16, 8, col || '#3fa9ff', 3);
      poly([[-6, -7], [6, -7], [0, 5]], '#fffdf2', 2.5);
      ctx.restore();
    }
    function fondo(f, G) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, k;
      rr(x0, 0, w, 330, 0, pal.pared, 0); rr(x0, 150, w, 180, 0, pal.pared2, 0);
      /* ventana, cuadro y la nevera abierta */
      var wx = x0 + w * 0.2; rr(wx - 50, 96, 100, 70, 6, lv === 3 ? '#16183a' : '#8fd8ff', 3.5); line([[wx, 96], [wx, 166]], 3, INK); line([[wx - 50, 131], [wx + 50, 131]], 3, INK);
      if (lv === 3) { ell(wx - 20, 114, 2, 2, '#fffdf2', 0); ell(wx + 26, 120, 2, 2, '#fffdf2', 0); }
      rr(x1 - 150, 84, 74, 92, 6, '#e8e8f2', 3.5); rr(x1 - 144, 90, 62, 80, 4, '#fffdf2', 2.5); txt('¡CIERRA!', x1 - 113, 130, 11, '#c4283a', 0, true);
      rr(x0 + w * 0.5 - 130, 92, 54, 40, 4, pal.sofa, 3); ell(x0 + w * 0.5 - 103, 112, 10, 10, '#ffe14d', 2);
      /* piso */
      rr(x0, G.oy - 20, w, AH + 90, 0, pal.piso, 0);
      for (k = 0; k < 14; k++) rr(G.ox - 8 + (k % 2) * 0, G.oy - 10 + k * 22, AW + 16, 2, 0, pal.piso2, 0);
      for (k = 0; k < 11; k++) line([[G.ox - 8 + k * 56, G.oy - 12], [G.ox - 8 + k * 56, G.oy + AH + 10]], 1.5, pal.piso2);
      /* sofá a la izquierda como borde del escenario */
      rr(x0 + 10, G.oy + 30, Math.max(40, G.ox - x0 - 30), 120, 14, pal.sofa, 3.5);
    }
    function mama(G, now) {
      var mx = G.ox + AW / 2, my = G.oy - 104, rec = Math.max(0, 1 - (now - mamT) / 0.35);
      c.util.pj('mama', mx, my - 6, 70, { animo: rec > 0 ? 'celebrar' : null, sombra: false });
      if (typeof hand === 'function') hand(mx + 44, my - 2 - rec * 34, -0.7 - rec * 1.2, 0.8, '#e8b48a');
      chancla(mx + 52, my - 34 - rec * 30, -0.6 + rec * 1.4, 1, '#3fa9ff');
      rr(G.ox - 40, G.oy - 52, AW + 80, 56, 8, lv === 3 ? '#4a4a7a' : '#b9855a', 3.5);        // la barra de la cocina tapa a mamá hasta la cintura
      rr(G.ox - 34, G.oy - 52, AW + 68, 8, 4, lv === 3 ? '#6a6a9a' : '#e0c090', 2.5);
      txt(now < 3.2 && !c.practica ? '¿¡QUIÉN DEJÓ LA NEVERA ABIERTA!?' : '', mx, my - 70, 17, '#c4283a', 0, true);
    }
    function persona(p, x, y, vd, mesa, now) {
      var s = asiento(p), col = s.color || '#ffd23f', q = P[p];
      var blink = now < q.inv && Math.floor(absT * 14) % 2;
      ctx.save(); ctx.globalAlpha = blink ? 0.45 : (mesa ? 0.55 : 1);
      ell(x, y + 3, 20, 6, INK, 0);
      rr(x - 11, y - 26, 8, 24, 4, '#2f3a7a', 3); rr(x + 3, y - 26, 8, 24, 4, '#2f3a7a', 3);
      rr(x - 15, y - 62, 30, 38, 10, col, 3.5);
      c.util.pj(s.ch, x, y - 78, 62, { animo: q.hurt > now - 0.5 ? 'perder' : null, sombra: false });
      ctx.restore();
      if (mesa) { rr(x - 30, y - 52, 60, 12, 4, '#c98a4a', 3.5); rr(x - 26, y - 40, 6, 34, 2, '#8a5a2a', 2.5); rr(x + 20, y - 40, 6, 34, 2, '#8a5a2a', 2.5); }
      for (var h = 0; h < 2; h++) chancla(x - 10 + h * 20, y - 112, 0, 0.42, h < vd ? '#3fa9ff' : '#9a98a8');
      if (p === c.yo) poly([[x - 8, y - 132], [x + 8, y - 132], [x, y - 120]], '#ffd23f', 3);
    }

    /* ───── 3D low poly (fiesta-3d.js): el patio de la casa de mamá. Solo dibujo: lee P, lanz, extras, tele y los eventos; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var ESX = 1 / 18, ESZ = 1.15 / 18;                                          // px de la simulación -> metros (z con el 1,1 del golpe, redondeado)
    function WX(x) { return (x - AW / 2) * ESX; }
    function WZ(y) { return (y - AH / 2) * ESZ; }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', pared: '#f3e3c3', zoc: '#3fae8a', piso: '#d98a5a', junta: '#b86a42', grama: '#7cc65a', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', pared: '#e9b98a', zoc: '#2f8a6a', piso: '#c97a50', junta: '#a65a38', grama: '#6aa84a', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', pared: '#a89ac8', zoc: '#2a5a6a', piso: '#8a5a5a', junta: '#6a4048', grama: '#3a5a4a', noche: 1 }
    };
    var PORCHE_Z = -12.1, PORCHE_Y = .5, MAMA_Z = -11.4;
    var SILLAS = [-9, -11.6, -14.2, -16.8];                                     // mecedoras del porche: ahí se sientan las tías chismosas
    var ROPA = ['#ff5c8a', '#ffd23f', '#3fa9ff', '#fffdf2', '#7fd6c9', '#ff8a3d'];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 70, 160], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      V3.pista('chancla', { bpm: 156, acordes: [[57, 61, 64], [50, 54, 57], [52, 56, 59], [57, 61, 64]],      // merengue casero, I–IV–V–I en La
        mel: [76, 0, 76, 78, 76, 73, 0, 69, 71, 0, 73, 74, 0, 73, 71, 0, 76, 0, 76, 78, 81, 0, 78, 76, 74, 0, 73, 71, 69, 0, 0, 0] });
      V3.pista('chancla3', { bpm: 188, acordes: [[59, 63, 66], [52, 56, 59], [54, 58, 61], [59, 63, 66]],            // ¡ÚLTIMOS SEGUNDOS!: lo mismo un tono arriba y a millón
        mel: [78, 78, 0, 80, 78, 75, 0, 71, 73, 73, 75, 76, 0, 75, 73, 0, 78, 78, 0, 80, 83, 0, 80, 78, 76, 76, 75, 73, 71, 0, 83, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* grama alrededor y el patio de baldosas de terracota (la zona de juego) */
      var grama = M(new T.PlaneGeometry(140, 90), pl.grama, { borde: false, recibe: true, sombra: false }); grama.rotation.x = -Math.PI / 2; S3.add(grama);
      var bal = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.junta; x.fillRect(0, 0, w, h);
        for (var j = 0; j < 4; j++) for (var i = 0; i < 4; i++) { var sh = ((i * 5 + j * 11) % 4) / 4; x.fillStyle = V3.oscurecer(pl.piso, .92 + sh * .12); x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58); }
      }, [9, 5]);
      var pw = AW * ESX + 2.4, pd = AH * ESZ + 2.2;
      var patio = new T.Mesh(new T.PlaneGeometry(pw, pd), new T.MeshToonMaterial({ map: bal, gradientMap: V3.toon('#fff').gradientMap }));
      patio.rotation.x = -Math.PI / 2; patio.position.y = .02; patio.receiveShadow = true; S3.add(patio);
      var brocal = M(new T.BoxGeometry(pw + .5, .14, pd + .5), V3.oscurecer(pl.junta, .8), { borde: false, recibe: true }); brocal.position.y = -.05; S3.add(brocal);
      /* la casa: pared con zócalo, ventanas con reja, puerta, alero de tejas y el porche donde manda mamá */
      var pared = M(new T.BoxGeometry(46, 7.5, 1), pl.pared, { recibe: true, g: .015 }); pared.position.set(0, 3.75, -14.8); S3.add(pared);
      var zoc = M(new T.BoxGeometry(46.05, 1.1, 1.05), pl.zoc, { borde: false, recibe: true }); zoc.position.set(0, 1.05, -14.8); S3.add(zoc);
      var alero = M(new T.BoxGeometry(47, .35, 2.6), '#c4563a', { g: .02 }); alero.position.set(0, 7.2, -13.6); alero.rotation.x = -.18; S3.add(alero);
      var cortinas = [];
      [-15, -6.5, 12.5, 19].forEach(function (vx) {
        var vi = M(new T.BoxGeometry(2.4, 2.4, .15), pl.noche ? '#ffd36a' : '#8fc8ee', { g: .03, em: pl.noche ? '#ffb030' : '#bfe6ff', emI: pl.noche ? .9 : .35 }); vi.position.set(vx, 3.6, -14.25); S3.add(vi);
        var va = M(new T.BoxGeometry(2.8, .1, .1), '#5a3a1a', { borde: false }); va.position.set(vx, 5.0, -14.05); S3.add(va);
        [-1, 1].forEach(function (sd) { var cg = new T.Group(); cg.position.set(vx + sd * 1.5, 4.95, -14.05); S3.add(cg); var cu = M(new T.BoxGeometry(.62, 2.7, .05), sd < 0 ? '#ffd23f' : '#ff8a5a', { borde: false }); cu.position.y = -1.35; cg.add(cu); cortinas.push({ g: cg, f: vx * .3 + sd }); });
        for (var b = 0; b < 5; b++) { var rj = M(new T.BoxGeometry(.08, 2.5, .08), '#2a2a34', { borde: false }); rj.position.set(vx - 1 + b * .5, 3.6, -14.05); S3.add(rj); }
        var mc = M(new T.BoxGeometry(2.8, .2, .4), '#fffdf2', { borde: false }); mc.position.set(vx, 2.3, -14.1); S3.add(mc);
      });
      /* la puerta de la casa, abierta: se ve el cuarto con la tele prendida */
      var cuarto = new T.Mesh(new T.PlaneGeometry(1.9, 3.5), new T.MeshBasicMaterial({ color: pl.noche ? 0xffc070 : 0xe8b27a })); cuarto.position.set(2.5, 2.3, -14.22); S3.add(cuarto);
      var tvv = new T.Mesh(new T.PlaneGeometry(.8, .5), new T.MeshBasicMaterial({ color: 0x9fd0ff })); tvv.position.set(3.0, 1.9, -14.2); S3.add(tvv);
      var tvm = M(new T.BoxGeometry(.9, .6, .05), '#14101c', { borde: false }); tvm.position.set(3.0, 1.9, -14.23); S3.add(tvm);
      [[1.55, 2.3, 4.0, .16], [3.45, 2.3, 4.0, .16]].forEach(function (jb) { var jm = M(new T.BoxGeometry(jb[3], 3.7, .3), '#7a4a2a', { g: .03 }); jm.position.set(jb[0], jb[1] + .05, -14.2); S3.add(jm); });
      var din = M(new T.BoxGeometry(2.1, .2, .3), '#7a4a2a', { g: .03 }); din.position.set(2.5, 4.2, -14.2); S3.add(din);
      var hoja = new T.Group(); hoja.position.set(1.62, 2.3, -14.1); hoja.rotation.y = -1.25; S3.add(hoja);
      var hj = M(new T.BoxGeometry(1.8, 3.5, .1), '#8a5a30', { g: .03 }); hj.position.x = .9; hoja.add(hj);
      var pom = M(new T.SphereGeometry(.08, 6, 5), '#ffd23f', { borde: false }); pom.position.set(1.6, -.1, .08); hoja.add(pom);
      var porche = M(new T.BoxGeometry(46, PORCHE_Y, 4.6), '#b8503a', { recibe: true, g: .02 }); porche.position.set(0, PORCHE_Y / 2, PORCHE_Z); S3.add(porche);
      var escalon = M(new T.BoxGeometry(46, .25, .7), '#c9a576', { recibe: true, borde: false }); escalon.position.set(0, .125, PORCHE_Z + 2.6); S3.add(escalon);
      /* la nevera abierta (el origen de todo) */
      var nev = new T.Group(); nev.position.set(7, PORCHE_Y, -13.2); S3.add(nev);
      var nc = M(new T.BoxGeometry(1.7, 3.2, 1.3), '#e8e8f2', { g: .03 }); nc.position.y = 1.6; nev.add(nc);
      var nin = new T.Mesh(new T.PlaneGeometry(1.4, 2.9), tn('#fff6c0', { em: '#fff2a0', emI: 1.2 })); nin.position.set(0, 1.6, .66); nev.add(nin);
      var bis = new T.Group(); bis.position.set(.85, 0, .65); nev.add(bis);
      var npu = M(new T.BoxGeometry(1.7, 3.2, .15), '#e8e8f2', { g: .03 }); npu.position.set(.85, 1.6, 0); bis.add(npu); bis.rotation.y = -1.9;
      /* adentro de la nevera: repisas con leche, huevos, queso, tomates y el jugo; y la luz que se derrama por el piso */
      [.7, 1.5, 2.3].forEach(function (sy) { var rp = M(new T.BoxGeometry(1.4, .06, .3), '#cfd6e0', { borde: false }); rp.position.set(0, sy, .75); nev.add(rp); });
      var comida = [[-.45, .95, '#fffdf2', .22, .4, .2], [-.1, .9, '#f1d9a0', .3, .22, .2], [.35, .93, '#ffd23f', .3, .3, .22], [-.4, 1.7, '#e0402a', .2, .2, .2], [-.05, 1.72, '#e0402a', .2, .2, .2], [.4, 1.78, '#ff8a3d', .22, .5, .22], [-.35, 2.5, '#7fd6c9', .5, .3, .24], [.3, 2.52, '#c4283a', .3, .35, .22]];
      comida.forEach(function (cm2) { var it = M(new T.BoxGeometry(cm2[3], cm2[4], cm2[5]), cm2[2], { borde: false }); it.position.set(cm2[0], cm2[1], .78); nev.add(it); });
      var abanico = new T.Mesh(new T.CircleGeometry(5.2, 16, -Math.PI / 2 - .7, 1.4), new T.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: .2, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      abanico.rotation.x = -Math.PI / 2; abanico.position.set(7.3, PORCHE_Y + .04, -12.55); S3.add(abanico);
      /* ───── la cocina de la casa: estufa con olla, budare con arepas y la greca; campana; mesón con fregadero; estante, reloj, calendario y cuadros ───── */
      function cj(pad, w, h, d, col, x, y, z, op) { var m = M(new T.BoxGeometry(w, h, d), col, op || { g: .03 }); m.position.set(x, y, z); pad.add(m); return m; }
      function cy(pad, rt, rb, h, col, x, y, z, op, sg) { var m = M(new T.CylinderGeometry(rt, rb, h, sg || 10), col, op || { g: .03 }); m.position.set(x, y, z); pad.add(m); return m; }
      function azulejos(x, y, w, h) {
        var tx = V3.texturaCanvas(128, 128, function (cx, ww, hh) { cx.fillStyle = '#f4f1e6'; cx.fillRect(0, 0, ww, hh); cx.strokeStyle = '#9fb8c8'; cx.lineWidth = 4; cx.strokeRect(2, 2, ww - 4, hh - 4); cx.fillStyle = '#4a7ab0'; cx.fillRect(ww / 2 - 10, hh / 2 - 10, 20, 20); cx.fillStyle = '#f4f1e6'; cx.fillRect(ww / 2 - 4, hh / 2 - 4, 8, 8); }, [Math.round(w / .75), Math.round(h / .75)]);
        var pn = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshToonMaterial({ map: tx, gradientMap: tn('#fff').gradientMap })); pn.position.set(x, y, -14.27); S3.add(pn);
      }
      azulejos(-1.2, 3.1, 2.7, 1.5); azulejos(-11.8, 2.85, 4.8, 1.3);
      var est = new T.Group(); est.position.set(-1.2, PORCHE_Y, -13.55); S3.add(est);
      cj(est, 2.2, 1.7, 1.2, '#e8e8f2', 0, .85, 0, { g: .03, recibe: true });
      cj(est, 2.25, .08, 1.25, '#2a2a34', 0, 1.74, 0);
      cj(est, 1.7, .85, .06, '#cfd4de', 0, .78, .62); cj(est, 1.2, .45, .07, '#2a2a34', 0, .82, .65, { borde: false }); cj(est, 1.5, .06, .1, '#8a92a0', 0, 1.25, .69, { borde: false });
      [-.7, 0, .7].forEach(function (bx) { var pe = cy(est, .07, .07, .08, '#14101c', bx, 1.52, .63, { borde: false }, 6); pe.rotation.x = Math.PI / 2; });
      var llamas = [];
      [-.7, 0, .7].forEach(function (bx) { var an = new T.Mesh(new T.TorusGeometry(.5, .05, 5, 16), new T.MeshBasicMaterial({ color: 0xff7a2a })); an.rotation.x = Math.PI / 2; an.position.set(bx, 1.8, 0); est.add(an); llamas.push(an); });
      cy(est, .45, .42, .62, '#a8b0bc', -.7, 2.1, 0, null, 12); cy(est, .47, .47, .07, '#8a92a0', -.7, 2.45, 0, null, 12); cy(est, .07, .07, .1, '#14101c', -.7, 2.53, 0, { borde: false }, 6);
      cj(est, .2, .07, .12, '#14101c', -1.2, 2.2, 0, { borde: false }); cj(est, .2, .07, .12, '#14101c', -.2, 2.2, 0, { borde: false });
      cy(est, .46, .46, .06, '#2a2a34', 0, 1.82, 0, null, 14);
      [[-.2, -.1], [.22, .06], [-.02, .26]].forEach(function (ap) { cy(est, .17, .17, .08, '#f1d9a0', ap[0], 1.9, ap[1], null, 10); cy(est, .1, .1, .09, '#d9a860', ap[0], 1.9, ap[1], { borde: false }, 8); });
      cj(est, .55, .06, .09, '#2a2a34', 0, 1.82, .62, { borde: false });
      cy(est, .2, .27, .5, '#c4c8d0', .7, 2.07, 0, null, 8); cy(est, .2, .2, .16, '#c4c8d0', .7, 2.4, 0, null, 8); cy(est, .06, .06, .1, '#14101c', .7, 2.52, 0, { borde: false }, 6); cj(est, .3, .08, .08, '#14101c', .98, 2.1, 0, { borde: false });
      cj(S3, 2.5, .5, 1.2, '#c8ccd6', -1.2, 5.0, -13.65); cj(S3, .85, 2.4, .85, '#b8bcc8', -1.2, 6.45, -14.0); cj(S3, 1.7, .04, .9, '#fff2a0', -1.2, 4.74, -13.65, { borde: false, em: '#ffe9a0', emI: 1.2 });
      /* mesón con el fregadero, los platos, el frutero de mangos y una mata */
      var mes = new T.Group(); mes.position.set(-11.8, PORCHE_Y, -13.6); S3.add(mes);
      cj(mes, 4.4, 1.6, 1.2, '#a8734a', 0, .8, 0, { g: .03, recibe: true }); cj(mes, 4.6, .12, 1.3, '#e8dcc0', 0, 1.66, 0, { g: .03, recibe: true });
      [-1.5, -.5, .5, 1.5].forEach(function (dx) { cj(mes, .9, 1.2, .06, '#8a5a2a', dx, .8, .62, { borde: false }); cj(mes, .08, .08, .06, '#ffd23f', dx + .3, .9, .66, { borde: false }); });
      cj(mes, 1.4, .05, .8, '#b8c0cc', -.9, 1.73, 0, { borde: false }); cy(mes, .05, .05, .6, '#8a92a0', -.9, 2.0, -.35, { borde: false }, 5); cj(mes, .08, .08, .4, '#8a92a0', -.9, 2.3, -.2, { borde: false });
      [0, 1, 2].forEach(function (pi2) { var pt2 = cy(mes, .3, .3, .05, '#fffdf2', .55 + pi2 * .16, 1.95, .1, { g: .02 }, 12); pt2.rotation.z = Math.PI / 2; pt2.rotation.y = .3; });
      var fru = cy(mes, .5, .35, .22, '#c4563a', 1.7, 1.8, .05, null, 10);
      for (k = 0; k < 5; k++) { var mgo = M(new T.SphereGeometry(.22, 6, 5), k % 2 ? '#ffb030' : '#ff8a3d', { g: .04 }); mgo.position.set(1.7 + Math.cos(k * 1.3) * .22, 2.05 + (k > 2 ? .15 : 0), .05 + Math.sin(k * 1.3) * .2); mes.add(mgo); }
      cy(mes, .25, .2, .35, '#c4563a', -2.0, 1.92, -.1, null, 8); for (k = 0; k < 4; k++) { var hm = M(new T.ConeGeometry(.13, .7, 4), '#3fae4a', { borde: false }); hm.position.set(-2.0 + Math.cos(k * 1.6) * .12, 2.4, -.1 + Math.sin(k * 1.6) * .12); hm.rotation.set(Math.sin(k) * .4, k, Math.cos(k * 2) * .4); mes.add(hm); }
      /* los cacharros que cuelgan de la barra */
      var colgando = [], barra = cy(S3, .04, .04, 3.4, '#2a2a34', -11.8, 5.3, -14.0, { borde: false }, 5); barra.rotation.z = Math.PI / 2;
      [-1.2, -.4, .4, 1.2].forEach(function (dx, ii) {
        var cg2 = new T.Group(); cg2.position.set(-11.8 + dx, 5.3, -14.0); S3.add(cg2);
        cy(cg2, .015, .015, .5, '#2a2a34', 0, -.25, 0, { borde: false }, 4);
        if (ii === 0) { var sa = cy(cg2, .36, .36, .05, '#2a2a34', 0, -.9, 0, null, 14); sa.rotation.x = Math.PI / 2; cj(cg2, .1, .6, .06, '#2a2a34', 0, -.5, 0, { borde: false }); }
        else if (ii === 1) { cy(cg2, .05, .05, .9, '#8a5a2a', 0, -.8, 0, { borde: false }, 5); var cu2 = M(new T.SphereGeometry(.22, 8, 6), '#b8c0cc', { g: .04 }); cu2.position.y = -1.3; cu2.scale.y = .6; cg2.add(cu2); }
        else if (ii === 2) { cy(cg2, .3, .27, .42, '#c4563a', 0, -.85, 0, null, 10); cy(cg2, .32, .32, .05, '#e8dcc0', 0, -.62, 0, { borde: false }, 10); }
        else { cy(cg2, .04, .04, .9, '#8a5a2a', 0, -.8, 0, { borde: false }, 5); cj(cg2, .3, .5, .06, '#8a5a2a', 0, -1.4, 0, { borde: false }); }
        colgando.push({ g: cg2, f: ii * 1.3 });
      });
      /* estante con harina PAN, café, azúcar y frascos; reloj, calendario, retratos y una banderita */
      cj(S3, 2.0, .12, .55, '#8a5a2a', 9.9, 4.4, -14.0); cj(S3, 2.0, .12, .55, '#8a5a2a', 9.9, 3.5, -14.0);
      [[9.2, 4.78, .42, .7, '#ffe14d'], [9.7, 4.78, .42, .7, '#ffe14d'], [10.4, 4.7, .4, .55, '#fffdf2']].forEach(function (b2) { cj(S3, b2[2], b2[3], .24, b2[4], b2[0], b2[1], -14.0, { g: .03 }); if (b2[4] === '#ffe14d') cj(S3, b2[2] + .01, .14, .26, '#c4283a', b2[0], b2[1] + .05, -14.0, { borde: false }); });
      cy(S3, .2, .2, .5, '#c4283a', 10.95, 4.71, -14.0, null, 10);
      [[9.2, '#e0402a'], [9.7, '#3fae4a'], [10.2, '#ffd23f'], [10.7, '#e0402a']].forEach(function (jr) { cy(S3, .17, .17, .45, jr[1], jr[0], 3.78, -14.0, { g: .03 }, 8); cy(S3, .12, .12, .08, '#14101c', jr[0], 4.05, -14.0, { borde: false }, 6); });
      var reloj = new T.Group(); reloj.position.set(2.5, 5.5, -14.2); S3.add(reloj);
      var rc = cy(reloj, .55, .55, .1, '#fffdf2', 0, 0, 0, null, 18); rc.rotation.x = Math.PI / 2; var rb = cy(reloj, .6, .6, .06, '#c4283a', 0, 0, -.02, { borde: false }, 18); rb.rotation.x = Math.PI / 2;
      cj(reloj, .05, .3, .03, '#14101c', 0, .12, .07, { borde: false }); var minu = new T.Group(); minu.position.z = .08; reloj.add(minu); cj(minu, .04, .42, .03, '#14101c', 0, .2, 0, { borde: false });
      cj(S3, .95, 1.25, .05, '#fffdf2', 5.0, 4.7, -14.22); cj(S3, .95, .3, .06, '#c4283a', 5.0, 5.2, -14.2, { borde: false }); cj(S3, .75, .6, .06, '#ffd23f', 5.0, 4.5, -14.2, { borde: false });
      cj(S3, 1.0, 1.3, .08, '#6a4a1a', -4.4, 4.9, -14.22); cj(S3, .78, 1.08, .09, '#3a3a4a', -4.4, 4.9, -14.2, { borde: false });
      var rt2 = new T.Mesh(new T.CircleGeometry(.28, 10), new T.MeshBasicMaterial({ color: 0xe8b48a })); rt2.position.set(-4.4, 5.05, -14.14); S3.add(rt2); cj(S3, .6, .36, .02, '#2a3a6a', -4.4, 4.5, -14.15, { borde: false });
      cj(S3, 1.5, .33, .04, '#ffd23f', 15.8, 4.95, -14.24, { borde: false }); cj(S3, 1.5, .33, .04, '#2a5ab0', 15.8, 4.62, -14.24, { borde: false }); cj(S3, 1.5, .33, .04, '#c4283a', 15.8, 4.29, -14.24, { borde: false });
      for (k = 0; k < 8; k++) { var es = new T.Mesh(new T.CircleGeometry(.05, 5), new T.MeshBasicMaterial({ color: 0xfffdf2 })); es.position.set(15.8 + Math.cos(Math.PI * (.15 + k * .1)) * -.5 + .0, 4.5 + Math.sin(Math.PI * (.15 + k * .1)) * .1, -14.21); S3.add(es); }
      /* el bombillo del porche, que se mece */
      var bombilla = new T.Group(); bombilla.position.set(-2.5, 6.9, -12.6); S3.add(bombilla);
      var cable = M(new T.CylinderGeometry(.02, .02, 1.4, 4), '#14101c', { borde: false }); cable.position.y = -.7; bombilla.add(cable);
      var foco = new T.Mesh(new T.SphereGeometry(.25, 8, 6), tn('#fff6c0', { em: '#ffd36a', emI: pl.noche ? 2 : .3 })); foco.position.y = -1.5; bombilla.add(foco);
      var luz1 = null, luz2 = null;
      if (pl.noche) {
        luz1 = new T.PointLight(0xffc870, 1.3, 20, 2); luz1.position.set(-2.5, 5, -11.5); S3.add(luz1);
        luz2 = new T.PointLight(0xffd890, 1.0, 18, 2); luz2.position.set(14, 4.5, 6); S3.add(luz2);
        var po = M(new T.CylinderGeometry(.1, .14, 4.6, 6), '#2a2a34'); po.position.set(17.6, 2.3, 7); S3.add(po);
        var fa = new T.Mesh(new T.SphereGeometry(.35, 8, 6), tn('#fff2a0', { em: '#ffd36a', emI: 1.8 })); fa.position.set(17.6, 4.8, 7); S3.add(fa);
      }
      /* mecedoras del porche (se mecen solas; ahí van las tías) */
      var sillas = SILLAS.map(function (sx) {
        var g3 = new T.Group(); g3.position.set(sx, PORCHE_Y, MAMA_Z - .2); S3.add(g3);
        var as = M(new T.BoxGeometry(1.3, .14, 1.2), '#8a5a2a', { g: .04 }); as.position.y = .8; g3.add(as);
        var re = M(new T.BoxGeometry(1.3, 1.5, .12), '#8a5a2a', { g: .04 }); re.position.set(0, 1.5, -.6); re.rotation.x = -.15; g3.add(re);
        [-.6, .6].forEach(function (lx) { var pa = M(new T.BoxGeometry(.1, .8, .1), '#5a3a1a', { borde: false }); pa.position.set(lx, .4, 0); g3.add(pa);
          var arco = M(new T.TorusGeometry(1.2, .06, 4, 10, 1.4), '#5a3a1a', { borde: false }); arco.rotation.set(0, Math.PI / 2, Math.PI + .87); arco.position.set(lx, 1.15, 0); g3.add(arco); });
        return g3;
      });
      /* matas en materos a los lados */
      function mata(x, z, h) {
        var ma = M(new T.CylinderGeometry(.6, .45, .9, 8), '#c4563a', { g: .04 }); ma.position.set(x, .45, z); S3.add(ma);
        for (var i = 0; i < 6; i++) { var ho = M(new T.ConeGeometry(.28, h, 4), i % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); ho.geometry.translate(0, h / 2, 0); ho.position.set(x, .85, z); ho.rotation.set(.45 * Math.cos(i), i, .45 * Math.sin(i * 1.7)); S3.add(ho); hojas.push(ho); }
      }
      var hojas = [];
      mata(17.8, -6.5, 1.8); mata(17.8, 0, 1.4); mata(-17.8, 7, 1.6); mata(-15.6, PORCHE_Z - 1.4, 1.5); mata(16.6, PORCHE_Z - 1.4, 1.9); mata(12, PORCHE_Z + 1.5, 1.2);
      /* el mango del patio */
      var mango = new T.Group(); mango.position.set(-22, 0, -4); S3.add(mango);
      var tronco = M(new T.CylinderGeometry(.5, .7, 5, 7), '#8a5a30', { g: .04 }); tronco.position.y = 2.5; mango.add(tronco);
      var copas = [];
      [[0, 6, 0, 3.2], [-1.8, 5.2, 1.2, 2.4], [1.9, 5.4, .8, 2.5], [.4, 7.4, -.4, 2.2]].forEach(function (c4) { var cp4 = M(new T.IcosahedronGeometry(c4[3], 0), '#2f9a3c', { g: .03 }); cp4.position.set(c4[0], c4[1], c4[2]); mango.add(cp4); copas.push(cp4); });
      for (k = 0; k < 7; k++) { var mg = M(new T.SphereGeometry(.28, 6, 5), k % 2 ? '#ffb030' : '#ff8a3d', { g: .05 }); mg.scale.set(.85, 1.1, .85); mg.position.set(Math.cos(k * 2.1) * 2.6, 4.4 + (k % 3) * .5, Math.sin(k * 2.1) * 2 + 1); mango.add(mg); }
      /* el chinchorro del mango a un poste: se mece */
      var poste = M(new T.CylinderGeometry(.18, .22, 3.6, 6), '#8a5a30', { g: .04 }); poste.position.set(-21, 1.8, 6); S3.add(poste);
      var chin = new T.Group(); chin.position.set(-21.3, 2.9, 1); S3.add(chin);
      for (k = 0; k < 5; k++) { var fr = M(new T.CylinderGeometry(.75, .75, 1.6, 8, 1, true, Math.PI * .6, Math.PI * .8), ROPA[k % ROPA.length], { g: .03 }); fr.material.side = T.DoubleSide; fr.rotation.x = Math.PI / 2; fr.position.set(0, -.9 - Math.sin((k + .5) / 5 * Math.PI) * .5, -3 + (k + .5) * 1.25); fr.scale.set(1, .78, .5); chin.add(fr); }
      /* el tendedero con la ropa al viento */
      [-6.5, 5.5].forEach(function (tz) { var pt = M(new T.CylinderGeometry(.12, .15, 3.8, 6), '#6a6a74'); pt.position.set(20.6, 1.9, tz); S3.add(pt); });
      var cuerda = M(new T.CylinderGeometry(.025, .025, 12, 4), '#14101c', { borde: false }); cuerda.rotation.x = Math.PI / 2; cuerda.position.set(20.6, 3.7, -.5); S3.add(cuerda);
      var ropa = [];
      for (k = 0; k < 6; k++) {
        var pr = new T.Group(); pr.position.set(20.6, 3.7, -5.5 + k * 1.95); S3.add(pr);
        var te = M(new T.BoxGeometry(.06, 1.2 + (k % 3) * .3, 1.3), ROPA[k], { g: .03 }); te.position.y = -.6 - (k % 3) * .15; pr.add(te); ropa.push(pr);
      }
      /* muro bajo de adelante con su reja */
      var muro = M(new T.BoxGeometry(50, .8, .6), pl.pared, { recibe: true, g: .02 }); muro.position.set(0, .4, 11.2); S3.add(muro);
      /* guirnalda de bombillitos de colores sobre el patio, con sus dos postes */
      var focos = [], bm = ['#ff5c8a', '#ffd23f', '#3fa9ff', '#7fd6c9', '#ff8a3d'].map(function (cc) { return new T.MeshBasicMaterial({ color: new T.Color(cc) }); });
      [-19.4, 19.4].forEach(function (px2) { var po2 = M(new T.CylinderGeometry(.13, .17, 6.8, 6), '#6a6a74', { borde: false }); po2.position.set(px2, 3.4, -9.7); S3.add(po2); });
      var pts2 = []; for (k = 0; k <= 16; k++) { var gx = -19.4 + k * 38.8 / 16, gu = gx / 19.4; pts2.push(new T.Vector3(gx, 6.75 - 1.1 * (1 - gu * gu), -9.7)); }
      var guir = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts2), 40, .03, 4), new T.MeshBasicMaterial({ color: 0x14101c })); S3.add(guir);
      for (k = 0; k < 26; k++) { var gx2 = -18.6 + k * 37.2 / 25, gu2 = gx2 / 19.4, fo = new T.Mesh(new T.SphereGeometry(.22, 7, 5), bm[k % 5]); fo.position.set(gx2, 6.75 - 1.1 * (1 - gu2 * gu2) - .25, -9.7); S3.add(fo); focos.push(fo); }
      /* macetas colgantes del alero (se mecen) */
      var colg = [];
      [-8.2, 5.4, 14.2].forEach(function (cx3, ii) {
        var cg3 = new T.Group(); cg3.position.set(cx3, 7.0, -12.6); S3.add(cg3);
        var ch3 = M(new T.CylinderGeometry(.02, .02, 1.3, 4), '#14101c', { borde: false }); ch3.position.y = -.65; cg3.add(ch3);
        var mc3 = M(new T.CylinderGeometry(.45, .3, .5, 8), ['#c4563a', '#3fa9ff', '#ffd23f'][ii], { g: .04 }); mc3.position.y = -1.5; cg3.add(mc3);
        for (var hh = 0; hh < 6; hh++) { var hv = M(new T.ConeGeometry(.12, 1.0, 4), hh % 2 ? '#3fae4a' : '#2f9a3c', { borde: false }); hv.geometry.translate(0, -.5, 0); hv.position.set(Math.cos(hh * 1.05) * .38, -1.3, Math.sin(hh * 1.05) * .38); hv.rotation.set(Math.sin(hh * 1.05) * .5, 0, -Math.cos(hh * 1.05) * .5); cg3.add(hv); }
        colg.push({ g: cg3, f: ii * 2.1 });
      });
      /* pajaritos en la guirnalda: se espantan con los estruendos y vuelven */
      var pajaros = [];
      [-13, -12.2, 9, 9.8].forEach(function (bx, ii) {
        var bg = new T.Group(); var gu3 = bx / 19.4; bg.position.set(bx, 6.75 - 1.1 * (1 - gu3 * gu3) + .12, -9.7); S3.add(bg);
        var cb = M(new T.SphereGeometry(.2, 7, 5), ii % 2 ? '#8a7a6a' : '#6a7a8a', { borde: false }); cb.scale.set(1, .85, 1.4); bg.add(cb);
        var hb = M(new T.SphereGeometry(.13, 6, 5), '#3a3a44', { borde: false }); hb.position.set(0, .13, .22); bg.add(hb);
        var pico = M(new T.ConeGeometry(.04, .14, 4), '#ffb030', { borde: false }); pico.rotation.x = Math.PI / 2; pico.position.set(0, .12, .36); bg.add(pico);
        var cob = M(new T.BoxGeometry(.1, .04, .32), '#3a3a44', { borde: false }); cob.position.set(0, .02, -.33); bg.add(cob);
        var alas = [-1, 1].map(function (sd) { var al = M(new T.BoxGeometry(.4, .03, .22), '#4a4a54', { borde: false }); al.geometry.translate(sd * .2, 0, 0); al.position.set(sd * .12, .06, 0); bg.add(al); return al; });
        pajaros.push({ g: bg, hx: bg.position.x, hy: bg.position.y, hz: bg.position.z, alas: alas, vuela: -9, d: ii < 2 ? -1 : 1, f: ii });
      });
      /* las que se suman a lanzar: la abuela (F2) y la tía (F3); salen por la puerta */
      var abuela = V3.PJ.crear('abuela', { prop: false, escala: 1.5 }); abuela.g.visible = false; abuela.g.rotation.order = 'YXZ'; S3.add(abuela.g);
      var tia = V3.PJ.crear('prima', { prop: false, escala: 1.5 }); tia.g.visible = false; tia.g.rotation.order = 'YXZ'; S3.add(tia.g);
      var manoCh = [];
      [abuela, tia].forEach(function (q3) { var cm = chancla3D('#ff8a3d'); cm.scale.setScalar(.7); cm.position.set(0, -.2, .1); q3.mano('der').add(cm); manoCh.push(cm); });
      /* el perro (Canelo): caja low poly con patas que corren y una chancla en la boca cuando roba */
      function perroMalla() {
        var pg0 = new T.Group(), pc = '#c98a4a', cu0 = M(new T.BoxGeometry(.7, .6, 1.5), pc, { g: .05 }); cu0.position.y = .9; pg0.add(cu0);
        var cG = new T.Group(); cG.position.set(0, 1.25, .8); pg0.add(cG);
        var cab0 = M(new T.BoxGeometry(.6, .6, .65), pc, { g: .05 }); cab0.position.set(0, .1, .15); cG.add(cab0);
        var hoc0 = M(new T.BoxGeometry(.36, .3, .4), '#e8c49a', { g: .04 }); hoc0.position.set(0, -.03, .55); cG.add(hoc0);
        var nar0 = M(new T.BoxGeometry(.14, .12, .1), '#14101c', { borde: false }); nar0.position.set(0, .08, .77); cG.add(nar0);
        var ors = [-.22, .22].map(function (ox2) { var or = M(new T.ConeGeometry(.14, .35, 4), '#8a5a2a', { g: .04 }); or.position.set(ox2, .5, .05); or.rotation.z = ox2 * 1.5; cG.add(or); return or; });
        var col0 = M(new T.CylinderGeometry(.06, .08, .7, 5), pc, { g: .04 }); col0.position.set(0, 1.25, -.85); col0.rotation.x = -.7; pg0.add(col0);
        var pts = [[-.22, .5], [.22, .5], [-.22, -.5], [.22, -.5]].map(function (lp) { var pg = new T.Group(); pg.position.set(lp[0], .7, lp[1]); pg0.add(pg); var pa3 = M(new T.BoxGeometry(.18, .7, .18), '#8a5a2a', { borde: false }); pa3.position.y = -.35; pg.add(pa3); return pg; });
        var bo0 = chancla3D('#3fa9ff'); bo0.scale.setScalar(.75); bo0.rotation.set(Math.PI / 2, 0, Math.PI / 2); bo0.position.set(0, 1.12, 1.55); pg0.add(bo0);
        return { g: pg0, cab: cG, ors: ors, cola: col0, patas: pts, boca: bo0 };
      }
      var perroO = perroMalla(), perro = perroO.g, patas = perroO.patas, cola = perroO.cola, boca = perroO.boca; perro.visible = false; S3.add(perro);
      var canelo = perroMalla(); canelo.boca.visible = false; canelo.g.position.set(11.5, PORCHE_Y - .55, -10.7); canelo.g.rotation.y = .5; S3.add(canelo.g);       // Canelo, dormido en el porche
      var filaP = new T.Mesh(new T.PlaneGeometry(AW * ESX + 2, 48 * 2 * ESZ * .55), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .3, depthWrite: false })); filaP.rotation.x = -Math.PI / 2; filaP.position.y = .035; filaP.visible = false; S3.add(filaP);
      /* la manguera del vecino: el vecino en el muro, la franja de aviso y el charco */
      var vecino = V3.PJ.crear('tio', { prop: false, escala: 1.45 }); vecino.g.visible = false; S3.add(vecino.g);
      var mgr = M(new T.CylinderGeometry(.07, .07, 1.2, 5), '#3fae4a', { borde: false }); mgr.rotation.x = Math.PI / 2; mgr.position.set(0, 0, .5); vecino.mano('der').add(mgr);
      var charcos = [];
      for (k = 0; k < EVS.length; k++) if (EVS[k].k === 'manguera') {
        var chm = new T.Mesh(new T.PlaneGeometry(MANG_A * 2 * ESX, AH * ESZ + 1), new T.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: .4, depthWrite: false })); chm.rotation.x = -Math.PI / 2; chm.position.set(WX(EVS[k].x), .03, 0); chm.visible = false; S3.add(chm);
        charcos.push({ ev: EVS[k], m: chm });
      }
      /* las ollas del piso y el casco de olla de cada jugador */
      function olla3Dm() {
        var g4 = new T.Group(), cu = M(new T.CylinderGeometry(.55, .45, .6, 10), '#a8b0bc', { g: .05 }); cu.position.y = .3; g4.add(cu);
        var ta = M(new T.CylinderGeometry(.6, .6, .08, 10), '#8a92a0', { g: .04 }); ta.position.y = .62; g4.add(ta);
        [-.65, .65].forEach(function (hx2) { var asa = M(new T.BoxGeometry(.2, .08, .14), '#14101c', { borde: false }); asa.position.set(hx2, .5, 0); g4.add(asa); });
        return g4;
      }
      var ollas = OLLAS.map(function () {
        var g4 = olla3Dm(); g4.visible = false; S3.add(g4);
        var ar4 = new T.Mesh(new T.RingGeometry(.95, 1.15, 20), new T.MeshBasicMaterial({ color: 0x7fd6c9, transparent: true, opacity: .8, depthWrite: false })); ar4.rotation.x = -Math.PI / 2; ar4.position.y = .04; ar4.visible = false; S3.add(ar4);
        return { g: g4, ar: ar4 };
      });

      /* mamá en el porche, con su chancla */
      var mama = V3.PJ.crear('mama', { prop: true, escala: 1.6 }); mama.g.rotation.order = 'YXZ'; mama.g.position.set(0, PORCHE_Y, MAMA_Z); S3.add(mama.g);
      /* la «vena» de la rabia que se infla sobre cada lanzadora al armar el brazo */
      var iras = [mama, abuela, tia].map(function () { var ig = new T.Group(); ig.visible = false; S3.add(ig); for (var ib = 0; ib < 4; ib++) { var bm2 = new T.Mesh(new T.BoxGeometry(.1, .42, .06), new T.MeshBasicMaterial({ color: 0xe0202e })); bm2.position.set(ib < 2 ? -.18 : .18, ib % 2 ? -.14 : .14, 0); bm2.rotation.z = (ib % 2 ? 1 : -1) * .75 * (ib < 2 ? 1 : -1); ig.add(bm2); } return ig; });
      var ondas = []; for (k = 0; k < 8; k++) { var od = new T.Mesh(new T.RingGeometry(.8, 1, 24), new T.MeshBasicMaterial({ color: 0xfffdf2, transparent: true, opacity: 0, depthWrite: false })); od.rotation.x = -Math.PI / 2; od.position.y = .06; od.visible = false; S3.add(od); ondas.push({ m: od, t: -9, r: 1 }); }
      /* los jugadores: aro de color, su mesa (A) y la mira de tía */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), col = s2.color && s2.color !== '#fff' ? s2.color : ROPA[k % ROPA.length];
        var pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }); pj.g.rotation.order = 'YXZ'; pj.g.position.set(WX(P[k].x), 0, WZ(P[k].y)); S3.add(pj.g);
        var estr = new T.Group(); estr.visible = false; S3.add(estr);
        for (var se = 0; se < 3; se++) { var sm = new T.Mesh(new T.OctahedronGeometry(.2, 0), new T.MeshBasicMaterial({ color: 0xffd23f })); estr.add(sm); }
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .85 })); aro.rotation.x = -Math.PI / 2; aro.position.y = .05; S3.add(aro);
        var mesa = new T.Group(); S3.add(mesa); mesa.visible = false;
        var tab = M(new T.BoxGeometry(2.4, .2, 2), '#c98a4a', { g: .04, recibe: true }); tab.position.y = 2.3; mesa.add(tab);
        [[-1, -.8], [1, -.8], [-1, .8], [1, .8]].forEach(function (lp) { var pa2 = M(new T.BoxGeometry(.16, 2.2, .16), '#8a5a2a', { borde: false }); pa2.position.set(lp[0], 1.1, lp[1]); mesa.add(pa2); });
        var mira = new T.Group(); mira.visible = false; S3.add(mira);
        var mm = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide });
        var mr = new T.Mesh(new T.RingGeometry(1, 1.25, 24), mm); mr.rotation.x = -Math.PI / 2; mira.add(mr);
        var mx1 = new T.Mesh(new T.PlaneGeometry(2.8, .14), mm); mx1.rotation.x = -Math.PI / 2; mira.add(mx1);
        var mx2 = new T.Mesh(new T.PlaneGeometry(.14, 2.8), mm); mx2.rotation.x = -Math.PI / 2; mira.add(mx2);
        var casco = olla3Dm(); casco.scale.setScalar(.75); casco.rotation.x = Math.PI; casco.visible = false; S3.add(casco);
        pjs.push({ estr: estr, hitT: -9, mojado: -9, polvo: 0, cubre: 0, pj: pj, aro: aro, mesa: mesa, mira: mira, casco: casco, tumbo: -9, x: WX(P[k].x), z: WZ(P[k].y), y: 0, px: WX(P[k].x), pz: WZ(P[k].y), rumbo: 0, salio: -9, mesaC: 0, fest: 0, silla: -1 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var part = V3.particulas(esc, 900);
      esc.encuadrar(AW * ESX + 1, 24.5, new T.Vector3(0, 2.4, -3.0), .6);
      return { esc: esc, mama: mama, mamaX: 0, mamaPX: 0, vol0: -1, pjs: pjs, flecha: flecha, part: part, chs: {}, pool: [], tl: [], sillas: sillas, hojas: hojas, copas: copas,
        chin: chin, ropa: ropa, bombilla: bombilla, nev: bis, hojaT: 0, fin: 0, sonoT: -9, foco: foco, luces: [luz1, luz2], focoI: pl.noche ? 2 : .3,
        abuela: abuela, tia: tia, lanzoT: [-9, -9, -9], perro: perro, patas: patas, cola: cola, boca: boca, filaP: filaP, vecino: vecino, charcos: charcos, ollas: ollas,
        faseV: 1, evV: {}, cortinas: cortinas, colgando: colgando, colg: colg, pajaros: pajaros, focos: focos, llamas: llamas, minu: minu, tvv: tvv, hoja: hoja, abanico: abanico, canelo: canelo, iras: iras, ondas: ondas, onT: 0, manoCh: manoCh, vaporT: 0, luciT: 0,
        thr: [{ w: -9, prop: true, dust: 1, ira: -9 }, { w: -9, prop: true, dust: 1, ira: -9 }, { w: -9, prop: true, dust: 1, ira: -9 }], mamaRi: -9, evHit: -9, dogAl: 0, solC: new T.Color(pl.sol[0]), hemiI: pl.hemi[2], solI: pl.sol[1] };
    }
    /* una chancla 3D: suela ovalada + la tira en V */
    function chancla3D(col) {
      var T = THREE, M = V3.malla, g3 = new T.Group();
      var su = M(new T.CylinderGeometry(.5, .5, .12, 12), col, { g: .06 }); su.scale.set(.55, 1, 1.15); g3.add(su);
      var t1 = M(new T.BoxGeometry(.07, .16, .55), '#fffdf2', { g: .05 }); t1.position.set(-.13, .12, .05); t1.rotation.y = .45; g3.add(t1);
      var t2 = M(new T.BoxGeometry(.07, .16, .55), '#fffdf2', { g: .05 }); t2.position.set(.13, .12, .05); t2.rotation.y = -.45; g3.add(t2);
      g3.scale.setScalar(1.25);
      return g3;
    }
    /* la sombra de aviso: disco que crece + aro del tamaño final */
    function sombra3D(col) {
      var T = THREE, g3 = new T.Group();
      var di = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .4, depthWrite: false })); di.rotation.x = -Math.PI / 2; g3.add(di);
      var ar = new T.Mesh(new T.RingGeometry(.9, 1, 28), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, depthWrite: false })); ar.rotation.x = -Math.PI / 2; g3.add(ar);
      g3.position.y = .04; g3.scale.set(R * ESX, 1, R * ESZ / 1.05);
      return { g: g3, di: di, ar: ar };
    }
    function pedirCh() {
      var o = v3.pool.pop();
      if (!o) { o = { ch: chancla3D('#3fa9ff'), sm: sombra3D(0xff3b4e) }; v3.esc.scene.add(o.ch); v3.esc.scene.add(o.sm.g); }
      o.ch.visible = true; o.sm.g.visible = true; o.land = 0;
      return o;
    }
    function soltarCh(o) { o.ch.visible = false; o.sm.g.visible = false; v3.pool.push(o); }
    function lanzadora(by) { return by === -2 ? v3.abuela : by === -3 ? v3.tia : v3.mama; }
    function origen(a) {                                                      // de dónde sale la chancla: la mano de quien lanza, la mecedora de la tía o el rebote
      if (a.k === 'r2') return new THREE.Vector3(WX(a.fx), .2, WZ(a.fy));
      if (a.by >= 0 && v3.pjs[a.by]) { var t3 = v3.pjs[a.by]; return new THREE.Vector3(t3.x, 3, t3.z); }
      var q3 = a.by < -1 ? lanzadora(a.by).g.position : null;
      return q3 ? new THREE.Vector3(q3.x + .6, PORCHE_Y + 3.4, q3.z + .4) : new THREE.Vector3(v3.mamaX + .6, PORCHE_Y + 3.4, MAMA_Z + .4);
    }
    function onda(x, z, r, col) {                                              // anillo de polvo que se abre en el piso
      var V = v3, o = null, a2;
      for (a2 = 0; a2 < V.ondas.length; a2++) if (absT - V.ondas[a2].t > .6) { o = V.ondas[a2]; break; }
      if (!o) return;
      o.t = absT; o.r = r; o.m.material.color.set(col || '#fffdf2'); o.m.position.set(x, .07, z); o.m.visible = true;
    }
    function espanta() { var V = v3, a2; for (a2 = 0; a2 < V.pajaros.length; a2++) if (absT - V.pajaros[a2].vuela > 8) V.pajaros[a2].vuela = absT + a2 * .07; }
    function chanclaVuela(key, a, now, wn, activos, sonar) {
      var V = v3, o = V.chs[key], dtt = a.T - now, gk = (a.r || R) / R, big = a.k === 'g' ? 2 : 1, TAU = Math.PI * 2;
      activos[key] = 1;
      if (!o) {
        o = V.chs[key] = pedirCh(); o.o = origen(a); o.rot = c.fx() * 6; o.T = a.T; o.nx = 3 + Math.floor(c.fx() * 3); o.nz = 1 + Math.floor(c.fx() * 2); o.ny = c.fx() < .5 ? 1 : -1;
        o.ch.children[0].material = V3.toon(a.k === 'g' ? '#8a4a2a' : a.k === 'r' || a.k === 'r2' ? '#7fd64a' : a.k === 'b' ? '#ff5c8a' : '#3fa9ff');
        o.sm.g.scale.set(R * ESX * gk, 1, R * ESZ / 1.05 * gk);
        if (a.by < 0 && a.k !== 'r2') { var ql = -a.by - 1; if (absT - V.lanzoT[ql] > .3) { V.lanzoT[ql] = absT; V3.sfx('whoosh'); } }   // el gesto de lanzar ya arrancó antes (anticipación)
        if (a.k === 'r2') V3.sfx('salto');
      }
      var u = cl(1 - dtt / wn, 0, 1), tx = WX(a.x), tz = WZ(a.y), t = absT, robada = a.rob && now >= a.rob;
      if (robada) { o.ch.visible = false; o.sm.g.visible = false; return; }
      o.ch.visible = true;
      if (dtt > 0) {
        var alto = a.k === 'r2' ? 2.2 : 5, px3 = o.o.x + (tx - o.o.x) * u, py3 = o.o.y + (.1 - o.o.y) * u + Math.sin(u * Math.PI) * alto, pz3 = o.o.z + (tz - o.o.z) * u, rem = Math.pow(1 - u, 1.1);
        o.ch.position.set(px3, py3, pz3);
        o.ch.rotation.set(TAU * o.nx * rem, o.rot + o.ny * TAU * .6 * rem, TAU * o.nz * rem);        // gira de punta a punta y aterriza plana
        o.ch.scale.setScalar(1.7 * big);
        if (c.fx() < .6) V.part.soltar(px3, py3, pz3, 1, { k: 'chispa', cols: ['#fffdf2', '#bfe6ff'], vel: .4, arriba: 0, g: 0, vida: .3, esc: .5, suelo: false });   // estela
        o.sm.g.position.set(tx, .04, tz); o.sm.g.visible = true;
        var s = .35 + .65 * u; o.sm.di.scale.setScalar(s); o.sm.di.material.opacity = .3 + .25 * Math.abs(Math.sin(t * 16)); o.sm.ar.material.opacity = .5 + .4 * u;
      } else {
        if (!o.land) {
          o.land = 1; sonar.n++; if (a.k === 'g') sonar.g++;
          V.part.soltar(tx, .2, tz, a.k === 'g' ? 22 : 10, { k: 'chispa', cols: ['#e3c79a', '#fffdf2', '#c9a576'], vel: 3.2 * gk, arriba: 2.2, vida: .5 });
          onda(tx, tz, R * ESX * gk * 1.15, a.k === 'g' ? '#ffd23f' : '#fffdf2');
        }
        var ag = -dtt, bt = ag < .32 ? Math.abs(Math.sin(ag / .32 * Math.PI * 1.5)) * .9 * (1 - ag / .32) : 0;
        o.ch.position.set(tx, .1 + bt, tz); o.ch.rotation.set(bt * Math.sin(ag * 30) * .5, o.rot + bt * .7, bt * .4); o.ch.scale.setScalar(1.7 * big * cl(1 - (ag - .35) / .3, 0, 1));
        o.sm.g.visible = ag < .12; o.sm.di.material.opacity = .5 * (1 - ag / .12);
      }
    }
    /* postura de las lanzadoras: arman el brazo (se echan atrás, se inflan de rabia), sueltan con un pisotón y se ríen si le pegan a alguien */
    function postura(i, pj, x, y, z, fin) {
      var V = v3, th = V.thr[i], t = absT, tw = t - th.w, lean = 0, hop = 0, sq = 1, ira = 0, ig = V.iras[i], ri = t - V.evHit < .9;
      if (tw >= 0 && tw < .9) {
        if (tw < .22) { var u1 = tw / .22; lean = -.26 * u1; sq = 1 - .08 * u1; ira = u1; pj.mirar(Math.sin(t * 38) * .5, -.3); }
        else if (tw < .55) { var v = (tw - .22) / .33; lean = -.26 * (1 - v) + .42 * Math.sin(v * Math.PI); hop = Math.sin(v * Math.PI) * .22; sq = 1 + .05 * Math.sin(v * Math.PI); ira = 1 - v * .6; pj.mirar(0, .2); }
        else { lean = .1 * (1 - (tw - .55) / .35); pj.mirar(0, 0); }
        if (tw >= .5 && !th.dust) { th.dust = 1; V.part.soltar(x, y + .15, z + .5, 9, { k: 'chispa', cols: ['#e3c79a', '#fffdf2'], vel: 2.6, arriba: 1.2, vida: .5 }); onda(x, z + .4, 1.3); }
      } else pj.mirar(Math.sin(t * .8 + i) * .4, 0);
      if (tw < .02 || tw > 1) th.dust = tw > 1 ? 1 : 0;
      if (ri && !fin) { hop += Math.abs(Math.sin(t * 16)) * .14; lean += Math.sin(t * 16) * .05; }
      var hold = tw > .22 && tw < .95;                                          // la chancla ya salió de su mano
      if (i === 0) pj.prop(!hold); else V.manoCh[i - 1].visible = !hold;
      ig.visible = ira > .02 && !fin;
      if (ig.visible) { var sc2 = ira * (1.1 + .25 * Math.sin(t * 40)); ig.position.set(x + .5, y + (i === 0 ? 4.1 : 3.9), z + .3); ig.scale.set(sc2, sc2, sc2); }
      pj.g.position.set(x, y + hop, z); pj.g.rotation.x = lean; pj.g.rotation.z = Math.sin(t * 3.1 + i) * .03 + (th.ira > 0 ? 0 : 0); pj.g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    /* la escalada y los eventos del patio, en 3D (solo dibujo: todo sale del calendario de mk) */
    function patio3D(dt, now, fz, fin) {
      var T = THREE, V = v3, t = absT, a, e, ev;
      /* la abuela (F2) y la tía (F3) salen por la puerta a su puesto del porche */
      [[V.abuela, P2, -6.5], [V.tia, P3, 11.5]].forEach(function (z3, iz) {
        var q3 = z3[0], dsd = now - z3[1], u = cl(dsd / 1.2, 0, 1);
        q3.g.visible = now >= 0 && dsd >= 0;
        if (!q3.g.visible) return;
        var px3 = 2.5 + (z3[2] - 2.5) * u + (u >= 1 && !fin ? Math.sin(t * .7 + iz * 2) * 1.2 : 0);
        var pz3 = -13.6 + (MAMA_Z + .2 + 13.6) * u, rie = t - V.evHit < .9;
        q3.anim(fin ? 'aplaudir' : rie ? 'aplaudir' : u < 1 ? 'caminar' : 'quieto', { vel: .7 }).cara(fin || rie ? 'feliz' : 'enojado').rumbo(u < 1 ? (z3[2] > 2.5 ? Math.PI / 2 : -Math.PI / 2) : 0).update(dt);
        if (u >= 1) postura(iz + 1, q3, px3, PORCHE_Y, pz3, fin); else q3.g.position.set(px3, PORCHE_Y, pz3);
      });
      /* cambio de fase: sonido, sacudida, confeti de chanclas */
      if (fz !== V.faseV && now >= 0) {
        V.faseV = fz;
        if (fz === 2) { V3.sfx('silbato'); V.esc.sacudir(.5); espanta(); }
        if (fz === 3) { espanta(); V3.sfx('bocina'); V3.sfx('tambor'); V.esc.sacudir(1); V.part.soltar(0, 6, -4, 40, { k: 'confeti', cols: ['#3fa9ff', '#ff5c8a', '#ffd23f'], vel: 6, arriba: 4, g: 5, vida: 1.4 }); }
      }
      /* el perro */
      V.perro.visible = false; V.filaP.visible = false;
      for (e = 0; e < EVS.length; e++) {
        ev = EVS[e];
        if (now < ev.tw || now > ev.t1 + .3) continue;
        if (!V.evV[e]) { V.evV[e] = 1; V3.sfx(ev.k === 'perro' ? 'bocina' : ev.k === 'manguera' ? 'viento' : 'chispa'); }
        if (now >= ev.t0 && V.evV[e] === 1) { V.evV[e] = 2; if (ev.k === 'perro') espanta(); V3.sfx(ev.k === 'perro' ? 'whoosh' : ev.k === 'manguera' ? 'splash' : 'trueno'); if (ev.k !== 'manguera') V.esc.sacudir(.5); }
        if (ev.k !== 'perro') continue;
        var dz = WZ(ev.y), dxp = WX(cl(dogX(ev, Math.max(now, ev.t0)), -60, AW + 60)), corre = now >= ev.t0;
        if (!corre) dxp = WX(ev.dir > 0 ? -18 : AW + 18) + Math.sin(t * 20) * .1;
        V.perro.visible = now <= ev.t1; V.perro.position.set(dxp, corre ? Math.abs(Math.sin(t * 18)) * .25 : Math.abs(Math.sin(t * 9)) * .3, dz);
        V.perro.rotation.y = ev.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        for (a = 0; a < 4; a++) V.patas[a].rotation.x = corre ? Math.sin(t * 22 + (a % 2 ? Math.PI : 0) + (a > 1 ? 1.2 : 0)) * .8 : 0;
        V.cola.rotation.z = Math.sin(t * 25) * .5;
        var lleva = false; for (a = 0; a < lanz.length && !lleva; a++) if (lanz[a].rob && Math.abs(lanz[a].rob - ev.t0) < 3 && now >= lanz[a].rob && Math.abs(lanz[a].y - ev.y) <= 48) lleva = true;
        V.boca.visible = lleva;
        V.filaP.visible = now < ev.t1; V.filaP.position.set(0, .035, dz); V.filaP.material.opacity = corre ? .18 : .25 + .2 * Math.abs(Math.sin(t * 12));
        if (corre && c.fx() < .5) V.part.soltar(dxp - ev.dir * .8, .2, dz, 1, { k: 'chispa', cols: ['#e3c79a', '#c9a576'], vel: 1.5, arriba: 1, vida: .4 });
        /* a quien no es mío y el perro le pasa por encima: se cae (cosmético; el dueño ya lo juzgó) */
        if (corre) for (a = 0; a < n; a++) { var s4 = V.pjs[a]; if (!P[a].st && !c.mio(a) && t - s4.tumbo > 1 && Math.abs(s4.x - dxp) < DOGR * ESX && Math.abs(s4.z - dz) < 26 * ESZ) { s4.tumbo = t; s4.pj.uno('tropezar'); } }
      }
      /* Canelo, el perro de la casa: duerme en el porche (con sus zzz); cuando el otro perro cruza, se levanta y ladra */
      var cn = V.canelo, alerta = false;
      for (e = 0; e < EVS.length; e++) if (EVS[e].k === 'perro' && now >= EVS[e].tw && now < EVS[e].t1 + .5) alerta = true;
      V.dogAl += ((alerta ? 1 : fz === 3 ? .5 : 0) - V.dogAl) * Math.min(1, dt * 6);
      var al = V.dogAl, ladra = alerta && now >= 0;
      cn.cab.rotation.x = .8 * (1 - al) - .1 * al - (ladra ? Math.abs(Math.sin(t * 12)) * .3 : 0);
      cn.g.position.y = PORCHE_Y - .55 + al * .55 + (ladra ? Math.abs(Math.sin(t * 12)) * .3 : (1 - al) * Math.sin(t * 1.7) * .02);
      cn.g.rotation.y = .5 * (1 - al) + (ladra ? Math.sin(t * 6) * .15 : 0);
      for (a = 0; a < 4; a++) cn.patas[a].rotation.x = (a < 2 ? -1.4 : 1.4) * (1 - al);
      cn.cola.rotation.z = Math.sin(t * (1.5 + 24 * al)) * (.1 + .5 * al);
      for (a = 0; a < 2; a++) cn.ors[a].rotation.x = .7 * (1 - al);
      /* la manguera: el vecino asoma por el muro, la franja avisa, el chorro y el charco */
      var vecV = false;
      for (a = 0; a < V.charcos.length; a++) {
        var chr = V.charcos[a], ev2 = chr.ev, wx = WX(ev2.x);
        if (now >= ev2.tw && now < ev2.t0 + MANG_D + .4) { vecV = true; V.vecino.g.position.set(wx, 0, 10.4); }
        chr.m.visible = now >= ev2.tw && now < ev2.t1;
        if (!chr.m.visible) continue;
        if (now < ev2.t0) chr.m.material.opacity = .15 + .15 * Math.abs(Math.sin(t * 12));
        else chr.m.material.opacity = .45 * cl((ev2.t1 - now) / 1, 0, 1);
        if (now >= ev2.t0 && now < ev2.t0 + MANG_D) for (e = 0; e < 3; e++) V.part.soltar(wx + (c.fx() - .5) * MANG_A * 2 * ESX, .3 + c.fx() * 1.5, WZ(c.fx() * AH), 1, { k: 'gota', cols: ['#7fd6ff', '#3fa9ff', '#fffdf2'], vel: 2, arriba: 2, vida: .5 });
      }
      V.vecino.g.visible = vecV;
      if (vecV) V.vecino.anim('empujar', { vel: .35 }).cara('feliz').rumbo(Math.PI + Math.sin(t * 3) * .5).update(dt);
      /* SE FUE LA LUZ y la luz de los ÚLTIMOS SEGUNDOS */
      var osc = 0, avisa = false;
      for (e = 0; e < EVS.length; e++) { ev = EVS[e]; if (ev.k !== 'apagon') continue; if (now >= ev.tw && now < ev.t0) avisa = true; if (now >= ev.t0 - .1 && now < ev.t1) osc = Math.max(osc, cl((now - ev.t0 + .1) / .2, 0, 1) * cl((ev.t1 - now) / .3, 0, 1)); }
      var parpa = avisa && Math.floor(t * 18) % 3 === 0, k3 = fz === 3 && !fin ? 1 : 0, lum = (1 - .85 * osc) * (parpa ? .4 : 1);
      V.esc.luces.hemi.intensity = V.hemiI * lum;
      V.esc.luces.sol.intensity = (V.solI + k3 * .08 * Math.sin(t * 9)) * lum;
      V.esc.luces.sol.color.copy(V.solC); if (k3) V.esc.luces.sol.color.lerp(new T.Color(0xff5a3a), .45);
      V.foco.material.emissiveIntensity = V.focoI * (parpa || osc > .5 ? 0 : 1);
      for (a = 0; a < 2; a++) if (V.luces[a]) V.luces[a].intensity = (a ? 1 : 1.3) * (1 - osc);
      /* las ollas */
      for (a = 0; a < OLLAS.length; a++) {
        var ol = OLLAS[a], m3 = V.ollas[a], vis = ol.tom < 0 && now >= ol.t0 - .6 && now < ol.t1 && !(now > ol.t1 - 1 && Math.floor(t * 10) % 2);
        m3.g.visible = vis; m3.ar.visible = vis && now >= ol.t0;
        if (!vis) continue;
        var cae = cl((ol.t0 - now) / .6, 0, 1);
        m3.g.position.set(WX(ol.x), cae * cae * 9 + (cae ? 0 : Math.abs(Math.sin(t * 4)) * .15), WZ(ol.y)); m3.g.rotation.y = t * 1.5;
        m3.ar.position.set(WX(ol.x), .04, WZ(ol.y)); var pa4 = 1 + .12 * Math.sin(t * 8); m3.ar.scale.set(pa4, pa4, 1);
        if (cae === 0 && !ol.son) { ol.son = 1; V3.sfx('ding'); V.part.soltar(WX(ol.x), .3, WZ(ol.y), 8, { k: 'chispa', cols: ['#7fd6c9', '#fffdf2'], vel: 2.5, arriba: 2, vida: .5 }); }
      }
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, p, a, t = absT;
      V.part.update(dt);
      /* lo que se mueve solo: ropa, chinchorro, mecedoras, matas, mango, bombillo y hojas que caen */
      for (a = 0; a < V.ropa.length; a++) V.ropa[a].rotation.z = Math.sin(t * 2.4 + a * .9) * .22 + .08;
      V.chin.rotation.z = Math.sin(t * 1.1) * .22;
      for (a = 0; a < V.sillas.length; a++) V.sillas[a].rotation.x = Math.sin(t * 1.6 + a * 1.3) * .09;
      for (a = 0; a < V.hojas.length; a++) V.hojas[a].rotation.y += Math.sin(t * 1.4 + a) * .002;
      for (a = 0; a < V.copas.length; a++) V.copas[a].rotation.y = Math.sin(t * .8 + a) * .06;
      V.bombilla.rotation.z = Math.sin(t * 1.7) * .12;
      V.nev.rotation.y = -1.9 + Math.sin(t * .9) * .08;
      V.hojaT -= dt; if (V.hojaT < 0) { V.hojaT = .5 + c.fx() * .6; V.part.soltar(-22 + (c.fx() - .5) * 5, 7, -4 + (c.fx() - .5) * 4, 1, { k: 'confeti', cols: ['#3fae4a', '#9ad04a', '#2f9a3c'], vel: 1.2, arriba: 0, g: 1.6, vida: 4 }); }
      for (a = 0; a < V.cortinas.length; a++) { V.cortinas[a].g.rotation.x = Math.sin(t * 1.3 + V.cortinas[a].f) * .06; V.cortinas[a].g.rotation.z = Math.sin(t * .9 + V.cortinas[a].f * 2) * .05; }
      for (a = 0; a < V.colgando.length; a++) V.colgando[a].g.rotation.z = Math.sin(t * 1.2 + V.colgando[a].f) * .06;
      for (a = 0; a < V.colg.length; a++) { V.colg[a].g.rotation.z = Math.sin(t * 1.0 + V.colg[a].f) * .08; V.colg[a].g.rotation.x = Math.sin(t * .8 + V.colg[a].f) * .05; }
      for (a = 0; a < V.focos.length; a++) V.focos[a].scale.setScalar(.9 + .22 * Math.sin(t * 4 + a * 1.7));
      for (a = 0; a < V.llamas.length; a++) V.llamas[a].scale.setScalar(1 + .04 * Math.sin(t * 25 + a * 2));
      V.minu.rotation.z = -t * .7; V.tvv.material.color.setHSL(.58, .65, .55 + .15 * Math.sin(t * 23) * Math.sin(t * 7)); V.abanico.material.opacity = .17 + .05 * Math.sin(t * 6);
      V.vaporT -= dt;                                                          // vapor de la olla, la greca y las arepas
      if (V.vaporT < 0) {
        V.vaporT = .07 + c.fx() * .06; var vz = c.fx();
        V.part.soltar(vz < .5 ? -1.9 : vz < .8 ? -.5 : -1.2, vz < .5 ? 3.25 : vz < .8 ? 3.1 : 2.6, -13.55, 1, { k: 'chispa', cols: ['#ffffff', '#e8f2ff'], vel: .25, arriba: 1.0, g: -1.2, vida: 1.3, esc: vz < .8 ? 1 : .6, suelo: false });
      }
      if (lv === 3) { V.luciT -= dt; if (V.luciT < 0) { V.luciT = .25 + c.fx() * .3; V.part.soltar((c.fx() - .5) * 34, .6 + c.fx() * 2.2, (c.fx() - .5) * 18, 1, { k: 'chispa', cols: ['#e8ff7a', '#ffe14d'], vel: .3, arriba: .1, g: 0, vida: 3, esc: .45, suelo: false }); } }
      for (a = 0; a < V.pajaros.length; a++) {
        var bd = V.pajaros[a], tb = t - bd.vuela, g2 = bd.g, fl = Math.sin(t * 42) * .9;
        if (tb >= 0 && tb < 7.5) {
          g2.visible = !(tb > 3 && tb < 5);
          if (tb < 3) g2.position.set(bd.hx + bd.d * tb * 8, bd.hy + tb * 3.5 + Math.sin(tb * 16) * .15, bd.hz - tb); else { var ur = cl((tb - 5) / 2.5, 0, 1), er = (1 - ur) * (1 - ur); g2.position.set(bd.hx - bd.d * er * 12, bd.hy + er * 4 + Math.sin(tb * 14) * .1 * (1 - ur), bd.hz - er * 2); }
          g2.rotation.y = tb < 3 ? bd.d * 1.5 : -bd.d * 1.5 * (ur < 1 ? 1 : 0); bd.alas[0].rotation.z = fl * (tb < 3 || ur < 1 ? 1 : 0); bd.alas[1].rotation.z = -fl * (tb < 3 || ur < 1 ? 1 : 0);
        } else { g2.visible = true; g2.position.set(bd.hx, bd.hy, bd.hz); g2.rotation.set(Math.sin(t * 2.2 + bd.f * 3) > .85 ? .45 : 0, 0, 0); g2.rotation.y = Math.sin(t * .7 + bd.f) > .8 ? .6 : 0; bd.alas[0].rotation.z = bd.alas[1].rotation.z = 0; }
      }
      for (a = 0; a < V.ondas.length; a++) { var ow = V.ondas[a], uo = (t - ow.t) / .55; if (uo >= 1 || uo < 0) { ow.m.visible = false; continue; } ow.m.scale.setScalar(ow.r * (.5 + 1.3 * uo)); ow.m.material.opacity = .7 * (1 - uo); }
      var fin = vivos() <= 1 || now >= dur;
      /* mamá: camina por el porche, voltea hacia donde lanza, y lanza en cada ráfaga */
      var mama = V.mama;
      V.mamaX = fin ? V.mamaX : Math.sin(t * .55) * 3.5;
      var mvx = (V.mamaX - V.mamaPX) / Math.max(dt, 1e-3); V.mamaPX = V.mamaX;
      var objx = 0, objn = 0, sonar = { n: 0, g: 0 }, activos = {}, fz = now >= 0 ? fase(now) : 1;
      /* anticipación: cada lanzadora arma el brazo 0,24 s ANTES de soltar la ráfaga (el calendario se conoce de antemano) */
      for (a = 0; a < lanz.length; a++) {
        var lw = lanz[a]; if (lw.T - 1.3 > now) break;
        if (lw.by >= 0 || lw.k === 'r2') continue;
        var tr0 = lw.T - lw.w - .24, ti = -lw.by - 1, thr = V.thr[ti];
        if (tr0 <= now && now < tr0 + .3 && t - thr.w > .4) { thr.w = t; lanzadora(lw.by).uno('lanzar'); }
      }
      for (a = 0; a < lanz.length; a++) {
        var la = lanz[a];
        if (la.T - 1.05 > now) break;
        if (la.T - la.w > now || now > la.T + .62) continue;
        chanclaVuela('L' + a, la, now, la.w, activos, sonar); if (la.T > now && la.by === -1) { objx += WX(la.x); objn++; }
      }
      for (a = 0; a < extras.length; a++) { var ex = extras[a]; if (ex.T - 1.0 <= now && now <= ex.T + .62) chanclaVuela('E' + a, ex, now, 1.0, activos, sonar); }
      for (var key in V.chs) if (!activos[key]) { soltarCh(V.chs[key]); delete V.chs[key]; }
      if (sonar.g) espanta();
      if (sonar.n) { V3.sfx(sonar.g ? 'golpe' : 'tic'); V.esc.sacudir(sonar.g ? .45 : fz === 3 ? .22 : .12); }
      patio3D(dt, now, fz, fin);
      var mr = objn ? Math.atan2(objx / objn - V.mamaX, 6) * .7 : 0;
      var rieM = t - V.evHit < .9;
      mama.anim(fin ? 'saludar' : rieM ? 'aplaudir' : Math.abs(mvx) > .4 ? 'caminar' : 'quieto', { vel: Math.min(1, Math.abs(mvx) / 3) }).cara(fin || rieM ? 'feliz' : 'enojado').rumbo(fin ? 0 : (Math.abs(mvx) > .4 && !objn ? (mvx > 0 ? Math.PI / 2 : -Math.PI / 2) : mr)).update(dt);
      postura(0, mama, V.mamaX, PORCHE_Y, MAMA_Z, fin);
      /* la chancla teledirigida: sombra rosada que persigue, chancla que flota encima y cae */
      for (a = 0; a < tele.length; a++) {
        var tt = tele[a]; if (!tt) continue;
        var o = V.tl[a];
        if (!o) { o = V.tl[a] = { ch: chancla3D('#ff2fa0'), sm: sombra3D(0xff2fa0), cayo: 0, silbo: 0 }; V.esc.scene.add(o.ch); V.esc.scene.add(o.sm.g); }
        var st = teleState(tt, Math.min(now, tt.tl + TELE_CRAWL)), tau = now - tt.tl, vis = !!st && tau <= TELE_T + .45;
        o.ch.visible = vis; o.sm.g.visible = vis && tau < TELE_T + .1; if (!vis) continue;
        var sx = WX(st.x), sz = WZ(st.y);
        o.sm.g.position.set(sx, .05, sz); o.sm.g.scale.set(R * ESX * 1.05, 1, R * ESZ * 1.02); o.sm.di.material.opacity = .35 + .3 * Math.abs(Math.sin(t * 22));
        if (tau < TELE_T - .3) { o.ch.position.set(sx, 3.4 + Math.sin(t * 9) * .3, sz); o.ch.rotation.set(.3, t * 8, 0); o.ch.scale.setScalar(1.6); }
        else if (tau < TELE_T) { var uc = (tau - (TELE_T - .3)) / .3; o.ch.position.set(sx, 3.4 * (1 - uc * uc) + .1, sz); o.ch.rotation.set(t * 18, 0, 0); if (!o.silbo) { o.silbo = 1; V3.sfx('silbido'); } }
        else { o.ch.position.set(sx, .12, sz); o.ch.rotation.set(0, .5, 0); o.ch.scale.setScalar(1.6 * cl(1 - (tau - TELE_T - .2) / .25, 0, 1));
          if (!o.cayo) { o.cayo = 1; V3.sfx('golpe'); V.esc.sacudir(.5); V.part.soltar(sx, .3, sz, 22, { k: 'chispa', cols: ['#ff2fa0', '#fffdf2', '#ffd23f'], vel: 5, arriba: 3, vida: .6 }); } }
      }
      /* los jugadores */
      var nt = 0;
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], pj = s3.pj, tx = WX(q.x), tz = WZ(q.y), ty = 0;
        var mine = c.mio(p), mesa = !q.st && (mine ? (now >= q.tm && now <= q.tm + MESA) : !!q.mesa);
        if (q.st) {                                                             // tía chismosa: tras el chancletazo se va a su mecedora del porche
          if (s3.salio < 0) { s3.salio = t; s3.silla = nt; }
          var si = SILLAS[s3.silla % SILLAS.length];
          if (t - s3.salio > 1.1) { tx = si; tz = MAMA_Z - .2; } else { tx = s3.x; tz = s3.z; }
          nt++;
        }
        var dx = tx - s3.x, dz = tz - s3.z, dd = Math.sqrt(dx * dx + dz * dz), lim = q.st ? 8 * dt : 1e9;
        if (dd > lim) { s3.x += dx / dd * lim; s3.z += dz / dd * lim; } else { s3.x = tx; s3.z = tz; }
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3), vz = (s3.z - s3.pz) / Math.max(dt, 1e-3), v = Math.sqrt(vx * vx + vz * vz);
        s3.px = s3.x; s3.pz = s3.z;
        if (v > .5) s3.rumbo = Math.atan2(vx, vz);
        var sentado = q.st && t - s3.salio > 1.1 && dd < .05;
        ty = cl((-9.4 - s3.z) / .8, 0, 1) * PORCHE_Y + (sentado ? .45 : 0);
        /* ¿una sombra a punto de caerle encima? (cara, mirada y cuerpo) */
        var peligro = false, tl = 9, tx2 = 0, tz2 = 0;
        if (!q.st) for (var key2 in V.chs) { var oc = V.chs[key2]; if (!oc.land && oc.sm.g.visible) { var ddx = oc.sm.g.position.x - s3.x, ddz = oc.sm.g.position.z - s3.z; if (ddx * ddx + ddz * ddz < 9) { peligro = true; if (oc.T - now < tl) { tl = oc.T - now; tx2 = oc.sm.g.position.x; tz2 = oc.sm.g.position.z; } } } }
        var vn = Math.min(1, v / 9), herido = now - q.hurt < .8, lean = 0, hop = 0, sq = 1, roll = 0, th2 = t - s3.hitT;
        var resbala = !q.st && !mesa && v > 2.5 && enCharco(q.x, now), cubre = peligro && tl < .5 && v < 2.5 && !mesa && !herido;
        if (!q.st && chorro(q.x, now)) s3.mojado = t;
        var moja = t - s3.mojado < 3.5; if (moja !== !!s3.mojC) { s3.mojC = moja ? 1 : 0; pj.color(moja ? '#5aa8e0' : null); }
        if (q.st) pj.anim(sentado ? 'sentado' : v > .5 ? 'caminar' : 'triste', { vel: Math.min(1, v / 6) }).cara(sentado ? (lv >= 2 ? 'enojado' : 'triste') : 'mareado');
        else if (fin && now > 0) { pj.anim('celebrar').cara('feliz'); if (!s3.fest) { s3.fest = 1; pj.uno('festejo'); } }
        else if (mesa) pj.anim('agacharse').cara('susto');
        else if (herido && th2 < .8) pj.anim('mareado').cara('mareado');
        else if (t - s3.tumbo < .8) pj.anim('empujado').cara('susto');
        else if (resbala) pj.anim('empujado').cara('susto');
        else if (cubre) pj.anim('agacharse').cara('susto');
        else pj.anim(v > 4 ? 'correr' : v > .8 ? 'caminar' : 'quieto', { vel: vn }).cara(peligro ? 'susto' : moja ? 'triste' : 'concentrado');
        /* esquiva: la chancla cae cerca y no le pegó */
        if (peligro && tl < .08 && tl > -1 && !s3.esq && !mesa && !herido && !q.st) { s3.esq = 1; if (Math.abs(tx2 - s3.x) < 2.4 && Math.abs(tz2 - s3.z) < 2.4) pj.uno('esquivar'); }
        if (!peligro) s3.esq = 0;
        if (!q.st && !(fin && now > 0)) {
          lean += vn * .3; sq += vn * .04;
          if (resbala) { lean = -.3; roll = Math.sin(t * 14) * .2; }
          if (cubre || mesa) sq = .9;
          if (t - s3.tumbo < .7) roll += Math.sin((t - s3.tumbo) * 9) * .5;
          if (v > 5) { s3.polvo -= dt; if (s3.polvo <= 0) { s3.polvo = .11; V.part.soltar(s3.x, .15, s3.z, 2, { k: 'chispa', cols: ['#e3c79a', '#c9a576'], vel: 1.2, arriba: .6, g: 6, vida: .4, esc: .7 }); } }
          if (s3.pv > 6 && v < 2) { V.part.soltar(s3.x, .15, s3.z, 6, { k: 'chispa', cols: ['#e3c79a', '#fffdf2'], vel: 2, arriba: .8, vida: .4 }); sq *= .92; }
          if (resbala && c.fx() < .5) V.part.soltar(s3.x, .2, s3.z, 2, { k: 'gota', cols: ['#7fd6ff', '#fffdf2'], vel: 1.8, arriba: 1.5, vida: .45 });
          var yaw = peligro ? Math.atan2(tx2 - s3.x, tz2 - s3.z) - s3.rumbo : 0; while (yaw > Math.PI) yaw -= 6.2832; while (yaw < -Math.PI) yaw += 6.2832;
          if (peligro) pj.mirarA({ x: tx2, y: .3, z: tz2 }); else pj.mirar(Math.sin(t * .9 + p * 2) * .5, 0);
        } else pj.mirar(0, 0);
        s3.pv = v;
        if (sentado) { var chr2 = V.sillas[s3.silla % V.sillas.length]; lean = chr2.rotation.x * .9; }
        pj.rumbo(sentado ? 0 : mesa ? 0 : s3.rumbo).update(dt);
        pj.g.position.set(s3.x, ty + hop, s3.z + (sentado ? .1 : 0));
        pj.g.rotation.x = lean; pj.g.rotation.z = roll; pj.g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        pj.g.visible = !(now < q.inv && !q.st && Math.floor(t * 14) % 2);    // parpadea mientras es inmune
        var aturde = !q.st && ((herido && th2 < .9) || t - s3.tumbo < 1);
        s3.estr.visible = aturde && pj.g.visible !== false; if (aturde) { s3.estr.position.set(s3.x, ty + 3.9, s3.z); for (var se2 = 0; se2 < 3; se2++) { var sm2 = s3.estr.children[se2]; sm2.position.set(Math.cos(t * 8 + se2 * 2.09) * .6, Math.sin(t * 5 + se2) * .1, Math.sin(t * 8 + se2 * 2.09) * .6); sm2.rotation.y = t * 6; } }
        s3.aro.visible = !q.st; s3.aro.position.set(s3.x, .05, s3.z);
        s3.casco.visible = !!(q.olla && !q.st) && pj.g.visible; if (s3.casco.visible) s3.casco.position.set(s3.x, ty + 3.4 - (mesa ? 1.2 : 0), s3.z);
        /* la mesa: aparece de un salto cuando aprieta A */
        if (mesa !== !!s3.mesaC) { s3.mesaC = mesa ? t : 0; if (mesa) { V3.sfx('pop'); V.part.soltar(s3.x, .3, s3.z, 6, { k: 'chispa', cols: ['#c98a4a', '#fffdf2'], vel: 2.5, arriba: 1.5, vida: .4 }); } }
        s3.mesa.visible = !!mesa;
        if (mesa) { var mu = Math.min(1, (t - s3.mesaC) / .12); s3.mesa.position.set(s3.x, 0, s3.z); s3.mesa.scale.set(1, .4 + .6 * mu, 1); }
        /* la mira de la tía (Nv2+) */
        s3.mira.visible = !!(q.st && lv >= 2 && !fin);
        if (s3.mira.visible) { s3.mira.position.set(WX(q.x), .06, WZ(q.y)); s3.mira.rotation.y = t * 1.5; var pz2 = 1 + .1 * Math.sin(t * 10); s3.mira.scale.set(pz2, 1, pz2); }
      }
      if (fin && !V.fin && now > 0) { V.fin = 1; V3.sfx('aplauso'); var gw = -1; for (p = 0; p < n; p++) if (!P[p].st) gw = p; if (gw >= 0) V.part.soltar(V.pjs[gw].x, 4, V.pjs[gw].z, 40, { k: 'confeti', cols: ROPA, vel: 4, arriba: 6, g: 5, vida: 1.6 }); }
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !P[c.yo].st;
      if (yo) V.flecha.position.set(yo.x, 4.6 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
    }
    /* efectos de los eventos */
    function golpe3D(p, vd) {
      var s3 = v3.pjs[p], mx0 = v3.mamaX, hx = s3.x - mx0, hz = s3.z - MAMA_Z; s3.pj.impacto(hx, hz, vd <= 0 ? 3 : 1.6); s3.hitT = absT; v3.evHit = absT; onda(s3.x, s3.z, 1.6, '#ffd23f'); if (p === c.yo) espanta();
      v3.part.soltar(s3.x, 3.4, s3.z, 14, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff8a3d'], vel: 4, arriba: 3, g: 4, vida: .8 });
      v3.part.soltar(s3.x, 2.6, s3.z, 10, { k: 'confeti', cols: ['#3fa9ff', '#fffdf2'], vel: 4, arriba: 4, vida: .7 });
      V3.sfx('golpe'); if (vd <= 0) V3.sfx('error');
      v3.esc.sacudir(p === c.yo ? 1 : .45);
    }
    function fuera3D(p) { var s3 = v3.pjs[p]; if (!s3.pj.volando) s3.pj.volar(s3.x - v3.mamaX, s3.z - MAMA_Z, 2, { alcance: .6 }); v3.evHit = absT + .3; onda(s3.x, s3.z, 2, '#ff5c5c'); V3.sfx('caida'); v3.part.soltar(s3.x, .4, s3.z, 16, { k: 'chispa', cols: ['#e3c79a', '#c9a576'], vel: 4, arriba: 2, vida: .6 }); }
    function tumbo3D(p) { var s3 = v3.pjs[p]; if (s3) { s3.tumbo = absT; s3.pj.uno('tropezar'); V3.sfx('resbalon'); v3.esc.sacudir(p === c.yo ? .6 : .2); } }
    function olla3D(p, roto) {
      var s3 = v3.pjs[p]; if (!s3) return;
      if (roto) { V3.sfx('golpe'); V3.sfx('ding'); v3.esc.sacudir(.4); v3.part.soltar(s3.x, 3.4, s3.z, 16, { k: 'chispa', cols: ['#a8b0bc', '#fffdf2', '#7fd6c9'], vel: 5, arriba: 3, vida: .6 }); }
      else { V3.sfx('moneda'); v3.part.soltar(s3.x, 2, s3.z, 10, { k: 'confeti', cols: ['#7fd6c9', '#fffdf2'], vel: 3, arriba: 3, vida: .6 }); }
    }
    function tiro3D(p) { var s3 = v3.pjs[p]; if (s3) { s3.pj.uno('lanzar'); V3.sfx('whoosh'); } }
    /* dónde poner un texto 2D sobre un jugador: proyectado desde el 3D, o como en el 2D de siempre */
    function sobre(p, alto) {
      if (v3) { var s3 = v3.pjs[p]; return v3.esc.proyectar(s3.x, alto, s3.z); }
      var G = geom(); return { x: G.ox + P[p].x, y: G.oy + P[p].y - 70 };
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p, h; v3T = absT;   // reloj cosmético del juego (absT avanza en update)
      if (dt > 0) actualizar3D(dt, now);                                         // sin update entre dos cuadros no hay nada que mover
      if (now >= 0 && !(vivos() <= 1)) V3.musica(fase(now) === 3 && now < dur ? 'chancla3' : 'chancla');
      v3.esc.render(dt);
      var cx = (f.x0 + f.x1) / 2;
      for (p = 0; p < n; p++) {
        if (P[p].st) continue;
        var s3 = v3.pjs[p], pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.1), pv = v3.esc.proyectar(s3.x, 4.1, s3.z);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        for (h = 0; h < 2; h++) chancla(pv.x - 9 + h * 18, pv.y, 0, 0.4, h < P[p].vd ? '#3fa9ff' : '#9a98a8');     // las vidas: 2 chanclas
      }
      for (p = 0; p < n; p++) if (P[p].st && lv >= 2 && !(vivos() <= 1)) { var pm = v3.esc.proyectar(WX(P[p].x), 0, WZ(P[p].y) + 1.6); txt('TÍA', pm.x, pm.y, 10, '#fffdf2', 0, true); }
      if (now < 3.2 && !c.practica) { var pmm = v3.esc.proyectar(v3.mamaX, PORCHE_Y + 5.4, MAMA_Z); txt('¿¡QUIÉN DEJÓ LA NEVERA ABIERTA!?', pmm.x, Math.max(84, pmm.y), 16, '#ff5c5c', 0, true); }
      for (p = 0; p < EVS.length; p++) if (EVS[p].k === 'perro' && now >= EVS[p].tw && now < EVS[p].t0) { var pg = v3.esc.proyectar(WX(EVS[p].dir > 0 ? -18 : AW + 18), 2.6, WZ(EVS[p].y)); txt('¡GUAU!', pg.x, pg.y, 16 + Math.sin(absT * 20) * 2, '#ffd23f', 0, true); }
      if (v3.dogAl < .3) for (h = 0; h < 3; h++) {                                // Canelo ronca: zzz
        var zf = (absT * .5 + h / 3) % 1, pz = v3.esc.proyectar(11.5, PORCHE_Y + 1.4, -10.7);
        ctx.save(); ctx.globalAlpha = (1 - zf) * (1 - v3.dogAl * 3); txt('z', pz.x + zf * 16, pz.y - zf * 34, 9 + zf * 9, '#fffdf2', 0, true); ctx.restore();
      }
      carteles(cx, 112, now);
      if (typeof drawP === 'function') drawP();
    }

    /* el letrero de arriba (3D y 2D): reglas al empezar, cambios de fase, avisos de los eventos, tías y teledirigida */
    function cartel(now) {
      var e, ev;
      if (banT > 0 && banner === 2) return ['¡LA CHANCLA TELEDIRIGIDA!', '#ff5c8a', 20];
      if (now >= -0.4 && now < 2.4 && !c.practica) return ['¡SAL DE LA SOMBRA ROJA!', '#fffdf2', 22, 'A = ¡BAJO LA MESA!'];
      if (now >= P3 - 0.2 && now < P3 + 2.4) return ['¡ÚLTIMOS SEGUNDOS! ¡LLUEVEN CHANCLAS!', '#ffd23f', 24, 'mamá, abuela y tía · ¡corre al hueco!'];
      if (now >= P2 - 0.2 && now < P2 + 2.2) return ['¡LLEGÓ LA ABUELA! ¡MÁS CHANCLAS!', '#ff8a3d', 22, 'café = chanclón · verde = rebota'];
      for (e = 0; e < EVS.length; e++) {
        ev = EVS[e]; if (now < ev.tw || now >= ev.t0 + 1.0) continue;
        if (ev.k === 'perro') return ['¡CUIDADO, EL PERRO!', '#ffd23f', 22, 'te tumba · pero se come las chanclas de su fila'];
        if (ev.k === 'manguera') return ['¡LA MANGUERA DEL VECINO!', '#7fd6ff', 22, 'el chorro arrastra · el charco resbala'];
        return ['¡SE FUE LA LUZ!', '#fffdf2', 24, 'mira las sombras'];
      }
      for (e = 0; e < OLLAS.length; e++) if (OLLAS[e].tom < 0 && now >= OLLAS[e].t0 - 0.6 && now < OLLAS[e].t0 + 1.0) return ['¡UNA OLLA! AGÁRRALA', '#7fd6c9', 20, 'de casco te para un chancletazo'];
      if (banT > 0 && banner === 1) return ['¡LAS TÍAS CHISMOSAS CONTRAATACAN!', '#ff5c8a', 20];
      if (c.yo >= 0 && P[c.yo].st && lv >= 2 && now - P[c.yo].outAt < 3.5 && vivos() > 1) return ['ERES TÍA CHISMOSA: APUNTA Y LANZA CON A', '#ff5c8a', 15];
      return null;
    }
    function carteles(cx, y, now) {
      var k = cartel(now); if (!k) return;
      txt(k[0], cx, y, k[2] + Math.sin(absT * 14), k[1], 0, true);
      if (k[3]) txt(k[3], cx, y + 24, 14, '#fffdf2', 0, true);
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, a;
        absT += dt; banT = Math.max(0, banT - dt); shake = Math.max(0, shake - dt * 3);
        /* el juez dispara las teledirigidas sembradas (cada pantalla las pinta al llegar el ev) */
        if (c.juez() && now >= 0) for (a = 0; a < teleT.length; a++) if (!teleSent[a] && now >= teleT[a] && !tele[a]) {
          teleSent[a] = 1; var ld = lider(); if (ld >= 0 && vivos() >= 2) c.ev('tele', { i: a, to: ld, tl: Math.round((now + 0.05) * 1000) });
        }
        for (p = 0; p < n; p++) updPos(p, dt, now);
        /* mamá lanza al nacer cada sombra */
        for (a = 0; a < lanz.length; a++) { var Tl = lanz[a].T - WARN; if (Tl > lastVol && Tl <= now) { mamT = now; lastVol = Tl; } if (Tl > now) break; }
        /* aterrizajes (cosmético) */
        for (a = 0; a < lanz.length; a++) { var T = lanz[a].T; if (T > now - 0.03 && T <= now && !lanz[a].pl) { lanz[a].pl = 1; plafs.push({ x: lanz[a].x, y: lanz[a].y, t: now }); if (!v3) SND(180, 0.1, 'triangle', 0.04); shake = Math.max(shake, 0.12); } if (T > now) break; }
        for (a = 0; a < extras.length; a++) { var Te = extras[a].T; if (Te > now - 0.03 && Te <= now && !extras[a].pl) { extras[a].pl = 1; plafs.push({ x: extras[a].x, y: extras[a].y, t: now }); if (!v3) SND(180, 0.1, 'triangle', 0.04); } }
        while (plafs.length && now - plafs[0].t > 0.5) plafs.shift();
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (P[p].st) aiTia(p, dt, api, now); else aiVivo(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p];
        return { x: Math.round(q.x), y: Math.round(q.y), vd: q.vd, mesa: q.mesa ? 1 : 0, st: q.st, sc: q.sc };
      },
      onEv: function (ty, p, d, t) {
        var now = c.ahora(), q = P[p], G = geom();
        if (ty === 'hit' && q && d && d.ol) {                                 // la olla paró el chancletazo
          if (!q.st) { q.olla = 0; q.inv = Math.max(q.inv, (d.k / 30) + INV); var po = sobre(p, 4.4); S('¡CLANG! ¡LA OLLA TE SALVÓ!', po.x + 18, po.y, '#7fd6c9'); if (v3) olla3D(p, 1); else SND(900, 0.15, 'square', 0.05); }
        } else if (ty === 'olla' && q && d) {
          if (OLLAS[d.i]) OLLAS[d.i].tom = p; if (!q.st) q.olla = 1;
          if (p === c.yo) { var pg = sobre(p, 4.4); S('¡OLLA DE CASCO!', pg.x + 18, pg.y, '#7fd6c9'); }
          if (v3) olla3D(p, 0); else SND(700, 0.1, 'triangle', 0.05);
        } else if (ty === 'hit' && q && d) {
          if (!q.st && q.vd > 0) {
            q.vd--; q.hurt = now; q.inv = Math.max(q.inv, (d.k / 30) + INV); q.mood = 1; shake = 0.55;
            var ps = sobre(p, 4.4); S(q.vd > 0 ? '¡CHANCLETAZO!' : '¡FUERA!', ps.x + 18, ps.y, q.vd > 0 ? '#ffd23f' : '#ff5c5c');
            if (v3) golpe3D(p, q.vd);
            else { SPAWN(G.ox + q.x, G.oy + q.y - 30, 10, 'conf', ['#3fa9ff', '#fffdf2', '#ffd23f'], 280, 500, 0.7); SND(140, 0.25, 'sawtooth', 0.08, -90); }
          }
        } else if (ty === 'out' && q) { var era = q.st; elim(p, d && d.kk != null ? d.kk : Math.floor(now * 30)); if (v3 && !era) fuera3D(p); }
        else if (ty === 'shot' && d) {
          var Tn = d.tl / 1000;
          if (Tn > now - 0.03 && extras.length < 60) { var xa = { T: Tn, x: cl(d.x, 0, AW), y: cl(d.y, 0, AH), by: p, w: 1.0, r: R, k: 'n', rob: 0 }; robar(xa); extras.push(xa); mamT = now; if (q) q.mood = 1; if (v3) tiro3D(p); }
          if (!banner) { banner = 1; banT = 1.4; }
        } else if (ty === 'tele' && d && !tele[d.i]) {
          tele[d.i] = { i: d.i, to: d.to, tl: d.tl / 1000, sim: null, fin: 0 }; banner = 2; banT = 2;
          if (v3) { V3.sfx('silbato'); V3.sfx('bocina'); v3.mama.uno('lanzar'); }
        }
      },
      claimOk: function () { return false; },
      concede: function () {},
      alCpu: function (p) { P[p].own = false; var r = c.remoto(p); if (r && !P[p].st) { P[p].x = r.x; P[p].y = r.y; } },
      alHum: function (p, o) { P[p].own = false; if (o) { if (o.st && !P[p].st) elim(p, o.sc); else if (!o.st) { P[p].x = o.x; P[p].y = o.y; if (o.vd < P[p].vd) P[p].vd = o.vd; } } },
      alRemoto: function (p, o) { if (o && o.st && !P[p].st) elim(p, o.sc); },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) out.push(P[p].st ? P[p].sc : dur * 30 + 1);
        return out;
      },
      done: function () { return vivos() <= 1; },
      vivo: function (p) { return !P[p].st; },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0];
        if (!q) return '';
        return q.st ? 'aguantó ' + Math.max(0, Math.floor(q.sc / 30 - lead + 0.99)) + ' s' : 'ni un chancletazo de más';
      },
      vista: function () {
        var now = c.ahora();
        return { gt: now, lv: lv, lead: lead, hash: hash, nLanz: nplafs, lanz: lanz.map(function (a) { return [+a.T.toFixed(3), Math.round(a.x), Math.round(a.y)]; }),
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), vd: P.map(function (q) { return q.vd; }), st: P.map(function (q) { return q.st; }),
          sc: P.map(function (q) { return q.sc; }), tm: P.map(function (q) { return q.tm; }), inv: P.map(function (q) { return q.inv; }), vivos: vivos(), extras: extras.length, P2: P2, P3: P3, fase: now >= 0 ? fase(now) : 1, evs: EVS.map(function (e) { return [e.k, +e.t0.toFixed(3)]; }),
          ollas: OLLAS.map(function (o) { return [+o.t0.toFixed(3), Math.round(o.x), Math.round(o.y), o.tom]; }), olla: P.map(function (q) { return q.olla; }), stun: P.map(function (q) { return q.stun; }),
          robadas: lanz.filter(function (a) { return a.rob; }).length, tipos: lanz.map(function (a) { return a.k; }).join(''), tele: tele.filter(Boolean).length, R: R, mcd: MCD, mesa: MESA };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        dibujar2D();
      }
    };
    return g;

    /* ───── 2D de respaldo (sin WebGL o ?plano=1): el dibujo de siempre, sin cambios ───── */
    function dibujar2D() {
        var f = cp(), G = geom(), now = c.ahora(), p, a, ox = G.ox, oy = G.oy;
        var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
        ctx.save(); ctx.translate(sxk, syk);
        fondo(f, G);
        /* sombras de aviso */
        /* charcos y franjas de la manguera */
        for (a = 0; a < EVS.length; a++) {
          var ev = EVS[a];
          if (ev.k === 'manguera' && now >= ev.tw && now < ev.t1) { ctx.save(); ctx.globalAlpha = now < ev.t0 ? 0.15 + 0.15 * Math.abs(Math.sin(absT * 12)) : 0.4; rr(ox + ev.x - MANG_A, oy, MANG_A * 2, AH, 10, '#3fa9ff', 0); ctx.restore(); }
          if (ev.k === 'perro' && now >= ev.tw && now < ev.t1) { ctx.save(); ctx.globalAlpha = 0.25; rr(ox, oy + ev.y - 20, AW, 40, 8, '#ffd23f', 0); ctx.restore(); }
        }
        for (a = 0; a < OLLAS.length; a++) { var ol = OLLAS[a]; if (ol.tom < 0 && now >= ol.t0 && now < ol.t1) { ell(ox + ol.x, oy + ol.y, 16, 11, '#a8b0bc', 3); rr(ox + ol.x - 18, oy + ol.y - 14, 36, 6, 3, '#8a92a0', 2); } }
        var todas = lanz.concat(extras);
        for (a = 0; a < todas.length; a++) {
          var la = todas[a], T = la.T, dtt = T - now, wn = la.w || 1.0, rk = (la.r || R);
          if (dtt > wn + 0.05 || dtt < -0.02 || (la.rob && now >= la.rob)) continue;
          var u = cl(1 - dtt / wn, 0, 1), rad = rk * (0.35 + 0.65 * u), pul = 0.35 + 0.25 * Math.abs(Math.sin(absT * 16));
          ctx.save(); ctx.globalAlpha = pul; ell(ox + la.x, oy + la.y + 8, rad, rad * 0.62, '#ff3b4e', 0); ctx.restore();
          /* la chancla en vuelo (por encima de su sombra) */
          var fl = u, fy = oy + la.y - (1 - fl) * 200 - Math.sin(fl * Math.PI) * 30 + 6;
          chancla(ox + la.x + (1 - fl) * (la.by >= 0 ? 0 : (AW / 2 - la.x) * 0.3), fy, absT * 12, (1.1 - 0.1 * fl) * (la.k === 'g' ? 1.8 : 1), la.k === 'g' ? '#8a4a2a' : la.k === 'r' || la.k === 'r2' ? '#7fd64a' : la.k === 'b' ? '#ff5c8a' : '#3fa9ff');
        }
        /* el perro */
        for (a = 0; a < EVS.length; a++) { var ep = EVS[a]; if (ep.k === 'perro' && now >= ep.t0 && now < ep.t1) { var dxx = ox + dogX(ep, now), dyy = oy + ep.y; ell(dxx, dyy - 10, 22, 12, '#c98a4a', 3); ell(dxx + ep.dir * 20, dyy - 20, 10, 9, '#c98a4a', 3); } }
        /* teledirigidas */
        for (a = 0; a < tele.length; a++) {
          var t = tele[a]; if (!t) continue;
          var st = teleState(t, Math.min(now, t.tl + (TELE_CRAWL))), tau = now - t.tl;
          if (!st || tau > TELE_T + 0.35) continue;
          var pu = 0.45 + 0.3 * Math.abs(Math.sin(absT * 22)), cx = ox + st.x, cy = oy + st.y + 8;
          ctx.save(); ctx.globalAlpha = pu; ell(cx, cy, R * 1.05, R * 0.66, '#ff2fa0', 0); ctx.restore();
          if (tau < TELE_T) chancla(cx, cy - 50 + Math.sin(absT * 9) * 6, absT * 14, 1.25, '#ff2fa0');
        }
        /* manchas de aterrizaje */
        for (a = 0; a < plafs.length; a++) { var ag = now - plafs[a].t, rr0 = R * (0.8 + ag * 0.6); if (ag >= 0 && ag < 0.45) { ctx.save(); ctx.globalAlpha = 1 - ag / 0.45; ell(ox + plafs[a].x, oy + plafs[a].y + 8, rr0, rr0 * 0.62, '#fffdf2', 3); chancla(ox + plafs[a].x, oy + plafs[a].y + 4, 0.4, 1.1); ctx.restore(); } }
        ctx.restore();
        /* mamá encima de todo el escenario */
        ctx.save(); ctx.translate(sxk, syk); mama(G, now);
        /* los vivos, por profundidad */
        var ord = [];
        for (p = 0; p < n; p++) if (!P[p].st) ord.push(p);
        ord.sort(function (a2, b2) { return P[a2].y - P[b2].y; });
        for (a = 0; a < ord.length; a++) {
          p = ord[a]; var q = P[p], mine = c.mio(p), mesa = mine ? (now >= q.tm && now <= q.tm + MESA) : !!q.mesa;
          persona(p, ox + q.x, oy + q.y, q.vd, mesa, now);
          if (q.olla) ell(ox + q.x, oy + q.y - 120, 16, 8, '#a8b0bc', 3);
          txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 15, 11, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        }
        /* tías chismosas: fuera de juego, con su mira */
        var tn = 0;
        for (p = 0; p < n; p++) if (P[p].st) {
          var tq = P[p], tx = f.x0 + 46 + tn * 70, ty = oy + AH + 38; tn++;
          if (lv >= 2) {
            var ax = ox + tq.x, ay = oy + tq.y, col = asiento(p).color || '#fff', pz = 1 + 0.12 * Math.sin(absT * 10);
            line([[ax - 20, ay], [ax + 20, ay]], 3, col); line([[ax, ay - 20], [ax, ay + 20]], 3, col);
          }
          c.util.pj(asiento(p).ch, tx, ty, 46, { animo: 'perder', sombra: false }); txt('TÍA', tx, ty + 30, 10, '#fffdf2', 0, true);
        }
        ctx.restore();
        var apag = 0; for (a = 0; a < EVS.length; a++) if (EVS[a].k === 'apagon' && now >= EVS[a].t0 && now < EVS[a].t1) apag = 1;
        if (apag) { ctx.save(); ctx.globalAlpha = 0.7; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#07061a', 0); ctx.restore(); }
        if (now >= P3 && now < dur) { ctx.save(); ctx.globalAlpha = 0.08 + 0.05 * Math.sin(absT * 9); rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ff3b2a', 0); ctx.restore(); }
        carteles((f.x0 + f.x1) / 2, 100, now);
        if (typeof drawP === 'function') drawP();
    }
  }
});
})();
