'use strict';
/* LA FIESTA · f_vagon (FFA survival, modelo C: el juez simula) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js. Cubre: mismos puestos en todas las pantallas a 50/150/300 ms, un solo juez, juez muerto => un solo veredicto (restore del snapshot),
   asiento caído => CPU, presupuesto (snapshot ≤420 B, xlag ≤200 B), tipos (solo xlag propio), límites, que el resultado dependa del juego (activos contra ociosos),
   el retraso de entrada del juez (xlag) y la VENTAJA DEL JUEZ (08 §11.2 #10: ≤ 1/n + 8 pp con bots iguales; juez FINAL, M4 §2).
   node --test test/fiesta-live-vagon.test.js   (LIVE_FULL=1: más semillas en la ventaja del juez) */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-vagon.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_vagon', unico = a => a.filter((x, i) => a.indexOf(x) === i);
const LIM = () => CAT[G].lim || LIVE.get(G).limites;        // el catálogo aún no trae `lim` (lo registra main): mientras tanto, los del juego

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, dur: 30, humans: 4, loss: 0.05, lv: 1 }, o));
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
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || t === 'xlag' || t === 'hb', et + ': tipo ' + t));
}

test('registro: f_vagon coincide con el catálogo del servidor (ffa, survival, C, lim si ya está)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m); assert.equal(d.dur, CAT[G].dur);
  if (CAT[G].lim) { ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano); }
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1 });
    await H.cerrar(80); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`); H.cerrarTodo();
  });
}

test(`${G}: duración completa (50 s), 4 humanos, 300 ms y 5% de pérdida: veredicto único y topes`, async () => {
  const H = await partida({ delay: 300, seed: 77, dur: 50, lv: 3 });
  await H.cerrar(90); unVeredicto(H, `${G} 50 s`); topes(H, `${G} 50 s`); H.cerrarTodo();
});

test(`${G}: 2 humanos (a+b) contra 2 CPU (c+d) y los tres niveles: veredicto único y topes`, async () => {
  for (const lv of [1, 2, 3]) {
    const H = await partida({ delay: 150, humans: 2, lv, seed: 30 + lv });
    await H.cerrar(80); unVeredicto(H, `${G} lv${lv}`); topes(H, `${G} lv${lv}`); H.cerrarTodo();
  }
});

test(`${G}: dos humanos activos (a+b) contra dos ociosos (c+d): los ociosos no ganan (la entrada llega al juez por la red)`, async () => {
  for (const seed of [5, 6, 7]) {
    const H = await partida({ delay: 100, seed, loss: 0, dur: 50, lv: 1 + (seed % 3) }, { a: { skill: .9 }, b: { skill: .9 }, c: 'idle', d: 'idle' });
    await H.cerrar(90); const res = unVeredicto(H, 'activos vs ociosos ' + seed); H.cerrarTodo();
    /* con tubos y pasajeros un ocioso puede quedar a salvo y empatar 1.º con los activos si nadie lo saca; lo que no puede pasar es que gane ÉL y no ellos */
    assert.ok(!((res.puestos[2] === 1 || res.puestos[3] === 1) && res.puestos[0] > 1 && res.puestos[1] > 1), 'los ociosos no ganan solos: ' + JSON.stringify(res.puestos) + ' sc ' + JSON.stringify(res.sc));
  }
});

test(`${G}: juez muerto a mitad => un solo veredicto, restore del snapshot y mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(23);
  for (const k of [4 + rnd() * 10, 14 + rnd() * 10]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(90); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad => pasa a CPU, al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 6, fn: h => { h.R.offline.c = true; } }, { en: 12, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(80); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});

test(`${G}: los rivales le informan su retraso de vista al juez (xlag) y el juez retrasa SOLO su propia entrada (y la predice en su pantalla)`, async () => {
  const H = await partida({ delay: 150, seed: 12, loss: 0, dur: 20 });
  await H.correr(10);
  const jid = H.mj().juez, v = H.sess[jid].g.vista();
  assert.ok(v.fj >= 6 && v.fj <= 24, 'retraso del juez en ticks: ' + v.fj);
  H.ids.filter(s => s !== jid).forEach(s => { const o = H.sess[s].g.vista(); assert.ok(o.lag > 0.2 && o.lag < 1, s + ': lag ' + o.lag); assert.equal(o.fj, 0, 'un no-juez no se retrasa'); });
  assert.ok(H.sigLog.some(r => r.types.indexOf('xlag') >= 0), 'viajó xlag');
  await H.cerrar(60); unVeredicto(H, 'xlag'); topes(H, 'xlag'); H.cerrarTodo();
});

/* Ventaja del juez (08 §11.2 #10) con 4 bots iguales (skill .6), 5 % de pérdida, juez FINAL (el provisional del arranque migra, M4 §2). Cuota = 1/(empatados en 1.º) si el
   juez es 1.º. Rápido: 16 semillas por retardo (48 partidas, σ ≈ 6 pp: se tolera 1,64 σ); LIVE_FULL: 60 por retardo. Banco de 200 por celda: fiesta-vagon-bench.js --red. */
test(`${G}: ventaja del juez con bots iguales (50/150/300 ms, 5% pérdida): su cuota ≤ 1/n + 8 pp`, async (t) => {
  const N = process.env.LIVE_FULL ? 60 : 16; let cuota = 0, jug = 0; const porD = {};
  for (const delay of [50, 150, 300]) {
    let cd = 0, nd = 0;
    for (let seed = 1; seed <= N; seed++) {
      const eq = { skill: .6 }, H = await partida({ delay, seed: 2000 + seed, dur: 50, lv: 1 + (seed % 3) }, { a: eq, b: eq, c: eq, d: eq });
      await H.cerrar(90); const res = H.res(), ji = H.mj().as.indexOf(H.mj().juez); assert.ok(res && ji >= 0);
      const top = res.puestos.filter(x => x === 1).length, c1 = res.puestos[ji] === 1 ? 1 / top : 0; cuota += c1; cd += c1; jug++; nd++; H.cerrarTodo();
    }
    porD[delay] = (100 * cd / nd).toFixed(1) + '%';
  }
  t.diagnostic(`cuota del juez: ${(100 * cuota / jug).toFixed(1)}% en ${jug} partidas (por retardo ${JSON.stringify(porD)}; ruido ±${(100 * Math.sqrt(.25 * .75 / jug)).toFixed(0)} pp)`);
  assert.ok(cuota / jug <= 0.25 + 0.08 + 1.64 * Math.sqrt(.25 * .75 / jug), 'ventaja del juez fuera de rango (con margen de muestreo)');
});
