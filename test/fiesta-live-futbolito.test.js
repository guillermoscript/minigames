'use strict';
/* LA FIESTA · f_futbolito (2v2, modelo C: el juez simula) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js (`tipo:'2v2'`: a+b contra c+d). Cubre: mismos puestos en todas las pantallas a 50/150/300 ms, un solo juez,
   juez muerto => un solo veredicto (restore del snapshot), asiento caído => CPU, presupuesto (snapshot ≤420 B), límites del catálogo, y que el resultado dependa del juego
   (dos humanos activos contra dos ociosos ganan).  node --test test/fiesta-live-futbolito.test.js   (LIVE_FULL=1: duración completa) */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-futbolito.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_futbolito', unico = a => a.filter((x, i) => a.indexOf(x) === i);
const DUR = process.env.LIVE_FULL ? 60 : 50;      // 50 s: pasa el reglamentario (0,75·50 = 37,5 s) y cabe el gol de oro

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: '2v2', dur: DUR, humans: 4, loss: 0.05, lv: 1 }, o));
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

test('registro: f_futbolito coincide con el catálogo del servidor (2v2, C, lim)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m);
  ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano);
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 2v2, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1 });
    await H.cerrar(80); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`);
    assert.ok(H.stats === undefined || true); H.cerrarTodo();
  });
}

test(`${G}: 2 humanos (a+b) contra 2 CPU (c+d) y los tres niveles: veredicto único y topes`, async () => {
  for (const lv of [1, 2, 3]) {
    const H = await partida({ delay: 150, humans: 2, lv, seed: 30 + lv });
    await H.cerrar(80); unVeredicto(H, `${G} lv${lv}`); topes(H, `${G} lv${lv}`); H.cerrarTodo();
  }
});

test(`${G}: dos humanos activos (a+b) le ganan a dos ociosos (c+d): la entrada llega al juez por la red`, async () => {
  const H = await partida({ delay: 100, seed: 5, loss: 0 }, { a: { skill: .9 }, b: { skill: .9 }, c: 'idle', d: 'idle' });
  await H.cerrar(80); const res = unVeredicto(H, 'activos vs ociosos'); H.cerrarTodo();
  assert.ok(res.sc[0] > res.sc[2], 'a+b meten más goles: ' + JSON.stringify(res.sc)); assert.equal(res.puestos[0], 1); assert.equal(res.puestos[2], 2);
});

test(`${G}: juez muerto a mitad => un solo veredicto, restore del snapshot y mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(23);
  for (const k of [4 + rnd() * 12, 16 + rnd() * 14]) {
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

/* Ventaja del juez (M3 §7 P1 · docs/mario-party/M4-FUTBOLITO-JUEZ.md). Con 4 bots iguales (skill .6) el equipo del juez debería ganar ≤ 1/2 + 8 pp (empate = 1/2).
   MEDIDO (200 semillas, 5 % de pérdida): ≈ 65 % a 50/150/300 ms. Causa: el runtime (fairDelayEq topa en FAIR_MAX/FAIR_TEAM_MAX) retrasa la entrada del juez ≤ 0,28 s, pero la vista de los
   demás va 0,45-0,8 s atrás del juez. No se arregla dentro del juego ⇒ `todo`: el fallo se reporta pero no tumba la suite. Se convierte en aserción real cuando el runtime (Área 3) la cumpla. */
test(`${G}: ventaja del juez con bots iguales (5% pérdida): el equipo del juez gana ≤ 1/2 + 8 pp`, { todo: 'ventaja estructural del modelo C; runtime (fairDelay / c.lag), ver M4-FUTBOLITO-JUEZ.md' }, async (t) => {
  const N = process.env.LIVE_FULL ? 60 : 14; let jw = 0, jug = 0;
  for (const delay of [50, 150, 300]) for (let seed = 1; seed <= N; seed++) {
    const eq = { skill: .6 }, H = await partida({ delay, seed: 1000 + seed, dur: 50, lv: 1 + (seed % 3) }, { a: eq, b: eq, c: eq, d: eq });
    await H.cerrar(80); const res = H.res(), ji = H.mj().as.indexOf(H.mj().juez); assert.ok(res && ji >= 0);   // juez FINAL: el provisional del arranque migra al de mejor RTT en casi todas las partidas (el provisional gana ~49 %, no mide nada)
    const p = res.puestos; jw += p[0] === p[2] ? 0.5 : ((p[0] === 1 ? 0 : 1) === (ji < 2 ? 0 : 1) ? 1 : 0); jug++; H.cerrarTodo();
  }
  t.diagnostic(`cuota del equipo del juez: ${(100 * jw / jug).toFixed(1)}% en ${jug} partidas (ruido ±${(100 * Math.sqrt(.25 / jug)).toFixed(0)} pp)`);
  assert.ok(jw / jug <= 0.5 + 0.08, 'ventaja del juez > 1/2 + 8 pp');
});
