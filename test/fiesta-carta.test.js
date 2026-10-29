// LA FIESTA · fiesta-carta.js (M2, doc M2-SPEC §5.9): puros (fase, teclas, stick, pads, tarjeta, HUD, podio, ruleta), la decisión de
// abrir/cerrar la sesión (fiesta-main.decidirSesion) y un humo de dibujo con primitivas falsas que recorre todas las pantallas.
const test = require('node:test'), assert = require('node:assert');
const R = require('../docs/style-lab/fiesta-reglas.js');
const UI = require('../docs/style-lab/fiesta-ui.js');
const CA = require('../docs/style-lab/fiesta-carta.js');
const MAIN = require('../docs/style-lab/fiesta-main.js');
const T = R.T;

/* ───── primitivas falsas del laboratorio ───── */
const LOG = { txt: [], n: 0, rr: [] };
function stubLab() {
  const g = globalThis, cnt = () => { LOG.n++; };
  g.ctx = { save: cnt, restore: cnt, translate: cnt, rotate: cnt, scale: cnt, beginPath: cnt, rect: cnt, clip: cnt, setLineDash: cnt, globalAlpha: 1 };
  g.rr = (x, y, w, h) => { assert.ok([x, y, w, h].every(Number.isFinite), 'rr finito'); LOG.rr.push([x, y, w, h]); cnt(); };
  g.ell = (x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y), 'ell finito'); cnt(); };
  g.poly = cnt; g.line = cnt; g.bust = (o) => { assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && o.s > 0, 'bust finito'); cnt(); };
  g.wash = cnt; g.bubble = cnt; g.mix = (a) => a;
  g.txt = (s, x, y, size) => { assert.ok(Number.isFinite(x) && Number.isFinite(y) && size > 0, 'txt finito: ' + s); LOG.txt.push(String(s)); };
  g.tw = (s, size) => String(s).length * size * .55;
  g.arcPts = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= (n || 8); i++) p.push([cx, cy]); return p; };
  g.now = 0;
}
stubLab();

const solapa = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectDe = (c) => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });
const MJ = (o) => Object.assign({ k: 3, i: 0, tipo: 'ffa', as: ['a', 'b', 'c', 'd'], eq: [['a'], ['b'], ['c'], ['d']], solo: null, cartaHasta: 100000, startAt: null, cierre: null, listos: {}, rel: 0,
  cola: [{ g: 'f_mecate', seed: 5, dur: 45, lv: 1, modelo: 'A' }], juez: 'a', e: 0, res: null, clase: 'survival' }, o || {});
const BOARD = (f, mj) => ({ f: f, ver: 5, pj: { a: { ch: 'mama', cpu: null }, b: { ch: 'tio', cpu: null }, c: { ch: 'abuela', cpu: 'auto' }, d: { ch: 'pana', cpu: 'auto' } }, mj: mj, nextAt: 0 });

test('carta/fase: ruleta -> tarjeta -> cuenta -> juego -> fin -> podio (también Relámpago y «espera»)', () => {
  const mj = MJ({ cartaHasta: 100000 }), t0 = 100000 - T.carta;
  assert.equal(CA.fase(BOARD('carta', mj), t0 - 1, null), 'espera');
  assert.equal(CA.fase(BOARD('carta', mj), t0, null), 'ruleta');
  assert.equal(CA.fase(BOARD('carta', mj), t0 + CA.K.RULETA_MS - 1, null), 'ruleta');
  assert.equal(CA.fase(BOARD('carta', mj), t0 + CA.K.RULETA_MS, null), 'tarjeta');
  assert.equal(CA.fase(BOARD('carta', mj), 99999, null), 'tarjeta');
  const rel = MJ({ rel: 1, cartaHasta: 50000 }), r0 = 50000 - T.relCarta;
  assert.equal(CA.fase(BOARD('carta', rel), r0 - 1, null), 'espera');
  assert.equal(CA.fase(BOARD('carta', rel), r0, null), 'tarjeta', 'el Relámpago no tiene ruleta');
  assert.equal(CA.fase(BOARD('mj', MJ({ startAt: null })), 5, null), 'tarjeta', 'f=mj sin startAt (cola > 1): tarjeta');
  const m2 = MJ({ startAt: 200000 });
  assert.equal(CA.fase(BOARD('mj', m2), 200000 - T.cuenta, null), 'cuenta');
  assert.equal(CA.fase(BOARD('mj', m2), 199999, null), 'cuenta');
  assert.equal(CA.fase(BOARD('mj', m2), 200000, null), 'juego');
  assert.equal(CA.fase(BOARD('mj', m2), 250000, { over: false }), 'juego');
  assert.equal(CA.fase(BOARD('mj', m2), 250000, { over: true }), 'fin');
  assert.equal(CA.fase(BOARD('res', MJ({ res: {} })), 1, null), 'podio');
  assert.equal(CA.fase(BOARD('turno', null), 1, null), null);
  assert.equal(CA.fase(null, 1, null), null);
});

test('carta/teclaAInput y stickDe: mapa de teclas, zona muerta de 12 % y tope en el radio', () => {
  assert.deepEqual(CA.teclaAInput('Space'), { b: 'a' });
  assert.deepEqual(CA.teclaAInput('KeyJ'), { b: 'a' });
  assert.deepEqual(CA.teclaAInput('ShiftLeft'), { b: 'b' });
  assert.deepEqual(CA.teclaAInput('KeyK'), { b: 'b' });
  assert.deepEqual(CA.teclaAInput('KeyW'), { e: 'u' });
  assert.deepEqual(CA.teclaAInput('ArrowDown'), { e: 'd' });
  assert.deepEqual(CA.teclaAInput('ArrowLeft'), { e: 'l' });
  assert.deepEqual(CA.teclaAInput('KeyD'), { e: 'r' });
  assert.equal(CA.teclaAInput('KeyZ'), null);
  assert.equal(CA.teclaAInput('Digit1'), null, 'los dígitos son de los emotes / del estilo, no del juego');
  assert.deepEqual(CA.stickDe(0, 0), { x: 0, y: 0 });
  assert.deepEqual(CA.stickDe(3, 3), { x: 0, y: 0 }, 'dentro de la zona muerta');
  const m = CA.stickDe(30, 0); assert.ok(Math.abs(m.x - .5) < 1e-9 && m.y === 0, 'a medio radio = 0,5');
  const t = CA.stickDe(300, 400); assert.ok(Math.abs(Math.hypot(t.x, t.y) - 1) < 1e-9, 'recortado al radio: módulo 1'); assert.ok(Math.abs(t.x - .6) < 1e-9 && Math.abs(t.y - .8) < 1e-9, 'conserva la dirección');
  assert.equal(CA.stickDe(60, 0).x, 1); assert.equal(CA.stickDe(-60, 0).x, -1);
  assert.ok(CA.stickDe(CA.K.STICK_R * .13, 0).x > 0 && CA.stickDe(CA.K.STICK_R * .11, 0).x === 0, 'umbral del 12 %');
});

const VENTANAS = [[800, 600], [1000, 460], [360, 640], [932, 430], [1366, 768]];
test('carta/layoutPads: sin solapes, dentro de la pantalla y fuera de la franja de 64 px (800x600, 1000x460, 360x640, 932x430)', () => {
  for (const [w, h] of VENTANAS) {
    const e = MAIN.encaje(w, h), comp = MAIN.compacto(w, h);
    for (const def of [{ stick: false, botones: 1 }, { stick: true, botones: 1 }, { stick: true, botones: 2 }]) {
      const L = CA.layoutPads(e.vw, 600, comp, def), ctl = w + 'x' + h + ' ' + JSON.stringify(def);
      const piezas = [['A', L.a], ['B', L.b], ['stick', L.stick]].filter((x) => x[1]);
      piezas.forEach(([n, c]) => {
        const r = rectDe(c);
        assert.ok(r.x >= L.izq && r.x + r.w <= L.der && r.y >= CA.HUDH && r.y + r.h <= 600, n + ' dentro de la pantalla y bajo el HUD en ' + ctl);
      });
      for (let i = 0; i < piezas.length; i++) for (let j = i + 1; j < piezas.length; j++)
        assert.ok(!solapa(rectDe(piezas[i][1]), rectDe(piezas[j][1])), piezas[i][0] + ' y ' + piezas[j][0] + ' se pisan en ' + ctl);
      assert.equal(!!L.b, def.botones >= 2); assert.equal(!!L.stick, !!def.stick);
      // zonas: ninguna entra en la franja del HUD; con stick el pulgar izquierdo es el stick; sin stick todo lo jugable es A
      assert.ok(L.zonaA.y >= CA.HUDH);
      if (def.stick) { assert.ok(L.zonaStick.y >= CA.HUDH); assert.ok(L.zonaStick.x + L.zonaStick.w <= L.zonaA.x + 1e-9, 'zonas disjuntas'); assert.ok(Math.abs(L.zonaStick.w - Math.round(e.vw * .45)) <= 1); }
      else assert.equal(L.zonaStick, null);
      if (L.vertical) piezas.forEach(([n, c]) => assert.ok(c.y - c.r >= 470, n + ' en la franja inferior en vertical ' + ctl));
    }
  }
  assert.equal(CA.layoutPads(800, 600, true, { botones: 1 }).vertical, true);
  assert.equal(CA.layoutPads(1300, 600, true, { botones: 1 }).vertical, false, 'apaisado chico: los pads flotan sobre el juego');
});

test('carta/layoutTarjeta y layoutHud: botones fuera de la franja de 64 px y sin pisarse (todas las ventanas)', () => {
  for (const [w, h] of VENTANAS) {
    const e = MAIN.encaje(w, h), comp = MAIN.compacto(w, h), L = CA.layoutTarjeta(e.vw, 600, comp), nm = w + 'x' + h;
    const btn = [L.practica, L.listo, L.volvi];
    btn.forEach((b) => { assert.ok(b.y >= CA.HUDH, b.id + ' bajo la franja en ' + nm); assert.ok(b.y + b.h <= 600 && b.x >= L.izq && b.x + b.w <= L.der, b.id + ' dentro en ' + nm); });
    assert.ok(!solapa(L.practica, L.listo) && !solapa(L.volvi, L.listo) && !solapa(L.volvi, L.practica), 'botones disjuntos en ' + nm);
    [L.objetivo, L.controles, L.retratos].forEach((r) => assert.ok(!solapa(r, L.listo) && !solapa(r, L.practica) && !solapa(r, L.volvi), 'paneles sin pisar los botones en ' + nm));
    assert.ok(!solapa(L.objetivo, L.controles) && !solapa(L.controles, L.retratos) && !solapa(L.objetivo, L.retratos), 'paneles disjuntos en ' + nm);
    assert.ok(!solapa(rectDe(L.anillo), L.listo) && !solapa(rectDe(L.anillo), L.volvi) && !solapa(rectDe(L.anillo), L.practica), 'el anillo de tiempo no pisa los botones en ' + nm);
    const ra = rectDe(L.anillo); assert.ok(ra.x >= L.retratos.x && ra.x + ra.w <= L.retratos.x + L.retratos.w && ra.y >= L.retratos.y && ra.y + ra.h <= L.retratos.y + L.retratos.h, 'el anillo vive en la franja de retratos');
    for (const n of [2, 3, 4]) {
      const H = CA.layoutHud(e.vw, n);
      assert.equal(H.chips.length, n);
      H.chips.forEach((c, i) => { assert.ok(c.y >= 0 && c.y + c.h <= H.barra.y, 'ficha sobre la barra'); assert.ok(c.x >= H.izq && c.x + c.w <= H.izq + e.vw); if (i) assert.ok(c.x >= H.chips[i - 1].x + H.chips[i - 1].w, 'fichas disjuntas'); });
      assert.ok(H.barra.y + H.barra.h <= CA.HUDH, 'la barra de tiempo cabe en 64 px'); assert.ok(H.num.y + 8 <= CA.HUDH);
      assert.ok(H.num.x - 15 >= H.barra.x + H.barra.w - 1, 'el número del reloj no pisa la barra');
    }
  }
});

test('carta/podioModelo: orden por puesto con empates, pagos y empate sin puntajes', () => {
  const mj = MJ({ as: ['a', 'b', 'c', 'd'] });
  let M = CA.podioModelo({ sc: [100, 400, 400, 50], puestos: [3, 1, 1, 4], pagos: [3, 8, 8, 1], cpu: ['c', 'd'] }, mj);
  assert.deepEqual(M.lista.map((x) => x.s), ['b', 'c', 'a', 'd']);
  assert.deepEqual(M.lista.map((x) => x.rank), [1, 1, 3, 4]);
  assert.deepEqual(M.ganadores, ['b', 'c']); assert.equal(M.empate, false);
  assert.deepEqual(M.lista.map((x) => x.pago), [8, 8, 3, 1]);
  assert.deepEqual(M.lista.map((x) => x.cpu), [false, true, false, true]);
  M = CA.podioModelo({ sc: null, puestos: [1, 1, 1, 1], pagos: [0, 0, 0, 0], empate: 1 }, mj);
  assert.equal(M.empate, true); assert.deepEqual(M.lista.map((x) => x.s), ['a', 'b', 'c', 'd']);
  M = CA.podioModelo({ sc: [1, 2], puestos: [2, 1], pagos: [-3, 3] }, MJ({ as: ['a', 'b'], tipo: '1v1' }));
  assert.deepEqual(M.lista.map((x) => x.s), ['b', 'a']); assert.deepEqual(M.lista.map((x) => x.pago), [3, -3], 'pagos de duelo con signo');
  assert.equal(CA.podioModelo(null, mj), null);
});

test('carta/modeloRuleta: cae SIEMPRE en el formato de mj.tipo, determinista por mj.k', () => {
  const seg = Math.PI * 2 / 3;
  for (const tipo of ['ffa', '2v2', '1v3']) for (let k = 1; k <= 40; k++) {
    const mj = MJ({ k: k, tipo: tipo }), m = CA.modeloRuleta(mj, CA.K.GIRO_MS), idx = CA.FORMATOS.indexOf(tipo);
    assert.equal(m.idx, idx); assert.ok(m.hecho);
    // el puntero está arriba (−π/2): el segmento que queda ahí es el de `tipo`
    const rel = (((-Math.PI / 2 - m.ang) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    assert.equal(Math.floor(rel / seg), idx, tipo + ' k=' + k);
    assert.deepEqual(CA.modeloRuleta(mj, 1234), CA.modeloRuleta(mj, 1234), 'determinista');
  }
  const m0 = CA.modeloRuleta(MJ({ k: 3 }), 0), m1 = CA.modeloRuleta(MJ({ k: 3 }), 1500), m2 = CA.modeloRuleta(MJ({ k: 3 }), 3000);
  assert.ok(m0.u === 0 && !m0.hecho && m1.u === .5 && m2.hecho);
  assert.ok(Math.abs(m0.ang - m2.ang) >= Math.PI * 2 * 4 - 1e-6, 'da al menos 4 vueltas');
  assert.equal(CA.textoFormato(MJ({ tipo: '1v3', solo: 'b' }), 'b'), '¡TÚ CONTRA TODOS!');
  assert.equal(CA.textoFormato(MJ({ tipo: '1v3', solo: 'b' }), 'a'), '¡1 CONTRA 3!');
  assert.equal(CA.textoFormato(MJ({ rel: 1 }), 'a'), '¡RELÁMPAGO!');
});

test('main/decidirSesion: se abre UNA vez por k:i y se cierra al salir de carta/mj/res o al cambiar k:i', () => {
  const D = MAIN.decidirSesion, mj = MJ({ k: 4, i: 0 }), Bc = BOARD('carta', mj), base = { yo: 'a', mala: null, now: 1000 };
  // el director aún reproduce el lote (D todavía en turno): no se abre hasta que D llega a carta o falten 3 s para startAt
  assert.deepEqual(D(Object.assign({}, base, { B: Bc, key: null, Db: { f: 'turno' } })), { cerrar: false, abrir: false });
  assert.deepEqual(D(Object.assign({}, base, { B: Bc, key: null, Db: { f: 'carta' } })), { cerrar: false, abrir: true });
  assert.deepEqual(D(Object.assign({}, base, { B: Bc, key: '4:0', Db: { f: 'carta' } })), { cerrar: false, abrir: false }, 'ya abierta: no se reabre');
  const Bm = BOARD('mj', MJ({ k: 4, i: 0, startAt: 5000 }));
  assert.deepEqual(D(Object.assign({}, base, { B: Bm, key: null, Db: { f: 'turno' }, now: 1999 })), { cerrar: false, abrir: false });
  assert.deepEqual(D(Object.assign({}, base, { B: Bm, key: null, Db: { f: 'turno' }, now: 2000 })), { cerrar: false, abrir: true }, 'a 3 s del startAt abre aunque D vaya atrás (la cuenta siempre se ve)');
  assert.deepEqual(D(Object.assign({}, base, { B: BOARD('res', MJ({ k: 4 })), key: '4:0', Db: { f: 'res' } })), { cerrar: false, abrir: false }, 'en res sigue abierta, no se abre otra');
  assert.deepEqual(D(Object.assign({}, base, { B: BOARD('res', MJ({ k: 4 })), key: null, Db: { f: 'res' } })), { cerrar: false, abrir: false }, 'en res no nace sesión nueva');
  assert.deepEqual(D(Object.assign({}, base, { B: BOARD('turno', null), key: '4:0', Db: { f: 'turno' } })), { cerrar: true, abrir: false }, 'vuelve al tablero: cierra');
  assert.deepEqual(D(Object.assign({}, base, { B: BOARD('turno', null), key: null, Db: { f: 'turno' } })), { cerrar: false, abrir: false });
  assert.deepEqual(D(Object.assign({}, base, { B: BOARD('carta', MJ({ k: 4, i: 1 })), key: '4:0', Db: { f: 'carta' } })), { cerrar: true, abrir: true }, 'Relámpago: otro i => cierra y abre la siguiente');
  assert.deepEqual(D(Object.assign({}, base, { yo: null, B: Bc, key: null, Db: { f: 'carta' } })), { cerrar: false, abrir: false }, 'espectador: sin sesión');
  assert.deepEqual(D(Object.assign({}, base, { B: Bc, key: null, Db: { f: 'carta' }, mala: '4:0' })), { cerrar: false, abrir: false }, 'juego que falló: no reintenta');
  // simulación de una ronda entera: abre y cierra exactamente una vez
  let key = null, abre = 0, cierra = 0;
  const tabla = [['turno', null], ['carta', mj], ['carta', mj], ['mj', MJ({ k: 4, startAt: 9e3 })], ['mj', MJ({ k: 4, startAt: 9e3 })], ['res', MJ({ k: 4 })], ['res', MJ({ k: 4 })], ['turno', null], ['turno', null]];
  tabla.forEach(([f, m]) => {
    const r = D({ yo: 'a', B: BOARD(f, m), key: key, mala: null, Db: { f: f === 'mj' ? 'mj' : f }, now: 0 });
    if (r.cerrar) { key = null; cierra++; }
    if (r.abrir) { key = '4:0'; abre++; }
  });
  assert.deepEqual([abre, cierra], [1, 1]);
});

/* ───── humo de dibujo: todas las pantallas, 3 tamaños, con una sesión falsa ───── */
function sesionFalsa(over) {
  const def = { name: '¡SALTA EL MECATE!', clase: 'survival', stick: false, botones: 1, carta: { obj: 'Brinca cuando pase el mecate', gana: 'El último en pie. Si quedan varios, empatan arriba.',
    como: { tactil: 'A = saltar', teclado: 'ESPACIO o J' }, demos: [{ id: 'saltar', txt: 'Salta justo cuando la cuerda pasa por el suelo' }] } };
  const S = { key: '3:0', id: 'f_mecate', def: def, over: !!over, listos: { c: true }, phase: 'juego', _pad: [],
    c: { yo: 0, modo: 'ffa', lv: 1, mio: () => true, seats: [{ id: 'a', ch: 'mama' }] },
    draw: () => {}, cuenta: () => null, close: () => {}, ready: () => {},
    in: { down: (b) => S._pad.push('d' + b), up: (b) => S._pad.push('u' + b), tap: () => {}, axis: (x, y) => S._pad.push('x' + x + ',' + y) },
    hud: () => ({ gt: 5, dur: 45, quedan: 40, over: !!over, fase: 'juego', juez: 'a', items: ['a', 'b', 'c', 'd'].map((s, i) => ({ i: i, id: s, name: 'N' + s, ch: ['mama', 'tio', 'abuela', 'pana'][i], team: i, yo: i === 0, cpu: i > 1, caido: i === 3, vivo: i !== 1, sc: i * 100 })) }) };
  return S;
}
test('carta/dibujar: ruleta, tarjeta, práctica, cuenta, juego, fin y podio dibujan sin romper (3 tamaños, 4P / 2v2 / 1v3 / duelo)', () => {
  for (const [w, h] of [[800, 600], [360, 640], [932, 430]]) {
    const e = MAIN.encaje(w, h), comp = MAIN.compacto(w, h), izq = -e.ox, der = izq + e.vw, emitidas = [];
    const C = CA.crear({ emit: (it) => emitidas.push(it) });
    const sess = sesionFalsa(false); C.abrir(sess);
    const vm = (S, sn, extra) => Object.assign({ S: S, D: { board: S }, yo: 'a', serverNow: sn, izq: izq, der: der, compacto: comp, seats: [], sess: sess, net: null, ahoraMs: 1000 }, extra || {});
    const mjs = { ffa: MJ(), '2v2': MJ({ tipo: '2v2', eq: [['a', 'b'], ['c', 'd']], clase: 'binary' }), '1v3': MJ({ tipo: '1v3', solo: 'b', eq: [['b'], ['a', 'c', 'd']] }), '1v1': MJ({ tipo: '1v1', as: ['a', 'b'], eq: [['a'], ['b']] }) };
    Object.keys(mjs).forEach((tipo) => {
      const mj = mjs[tipo], t0 = mj.cartaHasta - T.carta;
      LOG.txt.length = 0;
      [t0 + 100, t0 + 1500, t0 + 3200, t0 + 4400].forEach((sn) => assert.equal(C.dibujar(vm(BOARD('carta', mj), sn)), true, 'ruleta ' + tipo));
      assert.ok(LOG.txt.some((x) => /CONTRA|DUELO|TODOS|VS/.test(x)), 'banner del formato ' + tipo);
      assert.equal(C.dibujar(vm(BOARD('carta', mj), mj.cartaHasta - 9000)), true); assert.equal(C.fase, 'tarjeta');
      assert.ok(LOG.txt.indexOf('¡LISTO!') >= 0 && LOG.txt.indexOf('PRÁCTICA') >= 0, 'botones de la tarjeta');
      assert.ok(C.B.porId('listo') && C.B.porId('practica'), 'registrados para el e2e');
    });
    assert.equal(C.dibujar(vm(BOARD('carta', MJ()), MJ().cartaHasta - T.carta - 5)), false, '«espera»: main dibuja el tablero');
    // ¡LISTO! y teclado
    assert.equal(C.dibujar(vm(BOARD('carta', MJ()), 90000)), true);
    const b = C.B.porId('listo');
    C.down(1, b.x + 5, b.y + 5); assert.deepEqual(C.up(1, b.x + 5, b.y + 5), 'listo'); assert.deepEqual(emitidas.pop(), { k: 'ready' });
    C.down(2, b.x + 5, b.y + 5); assert.equal(C.up(2, -50, -50), null, 'soltar fuera no confirma');
    assert.equal(C.tecla('Space', true), true); assert.deepEqual(emitidas.pop(), { k: 'ready' });
    // cuenta / juego / fin
    const mj2 = MJ({ startAt: 200000 });
    sess.cuenta = () => ({ n: 3, frac: .3 });
    assert.equal(C.dibujar(vm(BOARD('mj', mj2), 197000)), true); assert.equal(C.fase, 'cuenta'); assert.ok(LOG.txt.indexOf('3') >= 0);
    sess.cuenta = () => ({ n: 0, frac: .2 });
    assert.equal(C.dibujar(vm(BOARD('mj', mj2), 200100)), true); assert.ok(LOG.txt.indexOf('¡YA!') >= 0);
    sess.cuenta = () => null;
    assert.equal(C.dibujar(vm(BOARD('mj', mj2), 210000)), true); assert.equal(C.fase, 'juego');
    ['pad_a'].forEach((id) => assert.ok(C.B.porId(id), id));
    const pa = C.B.porId('pad_a'), cx = pa.x + pa.w / 2, cy = pa.y + pa.h / 2;
    sess._pad.length = 0; C.down(7, cx, cy); C.up(7, cx, cy); assert.deepEqual(sess._pad, ['da', 'ua'], 'tocar el pad A = down + up');
    sess._pad.length = 0; C.down(8, izq + 50, 300); assert.deepEqual(sess._pad, ['da'], 'sin stick: toda la pantalla jugable es A'); C.up(8, izq + 50, 300);
    sess.over = true; sess.phase = 'fin';
    assert.equal(C.dibujar(vm(BOARD('mj', mj2), 260000)), true); assert.equal(C.fase, 'fin'); assert.ok(LOG.txt.indexOf('¡SE ACABÓ!') >= 0);
    // podio
    const res = { sc: [1351, 300, 412, 380], puestos: [1, 4, 2, 3], pagos: [10, 1, 6, 3], empate: 0, cpu: ['c', 'd'] };
    const Sres = BOARD('res', MJ({ res: res, startAt: 200000 })); Sres.nextAt = 270000;
    LOG.txt.length = 0;
    for (let i = 0; i < 12; i++) assert.equal(C.dibujar(vm(Sres, 262000, { ahoraMs: 1000 + i * 100 })), true);   // el podio crece y las monedas ruedan con el tiempo
    assert.equal(C.fase, 'podio');
    assert.ok(LOG.txt.some((x) => /^¡GANÓ /.test(x)), 'título del podio'); assert.ok(LOG.txt.indexOf('1') >= 0, 'medalla del 1.er puesto');
    const Semp = BOARD('res', MJ({ res: { sc: null, puestos: [1, 1, 1, 1], pagos: [0, 0, 0, 0], empate: 1, cpu: [] } })); Semp.nextAt = 270000;
    LOG.txt.length = 0; assert.equal(C.dibujar(vm(Semp, 262000)), true);
    assert.ok(LOG.txt.indexOf('EMPATE') >= 0 && LOG.txt.indexOf('Se fue la luz en todo el país') >= 0);
    // espectador sin sesión: el podio sí se dibuja
    const C2 = CA.crear({ emit: () => {} });
    assert.equal(C2.dibujar({ S: Sres, D: { board: Sres }, yo: null, serverNow: 262000, izq: izq, der: der, compacto: comp, sess: null, ahoraMs: 5 }), true);
    C.cerrar();
  }
});

test('carta/stick y multitáctil: stick flotante + A a la vez, cada dedo suelta lo suyo; teclado y toque no se pisan', () => {
  const e = MAIN.encaje(932, 430), izq = -e.ox, der = izq + e.vw, C = CA.crear({ emit: () => {} });
  const sess = sesionFalsa(false); sess.def.stick = true; sess.def.botones = 2; sess.def.clase = 'rank'; C.abrir(sess);
  const mj2 = MJ({ startAt: 200000 }), S = BOARD('mj', mj2), vm = { S: S, D: { board: S }, yo: 'a', serverNow: 210000, izq: izq, der: der, compacto: true, sess: sess, ahoraMs: 1 };
  C.dibujar(vm); assert.ok(C.B.porId('stick') && C.B.porId('pad_a') && C.B.porId('pad_b'));
  sess._pad.length = 0;
  C.down(1, izq + 100, 400);                                   // pulgar izquierdo: nace el stick ahí
  C.down(2, der - 100, 300);                                   // pulgar derecho: A
  C.move(1, izq + 100 + 60, 400);                              // a tope a la derecha
  assert.deepEqual(sess._pad.slice(0, 3), ['x0,0', 'da', 'x1,0']);
  C.move(1, izq + 100 + 3, 400); assert.equal(sess._pad[sess._pad.length - 1], 'x0,0', 'zona muerta');
  C.up(2, der - 100, 300); assert.equal(sess._pad[sess._pad.length - 1], 'ua');
  C.up(1, izq + 160, 400); assert.equal(sess._pad[sess._pad.length - 1], 'x0,0', 'soltar el stick lo centra');
  const pb = C.B.porId('pad_b'); sess._pad.length = 0;
  C.down(3, pb.x + pb.w / 2, pb.y + pb.h / 2); C.up(3, pb.x + pb.w / 2, pb.y + pb.h / 2); assert.deepEqual(sess._pad, ['db', 'ub']);
  sess._pad.length = 0;
  assert.equal(C.tecla('KeyD', true), true); assert.equal(C.tecla('KeyW', true), true);
  assert.equal(sess._pad[sess._pad.length - 1], 'x1,-1'); C.tecla('KeyD', false); assert.equal(sess._pad[sess._pad.length - 1], 'x0,-1');
  assert.equal(C.tecla('KeyZ', true), false);
  C.tecla('Space', true); C.tecla('Space', false); assert.deepEqual(sess._pad.slice(-2), ['da', 'ua']);
});

/* ───── M3-TEAMS: formatos de equipo en tarjeta, HUD y podio ───── */
test('carta/cartaParaRol: en un 1v3 el solo y el trío ven su texto (campo a campo sobre la base); 2v2, ffa y espectadores ven la base', () => {
  const base = { obj: 'BASE', gana: 'GANA', como: { tactil: 'T', teclado: 'K' }, demos: [{ id: 'mover' }],
    roles: { solo: { obj: 'SOLO', como: { tactil: 'TS', teclado: 'KS' }, demos: [{ id: 'saltar' }] }, trio: { obj: 'TRIO', como: { tactil: 'TT', teclado: 'KT' } } } };
  const mj = MJ({ tipo: '1v3', solo: 'b', eq: [['b'], ['a', 'c', 'd']], clase: 'binary' });
  const solo = CA.cartaParaRol(base, mj, 'b'), trio = CA.cartaParaRol(base, mj, 'a');
  assert.equal(solo.obj, 'SOLO'); assert.equal(solo.gana, 'GANA', 'lo que el rol no redefine se hereda'); assert.deepEqual(solo.como, { tactil: 'TS', teclado: 'KS' }); assert.deepEqual(solo.demos, [{ id: 'saltar' }]);
  assert.equal(trio.obj, 'TRIO'); assert.deepEqual(trio.demos, [{ id: 'mover' }], 'demos sin override: las de la base'); assert.equal(solo.roles, undefined);
  assert.equal(base.obj, 'BASE', 'no muta la carta del juego');
  assert.equal(CA.cartaParaRol(base, mj, null), base, 'espectador'); assert.equal(CA.cartaParaRol(base, mj, 'zz'), base, 'quien no juega');
  assert.equal(CA.cartaParaRol(base, MJ({ tipo: '2v2' }), 'a'), base); assert.equal(CA.cartaParaRol(base, MJ(), 'a'), base);
  assert.equal(CA.cartaParaRol({ obj: 'x' }, mj, 'a').obj, 'x', 'sin roles');
});
test('carta/textoFormato: el 2v2 añade «Tu pana: NOMBRE» solo a quien juega y solo si se le da un nombre', () => {
  const mj = MJ({ tipo: '2v2', eq: [['a', 'b'], ['c', 'd']] }), nm = (s) => s.toUpperCase() + '!';
  assert.equal(CA.textoFormato(mj, 'a'), '¡2 CONTRA 2!'); assert.equal(CA.textoFormato(mj, 'a', nm), '¡2 CONTRA 2! · Tu pana: B!');
  assert.equal(CA.textoFormato(mj, 'd', nm), '¡2 CONTRA 2! · Tu pana: C!'); assert.equal(CA.textoFormato(mj, null, nm), '¡2 CONTRA 2!', 'espectador');
});
test('carta/podioModelo y tituloPodio: lados, ganLado, compañeros juntos, empate y 1v3 sin enseñar el puntaje de umbral', () => {
  const m22 = MJ({ tipo: '2v2', eq: [['a', 'c'], ['b', 'd']], clase: 'binary' }), nm = (s) => s.toUpperCase();
  let M = CA.podioModelo({ sc: [1, 3, 2, 0], puestos: [2, 1, 2, 1], pagos: [2, 7, 2, 7] }, m22);
  assert.equal(M.tipo, '2v2'); assert.equal(M.ganLado, 1); assert.deepEqual(M.lados.map((l) => [l.eq, l.rank, l.pago, l.sc]), [[0, 2, 2, 3], [1, 1, 7, 3]].map((x, i) => i ? [1, 1, 7, 3] : [0, 2, 2, 3]));
  assert.deepEqual(M.lista.map((x) => x.s), ['b', 'd', 'a', 'c'], 'los dos del equipo ganador primero y juntos; el otro equipo detrás');
  assert.deepEqual(M.lista.map((x) => x.eq), [1, 1, 0, 0]); assert.equal(M.empate, false);
  assert.deepEqual(CA.tituloPodio(M, m22, nm), { titulo: '¡GANÓ EL EQUIPO ROJO!', sub: 'B y D' });
  M = CA.podioModelo({ sc: [3, 0, 0, 0], puestos: [1, 2, 1, 2], pagos: [7, 2, 7, 2] }, m22);
  assert.equal(M.ganLado, 0); assert.deepEqual(CA.tituloPodio(M, m22, nm), { titulo: '¡GANÓ EL EQUIPO AZUL!', sub: 'A y C' });
  assert.equal(M.lados[0].sc, 3); assert.equal(M.lados[1].sc, 0);
  M = CA.podioModelo({ sc: [1, 1, 1, 1], puestos: [1, 1, 1, 1], pagos: [4, 4, 4, 4] }, m22);
  assert.equal(M.empate, true); assert.equal(M.ganLado, null); assert.equal(CA.tituloPodio(M, m22, nm).titulo, 'EMPATE', 'un 2v2 empatado NO es «¡EMPATAN A, B, C Y D!»');
  // 1v3
  const m13 = MJ({ tipo: '1v3', solo: 'c', eq: [['c'], ['a', 'b', 'd']], clase: 'binary' });
  M = CA.podioModelo({ sc: [25, 25, 30, 25], puestos: [2, 2, 1, 2], pagos: [0, 0, 12, 0] }, m13);
  assert.equal(M.ganLado, 0); assert.deepEqual(CA.tituloPodio(M, m13, nm), { titulo: '¡GANÓ C!', sub: 'el solitario' });
  assert.deepEqual(M.lados.map((l) => l.sc), [null, null], 'el 25/30 de un 1v3 de umbral no se enseña'); assert.deepEqual(M.lista.map((x) => x.s), ['c', 'a', 'b', 'd']);
  M = CA.podioModelo({ sc: [25, 25, 20, 25], puestos: [1, 1, 2, 1], pagos: [4, 4, 0, 4] }, m13);
  assert.equal(M.ganLado, 1); assert.deepEqual(CA.tituloPodio(M, m13, nm), { titulo: '¡GANÓ EL TRÍO!', sub: 'A y B y D' });
  assert.equal(CA.podioModelo({ sc: [1, 1, 1, 1], puestos: [1, 1, 1, 1], pagos: [2, 2, 2, 5] }, m13).empate, true);
  // los formatos de siempre no cambian: ffa con 2 ganadores = «EMPATAN», 4 = «EMPATE ENTRE 4» o EMPATE si lo marca el reductor
  const ffa = CA.podioModelo({ sc: [5, 5, 1, 0], puestos: [1, 1, 3, 4], pagos: [8, 8, 3, 1] }, MJ());
  assert.equal(ffa.ganLado, null); assert.deepEqual(ffa.lados, []); assert.equal(CA.tituloPodio(ffa, MJ(), nm).titulo, '¡EMPATAN A Y B!');
  assert.equal(CA.tituloPodio(CA.podioModelo({ sc: [1, 0, 0, 0], puestos: [1, 2, 2, 2], pagos: [10, 6, 6, 6] }, MJ()), MJ(), { pj: { a: { name: 'ana' } } }).titulo, '¡GANÓ ANA!', 'también acepta un board');
});

function sesionEquipo(tipo, yoI) {
  const roles = { solo: { obj: 'ERES EL SOLO: suelta la patilla', como: { tactil: 'TACTIL-SOLO', teclado: 'TECLA-SOLO' } }, trio: { obj: 'ERES DEL TRIO: esquiva', como: { tactil: 'TACTIL-TRIO', teclado: 'TECLA-TRIO' } } };
  const llamadas = [], def = { name: '¡EQUIPO FALSO!', clase: 'binary', stick: true, botones: 2, carta: { obj: 'OBJ-BASE', gana: 'GANA-BASE', como: { tactil: 'T-BASE', teclado: 'K-BASE' },
    roles: tipo === '1v3' ? roles : undefined,
    demos: [{ id: 'patear', txt: 'DEMO-PROPIO', dibuja: (cx, cy, k, t, teclado) => { assert.ok([cx, cy, k, t].every(Number.isFinite)); llamadas.push(teclado ? 'tec' : 'tac'); } }] } };
  const S = sesionFalsa(false); S.def = def; S._demo = llamadas; S.id = 'f_equipo'; S.c = { yo: yoI, modo: tipo, lv: 1, mio: () => true, seats: [{ id: 'a', ch: 'mama' }], rol: (p) => (tipo === '1v3' ? (p === 2 ? 'solo' : 'trio') : 'eq' + (p > 1 ? 1 : 0)) };
  S.hud = () => ({ gt: 5, dur: 60, quedan: 55, over: false, fase: 'juego', juez: 'a', tipo: tipo, solo: tipo === '1v3' ? 2 : -1,
    items: ['a', 'b', 'c', 'd'].map((s, i) => ({ i: i, id: s, name: 'N' + s, ch: ['mama', 'tio', 'abuela', 'pana'][i], team: tipo === '1v3' ? (i === 2 ? 0 : 1) : (i > 1 ? 1 : 0), yo: i === yoI, cpu: i > 1, caido: false, vivo: true,
      sc: i, mate: tipo === '2v2' && (yoI === 0 ? i === 1 : yoI === 1 ? i === 0 : false), rol: tipo === '1v3' ? (i === 2 ? 'solo' : 'trio') : 'eq' + (i > 1 ? 1 : 0), tsc: i > 1 ? 7 : 3, txt: tipo === '1v3' ? (i === 2 ? '2/3' : 'LIMPIO') : null })) });
  return S;
}
test('carta/dibujar equipos: tarjeta con el texto de TU rol, demo propio, «Tu pana»; HUD con PANA/SOLO, marcador de equipo y hudChip; sin romper en 3 tamaños', () => {
  for (const [w, h] of [[800, 600], [360, 640], [932, 430]]) {
    const e = MAIN.encaje(w, h), comp = MAIN.compacto(w, h), izq = -e.ox, der = izq + e.vw;
    // 1v3: el solo es b (retrato 1) en la tarjeta; la sesión mira desde el asiento a (trío)
    for (const yo of ['a', 'b']) {
      const C = CA.crear({ emit: () => {} }), sess = sesionEquipo('1v3', yo === 'a' ? 0 : 1); C.abrir(sess);
      const mj = MJ({ tipo: '1v3', solo: 'b', eq: [['b'], ['a', 'c', 'd']], clase: 'binary' });
      const vm = (S, sn) => ({ S: S, D: { board: S }, yo: yo, serverNow: sn, izq: izq, der: der, compacto: comp, sess: sess, ahoraMs: 1000 });
      LOG.txt.length = 0; sess._demo.length = 0;
      assert.equal(C.dibujar(vm(BOARD('carta', mj), mj.cartaHasta - 9000)), true); assert.equal(C.fase, 'tarjeta');
      const dicho = LOG.txt.join('|').replace(/\|(?=TRIO:|SOLO:)/g, ' ');   // el texto largo se parte en líneas: se unen las que continúan
      if (yo === 'b') { assert.match(dicho, /ERES EL SOLO/); assert.doesNotMatch(dicho, /ERES DEL TRIO/); assert.match(dicho, /TACTIL-SOLO/); assert.doesNotMatch(dicho, /OBJ-BASE/, 'el rol REEMPLAZA el objetivo'); assert.match(dicho, /GANA-BASE/, 'lo demás se hereda'); }
      else { assert.match(dicho, /ERES DEL TRIO/); assert.doesNotMatch(dicho, /ERES EL SOLO/); assert.match(dicho, /TECLA-TRIO/); }
      assert.deepEqual(sess._demo.sort(), ['tac', 'tec'], 'el demo propio se dibuja en táctil y teclado'); assert.match(dicho, /DEMO-PROPIO/);
      // espectador: texto base
      const C2 = CA.crear({ emit: () => {} }), s2 = sesionEquipo('1v3', -1); C2.abrir(s2); LOG.txt.length = 0;
      assert.equal(C2.dibujar({ S: BOARD('carta', mj), D: { board: BOARD('carta', mj) }, yo: null, serverNow: mj.cartaHasta - 9000, izq: izq, der: der, compacto: comp, sess: s2, ahoraMs: 1 }), true);
      assert.match(LOG.txt.join('|'), /OBJ-BASE/);
      // HUD en juego
      LOG.txt.length = 0; const mjj = MJ({ tipo: '1v3', solo: 'b', eq: [['b'], ['a', 'c', 'd']], clase: 'binary', startAt: 200000 });
      assert.equal(C.dibujar(vm(BOARD('mj', mjj), 210000)), true); assert.equal(C.fase, 'juego');
      assert.ok(LOG.txt.indexOf('2/3') >= 0 && LOG.txt.indexOf('LIMPIO') >= 0, 'el hudChip manda sobre sc'); assert.ok(LOG.txt.indexOf('SOLO·CPU') >= 0 || LOG.txt.indexOf('SOLO') >= 0, 'etiqueta del solo (aquí CPU; en fichas angostas se acorta a SOLO)');
      C.cerrar(); C2.cerrar();
    }
    // 2v2
    const C = CA.crear({ emit: () => {} }), sess = sesionEquipo('2v2', 0); C.abrir(sess);
    const mj = MJ({ tipo: '2v2', eq: [['a', 'b'], ['c', 'd']], clase: 'binary' }), mjj = MJ({ tipo: '2v2', eq: [['a', 'b'], ['c', 'd']], clase: 'binary', startAt: 200000 });
    const vm = (S, sn) => ({ S: S, D: { board: S }, yo: 'a', serverNow: sn, izq: izq, der: der, compacto: comp, sess: sess, ahoraMs: 1000 });
    const Bn = (f, m) => { const b = BOARD(f, m); b.pj.a.name = 'ANA'; b.pj.b.name = 'BETO'; b.pj.c.name = 'CARLA'; b.pj.d.name = 'DANI'; return b; };
    LOG.txt.length = 0; C.dibujar(vm(Bn('carta', mj), mj.cartaHasta - 9000));
    assert.ok(LOG.txt.some((x) => /^¡2 CONTRA 2! · Tu pana: BETO$/.test(x)), 'Tu pana: ' + LOG.txt.filter((x) => /CONTRA/.test(x)));
    LOG.txt.length = 0; C.dibujar(vm(Bn('mj', mjj), 210000));
    assert.ok(LOG.txt.indexOf('PANA') >= 0, 'rótulo del compañero'); assert.ok(LOG.txt.indexOf('3') >= 0 && LOG.txt.indexOf('7') >= 0, 'cada ficha enseña el marcador de su EQUIPO (tsc)');
    // podio 2v2 y 1v3
    for (const [m, res, esperado] of [[mj, { sc: [2, 1, 0, 1], puestos: [1, 1, 2, 2], pagos: [7, 7, 2, 2], cpu: ['c', 'd'] }, '¡GANÓ EL EQUIPO AZUL!'],
      [mj, { sc: [1, 1, 1, 1], puestos: [1, 1, 1, 1], pagos: [4, 4, 4, 4], cpu: [] }, 'EMPATE'],
      [MJ({ tipo: '1v3', solo: 'b', eq: [['b'], ['a', 'c', 'd']], clase: 'binary' }), { sc: [25, 30, 25, 25], puestos: [2, 1, 2, 2], pagos: [0, 12, 0, 0], cpu: [] }, '¡GANÓ NB!'],
      [MJ({ tipo: '1v3', solo: 'b', eq: [['b'], ['a', 'c', 'd']], clase: 'binary' }), { sc: [25, 20, 25, 25], puestos: [1, 2, 1, 1], pagos: [4, 0, 4, 4], cpu: [] }, '¡GANÓ EL TRÍO!']]) {
      const Sr = Bn('res', Object.assign({}, m, { res: res })); Sr.nextAt = 270000; LOG.txt.length = 0;
      for (let i = 0; i < 8; i++) assert.equal(C.dibujar(Object.assign(vm(Sr, 262000), { ahoraMs: 1000 + i * 150 })), true);
      assert.equal(C.fase, 'podio'); assert.ok(LOG.txt.indexOf(esperado) >= 0 || LOG.txt.some((x) => x === esperado.replace('NB', 'BETO')), esperado + ' <- ' + LOG.txt.filter((x) => /GAN|EMPAT/.test(x)));
      if (m.tipo === '2v2' && esperado !== 'EMPATE') assert.ok(LOG.txt.indexOf('3 – 1') >= 0, 'marcador del bando'); 
      assert.ok(!LOG.txt.some((x) => / pts$/.test(x)), 'en equipos no hay «N pts» por jugador');
    }
    C.cerrar();
  }
});
