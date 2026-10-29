'use strict';
/* LA FIESTA · f_alcabala (1v3, modelo B) sobre el stack real (fiesta-net + fiesta-live + party.js/party_mj.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Arnés: test/helpers/live-arnes.js (`tipo:'1v3'`, `solo:<letra>`). Cubre: mismos puestos en todas las pantallas a 50/150/300 ms, un solo juez, solo CPU (el juez la maneja),
   juez muerto => un solo veredicto, asiento caído => CPU (también el solo), presupuesto/tipos, resultados dentro de `lim`, ociosos contra activos y LIVE.sim.
   NOTA: el catálogo (fiesta-reglas.js CATALOGO) aún no trae `lim` ni `live:1` para f_alcabala (dur 45 → 40): aquí se completan EN MEMORIA con la línea que debe ir al catálogo.
   node --test test/fiesta-live-alcabala.test.js */
process.env.LIVE_DBG = '1';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./helpers/live-arnes.js');
const G = 'f_alcabala';
Object.assign(CAT[G], { dur: 40, live: 1, lim: { scoreMax: 30, scoreRate: 8, minT: 5, finTemprano: 1 } });
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-alcabala.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED, unico = a => a.filter((x, i) => a.indexOf(x) === i);

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, tipo: '1v3', dur: 40, humans: 4, loss: 0.05 }, o));
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
/* los destellos que ve cada pantalla viva: mismo conjunto en todas (el xalto llega a las 4, venga del solo humano o del juez por la CPU) */
function altosPorPantalla(H) {
  const o = {}; H.ids.forEach(s => { if (H.dead[s] || !H.sess[s] || !H.sess[s].g || !H.sess[s].g.vista) return; o[s] = H.sess[s].g.vista().altos.map(t => t.join(',')).join('|'); });
  return o;
}

test('registro: f_alcabala coincide con el catálogo del servidor (1v3, B, lim)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m);
  ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano);
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (4 humanos, el solo es humano, 5% de pérdida)`, async () => {
    const H = await partida({ delay, seed: delay + 1, solo: 'a' });
    await H.cerrar(60); const res = unVeredicto(H, `${G}@${delay}`);
    assert.equal(res.por, 'juez'); if (H.mj().e === 0) assert.notEqual(H.mj().juez, 'a', 'el solo no es juez si hay alternativa');
    topes(H, `${G}@${delay}`); H.cerrarTodo();
  });
}

test(`${G}: el solo es una CPU (3 humanos de trío): el juez corre su ai, los destellos llegan a las 3 pantallas y el veredicto es único`, async () => {
  for (const delay of [50, 150, 300]) {
    const H = await partida({ delay, humans: 3, solo: 'd', seed: delay + 9 });
    await H.cerrar(60); unVeredicto(H, 'solo CPU @' + delay); topes(H, 'solo CPU @' + delay);
    const t = altosPorPantalla(H), vals = unico(Object.values(t));
    assert.equal(Object.keys(t).length, 3, 'tres pantallas humanas'); assert.equal(vals.length, 1, 'mismos destellos en todas: ' + JSON.stringify(t)); H.cerrarTodo();
  }
});

test(`${G}: solo humano activo contra trío ocioso => gana el solo; solo ocioso contra trío activo => gana el trío`, async () => {
  let gana = 0;
  for (const seed of [5, 15, 25, 35]) {
    const A = await partida({ delay: 100, seed, solo: 'a' }, { a: { skill: 1 }, b: 'idle', c: 'idle', d: 'idle' });
    await A.cerrar(60); const ra = unVeredicto(A, 'solo activo s' + seed); A.cerrarTodo();
    if (ra.puestos[0] === 1) gana++;
  }
  assert.ok(gana >= 3, 'el solo activo ganó ' + gana + '/4 contra un trío quieto');
  const B = await partida({ delay: 100, seed: 6, solo: 'a' }, { a: 'idle', b: { skill: .8 }, c: { skill: .8 }, d: { skill: .8 } });
  await B.cerrar(60); const rb = unVeredicto(B, 'solo ocioso'); B.cerrarTodo();
  assert.ok(rb.puestos[1] === 1 && rb.puestos[0] > 1, 'gana el trío: ' + JSON.stringify(rb.puestos) + ' ' + JSON.stringify(rb.sc));
});

test(`${G}: juez muerto a mitad => un solo veredicto, mismo h en las pantallas vivas`, async () => {
  const rnd = mulberry32(31);
  for (const k of [4.3 + rnd() * 0.6, 9.7 + rnd() * 0.6]) {
    const H = await partida({ delay: 100, loss: 0, seed: Math.round(k * 10), solo: 'a' }, { a: { skill: .6 }, b: 'idle', c: 'idle', d: 'idle' });   // el trío quieto: la partida dura todo `dur` y el juez muere a mitad
    const juez = H.mj().juez; H.eventos.push({ en: k, fn: h => h.matar(juez) });
    await H.cerrar(60); unVeredicto(H, 'juez muerto @' + k.toFixed(1));
    assert.ok(H.mj().e >= 1, 'subió la época'); assert.notEqual(H.mj().juez, juez); topes(H, 'juez muerto'); H.cerrarTodo();
  }
});

test(`${G}: un miembro del trío cae a mitad => pasa a CPU y al volver recupera el asiento; veredicto único`, async () => {
  const H = await partida({ delay: 150, seed: 91, solo: 'a' });
  H.eventos.push({ en: 6, fn: h => { h.R.offline.c = true; } }, { en: 11, fn: h => { h.R.offline.c = false; } });
  await H.cerrar(60); unVeredicto(H, 'caída'); topes(H, 'caída');
  assert.ok(H.log.some(x => x.ev.ty === 'cpu' && x.ev.p === 2), 'se anunció ev cpu del asiento c');
  H.cerrarTodo();
});

test(`${G}: el solo humano cae en pleno juego: pasa a CPU, no hay destellos pegados (enfriamiento) y el veredicto es único`, async () => {
  for (const [k, seed] of [[5.6, 21], [9.2, 22], [14.5, 23]]) {
    const H = await partida({ delay: 150, loss: 0, solo: 'a', seed }, { a: { skill: .7 }, b: { skill: .5 }, c: { skill: .5 }, d: { skill: .5 } });
    H.eventos.push({ en: k, fn: h => { h.R.offline.a = true; } }, { en: k + 4, fn: h => { h.R.offline.a = false; } });
    await H.cerrar(60); unVeredicto(H, 'solo caído @' + k); topes(H, 'solo caído @' + k);
    const t = altosPorPantalla(H); delete t.a;                    // la pantalla del solo que se cayó puede conservar un destello propio que soltó SIN enlace (el servidor ya lo tiene por CPU y no lo acepta de vuelta): es solo dibujo, nadie lo juzga
    const vals = unico(Object.values(t));
    assert.equal(vals.length, 1, 'mismos destellos en las pantallas que juzgan: ' + JSON.stringify(t));
    const lista = vals[0] === '' ? [] : vals[0].split('|').map(x => x.split(',').map(Number));
    const cd = (tl) => (tl >= 40 * 0.7 ? 2.5 : tl >= 40 * 0.35 ? 3.2 : 4);   // el enfriamiento baja con la escalada (ESC.CD por fase de la partida, dur 40)
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i][3] - lista[i - 1][3] >= cd(lista[i - 1][3]) - 0.1, `enfriamiento entre destellos ${i - 1}->${i}: ${lista[i][3] - lista[i - 1][3]} s`);
    H.cerrarTodo();
  }
});

test(`${G}: LIVE.sim (create() real, 4 CPU, sin red): dentro de límites, sin recorte, y el solo gana en una banda razonable por nivel`, () => {
  for (const lv of [1, 2, 3]) {
    let w = 0; const N = 40;
    for (let seed = 1; seed <= N; seed++) {
      const r = LIVE.sim(G, { tipo: '1v3', solo: 'a', seed, lv, skill: 0.6 });
      assert.equal(r.tipo, '1v3'); assert.ok(r.fin, 'hubo veredicto'); r.sc.forEach(v => assert.ok(Number.isInteger(v) && v >= 0 && v <= CAT[G].lim.scoreMax));
      const soloI = r.eq.indexOf(0); r.sc.forEach((v, i) => { if (i !== soloI) assert.equal(v, 15, 'trío = 15 fijo'); else assert.equal(v % 10, 0, 'solo = 10 por miembro que no pasó'); });
      assert.equal(r.pl[soloI] === 1, r.sc[soloI] >= 20, 'veredicto = pasaron <=1');
      if (r.ganaLado === 'solo') w++;
    }
    assert.ok(w / N >= 0.2 && w / N <= 0.75, `lv${lv}: el solo gana ${(w / N * 100).toFixed(0)} % en LIVE.sim (banda amplia: el banco de 200 semillas es el estricto)`);
  }
});
