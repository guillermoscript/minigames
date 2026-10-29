// LA FIESTA · personajes 3D low poly (FIESTA.V3.PJ): el elenco de fiesta-personajes.js en 3D, para TODOS los minijuegos 3D y el tablero.
// Se construye con primitivas de three.js (sin modelos externos) a partir de DATOS por personaje (ELENCO): cuerpo, ropa, pelo, adornos y su
// objeto propio. Huesos con codo y rodilla; animación por poses que se mezclan (cross-fade) + capas encima: parpadeo, respiración, mirada,
// expresión de la cara y aplastar/estirar al caer.
//
//   const pj = V3.PJ.crear('mama', { camisa, escala, prop: true })
//   pj.g                          el THREE.Group (pies en y = 0, mira hacia +z). El juego lo mueve: de su velocidad real sale la cadencia de los pasos
//   pj.anim(nombre, op)           pose en bucle (74): quieto caminar correr cargar celebrar bailar triste mojado sentado empujar saludar aire agacharse empujado gritar aplaudir mareado
//                                 + cansado pesado asustado sigilo preparado equilibrio jadeo forcejear halar trepar colgar resbalar nadar chapotear montar victoria campeon ganador
//                                 rodillas animar derrota rabieta desplome lloron provocar burla reirse senalar asentir negar impaciente pensar revolver asombrado dormitar dormir
//                                 sentado_celebra sentado_miedo sentado_aburrido sentado_enojado aturdido cubrirse
//                                 + NUEVAS: retroceder carretilla carga_tiro halar_fuerte gatear remar pescar borde pared tambalear grupo_salta salsa robot twist brincos
//                                 (lista y una línea por cada una: V3.PJ.DESC; las nuevas: V3.PJ.NUEVOS)
//                                 op = {vel: 0..1} (cadencia y amplitud sin velocidad real), {idle: false} apaga las esperas con variantes al azar
//   pj.uno(nombre)                gesto de una vez, vuelve solo a la pose en bucle (64): saltar lanzar golpe caer festejo pegar esquivar susto tropezar + lanzar_arriba/abajo/lado empujon patear
//                                 cabecear atrapar esquivar_izq/der/abajo/salto cubrir si no encoger facepalm sorpresa saludo aplauso reverencia senal pulgar guino eureka duda risa grito puno
//                                 chocala derrapar giro bostezo reloj estirarse rascarse miradas caer_atras caer_adelante resbalon
//                                 + NUEVOS: voltereta sacudirse casco recoger izarse tiron heroe abrazo hombrazo beso corazon paz callar llamar saludo_militar flexionar
//                                 Cada personaje se mueve a su manera (V3.PJ.PERS: tempo, rebote, ancho, brazos, peso, lado dominante…); la espera tiene vida propia
//                                 (cambios de peso, ojos que se adelantan a la cabeza, parpadeo con intención, tics del nervioso) y las transiciones tienen duración y retraso por grupo
//                                 (arranque con anticipación, parada con peso, caminar<->correr con cambio de marcha). V3.PJ.reloj = () => segundos sincroniza 'grupo_salta' entre equipos.
//   pj.cara(e)                    25 caras: normal feliz susto triste enojado concentrado dormido mareado + dolor guino burla sorpresa risa llorando cansado aburrido pensando orgulloso esfuerzo miedo
//                                 asco sueno picaro gritando bostezo. Los gestos y golpes ponen la suya un rato; con 'normal' la animación puede poner la suya
//   pj.rumbo(rad)                 hacia dónde mira (gira suave; en giros grandes la cabeza y el torso se adelantan)
//   pj.mirar(x, y)                -1..1: ojos, luego cabeza, luego torso (≈ ±66°) · pj.mirarA({x,y,z}) mira un punto del mundo
//   pj.impacto(dx, dz, fuerza)    golpe con dirección (mundo): el cuerpo cede, el pelo/brazos/cabeza hacen látigo y vuelve con resorte; fuerza >= 2.4 tumba (volar)
//   pj.volar(dx, dz, fuerza, o)   ragdoll ligero: sale volando, rebota, se acuesta y se levanta. o = {giro, alcance, suelo, mover}. pj.volando / pj.fase
//   pj.fx(nombre, on)             efectos sobre la cabeza: estrellas gota zetas interr excl bombilla corazon notas (algunas animaciones los prenden solas)
//   pj.prop(visible)              muestra/esconde su objeto propio (la chancla de mamá, el tambor del tío…)
//   pj.mano('der'|'izq')          Object3D de la mano, para colgarle cosas (una bombita, un balón)
//   pj.color(hex)                 tiñe la camisa (p. ej. mojado) · pj.color(null) vuelve a la suya
//   pj.update(dt)                 avanza la animación (llamar cada cuadro)
//   V3.PJ.ELENCO · V3.PJ.ANIMS · V3.PJ.UNOS · V3.PJ.CARAS · V3.PJ.DESC · V3.PJ.ids()
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {}, V3 = F.V3, T = root.THREE;
if (!V3 || !T || !V3.malla) return;
const TAU = Math.PI * 2;

/* ───────────── el elenco como datos (colores de fiesta-personajes.js) ───────────── */
// cuerpo: ancho (1 = normal), panza (0..1), alto (1 = normal) · ropa: arriba (camisa|franela|sueter|blusa|camiseta), pat (rayas|flores|botones|cierre), cuello
// pelo: rizos | mono | liso | raya | rolos · adornos: audifonos, gorra, casco, lentes, sol, bigote, aretes, panuelo, delantal, capucha, y detalles chicos
// (cordones, estrella, correa, pulsera(s), lunar, perlas, pantuflas, chaqueton, cadena, reloj, munequera, curita, collar, flor, rinonera, lapiz, mangas…)
// pierna (grosor, 1 = normal) · ropa.jean (costuras y ruedo) · labios · lentesC / lentesForma ('cuadro') · prop: id de objeto
const ELENCO = {
  tu: { n: 'TÚ', piel: '#e8b48a', camisa: '#3fb0ff', sh2: '#2a7fd0', pant: '#3a5a9a', zap: '#f4f4f4', suela: '#3fb0ff', pelo: 'rizos', peloC: '#2a1a14',
    cuerpo: { ancho: 1, panza: 0, alto: 1 }, ropa: { arriba: 'sueter', pat: 'cierre' }, adornos: ['audifonos', 'capucha', 'cordones', 'estrella', 'cordonesZap'], prop: 'consolaTu', ojos: 1.05 },
  mama: { n: 'MAMÁ', piel: '#b07a58', camisa: '#2fc4c9', sh2: '#fffdf2', pant: '#2a4aa8', zap: '#2a2a38', pelo: 'mono', peloC: '#3a2418',
    cuerpo: { ancho: 1.04, panza: .2, alto: 1.02 }, ropa: { arriba: 'blusa', pat: 'botones', cuello: 1 }, adornos: ['aretes', 'pestanas', 'correa', 'pulsera', 'lunar'], labios: '#b8324a', prop: 'chancla', ceja: 'brava' },
  abuela: { n: 'LA ABUELA', piel: '#f0c8a0', camisa: '#f27fb0', sh2: '#ffd1e4', pant: '#f5a0c0', zap: '#f5a0c0', pelo: 'mono', peloC: '#d9d5df',
    cuerpo: { ancho: 1.02, panza: .25, alto: .9 }, ropa: { arriba: 'sueter', pat: 'botones' }, adornos: ['lentes', 'aretes', 'pestanas', 'arrugas', 'perlas', 'pantuflas', 'chaqueton'], prop: 'taza', encorva: .12 },
  tio: { n: 'EL TÍO', piel: '#c98a5a', camisa: '#f2d23a', sh2: '#2fbf8f', pant: '#2a2a34', zap: '#5a3a22', pelo: 'liso', peloC: '#15110e',
    cuerpo: { ancho: 1.18, panza: .7, alto: 1.04 }, ropa: { arriba: 'camisa', pat: 'flores', cuello: 1 }, adornos: ['sol', 'bigote', 'cadena', 'reloj', 'correa'], prop: 'tambor' },
  pana: { n: 'EL PANA', piel: '#d8a070', camisa: '#8fd13f', sh2: '#5aa02a', pant: '#2a2a34', zap: '#e8553d', suela: '#fffdf2', pelo: 'rizos', peloC: '#3a2418',
    cuerpo: { ancho: .94, panza: 0, alto: .96 }, ropa: { arriba: 'franela', pat: 'rayas' }, adornos: ['gorra', 'pecas', 'munequera', 'cordonesZap', 'curita'], gorraC: '#ff8a3d', prop: 'consola' },
  prima: { n: 'LA PRIMA', piel: '#c98a68', camisa: '#8a4fd0', sh2: '#f0d0ff', pant: '#c98a68', zap: '#ff8fc0', pelo: 'rolos', peloC: '#4a2a1a',
    cuerpo: { ancho: .96, panza: 0, alto: 1 }, ropa: { arriba: 'blusa', pat: 'flores', falda: '#5a2a9a' }, adornos: ['panuelo', 'aretes', 'pestanas', 'pulseras', 'collar', 'flor'], labios: '#e0507a', prop: 'telefono' },
  // camisa pollo blanca (franelilla sin mangas), bluejean ajustado, lentes, casco de mototaxi y la riñonera del pasaje
  cobrador: { n: 'EL COBRADOR', piel: '#c0845a', camisa: '#f6f6f2', sh2: '#d8d8d0', pant: '#3a62a8', zap: '#6a4020', pelo: 'liso', peloC: '#1a1410',
    cuerpo: { ancho: 1.02, panza: .05, alto: 1.02 }, ropa: { arriba: 'pollo', jean: 1 }, pierna: .8, adornos: ['casco', 'lentes', 'barbita', 'rinonera', 'cadena', 'correa'],
    lentesC: '#14101c', lentesForma: 'cuadro', prop: 'monedas' },
  portu: { n: 'EL PORTU', piel: '#e0a878', camisa: '#e8d8a8', sh2: '#3a8a4a', pant: '#3a3a44', zap: '#5a3a22', pelo: 'raya', peloC: '#1a1410',
    cuerpo: { ancho: 1.14, panza: .55, alto: 1.02 }, ropa: { arriba: 'camisa', cuello: 1 }, adornos: ['bigote', 'delantal', 'lapiz', 'mangas', 'correa'], prop: 'pan' }
};
/* PERSONALIDAD al moverse (se suma a la pose; no cambia la huella de los pies, así que el paso sigue sin patinar):
   tempo: ritmo de las poses sin velocidad real · rebote: cuánto sube y baja el cuerpo al andar · ancho: separación de piernas/brazos (cuerpo pesado) · brazos: cuánto bracea
   bal: balanceo lateral de la cadera al caminar · cad: giro de cadera · nervio: inquietud en espera (cambios de peso, miradas, tics) · peso: cuánto aplasta al caer y cuánto cuesta frenar
   lado: lado dominante (asimetría) · cab: inclinación habitual de la cabeza */
const PERS = {
  tu:       { tempo: 1,    rebote: 1,    ancho: 0,   brazos: 1,    bal: 0,    cad: 1,    nervio: .4,  peso: 1,   lado: 1,  cab: .02 },
  mama:     { tempo: 1.06, rebote: .9,   ancho: 0,   brazos: 1.05, bal: .01,  cad: 1.15, nervio: .3,  peso: 1,   lado: -1, cab: .04 },
  abuela:   { tempo: .78,  rebote: .4,   ancho: .03, brazos: .65,  bal: .015, cad: .8,   nervio: .08, peso: 1.3, lado: 1,  cab: -.04 },
  tio:      { tempo: .86,  rebote: 1.35, ancho: .1,  brazos: .8,   bal: .045, cad: .9,   nervio: .12, peso: 1.6, lado: -1, cab: .03 },
  pana:     { tempo: 1.18, rebote: 1.3,  ancho: 0,   brazos: 1.25, bal: .01,  cad: 1,    nervio: 1,   peso: .8,  lado: 1,  cab: -.03 },
  prima:    { tempo: 1.08, rebote: 1,    ancho: 0,   brazos: 1,    bal: .01,  cad: 1.5,  nervio: .45, peso: .9,  lado: -1, cab: .05 },
  cobrador: { tempo: 1.15, rebote: 1.1,  ancho: .02, brazos: 1.15, bal: .015, cad: 1.1,  nervio: .8,  peso: .9,  lado: 1,  cab: .03 },
  portu:    { tempo: .9,   rebote: 1.2,  ancho: .08, brazos: .85,  bal: .035, cad: .9,   nervio: .15, peso: 1.4, lado: 1,  cab: -.02 }
};
const PERS0 = { tempo: 1, rebote: 1, ancho: 0, brazos: 1, bal: 0, cad: 1, nervio: .4, peso: 1, lado: 1, cab: 0 };
const relojGrupo = () => (F.V3.PJ && typeof F.V3.PJ.reloj === 'function') ? F.V3.PJ.reloj() : Date.now() / 1000;   // reloj compartido: los que hacen la misma animación "en grupo" van al unísono
const BASE = { piel: '#d8a070', camisa: '#ffd23f', sh2: '#ffffff', pant: '#3a3a44', zap: '#2a2a2a', pelo: 'liso', peloC: '#2a1a14', cuerpo: { ancho: 1, panza: 0, alto: 1 }, ropa: { arriba: 'franela' }, adornos: [] };

/* ───────────── geometrías compartidas ───────────── */
const G = {};
const geo = (k, f) => G[k] || (G[k] = f());
const esfera = (r, a, b) => geo('e' + r + '|' + a + '|' + b, () => new T.SphereGeometry(r, a || 10, b || 8));
const cil = (r1, r2, h, s, dy) => geo('c' + [r1, r2, h, s, dy].join('|'), () => { const g = new T.CylinderGeometry(r1, r2, h, s || 8); if (dy) g.translate(0, dy, 0); return g; });
const caja = (w, h, d, dy) => geo('b' + [w, h, d, dy].join('|'), () => { const g = new T.BoxGeometry(w, h, d); if (dy) g.translate(0, dy, 0); return g; });
const toro = (r, t, a, b, arc) => geo('t' + [r, t, a, b, arc].join('|'), () => new T.TorusGeometry(r, t, a || 5, b || 12, arc || TAU));
const torno = (k, pts, s) => geo('l' + k, () => new T.LatheGeometry(pts.map((p) => new T.Vector2(p[0], p[1])), s || 10));

const M = (g, col, op) => V3.malla(g, col, op);
const D = (g, col, op) => { const m = new T.Mesh(g, V3.toon(col, op)); return m; };     // detalle sin contorno ni sombra (cara, botones)

/* ───────────── objetos propios (en la mano derecha salvo que diga) ───────────── */
const PROPS = {
  chancla: () => { const g = new T.Group(); const s = M(caja(.16, .04, .4), '#ff5c8a', { g: .1 }); s.position.set(0, -.04, .12); const t = D(toro(.05, .015, 4, 8, Math.PI), '#ffd23f'); t.position.set(0, -.01, .08); g.add(s, t); g.rotation.x = -.4; return g; },
  taza: () => { const g = new T.Group(); const c = M(cil(.09, .08, .16, 10, .06), '#fffdf2', { g: .08 }); const a = D(toro(.045, .015, 4, 8), '#fffdf2'); a.position.set(.1, .06, 0); a.rotation.y = Math.PI / 2;
    const cafe = D(cil(.08, .08, .01, 10, .135), '#5a3418'); g.add(c, a, cafe); g.position.z = .08; return g; },
  tambor: () => { const g = new T.Group(); const c = M(cil(.2, .18, .3, 10), '#8a2f1f', { g: .05 }); const p = D(cil(.205, .205, .02, 10, .16), '#f2dfb0');
    for (let i = 0; i < 6; i++) { const l = D(caja(.02, .3, .02), '#f2dfb0'); const a = i / 6 * TAU; l.position.set(Math.cos(a) * .19, 0, Math.sin(a) * .19); l.rotation.z = .3 * (i % 2 ? 1 : -1); g.add(l); }
    g.add(c, p); g.position.set(-.05, -.05, .2); return g; },
  consola: () => { const g = new T.Group(); const b = M(caja(.34, .16, .06), '#3a3a4a', { g: .06 }); const s = D(caja(.15, .1, .01), '#7fe0ff', { em: '#3fa0d0', emI: .6 }); s.position.z = .035;
    const x = D(esfera(.025, 6, 4), '#ff5c6a'); x.position.set(.11, 0, .035); const y = D(esfera(.025, 6, 4), '#ffd23f'); y.position.set(-.11, 0, .035); g.add(b, s, x, y); g.position.set(0, .02, .1); g.rotation.x = -.6; return g; },
  consolaTu: () => PROPS.consola(),
  telefono: () => { const g = new T.Group(); const b = M(caja(.1, .19, .025), '#ff6fa8', { g: .08 }); const s = D(caja(.08, .15, .005), '#bfe8ff', { em: '#6ab0e0', emI: .5 }); s.position.z = .014; g.add(b, s); g.position.set(0, .04, .06); return g; },
  monedas: () => { const g = new T.Group(); for (let i = 0; i < 4; i++) { const m = M(cil(.06, .06, .02, 10), '#ffd23f', { g: .1 }); m.position.y = i * .025; g.add(m); } g.position.set(0, .02, .07); return g; },
  pan: () => { const g = new T.Group(); const b = M(cil(.06, .07, .5, 7), '#e6a85a', { g: .06 }); b.rotation.z = .25;
    for (let i = 0; i < 3; i++) { const c = D(caja(.07, .015, .02), '#fff3c8'); c.position.set(-.02 + i * .015, -.12 + i * .12, .06); c.rotation.z = .6; g.add(c); } g.add(b); g.position.set(0, .12, .06); return g; }
};

/* ───────────── construcción ───────────── */
/* ganchos para módulos extra (ragdoll físico, IK de pies, pelo/ropa…): cada archivo hace V3.PJ.EXT.push((pj, ctx) => {...}) y se aplica a todo personaje nuevo */
const EXT = [];
function crear(ch, op) {
  op = op || {};
  const L = Object.assign({}, BASE, ELENCO[ch] || {});
  const C = Object.assign({}, BASE.cuerpo, L.cuerpo), R = Object.assign({}, BASE.ropa, L.ropa);
  const ad = {}; for (const a of L.adornos) ad[a] = 1;
  const camisa = op.camisa || L.camisa, W = C.ancho, P = C.panza;
  const g = new T.Group(), rig = new T.Group(), raiz = new T.Group(); g.add(raiz); raiz.add(rig);   // raiz: pivote en el centro de masa (inclinar, volar, tumbarse)
  const PV = .9 * C.alto; raiz.position.y = PV; rig.position.y = -PV;
  const J = { raiz: raiz };                         // articulaciones
  const HIP = .62, PIER = .31, TOR = .66, HOM = .3, ANTE = .27;

  // cadera (sube y baja con el paso) -> torso (se inclina) / piernas
  const cad = new T.Group(); cad.position.y = HIP; rig.add(cad); J.cad = cad;
  const pierna = (sx) => {
    const muslo = new T.Group(); muslo.position.set(sx * .17 * W, 0, 0); cad.add(muslo);
    const gp = L.pierna || 1;                       // grosor de pierna (el bluejean ajustado del cobrador es más fino)
    muslo.add(M(cil(.12 * gp, .105 * gp, PIER, 7, -PIER / 2), L.pant));
    const rod = new T.Group(); rod.position.y = -PIER; muslo.add(rod);
    rod.add(M(esfera(.105 * gp, 7, 5), L.pant, { g: .04 }));               // rodilla redonda
    rod.add(M(cil(.1 * gp, .09 * gp, PIER, 7, -PIER / 2), L.pant));
    if (R.jean) {                                   // costura clara por fuera y ruedo doblado
      const cl = V3.oscurecer(L.pant, 1.35);
      for (const [o, r0] of [[muslo, .112 * gp], [rod, .095 * gp]]) { const c = D(caja(.012, PIER * .95, .02), cl); c.position.set(sx * r0, -PIER / 2, 0); o.add(c); }
      const ru = D(cil(.1 * gp, .1 * gp, .05, 8), cl); ru.position.y = -PIER + .04; rod.add(ru);
    }
    if (ad.cordonesZap) { const co = D(caja(.09, .02, .07), '#fffdf2'); co.position.set(0, -PIER + .075, .1); co.rotation.x = -.35; rod.add(co); }
    if (ad.pantuflas) { const po = D(esfera(.06, 6, 5), '#fffdf2'); po.position.set(0, -PIER + .04, .19); rod.add(po); }
    const zap = M(geo('zap', () => { const z = new T.SphereGeometry(.15, 8, 6, 0, TAU, 0, Math.PI / 2); z.scale(.85, .75, 1.35); z.translate(0, 0, .05); return z; }), L.zap, { g: .06 });
    zap.position.y = -PIER - .03; rod.add(zap);
    if (L.suela) { const su = D(cil(.13, .13, .04, 10), L.suela); su.scale.set(.85, 1, 1.35); su.position.set(0, -PIER - .02, .05); rod.add(su); }
    return { muslo: muslo, rod: rod };
  };
  const pI = pierna(-1), pD = pierna(1);
  J.mI = pI.muslo; J.rI = pI.rod; J.mD = pD.muslo; J.rD = pD.rod;

  const tor = new T.Group(); cad.add(tor); J.tor = tor;
  // torso por torno: cintura -> panza -> pecho -> hombros (la panza empuja el perfil)
  const rT = .3 * W, perfil = [[0, -.04], [rT * .95, -.04], [rT * (1 + P * .28), .2], [rT * (1.02 + P * .2), .36], [rT * .96, .52], [rT * .7, TOR], [.08, TOR + .03], [0, TOR + .03]];
  const torso = M(torno('torso' + W + P, perfil, 9), camisa, { g: .035 }); torso.scale.z = .82 + P * .12; tor.add(torso);
  const torsoMat = torso.material, SZ0 = .82 + P * .12;
  if (R.falda) { const f = M(cil(rT * 1.02, rT * 1.35, .3, 9, -.08), R.falda, { g: .04 }); f.scale.z = .9; tor.add(f); }
  else {
    const cin = D(cil(rT * .97, rT * .97, .08, 9, -.02), ad.correa ? '#3a2416' : L.pant); cin.scale.z = .82 + P * .12; tor.add(cin);
    if (ad.correa) { const he = D(caja(.09, .07, .02), '#e0c050'); he.position.set(0, -.02, rT * .97 * (.82 + P * .12) + .01); tor.add(he); }
  }
  // detalles de la ropa (al frente, z+)
  const frente = (rT * (1.02 + P * .2)) * (.82 + P * .12);
  if (R.pat === 'botones') for (let i = 0; i < 3; i++) { const b = D(esfera(.025, 6, 4), L.sh2); b.position.set(0, .18 + i * .14, frente * .98); tor.add(b); }
  if (R.pat === 'cierre') { const z = D(caja(.025, .5, .02), L.sh2); z.position.set(0, .3, frente * .99); tor.add(z); const bol = D(caja(.3, .1, .02), L.sh2); bol.position.set(0, .14, frente * .97); tor.add(bol); }
  if (R.pat === 'rayas') for (let i = 0; i < 2; i++) { const r = D(cil(rT * (1.03 + P * .2), rT * (1.03 + P * .2), .05, 9), L.sh2); r.scale.z = .82 + P * .12; r.position.y = .25 + i * .14; tor.add(r); }
  if (R.pat === 'flores') for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4, y = .12 + (i * 37 % 5) * .09; const fl = D(esfera(.045, 6, 4), L.sh2); fl.position.set(Math.sin(a) * frente * 1.12, y, Math.cos(a) * frente * .97); fl.scale.z = .4; tor.add(fl); }
  if (R.cuello) for (const sx of [-1, 1]) { const cu = D(caja(.14, .06, .1), L.sh2 === '#2fbf8f' ? L.sh2 : '#fffdf2'); cu.position.set(sx * .08, TOR - .04, frente * .55); cu.rotation.set(-.4, 0, sx * .5); tor.add(cu); }
  if (R.arriba === 'chaqueta') { for (const sx of [-1, 1]) { const so = D(caja(.05, .55, .02), '#fffdf2'); so.position.set(sx * .1, .3, frente * .99); tor.add(so); } }
  if (ad.delantal) { const de = M(caja(.42 * W, .55, .03), L.sh2, { g: .04 }); de.position.set(0, .2, frente * 1.01); tor.add(de); const ti = D(caja(.03, .22, .02), L.sh2); ti.position.set(0, .56, frente * .9); tor.add(ti); }
  if (ad.capucha) { const ca = M(toro(.22, .07, 5, 10, Math.PI), camisa, { g: .05 }); ca.position.set(0, TOR - .02, -.1); ca.rotation.x = -1.2; tor.add(ca); }
  // hombros -> brazo -> codo -> antebrazo -> mano
  const brazo = (sx) => {
    const hom = new T.Group(); hom.position.set(sx * (rT * .86 + .05), TOR - .1, 0); tor.add(hom);
    const manga = R.arriba === 'pollo' ? L.piel : camisa;      // camisa pollo: hombros y brazos al aire
    hom.add(M(esfera(.105, 7, 5), manga, { g: .05 }));
    hom.add(M(cil(.095, .085, HOM, 7, -HOM / 2), manga));
    const codo = new T.Group(); codo.position.y = -HOM; hom.add(codo);
    const ante = R.arriba === 'franela' || R.arriba === 'blusa' || R.arriba === 'pollo' || ad.mangas ? L.piel : camisa;
    codo.add(M(esfera(.085, 7, 5), ante, { g: .05 }));                  // codo redondo: sin costura al doblar
    codo.add(M(cil(.08, .07, ANTE, 7, -ANTE / 2), ante));
    if (ad.mangas) { const re = D(cil(.1, .1, .07, 8), camisa); re.position.y = .02; codo.add(re); }   // manga remangada
    const mano = new T.Group(); mano.position.y = -ANTE - .06; codo.add(mano);
    const pal = M(esfera(.1, 8, 6), L.piel, { g: .05 }); pal.scale.set(1, 1.1, .8); mano.add(pal);
    const pul = M(esfera(.045, 6, 4), L.piel, { g: .08 }); pul.position.set(-sx * .07, .03, .05); mano.add(pul);
    return { hom: hom, codo: codo, mano: mano };
  };
  const bI = brazo(-1), bD = brazo(1);
  J.hI = bI.hom; J.cI = bI.codo; J.hD = bD.hom; J.cD = bD.codo;

  // cabeza (cuello -> cráneo grande, chibi)
  const cue = new T.Group(); cue.position.y = TOR + .02; tor.add(cue); J.cue = cue;
  cue.add(M(cil(.09, .1, .1, 7, .03), L.piel));
  const cab = new T.Group(); cab.position.y = .5; cue.add(cab); J.cab = cab;
  // efectos sobre la cabeza (estrellas, gota de sudor, zetas, signos): se crean aquí, invisibles; en juego solo se prenden (pj.fx)
  const fxG = new T.Group(); fxG.position.y = 1.08; cue.add(fxG);
  const FXm = (g2, col, em) => D(g2, col, { em: em || col, emI: .9 });
  const glifo = (k) => { const gr = new T.Group(); gr.visible = false; fxG.add(gr); k(gr); return gr; };
  const FX = {
    estrellas: glifo((gr) => { for (let i = 0; i < 3; i++) { const e = FXm(geo('estrella', () => new T.OctahedronGeometry(.06, 0)), '#ffe14d', '#ffb800'); e.userData.i = i; gr.add(e); } }),
    gota: glifo((gr) => { const e = D(esfera(.05, 6, 5), '#8fd8ff', { em: '#5ab0e0', emI: .5 }); e.scale.set(.8, 1.4, .6); e.position.set(.52, -.62, .12); gr.add(e); }),
    zetas: glifo((gr) => { for (let i = 0; i < 2; i++) { const z = new T.Group(); for (const [w, y, r] of [[.1, .05, 0], [.1, -.05, 0], [.12, 0, .8]]) { const b = FXm(caja(w, .022, .02), '#bfe8ff', '#6ab0e0'); b.position.y = y; b.rotation.z = r; z.add(b); } z.userData.i = i; gr.add(z); } }),
    interr: glifo((gr) => { const a = FXm(toro(.06, .02, 4, 10, Math.PI * 1.4), '#fffdf2', '#c0c0c0'); a.rotation.z = Math.PI * .2; a.position.y = .1; const d = FXm(esfera(.022, 5, 4), '#fffdf2', '#c0c0c0'); d.position.y = -.04; gr.add(a, d); }),
    excl: glifo((gr) => { const a = FXm(caja(.04, .13, .02), '#ff5c6a', '#ff2030'); a.position.y = .08; const d = FXm(esfera(.026, 5, 4), '#ff5c6a', '#ff2030'); d.position.y = -.04; gr.add(a, d); }),
    bombilla: glifo((gr) => { const a = FXm(esfera(.075, 8, 6), '#fff07a', '#ffd800'); a.position.y = .05; const b = D(cil(.035, .035, .05, 6), '#8a8a96'); b.position.y = -.04; gr.add(a, b); }),
    corazon: glifo((gr) => { const c = '#ff5c8a', e = '#ff2060'; for (const sx of [-1, 1]) { const b = FXm(esfera(.05, 6, 5), c, e); b.position.set(sx * .034, .035, 0); gr.add(b); }
      const p = FXm(geo('corazonP', () => new T.ConeGeometry(.075, .11, 6)), c, e); p.rotation.z = Math.PI; p.position.y = -.025; gr.add(p); }),
    notas: glifo((gr) => { for (let i = 0; i < 2; i++) { const z = new T.Group(); const b = FXm(esfera(.035, 6, 4), '#fff07a', '#ffb800'); b.scale.set(1.2, .8, .8); const r = FXm(caja(.012, .13, .012), '#fff07a', '#ffb800'); r.position.set(.035, .06, 0); z.add(b, r); z.userData.i = i; gr.add(z); } })
  };
  const RC = .5;
  const craneo = M(esfera(RC, 14, 11), L.piel, { g: .03 }); craneo.scale.set(1.04, .96, .94); cab.add(craneo);
  for (const sx of [-1, 1]) { const o = M(esfera(.1, 6, 5), L.piel, { g: .06 }); o.position.set(sx * RC * 1.0, -.04, -.02); o.scale.set(.5, 1, .8); cab.add(o); }
  // cara: ojos (blanco + pupila + brillo), párpados, cejas, boca de varias formas, nariz, cachetes
  const cara = new T.Group(); cab.add(cara);
  const ZF = RC * .92, K = L.ojos || 1;
  const ojos = [-1, 1].map((sx) => {
    const o = new T.Group(); o.position.set(sx * .18, .03, ZF - .02); o.rotation.y = sx * .32; cara.add(o);
    const bl = D(esfera(.105 * K, 10, 8), '#fffdf2'); bl.scale.set(.85, 1.15, .35); o.add(bl);
    const pu = D(esfera(.07 * K, 8, 6), '#14101c'); pu.scale.set(.85, 1.05, .35); pu.position.z = .03; o.add(pu);
    const br = new T.Mesh(esfera(.024, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); br.position.set(.025, .035, .055); o.add(br);
    const par = D(esfera(.11 * K, 10, 6, ), L.piel); par.scale.set(.9, 1.2, .42); par.position.z = .005; par.visible = false; o.add(par);
    const feliz = D(toro(.06, .016, 4, 10, Math.PI), '#14101c'); feliz.position.z = .04; feliz.visible = false; o.add(feliz);
    if (ad.pestanas) { const pe = D(caja(.05, .015, .01), '#14101c'); pe.position.set(sx * .08, .1, .02); pe.rotation.z = sx * -.5; o.add(pe); }
    const ap = D(caja(.17, .036, .02), '#14101c'); ap.position.z = .04; ap.rotation.z = sx * .38; ap.visible = false; o.add(ap);   // ojo apretado (dolor, esfuerzo)
    return { g: o, bl: bl, pu: pu, br: br, par: par, feliz: feliz, ap: ap, sx: sx };
  });
  const cejas = [-1, 1].map((sx) => { const c = D(caja(.13, .03, .03), L.peloC === '#d9d5df' ? '#b9b5bf' : '#2a1a14'); c.position.set(sx * .18, .2, ZF - .01); c.rotation.y = sx * .3; cara.add(c); return c; });
  const bocas = {
    sonrisa: D(toro(.075, .018, 4, 10, Math.PI), L.labios || '#7a2430'),
    abierta: (() => { const m = D(geo('bocaA', () => { const s = new T.SphereGeometry(.09, 10, 6, 0, TAU, 0, Math.PI / 2); s.rotateX(Math.PI); s.scale(1, 1.1, .4); return s; }), '#5a1a24');
      const len = D(esfera(.045, 6, 4), '#ff7a8a'); len.position.set(0, -.06, .01); len.scale.set(1.2, .6, .4); m.add(len); return m; })(),
    o: D(esfera(.045, 8, 6), '#5a1a24'),
    triste: D(toro(.065, .018, 4, 10, Math.PI), L.labios || '#7a2430'),
    linea: D(caja(.13, .025, .02), L.labios || '#7a2430'),
    grande: D(geo('bocaA', () => { const s = new T.SphereGeometry(.09, 10, 6, 0, TAU, 0, Math.PI / 2); s.rotateX(Math.PI); s.scale(1, 1.1, .4); return s; }), '#5a1a24'),
    dientes: (() => { const m = D(caja(.17, .075, .02), '#fffdf2'); const l1 = D(caja(.18, .014, .025), '#5a1a24'); const l2 = D(caja(.014, .08, .025), '#5a1a24'); m.add(l1, l2); return m; })(),
    lengua: (() => { const m = D(caja(.13, .025, .02), L.labios || '#7a2430'); const len = D(esfera(.05, 6, 4), '#ff7a8a'); len.position.set(.025, -.05, .01); len.scale.set(1, 1.3, .4); m.add(len); return m; })(),
    ladeada: D(toro(.07, .018, 4, 10, Math.PI * .6), L.labios || '#7a2430')
  };
  { const len = D(esfera(.045, 6, 4), '#ff7a8a'); len.position.set(0, -.07, .01); len.scale.set(1.2, .6, .4); bocas.grande.add(len); }
  for (const k in bocas) { const b = bocas[k]; b.position.set(0, -.2, ZF + .02); b.visible = false; cara.add(b); }
  bocas.sonrisa.rotation.z = Math.PI; bocas.o.scale.z = .4; bocas.o.position.y = -.22; bocas.ladeada.rotation.z = Math.PI + .5; bocas.ladeada.position.x = .03;
  // lágrimas y efectos sobre la cabeza (todo se crea aquí; en juego solo se prende y apaga)
  const lag = [-1, 1].map((sx) => { const l = D(esfera(.03, 5, 4), '#7fd0ff', { em: '#5ab0e0', emI: .5 }); l.scale.set(1, 1.5, .6); l.position.set(sx * .22, -.1, ZF - .03); l.visible = false; cara.add(l); return l; });
  const nariz = M(esfera(.06, 6, 4), L.piel, { g: .06 }); nariz.position.set(0, -.06, ZF + .04); nariz.scale.set(1, .8, .9); cara.add(nariz);
  for (const sx of [-1, 1]) { const ca = new T.Mesh(esfera(.07, 6, 4), V3.toon('#ff8fa0', { op: .55 })); ca.position.set(sx * .3, -.14, ZF - .07); ca.scale.set(1, .55, .3); ca.rotation.y = sx * .5; cara.add(ca); }
  if (ad.pecas) for (let i = 0; i < 6; i++) { const pe = D(esfera(.012, 4, 3), '#8a5a3a'); pe.position.set((i < 3 ? -1 : 1) * (.22 + (i % 3) * .04), -.07 + (i % 2) * .03, ZF - .04); cara.add(pe); }
  if (ad.arrugas) for (const sx of [-1, 1]) { const ar = D(caja(.06, .01, .01), '#c99a7a'); ar.position.set(sx * .3, .02, ZF - .1); ar.rotation.z = sx * .4; cara.add(ar); }
  // pelo (los mechones, flequillo, moño y rolos cuelgan de pivotes que se mecen por resortes; el casquete queda fijo)
  const pelG = new T.Group(); cab.add(pelG); const colaG = new T.Group(); colaG.position.set(0, .38, -.3); cab.add(colaG);
  const PC = L.peloC;
  const casquete = (k, arc, rot) => { const c = M(geo('casq' + k, () => new T.SphereGeometry(RC * 1.06, 14, 8, 0, TAU, 0, Math.PI * arc)), PC, { g: .03 }); c.rotation.x = rot; c.scale.set(1.04, .98, .96); cab.add(c); return c; };
  if (L.pelo === 'rizos') {
    casquete('r', .5, -.28);
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; const m = M(esfera(.17, 6, 5), PC, { g: .04 }); m.position.set(Math.cos(a) * .42, (ad.gorra ? .12 : .3) + (i % 3) * .05, Math.sin(a) * .38 - .1); pelG.add(m); }
    if (!ad.gorra && !ad.casco) for (let i = 0; i < 5; i++) { const m = M(esfera(.2, 6, 5), PC, { g: .04 }); m.position.set(-.28 + i * .14, .5, .05 - (i % 2) * .18); pelG.add(m); }   // con gorra solo asoman los de los lados
  } else if (L.pelo === 'mono') {
    casquete('m', .52, -.32);
    const mo = M(esfera(.22, 8, 6), PC, { g: .04 }); mo.position.set(0, .04, -.06); colaG.add(mo);
    const li = D(toro(.12, .03, 4, 10), '#ff5c8a'); li.position.set(0, -.02, .02); li.rotation.x = .9; colaG.add(li);
  } else if (L.pelo === 'rolos') {
    casquete('o', .5, -.25);
    for (let i = 0; i < 6; i++) { const r = M(cil(.08, .08, .26, 8), ['#ff8fc0', '#8fd8ff', '#ffe14d', '#b49cff', '#7fe08a', '#ff8a3d'][i], { g: .05 }); r.rotation.z = Math.PI / 2; r.position.set(-.26 + (i % 3) * .26, .46 - Math.floor(i / 3) * .1, .1 - Math.floor(i / 3) * .3); pelG.add(r); }
  } else if (L.pelo === 'raya') {
    casquete('y', .42, -.4);
    const ra = D(caja(.02, .02, .4), V3.oscurecer(PC, .6)); ra.position.set(.15, .5, -.02); cab.add(ra);
    const fl = M(geo('flequillo', () => { const s = new T.SphereGeometry(.3, 8, 5, 0, Math.PI, 0, Math.PI / 2); return s; }), PC, { g: .04 }); fl.position.set(-.06, .32, .25); fl.scale.set(1, .5, .7); fl.rotation.set(-.5, Math.PI / 2, 0); pelG.add(fl);
  } else {
    casquete('l', .44, -.38);
    if (!ad.casco && !ad.gorra) { const fl = M(esfera(.2, 7, 5), PC, { g: .04 }); fl.position.set(.12, .36, .3); fl.scale.set(1.5, .5, .6); fl.rotation.z = -.3; pelG.add(fl); }   // el flequillo no atraviesa el casco
  }
  // adornos
  if (ad.audifonos) {
    const arco = M(toro(RC * 1.12, .045, 5, 14, Math.PI), '#2a2a34', { g: .08 }); arco.position.y = .02; cab.add(arco);
    for (const sx of [-1, 1]) { const cp = M(cil(.15, .15, .12, 10), '#ffd23f', { g: .06 }); cp.rotation.z = Math.PI / 2; cp.position.set(sx * RC * 1.08, -.02, 0); cab.add(cp); const ar = D(cil(.1, .1, .125, 10), '#2a2a34'); ar.rotation.z = Math.PI / 2; ar.position.copy(cp.position); cab.add(ar); }
  }
  if (ad.gorra || ad.casco) {
    const col = ad.gorra ? L.gorraC : '#3a7fd0';
    const gc = casquete(ad.gorra ? 'g' : 'k', .5, ad.gorra ? -.42 : -.38); gc.material = V3.toon(col); gc.scale.multiplyScalar(ad.casco ? 1.12 : 1.06);   // el casco tapa todo el pelo
    const vi = M(geo('visera', () => { const s = new T.CylinderGeometry(.32, .32, .04, 12, 1, false, 0, Math.PI); return s; }), col, { g: .05 });
    vi.position.set(0, .26, ad.gorra ? -.4 : .42); vi.rotation.y = ad.gorra ? Math.PI : 0; cab.add(vi);
    if (ad.casco) { const fr = D(caja(.18, .08, .02), '#ffd23f', { em: '#ffb030', emI: .4 }); fr.position.set(0, .38, .44); cab.add(fr); }
  }
  if (ad.lentes || ad.sol) for (const sx of [-1, 1]) {
    const cua = L.lentesForma === 'cuadro', mc = ad.sol ? '#14101c' : L.lentesC || '#c0a040';
    const l = M(toro(cua ? .13 : .12, .022, 4, cua ? 4 : 12), mc, { g: .1 }); l.position.set(sx * .18, .03, ZF + .04); if (cua) { l.rotation.z = Math.PI / 4; l.scale.set(1.15, .85, 1); } cara.add(l);
    if (ad.sol) { const v = D(cil(.11, .11, .02, 12), '#2a2a44'); v.rotation.x = Math.PI / 2; v.position.copy(l.position); cara.add(v); }
    if (sx > 0) { const pu = D(caja(.12, .02, .02), mc); pu.position.set(0, .05, ZF + .04); cara.add(pu); }
  }
  if (ad.bigote) { const b = M(geo('bigote', () => { const s = new T.SphereGeometry(.12, 8, 5); s.scale(1.6, .55, .6); return s; }), '#1a1410', { g: .06 }); b.position.set(0, -.13, ZF + .03); cara.add(b); }
  if (ad.barbita) { const b = M(esfera(.06, 6, 4), PC, { g: .06 }); b.position.set(0, -.36, ZF - .06); cara.add(b); }
  const aretesP = []; if (ad.aretes) for (const sx of [-1, 1]) { const pv = new T.Group(); pv.position.set(sx * RC * 1.0, -.1, 0); cab.add(pv); const a = D(toro(.055, .016, 4, 10), '#ffd23f'); a.position.y = -.06; a.rotation.y = Math.PI / 2; pv.add(a); aretesP.push(pv); }
  if (ad.panuelo) { const p = M(toro(RC * .98, .08, 5, 14), '#ff6fa8', { g: .05 }); p.rotation.x = Math.PI / 2 - .35; p.position.y = .2; cab.add(p); const n = M(esfera(.1, 6, 4), '#ff6fa8', { g: .06 }); n.position.set(0, .45, -.35); cab.add(n); }

  // detalles chicos (los que hacen que cada uno se reconozca de cerca)
  const collar = (col, r, colgante) => {            // cadena que cuelga por delante del cuello (+ dije)
    r = Math.max(r, rT * .78 + .04);                 // por fuera del pecho de cada quien
    const c = D(toro(r, .018, 4, 16, Math.PI), col); c.rotation.x = Math.PI / 2 + .55; c.scale.y = SZ0 + .06; c.position.set(0, TOR - .05, .02); tor.add(c);
    if (colgante) { const d2 = D(colgante[0], colgante[1]); d2.position.set(0, TOR - .05 - Math.sin(.55) * r, Math.cos(.55) * r * (SZ0 + .06) + .03); tor.add(d2); }
  };
  const muneca = (b, col, alto) => { const m = D(cil(.085, .085, alto || .04, 10), col); m.position.y = -ANTE + .04; b.codo.add(m); return m; };
  if (R.arriba === 'pollo') { const es = D(esfera(.1, 8, 6), L.piel); es.position.set(0, TOR - .02, frente * .62); es.scale.set(1.25, .55, .45); tor.add(es); }
  if (ad.cordones) for (const sx of [-1, 1]) { const co = D(cil(.012, .012, .2, 4, -.1), '#fffdf2'); co.position.set(sx * .07, TOR - .08, frente * .9); tor.add(co); const pu = D(esfera(.02, 4, 3), '#fffdf2'); pu.position.set(sx * .07, TOR - .3, frente * .93); tor.add(pu); }
  if (ad.estrella && ad.audifonos) { const es = D(geo('estrella', () => new T.OctahedronGeometry(.06, 0)), '#ff5c8a'); es.position.set(RC * 1.08 + .07, -.02, 0); es.scale.set(.4, 1, 1); cab.add(es); }
  if (ad.pulsera) muneca(bD, '#ffd23f', .03);
  if (ad.pulseras) ['#ffd23f', '#ff6fa8', '#5cff7a'].forEach((col, i) => { const m = muneca(bI, col, .025); m.position.y += i * .035; });
  if (ad.reloj) { const r = muneca(bI, '#2a2a34', .05); const es = D(cil(.04, .04, .02, 10), '#e0c050'); es.rotation.x = Math.PI / 2; es.position.set(0, -ANTE + .04, .085); bI.codo.add(es); }
  if (ad.munequera) muneca(bD, '#ff8a3d', .08);
  if (ad.lunar) { const lu = D(esfera(.018, 5, 4), '#3a2418'); lu.position.set(.24, -.12, ZF - .03); cara.add(lu); }
  if (ad.curita) { const cu = D(caja(.11, .04, .02), '#f2d0a0'); cu.position.set(-.27, .02, ZF - .07); cu.rotation.set(0, -.5, .5); cara.add(cu); }
  if (ad.perlas) for (let i = 0; i < 11; i++) { const a = -1.35 + i * .27; const pe = D(esfera(.026, 5, 4), '#fffdf2'); pe.position.set(Math.sin(a) * .2, TOR - .07 - Math.cos(a) * .05, Math.cos(a) * .19 + .02); tor.add(pe); }
  if (ad.chaqueton) for (const sx of [-1, 1]) { const pa = M(caja(.17, .5, .03), V3.oscurecer(camisa, .82), { g: .04 }); pa.position.set(sx * .15, .28, frente * .96); pa.rotation.y = sx * .35; tor.add(pa);
    const bo = D(caja(.09, .07, .01), V3.oscurecer(camisa, .7)); bo.position.set(sx * .17, .14, frente * 1.0); bo.rotation.y = sx * .35; tor.add(bo); }
  if (ad.cadena) collar('#e0c050', .17, [cil(.035, .035, .015, 10), '#e0c050']);
  if (ad.collar) collar('#d8d8e0', .15, [esfera(.035, 6, 4), '#ff5c8a']);
  if (ad.flor) { const fg = new T.Group(); fg.position.set(.4, .32, .2); cab.add(fg); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const pe = D(esfera(.05, 6, 4), '#fffdf2'); pe.position.set(Math.cos(a) * .055, Math.sin(a) * .055, 0); pe.scale.z = .5; fg.add(pe); }
    const ce = D(esfera(.035, 6, 4), '#ffd23f'); ce.position.z = .02; fg.add(ce); fg.rotation.y = .7; }
  if (ad.rinonera) { const z0 = rT * .97 * SZ0 + .05; const ri = M(caja(.3, .13, .11), '#2a2a34', { g: .05 }); ri.position.set(.06, .04, z0); ri.rotation.y = .15; tor.add(ri);
    const ci = D(caja(.26, .012, .01), '#e0c050'); ci.position.set(.06, .07, z0 + .06); ci.rotation.y = .15; tor.add(ci);
    const co = D(cil(rT * 1.0, rT * 1.0, .03, 10), '#2a2a34'); co.scale.z = SZ0; co.position.y = .05; tor.add(co); }
  if (ad.lapiz) { const la = M(cil(.022, .022, .26, 6), '#f2c230', { g: .1 }); la.position.set(RC * .98, .1, -.02); la.rotation.set(.3, 0, 1.25); cab.add(la);
    const pu = D(geo('punta', () => new T.ConeGeometry(.022, .05, 6)), '#3a2a1a'); pu.position.set(0, .15, 0); la.add(pu); }
  if (ad.delantal) { const bo = D(caja(.18, .1, .01), V3.oscurecer(L.sh2, .78)); bo.position.set(0, .12, frente * 1.03); tor.add(bo); }

  // objeto propio
  let propG = null;
  const propP = new T.Group(); bD.mano.add(propP);      // pivote del objeto: se mece por resortes (inercia)
  if (L.prop && PROPS[L.prop]) { propG = PROPS[L.prop](); propP.add(propG); propG.visible = op.prop !== false; }

  rig.scale.setScalar(C.alto);
  if (op.escala) g.scale.setScalar(op.escala);
  g.traverse((o) => { if (o.isMesh && !o.userData.borde && o.material !== V3.toon('#14101c')) o.castShadow = op.sombra !== false; });

  /* ───────────── animación ───────────── */
  // Capas (de abajo hacia arriba): 1) pose en bucle (ANIMS) con cross-fade · 2) gesto de una vez (UNOS) con entrada/salida suave · 3) locomoción real:
  // cadencia atada a la velocidad que el juego le da a pj.g (los pies no patinan), arranque, frenazo y giro · 4) mirada: ojos -> cabeza -> torso ·
  // 5) física secundaria: resortes amortiguados con overlap (cabeza, pelo, cola, aretes, objeto, hombros, codos, columna) · 6) impacto / volar
  // (ragdoll ligero: el cuerpo gira libre, las extremidades cuelgan de resortes sueltos, rebota, se acuesta y se levanta).
  const KEYS = ['y', 'cx', 'cz', 'ty', 'tz', 'kx', 'ky', 'kz', 'mIx', 'mIz', 'mDx', 'mDz', 'rI', 'rD', 'hIx', 'hIz', 'hDx', 'hDz', 'cI', 'cD', 'sq', 'tx',
    'cy', 'sx', 'hIy', 'hDy', 'rx', 'rz', 'ry', 'px', 'pz', 'cab'];
  // y/cx/sx: cadera (alto, adelante, lado) · cy/cz: giro y caída de la cadera · tx/ty/tz: torso · kx/ky/kz: cabeza · m*: muslos · r*: rodillas · h*: hombros · c*: codos
  // cab: 0..1, cuánto se deja entrar la mano en la cabeza (manos a la cara: lloron, derrota…) · hIy/hDy: giro del hombro
  // sq: aplastar/estirar · rx/rz/ry/px/pz: el cuerpo entero alrededor de su centro de masa (inclinar, tumbar) y desplazado
  const cero = () => { const o = {}; for (const k of KEYS) o[k] = 0; o.sq = 1; return o; };
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const sua = (x) => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const tri = (a) => .85 * (2 / Math.PI) * Math.asin(Math.sin(a)) + .15 * Math.sin(a);   // onda casi triangular: el pie apoyado va a velocidad constante
  const enc = L.encorva || 0, LEG = .62 * C.alto;
  let hh = 7; for (let i = 0; i < ch.length; i++) hh = (hh * 31 + ch.charCodeAt(i)) >>> 0;
  const PH = (hh % 1000) / 1000 * TAU, SPD = .93 + ((hh >> 10) % 100) / 100 * .14;    // desfase y cadencia propios: nadie se mueve sincronizado
  const GR = .85 + ((hh >> 4) % 100) / 100 * .3;                                          // "peso" del personaje: cuánto se menea el pelo, el objeto…
  const PS = Object.assign({}, PERS0, PERS[ch]);                                          // personalidad de este personaje
  // transiciones: cada grupo de articulaciones llega a la pose nueva con su retraso (cadera/piernas primero, torso, brazos, cabeza al final = follow-through)
  const GDL = { tx: 1, ty: 1, tz: 1, hIx: 2, hIz: 2, hDx: 2, hDz: 2, hIy: 2, hDy: 2, cI: 2, cD: 2, kx: 3, ky: 3, kz: 3, cab: 3 }, GDD = [0, .07, .13, .2];
  const sobre = (u) => { u = cl(u, 0, 1); const c2 = .6 * 1.525; return u < .5 ? (Math.pow(2 * u, 2) * ((c2 + 1) * 2 * u - c2)) / 2 : (Math.pow(2 * u - 2, 2) * ((c2 + 1) * (2 * u - 2) + c2) + 2) / 2; };   // ease in-out con un poco de sobreimpulso
  let mezD = .18, arrA = 0, arrT = 9;
  const vida = { w: 0, w0: 0, w1: 0, wu: 1, wt: 2 + Math.random() * 3, sx: 0, sy: 0, sx1: 0, sy1: 0, st: 1 + Math.random() * 2, hx: 0, hy: 0, hxT: 0, hyT: 0, hd: 0, tic: 0, tt: 3 + Math.random() * 4, k: 0 };
  let cur = cero(), de = cero(), mezcla = 1, animN = 'quieto', animOp = {}, uno = null, unoN = '', unoT = 0, fase = PH, t = 0, tq = PH, sv = 1, sk = 1;
  let caraN = 'normal', caraE = '', caraOv = '', caraOvT = 0, parp = 2 + Math.random() * 2, rumboA = 0, rumboT = 0, mx = 0, my = 0, gYaw = 0, gPit = 0, gYawA = 0, gPitA = 0;
  let frenoA = 0, frenoT = 9, landA = 0, landT = 9, ultimoY = 0, idleT = 5 + Math.random() * 5, impSq = 0;
  const fxMan = {};                                                        // efectos prendidos a mano (pj.fx)

  const br = (p, x, z, c) => { p.hIx = p.hDx = x; p.hIz = -z; p.hDz = z; p.cI = p.cD = c; };      // los dos brazos a la vez: adelante, abiertos, codo
  const pn = (p, m, r, sp) => { p.mIx = p.mDx = m; p.rI = p.rD = r; p.mIz = -(sp || 0); p.mDz = sp || 0; };   // las dos piernas: muslo, rodilla, apertura
  const GAIT = {                                                           // a: amplitud nominal del paso · lo/hi: cadencia (rad/s) entre la que se estira o acorta el paso · rate: cadencia sin velocidad real
    caminar: { a: (v) => .42 + .2 * v, lo: 5, hi: 11, rate: (v) => 6 + 4 * v }, correr: { a: (v) => .85 + .35 * v, lo: 9, hi: 17, rate: (v) => 9 + 6 * v },
    cansado: { a: () => .26, lo: 3, hi: 7, rate: () => 4.2 }, pesado: { a: () => .3, lo: 4, hi: 8, rate: () => 5 }, asustado: { a: (v) => .8 + .25 * v, lo: 10, hi: 20, rate: (v) => 12 + 5 * v },
    sigilo: { a: () => .3, lo: 3, hi: 7, rate: () => 3.5 }, retroceder: { a: (v) => .34 + .22 * v, lo: 5, hi: 11, rate: (v) => 5 + 4 * v }
  };
  const CAD = { cargar: (v) => 7 + 7 * v, empujar: (v) => 7 + 7 * v, forcejear: () => 8, trepar: (v) => 5 + 3 * v, nadar: (v) => 4.5 + 2 * v, resbalar: () => 9, chapotear: () => 5, montar: () => 7, colgar: () => 4, carretilla: (v) => 6 + 6 * v, gatear: (v) => 5.5 + 4 * v };
  const ROBOT = [                                                           // poses del baile de robot (cada fila = una pose; snapQ salta de una a otra de golpe)
    { hIx: -1.57, hDx: 0, hIz: -.1, hDz: .1, cI: -1.57, cD: -1.57, ky: .5, kz: 0, ty: .3, tz: 0, tx: 0, y: 0 },
    { hIx: 0, hDx: -1.57, hIz: -.1, hDz: .1, cI: -1.57, cD: -1.57, ky: -.5, kz: 0, ty: -.3, tz: 0, tx: 0, y: 0 },
    { hIx: -1.57, hDx: -1.57, hIz: -1.3, hDz: 1.3, cI: -.1, cD: -.1, ky: 0, kz: .3, ty: 0, tz: .1, tx: .08, y: -.03 },
    { hIx: -2.9, hDx: -2.9, hIz: -.3, hDz: .3, cI: -.1, cD: -.1, ky: 0, kz: -.3, ty: 0, tz: -.1, tx: -.05, y: .02 }
  ];
  const snapQ = (tab, ph) => { const n = tab.length, i = Math.floor(ph) % n, f = ph - Math.floor(ph), a = tab[(i + n - 1) % n], b = tab[i], e = sua(f / .14), o = {}; for (const k in b) o[k] = lerp(a[k], b[k], e); return o; };
  const ANIMS = {
    quieto: (p, s) => { const r = Math.sin(tq * 2.1), w = Math.sin(tq * .55), z = Math.sin(tq * 1.1 + 1);   // respira, carga el peso a un pie y deja los brazos colgar sueltos
      p.y = r * .012; p.tx = enc + r * .02 + .01; p.cz = w * .02; p.tz = -w * .03; p.ty = Math.sin(tq * .4) * .05; p.sq = 1 + r * .005;   // (los cambios de peso grandes y las miradas los pone la capa de vida)
      p.hIz = -.17 - r * .025; p.hDz = .17 + r * .025; p.hIx = z * .07; p.hDx = Math.sin(tq * 1.1) * .07; p.cI = p.cD = -.15 - r * .03;
      p.rI = Math.max(0, w) * .06; p.rD = Math.max(0, -w) * .06; p.kx = Math.sin(tq * .9) * .04; p.kz = Math.sin(tq * .7) * .04 + w * .02; },
    caminar: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = (.42 + .2 * s.vel) * k;      // el pie apoyado va hacia atrás a la velocidad del cuerpo; la cadera baja al abrir las piernas
      p.mIx = f * a; p.mDx = -f * a; p.rI = Math.max(0, -c) * .6 * (.5 + .5 * k) + .06 + Math.max(0, c) * .05; p.rD = Math.max(0, c) * .6 * (.5 + .5 * k) + .06 + Math.max(0, -c) * .05;
      p.hIx = -f * (a + .08); p.hDx = f * (a + .08); p.hIz = -.1; p.hDz = .1; p.cI = -.28 - s.vel * .12 - Math.max(0, f) * .3; p.cD = -.28 - s.vel * .12 - Math.max(0, -f) * .3;
      p.y = -.62 * (1 - Math.cos(a * f)) * .92 + .006; p.ty = f * .16 * k; p.cy = -f * .1 * k; p.ky = -p.ty * .6; p.tz = c * .03 * k; p.cz = -c * .035 * k; p.sx = -c * .028 * k;
      p.tx = enc + .04 + .1 * s.vel; p.kx = -Math.abs(c) * .03; },
    correr: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = (.85 + .35 * s.vel) * k;
      p.mIx = f * a; p.mDx = -f * a; p.rI = Math.max(0, -c) * 1.4 + .15; p.rD = Math.max(0, c) * 1.4 + .15;
      p.hIx = -f * a * 1.05; p.hDx = f * a * 1.05; p.hIz = -.17; p.hDz = .17; p.cI = -1.25 - s.vel * .25 - Math.max(0, f) * .25; p.cD = -1.25 - s.vel * .25 - Math.max(0, -f) * .25;
      p.y = Math.abs(f) * (.08 + .07 * s.vel) * k; p.tx = enc + .1 + .17 * s.vel; p.ty = f * .24 * k; p.cy = -f * .14 * k; p.ky = -p.ty * .6; p.tz = -f * .06; p.cz = -c * .05 * k;
      p.kx = -.1 + Math.abs(c) * .05; },
    cargar: (p, s) => { const f = Math.sin(fase) * s.vel; p.mIx = f * .8; p.mDx = -f * .8; p.rI = Math.max(0, -Math.cos(fase)) * s.vel + .05; p.rD = Math.max(0, Math.cos(fase)) * s.vel + .05;
      p.hIx = p.hDx = -2.75; p.hIz = -.28; p.hDz = .28; p.cI = p.cD = -.55; p.y = Math.abs(f) * .08; p.kx = -.18; p.tx = enc - .05 + Math.sin(tq * 2) * .01; p.cz = f * .05; },
    celebrar: (p, s) => { const j = Math.abs(Math.sin(tq * 7)), w = Math.sin(tq * 14);                   // salta, bombea los puños alternos y se tuerce de gusto
      p.y = j * .45; p.hIx = -2.7 + w * .4; p.hDx = -2.7 - w * .4; p.hIz = -.55; p.hDz = .55; p.cI = p.cD = -.3 - (1 - j) * .4; p.rI = p.rD = (1 - j) * .6; p.mIx = -j * .5; p.mDx = -j * .25;
      p.kx = -.2; p.kz = Math.sin(tq * 7) * .1; p.ty = Math.sin(tq * 3.5) * .35; p.tz = Math.sin(tq * 3.5) * .08; p.sq = 1 + (j - .5) * .14; },
    bailar: (p, s) => { const b = Math.sin(tq * 8.5), b2 = Math.sin(tq * 4.25); p.y = Math.abs(b) * .09; p.cz = b2 * .18; p.tz = -b2 * .24; p.ty = b2 * .45; p.hIx = -1.0 + b * .6; p.hDx = -1.0 - b * .6; p.hIz = -.9; p.hDz = .9; p.cI = p.cD = -1.1;
      p.mIz = -.1 - Math.max(0, b2) * .3; p.mDz = .1 + Math.max(0, -b2) * .3; p.rI = Math.max(0, b2) * .6; p.rD = Math.max(0, -b2) * .6; p.kz = b2 * .2; p.ky = b * .12; p.sq = 1 + b * .03; },
    triste: (p, s) => { const sus = Math.pow(Math.max(0, Math.sin(tq * .6)), 4);                          // hombros caídos, suspiros lentos y de a ratos un sollozo
      p.tx = enc + .38 + sus * .05; p.kx = .35; p.hIz = -.04 + Math.sin(tq * 11) * .022 * sus; p.hDz = .04 - Math.sin(tq * 11) * .022 * sus; p.hIx = p.hDx = .12; p.cI = p.cD = -.1;
      p.y = -.025 + Math.sin(tq * 1.5) * .01 - sus * .015; p.tz = Math.sin(tq * .7) * .03; p.mIx = p.mDx = -.05; },
    mojado: (p, s) => { const tr = Math.sin(tq * 38) * .03, tr2 = Math.sin(tq * 31);                      // tirita: abrazado, con escalofríos
      p.tx = enc + .3; p.kx = .3; p.hIx = p.hDx = -.5; p.hIz = -.22 + tr; p.hDz = .22 - tr; p.cI = p.cD = -1.5; p.sq = .96; p.cz = tr2 * .012; p.ky = Math.sin(tq * 25) * .05; p.y = tr2 * .006; },
    sentado: (p, s) => { p.y = -.24; p.mIx = p.mDx = -1.5; p.rI = p.rD = 1.5; p.mIz = -.08; p.mDz = .08; p.hIx = p.hDx = -.5; p.cI = p.cD = -.9; p.hIz = -.1; p.hDz = .1; p.tx = enc + .05 + Math.sin(tq * 2) * .02; },
    empujar: (p, s) => { const f = Math.sin(fase) * Math.max(.3, s.vel); p.tx = enc + .45; p.hIx = p.hDx = -1.55; p.hIz = -.15; p.hDz = .15; p.cI = p.cD = -.25; p.mIx = f * .7 + .2; p.mDx = -f * .7 + .2; p.rI = .4 + Math.max(0, f); p.rD = .4 + Math.max(0, -f); p.kx = -.3; p.y = Math.abs(f) * .03; },
    saludar: (p, s) => { ANIMS.quieto(p, s); p.hDx = -2.7; p.hDz = .5 + Math.sin(tq * 10) * .35; p.cD = -.4 + Math.sin(tq * 10) * .15; p.kz = -.1; },
    aire: (p, s) => { const up = Math.max(0, s.vy), dn = Math.max(0, -s.vy), fl = Math.sin(tq * 12) * dn * .22;     // subiendo: recoge las piernas y estira los brazos; bajando: extiende un pie al piso y abre los brazos para equilibrarse
      p.mIx = -.6 - up * .3 + dn * .28; p.mDx = .2 - up * .7 - dn * .35; p.rI = 1.1 + up * .3 - dn * .75; p.rD = .3 + up * .7 - dn * .05; p.hIx = -2.2 - up * .35 + dn * 1.6 + fl; p.hDx = -2.2 - up * .35 + dn * 1.6 - fl;
      p.hIz = -.7 - dn * .2; p.hDz = .7 + dn * .2; p.cI = p.cD = -.3 - dn * .15; p.kx = -.1 + dn * .12; p.tx = enc - up * .06 + dn * .1; p.mIz = -dn * .12; p.mDz = dn * .12; },
    agacharse: (p, s) => { const r = Math.sin(tq * 2.4); p.y = -.2 + r * .008; p.mIx = p.mDx = -.95; p.rI = p.rD = 1.7; p.mIz = -.12; p.mDz = .12; p.tx = enc + .4; p.kx = -.25; p.hIx = p.hDx = -.45; p.hIz = -.25; p.hDz = .25; p.cI = p.cD = -.9; },
    empujado: (p, s) => { const w = Math.sin(tq * 16), z = Math.sin(tq * 5);                              // manotea para no caerse de espaldas
      p.tx = -.35; p.kx = -.25; p.y = .02; p.hIx = -1.5 + w * .7; p.hDx = -1.5 - w * .7; p.hIz = -.85; p.hDz = .85; p.cI = p.cD = -.4; p.mIx = -.5 + z * .25; p.mDx = -.2 - z * .25; p.rI = .6; p.rD = .3; p.cz = z * .08; },
    gritar: (p, s) => { const w = Math.sin(tq * 16);                                                       // puños arriba, cabeza atrás, tembloroso
      p.hIx = p.hDx = -2.4 + w * .15; p.hIz = -.45; p.hDz = .45; p.cI = p.cD = -1.2; p.kx = -.35; p.tx = enc - .15; p.y = Math.abs(Math.sin(tq * 9)) * .05; p.sq = 1 + Math.sin(tq * 18) * .015; p.cz = w * .015; },
    aplaudir: (p, s) => { const c = (Math.sin(tq * 12) + 1) / 2, b = Math.abs(Math.sin(tq * 6));
      p.hIx = p.hDx = -1.3; p.hIz = -.12 - c * .35; p.hDz = .12 + c * .35; p.cI = p.cD = -1.6; p.tx = enc + .06; p.y = b * .05; p.kz = Math.sin(tq * 6) * .06; p.rI = p.rD = (1 - b) * .15; },
    mareado: (p, s) => { const o = Math.sin(tq * 2.2), o2 = Math.cos(tq * 2.2);                           // se bambolea en círculo, brazos abiertos
      p.tz = o * .12; p.tx = enc + o2 * .1; p.cz = Math.sin(tq * 2.2 + 1) * .1; p.ky = Math.sin(tq * 2) * .3; p.kz = o2 * .2; p.hIz = -.5; p.hDz = .5; p.hIx = o * .3; p.hDx = -o * .3; p.cI = p.cD = -.3; p.mIx = o * .3; p.mDx = -o * .3; p.rI = Math.max(0, o) * .3; p.rD = Math.max(0, -o) * .3; p.y = Math.sin(tq * 4.4) * .02; },

    /* ── locomoción con carácter ── */
    cansado: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = .26 * k, r = Math.sin(tq * 3.4);   // arrastra los pies, cabeza caída, jadea
      p.mIx = f * a; p.mDx = -f * a; p.rI = Math.max(0, -c) * .35 + .2; p.rD = Math.max(0, c) * .35 + .2; p.hIx = -f * .2; p.hDx = f * .2; p.hIz = -.06; p.hDz = .06; p.cI = p.cD = -.12;
      p.y = -.05 - .62 * (1 - Math.cos(a * f)) + r * .006; p.tx = enc + .34 + r * .03; p.kx = .3; p.tz = c * .05; p.cz = -c * .03; p.ty = f * .07; p.cy = -f * .08; p.sq = 1 + r * .01; },
    pesado: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = .3 * k;                       // carga un peso en los brazos: echa el cuerpo atrás, pasos anchos y cortos
      p.mIx = f * a; p.mDx = -f * a; p.mIz = -.1; p.mDz = .1; p.rI = Math.max(0, -c) * .5 + .25; p.rD = Math.max(0, c) * .5 + .25; br(p, -.85, .1, -.95);
      p.tx = enc - .1; p.cx = .05; p.y = -.07 - .62 * (1 - Math.cos(a * f)); p.cz = -c * .08; p.tz = c * .08; p.ty = f * .05; p.kx = .1; p.kz = c * .04; },
    asustado: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = (.8 + .25 * s.vel) * k, fl = Math.sin(tq * 17), fl2 = Math.sin(tq * 13 + 1);   // corre despavorido mirando atrás, manoteando
      p.mIx = f * a; p.mDx = -f * a; p.rI = Math.max(0, -c) * 1.5 + .2; p.rD = Math.max(0, c) * 1.5 + .2; p.hIx = -1.9 + fl * .55; p.hDx = -1.9 + fl2 * .55; p.hIz = -.55 - fl2 * .2; p.hDz = .55 + fl * .2;
      p.cI = -.6 + fl * .4; p.cD = -.6 - fl2 * .4; p.tx = enc + .28; p.y = Math.abs(f) * .1; p.ky = Math.sin(tq * 3.1) * .9; p.kx = -.15; p.ty = f * .2; p.cy = -f * .22; p.sq = 1 + fl * .015; p.kz = fl * .05; },
    sigilo: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = .3 * k;                       // de puntitas y agachado, escaneando
      p.y = -.19; p.mIx = -.55 + f * a; p.mDx = -.55 - f * a; p.rI = 1.15 + Math.max(0, -c) * .5; p.rD = 1.15 + Math.max(0, c) * .5; p.mIz = -.1; p.mDz = .1; br(p, -.7, .15, -1.2);
      p.tx = enc + .42; p.kx = -.2; p.ky = Math.sin(tq * 1.3) * .5; p.cz = -c * .04; p.ty = f * .05; },
    preparado: (p, s) => { const b = Math.sin(tq * 6), r = Math.sin(tq * 2.3);                              // en guardia: agachado, rebotando sobre las puntas
      p.y = -.17 + b * .015; pn(p, -.55 + b * .06, 1.1 - b * .1, .22); br(p, -.55, .5, -1.0 + r * .1); p.tx = enc + .35; p.kx = -.2; p.ky = Math.sin(tq * 1.1) * .25; p.cz = Math.sin(tq * 3) * .03; },
    equilibrio: (p, s) => { const w = Math.sin(tq * 3.1), w2 = Math.sin(tq * 5.3 + 1);                       // en un pie con los brazos abiertos corrigiendo
      p.mDx = -.1; p.rD = .1; p.mIx = .1; p.rI = 1.9; p.mIz = -.1; p.hIx = p.hDx = -.1 + w2 * .2; p.hIz = -1.15 - w * .35; p.hDz = 1.15 - w * .35; p.cI = p.cD = -.15; p.cz = w * .08; p.tz = -w * .14;
      p.tx = enc + .1; p.kz = w * .1; p.y = -.01 + w2 * .008; p.sx = -w * .03; },
    jadeo: (p, s) => { const r = Math.sin(tq * 6.5), r2 = Math.pow(Math.max(0, Math.sin(tq * 6.5)), 2);       // manos en las rodillas, resoplando
      p.tx = enc + 1.0 + r * .06; p.y = -.09; pn(p, -.5, .55, .12); p.hIx = p.hDx = -.55; p.hIz = -.28; p.hDz = .28; p.cI = p.cD = -.12; p.kx = -.55 + r * .04; p.sq = 1 + r2 * .02; },

    /* ── esfuerzo y contacto ── */
    forcejear: (p, s) => { const u = Math.max(0, Math.sin(tq * 3.2)), sh = Math.sin(tq * 24);                  // dos empujándose: gruñe, tiembla, clava los pies
      p.tx = enc + .55 + u * .12; br(p, -1.5, .22, -.3 + u * .1); pn(p, 0, 0, 0); p.mIx = .65; p.rI = .15; p.mDx = -.5 - u * .1; p.rD = 1.0; p.mIz = -.12; p.mDz = .12; p.y = -.12 - u * .02;
      p.cz = sh * .035 * (.5 + u); p.ky = sh * .04; p.kx = -.25; p.hIx += sh * .05; p.hDx -= sh * .05; p.cx = .03; },
    halar: (p, s) => { const e = Math.max(.35, s.vel), h = Math.pow(Math.max(0, Math.sin(tq * 3.6)), 2) * e;     // tira de la cuerda: se echa atrás y de a tirones recoge los brazos
      p.tx = enc - .32 - .18 * h; p.cx = -.1; br(p, -1.35 + h * .6, .12, -.45 - h * 1.1); p.mIx = -.5; p.mDx = .3; p.rI = .35; p.rD = .5; p.mIz = -.12; p.mDz = .12; p.y = -.1 - h * .03; p.kx = -.15;
      p.cz = Math.sin(tq * 28) * .012 * (.3 + h); p.kz = h * .06; },
    trepar: (p, s) => { const f = Math.sin(fase), c = Math.cos(fase);                                        // abraza la pared: mano y pie contrarios suben alternados
      p.hIx = -2.15 - f * .55; p.hDx = -2.15 + f * .55; p.hIz = -.2; p.hDz = .2; p.cI = -.3 - Math.max(0, f) * .8; p.cD = -.3 - Math.max(0, -f) * .8; p.mIx = -.55 + f * .55; p.mDx = -.55 - f * .55;
      p.rI = .6 + Math.max(0, -f) * 1.0; p.rD = .6 + Math.max(0, f) * 1.0; p.tx = enc + .1; p.kx = -.35; p.y = Math.abs(c) * .04 - .04; p.cz = f * .05; p.ky = f * .18; p.sq = 1 - Math.abs(f) * .015; },
    colgar: (p, s) => { const sw = Math.sin(tq * 1.6), kick = Math.max(0, s.vel - .3) * 1.4;                    // colgado de las manos: el cuerpo es un péndulo, las piernas patalean si hay esfuerzo
      p.cab = .7; p.hIx = p.hDx = -3.0; p.hIz = -.12; p.hDz = .12; p.cI = p.cD = -.04; p.y = -.02; p.sq = 1.03; p.mIx = -.1 + sw * .2 + Math.sin(tq * 9) * kick * .5; p.mDx = -.1 - sw * .15 + Math.sin(tq * 9 + 2) * kick * .5;
      p.rI = .35 + Math.max(0, Math.sin(tq * 9)) * kick; p.rD = .35 + Math.max(0, Math.sin(tq * 9 + 2)) * kick; p.tx = enc - .05 + sw * .08; p.cz = sw * .04; p.tz = sw * .03; p.kx = -.25 + Math.sin(tq * 1.3) * .05; },
    resbalar: (p, s) => { const w = Math.sin(tq * 9), w2 = Math.cos(tq * 9);                                  // patina sin control: brazos como molino, piernas abiertas bailando
      p.hIx = -1.0 + w * 1.4; p.hDx = -1.0 - w * 1.4; p.hIz = -.9; p.hDz = .9; p.cI = p.cD = -.4; p.mIx = -.6 + w2 * .5; p.mDx = -.6 - w2 * .5; p.mIz = -.35; p.mDz = .35; p.rI = .5 + Math.max(0, w2) * .7; p.rD = .5 + Math.max(0, -w2) * .7;
      p.tx = enc - .15 + w * .15; p.cz = w2 * .1; p.tz = -w2 * .12; p.y = -.04; p.kx = -.25; p.rx = Math.sin(tq * 4.5) * .12; p.kz = w * .1; },
    nadar: (p, s) => { const a = fase, e = .6 + .4 * s.vel;                                                   // crol: boca abajo, brazadas de molino alternas, patadas rápidas
      p.rx = 1.22; p.ry = -.38 + Math.sin(tq * 3.4) * .03; p.hIx = -wrap(a) + 0; p.hDx = -wrap(a + Math.PI); p.hIz = -.12 - Math.max(0, Math.sin(a)) * .35; p.hDz = .12 + Math.max(0, Math.sin(a + Math.PI)) * .35;
      p.cI = -.15 - Math.max(0, -Math.cos(a)) * 1.3 * e; p.cD = -.15 - Math.max(0, Math.cos(a)) * 1.3 * e; p.mIx = Math.sin(a * 3) * .3; p.mDx = -Math.sin(a * 3) * .3; p.rI = .15 + Math.max(0, Math.sin(a * 3)) * .35; p.rD = .15 + Math.max(0, -Math.sin(a * 3)) * .35;
      p.kx = -1.0 + Math.sin(tq * .9) * .05; p.ky = Math.max(0, Math.sin(tq * 1.25)) * .55; p.rz = Math.sin(a + 1) * .14; p.ty = Math.sin(a) * .22; p.tx = -.1; },
    chapotear: (p, s) => { const a = fase, b = Math.sin(tq * 2.6);                                           // flotando en vertical: bracea y pedalea bajo el agua
      p.y = -.18 + b * .05; p.mIx = -.5 + Math.sin(a) * .5; p.mDx = -.5 - Math.sin(a) * .5; p.rI = 1.0 + Math.max(0, Math.sin(a)) * .5; p.rD = 1.0 + Math.max(0, -Math.sin(a)) * .5; p.mIz = -.15; p.mDz = .15;
      p.hIx = -.6 + Math.sin(a) * .35; p.hDx = -.6 - Math.sin(a) * .35; p.hIz = -.9 + Math.sin(a * 2) * .1; p.hDz = .9 - Math.sin(a * 2) * .1; p.cI = p.cD = -.8; p.kx = -.15 + b * .03; p.kz = Math.sin(tq * 1.7) * .08; p.cz = Math.sin(a) * .04; p.tx = enc - .05; },
    montar: (p, s) => { const b = Math.sin(fase), b2 = Math.abs(Math.sin(fase * .5));                           // a horcajadas, rebotando al trote, sujeto de las riendas
      p.y = -.3 + b2 * .07; pn(p, -.75, 1.25, .45); br(p, -1.05, .2, -.55); p.tx = enc + .1 + b * .04; p.kx = -.05; p.cz = Math.sin(fase * .5) * .03; p.sq = 1 + b2 * .02; },

    /* ── espera, actitud y trabajo ── */
    impaciente: (p, s) => { const tap = Math.max(0, Math.sin(tq * 8.5)), cic = tq % 6.2, sus = cic > 4.2 && cic < 5.4 ? Math.sin((cic - 4.2) / 1.2 * Math.PI) : 0;     // brazos cruzados, taconea, de a ratos resopla y mira de lado
      p.hIx = p.hDx = -.62; p.hIz = .1; p.hDz = -.1; p.cI = p.cD = -2.35; p.tx = enc - .03 + sus * .05; p.mDx = -.12 * tap; p.rD = tap * .5; p.cz = Math.sin(tq * .9) * .03; p.tz = -p.cz * .8;
      p.ky = (cic > 2 && cic < 3.4 ? .7 : 0) + (cic > 4.6 ? -.4 : 0); p.kz = Math.sin(tq * .8) * .06; p.y = sus * -.02 - .005; p.kx = sus * .1 - .02; },
    pensar: (p, s) => { const ta = Math.max(0, Math.sin(tq * 5)) * (Math.sin(tq * .5) > .3 ? 1 : 0);          // mano al mentón, codo apoyado en la otra mano, cabeza ladeada
      p.hDx = -1.15; p.hDz = .25; p.cD = -2.2 - ta * .1; p.hIx = -.75; p.hIz = .1; p.cI = -1.6; p.tx = enc + .1; p.kz = .16; p.ky = .22; p.kx = -.08; p.cz = Math.sin(tq * .45) * .03; p.tz = .04; p.mDx = -.05; },
    revolver: (p, s) => { const a = tq * 4.2;                                                                // revuelve la olla con la derecha, la otra en la cintura
      p.hDx = -.95 + Math.cos(a) * .22; p.hDz = .22 + Math.sin(a) * .22; p.cD = -1.35 + Math.sin(a) * .18; p.hIx = .15; p.hIz = -.55; p.cI = -1.85; p.tx = enc + .2 + Math.cos(a) * .02; p.ty = -Math.cos(a) * .08; p.kx = .2; p.ky = Math.sin(a * .5) * .06; p.cz = Math.sin(a) * .015; },
    dormitar: (p, s) => { const c = (tq * .22) % 1, dro = c < .75 ? sua(c / .75) : c < .82 ? 1 - sua((c - .75) / .07) : 0;   // de pie cabeceando: la cabeza cae despacio y pega un brinco
      p.kx = .05 + dro * .38 - (c >= .82 ? Math.sin((c - .82) / .18 * Math.PI) * .25 : 0); p.tx = enc + dro * .12; p.y = -dro * .035; p.kz = dro * .08; p.sq = 1 + Math.sin(tq * 1.7) * .012; p.hIz = -.15; p.hDz = .15; p.hIx = p.hDx = .05; p.cI = p.cD = -.14; p.rI = p.rD = dro * .1; p.cz = Math.sin(tq * .6) * .03; },
    dormir: (p, s) => { const r = Math.sin(tq * 1.5);                                                        // acostado boca arriba, roncando, un brazo sobre el pecho
      p.rx = -Math.PI / 2; p.ry = 0; p.y = 0; p.hIz = -.5; p.hDz = .45; p.hIx = .1; p.hDx = -.9; p.cI = -.12; p.cD = -1.9; pn(p, 0, .08, .16); p.mDx = -.1; p.kx = -.1; p.ky = .4; p.kz = .08; p.sq = 1 + r * .02; p.tx = r * .02; },
    sentado_celebra: (p, s) => { const j = Math.abs(Math.sin(tq * 7)), w = Math.sin(tq * 14);                 // sentado de la emoción: puños arriba, rebotando en el asiento
      ANIMS.sentado(p, s); p.y = -.24 + j * .12; p.hIx = -2.7 + w * .4; p.hDx = -2.7 - w * .4; p.hIz = -.5; p.hDz = .5; p.cI = p.cD = -.3; p.kx = -.2; p.ty = Math.sin(tq * 3.5) * .25; },
    sentado_miedo: (p, s) => { const tr = Math.sin(tq * 30);                                                  // sentado encogido, manos a la cara, temblando
      ANIMS.sentado(p, s); p.tx = enc - .2; p.hIx = p.hDx = -1.55; p.hIz = -.18; p.hDz = .18; p.cI = p.cD = -2.3; p.kx = .1; p.sq = .97; p.cz = tr * .012; p.mIx = p.mDx = -1.3; p.rI = p.rD = 1.7; p.y = -.24 + tr * .004; },
    sentado_aburrido: (p, s) => { const sw = Math.sin(tq * 2.3);                                              // derrumbado en el asiento, la barbilla en la mano, una pierna columpiando
      ANIMS.sentado(p, s); p.tx = enc + .3; p.hDx = -1.0; p.hDz = .15; p.cD = -2.3; p.hIx = .1; p.hIz = -.2; p.cI = -.2; p.kz = .22; p.kx = .1; p.rD = 1.5 + sw * .35; p.y = -.27; },
    sentado_enojado: (p, s) => { const st = Math.max(0, Math.sin(tq * 5));                                    // sentado con los puños en las rodillas, taconeando de rabia
      ANIMS.sentado(p, s); p.tx = enc + .22; p.hIx = p.hDx = -.5; p.hIz = -.24; p.hDz = .24; p.cI = p.cD = -1.2; p.rD = 1.5 - st * .35; p.kx = .1; p.cz = Math.sin(tq * 5) * .01; },

    /* ── victoria ── */
    victoria: (p, s) => { const u = (tq * 1.9) % 1, ar = 4 * u * (1 - u), ag = u < .16 ? 1 - u / .16 : 0, up = u < .22 ? sua(u / .22) : 1;     // saltos de alegría: agacha, despega con los puños, cae y vuelve a agacharse
      p.cab = .5; p.y = ar * .62 - ag * .16; p.sq = 1 - ag * .14 + ar * .12; p.hIx = -2.8 * up + (1 - up) * .5; p.hDx = -2.8 * up + (1 - up) * .5; p.hIz = -.6 - ar * .12; p.hDz = .6 + ar * .12; p.cI = p.cD = -.2 - (1 - up) * 1.2;
      pn(p, -ar * .5 - ag * .5, ar * .8 + ag * .9, .1); p.tx = enc - ar * .1 + ag * .22; p.kx = -.25 * up; p.ty = Math.sin(tq * 1.9 * Math.PI) * .2; },
    campeon: (p, s) => { const b = Math.sin(tq * 2.6), fl = Math.pow(Math.max(0, Math.sin(tq * 2.6)), 1.5);       // pecho afuera, bíceps al aire, mentón arriba, balanceo orgulloso
      p.tx = enc - .17; p.kx = -.28; p.hIx = -.1; p.hDx = -.25 - fl * .2; p.hIz = -.95; p.hDz = .95; p.cI = -2.1 + fl * -.2; p.cD = -2.1 - fl * .2; pn(p, 0, .05, .26); p.y = -.02; p.cz = b * .05; p.tz = -b * .06; p.ky = b * .25; p.sq = 1 + fl * .02; },
    ganador: (p, s) => { const b = Math.sin(tq * 6), b2 = Math.sin(tq * 3);                                    // baile del ganador: dedos al cielo y al piso (disco), caderas y hombros en shimmy
      p.hDx = -2.5; p.hDz = .3 + b * .08; p.cD = -.15; p.hIx = .25; p.hIz = -.45; p.cI = -.15; p.tz = b * .1; p.cz = -b * .14; p.sx = b * .05; p.ty = b2 * .35; p.cy = -b2 * .3; p.y = Math.abs(b) * .05; pn(p, -.1, .15 + Math.max(0, b) * .35, .2); p.kz = -b * .12; p.ky = b2 * .3; },
    rodillas: (p, s) => { const r = Math.sin(tq * 1.8), tr = Math.sin(tq * 14);                                // de rodillas, brazos al cielo, agradecido (se sacude de la emoción)
      p.y = -.25 + r * .01; p.mIx = p.mDx = -.12; p.rI = p.rD = 1.7; p.mIz = -.14; p.mDz = .14; br(p, -2.95, .45, -.1); p.cab = .5; p.tx = enc - .1; p.kx = -.4; p.cz = tr * .006; p.hIz = -.45 - r * .05; p.hDz = .45 + r * .05; },

    /* ── derrota ── */
    derrota: (p, s) => { const r = Math.sin(tq * 1.7), sh = Math.sin(tq * 3.3);                                // de rodillas con las manos en la cabeza, negando
      p.y = -.25; p.mIx = p.mDx = -.12; p.rI = p.rD = 1.7; p.mIz = -.14; p.mDz = .14; br(p, -2.75, .5, -2.6); p.cab = 1; p.tx = enc + .3 + r * .02; p.kx = .25; p.ky = sh * .3; p.kz = Math.sin(tq * 1.1) * .06; },
    rabieta: (p, s) => { const st = Math.sin(tq * 8), ab = Math.max(0, Math.sin(tq * 8));                      // pataleta: patea el piso alterno, puños que golpean el aire
      p.y = ab * .1; p.mIx = -Math.max(0, st) * .5; p.mDx = -Math.max(0, -st) * .5; p.rI = Math.max(0, st) * .5; p.rD = Math.max(0, -st) * .5; p.hIx = -.2 + st * .9; p.hDx = -.2 - st * .9; p.hIz = -.55; p.hDz = .55; p.cI = p.cD = -.9 - Math.abs(st) * .6;
      p.tx = enc + .2 + Math.abs(st) * .12; p.ty = st * .3; p.kx = .1; p.kz = st * .12; p.sq = 1 - Math.abs(st) * .03; },
    desplome: (p, s) => { const tr = Math.sin(tq * 14), gp = Math.pow(Math.max(0, Math.sin(tq * 3.2)), 3);        // tirado boca abajo, golpea el piso y patalea sollozando
      p.rx = 1.5; p.ry = 0; p.hIx = -2.8 + gp * 1.1; p.hDx = -2.8 + gp * 1.1; p.hIz = -.5; p.hDz = .5; p.cI = p.cD = -.25 - gp * .5; p.mIx = p.mDx = .1; p.rI = .2 + gp * .9; p.rD = .2 + (1 - gp) * .5; p.kx = -.65; p.ky = .5; p.tx = tr * .03; p.sq = 1 + tr * .012; },
    lloron: (p, s) => { const tr = Math.sin(tq * 12), sob = Math.pow(Math.max(0, Math.sin(tq * 1.8)), 3);        // las manos tapando la cara, llora a hipidos
      br(p, -1.6, -.12, -2.5); p.cab = .9; p.tx = enc + .3 + sob * .08; p.kx = .22; p.cz = tr * .008 * (1 + sob * 2); p.hIz = .08 + tr * .02 * sob; p.hDz = -.08 - tr * .02 * sob; p.y = -.04 - sob * .02; p.sq = 1 + tr * .008 * sob * 3; },

    /* ── comunicación y actitud ── */
    provocar: (p, s) => { const bk = Math.sin(tq * 6), hp = Math.sin(tq * 3);                                  // "ven, ven": llama con una mano, la otra en la cadera, caderas desafiantes
      p.hDx = -1.35; p.hDz = .2; p.cD = -1.0 - (bk * .5 + .5) * 1.0; p.hIx = .15; p.hIz = -.6; p.cI = -1.9; p.cz = hp * .09; p.tz = -hp * .1; p.tx = enc - .1; p.kx = -.12; p.kz = hp * .12; p.ky = hp * .2; p.sx = hp * .03; p.y = Math.abs(Math.sin(tq * 3)) * .02; },
    burla: (p, s) => { const w = Math.sin(tq * 9), bb = Math.sin(tq * 4.5);                                     // "nananá": manos aleteando junto a las orejas, la cabeza bamboleando
      p.hIx = p.hDx = -2.2; p.hIz = -.85 - w * .12; p.hDz = .85 + w * .12; p.cI = p.cD = -2.4 - w * .3; p.kz = bb * .3; p.ky = bb * .3; p.kx = -.1; p.tz = -bb * .08; p.cz = bb * .06; p.y = Math.abs(bb) * .04; p.tx = enc - .08; },
    reirse: (p, s) => { const l = Math.sin(tq * 17), m = Math.sin(tq * 3);                                      // doblado de la risa, la mano en la panza, cuerpo que salta
      p.tx = enc + .4 + l * .05; p.kx = -.3 + l * .04; p.hDx = -.55; p.hDz = .08; p.cD = -2.1; p.hIx = .1; p.hIz = -.25; p.cI = -.3; p.y = Math.abs(l) * .05 - .03; p.sq = 1 + l * .02; p.cz = m * .05; p.tz = m * .04; pn(p, -.15, .3, .1); p.ty = m * .12; },
    senalar: (p, s) => { const st = Math.pow(Math.max(0, Math.sin(tq * 2.2)), 3);                                // señala con el brazo estirado, dando un empujoncito
      p.hDx = -1.58 - st * .12; p.hDz = .12; p.cD = -.04; p.hIx = .12; p.hIz = -.5; p.cI = -1.9; p.tx = enc + .1 + st * .06; p.ky = .1; p.kz = .05; p.ty = -.2; p.mDx = -.1; p.y = -.005; },
    asentir: (p, s) => { const n = Math.sin(tq * 6), q = Math.sin(tq * 2.1);                                    // "sí, sí": asiente con la cabeza y un poco el torso
      ANIMS.quieto(p, s); p.kx = .12 + n * .18; p.tx = enc + .03 + n * .025; p.ky = q * .06; },
    negar: (p, s) => { const n = Math.sin(tq * 6.4);                                                            // "no, no": niega con la cabeza y los hombros
      ANIMS.quieto(p, s); p.ky = n * .5; p.kz = -n * .05; p.ty = n * .1; p.tx = enc - .02; p.hIz = -.3; p.hDz = .3; p.cI = p.cD = -.9 - n * .1; },
    animar: (p, s) => { const w = Math.sin(tq * 9), j = Math.abs(Math.sin(tq * 4.5));                            // hincha de la barra: brazos arriba alternados, saltitos
      p.cab = .5; p.hIx = -2.6 + w * .5; p.hDx = -2.6 - w * .5; p.hIz = -.55 - w * .12; p.hDz = .55 - w * .12; p.cI = p.cD = -.3; p.y = j * .2; p.sq = 1 + (j - .5) * .06; p.kx = -.2; p.tz = w * .08; p.cz = -w * .06; p.ky = w * .2; pn(p, -j * .25, j * .5, .1); },
    cubrirse: (p, s) => { const tr = Math.sin(tq * 22);                                                         // agachado con los antebrazos sobre la cabeza
      p.y = -.2; pn(p, -.75, 1.5, .12); p.tx = enc + .55; br(p, -2.2, .2, -2.35); p.cab = .8; p.kx = .25; p.cz = tr * .01; p.sq = .97 + tr * .005; },
    aturdido: (p, s) => { const o = Math.sin(tq * 1.7), o2 = Math.cos(tq * 1.7), b = Math.sin(tq * 3.4);          // en las nubes tras el golpe: la cabeza dibuja círculos y las rodillas fallan
      p.tx = enc + o2 * .08; p.tz = o * .09; p.cz = -o * .06; p.kx = o2 * .22; p.kz = o * .3; p.ky = o * .4; br(p, o * .2, .35, -.35); p.hIx = o2 * .3; p.hDx = -o2 * .3; p.y = -.04 + b * .02; p.rI = Math.max(0, b) * .35 + .1; p.rD = Math.max(0, -b) * .35 + .1; p.mIx = o * .1; p.mDx = -o * .1; },
    asombrado: (p, s) => { const b = Math.sin(tq * 2.3); ANIMS.quieto(p, s); p.hIz = -.6; p.hDz = .6; p.hIx = p.hDx = -.4; p.cI = p.cD = -.8; p.kx = -.18; p.tx = enc - .1; p.y = b * .01; },

    /* ── bordes, paredes y equilibrio al límite ── */
    borde: (p, s) => { const c = (tq * .42) % 1, res = c > .7 && c < .86 ? Math.sin((c - .7) / .16 * Math.PI) : 0, tr = Math.sin(tq * 26) * .012 * (1 + res * 2), pa = Math.sin(tq * 7), pb = Math.sin(tq * 7 + 2.1), k = 1 + res * 1.6;   // agarrado de un borde con las dos manos, las piernas buscando apoyo; de a ratos la derecha se resbala y se recupera
      p.cab = .7; p.hIx = -3.0 + tr * 2; p.hDx = -3.0 + res * .8 + tr * 2; p.hIz = -.14; p.hDz = .14; p.cI = -.25 - Math.max(0, pb) * .2; p.cD = -.25 - res * .35 - Math.max(0, pa) * .2;
      p.y = -.04 - res * .1; p.sq = 1.03 - res * .02; p.tx = enc - .12 + res * .1; p.kx = -.45 - res * .1; p.cz = tr * 1.5 + res * .05; p.tz = res * .06; p.mIx = -.55 + pa * .45 * k; p.mDx = -.55 - pb * .4 * k;
      p.rI = .8 + Math.max(0, pa) * .7 * k; p.rD = .8 + Math.max(0, pb) * .7 * k; p.ky = res * .25; },
    pared: (p, s) => { p.cab = .5; const c = (tq * .55) % 1, v = c < .86 ? sua(c / .86) : 1 - sua((c - .86) / .14), j = Math.sin(tq * 31) * .01;   // pegado a la pared, resbala despacio y a cada rato se reagarra de golpe
      p.hIx = -2.7 + v * .55; p.hDx = -2.55 + v * .5; p.hIz = -.25; p.hDz = .25; p.cI = -.3 - v * .4; p.cD = -.3 - v * .4; p.tx = enc + .12; p.kx = -.3; p.y = -.05 - v * .07 + j; p.mIx = -.3 + v * .1; p.mDx = -.5; p.rI = .5; p.rD = .9 + v * .2;
      p.mIz = -.2; p.mDz = .2; p.cz = j * 2; p.ky = Math.sin(tq * 1.7) * .25; p.sq = 1 + j; },
    tambalear: (p, s) => { const w = Math.sin(tq * 3.4), a = tq * 7, r = Math.sin(tq * 9);   // al filo de caer: el torso va y viene y los brazos giran como molino para recuperar el equilibrio
      p.tx = enc + w * .5; p.kx = -w * .22; p.hIx = -1.3 + Math.cos(a) * 1.3; p.hDx = -1.3 - Math.cos(a) * 1.3; p.hIz = -.85; p.hDz = .85; p.cI = p.cD = -.35; p.mIx = -.2 + w * .3; p.mDx = .35 - w * .2; p.rI = .3 + Math.max(0, w) * .5; p.rD = .3 + Math.max(0, -w) * .3;
      p.mIz = -.15; p.mDz = .15; p.y = -.05 + Math.abs(r) * .01; p.cz = Math.sin(tq * 6.8) * .08; p.tz = -p.cz * 1.2; p.ky = Math.sin(tq * 3.1) * .3; },
    retroceder: (p, s) => { const k = s.k, f = tri(fase), c = Math.cos(fase), a = (.34 + .22 * s.vel) * k;   // de espaldas: el pie apoyado va hacia adelante; mira por encima del hombro adonde va
      p.mIx = -f * a; p.mDx = f * a; p.rI = Math.max(0, -c) * .6 * (.5 + .5 * k) + .08; p.rD = Math.max(0, c) * .6 * (.5 + .5 * k) + .08; p.hIx = f * (a + .08); p.hDx = -f * (a + .08); p.hIz = -.12; p.hDz = .12; p.cI = -.3 - s.vel * .1; p.cD = -.3 - s.vel * .1;
      p.y = -.62 * (1 - Math.cos(a * f)) * .92 + .004; p.ty = -f * .12 * k; p.cy = f * .08 * k; p.ky = .55 + p.ty * .5 + Math.sin(tq * 1.9) * .15; p.tx = enc - .05 - .05 * s.vel; p.kx = -.04; p.tz = c * .03 * k; p.cz = -c * .03 * k; },

    /* ── remar, pescar, carretilla ── */
    remar: (p, s) => { const u = (tq * .55) % 1, r = u < .4 ? sua(u / .4) : 1 - sua((u - .4) / .6);                // sentado: la palada es rápida (se echa atrás y recoge), la vuelta lenta y estirada
      p.y = -.24 + r * .01; p.mIx = p.mDx = -1.5 + r * .25; p.rI = p.rD = 1.5 - r * .6; p.mIz = -.1; p.mDz = .1; p.tx = enc + .5 - r * .85; p.hIx = p.hDx = -1.4 + r * .9; p.hIz = -.12 - r * .05; p.hDz = .12 + r * .05;
      p.cI = p.cD = -.15 - r * 1.9; p.kx = -.12 - r * .08; p.cz = Math.sin(tq * 1.1) * .02; p.sq = 1 + r * .012; p.ty = Math.sin(tq * 1.1 * Math.PI) * .05; },
    pescar: (p, s) => { const c = tq % 7, tir = c > 5.2 && c < 6.4 ? Math.sin((c - 5.2) / 1.2 * Math.PI) : 0, pic = c > 3.1 && c < 3.7 ? Math.sin((c - 3.1) / .6 * Math.PI) : 0, w = Math.sin(tq * .8), a = tq * 7 * (tir > .02 ? 1 : 0);   // la caña en la derecha, la otra mano en el carrete: espera, siente un picotazo y de repente tira y recoge
      p.hDx = -1.2 - tir * .55 + Math.sin(tq * 22) * pic * .05; p.hDz = .22; p.cD = -.9 - tir * .55; p.hIx = -.85 + Math.cos(a) * .12 * tir; p.hIz = -.15; p.cI = -1.5 + Math.sin(a) * .3 * tir;
      p.tx = enc + .12 - tir * .3; p.kx = .22 - tir * .2 - pic * .05; p.tz = w * .03; p.cz = -p.tz; pn(p, -.08, .1, .1); p.y = -.02 - tir * .035; p.ky = Math.sin(tq * .45) * .1; },
    carretilla: (p, s) => { const f = Math.sin(fase) * Math.max(.3, s.vel), b = Math.abs(f);                            // empuja la carretilla: manos a la altura de la cadera, cuerpo inclinado y sudando
      p.tx = enc + .5; br(p, -.62, .12, -.35); p.mIx = f * .6 + .2; p.mDx = -f * .6 + .2; p.rI = .35 + Math.max(0, f) * .8; p.rD = .35 + Math.max(0, -f) * .8; p.kx = -.38; p.y = -.1 + b * .03; p.cz = f * .04; p.tz = -f * .03; },
    carga_tiro: (p, s) => { const v = cl(s.vel, 0, 1), tr = Math.sin(tq * 26) * v;                                      // arma un tiro: más vel = más torsión y más tensión (suéltalo con lanzar_arriba)
      p.ty = -.2 - .5 * v; p.tx = enc - .08 - .22 * v; p.hDx = -2.0 - .55 * v; p.hDz = .4; p.cD = -1.5 - .3 * v + tr * .04; p.hIx = -1.2; p.hIz = -.3; p.cI = -.25; p.y = -.06 - v * .1; p.mIx = -.4 * v; p.mDx = .3 * v; p.rI = .25 * v + .05; p.rD = .35 * v + .05;
      p.mIz = -.12 * v; p.mDz = .12 * v; p.ky = .15 + .4 * v; p.kx = -.05; p.cz = tr * .012; },
    halar_fuerte: (p, s) => { const e = Math.max(.5, s.vel), h = Math.pow(Math.max(0, Math.sin(tq * 4.2)), 2) * e, sh = Math.sin(tq * 30);   // tirón a muerte: pierna de atrás recta, la de adelante flexionada, cuerpo echado y a cada tirón se hunde
      p.tx = enc - .5 - .22 * h; p.cx = -.14; br(p, -1.45 + h * .55, .12, -.5 - h * 1.2); p.mIx = -.75; p.rI = 1.0; p.mDx = .55; p.rD = .25; p.mIz = -.16; p.mDz = .16; p.y = -.2 - h * .045;
      p.kx = -.2 + h * .1; p.cz = sh * (.012 + .02 * h); p.ky = sh * .03; p.kz = h * .08; p.sq = 1 - h * .02; },

    /* ── grupo y baile ── */
    grupo_salta: (p, s) => { const u = (relojGrupo() * 1.75) % 1, ar = 4 * u * (1 - u), ag = u < .18 ? 1 - u / .18 : 0, up = u < .22 ? sua(u / .22) : 1, R = Math.min(1.15, PS.rebote);   // saltos de alegría de todos al mismo tiempo (reloj compartido): brazos en alto
      p.cab = .4; p.y = ar * .55 * R - ag * .15; p.sq = 1 - ag * .13 + ar * .1; p.hIx = p.hDx = -2.85 * up + (1 - up) * .4; p.hIz = -.28; p.hDz = .28; p.cI = p.cD = -.15 - (1 - up) * 1.1; pn(p, -ar * .45 - ag * .5, ar * .75 + ag * .9, .08);
      p.tx = enc - ar * .08 + ag * .2; p.kx = -.25 * up; p.kz = Math.sin(u * TAU) * .08 * PS.lado; },
    gatear: (p, s) => { const f = Math.sin(fase) * Math.max(.35, s.vel), c = Math.cos(fase), b = Math.abs(f);          // a gatas: mano y rodilla contrarias avanzan, la espalda se mece y la cabeza va arriba
      p.rx = 1.1; p.ry = -.38; p.hIx = -1.35 - f * .45; p.hDx = -1.35 + f * .45; p.hIz = -.1; p.hDz = .1; p.cI = -.15 - Math.max(0, f) * .6; p.cD = -.15 - Math.max(0, -f) * .6;
      p.mIx = -1.05 + f * .5; p.mDx = -1.05 - f * .5; p.rI = 1.4 + Math.max(0, -f) * .5; p.rD = 1.4 + Math.max(0, f) * .5; p.kx = -.75 + b * .06; p.ty = f * .1; p.tz = c * .03; p.cz = -f * .04; },
    salsa: (p, s) => { const sp = Math.sin(tq * 5), cp = Math.cos(tq * 5);                                              // paso básico: el peso pasa de un pie al otro, caderas en ocho, brazos doblados que se turnan
      p.sx = sp * .05; p.cy = cp * .22; p.cz = sp * .1; p.ty = -cp * .12; p.tz = -sp * .08; p.y = -.04 + Math.abs(cp) * -.02; p.mIz = -.08 - Math.max(0, sp) * .16; p.mDz = .08 + Math.max(0, -sp) * .16; p.rI = .25 + Math.max(0, -sp) * .4; p.rD = .25 + Math.max(0, sp) * .4;
      p.mIx = -Math.max(0, -sp) * .25; p.mDx = -Math.max(0, sp) * .25; p.hIx = -.85 + cp * .35; p.hDx = -.85 - cp * .35; p.hIz = -.5; p.hDz = .5; p.cI = -1.5 + cp * .3; p.cD = -1.5 - cp * .3; p.kz = sp * .08; p.ky = cp * .1; p.kx = -.04; p.tx = enc + .03; },
    robot: (p, s) => { const q = snapQ(ROBOT, tq * 2.6);                                                                  // baile de robot: poses duras que cambian de golpe, cabeza que se traba
      p.hIx = q.hIx; p.hDx = q.hDx; p.hIz = q.hIz; p.hDz = q.hDz; p.cI = q.cI; p.cD = q.cD; p.ky = q.ky; p.kz = q.kz; p.ty = q.ty; p.tz = q.tz; p.tx = enc + q.tx; p.y = -.03 + q.y; p.mIx = p.mDx = -.12; p.rI = p.rD = .25; },
    twist: (p, s) => { const tw = Math.sin(tq * 8.5), bn = Math.sin(tq * 4.25);                                           // twist: bajito, caderas que giran contra los hombros, brazos doblados y rodillas que suben y bajan
      p.y = -.15 + Math.abs(bn) * .045; p.cy = tw * .55; p.ty = -tw * .22; pn(p, -.45, .9, .2); p.hIx = -.7 + tw * .35; p.hDx = -.7 - tw * .35; p.hIz = -.5; p.hDz = .5; p.cI = p.cD = -1.3; p.tx = enc + .12; p.kx = -.1; p.ky = -tw * .2; p.kz = bn * .08; p.sq = 1 + Math.abs(bn) * .012; },
    brincos: (p, s) => { const b = Math.sin(tq * 9), o = (1 + b) / 2, j = Math.abs(Math.cos(tq * 9));                      // saltos de tijera: a cada salto abre piernas y sube los brazos, cierra y baja
      p.y = j * .14; p.hIx = -2.9 * o; p.hDx = -2.9 * o; p.hIz = -.17 - o * .4; p.hDz = .17 + o * .4; p.cI = p.cD = -.1; p.mIz = -.04 - o * .36; p.mDz = .04 + o * .36; p.rI = p.rD = j * .35 + .08; p.tx = enc; p.sq = 1 + (j - .5) * .05; p.kx = -.1 * o; }
  };
  // en qué cara se queda una animación si el juego no puso otra (cara 'normal'); y qué efecto lleva encima
  const ANIM_CARA = { cansado: 'cansado', pesado: 'esfuerzo', asustado: 'miedo', sigilo: 'concentrado', preparado: 'concentrado', equilibrio: 'esfuerzo', jadeo: 'cansado', forcejear: 'esfuerzo', halar: 'esfuerzo',
    trepar: 'esfuerzo', colgar: 'esfuerzo', resbalar: 'miedo', nadar: 'concentrado', chapotear: 'feliz', montar: 'feliz', impaciente: 'aburrido', pensar: 'pensando', revolver: 'concentrado', dormitar: 'sueno', dormir: 'dormido',
    sentado_celebra: 'feliz', sentado_miedo: 'miedo', sentado_aburrido: 'aburrido', sentado_enojado: 'enojado', victoria: 'feliz', campeon: 'orgulloso', ganador: 'feliz', rodillas: 'feliz', derrota: 'triste', rabieta: 'gritando',
    desplome: 'llorando', lloron: 'llorando', provocar: 'picaro', burla: 'burla', reirse: 'risa', senalar: 'concentrado', animar: 'feliz', cubrirse: 'dolor', aturdido: 'mareado', asombrado: 'sorpresa',
    borde: 'miedo', pared: 'miedo', tambalear: 'miedo', remar: 'esfuerzo', pescar: 'concentrado', carretilla: 'esfuerzo', carga_tiro: 'esfuerzo', halar_fuerte: 'esfuerzo', grupo_salta: 'feliz', gatear: 'concentrado', salsa: 'feliz', twist: 'feliz', brincos: 'feliz' };
  const ANIM_FX = { cansado: 'gota', jadeo: 'gota', asustado: 'gota', dormir: 'zetas', dormitar: 'zetas', aturdido: 'estrellas', pensar: 'interr', cubrirse: 'gota', borde: 'gota', tambalear: 'gota', halar_fuerte: 'gota', carretilla: 'gota', salsa: 'notas', twist: 'notas', robot: 'notas' };

  /* ───────────── gestos de una vez ───────────── */
  // Los 9 de siempre son funciones f(p, u). Los nuevos son fotogramas clave por tecla: U(dur, [[u, {tecla: valor}, ease?], ...], extra). Cada tecla interpola solo
  // entre los fotogramas que la nombran (0 si no aparece ni al principio ni al final); ease: 's' suave (por defecto), 'o' pasa de largo y vuelve (sobreimpulso), 'i' entra acelerando, 'l' lineal.
  // extra = { cara: [[u, 'cara'], ...], fx: 'estrellas', x: (p, u, w) => {...} (oscilaciones), fin: true (el último fotograma es la pose en bucle viva) }
  const easeF = { s: sua, l: (k) => k, i: (k) => k * k, o: (k) => { k = cl(k, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); } };
  function U(dur, kf, ex) {
    const tr = {}; for (const fr of kf) for (const k in fr[1]) (tr[k] || (tr[k] = [])).push([fr[0], fr[1][k], fr[2] || 's']);
    const fin = ex && ex.fin;
    for (const k in tr) { const a = tr[k]; if (a[0][0] > 0) a.unshift([0, k === 'sq' ? 1 : 0, 's']); if (!fin && a[a.length - 1][0] < 1) a.push([1, k === 'sq' ? 1 : 0, 's']); }
    return Object.assign({ dur: dur, tr: tr }, ex || {});
  }
  function evalTr(tr, u, base) {                    // valor de una tecla en u
    const n = tr.length; if (u <= tr[0][0]) return tr[0][1];
    for (let i = 1; i < n; i++) if (u <= tr[i][0]) { const a = tr[i - 1], b = tr[i]; return lerp(a[1], b[1], (easeF[b[2]] || sua)((u - a[0]) / Math.max(1e-4, b[0] - a[0]))); }
    const l = tr[n - 1]; if (base != null && l[0] < 1) return lerp(l[1], base, sua((u - l[0]) / (1 - l[0]))); return l[1];
  }
  const cabezas = (a) => a;                         // (solo para legibilidad de los fotogramas)
  const UNOS = {
    saltar: { dur: .75, f: (p, u) => { const uu = cl((u - .14) / .72, 0, 1), h = Math.sin(uu * Math.PI), ag = u < .14 ? sua(u / .14) : 0;   // agacha, estira al despegar, recoge en el aire, aplasta al caer
      p.y = h * 1.1; p.sq = u < .14 ? 1 - ag * .24 : u < .24 ? .76 + sua((u - .14) / .1) * .4 : u > .86 ? .82 + sua((u - .86) / .14) * .18 : 1 + h * .1; p.tx = ag * .3 - h * .1;
      p.mIx = -h * .7 - ag * .4; p.mDx = -h * .3 - ag * .4; p.rI = p.rD = h * .9 + ag * .8; p.hIx = p.hDx = u < .14 ? ag * .6 : -h * 2.4; p.hIz = -.6 * h; p.hDz = .6 * h; } },
    lanzar: { dur: .62, f: (p, u) => { if (u < .3) { const a = sua(u / .3);                                  // anticipación: brazo atrás y arriba, torso torcido hacia atrás
        p.hDx = -2.6 * a; p.cD = -1.8 * a; p.ty = -.5 * a; p.tx = -.25 * a; p.mIx = -.35 * a; p.mDx = .3 * a; p.hDz = .4 * a; }
      else if (u < .5) { const b = sua((u - .3) / .2);                                                      // el latigazo
        p.hDx = -2.6 + 2.4 * b; p.cD = -1.8 * (1 - b); p.ty = -.5 + .9 * b; p.tx = -.25 + .55 * b; p.mIx = -.35; p.mDx = .3; p.hDz = .4 * (1 - b); p.y = .04 * b; }
      else { const c = 1 - sua((u - .5) / .5); p.hDx = -.2 * c; p.ty = .4 * c; p.tx = .3 * c; p.mIx = -.35 * c; p.mDx = .3 * c; } }, cara: [[0, 'concentrado'], [.5, 'normal']] },
    golpe: { dur: .7, f: (p, u) => { const a = u < .1 ? u / .1 : Math.exp(-(u - .1) * 4) * Math.cos((u - .1) * 9);   // lo golpean: se dobla de golpe y rebota con resorte
      p.tx = -.5 * a; p.kx = -.35 * a; p.hIx = p.hDx = -1.5 * a; p.hIz = -.95 * a; p.hDz = .95 * a; p.y = Math.max(0, a) * .12; p.cz = Math.sin(u * 22) * .09 * Math.max(0, a); p.sq = 1 - (u < .22 ? Math.sin(u / .22 * Math.PI) * .12 : 0); }, cara: [[0, 'dolor'], [.55, 'normal']], parp: 1 },
    caer: { dur: 1.1, f: (p, u) => { const a = u < .2 ? sua(u / .2) : u > .8 ? (1 - u) / .2 : 1;
      p.tx = -1.3 * a; p.y = -.45 * a; p.mIx = p.mDx = -1.2 * a; p.hIx = p.hDx = -2.6 * a; p.hIz = -.5 * a; p.hDz = .5 * a; p.kx = -.3 * a;
      p.sq = u > .2 && u < .4 ? 1 - .15 * Math.sin((u - .2) / .2 * Math.PI) : 1; p.cz = u > .2 && u < .5 ? Math.sin((u - .2) * 30) * .05 * (1 - (u - .2) / .3) : 0; }, cara: [[0, 'susto'], [.25, 'mareado'], [.85, 'normal']], parp: 1 },
    festejo: { dur: 1.05, f: (p, u) => { const uu = cl((u - .1) / .78, 0, 1), h = Math.sin(uu * Math.PI);
      p.y = h * 1.0; p.ty = uu * TAU; p.hIx = p.hDx = -2.9; p.hIz = -.45; p.hDz = .45; p.rI = p.rD = h * .8; p.sq = u < .1 ? 1 - sua(u / .1) * .15 : u > .9 ? .86 + sua((u - .9) / .1) * .14 : 1 + h * .12; }, cara: [[0, 'feliz']] },
    pegar: { dur: .62, f: (p, u) => { if (u < .3) { const a = sua(u / .3);                                  // golpea: se echa atrás, aprieta y suelta el puño
        p.tx = -.3 * a; p.ty = .35 * a; p.hDx = -2.4 * a; p.cD = -1.2 * a; p.hDz = .5 * a; p.mIx = -.3 * a; p.mDx = .3 * a; p.sq = 1 - .06 * a; }
      else if (u < .46) { const b = sua((u - .3) / .16);
        p.tx = -.3 + .8 * b; p.ty = .35 - .7 * b; p.hDx = -2.4 + .9 * b; p.cD = -1.2 + 1.1 * b; p.hDz = .5 * (1 - b); p.mIx = -.3; p.mDx = .3; p.y = .06 * b; }
      else { const c = 1 - sua((u - .46) / .54); p.tx = .5 * c; p.ty = -.35 * c; p.hDx = -1.5 * c; p.cD = -.1 * c; p.mIx = -.3 * c; p.mDx = .3 * c; } }, cara: [[0, 'enojado'], [.75, 'normal']] },
    esquivar: { dur: .5, f: (p, u) => { const s = Math.sin(u * Math.PI); p.cz = -.25 * s; p.tz = .4 * s; p.ty = .3 * s; p.y = .12 * s; p.sq = 1 - .1 * s; p.hIz = -.7 * s; p.hDz = .7 * s; p.hIx = -.6 * s; p.hDx = -.3 * s; p.mIx = -.4 * s; p.rI = .5 * s; }, cara: [[0, 'concentrado'], [.7, 'normal']] },
    susto: { dur: .65, f: (p, u) => { const a = u < .15 ? sua(u / .15) : Math.max(0, 1 - sua((u - .15) / .85));   // salta de la impresión
      p.y = a * .4; p.hIx = p.hDx = -2.0 * a; p.hIz = -.65 * a; p.hDz = .65 * a; p.cI = p.cD = -.7 * a; p.kx = -.3 * a; p.tx = -.25 * a; p.sq = 1 + (u < .2 ? a * .1 : -Math.sin(cl((u - .2) / .3, 0, 1) * Math.PI) * .05); p.rI = p.rD = .3 * a; }, cara: [[0, 'susto'], [.7, 'normal']], fx: 'excl', parp: 1 },
    tropezar: { dur: .85, f: (p, u) => { const a = u < .4 ? sua(u / .4) : Math.max(0, 1 - sua((u - .4) / .6));
      p.tx = .65 * a; p.hIx = p.hDx = -1.9 * a; p.hIz = -.5 * a; p.hDz = .5 * a; p.mIx = -.9 * a; p.mDx = .2 * a; p.rI = .6 * a; p.y = a * .05; p.kx = -.3 * a; p.cz = Math.sin(u * 18) * .05 * a; }, cara: [[0, 'susto'], [.5, 'normal']] },

    /* ── lanzar, patear, cabecear, atrapar ── */
    lanzar_arriba: U(.85, [[.14, { tx: .12, y: -.05 }], [.38, { tx: -.38, ty: -.6, hDx: -2.9, hDz: .6, cD: -1.9, hIx: -1.3, hIz: -.5, cI: -.4, mIx: -.5, mDx: .45, rI: .3, y: -.05, kx: -.1 }],
      [.5, { tx: .6, ty: .55, hDx: -1.25, hDz: .1, cD: -.1, hIx: .3, hIz: -.6, mIx: .5, mDx: -.65, rD: .2, y: .06, kx: .1 }, 'o'], [.72, { tx: .5, ty: .35, hDx: .15, cD: -.2, hIx: .3, mIx: .35, mDx: -.5, y: 0 }]],
      { cara: [[0, 'concentrado'], [.5, 'esfuerzo'], [.8, 'normal']] }),
    lanzar_abajo: U(.8, [[.3, { tx: .5, y: -.2, ty: .25, hDx: .95, hDz: .12, cD: -.3, hIx: -.6, hIz: -.5, mIx: -.9, mDx: .55, rI: 1.1, rD: .55, kx: -.2 }],
      [.5, { tx: .4, y: -.14, ty: -.25, hDx: -1.7, cD: -.15, hIx: -.4, mIx: -.9, mDx: .5, rI: 1.0, kx: -.15 }, 'o'], [.72, { tx: .15, ty: -.1, hDx: -2.1, cD: -.1, y: -.03, mIx: -.5, mDx: .3 }]], { cara: [[0, 'concentrado'], [.75, 'feliz']] }),
    lanzar_lado: U(.7, [[.32, { ty: -.85, tx: .1, hDx: -1.1, hDz: -.5, cD: -1.6, hIx: -.5, hIz: -.7, mIx: -.35, mDx: .4, y: -.04 }],
      [.5, { ty: .75, tx: .15, hDx: -1.4, hDz: 1.5, cD: -.12, hIx: -.4, hIz: -.9, mIx: .35, mDx: -.4, y: .02 }, 'o'], [.72, { ty: .4, hDx: -1.3, hDz: 1.3, cD: -.3, mIx: .2, mDx: -.2 }]], { cara: [[0, 'concentrado'], [.7, 'normal']] }),
    empujon: U(.6, [[.22, { tx: -.18, y: -.07, hIx: -.5, hDx: -.5, hIz: -.3, hDz: .3, cI: -2.0, cD: -2.0, mIx: .35, mDx: -.25, rI: .3, rD: .55, kx: .1 }],
      [.4, { tx: .68, hIx: -1.55, hDx: -1.55, hIz: -.15, hDz: .15, cI: -.12, cD: -.12, mIx: -.55, mDx: .55, rI: .5, y: .03, kx: -.15 }, 'o'], [.62, { tx: .55, hIx: -1.4, hDx: -1.4, cI: -.25, cD: -.25, mIx: -.5, mDx: .5, rI: .45 }]], { cara: [[0, 'concentrado'], [.35, 'esfuerzo'], [.7, 'normal']] }),
    patear: U(.9, [[.26, { mDx: 1.15, rD: 1.7, tx: -.14, hIx: -.7, hIz: -.9, hDx: .5, hDz: .7, cI: -.3, cD: -.3, y: -.04, mIx: .1, rI: .2, kx: .05 }],
      [.42, { mDx: -1.6, rD: .08, tx: .36, hIx: .55, hIz: -.7, hDx: -1.0, hDz: .55, mIx: .15, rI: .35, y: -.01, kx: -.05 }, 'o'], [.64, { mDx: -1.95, rD: .05, tx: .48, hIx: .6, hDx: -.9, hDz: .45, mIx: .1, rI: .4, y: .13 }],
      [.82, { mDx: -.9, rD: .8, tx: .15, hIx: .1, hDx: -.2, hIz: -.7, hDz: .7, mIx: 0, rI: .15 }]], { cara: [[0, 'concentrado'], [.45, 'esfuerzo'], [.8, 'feliz']] }),
    cabecear: U(.85, [[.2, { y: -.22, tx: .15, hIx: -.4, hDx: -.4, hIz: -.6, hDz: .6, cI: -.8, cD: -.8, mIx: -.7, mDx: -.7, rI: 1.1, rD: 1.1, sq: .92 }],
      [.4, { y: .5, tx: -.5, kx: -.35, hIx: -1.1, hDx: -1.1, hIz: -1.0, hDz: 1.0, cI: -.4, cD: -.4, mIx: .35, mDx: .35, rI: 1.0, rD: 1.0, sq: 1.08 }, 'o'],
      [.5, { y: .6, tx: .78, kx: .5, hIx: .2, hDx: .2, hIz: -.7, hDz: .7, mIx: .15, mDx: .15, rI: .8, rD: .8, sq: 1.04 }, 'o'], [.72, { y: 0, tx: .25, kx: .1, hIx: -.2, hDx: -.2, hIz: -.5, hDz: .5, mIx: -.5, mDx: -.5, rI: 1.0, rD: 1.0, sq: .86 }]],
      { cara: [[0, 'concentrado'], [.45, 'esfuerzo'], [.8, 'feliz']] }),
    atrapar: U(.75, [[.16, { hIx: -1.5, hDx: -1.5, hIz: -.4, hDz: .4, cI: -.2, cD: -.2, tx: .1, kx: -.05 }], [.4, { hIx: -1.35, hDx: -1.35, hIz: -.25, hDz: .25, cI: -.55, cD: -.55, tx: .05 }, 'o'],
      [.58, { hIx: -.95, hDx: -.95, hIz: -.1, hDz: .1, cI: -2.1, cD: -2.1, tx: .3, y: -.1, mIx: -.35, mDx: -.35, rI: .7, rD: .7, sq: .96, kx: .12 }]], { cara: [[0, 'concentrado'], [.45, 'feliz']] }),

    /* ── esquivar en todas las direcciones ── */
    esquivar_izq: U(.6, [[.2, { px: -.52, rz: .3, tz: -.1, cz: .1, mIz: -.55, mDz: -.2, hIz: -.9, hDz: .5, hIx: -.5, hDx: -.3, cI: -.6, cD: -.5, y: -.04, sq: .97 }, 'o'], [.5, { px: -.5, rz: .26, tz: -.08, mIz: -.4, hIz: -.8, hDz: .5, y: -.02 }]], { cara: [[0, 'concentrado'], [.7, 'normal']] }),
    esquivar_der: U(.6, [[.2, { px: .52, rz: -.3, tz: .1, cz: -.1, mDz: .55, mIz: .2, hDz: .9, hIz: -.5, hIx: -.3, hDx: -.5, cI: -.5, cD: -.6, y: -.04, sq: .97 }, 'o'], [.5, { px: .5, rz: -.26, tz: .08, mDz: .4, hDz: .8, hIz: -.5, y: -.02 }]], { cara: [[0, 'concentrado'], [.7, 'normal']] }),
    esquivar_abajo: U(.7, [[.2, { y: -.38, tx: .6, kx: .1, hIx: -.9, hDx: -.9, hIz: -.35, hDz: .35, cI: -1.5, cD: -1.5, mIx: -1.0, mDx: -1.0, rI: 1.9, rD: 1.9, sq: .93 }, 'o'], [.55, { y: -.36, tx: .62, hIx: -.95, hDx: -.95, mIx: -1.0, mDx: -1.0, rI: 1.9, rD: 1.9 }]], { cara: [[0, 'concentrado'], [.75, 'normal']] }),
    esquivar_salto: U(.7, [[.14, { y: -.2, mIx: -.5, mDx: -.5, rI: 1.0, rD: 1.0, tx: .2, sq: .9 }], [.4, { y: .78, mIx: -1.35, mDx: -1.35, rI: 1.7, rD: 1.7, tx: .25, hIx: -.5, hDx: -.5, hIz: -1.0, hDz: 1.0, cI: -.5, cD: -.5, sq: 1.1 }, 'o'],
      [.62, { y: .5, mIx: -1.0, mDx: -1.0, rI: 1.4, rD: 1.4, tx: .15, hIz: -.9, hDz: .9 }], [.82, { y: -.06, mIx: -.5, mDx: -.5, rI: 1.0, rD: 1.0, sq: .88 }]], { cara: [[0, 'concentrado'], [.5, 'sorpresa'], [.85, 'normal']] }),
    cubrir: U(.8, [[.12, { y: -.2, tx: .5, sq: .93, hIx: -2.3, hDx: -2.3, hIz: -.4, hDz: .4, cI: -2.3, cD: -2.3, mIx: -.7, mDx: -.7, rI: 1.4, rD: 1.4, kx: .25 }, 'o'], [.55, { y: -.18, tx: .45, hIx: -2.3, hDx: -2.3, hIz: -.4, hDz: .4, cI: -2.3, cD: -2.3, mIx: -.7, mDx: -.7, rI: 1.4, rD: 1.4, kx: .25 }]], { cara: [[0, 'dolor'], [.6, 'normal']], parp: 1 }),

    /* ── gestos de cuerpo y cara ── */
    si: U(.75, [[.14, { kx: .3, tx: .04 }], [.3, { kx: -.08 }], [.48, { kx: .28, tx: .04 }], [.66, { kx: -.04 }]], { cara: [[0, 'feliz'], [.8, 'normal']] }),
    no: U(.85, [[.13, { ky: .55, kz: -.05, ty: .1 }], [.3, { ky: -.55, kz: .05, ty: -.1 }], [.48, { ky: .5, kz: -.05, ty: .1 }], [.66, { ky: -.4, ty: -.07 }], [.82, { ky: .1 }]], { cara: [[0, 'asco'], [.85, 'normal']] }),
    encoger: U(.95, [[.2, { y: .035, hIz: -.55, hDz: .55, cI: -1.0, cD: -1.0, hIx: -.35, hDx: -.35, kz: .17, kx: -.08, sq: .985, tz: .05 }, 'o'], [.65, { y: .03, hIz: -.55, hDz: .55, cI: -1.0, cD: -1.0, hIx: -.35, hDx: -.35, kz: .17, sq: .985, tz: .05 }]], { cara: [[0, 'pensando'], [.8, 'normal']], fx: 'interr' }),
    facepalm: U(1.1, [[.25, { hDx: -2.25, hDz: .7, cD: -1.9, kx: .28, tx: .2, kz: -.1, cab: .8, hDz: .2 }, 'o'], [.78, { hDx: -2.25, hDz: .7, cD: -1.9, kx: .28, tx: .22, y: -.02, kz: -.1, cab: .8, hDz: .2 }]], { cara: [[0, 'aburrido'], [.9, 'normal']] }),
    sorpresa: U(.7, [[.1, { y: .16, tx: -.3, hIx: -1.4, hDx: -1.4, hIz: -.75, hDz: .75, cI: -.8, cD: -.8, kx: -.2, sq: 1.06 }, 'o'], [.55, { y: 0, tx: -.12, hIx: -1.1, hDx: -1.1, hIz: -.6, hDz: .6, cI: -.8, cD: -.8, kx: -.12 }]], { cara: [[0, 'sorpresa'], [.8, 'normal']], fx: 'excl', parp: 1 }),
    saludo: U(1.3, [[.16, { hDx: -2.6, hDz: .35, cD: -.65, kz: -.1, kx: -.08 }], [.3, { hDz: .9, cD: -.2 }], [.44, { hDz: .35, cD: -.9 }], [.58, { hDz: .9, cD: -.2 }], [.72, { hDz: .35, cD: -.8 }], [.86, { hDx: -2.6, hDz: .5, cD: -.5 }]], { cara: [[0, 'feliz'], [.9, 'normal']] }),
    bostezo: U(2.0, [[.22, { kx: -.45, tx: -.12, hIx: -.6, hDx: -.6, hIz: -.5, hDz: .5, cI: -.5, cD: -.5, y: .02, sq: 1.02 }], [.62, { kx: -.5, tx: -.15, hIx: -.7, hDx: -.7, hIz: -.55, hDz: .55, sq: 1.025 }], [.82, { kx: .15, tx: .12, sq: .985, y: -.02 }]],
      { cara: [[.12, 'bostezo'], [.8, 'cansado'], [.95, 'normal']], fx: null }),
    reloj: U(1.7, [[.2, { hIx: -1.35, hIz: -.12, cI: -2.2, kx: .22, ky: .12, tx: .06 }, 'o'], [.55, { hIx: -1.35, hIz: -.12, cI: -2.2, kx: .24, ky: .12, tx: .08 }], [.68, { hIx: -.9, cI: -1.2, kx: -.05, ky: .0, tx: -.04, y: -.015 }],
      [.82, { kz: .1, ky: .4 }]], { cara: [[0, 'aburrido'], [.95, 'normal']] }),
    estirarse: U(2.2, [[.28, { hIx: -2.95, hDx: -2.95, hIz: -.3, hDz: .3, cI: -.1, cD: -.1, tx: -.3, kx: -.35, y: .03, sq: 1.04, mIx: -.1, mDx: -.1 }], [.6, { hIx: -3.0, hDx: -3.0, hIz: -.25, hDz: .25, tx: -.34, kx: -.38, sq: 1.05, y: .04, kz: .05 }],
      [.76, { hIx: -.2, hDx: -.2, hIz: -.25, hDz: .25, cI: -.2, cD: -.2, tx: .18, kx: .12, sq: .98, y: -.025 }]], { cara: [[.1, 'bostezo'], [.7, 'feliz'], [.95, 'normal']] }),
    rascarse: U(1.7, [[.18, { hDx: -2.55, hDz: .72, cD: -2.0, kz: .1, tx: .03 }], [.84, { hDx: -2.55, hDz: .72, cD: -2.0, kz: .1 }]],
      { cara: [[0, 'pensando'], [.9, 'normal']], x: (p, u, w) => { const e = w * Math.sin(u * 62); p.cD += e * .18; p.hDz += e * .06; p.kz += e * .04; } }),
    miradas: U(2.1, [[.12, { ky: -.8, ty: -.2 }], [.3, { ky: -.85, ty: -.22 }], [.5, { ky: .85, ty: .22 }], [.68, { ky: .8, ty: .2, kx: -.12 }], [.84, { ky: -.1, kx: .05 }]], { cara: [[0, 'concentrado'], [.9, 'normal']] }),
    aplauso: U(1.0, [[.1, { hIx: -1.3, hDx: -1.3, hIz: -.55, hDz: .55, cI: -1.6, cD: -1.6, y: .03 }], [.2, { hIz: -.12, hDz: .12 }], [.32, { hIz: -.55, hDz: .55, y: .03 }], [.42, { hIz: -.12, hDz: .12 }], [.54, { hIz: -.55, hDz: .55, y: .03 }], [.64, { hIz: -.12, hDz: .12 }], [.86, { hIz: -.4, hDz: .4 }]],
      { cara: [[0, 'feliz'], [.9, 'normal']] }),
    reverencia: U(1.4, [[.22, { tx: -.08, hDx: -.9, hDz: .05, cD: -2.2, hIx: .3, hIz: -.3 }], [.5, { tx: 1.15, kx: .1, hDx: -.9, hDz: .05, cD: -2.2, hIx: .35, hIz: -.3, mIx: -.1, mDx: -.1, y: -.03 }], [.72, { tx: 1.15, kx: .1, hDx: -.9, cD: -2.2, hIx: .35 }]],
      { cara: [[0, 'feliz']] }),
    senal: U(1.0, [[.2, { hDx: -1.95, hDz: .28, cD: -1.5, tx: .06, ky: .1 }], [.4, { hDx: -1.55, hDz: .1, cD: -.05, tx: .14, ky: .1 }, 'o'], [.78, { hDx: -1.55, hDz: .1, cD: -.05, tx: .14, ky: .1 }]], { cara: [[0, 'concentrado'], [.85, 'normal']] }),
    pulgar: U(1.1, [[.22, { hDx: -.95, hDz: .3, cD: -1.75, tx: -.05, kx: -.1 }, 'o'], [.78, { hDx: -.95, hDz: .3, cD: -1.75, tx: -.05, kz: .08 }]], { cara: [[0, 'feliz'], [.35, 'guino'], [.6, 'feliz'], [.9, 'normal']] }),
    guino: U(.9, [[.18, { kz: .2, ky: -.1, tx: -.02 }], [.7, { kz: .2, ky: -.1 }]], { cara: [[0, 'guino'], [.75, 'normal']] }),
    eureka: U(1.2, [[.15, { y: .18, hDx: -2.6, hDz: .15, cD: -.12, kx: -.2, tx: -.1, sq: 1.05 }, 'o'], [.65, { y: 0, hDx: -2.6, hDz: .15, cD: -.12, kx: -.15, tx: -.05 }]], { cara: [[0, 'sorpresa'], [.3, 'feliz'], [.9, 'normal']], fx: 'bombilla' }),
    duda: U(1.3, [[.25, { hIz: -.65, hDz: .65, cI: -1.1, cD: -1.1, hIx: -.4, hDx: -.4, kz: -.2, ky: .15, kx: -.05, y: .02 }], [.7, { hIz: -.6, hDz: .6, cI: -1.1, cD: -1.1, hIx: -.4, hDx: -.4, kz: -.2, ky: -.15 }]], { cara: [[0, 'pensando'], [.9, 'normal']], fx: 'interr' }),
    risa: U(1.5, [[.12, { tx: .3, kx: -.3, hDx: -.55, hDz: .08, cD: -2.1, hIx: .1, hIz: -.25 }], [.8, { tx: .35, kx: -.3, hDx: -.55, hDz: .08, cD: -2.1, hIx: .1, hIz: -.25 }]],
      { cara: [[0, 'risa']], x: (p, u, w) => { const l = Math.sin(u * 120) * w; p.tx += l * .05; p.y += Math.abs(l) * .05; p.sq *= 1 + l * .02; p.kx += l * .05; } }),
    grito: U(1.0, [[.15, { kx: -.1, tx: .12, hIx: -.4, hDx: -.4, cI: -1.4, cD: -1.4, hIz: -.3, hDz: .3, sq: .97 }], [.28, { kx: -.42, tx: -.22, hIx: .35, hDx: .35, cI: -.6, cD: -.6, hIz: -.35, hDz: .35, sq: 1.04, y: .03 }, 'o'], [.75, { kx: -.4, tx: -.2, hIx: .35, hDx: .35, hIz: -.35, hDz: .35, sq: 1.03 }]],
      { cara: [[0, 'gritando'], [.85, 'normal']], x: (p, u, w) => { p.cz += Math.sin(u * 150) * .012 * w; } }),
    puno: U(.8, [[.15, { y: -.06, hDx: .2, cD: -2.0, hDz: .2, tx: .18, sq: .96 }], [.3, { y: .14, hDx: -2.75, cD: -.18, hDz: .25, tx: -.18, kx: -.28, sq: 1.05 }, 'o'], [.6, { y: 0, hDx: -2.65, hDz: .25, cD: -.3, tx: -.1, kx: -.2 }]], { cara: [[0, 'concentrado'], [.25, 'gritando'], [.7, 'feliz']] }),
    chocala: U(.85, [[.2, { hDx: -2.5, hDz: .35, cD: -.3, tx: -.04, kx: -.1 }], [.36, { hDx: -2.75, hDz: .2, cD: -.08, tx: .1, y: .03 }, 'o'], [.62, { hDx: -2.4, hDz: .3, cD: -.5, kz: .07 }]], { cara: [[0, 'feliz']] }),
    derrapar: U(.95, [[.12, { tx: -.35, y: -.1, mIx: -1.0, mDx: .5, rI: .15, rD: .8, hIz: -.9, hDz: .9, hIx: -.3, hDx: -.3, cI: -.4, cD: -.4, kx: -.1, sq: .96 }, 'o'], [.55, { tx: -.28, y: -.11, mIx: -.85, mDx: .45, rI: .15, rD: .7, hIz: -.8, hDz: .8, hIx: -.25, hDx: -.25 }], [.8, { tx: -.08, y: -.03, mIx: -.3, mDx: .2 }]],
      { cara: [[0, 'susto'], [.6, 'normal']], fx: null }),
    giro: U(.6, [[.14, { y: -.08, sq: .94, tx: .15 }], [.6, { ty: TAU * .9, y: .12, sq: 1.04, hIz: -.9, hDz: .9, hIx: -.3, hDx: -.3, cI: -.3, cD: -.3, mIx: -.2, rI: .6, rD: .3 }, 'l'], [.8, { ty: TAU, y: 0, sq: .94, tx: .1 }]], { cara: [[0, 'feliz']] }),

    /* ── acción: voltereta, sacudirse, casco, recoger, izarse, tirón ── */
    voltereta: U(1.0, [[.16, { y: -.22, tx: .7, sq: .92, mIx: -.9, mDx: -.9, rI: 1.6, rD: 1.6, hIx: -1.2, hDx: -1.2, cI: -.8, cD: -.8, kx: .3 }], [.42, { y: -.04, tx: .25, mIx: -1.5, mDx: -1.5, rI: 2.3, rD: 2.3, hIx: -1.35, hDx: -1.35, hIz: -.12, hDz: .12, cI: -1.9, cD: -1.9, kx: .3, sq: .94 }],
      [.66, { y: -.04, tx: .25, mIx: -1.4, mDx: -1.4, rI: 2.2, rD: 2.2, hIx: -1.3, hDx: -1.3, cI: -1.8, cD: -1.8, kx: .25, sq: .95 }], [.82, { y: -.16, tx: .5, mIx: -.9, mDx: -.9, rI: 1.5, rD: 1.5, hIx: -.8, hDx: -.8, cI: -.8, cD: -.8, sq: .9 }]],
      { cara: [[0, 'concentrado'], [.8, 'feliz']], x: (p, u, w) => { const r = sua(cl((u - .2) / .45, 0, 1)); p.rx = TAU * r; p.ry += .3 * Math.sin(Math.PI * r); } }),     // el cuerpo gira entero (rx 0..360°) tal cual: la voltereta compacta, el piso lo levanta y no se mete en él
    sacudirse: U(1.1, [[.12, { y: -.1, tx: .25, sq: .95, hIz: -.3, hDz: .3, cI: -.8, cD: -.8, hIx: -.3, hDx: -.3 }], [.8, { y: -.05, tx: .1, hIz: -.35, hDz: .35, cI: -.9, cD: -.9, hIx: -.3, hDx: -.3 }]],
      { cara: [[0, 'asco'], [.2, 'dolor'], [.85, 'normal']], fx: 'gota', x: (p, u, w) => { const e = Math.sin(Math.PI * cl((u - .1) / .75, 0, 1)), a = Math.sin(u * 100) * w * e; p.ty += a * .5; p.cz += a * .08; p.hIx += a * .5; p.hDx -= a * .5; p.kz -= a * .18; p.sq *= 1 + a * .02; p.y += Math.abs(a) * .03; } }),
    casco: U(1.6, [[.18, { hIx: -2.9, hDx: -2.9, hIz: -.35, hDz: .35, cI: -.6, cD: -.6, kx: -.1, tx: -.04 }], [.38, { hIx: -2.5, hDx: -2.5, hIz: -.2, hDz: .2, cI: -2.0, cD: -2.0, cab: 1, kx: .12, y: -.03, sq: .985 }, 'o'], [.52, { hIx: -2.35, hDx: -2.35, cI: -1.9, cD: -1.9, cab: 1, kx: .04, y: 0 }],
      [.64, { hIx: -2.5, hDx: -2.5, cI: -2.0, cD: -2.0, cab: 1, kx: .1, y: -.02 }], [.76, { hIx: -2.5, hDx: -2.5, cI: -2.0, cD: -2.0, cab: .6, kx: -.05, y: .02 }]], { cara: [[0, 'concentrado'], [.4, 'esfuerzo'], [.55, 'feliz'], [.9, 'normal']] }),
    recoger: U(1.3, [[.3, { y: -.3, tx: .95, mIx: -.8, mDx: -.8, rI: 1.5, rD: 1.5, hIx: -.95, hDx: -.95, hIz: -.2, hDz: .2, cI: -.15, cD: -.15, kx: -.1 }], [.46, { y: -.33, tx: 1.0, mIx: -.8, mDx: -.8, rI: 1.5, rD: 1.5, hIx: -.95, hDx: -.95, cI: -.2, cD: -.2, kx: -.1, sq: .97 }],
      [.74, { y: -.08, tx: .3, mIx: -.4, mDx: -.4, rI: .8, rD: .8, hIx: -.9, hDx: -.9, cI: -1.5, cD: -1.5, hIz: -.15, hDz: .15, kx: -.05 }]], { cara: [[0, 'concentrado'], [.5, 'esfuerzo'], [.8, 'feliz'], [.95, 'normal']] }),
    izarse: U(1.4, [[.14, { hIx: -3.0, hDx: -3.0, hIz: -.14, hDz: .14, cab: .7, y: -.25, tx: -.05, kx: -.4, mIx: -.5, mDx: -.5, rI: .8, rD: .8, sq: 1.03 }], [.5, { hIx: -2.2, hDx: -2.2, hIz: -.14, hDz: .14, cI: -2.3, cD: -2.3, cab: .8, y: .1, kx: -.2, mIx: -.9, mDx: -.2, rI: 1.6, rD: .4, tx: .25 }, 'o'],
      [.78, { hIx: -.9, hDx: -.9, hIz: -.3, hDz: .3, cI: -.9, cD: -.9, y: .05, tx: .45, mIx: -.4, mDx: -.3, rI: .6, rD: .4 }]], { cara: [[0, 'esfuerzo'], [.55, 'cansado'], [.85, 'normal']], fx: 'gota' }),
    tiron: U(.85, [[.12, { tx: -.35, hIx: -1.5, hDx: -1.5, hIz: -.1, hDz: .1, cI: -.2, cD: -.2, mIx: .3, mDx: .3, y: -.04 }], [.34, { tx: .95, kx: .2, hIx: -2.0, hDx: -2.0, hIz: -.2, hDz: .2, cI: -.1, cD: -.1, mIx: -.9, mDx: .6, rI: .8, y: .04, sq: .98 }, 'o'],
      [.62, { tx: .8, hIx: -1.7, hDx: -1.7, mIx: -.7, mDx: .5, rI: .6, y: -.02 }]], { cara: [[0, 'susto'], [.5, 'mareado'], [.85, 'normal']] }),
    heroe: U(1.7, [[.16, { y: -.42, tx: .55, mIx: -1.2, mDx: .3, rI: 1.7, rD: 1.9, hIx: .6, hIz: -.7, hDx: .3, hDz: .2, cD: -.2, cI: -.3, kx: -.4, sq: .9 }, 'o'], [.7, { y: -.4, tx: .5, mIx: -1.15, mDx: .3, rI: 1.7, rD: 1.9, hIx: .6, hIz: -.7, hDx: .3, hDz: .2, cD: -.2, kx: -.45, sq: .91 }],
      [.9, { y: -.2, tx: .4, mIx: -.7, mDx: .1, rI: 1.0, rD: 1.0, hIx: .2, hIz: -.5, hDz: .4, kx: -.2 }]], { cara: [[0, 'concentrado'], [.75, 'orgulloso'], [.95, 'normal']] }),

    /* ── gestos de cuerpo y cara: emotes y trato con otros ── */
    abrazo: U(1.8, [[.22, { hIx: -1.0, hDx: -1.0, hIz: -1.1, hDz: 1.1, cI: -.25, cD: -.25, tx: .1, kz: .1, y: .02, sq: 1.02 }, 'o'], [.46, { hIx: -1.45, hDx: -1.35, hIz: -.1, hDz: .1, cI: -1.0, cD: -.9, tx: .3, kz: .22, sq: .97 }, 'o'], [.78, { hIx: -1.45, hDx: -1.35, hIz: -.1, hDz: .1, cI: -1.0, cD: -.9, tx: .28, kz: .2, sq: .975 }]],
      { cara: [[0, 'feliz']], x: (p, u, w) => { p.tz += Math.sin(u * 14) * w * .05; p.cz += Math.sin(u * 14) * w * .03; } }),
    hombrazo: U(.8, [[.24, { tz: -.25, cz: .14, ty: -.28, hDz: .5, hIz: -.35, hIx: -.3, hDx: -.3, cI: -.6, cD: -.6, mIz: -.2, y: -.05 }], [.42, { px: .3, rz: -.12, tz: .45, cz: -.1, ty: .32, hDz: .15, hIz: -.7, cI: -1.0, cD: -1.0, mDz: .25, y: .03, sq: 1.02 }, 'o'], [.64, { px: .18, tz: .3, ty: .2, hIz: -.5 }]],
      { cara: [[0, 'concentrado'], [.4, 'picaro'], [.8, 'normal']] }),
    beso: U(1.4, [[.22, { hDx: -1.5, hDz: .15, cD: -2.3, cab: 1, kx: .05, kz: .12, tx: .04 }], [.42, { hDx: -1.5, hDz: .2, cD: -2.35, cab: 1, kz: .14 }], [.6, { hDx: -1.7, hDz: .55, cD: -.3, kz: .2, tx: -.06, y: .03, cab: 0 }, 'o'], [.86, { hDx: -1.5, hDz: .5, cD: -.4, kz: .16 }]],
      { cara: [[0, 'feliz'], [.25, 'picaro'], [.6, 'guino'], [.92, 'normal']], fx: 'corazon' }),
    corazon: U(1.7, [[.25, { hIx: -2.55, hDx: -2.55, hIz: -.18, hDz: .18, cI: -.9, cD: -.9, kx: .02, kz: .12, y: .03, sq: 1.02, cab: .6 }, 'o'], [.8, { hIx: -2.55, hDx: -2.55, hIz: -.18, hDz: .18, cI: -.9, cD: -.9, kz: .12, cab: .6 }]],
      { cara: [[0, 'feliz']], fx: 'corazon', x: (p, u, w) => { const l = Math.pow(Math.max(0, Math.sin(u * 22)), 3) * w; p.sq *= 1 + l * .03; p.y += l * .02; } }),
    paz: U(1.2, [[.2, { hDx: -2.0, hDz: .35, cD: -1.5, kz: -.15, tx: -.03, y: .03 }, 'o'], [.8, { hDx: -2.0, hDz: .35, cD: -1.5, kz: -.17, tx: -.03 }]], { cara: [[0, 'feliz'], [.3, 'guino'], [.75, 'feliz'], [.92, 'normal']] }),
    callar: U(1.3, [[.2, { hDx: -1.45, hDz: .12, cD: -2.4, cab: 1, tx: .1, ky: .3, hIx: .1, hIz: -.3, cI: -.5 }], [.78, { hDx: -1.45, hDz: .12, cD: -2.4, cab: 1, tx: .1, ky: -.3, hIx: .1, hIz: -.3, cI: -.5 }]], { cara: [[0, 'picaro'], [.85, 'normal']] }),
    llamar: U(1.3, [[.18, { hDx: -1.5, hDz: .25, cD: -.3, kz: .08, tx: .05 }], [.32, { cD: -1.7 }], [.46, { cD: -.3 }], [.6, { cD: -1.7 }], [.74, { cD: -.4 }]], { cara: [[0, 'picaro'], [.85, 'normal']] }),
    saludo_militar: U(1.2, [[.16, { hDx: -2.0, hDz: .75, cD: -2.45, cab: .6, tx: -.05, kx: -.08, y: .02, mIz: -.04, mDz: .04 }, 'o'], [.72, { hDx: -2.0, hDz: .75, cD: -2.45, cab: .6, tx: -.05, kx: -.08 }]], { cara: [[0, 'concentrado'], [.8, 'normal']] }),
    flexionar: U(1.3, [[.2, { hIz: -.95, hDz: .95, hIx: -.3, hDx: -.3, cI: -2.2, cD: -2.2, tx: -.1, kx: -.2, y: .02, sq: 1.04 }, 'o'], [.55, { hIz: -.95, hDz: .95, hIx: -.3, hDx: -.3, cI: -2.3, cD: -2.3, tx: -.12, kx: -.22, sq: 1.045 }], [.78, { hIz: -.9, hDz: .9, cI: -2.2, cD: -2.2, tx: -.1, sq: 1.03 }]],
      { cara: [[0, 'orgulloso'], [.9, 'normal']], x: (p, u, w) => { p.ty += Math.sin(u * 20) * w * .06; } }),
    // caídas completas: usan el ragdoll (volar) con poca fuerza
    caer_atras: { dur: .1, volar: [0, -1, .5] }, caer_adelante: { dur: .1, volar: [0, 1, .55] }, resbalon: { dur: .1, volar: [0, -1, .85, { giro: .9 }] }
  };
  const IDLE = ['bostezo', 'reloj', 'estirarse', 'rascarse', 'miradas'];            // variantes de espera al azar cuando lleva rato en 'quieto'
  const CARAS = {
    normal: { boca: 'sonrisa', oj: 1, pu: 1, ce: 0, cy: 0 }, feliz: { boca: 'abierta', oj: 'feliz', pu: 1, ce: .1, cy: .03 },
    susto: { boca: 'o', oj: 1.25, pu: .6, ce: .25, cy: .07 }, triste: { boca: 'triste', oj: .7, pu: 1, ce: -.45, cy: 0, lagri: 1 },
    enojado: { boca: 'linea', oj: .8, pu: 1, ce: .5, cy: -.04, enojo: 1 }, concentrado: { boca: 'linea', oj: .55, pu: 1.1, ce: .25, cy: -.03, enojo: 1 },
    dormido: { boca: 'o', oj: 0, pu: 1, ce: 0, cy: -.02 }, mareado: { boca: 'abierta', oj: 1, pu: .5, ce: -.2, cy: .03, gira: 1 },
    // nuevas
    dolor: { boca: 'dientes', oj: 'aprieta', pu: 1, ce: -.5, cy: .05, temblor: 1 }, guino: { boca: 'ladeada', oj: 1, ojD: 'feliz', pu: 1, ce: .1, cy: .02, cyD: .06 },
    burla: { boca: 'lengua', oj: 'feliz', pu: 1, ce: .15, cy: .05 }, sorpresa: { boca: 'o', oj: 1.4, pu: .75, ce: .3, cy: .12, grande: 1 },
    risa: { boca: 'grande', oj: 'feliz', pu: 1, ce: .15, cy: .04, mov: 'ja' }, llorando: { boca: 'grande', oj: 'aprieta', pu: 1, ce: -.55, cy: .04, lagri: 1, mov: 'llanto' },
    cansado: { boca: 'abierta', oj: .5, pu: .9, ce: -.2, cy: -.06, mov: 'jadeo' }, aburrido: { boca: 'linea', oj: .55, pu: 1, ce: -.1, cy: -.05, mir: [.6, -.1] },
    pensando: { boca: 'ladeada', oj: 1, pu: 1, ce: .2, cy: .02, cyD: .1, mir: [.7, .8] }, orgulloso: { boca: 'ladeada', oj: .7, pu: 1, ce: .15, cy: .07 },
    esfuerzo: { boca: 'dientes', oj: 'aprieta', pu: 1, ce: .55, cy: -.05, enojo: 1, temblor: 1 }, miedo: { boca: 'o', oj: 1.3, pu: .45, ce: -.45, cy: .1, temblor: 1 },
    asco: { boca: 'triste', oj: .55, pu: 1, ce: .4, cy: -.06, enojo: 1 }, sueno: { boca: 'o', oj: .3, pu: 1, ce: -.12, cy: -.05 },
    picaro: { boca: 'ladeada', oj: .75, pu: 1, ce: .35, cy: -.02, cyD: .09, enojo: 1 }, gritando: { boca: 'grande', oj: 'aprieta', pu: 1, ce: .45, cy: -.04, enojo: 1, mov: 'habla' },
    bostezo: { boca: 'grande', oj: 'aprieta', pu: 1, ce: -.25, cy: .05, grande: 1 }
  };
  if (L.ceja === 'brava') CARAS.normal = Object.assign({}, CARAS.normal, { ce: .18, enojo: .4 });

  function ponerCara(nombre) {
    const e = CARAS[nombre] || CARAS.normal; caraE = nombre;
    for (const k in bocas) bocas[k].visible = k === e.boca;
    bocas.abierta.scale.setScalar(nombre === 'feliz' ? 1.15 : 1);
    bocas.o.scale.set(e.grande ? 1.5 : 1, e.grande ? 1.5 : 1, .4);
    bocas.grande.scale.set(nombre === 'bostezo' ? 1.5 : 1.25, nombre === 'bostezo' ? 1.9 : 1.25, 1);
    cejas.forEach((c, i) => { const sx = i ? 1 : -1, ce = i && e.ceD != null ? e.ceD : e.ce, cy = i && e.cyD != null ? e.cyD : e.cy; c.position.y = .2 + cy; c.rotation.z = sx * -ce * (e.enojo ? 1 : -1) * .9; });
  }
  ponerCara('normal');
  const modoOjo = (v) => v === 'feliz' ? 'feliz' : v === 'aprieta' ? 'aprieta' : v === 0 ? 'dormido' : 'abierto';
  // parpadeo con intención: perfil suave (cierra rápido, abre más despacio); con sueño/aburrimiento es lento y seguido, con miedo/concentración casi no parpadea, el nervioso parpadea más
  const SOMN = { cansado: 1, sueno: 1, aburrido: 1 }, FIJO = { concentrado: 1, miedo: 1, susto: 1, sorpresa: 1, enojado: 1, esfuerzo: 1 };
  let parpT = -1;
  function caraUpdate(dt, pupX, pupY) {
    const e = CARAS[caraE] || CARAS.normal, bd = SOMN[caraE] ? .3 : .15;
    parp -= dt; if (parp < 0) { parpT = 0; parp = Math.random() < .2 && !FIJO[caraE] ? .35 : (SOMN[caraE] ? .9 + Math.random() * 1.2 : FIJO[caraE] ? 4 + Math.random() * 3 : (1.8 + Math.random() * 3.2) / (.75 + PS.nervio * .5)); }     // a veces parpadea doble
    let cierra = 0; if (parpT >= 0) { parpT += dt; const u = parpT / bd; if (u >= 1) parpT = -1; else cierra = u < .4 ? sua(u / .4) : 1 - sua((u - .4) / .6); }
    ojos.forEach((o, i) => {
      const v = i && e.ojD != null ? e.ojD : e.oj, m = modoOjo(v);
      o.feliz.visible = m === 'feliz' || m === 'dormido'; o.feliz.rotation.z = m === 'dormido' ? Math.PI : 0; o.ap.visible = m === 'aprieta';
      const abierto = m === 'abierto'; o.bl.visible = o.pu.visible = o.br.visible = abierto;
      o.g.scale.set(1, abierto ? lerp(v, .1, cierra) : 1, 1);
      o.pu.scale.set(.85 * e.pu, 1.05 * e.pu, .35);
      const gx = e.gira ? Math.cos(t * 9 + (i ? 2 : 0)) * .025 : pupX + (e.mir ? e.mir[0] * .028 : 0), gy = e.gira ? Math.sin(t * 9) * .025 : pupY + (e.mir ? e.mir[1] * .028 : 0);
      o.pu.position.x = gx; o.pu.position.y = gy;
    });
    const b = bocas[e.boca];
    if (e.temblor) { b.position.x = Math.sin(t * 55) * .008; b.position.y = (e.boca === 'o' ? -.22 : -.2) + Math.sin(t * 47) * .004; } else { b.position.x = e.boca === 'ladeada' ? .03 : 0; b.position.y = e.boca === 'o' ? -.22 : -.2; }
    if (e.mov) { const m = e.mov === 'habla' ? .55 + .45 * Math.abs(Math.sin(t * 17)) : e.mov === 'ja' ? .7 + .3 * Math.abs(Math.sin(t * 13)) : e.mov === 'llanto' ? .8 + .2 * Math.sin(t * 9) : .85 + .15 * Math.sin(t * 6.5); bocas.grande.scale.y = 1.25 * m; bocas.abierta.scale.y = (caraE === 'feliz' ? 1.15 : 1) * m; }
    for (let i = 0; i < 2; i++) { const l = lag[i]; l.visible = !!e.lagri; if (e.lagri) { const ph = (t * .8 + i * .45) % 1; l.position.y = -.1 - ph * .3; l.position.x = (i ? 1 : -1) * (.22 + ph * .03); l.scale.setScalar(1 - ph * .5); } }
  }

  // cuánto dura el cross-fade según de dónde a dónde va (antes era 0.18 s para todo)
  const SUSTO = { asustado: 1, cubrirse: 1, empujado: 1, aire: 1, tambalear: 1, borde: 1, pared: 1, resbalar: 1, gritar: 1, forcejear: 1 };
  const LENTA = { dormir: 1, dormitar: 1, desplome: 1, derrota: 1, rodillas: 1, triste: 1, lloron: 1 };
  const SENT = { sentado: 1, sentado_celebra: 1, sentado_miedo: 1, sentado_aburrido: 1, sentado_enojado: 1, remar: 1 };
  function durMez(a, b) {
    if (SUSTO[b]) return .09;
    if (LENTA[a] || LENTA[b]) return .42;
    if (SENT[a] || SENT[b]) return .3;
    if (GAIT[a] && GAIT[b]) return .24;                                   // caminar <-> correr: se nota el cambio de marcha
    if (GAIT[b] && a === 'quieto') return .13;                            // arrancar: ágil
    if (GAIT[a] && b === 'quieto') return .24;                            // parar: se asienta
    return .18;
  }
  function mezclar(nombre) { if (nombre === animN) return;
    if (animN === 'correr' || animN === 'caminar' || animN === 'asustado') { if (!GAIT[nombre]) { frenoA = (animN === 'caminar' ? .45 : 1) * Math.max(sv, cl(spd / 6, 0, 1)) * (.75 + .25 * PS.peso); frenoT = 0; }   // al frenar el cuerpo se pasa de largo, derrapa y rebota (más el que pesa)
      else if (animN === 'correr' && nombre === 'caminar') { frenoA = .36 * Math.max(sv, cl(spd / 6, 0, 1)) * (.75 + .25 * PS.peso); frenoT = 0; } }
    if (GAIT[nombre] && nombre !== 'retroceder' && (!GAIT[animN] || (animN === 'caminar' && nombre === 'correr'))) { arrA = (nombre === 'correr' ? 1 : nombre === 'asustado' ? 1.1 : nombre === 'caminar' ? .6 : .3) * (animN === 'caminar' ? .6 : 1) * (.6 + .4 * PS.peso); arrT = 0; }   // arrancar: se echa un poco atrás, se agacha y se lanza adelante
    mezD = durMez(animN, nombre); de = Object.assign({}, cur); mezcla = 0; animN = nombre; }

  /* ───────────── personalidad y vida (capas sobre la pose) ───────────── */
  const LOCO = { caminar: 1, correr: 1, retroceder: 1, cansado: 1, pesado: 1, asustado: 1, sigilo: 1, carretilla: 1, cargar: 1, empujar: 1 }, SWING = { caminar: 1, correr: 1, retroceder: 1 };
  function personalidad(p, s, dt) {
    if (!p.rx) p.kz += PS.cab;                                                          // cada uno lleva la cabeza un poco ladeada a su manera
    if (!LOCO[animN]) return;
    p.y = p.y > 0 ? p.y * Math.pow(PS.peso, -.5) : p.y * PS.rebote;                      // el pesado vuela menos y se hunde más en cada paso; el chico rebota más
    p.mIz -= PS.ancho; p.mDz += PS.ancho;                                                // pasos abiertos
    if (SWING[animN]) { p.hIx *= PS.brazos * (1 + .1 * PS.lado); p.hDx *= PS.brazos * (1 - .1 * PS.lado); p.hIz -= PS.ancho * 1.2; p.hDz += PS.ancho * 1.2; p.sx += Math.cos(fase) * PS.bal * s.k; p.cy *= PS.cad; }   // brazos que braceen más o menos, un lado más suelto que el otro, cadera que se menea
  }
  const VIDA_PESO = { quieto: 1, saludar: 1, asentir: 1, negar: 1, asombrado: 1, triste: 1 }, VIDA_OJOS = { quieto: 1, saludar: 1, asentir: 1, negar: 1, asombrado: 1, triste: 1, sentado: 1, sentado_aburrido: 1 };
  function vidaPose(p, dt) {                                                           // espera con vida: cambios de peso irregulares, ojos que se adelantan a la cabeza, tics del nervioso
    const libre = !uno && !vol && !gYaw && !gPit;
    vida.k += ((libre && VIDA_OJOS[animN] ? 1 : 0) - vida.k) * Math.min(1, dt * 3); vida.kp = (vida.kp || 0) + ((libre && VIDA_PESO[animN] ? 1 : 0) - (vida.kp || 0)) * Math.min(1, dt * 3);
    if (vida.k < .005 && vida.kp < .005) return;
    const nv = .6 + PS.nervio * .8;
    vida.wt -= dt; if (vida.wt < 0) { vida.w0 = vida.w; vida.w1 = (Math.random() < .5 ? -1 : 1) * (.55 + Math.random() * .45); vida.wu = 0; vida.wt = (3.2 + Math.random() * 5) / nv; }
    vida.wu = Math.min(1, vida.wu + dt * nv / .9); vida.w = lerp(vida.w0, vida.w1, sua(vida.wu));
    const w = vida.w * vida.kp, wp = Math.max(0, w), wn = Math.max(0, -w);
    p.sx += w * .02; p.cz += w * .04; p.tz -= w * .035; p.rI += wp * .1; p.rD += wn * .1; p.mIx -= wp * .07; p.mDx -= wn * .07; p.kz -= w * .03;                  // la cadera se corre sobre el pie cargado; el otro se afloja
    vida.st -= dt;
    if (vida.st < 0) { const grande = Math.random() < .35 + PS.nervio * .3; vida.sx1 = (Math.random() * 2 - 1) * (grande ? .95 : .4); vida.sy1 = (Math.random() * 1.2 - .7) * .5; vida.st = (1.3 + Math.random() * 3) / nv;
      if (Math.abs(vida.sx1 - vida.sx) > .6) { parp = Math.min(parp, .06); vida.hxT = vida.sx1 * .5; vida.hyT = -vida.sy1 * .3; vida.hd = .14 + Math.random() * .08; } else { vida.hxT = 0; vida.hyT = 0; vida.hd = .1; } }   // mirada grande: los ojos se van primero, parpadea y la cabeza los alcanza
    vida.sx += (vida.sx1 - vida.sx) * Math.min(1, dt * 30); vida.sy += (vida.sy1 - vida.sy) * Math.min(1, dt * 30);
    vida.hd -= dt; if (vida.hd <= 0) { vida.hvx = (vida.hvx || 0) + ((vida.hxT - vida.hx) * 56 - 2 * 7.5 * (vida.hvx || 0)) * dt; vida.hvy = (vida.hvy || 0) + ((vida.hyT - vida.hy) * 56 - 2 * 7.5 * (vida.hvy || 0)) * dt; }   // la cabeza sigue a los ojos con un resorte critico: arranca y frena suave
    vida.hx += (vida.hvx || 0) * dt; vida.hy += (vida.hvy || 0) * dt;
    p.ky += vida.hx * vida.k; p.kx += vida.hy * vida.k;
    if (PS.nervio > .5 && vida.kp > .5) { vida.tt -= dt; if (vida.tt < 0) { vida.tic = .001; vida.tt = (2.5 + Math.random() * 4) / PS.nervio; }
      if (vida.tic > 0) { vida.tic += dt / .35; if (vida.tic >= 1) vida.tic = 0; else { const b = Math.pow(Math.sin(Math.PI * vida.tic), 2); p.kz += b * .08 * PS.lado; p.ky += b * .06 * PS.lado; p.y += b * .012; p.tz += b * .02; } } }   // tic del nervioso: sacude la cabeza y se encoge un poquito
  }

  /* ───────────── que nada atraviese el cuerpo ───────────── */
  // el torso es el mismo perfil del torno (elipse por altura, en el marco del torso); la cabeza una esfera con el pelo. Por cada brazo se prueban
  // codo, media del antebrazo, mano y el objeto que lleve: si alguno entra, el hombro se abre hacia afuera lo justo (y vuelve suave cuando ya no hace falta).
  const SZ = .82 + P * .12, RCAB = RC * 1.04 + (L.pelo === 'rizos' || L.pelo === 'rolos' ? .14 : ad.audifonos ? .1 : .05);
  let cabK = 0;
  const vA = new T.Vector3(), vB = new T.Vector3(), vC = new T.Vector3(), cabC = new T.Vector3(), extra = [0, 0], extraC = [0, 0];
  function radioTorso(y) {
    if (y < perfil[0][1] - .04 || y > TOR + .06) return 0;
    for (let i = 1; i < perfil.length - 1; i++) if (y <= perfil[i][1]) { const a = perfil[i - 1], b = perfil[i], u = (y - a[1]) / Math.max(1e-4, b[1] - a[1]); return a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, u)); }
    return perfil[perfil.length - 2][0];
  }
  function dentro(pt, r) {                          // pt en el marco del torso
    const rt = radioTorso(pt.y);
    if (rt > 0) { const ex = pt.x / (rt + r), ez = pt.z / (rt * SZ + r); if (ex * ex + ez * ez < 1) return 'torso'; }
    if (pt.distanceTo(cabC) < RCAB * (1 - cabK * .4) + r * (1 - cabK * .5)) return 'cabeza';
    return null;
  }
  const local = (o, v) => tor.worldToLocal(o.getWorldPosition(v));
  function brazoChoca(lado) {
    const b = lado ? bD : bI, rp = propG && propG.visible && lado ? .16 : 0;
    local(b.codo, vA); local(b.mano, vB); vC.copy(vA).add(vB).multiplyScalar(.5);
    return dentro(vA, .09) || dentro(vC, .08) || dentro(vB, .1 + rp);
  }
  function soltarBrazos(dt) {
    g.updateMatrixWorld(true); local(cab, cabC);
    for (let lado = 0; lado < 2; lado++) {
      const H = lado ? J.hD : J.hI, Co = lado ? J.cD : J.cI, sx = lado ? 1 : -1, base = H.rotation.z, codo0 = Co.rotation.x;
      // cuánto hace falta para esta pose, buscado desde cero (no desde el cuadro anterior: así no oscila): primero abre el hombro, si no basta estira el codo
      // libre(e, c): ¿el brazo queda fuera con el hombro abierto e y el codo estirado c? Se acepta solo si también lo está con el margen
      // (con el torso inclinado el choque no es monótono: abre, vuelve a rozar y luego sí queda libre)
      const libre = (e, c) => { H.rotation.z = base + sx * e; Co.rotation.x = Math.min(0, codo0 + c); H.updateMatrixWorld(true); return !brazoChoca(lado); };
      let ex = 0, ec = 0, hallado = false;
      if (!libre(0, 0) && Math.abs(base) > .9 && codo0 < -.05) {   // el brazo ya va abierto: abrir más lo mete en la cabeza; primero se estira el codo
        for (let c = .06; c < -codo0 + .06; c += .06) { const cc = Math.min(c, -codo0); if (libre(0, cc) && libre(0, Math.min(cc + .1, -codo0))) { ec = Math.min(cc + .1, -codo0); hallado = true; break; } }
      }
      if (!hallado && !libre(ex, ec)) {
        for (let i = 0; i < 110; i++) {
          const ex0 = ex, ec0 = ec, usaEc = !(ex < .7) && codo0 + ec < 0;
          if (ex < .7) ex += .035; else if (codo0 + ec < 0) ec += .06; else if (ex < 1.6) ex += .035; else break;
          if (libre(ex, ec) && libre(ex + .04, ec)) {   // margen: que no quede rozando y entrando/saliendo
            // afina entre el paso anterior (choca) y este (libre) para que el ajuste varíe continuo y no a saltos cuando la pose se mece
            let lo = usaEc ? ec0 : ex0, hi = usaEc ? ec : ex;
            for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (usaEc ? (libre(ex0, m) && libre(ex0 + .04, m)) : (libre(m, ec0) && libre(m + .04, ec0))) hi = m; else lo = m; }
            if (usaEc) ec = hi; else ex = hi;
            ex += .04; break;
          }
        }
      }
      // abre al instante lo que haga falta (nunca se ve atravesar) y cierra despacio
      const ir = (de, a) => a > de ? a : de + (a - de) * Math.min(1, dt * 4);
      let e1 = ir(extra[lado], ex), c1 = ir(extraC[lado], ec);
      if ((e1 !== ex || c1 !== ec) && !libre(e1, c1)) { e1 = ex; c1 = ec; }       // el cierre suave solo vale si no choca (el choque no es monótono): si no, la solución exacta
      extra[lado] = e1; extraC[lado] = c1;
      H.rotation.z = base + sx * extra[lado]; Co.rotation.x = Math.min(0, codo0 + extraC[lado]); H.updateMatrixWorld(true);
    }
  }

  /* ───────────── física secundaria: resortes amortiguados ───────────── */
  // x'' = -w²(x - objetivo) - 2·z·w·x'. Cada pieza cuelga de un resorte propio (frecuencia w en rad/s, amortiguación z, tope lim) cuyo objetivo es la "inercia" del cuerpo:
  // aceleración real del grupo (el juego lo mueve), aceleración angular de la pose (torso, cabeza, brazos) y la gravedad al saltar. Así todo hace overlap y follow-through solo.
  const rs = (w, z, lim) => ({ x: 0, v: 0, w: w, z: z, lim: lim || 9, t: 0 });
  function paso(s, dt, wk) {
    const w = s.w * (wk || 1), n = Math.min(10, 1 + Math.floor(dt * w / .35)), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += (-w * w * (s.x - s.t) - 2 * s.z * w * s.v) * h; s.x += s.v * h; }
    if (s.x > s.lim) { s.x = s.lim; if (s.v > 0) s.v *= .4; } else if (s.x < -s.lim) { s.x = -s.lim; if (s.v < 0) s.v *= .4; }
    if (!(s.x === s.x)) { s.x = 0; s.v = 0; }
    return s.x;
  }
  const SP = {
    cabX: rs(13, .4, .55), cabY: rs(12, .5, .7), cabZ: rs(13, .4, .55), pelX: rs(8, .2, .8), pelZ: rs(8, .2, .8), colX: rs(6.5, .14, 1.1), colZ: rs(6.5, .14, 1.1),
    arX: [rs(13, .12, .9), rs(13, .12, .9)], arZ: [rs(13, .12, .9), rs(13, .12, .9)], proX: rs(10, .26, .7), proZ: rs(10, .26, .7),
    shI: rs(10, .35, .7), shD: rs(10, .35, .7), szI: rs(10, .35, .7), szD: rs(10, .35, .7), elI: rs(14, .3, .9), elD: rs(14, .3, .9),
    esX: rs(12, .4, .4), esZ: rs(12, .4, .4), esY: rs(10, .45, .4), gH: rs(14, .8, 1.2), gT: rs(8, .9, .6), gP: rs(14, .8, .7), tH: rs(16, .7, 1.3), tT: rs(14, .7, .6),
    oX: rs(70, .9, .06), oY: rs(70, .9, .06), imX: rs(9, .3, 3), imZ: rs(9, .3, 3), imY: rs(12, .3, .3), imS: rs(13, .3, .4)
  };
  const LKEYS = ['hIx', 'hIz', 'hDx', 'hDz', 'cI', 'cD', 'mIx', 'mIz', 'mDx', 'mDz', 'rI', 'rD', 'kx', 'ky', 'kz', 'tx', 'ty', 'tz'];      // juntas que se sueltan en el ragdoll
  const LW = { hIx: 11, hIz: 11, hDx: 11, hDz: 11, cI: 14, cD: 14, mIx: 9, mIz: 9, mDx: 9, mDz: 9, rI: 12, rD: 12, kx: 12, ky: 12, kz: 12, tx: 9, ty: 9, tz: 9 };
  const LL = { hIz: 1.5, hDz: 1.5, kx: 1.0, ky: 1.2, kz: .8, tx: 1.1, ty: 1.1, tz: .8, cI: 2.6, cD: 2.6, rI: 2.4, rD: 2.4 };
  const LS = {}; for (const k of LKEYS) LS[k] = rs(LW[k], .22, LL[k] || 3.4);
  const TRK = ['tx', 'ty', 'tz', 'kx', 'ky', 'kz', 'hIx', 'hDx', 'y', 'rx', 'rz'], pV = {}, pA = {}, pPrev = {}; for (const k of TRK) { pV[k] = 0; pA[k] = 0; pPrev[k] = null; }
  function derivs(p, dt) {                         // velocidad y aceleración (suavizadas) de las poses: es lo que empuja los resortes
    if (dt <= 0) return;
    for (const k of TRK) { let d = pPrev[k] == null ? 0 : p[k] - pPrev[k]; if (k[0] === 'h') d = wrap(d); pPrev[k] = p[k]; const v = d / dt, a = cl((v - pV[k]) / dt, -140, 140); pV[k] = v; pA[k] += (a - pA[k]) * Math.min(1, dt * 28); }
  }
  // cinemática real del grupo: el juego mueve pj.g.position y de ahí salen velocidad (cadencia de los pasos) y aceleración (inercia)
  let gpx = 0, gpy = 0, gpz = 0, gini = false, spd = 0, vwx = 0, vwy = 0, vwz = 0, awx = 0, awy = 0, awz = 0, lax = 0, laz = 0, ayG = 0;
  function cinematica(dt) {
    const x = g.position.x, y = g.position.y, z = g.position.z, sc = g.scale.x || 1;
    if (!gini || dt <= 0) { gpx = x; gpy = y; gpz = z; gini = true; return; }
    const ix = (x - gpx) / dt / sc, iy = (y - gpy) / dt / sc, iz = (z - gpz) / dt / sc; gpx = x; gpy = y; gpz = z;
    const tele = Math.hypot(ix, iy, iz) > 40;                                       // teletransporte: no cuenta como velocidad
    const k = Math.min(1, dt * 16), nx = tele ? 0 : ix, ny = tele ? 0 : iy, nz = tele ? 0 : iz;
    const ox = vwx, oy = vwy, oz = vwz; vwx += (nx - vwx) * k; vwy += (ny - vwy) * k; vwz += (nz - vwz) * k;
    const kk = Math.min(1, dt * 14); awx += (cl((vwx - ox) / dt, -90, 90) - awx) * kk; awy += (cl((vwy - oy) / dt, -90, 90) - awy) * kk; awz += (cl((vwz - oz) / dt, -90, 90) - awz) * kk;
    spd += (Math.hypot(vwx, vwz) - spd) * Math.min(1, dt * 12);
    const c = Math.cos(rumboA), s = Math.sin(rumboA); lax = awx * c - awz * s; laz = awx * s + awz * c; ayG = awy;
  }

  /* ───────────── impacto y ragdoll ligero ───────────── */
  // centro de masa en PV; el piso se resuelve con unos puntos del cuerpo (pies, cadera, pecho, hombros, cabeza) para que nada se hunda al tumbarse.
  const PTS = [[-.17, -.9, .12, 0], [.17, -.9, .12, 0], [-.17, -.9, -.06, 0], [.17, -.9, -.06, 0], [0, -.3, 0, .3], [0, .12, 0, .32], [-.32, .3, 0, .14], [.32, .3, 0, .14], [0, .9, 0, .62]];
  function hMin(rx, rz) {                           // altura mínima del pivote sobre el piso para esa orientación
    const cx = Math.cos(rx), sxn = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz); let m = 0;
    for (const q of PTS) { const x = q[0] * C.alto, y = q[1] * C.alto, z = q[2] * C.alto, y1 = x * sz + y * cz, y2 = y1 * cx - z * sxn; m = Math.max(m, q[3] * C.alto - y2); }
    return m + .1 * Math.min(1, Math.abs(rx) + Math.abs(rz));       // holgura: las juntas sueltas ceden un poco
  }
  let vol = null;
  function volar(dx, dz, f, o) {
    o = o || {}; f = cl(f == null ? 1 : f, .15, 4);
    let lx = dx * Math.cos(rumboA) - dz * Math.sin(rumboA), lz = dx * Math.sin(rumboA) + dz * Math.cos(rumboA); const m = Math.hypot(lx, lz);
    if (m < 1e-4) { lx = 0; lz = -1; } else { lx /= m; lz /= m; }
    const gi = o.giro == null ? 1 : o.giro, eje = Math.abs(lz) >= Math.abs(lx) ? 'x' : 'z', w0 = (3 + 1.5 * f) * gi, al = o.alcance == null ? 1 : o.alcance;
    for (const k of LKEYS) { LS[k].x = cur[k]; LS[k].v = 0; }
    vol = { ph: 'aire', t: 0, vt: 0, lx: lx, lz: lz, f: f, eje: eje, y: 0, vy: 3 + 1.5 * f, ox: 0, oz: 0, hx: lx * 2.4 * f * al, hz: lz * 2.4 * f * al, rx: lz * .2, rz: -lx * .2, wx: eje === 'x' ? lz * w0 : lz * .8, wz: eje === 'z' ? -lx * w0 : -lx * .8,
      tgx: 0, tgz: 0, cae: false, rebotes: 0, suelo: o.suelo == null ? .5 + .18 * Math.min(f, 3) : o.suelo, up: lz < 0, L: 0, S: null, mover: o.mover, cap: al, ph0: Math.random() * TAU };
    uno = null; unoT = 0; SP.imS.v += f * 4;
    parp = .05; return pj;
  }
  // levantarse con peso: juntarse, rodar/apoyar, rodilla, empujar, de pie con tambaleo y sacudida. Cada tabla = [fracción del tiempo, pose] (null = pose base).
  const SACUDE = [[.9, { tz: .1, ky: .5, cz: .04, y: 0, rx: .04 }], [.94, { tz: -.1, ky: -.5, cz: -.04 }], [.97, { tz: .04, ky: .2, cz: 0 }], [1, null]];
  const GETUP_ATRAS = [[.14, { mIx: -1.3, mDx: -1.1, rI: 2.0, rD: 1.9, mIz: -.3, mDz: .3, hIx: .5, hDx: .5, hIz: -.4, hDz: .4, cI: -.5, cD: -.5, kx: .45, tx: .5, ky: 0, kz: 0, ty: 0, tz: 0, rx: -1.571 }],
    [.3, { rx: -1.35, ty: .6, tz: -.25, tx: .7, mIx: -1.5, rI: 2.2, hIx: -.5, hDx: .7, hIz: -.7, hDz: .3, kx: .3 }],
    [.48, { rx: -.8, ty: .2, tz: -.15, tx: 1.15, kx: -.15, hIx: -.8, hDx: .65, hIz: -.35, hDz: .85, cI: -.5, cD: -.1, mIx: -1.3, mDx: -1.0, rI: 2.0, rD: 1.8 }],
    [.64, { rx: -.38, ty: 0, tz: 0, tx: .75, y: -.15, mIx: -1.35, mDx: -.85, rI: 2.2, rD: 1.6, hIx: -1.05, hDx: -.95, hIz: -.3, hDz: .3, cI: -.7, cD: -.6, kx: -.1, pz: .14 }],
    [.78, { rx: .1, tx: .3, y: -.05, mIx: -.7, mDx: -.6, rI: 1.0, rD: .9, hIx: -.5, hDx: -.5, hIz: -.7, hDz: .7, cI: -.4, cD: -.4, kx: -.1, pz: 0, cz: .05, tz: .1 }],
    [.86, { rx: -.03, tx: .1, y: -.02, mIx: -.2, mDx: -.2, rI: .3, rD: .3, hIz: -.45, hDz: .45, cz: -.05, tz: -.08, hIx: -.1, hDx: -.1, cI: -.3, cD: -.3 }]].concat(SACUDE);
  const GETUP_ADELANTE = [[.14, { hIx: -1.55, hDx: -1.55, hIz: -.3, hDz: .3, cI: -.15, cD: -.15, kx: -.55, tx: -.25, mIx: .3, mDx: .3, rI: .3, rD: .3, mIz: -.12, mDz: .12, ky: 0, kz: 0, ty: 0, tz: 0, rx: 1.5 }],
    [.32, { rx: 1.0, tx: .45, kx: -.35, hIx: -1.35, hDx: -1.35, cI: -.5, cD: -.5, mIx: -.3, mDx: -.3, rI: .9, rD: .9 }],
    [.48, { rx: .75, tx: .7, kx: -.3, hIx: -1.4, hDx: -1.4, cI: -.25, cD: -.25, mIx: -1.4, mDx: -1.2, rI: 2.1, rD: 1.9, pz: -.04 }],
    [.64, { rx: .38, tx: .8, y: -.14, mIx: -1.3, mDx: -.8, rI: 2.2, rD: 1.5, hIx: -1.1, hDx: -.95, cI: -.9, cD: -.7, kx: -.1, pz: -.08 }],
    [.78, { rx: .06, tx: .25, y: -.05, mIx: -.7, mDx: -.6, rI: 1.0, rD: .9, hIx: -.5, hDx: -.5, hIz: -.7, hDz: .7, cI: -.4, cD: -.4, kx: -.1, pz: 0, cz: -.05, tz: -.1 }],
    [.86, { rx: -.03, tx: .1, y: -.02, mIx: -.2, mDx: -.2, rI: .3, rD: .3, hIz: -.45, hDz: .45, cz: .05, tz: .08, hIx: -.1, hDx: -.1, cI: -.3, cD: -.3 }]].concat(SACUDE);
  const GETUP_LADO = [[.2, { hIx: -.3, hDx: -.3, hIz: -.4, hDz: .4, cI: -1.0, cD: -1.0, mIx: -1.0, mDx: -1.0, rI: 1.6, rD: 1.6, tx: .4, kx: 0, ky: 0, kz: 0, tz: 0, ty: 0, rx: 0 }],
    [.4, { rx: .55, tx: .7, y: -.08, mIx: -1.3, mDx: -1.1, rI: 2.1, rD: 1.9, hIx: -1.2, hDx: -1.2, cI: -.6, cD: -.6, kx: -.2 }],
    [.58, { rx: .3, tx: .8, y: -.15, mIx: -1.3, mDx: -.8, rI: 2.2, rD: 1.5, hIx: -1.0, hDx: -.95, cI: -.8, cD: -.7, kx: -.1 }],
    [.74, { rx: .05, tx: .3, y: -.05, mIx: -.7, mDx: -.6, rI: 1.0, rD: .9, hIx: -.5, hDx: -.5, hIz: -.7, hDz: .7, cI: -.4, cD: -.4, cz: .05, tz: .1 }],
    [.84, { rx: -.03, tx: .1, y: -.02, mIx: -.2, mDx: -.2, rI: .3, rD: .3, hIz: -.45, hDz: .45, cz: -.05, tz: -.08, hIx: -.1, hDx: -.1, cI: -.3, cD: -.3 }]].concat(SACUDE.map((e) => [e[0] - (e[0] < 1 ? .04 : 0), e[1]]));
  const ESP = { mIx: 'mDx', mDx: 'mIx', mIz: 'mDz', mDz: 'mIz', rI: 'rD', rD: 'rI', hIx: 'hDx', hDx: 'hIx', hIz: 'hDz', hDz: 'hIz', cI: 'cD', cD: 'cI' }, ESPZ = { mIz: 1, mDz: 1, hIz: 1, hDz: 1, cz: 1, tz: 1, kz: 1, ty: 1, ky: 1 };
  const espeja = (st) => st.map((e) => { if (!e[1]) return e; const n = {}; for (const k in e[1]) n[ESP[k] || k] = ESPZ[k] ? -e[1][k] : e[1][k]; return [e[0], n]; });   // zurdo/diestro según de qué lado cayó
  const GKEYS = KEYS.filter((k) => k !== 'sq' && k !== 'rz' && k !== 'ry');
  function volStep(dt, p, base) {                   // devuelve el peso de "suelto" y escribe cuerpo + extremidades en p
    const v = vol; v.t += dt; v.vt += dt;
    if (v.ph === 'aire' || v.ph === 'suelo') {
      // cuerpo: parábola y giro libre; al tocar rebota, se frena y se acuesta
      v.y += v.vy * dt; v.vy -= 16 * dt; v.ox += v.hx * dt; v.oz += v.hz * dt;
      if (v.mover !== true) { const dm = Math.hypot(v.ox, v.oz), cp = Math.max(.05, v.cap); if (dm > cp) { v.ox *= cp / dm; v.oz *= cp / dm; } }   // sin mover: el desplazamiento visual (en la raíz, nunca g.position) se limita a ~1 m × alcance
      const ymin = hMin(v.rx, v.rz) - PV;
      if (v.y <= ymin) {
        v.y = ymin;
        if (!v.cae) { v.cae = true; v.tgx = 0; v.tgz = 0;                 // primer golpe: elige cómo queda acostado (por el eje en que giró)
          if (v.eje === 'x') { const b = v.lz < 0 ? -Math.PI / 2 : Math.PI / 2; v.tgx = b + Math.PI * Math.round((v.rx - b) / Math.PI); }
          else { const b = v.lx > 0 ? -Math.PI / 2 : Math.PI / 2; v.tgz = b + Math.PI * Math.round((v.rz - b) / Math.PI); v.tgx = TAU * Math.round(v.rx / TAU); }
          v.up = v.eje === 'z' || Math.sin(v.tgx) < 0; }
        if (v.vy < -1.5) { v.vy = -v.vy * .33; v.hx *= .55; v.hz *= .55; v.wx *= .5; v.wz *= .5; v.rebotes++; SP.imS.v += Math.min(v.f, 2) * 5; SP.cabX.v += -v.lz * 5; SP.cabZ.v += v.lx * 5; parp = .02; }
        else { v.vy = 0; const fr = Math.exp(-dt * 6); v.hx *= fr; v.hz *= fr; }
      }
      if (!v.cae) { v.rx += v.wx * dt; v.rz += v.wz * dt; }
      else { v.wx += (-150 * (v.rx - v.tgx) - 15 * v.wx) * dt; v.wz += (-150 * (v.rz - v.tgz) - 15 * v.wz) * dt; v.rx += v.wx * dt; v.rz += v.wz * dt; }
      if (v.ph === 'aire' && v.cae && v.vy === 0) { v.ph = 'suelo'; v.t = 0; }
      if (v.ph === 'suelo' && v.t > v.suelo) {                         // empieza a levantarse: se resuelven las poses clave a partir de cómo quedó
        v.ph = 'sube'; v.t = 0; v.S = {}; for (const k of KEYS) v.S[k] = p[k]; v.S.rx = v.rx; v.S.rz = v.rz; v.S.px = 0; v.S.pz = 0; v.S.y = 0; v.dur = v.f > 1.8 ? 1.75 : 1.45; v.gz = v.rz; v.st = v.eje === 'z' ? GETUP_LADO : v.up ? GETUP_ATRAS : GETUP_ADELANTE; if (v.lx > 0) v.st = espeja(v.st);
        v.A = []; let prev = v.S; for (const e of v.st) { if (!e[1]) break; const m = {}; for (const k of KEYS) m[k] = e[1][k] != null ? e[1][k] : prev[k]; v.A.push(m); prev = m; }
        if (v.mover === true) { const c = Math.cos(rumboA), s = Math.sin(rumboA), sc = g.scale.x || 1; g.position.x += (v.ox * c + v.oz * s) * sc; g.position.z += (-v.ox * s + v.oz * c) * sc; gpx = g.position.x; gpz = g.position.z; v.ox = 0; v.oz = 0; } }
    }
    if (v.ph !== 'sube') {
      p.rx = v.rx; p.rz = v.rz; p.ry = v.y; p.px += v.ox; p.pz += v.oz;
      // extremidades sueltas: de objetivo una pose de muñeco (en el aire o en el suelo) + aleteo, seguidas por resortes poco amortiguados
      const pr = cero(), vt = v.vt + v.ph0, lx = v.lx, lz = v.lz;
      if (!v.cae || v.vy > .2) {
        const fl = Math.sin(vt * 13), fl2 = Math.sin(vt * 11 + 2.2), fl3 = Math.sin(vt * 9 + 1);
        const dv = cl(v.vy * .08, -.45, .45); pr.hIx = -.5 + fl * .6 + dv; pr.hDx = -.5 + fl2 * .6 + dv; pr.hIz = -1.0 - fl3 * .3; pr.hDz = 1.0 + fl * .3; pr.cI = -.5 - (1 + fl2) * .45; pr.cD = -.5 - (1 + fl) * .45;
        pr.mIx = -.5 + fl2 * .65; pr.mDx = -.5 - fl2 * .65; pr.mIz = -.3; pr.mDz = .3; pr.rI = .9 + (1 + fl) * .35; pr.rD = .9 + (1 - fl) * .35; pr.kx = -lz * .5 + fl3 * .12; pr.kz = lx * .5 - fl2 * .1; pr.ky = fl * .25; pr.tx = -lz * .35; pr.tz = lx * .35;
      } else if (v.up) {
        const sp = Math.sin(vt * 3) * .05; pr.hIx = .2 + sp; pr.hDx = .1 - sp; pr.hIz = -1.05; pr.hDz = 1.15; pr.cI = -.25; pr.cD = -.2; pr.mIx = -.1; pr.mDx = -.15; pr.mIz = -.4; pr.mDz = .32; pr.rI = .2; pr.rD = .35; pr.ky = .5; pr.kx = -.05; pr.kz = .08;
      } else {
        pr.hIx = -2.9; pr.hDx = -2.8; pr.hIz = -.55; pr.hDz = .6; pr.cI = -.3; pr.cD = -.25; pr.mIx = .1; pr.mDx = .2; pr.mIz = -.25; pr.mDz = .3; pr.rI = .5; pr.rD = .2; pr.kx = -.7; pr.ky = .65; pr.kz = .05; pr.tx = -.12;
      }
      v.L += (1 - v.L) * Math.min(1, dt * 18);
      for (const k of LKEYS) { LS[k].t = pr[k]; paso(LS[k], dt); p[k] = lerp(p[k], LS[k].x, v.L); }
      return v.L;
    }
    // levantarse: se junta, se apoya, sube; las juntas siguen las poses clave con un poco de resorte
    const u = cl(v.t / v.dur, 0, 1), st = v.st; let i = 0; while (i < st.length - 1 && u > st[i][0]) i++;
    const u0 = i ? st[i - 1][0] : 0, k = sua((u - u0) / Math.max(1e-4, st[i][0] - u0)), from = i ? v.A[i - 1] : v.S, to = st[i][1] ? v.A[i] : base, hw = sua((u - .74) / .16);
    for (const key of GKEYS) p[key] = lerp(from[key], key === 'px' || key === 'pz' ? (st[i][1] ? to[key] : 0) : to[key], k);
    p.px += v.ox * (1 - hw); p.pz += v.oz * (1 - hw);                  // se queda donde cayó mientras rueda y se para; al final regresa con un saltito corto (sin deslizarse)
    p.rz = lerp(v.gz, 0, sua(u)); p.ry = hMin(p.rx, p.rz) - PV + .14 * Math.sin(Math.PI * cl((u - .74) / .16, 0, 1));
    for (const key of LKEYS) { LS[key].t = p[key]; paso(LS[key], dt, 1.2); p[key] = LS[key].x; }
    if (u >= 1) { vol = null; for (const key of LKEYS) { LS[key].x = 0; LS[key].v = 0; } }
    return 0;
  }

  function impacto(dx, dz, f, o) {
    o = o || {}; f = f == null ? 1 : f; if (!(f > 0)) return pj;
    if (vol) { const c = Math.cos(rumboA), s = Math.sin(rumboA); vol.hx += (dx * c - dz * s) * f * .8; vol.hz += (dx * s + dz * c) * f * .8; if (vol.ph !== 'sube') vol.vy += f * .8; return pj; }
    if (f >= (o.tumbar == null ? 2.4 : o.tumbar)) return volar(dx, dz, f * .8, o);
    let lx = dx * Math.cos(rumboA) - dz * Math.sin(rumboA), lz = dx * Math.sin(rumboA) + dz * Math.cos(rumboA); const m = Math.hypot(lx, lz);
    if (m < 1e-4) { lx = 0; lz = -1; } else { lx /= m; lz /= m; }
    SP.imX.v += lz * f * 4.4; SP.imZ.v += -lx * f * 4.4; SP.imY.v -= f * 1.4; SP.imS.v += f * 4.5;                         // el cuerpo cede en esa dirección y vuelve con resorte
    SP.cabX.v += -lz * f * 7; SP.cabZ.v += lx * f * 7; SP.pelX.v += -lz * f * 9; SP.pelZ.v += lx * f * 9; SP.colX.v += -lz * f * 9; SP.colZ.v += lx * f * 9; SP.proX.v += -lz * f * 7; SP.proZ.v += lx * f * 7;
    SP.esX.v += -lz * f * 5; SP.esZ.v += lx * f * 5; SP.shI.v += lz * f * 8; SP.shD.v += lz * f * 8; SP.szI.v += -f * 5; SP.szD.v += -f * 5; SP.elI.v -= f * 6; SP.elD.v -= f * 6;
    for (let i = 0; i < 2; i++) { SP.arX[i].v += -lz * f * 10; SP.arZ[i].v += lx * f * 10; }
    if (f > .35) { caraOv = f > .9 ? 'dolor' : 'sorpresa'; caraOvT = .3 + f * .15; } parp = .02; return pj;
  }
  const softL = (x) => 1.25 * Math.tanh(x / 1.25);

  const ctx = { pose: [], post: [] };   // pose: (p, dt, ctx) justo antes de escribir los huesos · post: (dt, ctx) justo después
  const pj = {
    g: g, J: J, id: ch, datos: L, sinChoques: op.choques !== false,
    /* depuración / pruebas: qué punto de qué brazo está dentro del cuerpo ahora mismo ([] = nada) */
    choques: function () { g.updateMatrixWorld(true); local(cab, cabC); const out = []; for (let lado = 0; lado < 2; lado++) { const c = brazoChoca(lado); if (c) out.push((lado ? 'der' : 'izq') + ':' + c); } return out; },
    anim: function (nombre, o) { if (!ANIMS[nombre]) nombre = 'quieto'; animOp = o || {}; mezclar(nombre); return pj; },
    uno: function (nombre) { const U0 = UNOS[nombre]; if (!U0 || vol) return pj; if (U0.volar) return volar.apply(null, U0.volar.concat([{}]).slice(0, 4)); uno = U0; unoN = nombre; unoT = 0; if (U0.parp) parp = .02; return pj; },
    cara: function (e) { if (e !== caraN && CARAS[e]) caraN = e; return pj; },
    rumbo: function (r) { rumboT = r; return pj; },
    mirar: function (x, y) { mx = cl(x || 0, -1, 1); my = cl(y || 0, -1, 1); gYaw = mx * 1.15; gPit = my * .6; return pj; },     // x: -1..1 (≈ ±66° con ojos, cabeza y torso) · y: arriba +
    mirarA: function (p3) { const dx = p3.x - g.position.x, dz = p3.z - g.position.z, dy = p3.y - (g.position.y + 1.7 * (g.scale.y || 1)); gYaw = cl(wrap(Math.atan2(dx, dz) - rumboA), -1.6, 1.6); gPit = cl(Math.atan2(dy, Math.max(.01, Math.hypot(dx, dz))), -.9, .9); mx = my = 0; return pj; },
    prop: function (v) { if (propG) propG.visible = !!v; return pj; },
    mano: function (lado) { return lado === 'izq' ? bI.mano : bD.mano; },
    color: function (hex) { torso.material = hex ? V3.toon(hex) : torsoMat; return pj; },
    fx: function (nombre, on) { if (FX[nombre]) fxMan[nombre] = on !== false; return pj; },
    impacto: impacto, volar: volar,
    get animacion() { return animN; }, get expresion() { return caraN; }, get ajuste() { return { hombro: extra.slice(), codo: extraC.slice() }; },
    get gesto() { return uno ? unoN : ''; }, get volando() { return !!vol; }, get fase() { return vol ? vol.ph : ''; }, get desplazamiento() { return vol ? { x: vol.ox, z: vol.oz } : { x: 0, z: 0 }; },
    update: function (dt) {
      dt = dt > 0 ? dt : 0; const ds = Math.min(dt, .05);
      t += dt; tq += dt * SPD * PS.tempo; cinematica(ds);
      const vObj = animOp.vel == null ? 1 : animOp.vel; sv += (vObj - sv) * Math.min(1, dt * 9);
      const s = { vel: sv, k: 1, vy: cl(vwy / 7, -1, 1) };
      // cadencia: con velocidad real del grupo el paso se acorta o estira para que el pie apoyado vaya a la velocidad del cuerpo (no patina); sin ella, por 'vel'
      const gt = GAIT[animN]; let fd;
      if (gt) { let k = 1; if (spd > .15) { let w = spd / (LEG * gt.a(sv) * .64 * 1.02); if (w > gt.hi) { k = w / gt.hi; w = gt.hi; } else if (w < gt.lo) { k = w / gt.lo; w = gt.lo; } fd = w; k = cl(k, .35, 1.8); } else fd = gt.rate(sv) * SPD * PS.tempo;
        sk += (k - sk) * Math.min(1, dt * 10); s.k = sk; } else { fd = (CAD[animN] ? CAD[animN](sv) : 6) * SPD * PS.tempo; sk += (1 - sk) * Math.min(1, dt * 10); }
      fase += dt * fd;
      const meta = cero(); ANIMS[animN](meta, s);
      mezcla = Math.min(1, mezcla + dt / mezD);
      for (const key of KEYS) { const gd = GDL[key] ? GDD[GDL[key]] : 0, u = gd ? cl((mezcla - gd) / (1 - gd), 0, 1) : mezcla; cur[key] = de[key] + (meta[key] - de[key]) * (GDL[key] > 1 ? sobre(u) : sua(u)); }
      const p = Object.assign({}, cur);
      personalidad(p, s, ds);
      // gesto de una vez
      let fxG2 = null;
      if (uno) {
        unoT += dt / (uno.dur * (1 + cl((PS.peso - 1) * .14, -.04, .1)));
        if (unoT >= 1) { uno = null; unoN = ''; }
        else if (uno.f) { const q = cero(); uno.f(q, unoT); for (const key of KEYS) { if (key === 'sq') p.sq *= q.sq; else if (q[key]) p[key] = key === 'y' ? Math.max(p.y, q.y) : q[key] + (key[0] === 'h' || key[0] === 'c' || key[0] === 'm' || key[0] === 'r' ? 0 : p[key] * .3); } }
        else { const w = Math.min(sua(unoT / .09), sua((1 - unoT) / .14));
          for (const key in uno.tr) { const q = evalTr(uno.tr[key], unoT, uno.fin ? p[key] : null);
            if (key === 'sq') p.sq *= 1 + (q - 1) * w; else if (key === 'y' || key === 'px' || key === 'pz' || key === 'ry') p[key] += q * w; else p[key] = lerp(p[key], q, w); }
          if (uno.x) uno.x(p, unoT, w); }
        if (uno) { fxG2 = uno.fx; if (uno.cara) { let c = ''; for (const e of uno.cara) if (unoT >= e[0]) c = e[1]; caraOv = c === 'normal' ? '' : c; caraOvT = .08; } }
      }
      // esperas con variantes al azar
      if (animN === 'quieto' && !uno && !vol && animOp.idle !== false && !gYaw && !gPit && spd < .1) { idleT -= dt; if (idleT < 0) { pj.uno(IDLE[(Math.random() * IDLE.length) | 0]); idleT = 6 + Math.random() * 9; } } else if (animN !== 'quieto') idleT = Math.max(idleT, 4);
      // locomoción: se inclina al acelerar (adelante) y al girar (hacia adentro); al frenar se echa atrás, derrapa y rebota
      if (GAIT[animN] || animN === 'cargar' || animN === 'empujar') { p.tx += (vObj - sv) * .3 + cl(laz * .008, -.22, .22); p.tz += cl(-lax * .01, -.22, .22); }
      frenoT += dt;
      if (frenoT < 1.2) { p.tx -= frenoA * .3 * Math.exp(-frenoT * 5) * Math.sin(frenoT * 13);
        if (frenoA > .45) { const e = cl((frenoA - .3) / .7, 0, 1) * Math.exp(-frenoT * 3.2) * sua(1 - frenoT / .8); p.tx -= e * .25; p.mIx = lerp(p.mIx, -.95, e); p.rI = lerp(p.rI, .15, e); p.mDx = lerp(p.mDx, .5, e); p.rD = lerp(p.rD, .8, e); p.hIz = lerp(p.hIz, -.8, e); p.hDz = lerp(p.hDz, .8, e); p.y -= .09 * e; p.sq *= 1 - e * .03; } }
      arrT += dt;
      if (arrT < .55) { const u = arrT / .55, w = u < .2 ? -Math.sin(u / .2 * Math.PI) * .45 : Math.sin((u - .2) / .8 * Math.PI); p.tx += arrA * .2 * w; p.y -= arrA * .045 * Math.sin(Math.PI * cl(u * 1.3, 0, 1)); p.sq *= 1 - arrA * .015 * Math.sin(Math.PI * cl(u * 1.3, 0, 1)); }
      // aterrizaje: si venía bajando rápido, aplasta con resorte (se pasa y se estira); en el aire, se estira con la velocidad
      const vy = ds > 0 ? (p.y - ultimoY) / ds : 0;
      if (ultimoY - p.y > .04 && p.y < .05) { landA = Math.min(.38, (.1 + (ultimoY - p.y) * .9) * Math.pow(PS.peso, .6)); landT = 0; parp = Math.min(parp, .05); } ultimoY = p.y; landT += dt;
      const land = landT < 1 ? landA * Math.exp(-landT * 7) * Math.cos(landT * 17) : 0;
      // mirada (ojos primero, luego cabeza, luego torso) y giro (la cabeza se adelanta al cuerpo)
      vidaPose(p, ds);
      if (Math.abs(gYaw - gYawA) > .45 || Math.abs(gPit - gPitA) > .35) parp = Math.min(parp, .06); gYawA = gYaw; gPitA = gPit;
      const eT = wrap(rumboT - rumboA);
      SP.gH.t = cl(gYaw * .7, -.95, .95); SP.gT.t = cl(gYaw * .3, -.5, .5); SP.gP.t = cl(-gPit * .8, -.55, .3); SP.tH.t = cl(eT, -1.4, 1.4) * .6; SP.tT.t = cl(eT, -1.4, 1.4) * .2;
      paso(SP.gH, ds); paso(SP.gT, ds); paso(SP.gP, ds); paso(SP.tH, ds); paso(SP.tT, ds);
      SP.oX.t = cl((gYaw - SP.gH.x - SP.gT.x + (eT - SP.tH.x - SP.tT.x) * .5) * .06, -.032, .032); SP.oY.t = cl((gPit + SP.gP.x) * .06, -.03, .03); paso(SP.oX, ds); paso(SP.oY, ds);
      // ragdoll
      let L2 = 0; if (vol) { const base = Object.assign({}, p); L2 = volStep(ds, p, base); if (vol) { caraOv = vol.ph === 'aire' ? 'susto' : vol.ph === 'suelo' ? (vol.f > 1.3 ? 'mareado' : 'dolor') : 'cansado'; caraOvT = .1; } }
      // física secundaria
      derivs(p, ds);
      const lo = L2, wk = 1 - lo * .4, gn = 1 + lo * 1.5, ay = ayG + pA.y;
      SP.cabX.t = cl(-laz * .012 - ay * .004 - pA.tx * .004 * gn, -.5, .5); SP.cabZ.t = cl(lax * .012 - pA.tz * .004 * gn, -.5, .5); SP.cabY.t = cl(-pA.ty * .003 * gn, -.4, .4);
      SP.pelX.t = cl(-laz * .022 - ay * .006 - (pA.tx + pA.kx) * .008, -.8, .8) * GR; SP.pelZ.t = cl(lax * .022 - (pA.tz + pA.kz) * .008, -.8, .8) * GR;
      SP.colX.t = cl(-laz * .03 - ay * .008 - (pA.tx + pA.kx) * .01, -1, 1) * GR; SP.colZ.t = cl(lax * .03 - (pA.tz + pA.kz + pA.ty * .6) * .01, -1, 1) * GR;
      for (let i = 0; i < 2; i++) { SP.arX[i].t = cl(-laz * .03 - ay * .01 - pA.kx * .01, -.8, .8); SP.arZ[i].t = cl(lax * .03 - (pA.kz + pA.tz) * .01, -.8, .8); }
      SP.proX.t = cl(-laz * .03 - ay * .008 - pA.hDx * .008, -.6, .6); SP.proZ.t = cl(lax * .03, -.6, .6);
      SP.shI.t = cl(-ay * .004 - pA.tx * .006 * gn, -.5, .5); SP.shD.t = SP.shI.t; SP.szI.t = cl(Math.max(0, -ay) * .02 - lax * .004, -.4, .6); SP.szD.t = cl(Math.max(0, -ay) * .02 + lax * .004, -.4, .6);
      SP.elI.t = cl(-pA.hIx * .006 * gn, -.7, .7); SP.elD.t = cl(-pA.hDx * .006 * gn, -.7, .7);
      SP.esX.t = cl(ay * .004 - laz * .008 - pA.y * .002, -.3, .3); SP.esZ.t = cl(lax * .008, -.3, .3);
      SP.imX.t = 0; SP.imZ.t = 0; SP.imY.t = 0; SP.imS.t = 0;
      for (const k in SP) { const a = SP[k]; if (Array.isArray(a)) a.forEach((q) => paso(q, ds, wk)); else if (k[0] !== 'g' && k[0] !== 't' && k[0] !== 'o') paso(a, ds, k[0] === 'i' ? 1 : wk); }
      for (let i = 0; i < ctx.pose.length; i++) ctx.pose[i](p, ds, ctx);
      // aplicar a los huesos
      const sq = p.sq * (1 - land * .75) * (p.y > .06 ? 1 + cl(Math.abs(vy) * .025, 0, .1) : 1) * (1 - SP.imS.x * .5) * (1 + SP.imY.x * .3);
      const rxT = p.rx + softL(SP.imX.x), rzT = p.rz + softL(SP.imZ.x);
      raiz.rotation.set(rxT, 0, rzT);
      const pl = vol ? 0 : cl((1.15 - Math.abs(rxT) - Math.abs(rzT)) / .5, 0, 1), crx = Math.cos(rxT), srx = Math.sin(rxT), crz = Math.cos(rzT), srz = Math.sin(rzT);
      let ry = PV + p.ry + SP.imY.x * .12 + (1 - crx * crz) * PV * pl;
      if (Math.abs(rxT) + Math.abs(rzT) > .04) ry = Math.max(ry, hMin(rxT, rzT));
      raiz.position.set(p.px - srz * PV * pl, ry, p.pz + crz * srx * PV * pl);
      cad.position.set(p.sx, HIP + p.y, p.cx); cad.rotation.set(0, p.cy, p.cz);
      rig.scale.set(C.alto * (2 - sq) ** .5, C.alto * sq, C.alto * (2 - sq) ** .5);
      tor.rotation.set(p.tx + SP.esX.x, p.ty - p.cy + SP.gT.x + SP.tT.x + SP.esY.x, p.tz + SP.esZ.x);
      J.mI.rotation.set(p.mIx, 0, p.mIz); J.mD.rotation.set(p.mDx, 0, p.mDz); J.rI.rotation.x = p.rI; J.rD.rotation.x = p.rD;
      J.hI.rotation.set(p.hIx + SP.shI.x, p.hIy, Math.max(-1.55, p.hIz - SP.szI.x)); J.hD.rotation.set(p.hDx + SP.shD.x, p.hDy, Math.min(1.55, p.hDz + SP.szD.x));   // hombro: nunca más allá de la horizontal
      J.cI.rotation.x = Math.min(0, p.cI + SP.elI.x); J.cD.rotation.x = Math.min(0, p.cD + SP.elD.x);
      cab.rotation.set(cl(p.kx + SP.gP.x + SP.cabX.x, -.6, .32), cl(p.ky + SP.gH.x + SP.tH.x + SP.cabY.x, -1.4, 1.4), p.kz + SP.cabZ.x);   // la barbilla no se mete en el pecho
      pelG.rotation.set(SP.pelX.x, 0, SP.pelZ.x); colaG.rotation.set(SP.colX.x, 0, SP.colZ.x);
      for (let i = 0; i < aretesP.length; i++) aretesP[i].rotation.set(SP.arX[i].x, 0, SP.arZ[i].x);
      propP.rotation.set(SP.proX.x, 0, SP.proZ.x);
      cabK = cl(p.cab, 0, 1); if (pj.sinChoques) soltarBrazos(dt);
      let d = eT; rumboA += d * Math.min(1, dt * 12); g.rotation.y = rumboA;
      for (let i = 0; i < ctx.post.length; i++) ctx.post[i](dt, ctx);
      // cara: la que pide el juego; si es 'normal', la de la animación; y por encima la del gesto o el golpe
      caraOvT -= dt; if (caraOvT <= 0) caraOv = '';
      const want = caraOv || (caraN !== 'normal' ? caraN : (ANIM_CARA[animN] || 'normal'));
      if (want !== caraE && CARAS[want]) ponerCara(want);
      caraUpdate(dt, SP.oX.x + (gYaw || gPit ? 0 : vida.sx * .025 * vida.k), SP.oY.x + cl(vwy * .003, -.02, .02) + (gYaw || gPit ? 0 : vida.sy * .025 * vida.k));
      // efectos sobre la cabeza
      const fxOn = {}; if (ANIM_FX[animN]) fxOn[ANIM_FX[animN]] = 1; if (fxG2) fxOn[fxG2] = 1; for (const k in fxMan) if (fxMan[k]) fxOn[k] = 1;
      if (vol && vol.ph !== 'aire' && vol.f >= 1.3 && vol.ph !== 'sube') fxOn.estrellas = 1;
      for (const k in FX) { const on = !!fxOn[k]; if (FX[k].visible !== on) FX[k].visible = on; if (on) animFx(k, FX[k]); }
      return pj;
    }
  };
  function animFx(k, gr) {
    if (k === 'estrellas') gr.children.forEach((e) => { const a = t * 4.5 + e.userData.i * 2.094; e.position.set(Math.cos(a) * .44, Math.sin(t * 3 + e.userData.i) * .04, Math.sin(a) * .3); e.rotation.y = a * 2; e.scale.setScalar(.8 + .25 * Math.sin(t * 8 + e.userData.i)); });
    else if (k === 'zetas' || k === 'notas') gr.children.forEach((z) => { const ph = (t * .45 + z.userData.i * .5) % 1; z.position.set(.38 + ph * .3, ph * .5 - .05, 0); z.scale.setScalar(Math.max(.01, (.55 + ph * .7) * Math.sin(Math.min(1, ph * 1.2) * Math.PI))); });
    else if (k === 'gota') { const ph = (t * .7) % 1; gr.children[0].position.y = -.62 - ph * .22; gr.children[0].scale.setScalar(Math.max(.01, 1 - ph * ph * .9)); }
    else { const b = 1 + Math.sin(t * 7) * .08; gr.position.y = Math.sin(t * 4) * .03; gr.scale.setScalar(b); }
  }
  Object.assign(ctx, { pj: pj, g: g, J: J, raiz: raiz, rig: rig, cad: cad, tor: tor, cab: cab, C: C, L: L, HIP: HIP, PV: PV, KEYS: KEYS, LKEYS: LKEYS, SP: SP, LS: LS, paso: paso, rs: rs, cl: cl, lerp: lerp, sua: sua, wrap: wrap, cero: cero });
  Object.defineProperties(ctx, { vol: { get() { return vol; } }, rumbo: { get() { return rumboA; } }, anim: { get() { return animN; } }, uno: { get() { return uno ? unoN : ''; } }, spd: { get() { return spd; } }, vel: { get() { return { x: vwx, y: vwy, z: vwz }; } }, acel: { get() { return { x: awx, y: awy, z: awz }; } }, fase: { get() { return fase; } }, t: { get() { return t; } } });
  for (let i = 0; i < EXT.length; i++) EXT[i](pj, ctx);
  pj.update(0);
  return pj;
}


/* ───────────── catálogo (nombres, grupo y una línea por animación: lo usa el visor y la tabla del doc 15 §6) ───────────── */
const DESC = {
  anim: {
    quieto: ['Base', 'respira, carga el peso a un pie, mira alrededor; cada tanto una variante de espera al azar (bostezo, reloj, estirarse, rascarse, miradas)'],
    caminar: ['Locomoción', 'paso con cadera que baja al abrir, contragiro de pelvis y torso y cadencia atada a la velocidad real (el pie apoyado no patina)'],
    correr: ['Locomoción', 'zancada con vuelo, brazos que bombean, inclinación según la velocidad; al frenar derrapa y rebota'],
    cargar: ['Locomoción', 'algo sobre la cabeza, pasos medidos'], cansado: ['Locomoción', 'camina cansado: arrastra los pies, cabeza caída, jadea'],
    pesado: ['Locomoción', 'camina cargando peso en los brazos: echa el cuerpo atrás, pasos anchos y cortos'], asustado: ['Locomoción', 'corre asustado: manotea, mira atrás a cada rato'],
    sigilo: ['Locomoción', 'camina agachado y de puntitas, escaneando'], preparado: ['Locomoción', 'en guardia: agachado, rebotando sobre las puntas'], equilibrio: ['Locomoción', 'en un pie con los brazos abiertos corrigiendo'],
    jadeo: ['Locomoción', 'manos en las rodillas, resoplando (tras correr)'], agacharse: ['Locomoción', 'en cuclillas'], aire: ['Locomoción', 'en el aire: piernas recogidas, brazos arriba'],
    empujar: ['Esfuerzo', 'empuja algo con el cuerpo inclinado'], forcejear: ['Esfuerzo', 'forcejea contra otro (se ponen dos así de frente): gruñe, tiembla, clava los pies'],
    halar: ['Esfuerzo', 'tira de una cuerda: se echa atrás y de a tirones recoge los brazos'], trepar: ['Esfuerzo', 'trepa abrazado a la pared, mano y pie contrarios alternados'],
    colgar: ['Esfuerzo', 'colgado de las manos; péndulo, patalea si hay esfuerzo (vel)'], resbalar: ['Esfuerzo', 'patina sin control: brazos de molino, piernas abiertas'],
    nadar: ['Esfuerzo', 'crol boca abajo: brazadas de molino, patada, gira la cabeza a respirar'], chapotear: ['Esfuerzo', 'flota en vertical: bracea y pedalea bajo el agua'],
    montar: ['Esfuerzo', 'a horcajadas, rebotando al trote, agarrado de las riendas'], empujado: ['Esfuerzo', 'manotea para no caerse de espaldas'],
    celebrar: ['Victoria', 'salta y bombea los puños alternos'], victoria: ['Victoria', 'saltos de alegría: se agacha, despega con los puños en alto y cae amortiguando'],
    campeon: ['Victoria', 'pecho afuera, bíceps al aire, mentón arriba'], ganador: ['Victoria', 'baile del ganador estilo disco: dedo al cielo y caderas en shimmy'],
    rodillas: ['Victoria', 'de rodillas con los brazos al cielo, agradecido'], bailar: ['Victoria', 'baile de caderas y brazos'], animar: ['Victoria', 'hincha de la barra: brazos alternos arriba, saltitos'],
    triste: ['Derrota', 'hombros caídos, suspiros y de a ratos un sollozo'], derrota: ['Derrota', 'de rodillas con las manos en la cabeza, negando'],
    rabieta: ['Derrota', 'pataleta: patea el piso alterno y golpea el aire'], desplome: ['Derrota', 'tirado boca abajo, golpea el piso y patalea sollozando'], lloron: ['Derrota', 'manos tapando la cara, llora a hipidos'],
    provocar: ['Actitud', '"ven, ven" con una mano, la otra en la cadera, caderas desafiantes'], burla: ['Actitud', '"nananá": manos aleteando junto a las orejas, cabeza bamboleando'],
    reirse: ['Actitud', 'doblado de la risa con la mano en la panza'], senalar: ['Actitud', 'señala con el brazo estirado dando un empujoncito'],
    asentir: ['Actitud', '"sí, sí" con la cabeza'], negar: ['Actitud', '"no, no" con la cabeza y los hombros'], saludar: ['Actitud', 'saluda con la mano'], aplaudir: ['Actitud', 'aplaude'],
    gritar: ['Actitud', 'puños arriba, cabeza atrás, tembloroso'], impaciente: ['Actitud', 'brazos cruzados, taconea, resopla y mira de lado'], pensar: ['Actitud', 'mano al mentón, cabeza ladeada'],
    revolver: ['Actitud', 'revuelve la olla en círculos con la otra mano en la cintura'], asombrado: ['Actitud', 'boquiabierto, brazos medio abiertos'],
    dormitar: ['Reposo', 'de pie cabeceando: cae la cabeza y pega el brinco'], dormir: ['Reposo', 'acostado boca arriba, roncando, con zetas'], sentado: ['Reposo', 'sentado'],
    sentado_celebra: ['Reposo', 'sentado celebrando: puños arriba y rebotes'], sentado_miedo: ['Reposo', 'sentado encogido con las manos en la cara'],
    sentado_aburrido: ['Reposo', 'sentado derrumbado, barbilla en la mano, pie columpiando'], sentado_enojado: ['Reposo', 'sentado con los puños en las rodillas, taconeando'],
    retroceder: ['Locomoción', 'camina o trota de espaldas: el pie apoyado va hacia adelante y mira por encima del hombro'],
    carretilla: ['Esfuerzo', 'empuja una carretilla: manos a la cadera, cuerpo inclinado, sudando'], carga_tiro: ['Esfuerzo', 'arma un tiro: con vel sube la torsión y el temblor (se suelta con lanzar_arriba)'],
    halar_fuerte: ['Esfuerzo', 'tirón a muerte de la cuerda: pierna atrás recta, la de adelante flexionada, se hunde en cada tirón'],
    gatear: ['Esfuerzo', 'a gatas: mano y rodilla contrarias avanzan, la espalda se mece'], remar: ['Esfuerzo', 'sentado remando: palada rápida y vuelta lenta y estirada'], pescar: ['Esfuerzo', 'caña en la mano: espera, siente un picotazo y de pronto tira y recoge'],
    borde: ['Esfuerzo', 'agarrado de un borde con las dos manos, piernas buscando apoyo; a ratos la mano derecha se resbala y se recupera'], pared: ['Esfuerzo', 'pegado a la pared resbalando despacio y reagarrándose de golpe'],
    tambalear: ['Esfuerzo', 'al filo de caer: torso que va y viene, brazos en molino para recuperar el equilibrio'],
    grupo_salta: ['Victoria', 'saltos de alegría de todos AL UNÍSONO (reloj compartido), brazos en alto'],
    salsa: ['Baile', 'paso básico de salsa: peso de pie a pie, caderas en ocho, brazos doblados que se turnan, notas musicales'], robot: ['Baile', 'baile de robot: poses duras que saltan de golpe, cabeza que se traba'],
    twist: ['Baile', 'twist: bajito, caderas contra hombros, brazos doblados'], brincos: ['Baile', 'saltos de tijera: abre piernas y sube los brazos a cada salto'],
    mojado: ['Reacción', 'tirita abrazado'], mareado: ['Reacción', 'se bambolea en círculo'], aturdido: ['Reacción', 'en las nubes: cabeza en círculos, rodillas que fallan, estrellitas'], cubrirse: ['Reacción', 'agachado con los antebrazos sobre la cabeza']
  },
  uno: {
    saltar: ['Salto', 'agacha, estira al despegar, recoge y aplasta al caer'], festejo: ['Salto', 'salto con giro de torso y puños arriba'], giro: ['Salto', 'pirueta rápida con salto'],
    lanzar: ['Lanzar y golpear', 'lanzamiento clásico con anticipación'], lanzar_arriba: ['Lanzar y golpear', 'lanzamiento por encima (pesado): arma el brazo atrás y suelta con paso adelante'],
    lanzar_abajo: ['Lanzar y golpear', 'lanzamiento por debajo (bolos, lob): zancada y barrido hacia arriba'], lanzar_lado: ['Lanzar y golpear', 'lanzamiento lateral (frisbee): cruza el brazo y lo abre de latigazo'],
    pegar: ['Lanzar y golpear', 'puñetazo con anticipación'], empujon: ['Lanzar y golpear', 'empujón con las dos manos: carga, arremete y sostiene'],
    patear: ['Lanzar y golpear', 'patada: pierna atrás, golpe, continúa y salta en el otro pie'], cabecear: ['Lanzar y golpear', 'cabezazo: se agacha, salta, arquea y cabecea'],
    atrapar: ['Lanzar y golpear', 'atrapar: manos abiertas, contacto y amortigua al pecho'],
    esquivar: ['Esquivar', 'esquiva echándose atrás'], esquivar_izq: ['Esquivar', 'esquiva con un paso lateral a un lado'], esquivar_der: ['Esquivar', 'esquiva con un paso lateral al otro lado'],
    esquivar_abajo: ['Esquivar', 'se agacha para esquivar'], esquivar_salto: ['Esquivar', 'salta por encima con las piernas recogidas'], cubrir: ['Esquivar', 'se cubre la cabeza de golpe y aguanta'],
    golpe: ['Caídas', 'lo golpean: se dobla de golpe y rebota con resorte'], caer: ['Caídas', 'cae de espaldas con rebote'], tropezar: ['Caídas', 'tropieza hacia adelante y se recompone'],
    susto: ['Caídas', 'salta de la impresión (signo de exclamación)'], caer_atras: ['Caídas', 'cae de espaldas con ragdoll suave y se levanta'], caer_adelante: ['Caídas', 'cae de bruces con ragdoll suave y se levanta'],
    resbalon: ['Caídas', 'resbalón: los pies vuelan, cae de espaldas con ragdoll y se levanta'],
    si: ['Gestos', 'asiente con la cabeza'], no: ['Gestos', 'niega con la cabeza'], encoger: ['Gestos', 'se encoge de hombros (duda)'], facepalm: ['Gestos', 'se da una palmada en la cara'],
    sorpresa: ['Gestos', 'salta de sorpresa'], saludo: ['Gestos', 'saludo con la mano, una sola vez'], aplauso: ['Gestos', 'tres aplausos'], reverencia: ['Gestos', 'reverencia con la mano al pecho'],
    senal: ['Gestos', 'señala con anticipación'], pulgar: ['Gestos', 'pulgar arriba con guiño'], guino: ['Gestos', 'guiño con la cabeza ladeada'], eureka: ['Gestos', 'idea: dedo al cielo y bombillo'],
    duda: ['Gestos', 'manos abiertas, cabeza ladeada, signo de interrogación'], risa: ['Gestos', 'carcajada sacudiendo el cuerpo'], grito: ['Gestos', 'grito con la cabeza atrás'], puno: ['Gestos', 'puño al cielo'],
    chocala: ['Gestos', 'choca esos cinco'], derrapar: ['Gestos', 'derrape de freno con brazos abiertos'],
    voltereta: ['Esquivar', 'voltereta hacia adelante: el cuerpo gira entero 360° encogido (esquivar por abajo o entrar a un escenario)'],
    sacudirse: ['Acción', 'se sacude el agua como perro: vibra de cabeza a pies con gotas'], casco: ['Acción', 'se pone el casco con las dos manos, lo ajusta con golpecitos y queda orgulloso'],
    recoger: ['Acción', 'se agacha a recoger algo del piso, lo levanta con esfuerzo y se endereza contento'], izarse: ['Acción', 'sube a pulso a un borde: flexiona los brazos, patea y se sube'],
    tiron: ['Caídas', 'lo jalan de golpe: pierna adelante y cuerpo volcado hacia adelante (perder el tira y afloja)'], heroe: ['Caídas', 'aterrizaje de superhéroe: rodilla y puño al piso, mirada al frente, se levanta con pose'],
    abrazo: ['Gestos', 'abre los brazos y abraza apretando con un balanceo'], hombrazo: ['Gestos', 'se echa atrás y choca el hombro contra el de al lado'], beso: ['Gestos', 'tira un beso con la mano y un guiño, sale un corazoncito'],
    corazon: ['Gestos', 'forma un corazón con los brazos sobre la cabeza y late'], paz: ['Gestos', 'signo de paz junto a la cara con guiño'], callar: ['Gestos', 'dedo a la boca pidiendo silencio mientras vigila'], llamar: ['Gestos', 'llama con la mano: "ven, ven"'],
    saludo_militar: ['Gestos', 'saludo militar firme'], flexionar: ['Gestos', 'enseña los bíceps con orgullo'],
    bostezo: ['Espera', 'bosteza estirando'], reloj: ['Espera', 'mira el reloj de pulsera'], estirarse: ['Espera', 'se estira con los brazos arriba'], rascarse: ['Espera', 'se rasca la cabeza'], miradas: ['Espera', 'mira a un lado y al otro']
  },
  cara: {
    normal: 'sonrisa tranquila', feliz: 'ojos de arco y boca abierta', susto: 'ojos enormes, boca en O', triste: 'cejas caídas, lágrimas', enojado: 'cejas bravas', concentrado: 'ojos entornados, ceño',
    dormido: 'ojos cerrados', mareado: 'ojos que giran', dolor: 'ojos apretados, dientes', guino: 'un ojo cerrado, sonrisa ladeada', burla: 'lengua afuera', sorpresa: 'ojos muy abiertos, cejas arriba',
    risa: 'boca grande que ríe, ojos de arco', llorando: 'llanto con lágrimas cayendo', cansado: 'ojos pesados, boca jadeante', aburrido: 'párpados caídos, mira de lado', pensando: 'mira arriba, boca de lado',
    orgulloso: 'sonrisa ladeada, cejas altas', esfuerzo: 'dientes apretados, ojos apretados', miedo: 'ojos grandes, boca temblando', asco: 'mueca de asco', sueno: 'ojos casi cerrados',
    picaro: 'sonrisa traviesa, una ceja alta', gritando: 'grita con la boca enorme', bostezo: 'bostezo'
  },
  fx: { estrellas: 'estrellitas girando (aturdido)', gota: 'gota de sudor', zetas: 'zetas que suben (dormir)', interr: 'signo de pregunta', excl: 'signo de exclamación', bombilla: 'bombillo de idea', corazon: 'corazón que late (beso, abrazo, baile)', notas: 'notas musicales que suben (bailes)' }
};

const NUEVOS = { anim: ['retroceder', 'carretilla', 'carga_tiro', 'halar_fuerte', 'gatear', 'remar', 'pescar', 'borde', 'pared', 'tambalear', 'grupo_salta', 'salsa', 'robot', 'twist', 'brincos'],
  uno: ['voltereta', 'sacudirse', 'casco', 'recoger', 'izarse', 'tiron', 'heroe', 'abrazo', 'hombrazo', 'beso', 'corazon', 'paz', 'callar', 'llamar', 'saludo_militar', 'flexionar'] };
F.V3.PJ = { crear: crear, EXT: EXT, NUEVOS: NUEVOS, PERS: PERS, ELENCO: ELENCO, PROPS: PROPS, ids: () => Object.keys(ELENCO), DESC: DESC, FXS: Object.keys(DESC.fx),
  ANIMS: ['quieto', 'caminar', 'correr', 'cargar', 'celebrar', 'bailar', 'triste', 'mojado', 'sentado', 'empujar', 'saludar', 'aire', 'agacharse', 'empujado', 'gritar', 'aplaudir', 'mareado'].concat(Object.keys(DESC.anim).filter((k) => !['quieto', 'caminar', 'correr', 'cargar', 'celebrar', 'bailar', 'triste', 'mojado', 'sentado', 'empujar', 'saludar', 'aire', 'agacharse', 'empujado', 'gritar', 'aplaudir', 'mareado'].includes(k))),
  UNOS: ['saltar', 'lanzar', 'golpe', 'caer', 'festejo', 'pegar', 'esquivar', 'susto', 'tropezar'].concat(Object.keys(DESC.uno).filter((k) => !['saltar', 'lanzar', 'golpe', 'caer', 'festejo', 'pegar', 'esquivar', 'susto', 'tropezar'].includes(k))),
  CARAS: ['normal', 'feliz', 'susto', 'triste', 'enojado', 'concentrado', 'dormido', 'mareado'].concat(Object.keys(DESC.cara).filter((k) => !['normal', 'feliz', 'susto', 'triste', 'enojado', 'concentrado', 'dormido', 'mareado'].includes(k))) };

/* compatibilidad con la primera versión (V3.personaje + mover(estado)): los juegos 3D ya hechos siguen igual */
F.V3.personaje = function (ch, camisa) {
  const pj = crear(ch, { camisa: camisa, prop: false });
  pj.mover = function (estado, dt, op) {
    op = op || {}; const vel = op.vel || 0;
    if (estado === 'carga') pj.anim('cargar', { vel: vel }); else if (estado === 'celebra') pj.anim('celebrar');
    else if (estado === 'mojado') pj.anim(vel > .05 ? 'caminar' : op.sentado ? 'sentado' : 'mojado', { vel: vel });
    else if (estado === 'corre') pj.anim(vel > .55 ? 'correr' : 'caminar', { vel: vel }); else pj.anim('quieto');
    pj.cara(op.tiembla ? 'susto' : estado === 'mojado' ? 'triste' : estado === 'celebra' ? 'feliz' : estado === 'carga' ? 'concentrado' : 'normal');
    if (op.rumbo != null) pj.rumbo(op.rumbo);
    return pj.update(dt);
  };
  return pj;
};
})(typeof window !== 'undefined' ? window : this);
