'use strict';
/* LA FIESTA · EN VIVO · f_hallacas · ¡LA LÍNEA DE HALLACAS!  (2v2, modelo B: cada asiento es dueño de SU estación)   spec: docs/mario-party/M4-TEAMS-WAVE2.md
   Cocina de diciembre. Cada equipo tiene su línea: el MASERO (asiento de menor índice del equipo) extiende la masa y el AMARRADOR (el otro) pone el guiso y amarra.
   Una cinta de 3 puestos los une: el masero la llena, el amarrador la vacía; con la cinta llena el masero espera (y puede ayudar con B).

   MASERO  : mantener A = la masa crece; soltar A dentro de la franja verde = masa buena (el pedido de la tía marca el tamaño: lv1 uno, lv2-3 chica o grande). B = ayuda.
   AMARRADOR: stick = mueve el guiso sobre la hoja y A lo suelta sobre la marca roja; luego A cuando la bolita pasa por el centro de la regla (3 nudos; 4 en la 2.ª mitad del lv3). B = ayuda.
   AYUDA (B) : el ayudante deja su estación 0,5 s (queda congelado) y la estación del pana tiene +70 % de tolerancia durante 0,5 s; enfriamiento 2,2 s. Es la forma de repartir el trabajo.
   PUNTAJE (entero >=0 por asiento, M3 DM3-3; el veredicto sale SOLO de FIESTA.reglas.compara, que SUMA por equipo):
     masero = masas buenas que entregó a la cinta · amarrador = hallacas buenas bien amarradas (masa buena y <=1 error en guiso+nudos) menos 1 por cada mal amarrada (mínimo 0 al final).
     Una masa mala llega igual a la cinta, pero el amarrador la tira (0,5 s) y no puntúa. Con el masero ocioso la cinta queda vacía y el equipo no suma NADA;
     con el amarrador ocioso el masero se frena en 3 (cinta llena). Por eso ninguno de los dos puede cargar con todo el equipo.
   NO HAY VENTAJA DEL JUEZ: las dos líneas no comparten ningún objeto y cada estación la simula y la juzga su dueño; mismas hojas pedidas y mismas marcas del guiso para los dos equipos (c.rngFor('ord'|'spot')).
   RED (modelo B puro, tolerante a pérdida): NO hay mensajes x*. Todo lo que otro necesita va en el cuerpo `o` de cada asiento (12 Hz, "latest wins"), con CONTADORES acumulados:
     n = hojas entregadas (masero) o terminadas (amarrador), qa/qb = bits "masa buena" de las hojas 0-23 / 24-47, sc = puntaje, hb = ayudas pedidas, ph/v/x/y/kn = animación para verla EN VIVO.
     El amarrador ve la cinta con (n del masero - n propio); el masero ve el consumo con n del amarrador; la ayuda llega como un incremento de hb del pana. Un cuerpo perdido lo repone el siguiente.
     Los últimos 0,9 s no se acepta nada nuevo (FREEZE): así el juez ya tiene el último contador de cada asiento cuando cierra. Un humano caído pasa a CPU (alCpu) y retoma desde sus contadores.
   Perilla de balance (única): PERILLA.TOL_MASA = semiancho de la franja verde de la masa (fracción del tamaño). Todo lo demás (ritmos, CPU) se fijó antes de medir.
   Niveles: 1 un tamaño, cinta lenta · 2 dos tamaños (chica/grande) · 3 como el 2, un poco más rápido y con un nudo extra en los últimos segundos. Día / atardecer / noche.
   ESCALADA (por fracción de dur, sirve igual con dur 10): F1 calma (primer tercio) · F2 «¡SE PRENDIÓ LA COCINA!» (+ritmo, emergencias cada pocos segundos) ·
     F3 «¡ÚLTIMOS SEGUNDOS!» (último 28 %: más ritmo todavía, emergencias seguidas y LA TÍA PAGA DOBLE: la hallaca bien amarrada vale 2).
   EMERGENCIAS DE LA COCINA (agenda fija de c.rngFor('caos'): las MISMAS y a la misma hora para los dos equipos; aviso de 0,9 s; se atienden con B, que entonces no es ayuda):
     APAGÓN (los dos)   : 4 s sin luz: la franja verde, la marca roja y la regla no se ven. B = prender la vela y volver a ver.
     SE APAGÓ EL GAS (amarrador): el fogón de su olla se apaga y no puede agarrar hoja nueva hasta prenderlo: B tres veces (chispazos). Se prende solo a los 4,5 s.
     EL CARAJITO (amarrador): un chamo corre a robarse el guiso; B antes de que llegue = lo espantas. Si llega: se lleva el guiso (la hoja vuelve al paso del guiso) y quedas 1,4 s regañándolo.
     SE BOTA LA OLLA (masero): la olla hierve; B antes de que se desborde = bajas el fuego. Si se bota: la masa a medias se pierde y quedas 1,4 s limpiando.
     ¡LA TÍA PIDE MÁS! (los dos): 4,5 s en que la hallaca bien amarrada vale 2.
     Cada asiento juzga SU respuesta (modelo B): `e` del cuerpo = (última emergencia atendida + 1)·4 + chispazos; el castigo sale de la agenda y de `e`, igual en todas las pantallas.
   CPU: masero con retraso 0,3-0,6 s y error gaussiano del tamaño (según skill); amarrador con error gaussiano al apuntar y al tiempo del nudo; ayuda con B si su estación está parada.
   Sin Math.random / Date.now: azar de c.rngFor; lo cosmético de c.fx(). Dibujo solo con rr/ell/line/poly/txt + c.util.pj. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_hallacas')) return;

/* ───── la perilla (única) y las constantes ───── */
var PERILLA = { TOL_MASA: 0.1 };                                       // semiancho de la franja verde de la masa (0..1 del tamaño máximo)
var BELT = 3, NMAX = 48, FREEZE = 0.9, RES_T = 0.6, DISC_T = 0.5, LOCK_T = 0.4, MINSZ = 0.1;
var GROW = [0.38, 0.42, 0.46], TM = [1.4, 1.25, 1.15], WKV = [0.15, 0.15, 0.17], GR = 15, CR = 56, CUR = 130;
var HELP_DUR = 0.5, HELP_CD = 2.2, HELP_TOL = 1.7, HELP_SPD = 1.4;
var FASE2 = 1 / 3, FASE3 = 0.72, PACE = { 1: [1, 1.1, 1.22], 2: [1, 1.12, 1.28], 3: [1.05, 1.2, 1.35] };   // ritmo por nivel y fase
var FUEGO_T = 1.8, FUEGO_N = 2, TURRON_T = 3, AVISO = 0.9, LUZ_T = 4, GAS_T = 4.5, GAS_N = 3, NINO_T = 1.3, OLLA_T = 1.6, STUN_T = 1.4, TIA_T = 4.5, BONO = 2, CIEGO_CPU = 2.3;
var SC_MAX = 16, RATE = 0.45;                                          // = limites (el servidor recorta con estos topes)
var SIZES = [0.45, 0.75], SIZE1 = 0.6;
var FLICK_ON = true, FLICK_T = 1.3, DIRV = [[-1, 0], [1, 0], [0, -1], [0, 1]], DIRS = ['\u2190', '\u2192', '\u2191', '\u2193'], DIRANG = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];   // 2.ª acción: empujón del stick (onoto / aceitunas)
var INK = '#14101c', COL_EQ = ['#2f6fdb', '#d93a3a'];
var LW = 360, LH = 150, LGAP = 12, TOP = 76;
var PAL = {
  1: { pared: '#ffe9b8', pared2: '#f5d08a', mesa: '#b07a4a', mesa2: '#8a5a34', luz: null },
  2: { pared: '#f0b080', pared2: '#d98c5c', mesa: '#9a6a46', mesa2: '#74482c', luz: '#ffd23f' },
  3: { pared: '#3a3560', pared2: '#2b2748', mesa: '#7a5a46', mesa2: '#563a2c', luz: '#ffe27a' }
};
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
function SAY(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function tri(f) { f = f - Math.floor(f); return f < 0.5 ? 2 * f : 2 * (1 - f); }

FIESTA.LIVE.add('f_hallacas', {
  name: '¡LA LÍNEA DE HALLACAS!', modos: ['2v2'], clase: 'binary', modelo: 'B', dur: 45,
  stick: true, botones: 2, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 16, scoreRate: 0.45, minT: 44, finTemprano: 0 },
  cuerpo: ['ph', 'v', 'x', 'y', 'sc', 'n', 'qa', 'qb', 'hb', 'kn', 'e'], discretos: ['ph', 'sc', 'n', 'qa', 'qb', 'hb', 'kn', 'e'],
  perilla: PERILLA,
  carta: {
    obj: 'Saquen más hallacas buenas que el otro equipo. ¡Y atiendan las emergencias de la cocina con B!',
    gana: 'Suman los dos del equipo: masas buenas + hallacas bien amarradas (la mal amarrada resta 1; con la tía pagando doble valen 2). Más puntos gana.',
    como: { tactil: 'MASERO: mantén A y suelta en lo verde, luego empuja el joystick a la flecha (onoto) · AMARRADOR: joystick = guiso, A = soltar, empuja a la flecha (aceitunas) y A = nudos al ritmo · B = ayudar al pana o atender la emergencia (vela, gas, carajito, olla)', teclado: 'ESPACIO mantener/soltar o tocar · WASD o flechas = guiso · SHIFT = ayudar / emergencia' },
    roles: null,
    demos: [
      { id: 'compas', txt: 'Masero: mantén A, la masa crece; suelta cuando llegue a la franja verde' },
      { id: 'mover', txt: 'Amarrador: guiso sobre la marca roja, empuja el stick a la flecha, luego A cuando la bolita pase por el centro' },
      { id: 'compas', txt: '¡Emergencia! Apagón, gas, carajito u olla: atiéndela con B antes de que te frene' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], i, p, k, t;
    var TOL = PERILLA.TOL_MASA;
    /* equipos: 2v2 [0,0,1,1] por defecto; masero = asiento de menor índice del equipo, amarrador = el siguiente */
    var eq = [];
    var okEq = c.equipos && c.equipos.length === n;
    for (i = 0; i < n; i++) eq.push(okEq && (c.equipos[i] === 0 || c.equipos[i] === 1) ? c.equipos[i] : (i < 2 ? 0 : 1));
    var mas = [-1, -1], amar = [-1, -1], role = [], mate = [];
    for (i = 0; i < n; i++) {
      var tm = eq[i];
      if (mas[tm] < 0) { mas[tm] = i; role.push('m'); } else if (amar[tm] < 0) { amar[tm] = i; role.push('a'); } else role.push('');
    }
    for (i = 0; i < n; i++) mate.push(role[i] === 'm' ? amar[eq[i]] : role[i] === 'a' ? mas[eq[i]] : -1);

    /* pedidos y marcas del guiso: IGUALES para los dos equipos (misma suerte) */
    var ordR = c.rngFor('ord'), spR = c.rngFor('spot'), ORD = [], SPX = [], SPY = [], a0, r0;
    for (k = 0; k < NMAX + 2; k++) {
      ORD.push(lv === 1 ? SIZE1 : (ordR.next() < 0.5 ? SIZES[0] : SIZES[1]));
      a0 = spR.next() * Math.PI * 2; r0 = 12 + spR.next() * 28;
      SPX.push(Math.cos(a0) * r0); SPY.push(Math.sin(a0) * r0);
    }
    var dR = c.rngFor('dir'), dA = c.rngFor('dirA'), DIR = [], DIRA = [];
    for (k = 0; k < NMAX + 2; k++) { DIR.push(Math.floor(dR.next() * 4) % 4); DIRA.push(Math.floor(dA.next() * 4) % 4); }
    var cpuR = [], plan = [];
    function newPlan() { return { t0: -1, rel: -1, aim: null, tp: -1, dec: -9, helped: -9, evI: -1, evT: 0, evNo: false }; }
    for (i = 0; i < n; i++) { cpuR.push(c.rngFor('cpu' + i)); plan.push(newPlan()); }
    var asiento = function (q) { return (c.seats && c.seats[q]) || { name: 'P' + (q + 1), color: '#fff', ch: null }; };
    function gauss(R) { return (R.next() + R.next() + R.next() - 1.5) * 2; }

    /* estado por asiento: los campos del cuerpo llevan SU nombre (ph v x y sc n qa qb hb kn); los remotos se copian de c.remoto */
    var Q = [];
    for (i = 0; i < n; i++) Q.push({ ph: 0, v: 0, x: 0, y: 0, sc: 0, n: 0, qa: 0, qb: 0, hb: 0, kn: 0,
      pts: 0, ad: 0, arm: false, e: 0, eo: -1, ch: 0, chI: -1, pen: -1, sz: 0, pHeld: false, fUntil: 0, hUntil: 0, hcd: 0, bUntil: 0, seenHb: 0, lock: 0, pg: -1, knN: 0, mi: 0, K: 3, lastPh: 0, lastN: 0, bad: 0, flash: 0, sBien: 0, sMal: 0, sTira: 0, sMasaOk: 0, sPg: 0, sNudoMal: 0, tw: -1, tl: -1, sTur: 0 });
    var absT = 0, voz = {}, shake = 0, lastGag = -99;
    var G = function () { var f = c.campo(), w = f.x1 - f.x0; if (typeof gameLeft === 'function' && typeof gameRight === 'function') { f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 }; w = f.x1 - f.x0; } return { f: f, w: w, cx: (f.x0 + f.x1) / 2, k: Math.min(1.35, Math.max(0.4, (w - 8) / (LW + 8))) }; };

    function fase(now) { return now >= dur * FASE3 ? 3 : now >= dur * FASE2 ? 2 : 1; }
    function pace(now) { return PACE[lv][fase(now) - 1]; }
    function nudosK(now) { return lv === 3 && fase(now) === 3 ? 4 : 3; }

    /* ───── la agenda de emergencias (misma para todos: c.rngFor('caos')). Una a la vez; ta = aviso, t0 = empieza, tf = se cumple el castigo, t1 = termina;
       [w0, w1) = ventana para atenderla con B; rol = a quién le toca ('m', 'a', 'ma' o '' si no se atiende) ───── */
    var EV = [];
    (function () {
      var R = c.rngFor('caos'), t = Math.max(1.4, dur * 0.22), fin = dur - FREEZE - 0.3, ult = '', tipos, kk, e, intento;
      while (EV.length < 40) {
        var f = fase(t + AVISO);
        tipos = f === 1 ? ['olla', 'nino'] : f === 2 ? ['olla', 'nino', 'luz', 'gas', 'tia', 'fuego', 'turron'] : ['olla', 'nino', 'luz', 'gas', 'fuego', 'turron', 'fuego', 'turron'];
        kk = tipos[Math.floor(R.next() * tipos.length)];
        for (intento = 0; intento < 4 && kk === ult; intento++) kk = tipos[Math.floor(R.next() * tipos.length)];
        e = { i: EV.length, k: kk, ta: t, t0: t + AVISO };
        if (kk === 'luz') { e.tf = e.t0; e.t1 = e.t0 + LUZ_T; e.w0 = e.t0; e.w1 = e.t1; e.rol = 'ma'; }
        else if (kk === 'gas') { e.tf = e.t0; e.t1 = e.t0 + GAS_T; e.w0 = e.t0; e.w1 = e.t1; e.rol = 'a'; }
        else if (kk === 'nino') { e.tf = e.t0 + NINO_T; e.t1 = e.tf + STUN_T; e.w0 = e.ta; e.w1 = e.tf; e.rol = 'a'; }
        else if (kk === 'fuego') { e.tf = e.t0 + FUEGO_T; e.t1 = e.tf + STUN_T; e.w0 = e.ta + 0.2; e.w1 = e.tf; e.rol = 'a'; }
        else if (kk === 'turron') { e.tf = e.t0; e.t1 = e.t0 + TURRON_T; e.w0 = e.t0; e.w1 = e.t1; e.rol = 'ma'; }
        else if (kk === 'olla') { e.tf = e.t0 + OLLA_T; e.t1 = e.tf + STUN_T; e.w0 = e.ta + 0.3; e.w1 = e.tf; e.rol = 'm'; }
        else { e.tf = e.t0; e.t1 = e.t0 + TIA_T; e.w0 = e.w1 = -1; e.rol = ''; }
        if (e.t1 > fin) break;
        EV.push(e); ult = kk;
        t = e.t1 + (fase(e.t1) === 3 ? cl(dur * 0.05, 0.7, 1.8) : cl(dur * 0.12, 1.4, 5.2)) * (0.75 + 0.5 * R.next());
      }
    })();
    function evAt(now) { for (var j = 0; j < EV.length; j++) if (now >= EV[j].ta && now < EV[j].t1) return EV[j]; return null; }
    function toca(q, e) { return !!role[q] && e.rol.indexOf(role[q]) >= 0; }
    function resuelto(q, e) { return Q[q].eo >= e.i; }
    function responde(q, now) { var e = evAt(now); return e && toca(q, e) && !resuelto(q, e) && now >= e.w0 && now < e.w1 ? e : null; }
    function ciego(q, now) { var e = evAt(now); return !!e && e.k === 'luz' && now >= e.t0 && toca(q, e) && !resuelto(q, e); }
    function sinGas(q, now) { var e = evAt(now); return !!e && e.k === 'gas' && now >= e.t0 && toca(q, e) && !resuelto(q, e); }
    function aturdido(q, now) { var e = evAt(now); return !!e && (e.k === 'nino' || e.k === 'olla' || e.k === 'fuego') && now >= e.tf && toca(q, e) && !resuelto(q, e) ? e : null; }
    function bono(now) { var e = evAt(now); return fase(now) === 3 || (!!e && e.k === 'tia' && now >= e.t0); }
    function rivalTomo(q, e) { for (var j = 0; j < n; j++) if (role[j] === role[q] && eq[j] !== eq[q] && Q[j].eo >= e.i) return true; return false; }
    function packE(Z) { return (Z.eo + 1) * 4 + Math.min(3, Z.ch); }
    /* el letrero de arriba: la emergencia que me toca, si no el cambio de fase (2,5 s), si no la emergencia de los demás */
    var TXT_EV = {
      luz: ['¡SE VA LA LUZ…!', '¡APAGÓN! B = PRENDE LA VELA'], gas: ['¡EL FOGÓN CHISPORROTEA!', '¡SE APAGÓ EL GAS! AMARRADOR: B×3'],
      nino: ['¡UN CARAJITO VA POR EL GUISO! AMARRADOR: B', '¡SE LLEVÓ EL GUISO!'], olla: ['¡LA OLLA ESTÁ HIRVIENDO! MASERO: B', '¡SE BOTÓ LA OLLA!'],
      tia: ['¡AHÍ VIENE LA TÍA!', '¡LA TÍA PIDE MÁS! HALLACA ×2'],
      fuego: ['¡HUMO EN EL FOGÓN! AMARRADOR: B×2', '¡SE QUEMÓ EL GUISO!'], turron: ['¡LA TÍA REGALA TURRÓN!', '¡CARRERA! B = AGARRA EL TURRÓN ANTES QUE LOS RIVALES']
    };
    function banner(now, yo) {
      if (now < 0 || now >= dur - FREEZE) return null;
      var e = evAt(now), f = fase(now), tf = f === 3 ? dur * FASE3 : dur * FASE2, ev = null, mio = false;
      if (e) {
        mio = yo >= 0 && toca(yo, e);
        if (mio && e.k === 'turron' && resuelto(yo, e)) ev = Q[yo].tw === e.i ? { t: '¡TURRÓN TUYO! +1', col: '#5cff7a' } : { t: '¡SE LO LLEVARON LOS RIVALES!', col: '#ff6a4a' };
        else if (mio && resuelto(yo, e)) ev = { t: e.k === 'luz' ? '¡VELA PRENDIDA!' : e.k === 'gas' ? '¡FOGÓN PRENDIDO!' : e.k === 'nino' ? '¡CARAJITO ESPANTADO!' : e.k === 'fuego' ? '¡FUEGO APAGADO!' : '¡FUEGO BAJITO!', col: '#5cff7a' };
        else if (now < e.t0 && e.k !== 'turron') ev = { t: TXT_EV[e.k][0], col: mio ? '#ffd23f' : '#ffb07a' };
        else if (now < e.t0) ev = { t: TXT_EV[e.k][0], col: mio ? '#ffd23f' : '#ffb07a' };
        else if ((e.k === 'nino' || e.k === 'olla' || e.k === 'fuego') && now < e.tf) ev = { t: TXT_EV[e.k][0], col: mio ? '#ff6a4a' : '#ffb07a' };
        else if ((e.k === 'nino' || e.k === 'olla' || e.k === 'fuego') && !mio) ev = null;
        else ev = { t: TXT_EV[e.k][1], col: e.k === 'tia' ? '#ffd23f' : mio ? '#ff6a4a' : '#ffb07a' };
      }
      if (ev && mio) return ev;
      if (f > 1 && now - tf < 2.5) return { t: f === 3 ? '¡ÚLTIMOS SEGUNDOS! LA TÍA PAGA DOBLE' : '¡SE PRENDIÓ LA COCINA!', col: f === 3 ? '#ff5c8a' : '#ffd23f', fase: 1 };
      return ev;
    }
    function bitOf(Z, idx) { return idx < 24 ? ((Z.qa >> idx) & 1) : ((Z.qb >> (idx - 24)) & 1); }
    function boosted(q, now) { return now < Q[q].bUntil; }
    function packKn(Z) { return Z.knN + 8 * Z.mi + 64 * (Z.pg + 1); }

    function mirror(q, r) {
      var Z = Q[q], rn = Math.max(0, Math.round(r.n || 0)), re = Math.max(0, Math.round(r.e || 0));
      Z.hb = Math.max(Z.hb, Math.max(0, Math.round(r.hb || 0)));
      if ((re >> 2) - 1 > Z.eo) Z.eo = (re >> 2) - 1;
      Z.ch = re & 3; Z.e = packE(Z);
      /* los CONTADORES nunca retroceden: un cuerpo viejo (p. ej. el eco que quedó en el búfer de mi propio asiento cuando el juez me tomó como CPU
         por un tropiezo de red) traería un n menor y desharía hojas ya entregadas. n sube junto con sc, así que «mayor n gana» */
      if (rn < Z.n) return;
      Z.ph = r.ph | 0; Z.v = Math.round(r.v || 0); Z.x = Math.round(r.x || 0); Z.y = Math.round(r.y || 0); Z.sc = Math.max(0, Math.round(r.sc || 0)); Z.n = Math.max(0, Math.round(r.n || 0));
      Z.qa = Math.round(r.qa || 0); Z.qb = Math.round(r.qb || 0); Z.kn = Math.round(r.kn || 0);
      Z.pts = Z.sc; Z.sz = Z.v / 100;
      if (role[q] === 'a') { Z.knN = Z.kn & 7; Z.mi = (Z.kn >> 3) & 7; Z.pg = (Z.kn >> 6) - 1; }
    }

    /* la 2.ª acción de cada estación: un empujón del stick en la dirección que marca la flecha. 0 = esperando, 1 = acierto, -1 = falla (otra dirección o se acabó el tiempo) */
    function flickRead(q, Z, now, d) {
      if (now >= Z.fUntil) return -1;
      var e = c.eje(q), mag = Math.sqrt(e.x * e.x + e.y * e.y);
      if (!Z.arm) { if (mag < 0.35) Z.arm = true; return 0; }
      if (mag > 0.65) return (e.x * DIRV[d][0] + e.y * DIRV[d][1]) / mag > 0.7 ? 1 : -1;
      return 0;
    }
    function empiezaFlick(Z, now) { Z.ph = 6; Z.fUntil = now + FLICK_T / pace(now) + 0.15; Z.arm = false; }

    /* ───── una estación de MASERO (dueño: el asiento) ───── */
    function stepM(q, dt, now, held, bst) {
      var Z = Q[q], m = mate[q];
      if (Z.ph === 6) {                                                       // 2.ª acción: untar el onoto (empujón del stick); la masa buena sólo cuenta si lo logras
        var rf = flickRead(q, Z, now, DIR[Z.n]);
        if (rf !== 0) {
          if (rf > 0) { if (Z.n < 24) Z.qa |= (1 << Z.n); else Z.qb |= (1 << (Z.n - 24)); Z.sMasaOk++; Z.pts++; Z.bad = 0; Z.ph = 2; } else { Z.bad = 3; Z.ph = 3; }
          Z.n++; Z.sc = Math.max(0, Z.pts); Z.fUntil = now + RES_T; Z.flash = 1;
        }
        Z.pHeld = held; return;
      }
      if (Z.ph === 2 || Z.ph === 3) { if (now >= Z.fUntil) { Z.ph = 0; Z.sz = 0; Z.v = 0; } else { Z.pHeld = held; return; } }
      if (Z.ph === 1) {
        Z.sz = Math.min(1, Z.sz + GROW[lv - 1] * pace(now) * dt); Z.v = Math.round(Z.sz * 100);
        if (!held) {
          if (Z.sz < MINSZ) { Z.ph = 0; Z.sz = 0; Z.v = 0; }
          else {
            var idx = Z.n, tg = ORD[idx], tol = TOL * (bst ? HELP_TOL : 1), good = Math.abs(Z.sz - tg) <= tol;
            if (good && FLICK_ON) { empiezaFlick(Z, now); Z.bad = 0; }
            else if (good) { Z.sMasaOk++; if (idx < 24) Z.qa |= (1 << idx); else Z.qb |= (1 << (idx - 24)); Z.pts++; Z.bad = 0; Z.n++; Z.sc = Math.max(0, Z.pts); Z.ph = 2; Z.fUntil = now + RES_T; Z.flash = 1; }
            else { Z.bad = Z.sz < tg ? 1 : 2; Z.n++; Z.sc = Math.max(0, Z.pts); Z.ph = 3; Z.fUntil = now + RES_T; Z.flash = 1; }
          }
        }
        Z.pHeld = held; return;
      }
      var blocked = Z.n >= NMAX || (Z.n - (m >= 0 ? Q[m].n : 0) >= BELT);
      Z.ph = blocked ? 4 : 0;
      if (!blocked && held && !Z.pHeld) { Z.ph = 1; Z.sz = 0; Z.v = 0; }
      Z.pHeld = held;
    }

    /* ───── una estación de AMARRADOR ───── */
    function stepA(q, dt, now, ta, bst) {
      var Z = Q[q], m = mate[q], ex, ey;
      if (Z.ph === 3) { if (now >= Z.fUntil) { Z.n++; Z.ph = 0; Z.kn = 0; Z.knN = 0; Z.mi = 0; Z.pg = -1; } return; }
      if (Z.ph === 4 || Z.ph === 5) { if (now >= Z.fUntil) { Z.ph = 0; Z.kn = 0; Z.knN = 0; Z.mi = 0; Z.pg = -1; } return; }
      if (Z.ph === 0) {
        var avail = m >= 0 && Q[m].n > Z.n && Z.n < NMAX;
        if (!avail || sinGas(q, now)) return;                                 // sin gas no se agarra hoja nueva
        if (!bitOf(Q[m], Z.n)) { Z.sTira++; Z.ph = 3; Z.fUntil = now + DISC_T / pace(now); return; }
        Z.ph = 1; Z.x = 0; Z.y = 0; Z.pg = -1; Z.knN = 0; Z.mi = 0; Z.K = nudosK(now); Z.kn = packKn(Z);
        return;
      }
      if (Z.ph === 1) {
        var e = c.eje(q), sp = CUR * (bst ? HELP_SPD : 1);
        Z.x += e.x * sp * dt; Z.y += e.y * sp * dt;
        var d = Math.sqrt(Z.x * Z.x + Z.y * Z.y); if (d > CR) { Z.x *= CR / d; Z.y *= CR / d; }
        if (ta > 0) {
          var dd = Math.sqrt((Z.x - SPX[Z.n]) * (Z.x - SPX[Z.n]) + (Z.y - SPY[Z.n]) * (Z.y - SPY[Z.n]));
          Z.pg = dd <= GR * (bst ? HELP_TOL : 1) ? 1 : 0; if (FLICK_ON) empiezaFlick(Z, now); else { Z.ph = 2; Z.lock = now + LOCK_T; } Z.ad = 0; Z.knN = 0; Z.mi = 0;
        }
        Z.kn = packKn(Z); return;
      }
      if (Z.ph === 6) {                                                       // 2.ª acción: las aceitunas (empujón del stick)
        var rf = flickRead(q, Z, now, DIRA[Z.n]);
        if (rf !== 0) { Z.ad = rf > 0 ? 0 : 1; Z.ph = 2; Z.lock = now + LOCK_T; Z.knN = 0; Z.mi = 0; }
        Z.kn = packKn(Z); return;
      }
      if (Z.ph === 2) {
        var tm = TM[lv - 1] / pace(now), mk = tri(now / tm);
        Z.v = Math.round(mk * 100);
        if (ta > 0 && now >= Z.lock) {
          var hit = Math.abs(mk - 0.5) <= WKV[lv - 1] * (bst ? HELP_TOL : 1);
          Z.knN++; if (!hit) Z.mi++; Z.lock = now + LOCK_T;
          if (Z.knN >= Z.K) {
            var errs = Z.mi + Z.ad * 0.5 + (Z.pg === 1 ? 0 : 1), bien = errs <= 1;
            Z.pts += bien ? (bono(now) ? BONO : 1) : -1; if (bien) Z.sBien++; else Z.sMal++; if (Z.pg === 1) Z.sPg++; Z.sNudoMal += Z.mi; Z.sc = Math.max(0, Z.pts); Z.n++;
            Z.ph = bien ? 4 : 5; Z.fUntil = now + RES_T; Z.flash = 1;
          }
        }
        Z.kn = packKn(Z);
      }
    }

    function stepSeat(q, dt, now) {
      var Z = Q[q], held = c.held(q, 'a'), ta = c.tap(q, 'a'), tb = c.tap(q, 'b'), m = mate[q];
      if (now < 0) { Z.pHeld = held; return; }
      if (now >= dur - FREEZE) { Z.ph = 8; Z.pHeld = held; return; }
      if (m >= 0 && Q[m].hb > Z.seenHb) { Z.seenHb = Q[m].hb; Z.bUntil = now + HELP_DUR + 0.12; }
      if (Z.hUntil > now) { Z.ph = 7; Z.pHeld = held; return; }
      if (Z.ph === 7) Z.ph = 0;
      /* emergencia: B la atiende (y entonces no es ayuda) */
      var er = responde(q, now);
      if (Z.ch && !(er && (er.k === 'gas' || er.k === 'fuego') && er.i === Z.chI)) { Z.ch = 0; Z.e = packE(Z); }
      if (tb > 0 && er) {
        tb = 0;
        if (er.k === 'gas' || er.k === 'fuego') { if (Z.chI !== er.i) { Z.chI = er.i; Z.ch = 0; } Z.ch++; if (Z.ch >= (er.k === 'gas' ? GAS_N : FUEGO_N)) { Z.eo = er.i; Z.ch = 0; } }
        else if (er.k === 'turron') { if (rivalTomo(q, er)) Z.tl = er.i; else { Z.tw = er.i; Z.pts++; Z.sTur++; Z.sc = Math.max(0, Z.pts); Z.flash = 1; } Z.eo = er.i; }
        else Z.eo = er.i;
        Z.e = packE(Z);
      }
      var at = aturdido(q, now);
      if (at) {                                                               // el castigo: la olla se botó (masa a medias perdida) o el carajito se llevó el guiso
        if (Z.pen < at.i) {
          Z.pen = at.i;
          if (role[q] === 'm' && (Z.ph === 1 || Z.ph === 6)) { Z.ph = 0; Z.sz = 0; Z.v = 0; }
          if (role[q] === 'a' && (Z.ph === 2 || Z.ph === 6)) { Z.ph = 1; Z.knN = 0; Z.mi = 0; Z.pg = -1; Z.x = 0; Z.y = 0; Z.kn = packKn(Z); }
        }
        Z.pHeld = held; return;
      }
      var puede = role[q] === 'm' ? Z.ph !== 1 && Z.ph !== 2 && Z.ph !== 3 && Z.ph !== 6 : (Z.ph === 0 || Z.ph === 3 || Z.ph === 4 || Z.ph === 5);
      if (tb > 0 && m >= 0 && now >= Z.hcd && puede) {
        Z.hUntil = now + HELP_DUR; Z.hcd = now + HELP_DUR + HELP_CD; Z.hb++; Z.ph = 7; Z.pHeld = held; return;
      }
      var bst = now < Z.bUntil;
      if (role[q] === 'm') stepM(q, dt, now, held, bst); else if (role[q] === 'a') stepA(q, dt, now, ta, bst);
    }

    /* ───── CPU ───── */
    function nextCross(now, tm) {
      var f = (now / tm) - Math.floor(now / tm), df = f < 0.25 ? 0.25 - f : f < 0.75 ? 0.75 - f : 1.25 - f, tt = now + df * tm;
      if (tt < now + 0.07) tt += 0.5 * tm;
      return tt;
    }
    function quiereAyudar(q, now, pl, R, sk, api) {
      var Z = Q[q], m = mate[q];
      if (m < 0 || now < Z.hcd || Z.hUntil > now) return false;
      var Y = Q[m], ok = false, task = Y.n * 10 + Y.ph;
      if (role[q] === 'm') ok = Z.ph === 4 && Y.ph === 2;
      else ok = Z.ph === 0 && Y.ph === 1 && Y.v / 100 > ORD[Y.n] - 0.3 && Y.v / 100 < ORD[Y.n];
      if (!ok) return false;
      if (pl.dec !== task) { pl.dec = task; pl.helped = R.next() < 0.5 + 0.45 * sk ? 1 : 0; }
      if (pl.helped !== 1) return false;
      pl.helped = 0; api.press('b'); return true;
    }
    /* la CPU ante una emergencia: reacciona con retraso según su skill; a veces no la ve (carajito, olla) o no se molesta en prender la vela */
    function aiEv(q, now, api, pl, R, sk) {
      var e = responde(q, now);
      if (!e) return false;
      if (pl.evI !== e.i) {
        pl.evI = e.i; pl.evT = Math.max(now, e.w0) + 0.25 + 0.5 * (1 - sk) + 0.35 * R.next();
        pl.evNo = e.k === 'luz' ? R.next() > 0.35 + 0.55 * sk : e.k === 'gas' ? false : R.next() < 0.06 + 0.3 * (1 - sk);
      }
      if (pl.evNo) return false;
      if (now >= pl.evT) { api.press('b'); pl.evT = now + 0.15 + 0.12 * R.next(); }
      return true;
    }
    /* la CPU en la 2.ª acción: reacciona con retraso y a veces empuja para el lado equivocado (más a oscuras) */
    function aiFlick(q, now, api, pl, R, sk, d) {
      if (pl.fT === undefined || pl.fT < 0) { pl.fT = now + 0.2 + 0.35 * (1 - sk) + 0.2 * R.next(); pl.fBad = R.next() < (0.02 + 0.12 * (1 - sk)) * (ciego(q, now) ? 3 : 1); }
      if (now < pl.fT) { api.eje(0, 0); return; }
      var dd = pl.fBad ? (d + 1) % 4 : d;
      api.eje(DIRV[dd][0], DIRV[dd][1]);
    }
    function aiM(q, dt, api, now) {
      var Z = Q[q], pl = plan[q], R = cpuR[q], sk = c.skill[q], bl = ciego(q, now) ? CIEGO_CPU : 1;
      if (Z.ph !== 6) pl.fT = -1;
      if (Z.ph === 6) { api.hold('a', false); aiFlick(q, now, api, pl, R, sk, DIR[Z.n]); return; }
      if (!aiEv(q, now, api, pl, R, sk) && quiereAyudar(q, now, pl, R, sk, api)) return;
      if (Z.ph === 1) {
        if (pl.rel < 0) pl.rel = cl(ORD[Z.n] + gauss(R) * (0.155 - 0.12 * sk) * bl, 0.15, 1);
        if (Z.sz >= pl.rel - GROW[lv - 1] * pace(now) * dt * 0.5) { api.hold('a', false); pl.rel = -1; } else api.hold('a', true);
        return;
      }
      if (Z.ph === 0) {
        if (pl.t0 < 0) pl.t0 = now + 0.3 + 0.3 * R.next() + (R.next() < 0.04 * (1 - sk) ? 1 : 0);
        if (now >= pl.t0) { api.hold('a', true); pl.t0 = -1; pl.rel = -1; } else api.hold('a', false);
        return;
      }
      api.hold('a', false); pl.t0 = -1; pl.rel = -1;
    }
    function aiA(q, dt, api, now) {
      var Z = Q[q], pl = plan[q], R = cpuR[q], sk = c.skill[q], bl = ciego(q, now) ? CIEGO_CPU : 1;
      if (Z.ph !== 6) pl.fT = -1;
      if (Z.ph === 6) { aiFlick(q, now, api, pl, R, sk, DIRA[Z.n]); return; }
      if (!aiEv(q, now, api, pl, R, sk) && quiereAyudar(q, now, pl, R, sk, api)) return;
      if (Z.ph === 1) {
        if (!pl.aim) {
          var sg = (14 - 10 * sk) * bl, ax = SPX[Z.n] + gauss(R) * sg, ay = SPY[Z.n] + gauss(R) * sg, ar = Math.sqrt(ax * ax + ay * ay);
          if (ar > CR - 4) { ax *= (CR - 4) / ar; ay *= (CR - 4) / ar; }                     // el cursor no sale del círculo CR: la puntería debe poder alcanzarse
          pl.aim = { x: ax, y: ay }; pl.t0 = now + 0.2 + 0.25 * R.next() * (1.4 - sk); pl.tmo = now + 2.5;
        }
        var dx = pl.aim.x - Z.x, dy = pl.aim.y - Z.y;
        api.eje(cl(dx / 10, -1, 1), cl(dy / 10, -1, 1));
        if (now >= pl.t0 && ((Math.abs(dx) < 3.5 && Math.abs(dy) < 3.5) || now >= pl.tmo)) { api.eje(0, 0); api.press('a'); pl.aim = null; pl.tp = -1; }
        return;
      }
      api.eje(0, 0);
      if (Z.ph === 2) {
        var tm = TM[lv - 1] / pace(now);
        if (pl.tp < 0) pl.tp = nextCross(Math.max(now, Z.lock), tm) + gauss(R) * (0.11 - 0.07 * sk) * bl;
        if (now >= pl.tp && now >= Z.lock) { api.press('a'); pl.tp = -1; }
        return;
      }
      pl.aim = null; pl.tp = -1;
    }

    /* ───── dibujo ───── */
    function leaf(x, y, w, h, col) { ell(x, y, w, h, col || '#3f9a4a', 3); line([[x - w * 0.8, y], [x + w * 0.8, y]], 1.6, '#2a6a32'); }
    function persona(q, x, y, h, anim) {
      var s = asiento(q);
      c.util.pj(s.ch, x, y, h, { animo: anim || null, sombra: false });
    }
    function lineaDraw(team, y0, big, now, yo) {
      var m = mas[team], a = amar[team], Zm = m >= 0 ? Q[m] : null, Za = a >= 0 ? Q[a] : null, tot = 0, j;
      for (j = 0; j < n; j++) if (eq[j] === team) tot += Q[j].sc;
      ctx.save(); ctx.translate(0, y0);
      rr(0, 0, LW, LH, 10, pal.pared, 3.5); rr(0, 92, LW, 58, 8, pal.pared2, 0);
      if (pal.luz) for (j = 0; j < 9; j++) ell(20 + j * 40, 28 + Math.sin(absT * 3 + j) * 1.5, 4, 4, pal.luz, 1.5);
      rr(0, 0, LW, 22, 8, COL_EQ[team], 3);
      txt(team === eq[yo >= 0 ? yo : 0] ? 'TU EQUIPO' : 'RIVALES', 62, 11, 13, '#fffdf2', 0, true);
      txt(String(tot), LW - 30, 11, 18, '#fffdf2', 0, true);
      /* masero */
      rr(4, 70, 112, 50, 8, pal.mesa, 3); rr(4, 108, 112, 12, 6, pal.mesa2, 2.5);
      if (Zm) {
        persona(m, 60, 42, 40, Zm.ph === 2 ? 'celebrar' : Zm.ph === 3 ? 'perder' : null);
        var sz = (Zm.ph === 1 || Zm.ph === 2 || Zm.ph === 3 || Zm.ph === 6) ? Zm.v / 100 : 0;
        leaf(60, 88, 38, 13); if (sz > 0) ell(60, 88, 6 + sz * 30, 3 + sz * 9, Zm.ph === 3 ? '#b89a60' : '#f6dc8c', 2);
        var tg = ORD[Math.min(Zm.n, NMAX)], tol = TOL, cgM = ciego(m, now);
        rr(10, 106, 100, 9, 4, '#3a2f2a', 2); if (!cgM) rr(10 + (tg - tol) * 100, 106, tol * 200, 9, 4, '#5cd06a', 0);
        if (sz > 0) { var ok = Math.abs(sz - tg) <= tol; rr(10, 106, Math.max(2, sz * 100), 9, 4, ok ? '#fff6b0' : '#ff9a5a', 0); line([[10 + sz * 100, 103], [10 + sz * 100, 118]], 2.5, '#fffdf2'); }
        var atM = aturdido(m, now);
        txt(atM ? '¡SE BOTÓ LA OLLA!' : cgM ? 'B: PRENDE LA VELA' : Zm.ph === 6 ? '¡ONOTO! EMPUJA ' + DIRS[DIR[Math.min(Zm.n, NMAX)]] : Zm.ph === 4 ? '¡CINTA LLENA!' : Zm.ph === 7 ? '¡AYUDANDO!' : Zm.ph === 8 ? '¡TIEMPO!' : 'MASA ' + (lv === 1 ? '' : tg < 0.5 ? 'CHICA' : 'GRANDE'), 60, 66, 10, Zm.ph === 4 ? '#ff6a4a' : '#5a3a28', 0, true);
        txt((m === yo ? 'TÚ' : String(asiento(m).name || '').slice(0, 7)) + ' · ' + Zm.sc, 60, 135, 11, m === yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (Zm.ph === 2) txt('¡BUENA!', 60, 76, 13, '#2c8a3a', 0, true); else if (Zm.ph === 3) txt(Zm.bad === 1 ? '¡CORTA!' : Zm.bad === 3 ? '¡SIN ONOTO!' : '¡PASADA!', 60, 76, 13, '#c0392b', 0, true);
      }
      /* cinta de 3 puestos */
      var np = Zm && Za ? cl(Zm.n - Za.n, 0, BELT) : 0;
      rr(122, 90, 116, 22, 6, '#5a4a3c', 3);
      for (j = 0; j < 8; j++) line([[128 + j * 14 + ((absT * 20) % 14), 92], [128 + j * 14 + ((absT * 20) % 14), 110]], 1.4, '#7a6a58');
      for (j = 0; j < BELT; j++) {
        var sx = 143 + j * 36;
        rr(sx - 14, 93, 28, 16, 4, 'rgba(20,16,28,.25)', 0);
        if (j < np && Zm && Za) { var good = bitOf(Zm, Za.n + j) === 1; leaf(sx, 101, 12, 6, good ? '#3f9a4a' : '#8a7a5a'); ell(sx, 101, 6, 3, good ? '#f6dc8c' : '#9a8a70', 1.5); }
      }
      poly([[176, 78], [184, 78], [180, 85]], '#fffdf2', 2);
      var nx = Zm ? ORD[Math.min(Zm.n, NMAX)] : SIZE1;
      txt('PIDE:', 150, 66, 10, '#5a3a28', 0, true); leaf(186, 66, 6 + nx * 20, 5 + nx * 7);
      /* amarrador */
      rr(244, 70, 112, 50, 8, pal.mesa, 3); rr(244, 108, 112, 12, 6, pal.mesa2, 2.5);
      if (Za) {
        persona(a, 300, 42, 40, Za.ph === 4 ? 'celebrar' : Za.ph === 5 ? 'perder' : null);
        var tieneH = Za.ph === 1 || Za.ph === 2 || Za.ph === 4 || Za.ph === 5 || Za.ph === 3 || Za.ph === 6;
        var hi = Za.ph === 4 || Za.ph === 5 ? Za.n - 1 : Za.n, bg = Zm ? bitOf(Zm, Math.max(0, hi)) : 1;
        if (tieneH) {
          leaf(300, 88, 46, 22, Za.ph === 3 ? '#6a7a5a' : '#3f9a4a'); ell(300, 88, 30, 13, bg ? '#f6dc8c' : '#9a8a70', 2);
          if (Za.ph === 1 && !ciego(a, now)) { var tx = 300 + SPX[Za.n] * 0.8, ty = 88 + SPY[Za.n] * 0.5; ell(tx, ty, 8, 5, 'rgba(230,50,50,.55)', 1.5); ell(300 + Za.x * 0.8, 88 + Za.y * 0.5, 4, 3, '#ff3b4e', 2); }
          else if (Za.pg === 1 || Za.pg === 0) { ell(300 + SPX[Math.max(0, hi)] * 0.8, 88 + SPY[Math.max(0, hi)] * 0.5, 7, 4, '#9a3a2a', 1.5); }
        }
        rr(250, 106, 100, 9, 4, '#3a2f2a', 2); if (!ciego(a, now)) rr(250 + 50 - WKV[lv - 1] * 100, 106, WKV[lv - 1] * 200, 9, 4, '#5cd06a', 0);
        if (Za.ph === 2) ell(250 + Za.v, 110.5, 6, 6, '#ffd23f', 2);
        var KK = Za.ph === 2 || Za.ph === 4 || Za.ph === 5 ? nudosK(now) : 3;
        for (j = 0; j < KK; j++) ell(254 + j * 13, 31, 4.5, 4.5, j < Za.knN ? '#fffdf2' : 'rgba(20,16,28,.3)', 1.5);
        txt(aturdido(a, now) ? '¡SE LLEVÓ EL GUISO!' : sinGas(a, now) ? 'SIN GAS: B×' + (GAS_N - Za.ch) : ciego(a, now) ? 'B: PRENDE LA VELA' : Za.ph === 6 ? '¡ACEITUNAS! EMPUJA ' + DIRS[DIRA[Math.min(Za.n, NMAX)]] : Za.ph === 0 ? 'ESPERANDO HOJA' : Za.ph === 3 ? '¡MASA MALA!' : Za.ph === 7 ? '¡AYUDANDO!' : Za.ph === 8 ? '¡TIEMPO!' : Za.ph === 1 ? 'GUISO' : Za.ph === 2 ? 'NUDOS' : '', 300, 66, 9, '#5a3a28', 0, true);
        txt((a === yo ? 'TÚ' : String(asiento(a).name || '').slice(0, 7)) + ' · ' + Za.sc, 300, 135, 11, a === yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (Za.ph === 4) txt('¡BIEN AMARRADA!', 306, 31, 10, '#2c8a3a', 0, true); else if (Za.ph === 5) txt('¡MAL AMARRADA! -1', 306, 31, 10, '#c0392b', 0, true);
      }
      ctx.restore();
    }

    function dibujar2D() {
      var now = c.ahora(), Gm = G(), yo = c.yo, myT = yo >= 0 && eq[yo] !== undefined ? eq[yo] : 0, f = Gm.f, s, ys, hint;
      var sx = Math.sin(absT * 90) * shake * 3;
      ctx.save(); ctx.translate(sx, 0);
      rr(f.x0, 0, f.x1 - f.x0, 600, 0, pal.pared2, 0);
      ctx.save(); ctx.translate(Gm.cx, TOP); ctx.scale(Gm.k, Gm.k); ctx.translate(-LW / 2, -TOP);
      lineaDraw(myT, TOP, true, now, yo);
      lineaDraw(1 - myT, TOP + LH + LGAP, false, now, yo);
      var eL = evAt(now);
      if (eL && eL.k === 'luz' && now >= eL.t0) rr(0, TOP, LW, 2 * LH + LGAP, 10, 'rgba(10,8,30,.45)', 0);   // el apagón
      ys = TOP + 2 * LH + LGAP + 14;
      hint = role[yo] === 'a' ? 'STICK: guiso sobre la marca roja · A soltar · STICK a la flecha (aceitunas) · A nudos · B: emergencia' : role[yo] === 'm' ? 'MANTÉN A y suelta en lo VERDE · STICK a la flecha (onoto) · B: emergencia o ayudar' : 'Mira las dos líneas';
      txt(hint, LW / 2, ys, 10, '#fffdf2', 0, true);
      var ban = banner(now, yo);
      if (ban) txt(ban.t, LW / 2, TOP - 8, 15, ban.col, 0, true);
      if (now >= dur - FREEZE && now < dur + 3) txt('¡TIEMPO!', LW / 2, TOP + LH, 26, '#fffdf2', 0, true);
      ctx.restore();
      ctx.restore();
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): el patio de la casa en diciembre. Dos mesones largos (tu equipo adelante, los rivales atrás),
       cada uno con el masero a la izquierda, la cinta en el medio y el amarrador a la derecha. Solo dibujo: lee Q y no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var TOPY = 1.25, MX = -5.3, AX = 5.0, LZ = [2.4, -5.2], PJZ = -1.9, BELT_X0 = -3.3, BELT_X1 = 2.9;
    var PAL3 = {
      1: { cielo: ['#7ec8ff', '#fff1d0'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#fff1d0', piso: '#e6d2b0', piso2: '#c9a985', pared: '#ffe9b8', zoc: '#c4783a', luzI: .15, noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', piso: '#dcb890', piso2: '#b98f66', pared: '#f0b080', zoc: '#a85a2a', luzI: .7, noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', piso: '#8a7a90', piso2: '#6a5a72', pared: '#6a5f90', zoc: '#4a3a5a', luzI: 1.9, noche: 1 }
    };
    var BOMB = ['#ff3b4e', '#ffd23f', '#3fd06a', '#3fa9ff', '#ff8a3d', '#d06aff'];
    var CONF3 = ['#ff3b4e', '#ffd23f', '#3fd06a', '#3fa9ff', '#fffdf2'];
    function RM(s) { return 0.12 + s * 0.8; }                                // radio de la masa del masero según su tamaño (0..1)
    function HXa(x) { return AX + x * 0.016; }                               // el guiso: px del círculo CR -> metros sobre la hoja del amarrador
    function HZa(L, y) { return L.z - 0.3 + y * 0.011; }
    function pista3D() {
      /* gaita zuliana: menor, con la furruca de la tambora; i–iv–VII–V en La menor. En los últimos segundos, la misma gaita a la carrera */
      var AC = [[57, 60, 64], [50, 53, 57], [55, 59, 62], [52, 56, 59]], MEL = [76, 0, 76, 74, 72, 0, 74, 76, 77, 0, 76, 74, 72, 0, 0, 0, 71, 0, 72, 74, 76, 0, 74, 72, 71, 0, 68, 0, 69, 0, 0, 0];
      V3.pista('hallacas', { bpm: 122, acordes: AC, mel: MEL });
      V3.pista('hallacas-loca', { bpm: 152, acordes: AC, mel: [76, 76, 74, 76, 77, 0, 76, 74, 72, 74, 76, 0, 79, 0, 77, 76, 74, 0, 72, 74, 76, 74, 72, 71, 72, 0, 69, 71, 72, 0, 76, 0] });
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 55, 140], fov: 32 });
      if (!esc) return null;
      pista3D();
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      var yo = c.yo, myT = yo >= 0 && (eq[yo] === 0 || eq[yo] === 1) ? eq[yo] : 0;
      /* piso de baldosas del patio (en cuadros, sin pintar canvas) */
      var piso = new T.Mesh(new T.PlaneGeometry(90, 60), tn(pl.piso)); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      var bal = new T.PlaneGeometry(1.9, 1.9);
      for (j = 0; j < 12; j++) for (k = 0; k < 18; k++) if ((j + k) % 2) { var b0 = new T.Mesh(bal, tn(pl.piso2)); b0.rotation.x = -Math.PI / 2; b0.position.set(-17 + k * 2, .01, -12 + j * 2); b0.receiveShadow = true; S3.add(b0); }
      /* la casa: pared del fondo, puerta, ventanas (de noche encendidas), alero de tejas */
      var pared = M(new T.BoxGeometry(44, 7.5, 1), pl.pared, { recibe: true, g: .01 }); pared.position.set(0, 3.75, -12.5); S3.add(pared);
      var zoc = M(new T.BoxGeometry(44.1, 1, 1.05), pl.zoc, { borde: false, recibe: true }); zoc.position.set(0, .5, -12.5); S3.add(zoc);
      var alero = M(new T.CylinderGeometry(.01, 2.4, 44.6, 3, 1), '#c4563a', { g: .02 }); alero.rotation.z = Math.PI / 2; alero.scale.set(1, 1, .5); alero.position.set(0, 7.9, -12.2); S3.add(alero);
      var puerta = M(new T.BoxGeometry(2.4, 4, .2), '#7a4a2a', { g: .03 }); puerta.position.set(0, 2, -11.95); S3.add(puerta);
      var ventanas = [];
      [-14, -8, 8, 14].forEach(function (vx) {
        var v = M(new T.BoxGeometry(2.2, 2, .2), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : (lv === 2 ? '#ff9a4a' : null), emI: pl.noche ? .9 : .25 }); v.position.set(vx, 3.6, -11.95); S3.add(v); ventanas.push(v);
        var rj = M(new T.BoxGeometry(2.4, .12, .3), '#2a2a34', { borde: false }); rj.position.set(vx, 4.65, -11.85); S3.add(rj);
      });
      /* el mecate con hojas de plátano secándose (se mecen solas) */
      var hojasT = [], hojaG = new T.PlaneGeometry(1.1, 1.6);
      S3.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-6, 5.6, -11.6), new T.Vector3(-2, 5.2, -11.6), new T.Vector3(2, 5.2, -11.6), new T.Vector3(6, 5.6, -11.6)]), 20, .03, 4), tn(INK)));
      for (k = 0; k < 8; k++) { var hp = new T.Group(); hp.position.set(-5.2 + k * 1.5, 5.3 - Math.sin((k + .5) / 8 * Math.PI) * .35, -11.5); S3.add(hp);
        var hj = new T.Mesh(hojaG, new T.MeshToonMaterial({ color: k % 2 ? '#3f9a4a' : '#2f8a3c', side: T.DoubleSide, gradientMap: tn('#fff').gradientMap })); hj.position.y = -.8; hj.castShadow = true; hp.add(hj); hojasT.push(hp); }
      /* el arbolito de Navidad con su estrella y bombitas */
      var arbol = new T.Group(); arbol.position.set(-14.5, 0, -9); S3.add(arbol);
      var mat0 = M(new T.CylinderGeometry(.35, .35, .8, 7), '#8a5a30'); mat0.position.y = .4; arbol.add(mat0);
      for (k = 0; k < 3; k++) { var cono = M(new T.ConeGeometry(2.2 - k * .55, 2.2, 8), k % 2 ? '#2f8a3c' : '#3f9a4a', { g: .03 }); cono.position.y = 1.7 + k * 1.3; arbol.add(cono); }
      var estrella = M(new T.OctahedronGeometry(.45, 0), '#ffd23f', { em: '#ffb000', emI: pl.noche ? 1.6 : .4, g: .06 }); estrella.position.y = 5.6; arbol.add(estrella);
      var bombas = [];
      for (k = 0; k < 14; k++) { var ang = k * 2.4, hh = .3 + (k % 5) * .2, rr0 = 1.9 - hh * .9;
        var bm = new T.Mesh(new T.SphereGeometry(.16, 6, 4), tn(BOMB[k % BOMB.length], { em: BOMB[k % BOMB.length], emI: pl.luzI, nuevo: true }));
        bm.position.set(Math.cos(ang) * rr0, 1.2 + hh * 4, Math.sin(ang) * rr0); arbol.add(bm); bombas.push(bm); }
      /* el fogón con la olla grande de las hallacas (bota vapor) y la tía revolviendo */
      var fog = M(new T.BoxGeometry(3.4, 1.1, 2.2), '#a8563a', { recibe: true }); fog.position.set(13, .55, -9.5); S3.add(fog);
      var olla = M(new T.CylinderGeometry(1.1, .95, 1.4, 12), '#8a8a96', { g: .03 }); olla.position.set(13, 1.85, -9.5); S3.add(olla);
      var tapa = M(new T.CylinderGeometry(1.15, 1.15, .1, 12), '#6a6a76'); tapa.position.set(13.3, 2.6, -9.5); tapa.rotation.z = .35; S3.add(tapa);
      var fuego = new T.Mesh(new T.ConeGeometry(.5, 1, 6), tn('#ff8a3d', { em: '#ff5a1a', emI: 1.2 })); fuego.position.set(13, 1.1, -8.35); S3.add(fuego);
      var tia = V3.PJ.crear('abuela', { prop: false, escala: 1.25 }); tia.g.position.set(10.6, 0, -9.3); S3.add(tia.g);
      /* matas en materos a los lados */
      [[-18, -4], [18, -4], [-18, 4], [18, 5]].forEach(function (r) {
        var mt = M(new T.CylinderGeometry(.7, .5, 1, 8), '#c4563a'); mt.position.set(r[0], .5, r[1]); S3.add(mt);
        var fl = M(new T.IcosahedronGeometry(1.1, 0), '#3fae4a', { g: .03 }); fl.position.set(r[0], 1.7, r[1]); S3.add(fl);
      });
      /* las luces de Navidad: tres guirnaldas de bombillitos que titilan */
      var luces = [];
      function guirnalda(a0, a1, n2, caida) {
        var pts = [], i2;
        for (i2 = 0; i2 <= 20; i2++) { var u = i2 / 20; pts.push(new T.Vector3(a0.x + (a1.x - a0.x) * u, a0.y + (a1.y - a0.y) * u - Math.sin(u * Math.PI) * caida, a0.z + (a1.z - a0.z) * u)); }
        var cur = new T.CatmullRomCurve3(pts); S3.add(new T.Mesh(new T.TubeGeometry(cur, 30, .03, 4), tn('#1f3a1f')));
        for (i2 = 0; i2 < n2; i2++) {
          var p2 = cur.getPoint((i2 + .5) / n2), col = BOMB[i2 % BOMB.length];
          var bo = new T.Mesh(new T.SphereGeometry(.14, 6, 4), tn(col, { em: col, emI: pl.luzI, nuevo: true })); bo.position.copy(p2); bo.position.y -= .12; bo.scale.set(1, 1.4, 1); S3.add(bo); luces.push(bo);
        }
      }
      var po1 = M(new T.CylinderGeometry(.12, .15, 6.5, 6), '#5a3a22'); po1.position.set(-11, 3.25, 6); S3.add(po1);
      var po2 = M(new T.CylinderGeometry(.12, .15, 6.5, 6), '#5a3a22'); po2.position.set(11, 3.25, 6); S3.add(po2);
      guirnalda(new T.Vector3(-21, 7.3, -11.9), new T.Vector3(21, 7.3, -11.9), 34, .7);
      guirnalda(new T.Vector3(-11, 6.4, 6), new T.Vector3(-6, 7.3, -11.8), 14, 1.1);
      guirnalda(new T.Vector3(11, 6.4, 6), new T.Vector3(6, 7.3, -11.8), 14, 1.1);
      var luzF = null;
      if (lv >= 2) { luzF = new T.PointLight(0xff9a40, pl.noche ? 1.4 : .5, 16, 2); luzF.position.set(13, 3, -7.5); S3.add(luzF); }
      var luzM = null, luzA = null;
      if (pl.noche) { luzM = new T.PointLight(0xffd890, 1.1, 26, 2); luzM.position.set(0, 7, 0); S3.add(luzM);
        luzA = new T.PointLight(0xff8aa0, .7, 18, 2); luzA.position.set(-14.5, 4, -7); S3.add(luzA); }

      /* los dos mesones: [0] = tu equipo (adelante), [1] = los rivales (atrás) */
      var lineas = [];
      function barra(x, z, conBola) {                                       // la regla plana sobre el mesón: base, franja verde, relleno y marca/bolita
        var g3 = new T.Group(); g3.position.set(x, TOPY + .02, z); S3.add(g3);
        var base = M(new T.BoxGeometry(2.4, .08, .34), '#3a2f2a', { g: .04 }); g3.add(base);
        var zona = new T.Mesh(new T.BoxGeometry(1, .09, .28), tn('#5cd06a', { em: '#2a8a3a', emI: .4 })); zona.position.y = .01; g3.add(zona);
        var lleno = new T.Mesh(new T.BoxGeometry(1, .1, .2), tn('#fff6b0', { nuevo: true })); lleno.position.y = .02; g3.add(lleno);
        var marca = M(conBola ? new T.SphereGeometry(.17, 8, 6) : new T.BoxGeometry(.07, .22, .4), conBola ? '#ffd23f' : '#fffdf2', { g: .08 }); marca.position.y = .1; g3.add(marca);
        return { g: g3, zona: zona, lleno: lleno, marca: marca };
      }
      function flechaDir(x, z) {                                             // la flecha grande de la 2.ª acción (onoto / aceitunas): se gira hacia donde hay que empujar el stick
        var g3 = new T.Group(); g3.position.set(x, TOPY + .75, z); g3.visible = false; S3.add(g3);
        var cn = new T.Mesh(new T.ConeGeometry(.55, 1.1, 4), tn('#ffd23f', { em: '#ffb000', emI: 1.1 })); cn.rotation.x = Math.PI / 2; g3.add(cn);
        var cb = M(new T.BoxGeometry(.3, .2, .8), '#ffd23f', { g: .1 }); cb.position.z = -.8; g3.add(cb);
        return g3;
      }
      function hoja(sx, sz) { var h = M(new T.CylinderGeometry(1, 1, .05, 8), '#3f9a4a', { g: .03, recibe: true }); h.scale.set(sx, 1, sz); return h; }
      function aroBrillo(x, z, r) {
        var a = new T.Mesh(new T.RingGeometry(r, r + .14, 28), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .85, depthWrite: false }));
        a.rotation.x = -Math.PI / 2; a.position.set(x, TOPY + .2, z); a.visible = false; S3.add(a); return a;
      }
      for (var s = 0; s < 2; s++) {
        var team = s === 0 ? myT : 1 - myT, z0 = LZ[s], L = { s: s, team: team, z: z0 };
        var mesa = M(new T.BoxGeometry(17, .25, 2.7), '#9a6a46', { recibe: true, g: .015 }); mesa.position.set(0, TOPY - .14, z0); S3.add(mesa);
        var mantel = M(new T.BoxGeometry(17.2, .06, 2.8), COL_EQ[team], { borde: false, recibe: true }); mantel.position.set(0, TOPY - .02, z0); S3.add(mantel);
        var falda = M(new T.BoxGeometry(17.2, .55, .05), V3.oscurecer(COL_EQ[team], .8), { borde: false }); falda.position.set(0, TOPY - .3, z0 + 1.4); S3.add(falda);
        [[-8, -1.1], [8, -1.1], [-8, 1.1], [8, 1.1]].forEach(function (r) { var pa = M(new T.BoxGeometry(.25, TOPY - .25, .25), '#74482c', { g: .03 }); pa.position.set(r[0], (TOPY - .25) / 2, z0 + r[1]); S3.add(pa); });
        /* masero: el lebrillo de masa, la hoja, la masa que crece y el aro verde del pedido */
        var leb = M(new T.CylinderGeometry(.75, .55, .5, 10), '#c4783a'); leb.position.set(MX - 2.1, TOPY + .25, z0 - .4); S3.add(leb);
        var lebM = M(new T.SphereGeometry(.62, 10, 6), '#f2d27a', { borde: false }); lebM.scale.set(1, .35, 1); lebM.position.set(MX - 2.1, TOPY + .5, z0 - .4); S3.add(lebM);
        var hM = hoja(1.2, .98); hM.position.set(MX, TOPY + .03, z0 - .3); S3.add(hM);
        var masaMat = tn('#f2d27a', { nuevo: true });
        var masa = M(new T.CylinderGeometry(1, 1, .12, 16), null, { mat: masaMat, g: .04 }); masa.position.set(MX, TOPY + .1, z0 - .3); masa.visible = false; S3.add(masa);
        var aros = {};
        [SIZE1, SIZES[0], SIZES[1]].forEach(function (tg) { [1, HELP_TOL].forEach(function (km) {
          var r0 = RM(tg - TOL * km), r1 = RM(tg + TOL * km);
          var ar = new T.Mesh(new T.RingGeometry(r0, r1, 32), new T.MeshBasicMaterial({ color: 0x5cd06a, transparent: true, opacity: .7, depthWrite: false }));
          ar.rotation.x = -Math.PI / 2; ar.position.set(MX, TOPY + .19, z0 - .3); ar.visible = false; S3.add(ar); aros[tg + '|' + km] = ar;
        }); });
        L.masa = masa; L.masaMat = masaMat; L.aros = aros; L.dirM = flechaDir(MX, z0 - .3); L.barM = barra(MX, z0 + .95, false); L.brM = aroBrillo(MX, z0 - .3, 1.15);
        /* la cinta: banda oscura, rodillos que corren y 4 lugares con hoja y masa que se deslizan hacia el amarrador */
        var banda = M(new T.BoxGeometry(BELT_X1 - BELT_X0, .14, 1.1), '#3a3a44', { g: .03 }); banda.position.set((BELT_X0 + BELT_X1) / 2, TOPY + .08, z0 - .3); S3.add(banda);
        var rayas = [];
        for (k = 0; k < 8; k++) { var ry = new T.Mesh(new T.BoxGeometry(.06, .02, 1.05), tn('#6a6a78')); ry.position.set(BELT_X0, TOPY + .16, z0 - .3); S3.add(ry); rayas.push(ry); }
        var items = [];
        for (k = 0; k < 4; k++) {
          var it = new T.Group(); it.visible = false; S3.add(it);
          var ih = M(new T.BoxGeometry(1.1, .05, .8), '#3f9a4a', { g: .05 }); it.add(ih);
          var im = M(new T.CylinderGeometry(.32, .32, .1, 10), '#f2d27a', { g: .06 }); im.position.y = .07; it.add(im);
          it.userData = { idx: -1, x: BELT_X0, h: ih, m: im }; items.push(it);
        }
        var flechaC = M(new T.ConeGeometry(.22, .5, 4), '#fffdf2', { g: .08 }); flechaC.rotation.z = -Math.PI / 2; flechaC.position.set(BELT_X1 + .35, TOPY + .25, z0 - .3); S3.add(flechaC);
        L.rayas = rayas; L.items = items;
        /* amarrador: hoja grande, masa, la marca roja, el cucharón con guiso, el guiso puesto, los pabilos y la regla de los nudos */
        var hA = hoja(1.45, 1.0); hA.position.set(AX, TOPY + .03, z0 - .3); hA.visible = false; S3.add(hA);
        var masaAMat = tn('#f2d27a', { nuevo: true });
        var masaA = M(new T.CylinderGeometry(1, 1, .1, 16), null, { mat: masaAMat, g: .04 }); masaA.scale.set(1.05, 1, .72); masaA.position.set(AX, TOPY + .1, z0 - .3); masaA.visible = false; S3.add(masaA);
        var marcaR = new T.Mesh(new T.RingGeometry(GR * .016 * .65, GR * .016, 24), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .9, depthWrite: false }));
        marcaR.rotation.x = -Math.PI / 2; marcaR.visible = false; S3.add(marcaR);
        var marcaX = new T.Mesh(new T.CircleGeometry(GR * .016 * .65, 20), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .3, depthWrite: false }));
        marcaX.rotation.x = -Math.PI / 2; marcaX.visible = false; S3.add(marcaX);
        var cuchara = new T.Group(); cuchara.visible = false; S3.add(cuchara);
        var cu1 = M(new T.SphereGeometry(.22, 8, 6), '#8a8a96', { g: .06 }); cu1.scale.set(1, .5, 1); cuchara.add(cu1);
        var cu2 = M(new T.SphereGeometry(.17, 8, 6), '#a8462a', { borde: false }); cu2.scale.set(1, .45, 1); cu2.position.y = .08; cuchara.add(cu2);
        var cu3 = M(new T.CylinderGeometry(.04, .04, 1.2, 5), '#8a8a96', { g: .1 }); cu3.position.set(.35, .45, -.2); cu3.rotation.set(-.4, 0, -.6); cuchara.add(cu3);
        var guiso = new T.Group(); guiso.visible = false; S3.add(guiso);
        var gu = M(new T.SphereGeometry(.28, 9, 6), '#a8462a', { g: .05 }); gu.scale.set(1, .35, .8); guiso.add(gu);
        [['#6a8a2a', .12, .06], ['#3a2030', -.1, .08], ['#fff2c0', .02, -.12]].forEach(function (r) { var b1 = M(new T.SphereGeometry(.06, 5, 4), r[0], { borde: false }); b1.position.set(r[1], .09, r[2]); guiso.add(b1); });
        var cuerdas = [];
        for (k = 0; k < 4; k++) { var cd = M(new T.BoxGeometry(.06, .05, 1.35), '#fffdf2', { g: .1 }); cd.position.set(AX - .75 + k * .5, TOPY + .2, z0 - .3); cd.visible = false; S3.add(cd); cuerdas.push(cd); }
        var nudoOn = tn('#fffdf2'), nudoOff = tn('#3a2f2a'), nudos = [];
        for (k = 0; k < 4; k++) { var nd = M(new T.SphereGeometry(.12, 7, 5), null, { mat: nudoOff, g: .08 }); nd.position.set(AX - .55 + k * .37, TOPY + .12, z0 + .62); nd.visible = false; S3.add(nd); nudos.push(nd); }
        /* la hallaca amarrada (el paquete) que vuela a la olla, y la pila de hallacas buenas en la olla */
        var paq = new T.Group(); paq.visible = false; S3.add(paq);
        var pq = M(new T.BoxGeometry(1, .34, .7), '#3f9a4a', { g: .05 }); paq.add(pq);
        [-.25, .25].forEach(function (dx) { var pc = M(new T.BoxGeometry(.05, .36, .72), '#fffdf2', { borde: false }); pc.position.x = dx; paq.add(pc); });
        var pcx = M(new T.BoxGeometry(1.02, .36, .05), '#fffdf2', { borde: false }); paq.add(pcx);
        var ollaP = M(new T.CylinderGeometry(.7, .6, .7, 12), '#8a8a96', { g: .03 }); ollaP.position.set(AX + 2.4, TOPY + .35, z0 - .2); S3.add(ollaP);
        var pila = [];
        for (k = 0; k < 10; k++) { var pp = M(new T.BoxGeometry(.5, .17, .35), k % 2 ? '#3f9a4a' : '#2f8a3c', { g: .06 }); pp.position.set(AX + 2.4 + (k % 2 ? .13 : -.13), TOPY + .78 + Math.floor(k / 2) * .19, z0 - .2 + (k % 3 - 1) * .08); pp.rotation.y = k * .7; pp.visible = false; S3.add(pp); pila.push(pp); }
        L.hA = hA; L.masaA = masaA; L.masaAMat = masaAMat; L.marcaR = marcaR; L.marcaX = marcaX; L.cuchara = cuchara; L.guiso = guiso; L.cuerdas = cuerdas;
        L.dirA = flechaDir(AX, z0 - .3); L.nudos = nudos; L.nudoOn = nudoOn; L.nudoOff = nudoOff; L.paq = paq; L.paqT = -9; L.paqBien = 1; L.pila = pila; L.barA = barra(AX, z0 + .95, true); L.brA = aroBrillo(AX, z0 - .3, 1.55);
        /* emergencias: la vela de cada estación (solo las de tu mesón alumbran de verdad), la olla del masero que hierve,
           la hornilla bajo la olla del amarrador (el gas) y el carajito que viene por el guiso */
        var vela = function (x, z, conLuz) {
          var g3 = new T.Group(); g3.position.set(x, TOPY, z); g3.visible = false; S3.add(g3);
          var pl0 = M(new T.CylinderGeometry(.22, .26, .06, 10), '#c9c9d6'); pl0.position.y = .03; g3.add(pl0);
          var cv = M(new T.CylinderGeometry(.09, .09, .45, 8), '#fff6e0', { g: .05 }); cv.position.y = .28; g3.add(cv);
          var ll = new T.Mesh(new T.ConeGeometry(.08, .22, 6), tn('#ffd23f', { em: '#ffb000', emI: 2 })); ll.position.y = .62; g3.add(ll);
          var lz = null; if (conLuz) { lz = new T.PointLight(0xffb040, 0, 7, 2); lz.position.y = .9; g3.add(lz); }
          return { g: g3, llama: ll, luz: lz };
        };
        L.velaM = vela(MX + 1.45, z0 + .95, s === 0); L.velaA = vela(AX - 1.55, z0 + .95, s === 0);
        var ollaM = new T.Group(); ollaM.position.set(MX - 2.1, TOPY, z0 + .85); S3.add(ollaM);
        var om = M(new T.CylinderGeometry(.42, .36, .55, 12), '#8a8a96', { g: .04 }); om.position.y = .28; ollaM.add(om);
        var omT = M(new T.CylinderGeometry(.46, .46, .07, 12), '#5a5a66', { g: .05 }); omT.position.y = .6; ollaM.add(omT);
        var omA = M(new T.SphereGeometry(.08, 6, 4), '#2a2a34', { borde: false }); omA.position.y = .1; omT.add(omA);
        var esp = M(new T.CylinderGeometry(.5, .44, .14, 12), '#fffdf2', { borde: false }); esp.position.y = .6; esp.visible = false; ollaM.add(esp);
        L.ollaM = ollaM; L.ollaTapa = omT; L.espuma = esp; L.ollaI = -1;
        var hornilla = new T.Group(); hornilla.position.set(AX + 2.4, TOPY + .02, z0 - .2); S3.add(hornilla);
        var hr = M(new T.TorusGeometry(.68, .06, 5, 16), '#2a2a34', { g: .02 }); hr.rotation.x = Math.PI / 2; hornilla.add(hr);
        var llamas = new T.Group(); hornilla.add(llamas);
        for (k = 0; k < 6; k++) { var lla = new T.Mesh(new T.ConeGeometry(.09, .26, 5), tn('#5ab0ff', { em: '#2a6aff', emI: 1.4 })); lla.position.set(Math.cos(k * 1.047) * .68, .12, Math.sin(k * 1.047) * .68); llamas.add(lla); }
        L.llamas = llamas; L.gasCh = 0; L.gasI = -1;
        var fgo = new T.Group(); fgo.position.set(AX, TOPY, z0 - .3); fgo.visible = false; S3.add(fgo);
        for (k = 0; k < 5; k++) { var fl2 = new T.Mesh(new T.ConeGeometry(.28, .9, 5), tn(k % 2 ? '#ff8a3d' : '#ffd23f', { em: '#ff4a1a', emI: 1.5 })); fl2.position.set(-.9 + k * .45, .45, (k % 2 - .5) * .5); fgo.add(fl2); }
        L.fuegoG = fgo;
        var trr = new T.Group(); trr.position.set(0, TOPY + .5, z0 - .3); trr.visible = false; S3.add(trr);
        var tb = M(new T.BoxGeometry(1.2, .35, .7), '#f2d27a', { g: .06 }); trr.add(tb);
        var tc = M(new T.BoxGeometry(1.25, .1, .75), '#c4563a', { g: .06 }); tc.position.y = .22; trr.add(tc);
        L.turron = trr;
        var nino = V3.PJ.crear('pana', { prop: false, escala: .8 }); nino.g.visible = false; S3.add(nino.g);
        L.nino = { pj: nino, x: AX + 11, z: z0 - 2.15, st: 0, i: -1, px: AX + 11 };
        lineas.push(L);
      }
      /* los jugadores: detrás de su estación, mirando a la cámara */
      var pjs = [];
      for (k = 0; k < n; k++) {
        if (!role[k]) { pjs.push(null); continue; }
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }), sl = eq[k] === myT ? 0 : 1, bx = role[k] === 'm' ? MX : AX;
        S3.add(pj.g);
        pjs.push({ pj: pj, sl: sl, bx: bx, x: bx, z: LZ[sl] + PJZ, px: bx, ph: Q[k].ph, knN: 0, mi: 0, hb: Q[k].hb, bocT: -9, fin: 0 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      esc.encuadrar(22, 14.5, new T.Vector3(0, 1.3, -1.6), .8);
      return V3.ultimo = { esc: esc, myT: myT, lineas: lineas, pjs: pjs, part: part, flecha: flecha, luces: luces, bombas: bombas, estrella: estrella, fuego: fuego, luzF: luzF,
        hojasT: hojasT, tia: tia, vapT: 0, boost: [0, 0, 0, 0, 0, 0, 0, 0], tiaT: -9, finT: -1, ventanas: ventanas,
        luz0: { hemi: esc.luces.hemi.intensity, sol: esc.luces.sol.intensity, f: luzF ? luzF.intensity : 0, m: luzM ? luzM.intensity : 0, a: luzA ? luzA.intensity : 0 },
        luzM: luzM, luzA: luzA, oscuro: 1, fase: 1, evI: -1, evP: -1, eoV: [-1, -1, -1, -1, -1, -1, -1, -1], humoT: 0 };
    }
    function Kde(q) { return c.mio(q) ? Q[q].K : nudosK(c.ahora()); }   // nudos de la hoja actual (el remoto no manda K: sale del reloj)
    function ordDe(Z) { return ORD[Math.max(0, Math.min((Z.ph === 2 || Z.ph === 3) ? Z.n - 1 : Z.n, NMAX))]; }   // con el resultado en pantalla, el pedido es el de la masa recién entregada
    function totEq(t) { var s = 0, j; for (j = 0; j < n; j++) if (eq[j] === t) s += Q[j].sc; return s; }
    function suena(q, k) { if (eq[q] === v3.myT) V3.sfx(k); }                // los sonidos de la línea propia (los rivales se ven, no se oyen)
    function cambio3D(q, s3, de, a, now) {
      var V = v3, L = V.lineas[s3.sl], pj = s3.pj, x, z;
      if (role[q] === 'm') {
        x = MX; z = L.z - .3;
        if (a === 2) { pj.uno('saltar'); suena(q, 'pop'); V.part.soltar(x, TOPY + .4, z, 14, { k: 'chispa', cols: ['#ffd23f', '#fff6b0', '#5cd06a'], vel: 3, arriba: 3, vida: .6 }); }
        else if (a === 3) { pj.uno('golpe'); suena(q, 'error'); V.part.soltar(x, TOPY + .3, z, 12, { k: 'gota', cols: ['#b89a60', '#8a7a5a'], vel: 2.5, arriba: 2.5, vida: .6 }); if (q === c.yo) V.esc.sacudir(.4); }
        else if (a === 4 && de !== 4 && absT - s3.bocT > 4) { s3.bocT = absT; suena(q, 'bocina'); }
      } else if (role[q] === 'a') {
        x = AX; z = L.z - .3;
        if (a === 2) {
          var Za = Q[q], gx = HXa(Za.x), gz = HZa(L, Za.y);
          V.part.soltar(gx, TOPY + .3, gz, 10, { k: 'gota', cols: ['#a8462a', '#c4563a', '#6a8a2a'], vel: 1.8, arriba: 2, vida: .5, esc: .8 });
          suena(q, Za.pg === 1 ? 'pop' : 'resbalon');
        } else if (a === 3) { pj.uno('lanzar'); suena(q, 'caida'); V.part.soltar(x, TOPY + .4, z, 16, { k: 'gota', cols: ['#9a8a70', '#6a7a5a', '#b89a60'], vel: 4, arriba: 4, vida: .7 }); }
        else if (a === 4) { pj.uno('festejo'); suena(q, 'moneda'); L.paqT = absT; L.paqBien = 1; V.part.soltar(x, TOPY + .6, z, 18, { k: 'confeti', cols: CONF3, vel: 3, arriba: 4, g: 6, vida: 1 }); }
        else if (a === 5) { pj.uno('golpe'); suena(q, 'golpe'); L.paqT = absT; L.paqBien = 0; V.part.soltar(x, TOPY + .4, z, 20, { k: 'gota', cols: ['#f2d27a', '#a8462a', '#3f9a4a'], vel: 4, arriba: 3.5, vida: .7 }); V.esc.sacudir(q === c.yo ? 1 : .3); }
      }
      if (a === 7) { suena(q, 'whoosh'); V.part.soltar(s3.x, 2, s3.z, 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 2, arriba: 2, vida: .5 }); }
    }
    /* las emergencias en un mesón: velas, la olla que hierve, la hornilla del gas y el carajito */
    function emerg3D(V, L, m, a, e, dt, now) {
      var t = absT, k;
      var luzOn = !!e && e.k === 'luz' && now >= e.t0, vs = [L.velaM, L.velaA], qs = [m, a];
      for (k = 0; k < 2; k++) {
        var vv = vs[k], qq = qs[k], on = luzOn && qq >= 0 && resuelto(qq, e);
        vv.g.visible = !!on;
        if (on) vv.llama.scale.set(1 + Math.sin(t * 23 + k) * .15, 1 + Math.sin(t * 17 + k) * .25, 1);
        if (vv.luz) vv.luz.intensity = on ? 1.6 + Math.sin(t * 19 + k) * .2 : 0;
      }
      /* la olla del masero: la tapa brinca cada vez más; si nadie baja el fuego, se bota la espuma */
      var hier = !!e && e.k === 'olla' && m >= 0, ok = hier && resuelto(m, e), bota = hier && !ok && now >= e.tf;
      var amp = hier && !ok && !bota ? cl((now - e.ta) / (e.tf - e.ta), 0, 1) : 0, ox = L.ollaM.position.x, oz = L.ollaM.position.z;
      L.ollaTapa.position.y = .6 + amp * Math.abs(Math.sin(t * 30)) * .14; L.ollaTapa.rotation.z = amp * Math.sin(t * 27) * .18;
      if (amp > 0 && c.fx() < amp * .6) V.part.soltar(ox + (c.fx() - .5) * .5, TOPY + .75, oz + (c.fx() - .5) * .5, 1, { k: 'gota', cols: ['#ffffff', '#e8f4ff'], vel: .5, arriba: 1.6, g: 1, vida: .6, esc: .8 });
      L.espuma.visible = bota;
      if (bota) { var ue = cl((now - e.tf) / .4, 0, 1); L.espuma.scale.set(1 + ue * .5, 1 + ue * 2, 1 + ue * .5); }
      if (bota && L.ollaI !== e.i) {
        L.ollaI = e.i; suena(m, 'splash'); V.part.soltar(ox, TOPY + .6, oz, 24, { k: 'gota', cols: ['#fffdf2', '#f2e8c0'], vel: 3, arriba: 2, vida: .8 });
        if (m === c.yo) V.esc.sacudir(.7);
        if (V.pjs[m]) V.pjs[m].pj.uno('golpe');
      }
      /* la hornilla del amarrador: llamitas azules; sin gas, humito y chispazos con cada B */
      var sg = a >= 0 && sinGas(a, now), chN = a >= 0 ? Q[a].ch : 0;
      L.llamas.visible = !sg; if (!sg) L.llamas.scale.set(1, .8 + .3 * Math.abs(Math.sin(t * 15)), 1);
      if (sg && c.fx() < dt * 6) V.part.soltar(AX + 2.4, TOPY + .4, L.z - .2, 1, { k: 'gota', cols: ['#9a9aa6', '#6a6a76'], vel: .3, arriba: .8, g: -1, vida: 1.2, esc: 1.2, suelo: false });
      if (sg && chN > L.gasCh) { V.part.soltar(AX + 3, TOPY + .2, L.z - .2, 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#5ab0ff'], vel: 2.5, arriba: 1.5, vida: .35 }); suena(a, 'chispa'); }
      L.gasCh = chN;
      if (e && e.k === 'gas' && a >= 0 && resuelto(a, e) && L.gasI !== e.i) { L.gasI = e.i; suena(a, 'whoosh'); V.part.soltar(AX + 2.4, TOPY + .3, L.z - .2, 14, { k: 'chispa', cols: ['#5ab0ff', '#ffd23f'], vel: 3, arriba: 2, vida: .5 }); }
      var fe = !!e && e.k === 'fuego' && a >= 0, fOn = fe && !resuelto(a, e) && now >= e.ta;
      L.fuegoG.visible = fOn; if (fOn) { var fa = 1 + (now >= e.tf ? .6 : 0); L.fuegoG.scale.set(fa, fa * (.8 + .3 * Math.abs(Math.sin(t * 15))), fa); if (c.fx() < dt * 8) V.part.soltar(AX, TOPY + 1.2, L.z - .3, 1, { k: 'gota', cols: ['#6a6a76', '#3a3a44'], vel: .4, arriba: 1, g: -1, vida: 1, esc: 1.2, suelo: false }); }
      var te = !!e && e.k === 'turron' && now >= e.t0 && m >= 0 && a >= 0;
      L.turron.visible = te && !(resuelto(m, e) && resuelto(a, e)); if (te) { L.turron.position.y = TOPY + .6 + Math.sin(t * 6) * .12; L.turron.rotation.y = t * 2; }
      /* el carajito: entra corriendo por la derecha hacia el guiso; espantado sale en carrera, y si llega se lleva el guiso */
      var N = L.nino, nj = N.pj, viene = !!e && e.k === 'nino' && a >= 0;
      if (viene && N.i !== e.i) { N.i = e.i; N.st = 1; N.x = N.px = AX + 11; }
      if (N.st === 1) {
        if (!viene) N.st = 2;
        else if (resuelto(a, e)) { N.st = 2; nj.uno('saltar'); }
        else if (now >= e.tf) {
          N.st = 3; nj.uno('festejo'); suena(a, 'golpe');
          V.part.soltar(AX, TOPY + .3, L.z - .3, 14, { k: 'gota', cols: ['#a8462a', '#c4563a', '#6a8a2a'], vel: 3, arriba: 3, vida: .6 });
          if (a === c.yo) V.esc.sacudir(.6);
        } else N.x = AX + 11 - 9.5 * cl((now - e.ta) / (e.tf - e.ta), 0, 1);
      }
      if (N.st >= 2) { N.x += (N.st === 3 ? 6 : 9) * dt; if (N.x > AX + 12) N.st = 0; }
      nj.g.visible = N.st > 0;
      if (N.st > 0) {
        var vx = (N.x - N.px) / Math.max(dt, 1e-3); N.px = N.x;
        nj.anim(N.st === 3 ? 'cargar' : Math.abs(vx) > .5 ? 'correr' : 'quieto', { vel: 1 }).cara(N.st === 2 ? 'susto' : 'feliz').rumbo(vx < -.1 ? -Math.PI / 2 : Math.PI / 2).update(dt);
        nj.g.position.set(N.x, 0, N.z);
      }
    }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, k, q, fin = now >= dur - FREEZE, sl;
      V.part.update(dt);
      /* lo que se mueve solo: luces que titilan, hojas en el mecate, vapor de la olla, fuego, la tía */
      var pl = PAL3[lv];
      /* fase y emergencia actuales (sonido, sacudida y luces); todo sale de la agenda EV y de los `eo` (igual en todas las pantallas) */
      var fz = now < 0 ? 1 : fase(now), eN = now >= 0 && !fin ? evAt(now) : null;
      if (fz !== V.fase) {
        V.fase = fz;
        if (now > 0 && !fin) { V.esc.sacudir(.8); V3.sfx('tambor'); V.tia.uno('festejo'); V.tiaT = t; V.part.soltar(0, 5, -1, 40, { k: 'confeti', cols: CONF3, vel: 5, arriba: 4, g: 5, vida: 1.6 }); }
      }
      if (eN && eN.i !== V.evI) {
        V.evI = eN.i; V.evP = 0;
        V3.sfx(eN.k === 'luz' ? 'chispa' : eN.k === 'gas' ? 'viento' : eN.k === 'nino' ? 'silbido' : eN.k === 'olla' ? 'latido' : 'silbato');
        if (eN.k === 'tia') { V.tiaT = t; V.tia.uno('festejo'); }
      }
      if (eN && V.evP === 0 && now >= eN.t0) {
        V.evP = 1;
        if (eN.k === 'luz') { V3.sfx('trueno'); V.esc.sacudir(.5); }
        else if (eN.k === 'gas') V3.sfx('error');
        else if (eN.k === 'tia') { V3.sfx('aplauso'); for (sl = 0; sl < 2; sl++) V.part.soltar(AX + 2.4, TOPY + 1, V.lineas[sl].z - .2, 16, { k: 'confeti', cols: ['#ffd23f', '#ffb000', '#fff6b0'], vel: 3, arriba: 4, g: 6, vida: 1 }); }
      }
      for (q = 0; q < n; q++) if (Q[q].eo > V.eoV[q]) { if (now > 0 && eq[q] === V.myT) V3.sfx('ding'); V.eoV[q] = Q[q].eo; }
      /* el apagón: todo se oscurece (parpadea durante el aviso) y vuelve poco a poco */
      var oscO = 1;
      if (eN && eN.k === 'luz') oscO = now >= eN.t0 ? .16 : (Math.sin(t * 37) > .3 ? .35 : 1);
      V.oscuro += (oscO - V.oscuro) * Math.min(1, dt * (oscO < V.oscuro ? 30 : 4));
      var ko = V.oscuro, l0 = V.luz0, rapido = fz === 3 ? 2.4 : fz === 2 ? 1.5 : 1;
      V.esc.luces.hemi.intensity = l0.hemi * ko; V.esc.luces.sol.intensity = l0.sol * ko;
      if (V.luzM) V.luzM.intensity = l0.m * ko;
      if (V.luzA) V.luzA.intensity = l0.a * ko;
      for (k = 0; k < V.luces.length; k++) V.luces[k].material.emissiveIntensity = ko < .5 ? 0 : pl.luzI * (Math.sin(t * 2.6 * rapido + k * 1.9) > -.2 ? 1 : .25);
      for (k = 0; k < V.bombas.length; k++) V.bombas[k].material.emissiveIntensity = pl.luzI * (.55 + .45 * Math.sin(t * 3 + k));
      V.estrella.rotation.y = t * 1.2;
      for (k = 0; k < V.hojasT.length; k++) V.hojasT[k].rotation.x = Math.sin(t * 1.6 + k * .9) * .18;
      V.fuego.scale.set(1 + Math.sin(t * 17) * .12, 1 + Math.sin(t * 13 + 1) * .25, 1);
      if (V.luzF) V.luzF.intensity = (pl.noche ? 1.4 : .5) * (.85 + .15 * Math.sin(t * 19));
      V.vapT -= dt; if (V.vapT < 0) { V.vapT = .22; V.part.soltar(13 + (c.fx() - .5) * 1.2, 2.8, -9.5 + (c.fx() - .5) * .8, 1, { k: 'gota', cols: ['#ffffff', '#f2f2f2'], vel: .3, arriba: .4, g: -1.3, vida: 1.6, esc: 1.5, suelo: false }); }
      var tiaGrita = V.tiaT >= 0 && t - V.tiaT < 3;
      V.tia.anim(tiaGrita ? 'saludar' : fin ? 'celebrar' : 'bailar').cara(tiaGrita ? 'enojado' : 'feliz').rumbo(tiaGrita ? .5 : -1.2 + Math.sin(t * .7) * .3).update(dt);
      /* las ayudas (B): el hb del ayudante sube => la estación del pana brilla 0,6 s */
      for (q = 0; q < n; q++) { var s3 = V.pjs[q]; if (!s3) continue; if (Q[q].hb > s3.hb) { s3.hb = Q[q].hb; if (mate[q] >= 0) V.boost[mate[q]] = t + HELP_DUR + .1; } }
      /* fin: el equipo que va ganando celebra, el otro se pone triste */
      var tA = totEq(V.myT), tB = totEq(1 - V.myT), ganaT = tA === tB ? -1 : (tA > tB ? V.myT : 1 - V.myT);
      if (fin && V.finT < 0) { V.finT = t; V3.sfx('aplauso'); if (ganaT >= 0) V.part.soltar(0, 4, LZ[ganaT === V.myT ? 0 : 1], 60, { k: 'confeti', cols: CONF3, vel: 5, arriba: 5, g: 5, vida: 2 }); }
      /* los jugadores */
      for (q = 0; q < n; q++) {
        var S = V.pjs[q]; if (!S) continue;
        var Z = Q[q], pj = S.pj, L = V.lineas[S.sl];
        if (role[q] === 'a' && Z.knN > S.knN && (Z.ph === 2 || Z.ph === 4 || Z.ph === 5)) {   // un nudo nuevo: jalón del pabilo
          var falla = Z.mi > S.mi; pj.uno('lanzar'); suena(q, falla ? 'resbalon' : 'tic');
          V.part.soltar(AX - .75 + (Z.knN - 1) * .5, TOPY + .3, L.z - .3, falla ? 6 : 8, { k: 'chispa', cols: falla ? ['#ff3b4e', '#3a2f2a'] : ['#fffdf2', '#ffd23f'], vel: 2, arriba: 2, vida: .45 });
        }
        S.knN = Z.knN; S.mi = Z.mi;
        if (Z.ph !== S.ph) { if (now >= 0 && !fin) cambio3D(q, S, S.ph, Z.ph, now); S.ph = Z.ph; }
        /* la ayuda: corre hacia la estación del pana y vuelve */
        var tx = Z.ph === 7 ? S.bx + (role[q] === 'm' ? 2.6 : -2.6) : S.bx, dx = tx - S.x, lim = 13 * dt;
        S.x += Math.abs(dx) > lim ? (dx > 0 ? lim : -lim) : dx;
        var v = (S.x - S.px) / Math.max(dt, 1e-3); S.px = S.x;
        var an = 'quieto', ca = 'normal', ve = 1, mx = 0, my = 0;
        if (fin && now > 0) { an = ganaT < 0 ? 'bailar' : eq[q] === ganaT ? 'celebrar' : 'triste'; ca = ganaT < 0 || eq[q] === ganaT ? 'feliz' : 'triste';
          if (!S.fin) { S.fin = 1; if (eq[q] === ganaT) pj.uno('festejo'); } }
        else if (now < 0) { an = q === c.yo ? 'saludar' : 'quieto'; ca = 'feliz'; }
        else if (Math.abs(v) > 1) { an = 'correr'; ve = Math.min(1, Math.abs(v) / 10); ca = 'concentrado'; }
        else if (aturdido(q, now)) { an = role[q] === 'm' ? 'mojado' : 'saludar'; ca = role[q] === 'm' ? 'mareado' : 'enojado'; mx = role[q] === 'm' ? 0 : .8; }
        else if (role[q] === 'a' && sinGas(q, now)) { an = 'empujar'; ve = 1; ca = 'concentrado'; mx = .8; }
        else if (role[q] === 'm') {
          if (Z.ph === 1) { an = 'empujar'; ve = .5; ca = 'concentrado'; my = .8; }
          else if (Z.ph === 6) { an = 'empujar'; ve = .9; ca = 'concentrado'; my = .6; }
          else if (Z.ph === 2) { ca = 'feliz'; }
          else if (Z.ph === 3) { an = 'triste'; ca = 'triste'; }
          else if (Z.ph === 4) { an = 'saludar'; ca = 'enojado'; mx = .6; }
        } else {
          if (Z.ph === 0) { mx = -.7; ca = 'normal'; }
          else if (Z.ph === 1) { an = 'empujar'; ve = .25; ca = 'concentrado'; mx = Z.x / CR; my = .8; }
          else if (Z.ph === 2 || Z.ph === 6) { an = 'empujar'; ve = .9; ca = 'concentrado'; my = .6; }
          else if (Z.ph === 3) { ca = 'enojado'; }
          else if (Z.ph === 4) { an = 'celebrar'; ca = 'feliz'; }
          else if (Z.ph === 5) { an = 'triste'; ca = 'triste'; }
        }
        if (now >= 0 && !fin && ciego(q, now)) ca = 'susto';
        pj.anim(an, { vel: ve }).cara(ca).mirar(mx, my).rumbo(Math.abs(v) > 1 ? (v > 0 ? Math.PI / 2 : -Math.PI / 2) : 0).update(dt);
        pj.g.position.set(S.x, 0, S.z);
      }
      /* los mesones */
      for (sl = 0; sl < 2; sl++) {
        var L2 = V.lineas[sl], m = mas[L2.team], a = amar[L2.team], Zm = m >= 0 ? Q[m] : null, Za = a >= 0 ? Q[a] : null, j;
        /* masero: masa, aro del pedido, regla */
        if (Zm) {
          var sz = (Zm.ph === 1 || Zm.ph === 2 || Zm.ph === 3 || Zm.ph === 6) ? Zm.v / 100 : 0, tg = ordDe(Zm), bo = V.boost[m] > t, km = bo ? HELP_TOL : 1, dentro = Math.abs(sz - tg) <= TOL * km;
          L2.masa.visible = sz > .02; var rm = RM(sz) * (Zm.ph === 2 ? 1 + .08 * Math.sin(t * 25) : 1); L2.masa.scale.set(rm, 1, rm);
          L2.masaMat.color.set(Zm.ph === 3 ? '#b89a60' : (Zm.ph === 1 && dentro) || Zm.ph === 2 ? '#fff3a0' : '#f2d27a');
          L2.masaMat.emissive.set((Zm.ph === 1 && dentro) || Zm.ph === 2 ? '#5a4a10' : '#000000');
          var cgM = ciego(m, now);
          L2.dirM.visible = Zm.ph === 6 && !cgM && !fin; if (L2.dirM.visible) { L2.dirM.rotation.y = DIRANG[DIR[Math.min(Zm.n, NMAX)]]; L2.dirM.position.y = TOPY + .75 + Math.abs(Math.sin(t * 9)) * .15; }
          for (k in L2.aros) L2.aros[k].visible = !fin && !cgM && k === tg + '|' + km;
          L2.barM.zona.visible = !cgM;
          var ak = L2.aros[tg + '|' + km]; if (ak) ak.material.opacity = Zm.ph === 1 && dentro ? .95 : .55 + .2 * Math.sin(t * 5);
          var bm = L2.barM; bm.zona.scale.x = Math.max(.02, TOL * km * 2 * 2.4); bm.zona.position.x = -1.2 + tg * 2.4;
          bm.lleno.visible = sz > .02; bm.lleno.scale.x = Math.max(.02, sz * 2.4); bm.lleno.position.x = -1.2 + sz * 1.2; bm.lleno.material.color.set(dentro ? '#fff6b0' : '#ff9a5a');
          bm.marca.visible = sz > .02; bm.marca.position.x = -1.2 + sz * 2.4;
          L2.brM.visible = bo; if (bo) L2.brM.scale.setScalar(1 + .05 * Math.sin(t * 20));
        }
        /* la cinta */
        var pc = pace(Math.max(0, now));
        for (k = 0; k < L2.rayas.length; k++) L2.rayas[k].position.x = BELT_X0 + .1 + ((k * .78 + (now > 0 && !fin ? t : 0) * 1.1 * pc) % (BELT_X1 - BELT_X0 - .2));
        var np = Zm && Za ? cl(Zm.n - Za.n, 0, BELT) : 0, usados = [false, false, false, false];
        for (j = 0; j < np; j++) {
          var idx = Za.n + j, it = L2.items[idx % 4], ud = it.userData; usados[idx % 4] = true;
          if (ud.idx !== idx) { ud.idx = idx; ud.x = BELT_X0 + .3; var bueno = bitOf(Zm, idx) === 1; ud.h.material = V3.toon(bueno ? '#3f9a4a' : '#8a7a5a'); ud.m.material = V3.toon(bueno ? '#f2d27a' : '#9a8a70'); }
          var txB = BELT_X1 - .7 - j * 1.75; ud.x += (txB - ud.x) * Math.min(1, dt * 7);
          it.visible = true; it.position.set(ud.x, TOPY + .2, L2.z - .3);
        }
        for (k = 0; k < 4; k++) if (!usados[k]) { L2.items[k].visible = false; L2.items[k].userData.idx = -1; }
        /* amarrador */
        if (Za) {
          var ph = Za.ph, tieneH = ph === 1 || ph === 2 || ph === 3 || ph === 6, hi = ph === 4 || ph === 5 ? Za.n - 1 : Za.n, bg = Zm ? bitOf(Zm, Math.max(0, hi)) : 1, boA = V.boost[a] > t;
          L2.hA.visible = tieneH; L2.masaA.visible = tieneH;
          L2.hA.material = V3.toon(ph === 3 ? '#6a7a5a' : '#3f9a4a'); L2.masaAMat.color.set(bg ? '#f2d27a' : '#9a8a70');
          var spX = HXa(SPX[Math.min(Za.n, NMAX)]), spZ = HZa(L2, SPY[Math.min(Za.n, NMAX)]), ks = boA ? HELP_TOL : 1;
          var cgA = ciego(a, now);
          L2.dirA.visible = ph === 6 && !cgA && !fin; if (L2.dirA.visible) { L2.dirA.rotation.y = DIRANG[DIRA[Math.min(Za.n, NMAX)]]; L2.dirA.position.y = TOPY + .75 + Math.abs(Math.sin(t * 9)) * .15; }
          L2.marcaR.visible = ph === 1 && !cgA; L2.marcaX.visible = ph === 1 && !cgA; L2.barA.zona.visible = !cgA;
          if (ph === 1) { L2.marcaR.position.set(spX, TOPY + .17, spZ); L2.marcaX.position.set(spX, TOPY + .165, spZ); L2.marcaR.scale.set(ks, ks * .69, 1); L2.marcaX.scale.set(ks, ks * .69, 1); L2.marcaR.material.opacity = .6 + .35 * Math.abs(Math.sin(t * 6)); }
          L2.cuchara.visible = ph === 1; if (ph === 1) L2.cuchara.position.set(HXa(Za.x), TOPY + .45 + Math.sin(t * 6) * .05, HZa(L2, Za.y));
          L2.guiso.visible = ph === 2 || ph === 6; if (ph === 2 || ph === 6) L2.guiso.position.set(HXa(Za.x), TOPY + .16, HZa(L2, Za.y));
          for (k = 0; k < 4; k++) L2.cuerdas[k].visible = ph === 2 && k < Za.knN;
          var KK = ph === 2 || ph === 4 || ph === 5 ? Kde(a) : nudosK(now);
          for (k = 0; k < 4; k++) { L2.nudos[k].visible = !fin && k < KK; L2.nudos[k].material = (ph === 2 || ph === 4 || ph === 5) && k < Za.knN ? L2.nudoOn : L2.nudoOff; }
          var ba = L2.barA; ba.zona.scale.x = WKV[lv - 1] * (boA ? HELP_TOL : 1) * 2 * 2.4; ba.zona.position.x = 0;
          ba.lleno.visible = false; ba.marca.visible = ph === 2; ba.marca.position.x = -1.2 + Za.v / 100 * 2.4;
          if (ph === 2) ba.zona.material = V3.toon(Math.abs(Za.v / 100 - .5) <= WKV[lv - 1] * (boA ? HELP_TOL : 1) ? '#8aff9a' : '#5cd06a', { em: '#2a8a3a', emI: .4 });
          L2.brA.visible = boA; if (boA) L2.brA.scale.setScalar(1 + .05 * Math.sin(t * 20));
          /* el paquete: bien amarrada vuela a la olla; mal amarrada tiembla y se deshace */
          var u = (t - L2.paqT) / .6;
          L2.paq.visible = u >= 0 && u < 1;
          if (L2.paq.visible) {
            if (L2.paqBien) { L2.paq.position.set(AX + 2.4 * u, TOPY + .25 + Math.sin(u * Math.PI) * 1.6, L2.z - .3 + .1 * u); L2.paq.rotation.set(0, u * 3, u * 1.5); L2.paq.scale.setScalar(1 - .45 * u); }
            else { L2.paq.position.set(AX + Math.sin(t * 40) * .08, TOPY + .25, L2.z - .3); L2.paq.rotation.set(0, Math.sin(t * 30) * .2, 0); L2.paq.scale.setScalar(1 - .6 * u); }
          }
          var vis = Math.min(10, Za.sc - (L2.paq.visible && L2.paqBien ? 1 : 0));
          for (k = 0; k < 10; k++) L2.pila[k].visible = k < vis;
        }
      }
      for (sl = 0; sl < 2; sl++) { var L3 = V.lineas[sl]; emerg3D(V, L3, mas[L3.team], amar[L3.team], eN, dt, now); }
      /* la flecha sobre TI */
      var yoS = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yoS; if (yoS) V.flecha.position.set(yoS.x, 4.4 + Math.abs(Math.sin(t * 4)) * .3, yoS.z);
    }
    function dibujar3D() {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k, Gm = G(), f = Gm.f, cx = Gm.cx, yo = c.yo, V; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      V = v3;
      var fin = now >= dur - FREEZE;
      if (now >= 0 && !fin) V3.musica(fase(now) === 3 ? 'hallacas-loca' : 'hallacas');
      V.esc.render(dt);
      /* marcador por equipo (debajo de la barra del motor) */
      var tA = totEq(V.myT), tB = totEq(1 - V.myT);
      rr(cx - 150, 74, 300, 30, 10, 'rgba(20,16,28,.55)', 0);
      txt((yo >= 0 ? 'TU EQUIPO ' : 'AZULES ') + tA, cx - 72, 89, 16, COL_EQ[V.myT] === '#2f6fdb' ? '#8fc0ff' : '#ff8a8a', 0, true);
      txt((yo >= 0 ? 'RIVALES ' : 'ROJOS ') + tB, cx + 72, 89, 16, COL_EQ[1 - V.myT] === '#2f6fdb' ? '#8fc0ff' : '#ff8a8a', 0, true);
      /* nombres sobre las cabezas y el estado de cada estación de tu mesón */
      for (k = 0; k < n; k++) {
        var S = V.pjs[k]; if (!S) continue;
        var Z = Q[k], pt = V.esc.proyectar(S.x, S.sl === 0 ? 3.75 : 3.6, S.z);
        txt((k === yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7)) + ' · ' + Z.sc, pt.x, pt.y, S.sl === 0 ? 12 : 10, k === yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (S.sl !== 0 || now < 0 || fin) continue;
        var L = V.lineas[0], lb = '', col = '#fffdf2', ps = V.esc.proyectar(role[k] === 'm' ? MX : AX, TOPY, L.z + 1.75);
        if (aturdido(k, now)) { lb = role[k] === 'm' ? '¡A LIMPIAR LA OLLA!' : (aturdido(k, now).k === 'fuego' ? '¡SE QUEMÓ EL GUISO!' : '¡SE LLEVÓ EL GUISO!'); col = '#ff6a4a'; }
        else if (responde(k, now)) { var er3 = responde(k, now); lb = er3.k === 'fuego' ? 'B×' + (FUEGO_N - Z.ch) + ': ¡APAGA EL FUEGO!' : er3.k === 'turron' ? 'B: ¡AGARRA EL TURRÓN!' : er3.k === 'gas' ? 'B×' + (GAS_N - Z.ch) + ': ¡PRENDE EL FOGÓN!' : er3.k === 'luz' ? 'B: ¡PRENDE LA VELA!' : er3.k === 'nino' ? 'B: ¡ESPANTA AL CARAJITO!' : 'B: ¡BAJA EL FUEGO!'; col = '#ffd23f'; }
        else if (role[k] === 'm') {
          var tg = ordDe(Z);
          lb = Z.ph === 6 ? (ciego(k, now) ? '¡A OSCURAS!' : '¡ONOTO! EMPUJA ' + DIRS[DIR[Math.min(Z.n, NMAX)]]) : Z.ph === 4 ? '¡CINTA LLENA!' : Z.ph === 7 ? '¡AYUDANDO!' : Z.ph === 2 ? '¡BUENA!' : Z.ph === 3 ? (Z.bad === 3 ? '¡SIN ONOTO!' : Z.v / 100 < tg ? '¡CORTA!' : '¡PASADA!') : (lv === 1 ? 'MASA' : tg < 0.5 ? 'MASA CHICA' : 'MASA GRANDE');
          col = Z.ph === 4 || Z.ph === 3 ? '#ff6a4a' : Z.ph === 2 ? '#5cff7a' : Z.ph === 6 ? '#ffd23f' : '#fffdf2';
        } else {
          lb = Z.ph === 6 ? (ciego(k, now) ? '¡A OSCURAS!' : '¡ACEITUNAS! EMPUJA ' + DIRS[DIRA[Math.min(Z.n, NMAX)]]) : Z.ph === 0 ? 'ESPERANDO HOJA' : Z.ph === 3 ? '¡MASA MALA!' : Z.ph === 7 ? '¡AYUDANDO!' : Z.ph === 1 ? 'GUISO EN LA MARCA ROJA' : Z.ph === 2 ? 'NUDO ' + Math.min(Z.knN + 1, Kde(k)) + '/' + Kde(k) : Z.ph === 4 ? '¡BIEN AMARRADA!' : Z.ph === 5 ? '¡MAL AMARRADA! -1' : '';
          col = Z.ph === 3 || Z.ph === 5 ? '#ff6a4a' : Z.ph === 4 ? '#5cff7a' : Z.ph === 6 ? '#ffd23f' : '#fffdf2';
        }
        if (lb) txt(lb, ps.x, ps.y, 13, col, 0, true);
      }
      /* la regla en 3 segundos y los avisos */
      var hint = role[yo] === 'a' ? 'STICK: guiso a la marca roja · A soltar · STICK a la flecha · A con la bolita en lo verde · B: emergencia' : role[yo] === 'm' ? 'MANTÉN A, SUELTA en el aro VERDE · luego STICK a la flecha · B: emergencia o ayudar' : 'Mira las dos líneas';
      txt(hint, cx, 582, 12, '#fffdf2', 0, true);
      if (now >= 0 && !fin && mas[V.myT] >= 0) { var mq = Q[mas[V.myT]], cola = [], kq; for (kq = 0; kq < 4; kq++) { var oq = ORD[Math.min(NMAX, mq.n + kq)]; cola.push(lv === 1 ? 'MASA' : oq < 0.5 ? 'chica' : 'GRANDE'); } txt('PEDIDOS: ' + cola.join(' > '), cx, 562, 12, '#ffd23f', 0, true); }
      if (now > -1 && now < 2.6 && !c.practica && role[yo]) txt(role[yo] === 'm' ? '¡MASA EN EL ARO VERDE Y ONOTO!' : '¡GUISO EN LA ROJA, ACEITUNAS Y NUDOS!', cx, 140, 20, '#ffd23f', 0, true);
      var ban = banner(now, yo);
      if (ban) txt(ban.t, cx, 128, (ban.fase ? 24 : 19) + Math.sin(absT * 12), ban.col, 0, true);
      if (now >= 0 && !fin && bono(now)) for (k = 0; k < 2; k++) { var px2 = V.esc.proyectar(AX + 2.4, TOPY + 1.5, V.lineas[k].z - .2); txt('×2', px2.x, px2.y, k === 0 ? 18 : 14, '#ffd23f', 0, true); }
      if (fin && now < dur + 3) txt('¡TIEMPO!', cx, 170, 30, '#fffdf2', 0, true);
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), q;
        absT += dt; shake = Math.max(0, shake - dt * 3);
        for (q = 0; q < n; q++) if (!c.mio(q)) { var r = c.remoto(q); if (r) mirror(q, r); }
        for (q = 0; q < n; q++) if (c.mio(q) && role[q]) stepSeat(q, dt, now);
        for (q = 0; q < n; q++) Q[q].sc = Math.max(0, Math.round(Q[q].pts));
        /* efectos (en todas las pantallas, por cambio de estado) */
        for (q = 0; q < n; q++) {
          var Z = Q[q];
          if (Z.ph !== Z.lastPh) {
            var bueno = (role[q] === 'm' && Z.ph === 2) || (role[q] === 'a' && Z.ph === 4), malo = (role[q] === 'm' && Z.ph === 3) || (role[q] === 'a' && Z.ph === 5);
            if (bueno && q === c.yo && !v3) { SND(660, 0.12, 'square', 0.05, 200); }
            if (malo && q === c.yo) {
              if (!v3) SND(160, 0.2, 'sawtooth', 0.06, -60); shake = 0.3;                       // en 3D el sonido y la sacudida los pone actualizar3D
              if (role[q] === 'a' && now - lastGag > 14 && !c.practica) { lastGag = now; var g0 = G(); SAY('¡Esa hallaca quedó como regalo sin cinta!', g0.cx, 120, '#ffd23f'); }
            }
            Z.lastPh = Z.ph;
          }
        }
        if (!v3 && now >= 0 && !c.practica) {                                // 2D: el aviso hablado de cada fase y de cada emergencia (en 3D lo pone dibujar3D)
          var eA = evAt(now), fA = fase(now);
          if (fA > 1 && !voz['f' + fA]) { voz['f' + fA] = 1; var g1 = G(); SAY(fA === 3 ? '¡ÚLTIMOS SEGUNDOS!' : '¡SE PRENDIÓ LA COCINA!', g1.cx, 110, '#ff6a4a'); SND(440, 0.3, 'square', 0.06, 400); }
          if (eA && !voz['e' + eA.i]) { voz['e' + eA.i] = 1; SND(eA.k === 'tia' ? 880 : 300, 0.25, 'square', 0.05, eA.k === 'tia' ? 300 : -100); }
        }
        if (now >= 0.2 && !voz.ini && !c.practica) { voz.ini = 1; var g2 = G(); SAY(role[c.yo] === 'a' ? '¡A AMARRAR, QUE VIENEN LAS HOJAS!' : '¡MASA, MASA, QUE LA TÍA TIENE PRISA!', g2.cx, 110, '#ffd23f'); }
      },
      ai: function (q, dt, api) {
        var now = c.ahora();
        if (!role[q] || now < 0) return;
        if (now >= dur - FREEZE) { api.hold('a', false); api.eje(0, 0); return; }
        if (role[q] === 'm') aiM(q, dt, api, now); else aiA(q, dt, api, now);
      },
      cuerpo: function (q) {
        var Z = Q[q];
        return { ph: Z.ph, v: Z.v, x: Z.x, y: Z.y, sc: Z.sc, n: Z.n, qa: Z.qa, qb: Z.qb, hb: Z.hb, kn: role[q] === 'a' ? packKn(Z) : 0, e: packE(Z) };
      },
      /* un humano caído pasa a CPU (o vuelve): retoma desde los CONTADORES (n, qa, qb, sc, hb), no desde la animación a medias */
      alCpu: function (q) {
        var Z = Q[q], now = c.ahora(), m = mate[q];
        plan[q] = newPlan(); if (!(Z.ph === 1 || Z.ph === 2 || Z.ph === 6)) { Z.ph = 0; Z.sz = 0; Z.v = 0; Z.x = 0; Z.y = 0; Z.knN = 0; Z.mi = 0; Z.pg = -1; Z.kn = 0; } Z.pHeld = false;   // la hoja a medias (masa creciendo, guiso, onoto, nudos) sigue donde iba: un cambio de humano/CPU no la tira Z.hUntil = 0; Z.hcd = now + 1; Z.bUntil = 0; Z.ad = 0; Z.arm = false;
        Z.seenHb = m >= 0 ? Q[m].hb : 0; Z.pts = Z.sc;
      },
      alHum: function (q, obj) {
        var Z = Q[q], now = c.ahora(), m = mate[q];
        if (obj) mirror(q, obj);                                             // lo último que hizo la CPU del juez (nunca retrocede: ver mirror)
        plan[q] = newPlan(); if (!(Z.ph === 1 || Z.ph === 2 || Z.ph === 6)) { Z.ph = 0; Z.sz = 0; Z.v = 0; Z.x = 0; Z.y = 0; Z.knN = 0; Z.mi = 0; Z.pg = -1; Z.kn = 0; } Z.pHeld = true;   // la hoja a medias (masa creciendo, guiso, onoto, nudos) sigue donde iba: un cambio de humano/CPU no la tira Z.hUntil = 0; Z.hcd = now + 1; Z.bUntil = 0; Z.ad = 0; Z.arm = false;
        Z.seenHb = m >= 0 ? Q[m].hb : 0; Z.pts = Z.sc;
      },
      scores: function () {
        var out = [], now = c.ahora(), cap = Math.floor(RATE * (Math.min(Math.max(now, 0), dur) + 1.2)), q;
        for (q = 0; q < n; q++) out.push(Math.max(0, Math.min(SC_MAX, cap, Math.round(Q[q].sc))));
        return out;
      },
      done: function () { return false; },
      hudChip: function (q) { return role[q] === 'm' ? 'MASA ' + Q[q].sc : role[q] === 'a' ? 'ATA ' + Q[q].sc : null; },
      destacado: function () {
        var me = c.yo >= 0 ? c.yo : 0, Z = Q[me];
        if (role[me] === 'm') return '¡' + Z.sc + ' masa' + (Z.sc === 1 ? '' : 's') + ' buena' + (Z.sc === 1 ? '' : 's') + '!';
        return '¡' + Z.sc + ' hallaca' + (Z.sc === 1 ? '' : 's') + ' bien amarrada' + (Z.sc === 1 ? '' : 's') + '!';
      },
      vista: function () {
        return { gt: c.ahora(), lv: lv, tol: TOL, role: role.slice(), mas: mas.slice(), amar: amar.slice(), ord: ORD.slice(),
          ph: Q.map(function (Z) { return Z.ph; }), n: Q.map(function (Z) { return Z.n; }), sc: Q.map(function (Z) { return Z.sc; }), pts: Q.map(function (Z) { return Z.pts; }),
          hb: Q.map(function (Z) { return Z.hb; }), x: Q.map(function (Z) { return Z.x; }), y: Q.map(function (Z) { return Z.y; }), v: Q.map(function (Z) { return Z.v; }),
          knN: Q.map(function (Z) { return Z.knN; }), mi: Q.map(function (Z) { return Z.mi; }), pg: Q.map(function (Z) { return Z.pg; }), K: Q.map(function (Z) { return Z.K; }), lock: Q.map(function (Z) { return Z.lock; }),
          spot: function (k) { return [SPX[k], SPY[k]]; }, dir: DIR.slice(), dirA: DIRA.slice(), ad: Q.map(function (Z) { return Z.ad; }), ev: EV, eo: Q.map(function (Z) { return Z.eo; }), fase: fase(c.ahora()), st: Q.map(function (Z) { return [Z.sMasaOk, Z.sBien, Z.sMal, Z.sTira, Z.sPg, Z.sNudoMal]; }), qa: Q.map(function (Z) { return Z.qa; }), qb: Q.map(function (Z) { return Z.qb; }) };
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D();
        dibujar2D();
      }
    };
    return g;
  }
});
})();
