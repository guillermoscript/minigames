'use strict';
/* LA FIESTA · f_cola (FFA rank, modelo A) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js. Cubre: mismos puestos a 50/150/300 ms, un solo juez, juez muerto => un solo veredicto, asiento caído => CPU,
   presupuesto/tipos (solo cuerpos `o`, sin mensajes x*), límites del juego (el catálogo aún no trae `lim` de f_cola: se usan los del def), y que el resultado dependa
   de jugar (activo vs ociosos; ociosos contra CPU).  node --test test/fiesta-live-cola.test.js */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-cola.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_cola', unico = a => a.filter((x, i) => a.indexOf(x) === i), LIM = () => (CAT[G].lim || LIVE.get(G).limites);

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, dur: 20, humans: 4, loss: 0.05, lv: 2 }, o));
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
  const res = H.res(), lim = LIM(), tope = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
  assert.ok(![...H.tipos].some(t => X_RE.test(t)), et + ': f_cola no manda mensajes x*');
}

test('registro: f_cola coincide con el catálogo del servidor (ffa, A, rank)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m);
  if (CAT[G].lim) ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k]));
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1 });
    await H.cerrar(); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`); H.cerrarTodo();
  });
}

for (const humans of [2, 3]) {
  test(`${G}: ${humans} humanos + CPU a 150 ms, los tres niveles`, async () => {
    for (const lv of [1, 2, 3]) {
      const H = await partida({ delay: 150, humans, lv, seed: 20 + lv + humans });
      await H.cerrar(); unVeredicto(H, `${G} x${humans} lv${lv}`); topes(H, `${G} x${humans} lv${lv}`); H.cerrarTodo();
    }
  });
}

test(`${G}: un humano activo le gana a tres ociosos (la entrada llega al juego)`, async () => {
  const H = await partida({ delay: 100, seed: 5, lv: 2 }, { a: { skill: .9 }, b: 'idle', c: 'idle', d: 'idle' });
  await H.cerrar(); const res = unVeredicto(H, 'activo vs ociosos'); H.cerrarTodo();
  assert.ok(res.sc[0] > Math.max(res.sc[1], res.sc[2], res.sc[3]), 'el activo va más lejos: ' + JSON.stringify(res.sc)); assert.equal(res.puestos[0], 1);
  assert.ok(res.sc[0] >= 100, 'el activo llegó o casi: ' + res.sc[0]); // los ociosos pueden pasar a CPU en caliente (humano callado 2 s), por eso no se exige 0
});

test(`${G}: humanos ociosos no ganan a las CPU activas (2 humanos ociosos + 2 CPU)`, async () => {
  const H = await partida({ delay: 150, seed: 33, humans: 2, lv: 2 }, { a: 'idle', b: 'idle' });
  await H.cerrar(); const res = unVeredicto(H, 'ociosos vs CPU'); H.cerrarTodo();
  assert.ok(Math.max(res.sc[0], res.sc[1]) < Math.min(res.sc[2], res.sc[3]), 'las CPU van por delante: ' + JSON.stringify(res.sc));
});

test(`${G}: la llegada y el bono +25 viajan por la red: hay un ganador con 125 y es el que llegó primero`, async () => {
  const H = await partida({ delay: 150, seed: 61, lv: 1 }, { a: { skill: .95 }, b: { skill: .5 }, c: { skill: .5 }, d: { skill: .5 } });
  await H.cerrar(); const res = unVeredicto(H, 'llegada'); H.cerrarTodo();
  assert.equal(res.sc.filter(v => v === 125).length, 1, 'un solo 125: ' + JSON.stringify(res.sc)); assert.equal(res.sc[0], 125); assert.equal(res.puestos[0], 1);
  assert.ok(H.gt() > 4);
});

test(`${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(17);
  for (const k of [3 + rnd() * 5, 7 + rnd() * 5]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(60); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad => pasa a CPU, al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 5, fn: h => { h.R.offline.c = true; } }, { en: 9, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});
