// Reglas de Isla de Margarita (reductor puro, doc 14 §3-4 y §9): una prueba por regla.
const test = require('node:test'), assert = require('node:assert');
const R = require('../docs/margarita/margarita-reglas.js');
const CPU = require('../docs/margarita/margarita-cpu.js');
const G = require('../docs/margarita/margarita-grafo.js');
const RNG = require('../docs/style-lab/fiesta-rng.js');
R.ESTRICTO = true;
const NOW = 1e12;
const J = (x) => JSON.parse(JSON.stringify(x));
const ID = G.J, SEG = G.SEGS;

// Partida con 1 humano (a) + 3 CPU, orden fijo: ya en la ronda 1 con el DADO de a abierto.
function arrancar(cfg) {
  const { S, priv } = R.crear(7, Object.assign({ orden: 'fijo' }, cfg), [{ name: 'ANA', ch: 'tu' }], NOW);
  const r = R.tick(S, priv, NOW + R.T.orden); assert.ifError(r.error);
  assert.equal(r.S.esp.s, 'a'); assert.equal(r.S.esp.k, 'DADO');
  return r;
}
// Fuerza el turno de `a` en `nodo` con un DADO TRUCADO en el bolsillo (el estado es JSON plano).
function turnoDe(base, nodo, mods) {
  const S = J(base.S), P = J(base.priv);
  S.f = 'turno'; S.mj = null; S.pj.a.en = nodo; S.pj.a.items = ['trucado'];
  S.t = { s: 'a', resto: 0, q: [{ k: 'fin' }], ctx: null, extra: 0 };
  S.esp = { id: S.ver, s: 'a', k: 'DADO', opc: ['TIRAR', 'trucado'], hasta: NOW + 20000 };
  if (mods) mods(S, P);
  return { S, priv: P };
}
// Abre un aviso cualquiera para `a` (para los que el tablero de hoy no tiene casilla, como la BRONCA).
function aviso(base, k, opc, mods) { return turnoDe(base, ID.POR.id, (S, P) => { S.esp = { id: S.ver, s: 'a', k, opc, hasta: NOW + 15000 }; if (mods) mods(S, P); }); }
function act(st, a, s) { const r = R.aplicar(st.S, st.priv, s || 'a', Object.assign({ eid: st.S.esp && st.S.esp.id }, a), NOW); return r; }
function ok(st, a, s) { const r = act(st, a, s); assert.ifError(r.error); return r; }
// Avanza exactamente n casillas con el trucado.
function mover(st, n) { return ok(ok(st, { t: 'USAR', item: 'trucado' }), { t: 'PASOS', n }); }
const hops = (r, s) => r.fx.filter((f) => f.k === 'hop' && f.s === (s || 'a')).map((f) => f.a);
const monPor = (r, por, s) => r.fx.filter((f) => f.k === 'mon' && f.por === por && f.s === (s || 'a')).reduce((t, f) => t + f.d, 0);

test('crear: board sin RNG ni semilla, 4 asientos, todos en Porlamar con 10 Bs', () => {
  const { S, priv } = R.crear(99, {}, [{ name: 'ANA', ch: 'tu' }], NOW);
  const txt = JSON.stringify(S);
  assert.ok(!/"rng"|"semilla"/.test(txt));
  assert.ok(priv.rng && priv.semilla === 99);
  assert.deepEqual(Object.keys(S.pj), ['a', 'b', 'c', 'd']);
  Object.values(S.pj).forEach((p) => { assert.equal(p.en, ID.POR.id); assert.equal(p.bs, 10); });
  assert.equal(S.pj.a.cpu, null); assert.equal(S.pj.b.cpu, 'auto');
  assert.equal(S.tab, 'margarita');
});

test('determinismo: misma semilla y mismas jugadas → mismo hash; proyectar(D, fx) = S en cada lote', () => {
  function jugar(sem) {
    let { S, priv } = R.crear(sem, { tot: 5 }, [{ name: 'ANA', ch: 'tu' }], NOW), now = NOW, n = 0;
    const rng = RNG.crear(sem + 1);
    while (S.f !== 'fin' && n < 5000) {
      let r;
      if (S.f === 'turno' && S.esp && S.esp.s === 'a') r = R.aplicar(S, priv, 'a', CPU.decide(S, R.vista(S, 'a'), 'a', rng), now);
      else if (S.f === 'carta' && S.mj.as.includes('a') && !S.mj.listos.a) r = R.aplicar(S, priv, 'a', { t: 'LISTO' }, now);
      else if (S.f === 'mj') r = R.aplicar(S, priv, '$', { t: 'MJ_RESULTADO', k: S.mj.k, sc: S.mj.as.map(() => rng.int(0, 9)) }, now);
      else { now = Math.max(now, S.nextAt); r = R.tick(S, priv, now); if (r.nada) { now += 50; continue; } }
      assert.ifError(r.error);
      assert.equal(R.hash(R.proyectar(S, r.fx)), R.hash(r.S), 'lote ' + n);
      S = r.S; priv = r.priv; n++;
    }
    assert.equal(S.f, 'fin');
    return R.hash(S);
  }
  assert.equal(jugar(5), jugar(5));
  assert.notEqual(jugar(5), jugar(6));
});

test('eid viejo da eid, aid repetido se acepta sin aplicarse, turno ajeno da turno, la CPU no recibe jugadas', () => {
  const st = arrancar();
  assert.equal(act(st, { t: 'TIRAR', eid: st.S.esp.id - 1 }).error, 'eid');
  assert.equal(R.aplicar(st.S, st.priv, 'b', { t: 'TIRAR' }, NOW).error, 'turno');
  const r = ok(st, { t: 'TIRAR', aid: 'x1' });
  const d = R.aplicar(r.S, r.priv, 'a', { t: 'TIRAR', aid: 'x1' }, NOW);
  assert.ok(d.dup); assert.equal(d.S, r.S);
  const c = J(st); c.S.esp.s = 'b';
  assert.equal(R.aplicar(c.S, c.priv, 'b', { t: 'TIRAR', eid: c.S.esp.id }, NOW).error, 'cpu');
});

test('DADO: la palanca no se usa como dado; el trucado pide 1 a 10', () => {
  let st = turnoDe(arrancar(), ID.POR.id, (S) => { S.pj.a.items = ['palanca', 'trucado']; S.esp.opc = ['TIRAR', 'trucado']; });
  assert.equal(act(st, { t: 'USAR', item: 'palanca' }).error, 'opcion');
  const r = ok(st, { t: 'USAR', item: 'trucado' });
  assert.equal(r.S.esp.k, 'TRUCADO');
  assert.equal(act(r, { t: 'PASOS', n: 11 }).error, 'opcion');
  assert.equal(act(r, { t: 'PASOS', n: 0 }).error, 'opcion');
  assert.deepEqual(r.S.pj.a.items, ['palanca']);
});

test('La Restinga: pagar cruza a Oriente, no pagar sigue en Macanao, y lo pagado queda como peaje', () => {
  const pre = G.PREV[ID.ME.id][0];
  let st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 30; });
  let r = mover(st, 2);
  assert.equal(r.S.esp.k, 'CRUCE'); assert.equal(r.S.esp.opc.fee, 1); assert.equal(r.S.esp.opc.a, 'O');
  const no = ok(r, { t: 'CRUZAR', si: false });
  assert.equal(hops(no).pop(), SEG.w4.ids[0]);
  r = ok(r, { t: 'CRUZAR', si: true });
  assert.equal(r.S.esp.k, 'PEAJE'); assert.equal(r.S.esp.opc.tope, 30);
  assert.equal(act(r, { t: 'PAGAR', bs: 0 }).error, 'opcion');
  assert.equal(act(r, { t: 'PAGAR', bs: 31 }).error, 'opcion');
  assert.equal(act(r, { t: 'PALANCA' }).error, 'opcion');
  const p = ok(r, { t: 'PAGAR', bs: 7 });
  assert.equal(hops(p).pop(), SEG.restinga.ids[0]);
  assert.equal(monPor(p, 'peaje'), -7);
  assert.equal(p.S.isla.peajes.restinga, 7);
  const n = ok(r, { t: 'NO' });
  assert.equal(hops(n).pop(), SEG.w4.ids[0]);
});

test('La Restinga de noche: tarifa doble (tope 50) y el peaje nuevo es la mitad de lo pagado', () => {
  const pre = G.PREV[ID.ME.id][0];
  let st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 80; S.isla.hora = 'noche'; S.isla.peajes.restinga = 4; });
  let r = ok(mover(st, 2), { t: 'CRUZAR', si: true });
  assert.equal(r.S.esp.opc.fee, 8); assert.equal(r.S.esp.opc.tope, 50);
  assert.equal(act(r, { t: 'PAGAR', bs: 7 }).error, 'opcion');
  assert.equal(act(r, { t: 'PAGAR', bs: 51 }).error, 'opcion');
  assert.equal(ok(r, { t: 'PAGAR', bs: 9 }).S.isla.peajes.restinga, 5);
  st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 80; S.isla.apagon = true; S.isla.peajes.restinga = 40; });
  assert.equal(mover(st, 2).S.esp.opc.fee, 50);
});

test('Peaje: con palanca se cruza gratis y el peaje no cambia; sin plata no hay aviso', () => {
  const pre = G.PREV[ID.ME.id][0];
  let st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 12; S.pj.a.items = ['trucado', 'palanca']; S.isla.peajes.restinga = 6; });
  const r = ok(ok(mover(st, 2), { t: 'CRUZAR', si: true }), { t: 'PALANCA' });
  assert.equal(hops(r).pop(), SEG.restinga.ids[0]);
  assert.equal(monPor(r, 'peaje'), 0); assert.equal(r.S.isla.peajes.restinga, 6);
  assert.ok(!r.S.pj.a.items.includes('palanca'));
  st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 5; S.isla.peajes.restinga = 6; });
  const s = mover(st, 2);
  assert.ok(s.fx.some((f) => f.k === 'evento' && f.id === 'sinPeaje'));
  assert.ok(hops(s).includes(SEG.w4.ids[0]));
});

test('La lancha no sale de noche, con mar de leva ni con el Kraken', () => {
  const pre = G.PREV[ID.PP.id].find((i) => G.nodos[i].seg === 'o4b');
  for (const [campo, v, por] of [['hora', 'noche', 'noche'], ['leva', 2, 'leva'], ['kraken', 1, 'kraken']]) {
    const st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 40; S.isla[campo] = v; });
    const r = mover(st, 2);
    assert.ok(!r.S.esp || r.S.esp.k !== 'CRUCE', campo);
    assert.ok(r.fx.some((f) => f.k === 'evento' && f.id === 'lanchaCerrada' && f.p.por === por), campo);
    assert.ok(hops(r).includes(SEG.o5.ids[0]), campo);
  }
  const st = turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 40; });
  const r = mover(st, 2);
  assert.equal(r.S.esp.k, 'CRUCE'); assert.equal(r.S.esp.opc.peaje, 'lancha');
  assert.equal(hops(ok(ok(r, { t: 'CRUZAR', si: true }), { t: 'PAGAR', bs: 1 })).pop(), SEG.lancha.ids[0]);
});

test('El muelle: el ferry a Coche cuesta 5 y no sale con el Kraken', () => {
  const pre = G.PREV[ID.MUELLE.id][0];
  let r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 9; }), 2);
  assert.equal(r.S.esp.k, 'FERRY');
  const f = ok(r, { t: 'FERRY', si: true });
  assert.equal(hops(f).pop(), SEG.ferry.ids[0]); assert.equal(monPor(f, 'ferry'), -5);
  assert.equal(hops(ok(r, { t: 'FERRY', si: false })).pop(), SEG.o4b.ids[0]);
  r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 9; S.isla.kraken = 2; }), 2);
  assert.ok(r.fx.some((x) => x.k === 'evento' && x.id === 'ferryCerrado'));
  assert.ok(hops(r).includes(SEG.o4b.ids[0]));
});

test('Desvío: costa o atajo, y con obras el atajo está cerrado', () => {
  const pre = G.PREV[ID.JG.id][0];
  const r = mover(turnoDe(arrancar(), pre), 2);
  assert.equal(r.S.esp.k, 'DESVIO');
  assert.equal(r.S.esp.opc.venta, 'PLAYA EL AGUA');
  assert.equal(act(r, { t: 'RUTA', a: 999 }).error, 'opcion');
  assert.equal(hops(ok(r, { t: 'RUTA', a: SEG.asuncion.ids[0] })).pop(), SEG.asuncion.ids[0]);
  const o = mover(turnoDe(arrancar(), pre, (S) => { S.isla.obras.O = true; }), 2);
  assert.ok(o.fx.some((x) => x.k === 'evento' && x.id === 'atajoCerrado'));
  assert.ok(hops(o).includes(SEG.agua.ids[0]));
});

test('La señora vende la Empanada de Oro a 20; en la otra isla el Bachaquero cobra la pimpina', () => {
  const nodo = G.PUESTOS.O.nodo, pre = G.PREV[nodo][0];
  let r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 25; }), 1);
  assert.equal(r.S.esp.k, 'EMPANADA');
  const c = ok(r, { t: 'COMPRAR', si: true });
  assert.equal(c.S.pj.a.emp, 1); assert.equal(monPor(c, 'empanada'), -20);
  r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 19; }), 1);
  assert.ok(r.fx.some((x) => x.k === 'evento' && x.id === 'empanadaCara'));
  r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 40; S.isla.senora = 'W'; S.isla.bacha = 'O'; }), 1);
  assert.equal(monPor(r, 'bachaquero'), -30); assert.equal(r.S.pj.a.pimpinas, 1);
});

test('Peñero: la casilla E se lleva a la señora a la otra isla y el Bachaquero se muda', () => {
  const e = G.nodos.find((n) => n.t === 'E' && !n.cruce && !G.nodos[G.PREV[n.id][0]].ramas);
  const r = mover(turnoDe(arrancar(), G.PREV[e.id][0]), 1);
  assert.deepEqual([r.S.isla.senora, r.S.isla.bacha], ['W', 'O']);
  assert.equal(r.S.pj.a.bono.ev, 1);
  assert.ok(r.fx.some((x) => x.k === 'penero' && x.de === 'O' && x.a === 'W'));
});

test('Bodega: compra si cabe y alcanza; con oferta, a mitad de precio', () => {
  const N = G.NPCS.find((x) => x.k === 'bodega'), pre = G.PREV[N.nodo][0];
  let r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 10; S.pj.a.items = ['trucado', 'cafe']; }), 1);
  assert.equal(r.S.esp.k, 'BODEGA');
  assert.deepEqual(r.S.esp.opc.map((o) => o.item), ['cafe', 'trucado', 'palanca', 'colearse']);
  assert.equal(act(r, { t: 'COMPRAR', item: 'mototaxi' }).error, 'opcion');
  const c = ok(r, { t: 'COMPRAR', item: 'colearse' });
  assert.deepEqual(c.S.pj.a.items, ['cafe', 'colearse']); assert.equal(monPor(c, 'bodega'), -10);
  r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.bs = 11; S.isla.oferta = 2; }), 1);
  assert.equal(r.S.esp.opc.find((o) => o.item === 'mototaxi').precio, 11);
  r = mover(turnoDe(arrancar(), pre, (S) => { S.pj.a.items = ['trucado', 'cafe', 'cafe', 'cafe']; }), 1);
  assert.ok(r.fx.some((x) => x.k === 'evento' && x.id === 'bodegaLleno'));
});

test('Pícaro: robar una empanada cuesta 30 y pasa la empanada; la víctima tiene que tenerla', () => {
  const N = G.NPCS.find((x) => x.k === 'picaro');
  let r = mover(turnoDe(arrancar(), G.PREV[N.nodo][0], (S) => { S.pj.a.bs = 40; S.pj.c.emp = 2; }), 1);
  assert.equal(r.S.esp.k, 'PICARO'); assert.deepEqual(r.S.esp.opc, ['plata', 'emp']);
  assert.equal(act(r, { t: 'NEGOCIO', op: 'mango' }).error, 'opcion');
  r = ok(r, { t: 'NEGOCIO', op: 'emp' });
  assert.equal(r.S.esp.k, 'VICTIMA'); assert.deepEqual(r.S.esp.opc.lista, ['c']);
  assert.equal(act(r, { t: 'VICTIMA', s: 'b' }).error, 'objetivo');
  r = ok(r, { t: 'VICTIMA', s: 'c' });
  assert.equal(r.S.pj.a.emp, 1); assert.equal(r.S.pj.c.emp, 1); assert.equal(monPor(r, 'picaro'), -30);
});

test('Calabozo: solo al caer justo; sin fianza pierdes el próximo turno', () => {
  const N = G.NPCS.find((x) => x.k === 'calabozo');
  let r = mover(turnoDe(arrancar(), G.PREV[N.nodo][0], (S) => { S.pj.a.bs = 30; }), 1);
  assert.equal(r.S.esp.k, 'CALABOZO');
  const f = ok(r, { t: 'FIANZA', si: true });
  assert.equal(monPor(f, 'fianza'), -10); assert.equal(f.S.pj.a.pierde, false);
  const p = ok(r, { t: 'FIANZA', si: false });
  assert.equal(p.S.pj.a.pierde, true);
  r = mover(turnoDe(arrancar(), G.PREV[N.nodo][0], (S) => { S.pj.a.bs = 5; }), 1);
  assert.equal(r.S.pj.a.pierde, true);
  r = mover(turnoDe(arrancar(), G.PREV[N.nodo][0], (S) => { S.pj.a.bs = 30; }), 2);
  assert.ok(!r.S.esp || r.S.esp.k !== 'CALABOZO');
});

test('Matasiete: la víctima retrocede 4 casillas; no vale apuntarle a uno en un cruce', () => {
  const N = G.NPCS.find((x) => x.k === 'matasiete');
  const r = mover(turnoDe(arrancar(), G.PREV[N.nodo][0], (S) => { S.pj.b.en = SEG.o5.ids[1]; S.pj.c.en = SEG.lancha.ids[0]; }), 1);
  assert.equal(r.S.esp.k, 'MATASIETE'); assert.deepEqual(r.S.esp.opc, ['b', 'd']);
  assert.equal(act(r, { t: 'PIEDRA', s: 'c' }).error, 'objetivo');
  const p = ok(r, { t: 'PIEDRA', s: 'b' });
  assert.equal(hops(p, 'b').length, 4);
  let n = SEG.o5.ids[1]; for (let i = 0; i < 4; i++) n = G.PREV[n][0];
  assert.equal(p.S.pj.b.en, n);
});

test('Rifa y cañón: la rifa cobra 5 (3 en oferta); el cañón termina el turno en otro lado', () => {
  const sb = G.NPCS.find((x) => x.k === 'sambil');
  let r = mover(turnoDe(arrancar(), G.PREV[sb.nodo][0], (S) => { S.pj.a.bs = 20; S.isla.oferta = 1; }), 1);
  assert.equal(r.S.esp.k, 'RIFA'); assert.equal(r.S.esp.opc.costo, 3);
  const f = ok(r, { t: 'RIFA', si: true });
  assert.ok(f.fx.some((x) => x.k === 'rifa'));
  const cn = G.NPCS.find((x) => x.k === 'canon');
  r = mover(turnoDe(arrancar(), G.PREV[cn.nodo][0]), 5);
  assert.equal(r.S.esp.k, 'CANON'); assert.equal(r.S.t.resto, 4);
  const b = ok(r, { t: 'CANON', si: true });
  assert.ok(b.fx.some((x) => x.k === 'hop' && x.modo === 'canon'));
  assert.ok(!b.fx.some((x) => x.k === 'hop' && x.modo === 'paso'));
});

test('¡BRONCA!: retas a otro, la apuesta es hasta 10; sin plata quedan como panas', () => {
  const base = arrancar();
  let st = aviso(base, 'BRONCA', ['b', 'c', 'd'], (S) => { S.pj.a.bs = 30; S.pj.c.bs = 6; });
  assert.equal(act(st, { t: 'RETAR', s: 'a' }).error, 'objetivo');
  const r = ok(st, { t: 'RETAR', s: 'c' });   // c es CPU y a es humano: duelo en vivo 1v1
  assert.equal(r.S.f, 'carta'); assert.equal(r.S.mj.tipo, '1v1'); assert.deepEqual(r.S.mj.as, ['a', 'c']);
  assert.equal(r.S.mj.duelo.apuesta, 6); assert.ok(R.DUELOS.includes(r.S.mj.cola[0].g));
  let m = ok(r, { t: 'LISTO' });
  assert.equal(m.S.f, 'mj');
  m = R.aplicar(m.S, m.priv, '$', { t: 'MJ_RESULTADO', k: m.S.mj.k, sc: [5, 2] }, NOW); assert.ifError(m.error);
  assert.equal(monPor(m, 'bronca', 'a'), 6); assert.equal(monPor(m, 'bronca', 'c'), -6);
  m = R.tick(m.S, m.priv, m.S.nextAt);
  assert.equal(m.S.f, 'turno');
  st = aviso(base, 'BRONCA', ['b', 'c', 'd'], (S) => { S.pj.c.bs = 0; });
  const p = ok(st, { t: 'RETAR', s: 'c' });
  assert.ok(p.fx.some((x) => x.k === 'evento' && x.id === 'broncaPelaos')); assert.equal(p.S.mj, null);
});

test('Minijuego de ronda: formato por color, +10 a los ganadores (+15 en carnaval) y bono.mj', () => {
  const st = arrancar();
  const S = J(st.S); S.t = { s: 'd', resto: 0, q: [{ k: 'fin' }], ctx: null, extra: 0 }; S.esp = null;
  S.pj.a.color = 'azul'; S.pj.b.color = 'azul'; S.pj.c.color = 'rojo'; S.pj.d.color = 'rojo';
  S.esp = { id: S.ver, s: 'd', k: 'CANON', opc: {}, hasta: NOW };
  const P = J(st.priv); P.cpuAt = NOW;   // d es el último del orden: al terminar su turno viene el minijuego
  let r = R.tick(S, P, NOW + 1e6); assert.ifError(r.error);
  assert.equal(r.S.f, 'carta'); assert.equal(r.S.mj.tipo, '2v2'); assert.deepEqual(r.S.mj.eq, [['a', 'b'], ['c', 'd']]);
  assert.equal(r.S.mj.juez, 'a');
  r = R.tick(r.S, r.priv, r.S.mj.cartaHasta);
  r = R.aplicar(r.S, r.priv, '$', { t: 'MJ_RESULTADO', k: r.S.mj.k, sc: [3, 4, 1, 1] }, NOW); assert.ifError(r.error);
  assert.equal(monPor(r, 'mj', 'a'), 10); assert.equal(monPor(r, 'mj', 'b'), 10); assert.equal(monPor(r, 'mj', 'c'), 0);
  assert.equal(r.S.pj.a.bono.mj, 10);
  const S2 = J(S); S2.isla.carnaval = true;
  let c = R.tick(S2, P, NOW + 1e6);
  assert.equal(c.S.mj.tipo, 'ffa');
  c = R.tick(c.S, c.priv, c.S.mj.cartaHasta);
  c = R.tick(c.S, c.priv, c.S.mj.cierre);
  assert.ok(c.fx.some((x) => x.k === 'mjRes' && x.empate), 'sin resultado al cierre: empate y nadie cobra');
  assert.equal(c.fx.filter((x) => x.k === 'mon').length, 0);
});

test('AFK: dos plazos vencidos y el asiento pasa a la CPU; VOLVER lo devuelve', () => {
  let r = arrancar();
  r = R.tick(r.S, r.priv, r.S.esp.hasta); assert.ifError(r.error);
  assert.equal(r.S.pj.a.afk, 1); assert.equal(r.S.pj.a.cpu, null);
  const s2 = turnoDe(r, ID.POR.id);
  r = R.tick(s2.S, s2.priv, s2.S.esp.hasta);
  assert.equal(r.S.pj.a.cpu, 'afk'); assert.ok(r.fx.some((x) => x.k === 'afk'));
  const v = R.aplicar(r.S, r.priv, 'a', { t: 'VOLVER' }, NOW); assert.ifError(v.error);
  assert.equal(v.S.pj.a.cpu, null); assert.equal(v.S.pj.a.afk, 0);
});

test('Recta final y fin: la tía de Miami ayuda al último; las empanadas extra van a todos los empatados', () => {
  let { S, priv } = R.crear(11, { tot: 6 }, [], NOW), now = NOW, tia = 0;
  while (S.f !== 'fin') {
    now = Math.max(now, S.nextAt); const r = R.tick(S, priv, now); if (r.nada) { now += 50; continue; }
    const D = J(S);
    for (const f of r.fx) {
      if (f.k === 'evento' && f.id === 'tiaDeMiami') {
        tia++;
        assert.equal(D.r, R.finalR(D));
        const peor = Object.keys(D.pj).sort((a, b) => D.pj[a].emp - D.pj[b].emp || D.pj[a].bs - D.pj[b].bs)[0];
        assert.equal(f.s, peor); assert.ok(['mototaxi', 'guarapo', 'trucado'].includes(f.p.item));
      }
      if (f.k === 'bonusFin') {
        const top = Math.max(...Object.values(D.pj).map((p) => p.bono[f.id]));
        assert.equal(f.top, top);
        assert.deepEqual(f.ganan, Object.keys(D.pj).filter((s) => D.pj[s].bono[f.id] === top));
      }
      R.aplicaFx(D, f);
    }
    S = r.S; priv = r.priv;
  }
  assert.equal(tia, 1);
  assert.equal(S.podio[0].s, S.ganador);
});

test('Casillas: azul +3, roja −3; doble en carnaval y en la recta final; aguacero, turistas y sin agua', () => {
  for (let sem = 1; sem <= 25; sem++) {
    let { S, priv } = R.crear(sem, { tot: 10 }, [], NOW), now = NOW;
    while (S.f !== 'fin') {
      now = Math.max(now, S.nextAt); const r = R.tick(S, priv, now); if (r.nada) { now += 50; continue; }
      const D = J(S);
      for (const f of r.fx) {
        if (f.k === 'mon' && f.por === 'azul') {
          const I = D.isla, x2 = (I.carnaval ? 2 : 1) * (I.final ? 2 : 1);
          assert.equal(f.d, (3 + (I.turistas ? 2 : 0)) * x2, 'azul en ronda ' + D.r);
        }
        if (f.k === 'mon' && f.por === 'roja') {
          const I = D.isla, v = -(I.lluvia ? 6 : 3) * (I.final ? 2 : 1);
          assert.equal(f.d, Math.max(v, -D.pj[f.s].bs), 'roja en ronda ' + D.r);
        }
        if (f.k === 'dado' && f.de === 'd10') assert.ok(f.v >= 1 && f.v <= (D.isla.lluvia ? 6 : 10));
        R.aplicaFx(D, f);
      }
      S = r.S; priv = r.priv;
    }
  }
});

test('vista: solo el del turno ve el aviso; el resto no puede jugar', () => {
  const st = arrancar();
  assert.equal(R.vista(st.S, 'a').mio, true); assert.equal(R.vista(st.S, 'a').esp.k, 'DADO');
  assert.equal(R.vista(st.S, 'b').mio, false); assert.equal(R.vista(st.S, 'b').esp, null);
});

test('Secretos del mapa: +3 Bs cada uno, una sola vez, y una empanada al encontrar los 8', () => {
  let r = arrancar();
  assert.equal(R.aplicar(r.S, r.priv, 'a', { t: 'SECRETO', n: 8 }, NOW).error, 'opcion');
  for (let n = 0; n < 8; n++) { r = R.aplicar(r.S, r.priv, 'a', { t: 'SECRETO', n }, NOW); assert.ifError(r.error); }
  assert.equal(r.S.pj.a.bs, 10 + 24); assert.equal(r.S.pj.a.emp, 1);
  const otra = R.aplicar(r.S, r.priv, 'a', { t: 'SECRETO', n: 3 }, NOW);
  assert.ifError(otra.error); assert.equal(otra.S.pj.a.bs, 34);
});

test('resp: cada respuesta a un aviso sale como efecto, sin eid ni aid', () => {
  const r = ok(arrancar(), { t: 'TIRAR', aid: 'z' });
  assert.deepEqual(r.fx[0], { k: 'resp', s: 'a', e: 'DADO', a: { t: 'TIRAR' } });
});

test('Casilla M: en línea es una ruleta; en local (cfg.micro) el humano reporta si ganó el microjuego', () => {
  const m = G.nodos.find((n) => n.t === 'M' && !n.cruce && !G.nodos[G.PREV[n.id][0]].ramas && !G.nodos[G.PREV[n.id][0]].lugar);
  let r = mover(turnoDe(arrancar({ micro: true }), G.PREV[m.id][0]), 1);
  assert.equal(r.S.esp.k, 'MICRO');
  assert.equal(monPor(ok(r, { t: 'MICRO', gana: true }), 'micro'), 10);
  assert.equal(monPor(ok(r, { t: 'MICRO', gana: false }), 'micro'), 0);
  r = mover(turnoDe(arrancar(), G.PREV[m.id][0]), 1);
  assert.ok(r.fx.some((x) => x.k === 'evento' && x.id === 'micro'));
});
