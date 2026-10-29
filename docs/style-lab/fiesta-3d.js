// LA FIESTA · 3D low poly (FIESTA.V3): el kit con el que un minijuego en vivo se dibuja en 3D (three.js r128, js/vendor/three.min.js) en vez de 2D.
// Solo cambia CÓMO se ve: la simulación, la red y los puntajes del juego siguen iguales (el juego llama a esc.render() dentro de su draw()).
//
// Cómo se compone el cuadro: el WebGL va en un <canvas> propio DETRÁS del lienzo del motor (#c), a la resolución real de la pantalla. El juego
// deja transparente su zona en el lienzo pixelado del motor (esc.render() hace clearRect), el motor pinta encima lo 2D de siempre (textos,
// HUD, cuenta 3·2·1, tarjetas) y en postSNES llama a V3.cuadro(OUTX): si hubo 3D en este cuadro limpia OUTX y vuelca s2 sin trama (con
// transparencia), así el 3D se ve debajo. Sin cuadro 3D el canvas WebGL se esconde.
//
// API:
//   V3.listo()                           ¿hay three + WebGL y no se pidió ?plano=1?
//   V3.escena({fondo, niebla})           -> esc = {scene, camera, render(), proyectar(x,y,z) -> {x,y} lógicos del motor, encuadrar(ancho, alto, mira), sacudir(k), luces}
//   V3.toon(color, op)                   material de caricatura (3 tonos) · V3.borde(mesh, grosor) contorno de tinta (casco invertido)
//   V3.personaje(ch, colorCamisa)        -> pj = {g, mover(estado, dt, op)}  estados: quieto | corre | carga | celebra | mojado
//   V3.particulas(esc, max)              -> {soltar(x,y,z, n, op), update(dt)}  gotas, confeti, chispas (InstancedMesh)
//   V3.musica(id) / V3.callar()          música procedural (WebAudio, con el volumen de OPCIONES: minicaos-opts-v1)
//   V3.pista(id, {bpm, acordes, mel})    registra la pista de un juego (desde el archivo del juego)
//   V3.sfx(k)                            'splash' 'pop' 'tic' 'whoosh' 'latido' 'silbido' 'resbalon' 'golpe' 'choque' 'salto' 'caida' 'ding'
//                                        'moneda' 'error' 'bocina' 'motor' 'chispa' 'tambor' 'trueno' 'viento' 'silbato' 'aplauso'
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {};
if (F.V3) return;
const T = root.THREE;
if (!T) { const nada = () => {}; F.V3 = { listo: () => false, cuadro: () => false, musica: nada, pista: nada, callar: nada, sfx: nada, activo: false }; return; }
const q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
let ok = !!T && !(q && q.get('plano') === '1');
let ren = null, glc = null, pendiente = false, visto = false, ultimoCuadro = 0;

function iniciar() {
  if (ren || !ok) return !!ren;
  try {
    glc = document.createElement('canvas');
    glc.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:0;display:none';
    document.body.insertBefore(glc, document.body.firstChild);
    const c = document.getElementById('c'); if (c) { c.style.position = 'relative'; c.style.zIndex = '1'; }
    ren = new T.WebGLRenderer({ canvas: glc, antialias: true, alpha: false, powerPreference: 'high-performance' });
    ren.shadowMap.enabled = true; ren.shadowMap.type = T.PCFSoftShadowMap;
    // r128 sin gestión de color: los hex se usan tal cual (salida lineal), así se ven como en el 2D y no lavados
  } catch (e) { ok = false; ren = null; if (glc) glc.remove(); return false; }
  return true;
}
function listo() { return ok && iniciar(); }

/* el canvas WebGL sigue al lienzo del motor (tamaño y posición en la página) */
function ajustar() {
  const c = document.getElementById('c'); if (!c || !ren) return null;
  const r = c.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  glc.style.left = r.left + 'px'; glc.style.top = r.top + 'px'; glc.style.width = r.width + 'px'; glc.style.height = r.height + 'px';
  if (glc.width !== w || glc.height !== h) ren.setSize(w, h, false);
  return { w: w, h: h, cw: c.width, ch: c.height };
}

/* engine.js postSNES: ¿hubo 3D en este cuadro? Entonces OUTX se limpia y s2 va encima sin trama */
function cuadro(OUTX) {
  const hubo = pendiente; pendiente = false;
  if (glc) glc.style.display = hubo ? 'block' : 'none';
  if (hubo) ultimoCuadro = performance.now(); else if (mus && performance.now() - ultimoCuadro > 300) callar();   // se cerró el minijuego: la música se va con él
  if (hubo && OUTX) { OUTX.save(); OUTX.setTransform(1, 0, 0, 1, 0, 0); OUTX.clearRect(0, 0, OUTX.canvas.width, OUTX.canvas.height); OUTX.restore(); }
  return hubo;
}

/* ───────────── materiales ───────────── */
let grad = null;
function gradiente() {
  if (grad) return grad;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  grad = new T.DataTexture(d, 3, 1, T.RGBAFormat); grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
  return grad;
}
const MATS = {};
function toon(col, op) {
  op = op || {};
  const k = col + '|' + (op.em || '') + '|' + (op.op || 1) + '|' + (op.plano ? 1 : 0);
  if (MATS[k] && !op.nuevo) return MATS[k];
  const m = new T.MeshToonMaterial({ color: new T.Color(col), gradientMap: gradiente() });
  if (op.em) { m.emissive = new T.Color(op.em); m.emissiveIntensity = op.emI || 1; }
  if (op.op != null && op.op < 1) { m.transparent = true; m.opacity = op.op; }
  if (op.nuevo) return m;
  return MATS[k] = m;
}
const TINTA = new T.MeshBasicMaterial({ color: 0x14101c, side: T.BackSide });
function borde(mesh, g) {
  const b = new T.Mesh(mesh.geometry, TINTA); b.scale.setScalar(1 + (g || .08)); b.castShadow = false; b.userData.borde = 1;
  mesh.add(b); return mesh;
}
function malla(geo, col, op) {
  op = op || {};
  const m = new T.Mesh(geo, op.mat || toon(col, op)); m.castShadow = op.sombra !== false; m.receiveShadow = !!op.recibe;
  if (op.borde !== false) borde(m, op.g);
  return m;
}

/* ───────────── escena ───────────── */
function escena(op) {
  op = op || {};
  if (!listo()) return null;
  const scene = new T.Scene();
  if (op.fondo) scene.background = op.fondo instanceof T.Texture ? op.fondo : new T.Color(op.fondo);
  if (op.niebla) scene.fog = new T.Fog(op.niebla[0], op.niebla[1], op.niebla[2]);
  const camera = new T.PerspectiveCamera(op.fov || 34, 16 / 9, .5, 400);
  const hemi = new T.HemisphereLight(0xffffff, 0x8a7a6a, .85), sol = new T.DirectionalLight(0xffffff, .9);
  sol.position.set(-12, 26, 14); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048); const sc = sol.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
  sol.shadow.bias = -0.0006; sol.shadow.normalBias = .02;
  scene.add(hemi, sol, sol.target);
  let mira = new T.Vector3(), base = new T.Vector3(), shake = 0, enc = null, aspecto = 16 / 9;
  const v = new T.Vector3();
  const esc = {
    scene: scene, camera: camera, luces: { hemi: hemi, sol: sol },
    /* encuadre: que quepa un rectángulo de ancho x alto (mundo) centrado en `mira`, mirando con `inclinacion` rad hacia abajo */
    encuadrar: function (ancho, alto, m, incl) { enc = { w: ancho, h: alto, m: m || new T.Vector3(), i: incl || .86 }; aplicar(); },
    sacudir: function (k) { shake = Math.max(shake, k); },
    proyectar: function (x, y, z) {
      v.set(x, y, z).project(camera);
      const f = typeof gameLeft === 'function' ? gameLeft() : 0, gw = typeof GAME_VIEW === 'object' ? GAME_VIEW.width : 800;   // globales léxicos de engine.js
      return { x: f + (v.x + 1) / 2 * gw, y: (1 - v.y) / 2 * 600 };
    },
    render: function (dt) {
      const a = ajustar(); if (!a) return false;
      const asp = a.w / a.h; if (Math.abs(asp - aspecto) > 1e-3) { aspecto = asp; aplicar(); }
      shake = Math.max(0, shake - (dt || 1 / 60) * 2.6);
      const t = performance.now() / 1000;
      camera.position.copy(base).add(v.set(Math.sin(t * 61) * shake * .35, Math.cos(t * 53) * shake * .3, 0));
      camera.lookAt(mira);
      ren.render(scene, camera);
      pendiente = true; visto = true;
      if (typeof ctx !== 'undefined' && ctx && typeof gameLeft === 'function') {   // la zona del juego en el lienzo pixelado queda transparente
        ctx.save(); ctx.clearRect(gameLeft() - 2, -2, GAME_VIEW.width + 4, 604); ctx.restore();
      }
      return true;
    }
  };
  function aplicar() {
    if (!enc) return;
    camera.aspect = aspecto; camera.updateProjectionMatrix();
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspecto);
    const dW = enc.w / 2 / Math.tan(hf / 2), dH = enc.h / 2 / Math.tan(vf / 2), d = Math.max(dW, dH) * 1.02;
    mira.copy(enc.m); base.set(enc.m.x, enc.m.y + Math.sin(enc.i) * d, enc.m.z + Math.cos(enc.i) * d);
  }
  return esc;
}

/* ───────────── personajes low poly ───────────── */
// look por id (los mismos colores que fiesta-personajes.js: piel, camisa, pelo, pantalón, zapatos) + adornos 3D
const LOOK = {
  tu: { piel: '#e8b48a', pelo: 'rizos', peloC: '#2a1a14', pant: '#3a5a9a', zap: '#f4f4f4', extra: ['audifonos'] },
  mama: { piel: '#b07a58', pelo: 'mono', peloC: '#3a2418', pant: '#2a4aa8', zap: '#2a2a38', extra: ['aretes'] },
  abuela: { piel: '#f0c8a0', pelo: 'mono', peloC: '#d9d5df', pant: '#f5a0c0', zap: '#f5a0c0', extra: ['lentes', 'aretes'], baja: .92 },
  tio: { piel: '#c98a5a', pelo: 'liso', peloC: '#15110e', pant: '#2a2a34', zap: '#5a3a22', extra: ['bigote'], gordo: 1.2 },
  pana: { piel: '#d8a070', pelo: 'rizos', peloC: '#3a2418', pant: '#2a2a34', zap: '#e8553d', extra: ['gorra'], gorraC: '#ff8a3d', baja: .95 },
  prima: { piel: '#c98a68', pelo: 'rolos', peloC: '#4a2a1a', pant: '#c98a68', zap: '#ff8fc0', extra: ['panuelo', 'aretes'] },
  cobrador: { piel: '#c0845a', pelo: 'liso', peloC: '#1a1410', pant: '#2a3f8a', zap: '#6a4020', extra: ['casco'] },
  portu: { piel: '#e0a878', pelo: 'liso', peloC: '#1a1410', pant: '#3a3a44', zap: '#5a3a22', extra: ['bigote'], gordo: 1.15 }
};
const CAMISA = { tu: '#3fb0ff', mama: '#2fc4c9', abuela: '#f27fb0', tio: '#f2d23a', pana: '#8fd13f', prima: '#8a4fd0', cobrador: '#d94a3a', portu: '#e8d8a8' };
const G = {};   // geometrías compartidas (low poly: pocas caras, sombreado plano)
function geo(k, f) { return G[k] || (G[k] = f()); }
const ESF = (r, a, b) => geo('e' + r + a + b, () => new T.SphereGeometry(r, a, b));
const ICO = (r, d) => geo('i' + r + d, () => new T.IcosahedronGeometry(r, d));

function personaje(ch, camisa) {
  const L = LOOK[ch] || { piel: '#d8a070', pelo: 'liso', peloC: '#2a1a14', pant: '#3a3a44', zap: '#2a2a2a', extra: [] };
  const cam = camisa || CAMISA[ch] || '#ffd23f', gordo = L.gordo || 1, alto = L.baja || 1;
  const g = new T.Group(), cuerpo = new T.Group(); g.add(cuerpo);
  const plano = { plano: 1 };
  // piernas (pivote en la cadera)
  const pierna = (sx) => {
    const p = new T.Group(); p.position.set(sx * .2, .72, 0);
    const m = malla(geo('pierna', () => { const c = new T.CylinderGeometry(.13, .11, .58, 6); c.translate(0, -.29, 0); return c; }), L.pant);
    const z = malla(geo('zapato', () => { const c = new T.BoxGeometry(.24, .16, .36); c.translate(0, -.62, .06); return c; }), L.zap);
    p.add(m, z); cuerpo.add(p); return p;
  };
  const pI = pierna(-1), pD = pierna(1);
  // torso: un barril de 7 lados (más ancho si es gordo)
  const torso = malla(geo('torso' + gordo, () => { const c = new T.CylinderGeometry(.34 * gordo, .4 * gordo, .78, 7); c.translate(0, 1.1, 0); return c; }), cam);
  cuerpo.add(torso);
  // brazos (pivote en el hombro)
  const brazo = (sx) => {
    const b = new T.Group(); b.position.set(sx * (.42 * gordo + .04), 1.4, 0);
    const m = malla(geo('brazo', () => { const c = new T.CylinderGeometry(.1, .09, .55, 6); c.translate(0, -.27, 0); return c; }), cam);
    const mano = malla(ESF(.12, 6, 4), L.piel); mano.position.y = -.6;
    b.add(m, mano); cuerpo.add(b); return b;
  };
  const bI = brazo(-1), bD = brazo(1);
  // cabeza grande (chibi): icosaedro facetado
  const cab = new T.Group(); cab.position.y = 1.95; cuerpo.add(cab);
  const craneo = malla(ICO(.55, 1), L.piel, plano); craneo.scale.set(1, .95, .95); cab.add(craneo);
  const negro = toon('#14101c'), blanco = toon('#fffdf2');
  const ojo = (sx) => {
    const o = new T.Mesh(ESF(.1, 8, 6), blanco); o.position.set(sx * .2, .04, .47); o.scale.set(1, 1.25, .5);
    const n = new T.Mesh(ESF(.06, 6, 5), negro); n.position.set(0, -.01, .07); o.add(n); cab.add(o); return o;
  };
  const oI = ojo(-1), oD = ojo(1);
  const boca = new T.Mesh(geo('boca', () => new T.BoxGeometry(.2, .05, .05)), toon('#7a2430')); boca.position.set(0, -.22, .5); cab.add(boca);
  const nariz = new T.Mesh(ICO(.07, 0), toon(L.piel)); nariz.position.set(0, -.07, .54); cab.add(nariz);
  for (const sx of [-1, 1]) { const ca = new T.Mesh(ESF(.08, 6, 4), toon('#ff8fa0', { op: .7 })); ca.position.set(sx * .32, -.14, .43); ca.scale.set(1, .6, .4); cab.add(ca); }
  // pelo
  const peloM = toon(L.peloC);
  if (L.pelo === 'rizos') {
    for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, r = .5; const m = malla(ICO(.2, 0), L.peloC); m.position.set(Math.cos(a) * r * .8, .38 + Math.sin(i * 2.3) * .05, Math.sin(a) * r * .7 - .08); cab.add(m); }
    const top = malla(ICO(.36, 0), L.peloC); top.position.set(0, .48, -.05); cab.add(top);
  } else if (L.pelo === 'mono') {
    const casq = malla(geo('casq', () => new T.SphereGeometry(.58, 8, 5, 0, Math.PI * 2, 0, Math.PI * .5)), L.peloC); casq.position.y = .02; casq.rotation.x = -.25; cab.add(casq);
    const mo = malla(ICO(.24, 0), L.peloC); mo.position.set(0, .5, -.38); cab.add(mo);
  } else if (L.pelo === 'rolos') {
    const casq = malla(geo('casq', () => new T.SphereGeometry(.58, 8, 5, 0, Math.PI * 2, 0, Math.PI * .5)), L.peloC); casq.rotation.x = -.2; cab.add(casq);
    for (let i = 0; i < 4; i++) { const r = malla(geo('rolo', () => new T.CylinderGeometry(.09, .09, .32, 6)), ['#ff8fc0', '#8fd8ff', '#ffe14d', '#b49cff'][i]); r.rotation.z = Math.PI / 2; r.position.set(-.24 + i * .16, .5, .05 - (i % 2) * .2); cab.add(r); }
  } else {
    const casq = malla(geo('casqL', () => new T.SphereGeometry(.585, 8, 5, 0, Math.PI * 2, 0, Math.PI * .42)), L.peloC); casq.rotation.x = -.35; cab.add(casq);
  }
  for (const x of L.extra) {
    if (x === 'audifonos') {
      const arco = malla(geo('arco', () => new T.TorusGeometry(.6, .05, 4, 12, Math.PI)), '#2a2a34'); arco.position.y = .05; cab.add(arco);
      for (const sx of [-1, 1]) { const cp = malla(geo('copa', () => new T.CylinderGeometry(.16, .16, .12, 8)), '#ffd23f'); cp.rotation.z = Math.PI / 2; cp.position.set(sx * .58, .02, 0); cab.add(cp); }
    } else if (x === 'gorra' || x === 'casco') {
      const col = x === 'gorra' ? L.gorraC : '#3a7fd0';
      const c = malla(geo('gorra', () => new T.SphereGeometry(.6, 8, 4, 0, Math.PI * 2, 0, Math.PI * .45)), col); c.position.y = .06; cab.add(c);
      const v = malla(geo('visera', () => new T.BoxGeometry(.5, .05, .32)), col); v.position.set(0, .2, x === 'gorra' ? -.62 : .62); cab.add(v);
    } else if (x === 'lentes') {
      for (const sx of [-1, 1]) { const l = new T.Mesh(geo('lente', () => new T.TorusGeometry(.13, .025, 4, 10)), negro); l.position.set(sx * .2, .05, .55); cab.add(l); }
    } else if (x === 'bigote') {
      const b = malla(geo('bigote', () => new T.BoxGeometry(.34, .08, .08)), L.peloC === '#d9d5df' ? '#d9d5df' : '#1a1410'); b.position.set(0, -.15, .53); cab.add(b);
    } else if (x === 'aretes') {
      for (const sx of [-1, 1]) { const a = new T.Mesh(geo('arete', () => new T.TorusGeometry(.06, .02, 4, 8)), toon('#ffd23f')); a.position.set(sx * .56, -.2, .05); a.rotation.y = Math.PI / 2; cab.add(a); }
    } else if (x === 'panuelo') {
      const p = malla(geo('panuelo', () => new T.TorusGeometry(.5, .07, 4, 12)), '#ff6fa8'); p.rotation.x = Math.PI / 2 - .3; p.position.y = .3; cab.add(p);
    }
  }
  cuerpo.scale.setScalar(alto);
  g.traverse((o) => { if (o.isMesh && !o.userData.borde) o.castShadow = true; });

  // animación: todo es función de (estado, fase); fase avanza con la velocidad
  let fase = Math.random() * 6, parp = 2 + Math.random() * 3, mojo = 0, tCel = 0, rumbo = 0;
  const pj = {
    g: g, cab: cab, manos: [bI, bD],
    /* estado: quieto | corre | carga | celebra | mojado ; op = {vel (0..1), rumbo (rad, hacia donde mira), tiembla} */
    mover: function (estado, dt, op) {
      op = op || {};
      const vel = op.vel || 0, t = performance.now() / 1000;
      fase += dt * (4 + 9 * vel);
      if (op.rumbo != null) { let d = op.rumbo - rumbo; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; rumbo += d * Math.min(1, dt * 12); }
      g.rotation.y = rumbo;
      const sw = Math.sin(fase) * Math.min(1, vel * 1.4), bote = Math.abs(Math.sin(fase)) * .12 * Math.min(1, vel * 1.5);
      pI.rotation.x = sw * .9; pD.rotation.x = -sw * .9;
      cuerpo.position.y = bote; cuerpo.rotation.x = vel * .18; cuerpo.rotation.z = 0;
      let aI = -sw * .8, aD = sw * .8, zI = .12, zD = -.12;
      if (estado === 'carga') { aI = aD = -2.9 + Math.sin(t * 9) * .06; zI = .35; zD = -.35; }
      else if (estado === 'celebra') { tCel += dt; aI = aD = -2.7 + Math.sin(t * 14) * .3; zI = .6; zD = -.6; cuerpo.position.y = Math.abs(Math.sin(t * 7)) * .5; }
      else if (estado === 'mojado') { aI = aD = .15; zI = .25; zD = -.25; cuerpo.rotation.x = .25; cuerpo.position.y = 0; pI.rotation.x = pD.rotation.x = 0; }
      if (op.tiembla) { cuerpo.rotation.z = Math.sin(t * 60) * .06; }
      bI.rotation.x += (aI - bI.rotation.x) * Math.min(1, dt * 14); bD.rotation.x += (aD - bD.rotation.x) * Math.min(1, dt * 14);
      bI.rotation.z += (zI - bI.rotation.z) * Math.min(1, dt * 14); bD.rotation.z += (zD - bD.rotation.z) * Math.min(1, dt * 14);
      cab.rotation.x = estado === 'mojado' ? .35 : estado === 'carga' ? -.25 : 0;
      cab.rotation.z = estado === 'quieto' ? Math.sin(t * 1.6) * .05 : 0;
      // ojos: parpadeo; susto (grandes) con la bombita; mojado (cerrados a medias)
      parp -= dt; const cierra = parp < .1; if (parp < 0) parp = 2 + Math.random() * 3;
      const oy = estado === 'mojado' ? .35 : cierra ? .12 : op.tiembla ? 1.5 : 1.25;
      oI.scale.y = oD.scale.y = oy;
      boca.scale.set(estado === 'celebra' || op.tiembla ? 1.3 : 1, estado === 'celebra' ? 3.5 : op.tiembla ? 3 : 1, 1);
      // mojado: la ropa se oscurece un poco (un solo material por pj: la camisa)
      const m = estado === 'mojado' ? 1 : 0; if (m !== mojo) { mojo = m; torso.material = toon(m ? oscurecer(cam, .65) : cam); }
    }
  };
  return pj;
}
function oscurecer(c, k) { const o = new T.Color(c); o.multiplyScalar(k); return '#' + o.getHexString(); }

/* ───────────── partículas (InstancedMesh) ───────────── */
function particulas(esc, max) {
  max = max || 400;
  const geos = { gota: ICO(.15, 0), confeti: geo('conf', () => new T.PlaneGeometry(.2, .13)), chispa: geo('chis', () => new T.OctahedronGeometry(.13, 0)) };
  const sis = {};
  for (const k in geos) {
    const m = new T.InstancedMesh(geos[k], new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: k === 'gota', opacity: k === 'gota' ? .9 : 1 }), max);
    m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false;
    m.setColorAt(0, new T.Color()); m.count = 0; esc.scene.add(m);   // el búfer de color se crea con el count de ese momento: antes de bajarlo a 0
    sis[k] = { m: m, l: [] };
  }
  const o = new T.Object3D(), col = new T.Color();
  return {
    /* op = {k:'gota'|'confeti'|'chispa', cols:[...], vel, arriba, g, vida, esc} */
    soltar: function (x, y, z, n, op) {
      op = op || {}; const s = sis[op.k || 'gota'], cols = op.cols || ['#3fa9ff'];
      for (let i = 0; i < n && s.l.length < max; i++) {
        const a = Math.random() * Math.PI * 2, v = (op.vel || 5) * (.35 + Math.random() * .65);
        s.l.push({ x: x, y: y, z: z, vx: Math.cos(a) * v, vy: (op.arriba || 4) * (.5 + Math.random()), vz: Math.sin(a) * v, g: op.g == null ? 14 : op.g,
          t: 0, vida: (op.vida || 1) * (.6 + Math.random() * .6), r: Math.random() * 6, vr: (Math.random() - .5) * 12, s: (op.esc || 1) * (.6 + Math.random() * .8), c: cols[i % cols.length], suelo: op.suelo !== false });
      }
    },
    update: function (dt) {
      for (const k in sis) {
        const s = sis[k], l = s.l;
        for (let i = l.length - 1; i >= 0; i--) {
          const p = l[i]; p.t += dt;
          if (p.t > p.vida) { l.splice(i, 1); continue; }
          p.vy -= p.g * dt; if (k === 'confeti') { p.vx *= .985; p.vz *= .985; p.vy = Math.max(p.vy, -2.2); }
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += p.vr * dt;
          if (p.suelo && p.y < .03) { p.y = .03; p.vy = 0; p.vx *= .8; p.vz *= .8; }
        }
        for (let i = 0; i < l.length; i++) {
          const p = l[i], f = 1 - Math.max(0, (p.t - p.vida * .7) / (p.vida * .3));
          o.position.set(p.x, p.y, p.z); o.rotation.set(p.r, p.r * .7, p.r * .3); o.scale.setScalar(p.s * f); o.updateMatrix();
          s.m.setMatrixAt(i, o.matrix); s.m.setColorAt(i, col.set(p.c));
        }
        s.m.count = l.length; s.m.instanceMatrix.needsUpdate = true; if (s.m.instanceColor) s.m.instanceColor.needsUpdate = true;
      }
    }
  };
}

/* ───────────── audio ───────────── */
function volumen() { try { const o = JSON.parse(localStorage.getItem('minicaos-opts-v1')); return o || {}; } catch (e) { return {}; } }
function ac() { try { return typeof A === 'function' ? A() : (F.V3._ac || (F.V3._ac = new (root.AudioContext || root.webkitAudioContext)())); } catch (e) { return null; } }
let ruidoB = null;
function ruido(a) {
  if (ruidoB) return ruidoB;
  ruidoB = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = ruidoB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return ruidoB;
}
function sfx(k) {
  const a = ac(); if (!a) return; const vs = volumen().sfx; const V = vs >= 0 && vs <= 1 ? vs : 1; if (!V) return;
  const t = a.currentTime, out = a.createGain(); out.gain.value = V; out.connect(a.destination);
  const golpe = (f0, f1, dur, vol, tipo, q2) => {
    const s = a.createBufferSource(); s.buffer = ruido(a); const fl = a.createBiquadFilter(); fl.type = tipo || 'bandpass'; fl.Q.value = q2 || 1.2;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gg = a.createGain(); gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(fl).connect(gg).connect(out); s.start(t); s.stop(t + dur + .02);
  };
  const tono = (f0, f1, dur, vol, tipo) => {
    const o = a.createOscillator(), gg = a.createGain(); o.type = tipo || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(gg).connect(out); o.start(t); o.stop(t + dur + .02);
  };
  if (k === 'splash') { tono(500, 90, .12, .35, 'sine'); golpe(3000, 300, .55, .5, 'bandpass', .8); golpe(900, 200, .35, .35, 'lowpass', 1); }
  else if (k === 'pop') { tono(700, 1300, .09, .18, 'triangle'); golpe(2500, 1500, .06, .15); }
  else if (k === 'tic') { tono(1600, 1500, .04, .12, 'square'); }
  else if (k === 'whoosh') { golpe(500, 2400, .22, .18, 'bandpass', 2); }
  else if (k === 'latido') { tono(90, 50, .14, .5, 'sine'); }
  else if (k === 'silbido') { tono(1500, 520, .7, .06, 'sine'); }                                  // algo que cae
  else if (k === 'resbalon') { tono(900, 1700, .1, .08, 'triangle'); golpe(1800, 900, .14, .12, 'bandpass', 3); }
  else if (k === 'golpe') { tono(160, 60, .16, .45, 'sine'); golpe(1200, 200, .12, .3, 'lowpass', 1); }   // golpe seco / caer al piso
  else if (k === 'choque') { tono(120, 50, .2, .5, 'square'); golpe(2500, 300, .3, .45, 'bandpass', .7); }  // choque fuerte (carros, cuerpos)
  else if (k === 'salto') { tono(300, 700, .16, .14, 'triangle'); }
  else if (k === 'caida') { tono(700, 160, .45, .12, 'triangle'); }
  else if (k === 'ding') { tono(1320, 1310, .35, .14, 'sine'); tono(1980, 1970, .25, .06, 'sine'); }      // acierto / punto
  else if (k === 'moneda') { tono(990, 990, .07, .12, 'square'); setTimeout(function () { sfx2(a, out, 1320); }, 70); }
  else if (k === 'error') { tono(180, 150, .3, .16, 'square'); }
  else if (k === 'bocina') { tono(420, 410, .35, .14, 'sawtooth'); tono(530, 520, .35, .1, 'sawtooth'); }
  else if (k === 'motor') { tono(70, 140, .5, .22, 'sawtooth'); golpe(400, 900, .5, .12, 'lowpass', 2); }
  else if (k === 'chispa') { golpe(6000, 3000, .25, .2, 'highpass', 1); }                                  // chisporroteo, aceite, electricidad
  else if (k === 'tambor') { tono(110, 55, .25, .5, 'sine'); golpe(800, 300, .08, .2, 'bandpass', 1); }
  else if (k === 'trueno') { golpe(300, 60, 1.2, .5, 'lowpass', .7); }
  else if (k === 'viento') { golpe(400, 1200, .9, .12, 'bandpass', 4); }
  else if (k === 'silbato') { tono(2400, 2350, .3, .1, 'square'); }
  else if (k === 'aplauso') { for (let i = 0; i < 6; i++) setTimeout(function () { const t2 = a.currentTime, s = a.createBufferSource(); s.buffer = ruido(a); const gg = a.createGain(); gg.gain.setValueAtTime(.12, t2); gg.gain.exponentialRampToValueAtTime(.001, t2 + .06); s.connect(gg).connect(out); s.start(t2); s.stop(t2 + .08); }, i * 70 + Math.random() * 40); }
}
function sfx2(a, out, f) { const t = a.currentTime, o = a.createOscillator(), gg = a.createGain(); o.type = 'square'; o.frequency.value = f; gg.gain.setValueAtTime(.12, t); gg.gain.exponentialRampToValueAtTime(.001, t + .15); o.connect(gg).connect(out); o.start(t); o.stop(t + .17); }

/* música: secuenciador pequeño (bajo + cuatro rasgueado + tambora + charrasca + melodía) por pistas en `PISTAS` */
const PISTAS = {
  // carnaval: calipso de El Callao / merengue rápido; I–IV–V–I en Re
  carnaval: { bpm: 132, acordes: [[50, 54, 57], [55, 59, 62], [57, 61, 64], [50, 54, 57]],
    mel: [74, 0, 76, 78, 0, 76, 74, 0, 71, 0, 74, 76, 0, 74, 71, 69, 71, 0, 74, 0, 76, 74, 71, 0, 73, 0, 76, 0, 74, 0, 0, 0] },
  // balcon (f_patilla): comparsa más rápida y pícara; I–vi–IV–V en Sol
  balcon: { bpm: 146, acordes: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]],
    mel: [79, 0, 79, 81, 83, 0, 81, 79, 76, 0, 76, 79, 0, 76, 74, 0, 72, 0, 76, 79, 0, 81, 79, 76, 74, 0, 78, 0, 81, 0, 0, 0] }
};
/* cada juego registra su pista desde su propio archivo: V3.pista('cola', {bpm, acordes:[[midi…]×4], mel:[midi|0 ×32]}) */
function pista(id, def) { if (id && def && def.bpm && def.acordes && def.mel && !PISTAS[id]) PISTAS[id] = def; }
let mus = null;
function musica(id) {
  const P = PISTAS[id]; const a = ac(); if (!P || !a) return;
  if (mus && mus.id === id) return; callar();
  const vm = volumen().music, V = (vm >= 0 && vm <= 1 ? vm : .8) * .5; if (!V) return;
  const out = a.createGain(); out.gain.value = V; out.connect(a.destination);
  const paso = 60 / P.bpm / 4; let n = 0, prox = a.currentTime + .08;
  const nota = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const osc = (f, t, dur, vol, tipo, ataque) => {
    const o = a.createOscillator(), g = a.createGain(); o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + (ataque || .005)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .02);
  };
  const perc = (t, f, dur, vol, tipo) => {
    const s = a.createBufferSource(); s.buffer = ruido(a); const fl = a.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f;
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl).connect(g).connect(out); s.start(t); s.stop(t + dur + .02);
  };
  const tick = () => {
    while (prox < a.currentTime + .25) {
      const s = n % 16, comp = Math.floor(n / 16) % P.acordes.length, ac2 = P.acordes[comp], t = prox;
      if (s % 4 === 0) { osc(55 * Math.pow(2, (ac2[0] - 33) / 12) / 2, t, .22, .5, 'sine'); }                         // tambora: golpe grave
      if (s === 6 || s === 14) osc(nota(ac2[0] - 12), t, .16, .35, 'triangle');                                       // bajo a contratiempo
      if (s === 10) osc(nota(ac2[2] - 12), t, .14, .3, 'triangle');
      perc(t, 7000, s % 2 ? .03 : .05, s % 4 === 2 ? .12 : .06, 'highpass');                                        // charrasca
      if (s === 4 || s === 12) perc(t, 1800, .09, .18, 'bandpass');                                                  // palmada
      if (s === 2 || s === 5 || s === 8 || s === 11 || s === 14) for (let k = 0; k < 3; k++) osc(nota(ac2[k]), t + k * .012, .18, .07, 'square', .004);   // cuatro rasgueado
      const m = P.mel[n % P.mel.length]; if (m && Math.floor(n / P.mel.length) % 2 === 0 || m && s % 2 === 0) osc(nota(m), t, paso * 1.8, .09, 'triangle', .01);
      n++; prox += paso;
    }
  };
  tick();
  mus = { id: id, out: out, iv: setInterval(tick, 60) };
}
function callar() {
  if (!mus) return; const a = ac(); clearInterval(mus.iv);
  try { mus.out.gain.setTargetAtTime(0, a.currentTime, .15); const o = mus.out; setTimeout(() => o.disconnect(), 800); } catch (e) {}
  mus = null;
}

/* ───────────── utilidades de escena ───────────── */
function texturaCanvas(w, h, pinta, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; pinta(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function cielo(arriba, abajo) {
  return texturaCanvas(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, arriba); g.addColorStop(1, abajo); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}

F.V3 = { listo: listo, escena: escena, cuadro: cuadro, toon: toon, borde: borde, malla: malla, personaje: personaje, particulas: particulas,
  musica: musica, pista: pista, callar: callar, sfx: sfx, texturaCanvas: texturaCanvas, cielo: cielo, oscurecer: oscurecer, LOOK: LOOK, CAMISA: CAMISA,
  get activo() { return visto; } };
})(typeof window !== 'undefined' ? window : this);
