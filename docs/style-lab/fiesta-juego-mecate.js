'use strict';
/* LA FIESTA · ¡SALTA EL MECATE! (f_mecate) · modelo A (cancha propia) · supervivencia
   Dos vecinas le dan a la cuerda en la calle del barrio y los jugadores brincan en fila entre ellas.
   La cuerda es función PURA de (semilla, gt): `cruces` (los instantes en que la cuerda pasa por el suelo) sale de c.rng en mk,
   así que las n pantallas ven la misma cuerda. Cada dueño juzga SU cuerpo: la hora del fallo es el cruce T (determinista), de
   modo que kk_out = floor(T*30) es igual para cualquier observador. Los rivales se ven EN VIVO por el `o` (y, st, sc).
   Reglas (doc M2-SPEC §6.2):
     - A estando en el suelo y vivo = vuelo de 0,52 s, h(τ)=4*70*τ(1-τ). Un cruce se SUPERA si en T vuelas con h>=22
       (τ en [0,0855; 0,9145]). Tras aterrizar hay 0,06 s de "tropiezo" (no se puede brincar de nuevo) y un toque dado
       en los últimos 0,12 s del tropiezo se guarda y sale solo (para que ritmo rápido no dependa de un cuadro).
     - Nivel 1 cuerda pareja 1,10 -> 0,70 s; Nivel 2 con golpes irregulares (jitter sembrado); Nivel 3 cuerda DOBLE
       (pares de cruces separados 0,28 s, un solo brinco cubre el par si lo das en la ventana justa).
     - Puntaje: eliminado = tick del fallo; vivo = dur*30+1. done() = quedan <=1 vivos. Empatan los que llegan al final.
     - ESCALADA (por c.ahora()/dur, sirve igual con dur 10): primer tercio tranquilo, desde el 34 % «¡MÁS RÁPIDO!», y desde el
       72 % «¡ÚLTIMOS SEGUNDOS!» (cuerda un 10 % más rápida, eventos cada ~3,5 s, más dorados, música y luces de rumba).
     - EVENTOS sembrados en mk (c.rng), con aviso 1 s antes: «se emocionaron» (cuerda ×0,78), «se cansaron» (×1,4), DOBLE MECATE
       en niveles 1-2 (pares a 0,28 s), MECATE DORADO (un brinco perfecto, con el cruce cerca de la cima, da una CHUPETA = vida
       extra: el próximo fallo no te saca), y las PAUSAS: el mecate se para arriba y cruza la fila una pelota, un perro, dos perros
       o dos pelotas por lados distintos. Cada peligro le llega a cada jugador a SU hora (según su sitio en la fila) y se juzga
       igual que un cruce (volando con h>=22). Todo sale de c.rng: las horas son iguales en todas las pantallas.
   Dibujo: 3D low poly (fiesta-3d.js; doc 15): la calle del barrio, dos chamos le dan al mecate con los brazos dando la vuelta completa
   (el mecate va amarrado a sus manos), que gira con arco real y deja su sombra en
   el piso para leer el tiempo. Sin WebGL o con ?plano=1, el 2D de siempre (dibujar2D). Se carga DESPUÉS de fiesta-live.js.
   Dibuja SOLO con las primitivas del laboratorio. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_mecate')) return;

var FLY = 0.52, REC = 0.06, BUF = 0.12, HMAX = 70, HOK = 22, SEP = 0.28, GY = 430, HANDY = 360, INKC = '#14101c';
var PLAN_H = 1.0;

function lerp(a, b, u) { return a + (b - a) * u; }
function cl01(u) { return u < 0 ? 0 : u > 1 ? 1 : u; }
function altura(tau) { return tau <= 0 || tau >= 1 ? 0 : 4 * HMAX * tau * (1 - tau); }
var TAU_OK = (function () {                      // τ mínimo y máximo con h>=HOK: 4*70*τ(1-τ)=22
  var d = Math.sqrt(1 - 4 * HOK / (4 * HMAX));   // raíces de τ(1-τ)=HOK/(4*HMAX)
  return [(1 - d) / 2, (1 + d) / 2];
})();

/* paleta por nivel: 1 día, 2 atardecer, 3 noche */
var PAL = {
  1: { sky: '#8fd8ff', sky2: '#d8f4ff', casas: ['#ffb36b', '#a9a0ff', '#ff9ec7', '#6ecf8f', '#ffd23f', '#8aa0ff'], vent: '#fff8d8', acera: '#d8d2c4', calle: '#4d4a6e', raya: '#f5f0dc', sol: '#ffe14d' },
  2: { sky: '#ff8f5a', sky2: '#ffd08a', casas: ['#c9704f', '#8c6aa8', '#d77a9a', '#5a9a78', '#c9a040', '#6a7ab8'], vent: '#ffe39a', acera: '#c8b4a0', calle: '#4a3a5a', raya: '#f0d8b0', sol: '#ffe9a0' },
  3: { sky: '#1d1a4a', sky2: '#3a3478', casas: ['#3b3a7a', '#4a3a6a', '#5a3a68', '#2f5a6a', '#5a5a3a', '#3a4a8a'], vent: '#ffe27a', acera: '#6a6684', calle: '#2a2840', raya: '#b8b4d0', sol: '#f4f0d0' }
};

FIESTA.LIVE.add('f_mecate', {
  name: '¡SALTA EL MECATE!', modos: ['ffa', '1v1'], clase: 'survival', modelo: 'A', dur: 45,
  stick: false, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
  cuerpo: ['y', 'st', 'sc'], discretos: ['st', 'sc'],
  carta: {
    obj: 'Brinca cuando pase el mecate',
    gana: 'El último en pie. Si quedan varios, empatan arriba.',
    como: { tactil: 'A = saltar', teclado: 'ESPACIO o J' },
    demos: [{ id: 'saltar', txt: 'Salta justo cuando la cuerda pasa por el suelo' }],
    roles: null
  },
  mk: function (c) {
    var n = c.n, dur = c.dur, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, pal = PAL[lv], rng = c.rng;
    var SEPX = 1.55, XR = Math.max(5.2, (n - 1) / 2 * SEPX + 3.2);   // la fila (x de cada jugador) y las manos de los que le dan: también los usa la simulación (peligros)
    function xJug(p) { return (p - (n - 1) / 2) * SEPX; }

    /* ───── las fases: tranquilo, más rápido y ¡ÚLTIMOS SEGUNDOS! (fracción de dur: escala con cualquier duración) ───── */
    var lead = Math.min(3, 0.35 * dur), F1 = dur * 0.34, F2 = dur * 0.72;
    function fase(t) { return t < F1 ? 0 : t < F2 ? 1 : 2; }

    /* ───── los eventos del barrio (solo c.rng, solo aquí) ───── */
    var TIPOS = [['lento', 'dorado', 'pelota', 'sincopa'], ['rapido', 'pelota', 'perro', 'doble', 'dorado', 'lento', 'sincopa', 'moto'], ['rapido', 'doble', 'pelotas', 'perros', 'dorado', 'perro', 'rafaga', 'moto', 'sincopa', 'rafaga']];
    var DUR_EV = { rapido: 3, lento: 2.4, doble: 3, dorado: 3.2, pelota: 2.6, perro: 2.6, perros: 3.2, pelotas: 3.6, sincopa: 4, rafaga: 3.4, moto: 2.4 };
    var PAUSA = { pelota: 1, perro: 1, perros: 1, pelotas: 1, moto: 1 };
    var EVS = [], escG = Math.max(0.55, Math.min(1, dur / 30)), te = lead + Math.min(2.4, dur * 0.12), prevK = '', i;
    while (te < dur - 1.4) {
      var fz = fase(te), lt = TIPOS[fz], k = lt[rng.int(0, lt.length - 1)];
      if (k === prevK) k = lt[rng.int(0, lt.length - 1)];
      if (lv === 3 && k === 'doble') k = 'rapido';
      if (k === 'rafaga' && lv === 1) k = 'rapido';
      EVS.push({ k: k, t: te, d: DUR_EV[k], pausa: !!PAUSA[k], ini: null, fin: null, id: EVS.length });
      prevK = k;
      te = Math.max(te + ((fz === 0 ? 5.6 : fz === 1 ? 4.6 : 3.4) + rng.next() * 1.2) * escG, te + DUR_EV[k] + 0.9);
    }
    function activo(t) { for (var j = 0; j < EVS.length; j++) { var e = EVS[j]; if (!e.pausa && t >= e.t && t < e.t + e.d) return e; } return null; }

    /* los peligros que cruzan la fila en una pausa: {k, dir, v, t0 (cuando pasa por X0), X0}. A cada jugador le llega a su hora */
    var HZ = [];
    function golpe(h, p) { return h.t0 + (xJug(p) - h.X0) * h.dir / h.v; }
    function armarPausa(ev, ini) {
      /* las horas del mundo no dependen de n (la misma calle con 1 o 4): se calculan para una fila de 4 */
      var maxX = Math.max(1.5 * SEPX, (n - 1) / 2 * SEPX), dir = rng.next() < 0.5 ? 1 : -1, hs = [], j, tl = ini;
      if (ev.k === 'pelota') hs.push({ k: 'pelota', dir: dir, v: 6.5, t0: ini + 0.35 });
      else if (ev.k === 'perro') hs.push({ k: 'perro', dir: dir, v: 8.5, t0: ini + 0.35 });
      else if (ev.k === 'moto') hs.push({ k: 'moto', dir: dir, v: 14, t0: ini + 0.35 });
      else if (ev.k === 'perros') { hs.push({ k: 'perro', dir: dir, v: 8.5, t0: ini + 0.35 }); hs.push({ k: 'perro', dir: dir, v: 8.5, t0: ini + 1.1 }); }
      else {                                       // por los dos lados: la segunda sale tarde para que nadie tenga dos golpes a menos de 0,62 s
        var D = 0.62 + 2 * maxX / 6.5 + rng.next() * 0.25;
        hs.push({ k: 'pelota', dir: dir, v: 6.5, t0: ini + 0.35 }); hs.push({ k: 'pelota', dir: -dir, v: 6.5, t0: ini + 0.35 + D });
      }
      for (j = 0; j < hs.length; j++) {
        hs[j].X0 = -hs[j].dir * (maxX + 5.2); hs[j].ev = ev.id; HZ.push(hs[j]);
        tl = Math.max(tl, hs[j].t0 + (2 * maxX + 5.2) / hs[j].v);   // al último de la fila
      }
      ev.ini = ini; ev.fin = tl + 0.95;
      return ev.fin;                               // el mecate arranca otra vez aquí
    }

    /* ───── el mundo: lista de cruces, idéntica en todos ───── */
    var cruces = [], t = lead, prevT = -9, trasPausa = false, sinc = 0;
    while (t <= dur + 1) {
      var pe = null, j2;
      if (!trasPausa) for (j2 = 0; j2 < EVS.length; j2++) if (EVS[j2].pausa && EVS[j2].ini === null && !EVS[j2].nulo && t >= EVS[j2].t) { pe = EVS[j2]; break; }
      if (pe) { if (prevT > 0) { t = armarPausa(pe, prevT); trasPausa = true; continue; } pe.nulo = true; }
      trasPausa = false;
      var u = cl01(t / dur), f = t >= F2 ? 0.9 : 1, act = activo(t);
      if (act && act.ini === null) { act.ini = act.t; act.fin = act.t + act.d; }
      if (act && act.k === 'rapido') f *= 0.78; else if (act && act.k === 'lento') f *= 1.4;
      else if (act && act.k === 'rafaga') f *= 0.7;
      else if (act && act.k === 'sincopa') { sinc ^= 1; f *= sinc ? 0.66 : 1.4; }   // tum-ta… tum-ta: golpe corto y golpe largo
      var oro = act && act.k === 'dorado' ? act.id : -1;
      if (lv === 3 || (act && act.k === 'doble')) {
        cruces.push({ t: t, doble: true, r: 0, oro: oro, cen: t + SEP / 2 }); cruces.push({ t: t + SEP, doble: true, r: 1, oro: oro, cen: t + SEP / 2 });
        prevT = t + SEP; t += Math.max(lv === 3 ? 0.7 : 0.85, lerp(1.20, 0.80, u) * f);
      } else {
        cruces.push({ t: t, doble: false, r: 0, oro: oro, cen: t }); prevT = t;
        if (lv === 2) t += Math.max(0.62, (lerp(1.05, 0.62, u) + (rng.next() * 2 - 1) * 0.12) * f);
        else t += Math.max(0.64, lerp(1.10, 0.70, u) * f);
      }
    }
    /* lo que cada jugador tiene que brincar: los cruces (todos) + los peligros (a su hora). Grupos = un solo brinco */
    var OBS = [], grupos = [], p0;
    for (p0 = 0; p0 < n; p0++) {
      var L = [], gr = [];
      for (i = 0; i < cruces.length; i++) L.push({ t: cruces[i].t, oro: cruces[i].oro, cen: cruces[i].cen, hz: null });
      for (i = 0; i < HZ.length; i++) L.push({ t: golpe(HZ[i], p0), oro: -1, cen: 0, hz: HZ[i].k });
      L.sort(function (a, b) { return a.t - b.t; });
      for (i = 0; i < L.length; i++) {
        var g0 = L[i].t, g1 = g0;
        while (i + 1 < L.length && L[i + 1].t - g0 <= 0.40) { i++; g1 = L[i].t; }
        gr.push({ T: g1, aim: (g0 + g1) / 2 - 0.26 });
      }
      OBS.push(L); grupos.push(gr);
    }
    /* el skyline (sembrado: mismo paisaje en todas las pantallas) */
    var casas = [], cx0 = 0;
    for (i = 0; i < 14; i++) { var cw = 90 + rng.int(0, 60); casas.push({ x: cx0, w: cw, h: 70 + rng.int(0, 70), k: rng.int(0, 5), v: rng.int(2, 3) }); cx0 += cw + 4; }
    var estrellas = [];
    for (i = 0; i < 26; i++) estrellas.push([rng.next(), rng.next() * 0.55, 1 + rng.next() * 2]);

    /* ───── estado por jugador ───── */
    var P = [], cpuR = [], plan = [];
    for (i = 0; i < n; i++) {
      P.push({ y: 0, st: 0, sc: 0, tj: -9, buf: -9, jumps: [], nextI: 0, own: false, outAt: -9, ev: 0, tapped: 0,
        esc: 0, gracia: -9, salvoT: -9, chup: 0, chupT: -9, ultOro: -1 });
      cpuR.push(c.rngFor('cpu' + i));
      plan.push({ g: 0, at: null });
    }
    var sndI = -1, lastCross = -1;

    function elim(p, kk) {
      var q = P[p];
      if (q.st) return;
      q.st = 1; q.sc = Math.max(0, kk | 0); q.y = 0; q.outAt = c.ahora();
    }
    function siguiente(gt) { var k = 0; while (k < cruces.length && cruces[k].t <= gt) k++; return k; }
    function cubre(tj, T) { var tau = (T - tj) / FLY; return tau >= TAU_OK[0] && tau <= TAU_OK[1]; }
    function SND(f, d, ty, v) { try { if (typeof snd === 'function') snd(f, d, ty, v); } catch (e) { /* sin audio */ } }

    function mio(p) { return c.mio(p); }

    function updJugador(p, gt) {
      var q = P[p], O = OBS[p];
      if (!mio(p)) {                              // remoto: lo que manda su dueño (o el juez si es CPU)
        q.own = false;
        var r = c.remoto(p);
        if (r) { if (!q.st) q.y = r.y || 0; if (r.st && !q.st) elim(p, r.sc); }
        return;
      }
      if (!q.own) { q.own = true; q.nextI = 0; while (q.nextI < O.length && O[q.nextI].t <= gt) q.nextI++; q.buf = -9; if (q.st) q.y = 0; }   // empiezo o heredo (juez que toma una CPU)
      var taps = c.tap(p, 'a');
      if (q.st) { q.y = 0; return; }
      if (gt < 0) { q.y = 0; return; }
      if (taps > 0) {
        if (gt >= q.tj + FLY + REC) { q.tj = gt; q.jumps.push(gt); if (q.jumps.length > 4) q.jumps.shift(); if (p === c.yo) SND(520, 0.1, 'square', 0.05); }
        else if (gt >= q.tj + FLY + REC - BUF) q.buf = gt;   // cae dentro de la ventana de guardado
      }
      if (q.buf > -1 && gt >= q.tj + FLY + REC && gt - q.buf <= BUF) { q.tj = gt; q.jumps.push(gt); if (q.jumps.length > 4) q.jumps.shift(); q.buf = -9; }
      q.y = altura((gt - q.tj) / FLY);
      /* juzgo lo que ya pasó (cruces y peligros): tiene que estar volando con h>=22 en T */
      while (q.nextI < O.length && O[q.nextI].t <= gt) {
        var ob = O[q.nextI], T = ob.t, jj = -9, j;
        for (j = 0; j < q.jumps.length; j++) if (q.jumps[j] <= T && cubre(q.jumps[j], T)) { jj = q.jumps[j]; break; }
        q.nextI++;
        if (jj < -1) {
          if (T <= q.gracia) continue;             // lo que venía pegado al fallo que salvó la chupeta
          if (q.esc > 0) { q.esc--; q.gracia = T + 0.45; q.salvoT = gt; if (p === c.yo) SND(880, 0.2, 'triangle', 0.06); continue; }
          var kk = Math.floor(T * 30); elim(p, kk); c.out(p, kk); q.y = 0; if (p === c.yo) SND(160, 0.35, 'sawtooth', 0.06); break;
        }
        /* mecate dorado: si el cruce te agarra cerca de la cima del brinco, te ganas la chupeta (vida extra, máximo una) */
        if (ob.oro >= 0 && ob.oro !== q.ultOro && Math.abs((ob.cen - jj) / FLY - 0.5) <= 0.2) {
          q.ultOro = ob.oro; q.chup++; q.chupT = gt; if (q.esc < 1) q.esc = 1;
          if (p === c.yo) SND(1320, 0.12, 'square', 0.05);
        }
      }
    }

    function vivos() { var k = 0, p; for (p = 0; p < n; p++) if (!P[p].st) k++; return k; }
    function pose(p) {                            // lo que se dibuja de p (remoto en vivo desde el interpolador)
      var q = P[p], r = !mio(p) ? c.remoto(p) : null;
      if (r) return { y: q.st ? 0 : (r.y || 0), st: q.st || (r.st ? 1 : 0) };
      return { y: q.y, st: q.st };
    }
    function faseU(gt, lista) {                   // 0..1 de la vuelta del mecate (0 y 1 = pegando en el piso); en una pausa se queda arriba (0,5)
      var L2 = lista.length, k = 0;
      if (!L2) return 0;
      while (k < L2 && lista[k] <= gt) k++;
      var per = L2 > 1 ? lista[L2 - 1] - lista[L2 - 2] : 1;
      var tn = k < L2 ? lista[k] : lista[L2 - 1] + per;
      var tp = k > 0 ? lista[k - 1] : lista[0] - (L2 > 1 ? lista[1] - lista[0] : 1);
      if (k >= L2) tp = tn - per;
      if (gt < tp) return 0;
      if (tn - tp > 1.5) {                         // pausa: sube en media vuelta, espera arriba y baja en media vuelta
        var h = 0.45;
        if (gt - tp < h) return (gt - tp) / h * 0.5;
        if (tn - gt < h) return 1 - (tn - gt) / h * 0.5;
        return 0.5;
      }
      return cl01((gt - tp) / (tn - tp));
    }
    var listas = [[], []];                        // vuelta de cada mecate (0 = el de siempre, 1 = el segundo del doble)
    for (i = 0; i < cruces.length; i++) listas[cruces[i].r].push(cruces[i].t);
    function dobleEn(gt) {                        // ¿se ve el segundo mecate? (nivel 3 siempre; 1-2 durante el DOBLE MECATE)
      if (lv === 3) return true;
      for (var j = 0; j < EVS.length; j++) { var e = EVS[j]; if (e.k === 'doble' && e.ini !== null && gt >= e.ini - 0.9 && gt < e.fin + 0.3) return true; }
      return false;
    }
    var TXT_EV = {
      rapido: ['¡SE EMOCIONARON!', 'el mecate va más rápido'], lento: ['¡SE CANSARON!', 'más lento… y ojo cuando arranque'],
      doble: ['¡DOBLE MECATE!', 'un solo brinco para los dos'], dorado: ['¡MECATE DORADO!', 'brinco perfecto = CHUPETA (vida extra)'],
      pelota: ['¡AHÍ VIENE UNA PELOTA!', 'el mecate se para: bríncala cuando te llegue'], perro: ['¡UN PERRO SUELTO!', 'el mecate se para: bríncalo cuando pase'],
      sincopa: ['¡CAMBIO DE RITMO!', 'tum-ta… tum-ta: no te confíes del compás'], rafaga: ['¡RÁFAGA!', 'el mecate se vuelve loco'],
      moto: ['¡UNA MOTO!', 'el mecate se para: bríncala cuando pase volando'],
      perros: ['¡DOS PERROS!', 'brinca uno y después el otro'], pelotas: ['¡PELOTAS POR LOS DOS LADOS!', 'cada una a su tiempo']
    };
    function avisos(gt) {                         // [fase, evento]: lo que dicen los letreros ahora
      var out = [null, null], j;
      if (gt >= F1 && gt < F1 + 1.8 && F1 > lead) out[0] = ['¡MÁS RÁPIDO!', '#ffd23f'];
      if (gt >= F2 && gt < F2 + 2.4) out[0] = ['¡ÚLTIMOS SEGUNDOS!', '#ff3b4e'];
      for (j = 0; j < EVS.length; j++) { var e = EVS[j]; if (e.ini !== null && gt >= e.ini - 1 && gt < e.ini + 1.1) out[1] = [TXT_EV[e.k][0], TXT_EV[e.k][1], e.k, gt < e.ini ? 1 : 0]; }
      return out;
    }

    /* ───── dibujo ───── */
    function cuerda(x0, x1, gt, lista, parte, col) {   // parte: 'atras' (sube, u<.5) | 'frente' (baja, u>=.5)
      var u = faseU(gt, lista), phi = u * Math.PI * 2, cs = Math.cos(phi);
      var cima = u < 0.5 ? 'atras' : 'frente';
      if (parte !== cima) return;
      var hy = HANDY + 18 * cs;                     // las manos dan la vuelta con el mecate
      var ym = HANDY + (cs > 0 ? 70 : 150) * (-cs) * -1;   // cs=1 (suelo) -> HANDY+70 = GY; cs=-1 (arriba) -> HANDY-150
      var pts = [], s;
      for (s = 0; s <= 16; s++) { var f = s / 16; pts.push([lerp(x0, x1, f), hy + (ym - hy) * 4 * f * (1 - f)]); }
      line(pts, 11, INKC); line(pts, 6, col || (parte === 'atras' ? '#e8a020' : '#ffd23f'));
    }
    function vecina(x, flip, gt, cast, lista) {
      var bob = Math.sin(gt * 6 + (flip ? 1.7 : 0)) * 4, phi = faseU(gt, lista) * Math.PI * 2;
      var hx = x + (flip ? -30 : 30) + (flip ? 1 : -1) * 10 * Math.sin(phi), hy = HANDY + 18 * Math.cos(phi);
      rr(x - 26, GY - 84, 52, 90, 14, flip ? '#2f9fe3' : '#e8553d', 4);       // el cuerpo sobre el que va el busto
      line([[x + (flip ? -14 : 14), GY - 74], [hx, hy]], 12, INKC); line([[x + (flip ? -14 : 14), GY - 74], [hx, hy]], 7, flip ? '#2f9fe3' : '#e8553d');   // el brazo que da la vuelta
      bust(Object.assign({ x: x, y: GY - 150 + bob, s: 0.62, flip: flip ? 1 : 0, look: flip ? -1 : 1, talk: Math.abs(Math.sin(gt * 3)) }, cast));
      ell(hx, hy, 9, 9, '#e8b48a', 3);                                         // la mano que agarra la cuerda
    }
    function fondo(x0, x1, gt) {
      var w = x1 - x0, k, p = pal;
      rr(x0, 0, w, 250, 0, p.sky, 0); rr(x0, 250, w, 100, 0, p.sky2, 0);
      if (lv === 3) { for (k = 0; k < estrellas.length; k++) { var e = estrellas[k]; ell(x0 + e[0] * w, 20 + e[1] * 260, e[2], e[2], '#fffdf2', 0); } ell(x1 - 90, 90, 30, 30, p.sol, 0); ell(x1 - 78, 84, 26, 26, p.sky, 0); }
      else ell(lv === 1 ? x1 - 110 : x0 + 120, lv === 1 ? 84 : 290, 38, 38, p.sol, 0);
      var sw = 0; for (k = 0; k < casas.length; k++) sw += casas[k].w + 4;
      var off = x0, base = 340;
      for (k = 0; off < x1 + 10; k++) {
        var h = casas[k % casas.length]; if (off + h.w < x0) { off += h.w + 4; continue; }
        rr(off, base - h.h, h.w, h.h + 20, 6, p.casas[h.k], 3.5);
        var vn = Math.max(1, Math.floor(h.w / 38));
        for (var v = 0; v < vn; v++) rr(off + 10 + v * (h.w - 20) / vn, base - h.h + 16, Math.min(24, (h.w - 20) / vn - 8), 26, 4, p.vent, 2);
        off += h.w + 4;
      }
      rr(x0, 336, w, 40, 0, p.acera, 0); line([[x0, 336], [x1, 336]], 4, INKC);
      rr(x0, 376, w, 240, 0, p.calle, 0); line([[x0, 376], [x1, 376]], 4, INKC);
      for (k = x0 + 20; k < x1; k += 90) rr(k, 505, 46, 7, 3, p.raya, 0);
      if (lv === 3) for (k = x0 + 150; k < x1; k += 330) { rr(k - 3, 210, 6, 130, 2, '#14101c', 0); ell(k, 206, 26, 26, 'rgba(255,226,122,.35)', 0); ell(k, 206, 11, 11, '#ffe27a', 2); }
    }

    function dibujaJugador(p, gt) {
      var cp = c.campo(), mid = (cp.x0 + cp.x1) / 2, sp = Math.min(118, (cp.x1 - cp.x0 - 380) / Math.max(1, n - 1));
      var x = mid + (p - (n - 1) / 2) * sp, ps = pose(p), s = c.seats[p], y = ps.y, ch = s.ch;
      var gy = GY - (p % 2) * 0 + 6;
      if (!ps.st) {
        ell(x, gy + 4, 30 - y * 0.18, 7, 'rgba(20,16,28,.35)', 0);
        rr(x - 15, gy - 30 - y, 11, 28, 5, '#2f3a7a', 3); rr(x + 4, gy - 30 - y, 11, 28, 5, '#2f3a7a', 3);
        ell(x - 10, gy - 2 - y, 13, 6, '#ffffff', 3); ell(x + 10, gy - 2 - y, 13, 6, '#ffffff', 3);
        rr(x - 19, gy - 70 - y, 38, 44, 12, s.color || '#ffd23f', 3.5);
        c.util.pj(ch, x, gy - 88 - y, 86, { animo: y > 5 ? 'celebrar' : null, sombra: false });
        if (p === c.yo) { poly([[x - 11, gy - 160 - y], [x + 11, gy - 160 - y], [x, gy - 144 - y]], '#ffd23f', 3); txt('TÚ', x, gy - 176 - y, 16, '#ffd23f'); }
      } else {                                    // pisó el mecate: tirado en el suelo con la cuerda enredada
        var q = P[p];
        ell(x, gy + 2, 52, 10, 'rgba(20,16,28,.35)', 0);
        ctx.save(); ctx.translate(x, gy - 34); ctx.rotate(-1.35 * (p % 2 ? -1 : 1)); c.util.pj(ch, 0, 0, 80, { animo: 'perder' }); ctx.restore();
        line([[x - 44, gy - 10], [x - 10, gy - 22], [x + 14, gy - 4], [x + 44, gy - 14]], 5, '#ffd23f');
        txt('X', x + 30, gy - 62, 22, '#ff3b4e');
        var edad = gt - q.outAt;
        if (edad >= 0 && edad < 1.6 && q.outAt > -1) {
          var bx = Math.min(cp.x1 - 135, Math.max(cp.x0 + 135, x)), by = 124 + (p % 3) * 44 - Math.min(edad, 0.4) * 16;
          rr(bx - 125, by - 17, 250, 34, 12, '#fffdf2', 3.5);
          poly([[x - 8, by + 17], [x + 8, by + 17], [x, by + 34]], '#fffdf2', 3);
          txt('¡PISÓ EL MECATE, PISÓ!', bx, by, 16, '#c4283a', 0, true);
        }
      }
    }

    function x2D(x3) { var cp = c.campo(), sp = Math.min(118, (cp.x1 - cp.x0 - 380) / Math.max(1, n - 1)); return (cp.x0 + cp.x1) / 2 + x3 / SEPX * sp; }
    function letreros(cx, gt) {                   // los avisos de fase y de evento (los mismos en 2D y 3D)
      var av = avisos(gt), a;
      if (av[0]) { a = av[0]; rr(cx - 170, 172, 340, 40, 14, INKC, 0); txt(a[0], cx, 192, 26, a[1], 0, true); }
      if (av[1]) {
        a = av[1]; var y = av[0] ? 236 : 196, pul = a[3] ? 1 + Math.abs(Math.sin(gt * 9)) * 0.06 : 1;
        rr(cx - 210, y - 22, 420, 58, 14, '#fffdf2', 3.5);
        txt(a[0], cx, y - 4, 22 * pul, a[2] === 'dorado' ? '#c48a00' : '#c4283a', 0, true); txt(a[1], cx, y + 20, 14, INKC, 0, true);
      }
    }
    function peligroX(h, gt) { return h.X0 + h.dir * h.v * (gt - h.t0); }
    function dibujar2D() {                        // el dibujo 2D de siempre (sin WebGL o con ?plano=1)
      var cp = c.campo(), gt = c.ahora(), p, k;
      fondo(cp.x0, cp.x1, gt);
      var xa = cp.x0 + 78, xb = cp.x1 - 78, d2 = dobleEn(gt), oro = false;
      var nr = d2 ? 2 : 1, r, kn = siguiente(gt);
      if (kn < cruces.length && cruces[kn].oro >= 0) oro = true;
      vecina(cp.x0 + 52, false, gt, BUS.AP.CAST.mama, listas[0]);
      vecina(cp.x1 - 52, true, gt, BUS.AP.CAST.abuela, listas[0]);
      for (r = 0; r < nr; r++) cuerda(xa, xb, gt, listas[r], 'atras', oro ? '#fff2a0' : r ? '#d84a7a' : null);
      for (p = 0; p < n; p++) dibujaJugador(p, gt);
      for (r = 0; r < nr; r++) cuerda(xa, xb, gt, listas[r], 'frente', oro ? '#ffe14d' : r ? '#ff5a8a' : null);
      /* los peligros que cruzan la fila */
      for (k = 0; k < HZ.length; k++) {
        var h = HZ[k], hx = peligroX(h, gt);
        if (Math.abs(hx) > XR + 6) continue;
        var x = x2D(hx);
        if (h.k === 'pelota') { var by = GY - 14 - Math.abs(Math.sin(gt * 9)) * 16; ell(x, GY + 4, 14, 4, 'rgba(20,16,28,.35)', 0); ell(x, by, 14, 14, '#ff3b4e', 3); line([[x - 13, by], [x + 13, by]], 3, '#fffdf2'); }
        else if (h.k === 'moto') { ell(x - 20, GY - 8, 9, 9, INKC, 3); ell(x + 20, GY - 8, 9, 9, INKC, 3); rr(x - 26, GY - 30, 52, 14, 6, '#3fa9ff', 3); rr(x - 6, GY - 48, 14, 18, 5, '#ffd23f', 3); ell(x, GY - 54, 8, 8, '#e8b48a', 2); }
        else { var lg = Math.sin(gt * 30) * 6; rr(x - 26, GY - 26, 52, 18, 8, '#a0602a', 3); ell(x + h.dir * 28, GY - 26, 12, 10, '#a0602a', 3); line([[x - 18, GY - 10], [x - 18 + lg, GY + 4]], 4, INKC); line([[x + 16, GY - 10], [x + 16 - lg, GY + 4]], 4, INKC); }
      }
      /* polvito donde pega la cuerda: marca el ritmo (cosmético) */
      for (k = 0; k < cruces.length; k++) {
        var dtT = gt - cruces[k].t;
        if (dtT >= -0.02 && dtT < 0.18) { var a = 1 - dtT / 0.18, mx = (xa + xb) / 2; ell(mx - 70, GY + 6, 22 + dtT * 90, 5 + dtT * 12, 'rgba(240,230,210,' + (0.5 * a).toFixed(2) + ')', 0); ell(mx + 70, GY + 6, 22 + dtT * 90, 5 + dtT * 12, 'rgba(240,230,210,' + (0.5 * a).toFixed(2) + ')', 0); }
      }
      if (gt < 0.8 && !c.practica) txt('¡BRINCA!', (cp.x0 + cp.x1) / 2, 118, 26, '#fffdf2');
      letreros((cp.x0 + cp.x1) / 2, gt);
      if (c.yo >= 0 && c.yo < n && P[c.yo].esc > 0 && !P[c.yo].st) txt('CHUPETA: VIDA EXTRA', (cp.x0 + cp.x1) / 2, 150, 15, '#ffd23f', 0, true);
    }

    /* ───── 3D low poly (fiesta-3d.js): la calle del barrio, dos chamos dándole al mecate y la fila brincando en el medio.
       Solo dibujo: lee P, pose() y la lista de cruces; no toca la simulación. El mecate gira de verdad alrededor del eje x
       (arco real) y su sombra en el piso se oscurece y se afina a medida que baja: así se lee cuándo brincar. Los brazos de
       los que le dan hacen la vuelta completa con el mecate, y la punta del mecate va amarrada a sus manos. ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0, absT = 0;
    var ESY = 1 / 50, HY = 1.62, RRE = 0.2, NSEG = 22, ZB = -5.7, YB = 0.26;
    var CUERDA_C = ['#ffd23f', '#ff5a8a'], POLVO = ['#d8d2c4', '#fffdf2', '#c9b48c'];
    var CONF = ['#ff3b4e', '#ffd23f', '#3fa9ff', '#5cff7a', '#ff8fc0', '#b07aff'];
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', calle: '#5d5b72', acera: '#d8d2c4', nube: '#ffffff', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', calle: '#5a4a62', acera: '#c8b4a0', nube: '#ffd0b0', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', calle: '#34324c', acera: '#6a6684', nube: '#4a4478', noche: 1 }
    };
    function asiento(p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; }
    function puntoCuerda(f, phi, out) {               // f: 0..1 de una mano a la otra; phi: ángulo de la vuelta (0 = en el piso, luego atrás y arriba, y baja por delante)
      var r = RRE + (HY - 0.04 - RRE) * 4 * f * (1 - f);
      return out.set(-XR + 2 * XR * f, HY - r * Math.cos(phi), -r * Math.sin(phi));
    }
    function saltos(p) {                              // brincos superados por p (un par del doble o dos golpes pegados = un brinco)
      var q = P[p], lim = q.st ? q.sc / 30 - 1e-3 : c.ahora(), k = 0, G = grupos[p];
      while (k < G.length && G[k].T <= lim) k++;
      return k;
    }

    function montar3D() {
      var T = THREE, pl = PAL3[lv], k;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 36, 100], fov: 32 });
      if (!esc) return null;
      /* gaita de barrio en La menor: i–iv–V–i, con la sensible al final de la frase */
      V3.pista('mecate', { bpm: 128, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 72, 74, 76, 0, 74, 72, 71, 0, 72, 0, 74, 72, 71, 0, 69, 0, 72, 76, 0, 77, 76, 74, 76, 0, 71, 0, 68, 0, 69, 0] });
      /* ¡ÚLTIMOS SEGUNDOS!: la misma gaita, más apurada y un tono más arriba */
      V3.pista('mecate2', { bpm: 166, acordes: [[59, 62, 66], [52, 55, 59], [54, 58, 61], [59, 62, 66]],
        mel: [78, 0, 74, 76, 78, 0, 76, 74, 73, 0, 74, 0, 76, 74, 73, 0, 71, 0, 74, 78, 0, 79, 78, 76, 78, 0, 73, 0, 70, 0, 71, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 10);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, grad = V3.toon('#fff').gradientMap;

      /* la calle: asfalto con granitos, raya amarilla y la tiza de los chamos (la raya donde pega el mecate y una pisé) */
      var asf = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.calle; x.fillRect(0, 0, w, h);
        for (var q = 0; q < 160; q++) { x.fillStyle = V3.oscurecer(pl.calle, q % 2 ? 0.82 : 1.18); x.fillRect((q * 73) % w, (q * 41 + q * q) % h, 3, 3); }
      }, [14, 5]);
      var calle = new T.Mesh(new T.PlaneGeometry(110, 36), new T.MeshToonMaterial({ map: asf, gradientMap: grad }));
      calle.rotation.x = -Math.PI / 2; calle.position.z = ZB + 0.6 + 18; calle.receiveShadow = true; S3.add(calle);
      for (k = -12; k <= 12; k++) { var ra = new T.Mesh(new T.PlaneGeometry(1.8, .16), tn('#ffd23f')); ra.rotation.x = -Math.PI / 2; ra.position.set(k * 3.4, .012, 6.5); ra.receiveShadow = true; S3.add(ra); }
      var tiza = V3.texturaCanvas(512, 170, function (x, w, h) {
        function px(v) { return (v + 12) / 24 * w; }
        function pz(v) { return (v + 3) / 8 * h; }
        var q, r2;
        x.strokeStyle = 'rgba(255,253,242,.8)'; x.lineWidth = 3;
        for (q = -XR + .4; q < XR - .4; q += .6) { x.beginPath(); x.moveTo(px(q), pz(0)); x.lineTo(px(q + .34), pz(0)); x.stroke(); }
        x.strokeStyle = 'rgba(255,236,160,.85)'; x.lineWidth = 2.5; x.fillStyle = 'rgba(255,236,160,.85)'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        var filas = [[0], [0], [-.4, .4], [0], [-.4, .4], [0]], num = 1;
        for (q = 0; q < filas.length; q++) for (r2 = 0; r2 < filas[q].length; r2++) {
          var cx2 = 9.6 + filas[q][r2], cz2 = 4.5 - q * .8;
          x.strokeRect(px(cx2 - .4), pz(cz2 - .4), .8 / 24 * w, .8 / 8 * h); x.fillText(String(num++), px(cx2), pz(cz2));
        }
        x.beginPath(); x.arc(px(9.6), pz(-.3), .5 / 24 * w, Math.PI, 0); x.stroke();
        x.strokeStyle = 'rgba(255,143,192,.8)'; x.beginPath(); x.arc(px(-9.5), pz(3), 14, 0, Math.PI * 2); x.stroke();
        for (q = 0; q < 8; q++) { x.beginPath(); x.moveTo(px(-9.5) + Math.cos(q * .785) * 18, pz(3) + Math.sin(q * .785) * 18); x.lineTo(px(-9.5) + Math.cos(q * .785) * 26, pz(3) + Math.sin(q * .785) * 26); x.stroke(); }
      });
      var tz = new T.Mesh(new T.PlaneGeometry(24, 8), new T.MeshBasicMaterial({ map: tiza, transparent: true, depthWrite: false }));
      tz.rotation.x = -Math.PI / 2; tz.position.set(0, .014, 1); S3.add(tz);

      /* la acera con su brocal (ahí se sientan los que pisan el mecate) */
      var acera = M(new T.BoxGeometry(110, YB, 2), pl.acera, { recibe: true, borde: false }); acera.position.set(0, YB / 2, ZB - .4); S3.add(acera);
      var brocal = M(new T.BoxGeometry(110, YB + .02, .18), V3.oscurecer(pl.acera, .82), { recibe: true, borde: false }); brocal.position.set(0, YB / 2, ZB + .55); S3.add(brocal);

      /* las casas del barrio (el mismo skyline sembrado del 2D): platabanda, rejas, tanque de agua y antenas */
      var ropa = [];
      function casa(x, w, h, col, nv, idx) {
        var g3 = new T.Group(); g3.position.set(x, YB, ZB - 4.4); S3.add(g3);
        var cu = M(new T.BoxGeometry(w, h, 6), col, { recibe: true, g: .015 }); cu.position.y = h / 2; g3.add(cu);
        var pb = M(new T.BoxGeometry(w + .12, .32, 6.12), V3.oscurecer(col, .78), { g: .02 }); pb.position.y = h + .16; g3.add(pb);
        var zo = M(new T.BoxGeometry(w + .04, .7, 6.04), V3.oscurecer(col, .7), { borde: false, recibe: true }); zo.position.y = .35; g3.add(zo);
        var q, b, pi = idx % nv;
        for (q = 0; q < nv; q++) {
          var vx = -w / 2 + (q + .5) * w / nv;
          if (q === pi) {
            var pu = M(new T.BoxGeometry(1.05, 2.1, .12), idx % 2 ? '#7a4a2a' : '#3a6a8a', { g: .03 }); pu.position.set(vx, 1.05, 3.02); g3.add(pu);
            var po = M(new T.SphereGeometry(.06, 5, 4), '#ffd23f', { borde: false }); po.position.set(vx + .35, 1.05, 3.12); g3.add(po);
          } else {
            var v = M(new T.BoxGeometry(1.05, 1.15, .12), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); v.position.set(vx, 1.7, 3.02); g3.add(v);
            for (b = 0; b < 4; b++) { var re = M(new T.BoxGeometry(.05, 1.22, .05), '#2a2a34', { borde: false }); re.position.set(vx - .42 + b * .28, 1.7, 3.12); g3.add(re); }
          }
          if (h > 5.2) { var v2 = M(new T.BoxGeometry(.9, 1, .12), pl.noche && (q + idx) % 3 ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche && (q + idx) % 3 ? '#ffb030' : null, emI: .8 }); v2.position.set(vx, h - 1.5, 3.02); g3.add(v2); }
        }
        if (idx % 3 === 0) {
          var ta = M(new T.CylinderGeometry(.6, .6, 1.1, 10), '#2a2a34', { g: .04 }); ta.position.set(w / 4, h + .87, 0); g3.add(ta);
          var tt = M(new T.CylinderGeometry(.62, .62, .12, 10), '#3a3a48', { borde: false }); tt.position.set(w / 4, h + 1.48, 0); g3.add(tt);
        }
        if (idx % 4 === 1) {
          var an = M(new T.CylinderGeometry(.03, .03, 1.8, 4), '#5a5a68', { borde: false }); an.position.set(-w / 4, h + 1.2, .5); g3.add(an);
          for (b = 0; b < 3; b++) { var ab = M(new T.BoxGeometry(.9 - b * .2, .03, .03), '#5a5a68', { borde: false }); ab.position.set(-w / 4, h + 1.5 + b * .25, .5); g3.add(ab); }
        }
        if (idx % 5 === 2) {                                             // el tendedero de la platabanda: la ropa ondea sola
          for (b = 0; b < 2; b++) { var pa = M(new T.CylinderGeometry(.04, .04, 1.4, 4), '#5a5a68', { borde: false }); pa.position.set(b ? w / 2 - .5 : -w / 2 + .5, h + .95, 1.2); g3.add(pa); }
          var cuerda2 = M(new T.BoxGeometry(w - 1, .025, .025), '#fffdf2', { borde: false }); cuerda2.position.set(0, h + 1.62, 1.2); g3.add(cuerda2);
          for (b = 0; b < 5; b++) {
            var pr = new T.Group(); pr.position.set(-w / 2 + 1 + b * (w - 2) / 4, h + 1.62, 1.2); g3.add(pr);
            var tela = new T.Mesh(new T.PlaneGeometry(.55, .7), new T.MeshToonMaterial({ color: CONF[(b + idx) % CONF.length], side: T.DoubleSide, gradientMap: grad }));
            tela.position.y = -.35; tela.castShadow = true; pr.add(tela); ropa.push(pr);
          }
        }
      }
      var hx = -34, ci = 0;
      while (hx < 34) { var cs = casas[ci % casas.length], w = cs.w / 22, hh = 3.2 + cs.h / 45; casa(hx + w / 2, w, hh, pal.casas[cs.k], cs.v, ci); hx += w + .14; ci++; }

      /* postes de luz con el cable y los zapatos colgados en el medio */
      function poste(x) {
        var pz = ZB - .9, ps = M(new T.CylinderGeometry(.1, .15, 7, 6), '#8a8a96', { g: .04 }); ps.position.set(x, 3.5, pz); S3.add(ps);
        var br = M(new T.BoxGeometry(1.4, .1, .1), '#8a8a96', { g: .05 }); br.position.set(x, 6.7, pz + .2); br.rotation.y = Math.PI / 2; S3.add(br);
        var la = new T.Mesh(new T.BoxGeometry(.5, .25, .7), tn('#fff2a0', { em: '#ffd36a', emI: pl.noche ? 1.6 : .15 })); la.position.set(x, 6.55, pz + .8); S3.add(la);
        if (pl.noche) { var luz = new T.PointLight(0xffc870, 1.3, 18, 2); luz.position.set(x, 6.1, pz + 1.2); S3.add(luz); }
      }
      var PX = XR + 5.5;
      poste(-PX); poste(PX);
      var pts = [], q2;
      for (q2 = 0; q2 <= 20; q2++) { var u2 = q2 / 20; pts.push(new T.Vector3(-PX + 2 * PX * u2, 6.9 - Math.sin(u2 * Math.PI) * 1.1, ZB - .9)); }
      S3.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 30, .025, 4), tn('#14101c')));
      var zap = new T.Group(); zap.position.set(2.2, 6.9 - Math.sin((2.2 + PX) / (2 * PX) * Math.PI) * 1.1, ZB - .9); S3.add(zap);
      for (q2 = 0; q2 < 2; q2++) {
        var cd = M(new T.BoxGeometry(.02, .7, .02), '#fffdf2', { borde: false }); cd.position.set(q2 ? .12 : -.12, -.35, 0); zap.add(cd);
        var zp = M(new T.BoxGeometry(.2, .18, .45), q2 ? '#e8553d' : '#f4f4f4', { g: .06 }); zp.position.set(q2 ? .12 : -.12, -.75 - q2 * .1, .08); zap.add(zp);
      }

      /* el cielo: nubes que pasan, un papagayo que se mece y dos zamuros dando vueltas; de noche, luna y estrellas */
      var nubes = [];
      if (!pl.noche) for (k = 0; k < 6; k++) {
        var nb = new T.Group(); nb.position.set(-40 + k * 15, 15 + (k % 3) * 2.2, -38 - (k % 2) * 6); S3.add(nb);
        for (q2 = 0; q2 < 3; q2++) { var bo = M(new T.IcosahedronGeometry(1.6 - q2 * .3, 0), pl.nube, { borde: false, sombra: false }); bo.position.set(q2 * 1.7 - 1.7, (q2 % 2) * .5, 0); nb.add(bo); }
        nubes.push(nb);
      } else {
        var luna = new T.Mesh(new T.SphereGeometry(2.2, 12, 8), new T.MeshBasicMaterial({ color: 0xfff6d0, fog: false })); luna.position.set(16, 22, -60); S3.add(luna);
        var mEs = new T.MeshBasicMaterial({ color: 0xfffdf2, fog: false });
        for (k = 0; k < 46; k++) { var es = new T.Mesh(new T.OctahedronGeometry(.12 + (k % 3) * .06, 0), mEs); es.position.set(((k * 37.3) % 120) - 60, 12 + ((k * 13.7) % 26), -62); S3.add(es); }
      }
      var papa = new T.Group(); papa.position.set(-11, 13, -20); S3.add(papa);
      var rombo = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), new T.MeshToonMaterial({ color: '#ff3b4e', side: T.DoubleSide, gradientMap: grad })); rombo.rotation.z = Math.PI / 4; rombo.scale.set(.8, 1.15, 1); papa.add(rombo);
      var cruz = M(new T.BoxGeometry(.05, 1.5, .05), '#7a4a2a', { borde: false }); papa.add(cruz);
      var cola = [];
      for (k = 0; k < 6; k++) { var lz = new T.Mesh(new T.PlaneGeometry(.3, .14), new T.MeshToonMaterial({ color: CONF[k % CONF.length], side: T.DoubleSide, gradientMap: grad })); lz.position.set(0, -1 - k * .42, 0); papa.add(lz); cola.push(lz); }
      var hiloG = new T.BufferGeometry(); hiloG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      var hilo = new T.Line(hiloG, new T.LineBasicMaterial({ color: 0x14101c })); S3.add(hilo);
      var zamuros = [];
      for (k = 0; k < 2; k++) {
        var za = new T.Group(); S3.add(za);
        for (q2 = 0; q2 < 2; q2++) { var al = M(new T.ConeGeometry(.18, 1.1, 3), '#1a1620', { borde: false, sombra: false }); al.rotation.z = q2 ? -Math.PI / 2 : Math.PI / 2; al.position.x = q2 ? .5 : -.5; za.add(al); }
        zamuros.push(za);
      }

      /* los que le dan al mecate: dos chamos, uno a cada lado, con su mango de palo amarrado a las manos */
      var turn = [V3.PJ.crear('pana', { prop: false, escala: 1.3 }), V3.PJ.crear('prima', { prop: false, escala: 1.3 })];
      turn[0].g.position.set(-XR - .95, 0, 0); turn[1].g.position.set(XR + .95, 0, 0);
      turn[0].g.rotation.y = Math.PI / 2; turn[1].g.rotation.y = -Math.PI / 2;
      S3.add(turn[0].g); S3.add(turn[1].g);
      var cuerdas = [], mangos = [], r2, geoSeg = new T.CylinderGeometry(.055, .055, 1, 5), geoSom = new T.BoxGeometry(1, .01, .13);
      for (r2 = 0; r2 < 2; r2++) {                                     // el segundo mecate: siempre en nivel 3, y en el DOBLE MECATE en 1-2
        var segs = [], soms = [], matC = V3.toon(CUERDA_C[r2], { nuevo: true });
        for (k = 0; k < NSEG; k++) {
          var sg = M(geoSeg, CUERDA_C[r2], { g: .35, sombra: false, mat: matC }); S3.add(sg); segs.push(sg);
          var sm = new T.Mesh(geoSom, new T.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: .3, depthWrite: false })); S3.add(sm); soms.push(sm);
        }
        cuerdas.push({ segs: segs, soms: soms, lista: listas[r2], mat: matC, vis: true });
        for (k = 0; k < 2; k++) { var mg = M(new T.CylinderGeometry(.07, .07, .4, 6), r2 ? '#b07a4a' : '#8a5a30', { g: .08 }); mg.rotation.z = Math.PI / 2; S3.add(mg); mangos.push(mg); }
      }
      var ptsC = [];
      for (k = 0; k <= NSEG; k++) ptsC.push(new T.Vector3());

      /* lo que cruza la fila: pelotas y perros salchicha (uno por peligro sembrado) */
      var hzM = [];
      for (k = 0; k < HZ.length; k++) {
        var hg = new T.Group(), patas = [], hcu = null; hg.visible = false; S3.add(hg);
        if (HZ[k].k === 'pelota') {
          hcu = M(new T.IcosahedronGeometry(.3, 1), '#ff3b4e', { g: .05 }); hg.add(hcu);
          var fr = M(new T.TorusGeometry(.3, .045, 5, 14), '#fffdf2', { borde: false }); hcu.add(fr);
          var fr2 = M(new T.TorusGeometry(.3, .045, 5, 14), '#3fa9ff', { borde: false }); fr2.rotation.y = Math.PI / 2; hcu.add(fr2);
        } else if (HZ[k].k === 'moto') {
          hcu = new T.Group(); hg.add(hcu);
          var mc = M(new T.BoxGeometry(1.1, .3, .4), '#3fa9ff', { g: .05 }); mc.position.y = .55; hcu.add(mc);
          var mt = M(new T.BoxGeometry(.4, .25, .34), '#ff3b4e', { g: .05 }); mt.position.set(.15, .78, 0); hcu.add(mt);
          var mm = M(new T.BoxGeometry(.06, .06, .6), '#2a2a34', { borde: false }); mm.position.set(.62, .98, 0); hcu.add(mm);
          var mr = M(new T.BoxGeometry(.4, .55, .3), '#ffd23f', { g: .05 }); mr.position.set(-.1, 1.0, 0); hcu.add(mr);
          var mh = M(new T.SphereGeometry(.2, 8, 6), '#fffdf2', { g: .05 }); mh.position.set(-.05, 1.45, 0); hcu.add(mh);
          var mf = M(new T.SphereGeometry(.07, 6, 4), '#fff2a0', { borde: false, em: '#fff2a0', emI: 1 }); mf.position.set(.62, .7, 0); hcu.add(mf);
          for (var w2 = 0; w2 < 2; w2++) { var ru = M(new T.TorusGeometry(.26, .08, 6, 12), '#14101c', { borde: false }); ru.position.set(w2 ? -.62 : .62, .3, 0); hcu.add(ru); patas.push(ru); }
          hcu.rotation.y = HZ[k].dir > 0 ? 0 : Math.PI;
        } else {
          hcu = new T.Group(); hg.add(hcu);
          var cp3 = M(new T.BoxGeometry(.95, .3, .32), '#a0602a', { g: .05 }); cp3.position.y = .42; hcu.add(cp3);
          var cab3 = M(new T.BoxGeometry(.34, .3, .3), '#a0602a', { g: .05 }); cab3.position.set(.58, .58, 0); hcu.add(cab3);
          var hoc = M(new T.BoxGeometry(.18, .14, .2), '#c98a50', { g: .04 }); hoc.position.set(.8, .52, 0); hcu.add(hoc);
          var nar = M(new T.SphereGeometry(.05, 5, 4), '#14101c', { borde: false }); nar.position.set(.9, .57, 0); hcu.add(nar);
          for (var o2 = 0; o2 < 2; o2++) { var ore = M(new T.BoxGeometry(.1, .26, .06), '#5a3418', { g: .03 }); ore.position.set(.52, .52, o2 ? .17 : -.17); ore.rotation.x = o2 ? .3 : -.3; hcu.add(ore); }
          var col3 = M(new T.CylinderGeometry(.03, .02, .4, 4), '#a0602a', { borde: false }); col3.position.set(-.55, .6, 0); col3.rotation.z = .9; hcu.add(col3);
          var cue3 = M(new T.TorusGeometry(.17, .035, 4, 10), '#ff3b4e', { borde: false }); cue3.position.set(.42, .55, 0); cue3.rotation.y = Math.PI / 2; hcu.add(cue3);
          for (var l2 = 0; l2 < 4; l2++) { var pt = new T.Group(); pt.position.set(l2 < 2 ? .32 : -.32, .3, l2 % 2 ? .1 : -.1); hcu.add(pt); var pa3 = M(new T.BoxGeometry(.08, .28, .08), '#5a3418', { g: .03 }); pa3.position.y = -.14; pt.add(pa3); patas.push(pt); }
          hcu.rotation.y = HZ[k].dir > 0 ? 0 : Math.PI;
          hcu.userData.cola = col3;
        }
        hzM.push({ g: hg, cu: hcu, patas: patas, h: HZ[k], dentro: false, giro: 0 });
      }
      /* las chupetas del mecate dorado (una encima de cada uno) y el halo del que tiene vida extra */
      var chups = [], halos = [];
      for (k = 0; k < n; k++) {
        var ch3 = new T.Group(); ch3.visible = false; S3.add(ch3);
        var palo = M(new T.CylinderGeometry(.03, .03, .55, 4), '#fffdf2', { borde: false }); palo.position.y = -.35; ch3.add(palo);
        var disco = M(new T.CylinderGeometry(.26, .26, .1, 12), '#ff5a8a', { g: .05, em: '#ff5a8a', emI: .3 }); disco.rotation.x = Math.PI / 2; ch3.add(disco);
        var esp = M(new T.TorusGeometry(.16, .035, 4, 12), '#fffdf2', { borde: false }); esp.position.z = .06; ch3.add(esp);
        chups.push(ch3);
        var ha = M(new T.TorusGeometry(.32, .05, 5, 16), '#ffd23f', { borde: false, em: '#ffd23f', emI: .8, sombra: false }); ha.rotation.x = -Math.PI / 2; ha.visible = false; S3.add(ha); halos.push(ha);
      }

      /* los jugadores en fila entre los dos chamos */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        pj.g.position.set(xJug(k), 0, 0); S3.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.6, .78, 20), new T.MeshBasicMaterial({ color: s2.color && s2.color !== '#fff' ? s2.color : CONF[k % CONF.length], transparent: true, opacity: .85, depthWrite: false }));
        aro.rotation.x = -Math.PI / 2; aro.position.set(xJug(k), .03, 0); S3.add(aro);
        var enr = M(new T.TorusGeometry(.42, .05, 5, 14), CUERDA_C[0], { g: .3 }); enr.rotation.x = -Math.PI / 2 + .35; enr.visible = false; S3.add(enr);
        pjs.push({ pj: pj, aro: aro, enr: enr, x: xJug(k), z: 0, y: 0, st: 0, outT: -9, orden: -1, fest: false });
      }
      var flecha = M(new T.ConeGeometry(.3, .6, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      esc.encuadrar(2 * XR + 4, 7, new T.Vector3(0, 1.5, -.8), .3);
      return { esc: esc, pjs: pjs, turn: turn, cuerdas: cuerdas, mangos: mangos, pts: ptsC, dir: new T.Vector3(), up: new T.Vector3(0, 1, 0),
        part: part, flecha: flecha, ropa: ropa, zap: zap, nubes: nubes, papa: papa, cola: cola, hilo: hilo, zamuros: zamuros,
        kc: -1, nOut: 0, finS: false, hito: { n: 0, t: -9 }, saltosYo: -1, hzM: hzM, chups: chups, halos: halos,
        mano: [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()], junto: lv === 3 ? 0 : 1, fz: -1, avisoEv: -1, inEv: -1,
        hemi0: esc.luces.hemi.intensity, sol0: esc.luces.sol.color.clone(), rojo: new T.Color(0xff6a5a), chupV: [], salvoV: [] };
    }

    function finJuego(now) { return (now >= 3 && vivos() <= (n > 1 ? 1 : 0)) || now >= dur; }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, k, p, r2, fin = finJuego(now);
      V.part.update(dt);
      var evA = activo(now), d2 = dobleEn(now), fzA = now < 0 ? 0 : fase(now);
      /* los chamos que le dan: el cuerpo en 'quieto' y los brazos los ponemos aquí, dando la vuelta completa con su mecate.
         El derecho lleva el mecate 0; el izquierdo el 1 (doble) o ayuda con el 0 (las dos manos juntas, como una manivela) */
      V.junto += ((d2 ? 0 : 1) - V.junto) * Math.min(1, dt * 6);
      var phiA = faseU(now, listas[0]) * Math.PI * 2, phiB = d2 ? faseU(now, listas[1]) * Math.PI * 2 : phiA;
      for (k = 0; k < 2; k++) {
        var tp = V.turn[k], J = tp.J, sg0 = k ? -1 : 1, cara = fin ? 'feliz' : evA && evA.k === 'lento' ? 'dormido' : evA && evA.k === 'rapido' ? 'feliz' : fzA === 2 ? 'enojado' : Math.sin(t * .7 + k * 2) > .5 ? 'feliz' : 'concentrado';
        tp.anim(fin ? 'celebrar' : 'quieto').cara(cara).rumbo(k ? -Math.PI / 2 : Math.PI / 2).update(dt);
        if (!fin) {
          var cs = Math.cos(phiA), sn = Math.sin(phiA), cs2 = Math.cos(phiB), sn2 = Math.sin(phiB), baja = (1 + cs) / 2;   // baja: 1 cuando el mecate pega en el piso
          J.hD.rotation.set(-1.0 + .8 * cs, 0, -.38 * V.junto + sg0 * .75 * sn); J.cD.rotation.x = -.35 - .45 * (1 - baja);
          J.hI.rotation.set(-1.0 + .8 * cs2, 0, .38 * V.junto + sg0 * .75 * sn2); J.cI.rotation.x = -.35 - .45 * (1 - (1 + cs2) / 2);
          /* el cuerpo acompaña: el torso se inclina al latigazo y se carga al lado de la vuelta, la cabeza mira la cuerda, las rodillas amortiguan el golpe */
          J.tor.rotation.x += .16 * cs; J.tor.rotation.z += sg0 * .13 * sn; J.cue.rotation.z += sg0 * .08 * sn; J.cab.rotation.x += .1 * cs;
          J.cad.position.y -= .09 * baja; J.cad.position.x += sg0 * .04 * sn;
          J.mI.rotation.x -= .38 * baja; J.mD.rotation.x -= .38 * baja; J.rI.rotation.x += .6 * baja; J.rD.rotation.x += .6 * baja;
        }
        tp.g.updateMatrixWorld(true);
        tp.mano('der').getWorldPosition(V.mano[k * 2]); tp.mano('izq').getWorldPosition(V.mano[k * 2 + 1]);
        if (V.junto > .01) V.mano[k * 2].lerp(V.mano[k * 2 + 1], .5 * V.junto);   // dos manos juntas: el mecate sale del medio
      }
      /* el mecate: arco real amarrado a las manos, y su sombra en el piso (más oscura y fina mientras más baja). Dorado en el MECATE DORADO */
      var kn = siguiente(now), oroA = kn < cruces.length && cruces[kn].oro >= 0 && cruces[kn].t - now < 1.6 && now >= 0;
      for (r2 = 0; r2 < V.cuerdas.length; r2++) {
        var cu = V.cuerdas[r2], phi = (r2 ? phiB : phiA), vis = r2 === 0 || d2, e0x, e0y, e0z, e1x, e1y, e1z;
        if (vis !== cu.vis) { cu.vis = vis; for (k = 0; k < NSEG; k++) { cu.segs[k].visible = vis; cu.soms[k].visible = vis; } V.mangos[r2 * 2].visible = vis; V.mangos[r2 * 2 + 1].visible = vis; }
        if (!vis) continue;
        cu.mat.color.set(oroA ? (Math.sin(t * 14) > 0 ? '#fff2a0' : '#ffd23f') : CUERDA_C[r2]);
        cu.mat.emissive.set(oroA ? '#c48a00' : '#000000');
        for (k = 0; k <= NSEG; k++) puntoCuerda(k / NSEG, phi, V.pts[k]);
        var hA = V.mano[r2 ? 1 : 0], hB = V.mano[r2 ? 3 : 2];
        e0x = hA.x - V.pts[0].x; e0y = hA.y - V.pts[0].y; e0z = hA.z - V.pts[0].z;
        e1x = hB.x - V.pts[NSEG].x; e1y = hB.y - V.pts[NSEG].y; e1z = hB.z - V.pts[NSEG].z;
        for (k = 0; k <= NSEG; k++) { var ff = k / NSEG; V.pts[k].x += e0x * (1 - ff) + e1x * ff; V.pts[k].y += e0y * (1 - ff) + e1y * ff; V.pts[k].z += e0z * (1 - ff) + e1z * ff; }
        for (k = 0; k < NSEG; k++) {
          var a = V.pts[k], b = V.pts[k + 1], sg = cu.segs[k], sm = cu.soms[k];
          V.dir.subVectors(b, a); var len = V.dir.length(); V.dir.multiplyScalar(1 / Math.max(len, 1e-4));
          sg.position.addVectors(a, b).multiplyScalar(.5); sg.quaternion.setFromUnitVectors(V.up, V.dir); sg.scale.set(1, len + .02, 1);
          var yy = (a.y + b.y) / 2, dx = b.x - a.x, dz = b.z - a.z;
          sm.position.set(sg.position.x, .02 + r2 * .003, sg.position.z); sm.rotation.y = -Math.atan2(dz, dx);
          sm.scale.set(Math.sqrt(dx * dx + dz * dz) + .02, 1, 1 + yy * 1.1);
          sm.material.opacity = .06 + .6 * Math.max(0, 1 - yy / 2.2);
        }
        V.mangos[r2 * 2].position.copy(V.pts[0]); V.mangos[r2 * 2 + 1].position.copy(V.pts[NSEG]);
      }
      /* el golpe del mecate en el piso: polvito a lo largo y el chasquido */
      var kc = kn;
      if (kc !== V.kc) {
        if (V.kc >= 0 && kc > V.kc && now >= 0 && now - cruces[kc - 1].t < .2) {
          V3.sfx('tic');
          for (k = 0; k < 8; k++) V.part.soltar(-XR + (k + .5) * 2 * XR / 8, .08, 0, 2, { k: 'chispa', cols: cruces[kc - 1].oro >= 0 ? CONF : POLVO, vel: 1.6, arriba: 1.1, vida: .35, esc: .55 });
        }
        V.kc = kc;
      }
      /* la escalada: letrero, pito y sacudón al cambiar de fase; en ¡ÚLTIMOS SEGUNDOS! las luces laten rojas con la música */
      if (now >= 0 && fzA !== V.fz) {
        if (V.fz >= 0 && fzA > V.fz) { V3.sfx('silbato'); V.esc.sacudir(fzA === 2 ? .9 : .5); V.part.soltar(0, 4, -1, 30, { k: 'confeti', cols: CONF, vel: 4, arriba: 3, g: 5, vida: 1.4 }); }
        V.fz = fzA;
      }
      if (fzA === 2 && !fin) {
        var lat = Math.abs(Math.sin(t * Math.PI * 166 / 60 / 2));
        V.esc.luces.hemi.intensity = V.hemi0 * (.82 + .18 * lat); V.esc.luces.sol.color.copy(V.sol0).lerp(V.rojo, .25 + .2 * lat);
      } else { V.esc.luces.hemi.intensity = V.hemi0; V.esc.luces.sol.color.copy(V.sol0); }
      /* los eventos: aviso con sonido 1 s antes, y otro golpe cuando arrancan */
      for (k = 0; k < EVS.length; k++) {
        var e = EVS[k];
        if (e.ini === null) continue;
        if (now >= e.ini - 1 && k > V.avisoEv) { V.avisoEv = k; V3.sfx(e.pausa ? 'silbido' : e.k === 'dorado' ? 'moneda' : 'bocina'); }
        if (now >= e.ini && k > V.inEv) {
          V.inEv = k;
          V3.sfx(e.k === 'rapido' ? 'whoosh' : e.k === 'lento' ? 'viento' : e.k === 'doble' ? 'tambor' : e.k === 'dorado' ? 'ding' : 'pop');
          if (e.k === 'rapido' || e.k === 'doble') V.esc.sacudir(.35);
        }
      }
      /* los peligros que cruzan la fila: la pelota rebota y rueda; el perro corre moviendo las patas y la cola */
      for (k = 0; k < V.hzM.length; k++) {
        var hm = V.hzM[k], hx = peligroX(hm.h, now), dentro = Math.abs(hx) < XR + 9 && now > hm.h.t0 - 2.5;
        hm.g.visible = !!dentro;
        if (!dentro) continue;
        if (!hm.dentro) { hm.dentro = true; V3.sfx(hm.h.k === 'pelota' ? 'pop' : 'resbalon'); }
        if (hm.h.k === 'moto') {
          hm.g.position.set(hx, Math.abs(Math.sin(now * 40)) * .02, .25);
          for (var l4 = 0; l4 < hm.patas.length; l4++) hm.patas[l4].rotation.z = -now * 40 * hm.h.dir;
          if (Math.abs(hx) < XR + 1 && Math.floor(now * 30) % 3 === 0) V.part.soltar(hx - hm.h.dir * .8, .1, .25, 1, { k: 'chispa', cols: POLVO, vel: .8, arriba: .4, vida: .3, esc: .5 });
        } else if (hm.h.k === 'pelota') {
          var rb = Math.abs(Math.sin(now * 7.5));
          hm.g.position.set(hx, .3 + rb * .35, .15);
          hm.cu.rotation.z = -hm.h.dir * (hx / .3);
          if (rb < .12 && hm.giro > .12 && Math.abs(hx) < XR + 1) V.part.soltar(hx, .05, .15, 3, { k: 'chispa', cols: POLVO, vel: 1, arriba: .6, vida: .25, esc: .4 });
          hm.giro = rb;
        } else {
          hm.g.position.set(hx, Math.abs(Math.sin(now * 18)) * .06, .2);
          for (var l3 = 0; l3 < hm.patas.length; l3++) hm.patas[l3].rotation.z = Math.sin(now * 22 + (l3 % 2 ? Math.PI : 0) + (l3 < 2 ? 0 : 1.2)) * .7;
          if (hm.cu.userData.cola) hm.cu.userData.cola.rotation.x = Math.sin(now * 25) * .6;
        }
      }
      var u0 = faseU(now, V.cuerdas[0].lista), cerca = u0 > .7 && now >= 0;
      /* los jugadores */
      for (p = 0; p < n; p++) {
        var s3 = V.pjs[p], ps = pose(p), pj = s3.pj, ym = ps.st ? 0 : (ps.y || 0) * ESY;
        if (ps.st && !s3.st) {                                       // ¡pisó el mecate!
          s3.st = 1; s3.outT = t; s3.orden = V.nOut++; pj.volar(0, 1, .6, { alcance: .45 }); s3.enr.visible = true;      // tropieza con el mecate: un volar corto hacia adelante s3.y = 0;
          V.part.soltar(s3.x, .2, 0, 16, { k: 'chispa', cols: POLVO, vel: 3, arriba: 2.5, vida: .6 });
          V.part.soltar(s3.x, 1.6, 0, 8, { k: 'confeti', cols: ['#ff3b4e', '#ffd23f', '#fffdf2'], vel: 2.2, arriba: 3, g: 6, vida: .9 });
          V3.sfx('caida'); V3.sfx('golpe'); V.esc.sacudir(p === c.yo ? 1 : .4);
        }
        if (!s3.st) {
          if (ym > .03 && s3.y <= .03) { if (p === c.yo) V3.sfx('salto'); V.part.soltar(s3.x, .05, 0, 4, { k: 'chispa', cols: POLVO, vel: 1.2, arriba: .8, vida: .3, esc: .5 }); }
          else if (ym <= .03 && s3.y > .03) V.part.soltar(s3.x, .05, 0, 5, { k: 'chispa', cols: POLVO, vel: 1.6, arriba: .6, vida: .3, esc: .5 });
          s3.y = ym;
          if (fin && now > 0) {
            if (!s3.fest) { s3.fest = true; pj.uno('festejo'); V.part.soltar(s3.x, 2.8, 0, 30, { k: 'confeti', cols: CONF, vel: 3, arriba: 4, g: 4, vida: 1.6 }); }
            pj.anim('celebrar').cara('feliz');
          } else if (ym > .05) pj.anim('aire').cara('feliz');
          else pj.anim('quieto').cara(cerca ? 'concentrado' : 'normal');
          pj.rumbo(0).update(dt);
          pj.g.position.set(s3.x, ym, s3.z);
          s3.aro.visible = true; s3.aro.position.set(s3.x, .03, s3.z); s3.aro.scale.setScalar(1 - Math.min(.4, ym * .25));
        } else {
          var edad = t - s3.outT;
          s3.aro.visible = false;
          if (edad < 1.3) {                                          // en el piso, enredado y mareado
            pj.anim('triste').cara('mareado').rumbo(0).update(dt);
            s3.enr.position.set(s3.x, .1, s3.z + .1); s3.enr.rotation.z = edad * 3;
          } else {                                                   // se va a sentar al brocal, con su cara de tristeza
            s3.enr.visible = false;
            var bx = -XR + 1 + (s3.orden % 8) * 1.3, bz = ZB + .45, ddx = bx - s3.x, ddz = bz - s3.z, dd = Math.sqrt(ddx * ddx + ddz * ddz), paso = 2.4 * dt;
            if (dd > .05) {
              if (dd > paso) { s3.x += ddx / dd * paso; s3.z += ddz / dd * paso; } else { s3.x = bx; s3.z = bz; }
              pj.anim('caminar', { vel: .6 }).cara('triste').rumbo(Math.atan2(ddx, ddz)).update(dt);
            } else pj.anim('sentado').cara(fin ? 'normal' : 'triste').rumbo(0).update(dt);
          }
          pj.g.position.set(s3.x, s3.z < ZB + .6 ? YB : 0, s3.z);
        }
      }
      /* MECATE DORADO: la chupeta flota a la altura de la cima del brinco; quien la agarra, la lleva de halo (vida extra) */
      var og = -1, cen = 0;
      for (k = kn; k < cruces.length && k < kn + 2; k++) if (cruces[k].oro >= 0) { og = cruces[k].oro; cen = cruces[k].cen; break; }
      for (p = 0; p < n; p++) {
        var q3 = P[p], s5 = V.pjs[p], ch3 = V.chups[p], ha = V.halos[p], vch = og >= 0 && !s5.st && now >= 0 && cen - now < 1.4 && cen - now > -.1 && !(mio(p) && q3.ultOro === og);
        ch3.visible = !!vch;
        if (vch) { ch3.position.set(s5.x, 3.55 + Math.sin(t * 5 + p) * .08, s5.z + .1); ch3.rotation.y = t * 4; }
        if (q3.chupT !== (V.chupV[p] || -9)) {
          if (V.chupV[p] !== undefined) { V3.sfx('moneda'); V.part.soltar(s5.x, 3.5, s5.z, 22, { k: 'confeti', cols: ['#ffd23f', '#ff5a8a', '#fffdf2'], vel: 2.5, arriba: 2.5, g: 5, vida: 1 }); }
          V.chupV[p] = q3.chupT;
        }
        if (q3.salvoT !== (V.salvoV[p] === undefined ? -9 : V.salvoV[p])) {
          if (V.salvoV[p] !== undefined) { V3.sfx('ding'); V3.sfx('golpe'); s5.salvoA = t;
            var hzD = 1, hzB = 1e9;                                       // el peligro que pasó rozando: lo empuja hacia donde iba
            for (var hq = 0; hq < V.hzM.length; hq++) { var dq = Math.abs(peligroX(V.hzM[hq].h, now) - s5.x); if (dq < hzB) { hzB = dq; hzD = V.hzM[hq].h.dir; } }
            s5.pj.impacto(hzD, 0, 1.5); V.part.soltar(s5.x, 2, s5.z, 20, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 3, arriba: 2, vida: .6 }); if (p === c.yo) V.esc.sacudir(.6); }
          V.salvoV[p] = q3.salvoT;
        }
        ha.visible = !!(mio(p) && q3.esc > 0 && !s5.st);
        if (ha.visible) { ha.position.set(s5.pj.g.position.x, s5.pj.g.position.y + 3.05 + Math.sin(t * 4) * .05, s5.z); ha.rotation.z = t * 2; }
      }
      if (fin && now > 0 && !V.finS) { V.finS = true; V3.sfx('aplauso'); }
      /* mis saltos: cada 10, un ding y confeti */
      if (c.yo >= 0 && c.yo < n && !P[c.yo].st) {
        var sy = saltos(c.yo);
        if (V.saltosYo >= 0 && sy > V.saltosYo && sy % 10 === 0) { V.hito = { n: sy, t: t }; V3.sfx('ding'); var me = V.pjs[c.yo]; V.part.soltar(me.x, 3, me.z, 18, { k: 'confeti', cols: CONF, vel: 2.5, arriba: 3, g: 5, vida: 1.2 }); }
        V.saltosYo = sy;
      }
      var yo = c.yo >= 0 && c.yo < n ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo;
      if (yo) V.flecha.position.set(yo.pj.g.position.x, yo.pj.g.position.y + 3.5 + Math.abs(Math.sin(t * 4)) * .3, yo.pj.g.position.z);
      /* lo que se mueve solo */
      for (k = 0; k < V.ropa.length; k++) V.ropa[k].rotation.x = Math.sin(t * 2.4 + k * .9) * .4;
      V.zap.rotation.z = Math.sin(t * 1.6) * .25;
      for (k = 0; k < V.nubes.length; k++) { var nb = V.nubes[k]; nb.position.x += dt * (.5 + k % 3 * .2); if (nb.position.x > 50) nb.position.x = -50; }
      V.papa.position.set(-11 + Math.sin(t * .5) * 1.5, 13 + Math.sin(t * .8) * .6, -20); V.papa.rotation.z = Math.sin(t * 1.1) * .25;
      for (k = 0; k < V.cola.length; k++) V.cola[k].position.x = Math.sin(t * 3 - k * .7) * .12 * (k + 1);
      var hp = V.hilo.geometry.attributes.position; hp.setXYZ(0, V.papa.position.x, V.papa.position.y - .7, V.papa.position.z); hp.setXYZ(1, -16, 6, ZB - 4); hp.needsUpdate = true;
      for (k = 0; k < V.zamuros.length; k++) { var za = V.zamuros[k], ang = t * .35 + k * 3.1; za.position.set(9 + Math.cos(ang) * 7, 17 + k * 1.5 + Math.sin(t * .9 + k) * .4, -28 + Math.sin(ang) * 4); za.rotation.set(0, -ang, Math.sin(t * 2 + k) * .2); }
    }
    function marcador(f) {                               // EN PIE x/n y mis saltos, debajo de la barra del motor
      var cx = (f.x0 + f.x1) / 2, now = c.ahora(), my = 86;
      txt('EN PIE ' + vivos() + '/' + n, cx - 90, my, 16, '#fffdf2', 0, true);
      if (c.yo >= 0 && c.yo < n) txt('SALTOS ' + saltos(c.yo), cx + 90, my, 16, P[c.yo].st ? '#ff8a8a' : '#ffd23f', 0, true);
      if (now > -1 && now < 3.2 && !c.practica) {
        txt('¡BRINCA CUANDO EL MECATE PEGUE EN EL PISO!', cx, 124, 18, '#fffdf2', 0, true);
        txt('A = SALTAR · mira la sombra del mecate', cx, 148, 14, '#ffd23f', 0, true);
      }
      var h = v3 ? v3.hito : null;
      if (h && absT - h.t < 1.2) txt('¡' + h.n + ' SALTOS!', cx, 170 - (absT - h.t) * 20, 22, '#5cff7a', 0, true);
      if (c.yo >= 0 && c.yo < n && !P[c.yo].st && P[c.yo].esc > 0) txt('CHUPETA: VIDA EXTRA', cx, my + 22, 14, '#ffd23f', 0, true);
      if (now >= 3.2) letreros(cx, now);
    }
    function proxPeligro(p, gt) {                        // segundos para el próximo peligro que me llega (null si no hay)
      var O = OBS[p], k;
      for (k = 0; k < O.length; k++) if (O[k].hz && O[k].t > gt - 0.05) return O[k].t - gt;
      return null;
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0) V3.musica(fase(now) === 2 && !finJuego(now) ? 'mecate2' : 'mecate');
      v3.esc.render(dt);
      for (k = 0; k < n; k++) {
        var gp = v3.pjs[k].pj.g.position, pt = v3.esc.proyectar(gp.x, gp.y, gp.z + 1.0);
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      for (k = 0; k < n; k++) {                          // el globo del que pisó el mecate
        var s4 = v3.pjs[k], edad = absT - s4.outT;
        if (!s4.st || edad < 0 || edad > 1.6) continue;
        var pb = v3.esc.proyectar(s4.x, 3.3, s4.z), bx = Math.min(f.x1 - 135, Math.max(f.x0 + 135, pb.x)), by = Math.max(110, pb.y - (k % 3) * 40 - Math.min(edad, .4) * 16);
        rr(bx - 125, by - 17, 250, 34, 12, '#fffdf2', 3.5);
        poly([[pb.x - 8, by + 17], [pb.x + 8, by + 17], [pb.x, by + 32]], '#fffdf2', 3);
        txt('¡PISÓ EL MECATE, PISÓ!', bx, by, 16, '#c4283a', 0, true);
      }
      for (k = 0; k < n; k++) {                          // el globo del que se salvó con la chupeta
        var s6 = v3.pjs[k], ed2 = absT - (s6.salvoA || -9);
        if (s6.st || ed2 < 0 || ed2 > 1.3) continue;
        var ps2 = v3.esc.proyectar(s6.x, 3.6, s6.z);
        rr(ps2.x - 95, ps2.y - 30 - ed2 * 14, 190, 30, 10, '#ffd23f', 3); txt('¡SALVADO! (chupeta)', ps2.x, ps2.y - 15 - ed2 * 14, 14, INKC, 0, true);
      }
      if (c.yo >= 0 && c.yo < n && !P[c.yo].st) {        // el peligro que me viene: ¡AHORA! encima de mi cabeza
        var dP = proxPeligro(c.yo, now);
        if (dP !== null && dP < 0.75 && dP > -0.05) {
          var yp = v3.pjs[c.yo], ph = v3.esc.proyectar(yp.pj.g.position.x, yp.pj.g.position.y + 4.3, yp.z);
          txt(dP < 0.4 ? '¡AHORA!' : '¡OJO!', ph.x, ph.y, dP < 0.4 ? 24 : 18, dP < 0.4 ? '#ff3b4e' : '#ffd23f', 0, true);
        }
      }
      marcador(f);
      if (typeof drawP === 'function') drawP();
    }

    var g = {
      update: function (dt) {
        var gt = c.ahora(), p;
        absT += dt;
        for (p = 0; p < n; p++) updJugador(p, gt);
        var k = siguiente(gt) - 1;                                 // chasquido al pasar un cruce (cosmético)
        if (k !== lastCross) { if (k >= 0 && gt >= 0) SND(90, 0.05, 'triangle', 0.03); lastCross = k; }
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(c.campo());
        dibujar2D();
      },
      ai: function (p, dt, api) {
        var gt = c.ahora(), pl = plan[p], q = P[p], sk = c.skill[p], r = cpuR[p];
        if (q.st || gt < 0) return;
        var G = grupos[p];
        while (pl.g < G.length && G[pl.g].T <= gt) { pl.g++; pl.at = null; }
        if (pl.g >= G.length) return;
        var gr = G[pl.g];
        if (pl.at === null && gt >= gr.aim - PLAN_H) {
          if (r.next() < 0.08 * (1 - sk)) pl.at = Infinity;            // se distrajo con el chisme
          else {
            var sg = (0.090 - 0.065 * sk) * (lv === 3 ? 0.5 : 1), z = (r.next() + r.next() + r.next() - 1.5) * 2;
            pl.at = Math.max(gr.aim + z * sg, q.tj + FLY + REC + 0.005, gt + 0.18);
          }
        }
        if (pl.at !== null && pl.at !== Infinity && gt >= pl.at) { api.press('a'); pl.at = Infinity; }
      },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) out.push(P[p].st ? P[p].sc : dur * 30 + 1);
        return out;
      },
      cuerpo: function (p) { return { y: Math.round(P[p].y), st: P[p].st, sc: P[p].sc }; },
      done: function () { return vivos() <= 1; },
      vivo: function (p) { return !P[p].st; },
      alRemoto: function (p, o, t) { if (o && o.st && !P[p].st) elim(p, o.sc); },
      alCpu: function (p) { P[p].own = false; },
      alHum: function (p, o) { P[p].own = false; if (o) { if (o.st && !P[p].st) elim(p, o.sc); else if (!o.st) P[p].y = o.y || 0; } },
      onEv: function (ty, p, d, t) { if (ty === 'out' && P[p]) elim(p, d && d.kk != null ? d.kk : Math.floor(c.ahora() * 30)); },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0];
        if (!q) return '';
        var ch = q.chup ? ' · ' + q.chup + (q.chup > 1 ? ' chupetas' : ' chupeta') : '';
        return (q.st ? 'aguantó ' + Math.max(0, Math.floor(q.sc / 30 - lead + 0.99)) + ' s' : 'no pisó el mecate ni una vez') + ch;
      },
      vista: function () {
        var gt = c.ahora(), sig = [], k = siguiente(gt), h = 7, j, aims = [], p;
        for (p = 0; p < n; p++) { var G2 = grupos[p], gi = 0; while (gi < G2.length && G2[gi].T <= gt) gi++; aims.push(gi < G2.length ? G2[gi].aim : null); }
        for (j = k; j < cruces.length && sig.length < 4; j++) sig.push(+cruces[j].t.toFixed(3));
        for (j = 0; j < cruces.length; j++) h = (Math.imul(h ^ Math.round(cruces[j].t * 1000), 16777619) >>> 0);
        return { gt: gt, lv: lv, lead: lead, nCruces: cruces.length, cruceHash: h, sig: sig,
          aim: aims[c.yo >= 0 && c.yo < n ? c.yo : 0], aims: aims, esc: P.map(function (q) { return q.esc; }), chup: P.map(function (q) { return q.chup; }),
          eventos: EVS.map(function (e) { return e.k + '@' + (e.ini === null ? 'x' : e.ini.toFixed(2)); }), peligros: HZ.length, F1: F1, F2: F2,
          st: P.map(function (q) { return q.st; }), sc: P.map(function (q) { return q.sc; }), y: P.map(function (q) { return q.y; }),
          tj: P.map(function (q) { return q.tj; }), vivos: vivos(), cool: FLY + REC };
      }
    };
    return g;
  }
});
})();
