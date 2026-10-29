'use strict';
/* LA FIESTA · EN VIVO · f_bono · ¡SE LE CAE EL BONO!  (1v3, modelo B: dueño + juez)   diseño: docs/mario-party/M4-TEAMS-WAVE2.md (f_bono)
   Afuera del banco. El SOLO acaba de cobrar el bono (30 monedas) y tres bachaqueros lo persiguen con un periódico enrollado.
   El solo corre algo más rápido (PERILLA.SPD) y salta con A (0,5 s invulnerable, enfriamiento 1,2 s). El trío golpea con A: AVISO visible de 0,35 s
   (el periódico se levanta y el círculo del golpe se pinta en el piso), enfriamiento 2 s. Un golpe suelta 2 monedas; DOS golpes en <=0,6 s = SÁNDWICH:
   el segundo suelta 4 (6 en total). El solo recoge las monedas caídas (4,5 s de vida), pero nunca más de la mitad de lo perdido.

   POR QUÉ B: no hay objeto compartido que cambie por la interacción de varios; el golpe lo juzga la VÍCTIMA (el solo) contra su propio cuerpo y el círculo
   del golpe, que es una función pura de lo que mandó el trío (posición, dirección y reloj al pulsar). Con C el juez juzgaría con la posición atrasada del solo.
   Red. Todo el estado compartido viaja por eventos (ev), nada por mensajes x*:  `sw {k,x,y,a,t}` el trío (o el juez por una CPU) al pulsar A: k = id del golpe
   (asiento*100+n), (x,y) donde empieza, a = ángulo en grados, t = ms del reloj de la partida. El círculo golpea entre t+0,35 s y t+0,51 s en
   (x+cos a·30, y+sin a·30), así que todas las pantallas lo calculan igual.  `hit {k,l,x,y}` el solo (o el juez por una CPU): l = 2 o 4 (sándwich) monedas
   que se sueltan en (x,y); se cuenta una vez por k.  `rec {i}` el solo: recoge la moneda i. El recuento (perdidas brutas, recogidas, netas) sale SOLO de esos
   eventos, igual en todas las pantallas; el veredicto lo da compara() sobre scores(). Un golpe cuyo aviso llega tarde (después del círculo) no cuenta: la latencia favorece
   al solo (declarado en el informe, el aviso de 0,35 s es el máximo que cabe sin que el trío no pueda sorprender a nadie).
   Puntaje (M4 U=2, H=15): solo = 2·(30−perdidas netas), trío = 29 fijo. 1v3: el solo contra la MEDIA del trío => el solo gana con >=15 monedas (30 > 29), sin
   empates por construcción. Con lim {scoreMax:60, scoreRate:8, minT:6}: el 60 de un solo intacto sólo cabe a partir de t=6; en partidas más cortas (pruebas con dur 3)
   scores() recorta el techo del solo a 8·(t+1,2), que sigue siendo >29 (ganar o perder no cambia).
   Fin temprano: perdidas netas >=16 (gana el trío; 0,9 s de festejo); si no, a dur.
   Perilla de balance (PERILLA.SPD): velocidad del solo (×TS) ; SK por nivel la afina por nivel. NUNCA se toca el modelo de la CPU una vez medido (reacción, error de
   apuntado, lapsos): eso define «igual habilidad».
   Cuerpo en red (o): x, y, a (solo: 1 en el aire; trío: 0), d (dirección 0-15).  Sin Math.random / Date.now: azar de c.rngFor('cpu'+p); lo cosmético de c.fx().
   Dibujo: 3D low poly (fiesta-3d.js, doc 15 §8 #2): la acera del banco, el sobre del bono flotando sobre el solo y la barra del bono con la raya del 15;
   sin WebGL o con ?plano=1, el 2D de siempre (dibujar2D). La simulación, la red y los puntajes no cambian.

   v2 (nota del dueño «igual difícil para el 1»): herramientas del solo para escapar, todas juzgadas en SU pantalla (es el dueño de su cuerpo):
     · SALTO CON IMPULSO: A con el stick movido = brinco largo (los primeros DASH_T s corre ×DASH_K). Sigue siendo 0,55 s invulnerable.
     · TOLDOS (2, a los lados): parado debajo, el periódico no entra; cada toldo aguanta TOLDO_T s de uso y se cae TOLDO_CD s.
     · LA PUERTA DEL BANCO: cuando el vigilante la abre (evento), el solo se mete BANK_T s (nadie lo toca) y sale con impulso.
     · MONEDAS: las caídas se recogen (tope: la mitad de lo perdido) y el CAJERO bota monedas extra (evento) que no tienen tope.
   El trío avisa más claro: aviso de 0,42 s (antes 0,35), «!» sobre la cabeza y el aro completo del golpe desde el primer cuadro.
   ESCALADA por c.ahora()/dur: CALMA (<34 %), ¡SE PRENDIÓ! (34-70 %: el trío corre más y pega más seguido), ¡ÚLTIMOS SEGUNDOS! (>70 %: más
   rápido aún, eventos más seguidos, el cajero bota 4). Cartel, silbato, sacudón, luz roja y gaita más rápida en cada cambio.
   EVENTOS DE LA CALLE (de c.rngFor('calle') en mk(): iguales en todas las pantallas; cada uno con aviso EV_W s antes): la CAMIONETICA cruza un
   canal y tumba al que agarre (el trío queda mareado sin pegar; al solo lo frena, no le quita monedas), el VENTARRÓN empuja a todos, el CARRITO
   del raspao cruza despacio (un obstáculo que se mueve: sirve de escudo), el CAJERO bota monedas y el BANCO abre la puerta. Cada dueño aplica el
   evento a SU cuerpo; el cuerpo del solo manda a = 0 suelo, 1 aire, 2 bajo un toldo, 3 dentro del banco (para dibujarlo y para la CPU).
   Las monedas del cajero viajan como `rec {i}` con i >= 90000 (sin mensaje nuevo). Contrato de puntaje igual: solo = 2·(30−netas), trío = 29. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_bono')) return;

/* ───── la perilla (única) y las constantes ───── */
var PERILLA = { SPD: 0.9, SK: [0.96, 0.94, 0.96] };               // velocidad del solo = TS · SPD · SK[lv-1]
var SW = 620, SH = 380, AX0 = 12, AX1 = SW - 12, AY0 = 24, AY1 = SH - 12, PIVY = 130;
var TS = 178, RB = 10, WINDMOV = 0.35;                      // velocidad del trío, radio de cuerpo, factor de movimiento durante el aviso
var WIND = 0.42, ACT = 0.22, SWCD = 2.0, REACH = 34, ZR = 46, SBODY = 10;     // aviso, ventana activa, enfriamiento, alcance y radio del periodicazo
var JUMP = 0.55, JCD = 1.8, STG = 0.6, STGMOV = 0.5, SAND = 0.6, TURBO_T = 2, TURBO_K = 1.4;
var DASH_T = 0.3, DASH_K = 1.7;                                    // salto con impulso
var F1 = 0.34, F2 = 0.70, TSK = [1, 1.08, 1.16], SWCDK = [2.0, 1.6, 1.3];   // escalada: fases y lo que sube el trío
var TOLDO_R = 26, TOLDO_T = 1.6, TOLDO_CD = 8;                     // toldos: radio, aguante y tiempo caído
var DOOR_X = 310, DOOR_R = 24, BANK_T = 1.5, BANK_GR = 0.45, BOOST_T = 1.0, BOOST_K = 1.35;   // la puerta del banco
var EV_W = 0.9, BUSV = 400, BUS_L = 84, BUS_H = 44, STUN = 1.2, CARV = 70, CAR_W = 22, CAR_H = 14, VIENTO_V = 62, BONO_LIFE = 4.5, ATM_X = 545, COLA_R = 56, COLA_K = 0.5, CAFE_R = 16, CAFE_T = 2.6;
var START = 30, GANA_COINS = 15, PIERDE_NET = 16, L1 = 2, L2 = 4, COIN_LIFE = 3.0, PICK = 12, CELEBRA = 0.9;
var PTS_COIN = 2, PTS_TRIO = 29, RATE = 8, CAP_PAD = 1.2;
var ERR0 = 0.5, CELL = 20, GW = 31, GH = 19;
var INK = '#14101c';
var PAL = {
  1: { cielo: '#8fd8ff', cielo2: '#d9f3ff', piso: '#c9c2b0', piso2: '#bdb5a2', borde: '#8e8878', muro: '#d8a26a', muro2: '#b8844f', sol: '#ffe14d' },
  2: { cielo: '#ff8f5a', cielo2: '#ffd08a', piso: '#b3a3a6', piso2: '#a59597', borde: '#7a6a82', muro: '#a8607a', muro2: '#864a62', sol: '#ffe9a0' },
  3: { cielo: '#1d1a4a', cielo2: '#3a3478', piso: '#4a4a66', piso2: '#41415c', borde: '#2c2a44', muro: '#5a4a7a', muro2: '#443862', sol: '#f4f0d0' }
};
var GRITOS = ['¡PLAF!', '¡AY, EL PERIÓDICO!', '¡MI BONO!', '¡ZAS!'];
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
/* obstáculos por nivel: círculos [x,y,r] y rectángulos [x,y,w,h] */
var OBS = { 1: { c: [[170, 190, 15], [450, 190, 15]], r: [] },
  2: { c: [[200, 140, 17], [420, 140, 17], [200, 270, 17], [420, 270, 17], [310, 205, 17]], r: [] },
  3: { c: [], r: [[140, 24, 16, 190], [464, 24, 16, 190], [302, 150, 16, 140]] } };
var TOLDOS = [[70, 290], [550, 290]];
var CARRILES = { 1: { bus: [100, 200], car: [150, 270] }, 2: { bus: [200, 340], car: [200, 340] }, 3: { bus: [330], car: [330] } };
var SPAWNS = { 1: { s: [310, 200], t: [[50, 60], [570, 60], [310, 340]] }, 2: { s: [310, 205], t: [[50, 60], [570, 60], [310, 340]] }, 3: { s: [220, 290], t: [[50, 70], [570, 70], [390, 330]] } };

FIESTA.LIVE.add('f_bono', {
  name: '¡SE LE CAE EL BONO!', modos: ['1v3'], clase: 'binary', modelo: 'B', dur: 35,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 60, scoreRate: 8, minT: 6, finTemprano: 1 },
  cuerpo: ['x', 'y', 'a', 'd'], discretos: ['a', 'd'],
  perilla: PERILLA,
  carta: {
    obj: 'El solo: salva tu bono. El trío: ¡quítaselo a periodicazos!',
    gana: 'El solo gana si se queda con 15 monedas o más. Dos periodicazos seguidos (sándwich) botan más monedas.',
    como: { tactil: 'Joystick · A = saltar (solo) / periodicazo (trío)', teclado: 'WASD o flechas · ESPACIO' },
    roles: {
      solo: {
        obj: '¡TÚ CONTRA TODOS! Corre, esquiva y recoge las monedas que se caen.',
        como: { tactil: 'Joystick: correr · A: saltar (0,5 s sin que te peguen)', teclado: 'WASD o flechas correr · ESPACIO saltar' },
        demos: [{ id: 'mover', txt: 'Corres más rápido que ellos: no te dejes arrinconar' }, { id: 'saltar', txt: 'Salta cuando el círculo rojo se llena: el periódico pasa por debajo' }]
      },
      trio: {
        obj: '¡Quítenle el bono! Péguenle dos seguidos para el sándwich.',
        como: { tactil: 'Joystick: perseguir · A: periodicazo (apunta solo si el bono está cerca)', teclado: 'WASD o flechas · ESPACIO' },
        demos: [{ id: 'mover', txt: 'Rodéenlo: uno por delante, otros por los lados' }, { id: 'robar', txt: 'Dos golpes en menos de 0,6 s botan 6 monedas' }]
      }
    },
    demos: [
      { id: 'mover', txt: 'El solo corre más; el trío lo rodea' },
      { id: 'saltar', txt: 'Salta cuando el círculo rojo se llena' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], OB = OBS[lv], SPN = SPAWNS[lv];
    var soloI = c.solo >= 0 && c.solo < n ? c.solo : 0;
    var spdSolo = TS * PERILLA.SPD * (PERILLA.SK[lv - 1] || 1);
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };
    var trio = [], slot = [], P = [], i;
    for (i = 0; i < n; i++) { if (i === soloI) slot.push(-1); else { slot.push(trio.length); trio.push(i); } }
    for (i = 0; i < n; i++) {
      var sp0 = i === soloI ? SPN.s : SPN.t[Math.max(0, slot[i]) % SPN.t.length];
      P.push({ x: sp0[0], y: sp0[1], px: sp0[0], py: sp0[1], vx: 0, vy: 0, fa: i === soloI ? 0 : 1.2, tj: -9, stg: -9, nextSw: 0.4, seq: 0, hitN: 0, remA: 0, aim: null, grace: -1,
        stun: -9, bank: -9, prot: -9, boost: -9, jx: 0, jy: 0 });
    }
    var swings = [], swK = {}, coins = [], hitSet = {}, recSet = {}, gross = 0, recN = 0, lastHitT = -9, lastSand = false, hitAt16 = -1, turboUntil = -9, turboUsed = false;
    var sandN = 0, absT = 0, flash = 0, shake = 0, voz = {}, sandAt = -9, cpuR = [], plan = [];
    for (i = 0; i < n; i++) { cpuR.push(c.rngFor('cpu' + i)); plan.push({ re: -9, dx: 0, dy: 0, danger: false, rx: {}, tx: 0, ty: 0, swRe: 0, jAt: 0, gate: -1 }); }
    var isSolo = function (p) { return p === soloI; };

    /* ───── escalada y eventos de la calle (todo de c.ahora()/dur y de c.rngFor('calle'): igual en todas las pantallas) ───── */
    function fase(now) { var u = now / Math.max(1, dur); return u < F1 ? 0 : u < F2 ? 1 : 2; }
    var EVS = [], bonos = [], recB = 0, bankUsed = {}, toldo = [{ uso: 0, cae: -9 }, { uso: 0, cae: -9 }], anuncio = { s: '', col: '#fff', t: -9 }, faseVista = 0;
    (function planEventos() {
      if (c.sinEventos) return;                                   // sólo las pruebas de reglas finas
      var R = c.rngFor('calle'), tipos = ['banco', 'bus', 'cajero', 'viento', 'carrito', 'cafe', 'cola'], bolsa = [], t = Math.max(1.4, dur * 0.11), k = 0, CR = CARRILES[lv];
      while (t < dur - 1.4 && EVS.length < 14) {
        if (!bolsa.length) { bolsa = R.shuffle(tipos); if (EVS.length && bolsa[0] === EVS[EVS.length - 1].k) bolsa.push(bolsa.shift()); }
        var tp = bolsa.shift(), e = { k: tp, i: EVS.length, t: t, w: EV_W, d: 2, y: 150, dir: R.next() < 0.5 ? -1 : 1 };
        if (tp === 'bus') { e.y = CR.bus[Math.floor(R.next() * CR.bus.length) % CR.bus.length]; e.d = (SW + 2 * BUS_L) / BUSV; e.w = 1.0; }
        else if (tp === 'carrito') { e.y = CR.car[Math.floor(R.next() * CR.car.length) % CR.car.length]; e.d = (SW + 4 * CAR_W) / CARV; e.w = 0.8; }
        else if (tp === 'cafe') { e.d = 5; e.w = 0.6; e.x = AX0 + 60 + R.next() * (AX1 - AX0 - 120); e.y = AY0 + 60 + R.next() * (AY1 - AY0 - 120); var oc = { x: e.x, y: e.y }; resolve(oc, 8, true); e.x = oc.x; e.y = oc.y; }
        else if (tp === 'cola') { e.d = 5.5; e.w = 0.9; e.x = AX0 + 90 + R.next() * (AX1 - AX0 - 180); e.y = AY0 + 70 + R.next() * (AY1 - AY0 - 140); }
        else if (tp === 'viento') { e.d = 2.2; e.w = 0.8; }
        else if (tp === 'banco') { e.d = 4.2; e.w = 0.8; }
        else if (tp === 'cajero') {
          e.d = BONO_LIFE; e.w = 0.7; e.mon = [];
          var nm = fase(t + e.w) === 2 ? 4 : 3, j;
          for (j = 0; j < nm; j++) {                              // dónde caen: abanico delante del cajero, siempre en piso libre
            var o = { x: ATM_X - 20 - R.next() * 150, y: AY0 + 50 + R.next() * 150 }; resolve(o, 7, true);
            e.mon.push({ id: 90000 + e.i * 10 + j, x: o.x, y: o.y });
          }
        }
        EVS.push(e);
        var ff = fase(t), gap = dur * (ff === 0 ? 0.13 : ff === 1 ? 0.09 : 0.06) * (0.8 + 0.4 * R.next());
        if (tp === 'carrito') gap = Math.max(gap, 2.2);
        t += Math.max(1.5, gap) + e.w * 0.5; k++;
      }
    })();
    function evEn(kind, now, conAviso) {                           // el evento de ese tipo que está corriendo (o avisando, si conAviso)
      var j, e;
      for (j = 0; j < EVS.length; j++) { e = EVS[j]; if (e.k === kind && now >= (conAviso ? e.t : e.t + e.w) && now <= e.t + e.w + e.d) return e; }
      return null;
    }
    function busX(e, now) { var u = now - e.t - e.w; return e.dir > 0 ? AX0 - BUS_L + BUSV * u : AX1 + BUS_L - BUSV * u; }
    function carroPos(now) { var e = evEn('carrito', now, false); if (!e) return null; var u = now - e.t - e.w; return { x: e.dir > 0 ? AX0 - 2 * CAR_W + CARV * u : AX1 + 2 * CAR_W - CARV * u, y: e.y, e: e }; }
    function vientoV(now) { var e = evEn('viento', now, false); if (!e) return 0; var u = (now - e.t - e.w) / e.d; return e.dir * VIENTO_V * Math.sin(cl(u, 0, 1) * Math.PI) * 1.3; }
    var cafeUsed = {};
    function colaK(x, y, now) { var e = evEn('cola', now, false); return e && hyp(x - e.x, y - e.y) < COLA_R ? COLA_K : 1; }
    function bancoAbierto(now) { return evEn('banco', now, false); }
    function toldoDe(x, y) { var j; for (j = 0; j < TOLDOS.length; j++) if (hyp(x - TOLDOS[j][0], y - TOLDOS[j][1]) < TOLDO_R) return j; return -1; }
    function toldoSirve(j, now) { return j >= 0 && now >= toldo[j].cae; }
    function anuncia(s2, col) { anuncio = { s: s2, col: col || '#ffd23f', t: absT }; }
    var cp = function () {
      var f = c.campo();
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 };
      return f;
    };
    function geom() { var f = cp(), w = f.x1 - f.x0, cx = (f.x0 + f.x1) / 2; return { ox: cx - SW / 2, oy: PIVY + 20, cx: cx, k: Math.min(1, Math.max(0.45, (w - 8) / (SW + 24))), w: w }; }
    function scr(G, x, y) { return { x: G.cx + (G.ox + x - G.cx) * G.k, y: PIVY + (G.oy + y - PIVY) * G.k }; }
    function net() { return cl(gross - recN - recB, 0, START); }
    function cap() { return Math.floor(RATE * (cl(c.ahora(), 0, dur) + CAP_PAD)); }

    /* ───── geometría: colisión con el borde y los obstáculos ───── */
    function resolve(q, rad, estatico) {
      var j, o, dx, dy, d, m, nx, ny;
      q.x = cl(q.x, AX0 + rad, AX1 - rad); q.y = cl(q.y, AY0 + rad, AY1 - rad);
      var ca = estatico || !EVS ? null : carroPos(c.ahora());
      if (ca) {                                                    // el carrito del raspao empuja (por arriba o por abajo, lo más corto)
        nx = cl(q.x, ca.x - CAR_W, ca.x + CAR_W); ny = cl(q.y, ca.y - CAR_H, ca.y + CAR_H); dx = q.x - nx; dy = q.y - ny; d = hyp(dx, dy);
        if (d < rad) { if (d < 1e-6) { q.y = q.y < ca.y ? ca.y - CAR_H - rad : ca.y + CAR_H + rad; } else { q.x = nx + dx / d * rad; q.y = ny + dy / d * rad; } }
      }
      for (j = 0; j < OB.c.length; j++) {
        o = OB.c[j]; dx = q.x - o[0]; dy = q.y - o[1]; d = hyp(dx, dy); m = o[2] + rad;
        if (d < m) { if (d < 1e-6) { dx = 1; dy = 0; d = 1; } q.x = o[0] + dx / d * m; q.y = o[1] + dy / d * m; }
      }
      for (j = 0; j < OB.r.length; j++) {
        o = OB.r[j]; nx = cl(q.x, o[0], o[0] + o[2]); ny = cl(q.y, o[1], o[1] + o[3]); dx = q.x - nx; dy = q.y - ny; d = hyp(dx, dy);
        if (d < rad) {
          if (d < 1e-6) {
            var l = q.x - o[0], r = o[0] + o[2] - q.x, t = q.y - o[1], b = o[1] + o[3] - q.y, mn = Math.min(l, r, t, b);
            if (mn === l) q.x = o[0] - rad; else if (mn === r) q.x = o[0] + o[2] + rad; else if (mn === t) q.y = o[1] - rad; else q.y = o[1] + o[3] + rad;
          } else { q.x = nx + dx / d * rad; q.y = ny + dy / d * rad; }
        }
      }
      q.x = cl(q.x, AX0 + rad, AX1 - rad); q.y = cl(q.y, AY0 + rad, AY1 - rad);
    }
    var tmp = { x: 0, y: 0 };
    function libre(x, y, rad) { tmp.x = x; tmp.y = y; resolve(tmp, rad, true); return Math.abs(tmp.x - x) < 0.6 && Math.abs(tmp.y - y) < 0.6; }
    function los(ax, ay, bx, by) {
      var d = hyp(bx - ax, by - ay), st = Math.max(1, Math.ceil(d / 8)), j;
      for (j = 1; j < st; j++) if (!libre(ax + (bx - ax) * j / st, ay + (by - ay) * j / st, 9)) return false;
      return true;
    }
    /* navegación: campo de distancias por BFS en una rejilla, sólo cuando hay un muro en medio (se guarda por celda y por 0,2 s) */
    var blocked = [], navMemo = { b: -1, f: {} };
    for (i = 0; i < GW * GH; i++) blocked.push(!libre((i % GW) * CELL + CELL / 2, Math.floor(i / GW) * CELL + CELL / 2, 11));
    function cellOf(x, y) { return cl(Math.floor(y / CELL), 0, GH - 1) * GW + cl(Math.floor(x / CELL), 0, GW - 1); }
    function nearFree(ci) {
      if (!blocked[ci]) return ci;
      var r, dx, dy, cx = ci % GW, cy = Math.floor(ci / GW);
      for (r = 1; r < 5; r++) for (dy = -r; dy <= r; dy++) for (dx = -r; dx <= r; dx++) {
        var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        if (!blocked[y * GW + x]) return y * GW + x;
      }
      return ci;
    }
    function campoDist(goal, now) {
      var b = Math.floor(now * 5);
      if (navMemo.b !== b) navMemo = { b: b, f: {} };
      if (navMemo.f[goal]) return navMemo.f[goal];
      var dist = [], q = [goal], h = 0, j;
      for (j = 0; j < GW * GH; j++) dist.push(-1);
      dist[goal] = 0;
      while (h < q.length) {
        var cur = q[h++], cx = cur % GW, cy = Math.floor(cur / GW), dd, dx, dy;
        for (dd = 0; dd < 8; dd++) {
          dx = [1, -1, 0, 0, 1, 1, -1, -1][dd]; dy = [0, 0, 1, -1, 1, -1, 1, -1][dd];
          var nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          var ni = ny * GW + nx; if (dist[ni] >= 0 || blocked[ni]) continue;
          if (dx !== 0 && dy !== 0 && (blocked[cy * GW + nx] || blocked[ny * GW + cx])) continue;
          dist[ni] = dist[cur] + (dx !== 0 && dy !== 0 ? 1.4 : 1); q.push(ni);
        }
      }
      navMemo.f[goal] = dist;
      return dist;
    }
    function waypoint(fx, fy, tx, ty, now) {                  // el siguiente punto hacia (tx,ty): directo si hay línea libre, si no, por la rejilla
      if (los(fx, fy, tx, ty)) return { x: tx, y: ty };
      var df = campoDist(nearFree(cellOf(tx, ty)), now), ci = nearFree(cellOf(fx, fy)), cx = ci % GW, cy = Math.floor(ci / GW), best = -1, bd = 1e9, dd;
      for (dd = 0; dd < 8; dd++) {
        var nx = cx + [1, -1, 0, 0, 1, 1, -1, -1][dd], ny = cy + [0, 0, 1, -1, 1, -1, 1, -1][dd]; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        var ni = ny * GW + nx, v = df[ni]; if (v >= 0 && v < bd) { bd = v; best = ni; }
      }
      if (best < 0) return { x: tx, y: ty };
      return { x: (best % GW) * CELL + CELL / 2, y: Math.floor(best / GW) * CELL + CELL / 2 };
    }

    /* ───── golpes (periodicazos) ───── */
    function addSwing(p, d) {
      if (!d || typeof d !== 'object' || !num(d.k) || !num(d.x) || !num(d.y) || !num(d.a) || !num(d.t)) return false;
      if (d.k % 1 !== 0 || d.k < 0 || d.k > 9999 || Math.floor(d.k / 100) !== p || swK[d.k]) return false;
      var a = d.a / 180 * Math.PI, s = { k: d.k, p: p, x: cl(d.x, AX0, AX1), y: cl(d.y, AY0, AY1), a: a, t: d.t / 1000, zx: 0, zy: 0 };
      s.zx = s.x + Math.cos(a) * REACH; s.zy = s.y + Math.sin(a) * REACH;
      swK[s.k] = s; swings.push(s);
      if (swings.length > 24) { var o = swings.shift(); delete swK[o.k]; }
      var q = P[p]; q.nextSw = Math.max(q.nextSw, s.t + SWCDK[fase(s.t)]); q.seq = Math.max(q.seq, (d.k % 100) + 1); q.fa = a;
      if (s.t - c.ahora() > -0.3 && !v3) SND(300, 0.25, 'sawtooth', 0.04, 180);   // en 3D: V3.sfx al levantar el periódico
      return true;
    }
    function activo(s, now) { return now >= s.t + WIND && now <= s.t + WIND + ACT; }
    function enAire(now) { var u = now - P[soloI].tj; return u >= 0 && u < JUMP; }
    function pendiente(s, now) { return now <= s.t + WIND + ACT + 0.02; }

    function registerHit(d) {
      if (!d || !num(d.k) || d.k % 1 !== 0 || d.k < 0 || d.k > 9999 || hitSet[d.k]) return;
      var l = d.l === L2 ? L2 : L1, add = Math.min(l, START - net()), now = c.ahora();
      hitSet[d.k] = 1;
      if (add <= 0) return;
      gross += add; lastSand = l === L2; lastHitT = now;
      var pw = Math.floor(d.k / 100), hx = num(d.x) ? cl(d.x, AX0, AX1) : P[soloI].x, hy = num(d.y) ? cl(d.y, AY0, AY1) : P[soloI].y, j;
      if (pw >= 0 && pw < n && !isSolo(pw)) P[pw].hitN++;
      for (j = 0; j < add; j++) {                                // monedas sembradas de forma determinista
        var ang = ((d.k * 7 + j * 3) % 8) / 8 * 6.2832 + 0.4, rad = 22 + ((d.k + j * 5) % 3) * 11, cx = hx + Math.cos(ang) * rad, cy = hy + Math.sin(ang) * rad, o = { x: cx, y: cy };
        resolve(o, 6, true); coins.push({ id: d.k * 10 + j, x: o.x, y: o.y, t0: now, got: false });
      }
      var q = P[soloI]; q.stg = now + STG; shake = c.mio(soloI) ? 0.7 : 0.3; flash = c.mio(soloI) ? 1 : 0.4;
      if (lv === 3 && !turboUsed && gross >= 6) { turboUsed = true; turboUntil = now + TURBO_T; }
      if (net() >= PIERDE_NET && hitAt16 < 0) hitAt16 = now;
      var sa = punto(q.x + 16, q.y, -84, EH + 1.4), tx = l === L2 ? '¡SÁNDWICH!' : GRITOS[Math.floor(c.fx() * GRITOS.length) % GRITOS.length];
      if (l === L2) { sandAt = now; sandN++; }
      S(tx, sa.x, sa.y, l === L2 ? '#ff5a4e' : '#ffd23f');
      if (v3) golpe3D(l, pw);
      else { var G = geom(), sb = scr(G, q.x, q.y - 30); SPAWN(sb.x, sb.y, l === L2 ? 18 : 10, 'conf', ['#ffd23f', '#f0a020', '#fff'], 300, 500, 0.8); SND(150, 0.25, 'sawtooth', 0.08, -90); }
    }
    function bonoDe(id) { var j, k2; for (j = 0; j < EVS.length; j++) if (EVS[j].mon) for (k2 = 0; k2 < EVS[j].mon.length; k2++) if (EVS[j].mon[k2].id === id) return EVS[j].mon[k2]; return null; }
    function registerRec(d) {
      if (!d || !num(d.i) || d.i % 1 !== 0 || recSet[d.i]) return;
      if (d.i >= 90000) {                                          // moneda del cajero: sin tope, cuenta una vez (no depende del reloj de cada pantalla)
        var bm = bonoDe(d.i); if (!bm || hitAt16 >= 0) return;
        recSet[d.i] = 1; bm.got = true; recB++;
        if (v3) recoge3D(bm);
        else { var G2 = geom(), sb2 = scr(G2, bm.x, bm.y - 12); SPAWN(sb2.x, sb2.y, 7, 'conf', ['#5cff7a', '#ffd23f', '#fff'], 180, 300, 0.5); SND(990, 0.12, 'square', 0.05, 260); }
        return;
      }
      if (hitAt16 >= 0 || net() >= PIERDE_NET || recN >= Math.floor(gross / 2)) return;
      var j, co = null;
      for (j = 0; j < coins.length; j++) if (coins[j].id === d.i && !coins[j].got) { co = coins[j]; break; }
      if (!co) return;
      co.got = true; recSet[d.i] = 1; recN++;
      if (v3) recoge3D(co);
      else { var G = geom(), sb = scr(G, co.x, co.y - 12); SPAWN(sb.x, sb.y, 5, 'conf', ['#ffd23f', '#fff'], 160, 300, 0.5); SND(880, 0.1, 'square', 0.05, 200); }
    }

    /* ───── juicio y recogida: cada dueño juzga SU cuerpo (aquí el solo) ───── */
    function protegido(now) {                                      // 0 nada, 1 aire, 2 toldo, 3 banco (o recién salido)
      var q = P[soloI];
      if (now < q.bank) return 3;
      if (enAire(now) || now < q.prot) return 1;
      if (toldoSirve(toldoDe(q.x, q.y), now)) return 2;
      return 0;
    }
    function protRemoto(q) { return q.remA === 3 ? 3 : q.remA === 2 ? 2 : q.remA === 1 ? 1 : 0; }
    function solProt(now) { return c.mio(soloI) ? protegido(now) : protRemoto(P[soloI]); }
    function juzga(now) {
      var q = P[soloI], j, s;
      if (protegido(now)) return;
      for (j = 0; j < swings.length; j++) {
        s = swings[j];
        if (hitSet[s.k] || !activo(s, now)) continue;
        if (hyp(q.x - s.zx, q.y - s.zy) < ZR + SBODY) {
          var L = (now - lastHitT <= SAND && !lastSand) ? L2 : L1;
          c.ev('hit', { k: s.k, l: L, x: Math.round(q.x), y: Math.round(q.y) }, soloI);
          break;                                                 // un solo golpe por cuadro: el sándwich lo completa el siguiente
        }
      }
    }
    function recoge(now) {
      var q = P[soloI], j, e2, k2;
      if (now < q.bank) return;
      for (j = 0; j < EVS.length && hitAt16 < 0; j++) {            // las del cajero: sin tope
        e2 = EVS[j]; if (!e2.mon || now < e2.t + e2.w + 0.35 || now > e2.t + e2.w + e2.d) continue;
        for (k2 = 0; k2 < e2.mon.length; k2++) { var bm = e2.mon[k2]; if (!bm.got && !recSet[bm.id] && hyp(q.x - bm.x, q.y - bm.y) < PICK + 2) c.ev('rec', { i: bm.id }, soloI); }
      }
      if (hitAt16 >= 0 || net() >= PIERDE_NET || recN >= Math.floor(gross / 2)) return;
      for (j = 0; j < coins.length; j++) {
        var co = coins[j];
        if (co.got || now > co.t0 + COIN_LIFE) continue;
        if (hyp(q.x - co.x, q.y - co.y) < PICK) { c.ev('rec', { i: co.id }, soloI); if (recN >= Math.floor(gross / 2)) return; }
      }
    }

    /* ───── movimiento ───── */
    function velo(q, dt) { if (dt > 0) { q.vx = q.vx * 0.75 + (q.x - q.px) / dt * 0.25; q.vy = q.vy * 0.75 + (q.y - q.py) / dt * 0.25; } q.px = q.x; q.py = q.y; }
    function winding(p, now) { var j, s; for (j = swings.length - 1; j >= 0; j--) { s = swings[j]; if (s.p === p && now >= s.t && now <= s.t + WIND + ACT) return s; } return null; }
    function soloSpeed(now) { var q = P[soloI]; return colaK(q.x, q.y, now) * spdSolo * (now < q.stg ? STGMOV : 1) * (now < turboUntil ? TURBO_K : 1) * (now < q.boost ? BOOST_K : 1) * (now - q.tj >= 0 && now - q.tj < DASH_T ? DASH_K : 1); }
    function trioSpeed(p, now) { return colaK(P[p].x, P[p].y, now) * TS * TSK[fase(now)] * (now < P[p].stun ? 0.35 : 1); }
    function calle(p, q, dt, now) {                                // lo que la calle le hace a MI cuerpo: viento, camionetica (cada dueño juzga el suyo)
      var vv = vientoV(now), e = evEn('bus', now, false), solo = isSolo(p);
      if (solo && now < q.bank) return;
      if (vv) { q.x += vv * dt; resolve(q, RB); }
      if (solo) { var ec = evEn('cafe', now, false); if (ec && !cafeUsed[ec.i] && hyp(q.x - ec.x, q.y - ec.y) < CAFE_R + RB) { cafeUsed[ec.i] = 1; q.boost = now + CAFE_T; if (c.mio(p)) S('¡CAFECITO!', q.x, q.y - 20, '#5cff7a'); } }
      if (e) {
        var bx = busX(e, now);
        if (Math.abs(q.x - bx) < BUS_L / 2 + RB && Math.abs(q.y - e.y) < BUS_H / 2 + RB && !(solo && protegido(now) === 3)) {
          q.y = q.y < e.y ? e.y - BUS_H / 2 - RB - 3 : e.y + BUS_H / 2 + RB + 3; q.x += e.dir * 14; resolve(q, RB);
          if (solo) { if (now >= q.stg) { q.stg = now + STG; if (c.mio(p)) { shake = 0.6; flash = 0.5; } } }
          else if (now >= q.stun) q.stun = now + STUN;
          if (q.bump !== e.i) { q.bump = e.i; if (v3) { V3.sfx('choque'); v3.esc.sacudir(.5); } else SND(120, 0.3, 'sawtooth', 0.07, -60); }
        }
      }
    }
    function bancoSolo(q, now) {                                   // entrar y salir del banco (sólo el dueño del solo)
      if (now < q.bank) { q.x = DOOR_X; q.y = AY0 + RB; return true; }
      if (q.bank > 0 && q.bank <= now && q.bankOut !== q.bank) {   // sale con impulso
        q.bankOut = q.bank; q.y = AY0 + RB + 34; q.prot = now + BANK_GR; q.boost = now + BOOST_T; resolve(q, RB);
      }
      var e = bancoAbierto(now);
      if (e && !bankUsed[e.i] && hyp(q.x - DOOR_X, q.y - AY0) < DOOR_R + RB) { bankUsed[e.i] = 1; q.bank = now + BANK_T; q.x = DOOR_X; q.y = AY0 + RB; if (v3) V3.sfx('ding'); return true; }
      return false;
    }
    function toldos(q, now, protTol) {                             // el aguante de los toldos (en el dueño, por la posición; en las demás, por a = 2)
      var j = toldoDe(q.x, q.y), dt2 = Math.max(0, now - (q.tolT || now)); q.tolT = now;
      if (j >= 0 && protTol && toldoSirve(j, now)) {
        toldo[j].uso += dt2;
        if (toldo[j].uso >= TOLDO_T) { toldo[j].uso = 0; toldo[j].cae = now + TOLDO_CD; anuncia('¡SE CAYÓ EL TOLDO!', '#ff9a3c'); if (v3) V3.sfx('caida'); else SND(200, 0.3, 'triangle', 0.06, -120); }
      }
    }
    function doSwing(p, now) {
      var q = P[p], so = P[soloI], a = q.fa, ax, ay;
      if (q.aim && q.aim.until >= now) a = q.aim.a;
      else {                                                    // ayuda de apuntado: si el bono está cerca, el periódico va hacia donde estará
        ax = so.x + so.vx * 0.3; ay = so.y + so.vy * 0.3;
        var dd = hyp(ax - q.x, ay - q.y);
        if (dd < 120 && dd > 1) a = Math.atan2(ay - q.y, ax - q.x);
      }
      q.aim = null;
      var deg = Math.round(a * 180 / Math.PI); if (deg < 0) deg += 360;
      c.ev('sw', { k: p * 100 + q.seq, x: Math.round(q.x), y: Math.round(q.y), a: deg % 360, t: Math.round(now * 1000) }, p);
    }
    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        var r = c.remoto(p);
        if (r) { q.x = r.x; q.y = r.y; q.remA = r.a; if (!isSolo(p) && num(r.d)) q.fa = r.d / 16 * 6.2832; }
        if (isSolo(p)) toldos(q, now, q.remA === 2);
        velo(q, dt);
        return;
      }
      var e = c.eje(p), taps = c.tap(p, 'a'), m = hyp(e.x, e.y);
      if (m > 1) { e = { x: e.x / m, y: e.y / m }; m = 1; }
      if (isSolo(p)) {
        if (now >= 0 && bancoSolo(q, now)) { velo(q, dt); return; }
        var sp = soloSpeed(now), dash = now - q.tj >= 0 && now - q.tj < DASH_T;
        if (dash && hyp(q.jx, q.jy) > 0.2) { e = { x: e.x * 0.35 + q.jx * 0.65, y: e.y * 0.35 + q.jy * 0.65 }; }
        q.x += e.x * sp * dt; q.y += e.y * sp * dt; resolve(q, RB);
        if (taps > 0 && now >= 0 && now >= q.tj + JCD) { q.tj = now; q.jx = m > 0.2 ? e.x : 0; q.jy = m > 0.2 ? e.y : 0; if (p === c.yo && !v3) SND(520, 0.12, 'square', 0.05); }
        if (now >= 0) { calle(p, q, dt, now); toldos(q, now, protegido(now) === 2); }
      } else {
        var wn = winding(p, now), v = trioSpeed(p, now) * (wn ? WINDMOV : 1);
        if (m > 0.2 && !wn) q.fa = Math.atan2(e.y, e.x);
        q.x += e.x * v * dt; q.y += e.y * v * dt; resolve(q, RB);
        if (now >= 0) calle(p, q, dt, now);
        if (taps > 0 && now >= 0 && now >= q.nextSw && !wn && now >= q.stun) doSwing(p, now);
      }
      velo(q, dt);
    }

    /* ───── IA ───── */
    function lapso(sk, R2, base) { return R2.next() < base * (1 - sk); }
    function zonaPeligro(x, y, now) {                            // ¿(x,y) cae dentro de algún círculo de golpe que aún no pasó?
      var j, s;
      for (j = 0; j < swings.length; j++) { s = swings[j]; if (pendiente(s, now) && !hitSet[s.k] && hyp(x - s.zx, y - s.zy) < ZR + SBODY + 5) return true; }
      return false;
    }
    function evitaBus(y, now, m) {                                 // ¿la camionetica (avisando o pasando) barre esta fila?
      var e = evEn('bus', now, true);
      return !!e && Math.abs(y - e.y) < BUS_H / 2 + RB + m;
    }
    function calleBono(cx2, cy2, now, margen, tmin, conMonedas) {  // lo que la calle le suma o le resta a una casilla para el solo
      var sc = 0, j, e = bancoAbierto(now);
      if (evitaBus(cy2, now, 8)) sc -= 25;
      if (e && !bankUsed[e.i] && hyp(cx2 - DOOR_X, cy2 - AY0) < DOOR_R + 14 && margen > -0.5) sc += 7;
      var tj = toldoDe(cx2, cy2); if (tj >= 0 && toldoSirve(tj, now) && toldo[tj].uso < TOLDO_T - 0.4 && tmin < 6) sc += 3;
      if (conMonedas && margen > 1.5) for (j = 0; j < EVS.length; j++) {
        var e2 = EVS[j]; if (!e2.mon || now < e2.t || now > e2.t + e2.w + e2.d - 0.6) continue;
        for (var k2 = 0; k2 < e2.mon.length; k2++) if (!e2.mon[k2].got && hyp(e2.mon[k2].x - cx2, e2.mon[k2].y - cy2) < 22) { sc += 3; j = EVS.length; break; }
      }
      return sc;
    }
    var escMemo = { b: -1, v: null };
    function bestEscape(now, R2, sk) {                           // la casilla a la que el solo llega con más ventaja sobre el más cercano del trío (distancia por camino); sk<1 mete ruido
      var q = P[soloI], b = Math.floor(now * 8);
      if (sk >= 1 && escMemo.b === b) return escMemo.v;
      var sped = soloSpeed(now), rat = sped / TS, dS = campoDist(nearFree(cellOf(q.x, q.y)), now), dT = [], a2, ci, bestC = -1, bestS = -1e9, ccx = q.x, ccy = q.y, cj, bm = 0;
      for (a2 = 0; a2 < trio.length; a2++) dT.push(campoDist(nearFree(cellOf(P[trio[a2]].x, P[trio[a2]].y)), now));
      for (ci = 0; ci < GW * GH; ci++) {
        if (blocked[ci] || dS[ci] < 0 || dS[ci] > 9) continue;
        var tmin = 99, cx2 = (ci % GW) * CELL + CELL / 2, cy2 = Math.floor(ci / GW) * CELL + CELL / 2;
        for (a2 = 0; a2 < dT.length; a2++) { var dv = dT[a2][ci]; if (dv >= 0 && dv < tmin) tmin = dv; }
        var margen = tmin - dS[ci] / rat, sc3 = Math.min(margen, 8) + Math.min(tmin, 10) * 0.35;
        if (margen < 0.5) sc3 -= 4;
        if (zonaPeligro(cx2, cy2, now)) sc3 -= 30;
        var edge = Math.min(cx2 - AX0, AX1 - cx2, cy2 - AY0, AY1 - cy2); if (edge < 30) sc3 -= (30 - edge) * 0.06;
        sc3 += calleBono(cx2, cy2, now, margen, tmin, R2 !== null);
        if (R2 === null) { /* sin monedas ni ruido: la predicción del trío */ }
        else {
          if (margen > 3 && recN < Math.floor(gross / 2)) for (cj = 0; cj < coins.length; cj++) { var co = coins[cj]; if (!co.got && now < co.t0 + COIN_LIFE - 0.8 && hyp(co.x - cx2, co.y - cy2) < 22) { sc3 += 2.5; break; } }
          sc3 += R2.next() * 4 * (1 - sk);
        }
        if (sc3 > bestS) { bestS = sc3; bestC = ci; ccx = cx2; ccy = cy2; bm = margen; }
      }
      var res = { ci: bestC, x: ccx, y: ccy, m: bm };
      if (sk >= 1) escMemo = { b: b, v: res };
      return res;
    }
    function aiSolo(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], j, s, rt = 0.18 + 0.22 * (1 - sk);
      if (now < 0 || now < q.bank) { api.eje(0, 0); return; }
      for (j = 0; j < swings.length; j++) { s = swings[j]; if (!pl.rx[s.k] && now >= s.t + rt) { pl.rx[s.k] = 1; pl.re = now; } }   // reacciona a un golpe nuevo tras su tiempo de reacción
      if (now >= pl.re) {
        pl.re = now + Math.max(0.18, 0.3 - 0.15 * sk) + R2.next() * 0.06;
        var sped = soloSpeed(now), E = bestEscape(now, R2, sk), ccx = E.x, ccy = E.y;
        var wp = waypoint(q.x, q.y, ccx, ccy, now), wx = wp.x - q.x, wy = wp.y - q.y, wl = hyp(wx, wy);
        pl.dx = wl > 3 ? wx / wl : 0; pl.dy = wl > 3 ? wy / wl : 0; pl.danger = false;
        for (j = 0; j < swings.length; j++) {                    // ¿seguir así me deja dentro de un golpe que viene?
          s = swings[j];
          if (!pendiente(s, now) || hitSet[s.k]) continue;
          var ti = Math.max(0, s.t + WIND - now), o2 = { x: q.x + pl.dx * sped * Math.min(ti, 0.5), y: q.y + pl.dy * sped * Math.min(ti, 0.5) };
          resolve(o2, RB);
          if (hyp(o2.x - s.zx, o2.y - s.zy) < ZR + SBODY + 4) pl.danger = true;
        }
      }
      api.eje(pl.dx, pl.dy);
      /* salto: sólo si el golpe que viene no se puede esquivar corriendo */
      var amen = false;
      for (j = 0; j < swings.length; j++) { s = swings[j]; if (pendiente(s, now) && !hitSet[s.k] && now >= s.t + rt && s.t + WIND - now < 0.3 && hyp(q.x - s.zx, q.y - s.zy) < ZR + SBODY + 10 && now < s.t + WIND + ACT) amen = true; }
      if (amen && pl.danger && !protegido(now) && now >= q.tj + JCD && now >= pl.jAt) {
        if (lapso(sk, R2, 0.25)) pl.jAt = now + 0.3; else { api.press('a'); pl.jAt = now + 0.2; }
      }
    }
    function aiTrio(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], so = P[soloI], wn = winding(p, now), j;
      if (now < 0) { api.eje(0, 0); return; }
      if (now >= pl.re) {
        pl.re = now + Math.max(0.18, 0.3 - 0.15 * sk) + R2.next() * 0.05;
        var lead = 0.25 + 0.5 * sk, px = so.x + so.vx * lead, py = so.y + so.vy * lead, hd = hyp(so.vx, so.vy) > 25 ? Math.atan2(so.vy, so.vx) : Math.atan2(q.y - so.y, q.x - so.x);
        var off = [0, 2.2, -2.2][slot[p] % 3], dist = hyp(px - q.x, py - q.y), tx, ty;
        if (slot[p] > 0 && R2.next() < 0.3 + 0.7 * sk) {                                      // los de los lados le cierran la salida: van a donde el bono querría ir
          var E = bestEscape(now, null, 1);
          if (slot[p] === 1) { tx = E.x; ty = E.y; } else { tx = (E.x + px) / 2; ty = (E.y + py) / 2; }
        }
        else if (dist < 85) { tx = px + Math.cos(hd + off) * 20; ty = py + Math.sin(hd + off) * 20; }          // ya cerca: ir al bono, cada quien por su lado
        else { tx = px + Math.cos(hd + off) * 50; ty = py + Math.sin(hd + off) * 50; }         // rodearlo: uno por delante, dos por los lados
        var eb = evEn('bus', now, true);
        if (eb && R2.next() < 0.5 + 0.5 * sk && Math.abs(q.y - eb.y) < BUS_H / 2 + RB + 30) { tx = q.x; ty = q.y < eb.y ? eb.y - BUS_H - 30 : eb.y + BUS_H + 30; }   // ¡la camionetica!
        var wp = waypoint(q.x, q.y, cl(tx, AX0 + 10, AX1 - 10), cl(ty, AY0 + 10, AY1 - 10), now);
        pl.tx = wp.x; pl.ty = wp.y;
      }
      var dx = pl.tx - q.x, dy = pl.ty - q.y, dm = hyp(dx, dy);
      var mx = dm > 6 ? dx / dm : 0, my2 = dm > 6 ? dy / dm : 0;
      for (j = 0; j < trio.length; j++) if (trio[j] !== p) { var o2 = P[trio[j]], sx = q.x - o2.x, sy = q.y - o2.y, sd = hyp(sx, sy); if (sd < 44 && sd > 0.5) { mx += sx / sd * (44 - sd) / 44 * 1.5; my2 += sy / sd * (44 - sd) / 44 * 1.5; } }   // no se amontonan
      var ml = hyp(mx, my2); if (ml > 1) { mx /= ml; my2 /= ml; }
      if (wn) api.eje(0, 0); else api.eje(mx, my2);
      if (now < q.nextSw || wn || now < pl.swRe || now < q.grace || now < q.stun) return;
      var ldw = 0.3 + 0.6 * sk, ax = so.x + so.vx * (WIND + 0.05) * ldw, ay = so.y + so.vy * (WIND + 0.05) * ldw;
      var dd = hyp(ax - q.x, ay - q.y), otro = false;
      for (j = 0; j < trio.length; j++) if (trio[j] !== p) { var w2 = winding(trio[j], now); if (w2 && now - w2.t < 0.3) otro = true; }
      var rngMax = REACH + ZR * (otro ? 1.1 : 0.82);
      if (dd <= rngMax) {
        var pr = solProt(now), queda = pr >= 2 ? 9 : c.mio(soloI) ? (enAire(now) ? JUMP - (now - so.tj) : 0) : (pr === 1 ? 0.25 : 0);
        if (queda > 0.2) { pl.swRe = now + 0.1; return; }                                  // no pegarle al aire
        pl.swRe = now + 0.15 + R2.next() * 0.1;
        if (R2.next() < (otro ? 0.95 : 0.45 + 0.4 * sk)) {
          var err = (R2.next() + R2.next() - 1) * ERR0 * (1 - sk);
          q.aim = { a: Math.atan2(ay - q.y, ax - q.x) + err, until: now + 0.2 };
          api.press('a');
        }
      }
    }

    /* ───── dibujo (solo rr / ell / line / poly / txt / pj) ───── */
    function monedaD(x, y, r, vida) {
      if (vida < 1.2 && Math.floor(absT * 10) % 2) return;
      ell(x, y + r * 0.7, r, r * 0.4, 'rgba(20,16,28,.3)', 0);
      ell(x, y, r, r, '#ffd23f', 2.5); ell(x, y, r * 0.55, r * 0.55, '#f0a020', 0); ell(x - r * 0.3, y - r * 0.3, r * 0.2, r * 0.2, '#fff6c0', 0);
    }
    function fondo(f, G) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, k;
      rr(x0, 0, w, 150, 0, pal.cielo, 0); rr(x0, 80, w, 70, 0, pal.cielo2, 0);
      if (lv === 3) { for (k = 0; k < 14; k++) ell(x0 + ((k * 137) % w), 14 + (k * 29) % 60, 2, 2, '#fffdf2', 0); ell(x1 - 80, 40, 18, 18, pal.sol, 0); }
      else ell(lv === 1 ? x1 - 90 : x0 + 90, lv === 1 ? 42 : 100, 26, 26, pal.sol, 0);
      /* el banco al fondo */
      var bx = G.cx - 150, by = 74;
      rr(bx, by, 300, 76, 4, lv === 3 ? '#4a4468' : '#e9e1cf', 3.5);
      var kx; for (kx = 0; kx < 5; kx++) rr(bx + 14 + kx * 56, by + 22, 16, 54, 2, lv === 3 ? '#3a3458' : '#cfc6b0', 2.5);
      rr(bx + 100, by + 4, 100, 18, 4, '#2f5ea8', 3); txt('BANCO', G.cx, by + 13, 12, '#fffdf2', 0, true);
      var wx; for (wx = 0; wx < 2; wx++) rr(bx + 8 + wx * 270, by + 6, 20, 14, 2, lv === 3 ? '#f4e08a' : '#a8d8ff', 2);
    }
    function piso(G) {
      var wx = G.w / G.k + 8, k;
      rr(G.cx - wx / 2, G.oy - 6, wx, SH + 24, 0, pal.borde, 0);
      rr(G.ox - 8, G.oy - 2, SW + 16, SH + 8, 6, pal.piso, 3.5);
      for (k = 1; k < 8; k++) line([[G.ox + k * 55, G.oy + 2], [G.ox + k * 55, G.oy + SH + 2]], 1.5, pal.piso2);
      for (k = 1; k < 5; k++) line([[G.ox - 6, G.oy + k * 58], [G.ox + SW + 6, G.oy + k * 58]], 1.5, pal.piso2);
    }
    function obstaculosD(G) {
      var j, o;
      for (j = 0; j < OB.c.length; j++) {
        o = OB.c[j]; ell(G.ox + o[0], G.oy + o[1] + 6, o[2] + 4, o[2] * 0.5, 'rgba(20,16,28,.3)', 0);
        rr(G.ox + o[0] - o[2], G.oy + o[1] - 36, o[2] * 2, 44, 5, pal.muro2, 3.5); rr(G.ox + o[0] - o[2] - 3, G.oy + o[1] - 44, o[2] * 2 + 6, 12, 4, pal.muro, 3.5);
        txt('$', G.ox + o[0], G.oy + o[1] - 14, 14, '#ffd23f', 0, true);
      }
      for (j = 0; j < OB.r.length; j++) {
        o = OB.r[j]; rr(G.ox + o[0] - 2, G.oy + o[1] + o[3] - 6, o[2] + 4, 12, 3, 'rgba(20,16,28,.28)', 0);
        rr(G.ox + o[0], G.oy + o[1] - 26, o[2], o[3] + 22, 4, pal.muro, 3.5); rr(G.ox + o[0] + 3, G.oy + o[1] - 16, o[2] - 6, o[3] * 0.18, 2, pal.muro2, 0);
        var wy; for (wy = 0; wy < 3; wy++) rr(G.ox + o[0] + 4, G.oy + o[1] + 12 + wy * 42, o[2] - 8, 14, 2, lv === 3 ? '#f4e08a' : '#a8d8ff', 2);
      }
    }
    function persona(p, x, y, esSolo, air, stag, now) {
      var s = asiento(p), col = s.color || (esSolo ? '#ffd23f' : '#9a8cff'), alpha = stag ? (Math.floor(absT * 12) % 2 ? 0.55 : 1) : 1, jy = air ? Math.sin(cl((now - P[soloI].tj) / JUMP, 0, 1) * Math.PI) * 30 : 0;
      ctx.save(); ctx.globalAlpha = alpha;
      ell(x, y + 2, 20 - jy * 0.2, 6, 'rgba(20,16,28,.35)', 0);
      y -= jy;
      rr(x - 10, y - 24, 8, 22, 4, '#2f3a7a', 3); rr(x + 2, y - 24, 8, 22, 4, '#2f3a7a', 3);
      rr(x - 14, y - 58, 28, 36, 10, col, 3.5);
      c.util.pj(s.ch, x, y - 74, 60, { animo: stag ? 'perder' : (air ? 'celebrar' : null), sombra: false });
      if (esSolo) { rr(x + 9, y - 44, 18, 20, 5, '#2f8a3f', 3); txt('$', x + 18, y - 34, 12, '#ffd23f', 0, true); }
      if (p === c.yo) poly([[x - 8, y - 124], [x + 8, y - 124], [x, y - 111]], '#ffd23f', 3);
      ctx.restore();
    }
    function periodico(q, s, now, x, y) {                         // el periódico enrollado: levantado durante el aviso y barre al golpear
      var a, u, hx = x + Math.cos(q.fa + 1.4) * 10, hy = y - 40, len = 30;
      if (s) {
        u = cl((now - s.t) / (WIND + ACT * 0.6), 0, 1);
        a = s.a - 1.5 + 1.9 * u * u;
        hx = x + Math.cos(s.a + 1.4) * 10;
        line([[hx, hy], [hx + Math.cos(a) * len, hy + Math.sin(a) * len * 0.55 - (1 - u) * 18]], 9, INK);
        line([[hx, hy], [hx + Math.cos(a) * len, hy + Math.sin(a) * len * 0.55 - (1 - u) * 18]], 6, '#f1ecd8');
      } else {
        line([[hx, hy], [hx + Math.cos(q.fa) * 8, hy + 18]], 9, INK); line([[hx, hy], [hx + Math.cos(q.fa) * 8, hy + 18]], 6, '#f1ecd8');
      }
    }
    function zonaD(G, now) {                                       // la telegrafía: el círculo del golpe se llena durante el aviso
      var j, s;
      for (j = 0; j < swings.length; j++) {
        s = swings[j]; var u = (now - s.t) / WIND;
        if (u < -0.05 || now > s.t + WIND + ACT + 0.12) continue;
        var act = now >= s.t + WIND, fill = act ? 0.55 : 0.12 + 0.3 * cl(u, 0, 1);
        ctx.save(); ctx.globalAlpha = fill; ell(G.ox + s.zx, G.oy + s.zy, ZR, ZR, act ? '#ffffff' : '#ff3b4e', 0); ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.9; if (!act) ell(G.ox + s.zx, G.oy + s.zy, ZR * (1 - cl(u, 0, 1)) + 3, ZR * (1 - cl(u, 0, 1)) + 3, 'rgba(255,255,255,.0)', 3); ctx.restore();
      }
    }

    function calle2D(G, now) {                                    // toldos, puerta del banco, camionetica, carrito, viento y monedas del cajero (2D de respaldo)
      var j, e, ox = G.ox, oy = G.oy, pis = Math.floor(absT * 6) % 2;
      for (j = 0; j < TOLDOS.length; j++) {
        var tx = ox + TOLDOS[j][0], ty = oy + TOLDOS[j][1], ok = toldoSirve(j, now);
        ell(tx, ty + 4, TOLDO_R, TOLDO_R * 0.45, 'rgba(20,16,28,.25)', 0);
        if (ok) { var k; for (k = 0; k < 4; k++) rr(tx - TOLDO_R + k * TOLDO_R / 2, ty - 46, TOLDO_R / 2, 16, 2, k % 2 ? '#fffdf2' : (j ? '#3fa9ff' : '#ff5a4e'), 2); line([[tx - TOLDO_R + 3, ty - 30], [tx - TOLDO_R + 3, ty]], 3, INK); line([[tx + TOLDO_R - 3, ty - 30], [tx + TOLDO_R - 3, ty]], 3, INK); txt(Math.max(0, TOLDO_T - toldo[j].uso).toFixed(1), tx, ty - 54, 10, '#fffdf2', 0, true); }
        else { rr(tx - TOLDO_R, ty - 8, TOLDO_R * 2, 10, 2, '#8a8a96', 2); txt(Math.ceil(toldo[j].cae - now) + ' s', tx, ty - 16, 10, '#fffdf2', 0, true); }
      }
      var eb = bancoAbierto(now), avB = evEn('banco', now, true);
      if (avB) { rr(ox + DOOR_X - DOOR_R, oy + AY0 - 10, DOOR_R * 2, 18, 4, eb ? (bankUsed[eb.i] ? '#8a8a96' : (pis ? '#5cff7a' : '#2fa04a')) : '#ffd23f', 2.5); txt(eb ? (bankUsed[eb.i] ? 'CERRADO' : 'ABIERTO') : '¡YA ABREN!', ox + DOOR_X, oy + AY0 - 1, 10, INK, 0, true); }
      e = evEn('bus', now, true);
      if (e) {
        if (now < e.t + e.w) { if (pis) { ctx.save(); ctx.globalAlpha = 0.35; rr(ox + AX0, oy + e.y - BUS_H / 2, AX1 - AX0, BUS_H, 3, '#ff3b4e', 0); ctx.restore(); } txt(e.dir > 0 ? '▶ ▶ ▶' : '◀ ◀ ◀', ox + (e.dir > 0 ? AX0 + 30 : AX1 - 30), oy + e.y + 4, 16, '#ff3b4e', 0, true); }
        else { var bx = ox + busX(e, now); rr(bx - BUS_L / 2, oy + e.y - BUS_H / 2 - 20, BUS_L, BUS_H + 14, 6, '#fffdf2', 3); rr(bx - BUS_L / 2 + 4, oy + e.y - BUS_H / 2 - 14, BUS_L - 8, 12, 3, '#2f5ea8', 2); rr(bx - BUS_L / 2, oy + e.y - 2, BUS_L, 6, 0, '#ff5a4e', 0); ell(bx - BUS_L / 3, oy + e.y + BUS_H / 2 - 4, 7, 7, INK, 0); ell(bx + BUS_L / 3, oy + e.y + BUS_H / 2 - 4, 7, 7, INK, 0); }
      }
      var ca = carroPos(now);
      if (ca) { rr(ox + ca.x - CAR_W, oy + ca.y - CAR_H - 10, CAR_W * 2, CAR_H * 2 + 6, 4, '#ff9ec7', 2.5); line([[ox + ca.x, oy + ca.y - CAR_H - 10], [ox + ca.x, oy + ca.y - CAR_H - 34]], 2, INK); ell(ox + ca.x, oy + ca.y - CAR_H - 36, 22, 8, '#ffd23f', 2); }
      else { e = evEn('carrito', now, true); if (e) txt('¡RASPAO!', ox + (e.dir > 0 ? AX0 + 34 : AX1 - 34), oy + e.y, 12, '#ff9ec7', 0, true); }
      e = evEn('cafe', now, true);
      if (e && !cafeUsed[e.i]) { ell(ox + e.x, oy + e.y, 14, 6, '#5cff7a', 0); rr(ox + e.x - 6, oy + e.y - 14, 12, 12, 3, '#fffdf2', 2); txt('CAFÉ', ox + e.x, oy + e.y - 20, 9, '#5cff7a', 0, true); }
      e = evEn('cola', now, true);
      if (e) { ctx.save(); ctx.globalAlpha = now < e.t + e.w ? 0.25 : 0.5; ell(ox + e.x, oy + e.y, COLA_R, COLA_R * 0.7, '#ff9a3c', 0); ctx.restore(); txt('¡COLA!', ox + e.x, oy + e.y, 11, '#fffdf2', 0, true); }
      var vv = vientoV(now);
      if (vv) for (j = 0; j < 6; j++) { var wy = oy + 40 + j * 44, wx = ox + ((absT * vv * 4 + j * 97) % SW + SW) % SW; line([[wx, wy], [wx + (vv > 0 ? -30 : 30), wy]], 2, 'rgba(255,255,255,.7)'); }
      for (j = 0; j < EVS.length; j++) {
        e = EVS[j]; if (!e.mon || now < e.t + e.w || now > e.t + e.w + e.d) continue;
        for (var k2 = 0; k2 < e.mon.length; k2++) if (!e.mon[k2].got) { monedaD(ox + e.mon[k2].x, oy + e.mon[k2].y - 4, 8, e.t + e.w + e.d - now); txt('+1', ox + e.mon[k2].x, oy + e.mon[k2].y - 16, 9, '#5cff7a', 0, true); }
      }
    }
    function anuncioD(cx, y, big) {                                // el cartel grande de eventos y fases
      var u = absT - anuncio.t; if (u < 0 || u > 1.5 || !anuncio.s) return;
      var ps = 1 + Math.max(0, .25 - u) * 1.6;
      txt(anuncio.s, cx, y, 22 * big * ps, anuncio.col, 0, false);
    }
    function dibujar2D() {
      var f = cp(), G = geom(), now = c.ahora(), p, k, j, yo = c.yo;
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
      ctx.save(); ctx.translate(sxk, syk);
      fondo(f, G);
      ctx.save(); ctx.translate(G.cx, PIVY); ctx.scale(G.k, G.k); ctx.translate(-G.cx, -PIVY);
      piso(G);
      zonaD(G, now);
      calle2D(G, now);
      for (j = 0; j < coins.length; j++) { var co = coins[j]; if (!co.got) monedaD(G.ox + co.x, G.oy + co.y - 4 + Math.sin(absT * 6 + j) * 2, 7, co.t0 + COIN_LIFE - now); }
      obstaculosD(G);
      var ord = [], pos = [];
      for (p = 0; p < n; p++) ord.push(p);
      ord.sort(function (a, b) { return P[a].y - P[b].y; });
      for (k = 0; k < ord.length; k++) {
        p = ord[k]; var q = P[p], solo = isSolo(p);
        if (solo) {
          var air = c.mio(p) ? enAire(now) : q.remA === 1, stg = now < q.stg;
          if (solProt(now) === 3) { txt('$ ADENTRO $', G.ox + DOOR_X, G.oy + AY0 - 18, 12, '#5cff7a', 0, true); continue; }
          if (solProt(now) === 2) ell(G.ox + q.x, G.oy + q.y, 18, 7, 'rgba(92,255,122,.5)', 0);
          persona(p, G.ox + q.x, G.oy + q.y, true, air, stg, now);
          txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), G.ox + q.x, G.oy + q.y + 14, 11, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
          if (now < turboUntil) txt('¡TURBO!', G.ox + q.x, G.oy + q.y - 132, 14, '#5cff7a', 0, true);
        } else {
          var wn = winding(p, now);
          persona(p, G.ox + q.x, G.oy + q.y, false, false, false, now);
          periodico(q, wn, now, G.ox + q.x, G.oy + q.y);
          if (wn && now < wn.t + WIND) txt('!', G.ox + q.x, G.oy + q.y - 128, 26, '#ff3b4e', 0, true);
          if (now < q.stun) txt('@', G.ox + q.x, G.oy + q.y - 116, 16, '#ffd23f', 0, true);
          txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), G.ox + q.x, G.oy + q.y + 14, 11, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
        }
      }
      ctx.restore(); ctx.restore();
      /* el bono: marcador grande arriba (y>=70), bajo la zona de burbujas del HUD */
      var cn = START - net(), my = 86;
      rr(G.cx - 96, my - 16, 192, 32, 10, 'rgba(20,16,28,.78)', 0);
      ell(G.cx - 72, my, 10, 10, '#ffd23f', 2.5);
      txt('BONO ' + cn + '/' + START, G.cx + 6, my + 1, 20, cn >= GANA_COINS ? '#5cff7a' : '#ff5a4e', 0, true);
      if (now - sandAt < 1.2) txt('¡SÁNDWICH!', G.cx, my + 34, 22, '#ff5a4e', 0, true);
      else anuncioD(G.cx, my + 60, G.w < 500 ? 0.75 : 1);
      if (fase(now) === 2 && now < dur && hitAt16 < 0) { ctx.save(); ctx.globalAlpha = 0.08 + 0.06 * Math.sin(absT * 8); rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ff3b4e', 0); ctx.restore(); }
      if (now > -0.5 && now < 2.2 && !c.practica) txt(isSolo(yo) ? '¡CORRE CON EL BONO!' : '¡QUÍTENLE EL BONO AL SEÑOR!', G.cx, my + 34, isSolo(yo) ? 22 : (G.w < 500 ? 13 : 16), '#fffdf2', 0, true);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.25; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ffffff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): la acera del banco. Solo dibujo: lee P, swings y coins; no toca la simulación ─────
       La regla se ve: el BONO (un sobre dorado) flota sobre el solo y se encoge con cada periodicazo; arriba, la barra del bono con la raya del 15;
       el círculo rojo del golpe se llena en el piso; el trío levanta el periódico (lanzar) y el solo se dobla (golpe) o se cae (caer, en el sándwich). */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ESX = 1 / 18, ESZ = 1.15 / 18, EH = 3.4;                // px de la simulación -> metros; EH = altura del sobre sobre el solo
    function WX(x) { return (x - SW / 2) * ESX; }
    function WZ(y) { return (y - SH / 2) * ESZ; }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', piso: '#d8d2c4', junta: '#b4ad9c', banco: '#f1ead8', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', piso: '#d6c4b2', junta: '#a8988a', banco: '#f4dcc0', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', piso: '#7a7488', junta: '#5a5468', banco: '#b8b0d0', noche: 1 }
    };
    var CONF3 = ['#ffd23f', '#ff5a4e', '#3fa9ff', '#5cff7a', '#ff9ec7'];
    function pinta3(x, col) { x.fillStyle = col; }                 // atajo para las texturas de canvas (no es el lienzo del motor)
    function periodico3D() {                                       // el periódico enrollado, en la mano derecha del trío
      var T = THREE, g3 = new T.Group();
      var r = V3.malla(new T.CylinderGeometry(.075, .085, .74, 8), '#f1ecd8', { g: .08 }); r.position.y = -.3; g3.add(r);
      var b1 = V3.malla(new T.CylinderGeometry(.09, .09, .06, 8), '#7a7a88', { borde: false }); b1.position.y = -.16; g3.add(b1);
      var b2 = V3.malla(new T.CylinderGeometry(.092, .092, .06, 8), '#7a7a88', { borde: false }); b2.position.y = -.46; g3.add(b2);
      g3.rotation.x = -.6;                                          // apunta hacia adelante
      return g3;
    }
    function sobre3D() {                                           // el bono: sobre dorado con su sello rojo
      var T = THREE, g3 = new T.Group();
      var tx = V3.texturaCanvas(128, 80, function (x, w, h) {
        pinta3(x, '#ffd23f'); x.fillRect(0, 0, w, h);
        pinta3(x, '#f0a020'); x.beginPath(); x.moveTo(0, 0); x.lineTo(w / 2, h * .55); x.lineTo(w, 0); x.closePath(); x.fill();
        pinta3(x, '#1f6a2f'); x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; x.fillText('BONO', w / 2, h - 10);
      });
      var cu = new T.Mesh(new T.BoxGeometry(1.15, .72, .08), new T.MeshToonMaterial({ map: tx, gradientMap: V3.toon('#fff').gradientMap, emissive: new T.Color('#a86a00'), emissiveIntensity: .35 }));
      V3.borde(cu, .06); g3.add(cu);
      var se = V3.malla(new T.SphereGeometry(.1, 8, 6), '#d8323a', { g: .1 }); se.position.set(0, .08, .06); se.scale.z = .5; g3.add(se);
      var se2 = se.clone(); se2.position.z = -.06; g3.add(se2);
      return g3;
    }
    function moneda3D() {
      var T = THREE, m = V3.malla(new T.CylinderGeometry(.24, .24, .07, 12), '#ffd23f', { g: .08 });
      var cen = V3.malla(new T.CylinderGeometry(.14, .14, .08, 10), '#f0a020', { borde: false }); m.add(cen);
      var g3 = new T.Group(); m.rotation.x = Math.PI / 2; g3.add(m);
      return g3;
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k;
      // gaita zuliana: La menor, i–iv–V–i, con furro y charrasca (la tambora y el cuatro los pone el secuenciador del kit)
      V3.pista('bono', { bpm: 126, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 76, 74, 72, 0, 74, 76, 77, 0, 76, 74, 72, 0, 71, 0, 72, 0, 74, 76, 0, 72, 69, 0, 71, 0, 68, 0, 69, 0, 0, 0] });
      V3.pista('bono2', { bpm: 156, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],                    // la misma gaita, apurada (¡ÚLTIMOS SEGUNDOS!)
        mel: [76, 76, 76, 74, 72, 74, 76, 0, 77, 77, 76, 74, 72, 71, 72, 0, 74, 76, 74, 72, 69, 71, 72, 0, 71, 72, 71, 68, 69, 0, 69, 0] });
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 50, 130], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, GM = V3.toon('#fff').gradientMap;
      /* la acera: baldosas */
      var bald = V3.texturaCanvas(128, 128, function (x, w, h) {
        pinta3(x, pl.junta); x.fillRect(0, 0, w, h);
        for (var j = 0; j < 4; j++) for (var i2 = 0; i2 < 4; i2++) { pinta3(x, V3.oscurecer(pl.piso, .92 + ((i2 * 5 + j * 3) % 4) * .04)); x.fillRect(i2 * 32 + 2, j * 32 + 2, 28, 28); }
      }, [28, 18]);
      var piso = new T.Mesh(new T.PlaneGeometry(110, 70), new T.MeshToonMaterial({ map: bald, gradientMap: GM }));
      piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      /* el borde de la cancha: brocal amarillo */
      var x0 = WX(AX0) - .4, x1 = WX(AX1) + .4, z0 = WZ(AY0) - .4, z1 = WZ(AY1) + .4, bw = x1 - x0, bd = z1 - z0, cz = (z0 + z1) / 2;
      [[0, z0, bw, .2], [0, z1, bw, .2], [x0, cz, .2, bd], [x1, cz, .2, bd]].forEach(function (r) {
        var m = new T.Mesh(new T.PlaneGeometry(r[2], r[3]), tn('#ffd23f')); m.rotation.x = -Math.PI / 2; m.position.set(r[0], .02, r[1]); m.receiveShadow = true; S3.add(m);
      });
      /* el banco al fondo: fachada, columnas, letrero, puertas de vidrio, cajero y escalones */
      var zb = z0 - 2.6, bG = new T.Group(); bG.position.z = zb; S3.add(bG);
      var cuB = M(new T.BoxGeometry(30, 8, 4), pl.banco, { recibe: true, g: .012 }); cuB.position.set(0, 4, -2); bG.add(cuB);
      var corn = M(new T.BoxGeometry(31, .8, 4.8), '#d8cfb8', { recibe: true, g: .02 }); corn.position.set(0, 8.2, -1.8); bG.add(corn);
      var fronton = M(new T.CylinderGeometry(.01, 2.2, 16, 3, 1), '#e6dcc4', { g: .02 }); fronton.rotation.z = Math.PI / 2; fronton.scale.set(1, 1, .35); fronton.position.set(0, 9.2, -.6); bG.add(fronton);
      for (k = 0; k < 6; k++) { var co = M(new T.CylinderGeometry(.38, .42, 6.2, 10), '#fffdf2', { g: .03 }); co.position.set(-10 + k * 4, 3.1, .5); bG.add(co); }
      var cartel = new T.Mesh(new T.PlaneGeometry(7.5, 1.5), new T.MeshBasicMaterial({ map: V3.texturaCanvas(256, 52, function (x, w, h) {
        pinta3(x, '#2f5ea8'); x.fillRect(0, 0, w, h); pinta3(x, '#ffd23f'); x.fillRect(0, h - 6, w, 6);
        pinta3(x, '#fffdf2'); x.font = 'bold 38px sans-serif'; x.textAlign = 'center'; x.fillText('BANCO', w / 2, 40);
      }) }));
      cartel.position.set(0, 7.1, .03); bG.add(cartel);
      var vidrio = pl.noche ? '#ffe39a' : '#8fc8e8', vEm = pl.noche ? '#ffb030' : null;
      var puerta = M(new T.BoxGeometry(3.4, 3.8, .12), vidrio, { g: .03, em: vEm, emI: .8 }); puerta.position.set(0, 1.9, .05); bG.add(puerta);
      var marco = M(new T.BoxGeometry(.12, 3.8, .16), '#2a2a34', { borde: false }); marco.position.set(0, 1.9, .1); bG.add(marco);
      [-6, 6, -10.8, 10.8].forEach(function (vx) { var ve = M(new T.BoxGeometry(2, 2.6, .12), vidrio, { g: .03, em: vEm, emI: .8 }); ve.position.set(vx, 2.6, .05); bG.add(ve); });
      for (k = 0; k < 2; k++) { var es = M(new T.BoxGeometry(14 - k * 3, .22, 1.1), '#cfc6b0', { recibe: true, g: .02 }); es.position.set(0, .11 + k * .22, .9 - k * .5); bG.add(es); }
      var cajero = M(new T.BoxGeometry(1, 1.9, .7), '#5a6070', { g: .04 }); cajero.position.set(8.6, .95, .4); bG.add(cajero);
      var pantalla = new T.Mesh(new T.PlaneGeometry(.6, .42), V3.toon('#5cff7a', { nuevo: true, em: '#2fa04a', emI: .9 })); pantalla.position.set(8.6, 1.45, .76); bG.add(pantalla);
      if (pl.noche) { var luzB = new T.PointLight(0xffe0a0, 1.1, 16, 2); luzB.position.set(0, 4.5, zb + 2.5); S3.add(luzB); }
      /* la bandera en el techo del banco (ondea sola) */
      var asta = M(new T.CylinderGeometry(.06, .06, 3.2, 6), '#d8d8e0', { g: .05 }); asta.position.set(-12, 10.2, zb - .5); S3.add(asta);
      var bandera = new T.Group(); bandera.position.set(-12, 11.2, zb - .5); S3.add(bandera);
      ['#ffd23f', '#2f5ea8', '#d8323a'].forEach(function (cb, i2) { var f2 = new T.Mesh(new T.BoxGeometry(1.8, .36, .04), tn(cb)); f2.position.set(.95, -i2 * .36, 0); f2.castShadow = true; bandera.add(f2); });
      /* la cola del cajero: dos vecinos que miran el zaperoco */
      var usados = {}, vecinos = [], ids = ['portu', 'cobrador', 'abuela', 'tio', 'prima', 'pana', 'mama', 'tu'];
      for (k = 0; k < n; k++) usados[asiento(k).ch] = 1;
      for (k = 0; k < ids.length && vecinos.length < 2; k++) if (!usados[ids[k]]) {
        var vj = V3.PJ.crear(ids[k], { prop: false, escala: 1.1 }); vj.g.position.set(10.2 + vecinos.length * 1.3, 0, zb + 1.6 + vecinos.length * .5); S3.add(vj.g); vecinos.push(vj);
      }
      /* a los lados: palmeras, faroles, el kiosco de la quincalla */
      var hojas = [];
      function palmera(x, z, h) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        for (var i2 = 0; i2 < 6; i2++) { var tr = M(new T.CylinderGeometry(.28 - i2 * .02, .34 - i2 * .02, h / 6, 6), i2 % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(i2 * .3) * .3, h / 12 + i2 * h / 6, 0); g3.add(tr); }
        for (var j2 = 0; j2 < 7; j2++) { var hoja = M(new T.ConeGeometry(.5, 3.6, 4), j2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); hoja.geometry.translate(0, 1.8, 0); hoja.position.set(.5, h, 0); hoja.rotation.set(0, j2 / 7 * 6.28, 0); hoja.rotateZ(1.9); g3.add(hoja); hojas.push(hoja); }
      }
      palmera(-16.5, -8, 7.5); palmera(16.5, -8.5, 8); palmera(-17, 6, 6.5); palmera(17.5, 7, 7);
      function farol(x, z) {
        var po = M(new T.CylinderGeometry(.1, .14, 5, 6), '#2a2a34'); po.position.set(x, 2.5, z); S3.add(po);
        var la = M(new T.BoxGeometry(.6, .7, .6), '#2a2a34'); la.position.set(x, 5.2, z); S3.add(la);
        var vi = new T.Mesh(new T.BoxGeometry(.45, .5, .45), tn('#fff2a0', { em: '#ffd36a', emI: pl.noche ? 1.6 : .2 })); vi.position.set(x, 5.2, z); S3.add(vi);
        if (pl.noche) { var luz = new T.PointLight(0xffc870, 1.3, 16, 2); luz.position.set(x, 4.6, z); S3.add(luz); }
      }
      farol(-14, 1); farol(14, 1);
      var kio = new T.Group(); kio.position.set(-16, 0, -2.5); kio.rotation.y = .5; S3.add(kio);
      var kc = M(new T.BoxGeometry(2.8, 2.4, 2.2), '#3fae9a', { g: .02, recibe: true }); kc.position.y = 1.2; kio.add(kc);
      for (k = 0; k < 6; k++) { var tol = M(new T.BoxGeometry(.5, .08, 1.2), k % 2 ? '#ff5a4e' : '#fffdf2', { borde: false }); tol.position.set(-1.25 + k * .5, 2.6, 1.3); tol.rotation.x = .45; kio.add(tol); }
      var vk = M(new T.BoxGeometry(2.2, .9, .1), pl.noche ? '#ffe39a' : '#ffd23f', { g: .03, em: pl.noche ? '#ffb030' : null, emI: .8 }); vk.position.set(0, 1.5, 1.12); kio.add(vk);
      /* las palomas de la acera: picotean y de vez en cuando vuelan una vuelta */
      var palomas = [];
      [[-13, -6], [-12.2, -5.2], [13, -5.5], [12.5, 9.6], [-12.8, 9.4]].forEach(function (pp, i2) {
        var g3 = new T.Group(); g3.position.set(pp[0], 0, pp[1]); S3.add(g3);
        var cu = M(new T.SphereGeometry(.2, 7, 5), '#9a9aaa', { g: .08 }); cu.scale.set(1, .8, 1.4); cu.position.y = .2; g3.add(cu);
        var ca = M(new T.SphereGeometry(.11, 6, 5), '#7a7a8a', { g: .08 }); ca.position.set(0, .38, .22); g3.add(ca);
        var pi = M(new T.ConeGeometry(.04, .12, 4), '#e0a040', { borde: false }); pi.rotation.x = Math.PI / 2; pi.position.set(0, .37, .35); g3.add(pi);
        var al1 = M(new T.BoxGeometry(.35, .03, .25), '#8a8a9a', { borde: false }); al1.position.set(-.2, .25, 0); g3.add(al1);
        var al2 = al1.clone(); al2.position.x = .2; g3.add(al2);
        palomas.push({ g: g3, ca: ca, al1: al1, al2: al2, x: pp[0], z: pp[1], of: i2 * 2.7 });
      });
      /* hojas de periódico que se lleva el viento */
      var hojaP = V3.texturaCanvas(64, 80, function (x, w, h) { pinta3(x, '#f1ecd8'); x.fillRect(0, 0, w, h); pinta3(x, '#8a8a96'); x.fillRect(4, 4, w - 8, 10); for (var j = 0; j < 9; j++) x.fillRect(4 + (j % 2) * 30, 20 + Math.floor(j / 2) * 12, 26, 4); });
      var papeles = [];
      for (k = 0; k < 3; k++) { var pa = new T.Mesh(new T.PlaneGeometry(.7, .9), new T.MeshBasicMaterial({ map: hojaP, side: T.DoubleSide })); S3.add(pa); papeles.push({ m: pa, of: k * 4.3, z: -4 + k * 5 }); }
      /* obstáculos del nivel: materos (círculos) y jardineras (rectángulos) */
      for (k = 0; k < OB.c.length; k++) {
        var o = OB.c[k], rr3 = o[2] * ESX;
        var mt = M(new T.CylinderGeometry(rr3, rr3 * 1.08, .9, 12), '#c9c2b0', { recibe: true, g: .03 }); mt.scale.z = 1.15; mt.position.set(WX(o[0]), .45, WZ(o[1])); S3.add(mt);
        var mb = M(new T.IcosahedronGeometry(rr3 * .9, 0), k % 2 ? '#3fae4a' : '#2f9a3c', { g: .04 }); mb.position.set(WX(o[0]), 1.3, WZ(o[1])); mb.scale.set(1, .8, 1.15); S3.add(mb);
        var flo = M(new T.SphereGeometry(.14, 6, 4), CONF3[k % CONF3.length], { borde: false }); flo.position.set(WX(o[0]) + .3, 1.85, WZ(o[1]) + .3); S3.add(flo);
      }
      for (k = 0; k < OB.r.length; k++) {
        var r2 = OB.r[k], jw = r2[2] * ESX, jd = r2[3] * ESZ, jx = WX(r2[0] + r2[2] / 2), jz = WZ(r2[1] + r2[3] / 2);
        var ja = M(new T.BoxGeometry(jw, .9, jd), '#c9c2b0', { recibe: true, g: .02 }); ja.position.set(jx, .45, jz); S3.add(ja);
        var se3 = M(new T.BoxGeometry(jw * .8, .6, jd - .2), '#2f9a3c', { g: .03 }); se3.position.set(jx, 1.15, jz); S3.add(se3);
        for (var b3 = 0; b3 < Math.floor(jd / 1.6); b3++) { var bu = M(new T.IcosahedronGeometry(jw * .5, 0), '#3fae4a', { g: .04 }); bu.position.set(jx, 1.45, jz - jd / 2 + .8 + b3 * 1.6); S3.add(bu); }
      }
      /* los jugadores: el solo con su bono encima; el trío con su periódico */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        S3.add(pj.g);
        if (!isSolo(k)) pj.mano('der').add(periodico3D());
        var aro = new T.Mesh(new T.RingGeometry(.7, .9, 20), new T.MeshBasicMaterial({ color: isSolo(k) ? '#ffd23f' : (s2.color && s2.color !== '#fff' ? s2.color : CONF3[(k + 1) % CONF3.length]), transparent: true, opacity: .85 }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = .04; S3.add(aro);
        var x3 = WX(P[k].x), z3 = WZ(P[k].y);
        pjs.push({ pj: pj, aro: aro, x: x3, z: z3, px: x3, pz: z3, v: 0, rumbo: isSolo(k) ? 0 : Math.PI, aireC: false, feliz: -9 });
      }
      var bono = sobre3D(); bono.position.set(pjs[soloI].x, EH, pjs[soloI].z); S3.add(bono);
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      /* la calle que juega: toldos, la alfombra de la puerta, la camionetica, el carrito del raspao y la franja de aviso */
      var toldos3 = [];
      TOLDOS.forEach(function (tp, j) {
        var g3 = new T.Group(); g3.position.set(WX(tp[0]), 0, WZ(tp[1])); S3.add(g3);
        var r3 = TOLDO_R * ESX;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (pp) { var po = M(new T.CylinderGeometry(.06, .06, 2.4, 6), '#5a5a66', { g: .03 }); po.position.set(pp[0] * r3 * .9, 1.2, pp[1] * r3 * .9); g3.add(po); });
        var techo = new T.Group(); techo.position.y = 2.45; g3.add(techo);
        for (var k3 = 0; k3 < 5; k3++) { var fr = M(new T.BoxGeometry(r3 * 2 / 5, .1, r3 * 2.2), k3 % 2 ? '#fffdf2' : (j ? '#3fa9ff' : '#ff5a4e'), { g: .03 }); fr.position.set(-r3 + r3 * 2 / 5 * (k3 + .5), 0, 0); techo.add(fr); }
        var mesa = M(new T.BoxGeometry(r3 * 1.2, .7, .5), '#a07040', { g: .03, recibe: true }); mesa.position.set(0, .35, -r3 * .75); g3.add(mesa);
        var piso3 = new T.Mesh(new T.CircleGeometry(r3, 24), new T.MeshBasicMaterial({ color: 0x5cff7a, transparent: true, opacity: .25, depthWrite: false })); piso3.rotation.x = -Math.PI / 2; piso3.position.y = .03; g3.add(piso3);
        toldos3.push({ g: g3, techo: techo, piso: piso3 });
      });
      var alfombra = new T.Mesh(new T.CircleGeometry(DOOR_R * ESX * 1.2, 24), new T.MeshBasicMaterial({ color: 0x5cff7a, transparent: true, opacity: .5, depthWrite: false }));
      alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(WX(DOOR_X), .035, WZ(AY0) + .3); alfombra.visible = false; S3.add(alfombra);
      var bus = new T.Group(); bus.visible = false; S3.add(bus);
      var bL = BUS_L * ESX, bH = BUS_H * ESZ * .8;
      var bc = M(new T.BoxGeometry(bL, 1.7, bH), '#fffdf2', { g: .05 }); bc.position.y = 1.15; bus.add(bc);
      var bv = M(new T.BoxGeometry(bL * .92, .55, bH + .04), '#2a3a5a', { borde: false }); bv.position.y = 1.55; bus.add(bv);
      var bf = M(new T.BoxGeometry(bL + .02, .22, bH + .05), '#ff5a4e', { borde: false }); bf.position.y = .75; bus.add(bf);
      var bf2 = M(new T.BoxGeometry(bL + .02, .12, bH + .05), '#ffd23f', { borde: false }); bf2.position.y = .95; bus.add(bf2);
      for (k = 0; k < 4; k++) { var ru = M(new T.CylinderGeometry(.34, .34, .25, 10), '#1a1a22', { g: .03 }); ru.rotation.x = Math.PI / 2; ru.position.set((k % 2 ? 1 : -1) * bL * .32, .34, (k < 2 ? 1 : -1) * bH * .5); bus.add(ru); }
      var franja = new T.Mesh(new T.PlaneGeometry((AX1 - AX0) * ESX, BUS_H * ESZ), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .3, depthWrite: false }));
      franja.rotation.x = -Math.PI / 2; franja.position.y = .03; franja.visible = false; S3.add(franja);
      var colaM = new T.Mesh(new T.CircleGeometry(COLA_R * ESX, 24), new T.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: .4, depthWrite: false }));
      colaM.rotation.x = -Math.PI / 2; colaM.position.y = .04; colaM.visible = false; S3.add(colaM);
      var cafeM = new T.Group(); cafeM.visible = false; S3.add(cafeM);
      var cafT = M(new T.CylinderGeometry(.35, .28, .6, 10), '#fffdf2', { g: .03 }); cafT.position.y = .9; cafeM.add(cafT);
      var cafP = new T.Mesh(new T.CircleGeometry(CAFE_R * ESX * 1.4, 16), new T.MeshBasicMaterial({ color: 0x5cff7a, transparent: true, opacity: .5, depthWrite: false })); cafP.rotation.x = -Math.PI / 2; cafP.position.y = .05; cafeM.add(cafP);
      var carro = new T.Group(); carro.visible = false; S3.add(carro);
      var cw3 = CAR_W * 2 * ESX, ch3 = CAR_H * 2 * ESZ;
      var cca = M(new T.BoxGeometry(cw3, .9, ch3), '#ff9ec7', { g: .04 }); cca.position.y = .75; carro.add(cca);
      var cvi = M(new T.BoxGeometry(cw3 * .7, .45, ch3 * .7), '#bfefff', { g: .03, op: .8 }); cvi.position.y = 1.4; carro.add(cvi);
      var cpa = M(new T.CylinderGeometry(.04, .04, 1.6, 6), '#5a5a66', { borde: false }); cpa.position.y = 1.9; carro.add(cpa);
      var csom = M(new T.ConeGeometry(1.15, .5, 8), '#ffd23f', { g: .03 }); csom.position.y = 2.75; carro.add(csom);
      for (k = 0; k < 2; k++) { var cru = M(new T.CylinderGeometry(.22, .22, .15, 10), '#1a1a22', { g: .03 }); cru.rotation.x = Math.PI / 2; cru.position.set(k ? cw3 * .35 : -cw3 * .35, .22, ch3 * .5); carro.add(cru); }
      var raspa = V3.PJ.crear('portu', { prop: false, escala: 1.1 }); raspa.g.visible = false; S3.add(raspa.g);
      var part = V3.particulas(esc, 600);
      var cam = { x: pjs[soloI].x, z: pjs[soloI].z + .6, w: 17, h: 11 };
      esc.encuadrar(cam.w, cam.h, new T.Vector3(cam.x, .9, cam.z), .8);
      return V3.ultimo = { esc: esc, pjs: pjs, bono: bono, flecha: flecha, part: part, banderas: bandera, hojas: hojas, palomas: palomas, papeles: papeles, vecinos: vecinos,
        pantalla: pantalla, cam: cam, mira: new T.Vector3(), sw: {}, monedas: {}, ultHit: -9, ultL: 0, jolt: 0, caeT: -1, finFx: 0, chispaT: 0,
        toldos: toldos3, alfombra: alfombra, puerta: puerta, bus: bus, franja: franja, cola: colaM, cafe: cafeM, carro: carro, raspa: raspa, bonos: {}, luz0: [esc.luces.hemi.intensity, pl.hemi[0]], vientoT: 0 };
    }
    function quitar(m) { v3.esc.scene.remove(m); }
    function finDe(now) { return hitAt16 >= 0 || now >= dur; }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, p, k, t = absT, fin = finDe(now), soloGana = hitAt16 < 0, rem = START - net();
      V.part.update(dt);
      /* lo que se mueve solo: bandera, hojas, palomas, papeles, el cajero que parpadea */
      V.banderas.rotation.y = Math.sin(t * 2.4) * .35; V.banderas.children.forEach(function (f2, i2) { f2.rotation.x = Math.sin(t * 5 + i2) * .12; });
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .06;
      V.pantalla.material.emissiveIntensity = Math.floor(t * 2) % 4 === 0 ? .2 : .9;
      for (k = 0; k < V.palomas.length; k++) {
        var pa = V.palomas[k], u = (t + pa.of) % 13;
        if (u < 10.5) { pa.g.position.set(pa.x + Math.sin(u * .6) * .4, 0, pa.z + Math.cos(u * .5) * .3); pa.ca.position.y = .38 - Math.max(0, Math.sin(u * 7)) * .14; pa.al1.rotation.z = pa.al2.rotation.z = 0; pa.g.rotation.y = u * .6; }
        else { var fu = (u - 10.5) / 2.5; pa.g.position.set(pa.x + Math.sin(fu * 6.28) * 2.5, Math.sin(fu * Math.PI) * 4, pa.z + (1 - Math.cos(fu * 6.28)) * 1.5); pa.al1.rotation.z = Math.sin(t * 30) * .9; pa.al2.rotation.z = -pa.al1.rotation.z; pa.g.rotation.y = fu * 6.28; }
      }
      for (k = 0; k < V.papeles.length; k++) {
        var pp = V.papeles[k], pu = ((t + pp.of) % 12) / 12;
        pp.m.position.set(-22 + pu * 44, .6 + Math.abs(Math.sin(pu * 18)) * 1.6, pp.z + Math.sin(pu * 9) * 1.5); pp.m.rotation.set(t * 2 + k, t * 1.3, t * .7);
      }
      /* los periodicazos: círculo rojo que se llena en el piso, el lanzar del que pega y los papelitos al golpear */
      var vivos = {};
      for (k = 0; k < swings.length; k++) {
        var s = swings[k], r = V.sw[s.k], ver = now >= s.t - .05 && now <= s.t + WIND + ACT + .15;
        vivos[s.k] = 1;
        if (!r) r = V.sw[s.k] = { lz: false, act: false, disco: null, aro: null };
        if (ver && !r.disco && !r.hecho) {
          r.disco = new T.Mesh(new T.CircleGeometry(ZR * ESX, 28), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .35, depthWrite: false }));
          r.aro = new T.Mesh(new T.RingGeometry(ZR * ESX - .15, ZR * ESX, 36), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .9, depthWrite: false }));
          [r.disco, r.aro].forEach(function (m) { m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.15, 1); m.position.set(WX(s.zx), .04, WZ(s.zy)); V.esc.scene.add(m); });
          r.aro.position.y = .05;
          V3.sfx('tic');
        }
        if (!r.lz && now >= s.t + .13 && s.p >= 0 && s.p < n) { r.lz = true; V.pjs[s.p].pj.uno('lanzar'); V3.sfx('whoosh'); }
        if (r.disco) {
          if (!ver) { quitar(r.disco); quitar(r.aro); r.disco = r.aro = null; r.hecho = true; continue; }
          var fu2 = cl((now - s.t) / WIND, 0, 1), act = now >= s.t + WIND;
          r.disco.scale.set(.15 + .85 * fu2, (.15 + .85 * fu2) * 1.15, 1);
          r.disco.material.color.set(act ? 0xffffff : 0xff3b4e); r.disco.material.opacity = act ? .6 : .2 + .3 * fu2;
          r.aro.material.color.set(act ? 0xffffff : 0xff3b4e); r.aro.material.opacity = .5 + .45 * Math.abs(Math.sin(t * (10 + 16 * fu2)));
          if (act && !r.act) { r.act = true; V.part.soltar(WX(s.zx), .4, WZ(s.zy), 10, { k: 'confeti', cols: ['#f1ecd8', '#8a8a96', '#fffdf2'], vel: 3, arriba: 3, g: 6, vida: .9 }); }
        }
      }
      for (k in V.sw) if (!vivos[k]) { if (V.sw[k].disco) { quitar(V.sw[k].disco); quitar(V.sw[k].aro); } delete V.sw[k]; }
      /* el solo: corre, salta, se dobla, y el bono flota encima */
      var sq = P[soloI], s0 = V.pjs[soloI], air = c.mio(soloI) ? enAire(now) : sq.remA === 1, stg = now < sq.stg, pel = zonaPeligro(sq.x, sq.y, now);
      s0.x = WX(sq.x); s0.z = WZ(sq.y);
      var vx0 = (s0.x - s0.px) / dt, vz0 = (s0.z - s0.pz) / dt, v0 = Math.sqrt(vx0 * vx0 + vz0 * vz0); s0.px = s0.x; s0.pz = s0.z; s0.v = s0.v * .7 + v0 * .3;
      if (s0.v > .6) s0.rumbo = Math.atan2(vx0, vz0);
      if (air && !s0.aireC) { s0.pj.uno('saltar'); V3.sfx('salto'); V.part.soltar(s0.x, .15, s0.z, 8, { k: 'chispa', cols: ['#fffdf2', '#d8d2c4'], vel: 2, arriba: 1.5, vida: .4 }); }
      s0.aireC = air;
      if (fin && now > 0) s0.pj.anim(soloGana ? 'celebrar' : 'triste').cara(soloGana ? 'feliz' : 'triste');
      else if (stg) s0.pj.anim('caminar', { vel: .4 }).cara('mareado');
      else s0.pj.anim(s0.v > 4 ? 'correr' : s0.v > .8 ? 'caminar' : 'quieto', { vel: Math.min(1, s0.v / 9) }).cara(pel ? 'susto' : rem >= 24 ? 'feliz' : 'concentrado');
      if (solProt(now) === 2 && !(fin && now > 0)) s0.pj.cara('feliz');
      s0.pj.rumbo(s0.rumbo).update(dt); s0.pj.g.position.set(s0.x, 0, s0.z); s0.aro.position.set(s0.x, .04, s0.z);
      var adentro = solProt(now) === 3; s0.pj.g.visible = !adentro; s0.aro.visible = !adentro;
      calle3D(dt, now);
      if (now < turboUntil) { V.chispaT -= dt; if (V.chispaT < 0) { V.chispaT = .08; V.part.soltar(s0.x, .3, s0.z, 2, { k: 'chispa', cols: ['#5cff7a', '#fffdf2'], vel: 1, arriba: 1, vida: .4 }); } }
      /* el bono: sigue al solo, más chiquito mientras menos queda; brinca con cada golpe; si se cae, cae al piso */
      var bo = V.bono, esB = .55 + .5 * rem / START;
      V.jolt = Math.max(0, V.jolt - dt);
      if (hitAt16 >= 0) {
        if (V.caeT < 0) { V.caeT = t; V.bx = bo.position.x; V.bz = bo.position.z; V3.sfx('caida'); }
        var cu = Math.min(1, (t - V.caeT) / .7);
        bo.position.set(V.bx + cu * .8, EH + (0.15 - EH) * cu * cu + Math.sin(cu * Math.PI) * .8, V.bz + cu * .5); bo.rotation.set(-Math.PI / 2 * cu, cu * 4, 0);
      } else {
        var bx = s0.x, by = (solProt(now) === 3 ? EH + 1.2 : EH) + (air ? 1.1 * Math.sin(cl((now - sq.tj) / JUMP, 0, 1) * Math.PI) : 0) + Math.sin(t * 3) * .12, wob = rem < 20 ? Math.sin(t * 14) * (20 - rem) * .02 : 0;
        bo.position.x += (bx - bo.position.x) * Math.min(1, dt * 14); bo.position.z += (s0.z - bo.position.z) * Math.min(1, dt * 14); bo.position.y = by + V.jolt * 1.2;
        bo.rotation.set(0, Math.sin(t * 1.6) * .5, wob + Math.sin(V.jolt * 40) * V.jolt * .8);
      }
      bo.scale.setScalar(esB);
      /* las monedas que se caen: vuelan del sobre al piso, giran, parpadean antes de irse */
      var vm = {};
      for (k = 0; k < coins.length; k++) {
        var co = coins[k]; if (co.got) continue;
        vm[co.id] = 1;
        var mo = V.monedas[co.id];
        if (!mo) { mo = V.monedas[co.id] = { m: moneda3D(), sx: bo.position.x, sy: bo.position.y, sz: bo.position.z }; V.esc.scene.add(mo.m); }
        var uu = cl((now - co.t0) / .4, 0, 1), tx = WX(co.x), tz = WZ(co.y);
        mo.m.position.set(mo.sx + (tx - mo.sx) * uu, mo.sy + (.35 - mo.sy) * uu + Math.sin(uu * Math.PI) * 1.4 + (uu >= 1 ? Math.sin(t * 6 + k) * .08 : 0), mo.sz + (tz - mo.sz) * uu);
        mo.m.rotation.y = t * 4 + k;
        mo.m.visible = !(co.t0 + COIN_LIFE - now < 1.2 && Math.floor(t * 10) % 2);
      }
      for (k in V.monedas) if (!vm[k]) { quitar(V.monedas[k].m); delete V.monedas[k]; }
      /* el trío: persigue, levanta el periódico, celebra o se pone bravo */
      for (k = 0; k < trio.length; k++) {
        p = trio[k]; var q = P[p], s3 = V.pjs[p];
        s3.x = WX(q.x); s3.z = WZ(q.y);
        var vx = (s3.x - s3.px) / dt, vz = (s3.z - s3.pz) / dt, v = Math.sqrt(vx * vx + vz * vz); s3.px = s3.x; s3.pz = s3.z; s3.v = s3.v * .7 + v * .3;
        var wn = winding(p, now), cerca = hyp(q.x - sq.x, q.y - sq.y) < 100;
        if (wn) s3.rumbo = Math.atan2(Math.cos(wn.a), Math.sin(wn.a) * 1.15);
        else if (s3.v > .6) s3.rumbo = Math.atan2(vx, vz);
        var pj = s3.pj;
        if (fin && now > 0) pj.anim(soloGana ? 'triste' : 'celebrar').cara(soloGana ? 'triste' : 'feliz');
        else if (now < q.stun) pj.anim('caminar', { vel: .3 }).cara('mareado');
        else if (wn) pj.anim('quieto').cara('enojado');
        else pj.anim(s3.v > 4 ? 'correr' : s3.v > .8 ? 'caminar' : 'quieto', { vel: Math.min(1, s3.v / 8) }).cara(t < s3.feliz ? 'feliz' : cerca ? 'enojado' : 'concentrado');
        if (!fin && now >= q.stun) pj.mirarA({ x: V.pjs[soloI].x, y: 1.1, z: V.pjs[soloI].z });      // el trío mira al solo
        pj.rumbo(s3.rumbo).update(dt); pj.g.position.set(s3.x, 0, s3.z); s3.aro.position.set(s3.x, .04, s3.z);
      }
      /* los vecinos de la cola: miran el zaperoco y se asustan con los golpes */
      for (k = 0; k < V.vecinos.length; k++) { var vj = V.vecinos[k]; vj.anim(t - V.ultHit < 1.2 ? 'saludar' : 'quieto').cara(t - V.ultHit < 1.2 ? 'susto' : 'normal').rumbo(Math.atan2(s0.x - vj.g.position.x, s0.z - vj.g.position.z)).update(dt); }
      /* el final: festejo de los que ganan, una vez */
      if (fin && now > 0 && !V.finFx) {
        V.finFx = 1; V3.sfx('aplauso');
        for (k = 0; k < n; k++) if (isSolo(k) === soloGana) V.pjs[k].pj.uno('festejo');
        V.part.soltar(soloGana ? s0.x : 0, 4, soloGana ? s0.z : 0, 50, { k: 'confeti', cols: CONF3, vel: 5, arriba: 6, g: 5, vida: 2 });
      }
      /* la flecha sobre mí */
      var yo = c.yo >= 0 && c.yo < n ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.x, (c.yo === soloI ? EH + 1.1 : 4.2) + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      /* cámara cerca: encuadra al solo (y a mí, y a los del trío que lo tienen cerca), suave */
      var cx0 = s0.x - 6.5, cx1 = s0.x + 6.5, cz0 = s0.z - 4.2, cz1 = s0.z + 4.2;
      function incluye(x, z, m) { cx0 = Math.min(cx0, x - m); cx1 = Math.max(cx1, x + m); cz0 = Math.min(cz0, z - m); cz1 = Math.max(cz1, z + m); }
      if (yo && c.yo !== soloI) incluye(yo.x, yo.z, 2.5);
      for (k = 0; k < trio.length; k++) if (hyp(P[trio[k]].x - sq.x, P[trio[k]].y - sq.y) < 140) incluye(V.pjs[trio[k]].x, V.pjs[trio[k]].z, 2);
      var W0 = (AX1 - AX0) * ESX + 3, H0 = (AY1 - AY0) * ESZ + 4, zc = WZ((AY0 + AY1) / 2);
      var cw = Math.min(W0, cx1 - cx0), ch = Math.min(H0, cz1 - cz0);
      var ccx = cl((cx0 + cx1) / 2, -(W0 - cw) / 2, (W0 - cw) / 2), ccz = cl((cz0 + cz1) / 2, zc - (H0 - ch) / 2, zc + (H0 - ch) / 2) + .6;
      var kc = Math.min(1, dt * 2.2), C = V.cam; C.x += (ccx - C.x) * kc; C.z += (ccz - C.z) * kc; C.w += (cw - C.w) * kc; C.h += (ch - C.h) * kc;
      V.mira.set(C.x, .9, C.z); V.esc.encuadrar(C.w, C.h, V.mira, .8);
    }
    function calle3D(dt, now) {                                     // la calle que juega, en 3D (sólo lee el estado: lo de jugar vive en calle()/bancoSolo())
      var V = v3, T = THREE, t = absT, j, e, k;
      for (j = 0; j < V.toldos.length; j++) {
        var to = V.toldos[j], ok = toldoSirve(j, now), bajo = ok && solProt(now) === 2 && toldoDe(P[soloI].x, P[soloI].y) === j;
        to.techo.rotation.z += ((ok ? 0 : (j ? -1.1 : 1.1)) - to.techo.rotation.z) * Math.min(1, dt * 8);
        to.techo.position.y += ((ok ? 2.45 : 1.3) - to.techo.position.y) * Math.min(1, dt * 8);
        to.techo.scale.y = bajo ? 1 + Math.abs(Math.sin(t * 12)) * .6 : 1;
        to.piso.visible = !!ok; to.piso.material.opacity = bajo ? .45 + .2 * Math.sin(t * 10) : .22 * (1 - toldo[j].uso / TOLDO_T) + .08;
      }
      var eb = bancoAbierto(now), avB = evEn('banco', now, true), abierta = !!eb && !bankUsed[eb.i];
      V.alfombra.visible = !!avB; V.alfombra.material.opacity = abierta ? .35 + .25 * Math.abs(Math.sin(t * 5)) : .15;
      V.alfombra.material.color.set(eb ? (abierta ? 0x5cff7a : 0x8a8a96) : 0xffd23f);
      V.puerta.position.x += ((eb || solProt(now) === 3 ? 3.0 : 0) - V.puerta.position.x) * Math.min(1, dt * 6);
      e = evEn('bus', now, true);
      V.franja.visible = !!e && now < e.t + e.w + .2;
      if (e) { V.franja.position.set(WX((AX0 + AX1) / 2), .03, WZ(e.y)); V.franja.material.opacity = .15 + .3 * Math.abs(Math.sin(t * 14)); }
      V.bus.visible = !!e && now >= e.t + e.w;
      if (V.bus.visible) {
        V.bus.position.set(WX(busX(e, now)), Math.abs(Math.sin(t * 22)) * .05, WZ(e.y)); V.bus.rotation.y = 0;
        V.vientoT -= dt; if (V.vientoT < 0) { V.vientoT = .06; V.part.soltar(V.bus.position.x - e.dir * BUS_L * ESX * .55, .4, V.bus.position.z, 2, { k: 'chispa', cols: ['#8a8a96', '#5a5a66'], vel: 1, arriba: 1, vida: .5 }); }
      }
      var eco = evEn('cola', now, true); V.cola.visible = !!eco;
      if (eco) { V.cola.position.set(WX(eco.x), .04, WZ(eco.y)); V.cola.material.opacity = now < eco.t + eco.w ? .15 + .15 * Math.abs(Math.sin(t * 12)) : .4; }
      var eca = evEn('cafe', now, true); V.cafe.visible = !!eca && !cafeUsed[eca.i];
      if (V.cafe.visible) { V.cafe.position.set(WX(eca.x), Math.sin(t * 4) * .15, WZ(eca.y)); V.cafe.rotation.y = t * 2; }
      var ca = carroPos(now);
      V.carro.visible = !!ca; V.raspa.g.visible = !!ca;
      if (ca) {
        V.carro.position.set(WX(ca.x), 0, WZ(ca.y));
        V.raspa.g.position.set(WX(ca.x - ca.e.dir * (CAR_W + 10)), 0, WZ(ca.y)); V.raspa.anim('empujar', { vel: .5 }).cara('feliz').rumbo(ca.e.dir > 0 ? Math.PI / 2 : -Math.PI / 2).update(dt);
      }
      var vv = vientoV(now);
      if (vv) { V.vientoT -= dt; if (V.vientoT < 0) { V.vientoT = .05; V.part.soltar(vv > 0 ? -13 : 13, .5 + c.fx() * 2.5, -7 + c.fx() * 14, 2, { k: 'confeti', cols: ['#f1ecd8', '#fffdf2', '#3fae4a'], vel: 2, arriba: .5, g: .5, vida: 1.2 }); } }
      var vb = {};
      for (j = 0; j < EVS.length; j++) {                            // las monedas del cajero: salen volando del cajero y caen en su sitio
        e = EVS[j]; if (!e.mon || now < e.t + e.w || now > e.t + e.w + e.d) continue;
        for (k = 0; k < e.mon.length; k++) {
          var bm = e.mon[k]; if (bm.got) continue;
          vb[bm.id] = 1;
          var mo = V.bonos[bm.id];
          if (!mo) { mo = V.bonos[bm.id] = { m: moneda3D() }; mo.m.scale.setScalar(1.3); V.esc.scene.add(mo.m); }
          var uu = cl((now - e.t - e.w) / .5, 0, 1), sx = WX(ATM_X), sz = WZ(AY0) - .8, tx = WX(bm.x), tz = WZ(bm.y);
          mo.m.position.set(sx + (tx - sx) * uu, 1.4 * (1 - uu) + .4 + Math.sin(uu * Math.PI) * 2.2 + (uu >= 1 ? Math.sin(t * 6 + k) * .1 : 0), sz + (tz - sz) * uu);
          mo.m.rotation.y = t * 5 + k;
          mo.m.visible = !(e.t + e.w + e.d - now < 1.2 && Math.floor(t * 10) % 2);
        }
      }
      for (k in V.bonos) if (!vb[k]) { quitar(V.bonos[k].m); delete V.bonos[k]; }
      /* la luz de la escalada: en ¡ÚLTIMOS SEGUNDOS! la acera se pone roja y late */
      var f = now >= 0 && !finDe(now) ? fase(now) : 0, hm = V.esc.luces.hemi;
      if (f === 2) { hm.color.setHex(0xff9a8a); hm.intensity = V.luz0[0] * (1.05 + .12 * Math.sin(t * 8)); }
      else if (f === 1) { hm.color.setHex(0xffd8b0); hm.intensity = V.luz0[0] * 1.05; }
      else { hm.color.setHex(V.luz0[1]); hm.intensity = V.luz0[0]; }
    }
    function golpe3D(l, pw) {                                       // un periodicazo entró: el solo se dobla (o se cae, en el sándwich) y el bono suelta monedas
      if (!v3) return;
      var V = v3, s0 = V.pjs[soloI], sand = l === L2;
      var lan = pw >= 0 && pw < n ? V.pjs[pw] : null;                    // el solo sale del golpe desde el trío que lo pegó (el sándwich lo tumba)
      if (lan) { var pdx = s0.x - lan.x, pdz = s0.z - lan.z, pdm = Math.sqrt(pdx * pdx + pdz * pdz) || 1; if (sand) s0.pj.volar(pdx / pdm, pdz / pdm, 2.6, { alcance: .9 }); else s0.pj.impacto(pdx / pdm, pdz / pdm, 1.8); }
      else s0.pj.uno(sand ? 'caer' : 'golpe');
      if (pw >= 0 && pw < n && !isSolo(pw)) V.pjs[pw].feliz = absT + 1.2;
      V.ultHit = absT; V.ultL = l; V.jolt = .5;
      V.part.soltar(V.bono.position.x, V.bono.position.y, V.bono.position.z, sand ? 30 : 16, { k: 'chispa', cols: ['#ffd23f', '#f0a020', '#fffdf2'], vel: 5, arriba: 4, vida: .8 });
      V.part.soltar(s0.x, 2.2, s0.z, 12, { k: 'confeti', cols: ['#f1ecd8', '#8a8a96', '#fffdf2'], vel: 3, arriba: 3, g: 6, vida: 1 });
      V3.sfx('golpe'); V3.sfx('moneda'); if (sand) V3.sfx('choque');
      V.esc.sacudir(sand ? 1 : (c.yo === soloI ? .7 : .45));
    }
    function recoge3D(co) {
      if (!v3) return;
      v3.part.soltar(WX(co.x), .5, WZ(co.y), 10, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 2.5, arriba: 3, vida: .5 });
      V3.sfx('moneda');
    }
    function punto(x, y, dy2D, alto3D) {                            // dónde poner un aviso: proyectado desde el 3D o en la calle 2D
      if (v3) return v3.esc.proyectar(WX(x), alto3D, WZ(y));
      return scr(geom(), x, y + dy2D);
    }
    function marcador3D(f) {                                        // la barra del BONO con la raya del 15, la regla y los avisos grandes
      var cx = (f.x0 + f.x1) / 2, w = f.x1 - f.x0, now = c.ahora(), rem = START - net(), yo = c.yo, t = absT, my = 88;
      var bw = Math.max(150, Math.min(300, w - 110)), bx = cx - bw / 2 + 22;
      var col = rem >= 20 ? '#5cff7a' : rem >= GANA_COINS ? '#ffd23f' : '#ff5a4e';
      rr(bx - 5, my - 14, bw + 10, 28, 10, 'rgba(20,16,28,.82)', 0);
      if (rem > 0) rr(bx, my - 9, Math.max(10, bw * rem / START), 18, 7, col, 0);
      var lx = bx + bw * GANA_COINS / START;                        // la raya: por debajo, se le cayó el bono
      rr(lx - 2, my - 17, 4, 34, 1, '#fffdf2', 0);
      txt('15', lx, my + 25, 12, '#fffdf2', 0, true);
      rr(bx - 52, my - 14, 38, 26, 4, '#ffd23f', 2.5); poly([[bx - 52, my - 14], [bx - 33, my], [bx - 14, my - 14]], '#f0a020', 2);
      txt('BONO ' + rem + '/' + START, bx + bw / 2, my + 1, 17, '#fffdf2', 0, false);
      var big = w < 500 ? 0.8 : 1, fin = finDe(now);
      if (fin && now > 0) {
        if (hitAt16 >= 0) txt('¡SE LE CAYÓ EL BONO!', cx, 150, 30 * big, '#ff5a4e', 0, false);
        else txt('¡SALVÓ EL BONO!', cx, 150, 30 * big, '#5cff7a', 0, false);
        return;
      }
      if (now > -0.5 && now < 3.2 && !c.practica) {
        txt(isSolo(yo) ? '¡QUE NO TE TUMBEN EL BONO!' : '¡TÚMBENLE EL BONO!', cx, 132, 24 * big, '#ffd23f', 0, false);
        txt(isSolo(yo) ? 'A = SALTA cuando el círculo rojo se llene' : 'A = ¡PERIODICAZO! · si baja de 15, ganan', cx, 160, 14 * big, '#fffdf2', 0, false);
        return;
      }
      if (absT - anuncio.t < 1.5 && anuncio.s && now - sandAt >= 1.1) { anuncioD(cx, 178, big); }
      if (fase(now) === 2 && Math.floor(t * 2) % 2) txt('¡ÚLTIMOS SEGUNDOS!', cx, 118, 14 * big, '#ff5a4e', 0, false);
      if (now - sandAt < 1.1) { var ps = 1 + Math.max(0, .4 - (now - sandAt)) * 1.2; txt('¡SÁNDWICH! −6', cx, 140, 30 * big * ps, '#ff5a4e', 0, false); }
      else if (v3 && t - v3.ultHit < .9) { var ph = 1 + Math.max(0, .35 - (t - v3.ultHit)) * 1.4; txt('¡PLAF! −' + v3.ultL, cx, 140, 28 * big * ph, '#ff5a4e', 0, false); }
      else if (isSolo(yo) && zonaPeligro(P[soloI].x, P[soloI].y, now) && !enAire(now)) { if (Math.floor(t * 8) % 2) txt('¡SALTA!', cx, 140, 34 * big, '#ff5a4e', 0, false); }
      else if (yo >= 0 && yo < n && !isSolo(yo) && now >= P[yo].nextSw && hyp(P[yo].x - P[soloI].x, P[yo].y - P[soloI].y) < 110) txt('A = ¡PERIODICAZO!', cx, 140, 20 * big, '#fffdf2', 0, false);
      else if (rem < 20 && rem >= GANA_COINS && Math.floor(t * 3) % 2) txt('¡EL BONO SE TAMBALEA!', cx, 122, 15 * big, '#ffd23f', 0, false);
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k, rem = START - net(); v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !finDe(now)) V3.musica(fase(now) === 2 ? 'bono2' : 'bono');
      v3.esc.render(dt);
      for (k = 0; k < n; k++) {
        var s3 = v3.pjs[k], pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.1);
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      var bo = v3.bono.position, pb = v3.esc.proyectar(bo.x, bo.y + .75, bo.z);   // el número del bono encima del sobre: lo mismo que la barra
      if (pb.y > 70) txt(String(rem), pb.x, pb.y, 16, rem >= 20 ? '#5cff7a' : rem >= GANA_COINS ? '#ffd23f' : '#ff5a4e', 0, false);
      for (k = 0; k < trio.length; k++) {                          // el «!» del periodicazo que viene, y el mareo de la camionetica
        var pq = P[trio[k]], wn3 = winding(trio[k], now), s4 = v3.pjs[trio[k]];
        if (wn3 && now < wn3.t + WIND) { var pe = v3.esc.proyectar(s4.x, 4.3, s4.z); if (pe.y > 70) txt('!', pe.x, pe.y, 30 + 10 * cl((now - wn3.t) / WIND, 0, 1), '#ff3b4e', 0, false); }
        else if (now < pq.stun) { var pm = v3.esc.proyectar(s4.x, 4, s4.z); if (pm.y > 70) txt('@ @', pm.x, pm.y, 14, '#ffd23f', 0, true); }
      }
      if (solProt(now) === 2) { var ptt = v3.esc.proyectar(v3.pjs[soloI].x, EH + 1.4, v3.pjs[soloI].z); var jt = toldoDe(P[soloI].x, P[soloI].y); if (ptt.y > 70 && jt >= 0) txt('¡A SALVO! ' + Math.max(0, TOLDO_T - toldo[jt].uso).toFixed(1), ptt.x, ptt.y, 14, '#5cff7a', 0, true); }
      if (now < turboUntil) { var pt2 = v3.esc.proyectar(v3.pjs[soloI].x, EH + 1.6, v3.pjs[soloI].z); if (pt2.y > 70) txt('¡TURBO!', pt2.x, pt2.y, 14, '#5cff7a', 0, true); }
      marcador3D(f);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ffffff', 0); ctx.restore(); }
    }

    var TXT_EV = { cafe: ['¡UN CAFECITO! ¡CORRE POR ÉL!', '#5cff7a', 'ding'], cola: ['¡LA COLA DEL BANCO! (frena a todos)', '#ff9a3c', 'tic'], bus: ['¡VIENE LA CAMIONETICA!', '#ff5a4e', 'bocina'], viento: ['¡VENTARRÓN!', '#8fd8ff', 'viento'], carrito: ['¡PASA EL CARRITO DEL RASPAO!', '#ff9ec7', 'tic'],
      cajero: ['¡EL CAJERO ESTÁ BOTANDO PLATA!', '#5cff7a', 'ding'], banco: ['¡ABRIERON EL BANCO! ¡MÉTETE!', '#5cff7a', 'silbato'] };
    var TXT_FASE = ['', '¡SE PRENDIÓ EL ZAPEROCO!', '¡ÚLTIMOS SEGUNDOS!'];
    function calleUpd(now) {                                       // carteles y sonidos de los eventos y de la escalada (lo de jugar ya está en calle()/bancoSolo())
      var j, e, f = now >= 0 && !finDe(now) ? fase(now) : faseVista;
      if (f !== faseVista) {
        faseVista = f; anuncia(TXT_FASE[f], f === 2 ? '#ff5a4e' : '#ffd23f'); shake = Math.max(shake, 0.5);
        if (v3) { V3.sfx('silbato'); v3.esc.sacudir(.6); } else SND(f === 2 ? 990 : 660, 0.35, 'square', 0.06, 200);
      }
      for (j = 0; j < EVS.length; j++) {
        e = EVS[j];
        if (now >= e.t && !e.av && now < e.t + e.w + e.d) {
          e.av = 1; var tx = TXT_EV[e.k];
          if (!(e.k === 'banco' && !isSolo(c.yo))) anuncia(tx[0], tx[1]); else anuncia('¡ABRIERON EL BANCO! ¡QUE NO SE META!', '#ffd23f');
          if (v3) V3.sfx(tx[2]); else SND(e.k === 'bus' ? 220 : 520, 0.25, 'square', 0.05, e.k === 'bus' ? 0 : 120);
        }
        if (e.k === 'cajero' && now >= e.t + e.w && !e.sp) { e.sp = 1; if (v3) { V3.sfx('moneda'); V3.sfx('chispa'); } }
        if (e.k === 'bus' && now >= e.t + e.w && !e.sp) { e.sp = 1; if (v3) V3.sfx('motor'); }
      }
      var q = P[soloI], pr = solProt(now);
      if (pr === 3 && !q.vozBank) { q.vozBank = 1; anuncia(isSolo(c.yo) ? '¡ADENTRO! NADIE TE TOCA' : '¡SE METIÓ AL BANCO!', '#5cff7a'); }
      if (pr !== 3) q.vozBank = 0;
    }
    var g = {
      update: function (dt) {
        var now = c.ahora(), p, j;
        absT += dt; flash = Math.max(0, flash - dt * 2.5); shake = Math.max(0, shake - dt * 3);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        if (now >= 0) {
          if (c.mio(soloI)) { juzga(now); recoge(now); }
        }
        for (j = coins.length - 1; j >= 0; j--) if (coins[j].got || now > coins[j].t0 + COIN_LIFE + 0.3) coins.splice(j, 1);
        for (j = swings.length - 1; j >= 0; j--) if (now > swings[j].t + 6) { delete swK[swings[j].k]; swings.splice(j, 1); }
        calleUpd(now);
        var G = geom();                                          // en 3D, el aviso de inicio y el del final los pinta marcador3D (grandes, en el centro)
        if (now >= 0.2 && !voz.ini) { voz.ini = 1; if (!c.practica && !v3) { var sp = scr(G, SW / 2, 60); S(isSolo(c.yo) ? '¡COBRASTE EL BONO!' : '¡QUÍTENLE EL BONO!', sp.x, sp.y, '#ffd23f'); } }
        if (hitAt16 >= 0 && !voz.fin) { voz.fin = 1; if (!v3) { var sg = scr(G, SW / 2, 100); S('¡CAYÓ EL BONO!', sg.x, sg.y, '#ff5a4e'); } }
        if (gross >= 4 && !voz.gag && isSolo(c.yo)) { voz.gag = 1; var sg2 = punto(P[soloI].x, P[soloI].y, -110, EH + 1.9); S('¡Cobré el bono y ya debo la mitad!', sg2.x, sg2.y, '#fffdf2'); }
        if (now < turboUntil && !voz.turbo && lv === 3) { voz.turbo = 1; var sg3 = punto(P[soloI].x, P[soloI].y, -100, EH + 2.3); S('¡ME PAGARON!', sg3.x, sg3.y, '#5cff7a'); if (v3) V3.sfx('chispa'); }
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (isSolo(p)) aiSolo(p, dt, api, now); else aiTrio(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p], now = c.ahora();
        return { x: Math.round(q.x), y: Math.round(q.y), a: isSolo(p) ? protegido(now) : 0, d: isSolo(p) ? 0 : (Math.round(((q.fa % 6.2832) + 6.2832) % 6.2832 / 6.2832 * 16) % 16) };
      },
      onEv: function (ty, p, d, t) {
        if (!d || !num(p) || p < 0 || p >= n) return;
        if (ty === 'sw') { if (!isSolo(p)) addSwing(p, d); }
        else if (ty === 'hit') { if (isSolo(p)) registerHit(d); }
        else if (ty === 'rec') { if (isSolo(p)) registerRec(d); }
      },
      alCpu: function (p) { plan[p] = { re: -9, dx: 0, dy: 0, danger: false, rx: {}, tx: P[p].x, ty: P[p].y, swRe: 0, jAt: 0, gate: -1 }; P[p].grace = c.ahora() + 0.8; P[p].aim = null; },
      alHum: function (p, o) { if (o && num(o.x) && num(o.y)) { P[p].x = o.x; P[p].y = o.y; } plan[p].re = -9; },
      scores: function () {
        var out = [], p, v = Math.min(PTS_COIN * (START - net()), Math.max(PTS_TRIO + 1, cap()));
        for (p = 0; p < n; p++) out.push(isSolo(p) ? Math.max(0, v) : PTS_TRIO);
        return out;
      },
      done: function () {
        var now = c.ahora();
        return hitAt16 >= 0 && now >= hitAt16 + CELEBRA;
      },
      hudChip: function (p) {
        if (isSolo(p)) return String(START - net());
        return P[p].hitN ? '×' + P[p].hitN : '—';
      },
      destacado: function () {
        var me = c.yo >= 0 ? c.yo : 0;
        if (isSolo(me)) return '¡Salvaste ' + (START - net()) + ' monedas!';
        return net() ? 'le quitamos ' + net() + ' moneda' + (net() === 1 ? '' : 's') : 'no le quitamos ni una moneda';
      },
      vista: function () {                                       // observable para bancos y pruebas
        var now = c.ahora();
        return { gt: now, lv: lv, soloI: soloI, gross: gross, rec: recN, net: net(), coins: coins.length, swings: swings.map(function (s) { return [s.k, s.x, s.y, s.t]; }),
          hits: Object.keys(hitSet).length, monedas: coins.filter(function (o) { return !o.got; }).map(function (o) { return [o.id, o.x, o.y]; }), sandwiches: sandN, golpes: P.map(function (q) { return q.hitN; }), x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }),
          tj: P[soloI].tj, stg: P[soloI].stg, turbo: now < turboUntil, fase: fase(now), prot: c.mio(soloI) ? protegido(now) : protRemoto(P[soloI]), recB: recB,
          eventos: EVS.map(function (e) { return [e.k, Math.round(e.t * 100) / 100]; }), bank: bankUsed, stun: P.map(function (q) { return now < q.stun; }), toldos: toldo.map(function (o) { return now < o.cae; }), nextSw: P.map(function (q) { return q.nextSw; }), gana: net() < PIERDE_NET && START - net() >= GANA_COINS, sand: lastSand };
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
