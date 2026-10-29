'use strict';
/* LA FIESTA · f_tequeno (¡TEQUEÑOS!, FFA, modelo A) sobre el stack real (fiesta-net + fiesta-live + party.js detrás de memRelay con retardo, jitter y 5 % de pérdida).
   Reutiliza el arnés de fiesta-live.test.js. Cubre: mismos puestos en todas las pantallas a 50/150/300 ms, un solo juez, juez muerto => un solo veredicto,
   asiento caído => CPU y de vuelta, tipos reservados, presupuesto de bytes/mensajes, resultado dentro de límites, ociosos no ganan a CPU activas, activo > ocioso.
   El catálogo del servidor (fiesta-reglas.js CATALOGO) aún trae f_tequeno con dur 40 y sin `lim`/`live`: esta prueba lo completa EN MEMORIA con lo que
   pide el juego (dur 30, lim {300,10,27,0}); el integrador debe copiar esos valores al catálogo (ver informe). node --test test/fiesta-live-tequeno.test.js */
process.env.LIVE_DBG = '1';                       // el archivo del arnés solo exporta (no corre sus propias pruebas)
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const { arnes, LIVE, CAT } = require('./fiesta-live.test.js');
require(path.join(__dirname, '../docs/style-lab/fiesta-juego-tequeno.js'));
const { mulberry32 } = require('./helpers/mem-relay.js');
const G = 'f_tequeno', X_RE = /^x[a-z0-9]{1,11}$/, RESERVED = LIVE.RESERVED, unico = a => a.filter((x, i) => a.indexOf(x) === i);
const PIDE = { dur: 30, live: 1, lim: { scoreMax: 300, scoreRate: 10, minT: 27, finTemprano: 0 } };
if (!CAT[G].lim) Object.assign(CAT[G], PIDE);       // el servidor (party.js) lee la MISMA entrada del catálogo

async function partida(o, bots) {
  const H = await arnes(Object.assign({ game: G, dur: 30, humans: 4, loss: 0.05 }, o));
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [.7, .5, .6, .4][i] }; });
  await H.arrancar();
  return H;
}
function unVeredicto(H, et, op) {
  op = op || {};
  const res = H.res(); assert.ok(res, et + ': hay resultado'); assert.equal(H.srv.board.f, 'res');
  const vs = H.veredictos(), vivos = H.ids.filter(s => !H.dead[s]);
  assert.deepEqual(Object.keys(vs).sort(), vivos.slice().sort(), et + ': todas las pantallas vivas tienen veredicto');
  assert.deepEqual(unico(Object.values(vs).map(v => v.h)), [res.h], et + ': mismo h');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.pl))), [JSON.stringify(res.puestos)], et + ': mismos puestos');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.sc))), [JSON.stringify(res.sc)], et + ': mismos puntajes');
  const aceptados = H.mjfin().filter(c => c.status === 200).length;
  if (op.testigo && res.por === 'testigo') assert.equal(aceptados, 0, et + ': cierre por testigos => ningún mjfin aceptado'); else assert.equal(aceptados, 1, et + ': un mjfin aceptado');
  const eps = H.jueces().map(j => j.e); assert.equal(unico(eps).length, eps.length, et + ': un solo juez por época');
  return res;
}
function topes(H, et) {
  const res = H.res(), lim = CAT[G].lim, tope = Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (H.o.dur + 1.5)));
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${et}: sc[${i}]=${v} (tope ${tope})`)); assert.equal(res.aj, false, et + ': sin recorte del servidor');
  const rps = H.reqPorSeg(); Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${et}: ${k} ${rps[k]} req/s`); }); assert.ok(rps.sala <= 45, et + ': sala ' + rps.sala);
  H.sigLog.forEach(r => { assert.ok(r.n <= 10 && r.bytes <= 512, et + ': lote ' + r.n + '/' + r.bytes); r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), et + ': ' + r.types[j] + ' ' + l + ' B')); });
  assert.deepEqual(H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt), [], et + ': sin rechazos del relé');
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t) || t === 'hb', et + ': tipo ' + t));
  return rps;
}

test('registro: f_tequeno coincide con el catálogo (modelo A, rank, ffa, lim)', () => {
  const d = LIVE.get(G); assert.ok(d); assert.equal(d.modelo, CAT[G].mo); assert.equal(d.clase, CAT[G].cl); assert.deepEqual(d.modos, CAT[G].m); assert.equal(d.dur, CAT[G].dur);
  ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[G].lim[k])); assert.equal(!!d.limites.finTemprano, !!CAT[G].lim.finTemprano);
});

test(`${G}: red limpia: un juez, época 0, «¡YA!» con <100 ms de diferencia, sin CAS`, async () => {
  const H = await partida({ delay: 100, loss: 0, humans: 3, seed: 11 });
  const juez = H.mj().juez; await H.cerrar(); unVeredicto(H, 'limpia');
  assert.equal(H.mj().e, 0); assert.equal(H.mj().juez, juez); assert.deepEqual(H.ids.filter(s => H.sess[s].esJuez()), [juez]);
  const go = Object.values(H.goAt); assert.equal(go.length, 3); assert.ok(Math.max.apply(null, go) - Math.min.apply(null, go) <= 100, JSON.stringify(H.goAt));
  topes(H, 'limpia'); H.cerrarTodo();
});

for (const delay of [50, 150, 300]) {
  test(`${G}: mismos puestos en todas las pantallas a ${delay} ms (5% de pérdida, 3 humanos + 1 CPU)`, async (t) => {
    const H = await partida({ delay, humans: 3, seed: delay + 3 });
    await H.cerrar(); const res = unVeredicto(H, `@${delay}`); assert.equal(res.por, 'juez');
    const rps = topes(H, `@${delay}`); t.diagnostic(`sc ${res.sc} puestos ${res.puestos} req/s ${JSON.stringify(rps)}`); H.cerrarTodo();
  });
}
for (const humans of [2, 4]) {
  test(`${G}: ${humans} humanos${humans < 4 ? ' + CPU' : ''} a 150 ms con 5% de pérdida`, async () => {
    const H = await partida({ delay: 150, humans, seed: 40 + humans }); await H.cerrar(); unVeredicto(H, 'x' + humans); topes(H, 'x' + humans); H.cerrarTodo();
  });
}
for (const lv of [1, 2, 3]) {
  test(`${G}: nivel ${lv} completo a 150 ms: veredicto único y dentro de límites`, async () => {
    const H = await partida({ delay: 150, humans: 3, seed: 500 + lv, lv }); await H.cerrar(); unVeredicto(H, 'lv' + lv); topes(H, 'lv' + lv); H.cerrarTodo();
  });
}

/* juez muerto en un instante aleatorio (el juego empieza a puntuar desde ~1 s y no acaba antes de dur) */
{
  const rnd = mulberry32(5), instantes = [3 + rnd() * 8, 3 + rnd() * 8, 20 + rnd() * 4].map(x => Math.round(x * 100) / 100); instantes.push(28.4);
  for (const k of instantes) {
    test(`${G}: red limpia, el juez muere a gt=${k} s => migra una vez, un solo veredicto`, async () => {
      const H = await partida({ delay: 100, loss: 0, humans: 3, seed: Math.round(k * 10) });
      const sucesor = H.mj().suc[0]; let viejo = null;
      H.eventos.push({ en: k, fn: h => { viejo = h.mj().juez; h.matar(viejo); } });
      await H.cerrar(60); const res = unVeredicto(H, `juez muerto@${k}`);
      assert.ok(viejo && H.dead[viejo]); assert.equal(H.mj().e, 1); assert.equal(H.mj().juez, sucesor); assert.equal(res.por, 'juez');
      topes(H, 'juez muerto'); H.cerrarTodo();
    });
    test(`${G}: 5% de pérdida, el juez muere a gt=${k} s => un solo veredicto, mismo h`, async () => {
      const H = await partida({ delay: 150, humans: 4, seed: Math.round(k * 10) + 1 });
      H.eventos.push({ en: k, fn: h => { h.matar(h.mj().juez); } });
      await H.cerrar(60); const res = unVeredicto(H, `juez muerto@${k} (5%)`, { testigo: true });
      assert.ok(res.por === 'juez' || res.por === 'testigo', res.por); H.cerrarTodo();
    });
  }
}

test(`${G}: un humano pierde la conexión: pasa a CPU en [2,0; 3,5] s, juega como CPU y al volver recupera el asiento`, async () => {
  const H = await partida({ delay: 100, loss: 0, humans: 3, seed: 90, cpuNivel: 3 }, { a: { skill: .95 }, b: { skill: .95 }, c: { skill: .95 } });
  const juez = H.mj().juez, caido = H.ids.filter(s => s !== juez && s !== 'a')[0] || H.ids.filter(s => s !== juez)[0], pi = H.mj().as.indexOf(caido);
  let t0 = null, t1 = null;
  H.eventos.push({ en: 4, fn: h => { t0 = h.R.t; h.R.offline[caido] = true; } }, { en: 14, fn: h => { t1 = h.R.t; h.R.offline[caido] = false; } });
  await H.cerrar(60);
  const cpu = H.log.filter(x => x.s === juez && x.ev.ty === 'cpu' && x.ev.p === pi)[0], hum = H.log.filter(x => x.s === juez && x.ev.ty === 'hum' && x.ev.p === pi)[0];
  assert.ok(t0 && cpu); const seg = (cpu.rt - t0) / 1000; assert.ok(seg >= 1.9 && seg <= 3.6, `ev cpu a los ${seg.toFixed(2)} s`);
  assert.ok(hum && hum.rt > t1); H.ids.forEach(s => assert.equal(H.sess[s].hud().items[pi].cpu, false, s));
  const res = unVeredicto(H, 'caída'); assert.ok(res.sc[pi] > 20, 'la CPU que lo reemplazó siguió puntuando: ' + res.sc[pi]); topes(H, 'caída'); H.cerrarTodo();
});
test(`${G}: con 5% de pérdida un asiento caído acaba como CPU y vuelve; veredicto único`, async () => {
  const H = await partida({ delay: 150, humans: 4, seed: 63, cpuNivel: 3 }, { a: { skill: .95 }, b: { skill: .95 }, c: { skill: .95 }, d: { skill: .95 } });
  let caido = null, t0 = null, t1 = null;
  H.eventos.push({ en: 4, fn: h => { caido = h.ids.filter(s => s !== h.mj().juez)[1]; t0 = h.R.t; h.R.offline[caido] = true; } }, { en: 15, fn: h => { t1 = h.R.t; h.R.offline[caido] = false; } });
  await H.cerrar(70); const pi = H.mj().as.indexOf(caido);
  assert.ok(H.log.some(x => x.s !== caido && x.ev.ty === 'cpu' && x.ev.p === pi && x.rt >= t0), 'se vio ev cpu'); assert.ok(H.log.some(x => x.ev.ty === 'hum' && x.ev.p === pi && x.rt > t1), 'ev hum');
  unVeredicto(H, 'caída 5%', { testigo: true }); H.cerrarTodo();
});

for (const [seed, nivel] of [[201, 1], [202, 2], [203, 3]]) {
  test(`${G}: dos humanos ociosos no ganan a dos CPU activas (cpu nivel ${nivel})`, async () => {
    const H = await partida({ delay: 100, loss: 0, humans: 2, seed, cpuNivel: nivel, lv: nivel }, { a: 'idle', b: 'idle' });
    await H.cerrar(); const res = unVeredicto(H, 'ociosos n' + nivel);
    const as = H.mj().as, idle = [as.indexOf('a'), as.indexOf('b')], cpus = [as.indexOf('c'), as.indexOf('d')];
    idle.forEach(i => assert.ok(res.puestos[i] > 1 && res.sc[i] === 0, `ocioso ${as[i]} puestos ${res.puestos} sc ${res.sc}`));
    assert.ok(Math.min.apply(null, cpus.map(i => res.sc[i])) > 0); H.cerrarTodo();
  });
}
test(`${G}: un humano que juega (stick + A: echa, voltea y saca por la red) le gana a uno ocioso y a la CPU floja`, async () => {
  const H = await partida({ delay: 150, humans: 2, seed: 301, cpuNivel: 1 }, { a: { skill: .95 }, b: 'idle' });
  await H.cerrar(); const res = unVeredicto(H, 'activo vs ocioso'); const as = H.mj().as, a = as.indexOf('a'), b = as.indexOf('b');
  assert.ok(res.sc[a] > res.sc[b] && res.sc[a] >= 80, `activo (${res.sc[a]}) vs ocioso (${res.sc[b]}); sc ${res.sc}`); H.cerrarTodo();
});

test(`${G}: duración completa (30 s), 4 humanos, 300 ms y 5% de pérdida`, async (t) => {
  const H = await partida({ delay: 300, humans: 4, seed: 70 }); await H.cerrar(80);
  const res = unVeredicto(H, 'completa'); const rps = topes(H, 'completa');
  t.diagnostic(`req/s ${JSON.stringify(rps)}; época final ${H.mj().e}; sc ${res.sc}`); H.cerrarTodo();
});
/* el corte de 0,6 s antes de dur existe para que el veredicto del juez traiga TODOS los puntos: sin pérdida y a 300 ms el marcador propio de cada
   pantalla es EXACTAMENTE el del veredicto. (Con 5 % de pérdida el relé puede enmudecer a un cliente ~2,5 s y el juez ve un `o` viejo: propiedad del
   transporte, común a todos los juegos modelo A/B, no del juego; ahí el veredicto sigue siendo único y solo puede ser <= al marcador propio.) */
for (const [delay, loss, seed] of [[300, 0, 70], [150, 0, 71], [50, 0, 72]]) {
  test(`${G}: sin pérdida a ${delay} ms el veredicto del juez = el marcador propio de cada pantalla`, async () => {
    const H = await partida({ delay, loss, humans: 4, seed }); await H.cerrar(80);
    const res = unVeredicto(H, 'exacto'); const as = H.mj().as;
    as.forEach((s, i) => assert.equal(H.sess[s].g.vista().pts[i], res.sc[i], `${s}: marcador propio ${H.sess[s].g.vista().pts[i]} vs veredicto ${res.sc[i]}`)); H.cerrarTodo();
  });
}
test(`${G}: con 5% de pérdida el veredicto nunca supera al marcador propio ni se queda a más de ~3 tequeños`, async () => {
  const H = await partida({ delay: 150, humans: 4, seed: 73 }); await H.cerrar(80);
  const res = unVeredicto(H, 'perdida'); const as = H.mj().as;
  as.forEach((s, i) => { const own = H.sess[s].g.vista().pts[i]; assert.ok(res.sc[i] <= own && own - res.sc[i] <= 36, `${s}: propio ${own} veredicto ${res.sc[i]}`); }); H.cerrarTodo();
});
test(`${G}: malla P2P abierta + relé con 5% de pérdida`, async () => {
  const H = await partida({ delay: 150, humans: 3, seed: 55, p2p: { f: { delay: 25, jitter: 10, loss: .05, reorder: .1 } } });
  await H.cerrar(); unVeredicto(H, 'p2p'); topes(H, 'p2p'); H.cerrarTodo();
});
test(`${G}: el juego no manda tipos propios: solo el vocabulario del runtime (i, o, hb, ev, end, ...)`, async () => {
  const H = await partida({ delay: 100, loss: 0, humans: 2, seed: 8 }); await H.cerrar();
  H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || t === 'hb', 'tipo en el cable: ' + t)); H.cerrarTodo();
});
