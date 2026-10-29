// LA FIESTA · movimiento secundario de los personajes 3D: pelo, ropa, accesorios y cuerpo blando (se engancha en V3.PJ.EXT, no toca fiesta-3d-pj.js).
//
// AUDITORÍA (lo que se sentía rígido o muerto, antes de este archivo):
//   · el pelo, la cola, los aretes y el objeto de la mano eran UN bloque que colgaba de un resorte: se mecían como una puerta, sin doblarse en ola;
//   · las camisas, franelas, el delantal del Portu, la falda de la Prima y la capucha de TÚ eran duras: al correr o saltar no ondeaban ni se inflaban;
//   · la cadena del Tío y del Cobrador, la riñonera y las solapas de la Abuela estaban pegadas al torso; el pañuelo de la Prima era una pelota fija;
//   · la panza (Tío, Portu) y los cachetes no rebotaban al caer ni al correr; los rizos de TÚ y del Pana se movían todos juntos, nunca cada uno por su lado;
//   · el pelo liso (Tío, Portu) no tenía ni un solo mechón vivo; la taza, el teléfono, el tambor y las consolas no tenían nada que colgara (cordones, llaveros).
//
// QUÉ HACE: una simulación verlet ligera (puntos con inercia + restricciones de distancia + colisión) en coordenadas del MUNDO, así que el movimiento del
// cuerpo (velocidad, aceleración, giro de cabeza y torso, vuelo y ragdoll) le llega solo, sin depender de poses. Cada pieza tiene una "memoria de forma"
// blanda hacia su posición de reposo (si el personaje queda quieto, todo se calma exactamente donde estaba) y colisiona con cabeza, torso, brazos y piernas.
//   · cadenas de 3-5 eslabones (coleta de Mamá y Abuela, mechón rebelde, aretes, dije de la cadena, cordones de la taza/teléfono/tambor/consola, cintas del pañuelo);
//   · telas de malla pequeña (vértices que se actualizan sin asignar memoria): ruedo de la camisa/franela, falda de la Prima, delantal del Portu, capucha de TÚ;
//   · rizos, rolos, flequillo, riñonera y solapas: cada pieza rebota por su cuenta encima de lo que ya tenían (siguen siendo las mismas mallas);
//   · cuerpo blando: panza (squash/stretch con la aceleración vertical) y cachetes con retraso.
//
// API NUEVA
//   V3.PJ.viento = { x, z, fuerza }       viento global (dirección en el plano XZ, fuerza en unidades/s; 0 = sin viento). Se puede cambiar en cualquier momento.
//   pj.ropa.reset()                       recoloca todo en reposo (después de teletransportar al personaje; igual se detectan saltos grandes solos)
//   pj.ropa.suelto = 1                    multiplicador de cuánto se mueve el pelo/ropa (0 = rígido como antes, 1 = normal, 2 = exagerado)
//   pj.ropa.penetracion(mascara)          peor penetración (unidades) de alguna pieza dentro de cabeza(1)/torso(2)/brazos(4)/piernas(8); sin máscara = todos (para pruebas)
(function (root) {
'use strict';
const V3 = root.FIESTA && root.FIESTA.V3; if (!V3 || !V3.PJ) return;
const T = root.THREE;
if (!V3.PJ.viento) V3.PJ.viento = { x: 0, z: 0, fuerza: 0 };

const SEG_GEO = new T.SphereGeometry(1, 7, 5);                  // eslabón: elipsoide unitario que se estira entre dos puntos
const CORD_GEO = new T.CylinderGeometry(1, 1, 1, 4);            // cordón fino
const geoEsf = {}; const esf = (r) => geoEsf[r] || (geoEsf[r] = new T.SphereGeometry(r, 8, 6));
const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _Y = new T.Vector3(0, 1, 0), _q = new T.Quaternion();
const TINTA_T = new T.MeshBasicMaterial({ color: 0x14101c, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 });

V3.PJ.EXT.push(function (pj, ctx) {
  const g = ctx.g, J = ctx.J, rig = ctx.rig, tor = ctx.tor, cab = ctx.cab, C = ctx.C, L = ctx.L, cl = ctx.cl;
  const W = C.ancho, P = C.panza, rT = .3 * W, SZ0 = .82 + P * .12, TOR = .66, RC = .5, HOM = .3, ANTE = .27, PIER = .31;
  const R = L.ropa || {}, ad = {}; for (const a of (L.adornos || [])) ad[a] = 1;
  const PC = L.peloC, camisa = L.camisa;
  const ropaG = new T.Group(); ropaG.name = 'ropa'; rig.add(ropaG);                     // aquí cuelgan las mallas nuevas (en el marco del rig)

  /* ───────────── buscar lo que ya existe (fiesta-3d-pj.js no les pone nombre; se reconocen por forma y lugar) ───────────── */
  const hijosG = (o) => o.children.filter((c) => c.isGroup);
  let pelG = null, colaG = null; const aretesP = [];
  for (const c of hijosG(cab)) {
    if (Math.abs(c.position.y - .38) < .01 && Math.abs(c.position.z + .3) < .01) colaG = c;
    else if (Math.abs(Math.abs(c.position.x) - RC) < .01 && Math.abs(c.position.y + .1) < .01) aretesP.push(c);
    else if (c.position.lengthSq() < 1e-6 && c.children.length && c.children.every((m) => m.isMesh && m.children.some((k) => k.userData.borde))) pelG = c;
  }
  const hijoMesh = (o, f) => o.children.find((m) => m.isMesh && m.geometry && f(m.geometry.parameters || {}, m.geometry, m));
  const torso = hijoMesh(tor, (pa, ge) => ge.type === 'LatheGeometry');
  const ocultar = (m) => { if (m) m.visible = false; return m; };

  /* ───────────── sistema de puntos ───────────── */
  const PPs = [], CON = [], REN = [], PARS = [rig], PARI = [new T.Matrix4()];
  const padre = (o) => { let i = PARS.indexOf(o); if (i < 0) { PARS.push(o); PARI.push(new T.Matrix4()); i = PARS.length - 1; } return i; };
  // un punto: f = marco donde está su posición de reposo (x,y,z) · pin: clavado al marco · k: memoria de forma · dr: rozamiento del aire · gs: gravedad ·
  // rad: grosor para colisionar (-1 = no colisiona) · cm: colisionadores (1 cabeza, 2 torso, 4 brazos, 8 piernas) · infl: se infla hacia afuera al correr
  const pt = (f, x, y, z, o) => { PPs.push(Object.assign({ f: f, x: x, y: y, z: z, pin: 0, k: .05, dr: 3, gs: 1, rad: .03, cm: 15, infl: 0, gu: 1 }, o)); return PPs.length - 1; };
  const lig = (i, j, k, l) => { const a = PPs[i], b = PPs[j]; CON.push({ i: i, j: j, k: k == null ? 1 : k, l: l != null ? l : Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }); };
  const matCache = {}; const mat = (col) => matCache[col] || (matCache[col] = V3.toon(col));

  // cadena: pts = [[x,y,z,radio],...], el primero va clavado; los eslabones son elipsoides entre puntos consecutivos (o cintas planas si plano)
  function cadena(f, pts, col, o) {
    o = o || {}; const idx = [];
    pts.forEach((q, i) => idx.push(pt(f, q[0], q[1], q[2], Object.assign({ pin: i === 0 ? 1 : 0, k: (o.k == null ? .06 : o.k) * (1 - i / pts.length * .5), dr: o.dr || 3.2, gs: o.gs == null ? 1 : o.gs, rad: o.rad == null ? Math.max(.02, q[3] * .8) : o.rad, cm: o.cm || 15 }, o.pt || {}))));
    for (let i = 1; i < idx.length; i++) lig(idx[i - 1], idx[i]);
    for (let i = 2; i < idx.length; i++) lig(idx[i - 2], idx[i], o.dob == null ? .12 : o.dob);   // resistencia a doblarse (el pelo no se pliega en V)
    for (let i = 1; i < idx.length; i++) {
      const m = V3.malla(SEG_GEO, col, { g: .07 }); m.castShadow = false; ropaG.add(m);
      REN.push({ t: 'seg', a: idx[i - 1], b: idx[i], m: m, r: pts[i][3], ext: o.ext || 1.28, plano: o.plano || 0, vis: o.vis });
    }
    return idx;
  }
  // cordón con una pieza al final (llavero, dije, borla)
  function colgante(f, pts, colCuerda, remate, o) {
    o = o || {}; const idx = [];
    pts.forEach((q, i) => idx.push(pt(f, q[0], q[1], q[2], Object.assign({ pin: i === 0 ? 1 : 0, k: o.k == null ? .035 : o.k, dr: 2.6, rad: i ? .035 : -1 }, o.pt || {}))));
    for (let i = 1; i < idx.length; i++) lig(idx[i - 1], idx[i]);
    for (let i = 1; i < idx.length; i++) { const m = new T.Mesh(CORD_GEO, mat(colCuerda)); ropaG.add(m); REN.push({ t: 'cord', a: idx[i - 1], b: idx[i], m: m, r: .012, vis: o.vis }); }
    const rm = V3.malla(remate.g, remate.col, { g: .08 }); rm.castShadow = false; if (remate.rx) rm.rotation.x = remate.rx; ropaG.add(rm);
    REN.push({ t: 'blob', a: idx[idx.length - 1], m: rm, vis: o.vis, rem: 1 });
    return idx;
  }
  // tela: filas x columnas de puntos (rejilla [fila][col] = [x,y,z]); las filas clavadas siguen al marco; vuelta = la última columna se une a la primera (anillo)
  function tela(f, grid, pinRows, vuelta, matl, o) {
    o = o || {}; const nf = grid.length, nc = grid[0].length, idx = [];
    for (let r = 0; r < nf; r++) { idx.push([]); for (let c = 0; c < nc; c++) { const q = grid[r][c];
      idx[r].push(pt(f, q[0], q[1], q[2], { pin: r < pinRows ? 1 : 0, k: (o.k == null ? .09 : o.k) * (r === pinRows ? 1.6 : 1), dr: o.dr || 2.6, gs: o.gs == null ? .8 : o.gs, rad: o.rad == null ? .035 : o.rad, cm: o.cm == null ? 8 : o.cm, infl: o.infl || 0 })); } }
    const cc = (c) => vuelta ? c % nc : c;
    for (let r = 0; r < nf; r++) for (let c = 0; c < (vuelta ? nc : nc - 1); c++) { if (r >= pinRows) lig(idx[r][c], idx[r][cc(c + 1)], .9); }
    for (let r = 0; r < nf - 1; r++) for (let c = 0; c < nc; c++) {
      lig(idx[r][c], idx[r + 1][c], 1);
      if (c < nc - 1 || vuelta) { lig(idx[r][c], idx[r + 1][cc(c + 1)], .35); lig(idx[r][cc(c + 1)], idx[r + 1][c], .35); }
    }
    for (let r = 2; r < nf; r++) for (let c = 0; c < nc; c++) lig(idx[r - 2][c], idx[r][c], .08);
    const n = nf * nc, pos = new Float32Array(n * 3), pos2 = new Float32Array(n * 3), tri = [];
    for (let r = 0; r < nf - 1; r++) for (let c = 0; c < (vuelta ? nc : nc - 1); c++) {
      const a = r * nc + c, b = r * nc + cc(c + 1), d = (r + 1) * nc + c, e = (r + 1) * nc + cc(c + 1); tri.push(a, d, b, b, d, e);
    }
    const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(pos, 3)); ge.setAttribute('normal', new T.BufferAttribute(new Float32Array(n * 3), 3)); ge.setIndex(tri);
    const go = new T.BufferGeometry(); go.setAttribute('position', new T.BufferAttribute(pos2, 3)); go.setIndex(tri);
    const m = new T.Mesh(ge, matl); m.frustumCulled = false; ropaG.add(m);
    const mo = new T.Mesh(go, TINTA_T); mo.frustumCulled = false; ropaG.add(mo);
    const ids = []; for (let r = 0; r < nf; r++) for (let c = 0; c < nc; c++) ids.push(idx[r][c]);
    REN.push({ t: 'tela', ids: ids, n: n, ge: ge, go: go, pos: pos, pos2: pos2, m: m, mo: mo, vis: o.vis });
    return idx;
  }
  // pieza existente que rebota por su cuenta (sus posiciones quedan en su propio marco): rizos, rolos, flequillo, riñonera…
  function rebote(m, marco, o) {
    o = o || {}; const f = marco; const i = pt(f, m.position.x, m.position.y, m.position.z, Object.assign({ k: .2, dr: 5, gs: .35, rad: -1 }, o));
    REN.push({ t: 'jig', a: i, m: m, par: padre(f), bx: m.position.x, by: m.position.y, bz: m.position.z }); return i;
  }

  // perfil del torso (radio por altura): lo usan el delantal, la capucha, el ruedo y la colisión
  const PY = [-.04, .2, .36, .52, TOR, TOR + .03], PR = [rT * .95, rT * (1 + P * .28), rT * (1.02 + P * .2), rT * .96, rT * .7, .08];
  const rTor = (y) => { if (y <= PY[0]) return PR[0]; for (let k = 0; k < 5; k++) if (y <= PY[k + 1]) return PR[k] + (PR[k + 1] - PR[k]) * (y - PY[k]) / (PY[k + 1] - PY[k]); return PR[5]; };

  /* ───────────── construcción según los datos del personaje ───────────── */
  const sinPelo = !!(ad.gorra || ad.casco);
  // 1) pelo: rizos / rolos / flequillo rebotan cada uno por su lado
  if (pelG) for (const m of pelG.children) rebote(m, pelG, { k: L.pelo === 'rolos' ? .26 : .17, dr: L.pelo === 'rizos' ? 4.2 : 5, gs: L.pelo === 'raya' || L.pelo === 'liso' ? .6 : .4 });
  // 2) coleta (Mamá, Abuela): sale por detrás del moño y cuelga
  if (colaG && L.pelo === 'mono') {
    const larga = L.peloC !== '#d9d5df';
    cadena(colaG, larga ? [[0, -.02, -.12, .15], [0, -.14, -.18, .13], [0, -.28, -.22, .1], [0, -.42, -.24, .075], [0, -.54, -.25, .05]]
      : [[0, -.02, -.12, .1], [0, -.12, -.17, .08], [0, -.22, -.19, .05]], PC, { k: .05, dr: 3.4, dob: .2 });
  }
  // 3) mechón rebelde (pelo liso o de raya, sin gorra ni casco)
  if (!sinPelo && (L.pelo === 'liso' || L.pelo === 'raya')) {
    cadena(cab, [[.12, .5, .1, .06], [.15, .6, .1, .05], [.19, .67, .09, .042], [.25, .72, .08, .03]], PC, { k: .1, dr: 3, gs: 1.1, rad: .02, dob: .2, ext: 1.4 });
  }
  // 4) aretes: dos eslabones que cuelgan de cada oreja (aro + cuenta)
  for (const pv of aretesP) {
    pv.children.forEach(ocultar);
    const idx = [pt(pv, 0, 0, 0, { pin: 1 }), pt(pv, 0, -.065, 0, { k: .02, dr: 2.6, rad: .03 }), pt(pv, 0, -.125, 0, { k: .02, dr: 2.6, rad: .025 })];
    lig(idx[0], idx[1]); lig(idx[1], idx[2]);
    const aro = V3.malla(new T.TorusGeometry(.055, .016, 4, 10), '#ffd23f', { g: .1 }); aro.castShadow = false; aro.rotation.y = Math.PI / 2; ropaG.add(aro);
    const cu = V3.malla(esf(.032), '#ffd23f', { g: .1 }); cu.castShadow = false; ropaG.add(cu);
    REN.push({ t: 'blob', a: idx[1], m: aro, rem: 0, rot: 1 }); REN.push({ t: 'blob', a: idx[2], m: cu, rem: 0 });
  }
  // 5) pañuelo de la Prima: dos cintas de tela que salen del nudo
  if (ad.panuelo) {
    for (const [sx, rz] of [[-1, 0], [1, 0]]) cadena(cab, [[sx * .05, .43, -.38, .06], [sx * .12, .38, -.46, .06], [sx * .2, .3, -.5, .055], [sx * .26, .2, -.52, .05]], '#ff6fa8', { k: .06, dr: 3.8, gs: .9, plano: 1, rad: .025, dob: .1, ext: 1.2 });
  }
  // 6) cadena con dije: el dije cuelga y se balancea sobre el pecho
  if (ad.cadena) {
    const d2 = hijoMesh(tor, (pa) => pa.radiusTop === .035 && pa.height === .015); const r0 = Math.max(.17, rT * .78 + .04); ocultar(d2);
    const yy = TOR - .05 - Math.sin(.55) * r0, zz = Math.cos(.55) * r0 * (SZ0 + .06) + .03;
    colgante(tor, [[0, yy, zz], [0, yy - .05, zz + .01], [0, yy - .1, zz + .015]], '#e0c050', { g: new T.CylinderGeometry(.04, .04, .018, 10), col: '#e0c050', rx: Math.PI / 2 }, { k: .03, pt: { rad: .04 } });
  }
  // 7) cordones de TÚ (los de la capucha): cuelgan y se mecen
  if (ad.cordones) for (const sx of [-1, 1]) { hijoMesh(tor, (pa, ge, m) => pa.radiusTop === .012 && Math.abs(m.position.x - sx * .07) < .01 && ocultar(m)); hijoMesh(tor, (pa, ge, m) => pa.radius === .02 && Math.abs(m.position.x - sx * .07) < .01 && ocultar(m));
    colgante(tor, [[sx * .07, TOR - .08, SZ0 * rT * .9], [sx * .075, TOR - .17, SZ0 * rT * .93], [sx * .075, TOR - .26, SZ0 * rT * .94], [sx * .075, TOR - .34, SZ0 * rT * .94]], '#fffdf2', { g: esf(.026), col: '#fffdf2' }, { k: .05, pt: { rad: .025 } }); }
  // 8) objeto de la mano: lo que cuelga de él es un péndulo
  let propG = null;
  { // el pivote del objeto es el último grupo hijo de la mano derecha; su único hijo es el objeto
    const mano = (pj.mano && pj.mano('der')) || null; let piv = null;
    if (mano) for (const c of mano.children) if (c.isGroup && c.children.length === 1 && c.children[0].isGroup) piv = c;
    if (piv) propG = piv.children[0];
  }
  const visProp = { get visible() { return propG ? propG.visible : true; } };
  if (propG && L.prop) {
    const e = L.prop;
    if (e === 'telefono') colgante(propG, [[.04, -.09, 0], [.05, -.15, .01], [.055, -.21, .015]], '#fffdf2', { g: esf(.04), col: '#ffd23f' }, { vis: visProp });
    else if (e === 'taza') colgante(propG, [[-.1, .14, 0], [-.115, .09, 0], [-.12, .04, 0]], '#fffdf2', { g: new T.BoxGeometry(.045, .06, .008), col: '#5ab0e0' }, { vis: visProp, k: .08, pt: { rad: .02 } });
    else if (e === 'tambor') { for (const sx of [-1, 1]) colgante(propG, [[sx * .21, .14, 0], [sx * .24, .08, 0], [sx * .25, .01, 0]], '#f2dfb0', { g: esf(.045), col: '#ff5c6a' }, { vis: visProp, k: .08, pt: { rad: .03 } }); }
    else if (e === 'consola' || e === 'consolaTu') colgante(propG, [[.17, -.07, .0], [.2, -.13, .01], [.21, -.2, .02]], '#fffdf2', { g: esf(.04), col: '#ff5c6a' }, { vis: visProp });
  }
  // 9) piezas de ropa sueltas: la riñonera y las solapas del chaquetón rebotan
  if (ad.rinonera) { const ri = hijoMesh(tor, (pa) => pa.width === .3 && pa.height === .13); if (ri) rebote(ri, tor, { k: .3, dr: 6, gs: .5 }); }
  if (ad.chaqueton) for (const m of tor.children) if (m.isMesh && m.geometry.parameters && m.geometry.parameters.width === .17 && m.geometry.parameters.height === .5) rebote(m, tor, { k: .2, dr: 5, gs: .4 });
  // 10) telas
  const matTela = (col) => { const m = V3.toon(col, { nuevo: true }); m.side = T.DoubleSide; return m; };
  let hemMat = null;
  const vueltaRing = (nc, y, rx, rz, a0) => { const o = []; for (let c = 0; c < nc; c++) { const a = a0 + c / nc * Math.PI * 2; o.push([Math.sin(a) * rx, y, Math.cos(a) * rz]); } return o; };
  if (R.falda) {                                                   // la falda de la Prima: tela de 4 filas que vuela al saltar
    const old = hijoMesh(tor, (pa) => pa.height === .3 && Math.abs(pa.radiusBottom - rT * 1.35) < 1e-6); ocultar(old);
    const rows = [[.07, 1.02], [-.02, 1.13], [-.12, 1.25], [-.23, 1.38]].map((q) => vueltaRing(10, q[0], rT * q[1], rT * q[1] * .9, 0));
    tela(tor, rows, 1, true, matTela(R.falda), { k: .12, gs: .7, infl: .55, dr: 2.4, rad: .03 });
  } else {                               // ruedo de camisa / franela / blusa / suéter / pollo
    hemMat = matTela(camisa); const y0 = -.06, r0 = PR[0] * 1.04;
    const rows = [[0, 1], [-.08, 1.08], [-.15, 1.16]].map((q) => vueltaRing(8, y0 + q[0], r0 * q[1], r0 * q[1] * SZ0, 0));
    tela(tor, rows, 1, true, hemMat, { k: .1, gs: .7, infl: .6, dr: 2.3, rad: .025 });
  }
  if (ad.delantal) {                                               // delantal del Portu: cuelga del pecho y aletea
    ocultar(hijoMesh(tor, (pa) => Math.abs(pa.width - .42 * W) < 1e-6 && pa.depth === .03)); ocultar(hijoMesh(tor, (pa) => pa.width === .18 && pa.height === .1 && pa.depth === .01));
    const ys = [.47, .34, .2, .06, -.08, -.22], nc = 5, hw = .21 * W, grid = ys.map((y) => { const r = rTor(Math.min(Math.max(y, -.04), TOR)); const row = []; for (let c = 0; c < nc; c++) { const x = (c / (nc - 1) - .5) * 2 * hw; row.push([x, y, SZ0 * Math.sqrt(Math.max(.0004, r * r - x * x)) + .035]); } return row; });
    tela(tor, grid, 2, false, matTela(V3.oscurecer ? V3.oscurecer(L.sh2, .78) : L.sh2), { k: .13, gs: .8, dr: 2.8, rad: .03, cm: 14 });
  }
  if (ad.capucha) {                                                // capucha de TÚ: cae por la espalda y se infla con el viento
    ocultar(hijoMesh(tor, (pa) => pa.radius === .22 && pa.tube === .07));
    const rows = [0, 1, 2].map((r) => { const y = TOR + .0 - r * .14, rr = rTor(Math.min(y, TOR)) * (r ? 1 : 1.0) + .05 + r * .02; const row = []; for (let c = 0; c < 5; c++) { const a = 1.15 - c / 4 * 2.3; row.push([Math.sin(a) * (rr + .06), y, -Math.cos(a) * (rr * SZ0 + .06)]); } return row; });
    tela(tor, rows, 1, false, matTela(camisa), { k: .12, gs: .8, dr: 2.8, rad: .03, cm: 14 });
  }

  /* ───────────── colisionadores (cabeza, torso, brazos, piernas), todos en su propio marco ───────────── */
  // k: 0 esfera · 1 cápsula (de (0,0,0) a (0,-len,0)) · 2 torso elíptico por perfil
  const COL = [], mk = (o, kind, bit, r, len) => { COL.push({ o: o, kind: kind, bit: bit, r: r, len: len || 0, inv: new T.Matrix4() }); };
  mk(J.hI, 1, 4, .115, HOM); mk(J.hD, 1, 4, .115, HOM); mk(J.cI, 1, 4, .1, ANTE + .06); mk(J.cD, 1, 4, .1, ANTE + .06);   // el orden importa: lo último que se resuelve (torso, cabeza) manda
  mk(J.mI, 1, 8, .125, PIER); mk(J.mD, 1, 8, .125, PIER); mk(J.rI, 1, 8, .105, PIER); mk(J.rD, 1, 8, .105, PIER);
  mk(cab, 0, 1, RC * 1.03); mk(tor, 2, 2, 0);

  /* ───────────── estado numérico (todo preasignado) ───────────── */
  const N = PPs.length, X = new Float64Array(N), Y = new Float64Array(N), Z = new Float64Array(N), OX = new Float64Array(N), OY = new Float64Array(N), OZ = new Float64Array(N);
  const RX = new Float64Array(N), RY = new Float64Array(N), RZ = new Float64Array(N);
  const NC = CON.length, CI = new Int32Array(NC), CJ = new Int32Array(NC), CL = new Float64Array(NC), CK = new Float64Array(NC);
  for (let i = 0; i < NC; i++) { CI[i] = CON[i].i; CJ[i] = CON[i].j; CL[i] = CON[i].l; CK[i] = CON[i].k; }
  const rigInv = new T.Matrix4(), tmpV = new T.Vector3();
  let iniciado = false, ws = 1, cx0 = 0, cy0 = 0, cz0 = 0, vyP = 0, rvx = 0, rvz = 0, belX = 0, belV = 0, cheX = 0, cheV = 0, tt = 0;
  const bel0 = torso ? torso.scale.clone() : null;
  const cheeks = []; if (cab) cab.traverse((o) => { if (o.isMesh && o.material && o.material.transparent && Math.abs(o.material.opacity - .55) < 1e-6) cheeks.push({ m: o, p: o.position.clone(), s: o.scale.clone() }); });
  const api = { grupo: ropaG, suelto: 1, reset: () => { iniciado = false; }, penetracion: (m) => pen(false, m), n: N, _pen: () => pen(true) };
  pj.ropa = api;

  function mundoAMundo() {                                         // matrices actuales
    g.updateMatrixWorld(true);
    rigInv.copy(rig.matrixWorld).invert();
    for (let i = 1; i < PARS.length; i++) PARI[i].copy(PARS[i].matrixWorld).invert();
    PARI[0].copy(rigInv);
    for (let i = 0; i < COL.length; i++) COL[i].inv.copy(COL[i].o.matrixWorld).invert();
    const e = rig.matrixWorld.elements;
    ws = (Math.hypot(e[0], e[1], e[2]) + Math.hypot(e[4], e[5], e[6]) + Math.hypot(e[8], e[9], e[10])) / 3;
  }
  function restos() {
    for (let i = 0; i < N; i++) { const p = PPs[i]; tmpV.set(p.x, p.y, p.z).applyMatrix4(p.f.matrixWorld); RX[i] = tmpV.x; RY[i] = tmpV.y; RZ[i] = tmpV.z; }
  }
  function colisiona(i, ccm) {
    const pd = PPs[i].rad; if (pd < 0) return 0; let toco = 0;
    for (let k = 0; k < COL.length; k++) {
      const c = COL[k]; if (!(c.bit & ccm)) continue;
      tmpV.set(X[i], Y[i], Z[i]).applyMatrix4(c.inv); let x = tmpV.x, y = tmpV.y, z = tmpV.z, hit = 0;
      if (c.kind === 0) { const d = Math.sqrt(x * x + y * y + z * z), rr = c.r + pd; if (d < rr) { const f = rr / Math.max(d, 1e-5); if (d < 1e-5) { z = rr; } else { x *= f; y *= f; z *= f; } hit = 1; } }
      else if (c.kind === 1) { const t = cl(-y / c.len, 0, 1), cy = -t * c.len, dx = x, dy = y - cy, dz = z, d = Math.sqrt(dx * dx + dy * dy + dz * dz), rr = c.r + pd;
        if (d < rr) { const f = rr / Math.max(d, 1e-5); if (d < 1e-5) { x = rr; } else { x = dx * f; y = cy + dy * f; z = dz * f; } hit = 1; } }
      else if (y > PY[0] - pd * .5 && y < TOR + .02) {
        const yy = cl(y, PY[0], TOR), r = rTor(yy), ex = x / r, ez = z / (r * SZ0), t2 = ex * ex + ez * ez, lim = (r + pd) / r;
        if (t2 < lim * lim) { if (t2 < 1e-6) { z = (z >= 0 ? 1 : -1) * (r + pd) * SZ0; } else { const f = lim / Math.sqrt(t2); x *= f; z *= f; } hit = 1; }
      }
      if (hit) { tmpV.set(x, y, z).applyMatrix4(c.o.matrixWorld); X[i] = tmpV.x; Y[i] = tmpV.y; Z[i] = tmpV.z; toco = 1; }
    }
    return toco;
  }
  function pen(det, mask) {                                                 // peor penetración actual (para las pruebas)
    let peor = 0, quien = '';
    for (let i = 0; i < N; i++) { const pd = PPs[i].rad; if (pd < 0 || PPs[i].pin) continue;
      for (let k = 0; k < COL.length; k++) { const c = COL[k]; if (!(c.bit & PPs[i].cm) || !(c.bit & (mask || 15))) continue;
        tmpV.set(X[i], Y[i], Z[i]).applyMatrix4(c.inv); const x = tmpV.x, y = tmpV.y, z = tmpV.z; let d = 9;
        if (c.kind === 0) d = Math.sqrt(x * x + y * y + z * z) - c.r - pd;
        else if (c.kind === 1) { const t = cl(-y / c.len, 0, 1); d = Math.hypot(x, y + t * c.len, z) - c.r - pd; }
        else if (y > PY[0] && y < TOR) { const r = rTor(y); d = (Math.sqrt((x / r) ** 2 + (z / (r * SZ0)) ** 2) - 1) * r - pd; }
        if (-d > peor) { peor = -d; quien = i + '/' + k; } } }
    return det ? quien + ' ' + peor.toFixed(3) : peor;
  }
  function cerrar() { for (let i = 0; i < N; i++) { X[i] = OX[i] = RX[i]; Y[i] = OY[i] = RY[i]; Z[i] = OZ[i] = RZ[i]; } }

  /* ───────────── el paso de la simulación (después de escribir los huesos) ───────────── */
  ctx.post.push(function (dt) {
    mundoAMundo(); restos();
    const e = tor.matrixWorld.elements, cx = e[12], cy = e[13], cz = e[14];
    dt = Math.min(Math.max(dt || 0, 0), .1);
    let salto = !iniciado;
    if (iniciado) { const d = Math.hypot(cx - cx0, cy - cy0, cz - cz0); if (d > (1.2 + 16 * dt) * ws) salto = true; }
    if (salto) { cerrar(); vyP = 0; rvx = rvz = 0; }
    else if (dt > 0) {
      const vx = (cx - cx0) / dt, vy = (cy - cy0) / dt, vz = (cz - cz0) / dt, ay = (vy - vyP) / dt; vyP = vy; rvx += (vx - rvx) * .3; rvz += (vz - rvz) * .3;
      const sp = Math.hypot(rvx, rvz), sl = api.suelto;
      const vi = V3.PJ.viento || { x: 0, z: 0, fuerza: 0 }, vf = (vi.fuerza || 0) * ws, wxx = (vi.x || 0) * vf, wzz = (vi.z || 0) * vf;
      tt += dt;
      const n = Math.min(3, Math.max(1, Math.ceil(dt * 60 - .01))), h = dt / n, gA = 17 * ws * sl, vmax = .45 * ws;
      for (let s = 0; s < n; s++) {
        for (let i = 0; i < N; i++) {
          const p = PPs[i];
          if (p.pin) { X[i] = OX[i] = RX[i]; Y[i] = OY[i] = RY[i]; Z[i] = OZ[i] = RZ[i]; continue; }
          let vxx = X[i] - OX[i], vyy = Y[i] - OY[i], vzz = Z[i] - OZ[i];
          const dr = 1 - Math.min(.8, p.dr * h), gust = vf ? .65 + .35 * Math.sin(tt * 2.3 + i * 1.7) : 0;
          vxx = vxx * dr + wxx * gust * h * (1 - dr); vzz = vzz * dr + wzz * gust * h * (1 - dr); vyy = vyy * dr;
          const vl = Math.sqrt(vxx * vxx + vyy * vyy + vzz * vzz); if (vl > vmax) { const f = vmax / vl; vxx *= f; vyy *= f; vzz *= f; }
          let ax = 0, az = 0;
          if (p.infl) { const rx = X[i] - cx, rz = Z[i] - cz, rl = Math.hypot(rx, rz) || 1, f = p.infl * Math.min(sp, 8) * ws * 1.1 * sl; ax = rx / rl * f; az = rz / rl * f; }
          OX[i] = X[i]; OY[i] = Y[i]; OZ[i] = Z[i];
          X[i] += vxx + ax * h * h; Y[i] += vyy - gA * p.gs * h * h; Z[i] += vzz + az * h * h;
          const kk = Math.min(.6, p.k * h * 60 / Math.max(sl, .3)); X[i] += (RX[i] - X[i]) * kk; Y[i] += (RY[i] - Y[i]) * kk; Z[i] += (RZ[i] - Z[i]) * kk;
        }
        for (let it = 0; it < 3; it++) for (let c = 0; c < NC; c++) {
          const i = CI[c], j = CJ[c], dx = X[j] - X[i], dy = Y[j] - Y[i], dz = Z[j] - Z[i], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-7) continue;
          const wi = PPs[i].pin ? 0 : 1, wj = PPs[j].pin ? 0 : 1, sw = wi + wj; if (!sw) continue;
          const f = (d - CL[c] * ws) / d * CK[c] / sw, fi = f * wi, fj = f * wj;
          X[i] += dx * fi; Y[i] += dy * fi; Z[i] += dz * fi; X[j] -= dx * fj; Y[j] -= dy * fj; Z[j] -= dz * fj;
        }
        for (let i = 0; i < N; i++) if (!PPs[i].pin) { colisiona(i, PPs[i].cm); if (PPs[i].cm !== 8) colisiona(i, PPs[i].cm); }
      }
      // cuerpo blando
      if (torso) {
        const w = 17, z = .22, tg = cl(ay * .004, -1, 1) * sl;
        belV += (-w * w * (belX - tg) - 2 * z * w * belV) * dt; belX = cl(belX + belV * dt, -1.4, 1.4);
        const am = .035 + P * .06, b = belX * am;
        torso.scale.set(bel0.x * (1 + b * .6), bel0.y * (1 - b), bel0.z * (1 + b));
        const ch = cl(ay * .006, -1, 1) * sl; cheV += (-w * w * 1.3 * (cheX - ch) - 2 * .18 * w * 1.1 * cheV) * dt; cheX = cl(cheX + cheV * dt, -1.6, 1.6);
        for (const k of cheeks) { k.m.position.y = k.p.y - cheX * .022; k.m.scale.set(k.s.x * (1 + cheX * .1), k.s.y * (1 - cheX * .16), k.s.z); }
      }
    }
    cx0 = cx; cy0 = cy; cz0 = cz; iniciado = true;
    if (!(X[0] === X[0]) || !(Y[N - 1] === Y[N - 1])) cerrar();    // NaN: se recoloca todo
    dibujar();
    if (hemMat && torso) { const cc = torso.material.color; if (hemMat.color.r !== cc.r || hemMat.color.g !== cc.g || hemMat.color.b !== cc.b) hemMat.color.copy(cc); }
  });

  /* ───────────── dibujar: de puntos del mundo a las mallas ───────────── */
  function aLocal(i, inv, out) { return out.set(X[i], Y[i], Z[i]).applyMatrix4(inv); }
  function dibujar() {
    for (let k = 0; k < REN.length; k++) {
      const r = REN[k];
      if (r.vis && r.m && r.m.visible !== r.vis.visible) r.m.visible = r.vis.visible;
      if (r.t === 'seg') {
        aLocal(r.a, rigInv, _a); aLocal(r.b, rigInv, _b); _c.subVectors(_b, _a); const len = _c.length() || 1e-5; _c.multiplyScalar(1 / len);
        r.m.position.copy(_a).add(_b).multiplyScalar(.5); r.m.quaternion.setFromUnitVectors(_Y, _c);
        if (r.plano) r.m.scale.set(r.r * 1.15, len * .5 * r.ext, r.r * .22); else r.m.scale.set(r.r, len * .5 * r.ext, r.r);
      } else if (r.t === 'cord') {
        aLocal(r.a, rigInv, _a); aLocal(r.b, rigInv, _b); _c.subVectors(_b, _a); const len = _c.length() || 1e-5; _c.multiplyScalar(1 / len);
        r.m.position.copy(_a).add(_b).multiplyScalar(.5); r.m.quaternion.setFromUnitVectors(_Y, _c); r.m.scale.set(r.r, len, r.r);
      } else if (r.t === 'blob') {
        aLocal(r.a, rigInv, r.m.position);
      } else if (r.t === 'jig') {
        aLocal(r.a, PARI[r.par], r.m.position);
      } else if (r.t === 'tela') {
        const pos = r.pos, pos2 = r.pos2, ids = r.ids; let mx = 0, my = 0, mz = 0;
        for (let q = 0; q < r.n; q++) { aLocal(ids[q], rigInv, _a); pos[q * 3] = _a.x; pos[q * 3 + 1] = _a.y; pos[q * 3 + 2] = _a.z; mx += _a.x; my += _a.y; mz += _a.z; }
        mx /= r.n; my /= r.n; mz /= r.n;
        r.ge.attributes.position.needsUpdate = true; r.ge.computeVertexNormals();
        const nr = r.ge.attributes.normal.array;       // contorno: un poco más grande en el plano y un poco detrás de la tela (por su normal), así nunca la tapa
        for (let q = 0; q < r.n; q++) { const dx = pos[q * 3] - mx, dy = pos[q * 3 + 1] - my, dz = pos[q * 3 + 2] - mz, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = .016 / d;
          pos2[q * 3] = pos[q * 3] + dx * f - nr[q * 3] * .012; pos2[q * 3 + 1] = pos[q * 3 + 1] + dy * f - nr[q * 3 + 1] * .012; pos2[q * 3 + 2] = pos[q * 3 + 2] + dz * f - nr[q * 3 + 2] * .012; }
        r.go.attributes.position.needsUpdate = true;
        if (r.vis && r.m.visible !== r.vis.visible) { r.m.visible = r.mo.visible = r.vis.visible; }
      }
    }
  }
});
})(typeof window !== 'undefined' ? window : globalThis);
