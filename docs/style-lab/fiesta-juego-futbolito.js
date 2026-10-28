'use strict';
/* LA FIESTA · EN VIVO · f_futbolito · ¡FUTBOLITO DE CALLE!  (2v2, modelo C: el juez simula, los demás interpolan y predicen su propio cuerpo)
   Calle de asfalto, arcos de chanclas, pelota de goma. Stick + A + B.
     STICK: correr. Corriendo derecho ~0,4 s se ARRANCA (+30 %): no hay botón de sprint. Cargando un tiro se camina más lento (apuntar cuesta).
     A:  TOQUE = pase al pana que esté hacia donde apunta el stick (o hacia la pelota si no lo mueves); si está lejos (>170 px) sale un GLOBITO por el aire.
         Sin pana = patada (con ayuda hacia el arco rival). MANTENER (≥0,2 s) y soltar = TIRO fuerte (hasta 0,5 s); el tiro al tope se eleva un poco.
     B:  SALTO (0,6 s). En el aire la pelota alta se CABECEA sola (hacia el stick o el arco rival); A en el aire con la pelota al alcance = ¡CHILENA! (el tiro más fuerte).
         Saltando se esquiva la moto.
     Compañeros se atraviesan, rivales se empujan (DM3-13); la pelota se conduce con el cuerpo (solo si está a la altura del cuerpo: un globito pasa por encima).
   La pelota tiene ALTURA (z, gravedad, rebote). Un balón por encima de 64 px no es gol: pega en la reja de atrás.
   Tiempo reglamentario = 0,75·dur (45 s con dur 60). Más goles gana (los dos del equipo); si hay empate quedan 0,25·dur de GOL DE ORO y si sigue empatado, empate.
   ESCALADA (por st.k/regT, vale para cualquier dur): CALMA (primer tercio, pocos eventos) · «¡SE PRENDIÓ LA CALLE!» (hasta el 70 %: eventos cada ~5 s)
     · «¡ÚLTIMOS SEGUNDOS!» (último 30 % del reglamentario y el gol de oro: eventos cada ~3 s, todos corren un 6 % más, música más rápida y luces de fiesta, y en el reglamentario
     cada gol vale DOBLE, sin pasar del tope del catálogo por asiento).
   EVENTOS DE LA CALLE (calendario sembrado en mk desde c.rng; uno a la vez; aviso de 0,8-1,2 s con carril/círculo y letrero antes de cada uno):
     ¡PERRO!     un perro entra desde la acera, persigue la pelota y se la lleva corriendo: tócalo y la suelta (el que lo toca la «toca»). Si llega a la acera la deja ahí.
     ¡RASPADOS!  el carrito del raspadero cruza la cancha despacio de acera a acera: es una pared que se mueve (la pelota rebota, empuja a quien esté en su camino).
     ¡MOTO!      un motorizado cruza rapidísimo por un carril: al que agarre lo tumba 1 s (salta o quítate); a la pelota la dispara.
     ¡CARRO!     un carro pasa a lo largo de la calle por la mitad de arriba o la de abajo: al que esté en el carril lo saca pa' la acera (tumbado 1,2 s), la pelota sale disparada.
     ¡LA VECINA! bota un tobo de agua desde la ventana en un círculo marcado: los de adentro resbalan (0,8 s) y queda un charco 5 s donde se corre lento y la pelota frena.
     ¡VENDEDOR!  el vendedor de cotufas cruza la cancha a lo ancho con su carrito: pared que camina (tapa pases y arcos, empuja, rebota la pelota).
     Nv1: perro, raspados, vecina, vendedor · Nv2: + moto · Nv3: + carro (y más seguidos).
   CONTROLES (ronda 2): buffer de A de 5 ticks (pulsar un pelín antes de llegar a la pelota patea al llegar; un tiro cargado fallido se reintenta como tiro) y de B de 4-6 ticks
     (salto pulsado en el aire o aturdido sale al aterrizar/levantarse); cabezazo y chilena con más margen de altura/alcance; fallar un toque ya no deja 0,2 s de castigo.
     Los buffers viajan en el mismo entero de pack (bits 7-13 de ch|flags), sin cambiar packN.
   El tope de goles por equipo es 15 (límite del catálogo); el fin temprano solo existe tras el reglamentario con un ganador (minT 44 del catálogo).
   Niveles: 1 arcos de 110 px (día) · 2 arcos de 90 px (atardecer) · 3 arcos de 90 px (noche).
   Orientación fija (DM3-5): el equipo de índice 0 (azul, como en el HUD y el podio, aunque no ocupe el asiento 0) defiende la IZQUIERDA y ataca a la derecha; el otro (rojo) al revés. «TU ARCO» marca el propio.
   Toda la regla vive en step() (solo el juez, 1/30 s). Estado entero y reproducible: posiciones en 1/4 px, velocidades de la pelota en 1/64 px/tick; el calendario de eventos
   sale de c.rng en mk. pack() = 52 enteros (≤300 B) y restore() sigue EXACTO tras migrar el juez.
   Puntaje por asiento = goles ANOTADOS por ese asiento (autor = último del equipo que la tocó en los últimos 3 s, si no el asiento de menor índice); la suma del equipo es el
   marcador y el reductor (compara) suma por equipo (DM3-3). Dibujo: 3D low poly (fiesta-3d.js: la calle del barrio, arcos de piedra y chancla, pista «futbolito») o, sin WebGL / ?plano=1, el 2D. Sin Math.random/Date.now.
   Decisiones de jugabilidad (todas medidas en docs/style-lab/pruebas/fiesta-futbolito-bench.js):
     · CPU: ataca el más cercano (rodea la pelota para ponerse detrás, apunta al arco con el stick al patear), el otro apoya (se adelanta por el lado contrario) o defiende
       (línea pelota→arco); salta a cabecear pelotas altas, mete chilena si puede, y se quita del carril de la moto/carro y del círculo de la vecina (mejor cuanto más hábil).
     · Cancha lógica 640×260 fija para todos (la física no depende del aparato); el dibujo la escala al ancho visible (vertical ≈ 338 u → z ≈ 0,5; apaisado z hasta 1,25) y agranda un poco cuerpos y pelota
       cuando z < 1. La pelota se dibuja encima de todos con halo claro (si no, un jugador delante la tapa).
     · Pantallas que no son el juez: la pelota se extrapola por el retraso de la vista (extrapolaPelota); el cuerpo propio se predice (predict); al pulsar A sale un «pie» local
       inmediato y al pulsar B el salto se ve al instante.
     · LÍMITE CONOCIDO (M3 §7 P1): en el banco con bots (`--red`) el equipo del juez gana ~68 % con 1 ms de retardo y >93 % a 150-300 ms. Lo que el juego puede hacer está hecho; el resto es de
       la arquitectura C (el juez ve el mundo en vivo, los demás D + latencia después). Mitigaciones fuera de este archivo: que el runtime exponga c.lag() (retraso real de la vista), subir fairDelay,
       o dejar los juegos C fuera de la bolsa con transporte RELAY. Hay que probarlo en 2 teléfonos reales. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_futbolito')) return;

var TK = 30, FW = 640, FH = 260, RP = 16, RB = 9, MAXP = 4;
var SPD = 150 / TK, RUNT = 12, RUNX = 0.3, KR = 17, KP0 = 220, CHMAX = 15, KCD = 8, BFRIC = 0.982, AFRIC = 0.995, COLL = 1.5, ASSIST = 0.55, BREST = 0.8;
var PASSCH = 5, SHOTP0 = 250, SHOTPS = 14;               // toque (ch ≤ PASSCH) = pase asistido; ch > PASSCH = tiro: 250 + (ch − 5)·14 px/s (hasta 390)
var TKT = 9, TKS = 2.5, TKCD = 26, TKR = 95, TKSTUN = 16;   // DESLIZADA (A sin pelota al alcance y con un rival cerca): 9 ticks a 2,5× la velocidad, tumba 16 ticks al rival que toca y le saca la pelota
var PASS_COS = 0.8, PASS_MIN = 60, PASS_MAX = 420, LOB_D = 170;   // el pana cuenta si está a ≤32° de la línea de puntería y a 60-420 px de la pelota; >170 px = globito
var JT = 18, JH = 38, GZ = 0.5, BODY_H = 44, HEAD_P = 290, CHIL_P = 420, GOAL_ZMAX = 64;   // salto 0,6 s y 38 px de alto; gravedad px/tick²; cuerpo 44 px; cabezazo/chilena px/s
var LAG_MAX = 0.6, PAUSE = 45, READY = 20, GOLES_MAX = 15, AUTOR_T = 90;
var LIM = { scoreMax: 15, scoreRate: 0.5, minT: 44, finTemprano: 1 };
var P1 = 0.33, P2 = 0.70;                                 // fases de la escalada (fracción del reglamentario)
var PERRO = 1, RASPA = 2, MOTO = 3, CARRO = 4, VECINA = 5, VENDE = 6;
var EV_W = [0, 24, 27, 30, 36, 30, 27];                       // aviso (ticks) de cada evento
var EV_TXT = ['', '¡PERRO! ¡QUÍTASELA!', '¡RASPADOS! ¡CUIDADO EL CARRITO!', '¡MOTO! ¡SALTA O QUÍTATE!', '¡CARRO! ¡PA\' LA ACERA!', '¡LA VECINA! ¡AGUA!', '¡EL VENDEDOR! ¡CUIDADO LA CESTA!'];
var EV_COL = ['', '#ffb36b', '#7fd6ff', '#ff5c5c', '#ff5c5c', '#5cb8ff', '#ffd23f'];
var GW = [110, 90, 90];
var G = 18, BN = 6, PS = 7, PACKN = G + BN + PS * MAXP;   // 18 globales + 6 de pelota + 7 por jugador = 52
var INK = '#14101c', COL_EQ = ['#2f6fdb', '#d93a3a'];
var PAL = [
  { cielo: '#8fd8ff', edif: ['#ffb36b', '#a9a0ff', '#ff9ec7', '#6ecf8f', '#ffd23f'], acera: '#d8d2c4', calle: '#5d5a78', campo: '#6e6c8e', raya: '#f5f0dc', sol: '#ffe14d' },
  { cielo: '#ff8f5a', edif: ['#c9704f', '#8c6aa8', '#d77a9a', '#5a9a78', '#c9a040'], acera: '#c8b4a0', calle: '#54445f', campo: '#665470', raya: '#f0d8b0', sol: '#ffe9a0' },
  { cielo: '#1d1a4a', edif: ['#3b3a7a', '#4a3a6a', '#5a3a68', '#2f5a6a', '#5a5a3a'], acera: '#6a6684', calle: '#2f2d46', campo: '#3d3b5c', raya: '#b8b4d0', sol: '#f4f0d0' }
];
function q4(v) { return Math.round(v * 4) / 4; }
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function altura(jt) { return jt > 0 ? JH * Math.sin(Math.PI * (JT - jt) / JT) : 0; }      // altura del salto según los ticks que le quedan
var BI = G, PB = G + BN;                                    // índices de la pelota y del primer jugador en el snapshot
var POSIDX = [15, 16, BI, BI + 1, BI + 4];                 // se interpolan: evento (x, y), pelota (x, y, z) y cuerpos
(function () { var i, b; for (i = 0; i < MAXP; i++) { b = PB + PS * i; POSIDX.push(b, b + 1); } })();
var DISC = [];                                              // discretos (no se interpolan): todo lo demás
(function () { var i; for (i = 0; i < PACKN; i++) if (POSIDX.indexOf(i) < 0) DISC.push(i); })();

FIESTA.LIVE.add('f_futbolito', {
  name: '¡FUTBOLITO DE CALLE!', modos: ['2v2'], clase: 'binary', modelo: 'C', dur: 60,
  stick: true, botones: 2, snapHz: 10, migra: true, minHumanos: 1,
  limites: { scoreMax: LIM.scoreMax, scoreRate: LIM.scoreRate, minT: LIM.minT, finTemprano: LIM.finTemprano },
  packN: PACKN, packDiscretos: DISC,
  carta: {
    obj: 'Mete más goles que el otro equipo. ¡Pásale a tu pana y cuidado con lo que pasa por la calle!',
    gana: 'Más goles gana (los dos del equipo). Al final cada gol vale DOBLE. Empate: gol de oro.',
    como: { tactil: 'Joystick · A toque = pase · A mantenido = tiro · A sin pelota cerca de un rival = deslizada · B salto (cabezazo) · B y A = ¡chilena!', teclado: 'WASD o flechas · ESPACIO toque = pase, mantén = tiro, sin pelota junto a un rival = deslizada · SHIFT salto · SHIFT y ESPACIO = chilena' },
    roles: null,
    demos: [
      { id: 'mover', txt: 'Corre derecho y arrancas más rápido. A: toque = pase, mantén y suelta = tiro' },
      { id: 'deslizar', txt: 'Sin pelota y con un rival cerca, A = ¡DESLIZADA! Lo tumba y le saca la pelota' },
      { id: 'saltar', txt: 'B: salta. En el aire cabeceas solo; A en el aire = ¡CHILENA!' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, durT = Math.max(3 * TK, Math.round(dur * TK)), pal = PAL[lv - 1];
    var regT = Math.max(2 * TK, Math.round(durT * 0.75)), gw = GW[lv - 1], gl = (FH - gw) / 2, i, p;
    var teams = (c.equipos && c.equipos.length === n) ? c.equipos.slice() : [];
    if (!teams.length) for (i = 0; i < n; i++) teams.push(n === 4 ? (i < 2 ? 0 : 1) : i % 2);
    var tL = teams[0], tR = -1; for (i = 0; i < n; i++) if (teams[i] < tL) tL = teams[i];       // el equipo de menor índice (0, azul en el HUD y el podio) defiende la izquierda, sin importar qué asiento ocupe
    for (i = 0; i < n; i++) if (teams[i] !== tL) { tR = teams[i]; break; }
    var side = [], idxIn = [], cnt = [0, 0], first = [-1, -1];
    for (i = 0; i < n; i++) { var sd = teams[i] === tL ? 0 : 1; side.push(sd); idxIn.push(cnt[sd]++); if (first[sd] < 0) first[sd] = i; }
    /* calendario de eventos de la calle: [tick, tipo, parámetro 0..999]. Escala con dur (sc) y se aprieta por fases. Todo de c.rng: igual en todas las pantallas. */
    var rng = c.rng, evs = [], sc = cl(dur / 60, 0.3, 1);
    (function () {
      var tipos = lv === 1 ? [PERRO, RASPA, VECINA, VENDE] : lv === 2 ? [PERRO, RASPA, MOTO, VECINA, VENDE] : [PERRO, RASPA, MOTO, CARRO, VECINA, VENDE];
      var gaps = lv === 3 ? [6.5, 4.5, 3] : [7.5, 5, 3.2], prev = 0, t = Math.round(regT * 0.14 + rng.next() * 2 * TK * sc);
      while (t < durT - TK * sc) {
        var ph = t < regT * P1 ? 0 : t < regT * P2 ? 1 : 2, k2 = 0, j2;
        for (j2 = 0; j2 < 4; j2++) { k2 = tipos[Math.floor(rng.next() * tipos.length) % tipos.length]; if (k2 !== prev) break; }
        evs.push([t, k2, Math.floor(rng.next() * 1000)]); prev = k2;
        t += Math.round((gaps[ph] + rng.next() * 1.5) * TK * sc);
      }
    })();

    /* ───── estado autoritativo ───── */
    var st = { k: 0, pause: 0, evT: -1, evIdx: 0, evK: 0, evA: 0, evB: 0, evC: 0, gold: 0, last: 0, lt: [0, 0], age: [99, 99], gs: [0, 0, 0, 0], b: { x: FW / 2, y: FH / 2, vx: 0, vy: 0, z: 0, vz: 0 }, p: [] };
    function spawnXY(pp) { var s = side[pp], m = cnt[s], j = idxIn[pp]; return { x: s === 0 ? FW * 0.27 : FW * 0.73, y: m === 1 ? FH / 2 : FH * (0.33 + 0.34 * j) }; }
    for (p = 0; p < MAXP; p++) { var sp0 = p < n ? spawnXY(p) : { x: FW / 2, y: FH / 2 }; st.p.push({ x: q4(sp0.x), y: q4(sp0.y), stun: 0, ch: 0, fh: 0, fc: 0, kcd: 0, run: 0, jt: 0, ba: 0, bb: 0, bs: 0, tk: 0, td: 0, tcd: 0 }); }
    function resetPos() {
      var j; for (j = 0; j < n; j++) { var o = spawnXY(j), q = st.p[j]; q.x = q4(o.x); q.y = q4(o.y); q.ch = 0; q.kcd = 0; q.jt = 0; q.run = 0; q.stun = 0; q.fh = 0; q.fc = 0; q.ba = 0; q.bb = 0; q.bs = 0; q.tk = 0; q.td = 0; q.tcd = 0; }
      st.b.x = FW / 2; st.b.y = FH / 2; st.b.vx = 0; st.b.vy = 0; st.b.z = 0; st.b.vz = 0;
    }
    var cpr = []; for (p = 0; p < n; p++) cpr.push({ t: 0, next: 0, tx: FW / 2, ty: FH / 2, mode: 2, ax: 0, ay: 0, lastA: -9, lastB: -9, esq: true, r: c.rngFor('cpu' + p) });
    var asiento = function (pp) { return (c.seats && c.seats[pp]) || { name: 'P' + (pp + 1), color: '#fff', ch: null }; };
    function teamOfSide(sd) { return sd === 0 ? tL : tR; }
    function inMouth(y) { return y >= gl && y <= gl + gw; }
    function teamScore(sd) { var j, s = 0; for (j = 0; j < n; j++) if (side[j] === sd) s += st.gs[j]; return s; }
    function touch(pp) { st.lt[side[pp]] = pp + 1; st.age[side[pp]] = 0; }
    function fase(k) { return k < regT * P1 ? 0 : (k < regT * P2 && !st.gold) ? 1 : 2; }     // 0 calma · 1 se prendió · 2 ¡últimos segundos!
    function evActivo() { return st.evT >= 0 && st.evT >= EV_W[st.evK]; }
    function enCharco(x, y) { if (st.evK !== VECINA || !evActivo()) return false; var dx = x - st.evA, dy = y - st.evB; return dx * dx + dy * dy < 50 * 50; }

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    function unit(x, y) { var l = Math.sqrt(x * x + y * y); return l > 1e-6 ? { x: x / l, y: y / l } : { x: 0, y: 0 }; }
    /* dirección de puntería: el stick si se mueve, si no la línea cuerpo→pelota */
    function apunta(pp, sx, sy) {
      var q = st.p[pp], b = st.b, d = unit(b.x - q.x, b.y - q.y);
      if (d.x === 0 && d.y === 0) d = { x: side[pp] === 0 ? 1 : -1, y: 0 };
      if (sx * sx + sy * sy > 0.09) { var s0 = unit(sx, sy); return { x: s0.x, y: s0.y, stick: true }; }
      return { x: d.x, y: d.y, stick: false };
    }
    function alArco(pp, ax, ay, k) {            // ayuda de puntería hacia el arco rival (siempre sin stick; con stick solo si ya apunta más o menos para allá)
      var b = st.b, g0 = unit((side[pp] === 0 ? FW : 0) - b.x, FH / 2 - b.y);
      return unit(ax * (1 - k) + g0.x * k, ay * (1 - k) + g0.y * k);
    }
    // ch = ticks mantenidos (0 = toque). Si la pelota no está al alcance, falla y deja 6 ticks de enfriamiento.
    function tryKick(pp, ch, sx, sy) {
      var q = st.p[pp], b = st.b, j;
      if (q.kcd > 0) return true;
      var dx = b.x - q.x, dy = b.y - q.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > RP + RB + KR || b.z > 26) return false;       // fuera de alcance: el llamador guarda la pulsación 5 ticks (buffer) y reintenta
      var am = apunta(pp, sx, sy), g0 = unit((side[pp] === 0 ? FW : 0) - b.x, FH / 2 - b.y), haciaArco = am.x * g0.x + am.y * g0.y > 0.2;
      var power, k2, vz = 0, passed = false;
      if (ch <= PASSCH) {
        /* pase asistido: el pana que esté más o menos hacia donde se apunta */
        var best = -1, bc = PASS_COS;
        for (j = 0; j < n; j++) {
          if (j === pp || side[j] !== side[pp]) continue;
          var mx = st.p[j].x - b.x, my = st.p[j].y - b.y, md = Math.sqrt(mx * mx + my * my);
          if (md < PASS_MIN || md > PASS_MAX) continue;
          var cs = (mx * am.x + my * am.y) / md;
          if (cs > bc) { bc = cs; best = j; }
        }
        if (best >= 0) {
          var m = st.p[best], td = Math.sqrt((m.x - b.x) * (m.x - b.x) + (m.y - b.y) * (m.y - b.y));
          k2 = unit(m.x - b.x, m.y - b.y); passed = true;
          if (td > LOB_D) { var T = cl(Math.round(td / 9), 18, 36); power = Math.min(330, td / T * TK); vz = GZ * T / 2; }        // globito: cae cerca del pana, a la altura de la cabeza si salta
          else power = cl(td * (1 - BFRIC) * TK * 1.3, 150, 330);
        }
        if (!passed) { k2 = (!am.stick || haciaArco) ? alArco(pp, am.x, am.y, ASSIST) : am; power = KP0; }
      } else {
        k2 = (!am.stick || haciaArco) ? alArco(pp, am.x, am.y, 0.7) : am;
        power = SHOTP0 + (ch - PASSCH) * SHOTPS;
        if (ch >= CHMAX) vz = 3.2;                                              // cañonazo: se levanta un poco (se puede cabecear)
      }
      b.vx = k2.x * power / TK; b.vy = k2.y * power / TK; b.vz = vz; if (vz > 0 && b.z < 1) b.z = 1; q.kcd = KCD; q.run = 0; touch(pp);
      return true;
    }
    /* DESLIZADA: A sin pelota al alcance y con un rival cerca. Dirección = stick (o hacia el rival más cercano), guardada en 16 pasos. */
    function tryTackle(pp, sx, sy) {
      var q = st.p[pp], j, best = -1, bd = TKR * TKR, dx, dy, dd;
      if (q.tcd > 0 || q.jt > 0) return false;
      for (j = 0; j < n; j++) {
        if (side[j] === side[pp] || st.p[j].stun > 0 || altura(st.p[j].jt) > 24) continue;
        dx = st.p[j].x - q.x; dy = st.p[j].y - q.y; dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = j; }
      }
      if (best < 0) return false;
      var ax, ay;
      if (sx * sx + sy * sy > 0.09) { ax = sx; ay = sy; } else { ax = st.p[best].x - q.x; ay = st.p[best].y - q.y; }
      q.td = ((Math.round(Math.atan2(ay, ax) / (Math.PI / 8)) % 16) + 16) % 16; q.tk = TKT; q.tcd = TKCD; q.ch = 0; q.run = 0; q.ba = 0; q.bs = 0;
      return true;
    }
    function tackleStep(pp, pv) {
      var q = st.p[pp], b = st.b, j, o, dx, dy, d, ang = q.td * Math.PI / 8, ux = Math.cos(ang), uy = Math.sin(ang), ox = q.x, oy = q.y, hit = false;
      q.x = q4(cl(q.x + ux * SPD * TKS, RP, FW - RP)); q.y = q4(cl(q.y + uy * SPD * TKS, RP, FH - RP));
      pv[pp].x = q.x - ox; pv[pp].y = q.y - oy; q.tk--;
      for (j = 0; j < n; j++) {
        if (side[j] === side[pp]) continue;
        o = st.p[j]; if (o.stun > 0 || altura(o.jt) > 24) continue;
        dx = o.x - q.x; dy = o.y - q.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < RP * 2 + 4) {
          hit = true; o.stun = TKSTUN; o.jt = 0; o.ch = 0; o.run = 0; o.tk = 0;
          o.x = q4(cl(o.x + ux * 10, RP, FW - RP)); o.y = q4(cl(o.y + uy * 10, RP, FH - RP));
          dx = b.x - o.x; dy = b.y - o.y;
          if (dx * dx + dy * dy < 56 * 56 && b.z < 26) { var k2 = alArco(pp, ux, uy, 0.5); b.vx = k2.x * 4.2; b.vy = k2.y * 4.2; b.vz = 1.2; b.z = Math.max(b.z, 1); touch(pp); }
        }
      }
      if (!hit) {                                                            // sin rival: si toca la pelota en el camino, la saca
        dx = b.x - q.x; dy = b.y - q.y;
        if (dx * dx + dy * dy < (RP + RB + 12) * (RP + RB + 12) && b.z < 26) { var k3 = alArco(pp, ux, uy, 0.5); b.vx = k3.x * 5; b.vy = k3.y * 5; touch(pp); hit = true; }
      }
      if (hit) q.tk = 0;
    }
    /* en el aire: A con la pelota al alcance (y en el aire) = ¡CHILENA! */
    function tryChilena(pp, sx, sy) {
      var q = st.p[pp], b = st.b, h = altura(q.jt);
      if (q.kcd > 0 || q.fc) return false;
      var dx = b.x - q.x, dy = b.y - q.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > RP + RB + KR + 8 || b.z < 8 || Math.abs(b.z - (h + 14)) > 40) return false;
      var am = apunta(pp, sx, sy), k2 = alArco(pp, am.x, am.y, 0.6);
      b.vx = k2.x * CHIL_P / TK; b.vy = k2.y * CHIL_P / TK; b.vz = 1.5; q.kcd = KCD; q.fc = 1; touch(pp);
      return true;
    }
    function cabezazo(pp, sx, sy) {
      var q = st.p[pp], b = st.b, am = apunta(pp, sx, sy), g0 = unit((side[pp] === 0 ? FW : 0) - b.x, FH / 2 - b.y);
      var k2 = (!am.stick || am.x * g0.x + am.y * g0.y > 0.2) ? alArco(pp, am.x, am.y, 0.5) : am;
      b.vx = k2.x * HEAD_P / TK; b.vy = k2.y * HEAD_P / TK; b.vz = -0.5; q.fh = 1; touch(pp);
    }
    function capAsiento() { return Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (Math.max(st.k / TK, Math.min(LIM.minT, dur - 1)) + 1.5))); }
    function goal(sd) {                       // sd = el lado que anotó (0 izquierda, 1 derecha)
      var a = -1;
      if (st.lt[sd] > 0 && st.age[sd] <= AUTOR_T) a = st.lt[sd] - 1;
      if (a < 0 || a >= n || side[a] !== sd) a = first[sd] < 0 ? 0 : first[sd];
      var val = (fase(st.k) === 2 && !st.gold && st.gs[a] + 2 <= capAsiento()) ? 2 : 1;   // ¡ÚLTIMOS SEGUNDOS!: gol doble (sin pasar del tope del servidor)
      st.gs[a] = Math.min(GOLES_MAX, st.gs[a] + val);
      st.pause = PAUSE + READY; st.last = sd + 1; st.b.vx = 0; st.b.vy = 0; st.b.vz = 0;      // el fin (por diferencia, tras el reglamentario o por goleada) lo decide done()
    }
    /* ── eventos de la calle ── */
    function evInicia(e) {
      var pr = e[2] / 1000, b = st.b;
      st.evK = e[1]; st.evT = 0; st.evC = 0;
      if (st.evK === PERRO) { st.evA = 60 + pr * 520; st.evB = (e[2] & 1) ? -24 : FH + 24; }
      else if (st.evK === RASPA) { st.evA = 150 + pr * 340; st.evB = (e[2] & 1) ? -40 : FH + 40; }
      else if (st.evK === MOTO) { st.evA = 110 + pr * 420; st.evB = (e[2] & 1) ? -40 : FH + 40; }
      else if (st.evK === CARRO) { st.evA = (e[2] & 1) ? -90 : FW + 90; st.evB = pr < 0.5 ? FH * 0.28 : FH * 0.72; }
      else if (st.evK === VENDE) { st.evA = (e[2] & 1) ? -60 : FW + 60; st.evB = FH * (0.28 + 0.22 * (e[2] % 3)); }
      else { st.evA = cl(b.x + (pr - 0.5) * 90, 60, FW - 60); st.evB = cl(b.y + ((e[2] & 2) ? 24 : -24), 46, FH - 46); }
      st.evA = q4(st.evA); st.evB = q4(st.evB);
    }
    function evFin() { st.evT = -1; st.evK = 0; st.evC = 0; st.evIdx++; }
    function soltarPerro(vx, vy) { var b = st.b; b.vx = vx; b.vy = vy; b.vz = 2.5; b.z = Math.max(b.z, 4); st.evC = 2; }
    function evPaso(P) {
      var b = st.b, j, q, dx, dy, d, t = st.evT - EV_W[st.evK], e = evs[st.evIdx], dirY = (e && (e[2] & 1)) ? 1 : -1;
      st.evT++;
      if (t < 0) return;
      if (st.evK === PERRO) {
        var px = st.evA, py = st.evB;
        if (st.evC === 0) {                                                    // persigue la pelota
          dx = b.x - px; dy = b.y - py; d = Math.sqrt(dx * dx + dy * dy) || 1;
          px += dx / d * Math.min(d, 5.6); py += dy / d * Math.min(d, 5.6);
          if (d < 16 && b.z < 16) { st.evC = 1; b.vx = 0; b.vy = 0; b.vz = 0; }
          else if (t > 90) st.evC = 2;
        } else if (st.evC === 1) {                                             // se la lleva pa' la acera más cercana
          var sy = py < FH / 2 ? -1 : 1; py += sy * 3.4; px += (px < FW / 2 ? -1 : 1) * 1.6;
          px = cl(px, 30, FW - 30);
          b.x = px + 10; b.y = py; b.z = 6; b.vx = 0; b.vy = 0; b.vz = 0;
          for (j = 0; j < n; j++) {
            q = P[j]; dx = q.x - px; dy = q.y - py;
            if (q.stun === 0 && dx * dx + dy * dy < (RP + 14) * (RP + 14)) { var u0 = unit(px - q.x, py - q.y); b.x = px; soltarPerro(u0.x * 4, u0.y * 4); touch(j); break; }
          }
          if (st.evC === 1 && (py < 4 || py > FH - 4 || t > 150)) { b.y = cl(py, RB + 2, FH - RB - 2); soltarPerro(0, py < FH / 2 ? 3 : -3); }
        } else {                                                               // se va
          var sy2 = py < FH / 2 ? -1 : 1; py += sy2 * 6;
          if (py < -40 || py > FH + 40) { evFin(); return; }
        }
        st.evA = q4(px); st.evB = q4(py);
      } else if (st.evK === RASPA || st.evK === MOTO) {
        var moto = st.evK === MOTO, vy = (moto ? 13 : 2.8) * dirY, hx = moto ? 20 : 28, hy = moto ? 22 : 22;
        st.evB = q4(st.evB + vy);
        if ((dirY > 0 && st.evB > FH + 44) || (dirY < 0 && st.evB < -44)) { evFin(); return; }
        for (j = 0; j < n; j++) {
          q = P[j]; dx = q.x - st.evA; dy = q.y - st.evB;
          if (Math.abs(dx) < hx + RP && Math.abs(dy) < hy + RP) {
            if (moto) { if (q.stun === 0 && altura(q.jt) < 20) { q.stun = 30; q.jt = 0; q.ch = 0; q.run = 0; q.x = q4(cl(st.evA + (dx >= 0 ? 1 : -1) * (hx + RP + 14), RP, FW - RP)); } }
            else {                                                             // el carrito es una pared: empuja por el lado más corto
              var ox = hx + RP - Math.abs(dx), oy = hy + RP - Math.abs(dy);
              if (ox < oy) q.x = q4(cl(q.x + (dx >= 0 ? ox : -ox), RP, FW - RP)); else q.y = q4(cl(q.y + (dy >= 0 ? oy : -oy), RP, FH - RP));
            }
          }
        }
        dx = b.x - st.evA; dy = b.y - st.evB;
        if (b.z < 30 && Math.abs(dx) < hx + RB && Math.abs(dy) < hy + RB) {
          if (moto) { b.vx = (dx >= 0 ? 3 : -3) + b.vx * 0.3; b.vy = dirY * 9; b.vz = 4.5; b.z = Math.max(b.z, 2); }
          else {
            var ox2 = hx + RB - Math.abs(dx), oy2 = hy + RB - Math.abs(dy);
            if (ox2 < oy2) { b.x += dx >= 0 ? ox2 : -ox2; if (b.vx * dx < 0) b.vx = -b.vx * BREST; }
            else { b.y += dy >= 0 ? oy2 : -oy2; if ((b.vy - vy) * dy < 0) b.vy = -(b.vy - vy) * BREST + vy; }
          }
        }
      } else if (st.evK === CARRO) {
        var dirX = st.evA < 0 ? 1 : st.evA > FW ? -1 : (e && (e[2] & 1)) ? 1 : -1, hw = 34, hl = 50;
        st.evA = q4(st.evA + dirX * 11);
        if ((dirX > 0 && st.evA > FW + 100) || (dirX < 0 && st.evA < -100)) { evFin(); return; }
        var ladoY = st.evB < FH / 2 ? 1 : -1;                                  // se sale hacia el centro de la cancha
        for (j = 0; j < n; j++) {
          q = P[j];
          if (Math.abs(q.x - st.evA) < hl + RP && Math.abs(q.y - st.evB) < hw + RP && q.stun === 0) { q.stun = 36; q.jt = 0; q.ch = 0; q.run = 0; q.y = q4(cl(st.evB + ladoY * (hw + RP + 6), RP, FH - RP)); }
        }
        if (b.z < 36 && Math.abs(b.x - st.evA) < hl + RB && Math.abs(b.y - st.evB) < hw + RB) { b.y = st.evB + ladoY * (hw + RB + 2); b.vy = ladoY * 7; b.vx = dirX * 6; b.vz = 3; b.z = Math.max(b.z, 2); }
      } else if (st.evK === VENDE) {                                           // el vendedor de cotufas cruza la calle con su carrito: pared que camina de lado a lado (tapa pases y arcos)
        var vdx = st.evA < FW / 2 ? 1 : -1, vhx = 38, vhy = 20;
        if (t === 0) st.evC = st.evA < 0 ? 1 : 2;
        vdx = st.evC === 1 ? 1 : -1;
        st.evA = q4(st.evA + vdx * 3.6);
        if ((vdx > 0 && st.evA > FW + 70) || (vdx < 0 && st.evA < -70)) { evFin(); return; }
        for (j = 0; j < n; j++) {
          q = P[j]; dx = q.x - st.evA; dy = q.y - st.evB;
          if (Math.abs(dx) < vhx + RP && Math.abs(dy) < vhy + RP) {
            var vox = vhx + RP - Math.abs(dx), voy = vhy + RP - Math.abs(dy);
            if (vox < voy) q.x = q4(cl(q.x + (dx >= 0 ? vox : -vox), RP, FW - RP)); else q.y = q4(cl(q.y + (dy >= 0 ? voy : -voy), RP, FH - RP));
          }
        }
        dx = b.x - st.evA; dy = b.y - st.evB;
        if (b.z < 32 && Math.abs(dx) < vhx + RB && Math.abs(dy) < vhy + RB) {
          var box = vhx + RB - Math.abs(dx), boy = vhy + RB - Math.abs(dy);
          if (box < boy) { b.x += dx >= 0 ? box : -box; b.vx = dx * b.vx < 0 ? -b.vx * BREST : b.vx; b.vx += vdx * 1.2; }
          else { b.y += dy >= 0 ? boy : -boy; if (b.vy * dy < 0) b.vy = -b.vy * BREST; b.vx += vdx * 0.5; }
        }
      } else if (st.evK === VECINA) {
        if (t === 0) {                                                         // ¡SPLASH!
          for (j = 0; j < n; j++) { q = P[j]; dx = q.x - st.evA; dy = q.y - st.evB; if (dx * dx + dy * dy < 46 * 46 && q.stun === 0) { q.stun = 24; q.jt = 0; q.ch = 0; q.run = 0; } }
          dx = b.x - st.evA; dy = b.y - st.evB; if (dx * dx + dy * dy < 46 * 46) { b.vx *= 0.3; b.vy *= 0.3; b.vz = 4; b.z = Math.max(b.z, 2); }
        }
        if (t >= 150) evFin();
      }
    }
    function step() {
      var P = st.p, b = st.b, i2, j, ex, ey, len, e, sp, dx, dy, d, pv = [], oi, ord = [], fz = fase(st.k);
      for (oi = 0; oi < n; oi++) ord.push((st.k & 1) ? n - 1 - oi : oi);           // orden alterno por tick: ningún lado gana siempre los empates de patada/contacto
      st.age[0] = Math.min(99, st.age[0] + 1); st.age[1] = Math.min(99, st.age[1] + 1);
      for (oi = 0; oi < n; oi++) {
        i2 = ord[oi];
        var tapN = c.tap(i2, 'a'), tapB = c.tap(i2, 'b'), hA = c.held(i2, 'a');
        e = c.eje(i2) || { x: 0, y: 0 };
        ex = +e.x || 0; ey = +e.y || 0; len = Math.sqrt(ex * ex + ey * ey); if (len > 1) { ex /= len; ey /= len; len = 1; }
        var q = P[i2], frozen = st.pause > 0 || q.stun > 0;
        pv[i2] = { x: 0, y: 0 };
        if (q.stun > 0) q.stun--;
        if (q.jt > 0) { q.jt--; if (q.jt === 0) { q.fh = 0; q.fc = 0; } }
        if (frozen) { q.tk = 0; if (q.tcd > 0) q.tcd--; if (q.kcd > 0) q.kcd--; if (!hA) q.ch = 0; q.run = 0; q.ba = 0; q.bs = 0; q.bb = (st.pause === 0 && q.stun > 0 && tapB > 0) ? 6 : q.bb > 0 ? q.bb - 1 : 0; continue; }
        if (q.bb > 0) q.bb--;
        if (q.tcd > 0) q.tcd--;
        if (q.tk > 0) { tackleStep(i2, pv); if (q.kcd > 0) q.kcd--; if (tapB > 0) q.bb = 4; continue; }
        if ((tapB > 0 || q.bb > 0) && q.jt === 0) { q.jt = JT; q.fh = 0; q.fc = 0; q.ch = 0; q.bb = 0; }       // buffer de B: un salto pulsado en el aire/aturdido sale al aterrizar/levantarse
        else if (tapB > 0) q.bb = 4;
        var aire = q.jt > 0, mov = len > 0.2;
        q.run = mov && !aire ? Math.min(RUNT, q.run + 1) : aire ? q.run : 0;
        sp = SPD * (aire ? 1.1 : 1 + RUNX * q.run / RUNT) * (fz === 2 ? 1.06 : 1) * (q.ch > PASSCH ? 0.7 : 1) * (enCharco(q.x, q.y) ? 0.55 : 1);
        var ox = q.x, oy = q.y;
        q.x = q4(cl(q.x + ex * sp, RP, FW - RP)); q.y = q4(cl(q.y + ey * sp, RP, FH - RP));
        pv[i2].x = q.x - ox; pv[i2].y = q.y - oy;
        if (q.kcd > 0) q.kcd--;
        if (q.ba > 0) q.ba--;
        if (aire) { q.ch = 0; if (tapN > 0 || q.ba > 0) { if (tryChilena(i2, ex, ey)) q.ba = 0; else if (tapN > 0) q.ba = 5; } continue; }
        if (hA) { if (q.kcd === 0) q.ch = Math.min(q.ch + 1, CHMAX); q.ba = 0; }
        else if (q.ch > 0) { if (!tryKick(i2, q.ch, ex, ey)) { q.ba = 5; q.bs = q.ch > PASSCH ? 1 : 0; } else { q.ba = 0; q.bs = 0; } q.ch = 0; }
        else if (tapN > 0 || q.ba > 0) { if (tryKick(i2, q.bs ? PASSCH + 4 : 0, ex, ey)) { q.ba = 0; q.bs = 0; } else if (tapN > 0) { if (!tryTackle(i2, ex, ey)) { q.ba = 5; q.bs = 0; } } }
      }
      if (st.pause > 0) { st.pause--; if (st.pause === READY) resetPos(); st.k++; return; }
      if (!st.gold && st.k >= regT && teamScore(0) === teamScore(1)) st.gold = 1;
      /* empujones: los rivales se empujan, los compañeros se atraviesan (DM3-13); en el aire no hay empujón */
      for (var pass = 0; pass < 2; pass++) for (i2 = 0; i2 < n; i2++) for (j = i2 + 1; j < n; j++) {
        if (side[i2] === side[j] || Math.abs(altura(P[i2].jt) - altura(P[j].jt)) > 24) continue;
        dx = P[j].x - P[i2].x; dy = P[j].y - P[i2].y; d = Math.sqrt(dx * dx + dy * dy);
        if (d >= RP * 2) continue;
        if (d < 0.01) { dx = (j - i2); dy = 0.5; d = Math.sqrt(dx * dx + dy * dy); }
        var push = (RP * 2 - d) / 2; dx /= d; dy /= d;
        P[i2].x -= dx * push; P[i2].y -= dy * push; P[j].x += dx * push; P[j].y += dy * push;
      }
      for (i2 = 0; i2 < n; i2++) { P[i2].x = q4(cl(P[i2].x, RP, FW - RP)); P[i2].y = q4(cl(P[i2].y, RP, FH - RP)); }
      /* eventos de la calle */
      if (st.evT < 0 && st.evIdx < evs.length && st.k >= evs[st.evIdx][0]) evInicia(evs[st.evIdx]);
      if (st.evT >= 0) evPaso(P);
      var llevada = st.evK === PERRO && st.evC === 1 && evActivo();
      /* pelota */
      if (!llevada) {
        b.x += b.vx; b.y += b.vy; b.z += b.vz;
        var fr = b.z > 0.5 ? AFRIC : enCharco(b.x, b.y) ? 0.95 : BFRIC;
        b.vx *= fr; b.vy *= fr;
        if (b.z > 0 || b.vz > 0) b.vz -= GZ;
        if (b.z <= 0) { b.z = 0; b.vz = b.vz < -2.2 ? -b.vz * 0.45 : 0; }
        if (Math.abs(b.vx) < 0.02) b.vx = 0;
        if (Math.abs(b.vy) < 0.02) b.vy = 0;
        for (oi = 0; oi < n; oi++) {
          i2 = ord[oi];
          var qq = P[i2], h = altura(qq.jt);
          dx = b.x - qq.x; dy = b.y - qq.y; d = Math.sqrt(dx * dx + dy * dy);
          if (qq.jt > 0 && !qq.fh && qq.stun === 0 && d < RP + RB + 14 && b.z >= h + 16 && b.z <= h + 70) { cabezazo(i2, (c.eje(i2) || {}).x || 0, (c.eje(i2) || {}).y || 0); continue; }
          if (d < RP + RB && b.z + RB * 2 > h && b.z < h + BODY_H) {             // el cuerpo empuja la pelota (conducir) solo si está a su altura
            if (d < 0.01) { dx = side[i2] === 0 ? 1 : -1; dy = 0; d = 1; }
            var nx = dx / d, ny = dy / d;
            b.x += nx * (RP + RB - d); b.y += ny * (RP + RB - d);
            var rel = (b.vx - pv[i2].x) * nx + (b.vy - pv[i2].y) * ny;
            if (rel < 0) { b.vx -= COLL * rel * nx; b.vy -= COLL * rel * ny; if (rel < -6 && b.z < 4) { b.vz = 2.5; b.z = 1; } }
            touch(i2);
          }
        }
        var alta = b.z > GOAL_ZMAX;
        if (b.y < RB) { b.y = RB; b.vy = -b.vy * BREST; } else if (b.y > FH - RB) { b.y = FH - RB; b.vy = -b.vy * BREST; }
        if (b.x < RB && (!inMouth(b.y) || alta)) { b.x = RB; b.vx = -b.vx * BREST; }
        else if (b.x > FW - RB && (!inMouth(b.y) || alta)) { b.x = FW - RB; b.vx = -b.vx * BREST; }
        var sp2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy); if (sp2 > 14) { b.vx *= 14 / sp2; b.vy *= 14 / sp2; }
      }
      b.x = q4(b.x); b.y = q4(b.y); b.z = q4(Math.max(0, b.z)); b.vx = Math.round(b.vx * 64) / 64; b.vy = Math.round(b.vy * 64) / 64; b.vz = Math.round(b.vz * 64) / 64;
      st.k++;
      if (b.x < 0) goal(1); else if (b.x > FW) goal(0);
    }

    /* ───────────────────────── snapshot ───────────────────────── */
    function pack() {
      var a = [st.k, st.pause, st.evT, st.evIdx, st.gold, st.last, st.lt[0], st.lt[1], st.age[0], st.age[1], st.gs[0], st.gs[1], st.gs[2], st.gs[3],
        st.evK, Math.round(st.evA * 4), Math.round(st.evB * 4), st.evC], i2, q;
      a.push(Math.round(st.b.x * 4), Math.round(st.b.y * 4), Math.round(st.b.vx * 64), Math.round(st.b.vy * 64), Math.round(st.b.z * 4), Math.round(st.b.vz * 64));
      for (i2 = 0; i2 < MAXP; i2++) { q = st.p[i2]; a.push(Math.round(q.x * 4), Math.round(q.y * 4), q.stun, q.ch | (q.fh << 5) | (q.fc << 6) | (q.ba << 7) | (q.bb << 10) | (q.bs << 13) | (q.tk << 14) | (q.td << 18) | (q.tcd << 22), q.kcd, q.run, q.jt); }
      return a;
    }
    function load(a) {
      if (!a || a.length < PACKN) return;
      var i2, o, q;
      st.k = a[0] | 0; st.pause = a[1] | 0; st.evT = a[2] | 0; st.evIdx = a[3] | 0; st.gold = a[4] | 0; st.last = a[5] | 0;
      st.lt[0] = a[6] | 0; st.lt[1] = a[7] | 0; st.age[0] = a[8] | 0; st.age[1] = a[9] | 0; st.gs[0] = a[10] | 0; st.gs[1] = a[11] | 0; st.gs[2] = a[12] | 0; st.gs[3] = a[13] | 0;
      st.evK = a[14] | 0; st.evA = a[15] / 4; st.evB = a[16] / 4; st.evC = a[17] | 0;
      st.b.x = a[BI] / 4; st.b.y = a[BI + 1] / 4; st.b.vx = a[BI + 2] / 64; st.b.vy = a[BI + 3] / 64; st.b.z = a[BI + 4] / 4; st.b.vz = a[BI + 5] / 64;
      for (i2 = 0; i2 < MAXP; i2++) {
        o = PB + PS * i2; q = st.p[i2]; q.x = a[o] / 4; q.y = a[o + 1] / 4; q.stun = a[o + 2] | 0;
        q.ch = (a[o + 3] | 0) & 31; q.fh = ((a[o + 3] | 0) >> 5) & 1; q.fc = ((a[o + 3] | 0) >> 6) & 1; q.ba = ((a[o + 3] | 0) >> 7) & 7; q.bb = ((a[o + 3] | 0) >> 10) & 7; q.bs = ((a[o + 3] | 0) >> 13) & 1; q.tk = ((a[o + 3] | 0) >> 14) & 15; q.td = ((a[o + 3] | 0) >> 18) & 15; q.tcd = ((a[o + 3] | 0) >> 22) & 31; q.kcd = a[o + 4] | 0; q.run = a[o + 5] | 0; q.jt = a[o + 6] | 0;
      }
    }
    function lerp(a, b, u) {
      var out = b.slice(), i2, ix;
      for (i2 = 0; i2 < POSIDX.length; i2++) { ix = POSIDX[i2]; if (Math.abs(b[ix] - a[ix]) < 800 && (ix > 16 || a[14] === b[14])) out[ix] = Math.round(a[ix] + (b[ix] - a[ix]) * u); }
      return out;
    }

    /* ───────────────────────── presentación ───────────────────────── */
    var foot = 0, prevA = false, prevB = false, saltoLocal = 0, at = 0, mp = null, banner = null, bannerT = 0, prevSc = [0, 0], prevGold = 0, prevPause = 0, shake = 0, kickFx = [], pv0 = null;
    var prevEvAct = false, prevFase = 0, prevFlags = [0, 0, 0, 0], runL = 0;
    function isJudge() { return c.juez(); }
    function posOf(pp) { if (pp === c.yo && !isJudge() && mp) return mp; return st.p[pp]; }
    /* Extrapolación de la PELOTA en las pantallas que no son el juez. La pantalla interpola ~D s (0,10-0,25) detrás del juez y, si el snapshot siguiente no llegó, se queda en el último;
       sin corregirlo, quien persigue una pelota que vuelve a 400 px/s la ve 60-100 px atrás de donde está (M3 §7 P1: el equipo del juez ganaba ~98 % a 150 ms de retardo en el banco).
       Retraso de la vista: si el runtime lo da (`c.lag()` en s) se usa tal cual; si no, se estima al cambiar el snapshot (k nuevo): ahora − kAnterior/30, que en el banco sale
       ≈ 2 × el retraso real, por eso se usa la mitad. Se adelanta SOLO la pelota (fricción, gravedad y paredes, sin jugadores): el juez confirma goles y choques. */
    var lastK = -1, lagEst = -1;
    function lagVista() {
      if (typeof c.lag === 'function') { var l0 = +c.lag(); if (l0 >= 0) return cl(l0, 0, LAG_MAX); }
      if (st.k !== lastK) {
        if (lastK >= 0 && st.k > lastK) { var smp = cl(c.ahora() - lastK / TK, 0, 2 * LAG_MAX); lagEst = lagEst < 0 ? smp : lagEst + (smp - lagEst) * 0.2; }
        lastK = st.k;
      }
      return lagEst < 0 ? 0 : lagEst * 0.5;
    }
    function extrapolaPelota() {
      var lag = lagVista();
      if (lag <= 0.02 || st.pause > 0 || (st.evK === PERRO && st.evC === 1)) return;
      var b = st.b, t = Math.round(lag * TK), x = b.x, y = b.y, vx = b.vx, vy = b.vy, z = b.z, vz = b.vz;
      while (t-- > 0) {
        x += vx; y += vy; z += vz; var fr = z > 0.5 ? AFRIC : BFRIC; vx *= fr; vy *= fr;
        if (z > 0 || vz > 0) vz -= GZ;
        if (z <= 0) { z = 0; vz = vz < -2.2 ? -vz * 0.45 : 0; }
        if (y < RB) { y = RB; vy = -vy * BREST; } else if (y > FH - RB) { y = FH - RB; vy = -vy * BREST; }
        if (x < RB && (!inMouth(y) || z > GOAL_ZMAX)) { x = RB; vx = -vx * BREST; } else if (x > FW - RB && (!inMouth(y) || z > GOAL_ZMAX)) { x = FW - RB; vx = -vx * BREST; }
        if (x < 0 || x > FW) break;                                           // gol: lo confirma el juez
      }
      b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.z = z; b.vz = vz;
    }
    function predict(dt, auth) {
      if (isJudge()) return;
      extrapolaPelota();
      if (c.yo < 0 || c.yo >= n) return;
      var a = st.p[c.yo];
      if (!mp) mp = { x: a.x, y: a.y };
      if (a.stun > 0 || st.pause > 0 || a.tk > 0) { runL = 0; mp.x += (a.x - mp.x) * Math.min(1, dt * 12); mp.y += (a.y - mp.y) * Math.min(1, dt * 12); }
      else {
        var e = c.eje(c.yo) || { x: 0, y: 0 }, ax = +e.x || 0, ay = +e.y || 0, len = Math.sqrt(ax * ax + ay * ay); if (len > 1) { ax /= len; ay /= len; len = 1; }
        var aire = a.jt > 0 || saltoLocal > 0;
        runL = len > 0.2 && !aire ? Math.min(RUNT, runL + dt * TK) : aire ? runL : 0;
        var sp = SPD * TK * dt * (aire ? 1.1 : 1 + RUNX * runL / RUNT) * (fase(st.k) === 2 ? 1.06 : 1) * (a.ch > PASSCH ? 0.7 : 1) * (enCharco(mp.x, mp.y) ? 0.55 : 1);
        mp.x = cl(mp.x + ax * sp, RP, FW - RP); mp.y = cl(mp.y + ay * sp, RP, FH - RP);
      }
      var dx = a.x - mp.x, dy = a.y - mp.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 60) { mp.x = a.x; mp.y = a.y; } else if (d > 14) { var m = (d - 14) * Math.min(1, dt * 5); mp.x += dx / d * m; mp.y += dy / d * m; }   // corrección suave con zona muerta (antes empujaba 8 px por cuadro y temblaba)
    }
    function banr(s, col, t) { banner = { s: s, col: col }; bannerT = t || 1.6; }
    /* Encaje en pantalla: la cancha lógica (640×260) se dibuja ESCALADA para que quepa en el ancho visible (vertical ≈ 338, apaisado ≥ 800); z ∈ [0,42; 1,25] (margen de 90 u para los arcos que sobresalen).
       Los cuerpos y la pelota se agrandan un poco (e) cuando z < 1 para que se lean en el teléfono; la física no se entera. */
    function lay() {
      var f = c.campo();
      /* c.campo() puede devolver 0..800 aunque la vista real sea más estrecha (engine.js declara gameLeft/GAME_VIEW con const: no cuelgan de window); si el motor está, se lee su vista real */
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width, y0: f.y0, y1: f.y1 };
      var vw = f.x1 - f.x0, z = cl(vw / (FW + 90), 0.42, 1.25), e = z < 1 ? Math.min(1.3, Math.pow(z, -0.35)) : 1;
      return { f: f, z: z, e: e, cx: (f.x0 + f.x1) / 2, cy: z < 0.8 ? 318 : 312 };
    }
    function scr(l, x, y) { return { x: l.cx + (x - FW / 2) * l.z, y: l.cy + (y - FH / 2) * l.z }; }
    function sideColor(sd) { var t = teamOfSide(sd); return COL_EQ[t === 1 ? 1 : 0]; }   // color = índice de equipo (igual que el HUD y el podio)
    function update(dt) {
      at += dt; bannerT = Math.max(0, bannerT - dt); shake = Math.max(0, shake - dt * 3); saltoLocal = Math.max(0, saltoLocal - dt);
      var i2, s0 = teamScore(0), s1 = teamScore(1), L = lay();
      var sc2 = [s0, s1];
      for (i2 = 0; i2 < 2; i2++) if (sc2[i2] > prevSc[i2]) {
        var gp = scr(L, i2 === 0 ? FW : 0, FH / 2), doble = sc2[i2] - prevSc[i2] >= 2;
        banr(doble ? '¡GOL DOBLE!' : '¡GOOOL!', sideColor(i2), 1.8); shake = 1;
        if (v3) gol3D(i2, doble);
        else { SND(1200, 0.3, 'square', 0.1, 400); SPAWN(gp.x, gp.y, 24, 'conf', ['#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a'], 360, 500, 1.0); }
        if (sc2[1 - i2] + 3 <= sc2[i2] && sc2[i2] >= 3) S('¡EL DUEÑO DE LA PELOTA SE VA PA\' SU CASA!', L.cx, scr(L, 0, 0).y - 20, '#fffdf2');
      }
      prevSc[0] = s0; prevSc[1] = s1;
      /* escalada: letrero, sacudida, música y luces al cambiar de fase */
      var fz = c.ahora() >= 0 ? fase(st.k) : 0;
      if (fz > prevFase) {
        if (fz === 1) { banr('¡SE PRENDIÓ LA CALLE!', '#ffb36b', 2.2); shake = 0.6; if (v3) { V3.sfx('tambor'); v3.esc.sacudir(.4); } else SND(330, 0.25, 'square', 0.08, 0); }
        else { banr(st.gold ? '¡ÚLTIMOS SEGUNDOS!' : '¡ÚLTIMOS SEGUNDOS! GOL DOBLE', '#ff5c8a', 2.6); shake = 1; if (v3) { V3.sfx('silbato'); V3.sfx('tambor'); v3.esc.sacudir(.8); } else SND(520, 0.4, 'square', 0.1, 200); }
      }
      prevFase = fz;
      /* eventos de la calle: aviso al empezar, efecto cuando se activa */
      var act = evActivo();
      if (st.evT >= 0 && st.evK > 0 && st.evIdx !== avisoIdx) {
        avisoIdx = st.evIdx; banr(EV_TXT[st.evK], EV_COL[st.evK], 1.6);
        if (v3) evAviso3D(st.evK); else SND(260, 0.2, 'sawtooth', 0.06, 0);
      }
      if (act && !prevEvAct) { if (v3) evYa3D(st.evK); else SND(st.evK === VECINA ? 900 : 180, 0.3, 'sawtooth', 0.07, 60); if (st.evK !== PERRO && st.evK !== RASPA) shake = Math.max(shake, 0.5); }
      prevEvAct = act;
      if (st.gold && !prevGold) { banr('¡GOL DE ORO!', '#ffd23f', 2.4); S('¡EL QUE METE SE QUEDA CON LA PELOTA!', L.cx, scr(L, 0, 0).y - 20, '#ffd23f'); if (v3) oro3D(); }
      prevGold = st.gold;
      if (prevPause > READY && st.pause <= READY && st.pause > 0) { banr('¡LISTOS!', '#fffdf2', 0.6); if (v3) V3.sfx('silbato'); }
      prevPause = st.pause;
      /* cabezazo y chilena: el juez marca la bandera en el jugador */
      for (i2 = 0; i2 < n; i2++) {
        var q = st.p[i2], fl = (q.fh ? 1 : 0) | (q.fc ? 2 : 0);
        if ((fl & 2) && !(prevFlags[i2] & 2)) { banr('¡CHILENA!', sideColor(side[i2]), 1.4); shake = Math.max(shake, 0.7); if (v3) chilena3D(i2); }
        else if ((fl & 1) && !(prevFlags[i2] & 1)) { banr('¡CABEZAZO!', sideColor(side[i2]), 1.1); if (v3) cabeza3D(i2); }
        prevFlags[i2] = fl;
      }
      if (c.yo >= 0 && c.yo < n) {
        var ha = !!c.held(c.yo, 'a'), hb = !!c.held(c.yo, 'b'), yoq = st.p[c.yo];
        if (ha && !prevA) { foot = 0.22; if (v3) pie3D(c.yo); else SND(180, 0.04, 'square', 0.04, 60); }   // «pie» local al pulsar A (la pelota no se predice: respuesta inmediata aunque la pelota tarde)
        if (hb && !prevB && yoq.jt === 0 && yoq.stun === 0 && st.pause === 0 && saltoLocal <= 0) { saltoLocal = JT / TK; if (v3) salto3D(c.yo); else SND(420, 0.08, 'square', 0.04, 700); }   // el salto se ve al instante
        prevA = ha; prevB = hb;
      }
      foot = Math.max(0, foot - dt);
      var sp = Math.sqrt(st.b.vx * st.b.vx + st.b.vy * st.b.vy);      // patada: la pelota gana de golpe velocidad
      if (pv0 !== null && sp > pv0 + 2.2 && st.pause === 0) { kickFx.push({ x: st.b.x, y: st.b.y, t: 0 }); if (v3) patada3D(sp); else SND(sp > 9 ? 340 : 260, 0.06, 'square', 0.05, 90); }
      pv0 = sp;
      for (i2 = kickFx.length - 1; i2 >= 0; i2--) { kickFx[i2].t += dt; if (kickFx[i2].t > 0.35) kickFx.splice(i2, 1); }
    }
    var avisoIdx = -1;

    /* ───────────────────────── CPU ───────────────────────── */
    // Una CPU decide cada rt = 0,30 − 0,16·skill s (+ hasta 50 ms): no lee la cancha más rápido que eso.
    // Reparto dinámico por equipo: ATACA el más cercano a la pelota (empate ⇒ menor índice; si un humano es más cercano, la CPU defiende y no le «roba» la pelota);
    // el otro APOYA (pelota en campo rival: se adelanta por el lado contrario para recibir pases) o DEFIENDE (se interpone entre la pelota y su arco).
    // Eventos: se quita del carril de la moto/carro y del círculo de la vecina (si «se da cuenta»: más probable con más habilidad); al perro lo persigue solo (la pelota va en su boca).
    function frozenNow() { return st.pause > 0; }
    function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
    function esquiva(S0, me) {                  // corrige el destino para salir del peligro que viene
      if (st.evT < 0 || !S0.esq) return;
      var k = st.evK, w = st.evT < EV_W[k];
      if (k === MOTO && Math.abs(me.x - st.evA) < 44) S0.tx = cl(st.evA + (me.x >= st.evA ? 64 : -64), RP, FW - RP);
      else if (k === VENDE && Math.abs(me.y - st.evB) < 44 && Math.abs(me.x - st.evA) < 110) S0.ty = cl(st.evB + (me.y >= st.evB ? 66 : -66), RP, FH - RP);
      else if (k === CARRO && Math.abs(me.y - st.evB) < 56) S0.ty = cl(st.evB + (st.evB < FH / 2 ? 80 : -80), RP, FH - RP);
      else if (k === VECINA && w && dist(me.x, me.y, st.evA, st.evB) < 60) { var u = dist(me.x, me.y, st.evA, st.evB) || 1; S0.tx = cl(st.evA + (me.x - st.evA) / u * 70, RP, FW - RP); S0.ty = cl(st.evB + (me.y - st.evB) / u * 70, RP, FH - RP); }
    }
    function ai(pp, dt, api) {
      var S0 = cpr[pp], me = posOf(pp), b = st.b, sk = (c.skill && typeof c.skill[pp] === 'number') ? c.skill[pp] : 0.6, sd = side[pp], j, q = st.p[pp];
      S0.t += dt;
      if (frozenNow() || q.stun > 0) { api.eje(0, 0); api.hold('a', false); api.hold('b', false); return; }
      var foe = sd === 0 ? FW : 0, own = sd === 0 ? 0 : FW, dir = sd === 0 ? 1 : -1;
      if (S0.t >= S0.next) {
        S0.next = S0.t + (0.30 - 0.16 * sk) + S0.r.next() * 0.05;
        S0.esq = S0.r.next() < 0.45 + 0.5 * sk;
        var lead = 4 + 5 * sk, pbx = cl(b.x + b.vx * lead, RB, FW - RB), pby = cl(b.y + b.vy * lead, RB, FH - RB);
        var dme = dist(pbx, pby, me.x, me.y), chaser = true;
        for (j = 0; j < n; j++) {
          if (j === pp || side[j] !== sd) continue;
          var dm = dist(pbx, pby, st.p[j].x, st.p[j].y);
          if (dm < dme - 8 || (Math.abs(dm - dme) <= 8 && j < pp)) chaser = false;
        }
        if (chaser) {
          var aimY = FH / 2 + (S0.r.next() * 2 - 1) * gw * 0.32;
          var gx = foe - pbx, gy = aimY - pby, gd = Math.sqrt(gx * gx + gy * gy) || 1; gx /= gd; gy /= gd;
          var D = RP + RB + 3, vx = me.x - pbx, vy = me.y - pby, along = vx * gx + vy * gy, perp = vx * (-gy) + vy * gx;
          var err = (S0.r.next() * 2 - 1) * (22 - 18 * sk);
          if (along < -10 && Math.abs(perp) < 60 + 40 * (-along / 80)) { S0.tx = pbx - gx * D + err * (-gy); S0.ty = pby - gy * D + err * gx; }
          else { var sg = perp >= 0 ? 1 : -1; S0.tx = pbx - gx * (D + 24) + (-gy) * sg * 46; S0.ty = pby - gy * (D + 24) + gx * sg * 46; }
          S0.tx = cl(S0.tx, RP, FW - RP); S0.ty = cl(S0.ty, RP, FH - RP);
          S0.mode = 1; S0.ax = gx; S0.ay = gy;
        } else if ((pbx - FW / 2) * dir > 20) {                                // apoyo: adelantado y por el lado contrario al de la pelota
          S0.tx = cl(FW / 2 + dir * (130 + 40 * sk), RP, FW - RP); S0.ty = cl(FH - pby, 30, FH - 30);
          S0.mode = 3;
        } else {                                                              // defensa: sobre la línea pelota → centro del arco propio
          var fr = 0.38, tx2 = own + (pbx - own) * fr, ty2 = FH / 2 + (pby - FH / 2) * 0.55;
          if (Math.abs(tx2 - own) < 70) tx2 = own + dir * 70;
          S0.tx = cl(tx2, RP, FW - RP); S0.ty = cl(ty2 + (S0.r.next() * 2 - 1) * (14 - 10 * sk), gl - 14, gl + gw + 14); S0.mode = 2;
        }
        esquiva(S0, me);
      }
      var dx = S0.tx - me.x, dy = S0.ty - me.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5) api.eje(dx / d, dy / d); else api.eje(0, 0);
      api.hold('b', false); api.hold('a', false);
      var bdx = b.x - me.x, bdy = b.y - me.y, bd = Math.sqrt(bdx * bdx + bdy * bdy);
      /* pelota alta que baja cerca: saltar a cabecearla (o a la chilena si va al ataque) */
      if (q.jt === 0 && b.z > 18 && b.z < 90 && b.vz <= 1 && bd < 46 && S0.t - S0.lastB > 0.7 && S0.r.next() < 0.25 + 0.5 * sk) { S0.lastB = S0.t; api.press('b'); }
      if (q.jt > 0) {
        if (S0.mode === 1 && bd <= RP + RB + KR && b.z >= 10 && S0.t - S0.lastA > 0.3) { S0.lastA = S0.t; api.eje(S0.ax, S0.ay); api.press('a'); }
        return;
      }
      if (q.tcd === 0 && bd > RP + RB + KR + 4 && S0.t - S0.lastA > 1.0 && S0.r.next() < 0.03 + 0.05 * sk) {            // deslizada al rival que lleva la pelota
        var fo = -1, fd = TKR * 0.8;
        for (j = 0; j < n; j++) if (side[j] !== sd && st.p[j].stun === 0) { var dj = dist(st.p[j].x, st.p[j].y, me.x, me.y); if (dj < fd && dist(st.p[j].x, st.p[j].y, b.x, b.y) < 45) { fd = dj; fo = j; } }
        if (fo >= 0) { S0.lastA = S0.t; api.eje(st.p[fo].x - me.x, st.p[fo].y - me.y); api.press('a'); return; }
      }
      if (bd <= RP + RB + KR - 4 && b.z < 20 && S0.t - S0.lastA > 0.30 + 0.1 * (1 - sk)) {
        var ok;
        if (S0.mode === 1) {                                                  // el tiro sale hacia el arco rival: tolerar el ángulo según la habilidad
          var kx = bdx / (bd || 1), ky = bdy / (bd || 1), tx = foe - b.x, ty = FH / 2 - b.y, tl2 = Math.sqrt(tx * tx + ty * ty) || 1;
          ok = (kx * tx / tl2 + ky * ty / tl2) > (0.72 - 0.25 * sk);
          if (ok) api.eje(kx * 0.5 + S0.ax * 0.5, ky * 0.5 + S0.ay * 0.5);    // apunta con el stick (mitad cuerpo→pelota, mitad arco)
        } else { ok = ((b.x - FW / 2) * dir < 40); if (ok) api.eje(0, 0); }   // defendiendo/apoyando: solo despejar si la pelota está de su lado (sin stick: sale con ayuda al arco)
        if (ok) { S0.lastA = S0.t; api.press('a'); }
      }
    }

    /* ───────────────────────── dibujo ───────────────────────── */
    function fondo(l) {                         // fondo en coordenadas de PANTALLA (no escala con la cancha)
      var f = l.f, x0 = f.x0, x1 = f.x1, w = x1 - x0, k;
      rr(x0, 0, w, 140, 0, pal.cielo, 0);
      if (lv === 3) { for (k = 0; k < 12; k++) ell(x0 + ((k * 151) % w), 12 + (k * 31) % 60, 2, 2, '#fffdf2', 0); ell(x1 - 90, 60, 22, 22, pal.sol, 0); }
      else ell(lv === 1 ? x1 - 90 : x0 + 90, lv === 1 ? 54 : 108, 28, 28, pal.sol, 0);
      var bw = 92, nb = Math.ceil(w / bw) + 1;
      for (k = 0; k < nb; k++) { var h = 54 + ((k * 37) % 40); rr(x0 + k * bw, 140 - h, bw - 3, h + 16, 4, pal.edif[k % 5], 3); rr(x0 + k * bw + 14, 140 - h + 12, 20, 18, 3, lv === 3 ? '#ffe27a' : '#fffdf2', 2); rr(x0 + k * bw + 50, 140 - h + 12, 20, 18, 3, lv === 3 ? '#ffe27a' : '#fffdf2', 2); }
      rr(x0, 148, w, 38, 0, pal.acera, 0); line([[x0, 148], [x1, 148]], 4, INK);
      rr(x0, 186, w, 460, 0, pal.calle, 0);
    }
    function cancha() {                         // en coordenadas de CANCHA (0..FW, 0..FH)
      rr(0, 0, FW, FH, 6, pal.campo, 4);
      line([[3, 3], [FW - 3, 3], [FW - 3, FH - 3], [3, FH - 3], [3, 3]], 3, pal.raya);                  // líneas de banda y de fondo, para ver bien los límites
      line([[FW / 2, 0], [FW / 2, FH]], 3, pal.raya);
      ell(FW / 2, FH / 2, 40, 40, pal.campo, 3);
      ell(FW / 2, FH / 2, 4, 4, pal.raya, 0);
      line([[0, gl], [26, gl], [26, gl + gw], [0, gl + gw]], 3, pal.raya);
      line([[FW, gl], [FW - 26, gl], [FW - 26, gl + gw], [FW, gl + gw]], 3, pal.raya);
    }
    function chancla(x, y, ang, s, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); rr(-20, -8, 40, 16, 8, col, 3); poly([[-6, -7], [6, -7], [0, 5]], '#fffdf2', 2.5); ctx.restore(); }
    function arco(sd) {
      var x = sd === 0 ? 0 : FW, dir = sd === 0 ? -1 : 1, col = sideColor(sd);
      chancla(x, gl - 6, Math.PI / 2, 1.4, col); chancla(x, gl + gw + 6, Math.PI / 2, 1.4, col);
      rr(sd === 0 ? x - 34 : x, gl, 34, gw, 4, pal.acera, 3); for (var k = 1; k < 4; k++) line([[x + dir * (k * 8), gl + 4], [x + dir * (k * 8), gl + gw - 4]], 1.5, INK);
    }
    function miLado() { return (c.yo >= 0 && c.yo < n) ? side[c.yo] : -1; }
    function hVis(pp) {                         // altura visible del salto (el propio se ve al instante con saltoLocal)
      var h = altura(st.p[pp].jt);
      if (pp === c.yo && saltoLocal > 0) h = Math.max(h, altura(Math.max(1, Math.round(saltoLocal * TK))));
      return h;
    }
    function persona(pp, l) {
      var ps = posOf(pp), q = st.p[pp], s = asiento(pp), tc = sideColor(side[pp]), px = ps.x, py = ps.y, h = hVis(pp);
      var stun = q.stun > 0 || st.pause > 0, wob = stun && st.pause === 0 ? Math.sin(at * 30) * 2 : 0;
      var pana = c.yo >= 0 && pp !== c.yo && c.yo < n && side[pp] === side[c.yo], x = 0, y = -h;
      ctx.save(); ctx.translate(px, py); ctx.scale(l.e, l.e);                   // agranda desde los pies
      ell(0, 5, RP + 4 - h * 0.12, 9 - h * 0.08, tc, 3);                        // base del color del equipo (el cuerpo del personaje es de SU color, no del equipo)
      if (pana) { for (var a = 0; a < 6; a++) { var an = a * Math.PI / 3 + at * 1.5; line([[Math.cos(an) * (RP + 7), 5 + Math.sin(an) * 11], [Math.cos(an + 0.5) * (RP + 7), 5 + Math.sin(an + 0.5) * 11]], 2, '#fffdf2'); } }
      if (pp === c.yo && foot > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, foot * 5); ell(0, 4, RP + 6 + (0.22 - foot) * 150, 11 + (0.22 - foot) * 70, '#fffdf2', 0); ctx.restore(); }
      c.util.pj(s.ch, x + wob, y - 56, 46, { animo: (st.pause > READY && st.last - 1 === side[pp]) ? 'celebrar' : (st.pause > READY ? 'perder' : null), sombra: false });
      rr(x - 12 + wob, y - 22, 24, 9, 3, tc, 2.5);                              // banda de equipo sobre el pecho
      if (q.stun > 0) for (var e2 = 0; e2 < 3; e2++) ell(x + Math.cos(at * 8 + e2 * 2.1) * 14, y - 70 + Math.sin(at * 8 + e2 * 2.1) * 4, 3, 3, '#ffd23f', 0);   // estrellitas: tumbado
      if (pp === c.yo) poly([[x - 8, y - 92], [x + 8, y - 92], [x, y - 80]], '#ffd23f', 3);
      else if (pana) txt('PANA', x, y - 88, 11, '#fffdf2', 0, true);
      if (q.ch > PASSCH) { rr(x - 20, y - 76, 40, 8, 3, '#fffdf2', 2.5); rr(x - 19, y - 75, 38 * (q.ch - PASSCH) / (CHMAX - PASSCH), 6, 2, q.ch >= CHMAX ? '#ff5c5c' : '#ffd23f', 0); }
      ctx.restore();
    }
    /* eventos de la calle en 2D (coordenadas de CANCHA) */
    function evento2D() {
      if (st.evT < 0 || !st.evK) return;
      var k = st.evK, w = st.evT < EV_W[k], fl = 0.25 + 0.2 * Math.abs(Math.sin(at * 20)), x = st.evA, y = st.evB;
      if (w) {
        ctx.save(); ctx.globalAlpha = fl;
        if (k === MOTO || k === RASPA) rr(x - 26, 0, 52, FH, 0, EV_COL[k], 0);
        else if (k === CARRO) rr(0, y - 40, FW, 80, 0, '#ff3b4e', 0);
        else if (k === VENDE) rr(0, y - 24, FW, 48, 0, EV_COL[k], 0);
        else if (k === VECINA) ell(x, y, 46, 46, '#5cb8ff', 0);
        ctx.restore();
        if (k === PERRO) txt('¡GUAU!', cl(x, 40, FW - 40), y < 0 ? 14 : FH - 14, 18, '#ffb36b', 0, true);
        return;
      }
      if (k === PERRO) { ell(x, y, 16, 10, '#c9904f', 3); ell(x + 13, y - 6, 7, 7, '#c9904f', 3); ell(x - 15, y - 6, 3, 6, '#c9904f', 0); }
      else if (k === RASPA) { rr(x - 28, y - 22, 56, 44, 6, '#fffdf2', 3); rr(x - 28, y - 22, 56, 12, 4, '#ff5c8a', 2); txt('RASPAOS', x, y + 6, 10, INK, 0, false); }
      else if (k === VENDE) { rr(x - 38, y - 18, 76, 36, 6, '#fff1c2', 3); rr(x - 38, y - 18, 76, 10, 4, '#ff9e3b', 2); txt('COTUFAS', x, y + 9, 10, INK, 0, false); ell(x + (st.evC === 2 ? -44 : 44), y, 8, 8, '#a9795a', 2); }
      else if (k === MOTO) { rr(x - 8, y - 22, 16, 44, 6, '#2a2a34', 3); ell(x, y, 9, 9, '#ff5c5c', 2); }
      else if (k === CARRO) { rr(x - 50, y - 34, 100, 68, 12, '#e8553d', 4); rr(x - 24, y - 26, 48, 52, 8, '#bfe9ff', 2.5); }
      else if (k === VECINA) { ctx.save(); ctx.globalAlpha = 0.55; ell(x, y, 50, 50, '#5cb8ff', 0); ctx.restore(); }
    }
    function bola(x, y, z, rot, e) {
      var r = RB * e * (1 + z * 0.004), yy = y - z;
      ell(x, yy, r + 2, r + 2, '#fffdf2', 0);                                  // halo claro: la pelota se tiene que ver SIEMPRE, también detrás de un jugador
      ell(x, yy, r, r, '#ff6a4d', 3);
      line([[x - Math.cos(rot) * r * 0.8, yy - Math.sin(rot) * r * 0.8], [x + Math.cos(rot) * r * 0.8, yy + Math.sin(rot) * r * 0.8]], 2, '#fffdf2');
      ell(x - r / 3, yy - r / 3, r / 3.6, r / 3.6, '#ffd0c4', 0);
    }
    function dibujar2D() {                     // el dibujo 2D: respaldo sin WebGL o con ?plano=1
      var l = lay(), f = l.f, i2, b = st.b, ml = miLado();
      var sx = Math.sin(at * 90) * shake * 3, sy = Math.cos(at * 77) * shake * 3;
      ctx.save(); ctx.translate(sx, sy);
      fondo(l);
      ctx.save(); ctx.translate(l.cx, l.cy); ctx.scale(l.z, l.z); ctx.translate(-FW / 2, -FH / 2);
      cancha(); arco(0); arco(1);
      evento2D();
      var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy), rot = at * spd * 1.2, sh = 1 / (1 + b.z * 0.03);
      ell(b.x, b.y + 7, RB * l.e * sh, 4 * l.e * sh, INK, 0);
      var ord = []; for (i2 = 0; i2 < n; i2++) ord.push(i2);
      ord.sort(function (a, b2) { return posOf(a).y - posOf(b2).y || a - b2; });
      for (i2 = 0; i2 < ord.length; i2++) persona(ord[i2], l);
      bola(b.x, b.y, b.z, rot, l.e);                                            // la pelota va encima de todos
      for (i2 = 0; i2 < kickFx.length; i2++) { var kf = kickFx[i2]; ctx.save(); ctx.globalAlpha = 1 - kf.t / 0.35; ell(kf.x, kf.y, 10 + kf.t * 60, 10 + kf.t * 60, '#fffdf2', 0); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      var top = scr(l, 0, 0).y;
      if (ml >= 0) {                                                            // «TU ARCO»: letrero y flecha junto al arco propio (en pantalla, tamaño fijo)
        var ap = scr(l, ml === 0 ? 0 : FW, gl - 4), ax = ap.x + (ml === 0 ? 22 : -22);
        txt('TU ARCO', ax, ap.y - 16, 12, '#ffd23f', 0, true); poly([[ax - 6, ap.y - 8], [ax + 6, ap.y - 8], [ax, ap.y + 1]], '#ffd23f', 2.5);
      }
      var cx = l.cx;
      marcador(cx, 92);
      if (bannerT > 0 && banner) { var pz = 1 + Math.sin(at * 16) * 0.06; txt(banner.s, cx, l.cy - 18, Math.min(40, 0.1 * (f.x1 - f.x0) + 6) * pz, banner.col, 0, true); }
      if (c.ahora() >= -0.4 && c.ahora() < 2 && !c.practica) txt('¡A LA PELOTA!', cx, top - 18, 22, '#fffdf2', 0, true);
      ayuda(cx, scr(l, 0, FH).y + 26);
      if (typeof drawP === 'function') drawP();
    }
    function ayuda(cx, y) {                     // la regla en pantalla los primeros segundos (y siempre en la práctica)
      var t = c.ahora();
      if (t < -0.5 || (t > 7 && !c.practica)) return;
      txt('A: toque = pase · mantén = tiro · sin pelota y con un rival cerca = ¡DESLIZADA!   B: salto · B y A = ¡CHILENA!', cx, y, 13, '#fffdf2', 0, true);
    }

    function marcador(cx, y0) {               // marcador AZUL x – y ROJO, el reloj y la fase (igual en 2D y en 3D)
      var s0 = teamScore(0), s1 = teamScore(1), ym = y0 + 22, fz = fase(st.k);
      rr(cx - 70, y0, 140, 44, 12, '#14101c', 3); rr(cx - 66, y0 + 4, 6, 36, 3, sideColor(0), 0); rr(cx + 60, y0 + 4, 6, 36, 3, sideColor(1), 0);
      txt(String(s0), cx - 34, ym, 34, '#fffdf2', 0, true); txt('-', cx, ym, 28, '#ffd23f', 0, true); txt(String(s1), cx + 34, ym, 34, '#fffdf2', 0, true);
      if (st.gold || (st.k >= regT && s0 === s1)) txt('GOL DE ORO · ' + Math.max(0, Math.ceil((durT - st.k) / TK)) + ' s', cx, y0 + 54, 14, '#ffd23f', 0, true);
      else { var rest = Math.max(0, Math.ceil((regT - st.k) / TK)); txt(rest + ' s' + (fz === 2 ? ' · ¡GOL x2!' : ''), cx, y0 + 54, fz === 2 ? 14 : 12, fz === 2 ? '#ff5c8a' : '#fffdf2', 0, true); }
    }
    function finJ() { var s0 = teamScore(0), s1 = teamScore(1); return s0 >= GOLES_MAX || s1 >= GOLES_MAX || (st.k >= regT && s0 !== s1) || st.k >= durT; }
    function ganaLado() { var s0 = teamScore(0), s1 = teamScore(1); return s0 > s1 ? 0 : s1 > s0 ? 1 : -1; }

    /* ───── 3D low poly (fiesta-3d.js): la calle del barrio con arcos de piedra y chancla. Solo dibujo: lee st (y posOf); no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ESX = 1 / 18, ESZ = 1.2 / 18, BR = 0.5;                  // px de la cancha -> metros; radio de la pelota en 3D
    function WX(x) { return (x - FW / 2) * ESX; }
    function WZ(y) { return (y - FH / 2) * ESZ; }
    function fxr() { return typeof c.fx === 'function' ? c.fx() : 0.5; }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x8a8070, .55], sol: [0xfff2d8, .72], niebla: '#cfeeff', asfalto: '#6a6878', acera: '#d8d2c4', raya: '#f5f0dc', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', asfalto: '#5e5266', acera: '#cdb8a2', raya: '#f6dcb4', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', asfalto: '#4a4860', acera: '#77728e', raya: '#d8d4f0', noche: 1 }
    };
    var CASAS3 = ['#ffb36b', '#a9a0ff', '#ff9ec7', '#6ecf8f', '#ffd23f', '#7fd6c9', '#ff7a6a', '#8fd8ff'];
    var CONF3 = ['#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a', '#3fa9ff'];
    var ELENCO3 = ['abuela', 'portu', 'tio', 'prima', 'mama', 'cobrador', 'pana', 'tu'];
    function hsh(i) { var v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }   // ruido fijo para las texturas (no es azar de juego)
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, i2;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 55, 140], fov: 32 });
      if (!esc) return null;
      V3.pista('futbolito', { bpm: 138, acordes: [[52, 55, 59], [57, 60, 64], [54, 59, 63], [52, 55, 59]],      // gaita de furro callejera: i–iv–V–i en Mi menor
        mel: [76, 0, 79, 81, 83, 0, 81, 79, 81, 0, 84, 0, 81, 79, 76, 0, 78, 0, 81, 83, 0, 81, 78, 75, 76, 0, 79, 0, 76, 0, 0, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, gm = V3.toon('#fff').gradientMap;
      var x0 = WX(0), x1 = WX(FW), z0 = WZ(0), z1 = WZ(FH), zg0 = WZ(gl), zg1 = WZ(gl + gw);
      /* asfalto con grietas y piedritas */
      var asf = V3.texturaCanvas(256, 256, function (g2, w, h) {
        g2.fillStyle = pl.asfalto; g2.fillRect(0, 0, w, h);
        for (var j = 0; j < 700; j++) { g2.fillStyle = V3.oscurecer(pl.asfalto, .8 + hsh(j) * .45); g2.fillRect(hsh(j + 1000) * w, hsh(j + 2000) * h, 2, 2); }
        g2.strokeStyle = V3.oscurecer(pl.asfalto, .7); g2.lineWidth = 2; g2.beginPath(); g2.moveTo(30, 40); g2.lineTo(70, 64); g2.lineTo(96, 58); g2.lineTo(130, 90); g2.moveTo(180, 190); g2.lineTo(210, 170); g2.lineTo(240, 182); g2.stroke();
      }, [16, 10]);
      var piso = new T.Mesh(new T.PlaneGeometry(150, 90), new T.MeshToonMaterial({ map: asf, gradientMap: gm }));
      piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      /* rayas de tiza: bandas, medio campo, círculo y áreas */
      function raya(cx, cz, w, d) { var m = new T.Mesh(new T.PlaneGeometry(w, d), tn(pl.raya)); m.rotation.x = -Math.PI / 2; m.position.set(cx, .02, cz); m.receiveShadow = true; S3.add(m); }
      var RW = .13, ad = 26 * ESX;
      raya(0, z0, x1 - x0, RW); raya(0, z1, x1 - x0, RW); raya(0, 0, RW, z1 - z0);
      raya(x0, (z0 + zg0) / 2, RW, zg0 - z0); raya(x0, (zg1 + z1) / 2, RW, z1 - zg1); raya(x1, (z0 + zg0) / 2, RW, zg0 - z0); raya(x1, (zg1 + z1) / 2, RW, z1 - zg1);
      [x0, x1].forEach(function (xa) { var sg = xa < 0 ? 1 : -1; raya(xa + sg * ad / 2, zg0, ad, RW); raya(xa + sg * ad / 2, zg1, ad, RW); raya(xa + sg * ad, (zg0 + zg1) / 2, RW, zg1 - zg0); });
      var circ = new T.Mesh(new T.RingGeometry(40 * ESX - RW, 40 * ESX, 36), tn(pl.raya)); circ.rotation.x = -Math.PI / 2; circ.scale.set(1, ESZ / ESX, 1); circ.position.y = .02; S3.add(circ);
      var pto = new T.Mesh(new T.CircleGeometry(.22, 12), tn(pl.raya)); pto.rotation.x = -Math.PI / 2; pto.position.y = .021; S3.add(pto);
      /* los arcos improvisados: dos piedras con una chancla del color del equipo encima, y la boca pintada */
      var arcos = [];
      for (k = 0; k < 2; k++) {
        var ax = k === 0 ? x0 : x1, col = sideColor(k), ag = { chanclas: [], hop: 0, x: ax };
        var boca = new T.Mesh(new T.PlaneGeometry(1.6, zg1 - zg0), new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: .32, depthWrite: false }));
        boca.rotation.x = -Math.PI / 2; boca.position.set(ax + (k === 0 ? -.8 : .8), .025, (zg0 + zg1) / 2); S3.add(boca);
        [zg0, zg1].forEach(function (zp, j) {
          var pi = M(new T.DodecahedronGeometry(.55, 0), j ? '#8a8494' : '#9a9088', { g: .05 }); pi.position.set(ax, .4, zp); pi.scale.set(1, .75, 1); pi.rotation.y = j * 1.3 + k; S3.add(pi);
          var ch = new T.Group(); ch.position.set(ax, .82, zp); S3.add(ch);
          var suela = M(new T.CylinderGeometry(.26, .26, .09, 12), col, { g: .06 }); suela.scale.set(1, 1, 2.1); ch.add(suela);
          var tira = M(new T.TorusGeometry(.16, .035, 5, 10, Math.PI), '#fffdf2', { borde: false }); tira.rotation.y = Math.PI / 2; tira.position.set(0, .04, .12); ch.add(tira);
          ch.rotation.y = .4 + j * .5; ag.chanclas.push(ch);
        });
        arcos.push(ag);
      }
      /* aceras con brocal: atrás (casas) y adelante */
      var zA = z0 - 2.7, zB = z1 + 2.2;
      var ace = M(new T.BoxGeometry(150, .26, 4.2), pl.acera, { recibe: true, borde: false }); ace.position.set(0, .13, zA - 2.1); S3.add(ace);
      var bro = M(new T.BoxGeometry(150, .3, .25), '#fffdf2', { recibe: true, borde: false }); bro.position.set(0, .15, zA); S3.add(bro);
      var ace2 = M(new T.BoxGeometry(150, .26, 4), pl.acera, { recibe: true, borde: false }); ace2.position.set(0, .13, zB + 2); S3.add(ace2);
      var bro2 = M(new T.BoxGeometry(150, .3, .25), '#ffd23f', { recibe: true, borde: false }); bro2.position.set(0, .15, zB); S3.add(bro2);
      /* las casas del barrio: platabanda, rejas, tanque de agua; una es la bodega */
      var zC = zA - 4.2 - 2, ventanas = [];
      function ventana(g3, vx, vy, w, h) {
        var v = M(new T.BoxGeometry(w, h, .12), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); v.position.set(vx, vy, 2.02); g3.add(v); ventanas.push(v);
        for (var r = 0; r < 4; r++) { var re = M(new T.BoxGeometry(.05, h + .1, .05), '#2a2a34', { borde: false }); re.position.set(vx - w / 2 + (r + .5) * w / 4, vy, 2.1); g3.add(re); }
      }
      var ropas = [], xc = -44, nC = 0, bodX = 0;
      while (xc < 44) {
        var cw = 5.5 + hsh(nC + 7) * 3.5, ch2 = 4.2 + hsh(nC + 17) * 2.8, cc = CASAS3[nC % CASAS3.length], bod = nC === 6;
        var g3 = new T.Group(); g3.position.set(xc + cw / 2, 0, zC); S3.add(g3); if (bod) bodX = xc + cw / 2;
        var cu = M(new T.BoxGeometry(cw - .1, ch2, 4), bod ? '#fff1c2' : cc, { recibe: true, g: .015 }); cu.position.y = ch2 / 2; g3.add(cu);
        var zo = M(new T.BoxGeometry(cw - .05, .8, 4.05), V3.oscurecer(cc, .7), { borde: false, recibe: true }); zo.position.y = .4; g3.add(zo);
        var pb = M(new T.BoxGeometry(cw + .1, .25, 4.2), '#e8e0d0', { g: .02 }); pb.position.y = ch2 + .12; g3.add(pb);
        if (bod) {
          var tol = V3.texturaCanvas(128, 32, function (g2, w, h) { for (var j = 0; j < 8; j++) { g2.fillStyle = j % 2 ? '#fffdf2' : '#d93a3a'; g2.fillRect(j * w / 8, 0, w / 8, h); } });
          var toldo = new T.Mesh(new T.BoxGeometry(cw - .6, .08, 1.6), new T.MeshToonMaterial({ map: tol, gradientMap: gm })); toldo.position.set(0, 2.9, 2.75); toldo.rotation.x = .3; toldo.castShadow = true; g3.add(toldo);
          var let2 = V3.texturaCanvas(256, 64, function (g2, w, h) { g2.fillStyle = '#2f6fdb'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#ffd23f'; g2.font = 'bold 36px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('BODEGA EL PANA', w / 2, h / 2 + 2); });
          var cartel = new T.Mesh(new T.PlaneGeometry(cw - 1, (cw - 1) / 4), new T.MeshBasicMaterial({ map: let2 })); cartel.position.set(0, ch2 - .9, 2.04); g3.add(cartel);
          var pu = M(new T.BoxGeometry(2.2, 2.4, .12), '#2a2a34', { g: .03 }); pu.position.set(0, 1.2, 2.02); g3.add(pu);
          for (var cj = 0; cj < 3; cj++) { var caja = M(new T.BoxGeometry(.7, .5, .5), cj % 2 ? '#ffd23f' : '#4fd06a', { g: .04 }); caja.position.set(-cw / 2 + 1 + cj * .8, .25 + (cj === 1 ? .5 : 0), 2.5); if (cj === 1) caja.position.x -= .4; g3.add(caja); }
        } else {
          var pu2 = M(new T.BoxGeometry(1.1, 2.2, .12), '#7a4a2a', { g: .03 }); pu2.position.set(-cw / 2 + 1.2, 1.1, 2.02); g3.add(pu2);
          ventana(g3, .9, 1.9, 1.6, 1.2);
          if (ch2 > 5.6) ventana(g3, -.4, ch2 - 1.5, 1.4, 1);
        }
        if (nC % 3 === 1) {                                                       // tanque de agua en la platabanda
          var tq = M(new T.CylinderGeometry(.75, .75, 1.3, 10), '#2d4fa8', { g: .04 }); tq.position.set(cw / 2 - 1.2, ch2 + .9, -.6); g3.add(tq);
          var tp = M(new T.CylinderGeometry(.35, .35, .15, 10), '#2d4fa8', { g: .04 }); tp.position.set(cw / 2 - 1.2, ch2 + 1.6, -.6); g3.add(tp);
        }
        if (nC % 4 === 2) {                                                       // tendedero con ropa que ondea
          var cu2 = M(new T.BoxGeometry(cw - 1.2, .03, .03), '#14101c', { borde: false }); cu2.position.set(0, ch2 + 1.4, .6); g3.add(cu2);
          for (var rj = 0; rj < 4; rj++) { var ro = new T.Mesh(new T.PlaneGeometry(.7, .9), new T.MeshToonMaterial({ color: new T.Color(CONF3[(rj + nC) % CONF3.length]), side: T.DoubleSide, gradientMap: gm }));
            ro.geometry.translate(0, -.45, 0); ro.position.set(-cw / 2 + 1.2 + rj * (cw - 2.4) / 3, ch2 + 1.4, .6); ro.castShadow = true; g3.add(ro); ropas.push(ro); }
          var pa1 = M(new T.BoxGeometry(.08, 1.4, .08), '#2a2a34', { borde: false }); pa1.position.set(-cw / 2 + .6, ch2 + .7, .6); g3.add(pa1);
          var pa2 = pa1.clone(); pa2.position.x = cw / 2 - .6; g3.add(pa2);
        }
        xc += cw; nC++;
      }
      /* postes de luz con cables colgando y bombillo */
      var focos = [], postes = [-20, 0, 20];
      postes.forEach(function (px) {
        var po = M(new T.CylinderGeometry(.13, .18, 8, 7), '#8a8494', { g: .04 }); po.position.set(px, 4, zA - .7); S3.add(po);
        var br = M(new T.BoxGeometry(.1, .1, 1.8), '#8a8494', { borde: false }); br.position.set(px, 7.6, zA + .2); S3.add(br);
        var fo = new T.Mesh(new T.SphereGeometry(.28, 8, 6), tn('#fff2a0', { em: '#ffd36a', emI: pl.noche ? 1.8 : .15 })); fo.position.set(px, 7.4, zA + 1); S3.add(fo); focos.push(fo);
      });
      var cables = [];
      for (k = 0; k < postes.length - 1; k++) for (i2 = 0; i2 < 2; i2++) {
        var pts = [], j3, a0 = postes[k], a1 = postes[k + 1];
        for (j3 = 0; j3 <= 16; j3++) { var u = j3 / 16; pts.push(new T.Vector3(a0 + (a1 - a0) * u, 7.7 - i2 * .35 - Math.sin(u * Math.PI) * 1.1, zA - .7)); }
        var cab = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, .025, 4), tn('#14101c')); S3.add(cab); cables.push(cab);
      }
      if (pl.noche) {
        var l1 = new T.PointLight(0xffd890, 1.25, 26, 2); l1.position.set(-12, 7, z0 + 2); S3.add(l1);
        var l2 = new T.PointLight(0xffd890, 1.25, 26, 2); l2.position.set(12, 7, z0 + 2); S3.add(l2);
      }
      /* matas de mango en las esquinas */
      var hojas = [];
      [[-31, zA - 2.2], [31, zA - 2.4]].forEach(function (pm, j) {
        var tr = M(new T.CylinderGeometry(.35, .5, 3.4, 7), '#8a5a30', { g: .04 }); tr.position.set(pm[0], 1.7, pm[1]); S3.add(tr);
        for (var b2 = 0; b2 < 5; b2++) { var co = M(new T.IcosahedronGeometry(1.6 - b2 * .1, 0), b2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); co.position.set(pm[0] + Math.cos(b2 * 1.3 + j) * 1.3, 4.3 + (b2 % 2) * .8, pm[1] + Math.sin(b2 * 1.3) * .9); S3.add(co); hojas.push(co); }
        for (var m2 = 0; m2 < 4; m2++) { var mg = M(new T.SphereGeometry(.18, 6, 4), '#ffb030', { g: .08 }); mg.position.set(pm[0] - 1 + m2 * .7, 3.5 + (m2 % 2) * .4, pm[1] + 1.2); mg.scale.y = 1.3; S3.add(mg); }
      });
      /* una cava y una silla en la acera de adelante */
      var cava = M(new T.BoxGeometry(1.1, .7, .7), '#3f7fd0', { g: .05 }); cava.position.set(-24, .6, zB + 1.6); S3.add(cava);
      var tapa = M(new T.BoxGeometry(1.15, .14, .75), '#fffdf2', { g: .05 }); tapa.position.set(-24, 1, zB + 1.6); S3.add(tapa);
      /* el perro callejero que pasea por la acera */
      var perro = new T.Group(); S3.add(perro);
      var pcol = '#c9904f', pcu = M(new T.BoxGeometry(1, .45, .4), pcol, { g: .06 }); pcu.position.y = .65; perro.add(pcu);
      var pca = M(new T.BoxGeometry(.4, .4, .38), pcol, { g: .06 }); pca.position.set(.62, .95, 0); perro.add(pca);
      var pho = M(new T.BoxGeometry(.22, .16, .2), '#14101c', { borde: false }); pho.position.set(.88, .9, 0); perro.add(pho);
      var pco = M(new T.BoxGeometry(.4, .06, .06), pcol, { borde: false }); pco.position.set(-.65, .9, 0); pco.rotation.z = .6; perro.add(pco);
      var patas = [];
      [[.35, .14], [.35, -.14], [-.35, .14], [-.35, -.14]].forEach(function (pp) { var pt = M(new T.BoxGeometry(.12, .45, .12), pcol, { borde: false }); pt.geometry.translate(0, -.22, 0); pt.position.set(pp[0], .5, pp[1]); perro.add(pt); patas.push(pt); });
      perro.position.set(-10, .26, zA - 1.4);
      /* el público de la acera: personajes del barrio que no juegan */
      var usados = {}, pub = [];
      for (k = 0; k < n; k++) usados[asiento(k).ch || 'tu'] = 1;
      var libres = ELENCO3.filter(function (id) { return !usados[id]; });
      [[-8.5, zA - 1.6, 1], [bodX + 1.9, zA - 1.2, 0]].forEach(function (po2, j) {
        if (j >= libres.length) return;
        var pj2 = V3.PJ.crear(libres[j], { prop: false, escala: 1.25 }); S3.add(pj2.g);
        if (po2[2]) { var si = M(new T.BoxGeometry(.9, .5, .8), '#fffdf2', { g: .04 }); si.position.set(po2[0], .5, po2[1] - .1); S3.add(si); }
        pub.push({ pj: pj2, x: po2[0], z: po2[1], sentado: !!po2[2], fest: 0 });
      });
      /* los jugadores: camisa del color del equipo, aro en el piso */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }), tcol = sideColor(side[k]);
        pj.color(tcol); S3.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.7, .92, 22), new T.MeshBasicMaterial({ color: new T.Color(tcol), transparent: true, opacity: .85, depthWrite: false }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = .04; S3.add(aro);
        var p0 = posOf(k), xw = WX(p0.x), zw = WZ(p0.y);
        pjs.push({ pj: pj, aro: aro, x: xw, z: zw, px: xw, pz: zw, rumbo: side[k] === 0 ? Math.PI / 2 : -Math.PI / 2, lanzT: -9, polvo: 0, carga: 0 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      /* la pelota de goma: esfera + franja (para ver que rueda) + sombra redonda + aro claro que la delata detrás de un jugador */
      var bola3 = new T.Group(); S3.add(bola3);
      var bcu = M(new T.SphereGeometry(BR, 14, 10), '#ff6a4d', { g: .06 }); bola3.add(bcu);
      var bfr = new T.Mesh(new T.TorusGeometry(BR * 1.005, .06, 5, 18), tn('#fffdf2')); bola3.add(bfr);
      var bfr2 = new T.Mesh(new T.TorusGeometry(BR * 1.005, .05, 5, 18), tn('#ffd23f')); bfr2.rotation.y = Math.PI / 2; bola3.add(bfr2);
      var bsom = new T.Mesh(new T.CircleGeometry(BR * 1.1, 16), new T.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: .35, depthWrite: false })); bsom.rotation.x = -Math.PI / 2; bsom.position.y = .03; S3.add(bsom);
      var baro = new T.Mesh(new T.RingGeometry(BR * 1.3, BR * 1.55, 20), new T.MeshBasicMaterial({ color: 0xfffdf2, transparent: true, opacity: .55, depthWrite: false })); baro.rotation.x = -Math.PI / 2; baro.position.y = .035; S3.add(baro);
      /* props de los eventos de la calle (todos miran a +z; se giran hacia donde van) y las marcas de aviso en el piso */
      var evs3 = {};
      function grupo(id) { var g = new T.Group(); g.visible = false; S3.add(g); evs3[id] = g; return g; }
      var gP = grupo(PERRO), dcol = '#c9904f';                                  // el perro callejero
      var dcu = M(new T.BoxGeometry(.7, .6, 1.4), dcol, { g: .04 }); dcu.position.y = .85; gP.add(dcu);
      var dca = M(new T.BoxGeometry(.55, .55, .55), dcol, { g: .04 }); dca.position.set(0, 1.25, .85); gP.add(dca);
      var dho = M(new T.BoxGeometry(.25, .2, .25), '#14101c', { borde: false }); dho.position.set(0, 1.18, 1.18); gP.add(dho);
      [-.22, .22].forEach(function (ox) { var oj = M(new T.BoxGeometry(.14, .3, .14), '#7a4a2a', { borde: false }); oj.position.set(ox, 1.55, .75); gP.add(oj); });
      var dco = M(new T.BoxGeometry(.14, .14, .7), dcol, { borde: false }); dco.position.set(0, 1.15, -.95); dco.rotation.x = -.6; gP.add(dco); gP.userData.cola = dco;
      gP.userData.patas = [];
      [[-.25, .5], [.25, .5], [-.25, -.5], [.25, -.5]].forEach(function (pp2) { var pa = M(new T.BoxGeometry(.18, .6, .18), '#a8703a', { borde: false }); pa.geometry.translate(0, -.3, 0); pa.position.set(pp2[0], .6, pp2[1]); gP.add(pa); gP.userData.patas.push(pa); });
      var gR = grupo(RASPA);                                                    // el carrito del raspado
      var rc = M(new T.BoxGeometry(2.3, 1.1, 1.8), '#fffdf2', { g: .03 }); rc.position.y = 1.05; gR.add(rc);
      var rt = M(new T.BoxGeometry(2.5, .3, 2), '#ff5c8a', { g: .03 }); rt.position.y = 1.75; gR.add(rt);
      var rs = M(new T.ConeGeometry(.35, .6, 8), '#7fd6ff', { g: .05 }); rs.position.set(0, 2.1, 0); gR.add(rs);
      [-.8, .8].forEach(function (wx) { var rw = M(new T.CylinderGeometry(.4, .4, .2, 10), '#14101c', { g: .04 }); rw.rotation.z = Math.PI / 2; rw.position.set(wx * 1.1, .4, .6); gR.add(rw); });
      var gM = grupo(MOTO);                                                     // el motorizado
      var mc = M(new T.BoxGeometry(.5, .5, 1.7), '#2a2a34', { g: .04 }); mc.position.y = .75; gM.add(mc);
      var mp2 = M(new T.BoxGeometry(.55, .9, .5), '#ff5c5c', { g: .04 }); mp2.position.set(0, 1.4, -.1); gM.add(mp2);
      var mh = M(new T.SphereGeometry(.3, 8, 6), '#ffd23f', { g: .04 }); mh.position.set(0, 2.0, 0); gM.add(mh);
      [.7, -.7].forEach(function (wz) { var mw = M(new T.CylinderGeometry(.42, .42, .22, 12), '#14101c', { g: .04 }); mw.rotation.z = Math.PI / 2; mw.position.set(0, .42, wz); gM.add(mw); });
      var gC = grupo(CARRO), gCi = new T.Group(); gCi.rotation.y = -Math.PI / 2; gC.add(gCi);    // el carro (construido hacia +x y girado)
      var cb = M(new T.BoxGeometry(4, .9, 1.9), '#e8553d', { g: .03 }); cb.position.y = .75; gCi.add(cb);
      var cab2 = M(new T.BoxGeometry(2.2, .8, 1.7), '#e8553d', { g: .03 }); cab2.position.set(-.2, 1.6, 0); gCi.add(cab2);
      var vid = M(new T.BoxGeometry(2.25, .55, 1.75), '#bfe9ff', { borde: false }); vid.position.set(-.2, 1.62, 0); gCi.add(vid);
      [[1.3, .95], [1.3, -.95], [-1.3, .95], [-1.3, -.95]].forEach(function (r) { var ru = M(new T.CylinderGeometry(.38, .38, .3, 10), '#14101c', { g: .04 }); ru.rotation.x = Math.PI / 2; ru.position.set(r[0], .38, r[1]); gCi.add(ru); });
      [.55, -.55].forEach(function (zz) { var fa = new T.Mesh(new T.BoxGeometry(.1, .25, .4), tn('#fff6c0', { em: '#ffe14d', emI: 1.5 })); fa.position.set(2.02, .85, zz); gCi.add(fa); });
      var gV = grupo(VENDE);                                                    // el vendedor de cotufas con su carrito
      var vc = M(new T.BoxGeometry(4, 1.1, 1.5), '#fff1c2', { g: .03 }); vc.position.y = 1.0; gV.add(vc);
      var vt = M(new T.BoxGeometry(4.3, .2, 2.2), '#ff9e3b', { g: .03 }); vt.position.y = 2.6; gV.add(vt);
      [-1.9, 1.9].forEach(function (vx) { var vp = M(new T.BoxGeometry(.12, 1.5, .12), '#8a8494', { borde: false }); vp.position.set(vx, 1.85, .0); gV.add(vp); });
      var vcu = M(new T.SphereGeometry(.55, 8, 6), '#ffd23f', { g: .05 }); vcu.position.set(.8, 1.85, 0); gV.add(vcu);
      var vbo = M(new T.CylinderGeometry(.35, .4, 1.2, 8), '#6ecf8f', { g: .04 }); vbo.position.set(-1.4, 1.1, -1.3); gV.add(vbo);
      var vca = M(new T.SphereGeometry(.34, 8, 6), '#f2c7a0', { g: .04 }); vca.position.set(-1.4, 1.95, -1.3); gV.add(vca);
      [[-1.4, .6], [1.4, .6]].forEach(function (r) { var vw = M(new T.CylinderGeometry(.4, .4, .2, 10), '#14101c', { g: .04 }); vw.rotation.z = Math.PI / 2; vw.position.set(r[0], .4, r[1]); gV.add(vw); });
      var gW = grupo(VECINA);                                                   // el charco
      var chA = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x5cb8ff, transparent: true, opacity: .55, depthWrite: false })); chA.rotation.x = -Math.PI / 2; chA.position.y = .05; chA.scale.set(50 * ESX, 50 * ESZ, 1); gW.add(chA);
      var aviR = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false })); aviR.rotation.x = -Math.PI / 2; aviR.position.y = .03; aviR.visible = false; S3.add(aviR);
      var aviC = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x5cb8ff, transparent: true, opacity: 0, depthWrite: false })); aviC.rotation.x = -Math.PI / 2; aviC.position.y = .03; aviC.visible = false; S3.add(aviC);
      var part = V3.particulas(esc, 600);
      var cam = { x: 0 };
      esc.encuadrar(x1 - x0 + 4, z1 - z0 + 6, new T.Vector3(0, .8, 1.2), .8);
      return V3.ultimo = { esc: esc, pjs: pjs, flecha: flecha, bola: bola3, bcu: bcu, bsom: bsom, baro: baro, bx: 0, bz: 0, bh: 0, bvh: 0, bvx: 0, bvy: 0, ticT: 0,
        part: part, arcos: arcos, ropas: ropas, hojas: hojas, cables: cables, perro: perro, patas: patas, perroV: 2.2, pub: pub, evs: evs3, aviR: aviR, aviC: aviC, evx: 0, evz: 0, evh: 0,
        ondas: [], cam: cam, silbo: 0, finV: 0, choqueT: 0 };
    }
    function onda3D(x, z, col, r) {
      var T = THREE, on = new T.Mesh(new T.RingGeometry(.5, .7, 24), new T.MeshBasicMaterial({ color: new T.Color(col), transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }));
      on.rotation.x = -Math.PI / 2; on.position.set(x, .06, z); v3.esc.scene.add(on); v3.ondas.push({ m: on, t: at, r: r || 6 });
    }
    function quienPateo() {                                     // el más cercano a la pelota (solo para el gesto: la autoría real la lleva el juez)
      var j, bj = -1, bd = 1e9;
      for (j = 0; j < n; j++) { var ps = posOf(j), dx = ps.x - st.b.x, dy = ps.y - st.b.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bj = j; } }
      return bd < (RP + RB + KR + 30) * (RP + RB + KR + 30) ? bj : -1;
    }
    function pie3D(p) {                                         // A local: el gesto de patear sale al instante
      if (!v3 || !v3.pjs[p]) return;
      var s3 = v3.pjs[p]; if (at - s3.lanzT > .3) { s3.lanzT = at; s3.pj.uno('lanzar'); } V3.sfx('whoosh');
    }
    function patada3D(sp) {
      if (!v3) return;
      var j = quienPateo(), x = WX(st.b.x), z = WZ(st.b.y), fuerte = sp > 9;
      if (j >= 0) { var s3 = v3.pjs[j]; if (at - s3.lanzT > .3) { s3.lanzT = at; s3.pj.uno('lanzar'); } }
      V3.sfx(fuerte ? 'golpe' : 'pop');
      v3.part.soltar(x, .3, z, fuerte ? 14 : 6, { k: 'chispa', cols: fuerte ? ['#ffd23f', '#fffdf2', '#ff6a4d'] : ['#fffdf2', '#d8d2c4'], vel: fuerte ? 4 : 2.2, arriba: 2, vida: .45, esc: .8 });
      onda3D(x, z, fuerte ? '#ffd23f' : '#fffdf2', fuerte ? 8 : 5);
      if (fuerte) v3.esc.sacudir(.35);
    }
    function gol3D(sd) {                                        // sd = el lado que anotó: la pelota entró en el arco del otro
      if (!v3) return;
      var ag = v3.arcos[1 - sd], x = ag.x, zc = WZ(FH / 2), col = sideColor(sd), j;
      ag.hop = 1;
      v3.part.soltar(x, 1.2, zc, 70, { k: 'confeti', cols: [col, '#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a'], vel: 6, arriba: 7, g: 7, vida: 1.6 });
      v3.part.soltar(x, .5, zc, 18, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 5, arriba: 4, vida: .7 });
      onda3D(x, zc, col, 10);
      V3.sfx('aplauso'); v3.esc.sacudir(1);
      var a = st.lt[sd] > 0 ? st.lt[sd] - 1 : first[sd];
      if (a >= 0 && a < n && side[a] === sd) v3.pjs[a].pj.uno('festejo');
      for (j = 0; j < v3.pub.length; j++) v3.pub[j].fest = 2.6;
    }
    function evAviso3D(k) {                                     // aviso del evento (~1 s antes): sonido y susto
      if (!v3) return;
      V3.sfx(k === MOTO || k === CARRO ? 'bocina' : k === VECINA ? 'whoosh' : 'pop');
      if (k === MOTO || k === CARRO) for (var j = 0; j < n; j++) v3.pjs[j].pj.uno('saltar');
    }
    function evYa3D(k) {                                        // el evento arranca de verdad
      if (!v3) return;
      var x = WX(st.evA), z = WZ(st.evB);
      if (k === MOTO || k === CARRO) { V3.sfx('motor'); v3.esc.sacudir(.35); }
      else if (k === VECINA) { V3.sfx('choque'); v3.part.soltar(x, 1.5, z, 30, { k: 'chispa', cols: ['#5cb8ff', '#bfe9ff', '#fffdf2'], vel: 3, arriba: 4, g: 8, vida: .7 }); onda3D(x, z, '#5cb8ff', 9); }
      else if (k === PERRO) V3.sfx('pop');
      else V3.sfx('tic');
    }
    function salto3D(p) {                                       // B: salto al instante (también el local, antes que el snapshot)
      if (!v3 || !v3.pjs[p]) return;
      var s3 = v3.pjs[p]; s3.pj.uno('saltar'); V3.sfx('whoosh');
      v3.part.soltar(s3.x, .15, s3.z, 4, { k: 'chispa', cols: ['#d8d2c4', '#a09a90'], vel: 1.2, arriba: 1.2, vida: .3, esc: .6 });
    }
    function cabeza3D(p) { if (!v3 || !v3.pjs[p]) return; var s3 = v3.pjs[p]; V3.sfx('golpe'); v3.part.soltar(s3.x, 2.6, s3.z, 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 3, arriba: 2, vida: .4, esc: .7 }); }
    function chilena3D(p) { if (!v3 || !v3.pjs[p]) return; var s3 = v3.pjs[p]; V3.sfx('golpe'); v3.esc.sacudir(.5); s3.pj.uno('lanzar'); onda3D(WX(st.b.x), WZ(st.b.y), '#ff5c8a', 10); v3.part.soltar(WX(st.b.x), 1.5, WZ(st.b.y), 16, { k: 'chispa', cols: ['#ff5c8a', '#ffd23f', '#fffdf2'], vel: 5, arriba: 3, vida: .5, esc: .8 }); }
    function oro3D() {
      if (!v3) return;
      V3.sfx('tambor'); v3.esc.sacudir(.5);
      v3.part.soltar(0, 2, 0, 40, { k: 'confeti', cols: ['#ffd23f', '#ffb030', '#fffdf2'], vel: 5, arriba: 6, g: 6, vida: 1.4 });
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, t = at, k, j, pausa = st.pause > 0, gol = st.pause > READY, fin = finJ() && now > 0, gl3 = ganaLado();
      V.part.update(dt);
      /* lo que se mueve solo: ropa, hojas, cables, el perro, el público */
      for (k = 0; k < V.ropas.length; k++) V.ropas[k].rotation.x = Math.sin(t * 2.4 + k * .9) * .4;
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.z = Math.sin(t * 1.2 + k) * .05;
      for (k = 0; k < V.cables.length; k++) V.cables[k].position.y = Math.sin(t * 1.1 + k) * .05;
      var pe = V.perro; pe.position.x += V.perroV * dt;
      if (pe.position.x > 34) V.perroV = -Math.abs(V.perroV); else if (pe.position.x < -34) V.perroV = Math.abs(V.perroV);
      pe.rotation.y = V.perroV > 0 ? 0 : Math.PI;
      for (k = 0; k < V.patas.length; k++) V.patas[k].rotation.z = Math.sin(t * 10 + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI : 0)) * .5;
      for (k = 0; k < V.pub.length; k++) {
        var pu = V.pub[k]; pu.fest = Math.max(0, pu.fest - dt);
        if (pu.sentado) pu.pj.anim(pu.fest > 0 ? 'celebrar' : 'sentado').cara(pu.fest > 0 ? 'feliz' : 'normal');
        else pu.pj.anim(pu.fest > 0 ? 'celebrar' : 'quieto').cara(pu.fest > 0 || fin ? 'feliz' : 'normal');
        var bxw = WX(st.b.x); pu.pj.rumbo(pu.sentado && pu.fest <= 0 ? 0 : Math.atan2(bxw - pu.x, WZ(st.b.y) - pu.z) * .6).update(dt);
        pu.pj.g.position.set(pu.x, pu.sentado && pu.fest <= 0 ? .71 : .26, pu.z);
      }
      /* los arcos: las chanclas brincan con el gol */
      for (k = 0; k < 2; k++) { var ag = V.arcos[k]; ag.hop = Math.max(0, ag.hop - dt * 1.4);
        for (j = 0; j < ag.chanclas.length; j++) { var chh = ag.chanclas[j]; chh.position.y = .82 + Math.abs(Math.sin(ag.hop * 9 + j)) * ag.hop * 1.4; chh.rotation.z = Math.sin(ag.hop * 12 + j) * ag.hop; } }
      /* la pelota: rueda según lo que avanza, bota tras un tiro fuerte */
      var b = st.b, bx = WX(b.x), bz = WZ(b.y), ddx = bx - V.bx, ddz = bz - V.bz, dd = Math.sqrt(ddx * ddx + ddz * ddz);
      if (dd > 6) dd = 0;                                       // saque tras el gol: salta al centro sin rodar
      else if (dd > 1e-4) V.bcu.parent.rotateOnWorldAxis(new T.Vector3(ddz / dd, 0, -ddx / dd), dd / BR);
      V.bx = bx; V.bz = bz;
      V.bh = b.z * 0.04;                                        // altura real de la pelota (globitos, cabezazos, chilenas)
      V.bola.position.set(bx, BR + V.bh, bz);
      V.bsom.position.set(bx, .03, bz); var sh = 1 / (1 + V.bh * .4); V.bsom.scale.set(sh, sh, 1); V.bsom.material.opacity = .35 * sh;
      V.baro.position.set(bx, .035, bz); V.baro.material.opacity = .35 + .2 * Math.sin(t * 6);
      V.ticT -= dt;                                             // rebote en la banda o en el fondo
      if (V.ticT < 0 && !pausa && ((V.bvx * b.vx < 0 && (b.x < RB + 6 || b.x > FW - RB - 6)) || (V.bvy * b.vy < 0 && (b.y < RB + 6 || b.y > FH - RB - 6)))) {
        V.ticT = .15; V3.sfx('tic'); V.part.soltar(bx, .4, bz, 5, { k: 'chispa', cols: ['#fffdf2', pl3raya()], vel: 2, arriba: 1.5, vida: .35, esc: .7 });
      }
      V.bvx = b.vx; V.bvy = b.vy;
      /* los jugadores */
      var yo = c.yo >= 0 && c.yo < n ? c.yo : -1;
      V.choqueT -= dt;
      for (k = 0; k < n; k++) {
        var s3 = V.pjs[k], ps = posOf(k), q = st.p[k], pj = s3.pj;
        s3.x = WX(ps.x); s3.z = WZ(ps.y);
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3), vz = (s3.z - s3.pz) / Math.max(dt, 1e-3), v = Math.sqrt(vx * vx + vz * vz);
        if (v > 30) { v = 0; vx = 0; vz = 0; s3.vsx = 0; s3.vsz = 0; s3.mv = false; }      // saque: se teletransporta a su puesto
        s3.px = s3.x; s3.pz = s3.z;
        /* velocidad suavizada + histéresis: ni el rumbo ni la animación saltan por micro-movimientos de la interpolación o de la corrección de red */
        var al = 1 - Math.exp(-Math.min(dt, .1) * 9);
        s3.vsx = (s3.vsx || 0) + (vx - (s3.vsx || 0)) * al; s3.vsz = (s3.vsz || 0) + (vz - (s3.vsz || 0)) * al;
        v = Math.sqrt(s3.vsx * s3.vsx + s3.vsz * s3.vsz); vx = s3.vsx; vz = s3.vsz;
        s3.mv = s3.mv ? v > .8 : v > 1.6;
        var rt = s3.rumbo;
        if (s3.mv) rt = Math.atan2(vx, vz);
        else if (!gol && Math.abs(bx - s3.x) + Math.abs(bz - s3.z) > 1.2) rt = Math.atan2(bx - s3.x, bz - s3.z);
        if (s3.rs === undefined) s3.rs = rt;
        var da = rt - s3.rs; da = Math.atan2(Math.sin(da), Math.cos(da));
        s3.rs += da * (1 - Math.exp(-Math.min(dt, .1) * (s3.mv ? 10 : 6)));
        s3.rumbo = s3.rs;
        if (q.tk > 0 && !s3.ptk) { pj.uno('lanzar'); V3.sfx('choque'); V.part.soltar(s3.x, .2, s3.z, 5, { k: 'chispa', cols: ['#d8d2c4', '#fffdf2'], vel: 2, arriba: 1, vida: .4, esc: .7 }); }
        s3.ptk = q.tk > 0;
        if (q.stun > 0 && !s3.pst && st.evK !== MOTO && st.evK !== CARRO && st.evK !== VECINA) { pj.impacto(Math.sin(s3.rs), Math.cos(s3.rs), 1.6); V3.sfx('choque'); V.esc.sacudir(.3); }
        s3.pst = q.stun > 0;
        var empuja = false, emp = -1;
        for (j = 0; j < n; j++) if (j !== k && side[j] !== side[k]) { var pj2 = posOf(j), ex = pj2.x - ps.x, ey = pj2.y - ps.y; if (ex * ex + ey * ey < (RP * 2 + 3) * (RP * 2 + 3)) { empuja = true; emp = j; } }
        if (empuja && !pausa && v > 1 && V.choqueT < 0) {          // el rival que llega le da: el cuerpo cede desde su lado (a toda carrera, tumba)
          V.choqueT = .6; V3.sfx('choque');
          var aqx = s3.x - WX(posOf(emp).x), aqz = s3.z - WZ(posOf(emp).y), aqm = Math.sqrt(aqx * aqx + aqz * aqz) || 1;
          pj.impacto(aqx / aqm, aqz / aqm, .7 + 2 * Math.min(1, v / 9));
          V.part.soltar(s3.x, 1.6, s3.z, 4, { k: 'chispa', cols: ['#fffdf2', '#ffd23f'], vel: 2, arriba: 2, vida: .35, esc: .6 });
        }
        if (q.stun > 0 && !s3.atro && st.evT >= 0 && (st.evK === MOTO || st.evK === CARRO)) {   // atropellado por la moto o el carro: sale volando por el lado por donde pasó
          s3.atro = true; pj.volar(st.evK === MOTO ? (s3.x >= WX(st.evA) ? 1 : -1) : 0, st.evK === CARRO ? (s3.z >= WZ(st.evB) ? 1 : -1) : 0, 2.2, { alcance: .8 });
          V.esc.sacudir(.5);
        } else if (q.stun === 0) s3.atro = false;
        var vn = Math.min(1, v / 9), cargando = q.ch > PASSCH;
        if (fin) { var ga = gl3 < 0 ? false : side[k] === gl3; pj.anim(gl3 < 0 ? 'quieto' : ga ? 'celebrar' : 'triste').cara(gl3 < 0 ? 'mareado' : ga ? 'feliz' : 'triste'); }
        else if (gol) { var anoto = st.last - 1 === side[k]; pj.anim(anoto ? 'celebrar' : 'triste').cara(anoto ? 'feliz' : 'triste'); }
        else if (q.stun > 0) pj.anim('quieto').cara('mareado');
        else if (empuja && v > 1) pj.anim('empujar', { vel: vn }).cara('enojado');
        else pj.anim(q.tk > 0 ? 'correr' : s3.mv ? (v > 4.5 || (s3.cor && v > 3.5) ? (s3.cor = true, 'correr') : (s3.cor = false, 'caminar')) : (s3.cor = false, 'quieto'), { vel: vn }).cara(cargando ? 'concentrado' : 'normal');
        if (!fin && !gol && q.stun <= 0 && !s3.mv) pj.mirarA({ x: V.bx, y: .9, z: V.bz });      // mira la pelota
        pj.rumbo(s3.rumbo).update(dt);
        pj.g.position.set(s3.x, hVis(k) * 0.045, s3.z);
        s3.aro.position.set(s3.x, .04, s3.z); s3.aro.scale.setScalar(1 - Math.min(.35, hVis(k) / 100));
        var pana = yo >= 0 && k !== yo && side[k] === side[yo];
        s3.aro.material.opacity = pana ? .55 + .35 * Math.abs(Math.sin(t * 4)) : .85;
        s3.polvo -= dt;                                         // sprint (B): polvito en los pies; tiro cargado al tope: chispas
        if (q.run >= RUNT && v > 4 && s3.polvo < 0) { s3.polvo = .12; V.part.soltar(s3.x - vx * .03, .15, s3.z - vz * .03, 2, { k: 'chispa', cols: ['#d8d2c4', '#a09a90'], vel: 1, arriba: 1.2, vida: .35, esc: .6 }); }   // arrancando: polvito
        if (q.ch >= CHMAX && s3.polvo < 0) { s3.polvo = .12; V.part.soltar(s3.x, .3, s3.z, 2, { k: 'chispa', cols: ['#ffd23f', '#ff5c5c'], vel: 1.5, arriba: 2, vida: .3, esc: .6 }); }
      }
      V.flecha.visible = yo >= 0;
      if (yo >= 0) V.flecha.position.set(V.pjs[yo].x, 4.5 + Math.abs(Math.sin(t * 4)) * .3, V.pjs[yo].z);
      /* eventos de la calle: marca de aviso en el piso y el prop que cruza */
      var ek = st.evT >= 0 ? st.evK : 0, ew = ek > 0 && st.evT < EV_W[ek], ex3 = WX(st.evA), ez3 = WZ(st.evB), fa = .22 + .3 * Math.abs(Math.sin(t * 20));
      V.aviR.visible = false; V.aviC.visible = false;
      for (k = 1; k <= 6; k++) if (V.evs[k]) V.evs[k].visible = false;
      if (ek && ew) {
        if (ek === VECINA) { V.aviC.visible = true; V.aviC.position.set(ex3, .03, ez3); V.aviC.scale.set(46 * ESX, 46 * ESZ, 1); V.aviC.material.opacity = fa; }
        else if (ek !== PERRO) {
          V.aviR.visible = true; V.aviR.material.color.set(EV_COL[ek]); V.aviR.material.opacity = fa;
          if (ek === MOTO || ek === RASPA) { V.aviR.scale.set(52 * ESX, FH * ESZ, 1); V.aviR.position.set(ex3, .03, 0); }
          else { V.aviR.scale.set(FW * ESX * 1.2, (ek === CARRO ? 80 : 48) * ESZ, 1); V.aviR.position.set(0, .03, ez3); }
        }
      } else if (ek && V.evs[ek]) {
        var eg = V.evs[ek], edx = ex3 - V.evx, edz = ez3 - V.evz;
        eg.visible = true; eg.position.set(ex3, 0, ez3);
        if (ek === VECINA) { eg.position.y = 0; V.evs[VECINA].children[0].material.opacity = st.evT - EV_W[ek] < 10 ? .85 : .5; }
        else if (edx * edx + edz * edz > 1e-5 && edx * edx + edz * edz < 9) V.evh = Math.atan2(edx, edz);
        if (ek !== VECINA) eg.rotation.y = V.evh;
        if (ek === PERRO) { for (j = 0; j < eg.userData.patas.length; j++) eg.userData.patas[j].rotation.x = Math.sin(t * 22 + (j % 2 ? Math.PI : 0)) * .7; eg.userData.cola.rotation.z = Math.sin(t * 18) * .6; eg.position.y = Math.abs(Math.sin(t * 11)) * .12; }
        else if (ek === RASPA || ek === VENDE) eg.position.y = Math.abs(Math.sin(t * 7)) * .05;
        else if (ek === MOTO && fxr() < .5) V.part.soltar(ex3, .3, ez3 - Math.sign(edz) * 1.2, 1, { k: 'chispa', cols: ['#a09a90', '#d8d2c4'], vel: .8, arriba: 1, vida: .4, esc: .7 });
      }
      V.evx = ex3; V.evz = ez3;
      /* ondas de patada y de gol */
      for (k = V.ondas.length - 1; k >= 0; k--) { var on = V.ondas[k], ag2 = t - on.t; if (ag2 > .5) { V.esc.scene.remove(on.m); V.ondas.splice(k, 1); continue; } on.m.scale.setScalar(1 + ag2 * on.r); on.m.material.opacity = .8 * (1 - ag2 / .5); }
      /* cámara: toda la cancha, con un leve paneo hacia la pelota */
      V.cam.x += (bx * .12 - V.cam.x) * Math.min(1, dt * 2);
      V.esc.encuadrar(WX(FW) - WX(0) + 4, WZ(FH) - WZ(0) + 6, new T.Vector3(V.cam.x, .8, 1.2), .8);
      /* silbato de arranque y de final */
      if (now >= 0 && !V.silbo) { V.silbo = 1; V3.sfx('silbato'); }
      if (fin && !V.finV) { V.finV = 1; V3.sfx('silbato'); for (k = 0; k < n; k++) if (gl3 >= 0 && side[k] !== gl3) V.pjs[k].pj.uno('caer'); if (gl3 >= 0) { V3.sfx('aplauso'); V.part.soltar(0, 3, 0, 60, { k: 'confeti', cols: [sideColor(gl3), '#ffd23f', '#fffdf2'], vel: 7, arriba: 6, g: 6, vida: 1.8 }); }
        for (k = 0; k < V.pub.length; k++) V.pub[k].fest = 3; }
    }
    function pl3raya() { return PAL3[lv].raya; }
    function dibujar3D() {
      var dt = Math.max(0, Math.min(.05, v3T ? at - v3T : 1 / 60)), now = c.ahora(), k, l = lay(), f = l.f, cx = (f.x0 + f.x1) / 2, ml = miLado(); v3T = at;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !finJ()) V3.musica('futbolito');
      v3.esc.render(dt);
      for (k = 0; k < n; k++) {
        var s3 = v3.pjs[k], q = st.p[k], pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.1), pana = c.yo >= 0 && c.yo < n && k !== c.yo && side[k] === side[c.yo];
        txt(k === c.yo ? 'TÚ' : pana ? 'PANA' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : sideColor(side[k]) === COL_EQ[0] ? '#bcd4ff' : '#ffc4c4', 0, true);
        if (q.ch > PASSCH) {                                    // barra del tiro cargado sobre la cabeza
          var pb = v3.esc.proyectar(s3.x, 4.1, s3.z), fr = (q.ch - PASSCH) / (CHMAX - PASSCH);
          rr(pb.x - 20, pb.y - 4, 40, 8, 3, '#fffdf2', 2.5); rr(pb.x - 19, pb.y - 3, 38 * fr, 6, 2, q.ch >= CHMAX ? '#ff5c5c' : '#ffd23f', 0);
        }
      }
      if (ml >= 0) {                                            // «TU ARCO» sobre el propio y, al arrancar, a dónde patear
        var pa = v3.esc.proyectar(ml === 0 ? WX(0) : WX(FW), 2.4, WZ(FH / 2));
        txt('TU ARCO', pa.x, pa.y - 12, 12, '#ffd23f', 0, true); poly([[pa.x - 6, pa.y - 4], [pa.x + 6, pa.y - 4], [pa.x, pa.y + 5]], '#ffd23f', 2.5);
        if (now > -0.5 && now < 5 && !c.practica) { var pr = v3.esc.proyectar(ml === 0 ? WX(FW) : WX(0), 2.4, WZ(FH / 2)); txt(ml === 0 ? '¡GOL AQUÍ! →' : '← ¡GOL AQUÍ!', pr.x + (ml === 0 ? -30 : 30), pr.y - 12 + Math.sin(at * 8) * 3, 15, '#5cff7a', 0, true); }
      }
      marcador(cx, 74);
      if (st.evT >= 0 && st.evK > 0 && st.evT < EV_W[st.evK] && st.evK !== VECINA) { var pc = v3.esc.proyectar(WX(st.evA), 1.5, st.evK === MOTO || st.evK === RASPA || st.evK === PERRO ? WZ(FH / 2) : WZ(st.evB)); txt('¡!', cl(pc.x, f.x0 + 20, f.x1 - 20), pc.y, 26, EV_COL[st.evK], 0, true); }
      if (bannerT > 0 && banner) { var pz = 1 + Math.sin(at * 16) * 0.06; txt(banner.s, cx, 300, Math.min(40, 0.1 * (f.x1 - f.x0) + 6) * pz, banner.col, 0, true); }
      if (now >= -0.4 && now < 2 && !c.practica) txt('¡A LA PELOTA!', cx, 150, 22, '#fffdf2', 0, true);
    }
    function draw() {
      if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
      if (v3) return dibujar3D();
      dibujar2D();
    }

    function goleador() {
      var j, bj = -1, bv = 0;
      for (j = 0; j < n; j++) if (st.gs[j] > bv) { bv = st.gs[j]; bj = j; }
      return bj >= 0 ? asiento(bj).name : '';
    }
    return {
      update: update, draw: draw, ai: ai,
      step: step, pack: pack, unpack: load, restore: load, lerp: lerp, predict: predict,
      scores: function () { var a = [], i2; for (i2 = 0; i2 < n; i2++) a.push(st.gs[i2]); return a; },
      done: function () {
        var s0 = teamScore(0), s1 = teamScore(1);
        if (s0 >= GOLES_MAX || s1 >= GOLES_MAX) return true;
        return st.k >= regT && s0 !== s1;
      },
      vivo: function () { return true; },
      alCpu: function () {}, alHum: function () {},
      destacado: function () {
        var s0 = teamScore(0), s1 = teamScore(1);
        if (s0 + s1 === 0) return '0 – 0: ni la pelota se quiso mover';
        return '¡' + s0 + ' – ' + s1 + '! Goleador: ' + goleador();
      },
      vista: function () {
        var o = { k: st.k, regT: regT, sc: [teamScore(0), teamScore(1)], gs: st.gs.slice(0, n), pause: st.pause, evK: st.evK, evT: st.evT, evIdx: st.evIdx, evA: st.evA, evB: st.evB, evC: st.evC, evs: evs.slice(), gold: st.gold, side: side.slice(), gw: gw, gl: gl,
          lt: st.lt.slice(), age: st.age.slice(), equipos: teams.slice(), lag: lagEst < 0 ? -1 : lagEst * 0.5, ball: { x: st.b.x, y: st.b.y, vx: st.b.vx, vy: st.b.vy }, x: [], y: [], stun: [], ch: [], kcd: [], jt: [], ba: [], bb: [] }, i2;
        for (i2 = 0; i2 < n; i2++) { var q = st.p[i2]; o.x.push(q.x); o.y.push(q.y); o.stun.push(q.stun); o.ch.push(q.ch); o.kcd.push(q.kcd); o.jt.push(q.jt); o.ba.push(q.ba); o.bb.push(q.bb); }
        return o;
      }
    };
  }
});
})();
