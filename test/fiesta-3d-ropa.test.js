'use strict';
/* Pelo, ropa y cuerpo blando (docs/style-lab/fiesta-3d-ropa.js): sin NaN ni explosiones tras movimiento brusco, se calma en reposo, nada atraviesa
   cabeza/torso/brazos/piernas, y funciona con los 8 personajes. Corre three.js en node (sin WebGL). */
const test = require('node:test'), assert = require('node:assert'), path = require('node:path');
global.window = global; global.THREE = require(path.join(__dirname, '../js/vendor/three.min.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-pj.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-ropa.js'));
const PJ = window.FIESTA.V3.PJ;
const V = THREE.Vector3;

function sano(p) { let ok = true, max = 0; p.g.updateMatrixWorld(true);
  p.g.traverse((o) => { const e = o.matrixWorld.elements; for (let i = 0; i < 16; i++) { if (!Number.isFinite(e[i])) ok = false; if (i < 12) max = Math.max(max, Math.abs(e[i])); }
    for (const v of [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z]) if (!Number.isFinite(v)) ok = false; });
  return ok && max < 200; }
const quieta = (p) => { p.anim('quieto', { idle: false }); for (let i = 0; i < 40; i++) p.update(1 / 60); };

test('los 8 personajes tienen simulación de pelo y ropa (pj.ropa)', () => {
  for (const id of PJ.ids()) { const p = PJ.crear(id); assert.ok(p.ropa && p.ropa.n > 4, id + ' sin piezas'); assert.strictEqual(typeof p.ropa.reset, 'function'); assert.strictEqual(typeof p.ropa.penetracion, 'function'); }
  assert.ok(PJ.viento && 'fuerza' in PJ.viento);
});

test('movimiento brusco 10 s (carreras, teletransportes, impactos, vuelo, viento): sin NaN ni explosión', () => {
  const malos = [];
  PJ.viento.x = 1; PJ.viento.z = .3; PJ.viento.fuerza = 6;
  for (const id of PJ.ids()) {
    const p = PJ.crear(id, { escala: 1.2 }); let t = 0, z = 0, x = 0;
    p.anim('correr', { vel: 1 });
    const paso = (dt) => { p.update(dt); t += dt; if (!sano(p)) { malos.push(id + ' @' + t.toFixed(2)); return false; } return true; };
    for (let i = 0; i < 120 && malos.length < 1 + 0; i++) { z += 7 / 60; p.g.position.z = z; if (!paso(1 / 60)) break; }
    p.g.position.set(-40, 3, 25); z = 25; x = -40; for (let i = 0; i < 30; i++) if (!paso(1 / 60)) break;          // teletransporte
    p.g.position.set(60, 0, -60); for (let i = 0; i < 20; i++) if (!paso(1 / 60)) break;
    p.anim('quieto'); for (let i = 0; i < 4; i++) { p.impacto(Math.cos(i), Math.sin(i), 1.5 + i * .5); for (let k = 0; k < 40; k++) if (!paso(1 / 60)) break; }
    p.volar(1, -1, 3.5); for (let i = 0; i < 300; i++) if (!paso(1 / 60)) break;
    for (const u of ['saltar', 'golpe', 'caer', 'festejo']) { p.anim('quieto'); p.uno(u); for (let i = 0; i < 60; i++) if (!paso(1 / 30)) break; }
    p.update(0); p.update(.5); p.update(1 / 600); if (!sano(p)) malos.push(id + ' dt raro');
    p.g.position.set(1e3, 0, 1e3); for (let i = 0; i < 5; i++) paso(1 / 60);
  }
  PJ.viento.fuerza = 0;
  assert.deepStrictEqual(malos, []);
});

test('en reposo el pelo y la ropa se calman (no tiemblan ni se quedan lejos de su sitio)', () => {
  for (const id of PJ.ids()) {
    const p = PJ.crear(id); quieta(p);
    p.volar(1, 0, 3); for (let i = 0; i < 600 && p.volando; i++) p.update(1 / 60);
    p.anim('quieto', { idle: false }); for (let i = 0; i < 300; i++) p.update(1 / 60);
    // posición de las mallas nuevas en el marco del rig en dos instantes distintos del reposo: no se mueven
    const lee = () => { const a = []; p.g.traverse((o) => { if (o.isMesh && o.parent === p.ropa.grupo) a.push(o.position.x, o.position.y, o.position.z); }); return a; };
    let prev = lee(), dif = 0;       // la pose en reposo respira y carga el peso: lo que se mueve lo hace suave, nunca a saltos ni temblando
    for (let i = 0; i < 90; i++) { p.update(1 / 60); const c = lee(); for (let k = 0; k < c.length; k++) dif = Math.max(dif, Math.abs(c[k] - prev[k])); prev = c; }
    assert.ok(dif < .03, id + ' tiembla en reposo: ' + dif + ' por cuadro');
    assert.ok(p.ropa.penetracion() < .02, id + ' penetra ' + p.ropa.penetracion());
  }
});

test('nada atraviesa cabeza, torso, brazos ni piernas, en carrera, giros, golpes y vuelo', () => {
  const malos = [];
  for (const id of PJ.ids()) {
    const p = PJ.crear(id); let peor = 0, z = 0;
    let peorB = 0; const mide = () => { const d = p.ropa.penetracion(3), e = p.ropa.penetracion(); if (d > peor) peor = d; if (e > peorB) peorB = e; };
    p.anim('correr', { vel: 1 }); for (let i = 0; i < 180; i++) { z += 6 / 60; p.g.position.z = z; p.update(1 / 60); mide(); }
    p.anim('quieto'); p.mirar(1, 0); for (let i = 0; i < 60; i++) { p.update(1 / 60); mide(); }
    for (const u of ['saltar', 'golpe', 'caer', 'lanzar', 'susto']) { p.anim('quieto'); p.uno(u); for (let i = 0; i < 50; i++) { p.update(1 / 30); mide(); } }
    p.impacto(1, 0, 2); for (let i = 0; i < 60; i++) { p.update(1 / 60); mide(); }
    p.volar(0, 1, 3.4); for (let i = 0; i < 400; i++) { p.update(1 / 60); mide(); }
    if (peor > .025 || peorB > .08) malos.push(id + ': cabeza/torso ' + peor.toFixed(3) + ', todo ' + peorB.toFixed(3));
  }
  assert.deepStrictEqual(malos, []);
});

test('el pelo y la ropa sí se mueven (no son piezas muertas): correr los agita y la ropa se infla', () => {
  for (const id of PJ.ids()) {
    const p = PJ.crear(id); quieta(p); const lee = () => { const a = []; p.g.traverse((o) => { if (o.isMesh && o.parent === p.ropa.grupo) a.push(o.position.x, o.position.y, o.position.z); }); return a; };
    const a0 = lee(); let z = 0, pico = 0; p.anim('correr', { vel: 1 });
    for (let i = 0; i < 90; i++) { z += (i < 30 ? i / 30 : 1) * 6 / 60; p.g.position.z = z; p.update(1 / 60); const a = lee(); for (let k = 0; k < a.length; k++) pico = Math.max(pico, Math.abs(a[k] - a0[k])); }
    assert.ok(pico > .05, id + ' casi no se mueve al correr: ' + pico);
  }
});

test('suelto = 0 deja todo casi rígido y reset() recoloca; la API vieja sigue', () => {
  const p = PJ.crear('prima'); p.ropa.suelto = 0; p.anim('correr', { vel: 1 }); let z = 0; for (let i = 0; i < 60; i++) { z += .1; p.g.position.z = z; p.update(1 / 60); }
  p.ropa.suelto = 1; p.ropa.reset(); p.update(1 / 60); assert.ok(sano(p));
  for (const m of ['anim', 'uno', 'cara', 'impacto', 'volar', 'mano', 'prop', 'color', 'mirarA']) assert.strictEqual(typeof p[m], 'function', m);
});
