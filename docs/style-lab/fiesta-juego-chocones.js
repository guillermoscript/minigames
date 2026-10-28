'use strict';
/* LA FIESTA · EN VIVO · f_chocones · ¡CARRITOS CHOCONES!  (2v2, modelo C: el juez simula los 4 carritos y los choques; los demás interpolan y predicen su propio carrito)
   Los carritos chocones de la feria (la de la Chinita, o la del pueblo): pista con baranda de goma, techo de rejilla que echa chispas, bombillos de colores y el señor
   de la taquilla con su micrófono. Vista desde arriba. Stick + A.
     Stick: dirigir. El carrito GIRA hacia donde apunta el stick (TURN por tick) y acelera solo hacia su frente, con inercia y derrape (agarre lateral GRIP).
     A: ¡ACELERÓN! 0,5 s de empuje fuerte (tope de velocidad más alto), enfriamiento 2 s; la carga se ve en el anillo del carrito.
   Puntos (para el asiento que pega; compara suma por equipo): tu FRENTE contra un carrito RIVAL, acercándose a más de HIT_V y con tu propia velocidad hacia él:
     · contra su COSTADO = ¡TOMA! 1 · contra su COLA (golpe por el tercio trasero: coseno < REAR_COS) = ¡POR DETRÁS! 2 · contra su frente = nada (choque de frente).
     · Si el rival está APAGADO (en un sector sin luz), +1 extra. Al que le pegan queda aturdido 0,5 s (gira sin control) e inmune 0,8 s (no se encadenan puntos contra él).
     · Chocar con tu pana rebota igual pero no da ni quita puntos. Solo puntúa quien va CON MOTOR (stick o acelerón en los últimos 0,2 s): el aturdido, el apagado,
       el ocioso que salió empujado y el carrito loco no puntúan nunca.
   Tiempo reglamentario = dur − 6 s (34 s con dur 40). Más puntos gana; empate ⇒ 6 s de ¡MUERTE SÚBITA! (el primer punto gana; si nadie pega, empate). minT 33 del catálogo.
   El giro venezolano: ¡SE VA LA LUZ! Cada 6-8 s (calendario sembrado en mk con 64 extracciones fijas: idéntico en todas las pantallas sin red) un SECTOR (un cuarto de la pista)
   titila 1,2 s y se queda sin corriente 2 s: los carritos que estén ahí no aceleran, no giran y no pueden dar acelerón; solo se deslizan (fricción menor).
   Niveles: 1 día, 1 sector · 2 atardecer, 4 conos de goma fijos (simétricos) y apagón cada 4,5-6 s · 3 noche, conos, DOS sectores a la vez y el CARRITO LOCO
   (sin conductor, línea recta a velocidad fija, rebota en todo; arranca en el centro en una diagonal sembrada; empuja pero no puntúa).
   Orientación fija: el equipo de menor índice (azul) sale a la IZQUIERDA mirando a la derecha; el otro (rojo) espejado. Pista lógica 600×340 igual para todos; el dibujo escala.
   Toda la regla vive en step() (solo el juez, 1/30 s). Estado entero: posiciones en 1/4 px, velocidades en 1/64 px/tick, rumbo en 1/1024 de vuelta.
   pack() = 39 enteros (7 globales + 8 por carrito, ≈190 B) y restore() sigue EXACTO tras migrar el juez.
   Tope de puntos: ningún asiento pasa de min(SC_MAX, SC_RATE·(t+1,5)) (el recorte del servidor para binary, party_mj.clampSc): el juego mismo no entrega puntos por encima.
   Pantallas que no son el juez: el carrito propio se PREDICE con el stick (misma física, reconciliado contra el del juez) y los demás se extrapolan el retraso de la vista.
   CPU: persigue al rival más cercano que le da la espalda o está apagado; huye del sector que titila; acelerón cuando está alineada (error según skill).
     Con pana humano ataca al rival que NO persigue su pana; con pana CPU, no se amontonan sobre el mismo.
   Gags: burbuja al apagón «¡Corpoelec, otra vez!»; el de la taquilla al final: «¡Se acabó la ficha, mi amor!».
   Dibujo solo con primitivas del laboratorio (rr/ell/line/poly/txt + c.util.pj). Sin Math.random/Date.now.
   Medido en docs/style-lab/pruebas/fiesta-chocones-bench.js (400 semillas por celda) y test/fiesta-juego-chocones.test.js: 4 CPU .6 ⇒ lados ±6 pp en los 3 niveles,
   empates ≤2 % (muerte súbita en ~12 %), ~13 puntos y ~11 golpes por partido (máx. 15 por asiento); .9+.9 vence a .3+.3 el 90-94 %; dos ociosos pierden siempre.
   Las perillas que separan la habilidad: HIT_V/ATK_V/ATK_COS (el roce casual no puntúa) y, en la CPU, reacción RT0/RT1, puntería ERR0, volante WOB y la defensa (dar la cara).
   LÍMITE CONOCIDO: como futbolito, el juez ve el mundo en vivo; aquí no se compensa más allá del fairDelayEq del runtime (falta medirlo en el arnés de red). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_chocones')) return;

var TK = 30, FW = 600, FH = 340, RC = 19, MAXP = 4, HD = 1024;
var ACC = 0.32, ACC_B = 0.95, FRIC = 0.95, FRIC_OFF = 0.975, GRIP = 0.78, VMAX = 7, VMAX_B = 12, TURN = 26, SPIN = 48;
var BOOST_T = 15, BOOST_CD = 60;                                 // 0,5 s de acelerón + 2 s de enfriamiento
var HIT_V = 2.6, ATK_COS = 0.75, ATK_V = 2.6, REAR_COS = -0.45, FRONT_COS = 0.5, KNOCK = 2;
var STUN = 15, IMM = 24, PW = 6, REST_C = 0.85, REST_W = 0.55;
var WARN = 36, OFF = 60, SD_S = 6;
var SC_MAX = 30, SC_RATE = 1.5;                                  // = limites.scoreMax / scoreRate
var RCONE = 13, CONES = [[300, 92], [300, 248], [185, 170], [415, 170]];
var RL = 20, LOCO_V = 3.2;
var RPAD = 22, PAD_ACC = 0.45, VMAX_P = 10, OIL_FR = 0.985, OIL_GRIP = 0.97;   // arena viva: tableros de turbo, manchas de aceite y baranda que se cierra
var LAG_MAX = 0.6;
var RT0 = 0.42, RT1 = 0.3, ERR0 = 48, DEF_D = 120, DEF_P = 1, WOB = 1.2, SALIDA = 60;                 // CPU: reacción (s), error de puntería (px), defensa (dar la cara)
var G = 7, PS = 8, PACKN = G + PS * MAXP;                        // [k, golpes, ev, lx, ly, lvx, lvy] + 8 por carrito = 39
var INK = '#14101c', COL_EQ = ['#2f6fdb', '#d93a3a'], NOM_EQ = ['AZUL', 'ROJO'];
var PAL = [   // día / atardecer / noche
  { cielo: '#8fd8ff', piso: '#8a8fa8', plancha: '#7a7f98', goma: '#2b2838', rueda: '#ffd23f', techo: '#c9ccd8', bombillos: ['#ff5c8a', '#ffd23f', '#4fd06a', '#5cb8ff'], carpa: ['#ff6a4d', '#fffdf2'], sol: '#ffe14d', noche: 0 },
  { cielo: '#ff8f5a', piso: '#857890', plancha: '#756a82', goma: '#2a2232', rueda: '#ffc23f', techo: '#d8c0b4', bombillos: ['#ff5c8a', '#ffd23f', '#4fd06a', '#5cb8ff'], carpa: ['#e8553d', '#ffe9c4'], sol: '#ffe9a0', noche: 0.25 },
  { cielo: '#1d1a4a', piso: '#4d4f68', plancha: '#43455e', goma: '#16131f', rueda: '#c9a83f', techo: '#6a6c88', bombillos: ['#ff3b8a', '#ffe14d', '#3fff8a', '#3fb0ff'], carpa: ['#a03a3a', '#c8c0b0'], sol: '#f4f0d0', noche: 1 }
];
var COS = [], SIN = [];
(function () { for (var i = 0; i < HD; i++) { COS.push(Math.cos(i * 2 * Math.PI / HD)); SIN.push(Math.sin(i * 2 * Math.PI / HD)); } })();
function q4(v) { return Math.round(v * 4) / 4; }
function q64(v) { return Math.round(v * 64) / 64; }
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function angOf(x, y) { return ((Math.round(Math.atan2(y, x) / (2 * Math.PI) * HD) % HD) + HD) % HD; }
function dAng(a, b) { return ((b - a + HD + HD / 2) % HD) - HD / 2; }          // de a hacia b, en [−512, 511]
function sectorOf(x, y) { return (y >= FH / 2 ? 2 : 0) + (x >= FW / 2 ? 1 : 0); }
var DISC = [0, 1, 2, 5, 6], POSIDX = [3, 4], HIDX = [];
(function () { var i, b; for (i = 0; i < MAXP; i++) { b = G + PS * i; POSIDX.push(b, b + 1); HIDX.push(b + 4); DISC.push(b + 2, b + 3, b + 4, b + 5, b + 6, b + 7); } })();

FIESTA.LIVE.add('f_chocones', {
  name: '¡CARRITOS CHOCONES!', modos: ['2v2'], clase: 'binary', modelo: 'C', dur: 40,
  stick: true, botones: 1, snapHz: 10, migra: true, minHumanos: 1,
  limites: { scoreMax: SC_MAX, scoreRate: SC_RATE, minT: 33, finTemprano: 1 },
  packN: PACKN, packDiscretos: DISC,
  carta: {
    obj: '¡Pégale con tu frente al carrito rival por el costado o por la cola! Por detrás vale doble.',
    gana: 'Más puntos gana (los dos del equipo). Al apagado le vale +1. Empate: muerte súbita, el primer punto gana.',
    como: { tactil: 'Joystick: dirigir · A: ¡acelerón!', teclado: 'WASD o flechas: dirigir · ESPACIO: ¡acelerón!' },
    roles: null,
    demos: [{
      id: 'chocones', txt: 'Apunta tu frente a la COLA del rival y dale A: ¡POR DETRÁS! vale 2',
      dibuja: function (cx, cy, k, t, teclado) {
        var u = (t * 0.7) % 1, ax = cx - 56 + Math.min(1, u * 1.6) * 52, hit = u > 0.58 && u < 0.8, bx = cx + 18 + (u > 0.6 ? (u - 0.6) * 60 : 0);
        rr(bx - 15, cy - 20, 30, 22, 7, '#d93a3a', 3); ell(bx - 14, cy - 13, 3, 3, '#ff3b4e', 0); ell(bx - 14, cy - 7, 3, 3, '#ff3b4e', 0);
        rr(ax - 15, cy - 20, 30, 22, 7, '#2f6fdb', 3); ell(ax + 13, cy - 13, 3, 3, '#fffdf2', 0); ell(ax + 13, cy - 7, 3, 3, '#fffdf2', 0);
        if (hit) txt('¡POR DETRÁS!', cx, cy - 34, 12, '#ffd23f', 0, true);
        if (teclado) { rr(cx - 40, cy + 14, 80, 24, 6, u > 0.3 && u < 0.5 ? '#ff8a3d' : '#f0ead8', 3); txt('ESPACIO', cx, cy + 27, 12, INK, 0, true); }
        else { ell(cx, cy + 28, 14, 14, u > 0.3 && u < 0.5 ? '#ff8a3d' : '#ffe14d', 3); txt('A', cx, cy + 29, 15, INK, 0, true); }
      }
    }, { id: 'mover', txt: 'Mira el techo: el sector que titila se queda SIN LUZ. ¡Sal de ahí o mete al rival!' }]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur > 0 ? c.dur : 40, durT = Math.max(3 * TK, Math.round(dur * TK)), pal = PAL[lv - 1], i, p;
    var sdT = Math.round(Math.min(SD_S, dur * 0.15) * TK), regT = durT - sdT;
    var teams = (c.equipos && c.equipos.length === n) ? c.equipos.slice() : [];
    if (!teams.length) for (i = 0; i < n; i++) teams.push(n === 4 ? (i < 2 ? 0 : 1) : i % 2);
    var tL = teams[0], tR = -1; for (i = 0; i < n; i++) if (teams[i] < tL) tL = teams[i];       // el equipo de menor índice (azul) sale a la izquierda
    for (i = 0; i < n; i++) if (teams[i] !== tL) { tR = teams[i]; break; }
    var side = [], idxIn = [], cnt = [0, 0], mate = [];
    for (i = 0; i < n; i++) { var sd0 = teams[i] === tL ? 0 : 1; side.push(sd0); idxIn.push(cnt[sd0]++); }
    for (i = 0; i < n; i++) { mate.push(-1); for (p = 0; p < n; p++) if (p !== i && side[p] === side[i]) { mate[i] = p; break; } }
    var cones = lv >= 2 ? CONES : [];
    /* ───── arena viva (todo función de k: no entra en pack; simétrica por giro de 180° ⇒ justa para los dos lados) ───── */
    var PADS = [[200, 250], [400, 90]];
    var OIL = [[300, 170, 34]]; if (lv >= 2) OIL.push([130, 60, 26], [470, 280, 26]); if (lv >= 3) OIL.push([130, 280, 26], [470, 60, 26]);
    var oilT = Math.round(regT * 0.38), shrT = Math.round(regT * 0.68), INS = 12 + 8 * lv;
    function insetAt(k) { return k < shrT ? 0 : INS * Math.min(1, (k - shrT) / (4 * TK)); }
    function onOil(x, y, k) { if (k < oilT) return false; for (var o = 0; o < OIL.length; o++) { var dx = x - OIL[o][0], dy = y - OIL[o][1]; if (dx * dx + dy * dy < OIL[o][2] * OIL[o][2]) return true; } return false; }
    function onPad(x, y) { for (var o = 0; o < PADS.length; o++) { var dx = x - PADS[o][0], dy = y - PADS[o][1]; if (dx * dx + dy * dy < RPAD * RPAD) return true; } return false; }

    /* ───── calendario del apagón (sembrado: SIEMPRE 64 extracciones, mismo consumo en los 3 niveles) ───── */
    var rng = c.rng, R = [];
    for (i = 0; i < 64; i++) R.push(rng.next());
    var per0 = lv === 2 ? 4.5 : 6, per1 = lv === 2 ? 6 : 8, apag = [], t = Math.round((3.5 + 1.5 * R[0]) * TK), ei = 0;
    while (t + WARN < durT && ei < 20) {                                        // R[1..20] sector · R[21..40] segundo sector (Nv3) · R[41..60] espera · R[61] el loco
      var s1 = Math.floor(R[1 + ei] * 4) % 4, secs = [s1];
      if (lv === 3) secs.push((s1 + 1 + Math.floor(R[21 + ei] * 3) % 3) % 4);
      apag.push({ t: t, s: secs });
      t += Math.round((per0 + (per1 - per0) * R[41 + ei]) * TK);
      ei++;
    }
    var lang = (1 + 2 * (Math.floor(R[61] * 4) % 4)) * HD / 8;                  // el carrito loco: una de las 4 diagonales
    /* fase del apagón por sector en el tick k: 0 normal · 1 titila (aviso) · 2 sin luz */
    function faseSec(k, s) {
      for (var j = 0; j < apag.length; j++) {
        var a = apag[j]; if (k < a.t) break;
        if (k < a.t + WARN + OFF && a.s.indexOf(s) >= 0) return k < a.t + WARN ? 1 : 2;
      }
      return 0;
    }
    function apagAt(k) { for (var j = 0; j < apag.length; j++) { var a = apag[j]; if (k < a.t) return { ph: 0, j: j, tTo: a.t - k, s: a.s }; if (k < a.t + WARN) return { ph: 1, j: j, s: a.s }; if (k < a.t + WARN + OFF) return { ph: 2, j: j, s: a.s, left: a.t + WARN + OFF - k }; } return { ph: 0, j: apag.length, tTo: 99999, s: [] }; }

    /* ───── estado autoritativo ───── */
    var st = { k: 0, golpes: 0, ev: 0, lo: { x: FW / 2, y: FH / 2, vx: lv >= 3 ? q64(COS[lang] * LOCO_V) : 0, vy: lv >= 3 ? q64(SIN[lang] * LOCO_V) : 0 }, p: [] };
    function spawnXY(pp) { var s = side[pp], m = cnt[s], j = idxIn[pp]; return { x: s === 0 ? 105 : FW - 105, y: m === 1 ? FH / 2 : (j === 0 ? 100 : FH - 100), h: s === 0 ? 0 : HD / 2 }; }
    for (p = 0; p < MAXP; p++) { var s0 = p < n ? spawnXY(p) : { x: FW / 2, y: -200, h: 0 }; st.p.push({ x: s0.x, y: s0.y, vx: 0, vy: 0, h: s0.h, stun: 0, imm: 0, bst: 0, cd: 0, pw: 0, sc: 0, hits: 0, rear: 0 }); }
    var cpr = []; for (p = 0; p < n; p++) { var rp = c.rngFor('cpu' + p); cpr.push({ t: 0, next: 0, tx: FW / 2, ty: FH / 2, tg: -1, mode: 0, ph: rp.next() * 2 * Math.PI, r: rp }); }
    var asiento = function (pp) { return (c.seats && c.seats[pp]) || { name: 'P' + (pp + 1), color: null, ch: null }; };
    function teamOfSide(sd) { return sd === 0 ? tL : tR; }
    function sideColor(sd) { var tt = teamOfSide(sd); return COL_EQ[tt === 1 ? 1 : 0]; }
    function sideName(sd) { var tt = teamOfSide(sd); return NOM_EQ[tt === 1 ? 1 : 0]; }
    function teamScore(sd) { var j, s = 0; for (j = 0; j < n; j++) if (side[j] === sd) s += st.p[j].sc; return s; }
    function capAt(k) { return Math.floor(Math.min(SC_MAX, SC_RATE * (k / TK + 1.5))); }
    function apagado(pp, k) { var q = st.p[pp]; return faseSec(k === undefined ? st.k : k, sectorOf(q.x, q.y)) === 2; }

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    /* golpe de A contra B con la normal n (de A hacia B): ¿cuántos puntos? 0 = no es golpe que valga */
    function puntos(A, B, nx, ny, a, b, k) {
      if (A.stun > 0 || A.pw === 0 || side[a] === side[b] || B.imm > 0) return 0;              // el que pega tiene que ir con motor (no empujado ni apagado)
      if (COS[A.h] * nx + SIN[A.h] * ny < ATK_COS) return 0;                                        // no pega con el frente
      if (A.vx * nx + A.vy * ny < ATK_V) return 0;                                                  // no va hacia él (lo están chocando a él)
      var cz = -(COS[B.h] * nx + SIN[B.h] * ny);                                                    // dónde le da: + frente del rival, − su cola
      if (cz > FRONT_COS) return 0;
      return (cz < REAR_COS ? 2 : 1) | (faseSec(k, sectorOf(B.x, B.y)) === 2 ? 4 : 0);          // código: 1 costado · 2 cola · +4 si está apagado
    }
    function anota(a, b, code, nx, ny) {
      var A = st.p[a], B = st.p[b], rear = (code & 3) === 2 ? 1 : 0, off = code & 4 ? 1 : 0, pts = (code & 3) + off, dar = Math.max(0, Math.min(pts, capAt(st.k) - A.sc));
      A.sc += dar; A.hits = Math.min(255, A.hits + 1); if (rear) A.rear = Math.min(255, A.rear + 1);
      B.stun = STUN; B.imm = IMM; B.bst = 0; B.vx += nx * KNOCK; B.vy += ny * KNOCK;
      st.golpes = (st.golpes + 1) % 1000;
      st.ev = (a + 1) | (b << 3) | (pts << 5) | (rear << 8) | (off << 9);
    }
    function step() {
      var P = st.p, k = st.k, oi, i2, j, q, e, ex, ey, len, ord = [], d, dx, dy;
      for (oi = 0; oi < n; oi++) ord.push((k & 1) ? n - 1 - oi : oi);              // orden alterno por tick: nadie gana siempre los empates
      /* 1) control: girar hacia el stick, acelerar solo, acelerón; aturdido gira sin control; apagado solo se desliza */
      for (oi = 0; oi < n; oi++) {
        i2 = ord[oi]; q = P[i2];
        var tapN = c.tap(i2, 'a');
        e = c.eje(i2) || { x: 0, y: 0 };
        ex = +e.x || 0; ey = +e.y || 0; len = Math.sqrt(ex * ex + ey * ey); if (len > 1) { ex /= len; ey /= len; len = 1; }
        if (q.imm > 0) q.imm--;
        if (q.cd > 0) q.cd--;
        var off = faseSec(k, sectorOf(q.x, q.y)) === 2, fr = FRIC, acc = 0, oil = onOil(q.x, q.y, k), pad = onPad(q.x, q.y);
        if (q.stun > 0) { q.stun--; q.h = (q.h + SPIN) % HD; q.bst = 0; }
        else if (off) { q.bst = 0; fr = FRIC_OFF; }
        else {
          if (len > 0.25) { var dd = dAng(q.h, angOf(ex, ey)); q.h = (q.h + cl(dd, -TURN, TURN) + HD) % HD; acc = ACC * Math.min(1, (len - 0.25) / 0.6); }
          if (tapN > 0 && q.cd === 0) { q.bst = BOOST_T; q.cd = BOOST_T + BOOST_CD; }
          if (q.bst > 0) { acc = ACC_B; q.bst--; }
          if (pad) acc += PAD_ACC;
          if (oil) fr = OIL_FR;
        }
        q.pw = acc > 0 ? PW : q.pw > 0 ? q.pw - 1 : 0;
        var hx = COS[q.h], hy = SIN[q.h], fw = q.vx * hx + q.vy * hy, la = -q.vx * hy + q.vy * hx;
        fw = (fw + acc) * fr; la *= q.stun > 0 || off ? 0.93 : oil ? OIL_GRIP : GRIP;
        q.vx = hx * fw - hy * la; q.vy = hy * fw + hx * la;
        var vm = q.bst > 0 ? VMAX_B : pad && q.stun === 0 && !off ? VMAX_P : VMAX, sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy);
        if (sp > VMAX_B) { q.vx *= VMAX_B / sp; q.vy *= VMAX_B / sp; }
        else if (sp > vm) { q.vx *= 0.92; q.vy *= 0.92; }                                       // tras el acelerón (o un rebote) baja de a poco
      }
      /* 2) integrar */
      for (j = 0; j < n; j++) { q = P[j]; q.x += q.vx; q.y += q.vy; }
      var L = st.lo; if (lv >= 3) { L.x += L.vx; L.y += L.vy; }
      /* 3) choques entre carritos: rebotan (goma) y, si vale, puntúa quien pegó con el frente */
      for (var pass = 0; pass < 2; pass++) for (oi = 0; oi < n; oi++) for (var oj = oi + 1; oj < n; oj++) {
        i2 = ord[oi]; j = ord[oj];
        var A = P[i2], B = P[j];
        dx = B.x - A.x; dy = B.y - A.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d >= RC * 2) continue;
        if (d < 0.01) { dx = (j - i2) || 1; dy = 0.5; d = Math.sqrt(dx * dx + dy * dy); }
        var nx = dx / d, ny = dy / d, push = (RC * 2 - d) / 2;
        A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
        if (pass > 0) continue;
        var rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        if (rel >= 0) continue;
        var pAB = -rel > HIT_V ? puntos(A, B, nx, ny, i2, j, k) : 0, pBA = -rel > HIT_V ? puntos(B, A, -nx, -ny, j, i2, k) : 0;
        var J = -(1 + REST_C) * rel / 2;
        A.vx -= J * nx; A.vy -= J * ny; B.vx += J * nx; B.vy += J * ny;
        if (pAB > 0) anota(i2, j, pAB, nx, ny);
        else if (pBA > 0) anota(j, i2, pBA, -nx, -ny);
      }
      /* 4) conos (Nv2+), carrito loco (Nv3), baranda */
      var ins = insetAt(k), bx0 = RC + ins, bx1 = FW - RC - ins, by0 = RC + ins, by1 = FH - RC - ins;
      for (oi = 0; oi < n; oi++) {
        j = ord[oi]; q = P[j];
        for (var ci = 0; ci < cones.length; ci++) {
          dx = q.x - cones[ci][0]; dy = q.y - cones[ci][1]; d = Math.sqrt(dx * dx + dy * dy);
          if (d < RC + RCONE) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } var cx0 = dx / d, cy0 = dy / d, vn = q.vx * cx0 + q.vy * cy0; q.x = cones[ci][0] + cx0 * (RC + RCONE); q.y = cones[ci][1] + cy0 * (RC + RCONE); if (vn < 0) { q.vx -= (1 + REST_W) * vn * cx0; q.vy -= (1 + REST_W) * vn * cy0; } }
        }
        if (lv >= 3) {
          dx = q.x - L.x; dy = q.y - L.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < RC + RL) {
            if (d < 0.01) { dx = 1; dy = 0; d = 1; }
            var lx = dx / d, ly = dy / d, rv = (q.vx - L.vx) * lx + (q.vy - L.vy) * ly;
            q.x = L.x + lx * (RC + RL); q.y = L.y + ly * (RC + RL);
            if (rv < 0) { q.vx -= (1 + 0.9) * rv * lx; q.vy -= (1 + 0.9) * rv * ly; }
            var lvn = L.vx * lx + L.vy * ly; if (lvn > 0) { L.vx -= 2 * lvn * lx; L.vy -= 2 * lvn * ly; }
          }
        }
        if (q.x < bx0) { q.x = bx0; if (q.vx < 0) q.vx = -q.vx * REST_W; } else if (q.x > bx1) { q.x = bx1; if (q.vx > 0) q.vx = -q.vx * REST_W; }
        if (q.y < by0) { q.y = by0; if (q.vy < 0) q.vy = -q.vy * REST_W; } else if (q.y > by1) { q.y = by1; if (q.vy > 0) q.vy = -q.vy * REST_W; }
      }
      if (lv >= 3) {
        for (var cj = 0; cj < cones.length; cj++) {
          dx = L.x - cones[cj][0]; dy = L.y - cones[cj][1]; d = Math.sqrt(dx * dx + dy * dy);
          if (d < RL + RCONE) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } var ux = dx / d, uy = dy / d, ln = L.vx * ux + L.vy * uy; L.x = cones[cj][0] + ux * (RL + RCONE); L.y = cones[cj][1] + uy * (RL + RCONE); if (ln < 0) { L.vx -= 2 * ln * ux; L.vy -= 2 * ln * uy; } }
        }
        if (L.x < RL + ins) { L.x = RL + ins; L.vx = Math.abs(L.vx); } else if (L.x > FW - RL - ins) { L.x = FW - RL - ins; L.vx = -Math.abs(L.vx); }
        if (L.y < RL + ins) { L.y = RL + ins; L.vy = Math.abs(L.vy); } else if (L.y > FH - RL - ins) { L.y = FH - RL - ins; L.vy = -Math.abs(L.vy); }
        var ls = Math.sqrt(L.vx * L.vx + L.vy * L.vy) || 1; L.vx = q64(L.vx / ls * LOCO_V); L.vy = q64(L.vy / ls * LOCO_V); L.x = q4(L.x); L.y = q4(L.y);
      }
      for (j = 0; j < n; j++) { q = P[j]; q.x = q4(q.x); q.y = q4(q.y); q.vx = q64(q.vx); q.vy = q64(q.vy); }
      st.k++;
    }

    /* ───────────────────────── snapshot ───────────────────────── */
    function pack() {
      var a = [st.k, st.golpes, st.ev, Math.round(st.lo.x * 4), Math.round(st.lo.y * 4), Math.round(st.lo.vx * 64), Math.round(st.lo.vy * 64)], j, q;
      for (j = 0; j < MAXP; j++) {
        q = st.p[j];
        a.push(Math.round(q.x * 4), Math.round(q.y * 4), Math.round(q.vx * 64), Math.round(q.vy * 64), q.h, q.stun | (q.imm << 5) | (q.bst << 10) | (q.cd << 15) | (q.pw << 22), q.sc, q.hits | (q.rear << 8));
      }
      return a;
    }
    function load(a) {
      if (!a || a.length < PACKN) return;
      var j, o, q;
      st.k = a[0] | 0; st.golpes = a[1] | 0; st.ev = a[2] | 0; st.lo.x = a[3] / 4; st.lo.y = a[4] / 4; st.lo.vx = a[5] / 64; st.lo.vy = a[6] / 64;
      for (j = 0; j < MAXP; j++) {
        o = G + PS * j; q = st.p[j];
        q.x = a[o] / 4; q.y = a[o + 1] / 4; q.vx = a[o + 2] / 64; q.vy = a[o + 3] / 64; q.h = ((a[o + 4] | 0) % HD + HD) % HD;
        q.stun = a[o + 5] & 31; q.imm = (a[o + 5] >> 5) & 31; q.bst = (a[o + 5] >> 10) & 31; q.cd = (a[o + 5] >> 15) & 127; q.pw = (a[o + 5] >> 22) & 7;
        q.sc = a[o + 6] | 0; q.hits = a[o + 7] & 255; q.rear = (a[o + 7] >> 8) & 255;
      }
    }
    function lerp(a, b, u) {
      var out = b.slice(), j, ix;
      for (j = 0; j < POSIDX.length; j++) { ix = POSIDX[j]; if (Math.abs(b[ix] - a[ix]) < 800) out[ix] = Math.round(a[ix] + (b[ix] - a[ix]) * u); }
      for (j = 0; j < HIDX.length; j++) { ix = HIDX[j]; var dh = dAng(a[ix], b[ix]); if (Math.abs(dh) < 300) out[ix] = ((Math.round(a[ix] + dh * u) % HD) + HD) % HD; }
      return out;
    }

    /* ───────────────────────── vista de los que no son el juez ───────────────────────── */
    /* Retraso de la vista: c.lag() si el runtime lo da; si no, se estima al llegar un snapshot nuevo (ahora − k/30, ≈ 2× el real: se usa la mitad), como en futbolito.
       Los demás carritos se adelantan ese retraso con su velocidad (aturdidos/apagados con fricción); el propio se predice con el stick. */
    var lastK = -1, lagEst = -1, mp = null;
    function isJudge() { return c.juez(); }
    function lagVista() {
      if (typeof c.lag === 'function') { var l0 = +c.lag(); if (l0 >= 0) return cl(l0, 0, LAG_MAX); }
      if (st.k !== lastK) {
        if (lastK >= 0 && st.k > lastK) { var smp = cl(c.ahora() - lastK / TK, 0, 2 * LAG_MAX); lagEst = lagEst < 0 ? smp : lagEst + (smp - lagEst) * 0.2; }
        lastK = st.k;
      }
      return lagEst < 0 ? 0 : lagEst * 0.5;
    }
    function adelanta(q, t) {
      var o = { x: q.x, y: q.y }, vx = q.vx, vy = q.vy, f = q.stun > 0 ? 0.93 : 1;
      t = Math.min(t, 10);
      while (t-- > 0) { o.x += vx; o.y += vy; vx *= f; vy *= f; }
      o.x = cl(o.x, RC, FW - RC); o.y = cl(o.y, RC, FH - RC);
      return o;
    }
    function predict(dt) {
      if (isJudge()) return;
      var t = Math.round(lagVista() * TK), j, q;
      if (t > 0) for (j = 0; j < n; j++) { if (j === c.yo) continue; q = st.p[j]; var o = adelanta(q, t); q.x = o.x; q.y = o.y; }
      if (c.yo < 0 || c.yo >= n) return;
      var a = st.p[c.yo];
      if (!mp) mp = { x: a.x, y: a.y, vx: a.vx, vy: a.vy, h: a.h };
      var f = Math.min(3, dt * TK);
      if (a.stun > 0 || faseSec(st.k + t, sectorOf(mp.x, mp.y)) === 2) {                  // aturdido o apagado: manda el juez (adelantado lo que va la vista)
        var ta = adelanta(a, t), u = Math.min(1, dt * 12);
        mp.x += (ta.x - mp.x) * u; mp.y += (ta.y - mp.y) * u; mp.vx = a.vx; mp.vy = a.vy; mp.h = a.h;
      } else {
        var e = c.eje(c.yo) || { x: 0, y: 0 }, ax = +e.x || 0, ay = +e.y || 0, len = Math.sqrt(ax * ax + ay * ay); if (len > 1) { ax /= len; ay /= len; len = 1; }
        var acc = 0, pOil = onOil(mp.x, mp.y, st.k + t), pPad = onPad(mp.x, mp.y);
        if (len > 0.25) { mp.h = (mp.h + Math.round(cl(dAng(mp.h, angOf(ax, ay)), -TURN * f, TURN * f)) + HD) % HD; acc = ACC * Math.min(1, (len - 0.25) / 0.6); }
        if (a.bst > 0 || boostFx > 0) acc = ACC_B;
        if (pPad) acc += PAD_ACC;
        var hx = COS[mp.h], hy = SIN[mp.h], fw = mp.vx * hx + mp.vy * hy, la = -mp.vx * hy + mp.vy * hx;
        fw = (fw + acc * f) * Math.pow(pOil ? OIL_FR : FRIC, f); la *= Math.pow(pOil ? OIL_GRIP : GRIP, f);
        mp.vx = hx * fw - hy * la; mp.vy = hy * fw + hx * la;
        var sp = Math.sqrt(mp.vx * mp.vx + mp.vy * mp.vy), vm = (a.bst > 0 || boostFx > 0) ? VMAX_B : pPad ? VMAX_P : VMAX; if (sp > vm) { mp.vx *= vm / sp; mp.vy *= vm / sp; }
        var pIn = insetAt(st.k + t);
        mp.x = cl(mp.x + mp.vx * f, RC + pIn, FW - RC - pIn); mp.y = cl(mp.y + mp.vy * f, RC + pIn, FH - RC - pIn);
      }
      var tgt = adelanta(a, t), dx = tgt.x - mp.x, dy = tgt.y - mp.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 70) { mp.x = tgt.x; mp.y = tgt.y; mp.vx = a.vx; mp.vy = a.vy; mp.h = a.h; }
      else if (d > 14) { var m = Math.min(4, d - 14) / d; mp.x += dx * m; mp.y += dy * m; }
      if (Math.abs(dAng(mp.h, a.h)) > 200) mp.h = a.h;
    }
    function posOf(pp) { if (pp === c.yo && !isJudge() && mp) return mp; return st.p[pp]; }

    /* ───────────────────────── presentación ───────────────────────── */
    var at = 0, banner = null, bannerT = 0, shake = 0, fx = [], prevGolpes = 0, prevAp = -1, prevSd = false, prevEv = 0, finDicho = false, boostFx = 0, prevA = false, bubT = 0, bub = null;
    function banr(s, col, t2) { banner = { s: s, col: col }; bannerT = t2 || 1.4; }
    function lay() {
      var f = c.campo();
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width, y0: f.y0, y1: f.y1 };
      var vw = f.x1 - f.x0, z = cl(vw / (FW + 60), 0.45, 1.2), e2 = z < 1 ? Math.min(1.3, Math.pow(z, -0.35)) : 1;
      return { f: f, z: z, e: e2, cx: (f.x0 + f.x1) / 2, cy: z < 0.8 ? 318 : 332 };
    }
    function scr(l, x, y) { return { x: l.cx + (x - FW / 2) * l.z, y: l.cy + (y - FH / 2) * l.z }; }
    function update(dt) {
      at += dt; bannerT = Math.max(0, bannerT - dt); shake = Math.max(0, shake - dt * 3); boostFx = Math.max(0, boostFx - dt); bubT = Math.max(0, bubT - dt);
      var L = lay(), j, ap = apagAt(st.k);
      if (isJudge()) mp = null;
      if (c.yo >= 0 && c.yo < n) {                                                // anillo del acelerón al instante (la respuesta del juez llega después)
        var ha = !!c.held(c.yo, 'a'), q0 = st.p[c.yo];
        if (ha && !prevA && q0.cd === 0 && q0.stun === 0 && boostFx <= 0) { boostFx = BOOST_T / TK; if (!v3) SND(220, 0.25, 'sawtooth', 0.05, 260); }      // en 3D el motor suena al arrancar el acelerón (actualizar3D)
        prevA = ha;
      }
      var apId = ap.ph > 0 ? ap.j * 4 + ap.ph : -1;
      if (apId !== prevAp) {
        if (ap.ph === 1) { banr('¡SE VA LA LUZ!', '#ffd23f', 1.2); if (v3) { V3.sfx('tic'); V3.sfx('chispa'); } else { SND(880, 0.08, 'square', 0.04, 0); SND(660, 0.1, 'square', 0.04, 0); } }
        else if (ap.ph === 2) { if (v3) apagon3D(ap.s); else SND(120, 0.4, 'sawtooth', 0.06, -60); bub = { s: '¡Corpoelec, otra vez!' }; bubT = 1.8; }
        prevAp = apId;
      }
      if (st.golpes !== prevGolpes) {
        var ev = st.ev, a = (ev & 7) - 1, b = (ev >> 3) & 3, pts = (ev >> 5) & 7, rear = (ev >> 8) & 1, off = (ev >> 9) & 1;
        if (a >= 0 && a < n && b < n) {
          var vb = posOf(b), sp0 = v3 ? sobre(b, 3.4) : scr(L, vb.x, vb.y);
          fx.push({ x: vb.x, y: vb.y, t: 0, s: (rear ? '¡POR DETRÁS!' : '¡TOMA!') + ' +' + pts, col: sideColor(side[a]) });
          if (off) fx.push({ x: vb.x, y: vb.y + 26, t: -0.15, s: '¡APAGADO!', col: '#ffd23f' });
          if (v3) golpe3D(a, b, pts, rear, off);
          else { SPAWN(sp0.x, sp0.y, rear ? 14 : 8, 'bit', ['#ffd23f', '#fffdf2', '#5cb8ff'], 260, 260, 0.5); SND(rear ? 140 : 190, 0.16, 'square', 0.09, -60); }
          shake = Math.max(shake, rear ? 0.9 : 0.5);
          if (a === c.yo && rear) S('¡Por detrás, como en la cola del banco!', sp0.x, sp0.y - 40, '#fffdf2');
        }
        prevGolpes = st.golpes;
      }
      var evNow = st.k >= shrT ? 2 : st.k >= oilT ? 1 : 0;
      if (evNow !== prevEv) {
        if (evNow > prevEv) { banr(evNow === 2 ? '¡SE ACHICA LA PISTA!' : '¡PISTA ENCERADA!', evNow === 2 ? '#ff8a1f' : '#9a7cff', 1.8); shake = Math.max(shake, 0.6); if (v3) { V3.sfx('silbato'); v3.esc.sacudir(.5); } else SND(evNow === 2 ? 150 : 520, 0.3, 'square', 0.06, -80); }
        prevEv = evNow;
      }
      var s0 = teamScore(0), s1 = teamScore(1), sdNow = st.k >= regT && s0 === s1;
      if (sdNow && !prevSd) { banr('¡MUERTE SÚBITA!', '#ff5c5c', 2.2); if (v3) { V3.sfx('silbato'); v3.esc.sacudir(.5); } else SND(330, 0.4, 'square', 0.07, -120); }
      prevSd = sdNow;
      if (!finDicho && (st.k >= durT - 1 || (st.k >= regT && s0 !== s1))) { finDicho = true; var tq = v3 ? taquilla3D() : taquilla(L); if (v3) fin3D(s0, s1); S('¡Se acabó la ficha, mi amor!', tq.x + 40, tq.y - 30, '#fffdf2'); banr(s0 === s1 ? '¡EMPATE!' : '¡GANÓ EL EQUIPO ' + sideName(s0 > s1 ? 0 : 1) + '!', s0 === s1 ? '#ffd23f' : sideColor(s0 > s1 ? 0 : 1), 3); }
      for (j = fx.length - 1; j >= 0; j--) { fx[j].t += dt; if (fx[j].t > 0.9) fx.splice(j, 1); }
    }

    /* ───────────────────────── CPU ───────────────────────── */
    // Decide cada 0,30 − 0,18·skill s (+ hasta 60 ms). Conoce el calendario del apagón (sale de la semilla).
    // Si su sector titila o está sin luz pronto, huye al cuarto más cercano con luz (la buena casi siempre, la mala a veces). Si no, elige rival:
    // el más cercano, rebajado si le da la espalda o está apagado, castigado si está inmune; con pana humano evita al rival que persigue su pana,
    // con pana CPU no repite su objetivo. Apunta detrás del rival (lo rodea si le está viendo la cara) y da acelerón cuando está alineada y cerca.
    function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
    function persigueDe(pp) {                                                    // a qué rival apunta (adivinado por su rumbo) un humano
      var q = st.p[pp], best = -1, bv = 0.5, j;
      for (j = 0; j < n; j++) {
        if (side[j] === side[pp]) continue;
        var o = st.p[j], d = dist(o.x, o.y, q.x, q.y) || 1, cs = (COS[q.h] * (o.x - q.x) + SIN[q.h] * (o.y - q.y)) / d - d / 2000;
        if (cs > bv) { bv = cs; best = j; }
      }
      return best;
    }
    function peligro(k, x, y) { var s = sectorOf(x, y), j; for (j = 0; j < 14; j += 7) if (faseSec(k + j, s) > 0) return true; return faseSec(k + 20, s) > 0; }
    function ai(pp, dt, api) {
      var S0 = cpr[pp], q = st.p[pp], me = posOf(pp), sk = (c.skill && typeof c.skill[pp] === 'number') ? c.skill[pp] : 0.6, j, k = st.k;
      S0.t += dt;
      api.hold('a', false);
      if (q.stun > 0) { api.eje(0, 0); return; }
      if (S0.t >= S0.next) {
        S0.next = S0.t + (RT0 - RT1 * sk) + S0.r.next() * 0.06;
        var mt = mate[pp], humano = mt >= 0 && !(c.cpu && c.cpu[mt]), evita = humano ? persigueDe(mt) : (mt >= 0 && cpr[mt] ? cpr[mt].tg : -1);
        var amen = -1, ad = 1e9;                                                   // ¿alguien me viene encima por un lado o por la cola?
        for (j = 0; j < n; j++) {
          if (side[j] === side[pp]) continue;
          var oa = st.p[j], da = dist(oa.x, oa.y, me.x, me.y) || 1, vien = (COS[oa.h] * (me.x - oa.x) + SIN[oa.h] * (me.y - oa.y)) / da, mio = (COS[q.h] * (oa.x - me.x) + SIN[q.h] * (oa.y - me.y)) / da;
          if (da < DEF_D && vien > 0.75 && mio < 0.3 && oa.stun === 0 && q.imm < 4 && da < ad) { ad = da; amen = j; }
        }
        if (amen >= 0 && S0.r.next() < DEF_P * sk * sk) {                          // le doy la cara: de frente no vale
          S0.tx = st.p[amen].x; S0.ty = st.p[amen].y; S0.mode = 3; S0.tg = amen;
        } else if (peligro(k, me.x, me.y) && S0.r.next() < 0.3 + 0.65 * sk) {           // ¡se va la luz aquí!: sale por el borde más cercano hacia un cuarto con luz
          var bx = -1, by = -1, bd = 1e9, s, ms = sectorOf(me.x, me.y), sal = SALIDA * (0.5 + 0.5 * sk);
          for (s = 0; s < 4; s++) {
            if (s === ms || faseSec(k + 20, s) > 0 || faseSec(k, s) > 0) continue;
            var qx = (s & 1) === (ms & 1) ? me.x : FW / 2 + ((s & 1) ? sal : -sal), qy = (s & 2) === (ms & 2) ? me.y : FH / 2 + ((s & 2) ? sal : -sal);
            var dq = dist(qx, qy, me.x, me.y); if (dq < bd) { bd = dq; bx = qx; by = qy; }
          }
          if (bx >= 0) { S0.tx = cl(bx, RC + 10, FW - RC - 10); S0.ty = cl(by, RC + 10, FH - RC - 10); S0.mode = 2; S0.tg = -1; }
        } else {
          var tg = -1, best = 1e9;
          for (j = 0; j < n; j++) {
            if (side[j] === side[pp]) continue;
            var o = st.p[j], dj = dist(o.x, o.y, me.x, me.y) || 1;
            var espalda = (COS[o.h] * (me.x - o.x) + SIN[o.h] * (me.y - o.y)) / dj;            // −1 = estoy justo detrás de él
            var sc = dj + espalda * 70 * sk - (apagado(j) ? 130 * sk : 0) + (faseSec(k + 20, sectorOf(o.x, o.y)) === 1 ? 120 * sk : 0) + (o.imm > 6 ? 160 * sk : 0) + (j === evita ? (humano ? 150 : 50) : 0) + (S0.tg === j ? -25 : 0);
            if (sc < best) { best = sc; tg = j; }
          }
          S0.tg = tg; S0.mode = 1;
          if (tg >= 0) {
            var o2 = st.p[tg], d2 = dist(o2.x, o2.y, me.x, me.y) || 1, lead = Math.min(14, d2 / 6) * (0.4 + 0.6 * sk);
            var px = o2.x + o2.vx * lead, py = o2.y + o2.vy * lead, hx = COS[o2.h], hy = SIN[o2.h];
            var esp2 = (hx * (me.x - o2.x) + hy * (me.y - o2.y)) / d2, err = (S0.r.next() * 2 - 1) * (ERR0 - (ERR0 - 4) * sk);
            if (esp2 > 0.25 && sk > 0.2) { var sg = (-hy * (me.x - o2.x) + hx * (me.y - o2.y)) >= 0 ? 1 : -1; px = px - hx * 40 + (-hy) * sg * 62; py = py - hy * 40 + hx * sg * 62; }   // le estoy viendo la cara: lo rodeo
            else { px -= hx * 12 * sk; py -= hy * 12 * sk; }
            S0.tx = cl(px + err * (-(py - me.y) / d2), RC, FW - RC); S0.ty = cl(py + err * ((px - me.x) / d2), RC, FH - RC);
          }
        }
      }
      var dx = S0.tx - me.x, dy = S0.ty - me.y, d = Math.sqrt(dx * dx + dy * dy);
      var wob = Math.sin(S0.t * 2.7 + S0.ph) * WOB * (1 - sk), cw = Math.cos(wob), sw = Math.sin(wob);   // la mala no lleva el volante firme
      if (d > 6) api.eje((dx * cw - dy * sw) / d, (dx * sw + dy * cw) / d); else api.eje(0, 0);
      if (q.cd === 0 && q.bst === 0) {
        var press = false;
        if (S0.mode === 1 && S0.tg >= 0) {
          var t2 = st.p[S0.tg], td = dist(t2.x, t2.y, me.x, me.y) || 1, al = (COS[q.h] * (t2.x - me.x) + SIN[q.h] * (t2.y - me.y)) / td;
          var esp3 = (COS[t2.h] * (me.x - t2.x) + SIN[t2.h] * (me.y - t2.y)) / td;
          if (al > 0.97 - 0.2 * (1 - sk) && td < 70 + 110 * sk && t2.imm < 4 && esp3 < 0.6) press = S0.r.next() < 0.12 + 0.4 * sk;
        } else if (S0.mode === 2 && d > 30 && sk > 0.5) press = (COS[q.h] * dx + SIN[q.h] * dy) / (d || 1) > 0.8 && S0.r.next() < 0.3 * sk;   // la buena sale del apagón a todo dar
        if (!press && S0.r.next() < 0.012 * (1 - sk)) press = true;                                  // la mala lo gasta a lo loco
        if (press) api.press('a');
      }
    }

    /* ───────────────────────── dibujo ───────────────────────── */
    function taquilla(l) { var f = l.f; return { x: f.x0 + 64, y: Math.max(120, scr(l, 0, 0).y - 46) }; }
    function fondo(l) {                                                                   // en coordenadas de PANTALLA
      var f = l.f, w = f.x1 - f.x0, k, top = scr(l, 0, 0).y;
      rr(f.x0, 0, w, 600, 0, pal.cielo, 0);
      if (lv === 3) for (k = 0; k < 16; k++) ell(f.x0 + ((k * 137) % w), 14 + (k * 29) % 70, 2, 2, '#fffdf2', 0);
      else ell(lv === 1 ? f.x1 - 80 : f.x0 + 120, lv === 1 ? 50 : 96, 26, 26, pal.sol, 0);
      /* la rueda de la fortuna */
      var rx = f.x1 - 110, ry = top - 70, rad = 62, ang = at * 0.25;
      line([[rx - 40, top - 6], [rx, ry], [rx + 40, top - 6]], 5, INK);
      aro(rx, ry, rad, rad, 4, INK);
      for (k = 0; k < 8; k++) { var a8 = ang + k * Math.PI / 4, kx = rx + Math.cos(a8) * rad, ky = ry + Math.sin(a8) * rad; line([[rx, ry], [kx, ky]], 2, INK); rr(kx - 8, ky - 2, 16, 12, 3, pal.bombillos[k % 4], 2.5); }
      ell(rx, ry, 6, 6, pal.rueda, 2.5);
      /* carpa de los chocones con sus bombillos */
      rr(f.x0, top - 34, w, 24, 0, pal.carpa[0], 0);
      for (k = 0; k < Math.ceil(w / 40) + 1; k++) { rr(f.x0 + k * 40, top - 34, 20, 24, 0, pal.carpa[1], 0); poly([[f.x0 + k * 40, top - 10], [f.x0 + k * 40 + 20, top - 10], [f.x0 + k * 40 + 10, top]], pal.carpa[k % 2], 2); }
      line([[f.x0, top - 34], [f.x1, top - 34]], 3, INK);
      for (k = 0; k < Math.ceil(w / 26); k++) { var on = lv === 3 || ((k + Math.floor(at * 4)) % 3 !== 0); ell(f.x0 + 13 + k * 26, top - 40 + Math.sin(k * 0.9) * 3, 4, 4, on ? pal.bombillos[k % 4] : '#5a5a6a', 1.5); }
      txt('CARRITOS CHOCONES', l.cx, top - 22, 14, INK, 0, true);
      rr(f.x0, scr(l, 0, FH).y + 18, w, 200, 0, lv === 3 ? '#2a2238' : '#6a5a4a', 0);
    }
    function pista(l, ap) {                                                                 // en coordenadas de PISTA
      var k, s;
      rr(-14, -14, FW + 28, FH + 28, 16, pal.goma, 0);                                    // baranda de goma
      rr(-6, -6, FW + 12, FH + 12, 10, '#ffd23f', 0); rr(-3, -3, FW + 6, FH + 6, 8, pal.goma, 0);
      rr(0, 0, FW, FH, 6, pal.piso, 3);
      for (k = 1; k < 10; k++) line([[k * 60, 0], [k * 60, FH]], 1.5, pal.plancha);
      for (k = 1; k < 6; k++) line([[0, k * 57], [FW, k * 57]], 1.5, pal.plancha);
      line([[FW / 2, 0], [FW / 2, FH]], 2, pal.techo); line([[0, FH / 2], [FW, FH / 2]], 2, pal.techo);       // las 4 líneas del techo (sectores)
      for (s = 0; s < 4; s++) {
        var ph = faseSec(st.k, s), x0 = (s & 1) ? FW / 2 : 0, y0 = (s & 2) ? FH / 2 : 0;
        if (ph === 1 && Math.floor(at * 10) % 2 === 0) { ctx.save(); ctx.globalAlpha = 0.28; rr(x0, y0, FW / 2, FH / 2, 0, '#ffd23f', 0); ctx.restore(); txt('¡OJO!', x0 + FW / 4, y0 + FH / 4, 22, '#14101c', 0, true); }
        else if (ph === 2) { ctx.save(); ctx.globalAlpha = 0.58; rr(x0, y0, FW / 2, FH / 2, 0, '#05040a', 0); ctx.restore(); txt('SIN LUZ', x0 + FW / 4, y0 + FH / 4, 20, '#8a8aa8', 0, true); }
      }
      zonas2D();
      void ap;
    }
    function zonas2D() {                                                                    // tableros de turbo, aceite y baranda que se cierra (pista, 2D)
      var o, ins = insetAt(st.k), pu = 1 + 0.12 * Math.sin(at * 7);
      for (o = 0; o < PADS.length; o++) { ell(PADS[o][0], PADS[o][1], RPAD, RPAD * 0.8, '#ffd23f', 2); ell(PADS[o][0], PADS[o][1], RPAD * 0.6 * pu, RPAD * 0.48 * pu, '#fffdf2', 0); txt('»', PADS[o][0], PADS[o][1] + 1, 16, INK, 0, true); }
      if (st.k >= oilT - 24) { ctx.save(); ctx.globalAlpha = 0.8 * Math.min(1, (st.k - oilT + 24) / 24); for (o = 0; o < OIL.length; o++) { ell(OIL[o][0], OIL[o][1], OIL[o][2], OIL[o][2] * 0.8, '#0c0a16', 0); ell(OIL[o][0] - 8, OIL[o][1] - 6, OIL[o][2] * 0.35, OIL[o][2] * 0.2, '#6a5cd8', 0); } ctx.restore(); }
      if (ins > 0) { var hz = Math.floor(at * 6) % 2 ? '#ff8a1f' : '#ffd23f'; rr(0, 0, FW, ins, 0, hz, 0); rr(0, FH - ins, FW, ins, 0, hz, 0); rr(0, 0, ins, FH, 0, hz, 0); rr(FW - ins, 0, ins, FH, 0, hz, 0); }
    }
    function aro(x, y, rx, ry, w, col) { var pts = [], k; for (k = 0; k < 20; k++) pts.push([x + Math.cos(k * Math.PI / 10) * rx, y + Math.sin(k * Math.PI / 10) * ry]); line(pts, w, col, true); }
    function cono(x, y) { ell(x, y + 3, RCONE + 2, 6, INK, 0); poly([[x - RCONE, y + 4], [x + RCONE, y + 4], [x, y - RCONE - 8]], '#ff8a1f', 3); rr(x - 8, y - 6, 16, 4, 2, '#fffdf2', 0); }
    function carroc(x, y, h, col, e2, opt) {                                              // carrito visto desde arriba: frente con faros, cola con luces rojas
      var hx = COS[h], hy = SIN[h], L2 = (RC + 3) * e2, W2 = (RC - 3) * e2, k, pts = [];
      var crn = [[1, 0.55], [0.75, 1], [-0.85, 1], [-1, 0.6], [-1, -0.6], [-0.85, -1], [0.75, -1], [1, -0.55]];
      for (k = 0; k < crn.length; k++) { var u = crn[k][0] * L2, v = crn[k][1] * W2; pts.push([x + hx * u - hy * v, y + hy * u + hx * v]); }
      ell(x, y + 4, RC * e2 + 3, RC * e2 * 0.8, INK, 0);
      ell(x, y, RC * e2 + 2, RC * e2 + 2, '#2b2838', 0);                                  // la goma redonda del parachoques
      poly(pts, col, 3);
      ell(x + hx * L2 * 0.82 - hy * W2 * 0.55, y + hy * L2 * 0.82 + hx * W2 * 0.55, 3.2, 3.2, '#fffdf2', 1.5);
      ell(x + hx * L2 * 0.82 + hy * W2 * 0.55, y + hy * L2 * 0.82 - hx * W2 * 0.55, 3.2, 3.2, '#fffdf2', 1.5);
      ell(x - hx * L2 * 0.86 - hy * W2 * 0.55, y - hy * L2 * 0.86 + hx * W2 * 0.55, 3, 3, opt && opt.apagado ? '#5a2a2a' : '#ff3b4e', 1.5);
      ell(x - hx * L2 * 0.86 + hy * W2 * 0.55, y - hy * L2 * 0.86 - hx * W2 * 0.55, 3, 3, opt && opt.apagado ? '#5a2a2a' : '#ff3b4e', 1.5);
      line([[x - hx * L2 * 0.2, y - hy * L2 * 0.2], [x - hx * L2 * 0.2 + 0, y - hy * L2 * 0.2 - 22 * e2]], 2.5, '#d8d8e8');   // la vara que va al techo
      if (opt && opt.chispa) { ell(x - hx * L2 * 0.2, y - hy * L2 * 0.2 - 24 * e2, 4, 4, '#ffe14d', 0); ell(x - hx * L2 * 0.2 + 5, y - hy * L2 * 0.2 - 28 * e2, 2, 2, '#fffdf2', 0); }
    }
    function carrito(pp, l, kv) {
      var q = st.p[pp], ps = posOf(pp), s = asiento(pp), tc = sideColor(side[pp]), e2 = l.e, x = ps.x, y = ps.y, h = ps.h === undefined ? q.h : ps.h;
      var mine = pp === c.yo, pana = c.yo >= 0 && c.yo < n && !mine && side[pp] === side[c.yo], off = faseSec(kv, sectorOf(x, y)) === 2;
      var carga = q.bst > 0 || (mine && boostFx > 0);
      if (carga) { ctx.save(); ctx.globalAlpha = 0.45; ell(x - COS[h] * 26, y - SIN[h] * 26, 14 * e2, 9 * e2, '#ffd23f', 0); ctx.restore(); }
      if (q.imm > 0 && Math.floor(at * 16) % 2 === 0) { ctx.save(); ctx.globalAlpha = 0.5; }
      carroc(x, y, h, tc, e2, { apagado: off, chispa: !off && Math.floor(at * 7 + pp * 3) % 5 === 0 });
      c.util.pj(s.ch, x, y - 30 * e2, 24 * e2, { animo: q.stun > 0 ? 'perder' : null, sombra: false });
      if (q.imm > 0 && Math.floor(at * 16) % 2 === 0) ctx.restore();
      /* anillo del acelerón: lleno = listo; se vacía mientras enfría */
      var lista = q.cd === 0 ? 1 : 1 - q.cd / (BOOST_T + BOOST_CD);
      if (mine) { aro(x, y, RC * e2 + 7, RC * e2 + 7, 2, '#ffd23f'); rr(x - 18, y + RC * e2 + 8, 36, 5, 2, '#14101c', 0); rr(x - 17, y + RC * e2 + 9, 34 * lista, 3, 1, lista >= 1 ? '#4fd06a' : '#ffd23f', 0); }
      if (q.stun > 0) for (var k2 = 0; k2 < 3; k2++) { var an = at * 9 + k2 * 2.1; ell(x + Math.cos(an) * 16, y - 50 * e2 + Math.sin(an) * 5, 3, 3, '#ffd23f', 1.5); }
      if (mine) poly([[x - 8, y - 66 * e2], [x + 8, y - 66 * e2], [x, y - 54 * e2]], '#ffd23f', 3);
      else if (pana) txt('PANA', x, y - 60 * e2, 11, '#fffdf2', 0, true);
      if (off) txt('¡SIN LUZ!', x, y + RC * e2 + 20, 10, '#ffd23f', 0, true);
    }
    function loco() {
      if (lv < 3) return;
      var L = st.lo, h = angOf(L.vx, L.vy);
      carroc(L.x, L.y, h, '#b07ac9', 1, { chispa: Math.floor(at * 9) % 3 === 0 });
      txt('¡LOCO!', L.x, L.y - 34, 10, '#fffdf2', 0, true);
    }
    /* ───── 3D low poly (fiesta-3d.js): la pista de carritos chocones de la feria (la de la Chinita). Solo dibujo: lee st y posOf; no toca la simulación ─────
       Pista de planchas con baranda de goma, techo de rejilla por sectores (cada sector con su luz de verdad: al apagón se apaga), carritos con el
       personaje sentado y su vara al techo que echa chispas, la taquilla con el señor del micrófono, la rueda de la fortuna, kioscos y público bailando. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ES = 1 / 16, PW3 = FW * ES, PD3 = FH * ES, PY = 0.3, R3 = RC * ES, TECHO = 4.8, ASI = 0.4;     // px de la pista -> metros; PY = alto de la tarima; ASI = el asiento
    var TQX = -12.5, TQZ = -PD3 / 2 - 4.4;                                                             // la taquilla, detrás a la izquierda
    var FOCOS = ['#ff5c8a', '#ffd23f', '#4fd06a', '#5cb8ff'];
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', tierra: '#c9a576', piso: '#9aa0b8', junta: '#5a5e72', goma: '#2b2838', techo: '#c9ccd8', luzS: .2, noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', tierra: '#b98f66', piso: '#958aa6', junta: '#544a62', goma: '#2a2232', techo: '#d8c0b4', luzS: .45, noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', tierra: '#5a4a62', piso: '#5d6078', junta: '#2a2c3c', goma: '#16131f', techo: '#6a6c88', luzS: 1.1, noche: 1 }
    };
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function WX(x) { return (x - FW / 2) * ES; }
    function WZ(y) { return (y - FH / 2) * ES; }
    function rumboDe(h) { return Math.atan2(COS[h], SIN[h]); }                                       // el frente del carrito (COS, SIN) en (x, z) -> rotation.y
    function letrero(s, fondo0, tinta, w, h) {                                                          // textura de un letrero pintado
      return V3.texturaCanvas(w, h, function (x, w2, h2) {
        x.fillStyle = fondo0; x.fillRect(0, 0, w2, h2);
        x.fillStyle = tinta; x.fillRect(0, 0, w2, 5); x.fillRect(0, h2 - 5, w2, 5);
        x.font = 'bold ' + Math.round(h2 * .55) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, w2 / 2, h2 / 2 + 2);
      });
    }
    function carro3D(col, mio, esLoco) {                                                                // un carrito: frente hacia +z, pies del asiento en ASI
      var T = THREE, M = V3.malla, g3 = new T.Group(), mat = V3.toon(col, { nuevo: true }), k;
      var goma = M(new T.TorusGeometry(R3 * .95, .2, 6, 24), '#2b2838', { g: .03 }); goma.rotation.x = Math.PI / 2; goma.position.y = .3; g3.add(goma);
      var tina = M(new T.CylinderGeometry(R3 * .84, R3 * .92, .6, 18), null, { mat: mat, g: .025 }); tina.scale.set(.9, 1, 1.08); tina.position.y = .6; g3.add(tina);
      var tablero = M(new T.BoxGeometry(1.3, .4, .45), V3.oscurecer(col, .75), { g: .03 }); tablero.position.set(0, 1.0, R3 * .62); g3.add(tablero);
      var franja = M(new T.BoxGeometry(1.32, .1, .47), '#fffdf2', { borde: false }); franja.position.set(0, 1.21, R3 * .62); g3.add(franja);
      var espaldar = M(new T.BoxGeometry(1.2, .85, .22), '#3a3858', { g: .03 }); espaldar.position.set(0, 1.25, -R3 * .62); g3.add(espaldar);
      if (!esLoco) { var volante = M(new T.TorusGeometry(.2, .04, 5, 12), '#2a2a34', { borde: false }); volante.position.set(0, 1.32, R3 * .42); volante.rotation.x = -.9; g3.add(volante); }
      var faroM = V3.toon('#fffdf2', { em: '#fff6c0', emI: lv === 3 ? 1.6 : .5 }), colaOn = V3.toon('#ff3b4e', { em: '#ff2030', emI: 1.2 }), colaOff = V3.toon('#5a2a2a'), colas = [];
      for (k = -1; k <= 1; k += 2) {
        var fa = M(new T.SphereGeometry(.12, 7, 5), null, { mat: faroM, borde: false }); fa.position.set(k * .42, .78, R3 * .99); g3.add(fa);
        var co = M(new T.BoxGeometry(.26, .14, .08), null, { mat: colaOn, borde: false }); co.position.set(k * .42, .78, -R3 * .99); g3.add(co); colas.push(co);
      }
      /* la vara al techo, con su escobilla, la chispa y el banderín del equipo */
      var largo = TECHO - PY - 1.2, zv = -R3 * .78;
      var vara = M(new T.CylinderGeometry(.035, .045, largo, 6), '#d8d8e8', { borde: false, sombra: false }); vara.position.set(0, 1.2 + largo / 2, zv); g3.add(vara);
      var esco = M(new T.BoxGeometry(.32, .06, .1), '#8a8aa0', { borde: false, sombra: false }); esco.position.set(0, TECHO - PY - .03, zv); g3.add(esco);
      var chis = new T.Mesh(new T.SphereGeometry(.17, 6, 4), new T.MeshBasicMaterial({ color: 0xfff6a0 })); chis.position.set(0, TECHO - PY - .05, zv); chis.visible = false; g3.add(chis);
      var ban = new T.Group(); ban.position.set(0, 2.3, zv); g3.add(ban);
      var tela = M(new T.BoxGeometry(.03, .32, .5), esLoco ? '#ff8a1f' : col, { g: .05 }); tela.position.z = -.26; ban.add(tela);
      /* el aro en el piso: amarillo y grueso el mío, del color del equipo los demás */
      var aro = new T.Mesh(new T.RingGeometry(R3 + .12, R3 + (mio ? .42 : .26), 28), new T.MeshBasicMaterial({ color: mio ? 0xffd23f : new T.Color(col), transparent: true, opacity: mio ? .95 : .55, depthWrite: false }));
      aro.rotation.x = -Math.PI / 2; aro.position.y = .03; g3.add(aro);
      /* las estrellitas del mareo */
      var est = new T.Group(); est.position.y = 2.95; est.visible = false; g3.add(est);
      for (k = 0; k < 3; k++) { var es1 = M(new T.OctahedronGeometry(.14, 0), null, { mat: V3.toon('#ffe14d', { em: '#ffd23f', emI: .8 }), g: .06 }); es1.position.set(Math.cos(k * 2.09) * .5, 0, Math.sin(k * 2.09) * .5); est.add(es1); }
      var faro = null;
      if (esLoco) { faro = M(new T.ConeGeometry(.3, .45, 8), null, { mat: V3.toon('#ff8a1f', { em: '#ff6a00', emI: 1.4 }), g: .05 }); faro.position.set(0, 1.25, -.1); g3.add(faro); }
      return { g: g3, mat: mat, colas: colas, colaOn: colaOn, colaOff: colaOff, chis: chis, ban: ban, est: est, faro: faro, zv: zv,
        ry: 0, giro: 0, bote: 0, chT: 0, flash: 0, humo: 0, bstV: false, pared: false, anoto: -9, pj: null };
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, s, i2;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 70, 170], fov: 32 });
      if (!esc) return null;
      /* la música: gaita zuliana de feria (la de la Chinita), i–iv–V–i en La menor */
      V3.pista('chocones', { bpm: 128, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 74, 72, 0, 71, 72, 0, 74, 0, 76, 77, 0, 76, 74, 0, 72, 0, 71, 69, 0, 71, 72, 0, 68, 0, 71, 0, 69, 0, 0, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, gmap = V3.toon('#fff').gradientMap;
      /* el terreno de la feria: tierra apisonada */
      var tierra = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.tierra; x.fillRect(0, 0, w, h);
        for (var j2 = 0; j2 < 260; j2++) { x.fillStyle = V3.oscurecer(pl.tierra, .84 + ((j2 * 37) % 10) / 28); x.fillRect((j2 * 73) % w, (j2 * 151) % h, 3 + (j2 % 4), 2 + (j2 % 3)); }
      }, [18, 14]);
      var suelo = new T.Mesh(new T.PlaneGeometry(170, 130), new T.MeshToonMaterial({ map: tierra, gradientMap: gmap }));
      suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; S3.add(suelo);
      /* la tarima y el piso de planchas con remaches */
      var base = M(new T.BoxGeometry(PW3 + 2.4, PY, PD3 + 2.4), pl.goma, { recibe: true, g: .01 }); base.position.y = PY / 2; S3.add(base);
      var planchas = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.junta; x.fillRect(0, 0, w, h);
        for (var j2 = 0; j2 < 4; j2++) for (var k2 = 0; k2 < 4; k2++) {
          var ox = k2 * 64, oy = j2 * 64; x.fillStyle = V3.oscurecer(pl.piso, .92 + ((k2 * 5 + j2 * 3) % 4) * .04); x.fillRect(ox + 2, oy + 2, 60, 60);
          x.fillStyle = V3.oscurecer(pl.piso, .7); x.fillRect(ox + 6, oy + 6, 3, 3); x.fillRect(ox + 55, oy + 6, 3, 3); x.fillRect(ox + 6, oy + 55, 3, 3); x.fillRect(ox + 55, oy + 55, 3, 3);
        }
      }, [PW3 / 4, PD3 / 4]);
      var piso = new T.Mesh(new T.PlaneGeometry(PW3, PD3), new T.MeshToonMaterial({ map: planchas, gradientMap: gmap }));
      piso.rotation.x = -Math.PI / 2; piso.position.y = PY + .005; piso.receiveShadow = true; S3.add(piso);
      [[0, 0, PW3, .1], [0, 0, .1, PD3]].forEach(function (r) {                                         // las líneas de los 4 sectores
        var m = new T.Mesh(new T.PlaneGeometry(r[2], r[3]), tn(pl.techo)); m.rotation.x = -Math.PI / 2; m.position.set(r[0], PY + .012, r[1]); m.receiveShadow = true; S3.add(m);
      });
      /* la baranda de goma con su franja amarilla */
      var bh = .7, bt = .55;
      [[0, -PD3 / 2 - bt / 2, PW3 + 2 * bt, bt], [0, PD3 / 2 + bt / 2, PW3 + 2 * bt, bt], [-PW3 / 2 - bt / 2, 0, bt, PD3], [PW3 / 2 + bt / 2, 0, bt, PD3]].forEach(function (r) {
        var b = M(new T.BoxGeometry(r[2], bh, r[3]), pl.goma, { g: .02, recibe: true }); b.position.set(r[0], PY + bh / 2, r[1]); S3.add(b);
        var fr = M(new T.BoxGeometry(r[2] + .02, .14, r[3] + .02), '#ffd23f', { borde: false }); fr.position.set(r[0], PY + bh * .62, r[1]); S3.add(fr);
      });
      /* conos de goma (Nv2+) */
      for (k = 0; k < cones.length; k++) {
        var cg = new T.Group(); cg.position.set(WX(cones[k][0]), PY, WZ(cones[k][1])); S3.add(cg);
        var cb = M(new T.CylinderGeometry(RCONE * ES, RCONE * ES * 1.05, .12, 12), '#2b2838', { g: .03 }); cb.position.y = .06; cg.add(cb);
        var cn = M(new T.ConeGeometry(RCONE * ES * .85, 1.5, 12), '#ff8a1f', { g: .04 }); cn.position.y = .8; cg.add(cn);
        var cf = M(new T.CylinderGeometry(.28, .38, .22, 12), '#fffdf2', { borde: false }); cf.position.y = .85; cg.add(cf);
      }
      /* arena viva: tableros de turbo, aceite, baranda que se cierra, globos */
      var padM = [], oilM = [], murM = [], globos = [], tb = function (col, op) { return new T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op }); };
      PADS.forEach(function (p2) {
        var pg = new T.Group(); pg.position.set(WX(p2[0]), PY + .03, WZ(p2[1])); S3.add(pg);
        pg.add(new T.Mesh(new T.CylinderGeometry(RPAD * ES, RPAD * ES, .05, 18), tb('#ffd23f', 1)));
        var ani = new T.Mesh(new T.TorusGeometry(RPAD * ES * .65, .09, 4, 18), tb('#fffdf2', 1)); ani.rotation.x = Math.PI / 2; ani.position.y = .06; pg.add(ani);
        var rel = new T.Mesh(new T.ConeGeometry(.32, .7, 3), tb('#14101c', 1)); rel.rotation.x = Math.PI / 2; rel.position.y = .07; pg.add(rel);
        padM.push({ g: pg, ani: ani, rel: rel });
      });
      OIL.forEach(function (o2) {
        var og = new T.Group(); og.position.set(WX(o2[0]), PY + .025, WZ(o2[1])); og.visible = false; S3.add(og);
        og.add(new T.Mesh(new T.CylinderGeometry(o2[2] * ES, o2[2] * ES, .03, 18), tb('#0c0a16', .85)));
        var br = new T.Mesh(new T.CylinderGeometry(o2[2] * ES * .4, o2[2] * ES * .4, .035, 12), tb('#6a5cd8', .8)); br.position.set(-.3, .005, -.2); og.add(br);
        oilM.push(og);
      });
      for (k = 0; k < 4; k++) { var mu = M(new T.BoxGeometry(1, .8, 1), k % 2 ? '#ff8a1f' : '#ffd23f', { g: .02 }); mu.visible = false; S3.add(mu); murM.push(mu); }
      [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]].forEach(function (g2, i3) {
        var gg = new T.Group(); gg.position.set(g2[0] * (PW3 / 2 + 3.2), 0, g2[1] * (PD3 / 2 + 1.5) + (g2[1] === 0 ? 0 : 0)); S3.add(gg);
        for (var q3 = 0; q3 < 3; q3++) { var bl = M(new T.SphereGeometry(.42, 8, 6), FOCOS[(i3 + q3) % 4], { g: .04 }); bl.position.set((q3 - 1) * .5, 3 + q3 * .25, 0); gg.add(bl); var cu2 = M(new T.CylinderGeometry(.015, .015, 2.6, 3), '#fffdf2', { borde: false }); cu2.position.set((q3 - 1) * .25, 1.6, 0); gg.add(cu2); }
        globos.push(gg);
      });
      /* el techo: postes, vigas, la rejilla por sector (titila amarilla al aviso), sus bombillos y su luz de verdad */
      var vx0 = PW3 / 2 + .85, vz0 = PD3 / 2 + .85;
      [[-vx0, -vz0], [0, -vz0], [vx0, -vz0], [-vx0, 0], [vx0, 0], [-vx0, vz0], [vx0, vz0]].forEach(function (p2) {
        var po = M(new T.CylinderGeometry(.14, .18, TECHO, 8), pl.techo, { g: .03 }); po.position.set(p2[0], TECHO / 2, p2[1]); S3.add(po);
      });
      var vb = M(new T.BoxGeometry(PW3 + 2, .25, .25), pl.techo, { g: .03 }); vb.position.set(0, TECHO, -vz0); S3.add(vb);
      [-vx0, vx0].forEach(function (x2) { var vl = M(new T.BoxGeometry(.25, .25, PD3 + 1.7), pl.techo, { g: .03 }); vl.position.set(x2, TECHO, 0); S3.add(vl); });
      for (k = 0; k < 16; k++) {                                                                                     // los faldones de la carpa sobre la viga de atrás y las de los lados
        var fd = M(new T.BoxGeometry((PW3 + 2) / 16 - .04, .7, .06), k % 2 ? '#fffdf2' : '#ff6a4d', { borde: false }); fd.position.set(-PW3 / 2 - 1 + (k + .5) * (PW3 + 2) / 16, TECHO - .45, -vz0 - .05); S3.add(fd);
      }
      for (k = 0; k < 10; k++) [-1, 1].forEach(function (sg) {
        var fl = M(new T.BoxGeometry(.06, .7, (PD3 + 1.7) / 10 - .04), k % 2 ? '#fffdf2' : '#ff6a4d', { borde: false }); fl.position.set(sg * (vx0 + .05), TECHO - .45, -PD3 / 2 - .85 + (k + .5) * (PD3 + 1.7) / 10); S3.add(fl);
      });
      var focoOff = tn('#5a5a6a'), focosOn = [], focos = [];
      for (k = 0; k < 4; k++) focosOn.push(tn(FOCOS[k], { em: FOCOS[k], emI: pl.noche ? 1.8 : .9 }));
      function foco(x2, y2, z2, i3) { var fo = new T.Mesh(new T.SphereGeometry(.15, 6, 4), focosOn[i3 % 4]); fo.position.set(x2, y2, z2); S3.add(fo); focos.push({ m: fo, c: i3 % 4 }); }
      for (k = 0; k < 22; k++) foco(-PW3 / 2 - 1 + (k + .5) * (PW3 + 2) / 22, TECHO + .2, -vz0, k);
      for (k = 0; k < 12; k++) { foco(-vx0, TECHO + .2, -PD3 / 2 - .85 + (k + .5) * (PD3 + 1.7) / 12, k + 1); foco(vx0, TECHO + .2, -PD3 / 2 - .85 + (k + .5) * (PD3 + 1.7) / 12, k + 3); }
      /* el letrero grande sobre la viga de atrás */
      var marco = M(new T.BoxGeometry(12.6, 2.1, .2), '#d93a3a', { g: .02 }); marco.position.set(0, TECHO + 1.3, -vz0 - .2); S3.add(marco);
      var cartel = new T.Mesh(new T.PlaneGeometry(12, 1.6), new T.MeshBasicMaterial({ map: letrero('CARRITOS CHOCONES', '#ffd23f', '#d93a3a', 512, 72) })); cartel.position.set(0, TECHO + 1.3, -vz0 - .08); S3.add(cartel);
      for (k = 0; k < 18; k++) foco(-6.1 + k * 12.2 / 17, TECHO + 2.45, -vz0 - .15, k + 2);
      var sec = [], bombC = tn('#fff6d0', { em: '#ffe9a0', emI: pl.noche ? 1.8 : .8 });
      for (s = 0; s < 4; s++) {
        var sx0 = (s & 1) ? 0 : -PW3 / 2, sz0 = (s & 2) ? 0 : -PD3 / 2, sw = PW3 / 2, sd = PD3 / 2, arr = [];
        for (i2 = 0; i2 <= 8; i2++) { var xx = sx0 + sw * i2 / 8; arr.push(xx, TECHO, sz0, xx, TECHO, sz0 + sd); }
        for (i2 = 0; i2 <= 5; i2++) { var zz = sz0 + sd * i2 / 5; arr.push(sx0, TECHO, zz, sx0 + sw, TECHO, zz); }
        var geoR = new T.BufferGeometry(); geoR.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
        var rej = new T.LineSegments(geoR, new T.LineBasicMaterial({ color: new T.Color(pl.techo), transparent: true, opacity: .35 })); S3.add(rej);
        var velo = new T.Mesh(new T.PlaneGeometry(sw, sd), new T.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0, depthWrite: false }));
        velo.rotation.x = -Math.PI / 2; velo.position.set(sx0 + sw / 2, PY + .02, sz0 + sd / 2); velo.visible = false; S3.add(velo);
        var luz = new T.PointLight(0xfff0c8, pl.luzS, 16, 2); luz.position.set(sx0 + sw / 2, TECHO - .5, sz0 + sd / 2); S3.add(luz);
        var bombs = [];
        for (i2 = 0; i2 < 3; i2++) { var bm = new T.Mesh(new T.SphereGeometry(.17, 6, 4), bombC); bm.position.set(sx0 + sw * (i2 + 1) / 4, TECHO - .22, sz0 + sd / 2); S3.add(bm); bombs.push(bm); }
        sec.push({ rej: rej, velo: velo, luz: luz, bombs: bombs, cx: sx0 + sw / 2, cz: sz0 + sd / 2 });
      }
      /* quién está en la pista: el de la taquilla y el público son del elenco que no juega */
      var usados = {}, libres = [], ids = V3.PJ.ids ? V3.PJ.ids() : ['tio', 'abuela', 'prima', 'portu'];
      for (k = 0; k < n; k++) usados[asiento(k).ch || 'tu'] = 1;
      var chT = !usados.tio ? 'tio' : !usados.cobrador ? 'cobrador' : !usados.portu ? 'portu' : 'tio';
      for (k = 0; k < ids.length; k++) if (!usados[ids[k]] && ids[k] !== chT) libres.push(ids[k]);
      /* la taquilla con el señor del micrófono */
      var tq3 = new T.Group(); tq3.position.set(TQX, 0, TQZ); S3.add(tq3);
      var paredT = M(new T.BoxGeometry(3.2, 3, .2), '#ffb36b', { recibe: true, g: .02 }); paredT.position.set(0, 1.5, -1.1); tq3.add(paredT);
      [-1, 1].forEach(function (sg) { var la = M(new T.BoxGeometry(.2, 3, 2.4), '#ffb36b', { recibe: true, g: .02 }); la.position.set(sg * 1.5, 1.5, 0); tq3.add(la); });
      var mostrador = M(new T.BoxGeometry(3.2, 1.25, .25), '#ff8a3d', { g: .02 }); mostrador.position.set(0, .62, 1.1); tq3.add(mostrador);
      var techoT = M(new T.BoxGeometry(3.8, .25, 3), '#d93a3a', { g: .02 }); techoT.position.set(0, 3.1, 0); tq3.add(techoT);
      var cartT = new T.Mesh(new T.PlaneGeometry(2.8, .7), new T.MeshBasicMaterial({ map: letrero('FICHAS', '#fffdf2', '#14101c', 256, 64) })); cartT.position.set(0, 3.65, 1.0); tq3.add(cartT);
      var senor = V3.PJ.crear(chT, { prop: false, escala: 1.2 }); senor.g.position.set(0, 0, .15); tq3.add(senor.g);
      var mic = M(new T.CylinderGeometry(.05, .08, .32, 6), '#2a2a34', { g: .06 }); mic.position.y = -.12; senor.mano('der').add(mic);
      /* el público detrás de la baranda de atrás */
      var publico = [];
      for (k = 0; k < Math.min(2, libres.length); k++) { var pu = V3.PJ.crear(libres[k], { prop: false, escala: 1.25 }); pu.g.position.set(k ? 5.5 : -4.5, 0, -vz0 - 1.4); S3.add(pu.g); publico.push(pu); }
      /* kioscos de cotufas y raspados */
      function kiosco(x2, z2, col, nom) {
        var g3 = new T.Group(); g3.position.set(x2, 0, z2); S3.add(g3);
        var cu = M(new T.BoxGeometry(3, 1.2, 1.8), col, { recibe: true, g: .02 }); cu.position.y = .6; g3.add(cu);
        for (var j2 = 0; j2 < 4; j2++) { var pt2 = M(new T.CylinderGeometry(.06, .06, 1.6, 5), '#fffdf2', { borde: false }); pt2.position.set(j2 % 2 ? 1.35 : -1.35, 2, j2 < 2 ? .75 : -.75); g3.add(pt2); }
        for (j2 = 0; j2 < 6; j2++) { var tj = M(new T.BoxGeometry(3.4 / 6, .22, 2.2), j2 % 2 ? '#fffdf2' : col, { g: .02 }); tj.position.set(-1.7 + (j2 + .5) * 3.4 / 6, 2.9, 0); g3.add(tj); }
        var ct = new T.Mesh(new T.PlaneGeometry(2.6, .6), new T.MeshBasicMaterial({ map: letrero(nom, '#fffdf2', col, 256, 60) })); ct.position.set(0, 3.4, .5); g3.add(ct);
      }
      kiosco(-3.5, -vz0 - 9, '#3fae4a', 'COTUFAS'); kiosco(4.5, -vz0 - 10.5, '#5cb8ff', 'RASPADOS');
      /* la rueda de la fortuna (gira sola) */
      var RXw = 15, RZw = -vz0 - 14, RRw = 6.5, RHw = 8.2, rueda = new T.Group(); rueda.position.set(RXw, RHw, RZw); S3.add(rueda);
      rueda.add(M(new T.TorusGeometry(RRw, .14, 6, 36), '#e8e8f0', { g: .03 })); rueda.add(M(new T.TorusGeometry(RRw * .45, .1, 6, 24), '#e8e8f0', { g: .03 }));
      var cabinas = [];
      for (k = 0; k < 8; k++) {
        var a8 = k * Math.PI / 4, ra = M(new T.BoxGeometry(.1, RRw, .1), '#c9ccd8', { borde: false }); ra.position.set(Math.cos(a8) * RRw / 2, Math.sin(a8) * RRw / 2, 0); ra.rotation.z = a8 - Math.PI / 2; rueda.add(ra);
        var piv = new T.Group(); piv.position.set(Math.cos(a8) * RRw, Math.sin(a8) * RRw, 0); rueda.add(piv);
        var cab = M(new T.BoxGeometry(1.1, .9, .9), FOCOS[k % 4], { g: .04 }); cab.position.y = -.75; piv.add(cab);
        var te = M(new T.BoxGeometry(1.25, .12, 1), '#fffdf2', { borde: false }); te.position.y = -.25; piv.add(te);
        cabinas.push(piv);
        if (pl.noche) { var bR = new T.Mesh(new T.SphereGeometry(.2, 6, 4), focosOn[k % 4]); bR.position.set(Math.cos(a8 + .39) * RRw, Math.sin(a8 + .39) * RRw, .15); rueda.add(bR); }
      }
      var eje = M(new T.CylinderGeometry(.35, .35, .7, 10), '#ffd23f'); eje.rotation.x = Math.PI / 2; rueda.add(eje);
      [-1, 1].forEach(function (sg) {
        var lg = RHw + .6;
        [-.5, .5].forEach(function (dz) { var pa = M(new T.BoxGeometry(.25, lg, .25), '#c9ccd8', { g: .03 }); pa.position.set(RXw + sg * Math.sin(.28) * lg / 2, lg / 2 - .3, RZw + dz); pa.rotation.z = sg * .28; S3.add(pa); });
      });
      /* palmeras */
      var hojas = [];
      function palmera(x2, z2, h2) {
        var g3 = new T.Group(); g3.position.set(x2, 0, z2); S3.add(g3);
        for (var j2 = 0; j2 < 6; j2++) { var tr = M(new T.CylinderGeometry(.28 - j2 * .02, .34 - j2 * .02, h2 / 6, 6), j2 % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(j2 * .3) * .3, h2 / 12 + j2 * h2 / 6, 0); g3.add(tr); }
        for (j2 = 0; j2 < 7; j2++) { var ho = M(new T.ConeGeometry(.5, 3.6, 4), j2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); ho.geometry.translate(0, 1.8, 0); ho.position.set(.5, h2, 0); ho.rotation.set(0, j2 / 7 * 6.28, 0); ho.rotateZ(1.9); g3.add(ho); hojas.push(ho); }
      }
      palmera(-22, -vz0 - 3, 7.5); palmera(24, -vz0 - 2, 7);
      if (pl.noche) {
        var lT = new T.PointLight(0xffc870, 1.2, 12, 2); lT.position.set(TQX, 3.2, TQZ + 2.2); S3.add(lT);
        var lR = new T.PointLight(0xff8acb, 1.2, 22, 2); lR.position.set(RXw, RHw, RZw + 3); S3.add(lR);
      }
      /* los carritos: el personaje va sentado adentro (hijo del carrito: gira con él) */
      var cars = [];
      for (k = 0; k < n; k++) {
        var cv = carro3D(sideColor(side[k]), k === c.yo, false);
        cv.pj = V3.PJ.crear(asiento(k).ch || 'tu', { prop: false, escala: 1.3 });
        cv.pj.g.position.set(0, ASI, -.25); cv.g.add(cv.pj.g); S3.add(cv.g); cars.push(cv);
      }
      var loco3 = null; if (lv >= 3) { loco3 = carro3D('#b07ac9', false, true); S3.add(loco3.g); }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 700);
      esc.encuadrar(PW3 + 4, PD3 + 9, new T.Vector3(0, 1.2, -1.6), .95);
      return V3.ultimo = { esc: esc, pl: pl, cars: cars, loco: loco3, flecha: flecha, part: part, sec: sec, focos: focos, focosOn: focosOn, focoOff: focoOff, bombC: bombC,
        rueda: rueda, cabinas: cabinas, hojas: hojas, senor: senor, publico: publico, pads: padM, oil: oilM, muros: murM, globos: globos, toques: {}, ultGolpe: -9, golT: -9 };
    }
    function punta(cv) { var r = cv.ry; return { x: cv.g.position.x + Math.sin(r) * cv.zv, y: TECHO - .08, z: cv.g.position.z + Math.cos(r) * cv.zv }; }   // donde la vara toca el techo
    function giroDe(cv, ry, dt) {
      var dr = ry - cv.ry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI;
      cv.ry = ry; cv.giro += (cl(dr / Math.max(dt, 1e-3), -8, 8) - cv.giro) * Math.min(1, dt * 8);
    }
    function actualizar3D(dt, now) {
      var V = v3, k, j, s, t = at, s0 = teamScore(0), s1 = teamScore(1), gano = !finDicho || s0 === s1 ? -1 : (s0 > s1 ? 0 : 1);
      V.part.update(dt);
      /* lo que se mueve solo: la rueda, los bombillos que corren, las palmas */
      V.rueda.rotation.z = t * .22; for (k = 0; k < V.cabinas.length; k++) V.cabinas[k].rotation.z = -t * .22;
      var paso = Math.floor(t * 5);
      for (k = 0; k < V.focos.length; k++) V.focos[k].m.material = (k + paso) % 4 === 0 && lv < 3 ? V.focoOff : V.focosOn[V.focos[k].c];
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .06;
      var pu3 = 1 + .15 * Math.sin(t * 7), ins3 = insetAt(st.k) * ES;
      for (k = 0; k < V.pads.length; k++) { V.pads[k].ani.scale.set(pu3, pu3, 1); V.pads[k].rel.position.x = Math.sin(t * 6) * .25; }
      for (k = 0; k < V.oil.length; k++) { var osc = clamp01((st.k - oilT + 24) / 24); V.oil[k].visible = osc > 0; V.oil[k].scale.set(osc, 1, osc); }
      for (k = 0; k < V.globos.length; k++) { V.globos[k].rotation.z = Math.sin(t * 1.1 + k * 1.7) * .08; V.globos[k].position.y = Math.sin(t * 1.6 + k) * .12; }
      for (k = 0; k < 4; k++) {
        var mw = V.muros[k]; mw.visible = ins3 > .01; if (!mw.visible) continue;
        var ho = k < 2, sg = k % 2 ? 1 : -1;
        mw.scale.set(ho ? PW3 : ins3, 1, ho ? ins3 : PD3);
        mw.position.set(ho ? 0 : sg * (PW3 / 2 - ins3 / 2), PY + .4, ho ? sg * (PD3 / 2 - ins3 / 2) : 0);
      }
      for (k = 0; k < n; k++) {
        var cq = V.cars[k].g.position, qx = cq.x / ES + FW / 2, qy = cq.z / ES + FH / 2;
        if (c.fx() < dt * 14) {
          if (onPad(qx, qy)) V.part.soltar(cq.x, PY + .2, cq.z, 3, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 2.2, arriba: 1.2, g: 6, vida: .4, esc: .5 });
          else if (onOil(qx, qy, st.k)) V.part.soltar(cq.x, PY + .15, cq.z, 2, { k: 'chispa', cols: ['#6a5cd8', '#0c0a16'], vel: 1.2, arriba: 1, g: 6, vida: .5, esc: .5 });
        }
      }
      /* los sectores del techo: aviso (titila amarillo) y sin luz (se apaga la luz de verdad) */
      var parp = Math.floor(t * 10) % 2 === 0;
      for (s = 0; s < 4; s++) {
        var ph = faseSec(st.k, s), sc = V.sec[s];
        sc.velo.visible = ph > 0;
        if (ph === 1) { sc.velo.material.color.set(0xffd23f); sc.velo.material.opacity = parp ? .3 : .06; }
        else if (ph === 2) { sc.velo.material.color.set(0x05040a); sc.velo.material.opacity = .5; }
        sc.rej.material.color.set(ph === 1 && parp ? '#ffd23f' : ph === 2 ? '#3a3a48' : V.pl.techo); sc.rej.material.opacity = ph === 1 ? .95 : .35;
        sc.luz.intensity = ph === 2 ? 0 : ph === 1 ? (parp ? V.pl.luzS * 1.8 : V.pl.luzS * .2) : V.pl.luzS;
        for (j = 0; j < sc.bombs.length; j++) sc.bombs[j].material = ph === 2 || (ph === 1 && !parp) ? V.focoOff : V.bombC;
        if (ph === 1 && c.fx() < dt * 7) V.part.soltar(sc.cx + (c.fx() - .5) * PW3 * .45, TECHO - .1, sc.cz + (c.fx() - .5) * PD3 * .45, 3, { k: 'chispa', cols: ['#ffe14d', '#fffdf2'], vel: 1.5, arriba: .3, g: 9, vida: .6, esc: .6 });
      }
      /* los carritos */
      for (k = 0; k < n; k++) {
        var cv = V.cars[k], q = st.p[k], ps = posOf(k), h = ps.h === undefined ? q.h : ps.h, mine = k === c.yo;
        var off = faseSec(st.k, sectorOf(ps.x, ps.y)) === 2, sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy), boost = q.bst > 0 || (mine && boostFx > 0);
        cv.bote = Math.max(0, cv.bote - dt * 3);
        cv.g.position.set(WX(ps.x), PY + cv.bote * .28 * Math.abs(Math.sin(t * 26)), WZ(ps.y));
        giroDe(cv, rumboDe(h), dt); cv.g.rotation.y = cv.ry;
        cv.g.rotation.z = cl(cv.giro * .02, -.08, .08) + (cv.bote > 0 ? Math.sin(t * 31) * cv.bote * .08 : 0);
        cv.mat.emissive.set(q.imm > 0 && Math.floor(t * 16) % 2 === 0 ? 0x777777 : 0x000000);             // inmune: parpadea
        for (j = 0; j < cv.colas.length; j++) cv.colas[j].material = off ? cv.colaOff : cv.colaOn;
        cv.ban.rotation.y = Math.sin(t * 9 + k) * .35 + cl(cv.giro * .05, -.4, .4);
        /* la chispa de la vara: con corriente y andando; el acelerón echa más */
        cv.chT -= dt; cv.flash -= dt;
        if (!off && cv.chT < 0 && (sp > .8 || boost)) { cv.chT = boost ? .06 : .15 + c.fx() * .35; var tp = punta(cv); V.part.soltar(tp.x, tp.y, tp.z, boost ? 3 : 2, { k: 'chispa', cols: ['#ffe14d', '#fffdf2', '#8fd8ff'], vel: 1.6, arriba: .4, g: 10, vida: .45, esc: .55 }); cv.flash = .07; }
        cv.chis.visible = !off && cv.flash > 0;
        /* el acelerón: arranque con motor y candela por detrás */
        var bx = cv.g.position.x - Math.sin(cv.ry) * 1.4, bz = cv.g.position.z - Math.cos(cv.ry) * 1.4;
        if (boost && !cv.bstV) { if (mine) V3.sfx('motor'); V.part.soltar(bx, PY + .5, bz, 12, { k: 'chispa', cols: ['#ffd23f', '#ff8a3d', '#fffdf2'], vel: 3, arriba: 1, g: 6, vida: .4, esc: .8 }); }
        if (boost) { cv.humo -= dt; if (cv.humo < 0) { cv.humo = .05; V.part.soltar(bx, PY + .5, bz, 2, { k: 'chispa', cols: ['#ff8a3d', '#ffd23f'], vel: 1, arriba: .6, g: 2, vida: .3, esc: .7 }); } }
        cv.bstV = boost;
        /* contra la baranda: golpe seco y chispitas */
        var pared = ps.x <= RC + .6 || ps.x >= FW - RC - .6 || ps.y <= RC + .6 || ps.y >= FH - RC - .6;
        if (pared && !cv.pared && sp > 3.5 && now >= 0) { if (t - V.golT > .3) { V.golT = t; V3.sfx('golpe'); } V.part.soltar(WX(cl(ps.x, 0, FW)), PY + .5, WZ(cl(ps.y, 0, FH)), 5, { k: 'chispa', cols: ['#fffdf2', '#ffd23f'], vel: 2, arriba: 1.2, vida: .3, esc: .5 }); cv.bote = Math.max(cv.bote, .4); }
        cv.pared = pared;
        cv.est.visible = q.stun > 0; if (q.stun > 0) cv.est.rotation.y = t * 7;
        /* el personaje: sentado manejando; al final el equipo que ganó se para a celebrar */
        var pj = cv.pj, cele = gano >= 0 && side[k] === gano;
        if (cele) pj.anim('celebrar').cara('feliz');
        else pj.anim('sentado').cara(gano >= 0 ? 'triste' : q.stun > 0 ? 'mareado' : off ? 'susto' : boost ? 'concentrado' : t - cv.anoto < 1.2 ? 'feliz' : 'normal');
        pj.g.position.y = ASI + (cele ? .45 : 0);
        pj.mirar(cl(-cv.giro * .25, -1, 1), 0);
        pj.g.rotation.z = cl(-cv.giro * .05, -.22, .22);                                                 // se ladea en la curva
        pj.update(dt);
      }
      /* el carrito loco (Nv3) */
      var L = st.lo, cuerpos = [];
      if (V.loco) {
        var lc = V.loco; lc.g.position.set(WX(L.x), PY, WZ(L.y)); giroDe(lc, rumboDe(angOf(L.vx, L.vy)), dt); lc.g.rotation.y = lc.ry;
        lc.faro.rotation.y = t * 8; lc.ban.rotation.y = Math.sin(t * 11) * .4;
        lc.chT -= dt; lc.flash -= dt; if (lc.chT < 0) { lc.chT = .1 + c.fx() * .2; var tl = punta(lc); V.part.soltar(tl.x, tl.y, tl.z, 2, { k: 'chispa', cols: ['#ffe14d', '#fffdf2'], vel: 1.6, arriba: .4, g: 10, vida: .45, esc: .55 }); lc.flash = .07; }
        lc.chis.visible = lc.flash > 0;
      }
      /* toques sin puntos (pana con pana, de frente, el loco): golpe, chispitas y rebote */
      for (k = 0; k < n; k++) { var pk = posOf(k); cuerpos.push([pk.x, pk.y, RC, k]); }
      if (V.loco) cuerpos.push([L.x, L.y, RL, -1]);
      for (k = 0; k < cuerpos.length; k++) for (j = k + 1; j < cuerpos.length; j++) {
        var A = cuerpos[k], B = cuerpos[j], dx = B[0] - A[0], dy = B[1] - A[1], toca = Math.sqrt(dx * dx + dy * dy) < A[2] + B[2] + 1.5, key = k * 8 + j;
        if (toca && !V.toques[key] && t - V.ultGolpe > .25 && now >= 0) {
          if (t - V.golT > .35) { V.golT = t; V3.sfx('golpe'); } V.part.soltar(WX((A[0] + B[0]) / 2), PY + .6, WZ((A[1] + B[1]) / 2), 8, { k: 'chispa', cols: ['#fffdf2', '#ffd23f'], vel: 2.5, arriba: 1.5, vida: .35, esc: .6 });
          V.esc.sacudir(.15);
          if (A[3] >= 0) { V.cars[A[3]].bote = Math.max(V.cars[A[3]].bote, .5); latigazo(V.cars[A[3]], A[0] - B[0], A[1] - B[1], .9); }
          if (B[3] >= 0) { V.cars[B[3]].bote = Math.max(V.cars[B[3]].bote, .5); latigazo(V.cars[B[3]], B[0] - A[0], B[1] - A[1], .9); }
        }
        V.toques[key] = toca;
      }
      /* el de la taquilla y el público */
      V.senor.anim(bubT > 0 || finDicho ? 'saludar' : 'quieto').cara(bubT > 0 ? 'enojado' : 'feliz').rumbo(0).update(dt);
      for (k = 0; k < V.publico.length; k++) V.publico[k].anim(t - V.ultGolpe < .9 || finDicho ? 'celebrar' : k ? 'bailar' : 'saludar').cara(t - V.ultGolpe < .9 ? 'feliz' : 'normal').rumbo(Math.sin(t * .7 + k) * .3).update(dt);
      /* la flechita sobre mi carrito */
      var yo = c.yo >= 0 && c.yo < n ? V.cars[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.g.position.x, 3.7 + Math.abs(Math.sin(t * 4)) * .3, yo.g.position.z);
    }
    function golpe3D(a, b, pts, rear, off) {                                                         // ¡TOMA! / ¡POR DETRÁS!: chispazo, confeti del equipo, choque y sacudida
      var V = v3, A = V.cars[a], B = V.cars[b], pa = posOf(a), pb = posOf(b), mx = WX((pa.x + pb.x) / 2), mz = WZ((pa.y + pb.y) / 2);
      V.part.soltar(mx, PY + .7, mz, rear ? 36 : 22, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#5cb8ff', '#ff8a3d'], vel: rear ? 6.5 : 4.5, arriba: 3.5, g: 12, vida: .6, esc: .9 });
      V.part.soltar(mx, PY + 1, mz, rear ? 16 : 8, { k: 'confeti', cols: [sideColor(side[a]), '#fffdf2', '#ffd23f'], vel: 3, arriba: 4, g: 8, vida: 1.1 });
      if (off) V.part.soltar(B.g.position.x, 2.6, B.g.position.z, 10, { k: 'chispa', cols: ['#ffe14d', '#fffdf2'], vel: 2, arriba: 3, g: 6, vida: .7, esc: .7 });
      V3.sfx('choque'); V3.sfx(pts >= 2 ? 'moneda' : 'ding');
      V.esc.sacudir(rear ? 1 : .6);
      A.pj.uno(rear ? 'festejo' : 'lanzar'); A.anoto = at; A.bote = .5;
      latigazo(B, B.g.position.x - A.g.position.x, B.g.position.z - A.g.position.z, rear ? 2 : 1.6); B.bote = 1;
      V.ultGolpe = at;
    }
    function latigazo(cv, dx, dz, f) {                                                               // el piloto recibe el golpe (dirección del mundo): el marco de su pj es el del carrito, que gira con ry
      var m = Math.sqrt(dx * dx + dz * dz) || 1, cr = Math.cos(cv.ry), sr = Math.sin(cv.ry);
      cv.pj.impacto((dx * cr - dz * sr) / m, (dx * sr + dz * cr) / m, f, { tumbar: 9 });       // sentado: no sale volando, sólo da el latigazo
    }
    function apagon3D(secs) {                                                                         // se fue la luz: chispero que cae del techo del sector
      for (var j = 0; j < secs.length; j++) { var sc = v3.sec[secs[j]]; if (sc) v3.part.soltar(sc.cx, TECHO - .1, sc.cz, 28, { k: 'chispa', cols: ['#ffe14d', '#fffdf2', '#ff8a3d'], vel: 4, arriba: .5, g: 12, vida: .8, esc: .8 }); }
      V3.sfx('error'); V3.sfx('chispa'); v3.esc.sacudir(.4);
    }
    function sobre(pp, alto) {                                                                         // dónde va un aviso encima de un carrito (3D o 2D)
      var ps = posOf(pp);
      if (v3) return v3.esc.proyectar(WX(ps.x), alto, WZ(ps.y));
      return scr(lay(), ps.x, ps.y - alto * 14);
    }
    function taquilla3D() { var p2 = v3.esc.proyectar(TQX, 3.2, TQZ + 1); return { x: p2.x - 30, y: p2.y + 60 }; }   // para la burbuja del de la taquilla
    function dibujar3D(l) {
      var dt = Math.max(0, Math.min(.05, v3T ? at - v3T : 1 / 60)), now = c.ahora(), k, s, f = l.f; v3T = at;   // reloj cosmético: at avanza en update
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0) V3.musica('chocones');
      v3.esc.render(dt);
      for (s = 0; s < 4; s++) {                                                                       // ¡OJO! / SIN LUZ sobre cada sector
        var ph = faseSec(st.k, s); if (ph === 0) continue;
        var pc = v3.esc.proyectar(WX(((s & 1) ? .75 : .25) * FW), PY, WZ(((s & 2) ? .75 : .25) * FH));
        if (ph === 1 && Math.floor(at * 10) % 2 === 0) txt('¡OJO!', pc.x, pc.y, 22, '#ffd23f', 0, true);
        else if (ph === 2) txt('SIN LUZ', pc.x, pc.y, 20, '#8a8aa8', 0, true);
      }
      for (k = 0; k < n; k++) {                                                                       // nombres, la barra del acelerón y ¡SIN LUZ!
        var ps = posOf(k), q = st.p[k], mine = k === c.yo, pana = c.yo >= 0 && c.yo < n && !mine && side[k] === side[c.yo];
        var pt = v3.esc.proyectar(WX(ps.x), PY, WZ(ps.y) + R3 + .55);
        txt(mine ? 'TÚ' : pana ? 'PANA' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 11, mine ? '#ffd23f' : '#fffdf2', 0, true);
        if (mine) { var lista = q.cd === 0 ? 1 : 1 - q.cd / (BOOST_T + BOOST_CD); rr(pt.x - 18, pt.y + 9, 36, 5, 2, INK, 0); rr(pt.x - 17, pt.y + 10, 34 * lista, 3, 1, lista >= 1 ? '#4fd06a' : '#ffd23f', 0); }
        if (faseSec(st.k, sectorOf(ps.x, ps.y)) === 2) txt('¡SIN LUZ!', pt.x, pt.y + (mine ? 24 : 14), 10, '#ffd23f', 0, true);
      }
      if (lv >= 3) { var pl2 = v3.esc.proyectar(WX(st.lo.x), 2.4, WZ(st.lo.y)); txt('¡LOCO!', pl2.x, pl2.y, 11, '#fffdf2', 0, true); }
      for (k = 0; k < fx.length; k++) {                                                               // ¡TOMA! +1 / ¡POR DETRÁS! +2 flotando
        var fq = fx[k]; if (fq.t < 0) continue;
        var pf = v3.esc.proyectar(WX(fq.x), 3 + fq.t * 1.6, WZ(fq.y));
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - fq.t / 0.9); txt(fq.s, pf.x, pf.y, 17 + (fq.t < .15 ? (0.15 - fq.t) * 40 : 0), fq.col, 0, true); ctx.restore();
      }
      marcador(l, taquilla3D());
      if (!c.practica && now > -3 && now < 6 && !finDicho) txt('COLA = 2 · COSTADO = 1 · DE FRENTE = 0', l.cx, 164, 12, '#fffdf2', 0, true);
      void f;
      if (typeof drawP === 'function') drawP();
    }
    function fin3D(s0, s1) {                                                                          // se acabó la ficha: aplausos y confeti sobre el equipo que ganó
      V3.sfx(s0 === s1 ? 'bocina' : 'aplauso');
      for (var j = 0; j < n; j++) if (s0 !== s1 && side[j] === (s0 > s1 ? 0 : 1)) { var cv = v3.cars[j]; v3.part.soltar(cv.g.position.x, 2.6, cv.g.position.z, 30, { k: 'confeti', cols: [sideColor(side[j]), '#fffdf2', '#ffd23f', '#ff5c8a'], vel: 3, arriba: 5, g: 6, vida: 1.6 }); }
      v3.esc.sacudir(.4);
    }
    /* ───────── prueba de estilo: el pixel del tablero de Margarita (?pixel=1, docs/style-lab/fiesta-pixel.js) ───────── */
    var PX = window.FIESTA.PX && FIESTA.PX.on() ? FIESTA.PX : null, fondoPx = null;
    /* carrito girado pixel a pixel: cada pixel del cuadro se lleva al marco del carrito (u = hacia el frente, v = de lado) y se pinta según la zona */
    function carPx(g, x, y, h, col, z, opt) {
      var hx = COS[h], hy = SIN[h], L2 = (RC + 3) * z, W2 = (RC - 3) * z, r = Math.ceil(Math.sqrt(L2 * L2 + W2 * W2)) + 1, dx, dy, cr = Math.max(2, Math.round(W2 * 0.35));
      var luz = PX.tono(col, 0.4), sombra = PX.tono(col, -0.35), asiento = PX.tono(col, -0.5), off = opt && opt.apagado;
      x = Math.round(x); y = Math.round(y);
      function dentro(px, py) { var u = px * hx + py * hy, v = -px * hy + py * hx, au = Math.abs(u), av = Math.abs(v); if (au > L2 || av > W2) return false; return !(au > L2 - cr && av > W2 - cr && (au - L2 + cr) + (av - W2 + cr) > cr); }
      PX.elipse(g, x, y + 3, Math.round(RC * z) + 2, Math.round(RC * z * 0.7), 'rgba(20,16,28,.45)');
      PX.elipse(g, x, y, Math.round(RC * z) + 2, Math.round(RC * z) + 2, INK); PX.elipse(g, x, y, Math.round(RC * z) + 1, Math.round(RC * z) + 1, '#2b2838');   // la goma redonda
      for (dy = -r; dy <= r; dy++) for (dx = -r; dx <= r; dx++) {
        if (!dentro(dx, dy)) continue;
        var u = dx * hx + dy * hy, v = -dx * hy + dy * hx, cc = col;
        if (!dentro(dx + 1, dy) || !dentro(dx - 1, dy) || !dentro(dx, dy + 1) || !dentro(dx, dy - 1)) cc = INK;
        else if (u > L2 - 3 && Math.abs(v) > W2 * 0.3 && Math.abs(v) < W2 * 0.8) cc = '#fffdf2';                   // faros
        else if (u < -L2 + 3 && Math.abs(v) > W2 * 0.3 && Math.abs(v) < W2 * 0.8) cc = off ? '#5a2a2a' : '#ff3b4e';  // luces de atrás
        else if (Math.abs(u + L2 * 0.15) < L2 * 0.35 && Math.abs(v) < W2 * 0.55) cc = asiento;                   // el puesto
        else if (!dentro(dx, dy - 2)) cc = luz; else if (!dentro(dx, dy + 2)) cc = sombra;
        g.fillStyle = cc; g.fillRect(x + dx, y + dy, 1, 1);
      }
      var vx = Math.round(x - hx * L2 * 0.3), vy = Math.round(y - hy * L2 * 0.3);         // la vara al techo y su chispa
      PX.R(g, vx, vy - 14, 1, 14, '#d8d8e8'); PX.R(g, vx + 1, vy - 14, 1, 14, '#8a8aa0');
      if (opt && opt.chispa) { PX.R(g, vx - 1, vy - 17, 3, 3, '#ffe14d'); PX.R(g, vx, vy - 18, 1, 1, '#fffdf2'); PX.R(g, vx + 2, vy - 19, 1, 1, '#fffdf2'); }
    }
    function drawPx() {
      var l = lay(), f = l.f, E = PX.ESC, j, k, kv = st.k, z = l.z / E;
      var BW = Math.ceil((f.x1 - f.x0) / E), BH = Math.ceil(600 / E), g = PX.lienzo(BW, BH), R = function (x, y, w, h, col) { PX.R(g, x, y, w, h, col); };
      var bx = function (x) { return Math.round((l.cx - f.x0) / E + (x - FW / 2) * z); }, by = function (y) { return Math.round(l.cy / E + (y - FH / 2) * z); };
      var sxp = function (X) { return Math.round((X - f.x0) / E); };
      var top = by(0) - 8, suelo = by(FH) + 12;
      /* cielo, sol o estrellas, la rueda de la fortuna y el suelo de tierra (estático: cacheado por tamaño y nivel) */
      var key = BW + 'x' + BH + ':' + lv + ':' + top + ':' + suelo;
      if (!fondoPx || fondoPx.key !== key) {
        var fc = document.createElement('canvas'); fc.width = BW; fc.height = BH; var fg = fc.getContext('2d'), Rf = function (x, y, w, h, col) { PX.R(fg, x, y, w, h, col); };
        Rf(0, 0, BW, BH, pal.cielo);
        for (k = 0; k < 4; k++) PX.trama(fg, 0, top - 60 + k * 14, BW, 1, PX.tono(pal.cielo, -0.1 - k * 0.04), k);   // bandas del cielo hacia el horizonte
        Rf(0, top - 16, BW, 16, PX.tono(pal.cielo, -0.18));
        if (lv === 3) for (k = 0; k < 40; k++) Rf((k * 137) % BW, 4 + (k * 29) % (top - 30), 1, 1, k % 5 ? '#c8c4e8' : '#fffdf2');
        else { var sx0 = lv === 1 ? BW - 40 : 60, sy0 = lv === 1 ? 24 : 46; PX.elipse(fg, sx0, sy0, 13, 13, PX.tono(pal.sol, -0.15)); PX.elipse(fg, sx0, sy0, 12, 12, pal.sol); PX.elipse(fg, sx0 - 3, sy0 - 3, 4, 4, PX.tono(pal.sol, 0.5)); }
        var sueloC = lv === 3 ? '#2a2238' : '#6a5a4a'; Rf(0, suelo, BW, BH - suelo, sueloC);
        for (k = 0; k < BW * (BH - suelo) / 6; k++) Rf((k * 7919) % BW, suelo + (k * 104729) % Math.max(1, BH - suelo), 1, 1, k % 3 ? PX.tono(sueloC, -0.2) : PX.tono(sueloC, 0.15));
        fondoPx = { key: key, cv: fc };
      }
      g.drawImage(fondoPx.cv, 0, 0);
      /* la rueda de la fortuna (gira) */
      var rx = BW - 56, ry = top - 38, rad = 30, ang = at * 0.25;
      PX.linea(g, rx - 20, top, rx, ry, INK); PX.linea(g, rx + 20, top, rx, ry, INK); PX.linea(g, rx - 19, top, rx + 1, ry, '#8a8aa0');
      PX.anillo(g, rx, ry, rad, rad, INK); PX.anillo(g, rx, ry, rad - 1, rad - 1, '#d8d8e8');
      for (k = 0; k < 8; k++) { var a8 = ang + k * Math.PI / 4, kx = rx + Math.cos(a8) * rad, ky = ry + Math.sin(a8) * rad; PX.linea(g, rx, ry, kx, ky, '#8a8aa0'); PX.caja(g, kx - 3, ky - 1, 7, 6, pal.bombillos[k % 4], PX.tono(pal.bombillos[k % 4], 0.4)); }
      R(rx - 2, ry - 2, 5, 5, INK); R(rx - 1, ry - 1, 3, 3, pal.rueda);
      /* la carpa: franjas, banderines y bombillos que corren */
      var ct = top - 18;
      for (k = 0; k * 10 < BW + 10; k++) { R(k * 10, ct, 10, 11, pal.carpa[k % 2]); PX.sprite(g, ['oooooooooo', ' occccccco', '  occccco ', '   occco  ', '    oco   ', '     o    '], { o: INK, c: pal.carpa[k % 2] }, k * 10, ct + 11); }
      R(0, ct, BW, 1, INK); R(0, ct + 1, BW, 1, PX.tono(pal.carpa[1], 0.3));
      for (k = 0; k * 13 < BW; k++) { var on = lv === 3 || ((k + Math.floor(at * 4)) % 3 !== 0), bc = on ? pal.bombillos[k % 4] : '#5a5a6a'; R(k * 13 + 5, ct - 4, 3, 3, INK); R(k * 13 + 6, ct - 3, 1, 1, bc); if (on) R(k * 13 + 5, ct - 3, 1, 1, PX.tono(bc, 0.5)); }
      R(0, ct - 2, BW, 1, '#14101c');
      var titulo = 'CARRITOS CHOCONES', tw = PX.ancho(titulo, 1) + 8, tlx = Math.round(Math.max(sxp(taquilla(l).x) + 24 + tw / 2, BW * 0.3));   // a la izquierda: el centro es del marcador
      PX.caja(g, Math.round(tlx - tw / 2), ct + 2, tw, 9, '#fffdf2'); PX.texto(g, titulo, tlx, ct + 4, INK, 1);
      /* la pista: baranda de goma con franja amarilla, planchas de metal y los 4 sectores */
      var px0 = bx(0), py0 = by(0), pw = bx(FW) - px0, ph = by(FH) - py0;
      PX.caja(g, px0 - 8, py0 - 8, pw + 16, ph + 16, pal.goma, PX.tono(pal.goma, 0.3)); R(px0 - 4, py0 - 4, pw + 8, ph + 8, '#ffd23f'); PX.trama(g, px0 - 4, py0 - 4, pw + 8, ph + 8, PX.tono('#ffd23f', -0.25), 0);
      R(px0 - 2, py0 - 2, pw + 4, ph + 4, pal.goma); R(px0 - 1, py0 - 1, pw + 2, ph + 2, INK); R(px0, py0, pw, ph, pal.piso);
      var p1 = PX.tono(pal.piso, 0.12), p2 = PX.tono(pal.piso, -0.12);
      for (k = 1; k < 10; k++) { R(bx(k * 60), py0, 1, ph, pal.plancha); R(bx(k * 60) + 1, py0, 1, ph, p1); }
      for (k = 1; k < 6; k++) { R(px0, by(k * 57), pw, 1, pal.plancha); R(px0, by(k * 57) + 1, pw, 1, p1); }
      for (k = 0; k < 10; k++) for (var m = 0; m < 6; m++) { R(bx(k * 60) + 3, by(m * 57) + 3, 1, 1, p2); R(bx(k * 60 + 60) - 3, by(m * 57) + 3, 1, 1, p2); }   // remaches de las planchas
      R(bx(FW / 2), py0, 1, ph, pal.techo); R(px0, by(FH / 2), pw, 1, pal.techo);
      for (var s2 = 0; s2 < 4; s2++) {
        var fs = faseSec(kv, s2), sx1 = (s2 & 1) ? bx(FW / 2) + 1 : px0, sy1 = (s2 & 2) ? by(FH / 2) + 1 : py0, sw = Math.round(pw / 2), shh = Math.round(ph / 2);
        if (fs === 1 && Math.floor(at * 10) % 2 === 0) { PX.trama(g, sx1, sy1, sw, shh, '#ffd23f', 0); PX.texto(g, '¡OJO!', sx1 + sw / 2, sy1 + shh / 2 - 5, INK, 2, '#ffd23f'); }
        else if (fs === 2) { PX.trama(g, sx1, sy1, sw, shh, '#05040a', 0); PX.trama(g, sx1, sy1, sw, shh, '#05040a', 1); PX.trama(g, sx1, sy1 + 1, sw, shh - 1, PX.tono(pal.piso, -0.6), 0); PX.texto(g, 'SIN LUZ', sx1 + sw / 2, sy1 + shh / 2 - 3, '#8a8aa8', 1, INK); }
      }
      for (j = 0; j < cones.length; j++) {                                                // conos de goma
        var cxp = bx(cones[j][0]), cyp = by(cones[j][1]);
        PX.elipse(g, cxp, cyp + 3, 7, 2, 'rgba(20,16,28,.45)');
        PX.sprite(g, ['   o   ', '  oko  ', '  oko  ', ' owwwo ', ' okkko ', 'okkkkko', 'ooooooo'], { o: INK, k: '#ff8a1f', w: '#fffdf2' }, cxp - 3, cyp - 6);
      }
      for (j = 0; j < PADS.length; j++) { var ppx = bx(PADS[j][0]), ppy = by(PADS[j][1]), prx = Math.max(3, Math.round(RPAD * z / E)); PX.elipse(g, ppx, ppy, prx, Math.round(prx * 0.8), '#ffd23f'); PX.elipse(g, ppx, ppy, Math.round(prx * 0.55), Math.round(prx * 0.44), Math.floor(at * 5) % 2 ? '#fffdf2' : INK); }
      if (kv >= oilT - 24) for (j = 0; j < OIL.length; j++) { var orx = Math.max(3, Math.round(OIL[j][2] * z / E)); PX.elipse(g, bx(OIL[j][0]), by(OIL[j][1]), orx, Math.round(orx * 0.8), '#0c0a16'); PX.elipse(g, bx(OIL[j][0]) - 2, by(OIL[j][1]) - 1, Math.round(orx * 0.35), Math.max(1, Math.round(orx * 0.2)), '#6a5cd8'); }
      var insP = insetAt(kv); if (insP > 0) { var iw = Math.max(2, Math.round(insP * z / E)), hz2 = Math.floor(at * 6) % 2 ? '#ff8a1f' : '#ffd23f'; R(px0, py0, pw, iw, hz2); R(px0, py0 + ph - iw, pw, iw, hz2); R(px0, py0, iw, ph, hz2); R(px0 + pw - iw, py0, iw, ph, hz2); }
      /* carritos y el loco, ordenados por y */
      var ord = []; for (j = 0; j < n; j++) ord.push(j);
      ord.sort(function (a, b) { return posOf(a).y - posOf(b).y || a - b; });
      function locoPx() { if (lv < 3) return; var L = st.lo, xl = bx(L.x), yl = by(L.y); carPx(g, xl, yl, angOf(L.vx, L.vy), '#b07ac9', z, { chispa: Math.floor(at * 9) % 3 === 0 }); PX.texto(g, '¡LOCO!', xl, yl - 26, '#fffdf2', 1, INK); }
      var ldone = false;
      for (j = 0; j < ord.length; j++) {
        var pp = ord[j]; if (!ldone && lv >= 3 && posOf(pp).y > st.lo.y) { locoPx(); ldone = true; }
        var q = st.p[pp], ps = posOf(pp), s = asiento(pp), tc = sideColor(side[pp]), h = ps.h === undefined ? q.h : ps.h, xx = bx(ps.x), yy = by(ps.y);
        var mine = pp === c.yo, pana = c.yo >= 0 && c.yo < n && !mine && side[pp] === side[c.yo], off = faseSec(kv, sectorOf(ps.x, ps.y)) === 2;
        if (q.bst > 0 || (mine && boostFx > 0)) for (k = 1; k < 4; k++) R(Math.round(xx - COS[h] * (10 + k * 4)), Math.round(yy - SIN[h] * (10 + k * 4)), 4 - k, 4 - k, k === 1 ? '#fffdf2' : '#ffd23f');   // estela del acelerón
        if (q.imm > 0 && Math.floor(at * 16) % 2 === 0) continue;                          // inmune: parpadea (sin transparencia)
        carPx(g, xx, yy, h, tc, z, { apagado: off, chispa: !off && Math.floor(at * 7 + pp * 3) % 5 === 0 });
        PX.cabeza(g, s.ch, colorDeAsiento(pp), xx + (q.stun > 0 ? Math.round(Math.sin(at * 30)) : 0), yy - 9);
        var lista = q.cd === 0 ? 1 : 1 - q.cd / (BOOST_T + BOOST_CD), rr2 = Math.round(RC * z) + 4;
        if (mine) { PX.anillo(g, xx, yy, rr2, rr2, '#ffd23f'); R(xx - 9, yy + rr2 + 3, 19, 4, INK); R(xx - 8, yy + rr2 + 4, Math.round(17 * lista), 2, lista >= 1 ? '#4fd06a' : '#ffd23f'); }
        if (q.stun > 0) for (k = 0; k < 3; k++) { var an = at * 9 + k * 2.1; R(xx + Math.round(Math.cos(an) * 8), yy - 15 + Math.round(Math.sin(an) * 2), 2, 2, '#ffd23f'); }
        if (mine) PX.sprite(g, ['ooooooo', ' oyyyo ', '  oyo  ', '   o   '], { o: INK, y: '#ffd23f' }, xx - 3, yy - 23 - (Math.floor(at * 3) % 2));
        else if (pana) PX.texto(g, 'PANA', xx, yy - 22, '#fffdf2', 1, INK);
        if (off) PX.texto(g, '¡SIN LUZ!', xx, yy + rr2 + 3, '#ffd23f', 1, INK);
      }
      if (!ldone) locoPx();
      for (j = 0; j < fx.length; j++) { var fq = fx[j]; if (fq.t < 0) continue; if (fq.t > 0.6 && Math.floor(at * 20) % 2) continue;
        if (fq.t < 0.3) { var fr = 6 + Math.round(fq.t * 50 * z); PX.anillo(g, bx(fq.x), by(fq.y), fr, Math.round(fr * 0.7), '#fffdf2'); }
        PX.texto(g, fq.s, bx(fq.x), by(fq.y) - 26 - Math.round(fq.t * 16), fq.col, 1, INK); }
      /* la taquilla con el señor del micrófono */
      var tq = taquilla(l), tx = sxp(tq.x), ty = Math.round(tq.y / E);
      PX.caja(g, tx - 20, ty - 17, 40, 28, '#ffb36b', PX.tono('#ffb36b', 0.4), PX.tono('#ffb36b', -0.3)); PX.caja(g, tx - 15, ty - 12, 30, 13, '#3a3858');
      PX.cabeza(g, 'tio', '#5cd27a', tx, ty - 11); R(tx + 5, ty - 6, 2, 4, INK);       // el micrófono
      PX.texto(g, 'FICHAS', tx, ty + 3, INK, 1);
      /* marcador */
      var mx = Math.round((l.cx - f.x0) / E), s0 = teamScore(0), s1 = teamScore(1), my = 46;
      PX.caja(g, mx - 37, my, 74, 22, '#1a2238', '#3a4a78', '#0c1020'); R(mx - 35, my + 2, 3, 18, sideColor(0)); R(mx + 32, my + 2, 3, 18, sideColor(1));
      PX.texto(g, String(s0), mx - 17, my + 6, '#fffdf2', 2, INK); PX.texto(g, '-', mx, my + 6, '#ffd23f', 2); PX.texto(g, String(s1), mx + 17, my + 6, '#fffdf2', 2, INK);
      if (st.k >= regT && s0 === s1) PX.texto(g, 'MUERTE SÚBITA · ' + Math.max(0, Math.ceil((durT - st.k) / TK)) + ' S', mx, my + 25, '#ff8a8a', 1, INK);
      else PX.texto(g, Math.max(0, Math.ceil((regT - st.k) / TK)) + ' S', mx, my + 25, '#fffdf2', 1, INK);
      if (bannerT > 0 && banner) { var bs = Math.max(1, Math.min(3, Math.floor((BW - 16) / (PX.ancho(banner.s, 1) + 1)))); PX.texto(g, banner.s, mx, Math.round(l.cy / E) - 4 * bs, banner.col, bs, INK); }
      if (bubT > 0 && bub) { var bw2 = PX.ancho(bub.s, 1) + 10; PX.caja(g, tx - 8, ty + 17, bw2, 11, '#fffdf2'); PX.sprite(g, ['  o', ' ow', 'oww'], { o: INK, w: '#fffdf2' }, tx - 4, ty + 15); PX.texto(g, bub.s, tx - 8 + bw2 / 2, ty + 20, INK, 1); }   // bajo la taquilla: arriba lo tapa el HUD
      if (c.ahora() >= -0.4 && c.ahora() < 2 && !c.practica) PX.texto(g, '¡A CHOCAR!', mx, Math.round(l.cy / E), '#fffdf2', 2, INK);
      /* las partículas y los letreros flotantes del motor (spawn/say), en pixel dentro del mismo lienzo (drawP no se llama) */
      if (typeof PT !== 'undefined') for (j = 0; j < PT.length; j++) {
        var pt = PT[j], ptx = Math.round((pt.x - f.x0) / E), pty = Math.round(pt.y / E);
        if (1 - pt.t / pt.life < 0.3 && Math.floor(at * 20) % 2) continue;
        if (pt.kind === 'conf' || pt.kind === 'bit' || pt.kind === 'feather') { R(ptx - 1, pty - 1, 3, 3, INK); R(ptx, pty, 1, 1, pt.col); if (Math.floor(pt.rot) % 2) R(ptx - 1, pty, 3, 1, pt.col); }
        else if (pt.kind === 'bill') { R(ptx - 3, pty - 2, 7, 4, INK); R(ptx - 2, pty - 1, 5, 2, '#5cd06a'); }
        else PX.texto(g, pt.kind, ptx, pty - 3, pt.col || '#fffdf2', 1, INK);
      }
      var shx = Math.round(Math.sin(at * 90) * shake * 1.5) * E, shy = Math.round(Math.cos(at * 77) * shake * 1.5) * E;
      PX.volcar(ctx, f.x0 + shx, shy);
    }
    function colorDeAsiento(pp) { var s = asiento(pp); return s.color || sideColor(side[pp]); }
    function draw() {
      if (PX) return drawPx();
      if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
      if (v3) return dibujar3D(lay());
      dibujar2D();
    }
    function dibujar2D() {                                                                // el 2D de siempre (sin WebGL o con ?plano=1)
      var l = lay(), j, kv = st.k;
      var sx = Math.sin(at * 90) * shake * 3, sy = Math.cos(at * 77) * shake * 3;
      ctx.save(); ctx.translate(sx, sy);
      fondo(l);
      var tq = taquilla(l);                                                         // la taquilla con el señor del micrófono
      rr(tq.x - 40, tq.y - 34, 80, 56, 6, '#ffb36b', 3); rr(tq.x - 30, tq.y - 24, 60, 26, 4, '#3a3858', 2.5);
      c.util.pj('tio', tq.x, tq.y - 28, 30, { sombra: false });
      txt('FICHAS', tq.x, tq.y + 12, 10, INK, 0, true);
      ctx.save(); ctx.translate(l.cx, l.cy); ctx.scale(l.z, l.z); ctx.translate(-FW / 2, -FH / 2);
      pista(l, apagAt(kv));
      for (j = 0; j < cones.length; j++) cono(cones[j][0], cones[j][1]);
      var ord = []; for (j = 0; j < n; j++) ord.push(j);
      ord.sort(function (a, b) { return posOf(a).y - posOf(b).y || a - b; });
      var ldone = false;
      for (j = 0; j < ord.length; j++) { if (!ldone && lv >= 3 && posOf(ord[j]).y > st.lo.y) { loco(); ldone = true; } carrito(ord[j], l, kv); }
      if (!ldone) loco();
      for (j = 0; j < fx.length; j++) { var fq = fx[j]; if (fq.t < 0) continue; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - fq.t / 0.9); if (fq.t < 0.3) ell(fq.x, fq.y, 14 + fq.t * 120, 10 + fq.t * 80, '#fffdf2', 0); txt(fq.s, fq.x, fq.y - 44 - fq.t * 36, 16, fq.col, 0, true); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      marcador(l, tq);
      if (typeof drawP === 'function') drawP();
    }
    function marcador(l, tq) {                                                            // marcador, cartel grande, la burbuja del de la taquilla y ¡A CHOCAR! (2D y 3D)
      var f = l.f, cx = l.cx, s0 = teamScore(0), s1 = teamScore(1), top = 92;
      rr(cx - 74, top, 148, 44, 12, '#14101c', 3); rr(cx - 70, top + 4, 6, 36, 3, sideColor(0), 0); rr(cx + 64, top + 4, 6, 36, 3, sideColor(1), 0);
      txt(String(s0), cx - 34, top + 22, 32, '#fffdf2', 0, true); txt('-', cx, top + 22, 26, '#ffd23f', 0, true); txt(String(s1), cx + 34, top + 22, 32, '#fffdf2', 0, true);
      if (st.k >= regT && s0 === s1) txt('MUERTE SÚBITA · ' + Math.max(0, Math.ceil((durT - st.k) / TK)) + ' s', cx, top + 54, 13, '#ff8a8a', 0, true);
      else txt(Math.max(0, Math.ceil((regT - st.k) / TK)) + ' s', cx, top + 54, 12, '#fffdf2', 0, true);
      if (bannerT > 0 && banner) { var pz = 1 + Math.sin(at * 16) * 0.05; txt(banner.s, cx, l.cy - 14, Math.min(34, 0.92 * (f.x1 - f.x0) / (0.8 * banner.s.length + 1)) * pz, banner.col, 0, true); }
      if (bubT > 0 && bub) { var bw = 186; rr(tq.x + 30, tq.y - 70, bw, 28, 10, '#fffdf2', 2.5); poly([[tq.x + 40, tq.y - 43], [tq.x + 54, tq.y - 43], [tq.x + 30, tq.y - 30]], '#fffdf2', 0); txt(bub.s, tq.x + 30 + bw / 2, tq.y - 56, 12, INK, 0, true); }
      if (c.ahora() >= -0.4 && c.ahora() < 2 && !c.practica) txt('¡A CHOCAR!', cx, l.cy + 4, 24, '#fffdf2', 0, true);
    }

    function chocador() { var j, bj = -1, bv = 0; for (j = 0; j < n; j++) if (st.p[j].sc > bv) { bv = st.p[j].sc; bj = j; } return bj; }
    return {
      update: update, draw: draw, ai: ai,
      step: step, pack: pack, unpack: load, restore: load, lerp: lerp, predict: predict,
      scores: function () { var a = [], j; for (j = 0; j < n; j++) a.push(st.p[j].sc); return a; },
      done: function () { return st.k >= regT && teamScore(0) !== teamScore(1); },
      vivo: function () { return true; },
      alCpu: function (pp) { if (cpr[pp]) { cpr[pp].next = 0; cpr[pp].tg = -1; } }, alHum: function () {},
      hudChip: function (pp) { if (pp < 0 || pp >= n) return null; return apagado(pp) ? 'SIN LUZ' : st.p[pp].stun > 0 ? '¡MAREADO!' : null; },
      destacado: function () {
        var s0 = teamScore(0), s1 = teamScore(1), b = chocador();
        if (s0 + s1 === 0) return '0 – 0: ni un coñacito, puro paseo';
        return '¡' + s0 + ' – ' + s1 + '! El más chocón: ' + asiento(b).name + ' (' + st.p[b].hits + ' golpes, ' + st.p[b].rear + ' por detrás)';
      },
      vista: function () {
        var o = { k: st.k, durT: durT, regT: regT, lv: lv, golpes: st.golpes, ev: st.ev, sc: [teamScore(0), teamScore(1)], gs: [], side: side.slice(), equipos: teams.slice(), mate: mate.slice(),
          apag: apag.map(function (a) { return { t: a.t, s: a.s.slice() }; }), cones: cones.map(function (q) { return q.slice(); }), loco: { x: st.lo.x, y: st.lo.y, vx: st.lo.vx, vy: st.lo.vy },
          cap: capAt(st.k), lag: lagEst < 0 ? -1 : lagEst * 0.5, mp: mp ? { x: mp.x, y: mp.y, h: mp.h } : null,
          x: [], y: [], vx: [], vy: [], h: [], stun: [], imm: [], bst: [], cd: [], hits: [], rear: [], off: [] }, j;
        for (j = 0; j < n; j++) { var q = st.p[j]; o.gs.push(q.sc); o.x.push(q.x); o.y.push(q.y); o.vx.push(q.vx); o.vy.push(q.vy); o.h.push(q.h); o.stun.push(q.stun); o.imm.push(q.imm); o.bst.push(q.bst); o.cd.push(q.cd); o.hits.push(q.hits); o.rear.push(q.rear); o.off.push(apagado(j) ? 1 : 0); }
        return o;
      }
    };
  }
});
})();
