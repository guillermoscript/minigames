'use strict';
/* LA FIESTA · f_cerro (FFA rank, modelo A) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js. Cubre: mismos puestos a 50/150/300 ms, un solo juez, juez muerto => un solo veredicto, asiento caído => CPU,
   presupuesto/tipos (el juego solo usa `o` y ev del runtime), límites del juego (el catálogo aún no lo trae: ver informe), activo vs ociosos y llegada a la platabanda.
   node --test test/fiesta-live-cerro.test.js */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-cerro.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_cerro', DEF = LIVE.get(G), LIM = DEF.limites, unico = a => a.filter((x, i) => a.indexOf(x) === i);

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, dur: DEF.dur, humans: 4, loss: 0.05, lv: 2 }, o));
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
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} > ${tope}`));
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
  H.tipos.forEach(t => assert.ok(!X_RE.test(t), et + ': el juego no manda tipos x* propios: ' + t));
}

test('registro: f_cerro (ffa, A, rank) y límites coherentes con su puntaje', () => {
  assert.ok(DEF); assert.equal(DEF.modelo, 'A'); assert.equal(DEF.clase, 'rank'); assert.deepEqual(DEF.modos, ['ffa']); assert.equal(DEF.dur, 35);
  assert.deepEqual(LIM, { scoreMax: 2100, scoreRate: 150, minT: 8, finTemprano: 1 });
  assert.ok(1000 + DEF.dur * 30 <= LIM.scoreMax, 'el puntaje máximo (llegar en el tick 0) cabe en scoreMax');
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

test(`${G}: un humano activo le gana a tres ociosos (la entrada llega al juego) y los ociosos quedan en 0`, async () => {
  const H = await partida({ delay: 100, seed: 5, lv: 2 }, { a: { skill: .9 }, b: 'idle', c: 'idle', d: 'idle' });
  await H.cerrar(); const res = unVeredicto(H, 'activo vs ociosos'); H.cerrarTodo();
  assert.ok(res.sc[0] > Math.max(res.sc[1], res.sc[2], res.sc[3]), 'el activo sube más: ' + JSON.stringify(res.sc)); assert.equal(res.puestos[0], 1);
  assert.ok(res.sc[0] >= 400, 'el activo sube de verdad: ' + res.sc[0]);
});

test(`${G}: con jugadores buenos alguien llega a la platabanda (sc >= 1000) y el primero en llegar gana`, async () => {
  const H = await partida({ delay: 100, seed: 9, lv: 1, loss: 0 }, { a: { skill: .95 }, b: { skill: .95 }, c: { skill: .95 }, d: { skill: .95 } });
  await H.cerrar(); const res = unVeredicto(H, 'llegada'); H.cerrarTodo();
  const mx = Math.max.apply(null, res.sc); assert.ok(mx >= 1000, 'hubo llegada: ' + JSON.stringify(res.sc));
  res.sc.forEach((v, i) => { if (v === mx) assert.equal(res.puestos[i], 1); });
});

test(`${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(17);
  for (const k of [3 + rnd() * 4, 9 + rnd() * 5]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10) });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(60); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un asiento cae a mitad => pasa a CPU, al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91 });
  H.eventos.push({ en: 5, fn: h => { h.R.offline.c = true; } }, { en: 10, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});

/* mismas plataformas en todas las pantallas (hash del mundo) y fantasmas: lo que ve la pantalla A de B coincide con B (a 1 cuadro de interp.) */
test(`${G}: el mundo (pisos, tendederos, tobos) es idéntico en todas las pantallas`, async () => {
  const H = await partida({ delay: 150, seed: 33, lv: 3 });
  await H.correr(3);
  const hs = unico(H.ids.map(s => H.sess[s].g.vista().layoutHash)); assert.equal(hs.length, 1, 'mismo hash: ' + hs.join(','));
  await H.cerrar(); unVeredicto(H, 'mundo'); H.cerrarTodo();
});

/* los fantasmas: lo que cada pantalla ve de los demás está SOBRE la trayectoria reciente de su dueño (el retraso de interp. 100-250 ms + red es por diseño: no hay contacto) */
test(`${G}: los fantasmas siguen la trayectoria de su dueño en todas las pantallas (150 ms, sin pérdida: con pérdida el relé de juguete congela un carril hasta ~2,5 s por petición perdida): error a la trayectoria de los últimos 0,9 s, mediana < 20 px y p90 < 60 px`, async () => {
  const H = await partida({ delay: 150, seed: 44, lv: 1, loss: 0 }), hist = {}, err = [];
  H.ids.forEach(s => { hist[s] = []; });
  for (let k = 0; k < 120; k++) {
    await H.correr(0.1); const gt = H.gt(); if (gt < 0.5) continue;
    H.ids.forEach((s, i) => { const v = H.sess[s].g.vista(); hist[s].push({ gt, x: v.x[i], y: v.y[i] }); });
    if (gt < 2) continue;
    H.ids.forEach((s, i) => {
      const vs = H.sess[s].g.vista();
      H.ids.forEach((o, j) => { if (j === i) return; err.push(Math.min.apply(null, hist[o].filter(h => gt - h.gt < 0.9).map(h => Math.hypot(vs.x[j] - h.x, vs.y[j] - h.y))));});
    });
  }
  err.sort((a, b) => a - b); assert.ok(err.length > 100, 'muestras ' + err.length);
  assert.ok(err[err.length >> 1] < 20, 'mediana ' + err[err.length >> 1]); assert.ok(err[Math.floor(err.length * 0.9)] < 60, 'p90 ' + err[Math.floor(err.length * 0.9)]);
  await H.cerrar(); unVeredicto(H, 'fantasmas'); H.cerrarTodo();
});
