// Isla de Margarita · REDUCTOR PURO del tablero (doc 14). Misma API y mismo contrato que fiesta-reglas.js, para que el hook de
// PocketBase lo corra sobre las salas de LA FIESTA (board.tab = 'margarita') y el modo local lo corra en el navegador.
// UMD, Goja-safe (ES5 + Object.assign: sin ?. ?? spread async ni clases). Las reglas son las de margarita.js (doc 12), una por una.
//
// API (todas puras: nunca mutan sus argumentos)
//   crear(semilla, cfg, asientos, ahora) -> {S, priv}     cfg = {tot, cpuNivel, n, orden:'azar'|'fijo', sinMJ, secretos, micro}
//   aplicar(S, priv, asiento, a, ahora) -> {S, priv, fx, error, dup?}
//       Jugadas del aviso (esp.k → a.t): DADO → TIRAR | USAR{item}; TRUCADO → PASOS{n}; CRUCE → CRUZAR{si}; PEAJE → PALANCA | PAGAR{bs} | NO;
//       FERRY → FERRY{si}; DESVIO → RUTA{a}; EMPANADA → COMPRAR{si}; BODEGA → COMPRAR{item|null}; PICARO → NEGOCIO{op|null};
//       VICTIMA → VICTIMA{s}; BRONCA → RETAR{s}; CALABOZO → FIANZA{si}; MATASIETE → PIEDRA{s|null}; RIFA → RIFA{si}; CANON → CANON{si};
//       MICRO → MICRO{gana} (solo con cfg.micro, en local: el microjuego de campaña se juega de verdad).
//       Otras: SECRETO{n} (en cualquier momento); iguales a LA FIESTA: LISTO, JUEZ, VOLVER, SALIR; del servidor ('$'): MJ_RESULTADO, JUEZ_ELEGIR, TOMAR_ASIENTO, AFK.
//   lobby(cfg) -> el tablero de la sala antes de empezar (tab 'margarita'); CFG_VALIDA: lo que el anfitrión puede cambiar ahí.
//   tick(S, priv, ahora) -> atiende UN vencimiento (orden, CPU, plazo + aviso AFK, carta → mj, cierre, res, final).
//   proyectar(D, fx), aplicaFx(D, f), vista(S, asiento, priv?), hash(S), fxMs(lote): como en LA FIESTA.
// Fases f: orden → turno ⇄ carta → mj → res → (turno | final) → fin. El turno es una cola de tareas (t.q) que corre hasta el
// próximo aviso: mover (paso a paso, con bifurcaciones), lo que pasa al pasar (bolsa, puesto, lugar, criaturas), caer y fin.
(function (root) {
var M = root.MARGA = root.MARGA || {};
var F = root.FIESTA = root.FIESTA || {};
var NODE = typeof require !== 'undefined' && typeof module !== 'undefined';
// en el hook todo vive en pb_hooks/; en el repo, el RNG y el catálogo están en docs/style-lab/
function req(n) { try { return require('./' + n); } catch (e) { return require('../style-lab/' + n); } }
var G = NODE ? require('./margarita-grafo.js') : M.grafo;
var RNG = NODE ? req('fiesta-rng.js') : F.rng;
var FR = NODE ? req('fiesta-reglas.js') : F.reglas;
function CPU() { return M.cpu || (NODE ? require('./margarita-cpu.js') : null); }

var NOD = G.nodos, J = G.J, PUESTOS = G.PUESTOS;
var SEATS = ['a', 'b', 'c', 'd'];
var CFG0 = { tot: 10, cpuNivel: 2, n: 4, orden: 'azar', sinMJ: false, secretos: 8, micro: false };
var PLAZO = { DADO: 20000, DADO1: 30000, RUTA: 12000, TIENDA: 15000 };
var PLAZO_DE = { DADO: 'DADO', TRUCADO: 'DADO', CRUCE: 'RUTA', FERRY: 'RUTA', DESVIO: 'RUTA' };   // los demás avisos: TIENDA
var T = { cpu: 400, orden: 3000, carta: 4500 + 15000, cuenta: 3500, cierre: 3000, res: 5000, final: 4000 };
// duración de la cinemática de cada efecto (el plazo del aviso siguiente cuenta desde que termina): los decir() de margarita.js
var FX_MS = { orden: 2500, ronda: 1500, turno: 800, dado: 900, hop: 160, mon: 500, emp: 1600, item: 1200, evento: 1300, cae: 300,
  cruza: 900, peaje: 1200, penero: 4600, noticia: 2400, vaina: 3200, triple: 3000, rifa: 2600, bolsa: 2000, isla: 1100,
  mjIni: 4000, mjRes: 2200, bonusFin: 1500, fin: 3000, resp: 0 };
var RING_MAX = 6000, RING_N = 16, LOG_N = 30;

var ITEMS = { cafe: { precio: 6, dados: 2 }, guarapo: { precio: 12, dados: 3 }, trucado: { precio: 8 }, palanca: { precio: 5 },
  colearse: { precio: 10 }, mototaxi: { precio: 22 } };
var ITEM_IDS = ['cafe', 'guarapo', 'trucado', 'palanca', 'colearse', 'mototaxi'];
var LLENO = 3;
var HORAS = ['dia', 'dia', 'tarde', 'noche'];
var VAINAS = ['aguacero', 'obras', 'leva', 'turistas', 'apagon'];
var RIFA = [['nada', 40], ['objeto', 30], ['15', 17], ['30', 9], ['emp', 4]];
var DUELOS = ['f_abuela', 'f_toro', 'f_harina', 'f_mecate'];
var BOLSAS = [5, 8, 10, 12];
// a dónde puede caer el que dispara el cañón o se lleva el ovni
var LIBRES = NOD.filter(function (n) { return !n.cruce && !n.ramas && !n.lugar && n.t !== 'S'; }).map(function (n) { return n.id; });

/* ───── utilidades ───── */
function clon(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
function js(x) { return x === undefined ? '~' : JSON.stringify(x); }
function fxMs(l) { var t = 0; for (var i = 0; i < (l ? l.length : 0); i++) t += FX_MS[l[i].k] || 0; return t; }
function seats(N) { return Object.keys(N.pj); }
function rivales(N, s) { return seats(N).filter(function (x) { return x !== s; }); }
function humanos(N, l) { return (l || seats(N)).filter(function (s) { return N.pj[s].cpu === null; }); }
function setPath(N, p, v) { var k = p.split('.'), o = N; for (var i = 0; i < k.length - 1; i++) o = o[k[i]]; if (v === undefined) delete o[k[k.length - 1]]; else o[k[k.length - 1]] = clon(v); }
function log(N, txt) { N.log.push(txt); while (N.log.length > LOG_N) N.log.shift(); }
function deNoche(N) { return N.isla.hora === 'noche' || !!N.isla.apagon; }
function lanchaCerrada(N) { return N.isla.kraken ? 'kraken' : deNoche(N) ? 'noche' : N.isla.leva ? 'leva' : ''; }
function feeDe(N, id) { var f = N.isla.peajes[id]; return id === 'restinga' && deNoche(N) ? Math.min(50, f * 2) : f; }
function islaDe(N, s) { var n = NOD[N.pj[s].en]; return n.isla === 'X' ? (n.cruce === 'lancha' ? 'W' : 'O') : n.isla; }
function porIsla(N, k) { return seats(N).filter(function (s) { return islaDe(N, s) === k || (k === 'O' && NOD[N.pj[s].en].isla === 'C'); }); }
function distVenta(N, s) { return N.isla.senora ? G.distancia(N.pj[s].en, PUESTOS[N.isla.senora].nodo) : 99; }
function precio(N, k) { return N.isla.oferta ? Math.ceil(ITEMS[k].precio / 2) : ITEMS[k].precio; }
function carnavalR(N) { return N.tot >= 4 ? Math.ceil(N.tot / 2) : 0; }
function finalR(N) { return N.tot >= 6 ? N.tot - 2 : N.tot + 1; }
// el que va primero / de último: por empanadas y luego reales (empate: orden de asiento, como el sort estable de JUG)
function lider(N, l) { return l.slice().sort(function (a, b) { return N.pj[b].emp - N.pj[a].emp || N.pj[b].bs - N.pj[a].bs; })[0]; }
function peor(N) { return seats(N).sort(function (a, b) { return N.pj[a].emp - N.pj[b].emp || N.pj[a].bs - N.pj[b].bs; })[0]; }

/* ───── efectos (fx): cada uno llega ya resuelto; aplicaFx los repite sobre una foto ───── */
var AP = {
  hop: function (N, f) { N.pj[f.s].en = f.a; },
  cae: function (N, f) { N.pj[f.s].color = f.color; },
  bono: function (N, f) { N.pj[f.s].bono[f.campo] += f.d; },
  mon: function (N, f) { var p = N.pj[f.s]; p.bs = f.tot; if (f.tot > p.bono.max) p.bono.max = f.tot; },
  emp: function (N, f) { N.pj[f.s].emp = f.tot; log(N, N.pj[f.s].name + (f.d > 0 ? ' +' : ' ') + f.d + ' empanada'); },
  item: function (N, f) { N.pj[f.s].items = f.items.slice(); },
  isla: function (N, f) { N.isla[f.campo] = clon(f.v); },
  penero: function (N, f) { N.isla.senora = f.a; N.isla.bacha = f.de; },
  swap: function (N, f) { var a = N.pj[f.a], b = N.pj[f.b], x = a[f.campo]; a[f.campo] = b[f.campo]; b[f.campo] = x; },   // el Triple: sin tocar bono.max
  evento: function (N, f) { log(N, (f.s ? N.pj[f.s].name + ': ' : '') + f.id); },
  noticia: function (N, f) { log(N, 'ÚLTIMA HORA: ' + f.id); },
  ronda: function (N, f) { N.r = f.r; log(N, 'RONDA ' + f.r); },
  orden: function (N, f) { N.orden = f.orden.slice(); },
  afk: function (N, f) { log(N, N.pj[f.s].name + ' se fue (CPU)'); },
  vuelve: function (N, f) { log(N, '¡VOLVIÓ ' + N.pj[f.s].name + '!'); },
  llega: function (N, f) { var p = N.pj[f.s]; p.name = f.name; p.ch = f.ch; log(N, '¡LLEGÓ ' + f.name + '!'); },
  set: function (N, f) { setPath(N, f.p, f.v); },
  ver: function (N, f) { N.ver = f.v; }
};
function aplicaFx(N, f) { if (AP[f.k]) AP[f.k](N, f); return N; }
function emit(Z, f) { Z.fx.push(f); aplicaFx(Z.N, f); return f; }
function anillo(N, v, s, fx) { var c = clon(fx), b = JSON.stringify(c).length, tot = b; N.fx.push({ v: v, s: s, b: b, fx: c });
  for (var i = 0; i < N.fx.length - 1; i++) tot += N.fx[i].b;
  while (N.fx.length > 1 && (N.fx.length > RING_N || tot > RING_MAX)) { tot -= N.fx[0].b; N.fx.shift(); } }
function clonS(S) { var o = {}, k; for (k in S) if (k !== 'fx' && k !== 'log') o[k] = S[k]; var N = clon(o); N.fx = S.fx ? S.fx.slice() : []; N.log = S.log ? S.log.slice() : []; return N; }
function proyectar(D, fx) { var N = clonS(D), u = null; for (var i = 0; i < fx.length; i++) { aplicaFx(N, fx[i]); if (fx[i].k === 'ver') u = fx[i]; }
  if (u) anillo(N, u.v, u.s, fx); return N; }

function mon(Z, s, d, por) { var p = Z.N.pj[s], tot = Math.max(0, p.bs + d); d = tot - p.bs; if (d) emit(Z, { k: 'mon', s: s, d: d, tot: tot, por: por }); return d; }
function emp(Z, s, d, por) { var p = Z.N.pj[s], tot = Math.max(0, p.emp + d); d = tot - p.emp; if (d) emit(Z, { k: 'emp', s: s, d: d, tot: tot, por: por }); return d; }
function darItem(Z, s, k, que) { var l = Z.N.pj[s].items; if (l.length >= LLENO) return false; emit(Z, { k: 'item', s: s, items: l.concat([k]), item: k, que: que }); return true; }
function quitar(Z, s, k, que) { var l = Z.N.pj[s].items.slice(), i = l.indexOf(k); if (i < 0) return false; l.splice(i, 1); emit(Z, { k: 'item', s: s, items: l, item: k, que: que }); return true; }
function bono(Z, s, campo, d) { emit(Z, { k: 'bono', s: s, campo: campo, d: d }); }   // para las empanadas extra del final
function hop(Z, s, a, modo) { var p = Z.N.pj[s]; emit(Z, { k: 'hop', s: s, de: p.en, a: a, modo: modo }); }
function evento(Z, s, id, p) { var f = { k: 'evento', s: s || null, id: id }; if (p) f.p = p; emit(Z, f); }
function isla(Z, campo, v) { if (js(Z.N.isla[campo]) !== js(v)) emit(Z, { k: 'isla', campo: campo, v: clon(v) }); }

/* ───── avisos ───── */
function abrir(Z, k, opc, ctx) {
  var N = Z.N, s = N.t.s, p = N.pj[s], ms = fxMs(Z.fx), pl = PLAZO_DE[k] || 'TIENDA';
  if (p.toma) { p.toma = 0; p.cpu = null; p.afk = 0; }   // toma de asiento: el control pasa en este límite
  var plazo = pl === 'DADO' && N.r === 1 ? PLAZO.DADO1 : PLAZO[pl];
  N.esp = { id: Z.S.ver + 1, s: s, k: k, opc: opc, hasta: Z.now + ms + plazo };
  N.t.ctx = ctx || null;
  if (p.cpu) { Z.P.cpuAt = Z.now + ms + T.cpu; N.nextAt = Math.min(N.esp.hasta, Z.P.cpuAt); } else { Z.P.cpuAt = null; N.nextAt = N.esp.hasta; }
  return true;
}
function cierra(Z) { Z.N.esp = null; Z.N.t.ctx = null; }
function abrirDado(Z) {
  var N = Z.N, t = N.t, o = ['TIRAR'];
  if (!t.extra) N.pj[t.s].items.forEach(function (k) { if (k !== 'palanca' && o.indexOf(k) < 0) o.push(k); });
  return abrir(Z, 'DADO', o);
}

/* ───── el turno: una cola de tareas ───── */
function seguir(Z) {
  var N = Z.N;
  for (var g = 0; g < 600; g++) {
    if (N.f !== 'turno' || !N.t || N.esp) return;
    var x = N.t.q.shift();
    if (!x) x = { k: 'fin' };
    if (TAREA[x.k](Z, N.t.s, x)) return;
  }
  throw new Error('margarita: seguir() sin salida');
}
function rodar(Z, s, n, de) {
  var N = Z.N, max = N.isla.lluvia ? 6 : 10, dd = [], tot = 0;
  for (var i = 0; i < n; i++) { var v = Z.r.int(1, max); dd.push(v); tot += v; }
  emit(Z, { k: 'dado', s: s, v: tot, dados: dd, max: max, de: de });
  N.t.resto = tot; N.t.extra = 0; N.t.q.unshift({ k: 'mover' }, { k: 'caer' });
}
// un salto: lo que pasa al llegar a la casilla (aunque no caiga) va antes de seguir moviendo
function paso(Z, s, a) {
  hop(Z, s, a, 'paso'); Z.N.t.resto--;
  Z.N.t.q.unshift({ k: 'bolsa' }, { k: 'puesto' }, { k: 'lugar' }, { k: 'criaturas' }, { k: 'mover' });
}
var TAREA = {
  mover: function (Z, s) {
    var N = Z.N, t = N.t, n = NOD[N.pj[s].en];
    if (t.resto <= 0) return false;
    if (n.next.length < 2) { paso(Z, s, n.next[0]); return false; }
    var a = bifurcacion(Z, s, n);
    if (a < 0) return true;
    paso(Z, s, a); return false;
  },
  bolsa: function (Z, s) {
    var I = Z.N.isla, en = Z.N.pj[s].en, b = null, i;
    for (i = 0; i < I.bolsas.length; i++) if (I.bolsas[i].en === en) { b = I.bolsas[i]; break; }
    if (!b) return false;
    isla(Z, 'bolsas', I.bolsas.filter(function (x) { return x !== b; }));
    mon(Z, s, b.bs, b.cofre ? 'cofre' : 'cartera'); return false;
  },
  puesto: function (Z, s, x) {
    var en = Z.N.pj[s].en, k = x.isla || (PUESTOS.O.nodo === en ? 'O' : PUESTOS.W.nodo === en ? 'W' : null);
    return k ? puesto(Z, s, k) : false;
  },
  lugar: function (Z, s) { var l = NOD[Z.N.pj[s].en].lugar; return l && LUGAR[l] ? LUGAR[l](Z, s) : false; },
  criaturas: function (Z, s) {
    var N = Z.N, I = N.isla, en = N.pj[s].en;
    if (I.silbon === en) { evento(Z, s, 'silbonAtrapa'); mon(Z, s, -10, 'silbon'); isla(Z, 'silbon', null); }
    if (I.sirena && I.sirena.nodo === en && I.sirena.vistos.indexOf(s) < 0) {
      isla(Z, 'sirena', { nodo: I.sirena.nodo, n: I.sirena.n, vistos: I.sirena.vistos.concat([s]) });
      if (Z.r.next() < .6) { evento(Z, s, 'sirenaPerla'); mon(Z, s, 10, 'sirena'); } else { evento(Z, s, 'sirenaEmbobado'); mon(Z, s, -5, 'sirena'); }
    }
    return false;
  },
  caer: function (Z, s) { return caer(Z, s); },
  fin: function (Z) { finTurno(Z); return true; }
};

/* ───── bifurcaciones: el muelle (ferry), los desvíos (costa o atajo) y los cruces con peaje ───── */
// Las salidas se leen de `ramas` ([seguir, cruzar]), no del orden de `next`: en La Restinga (J.ME) `next` sale al revés porque
// el tramo restinga se arma antes que w4, y margarita.js de hoy cobraba por quedarse en Macanao y cruzaba gratis al que no pagaba.
function salidas(n) { return n.ramas.map(function (r) { var g = G.SEGS[r.seg]; return g.ids.length ? g.ids[0] : J[g.a].id; }); }
function bifurcacion(Z, s, n) {
  var N = Z.N, p = N.pj[s], I = N.isla, sal = salidas(n);
  if (n.ramas && n.ramas[1].costo) {
    var sigue = sal[0], va = sal[1], c = n.ramas[1].costo;
    if (I.kraken) { evento(Z, s, 'ferryCerrado'); return sigue; }
    if (p.bs < c) return sigue;
    return abrir(Z, 'FERRY', { costo: c }, { sigue: sigue, va: va, c: c }) ? -1 : sigue;
  }
  if (!n.peaje) {
    var costa = sal[0], atajo = sal[1], k = n.isla;
    if (I.obras[k]) { evento(Z, s, 'atajoCerrado', { isla: k }); return costa; }
    abrir(Z, 'DESVIO', { rutas: [{ a: costa, ruta: 'costa' }, { a: atajo, ruta: 'atajo' }], venta: I.senora === k ? PUESTOS[k].lugar : null });
    return -1;
  }
  var P = n.peaje, sg = sal[0], cruza = sal[1], fee = feeDe(N, P.id), cerrada = P.id === 'lancha' ? lanchaCerrada(N) : '';
  if (cerrada) { evento(Z, s, 'lanchaCerrada', { por: cerrada }); return sg; }
  if (p.bs < fee) { evento(Z, s, 'sinPeaje', { peaje: P.id, fee: fee }); return sg; }
  abrir(Z, 'CRUCE', { peaje: P.id, fee: fee, de: P.de, a: P.a }, { sigue: sg, cruza: cruza });
  return -1;
}

/* ───── la señora de las empanadas y el Bachaquero ───── */
function puesto(Z, s, k) {
  var N = Z.N, p = N.pj[s];
  if (N.isla.senora === k) {
    if (p.bs < 20) { evento(Z, s, 'empanadaCara'); return false; }
    return abrir(Z, 'EMPANADA', { precio: 20, isla: k });
  }
  var cobra = Math.min(30, p.bs);
  evento(Z, s, 'bachaquero', { cobra: cobra }); mon(Z, s, -cobra, 'bachaquero'); p.pimpinas++;
  return false;
}

/* ───── lugares con personaje (se activan al pasar; el san y el calabozo distinguen pasar de caer) ───── */
var LUGAR = {
  bodega: function (Z, s) {
    var N = Z.N, p = N.pj[s];
    if (p.items.length >= LLENO) { evento(Z, s, 'bodegaLleno'); return false; }
    var of = ITEM_IDS.filter(function (k) { return precio(N, k) <= p.bs; }).map(function (k) { return { item: k, precio: precio(N, k) }; });
    if (!of.length) { evento(Z, s, 'bodegaFiado'); return false; }
    return abrir(Z, 'BODEGA', of);
  },
  san: function (Z, s) {
    var N = Z.N, p = N.pj[s], pote = N.isla.san;
    if (N.t.resto === 0) {
      if (!pote) { evento(Z, s, 'sanVacio'); return false; }
      isla(Z, 'san', 0); evento(Z, s, 'sanCobra', { pote: pote }); mon(Z, s, pote, 'san'); return false;
    }
    var v = Math.min(5, p.bs); if (!v) return false;
    mon(Z, s, -v, 'san'); isla(Z, 'san', pote + v); return false;
  },
  picaro: function (Z, s) {
    var N = Z.N, p = N.pj[s], r = rivales(N, s), ops = [];
    if (p.bs >= 5 && r.some(function (o) { return N.pj[o].bs > 0; })) ops.push('plata');
    if (p.bs >= 30 && r.some(function (o) { return N.pj[o].emp > 0; })) ops.push('emp');
    if (!ops.length) { evento(Z, s, 'picaroNada'); return false; }
    return abrir(Z, 'PICARO', ops);
  },
  perla: function (Z, s) {
    var k = Z.r.pick(ITEM_IDS);
    if (!darItem(Z, s, k, 'perlero')) { evento(Z, s, 'perla'); mon(Z, s, 8, 'perlero'); }
    return false;
  },
  sambil: function (Z, s) { var c = Z.N.isla.oferta ? 3 : 5; if (Z.N.pj[s].bs < c) return false; return abrir(Z, 'RIFA', { costo: c }); },
  canon: function (Z) { return abrir(Z, 'CANON', {}); },
  monos: function (Z, s) {
    var p = Z.N.pj[s];
    if (Z.r.next() < .5) { evento(Z, s, 'monoMango'); mon(Z, s, 3, 'monos'); return false; }
    if (p.items.length) { quitar(Z, s, Z.r.pick(p.items), 'mono'); return false; }
    evento(Z, s, 'monoArranca'); mon(Z, s, -3, 'monos'); return false;
  },
  matasiete: function (Z, s) {
    var N = Z.N, r = rivales(N, s).filter(function (o) { return !NOD[N.pj[o].en].cruce; });
    if (!r.length) return false;
    return abrir(Z, 'MATASIETE', r);
  },
  calabozo: function (Z, s) {
    var N = Z.N; if (N.t.resto !== 0) return false;
    if (N.pj[s].bs >= 10) return abrir(Z, 'CALABOZO', { fianza: 10 });
    N.pj[s].pierde = true; evento(Z, s, 'preso'); return false;
  }
};
function canonDispara(Z, s) {
  var a = Z.r.pick(LIBRES); hop(Z, s, a, 'canon'); Z.N.t.resto = 0;
}
function retroceder(Z, x, n) { for (var i = 0; i < n; i++) { var pr = G.PREV[Z.N.pj[x].en]; if (!pr) break; hop(Z, x, pr[0], 'atras'); } }

/* ───── las casillas ───── */
function caer(Z, s) {
  var N = Z.N, I = N.isla, p = N.pj[s], n = NOD[p.en], t = n.t;
  emit(Z, { k: 'cae', s: s, nodo: n.id, t: t, color: t === 'B' ? 'azul' : t === 'R' || t === 'A' ? 'rojo' : Z.r.pick(['azul', 'rojo']) });
  var x2 = (I.carnaval ? 2 : 1) * (I.final ? 2 : 1);
  if ((t === 'B' || t === 'R') && Z.r.next() < .06) tesoro(Z, s);
  if (t === 'B') {
    if (I.sinAgua && islaDe(N, s) === I.sinAgua.k) { evento(Z, s, 'sinAgua'); return false; }
    mon(Z, s, (3 + (I.turistas ? 2 : 0)) * x2, 'azul');
  } else if (t === 'R') mon(Z, s, -(I.lluvia ? 6 : 3) * (I.final ? 2 : 1), 'roja');
  else if (t === 'V') vaina(Z, s);
  else if (t === 'I') { var k = Z.r.pick(ITEM_IDS); if (!darItem(Z, s, k, 'suerte')) { evento(Z, s, 'suerteLleno'); mon(Z, s, 5, 'suerte'); } }
  else if (t === 'D') return abrir(Z, 'BRONCA', rivales(N, s));
  else if (t === 'E') { bono(Z, s, 'ev', 1); penero(Z, s); }
  else if (t === 'T') { bono(Z, s, 'ev', 1); triple(Z); }
  else if (t === 'M' && N.cfg.micro && p.cpu === null) return abrir(Z, 'MICRO', { premio: 10 });   // local: lo juegas de verdad y tu pantalla dice si ganaste
  else if (t === 'M') { var gana = Z.r.next() < .5; evento(Z, s, 'micro', { gana: gana ? 1 : 0 }); if (gana) mon(Z, s, 10, 'micro'); }   // P3: ruleta del microjuego
  else if (t === 'H') {
    if (Z.r.next() < .7) { evento(Z, s, 'malta'); N.t.extra = 1; return abrirDado(Z); }
    p.pierde = true; evento(Z, s, 'pescado');
  } else if (t === 'A') { bono(Z, s, 'ev', 1); evento(Z, s, 'apagonCasa'); mon(Z, s, -Z.r.int(5, 15), 'apagon'); }
  return false;
}
function tesoro(Z, s) {
  evento(Z, s, 'cofre');
  if (Z.r.next() < .2) { emp(Z, s, 1, 'tesoro'); return; }
  if (Z.r.next() < .5 && darItem(Z, s, Z.r.pick(ITEM_IDS), 'tesoro')) return;
  mon(Z, s, 15 * (Z.N.isla.final ? 2 : 1), 'tesoro');
}
function penero(Z) { var a = Z.N.isla.senora; emit(Z, { k: 'penero', de: a, a: a === 'O' ? 'W' : 'O' }); }
function triple(Z) {
  var N = Z.N, a = Z.r.pick(seats(N)), b = Z.r.pick(rivales(N, a)), c = Z.r.int(0, 4), d;
  emit(Z, { k: 'triple', a: a, b: b, c: c });
  if (c === 0) { d = -mon(Z, a, -10, 'triple'); mon(Z, b, d, 'triple'); }
  else if (c === 1) { d = -mon(Z, b, -10, 'triple'); mon(Z, a, d, 'triple'); }
  else if (c === 2) emit(Z, { k: 'swap', a: a, b: b, campo: 'bs' });
  else if (c === 3) { if (N.pj[a].emp > 0) { emp(Z, a, -1, 'triple'); emp(Z, b, 1, 'triple'); } }
  else emit(Z, { k: 'swap', a: a, b: b, campo: 'emp' });
}
function vaina(Z, s) {
  var N = Z.N, I = N.isla, v = Z.r.pick(VAINAS), p = { id: v };
  bono(Z, s, 'ev', 1);
  if (v === 'obras') { var n = NOD[N.pj[s].en], k = n.isla === 'X' ? Z.r.pick(['O', 'W']) : n.isla, o = clon(I.obras); o[k] = !o[k]; p.isla = k; p.cerrado = o[k] ? 1 : 0; emit(Z, { k: 'vaina', s: s, id: v, p: p }); isla(Z, 'obras', o); return; }
  emit(Z, { k: 'vaina', s: s, id: v, p: p });
  if (v === 'aguacero') isla(Z, 'lluvia', 2);
  else if (v === 'leva') isla(Z, 'leva', 2);
  else if (v === 'turistas') isla(Z, 'turistas', 2);
  else isla(Z, 'apagon', true);
}

/* ───── noticias de la isla (una por ronda, a veces) y las carteras de los turistas ───── */
var NOTICIAS = [
  { id: 'agua', ok: function (N) { return !N.isla.sinAgua; }, f: function (Z) { var k = Z.r.pick(['O', 'W']); emit(Z, { k: 'noticia', id: 'agua', p: { isla: k } }); isla(Z, 'sinAgua', { k: k, n: 2 }); } },
  { id: 'piratas', ok: function () { return true; }, f: function (Z) {
    var N = Z.N, k = porIsla(N, 'O').length >= porIsla(N, 'W').length ? 'O' : 'W', v = porIsla(N, k);
    var libres = NOD.filter(function (n) { return n.isla === k && n.t === 'B' && !n.lugar && !n.ramas; }), n = Z.r.pick(libres);
    emit(Z, { k: 'noticia', id: 'piratas', p: { isla: k, vict: v, cofre: n.id } });
    v.forEach(function (x) { mon(Z, x, -5, 'piratas'); });
    isla(Z, 'bolsas', N.isla.bolsas.concat([{ en: n.id, bs: 20, cofre: 1 }]));
  } },
  { id: 'kraken', ok: function (N) { return !N.isla.kraken; }, f: function (Z) {
    var N = Z.N, agua = seats(N).filter(function (x) { var c = NOD[N.pj[x].en].cruce; return c === 'lancha' || c === 'ferry'; });
    emit(Z, { k: 'noticia', id: 'kraken', p: { vuelven: agua } }); isla(Z, 'kraken', 2);
    agua.forEach(function (x) { hop(Z, x, NOD[N.pj[x].en].cruce === 'lancha' ? J.PP.id : J.MUELLE.id, 'kraken'); });
  } },
  { id: 'sirena', ok: function (N) { return !N.isla.sirena; }, f: function (Z) { var n = G.SEGS.agua.ids[3]; emit(Z, { k: 'noticia', id: 'sirena', p: { nodo: n } }); isla(Z, 'sirena', { nodo: n, n: 2, vistos: [] }); } },
  { id: 'ovni', ok: function () { return true; }, f: function (Z) {
    var v = Z.r.pick(seats(Z.N)), a = Z.r.pick(LIBRES);
    emit(Z, { k: 'noticia', id: 'ovni', p: { vict: v, a: a } }); hop(Z, v, a, 'ovni');
  } },
  { id: 'oferta', ok: function (N) { return !N.isla.oferta; }, f: function (Z) { emit(Z, { k: 'noticia', id: 'oferta' }); isla(Z, 'oferta', 2); } },
  { id: 'silbon', ok: function (N) { return deNoche(N) && N.isla.silbon === null; }, f: function (Z) {
    var N = Z.N, n = NOD[N.pj[lider(N, seats(N))].en];
    for (var i = 0; i < Z.r.int(3, 7); i++) n = NOD[n.next[0]];   // como hoy: el tope se vuelve a sortear en cada vuelta
    if (n.ramas || n.lugar) n = NOD[n.next[0]];
    emit(Z, { k: 'noticia', id: 'silbon', p: { nodo: n.id } }); isla(Z, 'silbon', n.id);
  } },
  { id: 'pesca', ok: function () { return true; }, f: function (Z) {
    var g = porIsla(Z.N, 'W'); emit(Z, { k: 'noticia', id: 'pesca', p: { ganan: g } }); g.forEach(function (x) { mon(Z, x, 5, 'pesca'); });
  } },
  { id: 'virgen', ok: function () { return true; }, f: function (Z) {
    var N = Z.N, pe = peor(N), k = Z.r.pick(ITEM_IDS);   // +3 a todos no cambia quién va de último
    emit(Z, { k: 'noticia', id: 'virgen', p: { peor: pe, item: k } });
    seats(N).forEach(function (x) { mon(Z, x, 3, 'virgen'); });
    darItem(Z, pe, k, 'virgen');
  } },
  { id: 'apagon', ok: function (N) { return !N.isla.apagon && N.isla.hora !== 'noche'; }, f: function (Z) { emit(Z, { k: 'noticia', id: 'apagon' }); isla(Z, 'apagon', true); } }
];
function noticias(Z) {
  var N = Z.N, I = N.isla;
  if (I.sinAgua) { if (I.sinAgua.n > 1) isla(Z, 'sinAgua', { k: I.sinAgua.k, n: I.sinAgua.n - 1 }); else { evento(Z, null, 'cisterna', { isla: I.sinAgua.k }); isla(Z, 'sinAgua', null); } }
  if (I.kraken) { isla(Z, 'kraken', I.kraken - 1); if (!I.kraken) evento(Z, null, 'krakenSeVa'); }
  if (I.sirena) { if (I.sirena.n > 1) isla(Z, 'sirena', { nodo: I.sirena.nodo, n: I.sirena.n - 1, vistos: I.sirena.vistos }); else { isla(Z, 'sirena', null); evento(Z, null, 'sirenaSeVa'); } }
  if (I.oferta) { isla(Z, 'oferta', I.oferta - 1); if (!I.oferta) evento(Z, null, 'ofertaSeAcaba'); }
  if (I.silbon !== null && !deNoche(N)) { isla(Z, 'silbon', null); evento(Z, null, 'silbonSeVa'); }
  if (Z.r.next() > .55) return;
  Z.r.pick(NOTICIAS.filter(function (x) { return x.ok(N); })).f(Z);
}
function soltarBolsas(Z) {
  var N = Z.N, I = N.isla;
  if (Z.r.next() > .55) return;
  var libres = NOD.filter(function (n) { return n.t === 'B' && !n.lugar && !n.ramas && !n.cruce && n.isla !== 'C' &&
    !I.bolsas.some(function (b) { return b.en === n.id; }) && !seats(N).some(function (x) { return N.pj[x].en === n.id; }); });
  var n = Z.r.pick(libres), v = Z.r.pick(BOLSAS);
  emit(Z, { k: 'bolsa', en: n.id, bs: v }); isla(Z, 'bolsas', I.bolsas.concat([{ en: n.id, bs: v }]));
}

/* ───── turnos y rondas ───── */
function iniTurno(Z, s) {
  var N = Z.N, p = N.pj[s]; N.f = 'turno'; N.esp = null;
  emit(Z, { k: 'turno', s: s });
  N.t = { s: s, resto: 0, q: [{ k: 'fin' }], ctx: null, extra: 0 };
  if (p.pierde) { p.pierde = false; evento(Z, s, 'pierdeTurno'); finTurno(Z); return; }
  abrirDado(Z);
}
function finTurno(Z) {
  var N = Z.N, i = N.orden.indexOf(N.t.s); N.esp = null; N.t = null; Z.P.cpuAt = null;
  if (i < N.orden.length - 1) iniTurno(Z, N.orden[i + 1]); else mjRonda(Z);
}
function iniRonda(Z, r) {
  var N = Z.N, I = N.isla; N.r = r; N.f = 'turno';
  emit(Z, { k: 'ronda', r: r });
  if (r > 1) {
    if (I.lluvia) { isla(Z, 'lluvia', I.lluvia - 1); if (!I.lluvia) evento(Z, null, 'escampo'); }
    if (I.leva) { isla(Z, 'leva', I.leva - 1); if (!I.leva) evento(Z, null, 'calma'); }
    if (I.turistas) { isla(Z, 'turistas', I.turistas - 1); if (!I.turistas) evento(Z, null, 'turistasSeVan'); }
    if (I.apagon) { isla(Z, 'apagon', false); evento(Z, null, 'volvioLaLuz'); }
  }
  var antes = I.hora; isla(Z, 'hora', HORAS[(r - 1) % 4]);
  if (I.hora !== antes) evento(Z, null, I.hora === 'tarde' ? 'atardece' : I.hora === 'noche' ? 'anochece' : 'amanece');
  isla(Z, 'carnaval', r === carnavalR(N)); isla(Z, 'final', r >= finalR(N));
  if (I.carnaval) evento(Z, null, 'carnaval');
  if (r === finalR(N)) {
    evento(Z, null, 'recta');
    var pe = peor(N), k = Z.r.pick(['mototaxi', 'guarapo', 'trucado']);
    evento(Z, pe, 'tiaDeMiami', { item: k }); mon(Z, pe, 10, 'tia'); darItem(Z, pe, k, 'tia');
  } else if (r === N.tot) evento(Z, null, 'ultimoTurno');
  if (r > 1) { noticias(Z); soltarBolsas(Z); }
  iniTurno(Z, N.orden[0]);
}
function revelarOrden(Z) {
  var N = Z.N, ss = seats(N);
  N.orden = N.cfg.orden === 'fijo' ? ss : Z.r.shuffle(ss);   // P2: turno sorteado, con su tarjeta
  emit(Z, { k: 'orden', orden: N.orden.slice() });
  iniRonda(Z, 1);
}

/* ───── minijuegos: la ronda (por el color de la última casilla) y la BRONCA (1v1 con apuesta) ───── */
function nivel(N) { return N.r <= N.tot / 3 ? 1 : N.r <= 2 * N.tot / 3 ? 2 : 3; }
function elegir(Z, tipo) {
  var P = Z.P, l = FR.CATALOGO.filter(function (g) { return g.live && !g.fuera && g.m.indexOf(tipo) >= 0; });
  if (!l.length) return null;
  var n = l.filter(function (g) { return P.recientes.indexOf(g.g) < 0; }), g = Z.r.pick(n.length ? n : l);
  P.recientes.push(g.g); while (P.recientes.length > 4) P.recientes.shift(); return g;
}
function catalogo(g) { return FR.CATALOGO.filter(function (c) { return c.g === g; })[0] || { g: g, dur: 30, mo: 'A', cl: 'rank' }; }
function simulado(N, as) { return !!N.cfg.sinMJ || !humanos(N, as).length; }
function mjRonda(Z) {
  var N = Z.N, as = seats(N).slice().sort(), tipo = 'ffa', eq = as.map(function (s) { return [s]; }), solo = null;
  if (!N.isla.carnaval) {
    var az = as.filter(function (s) { return N.pj[s].color === 'azul'; }), ro = as.filter(function (s) { return N.pj[s].color === 'rojo'; });
    if (az.length && ro.length) {
      if (az.length === 2) { tipo = '2v2'; eq = [az, ro]; }
      else { tipo = '1v3'; solo = az.length === 1 ? az[0] : ro[0]; eq = [[solo], as.filter(function (s) { return s !== solo; })]; }
    }
  }
  var g = elegir(Z, tipo);
  if (!g) { tipo = 'ffa'; solo = null; eq = as.map(function (s) { return [s]; }); g = elegir(Z, 'ffa'); }
  emit(Z, { k: 'equipos', tipo: tipo, eq: eq });
  formarMJ(Z, { tipo: tipo, as: as, eq: eq, solo: solo, g: g, duelo: null });
}
function formarMJ(Z, o) {
  var N = Z.N, as = o.as, cl = o.tipo === '2v2' || o.tipo === '1v3' ? 'binary' : o.g.cl;
  N.mk++;
  var mj = { k: N.mk, tipo: o.tipo, clase: cl, eq: o.eq, solo: o.solo, as: as, i: 0, e: 0, listos: {}, watch: 0, res: null, duelo: o.duelo, rel: 0, suma: null,
    cola: [{ g: o.g.g, seed: Z.r.int(1, 2147483646), dur: o.g.dur, lv: nivel(N), modelo: o.g.mo, reto: false }], cartaHasta: 0, startAt: null, cierre: null };
  emit(Z, { k: 'mjIni', mk: mj.k, tipo: mj.tipo, eq: mj.eq, g: o.g.g, duelo: o.duelo ? 1 : 0, premio: o.duelo ? o.duelo.apuesta : premioMJ(N) });
  if (simulado(N, as)) {   // sin humanos en el juego (o ?sinmj=1): como simular() de hoy, 50/50 por lado o 1 de 4
    var pu;
    if (o.tipo === 'ffa' || o.tipo === '1v1') { var w = o.tipo === '1v1' ? (Z.r.next() < .5 ? 0 : 1) : Z.r.int(0, as.length - 1); pu = as.map(function (s, i) { return i === w ? 1 : 2; }); }
    else { var lado = o.eq[Z.r.next() < .5 ? 0 : 1]; pu = as.map(function (s) { return lado.indexOf(s) >= 0 ? 1 : 2; }); }
    pagarMJ(Z, mj, pu, false);
    if (o.duelo) return false;
    siguienteRonda(Z); return true;
  }
  as.forEach(function (s) { var p = N.pj[s]; if (p.toma) { p.toma = 0; p.cpu = null; p.afk = 0; } });
  var hs = humanos(N, as).sort(function (a, b) { return (a === o.solo) - (b === o.solo) || (a < b ? -1 : 1); });
  humanos(N).forEach(function (s) { if (hs.indexOf(s) < 0) hs.push(s); });
  mj.juez = hs[0] || null; mj.suc = hs.slice(1);
  N.mj = mj; N.f = 'carta'; N.esp = null; Z.P.cpuAt = null;
  mj.cartaHasta = Z.now + fxMs(Z.fx) + T.carta; N.nextAt = mj.cartaHasta;
  return true;
}
function premioMJ(N) { return N.isla.carnaval ? 15 : 10; }
function pagarMJ(Z, mj, pu, empate) {
  var N = Z.N, pg = mj.as.map(function () { return 0; }), i;
  if (empate) { emit(Z, { k: 'mjRes', mk: mj.k, as: mj.as, puestos: pu, pagos: pg, empate: 1 }); return; }
  if (mj.duelo) {
    var g = []; pu.forEach(function (p, j) { if (p === 1) g.push(j); });
    var w = g.length === 1 ? g[0] : (Z.r.next() < .5 ? 0 : 1), d = Math.min(mj.duelo.apuesta, N.pj[mj.as[1 - w]].bs);   // empate: a la suerte, como hoy
    pg[w] = d; pg[1 - w] = -d;
    emit(Z, { k: 'mjRes', mk: mj.k, as: mj.as, puestos: pu, pagos: pg, gana: mj.as[w] });
    if (d) { mon(Z, mj.as[1 - w], -d, 'bronca'); mon(Z, mj.as[w], d, 'bronca'); }
    return;
  }
  var pr = premioMJ(N);
  for (i = 0; i < pu.length; i++) if (pu[i] === 1) pg[i] = pr;
  emit(Z, { k: 'mjRes', mk: mj.k, as: mj.as, puestos: pu, pagos: pg });
  for (i = 0; i < pu.length; i++) if (pg[i]) { bono(Z, mj.as[i], 'mj', pr); mon(Z, mj.as[i], pr, 'mj'); }
}
function bronca(Z, s, x) {
  var N = Z.N, ap = Math.min(10, N.pj[s].bs, N.pj[x].bs);
  if (!ap) { evento(Z, s, 'broncaPelaos', { vs: x }); return false; }
  var l = DUELOS.filter(function (g) { return g !== N.isla.ultDuelo; }), g = Z.r.pick(l);
  isla(Z, 'ultDuelo', g);
  return formarMJ(Z, { tipo: '1v1', as: [s, x], eq: [[s], [x]], solo: null, g: catalogo(g), duelo: { s: s, a: x, apuesta: ap } });
}
function listosTodos(N) { var mj = N.mj; return humanos(N, mj.as).every(function (s) { return mj.listos[s]; }); }
function empezarMJ(Z) { var N = Z.N, mj = N.mj, g = mj.cola[mj.i]; N.f = 'mj'; mj.startAt = Z.now + T.cuenta; mj.cierre = mj.startAt + g.dur * 1000 + T.cierre; N.nextAt = mj.cierre; }
function resultadoMJ(Z, a, vencido) {
  var N = Z.N, mj = N.mj, n = mj.as.length, sc = null, pu, i;
  if (!vencido) {
    sc = a.sc; if (!sc || sc.length !== n) return 'opcion';
    for (i = 0; i < n; i++) if (typeof sc[i] !== 'number' || !isFinite(sc[i])) return 'opcion';
    if (a.pl && a.pl.length === n && a.pl.every(function (x) { return x >= 1 && x <= n && Math.floor(x) === x; })) pu = a.pl.slice();
    else pu = FR.compara(mj.tipo === '1v3' ? '1v3' : mj.tipo === '2v2' ? '2v2' : 'ffa', FR.eqIdx(mj), sc).puestos;
    pagarMJ(Z, mj, pu, false);
  } else { pu = mj.as.map(function () { return 1; }); pagarMJ(Z, mj, pu, true); }
  mj.res = { sc: sc, puestos: pu, empate: vencido ? 1 : 0, cpu: a && a.cpu || [], h: a && a.h || 0, por: a && a.por || (vencido ? 'plazo' : 'juez'), disputado: !!(a && a.disputado), aj: !!(a && a.aj) };
  N.f = 'res'; N.nextAt = Z.now + fxMs(Z.fx) + T.res; return null;
}
function postRes(Z) {
  var N = Z.N, mj = N.mj; N.mj = null;
  if (mj.duelo) { N.f = 'turno'; seguir(Z); } else siguienteRonda(Z);
}
function siguienteRonda(Z) { var N = Z.N; if (N.r >= N.tot) final(Z); else iniRonda(Z, N.r + 1); }
function final(Z) {
  var N = Z.N, ss = seats(N); N.t = null; N.esp = null; N.f = 'final'; Z.P.cpuAt = null;
  [['mj', 'mj'], ['max', 'max'], ['ev', 'ev']].forEach(function (b) {   // las empanadas extra: el empate se las lleva todo el que llegó al tope
    var top = Math.max.apply(null, ss.map(function (s) { return N.pj[s].bono[b[1]]; })), g = ss.filter(function (s) { return N.pj[s].bono[b[1]] === top; });
    emit(Z, { k: 'bonusFin', id: b[0], ganan: g, top: top }); g.forEach(function (s) { emp(Z, s, 1, 'bonus'); });
  });
  var o = ss.slice().sort(function (a, b) { return N.pj[b].emp - N.pj[a].emp || N.pj[b].bs - N.pj[a].bs; });
  N.podio = o.map(function (s, i) { return { s: s, emp: N.pj[s].emp, bs: N.pj[s].bs, p: i + 1 }; });
  N.ganador = o[0];
  emit(Z, { k: 'fin', gan: [o[0]], podio: N.podio });
  N.nextAt = Z.now + fxMs(Z.fx) + T.final;
}

/* ───── respuestas a cada aviso (devuelven el código de error o null) ───── */
function entero(n, a, b) { return typeof n === 'number' && Math.floor(n) === n && n >= a && n <= b; }
var RESP = {
  DADO: function (Z, s, a, e) {
    var N = Z.N, t = N.t;
    if (a.t === 'TIRAR') { cierra(Z); rodar(Z, s, 1, t.extra ? 'malta' : 'd10'); return null; }
    if (a.t !== 'USAR') return 'accion';
    var k = a.item; if (e.opc.indexOf(k) < 1) return 'opcion';
    cierra(Z); quitar(Z, s, k, 'usa');
    if (k === 'mototaxi') { hop(Z, s, PUESTOS[N.isla.senora].nodo, 'moto'); t.q.unshift({ k: 'puesto', isla: N.isla.senora }); return null; }   // sin caer
    if (k === 'colearse') { var o = Z.r.pick(rivales(N, s)), x = N.pj[s].en, y = N.pj[o].en; emit(Z, { k: 'colearse', s: s, con: o }); hop(Z, s, y, 'cole'); hop(Z, o, x, 'cole'); rodar(Z, s, 1, 'd10'); return null; }
    if (k === 'trucado') { abrir(Z, 'TRUCADO', { min: 1, max: 10 }); return null; }
    rodar(Z, s, ITEMS[k].dados, k); return null;
  },
  TRUCADO: function (Z, s, a) {
    if (a.t !== 'PASOS') return 'accion'; if (!entero(a.n, 1, 10)) return 'opcion';
    cierra(Z); emit(Z, { k: 'dado', s: s, v: a.n, dados: [a.n], max: 10, de: 'trucado' });
    Z.N.t.resto = a.n; Z.N.t.q.unshift({ k: 'mover' }, { k: 'caer' }); return null;
  },
  CRUCE: function (Z, s, a, e, c) {
    if (a.t !== 'CRUZAR') return 'accion';
    if (!a.si) { cierra(Z); paso(Z, s, c.sigue); return null; }
    var p = Z.N.pj[s];
    cierra(Z); abrir(Z, 'PEAJE', { peaje: e.opc.peaje, fee: e.opc.fee, tope: Math.min(50, p.bs), palanca: p.items.indexOf('palanca') >= 0 }, c);
    return null;
  },
  PEAJE: function (Z, s, a, e, c) {
    var N = Z.N, o = e.opc;
    if (a.t === 'NO') { cierra(Z); paso(Z, s, c.sigue); return null; }
    if (a.t === 'PALANCA') { if (!o.palanca) return 'opcion'; cierra(Z); quitar(Z, s, 'palanca', 'usa'); emit(Z, { k: 'cruza', s: s, por: o.peaje, palanca: 1 }); paso(Z, s, c.cruza); return null; }
    if (a.t !== 'PAGAR') return 'accion';
    if (!entero(a.bs, o.fee, o.tope)) return 'opcion';
    cierra(Z); mon(Z, s, -a.bs, 'peaje');
    var nuevo = o.peaje === 'restinga' && deNoche(N) ? Math.max(1, Math.round(a.bs / 2)) : a.bs, pj = clon(N.isla.peajes); pj[o.peaje] = nuevo;   // de noche pagas el doble: el peaje base queda en la mitad
    emit(Z, { k: 'peaje', s: s, id: o.peaje, pago: a.bs, fee: nuevo }); isla(Z, 'peajes', pj);
    emit(Z, { k: 'cruza', s: s, por: o.peaje }); paso(Z, s, c.cruza); return null;
  },
  FERRY: function (Z, s, a, e, c) {
    if (a.t !== 'FERRY') return 'accion';
    cierra(Z);
    if (a.si && Z.N.pj[s].bs >= c.c) { mon(Z, s, -c.c, 'ferry'); emit(Z, { k: 'cruza', s: s, por: 'ferry' }); paso(Z, s, c.va); } else paso(Z, s, c.sigue);
    return null;
  },
  DESVIO: function (Z, s, a, e) {
    if (a.t !== 'RUTA') return 'accion';
    if (!e.opc.rutas.some(function (r) { return r.a === a.a; })) return 'opcion';
    cierra(Z); paso(Z, s, a.a); return null;
  },
  EMPANADA: function (Z, s, a) {
    if (a.t !== 'COMPRAR') return 'accion';
    if (a.si) { if (Z.N.pj[s].bs < 20) return 'monedas'; cierra(Z); mon(Z, s, -20, 'empanada'); emp(Z, s, 1, 'senora'); return null; }
    cierra(Z); return null;
  },
  BODEGA: function (Z, s, a, e) {
    if (a.t !== 'COMPRAR') return 'accion';
    if (a.item == null) { cierra(Z); return null; }
    var o = e.opc.filter(function (x) { return x.item === a.item; })[0]; if (!o) return 'opcion';
    cierra(Z); mon(Z, s, -o.precio, 'bodega'); darItem(Z, s, o.item, 'compra'); return null;
  },
  PICARO: function (Z, s, a, e) {
    if (a.t !== 'NEGOCIO') return 'accion';
    if (a.op == null) { cierra(Z); return null; }
    if (e.opc.indexOf(a.op) < 0) return 'opcion';
    var N = Z.N, l = rivales(N, s).filter(function (o) { return a.op === 'emp' ? N.pj[o].emp > 0 : N.pj[o].bs > 0; });
    cierra(Z); abrir(Z, 'VICTIMA', { op: a.op, lista: l }); return null;
  },
  VICTIMA: function (Z, s, a, e) {
    if (a.t !== 'VICTIMA') return 'accion';
    var o = e.opc, x = a.s; if (o.lista.indexOf(x) < 0) return 'objetivo';
    cierra(Z); mon(Z, s, o.op === 'emp' ? -30 : -5, 'picaro');
    if (o.op === 'emp') { emp(Z, x, -1, 'picaro'); emp(Z, s, 1, 'picaro'); }
    else { var v = Math.min(Z.N.pj[x].bs, Z.r.int(5, 15)); mon(Z, x, -v, 'picaro'); mon(Z, s, v, 'picaro'); }
    return null;
  },
  BRONCA: function (Z, s, a, e) {
    if (a.t !== 'RETAR') return 'accion'; if (e.opc.indexOf(a.s) < 0) return 'objetivo';
    cierra(Z); bronca(Z, s, a.s); return null;
  },
  CALABOZO: function (Z, s, a) {
    if (a.t !== 'FIANZA') return 'accion';
    if (a.si) { if (Z.N.pj[s].bs < 10) return 'monedas'; cierra(Z); mon(Z, s, -10, 'fianza'); return null; }
    cierra(Z); Z.N.pj[s].pierde = true; evento(Z, s, 'preso'); return null;
  },
  MATASIETE: function (Z, s, a, e) {
    if (a.t !== 'PIEDRA') return 'accion';
    if (a.s == null) { cierra(Z); return null; }
    if (e.opc.indexOf(a.s) < 0) return 'objetivo';
    cierra(Z); evento(Z, s, 'piedras', { vict: a.s }); retroceder(Z, a.s, 4); return null;
  },
  RIFA: function (Z, s, a, e) {
    if (a.t !== 'RIFA') return 'accion';
    if (!a.si) { cierra(Z); return null; }
    var c = e.opc.costo; if (Z.N.pj[s].bs < c) return 'monedas';
    cierra(Z); mon(Z, s, -c, 'rifa');
    var sale = RNG.pesos(Z.r, RIFA), k = null;
    if (sale === 'objeto') k = Z.r.pick(ITEM_IDS);
    emit(Z, { k: 'rifa', s: s, sale: sale, item: k });
    if (k) { if (!darItem(Z, s, k, 'rifa')) mon(Z, s, 5, 'rifa'); }
    else if (sale === '15') mon(Z, s, 15, 'rifa');
    else if (sale === '30') mon(Z, s, 30, 'rifa');
    else if (sale === 'emp') emp(Z, s, 1, 'rifa');
    return null;
  },
  MICRO: function (Z, s, a) {
    if (a.t !== 'MICRO') return 'accion';
    cierra(Z); if (a.gana) mon(Z, s, 10, 'micro'); return null;
  },
  CANON: function (Z, s, a) {
    if (a.t !== 'CANON') return 'accion';
    cierra(Z); if (a.si) canonDispara(Z, s); return null;
  }
};

/* ───── crear / aplicar / tick ───── */
function crear(semilla, cfg, asientos, ahora) {
  var c = Object.assign({}, CFG0, cfg || {}), n = c.n, now = ahora || 0, i;
  if (!(n >= 2 && n <= 4)) throw new Error('margarita: cfg.n debe ser 2..4');
  if (!(c.tot >= 1 && c.tot <= 30)) throw new Error('margarita: cfg.tot debe ser 1..30');
  asientos = asientos || []; if (asientos.length > n) throw new Error('margarita: demasiados asientos');
  var r = RNG.crear(semilla), usados = {}, pj = {}, PJ = FR.PERSONAJES;
  asientos.forEach(function (a) { if (a && a.ch && !usados[a.ch] && PJ.some(function (x) { return x.id === a.ch; })) usados[a.ch] = 1; });
  var libres = r.shuffle(PJ.filter(function (x) { return !usados[x.id]; }));
  for (i = 0; i < n; i++) {
    var s = SEATS[i], a = asientos[i], cpu = a ? (a.cpu === 'auto' ? 'auto' : null) : 'auto';
    var ch = a && a.ch && usados[a.ch] === 1 ? (usados[a.ch] = 2, a.ch) : libres.shift().id;
    var pn = PJ.filter(function (x) { return x.id === ch; })[0].n;
    pj[s] = { ch: ch, name: a && a.name ? String(a.name).slice(0, 16) : pn, en: J.POR.id, bs: 10, emp: 0, items: [], color: 'azul', pierde: false,
      pimpinas: 0, bono: { mj: 0, max: 10, ev: 0 }, sec: [], cpu: cpu, afk: 0, toma: 0 };
  }
  var S = { tab: 'margarita', f: 'orden', r: 0, tot: c.tot, cfg: c, orden: [], t: null, esp: null, pj: pj,
    isla: { senora: 'O', bacha: 'W', peajes: { restinga: 1, lancha: 1 }, san: 0, bolsas: [], hora: 'dia', lluvia: 0, leva: 0, turistas: 0, apagon: false,
      obras: { O: false, W: false }, carnaval: false, final: false, sinAgua: null, kraken: 0, sirena: null, oferta: 0, silbon: null, ultDuelo: null },
    mj: null, mk: 0, podio: null, ganador: null, nextAt: now + T.orden, ver: 1, fx: [], log: [] };
  var P = { rng: r.estado, semilla: semilla, aid: {}, cpuAt: null, recientes: [] };
  return { S: S, priv: P };
}
function ctx(S, P, ahora) { var Q = clon(P); return { N: clonS(S), P: Q, S: S, fx: [], now: ahora || 0, r: RNG.desde(Q.rng), auto: false }; }
// Cierra el lote: lo que cambió sin un efecto que lo explique va como {k:'set'} al final, así proyectar(D, fx) da S exacto.
function cerrar(Z, s) {
  var N = Z.N, S = Z.S, R = clonS(S), i;
  Z.P.rng = Z.r.estado;
  for (i = 0; i < Z.fx.length; i++) aplicaFx(R, Z.fx[i]);
  function dif(a, b, p) { if (js(a) !== js(b)) Z.fx.push({ k: 'set', p: p, v: clon(b) }); }
  function campos(a, b, p) { var ks = {}, k; for (k in a) ks[k] = 1; for (k in b) ks[k] = 1; for (k in ks) dif(a[k], b[k], p + k); }
  Object.keys(Object.assign({}, R, N)).forEach(function (k) {
    if (k === 'fx' || k === 'log' || k === 'ver') return;
    if (k === 'isla') campos(R.isla, N.isla, 'isla.');
    else if (k === 'pj') Object.keys(N.pj).forEach(function (x) { campos(R.pj[x], N.pj[x], 'pj.' + x + '.'); });
    else dif(R[k], N[k], k);
  });
  emit(Z, { k: 'ver', v: S.ver + 1, s: s }); anillo(N, S.ver + 1, s, Z.fx);
  return { S: N, priv: Z.P, fx: Z.fx, error: null };
}
function volver(Z, s) { var N = Z.N, p = N.pj[s]; p.cpu = null; p.afk = 0; emit(Z, { k: 'vuelve', s: s });
  if (N.esp && N.esp.s === s) { Z.P.cpuAt = null; N.nextAt = N.esp.hasta; } }
function ejecutar(Z, s, a) {
  var N = Z.N, t = a && a.t, p, e;
  if (typeof t !== 'string') return 'accion';
  if (N.f === 'fin' || N.f === 'final' || N.f === 'lobby') return 'fase';
  if (s === '$') {
    if (t === 'MJ_RESULTADO' || t === 'MJ_RESULT') { if (N.f !== 'mj' || !N.mj || a.k !== N.mj.k || (a.i != null && a.i !== N.mj.i)) return 'fase'; return resultadoMJ(Z, a, false); }
    if (t === 'JUEZ_ELEGIR') { var jm = N.mj;
      if (!((N.f === 'carta' || N.f === 'mj') && jm && a.k === jm.k && jm.e === 0 && (jm.startAt == null || Z.now < jm.startAt))) return 'cas';
      var hh = humanos(N, jm.as), su = Array.isArray(a.suc) ? a.suc : [], vis = {}; if (hh.indexOf(a.juez) < 0) return 'cas';
      for (var q = 0; q < su.length; q++) { if (hh.indexOf(su[q]) < 0 || su[q] === a.juez || vis[su[q]]) return 'cas'; vis[su[q]] = 1; }
      jm.juez = a.juez; jm.suc = su.slice(); jm.jz = 1; return null; }
    if (t === 'TOMAR_ASIENTO') { p = N.pj[a.s]; if (!p || p.cpu === null) return 'asiento';
      var ch = p.ch; if (a.ch && a.ch !== ch && FR.PERSONAJES.some(function (x) { return x.id === a.ch; }) && !seats(N).some(function (x) { return N.pj[x].ch === a.ch; })) ch = a.ch;
      emit(Z, { k: 'llega', s: a.s, name: String(a.name || 'PANA').slice(0, 16), ch: ch }); p.toma = 1;
      if (!(N.esp && N.esp.s === a.s) && !(N.mj && N.mj.as.indexOf(a.s) >= 0 && N.f !== 'turno')) { p.toma = 0; p.cpu = null; p.afk = 0; }
      return null; }
    if (t === 'AFK') { p = N.pj[a.s]; if (!p || p.cpu !== null) return 'asiento'; p.cpu = 'afk'; emit(Z, { k: 'afk', s: a.s });
      if (N.esp && N.esp.s === a.s) { Z.P.cpuAt = Z.now + T.cpu; N.nextAt = Math.min(N.esp.hasta, Z.P.cpuAt); } return null; }
    return 'accion';
  }
  p = N.pj[s]; if (!p) return 'asiento';
  if (t === 'VOLVER') { if (p.cpu !== 'afk') return 'asiento'; volver(Z, s); return null; }
  // los secretos escondidos en el mapa (mapa.js, MAPA.SECRETOS): +3 Bs cada uno y una empanada al encontrarlos todos
  if (t === 'SECRETO') { if (!entero(a.n, 0, N.cfg.secretos - 1)) return 'opcion'; if (p.sec.indexOf(a.n) >= 0) return null;
    p.sec.push(a.n); evento(Z, s, 'secreto', { n: p.sec.length, de: N.cfg.secretos }); mon(Z, s, 3, 'secreto');
    if (p.sec.length === N.cfg.secretos) emp(Z, s, 1, 'secretos'); return null; }
  if (t === 'SALIR') { if (p.cpu !== null) return 'asiento'; return ejecutar(Z, '$', { t: 'AFK', s: s }); }
  if (t === 'LISTO') { if (N.f !== 'carta' || N.mj.as.indexOf(s) < 0 || p.cpu !== null) return 'fase'; if (N.mj.listos[s]) return null;
    N.mj.listos[s] = 1; if (listosTodos(N)) empezarMJ(Z); return null; }
  if (t === 'JUEZ') { if ((N.f !== 'carta' && N.f !== 'mj') || p.cpu !== null || a.k !== N.mj.k || a.e !== N.mj.e || (a.q != null && a.q !== N.mj.i)) return 'cas';
    if (N.mj.as.indexOf(s) < 0) return 'asiento'; N.mj.juez = s; N.mj.e++;
    N.mj.suc = N.mj.suc.filter(function (x) { return x !== s; }); return null; }
  e = N.esp;
  if (N.f !== 'turno' || !e) return 'fase';
  if (e.s !== s) return 'turno';
  if (a.eid != null && a.eid !== e.id) return 'eid';
  if (a.ver != null && a.ver !== Z.S.ver) return 'ver';
  if (p.cpu === 'auto' && !Z.auto) return 'cpu';
  if (!Z.auto) { if (p.cpu === 'afk') volver(Z, s); p.afk = 0; }
  var dijo = { k: 'resp', s: s, e: e.k, a: {} };   // lo que respondió, para que las otras pantallas lo cuenten
  Object.keys(a).forEach(function (k) { if (k !== 'eid' && k !== 'aid' && k !== 'ver') dijo.a[k] = a[k]; });
  emit(Z, dijo);
  var err = RESP[e.k](Z, s, a, e, N.t.ctx);
  if (err) return err;
  if (!N.esp) seguir(Z);
  return null;
}
function aplicar(S, P, s, a, ahora) {
  if (a && a.aid && s && s !== '$' && P.aid && P.aid[s] === a.aid) return { S: S, priv: P, fx: [], error: null, dup: true };
  var Z = ctx(S, P, ahora), e = ejecutar(Z, s, a);
  if (e) return { S: S, priv: P, fx: [], error: e };
  if (a.aid && s && s !== '$') Z.P.aid[s] = a.aid;
  return cerrar(Z, s);
}
// Si la CPU no tiene política para el aviso: lo más conservador (no cruzar, no comprar, tirar).
function defecto(N, s) {
  var e = N.esp, o = e.opc;
  var m = { DADO: { t: 'TIRAR' }, TRUCADO: { t: 'PASOS', n: 1 }, CRUCE: { t: 'CRUZAR', si: false }, PEAJE: { t: 'NO' }, FERRY: { t: 'FERRY', si: false },
    DESVIO: { t: 'RUTA', a: o.rutas && o.rutas[0].a }, EMPANADA: { t: 'COMPRAR', si: false }, BODEGA: { t: 'COMPRAR', item: null }, PICARO: { t: 'NEGOCIO', op: null },
    VICTIMA: { t: 'VICTIMA', s: o.lista && o.lista[0] }, BRONCA: { t: 'RETAR', s: o[0] }, CALABOZO: { t: 'FIANZA', si: false }, MATASIETE: { t: 'PIEDRA', s: null },
    RIFA: { t: 'RIFA', si: false }, CANON: { t: 'CANON', si: false }, MICRO: { t: 'MICRO', gana: false } }[e.k];
  return m ? Object.assign({ eid: e.id }, m) : null;
}
function vence(S, P, now) {
  var e = S.esp, f = S.f;
  if (f === 'orden') return now >= S.nextAt ? 'orden' : null;
  if (f === 'turno' && e) { var p = S.pj[e.s]; if (p.cpu) return P.cpuAt != null && now >= P.cpuAt ? 'cpu' : null; return now >= e.hasta ? 'plazo' : null; }
  if (f === 'carta' && S.mj) { var hay = humanos(S, S.mj.as).length > 0; return (now >= S.mj.cartaHasta || (hay && listosTodos(S))) ? 'carta' : null; }
  if (f === 'mj' && S.mj) return now >= S.mj.cierre ? 'cierre' : null;
  if ((f === 'res' || f === 'final') && S.nextAt != null) return now >= S.nextAt ? f : null;
  return null;
}
// La CPU decide sobre el board con el RNG oculto; al vencer el plazo de un humano decide ella también (D6) y se cuenta un
// aviso de AFK: con 2 seguidos el asiento pasa a la CPU. Si la CPU manda algo inválido, va la acción por defecto.
function turnoCPU(S, P, ahora, due, conCPU) {
  var Z = ctx(S, P, ahora), N = Z.N, s = N.esp.s, p = N.pj[s];
  Z.auto = true;
  if (due === 'plazo') { p.afk++; if (p.afk >= 2 && p.cpu === null) { p.cpu = 'afk'; emit(Z, { k: 'afk', s: s }); } }
  var C = conCPU ? CPU() : null, act = C ? C.decide(N, vista(N, s), s, Z.r) : null;
  if (act) {
    var e = ejecutar(Z, s, act);
    if (!e) return Z;
    if (M.reglas.ESTRICTO) throw new Error('margarita: la CPU mandó ' + JSON.stringify(act) + ' a ' + S.esp.k + ' → ' + e);
    return turnoCPU(S, P, ahora, due, false);
  }
  e = ejecutar(Z, s, defecto(N, s)); if (e) throw new Error('margarita: acción por defecto inválida ' + e);
  return Z;
}
function tick(S, P, ahora) {
  var due = vence(S, P, ahora); if (!due) return { S: S, priv: P, fx: [], error: null, nada: true };
  var Z, N;
  if (due === 'cpu' || due === 'plazo') return cerrar(turnoCPU(S, P, ahora, due, true), '$');
  Z = ctx(S, P, ahora); N = Z.N; Z.auto = true;
  if (due === 'orden') revelarOrden(Z);
  else if (due === 'carta') empezarMJ(Z);
  else if (due === 'cierre') resultadoMJ(Z, null, true);
  else if (due === 'res') postRes(Z);
  else if (due === 'final') { N.f = 'fin'; N.nextAt = null; }
  return cerrar(Z, '$');
}

/* ───── vista por asiento ───── */
function vista(S, s, P) {
  var e = S.esp, p = S.pj && S.pj[s] || null, mio = !!(e && p && e.s === s);
  return { s: s, f: S.f, mio: mio, esp: mio ? e : null, pj: p, t: S.t,
    listo: !!(S.f === 'carta' && S.mj && p && p.cpu === null && S.mj.as.indexOf(s) >= 0 && !S.mj.listos[s]) };
}
function hash(S) { var h = 0x811c9dc5; function w(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x === undefined ? null : x);
    if (Array.isArray(x)) return '[' + x.map(w).join(',') + ']';
    return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + w(x[k]); }).join(',') + '}'; }
  var o = {}; Object.keys(S).forEach(function (k) { if (k !== 'fx') o[k] = S[k]; }); var str = w(o);
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

var ACCIONES = ['TIRAR', 'USAR', 'PASOS', 'CRUZAR', 'PALANCA', 'PAGAR', 'NO', 'FERRY', 'RUTA', 'COMPRAR', 'NEGOCIO', 'VICTIMA', 'RETAR', 'FIANZA',
  'PIEDRA', 'RIFA', 'CANON', 'LISTO', 'JUEZ', 'VOLVER', 'SALIR', 'SECRETO', 'MICRO'];
// lo que el anfitrión puede cambiar en el lobby de una sala (el resto de cfg es fijo en línea: orden al azar, minijuegos de verdad, sin MICRO)
var CFG_VALIDA = { tot: [10, 15, 20], cpuNivel: [1, 2, 3] };
// el tablero de una sala en el lobby (el hook le suma pj[asiento] = {ch, name, cpu, listo} al unirse cada quien)
function lobby(cfg) { return { tab: 'margarita', f: 'lobby', cfg: Object.assign({}, CFG0, cfg || {}), pj: {}, ver: 0, fx: [], log: [] }; }
M.reglas = { CFG0: CFG0, PLAZO: PLAZO, T: T, FX_MS: FX_MS, ITEMS: ITEMS, ITEM_IDS: ITEM_IDS, LLENO: LLENO, DUELOS: DUELOS, NOTICIAS: NOTICIAS.map(function (x) { return x.id; }),
  VAINAS: VAINAS, ACCIONES: ACCIONES, CFG_VALIDA: CFG_VALIDA, ESTRICTO: false, grafo: G,
  lobby: lobby, crear: crear, aplicar: aplicar, tick: tick, proyectar: proyectar, aplicaFx: aplicaFx, vista: vista, hash: hash, fxMs: fxMs, defecto: defecto,
  salidas: salidas, feeDe: feeDe, lanchaCerrada: lanchaCerrada, deNoche: deNoche, distVenta: distVenta, precio: precio, islaDe: islaDe, lider: lider, carnavalR: carnavalR, finalR: finalR };
if (typeof module !== 'undefined') module.exports = M.reglas;
})(typeof window !== 'undefined' ? window : globalThis);
