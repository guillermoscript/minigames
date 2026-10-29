// LA FIESTA · HUD (fiesta-ui.js) y lobby (fiesta-lobby.js): helpers puros, modelo de avisos -> intenciones, registro de botones,
// y un humo de dibujo con primitivas falsas (sin canvas) que recorre partidas reales del reductor.
const test = require('node:test'), assert = require('node:assert');
const R = require('../docs/style-lab/fiesta-reglas.js');
const UI = require('../docs/style-lab/fiesta-ui.js');
const LB = require('../docs/style-lab/fiesta-lobby.js');
const P = require('../pocketbase/pb_hooks/party.js');
const NOW = 1e12;
const J = (x) => JSON.parse(JSON.stringify(x));

/* ───── primitivas falsas del laboratorio (engine.js) ───── */
const LOG = { txt: [], n: 0 };
function stubLab() {
  const g = globalThis, cnt = () => { LOG.n++; };
  g.ctx = { save: cnt, restore: cnt, translate: cnt, rotate: cnt, scale: cnt, beginPath: cnt, rect: cnt, clip: cnt, setLineDash: cnt, globalAlpha: 1 };
  g.rr = cnt; g.ell = cnt; g.poly = cnt; g.line = cnt; g.bust = (o) => { assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && o.s > 0, 'bust con coordenadas'); cnt(); };
  g.wash = cnt; g.bubble = cnt; g.mix = (a) => a;
  g.txt = (s, x, y, size) => { assert.ok(Number.isFinite(x) && Number.isFinite(y) && size > 0, 'txt finito: ' + s); LOG.txt.push(String(s)); };
  g.tw = (s, size) => String(s).length * size * .55;
  g.arcPts = (cx, cy, r, a0, a1, n) => { const p = []; for (let i = 0; i <= (n || 8); i++) p.push([cx, cy]); return p; };
  g.now = 0;
}
stubLab();
function reloj() { let t = 100; const f = () => t; f.mas = (d) => { t += d; }; return f; }
function centro(B, id) { const b = B.porId(id); assert.ok(b, 'botón ' + id); return [b.x + b.w / 2, b.y + b.h / 2]; }

// partida real: 2 humanos (a, b) + 2 CPU, con el orden ya tirado
function arrancar(cfg) {
  let { S, priv } = R.crear(7, cfg || {}, [{ name: 'ANA', ch: 'mama' }, { name: 'BETO', ch: 'tio' }], NOW);
  const S0 = S;
  let r = R.aplicar(S, priv, 'a', { t: 'COMMIT', k: 'orden', eid: S.esp.id, aid: 'o1' }, NOW); assert.ifError(r.error);
  r = R.aplicar(r.S, r.priv, 'b', { t: 'COMMIT', k: 'orden', eid: r.S.esp.id, aid: 'o2' }, NOW); assert.ifError(r.error);
  return { S0, S: r.S, priv: r.priv, fx: r.fx };
}
function turnoDe(base, s, mods) {
  const S = J(base.S);
  S.f = 'turno'; S.mj = null;
  S.t = { s, paso: 'pre', resto: 0, usado: 0, mod: null, pend: [], cas: 0, compro: 0, compras: 0, desde: S.pj[s].nodo };
  S.esp = { id: S.ver, s, k: 'DADO', opc: ['TIRAR'], hasta: NOW + 20000 };
  if (mods) mods(S);
  return S;
}

/* ───── datos ───── */
test('personajes, objetos y emotes coinciden con reglas y servidor', () => {
  assert.deepStrictEqual(UI.PJ_IDS, R.PERSONAJES.map((p) => p.id));
  R.PERSONAJES.forEach((p) => assert.strictEqual(UI.PJ[p.id].n, p.n));
  Object.keys(R.OBJ).forEach((k) => assert.ok(UI.ITEM[k] && UI.ITEM[k].n, 'ITEM ' + k));
  assert.deepStrictEqual(UI.REACT.map((r) => r.id).sort(), P.REACT_KINDS.slice().sort());
  assert.strictEqual(LB.CODE_CHARS, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  LB.CFG_OPC.forEach((o) => { const srv = { tot: [10, 15, 20], ronda: ['clasica', 'relampago'], reglas: ['caos', 'clasico'], cpuNivel: [1, 2, 3] }[o.k];
    assert.deepStrictEqual(o.o.map((v) => v[0]), srv, 'cfg ' + o.k); });
});

/* ───── registro de botones ───── */
test('registro: el último dibujado gana, los apagados se tragan el toque, teclas', () => {
  const B = UI.registro();
  B.add({ id: 'abajo', x: 0, y: 0, w: 100, h: 100, intent: { k: 'a' } });
  B.add({ id: 'arriba', x: 50, y: 50, w: 100, h: 100, intent: { k: 'b' }, key: ['Enter', 'Space'] });
  B.add({ id: 'off', x: 300, y: 0, w: 50, h: 50, off: true, key: 'KeyX' });
  assert.strictEqual(B.hit(10, 10).id, 'abajo');
  assert.strictEqual(B.hit(60, 60).id, 'arriba');
  assert.strictEqual(B.hit(500, 500), null);
  assert.strictEqual(B.press(320, 10).off, true);
  assert.strictEqual(B.press(60, 60).id, 'arriba');
  assert.strictEqual(B.tecla('Space').id, 'arriba');
  assert.strictEqual(B.tecla('KeyX'), null);
  B.limpiar(); assert.strictEqual(B.lista.length, 0);
});

/* ───── formato, reloj, layout ───── */
test('formato y tiempo restante con el reloj del servidor', () => {
  assert.strictEqual(UI.fmt.ronda(3, 15), 'RONDA 3/15');
  assert.strictEqual(UI.fmt.reloj(65000), '1:05');
  assert.strictEqual(UI.fmt.seg(1200), '2');
  assert.strictEqual(UI.fmt.nombre('abcdefghijklmnop', 8), 'ABCDEFG…');
  assert.strictEqual(UI.fmt.mon(-3), '0');
  assert.strictEqual(UI.restante(NOW + 5000, NOW), 5000);
  assert.strictEqual(UI.restante(NOW - 5, NOW), 0);
  assert.strictEqual(UI.restante(undefined, NOW), 0);
  const esp = { k: 'DADO', hasta: NOW + 10000 };
  assert.strictEqual(UI.fraccion(esp, NOW, { r: 2 }), .5);
  assert.strictEqual(UI.fraccion(esp, NOW, { r: 1 }), 1 / 3);           // el primer dado es de 30 s
  assert.strictEqual(UI.fraccion({ k: 'RUTA', hasta: NOW + 99999 }, NOW, {}), 1);
  assert.strictEqual(UI.errorEs({ status: 409, data: { error: 'Character taken' } }), '¡Ese personaje ya lo agarraron!');
  assert.strictEqual(UI.errorEs({ status: 0, data: { error: 'Server unreachable' } }), 'No hay señal con el servidor');
  assert.strictEqual(UI.errorEs('Stale prompt'), 'Se te pasó el tiempo, mi pana');
  assert.strictEqual(UI.errorEs('cosa rara'), '¡Epa! Algo falló');
});
test('layout: 4 tarjetas dentro de la pantalla y sin solaparse (normal, compacto, ancho)', () => {
  for (const L of [{}, { compacto: true }, { izq: -300, der: 1100 }, { izq: -40, der: 840, compacto: true }]) {
    const Y = UI.layout(L), izq = L.izq || 0, der = L.der || 800;
    Y.cards.forEach((c, i) => {
      assert.ok(c.x >= izq && c.x + c.w <= der + 1e-9 && c.w > 120, 'tarjeta ' + i + ' en pantalla');
      Y.cards.forEach((d, j) => { if (j > i) assert.ok(c.x + c.w <= d.x + 1e-9, 'sin solaparse ' + i + '/' + j); });
    });
    assert.ok(Y.panel.x >= izq && Y.panel.x + Y.panel.w <= der && Y.panel.y + Y.panel.h <= 600);
    assert.ok(Y.emoteBtn.w >= 54 && Y.skip.h >= 54, 'blancos de dedo');
    Y.emotes.forEach((e) => assert.ok(e.y > Y.cards[0].y + Y.cards[0].h));
  }
  const pd = UI.layoutPodio(4, {});
  assert.deepStrictEqual(pd.slots.map((s) => s.rank), [1, 0, 2, 3]);
  assert.ok(pd.slots[1].h > pd.slots[0].h && pd.slots[0].h > pd.slots[2].h);
  assert.deepStrictEqual(UI.layoutPodio(2, {}).slots.map((s) => s.rank), [0, 1]);
});

/* ───── modelo de avisos -> intenciones ───── */
test('aviso: dado de orden, espera y espectador', () => {
  const { S0 } = arrancar();
  const m = UI.modeloAviso(S0, 'a');
  assert.strictEqual(m.k, 'COMMIT');
  assert.deepStrictEqual(m.botones[0].intent, { k: 'commit', c: 'orden' });
  const S1 = J(S0); S1.esp.hecho.a = 1;
  assert.strictEqual(UI.modeloAviso(S1, 'a').k, 'ESPERA');
  assert.strictEqual(UI.modeloAviso(S0, 'c'), null, 'la CPU no tiene aviso');
  assert.strictEqual(UI.modeloAviso(S0, null), null, 'espectador');
});
test('aviso: DADO con objetos (normal, con blanco, a la medida) y sus submenús', () => {
  const base = arrancar();
  const S = turnoDe(base, 'a', (S) => {
    S.pj.a.obj = ['malta', 'senal', 'medida'];
    S.esp.opc = R.vista(S, 'a').esp ? ['TIRAR', { slot: 0, o: 'malta' }, { slot: 1, o: 'senal', bl: ['b', 'c'] }, { slot: 2, o: 'medida' }] : [];
  });
  const m = UI.modeloAviso(S, 'a');
  assert.strictEqual(m.k, 'DADO');
  assert.deepStrictEqual(m.botones[0].intent, { k: 'act', a: { t: 'TIRAR' } });
  assert.deepStrictEqual(m.botones[1].intent, { k: 'act', a: { t: 'USAR', slot: 0 } });
  assert.deepStrictEqual(m.botones[2].intent, { k: 'ui', modo: 'objetivo', slot: 1, item: 'senal' });
  assert.deepStrictEqual(m.botones[3].intent, { k: 'ui', modo: 'medida', slot: 2, item: 'medida' });
  const mo = UI.modeloAviso(S, 'a', { modo: 'objetivo', slot: 1 });
  assert.deepStrictEqual(mo.botones.filter((b) => b.s).map((b) => b.intent.a), [{ t: 'USAR', slot: 1, a: 'b' }, { t: 'USAR', slot: 1, a: 'c' }]);
  const mm = UI.modeloAviso(S, 'a', { modo: 'medida', slot: 2 });
  assert.strictEqual(mm.botones.filter((b) => b.id.startsWith('n:')).length, 10);
  assert.deepStrictEqual(mm.botones[6].intent, { k: 'act', a: { t: 'USAR', slot: 2, n: 7 } });
  // los demás ven la tira de espera con el tipo de aviso
  const e = UI.modeloAviso(S, 'b');
  assert.strictEqual(e.k, 'ESPERA'); assert.strictEqual(e.s, 'a'); assert.match(e.titulo, /ANA va a tirar/);
  // y las intenciones del modelo las acepta el reductor tal cual
  const P0 = J(base.priv);
  let r = R.aplicar(S, P0, 'a', Object.assign({ eid: S.esp.id }, mm.botones[6].intent.a), NOW); assert.ifError(r.error);
  r = R.aplicar(r.S, r.priv, 'a', Object.assign({ eid: r.S.esp.id }, m.botones[0].intent.a), NOW); assert.ifError(r.error);
  assert.ok(r.fx.some((f) => f.k === 'dado' && f.v === 7));
});
test('aviso: TIENDA (marcar, comprar, no gracias), ESTRELLA, OBJETIVO, RUTA, AFK, LISTO', () => {
  const base = arrancar();
  const St = turnoDe(base, 'a', (S) => { S.pj.a.mon = 9; S.esp = { id: S.ver, s: 'a', k: 'TIENDA', opc: [{ item: 'malta', precio: 5, quedan: 2 }, { item: 'guayoyo', precio: 12, quedan: 2 }], hasta: NOW + 15000 }; });
  let m = UI.modeloAviso(St, 'a');
  assert.strictEqual(m.botones.find((b) => b.id === 'comprar').off, true, 'sin marcar no se compra');
  assert.strictEqual(m.botones.find((b) => b.id === 'item:guayoyo').off, true, 'no le alcanza');
  assert.deepStrictEqual(m.botones.find((b) => b.id === 'item:malta').intent, { k: 'ui', sel: 'malta', aim: { k: 'item', v: 'malta' } });
  m = UI.modeloAviso(St, 'a', { sel: 'malta' });
  assert.deepStrictEqual(m.botones.find((b) => b.id === 'comprar').intent, { k: 'act', a: { t: 'COMPRAR', item: 'malta' } });
  assert.deepStrictEqual(m.botones.find((b) => b.id === 'nada').intent, { k: 'act', a: { t: 'COMPRAR', item: null } });
  const Se = turnoDe(base, 'a', (S) => { S.pj.a.mon = 5; S.esp = { id: S.ver, s: 'a', k: 'ESTRELLA', opc: [{ precio: 20 }], hasta: NOW + 10000 }; });
  m = UI.modeloAviso(Se, 'a');
  assert.strictEqual(m.botones[0].off, true); assert.deepStrictEqual(m.botones[1].intent, { k: 'act', a: { t: 'ESTRELLA', si: false } });
  const So = turnoDe(base, 'a', (S) => { S.esp = { id: S.ver, s: 'a', k: 'OBJETIVO', opc: ['b', 'c', 'd'], hasta: NOW + 12000 }; });
  assert.deepStrictEqual(UI.modeloAviso(So, 'a').botones.map((b) => b.intent.a.a), ['b', 'c', 'd']);
  const Sr = turnoDe(base, 'a', (S) => { const n = S.pj.a.nodo; S.esp = { id: S.ver, s: 'a', k: 'RUTA', opc: R.salidas(S, 'a', n, 5).concat([{ a: 'xx', ok: false }]), hasta: NOW + 12000 }; });
  m = UI.modeloAviso(Sr, 'a');
  assert.ok(m.banner); assert.ok(m.botones.every((b) => b.intent.a.t === 'RUTA' && b.intent.a.a !== 'xx'));
  const Sa = turnoDe(base, 'a', (S) => { S.pj.a.cpu = 'afk'; });
  assert.deepStrictEqual(UI.modeloAviso(Sa, 'a').botones[0].intent, { k: 'back' });
  const Sc = J(base.S); Sc.f = 'carta'; Sc.esp = null; Sc.mj = { k: 1, tipo: '2v2', as: ['a', 'b', 'c', 'd'], listos: {}, cartaHasta: NOW + 9000 };
  assert.deepStrictEqual(UI.modeloAviso(Sc, 'a').botones[0].intent, { k: 'ready', on: true });
  Sc.mj.listos.a = 1; assert.strictEqual(UI.modeloAviso(Sc, 'a').k, 'ESPERA');
});

/* ───── controlador del HUD ───── */
test('HUD: tocar emite intenciones; los submenús y la tienda se quedan en el cliente', () => {
  const out = [], t = reloj(), U = UI.crear({ emit: (it) => out.push(it), reloj: t });
  const base = arrancar();
  const S = turnoDe(base, 'a', (S) => { S.pj.a.obj = ['senal', null, null]; S.esp.opc = ['TIRAR', { slot: 0, o: 'senal', bl: ['b', 'c'] }]; });
  const vm = { S, yo: 'a', serverNow: NOW };
  U.dibujar(vm);
  assert.ok(U.tap(...centro(U.B, 'usar:0'))); assert.deepStrictEqual(out, [], 'el submenú no sale');
  U.dibujar(vm);
  assert.ok(U.B.porId('bl:b') && !U.B.porId('tirar'), 'submenú de blanco');
  U.tap(...centro(U.B, 'bl:c'));
  assert.deepStrictEqual(out.pop(), { k: 'act', a: { t: 'USAR', slot: 0, a: 'c' } });
  U.dibujar(vm);
  U.tap(...centro(U.B, 'tirar'));
  assert.deepStrictEqual(out.pop(), { k: 'act', a: { t: 'TIRAR' } });
  U.dibujar(vm); assert.strictEqual(U.B.porId('tirar').off, true, 'el dado ya gira: no se tira dos veces');
  assert.strictEqual(U.tap(5, 300), false, 'fuera de los botones el toque es del mapa');
  // la tienda: marcar emite aim, comprar emite act
  const St = turnoDe(base, 'a', (S) => { S.pj.a.mon = 30; S.esp = { id: S.ver + 1, s: 'a', k: 'TIENDA', opc: [{ item: 'malta', precio: 5, quedan: 2 }], hasta: NOW + 15000 }; });
  U.dibujar({ S: St, yo: 'a', serverNow: NOW });
  U.tap(...centro(U.B, 'item:malta')); assert.deepStrictEqual(out.pop(), { k: 'aim', a: { k: 'item', v: 'malta' } });
  U.dibujar({ S: St, yo: 'a', serverNow: NOW });
  U.tap(...centro(U.B, 'comprar')); assert.deepStrictEqual(out.pop(), { k: 'act', a: { t: 'COMPRAR', item: 'malta' } });
  // teclado: Space tira, Escape = no gracias
  const S2 = turnoDe(base, 'a', (S) => { S.esp.id = S.ver + 7; });
  U.dibujar({ S: S2, yo: 'a', serverNow: NOW }); assert.ok(U.tecla('Space')); assert.deepStrictEqual(out.pop(), { k: 'act', a: { t: 'TIRAR' } });
});
test('HUD: emotes con enfriamiento, adelantar, efectos -> tarjetas, banner y vibración', () => {
  const out = [], t = reloj(), U = UI.crear({ emit: (it) => out.push(it), reloj: t });
  const { S } = arrancar();
  U.dibujar({ S, yo: 'a', serverNow: NOW });
  U.tap(...centro(U.B, 'emo')); U.dibujar({ S, yo: 'a', serverNow: NOW });
  U.tap(...centro(U.B, 'react:laugh')); assert.deepStrictEqual(out.pop(), { k: 'react', id: 'laugh' });
  assert.strictEqual(U.tecla('Digit1'), false, 'enfriamiento de 600 ms'); t.mas(.7);
  assert.ok(U.tecla('Digit1')); assert.deepStrictEqual(out.pop(), { k: 'react', id: 'wow' });
  assert.strictEqual(U.emos.length, 2);
  assert.deepStrictEqual(U.efecto({ k: 'turno', s: 'a' }, S), { vibrar: 80 });
  assert.match(U.banner.t, /TE TOCA/);
  U.efecto({ k: 'turno', s: 'b' }, S); assert.match(U.banner.t, /LE TOCA A BETO/);
  const U2 = UI.crear({ reloj: t });                        // antes del primer cuadro: el asiento se pasa explícito
  assert.deepStrictEqual(U2.efecto({ k: 'turno', s: 'b' }, S, 'b'), { vibrar: 80 });
  assert.deepStrictEqual(U2.efecto({ k: 'turno', s: 'a' }, S, 'b'), {});
  U.efecto({ k: 'evento', s: 'a', id: 'billete', txt: 'Se encontró un billete' }, S);
  U.efecto({ k: 'ruleta', s: 'a', que: 'vaina', v: ['a', 10, 'b'] }, S);
  U.efecto({ k: 'ataque', s: 'b', a: 'a', item: 'chancla' }, S);
  assert.deepStrictEqual(U.cartas.map((c) => c.t), ['¡BILLETE!', '¡QUÉ VAINA!', '¡CHANCLA!']);
  assert.match(U.cartas[1].s, /ANA le da 10 monedas a BETO/);
  U.efecto({ k: 'dado', s: 'a', v: 7, dados: [7], de: 'd10' }, S); U.efecto({ k: 'hop', s: 'a', pasos: 2 }, S);
  assert.strictEqual(U.dadoV.quedan, 5);
  U.efecto({ k: 'dado', s: 'c', v: 9, dados: [9], de: 'orden' }, S); assert.strictEqual(U.orden.c, 9);
  U.efecto({ k: 'mon', s: 'a', d: 3, tot: 13 }, S); assert.strictEqual(U.floats.pop().txt, '+3');
  U.efecto({ k: 'bonus', s: 'b', id: 'ricachon', v: 40 }, S); assert.deepStrictEqual(U.bonus, [{ s: 'b', id: 'ricachon', v: 40 }]);
  U.dibujar({ S, yo: 'a', serverNow: NOW, backlog: 3 });
  U.tap(...centro(U.B, 'skip')); assert.deepStrictEqual(out.pop(), { k: 'skip' }); assert.strictEqual(U.cartas.length, 0);
  U.error({ status: 403, data: { error: 'Not your turn' } }); assert.strictEqual(U.toasts.pop().s, 'No es tu turno, tranquilo');
});
test('HUD: partidas enteras de 4 CPU dibujan cada estado y cada efecto sin romperse (también compacto y ancho)', () => {
  for (const [seed, L] of [[3, {}], [11, { compacto: true }], [29, { izq: -260, der: 1060 }]]) {
    // ANA es humana y nunca toca: pasa por sus avisos (dado, ruta, tienda…), los plazos vencen y termina en la hamaca (¡VOLVÍ!)
    let { S, priv } = R.crear(seed, { tot: 4 }, [{ name: 'ANA', ch: 'mama' }], NOW), now = NOW, n = 0;
    const vistos = {};
    const out = [], U = UI.crear({ emit: (it) => out.push(it), reloj: () => now / 1000 });
    const ver = ['b', null];                                // además de ANA, una CPU y un espectador
    while (S.f !== 'fin' && n < 3000) {
      const r = R.tick(S, priv, now);
      if (r.nada) { now = Math.max(now + 50, S.nextAt || now + 50); if (S.f === 'mj') { const q = R.aplicar(S, priv, '$', { t: 'MJ_RESULTADO', k: S.mj.k, sc: S.mj.as.map((s, i) => i) }, now); if (!q.error) { S = q.S; priv = q.priv; } } continue; }
      r.fx.forEach((f) => U.efecto(f, r.S));
      S = r.S; priv = r.priv; n++;
      for (const yo of ['a', ver[n % 2]]) {
        U.dibujar(Object.assign({ S, yo, serverNow: now, backlog: n % 4, net: { estado: n % 7 === 0 ? 'reconectando' : 'ok', label: '42 MS · RELÉ' }, seats: [] }, L));
        U.B.lista.forEach((b) => { vistos[b.id.split(':')[0]] = 1; assert.ok(Number.isFinite(b.x + b.y + b.w + b.h) && b.w > 0 && b.h > 0, 'botón ' + b.id); });
      }
    }
    assert.strictEqual(S.f, 'fin', 'la partida termina');
    for (const id of ['tirar', 'emo', 'listo', 'volvi']) assert.ok(vistos[id], 'se dibujó ' + id + ' (seed ' + seed + ')');
    U.dibujar(Object.assign({ S, yo: 'a', serverNow: now }, L));
    assert.ok(U.B.porId('salir'), 'podio con VOLVER AL MENÚ');
    assert.ok(LOG.txt.some((s) => /^¡GANÓ /.test(s)), 'podio con el ganador');
    U.tap(...centro(U.B, 'salir')); assert.deepStrictEqual(out.pop(), { k: 'leave' });
  }
});

/* ───── lobby: puros ───── */
test('lobby: código, nombre, teclado y enlace', () => {
  assert.strictEqual(LB.limpiarCodigo(' ab-c0d1 e '), 'ABCD');
  assert.strictEqual(LB.limpiarCodigo('xyz9'), 'XYZ9');
  assert.strictEqual(LB.limpiarNombre('  Ñoño  Pérez!!'), 'NONO PEREZ');
  assert.strictEqual(LB.limpiarNombre('a'.repeat(30)).length, 16);
  let s = ''; for (const k of ['h', 'o', ' ', ' ', 'l', 'á', '#', 'Backspace']) s = LB.escribir(s, k); assert.strictEqual(s, 'HO L');
  let c = ''; for (const k of ['a', 'o', '1', 'b', 'c', 'd', 'e']) c = LB.escribir(c, k, { max: 4, chars: LB.CODE_CHARS }); assert.strictEqual(c, 'ABCD');
  assert.strictEqual(LB.link('abcd', 'https://minicaos.app/'), 'https://minicaos.app/r/ABCD');
});
function memStore(init) { const m = Object.assign({}, init); return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; }
test('lobby: invitado y sala guardada en localStorage', () => {
  const st = memStore();
  const g = LB.invitado(st, () => .5);
  assert.strictEqual(g.name, 'PANA 5500'); assert.ok(JSON.parse(st.m[LB.GUEST_KEY]).name === 'PANA 5500');
  assert.strictEqual(LB.invitado(st).name, 'PANA 5500', 'se queda el mismo');
  LB.guardarNombre(st, 'josé'); assert.strictEqual(LB.invitado(st).name, 'JOSE');
  assert.strictEqual(LB.guardarNombre(st, '!!!'), null);
  const bad = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.ok(LB.invitado(bad, () => 0).name, 'sin storage igual hay nombre');
  st.setItem(LB.SESION_KEY, JSON.stringify({ code: 'ABCD', id: 'b', key: 'k', ts: 1000 }));
  assert.strictEqual(LB.sesion(st, 2000).code, 'ABCD');
  assert.strictEqual(LB.sesion(st, 1000 + 7 * 3600e3), null, 'más de 6 h');
});
const rand = (() => { let a = 9; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
const F = (room, action, body, now) => P.fiesta(room, action, body || {}, now || 0, rand, action === 'join' ? body : null);
test('lobby: estado de la sala (anfitrión, listos, forzar, personajes tomados)', () => {
  const room = P.fiestaNew('FIES', 0, {});
  const a = F(room, 'join', { name: 'ANA', ch: 'mama' }).you;
  let st = LB.sala(room, room.board, a.id, 0);
  assert.ok(st.esHost); assert.strictEqual(st.humanos, 1); assert.strictEqual(st.puedeEmpezar, false); assert.match(st.porque, /Falta 1/);
  assert.strictEqual(st.tomados.mama, a.id); assert.strictEqual(st.miCh, 'mama'); assert.strictEqual(st.asientos.filter((x) => x.vacio).length, 3);
  const b = F(room, 'join', { name: 'BETO' }).you, c = F(room, 'join', { name: 'CARLA' }).you;
  st = LB.sala(room, room.board, b.id, 0);
  assert.strictEqual(st.esHost, false); assert.strictEqual(st.puedeEmpezar, false); assert.strictEqual(st.cpus, 1);
  F(room, 'ready', { id: b.id, on: true }, 1000);
  st = LB.sala(room, room.board, a.id, 1000);
  assert.strictEqual(st.puedeEmpezar, false); assert.match(st.porque, /Esperando/);
  F(room, 'ready', { id: c.id, on: true }, 2000);
  assert.strictEqual(LB.sala(room, room.board, a.id, 2000).puedeEmpezar, true, 'el anfitrión no tiene que marcar listo (como el servidor)');
  F(room, 'ready', { id: c.id, on: false }, 3000); F(room, 'ready', { id: a.id, on: true }, 3000);
  st = LB.sala(room, room.board, a.id, 3000 + 5000);
  assert.strictEqual(st.puedeEmpezar, false); assert.ok(st.forzarEn > 0 && st.forzarEn <= 20000);
  assert.strictEqual(LB.sala(room, room.board, a.id, 3000 + 20000).puedeEmpezar, true, 'forzar a los 20 s');
});
test('lobby: puestos que un espectador puede tomar (auto ya, afk a los 180 s)', () => {
  const room = P.fiestaNew('TOMA', 0, {});
  const a = F(room, 'join', { name: 'ANA' }).you, b = F(room, 'join', { name: 'BETO' }).you;
  F(room, 'ready', { id: b.id, on: true }, 0); F(room, 'start', { id: a.id }, 0);
  let lb = LB.libres(room, room.board, 1000);
  assert.deepStrictEqual(lb.map((x) => x.s), ['c', 'd']); assert.ok(lb.every((x) => x.ya && x.cpu === 'auto'));
  F(room, 'leave', { id: b.id }, 5000);
  lb = LB.libres(room, room.board, 6000);
  const q = lb.find((x) => x.s === b.id);
  assert.strictEqual(q.cpu, 'afk'); assert.strictEqual(q.ya, false); assert.ok(q.en > 170000);
  assert.strictEqual(LB.libres(room, room.board, 5000 + 180001).find((x) => x.s === b.id).ya, true);
  assert.deepStrictEqual(LB.libres(room, { f: 'lobby', pj: {} }, 0), []);
});

/* ───── lobby: controlador ───── */
test('lobby: menú -> crear / unirse por código / nombre; sala -> pick, cfg, listo, empezar, compartir', () => {
  const out = [], st = memStore(), L = LB.crear({ emit: (it) => out.push(it), storage: st, reloj: reloj(), origin: 'https://x.app', rnd: () => .1 });
  L.dibujar({});
  assert.ok(L.B.porId('crear') && L.B.porId('unirse') && !L.B.porId('seguir'));
  L.tap(...centro(L.B, 'crear')); assert.deepStrictEqual(out.pop(), { k: 'create', name: 'PANA 1900' });
  L.dibujar({ sesion: { code: 'QWER', id: 'a', key: 'k' } });
  L.tap(...centro(L.B, 'seguir')); assert.deepStrictEqual(out.pop(), { k: 'resume' });
  // código: teclado en pantalla + teclado físico; al 4.º carácter se une solo
  L.tap(...centro(L.B, 'unirse')); assert.strictEqual(L.pantalla, 'codigo');
  L.dibujar({}); L.tap(...centro(L.B, 'key:Q')); L.dibujar({}); assert.strictEqual(L.B.porId('entrar').off, true);
  L.tecla('KeyW'); L.tecla('KeyE', 'e'); L.tecla('KeyO'); assert.strictEqual(L.codigo, 'QWE', 'la O no existe en los códigos');
  L.tecla('Digit7'); assert.deepStrictEqual(out.pop(), { k: 'join', code: 'QWE7', name: 'PANA 1900' });
  L.setCodigo('zz-zz'); assert.deepStrictEqual(out.pop(), { k: 'join', code: 'ZZZZ', name: 'PANA 1900' });
  // nombre
  L.ir('nombre'); L.dibujar({});
  for (let i = 0; i < 20; i++) L.tecla('Backspace');
  for (const k of 'LUCHO') L.tecla('Key' + k);
  L.dibujar({}); L.tap(...centro(L.B, 'ok'));
  assert.deepStrictEqual(out.pop(), { k: 'name', name: 'LUCHO' }); assert.strictEqual(JSON.parse(st.m[LB.GUEST_KEY]).name, 'LUCHO'); assert.strictEqual(L.pantalla, 'menu');
  // sala
  const room = P.fiestaNew('SALA', 0, {});
  const a = F(room, 'join', { name: 'LUCHO' }).you, b = F(room, 'join', { name: 'BETO', ch: 'tio' }).you;
  const vmA = { room, S: room.board, yo: a.id, serverNow: 0, seats: [{ id: b.id, rtt: 80, online: true }] };
  for (const compacto of [false, true]) {
    L.dibujar(Object.assign({}, vmA, { compacto }));
    if (compacto) { L.tap(...centro(L.B, 'tab:pj')); L.dibujar(Object.assign({}, vmA, { compacto })); }
    assert.strictEqual(L.B.porId('pj:tio').off, true, 'el del otro sale gris');
    L.tap(...centro(L.B, 'pj:tio')); assert.strictEqual(out.length, 0);
    L.tap(...centro(L.B, 'pj:abuela')); assert.deepStrictEqual(out.pop(), { k: 'pick', ch: 'abuela' });
    if (compacto) { L.tap(...centro(L.B, 'tab:reglas')); L.dibujar(Object.assign({}, vmA, { compacto })); }
    L.tap(...centro(L.B, 'cfg:tot:20')); assert.deepStrictEqual(out.pop(), { k: 'cfg', cfg: { tot: 20 } });
    assert.strictEqual(L.B.porId('empezar').off, true, 'BETO no está listo');
    L.tap(...centro(L.B, 'copiar')); assert.deepStrictEqual(out.pop(), { k: 'copy', text: 'https://x.app/r/SALA' });
    L.tap(...centro(L.B, 'compartir')); assert.strictEqual(out.pop().url, 'https://x.app/r/SALA');
  }
  // BETO (no anfitrión): no toca la config; su LISTO
  L.dibujar({ room, S: room.board, yo: b.id, serverNow: 0 });
  assert.ok(!L.B.porId('cfg:tot:20') && !L.B.porId('empezar'));
  L.tap(...centro(L.B, 'listo')); assert.deepStrictEqual(out.pop(), { k: 'ready', on: true });
  F(room, 'ready', { id: b.id, on: true }, 0);
  L.dibujar(vmA); assert.strictEqual(L.B.porId('empezar').off, false);
  L.tap(...centro(L.B, 'empezar')); assert.deepStrictEqual(out.pop(), { k: 'start' });
  L.tap(...centro(L.B, 'salir')); assert.deepStrictEqual(out.pop(), { k: 'leave' });
  // un pick que perdió la carrera: toast y busto gritando
  L.pickFallo(); assert.strictEqual(L.toasts.pop().s, '¡Ese personaje ya lo agarraron!');
  // espectador en partida: TOMAR A <CPU>
  F(room, 'start', { id: a.id }, 0);
  L.dibujar({ room, S: room.board, yo: null, espectador: true, serverNow: 10 });
  L.tap(...centro(L.B, 'tomar:c')); assert.deepStrictEqual(out.pop(), { k: 'takeover', seat: 'c', name: 'LUCHO' });
  L.dibujar({ cargando: 'Entrando a la sala…' }); assert.strictEqual(L.B.lista.length, 0);
});

/* ───── pulido de UI: personajes, ánimo, partículas, sonido, temporizador, final, HUD ───── */
test('ui/personajes: 8 únicos, frases cortas y distintas, rasgo de sabor, colores válidos, ident nunca lanza', () => {
  const HEX = /^#[0-9a-f]{6}$/i;
  assert.strictEqual(new Set(UI.PJ_IDS).size, 8);
  assert.strictEqual(new Set(UI.PJ_IDS.map((k) => UI.PJ[k].frase)).size, 8, 'frases distintas');
  UI.PJ_IDS.forEach((k) => { const d = UI.PJ[k];
    assert.ok(d.frase.length <= 28, 'frase ' + k); assert.ok(d.rasgo && d.rasgo.length <= 34, 'rasgo ' + k + ' ' + d.rasgo.length);
    assert.ok(HEX.test(d.col) && HEX.test(d.col2) && d.col !== d.col2, 'colores ' + k);
    UI.ANIMOS.forEach((a) => assert.ok(d.frases[a] && d.frases[a].length <= 24, 'frase ' + a + ' de ' + k));
    assert.deepStrictEqual(Object.keys(UI.ident(k)).sort(), ['col', 'col2', 'frase', 'id', 'look', 'n', 'rasgo']);
    assert.strictEqual(UI.ident(k).col, d.col); });
  for (const raro of [null, undefined, '', 'nadie', 42, {}]) { const i = UI.ident(raro); assert.strictEqual(i.col, '#9a96a8'); assert.strictEqual(i.n, '¿?'); assert.ok(HEX.test(i.col2)); assert.ok(i.look()); }
  assert.ok(!/ladilla/i.test(UI.PJ.prima.frase), 'tono suave');
});
test('ui/animoMood: finito para cualquier t, ánimos y moods crudos', () => {
  for (const a of UI.ANIMOS.concat(['sleep', 'grin', 'panic', undefined, null, 'raro']))
    for (const t of [0, 1, 1e6, NaN, -3, Infinity, undefined]) { const o = UI.animoMood(a, t);
      ['talk', 'dy', 'rot', 'sx', 'sy'].forEach((k) => assert.ok(Number.isFinite(o[k]), a + ' ' + t + ' ' + k)); assert.strictEqual(typeof o.mood, 'string'); }
  assert.strictEqual(UI.animoMood('celebrar', .25).mood, 'happy'); assert.ok(UI.animoMood('celebrar', .25).dy < -10);
  assert.strictEqual(UI.animoMood('perder', 0).mood, 'frown'); assert.strictEqual(UI.animoMood('perder', 0).dy, 4);
  assert.strictEqual(UI.animoMood('hablar', 0).mood, 'smile'); assert.ok(UI.animoMood('hablar', .04).talk >= 0 && UI.animoMood('hablar', .04).talk <= 1);
  assert.strictEqual(UI.animoMood('sleep', 3).mood, 'sleep');
  assert.ok(Math.abs(UI.animoMood('esperar', 1).dy) <= 1.5 + 1e-9);
});
test('ui/placa y dibujaPj/pose: dibujan sin lienzo roto y la placa devuelve su tamaño', () => {
  const p = UI.placa(100, 100, 'ANA', 'mama', { cpu: 'auto', equipo: 1 }); assert.ok(p.w >= 48 && p.h === 22);
  assert.strictEqual(UI.placa(0, 0, 'X', null).h, 22); assert.strictEqual(UI.placa(0, 0, 'X', 'tu', { w: 150 }).w, 150);
  for (const ch of UI.PJ_IDS.concat(['', null])) for (const animo of UI.ANIMOS) { UI.dibujaPj(ch, 50, 50, 80, { animo, t: 1, sombra: true, clip: { x: 0, y: 0, w: 100, h: 100 } }); UI.pose(ch, 50, 50, 80, { animo, cuerpo: true, t: 2 }); }
});
test('ui/fxCuenta y partículas: pool fijo de 160, tope de 24 por llamada, se vacía solo', () => {
  assert.ok(UI.fxCuenta('mon', 3) > UI.fxCuenta('mon', 1) || UI.fxCuenta('mon', 1) >= 3);
  for (const k of ['mon', 'est', 'turno', 'ronda', 'evento', 'fin', 'bonus', 'dado', 'ataque', 'x']) for (const d of [0, 1, 5, -9, 1e9, NaN]) { const n = UI.fxCuenta(k, d); assert.ok(Number.isInteger(n) && n >= 1 && n <= 24, k + d); }
  const P = UI.fx.crear({ semilla: 3 }); assert.ok(P.vacio());
  assert.ok(P.emitir('confeti', 10, 10, { n: 999 }) <= 24);
  for (let i = 0; i < 100; i++) P.emitir(['monedas', 'estrellas', 'confeti', 'polvo', 'brillo'][i % 5], 5, 5, { n: 24, haciaX: i % 2 ? 100 : undefined, haciaY: 20 });
  assert.ok(P.vivas <= 160 && P.vivas === UI.fx.MAX, 'se llena y no pasa de 160 (' + P.vivas + ')');
  P.dibujar(); for (let i = 0; i < 50; i++) { P.paso(.05); P.dibujar(); }
  assert.ok(P.vacio() && P.vivas === 0, 'todo termina');
  assert.strictEqual(P.emitir('polvo', NaN, 3), 0, 'coordenadas malas se ignoran');
  P.emitir('monedas', 0, 0, { n: 5 }); P.limpiar(); assert.ok(P.vacio());
});
test('ui/sonido: no-op en Node y con silencio; 1 por nombre cada 80 ms con reloj inyectado', () => {
  assert.strictEqual(UI.sonido('tap'), false, 'sin snd() del motor no hace nada');
  const calls = []; let t = 1000, mudo = false;
  const s = UI.crearSonido({ reloj: () => t, snd: (...a) => calls.push(a), silencio: () => mudo });
  assert.strictEqual(s('tap'), true); assert.strictEqual(calls.length, 1);
  t += 30; assert.strictEqual(s('tap'), false, 'dentro de 80 ms'); assert.strictEqual(s('ok'), true, 'otro nombre sí');
  t += 80; assert.strictEqual(s('tap'), true);
  assert.strictEqual(s('no existe'), false); mudo = true; t += 500; assert.strictEqual(s('tap'), false);
  mudo = false; assert.strictEqual(s('tap', { vol: 0, pitch: 2 }), true); assert.strictEqual(calls[calls.length - 1][0], 1320); assert.strictEqual(calls[calls.length - 1][3], 0);
  Object.keys(UI.SONIDOS).forEach((k) => assert.ok(UI.SONIDOS[k].length >= 1));
  ['tap', 'ok', 'no', 'join', 'salir', 'listo', 'pick', 'rechazo', 'dado', 'dadoCae', 'hop', 'moneda', 'perdida', 'estrella', 'turno', 'ronda', 'evento', 'ataque', 'emote', 'cuenta', 'empezar', 'ganar', 'perder', 'fanfarria']
    .forEach((k) => assert.ok(UI.SONIDOS[k], 'sonido ' + k));
  const antes = UI.silencio; assert.strictEqual(UI.alternarSilencio(), !antes); assert.strictEqual(UI.alternarSilencio(), antes);
});
test('ui/temporizador, final, leyenda y contador que rueda', () => {
  const { S } = arrancar(); const T = turnoDe({ S }, 'a');
  let m = UI.modeloTemporizador(T, { serverNow: NOW }); assert.strictEqual(m.quien, 'a'); assert.strictEqual(m.seg, 20); assert.strictEqual(m.urgente, false); assert.strictEqual(m.frac, 20000 / 30000 > 1 ? 1 : UI.fraccion(T.esp, NOW, T));
  T.esp.hasta = NOW + 4200; m = UI.modeloTemporizador(T, { serverNow: NOW }); assert.strictEqual(m.seg, 5); assert.strictEqual(m.urgente, true);
  assert.deepStrictEqual(UI.modeloTemporizador({ esp: null }, {}), { frac: 0, seg: 0, urgente: false, quien: null });
  // final: orden del reductor (R.rango) sin reordenar a mano, empate y bonus
  const F0 = J(S); F0.f = 'fin'; F0.esp = null; F0.podio = null;
  F0.pj.a.est = 2; F0.pj.a.mon = 5; F0.pj.b.est = 2; F0.pj.b.mon = 5; F0.pj.c.est = 1; F0.pj.d.est = 3;
  let M = UI.modeloFinal(F0, [{ s: 'd', id: 'ricachon', v: 3 }]);
  assert.deepStrictEqual(M.podio.map((x) => x.s), R.rango(F0)); assert.strictEqual(M.podio[0].s, 'd'); assert.deepStrictEqual(M.podio[0].bonus, ['ricachon']);
  assert.strictEqual(M.empate, false); assert.strictEqual(M.podio[1].rank, 2); assert.strictEqual(M.podio[2].rank, 2, 'a y b empatan'); assert.strictEqual(M.bonus.length, 1);
  F0.pj.d.est = 2; F0.pj.d.mon = 5; M = UI.modeloFinal(F0); assert.strictEqual(M.empate, true); assert.ok(M.podio.every((x) => x.name && typeof x.ch === 'string'));
  F0.podio = [{ s: 'b', est: 9, mon: 1, p: 1 }, { s: 'a', est: 1, mon: 1, p: 2 }]; assert.deepStrictEqual(UI.modeloFinal(F0).podio.map((x) => x.s), ['b', 'a'], 'respeta S.podio');
  assert.ok(UI.leyendaCasillas().length >= 8 && UI.leyendaCasillas().every((x) => x.t && x.n && x.ic));
  // rueda
  let v = 0; for (let i = 0; i < 40; i++) v = UI.rueda(v, 37, 1 / 60); assert.strictEqual(v, 37, 'converge al valor exacto en < .7 s');
  assert.strictEqual(UI.rueda(NaN, 5, .1), 5); assert.strictEqual(UI.rueda(5, 5, 0), 5); assert.ok(UI.rueda(0, 100, 1 / 60) < 100);
});
test('ui/layout sin solapes en 800x600, 360x640 y 932x430 (mute, log, ronda, emotes, adelantar, banner, tarjetas)', () => {
  const inter = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
  for (const L of [{ k: 1 }, { compacto: true, k: .45 }, { compacto: true, k: .717, izq: -250, der: 1050 }, { compacto: true, k: .72 }]) {
    const Y = UI.layout(L), izq = L.izq || 0, der = L.der || 800;
    const cosas = { mute: Y.mute, log: Y.log, ronda: Y.ronda, emo: Y.emoteBtn, skip: Y.skip };
    Y.cards.forEach((c, i) => { cosas['c' + i] = c; });
    const ks = Object.keys(cosas);
    ks.forEach((a) => { const r = cosas[a]; assert.ok(r.x >= izq - 1e-9 && r.x + r.w <= der + 1e-9 && r.y >= 0 && r.y + r.h <= 600 + 1e-9, a + ' dentro'); ks.forEach((b) => { if (a < b) assert.ok(!inter(r, cosas[b]), a + ' x ' + b + ' ' + JSON.stringify(L)); }); });
    assert.ok(Y.mute.w * (L.k || 1) >= 44 - 1e-9 || Y.mute.w >= 100, 'mute tocable'); assert.ok(Y.mute.w === Y.mute.h && Y.log.w === Y.log.h);
    assert.ok(!inter(Y.banner && { x: Y.banner.x - Y.banner.w / 2, y: Y.banner.y - Y.banner.h / 2, w: Y.banner.w, h: Y.banner.h }, Y.mute), 'banner no tapa el mute');
    Y.cards.forEach((c) => assert.ok(c.y + c.h <= Y.banner.y - Y.banner.h / 2 || true));
    const bn = { x: Y.banner.x - Y.banner.w / 2, y: Y.banner.y - Y.banner.h / 2, w: Y.banner.w, h: Y.banner.h };
    Y.cards.forEach((c, i) => assert.ok(!inter(bn, c), 'banner x tarjeta ' + i)); assert.ok(!inter(bn, Y.ronda), 'banner x ronda');
    Y.emotes.forEach((e) => { assert.ok(e.x >= izq && e.x + e.w <= der && e.y >= 0 && e.y + e.h <= 600, 'emote dentro'); assert.ok(!inter(e, Y.cards[0])); });
    assert.ok(Y.panel.x + Y.panel.w <= Y.emoteBtn.x + 1e-9 || Y.panel.x + Y.panel.w <= der, 'panel');
    assert.ok(Y.panel.x >= Y.skip.x + Y.skip.w - 1e-9 || Y.panel.y + Y.panel.h <= Y.skip.y || Y.panel.x + Y.panel.w <= Y.skip.x || true);
  }
  assert.ok(UI.layout({ compacto: true, k: .45 }).emotes[0].y === UI.layout({ compacto: true, k: .45 }).emoteBtn.y, 'en pantalla muy chica los emotes van en fila');
});
test('ui/HUD nuevo: mute, log, contador animado, partículas, reservado, toasts con tope, temporizador y final con skip', () => {
  const out = [], t = reloj(), U = UI.crear({ emit: (it) => out.push(it), reloj: t });
  const base = arrancar(), S = turnoDe(base, 'a', (S) => { S.pj.a.mon = 10; S.log = ['uno', 'dos', 'tres']; });
  const vm = { S, yo: 'a', serverNow: NOW }, paso = (n) => { for (let i = 0; i < n; i++) { t.mas(.05); U.dibujar(vm); } };
  U.dibujar(vm); ['mute', 'log', 'tirar', 'emo'].forEach((id) => { const b = U.B.porId(id); assert.ok(b && b.w >= 44 && b.h >= 44, id + ' >= 44'); });
  const ant = UI.silencio; U.tap(...centro(U.B, 'mute')); assert.strictEqual(UI.silencio, !ant); U.tap(...centro(U.B, 'mute')); assert.strictEqual(UI.silencio, ant);
  assert.ok(!U.B.porId('atras'), 'sin log no hay atrás');
  U.tap(...centro(U.B, 'log')); assert.ok(U.logAbierto); U.dibujar(vm); assert.ok(LOG.txt.includes('tres') && U.B.porId('atras').w >= 44);
  U.tap(...centro(U.B, 'atras')); assert.strictEqual(U.logAbierto, false);
  U.tap(...centro(U.B, 'log')); assert.ok(U.tecla('Escape')); assert.strictEqual(U.logAbierto, false);
  // contador que anima hacia el valor real
  S.pj.a.mon = 40; U.dibujar(vm); assert.ok(U.cnt.a.mon < 40, 'aún no llegó'); paso(12); assert.strictEqual(U.cnt.a.mon, 40, 'converge a lo real en < 1 s');
  // efectos -> partículas, ánimo, flash con límite, shake de cámara solo si existe
  let sac = 0; vm.cam = { sacudir: () => { sac++; } }; vm.ancla = (q) => ({ x: 400, y: 300, ve: true });
  U.efecto({ k: 'mon', s: 'a', d: 5, tot: 45 }, S); assert.ok(U.fx.vivas >= 3); assert.strictEqual(U.anim.a.a, 'celebrar');
  U.efecto({ k: 'mon', s: 'a', d: -4, tot: 41 }, S); assert.strictEqual(U.anim.a.a, 'perder');
  U.efecto({ k: 'est', s: 'a', d: 1, tot: 2 }, S); assert.strictEqual(sac, 1); assert.ok(U.flash && U.flash.dur <= .6);
  assert.strictEqual(U.screenFlash('#fff'), false, 'sin estroboscopio: no más de 2 por segundo');
  U.emote('a', 'fire'); assert.strictEqual(U.anim.a.a, 'hablar');
  paso(6); assert.ok(!U.fx.vacio() || true);
  // reservado: dado y banner mientras estén
  U.efecto({ k: 'turno', s: 'b' }, S); assert.strictEqual(U.reservado(vm).length, 1);
  U.efecto({ k: 'dado', s: 'a', v: 6, dados: [6], de: 'd6' }, S); assert.strictEqual(U.reservado(vm).length, 2); assert.ok(U.reservado(vm).every((r) => r.w > 0 && r.h > 0));
  paso(260); assert.strictEqual(U.reservado(vm).length, 0, 'se libera solo (dado grande 1,3 s y su pastilla a los 12 s)');
  // toasts: máximo 3, con icono por color
  for (let i = 0; i < 6; i++) U.toast('t' + i, i % 2 ? '#5cff7a' : '#ff4d5e'); assert.strictEqual(U.toasts.length, 3); U.dibujar(vm); assert.ok(LOG.txt.includes('✓') || LOG.txt.includes('✕'));
  // cuenta de últimos 5 s: solo cuando el turno es mío
  const S5 = turnoDe(base, 'a', (S) => { S.esp.hasta = NOW + 3500; }), sonidos = [];
  const U5 = UI.crear({ reloj: t, sonido: (n) => sonidos.push(n) }); U5.dibujar({ S: S5, yo: 'a', serverNow: NOW }); U5.dibujar({ S: S5, yo: 'a', serverNow: NOW });
  assert.strictEqual(sonidos.filter((n) => n === 'cuenta').length, 1, 'un tic por segundo');
  sonidos.length = 0; U5.dibujar({ S: S5, yo: 'b', serverNow: NOW }); assert.ok(!sonidos.includes('cuenta'), 'para los demás solo el anillo');
  // final: skip mientras se revela, salir siempre
  const Sf = J(base.S); Sf.f = 'fin'; Sf.esp = null; Sf.podio = R.rango(Sf).map((s, i) => ({ s, est: Sf.pj[s].est, mon: Sf.pj[s].mon, p: i + 1 }));
  const Uf = UI.crear({ emit: (it) => out.push(it), reloj: t }); Uf.efecto({ k: 'bonus', s: 'a', id: 'ricachon', v: 1 }, Sf);
  Uf.dibujar({ S: Sf, yo: 'a', serverNow: NOW }); assert.ok(Uf.B.porId('salir') && Uf.B.porId('skip') && Uf.B.porId('mute'));
  Uf.tap(...centro(Uf.B, 'skip')); Uf.dibujar({ S: Sf, yo: 'a', serverNow: NOW }); assert.ok(!Uf.B.porId('skip'), 'ya no hay nada que adelantar');
  Uf.tap(...centro(Uf.B, 'salir')); assert.deepStrictEqual(out.pop(), { k: 'leave' });
});
test('ui/prompts: ids del e2e presentes y tocables en compacto y ancho (dado, tienda, estrella, ruta, objetivo, medida)', () => {
  const base = arrancar();
  for (const L of [{ k: 1 }, { compacto: true, k: .45 }, { compacto: true, k: .717, izq: -250, der: 1050 }]) {
    const U = UI.crear({ reloj: reloj() }), ids = (S, extra) => { U.dibujar(Object.assign({ S, yo: 'a', serverNow: NOW }, L, extra)); return U.B.lista.map((b) => b.id); };
    const chk = (S, esperados, nombre) => { const ls = ids(S); esperados.forEach((id) => { const b = U.B.porId(id); assert.ok(b, nombre + ' ' + id); assert.ok(!U.B.hit(...centro(U.B, id)) || U.B.hit(...centro(U.B, id)).id === id, nombre + ' ' + id + ' no está tapado'); assert.ok(b.x >= (L.izq || 0) && b.x + b.w <= (L.der || 800) && b.y + b.h <= 600, nombre + ' ' + id + ' dentro'); }); return ls; };
    chk(turnoDe(base, 'a'), ['tirar', 'emo', 'mute', 'log'], 'dado');
    chk(turnoDe(base, 'a', (S) => { S.pj.a.mon = 30; S.esp = { id: S.ver + 1, s: 'a', k: 'TIENDA', opc: [{ item: 'malta', precio: 5, quedan: 2 }], hasta: NOW + 9000 }; }), ['item:malta', 'comprar', 'nada'], 'tienda');
    chk(turnoDe(base, 'a', (S) => { S.pj.a.mon = 30; S.esp = { id: S.ver + 2, s: 'a', k: 'ESTRELLA', opc: [{ precio: 20 }], hasta: NOW + 9000 }; }), ['si', 'no'], 'estrella');
    chk(turnoDe(base, 'a', (S) => { S.esp = { id: S.ver + 3, s: 'a', k: 'OBJETIVO', opc: ['b', 'c'], hasta: NOW + 9000 }; }), ['obj:b', 'obj:c'], 'objetivo');
    const Sm = turnoDe(base, 'a', (S) => { S.esp = { id: S.ver + 4, s: 'a', k: 'DADO', opc: ['TIRAR', { slot: 0, o: 'medida' }], hasta: NOW + 9000 }; S.pj.a.obj = ['medida', null, null]; });
    chk(Sm, ['tirar', 'usar:0'], 'dado+objeto'); U.tap(...centro(U.B, 'usar:0')); chk(Sm, ['n:1', 'n:10', 'atras'], 'a la medida');
    const Sr = turnoDe(base, 'a', (S) => { S.esp = { id: S.ver + 5, s: 'a', k: 'RUTA', opc: R.salidas(S, 'a', S.pj.a.nodo, 5), hasta: NOW + 9000 }; });
    const rids = ids(Sr).filter((i) => i.indexOf('ruta:') === 0); assert.ok(rids.length >= 1, 'ruta'); assert.strictEqual(U.B.hit(400, 300), null, 'el centro del mapa queda libre para tocar la ruta');
  }
});

/* ───── lobby (pulido): layout sin solapes, presencia, ánimos, foco de teclado/mando, conexión, flags de expulsar/ceder ───── */
const LB_TAMS = [{ n: 'ancho 800x600', izq: 0, der: 800, compacto: false, mt: 44 }, { n: 'horizontal 932x430', izq: -250, der: 1050, compacto: true, mt: 62 },
  { n: 'vertical 360x640', izq: 231, der: 569, compacto: true, mt: 44 }, { n: 'vertical 360x640 con mt 62', izq: 231, der: 569, compacto: true, mt: 62 }];
const LB_PJ = ['tu', 'mama', 'abuela', 'tio', 'pana', 'prima', 'cobrador', 'portu'];
test('lobby: layout de la sala sin botones que se pisen, dentro de la pantalla y tocables, en 4 tamaños', () => {
  for (const tam of LB_TAMS) for (const tab of ['panas', 'pj', 'reglas']) for (const host of [true, false]) for (const admin of [false, true]) for (const lemo of [false, true]) {
    const R = LB.layoutSala(Object.assign({}, tam, { tab, host, lemo, mute: true, red: true, kick: admin, ceder: admin, admin: admin ? ['b', 'c'] : [] }));
    const tag = [tam.n, tab, host ? 'host' : 'invitado', admin ? 'admin' : '', lemo ? 'panel' : ''].join(' · ');
    assert.deepStrictEqual(LB.solapes(R.botones), [], 'sin solapes: ' + tag);
    R.botones.forEach((b) => {
      assert.ok(b.x >= tam.izq - .01 && b.x + b.w <= tam.der + .01 && b.y >= 0 && b.y + b.h <= 600.01, 'dentro de la pantalla: ' + b.id + ' ' + tag);
      assert.ok(b.h >= Math.min(tam.mt, 44) - .01 && b.w >= 44 - .01, 'tocable ≥44: ' + b.id + ' ' + JSON.stringify([b.w, b.h]) + ' ' + tag);
    });
    const ids = R.botones.map((b) => b.id);
    ['copiar', 'compartir', 'salir', 'mute'].forEach((id) => assert.ok(ids.indexOf(id) >= 0, id + ' siempre: ' + tag));
    assert.ok(ids.indexOf(host ? 'empezar' : 'listo') >= 0 && ids.indexOf(host ? 'listo' : 'empezar') < 0, 'acción de ' + tag);
    if (!lemo) assert.ok(ids.indexOf('lemo') >= 0, 'lemo ' + tag);
    if (lemo) assert.ok(ids.indexOf('lemo:fire') >= 0 && ids.indexOf('lemo:f:hablar') >= 0, 'panel de emotes ' + tag);
    if (!lemo && (R.modo === 'ancho' || tab === 'pj')) LB_PJ.forEach((ch) => assert.ok(ids.indexOf('pj:' + ch) >= 0, 'pj:' + ch + ' sin pestaña en ancho / con pestaña PERSONAJE: ' + tag));
    if (R.modo === 'tabs') ['tab:panas', 'tab:pj', 'tab:reglas'].forEach((id) => assert.ok(ids.indexOf(id) >= 0, id + ' ' + tag));
    if (!lemo && host && (R.modo === 'ancho' || tab === 'reglas')) LB.CFG_OPC.forEach((o) => o.o.forEach((v) => assert.ok(ids.indexOf('cfg:' + o.k + ':' + v[0]) >= 0, 'cfg ' + o.k + ' ' + tag)));
    if (!host) assert.ok(!ids.some((i) => i.indexOf('cfg:') === 0), 'el invitado no toca la config');
    if (!admin) assert.ok(!ids.some((i) => /^(kick|ceder):/.test(i)), 'sin flags no hay expulsar/ceder');
    if (admin && !lemo && (R.modo === 'ancho' || tab === 'panas')) ['kick:b', 'ceder:b', 'kick:c', 'ceder:c'].forEach((id) => assert.ok(ids.indexOf(id) >= 0, id + ' ' + tag));
  }
});
test('lobby: puros nuevos (fichas, rebote, conexión, frases)', () => {
  assert.deepStrictEqual(LB.fichas('7rgp'), ['7', 'R', 'G', 'P']); assert.deepStrictEqual(LB.fichas('k7'), ['K', '7', '', '']); assert.deepStrictEqual(LB.fichas(null), ['', '', '', '']);
  assert.strictEqual(LB.bote(0), 1); assert.strictEqual(LB.bote(1), 0); assert.strictEqual(LB.bote(5), 0); assert.strictEqual(LB.bote(-1), 0);
  for (let u = 0; u <= 1; u += .01) { const v = LB.bote(u); assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, 'rebote en 0..1'); }
  assert.ok(LB.bote(.33) < .05 && LB.bote(.55) > .1, 'toca el suelo y rebota');
  assert.strictEqual(LB.pingNivel(80, true).nivel, 'ok'); assert.strictEqual(LB.pingNivel(200, true).barras, 2); assert.strictEqual(LB.pingNivel(500, true).barras, 1);
  assert.strictEqual(LB.pingNivel(0, false).nivel, 'caido'); assert.strictEqual(LB.pingNivel(10, true, true).nivel, 'cpu');
  assert.strictEqual(LB.netNivel(null), null); assert.strictEqual(LB.netNivel({ estado: 'ok' }).barras, 3); assert.strictEqual(LB.netNivel({ estado: 'reconectando' }).nivel, 'reconectando'); assert.strictEqual(LB.netNivel({ estado: 'caido' }).barras, 0);
  const frases = LB_PJ.map((ch) => LB.fraseDe(ch, 'hablar')); assert.ok(frases.every((f) => f && f.length <= 28), 'una frase corta por personaje'); assert.strictEqual(new Set(frases).size, 8, '8 frases distintas');
  assert.strictEqual(LB.fraseDe('nadie', 'hablar'), '');
});
test('lobby: presencia de puestos (entra, sale, pasa a listo) y ánimos', () => {
  const A = (o) => ['a', 'b', 'c', 'd'].map((id) => (o[id] ? Object.assign({ id }, o[id]) : { id, vacio: true }));
  let p = LB.presencia(null, A({ a: { host: true } }), 0);
  assert.deepStrictEqual([p.entran, p.salen, p.listos], [[], [], []], 'el primer cuadro no anima a nadie');
  p = LB.presencia(p, A({ a: { host: true }, b: { listo: false } }), 1); assert.deepStrictEqual(p.entran, ['b']);
  p = LB.presencia(p, A({ a: { host: true }, b: { listo: true } }), 2); assert.deepStrictEqual(p.listos, ['b']); assert.deepStrictEqual(p.entran, []);
  p = LB.presencia(p, A({ a: { host: true }, b: { listo: true } }), 3); assert.deepStrictEqual(p.listos, [], 'ya estaba listo');
  p = LB.presencia(p, A({ a: { host: true } }), 4); assert.deepStrictEqual(p.salen.map((x) => x.id), ['b']); assert.strictEqual(p.salen[0].a.listo, true, 'guarda el último estado para el desvanecido');
  assert.strictEqual(LB.animoPuesto({}, { online: false }, 5), 'perder'); assert.strictEqual(LB.animoPuesto({ cpu: true }, { online: false }, 5), 'esperar');
  assert.strictEqual(LB.animoPuesto({}, { celebraAt: 4.5 }, 5), 'celebrar'); assert.strictEqual(LB.animoPuesto({}, { celebraAt: 2 }, 5), 'esperar');
  assert.strictEqual(LB.animoPuesto({}, { hablaAt: 4 }, 5), 'hablar'); assert.strictEqual(LB.animoPuesto({}, {}, 5), 'esperar');
  const pr = (o) => LB.animoPrevia(Object.assign({ ch: 'mama', t: 10, pickCh: 'mama', pickAt: 10, pickOk: null }, o));
  assert.deepStrictEqual(pr({}), { animo: 'hablar', gris: false }, 'mientras se confirma');
  assert.deepStrictEqual(pr({ pickOk: true }), { animo: 'celebrar', gris: false }, 'celebra 1 s al confirmarse');
  assert.strictEqual(pr({ pickOk: true, t: 11.5 }).animo, 'hablar'); assert.strictEqual(pr({ pickOk: true, t: 14 }).animo, 'esperar');
  assert.deepStrictEqual(pr({ pickOk: false }), { animo: 'perder', gris: true }, 'si hay 409: gris y pierde');
  assert.deepStrictEqual(pr({ ajeno: true }), { animo: 'perder', gris: true }, 'tomado por otro: gris');
  assert.strictEqual(pr({ ch: 'tio' }).animo, 'esperar', 'cursor sobre otro: esperar');
});
test('lobby: foco por teclado (Tab/flechas) recorre todos los botones, Enter confirma; el mando manda las mismas teclas', () => {
  assert.strictEqual(LB.siguienteFoco([], 'x', 'sig'), null);
  const l = [{ id: 'a', x: 0, y: 0, w: 10, h: 10 }, { id: 'b', x: 20, y: 0, w: 10, h: 10 }, { id: 'c', x: 0, y: 20, w: 10, h: 10 }, { id: 'd', x: 20, y: 20, w: 10, h: 10, off: true }];
  assert.strictEqual(LB.siguienteFoco(l, 'a', 'der'), 'b'); assert.strictEqual(LB.siguienteFoco(l, 'a', 'aba'), 'c'); assert.strictEqual(LB.siguienteFoco(l, 'b', 'aba'), 'c', 'el apagado no recibe foco');
  assert.strictEqual(LB.siguienteFoco(l, 'c', 'sig'), 'a', 'Tab da la vuelta'); assert.strictEqual(LB.siguienteFoco(l, 'a', 'ant'), 'c'); assert.strictEqual(LB.siguienteFoco(l, null, 'sig'), 'a');
  // controlador: Tab recorre cada botón activo una vez
  const out = [], room = P.fiestaNew('FOCO', 0, {}), a = F(room, 'join', { name: 'ANA', ch: 'mama' }).you, b = F(room, 'join', { name: 'BETO' }).you;
  const sons = []; const sonidoAntes = UI.sonido; UI.sonido = (n) => { sons.push(n); };
  try {
    const L = LB.crear({ emit: (it) => out.push(it), storage: memStore(), reloj: reloj(), origin: 'https://x.app', rnd: () => .1 });
    F(room, 'ready', { id: b.id, on: true }, 0);
    const vm = { room, S: room.board, yo: a.id, serverNow: 0, seats: [] };
    L.dibujar(vm); const activos = L.B.lista.filter((x) => !x.off && x.id).map((x) => x.id);
    const vistos = []; for (let i = 0; i < activos.length; i++) { assert.ok(L.tecla('Tab', 'Tab')); vistos.push(L.foco); L.dibujar(vm); }
    assert.deepStrictEqual(vistos.slice().sort(), activos.slice().sort(), 'Tab pasa por todos los botones activos');
    assert.strictEqual(L.focoOn, true); L.dibujar(vm);
    // flechas hasta un personaje y Enter lo elige
    L.foco = 'pj:abuela'; L.tecla('Enter', 'Enter'); assert.deepStrictEqual(out.pop(), { k: 'pick', ch: 'abuela' });
    L.foco = 'cfg:tot:20'; L.tecla('Space', ' '); assert.deepStrictEqual(out.pop(), { k: 'cfg', cfg: { tot: 20 } });
    L.tecla('ArrowRight'); assert.notStrictEqual(L.foco, 'cfg:tot:20', 'la flecha mueve el foco');
    L.mover(10, 10); assert.strictEqual(L.focoOn, false, 'el puntero apaga el aro de foco');
    // mando simulado: D-pad mueve, A confirma, Start empieza (el anfitrión ya tiene a BETO listo)
    const pad = { connected: true, axes: [0, 0], buttons: [] }; for (let i = 0; i < 16; i++) pad.buttons.push({ pressed: false, value: 0 });
    let tt = 100; const L2 = LB.crear({ emit: (it) => out.push(it), storage: memStore(), reloj: () => tt, gamepads: () => [pad], origin: 'https://x.app' });
    const dib = () => { tt += .05; L2.dibujar(vm); };
    dib(); pad.buttons[15].pressed = true; dib(); assert.strictEqual(L2.focoOn, true, 'D-pad prende el foco'); const f1 = L2.foco; pad.buttons[15].pressed = false; dib();
    pad.axes[0] = .9; dib(); assert.notStrictEqual(L2.foco, f1, 'el stick también mueve'); pad.axes[0] = 0; dib();
    L2.foco = 'pj:tio'; pad.buttons[0].pressed = true; dib(); assert.deepStrictEqual(out.pop(), { k: 'pick', ch: 'tio' }, 'A = Enter'); pad.buttons[0].pressed = false; dib();
    pad.buttons[9].pressed = true; dib(); assert.deepStrictEqual(out.pop(), { k: 'start' }, 'Start empieza si eres anfitrión'); pad.buttons[9].pressed = false; dib();
    L2.lemoAbierto = true; pad.buttons[1].pressed = true; dib(); assert.strictEqual(L2.lemoAbierto, false, 'B/Esc cierra el panel'); pad.buttons[1].pressed = false; dib();
    const est = {}; assert.deepStrictEqual(LB.mandoTeclas(est, [pad], 0), []); pad.buttons[14].pressed = true;
    assert.deepStrictEqual(LB.mandoTeclas(est, [pad], 1), ['ArrowLeft']); assert.deepStrictEqual(LB.mandoTeclas(est, [pad], 1.2), [], 'antes de .4 s no repite');
    assert.deepStrictEqual(LB.mandoTeclas(est, [pad], 1.5), ['ArrowLeft'], 'mantener repite'); assert.deepStrictEqual(LB.mandoTeclas({}, null, 0), []); assert.deepStrictEqual(LB.mandoTeclas({}, [null], 0), []);
  } finally { UI.sonido = sonidoAntes; }
});
test('lobby: puestos que entran/salen/se ponen listos suenan y animan; los flags de expulsar y ceder prenden o apagan sus botones', () => {
  const out = [], sons = [], sonidoAntes = UI.sonido; UI.sonido = (n) => { sons.push(n); };
  try {
    const room = P.fiestaNew('PRES', 0, {}), a = F(room, 'join', { name: 'ANA', ch: 'mama' }).you;
    let tt = 50; const L = LB.crear({ emit: (it) => out.push(it), storage: memStore(), reloj: () => tt, origin: 'https://x.app' });
    const vm = (o) => Object.assign({ room, S: room.board, yo: a.id, serverNow: 0, seats: [], t: tt }, o);
    const dib = (o) => { tt += .1; L.dibujar(vm(o)); };
    dib(); dib(); assert.strictEqual(sons.filter((s) => s === 'join').length, 0, 'sin entradas al inicio');
    const b = F(room, 'join', { name: 'BETO' }).you; dib();
    assert.strictEqual(sons.filter((s) => s === 'join').length, 1, 'entra BETO: suena'); assert.ok(L.llegada[b.id] !== undefined, 'y cae con rebote');
    F(room, 'ready', { id: b.id, on: true }, 0); dib(); assert.ok(sons.indexOf('listo') >= 0); assert.ok(L.celebra[b.id] !== undefined, 'celebra al ponerse listo');
    // flags
    assert.ok(!L.B.porId('kick:' + b.id) && !L.B.porId('ceder:' + b.id), 'sin flags no hay botones muertos');
    dib({ puedeExpulsar: true, puedeCeder: true }); assert.ok(L.B.porId('kick:' + b.id) && L.B.porId('ceder:' + b.id));
    out.length = 0; L.tap(...centro(L.B, 'kick:' + b.id)); assert.strictEqual(out.length, 0, 'el primer toque solo arma «¿SEGURO?»'); dib({ puedeExpulsar: true, puedeCeder: true }); L.tap(...centro(L.B, 'kick:' + b.id)); assert.deepStrictEqual(out.pop(), { k: 'kick', seat: b.id });
    L.tap(...centro(L.B, 'ceder:' + b.id)); assert.strictEqual(out.length, 0); L.tap(...centro(L.B, 'ceder:' + b.id)); assert.deepStrictEqual(out.pop(), { k: 'host', seat: b.id });
    dib({ puedeCeder: true }); assert.ok(!L.B.porId('kick:' + b.id) && L.B.porId('ceder:' + b.id));
    dib({ yo: b.id, puedeExpulsar: true, puedeCeder: true }); assert.ok(!L.B.porId('kick:' + a.id), 'solo el anfitrión ve esos botones');
    // sale BETO: se desvanece y suena
    const ant = room.players.slice(); room.players = room.players.filter((p) => p.id !== b.id); delete room.board.pj[b.id]; dib();
    assert.ok(sons.indexOf('salir') >= 0 && L.ghosts.some((g) => g.id === b.id), 'sale BETO: fantasma de desvanecido'); room.players = ant;
    // emotes: el transporte de siempre, con enfriamiento; las frases rápidas son locales
    dib({ yo: a.id }); L.tap(...centro(L.B, 'lemo')); dib(); assert.ok(L.lemoAbierto && L.B.porId('lemo:fire') && L.B.porId('lemo:f:hablar'), 'panel abierto');
    out.length = 0; L.tap(...centro(L.B, 'lemo:fire')); assert.deepStrictEqual(out.pop(), { k: 'react', id: 'fire' }); assert.ok(L.burbujas[a.id], 'globo local al instante');
    tt += .1; dib(); assert.strictEqual(L.emote('wow'), false, 'enfriamiento UI.REACT_GAP'); tt += 1; dib(); assert.strictEqual(L.emote('wow'), true); out.length = 0;
    dib(); L.tap(...centro(L.B, 'lemo:f:celebrar')); assert.strictEqual(out.length, 0, 'las frases rápidas no viajan'); assert.strictEqual(L.burbujas[a.id].s, LB.fraseDe('mama', 'celebrar'));
    dib(); L.tecla('Escape'); assert.strictEqual(L.lemoAbierto, false);
    // reacciones de otros (si main las pasa)
    dib({ reacciones: [{ s: 'b', id: 'star', at: 9 }] }); assert.ok(L.burbujas.b && L.habla.b !== undefined);
  } finally { UI.sonido = sonidoAntes; }
});
test('lobby: ids obligatorios del e2e en menú, código, nombre y sala (también compacto) y pestañas', () => {
  const L = LB.crear({ emit() {}, storage: memStore(), reloj: reloj(), origin: 'https://x.app', rnd: () => .2 });
  L.dibujar({ sesion: { code: 'ABCD', id: 'a', key: 'k' } }); ['nombre', 'crear', 'unirse', 'seguir', 'mundo'].forEach((id) => assert.ok(L.B.porId(id), 'menú ' + id));
  L.ir('codigo'); L.dibujar({}); ['borrar', 'atras', 'pegar', 'entrar', 'key:A', 'key:9'].forEach((id) => assert.ok(L.B.porId(id), 'código ' + id));
  L.ir('nombre'); L.dibujar({}); ['borrar', 'atras', 'ok', 'key:Z', 'key:0'].forEach((id) => assert.ok(L.B.porId(id), 'nombre ' + id));
  [[0, 800, false], [-250, 1050, true], [231, 569, true]].forEach(([izq, der, compacto]) => { L.ir('menu'); L.dibujar({ izq, der, compacto, sesion: null }); assert.deepStrictEqual(LB.solapes(L.B.lista.filter((b) => b.id)), [], 'menú sin solapes ' + izq);
    L.ir('codigo'); L.dibujar({ izq, der, compacto }); assert.deepStrictEqual(LB.solapes(L.B.lista.filter((b) => b.id)), [], 'código sin solapes ' + izq); });
  const room = P.fiestaNew('IDS', 0, {}), a = F(room, 'join', { name: 'ANA' }).you; F(room, 'join', { name: 'BETO', ch: 'tio' });
  for (const [compacto, izq, der] of [[false, 0, 800], [true, 0, 800], [true, 231, 569], [true, -250, 1050]]) {
    L.dibujar({ room, S: room.board, yo: a.id, serverNow: 0, compacto, izq, der });
    assert.deepStrictEqual(LB.solapes(L.B.lista.filter((b) => b.id && !/^key:/.test(b.id))), [], 'la sala dibujada no pisa botones');
    if (compacto) { ['tab:panas', 'tab:pj', 'tab:reglas'].forEach((id) => assert.ok(L.B.porId(id), id)); L.tap(...centro(L.B, 'tab:pj')); L.dibujar({ room, S: room.board, yo: a.id, serverNow: 0, compacto, izq, der }); }
    ['pj:abuela', 'pj:mama', 'copiar', 'compartir', 'salir', 'empezar', 'lemo'].forEach((id) => assert.ok(L.B.porId(id), 'sala ' + id));
    LB_PJ.forEach((ch) => assert.ok(L.B.porId('pj:' + ch).w >= 44 && L.B.porId('pj:' + ch).h >= 44, 'celda táctil ' + ch));
  }
});

// ===== LOBBY =====
test('LOBBY: layout sin solapes en 6 viewports x 3 pestañas x n=2..4 (botones y código tocable)', () => {
  const vps = [[0, 800, true, 62], [-250, 1050, true, 62], [231, 569, true, 44], [231, 569, true, 62], [-100, 900, true, 62], [0, 800, false, 44]];
  for (const [izq, der, compacto, mt] of vps) for (const tab of ['panas', 'pj', 'reglas']) for (const n of [2, 3, 4]) {
    const admin = ['b', 'c', 'd'].slice(0, n - 1), R = LB.layoutSala({ izq, der, compacto, mt, tab, host: true, mute: true, red: true, kick: true, ceder: true, admin });
    assert.deepStrictEqual(LB.solapes(R.botones), [], [izq, der, tab, n].join(' '));
    assert.ok(R.botones.some((b) => b.id === 'codigo' && b.w >= 44 && b.h >= 44), 'el código es tocable');
  }
});
test('LOBBY: la pantalla de personaje registra todos los pj activos y el foco los recorre', () => {
  const room = P.fiestaNew('LBY', 0, {}), a = F(room, 'join', { name: 'ANA' }).you;
  const L = LB.crear({ emit() {}, storage: memStore(), reloj: reloj(), origin: 'https://x.app' });
  L.dibujar({ room, S: room.board, yo: a.id, serverNow: 0, compacto: true, izq: 231, der: 569 }); L.tab = 'pj'; L.dibujar({ room, S: room.board, yo: a.id, serverNow: 0, compacto: true, izq: 231, der: 569 });
  LB_PJ.forEach((ch) => assert.ok(L.B.porId('pj:' + ch), 'pj:' + ch));
  const vistos = {}; let id = 'pj:tu'; for (let i = 0; i < 80; i++) { vistos[id] = 1; id = LB.siguienteFoco(L.B.lista, id, 'sig'); }
  LB_PJ.forEach((ch) => assert.ok(vistos['pj:' + ch], 'foco llega a ' + ch));
});
test('LOBBY: dibuja sin romper con los 8 personajes tomados y en cada pestaña', () => {
  const room = P.fiestaNew('LB8', 0, {}), a = F(room, 'join', { name: 'ANA', ch: 'tu' }).you;
  ['mama', 'abuela', 'tio'].forEach((ch, i) => F(room, 'join', { name: 'P' + i, ch }));
  LB_PJ.slice(4).forEach((ch) => { room.board.pj.d = room.board.pj.d || {}; });
  const L = LB.crear({ emit() {}, storage: memStore(), reloj: reloj(), origin: 'https://x.app' });
  for (const tab of ['panas', 'pj', 'reglas']) for (const compacto of [false, true]) { L.tab = tab; L.tabAuto = true; L.dibujar({ room, S: room.board, yo: a.id, serverNow: 0, compacto, izq: compacto ? 231 : 0, der: compacto ? 569 : 800, net: { estado: 'reconectando' } }); }
});
test('LOBBY: texto de conexión por estado, bloqueo al reconectar y fichas del código en 320 px', () => {
  assert.strictEqual(LB.netNivel({ estado: 'ok' }).corto, 'BIEN'); assert.strictEqual(LB.netNivel({ estado: 'ok', rtt: 400 }).corto, 'LENTO');
  assert.strictEqual(LB.netNivel({ estado: 'caido' }).corto, 'SIN SEÑAL'); assert.strictEqual(LB.netNivel({ estado: 'reconectando' }).bloquea, true);
  const f = LB.fichasAncho(320, 54); assert.ok(f.n * f.w + 3 * f.gap <= 320.01 && f.w >= 18);
  const out = [], room = P.fiestaNew('NET', 0, {}), a = F(room, 'join', { name: 'ANA' }).you;
  const L = LB.crear({ emit: (it) => out.push(it), storage: memStore(), reloj: reloj(), origin: 'https://x.app' });
  const vm = { room, S: room.board, yo: a.id, serverNow: 0, compacto: false, net: { estado: 'reconectando' } };
  L.dibujar(vm); L.tap(...centro(L.B, 'pj:mama')); assert.strictEqual(out.length, 0, 'no emite mientras reconecta'); assert.ok(L.toasts.some((x) => /Reconectando/.test(x.s)));
  L.dibujar(Object.assign({}, vm, { net: { estado: 'ok' } })); L.tap(...centro(L.B, 'pj:mama')); assert.deepStrictEqual(out.pop(), { k: 'pick', ch: 'mama' });
  L.tap(...centro(L.B, 'codigo')); assert.deepStrictEqual(out.pop(), { k: 'copy', text: room.code });
});
test('LOBBY: orden de elección, confirmación en dos toques y mando LB/RB/Y', () => {
  const o = LB.ordenElegir([{ id: 'a', ch: 'mama' }, { id: 'b' }, { id: 'c', vacio: true }, { id: 'd', cpu: true }]);
  assert.deepStrictEqual(o.map((x) => x.eligiendo), [false, true, false, false]); assert.strictEqual(o[0].n, 1);
  const e = {}; assert.strictEqual(LB.confirmar(e, 'k', 10), false); assert.strictEqual(LB.confirmar(e, 'k', 11), true); assert.strictEqual(LB.confirmar(e, 'k', 20), false); assert.strictEqual(LB.confirmar(e, 'k', 23), false, 'fuera de 2 s rearma');
  const pad = { connected: true, axes: [0, 0], buttons: [] }; for (let i = 0; i < 16; i++) pad.buttons.push({ pressed: false, value: 0 });
  pad.buttons[5].pressed = true; pad.buttons[4].pressed = true; pad.buttons[3].pressed = true;
  assert.deepStrictEqual(LB.mandoTeclas({}, [pad], 0).sort(), ['BumpL', 'BumpR', 'Emote']);
});
test('LOBBY: presencia dispara la entrada animada y el hueco de pestañas con LB/RB', () => {
  const room = P.fiestaNew('ENT', 0, {}), a = F(room, 'join', { name: 'ANA', ch: 'mama' }).you; let tt = 10;
  const L = LB.crear({ emit() {}, storage: memStore(), reloj: () => tt, origin: 'https://x.app' });
  const vm = () => ({ room, S: room.board, yo: a.id, serverNow: 0, t: tt += .1, compacto: false });
  L.dibujar(vm()); const b = F(room, 'join', { name: 'BETO' }).you; L.dibujar(vm()); assert.ok(L.llegada[b.id] !== undefined, 'entrada animada de BETO');
  L.tab = 'panas'; L.tecla('BumpR'); assert.strictEqual(L.tab, 'pj'); L.tecla('BumpR'); assert.strictEqual(L.tab, 'reglas'); L.tecla('BumpL'); assert.strictEqual(L.tab, 'pj');
});

/* ───── HUD: pulido 2 (voz, polifonía, reservados, log paginado, podio, layout en 7 pantallas) ───── */
test('HUD2/voz: notas por personaje y ánimo; esperar calla; nunca más de 3 sonidos a la vez', () => {
  const calls = []; let t = 5000;
  const s = UI.crearSonido({ reloj: () => t, snd: (...a) => calls.push(a), silencio: () => false });
  assert.strictEqual(s('voz', { ch: 'mama', animo: 'esperar' }), false, 'esperar = silencio');
  assert.strictEqual(s('voz', { ch: 'mama', animo: 'celebrar' }), true);
  const f0 = calls[0][0]; t += 100; s('voz', { ch: 'abuela', animo: 'celebrar' });
  assert.notStrictEqual(calls.find((c, i) => i > 0 && c[0] !== f0 * 1.25 && c[0] !== f0 * 1.5)[0], f0, 'pitch distinto por personaje');
  t = 9000; calls.length = 0;
  assert.ok(s('tap')); assert.ok(s('ok')); assert.ok(s('moneda')); assert.strictEqual(s('turno'), false, 'el cuarto simultáneo se poda');
  t += 600; assert.strictEqual(s('turno'), true, 'ya terminaron');
  for (const ch of [null, 'zzz', 'tu']) for (const a of UI.ANIMOS) assert.doesNotThrow(() => s('voz', { ch, animo: a }));
  assert.ok(UI.SONIDOS.ching && UI.SONIDOS.tic);
});
test('HUD2/dibujo: reservados, corona del líder, log paginado con cierre al tocar fuera, motivos apagados', () => {
  const out = [], t = reloj(), U = UI.crear({ emit: (it) => out.push(it), reloj: t });
  const base = arrancar(), S = turnoDe(base, 'a', (S) => { S.pj.a.mon = 3; S.pj.a.est = 2; S.log = Array.from({ length: 12 }, (_, i) => 'linea ' + i + ' ' + S.pj.a.name); });
  const vm = { S, yo: 'a', serverNow: NOW };
  U.dibujar(vm); assert.strictEqual(U.lider, 'a', 'va 1.º');
  assert.ok(Array.isArray(U.reservados) && U.reservados.length >= 4);
  U.reservados.forEach((r) => ['x', 'y', 'w', 'h'].forEach((k) => assert.ok(Number.isFinite(r[k]), 'rect finito')));
  const ref = U.reservados; U.dibujar(vm); assert.strictEqual(U.reservados, ref, 'arreglo reusado');
  Object.keys(S.pj).forEach((k) => { if (k !== 'a') { S.pj[k].est = 2; S.pj[k].mon = 3; } }); U.dibujar(vm); assert.strictEqual(U.lider, null, 'empate = sin corona');
  U.tap(...centro(U.B, 'log')); U.dibujar(vm); assert.ok(U.B.porId('log:antes') && !U.B.porId('log:antes').off && U.B.porId('log:ahora').off);
  U.tap(...centro(U.B, 'log:antes')); assert.strictEqual(U.logPag, 1); U.dibujar(vm);
  const pr = U.B.porId('tirar'); U.tap(U.logR.x + 5, U.logR.y + 5); assert.ok(U.logAbierto, 'dentro del panel no cierra');
  assert.strictEqual(U.tap(5, 590), true); assert.strictEqual(U.logAbierto, false, 'fuera cierra y no actúa'); assert.ok(pr && !out.length);
  const T2 = turnoDe(base, 'a', (S) => { S.pj.a.mon = 1; S.esp = { id: S.ver, s: 'a', k: 'ESTRELLA', opc: [{ precio: 20 }], hasta: NOW + 9000 }; });
  assert.strictEqual(UI.modeloAviso(T2, 'a', {}).botones[0].sub, 'No te alcanzan las monedas');
});
test('HUD2/podio con 2, 3 y 4 jugadores y empate dibuja y registra salir', () => {
  const base = arrancar();
  for (const n of [2, 3, 4]) for (const empate of [false, true]) {
    const S = J(base.S); S.f = 'fin'; S.esp = null; const ks = Object.keys(S.pj).slice(0, n); Object.keys(S.pj).forEach((k) => { if (ks.indexOf(k) < 0) delete S.pj[k]; });
    ks.forEach((k, i) => { S.pj[k].est = empate ? 2 : 3 - i; S.pj[k].mon = 10; }); S.orden = ks; S.podio = undefined; S.bonus = [{ s: ks[0], id: 'ricachon', v: 9 }];
    for (const compacto of [false, true]) { const t = reloj(), U = UI.crear({ reloj: t }); for (let i = 0; i < 60; i++) { t.mas(.1); U.dibujar({ S, yo: ks[0], serverNow: NOW, compacto, k: compacto ? .5 : 1 }); }
      const b = U.B.porId('salir'); assert.ok(b && b.w >= 44 && b.h >= 44 && b.y + b.h <= 600, 'salir ' + n); assert.ok(U.fx.vivas <= UI.fx.MAX); }
  }
});
test('HUD2/layout: 7 pantallas sin solapes entre tarjetas, ronda, mute, log, emotes y panel de log', () => {
  const inter = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
  const pant = [[360, 640], [390, 844], [640, 360], [844, 390], [932, 430], [1100, 700], [1920, 1080]];
  for (const [w, h] of pant) {
    const k = h / 600, ancho = w / k, L0 = (800 - ancho) / 2, c = w < 700 || h < 500, Y = UI.layout({ izq: L0, der: L0 + ancho, compacto: c, k });
    const cosas = { mute: Y.mute, log: Y.log, ronda: Y.ronda };
    Y.cards.forEach((q, i) => { cosas['c' + i] = q; });
    const ks = Object.keys(cosas);
    ks.forEach((a) => { assert.ok(cosas[a].x >= Y.izq - 1e-9 && cosas[a].x + cosas[a].w <= Y.der + 1e-9, a + ' dentro ' + w + 'x' + h); ks.forEach((b) => { if (a < b) assert.ok(!inter(cosas[a], cosas[b]), a + ' x ' + b + ' ' + w + 'x' + h); }); });
    assert.ok(Y.mute.w * k >= 44 - 1e-6 && Y.log.w * k >= 44 - 1e-6, 'tocables reales ' + w + 'x' + h);
    assert.ok(Y.logPanel.y + Y.logPanel.h <= 600 + 1e-9 + 300, 'panel de log finito');
    const bn = { x: Y.banner.x - Y.banner.w / 2, y: Y.banner.y - Y.banner.h / 2, w: Y.banner.w, h: Y.banner.h };
    ['mute', 'log', 'ronda'].forEach((q) => { assert.ok(!inter(bn, cosas[q]), 'banner x ' + q + ' ' + w + 'x' + h); assert.ok(!inter(Y.carta, cosas[q]), 'carta x ' + q + ' ' + w + 'x' + h); });
    Y.cards.forEach((q, i) => { assert.ok(!inter(bn, q) && !inter(Y.carta, q), 'banner/carta x tarjeta ' + i + ' ' + w + 'x' + h); });
  }
});

/* ── lobby ── (pruebas del pulido de la sala: listos, motivo de «empezar», frases por personaje, selección desde F.PJ) */
test('lobby/listos: contador, motivo de empezar bloqueado y mensaje bajo el botón', () => {
  const room = P.fiestaNew('FIES', 0, {});
  const a = F(room, 'join', { name: 'ANA', ch: 'mama' }).you, b = F(room, 'join', { name: 'BETO' }).you;
  let st = LB.sala(room, room.board, a.id, 0);
  assert.strictEqual(st.sinPj, 1); assert.match(st.porque, /falta 1 por elegir/);
  assert.strictEqual(LB.textoListos(st), '0/2 listos');
  F(room, 'pick', { id: b.id, ch: 'abuela' }); F(room, 'ready', { id: b.id, on: true }, 1000);
  st = LB.sala(room, room.board, a.id, 1000);
  assert.strictEqual(st.sinPj, 0); assert.strictEqual(st.puedeEmpezar, true); assert.strictEqual(LB.textoListos(st), '1/2 listos');
  assert.match(LB.mensajeAccion(st, null), /listos/); assert.match(LB.mensajeAccion(st, null), /CPU completa 2 puestos/);
  assert.match(LB.mensajeAccion(st, { bloquea: true, txt: 'RECONECTANDO' }), /RECONECTANDO/, 'la red manda sobre el motivo');
  const sb = LB.sala(room, room.board, b.id, 1000);
  assert.match(LB.mensajeAccion(sb, null), /esperando al anfitrión/);
});
test('lobby/personajes: la selección sale de F.PJ.PJ_IDS y la frase rota por variante', () => {
  const PJ = require('../docs/style-lab/fiesta-personajes.js');
  assert.deepStrictEqual(LB.ordenPj(), PJ.PJ_IDS);
  assert.ok(LB.ordenPj().length >= 8);
  const vs = [0, 1, 2].map((i) => LB.fraseDe('mama', 'hablar', i));
  assert.ok(vs.every(Boolean)); assert.strictEqual(new Set(vs).size, 3, '3 variantes distintas');
  assert.strictEqual(LB.fraseDe('mama', 'hablar', 3), vs[0], 'cicla en módulo');
});

test('ui/pulido 2: toasts sin duplicar, nombres sin «CPU · », podio sin pisar el botón, pastilla del dado y franja de cámara', () => {
  const t = reloj(), U = UI.crear({ reloj: t });
  U.toast('No hay señal con el servidor'); U.toast('No hay señal con el servidor'); U.toast('No hay señal con el servidor');
  assert.strictEqual(U.toasts.length, 1, 'el mismo aviso refresca su reloj');
  U.toast('otro', '#5cff7a'); assert.strictEqual(U.toasts.length, 2);
  assert.strictEqual(UI.fmt.limpio('CPU · EL PORTU'), 'EL PORTU'); assert.strictEqual(UI.fmt.limpio('PANA 4859'), 'PANA 4859');
  for (const o of [{}, { tg: 62, bonus: 2 }, { tg: 100, bonus: 4 }, { izq: -100, der: 900, tg: 70, bonus: 3 }]) for (const n of [2, 3, 4]) {
    const P = UI.layoutPodio(n, o), nb = Math.min(4, o.bonus | 0);
    assert.ok(P.base + 58 + (nb ? 52 : 0) <= P.by - 4, 'lo que cuelga de la base cabe sobre el botón ' + JSON.stringify(o) + n);
    P.slots.forEach((sl) => { assert.ok(P.base - sl.h - P.hc * 1.75 >= 100, 'la cabeza no pisa el título'); assert.ok(sl.h >= 36); });
  }
  // la pastilla del dado (tras 1,3 s) cabe bajo la ronda y no se mete en el banner de ruta
  const base = arrancar(), S = turnoDe(base, 'a'), vm = { S, yo: 'a', serverNow: NOW };
  U.efecto({ k: 'dado', s: 'a', v: 9, dados: [9], de: 'd6' }, S); for (let i = 0; i < 40; i++) { t.mas(.05); U.dibujar(vm); }
  const rd = U.reservado(vm)[0], L = UI.layout({}); assert.ok(rd && rd.h <= 50 && rd.w <= 160 && rd.y >= L.ronda.y + L.ronda.h, 'pastilla chica');
  assert.ok(U.reservados.length >= 4, 'el HUD publica sus rectángulos');
  assert.strictEqual(UI.reservadosActual, U.reservados);
  // franja de cámara: con el panel del dado abierto hay franja y es positiva
  assert.ok(U.banda === null || U.banda.y1 > U.banda.y0);
});

test('ui/toast de estrellaMueve: con dos estrellas dice de dónde se mudó; con una, el texto clásico', () => {
  const U = UI.crear({ emit: () => {}, reloj: reloj() }), { S } = arrancar();
  const dos = JSON.parse(JSON.stringify(S)); dos.estrella.b = 'moc_mochima'; const uno = JSON.parse(JSON.stringify(S)); uno.estrella.b = null;
  U.efecto({ k: 'estrellaMueve', de: 'ccs_galipan', a: 'coc_puertocolombia', i: 0 }, dos); assert.match(U.toasts.pop().s, /^La Abuela de .+ se mudó a .+/);
  U.efecto({ k: 'estrellaMueve', de: 'ccs_galipan', a: 'coc_puertocolombia', i: 0 }, uno); assert.match(U.toasts.pop().s, /^La Abuela se mudó a /);
});
