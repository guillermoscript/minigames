'use strict';
/* LA FIESTA · EN VIVO · f_cava · ¡CARGA LA CAVA!  (2v2 cooperativo, modelo B: dueño + juez)
   Playa con sol, palmeras y una CAVA de anime. Cada equipo se reparte DOS ROLES (el de menor asiento del equipo lanza, el otro atrapa):
     LANZADOR  stick = apuntar (arriba/abajo = ángulo; hacia la cava = más potencia, hacia atrás = menos), A = soltar. EL PULSO TIEMBLA: la potencia real es la del stick más
               un vaivén pulso(t) (función pura del tiempo, más ancho y rápido en cada fase), así que el aro de caída va y viene y hay que SOLTAR A TIEMPO cuando pasa por la cava.
               Cola de objetos igual para los dos equipos (c.rng): hielo (1 pt), refresco (2 pt) y, en el nivel 3, botella de vidrio (-2 si cae en la cava).
     RECEPTOR  stick = mover la cava (pesa más mientras más lleva); A = ¡ESPANTAR! a la gaviota o ¡PATEAR! la pelota de los chamos. La SOMBRA de la sombrilla se pasea por cada
               carril: lo que se atrapa a la sombra vale +1. Lo que no cae en la cava REBOTA una vez en la arena (hielo 44 px, lata 56 px hacia adelante; la botella no) y se puede
               atrapar en el rebote (vale 1). RACHA: cada 3ª atrapada seguida (2ª en los últimos segundos) +1; fallar la corta.
   Escalada (pura de c.ahora()/dur): CALMA (0-35 %), ¡SE ALBOROTA LA PLAYA! (35-72 %: más pulso, más viento, más eventos) y ¡ÚLTIMOS SEGUNDOS! (72-100 %: recarga ×0,75,
   racha cada 2, y cada cosa que se cae a la arena RESTA 1). Eventos de playa sembrados en mk() con c.rng (avisados 0,9 s antes): OLA (empuja las cavas, lo que cae al agua no rebota),
   HELADERO (cruza la playa y se queda con lo que caiga a ±26 px de él) y PELOTA de los chamos (sale del medio hacia cada orilla: si toca la cava, ¡PELOTAZO!, la empuja y resta 1;
   A cerca de ella la patea). Todo eso es función pura del tiempo: las pantallas lo dibujan igual y el receptor lo aplica a SU cava.
   Red. El tiro es DETERMINISTA: ev `tiro {a, f, t, ty, n}` (ángulo y potencia REAL ×1000, ms de gt al soltar, tipo, nº de tiro del equipo) y todas las pantallas calculan la misma
   trayectoria con vuelo(equipo, a, f, t) (el viento es función pura del tiempo, así que la vista previa del lanzador es EXACTA). El RECEPTOR juzga su propia atrapada a la hora de
   aterrizaje (y del rebote) contra SU historial de posiciones (si el ev llega tarde se juzga igual, hacia atrás) y publica ev `cogio {id, v, z, ty, b, s, r}` con el total de su cava,
   un contador z (el mayor z gana: sobrevive a pérdidas y al cambio de juez), b = en el rebote, s = a la sombra, r = racha. Pérdidas (gaviota, pelotazo, caída en el frenesí) van por
   ev `roba {v, z, s, k}` (k: 'm' caída, 'p' pelotazo). Patada: ev `patea {i}` (solo dibujo). El mismo total y z viajan en su cuerpo `o`. Un tiro sin `cogio` cae en la arena.
   Gaviota (la maneja el JUEZ): a las horas sembradas elige la cava MÁS LLENA (empate: moneda sembrada) y manda ev `gav {i, tm, tl}`; durante 1,7 s se la ve venir (sombra en la arena =
   telegrafía ≥0,5 s). Espantarla es un CLAIM: el receptor del equipo amenazado pulsa A con la gaviota en el aire (ventana tl+0,1 … tl+0,95 en reloj de quien pulsa; con 300 ms de ida y
   vuelta el `ok` llega antes de las tl+1,7, hora en que el dueño de la cava aplica el robo si nadie la espantó). Una CPU receptora espanta con ev `espanta` (el juez es la autoridad).
   Puntaje DEL EQUIPO = lo que hay en la cava al final (nunca <0, y nunca más de 2·floor(min(30, t+1,5)) para no pasar lim). Se reparte entre los dos asientos del equipo SIN contarlo
   dos veces: sc[lanzador] = floor(V/2), sc[receptor] = V − floor(V/2). La suma de los dos es V exacto (aditivo y comparable, DM3-3) y compara() decide por suma. El veredicto
   NUNCA sale de este archivo.
   Fin: el juez firma a dur, con lo que ha RECIBIDO de cada receptor; por eso un tiro solo se puede soltar si caerá ≥0,55 s antes del final, el rebote solo vale si también cae antes
   de eso (y la gaviota llega a robar ≥1,5 s antes): la atrapada de un receptor remoto no se pierde por el viaje de su `cogio` y el equipo del juez no tiene ventaja de último segundo.
   Cuerpo en red (o): x (centro de la cava; el lanzador manda 0), a, f (apuntado del stick ×100), v, z (solo el receptor). Sin Math.random/Date.now: azar de c.rng (solo en mk) o
   c.rngFor('cpu'+p); lo cosmético de c.fx(). Dibujo: 3D low poly (fiesta-3d.js, doc 15) o, sin WebGL / ?plano=1, el 2D de siempre con primitivas del laboratorio. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_cava')) return;

var AW = 600, GY = 396, OY = 296, G = 420, V0 = 200, V1 = 130, AMIN = 0.436, AMAX = 1.222;       // mundo 600 px de ancho; GY = suelo/borde de la cava; OY = altura de la mano; ángulos 25°..70°
var TX = [36, 564], LANE = [[125, 295], [305, 475]];                                              // equipo 0 (azul) a la izquierda, equipo 1 (rojo) a la derecha
var SPD = 150, SAND_K = 0.45, SAND_W = 74, ARATE = 1.0, PRATE = 0.85, SHOO = 0.45, GULL_T = 1.7, WIN0 = 0.1, WIN1 = 0.95, TAIL = 0.55;
var CD = [0.85, 1.25, 0.7], VAL = [1, 2, -2];
var HEAVY = 0.016, HEAVYMIN = 0.55;                                                                 // la cava llena pesa: velocidad × max(0,55, 1 − 0,016·V)
var BOTE = [44, 56, 0], BT = 0.45, SW = 34;                                                         // rebote en la arena (px hacia adelante, s) y semiancho de la sombra
var AV = 0.9, OLA_D = 1.3, OLA_V = 110, VSPD = 140, VR = 26, PSPD = 210, PDUR = 1.2, PKICK = 75;    // eventos: aviso, ola, heladero, pelota
var FASES = ['CALMA', '¡SE ALBOROTA LA PLAYA!', '¡ÚLTIMOS SEGUNDOS!'];
var PERILLA = { CW: 27, STEAL: [3, 3, 4], WMUL: [1, 1.35, 1.7], OSC_A: [0.09, 0.15, 0.22], DER_A: [80, 110, 140], DER_W: [0.9, 1.2, 1.6] };          // semiancho de la cava, robo de la gaviota por nivel, viento y pulso por fase
var INK = '#14101c', TEAM = ['#3a8ee8', '#e8504a'], TEAMN = ['AZUL', 'ROJO'];
var PAL = {
  1: { cielo: '#8fd8ff', cielo2: '#d9f3ff', mar: '#2fa7d8', mar2: '#5cc8ee', arena: '#f2d9a0', arena2: '#e6c383', sol: '#ffe14d', noche: 0 },
  2: { cielo: '#ff9a62', cielo2: '#ffd08a', mar: '#c8645a', mar2: '#e88a68', arena: '#e8b983', arena2: '#d9a06a', sol: '#ffb05a', noche: 0 },
  3: { cielo: '#1d1a4a', cielo2: '#3a3478', mar: '#1c2c6a', mar2: '#2c4a9a', arena: '#8a7a8e', arena2: '#76687c', sol: '#f4f0d0', noche: 1 }
};
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }

FIESTA.LIVE.add('f_cava', {
  name: '¡CARGA LA CAVA!', modos: ['2v2'], clase: 'binary', modelo: 'B', dur: 35,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 30, scoreRate: 1, minT: 30, finTemprano: 0 },
  cuerpo: ['x', 'a', 'f', 'v', 'z'], discretos: ['v', 'z'],
  perilla: PERILLA,
  carta: {
    obj: 'Cargad la cava con las frías: uno lanza A TIEMPO (el pulso tiembla) y apunta a donde VA la cava, y el otro la sostiene contra la corriente. A la sombra vale más. Perfecto (centrada) y la lluvia de frías suman. ¡Ojo con los cocos, la ola, el heladero, la pelota y la gaviota; agarra el hielo seco ★!',
    gana: 'El equipo con más cosas en la cava. La suma es de los dos.',
    como: { tactil: 'Lanzador: joystick apunta · A suelta cuando el aro pasa por la cava. Receptor: joystick mueve la cava · A espanta la gaviota o patea la pelota', teclado: 'WASD o flechas · ESPACIO' },
    roles: null,
    demos: [
      { id: 'lanzar', txt: 'LANZADOR: el aro de caída va y viene con tu pulso: toca A justo cuando pase por la cava' },
      { id: 'atrapar', txt: 'RECEPTOR: corre con la cava; lo que rebota se agarra en el bote. A la sombra vale +1' },
      { id: 'eventos', txt: 'Esquiva los cocos, agarra la estrella ★ (+2), y en la lluvia de frías todo vale más. A espanta la gaviota y patea la pelota' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], rng = c.rng, i, k;
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };

    /* ───── equipos y roles: por asiento dentro del equipo (el de menor asiento lanza) ───── */
    var TM = [{ th: -1, rc: -1 }, { th: -1, rc: -1 }], tmOf = [], rol = [];
    for (i = 0; i < n; i++) { var te = (c.equipos && c.equipos[i] === 1) ? 1 : 0; tmOf.push(te); if (TM[te].th < 0) TM[te].th = i; else if (TM[te].rc < 0) TM[te].rc = i; }
    for (i = 0; i < 2; i++) { if (TM[i].rc < 0) TM[i].rc = TM[i].th; }                              // equipo de un solo asiento (no ocurre en 2v2): hace los dos oficios
    for (i = 0; i < n; i++) rol[i] = TM[tmOf[i]].th === i ? 0 : 1;

    /* ───── el mundo, idéntico en todas las pantallas (solo c.rng, solo aquí) ───── */
    var gust = [], tw = 2.4;
    while (tw < dur + 2) {                                                                          // ráfagas de viento: [desde, hasta, aceleración px/s²]
      var gl = 2.4 + rng.next() * 2.4, gw = ((lv === 1 ? 20 : 34) + rng.next() * (lv === 1 ? 18 : 34)) * (rng.next() < 0.5 ? -1 : 1);
      gust.push([tw, tw + gl, gw]); tw += gl + 1.4 + rng.next() * 2.4;
    }
    var seq = [];                                                                                   // cola de objetos (igual para los dos equipos)
    for (i = 0; i < 90; i++) { var u = rng.next(); seq.push(lv === 3 ? (u < 0.18 ? 2 : u < 0.5 ? 1 : 0) : (u < 0.3 ? 1 : 0)); }
    var sand = [], hasSand = lv >= 2;
    for (i = 0; i < 2; i++) { var lo = LANE[i][0], hi = LANE[i][1]; sand.push(lo + 22 + rng.next() * (hi - lo - SAND_W - 44)); }
    var gullBase = lv === 3 ? [7.5, 15, 22, 28.5] : [9, 18, 27], GT = [], gCoin = [];
    for (i = 0; i < gullBase.length; i++) { GT.push(Math.min(dur - GULL_T - 1.5, gullBase[i] * dur / 35 + (rng.next() - 0.5) * 2.4)); gCoin.push(rng.next() < 0.5 ? 0 : 1); }
    /* ───── escalada: tres fases por fracción del tiempo (vale para cualquier dur, también 10 s) ───── */
    var B1 = dur * 0.35, B2 = dur * 0.72;
    function fase(t) { return t < B1 ? 0 : t < B2 ? 1 : 2; }
    function fasePhi(t, w) { return w[0] * Math.min(t, B1) + w[1] * cl(t - B1, 0, B2 - B1) + w[2] * Math.max(0, t - B2); }   // ángulo acumulado continuo
    var OSC_W = [3.6, 5.0, 6.8], oscPh = rng.next() * 6.283, SOM_W = [0.55, 0.85, 1.25], somPh = rng.next() * 6.283;
    function pulso(t) { return PERILLA.OSC_A[fase(t)] * Math.sin(fasePhi(t, OSC_W) + oscPh); }               // el vaivén de la potencia del lanzador (igual en todas las pantallas)
    function sombraX(tm, t) {                                                                       // centro de la sombra que se pasea por el carril (espejo entre equipos)
      var lo = LANE[0][0], hi = LANE[0][1], x = (lo + hi) / 2 + ((hi - lo) / 2 - 22) * Math.sin(fasePhi(t, SOM_W) + somPh);
      return tm === 0 ? x : AW - x;
    }
    /* eventos de playa: ola, heladero, pelota; cada vez más seguidos */
    var EVS = [], te2 = Math.max(2.2, dur * 0.17), KINDS = ['ola', 'vend', 'pelota'], lastK = -1, EVD = { ola: OLA_D, vend: (AW + 60) / VSPD, pelota: PDUR };
    while (te2 < dur - 2.2) {
      var kk2 = Math.floor(rng.next() * 3); if (kk2 === lastK) kk2 = (kk2 + 1) % 3; lastK = kk2;
      EVS.push({ k: KINDS[kk2], t: te2, d: rng.next() < 0.5 ? 1 : -1, i: EVS.length });
      te2 += [6.2, 4.4, 3.0][fase(te2)] * Math.max(0.45, Math.min(1, dur / 35)) + rng.next() * 1.4;
    }
    var DER_PH = rng.next() * 6.283;
    /* COCOS (peligro) y HIELO SECO (premio) que caen de las palmeras en cada carril (espejo), y LLUVIA DE FRÍAS (lanzas el doble de rápido y todo vale +1). Todo función pura del tiempo. */
    var DROPS = [], td = Math.max(2.6, dur * 0.1), DUR_F = 0.9, RAIN = [[dur * 0.42, 3.2], [dur * 0.8, 2.8]], dscale = Math.max(0.45, Math.min(1, dur / 35));
    while (td < dur - 1.8) {
      DROPS.push({ k: rng.next() < 0.62 ? 'coco' : 'star', t: td, x: LANE[0][0] + 14 + rng.next() * (LANE[0][1] - LANE[0][0] - 28), i: DROPS.length });
      td += [3.0, 2.0, 1.3][fase(td)] * dscale + rng.next() * 0.7;
    }
    function lluvia(t) { var j; for (j = 0; j < RAIN.length; j++) if (t >= RAIN[j][0] && t < RAIN[j][0] + RAIN[j][1]) return true; return false; }
    function dropX(d, tm) { return tm === 0 ? d.x : AW - d.x; }
    function derivaV(tm, t) { var z = fase(t); return (tm === 0 ? 1 : -1) * PERILLA.DER_A[z] * Math.sin(fasePhi(t, PERILLA.DER_W) + DER_PH); }   // la corriente: velocidad con que arrastra la cava (px/s), espejo entre equipos
    function derivaDesp(tm, t0, t1) { var j, d = 0, h = (t1 - t0) / 8; for (j = 0; j < 8; j++) d += derivaV(tm, t0 + (j + 0.5) * h) * h; return d; }   // cuánto se irá sola entre t0 y t1
    function evActivo(k, t) { var j; for (j = 0; j < EVS.length; j++) if (EVS[j].k === k && t >= EVS[j].t && t < EVS[j].t + EVD[k]) return EVS[j]; return null; }
    function vendX(e, t) { return e.d > 0 ? -30 + VSPD * (t - e.t) : AW + 30 - VSPD * (t - e.t); }
    function vendeEn(x, t) { var e = evActivo('vend', t); return !!e && Math.abs(vendX(e, t) - x) < VR; }
    function pelotaX(e, tm, t) { var x = AW / 2 - 6 - PSPD * (t - e.t); return tm === 0 ? x : AW - x; }        // sale del medio hacia la orilla de cada equipo
    function olaDrift(tm, t) { var e = evActivo('ola', t); if (!e) return 0; return (tm === 0 ? e.d : -e.d) * OLA_V * Math.sin(Math.PI * (t - e.t) / OLA_D); }
    function capV(t) { return 2 * Math.floor(Math.min(30, Math.max(0, t) + 1.5)); }                  // tope del equipo: cada asiento ≤ scoreRate·(t+1,5) y ≤ scoreMax
    function windAt(t) { var w = 0, j; for (j = 0; j < gust.length; j++) if (t >= gust[j][0] && t < gust[j][1]) w += gust[j][2]; return w * PERILLA.WMUL[fase(t)]; }
    function enArena(tm, x) { return hasSand && x > sand[tm] - 6 && x < sand[tm] + SAND_W + 6; }

    /* trayectoria PURA de (equipo, ángulo, potencia, hora de soltar): x se integra con el viento; y es una parábola */
    function vuelo(tm, ang, f, t0, hh) {
      var sg = tm === 0 ? 1 : -1, V = V0 + V1 * f, vx = Math.cos(ang) * V * sg, vy = Math.sin(ang) * V;
      var T = (vy + Math.sqrt(vy * vy + 2 * G * (GY - OY))) / G, xs = [TX[tm]], x = TX[tm], t = 0, h = hh || 1 / 60;
      while (t < T - 1e-9) { var d = Math.min(h, T - t), w = windAt(t0 + t + d / 2); x += vx * d + 0.5 * w * d * d; vx += w * d; t += d; xs.push(x); }
      return { T: T, lx: x, xs: xs, vy: vy, h: h, tm: tm };
    }
    function vx_(F, t) {
      t = cl(t, 0, F.T); var j = Math.floor(t / F.h);
      if (j >= F.xs.length - 1) return F.xs[F.xs.length - 1];
      var span = j + 1 === F.xs.length - 1 ? F.T - j * F.h : F.h, u = span > 1e-9 ? (t - j * F.h) / span : 1;
      return F.xs[j] + (F.xs[j + 1] - F.xs[j]) * cl(u, 0, 1);
    }
    function vy_(F, t) { t = cl(t, 0, F.T); return OY - F.vy * t + 0.5 * G * t * t; }
    function resuelve(tm, ang, tx, t0) {                                                           // CPU: la potencia que deja la caída más cerca de tx
      var best = 0.5, be = 1e9, kk, f, e;
      for (kk = 0; kk <= 20; kk++) { f = kk / 20; e = Math.abs(vuelo(tm, ang, f, t0, 1 / 30).lx - tx); if (e < be) { be = e; best = f; } }   // barrido grueso
      var c0 = best;
      for (kk = -5; kk <= 5; kk++) { f = cl(c0 + kk * 0.01, 0, 1); e = Math.abs(vuelo(tm, ang, f, t0).lx - tx); if (e < be) { be = e; best = f; } }   // afinado
      return { f: best, e: be };
    }

    /* ───── estado ───── */
    var P = [], cpuR = [], plan = [], hist = [], djd = [];
    for (i = 0; i < n; i++) {
      var tt = tmOf[i], lane = LANE[tt];
      P.push({ tm: tt, rol: rol[i], x: (lane[0] + lane[1]) / 2, ang: 0.8, pw: 0.5, n: 0, cd: 0, v: 0, z: 0, own: false, shoo: -9, happy: -9, hurt: -9, thr: -9, doing: 0,
        racha: 0, stun: -9, pushV: 0, kick: -9, bonk: -9, sombra: -9 }); djd.push({});
      cpuR.push(c.rngFor('cpu' + i)); plan.push({ re: -9, tgt: null, ang: 0.8, f: 0.5, rdy: 0, n: -1, gs: {}, lap: {}, dx: 0, er: 0, bad: false, vv: false, pk: {}, dr: {}, som: true }); hist.push([]);
    }
    var fls = [], fkeys = {}, gulls = [], gSent = [], gDone = [], absT = 0, banner = '', banT = 0, banCol = '#ff5c8a', shake = 0;
    var bS = {}, avisos = {}, faseVista = 0;                                                        // pelotas por equipo (0 pendiente, 1 pateada, 2 pelotazo; con hora), avisos dados, fase mostrada
    function avisa(txt2, col, t2) { banner = txt2; banCol = col || '#ff5c8a'; banT = t2 || 1.6; }
    function eff(q, t) { return cl(q.pw + pulso(t), 0, 1); }                                         // la potencia REAL con el pulso
    function pesada(v) { return Math.max(HEAVYMIN, 1 - HEAVY * v); }
    /* campo visible: en el navegador c.campo() devuelve siempre 0..800 (gameLeft/GAME_VIEW son const de script, no cuelgan de window): se lee gameLeft/gameRight directo (vertical ~340, apaisado ~1300) */
    var cp = function () { var f = c.campo(); if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 }; return f; };
    function geom() { var f = cp(); return { ox: (f.x0 + f.x1) / 2 - AW / 2 }; }
    function Vtm(tm) { return P[TM[tm].rc].v; }
    function histX(p, t) {                                                                         // dónde estaba la cava del receptor p a la hora t
      var h = hist[p], j;
      if (!h.length) return P[p].x;
      for (j = h.length - 1; j >= 0; j--) if (h[j].t <= t) return h[j].x;
      return h[0].x;
    }
    function sandSlow(p) { return enArena(P[p].tm, P[p].x) ? SAND_K : 1; }
    function gullDe(i2) { return gulls[i2] || null; }
    function gullActiva(tm, now) { var j; for (j = 0; j < gulls.length; j++) if (gulls[j] && gulls[j].tm === tm && !gulls[j].applied && now >= gulls[j].tl && now < gulls[j].tl + GULL_T + 0.3) return gulls[j]; return null; }

    /* ───── lanzar (lo hace el dueño del lanzador, o el juez si es CPU) ───── */
    function cabe(q, now) { return now + vuelo(q.tm, q.ang, eff(q, now), now, 1 / 30).T <= dur - TAIL; }   // el último tiro debe caer TAIL s antes del final (así su atrapada llega al juez a tiempo)
    function lanzar(p, now) {
      var q = P[p], ty = seq[q.n % seq.length], nn = q.n;
      if (!cabe(q, now)) return;
      q.n++; q.cd = now + CD[ty] * (fase(now) === 2 ? 0.75 : 1) * (lluvia(now) ? 0.5 : 1); q.thr = now;
      c.ev('tiro', { a: Math.round(q.ang * 1000), f: Math.round(eff(q, now) * 1000), t: Math.round(now * 1000), ty: ty, n: nn }, p);
    }
    function nuevoVuelo(p, d) {
      var q = P[p]; if (!q || !d || typeof d.a !== 'number' || typeof d.f !== 'number' || typeof d.t !== 'number') return;
      var key = q.tm * 1000 + (d.n | 0); if (fkeys[key]) return;
      var ty = cl(d.ty | 0, 0, 2), ang = cl(d.a / 1000, AMIN, AMAX), f = cl(d.f / 1000, 0, 1), t0 = d.t / 1000;
      if (c.ahora() - t0 > 6) return;
      fkeys[key] = 1; q.n = Math.max(q.n, (d.n | 0) + 1); q.thr = Math.max(q.thr, t0);
      var F = vuelo(q.tm, ang, f, t0), T = t0 + F.T, sg = q.tm === 0 ? 1 : -1;
      var vend = vendeEn(F.lx, T), mojado = !!evActivo('ola', T);
      var bt = ty !== 2 && !vend && !mojado && T + BT <= dur - TAIL;                              // ¿rebota? (pura: la misma respuesta en todas las pantallas)
      fls.push({ key: key, tm: q.tm, ty: ty, t0: t0, T: T, lx: F.lx, F: F, res: -1, judged: 0, by: p, vend: vend, mojado: mojado, bt: bt, x2: F.lx + sg * BOTE[ty], T2: T + BT, cb: 0 });
      while (fls.length > 40) fls.shift();
    }

    /* ───── movimiento / juicio ───── */
    function updThrow(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        q.own = false; var r = c.remoto(p);
        if (r) { q.ang = cl(r.a / 100, AMIN, AMAX); q.pw = cl(r.f / 100, 0, 1); }
        return;
      }
      q.own = true;
      if (now < 0) return;
      var e = c.eje(p), sg = q.tm === 0 ? 1 : -1;
      q.ang = cl(q.ang - e.y * ARATE * dt, AMIN, AMAX); q.pw = cl(q.pw + e.x * sg * PRATE * dt, 0, 1);
      if (c.tap(p, 'a') > 0 && now >= q.cd) lanzar(p, now);
    }
    function espantar(p, now) {
      var q = P[p], g = gullActiva(q.tm, now);
      if (!g || g.scared || now < g.tl + WIN0 || now > g.tl + WIN1 || g.mine[p]) return;
      g.mine[p] = 1; q.shoo = now;
      if (c.cpu[p]) { c.ev('espanta', { i: g.i }, p); return; }                                       // CPU: el juez es la autoridad y lo anuncia
      c.claim('g' + g.i + '_' + p, function () {});                                                  // humano: claim; el `ok` llega a concede() en todas las pantallas
    }
    function pelotaCerca(q, now, rad) {                                                             // la pelota de mi carril que está a menos de rad de mi cava (y sin resolver)
      var j, e;
      for (j = 0; j < EVS.length; j++) { e = EVS[j]; if (e.k !== 'pelota' || now < e.t || now >= e.t + PDUR || bS[q.tm * 100 + e.i]) continue; if (Math.abs(pelotaX(e, q.tm, now) - q.x) < rad) return e; }
      return null;
    }
    function patear(p, now) {
      var q = P[p], e = pelotaCerca(q, now, PKICK);
      if (!e) return;
      bS[q.tm * 100 + e.i] = { s: 1, t: now }; q.kick = now; q.stun = now + 0.15;
      c.ev('patea', { i: e.i }, p);
    }
    function atrapa(p, fl, cx, b, tAt, now) {                                                       // el receptor p atrapó fl (b = en el rebote)
      var q = P[p], val, s = 0, r = q.racha, rb = 0, rep = 0, j2, pf = 0, ll = 0;
      if (fl.ty !== 2 && !b) for (j2 = 0; j2 < fls.length; j2++) { var pf = fls[j2]; if (pf.tm === fl.tm && pf.key === fl.key - 1 && pf.ty !== 2 && Math.abs(pf.lx - fl.lx) < 16 && fl.T - pf.T < 3.2) rep = 1; }   // mismo sitio que el tiro anterior: el lanzador no apuntó
      if (rep) { val = Math.max(0, VAL[fl.ty] - 1); r = 0; }
      else if (fl.ty === 2) { val = VAL[2]; r = 0; }
      else {
        val = b ? 1 : VAL[fl.ty];
        if (!b && Math.abs(cx - sombraX(q.tm, tAt)) <= SW) { val++; s = 1; }
        if (!b && Math.abs(cx - fl.lx) <= 8) { val++; pf = 1; }                                       // ¡PERFECTO!: el lanzador apuntó y el receptor la centró
        if (lluvia(tAt)) { val++; ll = 1; }
        r++; if (r % (fase(tAt) === 2 ? 2 : 3) === 0) { val++; rb = 1; }
      }
      var nv = Math.max(0, q.v + val);
      if (val > 0) nv = Math.min(nv, Math.max(q.v, capV(now)));
      var d = { id: fl.key, v: nv, z: q.z + 1, ty: fl.ty, r: r };
      if (b) d.b = 1; if (pf) d.pf = 1; if (ll) d.ll = 1; if (s) d.s = 1; if (rb) d.rb = 1; if (rep) d.rp = 1;
      c.ev('cogio', d, p);
    }
    function falla(p, fl, tAt) {                                                                    // se cayó a la arena (o se lo quedó el heladero)
      var q = P[p];
      if (fl.ty === 2) return;                                                                      // la botella esquivada no cuesta
      var cost = fase(tAt) === 2 && q.v > 0 ? 1 : 0;
      if (cost || q.racha) c.ev('roba', { v: q.v - cost, z: q.z + 1, s: cost, k: 'm', r: 0 }, p);
    }
    function updRec(p, dt, now) {
      var q = P[p], lane = LANE[q.tm], j;
      if (!c.mio(p)) {
        q.own = false; var r = c.remoto(p);
        if (r) q.x = cl(r.x, lane[0] - 20, lane[1] + 20);
        return;
      }
      q.own = true;
      if (now < 0) return;
      var e = c.eje(p);
      if (now >= q.shoo + SHOO && now >= q.stun) q.x += e.x * SPD * sandSlow(p) * pesada(q.v) * dt;
      q.x = cl(q.x + (olaDrift(q.tm, now) + q.pushV + derivaV(q.tm, now)) * dt, lane[0], lane[1]); q.pushV *= Math.max(0, 1 - 6 * dt);
      hist[p].push({ t: now, x: q.x }); while (hist[p].length > 150) hist[p].shift();
      if (c.tap(p, 'a') > 0) { if (gullActiva(q.tm, now)) espantar(p, now); else patear(p, now); }
      /* la pelota de los chamos: si toca mi cava, ¡pelotazo! */
      var pe = pelotaCerca(q, now, PERILLA.CW + 8);
      if (pe) {
        var sgp = q.tm === 0 ? -1 : 1, cost = Math.min(1, q.v);
        bS[q.tm * 100 + pe.i] = { s: 2, t: now }; q.pushV = sgp * 320; q.stun = now + 0.3;
        c.ev('roba', { v: q.v - cost, z: q.z + 1, s: cost, k: 'p', b: pe.i, r: 0 }, p);
      }
      /* lo que cae de las palmeras: cocos (-1) y hielo seco (+2) */
      for (j = 0; j < DROPS.length; j++) {
        var dd = DROPS[j];
        if (djd[p][dd.i] || now < dd.t) continue;
        djd[p][dd.i] = 1;
        if (dd.t <= now - 3 || dd.t > dur - TAIL - 0.2) continue;
        var dcx = histX(p, dd.t);
        if (Math.abs(dcx - dropX(dd, q.tm)) > PERILLA.CW + 4) continue;
        if (dd.k === 'coco') { var cc = Math.min(1, q.v); q.stun = now + 0.4; c.ev('roba', { v: q.v - cc, z: q.z + 1, s: cc, k: 'c', r: 0 }, p); }
        else { var nv2 = Math.min(q.v + 2, Math.max(q.v, capV(now))); c.ev('cogio', { id: 9000 + dd.i, v: nv2, z: q.z + 1, ty: 1, r: q.racha, pw: 1 }, p); }
      }
      /* aterrizajes de MI equipo: juzgo contra mi historial (la caída y, si falla, el rebote) */
      for (j = 0; j < fls.length; j++) {
        var fl = fls[j];
        if (fl.tm !== q.tm || fl.judged >= 2) continue;
        if (fl.judged === 0) {
          if (now < fl.T) continue;
          if (fl.T <= now - 4) { fl.judged = 2; continue; }
          var cx = histX(p, fl.T);
          if (!fl.vend && Math.abs(cx - fl.lx) <= PERILLA.CW) { fl.judged = 2; atrapa(p, fl, cx, 0, fl.T, now); }
          else if (fl.bt) fl.judged = 1;
          else { fl.judged = 2; fl.res = 0; falla(p, fl, fl.T); }
        } else {
          if (now < fl.T2) continue;
          fl.judged = 2;
          var cx2 = histX(p, fl.T2);
          if (Math.abs(cx2 - fl.x2) <= PERILLA.CW) atrapa(p, fl, cx2, 1, fl.T2, now); else { fl.res = 0; falla(p, fl, fl.T2); }
        }
      }
      /* robo de la gaviota (si nadie la espantó a tiempo) */
      for (j = 0; j < gulls.length; j++) {
        var g = gulls[j];
        if (g && g.tm === q.tm && !g.applied && now >= g.tl + GULL_T) {
          g.applied = 1;
          if (!g.scared) { var s = Math.min(q.v, PERILLA.STEAL[lv - 1]); if (s > 0) c.ev('roba', { i: g.i, v: q.v - s, z: q.z + 1, s: s }, p); }
        }
      }
    }

    /* ───── avisos de fase y de eventos (cada pantalla los calcula de la hora: no viajan por la red) ───── */
    var TXT_EV = { ola: ['¡VIENE UNA OLA!', '#8fe0ff'], vend: ['¡PASA EL HELADERO! NO LE TIRES', '#ffd23f'], pelota: ['¡PELOTA DE LOS CHAMOS! A = PATEAR', '#ff8a3f'] };
    function avisos3(now) {
      var j, fz = fase(now);
      if (now >= 0 && now < dur && fz !== faseVista) {
        faseVista = fz;
        avisa(fz === 2 ? '¡ÚLTIMOS SEGUNDOS! RACHA x2 · CADA CAÍDA RESTA' : FASES[fz] + ' · MÁS VIENTO Y MÁS PULSO', fz === 2 ? '#ff5c5c' : '#ffd23f', 2.2);
        shake = Math.max(shake, 0.5);
        if (v3) { V3.sfx(fz === 2 ? 'bocina' : 'tambor'); v3.esc.sacudir(fz === 2 ? 0.9 : 0.5); } else SND(fz === 2 ? 880 : 520, 0.25, 'square', 0.05, 200);
      }
      for (j = 0; j < RAIN.length; j++) {
        if (!avisos['r' + j] && now >= RAIN[j][0] - 0.6 && now < RAIN[j][0] + RAIN[j][1]) { avisos['r' + j] = 1; avisa('¡LLUVIA DE FRÍAS! LANZAS x2 · TODO VALE +1', '#8fe0ff', 2.4); shake = Math.max(shake, 0.4); if (v3) { V3.sfx('bocina'); v3.esc.sacudir(0.6); } else SND(990, 0.2, 'square', 0.05, 300); }
      }
      for (j = 0; j < DROPS.length; j++) {
        var dq = DROPS[j];
        if (!avisos['d' + j] && now >= dq.t - 0.9 && now < dq.t) { avisos['d' + j] = 1; if (v3) V3.sfx(dq.k === 'coco' ? 'silbato' : 'ding'); }
      }
      for (j = 0; j < EVS.length; j++) {
        var e = EVS[j], k0 = 'a' + j, k1 = 'b' + j;
        if (!avisos[k0] && now >= e.t - AV && now < e.t) { avisos[k0] = 1; avisa(TXT_EV[e.k][0], TXT_EV[e.k][1], 1.5); if (v3) V3.sfx(e.k === 'ola' ? 'viento' : e.k === 'vend' ? 'ding' : 'silbato'); else SND(700, 0.12, 'triangle', 0.04, 100); }
        if (!avisos[k1] && now >= e.t && now < e.t + EVD[e.k]) { avisos[k1] = 1; if (v3) { V3.sfx(e.k === 'ola' ? 'splash' : e.k === 'vend' ? 'bocina' : 'salto'); if (e.k === 'ola') v3.esc.sacudir(0.4); } }
      }
    }

    /* ───── gaviota (la maneja el juez) ───── */
    function gaviotas(now) {
      var j;
      if (!c.juez() || now < 0) return;
      for (j = 0; j < GT.length; j++) {
        if (gSent[j] || gDone[j] || now < GT[j]) continue;
        gDone[j] = 1;
        var v0 = Vtm(0), v1 = Vtm(1);
        if (v0 + v1 <= 0) continue;
        var tm = v0 > v1 ? 0 : v1 > v0 ? 1 : gCoin[j];
        gSent[j] = 1;
        c.ev('gav', { i: j, tm: tm, tl: Math.round(now * 1000) });
      }
    }

    /* ───── IA ───── */
    function aiThrow(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], sg = q.tm === 0 ? 1 : -1;
      if (now < 0.2) return;
      var rc = TM[q.tm].rc, ty = seq[q.n % seq.length], nuevo = pl.n !== q.n;
      if (nuevo) {                                                                                  // plan nuevo tras cada lanzamiento: error propio y si se deshace de la botella
        pl.n = q.n;
        pl.bad = ty === 2 && R2.next() < 0.35 + 0.6 * sk;
        pl.er = (R2.next() * 2 - 1) * (20 * (1 - sk) + 4) + (R2.next() < 0.02 + 0.1 * (1 - sk) ? (R2.next() < 0.5 ? -1 : 1) * (50 + R2.next() * 40) : 0);
        pl.vv = R2.next() < 0.25 + 0.7 * sk;                                                        // ¿se fija en el heladero?
        pl.tol = 0.035 + 0.09 * (1 - sk) * (0.6 + 0.8 * R2.next());                                  // qué tan fino suelta con el pulso
        pl.rdy = Math.max(now, q.cd) + (0.12 - 0.08 * sk) + R2.next() * 0.1; pl.re = -9;
      }
      if (now >= pl.re) {                                                                           // re-apunta a donde está la cava ahora (el blanco se mueve)
        pl.re = now + 0.3;
        var tx = pl.bad ? (q.tm === 0 ? 330 : 270) + R2.next() * 40 : P[rc].x + pl.er + derivaDesp(q.tm, now, now + 1.2) * (0.5 + 0.5 * sk), ba = 0.9, bf = 0.5, be = 1e9, aa, cand = [q.ang, 0.72, 0.95, 1.15];
        for (aa = 0; aa < cand.length; aa++) { var rs = resuelve(q.tm, cand[aa], tx, now + 0.4); var sc3 = rs.e + 90 * Math.abs(cand[aa] - q.ang); if (sc3 < be) { be = sc3; ba = cand[aa]; bf = rs.f; } }
        pl.ang = ba; pl.f = bf;
      }
      var ea = pl.ang - q.ang, ef = cl(pl.f, 0.04, 0.96) - q.pw;
      api.eje(Math.abs(ef) > 0.02 ? (ef > 0 ? sg : -sg) : 0, Math.abs(ea) > 0.03 ? (ea > 0 ? -1 : 1) : 0);
      if (Math.abs(ea) > 0.07 || now < q.cd || now < pl.rdy) return;
      var fe = eff(q, now), tarde = now > pl.rdy + 0.9;                                             // con el pulso: suelta cuando la potencia REAL pasa por la buscada
      if (Math.abs(fe - pl.f) > pl.tol && !tarde) return;
      if (pl.vv && !tarde && !pl.bad) { var Fv = vuelo(q.tm, q.ang, fe, now, 1 / 30); if (vendeEn(Fv.lx, now + Fv.T)) return; }   // espera a que pase el heladero
      api.press('a');
    }
    function aiRec(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], lane = LANE[q.tm], j, tgt = null;
      if (now < 0) return;
      /* prioridad: lo que va a caer (o rebotar) primero */
      var bf = null, bT = 0;
      for (j = 0; j < fls.length; j++) {
        var fl = fls[j], tt = fl.judged === 1 ? fl.T2 : fl.T;
        if (fl.tm !== q.tm || fl.judged >= 2 || fl.vend || tt < now - 0.02) continue;
        if (!bf || tt < bT) { bf = fl; bT = tt; }
      }
      if (now >= pl.re) { pl.dx = (R2.next() * 2 - 1) * (34 * (1 - sk) + 5); pl.re = now + 0.45; pl.som = R2.next() < 0.3 + 0.6 * sk; }
      if (bf && pl.lap[bf.key] === undefined) pl.lap[bf.key] = R2.next() < 0.03 + 0.16 * (1 - sk);                 // distracción: este tiro ni lo mira
      if (bf && !pl.lap[bf.key] && now >= bf.t0 + (0.34 - 0.18 * sk)) {
        var lx = bf.judged === 1 ? bf.x2 : bf.lx;
        tgt = lx + pl.dx;
        if (bf.ty !== 2 && Math.abs(lx - q.x) > 4 + 36 * sk + PERILLA.CW) tgt = null;                  // la CPU no sale corriendo tras un tiro que nadie apuntó: si el lanzador no apunta, se pierde
        if (bf.ty === 2) tgt = Math.abs(q.x - lx) > PERILLA.CW + 12 ? q.x : (q.x >= lx ? lx + PERILLA.CW + 18 : lx - PERILLA.CW - 18);       // la botella se esquiva
      } else if (pl.som) tgt = sombraX(q.tm, now + 0.4) + pl.dx * 0.5;                              // sin nada en el aire: a la sombra (ahí vale más)
      /* gaviota sobre mi cava: A con probabilidad según habilidad */
      var g = gullActiva(q.tm, now);
      if (g && !g.scared && !pl.gs[g.i]) {
        if (now >= g.tl + 0.35 + R2.next() * 0.25 && now <= g.tl + 0.8) { pl.gs[g.i] = 1; if (R2.next() < 0.3 + 0.65 * sk) api.press('a'); }
      } else {
        /* la pelota: la patea si la ve venir */
        var pe = pelotaCerca(q, now, PKICK - 10);
        if (pe && pl.pk[pe.i] === undefined) { pl.pk[pe.i] = 1; if (R2.next() < 0.25 + 0.6 * sk) api.press('a'); }
      }
      for (j = 0; j < DROPS.length; j++) {                                                          // cocos: esquiva; hielo seco: va por él
        var dq = DROPS[j], dtm = dq.t - now, dxq = dropX(dq, q.tm);
        if (dtm < 0.05 || dtm > 1.3) continue;
        if (pl.dr[dq.i] === undefined) pl.dr[dq.i] = R2.next() < 0.3 + 0.65 * sk;
        if (!pl.dr[dq.i]) continue;
        if (dq.k === 'coco') { if (Math.abs(dxq - q.x) < PERILLA.CW + 16) tgt = (dxq - lane[0] > lane[1] - dxq) ? dxq - PERILLA.CW - 22 : dxq + PERILLA.CW + 22; }
        else if (!bf || bT > dq.t + 0.3) tgt = dxq;
      }
      if (tgt === null) tgt = (lane[0] + lane[1]) / 2;
      tgt = cl(tgt, lane[0], lane[1]);
      var dx = tgt - q.x;
      api.eje(Math.abs(dx) > 5 ? (dx > 0 ? 1 : -1) : 0, 0);
    }

    /* ───── dibujo ───── */
    function cubo(x, y, s, ang, ty) {                                                              // hielo / refresco / botella
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
      if (ty === 0) { rr(-8, -8, 16, 16, 4, '#bdeeff', 2.5); line([[-4, -4], [2, -5]], 2, '#ffffff'); }
      else if (ty === 1) { rr(-6, -10, 12, 20, 3, '#e8483a', 2.5); rr(-6, -3, 12, 6, 0, '#fffdf2', 0); ell(0, -10, 6, 2, '#c9c9d4', 1.5); }
      else { rr(-5, -2, 10, 12, 3, '#3f9a52', 2.5); rr(-2.5, -12, 5, 11, 2, '#3f9a52', 2.5); line([[-2, 2], [-2, 7]], 1.5, '#d8ffd8'); }
      ctx.restore();
    }
    function pill(x, y, w) { ctx.save(); ctx.globalAlpha = 0.55; rr(x - w / 2, y - 14, w, 28, 12, INK, 0); ctx.restore(); }
    function fondo(f, G2) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, k2, ox = G2.ox;
      rr(x0, -700, w, 930, 0, pal.cielo, 0); rr(x0, 110, w, 120, 0, pal.cielo2, 0);
      if (pal.noche) { for (k2 = 0; k2 < 14; k2++) ell(x0 + ((k2 * 97) % Math.max(60, w)), 70 + ((k2 * 53) % 120), 1.6, 1.6, '#fffdf2', 0); }
      /* sol (o luna) con cara de anime */
      var sx = ox + AW * 0.5, sy = lv === 2 ? 206 : 168, sr = lv === 2 ? 42 : 34, pul = 1 + 0.04 * Math.sin(absT * 2);
      if (!pal.noche) for (k2 = 0; k2 < 10; k2++) { var an = k2 / 10 * 6.2832 + absT * 0.25; line([[sx + Math.cos(an) * (sr + 6), sy + Math.sin(an) * (sr + 6)], [sx + Math.cos(an) * (sr + 15 + (k2 % 2) * 7), sy + Math.sin(an) * (sr + 15 + (k2 % 2) * 7)]], 3.5, pal.sol); }
      ell(sx, sy, sr * pul, sr * pul, pal.sol, 4);
      ell(sx - 14, sy - 2, 7, 9, '#fffdf2', 2); ell(sx + 14, sy - 2, 7, 9, '#fffdf2', 2); ell(sx - 14, sy, 4, 5.5, INK, 0); ell(sx + 14, sy, 4, 5.5, INK, 0);
      ell(sx - 15.5, sy - 3, 1.8, 2.2, '#fffdf2', 0); ell(sx + 12.5, sy - 3, 1.8, 2.2, '#fffdf2', 0);
      ell(sx - 26, sy + 12, 7, 4, '#ff8aa5', 0); ell(sx + 26, sy + 12, 7, 4, '#ff8aa5', 0);
      line([[sx - 7, sy + 13], [sx, sy + 19], [sx + 7, sy + 13]], 2.5, INK);
      /* mar */
      rr(x0, 214, w, 62, 0, pal.mar, 0);
      for (k2 = 0; k2 < 8; k2++) { var wy = 222 + k2 * 7; rr(x0 + ((k2 * 83 + absT * 12 * (k2 % 2 ? 1 : -1)) % (w + 80)), wy, 56, 3, 2, pal.mar2, 0); }
      /* arena y carriles */
      rr(x0, 268, w, 1200, 0, pal.arena, 0); rr(x0, 268, w, 12, 0, pal.arena2, 0);
      for (k2 = 0; k2 < 9; k2++) rr(x0 + ((k2 * 131) % Math.max(80, w)), 300 + (k2 * 47) % 270, 38, 4, 2, pal.arena2, 0);
      /* palmeras */
      var pa = [ox + 70, ox + AW - 70];
      for (k2 = 0; k2 < 2; k2++) {
        var tx2 = pa[k2], ls = k2 ? -1 : 1;
        line([[tx2, 268], [tx2 + ls * 8, 214], [tx2 + ls * 4, 176]], 7, '#8a5a2a');
        for (var h2 = 0; h2 < 5; h2++) { var ha = -2.7 + h2 * 0.55; line([[tx2 + ls * 4, 176], [tx2 + ls * 4 + Math.cos(ha) * 46, 176 + Math.sin(ha) * 26 + 16]], 6, pal.noche ? '#1f6a4a' : '#2f9a4a'); }
      }
      /* carriles de cada equipo: toalla y arenas movedizas */
      for (k2 = 0; k2 < 2; k2++) {
        var lo2 = ox + LANE[k2][0] - 40, hi2 = ox + LANE[k2][1] + 40;
        rr(lo2, GY + 2, hi2 - lo2, 12, 4, TEAM[k2], 3); rr(lo2 + 8, GY + 5, hi2 - lo2 - 16, 3, 1, '#fffdf2', 0);
        if (hasSand) { var sc2 = ox + sand[k2] + SAND_W / 2; ell(sc2, GY + 9, SAND_W / 2 + 8, 10, '#a67c4a', 3); ell(sc2, GY + 9, SAND_W / 3, 6, '#8a6236', 0); ell(sc2, GY + 9, SAND_W / 7, 3, '#6e4a26', 0); txt('ARENA', sc2, GY + 40, 9, '#6e4a26', 0, true); }
      }
    }
    function lanzadorDibujo(p, G2, now) {
      var q = P[p], sg = q.tm === 0 ? 1 : -1, x = G2.ox + TX[q.tm], s = asiento(p), rec = Math.max(0, 1 - (now - q.thr) / 0.3);
      rr(x - 30, 346, 60, 44, 10, '#a89070', 3.5); rr(x - 24, 340, 48, 14, 6, '#c8b090', 2.5);                       // roca/duna donde está parado
      c.util.pj(s.ch, x, 316, 62, { animo: rec > 0 ? 'celebrar' : null, sombra: false });
      rr(x - 16, 338, 32, 8, 4, TEAM[q.tm], 2.5);
      var ty = seq[q.n % seq.length]; cubo(x + sg * (28 - rec * 14), OY + 10 - rec * 10, 1, 0.3 * sg, ty);
      if (now < q.cd && now >= 0) rr(x - 22, 392, 44 * cl((q.cd - now) / (CD[ty] + 0.01), 0, 1), 5, 2, '#fffdf2', 1.5);
      txt(p === c.yo ? 'TÚ' : String(s.name || '').slice(0, 7), x, 402, 11, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
    }
    function cavaDibujo(p, G2, now) {
      var q = P[p], x = G2.ox + q.x, s = asiento(p), V = q.v, tm = q.tm;
      var hop = Math.max(0, 1 - (now - q.happy) / 0.35) * 8, hurt = now - q.hurt < 0.6, shoo = now - q.shoo < SHOO, happy = now - q.happy < 0.5;
      var y = GY - hop;
      ctx.save(); ctx.globalAlpha = 0.25; ell(x, GY + 8, 34, 7, INK, 0); ctx.restore();
      c.util.pj(s.ch, x, y - 96, 50, { animo: hurt ? 'perder' : happy ? 'celebrar' : null, sombra: false });
      if (shoo) { var wv = Math.sin(absT * 40) * 14; line([[x - 26, y - 70], [x - 40, y - 100 + wv]], 5, '#e8b48a'); line([[x + 26, y - 70], [x + 40, y - 100 - wv]], 5, '#e8b48a'); }
      rr(x - 31, y - 44, 62, 42, 9, TEAM[tm], 3.5); rr(x - 34, y - 54, 68, 14, 6, '#fffdf2', 3);
      line([[x - 14, y - 54], [x - 14, y - 64], [x + 14, y - 64], [x + 14, y - 54]], 3, INK);
      var nI = Math.min(6, V), j2;
      for (j2 = 0; j2 < nI; j2++) cubo(x - 22 + j2 * 9, y - 62 - (j2 % 2) * 4, 0.6, 0.2 * j2, j2 % 3 === 2 ? 1 : 0);
      /* cara de anime */
      if (hurt) { line([[x - 17, y - 36], [x - 9, y - 30], [x - 17, y - 24]], 2.5, INK); line([[x + 17, y - 36], [x + 9, y - 30], [x + 17, y - 24]], 2.5, INK); }
      else if (happy) { line([[x - 17, y - 28], [x - 12, y - 35], [x - 7, y - 28]], 2.5, INK); line([[x + 7, y - 28], [x + 12, y - 35], [x + 17, y - 28]], 2.5, INK); }
      else { ell(x - 12, y - 30, 7, 8.5, '#fffdf2', 2); ell(x + 12, y - 30, 7, 8.5, '#fffdf2', 2); ell(x - 12, y - 29, 4.2, 5.4, '#2a5ad0', 0); ell(x + 12, y - 29, 4.2, 5.4, '#2a5ad0', 0); ell(x - 13.5, y - 32, 1.8, 2.2, '#fffdf2', 0); ell(x + 10.5, y - 32, 1.8, 2.2, '#fffdf2', 0); }
      ell(x - 20, y - 17, 5, 3, '#ff8aa5', 0); ell(x + 20, y - 17, 5, 3, '#ff8aa5', 0);
      if (happy) line([[x - 5, y - 17], [x, y - 12], [x + 5, y - 17]], 2.5, INK); else if (hurt) line([[x - 5, y - 11], [x, y - 16], [x + 5, y - 11]], 2.5, INK); else line([[x - 4, y - 16], [x, y - 13], [x + 4, y - 16]], 2, INK);
      txt(String(V), x, y - 138, 26, '#fffdf2', 0, false);
      txt(p === c.yo ? 'TÚ' : String(s.name || '').slice(0, 7), x, GY + 24, 11, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
    }
    function gaviotaDibujo(g, G2, now) {
      var tau = now - g.tl, rc = TM[g.tm].rc, cx = G2.ox + P[rc].x, u, gx, gy, huye = g.scared ? now - g.scaredAt : -1, roba = !g.scared && tau > GULL_T ? tau - GULL_T : -1;
      if (tau < 0 || tau > GULL_T + 1.4 || (huye > 1.2)) return;
      var side = g.tm === 0 ? 1 : -1;
      if (tau < 1.2) { u = tau / 1.2; gx = cx + side * (1 - u) * 190 + Math.sin(absT * 3) * 12; gy = 130 + u * 70; }
      else { u = Math.min(1, (tau - 1.2) / 0.5); gx = cx + Math.sin(absT * 9) * 4; gy = 200 + u * (GY - 70 - 200); }
      if (huye >= 0) { gx += side * huye * 260; gy -= huye * 200; }
      else if (roba >= 0) { gx += -side * roba * 220; gy = GY - 70 - roba * 160; }
      var sh = cl(tau / 1.5, 0, 1);
      if (huye < 0 && roba < 0) { ctx.save(); ctx.globalAlpha = 0.25 + 0.3 * sh; ell(cx, GY + 8, 16 + 28 * sh, 5 + 6 * sh, '#14101c', 0); ctx.restore(); }
      var fl = Math.sin(absT * 18) * 9;
      poly([[gx - 6, gy], [gx - 26, gy - 14 - fl], [gx - 10, gy + 2]], '#ffffff', 3); poly([[gx + 6, gy], [gx + 26, gy - 14 + fl], [gx + 10, gy + 2]], '#ffffff', 3);
      ell(gx, gy + 4, 13, 8, '#ffffff', 3); ell(gx + side * 11, gy - 1, 6, 5.5, '#ffffff', 3); poly([[gx + side * 15, gy - 2], [gx + side * 24, gy + 1], [gx + side * 15, gy + 2]], '#ff9a2a', 2);
      ell(gx + side * 12, gy - 3, 1.6, 1.6, INK, 0);
      if (roba >= 0) cubo(gx - side * 4, gy + 14, 0.7, 0.4, 0);
      if (huye < 0 && roba < 0 && tau < 1.0) txt('¡GAVIOTA!', gx, gy - 30, 14, '#fffdf2', 0, true);
    }
    function eventos2D(G2, now) {                                                                 // la sombra de cada carril, la ola, el heladero y las pelotas (2D sencillo)
      var ox = G2.ox, tm, j;
      for (tm = 0; tm < 2; tm++) { var sx2 = ox + sombraX(tm, now); ctx.save(); ctx.globalAlpha = 0.3; ell(sx2, GY + 8, SW, 9, '#3a2a4a', 0); ctx.restore(); ell(sx2 - 16, 150, 22, 14, '#fffdf2', 2.5); ell(sx2 + 14, 148, 26, 17, '#fffdf2', 2.5); txt('SOMBRA +1', sx2, GY + 40, 9, '#3a2a4a', 0, true); }
      for (j = 0; j < EVS.length; j++) {
        var e = EVS[j], u = now - e.t;
        if (u < -AV || u > EVD[e.k] + 0.6) continue;
        if (e.k === 'ola') { var h2 = u < 0 ? 0 : Math.sin(Math.PI * cl(u / OLA_D, 0, 1)); ctx.save(); ctx.globalAlpha = 0.25 + 0.35 * h2; rr(ox - 200, 268, AW + 400, 30 + h2 * 110, 10, '#5cc8ee', 0); ctx.restore(); if (u < 0) txt('¡OLA!', ox + AW / 2, 262, 16, '#fffdf2', 0, true); }
        else if (e.k === 'vend' && u >= 0 && u <= EVD.vend) { var vx2 = ox + vendX(e, now); rr(vx2 - 22, GY - 40, 44, 34, 6, '#fffdf2', 3); txt('HELADOS', vx2, GY - 23, 9, '#e8483a', 0, true); c.util.pj('portu', vx2 - e.d * 26, GY - 100, 50, { sombra: false }); }
        else if (e.k === 'pelota') for (tm = 0; tm < 2; tm++) {
          var b0 = bS[tm * 100 + e.i], bx = u < 0 ? AW / 2 : pelotaX(e, tm, now), by = GY - 12 - Math.abs(Math.sin(absT * 8)) * 26;
          if (b0 && b0.s) { var ua = now - b0.t; bx = pelotaX(e, tm, b0.t) + (tm === 0 ? 1 : -1) * ua * (b0.s === 1 ? 300 : -120); by = GY - 12 - ua * (b0.s === 1 ? 420 : 160) + 500 * ua * ua; if (ua > 1.2) continue; }
          else if (u > PDUR) continue;
          ell(ox + bx, by, 13, 13, '#ff5c8a', 3); line([[ox + bx - 12, by], [ox + bx + 12, by]], 3, '#ffd23f');
        }
      }
    }
    function drops2D(G2, now) {
      var j, tm;
      for (j = 0; j < DROPS.length; j++) {
        var d = DROPS[j], u = now - d.t;
        if (u < -1.5 || u > 0.5) continue;
        for (tm = 0; tm < 2; tm++) {
          var x = G2.ox + dropX(d, tm), fa = cl((u + DUR_F) / DUR_F, 0, 1), y = 90 + (GY - 14 - 90) * fa * fa;
          if (u < 0.3) { ctx.save(); ctx.globalAlpha = 0.2 + 0.3 * fa; ell(x, GY + 8, 8 + 14 * fa, 3 + 4 * fa, d.k === 'coco' ? '#3a2812' : '#b8860b', 0); ctx.restore(); }
          if (u > -DUR_F && (d.k === 'coco' ? u < 0.45 : u < 0.02)) { if (d.k === 'coco') { ell(x, y, 12, 12, '#6a4a22', 3); ell(x - 4, y - 3, 2, 2, '#3a2812', 0); } else { ell(x, y, 13, 13, '#ffd23f', 3); txt('★', x, y, 16, '#fffdf2', 0, true); } }
        }
      }
    }
    function dibujo2D() {
      var f = cp(), G2 = geom(), now = c.ahora(), p, a, ox = G2.ox;
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
      var kz = Math.min(1, (f.x1 - f.x0) / (AW + 30)), cx0 = (f.x0 + f.x1) / 2;                  // campo estrecho (móvil vertical): el mundo de 600 px se encoge desde el centro
      ctx.save(); ctx.translate(sxk, syk); ctx.translate(cx0, 300); ctx.scale(kz, kz); ctx.translate(-cx0, -300);
      fondo({ x0: cx0 - (cx0 - f.x0) / kz, x1: cx0 + (f.x1 - cx0) / kz }, G2);
      /* vista previa (solo de mi equipo, o de los dos si miro): arco punteado y marca donde cae */
      for (a = 0; a < 2; a++) {
        if (c.yo >= 0 && tmOf[c.yo] !== a) continue;
        var th = TM[a].th, q2 = P[th], F = vuelo(a, q2.ang, eff(q2, now + 0.05), now + 0.05), kk;
        {
          var lista = now >= q2.cd - 0.05;
          if (now + F.T > dur - TAIL) { txt('¡NO ALCANZA EL TIEMPO!', ox + TX[a] + (a ? -100 : 100), OY - 40, 12, '#ffd23f', 0, true); continue; }
          for (kk = 3; kk < F.xs.length - 1; kk += 5) { ctx.save(); ctx.globalAlpha = lista ? 0.95 : 0.45; ell(ox + vx_(F, kk * F.h), vy_(F, kk * F.h), 3.4, 3.4, '#fffdf2', 1.5); ctx.restore(); }
          ctx.save(); ctx.globalAlpha = (lista ? 0.65 : 0.3) + 0.15 * Math.sin(absT * 8); ell(ox + F.lx, GY + 8, PERILLA.CW, 9, TEAM[a], 2.5); ctx.restore();
        }
      }
      /* sombras de lo que vuela */
      for (a = 0; a < fls.length; a++) {
        var fl = fls[a], tau = now - fl.t0;
        if (tau < 0 || tau > fl.F.T + 0.9) continue;
        if (tau <= fl.F.T) { ctx.save(); ctx.globalAlpha = 0.3; ell(ox + vx_(fl.F, tau), GY + 8, 9, 3.5, INK, 0); ctx.restore(); }
      }
      eventos2D(G2, now); drops2D(G2, now);
      for (p = 0; p < n; p++) if (TM[P[p].tm].rc === p && TM[P[p].tm].th !== p) cavaDibujo(p, G2, now);
      for (p = 0; p < n; p++) if (TM[P[p].tm].th === p) lanzadorDibujo(p, G2, now);
      /* objetos en el aire / aterrizando */
      for (a = 0; a < fls.length; a++) {
        var fv = fls[a], tv = now - fv.t0;
        if (tv < 0 || tv > fv.F.T + (fv.bt ? BT + 0.7 : 0.7)) continue;
        if (tv <= fv.F.T) cubo(ox + vx_(fv.F, tv), vy_(fv.F, tv), 1.1, absT * 7 * (fv.tm ? -1 : 1), fv.ty);
        else if (fv.res === 1 && !fv.cb) { var rcx = ox + P[TM[fv.tm].rc].x, uu = cl((tv - fv.F.T) / 0.35, 0, 1); cubo(ox + fv.lx + (rcx - ox - fv.lx) * uu, GY - 56 * uu, 1.1 - 0.4 * uu, 0, fv.ty); }
        else if (fv.bt && tv <= fv.F.T + BT && fv.res !== 0) { var ub = (tv - fv.F.T) / BT; cubo(ox + fv.lx + (fv.x2 - fv.lx) * ub, GY - 4 - Math.sin(ub * Math.PI) * 46, 1.05, absT * 6, fv.ty); }
        else if (fv.bt && fv.res === 1) { var rcb = ox + P[TM[fv.tm].rc].x, ub2 = cl((tv - fv.F.T - BT) / 0.3, 0, 1); cubo(ox + fv.x2 + (rcb - ox - fv.x2) * ub2, GY - 4 - 52 * ub2, 1.05 - 0.4 * ub2, 0, fv.ty); }
        else if (fv.res === 0 || tv > fv.F.T + 0.5) { ctx.save(); ctx.globalAlpha = cl(1 - (tv - fv.F.T) / 0.7, 0, 1); cubo(ox + fv.lx, GY + 4 - Math.abs(Math.sin((tv - fv.F.T) * 9)) * 10 * (1 - (tv - fv.F.T)), 1, 0.6, fv.ty); ctx.restore(); }
      }
      for (a = 0; a < gulls.length; a++) if (gulls[a]) gaviotaDibujo(gulls[a], G2, now);
      ctx.restore();
      hud(f, now, true);
      if (typeof drawP === 'function') drawP();
    }
    /* textos de guía y marcador (los mismos en 2D y en 3D; en 3D van después de esc.render()) */
    function hud(f, now, flechasViento) {
      var a;
      /* viento */
      var wd = windAt(now), aw = Math.abs(wd), wx = f.x0 + (f.x1 - f.x0) / 2, ws = wd >= 0 ? 1 : -1;
      if (aw > 1 && flechasViento) {
        var nl = 1 + Math.floor(aw / 25);
        for (a = 0; a < nl; a++) { var sxw = wx - ws * 8 * nl + ws * (a * 16); poly([[sxw, 218], [sxw + ws * 12, 225], [sxw, 232]], '#fffdf2', 2.5); }
        txt('VIENTO', wx, 244, 11, '#fffdf2', 0, true);
      }
      /* marcador de equipos (la cava de cada uno) */
      var vA = Vtm(0), vB = Vtm(1), wf = f.x1 - f.x0, fz = wf < 420 ? 13 : 17, cxm = (f.x0 + f.x1) / 2;
      txt(TEAMN[0] + ' ' + vA, cxm - 88, 80, 17, TEAM[0], 0, false); txt(vB + ' ' + TEAMN[1], cxm + 88, 80, 17, TEAM[1], 0, false);
      for (a = 0; a < 2; a++) { var dvv = derivaV(a, now), na = Math.abs(dvv) > 25 ? (Math.abs(dvv) > 75 ? 3 : 2) : 1; if (now >= 0 && now < dur) txt(new Array(na + 1).join(dvv >= 0 ? '›' : '‹') + ' CORRIENTE', cxm + (a ? 88 : -88), 96, 10, '#8fe0ff', 0, true); }
      /* textos de guía */
      if (banT > 0) txt(banner, cxm, 104, fz + Math.sin(absT * 12), banCol, 0, true);
      else if (now >= -0.4 && now < 2.6 && !c.practica) txt('¡AGARRA LAS FRÍAS QUE SE CALIENTAN!', cxm, 104, fz, '#fffdf2', 0, true);
      if (now >= 0 && now < dur && lluvia(now)) txt('¡LLUVIA DE FRÍAS! x2', cxm, 120, 14 + Math.sin(absT * 14) * 2, '#8fe0ff', 0, true);
      if (now >= 0 && now < dur) { var fz2 = fase(now); txt(fz2 === 2 ? '¡FRENESÍ!' : fz2 === 1 ? 'SE ALBOROTA' : 'CALMA', cxm, 58, 11, fz2 === 2 ? '#ff5c5c' : fz2 === 1 ? '#ffd23f' : '#fffdf2', 0, true); }
      for (a = 0; a < 2; a++) { var ra2 = P[TM[a].rc].racha; if (ra2 >= 2 && now < dur) txt('RACHA ' + ra2, cxm + (a ? 88 : -88), 62, 11, '#ffd23f', 0, true); }
      if (c.yo >= 0 && now >= -0.4 && now < 6) {
        var esL = TM[tmOf[c.yo]].th === c.yo;
        pill(cxm, 440, wf < 420 ? 300 : 470); txt(esL ? 'LANZAS: el aro va y viene: toca A cuando pase por tu cava' : 'ATRAPAS: corre con la cava · a la SOMBRA vale +1 · agarra el rebote', cxm, 440, wf < 420 ? 11 : 15, '#ffd23f', 0, true);
      }
      if (c.yo >= 0 && TM[tmOf[c.yo]].rc === c.yo && TM[tmOf[c.yo]].th !== c.yo) {
        var ga = gullActiva(tmOf[c.yo], now);
        if (ga && !ga.scared && now - ga.tl < WIN1) { pill(cxm, 440, 190); txt('¡A = ESPANTAR!', cxm, 440, 20 + Math.sin(absT * 16) * 2, '#ffffff', 0, true); }
        else if (pelotaCerca(P[c.yo], now, PKICK + 60)) { pill(cxm, 440, 190); txt('¡A = PATEAR!', cxm, 440, 20 + Math.sin(absT * 16) * 2, '#ffffff', 0, true); }
      }
    }

    /* ───── 3D low poly (fiesta-3d.js): la playa con las dos torres de salvavidas, las cavas y la gaviota. Solo dibujo: lee P, fls y gulls; no toca la simulación ─────
       Vista de lado como el 2D: x de la simulación -> x del mundo (1/20 m por px), la altura y -> y del mundo (el borde de la cava, GY, queda a RIM3 m del piso).
       Cada equipo tiene su fila en z (ZT) para que las dos cavas no se tapen en el medio. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var RIM3 = 1.4, ZT = [1.0, -1.0], MANO3 = 4.55, TWH = (GY - OY) / 20 + RIM3 - MANO3, ZR = 1.35;     // ZR: el receptor va detrás de su cava
    function WX(x) { return (x - AW / 2) / 20; }
    function HY(y) { return (GY - y) / 20 + RIM3; }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', arena: '#f2d9a0', arena2: '#e6c383', mar: '#2fa7d8', mar2: '#8fe0f4', astro: '#ffe14d', astroY: 19, astroR: 7, nube: '#ffffff', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', arena: '#e8b983', arena2: '#d9a06a', mar: '#c8645a', mar2: '#ffb08a', astro: '#ff9a3a', astroY: 6, astroR: 13, nube: '#ffc8a8', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', arena: '#8a7a8e', arena2: '#76687c', mar: '#1c2c6a', mar2: '#5a7ad0', astro: '#f4f0d0', astroY: 20, astroR: 5, nube: '#4a4478', noche: 1 }
    };
    var BANDER = ['#ff5c8a', '#ffd23f', '#3fd0a0', '#3fa9ff', '#ff8a3f'];
    function quitar(m) { if (m && v3) v3.esc.scene.remove(m); }
    function item3D(ty) {                                       // hielo (cubo translúcido), refresco (lata roja) o botella de vidrio verde
      var T = THREE, g3 = new T.Group(), M = V3.malla;
      if (ty === 0) {
        var cu = M(new T.BoxGeometry(.72, .72, .72), '#bdeeff', { op: .88, g: .06 }); g3.add(cu);
        var br = new T.Mesh(new T.BoxGeometry(.26, .08, .02), new T.MeshBasicMaterial({ color: 0xffffff })); br.position.set(-.12, .2, .37); br.rotation.z = .3; g3.add(br);
      } else if (ty === 1) {
        var la = M(new T.CylinderGeometry(.3, .3, .84, 10), '#e8483a', { g: .06 }); g3.add(la);
        var fa = M(new T.CylinderGeometry(.31, .31, .24, 10), '#fffdf2', { borde: false }); g3.add(fa);
        var ta = M(new T.CylinderGeometry(.24, .3, .08, 10), '#c9c9d4', { borde: false }); ta.position.y = .46; g3.add(ta);
      } else {
        var bo = M(new T.CylinderGeometry(.27, .27, .7, 9), '#3f9a52', { op: .9, g: .06 }); bo.position.y = -.12; g3.add(bo);
        var cue = M(new T.CylinderGeometry(.1, .24, .45, 9), '#3f9a52', { op: .9, g: .08 }); cue.position.y = .45; g3.add(cue);
        var tp = M(new T.CylinderGeometry(.11, .11, .08, 8), '#ffd23f', { borde: false }); tp.position.y = .7; g3.add(tp);
        var et = M(new T.CylinderGeometry(.28, .28, .22, 9), '#fffdf2', { borde: false }); et.position.y = -.1; g3.add(et);
      }
      return g3;
    }
    function cava3D(tm) {                                       // la cava de anime: cuerpo del color del equipo, borde blanco, tapa abierta, cara, y lo que lleva dentro asomándose
      var T = THREE, M = V3.malla, g3 = new T.Group(), k;
      var cu = M(new T.BoxGeometry(2.8, 1.1, 1.6), TEAM[tm], { g: .03, recibe: true }); cu.position.y = .7; g3.add(cu);
      var bo = M(new T.BoxGeometry(2.95, .22, 1.72), '#fffdf2', { g: .04 }); bo.position.y = 1.3; g3.add(bo);
      var bisagra = new T.Group(); bisagra.position.set(0, 1.4, -.86); bisagra.rotation.x = -1.95; g3.add(bisagra);
      var tapa = M(new T.BoxGeometry(2.95, .18, 1.7), '#fffdf2', { g: .04 }); tapa.position.set(0, 0, .85); bisagra.add(tapa);
      var asa = M(new T.TorusGeometry(.32, .07, 5, 10, Math.PI), '#14101c', { borde: false }); asa.position.set(1.48, .95, 0); asa.rotation.y = Math.PI / 2; g3.add(asa);
      var asa2 = asa.clone(); asa2.position.x = -1.48; g3.add(asa2);
      for (k = 0; k < 4; k++) { var ru = M(new T.CylinderGeometry(.16, .16, .12, 8), '#2a2a34', { g: .05 }); ru.rotation.x = Math.PI / 2; ru.position.set(k < 2 ? -1.1 : 1.1, .16, k % 2 ? .7 : -.7); g3.add(ru); }
      /* cara: ojos grandes, brillos, cachetes, boca */
      var cara = new T.Group(); cara.position.set(0, .72, .81); g3.add(cara);
      var ojoB = new T.MeshBasicMaterial({ color: 0xfffdf2 }), ojoN = new T.MeshBasicMaterial({ color: 0x2a5ad0 }), ink = new T.MeshBasicMaterial({ color: 0x14101c }), ros = new T.MeshBasicMaterial({ color: 0xff8aa5 });
      var ojos = [];
      for (k = 0; k < 2; k++) {
        var sx = k ? .42 : -.42, oj = new T.Group(); oj.position.set(sx, .08, 0); cara.add(oj);
        var bl = new T.Mesh(new T.CircleGeometry(.22, 14), ojoB); bl.scale.y = 1.2; oj.add(bl);
        var pu = new T.Mesh(new T.CircleGeometry(.14, 12), ojoN); pu.position.set(0, -.02, .005); pu.scale.y = 1.25; oj.add(pu);
        var bri = new T.Mesh(new T.CircleGeometry(.05, 8), ojoB); bri.position.set(-.05, .08, .01); oj.add(bri);
        var ach = new T.Mesh(new T.RingGeometry(.12, .18, 10, 1, 0, Math.PI), ink); ach.position.set(0, -.04, .012); ach.visible = false; oj.add(ach);   // ojo de alegría (^)
        var mej = new T.Mesh(new T.CircleGeometry(.1, 10), ros); mej.position.set(sx * 1.6, -.22, 0); mej.scale.set(1.5, .8, 1); cara.add(mej);
        ojos.push({ g: oj, bl: bl, pu: pu, bri: bri, ach: ach });
      }
      var boca = new T.Mesh(new T.RingGeometry(.06, .1, 10, 1, Math.PI, Math.PI), ink); boca.position.set(0, -.22, .01); cara.add(boca);
      /* lo que tiene dentro: hasta 8 cositas que se asoman */
      var dentro = [];
      for (k = 0; k < 8; k++) { var it = item3D(k % 3 === 2 ? 1 : 0); it.scale.setScalar(.62); it.position.set(-1.05 + (k % 4) * .7, 1.45 + (k >= 4 ? .32 : 0), k >= 4 ? .25 : -.25); it.rotation.set(.3 * k, .5 * k, .2); it.visible = false; g3.add(it); dentro.push(it); }
      return { g: g3, ojos: ojos, boca: boca, dentro: dentro, tapa: bisagra };
    }
    function gaviota3D() {
      var T = THREE, M = V3.malla, g3 = new T.Group();
      var cu = M(new T.SphereGeometry(.45, 9, 7), '#ffffff', { g: .06 }); cu.scale.set(1.5, .85, .9); g3.add(cu);
      var ca = M(new T.SphereGeometry(.3, 8, 6), '#ffffff', { g: .07 }); ca.position.set(.65, .28, 0); g3.add(ca);
      var pi = M(new T.ConeGeometry(.1, .42, 6), '#ff9a2a', { g: .08 }); pi.rotation.z = -Math.PI / 2; pi.position.set(1.0, .24, 0); g3.add(pi);
      var oj = new T.Mesh(new T.SphereGeometry(.05, 6, 4), new T.MeshBasicMaterial({ color: 0x14101c })); oj.position.set(.82, .36, .2); g3.add(oj);
      var oj2 = oj.clone(); oj2.position.z = -.2; g3.add(oj2);
      var co = M(new T.ConeGeometry(.22, .5, 4), '#d9d9e4', { g: .06 }); co.rotation.z = Math.PI / 2; co.position.set(-.85, .05, 0); g3.add(co);
      var alas = [];
      for (var k = 0; k < 2; k++) {
        var piv = new T.Group(); piv.position.set(0, .18, k ? -.3 : .3); g3.add(piv);
        var al = M(new T.BoxGeometry(.7, .06, 1.5), '#f4f4f8', { g: .06 }); al.position.z = k ? -.75 : .75; piv.add(al);
        var pu = M(new T.BoxGeometry(.4, .07, .45), '#3a3a48', { borde: false }); pu.position.set(-.1, 0, k ? -1.3 : 1.3); piv.add(pu);
        alas.push(piv);
      }
      var robo = item3D(0); robo.scale.setScalar(.6); robo.position.set(.2, -.55, 0); robo.visible = false; g3.add(robo);
      var som = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: 0, depthWrite: false }));
      som.rotation.x = -Math.PI / 2; som.position.y = .04;
      return { g: g3, alas: alas, robo: robo, som: som, px: 0, sale: 0 };
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, tm;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 70, 230], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 8);
      if (V3.pista) V3.pista('cava', { bpm: 138, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],      // tambor de la costa en La menor: i–iv–V–i
        mel: [76, 0, 76, 79, 81, 0, 79, 76, 74, 0, 77, 0, 74, 72, 69, 0, 71, 0, 74, 76, 80, 0, 76, 74, 72, 0, 71, 0, 69, 0, 0, 0] });
      if (V3.pista) V3.pista('cava2', { bpm: 174, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [52, 56, 59]],     // ¡últimos segundos!: la misma costa, más rápida y con el V colgado
        mel: [81, 0, 81, 79, 81, 0, 84, 81, 79, 0, 77, 76, 74, 0, 76, 0, 80, 0, 80, 81, 83, 0, 80, 76, 74, 76, 77, 0, 76, 0, 0, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* arena con granitos, y el mar al fondo con su espuma */
      var arenaT = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.arena; x.fillRect(0, 0, w, h);
        for (var j = 0; j < 260; j++) { x.fillStyle = j % 3 ? pl.arena2 : V3.oscurecer(pl.arena, 1.08); x.fillRect((j * 67) % w, (j * 151) % h, 2 + j % 3, 2); }
      }, [20, 8]);
      var arena = new T.Mesh(new T.PlaneGeometry(200, 60), new T.MeshToonMaterial({ map: arenaT, gradientMap: V3.toon('#fff').gradientMap }));
      arena.rotation.x = -Math.PI / 2; arena.position.set(0, 0, 17.5); arena.receiveShadow = true; S3.add(arena);
      var mojada = new T.Mesh(new T.PlaneGeometry(200, 3), tn(V3.oscurecer(pl.arena, .82))); mojada.rotation.x = -Math.PI / 2; mojada.position.set(0, .01, -11.5); mojada.receiveShadow = true; S3.add(mojada);
      var mar = new T.Mesh(new T.PlaneGeometry(400, 220), tn(pl.mar)); mar.rotation.x = -Math.PI / 2; mar.position.set(0, -.08, -123); S3.add(mar);
      var espuma = new T.Mesh(new T.PlaneGeometry(200, .9), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 })); espuma.rotation.x = -Math.PI / 2; espuma.position.set(0, .03, -12.6); S3.add(espuma);
      var olas = [];
      for (k = 0; k < 9; k++) { var ol = new T.Mesh(new T.PlaneGeometry(10 + (k % 3) * 5, .35), new T.MeshBasicMaterial({ color: new T.Color(pl.mar2), transparent: true, opacity: .75 })); ol.rotation.x = -Math.PI / 2; ol.position.set(((k * 23) % 60) - 30, -.04, -16 - k * 4.5); S3.add(ol); olas.push(ol); }
      /* el sol (o la luna) al fondo, sin niebla, y estrellas de noche */
      var astro = new T.Mesh(new T.SphereGeometry(pl.astroR, 20, 14), new T.MeshBasicMaterial({ color: new T.Color(pl.astro), fog: false })); astro.position.set(-26, pl.astroY, -190); S3.add(astro);
      var halo = new T.Mesh(new T.CircleGeometry(pl.astroR * 1.5, 24), new T.MeshBasicMaterial({ color: new T.Color(pl.astro), transparent: true, opacity: .25, fog: false })); halo.position.set(-26, pl.astroY, -192); S3.add(halo);
      var estrellas = [];
      if (pl.noche) for (k = 0; k < 40; k++) { var es = new T.Mesh(new T.SphereGeometry(.25, 4, 3), new T.MeshBasicMaterial({ color: 0xfffdf2, fog: false, transparent: true })); es.position.set(((k * 53) % 240) - 120, 14 + ((k * 37) % 40), -185); S3.add(es); estrellas.push(es); }
      /* nubes que pasan */
      var nubes = [];
      for (k = 0; k < 5; k++) {
        var nu = new T.Group(); nu.position.set(-60 + k * 27, 20 + (k % 3) * 4, -90 - (k % 2) * 25); S3.add(nu);
        for (var b = 0; b < 4; b++) { var bo2 = M(new T.IcosahedronGeometry(2.2 + (b % 2) * 1.2, 0), pl.nube, { borde: false, sombra: false }); bo2.position.set(b * 2.6 - 4, (b % 2) * 1.2, 0); nu.add(bo2); }
        nubes.push(nu);
      }
      /* el peñero que se mece en el mar */
      var bote = new T.Group(); bote.position.set(16, 0, -40); S3.add(bote);
      var casco = M(new T.BoxGeometry(5, .9, 1.6), '#fffdf2', { g: .03 }); casco.position.y = .3; bote.add(casco);
      var franja = M(new T.BoxGeometry(5.05, .25, 1.65), '#e8483a', { borde: false }); franja.position.y = .55; bote.add(franja);
      var proa = M(new T.ConeGeometry(.8, 1.4, 4), '#fffdf2', { g: .03 }); proa.rotation.z = -Math.PI / 2; proa.position.set(3.1, .35, 0); proa.scale.set(1, 1, .8); bote.add(proa);
      var motor = M(new T.BoxGeometry(.6, .9, .6), '#2a2a34', { g: .04 }); motor.position.set(-2.7, .7, 0); bote.add(motor);
      /* palmeras */
      var hojas = [];
      function palmera(x, z, h) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        for (var i2 = 0; i2 < 6; i2++) { var tr = M(new T.CylinderGeometry(.28 - i2 * .02, .34 - i2 * .02, h / 6, 6), i2 % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(i2 * .3) * .3, h / 12 + i2 * h / 6, 0); g3.add(tr); }
        for (var j2 = 0; j2 < 7; j2++) { var hoja = M(new T.ConeGeometry(.5, 3.6, 4), j2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); hoja.geometry.translate(0, 1.8, 0); hoja.position.set(.5, h, 0); hoja.rotation.set(0, j2 / 7 * 6.28, 0); hoja.rotateZ(1.9); g3.add(hoja); hojas.push(hoja); }
        for (var c2 = 0; c2 < 3; c2++) { var co = M(new T.SphereGeometry(.3, 6, 5), '#6a4a22', { g: .05 }); co.position.set(.5 + Math.cos(c2 * 2.1) * .35, h - .3, Math.sin(c2 * 2.1) * .35); g3.add(co); }
      }
      palmera(-18.5, -7, 8); palmera(18.5, -7, 8.5); palmera(-24, -2, 7); palmera(24, -1, 7.5); palmera(-9, -10.5, 7); palmera(10, -10, 6.5);
      /* sombrillas con silla */
      function sombrilla(x, z, col) {
        var po = M(new T.CylinderGeometry(.07, .07, 3.4, 6), '#fffdf2'); po.position.set(x, 1.7, z); S3.add(po);
        var te = M(new T.ConeGeometry(2.2, .9, 8), col, { g: .03 }); te.position.set(x, 3.6, z); S3.add(te);
        var si = M(new T.BoxGeometry(1.2, .12, 2.2), col, { g: .04 }); si.position.set(x + .6, .45, z + .4); si.rotation.x = -.25; S3.add(si);
      }
      sombrilla(-20, -3.5, '#ff5c8a'); sombrilla(20.5, -4, '#3fd0a0'); sombrilla(-5, -8.5, '#ffd23f'); sombrilla(5.5, -8, '#a9a0ff');
      /* el kiosco de empanadas en el medio, atrás */
      var kio = new T.Group(); kio.position.set(0, 0, -9.5); S3.add(kio);
      var kc = M(new T.BoxGeometry(5, 2.4, 2.6), '#3fd0a0', { recibe: true, g: .02 }); kc.position.y = 1.2; kio.add(kc);
      var mo = M(new T.BoxGeometry(5.2, .25, 1), '#c98a4a', { g: .03 }); mo.position.set(0, 1.25, 1.6); kio.add(mo);
      var te2 = M(new T.ConeGeometry(4.4, 1.8, 4), '#d9b25a', { g: .02 }); te2.rotation.y = Math.PI / 4; te2.scale.set(1, 1, .7); te2.position.y = 3.3; kio.add(te2);
      for (k = 0; k < 4; k++) { var pa2 = M(new T.CylinderGeometry(.09, .09, 2.6, 6), '#8a5a30'); pa2.position.set(k < 2 ? -2.4 : 2.4, 1.3, k % 2 ? 1.9 : -1.2); kio.add(pa2); }
      var letrero = V3.texturaCanvas(256, 64, function (x, w, h) {
        x.fillStyle = '#fffdf2'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8483a'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8);
        x.fillStyle = '#14101c'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('¡FRÍAS Y EMPANADAS!', w / 2, h / 2 + 2);
      });
      var le = new T.Mesh(new T.PlaneGeometry(4.4, 1.1), new T.MeshBasicMaterial({ map: letrero })); le.position.set(0, 2.15, 1.32); kio.add(le);
      var ven = M(new T.BoxGeometry(3.6, .9, .1), pl.noche ? '#ffd36a' : '#2a4a5a', { g: .03, em: pl.noche ? '#ffb030' : null, emI: .9 }); ven.position.set(0, 1.0, 1.31); kio.add(ven);
      if (pl.noche) { var luzK = new T.PointLight(0xffc870, 1.3, 18, 2); luzK.position.set(0, 2.6, -7); S3.add(luzK);
        var luzF = new T.PointLight(0xffd890, 1.0, 22, 2); luzF.position.set(0, 7, 3); S3.add(luzF); }
      /* la guirnalda entre las palmeras: banderines de día, bombillos de noche */
      var banderas = [], bombillos = [];
      (function () {
        var pts = [], i2, a0 = new T.Vector3(-18.5, 7.2, -7), a1 = new T.Vector3(18.5, 7.6, -7);
        for (i2 = 0; i2 <= 24; i2++) { var u = i2 / 24; pts.push(new T.Vector3(a0.x + (a1.x - a0.x) * u, a0.y + (a1.y - a0.y) * u - Math.sin(u * Math.PI) * 1.6, a0.z)); }
        var cur = new T.CatmullRomCurve3(pts); S3.add(new T.Mesh(new T.TubeGeometry(cur, 30, .03, 4), tn('#14101c')));
        var tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-.32, 0, 0, .32, 0, 0, 0, -.7, 0], 3)); tri.computeVertexNormals();
        for (i2 = 0; i2 < 26; i2++) {
          var p2 = cur.getPoint((i2 + .5) / 26);
          if (pl.noche && i2 % 2) { var bb = new T.Mesh(new T.SphereGeometry(.16, 6, 4), tn('#fff6c0', { em: BANDER[(i2 + 2) % BANDER.length], emI: 2 })); bb.position.copy(p2); bb.position.y -= .08; S3.add(bb); bombillos.push(bb); continue; }
          var f2 = new T.Mesh(tri, new T.MeshToonMaterial({ color: BANDER[i2 % BANDER.length], side: T.DoubleSide, gradientMap: V3.toon('#fff').gradientMap }));
          f2.position.copy(p2); f2.castShadow = true; S3.add(f2); banderas.push(f2);
        }
      })();
      /* las toallas de cada equipo marcan su carril, las arenas movedizas (nivel 2-3) y las torres de salvavidas de los lanzadores */
      var remolinos = [], torres = [], banderines = [];
      for (tm = 0; tm < 2; tm++) {
        var lo = WX(LANE[tm][0] - 40), hi = WX(LANE[tm][1] + 40);
        var toalla = V3.texturaCanvas(64, 16, (function (col) { return function (x, w, h) { var j; for (j = 0; j < 8; j++) { x.fillStyle = j % 2 ? '#fffdf2' : col; x.fillRect(j * 8, 0, 8, h); } }; })(TEAM[tm]), [Math.max(1, Math.round((hi - lo) / 3)), 1]);
        var to = new T.Mesh(new T.PlaneGeometry(hi - lo, 1.5), new T.MeshToonMaterial({ map: toalla, gradientMap: V3.toon('#fff').gradientMap })); to.rotation.x = -Math.PI / 2; to.position.set((lo + hi) / 2, .02, ZT[tm] + .3); to.receiveShadow = true; S3.add(to);
        if (hasSand) {
          var sx3 = WX(sand[tm] + SAND_W / 2), rr3 = (SAND_W / 2 + 8) / 20;
          var poz = new T.Mesh(new T.CircleGeometry(rr3, 24), tn('#a67c4a')); poz.rotation.x = -Math.PI / 2; poz.position.set(sx3, .035, ZT[tm] + .3); poz.scale.y = .55; poz.receiveShadow = true; S3.add(poz);
          var rem = new T.Group(); rem.position.set(sx3, .045, ZT[tm] + .3); rem.scale.set(1, 1, .55); S3.add(rem);
          for (k = 0; k < 3; k++) { var ar = new T.Mesh(new T.RingGeometry(rr3 * (.25 + k * .22), rr3 * (.33 + k * .22), 16, 1, k * 2, 3.6), new T.MeshBasicMaterial({ color: k % 2 ? 0x6e4a26 : 0x8a6236, side: T.DoubleSide })); ar.rotation.x = -Math.PI / 2; rem.add(ar); }
          remolinos.push(rem);
        }
        var tx = WX(TX[tm]), to2 = new T.Group(); to2.position.set(tx, 0, 0); S3.add(to2);
        for (k = 0; k < 4; k++) { var pt = M(new T.CylinderGeometry(.11, .13, TWH, 6), '#c98a4a', { g: .05 }); pt.position.set(k < 2 ? -.85 : .85, TWH / 2, k % 2 ? .85 : -.85); to2.add(pt); }
        var pla = M(new T.BoxGeometry(2.3, .22, 2.3), '#e0a860', { recibe: true, g: .03 }); pla.position.y = TWH - .1; to2.add(pla);
        var fal = M(new T.BoxGeometry(2.3, .8, .08), TEAM[tm], { g: .03 }); fal.position.set(0, TWH - .55, 1.17); to2.add(fal);
        var cr1 = M(new T.BoxGeometry(.5, .14, .02), '#fffdf2', { borde: false }); cr1.position.set(0, TWH - .55, 1.22); to2.add(cr1);
        var cr2 = M(new T.BoxGeometry(.14, .5, .02), '#fffdf2', { borde: false }); cr2.position.set(0, TWH - .55, 1.22); to2.add(cr2);
        var bar = M(new T.BoxGeometry(2.3, .1, .1), '#fffdf2', { g: .05 }); bar.position.set(0, TWH + .75, -1.1); to2.add(bar);
        var ast = M(new T.CylinderGeometry(.05, .05, 4.6, 5), '#fffdf2'); ast.position.set(tm ? 1.05 : -1.05, TWH + 2.3, -1.05); to2.add(ast);
        var bpiv = new T.Group(); bpiv.position.set(tm ? 1.05 : -1.05, TWH + 4.3, -1.05); to2.add(bpiv);
        var bt = new T.BufferGeometry(); bt.setAttribute('position', new T.Float32BufferAttribute([0, .35, 0, 0, -.35, 0, 1.4, 0, 0], 3)); bt.computeVertexNormals();
        var bd = new T.Mesh(bt, new T.MeshToonMaterial({ color: TEAM[tm], side: T.DoubleSide, gradientMap: V3.toon('#fff').gradientMap })); bpiv.add(bd); banderines.push(bpiv);
        for (k = 0; k < 4; k++) { var es2 = M(new T.BoxGeometry(.8, .08, .12), '#c98a4a', { borde: false }); es2.position.set(tm ? -1.1 : 1.1, .35 + k * TWH / 4.5, -1.15); to2.add(es2); }   // escalera
        torres.push(to2);
      }
      /* los jugadores: el lanzador en su torre, el receptor detrás de su cava */
      var pjs = [], cavas = [], manos = [];
      for (tm = 0; tm < 2; tm++) {
        var cv = cava3D(tm); cv.g.position.set(WX(P[TM[tm].rc].x), 0, ZT[tm]); S3.add(cv.g); cavas.push(cv);
        var mn = [item3D(0), item3D(1), item3D(2)]; for (k = 0; k < 3; k++) { mn[k].visible = false; S3.add(mn[k]); } manos.push(mn);
      }
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }), esL = TM[tmOf[k]].th === k;
        S3.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: new T.Color(TEAM[tmOf[k]]), transparent: true, opacity: .9 }));
        aro.rotation.x = -Math.PI / 2; S3.add(aro);
        var x3 = esL ? WX(TX[tmOf[k]]) : WX(P[k].x);
        pjs.push({ pj: pj, aro: aro, esL: esL, x: x3, px: x3, z: esL ? 0 : ZT[tmOf[k]] - ZR, y: esL ? TWH : 0, thr: P[k].thr, arenaT: 0 });
      }
      /* la vista previa del tiro: bolitas por el arco y el aro donde cae (de mi equipo; si miro, de los dos) */
      var prev = [];
      for (tm = 0; tm < 2; tm++) {
        var bolas = [];
        for (k = 0; k < 24; k++) { var bl2 = new T.Mesh(new T.SphereGeometry(.13, 6, 4), new T.MeshBasicMaterial({ color: 0xfffdf2, transparent: true, opacity: .9 })); bl2.visible = false; S3.add(bl2); bolas.push(bl2); }
        var blanco = new T.Mesh(new T.RingGeometry(PERILLA.CW / 20 - .22, PERILLA.CW / 20, 28), new T.MeshBasicMaterial({ color: new T.Color(TEAM[tm]), transparent: true, opacity: .8, depthWrite: false }));
        blanco.rotation.x = -Math.PI / 2; blanco.scale.y = .45; blanco.visible = false; S3.add(blanco);
        prev.push({ bolas: bolas, blanco: blanco, no: false });
      }
      /* rayas de viento */
      var rayas = [];
      for (k = 0; k < 7; k++) { var ra = new T.Mesh(new T.BoxGeometry(2.4, .05, .05), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); ra.position.set(((k * 9) % 30) - 15, 7 + (k % 4) * 1.6, -2 + (k % 3)); S3.add(ra); rayas.push(ra); }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      /* gaviotas de fondo que dan vueltas */
      var lejanas = [];
      for (k = 0; k < 3; k++) { var gl = gaviota3D(); gl.g.scale.setScalar(.5); S3.add(gl.g); lejanas.push(gl); }
      /* la nubecita de cada carril y su sombra (a la sombra vale +1) */
      var sombras = [];
      for (tm = 0; tm < 2; tm++) {
        var nb = new T.Group(); S3.add(nb);
        for (k = 0; k < 4; k++) { var pu3 = M(new T.IcosahedronGeometry(.9 + (k % 2) * .4, 0), pl.noche ? '#6a6498' : '#ffffff', { g: .04, sombra: false }); pu3.position.set(k * .95 - 1.4, (k % 2) * .45, 0); nb.add(pu3); }
        var sd = new T.Mesh(new T.CircleGeometry(SW / 20, 24), new T.MeshBasicMaterial({ color: 0x2a1a4a, transparent: true, opacity: .32, depthWrite: false }));
        sd.rotation.x = -Math.PI / 2; sd.scale.y = .55; S3.add(sd);
        sombras.push({ nube: nb, disco: sd });
      }
      /* el heladero con su carrito (camina entre las dos filas) */
      var hel = { g: new T.Group(), pj: V3.PJ.crear('portu', { prop: false, escala: 1.25 }) }; S3.add(hel.g); hel.g.add(hel.pj.g);
      var carro = new T.Group(); carro.position.set(1.3, 0, 0); hel.g.add(carro);
      var cb3 = M(new T.BoxGeometry(1.6, 1.1, 1.0), '#fffdf2', { g: .04 }); cb3.position.y = .85; carro.add(cb3);
      var cf3 = M(new T.BoxGeometry(1.62, .25, 1.02), '#e8483a', { borde: false }); cf3.position.y = 1.0; carro.add(cf3);
      for (k = 0; k < 2; k++) { var rd = M(new T.CylinderGeometry(.25, .25, .12, 10), '#2a2a34', { g: .05 }); rd.rotation.x = Math.PI / 2; rd.position.set(k ? .5 : -.5, .25, .52); carro.add(rd); }
      var spo = M(new T.CylinderGeometry(.05, .05, 2.2, 5), '#fffdf2'); spo.position.set(0, 2.2, 0); carro.add(spo);
      var sto = M(new T.ConeGeometry(1.2, .6, 8), '#ffd23f', { g: .04 }); sto.position.set(0, 3.3, 0); carro.add(sto);
      hel.g.visible = false;
      /* la ola que entra por la arena */
      var ola = new T.Mesh(new T.PlaneGeometry(200, 16), new T.MeshBasicMaterial({ color: new T.Color(pl.mar2), transparent: true, opacity: .55, depthWrite: false }));
      ola.rotation.x = -Math.PI / 2; ola.position.set(0, .07, -20); S3.add(ola);
      var olaE = new T.Mesh(new T.PlaneGeometry(200, .8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, depthWrite: false }));
      olaE.rotation.x = -Math.PI / 2; olaE.position.set(0, .08, -12); S3.add(olaE);
      /* las pelotas de los chamos (una por orilla) */
      var pelotas = [];
      for (tm = 0; tm < 2; tm++) {
        var pg = new T.Group(), pb = M(new T.SphereGeometry(.45, 12, 9), '#ff5c8a', { g: .05 }); pg.add(pb);
        var fr = M(new T.TorusGeometry(.45, .08, 5, 16), '#ffd23f', { borde: false }); pg.add(fr);
        var fr2 = M(new T.TorusGeometry(.45, .08, 5, 16), '#3fa9ff', { borde: false }); fr2.rotation.y = Math.PI / 2; pg.add(fr2);
        pg.visible = false; S3.add(pg); pelotas.push(pg);
      }
      var part = V3.particulas(esc, 700);
      esc.encuadrar(31, 14, new T.Vector3(0, 5.6, 0), .2);
      return V3.ultimo = { esc: esc, pjs: pjs, cavas: cavas, manos: manos, prev: prev, part: part, hojas: hojas, banderas: banderas, bombillos: bombillos, banderines: banderines, remolinos: remolinos,
        olas: olas, espuma: espuma, nubes: nubes, bote: bote, estrellas: estrellas, rayas: rayas, flecha: flecha, lejanas: lejanas, items: {}, gavs: {}, vOn: false, finS: false, ticS: -1,
        drops: {}, sombras: sombras, hel: hel, ola: ola, olaE: olaE, pelotas: pelotas, solC: esc.luces.sol.color.clone(), solI: esc.luces.sol.intensity, hemiI: esc.luces.hemi.intensity, helX: 0 };
    }
    function cavaX(tm) { return WX(P[TM[tm].rc].x); }
    function zf3(tm) { return ZT[tm] + .3; }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, k, tm, p, q, s;
      var fin = now >= dur, vA = Vtm(0), vB = Vtm(1), gana = vA > vB ? 0 : vB > vA ? 1 : -1;
      V.part.update(dt);
      /* el fondo vivo: hojas, banderines, olas, espuma, nubes, el peñero, las gaviotas de lejos */
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .07;
      for (k = 0; k < V.banderas.length; k++) V.banderas[k].rotation.x = Math.sin(t * 2.2 + k * .7) * .35;
      for (k = 0; k < V.bombillos.length; k++) V.bombillos[k].scale.setScalar(1 + .15 * Math.sin(t * 5 + k));
      for (k = 0; k < V.olas.length; k++) { var ol = V.olas[k]; ol.position.x += dt * (k % 2 ? .8 : -.6); if (ol.position.x > 40) ol.position.x = -40; if (ol.position.x < -40) ol.position.x = 40; ol.material.opacity = .45 + .35 * Math.sin(t * 1.4 + k); }
      V.espuma.position.z = -12.6 + Math.sin(t * .9) * .5; V.espuma.material.opacity = .55 + .3 * Math.sin(t * .9 + 1);
      for (k = 0; k < V.nubes.length; k++) { V.nubes[k].position.x += dt * (.7 + k * .15); if (V.nubes[k].position.x > 75) V.nubes[k].position.x = -75; }
      for (k = 0; k < V.estrellas.length; k++) V.estrellas[k].material.opacity = .5 + .5 * Math.abs(Math.sin(t * 1.7 + k * 1.3));
      V.bote.position.y = Math.sin(t * 1.2) * .25; V.bote.rotation.z = Math.sin(t * 1.2 + .6) * .06; V.bote.rotation.x = Math.sin(t * .9) * .04;
      for (k = 0; k < V.lejanas.length; k++) { var lj = V.lejanas[k], an = t * (.35 + k * .1) + k * 2.1; lj.g.position.set(Math.cos(an) * (12 + k * 6) + (k - 1) * 10, 13 + k * 1.5 + Math.sin(t + k) * .6, -26 - k * 8 + Math.sin(an) * 4); lj.g.rotation.y = -an - Math.PI / 2;
        lj.alas[0].rotation.x = -Math.sin(t * 7 + k) * .6; lj.alas[1].rotation.x = Math.sin(t * 7 + k) * .6; }
      for (k = 0; k < V.remolinos.length; k++) V.remolinos[k].rotation.y = t * (k ? -1.4 : 1.4);
      /* viento: rayas que cruzan, banderines que apuntan y el sonido cuando arranca una ráfaga */
      var wd = windAt(now), aw = Math.abs(wd), ws = wd >= 0 ? 1 : -1, von = aw > 1 && now >= 0;
      if (von !== V.vOn) { V.vOn = von; if (von) V3.sfx('viento'); }
      for (k = 0; k < V.rayas.length; k++) { var ra = V.rayas[k]; ra.position.x += ws * dt * (10 + aw * .25); if (ra.position.x > 17) ra.position.x = -17; if (ra.position.x < -17) ra.position.x = 17; ra.material.opacity = von ? cl(aw / 60, .15, .7) * (.5 + .5 * Math.sin(t * 3 + k)) : 0; }
      for (k = 0; k < V.banderines.length; k++) { var bn = V.banderines[k]; bn.rotation.y = (von ? (ws > 0 ? 0 : Math.PI) : (k ? Math.PI : 0) + .4) + Math.sin(t * (von ? 9 : 3) + k) * (von ? .25 : .15); }
      /* los lanzadores en su torre: con la próxima cosa sobre la cabeza (cargar) cuando están listos; lanzar al soltar */
      for (tm = 0; tm < 2; tm++) {
        p = TM[tm].th; q = P[p]; s = V.pjs[p];
        var lista = now >= q.cd && !fin && now >= -0.5, ty = seq[q.n % seq.length], mn = V.manos[tm];
        if (q.thr !== s.thr) { s.thr = q.thr; if (q.thr > -1) { s.pj.uno('lanzar'); V3.sfx('whoosh'); V.part.soltar(s.x, TWH + MANO3, 0, 5, { k: 'chispa', cols: ['#fffdf2', TEAM[tm]], vel: 2, arriba: 1.5, vida: .35 }); } }
        if (fin && now > 0) s.pj.anim(gana === tm ? 'celebrar' : gana < 0 ? 'bailar' : 'triste').cara(gana === tm || gana < 0 ? 'feliz' : 'triste');
        else if (lista) s.pj.anim('cargar', { vel: 0 }).cara(ty === 2 ? 'susto' : 'concentrado');
        else s.pj.anim('quieto').cara(now - q.thr < 1 ? 'feliz' : 'normal');
        s.pj.rumbo(tm ? -.9 : .9).update(dt);
        s.pj.g.position.set(s.x, TWH, 0);
        s.aro.position.set(s.x, TWH + .03, 0);
        for (k = 0; k < 3; k++) { mn[k].visible = !!(lista && k === ty && now - q.thr > .25); if (mn[k].visible) { mn[k].position.set(s.x, TWH + MANO3 + Math.sin(t * 4) * .04, 0); mn[k].rotation.y = t * 1.5; } }
      }
      /* los receptores y sus cavas */
      for (tm = 0; tm < 2; tm++) {
        p = TM[tm].rc; q = P[p]; var cv = V.cavas[tm], cx = WX(q.x);
        var hop = Math.max(0, 1 - (now - q.happy) / .35), hurt = now - q.hurt < .6, happy = now - q.happy < .5, shoo = now - q.shoo < SHOO, gav = gullActiva(tm, now);
        cv.g.position.set(cx, Math.sin(hop * Math.PI) * .45, ZT[tm]);
        cv.g.rotation.z = hurt ? Math.sin(t * 40) * .06 : 0;
        cv.tapa.rotation.x = -1.95 + (happy ? Math.sin(t * 20) * .25 : 0);
        var parp = (t % 3.3) < .1;
        for (k = 0; k < 2; k++) { var oj = cv.ojos[k], alegre = happy || (fin && gana === tm); oj.ach.visible = !!alegre; oj.bl.visible = !alegre; oj.pu.visible = !alegre && !hurt; oj.bri.visible = !alegre && !hurt;
          oj.g.scale.y = parp && !alegre ? .15 : 1; oj.pu.position.x = cl((q.x - (cv.ox || q.x)) * .02, -.05, .05); }
        cv.ox = q.x;
        cv.boca.scale.set(happy ? 1.8 : hurt ? 1.2 : 1, happy ? 1.8 : hurt ? -1 : 1, 1);
        var V2 = q.v, nI = Math.min(8, V2);
        for (k = 0; k < 8; k++) cv.dentro[k].visible = k < nI;
        if (TM[tm].th === p) continue;                                // un solo asiento hace los dos oficios: no hay receptor aparte
        s = V.pjs[p];
        s.x = cx; var vx = (s.x - s.px) / Math.max(dt, 1e-3); s.px = s.x;
        var av = Math.abs(vx), enA = enArena(tm, q.x);
        if (fin && now > 0) s.pj.anim(gana === tm ? 'celebrar' : gana < 0 ? 'bailar' : 'triste').cara(gana === tm || gana < 0 ? 'feliz' : 'triste');
        else if (shoo) s.pj.anim('saludar').cara('enojado');
        else s.pj.anim(av > 4 ? 'correr' : av > .5 ? 'caminar' : 'quieto', { vel: Math.min(1, av / 8) })
          .cara(hurt ? 'susto' : happy ? 'feliz' : gav && !gav.scared ? 'susto' : enA && av > .5 ? 'enojado' : 'concentrado');
        s.pj.rumbo(av > .5 && !(fin && now > 0) ? (vx > 0 ? 1.2 : -1.2) : 0).update(dt);
        s.pj.g.position.set(s.x, 0, ZT[tm] - ZR);
        s.aro.position.set(s.x, .03, ZT[tm] - ZR);
        if (enA && av > .5) { s.arenaT -= dt; if (s.arenaT < 0) { s.arenaT = .12; V.part.soltar(s.x, .2, ZT[tm] - .4, 3, { k: 'chispa', cols: ['#a67c4a', '#8a6236', pal.arena2], vel: 1.6, arriba: 2, vida: .45 }); } }
      }
      /* lo que vuela: el arco exacto de la simulación; al caer, a la cava (si la atrapó), al heladero, o rebota en la arena (y a la cava si lo agarró en el bote) */
      var vivos = {};
      for (k = 0; k < fls.length; k++) {
        var fl = fls[k], tau = now - fl.t0, it = V.items[fl.key];
        if (tau < 0 || tau > fl.F.T + (fl.bt ? BT : 0) + .8) continue;
        vivos[fl.key] = 1;
        if (!it) { it = V.items[fl.key] = { m: item3D(fl.ty), suelo: 0, bote: 0, vs: 0 }; V.esc.scene.add(it.m); }
        var m = it.m, sg = fl.tm ? -1 : 1, zf = ZT[fl.tm];
        if (tau <= fl.F.T) {
          var z3 = zf * Math.min(1, tau / Math.max(.1, fl.F.T));
          m.visible = true; m.position.set(WX(vx_(fl.F, tau)), HY(vy_(fl.F, tau)), z3); m.rotation.set(tau * 5, 0, -sg * tau * 7); m.scale.setScalar(1);
          if (!it.estela || t - it.estela > .07) { it.estela = t; V.part.soltar(m.position.x, m.position.y, z3, 1, { k: fl.ty === 0 ? 'chispa' : 'gota', cols: fl.ty === 0 ? ['#ffffff', '#bdeeff'] : ['#ffffff'], vel: .2, arriba: .2, g: 1, vida: .35, esc: .6 }); }
          continue;
        }
        var u = tau - fl.F.T, rc = TM[fl.tm].rc, cerca = Math.abs(P[rc].x - fl.lx) <= PERILLA.CW + 4, e3, cx2 = cavaX(fl.tm);
        if (fl.vend) {                                                                              // el heladero se la queda
          var evv = evActivo('vend', fl.T), hx = evv ? WX(vendX(evv, Math.min(now, evv.t + EVD.vend))) : WX(fl.lx);
          e3 = cl(u / .35, 0, 1); m.visible = e3 < 1; m.position.set(WX(fl.lx) + (hx - WX(fl.lx)) * e3, RIM3 + .2 + e3 * 1.2, zf * (1 - e3)); m.scale.setScalar(1 - .5 * e3);
          if (!it.vs) { it.vs = 1; V3.sfx('pop'); var ph = V.esc.proyectar(hx, 4.6, 0); S('¡GRACIAS, CHAMO!', ph.x, ph.y, '#ffd23f'); }
        } else if ((fl.res === 1 && !fl.cb) || (fl.res !== 0 && !fl.cb && u < .5 && cerca && !(fl.bt && fl.judged === 1))) {
          e3 = cl(u / .3, 0, 1);
          m.visible = e3 < 1; m.position.set(WX(fl.lx) + (cx2 - WX(fl.lx)) * e3, RIM3 + .3 - .7 * e3, zf); m.scale.setScalar(1 - .6 * e3);
        } else if (fl.bt && u <= BT && fl.res !== 0) {                                              // el bote: salta hacia adelante
          var ub = u / BT; m.visible = true; m.scale.setScalar(1);
          m.position.set(WX(fl.lx + (fl.x2 - fl.lx) * ub), .36 + Math.sin(ub * Math.PI) * 2.3, zf); m.rotation.z += dt * 9 * sg;
          if (!it.bote) { it.bote = 1; V3.sfx('salto'); V.part.soltar(WX(fl.lx), .2, zf, 8, { k: 'chispa', cols: [pal.arena, pal.arena2, '#fffdf2'], vel: 2.5, arriba: 3, vida: .45 }); }
        } else if (fl.bt && fl.res === 1) {
          e3 = cl((u - BT) / .3, 0, 1);
          m.visible = e3 < 1; m.position.set(WX(fl.x2) + (cx2 - WX(fl.x2)) * e3, .36 + (RIM3 - .1) * e3, zf); m.scale.setScalar(1 - .6 * e3);
        } else {
          var u2 = fl.bt ? Math.max(0, u - BT) : u, x0 = fl.bt ? fl.x2 : fl.lx;
          var caeT = .16, yy = fl.bt ? .36 + Math.abs(Math.sin(u2 * 9)) * .4 * Math.max(0, 1 - u2 * 1.6) : u2 < caeT ? RIM3 * (1 - (u2 / caeT) * (u2 / caeT)) + .36 : .36 + Math.abs(Math.sin((u2 - caeT) * 9)) * .7 * Math.max(0, 1 - (u2 - caeT) * 1.6);
          m.visible = true; m.position.set(WX(x0) + sg * u2 * .8, fl.mojado ? Math.max(.1, yy - u2 * .8) : yy, zf); m.rotation.z += dt * 6 * sg; m.scale.setScalar(Math.max(.2, 1 - Math.max(0, u2 - .5) * 2.5));
          if (!it.suelo && (fl.bt || u2 >= caeT)) { it.suelo = 1; V3.sfx(fl.mojado ? 'splash' : 'caida'); V.part.soltar(WX(x0), .2, zf, 12, { k: fl.mojado ? 'gota' : 'chispa', cols: fl.mojado ? ['#ffffff', '#8fe0f4'] : [pal.arena, pal.arena2, '#fffdf2'], vel: 3, arriba: 3, vida: .5 }); }
        }
      }
      for (k in V.items) if (!vivos[k]) { quitar(V.items[k].m); delete V.items[k]; }
      /* la vista previa del lanzador (solo mi equipo; si miro, los dos) */
      for (tm = 0; tm < 2; tm++) {
        var pv = V.prev[tm], ver = (c.yo < 0 || tmOf[c.yo] === tm) && now >= -0.5 && !fin, th = TM[tm].th, q2 = P[th], kk;
        var F = ver ? vuelo(tm, q2.ang, eff(q2, now + 0.05), now + 0.05) : null;
        pv.no = !!(F && now + F.T > dur - TAIL);
        if (!F || pv.no) { for (kk = 0; kk < pv.bolas.length; kk++) pv.bolas[kk].visible = false; pv.blanco.visible = false; continue; }
        var lst = now >= q2.cd - 0.05, paso = Math.max(1, Math.floor(F.xs.length / (pv.bolas.length + 1)));
        for (kk = 0; kk < pv.bolas.length; kk++) {
          var st = (kk + 1) * paso, bl = pv.bolas[kk];
          bl.visible = st < F.xs.length - 1;
          if (bl.visible) { var tt2 = st * F.h; bl.position.set(WX(vx_(F, tt2)), HY(vy_(F, tt2)), ZT[tm] * Math.min(1, tt2 / F.T)); bl.material.opacity = lst ? .95 : .4; }
        }
        pv.blanco.visible = true; pv.blanco.position.set(WX(F.lx), .06, ZT[tm] + .3); pv.blanco.material.opacity = (lst ? .7 : .3) + .2 * Math.sin(t * 8);
      }
      /* gaviotas: llegan, se lanzan sobre la cava (con su sombra que crece), huyen si las espantan o se van con el botín */
      for (k = 0; k < gulls.length; k++) {
        var gg = gulls[k]; if (!gg) continue;
        var ga = V.gavs[k], tau2 = now - gg.tl, huye = gg.scared ? now - gg.scaredAt : -1, roba = !gg.scared && tau2 > GULL_T ? tau2 - GULL_T : -1;
        var on = tau2 >= 0 && tau2 <= GULL_T + 1.4 && huye <= 1.2;
        if (!ga) { if (!on) continue; ga = V.gavs[k] = gaviota3D(); V.esc.scene.add(ga.g); V.esc.scene.add(ga.som); ga.px = 0; }
        ga.g.visible = on; ga.som.visible = on && huye < 0 && roba < 0;
        if (!on) continue;
        var side = gg.tm === 0 ? 1 : -1, ccx = cavaX(gg.tm), gx, gy, uu;
        if (tau2 < 1.2) { uu = tau2 / 1.2; gx = ccx + side * (1 - uu) * 9.5 + Math.sin(t * 3) * .6; gy = 11 - uu * 3; }
        else { uu = Math.min(1, (tau2 - 1.2) / .5); gx = ccx + Math.sin(t * 9) * .2; gy = 8 - uu * (8 - RIM3 - 1.2); }
        if (huye >= 0) { gx += side * huye * 13; gy += huye * 10; }
        else if (roba >= 0) { gx += -side * roba * 11; gy = RIM3 + 1.2 + roba * 8; }
        var dx = gx - ga.px; ga.px = gx;
        ga.g.position.set(gx, gy, ZT[gg.tm] + .2);
        if (Math.abs(dx) > 1e-4) ga.g.rotation.y = dx > 0 ? 0 : Math.PI;
        ga.g.rotation.z = tau2 > 1.2 && huye < 0 && roba < 0 ? -.5 : huye >= 0 || roba >= 0 ? .35 : 0;
        var fla = Math.sin(t * (huye >= 0 ? 26 : 16)) * .8;
        ga.alas[0].rotation.x = -fla; ga.alas[1].rotation.x = fla;
        ga.robo.visible = roba >= 0;
        var sh = cl(tau2 / 1.5, 0, 1); ga.som.position.set(ccx, .05, ZT[gg.tm]); ga.som.scale.set(.8 + 1.4 * sh, (.8 + 1.4 * sh) * .45, 1); ga.som.material.opacity = .2 + .3 * sh;
        ga.scr = tau2 < 1.0 && huye < 0 && roba < 0 ? V.esc.proyectar(gx, gy + 1.3, ZT[gg.tm]) : null;
      }
      /* la sombra de cada carril (su nubecita encima) */
      for (tm = 0; tm < 2; tm++) {
        var so = V.sombras[tm], sxx = WX(sombraX(tm, now)), enS = Math.abs(P[TM[tm].rc].x - sombraX(tm, now)) <= SW;
        so.nube.position.set(sxx, 9.5 + Math.sin(t * 1.3 + tm) * .25, zf3(tm)); so.disco.position.set(sxx, .05, ZT[tm] + .3);
        so.disco.material.opacity = enS ? .45 + .1 * Math.sin(t * 8) : .3;
      }
      /* los eventos de playa: el heladero, la ola, las pelotas */
      var ev3 = null, kE, uE;
      V.hel.g.visible = false; for (tm = 0; tm < 2; tm++) V.pelotas[tm].visible = false;
      var olaZ = -20;
      for (kE = 0; kE < EVS.length; kE++) {
        ev3 = EVS[kE]; uE = now - ev3.t;
        if (uE < -AV || uE > EVD[ev3.k] + 1.2) continue;
        if (ev3.k === 'vend' && uE >= 0 && uE <= EVD.vend) {
          var hx3 = WX(vendX(ev3, now)); V.hel.g.visible = true; V.hel.g.position.set(hx3, 0, 0);
          V.hel.g.rotation.y = ev3.d > 0 ? Math.PI / 2 : -Math.PI / 2;
          V.hel.pj.anim('empujar', { vel: .8 }).cara('feliz').update(dt);
        } else if (ev3.k === 'ola') {
          olaZ = uE < 0 ? -12.6 + (uE + AV) / AV * 2 : -10.6 + 14 * Math.sin(Math.PI * cl(uE / OLA_D, 0, 1));
          if (uE > OLA_D) olaZ = -10.6 - (uE - OLA_D) * 8;
        } else if (ev3.k === 'pelota') {
          for (tm = 0; tm < 2; tm++) {
            var b3 = bS[tm * 100 + ev3.i], pb3 = V.pelotas[tm], bx3, by3, bz3 = ZT[tm];
            if (uE < 0) { bx3 = WX(AW / 2) + (tm ? .8 : -.8); by3 = .45 + Math.abs(Math.sin(t * 6 + tm)) * 2.2; bz3 = 0; }
            else if (b3 && b3.s) { var ua3 = now - b3.t; if (ua3 > 1.2) continue; var sgb = tm === 0 ? -1 : 1; bx3 = WX(pelotaX(ev3, tm, b3.t)) + sgb * ua3 * (b3.s === 1 ? -14 : -6); by3 = .45 + ua3 * (b3.s === 1 ? 16 : 7) - 14 * ua3 * ua3; bz3 = ZT[tm] - (b3.s === 1 ? ua3 * 10 : 0); }
            else if (uE <= PDUR) { bx3 = WX(pelotaX(ev3, tm, now)); by3 = .45 + Math.abs(Math.sin(uE * 7)) * 1.2; }
            else continue;
            pb3.visible = by3 > -1; pb3.position.set(bx3, Math.max(.45, by3), bz3); pb3.rotation.z = -t * 9 * (tm ? -1 : 1);
          }
        }
      }
      V.ola.position.z = olaZ - 8; V.olaE.position.z = olaZ; V.ola.visible = olaZ > -19; V.olaE.visible = olaZ > -19;
      /* cocos y hielo seco que caen de las palmeras */
      for (kE = 0; kE < DROPS.length; kE++) {
        var dp = DROPS[kE], uD = now - dp.t, coco = dp.k === 'coco';
        for (tm = 0; tm < 2; tm++) {
          var od = V.drops[kE * 2 + tm];
          if (uD < -1.5 || uD > 0.6) { if (od) { od.m.visible = false; od.sh.visible = false; } continue; }
          if (!od) {
            var T3 = THREE, M3 = V3.malla, gm = new T3.Group();
            if (coco) { gm.add(M3(new T3.SphereGeometry(.42, 8, 6), '#6a4a22', { g: .05 })); var mc = M3(new T3.SphereGeometry(.07, 5, 4), '#2a1c0c', { borde: false }); mc.position.set(.15, .25, .35); gm.add(mc); }
            else { gm.add(M3(new T3.OctahedronGeometry(.62), '#ffd23f', { g: .06 })); gm.add(M3(new T3.OctahedronGeometry(.34), '#fffdf2', { borde: false })); }
            var shd = new T3.Mesh(new T3.CircleGeometry(1, 14), new T3.MeshBasicMaterial({ color: coco ? 0x2a1a0a : 0xb8860b, transparent: true, opacity: .3, depthWrite: false })); shd.rotation.x = -Math.PI / 2;
            V.esc.scene.add(gm); V.esc.scene.add(shd); od = V.drops[kE * 2 + tm] = { m: gm, sh: shd, imp: 0 };
          }
          var wxD = WX(dropX(dp, tm)), zD = ZT[tm] + .3, fD = cl((uD + DUR_F) / DUR_F, 0, 1);
          od.sh.visible = uD < .3; od.sh.position.set(wxD, .06, zD); od.sh.scale.set(.4 + .7 * fD, (.4 + .7 * fD) * .55, 1); od.sh.material.opacity = .15 + .3 * fD;
          od.m.visible = uD > -DUR_F && (coco ? uD < .45 : uD < .02);
          od.m.position.set(wxD, .5 + 12 * (1 - fD * fD), zD); od.m.rotation.y += dt * 5; od.m.rotation.z = coco ? 0 : Math.sin(t * 5) * .3;
          if (uD >= 0 && !od.imp) { od.imp = 1; V.part.soltar(wxD, .3, zD, coco ? 8 : 12, { k: 'chispa', cols: coco ? ['#6a4a22', '#a67c4a'] : ['#ffd23f', '#fffdf2'], vel: 2, arriba: 2.5, vida: .4 }); V3.sfx(coco ? 'caida' : 'pop'); }
        }
      }
      /* la luz de la fase: en los últimos segundos el sol se pone rojo y late */
      var fz3 = fase(now);
      if (fz3 === 2 && now < dur) { var lat = .5 + .5 * Math.sin(t * 6); V.esc.luces.sol.color.copy(V.solC).lerp(new THREE.Color(0xff6a3a), .45 + .2 * lat); V.esc.luces.sol.intensity = V.solI * (1 + .15 * lat); V.esc.luces.hemi.intensity = V.hemiI * .9; }
      else if (fz3 === 1 && now < dur) { V.esc.luces.sol.color.copy(V.solC).lerp(new THREE.Color(0xffc070), .2); V.esc.luces.sol.intensity = V.solI; V.esc.luces.hemi.intensity = V.hemiI; }
      else { V.esc.luces.sol.color.copy(V.solC); V.esc.luces.sol.intensity = V.solI; V.esc.luces.hemi.intensity = V.hemiI; }
      /* la flecha sobre mí */
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !fin;
      if (yo) V.flecha.position.set(yo.x, (yo.esL ? TWH + MANO3 + 1.4 : 4.4) + Math.abs(Math.sin(t * 4)) * .3, yo.esL ? 0 : ZT[tmOf[c.yo]] - ZR);
      /* los últimos segundos hacen tic, y al final aplausos */
      if (now >= dur - 3 && now < dur) { var sgd = Math.floor(dur - now); if (sgd !== V.ticS) { V.ticS = sgd; V3.sfx('tic'); } }
      if (fin && !V.finS) { V.finS = true; V3.sfx('aplauso'); for (tm = 0; tm < 2; tm++) if (gana === tm || gana < 0) V.part.soltar(cavaX(tm), 3, ZT[tm], 40, { k: 'confeti', cols: BANDER, vel: 4, arriba: 6, g: 4, vida: 2 }); }
    }
    /* efectos 3D de los eventos (los llama onEv) */
    function efAtrapa(tm, dv, fria) {
      var x = cavaX(tm), z = ZT[tm], s = v3.pjs[TM[tm].rc];
      v3.part.soltar(x, RIM3 + .3, z, 18, { k: 'chispa', cols: ['#ffffff', '#bdeeff', '#8fd8ff'], vel: 3.5, arriba: 4, vida: .6 });
      v3.part.soltar(x, RIM3 + .3, z, 10, { k: 'gota', cols: ['#bdeeff', '#ffffff'], vel: 2.5, arriba: 3.5, vida: .55, esc: .8 });
      if (dv >= 2) v3.part.soltar(x, RIM3 + .6, z, 14, { k: 'confeti', cols: ['#ffd23f', '#e8483a', '#fffdf2'], vel: 3, arriba: 5, g: 6, vida: 1 });
      if (fria) v3.part.soltar(x, RIM3 + 1, z, 12, { k: 'chispa', cols: ['#8fe0ff', '#ffffff', '#3fa9ff'], vel: 2, arriba: 5, vida: .9 });
      V3.sfx(dv >= 2 ? 'moneda' : 'ding');
      if (s && TM[tm].th !== TM[tm].rc) s.pj.uno('festejo');
      v3.esc.sacudir(dv >= 2 ? .25 : .1);
    }
    function efVidrio(tm) {
      var x = cavaX(tm), z = ZT[tm], s = v3.pjs[TM[tm].rc];
      v3.part.soltar(x, RIM3 + .3, z, 26, { k: 'chispa', cols: ['#3f9a52', '#8fe0a0', '#ffffff'], vel: 5, arriba: 4, vida: .7 });
      V3.sfx('choque'); V3.sfx('error'); v3.esc.sacudir(.8);
      if (s && TM[tm].th !== TM[tm].rc) s.pj.uno('golpe');
    }
    function efPelotazo(tm) {
      var x = cavaX(tm), z = ZT[tm], s = v3.pjs[TM[tm].rc];
      v3.part.soltar(x, RIM3 + .6, z, 16, { k: 'chispa', cols: ['#ff5c8a', '#ffd23f', '#3fa9ff', '#ffffff'], vel: 4, arriba: 4, vida: .6 });
      V3.sfx('golpe'); V3.sfx('error'); v3.esc.sacudir(.7);
      if (s && TM[tm].th !== TM[tm].rc) s.pj.uno('golpe');
    }
    function efRobo(tm) {
      var x = cavaX(tm), z = ZT[tm], s = v3.pjs[TM[tm].rc];
      v3.part.soltar(x, RIM3 + 1, z, 16, { k: 'confeti', cols: ['#ffffff', '#d9d9e4'], vel: 3, arriba: 3, g: 3, vida: 1.2 });
      v3.part.soltar(x, RIM3 + .3, z, 10, { k: 'chispa', cols: ['#bdeeff', '#ffffff'], vel: 3, arriba: 3, vida: .5 });
      V3.sfx('error'); v3.esc.sacudir(.7);
      if (s && TM[tm].th !== TM[tm].rc) s.pj.uno('caer');
    }
    function efShu(gg) {
      var ga = v3.gavs[gg.i], x = ga ? ga.g.position.x : cavaX(gg.tm), y = ga ? ga.g.position.y : 6, s = v3.pjs[TM[gg.tm].rc];
      v3.part.soltar(x, y, ZT[gg.tm], 18, { k: 'confeti', cols: ['#ffffff', '#f4f4f8', '#d9d9e4'], vel: 3.5, arriba: 3, g: 2.5, vida: 1.4 });
      V3.sfx('whoosh'); V3.sfx('pop'); v3.esc.sacudir(.3);
      if (s && TM[gg.tm].th !== TM[gg.tm].rc) s.pj.uno('saltar');
    }
    function sobreCava(tm, alto2D) {                            // dónde va un aviso (say) encima de la cava del equipo
      if (v3) return v3.esc.proyectar(cavaX(tm), 5.4, ZT[tm]);
      var G2 = geom(); return { x: G2.ox + P[TM[tm].rc].x, y: GY - alto2D };
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k, tm; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && now < dur) V3.musica(fase(now) === 2 ? 'cava2' : 'cava');
      v3.esc.render(dt);
      var E = v3.esc;
      /* nombres, cuánto lleva cada cava y la recarga del lanzador */
      for (k = 0; k < n; k++) {
        var s3 = v3.pjs[k], pt = s3.esL ? E.proyectar(s3.x, TWH - .9, 1.3) : E.proyectar(s3.x, 0, ZT[tmOf[k]] + 1.3);
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (s3.esL) { var q = P[k], ty = seq[q.n % seq.length]; if (now < q.cd && now >= 0) rr(pt.x - 22, pt.y + 10, 44 * cl((q.cd - now) / (CD[ty] + 0.01), 0, 1), 5, 2, '#fffdf2', 1.5); }
      }
      for (tm = 0; tm < 2; tm++) {
        var pc = E.proyectar(cavaX(tm), 4.7, ZT[tm] - ZR), hp = Math.max(0, 1 - (now - P[TM[tm].rc].happy) / .4);
        txt(String(Vtm(tm)), pc.x, pc.y - hp * 8, 26 + hp * 8, '#fffdf2', 0, false);
        if (hasSand) { var pa = E.proyectar(WX(sand[tm] + SAND_W / 2), 0, ZT[tm] + 1.6); txt('ARENA', pa.x, pa.y, 9, '#6e4a26', 0, true); }
        if (v3.prev[tm].no && now < dur) { var pn = E.proyectar(WX(TX[tm]) + (tm ? -5 : 5), HY(OY) + 1, 0); txt('¡NO ALCANZA EL TIEMPO!', pn.x, pn.y, 12, '#ffd23f', 0, true); }
      }
      for (k in v3.gavs) { var ga = v3.gavs[k]; if (ga.scr && ga.g.visible) txt('¡GAVIOTA!', ga.scr.x, ga.scr.y, 14, '#fffdf2', 0, true); }
      for (tm = 0; tm < 2; tm++) { var ps = E.proyectar(WX(sombraX(tm, now)), 0, ZT[tm] + 1.5); if (now < dur) txt('SOMBRA +1', ps.x, ps.y, 9, pal.noche ? '#d9d0ff' : '#3a2a4a', 0, true); }
      for (k = 0; k < DROPS.length; k++) { var dh = DROPS[k], uh = now - dh.t; if (uh > -DUR_F && uh < 0) for (tm = 0; tm < 2; tm++) { var ph2 = E.proyectar(WX(dropX(dh, tm)), 0, ZT[tm] + 1.4); txt(dh.k === 'coco' ? '¡COCO!' : '★ +2', ph2.x, ph2.y, 11, dh.k === 'coco' ? '#ff8a5c' : '#ffd23f', 0, true); } }
      if (v3.hel.g.visible) { var pv3 = E.proyectar(v3.hel.g.position.x, 4.4, 0); txt('¡NO LE TIRES!', pv3.x, pv3.y, 11, '#ffd23f', 0, true); }
      hud(f, now, true);
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, a;
        absT += dt; banT = Math.max(0, banT - dt); shake = Math.max(0, shake - dt * 3);
        avisos3(now);
        gaviotas(now);
        for (p = 0; p < n; p++) { if (TM[P[p].tm].th === p) updThrow(p, dt, now); else updRec(p, dt, now); }
        for (a = fls.length - 1; a >= 0; a--) if (now > fls[a].T + 5) fls.splice(a, 1);
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (TM[P[p].tm].th === p) aiThrow(p, dt, api, now); else aiRec(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p], th = TM[q.tm].th === p;
        return { x: th ? 0 : Math.round(q.x), a: th ? Math.round(q.ang * 100) : 0, f: th ? Math.round(q.pw * 100) : 0, v: th ? 0 : q.v, z: th ? 0 : q.z };
      },
      onEv: function (ty, p, d, t) {
        var now = c.ahora(), q = P[p], G2 = geom();
        if (ty === 'tiro' && q && d) { nuevoVuelo(p, d); if (!v3) SND(520, 0.06, 'triangle', 0.03, 200); }                 // en 3D: el lanzar y su whoosh salen en actualizar3D
        else if (ty === 'cogio' && q && d) {
          var fl = null, j;
          for (j = 0; j < fls.length; j++) if (fls[j].key === d.id) fl = fls[j];
          if (fl) fl.res = 1;
          if (d.z > q.z) {
            var dv = d.v - q.v; q.v = d.v; q.z = d.z;
            if (typeof d.r === 'number') q.racha = d.r;
            if (fl && d.b) fl.cb = 1;
            if (d.rp) { var sp2 = sobreCava(q.tm, 150); S('¡MISMO SITIO! APUNTA OTRO LADO', sp2.x, sp2.y, '#ffd23f'); }
            if (dv > 0) {
              q.happy = now; if (d.s) q.sombra = now;
              var sb = sobreCava(q.tm, 150);
              if (d.pw) S('¡HIELO SECO! +2', sb.x, sb.y - 36, '#8fe0ff'); else if (d.pf) S('¡PERFECTO! +1', sb.x, sb.y - 36, '#ff8aff'); if (d.rb) S('¡RACHA x' + q.racha + '! +1', sb.x, sb.y - 18, '#ffd23f'); else if (d.s) S('¡BIEN FRÍA! +1', sb.x, sb.y, '#8fe0ff'); else if (d.b) S('¡DE REBOTE!', sb.x, sb.y, '#fffdf2');
              if (v3) efAtrapa(q.tm, dv, !!d.s); else { SPAWN(G2.ox + q.x, GY - 60, 7, 'conf', ['#bdeeff', '#fffdf2', '#ffd23f'], 220, 500, 0.6); SND(660 + dv * 120, 0.1, 'square', 0.04); }
            }
            else if (d.ty === 2) { q.hurt = now; var sv = sobreCava(q.tm, 130); S('¡UY, VIDRIO! -2', sv.x, sv.y, '#ff5c5c'); if (v3) efVidrio(q.tm); else SND(130, 0.2, 'sawtooth', 0.06, -50); shake = 0.3; }
          }
        } else if (ty === 'roba' && q && d) {
          if (d.k === 'p' && typeof d.b === 'number') { bS[q.tm * 100 + d.b] = { s: 2, t: now }; q.bonk = now; }
          if (d.z > q.z) {
            var sr = sobreCava(q.tm, 130), perdio = q.v - d.v; q.v = d.v; q.z = d.z; if (typeof d.r === 'number') q.racha = d.r;
            if (d.k === 'p') { q.hurt = now; S(perdio > 0 ? '¡PELOTAZO! -1' : '¡PELOTAZO!', sr.x, sr.y, '#ff5c5c'); shake = 0.5; if (v3) efPelotazo(q.tm); else SND(150, 0.2, 'square', 0.07, -60); }
            else if (d.k === 'c') { q.hurt = now; S('¡COCOTAZO!' + (perdio > 0 ? ' -1' : ''), sr.x, sr.y, '#ff8a5c'); shake = 0.4; if (v3) efPelotazo(q.tm); else SND(170, 0.2, 'square', 0.07, -60); }
            else if (d.k === 'm') { if (perdio > 0) { q.hurt = now; S('¡SE CAYÓ! -1', sr.x, sr.y, '#ff8a5c'); if (v3) V3.sfx('caida'); else SND(200, 0.12, 'sawtooth', 0.04, -60); } }
            else { q.hurt = now; S('¡SE LLEVÓ ' + d.s + '!', sr.x, sr.y, '#ff5c5c'); shake = 0.4; if (v3) efRobo(q.tm); else SND(180, 0.25, 'sawtooth', 0.07, -80); }
          }
        } else if (ty === 'patea' && q && d && typeof d.i === 'number') {
          var kb = bS[q.tm * 100 + d.i]; if (!kb || kb.s !== 1) bS[q.tm * 100 + d.i] = { s: 1, t: now };
          q.kick = now; var sk2 = sobreCava(q.tm, 150); S('¡PATADA!', sk2.x, sk2.y, '#fffdf2'); if (v3) { V3.sfx('golpe'); V3.sfx('whoosh'); } else SND(300, 0.08, 'square', 0.05);
        } else if (ty === 'gav' && d && !gulls[d.i]) {
          gulls[d.i] = { i: d.i, tm: d.tm === 1 ? 1 : 0, tl: d.tl / 1000, scared: 0, scaredAt: 0, applied: 0, mine: {} }; gSent[d.i] = 1;
          banner = '¡LA GAVIOTA VA POR LA CAVA ' + TEAMN[d.tm === 1 ? 1 : 0] + '!'; banT = 1.6; if (v3) V3.sfx('silbido'); else SND(880, 0.2, 'sawtooth', 0.04, -300);
        } else if (ty === 'espanta' && d) {
          var gg = gulls[d.i]; if (gg && !gg.scared) { gg.scared = 1; gg.scaredAt = now; var se = sobreCava(gg.tm, 150); S('¡SHU!', se.x, se.y, '#fffdf2'); if (v3) efShu(gg); else SND(700, 0.1, 'square', 0.05); }
        }
      },
      claimOk: function (id, p, t) {                                                                  // el juez descarta lo que no cumple ventana ni equipo
        var m = /^g(\d+)_(\d+)$/.exec(String(id)), gg = m ? gulls[+m[1]] : null;
        if (!gg || gg.scared || +m[2] !== p || tmOf[p] !== gg.tm || TM[gg.tm].rc !== p) return false;
        return t >= (gg.tl + WIN0) * 1000 - 60 && t <= (gg.tl + WIN1) * 1000 + 60;
      },
      concede: function (id, p) {
        var m = /^g(\d+)_/.exec(String(id)), gg = m ? gulls[+m[1]] : null;
        if (gg && p >= 0 && !gg.scared) {
          gg.scared = 1; gg.scaredAt = c.ahora(); var se = sobreCava(gg.tm, 150);
          S('¡SHU!', se.x, se.y, '#fffdf2'); if (v3) efShu(gg); else SND(700, 0.1, 'square', 0.05);
        }
      },
      alCpu: function (p) { P[p].own = false; var r = c.remoto(p); if (r) { if (TM[P[p].tm].th === p) { P[p].ang = cl(r.a / 100, AMIN, AMAX); P[p].pw = cl(r.f / 100, 0, 1); } else P[p].x = r.x; } },
      alHum: function (p, o) {
        P[p].own = false;
        if (o) {
          if (TM[P[p].tm].th === p) { P[p].ang = cl(o.a / 100, AMIN, AMAX); P[p].pw = cl(o.f / 100, 0, 1); }
          else { P[p].x = o.x; if (o.z >= P[p].z) { P[p].v = o.v; P[p].z = o.z; } }
        }
      },
      alRemoto: function (p, o) { if (o && TM[P[p].tm].rc === p && TM[P[p].tm].th !== p && o.z > P[p].z) { P[p].v = o.v; P[p].z = o.z; } },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) { var V = Vtm(P[p].tm), mitad = Math.floor(V / 2); out.push(TM[P[p].tm].th === p && TM[P[p].tm].rc !== p ? mitad : TM[P[p].tm].th === p ? V : V - mitad); }
        return out;
      },
      vuelo: function (tm, a, f, t0) { var F = vuelo(tm, a, f, t0 || 0); return { T: F.T, lx: F.lx }; },      // para pruebas y banco: caída exacta de un tiro
      done: function () { return false; },
      vivo: function () { return true; },
      hudChip: function (p) { return TM[P[p].tm].th === p ? 'TIRA' : 'ATRAPA'; },
      destacado: function () {
        var tm = c.yo >= 0 ? tmOf[c.yo] : 0;
        return 'cargaron ' + Vtm(tm) + (Vtm(tm) === 1 ? ' cosa' : ' cosas');
      },
      vista: function () {
        var now = c.ahora();
        return { gt: now, lv: lv, V: [Vtm(0), Vtm(1)], tm: tmOf.slice(), th: [TM[0].th, TM[1].th], rc: [TM[0].rc, TM[1].rc], x: P.map(function (q) { return q.x; }), z: P.map(function (q) { return q.z; }),
          v: P.map(function (q) { return q.v; }), ang: P.map(function (q) { return q.ang; }), pw: P.map(function (q) { return q.pw; }), n: P.map(function (q) { return q.n; }),
          vuelos: fls.length, lanzados: fls.map(function (f) { return [f.tm, f.ty, +f.lx.toFixed(1), f.res]; }), gulls: gulls.filter(Boolean).map(function (q) { return [q.i, q.tm, +q.tl.toFixed(2), q.scared, q.applied]; }),
          gt0: GT.slice(), seq: seq.slice(0, 12), sand: sand.slice(), wind: windAt(now), gusts: gust.length, CW: PERILLA.CW };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        dibujo2D();
      }
    };
    return g;
  }
});
})();
