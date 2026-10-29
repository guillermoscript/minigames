'use strict';
/* LA FIESTA · f_hallacas sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida; arnés test/helpers/live-arnes.js, `tipo:'2v2'`).
   Cubre: mismos puestos a 50/150/300 ms, un solo juez, juez muerto => un solo veredicto, asiento caído => CPU (y vuelve), resultados dentro de lim, presupuesto (<=420 B, tipos reservados).
   El catálogo compartido aún no trae `live:1` ni `lim` para f_hallacas: se PARCHEA EN MEMORIA (cliente y servidor) antes de registrar el juego.
   node --test test/fiesta-live-hallacas.test.js */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const A = require('./helpers/live-arnes.js');
const { arnes, LIVE, CAT, R0 } = A;
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const LIM = { scoreMax: 16, scoreRate: 0.45, minT: 44, finTemprano: 0 };
for (const C of [CAT, REGLAS.CATALOGO.reduce((o, x) => { o[x.g] = x; return o; }, {}), R0.CATALOGO.reduce((o, x) => { o[x.g] = x; return o; }, {})]) { C.f_hallacas.live = 1; C.f_hallacas.lim = Object.assign({}, LIM); }
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-hallacas.js'));
const G = 'f_hallacas', unico = (a) => a.filter((x, i) => a.indexOf(x) === i);
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
/* ───────── sobre el stack real: red 50/150/300 ms, 5 % de pérdida, juez muerto, asiento caído ───────── */
async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: '2v2', dur: 45, humans: 4, loss: 0.05, lv: 1 }, o));
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [0.7, 0.65, 0.6, 0.55][i] }; });
  await H.arrancar();
  return H;
}
function unVeredicto(H, et) {
  const res = H.res(); assert.ok(res, et + ': hay resultado'); assert.equal(H.srv.board.f, 'res');
  const vs = H.veredictos(), vivos = H.ids.filter((s) => !H.dead[s]);
  assert.deepEqual(Object.keys(vs).sort(), vivos.slice().sort(), et + ': todas las pantallas vivas tienen veredicto');
  assert.deepEqual(unico(Object.values(vs).map((v) => v.h)), [res.h], et + ': mismo h');
  assert.deepEqual(unico(Object.values(vs).map((v) => JSON.stringify(v.pl))), [JSON.stringify(res.puestos)], et + ': mismos puestos');
  assert.deepEqual(unico(Object.values(vs).map((v) => JSON.stringify(v.sc))), [JSON.stringify(res.sc)], et + ': mismos puntajes');
  assert.equal(H.mjfin().filter((c) => c.status === 200).length, 1, et + ': un mjfin aceptado');
  const eps = H.jueces().map((j) => j.e); assert.equal(unico(eps).length, eps.length, et + ': un solo juez por época');
  return res;
}
function topes(H, et) {
  const res = H.res(), lim = CAT[G].lim, tope = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach((k) => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach((r) => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter((r) => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach((t) => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
}

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos y puntajes en todas las pantallas a ${delay} ms (4 humanos-bot, 2v2, 5 % de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + (delay === 50 ? 3 : 2) });
    await H.cerrar(80); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`);
    assert.ok(res.sc.every((v) => v > 0), 'los 4 puntúan por la red: ' + JSON.stringify(res.sc)); H.cerrarTodo();
  });
}
test(`${G}: 2 humanos (a+b) contra 2 CPU (c+d) y los tres niveles: veredicto único y topes`, async () => {
  for (const lv of [1, 2, 3]) {
    const H = await partida({ delay: 150, humans: 2, lv, seed: 30 + lv });
    await H.cerrar(80); unVeredicto(H, `${G} lv${lv}`); topes(H, `${G} lv${lv}`); H.cerrarTodo();
  }
});
test(`${G}: masero humano ocioso => su equipo no suma NADA y pierde contra la CPU; el amarrador activo no lo salva`, async () => {
  const H = await partida({ delay: 100, seed: 5, loss: 0 }, { a: 'idle', b: { skill: 0.95 }, c: { skill: 0.6 }, d: { skill: 0.6 } });
  await H.cerrar(80); const res = unVeredicto(H, 'masero ocioso'); H.cerrarTodo();
  assert.deepEqual(res.sc.slice(0, 2), [0, 0]); assert.ok(res.sc[2] + res.sc[3] > 0); assert.equal(res.puestos[0], 2); assert.equal(res.puestos[2], 1);
});
test(`${G}: dos humanos activos (a+b) le ganan a dos ociosos (c+d): la entrada llega por la red`, async () => {
  const H = await partida({ delay: 100, seed: 6, loss: 0 }, { a: { skill: 0.9 }, b: { skill: 0.9 }, c: 'idle', d: 'idle' });
  await H.cerrar(80); const res = unVeredicto(H, 'activos vs ociosos'); H.cerrarTodo();
  assert.ok(res.sc[0] > 0 && res.sc[1] > 0); assert.equal(res.puestos[0], 1); assert.equal(res.puestos[2], 2);
});
test(`${G}: juez muerto a mitad => un solo veredicto y mismo h en las pantallas vivas (2 momentos)`, async () => {
  for (const k of [6.3, 24.7]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: (h) => h.matar(juez) });
    await H.cerrar(90); unVeredicto(H, 'juez muerto @' + k);
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});
test(`${G}: un asiento cae y vuelve => pasa a CPU (ev cpu), al volver recupera el asiento; y uno que no vuelve sigue puntuando como CPU`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 6, fn: (h) => { h.R.offline.c = true; } }, { en: 14, fn: (h) => { h.R.offline.c = false; } });
  await H.cerrar(80); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some((x) => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c'); H.cerrarTodo();
  const K = await partida({ delay: 100, seed: 92, loss: 0 }, { a: { skill: 0.7 }, b: { skill: 0.7 }, c: { skill: 0.7 }, d: { skill: 0.7 } });
  K.eventos.push({ en: 4, fn: (h) => h.matar('d') });          // el amarrador del equipo rojo se va para siempre
  await K.cerrar(90); const res = unVeredicto(K, 'd no vuelve'); topes(K, 'd no vuelve'); K.cerrarTodo();
  assert.ok(res.sc[3] > 0 && res.sc[2] > 0, 'd murió: la CPU lo reemplaza y el equipo sigue sumando ' + JSON.stringify(res.sc));
});
test(`${G}: la ayuda con B viaja por la red (hb en el cuerpo) y no rompe nada: humanos-bot de skill alto la usan`, async () => {
  const H = await partida({ delay: 150, seed: 77, loss: 0.05 }, { a: { skill: 0.8 }, b: { skill: 0.8 }, c: { skill: 0.8 }, d: { skill: 0.8 } });
  await H.cerrar(80); unVeredicto(H, 'ayuda'); topes(H, 'ayuda');
  const hb = H.ids.map((s) => H.sess[s].g.vista().hb).reduce((m, x) => x.map((v, i) => Math.max(v, m[i] || 0)), []); assert.ok(hb.reduce((a, b) => a + b, 0) > 0, 'hubo ayudas: ' + hb); H.cerrarTodo();
});
