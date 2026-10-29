'use strict';
/* f_guaya (1v3, modelo B, correr por las guayas)   node --test test/fiesta-juego-guaya.test.js
   Registro, lint, determinismo, límites de puntaje, CPU y escalada, sobre LIVE.sim (el create() real con cuatro CPU). */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const B = require('../docs/style-lab/pruebas/fiesta-guaya-bench.js');
const REGLAS = require('../docs/style-lab/fiesta-reglas.js');
const DEF = B.K.DEF, G = 'f_guaya', SRC = path.join(__dirname, '../docs/style-lab/fiesta-juego-guaya.js');
const unico = (a) => a.filter((x, i) => a.indexOf(x) === i);

test('registro: ficha, cuerpo y límites', () => {
  assert.equal(DEF.modelo, 'B'); assert.equal(DEF.clase, 'binary'); assert.deepEqual(DEF.modos, ['1v3']);
  assert.equal(DEF.botones, 1); assert.equal(DEF.stick, true); assert.equal(DEF.dur, 40);
  assert.deepEqual(DEF.cuerpo, ['x', 'l', 'st', 'j']); assert.deepEqual(DEF.discretos, ['l', 'st', 'j']);
  assert.deepEqual(DEF.limites, B.LIM);
  assert.ok(DEF.carta.roles.solo.obj && DEF.carta.roles.trio.como);
  assert.equal(DEF.perilla.SUBE.length, 3); DEF.perilla.SUBE.forEach((a) => assert.ok(a > 0.3 && a < 1.2));
  const cat = REGLAS.CATALOGO.filter((x) => x.g === G)[0]; assert.ok(cat); assert.equal(cat.mo, 'B'); assert.deepEqual(cat.m, ['1v3']);
});

test('lint: sin azar ni reloj reales, sin sintaxis prohibida, ctx solo por primitivas, eventos y mensajes propios', () => {
  const s = fs.readFileSync(SRC, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const re of [/Math\.random/, /Date\.now/, /performance\.now/, /=>/, /\blet\b/, /\bconst\b/, /\?\./, /\?\?/, /\basync\b/, /\.\.\.\w/, /ctx\.(fill|stroke|drawImage)/]) assert.ok(!re.test(s), String(re));
  const tipos = (s.match(/c\.(send|on)\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1'));
  assert.ok(tipos.length > 0 && tipos.every((t) => /^x[a-z0-9]{1,11}$/.test(t)), tipos.join());
  const ev = (s.match(/c\.ev\(\s*'(\w+)'/g) || []).map((x) => x.replace(/.*'(\w+)'/, '$1'));
  assert.deepEqual(unico(ev).sort(), ['cae', 'cruzo']);
});

test('determinismo: misma semilla, mismo resultado y misma agenda de eventos; otra semilla, otra agenda', () => {
  for (const lv of [1, 2, 3]) {
    const a = B.sim(lv, 7), b = B.sim(lv, 7), c = B.sim(lv, 8);
    assert.deepEqual(a.vista.eventos, b.vista.eventos); assert.deepEqual(a.vista.fr, b.vista.fr);
    assert.deepEqual(a.vista.shakes, b.vista.shakes); assert.equal(a.ganaLado, b.ganaLado);
    assert.notDeepEqual(a.vista.eventos, c.vista.eventos);
  }
});

test('eventos telegrafiados: aviso >= 1 s antes, de los tres tipos, dentro de la partida', () => {
  const ks = {};
  for (let seed = 1; seed <= 12; seed++) {
    const ev = B.sim(2, seed).vista.eventos;
    assert.ok(ev.length >= 3, 'eventos ' + ev.length);
    ev.forEach((e) => { ks[e[0]] = 1; assert.ok(e[2] - e[1] >= 0.99, 'aviso ' + (e[2] - e[1])); assert.ok(e[2] < 40); assert.ok(e[4] >= 0 && e[4] < 4); });
  }
  assert.deepEqual(Object.keys(ks).sort(), ['nie', 'raf', 'zam']);
});

test('puntajes: gana el trío con 2 de 3 cruzando, y los puntajes reportados caben en los límites', () => {
  const tope = B.LIM.scoreMax;
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= 15; seed++) {
    const r = B.sim(lv, seed), v = r.vista, c = Math.min(3, v.cruzaron);
    assert.ok(r.fin, 'termina');
    const sc = r.sc || null;
    if (sc) sc.forEach((x) => assert.ok(Number.isInteger(x) && x >= 0 && x <= tope));
    assert.ok(c >= 0 && c <= 3);
    assert.equal(r.ganaLado, c >= 2 ? 'trio' : 'solo', `lv${lv} s${seed} c=${c}`);
  }
});

test('CPU: el solo suelta cabinas, el trío corre, salta, agarra fresas y llega; las partidas acaban en los 3 niveles', () => {
  for (const lv of [1, 2, 3]) {
    const m = B.medir({ lv, N: 20 });
    assert.ok(m.cabinas >= 15, `lv${lv} cabinas ${m.cabinas}`); assert.ok(m.saltos >= 3, `saltos ${m.saltos}`);
    assert.ok(m.fresas >= 2, `fresas ${m.fresas}`); assert.ok(m.caidas >= 1, `caídas ${m.caidas}`);
    assert.ok(m.cruzan > 0.3 && m.cruzan < 2.9, `cruzan ${m.cruzan}`); assert.ok(m.t <= 41, `fin ${m.t}`);
    assert.ok(m.win >= 0.2 && m.win <= 0.8, `lv${lv} solo gana ${(m.win * 100).toFixed(0)} %`);
  }
});

test('escalada: las fases cambian con el tiempo, las cabinas se sueltan más seguido al final y bajan más rápido', () => {
  const r = B.sim(2, 3, { dur: 40 }), v = r.vista;
  assert.ok(v.fase >= 1 || r.ganaLado === 'trio', 'llegó a fase ' + v.fase);
  const sh = v.shakes.map((s) => ({ tl: s[2] / 1000, vc: s[5] }));
  assert.ok(sh.length >= 10);
  const ini = sh.filter((s) => s.tl < 14), fin = sh.filter((s) => s.tl > 28);
  if (ini.length && fin.length) {
    assert.ok(Math.max.apply(null, fin.map((s) => s.vc)) > Math.max.apply(null, ini.map((s) => s.vc)), 'cabinas más rápidas al final');
    assert.ok(fin.length / (40 - 28) >= ini.length / 14 * 0.9, 'más densas al final');
  }
});
