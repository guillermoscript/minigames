'use strict';
/* LA FIESTA · EN VIVO · f_alcabala · ¡LA ALCABALA DE MEDIANOCHE!  (1v3, modelo B: dueño + juez)   ficha: docs/mario-party/08-minijuegos-realtime.md §"23. f_alcabala"
   De noche por la nacional. El SOLO es el guardia de la alcabala (linterna, conos, caseta) y el TRÍO tiene que pasar la raya con su «bulto» (las hallacas)
   sin que lo paren. Es de SIGILO y control del paso (no de esquivar proyectiles como la patilla): se gana esperando el momento, escondiéndose y cruzando.

   REGLAS (qué hace A y cuándo «pasa» / «lo paran»)
   - SOLO. Stick: mueve el PUNTO DE MIRA (la cruz) y la LINTERNA lo sigue 0,45 s después (el guardia no se mueve de su caseta). A: «¡ALTO!»: un destello ancho que cae donde está el punto de mira.
     Se ANUNCIA 0,55 s antes (aro rojo que crece y silbato: da tiempo a correr o esconderse, incluso a 300 ms de latencia) y dura 0,35 s; enfriamiento 4 s.
   - TRÍO. Stick: caminar. A (mantener): AGACHARSE: va a 45 % de la velocidad, y si además tiene un cono o un matorral pegado queda ESCONDIDO: la luz y el destello no lo ven.
   - Lo PARAN (la víctima decide, modelo B): (a) la luz lo cubre 0,5 s seguidos (el medidor sube con luz y baja al doble de rápido sin ella), (b) lo pilla un destello
     de ¡ALTO! sin estar escondido, (c) nivel 3: lo toca el perro rastreador. Cada dueño juzga SU cuerpo contra la luz que recibe (`remoto()` del solo) con un radio 6 px
     más chico que el dibujado («favorecer al que se esconde»: a 300 ms nadie debe ser parado por una luz que ya se fue) y manda ev `para {n}`. Parado = 1 s quieto y
     vuelve al inicio (los demás siguen).
   - PASA al cruzar la raya (y <= LINE_Y): ev `paso`. Ya pasó, ya no lo paran.
   - Veredicto binario: el trío gana si PASAN >= 2 (si no, gana el solo). Puntaje aditivo/comparable (M3 DM3-3) como f_patilla: solo = 10 por cada miembro que NO pasó,
     cada miembro del trío = 15 fijo (U·W − U/2 con U=10, W=2): gana el solo ⇔ pasaron <= 1, sin empates posibles. El veredicto lo da SOLO compara().
   Red (B, DETERMINISTA). Nada continuo viaja por `o` para juzgar: la LUZ se mueve por muestras `xluz {x, y, tl}` (tl = hora de partida en que la luz llega a ese punto = ahora + LEAD 0,45 s,
   ~5 por segundo, último gana) y todas las pantallas, la del solo incluida, la posicionan al reloj de partida: la luz de cada pantalla es la MISMA aunque lleguen tarde (probado: a 150 ms
   por HTTP el cuerpo `o` llegaba ~0,5-1 s tarde y nadie era parado). El solo ve además su «punto de mira» (la cruz), que va a la velocidad del stick; la luz lo sigue LEAD s después.
   El destello es igual de determinista: `xalto {i, x, y, tl}`; si dos pantallas lo sueltan a la vez gana el que cae primero (menor tl; empate: menor x), como f_patilla; el enfriamiento sale
   de los destellos recibidos (sobrevive a un cambio de juez) y el dueño reenvía los suyos un par de veces (si el enlace se cae justo entonces). Eventos: `para {n}` (n = cuenta acumulativa
   del dueño: idempotente) y `paso`. Cada miembro del trío juzga SU cuerpo contra esa luz y emite su propio `para`/`paso` (modelo B). Si el solo es CPU (o está caído) el juez corre su `ai`.
   El nivel (conos, matorrales, pasos, perro) sale de c.rng en mk(): idéntico en todas las pantallas. Calle lógica 440×300 idéntica en todas (la física no depende del dispositivo);
   al dibujar se encoge k<1 si el campo visible es más estrecho (vertical).
   PERILLA de balance del solo (objetivo 38-52 % de victorias del solo con 4 CPU de igual habilidad): el control que mueve el balance con continuidad es PERILLA.SPD, la velocidad de caminar del trío
   (por nivel; el radio de la luz RL casi no lo mueve porque la CPU del trío se aparta en proporción a él). Valores elegidos SPD = [60, 59, 63] px/s con RL = 56·RK[1.12, 1.1, 1.06], CATCH 0,5 s,
   FK 1,55, CD 4 s, LS 165 px/s, LEAD 0,45 s, pasos a ±(GS + 0..30) px del centro con GS = [47, 42, 54]. MEDIDO con docs/style-lab/pruebas/fiesta-alcabala-bench.js (4 CPU skill .6, 200 semillas,
   veredicto por compara): bloque 1-200: solo gana lv1 47 % · lv2 44 % · lv3 41 %; en otros tres bloques de 200: 39,5-48,5 % (las 12 celdas dentro de 38-52). Con skill .35 y .85 sigue en 33-56 %
   (informativo). Lo que define «igual habilidad» (reacción, error de apuntado, lapsos) vive en `ai` y NO se toca una vez medido. Sobre el stack real (--red) el solo rinde menos: ver el informe.
   Niveles: 1 calle con 9 escondites · 2 terreno más abierto (6) y la luz más ancha · 3 igual de abierto + el perro rastreador patrulla la raya.
   Sin Math.random / Date.now: azar de c.rng (nivel) o c.rngFor('cpu'+p) (CPU); lo cosmético de c.fx(). Solo rr / ell / line / poly / txt y c.util.pj.

   LA NOCHE SE COMPLICA (escalada, por fracción de dur: escala igual a 10 o a 40 s). Fase 1 (0-35 %) tranquila: ¡ALTO! cada 4 s. Fase 2 «¡SE ALBOROTÓ LA ALCABALA!»
   (35-70 %): ¡ALTO! cada 3,2 s, más carros, la mira más rápida. Fase 3 «¡ÚLTIMOS SEGUNDOS!» (70-100 %): ¡ALTO! cada 2,5 s, carros seguiditos, aguacero, sirena loca,
   música más rápida y SUELTAN AL PERRO (niveles 1-2; en el 3 el perro corre más). Cartel + sacudida en cada cambio de fase.
   LO QUE PASA EN LA ALCABALA (todo programado en mk() desde c.rng: igual en todas las pantallas; cada uno se avisa ~1 s antes con cartel, sonido y efecto 3D):
   - CARROS A LA REVISIÓN: suben por uno de los pasos, se paran 2,2 s frente a la alcabala («REVISIÓN») y siguen. Son ESCONDITE QUE SE MUEVE: agachado pegado al carro
     = escondido (y no se atraviesan: empujan de lado). La decisión: colarse detrás del carro a su paso o esperar el siguiente.
   - LA GANDOLA: cruza la calle de lado a lado; su SOMBRA (la franja detrás de ella, del lado contrario a la caseta) tapa la luz y el ¡ALTO! aunque estés de pie. Si te agarra
     de frente, te empuja.
   - ¡SE VA LA LUZ! (apagón del poste): unos segundos la linterna alumbra un círculo más chico y el reflector del ¡ALTO! no prende: ventana para correr.
   - NEBLINA: la linterna tarda más en reconocerte (el medidor llena 1,6 veces más lento).
   Los cuerpos siguen igual (nada nuevo viaja por la red): los eventos salen de la semilla y el reloj de partida; cada dueño juzga su cuerpo contra ellos. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_alcabala')) return;

/* ───── la perilla (única) y las constantes del juego ───── */
/* MEDIDO (banco, 4 CPU skill .6, 200 semillas, veredicto por compara): ver «MEDIDO_FIN» al final de este bloque de comentario. */
var PERILLA = { RL: 56, RK: [1.12, 1.1, 1.06], FK: 1.55, CD: 4, CATCH: 0.5, LS: 240, STUN: 1.0, LEAD: 0.28, SPD: [72, 72, 77], GS: [47, 42, 54] };      // RL radio de la luz (px de la calle lógica); RK por nivel
var SW = 440, SH = 300, LINE_Y = 58, START_Y = 262, Y_MIN = 30, SPD_AG = 0.45, DECAY = 1.3;
var WIND = 0.55, FT = 0.35, FIRST = 3, MAXF = 18, NEED = 2, PTS = 10, BODY_R = 12, COVER_PAD = 12, MARG_JUEZ = 6, CELEBRA = 0.9, GRACIA_CPU = 1.3;
var BAR = LINE_Y + 16, GW = 66, YE = 1.2, DOGW = 0.55, DOGR = 22, INK = '#14101c';
/* la escalada y los eventos (ver «LA NOCHE SE COMPLICA» arriba) */
var ESC = { FASE: [0.35, 0.7], CD: [4, 3.2, 2.5], LSK: [1, 1.12, 1.25], PERRO: 1.4, APAG: 0.62, NIEB: 1.6, AV: 0.9 };
var CAR = { V1: 30, V2: 55, REV: 2.2, HW: 17, HH: 32, Y0: SH + 40, YST: BAR + 46, MIN: 7, CADA: [6.5, 4.6, 3.3], VAR: [2, 1.4, 1], TAPA: 22, YFIN: -200 };
var GAN = { V: 80, L: 180, HH: 16, SOM: 64 };
var BANNER = 1.9;
var PAL = {
  1: { cielo: '#2c2a5c', cielo2: '#7a4a7a', calle: '#4a4864', acera: '#7c7694', raya: '#d8d2a8', suelo2: '#3a3a58', luna: '#f6ecc0' },
  2: { cielo: '#12102c', cielo2: '#2a2752', calle: '#35334e', acera: '#5c5878', raya: '#b8b4d0', suelo2: '#2c2a46', luna: '#fff6c8' },
  3: { cielo: '#08071a', cielo2: '#191638', calle: '#27253c', acera: '#46425e', raya: '#908cae', suelo2: '#1d1b32', luna: '#e8e4c8' }
};
var GRITOS_PARA = ['¡ALTO AHÍ!', '¡A LA ORILLA!', '¡PARE, CIUDADANO!', '¡DOCUMENTOS!'];
var GRITOS_PASO = ['¡PROSIGA, MI PANA!', '¡CÓLATE, PUES!', '¡PASÓ!'];
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function dE(ax, ay, bx, by) { var dx = ax - bx, dy = (ay - by) * YE; return Math.sqrt(dx * dx + dy * dy); }   // distancia con la calle en perspectiva (círculos del suelo = elipses)

FIESTA.LIVE.add('f_alcabala', {
  name: '¡LA ALCABALA DE MEDIANOCHE!', modos: ['1v3'], clase: 'binary', modelo: 'B', dur: 40,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 30, scoreRate: 8, minT: 5, finTemprano: 1 },
  cuerpo: ['x', 'y', 'ag', 'st', 'ps'], discretos: ['ag', 'st', 'ps'],
  perilla: PERILLA,
  carta: {
    obj: 'El solo: la linterna no deja pasar a nadie. El trío: ¡pasen la raya con el bulto!',
    gana: 'El trío gana si 2 o más cruzan la raya. Si no, gana el solo.',
    como: { tactil: 'Joystick · A = ¡ALTO! (solo) / agacharse (trío, mantén)', teclado: 'WASD o flechas · ESPACIO' },
    roles: {
      solo: {
        obj: '¡TÚ CONTRA TODOS! Mueve la linterna y no dejes pasar a 2 del trío.',
        como: { tactil: 'Joystick: mover el mira (la luz lo sigue) · A: ¡ALTO! (tarda 0,5 s)', teclado: 'WASD mover el mira · ESPACIO ¡ALTO!' },
        demos: [{ id: 'mover', txt: 'Mueve la luz: 0,5 s encima y los paras' }, { id: 'robar', txt: 'A anuncia el ¡ALTO!: aro rojo y destello, cada 4 s' }]
      },
      trio: {
        obj: 'Cruza la raya sin que te vea la linterna. Agáchate tras un cono o un matorral.',
        como: { tactil: 'Joystick: caminar · mantén A: agacharte (lento)', teclado: 'WASD o flechas · mantén ESPACIO' },
        demos: [{ id: 'mover', txt: 'Avanza cuando la luz esté lejos' }, { id: 'saltar', txt: 'Mantén A junto a un cono: la luz no te ve' }]
      }
    },
    demos: [
      { id: 'mover', txt: 'La luz del guardia te para si te cubre 0,5 s' },
      { id: 'saltar', txt: 'Agáchate junto a un cono o matorral para esconderte' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv];
    var SPD = PERILLA.SPD[lv - 1];                           // velocidad de caminar del trío (px/s): el control más fino del balance
    var soloI = c.solo >= 0 && c.solo < n ? c.solo : 0;
    var R = PERILLA.RL * PERILLA.RK[lv - 1], RF = R * PERILLA.FK, CATCH = PERILLA.CATCH, CD = PERILLA.CD;
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };
    var trio = [], slot = [], P = [], i;
    for (i = 0; i < n; i++) { if (i === soloI) slot.push(-1); else { slot.push(trio.length); trio.push(i); } }
    var nt = Math.max(1, trio.length), need = Math.min(NEED, nt), W = nt - need + 1;
    var homeX = function (p) { return SW * (0.2 + 0.6 * ((slot[p] + 1) / (nt + 1))); };
    for (i = 0; i < n; i++) P.push({ x: i === soloI ? SW / 2 : homeX(i), y: i === soloI ? 170 : START_Y, ax: SW / 2, ay: 170, lastS: -9, px: 0, vx: 0, vy: 0, ag: 0, ex: 0, stun: -9, ps: 0, nPar: 0, remAg: 0, remSt: 0, remPs: 0, nextF: FIRST, grace: -1 });
    var fl = [], passed = {}, nPas = 0, totalPar = 0, pasAt = -1, absT = 0, flash = 0, shake = 0, voz = {}, stats = { gane: 0 };
    var cpuR = [], plan = [];
    for (i = 0; i < n; i++) { cpuR.push(c.rngFor('cpu' + i)); plan.push({ tgt: null, re: -9, err: 0, errT: -9, imp: 0, esp: 0, fl: -9 }); }
    var isSolo = function (p) { return p === soloI; };

    /* el escenario sale de c.rng (idéntico en todas las pantallas): escondites y la fase del perro */
    var cov = [], rg = c.rng, nCov = lv === 1 ? 8 : 7, tries = 0, dogPh, gates = [SW / 2 - PERILLA.GS[lv - 1] - rg.next() * 30, SW / 2 + PERILLA.GS[lv - 1] + rg.next() * 30], kg;
    for (kg = 0; kg < 2; kg++) {                            // dos pasos en la hilera de conos; un escondite a cada lado de cada paso (así hay con qué jugar)
      cov.push({ x: Math.max(24, gates[kg] - 62), y: BAR + 38, r: 17, k: 1 }); cov.push({ x: gates[kg] + 58, y: BAR + 46, r: 10, k: 0 });
    }
    while (cov.length < nCov && tries < 300) {
      tries++;
      var kx = 30 + rg.next() * (SW - 60), ky = LINE_Y + 42 + rg.next() * (START_Y - LINE_Y - 92), kk = rg.next() < 0.5 ? 1 : 0, ok = true, a;
      for (a = 0; a < cov.length; a++) if (dE(kx, ky, cov[a].x, cov[a].y) < 62) ok = false;
      for (a = 0; a < 2; a++) if (Math.abs(kx - gates[a]) < 40 && ky < BAR + 70) ok = false;
      if (ok) cov.push({ x: kx, y: ky, r: kk ? 17 : 10, k: kk });
    }
    cov.sort(function (a, b) { return a.y - b.y; });
    dogPh = rg.next() * 6.283;

    /* ───── LA NOCHE SE COMPLICA: fases y eventos (de c.rng, después del escenario: el escenario no cambia) ───── */
    var TB = dur * ESC.FASE[0], TC = dur * ESC.FASE[1];
    function fase(t) { return t >= TC ? 2 : t >= TB ? 1 : 0; }
    function cdAt(t) { return ESC.CD[fase(t)]; }
    var dogOn = true, dogDesde = lv === 3 ? -99 : TC + 0.4;                 // el perro: siempre en el nivel 3; en el 1 y el 2 lo sueltan en los últimos segundos
    function perroEn(t) { return t >= dogDesde; }
    var dogAt = function (t) { var a = t <= TC ? DOGW * t : DOGW * TC + DOGW * ESC.PERRO * (t - TC); return { x: SW / 2 + (SW / 2 - 46) * Math.sin(a + dogPh), y: LINE_Y + 30 }; };
    /* carros a la revisión: suben por un paso, se paran frente a la alcabala y siguen (dos en el mismo paso, al menos CAR.MIN s aparte) */
    var carros = [], tcq = 1.2 + rg.next() * 1.6, lado = rg.next() < 0.5 ? 0 : 1, ultimo = [-99, -99];
    while (tcq < dur - 1.5 && carros.length < 16) {
      var gq = lado;
      if (tcq - ultimo[gq] < CAR.MIN) gq = 1 - gq;
      if (tcq - ultimo[gq] >= CAR.MIN) { carros.push({ t0: tcq, g: gq, x: gates[gq] }); ultimo[gq] = tcq; }
      lado = rg.next() < 0.6 ? 1 - gq : gq;
      var fz = fase(tcq); tcq += CAR.CADA[fz] + rg.next() * CAR.VAR[fz];
    }
    var T1C = (CAR.Y0 - CAR.YST) / CAR.V1;
    function carroEn(cr, t, lejos) {
      var s = t - cr.t0, y;
      if (s < 0) return null;
      if (s < T1C) y = CAR.Y0 - CAR.V1 * s; else if (s < T1C + CAR.REV) y = CAR.YST; else y = CAR.YST - CAR.V2 * (s - T1C - CAR.REV);
      if (y < (lejos ? CAR.YFIN : -CAR.HH - 30)) return null;
      return { x: cr.x, y: y, rev: s >= T1C && s < T1C + CAR.REV, s: s };
    }
    function carrosEn(t) { var o = [], k, cq; for (k = 0; k < carros.length; k++) { cq = carroEn(carros[k], t); if (cq) { cq.i = k; o.push(cq); } } return o; }
    function tapaCarro(x, y, t) {                            // agachado pegado a un carro (de lado o detrás) = escondido
      var cs = carrosEn(t), k;
      for (k = 0; k < cs.length; k++) { var cc = cs[k]; if (cc.y < BAR + 10 || cc.y > SH + 10) continue; if (Math.abs(x - cc.x) < CAR.HW + CAR.TAPA && Math.abs(y - cc.y) < CAR.HH + 14) return cc; }
      return null;
    }
    /* la gandola: cruza de lado a lado; su sombra (del lado contrario a la caseta) tapa la luz */
    var gand = [];
    function ponGandola(u0, u1) { if (dur < 8) return; gand.push({ t0: dur * (u0 + rg.next() * (u1 - u0)), y: BAR + 92 + rg.next() * 66, d: rg.next() < 0.5 ? 1 : -1 }); }
    ponGandola(0.38, 0.48); ponGandola(0.76, 0.84);
    function gandolaEn(gd, t) {
      var s = t - gd.t0; if (s < 0) return null;
      var x = gd.d > 0 ? -GAN.L / 2 - 10 + GAN.V * s : SW + GAN.L / 2 + 10 - GAN.V * s;
      if (x < -GAN.L / 2 - 12 || x > SW + GAN.L / 2 + 12) return null;
      return { x: x, y: gd.y, d: gd.d };
    }
    function enSombra(x, y, t) {
      var k, gg;
      for (k = 0; k < gand.length; k++) { gg = gandolaEn(gand[k], t); if (gg && Math.abs(x - gg.x) < GAN.L / 2 && y > gg.y && y < gg.y + GAN.HH + GAN.SOM) return true; }
      return false;
    }
    /* apagón del poste y neblina: ventanas fijas */
    var u0 = 0.56 + rg.next() * 0.08, apag = { t0: dur * u0, t1: dur * u0 + cl(dur * 0.08, 1.6, 3.2) };
    var u1 = 0.17 + rg.next() * 0.08, nieb = { t0: dur * u1, t1: dur * u1 + cl(dur * 0.12, 2, 5) };
    function apagado(t) { return t >= apag.t0 && t < apag.t1; }
    function neblina(t) { return t >= nieb.t0 && t < nieb.t1; }
    function radio(t) { return R * (apagado(t) ? ESC.APAG : 1); }
    function catchAt(t) { return CATCH * (neblina(t) ? ESC.NIEB : 1); }
    /* los avisos (cosméticos: solo el cartel y el sonido) */
    var avisos = [], avI = 0, banner = null;
    function aviso(t, tx, sub, col, k) { avisos.push({ t: t, tx: tx, sub: sub, col: col, k: k }); }
    aviso(TB, '¡SE ALBOROTÓ LA ALCABALA!', '¡ALTO! más seguido · más carros', '#ffd23f', 'fase');
    aviso(TC, '¡ÚLTIMOS SEGUNDOS!', lv === 3 ? 'el perro corre más · ¡córranle!' : 'soltaron al perro · ¡córranle!', '#ff6a5a', 'fase');
    aviso(nieb.t0 - ESC.AV, '¡NEBLINA!', 'la linterna tarda más en verte', '#c9d8ff', 'niebla');
    aviso(apag.t0 - ESC.AV, '¡SE VA LA LUZ!', 'luz más chica · sin ¡ALTO!', '#ffd23f', 'apagon');
    aviso(apag.t1, '¡VOLVIÓ LA LUZ!', '', '#fff6c0', 'luz');
    for (kg = 0; kg < gand.length; kg++) aviso(gand[kg].t0 - ESC.AV, '¡GANDOLA!', 'su sombra te tapa · ¡no te atravieses!', '#ffb050', 'gandola');
    if (carros.length) aviso(carros[0].t0 - 0.6, '¡CARRO A LA REVISIÓN!', 'agáchate pegado a él: te tapa', '#7dff9a', 'carro');
    for (kg = 1; kg < carros.length; kg++) aviso(carros[kg].t0 - 0.6, '', '', '', 'carro');
    avisos.sort(function (a, b) { return a.t - b.t; });

    /* campo visible (copia de f_patilla): el ancho real de la pantalla; lo lógico es SIEMPRE 440×300 */
    var cp = function () {
      var f = c.campo();
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 };
      return f;
    };
    var PIVY = 120;
    function geom() { var f = cp(), w = f.x1 - f.x0, cx = (f.x0 + f.x1) / 2; return { ox: cx - SW / 2, oy: 180, cx: cx, k: Math.min(1, Math.max(0.45, (w - 8) / (SW + 32))), w: w }; }
    function scr(G, x, y) { return { x: G.cx + (G.ox + x - G.cx) * G.k, y: PIVY + (G.oy + y - PIVY) * G.k }; }

    /* ───── lo que no depende de quién mira ───── */
    function agV(p) { return c.mio(p) ? P[p].ag : P[p].remAg; }
    function stV(p, now) { return c.mio(p) ? (now < P[p].stun ? 1 : 0) : P[p].remSt; }
    function coverNear(x, y) {                              // el escondite pegado (o null)
      var k;
      for (k = 0; k < cov.length; k++) if (dE(x, y, cov[k].x, cov[k].y) < cov[k].r + COVER_PAD) return cov[k];
      return null;
    }
    function oculto(p, now) { var q = P[p]; return !!(agV(p) && (coverNear(q.x, q.y) || tapaCarro(q.x, q.y, now == null ? c.ahora() : now))); }   // agachado tras un escondite o pegado a un carro
    function aSalvo(p, now) { var q = P[p]; return oculto(p, now) || enSombra(q.x, q.y, now); }                                                      // … o en la sombra de la gandola (de pie también)
    function gateDe(x) { return Math.abs(x - gates[0]) <= Math.abs(x - gates[1]) ? 0 : 1; }
    function luz() { return { x: P[soloI].x, y: P[soloI].y }; }
    function siguienteF() { var m = -1, j; for (j = 0; j < fl.length; j++) if (fl[j]) m = j; return m + 1; }
    function sincroniza() { var j, t = P[soloI].nextF; for (j = 0; j < fl.length; j++) if (fl[j] && fl[j].tl + cdAt(fl[j].tl) > t) t = fl[j].tl + cdAt(fl[j].tl); P[soloI].nextF = t; }
    function addAlto(d) {                                    // valida; «gana el que cae primero»; true si cambió algo
      if (!d || typeof d !== 'object' || !num(d.i) || !num(d.x) || !num(d.y) || !num(d.tl)) return false;
      if (d.i % 1 !== 0 || d.i < 0 || d.i >= MAXF) return false;
      var s = { i: d.i, x: cl(d.x, 0, SW), y: cl(d.y, 0, SH), tl: d.tl / 1000 }, old = fl[d.i];
      if (old && (old.tl < s.tl || (old.tl === s.tl && old.x <= s.x))) return false;
      fl[d.i] = s; sincroniza();
      if (!old && s.tl - c.ahora() > -0.3 && !v3) SND(300, 0.4, 'sawtooth', 0.05, 240);          // el silbato del aviso (en 3D: V3.sfx('silbato') al verlo)
      return true;
    }
    c.on('xalto', function (d) { addAlto(d); });
    function avisando(t) { var j, b = null; for (j = 0; j < fl.length; j++) if (fl[j] && t >= fl[j].tl - WIND - 0.02 && t < fl[j].tl) b = fl[j]; return b; }
    function cayendo(t) { var j, b = null; for (j = 0; j < fl.length; j++) if (fl[j] && t >= fl[j].tl && t <= fl[j].tl + FT) b = fl[j]; return b; }
    function amenaza(t) { return avisando(t) || cayendo(t); }
    var mias = [];                                           // mis destellos, que se reenvían un par de veces (si el enlace se cae justo entonces, las demás pantallas no se quedan sin él; los repetidos se ignoran)
    function lanzaAlto(p, x, y) {                            // el solo (humano, o la CPU/caído en el juez): anuncia el destello YA
      var now = c.ahora(), idx = siguienteF();
      if (idx >= MAXF || now < P[p].nextF || now < FIRST || avisando(now) || cayendo(now) || apagado(now) || apagado(now + WIND)) return false;   // sin luz el reflector no prende
      var d = { i: idx, x: Math.round(x), y: Math.round(y), tl: Math.round((now + WIND) * 1000) };
      if (!addAlto(d)) return false;
      c.send('xalto', d, false); mias.push({ d: d, last: now, n: 0 });
      return true;
    }

    /* ───── juicio: cada dueño juzga SU cuerpo ───── */
    function atrapa(p, razon, now) { c.ev('para', { n: P[p].nPar + 1, r: razon }, p); }
    function juzga(p, dt, now) {
      var q = P[p];
      if (q.ps || now < q.stun) { q.ex = 0; return; }
      if (q.y <= LINE_Y) { c.ev('paso', {}, p); return; }
      var hid = aSalvo(p, now), L = luz(), f = cayendo(now);
      if (perroEn(now)) { var dg = dogAt(now); if (dE(q.x, q.y, dg.x, dg.y) < DOGR) { atrapa(p, 2, now); return; } }
      if (f && !hid && dE(q.x, q.y, f.x, f.y) < RF - MARG_JUEZ) { atrapa(p, 1, now); return; }
      if (!hid && dE(q.x, q.y, L.x, L.y) < radio(now) - MARG_JUEZ) {
        q.ex += dt;
        if (q.ex >= catchAt(now)) atrapa(p, 0, now);
      } else q.ex = Math.max(0, q.ex - dt * DECAY);
    }

    /* LA LUZ ES DETERMINISTA (no depende del retardo): el solo manda muestras `xluz {x, y, tl}` de su punto de mira con tl = ahora + LEAD (ms de partida) y TODAS las
       pantallas (la suya incluida) mueven la luz por esas muestras al reloj de partida. El «punto de mira» (la cruz) va a la velocidad del stick; la luz lo sigue LEAD s
       después, igual en todas partes: nadie es parado por una luz que su pantalla vio en otro sitio (a 150 ms por HTTP el cuerpo `o` llegaba ~0,5-1 s tarde). */
    var beam = [{ t: -99, x: SW / 2, y: 170 }];
    function beamAt(t) {
      var k = beam.length - 1;
      if (t >= beam[k].t) return beam[k];
      if (t <= beam[0].t) return beam[0];
      while (k > 0 && beam[k - 1].t > t) k--;
      var a = beam[k - 1], b = beam[k], u = (t - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    function addBeam(sm) {
      var k = beam.length;
      while (k > 0 && beam[k - 1].t > sm.t) k--;
      if (k > 0 && beam[k - 1].t === sm.t) return false;
      beam.splice(k, 0, sm);
      if (beam.length > 60) beam.splice(1, 1);
      return true;
    }
    c.on('xluz', function (d) {
      if (!d || typeof d !== 'object' || !num(d.x) || !num(d.y) || !num(d.tl)) return;
      var t = d.tl / 1000;
      if (Math.abs(t - c.ahora()) > 4 || d.x < 0 || d.x > SW || d.y < 0 || d.y > SH) return;
      addBeam({ t: t, x: d.x, y: d.y });
    });
    function emiteLuz(q, now) {
      var d = { x: Math.round(q.ax), y: Math.round(q.ay), tl: Math.round((now + PERILLA.LEAD) * 1000) };
      if (addBeam({ t: d.tl / 1000, x: d.x, y: d.y })) c.send('xluz', d, true);
      q.lastS = now;
    }
    function aimDesdeLuz(q) { var l = beam[beam.length - 1]; q.ax = l.x; q.ay = l.y; }     // al tomar el mando (CPU/humano que vuelve): el mira parte de donde la luz ya va a estar

    function updPos(p, dt, now) {
      var q = P[p];
      if (isSolo(p)) {
        if (c.mio(p)) {
          var es = c.eje(p), ls = Math.sqrt(es.x * es.x + es.y * es.y);
          if (ls > 1) es = { x: es.x / ls, y: es.y / ls };
          var lsp = PERILLA.LS * ESC.LSK[fase(now)];
          q.ax = cl(q.ax + es.x * lsp * dt, 16, SW - 16); q.ay = cl(q.ay + es.y * lsp * dt, LINE_Y - 18, SH - 10);
          if (now >= 0 && (now - q.lastS >= 0.2 && (Math.abs(q.ax - beam[beam.length - 1].x) + Math.abs(q.ay - beam[beam.length - 1].y) > 2 || now - q.lastS >= 1))) emiteLuz(q, now);
          if (now >= 0 && c.tap(p, 'a') > 0) lanzaAlto(p, q.ax, q.ay);
        }
        var bp = beamAt(now); q.x = bp.x; q.y = bp.y;
        return;
      }
      if (!c.mio(p)) {
        var r = c.remoto(p);
        if (r) { q.x = r.x; q.y = r.y; q.remAg = r.ag; q.remSt = r.st; q.remPs = r.ps; }
        return;
      }
      var e = c.eje(p), len = Math.sqrt(e.x * e.x + e.y * e.y);
      if (len > 1) { e = { x: e.x / len, y: e.y / len }; }
      if (q.ps) { q.y = Math.min(q.y, LINE_Y - 6); q.ag = 0; return; }
      if (now < q.stun) { q.ag = 0; return; }
      var ag = now >= 0 && c.held(p, 'a'), v = SPD * (ag ? SPD_AG : 1);
      q.ag = ag ? 1 : 0;
      if (now >= 0) {
        var ox0 = q.x, oy0 = q.y, nx0 = cl(q.x + e.x * v * dt, 14, SW - 14), ny0 = cl(q.y + e.y * v * dt, Y_MIN, SH - 14), gt = gateDe(ox0);
        if (ny0 < BAR) {                                      // la hilera de conos: solo se cruza por un paso (y dentro del paso no te sales de él)
          var dg2 = Math.abs(nx0 - gates[gt]);
          if (oy0 >= BAR) { if (dg2 > GW / 2 - 8) ny0 = BAR; } else nx0 = cl(nx0, gates[gt] - GW / 2 + 8, gates[gt] + GW / 2 - 8);
        }
        empuja(q, nx0, ny0, now); juzga(p, dt, now);
      }
    }

    function empuja(q, nx, ny, now) {                        // los carros y la gandola no se atraviesan: empujan (cada dueño a su cuerpo, con el reloj de partida)
      var cs = carrosEn(now), k, gg;
      for (k = 0; k < cs.length; k++) { var cc = cs[k]; if (cc.y < BAR + 10) continue; if (Math.abs(nx - cc.x) < CAR.HW + 9 && Math.abs(ny - cc.y) < CAR.HH + 6) nx = cl(cc.x + (nx >= cc.x ? 1 : -1) * (CAR.HW + 9), 14, SW - 14); }
      for (k = 0; k < gand.length; k++) { gg = gandolaEn(gand[k], now); if (gg && Math.abs(nx - gg.x) < GAN.L / 2 + 6 && Math.abs(ny - gg.y) < GAN.HH + 8) ny = cl(gg.y + (ny >= gg.y ? 1 : -1) * (GAN.HH + 9), BAR + 2, SH - 14); }
      q.x = nx; q.y = ny;
    }

    /* ───── IA ───── */
    var lh = [];                                              // historial de la luz (para la reacción retrasada de las CPU del trío)
    function luzHace(now, s) { var k = lh.length - 1; while (k > 0 && lh[k].t > now - s) k--; return k >= 0 ? lh[k] : { x: P[soloI].x, y: P[soloI].y }; }
    function escondites(now) {                                // los fijos más los costados de los carros que están en la calle
      var o = cov.slice(), cs = carrosEn(now), k;
      for (k = 0; k < cs.length; k++) { var cc = cs[k]; if (cc.y < BAR + 30 || cc.y > SH - 20) continue; o.push({ x: cc.x - CAR.HW - 14, y: cc.y + 6, r: 10, k: 2 }); o.push({ x: cc.x + CAR.HW + 14, y: cc.y + 6, r: 10, k: 2 }); }
      return o;
    }
    function mejorCobertura(q, alcance, L, rad, now) {        // el escondite más cercano (hacia arriba mejor) que no esté dentro de la luz
      var k, best = null, bs = 1e9, es = escondites(now);
      for (k = 0; k < es.length; k++) {
        var cv = es[k], d = dE(q.x, q.y, cv.x, cv.y);
        if (d > alcance || (L && dE(cv.x, cv.y, L.x, L.y) < rad)) continue;
        var s = d + (cv.y > q.y + 10 ? 40 : 0);               // preferir escondites hacia adelante
        if (s < bs) { bs = s; best = cv; }
      }
      return best;
    }
    function irA(api, q, tx, ty, umbral) {
      var dx = tx - q.x, dy = ty - q.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= umbral) { api.eje(0, 0); return true; }
      api.eje(dx / d, dy / d); return false;
    }
    function aiTrio(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], R = radio(now);
      if (now < 0 || q.ps || now < q.stun) { api.eje(0, 0); api.hold('a', false); return; }
      if (now > pl.errT) { pl.errT = now + 1.2; pl.err = (R2.next() + R2.next() + R2.next() - 1.5) * 2 * (22 - 14 * sk); }   // cuánto se equivoca ahora sobre dónde está la luz
      var rt = 0.34 - 0.24 * sk, Ld = luzHace(now, rt), marg = 20 + (1 - sk) * 22 + Math.abs(pl.err);
      var Lq = luzHace(now, 1.0), quieta = now > 1.5 && dE(Ld.x, Ld.y, Lq.x, Lq.y) < 12;                   // una luz que no se mueve (solo ocioso o dormido): se rodea, no se espera
      if (quieta) marg = 8;
      var dL = enSombra(q.x, q.y, now) ? 999 : dE(q.x, q.y, Ld.x, Ld.y), alC = coverNear(q.x, q.y) || tapaCarro(q.x, q.y, now), th = amenaza(now - rt * 0.5);
      if (R2.next() < 0.012 * (1 - sk)) { api.eje(0, 0); api.hold('a', false); return; }                 // un descuido
      if (th && dL < 999 && dE(q.x, q.y, th.x, th.y) < RF + 16) {                                                       // ¡ALTO! en camino: esconderse o salir del aro
        var cv = mejorCobertura(q, 70, null, 0, now);
        if (alC) { api.hold('a', true); api.eje(0, 0); return; }
        if (cv && dE(q.x, q.y, cv.x, cv.y) < 55) { api.hold('a', false); var arr = irA(api, q, cv.x, cv.y + 4, 4); if (arr) api.hold('a', true); return; }
        var ax = q.x - th.x, ay = (q.y - th.y) * YE, al = Math.sqrt(ax * ax + ay * ay) || 1;
        api.hold('a', false); api.eje(ax / al, ay / al / YE); return;
      }
      if (perroEn(now) && q.y < LINE_Y + 110) {                                                                    // perro: esperar a que se aleje
        var dg = dogAt(now + 0.55), dg0 = dogAt(now);
        if (Math.abs(dg.x - q.x) < 64 || Math.abs(dg0.x - q.x) < 64) { if (q.y < LINE_Y + 70 && Math.abs(dg0.x - q.x) < 40 && q.y > dg0.y) { api.hold('a', false); api.eje(0, 0); return; } }
      }
      if (dL < R + marg) {                                                                                  // la luz anda cerca
        pl.esp += dt;
        if (pl.esp < 3.5 + 6 * sk || dL < R * 0.9) {
          if (alC) { api.hold('a', true); api.eje(0, 0); return; }
          var c2 = mejorCobertura(q, 85, Ld, R * 0.6, now);
          if (c2) { api.hold('a', false); var lleg = irA(api, q, c2.x, c2.y + 4, 4); if (lleg || dE(q.x, q.y, c2.x, c2.y) < c2.r + 8) api.hold('a', true); return; }
          var fx = q.x - Ld.x, fy = (q.y - Ld.y) * YE, fl2 = Math.sqrt(fx * fx + fy * fy) || 1;           // sin escondite: alejarse de la luz
          api.hold('a', false); api.eje(fx / fl2, cl(fy / fl2 / YE, -0.3, 1)); return;
        }
      } else pl.esp = Math.max(0, pl.esp - dt * 2);
      if (alC && !quieta && dL < R + marg + 26 && pl.esp < 3.5 + 6 * sk) { pl.esp += dt * 0.6; api.hold('a', true); api.eje(0, 0); return; }   // histéresis: no salir en cuanto la luz da un paso atrás
      /* camino libre: elegir un paso (repartidos entre el trío), ir de escondite en escondite hacia él y cruzar */
      var gi = pl.gate;
      if (gi == null || now > pl.gT) {
        var s0 = dE(q.x, q.y, gates[0], BAR) + (dE(gates[0], BAR, Ld.x, Ld.y) < R * 1.5 ? 90 : 0) + (slot[p] % 2 === 0 ? 0 : 60) + R2.next() * 30,
            s1 = dE(q.x, q.y, gates[1], BAR) + (dE(gates[1], BAR, Ld.x, Ld.y) < R * 1.5 ? 90 : 0) + (slot[p] % 2 === 1 ? 0 : 60) + R2.next() * 30;
        gi = pl.gate = s0 <= s1 ? 0 : 1; pl.gT = now + 4;
      }
      var gx = gates[gi], wp = null, k, bs = 1e9;
      if (q.y > BAR + 64) {
        for (k = 0; k < cov.length; k++) {
          var cv2 = cov[k], dy2 = q.y - cv2.y;
          if (dy2 < 10 || dy2 > 120 || cv2.y < BAR + 66 || Math.abs(cv2.x - gx) >= Math.abs(q.x - gx) || Math.abs(cv2.x - q.x) > 130 || dE(cv2.x, cv2.y, Ld.x, Ld.y) < R + marg) continue;
          var s2 = Math.abs(cv2.x - gx) * 0.8 + dE(q.x, q.y, cv2.x, cv2.y); if (s2 < bs) { bs = s2; wp = cv2; }
        }
      }
      var ex = q.y > BAR + 64 ? (wp ? wp.x : gx) : gx, ey = q.y > BAR + 64 ? (wp ? wp.y + 5 : BAR + 40) : LINE_Y - 24;
      if (q.y <= BAR + 30 && q.y > BAR + 2 && Math.abs(q.x - gx) > GW / 2 - 14) { ex = gx; ey = q.y; }            // alinearse con el paso antes de cruzarlo
      var dx = ex - q.x, dy = ey - q.y, dd = Math.sqrt(dx * dx + dy * dy) || 1, sx = q.x + dx / dd * SPD * 0.6, sy = q.y + dy / dd * SPD * 0.6;
      if (!enSombra(sx, sy, now) && dE(sx, sy, Ld.x, Ld.y) < R + marg * 0.7 && pl.esp < 3.5 + 6 * sk && q.y > LINE_Y + 12) {   // el siguiente paso cae en la luz: esperar (si la luz está quieta, rodearla)
        if (quieta) { var sd = Math.abs(q.x - Ld.x) < 10 ? (gx >= Ld.x ? 1 : -1) : (q.x >= Ld.x ? 1 : -1); api.hold('a', false); api.eje(sd, 0.1); return; }
        api.hold('a', !!alC); api.eje(0, 0); return;
      }
      api.hold('a', false); api.eje(dx / dd, dy / dd);
    }
    function vistos(now) {                                    // los miembros del trío que el solo CPU tiene por «a la vista»
      var out = [], a;
      for (a = 0; a < trio.length; a++) { var t = trio[a], q = P[t]; if (q.ps || now < q.stun || q.y > START_Y + 4) continue; out.push(t); }
      return out;
    }
    function aiSolo(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p];
      if (now < 0 || now < q.grace) { api.eje(0, 0); return; }
      if (!pl.tgt || now > pl.re) {
        var vs = vistos(now), a, best = null, bs = -1e9, ocul = 0;
        for (a = 0; a < vs.length; a++) {
          var t = vs[a], tq = P[t], oc = aSalvo(t, now);
          var sc = (SH - tq.y) * 1.0 - dE(q.ax, q.ay, tq.x, tq.y) * 0.25 + R2.next() * 40 - (oc ? 200 : 0);   // el más adelantado y cercano; un escondido solo cuenta si no queda nadie
          if (sc > bs) { bs = sc; best = t; ocul = oc ? 1 : 0; }
        }
        var sg = 34 - 26 * sk, z = (R2.next() + R2.next() + R2.next() - 1.5) * 2;
        if (best != null) {
          var bq = P[best], lead = ocul ? 0 : 0.2 + PERILLA.LEAD + (c.mio(best) ? 0 : 0.2);
          pl.tgt = { x: cl(bq.x + bq.vx * lead + z * sg, 20, SW - 20), y: cl(bq.y + bq.vy * lead + (R2.next() - 0.5) * sg, LINE_Y - 8, SH - 14), who: best, oc: ocul };
        } else { if (!pl.swT || now > pl.swT) { pl.sw = ((pl.sw || 0) + 1) % 2; pl.swT = now + 1.4 + R2.next(); } pl.tgt = { x: cl(gates[pl.sw] + (R2.next() - 0.5) * 70, 20, SW - 20), y: BAR + 30 + R2.next() * 90, who: -1, oc: 0 }; }   // vigila los pasos
        pl.re = now + 0.28 + (1 - sk) * 0.35 + R2.next() * 0.25;
      }
      var tx = pl.tgt.x, ty = pl.tgt.y;
      if (pl.tgt.who >= 0) { var wq = P[pl.tgt.who]; if (!pl.tgt.oc) { tx = cl(tx * 0.55 + (wq.x + wq.vx * 0.2) * 0.45, 20, SW - 20); ty = cl(ty * 0.55 + wq.y * 0.45, LINE_Y - 8, SH - 14); } }
      var dx = tx - q.ax, dy = ty - q.ay, d = Math.sqrt(dx * dx + dy * dy), m = Math.min(1, d / 14);
      api.eje(d > 1 ? dx / d * m : 0, d > 1 ? dy / d * m : 0);
      /* ¡ALTO!: cuando alguien a la vista está al alcance del destello, con probabilidad según la habilidad */
      if (now >= q.nextF && now >= FIRST && siguienteF() < MAXF && !avisando(now) && !cayendo(now) && now > pl.fl && pl.tgt.who >= 0 && !pl.tgt.oc) {
        var wq2 = P[pl.tgt.who], px = wq2.x + wq2.vx * WIND, py = wq2.y + wq2.vy * WIND;
        pl.fl = now + 0.25;
        if (dE(px, py, q.ax, q.ay) < RF * 0.95 && R2.next() < 0.45 + 0.5 * sk) lanzaAlto(p, cl(px + (R2.next() - 0.5) * (30 - 20 * sk), 0, SW), cl(py, 0, SH));
      }
    }

    /* ───── dibujo (solo rr / ell / line / poly / txt / c.util.pj) ───── */
    function persona(p, x, y, ag, st, pas, a) {
      var s = asiento(p), col = s.color || '#ffd23f', sq = ag ? 22 : 0, alpha = (st ? (Math.floor(absT * 12) % 2 ? 0.5 : 1) : 1) * (a == null ? 1 : a);
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(0.8, 0.8); ctx.translate(-x, -y);       // la figura a 0,8: caben tres en la calle sin taparse
      ell(x, y + 3, 22 - sq * 0.2, 6, 'rgba(20,16,28,.35)', 0);
      rr(x - 11, y - 26 + sq * 0.6, 8, 24 - sq * 0.6, 4, '#2f3a7a', 3); rr(x + 3, y - 26 + sq * 0.6, 8, 24 - sq * 0.6, 4, '#2f3a7a', 3);
      ell(x + 15, y - 44 + sq, 10, 13, '#c9a46a', 3); ell(x + 15, y - 48 + sq, 5, 5, '#8a6a3a', 0);        // el bulto (las hallacas)
      rr(x - 15, y - 62 + sq, 30, 38 - sq * 0.4, 10, col, 3.5);
      c.util.pj(s.ch, x, y - 78 + sq, 62, { animo: st ? 'perder' : (pas ? 'celebrar' : null), sombra: false });
      ctx.restore();
    }
    function cono(x, y, s) {
      rr(x - 11 * s, y - 3 * s, 22 * s, 5 * s, 2, '#ff7a1a', 2.5); poly([[x - 8 * s, y - 2 * s], [x + 8 * s, y - 2 * s], [x + 2 * s, y - 30 * s], [x - 2 * s, y - 30 * s]], '#ff7a1a', 3);
      poly([[x - 6 * s, y - 11 * s], [x + 6 * s, y - 11 * s], [x + 4.5 * s, y - 19 * s], [x - 4.5 * s, y - 19 * s]], '#ffffff', 0);
    }
    function mata(x, y, s) {
      ell(x, y + 2, 22 * s, 6 * s, 'rgba(20,16,28,.35)', 0); ell(x - 9 * s, y - 8 * s, 12 * s, 11 * s, '#2f6a3f', 3); ell(x + 9 * s, y - 9 * s, 13 * s, 12 * s, '#3a8a4a', 3); ell(x, y - 15 * s, 12 * s, 10 * s, '#4aa05a', 3);
    }
    function perro(x, y, t, dir) {
      var b = Math.sin(t * 10) * 1.5;
      ell(x, y + 3, 20, 5, 'rgba(20,16,28,.35)', 0);
      rr(x - 14, y - 14 + b, 28, 12, 6, '#8a6a4a', 3); rr(x - 12 * dir, y - 8, 5, 10, 2, '#6a4a2a', 2.5); rr(x + 8 * dir, y - 8, 5, 10, 2, '#6a4a2a', 2.5);
      ell(x + 15 * dir, y - 16 + b, 8, 7, '#a07a54', 3); poly([[x + 13 * dir, y - 22 + b], [x + 18 * dir, y - 30 + b], [x + 20 * dir, y - 21 + b]], '#6a4a2a', 2.5);
      ell(x + 21 * dir, y - 14 + b, 2.5, 2.5, INK, 0); line([[x - 14 * dir, y - 12 + b], [x - 22 * dir, y - 20 + b + Math.sin(t * 14) * 3]], 3, '#8a6a4a');
    }
    function fondo(f) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, k;
      rr(x0, 0, w, 120, 0, pal.cielo, 0); rr(x0, 70, w, 60, 0, pal.cielo2, 0); rr(x0, 124, w, 520, 0, pal.suelo2, 0);   // el suelo llena todo lo que no es calle (no se ve el fondo del laboratorio)
      for (k = 0; k < 16; k++) ell(x0 + ((k * 137) % w), 12 + (k * 31) % 70, 1.6, 1.6, '#fffdf2', 0);
      ell(x1 - 90, 56, 21, 21, pal.luna, 0); ell(x1 - 82, 52, 17, 17, pal.cielo, 0);
      /* el cerro de fondo y las luces de un pueblito */
      poly([[x0, 120], [x0 + w * 0.18, 84], [x0 + w * 0.34, 108], [x0 + w * 0.55, 76], [x0 + w * 0.78, 106], [x1, 90], [x1, 130], [x0, 130]], pal.suelo2, 3);
      for (k = 0; k < 9; k++) ell(x0 + 30 + ((k * 97) % Math.max(60, w - 60)), 112 + (k * 7) % 12, 1.8, 1.8, '#ffd96a', 0);
    }
    function calle(G) {
      var k, wx = G.w / G.k + 8;
      rr(G.cx - wx / 2, G.oy - 8, wx, SH + 26, 0, pal.acera, 0);
      rr(G.ox - 14, G.oy - 8, SW + 28, SH + 26, 0, pal.calle, 3);
      line([[G.ox - 14, G.oy - 8], [G.ox - 14, G.oy + SH + 18]], 4, INK); line([[G.ox + SW + 14, G.oy - 8], [G.ox + SW + 14, G.oy + SH + 18]], 4, INK);
      for (k = 0; k < 6; k++) rr(G.ox + SW / 2 - 4, G.oy + k * 56 + 6, 8, 28, 3, pal.raya, 0);
      /* la RAYA de la alcabala: damero + letrero; más allá, la calle libre */
      for (k = 0; k < 22; k++) rr(G.ox - 12 + k * 20, G.oy + LINE_Y - 4 + (k % 2) * 6, 20, 6, 0, k % 2 ? '#fffdf2' : INK, 0);
      txt('¡PROSIGA!', G.ox + SW - 54, G.oy + LINE_Y - 22, 13, '#7dff9a', 0, true);
    }
    function nivelHud(G, f, now) {
      var k, lx;
      if (G.w >= SW + 28 + 2 * 84) {
        lx = Math.max(f.x0 + 52, G.ox - 66);
        txt('PASARON', lx, G.oy + 40, 13, '#fffdf2', 0, true);
        for (k = 0; k < nt; k++) { ell(lx - 30 + k * 30, G.oy + 70, 11, 13, passed[trio[k]] ? '#5cff7a' : '#c9a46a', 3); }
        txt(nPas + '/' + need, lx, G.oy + 100, 22, nPas >= need ? '#5cff7a' : '#ffd23f', 0, true);
      } else {
        var my = Math.max(PIVY + (G.oy + SH + 18 - PIVY) * G.k + 38, 418);
        txt('PASARON', G.cx - 70, my - 22 + 22, 13, '#fffdf2', 0, true);
        for (k = 0; k < nt; k++) ell(G.cx - 20 + k * 30, my + 4, 11, 13, passed[trio[k]] ? '#5cff7a' : '#c9a46a', 3);
        txt(nPas + '/' + need, G.cx + 90, my + 4, 22, nPas >= need ? '#5cff7a' : '#ffd23f', 0, true);
      }
    }

    /* ───── 2D de respaldo (sin WebGL o ?plano=1): el dibujo de siempre ───── */
    function dibujar2D() {
      var f = cp(), G = geom(), now = c.ahora(), p, k, j, ox = G.ox, oy = G.oy, yo = c.yo;
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
      var L = luz(), av = avisando(now), ca = cayendo(now), solo = asiento(soloI);
      ctx.save(); ctx.translate(sxk, syk);
      fondo(f);
      ctx.save(); ctx.translate(G.cx, PIVY); ctx.scale(G.k, G.k); ctx.translate(-G.cx, -PIVY);
      calle(G);
      /* la caseta del guardia (sobre la raya) y su figura; de él sale la luz */
      var yb = oy + LINE_Y - 44, sxp = ox + SW - 70;
      rr(ox + SW - 120, yb - 18, 100, 52, 6, '#4a4f7a', 4); rr(ox + SW - 112, yb - 10, 40, 26, 3, '#ffd96a', 2.5); txt('ALCABALA', ox + SW - 60, yb + 24, 10, '#fffdf2', 0, true);
      for (k = 0; k < 17; k++) {                            // la hilera de conos de la alcabala, con dos pasos
        var cxk = 12 + k * 26.5;
        if (Math.abs(cxk - gates[0]) < GW / 2 || Math.abs(cxk - gates[1]) < GW / 2) continue;
        cono(ox + cxk, oy + BAR + 8, 0.95);
      }
      for (k = 0; k < 2; k++) { poly([[ox + gates[k] - 9, oy + BAR + 24], [ox + gates[k] + 9, oy + BAR + 24], [ox + gates[k], oy + BAR + 9]], '#7dff9a', 2.5); txt('PASE', ox + gates[k], oy + BAR + 38, 10, '#7dff9a', 0, true); }
      /* escondites */
      for (k = 0; k < cov.length; k++) { var cv = cov[k]; if (cv.k) mata(ox + cv.x, oy + cv.y, 1); else cono(ox + cv.x, oy + cv.y + 4, 1.1); }
      var cs2 = carrosEn(now);                              // los carros a la revisión (vistos desde arriba) y la gandola con su sombra
      for (k = 0; k < cs2.length; k++) { var c2d = cs2[k]; if (c2d.y > SH + 40) continue;
        if (c2d.y > BAR + 10) { ctx.save(); ctx.globalAlpha = 0.18; rr(ox + c2d.x - CAR.HW - CAR.TAPA, oy + c2d.y - CAR.HH - 14, 2 * (CAR.HW + CAR.TAPA), 2 * (CAR.HH + 14), 8, '#7dff9a', 0); ctx.restore(); }
        rr(ox + c2d.x - CAR.HW, oy + c2d.y - CAR.HH, 2 * CAR.HW, 2 * CAR.HH, 8, CARROS[carros[c2d.i] ? c2d.i % CARROS.length : 0], 3); rr(ox + c2d.x - CAR.HW + 4, oy + c2d.y - CAR.HH + 10, 2 * CAR.HW - 8, 16, 4, '#2a3450', 0);
        if (c2d.rev) txt('REVISIÓN', ox + c2d.x, oy + c2d.y - CAR.HH - 8, 10, '#ffd23f', 0, true); }
      for (k = 0; k < gand.length; k++) { var g2d = gandolaEn(gand[k], now); if (!g2d) continue;
        ctx.save(); ctx.globalAlpha = 0.45; rr(ox + g2d.x - GAN.L / 2, oy + g2d.y, GAN.L, GAN.HH + GAN.SOM, 0, '#000', 0); ctx.restore();
        rr(ox + g2d.x - GAN.L / 2, oy + g2d.y - GAN.HH, GAN.L, 2 * GAN.HH, 4, '#c9c4b0', 3); rr(ox + g2d.x + g2d.d * (GAN.L / 2 - 18) - 16, oy + g2d.y - GAN.HH - 2, 32, 2 * GAN.HH + 4, 5, '#d9342e', 3); }
      if (perroEn(now)) { var dg = dogAt(now), dg2 = dogAt(now + 0.1); perro(ox + dg.x, oy + dg.y, absT, dg2.x >= dg.x ? 1 : -1); }
      /* el trío, ordenado por profundidad */
      var ord = trio.slice();
      ord.sort(function (a, b) { return P[a].y - P[b].y; });
      for (k = 0; k < ord.length; k++) {
        p = ord[k]; var q = P[p], ag = agV(p), st = stV(p, now), pas = !!passed[p] || !!q.remPs, hid = aSalvo(p, now);
        persona(p, ox + q.x, oy + q.y, ag, st && !pas, pas, hid ? 0.62 : 1);
        if (hid && p === yo) txt('ESCONDIDO', ox + q.x, oy + q.y - 34, 10, '#7dff9a', 0, true);
        txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 14, 11, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (p === yo && !pas) {
          poly([[ox + q.x - 8, oy + q.y - 124 + (ag ? 22 : 0)], [ox + q.x + 8, oy + q.y - 124 + (ag ? 22 : 0)], [ox + q.x, oy + q.y - 112 + (ag ? 22 : 0)]], '#ffd23f', 3);
          if (q.ex > 0.02) { var bw = 38, fr = cl(q.ex / CATCH, 0, 1); rr(ox + q.x - bw / 2, oy + q.y - 132 + (ag ? 22 : 0), bw, 7, 3, 'rgba(20,16,28,.6)', 0); rr(ox + q.x - bw / 2, oy + q.y - 132 + (ag ? 22 : 0), bw * fr, 7, 3, fr > 0.6 ? '#ff4a3a' : '#ffd23f', 0); txt('¡TE VEN!', ox + q.x, oy + q.y - 142 + (ag ? 22 : 0), 11, '#ff6a5a', 0, true); }
        }
      }
      /* el guardia */
      c.util.pj(solo.ch, sxp, yb + 2, 64, { animo: av ? 'celebrar' : null, sombra: false });
      txt(solo.name ? String(solo.name).slice(0, 8) : '', sxp, yb + 36, 11, '#fffdf2', 0, true);
      if (yo === soloI) poly([[sxp - 8, yb - 60], [sxp + 8, yb - 60], [sxp, yb - 48]], '#ffd23f', 3);
      /* la linterna: cono desde la mano del guardia hasta el círculo de luz */
      var hx = sxp - 16, hy = yb - 4, lx = ox + L.x, ly = oy + L.y, ang = Math.atan2(ly - hy, lx - hx), nx = -Math.sin(ang), ny = Math.cos(ang);
      ctx.save(); ctx.globalAlpha = 0.14; poly([[hx, hy], [lx + nx * R, ly + ny * R / YE], [lx - nx * R, ly - ny * R / YE]], '#fff6b0', 0); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.2; ell(lx, ly, R * 1.12, R * 1.12 / YE, '#fff6b0', 0); ctx.globalAlpha = 0.3; ell(lx, ly, R, R / YE, '#fffbd0', 0); ctx.globalAlpha = 0.28; ell(lx, ly, R * 0.45, R * 0.45 / YE, '#ffffff', 0); ctx.restore();
      ell(hx, hy, 6, 6, '#fffbe0', 2);
      if (yo === soloI && c.mio(soloI)) {                    // la cruz del punto de mira (solo para el solo): la luz la sigue PERILLA.LEAD s después, igual en todas las pantallas
        var axs = ox + P[soloI].ax, ays = oy + P[soloI].ay;
        ctx.save(); ctx.globalAlpha = 0.85; line(ellP(axs, ays, 9, 9 / YE, 14), 2.5, '#ffffff'); line([[axs - 15, ays], [axs + 15, ays]], 2.5, '#ffffff'); line([[axs, ays - 12], [axs, ays + 12]], 2.5, '#ffffff'); ctx.restore();
      }
      /* ¡ALTO!: aro rojo que crece durante el aviso, y el destello */
      for (j = 0; j < fl.length; j++) {
        var sh = fl[j]; if (!sh) continue;
        var wu = sh.tl - now;
        if (wu > 0 && wu <= WIND + 0.02) {
          var u = 1 - wu / WIND, rr0 = RF * (0.35 + 0.65 * u), pa = 0.3 + 0.3 * Math.abs(Math.sin(absT * 14));
          ctx.save(); ctx.globalAlpha = pa; ell(ox + sh.x, oy + sh.y, RF, RF / YE, '#ff3b4e', 0); ctx.restore();
          ctx.save(); ctx.globalAlpha = 0.9; line(ellP(ox + sh.x, oy + sh.y, rr0, rr0 / YE, 24), 3.5, '#ff3b4e'); ctx.restore();
          txt('¡ALTO!', ox + sh.x, oy + sh.y - 8, 16 + 4 * u, '#fffdf2', 0, true);
        } else if (wu <= 0 && wu >= -FT) {
          ctx.save(); ctx.globalAlpha = 0.65 * (1 - (-wu) / FT); ell(ox + sh.x, oy + sh.y, RF, RF / YE, '#ffffff', 0); ctx.restore();
        }
      }
      ctx.restore(); ctx.restore();
      nivelHud(G, f, now);
      /* ayuda de controles del propio jugador */
      if (now >= 0 && yo >= 0 && yo < n && !passed[yo]) {
        if (yo === soloI) {
          var rest = Math.max(0, P[soloI].nextF - now), lis = rest <= 0 && !av && !ca && now >= FIRST, my2 = Math.max(PIVY + (G.oy + SH + 18 - PIVY) * G.k + 38, 418) + (G.w >= SW + 28 + 2 * 84 ? -300 : 24);
          var bx = G.cx, by = my2;
          rr(bx - 40, by, 80, 8, 4, 'rgba(20,16,28,.5)', 0); rr(bx - 40, by, 80 * (1 - cl(rest / cdAt(now), 0, 1)), 8, 4, lis ? '#5cff7a' : '#ffd23f', 0);
          txt(lis ? '¡ALTO! LISTO (A)' : '¡ALTO! recargando', bx, by + 20, 12, lis ? '#5cff7a' : '#fffdf2', 0, true);
        }
      }
      if (now > -0.5 && now < 2.2 && !c.practica) txt(soloI === yo ? '¡NO LOS DEJES PASAR!' : '¡CRUZA LA RAYA SIN QUE TE VEA LA LINTERNA!', G.cx, 112, soloI === yo ? 22 : (G.w < 500 ? 11 : 15), '#fffdf2', 0, true);
      if (apagado(now)) { ctx.save(); ctx.globalAlpha = 0.35; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#000', 0); ctx.restore(); }
      if (neblina(now)) { ctx.save(); ctx.globalAlpha = 0.22; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#c9d0e8', 0); ctx.restore(); }
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.22; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ff3b4e', 0); ctx.restore(); }
      estado(G.cx, 136, now); cartel(G.cx, 196);
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): la alcabala de medianoche en la nacional. Solo dibujo: lee P, fl, la luz, cov y el perro; no toca la simulación ─────
       La calle lógica (440×300) es la zona de la alcabala; a los lados pasan carros por los canales de la nacional. Más allá de la raya: la caseta del
       guardia con su sirena, la talanquera y la bandera. La linterna es un SpotLight de verdad (con sombra: los conos y las matas tapan la luz). */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ESX = 1 / 18, ESZ = 1.15 / 18, ZK = ESZ / ESX / YE;                 // ZK: un círculo del juicio (dE con YE) en el piso 3D se encoge ~0,96 en z
    function WX(x) { return (x - SW / 2) * ESX; }
    function WZ(y) { return (y - 160) * ESZ; }
    var GX = WX(352), GZ = WZ(18);                                            // el guardia, delante de su caseta (más allá de la raya)
    var PAL3 = {
      1: { cielo: ['#2c2a5c', '#ff9a6a'], hemi: [0xffc8b0, 0x4a3a5a, .5], sol: [0xff9a60, .55], niebla: '#5a4470', spot: 1.4, asfalto: '#555366', tierra: '#4a5236', cerro: '#3a3456', noche: 0 },
      2: { cielo: ['#0e0c2a', '#2c2a5a'], hemi: [0x8a90ff, 0x2a2440, .42], sol: [0xb0c0ff, .3], niebla: '#1e1c40', spot: 2.2, asfalto: '#3c3a4e', tierra: '#2e3a2a', cerro: '#1e2a2e', noche: 1 },
      3: { cielo: ['#05041a', '#15123a'], hemi: [0x6a70d0, 0x1a1630, .32], sol: [0x8a98e0, .18], niebla: '#0f0d28', spot: 2.6, asfalto: '#2e2c3c', tierra: '#20281e', cerro: '#141c22', noche: 1 }
    };
    var CARROS = ['#d94a3a', '#3f7fd0', '#e8d8a8', '#2fae6a', '#f2d23a', '#8a4fd0'];
    function plano(geo, col, op, aditivo) {                                   // malla plana sin luz (discos, aros, haces): transparente y sin escribir profundidad
      var T = THREE, m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide, blending: aditivo ? T.AdditiveBlending : T.NormalBlending }));
      return m;
    }
    function alPiso(m, y) { m.rotation.x = -Math.PI / 2; m.position.y = y; return m; }
    function cono3D(s) {                                                      // cono de tránsito: base negra, cuerpo naranja, franja blanca
      var T = THREE, g3 = new T.Group(), M = V3.malla;
      var ba = M(new T.BoxGeometry(.62 * s, .07 * s, .62 * s), '#2a2a34', { g: .04 }); ba.position.y = .035 * s; g3.add(ba);
      var cu = M(new T.ConeGeometry(.25 * s, .8 * s, 10), '#ff7a1a', { g: .05 }); cu.position.y = .47 * s; g3.add(cu);
      var fr = M(new T.CylinderGeometry(.125 * s, .165 * s, .14 * s, 10), '#fffdf2', { borde: false }); fr.position.y = .43 * s; g3.add(fr);
      return g3;
    }
    function mata3D(rw) {                                                     // matorral: un puñado de icosaedros verdes
      var T = THREE, g3 = new T.Group(), k, cols = ['#2f6a3f', '#3a8a4a', '#4aa05a', '#357a42'];
      var ps = [[-.45, .45, .1, .55], [.45, .5, -.05, .6], [0, .8, 0, .55], [.1, .4, .45, .45], [-.2, .45, -.4, .45]];
      for (k = 0; k < ps.length; k++) { var b = V3.malla(new T.IcosahedronGeometry(ps[k][3] * rw, 0), cols[k % 4], { g: .04 }); b.position.set(ps[k][0] * rw, ps[k][1] * rw, ps[k][2] * rw); b.rotation.set(k, k * 2, 0); g3.add(b); }
      return g3;
    }
    function carro3D(col, noche) {                                            // carro low poly mirando a +z: faros, stops y el haz de los faros en el piso
      var T = THREE, g3 = new T.Group(), M = V3.malla, k, ruedas = [], stops = [];
      var ca = M(new T.BoxGeometry(1.9, .62, 4.1), col, { g: .03 }); ca.position.y = .62; g3.add(ca);
      var cb = M(new T.BoxGeometry(1.66, .56, 2.1), V3.oscurecer(col, .8), { g: .03 }); cb.position.set(0, 1.2, -.25); g3.add(cb);
      var vi = M(new T.BoxGeometry(1.7, .38, 2.14), '#2a3450', { borde: false }); vi.position.set(0, 1.24, -.25); g3.add(vi);
      for (k = 0; k < 4; k++) { var ru = M(new T.CylinderGeometry(.34, .34, .26, 10), '#1a1a22', { g: .05 }); ru.rotation.z = Math.PI / 2; ru.position.set(k % 2 ? .92 : -.92, .34, k > 1 ? 1.3 : -1.3); g3.add(ru); ruedas.push(ru); }
      for (k = 0; k < 2; k++) {
        var fa = new T.Mesh(new T.BoxGeometry(.36, .18, .06), V3.toon('#fff6c0', { em: '#fff2a0', emI: noche ? 1.6 : .5 })); fa.position.set(k ? .6 : -.6, .72, 2.06); g3.add(fa);
        var st = new T.Mesh(new T.BoxGeometry(.34, .16, .06), V3.toon('#ff3b2e', { em: '#ff2a1a', emI: noche ? 1.4 : .5, nuevo: true })); st.position.set(k ? .65 : -.65, .74, -2.06); g3.add(st); stops.push(st);
      }
      var haz = alPiso(plano(new T.PlaneGeometry(2.6, 8), 0xfff2b0, noche ? .16 : .07, true), .03); haz.position.z = 6.1; g3.add(haz);
      return { g: g3, ruedas: ruedas, stops: stops };
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, M = V3.malla, tn = V3.toon;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 48, 125], fov: 32 });
      if (!esc) return null;
      V3.pista('alcabala', { bpm: 118, acordes: [[57, 60, 64], [53, 57, 62], [52, 56, 59], [57, 60, 64]],   // pasaje llanero en La menor, en puntillas: i–iv–V–i
        mel: [69, 0, 72, 0, 71, 0, 69, 0, 64, 0, 69, 0, 74, 72, 0, 0, 68, 0, 71, 0, 74, 0, 71, 68, 69, 0, 0, 64, 69, 0, 0, 0] });
      V3.pista('alcabala3', { bpm: 152, acordes: [[57, 60, 64], [53, 57, 62], [52, 56, 59], [52, 56, 59]],   // los últimos segundos: el mismo pasaje, a la carrera
        mel: [69, 72, 76, 72, 71, 74, 76, 74, 69, 72, 76, 81, 80, 0, 76, 0, 68, 71, 74, 71, 68, 71, 74, 76, 69, 0, 72, 0, 76, 0, 81, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 1) esc.luces.sol.position.set(-26, 10, -8);
      var S3 = esc.scene, noche = pl.noche, x0 = WX(0) - .8, x1 = WX(SW) + .8;
      /* el piso: tierra, la nacional (asfalto con granito), las rayas y la RAYA de la alcabala */
      var tierra = new T.Mesh(new T.PlaneGeometry(220, 220), tn(pl.tierra)); alPiso(tierra, 0); tierra.receiveShadow = true; S3.add(tierra);
      var asf = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = pl.asfalto; x.fillRect(0, 0, w, h);
        for (var i2 = 0; i2 < 300; i2++) { x.fillStyle = i2 % 3 ? V3.oscurecer(pl.asfalto, .82) : V3.oscurecer(pl.asfalto, 1.22); x.fillRect((i2 * 53) % w, (i2 * 97 + (i2 >> 3) * 7) % h, 2, 2); }
      }, [11, 32]);
      var calle3 = new T.Mesh(new T.PlaneGeometry(44, 130), new T.MeshToonMaterial({ map: asf, gradientMap: tn('#fff').gradientMap })); alPiso(calle3, .01); calle3.position.z = -25; calle3.receiveShadow = true; S3.add(calle3);
      function raya(x, z, w, d, col) { var m = alPiso(new T.Mesh(new T.PlaneGeometry(w, d), tn(col)), .02); m.position.x = x; m.position.z = z; m.receiveShadow = true; S3.add(m); return m; }
      raya(x0, -25, .2, 130, '#fffdf2'); raya(x1, -25, .2, 130, '#fffdf2'); raya(-21.6, -25, .2, 130, '#fffdf2'); raya(21.6, -25, .2, 130, '#fffdf2');
      for (k = 0; k < 12; k++) { raya(0, 14 - k * 6.5, .22, 2.6, '#ffd23f'); if (k > 1) { raya(-17.3, 14 - k * 6.5, .2, 2.4, '#d8d2a8'); raya(17.3, 14 - k * 6.5, .2, 2.4, '#d8d2a8'); } }
      var dam = V3.texturaCanvas(256, 24, function (x, w, h) { for (var i2 = 0; i2 < 22; i2++) for (var j2 = 0; j2 < 2; j2++) { x.fillStyle = (i2 + j2) % 2 ? '#fffdf2' : '#14101c'; x.fillRect(i2 * w / 22, j2 * h / 2, w / 22 + 1, h / 2); } }, [1, 1]);
      var ray = alPiso(new T.Mesh(new T.PlaneGeometry(x1 - x0, .8), new T.MeshToonMaterial({ map: dam, gradientMap: tn('#fff').gradientMap })), .025); ray.position.z = WZ(LINE_Y); ray.receiveShadow = true; S3.add(ray);
      for (k = 0; k < 2; k++) { var cu = M(new T.BoxGeometry(.5, .3, 130), '#8a8698', { recibe: true, g: .02 }); cu.position.set(k ? 22.2 : -22.2, .15, -25); S3.add(cu); }
      /* la hilera de conos con sus dos pasos (flecha verde en el piso y postes con bombillo verde) */
      for (k = 0; k < 17; k++) { var cxk = 12 + k * 26.5; if (Math.abs(cxk - gates[0]) < GW / 2 || Math.abs(cxk - gates[1]) < GW / 2) continue; var cn = cono3D(1); cn.position.set(WX(cxk), 0, WZ(BAR + 2)); cn.rotation.y = k; S3.add(cn); }
      var flechas = [];
      for (k = 0; k < 2; k++) {
        var tri = new T.Shape(); tri.moveTo(-.55, 0); tri.lineTo(.55, 0); tri.lineTo(0, -.9); tri.lineTo(-.55, 0);
        var fg = new T.Group(); fg.position.set(WX(gates[k]), 0, WZ(BAR + 16)); S3.add(fg);
        for (var j2 = 0; j2 < 2; j2++) { var fm = alPiso(plano(new T.ShapeGeometry(tri), 0x5cff7a, .75, true), .04); fm.rotation.x = Math.PI / 2; fm.position.z = -j2 * .7; fg.add(fm); flechas.push(fm); }
        for (j2 = 0; j2 < 2; j2++) { var po = M(new T.CylinderGeometry(.06, .08, 1.1, 6), '#2a2a34', { g: .06 }); po.position.set(WX(gates[k] + (j2 ? 1 : -1) * GW / 2), .55, WZ(BAR + 2)); S3.add(po);
          var bo = new T.Mesh(new T.SphereGeometry(.13, 8, 6), tn('#7dff9a', { em: '#3aff6a', emI: noche ? 1.8 : .9 })); bo.position.set(po.position.x, 1.18, po.position.z); S3.add(bo); }
      }
      /* los escondites: conos grandes y matas */
      var matas = [];
      for (k = 0; k < cov.length; k++) { var cv = cov[k], ob = cv.k ? mata3D(cv.r * ESX * 1.3) : cono3D(1.7); ob.position.set(WX(cv.x), 0, WZ(cv.y)); ob.rotation.y = k * 1.3; S3.add(ob); if (cv.k) matas.push(ob); }
      /* la caseta del guardia: paredes, franja, ventana encendida, puerta, techo, letrero, sirena y sacos de arena */
      var cas = new T.Group(); cas.position.set(WX(372), 0, WZ(-12)); cas.rotation.y = -.22; S3.add(cas);
      var pa = M(new T.BoxGeometry(3.2, 2.6, 2.4), '#e8e2cc', { recibe: true, g: .02 }); pa.position.y = 1.3; cas.add(pa);
      var fra = M(new T.BoxGeometry(3.24, .35, 2.44), '#2a4aa8', { borde: false, recibe: true }); fra.position.y = .55; cas.add(fra);
      var ve = M(new T.BoxGeometry(1.4, .8, .1), noche ? '#ffd96a' : '#5a6a9a', { g: .04, em: noche ? '#ffb030' : null, emI: .9 }); ve.position.set(-.5, 1.65, 1.21); cas.add(ve);
      var pu = M(new T.BoxGeometry(.8, 1.75, .1), '#5a4a3a', { g: .03 }); pu.position.set(.95, .88, 1.21); cas.add(pu);
      var te = M(new T.BoxGeometry(3.8, .22, 3), '#d8d2c0', { recibe: true, g: .02 }); te.position.y = 2.71; cas.add(te);
      var cartel = V3.texturaCanvas(256, 64, function (x, w, h) { x.fillStyle = '#1a2a6a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.fillRect(0, h - 8, w, 8); x.fillStyle = '#fffdf2'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ALCABALA', w / 2, h / 2 - 2); });
      var le = M(new T.BoxGeometry(2.6, .6, .12), '#1a2a6a', { g: .03 }); le.position.set(0, 3.15, .9); cas.add(le);
      var leF = new T.Mesh(new T.PlaneGeometry(2.5, .55), new T.MeshBasicMaterial({ map: cartel })); leF.position.set(0, 3.15, .97); cas.add(leF);
      var sirB0 = M(new T.BoxGeometry(.6, .12, .3), '#2a2a34', { g: .05 }); sirB0.position.set(-.9, 2.88, .2); cas.add(sirB0);
      var sirR = new T.Mesh(new T.SphereGeometry(.14, 8, 6), tn('#ff3b3b', { em: '#ff2020', emI: 2, nuevo: true })); sirR.position.set(-1.06, 3.0, .2); cas.add(sirR);
      var sirA = new T.Mesh(new T.SphereGeometry(.14, 8, 6), tn('#3b6bff', { em: '#2050ff', emI: 2, nuevo: true })); sirA.position.set(-.74, 3.0, .2); cas.add(sirA);
      var sirL = new T.PointLight(0xff3030, noche ? 1.2 : .6, 11, 2); sirL.position.set(WX(372) - .9, 3.6, WZ(-12) + 1.2); S3.add(sirL);
      if (noche) { var luzC = new T.PointLight(0xffc870, .9, 9, 2); luzC.position.set(WX(372) - .6, 2, WZ(-12) + 2.2); S3.add(luzC); }
      for (k = 0; k < 7; k++) { var sa = M(new T.SphereGeometry(.4, 7, 5), '#b8a070', { g: .04, recibe: true }); sa.scale.set(1, .45, .6); sa.position.set(WX(300) + (k % 4) * .72 - (k > 3 ? -.36 : 0), .2 + (k > 3 ? .34 : 0), WZ(-6)); S3.add(sa); }
      /* la talanquera (rayas rojas y blancas): sube y baja con el ¡ALTO! */
      var pos0 = M(new T.BoxGeometry(.32, 1.1, .32), '#d8d2c0', { g: .04 }); pos0.position.set(x1 + .3, .55, WZ(34)); S3.add(pos0);
      var brazo = new T.Group(); brazo.position.set(x1 + .3, 1.08, WZ(34)); brazo.rotation.z = -1.25; S3.add(brazo);
      for (k = 0; k < 8; k++) { var se = M(new T.BoxGeometry(.9, .14, .14), k % 2 ? '#fffdf2' : '#e8452e', { g: .05 }); se.position.x = -(.45 + k * .9); brazo.add(se); }
      var cpe = M(new T.BoxGeometry(.5, .3, .3), '#2a2a34', { g: .05 }); cpe.position.x = .35; brazo.add(cpe);
      /* el farol de la alcabala (con polillas) y la bandera tricolor */
      var fx0 = x1 + 1.6, fz0 = WZ(84);
      var fp0 = M(new T.CylinderGeometry(.1, .14, 6, 6), '#2a2a34'); fp0.position.set(fx0, 3, fz0); S3.add(fp0);
      var fb0 = M(new T.BoxGeometry(2.2, .1, .1), '#2a2a34', { borde: false }); fb0.position.set(fx0 - 1.05, 5.95, fz0); S3.add(fb0);
      var fl0 = new T.Mesh(new T.BoxGeometry(.6, .18, .4), tn('#fff2a0', { em: '#ffd36a', emI: noche ? 1.8 : .6 })); fl0.position.set(fx0 - 2.05, 5.85, fz0); S3.add(fl0);
      var luzF = new T.PointLight(0xffc870, noche ? 1.1 : .5, 15, 2); luzF.position.set(fx0 - 2.05, 5.2, fz0); S3.add(luzF);
      /* el reflector del ¡ALTO! sobre la caseta (se apaga con el apagón) */
      var refl = M(new T.BoxGeometry(.7, .5, .4), '#2a2a34', { g: .05 }); refl.position.set(.9, 3.05, .4); cas.add(refl);
      var reflF = new T.Mesh(new T.CircleGeometry(.2, 10), tn('#fffbe0', { em: '#fff6c0', emI: 2, nuevo: true })); reflF.position.set(.9, 3.05, .61); cas.add(reflF);
      var luces = [{ l: luzF, b: luzF.intensity }, { l: sirL, b: sirL.intensity }], mats = [{ m: fl0.material, b: fl0.material.emissiveIntensity }, { m: ve.material, b: ve.material.emissiveIntensity }, { m: reflF.material, b: 2 }];
      if (noche) luces.push({ l: luzC, b: luzC.intensity });
      var mb = M(new T.CylinderGeometry(.05, .06, 5.4, 6), '#d8d2c0', { g: .08 }); mb.position.set(x1 + 2.6, 2.7, WZ(-24)); S3.add(mb);
      var bandera = [];
      ['#ffd23f', '#2a4aa8', '#d9342e'].forEach(function (col, i2) {
        var gb = new T.PlaneGeometry(1.8, .4, 8, 1); gb.translate(.9, 0, 0);
        var fm2 = new T.Mesh(gb, new T.MeshToonMaterial({ color: col, side: T.DoubleSide, gradientMap: tn('#fff').gradientMap })); fm2.position.set(x1 + 2.65, 5.1 - i2 * .4, WZ(-24)); fm2.castShadow = true; S3.add(fm2); bandera.push(fm2);
      });
      /* el jeep estacionado junto a la caseta (con las intermitentes) */
      var jeep = carro3D('#4a5a3a', noche); jeep.g.position.set(x1 - .4, 0, WZ(-46)); jeep.g.rotation.y = Math.PI * .92; S3.add(jeep.g);
      /* la nacional: carros que pasan por los canales de los lados */
      var carros = [];
      for (k = 0; k < 4; k++) { var cc = carro3D(CARROS[(k + lv) % CARROS.length], noche), d0 = k % 2 ? -1 : 1; cc.g.rotation.y = d0 > 0 ? 0 : Math.PI; S3.add(cc.g); carros.push({ g: cc.g, ruedas: cc.ruedas, x: d0 > 0 ? -18.2 : 18.2, d: d0, v: 10 + k * 1.7, o: k * 31, z: 999 }); }
      /* el fondo: cerros con ranchitos encendidos, postes de luz con su guaya y palmeras */
      var CER = [[-30, -46, 18, 15], [-4, -54, 24, 19], [26, -46, 19, 14], [48, -40, 16, 11], [-52, -40, 16, 12]];
      for (k = 0; k < CER.length; k++) { var ce = M(new T.ConeGeometry(CER[k][2], CER[k][3], 7), V3.oscurecer(pl.cerro, .9 + (k % 3) * .1), { g: .006 }); ce.position.set(CER[k][0], CER[k][3] / 2 - .2, CER[k][1]); ce.rotation.y = k; S3.add(ce); }
      for (k = 0; k < 26; k++) {
        var cr0 = CER[k % CER.length], a0 = .35 + ((k * .618) % 1) * 2.4, f0 = .35 + ((k * .37) % 1) * .5;
        var ra = M(new T.BoxGeometry(1.1, .8, .8), ['#e8b070', '#c9d8e8', '#f0a0a0', '#e8e0a0'][k % 4], { g: .03 }); ra.position.set(cr0[0] + Math.cos(a0) * cr0[2] * f0, cr0[3] * (1 - f0) + .1, cr0[1] + Math.sin(a0) * cr0[2] * f0); S3.add(ra);
        var rv = new T.Mesh(new T.BoxGeometry(.32, .3, .05), tn(noche || k % 3 === 0 ? '#ffd96a' : '#3a4a6a', { em: noche || k % 3 === 0 ? '#ffb030' : null, emI: noche ? 1.6 : .5 })); rv.position.set(ra.position.x, ra.position.y + .05, ra.position.z + .42); S3.add(rv);
      }
      var tops = [[], []];
      for (k = 0; k < 6; k++) for (j2 = 0; j2 < 2; j2++) { var px2 = j2 ? 24 : -24, pz2 = 12 - k * 13, ps0 = M(new T.CylinderGeometry(.12, .16, 7, 6), '#5a4a3a', { g: .04 }); ps0.position.set(px2, 3.5, pz2); S3.add(ps0);
        var tr0 = M(new T.BoxGeometry(1.4, .1, .1), '#5a4a3a', { borde: false }); tr0.position.set(px2, 6.7, pz2); S3.add(tr0); tops[j2].push(new T.Vector3(px2 + (j2 ? -.6 : .6), 6.75, pz2)); }
      for (j2 = 0; j2 < 2; j2++) for (k = 0; k < tops[j2].length - 1; k++) { var a1 = tops[j2][k], b1 = tops[j2][k + 1], mid = a1.clone().add(b1).multiplyScalar(.5); mid.y -= .9;
        S3.add(new T.Mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(a1, mid, b1), 10, .025, 3), tn('#14101c'))); }
      var hojas = [];
      [[-27, 4, 7], [27, -6, 8], [-29, -14, 6.5], [30, 10, 7]].forEach(function (pp) {
        var g3 = new T.Group(); g3.position.set(pp[0], 0, pp[1]); S3.add(g3);
        for (var i2 = 0; i2 < 6; i2++) { var tr = M(new T.CylinderGeometry(.28 - i2 * .02, .34 - i2 * .02, pp[2] / 6, 6), i2 % 2 ? '#7a5a3a' : '#6a4a2a', { g: .04 }); tr.position.set(Math.sin(i2 * .3) * .3, pp[2] / 12 + i2 * pp[2] / 6, 0); g3.add(tr); }
        for (var j3 = 0; j3 < 7; j3++) { var ho = M(new T.ConeGeometry(.5, 3.6, 4), j3 % 2 ? '#2f7a3a' : '#2a6a34', { g: .03 }); ho.geometry.translate(0, 1.8, 0); ho.position.set(.5, pp[2], 0); ho.rotation.set(0, j3 / 7 * 6.28, 0); ho.rotateZ(1.9); g3.add(ho); hojas.push(ho); }
      });
      /* los vendedores ambulantes: dos puestos con toldo al borde de la nacional (decorado; no tocan la simulación) */
      var vend = [];
      [[-15, WZ(20), '#3fb0ff', '#ffd23f'], [15, WZ(230), '#ff7a1a', '#7dff9a']].forEach(function (vv) {
        var vg = new T.Group(); vg.position.set(vv[0], 0, vv[1]); vg.rotation.y = vv[0] < 0 ? .5 : -.5; S3.add(vg);
        var mesa = M(new T.BoxGeometry(1.5, .7, .8), '#8a5a2a', { g: .04 }); mesa.position.y = .35; vg.add(mesa);
        var bandeja = M(new T.BoxGeometry(1.2, .12, .6), '#e8d8a8', { borde: false }); bandeja.position.y = .76; vg.add(bandeja);
        var toldo = M(new T.ConeGeometry(1.1, .5, 4), vv[2], { g: .04 }); toldo.position.set(0, 2.1, 0); toldo.rotation.y = .785; vg.add(toldo);
        var poste = M(new T.CylinderGeometry(.04, .04, 2.2, 5), '#2a2a34', { g: .06 }); poste.position.set(.65, 1.1, .3); vg.add(poste);
        var cuerpo = M(new T.BoxGeometry(.5, .9, .4), vv[3], { g: .04 }); cuerpo.position.set(-.1, 1.15, -1.0); vg.add(cuerpo);
        var cab = M(new T.SphereGeometry(.25, 8, 6), '#c9a46a', { g: .04 }); cab.position.set(-.1, 1.87, -1.0); vg.add(cab);
        var brazo = new T.Group(); brazo.position.set(.25, 1.5, -1.0); vg.add(brazo);
        var bm = M(new T.BoxGeometry(.16, .7, .16), '#c9a46a', { g: .04 }); bm.position.y = -.35; brazo.add(bm);
        vend.push({ brazo: brazo, k: vend.length });
      });
      /* cocuyos alrededor de las matas */
      var cocuyos = [];
      for (k = 0; k < 10; k++) { var cy = new T.Mesh(new T.SphereGeometry(.06, 5, 4), new T.MeshBasicMaterial({ color: 0xd8ff6a })); var base = cov[k % cov.length]; S3.add(cy); cocuyos.push({ m: cy, x: WX(base.x), z: WZ(base.y) }); }
      /* el perro rastreador (nivel 3) con su aro de peligro */
      var perro = null;
      if (dogOn) {
        var dg3 = new T.Group(), patas = [], i3; S3.add(dg3);
        var cuD = M(new T.BoxGeometry(.38, .36, .9), '#8a6a4a', { g: .05 }); cuD.position.y = .55; dg3.add(cuD);
        var ca3 = M(new T.BoxGeometry(.34, .32, .36), '#a07a54', { g: .05 }); ca3.position.set(0, .82, .55); dg3.add(ca3);
        var ho3 = M(new T.BoxGeometry(.2, .16, .2), '#6a4a2a', { g: .06 }); ho3.position.set(0, .76, .8); dg3.add(ho3);
        for (i3 = 0; i3 < 2; i3++) { var or = M(new T.ConeGeometry(.08, .2, 4), '#6a4a2a', { g: .08 }); or.position.set(i3 ? .12 : -.12, 1.05, .5); dg3.add(or); }
        for (i3 = 0; i3 < 4; i3++) { var pg = new T.Group(); pg.position.set(i3 % 2 ? .13 : -.13, .4, i3 > 1 ? -.3 : .3); dg3.add(pg); var pm = M(new T.BoxGeometry(.11, .4, .11), '#6a4a2a', { g: .06 }); pm.position.y = -.2; pg.add(pm); patas.push(pg); }
        var col3 = new T.Group(); col3.position.set(0, .7, -.45); dg3.add(col3); var cm = M(new T.CylinderGeometry(.04, .05, .4, 5), '#8a6a4a', { g: .08 }); cm.position.y = .18; cm.rotation.x = -.5; col3.add(cm);
        var aroP = alPiso(plano(new T.RingGeometry(DOGR * ESX - .12, DOGR * ESX, 28), 0xff3b4e, .55), .04); aroP.scale.set(1, ZK, 1); S3.add(aroP);
        perro = { g: dg3, patas: patas, cola: col3, aro: aroP };
      }
      /* los jugadores: el guardia (solo) frente a la caseta con su linterna; el trío con su bulto de hallacas en la espalda */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: isSolo(k) ? 1.3 : 1.35 });
        S3.add(pj.g);
        var colA = s2.color && s2.color !== '#fff' ? s2.color : '#ffd23f';
        var aro = alPiso(plano(new T.RingGeometry(.62, .8, 20), colA, .85), .04); aro.visible = !isSolo(k); S3.add(aro);
        var bulto = null;
        if (!isSolo(k)) { bulto = new T.Group(); bulto.position.set(0, 1.02, -.46); pj.g.add(bulto);
          var hb = M(new T.BoxGeometry(.36, .3, .2), '#4a8a3a', { g: .06 }); bulto.add(hb);
          var cu1 = M(new T.BoxGeometry(.38, .04, .22), '#e8d8a8', { borde: false }); bulto.add(cu1); var cu2 = M(new T.BoxGeometry(.04, .32, .22), '#e8d8a8', { borde: false }); bulto.add(cu2); }
        var x3 = isSolo(k) ? GX : WX(P[k].x), z3 = isSolo(k) ? GZ : WZ(P[k].y);
        pjs.push({ pj: pj, aro: aro, colA: colA, bulto: bulto, x: x3, z: z3, px: x3, pz: z3, rumbo: Math.PI, ocC: false, latT: 0, estT: 0 });
      }
      var linterna = new T.Group(); pjs[soloI].pj.mano('der').add(linterna);
      var lgeo = new T.CylinderGeometry(.07, .1, .34, 8); lgeo.rotateX(Math.PI / 2);
      linterna.add(M(lgeo, '#2a2a34', { g: .06 }));
      var lente = new T.Mesh(new T.CircleGeometry(.09, 10), tn('#fffbe0', { em: '#fff6c0', emI: 2 })); lente.position.z = .175; linterna.add(lente);
      /* la luz de la linterna: SpotLight con sombra, el haz visible (cono aditivo) y el círculo en el piso (el mismo radio del juicio) */
      var spot = new T.SpotLight(0xfff2c0, pl.spot, 45, .2, .35, 1); spot.castShadow = true; spot.shadow.mapSize.set(512, 512); spot.shadow.camera.near = .5; spot.shadow.camera.far = 45; spot.shadow.bias = -.001;
      S3.add(spot); S3.add(spot.target);
      var hgeo = new T.ConeGeometry(1, 1, 24, 1, true); hgeo.translate(0, -.5, 0);
      var haz = plano(hgeo, 0xfff6b0, noche ? .13 : .08, true); S3.add(haz);
      var disco = alPiso(plano(new T.CircleGeometry(1, 36), 0xfffbd0, noche ? .3 : .22, true), .045); disco.scale.set(R * ESX, R * ESX * ZK, 1); S3.add(disco);
      var bordeL = alPiso(plano(new T.RingGeometry(.92, 1, 40), 0xfff6b0, .7), .05); bordeL.scale.set(R * ESX, R * ESX * ZK, 1); S3.add(bordeL);
      /* el ¡ALTO!: aro rojo que crece y un relleno que late; luego el fogonazo (disco, columna de luz y PointLight) */
      var aviso = alPiso(plano(new T.RingGeometry(.86, 1, 40), 0xff3b4e, .9), .06); aviso.visible = false; S3.add(aviso);
      var avisoF = alPiso(plano(new T.CircleGeometry(1, 36), 0xff3b4e, .25), .055); avisoF.visible = false; S3.add(avisoF);
      var flashD = alPiso(plano(new T.CircleGeometry(1, 36), 0xffffff, .7, true), .065); flashD.visible = false; S3.add(flashD);
      var flashC = plano(new T.CylinderGeometry(1, 1, 7, 24, 1, true), 0xfffbe0, .3, true); flashC.visible = false; S3.add(flashC);
      var flashL = new T.PointLight(0xffffff, 0, 14, 2); S3.add(flashL);
      /* la cruz del punto de mira (solo la ve el guardia) */
      var mira = new T.Group(); S3.add(mira);
      var miraA = alPiso(plano(new T.RingGeometry(.42, .52, 28), 0xffffff, .9), 0); mira.add(miraA);
      [[1.5, .1], [.1, 1.3]].forEach(function (r) { var cr = alPiso(plano(new T.PlaneGeometry(r[0], r[1]), 0xffffff, .85), .005); mira.add(cr); });
      mira.position.y = .07;
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      /* LOS EVENTOS: carros a la revisión (con la zona verde donde tapan), la gandola con su sombra, la neblina y el aguacero */
      var rev = [];
      for (k = 0; k < 6; k++) {
        var rc = carro3D(CARROS[(k * 2 + lv + 1) % CARROS.length], noche); rc.g.rotation.y = Math.PI; rc.g.visible = false; S3.add(rc.g);
        var zona = alPiso(plano(new T.PlaneGeometry(2 * (CAR.HW + CAR.TAPA) * ESX, 2 * (CAR.HH + 14) * ESZ), 0x5cff7a, .14), .035); S3.add(zona); zona.visible = false;
        rev.push({ g: rc.g, ruedas: rc.ruedas, stops: rc.stops, zona: zona, i: -1, rev0: false });
      }
      var ganT = V3.texturaCanvas(256, 64, function (x, w, h) { x.fillStyle = '#e8e2cc'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a4aa8'; x.fillRect(0, h - 12, w, 12); x.fillStyle = '#d9342e'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TRANSPORTE EL CATIRE', w / 2, h / 2 - 6); });
      var gnd = new T.Group(); gnd.visible = false; S3.add(gnd);
      var gLen = GAN.L * ESX, gAn = 2 * GAN.HH * ESZ;
      var trl = M(new T.BoxGeometry(gLen - 2.2, 2.6, gAn), '#e8e2cc', { g: .02, recibe: true }); trl.position.set(-1.1, 1.75, 0); gnd.add(trl);
      for (k = 0; k < 2; k++) { var lad = new T.Mesh(new T.PlaneGeometry(gLen - 2.4, 2.4), new T.MeshBasicMaterial({ map: ganT, side: T.DoubleSide })); lad.position.set(-1.1, 1.75, (k ? 1 : -1) * (gAn / 2 + .01)); gnd.add(lad); }
      var cab = M(new T.BoxGeometry(2.1, 2.3, gAn * .95), '#d9342e', { g: .03 }); cab.position.set(gLen / 2 - 1.05, 1.5, 0); gnd.add(cab);
      var vid = M(new T.BoxGeometry(.1, .8, gAn * .8), '#2a3450', { borde: false }); vid.position.set(gLen / 2 + .01, 2.05, 0); gnd.add(vid);
      for (k = 0; k < 2; k++) { var fg2 = new T.Mesh(new T.BoxGeometry(.08, .22, .4), tn('#fff6c0', { em: '#fff2a0', emI: 1.8 })); fg2.position.set(gLen / 2 + .03, .8, (k ? 1 : -1) * gAn * .32); gnd.add(fg2); }
      var gRu = [];
      for (k = 0; k < 10; k++) { var gr = M(new T.CylinderGeometry(.42, .42, .3, 10), '#1a1a22', { g: .05 }); gr.rotation.x = Math.PI / 2; gr.position.set(gLen / 2 - 1.2 - (k >> 1) * (gLen - 1.6) / 4.4, .42, (k % 2 ? 1 : -1) * (gAn / 2 - .1)); gnd.add(gr); gRu.push(gr); }
      var gHaz = alPiso(plano(new T.PlaneGeometry(6, 2.2), 0xfff2b0, noche ? .16 : .08, true), .03); gHaz.position.set(gLen / 2 + 3.2, 0, 0); gHaz.rotation.z = 0; gnd.add(gHaz);
      var gSom = alPiso(plano(new T.PlaneGeometry(gLen, (GAN.HH + GAN.SOM) * ESZ), 0x000008, .5), .04); gSom.visible = false; S3.add(gSom);
      var nieblas = [];
      for (k = 0; k < 12; k++) { var nb = alPiso(plano(new T.CircleGeometry(1, 18), 0xd8e0ff, 0), .4 + (k % 4) * .35); nb.scale.set(5 + (k % 3) * 2, 3 + (k % 2) * 1.5, 1); S3.add(nb); nb.visible = false; nieblas.push({ m: nb, x: -15 + (k * 7.3) % 30, z: -12 + (k * 5.1) % 26, v: .5 + (k % 3) * .3 }); }
      var lluvia = new T.Group(); lluvia.visible = false; S3.add(lluvia);
      var gota = new T.BoxGeometry(.025, .7, .025), mGota = new T.MeshBasicMaterial({ color: 0xa8b8ff, transparent: true, opacity: .55, depthWrite: false }), gotas = [];
      for (k = 0; k < 110; k++) { var gm = new T.Mesh(gota, mGota); gm.rotation.z = .15; gm.position.set(-26 + c.fx() * 52, c.fx() * 14, -26 + c.fx() * 40); lluvia.add(gm); gotas.push(gm); }
      var part = V3.particulas(esc, 500);
      esc.encuadrar(28, 14.5, new T.Vector3(0, .6, -1.1), .64);                  // la zona entera: del inicio (abajo) a la caseta (arriba)
      return { esc: esc, pjs: pjs, part: part, carros: carros, jeep: jeep, rev: rev, gnd: gnd, gRu: gRu, gSom: gSom, gLen: gLen, nieblas: nieblas, lluvia: lluvia, gotas: gotas,
        luces: luces, mats: mats, hemi0: pl.hemi[2], niebla0: [48, 125], faseV: 0, perroV: false, apagV: false, bandera: bandera, hojas: hojas, matas: matas, cocuyos: cocuyos, perro: perro, flechas: flechas, vend: vend,
        sirR: sirR, sirA: sirA, sirL: sirL, brazo: brazo, brazoA: -1.25, linterna: linterna, spot: spot, haz: haz, disco: disco, bordeL: bordeL,
        aviso: aviso, avisoF: avisoF, flashD: flashD, flashC: flashC, flashL: flashL, mira: mira, miraA: miraA, flecha: flecha,
        lamp: new T.Vector3(fx0 - 2.05, 5.7, fz0), polT: 0, altoV: {}, altoC: {}, paraT: -9, pasoT: -9, tmp: new T.Vector3(), dir: new T.Vector3(), abajo: new T.Vector3(0, -1, 0) };
    }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, k, j, p;
      var fin = now > 0 && (nPas >= need || now >= dur), ganaT = nPas >= need;
      V.part.update(dt);
      /* lo que se mueve solo: carros, bandera, sirena, intermitentes, palmeras, matas, cocuyos y polillas */
      for (k = 0; k < V.carros.length; k++) {
        var cr = V.carros[k], u = (t * cr.v + cr.o) % 112, z = cr.d > 0 ? -78 + u : 34 - u;
        if (cr.z < 900 && Math.abs(z - cr.z) < 5 && (cr.z - 6) * (z - 6) < 0) { var r0 = c.fx(); if (r0 < .3) V3.sfx('motor'); else if (r0 < .37) V3.sfx('bocina'); }
        cr.z = z; cr.g.position.set(cr.x, 0, z);
        for (j = 0; j < cr.ruedas.length; j++) cr.ruedas[j].rotation.x += dt * cr.v / .34;
      }
      var inter = Math.floor(t * 2.2) % 2 === 0;
      for (k = 0; k < V.jeep.stops.length; k++) V.jeep.stops[k].material.emissiveIntensity = inter ? 2 : .15;
      for (k = 0; k < V.bandera.length; k++) { var at = V.bandera[k].geometry.attributes.position; for (j = 0; j < at.count; j++) { var bx = at.getX(j); at.setZ(j, Math.sin(t * 5 - bx * 3) * .16 * bx / 1.8); } at.needsUpdate = true; }
      var fz3 = now > 0 ? fase(now) : 0, sirOn = Math.floor(t * (fz3 === 2 ? 9 : fz3 === 1 ? 6 : 4)) % 2 === 0;
      eventos3D(dt, now, t, fz3);
      var sinLuz = V.apagV;
      V.sirR.material.emissiveIntensity = sirOn && !sinLuz ? 2.2 : .15; V.sirA.material.emissiveIntensity = sirOn || sinLuz ? .15 : 2.2; V.sirL.color.setHex(sirOn ? 0xff3030 : 0x3050ff);
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .06;
      for (k = 0; k < V.matas.length; k++) V.matas[k].rotation.z = Math.sin(t * 1.6 + k * 2) * .035;
      for (k = 0; k < V.vend.length; k++) V.vend[k].brazo.rotation.x = -.5 + Math.sin(t * 3.2 + k * 2.1) * .45;   // los vendedores pregonan (saludan con el brazo)
      for (k = 0; k < V.flechas.length; k++) V.flechas[k].material.opacity = .35 + .45 * Math.max(0, Math.sin(t * 5 - k * 1.4));
      for (k = 0; k < V.cocuyos.length; k++) { var co = V.cocuyos[k]; co.m.position.set(co.x + Math.sin(t * .7 + k) * 1.1, .7 + Math.sin(t * 1.3 + k * 2) * .45, co.z + Math.cos(t * .9 + k) * .8); co.m.visible = Math.sin(t * 2.3 + k * 1.7) > -.2; }
      V.polT -= dt; if (V.polT < 0 && !V.apagV) { V.polT = .3; V.part.soltar(V.lamp.x, V.lamp.y - .3, V.lamp.z, 1, { k: 'chispa', cols: ['#fff6c0', '#e8e0b0'], vel: .9, arriba: .4, g: 0, vida: 1.2, esc: .3, suelo: false }); }
      /* el ¡ALTO!: aviso (silbato + gesto del guardia), fogonazo (sonido, chispas, sacudida) y la talanquera que baja */
      var gp = V.pjs[soloI].pj, av = avisando(now), ca = cayendo(now);
      for (j = 0; j < fl.length; j++) {
        var fj = fl[j]; if (!fj) continue;
        if (!V.altoV[j] && now >= fj.tl - WIND - .05 && now < fj.tl + FT) { V.altoV[j] = 1; gp.uno('lanzar'); V3.sfx('silbato'); }
        if (!V.altoC[j] && now >= fj.tl && now < fj.tl + FT + .2) { V.altoC[j] = 1; V3.sfx('chispa'); V3.sfx('golpe'); V.esc.sacudir(.45);
          V.part.soltar(WX(fj.x), .3, WZ(fj.y), 30, { k: 'chispa', cols: ['#ffffff', '#fff6b0', '#ff3b4e'], vel: 6, arriba: 3, vida: .6 }); }
      }
      V.aviso.visible = !!av; V.avisoF.visible = !!av;
      if (av) {
        var ua = cl(1 - (av.tl - now) / WIND, 0, 1), ra = RF * ESX * (.35 + .65 * ua);
        V.aviso.position.set(WX(av.x), .06, WZ(av.y)); V.aviso.scale.set(ra, ra * ZK, 1);
        V.avisoF.position.set(WX(av.x), .055, WZ(av.y)); V.avisoF.scale.set(RF * ESX, RF * ESX * ZK, 1); V.avisoF.material.opacity = .15 + .2 * Math.abs(Math.sin(t * 14));
      }
      V.flashD.visible = !!ca; V.flashC.visible = !!ca; V.flashL.intensity = 0;
      if (ca) {
        var wf = cl(1 - (now - ca.tl) / FT, 0, 1), fx3 = WX(ca.x), fz3 = WZ(ca.y);
        V.flashD.position.set(fx3, .065, fz3); V.flashD.scale.set(RF * ESX, RF * ESX * ZK, 1); V.flashD.material.opacity = .75 * wf;
        V.flashC.position.set(fx3, 3.5, fz3); V.flashC.scale.set(RF * ESX * (.7 + .3 * wf), 1, RF * ESX * ZK * (.7 + .3 * wf)); V.flashC.material.opacity = .3 * wf;
        V.flashL.position.set(fx3, 2.2, fz3); V.flashL.intensity = 3.5 * wf;
      }
      var brT = ca ? -.06 : av ? -.55 : (t - V.pasoT < .7 ? -1.45 + Math.sin((t - V.pasoT) * 22) * .12 : -1.25);
      V.brazoA += (brT - V.brazoA) * Math.min(1, dt * (ca ? 18 : 5)); V.brazo.rotation.z = V.brazoA;
      /* el perro */
      if (V.perro) { var pv = perroEn(now); V.perro.g.visible = pv; V.perro.aro.visible = pv;
        if (pv && !V.perroV) { V.part.soltar(WX(dogAt(now).x), .4, WZ(dogAt(now).y), 18, { k: 'confeti', cols: ['#b8a070', '#8a6a4a'], vel: 3, arriba: 2, g: 6, vida: .6 }); if (now > 0) { V3.sfx('golpe'); V3.sfx('tambor'); } }
        V.perroV = pv; }
      if (V.perro && V.perroV) {
        var dg = dogAt(now), dgN = dogAt(now + .1), dd = dgN.x >= dg.x ? 1 : -1;
        V.perro.g.position.set(WX(dg.x), 0, WZ(dg.y)); V.perro.g.rotation.y = dd > 0 ? Math.PI / 2 : -Math.PI / 2;
        for (j = 0; j < 4; j++) V.perro.patas[j].rotation.x = Math.sin(t * 14 + ((j % 2) + (j > 1 ? 1 : 0)) * Math.PI) * .6;
        V.perro.cola.rotation.y = Math.sin(t * 16) * .6; V.perro.aro.position.set(WX(dg.x), .04, WZ(dg.y));
        V.perro.aro.material.opacity = .35 + .25 * Math.abs(Math.sin(t * 6));
      }
      /* la luz: dónde cae (la misma de la simulación) y quién está debajo */
      var L = luz(), lx = WX(L.x), lz = WZ(L.y), pill = false, Rn = radio(now);
      for (k = 0; k < trio.length; k++) { p = trio[k]; var qq = P[p]; if (passed[p] || qq.remPs || stV(p, now) || aSalvo(p, now)) continue; if (dE(qq.x, qq.y, L.x, L.y) < Rn) pill = true; }
      /* el guardia: mira hacia su luz; pita con la mano en alto en el aviso; celebra o se pone triste al final */
      var s0 = V.pjs[soloI];
      if (fin) gp.anim(ganaT ? 'triste' : 'celebrar').cara(ganaT ? 'triste' : 'feliz');
      else if (av) gp.anim('saludar').cara('enojado');
      else gp.anim('quieto').cara(now - V.paraT < 1.4 ? 'feliz' : pill ? 'enojado' : 'concentrado');
      gp.rumbo(fin ? 0 : Math.atan2(lx - GX, lz - GZ)).update(dt);
      gp.g.position.set(GX, 0, GZ); s0.x = GX; s0.z = GZ;
      gp.g.updateMatrixWorld(true);
      V.linterna.lookAt(lx, 0, lz); V.linterna.updateMatrixWorld(true); V.linterna.getWorldPosition(V.tmp);
      var o = V.tmp, Rw = Rn * ESX;
      V.dir.set(lx - o.x, -o.y, lz - o.z); var len = V.dir.length() || 1; V.dir.multiplyScalar(1 / len);
      V.spot.position.copy(o); V.spot.target.position.set(lx, 0, lz); V.spot.angle = Math.min(1.2, Math.atan(Rw * 1.15 / len)); V.spot.intensity = PAL3[lv].spot * (fin && ganaT ? .5 : 1) * (V.apagV ? .75 : 1);
      V.haz.position.copy(o); V.haz.quaternion.setFromUnitVectors(V.abajo, V.dir); V.haz.scale.set(Rw, len, Rw);
      V.disco.position.set(lx, .045, lz); V.bordeL.position.set(lx, .05, lz); V.disco.scale.set(Rw, Rw * ZK, 1); V.bordeL.scale.set(Rw, Rw * ZK, 1);
      V.disco.material.color.setHex(pill ? 0xffb070 : 0xfffbd0); V.bordeL.material.color.setHex(pill ? 0xff6a4a : 0xfff6b0);
      V.bordeL.material.opacity = pill ? .6 + .35 * Math.abs(Math.sin(t * 12)) : .7;
      /* el trío */
      for (k = 0; k < trio.length; k++) {
        p = trio[k]; var q = P[p], s3 = V.pjs[p], pj = s3.pj, tx = WX(q.x), tz = WZ(q.y);
        var brinco = Math.abs(tz - s3.z) > 2.5;                                             // lo devolvieron al inicio
        if (brinco) V.part.soltar(tx, .5, tz, 12, { k: 'confeti', cols: ['#fffdf2', '#c9c4d8'], vel: 2, arriba: 2, g: 5, vida: .6 });
        s3.x = tx; s3.z = tz;
        var vx = brinco ? 0 : (s3.x - s3.px) / dt, vz = brinco ? 0 : (s3.z - s3.pz) / dt, v = Math.sqrt(vx * vx + vz * vz); s3.px = s3.x; s3.pz = s3.z;
        if (v > .4) s3.rumbo = Math.atan2(vx, vz);
        var pas = !!passed[p] || !!q.remPs, st = !pas && !!stV(p, now), ag = !pas && !st && !!agV(p), cvN = coverNear(q.x, q.y), oc = ag && !!cvN;
        var enLuz = !pas && !oc && !st && dE(q.x, q.y, L.x, L.y) < R;
        if (oc !== s3.ocC) {
          s3.ocC = oc;
          if (oc) { V.part.soltar(tx, .9, tz, 7, { k: 'confeti', cols: cvN.k ? ['#3a8a4a', '#4aa05a', '#2f6a3f'] : ['#ff7a1a', '#fffdf2'], vel: 1.6, arriba: 2, g: 6, vida: .6 }); if (p === c.yo) V3.sfx('tic'); }
        }
        if (fin) pj.anim(ganaT ? (pas ? 'celebrar' : 'bailar') : 'triste').cara(ganaT ? 'feliz' : 'triste');
        else if (st) pj.anim('sentado').cara('mareado');
        else if (pas) pj.anim('bailar').cara('feliz');
        else if (ag) pj.anim(v > .4 ? 'empujar' : 'sentado', { vel: Math.min(1, v / 2) }).cara(enLuz ? 'susto' : 'concentrado');
        else pj.anim(v > 2.4 ? 'correr' : v > .4 ? 'caminar' : 'quieto', { vel: Math.min(1, v / 4) }).cara(enLuz ? 'susto' : 'normal');
        pj.rumbo(pas || fin ? 0 : s3.rumbo).update(dt);
        pj.g.position.set(tx, 0, tz);
        s3.bulto.position.y = pj.animacion === 'sentado' ? .8 : 1.02;
        s3.aro.position.set(tx, .04, tz); s3.aro.material.color.set(oc ? '#5cff7a' : enLuz ? '#ff3b4e' : s3.colA);
        if (st) { s3.estT -= dt; if (s3.estT < 0) { s3.estT = .22; V.part.soltar(tx, 2.7, tz, 1, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 1.2, arriba: .6, g: 0, vida: .5, suelo: false }); } }
        if (p === c.yo && c.mio(p) && q.ex > .05 && !st && !pas) { s3.latT -= dt; if (s3.latT < 0) { s3.latT = .36; V3.sfx('latido'); } } else s3.latT = 0;
      }
      /* la flecha sobre mí y la cruz del guardia */
      var yo = c.yo >= 0 && c.yo < n ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !fin;
      if (yo) V.flecha.position.set(yo.x, (c.yo === soloI ? 4.0 : 3.9) + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      var miraOn = c.yo === soloI && c.mio(soloI) && now >= -.5 && !fin, listo = now >= P[soloI].nextF && now >= FIRST && !av && !ca && siguienteF() < MAXF;
      V.mira.visible = !!miraOn;
      if (miraOn) { V.mira.position.set(WX(P[soloI].ax), .07, WZ(P[soloI].ay)); V.miraA.material.color.setHex(listo ? 0x5cff7a : 0xffffff); V.mira.scale.setScalar(1 + (listo ? .08 * Math.sin(t * 10) : 0)); }
    }
    function eventos3D(dt, now, t, fz3) {                      // carros a la revisión, gandola, apagón, neblina, aguacero y los cambios de fase
      var V = v3, k, j;
      /* fase: la música se acelera en los últimos segundos; el aguacero */
      if (fz3 !== V.faseV) { V.faseV = fz3; }
      V.lluvia.visible = fz3 === 2;
      if (V.lluvia.visible) for (k = 0; k < V.gotas.length; k++) { var gm = V.gotas[k]; gm.position.y -= dt * 22; gm.position.x += dt * 3; if (gm.position.y < 0) { gm.position.y += 14; gm.position.x = -26 + ((k * 7.31 + t * 3) % 52); if (k % 9 === 0) V.part.soltar(gm.position.x, .05, gm.position.z, 1, { k: 'gota', cols: ['#a8b8ff'], vel: .8, arriba: 1.2, g: 9, vida: .3, esc: .4 }); } }
      /* los carros a la revisión */
      for (k = 0; k < V.rev.length; k++) { V.rev[k].g.visible = false; V.rev[k].zona.visible = false; }
      for (k = 0; k < carros.length; k++) {
        var cq = carroEn(carros[k], now, true); if (!cq) continue;
        var rv = V.rev[k % V.rev.length]; rv.g.visible = true; rv.g.position.set(WX(cq.x), 0, WZ(cq.y));
        var mov = !cq.rev; for (j = 0; j < rv.ruedas.length; j++) if (mov) rv.ruedas[j].rotation.x -= dt * (cq.y > CAR.YST ? CAR.V1 : CAR.V2) * ESZ / .34;
        for (j = 0; j < rv.stops.length; j++) rv.stops[j].material.emissiveIntensity = cq.rev ? 2.2 : .5;
        rv.zona.visible = cq.y > BAR + 10 && cq.y < SH + 10; rv.zona.position.set(WX(cq.x), .035, WZ(cq.y)); rv.zona.material.opacity = .1 + .08 * Math.abs(Math.sin(t * 4));
        if (cq.rev && rv.i !== k) { rv.i = k; V3.sfx('bocina'); V.pjs[soloI].pj.uno('lanzar'); }
      }
      /* la gandola */
      var gg = null; for (k = 0; k < gand.length; k++) { gg = gandolaEn(gand[k], now); if (gg) break; }
      V.gnd.visible = !!gg; V.gSom.visible = !!gg;
      if (gg) {
        V.gnd.position.set(WX(gg.x), 0, WZ(gg.y)); V.gnd.rotation.y = gg.d > 0 ? 0 : Math.PI;
        for (j = 0; j < V.gRu.length; j++) V.gRu[j].rotation.y += dt * GAN.V * ESX / .42 * gg.d;
        V.gSom.position.set(WX(gg.x), .04, WZ(gg.y + (GAN.HH + GAN.SOM) / 2 + 2)); V.gSom.material.opacity = .42 + .06 * Math.sin(t * 3);
        V.esc.sacudir(.06);
      }
      /* el apagón del poste: parpadeo de aviso, se apaga todo (farol, ventanas, sirena, reflector) y vuelve con chispas */
      var off = apagado(now), parp = !off && now >= apag.t0 - ESC.AV && now < apag.t0 && Math.floor(t * 14) % 3 === 0;
      if (off !== V.apagV) { V.apagV = off; V.part.soltar(V.lamp.x, V.lamp.y, V.lamp.z, 22, { k: 'chispa', cols: ['#fff6c0', '#ffd23f', '#ffffff'], vel: 4, arriba: 2, vida: .7 }); if (off) V.esc.sacudir(.35); }
      var fk = off || parp ? 0 : 1;
      for (k = 0; k < V.luces.length; k++) V.luces[k].l.intensity = V.luces[k].b * (fk ? 1 : .04);
      for (k = 0; k < V.mats.length; k++) V.mats[k].m.emissiveIntensity = V.mats[k].b * (fk ? 1 : .05);
      V.esc.luces.hemi.intensity = V.hemi0 * (off ? .55 : 1);
      /* la neblina: la niebla de la escena se acerca y pasan nubes bajitas */
      var nbl = neblina(now) ? 1 : 0, sc = V.esc.scene;
      V.nbT = (V.nbT || 0) + (nbl - (V.nbT || 0)) * Math.min(1, dt * 1.5);
      if (sc.fog) { sc.fog.near = V.niebla0[0] - 34 * V.nbT; sc.fog.far = V.niebla0[1] - 80 * V.nbT; }
      for (k = 0; k < V.nieblas.length; k++) { var nb = V.nieblas[k]; nb.m.visible = V.nbT > .02; nb.m.material.opacity = .2 * V.nbT; nb.m.position.x = -18 + ((nb.x + 18 + t * nb.v) % 36); nb.m.position.z = nb.z; }
    }
    function enPantalla(x, y, alto, dy2) {                    // dónde poner un aviso (S/say): proyectado desde el 3D o, en 2D, como siempre
      if (v3) return v3.esc.proyectar(WX(x), alto, WZ(y));
      return scr(geom(), x, y + dy2);
    }
    function marcador3D(f, now) {                              // PASARON (los bultos) arriba, la recarga del ¡ALTO! del guardia y la regla en 3 segundos
      var cx = (f.x0 + f.x1) / 2, my = 84, k, yo = c.yo;
      txt('PASARON', cx - 82, my, 14, '#fffdf2', 0, true);
      for (k = 0; k < nt; k++) { var bx = cx - 26 + k * 28, ok = !!passed[trio[k]]; rr(bx - 10, my - 8, 20, 16, 4, ok ? '#5cff7a' : 'rgba(255,253,242,.22)', 2.5); line([[bx, my - 8], [bx, my + 8]], 2, ok ? '#2f6a3f' : 'rgba(20,16,28,.5)'); line([[bx - 10, my], [bx + 10, my]], 2, ok ? '#2f6a3f' : 'rgba(20,16,28,.5)'); }
      txt(nPas + '/' + need, cx - 26 + nt * 28 + 14, my, 20, nPas >= need ? '#5cff7a' : '#ffd23f', 0, true);
      if (yo === soloI && now >= 0) {
        var rest = Math.max(0, P[soloI].nextF - now), lis = rest <= 0 && !avisando(now) && !cayendo(now) && now >= FIRST && siguienteF() < MAXF;
        rr(cx - 40, my + 18, 80, 8, 4, 'rgba(20,16,28,.5)', 0); rr(cx - 40, my + 18, 80 * (1 - cl(Math.max(rest, FIRST - now) / cdAt(now), 0, 1)), 8, 4, lis ? '#5cff7a' : '#ffd23f', 0);
        txt(lis ? '¡ALTO! LISTO (A)' : '¡ALTO! recargando', cx, my + 38, 12, lis ? '#5cff7a' : '#fffdf2', 0, true);
      }
      if (c.practica) return;
      if (now > -0.5 && now < 2.4) txt(soloI === yo ? '¡NO LOS DEJES PASAR!' : '¡CRUZA LA RAYA SIN QUE TE VEA LA LINTERNA!', cx, 150, soloI === yo ? 22 : (f.x1 - f.x0 < 500 ? 12 : 17), '#fffdf2', 0, true);
      else if (now >= 2.4 && now < 6.5 && yo >= 0 && yo < n) txt(yo === soloI ? 'LA LUZ LOS PARA · A = ¡ALTO! DONDE ESTÁ LA CRUZ' : 'MANTÉN A JUNTO A UN CONO O UNA MATA = ESCONDIDO', cx, 150, f.x1 - f.x0 < 500 ? 11 : 15, '#ffd23f', 0, true);
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k, E = v3.esc; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !(nPas >= need) && now < dur) V3.musica(fase(now) === 2 ? 'alcabala3' : 'alcabala');
      E.render(dt);
      for (k = 0; k < n; k++) {                                // nombres debajo de cada uno
        var s3 = v3.pjs[k], pt = E.proyectar(s3.x, 0, s3.z + 1.1);
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      for (k = 0; k < 2; k++) { var pg = E.proyectar(WX(gates[k]), 0, WZ(BAR + 30)); txt('PASE', pg.x, pg.y, 11, '#7dff9a', 0, true); }
      var pp = E.proyectar(WX(SW - 60), 0, WZ(LINE_Y - 16)); txt('¡PROSIGA!', pp.x, pp.y, 13, '#7dff9a', 0, true);
      var av = avisando(now);
      if (av) { var ua = cl(1 - (av.tl - now) / WIND, 0, 1), pa = E.proyectar(WX(av.x), .4, WZ(av.y)); txt('¡ALTO!', pa.x, pa.y, 18 + 6 * ua, '#fffdf2', 0, true); }
      var yo = c.yo;
      if (yo >= 0 && yo < n && !isSolo(yo) && !passed[yo] && now >= 0) {   // mi medidor de «¡TE VEN!» y el aviso de ESCONDIDO
        var q = P[yo], sy = v3.pjs[yo], hid = aSalvo(yo, now);
        if (hid) { var ph = E.proyectar(sy.x, 2.6, sy.z); txt('ESCONDIDO', ph.x, ph.y, 11, '#7dff9a', 0, true); }
        if (q.ex > 0.02) { var pv = E.proyectar(sy.x, 3.3, sy.z), bw = 44, fr = cl(q.ex / CATCH, 0, 1); rr(pv.x - bw / 2, pv.y, bw, 8, 3, 'rgba(20,16,28,.6)', 0); rr(pv.x - bw / 2, pv.y, bw * fr, 8, 3, fr > 0.6 ? '#ff4a3a' : '#ffd23f', 0); txt('¡TE VEN!', pv.x, pv.y - 12, 12, '#ff6a5a', 0, true); }
      }
      var cs3 = carrosEn(now);
      for (k = 0; k < cs3.length; k++) if (cs3[k].rev) { var pr = E.proyectar(WX(cs3[k].x), 2.4, WZ(cs3[k].y)); txt('REVISIÓN', pr.x, pr.y, 11, '#ffd23f', 0, true); }
      marcador3D(f, now);
      var cx3 = (f.x0 + f.x1) / 2;
      estado(cx3, 172, now); cartel(cx3, 214);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ff3b4e', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }

    function avisa(a, now) {                                  // el cartel y el sonido de cada evento (cosmético; el evento en sí ya está programado)
      if (a.tx) banner = { tx: a.tx, sub: a.sub, col: a.col, t: absT };
      if (a.k === 'fase') { shake = Math.max(shake, 0.8); flash = Math.max(flash, 0.35); }
      if (v3) {
        if (a.k === 'fase') { V3.sfx('tambor'); V3.sfx('silbato'); v3.esc.sacudir(.7); }
        else if (a.k === 'niebla') V3.sfx('viento');
        else if (a.k === 'apagon') V3.sfx('chispa');
        else if (a.k === 'luz') { V3.sfx('ding'); V3.sfx('chispa'); }
        else if (a.k === 'gandola') { V3.sfx('bocina'); V3.sfx('motor'); v3.esc.sacudir(.25); }
        else if (a.k === 'carro') { V3.sfx('motor'); if (a.tx) V3.sfx('bocina'); }
      } else {
        if (a.k === 'fase') { SND(520, 0.18, 'square', 0.07, 260); SND(780, 0.3, 'square', 0.06, 200); }
        else if (a.k === 'gandola') SND(210, 0.5, 'sawtooth', 0.06, -30);
        else if (a.k === 'apagon') SND(900, 0.2, 'square', 0.04, -700);
        else if (a.k === 'carro' && a.tx) SND(420, 0.3, 'sawtooth', 0.05, 0);
      }
    }
    function cartel(cx, y) {                                  // el cartel grande del evento o de la fase (aparece con un saltito y se desvanece)
      if (!banner || c.practica) return;
      var e = absT - banner.t; if (e < 0 || e > BANNER) return;
      var a = e > BANNER - 0.4 ? (BANNER - e) / 0.4 : 1, sz = e < 0.18 ? 0.6 + e / 0.18 * 0.5 : e < 0.3 ? 1.1 - (e - 0.18) / 0.12 * 0.1 : 1;
      ctx.save(); ctx.globalAlpha = a;
      rr(cx - 170, y - 24, 340, banner.sub ? 52 : 36, 10, 'rgba(20,16,28,.72)', 0);
      txt(banner.tx, cx, y - 6, 24 * sz, banner.col, 0, true);
      if (banner.sub) txt(banner.sub, cx, y + 16, 13, '#fffdf2', 0, true);
      ctx.restore();
    }
    function estado(cx, y, now) {                              // lo que está pasando ahora mismo (una línea): apagón, neblina, gandola, fase 3
      var s0 = apagado(now) ? 'SIN LUZ: la linterna alumbra menos · sin ¡ALTO!' : neblina(now) ? 'NEBLINA: la linterna tarda más en verte' : enCurso(now) ? 'GANDOLA: su sombra tapa la luz' : '';
      if (s0) txt(s0, cx, y, 12, apagado(now) ? '#ffd23f' : '#c9d8ff', 0, true);
      if (fase(now) === 2 && now < dur && !(nPas >= need)) txt('¡ÚLTIMOS SEGUNDOS! ' + Math.max(0, Math.ceil(dur - now)), cx, y + 16, 13 + 2 * Math.abs(Math.sin(absT * 6)), '#ff6a5a', 0, true);
    }
    function enCurso(now) { var k; for (k = 0; k < gand.length; k++) if (gandolaEn(gand[k], now)) return true; return false; }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, G = geom();
        absT += dt; flash = Math.max(0, flash - dt * 2.5); shake = Math.max(0, shake - dt * 3);
        for (p = 0; p < n; p++) {
          var q = P[p]; q.vx = q.vx * 0.7 + ((q.x - q.px) / Math.max(dt, 1e-3)) * 0.3; q.vy = q.vy * 0.7 + ((q.y - (q.py == null ? q.y : q.py)) / Math.max(dt, 1e-3)) * 0.3; q.px = q.x; q.py = q.y;
        }
        for (p = 0; p < n; p++) updPos(p, dt, now);
        for (var m = 0; m < mias.length; m++) if (mias[m].n < 3 && now - mias[m].last >= 1.2) { mias[m].last = now; mias[m].n++; c.send('xalto', mias[m].d, false); }
        lh.push({ t: now, x: P[soloI].x, y: P[soloI].y }); if (lh.length > 40) lh.shift();
        if (now >= 0.2 && !voz.ini) { voz.ini = 1; if (!c.practica) { var sp = v3 ? v3.esc.proyectar(GX, 3.6, GZ) : scr(G, SW / 2 + 70, -10); S('¿Y QUÉ LLEVA EN ESE BULTO, CIUDADANO?', sp.x, sp.y, '#ffd23f'); } }
        while (avI < avisos.length && now >= avisos[avI].t) { var av0 = avisos[avI++]; if (now - av0.t < 1.2) avisa(av0, now); }
        if (now >= 2.8 && !voz.res) { voz.res = 1; if (!c.practica && trio.length) { var t0 = P[trio[0]], sr = enPantalla(t0.x, t0.y, 3.4, -70); S('…HALLACAS, OFICIAL.', sr.x, sr.y, '#fffdf2'); } }
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (isSolo(p)) aiSolo(p, dt, api, now); else aiTrio(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p], now = c.ahora();
        if (isSolo(p)) return { x: Math.round(q.x), y: Math.round(q.y), ag: 0, st: amenaza(now) ? 1 : 0, ps: 0 };
        return { x: Math.round(q.x), y: Math.round(q.y), ag: q.ag ? 1 : 0, st: now < q.stun ? 1 : 0, ps: q.ps ? 1 : 0 };
      },
      onEv: function (ty, p, d, t) {
        if (!num(p) || p < 0 || p >= n || isSolo(p)) return;
        var q = P[p], now = c.ahora(), G = geom();
        if (ty === 'para') {
          if (!d || !num(d.n) || d.n <= q.nPar || q.ps || passed[p]) return;
          q.nPar = d.n; totalPar++;
          if (c.mio(p)) { q.stun = now + PERILLA.STUN; q.y = START_Y; q.ex = 0; q.ag = 0; }
          shake = p === c.yo ? 0.6 : 0.2; flash = p === c.yo ? 0.8 : 0.25;
          var sa = v3 ? v3.esc.proyectar(GX, 3.6, GZ) : scr(G, q.x + 10, q.y - 80);              // en 3D el grito sale del guardia
          S(GRITOS_PARA[(totalPar + p) % GRITOS_PARA.length], sa.x, sa.y, '#ff6a5a');
          if (v3) {                                         // lo pararon: se cae mareado con estrellitas, el guardia festeja y la cámara se sacude
            var s3 = v3.pjs[p]; s3.pj.uno('caer');
            v3.part.soltar(s3.x, 2.2, s3.z, 16, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff7a1a'], vel: 3, arriba: 3, vida: .7 });
            v3.part.soltar(s3.x, 1.5, s3.z, 10, { k: 'confeti', cols: ['#ff3b4e', '#ffd23f'], vel: 3, arriba: 3, g: 8, vida: .7 });
            V3.sfx('error'); v3.esc.sacudir(p === c.yo ? 1 : .45); v3.paraT = now; v3.pjs[soloI].pj.uno('festejo');
          } else { var sb = scr(G, q.x, q.y - 30); SPAWN(sb.x, sb.y, 10, 'conf', ['#ffd23f', '#ff7a1a', '#fff'], 260, 480, 0.7); SND(170, 0.25, 'sawtooth', 0.08, -90); }
        } else if (ty === 'paso') {
          if (passed[p]) return;
          passed[p] = 1; nPas++; q.ps = 1;
          if (nPas >= need && pasAt < 0) pasAt = now;
          var sc2 = enPantalla(q.x, q.y, 3.6, -80);
          S(GRITOS_PASO[(nPas + p) % GRITOS_PASO.length], sc2.x, sc2.y, '#7dff9a');
          if (v3) {                                         // pasó: festejo de una vez, confeti, la talanquera saluda; aplausos si ya ganó el trío
            var s4 = v3.pjs[p]; s4.pj.uno('festejo'); v3.pasoT = absT;
            v3.part.soltar(s4.x, 1.6, s4.z, 30, { k: 'confeti', cols: ['#7dff9a', '#ffd23f', '#fffdf2', '#3fb0ff'], vel: 4, arriba: 5, g: 6, vida: 1.2 });
            V3.sfx('ding'); if (nPas >= need) V3.sfx('aplauso');
          } else { var sd = scr(G, q.x, q.y - 40); SPAWN(sd.x, sd.y, 14, 'conf', ['#7dff9a', '#ffd23f', '#fff'], 300, 520, 0.9); SND(660, 0.2, 'square', 0.06, 200); }
        }
      },
      alCpu: function (p) { plan[p] = { tgt: null, re: -9, err: 0, errT: -9, imp: 0, esp: 0, fl: -9 }; P[p].grace = c.ahora() + GRACIA_CPU; if (isSolo(p)) aimDesdeLuz(P[p]); },
      alHum: function (p, o) { if (isSolo(p)) aimDesdeLuz(P[p]); else if (o && num(o.x) && num(o.y)) { P[p].x = o.x; P[p].y = o.y; } plan[p].tgt = null; },
      scores: function () {                                  // aditivo y comparable (M3 DM3-3): el ganador lo decide compara('1v3', …), no este archivo
        var out = [], p, v = nt - nPas;
        for (p = 0; p < n; p++) out.push(isSolo(p) ? PTS * v : PTS * W - PTS / 2);
        return out;
      },
      done: function () {                                    // fin temprano: ya pasaron los necesarios (con 0,9 s de festejo)
        var now = c.ahora();
        return nPas >= need && pasAt >= 0 && now >= pasAt + CELEBRA;
      },
      hudChip: function (p) {
        if (isSolo(p)) return nPas + '/' + need;
        if (passed[p]) return 'PASÓ';
        return P[p].nPar ? '×' + P[p].nPar : 'VA';
      },
      destacado: function () {
        var me = c.yo >= 0 ? c.yo : 0;
        if (isSolo(me)) return nPas >= need ? 'se le coló el trío' : 'paró ' + totalPar + ' vez' + (totalPar === 1 ? '' : 'es');
        return passed[me] ? '¡pasó la alcabala!' : P[me].nPar ? 'te pararon ' + P[me].nPar + ' vez' + (P[me].nPar === 1 ? '' : 'es') : 'no te vieron';
      },
      vista: function () {                                   // observable para bancos y pruebas
        var now = c.ahora();
        return { gt: now, lv: lv, R: R, RF: RF, soloI: soloI, need: need, nPas: nPas, gana: nPas >= need, totalPar: totalPar, cov: cov.length,
          altos: fl.filter(Boolean).map(function (s) { return [s.i, s.x, s.y, s.tl]; }),
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), paradas: P.map(function (q) { return q.nPar; }),
          pasaron: P.map(function (q, i) { return passed[i] ? 1 : 0; }), nextF: P[soloI].nextF, aim: [P[soloI].ax, P[soloI].ay], ag: P.map(function (q) { return q.ag; }), ex: P.map(function (q) { return q.ex; }),
          dog: perroEn(now) ? dogAt(now) : null, fase: fase(now), apagado: apagado(now), neblina: neblina(now), carros: carrosEn(now).map(function (k) { return [k.x, k.y, k.rev ? 1 : 0]; }),
          gandolas: gand.map(function (k) { return [k.t0, k.y, k.d]; }), apag: [apag.t0, apag.t1], nieb: [nieb.t0, nieb.t1], nCarros: carros.length, covers: cov.map(function (k) { return [k.x, k.y, k.r]; }) };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        dibujar2D();
      }
    };
    function ellP(x, y, rx, ry, m) { var o = [], a; for (a = 0; a <= m; a++) o.push([x + Math.cos(a / m * 6.2832) * rx, y + Math.sin(a / m * 6.2832) * ry]); return o; }
    return g;
  }
});
})();
