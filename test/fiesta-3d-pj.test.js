'use strict';
/* Personajes 3D (docs/style-lab/fiesta-3d-pj.js): cada personaje en cada pose y gesto, muestreado en el tiempo, sin brazos/manos/objetos
   dentro del torso ni de la cabeza. Corre three.js en node (sin WebGL: solo construye y mueve la escena). */
const test = require('node:test'), assert = require('node:assert'), path = require('node:path');
global.window = global; global.THREE = require(path.join(__dirname, '../js/vendor/three.min.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d.js'));
require(path.join(__dirname, '../docs/style-lab/fiesta-3d-pj.js'));
const PJ = window.FIESTA.V3.PJ;
const sinResolver = process.env.PJ_BASE === '1';

function recorrer(id, fn) {
  const p = PJ.crear(id, { choques: !sinResolver });
  const malos = {};
  const anota = (k) => { const c = p.choques(); if (c.length) malos[k] = (malos[k] || 0) + 1; };
  for (const a of PJ.ANIMS) { p.anim(a, { vel: 1 }); for (let i = 0; i < 90; i++) { p.update(1 / 30); if (i > 10) anota(a); } }
  for (const u of PJ.UNOS) { p.anim('quieto'); for (let i = 0; i < 15; i++) p.update(1 / 30); p.uno(u); for (let i = 0; i < 40; i++) { p.update(1 / 30); anota(u); } }
  return malos;
}

test('todos los personajes se construyen y tienen sus partes', () => {
  for (const id of PJ.ids()) { const p = PJ.crear(id); assert.ok(p.g.children.length, id); assert.ok(p.mano('der') && p.mano('izq'), id); }
});
test('ninguna pose ni gesto mete un brazo, mano u objeto dentro del cuerpo o la cabeza', () => {
  const todos = {};
  for (const id of PJ.ids()) { const m = recorrer(id); if (Object.keys(m).length) todos[id] = m; }
  if (sinResolver) console.log('BASE (sin resolver):', JSON.stringify(todos));
  if (!sinResolver) assert.deepStrictEqual(todos, {});
});

test('quietos no tiemblan: en una pose en bucle los hombros y codos no saltan de un cuadro a otro', () => {
  const malos = [];
  for (const id of PJ.ids()) for (const a of ['quieto', 'triste', 'sentado', 'cargar', 'empujar']) {
    const p = PJ.crear(id); p.anim(a, { vel: 0 }); for (let i = 0; i < 60; i++) p.update(1 / 60);
    let peor = 0, prev = null;
    for (let i = 0; i < 120; i++) {
      p.update(1 / 60);
      const v = [p.J.hI.rotation.z, p.J.hD.rotation.z, p.J.cI.rotation.x, p.J.cD.rotation.x];
      if (prev) for (let k = 0; k < 4; k++) peor = Math.max(peor, Math.abs(v[k] - prev[k]));
      prev = v;
    }
    if (peor > .01) malos.push(id + '/' + a + ': ' + peor.toFixed(3) + ' rad/cuadro');
  }
  assert.deepStrictEqual(malos, []);
});

/* ───────────── animación nueva: nada de NaN, física que se recupera, cadencia y mirada ───────────── */
const V = THREE.Vector3;
function finito(p) { let ok = true; p.g.traverse((o) => { for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]) if (!Number.isFinite(v)) ok = false; }); return ok; }
const quieta = (p) => { p.anim('quieto', { idle: false }); for (let i = 0; i < 40; i++) p.update(1 / 30); };

test('ninguna animación, gesto, cara, impacto ni vuelo deja NaN (ni escalas en cero)', () => {
  const malos = [];
  for (const id of PJ.ids()) {
    const p = PJ.crear(id, { escala: 1.2 });
    for (const a of PJ.ANIMS) { p.anim(a, { vel: .7 }); for (let i = 0; i < 40; i++) { p.update(1 / 30); if (!finito(p)) { malos.push(id + '/' + a); break; } } }
    for (const c of PJ.CARAS) { p.cara(c); p.update(1 / 30); if (!finito(p)) malos.push(id + '/cara ' + c); }
    p.cara('normal');
    for (const u of PJ.UNOS) { quieta(p); p.uno(u); for (let i = 0; i < 90; i++) { p.update(1 / 30); if (!finito(p)) { malos.push(id + '/' + u); break; } } }
    quieta(p); p.impacto(1, 0, 1.5); for (let i = 0; i < 60; i++) p.update(1 / 30); if (!finito(p)) malos.push(id + '/impacto');
    p.volar(0, -1, 3); for (let i = 0; i < 200; i++) { p.update(1 / 30); if (!finito(p)) { malos.push(id + '/volar'); break; } }
    p.update(0); p.update(1 / 600); p.update(.5); if (!finito(p)) malos.push(id + '/dt raro');     // dt cero, minúsculo y enorme
  }
  assert.deepStrictEqual(malos, []);
});

test('un nombre desconocido cae en quieto (API intacta)', () => {
  const p = PJ.crear('tu'); p.anim('no-existe'); assert.strictEqual(p.animacion, 'quieto'); p.uno('no-existe'); assert.strictEqual(p.gesto, ''); p.cara('no-existe'); assert.strictEqual(p.expresion, 'normal');
  for (const m of ['crear', 'ids']) assert.ok(PJ[m]); for (const m of ['anim', 'uno', 'cara', 'rumbo', 'mirar', 'prop', 'mano', 'color', 'update', 'impacto', 'volar', 'fx', 'mirarA']) assert.strictEqual(typeof p[m], 'function', m);
});

test('impacto: el cuerpo cede en la dirección del golpe y se recupera con resorte', () => {
  for (const id of PJ.ids()) {
    const dirs = [[0, 1, 'x', 1], [0, -1, 'x', -1], [1, 0, 'z', -1], [-1, 0, 'z', 1]];            // empuje en +z inclina hacia adelante (rx +), en +x la cabeza va a +x (rz -)
    for (const [dx, dz, eje, signo] of dirs) {
      const p = PJ.crear(id); quieta(p); p.impacto(dx, dz, 1.6);
      let pico = 0; for (let i = 0; i < 20; i++) { p.update(1 / 60); const a = eje === 'x' ? p.J.raiz.rotation.x : p.J.raiz.rotation.z; if (Math.abs(a) > Math.abs(pico)) pico = a; }
      assert.ok(Math.sign(pico) === signo && Math.abs(pico) > .12, id + ' ' + dx + ',' + dz + ': pico ' + pico);
      for (let i = 0; i < 240; i++) p.update(1 / 60);
      assert.ok(Math.abs(p.J.raiz.rotation.x) < .03 && Math.abs(p.J.raiz.rotation.z) < .03, id + ' no se recuperó: ' + p.J.raiz.rotation.x + ', ' + p.J.raiz.rotation.z);
      assert.ok(!p.volando);
    }
  }
  const p = PJ.crear('tu'); quieta(p); p.impacto(0, 1, .5); let a = 0; for (let i = 0; i < 20; i++) { p.update(1 / 60); a = Math.max(a, Math.abs(p.J.raiz.rotation.x)); }
  const q = PJ.crear('tu'); quieta(q); q.impacto(0, 1, 2); let b = 0; for (let i = 0; i < 20; i++) { q.update(1 / 60); b = Math.max(b, Math.abs(q.J.raiz.rotation.x)); }
  assert.ok(b > a * 1.8, 'más fuerza, más inclinación: ' + a + ' vs ' + b);
  const t = PJ.crear('tu'); quieta(t); t.impacto(1, 0, 3.2); assert.ok(t.volando, 'un golpe muy fuerte tumba (ragdoll)');
});

test('volar: gira libre, rebota, se acuesta sin hundirse en el piso, se levanta y vuelve a su pose', () => {
  for (const id of PJ.ids()) {
    for (const [dx, dz, f] of [[0, -1, 1.2], [1, 0, 2], [-1, 1, 3.5], [0, 1, .4]]) {
      const p = PJ.crear(id); quieta(p); p.volar(dx, dz, f);
      assert.ok(p.volando);
      let maxRot = 0, fases = new Set(), bajo = 9, t = 0;
      while (p.volando && t < 8) {
        p.update(1 / 60); t += 1 / 60; fases.add(p.fase); maxRot = Math.max(maxRot, Math.abs(p.J.raiz.rotation.x), Math.abs(p.J.raiz.rotation.z));
        p.g.updateMatrixWorld(true);
        const cab = p.J.cab.getWorldPosition(new V()).y, pie = Math.min(p.J.rI.localToWorld(new V(0, -.34, 0)).y, p.J.rD.localToWorld(new V(0, -.34, 0)).y);
        bajo = Math.min(bajo, cab - .45, pie + .05);
      }
      assert.ok(!p.volando, id + ' nunca terminó de levantarse');
      assert.ok(fases.has('aire') && fases.has('suelo') && fases.has('sube'), id + ' fases: ' + [...fases]);
      assert.ok(bajo > -.12, id + ' se hunde en el piso: ' + bajo.toFixed(3));
      assert.ok(maxRot > 1.2 * Math.min(1, f) * .8, id + ' casi no giró: ' + maxRot);
      for (let i = 0; i < 90; i++) p.update(1 / 60);
      const r = p.J.raiz; assert.ok(Math.abs(r.rotation.x) < .03 && Math.abs(r.rotation.z) < .03 && Math.abs(r.position.x) < .03 && Math.abs(r.position.z) < .03, id + ' no vuelve: ' + [r.rotation.x, r.rotation.z, r.position.x, r.position.z].map((v) => v.toFixed(3)));
      assert.ok(Math.abs(r.position.y - .9 * (p.datos.cuerpo ? p.datos.cuerpo.alto || 1 : 1)) < .06, id + ' altura final ' + r.position.y);
    }
  }
});

test('volar con mover:true deja el desplazamiento en g.position y no hay salto de vuelta', () => {
  const p = PJ.crear('mama'); quieta(p); p.g.position.set(5, 0, 5); p.volar(1, 0, 2, { mover: true });
  for (let i = 0; i < 600 && p.volando; i++) p.update(1 / 60);
  assert.ok(p.g.position.x > 6.5, 'avanzó en x: ' + p.g.position.x); assert.ok(Math.abs(p.J.raiz.position.x) < .05);
});

test('la cadencia sigue a la velocidad real: el pie apoyado no patina al caminar ni al correr', () => {
  for (const [anim, spd] of [['caminar', 1.6], ['caminar', 3], ['correr', 4.5], ['correr', 7]]) for (const esc of [1, 1.35]) {
    const p = PJ.crear('tio', { escala: esc }); p.anim(anim, { vel: Math.min(1, spd / 6) }); let z = 0, prev = null; const m = [], dt = 1 / 60;
    for (let i = 0; i < 360; i++) { z += spd * dt; p.g.position.z = z; p.update(dt); if (i < 120) continue; p.g.updateMatrixWorld(true);
      const w = [p.J.rI, p.J.rD].map((r) => r.localToWorld(new V(0, -.34, .05))); if (prev) m.push(Math.min(Math.abs(w[0].z - prev[0].z), Math.abs(w[1].z - prev[1].z)) / dt / esc); prev = w; }
    const media = m.reduce((a, b) => a + b, 0) / m.length / spd;
    assert.ok(media < .3, anim + ' a ' + spd + ' (x' + esc + '): el pie apoyado se desliza ' + (media * 100).toFixed(0) + '% de la velocidad');
  }
});

test('mirada: los ojos van primero, luego la cabeza y luego el torso, con límites amplios', () => {
  const p = PJ.crear('tu'); quieta(p); p.mirar(1, 0);
  p.update(1 / 60); p.update(1 / 60); const cab0 = p.J.cab.rotation.y;
  for (let i = 0; i < 90; i++) p.update(1 / 60);
  assert.ok(p.J.cab.rotation.y > .6, 'la cabeza gira bastante más que 11°: ' + p.J.cab.rotation.y); assert.ok(p.J.tor.rotation.y > .1, 'el torso acompaña: ' + p.J.tor.rotation.y); assert.ok(cab0 < p.J.cab.rotation.y * .4, 'la cabeza va detrás de los ojos');
  const q = PJ.crear('tu'); quieta(q); q.mirarA({ x: 3, y: 2, z: 3 }); for (let i = 0; i < 90; i++) q.update(1 / 60); assert.ok(q.J.cab.rotation.y > .4);
});

test('el pelo y los adornos se mecen por resortes cuando el grupo se mueve y se calman al parar', () => {
  const p = PJ.crear('prima'); quieta(p); const rot0 = p.J.cab.children.filter((c) => c.isGroup && !c.children.length === false).map((c) => c.rotation.x);
  let z = 0, pico = 0; p.anim('correr', { vel: 1 });
  for (let i = 0; i < 90; i++) { z += (i < 45 ? i / 45 : 1) * 6 / 60; p.g.position.z = z; p.update(1 / 60); p.J.cab.traverse((o) => { if (o.isGroup && o !== p.J.cab) pico = Math.max(pico, Math.abs(o.rotation.x), Math.abs(o.rotation.z)); }); }
  assert.ok(pico > .04, 'algo se mece al acelerar: ' + pico);
  p.anim('quieto', { idle: false }); for (let i = 0; i < 400; i++) p.update(1 / 60);
  let quietoPico = 0; p.J.cab.traverse((o) => { if (o.isGroup && o !== p.J.cab) quietoPico = Math.max(quietoPico, Math.abs(o.rotation.x), Math.abs(o.rotation.z)); });
  assert.ok(quietoPico < .02, 'se calma: ' + quietoPico);
});

test('el catálogo describe cada animación, gesto y cara (visor y tabla del doc)', () => {
  for (const a of PJ.ANIMS) assert.ok(PJ.DESC.anim[a] && PJ.DESC.anim[a][1], 'anim ' + a);
  for (const u of PJ.UNOS) assert.ok(PJ.DESC.uno[u] && PJ.DESC.uno[u][1], 'uno ' + u);
  for (const c of PJ.CARAS) assert.ok(PJ.DESC.cara[c], 'cara ' + c);
  assert.ok(PJ.ANIMS.length >= 55 && PJ.UNOS.length >= 45 && PJ.CARAS.length >= 24);
});

/* ───────────── director de animación: catálogo ampliado, personalidad, vida en espera, grupo al unísono ───────────── */
test('las animaciones y gestos nuevos están en las listas y descritos (visor y doc 15)', () => {
  assert.ok(PJ.ANIMS.length >= 74 && PJ.UNOS.length >= 64, PJ.ANIMS.length + ' anims, ' + PJ.UNOS.length + ' gestos');
  for (const a of PJ.NUEVOS.anim) assert.ok(PJ.ANIMS.includes(a), 'anim nueva ' + a); for (const u of PJ.NUEVOS.uno) assert.ok(PJ.UNOS.includes(u), 'gesto nuevo ' + u);
  for (const id of PJ.ids()) assert.ok(PJ.PERS[id], 'personalidad de ' + id);
});

test('cada personaje se mueve distinto: el ritmo y el rebote salen de su personalidad', () => {
  const ritmo = (id) => { const p = PJ.crear(id); p.anim('bailar'); let cruces = 0, prev = 0; for (let i = 0; i < 600; i++) { p.update(1 / 60); const v = Math.sin(0) + p.J.cad.position.y - .62; if (prev < .045 && v >= .045) cruces++; prev = v; } return cruces; };
  assert.ok(ritmo('pana') > ritmo('abuela') * 1.2, 'el niño nervioso baila más rápido que la abuela');
  const alto = (id) => { const p = PJ.crear(id); p.anim('correr', { vel: 1 }); let m = 0, z = 0; for (let i = 0; i < 240; i++) { z += 5 / 60; p.g.position.z = z; p.update(1 / 60); m = Math.max(m, p.J.cad.position.y - .62); } return m; };
  assert.ok(alto('tio') < alto('pana'), 'el tío pesado vuela menos al correr que el pana');
});

test('la espera tiene vida: los ojos y la cabeza miran a otros lados solos, sin tembladera', () => {
  for (const id of ['tu', 'pana', 'abuela']) {
    const p = PJ.crear(id); p.anim('quieto', { idle: false }); let kyMin = 9, kyMax = -9, prev = null, peor = 0;
    for (let i = 0; i < 60 * 40; i++) { p.update(1 / 60); const k = p.J.cab.rotation.y; kyMin = Math.min(kyMin, k); kyMax = Math.max(kyMax, k); if (prev != null) peor = Math.max(peor, Math.abs(k - prev)); prev = k; }
    assert.ok(kyMax - kyMin > .12, id + ' no gira la cabeza sola: ' + (kyMax - kyMin).toFixed(3)); assert.ok(peor < .06, id + ' la cabeza salta: ' + peor.toFixed(3));
  }
});

test('grupo_salta: con el reloj compartido todos saltan al unísono', () => {
  let tt = 0; PJ.reloj = () => tt; const a = PJ.crear('tu'), b = PJ.crear('tio'); a.anim('grupo_salta'); b.anim('grupo_salta'); let enAire = 0, juntos = 0;
  for (let i = 0; i < 180; i++) { tt += 1 / 60; a.update(1 / 60); b.update(1 / 60); if (i < 30) continue; const sa = a.J.cad.position.y - .62 > .06, sb = b.J.cad.position.y - .62 > .06; if (sa || sb) { enAire++; if (sa === sb) juntos++; } }
  delete PJ.reloj; assert.ok(enAire > 20 && juntos / enAire > .7, 'despegan y caen juntos: ' + juntos + '/' + enAire);
});
