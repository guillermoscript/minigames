'use strict';
/* LA FIESTA · minijuegos EN VIVO (M2): pruebas de red de los TRES juegos reales (f_mecate A, f_domino B, f_harina C) sobre el stack real:
     fiesta-net.js (transporte, reloj, presencia) + fiesta-live.js (sesión, juez, CAS, veredicto) + el juego
     + party.js / party_mj.js (la sala real: reductor, relé con caché `slimRoom`, `ready`, `juez`, `mjfin`, `mjack`, tick)
   detrás de test/helpers/mem-relay.js (reloj VIRTUAL, retardo + jitter + pérdida de peticiones). Sin red, sin navegador, sin PocketBase.
   Qué se comprueba (docs/mario-party/M2-SPEC.md §7): mismos puestos en todas las pantallas a 50/150/300 ms; exactamente un juez; juez
   muerto en un instante aleatorio => un solo veredicto; asiento caído => CPU (y regreso); ningún tipo reservado reutilizado; presupuesto
   de peticiones por segundo y de bytes; resultados dentro de los topes del catálogo; humanos ociosos no ganan a CPU activas.
   node --test test/fiesta-live.test.js            (LIVE_FULL=1 añade duración completa y más semillas) */
const realTest = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), SL = path.join(root, 'docs/style-lab');
const FULL = !!process.env.LIVE_FULL;
const test = process.env.LIVE_DBG ? () => {} : realTest;   // LIVE_DBG=1: solo exporta el arnés (para depurar a mano)

const A = require('./helpers/live-arnes.js');
const { arnes, crearSala, memStore, LIVE, CAT, NET, P, R0, STEP } = A;
const GAME_FILES = { f_mecate: 'fiesta-juego-mecate.js', f_domino: 'fiesta-juego-domino.js', f_harina: 'fiesta-juego-harina.js' };
for (const f of Object.values(GAME_FILES)) require(path.join(SL, f));
const { memRelay, mulberry32 } = require('./helpers/mem-relay.js');
const GAMES = Object.keys(GAME_FILES);
const RESERVED = LIVE.RESERVED, X_RE = /^x[a-z0-9]{1,11}$/;

/* ───────────── comprobaciones comunes ───────────── */
function limites(game, dur) { const lim = CAT[game].lim; return Math.floor(Math.min(lim.scoreMax, lim.scoreRate * (dur + 1.5))); }
const unico = a => a.filter((x, i) => a.indexOf(x) === i);
/* topes del catálogo: todo puntaje en [0, min(scoreMax, scoreRate·(dur+1,5))] y el servidor NO tuvo que recortar */
function enLimites(H, etiqueta) {
  const res = H.res(), tope = limites(H.o.game, H.o.dur);
  res.sc.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= tope, `${etiqueta}: sc[${i}]=${v} fuera de [0, ${tope}]`));
  assert.equal(res.aj, false, etiqueta + ': el servidor no tuvo que recortar (res.aj)');
}
/* presupuesto de red: ≤20 req/s por cliente, ≤45 req/s por sala, carga ≤420 B (x* ≤200 B), lote ≤512 B y ≤10 mensajes, sin rechazos antes del cierre */
function presupuesto(H, etiqueta) {
  const rps = H.reqPorSeg();
  Object.keys(rps).forEach(k => { if (k !== 'sala') assert.ok(rps[k] <= 20, `${etiqueta}: ${k} hizo ${rps[k]} req/s (>20)`); });
  assert.ok(rps.sala <= 45, `${etiqueta}: la sala hizo ${rps.sala} req/s (>45)`);
  H.sigLog.forEach(r => {
    assert.ok(r.n <= 10, `${etiqueta}: lote de ${r.n} mensajes`);
    assert.ok(r.bytes <= 512, `${etiqueta}: lote de ${r.bytes} B`);
    r.lens.forEach((l, j) => assert.ok(l <= (X_RE.test(r.types[j]) ? 200 : 420), `${etiqueta}: mensaje ${r.types[j]} de ${l} B`));
  });
  const malos = H.rechazos.filter(r => H.resAt === undefined || r.at < H.resAt);
  assert.deepEqual(malos, [], etiqueta + ': el relé rechazó lotes antes del cierre');
  return rps;
}
/* ningún tipo reservado reutilizado: lo que sale al cable es el vocabulario del runtime/transporte o x* */
function tiposOk(H, etiqueta) {
  const permitidos = new Set(RESERVED.concat(['hb']));
  H.tipos.forEach(t => assert.ok(permitidos.has(t) || X_RE.test(t), `${etiqueta}: tipo desconocido en el cable: ${t}`));
  H.ids.forEach(s => { const st = H.sess[s] && H.sess[s].stats.sent; if (st) Object.keys(st).forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t), `${etiqueta}: ${s} envió ${t}`)); });
}
/* un solo veredicto: mismo h en todas las pantallas vivas, = h del servidor; mjfin aceptado una vez; un solo `end` emitido por época */
function unVeredicto(H, etiqueta, op) {
  op = op || {};
  const res = H.res();
  assert.ok(res, etiqueta + ': el servidor cerró el juego con resultado'); assert.equal(H.srv.board.f, 'res');
  const vs = H.veredictos(), vivos = H.ids.filter(s => !H.dead[s]);
  assert.deepEqual(Object.keys(vs).sort(), vivos.slice().sort(), etiqueta + ': todas las pantallas vivas tienen veredicto');
  assert.deepEqual(unico(Object.values(vs).map(v => v.h)), [res.h], etiqueta + ': mismo h en todas las pantallas y = al del servidor');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.pl))), [JSON.stringify(res.puestos)], etiqueta + ': mismos puestos en todas las pantallas y = a los del servidor');
  assert.deepEqual(unico(Object.values(vs).map(v => JSON.stringify(v.sc))), [JSON.stringify(res.sc)], etiqueta + ': mismos puntajes');
  const aceptados = H.mjfin().filter(c => c.status === 200).length;
  if (op.testigo && res.por === 'testigo') assert.equal(aceptados, 0, etiqueta + ': cierre por testigos => ningún mjfin aceptado');   // con la lista de sucesores agotada y el juez muerto, el servidor cierra con el testigo (DM2-11)
  else assert.equal(aceptados, 1, etiqueta + ': exactamente un mjfin aceptado');
  assert.ok(H.solapeMax <= 1000, `${etiqueta}: dos pantallas se creyeron juez a la vez durante ${H.solapeMax} ms`);   // la ventana entre el CAS y el SSE que lo anuncia
  const js = H.jueces(), eps = js.map(j => j.e);
  assert.equal(unico(eps).length, eps.length, etiqueta + ': un solo juez emitió veredicto por época: ' + JSON.stringify(js));
  return { res, vs, jueces: js };
}
/* una sala de n humanos (n=2..4, el resto CPU) juega un minijuego completo con bots activos de distinta habilidad */
async function partida(o, bots) {
  const H = await arnes(o);
  H.bot = bots || {}; H.ids.forEach((s, i) => { if (!(s in H.bot)) H.bot[s] = { skill: [.7, .5, .6, .4][i] }; });
  await H.arrancar();
  return H;
}

/* ───────────── pruebas ───────────── */
test('registro: los tres juegos están dados de alta y coinciden con el catálogo del servidor', () => {
  for (const g of GAMES) {
    const d = LIVE.get(g); assert.ok(d, g + ' registrado');
    assert.equal(d.modelo, CAT[g].mo, g + ' modelo'); assert.equal(d.clase, CAT[g].cl, g + ' clase');
    assert.deepEqual(d.modos, CAT[g].m, g + ' modos');
    ['scoreMax', 'scoreRate', 'minT'].forEach(k => assert.equal(d.limites[k], CAT[g].lim[k], g + ' lim.' + k));
    assert.equal(!!d.limites.finTemprano, !!CAT[g].lim.finTemprano, g + ' finTemprano');
  }
  assert.deepEqual(['A', 'B', 'C'], GAMES.map(g => LIVE.get(g).modelo), 'uno por modelo de red');
});

test('lint de los archivos de juego: sin Math.random ni tipos reservados en c.send/c.on', () => {
  for (const [g, f] of Object.entries(GAME_FILES)) {
    const src = fs.readFileSync(path.join(SL, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');   // sin comentarios
    assert.ok(!/Math\.random/.test(src), g + ': Math.random');
    const re = /\bc\.(?:send|on)\(\s*(['"])([^'"]+)\1/g; let m;
    while ((m = re.exec(src))) assert.ok(X_RE.test(m[2]) && RESERVED.indexOf(m[2]) < 0, g + ': tipo ' + m[2] + ' no permitido');
  }
});

for (const game of GAMES) {
  /* red limpia: el juez elegido se queda (sin migraciones espurias), una sola época */
  test(`${game}: sin pérdida hay exactamente un juez, época 0, y todas las pantallas se mueven a la vez`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed: 11 });
    const juez = H.mj().juez; await H.cerrar();
    const { jueces } = unVeredicto(H, game);
    assert.equal(H.mj().e, 0, 'la época no subió'); assert.equal(H.mj().juez, juez);
    assert.deepEqual(jueces, [{ e: 0, seat: juez }], 'un solo emisor de end');
    assert.deepEqual(H.ids.filter(s => H.sess[s].esJuez()), [juez], 'exactamente un juez en las pantallas');
    assert.equal(H.calls.filter(c => c.action === 'juez').length, 0, 'nadie pidió el CAS del juez');
    const go = Object.values(H.goAt); assert.equal(go.length, 3);
    assert.ok(Math.max.apply(null, go) - Math.min.apply(null, go) <= 100, '«¡YA!» con <100 ms de diferencia entre pantallas: ' + JSON.stringify(H.goAt));
    presupuesto(H, game); tiposOk(H, game); enLimites(H, game); H.cerrarTodo();
  });

  for (const delay of [50, 150, 300]) {
    test(`${game}: mismos puestos en todas las pantallas a ${delay} ms (5% de pérdida, 3 humanos + 1 CPU)`, async () => {
      const H = await partida({ game, delay, humans: 3, seed: delay + 3 }, { c: 'idle' });
      await H.cerrar();
      const { res } = unVeredicto(H, `${game}@${delay}`);
      assert.equal(res.por, 'juez');
      presupuesto(H, `${game}@${delay}`); tiposOk(H, `${game}@${delay}`); enLimites(H, `${game}@${delay}`);
      H.cerrarTodo();
    });
  }

  for (const humans of [2, 4]) {
    test(`${game}: ${humans} humanos${humans < 4 ? ' + CPU' : ''} a 150 ms con 5% de pérdida`, async () => {
      const H = await partida({ game, delay: 150, humans, seed: 40 + humans });
      await H.cerrar();
      unVeredicto(H, `${game} x${humans}`); presupuesto(H, `${game} x${humans}`); tiposOk(H, `${game} x${humans}`); enLimites(H, `${game} x${humans}`);
      H.cerrarTodo();
    });
  }
}

/* ───────────── juez muerto en un instante aleatorio ───────────── */
/* Red limpia (sin pérdida): la migración es EXACTA: época 1, el primer sucesor, un solo mjfin aceptado y viene de él.
   Red con 5 % de pérdida: además hay migraciones espurias (un sig perdido tarda 2,5 s y el juez calla > 1,2 s), así que solo se exige lo que
   siempre debe cumplirse: un único veredicto, el mismo h en todas las pantallas vivas, y el servidor cierra (por juez o por testigos). */
for (const game of GAMES) {
  const rnd = mulberry32(GAMES.indexOf(game) * 977 + 5);
  const instantes = [1 + rnd() * 10, 1 + rnd() * 10, 1 + rnd() * 10].map(x => Math.round(x * 100) / 100);
  instantes.push(12.4);                                       // y uno pegado al cierre (dur 14)
  for (const k of instantes) {
    test(`${game}: red limpia, el juez muere a gt=${k} s => migra una vez, un solo veredicto, mismo h`, async () => {
      const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed: Math.round(k * 10) });
      const sucesor = H.mj().suc[0];
      let viejo = null;
      H.eventos.push({ en: k, fn: h => { viejo = h.mj().juez; h.matar(viejo); } });
      await H.cerrar(50);
      const { res, jueces } = unVeredicto(H, `${game} juez muerto@${k}`);
      assert.ok(viejo && H.dead[viejo], 'el juez viejo murió');
      assert.equal(H.mj().e, 1, 'la época subió exactamente una vez');
      assert.equal(H.mj().juez, sucesor, 'el nuevo juez es el primer sucesor');
      assert.deepEqual(jueces, [{ e: 1, seat: sucesor }], 'solo el nuevo juez emitió veredicto');
      assert.equal(res.por, 'juez'); assert.equal(res.disputado, false);
      assert.deepEqual(H.calls.filter(c => c.action === 'juez').map(c => [c.id, c.status]), [[sucesor, 200]], 'un solo CAS, aceptado');
      presupuesto(H, game); tiposOk(H, game); enLimites(H, game); H.cerrarTodo();
    });
    test(`${game}: 5% de pérdida, el juez muere a gt=${k} s => un solo veredicto, mismo h en las pantallas vivas`, async () => {
      const H = await partida({ game, delay: 150, humans: 4, seed: Math.round(k * 10) + 1 });
      let viejo = null;
      H.eventos.push({ en: k, fn: h => { viejo = h.mj().juez; h.matar(viejo); } });
      await H.cerrar(50);
      const { res, jueces } = unVeredicto(H, `${game} juez muerto@${k} (5%)`, { testigo: true });
      assert.ok(viejo && H.dead[viejo], 'el juez murió');
      assert.ok(res.por === 'juez' || res.por === 'testigo', 'cierre por juez o por testigos: ' + res.por);
      assert.equal(unico(jueces.map(j => j.e)).length, jueces.length, 'a lo sumo un emisor de end por época');
      tiposOk(H, game); enLimites(H, game); H.cerrarTodo();
    });
  }
}

/* ───────────── asiento caído => CPU, y de vuelta ───────────── */
for (const game of GAMES) {
  test(`${game}: un humano que pierde la conexión pasa a CPU en [2,0; 3,5] s y al volver se le devuelve el asiento`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed: 90 + GAMES.indexOf(game), dur: 20, cpuNivel: 3 }, { a: { skill: .95 }, b: { skill: .95 }, c: { skill: .95 } });
    const juez = H.mj().juez, caido = H.ids.filter(s => s !== juez && s !== 'a')[0] || H.ids.filter(s => s !== juez)[0], pi = H.mj().as.indexOf(caido);
    let t0 = null, t1 = null;
    H.eventos.push({ en: 1, fn: h => { t0 = h.R.t; h.R.offline[caido] = true; } });
    H.eventos.push({ en: 6.5, fn: h => { t1 = h.R.t; h.R.offline[caido] = false; } });
    await H.cerrar(50);
    const cpu = H.log.filter(x => x.s === juez && x.ev.ty === 'cpu' && x.ev.p === pi)[0], hum = H.log.filter(x => x.s === juez && x.ev.ty === 'hum' && x.ev.p === pi)[0];
    assert.ok(t0 && cpu, 'el juez declaró CPU al asiento caído');
    const seg = (cpu.rt - t0) / 1000;
    assert.ok(seg >= 1.9 && seg <= 3.6, `ev cpu a los ${seg.toFixed(2)} s de caer (esperado 2,0-3,5)`);
    assert.ok(hum && hum.rt > t1, 'ev hum después de volver');
    assert.ok((hum.rt - t1) / 1000 <= 3, 'ev hum no tarda más de 3 s: ' + (hum.rt - t1));
    // los demás humanos (no caídos) también se enteran, y el asiento es CPU en su HUD durante la caída
    H.ids.filter(s => s !== caido && s !== juez).forEach(s => assert.ok(H.log.some(x => x.s === s && x.ev.ty === 'cpu' && x.ev.p === pi), s + ' vio el ev cpu'));
    H.ids.forEach(s => { assert.equal(H.sess[s].hud().items[pi].cpu, false, s + ': al final el asiento volvió a humano'); });
    unVeredicto(H, game + ' caída'); tiposOk(H, game);
    H.cerrarTodo();
  });
}

/* ───────────── humanos ociosos contra CPU activas ───────────── */
for (const game of GAMES) {
  test(`${game}: dos humanos ociosos no ganan a dos CPU activas (nivel 2)`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 2, seed: 120 + GAMES.indexOf(game), dur: 20 }, { a: 'idle', b: 'idle' });
    await H.cerrar();
    const { res } = unVeredicto(H, game + ' ociosos');
    const as = H.mj().as, idle = [as.indexOf('a'), as.indexOf('b')], cpus = [as.indexOf('c'), as.indexOf('d')];
    idle.forEach(i => assert.ok(res.puestos[i] > 1, `el ocioso ${as[i]} no puede ser 1.º (puestos ${res.puestos}, sc ${res.sc})`));
    assert.ok(Math.max.apply(null, idle.map(i => res.sc[i])) <= Math.max.apply(null, cpus.map(i => res.sc[i])), `el mejor ocioso no supera a la mejor CPU (sc ${res.sc})`);
    assert.ok(Math.min.apply(null, idle.map(i => res.puestos[i])) >= Math.min.apply(null, cpus.map(i => res.puestos[i])), 'ningún ocioso queda por delante de todas las CPU');
    H.cerrarTodo();
  });
}

/* ───────────── más escenarios ───────────── */
for (const game of GAMES) {
  test(`${game}: duración completa del catálogo (${CAT[game].dur} s), 4 humanos, 300 ms y 5% de pérdida`, async (t) => {
    const H = await partida({ game, delay: 300, humans: 4, seed: 70 + GAMES.indexOf(game), dur: CAT[game].dur });
    await H.cerrar(80);
    const { res } = unVeredicto(H, game + ' completa');
    const rps = presupuesto(H, game + ' completa'); tiposOk(H, game); enLimites(H, game + ' completa');
    assert.ok(res.puestos.indexOf(1) >= 0, 'hay un 1.º');
    t.diagnostic(`req/s pico ${JSON.stringify(rps)}; época final ${H.mj().e}; solape de dos «jueces» ≤ ${H.solapeMax} ms; sc ${res.sc}`);
    H.cerrarTodo();
  });

  test(`${game}: malla P2P abierta (canal f con 5% de pérdida y reordenamiento) + relé con 5% de pérdida`, async (t) => {
    const H = await partida({ game, delay: 150, humans: 3, seed: 55, p2p: { f: { delay: 25, jitter: 10, loss: .05, reorder: .1 } } });
    await H.cerrar();
    unVeredicto(H, game + ' p2p'); presupuesto(H, game + ' p2p'); tiposOk(H, game); enLimites(H, game + ' p2p');
    t.diagnostic('mensajes P2P: ' + H.R.log.p2p + '; época final ' + H.mj().e);
    H.cerrarTodo();
  });

  test(`${game}: un tipo reservado o mal formado en c.send LANZA en strict (nunca llega al cable)`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 2, seed: 8 });
    await H.correr(1);
    const c = H.sess.a.c;
    ['end', 's', 'o', 'ev', 'hb', 'i', 'ok', 'jg', 'cl', '_net_ping', 'X1', 'xlargo_de_mas_de_doce'].forEach(t => assert.throws(() => c.send(t, {}), /no permitido/, t));
    assert.throws(() => c.send('xok', { s: 'x'.repeat(300) }), /200/);
    const antes = H.tipos.size; await H.correr(1);
    H.tipos.forEach(t => assert.ok(RESERVED.indexOf(t) >= 0 || X_RE.test(t), 'tipo en el cable: ' + t));
    assert.ok(H.tipos.size >= antes);
    H.cerrarTodo();
  });

  test(`${game}: con 5% de pérdida un asiento caído acaba como CPU y vuelve a humano; el veredicto es único`, async () => {
    const H = await partida({ game, delay: 150, humans: 4, seed: 63 + GAMES.indexOf(game), dur: 20, cpuNivel: 3 }, { a: { skill: .95 }, b: { skill: .95 }, c: { skill: .95 }, d: { skill: .95 } });
    let caido = null, t0 = null, t1 = null;
    H.eventos.push({ en: 1, fn: h => { caido = h.ids.filter(s => s !== h.mj().juez)[1]; t0 = h.R.t; h.R.offline[caido] = true; } });
    H.eventos.push({ en: 7, fn: h => { t1 = h.R.t; h.R.offline[caido] = false; } });
    await H.cerrar(60);
    const pi = H.mj().as.indexOf(caido);
    const vio = H.log.filter(x => x.s !== caido && x.ev.ty === 'cpu' && x.ev.p === pi && x.rt >= t0);
    assert.ok(vio.length >= 1, 'alguien vio el ev cpu del asiento caído');
    assert.ok((Math.min.apply(null, vio.map(x => x.rt)) - t0) / 1000 <= 6, 'ev cpu en ≤ 6 s con pérdida');
    assert.ok(H.log.some(x => x.ev.ty === 'hum' && x.ev.p === pi && x.rt > t1), 'ev hum después de volver');
    unVeredicto(H, game + ' caída (5%)', { testigo: true }); tiposOk(H, game); H.cerrarTodo();
  });
}

for (const game of GAMES) {
  test(`${game}: humanos ociosos nunca ganan a CPU activas (3 semillas, niveles 1-3)`, async () => {
    for (const [seed, nivel] of [[201, 1], [202, 2], [203, 3]]) {
      const H = await partida({ game, delay: 100, loss: 0, humans: 2, seed: seed + GAMES.indexOf(game), dur: 20, cpuNivel: nivel }, { a: 'idle', b: 'idle' });
      await H.cerrar();
      const { res } = unVeredicto(H, `${game} ociosos s${seed} n${nivel}`);
      const as = H.mj().as, idle = [as.indexOf('a'), as.indexOf('b')], cpus = [as.indexOf('c'), as.indexOf('d')];
      idle.forEach(i => assert.ok(res.puestos[i] > 1, `s${seed} n${nivel}: el ocioso ${as[i]} no puede ser 1.º (puestos ${res.puestos}, sc ${res.sc})`));
      assert.ok(Math.max.apply(null, idle.map(i => res.sc[i])) <= Math.max.apply(null, cpus.map(i => res.sc[i])), `s${seed} n${nivel}: el mejor ocioso no supera a la mejor CPU (sc ${res.sc})`);
      H.cerrarTodo();
    }
  });
  test(`${game}: un humano que juega le gana a uno ocioso (la entrada llega al juego por la red)`, async () => {
    const H = await partida({ game, delay: 150, humans: 2, seed: 401 + GAMES.indexOf(game), dur: 20 }, { a: { skill: .9 }, b: 'idle' });
    await H.cerrar();
    const { res } = unVeredicto(H, game + ' activo vs ocioso');
    const as = H.mj().as, a = as.indexOf('a'), b = as.indexOf('b');
    assert.ok(res.sc[a] > res.sc[b], `activo (${res.sc[a]}) > ocioso (${res.sc[b]})`);
    H.cerrarTodo();
  });
}

/* ───────────── un humano sentado que NO juega este minijuego (duelo 1v1) ───────────── */
for (const game of GAMES) {
  test(`${game}: duelo 1v1 con un tercer humano mirando: no manda nada al alcance del juego ni recibe rechazos del relé`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed: 29, as: ['a', 'b'] }, { a: { skill: .8 }, b: { skill: .6 } });
    await H.cerrar();
    const mir = H.sess.c;
    unVeredicto(H, game + ' duelo', { testigo: false });
    assert.equal(mir.c.yo, -1, 'el que mira no tiene asiento en el juego');
    assert.deepEqual(H.calls.filter(c => c.id === 'c' && c.action === 'ready'), [], 'quien mira no pide LISTO');
    const suyos = H.sigLog.filter(r => r.from === 'c' && r.sc && /^m:/.test(r.sc || ''));
    assert.deepEqual(H.rechazos.filter(r => r.from === 'c' && (H.resAt === undefined || r.at < H.resAt)), [], 'el relé no rechazó nada a quien mira (403 «Not in this round»)');
    assert.equal(H.srv.board.mj.res.sc.length, 2);
    tiposOk(H, game); H.cerrarTodo();
  });
}

/* ───────────── fallos inyectados: lo que antes se perdía para siempre ───────────── */
for (const game of GAMES) {
  test(`${game}: el primer mjfin del juez se pierde => se reintenta y el juez cobra antes del plazo del servidor`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed: 17 });
    H.fallo.mjfin = 2;                                          // se pierden las dos primeras peticiones (caducan a los 10 s si nadie las repite)
    await H.cerrar();
    const { res } = unVeredicto(H, game + ' mjfin perdido');
    assert.equal(res.por, 'juez', 'cerró el juez, no los testigos'); assert.equal(H.perdidas.filter(x => x.a === 'mjfin').length, 2);
    const acept = H.calls.filter(c => c.action === 'mjfin' && c.status === 200)[0];
    assert.ok(acept.at < H.mj().cierre - H.R.epoch, 'aceptado antes del plazo de cierre del servidor');
    H.cerrarTodo();
  });

  test(`${game}: el primer CAS del sucesor se pierde => lo repite y el juego sigue con un juez nuevo`, async () => {
    const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed: 19 });
    H.fallo.juez = 2;
    let viejo = null; H.eventos.push({ en: 4, fn: h => { viejo = h.mj().juez; h.matar(viejo); } });
    await H.cerrar(50);
    const { res } = unVeredicto(H, game + ' CAS perdido');
    assert.equal(H.perdidas.filter(x => x.a === 'juez').length, 2); assert.equal(H.mj().e, 1);
    assert.equal(res.por, 'juez'); assert.notEqual(H.mj().juez, viejo);
    H.cerrarTodo();
  });

  test(`${game}: un ¡LISTO! perdido se repite: la partida arranca sin esperar el plazo de la tarjeta`, async () => {
    const H = await arnes({ game, delay: 100, loss: 0, humans: 3, seed: 23, dur: 14 });
    H.bot = {}; H.fallo.ready = 2;
    H.abrir(); await H.correr(2.6);
    H.ids.forEach(s => H.sess[s].ready());
    const t0 = H.R.t;
    for (let i = 0; i < 400 && H.mj().startAt == null; i++) await H.correr(0.1);
    const seg = (H.R.t - t0) / 1000;
    assert.equal(H.perdidas.filter(x => x.a === 'ready').length, 2);
    assert.ok(H.mj().startAt != null && seg < 8, `arrancó a los ${seg.toFixed(1)} s (el plazo de la tarjeta es 19,5 s)`);
    assert.equal(Object.keys(H.mj().listos || {}).length, 3, 'los tres LISTO llegaron');
    H.cerrarTodo();
  });
}

/* ───────────── LIVE_FULL=1: más semillas (no entra en la corrida normal) ───────────── */
if (FULL) {
  for (const game of GAMES) {
    for (let seed = 500; seed < 508; seed++) {
      test(`[FULL] ${game}: semilla ${seed}, ${2 + (seed % 3)} humanos, ${[50, 150, 300][seed % 3]} ms`, async () => {
        const H = await partida({ game, delay: [50, 150, 300][seed % 3], humans: 2 + (seed % 3), seed, dur: CAT[game].dur });
        await H.cerrar(80);
        unVeredicto(H, `${game} s${seed}`, { testigo: false }); presupuesto(H, game); tiposOk(H, game); enLimites(H, game); H.cerrarTodo();
      });
      test(`[FULL] ${game}: semilla ${seed}, juez muerto en un instante aleatorio, red limpia`, async () => {
        const H = await partida({ game, delay: 100, loss: 0, humans: 3, seed, dur: 14 });
        const k = 1 + mulberry32(seed)() * 11.5, sucesor = H.mj().suc[0];
        H.eventos.push({ en: k, fn: h => { h.matar(h.mj().juez); } });
        await H.cerrar(50);
        const { res } = unVeredicto(H, `${game} s${seed} k${k.toFixed(2)}`);
        assert.equal(H.mj().e, 1); assert.equal(H.mj().juez, sucesor); assert.equal(res.por, 'juez');
        H.cerrarTodo();
      });
    }
  }
}

module.exports = { arnes, LIVE, CAT, GAMES };
