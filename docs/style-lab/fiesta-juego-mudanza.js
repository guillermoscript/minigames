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
/* LA ESCALERA CAMBIA: estorbos que aparecen durante el juego (sembrados en mk, iguales en los dos carriles) y el aguacero */
var OB_WARN = 27, OB_IN = 4, OB_HIT = 21;                         // aviso 0,9 s · el estorbo tapa la mitad del pasillo (desvío > 4 px) · si aparece encima: 0,7 s quieto
var SLIP = 0.8;                                                   // aguacero: px/tick que resbala escalera abajo la punta que no empuja
var FASES = [0, 0.15, 0.33, 0.6], VEL_F = [1, 1, 1.08, 1.16];   // fases por fracción de dur (calma · se complica · recta final · últimos segundos) y su velocidad
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
function bloq(obs, x, y) {                                   // ¿el punto cae en un estorbo activo? (inflado por el grosor del sofá)
  var i, b, dx, dy, u, o;
  for (i = 0; i < obs.length; i++) {
    b = obs[i].b; dx = x - b.x; dy = y - b.y; u = dx * b.tx + dy * b.ty;
    if (u <= -b.hl - MG || u >= b.hl + MG) continue;
    o = (dx * b.nx + dy * b.ny) * obs[i].sg;
    if (o > OB_IN - MG) return true;
  }
  return false;
}
function valido(L, ax, ay, bx, by, cuerdas, arriba, obs) {
  var i, ob = obs && obs.length ? obs : null;
  for (i = 0; i < NS; i++) { var t = i / (NS - 1), x = ax + (bx - ax) * t, y = ay + (by - ay) * t; if (!inside(L, x, y) || (ob && bloq(ob, x, y))) return false; }
  if (cuerdas && !arriba) for (i = 0; i < cuerdas.length; i++) { var c = cuerdas[i]; if (cruza(ax, ay, bx, by, c.x0, c.y, c.x1, c.y)) return false; }
  return true;
}
function proyecta(ax, ay, bx, by, wA, wB, Ls) {             // barra rígida: reparte el error de largo por peso
  var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1, err = len - Ls, ux = dx / len, uy = dy / len, fa = wA / (wA + wB), fb = wB / (wA + wB);
  return [q4(ax + ux * err * fa), q4(ay + uy * err * fa), q4(bx - ux * err * fb), q4(by - uy * err * fb)];
}
var CAND = [[1, 1], [0.5, 0.5], [2, 2], [3, 3], [1, 0], [0, 1]];   // completo · medio · solo x · solo y · solo adelante · solo atrás (resbalar contra la pared)
function mover(L, T, dA, dB, Ls, cuerdas, arriba, obs) {
  var ok0 = valido(L, T[0], T[1], T[2], T[3], null, true, obs), i, F = null;  // paredes y estorbos: si la pose ya es inválida (le cayó un estorbo encima) se deja salir; bajo un tendedero sin levantar, NO
  for (i = 0; i < CAND.length; i++) {
    var ca = CAND[i][0], cb = CAND[i][1];
    var ax = ca === 2 ? dA[0] : ca === 3 ? 0 : dA[0] * ca, ay = ca === 2 ? 0 : ca === 3 ? dA[1] : dA[1] * ca;
    var bx = cb === 2 ? dB[0] : cb === 3 ? 0 : dB[0] * cb, by = cb === 2 ? 0 : cb === 3 ? dB[1] : dB[1] * cb;
    if (ax === 0 && ay === 0 && bx === 0 && by === 0) { if (i === 0) return { p: T.slice(0, 4), full: true, F: T.slice(0, 4), c: 0 }; continue; }
    var P = proyecta(T[0] + ax, T[1] + ay, T[2] + bx, T[3] + by, (ax || ay) ? 1 : WIDLE, (bx || by) ? 1 : WIDLE, Ls);
    if (i === 0) F = P;
    if (!ok0 || valido(L, P[0], P[1], P[2], P[3], cuerdas, arriba, obs)) return { p: P, full: i === 0, F: F, c: i };
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
    /* ───── LA ESCALERA CAMBIA (sembrado: c.rng después de los 24 de siempre; idéntico en los dos carriles y en todas las pantallas) ─────
       Fases por tiempo: 0 calma · 1 «¡SE COMPLICA EL CERRO!» · 2 «¡RECTA FINAL!» (todo más rápido) · 3 «¡ÚLTIMOS SEGUNDOS!» (más rápido, lluvia hasta el final).
       Estorbos en los tramos de escalones, cada uno tapa MEDIA escalera (sg = el lado tapado) y hay que pasar pegado al otro lado:
         · puerta: la vecina abre la puerta hacia la escalera (abre y cierra; cada vez más seguido)
         · pared: se cae un pedazo de muro (para siempre)          · moto: el vecino parquea la moto (para siempre, Nv2+)
         · obra: ESCALONES FLOJOS, se hunde un lado y luego el otro (Nv2+; cada vez más rápido)
       Cada intervalo avisa OB_WARN ticks antes; si aparece ENCIMA del sofá: ¡RAYÓN! de 0,7 s (y el sofá puede salirse). Más estorbos cuanto más arriba.
       Aguacero: la punta que no empuja resbala escalera abajo (SLIP). */
    var RE = []; for (i = 0; i < 40; i++) RE.push(rng.next());
    var FK = [0, Math.round(FASES[1] * durT), Math.round(FASES[2] * durT), Math.round(FASES[3] * durT)];
    function faseDe(k) { return k >= FK[3] ? 3 : k >= FK[2] ? 2 : k >= FK[1] ? 1 : 0; }
    var usados = []; cuerdas.forEach(function (cu) { usados.push([cu.s, 34]); }); if (perro) usados.push([perro.s, 20]);
    function sitio(f0, f1, r, hl) {                              // un punto de un tramo 'u' con el sofá ya derecho antes y después; lejos de tendederos, perro y otros estorbos
      var cand = [], todos = [], q, g, sv, z, ok;
      for (q = 0; q < L.segs.length; q++) {
        g = L.segs[q]; if (g.d !== 'u') continue;
        for (sv = g.s0 + CW / 2 + 0.6 * Ls + hl; sv + hl + Ls <= g.s0 + g.len; sv += 6) {
          ok = true; for (z = 0; z < usados.length; z++) if (Math.abs(sv - usados[z][0]) < hl + usados[z][1] + 40) ok = false;
          if (!ok) continue;
          todos.push(sv); if (sv >= f0 * L.L && sv <= f1 * L.L) cand.push(sv);
        }
      }
      if (!cand.length) cand = todos;
      if (!cand.length) return -1;
      return cand[Math.min(cand.length - 1, Math.floor(r * cand.length))];
    }
    var estorbos = [], lluvias = [];
    function estorbo(kind, f0, f1, r, rs, hl, ivs) {
      var sv = sitio(f0, f1, r, hl); if (sv < 0) return null;
      var pq = punto(L, sv), g = L.segs[pq.seg], sg = rs < 0.5 ? -1 : 1;
      usados.push([sv, hl]);
      var b = { k: kind, s: sv, x: pq.x, y: pq.y, tx: g.dx, ty: g.dy, nx: -g.dy, ny: g.dx, hl: hl, sg: sg, iv: [] };
      ivs(b); if (b.iv.length) estorbos.push(b);
      return b;
    }
    var T2 = TK;
    /* puerta de la vecina: abierta 2,2 s, cerrada 3,6 s → 2,4 s → 1,6 s según la fase */
    function puertaIv(t0) { return function (b) { var t = t0; while (t < durT) { var fa = faseDe(t), ab = Math.round(2.2 * T2); b.iv.push([t, t + ab, b.sg]); t += ab + Math.round((fa >= 3 ? 1.6 : fa >= 2 ? 2.4 : 3.6) * T2); } }; }
    estorbo('puerta', 0.25, 0.55, RE[0], RE[1], 14, puertaIv(FK[1] + Math.round((0.5 + RE[2]) * T2)));
    estorbo('pared', 0.5, 0.85, RE[3], RE[4], 16, function (b) { b.iv.push([FK[1] + Math.round((2 + 3 * RE[5]) * T2), 1e9, b.sg]); });
    if (lv >= 2) {
      estorbo('moto', 0.3, 0.7, RE[6], RE[7], 22, function (b) { b.iv.push([FK[2] + Math.round((0.5 + 2 * RE[8]) * T2), 1e9, b.sg]); });
      estorbo('obra', 0.6, 0.95, RE[9], RE[10], 26, function (b) {        // se hunde un lado y luego el otro; cada vez más rápido
        var t = lv >= 3 ? FK[1] + Math.round((3 + 2 * RE[11]) * T2) : FK[2], sg = b.sg;
        while (t < durT) { var fa = faseDe(t), per = Math.round((fa >= 3 ? 1.4 : fa >= 2 ? 2 : 2.6) * T2); b.iv.push([t, t + per, sg]); t += per; sg = -sg; }
      });
    }
    if (lv >= 3) estorbo('puerta', 0.7, 0.97, RE[12], RE[13], 14, puertaIv(FK[2] + Math.round((0.3 + RE[14]) * T2)));
    if (lv >= 2) { var l0 = FK[1] + Math.round((2 + 3 * RE[15]) * T2); lluvias.push([l0, l0 + Math.round(4 * T2)]); }
    var l1 = FK[2] + Math.round((0.5 + 2 * RE[16]) * T2); lluvias.push([l1, l1 + Math.round(6 * T2)]);
    lluvias.push([FK[3], durT + TK * 10]);
    function obsAt(k) {                                          // estorbos activos en el tick k: [{b, sg, a (tick en que apareció)}]
      var out = [], q, z, b, iv;
      for (q = 0; q < estorbos.length; q++) { b = estorbos[q]; for (z = 0; z < b.iv.length; z++) { iv = b.iv[z]; if (k >= iv[0] && k < iv[1]) { out.push({ b: b, sg: iv[2], a: iv[0], z: z }); break; } if (iv[0] > k) break; } }
      return out;
    }
    function avisosAt(k, w) {                                    // los que van a aparecer en ≤ w ticks: [{b, sg, rem, z}]
      var out = [], q, z, b, iv;
      for (q = 0; q < estorbos.length; q++) { b = estorbos[q]; for (z = 0; z < b.iv.length; z++) { iv = b.iv[z]; if (iv[0] > k) { if (iv[0] - k <= w) out.push({ b: b, sg: iv[2], rem: iv[0] - k, z: z }); break; } } }
      return out;
    }
    function lluviaAt(k) { for (var q = 0; q < lluvias.length; q++) if (k >= lluvias[q][0] && k < lluvias[q][1]) return 1; else if (k >= lluvias[q][0] - OB_WARN && k < lluvias[q][0]) return -1; return 0; }
    function enEscalon(s) { for (var q = 0; q < L.segs.length; q++) if (s < L.segs[q].s0 + L.segs[q].len || q === L.segs.length - 1) return L.segs[q].d === 'u'; return false; }
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
    var ACT = [], ACT_K = -1;
    function actK(k) { if (ACT_K !== k) { ACT = obsAt(k); ACT_K = k; } return ACT; }
    function stepTeam(sd, k) {
      var T = st.T[sd]; if (T.arr) return;
      var act = actK(k), vf = VEL_F[faseDe(k)], llueve = lluviaAt(k) === 1;
      var pa = seatEnd(sd, 0), pb = seatEnd(sd, 1), solo = pa === pb, eA = entrada(pa, sd), eB = solo ? eA : entrada(pb, sd), PA = pa >= 0 ? st.P[pa] : null, PB = pb >= 0 ? st.P[pb] : null;
      var dropA = PA && PA.drop > 0, dropB = PB && PB.drop > 0 && !solo || (solo && dropA);
      var upA = eA.a && !dropA, upB = eB.a && !dropB;
      if (PA) PA.up = upA ? 1 : 0; if (PB && !solo) PB.up = upB ? 1 : 0;
      var fA = dropA ? 0 : SPD * vf * (upA ? UPF : 1), fB = dropB ? 0 : SPD * vf * (upB ? UPF : 1);
      var dA = [eA.x * fA, eA.y * fA], dB = [eB.x * fB, eB.y * fB], quiere = !!(dA[0] || dA[1] || dB[0] || dB[1]);
      if (llueve) {                                              // aguacero: la punta que no empuja resbala escalera abajo
        if (!(dA[0] || dA[1]) && enEscalon(proj(L, T.ax, T.ay).s)) dA[1] += SLIP;
        if (!(dB[0] || dB[1]) && enEscalon(proj(L, T.bx, T.by).s)) dB[1] += SLIP;
      }
      if (T.imm > 0) T.imm--;
      if (T.stop > 0) { T.stop--; T.fz = Math.max(0, T.fz - 2); }
      else {
        var cur = [T.ax, T.ay, T.bx, T.by], r = mover(L, cur, dA, dB, Ls, cuerdas, upA && upB, act);
        /* forcejeo: las dos puntas tiran en sentidos contrarios a lo largo del sofá */
        var ux = (T.ax - T.bx) / Ls, uy = (T.ay - T.by) / Ls, ca = dA[0] * ux + dA[1] * uy, cb = dB[0] * ux + dB[1] * uy;
        if (ca * cb < 0 && Math.abs(ca) > 0.45 * SPD * UPF && Math.abs(cb) > 0.45 * SPD * UPF) T.fz = Math.min(250, T.fz + 1); else T.fz = Math.max(0, T.fz - 2);
        var Df = r.F ? Math.abs(r.F[0] - T.ax) + Math.abs(r.F[1] - T.ay) + Math.abs(r.F[2] - T.bx) + Math.abs(r.F[3] - T.by) : 0;
        var Dg = Math.abs(r.p[0] - T.ax) + Math.abs(r.p[1] - T.ay) + Math.abs(r.p[2] - T.bx) + Math.abs(r.p[3] - T.by);
        if (quiere && !r.full && r.c !== 1 && Df > RAY_MIN && Dg < 0.5 * Df && T.imm === 0) { T.stop = RAY_STOP; T.imm = RAY_STOP + RAY_IMM; T.ray = Math.min(99, T.ray + 1); }
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
      /* un estorbo que aparece ENCIMA del sofá (la puerta que se abre, el escalón que se hunde, la pared que cae): ¡RAYÓN! */
      for (q = 0; q < act.length; q++) {
        if (act[q].a !== k) continue;
        if (!valido(L, T.ax, T.ay, T.bx, T.by, null, true, [act[q]])) { T.stop = Math.max(T.stop, OB_HIT); T.imm = Math.max(T.imm, OB_HIT + RAY_IMM); T.ray = Math.min(99, T.ray + 1); }
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
      var e = entrada(c.yo, sd), f = SPD * VEL_F[faseDe(st.k)] * (e.a ? UPF : 1) * t * 0.4, dx = cl(e.x * f, -10, 10), dy = cl(e.y * f, -10, 10);
      if (valido(L, T.ax + dx, T.ay + dy, T.bx + dx, T.by + dy, null, true, obsAt(kV()))) { T.ax += dx; T.ay += dy; T.bx += dx; T.by += dy; }
    }

    /* ───────────────────────── CPU ───────────────────────── */
    // Cada punta CPU persigue SU punta de la guía LOOK ticks adelante. Índice de la guía: el más parecido a la pose actual (las dos puntas; con pana humano, la punta del humano).
    // Reacción cada 0,06+0,22·(1−skill) s (con humano 0,15+0,35·(1−skill)); error de puntería ±14·(1−skill) px; velocidad 0,78+0,22·skill; despiste 1,2 %·(1−skill) por tick (0,3-0,6 s).
    // Tendedero: levanta a tiempo con prob. 0,65+0,3·skill, si no tras el rayón. Moto: se corre a la pared segura con prob. 0,55+0,45·skill. Trabada 1,2 s: retrocede por la guía.
    var cpr = []; for (p = 0; p < n; p++) cpr.push({ r: c.rngFor('cpu' + p), gi: 0, t: 0, next: 0, nx: 0, ny: 0, pause: 0, unj: 0, best: 0, bestT: 0, cOk: [], cRay: [], mOk: -1, mSeen: -1, perroOk: -1, perroK: -1, obOk: {} });
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
      var T = st.T[sd], cur = [T.ax, T.ay, T.bx, T.by], i2, j2, h, best = -1e18, bi = 0, bj = 0, he = null, up = false, q, act = obsAt(st.k);
      if (hum < 0 && plan[sd].k === st.k && plan[sd].d) return e === 1 ? plan[sd].d[1] : plan[sd].d[0];
      if (hum >= 0) { var eh = entrada(hum, sd); he = [eh.x, eh.y]; }
      for (q = 0; q < n; q++) if (side[q] === sd && st.P[q].up) up = true;
      for (i2 = 0; i2 < 9; i2++) for (j2 = 0; j2 < 9; j2++) {
        if (hum >= 0) { if ((e === 0 ? j2 : i2) > 0) continue; }
        var da = hum >= 0 && e === 1 ? he : DIRS[i2], db = hum >= 0 && e === 0 ? he : DIRS[j2];
        if (!(da[0] || da[1] || db[0] || db[1])) continue;
        var U = cur, bad = 0, f = SPD * (up ? UPF : 1), dA = [da[0] * f, da[1] * f], dB = [db[0] * f, db[1] * f];
        for (h = 0; h < 8; h++) { var r = mover(L, U, dA, dB, Ls, cuerdas, up, act); if (!r.full) bad++; U = r.p; }
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
      /* estorbos (activos o avisando) en el tramo que ocupa o va a ocupar el sofá: pegarse al lado libre (si lo ve a tiempo; si no, tras el rayón) */
      var sA0 = proj(L, T.ax, T.ay).s, sB0 = proj(L, T.bx, T.by).s, sLo = Math.min(sA0, sB0) - 12, sHi = Math.max(sA0, sB0) + 70, oa = actK(k), ow = avisosAt(k, OB_WARN + 12), visto = {}, ob;
      for (q = 0; q < oa.length; q++) {
        ob = oa[q]; if (ob.b.s + ob.b.hl < sLo || ob.b.s - ob.b.hl > sHi) continue;
        var kO = ob.b.s + ':' + ob.z;
        if (A.obOk[kO] === undefined) A.obOk[kO] = A.r.next() < 0.6 + 0.4 * sk ? 1 : 0;
        if (A.obOk[kO] || T.ray > 0 && T.stop > 0) shift = -ob.sg * 18;
        visto[ob.b.s] = 1;
      }
      for (q = 0; q < ow.length; q++) {
        ob = ow[q]; if (visto[ob.b.s] || ob.b.s + ob.b.hl < sLo || ob.b.s - ob.b.hl > sHi) continue;
        var kW = ob.b.s + ':' + ob.z;
        if (A.obOk[kW] === undefined) A.obOk[kW] = A.r.next() < 0.45 + 0.5 * sk ? 1 : 0;
        if (A.obOk[kW]) shift = -ob.sg * 18;
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
      if (!saludo && c.ahora() >= 0) { saludo = true; var pd = v3 ? { y: 150 } : scr(l, 0, L.pts[L.pts.length - 1][0], L.pts[L.pts.length - 1][1]); S_('¡Cuidado con mi sofá!', l.cx, Math.max(130, pd.y), '#fffdf2'); if (lv === 3) banr('¡AHORA ES EL JUEGO DE COMEDOR!', '#ffd23f', 2.2); }
      for (sd = 0; sd < 2; sd++) {
        var T = st.T[sd], cxT = (T.ax + T.bx) / 2, cyT = (T.ay + T.by) / 2, ps = v3 ? p3(sd, cxT, cyT, 2.2) : scr(l, sd, cxT, cyT);
        if (T.ray > prevRay[sd]) { fxs.push({ sd: sd, x: cxT, y: cyT, t: 0, k: 'ray' }); if (!v3) SND(130, 0.16, 'sawtooth', 0.07, -60); if (c.yo >= 0 && c.yo < n && side[c.yo] === sd) S_(T.ray % 2 ? '¡MI SOFÁ!' : '¡AY, MI SOFÁ NUEVO!', ps.x, ps.y - 50, '#ffd23f'); }
        prevRay[sd] = T.ray;
        if (T.arr && !prevArr[sd]) {
          var first = T.arr === arrTicks();
          banr(first ? '¡LLEGÓ EL SOFÁ ' + sideName(sd) + '!' : '¡' + sideName(sd) + ' TAMBIÉN LLEGÓ!', sideColor(sd), 2.4);
          if (!v3) { SPAWN(ps.x, ps.y, 18, 'conf', ['#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a'], 300, 400, 0.9); SND(880, 0.3, 'square', 0.06, 220); }
          if (first && !ganoDicho) { ganoDicho = true; S_('¡Ay, llegó mi sofá!', ps.x, ps.y - 70, '#fffdf2'); }
        }
        prevArr[sd] = T.arr;
        if (T.fz > 18 && at - gagFz[sd] > 5) { gagFz[sd] = at; S_('¡Pa\' tu lado! ¡No, pa\' TU lado!', ps.x, ps.y - 44, '#fffdf2'); }
      }
      for (q = 0; q < n; q++) {
        var P = st.P[q];
        if (P.drop > 0 && !prevDrop[q] && endOf[q] >= 0) { var Tq = st.T[side[q]]; fxs.push({ sd: side[q], x: endOf[q] === 0 ? Tq.ax : Tq.bx, y: endOf[q] === 0 ? Tq.ay : Tq.by, t: 0, k: 'guau' }); if (!v3) { SND(320, 0.08, 'square', 0.05, 160); SND(260, 0.1, 'square', 0.05, 120); } }
        prevDrop[q] = P.drop > 0 ? 1 : 0;
      }
      var mo = motoAt(st.k), mi = mo ? mo.i : -1;
      if (mi !== prevMoto && mo) { banr('¡MOTO BAJANDO! ¡PÉGATE A LA PARED!', '#ff8a3d', 1.6); if (!v3) { SND(520, 0.12, 'square', 0.05, 0); SND(520, 0.12, 'square', 0.05, 0); } }
      prevMoto = mi;
      eventos(kV());
      for (q = fxs.length - 1; q >= 0; q--) { fxs[q].t += dt; if (fxs[q].t > 0.9) fxs.splice(q, 1); }
    }
    /* fases y estorbos: cartel, sonido y sacudida al avisar y al aparecer (solo presentación; todo sale de k) */
    var prevFase = 0, avisado = {}, aparecio = {}, dichoK = {}, prevLluvia = 0, flash = 0;
    var TXT_OB = { puerta: '¡LA VECINA ABRE LA PUERTA! ¡PASA POR EL OTRO LADO!', pared: '¡SE CAYÓ UNA PARED! ¡CAMBIA DE LADO!', moto: '¡EL VECINO PARQUEÓ LA MOTO! ¡POR EL OTRO LADO!', obra: '¡ESCALONES FLOJOS! SE HUNDE UN LADO Y LUEGO EL OTRO' };
    var ONO = { puerta: '¡ÑIIIC!', pared: '¡CRAC!', moto: '¡RRRUM!', obra: '¡SE HUNDE!' };
    function sfx(k, f, d) { if (v3) V3.sfx(k); else SND(f || 300, d || 0.12, 'square', 0.05, 0); }
    function eventos(kk) {
      if (c.ahora() < 0) return;
      var fa = faseDe(kk), q, it, key;
      if (fa > prevFase) {
        prevFase = fa;
        banr(['', '¡SE COMPLICA EL CERRO!', '¡RECTA FINAL! ¡MÁS RÁPIDO!', '¡ÚLTIMOS SEGUNDOS!'][fa], ['', '#ffd23f', '#ff8a3d', '#ff4f6a'][fa], 2);
        sfx('silbato', 880, 0.25); if (v3) { V3.sfx('tambor'); v3.esc.sacudir(0.6); }
      }
      var av = avisosAt(kk, OB_WARN);
      for (q = 0; q < av.length; q++) {
        it = av[q]; key = it.b.s + ':' + it.z; if (avisado[key]) continue; avisado[key] = 1;
        if (!dichoK[it.b.s]) { dichoK[it.b.s] = 1; banr(TXT_OB[it.b.k], '#ffb35c', 2); }
        sfx(it.b.k === 'moto' ? 'bocina' : it.b.k === 'pared' ? 'trueno' : 'tic', 600, 0.08);
      }
      var ac = obsAt(kk);
      for (q = 0; q < ac.length; q++) {
        it = ac[q]; key = it.b.s + ':' + it.z; if (aparecio[key]) continue; aparecio[key] = 1;
        if (it.b.k === 'pared') { sfx('caida', 110, 0.3); if (v3) { V3.sfx('golpe'); v3.esc.sacudir(0.9); } }
        else if (it.b.k === 'moto') sfx('motor', 200, 0.2);
        else if (it.b.k === 'obra') sfx('resbalon', 180, 0.12);
        else sfx('whoosh', 400, 0.1);
      }
      var ll = lluviaAt(kk);
      if (ll !== prevLluvia) {
        if (ll === -1) { banr('¡AGUACERO! SI NO EMPUJAN, EL SOFÁ RESBALA', '#8fd8ff', 2); sfx('trueno', 90, 0.4); flash = 0.5; if (v3) v3.esc.sacudir(0.4); }
        else if (ll === 1 && prevLluvia === 0) { sfx('trueno', 90, 0.4); flash = 0.5; }
        prevLluvia = ll;
      }
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
      /* estorbos: lo que tapa media escalera (y su aviso parpadeando) */
      var kv2 = kV(), oa2 = obsAt(kv2), ow2 = avisosAt(kv2, OB_WARN);
      for (q = 0; q < ow2.length; q++) {
        var bw = ow2[q].b, xw0 = X(sd, bw.x + ow2[q].sg * OB_IN), xw1 = X(sd, bw.x + ow2[q].sg * CW / 2);
        ctx.save(); ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(at * 12)); rr(Math.min(xw0, xw1), bw.y - bw.hl, Math.abs(xw1 - xw0), 2 * bw.hl, 3, '#ff3b4e', 0); ctx.restore();
        txt(ONO[bw.k], X(sd, bw.x), bw.y - bw.hl - 10, 11, '#ffd23f', 0, true);
      }
      for (q = 0; q < oa2.length; q++) {
        var bo = oa2[q].b, xo0 = X(sd, bo.x + oa2[q].sg * OB_IN), xo1 = X(sd, bo.x + oa2[q].sg * CW / 2), xo = Math.min(xo0, xo1), wo = Math.abs(xo1 - xo0);
        if (bo.k === 'puerta') { rr(xo, bo.y - bo.hl, wo, 2 * bo.hl, 2, '#8a4a2a', 2.5); ell(xo + wo / 2, bo.y, 3, 3, '#ffd23f', 0); }
        else if (bo.k === 'pared') { rr(xo, bo.y - bo.hl, wo, 2 * bo.hl, 2, '#b5653a', 2.5); line([[xo, bo.y], [xo + wo, bo.y]], 1.5, INK); }
        else if (bo.k === 'moto') { rr(xo + 4, bo.y - bo.hl, wo - 8, 2 * bo.hl, 6, '#2b2540', 2.5); rr(xo + wo / 2 - 5, bo.y - 6, 10, 12, 2, '#d93a3a', 0); }
        else { rr(xo, bo.y - bo.hl, wo, 2 * bo.hl, 2, '#2a1e18', 2.5); ell(xo + wo / 2, bo.y, 6, 6, '#ff8a3d', 2); }
      }
      if (lluviaAt(kv2) === 1) { ctx.save(); ctx.globalAlpha = 0.35; for (q = 0; q < 26; q++) { var rx2 = (q * 53 + at * 40) % LW, ry2 = y0 + ((q * 97 + at * 520) % (y1 - y0)); line([[rx2, ry2], [rx2 - 4, ry2 + 14]], 1.5, '#cfeaff'); } ctx.restore(); }
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
      var l = lay();
      if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
      if (v3) return dibujar3D(l);
      dibujar2D(l);
    }
    function dibujar2D(l) {                                                     // el 2D de siempre (sin WebGL o con ?plano=1)
      fondo(l);
      carril(l, 0); carril(l, 1);
      rr(l.f.x0, 0, l.vw, l.top - 2, 0, pal.cielo, 0); fondoTop(l);
      hud(l);
    }
    function hud(l) {                                                           // textos y marcador: iguales en 2D y en 3D
      var f = l.f, cx = l.cx, sd, q;
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
      if (mi >= 0 && !st.T[mi].arr) {                                          // avisos de la escalera que cambia, para mi equipo
        var Tn = st.T[mi], kh = kV(), sL = Math.min(proj(L, Tn.ax, Tn.ay).s, proj(L, Tn.bx, Tn.by).s) - 10, sH = Math.max(proj(L, Tn.ax, Tn.ay).s, proj(L, Tn.bx, Tn.by).s) + 90, oh = obsAt(kh).concat(avisosAt(kh, OB_WARN)), cerca = false;
        for (q = 0; q < oh.length; q++) if (oh[q].b.s + oh[q].b.hl > sL && oh[q].b.s - oh[q].b.hl < sH) cerca = true;
        if (cerca) txt('¡PÉGUENSE AL LADO LIBRE!', laneX(l, mi) + LW * l.z / 2, l.top + 128, 13, '#ffb35c', 0, true);
        else if (lluviaAt(kh) === 1) txt('¡LLUEVE! ¡NO DEJEN DE EMPUJAR!', laneX(l, mi) + LW * l.z / 2, l.top + 128, 13, '#8fd8ff', 0, true);
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

    /* ───────────────────────── 3D low poly (fiesta-3d.js): la escalera del cerro en 3D, el camión de la mudanza abajo y la puerta de la tía arriba ─────────────────────────
       Solo dibujo: lee st (sofás, asientos), perroAt/motoAt y las cuerdas; no toca la simulación. Los dos carriles quedan lado a lado (el derecho espejado, igual que en 2D);
       la escalera SUBE de verdad: la altura depende solo de y (los descansos son planos, los tramos 'u' son rampas de escalones). Una cámara sigue a los dos sofás. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ESX = 1 / 18, GM = .6, RISE = 0.45 / 18, Y0 = L.pts[0][1], XIN = 262, YAW = .24, YC = Math.cos(YAW), YS = Math.sin(YAW);   // XIN: borde interior del pasillo (los carriles quedan pegados al centro)
    var RAMPAS = [], hTop = 0;
    (function () {
      var q, h = 0;
      for (q = 0; q < L.segs.length; q++) {
        var g2 = L.segs[q]; if (g2.d !== 'u') continue;
        var a = g2.ay - (q > 0 ? CW / 2 : 0), b = g2.ay - g2.len + (q < L.segs.length - 1 ? CW / 2 : 0), dh = g2.len * RISE;
        RAMPAS.push({ a: a, b: b, h0: h, dh: dh, q: q, ax: g2.ax }); h += dh;
      }
      hTop = h;
    })();
    function HY(y) { var q, r; for (q = 0; q < RAMPAS.length; q++) { r = RAMPAS[q]; if (y >= r.a) return r.h0; if (y > r.b) return r.h0 + (r.a - y) / (r.a - r.b) * r.dh; } return hTop; }
    function WX(sd, x) { return sd === 0 ? -GM / 2 - (XIN - x) * ESX : GM / 2 + (XIN - x) * ESX; }
    function tw(x, y, z) { return { x: x * YC + z * YS, y: y, z: -x * YS + z * YC }; }          // del grupo raíz (girado YAW: vista 3/4) a la escena
    function pro3(x, y, z) { var w = tw(x, y, z); return v3.esc.proyectar(w.x, w.y, w.z); }
    function suelta(x, y, z, n2, op) { var w = tw(x, y, z); v3.part.soltar(w.x, w.y, w.z, n2, op); }
    function WZ(y) { return (y - Y0) * ESX; }
    function p3(sd, x, y, alto) { return pro3(WX(sd, x), HY(y) + alto, WZ(y)); }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', calle: '#5a5a64', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', calle: '#5a4e58', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', calle: '#3a3646', noche: 1 }
    };
    function juntar(lista) {                                   // une cajas ya colocadas en una sola geometría (una malla por color en vez de cientos)
      var pos = [], nor = [], q, j;
      for (q = 0; q < lista.length; q++) {
        var gi = lista[q].index ? lista[q].toNonIndexed() : lista[q], pa = gi.attributes.position.array, na = gi.attributes.normal.array;
        for (j = 0; j < pa.length; j++) { pos.push(pa[j]); nor.push(na[j]); }
      }
      var G2 = new THREE.BufferGeometry(); G2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G2.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      return G2;
    }
    function caja(x0, y0, z0, x1, y1, z1) {
      var gb = new THREE.BoxGeometry(Math.max(.01, Math.abs(x1 - x0)), Math.max(.01, Math.abs(y1 - y0)), Math.max(.01, Math.abs(z1 - z0)));
      gb.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return gb;
    }
    function cajaC(sd, x0, y0, x1, y1, hb, ht) { return caja(WX(sd, x0), hb, WZ(y0), WX(sd, x1), ht, WZ(y1)); }   // caja desde un rectángulo canónico del carril
    function montar3D() {
      var T3 = THREE, pl = PAL3[lv], k, sd, q, z;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 90, 230], fov: 32 });
      if (!esc) return null;
      V3.pista('mudanza', { bpm: 118,                                            // gaita de furro: Lam–Rem–Mi–Lam, la tambora empuja la subida
        acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [69, 0, 72, 0, 76, 74, 72, 0, 74, 0, 77, 0, 76, 74, 72, 0, 71, 0, 74, 0, 76, 0, 74, 71, 72, 0, 71, 69, 0, 69, 0, 0] });
      V3.pista('mudanza2', { bpm: 152,                                           // la recta final: la misma gaita, apurada y un tono arriba
        acordes: [[59, 62, 66], [52, 55, 59], [54, 58, 61], [59, 62, 66]],
        mel: [71, 0, 74, 0, 78, 76, 74, 0, 76, 0, 79, 0, 78, 76, 74, 0, 73, 0, 76, 0, 78, 0, 76, 73, 74, 0, 73, 71, 0, 71, 0, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      var S3 = new T3.Group(), M = V3.malla, tn = V3.toon, lotes = {}, lotesOp = {};
      function lote(col, gb, op) { if (!lotes[col]) { lotes[col] = []; lotesOp[col] = op || {}; } lotes[col].push(gb); }
      var yTop = L.pts[L.pts.length - 1][1], ZT = WZ(yTop) - 4, XW = GM / 2 + XIN * ESX;
      S3.rotation.y = YAW; esc.scene.add(S3);
      /* el cerro: terrazas de tierra y monte a todo lo ancho (la altura sale de y) */
      for (z = 0; z < L.H + 1; z += 36) lote(pal.cerro, caja(-XW - 14, -3, WZ(z), XW + 14, HY(z + 18) - .35, WZ(Math.min(L.H, z + 36))));
      /* la calle de abajo: asfalto, acera y raya amarilla */
      var zc = WZ(L.H), calle = M(new T3.BoxGeometry(90, .3, 16), pl.calle, { recibe: true, borde: false }); calle.position.set(0, -.15, zc + 8); S3.add(calle);
      lote('#cfc6b0', caja(-45, -.2, zc, 45, .12, zc + 1.4));
      for (k = 0; k < 12; k++) lote('#ffd23f', caja(-44 + k * 8, .01, zc + 9.4, -40 + k * 8, .03, zc + 9.7));
      var faroles = [[], []], ropas = [], puertas = [], escaleraLuz = [];
      for (sd = 0; sd < 2; sd++) {
        /* escalones pintados (una rampa por tramo 'u') y descansos lisos */
        for (q = 0; q < RAMPAS.length; q++) {
          var rp = RAMPAS[q], ne = Math.max(1, Math.round((rp.a - rp.b) / 18)), de = (rp.a - rp.b) / ne;
          for (k = 0; k < ne; k++) {
            var top = rp.h0 + (k + .5) * rp.dh / ne;
            var ce = pal.esc[(k + rp.q * 2) % pal.esc.length], yF = rp.a - k * de;
            lote(ce, cajaC(sd, rp.ax - CW / 2, rp.a - (k + 1) * de, rp.ax + CW / 2, yF, top - 1.4, top));
            lote(V3.oscurecer(ce, .62), cajaC(sd, rp.ax - CW / 2, yF - .5, rp.ax + CW / 2, yF + .6, top - rp.dh / ne - .02, top - .04));   // contrahuella oscura: el escalón se lee
            lote('#14101c', cajaC(sd, rp.ax - CW / 2, yF - .6, rp.ax + CW / 2, yF + .7, top - .05, top + .03));                          // filo del escalón
          }
        }
        for (q = 0; q < L.segs.length; q++) { var sg = L.segs[q], fr = L.full[q]; if (sg.d !== 'u') lote(pal.desc, cajaC(sd, fr[0], fr[1], fr[2], fr[3], HY(sg.ay) - 1.4, HY(sg.ay) + .02)); }
        lote(pal.desc, cajaC(sd, X1 - CW / 2, Y0, X1 + CW / 2, L.H, -1.4, .02));                          // la salida, pegada a la calle
        if (L.segs[L.segs.length - 1].d === 'u') { var lf = L.full[L.full.length - 1]; lote(pal.desc, cajaC(sd, lf[0], lf[1], lf[2], yTop, hTop - 1.4, hTop + .02)); }
        /* el muro bajo del callejón: celdas de 12 px fuera del pasillo y pegadas a él */
        var GC = 12, nc = Math.ceil(LW / GC), nr = Math.ceil(L.H / GC), cx0, cy0;
        for (cy0 = 0; cy0 < nr; cy0++) for (cx0 = 0; cx0 < nc; cx0++) {
          var mx = cx0 * GC + GC / 2, my = cy0 * GC + GC / 2;
          if (my > Y0 || mx > XIN || inside2(mx, my)) continue;
          if (!(inside2(mx + GC, my) || inside2(mx - GC, my) || inside2(mx, my + GC) || inside2(mx, my - GC) || inside2(mx + GC, my + GC) || inside2(mx - GC, my - GC) || inside2(mx + GC, my - GC) || inside2(mx - GC, my + GC))) continue;
          var hm = HY(my);
          lote(pal.borde, cajaC(sd, mx - GC / 2, my - GC / 2, mx + GC / 2, my + GC / 2, hm - .5, hm + .55));
        }
        /* casitas SOLO por fuera del carril (bajitas, en fila); dentro de la L, monte y matas: nada tapa la escalera */
        for (q = 0; q * 70 + 30 < L.H; q++) {
          var hy0 = q * 70 + 30, hh = 1.6 + (q % 3) * .5, b0 = HY(hy0) - .35, wx = WX(sd, 8), wz = WZ(hy0), kc = (q * 7 + sd * 3) % 6;
          var casa = M(geoCasa(hh), pal.muro[kc], { recibe: true, g: .025 }); casa.position.set(wx, b0 + hh / 2, wz); S3.add(casa);
          lote(pl.noche ? '#ffd96a' : pal.ventana, caja(wx - .5, b0 + hh * .5 - .35, wz + 1.3, wx + .5, b0 + hh * .5 + .35, wz + 1.42), pl.noche ? { em: '#ffb030', emI: .9 } : null);
          if (q % 3 === 1) { var tq = M(new T3.CylinderGeometry(.5, .5, .8, 8), '#2f5f9a', { g: .05 }); tq.position.set(wx, b0 + hh + .4, wz - .3); S3.add(tq); }
        }
        for (q = 0; q < deco.length; q++) {
          var d = deco[q]; if (d.t !== 1 || d.x > XIN - 10 || d.x < 40) continue;
          var mt = M(new T3.IcosahedronGeometry(.55, 0), '#3f9a4a', { g: .05 }); mt.position.set(WX(sd, d.x), HY(d.y) - .1, WZ(d.y)); S3.add(mt);
        }
        /* faroles a lo largo de la escalera (de noche, dos luces de verdad siguen a los sofás) */
        for (k = 120; k < L.L; k += 240) {
          var pf = punto(L, k), fx2 = pf.x + pf.nx * (CW / 2 + 5), fy2 = pf.y + pf.ny * (CW / 2 + 5), hf = HY(fy2);
          lote('#2a2a34', caja(WX(sd, fx2) - .08, hf, WZ(fy2) - .08, WX(sd, fx2) + .08, hf + 3.4, WZ(fy2) + .08));
          lote('#fff2a0', caja(WX(sd, fx2) - .22, hf + 3.3, WZ(fy2) - .22, WX(sd, fx2) + .22, hf + 3.7, WZ(fy2) + .22), { em: '#ffd36a', emI: pl.noche ? 1.6 : .2 });
          faroles[sd].push({ x: WX(sd, fx2), y: hf + 3.2, z: WZ(fy2) });
        }
        /* tendederos: dos palos, la cuerda y la ropa que se mece */
        for (q = 0; q < cuerdas.length; q++) {
          var cu = cuerdas[q], hc = HY(cu.y), xa = WX(sd, cu.x0), xb = WX(sd, cu.x1), zz = WZ(cu.y), alto = 1.85;
          lote('#6b5a48', caja(xa - .09, hc - .2, zz - .09, xa + .09, hc + alto + .2, zz + .09)); lote('#6b5a48', caja(xb - .09, hc - .2, zz - .09, xb + .09, hc + alto + .2, zz + .09));
          var cuer = new T3.Mesh(new T3.CylinderGeometry(.03, .03, Math.abs(xb - xa), 4), tn('#fffdf2')); cuer.rotation.z = Math.PI / 2; cuer.position.set((xa + xb) / 2, hc + alto, zz); S3.add(cuer);
          for (z = 0; z < 4; z++) {
            var pr = new T3.PlaneGeometry(.62, .72); pr.translate(0, -.36, 0);
            var ro = new T3.Mesh(pr, new T3.MeshToonMaterial({ color: ['#ff5c8a', '#ffd23f', '#4fd06a', '#5cb8ff'][(z + q) % 4], side: T3.DoubleSide, gradientMap: tn('#fff').gradientMap }));
            ro.position.set(xa + (xb - xa) * (z + .7) / 4.4, hc + alto, zz); ro.castShadow = true; S3.add(ro); ropas.push(ro);
          }
        }
        /* la casa de la tía arriba, de frente a la escalera, con el letrero */
        var pe = L.pts[L.pts.length - 1], gl = L.segs[L.segs.length - 1], dX = pe[0] + gl.dx * (CW / 2 + 4), dY = pe[1] + gl.dy * (CW / 2 + 4);
        var fxd = -gl.dx * (sd === 1 ? -1 : 1), fzd = -gl.dy, rot = Math.atan2(fxd, fzd), hd = HY(dY);
        var casaT = new T3.Group(); casaT.position.set(WX(sd, dX) - fxd * 1.6, hd, WZ(dY) - fzd * 1.6); casaT.rotation.y = rot; S3.add(casaT);
        var cuT = M(new T3.BoxGeometry(7, 5.2, 3), sd ? '#ffb36b' : '#7fd6c9', { recibe: true, g: .015 }); cuT.position.y = 2.6; casaT.add(cuT);
        var puT = M(new T3.BoxGeometry(1.4, 2.4, .2), '#8a4a2a', { g: .04 }); puT.position.set(0, 1.2, 1.5); casaT.add(puT);
        var pom = M(new T3.SphereGeometry(.08, 6, 4), '#ffd23f', { borde: false }); pom.position.set(.45, 1.2, 1.62); casaT.add(pom);
        [-2.3, 2.3].forEach(function (vx) { var ve = M(new T3.BoxGeometry(1.1, 1, .15), pl.noche ? '#ffd96a' : '#3a5a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); ve.position.set(vx, 3.3, 1.52); casaT.add(ve); });
        var tex = V3.texturaCanvas(256, 96, function (g2, w, h) {
          g2.fillStyle = '#fffdf2'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#14101c'; g2.font = 'bold 30px sans-serif'; g2.textAlign = 'center';
          g2.fillText('SE VENDE NEVERA,', w / 2, 40); g2.fillStyle = '#d93a3a'; g2.fillText('PREGUNTE', w / 2, 80);
        });
        var letr = new T3.Mesh(new T3.PlaneGeometry(2.4, .9), new T3.MeshBasicMaterial({ map: tex })); letr.position.set(0, 2.85, 1.53); casaT.add(letr);
        var tia = V3.PJ.crear('mama', { prop: false, escala: 1.25 }); tia.g.position.set(WX(sd, dX) + fxd * .2, hd, WZ(dY) + fzd * .2); S3.add(tia.g);
        tia.rumbo(rot);
        puertas.push({ pj: tia, rot: rot, x: WX(sd, dX), y: hd, z: WZ(dY), enojo: 0 });
        if (pl.noche) { var bb = new T3.Mesh(new T3.SphereGeometry(.18, 6, 4), tn('#fff6c0', { em: '#ffd36a', emI: 2 })); bb.position.set(0, 4.3, 1.7); casaT.add(bb); }
      }
      /* fondo: más ranchitos en terrazas detrás de las puertas, y el monte */
      for (q = 0; q < 6; q++) {
        lote(pal.cerro, caja(-60, -3, ZT - 6 - q * 4, 60, hTop - .5 + q * 2.4, ZT - 2 - q * 4));
        for (k = 0; k < 16; k++) {
          var rx = -44 + k * 5.9 + (q % 2) * 2.4, rz = ZT - 4 - q * 4, rh = 1.6 + ((k * 7 + q * 3) % 3) * .5, ry = hTop - .5 + q * 2.4;
          if (Math.abs(rx) < XW + 1 && q < 2) continue;
          lote(pal.muro[(k + q) % 6], caja(rx - 1.2, ry, rz - 1, rx + 1.2, ry + rh, rz + 1));
          lote(pl.noche ? '#ffd96a' : pal.ventana, caja(rx - .35, ry + rh * .45, rz + 1, rx + .35, ry + rh * .45 + .5, rz + 1.06), pl.noche ? { em: '#ffb030', emI: .9 } : null);
        }
      }
      var monte = M(new T3.SphereGeometry(70, 12, 6), V3.oscurecer(pal.cerro, .8), { borde: false }); monte.scale.set(1.4, .5, .5); monte.position.set(0, hTop + 6, ZT - 60); S3.add(monte);
      /* el camión de la mudanza estacionado abajo, con cajas y la nevera esperando */
      var cam = new T3.Group(); cam.position.set(0, 0, zc + 5.2); S3.add(cam);
      var caj = M(new T3.BoxGeometry(5.2, 3, 2.6), '#f4f0e6', { recibe: true, g: .03 }); caj.position.set(-1, 2, 0); cam.add(caj);
      var cab = M(new T3.BoxGeometry(2, 2.2, 2.5), '#d93a3a', { g: .03 }); cab.position.set(2.7, 1.55, 0); cam.add(cab);
      var vid = M(new T3.BoxGeometry(.1, .9, 2), '#8fd8ff', { borde: false, em: pl.noche ? '#3a5a8a' : null }); vid.position.set(3.72, 2.05, 0); cam.add(vid);
      var chas = M(new T3.BoxGeometry(7.4, .4, 2.4), '#2a2a34', { borde: false }); chas.position.set(.2, .6, 0); cam.add(chas);
      [[-2.6, 1.25], [-2.6, -1.25], [2.6, 1.25], [2.6, -1.25]].forEach(function (r) { var ru = M(new T3.CylinderGeometry(.55, .55, .4, 10), '#14101c', { g: .03 }); ru.rotation.x = Math.PI / 2; ru.position.set(r[0], .55, r[1]); cam.add(ru); });
      var texC = V3.texturaCanvas(256, 128, function (g2, w, h) {
        g2.fillStyle = '#f4f0e6'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#2f6fdb'; g2.font = 'bold 40px sans-serif'; g2.textAlign = 'center';
        g2.fillText('MUDANZAS', w / 2, 55); g2.fillStyle = '#d93a3a'; g2.font = 'bold 28px sans-serif'; g2.fillText('EL PANA · 24 H', w / 2, 100);
      });
      var lado = new T3.Mesh(new T3.PlaneGeometry(4.6, 2.3), new T3.MeshBasicMaterial({ map: texC })); lado.position.set(-1, 2, 1.32); cam.add(lado);
      var intermit = [];
      [[3.72, .9, 1], [3.72, .9, -1], [-3.62, .9, 1], [-3.62, .9, -1]].forEach(function (r) { var bl = new T3.Mesh(new T3.SphereGeometry(.16, 6, 4), tn('#ffb030', { em: '#ff8a00', emI: 1.6 })); bl.position.set(r[0], r[1], r[2] * 1.05); cam.add(bl); intermit.push(bl); });
      for (k = 0; k < 6; k++) { var cj = M(new T3.BoxGeometry(.9, .7, .8), k % 2 ? '#c9a26a' : '#b88a50', { g: .04 }); cj.position.set(-5.4 + (k % 3) * 1 - (k > 2 ? .4 : 0), .35 + (k > 2 ? .7 : 0), .4 + (k % 2) * .2); cj.rotation.y = k * .3; cam.add(cj); }
      var nev = M(new T3.BoxGeometry(1, 2.1, .9), '#fffdf2', { g: .03 }); nev.position.set(-6.6, 1.05, -.4); cam.add(nev);
      var asa = M(new T3.BoxGeometry(.06, .6, .08), '#8a8a94', { borde: false }); asa.position.set(-6.15, 1.3, .07); cam.add(asa);
      /* zamuros dando vueltas (siempre algo moviéndose en el cielo) */
      var zamuros = [];
      for (k = 0; k < 3; k++) {
        var zg = new T3.Group(), cuerpoZ = M(new T3.ConeGeometry(.18, .7, 5), '#1a1420', { borde: false }); cuerpoZ.rotation.x = Math.PI / 2; zg.add(cuerpoZ);
        var alaI = new T3.Mesh(new T3.PlaneGeometry(1.1, .35), new T3.MeshBasicMaterial({ color: 0x1a1420, side: T3.DoubleSide })), alaD = alaI.clone();
        alaI.geometry = alaI.geometry.clone(); alaI.geometry.translate(-.55, 0, 0); alaD.geometry = alaD.geometry.clone(); alaD.geometry.translate(.55, 0, 0);
        alaI.rotation.x = alaD.rotation.x = -Math.PI / 2; zg.add(alaI); zg.add(alaD); S3.add(zg); zamuros.push({ g: zg, i: alaI, d: alaD });
      }
      /* todo lo agrupado: una malla por color */
      for (k in lotes) { var lm = M(juntar(lotes[k]), k, { recibe: true, borde: false, em: lotesOp[k].em || null, emI: lotesOp[k].emI }); lm.castShadow = false; S3.add(lm); }
      /* luces de noche: dos bombillos de verdad que se van al farol más cercano de cada sofá, y uno en el camión */
      var luces = [];
      if (pl.noche) { for (k = 0; k < 2; k++) { var lz = new T3.PointLight(0xffc870, 1.3, 16, 2); S3.add(lz); luces.push(lz); } var lc = new T3.PointLight(0xffb060, 1, 14, 2); lc.position.set(0, 4, zc + 3); S3.add(lc); }
      /* la franja de la moto (una por lado de la pista, se enciende la que toca) */
      var matFr = new T3.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .3, depthWrite: false }), franjas = {};
      for (sd = 0; sd < 2; sd++) [-1, 1].forEach(function (sg2) {
        var op = offPl[sg2], lst = [], f0, w0 = 15;
        for (f0 = 0; f0 <= op.L; f0 += 10) {
          var zi = 1; while (zi < op.ac.length - 1 && op.ac[zi] < f0) zi++;
          var a2 = op.P[zi - 1], b2 = op.P[zi], sl = op.ac[zi] - op.ac[zi - 1] || 1, ww = (f0 - op.ac[zi - 1]) / sl, px = a2[0] + (b2[0] - a2[0]) * ww, py = a2[1] + (b2[1] - a2[1]) * ww, hp = HY(py) + .2;
          lst.push(cajaC(sd, px - w0, py - 6, px + w0, py + 6, hp, hp + .02));
        }
        var fm = new T3.Mesh(juntar(lst), matFr); fm.visible = false; S3.add(fm); franjas[sd * 2 + (sg2 > 0 ? 1 : 0)] = fm;
      });
      /* LA ESCALERA CAMBIA: un juego de mallas por estorbo y por carril (puerta con bisagra, pared caída, moto parqueada, escalones flojos) y su franja de aviso */
      var matAv = new T3.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: .35, depthWrite: false }), obM = [];
      for (sd = 0; sd < 2; sd++) for (q = 0; q < estorbos.length; q++) {
        var b3 = estorbos[q], h3 = HY(b3.y), om = { sd: sd, b: b3, av: {}, abre: 0, cae: 0 };
        [-1, 1].forEach(function (s2) {
          var fa3 = new T3.Mesh(cajaC(sd, b3.x + s2 * OB_IN, b3.y - b3.hl, b3.x + s2 * CW / 2, b3.y + b3.hl, HY(b3.y - b3.hl) + .12, HY(b3.y - b3.hl) + .16), matAv);
          fa3.visible = false; S3.add(fa3); om.av[s2] = fa3;
        });
        if (b3.k === 'puerta') {
          var sgp = b3.sg, hx = b3.x + sgp * CW / 2, hy = b3.y + b3.hl, Lp = 2 * b3.hl * ESX;
          var piv = new T3.Group(); piv.position.set(WX(sd, hx), HY(hy) - .05, WZ(hy)); S3.add(piv);
          var hoja = M(new T3.BoxGeometry(Lp, 2.3, .12), '#8a4a2a', { g: .04 }); hoja.geometry = hoja.geometry.clone(); hoja.geometry.translate(Lp / 2, 1.15, 0); piv.add(hoja);
          var pom2 = M(new T3.SphereGeometry(.08, 6, 4), '#ffd23f', { borde: false }); pom2.position.set(Lp * .85, 1.1, .1); piv.add(pom2);
          var ang = function (x2, y2) { var dx3 = WX(sd, x2) - WX(sd, hx), dz3 = WZ(y2) - WZ(hy); return Math.atan2(-dz3, dx3); };
          om.a0 = ang(hx, b3.y - b3.hl); om.a1 = ang(b3.x + sgp * (CW / 2 - 2 * b3.hl), hy); om.piv = piv;
          S3.add(M(cajaC(sd, b3.x + sgp * (CW / 2 + 1), b3.y - b3.hl, b3.x + sgp * (CW / 2 + 7), b3.y + b3.hl, h3 - .2, h3 + 2.5), '#3a2418', { borde: false }));   // el vano oscuro en el muro
          var vec = V3.PJ.crear('abuela', { prop: false, escala: 1.2 }); vec.g.position.set(WX(sd, b3.x + sgp * (CW / 2 + 16)), h3 - .3, WZ(b3.y)); vec.g.visible = false; S3.add(vec.g);
          om.pj = vec; om.rotPj = Math.atan2(WX(sd, b3.x) - WX(sd, b3.x + sgp * (CW / 2 + 16)), 0);
        } else if (b3.k === 'pared') {
          var pila = new T3.Group(), xs = b3.x + b3.sg * (OB_IN + CW / 2) / 2; pila.position.set(WX(sd, xs), h3, WZ(b3.y)); pila.visible = false; S3.add(pila);
          for (k = 0; k < 7; k++) {
            var la = M(new T3.BoxGeometry(.75, .38, .45), k % 3 ? '#b5653a' : '#d9a066', { g: .04 });
            la.position.set(((k * 37) % 5 - 2) * .3, .2 + Math.floor(k / 3) * .36, ((k * 23) % 7 - 3) * .38); la.rotation.y = k * .7; la.rotation.z = (k % 2 ? .2 : -.15); pila.add(la);
          }
          var lc2 = M(new T3.BoxGeometry(1.3, .9, .4), '#cfc6b0', { g: .04 }); lc2.position.set(0, .6, 0); lc2.rotation.set(.3, .4, .5); pila.add(lc2);    // un pedazo de muro con pintura
          om.g = pila; om.x0 = WX(sd, xs); om.h = h3;
        } else if (b3.k === 'moto') {
          var mp = moto3D(); mp.g.visible = false; S3.add(mp.g); mp.g.rotation.y = Math.atan2(-(WZ(b3.y - 10) - WZ(b3.y)), 0) + (b3.sg > 0 ? 0 : Math.PI);
          om.g = mp.g; om.h = h3; om.xa = WX(sd, b3.x + b3.sg * 21); om.xb = WX(sd, b3.x + b3.sg * (CW / 2 + 50));
        } else {
          om.tab = {}; om.cono = {};
          [-1, 1].forEach(function (s2) {
            var tb = M(cajaC(sd, b3.x + s2 * OB_IN, b3.y - b3.hl, b3.x + s2 * CW / 2, b3.y + b3.hl, -.25, .05), '#c9a26a', { g: .03, recibe: true }), tg = new T3.Group();
            tg.add(tb); tg.position.y = HY(b3.y - b3.hl) + .02; S3.add(tg); om.tab[s2] = tg;
            var cn = M(new T3.ConeGeometry(.28, .8, 8), '#ff8a3d', { g: .05 }); cn.position.set(WX(sd, b3.x + s2 * (CW / 2 - 8)), HY(b3.y) + .4, WZ(b3.y + b3.hl - 4)); cn.visible = false; S3.add(cn); om.cono[s2] = cn;
          });
        }
        obM.push(om);
      }
      /* los sofás y los que cargan (un muñeco por punta: un equipo de uno carga las dos) */
      var sofas = [], cargan = [], perros = [], motoM = [];
      for (sd = 0; sd < 2; sd++) {
        sofas.push(sofa3D(sofaCol(sd), Ls * ESX));
        for (k = 0; k < 2; k++) {
          var pp = seatEnd(sd, k), sa = asiento(pp >= 0 ? pp : 0), pj = V3.PJ.crear(sa.ch || 'tu', { prop: false, escala: 1.35 });
          pj.g.visible = pp >= 0; S3.add(pj.g);
          var aro = new T3.Mesh(new T3.RingGeometry(.75, .95, 20), new T3.MeshBasicMaterial({ color: sideColor(sd), transparent: true, opacity: .85, depthWrite: false }));
          aro.rotation.x = -Math.PI / 2; aro.visible = pp >= 0; S3.add(aro);
          cargan.push({ sd: sd, e: k, p: pp, pj: pj, aro: aro, x: 0, y: 0, z: 0, px: null, pz: 0, sv: 0, rb: null, h: 1.25, off: 22, festejo: false });
        }
        if (perro) perros.push(perro3D());
        motoM.push(moto3D());
      }
      sofas.forEach(function (s) { S3.add(s.g); });
      perros.forEach(function (s) { S3.add(s.g); });
      motoM.forEach(function (s) { S3.add(s.g); S3.add(s.pj.g); });
      var flecha = M(new T3.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      var V = { esc: esc, part: part, sofas: sofas, cargan: cargan, perros: perros, motos: motoM, franjas: franjas, matFr: matFr, puertas: puertas, ropas: ropas, faroles: faroles, luces: luces,
        intermit: intermit, zamuros: zamuros, flecha: flecha, mira: new T3.Vector3(), cz: -Ls * ESX / 2, cy: 0, cs: 0, cx: 0, cw: 2 * (XIN - X1) * ESX + GM, prevRay: [0, 0], prevMh: [0, 0], prevArr: [0, 0], prevDrop: [0, 0, 0, 0], prevUp: 0,
        motoF: -1, motoI: -1, dir: new T3.Vector3(), eje: new T3.Vector3(1, 0, 0), obM: obM, matAv: matAv, lluv: 0, gotas: 0, base: pl, colH: new T3.Color(pl.hemi[0]), colR: new T3.Color(0xff7a7a) };
      esc.encuadrar(cl(V.cw + 8, 15, 29), 11, new T3.Vector3(0, 1.6, V.cz - .5), .5);
      return V3.ultimo = V;
    }
    function inside2(x, y) { var r = L.full, i; for (i = 0; i < r.length; i++) if (x >= r[i][0] && x <= r[i][2] && y >= r[i][1] && y <= r[i][3]) return true; return false; }
    var GEOC = {};
    function geoCasa(hh) { return GEOC[hh] || (GEOC[hh] = new THREE.BoxGeometry(2.6, hh, 2.6)); }
    function sofa3D(col, len) {                                // el sofá: asiento, respaldo, brazos, cojines y patas; eje largo = x local, origen = donde lo agarran
      var T3 = THREE, g3 = new T3.Group(), M = V3.malla, cuerpo = new T3.Group(), Lg = len + .66; g3.add(cuerpo);
      var asi = M(new T3.BoxGeometry(Lg, .5, 1.3), col[0], { g: .03 }); asi.position.y = .1; cuerpo.add(asi);
      var res = M(new T3.BoxGeometry(Lg, .85, .34), col[1], { g: .03 }); res.position.set(0, .62, -.5); cuerpo.add(res);
      [-1, 1].forEach(function (sg) { var br = M(new T3.BoxGeometry(.38, .55, 1.3), col[1], { g: .04 }); br.position.set(sg * (Lg / 2 - .19), .45, 0); cuerpo.add(br);
        var pa = M(new T3.CylinderGeometry(.07, .05, .25, 5), '#5a3a2a', { borde: false }); pa.position.set(sg * (Lg / 2 - .3), -.27, .45); cuerpo.add(pa);
        var pb = pa.clone(); pb.position.z = -.45; cuerpo.add(pb); });
      var nco = Math.max(2, Math.round(len / 1.9)), k;
      for (k = 0; k < nco; k++) { var co = M(new T3.BoxGeometry((Lg - .9) / nco - .08, .2, .95), '#fffdf2', { g: .04 }); co.position.set(-Lg / 2 + .45 + (k + .5) * (Lg - .9) / nco, .44, .1); cuerpo.add(co); }
      return { g: g3, cuerpo: cuerpo };
    }
    function perro3D() {                                       // el perro de la vecina: mira hacia +x
      var T3 = THREE, g3 = new T3.Group(), M = V3.malla, cu = new T3.Group(); g3.add(cu);
      var tor = M(new T3.BoxGeometry(1, .45, .45), '#a8743a', { g: .05 }); tor.position.y = .6; cu.add(tor);
      var cab = M(new T3.BoxGeometry(.45, .42, .4), '#c08a4a', { g: .05 }); cab.position.set(.62, .85, 0); cu.add(cab);
      var hoc = M(new T3.BoxGeometry(.22, .18, .22), '#6a4a2a', { g: .06 }); hoc.position.set(.92, .78, 0); cu.add(hoc);
      [-1, 1].forEach(function (sg) { var ore = M(new T3.BoxGeometry(.12, .25, .1), '#6a4a2a', { borde: false }); ore.position.set(.55, 1.1, sg * .17); cu.add(ore); });
      var cola = M(new T3.CylinderGeometry(.05, .04, .5, 5), '#a8743a', { borde: false }); cola.geometry.translate(0, .25, 0); cola.position.set(-.5, .7, 0); cola.rotation.z = .7; cu.add(cola);
      var patas = [];
      [[.35, .15], [.35, -.15], [-.35, .15], [-.35, -.15]].forEach(function (r) { var pt = M(new T3.BoxGeometry(.12, .45, .12), '#8a5a2a', { borde: false }); pt.geometry = pt.geometry.clone(); pt.geometry.translate(0, -.22, 0); pt.position.set(r[0], .45, r[1]); cu.add(pt); patas.push(pt); });
      return { g: g3, cu: cu, cola: cola, patas: patas, salto: 0 };
    }
    function moto3D() {                                        // la moto que baja con su motorizado (mira hacia +x)
      var T3 = THREE, g3 = new T3.Group(), M = V3.malla;
      var cu = M(new T3.BoxGeometry(1.5, .45, .4), '#2b2540', { g: .04 }); cu.position.y = .75; g3.add(cu);
      var tq = M(new T3.BoxGeometry(.6, .35, .5), '#d93a3a', { g: .04 }); tq.position.set(.25, 1.05, 0); g3.add(tq);
      [-.75, .75].forEach(function (x) { var ru = M(new T3.CylinderGeometry(.38, .38, .18, 10), '#14101c', { g: .04 }); ru.rotation.x = Math.PI / 2; ru.position.set(x, .38, 0); g3.add(ru); });
      var fa = new T3.Mesh(new T3.SphereGeometry(.14, 6, 4), V3.toon('#fffdf2', { em: '#fff2a0', emI: 1.5 })); fa.position.set(.95, .95, 0); g3.add(fa);
      var gu = M(new T3.BoxGeometry(.08, .5, .9), '#5a5a64', { borde: false }); gu.position.set(.75, 1.25, 0); g3.add(gu);
      var pj = V3.PJ.crear('cobrador', { prop: false, escala: 1.0 });
      g3.visible = false; pj.g.visible = false;
      return { g: g3, pj: pj, x: null, z: 0, humo: 0 };
    }
    function hold3D(P) { return !P ? 1.25 : P.drop > 0 ? .45 : P.up ? 2.6 : 1.25; }
    function ecoSofa(sd, n2, k2, cols) { var T = st.T[sd]; suelta(WX(sd, (T.ax + T.bx) / 2), HY((T.ay + T.by) / 2) + 1.4, WZ((T.ay + T.by) / 2), n2, { k: k2, cols: cols, vel: 4, arriba: 4, vida: .8 }); }
    function gesto(sd, nombre) { var q; for (q = 0; q < v3.cargan.length; q++) if (v3.cargan[q].sd === sd) v3.cargan[q].pj.uno(nombre); }
    function mioSd(sd) { return c.yo >= 0 && c.yo < n && side[c.yo] === sd; }
    function actualizar3D(dt, now) {
      var T3 = THREE, V = v3, t = at, sd, k, q, kv = kV(), fin2 = allDone(), aQ = arrTicks();
      V.part.update(dt);
      /* eventos (diferencias con el cuadro anterior): rayón, moto, llegada, perro, ¡ARRIBA! */
      for (sd = 0; sd < 2; sd++) {
        var T = st.T[sd];
        if (T.mhit !== V.prevMh[sd] && T.mhit) { V3.sfx('choque'); V3.sfx('caida'); V.esc.sacudir(mioSd(sd) ? 1 : .5); gesto(sd, 'caer'); ecoSofa(sd, 22, 'chispa', ['#ffd23f', '#fffdf2', '#ff8a3d']); V.puertas[sd].enojo = 1.4; }
        else if (T.ray > V.prevRay[sd]) { V3.sfx('golpe'); V.esc.sacudir(mioSd(sd) ? .7 : .3); gesto(sd, 'golpe'); ecoSofa(sd, 14, 'chispa', ['#fffdf2', '#e3c79a', sofaCol(sd)[0]]); ecoSofa(sd, 6, 'confeti', ['#fffdf2', sofaCol(sd)[1]]); V.puertas[sd].enojo = 1.2; }
        V.prevMh[sd] = T.mhit; V.prevRay[sd] = T.ray;
        if (T.arr && !V.prevArr[sd]) {
          var pu = V.puertas[sd]; V3.sfx('aplauso'); V3.sfx('ding'); V.esc.sacudir(.3); gesto(sd, 'festejo'); pu.pj.uno('saltar');
          suelta(pu.x, pu.y + 3, pu.z, 70, { k: 'confeti', cols: ['#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a', sideColor(sd)], vel: 5, arriba: 6, g: 4, vida: 2.2 });
        }
        V.prevArr[sd] = T.arr;
      }
      for (q = 0; q < n && q < MAXP; q++) {
        var Pq = st.P[q], dn = Pq.drop > 0 ? 1 : 0;
        if (dn && !V.prevDrop[q] && endOf[q] >= 0) {
          V3.sfx('error'); V3.sfx('pop');
          for (k = 0; k < V.cargan.length; k++) if (V.cargan[k].p === q) V.cargan[k].pj.uno('caer');
          if (V.perros[side[q]]) V.perros[side[q]].salto = .5;
        }
        V.prevDrop[q] = dn;
      }
      if (c.yo >= 0 && c.yo < n && st.P[c.yo]) { var upN = st.P[c.yo].up ? 1 : 0; if (upN && !V.prevUp) V3.sfx('salto'); V.prevUp = upN; }
      var mo = motoAt(kv);
      if (mo && mo.i !== V.motoI) { V.motoI = mo.i; V.motoF = 0; V3.sfx('bocina'); }
      if (mo && mo.ph === 2 && V.motoF !== 2) { V.motoF = 2; V3.sfx('motor'); }
      if (!mo) V.motoF = -1;
      /* cámara: sigue a los dos sofás (centro, altura y separación), suave */
      var zA = WZ((st.T[0].ay + st.T[0].by) / 2), zB = WZ((st.T[1].ay + st.T[1].by) / 2), hA = HY((st.T[0].ay + st.T[0].by) / 2), hB = HY((st.T[1].ay + st.T[1].by) / 2), ks = Math.min(1, dt * 2.5);
      var wA = tw(WX(0, (st.T[0].ax + st.T[0].bx) / 2), 0, zA), wB = tw(WX(1, (st.T[1].ax + st.T[1].bx) / 2), 0, zB);   // en coordenadas de la escena (vista 3/4)
      V.cz += ((wA.z + wB.z) / 2 - V.cz) * ks; V.cy += ((hA + hB) / 2 - V.cy) * ks; V.cs += (Math.abs(wA.z - wB.z) - V.cs) * ks;
      V.cx += ((wA.x + wB.x) / 2 - V.cx) * ks; V.cw += (Math.abs(wA.x - wB.x) - V.cw) * ks;
      V.mira.set(V.cx, V.cy + 1.6, V.cz - .5);
      V.esc.encuadrar(cl(V.cw + 8, 15, 29), cl(V.cs * .8 + 8, 11, 30), V.mira, .5);      // cerca, baja y de 3/4: la escalera sube alejándose y los cargadores se ven grandes
      V.esc.luces.sol.position.set(V.mira.x - 12, V.mira.y + 26, V.mira.z + 14); V.esc.luces.sol.target.position.copy(V.mira);
      /* sofás y cargadores */
      for (sd = 0; sd < 2; sd++) {
        var Ts = st.T[sd], so = V.sofas[sd], ca = V.cargan[sd * 2], cb = V.cargan[sd * 2 + 1], PA = ca.p >= 0 ? st.P[ca.p] : null, PB = cb.p >= 0 ? st.P[cb.p] : null;
        ca.h += (hold3D(PA) - ca.h) * Math.min(1, dt * 8); cb.h += (hold3D(PB) - cb.h) * Math.min(1, dt * 8);
        var ax = WX(sd, Ts.ax), az = WZ(Ts.ay), ay = HY(Ts.ay) + ca.h, bx = WX(sd, Ts.bx), bz = WZ(Ts.by), by = HY(Ts.by) + cb.h;
        V.dir.set(ax - bx, ay - by, az - bz); if (V.dir.lengthSq() < 1e-6) V.dir.set(0, 0, -1); V.dir.normalize();
        so.g.quaternion.setFromUnitVectors(V.eje, V.dir);
        var wob = Ts.fz > 6 ? Math.sin(t * 40) * .1 : 0, sh = Ts.stop > 0 ? Math.sin(t * 50) * .07 : 0;
        so.g.position.set((ax + bx) / 2 + V.dir.x * wob + sh, (ay + by) / 2 - .35, (az + bz) / 2 + V.dir.z * wob);
        so.cuerpo.rotation.x = Ts.stop > 0 ? Math.sin(t * 37) * .08 : 0;
        var arrived = !!Ts.arr, ganaSd = fin2 && Ts.arr && Ts.arr === aQ, pierde = fin2 && !ganaSd;
        for (k = 0; k < 2; k++) {
          var cg = k === 0 ? ca : cb, P2 = k === 0 ? PA : PB; if (cg.p < 0) continue;
          var ex = k === 0 ? Ts.ax : Ts.bx, ey = k === 0 ? Ts.ay : Ts.by, ox = k === 0 ? Ts.bx : Ts.ax, oy = k === 0 ? Ts.by : Ts.ay, dl = Math.sqrt((ex - ox) * (ex - ox) + (ey - oy) * (ey - oy)) || 1;
          var upC = P2 && P2.up, offT = upC ? 6 : 22; cg.off += (offT - cg.off) * Math.min(1, dt * 6);
          var cxp = ex + (ex - ox) / dl * cg.off, cyp = ey + (ey - oy) / dl * cg.off;
          var tgx = WX(sd, cxp), tgz = WZ(cyp), tgy = HY(cyp);
          if (cg.px === null) { cg.px = tgx; cg.pz = tgz; cg.x = tgx; cg.z = tgz; cg.y = tgy; }
          else { var sk = Math.min(1, dt * 14); cg.x += (tgx - cg.x) * sk; cg.z += (tgz - cg.z) * sk; cg.y += (tgy - cg.y) * sk; }   // suaviza el salto de los snapshots a 10 Hz y el cuantizado
          var vx = (cg.x - cg.px) / Math.max(dt, 1e-3), vz = (cg.z - cg.pz) / Math.max(dt, 1e-3), v0 = Math.sqrt(vx * vx + vz * vz); cg.px = cg.x; cg.pz = cg.z;
          cg.sv += (v0 - cg.sv) * Math.min(1, dt * 5); var v = cg.sv < .35 ? 0 : cg.sv;   // velocidad suave con zona muerta: sin temblor de piernas parado
          var pj = cg.pj, dropC = P2 && P2.drop > 0;
          if (arrived || (fin2 && ganaSd)) pj.anim('celebrar').cara('feliz');
          else if (pierde) pj.anim('triste').cara('triste');
          else if (dropC) pj.anim('aire').cara('susto');
          else if (upC) pj.anim('cargar', { vel: Math.min(1, v / 3) }).cara('concentrado');
          else pj.anim('empujar', { vel: Math.min(1, v / 3) }).cara(Ts.stop > 0 ? 'susto' : Ts.fz > 6 ? 'enojado' : 'normal');
          var rbT = Math.atan2(so.g.position.x - cg.x, so.g.position.z - cg.z), rbD = cg.rb === null ? 9 : Math.atan2(Math.sin(rbT - cg.rb), Math.cos(rbT - cg.rb));
          if (Math.abs(rbD) > .12) cg.rb = rbT;   // histéresis: solo gira si el cambio es de verdad
          pj.rumbo(arrived || pierde ? 0 : cg.rb).update(dt);
          pj.g.position.set(cg.x, cg.y, cg.z);
          cg.aro.position.set(cg.x, cg.y + .05, cg.z);
        }
        so.g.visible = ca.p >= 0 || cb.p >= 0;
        /* la tía en su puerta */
        var pu2 = V.puertas[sd], prog = (centroS(Ts) - s0) / (fin - s0);
        pu2.enojo = Math.max(0, pu2.enojo - dt);
        if (arrived) pu2.pj.anim('celebrar').cara('feliz');
        else if (fin2) pu2.pj.anim('triste').cara('triste');
        else if (pu2.enojo > 0) pu2.pj.anim('quieto').cara('enojado');
        else if (prog > .7) pu2.pj.anim('saludar').cara('feliz');
        else pu2.pj.anim('quieto').cara('concentrado');
        pu2.pj.rumbo(pu2.rot).update(dt);
        /* el perro */
        var dg = perroAt(kv), pr = V.perros[sd];
        if (pr) {
          pr.g.visible = !!dg;
          if (dg) {
            var wd = sd === 1 ? -dg.dir : dg.dir; pr.salto = Math.max(0, pr.salto - dt);
            pr.g.position.set(WX(sd, dg.x), HY(dg.y) + (dg.mov ? Math.abs(Math.sin(t * 16)) * .12 : 0) + Math.sin(pr.salto * 6.28) * pr.salto * 1.2, WZ(dg.y));
            pr.g.rotation.y = wd > 0 ? 0 : Math.PI;
            pr.cola.rotation.x = Math.sin(t * (dg.mov ? 22 : 9)) * .6;
            for (q = 0; q < 4; q++) pr.patas[q].rotation.z = dg.mov ? Math.sin(t * 16 + (q % 2 ? 0 : Math.PI) + (q > 1 ? Math.PI : 0)) * .6 : 0;
          }
        }
        /* la moto y su franja */
        var mm = V.motos[sd];
        V.franjas[sd * 2].visible = !!(mo && mo.sd === -1); V.franjas[sd * 2 + 1].visible = !!(mo && mo.sd === 1);
        mm.g.visible = !!(mo && mo.ph === 2); mm.pj.g.visible = mm.g.visible;
        if (mm.g.visible) {
          var mx = WX(sd, mo.x), mz = WZ(mo.y), my = HY(mo.y);
          if (mm.x === null) { mm.x = mx; mm.z = mz; }
          var dx = mx - mm.x, dz = mz - mm.z; if (dx * dx + dz * dz > 1e-5) mm.g.rotation.y = Math.atan2(-dz, dx);
          mm.x = mx; mm.z = mz;
          mm.g.position.set(mx, my + Math.sin(t * 30) * .04, mz); mm.g.rotation.z = Math.sin(t * 25) * .05;
          mm.pj.g.position.set(mx - Math.cos(mm.g.rotation.y) * .2, my + .55, mz + Math.sin(mm.g.rotation.y) * .2);
          mm.pj.anim('sentado').cara('concentrado').rumbo(mm.g.rotation.y + Math.PI / 2).update(dt);
          mm.humo -= dt; if (mm.humo < 0) { mm.humo = .06; suelta(mx - Math.cos(mm.g.rotation.y) * .9, my + .5, mz + Math.sin(mm.g.rotation.y) * .9, 1, { k: 'gota', cols: ['#9a96a8', '#cfc6b0'], vel: .5, arriba: 1, g: -1, vida: .6, esc: 1.4 }); }
        } else mm.x = null;
      }
      V.matFr.opacity = mo && mo.ph === 1 ? .25 + .3 * Math.abs(Math.sin(t * 10)) : .22;
      /* lo que se mueve solo: ropa, intermitentes del camión, zamuros; de noche, luces en los faroles cercanos */
      for (k = 0; k < V.ropas.length; k++) V.ropas[k].rotation.x = Math.sin(t * 2.4 + k * 1.3) * .35;
      for (k = 0; k < V.intermit.length; k++) V.intermit[k].visible = Math.floor(t * 2.5) % 2 === 0;
      for (k = 0; k < V.zamuros.length; k++) { var zm = V.zamuros[k], an = t * .35 + k * 2.1; zm.g.position.set(Math.cos(an) * (10 + k * 3), V.cy + 13 + k * 1.5, V.cz - 8 + Math.sin(an) * 6); zm.g.rotation.y = -an; zm.i.rotation.y = Math.sin(t * 5 + k) * .35; zm.d.rotation.y = -Math.sin(t * 5 + k) * .35; }
      for (k = 0; k < V.luces.length; k++) {
        var Tl = st.T[k], zl = WZ((Tl.ay + Tl.by) / 2), best = null, bd = 1e9;
        for (q = 0; q < V.faroles[k].length; q++) { var fo = V.faroles[k][q], dd = Math.abs(fo.z - zl); if (dd < bd) { bd = dd; best = fo; } }
        if (best) V.luces[k].position.set(best.x, best.y, best.z);
      }
      /* la escalera que cambia: avisos, puertas, pared, moto, escalones flojos */
      var oa3 = obsAt(kv), ow3 = avisosAt(kv, OB_WARN), act3 = {}, avi3 = {};
      for (q = 0; q < oa3.length; q++) act3[oa3[q].b.s] = oa3[q];
      for (q = 0; q < ow3.length; q++) avi3[ow3[q].b.s] = ow3[q];
      V.matAv.opacity = .2 + .35 * Math.abs(Math.sin(t * 12));
      for (q = 0; q < V.obM.length; q++) {
        var om = V.obM[q], ia = act3[om.b.s], iw = avi3[om.b.s];
        om.av[-1].visible = !!(iw && iw.sg === -1); om.av[1].visible = !!(iw && iw.sg === 1);
        if (om.b.k === 'puerta') {
          om.abre += ((ia ? 1 : 0) - om.abre) * Math.min(1, dt * (ia ? 14 : 5));
          var da = om.a1 - om.a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
          om.piv.rotation.y = om.a0 + da * om.abre + (iw ? Math.sin(t * 40) * .05 : 0);
          om.pj.g.visible = om.abre > .5; if (om.pj.g.visible) om.pj.anim('saludar').cara('enojado').rumbo(om.rotPj).update(dt);
        } else if (om.b.k === 'pared') {
          om.g.visible = !!(ia || iw);
          var uC = ia ? 1 : iw ? 1 - iw.rem / OB_WARN : 0;
          om.g.position.y = om.h + (1 - uC * uC) * 5; om.g.rotation.z = (1 - uC) * 1.2;
          if (ia && !om.cae) { om.cae = 1; suelta(om.x0, om.h + .6, WZ(om.b.y), 24, { k: 'gota', cols: ['#cfc6b0', '#b8a890', '#e3c79a'], vel: 3, arriba: 3, g: 6, vida: 1.1, esc: 1.6 }); }
        } else if (om.b.k === 'moto') {
          om.g.visible = !!(ia || iw);
          var uM = ia ? 1 : iw ? 1 - iw.rem / OB_WARN : 0;
          om.g.position.set(om.xb + (om.xa - om.xb) * uM, om.h, WZ(om.b.y));
        } else {
          [-1, 1].forEach(function (s2) {
            var hund = !!(ia && ia.sg === s2), tg = om.tab[s2];
            tg.position.y += ((HY(om.b.y - om.b.hl) + (hund ? -1.1 : .02)) - tg.position.y) * Math.min(1, dt * 9);
            tg.position.x = iw && iw.sg === s2 ? Math.sin(t * 45) * .05 : 0;
            om.cono[s2].visible = hund;
          });
        }
      }
      /* aguacero (gotas cerca de la cámara, luz baja) y el relámpago; en los últimos segundos la luz late en rojo */
      var llu = lluviaAt(kv) === 1 ? 1 : 0, fa3 = faseDe(kv);
      V.lluv += (llu - V.lluv) * Math.min(1, dt * 2); flash = Math.max(0, flash - dt);
      if (V.lluv > .05) { V.gotas += dt * 160 * V.lluv; while (V.gotas >= 1) { V.gotas--; V.part.soltar(V.mira.x + (c.fx() - .5) * 26, V.mira.y + 9 + c.fx() * 3, V.mira.z + (c.fx() - .5) * 18, 1, { k: 'gota', cols: ['#9ad0ff', '#cfeaff'], vel: .2, arriba: -8, g: 18, vida: .9, esc: .7 }); } }
      V.esc.luces.hemi.intensity = V.base.hemi[2] * (1 - .3 * V.lluv) + flash * 1.2; V.esc.luces.sol.intensity = V.base.sol[1] * (1 - .45 * V.lluv) + flash * .6;
      V.esc.luces.hemi.color.copy(V.colH); if (fa3 >= 3) V.esc.luces.hemi.color.lerp(V.colR, .3 * (.5 + .5 * Math.sin(t * 7)));
      /* la flecha sobre TU muñeco */
      var mio = null; for (k = 0; k < V.cargan.length; k++) if (V.cargan[k].p === c.yo && c.yo >= 0) { mio = V.cargan[k]; break; }
      V.flecha.visible = !!mio; if (mio) V.flecha.position.set(mio.x, mio.y + 4.2 + Math.abs(Math.sin(t * 4)) * .3, mio.z);
    }
    function textos3D() {
      var V = v3, k, sd, q;
      for (k = 0; k < V.cargan.length; k++) {
        var cg = V.cargan[k]; if (cg.p < 0 || (k % 2 === 1 && V.cargan[k - 1].p === cg.p)) continue;
        var pt = pro3(cg.x, cg.y, cg.z + 1.1);
        txt(cg.p === c.yo ? 'TÚ' : String(asiento(cg.p).name || '').slice(0, 7), pt.x, pt.y, 12, cg.p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (st.P[cg.p] && st.P[cg.p].up) { var pu = pro3(cg.x, cg.y + 4, cg.z); txt('¡ARRIBA!', pu.x, pu.y, 11, '#7dff9a', 0, true); }
      }
      for (q = 0; q < fxs.length; q++) {
        var fq = fxs[q], pf = p3(fq.sd, fq.x, fq.y, 3);
        if (fq.k === 'ray') txt('¡RAYÓN!', pf.x, pf.y - fq.t * 30, 18, '#ffd23f', 0, true);
        else txt('¡SUELTA!', pf.x, pf.y - 10 - fq.t * 24, 13, '#ff6b6b', 0, true);
      }
      var kv = kV(), dg = perroAt(kv), mo = motoAt(kv);
      for (sd = 0; sd < 2; sd++) {
        if (dg && dg.mov) { var pd = p3(sd, dg.x, dg.y, 1.8); if (pd.y > 110 && pd.y < 600) txt('¡GUAU!', pd.x, pd.y, 10, '#fffdf2', 0, true); }
        if (mo && mo.ph === 2) { var pm = p3(sd, mo.x, mo.y, 3); if (pm.y > 110 && pm.y < 600) txt('¡PI PI!', pm.x, pm.y, 11, '#fffdf2', 0, true); }
        var ow4 = avisosAt(kv, OB_WARN);
        for (q = 0; q < ow4.length; q++) { var bq = ow4[q].b, po = p3(sd, bq.x + ow4[q].sg * 20, bq.y, 3.2); if (po.y > 110 && po.y < 600) txt(ONO[bq.k], po.x, po.y, 13, '#ffd23f', 0, true); }
      }
    }
    function dibujar3D(l) {
      var dt = Math.max(0, Math.min(.05, v3T ? at - v3T : 1 / 60)), now = c.ahora(); v3T = at;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !allDone()) V3.musica(faseDe(kV()) >= 2 ? 'mudanza2' : 'mudanza');
      v3.esc.render(dt);
      textos3D();
      hud(l);
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
