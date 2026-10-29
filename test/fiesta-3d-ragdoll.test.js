'use strict';
/* Ragdoll físico de los personajes 3D (docs/style-lab/fiesta-3d-ragdoll.js): sin NaN, nada se hunde en el piso, el cuerpo se duerme, ningún brazo atraviesa el
   torso ni la cabeza, choca con paredes y cajas, hereda la velocidad del grupo, el golpe depende de dónde cae, vuelve a quedar de pie y la API vieja
   (pj.volar / pj.impacto / pj.volando / pj.fase / pj.desplazamiento) sigue igual. Corre three.js en node (sin WebGL). */
const test = require('node:test'), assert = require('node:assert'), path = require('node:path');
global.window = global; global.THREE = require(path.join(__dirname, '../js/vendor/three.min.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-pj.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-ragdoll.js'));
const PJ = window.FIESTA.V3.PJ, V = THREE.Vector3, DT = 1 / 60;

const finito = (p) => { let ok = true; p.g.traverse((o) => { for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]) if (!Number.isFinite(v)) ok = false; }); return ok; };
const quieta = (p) => { p.anim('quieto', { idle: false }); for (let i = 0; i < 40; i++) p.update(1 / 30); };
const corre = (p, s, f) => { for (let i = 0, n = Math.round(s * 60); i < n; i++) { p.update(DT); if (f) f(i); } };
function puntos(p) {                         // alturas reales (mundo) de cabeza, pies, manos y rodillas
  p.g.updateMatrixWorld(true);
  const w = (o, x, y, z) => o.localToWorld(new V(x, y, z));
  return { cab: p.J.cab.getWorldPosition(new V()).y - .45, pies: Math.min(w(p.J.rI, 0, -.34, 0).y, w(p.J.rD, 0, -.34, 0).y), manos: Math.min(w(p.J.cI, 0, -.33, 0).y, w(p.J.cD, 0, -.33, 0).y), rod: Math.min(w(p.J.rI, 0, 0, 0).y, w(p.J.rD, 0, 0, 0).y) };
}

test('la API nueva existe en todos los personajes y la vieja sigue igual', () => {
  for (const id of PJ.ids()) {
    const p = PJ.crear(id), r = p.ragdoll; assert.ok(r, id);
    for (const m of ['golpe', 'parcial', 'activar', 'soltar']) assert.strictEqual(typeof r[m], 'function', id + ' ' + m);
    assert.ok(Array.isArray(r.colisionadores)); assert.strictEqual(r.activo, false); assert.strictEqual(r.estado, '');
    for (const m of ['volar', 'impacto', 'anim', 'uno', 'update']) assert.strictEqual(typeof p[m], 'function', m);
    assert.strictEqual(p.volando, false); assert.strictEqual(p.fase, ''); assert.deepStrictEqual(p.desplazamiento, { x: 0, z: 0 });
  }
  const p = PJ.crear('tu'); quieta(p); assert.strictEqual(p.volar(1, 0, 2), p); assert.strictEqual(p.impacto(1, 0, .5), p); assert.ok(p.volando);
});

test('volar: sin NaN, sin hundirse, pasa por aire → suelo → sube y vuelve a quedar de pie igual que antes', () => {
  for (const id of PJ.ids()) {
    for (const [dx, dz, f] of [[0, -1, 1.2], [1, 0, 2], [-1, 1, 3.5], [0, 1, .4], [.7, -.7, 4]]) {
      const p = PJ.crear(id, { escala: id === 'tio' ? 1.3 : 1 }); quieta(p); p.volar(dx, dz, f);
      assert.ok(p.volando); const fases = new Set(); let t = 0, bajo = 9, manos = 9, rod = 9, malo = false;
      while (p.volando && t < 9) {
        p.update(DT); t += DT; fases.add(p.fase); if (!finito(p)) { malo = true; break; }
        const q = puntos(p); bajo = Math.min(bajo, q.cab, q.pies + .05); if (p.fase !== 'sube') manos = Math.min(manos, q.manos); rod = Math.min(rod, q.rod);
      }
      assert.ok(!malo, id + ' NaN'); assert.ok(!p.volando, id + ' nunca terminó de levantarse (' + f + ')');
      assert.ok(fases.has('aire') && fases.has('suelo') && fases.has('sube'), id + ' fases: ' + [...fases]);
      assert.ok(bajo > -.12, id + ' cabeza o pies se hunden: ' + bajo.toFixed(3)); assert.ok(manos > -.1, id + ' manos se hunden: ' + manos.toFixed(3)); assert.ok(rod > -.1, id + ' rodillas se hunden: ' + rod.toFixed(3));
      corre(p, 1.5); const r = p.J.raiz;
      assert.ok(Math.abs(r.rotation.x) < .03 && Math.abs(r.rotation.z) < .03 && Math.abs(r.position.x) < .03 && Math.abs(r.position.z) < .03, id + ' no vuelve: ' + [r.rotation.x, r.rotation.z, r.position.x, r.position.z].map((v) => v.toFixed(3)));
      assert.ok(Math.abs(r.position.y - .9 * (p.datos.cuerpo.alto || 1)) < .06, id + ' altura final ' + r.position.y); assert.strictEqual(p.ragdoll.estado, '');
      assert.ok(Math.abs(p.J.cab.position.y - .5) < 1e-6 && p.J.cab.position.x === 0 && p.J.cab.position.z === 0, id + ' la cabeza no vuelve a su sitio');
      for (const o of [p.J.rI, p.J.rD, p.J.cI, p.J.cD]) assert.ok(Math.abs(o.rotation.y) < 1e-6 && Math.abs(o.rotation.z) < 1e-6, id + ' rodilla/codo con ejes de más');
    }
  }
});

test('ningún brazo, mano u objeto atraviesa el torso (y en el aire tampoco la cabeza) durante la caída y al levantarse (pj.choques)', () => {
  // la cabeza apoyada sobre un brazo en el piso es válida (la cabeza es una esfera con pelo); el torso nunca debe tragarse un brazo
  const malos = {}; let total = 0, cuadros = 0;
  for (const id of PJ.ids()) for (const [dx, dz, f] of [[1, 0, 2.2], [0, -1, 3.5], [-.5, 1, 1], [0, 1, 1.6], [-1, -.3, 2.8]]) {
    const p = PJ.crear(id); quieta(p); p.volar(dx, dz, f); let fr = 0, n = 0;
    for (let i = 0; i < 60 * 8 && (p.volando || i < 5); i++) { p.update(DT); n++; if (p.choques().some((c) => c.endsWith('torso') || p.fase === 'aire')) fr++; }
    total += fr; cuadros += n; if (fr > .15 * n) malos[id + ' ' + [dx, dz, f]] = fr + '/' + n;
  }
  assert.deepStrictEqual(malos, {}); assert.ok(total < .05 * cuadros, 'cuadros con un brazo dentro del torso: ' + total + ' de ' + cuadros);
});

test('el cuerpo se duerme (ragdoll manual): queda tirado sin hundirse, la simulación para y soltar() lo levanta', () => {
  for (const id of ['tu', 'tio', 'abuela']) {
    const p = PJ.crear(id); quieta(p); p.ragdoll.activar({ dx: 1, dz: .3, fuerza: 2 }); assert.ok(p.ragdoll.activo); assert.strictEqual(p.ragdoll.estado, 'caida'); assert.ok(p.volando);
    corre(p, 8); assert.ok(p.ragdoll.dormido, id + ' no se duerme'); assert.ok(p.ragdoll.activo && p.volando && p.fase === 'suelo', id + ' ' + p.fase);
    const antes = Array.from(p.ragdoll.particulas); corre(p, 1); const despues = p.ragdoll.particulas; let mov = 0; for (let i = 0; i < antes.length; i++) mov = Math.max(mov, Math.abs(antes[i] - despues[i]));
    assert.ok(mov < 1e-9, id + ' sigue moviéndose dormido: ' + mov); const q = puntos(p); assert.ok(q.cab > -.12 && q.pies > -.1, id + ' hundido ' + JSON.stringify(q)); assert.ok(finito(p));
    p.ragdoll.soltar(); corre(p, 4.5); assert.ok(!p.volando, id + ' no se levanta tras soltar'); const r = p.J.raiz; assert.ok(Math.abs(r.rotation.x) < .03 && Math.abs(r.rotation.z) < .03 && Math.abs(r.position.y - .9 * (p.datos.cuerpo.alto || 1)) < .06, id);
  }
});

test('una pared y una caja del juego detienen al cuerpo y no se atraviesan', () => {
  const p = PJ.crear('tu'); quieta(p); p.g.position.set(10, 0, 10);
  p.ragdoll.colisionadores.push({ tipo: 'caja', min: { x: 11.2, y: 0, z: 5 }, max: { x: 11.6, y: 9, z: 15 } });          // pared a 1.2 m delante (+x)
  p.volar(1, 0, 3.5, { mover: true, alcance: 3 }); let maxx = -9, mn = 9;
  for (let i = 0; i < 60 * 3; i++) { p.update(DT); const a = p.ragdoll.particulas; for (let k = 0; k < 17; k++) { maxx = Math.max(maxx, a[k * 3]); } if (p.fase === 'suelo') { for (let k = 0; k < 17; k++) mn = Math.min(mn, a[k * 3]); } }
  assert.ok(maxx < 11.2 + .02, 'una partícula atravesó la pared: ' + maxx.toFixed(3)); assert.ok(maxx > 10.9, 'ni llegó a tocar la pared: ' + maxx.toFixed(3));
  const q = PJ.crear('tu'); quieta(q); q.g.position.set(0, 0, 0); window.FIESTA.V3.PJ.RAGDOLL.colisionadores.push({ tipo: 'esfera', x: 1.2, y: .6, z: 0, r: .6 }); q.volar(1, 0, 2.5, { mover: true, alcance: 3 }); let dentro = 0;
  for (let i = 0; i < 60 * 3; i++) { q.update(DT); const a = q.ragdoll.particulas; for (const k of [2, 3, 8]) { const d = Math.hypot(a[k * 3] - 1.2, a[k * 3 + 1] - .6, a[k * 3 + 2]); if (d < .6 + .05) dentro++; } }
  window.FIESTA.V3.PJ.RAGDOLL.colisionadores.length = 0; assert.strictEqual(dentro, 0, 'el torso o la cabeza entraron a la esfera');
});

test('hereda la velocidad del grupo: si corría al caer, sigue de largo', () => {
  const run = (vz) => { const p = PJ.crear('pana'); p.anim(vz ? 'correr' : 'quieto', { vel: 1 }); let z = 0; for (let i = 0; i < 60; i++) { z += vz * DT; p.g.position.z = z; p.update(DT); }
    p.volar(0, 1, .6, { mover: true, alcance: 4 }); const z0 = z; for (let i = 0; i < 90; i++) { if (i < 20) { z += vz * DT; p.g.position.z = z; } p.update(DT); } return { desp: p.ragdoll.particulas[2 * 3 + 2] - z0 }; };
  const parado = run(0), corriendo = run(6); assert.ok(corriendo.desp > parado.desp + 1.2, 'corriendo llega más lejos: ' + corriendo.desp.toFixed(2) + ' vs ' + parado.desp.toFixed(2));
});

test('el golpe depende de dónde cae: en la cabeza no es lo mismo que en la pierna (ragdoll parcial)', () => {
  const dif = (zona) => { const p = PJ.crear('tu'); quieta(p); p.ragdoll.golpe(zona, [1, 0], 1.6); assert.strictEqual(p.ragdoll.estado, 'parcial'); const pos = { cab: 0, tor: 0, pierna: 0, brazo: 0 };
    const base = PJ.crear('tu'); quieta(base);
    for (let i = 0; i < 30; i++) { p.update(DT); base.update(DT); const d = (a, b) => Math.abs(a.rotation.x - b.rotation.x) + Math.abs(a.rotation.y - b.rotation.y) + Math.abs(a.rotation.z - b.rotation.z);
      pos.cab = Math.max(pos.cab, d(p.J.cab, base.J.cab)); pos.tor = Math.max(pos.tor, d(p.J.tor, base.J.tor)); pos.pierna = Math.max(pos.pierna, d(p.J.mI, base.J.mI) + d(p.J.rI, base.J.rI)); pos.brazo = Math.max(pos.brazo, d(p.J.hI, base.J.hI) + d(p.J.cI, base.J.cI)); assert.ok(finito(p)); }
    for (let i = 0; i < 180; i++) p.update(DT); assert.strictEqual(p.ragdoll.estado, '', 'el parcial no termina'); return pos; };
  const cab = dif('cabeza'), pie = dif('piernaI'), bra = dif('brazoI');
  assert.ok(cab.cab > pie.cab * 2 && cab.cab > .15, 'la cabeza reacciona más al golpe en la cabeza: ' + cab.cab.toFixed(2) + ' vs ' + pie.cab.toFixed(2));
  assert.ok(pie.pierna > cab.pierna * 2 && pie.pierna > .15, 'la pierna reacciona al golpe en la pierna: ' + pie.pierna.toFixed(2) + ' vs ' + cab.pierna.toFixed(2));
  assert.ok(bra.brazo > cab.brazo * 1.5 && bra.brazo > .15, 'el brazo reacciona al golpe en el brazo: ' + bra.brazo.toFixed(2) + ' vs ' + cab.brazo.toFixed(2));
  assert.ok(pie.cab < cab.cab && bra.pierna < pie.pierna);
});

test('golpe fuerte lo tumba; ya en el piso, un golpe lo empuja; impacto viejo = resorte + parcial sin dejar nada raro', () => {
  const p = PJ.crear('mama'); quieta(p); p.ragdoll.golpe('cabeza', { x: 1, y: .2, z: 0 }, 3); corre(p, .3); assert.ok(p.volando && p.ragdoll.estado === 'caida', 'el golpe fuerte tumba');
  corre(p, 1.2); const x0 = p.ragdoll.particulas[2 * 3]; p.ragdoll.golpe('torso', [1, 0], 2); corre(p, .3); assert.ok(p.ragdoll.particulas[2 * 3] > x0 + .15, 'un golpe en el piso lo empuja'); corre(p, 6); assert.ok(!p.volando);
  const q = PJ.crear('tu'); quieta(q); q.impacto(0, 1, 1.5); assert.strictEqual(q.ragdoll.estado, 'parcial'); assert.ok(!q.volando); corre(q, 4); assert.strictEqual(q.ragdoll.estado, ''); assert.ok(Math.abs(q.J.raiz.rotation.x) < .03);
  const r = PJ.crear('tu'); quieta(r); for (let i = 0; i < 5; i++) { r.impacto(1, 0, 1.2); corre(r, .1); } corre(r, 4); assert.ok(finito(r) && r.ragdoll.estado === '' && !r.volando);
});

test('mezcla suave: no hay saltos de un cuadro a otro al entrar al ragdoll ni al levantarse', () => {
  for (const id of ['tu', 'prima']) {
    const p = PJ.crear(id); quieta(p); p.volar(1, 0, 2); let prev = null, peor = 0, i = 0;
    while (p.volando && i++ < 600) {
      p.update(DT); p.g.updateMatrixWorld(true); const cur = [p.J.cab, p.J.hI, p.J.hD, p.J.rI, p.J.rD, p.J.tor].map((o) => o.getWorldPosition(new V()));
      if (prev && p.fase !== 'aire') for (let k = 0; k < cur.length; k++) peor = Math.max(peor, cur[k].distanceTo(prev[k])); prev = cur;
    }
    assert.ok(peor < .25, id + ': una articulación salta ' + peor.toFixed(3) + ' en un cuadro');
  }
});

test('costo: 8 personajes cayendo a la vez caben en un cuadro de 60 fps (sin asignaciones por cuadro)', () => {
  const ps = []; for (let i = 0; i < 8; i++) { const p = PJ.crear(PJ.ids()[i % PJ.ids().length]); quieta(p); p.volar(Math.cos(i), Math.sin(i), 2.5); ps.push(p); }
  for (let i = 0; i < 30; i++) for (const p of ps) p.update(DT);
  const t0 = process.hrtime.bigint(); let n = 0; for (let i = 0; i < 30; i++) for (const p of ps) { p.ragdoll.activo && p.update(DT); n++; } const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 30;
  assert.ok(ms < 8, '8 personajes tardan ' + ms.toFixed(2) + ' ms por cuadro (node, sin dibujar)');
});

test('dt raros (0, minúsculo, enorme) no rompen el ragdoll', () => {
  const p = PJ.crear('tu'); quieta(p); p.volar(1, 0, 3); for (const dt of [0, 1 / 600, .5, 0, .016, 2, 1 / 30]) { p.update(dt); assert.ok(finito(p), 'dt ' + dt); }
  for (let i = 0; i < 400 && p.volando; i++) p.update(1 / 30); assert.ok(finito(p) && !p.volando);
});

test('colisionadores de todos los tipos (plano, cilindro, caja de un objeto, globales) y golpes por punto del mundo', () => {
  const G = PJ.RAGDOLL.colisionadores, tipos = [
    { tipo: 'plano', nx: -1, ny: 0, nz: 0, d: -2 },                                                   // pared en x = 2 (el lado permitido es x < 2)
    { tipo: 'cilindro', x: 2.5, z: 0, r: .5, y0: 0, y1: 4 }];
  for (const c of tipos) {
    G.length = 0; G.push(c); const p = PJ.crear('pana'); quieta(p); p.g.position.set(0, 0, 0); p.volar(1, 0, 3, { mover: true, alcance: 4 }); let maxx = -9;
    for (let i = 0; i < 60 * 3; i++) { p.update(DT); const a = p.ragdoll.particulas; for (const k of [2, 3, 8]) maxx = Math.max(maxx, a[k * 3] + (k === 8 ? .46 : .25) * 0); assert.ok(finito(p)); }
    G.length = 0; assert.ok(maxx < (c.tipo === 'plano' ? 2.02 : 2.2), c.tipo + ': el torso o la cabeza lo atravesaron: ' + maxx.toFixed(2));
  }
  const caja = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 6), new THREE.MeshBasicMaterial()); caja.position.set(2.4, 1.5, 0); const scene = new THREE.Scene(); scene.add(caja);
  const q = PJ.crear('tu'); quieta(q); q.ragdoll.colisionadores.push({ tipo: 'caja', obj: caja }); q.volar(1, 0, 3, { mover: true, alcance: 4 }); let mx = -9;
  for (let i = 0; i < 60 * 3; i++) { q.update(DT); for (const k of [2, 3, 8]) mx = Math.max(mx, q.ragdoll.particulas[k * 3]); } assert.ok(mx < 1.95 && mx > 1, 'una caja hecha de un objeto 3D también frena al cuerpo: ' + mx.toFixed(2));
  const p = PJ.crear('tu'); quieta(p); p.g.updateMatrixWorld(true); const cab = p.J.cab.getWorldPosition(new V()); p.ragdoll.golpe({ x: cab.x, y: cab.y, z: cab.z }, { x: 1, y: 0, z: 0 }, 1.5);
  assert.strictEqual(p.ragdoll.estado, 'parcial'); let d = 0; for (let i = 0; i < 20; i++) { p.update(DT); d = Math.max(d, Math.abs(p.J.cab.position.x) + Math.abs(p.J.cab.position.z)); } assert.ok(d > .05, 'un golpe en un punto de la cabeza la mueve: ' + d.toFixed(3));
});

test('si el juego mueve al personaje de golpe (respawn) el cuerpo tirado va con él', () => {
  const p = PJ.crear('tu'); quieta(p); p.ragdoll.activar({ dx: 1, fuerza: 1 }); corre(p, 1.5); p.g.position.set(40, 0, -25); corre(p, .2);
  assert.ok(Math.abs(p.J.raiz.position.x) < 3 && Math.abs(p.J.raiz.position.z) < 3, 'el cuerpo se quedó atrás: ' + [p.J.raiz.position.x, p.J.raiz.position.z].map((v) => v.toFixed(1)));
});
