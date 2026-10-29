// LA FIESTA · ragdoll físico de los personajes 3D (FIESTA.V3.PJ.EXT): cuerpo con masa por segmento, juntas con límites, piso, paredes, rodar y levantarse.
//
// ─── AUDITORÍA (qué tenía el "ragdoll" de fiesta-3d-pj.js antes de este archivo, comparado con un juego profesional) ───
//   · volar() era una parábola de UN solo punto con giro inventado y poses clave: ninguna extremidad tenía posición propia, así que no podían chocar con nada.
//   · No había masa por segmento: una pierna pesaba igual que la cabeza; un golpe en la cabeza o en la pierna daba exactamente el mismo vuelo.
//   · El piso solo se resolvía con 9 puntos fijos del cuerpo entero: brazos y piernas colgaban de resortes y atravesaban el piso al tumbarse.
//   · Sin fricción ni rebote reales: se frenaba con una exponencial; no rodaba ni arrastraba miembros; la caída era siempre la misma.
//   · Sin paredes, cajas ni props: nada reaccionaba a lo que el juego pusiera en la escena.
//   · Sin juntas reales: rodillas y codos podían doblarse al revés, el cuello y los hombros no tenían límite.
//   · La velocidad del grupo (correr y caer) no se heredaba: caía en el sitio.
//   · Todo o nada: un golpe fuerte tumbaba, uno suave hacía un resorte global; no había "me pegan en el pecho, el torso/brazos reaccionan y las piernas
//     siguen la animación".
//   · Nunca se dormía: la caída terminaba por reloj, no porque el cuerpo hubiera quedado quieto.
//
// ─── QUÉ HACE ESTE ARCHIVO ───
//   Un esqueleto de 17 partículas (verlet/PBD, paso fijo 1/120 s, sin asignaciones por cuadro, ~0.1 ms por personaje):
//     torso rígido de 8 partículas (cadera, pecho, hombros, cuello, frente) por "shape matching" · cabeza colgando del cuello · codos y manos · rodillas y tobillos.
//   Juntas: rodilla y codo SOLO se doblan en un sentido (bisagra en el plano del rig), cuello en cono, cadera y hombro con límites por eje.
//   Colisiones: piso (rebote, fricción de Coulomb, rodar, reposo sin hundirse), los colisionadores del juego (cajas, esferas, planos, cilindros),
//   el torso y la cabeza contra brazos y rodillas (la misma forma que usa pj.choques(): nada atraviesa el cuerpo), pierna con pierna.
//   Los huesos se escriben desde las partículas (ctx.post) y se MEZCLAN con la animación hueso por hueso:
//     animación → ragdoll (entra en ~0.1 s) · ragdoll parcial (solo la zona golpeada, el resto sigue la animación y se recompone) ·
//     ragdoll → animación (se levanta con la secuencia de fiesta-3d-pj.js, mezclando desde la pose física, con el giro de cómo quedó tirado).
//   Reposo: cuando todas las partículas casi no se mueven se duerme la simulación (cuesta cero) hasta el siguiente golpe.
//
// ─── API (todo lo viejo sigue igual: pj.volar, pj.impacto, pj.volando, pj.fase, pj.desplazamiento) ───
//   pj.ragdoll.golpe(donde, dir, fuerza)  donde = zona ('cabeza' 'torso' 'pelvis' 'brazoI' 'brazoD' 'manoI' 'manoD' 'piernaI' 'piernaD' 'pieI' 'pieD')
//                                         o un punto {x,y,z} (en el mundo) → se golpea la partícula más cercana. dir = {x,y,z} | [x,z] (mundo). Si es muy
//                                         fuerte (≥ 2.4) tumba; si ya está en el piso, empuja ese miembro; si está de pie, reacciona solo esa zona (parcial).
//   pj.ragdoll.parcial(zona, fuerza, dir) solo esa zona reacciona físicamente y se recompone; el resto sigue la animación
//   pj.ragdoll.activar({dx,dz,fuerza})    ragdoll completo y se queda así (muñeco) hasta pj.ragdoll.soltar(): entonces se levanta con la animación
//   pj.ragdoll.colisionadores             [] propios del personaje · V3.PJ.RAGDOLL.colisionadores = lo mismo para TODOS (el juego los registra una vez):
//                                         {tipo:'caja', min:{x,y,z}, max:{x,y,z}} (o centro/tam) · {tipo:'esfera', x,y,z,r} · {tipo:'plano', nx,ny,nz, d}
//                                         · {tipo:'cilindro', x,z,r,y0,y1} · opcional rebote / friccion · {tipo:'caja', obj: Object3D} usa su caja en el mundo
//   pj.ragdoll.activo · .estado ('' | 'parcial' | 'caida' | 'sube') · .dormido · .alcance (multiplica el tope visual si no hay mover:true)
//   Piso = g.position.y del personaje (el piso de los juegos). Los desplazamientos son visuales en la raíz; solo con {mover:true} se escribe g.position.
(function (root) {
'use strict';
const V3 = root.FIESTA && root.FIESTA.V3, T = root.THREE; if (!V3 || !V3.PJ || !T) return;
const RAG = V3.PJ.RAGDOLL = V3.PJ.RAGDOLL || { colisionadores: [] };

/* ───────────── el esqueleto: 17 partículas ───────────── */
const NP = 17, HL = 0, HR = 1, PU = 2, CH = 3, SL = 4, SR = 5, NK = 6, TF = 7, HD = 8, EL = 9, ER = 10, WL = 11, WR = 12, KL = 13, KR = 14, AL = 15, AR = 16;
//                  caderas   pelvis pecho hombros     cuello frente cabeza  codos      manos       rodillas      tobillos
const MASA = [3, 3, 3, 5, 2.5, 2.5, 2, 2, 8, 1.6, 1.6, 1.4, 1.4, 3.5, 3.5, 2.4, 2.4];
const WINV = MASA.map((m, i) => i < 8 ? 1 / 18 : 1 / m);                 // el torso pesa en las restricciones de distancia (además es rígido)
const RAD = [.14, .14, .25, .26, .09, .09, .2, .06, .46, .09, .09, .1, .1, .12, .12, .04, .04];     // radio de contacto con el piso/entorno (× alto)
const REB = [.28, .28, .28, .28, .25, .25, .25, .25, .35, .2, .2, .2, .2, .22, .22, .18, .18];       // rebote
const ROZ = [.7, .7, .75, .75, .8, .8, .75, .75, .6, .9, .9, .95, .95, .85, .85, .95, .95];           // fricción
const PIER = .31, HOM = .3, FOR = .33, CUE = .5, HIP = .62, TOR = .66;
const GRAV = 17, H = 1 / 120, ITER = 4, MAXPASOS = 8;
const TAU = Math.PI * 2, PI = Math.PI;
// zonas: [partícula, libertad 0..1] · "pto" = partícula que recibe el golpe
const ZONAS = {
  cabeza: { pto: HD, p: [[HD, 1], [NK, .5], [CH, .25], [SL, .15], [SR, .15]] },
  torso: { pto: CH, p: [[CH, 1], [NK, 1], [SL, 1], [SR, 1], [TF, 1], [PU, .35], [HD, 1], [EL, 1], [ER, 1], [WL, 1], [WR, 1]] },
  pelvis: { pto: PU, p: [[PU, 1], [HL, .5], [HR, .5], [CH, .6], [NK, .6], [SL, .6], [SR, .6], [TF, .6], [HD, .8], [EL, .8], [ER, .8], [WL, .8], [WR, .8], [KL, .5], [KR, .5], [AL, .3], [AR, .3]] },
  brazoI: { pto: EL, p: [[EL, 1], [WL, 1], [SL, .35]] }, brazoD: { pto: ER, p: [[ER, 1], [WR, 1], [SR, .35]] },
  manoI: { pto: WL, p: [[WL, 1], [EL, .6]] }, manoD: { pto: WR, p: [[WR, 1], [ER, .6]] },
  piernaI: { pto: KL, p: [[KL, 1], [AL, 1], [HL, .3], [PU, .15]] }, piernaD: { pto: KR, p: [[KR, 1], [AR, 1], [HR, .3], [PU, .15]] },
  pieI: { pto: AL, p: [[AL, 1], [KL, .7], [HL, .15]] }, pieD: { pto: AR, p: [[AR, 1], [KR, .7], [HR, .15]] }
};
ZONAS.pecho = ZONAS.torso; ZONAS.cuerpo = ZONAS.todo = ZONAS.pelvis;

const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const sua = (x) => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
function hashId(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h || 1; }

/* matriz de rotación (3 columnas en 9 números) desde un cuaternión [x,y,z,w] */
function cols(q, o) {
  const x = q[0], y = q[1], z = q[2], w = q[3], xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  o[0] = 1 - 2 * (yy + zz); o[1] = 2 * (xy + wz); o[2] = 2 * (xz - wy);
  o[3] = 2 * (xy - wz); o[4] = 1 - 2 * (xx + zz); o[5] = 2 * (yz + wx);
  o[6] = 2 * (xz + wy); o[7] = 2 * (yz - wx); o[8] = 1 - 2 * (xx + yy);
}
const _d = new Float64Array(3), _R = new Float64Array(9);
// objetos reutilizables (nada se crea por cuadro)
const qA = new T.Quaternion(), qB = new T.Quaternion(), qC = new T.Quaternion(), qD = new T.Quaternion(), qG = new T.Quaternion(), qGi = new T.Quaternion(), qRt = new T.Quaternion();
const vA = new T.Vector3(), vB = new T.Vector3(), vC = new T.Vector3(), vP = new T.Vector3(), vS = new T.Vector3(), eA = new T.Euler(0, 0, 0, 'XYZ'), bbox = new T.Box3();

V3.PJ.EXT.push(function (pj, ctx) {
  const J = ctx.J, g = ctx.g, C = ctx.C, L = ctx.L, PV = ctx.PV;
  const A = C.alto, W = C.ancho, Pn = C.panza, rT = .3 * W, SZ = .82 + Pn * .12;
  const volar0 = pj.volar, impacto0 = pj.impacto;
  const ad = {}; for (const a of (L.adornos || [])) ad[a] = 1;
  const RCAB = (.5 * 1.04 + (L.pelo === 'rizos' || L.pelo === 'rolos' ? .14 : ad.audifonos ? .1 : .05)) * A;       // la misma cabeza que usa pj.choques()
  const conProp = !!L.prop;
  // perfil del torso (igual que el torno de fiesta-3d-pj.js): lo usa pj.choques() y por eso lo usamos para empujar brazos y rodillas
  const perfil = [[0, -.04], [rT * .95, -.04], [rT * (1 + Pn * .28), .2], [rT * (1.02 + Pn * .2), .36], [rT * .96, .52], [rT * .7, TOR], [.08, TOR + .03], [0, TOR + .03]];
  function radioTorso(y) {
    if (y < perfil[0][1] - .04 || y > TOR + .06) return 0;
    for (let i = 1; i < perfil.length - 1; i++) if (y <= perfil[i][1]) { const a = perfil[i - 1], b = perfil[i], u = (y - a[1]) / Math.max(1e-4, b[1] - a[1]); return a[0] + (b[0] - a[0]) * cl(u, 0, 1); }
    return perfil[perfil.length - 2][0];
  }

  /* forma de reposo del torso (cuerpo del personaje de pie, origen en el centro de la cadera), en unidades de simulación */
  const rest = new Float64Array(24), qr = new Float64Array(24);
  const hx = rT * .86 + .05;
  const R0 = [[-.17 * W, 0, 0], [.17 * W, 0, 0], [0, .15, 0], [0, .4, 0], [-hx, .56, 0], [hx, .56, 0], [0, .68, 0], [0, .3, .22]];
  let MT = 0, c0x = 0, c0y = 0, c0z = 0;
  for (let i = 0; i < 8; i++) { for (let a = 0; a < 3; a++) rest[i * 3 + a] = R0[i][a] * A; MT += MASA[i]; c0x += MASA[i] * rest[i * 3]; c0y += MASA[i] * rest[i * 3 + 1]; c0z += MASA[i] * rest[i * 3 + 2]; }
  c0x /= MT; c0y /= MT; c0z /= MT;
  for (let i = 0; i < 8; i++) { qr[i * 3] = rest[i * 3] - c0x; qr[i * 3 + 1] = rest[i * 3 + 1] - c0y; qr[i * 3 + 2] = rest[i * 3 + 2] - c0z; }
  const LTH = PIER * A, LSH = PIER * A, LUA = HOM * A, LFA = FOR * A, LNK = CUE * A, RAD_A = RAD.map((r) => r * A);
  const PIV = PV - HIP * A;                          // del centro de la cadera al pivote (centro de masa) del rig

  /* ───────────── estado ───────────── */
  const X = new Float64Array(NP * 3), Xp = new Float64Array(NP * 3), T0 = new Float64Array(NP * 3), T1 = new Float64Array(NP * 3);
  const cn = new Float64Array(NP * 3), cvn = new Float64Array(NP), cpen = new Float64Array(NP), cfl = new Uint8Array(NP), cmu = new Float64Array(NP), cre = new Float64Array(NP);
  const Xf = new Float64Array(NP * 3), fr = new Float64Array(NP), aj = new Float64Array(NP), dmp = new Float64Array(NP), WB = new Float64Array(12);
  const S = {
    mode: 0, auto: false, fase: '', X: X, Xp: Xp, R: new Float64Array(9), qt: [0, 0, 0, 1], volRef: null,
    acc: 0, quiet: 0, dorm: false, tSuelo: 0, suelo: .6, wIn: 0, ox: 0, oy: PV, oz: 0, cap: 1, mover: false, alc: 1, f: 1,
    pT: 0, pDur: 1, pHold: .2, pA0: .02, pAmp: 1, cabMov: false, gpOk: false, tBlend: 0, psi0: 0, rngS: hashId(pj.id || 'x'), gSuelo: false, vmax: 0, lento: false,
    col: new Float64Array(32 * 10), ncol: 0
  };
  const rnd = () => { let t = (S.rngS += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  cols(S.qt, S.R);
  const gpos = new T.Vector3(), gsc = new T.Vector3(); let sc = 1, floorY = 0;
  const BONES = [J.raiz, J.cad, J.tor, J.cab, J.mI, J.rI, J.mD, J.rD, J.hI, J.cI, J.hD, J.cD];
  const Qf = []; for (let i = 0; i < 12; i++) Qf.push(new T.Quaternion());

  /* ───────────── muestreo del cuerpo animado (cinemática directa) → partículas en espacio de simulación (mundo / escala) ───────────── */
  function refrescaG() { g.updateMatrixWorld(true); g.matrixWorld.decompose(gpos, qG, gsc); sc = gsc.x || 1; qGi.copy(qG).invert(); floorY = gpos.y / sc; }
  function at(o, x, y, z, k, out) { vA.set(x, y, z).applyMatrix4(o.matrixWorld); out[k * 3] = vA.x / sc; out[k * 3 + 1] = vA.y / sc; out[k * 3 + 2] = vA.z / sc; }
  function muestrea(out) {
    at(J.mI, 0, 0, 0, HL, out); at(J.mD, 0, 0, 0, HR, out); at(J.cad, 0, .15, 0, PU, out); at(J.tor, 0, .4, 0, CH, out);
    at(J.hI, 0, 0, 0, SL, out); at(J.hD, 0, 0, 0, SR, out); at(J.tor, 0, TOR + .02, 0, NK, out); at(J.tor, 0, .3, .22, TF, out); at(J.cab, 0, 0, 0, HD, out);
    at(J.cI, 0, 0, 0, EL, out); at(J.cD, 0, 0, 0, ER, out); at(J.cI, 0, -FOR, 0, WL, out); at(J.cD, 0, -FOR, 0, WR, out);
    at(J.rI, 0, 0, 0, KL, out); at(J.rD, 0, 0, 0, KR, out); at(J.rI, 0, -PIER, 0, AL, out); at(J.rD, 0, -PIER, 0, AR, out);
  }
  function qDeCadera() { J.cad.getWorldQuaternion(qA); S.qt[0] = qA.x; S.qt[1] = qA.y; S.qt[2] = qA.z; S.qt[3] = qA.w; cols(S.qt, S.R); }

  /* ───────────── colisionadores del juego → arreglo plano en espacio de simulación ───────────── */
  const num = (v, d) => v == null ? d : +v;
  function preparaCol() {
    const C2 = S.col; let n = 0;
    const lista = [RAG.colisionadores, S.api.colisionadores];
    for (let li = 0; li < 2; li++) {
      const arr = lista[li]; if (!arr) continue;
      for (let i = 0; i < arr.length && n < 32; i++) {
        const c = arr[i]; if (!c || c.activo === false) continue; const o = n * 10; const t = c.tipo;
        if (t === 'caja') {
          let mnx, mny, mnz, mxx, mxy, mxz;
          if (c.obj) { c.obj.updateWorldMatrix(true, true); bbox.setFromObject(c.obj); mnx = bbox.min.x; mny = bbox.min.y; mnz = bbox.min.z; mxx = bbox.max.x; mxy = bbox.max.y; mxz = bbox.max.z; }
          else if (c.min && c.max) { mnx = c.min.x; mny = c.min.y; mnz = c.min.z; mxx = c.max.x; mxy = c.max.y; mxz = c.max.z; }
          else { const tx = c.tam ? c.tam.x : num(c.w, 1), ty = c.tam ? c.tam.y : num(c.h, 1), tz = c.tam ? c.tam.z : num(c.d, 1), cx = c.centro ? c.centro.x : num(c.x, 0), cy = c.centro ? c.centro.y : num(c.y, 0), cz = c.centro ? c.centro.z : num(c.z, 0);
            mnx = cx - tx / 2; mxx = cx + tx / 2; mny = cy - ty / 2; mxy = cy + ty / 2; mnz = cz - tz / 2; mxz = cz + tz / 2; }
          C2[o] = 1; C2[o + 1] = mnx / sc; C2[o + 2] = mny / sc; C2[o + 3] = mnz / sc; C2[o + 4] = mxx / sc; C2[o + 5] = mxy / sc; C2[o + 6] = mxz / sc;
        } else if (t === 'esfera') { C2[o] = 2; C2[o + 1] = num(c.x, 0) / sc; C2[o + 2] = num(c.y, 0) / sc; C2[o + 3] = num(c.z, 0) / sc; C2[o + 4] = num(c.r, 1) / sc; }
        else if (t === 'plano') { let nx = num(c.nx, 0), ny = num(c.ny, 1), nz = num(c.nz, 0); const m = Math.hypot(nx, ny, nz) || 1; nx /= m; ny /= m; nz /= m; C2[o] = 3; C2[o + 1] = nx; C2[o + 2] = ny; C2[o + 3] = nz; C2[o + 4] = num(c.d, 0) / sc / m; }
        else if (t === 'cilindro') { C2[o] = 4; C2[o + 1] = num(c.x, 0) / sc; C2[o + 2] = num(c.z, 0) / sc; C2[o + 3] = num(c.r, 1) / sc; C2[o + 4] = num(c.y0, 0) / sc; C2[o + 5] = num(c.y1, 9) / sc; }
        else continue;
        C2[o + 8] = c.friccion != null ? c.friccion : -1; C2[o + 9] = c.rebote != null ? c.rebote : -1; n++;
      }
    }
    S.ncol = n;
  }

  /* contacto de la partícula i: empuja n·pen; recuerda la normal y la velocidad de llegada (para rebote y fricción al final del paso) */
  function toca(i, nx, ny, nz, pen, mu, re) {
    const k = i * 3;
    if (!cfl[i]) { cfl[i] = 1; cn[k] = nx; cn[k + 1] = ny; cn[k + 2] = nz; cvn[i] = (X[k] - Xp[k]) * nx + (X[k + 1] - Xp[k + 1]) * ny + (X[k + 2] - Xp[k + 2]) * nz; cmu[i] = mu; cre[i] = re; }
    X[k] += nx * pen; X[k + 1] += ny * pen; X[k + 2] += nz * pen; cpen[i] += pen;
  }
  function entorno() {
    for (let i = 0; i < NP; i++) {
      const k = i * 3, r = RAD_A[i];
      let y = X[k + 1] - floorY; if (y < r) toca(i, 0, 1, 0, r - y, ROZ[i], REB[i]);
      for (let c = 0; c < S.ncol; c++) {
        const o = c * 10, t = S.col[o], mu = S.col[o + 8] >= 0 ? S.col[o + 8] : ROZ[i], re = S.col[o + 9] >= 0 ? S.col[o + 9] : REB[i], px = X[k], py = X[k + 1], pz = X[k + 2];
        if (t === 1) {
          const cx = cl(px, S.col[o + 1], S.col[o + 4]), cy = cl(py, S.col[o + 2], S.col[o + 5]), cz = cl(pz, S.col[o + 3], S.col[o + 6]), dx = px - cx, dy = py - cy, dz = pz - cz, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > 1e-12) { if (d2 < r * r) { const d = Math.sqrt(d2); toca(i, dx / d, dy / d, dz / d, r - d, mu, re); } }
          else {                                            // dentro de la caja (un largo fijo o el giro del torso lo metió): sale por la cara que mira al cuerpo, nunca por el otro lado
            const mnx = S.col[o + 1], mny = S.col[o + 2], mnz = S.col[o + 3], mxx = S.col[o + 4], mxy = S.col[o + 5], mxz = S.col[o + 6], bx = X[6], by = X[7], bz = X[8];     // bx..bz: la cadera (centro del cuerpo)
            const cx = bx < (mnx + mxx) / 2 ? px - mnx : mxx - px, cy = by < (mny + mxy) / 2 ? py - mny : mxy - py, cz = bz < (mnz + mxz) / 2 ? pz - mnz : mxz - pz;
            if (cx <= cy && cx <= cz) toca(i, bx < (mnx + mxx) / 2 ? -1 : 1, 0, 0, cx + r, mu, re);
            else if (cy <= cz) toca(i, 0, by < (mny + mxy) / 2 ? -1 : 1, 0, cy + r, mu, re);
            else toca(i, 0, 0, bz < (mnz + mxz) / 2 ? -1 : 1, cz + r, mu, re);
          }
        } else if (t === 2) {
          const dx = px - S.col[o + 1], dy = py - S.col[o + 2], dz = pz - S.col[o + 3], rr = r + S.col[o + 4], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-6; toca(i, dx / d, dy / d, dz / d, rr - d, mu, re); }
        } else if (t === 3) {
          const s = px * S.col[o + 1] + py * S.col[o + 2] + pz * S.col[o + 3] - S.col[o + 4]; if (s < r) toca(i, S.col[o + 1], S.col[o + 2], S.col[o + 3], r - s, mu, re);
        } else if (t === 4) {
          const dx = px - S.col[o + 1], dz = pz - S.col[o + 2], d = Math.hypot(dx, dz), rr = r + S.col[o + 3];
          if (py > S.col[o + 4] - r && py < S.col[o + 5] + r && d < rr) {
            const arriba = S.col[o + 5] + r - py, lado = rr - d;
            if (py > S.col[o + 5] - r * .3 && arriba < lado) toca(i, 0, 1, 0, arriba, mu, re); else if (d > 1e-6) toca(i, dx / d, 0, dz / d, lado, mu, re); else toca(i, 1, 0, 0, lado, mu, re);
          }
        }
      }
    }
  }

  /* ───────────── restricciones ───────────── */
  function dist(i, j, len) {
    const a = i * 3, b = j * 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz); if (l < 1e-9) return;
    const wi = WINV[i], wj = WINV[j], k = (l - len) / (l * (wi + wj));
    X[a] += wi * k * dx; X[a + 1] += wi * k * dy; X[a + 2] += wi * k * dz; X[b] -= wj * k * dx; X[b + 1] -= wj * k * dy; X[b + 2] -= wj * k * dz;
  }
  /* el torso es un cuerpo rígido: shape matching (rotación óptima por iteración del cuaternión, con arranque en caliente) */
  function torso() {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < 8; i++) { const m = MASA[i], k = i * 3; cx += m * X[k]; cy += m * X[k + 1]; cz += m * X[k + 2]; }
    cx /= MT; cy /= MT; cz /= MT;
    let a00 = 0, a01 = 0, a02 = 0, a10 = 0, a11 = 0, a12 = 0, a20 = 0, a21 = 0, a22 = 0;
    for (let i = 0; i < 8; i++) {
      const m = MASA[i], k = i * 3, px = (X[k] - cx) * m, py = (X[k + 1] - cy) * m, pz = (X[k + 2] - cz) * m, qx = qr[k], qy = qr[k + 1], qz = qr[k + 2];
      a00 += px * qx; a01 += px * qy; a02 += px * qz; a10 += py * qx; a11 += py * qy; a12 += py * qz; a20 += pz * qx; a21 += pz * qy; a22 += pz * qz;
    }
    const q = S.qt;
    for (let it = 0; it < 3; it++) {
      cols(q, _R);
      const ox = _R[1] * a20 - _R[2] * a10 + _R[4] * a21 - _R[5] * a11 + _R[7] * a22 - _R[8] * a12,
        oy = _R[2] * a00 - _R[0] * a20 + _R[5] * a01 - _R[3] * a21 + _R[8] * a02 - _R[6] * a22,
        oz = _R[0] * a10 - _R[1] * a00 + _R[3] * a11 - _R[4] * a01 + _R[6] * a12 - _R[7] * a02;
      const den = Math.abs(_R[0] * a00 + _R[1] * a10 + _R[2] * a20 + _R[3] * a01 + _R[4] * a11 + _R[5] * a21 + _R[6] * a02 + _R[7] * a12 + _R[8] * a22) + 1e-9;
      const wx = ox / den, wy = oy / den, wz = oz / den, w = Math.sqrt(wx * wx + wy * wy + wz * wz); if (w < 1e-9) break;
      const s = Math.sin(w / 2) / w, dx = wx * s, dy = wy * s, dz = wz * s, dw = Math.cos(w / 2);
      let nx = dw * q[0] + dx * q[3] + dy * q[2] - dz * q[1], ny = dw * q[1] - dx * q[2] + dy * q[3] + dz * q[0], nz = dw * q[2] + dx * q[1] - dy * q[0] + dz * q[3], nw = dw * q[3] - dx * q[0] - dy * q[1] - dz * q[2];
      const nn = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw); q[0] = nx * nn; q[1] = ny * nn; q[2] = nz * nn; q[3] = nw * nn;
    }
    const R = S.R; cols(q, R);
    for (let i = 0; i < 8; i++) { const k = i * 3, qx = qr[k], qy = qr[k + 1], qz = qr[k + 2]; X[k] = cx + R[0] * qx + R[3] * qy + R[6] * qz; X[k + 1] = cy + R[1] * qx + R[4] * qy + R[7] * qz; X[k + 2] = cz + R[2] * qx + R[5] * qy + R[8] * qz; }
  }
  /* aplica un desplazamiento relativo (dx,dy,dz) entre i (padre) y j (hijo) repartido por masa inversa */
  function reparte(i, j, dx, dy, dz) {
    const wi = i < 8 ? 0 : WINV[i], wj = WINV[j], s = wi + wj, ri = wi / s, rj = wj / s, a = i * 3, b = j * 3;            // el torso (rígido y pesado) no se mueve por una junta
    X[b] += dx * rj; X[b + 1] += dy * rj; X[b + 2] += dz * rj; X[a] -= dx * ri; X[a + 1] -= dy * ri; X[a + 2] -= dz * ri;
  }
  /* cono / límites de una junta esférica: la dirección local (x lado exterior, y arriba, z adelante) se recorta por eje */
  function recorta(d, sx, oMin, oMax, fMin, fMax, yMax) {
    let o = d[0] * sx, f = d[2], y = d[1]; const o0 = o, f0 = f, y0 = y;
    o = cl(o, oMin, oMax); f = cl(f, fMin, fMax); let r2 = o * o + f * f; if (r2 > 1) { const k = 1 / Math.sqrt(r2); o *= k; f *= k; r2 = 1; }
    let yy = Math.sqrt(1 - r2) * (y >= 0 ? 1 : -1);
    if (yy > yMax) { yy = yMax; const k = Math.sqrt(Math.max(0, 1 - yy * yy) / Math.max(1e-9, r2)); o *= k; f *= k; }
    d[0] = o * sx; d[1] = yy; d[2] = f;
    return Math.abs(o - o0) + Math.abs(f - f0) + Math.abs(yy - y0) > 1e-5;
  }
  /* muslo/brazo: dirección del segmento padre→hijo limitada en el marco del torso */
  function junta(h, k, len, sx, oMin, oMax, fMin, fMax, yMax) {
    const R = S.R, a = h * 3, b = k * 3; let dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2]; const l = Math.sqrt(dx * dx + dy * dy + dz * dz); if (l < 1e-9) return;
    dx /= l; dy /= l; dz /= l;
    _d[0] = dx * R[0] + dy * R[1] + dz * R[2]; _d[1] = dx * R[3] + dy * R[4] + dz * R[5]; _d[2] = dx * R[6] + dy * R[7] + dz * R[8];
    if (!recorta(_d, sx, oMin, oMax, fMin, fMax, yMax)) return;
    const nx = R[0] * _d[0] + R[3] * _d[1] + R[6] * _d[2], ny = R[1] * _d[0] + R[4] * _d[1] + R[7] * _d[2], nz = R[2] * _d[0] + R[5] * _d[1] + R[8] * _d[2];
    reparte(h, k, nx * len - (X[b] - X[a]), ny * len - (X[b + 1] - X[a + 1]), nz * len - (X[b + 2] - X[a + 2]));
  }
  /* bisagra de rodilla/codo: el segmento hijo vive en el plano (muslo, eje z local del muslo del rig) y se dobla solo hacia un lado.
     sgn=+1 codo (la mano va adelante) · -1 rodilla (el pie va atrás). Devuelve el ángulo de flexión; con aplica==true corrige la partícula. */
  const _h = new Float64Array(9);
  function bisagra(h, k, a, len2, sgn, phiMax, aplica) {
    const R = S.R, hb = h * 3, kb = k * 3, ab = a * 3;
    let tx = X[kb] - X[hb], ty = X[kb + 1] - X[hb + 1], tz = X[kb + 2] - X[hb + 2]; const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= l; ty /= l; tz /= l;
    const dy = tx * R[3] + ty * R[4] + tz * R[5], dz = tx * R[6] + ty * R[7] + tz * R[8], rho = Math.sqrt(dy * dy + dz * dz);
    const nly = rho > 1e-5 ? dz / rho : 0, nlz = rho > 1e-5 ? -dy / rho : 1;            // eje z local del muslo, en el marco del torso: (0, -sin x, cos x)
    const nx = R[3] * nly + R[6] * nlz, ny = R[4] * nly + R[7] * nlz, nz = R[5] * nly + R[8] * nlz;
    const sx = X[ab] - X[kb], sy = X[ab + 1] - X[kb + 1], sz = X[ab + 2] - X[kb + 2], sa = sx * tx + sy * ty + sz * tz, sb = sx * nx + sy * ny + sz * nz;
    const phi = cl(Math.atan2(sgn * sb, sa), -.03, phiMax);
    if (aplica) {
      const c = Math.cos(phi) * len2, s = Math.sin(phi) * len2 * sgn, ex = X[kb] + tx * c + nx * s, ey = X[kb + 1] + ty * c + ny * s, ez = X[kb + 2] + tz * c + nz * s;
      reparte(k, a, ex - X[ab], ey - X[ab + 1], ez - X[ab + 2]);
    }
    return phi;
  }
  function cuello() {
    const R = S.R, a = NK * 3, b = HD * 3; let dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2]; const l = Math.sqrt(dx * dx + dy * dy + dz * dz); if (l < 1e-9) return;
    dx /= l; dy /= l; dz /= l; const c = dx * R[3] + dy * R[4] + dz * R[5], cmin = .34;      // cono de ~70° alrededor de "arriba del torso"
    if (c >= cmin) return;
    let px = dx - R[3] * c, py = dy - R[4] * c, pz = dz - R[5] * c; const pl = Math.sqrt(px * px + py * py + pz * pz) || 1; const s = Math.sqrt(1 - cmin * cmin) / pl;
    px = R[3] * cmin + px * s; py = R[4] * cmin + py * s; pz = R[5] * cmin + pz * s;
    reparte(NK, HD, px * l - (X[b] - X[a]), py * l - (X[b + 1] - X[a + 1]), pz * l - (X[b + 2] - X[a + 2]));
  }
  function limites() {
    cuello();
    for (let s = 0; s < 2; s++) {
      const sx = s ? 1 : -1, hh = s ? HR : HL, kk = s ? KR : KL, aa = s ? AR : AL, ss = s ? SR : SL, ee = s ? ER : EL, ww = s ? WR : WL;
      junta(hh, kk, LTH, sx, -.35, .92, -.5, 1, .55); bisagra(hh, kk, aa, LSH, -1, 2.6, true);
      junta(ss, ee, LUA, sx, -.5, 1, -.8, 1, .98); bisagra(ss, ee, ww, LFA, 1, 2.7, true);
    }
  }
  /* nada atraviesa el cuerpo: codos, antebrazos, manos y rodillas fuera del torso (mismo perfil que pj.choques()); manos y codos fuera de la cabeza; piernas entre sí */
  function fueraTorso(i, r, i2) {
    const R = S.R, k = i * 3; let px = X[k], py = X[k + 1], pz = X[k + 2];
    if (i2 >= 0) { const k2 = i2 * 3; px = (px + X[k2]) * .5; py = (py + X[k2 + 1]) * .5; pz = (pz + X[k2 + 2]) * .5; }
    const dx = px - (X[0] + X[3]) * .5, dy = py - (X[1] + X[4]) * .5, dz = pz - (X[2] + X[5]) * .5, ia = 1 / A;
    const lx = (dx * R[0] + dy * R[1] + dz * R[2]) * ia, ly = (dx * R[3] + dy * R[4] + dz * R[5]) * ia, lz = (dx * R[6] + dy * R[7] + dz * R[8]) * ia;
    const rt = radioTorso(ly); if (rt <= 0) return;
    const ex = lx / (rt + r), ez = lz / (rt * SZ + r), e2 = ex * ex + ez * ez; if (e2 >= 1) return;
    let nx, nz; if (e2 < 1e-8) { nx = 0; nz = rt + r + .02; } else { const s = 1.03 / Math.sqrt(e2); nx = lx * s - lx; nz = lz * s - lz; }
    const wx = (R[0] * nx + R[6] * nz) * A, wy = (R[1] * nx + R[7] * nz) * A, wz = (R[2] * nx + R[8] * nz) * A;
    if ((cfl[i] || (i2 >= 0 && cfl[i2])) && wy < 0) {         // el miembro está en el piso y la salida es hacia abajo: sale de lado y el cuerpo se sube encima de él
      X[k] += wx; X[k + 2] += wz; if (i2 >= 0) { const k2 = i2 * 3; X[k2] += wx; X[k2 + 2] += wz; }
      for (let q = 0; q < 8; q++) { X[q * 3 + 1] -= wy; Xp[q * 3 + 1] -= wy; }                       // se sube sin ganar velocidad
      return;
    }
    X[k] += wx; X[k + 1] += wy; X[k + 2] += wz;
    if (i2 >= 0) { const k2 = i2 * 3; X[k2] += wx; X[k2 + 1] += wy; X[k2 + 2] += wz; }
  }
  function fueraCabeza(i, r, i2) {
    const k = i * 3, h = HD * 3; let px = X[k], py = X[k + 1], pz = X[k + 2];
    if (i2 >= 0) { const k2 = i2 * 3; px = (px + X[k2]) * .5; py = (py + X[k2 + 1]) * .5; pz = (pz + X[k2 + 2]) * .5; }
    const dx = px - X[h], dy = py - X[h + 1], dz = pz - X[h + 2], rr = RCAB + r, d2 = dx * dx + dy * dy + dz * dz; if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-6, s = (rr - d) / d;
    if (cfl[i] && dy > 0) {                                                                        // el miembro está en el piso, debajo de la cabeza: sale de lado y la cabeza se sube sobre él
      X[k] += dx * s; X[k + 2] += dz * s; if (i2 >= 0) { const k2 = i2 * 3; X[k2] += dx * s; X[k2 + 2] += dz * s; }
      const lev = dy * s; X[h + 1] -= lev; Xp[h + 1] -= lev; return;
    }
    X[k] += dx * s; X[k + 1] += dy * s; X[k + 2] += dz * s;
    if (i2 >= 0) { const k2 = i2 * 3; X[k2] += dx * s; X[k2 + 1] += dy * s; X[k2 + 2] += dz * s; }
  }
  function minDist(i, j, md) {
    const a = i * 3, b = j * 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d2 = dx * dx + dy * dy + dz * dz; if (d2 >= md * md) return;
    const d = Math.sqrt(d2) || 1e-6, k = (md - d) / d * .5; X[a] -= dx * k; X[a + 1] -= dy * k; X[a + 2] -= dz * k; X[b] += dx * k; X[b + 1] += dy * k; X[b + 2] += dz * k;
  }
  function cuerpo() {
    for (let s = 0; s < 2; s++) {
      const ee = s ? ER : EL, ww = s ? WR : WL, kk = s ? KR : KL;
      fueraTorso(ee, .105, -1); fueraTorso(ww, (conProp && s ? .275 : .12), -1); fueraTorso(ee, .095, ww); fueraTorso(kk, .1, -1);
      fueraCabeza(ww, (conProp && s ? .26 : .1) * A + .05 * A); fueraCabeza(ee, .09 * A + .05 * A); fueraCabeza(ee, .08 * A + .05 * A, ww);
    }
    minDist(KL, KR, .26 * A); minDist(AL, AR, .22 * A); minDist(KL, AR, .2 * A); minDist(KR, AL, .2 * A); minDist(WL, WR, .18 * A);
  }

  /* largos exactos al final del paso: lo que sale a los huesos tiene los largos del rig, así que la simulación también (sin dejar estiramientos de un impacto) */
  function fijo(i, j, len) {
    const a = i * 3, b = j * 3; let dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2]; const l = Math.sqrt(dx * dx + dy * dy + dz * dz); if (l < 1e-9) return; const k = len / l;
    X[b] = X[a] + dx * k; X[b + 1] = X[a + 1] + dy * k; X[b + 2] = X[a + 2] + dz * k;
  }
  function largos() { fijo(NK, HD, LNK); fijo(SL, EL, LUA); fijo(SR, ER, LUA); fijo(EL, WL, LFA); fijo(ER, WR, LFA); fijo(HL, KL, LTH); fijo(HR, KR, LTH); fijo(KL, AL, LSH); fijo(KR, AR, LSH); }

  /* ───────────── un paso fijo ───────────── */
  function paso(frac0, frac1, usaT) {
    for (let i = 0; i < NP; i++) {
      const k = i * 3, d = dmp[i];
      let vx = (X[k] - Xp[k]) * d, vy = (X[k + 1] - Xp[k + 1]) * d, vz = (X[k + 2] - Xp[k + 2]) * d;
      Xp[k] = X[k]; Xp[k + 1] = X[k + 1]; Xp[k + 2] = X[k + 2]; X[k] += vx; X[k + 1] += vy - GRAV * H * H; X[k + 2] += vz; cfl[i] = 0; cpen[i] = 0;
    }
    if (usaT) {                                       // el cuerpo animado tira de cada partícula (más fuerte donde la zona no es libre)
      for (let i = 0; i < NP; i++) {
        const a = aj[i]; if (a <= 0) continue; const k = i * 3;
        for (let c = 0; c < 3; c++) { const t1 = lerp(T0[k + c], T1[k + c], frac1), t0 = lerp(T0[k + c], T1[k + c], frac0); X[k + c] += a * (t1 - X[k + c]); Xp[k + c] += a * (t0 - Xp[k + c]); }
      }
    }
    for (let it = 0; it < ITER; it++) {
      dist(NK, HD, LNK); dist(SL, EL, LUA); dist(SR, ER, LUA); dist(EL, WL, LFA); dist(ER, WR, LFA); dist(HL, KL, LTH); dist(HR, KR, LTH); dist(KL, AL, LSH); dist(KR, AR, LSH);
      torso(); cuerpo(); entorno(); limites();          // las juntas van al final: lo que sale a los huesos (bisagras en su plano) es justo lo que quedó
    }
    torso(); largos(); entorno();
    // rebote y fricción de Coulomb en los contactos
    let vmax = 0;
    for (let i = 0; i < NP; i++) {
      const k = i * 3;
      if (cfl[i]) {
        const nx = cn[k], ny = cn[k + 1], nz = cn[k + 2]; let vx = X[k] - Xp[k], vy = X[k + 1] - Xp[k + 1], vz = X[k + 2] - Xp[k + 2];
        const vn0 = cvn[i], vn1 = vx * nx + vy * ny + vz * nz; let vn = vn1 > 0 ? vn1 : 0;
        const vnE = vn0 < -2.2 * H ? -vn0 * cre[i] : 0;                         // llegó rápido: rebota (menos que 2.2 u/s se queda pegado)
        vn = vnE > 0 ? vnE : Math.min(vn, cpen[i] > 0 ? 0 : vn);
        let tx = vx - vn1 * nx, ty = vy - vn1 * ny, tz = vz - vn1 * nz; const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tl > 1e-12) { const imp = Math.max(0, vn - vn0), k2 = Math.max(0, tl - cmu[i] * imp) / tl * (tl < 2 * H ? .94 : 1); tx *= k2; ty *= k2; tz *= k2; }      // (y un poco de roce de reposo cuando ya va lento)
        vx = tx + nx * vn; vy = ty + ny * vn; vz = tz + nz * vn; Xp[k] = X[k] - vx; Xp[k + 1] = X[k + 1] - vy; Xp[k + 2] = X[k + 2] - vz;
      }
      const sx = X[k] - Xp[k], sy = X[k + 1] - Xp[k + 1], sz = X[k + 2] - Xp[k + 2], v = Math.sqrt(sx * sx + sy * sy + sz * sz) / H; if (v > vmax) vmax = v;
    }
    S.vmax = vmax;
    // tope visual del desplazamiento (sin mover:true): una cuerda invisible desde el punto del juego
    if (!S.mover) {
      const gx = gpos.x / sc, gz = gpos.z / sc, px = (X[0] + X[3]) * .5 - gx, pz = (X[2] + X[5]) * .5 - gz, dm = Math.hypot(px, pz);
      if (dm > S.cap) {
        const k = (S.cap - dm) / dm, ddx = px * k, ddz = pz * k; let nx = px / dm, nz = pz / dm;
        for (let i = 0; i < NP; i++) {
          const q = i * 3; X[q] += ddx; X[q + 2] += ddz; Xp[q] += ddx; Xp[q + 2] += ddz;
          const vx = X[q] - Xp[q], vz = X[q + 2] - Xp[q + 2], vn = vx * nx + vz * nz; if (vn > 0) { Xp[q] += nx * vn; Xp[q + 2] += nz * vn; }
        }
      }
    }
  }

  /* ───────────── de las partículas a los huesos ───────────── */
  // peso = cuánto de la física (1) frente a la animación (0) para cada hueso: raiz cad tor cab mI rI mD rD hI cI hD cD
  function poner(i, qpf, qfis, w) {
    const o = BONES[i]; qA.copy(qpf).invert().multiply(qfis);
    if (w >= .999) o.quaternion.copy(qA); else if (w > .001) { qB.copy(o.quaternion); qB.slerp(qA, w); o.quaternion.copy(qB); }
    Qf[i].copy(qpf).multiply(o.quaternion);
  }
  function escribe() {
    const R = S.R;
    // marco del torso (mundo) y origen de la cadera
    qRt.set(S.qt[0], S.qt[1], S.qt[2], S.qt[3]);
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < 8; i++) { cx += MASA[i] * X[i * 3]; cy += MASA[i] * X[i * 3 + 1]; cz += MASA[i] * X[i * 3 + 2]; } cx /= MT; cy /= MT; cz /= MT;
    const ocx = cx - (R[0] * c0x + R[3] * c0y + R[6] * c0z), ocy = cy - (R[1] * c0x + R[4] * c0y + R[7] * c0z), ocz = cz - (R[2] * c0x + R[5] * c0y + R[8] * c0z);
    // raíz (pivote del centro de masa): posición local al grupo
    vP.set(ocx + R[3] * PIV, ocy + R[4] * PIV, ocz + R[5] * PIV).sub(vS.set(gpos.x / sc, gpos.y / sc, gpos.z / sc)).applyQuaternion(qGi);
    const wr = WB[0];
    if (wr > .001) ctx.rig.scale.lerp(vS.set(A, A, A), wr);                    // sin aplastar/estirar la animación: el cuerpo físico tiene sus largos reales
    if (wr >= .999) J.raiz.position.copy(vP); else if (wr > .001) J.raiz.position.lerp(vP, wr);
    S.ox = vP.x; S.oz = vP.z; S.oy = vP.y;
    poner(0, qG, qRt, WB[0]);
    if (WB[1] > .001) { J.cad.position.lerp(vS.set(0, HIP, 0), WB[1]); }
    poner(1, Qf[0], qRt, WB[1]);
    poner(2, Qf[1], qRt, WB[2]);
    // piernas y brazos: ángulos de Euler (x,0,z) del segmento padre→hijo en el marco del torso; la bisagra va en x del hijo
    for (let s = 0; s < 2; s++) {
      const hh = s ? HR : HL, kk = s ? KR : KL, aa = s ? AR : AL, ss = s ? SR : SL, ee = s ? ER : EL, ww = s ? WR : WL, bm = s ? 6 : 4, bc = s ? 10 : 8;
      for (let p = 0; p < 2; p++) {
        const a = (p ? ss : hh) * 3, b = (p ? ee : kk) * 3; let dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2]; const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= l; dy /= l; dz /= l;
        const lx = dx * R[0] + dy * R[1] + dz * R[2], ly = dx * R[3] + dy * R[4] + dz * R[5], lz = dx * R[6] + dy * R[7] + dz * R[8];
        const rho = Math.sqrt(ly * ly + lz * lz), ex = rho > 1e-5 ? Math.atan2(-lz, -ly) : 0, ez = Math.asin(cl(lx, -1, 1));
        eA.set(ex, 0, ez); qC.setFromEuler(eA); qD.copy(qRt).multiply(qC);
        const bi = p ? bc : bm; poner(bi, Qf[p ? 2 : 1], qD, WB[bi]);                       // hombro cuelga del torso, muslo de la cadera
        const phi = p ? bisagra(ss, ee, ww, LFA, 1, 2.7, false) : bisagra(hh, kk, aa, LSH, -1, 2.6, false);
        eA.set(p ? -phi : phi, 0, 0); qC.setFromEuler(eA); qD.multiply(qC); poner(bi + 1, Qf[bi], qD, WB[bi + 1]);
      }
    }
    // cabeza: cuelga del cuello; gira alrededor de la base del cuello (cab.position) y se inclina hacia donde la lleva la partícula
    { const a = NK * 3, b = HD * 3; let dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2]; const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= l; dy /= l; dz /= l;
      vB.set(dx * R[0] + dy * R[1] + dz * R[2], dx * R[3] + dy * R[4] + dz * R[5], dx * R[6] + dy * R[7] + dz * R[8]);
      vC.set(0, 1, 0); qC.setFromUnitVectors(vC, vB); qD.copy(qRt).multiply(qC);
      const w = WB[3]; if (w > .001) { J.cab.position.lerp(vB.multiplyScalar(CUE), w); S.cabMov = true; }
      poner(3, Qf[2], qD, w); }
  }

  /* ───────────── puesta en marcha ───────────── */
  const ES = { x: 0, y: 0, z: 0 };
  function dampings(libre, extra) { for (let i = 0; i < NP; i++) dmp[i] = 1 - H * (.9 + (libre ? 7 * fr[i] : 0) + (extra || 0)); }
  function velocidadGrupo(out) { const v = ctx.vel; out.x = v.x; out.y = 0; out.z = v.z; return out; }
  function inicia(desdeFK) {
    refrescaG(); preparaCol(); S.gpOk = false;
    if (desdeFK) { muestrea(X); qDeCadera(); }
    for (let i = 0; i < NP * 3; i++) { Xp[i] = X[i]; T0[i] = X[i]; T1[i] = X[i]; }
    const vg = velocidadGrupo(ES);
    for (let i = 0; i < NP; i++) { const k = i * 3; Xp[k] -= vg.x * H; Xp[k + 2] -= vg.z * H; }
    S.acc = 0; S.quiet = 0; S.dorm = false;
  }
  function comMasa(out) { let m = 0, x = 0, y = 0, z = 0; for (let i = 0; i < NP; i++) { m += MASA[i]; x += MASA[i] * X[i * 3]; y += MASA[i] * X[i * 3 + 1]; z += MASA[i] * X[i * 3 + 2]; } out[0] = x / m; out[1] = y / m; out[2] = z / m; }
  const _com = new Float64Array(3);
  /* velocidad inicial de la caída: lineal + giro alrededor del centro de masa + un aleteo propio de cada miembro */
  function lanza(vx, vy, vz, wx, wy, wz, aleteo) {
    comMasa(_com);
    for (let i = 0; i < NP; i++) {
      const k = i * 3, rx = X[k] - _com[0], ry = X[k + 1] - _com[1], rz = X[k + 2] - _com[2];
      let ux = vx + wy * rz - wz * ry, uy = vy + wz * rx - wx * rz, uz = vz + wx * ry - wy * rx;
      if (i >= EL && aleteo) { const m = (i >= KL ? .55 : i >= EL && i <= ER ? .9 : 1.1) * aleteo; ux += (rnd() - .5) * 2 * m; uy += (rnd() - .2) * m; uz += (rnd() - .5) * 2 * m; }
      Xp[k] -= ux * H; Xp[k + 1] -= uy * H; Xp[k + 2] -= uz * H;
    }
  }
  function arrancaCaida(v) {      // nace de la maquinaria vieja (pj.volar, uno('caer_atras')…): usamos sus parámetros
    const previo = S.mode === 3;
    if (!previo) inicia(true); else { refrescaG(); preparaCol(); }
    S.mode = 1; S.auto = true; S.volRef = v; S.f = v.f; S.mover = v.mover === true; S.alc = v.cap || 1; S.cap = Math.max(.6, 2 * S.alc); S.suelo = (v.suelo == null ? .6 : v.suelo) + .3;
    S.fase = 'aire'; S.tSuelo = 0; S.wIn = previo ? 1 : 0; S.cabMov = S.cabMov; S.gSuelo = false; S.dorm = false; S.quiet = 0; fr.fill(0); dampings(false); aj.fill(0);
    vC.set(v.hx || 0, v.vy || 0, v.hz || 0).applyQuaternion(qG);                       // la velocidad de la maquinaria vieja está en el marco del grupo
    vB.set(v.wx || 0, 0, v.wz || 0).applyQuaternion(qG);
    lanza(vC.x, vC.y, vC.z, vB.x, vB.y, vB.z, 1.4 + v.f * .5);
  }
  function arrancaManual(dx, dz, f, aleteo) {
    S.auto = false; S.mode = 1; S.volRef = null; inicia(true); S.f = f; S.mover = false; S.alc = S.api.alcance || 1; S.cap = Math.max(.6, 2 * S.alc); S.suelo = .6; S.fase = 'aire'; S.tSuelo = 0; S.wIn = 0; S.gSuelo = false;
    fr.fill(0); dampings(false); aj.fill(0);
    const m = Math.hypot(dx, dz) || 1; dx /= m; dz /= m; f = f == null ? 0 : f;
    lanza(dx * 2.2 * f, f > 0 ? 2 + f : 0, dz * 2.2 * f, -dz * (1.5 + f), 0, dx * (1.5 + f), aleteo == null ? .8 * f : aleteo);
  }

  /* ───────────── golpes sobre partículas ───────────── */
  function dirMundo(dir, y) {
    if (!dir) return vC.set(0, 0, -1).normalize();
    if (Array.isArray(dir)) vC.set(dir[0] || 0, dir.length > 2 ? dir[1] : y, dir.length > 2 ? dir[2] : dir[1] || 0); else vC.set(dir.x || 0, dir.y == null ? y : dir.y, dir.z || 0);
    return vC.length() < 1e-6 ? vC.set(0, 0, -1) : vC.normalize();
  }
  function particulaMasCercana(p) { // p {x,y,z} en el mundo
    let b = 0, bd = 1e9, src = X; if (!S.mode) { refrescaG(); muestrea(T1); src = T1; }          // de pie: se mira el cuerpo animado tal como está ahora
    const px = p.x / sc, py = p.y / sc, pz = p.z / sc;
    for (let i = 0; i < NP; i++) { const k = i * 3, d = (src[k] - px) ** 2 + (src[k + 1] - py) ** 2 + (src[k + 2] - pz) ** 2; if (d < bd) { bd = d; b = i; } }
    return b;
  }
  function zonaDe(donde) {
    if (typeof donde === 'string') return ZONAS[donde] || ZONAS.torso;
    if (donde && typeof donde === 'object' && 'x' in donde) { const i = particulaMasCercana(donde); for (const k in ZONAS) if (ZONAS[k].pto === i) return ZONAS[k]; return { pto: i, p: [[i, 1]] }; }
    return ZONAS.torso;
  }
  function empuja(zona, dir, f, k, ay) {            // velocidad a las partículas de la zona (k = u/s por unidad de fuerza, ay = cuánto sube el golpe si no trae altura)
    dirMundo(dir, ay == null ? .25 : ay); const dx = vC.x, dy = vC.y, dz = vC.z;
    for (const [i, w] of zona.p) { const q = i * 3, s = f * k * w * (i === zona.pto ? 1 : .7); Xp[q] -= dx * s * H; Xp[q + 1] -= dy * s * H; Xp[q + 2] -= dz * s * H; }
    S.dorm = false; S.quiet = 0;
  }
  function golpeCaido(donde, dir, f) {
    const z = zonaDe(donde); empuja(z, dir, f, 6.5);
    dirMundo(dir, .25); const dx = vC.x, dy = vC.y, dz = vC.z; for (let i = 0; i < NP; i++) { const q = i * 3; Xp[q] -= dx * f * 1.6 * H; Xp[q + 1] -= dy * f * 1.6 * H; Xp[q + 2] -= dz * f * 1.6 * H; }
    if (S.fase === 'suelo' && S.auto) S.tSuelo = Math.min(S.tSuelo, Math.max(0, S.suelo - .35));        // otro golpe: tarda más en levantarse
  }
  function arrancaParcial(zona, f, dir) {
    if (S.mode === 0) { inicia(true); S.mode = 3; S.pT = 0; fr.fill(0); }
    if (S.mode !== 3) return;
    for (const [i, w] of zona.p) fr[i] = Math.max(fr[i], w);
    S.pT = Math.min(S.pT, .05); S.pHold = .12 + .05 * Math.min(f, 3); S.pDur = .75 + .3 * Math.min(f, 3); S.pA0 = cl(.034 - .008 * f, .008, .03); S.pAmp = f;
    dampings(true); empuja(zona, dir, f, zona === ZONAS.cabeza ? 4.3 : zona.pto >= KL ? 10 : zona.pto === PU ? 11 : 7.5, zona.pto >= KL ? .5 : .25);
  }

  /* ───────────── levantarse: la maquinaria vieja (secuencia por poses) tomando el relevo desde la pose física ───────────── */
  function tendido() {              // cómo quedó el cuerpo (tipo y giro respecto al grupo) para que la secuencia vieja arranque igual
    const R = S.R; vA.set(R[3], R[4], R[5]).applyQuaternion(qGi); vB.set(R[6], R[7], R[8]).applyQuaternion(qGi);       // arriba del torso y su frente, en el marco del grupo
    const ux = vA.x, uz = vA.z, fy = vB.y, fh = Math.hypot(vB.x, vB.z); let tipo, psi, rx = 0, rz = 0;
    if (fy > .35) { tipo = 'espalda'; psi = Math.atan2(-ux, -uz); rx = -PI / 2; }
    else if (fy < -.35) { tipo = 'pecho'; psi = Math.atan2(ux, uz); rx = PI / 2; }
    else { const cr = uz * vB.x - ux * vB.z; if (cr < 0) { tipo = 'ladoA'; psi = Math.atan2(-uz, ux); rz = -PI / 2; } else { tipo = 'ladoB'; psi = Math.atan2(uz, -ux); rz = PI / 2; } }
    if (Math.hypot(ux, uz) < .25) psi = Math.atan2(vB.x, vB.z);
    return { tipo: tipo, psi: psi, rx: rx, rz: rz };
  }
  function empiezaSube() {
    const v = ctx.vol; if (!v) return;
    refrescaG(); const t = tendido(); S.psi0 = wrapPi(t.psi);
    v.ph = 'suelo'; v.cae = true; v.vy = 0; v.t = v.suelo + 1; v.eje = t.tipo === 'ladoA' || t.tipo === 'ladoB' ? 'z' : 'x'; v.up = t.tipo === 'espalda' || v.eje === 'z';
    v.rx = t.rx; v.rz = t.rz; v.tgx = t.rx; v.tgz = t.rz; v.wx = 0; v.wz = 0; v.hx = 0; v.hz = 0; v.lx = t.tipo === 'ladoA' ? 1 : t.tipo === 'ladoB' ? -1 : (rnd() < .5 ? 1 : -1); v.lz = t.tipo === 'espalda' ? -1 : 1;
    v.ox = S.ox; v.oz = S.oz; v.y = -PV; v.f = Math.max(v.f, .01);
    for (let i = 0; i < NP * 3; i++) { T0[i] = X[i]; T1[i] = X[i]; } fr.fill(1); dampings(true); S.mode = 2; S.fase = 'sube'; S.tBlend = 0; S.dorm = false; S.acc = 0;
  }
  const wrapPi = (a) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };

  function pideLevantar() {         // lo llama el cuerpo cuando ya reposó (auto) o el juego con soltar()
    if (S.mode !== 1) return;
    if (!ctx.vol) { S.volRef = null; volar0(0, -1, .2, { giro: 0, suelo: 0 }); S.volRef = ctx.vol; }
    empiezaSube();
  }

  /* ───────────── ganchos del kit ───────────── */
  ctx.pose.push(function (p, dt) {
    // rodillas/codos se escriben solo en x: limpia lo que dejó el ragdoll en y,z
    J.rI.rotation.y = J.rI.rotation.z = J.rD.rotation.y = J.rD.rotation.z = J.cI.rotation.y = J.cI.rotation.z = J.cD.rotation.y = J.cD.rotation.z = 0;
    if (S.cabMov) { J.cab.position.set(0, .5, 0); S.cabMov = false; }
    const v = ctx.vol;
    if (v && v !== S.volRef && S.mode !== 1) arrancaCaida(v);
    else if (!v && S.volRef) { S.volRef = null; if (S.mode === 2 || (S.mode === 1 && S.auto)) { S.mode = 0; S.fase = ''; } }
  });

  ctx.post.push(function (dt) {
    if (!S.mode) return;
    dt = Math.min(dt, .05);
    const gx0 = gpos.x, gz0 = gpos.z; refrescaG(); preparaCol();
    if (S.gpOk && S.mode !== 2 && Math.hypot(gpos.x - gx0, gpos.z - gz0) > 1.2) { const tx = (gpos.x - gx0) / sc, tz = (gpos.z - gz0) / sc; for (let i = 0; i < NP; i++) { X[i * 3] += tx; X[i * 3 + 2] += tz; Xp[i * 3] += tx; Xp[i * 3 + 2] += tz; } }      // el juego movió al personaje de golpe (respawn…): el cuerpo va con él
    S.gpOk = true;
    if (S.mode === 2) { subeMezcla(dt); return; }
    if (S.mode === 3) { parcialPaso(dt); return; }
    // ── caída completa ──
    S.wIn = Math.min(1, S.wIn + dt / .1); WB.fill(sua(S.wIn));
    S.acc += dt; let n = 0; if (dt > 0) Xf.set(X);
    if (!S.dorm) { while (S.acc >= H && n < MAXPASOS) { paso(0, 1, false); S.acc -= H; n++; } if (S.acc > 3 * H) S.acc = 0; } else S.acc = 0;
    // fases y reposo
    if (n) {
      let apoyo = false; for (let i = 0; i <= HD; i++) if (cfl[i] && i !== TF) apoyo = true;
      if (apoyo && !S.gSuelo) { S.gSuelo = true; S.fase = 'suelo'; S.tSuelo = 0; }
      let vf = 0, vm = 0; for (let i = 0; i < NP * 3; i += 3) { const d = Math.hypot(X[i] - Xf[i], X[i + 1] - Xf[i + 1], X[i + 2] - Xf[i + 2]) / dt; vm += d; if (d > vf) vf = d; } vm /= NP; S.vmax = vf;      // velocidad media del cuadro (no la de cada subpaso: evita el temblor)
      if (vm < .25 && vf < 1.4) S.quiet += dt; else S.quiet = 0;
      const lento = S.gSuelo && vm < .9; if (lento !== S.lento) { S.lento = lento; dampings(false, lento ? 7 : 0); }          // ya tirado y casi quieto: se frena solo (sin deslizarse eternamente)
      if (S.quiet > .6 && S.gSuelo) S.dorm = true;
    }
    if (S.gSuelo) S.tSuelo += dt;
    sincronizaVieja();
    escribe();
    if (S.auto && S.gSuelo && S.tSuelo >= S.suelo && (S.dorm || S.vmax < .8 || S.tSuelo >= S.suelo + 2.2)) pideLevantar();
  });
  /* mantiene a la maquinaria vieja en la misma fase (la cara, las estrellitas y los tiempos dependen de ella) sin dejar que haga su propia caída */
  function sincronizaVieja() {
    const v = ctx.vol; if (!v || S.mode !== 1) return;
    if (!S.gSuelo) { v.ph = 'aire'; v.cae = false; v.y = Math.max(.1, S.oy - PV); v.vy = 0; v.t = 0; v.rx = v.rz = 0; v.wx = v.wz = 0; v.hx = v.hz = 0; }
    else { v.ph = 'suelo'; v.cae = true; v.vy = 0; v.t = 0; v.wx = v.wz = 0; v.hx = v.hz = 0; }
    v.ox = S.ox; v.oz = S.oz;
  }
  /* mezcla física → animación: la secuencia de levantarse (maquinaria vieja) es el objetivo; las partículas siguen tirando hacia ella cada vez más fuerte
     (así el cuerpo se empuja desde donde quedó, sin atravesar piso ni torso) y los huesos pasan de la física a la animación al final */
  function subeMezcla(dt) {
    const v = ctx.vol; if (!v) { S.mode = 0; S.fase = ''; return; }
    S.tBlend += dt; const u = cl(v.t / Math.max(.01, v.dur), 0, 1), k = sua(S.tBlend / .6);
    qA.setFromAxisAngle(vA.set(0, 1, 0), S.psi0 * (1 - sua(u / .8))); J.raiz.quaternion.premultiply(qA);       // el giro con el que quedó tirado se va deshaciendo
    if (k >= 1) { S.ox = J.raiz.position.x; S.oz = J.raiz.position.z; return; }
    g.updateMatrixWorld(true); muestrea(T1);
    const a = .02 + .98 * k * k; for (let i = 0; i < NP; i++) aj[i] = a;
    S.acc += dt; const total = Math.max(1, Math.min(MAXPASOS, Math.floor(S.acc / H))); let n = 0;
    while (S.acc >= H && n < MAXPASOS) { paso(n / total, (n + 1) / total, true); S.acc -= H; n++; } if (S.acc > 3 * H) S.acc = 0;
    for (let i = 0; i < NP * 3; i++) T0[i] = T1[i];
    WB.fill(1 - k); escribe();
  }
  function parcialPaso(dt) {
    S.pT += dt; const env = S.pT < S.pHold ? 1 : 1 - sua((S.pT - S.pHold) / Math.max(.05, S.pDur - S.pHold));
    if (S.pT >= S.pDur) { S.mode = 0; S.fase = ''; fr.fill(0); return; }
    muestrea(T1);
    for (let i = 0; i < NP; i++) aj[i] = 1 - (1 - S.pA0) * fr[i] * env;
    dampings(true);
    S.acc += dt; const total = Math.max(1, Math.min(MAXPASOS, Math.floor(S.acc / H))); let n = 0;
    while (S.acc >= H && n < MAXPASOS) { paso(n / total, (n + 1) / total, true); S.acc -= H; n++; } if (S.acc > 3 * H) S.acc = 0;
    for (let i = 0; i < NP * 3; i++) T0[i] = T1[i];
    const e = env * 1.15; WB[0] = WB[1] = cl(Math.max(fr[HL], fr[HR], fr[PU]) * e, 0, 1); WB[2] = cl(Math.max(fr[CH], fr[NK]) * e, 0, 1); WB[3] = cl(fr[HD] * e, 0, 1);
    WB[4] = cl(fr[KL] * e, 0, 1); WB[5] = cl(fr[AL] * e, 0, 1); WB[6] = cl(fr[KR] * e, 0, 1); WB[7] = cl(fr[AR] * e, 0, 1);
    WB[8] = cl(fr[EL] * e, 0, 1); WB[9] = cl(fr[WL] * e, 0, 1); WB[10] = cl(fr[ER] * e, 0, 1); WB[11] = cl(fr[WR] * e, 0, 1);
    // un hueso padre libre arrastra a los hijos: nadie queda con menos peso que su padre
    WB[3] = Math.max(WB[3], WB[2] * .6); for (const [h, k, s] of [[8, 9, 0], [10, 11, 0]]) { WB[h] = Math.max(WB[h], WB[2] * .8); WB[k] = Math.max(WB[k], WB[h] * .5); }
    escribe();
  }

  /* ───────────── API pública ───────────── */
  S.api = pj.ragdoll = {
    colisionadores: [], alcance: 1,
    get activo() { return S.mode === 1 || S.mode === 3 || S.mode === 2; },
    get estado() { return S.mode === 1 ? 'caida' : S.mode === 2 ? 'sube' : S.mode === 3 ? 'parcial' : ''; },
    get dormido() { return S.mode === 1 && S.dorm; },
    get particulas() { return X; },
    zonas: Object.keys(ZONAS),
    activar: function (o) { o = o || {}; if (S.mode === 1) return pj; if (ctx.vol) return pj; arrancaManual(o.dx || 0, o.dz || 0, o.fuerza || 0, o.aleteo); return pj; },
    soltar: function () { if (S.mode === 1) pideLevantar(); return pj; },
    parcial: function (zona, fuerza, dir) {
      const z = zonaDe(zona), f = fuerza == null ? 1 : fuerza;
      if (S.mode === 1) { golpeCaido(zona, dir, f); return pj; } if (S.mode === 2 || !(f > 0)) return pj;
      arrancaParcial(z, f, dir); return pj;
    },
    golpe: function (donde, dir, fuerza) {
      const f = fuerza == null ? 1 : fuerza; if (!(f > 0)) return pj;
      if (S.mode === 1) { golpeCaido(donde, dir, f); return pj; }
      if (S.mode === 2) return pj;
      if (f >= 2.4) {                                   // tumba: sale volando (la maquinaria vieja da los parámetros del vuelo)
        dirMundo(dir, 0); const dx = vC.x, dz = vC.z; volar0(dx, dz, f * .8, {});
        if (S.mode === 3 || ctx.vol) { /* arranca en el siguiente cuadro */ }
        pendiente = { donde: donde, dir: dir ? (Array.isArray(dir) ? dir.slice() : { x: dir.x, y: dir.y, z: dir.z }) : null, f: f }; return pj;
      }
      return pj.ragdoll.parcial(donde, f, dir);
    }
  };
  let pendiente = null;
  // el golpe fuerte con punto se aplica extra apenas arranca la caída
  ctx.post.unshift(function () { if (pendiente && S.mode === 1) { const q = pendiente; pendiente = null; golpeCaido(q.donde, q.dir, q.f * .6); } });

  /* ───────────── envolturas de la API vieja ───────────── */
  pj.volar = function (dx, dz, f, o) {
    if (S.mode === 1) { f = f == null ? 1 : f; golpeCaido('torso', [dx, dz], f * .8); return pj; }
    return volar0(dx, dz, f, o);
  };
  pj.impacto = function (dx, dz, f, o) {
    o = o || {}; f = f == null ? 1 : f; if (!(f > 0)) return pj;
    if (S.mode === 1) { golpeCaido('torso', [dx, dz], f); return pj; }
    if (f >= (o.tumbar == null ? 2.4 : o.tumbar)) return pj.volar(dx, dz, f * .8, o);      // el viejo llamaba a su propio volar; aquí pasa por el nuestro
    impacto0(dx, dz, f, o);
    if (S.mode !== 2) arrancaParcial(ZONAS.torso, f * .55, [dx, dz]);
    return pj;
  };
  const defGet = (k, fn) => Object.defineProperty(pj, k, { get: fn, configurable: true, enumerable: true });
  const faseVieja = Object.getOwnPropertyDescriptor(pj, 'fase').get, volVieja = Object.getOwnPropertyDescriptor(pj, 'volando').get, desVieja = Object.getOwnPropertyDescriptor(pj, 'desplazamiento').get;
  defGet('volando', () => S.mode === 1 || S.mode === 2 || volVieja());
  defGet('fase', () => S.mode === 1 || S.mode === 2 ? S.fase : faseVieja());
  defGet('desplazamiento', () => S.mode === 1 || S.mode === 2 ? { x: S.ox, z: S.oz } : desVieja());
});
})(typeof window !== 'undefined' ? window : globalThis);
