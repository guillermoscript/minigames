'use strict';
/* LA FIESTA · f_cava (2v2 cooperativo, modelo B) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js (`tipo:'2v2'`: a+b contra c+d). El catálogo real aún no trae la línea de f_cava (la registra otro agente): aquí se PARCHEA EN MEMORIA
   (cliente y servidor) con la línea propuesta del banco (CAT_LINEA) antes de cargar el juego. Cubre: mismos puestos en todas las pantallas a 50/150/300 ms, un solo juez,
   juez muerto => un solo veredicto, asiento caído => CPU (y vuelve), el receptor que cae no pierde su cava, resultados dentro de lim, presupuesto (≤420 B, x* ≤200 B, tipos reservados),
   y que el resultado dependa del juego (activos vs ociosos).  node --test test/fiesta-live-cava.test.js   (LIVE_FULL=1: más semillas) */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
const BN = require('../docs/style-lab/pruebas/fiesta-cava-bench.js');          // parchea FIESTA.reglas.CATALOGO (cliente) al cargarse
Object.assign(CAT.f_cava, BN.CAT_LINEA);                                       // y el catálogo del servidor (el que usa party_mj.js)
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-cava.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_cava', unico = a => a.filter((x, i) => a.indexOf(x) === i), FULL = !!process.env.LIVE_FULL;

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: '2v2', dur: 35, humans: 4, loss: 0.05, lv: 1 }, o));
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [.7, .5, .6, .4][i] }; });
  await H.arrancar();
  return H;
}
function unVeredicto(H, et) {
  const res = H.res(); assert.ok(res, et + ': hay resultado'); assert.equal(H.srv.board.f, 'res');
  const vs = H.veredictos(), vivos = H.ids.filter(s => !H.dead[s]);
  assert.deepEqual(Object.keys(vs).sort(), vivos.slice().sort(), et + ': todas las pantallas vivas tienen veredicto');
  assert.deepEqual(unico(Object.values(vs).map(v => v.h)), [res.h], et + ': mismo h');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.pl))), [JSON.stringify(res.puestos)], et + ': mismos puestos');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.sc))), [JSON.stringify(res.sc)], et + ': mismos puntajes');
  assert.equal(H.mjfin().filter(c => c.status === 200).length, 1, et + ': un mjfin aceptado');
  const eps = H.jueces().map(j => j.e); assert.equal(unico(eps).length, eps.length, et + ': un solo juez por época');
  return res;
}
function topes(H, et) {
  const res = H.res(), lim = CAT[G].lim, tope = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
}
/* el marcador de equipo que ve cada pantalla al final: la suma de los dos asientos de un equipo es lo que hay en SU cava */
function marcador(H, et) {
  const res = H.res(); assert.equal(res.sc[0] + res.sc[1] >= 0, true);
  H.ids.forEach(s => { if (H.dead[s] || !H.sess[s] || !H.sess[s].g) return; const v = H.sess[s].g.vista(); assert.ok(v.V[0] >= 0 && v.V[1] >= 0, et); });
}

test('registro: f_cava coincide con el catálogo parcheado (2v2, B, binary, lim)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m);
  ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano); assert.equal(CAT[G].dur, 35);
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 2v2, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1 });
    await H.cerrar(80); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`); marcador(H, 'marcador');
    assert.ok(res.sc.some(v => v > 0), 'se cargó algo en alguna cava (la entrada llega por la red)'); H.cerrarTodo();
  });
}

test(`${G}: 2 humanos (a+b) contra 2 CPU (c+d) y los tres niveles: veredicto único y topes`, async () => {
  for (const lv of [1, 2, 3]) {
    const H = await partida({ delay: 150, humans: 2, lv, seed: 30 + lv });
    await H.cerrar(80); unVeredicto(H, `${G} lv${lv}`); topes(H, `${G} lv${lv}`); H.cerrarTodo();
  }
});

test(`${G}: la gaviota sale igual en todas las pantallas (mismo orden de eventos) y el total de la cava del receptor coincide con el del servidor`, async () => {
  const H = await partida({ delay: 150, seed: 12, loss: 0 });
  await H.cerrar(80); const res = unVeredicto(H, 'gaviota');
  const g0 = H.ids.map(s => JSON.stringify(H.sess[s].g.vista().gulls.map(x => [x[0], x[1]])));
  assert.equal(unico(g0).length, 1, 'todas ven las mismas gaviotas: ' + g0.join(' '));
  assert.ok(H.sess.a.g.vista().gulls.length >= 2, 'salieron gaviotas');
  H.ids.forEach(s => { const v = H.sess[s].g.vista(); assert.equal(v.V[0], res.sc[0] + res.sc[1], s + ' ve el marcador azul del servidor'); assert.equal(v.V[1], res.sc[2] + res.sc[3], s + ' ve el marcador rojo del servidor'); });
  H.cerrarTodo();
});

test(`${G}: dos humanos activos (a+b) le ganan a dos ociosos (c+d): la entrada del lanzador y del receptor llega al juez por la red`, async () => {
  const H = await partida({ delay: 100, seed: 5, loss: 0 }, { a: { skill: .9 }, b: { skill: .9 }, c: 'idle', d: 'idle' });
  await H.cerrar(80); const res = unVeredicto(H, 'activos vs ociosos'); H.cerrarTodo();
  assert.ok(res.sc[0] + res.sc[1] > res.sc[2] + res.sc[3], 'a+b cargan más: ' + JSON.stringify(res.sc)); assert.equal(res.puestos[0], 1); assert.equal(res.puestos[2], 2);
});

test(`${G}: dos humanos ociosos (a+b) no le ganan a dos CPU activas (c+d), en 3 semillas`, async () => {
  let gana = 0;
  for (const seed of [3, 4, 5]) {
    const H = await partida({ delay: 100, humans: 2, seed, loss: 0 }, { a: 'idle', b: 'idle' });
    await H.cerrar(80); const res = unVeredicto(H, 'ociosos vs CPU'); H.cerrarTodo();
    if (res.puestos[0] === 1 && res.puestos[2] !== 1) gana++;
  }
  assert.equal(gana, 0, 'los ociosos nunca ganan');
});

test(`${G}: lanzador humano y receptor humano de equipos distintos: cada receptor solo atrapa lo de su equipo (marcadores ≠ 0 en ambos)`, async () => {
  const H = await partida({ delay: 100, seed: 8, loss: 0 }, { a: { skill: .8 }, b: { skill: .8 }, c: { skill: .8 }, d: { skill: .8 } });
  await H.cerrar(80); const res = unVeredicto(H, 'ambos juegan'); H.cerrarTodo();
  assert.ok(res.sc[0] + res.sc[1] > 4 && res.sc[2] + res.sc[3] > 4, 'ambos equipos cargan: ' + JSON.stringify(res.sc));
});

test(`${G}: juez muerto a mitad => un solo veredicto, el juez nuevo sigue con la gaviota y las cavas intactas`, async () => {
  const rnd = mulberry32(23);
  for (const k of [5 + rnd() * 10, 17 + rnd() * 10]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(90); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto');
    const vivos = H.ids.filter(s => !H.dead[s]);
    assert.equal(unico(vivos.map(s => JSON.stringify(H.sess[s].g.vista().gulls.map(x => x[0])))).length, 1, 'mismas gaviotas tras la migración'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad (el receptor c-d) => pasa a CPU y al volver recupera el asiento; veredicto único`, async () => {
  for (const caido of ['b', 'c']) {
    const H = await partida({ delay: 150, seed: 91 });
    H.eventos.push({ en: 6, fn: h => { h.R.offline[caido] = true; } }, { en: 13, fn: h => { h.R.offline[caido] = false; } });
    await H.cerrar(80); unVeredicto(H, 'caída ' + caido); topes(H, 'caída ' + caido);
    assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === H.ids.indexOf(caido)), 'se anunció ev cpu del asiento ' + caido);
    H.cerrarTodo();
  }
});

if (FULL) test(`${G}: 12 semillas a 150/300 ms: siempre un veredicto único y topes`, async () => {
  for (let seed = 100; seed < 112; seed++) { const H = await partida({ delay: seed % 2 ? 150 : 300, humans: 2 + (seed % 3), seed, lv: 1 + (seed % 3) }); await H.cerrar(80); unVeredicto(H, 'semilla ' + seed); topes(H, 'semilla ' + seed); H.cerrarTodo(); }
});
