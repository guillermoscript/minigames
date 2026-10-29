// LA FIESTA · personajes (fiesta-personajes.js, FIESTA.PJ): tabla de datos, frases, roster y un humo de dibujo con primitivas falsas del laboratorio
// que recorre TODOS los ids × ánimos × modos × estilos (sin excepciones, números finitos, save/restore balanceados, determinista en (id, ánimo, t)).
const test = require('node:test'), assert = require('node:assert');
const R = require('../docs/style-lab/fiesta-reglas.js');
const PJ = require('../docs/style-lab/fiesta-personajes.js');
const UI = require('../docs/style-lab/fiesta-ui.js');
const HEX = /^#[0-9a-f]{6}$/i;

/* ───── primitivas falsas del laboratorio: registran cada llamada y exigen números finitos ───── */
const LOG = []; let nivel = 0, minNivel = 0;
function fin(args, nombre) { args.forEach((a) => { if (typeof a === 'number') assert.ok(Number.isFinite(a), nombre + ' con número no finito: ' + args.join(',')); }); }
function prim(nombre) { return (...a) => { fin(a, nombre); LOG.push(nombre + ':' + a.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? '[' + v.length + ']' : typeof v === 'string' ? v : typeof v)).join(',')); }; }
function stubLab(estilo) {
  const g = globalThis;
  g.ctx = { save() { nivel++; }, restore() { nivel--; minNivel = Math.min(minNivel, nivel); }, translate: prim('translate'), rotate: prim('rotate'), scale: prim('scale'), beginPath() {}, rect: prim('rect'), clip() {}, arc: prim('arc') };
  ['rr', 'ell', 'line', 'poly', 'hand', 'limb', 'txt'].forEach((n) => { g[n] = prim(n); });
  g.tw = (s, size) => String(s).length * size * .55;
  g.bust = (o) => {                                   // como el motor: valida las opciones y llama la mano de cada brazo (así se prueban los objetos)
    assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && o.s > 0, 'bust con coordenadas'); fin([o.rot || 0, o.sy || 1, o.talk || 0, o.look || 0], 'bust');
    LOG.push('bust:' + o.mood + ':' + (o.arms || []).length + ':' + (o.legs ? 'legs' : '-'));
    (o.arms || []).forEach((a) => { assert.ok(Number.isFinite(a.a) && Number.isFinite(a.len) && a.len > 0, 'brazo'); const ex = a.side * 40 + a.len * Math.sin(a.a), ey = 4 + a.len * Math.cos(a.a); if (a.hand) a.hand(ex, ey, a.a); });
  };
  g.style = estilo; g.now = 0; g.sid = 0;
}
function unStub() { ['ctx', 'rr', 'ell', 'line', 'poly', 'hand', 'limb', 'txt', 'tw', 'bust', 'style', 'now', 'sid'].forEach((k) => { delete globalThis[k]; }); }

/* ───── datos ───── */
test('personajes: la tabla cubre todos los PERSONAJES del reductor, activos y en el mismo orden', () => {
  const ids = R.PERSONAJES.map((p) => p.id);
  ids.forEach((id) => { assert.ok(PJ.CHARS[id], 'spec de ' + id); assert.strictEqual(PJ.CHARS[id].activo, true, 'activo ' + id); });
  assert.deepStrictEqual(PJ.lista(), ids);
  assert.deepStrictEqual(UI.PJ_IDS, ids);
  assert.strictEqual(PJ.lista(true).length, Object.keys(PJ.CHARS).length);
  assert.ok(PJ.lista(true).length >= 24, 'la hoja entera (24) ya tiene diseño');
  assert.ok(Object.keys(PJ.CHARS).filter((id) => !PJ.CHARS[id].activo).every((id) => !ids.includes(id)), 'los demás siguen inactivos');
});
test('personajes: colores únicos y válidos, nombres, rasgos y glifos', () => {
  const ids = PJ.lista(true), cols = new Set(), glifos = new Set();
  ids.forEach((id) => { const d = PJ.CHARS[id];
    assert.ok(HEX.test(d.col) && HEX.test(d.col2) && d.col !== d.col2, 'colores ' + id); cols.add(d.col); glifos.add(d.glifo);
    assert.ok(d.n && d.hoja && d.rasgo.length > 0 && d.rasgo.length <= 34, 'nombre/rasgo ' + id); assert.ok(d.look && d.look.skin && d.look.shirt, 'look ' + id);
    assert.ok(Array.isArray(d.legs) && d.legs.length >= 3, 'piernas ' + id); assert.strictEqual(PJ.color(id), d.col); assert.strictEqual(PJ.ficha(id), d); });
  assert.strictEqual(cols.size, ids.length, 'cada personaje con su color'); assert.strictEqual(glifos.size, ids.length, 'cada personaje con su glifo');
  assert.strictEqual(PJ.color('nadie'), PJ.GRIS); assert.strictEqual(PJ.ficha('nadie'), null);
});
test('personajes: frases no vacías, cortas, distintas entre personajes y por ánimo; frase(id, ctx, idx) cicla', () => {
  assert.deepStrictEqual(PJ.ANIMOS, ['esperar', 'hablar', 'celebrar', 'perder']);
  const ids = PJ.lista();
  assert.strictEqual(new Set(ids.map((id) => PJ.frase(id, 'saludo'))).size, ids.length, 'saludos distintos');
  ids.forEach((id) => { const d = PJ.CHARS[id], todas = [];
    assert.ok(d.frase.length > 0 && d.frase.length <= 28, 'saludo de ' + id);
    PJ.ANIMOS.forEach((a) => { const l = d.v[a]; assert.ok(l && l.length >= 3, id + ' tiene ≥3 variantes de ' + a);
      l.forEach((f, i) => { assert.ok(f && f.length > 0 && f.length <= 24, id + ' ' + a + ' ' + i + ': ' + f); assert.ok(!/ladilla|mierda|coño/i.test(f), 'tono suave'); todas.push(f); });
      assert.strictEqual(d.frases[a], l[0]); assert.strictEqual(PJ.frase(id, a), l[0]); assert.strictEqual(PJ.frase(id, a, l.length), l[0]); assert.strictEqual(PJ.frase(id, a, -1), l[l.length - 1]); });
    assert.strictEqual(new Set(todas).size, todas.length, 'frases repetidas en ' + id); });
  assert.strictEqual(PJ.frase('nadie', 'hablar', 0), ''); assert.strictEqual(PJ.frase('mama', 'rasgo'), PJ.CHARS.mama.rasgo);
  assert.strictEqual(PJ.frase('mama', 'raro', 3), PJ.CHARS.mama.frase, 'contexto desconocido cae al saludo');
  assert.strictEqual(PJ.frase('mama', 'hablar', NaN), PJ.CHARS.mama.v.hablar[0]);
});
test('personajes: ident con las llaves de siempre, nunca lanza; animoMood finito', () => {
  PJ.lista().forEach((id) => assert.deepStrictEqual(Object.keys(PJ.ident(id)).sort(), ['col', 'col2', 'frase', 'id', 'look', 'n', 'rasgo']));
  for (const raro of [null, undefined, '', 'nadie', 42, {}]) { const i = PJ.ident(raro); assert.strictEqual(i.col, '#9a96a8'); assert.strictEqual(i.n, '¿?'); assert.ok(i.look()); }
  for (const a of PJ.ANIMOS.concat(['sleep', undefined, null, 'raro'])) for (const t of [0, 1, 1e6, NaN, -3, Infinity, undefined]) {
    const o = PJ.animoMood(a, t); ['talk', 'dy', 'rot', 'sx', 'sy'].forEach((k) => assert.ok(Number.isFinite(o[k]), a + ' ' + t + ' ' + k)); }
});
test('personajes: cargarRoster activa solo los ids de la lista y se rellena en sitio; sumar uno de la hoja es solo agregarlo a la lista', () => {
  const ref = PJ.PJ, refIds = PJ.PJ_IDS, orig = R.PERSONAJES;
  try {
    const sub = PJ.cargarRoster([{ id: 'mama', n: 'MAMÁ' }, { id: 'chino', n: 'EL CHINO' }]);
    assert.deepStrictEqual(sub, ['mama', 'chino']); assert.strictEqual(PJ.PJ, ref); assert.strictEqual(PJ.PJ_IDS, refIds);
    assert.deepStrictEqual(Object.keys(ref), ['mama', 'chino']); assert.strictEqual(PJ.CHARS.abuela.activo, false); assert.strictEqual(PJ.CHARS.chino.activo, true);
    assert.strictEqual(PJ.ident('abuela').n, '¿?');
  } finally { PJ.cargarRoster(orig); }
  assert.deepStrictEqual(PJ.PJ_IDS, orig.map((p) => p.id));
});
test('personajes: cada región <<pj:ID>> existe una sola vez por personaje activo en el archivo', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../docs/style-lab/fiesta-personajes.js'), 'utf8');
  R.PERSONAJES.forEach((p) => {
    assert.strictEqual(src.split('// <<pj:' + p.id + '>>').length - 1, 1, 'abre ' + p.id); assert.strictEqual(src.split('// <</pj:' + p.id + '>>').length - 1, 1, 'cierra ' + p.id);
    assert.ok(src.indexOf('// <<pj:' + p.id + '>>') < src.indexOf('// <</pj:' + p.id + '>>'));
    const reg = src.slice(src.indexOf('// <<pj:' + p.id + '>>'), src.indexOf('// <</pj:' + p.id + '>>')); assert.ok(reg.includes("def('" + p.id + "'"), 'def dentro de su región ' + p.id);
  });
});

/* ───── dibujo ───── */
const ESTILOS = ['snes', 'felt', 'ww', 'anime', 'tinta', 'garabato'], MODOS = ['cara', 'busto', 'cuerpo'];
const MOODS_CRUDOS = ['worry', 'yell', 'sleep', 'panic', 'grin', 'happy', 'frown', 'o', 'angry', 'calm', 'raro'];
test('draw: todos los ids × ánimos × modos × estilos dibujan sin excepción, finitos y con save/restore balanceados', () => {
  try {
    const ids = PJ.lista(true).concat(['nadie', '', null, undefined]);
    for (const st of ESTILOS) { stubLab(st);
      for (const id of ids) for (const mood of PJ.ANIMOS.concat(MOODS_CRUDOS)) for (const modo of MODOS) for (const t of [0, .37, 2.5, 1e5]) {
        nivel = 0; LOG.length = 0; const ok = PJ.draw(ctx, id, 120, 90, 1.2, mood, t, { modo, flip: t > 1 && t < 3, sombra: true, gris: t === .37, tinte: '#ff00ff' });
        assert.strictEqual(ok, true); assert.strictEqual(nivel, 0, `balance save/restore ${st} ${id} ${mood} ${modo}`); assert.ok(minNivel >= 0, 'restore de más');
        assert.ok(LOG.some((l) => l.startsWith('bust:')), 'llama a bust'); }
    }
  } finally { unStub(); }
});
test('draw: valores raros no lanzan (NaN, escala 0/negativa, op raro, recortes) y sin lienzo devuelve false', () => {
  assert.strictEqual(PJ.draw(null, 'mama', 1, 1, 1, 'hablar', 1), false);
  try {
    stubLab('snes');
    for (const v of [NaN, Infinity, -5, 0, undefined, '12']) { nivel = 0; assert.strictEqual(PJ.draw(ctx, 'abuela', v, v, v, 'celebrar', v, null), true); assert.strictEqual(nivel, 0); }
    nivel = 0; PJ.draw(ctx, 'tio', 50, 50, 1, 'perder', 3, { clip: { x: 0, y: 0, w: 10, h: 10 }, ancla: 'pies', modo: 'cuerpo', talk: .5, rot: .2, sy: .9, semilla: 5, confeti: false });
    PJ.draw(ctx, 'tio', 50, 50, 1, 'perder', 3, { clipC: { x: 5, y: 5, r: 9 }, modo: 'cara', mood: 'worry' }); assert.strictEqual(nivel, 0);
    assert.strictEqual(PJ.token('pana', 20, 20, 18, 'esperar', 1, {}), true); assert.strictEqual(PJ.token('nadie', 20, 20, 18, 'perder', 1, { gris: true }), true); assert.strictEqual(nivel, 0);
    ['retrato', 'dibujaPj', 'pose'].forEach((f) => { for (const id of PJ.lista().concat(['', null])) PJ[f](id, 50, 50, 80, { animo: 'hablar', t: 1, cuerpo: true, clip: { x: 0, y: 0, w: 99, h: 99 }, sombra: true }); });
    assert.strictEqual(nivel, 0); PJ.glifo('mama', 10, 10, 9); PJ.glifo('nadie', 10, 10, 0); const pl = PJ.placa(50, 20, 'ANA', 'mama', { cpu: 'afk', equipo: 1 }); assert.ok(pl.w > 0 && pl.h > 0);
  } finally { unStub(); }
});
test('draw: determinista en (id, ánimo, t) y distinto entre ánimos y entre personajes', () => {
  try {
    stubLab('ww'); const traza = (id, mood, t, op) => { LOG.length = 0; PJ.draw(ctx, id, 100, 100, 1, mood, t, op || { modo: 'cuerpo' }); return LOG.join('|'); };
    for (const id of PJ.lista()) for (const mood of PJ.ANIMOS) { const a = traza(id, mood, 1.234), b = traza(id, mood, 1.234); assert.strictEqual(a, b, 'determinista ' + id + ' ' + mood); }
    const base = traza('mama', 'esperar', 1);
    PJ.ANIMOS.slice(1).forEach((m) => assert.notStrictEqual(traza('mama', m, 1), base, 'otro ánimo, otra pose: ' + m));
    const trazas = PJ.lista().map((id) => traza(id, 'esperar', 1)); assert.strictEqual(new Set(trazas).size, trazas.length, 'cada personaje se dibuja distinto');
    assert.notStrictEqual(traza('mama', 'esperar', 0), traza('mama', 'esperar', .5), 'respira con el tiempo');
    const ant = globalThis.sid; PJ.draw(ctx, 'mama', 1, 1, 1, 'hablar', 1); assert.strictEqual(globalThis.sid, ant, 'restaura la semilla de quien llama');
  } finally { unStub(); }
});
test('draw: los adornos y objetos de cada personaje se pintan (casco, bigote, taza, consola…) y el cuerpo entero lleva piernas', () => {
  try {
    stubLab('tinta'); const cuenta = (id, mood, op) => { LOG.length = 0; PJ.draw(ctx, id, 100, 100, 1, mood, 1, op || { modo: 'busto' }); return LOG.length; };
    const cara = cuenta('mama', 'esperar', { modo: 'cara' }), busto = cuenta('mama', 'esperar'); assert.ok(busto > cara, 'el busto agrega el objeto en mano');
    LOG.length = 0; PJ.draw(ctx, 'mama', 100, 100, 1, 'esperar', 1, { modo: 'cuerpo' }); assert.ok(LOG.some((l) => /:legs$/.test(l)), 'piernas en cuerpo'); LOG.length = 0; PJ.draw(ctx, 'mama', 100, 100, 1, 'esperar', 1, { modo: 'busto' }); assert.ok(!LOG.some((l) => /:legs$/.test(l)));
    assert.ok(cuenta('cobrador', 'esperar') > cuenta('tu', 'esperar'), 'el casco y las monedas suman trazos');
    assert.ok(cuenta('mama', 'celebrar') > cuenta('mama', 'esperar'), 'celebrar suma confeti'); assert.strictEqual(cuenta('mama', 'celebrar', { modo: 'busto', confeti: false }) < cuenta('mama', 'celebrar'), true);
    LOG.length = 0; PJ.draw(ctx, 'prima', 100, 100, 1, 'esperar', 1, { modo: 'busto' }); assert.ok(LOG.some((l) => l.startsWith('bust:calm:1')) || LOG.some((l) => /^bust:\w+:1:/.test(l)), 'la mano libre sube a la boca: bust dibuja solo un brazo');
    assert.ok(LOG.some((l) => l.startsWith('limb:')), 'brazo con codo a la boca'); LOG.length = 0; PJ.draw(ctx, 'prima', 100, 100, 1, 'hablar', 1, { modo: 'busto' }); assert.ok(LOG.some((l) => /^bust:\w+:2:/.test(l)), 'al hablar vuelve a gesticular con los dos brazos');
  } finally { unStub(); }
});
test('draw: la escala es la de bust (s = h/110) y el centro de la cabeza queda en (x, y)', () => {
  try {
    stubLab('felt'); let ult = null; const b0 = globalThis.bust; globalThis.bust = (o) => { ult = { x: o.x, y: o.y, s: o.s }; b0(o); };
    PJ.dibujaPj('mama', 200, 100, 110, { animo: 'esperar', t: 0 }); assert.ok(Math.abs(ult.s - 1) < 1e-9); assert.ok(Math.abs(ult.x - 200) < 1e-9);
    assert.ok(Math.abs(ult.y - (100 + 64)) < 3, 'y de bust = centro de cabeza + 64·s (± respiración)');
    PJ.draw(ctx, 'mama', 200, 500, 1, 'esperar', 0, { modo: 'cuerpo', ancla: 'pies' }); assert.ok(ult.y < 500 - 100, 'con ancla en los pies la cabeza queda bien arriba');
  } finally { unStub(); }
});
test('draw: sin Math.random (cosmético o no) y rendimiento razonable en Node', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../docs/style-lab/fiesta-personajes.js'), 'utf8'); assert.ok(!/Math\.random/.test(src));
  try {
    stubLab('snes'); const t0 = process.hrtime.bigint(); let n = 0;
    for (let i = 0; i < 400; i++) for (const id of PJ.lista()) { PJ.draw(ctx, id, 100, 100, 1, PJ.ANIMOS[i % 4], i * .016, { modo: 'cuerpo' }); n++; }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6; assert.ok(ms / n < 1, 'cada dibujo (con primitivas falsas) < 1 ms: ' + (ms / n).toFixed(3));
  } finally { unStub(); }
});
