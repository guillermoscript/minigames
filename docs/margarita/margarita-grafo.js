// Isla de Margarita · el GRAFO del tablero (doc 14 §7.2): casillas, caminos, cruces, puestos y lugares, sin dibujo.
// Lo usan mapa.js (que lo dibuja) y margarita-reglas.js (que juega sobre él), en el navegador y en el hook de PocketBase.
// UMD, Goja-safe (ES5: sin ?. ?? spread async ni clases). Es la misma construcción que vivía en mapa.js: la semilla 20261025
// pasa por las mismas llamadas, así que salen las mismas casillas y los mismos tipos. `sd` exporta dónde quedó la semilla para
// que mapa.js siga con el decorado exactamente donde iba. NADIE debe mutar lo que exporta (en el servidor se comparte entre salas),
// salvo `PEAJES[i].fee` en la página local de hoy (margarita.js), que en el reductor vive en S.isla.peajes.
(function (root) {
var M = root.MARGA = root.MARGA || {};
var sd = 20261025;
function sr() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
function hyp(a, b) { return Math.sqrt(a * a + b * b); }

/* ───────── rutas (spline por puntos de control) ───────── */
var nodos = [], J = {};
function nodo(x, y, t, isla, seg) { var n = { id: nodos.length, x: Math.round(x), y: Math.round(y), t: t, isla: isla, seg: seg, next: [], ramas: null, peaje: null }; nodos.push(n); return n; }
function junta(k, x, y, isla) { J[k] = nodo(x, y, 'B', isla, k); return J[k]; }
junta('LO', 302, 196, 'O'); junta('JG', 338, 112, 'O'); junta('POR', 508, 262, 'O'); junta('PP', 322, 268, 'O'); junta('MUELLE', 410, 288, 'O'); junta('CE', 318, 326, 'C'); junta('CW', 238, 334, 'C');
junta('MA', 196, 262, 'W'); junta('BDR', 122, 288, 'W'); junta('ME', 202, 174, 'W');
var PESOS = {
  normal: { B: .44, R: .1, E: .11, T: .04, M: .07, H: .06, A: .03, V: .06, I: .05, D: .04 },
  costa: { B: .45, R: .05, E: .13, T: .04, M: .09, H: .07, A: .02, V: .06, I: .06, D: .03 },
  atajo: { B: .34, R: .26, E: .06, T: .04, M: .06, H: .06, A: .14, V: .04 },
  restinga: { B: .82, E: .18 },
  coche: { B: .4, I: .3, T: .1, V: .06, H: .08, D: .06 },
  ferry: { B: .75, I: .25 },
  lancha: { B: .6, E: .4 }
};
function tipo(kind, prev) {
  if (prev && prev !== 'B' && sr() < .55) return 'B';
  var w = PESOS[kind], r = sr();
  for (var k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'B';
}
function curva(P) {
  var out = [];
  for (var i = 0; i < P.length - 1; i++) {
    var p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    for (var k = 0; k < 24; k++) {
      var t = k / 24, t2 = t * t, t3 = t2 * t;
      out.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
var SEGS = {}, TRAZOS = [];
function seg(id, de, a, ctrl, kind, isla, sep) {
  var P = [[J[de].x, J[de].y]].concat(ctrl, [[J[a].x, J[a].y]]), C = curva(P), L = [0];
  for (var i = 1; i < C.length; i++) L.push(L[i - 1] + hyp(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  var tot = L[L.length - 1], n = Math.max(1, Math.round(tot / (sep || 21)) - 1), ids = [];
  var prev = J[de], pt = 'B', c = 0;
  for (var k = 1; k <= n; k++) {
    var meta = tot * k / (n + 1); while (L[c + 1] < meta) c++;
    var u = (meta - L[c]) / (L[c + 1] - L[c] || 1), x = C[c][0] + (C[c + 1][0] - C[c][0]) * u, y = C[c][1] + (C[c + 1][1] - C[c][1]) * u;
    pt = k === n ? 'B' : tipo(kind, pt);
    var m = nodo(x, y, pt, isla, id); ids.push(m.id); prev.next.push(m.id); prev = m;
  }
  prev.next.push(J[a].id);
  SEGS[id] = { id: id, de: de, a: a, ids: ids, kind: kind };
  TRAZOS.push({ kind: kind, pts: C, id: id });
  return SEGS[id];
}
seg('o1', 'LO', 'JG', [[312, 172], [300, 148], [318, 128]], 'normal', 'O');
seg('agua', 'JG', 'POR', [[366, 88], [404, 80], [446, 74], [478, 90], [510, 70], [552, 80], [580, 112], [597, 150], [582, 184], [596, 214], [574, 244]], 'costa', 'O', 22);
seg('asuncion', 'JG', 'POR', [[372, 130], [402, 154], [436, 146], [462, 176], [478, 214]], 'atajo', 'O');
seg('o4', 'POR', 'MUELLE', [[470, 282], [440, 278]], 'normal', 'O');
seg('o4b', 'MUELLE', 'PP', [[380, 292], [352, 284]], 'normal', 'O');
seg('ferry', 'MUELLE', 'CE', [[392, 308], [356, 318]], 'ferry', 'X', 19);
seg('coche', 'CE', 'CW', [[298, 336], [274, 340], [252, 338]], 'coche', 'C', 17);
seg('ferry2', 'CW', 'PP', [[248, 312], [282, 304], [306, 292]], 'ferry', 'X', 19);
seg('o5', 'PP', 'LO', [[304, 248], [300, 222]], 'normal', 'O');
seg('restinga', 'ME', 'LO', [[220, 166], [250, 166], [280, 170]], 'restinga', 'X');
seg('w1', 'MA', 'BDR', [[170, 280], [148, 292]], 'normal', 'W');
seg('arenas', 'BDR', 'ME', [[84, 294], [50, 282], [30, 252], [28, 222], [46, 194], [78, 176], [110, 188], [140, 170], [172, 166]], 'costa', 'W', 22);
seg('cerro', 'BDR', 'ME', [[110, 264], [86, 240], [108, 214], [140, 224], [162, 196]], 'atajo', 'W');
seg('w4', 'ME', 'MA', [[214, 196], [208, 220], [214, 242]], 'normal', 'W');
seg('lancha', 'PP', 'MA', [[294, 262], [258, 256], [222, 262]], 'lancha', 'X');
SEGS.restinga.ids.forEach(function (i) { nodos[i].cruce = 'restinga'; });
SEGS.lancha.ids.forEach(function (i) { nodos[i].cruce = 'lancha'; });
SEGS.ferry.ids.concat(SEGS.ferry2.ids).forEach(function (i) { nodos[i].cruce = 'ferry'; });
J.MUELLE.ramas = [{ seg: 'o4b', nom: 'SEGUIR A PUNTA DE PIEDRAS' }, { seg: 'ferry', nom: 'FERRY A COCHE', costo: 5 }];
J.JG.ramas = [{ seg: 'agua', nom: 'LA COSTA · PLAYA EL AGUA' }, { seg: 'asuncion', nom: 'ATAJO POR LA ASUNCIÓN' }];
J.BDR.ramas = [{ seg: 'arenas', nom: 'LA COSTA · PUNTA ARENAS' }, { seg: 'cerro', nom: 'ATAJO POR EL CERRO' }];
J.PP.ramas = [{ seg: 'o5', nom: 'SEGUIR EN ORIENTE' }, { seg: 'lancha', nom: 'TOMAR LA LANCHA' }];
J.ME.ramas = [{ seg: 'w4', nom: 'SEGUIR EN MACANAO' }, { seg: 'restinga', nom: 'CRUZAR LA RESTINGA' }];
var PEAJES = [
  { id: 'restinga', nom: 'LA RESTINGA', fee: 1, de: 'W', a: 'O', nodo: J.ME.id },
  { id: 'lancha', nom: 'LA LANCHA', fee: 1, de: 'O', a: 'W', nodo: J.PP.id }
];
J.ME.peaje = PEAJES[0]; J.PP.peaje = PEAJES[1];
var ISLAS = { O: { nom: 'ORIENTE' }, W: { nom: 'MACANAO' } };
function cercano(segId, x, y) { var b = null, d = 1e9; SEGS[segId].ids.forEach(function (i) { var n = nodos[i], e = hyp(n.x - x, n.y - y); if (e < d) { d = e; b = n; } }); return b; }
var nAgua = cercano('agua', 510, 70), nArenas = cercano('arenas', 28, 236);
nAgua.t = 'B'; nArenas.t = 'B';
var PUESTOS = {
  O: { x: nAgua.x, y: nAgua.y + 16, nodo: nAgua.id, seg: 'agua', lugar: 'PLAYA EL AGUA' },
  W: { x: nArenas.x + 18, y: nArenas.y + 4, nodo: nArenas.id, seg: 'arenas', lugar: 'PUNTA ARENAS' }
};
var COCHE = { x: 274, y: 333 };
/* lugares con personaje al lado del camino: se activan al pasar (la bodega, el pícaro) o al pasar/caer (el san, que es casilla) */
var NPCS = [];
function lugar(k, segId, x, y, dx, dy, nom) { var n = cercano(segId, x, y); n.t = k === 'san' ? 'S' : 'B'; n.lugar = k; NPCS.push({ k: k, nodo: n.id, x: n.x + dx, y: n.y + dy, nom: nom }); return n; }
lugar('bodega', 'o4', 470, 280, 2, -20, 'LA BODEGA DEL PORTU');
lugar('bodega', 'w1', 168, 282, -4, -20, 'LA BODEGA DEL PORTU');
lugar('san', 'o1', 304, 150, 18, 2, 'EL SAN');
lugar('picaro', 'o4b', 366, 290, -2, -20, 'EL PÍCARO DEL PUERTO');
lugar('perla', 'coche', 274, 340, 0, -16, 'EL PERLERO');
lugar('sambil', 'asuncion', 488, 234, 0, 0, 'EL SAMBIL');
lugar('canon', 'agua', 590, 176, -16, -2, 'EL CAÑÓN DE PAMPATAR');
lugar('monos', 'asuncion', 400, 152, 6, -14, 'LOS MONOS DEL COPEY');
lugar('calabozo', 'asuncion', 436, 148, 2, -16, 'EL CALABOZO DE SANTA ROSA');
lugar('matasiete', 'asuncion', 464, 180, 10, -10, 'EL CERRO MATASIETE');
/* los puestos de la Empanadera (la ESTRELLA del Mario Party): al comprarle se muda a otro de estos. Fuente de verdad en el reductor:
   S.isla.puesto = id de nodo (uno de estos); S.isla.senora = su isla ('O'|'W'), derivada. Casillas azules sin lugar, ya existentes. */
function libre(segId, x, y) {
  var b = null, d = 1e9; SEGS[segId].ids.forEach(function (i) { var n = nodos[i], e = hyp(n.x - x, n.y - y); if (n.t === 'B' && !n.lugar && !n.peaje && !n.cruce && e < d) { d = e; b = n; } }); return b;
}
var PUESTOS_EMP = [], PUESTO_POR_NODO = {};
function puestoEmp(k, lugar, seg, x, y, dx, dy, fijo) {
  var n = fijo || libre(seg, x, y); n.t = 'B';
  var P = fijo ? { k: k, x: PUESTOS[fijo === nAgua ? 'O' : 'W'].x, y: PUESTOS[fijo === nAgua ? 'O' : 'W'].y, nodo: n.id, isla: n.isla, lugar: lugar }
    : { k: k, x: n.x + dx, y: n.y + dy, nodo: n.id, isla: n.isla, lugar: lugar };
  PUESTOS_EMP.push(P); PUESTO_POR_NODO[n.id] = P; return P;
}
puestoEmp('agua', PUESTOS.O.lugar, 'agua', 0, 0, 0, 0, nAgua);
puestoEmp('arenas', PUESTOS.W.lugar, 'arenas', 0, 0, 0, 0, nArenas);
puestoEmp('juan', 'JUAN GRIEGO', 'o1', 322, 132, 14, 4);
puestoEmp('asuncion', 'LA ASUNCIÓN', 'asuncion', 420, 150, 12, 6);
puestoEmp('pampatar', 'PAMPATAR', 'agua', 598, 150, -16, 2);
puestoEmp('porlamar', 'PORLAMAR', 'o4', 484, 280, 2, 14);
puestoEmp('piedras', 'PUNTA DE PIEDRAS', 'o4b', 346, 288, -2, 14);
puestoEmp('sanfco', 'SAN FRANCISCO', 'arenas', 80, 176, 14, 4);
puestoEmp('cerro', 'CERRO MACANAO', 'cerro', 110, 214, -16, 2);
puestoEmp('boca', 'BOCA DE RÍO', 'w1', 150, 292, 2, 14);
var PUESTO_INICIAL = PUESTOS_EMP.filter(function (c) { return c.k === 'piedras'; })[0];   // arranca en Punta de Piedras: a 8 pasos de la salida (Porlamar), así la primera carrera empieza en los primeros turnos
var BOTE = {
  O: [[PUESTOS.O.x, PUESTOS.O.y - 22], [470, 44], [330, 50], [252, 118], [150, 100], [60, 140], [8, 190], [4, 236], [PUESTOS.W.x - 30, PUESTOS.W.y]]
};
BOTE.W = BOTE.O.slice().reverse();
function rutaBote(de) { return BOTE[de].map(function (p) { return { x: p[0], y: p[1] }; }); }
var LUGARES = [
  ['JUAN GRIEGO', 330, 76], ['PLAYA EL AGUA', 508, 44], ['PAMPATAR', 600, 170], ['PORLAMAR', 534, 266], ['LA ASUNCION', 446, 98],
  ['PUNTA DE PIEDRAS', 336, 304], ['SAN JUAN', 376, 240], ['PARAGUACHI', 546, 150], ['TACARIGUA', 326, 226], ['LOS MILLANES', 398, 90], ['SAN FRANCISCO', 108, 146], ['BOCA DE POZO', 44, 166], ['MATASIETE', 500, 172], ['REPRESA', 352, 203], ['PARGUITO', 612, 124], ['EL VALLE', 494, 182], ['MARIA GUEVARA', 186, 300], ['LOS FRAILES', 610, 44], ['EL YAQUE', 418, 304], ['AEROPUERTO', 466, 296], ['LA RESTINGA', 252, 152], ['LA GUARDIA', 322, 178], ['LA LAGUNA', 258, 192], ['BOCA DE RIO', 124, 312], ['PUNTA ARENAS', 40, 312],
  ['EL ROBLEDAL', 172, 140], ['CERRO MACANAO', 128, 250], ['SANTA ANA', 352, 184], ['MANZANILLO', 556, 36], ['COCHE', 296, 355], ['CUBAGUA', 154, 356], ['CERRO COPEY', 410, 206]
];
function lugarCerca(x, y) { var b = LUGARES[0], d = 1e9; LUGARES.forEach(function (L) { var e = hyp(L[1] - x, L[2] - y); if (e < d) { d = e; b = L; } }); return b[0]; }

/* ───────── derivados para las reglas (puros, no tocan los nodos) ───────── */
var PREV = {}; nodos.forEach(function (n) { n.next.forEach(function (m) { (PREV[m] = PREV[m] || []).push(n.id); }); });
// pasos mínimos siguiendo el tablero (BFS), igual que distancia() de margarita.js: 99 si no se llega en 60
function distancia(de, a) {
  var vis = {}, cola = [de], q = 0; vis[de] = 0;
  while (q < cola.length) { var n = cola[q++]; if (n === a) return vis[n]; var nx = nodos[n].next;
    for (var i = 0; i < nx.length; i++) { var m = nx[i]; if (vis[m] === undefined && vis[n] < 60) { vis[m] = vis[n] + 1; cola.push(m); } } }
  return 99;
}
var POR_LUGAR = {}; NPCS.forEach(function (N) { POR_LUGAR[N.nodo] = N; });

M.grafo = { PUESTO_INICIAL: PUESTO_INICIAL, PUESTOS_EMP: PUESTOS_EMP, PUESTO_POR_NODO: PUESTO_POR_NODO, nodos: nodos, J: J, SEGS: SEGS, TRAZOS: TRAZOS, PEAJES: PEAJES, ISLAS: ISLAS, PUESTOS: PUESTOS, COCHE: COCHE, NPCS: NPCS, LUGARES: LUGARES,
  PREV: PREV, POR_LUGAR: POR_LUGAR, rutaBote: rutaBote, lugarCerca: lugarCerca, distancia: distancia, cercano: cercano, sd: sd };
if (typeof module !== 'undefined' && module.exports) module.exports = M.grafo;
})(typeof window !== 'undefined' ? window : globalThis);
