'use strict';
/* LA FIESTA · f_bolas (FFA, modelo C: el juez simula todas las bolas) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo,
   jitter y 5 % de pérdida). Reutiliza el arnés de fiesta-live.test.js (`tipo:'ffa'`, 4 asientos). Cubre: mismos puestos en todas las pantallas a 50/150/300 ms, un solo juez,
   juez muerto => un solo veredicto (restore del snapshot), asiento caído => CPU y regreso, presupuesto (s ≤420 B, xtiro ≤200 B, lotes ≤512 B), solo tipos propios (xtiro),
   límites, ociosos no ganan (la entrada llega al juez por xtiro) y ventaja del juez con bots iguales ≤ 1/4 + 8 pp.
   node --test test/fiesta-live-bolas.test.js   (LIVE_FULL=1: 67 semillas por retardo en la ventaja del juez) */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-bolas.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_bolas', unico = a => a.filter((x, i) => a.indexOf(x) === i);
const DUR = 35;
/* el catálogo del servidor aún no trae lim de f_bolas (lo registra el líder): mientras tanto se usan los del juego */
const LIM = (CAT[G] && CAT[G].lim) || LIVE.get(G).limites;

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: 'ffa', dur: DUR, humans: 4, loss: 0.05, lv: 1 }, o));
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
  const res = H.res(), tope = Math.floor(Math.min(LIM.scoreMax, LIM.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || t === 'xtiro' || t === 'hb', et + ': tipo ' + t));
}
/* cuántas bolas lanzó cada asiento según el juez final (todas deberían entrar: 3 por asiento) */
function bolasDe(H) {
  const juez = H.mj().juez, v = H.sess[juez] && H.sess[juez].g && H.sess[juez].g.vista();
  return v ? [0, 1, 2, 3].map(p => v.b.slice(p * 3, p * 3 + 3).filter(b => b.act).length) : null;
}

test('registro: f_bolas coincide con el catálogo del servidor (ffa, rank, C)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m);
  if (CAT[G].lim) { ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano); }
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, 5% de pérdida); todas las bolas entran por xtiro`, async () => {
    const H = await partida({ delay, seed: delay + 1, lv: 1 + (delay % 3) });
    await H.cerrar(80); const res = unVeredicto(H, `${G}@${delay}`); assert.equal(res.por, 'juez'); topes(H, `${G}@${delay}`);
    /* con 5 % de pérdida una petición perdida congela el carril ~2,5 s (fiesta-net) y a veces el juez migra: un tiro puede llegar tarde. Se exigen ≥10 de 12 (sin pérdida, 12: abajo) */
    const bl = bolasDe(H); assert.ok(bl.reduce((a, b) => a + b, 0) >= 10, 'bolas que entraron: ' + bl);
    assert.ok(res.sc.reduce((a, b) => a + b, 0) >= 21, 'se repartieron los 3 lanzamientos: ' + res.sc);
    H.cerrarTodo();
  });
}

test(`${G}: sin pérdida a 300 ms entran las 12 bolas (4 humanos por xtiro, el del juez incluido)`, async () => {
  for (const seed of [7, 8]) {
    const H = await partida({ delay: 300, loss: 0, seed, lv: seed % 3 + 1 });
    await H.cerrar(80); unVeredicto(H, 'sin pérdida ' + seed); topes(H, 'sin pérdida');
    assert.deepEqual(bolasDe(H), [3, 3, 3, 3], 'cada humano lanzó sus 3 bolas'); H.cerrarTodo();
  }
});

test(`${G}: 2 humanos contra 2 CPU en los tres niveles: veredicto único y topes`, async () => {
  for (const lv of [1, 2, 3]) {
    const H = await partida({ delay: 150, humans: 2, lv, seed: 30 + lv });
    await H.cerrar(80); unVeredicto(H, `${G} lv${lv}`); topes(H, `${G} lv${lv}`); H.cerrarTodo();
  }
});

test(`${G}: dos humanos activos le ganan a dos ociosos: la entrada llega al juez por xtiro`, async () => {
  const H = await partida({ delay: 100, seed: 5, loss: 0 }, { a: { skill: .8 }, b: { skill: .8 }, c: 'idle', d: 'idle' });
  await H.cerrar(80); const res = unVeredicto(H, 'activos vs ociosos'); H.cerrarTodo();
  assert.deepEqual(res.sc.slice(2), [0, 0], 'los ociosos no tienen bola: ' + JSON.stringify(res.sc)); assert.ok(res.sc[0] + res.sc[1] >= 18);
  assert.ok(res.puestos[2] > 1 && res.puestos[3] > 1);
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

test(`${G}: un asiento cae a mitad => pasa a CPU (y lanza por él), al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 6, fn: h => { h.R.offline.c = true; } }, { en: 16, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(80); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  assert.ok(H.log.some(x => x.ev.ty === 'hum' && x.ev.p === 2), 'y volvió a humano');
  H.cerrarTodo();
});

/* §11.2 #10: con 4 bots iguales (skill .6) el asiento juez FINAL gana ≤ 1/4 + 8 pp (empate en 1.º = reparto). Modo rápido: 8 semillas por retardo (ruido ±9 pp, guarda gruesa ≤ 45 %);
   LIVE_FULL=1: 67 por retardo (201 partidas, §11.2 #10) y la puerta real 33 %. */
test(`${G}: ventaja del juez con bots iguales (5% pérdida): el asiento juez gana ≤ 1/4 + 8 pp`, async (t) => {
  const N = process.env.LIVE_FULL ? 67 : 8; let jw = 0, jug = 0;
  for (const delay of [50, 150, 300]) for (let seed = 1; seed <= N; seed++) {
    const eq = { skill: .6 }, H = await partida({ delay, seed: 1000 + seed, lv: 1 + (seed % 3) }, { a: eq, b: eq, c: eq, d: eq });
    await H.cerrar(80); const res = H.res(), ji = H.mj().as.indexOf(H.mj().juez); assert.ok(res && ji >= 0);
    const p = res.puestos, firsts = p.filter(x => x === 1).length; if (p[ji] === 1) jw += 1 / firsts; jug++; H.cerrarTodo();
  }
  t.diagnostic(`cuota del asiento juez: ${(100 * jw / jug).toFixed(1)}% en ${jug} partidas (azar 25 %, ruido ±${(100 * Math.sqrt(.1875 / jug)).toFixed(0)} pp)`);
  assert.ok(jw / jug <= (process.env.LIVE_FULL ? 0.25 + 0.08 : 0.45), 'ventaja del juez > techo');
});
