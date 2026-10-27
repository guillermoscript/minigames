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
        var off = faseSec(k, sectorOf(q.x, q.y)) === 2, fr = FRIC, acc = 0;
        if (q.stun > 0) { q.stun--; q.h = (q.h + SPIN) % HD; q.bst = 0; }
        else if (off) { q.bst = 0; fr = FRIC_OFF; }
        else {
          if (len > 0.25) { var dd = dAng(q.h, angOf(ex, ey)); q.h = (q.h + cl(dd, -TURN, TURN) + HD) % HD; acc = ACC * Math.min(1, (len - 0.25) / 0.6); }
          if (tapN > 0 && q.cd === 0) { q.bst = BOOST_T; q.cd = BOOST_T + BOOST_CD; }
          if (q.bst > 0) { acc = ACC_B; q.bst--; }
        }
        q.pw = acc > 0 ? PW : q.pw > 0 ? q.pw - 1 : 0;
        var hx = COS[q.h], hy = SIN[q.h], fw = q.vx * hx + q.vy * hy, la = -q.vx * hy + q.vy * hx;
        fw = (fw + acc) * fr; la *= q.stun > 0 || off ? 0.93 : GRIP;
        q.vx = hx * fw - hy * la; q.vy = hy * fw + hx * la;
        var vm = q.bst > 0 ? VMAX_B : VMAX, sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy);
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
        if (q.x < RC) { q.x = RC; if (q.vx < 0) q.vx = -q.vx * REST_W; } else if (q.x > FW - RC) { q.x = FW - RC; if (q.vx > 0) q.vx = -q.vx * REST_W; }
        if (q.y < RC) { q.y = RC; if (q.vy < 0) q.vy = -q.vy * REST_W; } else if (q.y > FH - RC) { q.y = FH - RC; if (q.vy > 0) q.vy = -q.vy * REST_W; }
      }
      if (lv >= 3) {
        for (var cj = 0; cj < cones.length; cj++) {
          dx = L.x - cones[cj][0]; dy = L.y - cones[cj][1]; d = Math.sqrt(dx * dx + dy * dy);
          if (d < RL + RCONE) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } var ux = dx / d, uy = dy / d, ln = L.vx * ux + L.vy * uy; L.x = cones[cj][0] + ux * (RL + RCONE); L.y = cones[cj][1] + uy * (RL + RCONE); if (ln < 0) { L.vx -= 2 * ln * ux; L.vy -= 2 * ln * uy; } }
        }
        if (L.x < RL) { L.x = RL; L.vx = Math.abs(L.vx); } else if (L.x > FW - RL) { L.x = FW - RL; L.vx = -Math.abs(L.vx); }
        if (L.y < RL) { L.y = RL; L.vy = Math.abs(L.vy); } else if (L.y > FH - RL) { L.y = FH - RL; L.vy = -Math.abs(L.vy); }
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
        var acc = 0;
        if (len > 0.25) { mp.h = (mp.h + Math.round(cl(dAng(mp.h, angOf(ax, ay)), -TURN * f, TURN * f)) + HD) % HD; acc = ACC * Math.min(1, (len - 0.25) / 0.6); }
        if (a.bst > 0 || boostFx > 0) acc = ACC_B;
        var hx = COS[mp.h], hy = SIN[mp.h], fw = mp.vx * hx + mp.vy * hy, la = -mp.vx * hy + mp.vy * hx;
        fw = (fw + acc * f) * Math.pow(FRIC, f); la *= Math.pow(GRIP, f);
        mp.vx = hx * fw - hy * la; mp.vy = hy * fw + hx * la;
        var sp = Math.sqrt(mp.vx * mp.vx + mp.vy * mp.vy), vm = (a.bst > 0 || boostFx > 0) ? VMAX_B : VMAX; if (sp > vm) { mp.vx *= vm / sp; mp.vy *= vm / sp; }
        mp.x = cl(mp.x + mp.vx * f, RC, FW - RC); mp.y = cl(mp.y + mp.vy * f, RC, FH - RC);
      }
      var tgt = adelanta(a, t), dx = tgt.x - mp.x, dy = tgt.y - mp.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 70) { mp.x = tgt.x; mp.y = tgt.y; mp.vx = a.vx; mp.vy = a.vy; mp.h = a.h; }
      else if (d > 14) { var m = Math.min(4, d - 14) / d; mp.x += dx * m; mp.y += dy * m; }
      if (Math.abs(dAng(mp.h, a.h)) > 200) mp.h = a.h;
    }
    function posOf(pp) { if (pp === c.yo && !isJudge() && mp) return mp; return st.p[pp]; }

    /* ───────────────────────── presentación ───────────────────────── */
    var at = 0, banner = null, bannerT = 0, shake = 0, fx = [], prevGolpes = 0, prevAp = -1, prevSd = false, finDicho = false, boostFx = 0, prevA = false, bubT = 0, bub = null;
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
        if (ha && !prevA && q0.cd === 0 && q0.stun === 0 && boostFx <= 0) { boostFx = BOOST_T / TK; SND(220, 0.25, 'sawtooth', 0.05, 260); }
        prevA = ha;
      }
      var apId = ap.ph > 0 ? ap.j * 4 + ap.ph : -1;
      if (apId !== prevAp) {
        if (ap.ph === 1) { banr('¡SE VA LA LUZ!', '#ffd23f', 1.2); SND(880, 0.08, 'square', 0.04, 0); SND(660, 0.1, 'square', 0.04, 0); }
        else if (ap.ph === 2) { SND(120, 0.4, 'sawtooth', 0.06, -60); bub = { s: '¡Corpoelec, otra vez!' }; bubT = 1.8; }
        prevAp = apId;
      }
      if (st.golpes !== prevGolpes) {
        var ev = st.ev, a = (ev & 7) - 1, b = (ev >> 3) & 3, pts = (ev >> 5) & 7, rear = (ev >> 8) & 1, off = (ev >> 9) & 1;
        if (a >= 0 && a < n && b < n) {
          var vb = posOf(b), sp0 = scr(L, vb.x, vb.y);
          fx.push({ x: vb.x, y: vb.y, t: 0, s: (rear ? '¡POR DETRÁS!' : '¡TOMA!') + ' +' + pts, col: sideColor(side[a]) });
          if (off) fx.push({ x: vb.x, y: vb.y + 26, t: -0.15, s: '¡APAGADO!', col: '#ffd23f' });
          SPAWN(sp0.x, sp0.y, rear ? 14 : 8, 'bit', ['#ffd23f', '#fffdf2', '#5cb8ff'], 260, 260, 0.5);
          SND(rear ? 140 : 190, 0.16, 'square', 0.09, -60); shake = Math.max(shake, rear ? 0.9 : 0.5);
          if (a === c.yo && rear) S('¡Por detrás, como en la cola del banco!', sp0.x, sp0.y - 40, '#fffdf2');
        }
        prevGolpes = st.golpes;
      }
      var s0 = teamScore(0), s1 = teamScore(1), sdNow = st.k >= regT && s0 === s1;
      if (sdNow && !prevSd) { banr('¡MUERTE SÚBITA!', '#ff5c5c', 2.2); SND(330, 0.4, 'square', 0.07, -120); }
      prevSd = sdNow;
      if (!finDicho && (st.k >= durT - 1 || (st.k >= regT && s0 !== s1))) { finDicho = true; var tq = taquilla(L); S('¡Se acabó la ficha, mi amor!', tq.x + 40, tq.y - 30, '#fffdf2'); banr(s0 === s1 ? '¡EMPATE!' : '¡GANÓ EL EQUIPO ' + sideName(s0 > s1 ? 0 : 1) + '!', s0 === s1 ? '#ffd23f' : sideColor(s0 > s1 ? 0 : 1), 3); }
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
      void ap;
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
    function draw() {
      var l = lay(), f = l.f, j, kv = st.k;
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
      /* marcador */
      var cx = l.cx, s0 = teamScore(0), s1 = teamScore(1), top = 92;
      rr(cx - 74, top, 148, 44, 12, '#14101c', 3); rr(cx - 70, top + 4, 6, 36, 3, sideColor(0), 0); rr(cx + 64, top + 4, 6, 36, 3, sideColor(1), 0);
      txt(String(s0), cx - 34, top + 22, 32, '#fffdf2', 0, true); txt('-', cx, top + 22, 26, '#ffd23f', 0, true); txt(String(s1), cx + 34, top + 22, 32, '#fffdf2', 0, true);
      if (st.k >= regT && s0 === s1) txt('MUERTE SÚBITA · ' + Math.max(0, Math.ceil((durT - st.k) / TK)) + ' s', cx, top + 54, 13, '#ff8a8a', 0, true);
      else txt(Math.max(0, Math.ceil((regT - st.k) / TK)) + ' s', cx, top + 54, 12, '#fffdf2', 0, true);
      if (bannerT > 0 && banner) { var pz = 1 + Math.sin(at * 16) * 0.05; txt(banner.s, cx, l.cy - 14, Math.min(34, 0.92 * (f.x1 - f.x0) / (0.8 * banner.s.length + 1)) * pz, banner.col, 0, true); }
      if (bubT > 0 && bub) { var bw = 186; rr(tq.x + 30, tq.y - 70, bw, 28, 10, '#fffdf2', 2.5); poly([[tq.x + 40, tq.y - 43], [tq.x + 54, tq.y - 43], [tq.x + 30, tq.y - 30]], '#fffdf2', 0); txt(bub.s, tq.x + 30 + bw / 2, tq.y - 56, 12, INK, 0, true); }
      if (c.ahora() >= -0.4 && c.ahora() < 2 && !c.practica) txt('¡A CHOCAR!', cx, l.cy + 4, 24, '#fffdf2', 0, true);
      if (typeof drawP === 'function') drawP();
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
