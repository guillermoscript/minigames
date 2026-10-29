'use strict';
/* LA FIESTA · f_patilla (1v3, modelo B) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js (opción nueva `tipo:'1v3'`, `solo:<letra>`). Cubre: mismos puestos en todas las pantallas a 50/150/300 ms,
   un solo juez, juez muerto => un solo veredicto, asiento caído => CPU, presupuesto/tipos, límites del catálogo y que el resultado dependa del juego
   (solo activo vs trío ocioso gana el solo; solo ocioso pierde). node --test test/fiesta-live-patilla.test.js */
process.env.LIVE_DBG = '1';                       // el archivo del arnés solo exporta (no corre sus propias pruebas)
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-patilla.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED;
const G = 'f_patilla', unico = a => a.filter((x, i) => a.indexOf(x) === i);

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: '1v3', dur: 35, humans: 4, loss: 0.05 }, o));
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
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v}`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
}

test('registro: f_patilla coincide con el catálogo del servidor (1v3, B, lim)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m);
  ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano);
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, el solo es humano, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1, solo: 'a' });
    await H.cerrar(); const res = unVeredicto(H, `${G}@${delay}`);
    assert.equal(res.por, 'juez'); if (H.mj().e === 0) assert.notEqual(H.mj().juez, 'a', 'el solo no es juez si hay alternativa');   // (con pérdida puede haber una migración espuria)
    topes(H, `${G}@${delay}`); H.cerrarTodo();
  });
}

test(`${G}: el solo es una CPU (3 humanos de trío): el juez corre su ai y el veredicto es único`, async () => {
  const H = await partida({ delay: 150, humans: 3, solo: 'd', seed: 77 });
  await H.cerrar(); unVeredicto(H, 'solo CPU'); topes(H, 'solo CPU'); H.cerrarTodo();
});

test(`${G}: solo humano activo contra trío ocioso => gana el solo; solo ocioso => gana el trío`, async () => {
  /* un solo bueno contra un trío QUIETO conecta bastante (la CPU apunta con error: no siempre llega a 3): 6 semillas, >=2 victorias y >=2 golpes de media */
  let gana = 0, golpes = 0;
  for (const seed of [5, 15, 25, 35, 45, 55]) {
    const A = await partida({ delay: 100, seed, solo: 'a' }, { a: { skill: 1 }, b: 'idle', c: 'idle', d: 'idle' });
    await A.cerrar(); const ra = unVeredicto(A, 'solo activo s' + seed); A.cerrarTodo();
    golpes += ra.sc[0] / 10; if (ra.sc[0] >= 30) { gana++; assert.equal(ra.puestos[0], 1); }
  }
  assert.ok(gana >= 2 && golpes >= 12, 'el solo activo ganó ' + gana + '/6 con ' + golpes + ' golpes contra un trío quieto');
  const B = await partida({ delay: 100, seed: 6, solo: 'a' }, { a: 'idle', b: { skill: .8 }, c: { skill: .8 }, d: { skill: .8 } });
  await B.cerrar(); const rb = unVeredicto(B, 'solo ocioso'); B.cerrarTodo();
  /* el solo quieto se marca caído y la CPU lo toma a ratos (alCpu le da GRACIA_CPU cada vez): puede colar algún golpe, nunca 3 */
  assert.ok(rb.sc[0] < 30, 'solo ocioso: ' + rb.sc[0]); assert.ok(rb.puestos[1] === 1 && rb.puestos[0] > 1, 'gana el trío: ' + JSON.stringify(rb.puestos));
});

test(`${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(31);
  /* a mitad de partida, con bombas en el aire (un tiro cada ~2,6 s desde ~3 s) */
  for (const k of [4.3 + rnd() * 0.6, 10.7 + rnd() * 0.6]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10), solo: 'a' });
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(60); const res = unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo(); void res;
  }
});

test(`${G}: un miembro del trío cae a mitad => pasa a CPU y al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91, solo: 'a' });
  H.eventos.push({ en: 8, fn: h => { h.R.offline.c = true; } }, { en: 12, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});

/* los tiros que ve cada pantalla viva: mismo conjunto en todas (el xtiro llega a las 4, venga del solo humano o del juez por la CPU) */
function tirosPorPantalla(H) {
  const o = {}; H.ids.forEach(s => { if (H.dead[s] || !H.sess[s] || !H.sess[s].g || !H.sess[s].g.vista) return; o[s] = H.sess[s].g.vista().tiros.map(t => t.join(',')).join('|'); });
  return o;
}

test(`${G}: solo CPU (el juez la maneja): los tiros llegan a las pantallas de los 3 humanos, a 50/150/300 ms`, async () => {
  for (const delay of [50, 150, 300]) {
    const H = await partida({ delay, humans: 3, solo: 'd', seed: delay + 9, loss: 0.05 });
    await H.cerrar(); unVeredicto(H, 'solo CPU @' + delay); topes(H, 'solo CPU @' + delay);
    const t = tirosPorPantalla(H), vals = unico(Object.values(t));
    assert.equal(Object.keys(t).length, 3, 'tres pantallas humanas'); assert.equal(vals.length, 1, 'mismos tiros en todas: ' + JSON.stringify(t));
    assert.ok(vals[0].split('|').length >= 1 && vals[0] !== '', 'la CPU soltó al menos un tiro'); H.cerrarTodo();
  }
});

test(`${G}: el solo humano cae en pleno juego: pasa a CPU, no hay más de nShots tiros ni tiros pegados (enfriamiento) y el veredicto es único`, async () => {
  for (const [k, seed] of [[5.6, 21], [9.2, 22], [12.5, 23]]) {
    const H = await partida({ delay: 150, loss: 0, solo: 'a', seed }, { a: { skill: .7 }, b: { skill: .6 }, c: { skill: .6 }, d: { skill: .6 } });
    H.eventos.push({ en: k, fn: h => { h.R.offline.a = true; } }, { en: k + 4, fn: h => { h.R.offline.a = false; } });
    await H.cerrar(); unVeredicto(H, 'solo caído @' + k); topes(H, 'solo caído @' + k);
    const t = tirosPorPantalla(H), vals = unico(Object.values(t));
    assert.equal(vals.length, 1, 'mismos tiros en todas las pantallas: ' + JSON.stringify(t));
    const lista = vals[0] === '' ? [] : vals[0].split('|').map(x => x.split(',').map(Number));
    const vi = H.sess[H.ids.find(s => !H.dead[s] && H.sess[s] && H.sess[s].g)].g.vista();
    assert.ok(lista.length <= vi.nShots, 'a lo sumo nShots tiros');
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i][3] - lista[i - 1][3] >= vi.cd + 0.25, `enfriamiento entre tiros ${i - 1}->${i}: ${lista[i][3] - lista[i - 1][3]} s`);
    H.cerrarTodo();
  }
});

test(`${G}: LIVE.sim (create() real, 4 CPU, sin red): dentro de límites, sin recorte, y el solo gana en una banda razonable por nivel`, () => {
  for (const lv of [1, 2, 3]) {
    let w = 0; const N = 40;
    for (let seed = 1; seed <= N; seed++) {
      const r = LIVE.sim(G, { tipo: '1v3', solo: 'a', seed, lv, skill: 0.6 });
      assert.equal(r.tipo, '1v3'); assert.ok(r.fin, 'hubo veredicto'); r.sc.forEach(v => assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT[G].lim.scoreMax));
      const soloI = r.eq.indexOf(0); r.sc.forEach((v, i) => { if (i !== soloI) assert.equal(v, 25, 'trío = 25 fijo'); else assert.equal(v % 10, 0, 'solo = 10 por golpe'); });
      assert.equal(r.pl[soloI] === 1, r.sc[soloI] >= 30, 'veredicto = golpes>=3');
      if (r.ganaLado === 'solo') w++;
    }
    assert.ok(w / N >= 0.2 && w / N <= 0.7, `lv${lv}: el solo gana ${(w / N * 100).toFixed(0)} % en LIVE.sim (banda amplia: el banco de 200 semillas es el estricto)`);
  }
});
