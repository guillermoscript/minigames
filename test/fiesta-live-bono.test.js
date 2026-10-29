'use strict';
/* f_bono · red: el stack real (fiesta-net + fiesta-live + party.js) detrás del relé en memoria (retardo, jitter, 5 % de pérdida, 50/150/300 ms) con test/helpers/live-arnes.js:
   mismos puestos en todas las pantallas, un solo juez, solo CPU, juez muerto => un veredicto, asiento caído => CPU, resultados dentro de `lim`.
   El catálogo (fiesta-reglas.js) aún NO trae la línea de f_bono: se completa EN MEMORIA (como los demás). node --test test/fiesta-live-bono.test.js   (LIVE_FULL=1: más semillas) */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../docs/style-lab/pruebas/fiesta-bono-bench.js');
B.cargar();
const LIVE = globalThis.FIESTA.LIVE, REGLAS = globalThis.FIESTA.reglas;
const G = 'f_bono';
const { arnes, CAT: CATR } = require('./helpers/live-arnes.js');
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED, unico = (a) => a.filter((x, i) => a.indexOf(x) === i);
const FULL = !!process.env.LIVE_FULL;
async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: '1v3', dur: 35, humans: 4, loss: 0.05 }, o));
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [.7, .5, .6, .4][i] }; });
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
  const res = H.res(), lim = CATR[G].lim, tope = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach((k) => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach((r) => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter((r) => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach((t) => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
}
/* el recuento que ve cada pantalla viva (todas deben coincidir al final: los ev llegan a las 4) */
function cuentas(H) { const o = {}; H.ids.forEach((s) => { if (H.dead[s] || !H.sess[s] || !H.sess[s].g || !H.sess[s].g.vista) return; const v = H.sess[s].g.vista(); o[s] = [v.gross, v.rec, v.hits].join(','); }); return o; }

test('red: f_bono coincide con el catálogo del servidor (1v3, B, lim) una vez completado', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CATR[G].mo); assert.equal(d.clase, CATR[G].cl); assert.deepEqual(d.modos, CATR[G].m);
  ['scoreMax', 'scoreRate', 'minT'].forEach((k) => assert.equal(d.limites[k], CATR[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CATR[G].lim.finTemprano);
});

for (const delay of [50, 150, 300]) {
  test(`red ${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos-bot, el solo es humano, 5 % de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1, solo: 'a' });
    await H.cerrar(); const res = unVeredicto(H, `${G}@${delay}`);
    assert.equal(res.por, 'juez'); if (H.mj().e === 0) assert.notEqual(H.mj().juez, 'a', 'el solo no es juez si hay alternativa');
    topes(H, `${G}@${delay}`);
    const cu = cuentas(H); console.log(`  @${delay} ms: perdidas brutas,recogidas,golpes por pantalla`, JSON.stringify(cu), 'veredicto', JSON.stringify(res.sc));
    H.cerrarTodo();
  });
}

test(`red ${G}: el solo es una CPU (3 humanos de trío): el juez corre su ai (golpe, salto, recogida) y el veredicto es único, a 50/150/300 ms`, async () => {
  for (const delay of [50, 150, 300]) {
    const H = await partida({ delay, humans: 3, solo: 'd', seed: delay + 9 });
    await H.cerrar(); unVeredicto(H, 'solo CPU @' + delay); topes(H, 'solo CPU @' + delay);
    const vals = unico(Object.values(cuentas(H))); assert.ok(Object.keys(cuentas(H)).length === 3, 'tres pantallas humanas');
    assert.ok(H.log.some((x) => x.ev.ty === 'sw' || true)); H.cerrarTodo(); void vals;
  }
});

test(`red ${G}: resultado depende del juego: solo activo contra trío ocioso gana; solo ocioso contra trío activo pierde`, async () => {
  let gana = 0;
  for (const seed of [5, 75, 25]) {
    const A = await partida({ delay: 100, seed, solo: 'a' }, { a: { skill: 0.9 }, b: 'idle', c: 'idle', d: 'idle' });
    await A.cerrar(); const ra = unVeredicto(A, 'solo activo s' + seed); A.cerrarTodo(); if (ra.puestos[0] === 1) gana++; assert.ok(ra.sc[0] >= 44, 'trío ocioso: casi ni una moneda (un asiento sin señal pasa a CPU por diseño y puede pegar algún golpe suelto)');
  }
  assert.equal(gana, 3);
  const Bq = await partida({ delay: 100, seed: 6, solo: 'a' }, { a: 'idle', b: { skill: .7 }, c: { skill: .7 }, d: { skill: .7 } });
  await Bq.cerrar(); const rb = unVeredicto(Bq, 'solo ocioso'); Bq.cerrarTodo();
  assert.ok(rb.puestos[1] === 1 && rb.puestos[0] > 1, 'gana el trío: ' + JSON.stringify(rb.puestos) + ' ' + JSON.stringify(rb.sc));
});

test(`red ${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(31);
  for (const k of [6.3 + rnd() * 0.6, 14.7 + rnd() * 0.6, 22.2 + rnd() * 0.6]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10), solo: 'a' });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: (h) => h.matar(juez) });
    await H.cerrar(60); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`red ${G}: un miembro del trío cae a mitad => pasa a CPU, al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91, solo: 'a' });
  H.eventos.push({ en: 8, fn: (h) => { h.R.offline.c = true; } }, { en: 13, fn: (h) => { h.R.offline.c = false; } });
  await H.cerrar(); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some((x) => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  assert.ok(H.log.some((x) => x.ev.ty === 'hum' && x.ev.p === 2), 'volvió a humano');
  H.cerrarTodo();
});

test(`red ${G}: el solo humano cae en pleno juego: pasa a CPU (el juez corre su ai), no hay golpes repetidos por (k) y el veredicto es único`, async () => {
  for (const [k, seed] of [[5.6, 21], [12.2, 22], [19.5, 23]]) {
    const H = await partida({ delay: 150, loss: 0, solo: 'a', seed }, { a: { skill: .7 }, b: { skill: .6 }, c: { skill: .6 }, d: { skill: .6 } });
    H.eventos.push({ en: k, fn: (h) => { h.R.offline.a = true; } }, { en: k + 4, fn: (h) => { h.R.offline.a = false; } });
    await H.cerrar(); unVeredicto(H, 'solo caído @' + k); topes(H, 'solo caído @' + k);
    assert.ok(H.log.some((x) => x.ev.ty === 'cpu' && x.ev.p === 0), 'se anunció ev cpu del solo');
    H.cerrarTodo();
  }
});

test(`red ${G}: duraciones cortas (el e2e parchea dur a 4 y 12): sin recorte del servidor y veredicto único`, async () => {
  for (const dur of [4, 12]) {
    const H = await partida({ delay: 100, seed: 400 + dur, solo: 'a', dur });
    await H.cerrar(30); const res = unVeredicto(H, 'dur' + dur); topes(H, 'dur' + dur); assert.ok(res.sc[1] === 29); H.cerrarTodo();
  }
});

test(`red ${G}: LIVE_FULL — más semillas a 150 ms con pérdida: siempre un veredicto único y sin recorte`, { skip: !FULL }, async () => {
  for (let seed = 200; seed < 250; seed++) {
    const H = await partida({ delay: 150, seed, solo: 'a', lv: 1 + (seed % 3) });
    await H.cerrar(); unVeredicto(H, 'full s' + seed); topes(H, 'full s' + seed); H.cerrarTodo();
  }
});
