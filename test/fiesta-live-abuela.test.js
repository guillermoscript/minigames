'use strict';
/* LA FIESTA · f_abuela (FFA survival, modelo A) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Arnés: test/helpers/live-arnes.js. Cubre: mismos puestos a 50/150/300 ms, un solo juez, juez muerto => un solo veredicto, asiento caído => CPU, tipos reservados,
   presupuesto, límites, ociosos vs CPU activas, ventaja del juez con bots iguales, y los tres niveles con 2-4 humanos.  node --test test/fiesta-live-abuela.test.js
   NOTA: el catálogo (fiesta-reglas.js CATALOGO) aún no trae `lim` ni `live:1` para f_abuela; aquí se completan EN MEMORIA con los valores que pide el juego
   (los mismos de f_mecate) para poder correr el arnés. El integrador debe copiarlos al catálogo y a LIM_DEFECTO de party_mj.js. */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./helpers/live-arnes.js');
const G = 'f_abuela';
if (!CAT[G].lim) CAT[G].lim = { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 };
if (!CAT[G].live) CAT[G].live = 1;
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-abuela.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED, unico = a => a.filter((x, i) => a.indexOf(x) === i);

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, dur: 30, humans: 4, loss: 0.05, lv: 2 }, o));
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
  assert.ok(!H.tipos.has('xabuela') && ![...H.tipos].some(t => X_RE.test(t)), et + ': el juego no manda mensajes propios (solo cuerpo `o` y ev out)');
}

test('registro: f_abuela coincide con el catálogo del servidor (ffa+1v1, A, survival, dur, lim)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m); assert.equal(d.dur, CAT[G].dur);
  ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano);
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

test(`${G}: duración completa del catálogo (45 s), 4 humanos, 300 ms y 5% de pérdida`, async (t) => {
  const H = await partida({ delay: 300, seed: 71, dur: CAT[G].dur }, { a: { skill: .85 }, b: { skill: .85 }, c: { skill: .85 }, d: { skill: .85 } });
  await H.cerrar(80); const res = unVeredicto(H, 'completa'); topes(H, 'completa'); t.diagnostic(`época final ${H.mj().e}; sc ${res.sc}`); H.cerrarTodo();
});

test(`${G}: un humano activo le gana a tres ociosos (la entrada llega al juego por la red)`, async () => {
  const H = await partida({ delay: 100, seed: 5, lv: 2 }, { a: { skill: .9 }, b: 'idle', c: 'idle', d: 'idle' });
  await H.cerrar(); const res = unVeredicto(H, 'activo vs ociosos'); H.cerrarTodo();
  assert.ok(res.sc[0] > Math.max(res.sc[1], res.sc[2], res.sc[3]), 'el activo aguanta más: ' + JSON.stringify(res.sc)); assert.equal(res.puestos[0], 1);
});

test(`${G}: humanos ociosos nunca ganan a CPU activas (niveles 1-3)`, async () => {
  for (const [seed, nivel] of [[201, 1], [202, 2], [203, 3]]) {
    const H = await partida({ delay: 100, loss: 0, humans: 2, seed, dur: 20, cpuNivel: nivel, lv: nivel }, { a: 'idle', b: 'idle' });
    await H.cerrar(); const res = unVeredicto(H, `ociosos s${seed} n${nivel}`);
    const as = H.mj().as, idle = [as.indexOf('a'), as.indexOf('b')], cpus = [as.indexOf('c'), as.indexOf('d')];
    idle.forEach(i => assert.ok(res.puestos[i] > 1, `s${seed} n${nivel}: el ocioso ${as[i]} no puede ser 1.º (puestos ${res.puestos}, sc ${res.sc})`));
    assert.ok(Math.max.apply(null, idle.map(i => res.sc[i])) <= Math.max.apply(null, cpus.map(i => res.sc[i])), `s${seed} n${nivel}: el mejor ocioso no supera a la mejor CPU`);
    H.cerrarTodo();
  }
});

test(`${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(17);
  for (const k of [3 + rnd() * 8, 10 + rnd() * 8]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(60); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad => pasa a CPU, al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 6, fn: h => { h.R.offline.c = true; } }, { en: 11, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});

test(`${G}: ventaja del juez con bots iguales (red 150 ms, 5% pérdida): su cuota de victorias ≤ 1/n + 8 pp`, async (t) => {
  const N = process.env.LIVE_FULL ? 60 : 16; let cuota = 0, jug = 0;
  for (let seed = 1; seed <= N; seed++) {
    const eq = { skill: .6 }, H = await partida({ delay: 150, seed: 900 + seed, dur: 20, lv: 1 + (seed % 3) }, { a: eq, b: eq, c: eq, d: eq });
    const j0 = H.mj().juez; await H.cerrar(); const res = H.res(), as = H.mj().as, ji = as.indexOf(j0); assert.ok(ji >= 0);
    const top = res.puestos.filter(x => x === 1).length; if (res.puestos[ji] === 1) cuota += 1 / top; jug++; H.cerrarTodo();
  }
  t.diagnostic(`cuota del juez: ${(100 * cuota / jug).toFixed(1)}% en ${jug} partidas (ruido de muestra ±${(100 * Math.sqrt(.25 * .75 / jug)).toFixed(0)} pp)`);
  assert.ok(cuota / jug <= 0.25 + 0.08 + 1.64 * Math.sqrt(.25 * .75 / jug), 'ventaja del juez fuera de rango (con margen de muestreo)');
});

test(`${G}: banco sin red, 200 semillas por nivel: ningún asiento gana más de 1/n + 8 pp (bots iguales)`, () => {
  const B = require('../docs/style-lab/pruebas/fiesta-abuela-bench.js'), DEF = B.cargar();
  for (const lv of [1, 2, 3]) {
    const r = B.medir(DEF, { lv, skill: 0.6, semillas: 200 });
    r.gana.forEach((x, i) => assert.ok(x <= 0.25 + 0.08, `lv${lv} asiento ${i}: ${(x * 100).toFixed(1)}%`));
    assert.ok(r.llegan < 0.6, 'no deben llegar todos al final');
  }
});
