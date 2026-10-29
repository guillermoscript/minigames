'use strict';
/* LA FIESTA · M3-TEAMS (docs/mario-party/M3-TEAMS-SPEC.md): la tubería de los formatos de equipo (2v2 y 1v3) que NO depende de los juegos reales.
   Catálogo, formarMJ (qué juego elige y cuándo degrada), puntaje binario (puestos/pagos), LIVE.add, contexto de equipo (rol/mate/rivales),
   HUD de equipo, práctica 2v2/1v3, LIVE.sim, retraso de justicia del juez con equipos, y la consistencia catálogo <-> archivos <-> fiesta.html.
   Los juegos de aquí son de mentira y usan ids del catálogo SIN runtime (f_cuerda 2v2 C, f_cava 2v2 B, f_bono 1v3 B). */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const SL = path.join(__dirname, '..', 'docs/style-lab');

globalThis.window = globalThis;
const LIVE = require(path.join(SL, 'fiesta-live.js'));
globalThis.FIESTA.rng = require(path.join(SL, 'fiesta-rng.js'));
const R = globalThis.FIESTA.reglas = require(path.join(SL, 'fiesta-reglas.js'));
const CA = require(path.join(SL, 'fiesta-carta.js'));
const NOW = 1e12, J = (x) => JSON.parse(JSON.stringify(x));
const cat = (g) => R.CATALOGO.filter((x) => x.g === g)[0];
/* el catálogo es un objeto compartido: se cambia durante fn y se deja como estaba */
function conCatalogo(parches, fn) {
  // Aislamiento: estas pruebas verifican el reparto con futbolito/patilla; los demás juegos de equipo en vivo (cava, alcabala, hallacas, bono) se apagan salvo que la prueba los pida.
  const AISLAR = ['f_cava', 'f_alcabala', 'f_hallacas', 'f_bono', 'f_guaya', 'f_silbon'].filter((g) => !parches.some(([x]) => x === g)).map((g) => [g, { live: undefined }]);
  parches = AISLAR.concat(parches);
  const antes = parches.map(([g, p]) => { const c = cat(g), a = {}; Object.keys(p).forEach((k) => { a[k] = c[k]; c[k] = p[k]; }); return [c, a]; });
  try { return fn(); } finally { antes.forEach(([c, a]) => Object.keys(a).forEach((k) => { if (a[k] === undefined) delete c[k]; else c[k] = a[k]; })); }
}

/* ───────────── juegos de mentira ───────────── */
const lim = (o) => Object.assign({ scoreMax: 1000, scoreRate: 40, minT: 3, finTemprano: 1 }, o);
const cartaBase = { obj: 'x', gana: 'y', como: { tactil: 'A', teclado: 'ESPACIO' }, demos: [{ id: 'mover', txt: 'z' }] };
const cartaRoles = Object.assign({}, cartaBase, { roles: { solo: { obj: 'ERES EL SOLO', como: { tactil: 'A solo', teclado: 'ESPACIO solo' } }, trio: { obj: 'ERES DEL TRÍO', como: { tactil: 'A trío', teclado: 'ESPACIO trío' } } } });

/* f_cuerda · 2v2 · C: cada A suma un punto a quien lo pulsa; la CPU pulsa con probabilidad ~ habilidad. El marcador del equipo es la suma. */
LIVE.add('f_cuerda', {
  name: 'CUERDA FALSA', modos: ['2v2'], clase: 'binary', modelo: 'C', dur: 12, botones: 1, migra: true, limites: lim(), carta: cartaBase, packN: 6, packDiscretos: [0],
  mk(c) {
    const sc = [0, 0, 0, 0], rs = [0, 1, 2, 3].map((p) => c.rngFor('cpu' + p)); let k = 0;
    const g = {
      sc, hudChip: (p) => 'G' + sc[p], destacado: () => 'ganó ' + c.equipos.join(''),
      ai(p, dt, api) { if (rs[p].next() < 0.12 * c.skill[p]) api.press('a'); },
      step(dt) { for (let p = 0; p < c.n; p++) sc[p] += c.tap(p, 'a'); k++; },
      update() {}, draw() {}, scores: () => sc.slice(), done: () => false,
      pack: () => [k].concat(sc, 0), unpack(a) { k = a[0]; for (let p = 0; p < 4; p++) sc[p] = a[1 + p]; }, restore(a) { g.unpack(a); }, predict() {},
      vista: () => ({ sc: sc.slice(), eq: c.equipos.slice(), rol: [0, 1, 2, 3].map((p) => c.rol(p)), mate: [0, 1, 2, 3].map((p) => c.mate(p)) })
    };
    return g;
  }
});
/* f_cava · 2v2 · B */
LIVE.add('f_cava', {
  name: 'CAVA FALSA', modos: ['2v2'], clase: 'binary', modelo: 'B', dur: 12, botones: 1, migra: true, limites: lim(cat('f_cava').lim), carta: cartaBase,
  cuerpo: ['g'], discretos: ['g'],
  mk(c) {
    const sc = [0, 0, 0, 0], rs = [0, 1, 2, 3].map((p) => c.rngFor('cpu' + p));
    return { ai(p, dt, api) { if (rs[p].next() < 0.1 * c.skill[p]) api.press('a'); }, update() { for (let p = 0; p < c.n; p++) if (c.mio(p)) sc[p] += c.tap(p, 'a'); },
      draw() {}, scores: () => sc.slice(), cuerpo: (p) => ({ g: sc[p] }), alRemoto(p, v) { sc[p] = v.g; } };
  }
});
/* f_bono · 1v3 · B de umbral: el solo gana con >= 3 aciertos. sc[solo]=10·hits, sc[trío]=25 constante. */
LIVE.add('f_bono', {
  name: 'BONO FALSO', modos: ['1v3'], clase: 'binary', modelo: 'B', dur: 12, botones: 1, migra: true, limites: lim(cat('f_bono').lim), carta: cartaRoles,
  cuerpo: ['h'], discretos: ['h'],
  mk(c) {
    const soloI = c.solo >= 0 ? c.solo : 0; let hits = 0; const rs = [0, 1, 2, 3].map((p) => c.rngFor('cpu' + p));
    return { ai(p, dt, api) { if (p === soloI && rs[p].next() < 0.009 * (0.4 + c.skill[p])) api.press('a'); },
      update() { if (c.mio(soloI)) hits += c.tap(soloI, 'a'); }, draw() {},
      scores: () => [0, 1, 2, 3].map((p) => (p === soloI ? 10 * hits : 25)), hudChip: (p) => (p === soloI ? hits + '/3' : 'LIMPIO'),
      cuerpo: (p) => ({ h: p === soloI ? hits : 0 }), alRemoto(p, v) { if (p === soloI) hits = v.h; } };
  }
});

/* ───────────── catálogo y consistencia ───────────── */
test('catálogo: futbolito (2v2 C) y patilla (1v3 B) traen los topes de la spec y son binary', () => {
  assert.deepEqual(cat('f_futbolito'), Object.assign({ g: 'f_futbolito', m: ['2v2'], cl: 'binary', dur: 60, mo: 'C', lim: { scoreMax: 15, scoreRate: 0.5, minT: 44, finTemprano: 1 } }, cat('f_futbolito').live ? { live: 1 } : {}));
  assert.deepEqual(cat('f_patilla'), { g: 'f_patilla', m: ['1v3'], cl: 'binary', dur: 35, mo: 'B', live: 1, lim: { scoreMax: 90, scoreRate: 12, minT: 6, finTemprano: 1 } });
  R.CATALOGO.filter((x) => x.m.indexOf('2v2') >= 0 || x.m.indexOf('1v3') >= 0).forEach((x) => assert.equal(x.cl, 'binary', x.g + ' de equipo => binary'));
  // un juego en vivo de cualquier formato lleva los topes que el servidor valida, y el minT cabe en la duración
  R.CATALOGO.filter((x) => x.live).forEach((x) => { assert.ok(x.lim && x.lim.scoreMax > 0 && x.lim.scoreRate > 0 && x.lim.minT < x.dur, x.g + ' lim'); });
});
test('catálogo: todo juego live:1 tiene su archivo y su <script> en fiesta.html (y no hay <script> de juegos fantasma)', () => {
  const html = fs.readFileSync(path.join(SL, 'fiesta.html'), 'utf8'), tags = [];
  html.replace(/<script src="(fiesta-juego-[a-z0-9_]+\.js)(?:\?[^"]*)?"/g, (m, f) => { tags.push(f); });
  R.CATALOGO.filter((x) => x.live).forEach((x) => {
    const f = 'fiesta-juego-' + x.g.replace(/^f_/, '') + '.js';
    assert.ok(fs.existsSync(path.join(SL, f)), x.g + ': falta ' + f);
    assert.ok(tags.indexOf(f) >= 0, x.g + ': fiesta.html no carga ' + f + ' (la ronda elegiría un juego sin runtime en el cliente)');
  });
  tags.forEach((f) => assert.ok(fs.existsSync(path.join(SL, f)), 'fiesta.html carga ' + f + ' que no existe'));
  const orden = html.split('\n').filter((l) => /fiesta-(live|juego-)/.test(l)).map((l) => /fiesta-[a-z-]+\.js|fiesta-juego-[a-z0-9_]+\.js/.exec(l)[0]);
  assert.equal(orden[0], 'fiesta-live.js', 'el runtime se carga antes que cualquier juego');
});

/* ───────────── formarMJ: 2v2 y 1v3 eligen juegos EN VIVO y solo degradan si no hay ninguno ───────────── */
function arrancar() {
  let { S, priv } = R.crear(7, {}, [{ name: 'ANA', ch: 'mama' }, { name: 'BETO', ch: 'tio' }], NOW);
  let r = R.aplicar(S, priv, 'a', { t: 'COMMIT', k: 'orden', eid: S.esp.id, aid: 'o1' }, NOW); assert.ifError(r.error);
  r = R.aplicar(r.S, r.priv, 'b', { t: 'COMMIT', k: 'orden', eid: r.S.esp.id, aid: 'o2' }, NOW); assert.ifError(r.error);
  return r;
}
// Casillas de una sola salida que terminan en azul / roja: el color de `a` sale de dónde cae; el de b, c y d se fija en el estado.
const SALIDA_A = { a: 'ccs_petare', r: null };
(function () {
  const NOD = R.mapa.nodos, ADY = R.mapa.ady;
  Object.keys(ADY).forEach((x) => { if (ADY[x].length === 1 && x !== 'ccs_start') { const ty = NOD[ADY[x][0]].t; if (ty === 'azul' && !SALIDA_A.a2) SALIDA_A.a2 = x; if (ty === 'roja' && !SALIDA_A.r) SALIDA_A.r = x; } });
})();
function minijuegoSt(colores) {
  const base = arrancar(), S = J(base.S), P = J(base.priv), desde = colores[0] === 'a' ? SALIDA_A.a2 : SALIDA_A.r;
  S.f = 'turno'; S.mj = null; S.pj.a.nodo = desde; S.pj.a.obj = ['medida', null, null]; S.orden = ['b', 'c', 'd', 'a'];
  S.t = { s: 'a', paso: 'pre', resto: 0, usado: 0, mod: null, pend: [], cas: 0, compro: 0, compras: 0, desde: desde };
  S.esp = { id: S.ver, s: 'a', k: 'DADO', opc: ['TIRAR'], hasta: NOW + 20000 };
  S.estrella.nodo = 'roq_cayoagua';
  ['b', 'c', 'd'].forEach((s, i) => { S.pj[s].col = colores[i + 1]; });
  let r = R.aplicar(S, P, 'a', { t: 'USAR', slot: 0, n: 1, eid: S.esp.id }, NOW); assert.ifError(r.error);
  const r2 = R.aplicar(r.S, r.priv, 'a', { t: 'TIRAR', eid: r.S.esp.id }, NOW); assert.ifError(r2.error);
  assert.equal(r2.S.f, 'carta', 'desde ' + desde + ' => ' + r2.S.f);
  assert.equal(r2.S.pj.a.col, colores[0], 'el color de a sale de la casilla donde cae');
  return r2;
}
const minijuego = (colores) => minijuegoSt(colores).S.mj;
test('formarMJ: con juegos de equipo en vivo, 2 azules + 2 rojos => 2v2 y 1+3 => 1v3 con su juego, binary, juez humano y el solo al final', () => {
  conCatalogo([['f_futbolito', { live: 1 }]], () => {
    const mj = minijuego(['a', 'a', 'r', 'r']);
    assert.equal(mj.tipo, '2v2'); assert.deepEqual(mj.eq, [['a', 'b'], ['c', 'd']]); assert.equal(mj.solo, null);
    assert.equal(mj.cola[0].g, 'f_futbolito'); assert.equal(mj.clase, 'binary'); assert.equal(mj.cola[0].dur, 60); assert.equal(mj.cola[0].modelo, 'C');
    assert.deepEqual(R.eqIdx(mj), [0, 0, 1, 1]); assert.deepEqual(R.eqIdx(mj), R.equipos('2v2', 4));
    assert.ok(['a', 'b'].indexOf(mj.juez) >= 0);
    const m3 = minijuego(['r', 'a', 'r', 'r']);
    assert.equal(m3.tipo, '1v3'); assert.equal(m3.solo, 'b'); assert.deepEqual(m3.eq, [['b'], ['a', 'c', 'd']]);
    assert.equal(m3.cola[0].g, 'f_patilla'); assert.equal(m3.clase, 'binary'); assert.equal(m3.cola[0].dur, 35); assert.equal(m3.cola[0].modelo, 'B');
    assert.equal(m3.juez, 'a', 'el solo (humano) queda al final de los candidatos a juez'); assert.deepEqual(m3.suc, ['b']);
    assert.deepEqual(R.eqIdx(m3), R.equipos('1v3', 4, m3.as.indexOf('b')), 'eqIdx == equipos()');
  });
});
test('formarMJ: si ningún juego en vivo admite el formato, degrada a ffa (como en M2); si lo admite, ya no degrada', () => {
  conCatalogo([['f_futbolito', { live: undefined }]], () => {
    const mj = minijuego(['a', 'a', 'r', 'r']);
    assert.equal(mj.tipo, 'ffa', '2v2 sin juego en vivo => 4P'); assert.notEqual(mj.cola[0].g, 'f_futbolito'); assert.equal(mj.clase, cat(mj.cola[0].g).cl);
  });
  conCatalogo([['f_patilla', { live: undefined }]], () => {
    const mj = minijuego(['r', 'a', 'r', 'r']);
    assert.equal(mj.tipo, 'ffa', '1v3 sin juego en vivo => 4P'); assert.equal(mj.solo, null);
  });
  conCatalogo([['f_futbolito', { live: undefined }], ['f_cava', { live: 1 }]], () => {
    const mj = minijuego(['a', 'a', 'r', 'r']);
    assert.equal(mj.tipo, '2v2'); assert.equal(mj.cola[0].g, 'f_cava', 'basta añadir live:1 a un juego 2v2 del catálogo para que reemplace la degradación');
  });
});
test('formarMJ: con 3 o menos asientos o todos del mismo color sigue siendo 4P (los formatos de equipo exigen 2+2 o 1+3)', () => {
  conCatalogo([['f_futbolito', { live: 1 }]], () => { assert.equal(minijuego(['a', 'a', 'a', 'a']).tipo, 'ffa'); assert.equal(minijuego(['r', 'r', 'r', 'r']).tipo, 'ffa'); });
});

/* ───────────── puntaje binario: el veredicto sale SOLO de compara ───────────── */
test('puestos/pagos binary: 2v2 suma por equipo, 1v3 de umbral sin empates, 1v3 de media con empate posible', () => {
  const eq22 = [0, 0, 1, 1], eq13 = [0, 1, 1, 1];
  assert.deepEqual(R.puestos('2v2', eq22, [3, 1, 2, 0], 'binary'), [1, 1, 2, 2]);
  assert.deepEqual(R.puestos('2v2', eq22, [2, 1, 0, 3], 'binary'), [1, 1, 1, 1], 'mismo total => empate');
  assert.deepEqual(R.puestos('2v2', eq22, [0, 0, 0, 0], 'binary'), [1, 1, 1, 1]);
  // umbral: sc[solo] = 10·v, sc[trío] = 25 => gana el solo SII v >= 3, nunca hay empate (10·v = 25 es imposible)
  for (let v = 0; v <= 9; v++) {
    const pl = R.puestos('1v3', eq13, [10 * v, 25, 25, 25], 'binary');
    assert.deepEqual(pl, v >= 3 ? [1, 2, 2, 2] : [2, 1, 1, 1], 'v=' + v);
    assert.notDeepEqual(pl, [1, 1, 1, 1]);
  }
  // el solo en cualquier asiento
  assert.deepEqual(R.puestos('1v3', [1, 1, 0, 1], [25, 25, 30, 25], 'binary'), [2, 2, 1, 2]);
  // 1v3 donde el trío sí puntúa (media): 6 vs media 5 gana el solo; 5 vs 5 empata
  assert.deepEqual(R.puestos('1v3', eq13, [6, 9, 3, 3], 'binary'), [1, 2, 2, 2]);
  assert.deepEqual(R.puestos('1v3', eq13, [5, 9, 3, 3], 'binary'), [1, 1, 1, 1]);
  assert.deepEqual(R.pagosMJ('2v2', [1, 1, 2, 2], 1, { tot: 15 }), [7, 7, 2, 2]);
  assert.deepEqual(R.pagosMJ('1v3', [1, 2, 2, 2], 1, { tot: 15, solo: 0 }), [12, 0, 0, 0]);
  assert.deepEqual(R.pagosMJ('1v3', [2, 1, 1, 1], 1, { tot: 15, solo: 0 }), [0, 4, 4, 4]);
});
test('resultadoMJ (MJ_RESULTADO del servidor): 2v2 y 1v3 pagan por sc con el solo correcto; un `pl` ausente se recalcula con compara', () => {
  const casos = [
    [['a', 'a', 'r', 'r'], [3, 1, 2, 0], [1, 1, 2, 2], [7, 7, 2, 2]],
    [['a', 'a', 'r', 'r'], [2, 2, 2, 2], [1, 1, 1, 1], [4, 4, 4, 4]],
    [['r', 'a', 'r', 'r'], [25, 30, 25, 25], [2, 1, 2, 2], [0, 12, 0, 0]],       // el solo es b: 3 golpes
    [['r', 'a', 'r', 'r'], [25, 20, 25, 25], [1, 2, 1, 1], [4, 0, 4, 4]]];       // 2 golpes: gana el trío
  conCatalogo([['f_futbolito', { live: 1 }]], () => casos.forEach(([colores, sc, pu, pg]) => {
    let r = minijuegoSt(colores); const mj = r.S.mj;
    r = R.aplicar(r.S, r.priv, 'a', { t: 'LISTO' }, NOW); r = R.aplicar(r.S, r.priv, 'b', { t: 'LISTO' }, NOW); assert.equal(r.S.f, 'mj');
    const antes = ['a', 'b', 'c', 'd'].map((s) => r.S.pj[s].mon);
    const ok = R.aplicar(r.S, r.priv, '$', { t: 'MJ_RESULTADO', k: mj.k, i: 0, sc: sc }, NOW); assert.ifError(ok.error);
    const fx = ok.fx.find((f) => f.k === 'mjRes');
    assert.deepEqual(fx.puestos, pu, mj.tipo + ' ' + sc); assert.deepEqual(fx.pagos, pg.map((v) => v * (r.S.r % 5 === 0 && r.S.r !== r.S.tot ? 2 : 1)));
    ['a', 'b', 'c', 'd'].forEach((s, i) => assert.equal(ok.S.pj[s].mon, antes[i] + fx.pagos[i]));
    assert.deepEqual(ok.S.mj.res.puestos, pu); assert.equal(ok.S.mj.res.aj, false);
  }));
});

/* ───────────── LIVE.add: contrato de los formatos de equipo ───────────── */
test('LIVE.add: 2v2/1v3 exigen clase binary; un 1v3 exige carta.roles.solo/trio con obj y como; modos desconocidos se rechazan', () => {
  const base = (o) => Object.assign({ name: 'T', modos: ['2v2'], clase: 'binary', modelo: 'B', dur: 10, botones: 1, migra: true, limites: lim(), carta: cartaBase, cuerpo: ['x'], mk() {} }, o);
  assert.throws(() => LIVE.add('f_zz_a', base({ clase: 'rank' })), /binary/);
  assert.throws(() => LIVE.add('f_zz_b', base({ modos: ['1v3'], clase: 'rank', carta: cartaRoles })), /binary/);
  assert.throws(() => LIVE.add('f_zz_c', base({ modos: ['1v3'] })), /roles/, 'un 1v3 sin roles');
  assert.throws(() => LIVE.add('f_zz_d', base({ modos: ['1v3'], carta: Object.assign({}, cartaBase, { roles: { solo: { obj: 'a', como: {} } } }) })), /roles/, 'falta el rol trio');
  assert.throws(() => LIVE.add('f_zz_e', base({ modos: ['1v3'], carta: Object.assign({}, cartaBase, { roles: { solo: { obj: 'a' }, trio: { obj: 'b', como: {} } } }) })), /roles/, 'rol sin `como`');
  assert.throws(() => LIVE.add('f_zz_f', base({ modos: ['3v3'] })), /modo/);
  assert.throws(() => LIVE.add('f_zz_g', base({ modos: [] })), /modos/);
  assert.ok(LIVE.add('f_zz_h', base({ modos: ['2v2'] })), 'un 2v2 binary no necesita roles');
  assert.ok(LIVE.add('f_zz_i', base({ modos: ['1v3'], carta: cartaRoles })));
  assert.ok(LIVE.add('f_zz_j', base({ modos: ['ffa', '1v1'], clase: 'rank' })), 'ffa/1v1 siguen igual (M2)');
});

/* ───────────── práctica ───────────── */
const lineas = (h) => h.items.map((x) => [x.i, x.team, x.rol, x.mate, x.cpu]);
test('practice 2v2: tú + un pana CPU contra 2 CPU; yo = a, contexto con equipos y vistas de rol/mate', () => {
  const p = LIVE.practice('f_cuerda', { seed: 5, ch: 'mama' }), c = p.sess.c, mj = p.sess.def && p.sess;
  assert.equal(c.n, 4); assert.equal(c.modo, '2v2'); assert.deepEqual(c.equipos, [0, 0, 1, 1]); assert.equal(c.solo, -1); assert.equal(c.yo, 0);
  assert.deepEqual([0, 1, 2, 3].map(c.rol), ['eq0', 'eq0', 'eq1', 'eq1']); assert.deepEqual([0, 1, 2, 3].map(c.mate), [1, 0, 3, 2]);
  assert.deepEqual(c.mates(0), [1]); assert.deepEqual(c.rivales(0), [2, 3]); assert.deepEqual(c.rivales(3), [0, 1]);
  assert.deepEqual(c.cpu, [false, true, true, true], 'solo yo soy humano');
  assert.deepEqual(c.seats.map((x) => x.rol), ['eq0', 'eq0', 'eq1', 'eq1']);
  const h = p.hud();
  assert.equal(h.tipo, '2v2'); assert.equal(h.solo, -1);
  assert.deepEqual(lineas(h), [[0, 0, 'eq0', false, false], [1, 0, 'eq0', true, true], [2, 1, 'eq1', false, true], [3, 1, 'eq1', false, true]], 'el pana es la ficha 1');
  assert.ok(mj); p.close();
  // el juego corre: tu A suma a TU asiento y el HUD enseña el marcador del EQUIPO (tsc) y el hudChip
  const q = LIVE.practice('f_cuerda', { seed: 5 });
  for (let i = 0; i < 6; i++) q.update(1 / 30);
  q.in.tap('a'); q.in.tap('a'); q.update(1 / 30); q.update(1 / 30);
  const sc = q.sess.g.sc, hq = q.hud();
  assert.ok(sc[0] >= 2, 'mis dos toques son míos'); assert.equal(hq.items[0].tsc, sc[0] + sc[1]); assert.equal(hq.items[1].tsc, sc[0] + sc[1]); assert.equal(hq.items[2].tsc, sc[2] + sc[3]);
  assert.equal(hq.items[0].txt, 'G' + sc[0]); assert.equal(hq.items[0].sc, sc[0]);
  q.close();
});
test('practice 1v3: rol solo (a) por defecto, rol trio => el solo es b (CPU) y tú del trío; hudChip del juego manda en la ficha', () => {
  const s = LIVE.practice('f_bono', { seed: 9 }), cs = s.sess.c;
  assert.equal(cs.modo, '1v3'); assert.equal(cs.solo, 0); assert.deepEqual(cs.equipos, [0, 1, 1, 1]); assert.deepEqual([0, 1, 2, 3].map(cs.rol), ['solo', 'trio', 'trio', 'trio']);
  assert.deepEqual(cs.cpu, [false, true, true, true]); assert.equal(cs.mate(0), -1, 'mate solo existe en 2v2'); assert.deepEqual(cs.mates(1), [2, 3]); assert.deepEqual(cs.rivales(1), [0]);
  s.update(1 / 30); s.in.tap('a'); s.update(1 / 30); s.update(1 / 30);
  const hs = s.hud(); assert.equal(hs.tipo, '1v3'); assert.equal(hs.solo, 0); assert.equal(hs.items[0].txt, '1/3'); assert.equal(hs.items[1].txt, 'LIMPIO');
  assert.deepEqual(s.sess.g.scores(), [10, 25, 25, 25], 'el HUD no enseña estos números: manda hudChip');
  s.close();
  const t = LIVE.practice('f_bono', { seed: 9, rol: 'trio' }), ct = t.sess.c;
  assert.equal(ct.yo, 0); assert.equal(ct.solo, 1); assert.deepEqual(ct.equipos, [1, 0, 1, 1]); assert.equal(ct.rol(0), 'trio'); assert.equal(ct.rol(1), 'solo');
  assert.deepEqual(ct.cpu, [false, true, true, true]); assert.equal(t.hud().items[1].rol, 'solo'); t.close();
});
test('practice de juegos con ffa/1v1 (M2) queda intacta: duelo 1v1 contra una CPU', () => {
  require(path.join(SL, 'fiesta-juego-mecate.js'));
  const p = LIVE.practice('f_mecate', { seed: 3 }), c = p.sess.c;
  assert.equal(c.n, 2); assert.equal(c.modo, '1v1'); assert.deepEqual(c.equipos, [0, 1]); assert.equal(c.solo, -1); assert.deepEqual(c.cpu, [false, true]);
  assert.deepEqual(c.rivales(0), [1]); assert.deepEqual(c.mates(0), []); assert.equal(c.mate(0), -1); assert.equal(c.rol(0), 'ffa');
  const h = p.hud(); assert.equal(h.tipo, '1v1'); assert.ok(h.items.every((x) => x.mate === false && x.txt === null));
  p.close();
});
test('practice: un juego solo de equipo no admite formatos que no tiene (sim con tipo ffa => error claro)', () => {
  assert.throws(() => LIVE.sim('f_cuerda', { tipo: 'ffa', seed: 1 }), /formato/);
  assert.throws(() => LIVE.sim('f_bono', { tipo: '2v2', seed: 1 }), /formato/);
  assert.throws(() => LIVE.sim('f_noexiste', { seed: 1 }), /no registrado/);
});

/* ───────────── LIVE.sim: partida completa con 4 CPU, sin red ───────────── */
test('LIVE.sim: determinista (mismo seed => mismo sc/pl/h), usa el veredicto real (hash + puestos de equipo) y dice quién ganó', () => {
  const a = LIVE.sim('f_cuerda', { seed: 11, skill: 0.6 }), b = LIVE.sim('f_cuerda', { seed: 11, skill: 0.6 }), c = LIVE.sim('f_cuerda', { seed: 12, skill: 0.6 });
  assert.deepEqual(a, b, 'determinista'); assert.notDeepEqual(a.sc, c.sc);
  assert.equal(a.tipo, '2v2'); assert.deepEqual(a.eq, [0, 0, 1, 1]); assert.equal(a.fin, true);
  assert.deepEqual(a.pl, R.puestos('2v2', a.eq, a.sc, 'binary'), 'los puestos salen de compara');
  assert.equal(a.h, R.hashRes(a.sc, a.pl, a.kk)); assert.equal(a.kk, 12 * 30);
  assert.ok(a.sc.every((v) => Number.isInteger(v) && v >= 0));
  const e0 = a.sc[0] + a.sc[1], e1 = a.sc[2] + a.sc[3];
  assert.equal(a.ganaLado, e0 === e1 ? 'empate' : e0 > e1 ? 'eq0' : 'eq1');
  assert.deepEqual(a.vista.rol, ['eq0', 'eq0', 'eq1', 'eq1']); assert.deepEqual(a.vista.mate, [1, 0, 3, 2]);
  // habilidad por asiento (arreglo): el equipo hábil gana casi siempre
  let gana1 = 0;
  for (let s = 1; s <= 12; s++) if (LIVE.sim('f_cuerda', { seed: s, skill: [0.1, 0.1, 0.95, 0.95] }).ganaLado === 'eq1') gana1++;
  assert.ok(gana1 >= 10, 'el equipo de habilidad .95 gana ' + gana1 + '/12 contra el de .1');
  // equipos personalizados: a+c contra b+d
  const x = LIVE.sim('f_cuerda', { seed: 4, skill: [0.9, 0.1, 0.9, 0.1], eq: [['a', 'c'], ['b', 'd']] });
  assert.deepEqual(x.eq, [0, 1, 0, 1]); assert.equal(x.ganaLado, 'eq0');
});
test('LIVE.sim 1v3: ganaLado = solo/trio por el umbral (≥3 golpes), sin empates, y el solo puede ir en cualquier asiento', () => {
  let solo = 0, trio = 0;
  for (let s = 1; s <= 24; s++) {
    const r = LIVE.sim('f_bono', { seed: s, skill: 0.6, solo: s % 2 ? 'a' : 'c' });
    assert.ok(r.ganaLado === 'solo' || r.ganaLado === 'trio', 'sin empate por construcción');
    const iS = s % 2 ? 0 : 2, hits = r.sc[iS] / 10;
    assert.equal(r.sc.filter((v, i) => i !== iS).every((v) => v === 25), true);
    assert.equal(r.ganaLado, hits >= 3 ? 'solo' : 'trio'); assert.deepEqual(r.pl, R.puestos('1v3', r.eq, r.sc, 'binary'));
    if (r.ganaLado === 'solo') solo++; else trio++;
  }
  assert.ok(solo > 0 && trio > 0, 'el banco ve ambos resultados (solo ' + solo + ' / trío ' + trio + ')');
  assert.equal(LIVE.sim('f_bono', { seed: 1, solo: 'c' }).eq.join(''), '1101');
});
test('LIVE.sim con juegos de M2 (ffa): también corre, 4 asientos por defecto y duelo 1v1', () => {
  require(path.join(SL, 'fiesta-juego-mecate.js'));
  const a = LIVE.sim('f_mecate', { seed: 2, dur: 8, skill: 0.6 });
  assert.equal(a.tipo, 'ffa'); assert.equal(a.sc.length, 4); assert.ok(['ffa', 'empate'].indexOf(a.ganaLado) >= 0);
  assert.deepEqual(LIVE.sim('f_mecate', { seed: 2, dur: 8, skill: 0.6 }), a);
  const d = LIVE.sim('f_mecate', { seed: 2, dur: 8, tipo: '1v1' }); assert.equal(d.sc.length, 2);
});

/* ───────────── el juez en equipos: justicia contra los RIVALES (DM3-16) ───────────── */
function sesionRed(tipo, eq, solo, rttMs, cpus) {
  const as = ['a', 'b', 'c', 'd'], pj = {}; as.forEach((s) => { pj[s] = { cpu: cpus.indexOf(s) >= 0 ? 'auto' : null, ch: 'mama' }; });
  const board = { f: 'mj', cfg: { cpuNivel: 2 }, pj: pj, mj: { k: 0, i: 0, as: as, tipo: tipo, eq: eq, solo: solo, clase: tipo === 'ffa' ? 'rank' : 'binary',
    cola: [{ g: tipo === '1v3' ? 'f_bono' : 'f_cuerda', seed: 3, dur: 12, lv: 1, modelo: 'C' }], juez: 'a', e: 0, suc: [], startAt: 1790000000000, listos: {}, res: null } };
  const noop = () => {};
  return LIVE.create({ yo: 'a', net: { board: board, you: { id: 'a' }, room: { players: as.map((s) => ({ id: s, name: s })) }, serverNow: () => 1790000000000 + 500,
    channel: () => ({ send: noop, onMsg: noop, close: noop }), silence: () => 0, rtt: (id) => rttMs[id] || 0, ready: noop, juez: noop, mjack: noop, mjfin: () => Promise.resolve({ status: 200 }) } });
}
test('juez justo: en 2v2 el retraso de su entrada sale del RTT de los RIVALES (el compañero y las CPU no cuentan); en 1v3 el trío mide al solo', () => {
  const eq22 = [['a', 'b'], ['c', 'd']], rtt = { b: 20, c: 60, d: 100 };
  assert.equal(sesionRed('2v2', eq22, null, rtt, []).fair(), 100 / 2000, 'rivales c(60) y d(100): mediana alta = 100');
  assert.equal(sesionRed('2v2', eq22, null, { b: 800, c: 60, d: 100 }, []).fair(), 100 / 2000, 'un compañero lentísimo no cambia el retraso del juez');
  assert.equal(sesionRed('2v2', eq22, null, rtt, ['c']).fair(), 100 / 2000, 'una rival CPU no cuenta: queda d');
  assert.equal(sesionRed('2v2', eq22, null, rtt, ['c', 'd']).fair(), 0, 'contra 2 CPU no hay a quién ser justo');
  assert.equal(sesionRed('2v2', eq22, null, { b: 400, c: 4000, d: 4000 }, []).fair(), 0.12, 'tope FAIR_MAX = 120 ms');
  assert.equal(sesionRed('1v3', [['d'], ['a', 'b', 'c']], 'd', { b: 10, c: 10, d: 140 }, []).fair(), 140 / 2000, 'el juez del trío mide solo al solo');
  assert.equal(sesionRed('ffa', [['a'], ['b'], ['c'], ['d']], null, { b: 20, c: 60, d: 100 }, []).fair(), 60 / 2000, 'ffa como en M2: mediana de todos los demás');
});
