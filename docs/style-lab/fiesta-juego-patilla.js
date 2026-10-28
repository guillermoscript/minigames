'use strict';
/* LA FIESTA · EN VIVO · f_patilla · ¡BOMBAS DESDE EL BALCÓN!  (1v3, modelo B: dueño + juez)   spec: docs/mario-party/M3-TEAMS-SPEC.md §4 · rehecho en 3D: doc 15 §8 #1
   Carnaval en la plaza (la misma de f_bombita). El SOLO, en el balcón de la casa grande, apunta con una mira por la calle y lanza bombas de agua;
   el TRÍO esquiva por la calle (stick) y con A se lanza a un lado (¡ESQUIVA!). Cada bomba deja un CHARCO que resbala unos segundos.
   Nivel 1: una bomba por tiro · 2: una ráfaga de dos · 3: tres en fila. El id sigue siendo f_patilla (catálogo, servidor y red no cambian).

   LA LOCURA (2026-10-27, nota del dueño: «muy difícil que el 1 le gane a los 3; mejor escenario, más locura e interactividad»):
   · ESCALADA por c.ahora()/dur: CALMA (<35 %) → ¡SE PRENDIÓ LA PLAZA! (35-72 %: enfriamiento ×0.82, más globos especiales, chapuzón +10 %) →
     ¡ÚLTIMOS SEGUNDOS! (≥72 %: enfriamiento ×0.64, chapuzón +25 %, casi todo globo especial, LOS VECINOS SE UNEN: la abuela y mamá salen al balcón
     y tiran sus propias bombas, que cuentan para el solo). Cartel, tambor, música más rápida, luces de fiesta y sacudida al cambiar.
   · GLOBOS ESPECIALES (tipo = función pura de (i, tl), los dos primeros siempre normales): GIGANTE (chapuzón ×1.75, vuela un poco más),
     TRIPLE (tres en abanico ancho, en cualquier nivel) y MELAO (charco pegajoso: el que lo pisa va a cámara lenta). El solo ve cuál le toca.
   · MIRA CON IMÁN: con el stick suelto la mira se pega al del trío más cercano (un poco adelantada a su paso).
   · EL TRÍO TIENE A QUÉ IR: en la calle salen un TOBO (con A se lo lanzas al balcón: el solo queda empapado y sin tirar TOBO_S s; ojo, mientras
     lo cargas A no esquiva) y un PARAGUAS (PARA_S s a prueba de bombas). Se toman con ev `toma {k}` (gana el primero que llega a cada pantalla; el
     golpe lo sigue juzgando la víctima con SU paraguas, así el veredicto no depende de la carrera) y el tobo con ev `tobo {k}` (una vez por tobo).
   · EVENTOS EN LA PLAZA (agenda de c.rng en mk, avisados AVISO s antes): LA COMPARSA cruza un carril y arrastra al que agarre; el CAÑONAZO DE
     PAPELILLO tapa las sombras de aviso CIEGO s; el CAMIÓN CISTERNA cruza un carril, aparta y atonta al que toque y deja la franja mojada.

   POR QUÉ B Y NO C (regla del usuario: solos = A, disputados/cooperativos = C, «B permitido como C ligero»): no hay objeto compartido que cambie por la
   interacción de varios. Cada bomba es una función PURA de (tiro, gt); el golpe lo juzga la VÍCTIMA contra su propio cuerpo (con C el juez juzgaría
   con la posición retrasada de cada víctima: «esquivé en mi pantalla y me mojó» a 300 ms). B tampoco gasta el flujo `i`.

   Red. El tiro es DETERMINISTA: el solo manda `xtiro {i, x, y, tl}` (x, y = el blanco en la calle; tl = ms de gt en que SUELTA, WIND s después de
   pulsar A) y todas las pantallas calculan las mismas bombas con gotas(tiro): dónde caen y cuándo. La sombra de aviso sale al pulsar: WIND + FLY ≈ 1 s
   de telegrafía, que cubre la latencia. Cada miembro del trío juzga su PROPIO golpe al caer cada bomba y manda ev `hit {i, pc}` (una vez por tiro y víctima).
   Quién emite el xtiro: el solo humano, o el JUEZ si el solo es una CPU o un humano caído (el juez corre su `ai`). Por eso `xtiro` se acepta de cualquier
   emisor (validado: índice, rango, finitud) y, si dos pantallas sueltan el mismo tiro, GANA EL QUE SALE PRIMERO (menor tl; empate: menor x): todas convergen
   sin coordinarse. El enfriamiento sale de los tiros recibidos (sobrevive a un cambio de juez); un solo CPU recién tomado espera GRACIA_CPU antes de tirar.
   Puntaje (aditivo y comparable, doc 08 §8, M3 DM3-3; el servidor lo fija): solo = 10 por golpe; cada miembro del trío = 25 fijo => el solo gana con >=3
   golpes. El veredicto lo da SOLO compara(): este archivo no decide al ganador.
   Perilla de balance (PERILLA): SPL (radio del chapuzón) × RK por nivel; FLY (s de vuelo por nivel); CD (enfriamiento); N (bombas, la que más mueve). Medido en el banco
   (docs/style-lab/pruebas/fiesta-patilla-bench.js, 4 CPU skill .6, 200 semillas, el veredicto sale de compara). Nunca se toca el modelo de la CPU una vez
   medido (error, reacción, lapsos): eso DEFINE «igual habilidad».
   Calle lógica 440×300 idéntica en todas las pantallas (la física no depende del dispositivo). Dibujo: 3D low poly (fiesta-3d.js) o, sin WebGL / ?plano=1, el 2D.
   Cuerpo en red (o): x, y (el trío: su posición; el solo: su mira), j (esquivando), st (aturdido / el solo: en amago). Sin Math.random / Date.now:
   azar de c.rngFor('cpu'+p); lo cosmético de c.fx(). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_patilla')) return;

/* ───── la perilla (única) y las constantes del juego ───── */
var PERILLA = { SPL: 26, RK: [0.97, 0.83, 0.8], FLY: [0.85, 0.95, 1.0], CD: 2.6, N: 16, ESP: [0.12, 0.42, 0.75], VEC: 1, IMAN: 1 };   // banco: ver fiesta-patilla-bench.js
var FASES = [0.35, 0.72], CDF = [1, 0.82, 0.64], SPLF = [1, 1.1, 1.25];
var GIG = 1.75, GIG_FLY = 0.15, TRI_OFF = 1.25, MEL_PR = 1.7, MEL_LENTO = 0.42, VFLY = 1.0, IMAN_R = 62, IMAN_LEAD = 0.35;
var AVISO = 1.0, COMP_L = 96, COMP_V = 125, COMP_H = 26, CIS_L = 78, CIS_W = 24, CIS_V = 165, CIEGO = 2.4;
var ITEM_VIDA = 6.5, ITEM_R = 20, PARA_S = 5, TOBO_S = 2.4, TOBO_VUELO = 0.5;
var AY_R = 30, AY_VIDA = 5.2, AY_CD = 0.45, PEG_R = 38, PEG_VIDA = 7;
var TXT_AY = { t: '¡ABANICO!', g: '¡GLOBAZO!', r: '¡RECARGA!' }, COL_AY = { t: '#ff5c8a', g: '#ff8a3f', r: '#5cff7a' };
var TXT_EV = { comparsa: '¡AHÍ VIENE LA COMPARSA!', papelillo: '¡CAÑONAZO DE PAPELILLO!', cisterna: '¡CAMIÓN CISTERNA! ¡QUÍTATE!' };
var TXT_TIPO = { g: '¡GLOBO GIGANTE!', t: '¡TRIPLE!', m: '¡BOMBA DE MELAO!' };
var SW = 440, SH = 300, Y_MIN = 70, Y_MAX = 286, BAL_Y = -40, WIND = 0.3, STAG = 0.16, OFF = 58, PUD = 7, BODY = 13;
var SPD = 175, SPD_STG = 85, SOLO_SPD = 330, DASH = 0.22, DK = 2.5, DCD = 1.3, SLIP = 2.2, STG = 1.0;
var HITS_GANA = 3, MARGEN_FIN = 1.0, CELEBRA = 0.9, GRACIA_CPU = 1.3, PTS_GOLPE = 10, PTS_TRIO = 25, ERR0 = 46, ERR1 = 34;
var INK = '#14101c';
var PAL = {
  1: { cielo: '#8fd8ff', cielo2: '#d9f3ff', calle: '#d9c9a8', junta: '#c9b48c', casa: '#ffd23f', luz: 0 },
  2: { cielo: '#ff8f5a', cielo2: '#ffd08a', calle: '#cdb08c', junta: '#b99870', casa: '#ffb36b', luz: 0 },
  3: { cielo: '#1d1a4a', cielo2: '#3a3478', calle: '#5a5066', junta: '#4c4358', casa: '#a9a0ff', luz: 1 }
};
var GRITOS = ['¡SPLASH!', '¡ME EMPAPÓ!', '¡AY, QUÉ FRÍA!', '¡MOJADO!'];
var CONF = ['#ff5c8a', '#ffd23f', '#3fd0a0', '#3fa9ff', '#ff8a3f'];
var GLOBOS = ['#3fa9ff', '#ff5c8a', '#ffd23f', '#5cff7a'];
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }

FIESTA.LIVE.add('f_patilla', {
  name: '¡BOMBAS DESDE EL BALCÓN!', modos: ['1v3'], clase: 'binary', modelo: 'B', dur: 35,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 90, scoreRate: 12, minT: 6, finTemprano: 1 },
  cuerpo: ['x', 'y', 'j', 'st'], discretos: ['j', 'st'],
  perilla: PERILLA,
  carta: {
    obj: 'El solo: moja al trío desde el balcón. El trío: ¡esquiva las bombas de agua!',
    gana: 'El solo gana si moja 3 veces (repetidos cuentan). Si no, gana el trío.',
    como: { tactil: 'Joystick · A = lanzar (solo) / esquivar (trío)', teclado: 'WASD o flechas · ESPACIO' },
    roles: {
      solo: {
        obj: '¡TÚ CONTRA TODOS! Apunta con la mira y lanza bombas de agua desde el balcón.',
        como: { tactil: 'Joystick: mover la mira · A: lanzar', teclado: 'WASD o flechas: la mira · ESPACIO: lanzar' },
        demos: [{ id: 'mover', txt: 'Suelta el stick cerca de alguien: la mira se le pega. Tarda un segundo en caer' }, { id: 'robar', txt: 'Al final vienen globos GIGANTES, TRIPLES y de MELAO, ¡y los vecinos te ayudan!' }]
      },
      trio: {
        obj: 'Esquiva las bombas de agua. Agarra el TOBO (A: ¡se lo lanzas al balcón!) o el PARAGUAS.',
        como: { tactil: 'Joystick: moverte · A: esquivar / lanzar el tobo', teclado: 'WASD o flechas · ESPACIO: esquivar / lanzar el tobo' },
        demos: [{ id: 'mover', txt: 'El círculo rojo marca dónde cae la bomba: sal de ahí' }, { id: 'saltar', txt: 'Ojo con la comparsa y el camión cisterna: ¡te arrastran!' }]
      }
    },
    demos: [
      { id: 'mover', txt: 'El círculo rojo marca dónde cae la bomba: sal de ahí' },
      { id: 'saltar', txt: 'A: te lanzas a un lado para salir a tiempo' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv];
    var soloI = c.solo >= 0 && c.solo < n ? c.solo : 0, SPL = PERILLA.SPL * PERILLA.RK[lv - 1], FLY = PERILLA.FLY[lv - 1], RH = SPL + BODY, PR = SPL * 1.15;
    var lead = Math.min(2.5, 0.12 * dur), cd = PERILLA.CD * CDF[2], R = c.rng, k0;
    function fase(t) { return t < FASES[0] * dur ? 0 : t < FASES[1] * dur ? 1 : 2; }
    function cdAt(tl) { return PERILLA.CD * CDF[fase(tl - WIND)]; }
    function cdS(s) { return cdAt(s.tl) * (s.ay === 'r' ? AY_CD : 1); }                 /* RECARGA: el siguiente tiro llega casi al instante */             /* el enfriamiento depende de la fase en que se PULSÓ el tiro */
    var nShots = 0, tp0 = lead;                                                   /* cuántos tiros caben tirando apenas se puede */
    while (nShots < PERILLA.N && tp0 + WIND + FLY + GIG_FLY + 0.4 <= dur) { nShots++; tp0 = tp0 + WIND + cdAt(tp0 + WIND); }
    nShots = Math.max(1, nShots);
    /* ───── agenda determinista (c.rng, mismo orden en todas las pantallas): tipo de cada tiro, vecinos, eventos de la plaza, tobos y paraguas ───── */
    var rTipo = [];
    for (k0 = 0; k0 < PERILLA.N; k0++) rTipo.push([R.next(), R.next()]);
    var ayu = [], pegs = [];                                                      /* AYUDAS DEL SOLO: pastillas en la calle (apunta encima al tirar) y charcos pegajosos fijos que frenan al trío */
    (function () {
      var t = 0.1 * dur + R.next() * 0.8, kk = Math.floor(R.next() * 3), ph;
      while (t < dur - 2.5 && ayu.length < 14) {
        ayu.push({ k: ayu.length, t0: t, t1: t + AY_VIDA, tipo: ['t', 'g', 'r'][(kk + ayu.length) % 3], x: 60 + R.next() * (SW - 120), y: Y_MIN + 40 + R.next() * (Y_MAX - Y_MIN - 80) });
        ph = fase(t); t += (ph === 0 ? 5.0 : ph === 1 ? 4.0 : 3.2) + R.next() * 1.0;
      }
      t = 0.28 * dur + R.next();
      while (t < dur - 3 && pegs.length < 8) {
        pegs.push({ k: pegs.length, t0: t, t1: t + PEG_VIDA, x: 50 + R.next() * (SW - 100), y: Y_MIN + 25 + R.next() * (Y_MAX - Y_MIN - 50) });
        t += (fase(t) === 2 ? 3.0 : 4.6) + R.next() * 1.2;
      }
    })();
    function ayudaEn(x, y, tl) {
      for (var j = 0; j < ayu.length; j++) { var A = ayu[j]; if (tl >= A.t0 && tl < A.t1) { var dx = x - A.x, dy = (y - A.y) * 1.15; if (dx * dx + dy * dy < AY_R * AY_R) return A; } }
      return null;
    }
    function tipoDe(i, tl, x, y) {
      var A = x === undefined ? null : ayudaEn(x, y, tl);
      if (A) return A.tipo === 'r' ? 'm' : A.tipo;
      if (i < 2 || i >= rTipo.length) return 'n';
      var r = rTipo[i], ph = fase(tl - WIND);
      if (r[0] >= PERILLA.ESP[ph]) return 'n';
      return r[1] < 0.36 ? 'g' : r[1] < 0.7 ? 't' : 'm';
    }
    var vec = [];                                                                 /* las bombas de los vecinos (fase final): índices nShots + v */
    (function () {
      var t = FASES[1] * dur + 0.8, v = 0, rr2 = SPL0() * SPLF[2];
      while (t + VFLY + 0.4 < dur && v < 12) {
        var lado = R.next() < 0.5 ? -1 : 1, x, y, hx = R.next(), hy = R.next(), cual = R.next();
        if (cual < 0.55) { x = SW * (0.2 + 0.6 * (Math.floor(hx * 3) + 1) / 4) + (hy - 0.5) * 90; y = 205 + (hx * 7 % 1 - 0.5) * 120; }   /* donde suele estar la gente */
        else { x = 40 + hx * (SW - 80); y = Y_MIN + 10 + hy * (Y_MAX - Y_MIN - 20); }
        x = cl(x, 20, SW - 20); y = cl(y, Y_MIN, Y_MAX);
        var s = { i: nShots + v, x: x, y: y, tl: t, t: 'v', lado: lado };
        s.g = [{ i: s.i, id: 0, x: x, y: y, tr: t, tL: t + VFLY, fly: VFLY, rh: rr2 + BODY, pr: rr2 * 1.15, k: 'v', lado: lado }];
        vec.push(s); v++;
        t += (1.5 + R.next() * 1.1) / PERILLA.VEC;
      }
    })();
    function SPL0() { return PERILLA.SPL * PERILLA.RK[lv - 1]; }
    var evs = [];                                                                 /* eventos de la plaza */
    (function () {
      var t = 0.2 * dur + R.next() * 1.2, ult = {}, kinds = ['comparsa', 'papelillo', 'cisterna'], prev = '', j;
      while (t < dur - 2.4 && evs.length < 12) {
        var ph = fase(t), kk = kinds[Math.floor(R.next() * 3) % 3];
        if (kk === prev) kk = kinds[(kinds.indexOf(kk) + 1) % 3];
        if (ult[kk] && t < ult[kk]) { for (j = 0; j < 3; j++) if (kinds[j] !== prev && (!ult[kinds[j]] || t >= ult[kinds[j]])) { kk = kinds[j]; break; } if (j === 3) { t += 0.8; continue; } }
        var e = { n: evs.length, k: kk, t0: t, tA: t + AVISO, dir: R.next() < 0.5 ? -1 : 1, y: 0, L: 0, v: 1, fin: 0 }, ry = R.next();
        if (kk === 'comparsa') { e.y = 110 + ry * 140; e.L = COMP_L; e.v = COMP_V; e.fin = e.tA + (SW + e.L + 40) / e.v; }
        else if (kk === 'cisterna') { e.y = 105 + ry * 145; e.L = CIS_L; e.v = CIS_V; e.fin = e.tA + (SW + e.L + 40) / e.v; }
        else e.fin = e.tA + CIEGO;
        ult[kk] = e.fin + 0.4; evs.push(e); prev = kk;
        t += (ph === 0 ? 5.2 : ph === 1 ? 3.8 : 2.8) + R.next() * 1.6;
      }
    })();
    var items = [];                                                               /* tobos y paraguas que salen en la calle */
    (function () {
      var t = 0.16 * dur + R.next(), alt = R.next() < 0.5 ? 0 : 1;
      while (t < dur - 3 && items.length < 9) {
        items.push({ k: items.length, t0: t, t1: t + ITEM_VIDA, tipo: (items.length + alt) % 2 ? 'para' : 'tobo', x: 50 + R.next() * (SW - 100), y: Y_MIN + 30 + R.next() * (Y_MAX - Y_MIN - 50), por: -1, usado: 0, tt: -9 });
        t += 4.2 + R.next() * 2.2;
      }
    })();
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };
    var trio = [], slot = [], P = [], i;
    for (i = 0; i < n; i++) { if (i === soloI) slot.push(-1); else { slot.push(trio.length); trio.push(i); } }
    var nt = Math.max(1, trio.length);
    var homeX = function (p) { return SW * (0.2 + 0.6 * ((slot[p] + 1) / (nt + 1))); };              // el sitio cómodo de cada miembro del trío, por posición dentro del trío
    for (i = 0; i < n; i++) P.push({ x: i === soloI ? SW / 2 : homeX(i), y: i === soloI ? 170 : 205, vx: 0, vy: 0, dx: 0, dy: 1, tj: -9, stg: -9, hitN: 0, nextShot: lead, grace: -1, mvx: 0, mvy: 0, px: 0, py: 0, tobo: -1, para: -9, moj: -9, pide: {}, choc: -9 });
    var shots = [], hitSet = {}, jz = {}, hitsN = 0, hit3At = -1, absT = 0, flash = 0, shake = 0, voz = {}, cacheT = null, faseV = 0, lanzados = [];
    var cpuR = [], plan = [], mios = [], RESEND = [1.2, 2.6, 4.5, 7];   /* mis tiros salidos: se reenvían unas veces (si estuve sin red, los demás aún los reciben; gana el menor tl) */
    for (i = 0; i < n; i++) { cpuR.push(c.rngFor('cpu' + i)); plan.push({ tgt: null, re: -9, dir: 0, dash: 0, errI: -2, ex: 0, ey: 0 }); }
    var isSolo = function (p) { return p === soloI; };
    /* campo visible: el ancho real de la pantalla (vertical ~340, apaisado ~1300 unidades); c.campo() hoy devuelve siempre 0..800 en el navegador */
    var cp = function () {
      var f = c.campo();
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 };
      return f;
    };
    function geom() { var f = cp(), w = f.x1 - f.x0, cx = (f.x0 + f.x1) / 2; return { ox: cx - SW / 2, oy: 180, cx: cx, k: Math.min(1, Math.max(0.45, (w - 8) / (SW + 32))), w: w }; }
    function scr(G, x, y) { return { x: G.cx + (G.ox + x - G.cx) * G.k, y: 120 + (G.oy + y - 120) * G.k }; }

    /* ───── las bombas: función pura del tiro ───── */
    function gotas(s) {                                    /* cada bomba: dónde cae (x, y), cuándo sale (tr), cuándo cae (tL), su radio (rh) y su charco (pr) */
      var out = [], tp = s.t || 'n', spl = SPL * SPLF[fase(s.tl - WIND)], a = s.i * 1.7 + 0.6, k, ox, oy;
      var nb = tp === 't' ? 3 : tp === 'g' ? 1 : lv, off = tp === 't' ? OFF * TRI_OFF : OFF, fly = FLY + (tp === 'g' ? GIG_FLY : 0), r = tp === 'g' ? spl * GIG : spl;
      for (k = 0; k < nb; k++) {
        ox = k === 1 ? Math.cos(a) * off : k === 2 ? -Math.cos(a) * off : 0;
        oy = k === 1 ? Math.sin(a) * off * 0.7 : k === 2 ? -Math.sin(a) * off * 0.7 : 0;
        out.push({ i: s.i, id: k, x: cl(s.x + ox, 16, SW - 16), y: cl(s.y + oy, Y_MIN - 8, Y_MAX + 6), tr: s.tl + k * STAG, tL: s.tl + k * STAG + fly, fly: fly, rh: r + BODY, pr: tp === 'm' ? r * MEL_PR : r * 1.15, k: tp, lado: 0 });
      }
      return out;
    }
    function todas() {
      if (cacheT) return cacheT;
      var o = [], j, k; for (j = 0; j < shots.length; j++) if (shots[j]) for (k = 0; k < shots[j].g.length; k++) o.push(shots[j].g[k]);
      for (j = 0; j < vec.length; j++) o.push(vec[j].g[0]);
      cacheT = o; return o;
    }
    function activos(t) { var o = [], a = todas(), k; for (k = 0; k < a.length; k++) if (t >= a[k].tr - WIND && t < a[k].tL) o.push(a[k]); return o; }   /* en el aire (o en la mano) */
    /* los eventos de la plaza: dónde va la comparsa / el camión (función pura de t) */
    function evX(e, t) { var u = (t - e.tA) * e.v; return e.dir > 0 ? -e.L / 2 - 20 + u : SW + e.L / 2 + 20 - u; }
    function enCarril(kind, hh, x, y, t) {
      for (var j = 0; j < evs.length; j++) { var e = evs[j]; if (e.k !== kind || t < e.tA || t >= e.fin) continue; if (Math.abs(y - e.y) < hh && Math.abs(x - evX(e, t)) < e.L / 2 + BODY * 0.5) return e; }
      return null;
    }
    function franjaMojada(x, y, t) {                       /* lo que ya mojó el camión */
      for (var j = 0; j < evs.length; j++) {
        var e = evs[j]; if (e.k !== 'cisterna' || t < e.tA || t >= e.fin + PUD || Math.abs(y - e.y) > CIS_W + 4) continue;
        var cx = evX(e, Math.min(t, e.fin)); if (e.dir > 0 ? x < cx - e.L / 2 : x > cx + e.L / 2) return true;
      }
      return false;
    }
    function ciego(t) { for (var j = 0; j < evs.length; j++) if (evs[j].k === 'papelillo' && t >= evs[j].tA && t < evs[j].fin) return evs[j]; return null; }
    function zona(x, y, t) { for (var j = 0; j < evs.length; j++) { var e = evs[j]; if (e.k === 'papelillo' || t < e.t0 || t >= e.fin) continue; if (Math.abs(y - e.y) < (e.k === 'comparsa' ? COMP_H : CIS_W) + 20) return true; } return false; }
    function charco(x, y, t) {                             /* ¿(x, y) pisa un charco ahora? 0 seco · 1 resbala · 2 melao (pega) */
      var a = todas(), k, r = 0;
      for (k = 0; k < a.length; k++) { var u = t - a[k].tL; if (u < 0 || u > PUD) continue; var dx = x - a[k].x, dy = (y - a[k].y) * 1.15; if (dx * dx + dy * dy < a[k].pr * a[k].pr) { if (a[k].k === 'm') return 2; r = 1; } }
      for (k = 0; k < pegs.length; k++) { var Q = pegs[k]; if (t >= Q.t0 && t < Q.t1) { var qx = x - Q.x, qy = (y - Q.y) * 1.15; if (qx * qx + qy * qy < PEG_R * PEG_R) return 2; } }
      if (!r && franjaMojada(x, y, t)) r = 1;
      return r;
    }
    function itemVivo(it, t) { return it.por < 0 && t >= it.t0 && t < it.t1; }
    function ultimaCae() { var m = -1, a = todas(), k; for (k = 0; k < a.length; k++) if (a[k].tL > m) m = a[k].tL; return m; }
    function siguiente() { var m = -1, j; for (j = 0; j < shots.length; j++) if (shots[j]) m = j; return m + 1; }
    function nThrown() { var k = 0, j; for (j = 0; j < shots.length; j++) if (shots[j]) k++; return k; }
    function sincroniza() {
      var j, t = P[soloI].nextShot;
      for (j = 0; j < shots.length; j++) if (shots[j] && shots[j].tl + cdS(shots[j]) > t) t = shots[j].tl + cdS(shots[j]);
      P[soloI].nextShot = t;
    }
    function banner(s, col, y) { var G = geom(), sg = scr(G, SW / 2, y || 95); S(s, sg.x, sg.y, col || '#ffd23f'); }
    function sfx(k3, f, d, ty, v) { if (v3) V3.sfx(k3); else SND(f, d, ty, v); }
    function addShot(d) {                                  // valida, aplica «gana el que sale primero» y devuelve true si cambió algo
      if (!d || typeof d !== 'object' || !num(d.i) || !num(d.x) || !num(d.y) || !num(d.tl)) return false;
      if (d.i % 1 !== 0 || d.i < 0 || d.i >= nShots) return false;
      var s = { i: d.i, x: cl(d.x, 16, SW - 16), y: cl(d.y, Y_MIN - 8, Y_MAX + 6), tl: d.tl / 1000 }, old = shots[d.i];
      if (old && (old.tl < s.tl || (old.tl === s.tl && old.x <= s.x))) return false;
      var ayA = ayudaEn(s.x, s.y, s.tl); s.ay = ayA ? ayA.tipo : null; s.t = tipoDe(s.i, s.tl, s.x, s.y); s.g = gotas(s); shots[d.i] = s; cacheT = null; sincroniza();
      if (!old && s.tl - c.ahora() > -0.3) {
        if (!v3) SND(880, 0.5, 'sine', 0.04, -500);                                   /* el silbido de la bomba que cae (en 3D: V3.sfx) */
        if (s.ay && !old) banner(TXT_AY[s.ay], COL_AY[s.ay], 100);
        if (TXT_TIPO[s.t]) { banner(TXT_TIPO[s.t], s.t === 'g' ? '#ff8a3f' : s.t === 'm' ? '#e0a040' : '#ff5c8a', 120); sfx('tambor', 220, 0.2, 'square', 0.05); }
      }
      return true;
    }
    c.on('xtiro', function (d) { addShot(d); });
    function amago(t) { var j, b = null; for (j = 0; j < shots.length; j++) if (shots[j] && shots[j].tl - t > -0.25 && shots[j].tl - t <= WIND + 0.02) b = shots[j]; return b; }
    function tirar(p, x, y) {
      var now = c.ahora(), idx = siguiente();
      if (idx >= nShots || now < P[p].nextShot || now < 0 || amago(now)) return false;
      var d = { i: idx, x: Math.round(x), y: Math.round(y), tl: Math.round((now + WIND) * 1000) };
      if (!addShot(d)) return false;
      c.send('xtiro', d, false); mios.push({ d: d, t: now, r: 0 });
      return true;
    }

    /* ───── juicio: cada dueño juzga SU cuerpo, una vez por bomba, al caer ───── */
    function esquiva(p, t) { return t - P[p].tj < DASH; }
    function juzga(p, now) {
      var a = todas(), k, q = P[p];
      for (k = 0; k < a.length; k++) {
        var o = a[k], key = o.i * 100 + o.id * 10 + p;
        if (now < o.tL || jz[key]) continue;
        jz[key] = 1;
        if (now - o.tL > 0.25) continue;                   // el tiro llegó tarde (ya había caído): no se juzga a ciegas
        if (now < q.para) continue;                        // con paraguas no moja (lo sabe el dueño: él juzga su golpe)
        var dx = q.x - o.x, dy = (q.y - o.y) * 1.15;
        if (Math.sqrt(dx * dx + dy * dy) < o.rh && !hitSet[o.i * 10 + p]) c.ev('hit', { i: o.i, pc: o.id }, p);   // eco local inmediato, onEv registra
      }
    }

    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        var r = c.remoto(p);
        if (r) { q.x = r.x; q.y = r.y; q.remJ = r.j; q.remSt = r.st; }
        return;
      }
      var e = c.eje(p), taps = c.tap(p, 'a'), el = Math.sqrt(e.x * e.x + e.y * e.y), ex = el > 1 ? e.x / el : e.x, ey = el > 1 ? e.y / el : e.y;
      if (isSolo(p)) {                                     // la mira (el personaje camina por el balcón detrás de ella)
        var ms = now < q.moj ? 0.45 : 1;                   // empapado por un tobo: la mira va lenta
        q.x = cl(q.x + ex * SOLO_SPD * ms * dt, 20, SW - 20); q.y = cl(q.y + ey * SOLO_SPD * 0.8 * ms * dt, Y_MIN, Y_MAX);
        if (el < 0.3 && now >= 0 && now >= q.moj && PERILLA.IMAN > 0) {   /* la mira con imán: con el stick suelto se pega al más cercano, adelantada a su paso */
          var bi = -1, bd2 = IMAN_R * IMAN_R, tx2 = 0, ty2 = 0, a2;
          for (a2 = 0; a2 < trio.length; a2++) {
            var tq2 = P[trio[a2]], px2 = tq2.x + tq2.mvx * IMAN_LEAD, py2 = tq2.y + tq2.mvy * IMAN_LEAD, d2 = (px2 - q.x) * (px2 - q.x) + (py2 - q.y) * (py2 - q.y);
            if (d2 < bd2) { bd2 = d2; bi = a2; tx2 = px2; ty2 = py2; }
          }
          if (bi < 0) for (a2 = 0; a2 < ayu.length; a2++) { var A2 = ayu[a2]; if (now >= A2.t0 && now < A2.t1) { var d3 = (A2.x - q.x) * (A2.x - q.x) + (A2.y - q.y) * (A2.y - q.y); if (d3 < bd2) { bd2 = d3; bi = 0; tx2 = A2.x; ty2 = A2.y; } } }
          if (bi >= 0) { var kk2 = Math.min(1, 4 * dt) * PERILLA.IMAN; q.x = cl(q.x + (tx2 - q.x) * kk2, 20, SW - 20); q.y = cl(q.y + (ty2 - q.y) * kk2, Y_MIN, Y_MAX); }
        }
        if (taps > 0 && now >= 0) tirar(p, q.x, q.y);
        return;
      }
      if (now < 0) return;
      if (el > 0.2) { q.dx = ex / Math.max(el, 1e-3) * Math.min(1, el); q.dy = ey / Math.max(el, 1e-3) * Math.min(1, el); var dn = Math.sqrt(q.dx * q.dx + q.dy * q.dy); q.dx /= dn; q.dy /= dn; }
      if (taps > 0 && q.tobo >= 0) { c.ev('tobo', { k: q.tobo }, p); taps = 0; }      // con el tobo en la mano, A lo lanza al balcón (y no esquiva)
      if (taps > 0 && now >= q.tj + DCD) { q.tj = now; q.ddx = q.dx; q.ddy = q.dy; if (p === c.yo && !v3) SND(520, 0.12, 'square', 0.05); }
      var ch = charco(q.x, q.y, now), com = enCarril('comparsa', COMP_H, q.x, q.y, now), cis = enCarril('cisterna', CIS_W, q.x, q.y, now);
      var sp = (now < q.stg ? SPD_STG : SPD) * (ch === 2 ? MEL_LENTO : 1) * (com ? 0.65 : 1);
      if (cis) {                                           // el camión te aparta del carril y te deja atontado (no cuenta como golpe)
        q.y = cl(cis.y + (q.y >= cis.y ? 1 : -1) * (CIS_W + BODY + 6), Y_MIN, Y_MAX); q.vx = cis.dir * 140; q.vy = 0; q.stg = Math.max(q.stg, now + 0.7); q.choc = now;
        if (p === c.yo) { banner('¡TE SALPICÓ EL CAMIÓN!', '#8fd8ff', 150); shake = 0.5; }
      }
      if (esquiva(p, now)) { q.vx = q.ddx * SPD * DK; q.vy = q.ddy * SPD * DK; }
      else {
        var mojado = ch === 1, k = mojado ? SLIP : 16, cap = mojado ? sp * 1.25 : sp;
        q.vx += (ex * sp - q.vx) * Math.min(1, k * dt); q.vy += (ey * sp - q.vy) * Math.min(1, k * dt);
        if (com) q.vx += (com.dir * COMP_V * 0.95 - q.vx) * Math.min(1, 7 * dt);   // la comparsa te arrastra con ella
        var vl = Math.sqrt(q.vx * q.vx + q.vy * q.vy); if (vl > cap && !com) { q.vx *= cap / vl; q.vy *= cap / vl; }
        q.resb = mojado && vl > 40; q.baila = !!com;
      }
      var nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
      if (nx < 18 || nx > SW - 18) q.vx = 0; if (ny < Y_MIN || ny > Y_MAX) q.vy = 0;
      q.x = cl(nx, 18, SW - 18); q.y = cl(ny, Y_MIN, Y_MAX);
      if (q.tobo < 0) for (var it2 = 0; it2 < items.length; it2++) {              // recoger: el dueño ve el roce con SU cuerpo y lo anuncia
        var I = items[it2]; if (!itemVivo(I, now) || q.pide[it2]) continue;
        var ddx = q.x - I.x, ddy = (q.y - I.y) * 1.15;
        if (ddx * ddx + ddy * ddy < (ITEM_R + BODY) * (ITEM_R + BODY)) { q.pide[it2] = 1; c.ev('toma', { k: it2 }, p); break; }
      }
      juzga(p, now);
    }

    /* ───── IA ───── */
    var DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];
    function gauss(R2) { return (R2.next() + R2.next() + R2.next() - 1.5) * 2; }
    function aiSolo(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], a, b;
      if (now < 0) { api.eje(0, 0); return; }
      if (!pl.tgt || now > pl.re) {                        // el racimo más denso del trío (cada cuerpo y el punto medio de cada pareja), con el error de su habilidad
        var best = null, bs = -1, cand = [], pos = [], reach = RH - 6, adel = (WIND + FLY) * 0.55 * sk;
        for (a = 0; a < trio.length; a++) { var tq = P[trio[a]]; pos.push({ x: tq.x + tq.mvx * adel, y: tq.y + tq.mvy * adel }); }
        for (a = 0; a < pos.length; a++) { cand.push(pos[a]); for (b = a + 1; b < pos.length; b++) cand.push({ x: (pos[a].x + pos[b].x) / 2, y: (pos[a].y + pos[b].y) / 2 }); }
        for (a = 0; a < cand.length; a++) {
          var sc = 0;
          for (b = 0; b < pos.length; b++) { var ddx = cand[a].x - pos[b].x, ddy = (cand[a].y - pos[b].y) * 1.15; sc += cl((reach + 6 - Math.sqrt(ddx * ddx + ddy * ddy)) / 14, 0, 1); }
          sc += R2.next() * 0.9;
          if (sc > bs) { bs = sc; best = cand[a]; }
        }
        var sg = 58 - 44 * sk;
        pl.tgt = best ? { x: cl(best.x + gauss(R2) * sg, 20, SW - 20), y: cl(best.y + gauss(R2) * sg * 0.7, Y_MIN, Y_MAX) } : { x: SW / 2, y: 200 };
        pl.re = now + 0.35 + R2.next() * 0.5;
      }
      var dx = pl.tgt.x - q.x, dy = pl.tgt.y - q.y;
      api.eje(cl(dx / 26, -1, 1), cl(dy / 21, -1, 1));
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && !amago(now) && siguiente() < nShots && now >= q.nextShot && now >= q.grace) { if (tirar(p, q.x, q.y)) pl.tgt = null; }
    }
    function aiTrio(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], rt = 0.4 - 0.22 * sk, j, d;
      if (now < 0) return;
      var ns = siguiente() - 1;
      if (pl.errI !== ns) { pl.errI = ns; var em = ERR0 - ERR1 * sk; pl.ex = gauss(R2) * em; pl.ey = gauss(R2) * em * 0.7; }   // cuánto se equivoca ESTA CPU sobre dónde cae la ráfaga
      var amz = [], a = todas(), rtv = rt + (ciego(now) ? 0.4 : 0);              // con el papelillo no se ven las sombras: reacciona tarde
      for (j = 0; j < a.length; j++) { var o = a[j], vis = now >= o.tr - o.id * STAG - WIND + rtv; if (vis && o.tL >= now - 0.02 && o.tL <= now + 1.6 && o.tL >= q.para) amz.push(o); }   // con paraguas solo cuentan las que caen después
      if (q.tobo >= 0 && !amz.length && now >= (pl.toboT || 0)) { pl.toboT = now + 0.25; if (R2.next() < 0.35 + 0.5 * sk) { api.press('a'); return; } }   // tobo en mano y nada encima: ¡al balcón!
      if (now < pl.re && pl.dir >= 0) { var dd = DIRS[pl.dir]; api.eje(dd[0], dd[1]); return; }   // mantener la decisión un rato
      pl.re = now + 0.12;
      if (!amz.length) {                                   // nada que esquivar: a buscar un tobo o un paraguas cerca, o al punto cómodo (fuera de los carriles del evento)
        var hx = homeX(p) + Math.sin(absT * 0.7 + p) * 30, hy = 200 + Math.cos(absT * 0.5 + p) * 30, bi = 170 * (0.5 + sk);
        if (q.tobo < 0) for (j = 0; j < items.length; j++) { var I = items[j]; if (!itemVivo(I, now) || zona(I.x, I.y, now)) continue; var di = Math.abs(I.x - q.x) + Math.abs(I.y - q.y); if (di < bi) { bi = di; hx = I.x; hy = I.y; } }
        if (zona(hx, hy, now)) { for (j = 0; j < evs.length; j++) if (evs[j].k !== 'papelillo' && now >= evs[j].t0 && now < evs[j].fin) hy = evs[j].y > 180 ? evs[j].y - 75 : evs[j].y + 75; hy = cl(hy, Y_MIN + 6, Y_MAX - 6); }
        var ex = hx - q.x, ey = hy - q.y;
        api.eje(Math.abs(ex) > 8 ? (ex > 0 ? 1 : -1) : 0, Math.abs(ey) > 8 ? (ey > 0 ? 1 : -1) : 0); pl.dir = -1; return;
      }
      if (R2.next() < 0.03 * (1 - sk)) { api.eje(0, 0); pl.dir = 0; pl.re = now + 0.2; return; }   // un descuido
      var puede = now >= q.tj + DCD, bd = 0, bsc = -1e9, bdash = 0, k2, dash;
      for (dash = 0; dash <= (puede ? 1 : 0); dash++) {
        for (d = 0; d < DIRS.length; d++) {
          if (dash && d === 0) continue;
          var hits = 0, hora = 9;
          for (k2 = 0; k2 < amz.length; k2++) {
            var o2 = amz[k2], tt = cl(o2.tL - now, 0, 1.0), dist = dash ? Math.min(tt, DASH) * SPD * DK + Math.max(0, tt - DASH) * SPD : tt * SPD * 0.92;
            var fx = cl(q.x + DIRS[d][0] * dist, 18, SW - 18), fy = cl(q.y + DIRS[d][1] * dist, Y_MIN, Y_MAX), gx = fx - o2.x - pl.ex, gy = (fy - o2.y - pl.ey) * 1.15;
            if (Math.sqrt(gx * gx + gy * gy) < o2.rh + 6) { hits++; hora = Math.min(hora, tt); }
          }
          var px = cl(q.x + DIRS[d][0] * 60, 18, SW - 18), py = cl(q.y + DIRS[d][1] * 60, Y_MIN, Y_MAX);
          var sc2 = -hits * 10 + hora - (charco(px, py, now) ? 1.2 : 0) - (zona(px, py, now) ? 1.5 : 0) - (dash ? 0.8 : 0) - (d === 0 ? 0 : 0.05) + R2.next() * 0.1;
          if (sc2 > bsc) { bsc = sc2; bd = d; bdash = dash; }
        }
      }
      pl.dir = bd; var dv = DIRS[bd]; api.eje(dv[0], dv[1]);
      if (bdash && q.tobo < 0 && R2.next() < 0.3 + 0.65 * sk) api.press('a');
    }

    /* ───── 2D de respaldo (sin WebGL o ?plano=1): solo rr / ell / line / poly / txt / pj ───── */
    function globo2D(x, y, r, col) { ell(x, y, r, r * 1.12, col, 2.5); poly([[x - r * 0.3, y + r], [x + r * 0.3, y + r], [x, y + r * 1.45]], col, 2); ell(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.35, '#fffdf2', 0); }
    function fondo(f, G) {
      var x0 = f.x0, w = f.x1 - x0, k;
      rr(x0, 0, w, 140, 0, pal.cielo, 0); rr(x0, 100, w, 60, 0, pal.cielo2, 0);
      if (lv === 3) for (k = 0; k < 14; k++) ell(x0 + ((k * 137) % w), 14 + (k * 29) % 60, 2, 2, '#fffdf2', 0);
      var bw = 92, nb = Math.ceil(w / bw) + 1;
      for (k = 0; k < nb; k++) { var bx = x0 + k * bw; rr(bx, 70, bw - 4, 100, 4, ['#ff9ec7', '#7fd6c9', '#ffb36b', '#a9a0ff'][k % 4], 3); rr(bx + 14, 86, 22, 30, 3, pal.luz ? '#ffe14d' : '#3a4a7a', 2); rr(bx + 52, 86, 22, 30, 3, pal.luz ? '#ffe14d' : '#3a4a7a', 2); }
    }
    function persona(p, x, y, hop, stg) {
      var s = asiento(p), col = s.color || '#ffd23f';
      ctx.save(); ctx.globalAlpha = stg ? (Math.floor(absT * 12) % 2 ? 0.55 : 1) : 1;
      ell(x, y + 3, 20, 6, 'rgba(20,16,28,.35)', 0);
      rr(x - 11, y - 26 - hop, 8, 24, 4, '#2f3a7a', 3); rr(x + 3, y - 26 - hop, 8, 24, 4, '#2f3a7a', 3);
      rr(x - 15, y - 62 - hop, 30, 38, 10, stg ? '#3f7fd0' : col, 3.5);
      c.util.pj(s.ch, x, y - 78 - hop, 62, { animo: stg ? 'perder' : null, sombra: false });
      if (p === c.yo) poly([[x - 9, y - 130 - hop], [x + 9, y - 130 - hop], [x, y - 117 - hop]], '#ffd23f', 3);
      ctx.restore();
    }
    function dibujar2D() {
      var f = cp(), G = geom(), now = c.ahora(), p, k, j, ox = G.ox, oy = G.oy, a = todas();
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
      ctx.save(); ctx.translate(sxk, syk);
      fondo(f, G);
      ctx.save(); ctx.translate(G.cx, 120); ctx.scale(G.k, G.k); ctx.translate(-G.cx, -120);
      rr(ox - 14, oy + Y_MIN - 24, SW + 28, Y_MAX - Y_MIN + 44, 0, pal.calle, 3);
      for (k = 0; k < 9; k++) line([[ox - 14, oy + Y_MIN - 10 + k * 28], [ox + SW + 14, oy + Y_MIN - 10 + k * 28]], 1.5, pal.junta);
      /* el balcón con el solo y su tobo */
      var yb = oy + BAL_Y;
      rr(ox - 20, yb - 40, SW + 40, 64, 6, pal.casa, 3.5); rr(ox - 26, yb + 14, SW + 52, 10, 3, '#5a3a22', 2.5);
      for (k = 0; k < 22; k++) line([[ox - 20 + k * 22, yb + 14], [ox - 20 + k * 22, yb - 4]], 2, INK);
      line([[ox - 20, yb - 4], [ox + SW + 20, yb - 4]], 3, INK);
      for (k = 0; k < nShots - nThrown() && k < 8; k++) globo2D(ox + SW - 8 - k * 15, yb - 14, 6, GLOBOS[k % 4]);
      var sq = P[soloI], am = amago(now);
      c.util.pj(asiento(soloI).ch, ox + sq.x, yb - 26, 56, { animo: am ? 'celebrar' : null, sombra: false });
      if (am) globo2D(ox + sq.x, yb - 66, 9, GLOBOS[am.i % 4]);
      if (fase(now) === 2 && vec.length) { c.util.pj('abuela', ox + 30, yb - 26, 50, { animo: 'celebrar', sombra: false }); c.util.pj('mama', ox + SW - 30, yb - 26, 50, { animo: 'celebrar', sombra: false }); }
      /* charcos */
      for (k = 0; k < a.length; k++) { var u = now - a[k].tL, pr = a[k].pr; if (u < 0 || u > PUD) continue; ctx.save(); ctx.globalAlpha = 0.6 * Math.min(1, (PUD - u) / 1.5); ell(ox + a[k].x, oy + a[k].y, pr, pr * 0.7, a[k].k === 'm' ? '#e0a040' : '#8fd8ff', 0); ell(ox + a[k].x - pr * 0.3, oy + a[k].y - 3, pr * 0.3, pr * 0.15, '#fffdf2', 0); ctx.restore(); }
      /* eventos de la plaza: franja mojada, comparsa, camión; tobos y paraguas */
      for (k = 0; k < evs.length; k++) {
        var e = evs[k]; if (now < e.t0 || now > e.fin + PUD) continue;
        if (e.k === 'papelillo') continue;
        var hh = e.k === 'comparsa' ? COMP_H : CIS_W;
        if (now < e.tA) { ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * Math.abs(Math.sin(absT * 10)); rr(ox, oy + e.y - hh, SW, hh * 2, 4, '#ff3b4e', 0); ctx.restore(); continue; }
        if (e.k === 'cisterna') { var fx0 = evX(e, Math.min(now, e.fin)); ctx.save(); ctx.globalAlpha = 0.45; rr(e.dir > 0 ? ox : ox + fx0, oy + e.y - hh, e.dir > 0 ? Math.max(0, fx0) : Math.max(0, SW - fx0), hh * 2, 4, '#8fd8ff', 0); ctx.restore(); }
        if (now >= e.fin) continue;
        var gx = ox + evX(e, now);
        if (e.k === 'comparsa') { for (j = 0; j < 5; j++) { var cx2 = gx - e.L / 2 + (j + 0.5) * e.L / 5; ell(cx2, oy + e.y - 14 - Math.abs(Math.sin(absT * 9 + j)) * 6, 9, 14, CONF[j % CONF.length], 2.5); } txt('COMPARSA', gx, oy + e.y + 22, 10, '#fffdf2', 0, true); }
        else { rr(gx - e.L / 2, oy + e.y - hh, e.L, hh * 2, 6, '#dfe6ee', 3); rr(e.dir > 0 ? gx + e.L / 2 - 18 : gx - e.L / 2, oy + e.y - hh, 18, hh * 2, 4, '#e8453c', 3); txt('AGUA', gx, oy + e.y + 4, 11, '#3f7fd0', 0, true); }
      }
      for (k = 0; k < items.length; k++) {
        var I = items[k];
        if (itemVivo(I, now)) { var bob = Math.sin(absT * 5 + k) * 3; ell(ox + I.x, oy + I.y, ITEM_R, ITEM_R * 0.6, 'rgba(255,210,63,.35)', 2); if (I.tipo === 'tobo') rr(ox + I.x - 9, oy + I.y - 22 + bob, 18, 18, 3, '#3f7fd0', 2.5); else poly([[ox + I.x - 14, oy + I.y - 12 + bob], [ox + I.x + 14, oy + I.y - 12 + bob], [ox + I.x, oy + I.y - 28 + bob]], '#ff5c8a', 2.5); }
      }
      for (k = 0; k < pegs.length; k++) { var Q = pegs[k]; if (now >= Q.t0 && now < Q.t1) { ctx.save(); ctx.globalAlpha = 0.65; ell(ox + Q.x, oy + Q.y, PEG_R, PEG_R * 0.7, '#e0a040', 0); ctx.restore(); } }
      for (k = 0; k < ayu.length; k++) { var Y = ayu[k]; if (now >= Y.t0 && now < Y.t1) { var bb2 = Math.sin(absT * 6 + k) * 3; ell(ox + Y.x, oy + Y.y, AY_R, AY_R * 0.7, 'rgba(255,255,255,.25)', 2.5); globo2D(ox + Y.x, oy + Y.y - 14 + bb2, Y.tipo === 'g' ? 14 : 10, COL_AY[Y.tipo]); if (c.yo === soloI) txt(TXT_AY[Y.tipo], ox + Y.x, oy + Y.y + 14, 10, '#fffdf2', 0, true); } }
      /* avisos: sombra que crece y aro rojo */
      for (k = 0; k < a.length; k++) {
        var o = a[k], w = o.tL - now, tot = o.fly + WIND + o.id * STAG, rh = o.rh;
        if (w < 0 || w > tot || ciego(now)) continue;
        var uu = 1 - w / tot;
        ell(ox + o.x, oy + o.y, rh * (0.3 + 0.7 * uu), rh * 0.7 * (0.3 + 0.7 * uu), 'rgba(20,16,28,.3)', 0);
        ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(absT * 14)); ell(ox + o.x, oy + o.y, rh, rh * 0.7, 'rgba(0,0,0,0)', 3); line([[ox + o.x - 8, oy + o.y], [ox + o.x + 8, oy + o.y]], 3, '#ff3b4e'); ctx.restore();
      }
      /* la mira del solo local */
      if (ciego(now)) for (k = 0; k < 40; k++) ell(ox + ((k * 97 + Math.floor(absT * 20) * 13) % SW), oy + Y_MIN + ((k * 53) % (Y_MAX - Y_MIN)), 4, 3, CONF[k % CONF.length], 0);
      if (c.yo === soloI && now >= 0) { ell(ox + sq.x, oy + sq.y, RH, RH * 0.7, 'rgba(255,210,63,.18)', 2.5); line([[ox + sq.x - 12, oy + sq.y], [ox + sq.x + 12, oy + sq.y]], 2.5, '#ffd23f'); line([[ox + sq.x, oy + sq.y - 9], [ox + sq.x, oy + sq.y + 9]], 2.5, '#ffd23f'); }
      /* el trío, por profundidad */
      var ord = trio.slice(); ord.sort(function (x1, x2) { return P[x1].y - P[x2].y; });
      for (k = 0; k < ord.length; k++) {
        p = ord[k]; var q = P[p], mine = c.mio(p), hop = (mine ? esquiva(p, now) : q.remJ) ? 12 : 0, stg = mine ? now < q.stg : (q.remSt || now < q.stg);
        persona(p, ox + q.x, oy + q.y, hop, stg);
        var ll = lleva(p, now);
        if (ll === 'para') { poly([[ox + q.x - 24, oy + q.y - 132], [ox + q.x + 24, oy + q.y - 132], [ox + q.x, oy + q.y - 156]], '#ff5c8a', 2.5); line([[ox + q.x, oy + q.y - 132], [ox + q.x, oy + q.y - 100]], 2, INK); }
        else if (ll === 'tobo') rr(ox + q.x - 10, oy + q.y - 142, 20, 18, 3, '#3f7fd0', 2.5);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 14, 11, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      /* las bombas en vuelo (arco desde el balcón) */
      for (k = 0; k < a.length; k++) {
        var o3 = a[k], u3 = (now - o3.tr) / o3.fly, sx3 = o3.lado ? (o3.lado < 0 ? 30 : SW - 30) : sq.x;
        if (u3 < 0 || u3 >= 1) continue;
        var bx = ox + sx3 + (o3.x - sx3) * u3, by = yb - 60 + (oy + o3.y - yb + 60) * u3 - Math.sin(u3 * Math.PI) * 70;
        globo2D(bx, by, o3.k === 'g' ? 16 : 9, o3.k === 'm' ? '#e0a040' : GLOBOS[(o3.i + o3.id) % 4]);
      }
      ctx.restore(); ctx.restore();
      marcador(f, G);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.25; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ffffff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }
    function lleva(p, now) {                               /* lo que lleva p (dibujo): 'tobo', 'para' o null */
      for (var j = 0; j < items.length; j++) { var I = items[j]; if (I.por !== p) continue; if (I.tipo === 'tobo' && !I.usado) return 'tobo'; if (I.tipo === 'para' && now < I.tt + PARA_S) return 'para'; }
      return null;
    }
    function marcador(f, G) {                               // MOJADOS x/3 arriba y las bombas que le quedan al solo (texto 2D, igual en 3D)
      var cx = (f.x0 + f.x1) / 2, now = c.ahora(), k;
      var my = 84;
      txt('MOJADOS', cx - 70, my, 14, '#fffdf2', 0, true);
      for (k = 0; k < HITS_GANA; k++) { var x = cx - 10 + k * 26; if (k < hitsN) { ell(x, my, 11, 8, '#3fa9ff', 2.5); ell(x - 4, my - 3, 3, 2, '#fffdf2', 0); } else globo2D(x, my - 4, 7, '#fffdf2'); }
      txt(hitsN + '/' + HITS_GANA, cx + 92, my, 20, hitsN >= HITS_GANA ? '#5cff7a' : '#ffd23f', 0, true);
      if (now > -0.5 && now < 2.4 && !c.practica) txt(soloI === c.yo ? '¡APUNTA Y LANZA!' : '¡CUIDADO CON EL BALCÓN!', cx, 140, soloI === c.yo ? 24 : 20, '#fffdf2', 0, true);
      else if (now >= 2.4 && now < 6 && !c.practica && c.yo >= 0 && !isSolo(c.yo)) txt('A = ¡ESQUIVA! · agarra el TOBO o el PARAGUAS', cx, 140, 15, '#fffdf2', 0, true);
      else if (now >= 2.4 && now < 5 && !c.practica && c.yo === soloI) txt('suelta el stick: la mira se pega', cx, 140, 14, '#fffdf2', 0, true);
      var ph = fase(now);
      if (now >= 0 && ph === 2 && now < dur && hitsN < HITS_GANA) txt('¡ÚLTIMOS SEGUNDOS!', cx, 56, 15 + Math.abs(Math.sin(absT * 6)) * 3, Math.floor(absT * 4) % 2 ? '#ff5c8a' : '#ffd23f', 0, true);
      for (k = 0; k < evs.length; k++) { var e = evs[k]; if (now >= e.t0 && now < e.tA) txt(TXT_EV[e.k], cx, 196 + Math.sin(absT * 12) * 2, 17, '#ff5c8a', 0, true); else if (e.k === 'papelillo' && now >= e.tA && now < e.fin) txt('¡NO SE VEN LAS SOMBRAS!', cx, 196, 15, '#ffd23f', 0, true); }
      if (c.yo >= 0 && !isSolo(c.yo) && P[c.yo].tobo >= 0) txt('A = ¡LÁNZALE EL TOBO!', cx, 166 + Math.sin(absT * 8) * 3, 17, '#5cff7a', 0, true);
      if (c.yo >= 0 && !isSolo(c.yo) && now < P[c.yo].para) txt('PARAGUAS ' + Math.ceil(P[c.yo].para - now), cx, 166, 15, '#ff9ec7', 0, true);
      if (c.yo === soloI && now >= 0) {
        var rest = Math.max(0, P[soloI].nextShot - now), quedan = nShots - nThrown();
        var prox = quedan > 0 ? tipoDe(siguiente(), Math.max(now, P[soloI].nextShot) + WIND, P[soloI].x, P[soloI].y) : 'n';
        txt('BOMBAS: ' + quedan + (TXT_TIPO[prox] ? '  ·  PRÓXIMA: ' + TXT_TIPO[prox] : ''), cx, my + 24, 13, TXT_TIPO[prox] ? '#ff8a3f' : '#fffdf2', 0, true);
        for (k = 0; k < ayu.length; k++) if (now >= ayu[k].t0 && now < ayu[k].t1 && ayu[k].t1 - now > 1) { txt('¡TIRA SOBRE LA PASTILLA: ' + TXT_AY[ayu[k].tipo] + '!', cx, my + 42, 12, COL_AY[ayu[k].tipo], 0, true); break; }
        if (now < P[soloI].moj) txt('¡TE ECHARON UN TOBO!', cx, 166, 17, '#8fd8ff', 0, true);
        else if (quedan > 0 && rest <= 0 && !amago(now)) txt('¡LANZA!', cx, 166 + Math.sin(absT * 8) * 3, 18, '#5cff7a', 0, true);
      }
      void G;
    }

    /* ───── 3D low poly (fiesta-3d.js): la plaza de Carnaval con la casa del balcón. Solo dibujo: lee P y shots; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ESX = 1 / 18, ESZ = 1.15 / 18;
    function WX(x) { return (x - SW / 2) * ESX; }
    function WZ(y) { return (y - 180) * ESZ; }
    var BZ = -8.1, BH = 3.6;                                  // el balcón: z del borde y altura del piso
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', piso: '#e3c79a', junta: '#c9a576', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', piso: '#d9b48a', junta: '#b98f66', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', piso: '#7a6a80', junta: '#5a4a62', noche: 1 }
    };
    var CASAS = ['#ff9ec7', '#7fd6c9', '#ffb36b', '#a9a0ff', '#8fd8ff', '#ff7a6a'];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 60, 150], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* piso de adoquines */
      var adoq = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.junta; x.fillRect(0, 0, w, h);
        for (var j = 0; j < 8; j++) for (var i2 = 0; i2 < 8; i2++) { var o = j % 2 ? 16 : 0, sh = ((i2 * 7 + j * 13) % 5) / 5; x.fillStyle = V3.oscurecer(pl.piso, .9 + sh * .12); x.fillRect(i2 * 32 + o + 2, j * 32 + 2, 28, 28); }
      }, [22, 14]);
      var piso = new T.Mesh(new T.PlaneGeometry(120, 80), new T.MeshToonMaterial({ map: adoq, gradientMap: V3.toon('#fff').gradientMap }));
      piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      /* la calle: bordes amarillos y confeti pegado en el piso */
      var x0 = WX(0) - .9, x1 = WX(SW) + .9, z0 = WZ(Y_MIN) - 1.4, z1 = WZ(Y_MAX) + 1.2, bw = x1 - x0, bd = z1 - z0, cz = (z0 + z1) / 2;
      [[0, z0, bw, .18], [0, z1, bw, .18], [x0, cz, .18, bd], [x1, cz, .18, bd]].forEach(function (r) {
        var m = new T.Mesh(new T.PlaneGeometry(r[2], r[3]), tn('#ffd23f')); m.rotation.x = -Math.PI / 2; m.position.set(r[0], .02, r[1]); m.receiveShadow = true; S3.add(m);
      });
      for (k = 0; k < 60; k++) { var cf = new T.Mesh(new T.PlaneGeometry(.22, .12), tn(CONF[k % CONF.length])); cf.rotation.set(-Math.PI / 2, 0, (k * 2.39) % 6.28); cf.position.set(((k * 37.7) % 50) - 25, .015, ((k * 23.3) % 22) - 7); cf.receiveShadow = true; S3.add(cf); }
      /* casas coloniales: la casa grande del balcón en el centro y casas a los lados */
      function ventana(g3, vx, vy, vz, w, h) {
        var v = M(new T.BoxGeometry(w, h, .15), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); v.position.set(vx, vy, vz); g3.add(v);
      }
      function casa(x, z, w, h, col, rot) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); g3.rotation.y = rot || 0; S3.add(g3);
        var cu = M(new T.BoxGeometry(w, h, 4), col, { recibe: true, g: .015 }); cu.position.y = h / 2; g3.add(cu);
        var zoc = M(new T.BoxGeometry(w + .05, .9, 4.05), '#fffdf2', { borde: false, recibe: true }); zoc.position.y = .45; g3.add(zoc);
        var tejas = M(new T.CylinderGeometry(.01, 3.2, w + .6, 3, 1), '#c4563a', { g: .02 }); tejas.rotation.z = Math.PI / 2; tejas.scale.set(1, 1, .5); tejas.position.set(0, h + .55, 0); g3.add(tejas);
        var nv = Math.max(1, Math.round(w / 2.6)), i2;
        for (i2 = 0; i2 < nv; i2++) { var vx = -w / 2 + (i2 + .5) * w / nv; ventana(g3, vx, 1.9, 2.02, 1, 1.5); if (h > 5.5) ventana(g3, vx, h - 2, 2.02, .9, 1.3); }
        return g3;
      }
      var gW = 30, gH = 7.4, gz = BZ - 2.9;                                     // la casa grande: el frente queda detrás del balcón
      var grande = new T.Group(); grande.position.set(0, 0, gz); S3.add(grande);
      var cuG = M(new T.BoxGeometry(gW, gH, 4), pl.noche ? '#ffe6a8' : '#fff1c2', { recibe: true, g: .012 }); cuG.position.y = gH / 2; grande.add(cuG);
      var zG = M(new T.BoxGeometry(gW + .05, .9, 4.05), '#c4783a', { borde: false, recibe: true }); zG.position.y = .45; grande.add(zG);
      var tjG = M(new T.CylinderGeometry(.01, 3.2, gW + .6, 3, 1), '#c4563a', { g: .02 }); tjG.rotation.z = Math.PI / 2; tjG.scale.set(1, 1, .5); tjG.position.set(0, gH + .55, 0); grande.add(tjG);
      for (k = 0; k < 9; k++) { var vx2 = -gW / 2 + (k + .5) * gW / 9; ventana(grande, vx2, 1.7, 2.02, 1.1, 1.7);
        var pu = M(new T.BoxGeometry(1.3, 2.3, .15), '#7a4a2a', { g: .03 }); pu.position.set(vx2, BH + 1.25, 2.02); grande.add(pu); }
      /* el balcón: losa, baranda de hierro y matas */
      var losa = M(new T.BoxGeometry(gW - 1, .3, 2.6), '#e8d8b0', { recibe: true, g: .02 }); losa.position.set(0, BH, BZ - 1.1); S3.add(losa);
      var bar = M(new T.BoxGeometry(gW - 1, .12, .12), '#2a2a34', { borde: false }); bar.position.set(0, BH + 1.05, BZ + .1); S3.add(bar);
      for (k = 0; k < 58; k++) { var ba = M(new T.BoxGeometry(.06, 1, .06), '#2a2a34', { borde: false }); ba.position.set(-gW / 2 + 1 + k * (gW - 2) / 57, BH + .55, BZ + .1); S3.add(ba); }
      for (k = 0; k < 6; k++) { var mx = -12 + k * 4.8, mt = M(new T.CylinderGeometry(.3, .22, .45, 7), '#c4563a'); mt.position.set(mx, BH + .38, BZ - .35); S3.add(mt);
        var fl = M(new T.IcosahedronGeometry(.38, 0), k % 2 ? '#3fae4a' : '#2f9a3c', { g: .04 }); fl.position.set(mx, BH + .8, BZ - .35); S3.add(fl);
        var fo = M(new T.SphereGeometry(.12, 6, 4), CONF[k % CONF.length], { borde: false }); fo.position.set(mx + .15, BH + 1.05, BZ - .2); S3.add(fo); }
      /* el tobo de bombas en el balcón (se vacía con cada tiro) */
      var tobo = M(new T.CylinderGeometry(.6, .48, .7, 9), '#3f7fd0'); tobo.position.set(gW / 2 - 2.2, BH + .5, BZ - 1.2); S3.add(tobo);
      var municion = [];
      for (k = 0; k < Math.min(nShots, 9); k++) { var bb = M(new T.SphereGeometry(.22, 7, 5), GLOBOS[k % 4], { g: .05 }); bb.position.set(gW / 2 - 2.2 + Math.cos(k * 2.4) * .3, BH + .9 + Math.floor(k / 3) * .15, BZ - 1.2 + Math.sin(k * 2.4) * .3); S3.add(bb); municion.push(bb); }
      /* casas de los lados, palmeras, faroles, guirnaldas */
      casa(-24, gz + 1, 8, 6, CASAS[0], Math.PI / 2 * .5); casa(24, gz + 1, 8, 6, CASAS[2], -Math.PI / 2 * .5);
      casa(-27, 4, 8, 5, CASAS[3], Math.PI / 2 * .85); casa(27, 4, 8, 5, CASAS[4], -Math.PI / 2 * .85);
      var hojas = [];
      function palmera(x, z, h) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        for (var i2 = 0; i2 < 6; i2++) { var tr = M(new T.CylinderGeometry(.28 - i2 * .02, .34 - i2 * .02, h / 6, 6), i2 % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(i2 * .3) * .3, h / 12 + i2 * h / 6, 0); g3.add(tr); }
        for (var j2 = 0; j2 < 7; j2++) { var hoja = M(new T.ConeGeometry(.5, 3.6, 4), j2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); hoja.geometry.translate(0, 1.8, 0); hoja.position.set(.5, h, 0); hoja.rotation.set(0, j2 / 7 * 6.28, 0); hoja.rotateZ(1.9); g3.add(hoja); hojas.push(hoja); }
      }
      palmera(-17.5, -6, 7.5); palmera(17.5, -6, 8); palmera(-19, 8, 6.5); palmera(19, 9, 7);
      function farol(x, z) {
        var po = M(new T.CylinderGeometry(.1, .14, 5, 6), '#2a2a34'); po.position.set(x, 2.5, z); S3.add(po);
        var la = M(new T.BoxGeometry(.6, .7, .6), '#2a2a34'); la.position.set(x, 5.2, z); S3.add(la);
        var vi = new T.Mesh(new T.BoxGeometry(.45, .5, .45), tn('#fff2a0', { em: '#ffd36a', emI: pl.noche ? 1.6 : .2 })); vi.position.set(x, 5.2, z); S3.add(vi);
        if (pl.noche) { var luz = new T.PointLight(0xffc870, 1.3, 16, 2); luz.position.set(x, 4.6, z); S3.add(luz); }
      }
      farol(-15, 6); farol(15, 6);
      if (pl.noche) { var luzB = new T.PointLight(0xffd890, 1.1, 18, 2); luzB.position.set(0, BH + 3, BZ + 1.5); S3.add(luzB); }
      var banderas = [];
      function guirnalda(a0, a1, n2, caida) {
        var pts = [], i2;
        for (i2 = 0; i2 <= 24; i2++) { var u = i2 / 24; pts.push(new T.Vector3(a0.x + (a1.x - a0.x) * u, a0.y + (a1.y - a0.y) * u - Math.sin(u * Math.PI) * caida, a0.z + (a1.z - a0.z) * u)); }
        var cur = new T.CatmullRomCurve3(pts); S3.add(new T.Mesh(new T.TubeGeometry(cur, 30, .03, 4), tn('#14101c')));
        var tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-.32, 0, 0, .32, 0, 0, 0, -.7, 0], 3)); tri.computeVertexNormals();
        for (i2 = 0; i2 < n2; i2++) {
          var p2 = cur.getPoint((i2 + .5) / n2), f2 = new T.Mesh(tri, new T.MeshToonMaterial({ color: CONF[i2 % CONF.length], side: T.DoubleSide, gradientMap: V3.toon('#fff').gradientMap }));
          f2.position.copy(p2); f2.castShadow = true; S3.add(f2); banderas.push(f2);
          if (pl.noche && i2 % 2) { var bo = new T.Mesh(new T.SphereGeometry(.13, 6, 4), tn('#fff6c0', { em: CONF[(i2 + 2) % CONF.length], emI: 2 })); bo.position.copy(p2).y -= .05; S3.add(bo); }
        }
      }
      guirnalda(new T.Vector3(-14.5, gH - .2, gz + 2), new T.Vector3(14.5, gH - .2, gz + 2), 30, .8);
      guirnalda(new T.Vector3(-15, 5.4, 6), new T.Vector3(-8, gH, gz + 2), 12, 1.2);
      guirnalda(new T.Vector3(15, 5.4, 6), new T.Vector3(8, gH, gz + 2), 12, 1.2);

      /* los jugadores: el solo en el balcón, el trío en la calle */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: isSolo(k) ? 1.25 : 1.35 });
        S3.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: s2.color && s2.color !== '#fff' ? s2.color : CONF[k % CONF.length], transparent: true, opacity: .85 }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = .04; aro.visible = !isSolo(k); S3.add(aro);
        var x3 = isSolo(k) ? WX(P[k].x) : WX(P[k].x), z3 = isSolo(k) ? BZ - .9 : WZ(P[k].y);
        pjs.push({ pj: pj, aro: aro, x: x3, z: z3, px: x3, pz: z3, rumbo: 0, mojadoC: -1, gota: 0, jv: -9, resbT: 0 });
      }
      var mano = M(new T.SphereGeometry(.38, 9, 7), '#3fa9ff', { g: .06 }); mano.visible = false; S3.add(mano);   // la bomba que el solo levanta en el amago
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      /* la mira del solo (solo la ve él) */
      var mira = new T.Group(); S3.add(mira);
      var miraA = new T.Mesh(new T.RingGeometry(RH * ESX - .24, RH * ESX, 32), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .95, depthWrite: false })); miraA.rotation.x = -Math.PI / 2; miraA.scale.set(1, 1.15, 1); mira.add(miraA);
      var miraF = new T.Mesh(new T.CircleGeometry(RH * ESX - .24, 32), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .18, depthWrite: false })); miraF.rotation.x = -Math.PI / 2; miraF.scale.set(1, 1.15, 1); mira.add(miraF);
      [[.9, .12], [.12, .9]].forEach(function (r) { var cr = new T.Mesh(new T.PlaneGeometry(r[0], r[1]), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .9, depthWrite: false })); cr.rotation.x = -Math.PI / 2; cr.position.y = .01; mira.add(cr); });
      var fantasmas = [];                                                         // el dibujo de la ráfaga (nivel 2-3) alrededor de la mira
      for (k = 1; k < lv; k++) { var fa = new T.Mesh(new T.RingGeometry(RH * ESX - .08, RH * ESX, 28), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .35, depthWrite: false })); fa.rotation.x = -Math.PI / 2; fa.scale.set(1, 1.15, 1); S3.add(fa); fantasmas.push(fa); }
      mira.position.y = .05;
      var pegM = [], ayM = [];
      for (k = 0; k < pegs.length; k++) { var pm = new T.Mesh(new T.CircleGeometry(PEG_R * ESX, 18), new T.MeshBasicMaterial({ color: 0xe0a040, transparent: true, opacity: .7, depthWrite: false })); pm.rotation.x = -Math.PI / 2; pm.scale.set(1, 1.15, 1); pm.position.set(WX(pegs[k].x), .03, WZ(pegs[k].y)); pm.visible = false; S3.add(pm); pegM.push(pm); }
      for (k = 0; k < ayu.length; k++) {
        var ag3 = new T.Group(), cb = COL_AY[ayu[k].tipo], pa = new T.Mesh(new T.RingGeometry(AY_R * ESX - .2, AY_R * ESX, 24), new T.MeshBasicMaterial({ color: cb, transparent: true, opacity: .9, depthWrite: false }));
        pa.rotation.x = -Math.PI / 2; pa.scale.set(1, 1.15, 1); pa.position.y = .05; ag3.add(pa);
        var gl = M(new T.IcosahedronGeometry(ayu[k].tipo === 'g' ? .75 : .5, 0), cb, { g: .08, em: cb, emI: .5 }); gl.position.y = 1.3; gl.name = 'gl'; ag3.add(gl);
        ag3.position.set(WX(ayu[k].x), 0, WZ(ayu[k].y)); ag3.visible = false; S3.add(ag3); ayM.push(ag3);
      }
      var part = V3.particulas(esc, 600);
      esc.encuadrar(bw + 1.5, bd + 9.5, new T.Vector3(0, 1.6, cz - 2.6), .66);               // la calle entera y, arriba, el balcón con el solo de cuerpo entero
      return V3.ultimo = { esc: esc, pjs: pjs, mano: mano, flecha: flecha, mira: mira, fantasmas: fantasmas, municion: municion, part: part, banderas: banderas, hojas: hojas,
        bombas: {}, avisos: {}, charcos: {}, ondas: [], confT: 0, pegM: pegM, ayM: ayM };
    }
    function bomba3D(col) {                                 // una bomba de agua: cuerpo + nudo + brillo
      var T = THREE, g3 = new T.Group(), mat = V3.toon(col, { op: .92 });
      var cu = V3.malla(new T.SphereGeometry(.42, 10, 8), null, { mat: mat, g: .06 }); cu.scale.set(1, 1.12, 1); g3.add(cu);
      var nu = V3.malla(new T.ConeGeometry(.11, .24, 6), null, { mat: mat, g: .1 }); nu.position.y = -.52; nu.rotation.x = Math.PI; g3.add(nu);
      var br = new T.Mesh(new T.SphereGeometry(.11, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); br.position.set(-.15, .2, .3); br.scale.set(1, 1.4, .5); g3.add(br);
      return g3;
    }
    function quitar(m) { v3.esc.scene.remove(m); }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, p, k, t = absT, a = todas(), fin = hitsN >= HITS_GANA || (nThrown() >= nShots && now > ultimaCae() + 0.3) || now >= dur;
      V.part.update(dt);
      V.confT -= dt; if (V.confT < 0) { V.confT = .15; V.part.soltar((c.fx() - .5) * 36, 10, (c.fx() - .5) * 14 - 1, 2, { k: 'confeti', cols: CONF, vel: .8, arriba: 0, g: 2.5, vida: 5 }); }
      for (k = 0; k < V.banderas.length; k++) V.banderas[k].rotation.x = Math.sin(t * 2.2 + k * .7) * .35;
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .06;
      for (k = 0; k < V.municion.length; k++) V.municion[k].visible = k < nShots - nThrown();
      for (k = 0; k < pegs.length; k++) V.pegM[k].visible = now >= pegs[k].t0 && now < pegs[k].t1;
      for (k = 0; k < ayu.length; k++) { var on3 = now >= ayu[k].t0 && now < ayu[k].t1; V.ayM[k].visible = on3; if (on3) { var gl3 = V.ayM[k].children[1]; gl3.position.y = 1.3 + Math.sin(t * 4 + k) * .25; gl3.rotation.y = t * 2; } }
      /* el solo: camina por el balcón detrás de su mira y mira hacia ella */
      var sq = P[soloI], s0 = V.pjs[soloI], am = amago(now), tx0 = cl(WX(sq.x), -13.5, 13.5), dx0 = tx0 - s0.x, lim0 = 9 * dt;
      s0.x += Math.abs(dx0) > lim0 ? (dx0 > 0 ? lim0 : -lim0) : dx0;
      var v0 = Math.abs(s0.x - s0.px) / Math.max(dt, 1e-3); s0.px = s0.x;
      var gana = fin && hitsN >= HITS_GANA;
      if (fin && now > 0) s0.pj.anim(gana ? 'celebrar' : 'triste').cara(gana ? 'feliz' : 'triste');
      else if (am && now < am.tl) s0.pj.anim('cargar', { vel: Math.min(1, v0 / 6) }).cara('concentrado');
      else s0.pj.anim(v0 > 1.2 ? 'caminar' : 'quieto', { vel: Math.min(1, v0 / 6) }).cara(now - (V.ultGolpe || -9) < 1.5 ? 'feliz' : 'concentrado');
      s0.pj.rumbo(Math.atan2(WX(sq.x) - s0.x, WZ(sq.y) - (BZ - .9)) * .8).update(dt);
      s0.pj.g.position.set(s0.x, BH + .15, BZ - .9);
      V.mano.visible = !!(am && now < am.tl); if (V.mano.visible) { V.mano.position.set(s0.x, BH + .15 + 3.3 + Math.sin(t * 9) * .05, BZ - .9); V.mano.material = V3.toon(GLOBOS[am.i % 4], { op: .92 }); }
      /* tiros: el lanzar al soltar; cada bomba vuela en arco, avisa con sombra y aro, y al caer revienta y deja un charco */
      for (k = 0; k < a.length; k++) {
        var o = a[k], key = o.i * 10 + o.id, u = (now - o.tr) / FLY, aviso = V.avisos[key];
        if (now >= o.tr - WIND - o.id * STAG && now < o.tL && !aviso) {
          aviso = V.avisos[key] = { som: new T.Mesh(new T.CircleGeometry(RH * ESX, 24), new T.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: 0, depthWrite: false })),
            aro: new T.Mesh(new T.RingGeometry(RH * ESX - .16, RH * ESX, 32), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .8, depthWrite: false })) };
          [aviso.som, aviso.aro].forEach(function (m) { m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.15, 1); m.position.set(WX(o.x), .035, WZ(o.y)); V.esc.scene.add(m); });
          aviso.aro.position.y = .045;
          if (o.id === 0) V3.sfx('tic');
        }
        if (aviso && (now >= o.tL || now < o.tr - WIND - 1)) { quitar(aviso.som); quitar(aviso.aro); delete V.avisos[key]; aviso = null; }
        if (aviso) { var ww = cl((now - (o.tr - WIND)) / (FLY + WIND), 0, 1); aviso.som.material.opacity = .12 + .3 * ww; aviso.som.scale.set(.35 + .65 * ww, (.35 + .65 * ww) * 1.15, 1);
          aviso.aro.material.opacity = .45 + .45 * Math.abs(Math.sin(t * (8 + 14 * ww))); }
        var bo = V.bombas[key];
        if (u >= 0 && u < 1) {
          if (!bo) { bo = V.bombas[key] = bomba3D(GLOBOS[(o.i + o.id) % 4]); V.esc.scene.add(bo); if (o.id === 0) { s0.pj.uno('lanzar'); V3.sfx('whoosh'); } V3.sfx('silbido'); }
          var ax = s0.x, ay = BH + 2.6, az = BZ - .6, bx = WX(o.x), bz = WZ(o.y);
          bo.position.set(ax + (bx - ax) * u, ay + (.45 - ay) * u + Math.sin(u * Math.PI) * 3.6, az + (bz - az) * u);
          bo.rotation.set(u * 6, 0, u * 4); bo.scale.setScalar(1 + .25 * Math.sin(u * Math.PI));
        } else if (bo) { quitar(bo); delete V.bombas[key]; }
        if (now >= o.tL && !V.charcos[key] && now - o.tL < PUD) revienta(o, key);
      }
      /* charcos: se secan y se van */
      for (k in V.charcos) { var ch = V.charcos[k], ag = now - ch.tL; if (ag > PUD || ag < -.5) { quitar(ch.m); quitar(ch.b); V.charcos[k] = { m: null, gone: 1, tL: ch.tL }; continue; } if (ch.gone) continue;
        var cr = Math.min(1, ag * 5); ch.m.scale.set(.3 + cr * .7, (.3 + cr * .7) * 1.15, 1); ch.m.material.opacity = .7 * Math.min(1, (PUD - ag) / 1.5); ch.b.material.opacity = .5 * Math.min(1, (PUD - ag) / 1.5); }
      for (k = V.ondas.length - 1; k >= 0; k--) { var on = V.ondas[k], ag2 = t - on.t; if (ag2 > .6) { quitar(on.m); V.ondas.splice(k, 1); continue; } on.m.scale.setScalar(1 + ag2 * 6); on.m.material.opacity = .8 * (1 - ag2 / .6); }
      /* el trío */
      for (k = 0; k < trio.length; k++) {
        p = trio[k]; var q = P[p], s3 = V.pjs[p], tx = WX(q.x), tz = WZ(q.y), mine = c.mio(p);
        s3.x = tx; s3.z = tz;
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3), vz = (s3.z - s3.pz) / Math.max(dt, 1e-3), v = Math.sqrt(vx * vx + vz * vz); s3.px = s3.x; s3.pz = s3.z;
        if (v > .5) s3.rumbo = Math.atan2(vx, vz);
        var stg = mine ? now < q.stg : (q.remSt || now < q.stg), dsh = mine ? esquiva(p, now) : q.remJ, resb = mine ? q.resb : charco(q.x, q.y, now) && v > 2;
        if (dsh && t - s3.jv > .5) { s3.jv = t; s3.pj.uno('saltar'); V3.sfx('whoosh'); V.part.soltar(s3.x, .2, s3.z, 6, { k: 'chispa', cols: ['#fffdf2', '#e3c79a'], vel: 2, arriba: 1.5, vida: .4 }); }
        if (resb) { s3.resbT -= dt; if (s3.resbT < 0) { s3.resbT = .45; V3.sfx('resbalon'); V.part.soltar(s3.x, .15, s3.z, 4, { k: 'gota', cols: ['#8fd8ff', '#fffdf2'], vel: 2.5, arriba: 1.5, vida: .45, esc: .7 }); } }
        var vn = Math.min(1, v / 9), pj = s3.pj;
        if (fin && now > 0) pj.anim(gana ? 'triste' : 'celebrar').cara(gana ? 'triste' : 'feliz');
        else if (stg) pj.anim('mojado').cara('mareado');
        else if (resb) pj.anim('aire').cara('susto');
        else pj.anim(v > 4 ? 'correr' : v > .8 ? 'caminar' : 'quieto', { vel: vn }).cara(peligro(q) ? 'susto' : 'normal');
        if (stg !== s3.mojadoC) { s3.mojadoC = stg; pj.color(stg ? '#3f7fd0' : null); }
        if (stg) { s3.gota -= dt; if (s3.gota < 0) { s3.gota = .2; V.part.soltar(s3.x + (c.fx() - .5) * .8, 2.6, s3.z, 1, { k: 'gota', cols: ['#8fd8ff', '#3fa9ff'], vel: .3, arriba: 0, vida: .5, esc: .8 }); } }
        pj.rumbo(resb ? s3.rumbo + Math.sin(t * 18) * .5 : s3.rumbo).update(dt);
        pj.g.position.set(s3.x, 0, s3.z);
        s3.aro.position.set(s3.x, .04, s3.z);
      }
      var yo = c.yo >= 0 && !isSolo(c.yo) ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.x, 4.4 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      if (c.yo === soloI) { V.flecha.visible = true; V.flecha.position.set(s0.x, BH + 4.2 + Math.abs(Math.sin(t * 4)) * .3, BZ - .9); }
      /* la mira (solo para el solo local) y el dibujo de la ráfaga */
      var miraOn = c.yo === soloI && now >= 0 && !fin, listo = now >= sq.nextShot && siguiente() < nShots && !am;
      V.mira.visible = miraOn; V.mira.position.set(WX(sq.x), .05, WZ(sq.y));
      V.mira.children[0].material.color.set(listo ? 0x5cff7a : 0xffd23f); V.mira.scale.setScalar(1 + (listo ? .06 * Math.sin(t * 10) : 0));
      if (miraOn) { var gg = gotas({ i: siguiente(), x: sq.x, y: sq.y, tl: 0 }); for (k = 0; k < V.fantasmas.length; k++) { V.fantasmas[k].visible = true; V.fantasmas[k].position.set(WX(gg[k + 1].x), .05, WZ(gg[k + 1].y)); } }
      else for (k = 0; k < V.fantasmas.length; k++) V.fantasmas[k].visible = false;
    }
    function peligro(q) { var a = activos(c.ahora()), k; for (k = 0; k < a.length; k++) { var dx = q.x - a[k].x, dy = (q.y - a[k].y) * 1.15; if (dx * dx + dy * dy < (RH + 30) * (RH + 30)) return true; } return false; }
    function revienta(o, key) {                             // la bomba cae: chapuzón, onda, charco (y el sonido); el golpe lo marca onEv aparte
      var T = THREE, x = WX(o.x), z = WZ(o.y), col = GLOBOS[(o.i + o.id) % 4];
      v3.part.soltar(x, .5, z, 45, { k: 'gota', cols: ['#3fa9ff', '#8fd8ff', '#fffdf2', '#1f7fe0'], vel: 6, arriba: 5, vida: .9, esc: 1.2 });
      v3.part.soltar(x, .5, z, 8, { k: 'confeti', cols: [col, '#fffdf2'], vel: 4, arriba: 4, g: 10, vida: .8 });
      var onda = new T.Mesh(new T.RingGeometry(.6, .9, 24), new T.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }));
      onda.rotation.x = -Math.PI / 2; onda.position.set(x, .06, z); v3.esc.scene.add(onda); v3.ondas.push({ m: onda, t: absT });
      var m = new T.Mesh(new T.CircleGeometry(PR * ESX, 20), new T.MeshBasicMaterial({ color: 0x2fa8ff, transparent: true, opacity: .62, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, .025, z); v3.esc.scene.add(m);
      var b = new T.Mesh(new T.CircleGeometry(PR * ESX * .3, 12), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false }));
      b.rotation.x = -Math.PI / 2; b.position.set(x - PR * ESX * .35, .03, z - .3); b.scale.set(1.6, .6, 1); v3.esc.scene.add(b);
      v3.charcos[key] = { m: m, b: b, tL: o.tL };
      V3.sfx('splash'); v3.esc.sacudir(.35);
    }
    function golpe3D(p, mio) {
      if (!v3) return;
      var s3 = v3.pjs[p], so = v3.pjs[soloI]; s3.pj.impacto(s3.x - (so ? so.x : s3.x), s3.z - (BZ - .6), 1.5);
      v3.part.soltar(s3.x, 2.4, s3.z, 30, { k: 'gota', cols: ['#3fa9ff', '#8fd8ff', '#fffdf2'], vel: 4, arriba: 4, vida: .9, esc: 1.1 });
      v3.esc.sacudir(mio ? 1 : .5); v3.ultGolpe = c.ahora();
    }
    function sobre(p, alto) {
      if (v3) { var s3 = v3.pjs[p]; return v3.esc.proyectar(s3.x, isSolo(p) ? BH + alto : alto, s3.z); }
      var G = geom(); return scr(G, P[p].x, isSolo(p) ? BAL_Y - 60 : P[p].y - alto * 18);
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !(hitsN >= HITS_GANA)) V3.musica('balcon');
      v3.esc.render(dt);
      for (k = 0; k < n; k++) {
        var s3 = v3.pjs[k], pt = isSolo(k) ? v3.esc.proyectar(s3.x, BH + 3.9, BZ - .9) : v3.esc.proyectar(s3.x, 0, s3.z + 1.1);
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      marcador(f, null);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#bfe8ff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();                                 // los gritos (say) viven en las partículas del motor
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, k;
        absT += dt; flash = Math.max(0, flash - dt * 2.5); shake = Math.max(0, shake - dt * 3);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        for (k = 0; k < mios.length; k++) { var m = mios[k]; if (m.r < RESEND.length && now >= m.t + RESEND[m.r]) { m.r++; c.send('xtiro', m.d, false); } }
        for (p = 0; p < n; p++) { var q = P[p]; if (dt > 0) { q.mvx += ((q.x - q.px) / dt - q.mvx) * Math.min(1, dt * 6); q.mvy += ((q.y - q.py) / dt - q.mvy) * Math.min(1, dt * 6); } q.px = q.x; q.py = q.y; }
        var G = geom();
        if (hitsN >= HITS_GANA && !voz.gana) { voz.gana = 1; var sg2 = scr(G, SW / 2, 110); S('¡TODOS EMPAPADOS!', sg2.x, sg2.y, '#5cff7a'); }
        if (hitsN < HITS_GANA && !voz.limpio && nThrown() >= nShots && now >= ultimaCae() + 0.2) { voz.limpio = 1; var sg3 = scr(G, SW / 2, 110); S('¡SECOS COMO UNA AREPA!', sg3.x, sg3.y, '#ffd23f'); }
        /* lo cosmético de la escalada y de la agenda (misma hora en todas las pantallas) */
        var ph = fase(now);
        if (now >= 0 && ph > faseV) {
          faseV = ph; shake = 0.6; flash = 0.6;
          if (ph === 1) { banner('¡SE PRENDIÓ LA PLAZA!', '#ffd23f', 80); sfx('tambor', 180, 0.3, 'square', 0.06); }
          else { banner('¡ÚLTIMOS SEGUNDOS!', '#ff5c8a', 80); if (vec.length) banner('¡LOS VECINOS SE UNEN!', '#5cff7a', 130); sfx('bocina', 330, 0.4, 'sawtooth', 0.06); }
        }
        for (k = 0; k < evs.length; k++) {
          var e = evs[k];
          if (!e.av && now >= e.t0) { e.av = 1; banner(TXT_EV[e.k], '#ff5c8a', 120); sfx(e.k === 'cisterna' ? 'bocina' : e.k === 'comparsa' ? 'tambor' : 'tic', 300, 0.2, 'square', 0.05); }
          if (!e.bum && now >= e.tA) { e.bum = 1; if (e.k === 'papelillo') { sfx('trueno', 90, 0.5, 'sawtooth', 0.08); flash = 0.8; shake = 0.7; } else if (e.k === 'cisterna') sfx('motor', 120, 0.6, 'sawtooth', 0.05); }
        }
        for (k = 0; k < ayu.length; k++) if (!ayu[k].av && now >= ayu[k].t0) { ayu[k].av = 1; if (c.yo === soloI) { var sy = scr(G, ayu[k].x, ayu[k].y - 40); S(TXT_AY[ayu[k].tipo], sy.x, sy.y, COL_AY[ayu[k].tipo]); sfx('pop', 760, 0.1, 'sine', 0.05); } }
        for (k = 0; k < pegs.length; k++) if (!pegs[k].av && now >= pegs[k].t0) { pegs[k].av = 1; if (c.yo !== soloI) { var sp2 = scr(G, pegs[k].x, pegs[k].y - 30); S('¡MELAO!', sp2.x, sp2.y, '#e0a040'); } }
        for (k = 0; k < items.length; k++) if (!items[k].av && now >= items[k].t0) { items[k].av = 1; var si = scr(G, items[k].x, items[k].y - 40); S(items[k].tipo === 'tobo' ? '¡UN TOBO!' : '¡UN PARAGUAS!', si.x, si.y, '#5cff7a'); sfx('pop', 660, 0.1, 'sine', 0.05); }
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (isSolo(p)) aiSolo(p, dt, api, now); else aiTrio(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p], now = c.ahora();
        return { x: Math.round(q.x), y: Math.round(q.y), j: isSolo(p) ? 0 : (esquiva(p, now) ? 1 : 0), st: isSolo(p) ? (amago(now) ? 1 : 0) : (now < q.stg ? 1 : 0) };
      },
      onEv: function (ty, p, d, t) {
        if ((ty === 'toma' || ty === 'tobo') && d && num(p) && p >= 0 && p < n && !isSolo(p) && num(d.k) && d.k % 1 === 0 && d.k >= 0 && d.k < items.length) {
          var I = items[d.k], ahora = c.ahora();
          if (ty === 'toma') {                               /* el primero que llega a ESTA pantalla se lo lleva (el golpe lo juzga el dueño con su propio paraguas) */
            if (I.por >= 0) return;
            I.por = p; I.tt = ahora;
            if (I.tipo === 'para') P[p].para = ahora + PARA_S; else P[p].tobo = d.k;
            var st = sobre(p, 4.4); S(I.tipo === 'para' ? '¡PARAGUAS!' : '¡TOBO!', st.x, st.y, '#5cff7a'); sfx('moneda', 880, 0.12, 'square', 0.05);
            return;
          }
          if (I.tipo !== 'tobo' || I.usado) return;          /* cada tobo se lanza una sola vez */
          I.usado = 1; if (I.por < 0) I.por = p;
          for (var q2 = 0; q2 < n; q2++) if (P[q2].tobo === d.k) P[q2].tobo = -1;
          var so = P[soloI]; so.moj = ahora + TOBO_VUELO + TOBO_S; so.nextShot = Math.max(so.nextShot, ahora + TOBO_VUELO + TOBO_S);
          lanzados.push({ p: p, t: absT, x: P[p].x, y: P[p].y, ok: 0 });
          banner('¡TOBAZO AL BALCÓN!', '#8fd8ff', 120); sfx('whoosh', 400, 0.2, 'triangle', 0.05);
          return;
        }
        if (ty !== 'hit' || !d || !num(p) || p < 0 || p >= n || isSolo(p) || !num(d.i) || d.i % 1 !== 0 || d.i < 0 || d.i >= nShots + vec.length) return;
        var key = d.i * 10 + p;
        if (hitSet[key]) return;
        hitSet[key] = 1; hitsN++;
        var q = P[p], now = c.ahora(), mio = p === c.yo; q.stg = now + STG; q.hitN++; shake = mio ? 0.7 : 0.25; flash = mio ? 1 : 0.35;
        if (hitsN === HITS_GANA && hit3At < 0) hit3At = now;
        var sa = sobre(p, 4.2);
        S(GRITOS[Math.floor(c.fx() * GRITOS.length) % GRITOS.length], sa.x, sa.y, '#8fd8ff');
        if (v3) golpe3D(p, mio);
        else { var G = geom(), sb = scr(G, q.x, q.y - 30); SPAWN(sb.x, sb.y, 14, 'conf', ['#3fa9ff', '#8fd8ff', '#fff'], 300, 500, 0.8); SND(150, 0.25, 'sawtooth', 0.08, -90); }
      },
      /* un caído que vuelve a humano: retoma su sitio; una CPU recién tomada espera un poco antes de tirar (el xtiro del humano pudo quedar en camino) */
      alCpu: function (p) { plan[p] = { tgt: null, re: -9, dir: 0, dash: 0, errI: -2, ex: 0, ey: 0, toboT: 0 }; P[p].grace = c.ahora() + GRACIA_CPU; },
      alHum: function (p, o) { if (o && num(o.x) && num(o.y)) { P[p].x = o.x; P[p].y = o.y; } plan[p].tgt = null; },
      scores: function () {                                  // aditivo y comparable (M3 DM3-3): el ganador lo decide compara('1v3', …), no este archivo
        var out = [], p;
        for (p = 0; p < n; p++) out.push(isSolo(p) ? Math.min(hitsN * PTS_GOLPE, 90) : PTS_TRIO);   /* tope = scoreMax del catálogo */
        return out;
      },
      done: function () {                                    // fin temprano: 3 mojados (con su festejo) o la última bomba caída + margen para los `hit` en vuelo
        var now = c.ahora();
        if (hitsN >= HITS_GANA) return hit3At >= 0 && now >= hit3At + CELEBRA;
        if (nThrown() < nShots) return false;
        return now >= ultimaCae() + MARGEN_FIN;
      },
      hudChip: function (p) {
        if (isSolo(p)) return hitsN + '/' + HITS_GANA;
        return P[p].hitN ? '×' + P[p].hitN : 'SECO';
      },
      destacado: function () {
        var me = c.yo >= 0 ? c.yo : 0;
        if (isSolo(me)) return '¡' + hitsN + ' mojado' + (hitsN === 1 ? '' : 's') + '!';
        return P[me].hitN ? 'te mojaron ' + P[me].hitN + ' vez' + (P[me].hitN > 1 ? 'es' : '') : 'esquivaste todas las bombas';
      },
      vista: function () {                                   // observable para bancos y pruebas
        var now = c.ahora();
        return { gt: now, lv: lv, SPL: SPL, soloI: soloI, nShots: nShots, cd: cd, hits: hitsN, gana: hitsN >= HITS_GANA, tiros: shots.filter(Boolean).map(function (s) { return [s.i, s.x, s.y, s.tl]; }),
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), stg: P.map(function (q) { return q.stg; }), tj: P.map(function (q) { return q.tj; }),
          golpes: P.map(function (q) { return q.hitN; }), nextShot: P[soloI].nextShot, activos: activos(now).length, amago: !!amago(now),
          gotas: todas().filter(function (o) { return o.i < nShots; }).map(function (o) { return [o.i, o.id, o.x, o.y, o.tL]; }),
          fase: fase(now), tipos: shots.filter(Boolean).map(function (s) { return s.t; }), vecinos: vec.length, moj: P[soloI].moj, para: P.map(function (q) { return q.para; }), tobo: P.map(function (q) { return q.tobo; }),
          eventos: evs.map(function (e) { return [e.k, e.t0, e.tA, e.fin, e.y, e.dir]; }), ayudas: ayu.map(function (A) { return [A.tipo, A.t0, A.t1, A.x, A.y]; }), pegajosos: pegs.length, items: items.map(function (I) { return [I.tipo, I.t0, I.x, I.y, I.por, I.usado]; }) };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        dibujar2D();
      }
    };
    return g;
  }
});
})();
