'use strict';
/* Locomoción e IK de los personajes 3D (docs/style-lab/fiesta-3d-ik.js): pies clavados al piso, rampas y escalones, rodillas sin hiperextender, manos que alcanzan,
   aterrizaje con peso y nada de NaN. three.js corre en node (sin WebGL). */
const test = require('node:test'), assert = require('node:assert'), path = require('node:path');
global.window = global; global.THREE = require(path.join(__dirname, '../js/vendor/three.min.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-pj.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-ik.js'));
const PJ = window.FIESTA.V3.PJ, V = THREE.Vector3, DT = 1 / 60;
const tobillo = (p, k) => (k ? p.J.rD : p.J.rI).children.find((c) => c.userData && c.userData.n > 0);
const suela = (p, k, z) => tobillo(p, k).localToWorld(new V(0, -.03, z == null ? .05 : z));
const finito = (p) => { let ok = true; p.g.traverse((o) => { for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]) if (!Number.isFinite(v)) ok = false; }); return ok; };
// camina/corre en línea recta a velocidad constante y devuelve el estado cada cuadro
function marcha(p, anim, vx, vz, n, cb, y0) {
  const sp = Math.hypot(vx, vz); p.anim(anim, { vel: Math.min(1, sp / 6) }); let x = p.g.position.x, z = p.g.position.z;
  for (let i = 0; i < n; i++) { x += vx * DT; z += vz * DT; p.g.position.x = x; p.g.position.z = z; p.update(DT); p.g.updateMatrixWorld(true); cb && cb(i); }
}

test('la tecnología está: tobillo propio, API pj.ik y piso plano por defecto', () => {
  for (const id of PJ.ids()) { const p = PJ.crear(id); assert.ok(p.ik && typeof p.ik.mano === 'function' && typeof p.ik.manos === 'function'); assert.strictEqual(p.ik.terreno, null); assert.ok(tobillo(p, 0) && tobillo(p, 1), id); }
});

test('el IK de dos huesos llega a su objetivo dentro del alcance (piernas y codos) y recorta fuera de él', () => {
  const { dosHuesos, nuevoOut } = PJ.IK;
  const resuelve = (H, Tg, j, flip, l1, l2) => { const o = nuevoOut(); dosHuesos(H, Tg, l1, l2, j, flip, o); const q = o.q;
    const a = new V(0, -l1, 0).applyQuaternion(q), b = new V(0, -l2, 0).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new V(1, 0, 0), o.k)).applyQuaternion(q);
    return { fin: H.clone().add(a).add(b), o: o }; };
  for (const Tg of [new V(0, -.5, .1), new V(.1, -.4, .3), new V(-.1, -.3, -.2), new V(0, -.1, .45)]) {
    const r = resuelve(new V(0, 0, 0), Tg, new V(0, 0, 1), false, .31, .31); assert.ok(r.fin.distanceTo(Tg) < 1e-4 && r.o.k >= 0, 'pierna ' + Tg.toArray());
  }
  for (const Tg of [new V(.28, .64, .5), new V(.5, .1, .2), new V(.2, .4, -.3)]) {
    const r = resuelve(new V(.3, .5, 0), Tg, new V(.5, -.5, -.5), true, .3, .33); assert.ok(r.fin.distanceTo(Tg) < 1e-4 && r.o.k <= 0, 'brazo ' + Tg.toArray());
  }
  const lejos = resuelve(new V(0, 0, 0), new V(0, -2, 0), new V(0, 0, 1), false, .31, .31); assert.ok(lejos.fin.length() <= .62 + 1e-6 && Math.abs(lejos.o.k) < .1, 'recorta al alcance, pierna estirada');
});

test('el pie apoyado no se desliza en el mundo al caminar, correr y caminar de lado o hacia atrás', () => {
  for (const [anim, vx, vz] of [['caminar', 0, 1.6], ['caminar', 0, 3], ['correr', 0, 5], ['caminar', 2, 0], ['caminar', 0, -1.6], ['caminar', 1.2, 1.2]]) for (const id of ['tu', 'tio']) {
    const p = PJ.crear(id); p.g.position.y = .3; p.rumbo(0); let prev = null, plant = 0, slide = 0, tot = 0;
    marcha(p, anim, vx, vz, 360, (i) => { if (i < 100) return; const e = p.ik.estado, w = [suela(p, 0), suela(p, 1)];
      if (prev) e.pies.forEach((f, k) => { if (f.plantado && f.punto.y - .3 < .01) { tot++; if (prev[k].plant) { plant++; slide += Math.hypot(w[k].x - prev[k].p.x, w[k].z - prev[k].p.z) / DT / Math.hypot(vx, vz); } } });
      prev = e.pies.map((f, k) => ({ plant: f.plantado, p: w[k] })); });
    assert.ok(tot > 100, anim + ' ' + vx + ',' + vz + ': casi nunca hay pie apoyado (' + tot + ')');
    // con el pie bien plantado el punto de apoyo se queda; el despegue del talón y el alcance máximo dejan un poco de deslizamiento
    assert.ok(slide / Math.max(1, plant) < .22, anim + ' ' + vx + ',' + vz + ' (' + id + '): el pie apoyado se desliza ' + (slide / Math.max(1, plant) * 100).toFixed(0) + '% de la velocidad');
  }
});

test('hacia adelante y hacia atrás los pies no se cruzan ni se pisan, y la rodilla nunca se hiperextiende (también de lado)', () => {
  for (const [vx, vz] of [[2, 0], [-2, 0], [0, -1.8], [0, 4]]) {
    const p = PJ.crear('tu'); p.rumbo(0); let minSep = 9, minK = 9;
    marcha(p, vz > 3 ? 'correr' : 'caminar', vx, vz, 300, (i) => { if (i < 90) return; const a = suela(p, 0, .05), b = suela(p, 1, .05); minSep = Math.min(minSep, b.x - a.x); minK = Math.min(minK, p.J.rI.rotation.x, p.J.rD.rotation.x); });
    if (!vx) assert.ok(minSep > .1, vx + ',' + vz + ': los pies se cruzan: ' + minSep.toFixed(2)); assert.ok(minK > -1e-3, 'rodilla hiperextendida ' + minK);
  }
});

test('los pies siguen una rampa y un escalón sin atravesar el piso, con la cadera subiendo', () => {
  for (const [nom, alt] of [['rampa', (x) => x > 0 ? Math.min(x * .4, .8) : 0], ['escalón', (x) => (x > .8 ? .25 : 0) + (x > 1.7 ? .25 : 0)], ['bajada', (x) => x > 0 ? -Math.min(x * .3, .5) : 0]]) {
    const p = PJ.crear('tu'); p.ik.terreno = (x) => alt(x) + .3; let min = 9, maxHip = -9, x = -1.2; p.anim('caminar', { vel: .4 }); p.rumbo(Math.PI / 2);
    for (let i = 0; i < 420; i++) { x += 1.2 * DT; p.g.position.set(x, alt(x) + .3, 0); p.update(DT); p.g.updateMatrixWorld(true);
      if (i > 60) { for (let k = 0; k < 2; k++) for (const z of [-.1, .05, .2]) { const a = suela(p, k, z); min = Math.min(min, a.y - (alt(a.x) + .3)); } maxHip = Math.max(maxHip, p.J.cad.getWorldPosition(new V()).y - (alt(x) + .3)); }
      assert.ok(finito(p), nom + ' NaN'); }
    assert.ok(min > -.02, nom + ': la suela atraviesa el piso ' + min.toFixed(3)); assert.ok(maxHip < 1, nom + ': la cadera se va ' + maxHip.toFixed(2));
  }
  // quieto sobre un escalón: cada pie en su nivel
  const p = PJ.crear('tu'); p.ik.terreno = (x) => (x > .1 ? .25 : 0) + .3; p.g.position.set(0, .3, 0); for (let i = 0; i < 40; i++) p.update(DT);
  p.g.position.set(.12, .45, 0); for (let i = 0; i < 120; i++) { p.g.position.set(.12, .45, 0); p.update(DT); } p.g.updateMatrixWorld(true);
  for (let k = 0; k < 2; k++) assert.ok(suela(p, k, .05).y > .27, 'pie ' + k + ' bajo el piso: ' + suela(p, k, .05).y);
});

test('parado, el pie se queda plantado y al girar el cuerpo da pasos de giro (los pies terminan alineados)', () => {
  const p = PJ.crear('mama'); p.g.position.y = .3; p.anim('quieto', { idle: false }); for (let i = 0; i < 40; i++) p.update(DT);
  const a0 = suela(p, 0), b0 = suela(p, 1); for (let i = 0; i < 120; i++) p.update(DT); p.g.updateMatrixWorld(true);
  assert.ok(suela(p, 0).distanceTo(a0) < .01 && suela(p, 1).distanceTo(b0) < .01, 'quieto, los pies no se mueven');
  let pasos = 0, ant = [false, false]; p.rumbo(2.2);
  for (let i = 0; i < 240; i++) { p.update(DT); const e = p.ik.estado; e.pies.forEach((f, k) => { if (!f.plantado && ant[k] === false && !f._x) { } if (ant[k] && !f.plantado) pasos++; ant[k] = f.plantado; }); }
  p.g.updateMatrixWorld(true); assert.ok(pasos >= 2, 'dio pasos al girar: ' + pasos);
  const fd = (k) => { const a = suela(p, k, 0), b = suela(p, k, .3); return Math.atan2(b.x - a.x, b.z - a.z); };
  const ry = p.g.rotation.y; for (let k = 0; k < 2; k++) assert.ok(Math.abs(Math.atan2(Math.sin(fd(k) - ry), Math.cos(fd(k) - ry))) < .35, 'pie ' + k + ' desalineado');
});

test('arranque y frenada: se pasa de parado a marcha y de vuelta sin que el pie salte', () => {
  const p = PJ.crear('tu'); p.g.position.y = .3; p.rumbo(0); p.anim('quieto', { idle: false }); for (let i = 0; i < 30; i++) p.update(DT);
  let prev = null, prev2 = null, salto = 0, z = 0;       // un salto de pop se ve como una aceleración enorme (segunda diferencia de la posición del tobillo)
  const paso = (v, anim) => { z += v * DT; p.g.position.z = z; p.anim(anim, { vel: Math.min(1, v / 6) }); p.update(DT); p.g.updateMatrixWorld(true);
    const w = [suela(p, 0), suela(p, 1)]; if (prev && prev2) for (let k = 0; k < 2; k++) salto = Math.max(salto, w[k].clone().sub(prev[k]).sub(prev[k].clone().sub(prev2[k])).length()); prev2 = prev; prev = w; };
  for (let i = 0; i < 90; i++) paso(Math.min(3, i * .06), 'caminar'); for (let i = 0; i < 120; i++) paso(3, 'caminar'); for (let i = 0; i < 90; i++) paso(Math.max(0, 3 - i * .08), 'caminar'); for (let i = 0; i < 120; i++) paso(0, 'quieto');
  assert.ok(salto < .2, 'un pie pegó un salto de ' + salto.toFixed(3) + ' m (aceleración por cuadro)'); assert.ok(finito(p));
});

test('aterrizaje con peso: la cadera cede más cuanto más alta la caída y la pierna se dobla (sin atravesar el piso)', () => {
  const prueba = (altura) => {
    const p = PJ.crear('tu'); p.anim('quieto', { idle: false }); p.g.position.set(0, .3 + altura, 0); for (let i = 0; i < 3; i++) p.update(DT);
    let vy = 0, y = .3 + altura, min = 9, hundido = 0;
    for (let i = 0; i < 240; i++) { vy -= 16 * DT; y += vy * DT; if (y <= .3) { y = .3; vy = 0; } p.g.position.y = y; p.update(DT); p.g.updateMatrixWorld(true);
      if (y === .3) { min = Math.min(min, p.J.cad.getWorldPosition(new V()).y); hundido = Math.min(hundido, suela(p, 0).y - .3, suela(p, 1).y - .3); } assert.ok(finito(p)); }
    return { cad: min, hundido: hundido };
  };
  const bajo = prueba(.4), alto = prueba(3);
  assert.ok(alto.cad < bajo.cad - .02, 'más altura, más flexión: ' + bajo.cad.toFixed(3) + ' vs ' + alto.cad.toFixed(3)); assert.ok(alto.hundido > -.05 && bajo.hundido > -.05, 'los pies no se hunden');
});

test('manos IK: alcanzan el objetivo dentro del radio, siguen un objeto y vuelven suaves (sin NaN ni brazos dentro del cuerpo)', () => {
  const p = PJ.crear('mama'); p.prop(false); p.g.position.set(1, .3, 2); for (let i = 0; i < 30; i++) p.update(DT);
  const obj = new V(1.3, 1.5, 2.5);
  p.ik.mano('der', obj, 1); for (let i = 0; i < 60; i++) p.update(DT); p.g.updateMatrixWorld(true);
  assert.ok(p.mano('der').getWorldPosition(new V()).distanceTo(obj) < .05, 'la mano llegó: ' + p.mano('der').getWorldPosition(new V()).distanceTo(obj).toFixed(3)); assert.ok(p.ik.estado.manos[1].alcanza); assert.deepStrictEqual(p.choques(), []);
  const bola = new THREE.Group(); bola.position.set(1, 1.45, 2.55); const hijo = new THREE.Object3D(); hijo.position.set(.1, 0, 0); bola.add(hijo); const esc = new THREE.Scene(); esc.add(bola, p.g);
  p.ik.manos(bola, { izq: [-.2, 0, 0], der: [.2, 0, 0] }, 1);
  for (let i = 0; i < 90; i++) { bola.position.x = 1 + Math.sin(i / 20) * .1; p.update(DT); } p.g.updateMatrixWorld(true);
  for (const [l, off] of [['izq', -.2], ['der', .2]]) assert.ok(p.mano(l).getWorldPosition(new V()).distanceTo(bola.localToWorld(new V(off, 0, 0))) < .08, 'mano ' + l + ' sigue al objeto');
  p.ik.mano('der', null); p.ik.manos(null);
  let ant = p.mano('der').getWorldPosition(new V()), maxPaso = 0; for (let i = 0; i < 120; i++) { p.update(DT); p.g.updateMatrixWorld(true); const q = p.mano('der').getWorldPosition(new V()); maxPaso = Math.max(maxPaso, q.distanceTo(ant)); ant = q; assert.ok(finito(p)); }
  assert.ok(maxPaso < .08, 'la mano vuelve suave, sin saltos: ' + maxPaso.toFixed(3));
  assert.ok(p.ik.estado.manos[1].peso < .01); const r = PJ.crear('mama'); r.prop(false); r.g.position.set(1, .3, 2); for (let i = 0; i < 150; i++) r.update(DT);
  assert.ok(p.mano('der').getWorldPosition(new V()).distanceTo(r.mano('der').getWorldPosition(new V())) < .12, 'vuelve a su animación');
  // objetivo fuera de alcance: se estira sin romperse
  p.ik.mano('izq', new V(9, 1, 9), 1); for (let i = 0; i < 40; i++) p.update(DT); assert.ok(finito(p));
});

test('con el IK cargado, ninguna animación ni gesto deja NaN, meten un brazo en el cuerpo o hiperextienden una rodilla (parado y en movimiento)', () => {
  const malos = [];
  for (const id of PJ.ids()) {
    const p = PJ.crear(id, { escala: 1.2 }); p.g.position.y = .3; let z = 0;
    for (const a of PJ.ANIMS) for (const v of [0, 2.5]) {
      p.anim(a, { vel: .7 }); let ch = 0;
      for (let i = 0; i < 40; i++) { z += v * DT; p.g.position.z = z; p.update(DT); if (!finito(p)) { malos.push(id + '/' + a + ' NaN'); break; } if (i > 12 && p.choques().length) ch++; if (p.J.rI.rotation.x < -.01 || p.J.rD.rotation.x < -.01) { malos.push(id + '/' + a + ' rodilla'); break; } }
      if (ch) malos.push(id + '/' + a + ' (v' + v + ') brazo en el cuerpo ' + ch);
    }
    for (const u of PJ.UNOS) { p.anim('quieto'); for (let i = 0; i < 10; i++) p.update(DT); p.uno(u); for (let i = 0; i < 45; i++) { p.update(DT); if (!finito(p)) { malos.push(id + '/' + u + ' NaN'); break; } if (i > 8 && p.choques().length) { malos.push(id + '/' + u + ' brazo en el cuerpo'); break; } } }
    p.volar(1, 0, 2); for (let i = 0; i < 260; i++) { p.update(DT); if (!finito(p)) { malos.push(id + '/volar'); break; } }
  }
  assert.deepStrictEqual(malos, []);
});

test('el módulo se apaga limpio: pj.ik.pies = false deja la animación de siempre y con ragdoll no interviene', () => {
  const a = PJ.crear('tu'), b = PJ.crear('tu'); b.ik.pies = false; a.g.position.y = b.g.position.y = .3;
  let z = 0; for (let i = 0; i < 200; i++) { z += 3 * DT; for (const p of [a, b]) { p.g.position.z = z; p.anim('caminar', { vel: .5 }); p.update(DT); } }
  assert.ok(Math.abs(b.J.rI.rotation.x - b.J.rI.rotation.x) < 1e-9 && b.ik.estado.peso[0] < .01 && a.ik.estado.peso[0] > .9);
  a.volar(1, 0, 2); for (let i = 0; i < 20; i++) a.update(DT); assert.ok(a.volando); assert.ok(a.ik.estado.peso[0] < .01, 'no se mete mientras vuela');
  for (let i = 0; i < 300 && a.volando; i++) a.update(DT); for (let i = 0; i < 60; i++) { a.anim('quieto'); a.update(DT); } assert.ok(finito(a) && a.ik.estado.peso[0] > .9, 'recupera el IK al levantarse');
});
