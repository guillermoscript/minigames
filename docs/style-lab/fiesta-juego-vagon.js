'use strict';
/* LA FIESTA · EN VIVO · f_vagon · ¡EL VAGÓN!  (FFA survival, modelo C: el juez simula cuerpos y empujones, los demás interpolan y predicen su propio cuerpo)
   Vagón del Metro de Caracas en hora pico, visto desde arriba. Stick + A.
     Stick: caminar (con inercia: los cuerpos tienen velocidad y se chocan).
     A: EMPUJÓN. 0,3 s de carga VISIBLE (el cuerpo se echa atrás, anillo que se cierra y «!»), y sale un codazo en redondo: todo rival a ≤60 px sale
        despedido lejos de ti (≈120 px), aturdido 0,4 s, y si te pegan mientras cargas pierdes la carga. Enfriamiento 0,8 s. Los choques pasan el golpe
        en cadena (dominó).
   Estaciones: 4 puertas por lado; se abren por un lado (arriba o abajo, alternando; el primer lado y los tiempos salen de c.rng en mk) con LUZ DE AVISO 1 s
   antes, quedan abiertas 3 s y cierran. Con la puerta abierta, LA MAREA de gente que se baja arrastra hacia ese lado y hacia el hueco más cercano (quedarse
   quieto es salir). Quien cruza el umbral de una puerta abierta se queda en el andén: FUERA (puntaje = tick de salida). El empujado se tambalea en el umbral
   (su velocidad hacia afuera se frena: hay que rematarlo). Si la puerta cierra con alguien en el umbral, lo escupe para adentro.
   Gana el último dentro del vagón; si quedan varios al final, empatan (survival: dur·30+1).
   EL VAGÓN OFRECE: 4 TUBOS (empuja el stick CONTRA un tubo y te agarras: la marea, los frenazos y el músico no te mueven; aguanta 2,5 s y se te resbala la
   mano; un empujón te suelta y te pega al 40 %; pulsar A te suelta y carga). Un PUESTO LIBRE a la vez (se libera cuando se baja el que iba sentado: empuja
   contra él y te sientas 3,5 s; al rato llega la señora y te levanta de una patada). El FRENO DE EMERGENCIA en cada extremo (desde la hora pico, recarga 7 s):
   lo jalas caminando contra la palanca y 0,5 s después todos menos tú salen rodando hacia el otro extremo, aturdidos (con la puerta abierta = la marea los saca).
   Puertas: en la hora pico (Nv2+) una se TRABA y no abre; en los últimos segundos una NO CIERRA (se queda abierta 1,4 s más, sola, con la marea hacia ella).
   LOS PASAJEROS HACEN COSAS (cuerpos que se mueven solos, sembrados en mk: idénticos en todas las pantallas, sin red): en cada estación los que se BAJAN caminan
   hacia la puerta y arrastran a quien se les atraviese («¡PERMISO!»), y al final los que SUBEN entran empujando hacia adentro y se quedan parados (estorban; cada
   vez son más). El MÚSICO se para en el pasillo y en cada golpe de tambora (1,2 s, anillo que se cierra) empuja a todos los que estén cerca. Un SEÑOR SE DUERME
   atravesado en el pasillo (estorba) y en la próxima estación se despierta («¡AY, MI PARADA!») y sale corriendo pa' la puerta llevándose a quien esté en medio.
   ESCALADA (por c.ahora()/dur, sirve igual a 10 s): CALMA (<36 %) · ¡HORA PICO! (36-72 %: el músico, el dormido, el freno, más gente subiendo, puertas trabadas)
   · ¡ÚLTIMOS SEGUNDOS! (≥72 %: marea ×1,35, empujón más fuerte y enfriamiento 0,5 s, tramos más cortos, la puerta que no cierra, SE VA LA LUZ en el túnel 2,5 s
   —solo se ven los aros— y música más rápida). Cartel, sacudida y luz cambian en cada fase.
   Niveles: 1 lo de arriba · 2 + FRENAZO (aviso 0,7 s; todos salen rodando hacia un extremo) y puertas trabadas · 3 + el VENDEDOR DE CARAMELOS recorre el pasillo
   central y aparta a empujones a quien se le atraviese (se ve venir de lejos), más pasajeros y otro apagón. Cada nivel con su luz: mañana / tarde / último tren.
   LA GENTE ES LA PROTAGONISTA (ronda 3): en cada estación llega una OLEADA (a los 0,5 s de abrir, un frente de gente cruza el vagón desde la pared de enfrente hacia la
   puerta a 3,6 px/tick y ARRASTRA a todo el que esté en la corriente —los 64 px detrás del frente—; los agarrados a un tubo aguantan) y desde la 2.ª estación hay un TAPÓN:
   un señor se planta en una puerta abierta (Nv2+ y desde la hora pico: dos), no deja pasar y empuja pa' dentro hasta que se va (a los 1,5 s). Más pasajeros a bordo (hasta 7).
   Todo es función del tick sembrado (R3 sale de c.rng DESPUÉS del resto: el calendario no cambia). Dibujo 3D: la multitud va en InstancedMesh (multitud()).
   Toda la regla vive en step() (solo el juez, 1/30 s). Estado entero y reproducible: posiciones en 1/4 px, velocidades en 1/64 px/tick; el calendario de
   estaciones, frenazos, vendedor, pasajeros, músico, dormido, puestos y apagones sale de c.rng en mk (las pantallas lo conocen sin red); el freno de emergencia
   (quién y cuándo) viaja en el snapshot. pack() = 37 enteros (≤200 B) y restore() sigue EXACTO tras migrar.
   Pantallas que no son el juez: el cuerpo propio se PREDICE (predict, reconciliado contra la historia propia en el tick del snapshot, M3 §4) y los demás se
   extrapolan el retraso de la vista con su velocidad (los empujados ruedan con fricción, como la pelota de futbolito). Al pulsar A la carga se ve al instante.
   Dibujo: 3D low poly (fiesta-3d.js: el vagón por dentro, el túnel y el andén que llega) o, sin WebGL / ?plano=1, el 2D con primitivas del laboratorio. Sin Math.random/Date.now.
   Ventaja del juez: el juego retrasa la entrada del PROPIO juez la mediana del retraso de vista que le informan sus rivales (único tipo x*: `xlag`, 1/s) y
   le predice el cuerpo; ver retrasoJuez(). Sin eso el juez ganaba 37-47 % (puerta 33 %); con eso 23-32 % (banco --red, 200 partidas por celda).
   Medido en docs/style-lab/pruebas/fiesta-vagon-bench.js (balance por asiento, ociosos, habilidad, ritmo; --red) y en test/fiesta-live-vagon.test.js. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_vagon')) return;

var TK = 30, FW = 600, FH = 170, RP = 17, MAXP = 4;
var SPD = 110 / TK, ACC = 0.25, WIND_SLOW = 0.4, FRIC = 0.9, REST = 0.35, VMAX = 18, DOOR_DAMP = 0.8;
var WIND = 9, CD = 24, R_HIT = 60, SHOVE_V = 13, LUNGE = 4, STUN_HIT = 12, CHAIN_MIN = 4, CHAIN_STUN = 6, CREDIT_T = 60;
var DOORS = [75, 225, 375, 525], DW = 76, GAP = DW / 2 - 6, OUT_D = RP * 0.5;          // 4 puertas por lado, como los vagones de la Línea 1
var MAREA0 = 0.3, MAREA1 = 0.22, MAREA_T = 30, MAREA_X = 0.12, MAREA_Y = 50;                          // la marea de gente que se baja: tira hacia la puerta abierta (px/tick²)
var WARN = 30, OPEN = 90, FRZ_WARN = 21, FRZ_V = 8, FRZ_STUN = 8;
var SELL_R = 22, SELL_V = 50 / TK, SELL_PUSH = 6, SELL_REST = 120;
var LAG_MAX = 1.0, FJ_MAX = 0.8;
var NPC_R = 15, NPC_V = 2.6, NPC_VOUT = 3.4, NPC_BUMP = 1.4;                                   // pasajeros: cuerpos que caminan solos (px/tick)
var POLES = [[150, 55], [450, 55], [150, 115], [450, 115]], POLE_R = 5, GRAB_D = 30, AG_MAX = 75, SEAT_MAX = 105, AG_CD = 36;   // tubos y el puesto (ancla 5)
var BRK_D = 28, FRB_WARN = 15, FRB_CD = 210;                                                    // freno de emergencia: palanca en cada extremo, a media altura
var MUS_R = 64, MUS_BEAT = 36, MUS_V = 5.5, MUS_STUN = 6;                                       // el músico: golpe de tambora cada 1,2 s
var ZZ_R = 13, ZZ_L = 32, ZZ_WARN = 30, ZZ_V = 3.6;                                             // el dormido atravesado en el pasillo
var BL_WARN = 20, BL_LEN = 75, LOCA_EXT = 42;                                                   // apagón · la puerta que no cierra
var FASE_U = [0.36, 0.72], FASE_MAREA = [1, 1.15, 1.35], FASE_CD = [24, 20, 15], FASE_SHOVE = [1, 1.05, 1.15];
var FASE_TXT = [null, ['¡HORA PICO!', 'más gente, el músico… y el freno de emergencia', '#ffb43a'], ['¡ÚLTIMOS SEGUNDOS!', '¡la marea jala más y una puerta no cierra!', '#ff3b4e']];
var OLA_V = 3.6, OLA_T0 = 14, OLA_W = 64, OLA_F = 0.55, FASE_OLA = [0.8, 1, 1.25], OLA_LEN = Math.ceil((FH + 25 + 20) / OLA_V);   // la OLEADA: frente de gente que cruza el vagón hacia la puerta abierta y arrastra
var TAP_IN = 6, TAP_OUT = 46, TAP_END = 62, TAP_Y = 13;                                          // el TAPÓN: un señor se planta en una puerta abierta y no deja pasar (empuja pa' dentro)
var G = 5, PS = 8, PACKN = G + PS * MAXP;                    // [k, golpes, kr, frK, frP] + 8 por jugador = 37
var INK = '#14101c', SEATCOL = ['#ff7ab0', '#ffb36b', '#3fb0ff', '#4fd06a'];
var LINEA1 = ['PROPATRIA', 'PÉREZ BONALDE', 'PLAZA SUCRE', 'GATO NEGRO', 'AGUA SALUD', 'CAÑO AMARILLO', 'CAPITOLIO', 'LA HOYADA', 'PARQUE CARABOBO', 'BELLAS ARTES',
  'COLEGIO DE INGENIEROS', 'PLAZA VENEZUELA', 'SABANA GRANDE', 'CHACAÍTO', 'CHACAO', 'ALTAMIRA', 'PARQUE DEL ESTE', 'LOS DOS CAMINOS', 'LOS CORTIJOS', 'LA CALIFORNIA', 'PETARE', 'PALO VERDE'];
var PAL = [   // mañana / tarde (hora pico) / último tren
  { tunel: '#2a2838', luz: '#fff3b0', casco: '#d4d7e0', franja: '#ff8a1f', piso: '#9a9db0', pasillo: '#8a8da2', banco: '#2f6fdb', anden: '#e6dcc4', loseta: '#d2c6aa', borde: '#ffd23f', gente: ['#c97a5a', '#7a8ac9', '#c9b25a', '#8ac97a'] },
  { tunel: '#2e2232', luz: '#ffd08a', casco: '#d8c8bc', franja: '#ff6a3d', piso: '#a08c88', pasillo: '#907c7a', banco: '#c9433d', anden: '#e8cfae', loseta: '#d4b894', borde: '#ffc23f', gente: ['#b0604a', '#6a6ab0', '#b09a4a', '#6ab06a'] },
  { tunel: '#141224', luz: '#bfe0ff', casco: '#8a8ea8', franja: '#d9601f', piso: '#5d5f78', pasillo: '#525470', banco: '#3a4a8a', anden: '#8a8296', loseta: '#787088', borde: '#c9a83f', gente: ['#6a4a5a', '#4a5a7a', '#6a6a4a', '#4a6a5a'] }
];
function q4(v) { return Math.round(v * 4) / 4; }
function q64(v) { return Math.round(v * 64) / 64; }
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
var V3S = null;                                                                       // el kit 3D cuando está dibujando (V3S.sfx); si no, los bips de siempre
function SON(k3, f, d, ty, v, sl) { if (V3S) V3S.sfx(k3); else SND(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function faceOf(x, y) { var a = Math.atan2(y, x); return ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16; }
function faceVec(f) { var a = f * Math.PI / 8; return { x: Math.cos(a), y: Math.sin(a) }; }
/* mask: bits de las puertas abiertas (sin mask = todas) */
function enMask(mask, i) { return mask === undefined || ((mask >> i) & 1) === 1; }
function puertaIdx(x, mask) { var b = -1; for (var i = 0; i < DOORS.length; i++) if (enMask(mask, i) && (b < 0 || Math.abs(x - DOORS[i]) < Math.abs(x - DOORS[b]))) b = i; return b < 0 ? 0 : b; }
function puertaDe(x, mask) { return DOORS[puertaIdx(x, mask)]; }
function gapOf(x, mask) { for (var i = 0; i < DOORS.length; i++) if (enMask(mask, i) && Math.abs(x - DOORS[i]) <= GAP) return DOORS[i]; return -1; }
var SPOTS = [];                                                                       // dónde se paran los que suben (lejos de tubos y puestos)
(function () { var xs = [60, 100, 200, 245, 355, 400, 500, 540]; for (var i = 0; i < xs.length; i++) { SPOTS.push([xs[i], 45]); SPOTS.push([xs[i], 125]); } })();
var DISC = [0, 1, 2, 3, 4], POSIDX = [];
(function () { var i, b; for (i = 0; i < MAXP; i++) { b = G + PS * i; POSIDX.push(b, b + 1); DISC.push(b + 2, b + 3, b + 4, b + 5, b + 6, b + 7); } })();

FIESTA.LIVE.add('f_vagon', {
  name: '¡EL VAGÓN!', modos: ['ffa'], clase: 'survival', modelo: 'C', dur: 50,
  stick: true, botones: 1, snapHz: 10, migra: true, minHumanos: 1,
  limites: { scoreMax: 1501, scoreRate: 31, minT: 6, finTemprano: 1 },        // la primera puerta abre a los ≥6,5 s: antes no puede acabar
  packN: PACKN, packDiscretos: DISC,
  carta: {
    obj: '¡Sácalos pa\'l andén cuando abran las puertas!',
    gana: 'El último que quede dentro del vagón gana. Si quedan varios al final, empatan.',
    como: { tactil: 'Joystick: moverte (contra un tubo: agárrate) · A: empujón', teclado: 'WASD o flechas (contra un tubo: agárrate) · ESPACIO: empujón' },
    roles: null,
    demos: [
      { id: 'mover', txt: 'Mira la luz: esa puerta se abre en 1 s. ¡Aléjate o agárrate de un tubo!' },
      { id: 'saltar', txt: 'A: empujón. Ponte entre el pana y el centro y mándalo pa\'l andén' },
      { id: 'mover', txt: 'Cuidado con los que se bajan: te arrastran pa\' la puerta. Y el freno de emergencia… jálalo tú' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, durT = Math.max(3 * TK, Math.round(dur * TK)), pal = PAL[lv - 1], i, p;
    var rng = c.rng, R = [];
    for (i = 0; i < 40; i++) R.push(rng.next());              // SIEMPRE 40 extracciones: mismo consumo en los 3 niveles
    var R3 = [], r3i = 0; var R2 = [], ri = 0; for (i = 0; i < 160; i++) R2.push(rng.next());   // y 160 más para la gente y el vagón (después: el calendario de siempre no cambia)
    function r2() { var v = R2[ri % R2.length]; ri++; return v; }
    for (i = 0; i < 60; i++) R3.push(rng.next());              // 60 más (después de todo lo anterior: el calendario de siempre no cambia) para tapones
    function r3() { var v = R3[r3i % R3.length]; r3i++; return v; }
    var F1 = Math.round(FASE_U[0] * durT), F2 = Math.round(FASE_U[1] * durT);
    function faseK(k) { return k < F1 ? 0 : k < F2 ? 1 : 2; }
    var gente0 = !c.sinGente;                                  // (solo pruebas de mecánica sueltas: c.sinGente quita pasajeros, músico, dormido, puestos y apagones)
    /* calendario de estaciones: aviso (WARN) → abierta (OPEN, + LOCA_EXT con la puerta que no cierra) → viaje (4,5-7 s; en los últimos segundos 3,6-5 s).
       Por estación: jam = puerta trabada (Nv2+, desde la hora pico), loca = la que no cierra (últimos segundos, todos los niveles) */
    var stations = [], side0 = R[0] < 0.5 ? 0 : 1, t0 = Math.round(Math.min(5.5 + 2 * R[1], Math.max(1, dur * 0.3)) * TK), si = 0;
    for (var t = t0; t + WARN < durT && si < 12; si++) {
      var fs0 = faseK(t), loca = fs0 === 2 ? Math.floor(r2() * 4) : -1, jam = -1;
      if (lv >= 2 && fs0 >= 1 && r2() < (lv === 2 ? 0.5 : 0.7)) { jam = Math.floor(r2() * 4); if (jam === loca) jam = (jam + 2) % 4; }
      stations.push({ t: t, side: (side0 + si) % 2, jam: jam, loca: loca, ext: loca >= 0 ? LOCA_EXT : 0 });
      t += WARN + OPEN + (loca >= 0 ? LOCA_EXT : 0) + Math.round((fs0 === 2 ? 3.6 + 1.4 * R[2 + si] : 4.5 + 2.5 * R[2 + si]) * TK);
    }
    for (var sj = 0; sj < stations.length; sj++) {            // tapones y oleada de cada estación (2 extracciones fijas por estación)
      var sx0 = stations[sj], fz0 = faseK(sx0.t), nT, d0 = Math.floor(r3() * 4), d1;
      r3(); sx0.tap = []; sx0.ola = 0;
      if (!gente0) continue;
      sx0.ola = FASE_OLA[fz0] * (lv >= 3 ? 1.1 : 1);
      nT = sj === 0 ? 0 : lv === 1 ? (fz0 >= 1 ? 1 : 0) : (fz0 >= 1 ? 2 : 1);
      if (sx0.jam >= 0) nT = Math.min(nT, 1);
      if (d0 === sx0.jam) d0 = (d0 + 1) % 4;
      if (nT >= 1) sx0.tap.push(d0);
      if (nT >= 2) { d1 = (d0 + 2) % 4; if (d1 === sx0.jam) d1 = (d1 + 1) % 4; if (d1 === d0) d1 = (d1 + 1) % 4; sx0.tap.push(d1); }
    }
    function maskDe(s) { return 15 & ~(s.jam >= 0 ? 1 << s.jam : 0); }
    var linea0 = Math.floor(R[14] * LINEA1.length), lineaDir = R[15] < 0.5 ? 1 : -1;
    /* frenazos (Nv2+): uno por tramo de viaje con probabilidad, a mitad del tramo */
    var frz = [];
    if (lv >= 2) {
      var segA = 0;
      for (i = 0; i <= stations.length; i++) {
        var segB = i < stations.length ? stations[i].t : durT, len = segB - segA;
        if (len > FRZ_WARN + 3 * TK && R[16 + i] < (lv === 2 ? 0.65 : 0.8)) frz.push({ t: segA + Math.round(len * (0.3 + 0.35 * R[28 + (i % 12)])), sgn: R[17 + i] < 0.5 ? -1 : 1 });
        if (i < stations.length) segA = stations[i].t + WARN + OPEN + stations[i].ext;
      }
    }
    /* vendedor (Nv3): entra a los 7-11 s por un extremo, cruza a 50 px/s, descansa 4 s y vuelve */
    var sellT = lv >= 3 ? Math.round((7 + 4 * R[38]) * TK) : -1, sellDir0 = R[39] < 0.5 ? 1 : -1, sellCross = Math.ceil((FW + 2 * SELL_R + 40) / SELL_V);
    /* PASAJEROS: en cada estación se bajan los que tocaba (caminan del sitio a la puerta abierta más cercana) y al final suben otros (de la puerta a un sitio
       libre) que se quedan 1-2 estaciones. Cuántos suben: 1 calma · 2 hora pico · 3 últimos segundos (+1 en Nv3); máximo 6 a bordo. */
    var pas = [], abordo = [], m, j0;
    if (gente0) for (j0 = 0; j0 < stations.length; j0++) {
      var s0 = stations[j0], ab0 = s0.t + WARN, mk0 = maskDe(s0), fsj = faseK(s0.t);
      for (m = abordo.length - 1; m >= 0; m--) { var pa = pas[abordo[m]]; if (pa.baja === j0) { pa.tOut = ab0 + 3 + Math.floor(r2() * 10); pa.outX = puertaDe(pa.tx, mk0); pa.outSd = s0.side; abordo.splice(m, 1); } }
      var nIn = [2, 3, 4][fsj] + (lv >= 3 ? 1 : 0);
      for (m = 0; m < nIn && abordo.length < 7; m++) {
        var libres = [], q2, a2;
        for (q2 = 0; q2 < SPOTS.length; q2++) { var oc = false; for (a2 = 0; a2 < abordo.length; a2++) if (pas[abordo[a2]].spot === q2) oc = true; if (!oc) libres.push(q2); }
        var sp2 = libres[Math.floor(r2() * libres.length)];
        pas.push({ tIn: ab0 + OPEN - 30 + m * 4, inX: puertaDe(SPOTS[sp2][0], mk0), inSd: s0.side, tx: SPOTS[sp2][0], ty: SPOTS[sp2][1], spot: sp2, baja: j0 + 1 + (r2() < 0.45 ? 1 : 0), tOut: 1e9, outX: 0, outSd: 0 });
        abordo.push(pas.length - 1);
      }
    }
    /* EL MÚSICO: se para de su puesto al empezar la hora pico, toca en el pasillo (golpe cada MUS_BEAT) y se vuelve a sentar */
    var musT = gente0 && F1 + 30 < durT - 60 ? F1 + 30 : -1, musX = 210 + 180 * r2(), musSd = r2() < 0.5 ? 0 : 1, musPlay = musT + 24, musEnd = musPlay + cl(Math.round(durT * 0.22), 90, 240), musGone = musEnd + 24;
    /* EL DORMIDO: en el primer viaje de la hora pico se queda dormido y cae atravesado en el pasillo; en la próxima estación sale corriendo pa' la puerta */
    var zz = null;
    if (gente0) {
      var tz = -1, wk = -1, j1;
      for (j1 = 0; j1 < stations.length; j1++) { var e1 = stations[j1].t + WARN + OPEN + stations[j1].ext; if (e1 >= F1 - 30) { tz = e1 + 15; break; } }
      if (tz < 0) tz = F1;
      if (tz + ZZ_WARN < durT - 30) {
        var zx = 140 + 320 * r2(); if (Math.abs(zx - musX) < 110) zx = musX + (zx < musX ? -110 : 110); zx = cl(zx, 70, 530);
        zz = { t: tz, x: zx, sd: r2() < 0.5 ? 0 : 1, wake: -1, outSd: 0, outX: 0 };
        for (j1 = 0; j1 < stations.length; j1++) if (stations[j1].t + WARN > tz + ZZ_WARN + 45) { wk = j1; break; }
        if (wk >= 0) { zz.wake = stations[wk].t + WARN + 8; zz.outSd = stations[wk].side; zz.outX = puertaDe(zx, maskDe(stations[wk])); }
      }
    }
    /* PUESTOS LIBRES: en cada estación se baja alguien que iba sentado (desde la 2.ª); el puesto queda libre hasta la estación siguiente (llega la señora) */
    var asientos = [];
    if (gente0) for (j0 = 1; j0 < stations.length; j0++) {
      var sa0 = stations[j0].t + WARN + 20, sa1 = j0 + 1 < stations.length ? stations[j0 + 1].t + WARN + 15 : durT;
      asientos.push({ t0: sa0, t1: sa1, x: [150, 300, 450][Math.floor(r2() * 3)], sd: r2() < 0.5 ? 0 : 1 });
    }
    /* APAGONES en el túnel: uno en los últimos segundos; en Nv3 otro en la hora pico. t = empieza a titilar (BL_WARN), luego BL_LEN a oscuras */
    var apagones = [];
    if (gente0) { if (lv >= 3 && F1 + 60 < F2) apagones.push(Math.round((F1 + F2) / 2)); if (F2 + 45 + BL_WARN < durT) apagones.push(F2 + 45); }

    /* ───── estado autoritativo ───── */
    var st = { k: 0, golpes: 0, kr: 0, frK: 0, frP: 0, p: [] };              // frK = tick+1 en que jalaron el freno (0 = nunca); frP = quién+1 | 8 si fue la palanca de la izquierda              // kr = tick de RELOJ del juez al simular (tras migrar, k va por detrás del reloj): mide la edad de la vista
    /* Ventaja del juez (08 §11.2 #10, M3/M4): el juez ve el mundo vivo y su entrada no viaja; los demás lo ven `lag` atrás. Mientras el runtime no traiga la vista justa
       (M3 §3.3; cuando exista, c.lag() en el juez lo delata y esto se apaga), el juego RETRASA LA ENTRADA DEL PROPIO JUEZ la mediana del retraso de vista que le informan
       sus rivales humanos (xlag, 1 por segundo) y le PREDICE su cuerpo (como a cualquiera), así que su pantalla responde al instante. Solo afecta al asiento del juez,
       nunca a la práctica ni a las CPU. Medido en test/fiesta-live-vagon.test.js y en el banco `--red`. */
    var ownBuf = [], ownTap = 0, ownE = { x: 0, y: 0 }, lagSeat = [], fjT = 0, fjObj = 0, xlagAt = -9;
    function retrasoJuez() {
      if (c.practica || typeof c.lag === 'function' || c.yo < 0 || c.yo >= n) return 0;
      var vs = [], j, now = c.ahora();
      for (j = 0; j < n; j++) if (j !== c.yo && !(c.cpu && c.cpu[j]) && lagSeat[j] && now - lagSeat[j].at < 5) vs.push(lagSeat[j].v);
      if (!vs.length) return 0;
      vs.sort(function (a, b) { return a - b; });
      return Math.round(cl(vs[vs.length >> 1], 0, FJ_MAX) * TK);
    }
    if (typeof c.on === 'function') c.on('xlag', function (d, p) { if (typeof d === 'number' && p >= 0 && p < n) lagSeat[p] = { v: cl(d / 1000, 0, LAG_MAX), at: c.ahora() }; });
    /* salida en las 4 esquinas de un rectángulo centrado (simétrico en x y en y; las puertas también lo son): ningún asiento arranca mejor parado */
    var SPX = n === 2 ? [187.5, 412.5] : n === 3 ? [187.5, 412.5, 300] : [187.5, 412.5, 187.5, 412.5], SPY = n === 2 ? [FH / 2, FH / 2] : n === 3 ? [55, 55, 115] : [55, 55, 115, 115];
    for (p = 0; p < MAXP; p++) st.p.push({ x: p < n ? SPX[p] : FW / 2, y: p < n ? SPY[p] : FH / 2, vx: 0, vy: 0, stun: 0, wind: 0, cd: 0, face: p < n && SPX[p] > FW / 2 ? 8 : 0, lh: 0, sc: 0, lt: 99, ko: 0, ag: 0, ag2: 0 });   // ag: ancla (1-4 tubo, 5 puesto); ag2: ticks agarrado o, suelto, enfriamiento
    var cpr = []; for (p = 0; p < n; p++) cpr.push({ t: 0, next: 0, tx: SPX[p], ty: SPY[p], tg: -1, mode: 0, lastA: -9, r: c.rngFor('cpu' + p) });
    var asiento = function (pp) { return (c.seats && c.seats[pp]) || { name: 'P' + (pp + 1), color: null, ch: null }; };
    function vivoP(pp) { return pp >= 0 && pp < n && st.p[pp].sc === 0; }
    function vivos() { var j, v = 0; for (j = 0; j < n; j++) if (st.p[j].sc === 0) v++; return v; }
    /* puertas en el tick k: ph 0 cerradas (next = siguiente estación), 1 aviso, 2 abiertas */
    /* mask = puertas abiertas (bits); en la prórroga de la puerta loca solo queda ella. el = ticks desde que abrieron */
    function doorAt(k) {
      for (var j = 0; j < stations.length; j++) {
        var s = stations[j], fin = s.t + WARN + OPEN + s.ext;
        if (k < s.t) return { ph: 0, side: s.side, idx: j, tTo: s.t - k, mask: 0, jam: s.jam, loca: s.loca };
        if (k < s.t + WARN) return { ph: 1, side: s.side, idx: j, tTo: 0, mask: 0, jam: s.jam, loca: s.loca };
        if (k < fin) { var el = k - s.t - WARN; return { ph: 2, side: s.side, idx: j, tTo: 0, left: fin - k, el: el, mask: el < OPEN ? maskDe(s) : 1 << s.loca, jam: s.jam, loca: s.loca, ext: el >= OPEN }; }
      }
      return { ph: 0, side: -1, idx: stations.length, tTo: 99999, mask: 0, jam: -1, loca: -1 };
    }
    /* ── la gente: todo es función del tick (sembrado en mk), así que el juez y las pantallas lo ven igual ── */
    function pasAt(pa, k) {                                  // {x, y, dx, dy, mov: 0 parado · 1 subiendo · 2 bajándose} o null
      if (k < pa.tIn) return null;
      var yo0, yi, d, L1, L2x, L2y, L2, u;
      if (k < pa.tOut) {
        yo0 = pa.inSd === 0 ? -RP - 8 : FH + RP + 8; yi = pa.inSd === 0 ? 40 : FH - 40; d = (k - pa.tIn) * NPC_V; L1 = Math.abs(yi - yo0);
        L2x = pa.tx - pa.inX; L2y = pa.ty - yi; L2 = Math.sqrt(L2x * L2x + L2y * L2y) || 1;
        if (d < L1) return { x: pa.inX, y: yo0 + (yi > yo0 ? d : -d), dx: 0, dy: yi > yo0 ? 1 : -1, mov: 1 };
        if (d < L1 + L2) { u = (d - L1) / L2; return { x: pa.inX + L2x * u, y: yi + L2y * u, dx: L2x / L2, dy: L2y / L2, mov: 1 }; }
        return { x: pa.tx, y: pa.ty, dx: 0, dy: 0, mov: 0 };
      }
      return salida(pa.tx, pa.ty, pa.outX, pa.outSd, (k - pa.tOut) * NPC_VOUT);
    }
    function salida(x0, y0, ox, sd, d) {                     // camino del sitio a la puerta y pa' fuera, recorrido d px
      var yi = sd === 0 ? 30 : FH - 30, yo = sd === 0 ? -RP - 10 : FH + RP + 10, ax = ox - x0, ay = yi - y0, A = Math.sqrt(ax * ax + ay * ay) || 1, B = Math.abs(yo - yi);
      if (d < A) return { x: x0 + ax * d / A, y: y0 + ay * d / A, dx: ax / A, dy: ay / A, mov: 2 };
      if (d < A + B) return { x: ox, y: yi + (yo > yi ? 1 : -1) * (d - A), dx: 0, dy: yo > yi ? 1 : -1, mov: 2 };
      return null;
    }
    function musAt(k) {                                      // el músico: {x, y, toca, u (0→1 hasta el golpe), beat}
      if (musT < 0 || k < musT || k >= musGone) return null;
      var y0 = musSd === 0 ? RP + 6 : FH - RP - 6, u;
      if (k < musPlay) { u = (k - musT) / 24; return { x: musX, y: y0 + (FH / 2 - y0) * u, toca: false, u: 0, beat: false }; }
      if (k < musEnd) { var e = k - musPlay; return { x: musX, y: FH / 2, toca: true, u: (e % MUS_BEAT) / MUS_BEAT, beat: e > 0 && e % MUS_BEAT === 0 }; }
      u = (k - musEnd) / 24; return { x: musX, y: FH / 2 + (y0 - FH / 2) * u, toca: false, u: 0, beat: false };
    }
    function zzAt(k) {                                       // el dormido: ph 0 bosteza en su puesto (aviso) · 1 atravesado en el pasillo · 2 sale corriendo
      if (!zz || k < zz.t) return null;
      if (k < zz.t + ZZ_WARN) return { ph: 0, x: zz.x, y: zz.sd === 0 ? RP : FH - RP };
      if (zz.wake < 0 || k < zz.wake) return { ph: 1, x: zz.x, y: FH / 2 };
      var o = salida(zz.x, FH / 2, zz.outX, zz.outSd, (k - zz.wake) * ZZ_V); if (o) o.ph = 2; return o;
    }
    function seatAt(k) { for (var j = 0; j < asientos.length; j++) if (k >= asientos[j].t0 && k < asientos[j].t1) { var a = asientos[j]; return { x: a.x, y: a.sd === 0 ? 0 : FH, sd: a.sd, i: j, left: a.t1 - k }; } return null; }
    function anclaAt(a, k) { if (a >= 1 && a <= 4) return { x: POLES[a - 1][0], y: POLES[a - 1][1] }; if (a === 5) return seatAt(k); return null; }
    function apagonAt(k) { for (var j = 0; j < apagones.length; j++) { var d = k - apagones[j]; if (d >= 0 && d < BL_WARN + BL_LEN) return { j: j, warn: d < BL_WARN, d: d }; } return null; }
    function frenoLibre(k) { return k >= F1 && (st.frK === 0 || k - (st.frK - 1) >= FRB_CD); }
    function brakeAt(k) { if (!st.frK) return null; var d = k - (st.frK - 1); return d >= 0 && d < FRB_WARN + 14 ? { d: d, sgn: (st.frP & 8) ? 1 : -1, p: (st.frP & 7) - 1 } : null; }
    /* cuerpos que estorban en el tick k: {x, y, r, dx, dy, mov} (los que caminan arrastran); el dormido atravesado va aparte (cápsula) */
    function tapAt(sd, d, el) {                              // el tapón de la puerta d: entra, se planta, empuja pa' dentro y se va
      if (el < TAP_IN || el >= TAP_END) return null;
      var inw = sd === 0 ? 1 : -1, yy, dy, mov;
      if (el < TAP_IN + 8) { yy = -22 + (TAP_Y + 22) * (el - TAP_IN) / 8; dy = inw; mov = 2; }
      else if (el < TAP_OUT) { yy = TAP_Y; dy = inw; mov = 1; }
      else { yy = TAP_Y - (TAP_Y + 22) * (el - TAP_OUT) / (TAP_END - TAP_OUT); dy = -inw; mov = 2; }
      return { x: DOORS[d], y: sd === 0 ? yy : FH - yy, dx: 0, dy: dy, mov: mov, r: NPC_R, tap: true, ph: el < TAP_IN + 8 ? 0 : el < TAP_OUT ? 1 : 2 };
    }
    function cuerpos(k) {
      var out = [], j, o, dsT = doorAt(k);
      if (dsT.ph === 2 && dsT.el < TAP_END && stations[dsT.idx]) { var sT = stations[dsT.idx]; for (j = 0; j < sT.tap.length; j++) { o = tapAt(sT.side, sT.tap[j], dsT.el); if (o) { o.j = j; out.push(o); } } }
      for (j = 0; j < pas.length; j++) { o = pasAt(pas[j], k); if (o) { o.r = NPC_R; o.i = j; out.push(o); } }
      var mu = musAt(k); if (mu) out.push({ x: mu.x, y: mu.y, r: NPC_R, dx: 0, dy: 0, mov: 0, mus: true });
      var z = zzAt(k); if (z && z.ph === 2) out.push({ x: z.x, y: z.y, r: NPC_R, dx: z.dx, dy: z.dy, mov: 2, zz: true });
      return out;
    }
    function estacion(j) { var L = LINEA1.length; return LINEA1[(((linea0 + lineaDir * j) % L) + L) % L]; }
    function sellerAt(k) {
      if (sellT < 0 || k < sellT) return null;
      var u = k - sellT, per = sellCross + SELL_REST, leg = Math.floor(u / per), w = u - leg * per;
      if (w >= sellCross) return null;
      var dir = leg % 2 === 0 ? sellDir0 : -sellDir0, x0 = dir > 0 ? -SELL_R - 20 : FW + SELL_R + 20;
      return { x: x0 + dir * w * SELL_V, y: FH / 2, dir: dir, w: w };
    }
    function marea(ds, x, y, k) {                                                       // también arrastra de lado hacia el hueco abierto más cercano (más fuerte junto a la pared abierta)
      if (ds.ph !== 2) return { x: 0, y: 0 };
      var mul = FASE_MAREA[faseK(k)], f = (ds.el < MAREA_T ? MAREA0 : MAREA1) * mul, cerca = ds.side === 0 ? y < MAREA_Y : y > FH - MAREA_Y;
      var dx = puertaDe(x, ds.mask) - x;
      var r = { x: gapOf(x, ds.mask) < 0 ? (dx > 0 ? 1 : -1) * MAREA_X * (cerca ? 1 : 0.6) * f / MAREA0 : 0, y: ds.side === 0 ? -f : f };
      var ow = olaAt(ds, y);
      if (ow > 0) { r.y += (ds.side === 0 ? -1 : 1) * ow; if (gapOf(x, ds.mask) < 0) r.x += (dx > 0 ? 1 : -1) * ow * 0.3; }
      return r;
    }
    function olaFrente(ds) { return ds.side === 0 ? FH + 25 - OLA_V * (ds.el - OLA_T0) : -25 + OLA_V * (ds.el - OLA_T0); }   // y del frente de la oleada
    function olaOn(ds) { var s0 = ds.ph === 2 ? stations[ds.idx] : null; return !!(s0 && s0.ola && ds.el >= OLA_T0 && ds.el < OLA_T0 + OLA_LEN && ds.left > 6); }
    function olaAt(ds, y) {                                                              // fuerza (px/tick²) de la corriente de gente sobre quien está en y
      if (!olaOn(ds)) return 0;
      var beh = ds.side === 0 ? y - olaFrente(ds) : olaFrente(ds) - y;
      if (beh <= -14 || beh >= OLA_W) return 0;
      return (beh < 0 ? (beh + 14) / 14 : 1 - beh / OLA_W * 0.35) * OLA_F * stations[ds.idx].ola;
    }
    function frzAt(k) { for (var j = 0; j < frz.length; j++) { var d = k - frz[j].t; if (d >= 0 && d < FRZ_WARN + 12) return { j: j, d: d, sgn: frz[j].sgn }; } return null; }

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    function eject(pp, sd) {
      var q = st.p[pp];
      q.sc = st.k + 1; q.vx = 0; q.vy = 0; q.stun = 0; q.wind = 0; q.ag = 0; q.ag2 = 0; q.y = sd === 0 ? -RP : FH + RP;
      if (q.lh > 0 && q.lt <= CREDIT_T && q.lh - 1 !== pp) st.p[q.lh - 1].ko = Math.min(3, st.p[q.lh - 1].ko + 1);
    }
    function soltar(q, patada) {                                                        // se suelta del tubo / se para del puesto (patada: la señora lo levanta)
      if (patada && q.ag === 5) { q.vy = (q.y < FH / 2 ? 1 : -1) * 6; q.stun = Math.max(q.stun, 8); }
      q.ag = 0; q.ag2 = AG_CD;
    }
    function ocupada(a, yo) { for (var j = 0; j < n; j++) if (j !== yo && !st.p[j].sc && st.p[j].ag === a) return true; return false; }
    function choca(q, ox, oy, r, mov, mdx, mdy) {                                       // un cuerpo que no se deja mover (pasajero, músico, tubo, dormido) aparta al jugador
      var dx = q.x - ox, dy = q.y - oy, d = Math.sqrt(dx * dx + dy * dy), R0 = RP + r;
      if (d >= R0) return false;
      if (d < 0.01) { dx = 0; dy = oy < FH / 2 ? 1 : -1; d = 1; }
      var nx = dx / d, ny = dy / d, vn = q.vx * nx + q.vy * ny;
      q.x += nx * (R0 - d); q.y += ny * (R0 - d);
      if (vn < 0) { q.vx -= vn * nx * (1 + REST); q.vy -= vn * ny * (1 + REST); }
      if (mov) { q.vx += mdx * NPC_BUMP + nx * 0.8; q.vy += mdy * NPC_BUMP + ny * 0.8; q.stun = Math.max(q.stun, 4); if (q.ag) soltar(q, false); }
      return true;
    }
    function step() {
      var P = st.p, k = st.k, i2, j, oi, ord = [], fire = [], q, dx, dy, d, e, ex, ey, len, an;
      st.kr = Math.max(0, Math.round(c.ahora() * TK));
      if (k % 15 === 0) fjObj = retrasoJuez();
      if (fjT !== fjObj && k % 3 === 0) fjT += fjT < fjObj ? 1 : -1;                 // el retraso cambia despacio (1 tick cada 0,1 s)
      for (oi = 0; oi < n; oi++) ord.push((k & 1) ? n - 1 - oi : oi);              // orden alterno por tick: nadie gana siempre los empates
      var ds = doorAt(k), openSide = ds.ph === 2 ? ds.side : -1, fs = faseK(k);
      /* 1) control, temporizadores, agarrarse (tubo / puesto), freno de emergencia, carga del empujón */
      for (oi = 0; oi < n; oi++) {
        i2 = ord[oi]; q = P[i2];
        var tapN = c.tap(i2, 'a');
        e = c.eje(i2) || { x: 0, y: 0 };
        if (i2 === c.yo && !c.practica) {                                                // entrada propia del juez: sale de la cola fjT ticks después
          ownBuf.push({ k: k, t: tapN, x: +e.x || 0, y: +e.y || 0 });
          tapN = 0;
          while (ownBuf.length && ownBuf[0].k <= k - fjT) { var ob = ownBuf.shift(); ownTap += ob.t; ownE = { x: ob.x, y: ob.y }; }
          if (ownTap > 0) { tapN = ownTap; ownTap = 0; }
          e = ownE;
        }
        if (q.sc) continue;
        ex = +e.x || 0; ey = +e.y || 0; len = Math.sqrt(ex * ex + ey * ey); if (len > 1) { ex /= len; ey /= len; }
        if (q.cd > 0) q.cd--;
        if (q.lt < 99) q.lt++;
        if (q.ag) {                                                                      // agarrado: aguanta hasta AG_MAX (puesto: SEAT_MAX), A o el stick hacia afuera lo sueltan
          an = anclaAt(q.ag, k); q.ag2 = Math.min(127, q.ag2 + 1);
          var mx0 = q.ag === 5 ? SEAT_MAX : AG_MAX, fuera0 = false;
          if (an && len > 0.4) { dx = an.x - q.x; dy = an.y - q.y; d = Math.sqrt(dx * dx + dy * dy) || 1; fuera0 = (ex * dx + ey * dy) / d < -0.3; }
          if (!an || q.ag2 >= mx0) soltar(q, true);
          else if (fuera0 || tapN > 0 || q.stun > 0) soltar(q, false);
        } else if (q.ag2 > 0) q.ag2--;
        if (q.stun > 0) { q.stun--; q.vx *= FRIC; q.vy *= FRIC; }
        else if (q.ag) { q.vx = 0; q.vy = 0; }
        else {
          var sl = q.wind > 0 ? WIND_SLOW : 1;
          q.vx += (ex * SPD * sl - q.vx) * ACC; q.vy += (ey * SPD * sl - q.vy) * ACC;
          if (len > 0.2 && q.wind === 0) q.face = faceOf(ex, ey);
          if (len > 0.5 && q.wind === 0 && q.ag2 === 0) {                                // empujar CONTRA un tubo o el puesto libre = agarrarse
            for (var a = 1; a <= 5; a++) {
              an = anclaAt(a, k); if (!an || ocupada(a, i2)) continue;
              dx = an.x - q.x; dy = an.y - q.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
              if (d < GRAB_D && (ex * dx + ey * dy) / d > 0.5) { q.ag = a; q.ag2 = 0; q.vx = 0; q.vy = 0; break; }
            }
          }
          if (!q.ag && len > 0.5 && frenoLibre(k) && Math.abs(q.y - FH / 2) < 24) {       // caminar contra la palanca de un extremo = jalar el freno
            if (q.x < RP + 11 && ex < -0.5) { st.frK = k + 1; st.frP = (i2 + 1) | 8; }
            else if (q.x > FW - RP - 11 && ex > 0.5) { st.frK = k + 1; st.frP = i2 + 1; }
          }
        }
        if (q.wind > 0) { q.wind--; if (q.wind === 0) fire.push(i2); }
        else if (tapN > 0 && q.cd === 0 && q.stun === 0) q.wind = WIND;
      }
      /* 2) empujones que salen este tick: todos con las posiciones de AHORA (simultáneos; si dos se pegan a la vez, salen los dos) */
      var imp = [];
      for (oi = 0; oi < fire.length; oi++) {
        i2 = fire[oi]; q = P[i2];
        var near = -1, nd = 1e9, hit = 0;
        for (j = 0; j < n; j++) {
          if (j === i2 || P[j].sc) continue;
          dx = P[j].x - q.x; dy = P[j].y - q.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < nd) { nd = d; near = j; }
          if (d < R_HIT) { if (d < 0.01) { dx = faceVec(q.face).x; dy = faceVec(q.face).y; d = 1; } imp.push({ j: j, nx: dx / d, ny: dy / d, from: i2 }); hit++; }
        }
        var lv0 = near >= 0 && nd < 110 ? { x: (P[near].x - q.x) / (nd || 1), y: (P[near].y - q.y) / (nd || 1) } : faceVec(q.face);
        q.vx += lv0.x * LUNGE; q.vy += lv0.y * LUNGE; q.face = faceOf(lv0.x, lv0.y); q.cd = FASE_CD[fs];
        if (hit) st.golpes = (st.golpes + 1) % 1000;
      }
      for (oi = 0; oi < imp.length; oi++) {
        var m = imp[oi], fm = SHOVE_V * FASE_SHOVE[fs]; q = P[m.j];
        if (q.ag) { fm *= 0.4; soltar(q, false); }                                        // agarrado: aguanta lo peor, pero se suelta
        q.vx += m.nx * fm; q.vy += m.ny * fm; q.stun = STUN_HIT; q.wind = 0; q.lh = m.from + 1; q.lt = 0;
      }
      /* 3) peligros: frenazo (Nv2+), freno de emergencia, vendedor (Nv3), músico; a los agarrados no los mueven */
      var fz = frzAt(k);
      if (fz && fz.d === FRZ_WARN) for (j = 0; j < n; j++) if (!P[j].sc && !P[j].ag) { P[j].vx += fz.sgn * FRZ_V; P[j].stun = Math.max(P[j].stun, FRZ_STUN); }
      var bk = brakeAt(k);
      if (bk && bk.d === FRB_WARN) for (j = 0; j < n; j++) if (!P[j].sc && !P[j].ag && j !== bk.p) { P[j].vx += bk.sgn * FRZ_V; P[j].stun = Math.max(P[j].stun, FRZ_STUN); if (bk.p >= 0) { P[j].lh = bk.p + 1; P[j].lt = 0; } }
      var sv = sellerAt(k);
      if (sv) for (j = 0; j < n; j++) {
        q = P[j]; if (q.sc) continue;
        dx = q.x - sv.x; dy = q.y - sv.y; d = Math.sqrt(dx * dx + dy * dy);
        var Rr = RP + SELL_R;
        if (d < Rr) {
          if (q.ag) soltar(q, false);
          var sg = dy > 0.5 ? 1 : dy < -0.5 ? -1 : (j % 2 ? 1 : -1);
          q.vy = sg * Math.max(Math.abs(q.vy), SELL_PUSH); q.vx += sv.dir * 1.5; q.stun = Math.max(q.stun, 6);
          if (d < 0.01) { dx = 0; dy = sg; d = 1; }
          q.x += dx / d * (Rr - d) * 0.5; q.y += dy / d * (Rr - d) * 0.5;
        }
      }
      var mu = musAt(k);
      if (mu && mu.beat) for (j = 0; j < n; j++) {
        q = P[j]; if (q.sc || q.ag) continue;
        dx = q.x - mu.x; dy = q.y - mu.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < MUS_R) { if (d < 0.01) { dx = 0; dy = j % 2 ? 1 : -1; d = 1; } q.vx += dx / d * MUS_V; q.vy += dy / d * MUS_V; q.stun = Math.max(q.stun, MUS_STUN); }
      }
      /* marea: con la puerta abierta la gente que se baja arrastra hacia ese lado (más fuerte el primer segundo y en cada fase) y hacia el hueco abierto más cercano */
      if (openSide >= 0) for (j = 0; j < n; j++) { q = P[j]; if (q.sc || q.ag) continue; var mf = marea(ds, q.x, q.y, k); q.vx += mf.x; q.vy += mf.y; }
      /* 4) integrar (con tope de velocidad; el umbral de una puerta abierta frena lo que va pa' fuera: te tambaleas) */
      var oy = [];
      for (j = 0; j < n; j++) {
        q = P[j]; oy[j] = q.y; if (q.sc) continue;
        var sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy); if (sp > VMAX) { q.vx *= VMAX / sp; q.vy *= VMAX / sp; }
        if (q.stun > 0 && openSide === 0 && q.y < RP && q.vy < 0 && gapOf(q.x, ds.mask) >= 0) q.vy *= DOOR_DAMP;          // solo el empujado se tambalea; la marea sí te saca
        if (q.stun > 0 && openSide === 1 && q.y > FH - RP && q.vy > 0 && gapOf(q.x, ds.mask) >= 0) q.vy *= DOOR_DAMP;
        q.x += q.vx; q.y += q.vy;
      }
      /* 5) choques entre cuerpos: se separan y se pasan el golpe (dominó); el agarrado es una pared */
      for (var pass = 0; pass < 2; pass++) for (oi = 0; oi < n; oi++) for (var oj = oi + 1; oj < n; oj++) {
        i2 = ord[oi]; j = ord[oj];
        var A = P[i2], Bq = P[j]; if (A.sc || Bq.sc) continue;
        dx = Bq.x - A.x; dy = Bq.y - A.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d >= RP * 2) continue;
        if (d < 0.01) { dx = (j - i2) || 1; dy = 0.5; d = Math.sqrt(dx * dx + dy * dy); }
        var nx = dx / d, ny = dy / d, push = (RP * 2 - d) / 2;
        if (A.ag && Bq.ag) continue;
        if (A.ag || Bq.ag) { choca(A.ag ? Bq : A, A.ag ? A.x : Bq.x, A.ag ? A.y : Bq.y, RP, false); continue; }
        A.x -= nx * push; A.y -= ny * push; Bq.x += nx * push; Bq.y += ny * push;
        if (pass === 0) {
          var rel = (Bq.vx - A.vx) * nx + (Bq.vy - A.vy) * ny;
          if (rel < 0) {
            var J = -(1 + 0.5) * rel / 2;
            A.vx -= J * nx; A.vy -= J * ny; Bq.vx += J * nx; Bq.vy += J * ny;
            if (J > CHAIN_MIN) {
              var giver = (A.vx * nx + A.vy * ny) > -(Bq.vx * nx + Bq.vy * ny) ? A : Bq, recv = giver === A ? Bq : A;
              recv.stun = Math.max(recv.stun, CHAIN_STUN);
              if (giver.lt < 15 && giver.lh > 0 && giver.lh - 1 !== (recv === A ? i2 : j)) { recv.lh = giver.lh; recv.lt = giver.lt; }
            }
          }
        }
      }
      /* 5b) la gente y el vagón: pasajeros (los que caminan arrastran), músico, el dormido atravesado, los tubos */
      var cs = cuerpos(k), zq = zzAt(k);
      for (j = 0; j < n; j++) {
        q = P[j]; if (q.sc) continue;
        for (oi = 0; oi < cs.length; oi++) { var cb = cs[oi]; if (q.ag && !cb.mov) continue; choca(q, cb.x, cb.y, cb.r, cb.mov > 0, cb.dx, cb.dy); }
        if (zq && zq.ph === 1 && !q.ag) choca(q, cl(q.x, zq.x - ZZ_L, zq.x + ZZ_L), FH / 2, ZZ_R, false);
        if (!q.ag) for (oi = 0; oi < POLES.length; oi++) choca(q, POLES[oi][0], POLES[oi][1], POLE_R, false);
        if (q.ag) {                                                                      // pegado a su ancla
          an = anclaAt(q.ag, k);
          if (an && q.ag === 5) { q.x = an.x; q.y = an.sd === 0 ? RP : FH - RP; }
          else if (an) { dx = q.x - an.x; dy = q.y - an.y; d = Math.sqrt(dx * dx + dy * dy) || 1; q.x = an.x + dx / d * (RP + POLE_R + 1); q.y = an.y + dy / d * (RP + POLE_R + 1); }
          q.vx = 0; q.vy = 0;
        }
      }
      /* 6) paredes, puertas (solo las abiertas: mask) y andén */
      for (j = 0; j < n; j++) {
        q = P[j]; if (q.sc) continue;
        if (q.x < RP) { q.x = RP; q.vx = -q.vx * REST; } else if (q.x > FW - RP) { q.x = FW - RP; q.vx = -q.vx * REST; }
        var dc = gapOf(q.x, ds.mask), cx0 = puertaIdx(q.x), cerca0 = enMask(ds.mask, cx0) && ds.mask > 0;
        if (q.y < RP) {
          if (openSide === 0 && (dc >= 0 || (oy[j] < RP - 0.5 && cerca0))) {               // entra por el hueco; quien ya estaba en el umbral choca con el marco
            if (dc < 0) { q.x = cl(q.x, DOORS[cx0] - GAP, DOORS[cx0] + GAP); q.vx = 0; }
            if (q.y < -OUT_D) { eject(j, 0); continue; }
          } else { q.y = RP; q.vy = q.vy < 0 ? -q.vy * REST : q.vy; }
        } else if (q.y > FH - RP) {
          if (openSide === 1 && (dc >= 0 || (oy[j] > FH - RP + 0.5 && cerca0))) {
            if (dc < 0) { q.x = cl(q.x, DOORS[cx0] - GAP, DOORS[cx0] + GAP); q.vx = 0; }
            if (q.y > FH + OUT_D) { eject(j, 1); continue; }
          } else { q.y = FH - RP; q.vy = q.vy > 0 ? -q.vy * REST : q.vy; }
        }
      }
      for (j = 0; j < n; j++) { q = P[j]; if (q.sc) continue; q.x = q4(q.x); q.y = q4(q.y); q.vx = q64(q.vx); q.vy = q64(q.vy); }
      st.k++;
    }

    /* ───────────────────────── snapshot ───────────────────────── */
    function pack() {
      var a = [st.k, st.golpes, st.kr, st.frK, st.frP], j, q;
      for (j = 0; j < MAXP; j++) {
        q = st.p[j];
        a.push(Math.round(q.x * 4), Math.round(q.y * 4), Math.round(q.vx * 64), Math.round(q.vy * 64), q.stun | (q.wind << 5) | (q.cd << 10), q.face | (q.lh << 4) | (q.ag << 7) | (q.ag2 << 10), q.sc, q.lt | (q.ko << 7));
      }
      return a;
    }
    function load(a) {
      if (!a || a.length < PACKN) return;
      var j, o, q;
      st.k = a[0] | 0; st.golpes = a[1] | 0; st.kr = a[2] | 0; st.frK = a[3] | 0; st.frP = a[4] | 0;
      for (j = 0; j < MAXP; j++) {
        o = G + PS * j; q = st.p[j];
        q.x = a[o] / 4; q.y = a[o + 1] / 4; q.vx = a[o + 2] / 64; q.vy = a[o + 3] / 64;
        q.stun = a[o + 4] & 31; q.wind = (a[o + 4] >> 5) & 31; q.cd = (a[o + 4] >> 10) & 63;
        q.face = a[o + 5] & 15; q.lh = (a[o + 5] >> 4) & 7; q.ag = (a[o + 5] >> 7) & 7; q.ag2 = (a[o + 5] >> 10) & 127; q.sc = a[o + 6] | 0; q.lt = a[o + 7] & 127; q.ko = (a[o + 7] >> 7) & 3;
      }
    }
    function lerp(a, b, u) {
      var out = b.slice(), j, ix;
      for (j = 0; j < POSIDX.length; j++) {
        ix = POSIDX[j];
        var sco = G + PS * (j >> 1) + 6;                                          // no se interpola a quien acaba de salir al andén (salto)
        if (a[sco] !== b[sco]) continue;
        if (Math.abs(b[ix] - a[ix]) < 800) out[ix] = Math.round(a[ix] + (b[ix] - a[ix]) * u);
      }
      return out;
    }

    /* ───────────────────────── vista de los que no son el juez ───────────────────────── */
    /* Retraso de la vista V (M3 §1.1: edad del snapshot que se dibuja): c.lag() si el runtime lo da; si no, la MEDIANA de los últimos 3 s de (ahora − k/30)
       medida cuadro a cuadro (la mediana aguanta las paradas de 2-3 s del carril con pérdida sin inflarse). */
    var vHist = [], lagEst = -1, lagNow = 0, mp = null, mh = [];
    function isJudge() { return c.juez(); }
    function lagVista() {
      if (typeof c.lag === 'function') { var l0 = +c.lag(); if (l0 >= 0) return cl(l0, 0, LAG_MAX); }
      var now = c.ahora();
      if (now >= 0 && st.kr > 0) { vHist.push(cl(now - st.kr / TK, 0, 3)); if (vHist.length > 90) vHist.shift(); }
      if (vHist.length < 5) return 0;
      if (vHist.length % 5 === 0 || lagEst < 0) { var a = vHist.slice().sort(function (x, y) { return x - y; }); lagEst = a[a.length >> 1]; }
      return cl(lagEst, 0, LAG_MAX);
    }
    function kVista() { return isJudge() ? st.k : st.k + Math.round(lagNow * TK); }
    function clampDentro(o) { o.x = cl(o.x, RP, FW - RP); o.y = cl(o.y, RP, FH - RP); }
    /* adelanta el cuerpo `q` t ticks: aturdido ⇒ rueda con fricción y rebota; caminando ⇒ sigue recto (máx 8 ticks) */
    function adelanta(q, t) {
      var o = { x: q.x, y: q.y, vx: q.vx, vy: q.vy };
      if (q.stun > 0) { while (t-- > 0) { o.x += o.vx; o.y += o.vy; o.vx *= FRIC; o.vy *= FRIC; if (o.x < RP || o.x > FW - RP) o.vx = -o.vx * REST; if (o.y < RP || o.y > FH - RP) o.vy = -o.vy * REST; clampDentro(o); } }
      else { var tt = Math.min(t, 8); o.x += o.vx * tt; o.y += o.vy * tt; clampDentro(o); }
      return o;
    }
    function predict(dt) {
      if (isJudge()) return;
      lagNow = lagVista();
      var t = Math.round(lagNow * TK), j, q;
      if (t > 0) for (j = 0; j < n; j++) { if (j === c.yo) continue; q = st.p[j]; if (q.sc) continue; var o = adelanta(q, t); q.x = o.x; q.y = o.y; }
      if (c.yo < 0 || c.yo >= n) return;
      predPropio(dt, t, st.k / TK);
    }
    /* cuerpo propio predicho. t = ticks que va atrasado el cuerpo autoritativo (para seguirlo cuando te empujan); tk = hora (s) de la historia propia que corresponde al
       snapshot: en un no-juez, la del snapshot (M3 §4); en el juez con entrada retrasada, ahora − fjT (su cuerpo va fjT atrás de su stick). */
    function predPropio(dt, t, tk) {
      var j, a = st.p[c.yo];
      if (!mp || a.sc) { mp = { x: a.x, y: a.y, vx: a.vx, vy: a.vy }; mh = []; return; }
      var now = c.ahora(), f = Math.min(3, dt * TK);
      if (a.stun > 0 || a.ag) {                                                    // empujado o agarrado: manda el juez (adelantado lo que va la vista)
        var ta = adelanta(a, t), u = Math.min(1, dt * 14);
        mp.x += (ta.x - mp.x) * u; mp.y += (ta.y - mp.y) * u; mp.vx = ta.vx; mp.vy = ta.vy;
      } else {
        var e = c.eje(c.yo) || { x: 0, y: 0 }, ax = +e.x || 0, ay = +e.y || 0, len = Math.sqrt(ax * ax + ay * ay); if (len > 1) { ax /= len; ay /= len; }
        var sl = (a.wind > 0 || charge > 0) ? WIND_SLOW : 1, kk = 1 - Math.pow(1 - ACC, f);
        var kv0 = kVista(), dd = doorAt(kv0), mf = marea(dd, mp.x, mp.y, kv0);
        mp.vx += (ax * SPD * sl - mp.vx) * kk + mf.x * f; mp.vy += (ay * SPD * sl - mp.vy) * kk + mf.y * f;
        mp.x += mp.vx * f; mp.y += mp.vy * f;
        var cs0 = cuerpos(kv0), zq0 = zzAt(kv0), ob0;                               // la gente y los tubos también estorban en la predicción (son función del tick)
        for (j = 0; j < cs0.length; j++) { ob0 = cs0[j]; choca(mp, ob0.x, ob0.y, ob0.r, false); }
        if (zq0 && zq0.ph === 1) choca(mp, cl(mp.x, zq0.x - ZZ_L, zq0.x + ZZ_L), FH / 2, ZZ_R, false);
        for (j = 0; j < POLES.length; j++) choca(mp, POLES[j][0], POLES[j][1], POLE_R, false);
        var dc = gapOf(mp.x, dd.mask);
        mp.x = cl(mp.x, RP, FW - RP);
        mp.y = cl(mp.y, dd.ph === 2 && dd.side === 0 && dc >= 0 ? 2 : RP, dd.ph === 2 && dd.side === 1 && dc >= 0 ? FH - 2 : FH - RP);
      }
      /* reconciliar contra la historia propia en el MISMO tick del snapshot (M3 §4): el snapshot es de hace `lag`, no de ahora */
      mh.push({ t: now, x: mp.x, y: mp.y }); while (mh.length && mh[0].t < now - 4) mh.shift();
      var h = null;
      for (j = mh.length - 1; j >= 0; j--) if (mh[j].t <= tk) { h = mh[j]; break; }
      if (!h) h = mh[0];
      var dx = a.x - h.x, dy = a.y - h.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 90) { var s0 = adelanta(a, t); mp.x = s0.x; mp.y = s0.y; mp.vx = a.vx; mp.vy = a.vy; mh = []; }
      else if (d > 18) { var mv = Math.min(3, d - 18) / d; mp.x += dx * mv; mp.y += dy * mv; for (j = 0; j < mh.length; j++) { mh[j].x += dx * mv; mh[j].y += dy * mv; } }
    }
    function predJuez() { return isJudge() && !c.practica && (fjT > 0 || ownBuf.length > 1); }
    function posOf(pp) { if (pp === c.yo && mp && st.p[pp].sc === 0 && (!isJudge() || predJuez())) return mp; return st.p[pp]; }

    /* ───────────────────────── presentación ───────────────────────── */
    var at = 0, charge = 0, prevA = 0, banner = null, bannerT = 0, shake = 0, fx = [], prevSc = [0, 0, 0, 0], prevStun = [0, 0, 0, 0], prevPh = -1, prevFz = -1, prevSell = false, prevGolpes = 0, prevWin = false, drift = 0;
    var pe = { fase: -1, mus: false, musB: -1, zz: -1, br: 0, brH: 0, ap: -1, loca: -1, jam: -1, seat: -1, ola: -1, tap: -1 };   // eventos del escenario ya anunciados (solo presentación)
    function banr(s, col, t) { banner = { s: s, col: col }; bannerT = t || 1.6; }
    function lay() {
      var f = c.campo();
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width, y0: f.y0, y1: f.y1 };
      var vw = f.x1 - f.x0, z = cl(vw / (FW + 70), 0.45, 1.2), e = z < 1 ? Math.min(1.35, Math.pow(z, -0.4)) : 1;
      return { f: f, z: z, e: e, cx: (f.x0 + f.x1) / 2, cy: z < 0.8 ? 330 : 350 };
    }
    function scr(l, x, y) { return { x: l.cx + (x - FW / 2) * l.z, y: l.cy + (y - FH / 2) * l.z }; }
    function colorDe(pp) { var s = asiento(pp); return s.color || SEATCOL[pp % 4]; }
    function update(dt) {
      V3S = v3 ? V3 : null;
      at += dt; bannerT = Math.max(0, bannerT - dt); shake = Math.max(0, shake - dt * 3); charge = Math.max(0, charge - dt);
      if (predJuez() && c.yo >= 0 && c.yo < n) predPropio(dt, fjT, st.k / TK - fjT / TK);
      else if (isJudge()) mp = null;
      if (!isJudge() && !c.practica && c.yo >= 0 && c.ahora() - xlagAt >= 1 && (lagEst >= 0 || typeof c.lag === 'function') && typeof c.send === 'function') { xlagAt = c.ahora(); c.send('xlag', Math.round(cl(lagEst, 0, LAG_MAX) * 1000), true); }
      var L = lay(), kv = kVista(), ds = doorAt(kv), j;
      if (ds.ph === 0 && ds.side >= 0) drift += dt * (ds.tTo < 40 ? 60 : 420); else if (ds.ph === 0) drift += dt * 420;
      if (c.yo >= 0 && c.yo < n && !st.p[c.yo].sc) {                            // carga local inmediata al pulsar A (la respuesta del juez llega después)
        var ha = c.held(c.yo, 'a') ? 1 : 0, q0 = st.p[c.yo];
        if (ha && !prevA && q0.cd === 0 && q0.stun === 0 && q0.wind === 0 && charge <= 0) { charge = WIND / TK; SON('tic', 160, 0.12, 'sawtooth', 0.04, 120); }
        prevA = ha;
      }
      if (ds.ph !== prevPh) {
        if (ds.ph === 1) { banr(ds.side === 0 ? '¡SE ABREN ARRIBA!' : '¡SE ABREN ABAJO!', '#ffd23f', 1.2); SON('ding', 660, 0.12, 'square', 0.05, 0); if (!V3S) SND(520, 0.18, 'square', 0.05, 0); }
        else if (ds.ph === 2) { banr('¡DÉJENNOS SALIR!', '#fffdf2', 1.2); SON('whoosh', 240, 0.25, 'triangle', 0.06, -80); }
        else if (prevPh === 2) { SON('golpe', 300, 0.2, 'square', 0.05, -120); if (v3) v3.esc.sacudir(.3); }
        prevPh = ds.ph;
      }
      var fz = frzAt(kv), fzId = fz ? fz.j : -1;
      if (fzId !== prevFz && fz) { banr('¡FRENAZO!', '#ff5c5c', 1.3); SON('chispa', 140, 0.5, 'sawtooth', 0.07, -60); if (V3S) V3S.sfx('bocina'); }
      if (fz && fz.d === FRZ_WARN) shake = 1;
      prevFz = fzId;
      var sv = sellerAt(kv);
      if (sv && !prevSell) { var sp0 = sobre3(cl(sv.x, 60, FW - 60), v3 ? FH / 2 : -20, 4.8); S('Señores pasajeros, disculpen que los moleste…', sp0.x, sp0.y, '#fffdf2'); if (V3S) V3S.sfx('pop'); }
      prevSell = !!sv;
      eventos(kv, ds);
      if (st.golpes !== prevGolpes) { SON('golpe', 110, 0.12, 'square', 0.08, -40); if (v3) v3.esc.sacudir(.4); shake = Math.max(shake, 0.5); prevGolpes = st.golpes; }
      for (j = 0; j < n; j++) {
        var q = st.p[j], ps = posOf(j);
        if (q.stun >= STUN_HIT - 2 && prevStun[j] < q.stun && q.lt < 4) { var hp = scr(L, ps.x, ps.y); fx.push({ x: ps.x, y: ps.y, t: 0, k: 'pum' }); if (v3) golpe3D(j, ps, j === c.yo); else SPAWN(hp.x, hp.y - 20, 6, 'bit', ['#ffd23f', '#fffdf2'], 200, 300, 0.5); }
        prevStun[j] = q.stun;
        if (q.sc && !prevSc[j]) {
          var ep = sobre3(q.x, q.y, 2.5), dsx = doorAt(q.sc - 1);
          banr('¡' + String(asiento(j).name).toUpperCase() + ' SE QUEDÓ EN ' + estacion(dsx.idx) + '!', '#ff8a5c', 2.0);
          if (v3) { V3S.sfx('caida'); if (j === c.yo) V3S.sfx('error'); v3.esc.sacudir(j === c.yo ? 1 : .5); v3.part.soltar(WX(q.x), 1.5, (q.y < 0 ? -1 : 1) * ZIN, 24, { k: 'confeti', cols: ['#ffd23f', '#ff5c8a', '#fffdf2'], vel: 4, arriba: 5, g: 9, vida: 1 }); }
          else { SND(520, 0.35, 'triangle', 0.08, -380); SPAWN(ep.x, ep.y, 14, 'conf', ['#ffd23f', '#ff5c8a', '#fffdf2'], 260, 500, 0.8); }
          if (j === c.yo) S('¡Me dejó el Metro!', ep.x, ep.y - 40, '#fffdf2');
          if (v3) { var o2; for (o2 = 0; o2 < n; o2++) if (!st.p[o2].sc) v3.pjs[o2].happy = 1.3; if (q.lh > 0 && q.lt <= CREDIT_T && q.lh - 1 !== j && !st.p[q.lh - 1].sc) v3.pjs[q.lh - 1].pj.uno('festejo'); v3.CR.flinch(WX(q.x), WZ(q.y < FH / 2 ? 0 : FH), 6, 1); }
        }
        prevSc[j] = q.sc;
      }
      if (vivos() === 1 && n > 1 && !prevWin) { prevWin = true; banr('¡ÚLTIMO EN EL VAGÓN!', '#ffd23f', 3); SON('aplauso', 880, 0.3, 'square', 0.06, 200); }
      for (j = fx.length - 1; j >= 0; j--) { fx[j].t += dt; if (fx[j].t > 0.45) fx.splice(j, 1); }
    }

    /* anuncios del escenario (solo presentación: cartel, voz y sonido; todo sale del calendario sembrado, así que en todas las pantallas sale igual) */
    function eventos(kv, ds) {
      var fk = faseK(kv), mu = musAt(kv), zq = zzAt(kv), bk = brakeAt(kv), ap = apagonAt(kv), se = seatAt(kv), sp;
      if (fk !== pe.fase) { if (fk > 0 && FASE_TXT[fk]) { banr(FASE_TXT[fk][0], FASE_TXT[fk][2], 2.2); SON('ding', 520, 0.2, 'square', 0.06, 200); if (v3) v3.esc.sacudir(.6); } pe.fase = fk; }
      if (mu && !pe.mus) { banr('¡LLEGÓ EL MÚSICO! ¡LA TAMBORA EMPUJA!', '#ffb43a', 1.8); sp = sobre3(mu.x, FH / 2, 4.6); S('¡Con ustedes… la música!', sp.x, sp.y, '#fffdf2'); }
      pe.mus = !!mu;
      if (mu && mu.toca) { var mb = Math.floor((kv - musPlay) / MUS_BEAT); if (mb !== pe.musB) { pe.musB = mb; if (mb > 0) { SON('golpe', 90, 0.16, 'square', 0.09, -30); if (v3) { v3.esc.sacudir(.25); v3.CR.flinch(WX(mu.x), WZ(mu.y), MUS_R * ESX * 1.3, .8); v3.part.soltar(WX(mu.x), 1.5, WZ(mu.y), 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 4, arriba: 2, g: 6, vida: .35 }); } } } }
      var zph = zq ? zq.ph : -1;
      if (zph !== pe.zz) {
        if (zph === 0) { banr('¡UN SEÑOR SE DURMIÓ EN EL PASILLO!', '#9ad0ff', 1.8); sp = sobre3(zq.x, zq.y, 3.6); S('zzz…', sp.x, sp.y, '#fffdf2'); }
        else if (zph === 2) { banr('¡AY, MI PARADA!', '#ffb43a', 1.6); sp = sobre3(zq.x, zq.y, 4); S('¡AY, MI PARADA!', sp.x, sp.y, '#fffdf2'); SON('whoosh', 300, 0.2, 'triangle', 0.05, 100); }
        pe.zz = zph;
      }
      if (bk && bk.d < FRB_WARN && pe.br !== st.frK) { pe.br = st.frK; banr('¡FRENO DE EMERGENCIA!' + (bk.p >= 0 ? ' ' + String(asiento(bk.p).name).toUpperCase() + ' LO JALÓ' : ''), '#ff5c5c', 1.4); SON('chispa', 140, 0.5, 'sawtooth', 0.07, -60); }
      if (bk && bk.d >= FRB_WARN && pe.brH !== st.frK) { pe.brH = st.frK; shake = 1; if (v3) { v3.esc.sacudir(1); v3.sw.v += bk.sgn * 7; } SON('choque', 110, 0.3, 'square', 0.08, -60); }
      if (olaOn(ds) && ds.el >= OLA_T0 - 8 && pe.ola !== ds.idx) { pe.ola = ds.idx; banr('¡LLEGA LA OLEADA! ¡AGÁRRATE!', '#ff8a5c', 1.7); sp = sobre3(FW / 2, v3 ? FH / 2 : FH / 2, 5); S('¡¡PERMISO, PERMISO!!', sp.x, sp.y, '#fffdf2'); SON('whoosh', 200, 0.4, 'triangle', 0.07, 120); if (v3) { v3.esc.sacudir(.5); V3.sfx('viento'); } }
      if (ds.ph === 2 && stations[ds.idx] && stations[ds.idx].tap.length && ds.el >= TAP_IN + 8 && pe.tap !== ds.idx) { pe.tap = ds.idx; banr('¡UN SEÑOR TAPA LA PUERTA!', '#ffb43a', 1.5); SON('golpe', 140, 0.2, 'square', 0.06, -60); }
      if (ap && ap.j !== pe.ap) { banr('¡SE VA LA LUZ!', '#bfe0ff', 1.8); pe.ap = ap.j; } else if (!ap) pe.ap = -1;
      if (ds.ph === 2 && ds.ext && pe.loca !== ds.idx) { pe.loca = ds.idx; banr('¡UNA PUERTA NO CIERRA!', '#ff3b4e', 1.6); }
      if (ds.ph === 1 && ds.jam >= 0 && pe.jam !== ds.idx) { pe.jam = ds.idx; sp = sobre3(DOORS[ds.jam], ds.side === 0 ? 0 : FH, 4.8); S('¡TRABADA!', sp.x, sp.y, '#ff9a3c'); }
      if (se && pe.seat !== se.i) { pe.seat = se.i; sp = sobre3(se.x, se.sd === 0 ? 0 : FH, 3.4); S('¡PUESTO LIBRE!', sp.x, sp.y, '#ffd23f'); }
    }

    /* ───────────────────────── CPU ───────────────────────── */
    // Decide cada 0,32 − 0,16·skill s. Conoce el calendario de puertas (sale de la semilla). Con la puerta avisando/abierta (o a < 2,5 s): busca al rival más
    // cercano, se pone DETRÁS de él (del lado contrario a la puerta) y empuja cuando está alineado; si ella misma está en el umbral, primero se aleja.
    // Puertas cerradas: vuelve al centro del pasillo, separada de los demás, y a veces empuja hacia el lado que se abrirá.
    function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
    function ai(pp, dt, api) {
      var S0 = cpr[pp], q = st.p[pp], me = posOf(pp), sk = (c.skill && typeof c.skill[pp] === 'number') ? c.skill[pp] : 0.6, j;
      S0.t += dt;
      api.hold('a', false);
      if (q.sc || q.stun > 0) { api.eje(0, 0); return; }
      var ds = doorAt(kVista()), sd = ds.side, urg = ds.ph > 0 || ds.tTo < 75;
      if (S0.t >= S0.next) {
        S0.next = S0.t + (0.32 - 0.16 * sk) + S0.r.next() * 0.06;
        var tg = -1, best = 1e9;
        for (j = 0; j < n; j++) {
          if (j === pp || !vivoP(j)) continue;
          var o = st.p[j], dj = dist(o.x, o.y, me.x, me.y), wall = sd === 0 ? o.y : sd === 1 ? FH - o.y : FH / 2;
          var score = urg ? dj * 0.6 + wall * (0.5 + 0.7 * sk) + (gapOf(o.x) >= 0 ? 0 : 25) - (wall < RP + 4 && gapOf(o.x) >= 0 ? 120 * sk : 0) : dj;   // con puerta: el que está más cerca del hueco (y rematar al que se tambalea)
          if (score < best) { best = score; tg = j; }
        }
        S0.tg = tg; S0.mode = 0;
        var myWall = sd === 0 ? me.y : sd === 1 ? FH - me.y : FH, th = -1;
        for (j = 0; j < n; j++) if (j !== pp && vivoP(j) && st.p[j].wind > 2 && dist(st.p[j].x, st.p[j].y, me.x, me.y) < R_HIT + 12) th = j;
        if (th >= 0 && urg && S0.r.next() < 0.5 * sk) {                                       // alguien carga a mi lado: me quito (hacia el lado seguro)
          var tq = st.p[th], fx0 = me.x - tq.x, fy0 = me.y - tq.y, fl = Math.sqrt(fx0 * fx0 + fy0 * fy0) || 1;
          S0.tx = cl(me.x + fx0 / fl * 50, RP, FW - RP); S0.ty = cl(me.y + fy0 / fl * 50, RP, FH - RP);
          if ((sd === 0 && S0.ty < me.y) || (sd === 1 && S0.ty > me.y)) S0.ty = me.y + (sd === 0 ? 30 : -30);
          S0.mode = 3; S0.tg = -1;
        } else if (urg && sd >= 0 && myWall < 30 + 40 * sk && (gapOf(me.x) >= 0 || myWall < RP + 6)) {   // estoy cerca del umbral: primero me salvo
          S0.tx = me.x; S0.ty = sd === 0 ? FH / 2 + 30 : FH / 2 - 30; S0.mode = 2;
        } else if (urg && sd >= 0 && tg >= 0) {
          var o2 = st.p[tg], dcx = puertaDe(o2.x), dcy = sd === 0 ? -30 : FH + 30;
          var gx = dcx - o2.x, gy = dcy - o2.y, gd = Math.sqrt(gx * gx + gy * gy) || 1; gx /= gd; gy /= gd;
          var err = (S0.r.next() * 2 - 1) * (26 - 20 * sk);
          S0.tx = cl(o2.x - gx * (RP * 2 + 8) + err * (-gy), RP, FW - RP); S0.ty = cl(o2.y - gy * (RP * 2 + 8) + err * gx, RP, FH - RP);
          var vx0 = me.x - o2.x, vy0 = me.y - o2.y, along = vx0 * gx + vy0 * gy, perp = vx0 * (-gy) + vy0 * gx;
          if (along > 6 && S0.r.next() < 0.6 * sk) { var sg0 = perp >= 0 ? 1 : -1; S0.tx = cl(o2.x - gx * 24 + (-gy) * sg0 * 58, RP, FW - RP); S0.ty = cl(o2.y - gy * 24 + gx * sg0 * 58, RP, FH - RP); }   // estoy del lado de la puerta: lo rodeo, no paso por delante
          var safe = 20 + 60 * sk;                                                          // la CPU buena no se mete en la zona de la puerta a buscar pelea
          if (sd === 0 && S0.ty < safe) S0.ty = safe; else if (sd === 1 && S0.ty > FH - safe) S0.ty = FH - safe;
          S0.gx = gx; S0.gy = gy; S0.mode = 1;
        } else {                                                                          // al centro, apartado de los demás y del lado que se abrirá
          var cx = SPX[pp % SPX.length] + (S0.r.next() * 2 - 1) * 40, cy = FH / 2 + (SPY[pp % SPY.length] - FH / 2) * 0.5 + (sd === 0 ? 22 : sd === 1 ? -22 : 0) + (S0.r.next() * 2 - 1) * 14;
          S0.tx = cl(cx, RP + 20, FW - RP - 20); S0.ty = cl(cy, RP + 30, FH - RP - 30); S0.mode = 0;
          if (tg >= 0 && sd >= 0) { var o3 = st.p[tg]; S0.gx = gapOf(o3.x) >= 0 ? 0 : (puertaDe(o3.x) - o3.x) / 200; S0.gy = sd === 0 ? -1 : 1; var gl = Math.sqrt(S0.gx * S0.gx + 1); S0.gx /= gl; S0.gy /= gl; }
        }
      }
      var dx = S0.tx - me.x, dy = S0.ty - me.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 4) api.eje(dx / d, dy / d); else api.eje(0, 0);
      if (S0.tg >= 0 && vivoP(S0.tg) && q.cd === 0 && q.wind === 0 && S0.t - S0.lastA > (WIND + CD) / TK) {
        var o4 = st.p[S0.tg], tdx = o4.x - me.x, tdy = o4.y - me.y, td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        var al = S0.gx === undefined ? 0 : (tdx * S0.gx + tdy * S0.gy) / td;
        var ok = false;
        if (S0.mode === 1) ok = td < R_HIT - 10 && al > 0.45 + 0.4 * sk;                   // la CPU buena solo empuja bien alineada hacia la puerta
        else if (S0.mode === 0 && sd >= 0) ok = td < R_HIT - 14 && al > 0.8 && S0.r.next() < 0.04 + 0.04 * sk;
        if (ok) { S0.lastA = S0.t; api.press('a'); }
      }
    }

    /* ───────────────────────── dibujo ───────────────────────── */
    function fondo(l) {                                                                   // en coordenadas de PANTALLA
      var f = l.f, w = f.x1 - f.x0, k;
      rr(f.x0, 0, w, 600, 0, pal.tunel, 0);
      var off = drift % 160;
      for (k = -1; k < w / 160 + 2; k++) { var x = f.x0 + k * 160 - off; rr(x, 150, 70, 6, 3, lv === 3 ? '#3a3858' : '#45435e', 0); rr(x + 30, 540, 70, 6, 3, lv === 3 ? '#3a3858' : '#45435e', 0); }
    }
    function anden(sd, ph, idx) {                                                         // andén del lado sd (coordenadas del vagón)
      var y0 = sd === 0 ? -86 : FH + 22, k;
      rr(-60, y0, FW + 120, 64, 0, pal.anden, 3);
      for (k = 0; k < 14; k++) line([[-60 + k * 52, y0], [-60 + k * 52, y0 + 64]], 1.5, pal.loseta);
      rr(-60, sd === 0 ? y0 + 52 : y0, FW + 120, 10, 0, pal.borde, 0);                       // franja amarilla de seguridad
      for (k = 0; k < 9; k++) { var gx = 20 + k * 68 + (k % 2) * 14, gy = y0 + (sd === 0 ? 22 : 38); if (Math.abs(gx - puertaDe(gx)) < 40) continue; ell(gx, gy, 11, 11, pal.gente[k % 4], 2.5); ell(gx, gy - 4, 6, 6, '#f0c8a0', 2); }
      var sy = sd === 0 ? y0 + 6 : y0 + 48;
      rr(FW / 2 - 92, sy - 10, 184, 22, 4, '#1f5fbf', 2.5); txt(estacion(idx), FW / 2, sy + 1, 13, '#fffdf2', 0, true);
      if (ph === 1) txt('…ENTRANDO', FW / 2, sy + (sd === 0 ? 24 : -22), 11, '#fffdf2', 0, true);
    }
    function vagon(ds) {
      var k, j;
      rr(-16, -16, FW + 32, FH + 32, 20, pal.casco, 4);
      rr(-16, -4, FW + 32, 8, 0, pal.franja, 0); rr(-16, FH - 4, FW + 32, 8, 0, pal.franja, 0);
      rr(0, 0, FW, FH, 6, pal.piso, 3);
      rr(0, FH / 2 - 26, FW, 52, 0, pal.pasillo, 0);
      for (k = 0; k < 12; k++) line([[k * 50 + 25, FH / 2 - 26], [k * 50 + 25, FH / 2 + 26]], 1.5, pal.piso);
      /* bancos contra las paredes entre puertas (decorado: en hora pico todo el mundo va de pie) */
      var segs = []; for (k = 0; k < DOORS.length - 1; k++) segs.push([DOORS[k] + DW / 2 + 12, DOORS[k + 1] - DW / 2 - 12]);
      for (k = 0; k < segs.length; k++) { var a = segs[k][0], b = segs[k][1]; rr(a, 4, b - a, 12, 4, pal.banco, 2.5); rr(a, FH - 16, b - a, 12, 4, pal.banco, 2.5); }
      for (k = 0; k < DOORS.length - 1; k++) ell((DOORS[k] + DOORS[k + 1]) / 2, FH / 2 + (k % 2 ? 30 : -30), 4, 4, '#e8e8f0', 2.5);   // tubos
      /* puertas: arriba (lado 0) y abajo (lado 1) */
      for (var sd = 0; sd < 2; sd++) for (k = 0; k < DOORS.length; k++) {
        var dx = DOORS[k], y = sd === 0 ? -16 : FH, open = ds.ph === 2 && ds.side === sd, warn = ds.ph === 1 && ds.side === sd;
        var o = open ? Math.min(1, (OPEN - ds.left + 1) / 6, ds.left / 6) : 0;
        if (open) rr(dx - DW / 2, y, DW, 16, 0, pal.anden, 0);
        var pw = DW / 2 * (1 - 0.92 * o);
        rr(dx - DW / 2, y + 2, pw, 12, 2, '#b8bcc8', 2.5); rr(dx + DW / 2 - pw, y + 2, pw, 12, 2, '#b8bcc8', 2.5);
        var ly = sd === 0 ? -24 : FH + 24, lit = warn ? (Math.floor(at * 8) % 2 === 0) : open;
        ell(dx, ly, 7, 5, lit ? (warn ? '#ff3b4e' : '#4fd06a') : '#5a5a6a', 2.5);
        if (warn) { var ay = sd === 0 ? -40 - Math.abs(Math.sin(at * 10)) * 4 : FH + 40 + Math.abs(Math.sin(at * 10)) * 4; poly(sd === 0 ? [[dx - 9, ay + 6], [dx + 9, ay + 6], [dx, ay - 6]] : [[dx - 9, ay - 6], [dx + 9, ay - 6], [dx, ay + 6]], '#ffd23f', 2.5); }
      }
    }
    function vendedor(sv) {
      if (!sv) return;
      var x = sv.x, y = sv.y, b = Math.sin(at * 9) * 2;
      ell(x, y + 6, SELL_R + 2, 10, INK, 0);
      ell(x, y + b, SELL_R, SELL_R - 4, '#3fa06a', 3);
      ell(x, y - 18 + b, 11, 11, '#e0a878', 3); rr(x - 12, y - 30 + b, 24, 7, 3, '#d93a3a', 2.5);
      rr(x + sv.dir * 14 - 12, y - 6 + b, 24, 16, 3, '#ffd23f', 2.5); ell(x + sv.dir * 14 - 5, y + 2 + b, 3, 3, '#ff5c8a', 0); ell(x + sv.dir * 14 + 5, y + 2 + b, 3, 3, '#5cb8ff', 0);
      txt('¡CARAMELOS!', x, y - 46, 10, '#fffdf2', 0, true);
    }
    function persona(pp, l, ds) {
      var q = st.p[pp], ps = posOf(pp), s = asiento(pp), col = colorDe(pp), x = 0, y = 0, e = l.e;
      var mine = pp === c.yo, carga = q.wind > 0 ? (WIND - q.wind) / WIND : (mine && charge > 0 ? 1 - charge / (WIND / TK) : -1);
      var umbral = ds.ph === 2 && gapOf(ps.x) >= 0 && ((ds.side === 0 && ps.y < RP + 4) || (ds.side === 1 && ps.y > FH - RP - 4));
      var wob = umbral ? Math.sin(at * 26) * 0.25 : q.stun > 0 ? Math.sin(at * 30) * 0.12 : 0;
      ctx.save(); ctx.translate(ps.x, ps.y); ctx.scale(e, e);
      ell(x, y + 4, RP + 3, 9, INK, 0);
      ell(x, y + 2, RP + 1, 8, col, 3);
      if (carga >= 0) { var rr0 = R_HIT * (1 - carga * 0.55); ctx.save(); ctx.globalAlpha = 0.35 + 0.4 * carga; ell(x, y + 2, rr0 / e, rr0 * 0.55 / e, '#fffdf2', 0); ctx.restore(); ell(x, y + 3, RP + 2 + 3 * Math.sin(at * 30), 7, '#ffd23f', 2.5); }
      ctx.save(); ctx.rotate(wob);                                                  // el busto termina en los pies (y): se lee dónde está parado
      var lean = carga >= 0 ? -6 * carga : 0, fv = faceVec(q.face);
      c.util.pj(s.ch, x + fv.x * lean, y - 66 + Math.abs(lean) * 0.5, 40, { animo: q.sc ? 'perder' : (vivos() === 1 && n > 1 ? 'celebrar' : null), sombra: false });
      if (umbral) { line([[x - 12, y - 40], [x - 30, y - 62 - Math.sin(at * 20) * 6]], 5, '#f0c8a0'); line([[x + 12, y - 40], [x + 30, y - 62 + Math.sin(at * 20) * 6]], 5, '#f0c8a0'); txt('¡AY, AY!', x, y - 112, 11, '#fffdf2', 0, true); }
      ctx.restore();
      if (carga >= 0) txt('!', x, y - 118, 22, '#ffd23f', 0, true);
      else if (mine) poly([[x - 8, y - 116], [x + 8, y - 116], [x, y - 104]], '#ffd23f', 3);
      if (q.stun > 0 && !umbral) for (var k2 = 0; k2 < 3; k2++) { var an = at * 8 + k2 * 2.1; ell(x + Math.cos(an) * 16, y - 98 + Math.sin(an) * 5, 3, 3, '#ffd23f', 1.5); }
      ctx.restore();
    }
    function fuera(pp, kv) {                                                             // en el andén: sale rodando y se queda sentado viendo el tren irse
      var q = st.p[pp], s = asiento(pp), t = (kv - q.sc) / TK, sd = q.y < 0 ? 0 : 1, ds = doorAt(kv), dsx = doorAt(q.sc - 1);
      if (t > 0.6 && !(ds.ph === 2 && ds.idx === dsx.idx)) return;                     // el tren ya salió: se quedó atrás
      var u = Math.min(1, t / 0.5), dirY = sd === 0 ? -1 : 1, x = q.x + Math.sin(pp * 1.7) * 20 * u, y = q.y + dirY * (12 + 38 * u) - Math.sin(u * Math.PI) * 26;
      ctx.save(); ctx.translate(x, y); ctx.rotate(u < 1 ? u * 6.3 * (pp % 2 ? 1 : -1) : 0);
      c.util.pj(s.ch, 0, -30, 36, { animo: 'perder', sombra: false });
      ctx.restore();
      if (u >= 1) txt('¡ESPÉRENME!', x, y - 62, 10, '#fffdf2', 0, true);
    }
    /* ───────── prueba de estilo: el pixel del tablero de Margarita (?pixel=1, docs/style-lab/fiesta-pixel.js) ───────── */
    var PX = window.FIESTA.PX && FIESTA.PX.on() ? FIESTA.PX : null;
    var fondoPx = null;
    function drawPx() {
      var l = lay(), f = l.f, E = PX.ESC, j, k, kv = kVista(), ds = doorAt(kv), sv = sellerAt(kv), fz = frzAt(kv);
      var BW = Math.ceil((f.x1 - f.x0) / E), BH = Math.ceil(600 / E), g = PX.lienzo(BW, BH), z = l.z / E;
      var R = function (x, y, w, h, col) { PX.R(g, x, y, w, h, col); };
      var bx = function (x) { return Math.round((l.cx - f.x0) / E + (x - FW / 2) * z); }, by = function (y) { return Math.round(l.cy / E + (y - FH / 2) * z); };
      var noche = lv === 3;
      /* túnel visto desde arriba: paredes de concreto, balasto (cacheado) y durmientes que corren con el tren */
      var wy0 = by(-100), wy1 = by(FH + 100), key = BW + 'x' + BH + ':' + lv + ':' + wy0 + ':' + wy1;
      if (!fondoPx || fondoPx.key !== key) {
        var fc = document.createElement('canvas'); fc.width = BW; fc.height = BH; var fg = fc.getContext('2d'), Rf = function (x, y, w, h, col) { PX.R(fg, x, y, w, h, col); };
        var bal = noche ? '#2e2a36' : '#4a4450', b1 = PX.tono(bal, 0.2), b2 = PX.tono(bal, -0.3), mur = noche ? '#24223a' : '#3a3850';
        Rf(0, 0, BW, BH, bal);
        for (k = 0; k < BW * BH / 5; k++) { var gx2 = (k * 7919 + 3) % BW, gy2 = (k * 104729 + 11) % BH; Rf(gx2, gy2, 1, 1, k % 4 ? b2 : b1); }
        Rf(0, 0, BW, wy0, mur); Rf(0, wy1, BW, BH - wy1, mur);
        for (k = 0; k < BW; k += 24) { Rf(k, 0, 1, wy0, PX.tono(mur, -0.35)); Rf(k, wy1, 1, BH - wy1, PX.tono(mur, -0.35)); }   // juntas de las placas
        PX.trama(fg, 0, wy0 - 6, BW, 6, PX.tono(mur, -0.4), 0); PX.trama(fg, 0, wy1, BW, 6, PX.tono(mur, -0.4), 1);
        Rf(0, wy0, BW, 1, INK); Rf(0, wy1 - 1, BW, 1, INK);
        Rf(0, wy0 + 6, BW, 1, '#14101c'); Rf(0, wy1 - 7, BW, 1, '#14101c');                         // los cables a lo largo del túnel
        fondoPx = { key: key, cv: fc };
      }
      g.drawImage(fondoPx.cv, 0, 0);
      var off = Math.floor(drift / E), dur0 = noche ? '#3a2a1e' : '#5a3a24', yy0 = wy0 + 2, yh = wy1 - wy0 - 4;
      for (k = -1; k < BW / 14 + 2; k++) { var sx2 = k * 14 - off % 14; R(sx2, yy0, 5, yh, INK); R(sx2 + 1, yy0 + 1, 3, yh - 2, dur0); R(sx2 + 1, yy0 + 1, 1, yh - 2, PX.tono(dur0, 0.25)); }
      for (k = -1; k < BW / 80 + 2; k++) { var lx = k * 80 - off % 80; R(lx, wy0 - 12, 20, 4, INK); R(lx + 1, wy0 - 11, 18, 2, pal.luz); R(lx + 40, wy1 + 8, 20, 4, INK); R(lx + 41, wy1 + 9, 18, 2, pal.luz); }
      /* andén (cuando entra a la estación) */
      if (ds.ph > 0) {
        var sd0 = ds.side, ay0 = sd0 === 0 ? by(-86) : by(FH + 22), ah = Math.round(64 * z), ax0 = bx(-60), aw = bx(FW + 60) - ax0;
        PX.caja(g, ax0, ay0, aw, ah, pal.anden, '#fffdf2', pal.loseta);
        for (k = 0; k < aw; k += 12) R(ax0 + k, ay0 + 1, 1, ah - 2, pal.loseta);
        var sy1 = sd0 === 0 ? ay0 + ah - 6 : ay0 + 1; R(ax0 + 1, sy1, aw - 2, 5, pal.borde); PX.trama(g, ax0 + 1, sy1, aw - 2, 5, INK, 1);
        for (k = 0; k < 9; k++) { var gx = 20 + k * 68 + (k % 2) * 14; if (Math.abs(gx - puertaDe(gx)) < 40) continue;   // la gente esperando, en chiquito
          var gy = sd0 === 0 ? ay0 + 6 : ay0 + 12; PX.sprite(g, ['.oo.', 'osso', '.oo.', 'occo', 'occo'], { o: INK, s: '#f0c8a0', c: pal.gente[k % 4] }, bx(gx) - 2, gy); }
        var nom = estacion(ds.idx), nw = PX.ancho(nom, 1) + 10, ny = sd0 === 0 ? ay0 + 3 : ay0 + ah - 13;
        PX.caja(g, bx(FW / 2) - nw / 2, ny, nw, 11, '#1f5fbf', '#5c94fc'); PX.texto(g, nom, bx(FW / 2), ny + 3, '#fffdf2', 1);
      }
      /* el vagón: casco con contorno, franja naranja, piso con trama, pasillo, bancos, tubos y puertas */
      var cx0 = bx(-16), cy0 = by(-16), cw = bx(FW + 16) - cx0, ch = by(FH + 16) - cy0;
      PX.caja(g, cx0, cy0, cw, ch, pal.casco, '#fffdf2', PX.tono(pal.casco, -0.3));
      for (k = 0; k < cw - 2; k += 3) { R(cx0 + 1 + k, cy0 + 2, 1, 1, PX.tono(pal.casco, -0.15)); R(cx0 + 1 + k, cy0 + ch - 3, 1, 1, PX.tono(pal.casco, -0.15)); }   // remaches
      R(cx0 + 1, by(-4), cw - 2, 3, pal.franja); R(cx0 + 1, by(-4), cw - 2, 1, PX.tono(pal.franja, 0.35)); R(cx0 + 1, by(FH - 4), cw - 2, 3, pal.franja); R(cx0 + 1, by(FH - 4), cw - 2, 1, PX.tono(pal.franja, 0.35));
      var px0 = bx(0), py0 = by(0), pw = bx(FW) - px0, ph = by(FH) - py0;
      R(px0 - 1, py0 - 1, pw + 2, ph + 2, INK); R(px0, py0, pw, ph, pal.piso);
      var pc1 = PX.tono(pal.piso, 0.18), pc2 = PX.tono(pal.piso, -0.16);                // piso de granito: motas fijas (hash), no trama
      for (k = 0; k < pw * ph / 9; k++) { var hx = (k * 7919 + 13) % pw, hy = (k * 104729 + 7) % ph; R(px0 + hx, py0 + hy, 1, 1, k % 3 ? pc2 : pc1); }
      var ay = by(FH / 2 - 26), ah2 = by(FH / 2 + 26) - ay, pv = PX.tono(pal.pasillo, -0.12);
      R(px0, ay, pw, ah2, pal.pasillo); R(px0, ay, pw, 1, PX.tono(pal.pasillo, -0.35)); R(px0, ay + ah2 - 1, pw, 1, PX.tono(pal.pasillo, -0.35));
      for (k = 2; k < ah2 - 2; k += 3) R(px0, ay + k, pw, 1, pv);                            // la goma acanalada del pasillo
      for (k = 0; k < DOORS.length - 1; k++) {
        var a = bx(DOORS[k] + DW / 2 + 12), b = bx(DOORS[k + 1] - DW / 2 - 12), bh = Math.max(6, Math.round(14 * z)), sw = 9, m;
        for (var sd2 = 0; sd2 < 2; sd2++) {                                                  // asientos de a uno, con cojín y respaldo
          var syy = sd2 === 0 ? by(2) : by(FH - 2) - bh;
          for (m = a; m + sw <= b; m += sw + 1) { PX.caja(g, m, syy, sw, bh, pal.banco, PX.tono(pal.banco, 0.4), PX.tono(pal.banco, -0.35)); R(m + 2, sd2 === 0 ? syy + 1 : syy + bh - 3, sw - 4, 2, PX.tono(pal.banco, -0.2)); }
        }
        var tx = bx((DOORS[k] + DOORS[k + 1]) / 2), ty = by(FH / 2 + (k % 2 ? 30 : -30));       // tubo: se ve desde arriba como un círculo con brillo
        PX.elipse(g, tx + 1, ty + 2, 3, 1, 'rgba(20,16,28,.35)'); R(tx - 2, ty - 2, 5, 5, INK); R(tx - 1, ty - 1, 3, 3, '#c8ccd8'); R(tx - 1, ty - 1, 1, 1, '#ffffff');
        var adx = bx((DOORS[k] + DOORS[k + 1]) / 2) - 9;                                     // publicidad sobre las ventanas (en el casco)
        PX.caja(g, adx, cy0 + 2, 18, 5, ['#ffd23f', '#5cd27a', '#ff6fa8'][k % 3]); PX.caja(g, adx, cy0 + ch - 7, 18, 5, ['#5cb8ff', '#ff9a3c', '#b88aff'][k % 3]);
      }
      for (var sd = 0; sd < 2; sd++) for (k = 0; k < DOORS.length; k++) {
        var dx = DOORS[k], open = ds.ph === 2 && ds.side === sd, warn = ds.ph === 1 && ds.side === sd;
        var o = open ? Math.min(1, (OPEN - ds.left + 1) / 6, ds.left / 6) : 0, dy = sd === 0 ? by(-16) : by(FH), dh = Math.max(4, by(0) - by(-16));
        var dl = bx(dx - DW / 2), dr = bx(dx + DW / 2), hw = Math.round((dr - dl) / 2 * (1 - 0.92 * o));
        if (open) R(dl, dy, dr - dl, dh, pal.anden);
        PX.caja(g, dl, dy, hw, dh, '#b8bcc8', '#e8e8f0'); PX.caja(g, dr - hw, dy, hw, dh, '#b8bcc8', '#e8e8f0');
        var ly = sd === 0 ? dy - 5 : dy + dh + 2, lit = warn ? (Math.floor(at * 8) % 2 === 0) : open;
        R(bx(dx) - 2, ly - 1, 5, 4, INK); R(bx(dx) - 1, ly, 3, 2, lit ? (warn ? '#ff3b4e' : '#4fd06a') : '#5a5a6a');
        if (warn) { var bob = Math.floor(Math.abs(Math.sin(at * 10)) * 2); PX.sprite(g, sd === 0 ? ['..y..', '.yyy.', 'yyyyy'] : ['yyyyy', '.yyy.', '..y..'], { y: '#ffd23f' }, bx(dx) - 2, sd === 0 ? ly - 7 - bob : ly + 5 + bob); }
      }
      if (fz && fz.d < FRZ_WARN) {                                                       // frenazo: el piso titila en rojo con trama
        if (Math.floor(at * 12) % 2 === 0) PX.trama(g, px0, py0, pw, ph, '#ff3b4e', 1);
        var fxw = bx(FW / 2) + (fz.sgn > 0 ? 34 : -38); PX.sprite(g, fz.sgn > 0 ? ['y   ', 'yy  ', 'yyy ', 'yy  ', 'y   '] : ['   y', '  yy', ' yyy', '  yy', '   y'], { y: '#ffd23f' }, fxw, by(FH / 2) - 2);
      }
      /* los que ya se bajaron: dan vueltas en el andén y se quedan viendo el tren irse */
      for (j = 0; j < n; j++) if (st.p[j].sc) {
        var q0 = st.p[j], t0 = (kv - q0.sc) / TK, s0 = q0.y < 0 ? 0 : 1, dsx = doorAt(q0.sc - 1);
        if (t0 > 0.6 && !(ds.ph === 2 && ds.idx === dsx.idx)) continue;
        var u = Math.min(1, t0 / 0.5), fxp = bx(q0.x + Math.sin(j * 1.7) * 20 * u), fyp = by(q0.y + (s0 === 0 ? -1 : 1) * (12 + 38 * u)) - Math.round(Math.sin(u * Math.PI) * 10);
        PX.persona(g, asiento(j).ch, colorDe(j), fxp, fyp, { fy: u < 1 && Math.floor(t0 * 10) % 2 === 1 });
        if (u >= 1) PX.texto(g, '¡ESPÉRENME!', fxp, fyp - 30, '#fffdf2', 1, INK);
      }
      /* gente en el vagón y el vendedor, ordenados por y */
      var ord = []; for (j = 0; j < n; j++) if (!st.p[j].sc) ord.push(j);
      ord.sort(function (a2, b2) { return posOf(a2).y - posOf(b2).y || a2 - b2; });
      function vend() {
        if (!sv) return; var vx = bx(sv.x), vy = by(sv.y), vb = Math.floor(Math.abs(Math.sin(at * 9)) * 2);
        PX.elipse(g, vx, vy + 1, 8, 2, 'rgba(20,16,28,.45)');
        PX.persona(g, 'vendedor', '#3fa06a', vx, vy - vb, { cuerpo: '#3fa06a', fx: sv.dir < 0 });
        PX.caja(g, vx + sv.dir * 7 - 5, vy - 12 - vb, 11, 6, '#ffd23f', '#fff3a0'); R(vx + sv.dir * 7 - 3, vy - 10 - vb, 2, 2, '#ff5c8a'); R(vx + sv.dir * 7 + 1, vy - 10 - vb, 2, 2, '#5cb8ff');
        PX.texto(g, '¡CARAMELOS!', vx, vy - 34, '#fffdf2', 1, INK);
      }
      var csx = cuerpos(kv), mux = musAt(kv);                                              // pasajeros, músico y dormido (sprites del vendedor), tubos
      for (k = 0; k < POLES.length; k++) { R(bx(POLES[k][0]) - 1, by(POLES[k][1]) - 1, 3, 3, '#e8e8f0'); }
      for (k = 0; k < csx.length; k++) PX.persona(g, 'vendedor', csx[k].mus ? '#ffb43a' : csx[k].zz ? '#4a6a8a' : pal.gente[(csx[k].i || 0) % 4], bx(csx[k].x), by(csx[k].y), { cuerpo: csx[k].mus ? '#ffb43a' : pal.gente[(csx[k].i || 0) % 4] });
      if (mux && !mux.toca) PX.persona(g, 'vendedor', '#ffb43a', bx(mux.x), by(mux.y), { cuerpo: '#ffb43a' });
      var vdone = false;
      for (j = 0; j < ord.length; j++) {
        var pp = ord[j]; if (!vdone && sv && posOf(pp).y > sv.y) { vend(); vdone = true; }
        var q = st.p[pp], ps = posOf(pp), s = asiento(pp), xx = bx(ps.x), yy = by(ps.y) + 2, mine = pp === c.yo;
        var carga = q.wind > 0 ? (WIND - q.wind) / WIND : (mine && charge > 0 ? 1 - charge / (WIND / TK) : -1);
        var umbral = ds.ph === 2 && gapOf(ps.x) >= 0 && ((ds.side === 0 && ps.y < RP + 4) || (ds.side === 1 && ps.y > FH - RP - 4));
        var wob = umbral ? Math.round(Math.sin(at * 26) * 1.5) : q.stun > 0 ? Math.round(Math.sin(at * 30)) : 0;
        PX.elipse(g, xx, yy, 8, 2, 'rgba(20,16,28,.45)');
        if (carga >= 0) { var rr0 = Math.round(R_HIT * (1 - carga * 0.55) * z); PX.anillo(g, xx, yy, rr0, Math.round(rr0 * 0.55), '#fffdf2'); PX.anillo(g, xx, yy, 8, 3, Math.floor(at * 20) % 2 ? '#ffd23f' : '#ff9a3c'); }
        var fv = faceVec(q.face), lean = carga >= 0 ? Math.round(-2 * carga * fv.x) : 0;
        PX.persona(g, s.ch, colorDe(pp), xx + wob + lean, yy, { fx: fv.x < -0.2 });
        if (umbral) { PX.sprite(g, ['s   s', ' s s '], { s: '#f0c8a0' }, xx - 2, yy - 26 - (Math.floor(at * 12) % 2)); PX.texto(g, '¡AY, AY!', xx, yy - 38, '#fffdf2', 1, INK); }
        if (carga >= 0) PX.texto(g, '!', xx, yy - 36, '#ffd23f', 2, INK);
        else if (mine) PX.sprite(g, ['ooooooo', ' oyyyo ', '  oyo  ', '   o   '], { o: INK, y: '#ffd23f' }, xx - 3, yy - 30 - (Math.floor(at * 3) % 2));
        if (q.stun > 0 && !umbral) for (k = 0; k < 3; k++) { var an = at * 8 + k * 2.1; R(xx + Math.round(Math.cos(an) * 7), yy - 26 + Math.round(Math.sin(an) * 2), 2, 2, '#ffd23f'); }
      }
      if (!vdone) vend();
      for (j = 0; j < fx.length; j++) { var fq = fx[j], fr = 6 + Math.round(fq.t * 60 * z); PX.anillo(g, bx(fq.x), by(fq.y), fr, Math.round(fr / 2), '#fffdf2'); PX.texto(g, '¡PUM!', bx(fq.x), by(fq.y) - 28 - Math.round(fq.t * 14), '#ffd23f', 2, INK); }
      /* letrero del vagón (panel azul marino como el HUD del tablero) */
      var mx = Math.round((l.cx - f.x0) / E), top = by(-86), sy0 = Math.max(46, top - 26);
      var lbl = ds.ph === 2 ? 'PUERTAS ABIERTAS ' + (ds.side === 0 ? '▲' : '▼') : ds.ph === 1 ? 'PRÓXIMA: ' + estacion(ds.idx) : ds.side >= 0 ? 'PRÓXIMA: ' + estacion(ds.idx) : 'FIN DE LA LÍNEA';
      var pwid = Math.max(124, PX.ancho(lbl, 1) + 16);
      PX.caja(g, mx - pwid / 2, sy0, pwid, 22, '#1a2238', '#3a4a78', '#0c1020');
      PX.texto(g, lbl, mx, sy0 + 4, ds.ph === 2 ? '#4fd06a' : ds.ph === 1 ? '#ffd23f' : '#ff9a3c', 1);
      var rest = Math.max(0, Math.ceil((durT - kv) / TK));
      PX.texto(g, 'EN EL VAGÓN: ' + vivos() + ' · ' + rest + ' S', mx, sy0 + 13, '#fffdf2', 1);
      if (bannerT > 0 && banner) { var bs = Math.max(1, Math.min(3, Math.floor((BW - 16) / (PX.ancho(banner.s, 1) + 1)))); PX.texto(g, banner.s, mx, by(FH / 2) - 4 * bs, banner.col, bs, INK); }
      if (c.ahora() >= -0.4 && c.ahora() < 2.4) PX.texto(g, 'SEÑORES PASAJEROS, DISCULPEN QUE LOS MOLESTE...', mx, by(FH / 2) + 22, '#fffdf2', 1, INK);
      /* las partículas y los letreros flotantes del motor (spawn/say), en pixel dentro del mismo lienzo (el motor no los dibuja: drawP no se llama) */
      if (typeof PT !== 'undefined') for (j = 0; j < PT.length; j++) {
        var pt = PT[j], ptx = Math.round((pt.x - f.x0) / E), pty = Math.round(pt.y / E), vida = 1 - pt.t / pt.life;
        if (vida < 0.3 && Math.floor(at * 20) % 2) continue;                              // parpadea al apagarse, sin transparencia
        if (pt.kind === 'conf' || pt.kind === 'bit' || pt.kind === 'feather') { R(ptx - 1, pty - 1, 3, 3, INK); R(ptx, pty, 1, 1, pt.col); if (Math.floor(pt.rot) % 2) R(ptx - 1, pty, 3, 1, pt.col); }
        else if (pt.kind === 'bill') { R(ptx - 3, pty - 2, 7, 4, INK); R(ptx - 2, pty - 1, 5, 2, '#5cd06a'); }
        else PX.texto(g, pt.kind, ptx, pty - 3, pt.col || '#fffdf2', 1, INK);
      }
      var sx = Math.round(Math.sin(at * 90) * shake * 2) * E, sy = Math.round(Math.cos(at * 77) * shake * 1.5) * E;
      PX.volcar(ctx, f.x0 + sx, sy);
    }
    /* ───── 3D low poly (fiesta-3d.js): el vagón del Metro de Caracas por dentro (corte de casa de muñecas: la pared de acá es bajita), con el túnel
       corriendo afuera y el andén que llega por el lado que se abre. Solo dibujo: lee st.p / posOf / doorAt / frzAt / sellerAt; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var ESX = 1 / 18, ESZ = 1.15 / 18, HW = 5, ZIN = (FH / 2 + 6) * ESZ, ARR = 45;   // px -> metros; HW alto de la pared; ZIN cara interna de las paredes; ARR ticks que tarda el andén en llegar
    function WX(x) { return (x - FW / 2) * ESX; }
    function WZ(y) { return (y - FH / 2) * ESZ; }
    var PAL3 = {
      1: { fondo: ['#1c1a2a', '#3a3850'], niebla: '#1c1a2a', hemi: [0xffffff, 0x8a8aa0, .62], sol: [0xfff4e0, .62], tubo: .7, noche: 0, vidrio: '#5a6a8a', tunel: '#45435e' },
      2: { fondo: ['#2a1c26', '#5a3a40'], niebla: '#2a1c26', hemi: [0xffdcb8, 0x7a5a6a, .56], sol: [0xffb878, .68], tubo: .85, noche: 0, vidrio: '#6a5a6a', tunel: '#4e3e4e' },
      3: { fondo: ['#08081a', '#1a1830'], niebla: '#0c0c1e', hemi: [0x8a9aff, 0x2a2a4a, .4], sol: [0xaab8ff, .3], tubo: 1.7, noche: 1, vidrio: '#2a3050', tunel: '#2a2840' }
    };
    var PIEL = ['#f0c8a0', '#c98a5a', '#8a5a3a', '#e0a878', '#b07a58'], PELO = ['#1a1410', '#3a2418', '#d9d5df', '#5a3a22'];
    var CARAMELOS = ['#ff5c8a', '#5cb8ff', '#ffd23f', '#5cd27a', '#fffdf2'];
    function andenAt(kv) {                                   // el andén visible: {idx, sd, off (m en x: llega desde +x, se va hacia −x)} o null
      var ds = doorAt(kv), u;
      if (ds.ph > 0) return { idx: ds.idx, sd: ds.side, off: 0 };
      if (ds.side >= 0 && ds.tTo < ARR) { u = ds.tTo / ARR; return { idx: ds.idx, sd: ds.side, off: 70 * u * u }; }
      var j = ds.idx - 1;
      if (j >= 0 && j < stations.length) { var since = kv - (stations[j].t + WARN + OPEN); if (since >= 0 && since < ARR) { u = since / ARR; return { idx: j, sd: stations[j].side, off: -70 * u * u }; } }
      return null;
    }

    /* ───── LA MULTITUD: ~110 personas en 9 InstancedMesh (torso, cabeza, pelo, 2 piernas, 2 brazos + contornos). Cada una se pone con pose(): caminar, sentada,
       agarrada de la correa, empujando, acostada… Reemplaza a los grupos sueltos de mallas (eran ~9 mallas por persona) ───── */
    function multitud(esc, cap) {
      var T = THREE, W = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: V3.toon('#fff').gradientMap }), TI = new T.MeshBasicMaterial({ color: 0x14101c, side: T.BackSide });
      var gTor = new T.CylinderGeometry(.4, .5, 1.15, 8), gCab = new T.IcosahedronGeometry(.5, 1), gPel = new T.SphereGeometry(.53, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      var gPie = new T.BoxGeometry(.32, .8, .34), gBra = new T.BoxGeometry(.22, .76, .24); gPie.translate(0, -.4, 0); gBra.translate(0, -.38, 0);
      var ZM = new T.Matrix4().makeScale(0, 0, 0), C0 = new T.Color(1, 1, 1), i;
      function im(g, n, mat, sombra) {
        var m = new T.InstancedMesh(g, mat, n); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = !!sombra;
        if (mat === W) for (var q2 = 0; q2 < n; q2++) m.setColorAt(q2, C0);
        for (var q = 0; q < n; q++) m.setMatrixAt(q, ZM);
        esc.scene.add(m); return m;
      }
      var tor = im(gTor, cap, W, true), cab = im(gCab, cap, W, true), pel = im(gPel, cap, W, false), pie = im(gPie, cap * 2, W, false), bra = im(gBra, cap * 2, W, false);
      var tor2 = im(gTor, cap, TI), cab2 = im(gCab, cap, TI), pie2 = im(gPie, cap * 2, TI), bra2 = im(gBra, cap * 2, TI);
      var all = [tor, cab, pel, pie, bra, tor2, cab2, pie2, bra2];
      var pers = [], Q = new T.Quaternion(), E = new T.Euler(), Vp = new T.Vector3(), Vs = new T.Vector3(), MR = new T.Matrix4(), ML = new T.Matrix4(), MM = new T.Matrix4(), cc = new T.Color();
      function loc(m, m2, idx, px, py, pz, rx, ry, rz, sx, sy, sz, ord, k2) {
        E.set(rx, ry, rz, ord || 'XYZ'); Q.setFromEuler(E); Vp.set(px, py, pz); Vs.set(sx, sy, sz); ML.compose(Vp, Q, Vs); MM.multiplyMatrices(MR, ML); m.setMatrixAt(idx, MM);
        if (m2) { Vs.set(sx * (k2 ? k2[0] : 1.1), sy * (k2 ? k2[1] : 1.1), sz * (k2 ? k2[0] : 1.1)); ML.compose(Vp, Q, Vs); MM.multiplyMatrices(MR, ML); m2.setMatrixAt(idx, MM); }
      }
      var LK = [1.45, 1.03];
      return {
        pers: pers,
        add: function (col, piel, pelo, s) {                 // devuelve el número de ficha
          var id = pers.length; if (id >= cap) return cap - 1;
          pers.push({ s: s || 1, x: 0, z: 0, hy: 0, fl: 0, fx: 0, fz: 0, ph: id * 1.7 });
          tor.setColorAt(id, cc.set(col)); cab.setColorAt(id, cc.set(piel)); pel.setColorAt(id, cc.set(pelo));
          pie.setColorAt(id * 2, cc.set(V3.oscurecer(col, .55))); pie.setColorAt(id * 2 + 1, cc);
          bra.setColorAt(id * 2, cc.set(col)); bra.setColorAt(id * 2 + 1, cc);
          return id;
        },
        listo: function () { for (var q = 0; q < all.length; q++) if (all[q].instanceColor) all[q].instanceColor.needsUpdate = true; },
        oculta: function (id) { tor.setMatrixAt(id, ZM); cab.setMatrixAt(id, ZM); pel.setMatrixAt(id, ZM); tor2.setMatrixAt(id, ZM); cab2.setMatrixAt(id, ZM);
          for (var k = 0; k < 2; k++) { pie.setMatrixAt(id * 2 + k, ZM); bra.setMatrixAt(id * 2 + k, ZM); pie2.setMatrixAt(id * 2 + k, ZM); bra2.setMatrixAt(id * 2 + k, ZM); } },
        /* o: s escala · sit 0-1 · w fase de paso · wa amplitud · rx/rz inclinación del cuerpo · sq aplaste · br respiración · hx/hy/hz cabeza (cabecea, gira, ladea)
              arm brazos adelante (ambos) · splay brazos abiertos · al/ar brazo izq/der (rotación x) · up brazo derecho agarrado de la correa · ty torso girado */
        pose: function (id, x, y, z, ry, o) {
          var P = pers[id], sc = P.s * (o.s == null ? 1 : o.s), k, sg;
          if (sc < .03) { this.oculta(id); return; }
          var sit = o.sit || 0, wv = o.w || 0, wa = o.wa || 0, sq = o.sq || 1, br = o.br || 0, hip = .8 - sit * .06, sw = Math.sin(wv) * wa, arm = o.arm || 0, spl = o.splay || 0;
          P.x = x; P.z = z;
          E.set(o.rx || 0, ry, o.rz || 0, 'YXZ'); Q.setFromEuler(E); Vp.set(x, y, z); Vs.set(sc, sc * sq, sc); MR.compose(Vp, Q, Vs);
          for (k = 0; k < 2; k++) {
            sg = k ? 1 : -1;
            loc(pie, pie2, id * 2 + k, sg * .2, hip, sit * .02, sit * -1.5 + (1 - sit) * sg * sw * .9, 0, sg * (.03 + (o.spread || 0)), 1, 1, 1, 'XYZ', LK);
            var ax = (k ? (o.ar != null ? o.ar : 0) : (o.al != null ? o.al : 0)) - arm - sg * sw * .8 * (1 - sit);
            if (o.up && k === 1) ax = -2.95 + Math.sin(wv * .5) * .05;
            loc(bra, bra2, id * 2 + k, sg * .56, hip + 1.1 + br * .02, 0, ax, 0, sg * (.1 + spl), 1, 1, 1, 'ZXY', LK);
          }
          loc(tor, tor2, id, 0, hip + .58 + br * .02, 0, 0, o.ty || 0, 0, 1 + br * .02, 1 - br * .015, 1 + br * .02, 'XYZ');
          var hy0 = hip + 1.62 + br * .02 - (o.dr || 0) * .15;
          loc(cab, cab2, id, 0, hy0, 0, o.hx || 0, o.hy || 0, o.hz || 0, 1, 1, 1, 'YXZ');
          loc(pel, null, id, 0, hy0 + .06, 0, (o.hx || 0) - .25, o.hy || 0, o.hz || 0, 1, 1, 1, 'YXZ');
        },
        flinch: function (x, z, r, k) {                        // un susto cerca (golpe, frenazo, tambora): la gente se encoge y se aparta
          for (var q = 0; q < pers.length; q++) { var P = pers[q], dx = P.x - x, dz = P.z - z, d = Math.sqrt(dx * dx + dz * dz); if (d < r) { var f = k * (1 - d / r); if (f > P.fl) { P.fl = f; P.fx = dx / (d || 1); P.fz = dz / (d || 1); } } }
        },
        fin: function (dt) { for (var q = 0; q < pers.length; q++) pers[q].fl = Math.max(0, pers[q].fl - dt * 2.2); for (q = 0; q < all.length; q++) all[q].instanceMatrix.needsUpdate = true; }
      };
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j, sd;
      var esc = V3.escena({ fondo: V3.cielo(pl.fondo[0], pl.fondo[1]), niebla: [pl.niebla, 60, 140], fov: 32 });
      if (!esc) return null;
      // salsa caraqueña de hora pico: i–iv–V–i en La menor, montuno en la melodía
      V3.pista('vagon', { bpm: 150, acordes: [[57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64]],
        mel: [76, 0, 72, 76, 0, 74, 72, 0, 69, 0, 72, 74, 0, 76, 74, 72, 74, 0, 71, 74, 0, 76, 74, 0, 72, 0, 71, 0, 69, 0, 0, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-24, 14, 8);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, GM = V3.toon('#fff').gradientMap;
      var vag = new T.Group(); S3.add(vag);                                     // todo lo del vagón (y los que van dentro) se mece junto
      var X0 = WX(-16), X1 = WX(FW + 16), LW = X1 - X0;
      function caja(w, h, d, col, x, y, z, op, padre) { var m = M(new T.BoxGeometry(w, h, d), col, op || { recibe: true, g: .02 }); m.position.set(x, y, z); (padre || vag).add(m); return m; }
      function plano(w, d, mat, x, y, z, padre) { var m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; (padre || vag).add(m); return m; }
      /* piso de granito y pasillo de goma acanalada */
      var gran = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = pal.piso; x.fillRect(0, 0, w, h);
        for (var i = 0; i < 300; i++) { x.fillStyle = i % 3 ? V3.oscurecer(pal.piso, .86) : V3.oscurecer(pal.piso, 1.14); x.fillRect((i * 37) % w, (i * 53 + (i >> 3) * 7) % h, 2, 2); }
      }, [12, 4]);
      plano(LW, ZIN * 2, new T.MeshToonMaterial({ map: gran, gradientMap: GM }), (X0 + X1) / 2, 0, 0);
      var goma = V3.texturaCanvas(64, 64, function (x, w, h) { x.fillStyle = pal.pasillo; x.fillRect(0, 0, w, h); x.fillStyle = V3.oscurecer(pal.pasillo, .8); for (var i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, h); }, [40, 1]);
      plano(LW - .4, 52 * ESZ, new T.MeshToonMaterial({ map: goma, gradientMap: GM }), (X0 + X1) / 2, .012, 0);
      caja(LW + .2, .7, ZIN * 2 + 1, V3.oscurecer(pal.casco, .7), (X0 + X1) / 2, -.36, 0, { g: .015 });          // el chasis
      /* paredes: la de allá completa (ventanas, publicidad, franja naranja); la de acá cortada a la altura de la cadera */
      var xs = [X0], puertas = [[], []], lamparas = [[], []];
      for (k = 0; k < DOORS.length; k++) xs.push(WX(DOORS[k] - DW / 2), WX(DOORS[k] + DW / 2));
      xs.push(X1);
      var PUB = ['#ffd23f', '#5cd27a', '#ff6fa8', '#5cb8ff', '#ff9a3c', '#b88aff'];
      for (sd = 0; sd < 2; sd++) {
        var sg = sd === 0 ? -1 : 1, zc = sg * (ZIN + .22), full = sd === 0, zi = sg * (ZIN - .02);
        for (k = 0; k + 1 < xs.length; k += 2) {
          var a = xs[k], b = xs[k + 1], w = b - a, cx = (a + b) / 2;
          if (full) {
            caja(w, 1.7, .45, pal.casco, cx, .85, zc);
            caja(w, HW - 3.9, .45, pal.casco, cx, (HW + 3.9) / 2, zc);
            var vi = M(new T.BoxGeometry(w, 2.2, .1), pl.vidrio, { borde: false, op: .55, sombra: false }); vi.position.set(cx, 2.8, zc); vag.add(vi);
            for (j = 0; j <= Math.floor(w / 3); j++) caja(.18, 2.2, .5, pal.casco, a + .09 + j * (w - .18) / Math.max(1, Math.floor(w / 3)), 2.8, zc, { g: .02 });
            caja(w, .16, .5, pal.franja, cx, 1.62, zc, { borde: false });
            for (j = 0; j < Math.floor(w / 2.6); j++) caja(1.9, .55, .04, PUB[(k + j * 3) % PUB.length], a + 1.3 + j * 2.6, 4.35, zi + .02 * sg, { borde: false });   // publicidad
          } else {
            caja(w, .95, .45, pal.casco, cx, .48, zc);
            caja(w, .14, .5, pal.franja, cx, 1.0, zc, { borde: false });
          }
        }
        for (k = 0; k < DOORS.length; k++) {
          var dx = WX(DOORS[k]), dw = DW * ESX, hd = full ? 3.9 : .95;
          if (full) caja(dw, HW - 3.9, .45, pal.casco, dx, (HW + 3.9) / 2, zc);
          var pI = caja(dw / 2, hd, .12, '#b8bcc8', dx - dw / 4, hd / 2, zi - sg * .1, { g: .03 }), pD = caja(dw / 2, hd, .12, '#b8bcc8', dx + dw / 4, hd / 2, zi - sg * .1, { g: .03 });
          if (full) { caja(dw / 2 - .5, 1.4, .02, pl.vidrio, 0, .6, -sg * .07, { borde: false }, pI); caja(dw / 2 - .5, 1.4, .02, pl.vidrio, 0, .6, -sg * .07, { borde: false }, pD); }
          puertas[sd].push({ i: pI, d: pD, x: dx, w: dw });
          var lm = new T.Mesh(new T.BoxGeometry(.7, .26, .14), new T.MeshBasicMaterial({ color: 0x5a5a6a }));
          lm.position.set(dx, full ? 4.3 : 1.35, zi - sg * .12); vag.add(lm); V3.borde(lm, .06);
          if (!full) caja(.12, 1.2, .12, '#2a2a34', dx, .65, zi + sg * .1, { borde: false });
          var fl = M(new T.ConeGeometry(.32, .6, 4), '#ffd23f', { g: .1 }); fl.rotation.x = sg * Math.PI / 2; fl.position.set(dx, full ? 4.3 : 1.35, zi - sg * .9); fl.visible = false; vag.add(fl);
          lamparas[sd].push({ m: lm, f: fl });
        }
      }
      for (j = 0; j < 2; j++) { var ex = j ? X1 + .12 : X0 - .12; caja(.3, HW, ZIN * 2 + .9, pal.casco, ex, HW / 2, 0); caja(.06, 3.4, 2.2, V3.oscurecer(pal.casco, .6), ex + (j ? -.16 : .16), 1.75, 0, { borde: false }); }   // los extremos con su puerta de paso
      /* peligro en el piso junto a cada puerta (titila con el aviso) y flechas de la marea (con la puerta abierta) */
      var haz = [], chev = [[], []], tri = new T.BufferGeometry();
      tri.setAttribute('position', new T.Float32BufferAttribute([-.55, 0, 0, 0, 0, -.55, .55, 0, 0, .55, 0, 0, 0, 0, -.55, -.55, 0, 0], 3)); tri.computeVertexNormals();
      for (sd = 0; sd < 2; sd++) {
        var hm = new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false }), cm = new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide });
        haz.push(hm);
        for (k = 0; k < DOORS.length; k++) {
          plano(DW * ESX, MAREA_Y * ESZ, hm, WX(DOORS[k]), .02, (sd === 0 ? -1 : 1) * (ZIN - MAREA_Y * ESZ / 2));
          for (j = 0; j < 2; j++) { var ch = new T.Mesh(tri, cm); ch.rotation.y = sd === 0 ? 0 : Math.PI; ch.position.set(WX(DOORS[k]), .03, 0); ch.scale.set(1.4, 1, 1.2); ch.visible = false; vag.add(ch); chev[sd].push({ m: ch, k: k, j: j }); }
        }
      }
      var rojo = new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false });   // el frenazo: el piso titila
      plano(LW, ZIN * 2, rojo, (X0 + X1) / 2, .025, 0);
      /* bancos contra las paredes, con pasajeros sentados (nadie les cede el puesto) y tubos en las puntas */
      var CR = multitud(esc, 150), PERS_N = 0;
      function nueva(col, s0) { var q = PERS_N++; return CR.add(col, PIEL[(q * 3 + 1) % PIEL.length], PELO[(q * 5 + 2) % PELO.length], s0 || (.9 + ((q * 7) % 5) * .035)); }
      var sentados = [], tubos = [];
      var bancos = [[X0 + .4, WX(DOORS[0] - DW / 2) - .4]];
      for (k = 0; k + 1 < DOORS.length; k++) bancos.push([WX(DOORS[k] + DW / 2) + .4, WX(DOORS[k + 1] - DW / 2) - .4]);
      bancos.push([WX(DOORS[DOORS.length - 1] + DW / 2) + .4, X1 - .4]);
      for (sd = 0; sd < 2; sd++) for (k = 0; k < bancos.length; k++) {
        var sg2 = sd === 0 ? -1 : 1, ba = bancos[k][0], bb = bancos[k][1], bw = bb - ba, zb = sg2 * (ZIN - .42);
        caja(bw, .22, .8, pal.banco, (ba + bb) / 2, .68, zb, { g: .03, recibe: true });
        if (sd === 0) caja(bw, 1.1, .16, pal.banco, (ba + bb) / 2, 1.3, sg2 * (ZIN - .1), { g: .03 });
        for (j = 0; j < 2; j++) { var tb = M(new T.CylinderGeometry(.06, .06, HW - .2, 6), '#e8e8f0', { g: .2 }); tb.position.set(j ? bb + .1 : ba - .1, (HW - .2) / 2, sg2 * (ZIN - .9)); if (sd === 1) { tb.scale.y = .5; tb.position.y = (HW - .2) / 4; } vag.add(tb); tubos.push(tb); }
        var ns = Math.floor(bw / 1.0);
        for (j = 0; j < ns; j++) {
          if ((k * 7 + j * 3 + sd * 5) % 5 > 3) continue;
          var np = nueva(pal.gente[(k + j + sd) % 4], .95), hs = (k * 13 + j * 7 + sd * 3) % 10;
          sentados.push({ id: np, x: ba + (j + .5) * bw / ns, z: zb + sg2 * .05, sd: sd, ry: sd === 0 ? 0 : Math.PI, vol: hs < 6, dl: hs * 1.1, k: sentados.length, st: 0, tv: 0 });
        }
      }
      /* barandas de arriba con agarraderas (se mecen con el vagón) y los tubos de luz */
      var correas = [], luces = [];
      for (j = -1; j <= 1; j += 2) {
        var rl = M(new T.CylinderGeometry(.06, .06, LW - 1, 6), '#e8e8f0', { g: .2 }); rl.rotation.z = Math.PI / 2; rl.position.set((X0 + X1) / 2, 4.75, j * 30 * ESZ); vag.add(rl);
        for (k = 0; k < 20; k++) {
          var cg = new T.Group(); cg.position.set(X0 + 1.2 + k * (LW - 2.4) / 19, 4.75, j * 30 * ESZ); vag.add(cg);
          var co = caja(.06, .45, .14, '#2a2a34', 0, -.24, 0, { borde: false }, cg);
          var an = M(new T.TorusGeometry(.15, .04, 4, 10), '#fffdf2', { g: .1 }); an.position.y = -.6; cg.add(an);
          correas.push({ g: cg, f: k * .37 + j }); void co;
        }
      }
      for (k = 0; k < 8; k++) { var tl = new T.Mesh(new T.BoxGeometry(2.6, .1, .22), tn('#ffffff', { em: '#e8f4ff', emI: pl.tubo, nuevo: true })); tl.position.set(X0 + 2.4 + k * (LW - 4.8) / 7, HW - .05, 0); vag.add(tl); luces.push(tl); }
      var pts0 = []; if (pl.noche) for (k = -1; k <= 1; k += 2) { var pt = new T.PointLight(0xd8ecff, 1.1, 24, 2); pt.position.set(k * 9, 4.2, 0); vag.add(pt); pts0.push(pt); }
      /* afuera: el túnel (balasto, vía con durmientes que corren, pared con lámparas y cables) */
      plano(220, 90, tn('#1e1c26'), 0, -.9, 0, S3);
      var durm = [];
      for (sd = 0; sd < 2; sd++) {
        var sg3 = sd === 0 ? -1 : 1, zv = sg3 * (ZIN + 4.2);
        for (j = -1; j <= 1; j += 2) caja(200, .14, .14, '#8a8ea0', 0, -.72, zv + j * .75, { borde: false }, S3);
        for (k = 0; k < 32; k++) { var du = caja(.42, .12, 2.4, lv === 3 ? '#3a2a1e' : '#5a3a24', 0, -.82, zv, { borde: false }, S3); durm.push(du); }
      }
      var zt = -(ZIN + 9.5);
      caja(220, 10, .6, pl.tunel, 0, 4, zt, { borde: false, recibe: true }, S3);
      for (j = 0; j < 2; j++) { var cb2 = new T.Mesh(new T.CylinderGeometry(.07, .07, 220, 5), tn('#14101c')); cb2.rotation.z = Math.PI / 2; cb2.position.set(0, 4.2 + j * .35, zt + .4); S3.add(cb2); }
      var lamps = [];
      for (k = 0; k < 10; k++) { var la = new T.Mesh(new T.BoxGeometry(1.2, .3, .12), tn('#fff6d0', { em: pal.luz, emI: 1.4 })); la.position.set(0, 2.6, zt + .36); S3.add(la); lamps.push(la); }
      /* los andenes: uno por lado; llegan deslizándose y se van; letrero con la estación, columnas, franja amarilla y gente esperando */
      var losa = V3.texturaCanvas(128, 128, function (x, w, h) { x.fillStyle = pal.loseta; x.fillRect(0, 0, w, h); x.fillStyle = pal.anden; for (var i = 0; i < 4; i++) for (var i2 = 0; i2 < 4; i2++) x.fillRect(i * 32 + 2, i2 * 32 + 2, 28, 28); }, [30, 3]);
      var plats = [];
      for (sd = 0; sd < 2; sd++) {
        var sg4 = sd === 0 ? -1 : 1, pg = new T.Group(); pg.visible = false; S3.add(pg);
        var z0 = sg4 * (ZIN + .48), z1 = sg4 * (ZIN + .48 + 6.4), zm = (z0 + z1) / 2;
        caja(80, 1.2, 6.4, pal.anden, 0, -.6, zm, { borde: false, recibe: true }, pg);
        plano(80, 6.4, new T.MeshToonMaterial({ map: losa, gradientMap: GM }), 0, .01, zm, pg);
        plano(80, .5, tn(pal.borde), 0, .02, z0 + sg4 * .35, pg);
        for (k = 0; k < 8; k++) { var col = M(new T.CylinderGeometry(.45, .5, sd === 0 ? 8 : 3.6, 8), '#e8e0d0', { g: .03 }); col.position.set(-35 + k * 10, sd === 0 ? 4 : 1.8, z1 - sg4 * .8); pg.add(col); }
        if (sd === 0) {
          caja(80, 9, .4, '#d8ccb4', 0, 4.5, z1 - .2, { borde: false, recibe: true }, pg);
          caja(80, .6, .45, '#1f5fbf', 0, 6.4, z1, { borde: false }, pg);                // la franja azul del Metro
          for (k = 0; k < 6; k++) { var bp = caja(2.4, .25, .7, pal.banco, -25 + k * 10, .6, z1 + 1, { g: .03 }, pg); void bp; }
          if (pl.noche) for (k = 0; k < 5; k++) { var lp = new T.Mesh(new T.BoxGeometry(3, .14, .3), tn('#ffffff', { em: '#fff2c8', emI: 1.6 })); lp.position.set(-28 + k * 14, 7.4, z1 + .4); pg.add(lp); }
        }
        var lt = new T.MeshBasicMaterial({ color: 0xffffff }), gLt = new T.PlaneGeometry(7, 1.3);          // dos letreros, a los lados (el del centro lo tapa el letrero del vagón)
        for (j = -1; j <= 1; j += 2) {
          var letrero = new T.Mesh(gLt, lt); letrero.position.set(j * 13, sd === 0 ? 2.8 : 2.7, sd === 0 ? z1 + .02 : z1 - .3); pg.add(letrero); V3.borde(letrero, .04);
          if (sd === 1) { caja(.14, 2, .14, '#2a2a34', j * 13 - 3.2, 1, z1 - .4, { borde: false }, pg); caja(.14, 2, .14, '#2a2a34', j * 13 + 3.2, 1, z1 - .4, { borde: false }, pg); }
        }
        var esperan = [];
        for (k = 0; k < 12; k++) {
          var gx = -34 + k * 6.1 + (k % 2) * 1.3, dd0 = 0, bd = 99;
          for (j = 0; j < DOORS.length; j++) if (Math.abs(gx - WX(DOORS[j])) < bd) { bd = Math.abs(gx - WX(DOORS[j])); dd0 = j; }
          var gz = zm + sg4 * (k % 3) * .9;
          esperan.push({ id: nueva(pal.gente[k % 4]), bx: gx, bz: gz, cx: gx, cz: gz, d: dd0, v: 0, rk: k % 3, bd: k % 4 === 0, jit: ((k * 37) % 11 - 5) * .14 });
        }
        plats.push({ g: pg, mat: lt, idx: -1, esperan: esperan });
      }
      /* el vendedor de caramelos (Nv3) */
      var vend = null;
      if (sellT >= 0) {
        vend = V3.PJ.crear('pana', { prop: false, escala: 1.25, camisa: '#3fa06a' }); vag.add(vend.g); vend.g.visible = false;
        var bandeja = M(new T.BoxGeometry(1, .22, .6), '#ffd23f', { g: .05 }); bandeja.position.set(0, 1.25, .62); vend.g.add(bandeja);
        for (k = 0; k < 6; k++) { var cm2 = M(new T.SphereGeometry(.1, 6, 4), CARAMELOS[k % 5], { borde: false }); cm2.position.set(-.35 + (k % 3) * .35, 1.42, .48 + Math.floor(k / 3) * .25); vend.g.add(cm2); }
      }
      /* tubos de piso a techo (los que se agarran), puesto libre, palancas del freno, pasajeros que caminan, músico y dormido */
      var tubosAg = [], brk = [], NP = [], pts = pts0;
      for (k = 0; k < POLES.length; k++) {
        var tp = M(new T.CylinderGeometry(.11, .11, HW - .1, 8), '#e8e8f0', { g: .25 }); tp.position.set(WX(POLES[k][0]), (HW - .1) / 2, WZ(POLES[k][1])); vag.add(tp);
        var tg = new T.Mesh(new T.RingGeometry(.5, .72, 20), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .6, depthWrite: false }));
        tg.rotation.x = -Math.PI / 2; tg.position.set(WX(POLES[k][0]), .045, WZ(POLES[k][1])); vag.add(tg); tubosAg.push({ m: tp, r: tg });
      }
      var puesto = new T.Mesh(new T.BoxGeometry(2.2, .14, 1), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .85 })); puesto.visible = false; vag.add(puesto);
      for (j = 0; j < 2; j++) {
        var bx0 = j ? X1 - .7 : X0 + .7, bg = new T.Group(); bg.position.set(bx0, 0, 0); vag.add(bg);
        caja(.3, 1.2, .5, '#2a2a34', 0, .6, 0, { g: .03 }, bg);
        var bh = caja(.18, 1, .18, '#ff3b4e', 0, 1.6, 0, { g: .1 }, bg); bh.position.y = 1.6;
        var br = new T.Mesh(new T.RingGeometry(.8, 1, 24), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .5, depthWrite: false })); br.rotation.x = -Math.PI / 2; br.position.set(j ? -.2 : .2, .05, 0); bg.add(br);
        brk.push({ g: bg, h: bh, r: br });
      }
      for (k = 0; k < 14; k++) NP.push({ id: nueva(pal.gente[k % 4]), idx: -1, say: false, x: 0, y: 0, ang: 0 });
      var mus = nueva('#ffb43a', 1), zzG = nueva('#4a6a8a', 1), TAPS = [nueva('#8a4a3a', 1.2), nueva('#3a6a5a', 1.2)];
      var tam = M(new T.CylinderGeometry(.5, .5, .45, 10), '#c9433d', { g: .05 }); tam.visible = false; vag.add(tam);
      var mRing = new T.Mesh(new T.RingGeometry(.9, 1, 40), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .5, depthWrite: false })), mDisc = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ color: 0xffb43a, transparent: true, opacity: .1, depthWrite: false }));
      mRing.rotation.x = mDisc.rotation.x = -Math.PI / 2; mRing.visible = mDisc.visible = false; vag.add(mRing, mDisc);
      var olaB = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: .2, depthWrite: false })), olaL = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: .6, depthWrite: false }));
      olaB.rotation.x = olaL.rotation.x = -Math.PI / 2; olaB.visible = olaL.visible = false; vag.add(olaB, olaL);
      /* los jugadores */
      var pjs = [], gEst = new T.OctahedronGeometry(.16, 0), mEst = new T.MeshBasicMaterial({ color: 0xffd23f });
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.3 }); vag.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.95, 1.18, 24), new T.MeshBasicMaterial({ color: colorDe(k), transparent: true, opacity: .85, depthWrite: false }));
        aro.rotation.x = -Math.PI / 2; aro.scale.set(1, 1.15, 1); vag.add(aro);
        var cRing = new T.Mesh(new T.RingGeometry(.93, 1, 40), new T.MeshBasicMaterial({ color: 0xfffdf2, transparent: true, opacity: .8, depthWrite: false })), cDisc = new T.Mesh(new T.CircleGeometry(.93, 32), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .16, depthWrite: false }));
        cRing.rotation.x = cDisc.rotation.x = -Math.PI / 2; cRing.visible = cDisc.visible = false; vag.add(cRing, cDisc);
        var est = []; for (j = 0; j < 3; j++) { var e3 = new T.Mesh(gEst, mEst); e3.visible = false; vag.add(e3); est.push(e3); }
        var p0 = posOf(k);
        pjs.push({ pj: pj, aro: aro, cRing: cRing, cDisc: cDisc, est: est, x: WX(p0.x), z: WZ(p0.y), px: WX(p0.x), pz: WZ(p0.y), rumbo: 0, cd: 0, umbral: false, fuera: null, fest: false, vendT: -9, en: vag, fireT: 0, hitT: 0, happy: 0, dustT: 0 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; vag.add(flecha);
      var part = V3.particulas(esc, 600);
      var cam = { z: 1.2 };
      esc.encuadrar(LW + 1, 16, new T.Vector3(0, 1.2, cam.z), .9);
      return { esc: esc, vag: vag, pjs: pjs, part: part, puertas: puertas, lamparas: lamparas, haz: haz, chev: chev, rojo: rojo, sentados: sentados, correas: correas, luces: luces,
        tubosAg: tubosAg, brk: brk, NP: NP, pts: pts, puesto: puesto, CR: CR, mus: mus, tam: tam, TAPS: TAPS, olaB: olaB, olaL: olaL, mRing: mRing, mDisc: mDisc, zzG: zzG, ks: 0, kvLast: -1, olaIdx: -1, dust: 0, luz: 1, hemi0: pl.hemi[2], sol0: pl.sol[1], tubo0: pl.tubo,
        durm: durm, lamps: lamps, plats: plats, vend: vend, flecha: flecha, cam: cam, LW: LW, sw: { a: 0, v: 0 }, roll: 0, ph: -1, ding: -1, fzHit: -1, chisT: 0, carteles: {}, fin: false };
    }
    function cartel(idx) {                                   // textura del letrero de la estación (una por estación, en caché)
      if (v3.carteles[idx]) return v3.carteles[idx];
      var nom = estacion(idx);
      return (v3.carteles[idx] = V3.texturaCanvas(512, 96, function (x, w, h) {
        x.fillStyle = '#1f5fbf'; x.fillRect(0, 0, w, h); x.fillStyle = '#fffdf2'; x.fillRect(6, 6, w - 12, 4); x.fillRect(6, h - 10, w - 12, 4);
        x.font = 'bold ' + (nom.length > 14 ? 40 : 52) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(nom, w / 2, h / 2 + 2);
      }));
    }
    function abierta(ds, sd, k) {                              // apertura (0-1) de la puerta k: la trabada no abre; en la prórroga solo queda abierta la loca
      if (ds.ph !== 2 || ds.side !== sd) return 0;
      var o = Math.min(1, (ds.el + 1) / 6);
      if (ds.jam === k) return 0;
      if (ds.el < OPEN) return Math.min(o, ds.left / 6);
      return ds.loca === k ? Math.min(o, ds.left / 6) : Math.max(0, 1 - (ds.el - OPEN) / 6);
    }
    function umbralDe(ds, ps) { return ds.ph === 2 && gapOf(ps.x, ds.mask) >= 0 && ((ds.side === 0 && ps.y < RP + 4) || (ds.side === 1 && ps.y > FH - RP - 4)); }
    /* ── la multitud en vivo: sentados que se paran y bajan en oleada, andén que se apelotona y sube empujando, pasajeros parados (apretados, agarrados de la correa),
       el tapón de la puerta, el músico y el dormido. Todo sale de la hora suave `ks` y del calendario sembrado: se ve igual en todas las pantallas ── */
    function sm01(x) { x = cl(x, 0, 1); return x * x * (3 - 2 * x); }
    function angDe(dx, dz) { return Math.atan2(dx, dz); }
    function difAng(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
    function tapBits(st0) { var b = 0, j; if (st0) for (j = 0; j < st0.tap.length; j++) b |= 1 << st0.tap[j]; return b; }
    function animarMultitud(dt, t, kv, ds, ab, sv) {
      var V = v3, CR = V.CR, P, k, j, i, e, n3, sw = V.sw.a;
      if (Math.abs(kv - V.ks) > 8) V.ks = kv; else V.ks += dt * TK + (kv - V.ks) * Math.min(1, dt * 5);
      var kf = V.ks, dsf = doorAt(kf), os = dsf.side, olaV = olaOn(dsf), viaja = dsf.ph === 0 && !(dsf.side >= 0 && dsf.tTo < 8), mece = viaja ? 1 : .35;
      function cercano(x, z) { var bd = 1e9, bp = -1, q2; for (q2 = 0; q2 < n; q2++) { if (st.p[q2].sc) continue; var dx = V.pjs[q2].x - x, dz = V.pjs[q2].z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bp = q2; } } return bp < 0 ? null : { x: V.pjs[bp].x, z: V.pjs[bp].z, d: Math.sqrt(bd) }; }
      function mira(Pp, x, z, ry, tx, tz, lim) { var tg = 0; if (tx != null) tg = cl(difAng(angDe(tx - x, tz - z), ry), -lim, lim); Pp.hy += (tg - Pp.hy) * Math.min(1, dt * 5); return Pp.hy; }
      /* — los sentados — */
      var jc = dsf.ph >= 1 ? dsf.idx : dsf.idx - 1, stn = jc >= 0 && jc < stations.length ? stations[jc] : null, maskT = dsf.mask & ~tapBits(stn); if (!maskT) maskT = dsf.mask;
      for (k = 0; k < V.sentados.length; k++) {
        var s0 = V.sentados[k]; P = CR.pers[s0.id];
        var part = !!(stn && stn.ola && s0.vol && (s0.k + jc) % 3 !== 0), br = Math.sin(t * 1.9 + P.ph), pr = P.fl, cn = cercano(s0.x, s0.z);
        var o = { sit: 1, br: br, rx: sw * .22 + pr * -.25 * (s0.sd ? -1 : 1) * 0, rz: Math.sin(t * 1.3 + P.ph) * .04 * mece + 0, sq: 1 - pr * .1, splay: pr * .6, s: 1 };
        o.hy = mira(P, s0.x, s0.z, s0.ry, cn && cn.d < 9 ? cn.x : null, cn ? cn.z : 0, 1.0); o.hx = pr * -.3 + (k % 4 === 0 ? .25 : 0);
        var ux = s0.x / ESX + FW / 2, u0 = s0.sd === os ? 16 : FH - 16, el = dsf.el;
        if (part && dsf.ph === 1) { o.rx += .14 * sm01(1 - dsf.tTo); o.hx = -.15; o.splay = .12; o.hy = 0; }
        if (part && dsf.ph === 2 && jc === dsf.idx) {
          var tau = el - (OLA_T0 - 10 + s0.dl * .6);
          if (tau < 0) { o.rx += .16 * sm01((tau + 10) / 10); o.hx = -.2; o.rz += Math.sin(t * 6 + P.ph) * .03; }
          else {
            var up = sm01(tau / 8), xg = puertaDe(ux + (s0.dl - 5) * 2, maskT) + (s0.dl - 5) * 1.6, d = Math.max(0, tau - 8) * 4.0, ax2 = xg - ux, au = 0 - u0, L1 = Math.sqrt(ax2 * ax2 + au * au) || 1, uu, xx;
            var dd0 = Math.min(d, L1 + 90);
            if (dd0 < L1) { xx = ux + ax2 * dd0 / L1; uu = u0 + au * dd0 / L1; } else { xx = xg; uu = -(dd0 - L1); }
            var d1 = dd0 + 3, x1, u1; if (d1 < L1) { x1 = ux + ax2 * d1 / L1; u1 = u0 + au * d1 / L1; } else { x1 = xg; u1 = -(d1 - L1); }
            var seatU = s0.sd === os ? 0 : FH, uuu = uu, wx = (xx - FW / 2) * ESX + Math.sin(t * 9 + P.ph) * .1 * up, wy = os === 0 ? uuu : FH - uuu;
            if (tau < 8) { uuu = seatU + (u0 - seatU) * up; wy = os === 0 ? uuu : FH - uuu; wx = (ux - FW / 2) * ESX; }
            var ry = d > 0 ? angDe((x1 - xx) * ESX, (os === 0 ? (u1 - uu) : -(u1 - uu)) * ESZ) : s0.ry, fade = uu < -60 ? sm01((-uu - 60) / 25) : 0;
            var run = sm01((tau - 6) / 4);
            CR.pose(s0.id, wx, Math.abs(Math.sin(t * 12 + P.ph)) * .1 * run, WZ(wy), ry, { sit: 1 - up, w: t * 13 + P.ph, wa: run * 1.1, rx: .2 * run, rz: Math.sin(t * 9 + P.ph) * .12 * run, arm: .55 * run, splay: .3 * run, sq: 1 - (1 - run) * .08 * Math.sin(up * Math.PI), s: 1 - fade, br: br, hy: 0, hx: -.1 });
            if (V.dust <= 0 && run > .5 && (k % 3 === 0) && uu > -30) { V.part.soltar(wx, .08, WZ(wy), 2, { k: 'gota', cols: ['#cfc8b8'], vel: 1.2, arriba: .8, g: 5, vida: .5, esc: .7 }); }
            continue;
          }
        } else if (stn && stn.ola && s0.vol && (s0.k + jc) % 3 !== 0 && (dsf.ph === 0 || (dsf.ph === 2 && jc !== dsf.idx))) {   // ya se bajó en la última estación: el asiento queda vacío un rato y luego vuelve a ocupar (alguien sube y se sienta)
          var since = kf - (stn.t + WARN + OPEN + stn.ext), wait = 16 + s0.dl * 2.5;
          if (since < wait) { CR.oculta(s0.id); continue; }
          var pop = sm01((since - wait) / 10); o.s = pop; o.sq = 1 + (1 - pop) * .5 + Math.sin(pop * Math.PI) * .12;
        }
        if (olaV && dsf.ph === 2 && !part) { o.splay = .45; o.rx -= .12; o.hx = -.25; o.rz += Math.sin(t * 7 + P.ph) * .04; }
        var by = 0;
        CR.pose(s0.id, s0.x, by, s0.z, s0.ry, o);
      }
      V.dust = V.dust <= 0 ? .14 : V.dust - dt;
      /* — el andén — */
      for (var sd = 0; sd < 2; sd++) {
        var P3 = V.plats[sd], on = !!(ab && ab.sd === sd), sg = sd === 0 ? -1 : 1, phS = dsf.side === sd ? dsf.ph : 0, elS = phS === 2 ? dsf.el : 0;
        for (k = 0; k < P3.esperan.length; k++) {
          e = P3.esperan[k]; P = CR.pers[e.id];
          if (!on) { CR.oculta(e.id); continue; }
          var zE = sg * (ZIN + .5), tx = e.bx, tz = e.bz, pres = 0, bd = e.bd && phS === 2 && (stn ? stn.jam !== e.d : true);
          if (phS >= 1) { tx = WX(DOORS[e.d]) + e.jit * (1 + e.rk * .7); tz = sg * (ZIN + .55 + e.rk * .95); pres = phS === 2 ? 1 : .4; if (phS === 2 && e.rk === 0) { tx += (elS > 36 && elS < 66 ? (e.jit < 0 ? -1.3 : 1.3) : 0); tz += sg * (-.15 + Math.sin(t * 2.2 + P.ph) * .12); } }
          var bt = elS - (50 + (k % 4) * 3), bi = 0;
          if (bd && bt > 0) {                                                              // sube: de la puerta a un sitio del vagón (el vagón se lo traga)
            bi = 1; var dB = bt * NPC_V * ESX * 1.1, zin = sg * (ZIN - 1.2), z0 = sg * (ZIN + .55 + e.rk * .95), tot = Math.abs(zin - z0) + 1;
            tx = WX(DOORS[e.d]) + e.jit * .4; tz = z0 + (zin - z0) * Math.min(1, dB / Math.abs(zin - z0)); if (dB > tot + 1) { CR.oculta(e.id); continue; }
          }
          var spd = bi ? 4 : 2.4; e.cx += (tx - e.cx) * Math.min(1, dt * spd); e.cz += (tz - e.cz) * Math.min(1, dt * spd);
          var vx = (tx - e.cx), vz = (tz - e.cz), vm = Math.sqrt(vx * vx + vz * vz), mov = Math.min(1, vm * 1.5); var ryD = sd === 0 ? 0 : Math.PI; if (e.mv === undefined) e.mv = 0; if (vm > .3) e.mv = 1; else if (vm < .12) e.mv = 0; var ryE = e.mv ? angDe(vx, vz) : ryD;
          if (bi) ryE = angDe(0, -sg);
          var sw2 = Math.sin(t * 7 + P.ph);
          var oE = { w: t * (bi ? 13 : 9) + P.ph, wa: Math.min(1, mov + (bi ? .7 : 0)), br: Math.sin(t * 2 + P.ph), rz: Math.sin(t * 1.4 + P.ph) * .06 + pres * sw2 * .09, rx: pres * (.12 + .06 * sw2) + (bi ? .18 : 0), arm: (pres > .5 && e.rk < 2 ? .7 + .5 * sw2 : 0) + (bi ? .8 : 0), splay: pres * .2, hy: Math.sin(t * .6 + P.ph) * .5, hx: pres * -.1, sq: 1 - P.fl * .1 };
          CR.pose(e.id, e.cx + ab.off, (bi ? Math.abs(Math.sin(t * 13 + P.ph)) * .1 : 0), e.cz, ryE, oE);
        }
      }
      /* — pasajeros parados, que suben y que bajan, tapones, músico, dormido — */
      var cs = cuerpos(kf), NP = V.NP, sl, tapL = [];
      for (k = 0; k < NP.length; k++) if (NP[k].idx >= 0) { var hay = false; for (j = 0; j < cs.length; j++) if (cs[j].i === NP[k].idx) hay = true; if (!hay) NP[k].idx = -1; NP[k].used = false; }
      for (j = 0; j < cs.length; j++) {
        var ob = cs[j];
        if (ob.tap) {
          P = CR.pers[V.TAPS[ob.j]]; var xT = WX(ob.x), zT = WZ(ob.y), inw = os === 0 ? 1 : -1, pul = Math.max(0, Math.sin(t * 8 + ob.j * 2));
          var oT = ob.ph === 1 ? { rx: .22 + .2 * pul, rz: Math.sin(t * 5) * .05, splay: 1.15 + pul * .2, arm: .15 + pul * .5, hx: .1, hy: Math.sin(t * 3) * .5, br: Math.sin(t * 6), sq: 1 - pul * .04, w: 0, wa: 0 }
            : { w: t * 12, wa: 1, rx: .15, arm: .5, splay: .3, hx: 0, br: 0 };
          CR.pose(V.TAPS[ob.j], xT, ob.ph === 1 ? 0 : Math.abs(Math.sin(t * 12)) * .1, zT, ob.ph === 2 ? (inw > 0 ? Math.PI : 0) : (inw > 0 ? 0 : Math.PI), oT);
          if (ob.ph === 1) tapL.push({ x: xT, z: zT });
          continue;
        }
        if (ob.i === undefined) continue;
        sl = -1; for (k = 0; k < NP.length; k++) if (NP[k].idx === ob.i) { sl = k; break; }
        if (sl < 0) for (k = 0; k < NP.length; k++) if (NP[k].idx < 0) { sl = k; NP[k].idx = ob.i; break; }
        if (sl < 0) continue;
        var rec = NP[sl]; rec.used = true; P = CR.pers[rec.id]; var xN = WX(ob.x), zN = WZ(ob.y), mv = ob.mov > 0, brN = Math.sin(t * 2 + P.ph);
        rec.say = ob.mov === 2 && kf - pas[ob.i].tOut < 36; rec.x = ob.x; rec.y = ob.y;
        if (mv) {
          var up2 = ob.mov === 1, aN = angDe(ob.dx * ESX, ob.dy * ESZ);
          CR.pose(rec.id, xN, Math.abs(Math.sin(t * 12 + sl)) * .1, zN, aN, { w: t * 13 + sl, wa: 1.1, rx: up2 ? .22 : .12, arm: up2 ? 1.0 : .45, splay: up2 ? .35 : .5, br: brN, hx: -.05, rz: Math.sin(t * 8 + sl) * .08 });
        } else {
          var cnn = cercano(xN, zN), bra = olaV && dsf.ph === 2;
          mira(P, xN, zN, rec.ang, cnn ? cnn.x : null, cnn ? cnn.z : 0, 1.0);
          rec.ang += difAng(cnn && cnn.d < 8 ? angDe(cnn.x - xN, cnn.z - zN) : rec.ang, rec.ang) * Math.min(1, dt * 1.2);
          CR.pose(rec.id, xN, 0, zN, rec.ang, { up: !bra, br: brN, rx: sw * .3 + (bra ? -.2 : 0) + P.fl * .15, rz: Math.sin(t * 1.5 + sl) * .04 * mece + (bra ? Math.sin(t * 7 + sl) * .06 : 0), sq: 1 - P.fl * .08, splay: bra ? .55 : P.fl * .5, hy: P.hy, hx: bra ? -.2 : 0, w: t * 1.3, wa: 0, al: P.fl * -.8 });
        }
      }
      for (k = 0; k < NP.length; k++) if (!NP[k].used) { CR.oculta(NP[k].id); NP[k].used = false; }
      var tapUsed = [false, false];
      for (j = 0; j < cs.length; j++) if (cs[j].tap) tapUsed[cs[j].j] = true;
      for (k = 0; k < 2; k++) if (!tapUsed[k]) CR.oculta(V.TAPS[k]);
      V.tapL = tapL;
      var mu = musAt(kf), PM = CR.pers[V.mus];
      if (mu) {
        var dirM = mu.y < FH / 2 ? 0 : Math.PI, bu = mu.toca ? mu.u : 0, hit = Math.pow(1 - bu, 5), alt = Math.floor((kf - musPlay) / MUS_BEAT) % 2;
        CR.pose(V.mus, WX(mu.x), mu.toca ? Math.abs(Math.sin(t * 8)) * .06 + hit * .12 : Math.abs(Math.sin(t * 11)) * .1, WZ(mu.y), mu.toca ? 0 : dirM,
          mu.toca ? { rx: .12 + hit * .1, sq: 1 - hit * .08, hx: .15 - hit * .25, hy: Math.sin(t * 2) * .4, br: Math.sin(t * 8), al: -.9 - (alt ? hit * 1 : -bu * .5), ar: -.9 - (alt ? -bu * .5 : hit * 1), splay: .15, rz: Math.sin(t * 4) * .06, w: 0, wa: 0 }
            : { w: t * 12, wa: 1, rx: .1, arm: .3, br: 0 });
        V.tam.visible = !!mu.toca; if (mu.toca) { V.tam.position.set(WX(mu.x), 1.55, WZ(mu.y) + .72); V.tam.rotation.set(Math.PI / 2 + .25, 0, 0); V.tam.scale.setScalar(1 + hit * .15); }
        V.mRing.visible = V.mDisc.visible = !!mu.toca;
        if (mu.toca) { var rf = 1.5 - .5 * mu.u; V.mRing.scale.set(MUS_R * ESX * rf, MUS_R * ESX * 1.15 * rf, 1); V.mRing.material.opacity = .2 + .6 * mu.u; V.mDisc.scale.set(MUS_R * ESX, MUS_R * ESX * 1.15, 1); V.mRing.position.set(WX(mu.x), .05, WZ(mu.y)); V.mDisc.position.set(WX(mu.x), .04, WZ(mu.y)); }
      } else { CR.oculta(V.mus); V.tam.visible = V.mRing.visible = V.mDisc.visible = false; }
      var zq = zzAt(kf);
      if (zq) {
        var Pz = CR.pers[V.zzG], snore = Math.sin(t * 2.2);
        if (zq.ph === 1) CR.pose(V.zzG, WX(zq.x) - 1.5, .55, WZ(FH / 2), 0, { rz: -Math.PI / 2, br: snore * 1.6, hx: .2, sq: 1 + snore * .02, al: .3, ar: .3 });
        else if (zq.ph === 0) CR.pose(V.zzG, WX(zq.x), 0, (zz.sd === 0 ? -1 : 1) * (ZIN - 1), zz.sd === 0 ? 0 : Math.PI, { rx: .3 + Math.sin(t * 2) * .1, hx: .9 + snore * .1, dr: 1, br: snore, rz: Math.sin(t * 1.1) * .08, sit: 0 });
        else CR.pose(V.zzG, WX(zq.x), Math.abs(Math.sin(t * 12)) * .12, WZ(zq.y), angDe(zq.dx * ESX, zq.dy * ESZ), { w: t * 14, wa: 1.3, rx: .15, al: -2.6, ar: -2.6, splay: .5, br: 0, hx: -.2 });
        void Pz;
      } else CR.oculta(V.zzG);
      /* la oleada en el piso: banda naranja detrás del frente */
      V.olaB.visible = V.olaL.visible = olaV;
      if (olaV) {
        var yw = olaFrente(dsf), ya = cl(os === 0 ? yw : yw - OLA_W, 0, FH), yb = cl(os === 0 ? yw + OLA_W : yw, 0, FH), zA = WZ(ya), zB = WZ(yb);
        V.olaB.scale.set(V.LW - .4, Math.max(.01, zB - zA), 1); V.olaB.position.set((WX(0) + WX(FW)) / 2, .03, (zA + zB) / 2);
        V.olaB.material.opacity = .1 + .1 * Math.abs(Math.sin(t * 9));
        V.olaL.scale.set(V.LW - .4, .35, 1); V.olaL.position.set((WX(0) + WX(FW)) / 2, .035, WZ(cl(yw, 0, FH))); V.olaL.material.opacity = .55;
      }
      CR.fin(dt);
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, t = at, kv = kVista(), ds = doorAt(kv), fz = frzAt(kv), sv = sellerAt(kv), k, j, p, sd;
      var fin = (vivos() <= 1 && n > 1) || kv >= durT, viaja = ds.ph === 0 && ds.side >= -1 && !(ds.side >= 0 && ds.tTo < 8), ab = andenAt(kv);
      V.part.update(dt);
      /* el vagón se mece (más en marcha) y frena; las agarraderas lo siguen con resorte */
      var obj = ds.ph === 0 && ds.side >= 0 && ds.tTo < 40 ? .35 : (ab && ab.off < 0 ? -.25 : 0);
      V.sw.v += ((obj - V.sw.a) * 26 - V.sw.v * 3.2) * dt; V.sw.a += V.sw.v * dt;
      var mece = viaja ? 1 : .2;
      V.vag.rotation.x = Math.sin(t * 1.3) * .007 * mece + Math.sin(t * 3.1) * .003 * mece;
      V.vag.rotation.z = -V.sw.a * .03;
      V.vag.position.y = 0;
      for (k = 0; k < V.correas.length; k++) { var co = V.correas[k]; co.g.rotation.z = V.sw.a + Math.sin(t * 2.3 + co.f) * .05 * mece; co.g.rotation.x = Math.sin(t * 1.3 + co.f * .3) * .14 * mece; }
      if (lv === 3) for (k = 0; k < V.luces.length; k++) V.luces[k].material.emissiveIntensity = (k === 5 && Math.sin(t * 13) > .6 && Math.sin(t * .7) > .2) ? .2 : PAL3[3].tubo;   // un tubo que parpadea
      /* afuera: durmientes y lámparas corren con el tren */
      var off = drift * ESX;
      for (k = 0; k < V.durm.length; k++) { var u0 = (k % 32) * 2.2 - off; V.durm[k].position.x = ((u0 % 70.4) + 70.4) % 70.4 - 35.2; }
      for (k = 0; k < V.lamps.length; k++) { var u1 = k * 8 - off; V.lamps[k].position.x = ((u1 % 80) + 80) % 80 - 40; }
      /* el andén */
      for (sd = 0; sd < 2; sd++) {
        var P3 = V.plats[sd], on = !!(ab && ab.sd === sd);
        P3.g.visible = on;
        if (!on) continue;
        P3.g.position.x = ab.off;
        if (P3.idx !== ab.idx) { P3.idx = ab.idx; P3.mat.map = cartel(ab.idx); P3.mat.needsUpdate = true; }
      }
      /* puertas: aviso (luz roja que titila, flecha y piso rojo), abiertas (luz verde, flechas de la marea), cerradas */
      if (ds.ph !== V.ph) {
        if (ds.ph === 1) V.ding = t + .28;
        V.ph = ds.ph;
      }
      if (V.ding > 0 && t >= V.ding) { V.ding = -1; V3.sfx('ding'); }
      var blink = Math.floor(t * 8) % 2 === 0;
      for (sd = 0; sd < 2; sd++) {
        var warn = ds.ph === 1 && ds.side === sd, op2 = ds.ph === 2 && ds.side === sd;
        for (k = 0; k < V.puertas[sd].length; k++) {
          var pu = V.puertas[sd][k], o2 = abierta(ds, sd, k), des = o2 * pu.w / 2 * .92;
          pu.i.position.x = pu.x - pu.w / 4 - des; pu.d.position.x = pu.x + pu.w / 4 + des;
          var la = V.lamparas[sd][k];
          la.m.material.color.set(ds.jam === k && (warn || op2) ? (blink ? 0xff8a1f : 0x5a3a1a) : warn ? (blink ? 0xff3b4e : 0x5a2a2a) : op2 && o2 > 0 ? 0x4fd06a : 0x5a5a6a);
          la.f.visible = warn; if (warn) la.f.position.y = (sd === 0 ? 4.3 : 1.35) + .9 + Math.abs(Math.sin(t * 10)) * .25;
        }
        V.haz[sd].color.set(op2 ? 0xffd23f : 0xff3b4e);
        V.haz[sd].opacity = warn ? (blink ? .45 : .15) : op2 ? .22 : 0;
        for (k = 0; k < V.chev[sd].length; k++) {
          var cv = V.chev[sd][k], uu = ((t * 1.4 + cv.j * .5) % 1), sg5 = sd === 0 ? -1 : 1;
          cv.m.visible = op2 && enMask(ds.mask, cv.k); if (cv.m.visible) { cv.m.position.z = sg5 * (ZIN - 2.8 + uu * 2.4); cv.m.scale.set(1.4 * Math.sin(uu * Math.PI), 1, 1.2 * Math.sin(uu * Math.PI)); }
        }
      }
      /* frenazo: el piso titila en rojo y saltan chispas de las ruedas; al pegar, sacudida y todos se van de lado */
      V.rojo.opacity = fz && fz.d < FRZ_WARN ? .14 + .14 * Math.abs(Math.sin(t * 18)) : 0;
      if (fz && fz.d < FRZ_WARN) {
        V.chisT -= dt;
        if (V.chisT < 0) { V.chisT = .07; for (j = 0; j < 2; j++) V.part.soltar(WX(c.fx() * FW), -.3, (j ? 1 : -1) * (ZIN + .6), 3, { k: 'chispa', cols: ['#ffd23f', '#ff9a3c', '#fffdf2'], vel: 3, arriba: 3, g: 12, vida: .4, esc: .8 }); }
      }
      if (fz && fz.d >= FRZ_WARN && V.fzHit !== fz.j) {
        V.fzHit = fz.j; V.esc.sacudir(1); V3.sfx('choque'); V.sw.v += fz.sgn * 7;
        V.CR.flinch(0, 0, 60, 1); for (p = 0; p < n; p++) if (!st.p[p].sc) V.pjs[p].pj.impacto(fz.sgn, 0, 1.3);
      }
      /* el vendedor */
      if (V.vend) {
        V.vend.g.visible = !!sv;
        if (sv) {
          V.vend.g.position.set(WX(sv.x), 0, WZ(sv.y));
          V.vend.anim('caminar', { vel: .55 }).cara('feliz').rumbo(sv.dir > 0 ? Math.PI / 2 : -Math.PI / 2).update(dt);
          for (p = 0; p < n; p++) {
            var qv = st.p[p], pv = posOf(p), dvx = pv.x - sv.x, dvy = pv.y - sv.y, s5 = V.pjs[p];
            if (!qv.sc && dvx * dvx + dvy * dvy < (RP + SELL_R + 3) * (RP + SELL_R + 3) && t - s5.vendT > .7) {
              s5.vendT = t; s5.pj.impacto(WX(pv.x) - WX(sv.x), WZ(pv.y) - WZ(sv.y), .8); V3.sfx('pop');
              V.part.soltar(WX(pv.x), 2.2, WZ(pv.y), 10, { k: 'confeti', cols: CARAMELOS, vel: 3, arriba: 4, g: 10, vida: .8 });
            }
          }
        }
      }
      /* la luz: titila 0,7 s y se va (apagón); los aros de los jugadores se ven igual */
      var ap = apagonAt(kv), lt0 = !ap ? 1 : ap.warn ? (Math.floor(t * 14) % 2 ? 1 : .15) : .08;
      V.luz += (lt0 - V.luz) * Math.min(1, dt * (lt0 < V.luz ? 22 : 6));
      var lz = .1 + .9 * V.luz;
      V.esc.luces.hemi.intensity = V.hemi0 * lz; V.esc.luces.sol.intensity = V.sol0 * lz;
      for (k = 0; k < V.pts.length; k++) V.pts[k].intensity = 1.1 * V.luz;
      for (k = 0; k < V.luces.length; k++) V.luces[k].material.emissiveIntensity = (lv === 3 && k === 5 && Math.sin(t * 13) > .6 && Math.sin(t * .7) > .2 ? .2 : V.tubo0) * V.luz;
      if (faseK(kv) === 2 && !ap) V.vag.rotation.z += Math.sin(t * 6) * .004;
      /* tubos: amarillo libre · rojo ocupado */
      for (k = 0; k < V.tubosAg.length; k++) { var oc = false; for (j = 0; j < n; j++) if (!st.p[j].sc && st.p[j].ag === k + 1) oc = true; V.tubosAg[k].r.material.color.set(oc ? 0xff5c5c : 0xffd23f); V.tubosAg[k].r.material.opacity = oc ? .8 : .35 + .25 * Math.sin(t * 4 + k); }
      /* puesto libre sobre el banco */
      var se = seatAt(kv); V.puesto.visible = !!se && (se.left > 30 || Math.floor(t * 8) % 2 === 0);
      if (se) { var occ = false; for (j = 0; j < n; j++) if (st.p[j].ag === 5 && !st.p[j].sc) occ = true; V.puesto.visible = V.puesto.visible && !occ; V.puesto.position.set(WX(se.x), .82, (se.sd === 0 ? -1 : 1) * (ZIN - .42)); }
      /* freno de emergencia: la palanca brilla cuando está lista; la jalada se inclina */
      var bkk = brakeAt(kv), lib = frenoLibre(kv);
      for (k = 0; k < 2; k++) { var bb = V.brk[k]; bb.r.visible = lib; bb.r.scale.setScalar(1 + .15 * Math.sin(t * 6)); bb.h.material.color.set(lib ? 0xff3b4e : 0x6a6a74); bb.h.rotation.z = bkk && bkk.sgn === (k === 0 ? 1 : -1) ? (k === 0 ? -1 : 1) * .9 : 0; }
      animarMultitud(dt, t, kv, ds, ab, sv);
      /* los jugadores */
      var gano = vivos() === 1 && n > 1, tapsNow = V.tapL || [];
      for (p = 0; p < n; p++) {
        var q = st.p[p], s3 = V.pjs[p], pj = s3.pj;
        if (q.sc) {                                           // en el andén: sale rodando, se sienta y ve el tren irse (se va con el andén)
          if (!s3.fuera) {
            var dsx = doorAt(q.sc - 1);
            s3.fuera = { idx: dsx.idx, sd: q.y < 0 ? 0 : 1, x0: WX(q.x), t0: t };
            V.vag.remove(pj.g); V.esc.scene.add(pj.g); pj.g.position.set(WX(q.x), 0, WZ(q.y)); pj.volar(0, q.y < 0 ? -1 : 1, 1.1, { alcance: .55, suelo: 1.2 });
            s3.aro.visible = s3.cRing.visible = s3.cDisc.visible = false; for (j = 0; j < 3; j++) s3.est[j].visible = false;
          }
          var F = s3.fuera, enP = ab && ab.idx === F.idx && ab.sd === F.sd, uf = Math.min(1, (t - F.t0) / .6), sgF = F.sd === 0 ? -1 : 1;
          pj.g.visible = !!enP;
          if (!enP) continue;
          s3.x = F.x0 + Math.sin(p * 1.7) * 1.1 * uf + ab.off; s3.z = sgF * (ZIN + .3 + 2.2 * uf);
          pj.g.position.set(s3.x, 0, s3.z);
          pj.anim(pj.volando ? 'quieto' : 'sentado').cara(pj.volando ? 'susto' : 'triste').rumbo(F.sd === 0 ? 0 : Math.PI).update(dt);
          continue;
        }
        if (s3.fuera) { V.esc.scene.remove(pj.g); V.vag.add(pj.g); s3.fuera = null; pj.g.visible = true; s3.aro.visible = true; }
        var ps = posOf(p), tx = WX(ps.x), tz = WZ(ps.y), ty3 = 0;
        if (q.ag === 5 && se) { tz = (se.sd === 0 ? -1 : 1) * (ZIN - .55); ty3 = .72; }
        s3.x = tx; s3.z = tz;
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3), vz = (s3.z - s3.pz) / Math.max(dt, 1e-3), v = Math.sqrt(vx * vx + vz * vz); s3.px = s3.x; s3.pz = s3.z;
        var mine = p === c.yo, carga = q.wind > 0 ? (WIND - q.wind) / WIND : (mine && charge > 0 ? 1 - charge / (WIND / TK) : -1), fv = faceVec(q.face);
        var um = umbralDe(ds, ps);
        if (um && !s3.umbral) V3.sfx('resbalon');
        s3.umbral = um;
        if (q.cd > s3.cd + 4) { pj.uno('pegar'); s3.fireT = .2; V3.sfx('whoosh'); V.part.soltar(tx + fv.x * .9, 1.6, tz + fv.y * .9, 6, { k: 'chispa', cols: ['#fffdf2', '#ffd23f'], vel: 4, arriba: 1, g: 4, vida: .3, esc: .7 }); }
        s3.cd = q.cd;
        if (carga >= 0 || v < .8) s3.rumbo = Math.atan2(fv.x, fv.y * 1.15); else s3.rumbo = Math.atan2(vx, vz);
        var cerca = (ds.ph > 0 && ((ds.side === 0 && ps.y < MAREA_Y + 10) || (ds.side === 1 && ps.y > FH - MAREA_Y - 10)));
        var olp = q.ag ? 0 : cl(olaAt(ds, ps.y) / (OLA_F * 1.1), 0, 1), olAg = q.ag && olaOn(ds) ? 1 : 0, tpn = null, tpd = 99, rv = null, rd = 1e9, pq;
        for (j = 0; j < tapsNow.length; j++) { var tdx = tapsNow[j].x - tx, tdz = tapsNow[j].z - tz, td = Math.sqrt(tdx * tdx + tdz * tdz); if (td < tpd) { tpd = td; tpn = tapsNow[j]; } }
        for (pq = 0; pq < n; pq++) if (pq !== p && !st.p[pq].sc) { var rdx = V.pjs[pq].x - tx, rdz = V.pjs[pq].z - tz, rdd = rdx * rdx + rdz * rdz; if (rdd < rd) { rd = rdd; rv = V.pjs[pq]; } }
        s3.hitT = Math.max(0, s3.hitT - dt); s3.fireT = Math.max(0, s3.fireT - dt); s3.happy = Math.max(0, s3.happy - dt);
        if (olp > .1) s3.rumbo = ds.side === 0 ? 0 : Math.PI;
        if (fin) { if (!s3.fest) { s3.fest = true; pj.uno('festejo'); } pj.anim('celebrar').cara('feliz'); }
        else if (um) pj.anim('aire').cara('susto');
        else if (q.ag === 5) pj.anim('sentado').cara('feliz');
        else if (q.ag) pj.anim(olAg ? 'aire' : 'quieto').cara(olAg || q.ag2 > AG_MAX * .75 ? 'susto' : 'concentrado');
        else if (q.stun > 0) pj.anim(q.stun > STUN_HIT - 4 ? 'empujado' : 'mareado').cara(q.stun > STUN_HIT - 4 ? 'susto' : 'mareado');
        else if (carga >= 0) pj.anim(carga < .55 ? 'agacharse' : 'empujar', { vel: .5 }).cara('enojado');
        else if (olp > .1) pj.anim('empujado').cara('susto');
        else pj.anim(v > 3.5 ? 'correr' : v > .7 ? 'caminar' : 'quieto', { vel: Math.min(1, v / 6) }).cara(tpd < 3.4 ? 'enojado' : s3.happy > 0 ? 'feliz' : cerca ? 'susto' : 'concentrado');
        var mx = 0;
        if (tpn && tpd < 6) pj.mirarA({ x: tpn.x, y: 1.6, z: tpn.z }); else if (rv) pj.mirarA({ x: rv.x, y: 1.6, z: rv.z }); else pj.mirar(0, 0);
        pj.rumbo(um ? s3.rumbo + Math.sin(t * 26) * .45 : s3.rumbo).update(dt);
        pj.g.rotation.order = 'YXZ';                                                       // inclinaciones y aplastes encima de lo que pone el kit
        pj.g.rotation.x = (carga < 0 && !q.stun ? cl(v / 9, 0, 1) * .14 : 0) - olp * .3 - (carga >= 0 ? .22 * carga : 0) + (s3.fireT > 0 ? .25 * s3.fireT / .2 : 0) + (q.ag ? -.08 * olAg : 0);
        pj.g.rotation.z = olp > .1 ? Math.sin(t * 15 + p) * .1 * olp : 0;
        var sqz = carga >= 0 && s3.fireT <= 0 ? 1 - .12 * carga : s3.fireT > 0 ? 1 + .22 * s3.fireT / .2 : 1, hz = 1.3 * Math.sqrt(2 - sqz);
        pj.g.scale.set(hz, 1.3 * sqz, hz);
        if (v > 4 && !q.stun && !q.ag) { s3.dustT -= dt; if (s3.dustT <= 0) { s3.dustT = .13; V.part.soltar(tx, .08, tz, 1, { k: 'gota', cols: ['#cfc8b8'], vel: 1, arriba: .9, g: 5, vida: .45, esc: .8 }); } }
        pj.g.position.set(tx, ty3, tz);
        s3.aro.position.set(tx, .035 + ty3, tz);
        var cOn = carga >= 0;
        s3.cRing.visible = s3.cDisc.visible = cOn;
        if (cOn) { var rr1 = R_HIT * ESX * (1 - carga * .55); s3.cRing.scale.set(rr1, rr1 * 1.15, 1); s3.cDisc.scale.set(rr1, rr1 * 1.15, 1); s3.cRing.position.set(tx, .045, tz); s3.cDisc.position.set(tx, .04, tz); s3.cDisc.material.opacity = .1 + .2 * carga; }
        var eOn = q.stun > 0 && !um;
        for (j = 0; j < 3; j++) { s3.est[j].visible = eOn; if (eOn) { var ang = t * 8 + j * 2.1; s3.est[j].position.set(tx + Math.cos(ang) * .8, 3.9 + Math.sin(ang * 1.3) * .1, tz + Math.sin(ang) * .6); s3.est[j].rotation.y = t * 6; } }
        if (gano && fin && Math.floor(t * 6) !== Math.floor((t - dt) * 6)) V.part.soltar(tx, 4, tz, 3, { k: 'confeti', cols: ['#ffd23f', '#ff5c8a', '#5cb8ff', '#fffdf2'], vel: 2.5, arriba: 3, g: 4, vida: 1.6 });
      }
      var yo = c.yo >= 0 && c.yo < n && !st.p[c.yo].sc ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.x, 4.3 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      /* cámara: el vagón entero, corrida un poco hacia el lado que se abre */
      var cz = ds.ph > 0 ? (ds.side === 0 ? .4 : 2.2) : 1.2;
      V.cam.z += (cz - V.cam.z) * Math.min(1, dt * 1.5);
      V.esc.encuadrar(V.LW + 1, 16, new T.Vector3(0, 1.2, V.cam.z), .9);
    }
    function sobre3(x, y, h) { return v3 ? v3.esc.proyectar(WX(x), h, WZ(y)) : scr(lay(), x, y); }
    function golpe3D(pp, ps, mio) {                          // el empujón le pega a alguien: chispas, ¡PUM! y sacudida
      if (!v3) return;
      var qa = st.p[pp], at = qa.lh > 0 ? posOf(qa.lh - 1) : null, fd = faceVec(qa.face), idx = at ? WX(ps.x) - WX(at.x) : fd.x, idz = at ? WZ(ps.y) - WZ(at.y) : fd.y;
      v3.pjs[pp].pj.impacto(idx, idz, 1.7); v3.CR.flinch(WX(ps.x), WZ(ps.y), 4.5, 1);
      v3.part.soltar(WX(ps.x), 2.2, WZ(ps.y), 16, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff9a3c'], vel: 5, arriba: 3, g: 8, vida: .45 });
      v3.esc.sacudir(mio ? .8 : .45);
    }
    function marcador3D() {                                  // letrero del vagón, aviso grande y la voz del inicio (2D encima del 3D)
      var l = lay(), f = l.f, cx = l.cx, kv = kVista(), ds = doorAt(kv), sy0 = 74;
      rr(cx - 130, sy0, 260, 46, 10, '#14101c', 3);
      var lbl = ds.ph === 2 ? 'PUERTAS ABIERTAS ' + (ds.side === 0 ? '▲' : '▼') : ds.ph === 1 ? '¡SE ABREN ' + (ds.side === 0 ? 'ALLÁ ▲' : 'ACÁ ▼') + '!' : ds.side >= 0 ? 'PRÓXIMA: ' + estacion(ds.idx) : 'FIN DE LA LÍNEA';
      txt(lbl, cx, sy0 + 15, ds.ph === 2 ? 14 : 12, ds.ph === 2 ? '#4fd06a' : ds.ph === 1 ? '#ffd23f' : '#ff9a3c', 0, true);
      var rest = Math.max(0, Math.ceil((durT - kv) / TK));
      txt('EN EL VAGÓN: ' + vivos() + ' · ' + rest + ' s', cx, sy0 + 34, 11, '#fffdf2', 0, true);
      var fk = faseK(kv); if (fk > 0) txt(FASE_TXT[fk][0], cx, sy0 + 52, 11 + (fk === 2 ? Math.sin(at * 10) : 0), FASE_TXT[fk][2], 0, true);
      if (bannerT > 0 && banner) { var pz = 1 + Math.sin(at * 16) * 0.05; txt(banner.s, cx, 250, Math.min(30, 0.92 * (f.x1 - f.x0) / (0.8 * banner.s.length + 1)) * pz, banner.col, 0, true); }
      if (c.ahora() >= -0.4 && c.ahora() < 2.6) txt('¡Sácalos pa\'l andén! A: empujón · contra un tubo: agárrate', cx, 300, Math.min(15, 0.92 * (f.x1 - f.x0) / 30), '#fffdf2', 0, true);
    }
    function dibujar3D() {
      var dt = Math.max(0, Math.min(.05, v3T ? at - v3T : 1 / 60)), now = c.ahora(), k, pt; v3T = at;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !(vivos() <= 1 && n > 1)) V3.musica('vagon');
      v3.esc.render(dt);
      var kv = kVista(), sv = sellerAt(kv);
      for (k = 0; k < n; k++) {
        var q = st.p[k], s3 = v3.pjs[k];
        if (q.sc) { if (s3.fuera && s3.pj.g.visible && at - s3.fuera.t0 > .6) { pt = v3.esc.proyectar(s3.x, 3.4, s3.z); txt('¡ESPÉRENME!', pt.x, pt.y, 11, '#fffdf2', 0, true); } continue; }
        pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.3);
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        var carga = q.wind > 0 || (k === c.yo && charge > 0);
        if (carga) { pt = v3.esc.proyectar(s3.x, 4.4, s3.z); txt('!', pt.x, pt.y, 24, '#ffd23f', 0, true); }
        else if (s3.umbral) { pt = v3.esc.proyectar(s3.x, 4.2, s3.z); txt('¡AY, AY!', pt.x, pt.y, 12, '#fffdf2', 0, true); }
      }
      for (k = 0; k < fx.length; k++) { var fq = fx[k]; pt = v3.esc.proyectar(WX(fq.x), 3.6 + fq.t * 2.5, WZ(fq.y)); txt('¡PUM!', pt.x, pt.y, 18 + fq.t * 10, '#ffd23f', 0, true); }
      if (sv) { pt = v3.esc.proyectar(WX(sv.x), 4.3, WZ(sv.y)); txt('¡CARAMELOS!', pt.x, pt.y, 11, '#fffdf2', 0, true); }
      for (k = 0; k < v3.NP.length; k++) if (v3.NP[k].idx >= 0 && v3.NP[k].say) { pt = v3.esc.proyectar(WX(v3.NP[k].x), 4.2, WZ(v3.NP[k].y)); txt('¡PERMISO!', pt.x, pt.y, 10, '#fffdf2', 0, true); }
      var tl = v3.tapL || [];
      for (k = 0; k < tl.length; k++) { pt = v3.esc.proyectar(tl[k].x, 4.5, tl[k].z); txt(k ? '¡ESPERE, ESPERE!' : '¡NO EMPUJEN!', pt.x, pt.y, 11, '#ffd23f', 0, true); }
      var zq = zzAt(kv);
      if (zq) { pt = v3.esc.proyectar(WX(zq.x), 3.4 + Math.sin(at * 3) * .2, WZ(zq.y)); txt(zq.ph === 2 ? '¡AY, MI PARADA!' : 'Z z z…', pt.x, pt.y, zq.ph === 2 ? 11 : 13, '#9ad0ff', 0, true); }
      for (k = 0; k < n; k++) {                                                          // cuánto aguanta el agarrado antes de que se le resbale la mano
        var qa = st.p[k]; if (!qa.ag || qa.sc) continue;
        var fr = 1 - qa.ag2 / (qa.ag === 5 ? SEAT_MAX : AG_MAX); pt = v3.esc.proyectar(v3.pjs[k].x, 4.9, v3.pjs[k].z);
        rr(pt.x - 17, pt.y, 34, 7, 3, '#14101c', 2); rr(pt.x - 15, pt.y + 2, Math.max(1, 30 * fr), 3, 1, fr < .3 ? '#ff3b4e' : '#4fd06a', 0);
      }
      marcador3D();
    }

    function draw() {
      if (PX) return drawPx();
      if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
      if (v3) return dibujar3D();
      dibujar2D();
    }
    function extras2D(kv) {                                                               // tubos, puesto libre, palancas, pasajeros, músico y dormido (2D de respaldo)
      var k, o, cs = cuerpos(kv), se = seatAt(kv), zq = zzAt(kv), mu = musAt(kv), col;
      for (k = 0; k < POLES.length; k++) { ell(POLES[k][0], POLES[k][1] + 4, POLE_R + 3, 4, INK, 0); ell(POLES[k][0], POLES[k][1], POLE_R, POLE_R, '#e8e8f0', 2.5); }
      if (se) rr(se.x - 18, se.sd === 0 ? 3 : FH - 15, 36, 12, 3, '#ffd23f', 2);
      var dsO = doorAt(kv); if (olaOn(dsO)) { var yO = olaFrente(dsO), yA = cl(dsO.side === 0 ? yO : yO - OLA_W, 0, FH), yB = cl(dsO.side === 0 ? yO + OLA_W : yO, 0, FH); ctx.save(); ctx.globalAlpha = .2; rr(0, yA, FW, Math.max(1, yB - yA), 0, '#ff8a3c', 0); ctx.restore(); rr(0, cl(yO, 0, FH) - 2, FW, 4, 0, '#fff0a0', 0); }
      var lib = frenoLibre(kv); rr(2, FH / 2 - 10, 8, 20, 2, lib ? '#ff3b4e' : '#6a6a74', 2); rr(FW - 10, FH / 2 - 10, 8, 20, 2, lib ? '#ff3b4e' : '#6a6a74', 2);
      if (mu && mu.toca) { ctx.save(); ctx.globalAlpha = .15 + .4 * mu.u; ell(mu.x, mu.y + 4, MUS_R * (1.4 - .4 * mu.u), MUS_R * .55 * (1.4 - .4 * mu.u), '#ffd23f', 0); ctx.restore(); }
      if (zq && zq.ph === 1) { rr(zq.x - ZZ_L, FH / 2 - 10, ZZ_L * 2, 20, 9, '#4a6a8a', 3); txt('Z z z', zq.x, FH / 2 - 22, 12, '#9ad0ff', 0, true); }
      for (k = 0; k < cs.length; k++) { o = cs[k]; col = o.mus ? '#ffb43a' : o.zz ? '#4a6a8a' : pal.gente[(o.i || 0) % 4]; ell(o.x, o.y + 4, NPC_R + 3, 9, INK, 0); ell(o.x, o.y, NPC_R, 10, col, 3); ell(o.x, o.y - 18, 8, 8, '#e0a878', 2.5); }
      if (mu && !mu.toca) { ell(mu.x, mu.y + 4, NPC_R + 3, 9, INK, 0); ell(mu.x, mu.y, NPC_R, 10, '#ffb43a', 3); ell(mu.x, mu.y - 18, 8, 8, '#e0a878', 2.5); }
      if (zq && zq.ph === 0) { ell(zq.x, zq.y, NPC_R, 10, '#4a6a8a', 3); txt('Z z z', zq.x, zq.y - 24, 12, '#9ad0ff', 0, true); }
    }
    function dibujar2D() {                                                                // el 2D de siempre (sin WebGL o con ?plano=1)
      var l = lay(), f = l.f, j, kv = kVista(), ds = doorAt(kv), sv = sellerAt(kv), fz = frzAt(kv);
      var sx = Math.sin(at * 90) * shake * 4, sy = Math.cos(at * 77) * shake * 3;
      ctx.save(); ctx.translate(sx, sy);
      fondo(l);
      ctx.save(); ctx.translate(l.cx, l.cy); ctx.scale(l.z, l.z); ctx.translate(-FW / 2, -FH / 2);
      if (ds.ph > 0) anden(ds.side, ds.ph, ds.idx);
      vagon(ds);
      if (fz && fz.d < FRZ_WARN) { ctx.save(); ctx.globalAlpha = 0.18 + 0.15 * Math.abs(Math.sin(at * 18)); rr(0, 0, FW, FH, 6, '#ff3b4e', 0); ctx.restore(); poly(fz.sgn > 0 ? [[FW / 2 + 60, FH / 2 - 52], [FW / 2 + 84, FH / 2 - 40], [FW / 2 + 60, FH / 2 - 28]] : [[FW / 2 - 60, FH / 2 - 52], [FW / 2 - 84, FH / 2 - 40], [FW / 2 - 60, FH / 2 - 28]], '#ffd23f', 3); }
      extras2D(kv);
      for (j = 0; j < n; j++) if (st.p[j].sc) fuera(j, kv);
      var ord = []; for (j = 0; j < n; j++) if (!st.p[j].sc) ord.push(j);
      ord.sort(function (a, b) { return posOf(a).y - posOf(b).y || a - b; });
      var sdone = false;
      for (j = 0; j < ord.length; j++) { if (!sdone && sv && posOf(ord[j]).y > sv.y) { vendedor(sv); sdone = true; } persona(ord[j], l, ds); }
      if (!sdone) vendedor(sv);
      for (j = 0; j < fx.length; j++) { var fq = fx[j]; ctx.save(); ctx.globalAlpha = 1 - fq.t / 0.45; ell(fq.x, fq.y, 14 + fq.t * 120, 8 + fq.t * 60, '#fffdf2', 0); ctx.restore(); txt('¡PUM!', fq.x, fq.y - 60 - fq.t * 30, 18, '#ffd23f', 0, true); }
      if (apagonAt(kv)) { var ap2 = apagonAt(kv); ctx.save(); ctx.globalAlpha = ap2.warn ? (Math.floor(at * 14) % 2 ? .1 : .6) : .6; rr(-16, -16, FW + 32, FH + 32, 6, '#05050f', 0); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      /* letrero del vagón: próxima estación / puertas · vivos · tiempo */
      var cx = l.cx, top = scr(l, 0, -86).y, sy0 = Math.max(92, top - 52);
      rr(cx - 120, sy0, 240, 44, 10, '#14101c', 3);
      var lbl = ds.ph === 2 ? 'PUERTAS ABIERTAS ' + (ds.side === 0 ? '▲' : '▼') : ds.ph === 1 ? 'PRÓXIMA: ' + estacion(ds.idx) : ds.side >= 0 ? 'PRÓXIMA: ' + estacion(ds.idx) : 'FIN DE LA LÍNEA';
      txt(lbl, cx, sy0 + 14, ds.ph === 2 ? 14 : 12, ds.ph === 2 ? '#4fd06a' : ds.ph === 1 ? '#ffd23f' : '#ff9a3c', 0, true);
      var rest = Math.max(0, Math.ceil((durT - kv) / TK));
      txt('EN EL VAGÓN: ' + vivos() + ' · ' + rest + ' s', cx, sy0 + 33, 11, '#fffdf2', 0, true);
      if (bannerT > 0 && banner) { var pz = 1 + Math.sin(at * 16) * 0.05; txt(banner.s, cx, l.cy - 18 * l.z, Math.min(30, 0.92 * (f.x1 - f.x0) / (0.8 * banner.s.length + 1)) * pz, banner.col, 0, true); }
      if (c.ahora() >= -0.4 && c.ahora() < 2.4) txt('Señores pasajeros, disculpen que los moleste…', cx, l.cy + 40 * l.z, Math.min(15, 0.92 * (f.x1 - f.x0) / 28), '#fffdf2', 0, true);
      if (typeof drawP === 'function') drawP();
    }

    function sacador() { var j, bj = -1, bv = 0; for (j = 0; j < n; j++) if (st.p[j].ko > bv) { bv = st.p[j].ko; bj = j; } return bj; }
    return {
      update: update, draw: draw, ai: ai,
      step: step, pack: pack, unpack: load, restore: load, lerp: lerp, predict: predict,
      scores: function () { var a = [], j; for (j = 0; j < n; j++) a.push(st.p[j].sc ? st.p[j].sc : durT + 1); return a; },
      done: function () { return vivos() <= 1; },
      vivo: function (pp) { return vivoP(pp); },
      alCpu: function () {}, alHum: function () {},
      hudChip: function (pp) { return st.p[pp].sc ? 'ANDÉN' : null; },
      destacado: function () {
        var b = sacador(), v = vivos();
        if (b >= 0) return asiento(b).name + ' sacó a ' + st.p[b].ko + ' pa\'l andén';
        if (v === n) return 'nadie se bajó: ¡ni con vaselina!';
        return 'el Metro no perdona';
      },
      vista: function () {
        var o = { k: st.k, durT: durT, lv: lv, golpes: st.golpes, stations: stations.map(function (s) { return { t: s.t, side: s.side }; }), frz: frz.map(function (z) { return { t: z.t, sgn: z.sgn }; }),
          sellT: sellT, seller: sellerAt(st.k), door: doorAt(st.k), fj: fjT, fjObj: fjObj, vivos: vivos(), lag: lagEst < 0 ? -1 : lagEst, mp: mp ? { x: mp.x, y: mp.y } : null,
          x: [], y: [], vx: [], vy: [], stun: [], wind: [], cd: [], face: [], sc: [], ko: [], lh: [], lt: [] }, j;
        for (j = 0; j < n; j++) { var q = st.p[j]; o.x.push(q.x); o.y.push(q.y); o.vx.push(q.vx); o.vy.push(q.vy); o.stun.push(q.stun); o.wind.push(q.wind); o.cd.push(q.cd); o.face.push(q.face); o.sc.push(q.sc); o.ko.push(q.ko); o.lh.push(q.lh); o.lt.push(q.lt); }
        return o;
      }
    };
  }
});
})();
