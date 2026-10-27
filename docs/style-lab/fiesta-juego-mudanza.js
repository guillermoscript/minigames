'use strict';
/* LA FIESTA · EN VIVO · f_mudanza · ¡LA MUDANZA!  (2v2 cooperativo, modelo C: el juez integra el sofá de cada equipo con el stick de los dos que lo cargan)
   La escalera pintada de un barrio de Caracas, de abajo hacia arriba y vista desde arriba. Cada equipo sube SU escalera (dos carriles lado a lado, sin contacto
   entre equipos); arriba espera la tía en la puerta: «¡Cuidado con mi sofá!». No hay camión que suba: todo va a pulso.
     · El sofá es una BARRA RÍGIDA de largo fijo entre los dos panas: el primer asiento del equipo carga la punta de ADELANTE, el segundo la de ATRÁS. Cada uno mueve SU punta con el
       stick; tras mover las dos puntas el juez reproyecta la barra a su largo (reparto por peso: punta que camina 1, punta quieta o soltada 0,5 = se ARRASTRA). Tirar para lados
       contrarios no avanza (se ve forcejear: «¡Pa' tu lado! ¡No, pa' TU lado!»); una punta sola arrastra el sofá a 1/3 de la velocidad.
     · Callejones en L: el sofá solo pasa la curva si uno se adelanta y el otro gira detrás. La validez es la barra entera (15 muestras) dentro del pasillo encogido por el grosor.
     · A mantenido = ¡ARRIBA! (esa punta levantada va a la mitad de velocidad). TENDEDEROS: la barra cruza la cuerda solo si los DOS mantienen A; si no, es pared.
     · ¡RAYÓN!: si la barra pega (pared o tendedero) y, resbalando, avanza menos de la mitad de lo que pedían, el sofá se detiene 0,4 s y la tía grita; 0,6 s de gracia después. Los rayones no sacan:
       demoran. Rozar en diagonal resbala sin rayón.
     · EL PERRO DE LA VECINA (Nv2+) cruza un escalón de pared a pared: si toca a uno, ese suelta su punta 0,6 s (el sofá se arrastra).
     · LA MOTO QUE BAJA (Nv2+): aviso 1,5 s con la franja marcada; baja por media escalera (lado sembrado): si toca el sofá, ¡RAYÓN! de 0,9 s. Hay que pegarse a la otra pared.
   Simetría: los dos carriles son LA MISMA escalera espejada. La física corre en coordenadas canónicas del carril (el carril derecho niega la x del stick al entrar y se dibuja espejado),
   así que dos equipos con entradas espejadas quedan en estados idénticos. Escalera, tendederos, perro y moto salen de c.rng en mk (iguales para los dos equipos).
   Puntaje (binary, igual para los dos panas): llegar primero = SMAX, llegar después = SMAX−1, si no = progreso 0..SMAX−2 (escalones del centro del sofá sobre la línea de la escalera).
   SMAX = 100 se recorta a min(100, 7·(min(15, dur−1)+1,5)): ningún asiento pasa del tope del servidor min(scoreMax, scoreRate·(t+1,5)) en ningún fin posible (finTemprano: 2 s tras la
   primera llegada, nunca antes de minT 15). compara() suma por equipo: los dos panas valen lo mismo, simétrico.
   Niveles: 1 día, 2 curvas y 1 tendedero · 2 atardecer, 3 curvas, 2 tendederos, el perro y la moto · 3 noche, 4 curvas, tendederos, perro, moto y el sofá más largo
   («ahora es el juego de comedor»). Cada nivel con 3 variantes de escalera (largos de tramo) elegidas por semilla.
   CPU: sigue una LÍNEA GUÍA precalculada por escalera (una pasada de planificador en mk con la misma física, cacheada por nivel y variante): cada punta CPU persigue su punta de la guía
   unos ticks adelante; con pana humano la CPU se alinea cada tick a la punta del humano (el índice de la guía pesa 3:1 su punta), y sus correcciones de puntería y despistes van
   con el retraso de reacción de su skill. Levanta en tendederos con acierto 0,65+0,3·skill (si falla, levanta tras el rayón);
   se corre a la pared segura con la moto; se distrae a veces (1−skill). Si se traba, retrocede por la guía.
   Estado entero: pack() = 34 enteros (posiciones en 1/4 px). Pantallas que no son el juez: interpolan (lerp) y adelantan su propio sofá con el stick propio el retraso de la vista.
   Sin tipos x*: todo viaja en el snapshot. La ventaja del juez es solo de respuesta (no hay contacto entre equipos). Dibujo solo con rr/ell/line/poly/txt + c.util.pj. Sin Math.random/Date.now.
   Medido en docs/style-lab/pruebas/fiesta-mudanza-bench.js y test/fiesta-juego-mudanza.test.js. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_mudanza')) return;

var TK = 30, MAXP = 4, LW = 300, CW = 76, MG = 9, NS = 15, X1 = 80;
var SPD = 84 / TK, UPF = 0.5, WIDLE = 0.5;                       // px/tick por punta · levantada a la mitad · peso de la punta quieta/soltada (arrastre a 1/3)
var RAY_STOP = 12, RAY_IMM = 18, RAY_MIN = 0.9;                   // ¡RAYÓN!: 0,4 s quieto, 0,6 s de gracia; solo si lo pedido pasa de 0,9 px/tick
var DROP = 18, DROP_IMM = 30, DOG_R = 17, DOG_OUT = 44;           // el perro: suelta la punta 0,6 s
var MOTO_WARN = 45, MOTO_V = 7, MOTO_R = 21, MOTO_STOP = 27, MOTO_OFF = CW / 4;
var SMAX = 100, RATE = 7, MINT = 15, FIN_GRACIA = 60, LOOK = 6;
var LSOFA = [100, 100, 124];
/* escaleras (coordenadas canónicas del carril izquierdo; y crece hacia abajo, se sube hacia y menor): u = sube, r/l = descanso a la derecha/izquierda */
var LAY = {
  1: [[['u', 500], ['r', 140], ['u', 720]], [['u', 460], ['r', 130], ['u', 760]], [['u', 540], ['r', 150], ['u', 680]]],
  2: [[['u', 420], ['r', 140], ['u', 520], ['l', 140]], [['u', 390], ['r', 130], ['u', 550], ['l', 150]], [['u', 450], ['r', 150], ['u', 490], ['l', 130]]],
  3: [[['u', 320], ['r', 140], ['u', 340], ['l', 140], ['u', 340]], [['u', 300], ['r', 150], ['u', 360], ['l', 130], ['u', 340]], [['u', 340], ['r', 130], ['u', 320], ['l', 150], ['u', 340]]]
};
var TEND = { 1: [[2, 0.35, 0.55]], 2: [[0, 0.6, 0.72], [2, 0.55, 0.7]], 3: [[0, 0.62, 0.75], [4, 0.45, 0.6]] };   // [tramo, fracción mín, máx]
var PERRO = { 1: null, 2: [2, 0.22, 40], 3: [2, 0.5, 30] };                                                  // [tramo, fracción, ticks que tarda en cruzar]
var INK = '#14101c', COL_EQ = ['#2f6fdb', '#d93a3a'], NOM_EQ = ['AZUL', 'ROJO'], SOFA_EQ = [['#3f7fe0', '#2a5cb0'], ['#e04848', '#a83030']];
var PAL = [   // día / atardecer / noche
  { cielo: '#8fd8ff', cerro: '#5fa04a', muro: ['#f2a65a', '#7fc8a9', '#f4d35e', '#e86a92', '#6aa9e8', '#c9a0e8'], esc: ['#e85d75', '#ffd166', '#06d6a0', '#4cc9f0', '#f78c6b'], desc: '#cfc6b0', borde: '#6b5a48', ventana: '#3a5a7a', luz: false },
  { cielo: '#ff9a62', cerro: '#7a6a3a', muro: ['#d08a4a', '#6aa88a', '#d4b34e', '#c85a7a', '#5a89c8', '#a080c8'], esc: ['#c84d65', '#e0b156', '#05b690', '#3ca9d0', '#d77c5b'], desc: '#b8a890', borde: '#5a4838', ventana: '#4a3a5a', luz: false },
  { cielo: '#1d1a4a', cerro: '#24304a', muro: ['#6a4a3a', '#3a5a5a', '#6a6a3a', '#6a3a4a', '#3a4a6a', '#5a4a6a'], esc: ['#7a3a4a', '#8a7a3a', '#2a6a5a', '#2a5a7a', '#7a4a3a'], desc: '#5a5868', borde: '#2a2430', ventana: '#ffd96a', luz: true }
];
var DIRS = [[0, 0], [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
function q4(v) { return Math.round(v * 4) / 4; }
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S_(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }

/* ───────────────────────── geometría y física (puras: la usan el juez, la guía y las pruebas) ───────────────────────── */
function layout(lv, v) {
  var spec = LAY[lv][v], H = 80, i, h = CW / 2 - MG;
  for (i = 0; i < spec.length; i++) if (spec[i][0] === 'u') H += spec[i][1];
  var pts = [[X1, H - 40]], x = X1, y = H - 40;
  for (i = 0; i < spec.length; i++) { var d = spec[i][0], l = spec[i][1]; if (d === 'u') y -= l; else if (d === 'r') x += l; else x -= l; pts.push([x, y]); }
  var rects = [], full = [], segs = [], s = 0;
  for (i = 0; i + 1 < pts.length; i++) {
    var a = pts[i], b = pts[i + 1], len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    rects.push([Math.min(a[0], b[0]) - h, Math.min(a[1], b[1]) - h, Math.max(a[0], b[0]) + h, Math.max(a[1], b[1]) + h]);
    full.push([Math.min(a[0], b[0]) - CW / 2, Math.min(a[1], b[1]) - CW / 2, Math.max(a[0], b[0]) + CW / 2, Math.max(a[1], b[1]) + CW / 2]);
    segs.push({ ax: a[0], ay: a[1], dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len, len: len, s0: s, d: spec[i][0] }); s += len;
  }
  return { lv: lv, v: v, pts: pts, rects: rects, full: full, segs: segs, L: s, H: H };
}
function inside(L, x, y) { var r = L.rects, i; for (i = 0; i < r.length; i++) if (x >= r[i][0] && x <= r[i][2] && y >= r[i][1] && y <= r[i][3]) return true; return false; }
function proj(L, x, y) {                                    // punto más cercano de la línea de la escalera: s (arco) y o (desvío lateral, + a la derecha de la marcha)
  var best = 1e18, bs = 0, bo = 0, i, g;
  for (i = 0; i < L.segs.length; i++) {
    g = L.segs[i];
    var t = (x - g.ax) * g.dx + (y - g.ay) * g.dy; t = t < 0 ? 0 : t > g.len ? g.len : t;
    var px = g.ax + g.dx * t, py = g.ay + g.dy * t, d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d < best - 1e-9) { best = d; bs = g.s0 + t; bo = (x - px) * (-g.dy) + (y - py) * g.dx; }
  }
  return { s: bs, o: bo };
}
function punto(L, s) {
  var i, g;
  for (i = 0; i < L.segs.length; i++) { g = L.segs[i]; if (s <= g.s0 + g.len || i === L.segs.length - 1) { var t = cl(s - g.s0, 0, g.len); return { x: g.ax + g.dx * t, y: g.ay + g.dy * t, nx: -g.dy, ny: g.dx, seg: i }; } }
  return null;
}
function cruza(ax, ay, bx, by, cx, cy, dx, dy) {
  function o(px, py, qx, qy, rx, ry) { return (qx - px) * (ry - py) - (qy - py) * (rx - px); }
  var d1 = o(cx, cy, dx, dy, ax, ay), d2 = o(cx, cy, dx, dy, bx, by), d3 = o(ax, ay, bx, by, cx, cy), d4 = o(ax, ay, bx, by, dx, dy);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
function valido(L, ax, ay, bx, by, cuerdas, arriba) {
  var i;
  for (i = 0; i < NS; i++) { var t = i / (NS - 1); if (!inside(L, ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
  if (cuerdas && !arriba) for (i = 0; i < cuerdas.length; i++) { var c = cuerdas[i]; if (cruza(ax, ay, bx, by, c.x0, c.y, c.x1, c.y)) return false; }
  return true;
}
function proyecta(ax, ay, bx, by, wA, wB, Ls) {             // barra rígida: reparte el error de largo por peso
  var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1, err = len - Ls, ux = dx / len, uy = dy / len, fa = wA / (wA + wB), fb = wB / (wA + wB);
  return [q4(ax + ux * err * fa), q4(ay + uy * err * fa), q4(bx - ux * err * fb), q4(by - uy * err * fb)];
}
var CAND = [[1, 1], [0.5, 0.5], [2, 2], [3, 3], [1, 0], [0, 1]];   // completo · medio · solo x · solo y · solo adelante · solo atrás (resbalar contra la pared)
function mover(L, T, dA, dB, Ls, cuerdas, arriba) {
  var ok0 = valido(L, T[0], T[1], T[2], T[3], null, true), i, F = null;      // solo paredes: si la pose ya es inválida (no debería) se deja salir; bajo un tendedero sin levantar, NO
  for (i = 0; i < CAND.length; i++) {
    var ca = CAND[i][0], cb = CAND[i][1];
    var ax = ca === 2 ? dA[0] : ca === 3 ? 0 : dA[0] * ca, ay = ca === 2 ? 0 : ca === 3 ? dA[1] : dA[1] * ca;
    var bx = cb === 2 ? dB[0] : cb === 3 ? 0 : dB[0] * cb, by = cb === 2 ? 0 : cb === 3 ? dB[1] : dB[1] * cb;
    if (ax === 0 && ay === 0 && bx === 0 && by === 0) { if (i === 0) return { p: T.slice(0, 4), full: true, F: T.slice(0, 4), c: 0 }; continue; }
    var P = proyecta(T[0] + ax, T[1] + ay, T[2] + bx, T[3] + by, (ax || ay) ? 1 : WIDLE, (bx || by) ? 1 : WIDLE, Ls);
    if (i === 0) F = P;
    if (!ok0 || valido(L, P[0], P[1], P[2], P[3], cuerdas, arriba)) return { p: P, full: i === 0, F: F, c: i };
  }
  return { p: T.slice(0, 4), full: false, F: F, c: -1 };
}
/* LÍNEA GUÍA: planificador codicioso con la misma física (9×9 pares de direcciones, horizonte 8 ticks, decide cada 2), sin tendederos ni peligros. Una vez por nivel/variante. */
var GUIAS = {};
function guia(lv, v) {
  var key = lv * 10 + v; if (GUIAS[key]) return GUIAS[key];
  var L = layout(lv, v), Ls = LSOFA[lv - 1], T = [L.pts[0][0], L.pts[0][1] - Ls, L.pts[0][0], L.pts[0][1]], G = { ax: [], ay: [], bx: [], by: [], s: [], ok: false }, k = 0, i, j, h;
  var fin = L.L - Ls / 2 - 6;
  function rec() { G.ax.push(T[0]); G.ay.push(T[1]); G.bx.push(T[2]); G.by.push(T[3]); G.s.push(proj(L, (T[0] + T[2]) / 2, (T[1] + T[3]) / 2).s); }
  rec();
  while (k < 2400) {
    if (G.s[G.s.length - 1] >= fin) { G.ok = true; break; }
    var bv = -1e18, bi = 0, bj = 0;
    for (i = 0; i < 9; i++) for (j = 0; j < 9; j++) {
      if (!i && !j) continue;
      var U = T, bad = 0, dA = [DIRS[i][0] * SPD, DIRS[i][1] * SPD], dB = [DIRS[j][0] * SPD, DIRS[j][1] * SPD];
      for (h = 0; h < 8; h++) { var r = mover(L, U, dA, dB, Ls); if (!r.full) bad++; U = r.p; }
      var pa = proj(L, U[0], U[1]), pb = proj(L, U[2], U[3]), val = pa.s + pb.s - bad * 0.5 - 0.02 * (Math.abs(pa.o) + Math.abs(pb.o));
      if (val > bv) { bv = val; bi = i; bj = j; }
    }
    for (h = 0; h < 2; h++) { T = mover(L, T, [DIRS[bi][0] * SPD, DIRS[bi][1] * SPD], [DIRS[bj][0] * SPD, DIRS[bj][1] * SPD], Ls).p; rec(); k++; }
  }
  GUIAS[key] = G;
  return G;
}

FIESTA.LIVE.add('f_mudanza', {
  name: '¡LA MUDANZA!', modos: ['2v2'], clase: 'binary', modelo: 'C', dur: 45,
  stick: true, botones: 1, snapHz: 10, migra: true, minHumanos: 1,
  limites: { scoreMax: SMAX, scoreRate: RATE, minT: MINT, finTemprano: 1 },
  packN: 34, packDiscretos: [0, 1, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  carta: {
    obj: '¡Súbanle el sofá a la tía por la escalera del cerro! Cada pana carga una punta.',
    gana: 'Gana el equipo que llegue primero a la puerta. Si nadie llega, gana el que subió más. Pegarle a la pared es ¡RAYÓN!: el sofá se para.',
    como: { tactil: 'Joystick: mueve TU punta del sofá · Mantén A: ¡ARRIBA! (los dos, para pasar los tendederos)', teclado: 'WASD o flechas: mueve tu punta · Mantén ESPACIO: ¡ARRIBA! (los dos, en los tendederos)' },
    roles: null,
    demos: [{
      id: 'curva', txt: 'En la curva, uno se adelanta y el otro gira detrás. En el tendedero, ¡los dos mantienen A!',
      dibuja: function (cx, cy, k, t, teclado) {
        var u = (t * 0.45) % 1, a = u < 0.5 ? 0 : (u - 0.5) * 2 * Math.PI / 2, px = cx - 22 + (u < 0.5 ? 0 : 40 * (u - 0.5) * 2), py = cy + 26 - (u < 0.5 ? u * 2 * 40 : 40);
        rr(cx - 46, cy - 40, 30, 82, 0, '#e85d75', 2); rr(cx - 46, cy - 40, 96, 30, 0, '#ffd166', 2);
        var bx = px + Math.sin(a) * 0, by = py, fx = bx + Math.sin(a) * 44, fy = by - Math.cos(a) * 44;
        line([[bx, by], [fx, fy]], 9, '#3f7fe0'); ell(bx, by, 5, 5, '#fffdf2', 2); ell(fx, fy, 5, 5, '#fffdf2', 2);
        line([[cx + 20, cy - 44], [cx + 20, cy - 8]], 2, '#fffdf2');
        if (teclado) { rr(cx - 40, cy + 46, 80, 22, 6, u > 0.7 ? '#ff8a3d' : '#f0ead8', 3); txt('ESPACIO', cx, cy + 57, 12, INK, 0, true); }
        else { ell(cx, cy + 56, 13, 13, u > 0.7 ? '#ff8a3d' : '#ffe14d', 3); txt('A', cx, cy + 57, 14, INK, 0, true); }
      }
    }, { id: 'mover', txt: 'Mueve tu punta del sofá con el joystick' }]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur > 0 ? c.dur : 45, durT = Math.round(dur * TK), pal = PAL[lv - 1], i, p, j;
    var teams = (c.equipos && c.equipos.length === n) ? c.equipos.slice() : [];
    if (!teams.length) for (i = 0; i < n; i++) teams.push(n === 4 ? (i < 2 ? 0 : 1) : i % 2);
    var tL = teams[0]; for (i = 0; i < n; i++) if (teams[i] < tL) tL = teams[i];
    var tR = -1; for (i = 0; i < n; i++) if (teams[i] !== tL) { tR = teams[i]; break; }
    var side = [], endOf = [], seatOf = [[-1, -1], [-1, -1]], mate = [];
    for (i = 0; i < n; i++) { var sd0 = teams[i] === tL ? 0 : 1; side.push(sd0); if (seatOf[sd0][0] < 0) { seatOf[sd0][0] = i; endOf.push(0); } else if (seatOf[sd0][1] < 0) { seatOf[sd0][1] = i; endOf.push(1); } else endOf.push(-1); }
    for (i = 0; i < n; i++) mate.push(endOf[i] < 0 ? -1 : seatOf[side[i]][1 - endOf[i]]);
    function seatEnd(sd, e) { var q = seatOf[sd][e]; return q >= 0 ? q : seatOf[sd][1 - e]; }     // equipo de uno: carga las dos puntas

    /* ───── escalera y peligros sembrados (mismo consumo de c.rng en los 3 niveles) ───── */
    var R = [], rng = c.rng; for (i = 0; i < 24; i++) R.push(rng.next());
    var vr = Math.min(2, Math.floor(R[0] * 3)), L = layout(lv, vr), Ls = LSOFA[lv - 1], GU = guia(lv, vr), s0 = Ls / 2, fin = L.L - Ls / 2 - 6;
    var cuerdas = [];
    (TEND[lv] || []).forEach(function (t, q) {
      var g = L.segs[t[0]], ds = g.len * (t[1] + (t[2] - t[1]) * R[1 + q]), cy = q4(g.ay + g.dy * ds), cx = g.ax;
      cuerdas.push({ s: g.s0 + ds, x0: cx - CW / 2, x1: cx + CW / 2, y: cy });
    });
    var perro = null;
    if (PERRO[lv]) { var gP = L.segs[PERRO[lv][0]], dP = gP.len * PERRO[lv][1]; perro = { x: gP.ax, y: q4(gP.ay + gP.dy * dP), cross: PERRO[lv][2], cyc: 2 * PERRO[lv][2] + 100, ph: Math.floor(R[5] * 180), s: gP.s0 + dP }; }
    function perroAt(k) {                                      // cruza de pared a pared, se sienta en su puerta, vuelve
      if (!perro) return null;
      var u = (k + perro.ph) % perro.cyc, cr = perro.cross, x, mov = 0, dir = 1;
      if (u < cr) { x = -DOG_OUT + 2 * DOG_OUT * u / cr; mov = 1; }
      else if (u < cr + 50) x = DOG_OUT;
      else if (u < 2 * cr + 50) { x = DOG_OUT - 2 * DOG_OUT * (u - cr - 50) / cr; mov = 1; dir = -1; }
      else x = -DOG_OUT;
      return { x: perro.x + x, y: perro.y, mov: mov, dir: dir };
    }
    var motos = [];
    if (lv >= 2) { var mt = Math.round((9 + 3 * R[6]) * TK), mq = 0; while (mt + MOTO_WARN < durT && mq < 4) { motos.push({ t: mt, sd: R[7 + mq] < 0.5 ? -1 : 1 }); mt += Math.round((11 + 4 * R[11 + mq]) * TK); mq++; } }
    var offPl = {};                                              // la franja de la moto: la línea desplazada media pista (inglete en las curvas)
    [-1, 1].forEach(function (sg) {
      var P = [], q, ln = 0, ac = [0];
      for (q = 0; q < L.pts.length; q++) {
        var nx = 0, ny = 0;
        if (q > 0) { nx += -L.segs[q - 1].dy; ny += L.segs[q - 1].dx; }
        if (q < L.segs.length) { nx += -L.segs[q].dy; ny += L.segs[q].dx; }
        P.push([L.pts[q][0] + nx * sg * MOTO_OFF, L.pts[q][1] + ny * sg * MOTO_OFF]);
        if (q) { ln += Math.abs(P[q][0] - P[q - 1][0]) + Math.abs(P[q][1] - P[q - 1][1]); ac.push(ln); }
      }
      offPl[sg] = { P: P, ac: ac, L: ln };
    });
    function motoAt(k) {                                       // {i, ph 1 aviso / 2 bajando, x, y, s (arco en la escalera), sd}
      for (var q = 0; q < motos.length; q++) {
        var m = motos[q], u = k - m.t; if (u < 0) return null;
        if (u < MOTO_WARN) return { i: q, ph: 1, sd: m.sd, s: L.L };
        var sm = L.L - (u - MOTO_WARN) * MOTO_V;
        if (sm >= -40) {
          var op = offPl[m.sd], f = cl(sm / L.L, 0, 1) * op.L, z = 1, x, y;
          while (z < op.ac.length - 1 && op.ac[z] < f) z++;
          var a = op.P[z - 1], b = op.P[z], seg = op.ac[z] - op.ac[z - 1] || 1, w = (f - op.ac[z - 1]) / seg;
          x = a[0] + (b[0] - a[0]) * w; y = a[1] + (b[1] - a[1]) * w;
          if (sm < 0) y += -sm;
          return { i: q, ph: 2, sd: m.sd, s: sm, x: x, y: y };
        }
      }
      return null;
    }
    var SMAXe = Math.max(4, Math.min(SMAX, Math.floor(RATE * (Math.min(MINT, dur - 1) + 1.5))));
    /* decorado del muro (casitas del cerro), canónico */
    var deco = [];
    for (j = 0; j < Math.ceil(L.H / 64) + 1; j++) for (i = 0; i < 5; i++) {
      var dx0 = 18 + i * 62 + (j % 2) * 20, dy0 = 20 + j * 64, okD = true, fr;
      for (var z0 = 0; z0 < L.full.length; z0++) { fr = L.full[z0]; if (dx0 > fr[0] - 22 && dx0 < fr[2] + 22 && dy0 > fr[1] - 22 && dy0 < fr[3] + 22) okD = false; }
      if (okD && dx0 < LW - 12) deco.push({ x: dx0, y: dy0, k: (i * 7 + j * 3) % 6, t: (i + j * 2) % 4 });
    }

    /* ───── estado autoritativo ───── */
    var st = { k: 0, kr: 0, T: [], P: [] };
    for (i = 0; i < 2; i++) st.T.push({ ax: L.pts[0][0], ay: L.pts[0][1] - Ls, bx: L.pts[0][0], by: L.pts[0][1], stop: 0, imm: 0, ray: 0, arr: 0, mhit: 0, fz: 0 });
    for (p = 0; p < MAXP; p++) st.P.push({ drop: 0, dimm: 0, up: 0 });
    var asiento = function (pp) { return (c.seats && c.seats[pp]) || { name: 'P' + (pp + 1), color: '#fff', ch: null }; };
    function teamOfSide(sd) { return sd === 0 ? tL : tR; }
    function sideColor(sd) { return COL_EQ[teamOfSide(sd) === 1 ? 1 : 0]; }
    function sideName(sd) { return NOM_EQ[teamOfSide(sd) === 1 ? 1 : 0]; }
    function sofaCol(sd) { return SOFA_EQ[teamOfSide(sd) === 1 ? 1 : 0]; }
    function centroS(T) { return proj(L, (T.ax + T.bx) / 2, (T.ay + T.by) / 2).s; }
    function arrTicks() { var a = 0, q; for (q = 0; q < 2; q++) if (st.T[q].arr && (!a || st.T[q].arr < a)) a = st.T[q].arr; return a; }
    function entrada(p, sd) {                                  // stick (canónico: el carril derecho niega la x) y A de un asiento
      if (p < 0) return { x: 0, y: 0, a: false };
      var e = c.eje(p) || { x: 0, y: 0 }, x = +e.x || 0, y = +e.y || 0, l = Math.sqrt(x * x + y * y);
      if (l > 1) { x /= l; y /= l; } if (l < 0.2) { x = 0; y = 0; }
      return { x: sd === 1 ? -x : x, y: y, a: !!c.held(p, 'a') };
    }

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    function stepTeam(sd, k) {
      var T = st.T[sd]; if (T.arr) return;
      var pa = seatEnd(sd, 0), pb = seatEnd(sd, 1), solo = pa === pb, eA = entrada(pa, sd), eB = solo ? eA : entrada(pb, sd), PA = pa >= 0 ? st.P[pa] : null, PB = pb >= 0 ? st.P[pb] : null;
      var dropA = PA && PA.drop > 0, dropB = PB && PB.drop > 0 && !solo || (solo && dropA);
      var upA = eA.a && !dropA, upB = eB.a && !dropB;
      if (PA) PA.up = upA ? 1 : 0; if (PB && !solo) PB.up = upB ? 1 : 0;
      var fA = dropA ? 0 : SPD * (upA ? UPF : 1), fB = dropB ? 0 : SPD * (upB ? UPF : 1);
      var dA = [eA.x * fA, eA.y * fA], dB = [eB.x * fB, eB.y * fB];
      if (T.imm > 0) T.imm--;
      if (T.stop > 0) { T.stop--; T.fz = Math.max(0, T.fz - 2); }
      else {
        var cur = [T.ax, T.ay, T.bx, T.by], r = mover(L, cur, dA, dB, Ls, cuerdas, upA && upB);
        /* forcejeo: las dos puntas tiran en sentidos contrarios a lo largo del sofá */
        var ux = (T.ax - T.bx) / Ls, uy = (T.ay - T.by) / Ls, ca = dA[0] * ux + dA[1] * uy, cb = dB[0] * ux + dB[1] * uy;
        if (ca * cb < 0 && Math.abs(ca) > 0.45 * SPD * UPF && Math.abs(cb) > 0.45 * SPD * UPF) T.fz = Math.min(250, T.fz + 1); else T.fz = Math.max(0, T.fz - 2);
        var Df = r.F ? Math.abs(r.F[0] - T.ax) + Math.abs(r.F[1] - T.ay) + Math.abs(r.F[2] - T.bx) + Math.abs(r.F[3] - T.by) : 0;
        var Dg = Math.abs(r.p[0] - T.ax) + Math.abs(r.p[1] - T.ay) + Math.abs(r.p[2] - T.bx) + Math.abs(r.p[3] - T.by);
        if (!r.full && r.c !== 1 && Df > RAY_MIN && Dg < 0.5 * Df && T.imm === 0) { T.stop = RAY_STOP; T.imm = RAY_STOP + RAY_IMM; T.ray = Math.min(99, T.ray + 1); }
        else { T.ax = r.p[0]; T.ay = r.p[1]; T.bx = r.p[2]; T.by = r.p[3]; }
      }
      /* el perro: si toca a uno, ese suelta su punta */
      var dg = perroAt(k), q;
      if (dg && dg.mov) for (q = 0; q < 2; q++) {
        var ps = seatEnd(sd, q), Pq = ps >= 0 ? st.P[ps] : null; if (!Pq || Pq.dimm > 0) continue;
        var ex = q === 0 ? T.ax : T.bx, ey = q === 0 ? T.ay : T.by;
        if ((ex - dg.x) * (ex - dg.x) + (ey - dg.y) * (ey - dg.y) < DOG_R * DOG_R) { Pq.drop = DROP; Pq.dimm = DROP_IMM + DROP; }
      }
      /* la moto: si pasa por encima del sofá, ¡RAYÓN! largo (una vez por pasada) */
      var mo = motoAt(k);
      if (mo && mo.ph === 2 && T.mhit !== mo.i + 1) {
        for (q = 0; q < NS; q++) {
          var t = q / (NS - 1), sx = T.ax + (T.bx - T.ax) * t - mo.x, sy = T.ay + (T.by - T.ay) * t - mo.y;
          if (sx * sx + sy * sy < MOTO_R * MOTO_R) { T.mhit = mo.i + 1; T.stop = Math.max(T.stop, MOTO_STOP); T.imm = Math.max(T.imm, MOTO_STOP + RAY_IMM); T.ray = Math.min(99, T.ray + 1); break; }
        }
      }
      if (centroS(T) >= fin) T.arr = k + 1;
    }
    function step() {
      var k = st.k, p2;
      st.kr = Math.max(0, Math.round(c.ahora() * TK));
      stepTeam(0, k); stepTeam(1, k);
      for (p2 = 0; p2 < n; p2++) { var P = st.P[p2]; if (P.drop > 0) P.drop--; if (P.dimm > 0) P.dimm--; }
      st.k++;
    }

    /* ───────────────────────── puntaje ───────────────────────── */
    function progreso(sd) { var T = st.T[sd]; return cl(Math.floor((SMAXe - 2) * (centroS(T) - s0) / (fin - s0)), 0, SMAXe - 2); }
    function scSide(sd) { var T = st.T[sd], a = arrTicks(); if (T.arr) return T.arr === a ? SMAXe : SMAXe - 1; return progreso(sd); }
    function scores() { var a = [], q; for (q = 0; q < n; q++) a.push(scSide(side[q])); return a; }
    function allDone() { var a = arrTicks(); return (st.T[0].arr > 0 && st.T[1].arr > 0) || (a > 0 && st.k >= a + FIN_GRACIA); }

    /* ───────────────────────── snapshot ───────────────────────── */
    // [k, kr] + por equipo [ax, ay, bx, by (×4), stop, imm, ray, arr, mhit, fz] + por asiento [drop, dimm, up]
    function pack() {
      var a = [st.k, st.kr], q, T, P;
      for (q = 0; q < 2; q++) { T = st.T[q]; a.push(Math.round(T.ax * 4), Math.round(T.ay * 4), Math.round(T.bx * 4), Math.round(T.by * 4), T.stop, T.imm, T.ray, T.arr, T.mhit, T.fz); }
      for (q = 0; q < MAXP; q++) { P = st.P[q]; a.push(P.drop, P.dimm, P.up); }
      return a;
    }
    function load(a) {
      if (!a || a.length < 34) return;
      var q, o, T, P;
      st.k = a[0] | 0; st.kr = a[1] | 0;
      for (q = 0; q < 2; q++) { o = 2 + 10 * q; T = st.T[q]; T.ax = a[o] / 4; T.ay = a[o + 1] / 4; T.bx = a[o + 2] / 4; T.by = a[o + 3] / 4; T.stop = a[o + 4] | 0; T.imm = a[o + 5] | 0; T.ray = a[o + 6] | 0; T.arr = a[o + 7] | 0; T.mhit = a[o + 8] | 0; T.fz = a[o + 9] | 0; }
      for (q = 0; q < MAXP; q++) { o = 22 + 3 * q; P = st.P[q]; P.drop = a[o] | 0; P.dimm = a[o + 1] | 0; P.up = a[o + 2] | 0; }
    }
    function lerp(a, b, u) {
      var out = b.slice(), q, z;
      if (b[0] < a[0] || b[0] - a[0] > TK * 2) return out;
      for (q = 0; q < 2; q++) for (z = 0; z < 4; z++) { var ix = 2 + 10 * q + z; if (Math.abs(b[ix] - a[ix]) < 240) out[ix] = Math.round(a[ix] + (b[ix] - a[ix]) * u); }
      return out;
    }

    /* ───────────────────────── vista de los que no son el juez: retraso y sofá propio adelantado ───────────────────────── */
    var vHist = [], lagEst = -1;
    function isJudge() { return c.juez(); }
    function lagVista() {
      if (typeof c.lag === 'function') { var l0 = +c.lag(); if (l0 >= 0) return cl(l0, 0, 0.6); }
      var now = c.ahora();
      if (now >= 0 && st.kr > 0) { vHist.push(cl(now - st.kr / TK, 0, 3)); if (vHist.length > 90) vHist.shift(); }
      if (vHist.length < 5) return 0;
      if (vHist.length % 5 === 0 || lagEst < 0) { var s2 = vHist.slice().sort(function (x, y) { return x - y; }); lagEst = s2[s2.length >> 1]; }
      return cl(lagEst, 0, 0.6);
    }
    function predict() {
      if (isJudge() || c.yo < 0 || c.yo >= n || endOf[c.yo] < 0) return;
      var sd = side[c.yo], T = st.T[sd], P = st.P[c.yo], t = Math.min(8, Math.round(lagVista() * TK));
      if (t <= 0 || T.arr || T.stop > 0 || P.drop > 0) return;
      var e = entrada(c.yo, sd), f = SPD * (e.a ? UPF : 1) * t * 0.4, dx = cl(e.x * f, -10, 10), dy = cl(e.y * f, -10, 10);
      if (valido(L, T.ax + dx, T.ay + dy, T.bx + dx, T.by + dy, null, true)) { T.ax += dx; T.ay += dy; T.bx += dx; T.by += dy; }
    }

    /* ───────────────────────── CPU ───────────────────────── */
    // Cada punta CPU persigue SU punta de la guía LOOK ticks adelante. Índice de la guía: el más parecido a la pose actual (las dos puntas; con pana humano, la punta del humano).
    // Reacción cada 0,06+0,22·(1−skill) s (con humano 0,15+0,35·(1−skill)); error de puntería ±14·(1−skill) px; velocidad 0,78+0,22·skill; despiste 1,2 %·(1−skill) por tick (0,3-0,6 s).
    // Tendedero: levanta a tiempo con prob. 0,65+0,3·skill, si no tras el rayón. Moto: se corre a la pared segura con prob. 0,55+0,45·skill. Trabada 1,2 s: retrocede por la guía.
    var cpr = []; for (p = 0; p < n; p++) cpr.push({ r: c.rngFor('cpu' + p), gi: 0, t: 0, next: 0, nx: 0, ny: 0, pause: 0, unj: 0, best: 0, bestT: 0, cOk: [], cRay: [], mOk: -1, mSeen: -1, perroOk: -1, perroK: -1 });
    function gauss(r) { return (r.next() + r.next() + r.next() - 1.5) * 2; }
    function guiaIdx(A, T, wa, wb) {
      var lo = Math.max(0, A.gi - 15), hi = Math.min(GU.s.length - 1, A.gi + 90), bi = A.gi, bd = 1e18, q;
      for (q = lo; q <= hi; q++) {
        var d = 0;
        d += wa * ((GU.ax[q] - T.ax) * (GU.ax[q] - T.ax) + (GU.ay[q] - T.ay) * (GU.ay[q] - T.ay));
        d += wb * ((GU.bx[q] - T.bx) * (GU.bx[q] - T.bx) + (GU.by[q] - T.by) * (GU.by[q] - T.by));
        if (d < bd) { bd = d; bi = q; }
      }
      if (bd > 60 * 60) for (q = 0; q < GU.s.length; q += 3) {     // muy lejos de la ventana: busca en toda la guía
        var d2 = (GU.ax[q] - T.ax) * (GU.ax[q] - T.ax) + (GU.ay[q] - T.ay) * (GU.ay[q] - T.ay) + (GU.bx[q] - T.bx) * (GU.bx[q] - T.bx) + (GU.by[q] - T.by) * (GU.by[q] - T.by);
        if (d2 < bd) { bd = d2; bi = q; }
      }
      return bi;
    }
    /* DESATASCAR (trabado 1,2 s sin subir): por 1,2 s la CPU elige su dirección con la misma búsqueda de la guía (horizonte 8 ticks) desde la pose REAL. Con pana CPU, el par
       se decide una vez por tick para los dos; con pana humano, solo su punta, suponiendo que el humano sigue con su stick de ahora. */
    var plan = [{ k: -1, d: null }, { k: -1, d: null }];
    function desatasca(sd, pp, hum, e) {
      var T = st.T[sd], cur = [T.ax, T.ay, T.bx, T.by], i2, j2, h, best = -1e18, bi = 0, bj = 0, he = null, up = false, q;
      if (hum < 0 && plan[sd].k === st.k && plan[sd].d) return e === 1 ? plan[sd].d[1] : plan[sd].d[0];
      if (hum >= 0) { var eh = entrada(hum, sd); he = [eh.x, eh.y]; }
      for (q = 0; q < n; q++) if (side[q] === sd && st.P[q].up) up = true;
      for (i2 = 0; i2 < 9; i2++) for (j2 = 0; j2 < 9; j2++) {
        if (hum >= 0) { if ((e === 0 ? j2 : i2) > 0) continue; }
        var da = hum >= 0 && e === 1 ? he : DIRS[i2], db = hum >= 0 && e === 0 ? he : DIRS[j2];
        if (!(da[0] || da[1] || db[0] || db[1])) continue;
        var U = cur, bad = 0, f = SPD * (up ? UPF : 1), dA = [da[0] * f, da[1] * f], dB = [db[0] * f, db[1] * f];
        for (h = 0; h < 8; h++) { var r = mover(L, U, dA, dB, Ls, cuerdas, up); if (!r.full) bad++; U = r.p; }
        var pa = proj(L, U[0], U[1]), pb = proj(L, U[2], U[3]), val = pa.s + pb.s - bad * 0.5 - 0.02 * (Math.abs(pa.o) + Math.abs(pb.o));
        if (val > best) { best = val; bi = i2; bj = j2; }
      }
      if (hum >= 0) return e === 1 ? DIRS[bj] : DIRS[bi];
      plan[sd] = { k: st.k, d: [DIRS[bi], DIRS[bj]] };
      return e === 1 ? DIRS[bj] : DIRS[bi];
    }
    function ai(pp, dt, api) {
      var A = cpr[pp]; if (!A) return;
      var sd = side[pp], e = endOf[pp], T = st.T[sd], sk = (c.skill && typeof c.skill[pp] === 'number') ? c.skill[pp] : 0.6, k = st.k, m = mate[pp], q;
      A.t += dt;
      if (e < 0 || T.arr) { api.eje(0, 0); api.hold('a', false); return; }
      var hum = m >= 0 && !c.cpu[m], ends = m < 0 ? [0, 1] : [e];
      var sNow = centroS(T);
      if (sNow > A.best + 4) { A.best = sNow; A.bestT = A.t; }
      else if (A.t - A.bestT > 1.2 && A.unj <= 0) { A.unj = 1.2; A.bestT = A.t; A.best = sNow; }
      if (A.unj > 0) A.unj -= dt;
      if (sNow < A.best - 60) A.best = sNow;
      if (A.t >= A.next) {
        A.next = A.t + (hum ? 0.15 + 0.35 * (1 - sk) : 0.06 + 0.22 * (1 - sk)) + A.r.next() * 0.04;
        if (!hum) A.gi = guiaIdx(A, T, 1, 1);
        A.nx = gauss(A.r) * 14 * (1 - sk); A.ny = gauss(A.r) * 14 * (1 - sk);
        if (A.pause <= 0 && A.r.next() < 0.012 * (1 - sk) * (A.next - A.t) * TK) A.pause = 0.3 + 0.3 * A.r.next();
      }
      if (hum) A.gi = guiaIdx(A, T, e === 0 ? 1 : 3, e === 0 ? 3 : 1);              // con humano: cada tick, pesa más SU punta (la CPU lo acompaña, no lo frena)
      if (A.pause > 0) { A.pause -= dt; api.eje(0, 0); api.hold('a', false); return; }
      var gi = cl(A.gi + LOOK, 0, GU.s.length - 1);
      /* moto: correrse a la pared segura mientras no haya pasado */
      var mo = motoAt(k), shift = 0;
      if (mo && (mo.ph === 1 || mo.s > proj(L, T.bx, T.by).s - 30)) {
        if (A.mSeen !== mo.i) { A.mSeen = mo.i; A.mOk = A.r.next() < 0.55 + 0.45 * sk ? 1 : 0; }
        if (A.mOk) shift = -mo.sd * 22;
      }
      /* perro: la CPU buena espera si viene hacia su punta */
      var dg = perroAt(k), wait = false;
      if (dg && dg.mov) {
        var ex0 = e === 1 ? T.bx : T.ax, ey0 = e === 1 ? T.by : T.ay;
        if (Math.abs(ey0 - dg.y) < 40 && (ex0 - dg.x) * dg.dir > 0 && Math.abs(ex0 - dg.x) < 60) {
          var pk = Math.floor((k + perro.ph) / perro.cyc) * 2 + (dg.dir > 0 ? 0 : 1);
          if (A.perroK !== pk) { A.perroK = pk; A.perroOk = A.r.next() < 0.7 * sk ? 1 : 0; }
          wait = A.perroOk === 1;
        }
      }
      var outX = 0, outY = 0, cnt = 0;
      for (q = 0; q < ends.length; q++) {
        var en = ends[q], tx = en === 0 ? GU.ax[gi] : GU.bx[gi], ty = en === 0 ? GU.ay[gi] : GU.by[gi], mx = en === 0 ? T.ax : T.bx, my = en === 0 ? T.ay : T.by;
        if (shift) { var pr = punto(L, proj(L, tx, ty).s); tx += pr.nx * shift; ty += pr.ny * shift; }
        tx += A.nx; ty += A.ny;
        var pj2 = proj(L, tx, ty);                                              // el objetivo nunca contra la pared (si no, empuja de lado: rayón)
        if (Math.abs(pj2.o) > CW / 2 - MG - 5) { var pc = punto(L, pj2.s), oo = (pj2.o > 0 ? 1 : -1) * (CW / 2 - MG - 5); tx = pc.x + pc.nx * oo; ty = pc.y + pc.ny * oo; }
        var dx = tx - mx, dy = ty - my, d = Math.sqrt(dx * dx + dy * dy), mag = (0.78 + 0.22 * sk) * (d > 3 ? 1 : d / 3);
        if (d > 0.5) { outX += dx / d * mag; outY += dy / d * mag; cnt++; }
      }
      if (cnt) { outX /= cnt; outY /= cnt; }
      if (A.unj > 0 && T.stop === 0 && m >= 0) { var pl = desatasca(sd, pp, hum ? m : -1, e); if (pl) { outX = pl[0] * (0.78 + 0.22 * sk); outY = pl[1] * (0.78 + 0.22 * sk); } }
      if (wait) { outX = 0; outY = 0; }
      /* tendederos: ¡ARRIBA! al acercarse (si acierta), o tras el rayón */
      var up = false, sA = proj(L, T.ax, T.ay).s, sB = proj(L, T.bx, T.by).s;
      for (q = 0; q < cuerdas.length; q++) {
        var cs = cuerdas[q].s;
        if (Math.max(sA, sB) > cs - 34 && Math.min(sA, sB) < cs + 8) {
          if (A.cOk[q] === undefined) { A.cOk[q] = A.r.next() < 0.65 + 0.3 * sk ? 1 : 0; A.cRay[q] = T.ray; }
          if (A.cOk[q] || T.ray > A.cRay[q]) up = true;
        }
      }
      api.eje(sd === 1 ? -outX : outX, outY); api.hold('a', up);
    }

    /* ───────────────────────── presentación ───────────────────────── */
    var at = 0, banner = null, bannerT = 0, fxs = [], prevRay = [0, 0], prevArr = [0, 0], prevDrop = [0, 0, 0, 0], prevMoto = -1, gagFz = [-9, -9], saludo = false, ganoDicho = false;
    function banr(s, col, t) { banner = { s: s, col: col }; bannerT = t || 1.6; }
    function lay() {
      var f = c.campo();
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width, y0: f.y0, y1: f.y1 };
      var vw = f.x1 - f.x0, gap = 12, pw = (vw - 24 - gap) / 2, z = cl(pw / LW, 0.5, 1.05), top = 104, bot = 600, visH = (bot - top) / z;
      return { f: f, vw: vw, cx: (f.x0 + f.x1) / 2, gap: gap, pw: pw, z: z, top: top, bot: bot, visH: visH };
    }
    function laneX(l, sd) { return sd === 0 ? l.cx - l.gap / 2 - LW * l.z : l.cx + l.gap / 2; }
    function camY(l, sd) { var T = st.T[sd]; return cl((T.ay + T.by) / 2 - l.visH * 0.5, 0, Math.max(0, L.H - l.visH)); }
    function scr(l, sd, x, y) { return { x: laneX(l, sd) + (sd === 1 ? LW - x : x) * l.z, y: l.top + (y - camY(l, sd)) * l.z }; }
    function update(dt) {
      at += dt; bannerT = Math.max(0, bannerT - dt);
      var l = lay(), q, sd;
      if (!saludo && c.ahora() >= 0) { saludo = true; var pd = scr(l, 0, L.pts[L.pts.length - 1][0], L.pts[L.pts.length - 1][1]); S_('¡Cuidado con mi sofá!', l.cx, Math.max(130, pd.y), '#fffdf2'); if (lv === 3) banr('¡AHORA ES EL JUEGO DE COMEDOR!', '#ffd23f', 2.2); }
      for (sd = 0; sd < 2; sd++) {
        var T = st.T[sd], cxT = (T.ax + T.bx) / 2, cyT = (T.ay + T.by) / 2, ps = scr(l, sd, cxT, cyT);
        if (T.ray > prevRay[sd]) { fxs.push({ sd: sd, x: cxT, y: cyT, t: 0, k: 'ray' }); SND(130, 0.16, 'sawtooth', 0.07, -60); if (c.yo >= 0 && c.yo < n && side[c.yo] === sd) S_(T.ray % 2 ? '¡MI SOFÁ!' : '¡AY, MI SOFÁ NUEVO!', ps.x, ps.y - 50, '#ffd23f'); }
        prevRay[sd] = T.ray;
        if (T.arr && !prevArr[sd]) {
          var first = T.arr === arrTicks();
          banr(first ? '¡LLEGÓ EL SOFÁ ' + sideName(sd) + '!' : '¡' + sideName(sd) + ' TAMBIÉN LLEGÓ!', sideColor(sd), 2.4);
          SPAWN(ps.x, ps.y, 18, 'conf', ['#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a'], 300, 400, 0.9); SND(880, 0.3, 'square', 0.06, 220);
          if (first && !ganoDicho) { ganoDicho = true; S_('¡Ay, llegó mi sofá!', ps.x, ps.y - 70, '#fffdf2'); }
        }
        prevArr[sd] = T.arr;
        if (T.fz > 18 && at - gagFz[sd] > 5) { gagFz[sd] = at; S_('¡Pa\' tu lado! ¡No, pa\' TU lado!', ps.x, ps.y - 44, '#fffdf2'); }
      }
      for (q = 0; q < n; q++) {
        var P = st.P[q];
        if (P.drop > 0 && !prevDrop[q] && endOf[q] >= 0) { var Tq = st.T[side[q]]; fxs.push({ sd: side[q], x: endOf[q] === 0 ? Tq.ax : Tq.bx, y: endOf[q] === 0 ? Tq.ay : Tq.by, t: 0, k: 'guau' }); SND(320, 0.08, 'square', 0.05, 160); SND(260, 0.1, 'square', 0.05, 120); }
        prevDrop[q] = P.drop > 0 ? 1 : 0;
      }
      var mo = motoAt(st.k), mi = mo ? mo.i : -1;
      if (mi !== prevMoto && mo) { banr('¡MOTO BAJANDO! ¡PÉGATE A LA PARED!', '#ff8a3d', 1.6); SND(520, 0.12, 'square', 0.05, 0); SND(520, 0.12, 'square', 0.05, 0); }
      prevMoto = mi;
      for (q = fxs.length - 1; q >= 0; q--) { fxs[q].t += dt; if (fxs[q].t > 0.9) fxs.splice(q, 1); }
    }

    /* ───────────────────────── dibujo ───────────────────────── */
    function X(sd, x) { return sd === 1 ? LW - x : x; }
    function fondo(l) {
      var f = l.f, w = l.vw, q;
      rr(f.x0, 0, w, 640, 0, pal.cielo, 0);
      if (lv === 3) { for (q = 0; q < 16; q++) ell(f.x0 + ((q * 151) % w), 8 + (q * 29) % 80, 2, 2, '#fffdf2', 0); ell(f.x0 + w - 60, 44, 16, 16, '#f4f0d0', 0); }
      else ell(lv === 1 ? f.x0 + w - 60 : f.x0 + 60, lv === 1 ? 44 : 84, 22, 22, lv === 1 ? '#ffe14d' : '#ffe9a0', 0);
      var pts = [[f.x0, 110]]; for (q = 0; q <= 10; q++) pts.push([f.x0 + w * q / 10, 70 + ((q * 37) % 23) + (q % 3) * 8]); pts.push([f.x1, 110]);
      poly(pts, pal.cerro, 0);
    }
    function carril(l, sd) {
      var cy0 = camY(l, sd), y0 = cy0 - 40, y1 = cy0 + l.visH + 40, T = st.T[sd], q, g, z;
      ctx.save(); ctx.translate(laneX(l, sd), l.top); ctx.scale(l.z, l.z); ctx.translate(0, -cy0);
      rr(0, Math.max(0, y0), LW, Math.min(L.H, y1) - Math.max(0, y0), 0, pal.muro[sd * 3 % 6], 3);
      for (q = 0; q < deco.length; q++) {                                         // casitas: ventanas con reja, matas, tanques
        var d = deco[q]; if (d.y < y0 || d.y > y1) continue;
        var dx = X(sd, d.x);
        rr(dx - 24, d.y - 24, 48, 48, 2, pal.muro[d.k], 1.5);
        if (d.t === 0 || d.t === 2) { rr(dx - 10, d.y - 10, 20, 18, 2, pal.ventana, 2); line([[dx - 3, d.y - 10], [dx - 3, d.y + 8]], 1.5, INK); line([[dx + 4, d.y - 10], [dx + 4, d.y + 8]], 1.5, INK); }
        else if (d.t === 1) { ell(dx, d.y, 12, 10, '#3f9a4a', 2); ell(dx + 5, d.y - 4, 6, 5, '#5fc46a', 0); }
        else { ell(dx, d.y, 12, 12, '#2f5f9a', 2.5); ell(dx, d.y, 7, 7, '#4f7fba', 0); }
      }
      var fr, fx0;
      for (z = 0; z < 2; z++) for (q = 0; q < L.segs.length; q++) {                  // el pasillo: primero con borde, luego sin él (las uniones quedan limpias)
        fr = L.full[q]; if (fr[3] < y0 || fr[1] > y1) continue;
        fx0 = sd === 1 ? LW - fr[2] : fr[0];
        rr(fx0 - (1 - z) * 3, fr[1] - (1 - z) * 3, fr[2] - fr[0] + (1 - z) * 6, fr[3] - fr[1] + (1 - z) * 6, 0, z ? pal.desc : pal.borde, 0);
      }
      for (q = 0; q < L.segs.length; q++) {                                       // escalones pintados (los descansos quedan lisos)
        g = L.segs[q]; fr = L.full[q];
        if (fr[3] < y0 || fr[1] > y1) continue;
        if (g.d === 'u') for (z = 0; z * 18 < g.len; z++) {
          var sy = g.ay - (z + 1) * 18; if (sy < y0 - 20 || sy > y1) continue;
          rr(X(sd, g.ax) - CW / 2 + 2, sy, CW - 4, 16, 2, pal.esc[(z + q * 2) % pal.esc.length], 0);
          line([[X(sd, g.ax) - CW / 2 + 2, sy + 16], [X(sd, g.ax) + CW / 2 - 2, sy + 16]], 2, pal.borde);
        }
      }
      /* la puerta de la tía y el letrero */
      var pe = L.pts[L.pts.length - 1], gl = L.segs[L.segs.length - 1], dX = X(sd, pe[0] + gl.dx * (CW / 2 + 4)), dY = pe[1] + gl.dy * (CW / 2 + 4);
      if (dY > y0 - 80 && dY < y1 + 80) {
        rr(dX - 26, dY - 26, 52, 52, 4, '#8a4a2a', 3); rr(dX - 18, dY - 18, 36, 36, 3, '#c97a3a', 2); ell(dX + 10, dY, 3, 3, '#ffd23f', 0);
        c.util.pj('mama', dX, dY - 40, 30, { animo: T.arr ? 'celebrar' : null, sombra: false });
        rr(dX - 58, dY + 30, 116, 22, 3, '#fffdf2', 2.5); txt('SE VENDE NEVERA,', dX, dY + 36, 8, INK, 0, true); txt('PREGUNTE', dX, dY + 46, 8, '#d93a3a', 0, true);
      }
      /* tendederos */
      for (q = 0; q < cuerdas.length; q++) {
        var cu = cuerdas[q]; if (cu.y < y0 || cu.y > y1) continue;
        var xa = Math.min(X(sd, cu.x0), X(sd, cu.x1)) - 4, xb = Math.max(X(sd, cu.x0), X(sd, cu.x1)) + 4;
        ell(xa, cu.y, 4, 4, '#6b5a48', 2); ell(xb, cu.y, 4, 4, '#6b5a48', 2);
        line([[xa, cu.y], [xb, cu.y]], 2, '#fffdf2');
        for (z = 0; z < 4; z++) rr(xa + 10 + z * 16, cu.y - 2, 11, 12, 2, ['#ff5c8a', '#ffd23f', '#4fd06a', '#5cb8ff'][(z + q) % 4], 2);
      }
      /* moto: franja de aviso y moto */
      var mo = motoAt(kV());
      if (mo) {
        var op = offPl[mo.sd], P2 = [];
        for (z = 0; z < op.P.length; z++) P2.push([X(sd, op.P[z][0]), op.P[z][1]]);
        ctx.save(); ctx.globalAlpha = mo.ph === 1 ? 0.25 + 0.2 * Math.abs(Math.sin(at * 10)) : 0.22; line(P2, 30, '#ff3b4e'); ctx.restore();
        if (mo.ph === 2 && mo.y > y0 - 40 && mo.y < y1 + 40) {
          var mx = X(sd, mo.x), my = mo.y;
          rr(mx - 9, my - 18, 18, 36, 6, '#2b2540', 3); ell(mx, my - 18, 6, 4, '#fffdf2', 2); ell(mx, my + 18, 6, 4, '#14101c', 2);
          ell(mx, my + 2, 9, 9, '#d93a3a', 2.5); ell(mx, my - 1, 6, 6, '#ffd23f', 2);
          txt('¡PI PI!', mx, my - 34, 10, '#fffdf2', 0, true);
        }
      }
      /* perro */
      var dg = perroAt(kV());
      if (dg && dg.y > y0 && dg.y < y1) {
        var gx = X(sd, dg.x), gd = (sd === 1 ? -dg.dir : dg.dir), wob = dg.mov ? Math.sin(at * 30) * 2 : 0;
        ell(gx, dg.y + wob, 12, 8, '#a8743a', 2.5); ell(gx + gd * 12, dg.y - 2, 7, 6, '#c08a4a', 2.5); ell(gx + gd * 15, dg.y - 7, 3, 4, '#6a4a2a', 0);
        line([[gx - gd * 11, dg.y], [gx - gd * 18, dg.y - 6 + Math.sin(at * 20) * 3]], 3, '#a8743a');
        if (dg.mov) txt('¡GUAU!', gx, dg.y - 22, 10, '#fffdf2', 0, true);
      }
      sofa(sd);
      for (q = 0; q < fxs.length; q++) {
        var fq = fxs[q]; if (fq.sd !== sd) continue;
        if (fq.k === 'ray') { ctx.save(); ctx.globalAlpha = 1 - fq.t / 0.9; ell(X(sd, fq.x), fq.y, 20 + fq.t * 60, 12 + fq.t * 30, '#fffdf2', 0); ctx.restore(); txt('¡RAYÓN!', X(sd, fq.x), fq.y - 46 - fq.t * 24, 18, '#ffd23f', 0, true); }
        else txt('¡SUELTA!', X(sd, fq.x), fq.y - 52 - fq.t * 20, 13, '#ff6b6b', 0, true);
      }
      ctx.restore();
    }
    function sofa(sd) {
      var T = st.T[sd], ax = X(sd, T.ax), ay = T.ay, bx = X(sd, T.bx), by = T.by, dx = ax - bx, dy = ay - by, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      var pa = seatEnd(sd, 0), pb = seatEnd(sd, 1), upA = pa >= 0 && st.P[pa].up, upB = pb >= 0 && st.P[pb].up, alto = (upA && upB) ? 6 : (upA || upB) ? 3 : 0;
      var wob = T.fz > 6 ? Math.sin(at * 40) * 2 : 0, stopW = T.stop > 0 ? Math.sin(at * 50) * 1.5 : 0, hw = 12, ex = 6, col = sofaCol(sd), q;
      function quad(o0, o1, w0, w1, h) { return [[bx + ux * o0 + nx * w0, by + uy * o0 + ny * w0 - h], [bx + ux * o1 + nx * w0, by + uy * o1 + ny * w0 - h], [bx + ux * o1 + nx * w1, by + uy * o1 + ny * w1 - h], [bx + ux * o0 + nx * w1, by + uy * o0 + ny * w1 - h]]; }
      poly(quad(-ex, len + ex, -hw - 1, hw + 1, -4), 'rgba(0,0,0,.28)', 0);
      ctx.save(); ctx.translate(ux * wob + stopW, uy * wob);
      poly(quad(-ex, len + ex, -hw, hw, alto), col[0], 3);
      poly(quad(-ex, len + ex, hw - 6, hw, alto + 1), col[1], 2);                // respaldo
      poly(quad(-ex, 4, -hw, hw, alto + 1), col[1], 2); poly(quad(len - 4, len + ex, -hw, hw, alto + 1), col[1], 2);   // brazos
      for (q = 0; q < 2; q++) { var o0 = 6 + q * (len - 12) / 2, o1 = o0 + (len - 12) / 2 - 2; poly(quad(o0, o1, -hw + 3, hw - 7, alto + 1), '#fffdf2', 1.5); }
      ctx.restore();
      cargador(sd, 0, ax, ay, ux, uy); cargador(sd, 1, bx, by, -ux, -uy);
    }
    function cargador(sd, e, x, y, ux, uy) {
      var p2 = seatEnd(sd, e); if (p2 < 0) return;
      var s = asiento(p2), P = st.P[p2], fx = x + ux * 16, fy = y + uy * 16, up = P.up, drop = P.drop > 0, T = st.T[sd];
      ell(fx, fy + 4, 12, 6, 'rgba(0,0,0,.25)', 0);
      line([[fx - 6, fy - 14], [x - uy * 8, y + ux * 8 - (up ? 12 : 2)]], 4, '#f0c8a0'); line([[fx + 6, fy - 14], [x + uy * 8, y - ux * 8 - (up ? 12 : 2)]], 4, '#f0c8a0');
      if (drop) { line([[fx - 6, fy - 14], [fx - 18, fy - 30]], 4, '#f0c8a0'); line([[fx + 6, fy - 14], [fx + 18, fy - 30]], 4, '#f0c8a0'); }
      c.util.pj(s.ch, fx, fy - 30, 30, { animo: T.arr ? 'celebrar' : (drop || T.stop > 0 ? 'perder' : null), sombra: false });
      if (p2 === c.yo) poly([[fx - 7, fy - 66], [fx + 7, fy - 66], [fx, fy - 56]], '#ffd23f', 3);
      else if (c.yo >= 0 && c.yo < n && side[p2] === side[c.yo]) txt('PANA', fx, fy - 62, 9, '#fffdf2', 0, true);
      if (up) txt('¡ARRIBA!', fx, fy - 74, 9, '#7dff9a', 0, true);
    }
    function kV() { return isJudge() ? st.k : st.k + Math.round(lagEst > 0 ? lagEst * TK : 0); }
    function draw() {
      var l = lay(), f = l.f, cx = l.cx, sd, q;
      fondo(l);
      carril(l, 0); carril(l, 1);
      rr(f.x0, 0, l.vw, l.top - 2, 0, pal.cielo, 0); fondoTop(l);
      /* marcador: progreso de cada equipo y rayones */
      for (sd = 0; sd < 2; sd++) {
        var T = st.T[sd], bx0 = laneX(l, sd), bw = LW * l.z, pr = scSide(sd) / SMAXe;
        rr(bx0, l.top - 34, bw, 28, 8, INK, 3);
        rr(bx0 + 4, l.top - 30, Math.max(4, (bw - 8) * cl(pr, 0, 1)), 20, 6, sideColor(sd), 0);
        txt(sideName(sd) + (T.arr ? ' · ¡LLEGÓ!' : ' · ' + Math.round(cl(pr, 0, 1) * 100) + '%'), bx0 + bw / 2, l.top - 20, 12, '#fffdf2', 0, true);
        if (T.ray) txt('RAYONES: ' + T.ray, bx0 + bw / 2, l.top + 12, 11, '#ffd23f', 0, true);
      }
      var mi = (c.yo >= 0 && c.yo < n) ? side[c.yo] : -1;
      if (mi >= 0 && endOf[c.yo] >= 0 && c.ahora() < 4) txt('TÚ CARGAS LA PUNTA DE ' + (endOf[c.yo] === 0 && mate[c.yo] >= 0 ? 'ADELANTE' : mate[c.yo] >= 0 ? 'ATRÁS' : 'LAS DOS'), cx, l.top + 30, 13, '#fffdf2', 0, true);
      if (mi >= 0) {                                                            // aviso de tendedero para mi equipo
        var Tm = st.T[mi], sA = proj(L, Tm.ax, Tm.ay).s;
        for (q = 0; q < cuerdas.length; q++) if (sA > cuerdas[q].s - 70 && sA < cuerdas[q].s + 10 && !Tm.arr) txt('¡TENDEDERO! LOS DOS MANTENGAN A', laneX(l, mi) + LW * l.z / 2, l.top + 46, 13, '#7dff9a', 0, true);
      }
      if (bannerT > 0 && banner) txt(banner.s, cx, l.top + 70, Math.min(28, 0.92 * l.vw / (0.62 * banner.s.length + 1)) * (1 + Math.sin(at * 14) * 0.05), banner.col, 0, true);
      if (allDone()) { var s0_ = scSide(0), s1_ = scSide(1); txt(s0_ === s1_ ? '¡EMPATE!' : '¡GANÓ EL EQUIPO ' + sideName(s0_ > s1_ ? 0 : 1) + '!', cx, l.top + 100, Math.min(28, 0.07 * l.vw + 8), s0_ === s1_ ? '#ffd23f' : sideColor(s0_ > s1_ ? 0 : 1), 0, true); }
      if (c.ahora() >= -0.4 && c.ahora() < 1.6 && !c.practica) txt('¡A PULSO, QUE EL CAMIÓN NO SUBE!', cx, 84, Math.min(18, 0.92 * l.vw / 26), '#fffdf2', 0, true);
      if (typeof drawP === 'function') drawP();
    }
    function fondoTop(l) {
      var f = l.f, w = l.vw, q, pts = [[f.x0, l.top - 2]];
      for (q = 0; q <= 10; q++) pts.push([f.x0 + w * q / 10, 66 + ((q * 37) % 23) + (q % 3) * 8]);
      pts.push([f.x1, l.top - 2]); poly(pts, pal.cerro, 0);
      for (q = 0; q < 9; q++) { var hx = f.x0 + (q + 0.5) * w / 9; rr(hx - 12, 78 + (q % 3) * 6, 24, 18, 1, pal.muro[q % 6], 2); if (pal.luz) rr(hx - 4, 82 + (q % 3) * 6, 7, 6, 1, pal.ventana, 0); }
    }

    function tiempoDe(sd) { var T = st.T[sd]; return T.arr ? (T.arr / TK).toFixed(1).replace('.', ',') : null; }
    return {
      update: update, draw: draw, ai: ai, predict: predict,
      step: step, pack: pack, unpack: load, restore: load, lerp: lerp,
      scores: scores,
      done: function () { return allDone(); },
      vivo: function () { return true; },
      alCpu: function (pp) { if (cpr[pp]) { cpr[pp].next = 0; cpr[pp].pause = 0; cpr[pp].unj = 0; } }, alHum: function () {},
      hudChip: function (pp) { var sd = side[pp]; if (sd === undefined) return ''; return st.T[sd].arr ? 'LLEGÓ' : Math.round(cl(scSide(sd) / SMAXe, 0, 1) * 100) + '%'; },
      destacado: function () {
        var a = arrTicks(), q, w = -1;
        for (q = 0; q < 2; q++) if (st.T[q].arr && st.T[q].arr === a) w = q;
        if (w >= 0) return '¡Sofá ' + sideName(w) + ' entregado en ' + tiempoDe(w) + ' s! Rayones: ' + st.T[w].ray;
        return 'Nadie llegó: la tía sigue esperando su sofá';
      },
      vista: function () {
        var o = { k: st.k, lv: lv, variante: vr, Ls: Ls, L: L.L, fin: fin, s0: s0, SMAX: SMAXe, durT: durT, pts: L.pts.map(function (x) { return x.slice(); }), H: L.H, LW: LW,
          cuerdas: cuerdas.map(function (x) { return { s: x.s, x0: x.x0, x1: x.x1, y: x.y }; }), perro: perro ? { x: perro.x, y: perro.y, s: perro.s } : null, perroAt: perroAt(st.k), motos: motos.map(function (m) { return { t: m.t, sd: m.sd }; }),
          moto: motoAt(st.k), guia: { n: GU.s.length, ok: GU.ok }, sc: scores(), side: side.slice(), endOf: endOf.slice(), equipos: teams.slice(), T: [], P: [] }, q;
        for (q = 0; q < 2; q++) { var T = st.T[q]; o.T.push({ ax: T.ax, ay: T.ay, bx: T.bx, by: T.by, stop: T.stop, imm: T.imm, ray: T.ray, arr: T.arr, mhit: T.mhit, fz: T.fz, s: centroS(T), len: Math.sqrt((T.ax - T.bx) * (T.ax - T.bx) + (T.ay - T.by) * (T.ay - T.by)), prog: progreso(q),
          mundo: { ax: q === 1 ? LW - T.ax : T.ax, ay: T.ay, bx: q === 1 ? LW - T.bx : T.bx, by: T.by } }); }
        for (q = 0; q < n; q++) o.P.push({ drop: st.P[q].drop, dimm: st.P[q].dimm, up: st.P[q].up });
        return o;
      }
    };
  }
});
})();
