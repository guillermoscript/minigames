// Isla de Margarita · política de la CPU del tablero (doc 14 §6). Pura; UMD, Goja-safe (ES5).
//   decide(S, v, asiento, rng) -> acción para aplicar() | null
//     S = board público, v = reglas.vista(S, asiento), rng = RNG sembrado (en el servidor, el oculto de keys._f).
//   Son las ramas `j.cpu ? … : …` de margarita.js, con las mismas probabilidades. Nivel S.cfg.cpuNivel: el 1 a veces
//   elige al azar entre lo válido; el 2 y el 3 juegan como la CPU de hoy.
(function (root) {
var M = root.MARGA = root.MARGA || {};
var NODE = typeof require !== 'undefined' && typeof module !== 'undefined';
function R() { return M.reglas || (NODE ? require('./margarita-reglas.js') : null); }
var ERR = [0, .35, 0, 0];
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rivales(S, s) { return Object.keys(S.pj).filter(function (x) { return x !== s; }); }
function porMas(S, l, k) { return l.slice().sort(function (a, b) { return S.pj[b][k] - S.pj[a][k]; })[0]; }

// el objeto antes de tirar (itemCPU de hoy)
function dado(S, e, s, rng) {
  var p = S.pj[s], d = R().distVenta(S, s), ok = p.bs >= 20;
  function has(k) { return e.opc.indexOf(k) > 0; }
  var k = null;
  if (has('mototaxi') && ok && d > 6) k = 'mototaxi';
  else if (has('trucado') && ok && d >= 1 && d <= 6) k = 'trucado';
  else if (has('colearse') && rivales(S, s).some(function (o) { return R().distVenta(S, o) + 8 < d; })) k = 'colearse';
  else if (has('guarapo') && (ok || rng.next() < .4)) k = 'guarapo';
  else if (has('cafe') && (ok || rng.next() < .4)) k = 'cafe';
  return k ? { t: 'USAR', item: k } : { t: 'TIRAR' };
}
var POL = {
  DADO: dado,
  TRUCADO: function (S, e, s) { return { t: 'PASOS', n: clamp(R().distVenta(S, s), 1, 6) }; },
  CRUCE: function (S, e, s, rng) {
    var o = e.opc, bs = S.pj[s].bs, quiere = S.isla.senora === o.a;
    return { t: 'CRUZAR', si: quiere ? bs >= o.fee : bs >= o.fee + 25 && rng.next() < .25 };
  },
  PEAJE: function (S, e, s, rng) {
    var o = e.opc, m = o.fee;
    if (o.palanca) return { t: 'PALANCA' };
    if (rng.next() < .3 && o.tope > o.fee + 2) m = o.fee + rng.int(1, Math.min(4, o.tope - o.fee));
    return { t: 'PAGAR', bs: m };
  },
  FERRY: function (S, e, s, rng) { return { t: 'FERRY', si: rng.next() < .35 }; },
  DESVIO: function (S, e, s, rng) {
    var o = e.opc, ok = o.venta ? S.pj[s].bs >= 14 || rng.next() < .3 : rng.next() < .25;
    if (S.pj[s].bs >= 20 && S.isla.puesto !== undefined) {   // con plata para la empanada: la ruta que deja más cerca del puesto de la señora (distancia del tablero)
      var G = R().grafo, d0 = G.distancia(o.rutas[0].a, S.isla.puesto), d1 = G.distancia(o.rutas[1].a, S.isla.puesto);
      if (d0 !== d1) return { t: 'RUTA', a: o.rutas[d0 < d1 ? 0 : 1].a };
    }
    return { t: 'RUTA', a: o.rutas[ok ? 0 : 1].a };
  },
  EMPANADA: function () { return { t: 'COMPRAR', si: true }; },
  BODEGA: function (S, e, s, rng) {
    var bs = S.pj[s].bs, q = e.opc.filter(function (x) { return bs - x.precio >= 20; }).map(function (x) { return x.item; }), k = null;
    if (q.length && rng.next() < .6) k = q.indexOf('mototaxi') >= 0 && rng.next() < .4 ? 'mototaxi' : rng.pick(q);
    return { t: 'COMPRAR', item: k };
  },
  PICARO: function (S, e, s, rng) {
    var bs = S.pj[s].bs, op = null;
    if (bs >= 35 && e.opc.indexOf('emp') >= 0 && rng.next() < .6) op = 'emp';
    else if (bs >= 15 && e.opc.indexOf('plata') >= 0 && rng.next() < .3) op = 'plata';
    return { t: 'NEGOCIO', op: op };
  },
  VICTIMA: function (S, e) { return { t: 'VICTIMA', s: porMas(S, e.opc.lista, e.opc.op === 'emp' ? 'emp' : 'bs') }; },
  BRONCA: function (S, e) { return { t: 'RETAR', s: porMas(S, e.opc, 'bs') }; },
  CALABOZO: function (S, e, s) { return { t: 'FIANZA', si: S.pj[s].bs >= 25 }; },
  MATASIETE: function (S, e, s, rng) { var l = R().lider(S, e.opc); return { t: 'PIEDRA', s: rng.next() < .7 ? l : null }; },
  RIFA: function (S, e, s, rng) { return { t: 'RIFA', si: S.pj[s].bs >= 20 && rng.next() < .5 }; },
  MICRO: function (S, e, s, rng) { return { t: 'MICRO', gana: rng.next() < .5 }; },   // un humano que se fue (afk)
  CANON: function (S, e, s, rng) { return { t: 'CANON', si: rng.next() < (S.isla.senora === 'O' ? .1 : .3) }; }
};
// nivel 1: a veces cualquier cosa válida
function azar(S, e, s, rng) {
  var o = e.opc, si = rng.next() < .5;
  switch (e.k) {
    case 'DADO': return si && o.length > 1 ? { t: 'USAR', item: rng.pick(o.slice(1)) } : { t: 'TIRAR' };
    case 'TRUCADO': return { t: 'PASOS', n: rng.int(1, 6) };
    case 'PEAJE': return { t: 'PAGAR', bs: o.fee };
    case 'DESVIO': return { t: 'RUTA', a: rng.pick(o.rutas).a };
    case 'BODEGA': return { t: 'COMPRAR', item: si ? rng.pick(o).item : null };
    case 'PICARO': return { t: 'NEGOCIO', op: si ? rng.pick(o) : null };
    case 'VICTIMA': return { t: 'VICTIMA', s: rng.pick(o.lista) };
    case 'BRONCA': return { t: 'RETAR', s: rng.pick(o) };
    case 'MATASIETE': return { t: 'PIEDRA', s: si ? rng.pick(o) : null };
    case 'CRUCE': return { t: 'CRUZAR', si: si };
    case 'FERRY': return { t: 'FERRY', si: si };
    case 'EMPANADA': return { t: 'COMPRAR', si: si };
    case 'CALABOZO': return { t: 'FIANZA', si: si };
    case 'RIFA': return { t: 'RIFA', si: si };
    case 'CANON': return { t: 'CANON', si: si };
  }
  return null;
}
function decide(S, v, s, rng) {
  v = v || R().vista(S, s);
  if (!v.mio) return v.listo ? { t: 'LISTO' } : null;
  var e = v.esp, err = ERR[S.cfg && S.cfg.cpuNivel || 2] || 0, a;
  if (err && rng.next() < err) a = azar(S, e, s, rng);
  else a = POL[e.k] ? POL[e.k](S, e, s, rng) : null;
  if (a) a.eid = e.id;
  return a;
}
M.cpu = { decide: decide, ERR: ERR };
if (typeof module !== 'undefined') module.exports = M.cpu;
})(typeof window !== 'undefined' ? window : globalThis);
