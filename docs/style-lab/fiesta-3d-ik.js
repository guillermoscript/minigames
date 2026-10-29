// LA FIESTA · locomoción e IK de los personajes 3D (FIESTA.V3.PJ.EXT): pies que pisan de verdad, manos que alcanzan, peso al caer y cuerpo que reacciona.
//
// AUDITORÍA de fiesta-3d-pj.js antes de este módulo (visor, RECORRIDO a varias velocidades + lectura de ANIMS/GAIT):
//   · patinaje: el pie apoyado solo "casi" va a la velocidad del cuerpo (cadencia estirada con k); en curvas, al acelerar y al frenar se desliza sobre el piso.
//   · el pie no es un pie: el zapato gira rígido con la espinilla (no hay tobillo), no se apoya plano ni despega con el talón; no hay punta/talón al pisar.
//   · el piso es siempre plano: sin rampas, escalones ni desnivel; la cadera sube y baja por una fórmula, no porque la pierna llegue o no al piso.
//   · caminar de lado o hacia atrás se ve como caminar hacia adelante (las piernas solo saben balancearse de atrás a adelante; hasta se inclina "hacia adelante").
//   · girar en el sitio es robótico: el cuerpo gira con los pies clavados, sin paso de giro ni pasos de ajuste al arrancar/frenar.
//   · en la carrera real no se inclina hacia la curva (solo un poco de torso por la aceleración), sin contrapeso de torso, cadera ni mirada.
//   · el aterrizaje solo aplasta (escala) la figura: las rodillas no se doblan según la altura de la caída.
//   · las manos son solo poses por ángulos: no alcanzan, sostienen ni empujan un punto del mundo (balón, cuerda, volante, pared).
//   · equilibrio y colgado son poses fijas: el cuerpo no se carga sobre el pie de apoyo.
//
// QUÉ HACE (todo se mezcla con peso con la animación de siempre: se activa y se apaga suave, sin saltos; con el ragdoll activo no interviene):
//   · IK analítico de dos huesos en piernas y brazos con las longitudes reales del rig; rodilla/codo nunca se hiperextienden; el zapato se separa en un tobillo propio.
//   · pies: marcha procedural atada a la velocidad REAL del grupo y a la fase de la animación (ctx.fase): el pie apoyado queda clavado en el mundo, el pie en vuelo
//     describe un arco (más alto al correr, con patada de talón), con despegue de talón y pisada de talón; funciona hacia adelante, de lado y hacia atrás (strafe).
//   · parado: los pies se plantan; si el cuerpo gira o se aleja dan un paso de giro / de ajuste (también al arrancar y al frenar).
//   · terreno: el piso bajo cada pie sale de pj.ik.terreno(x, z); la cadera se ajusta (baja lo que haga falta para que las piernas lleguen) y el pie sigue la pendiente.
//   · peso: al aterrizar (de un salto o una caída medida en altura) la cadera cede con resorte y las rodillas se doblan; el tronco se va adelante.
//   · inclinación hacia la curva en la carrera real (hacia el centro, con la fuerza centrípeta), contrapeso de cadera/torso, mirada que también gira cadera y torso,
//     carga del peso sobre el pie de apoyo en equilibrio.
//   · manos con IK: pj.ik.mano('der'|'izq', objetivo, peso).
//
// API para los juegos (todo opcional; sin tocar nada el personaje ya camina con IK sobre piso plano):
//   pj.ik.terreno = (x, z) => altura        altura del piso en el mundo bajo ese punto (por defecto: plano, a la altura de pj.g). Los pies siguen rampas y escalones
//   pj.ik.mano('der'|'izq', objetivo, peso) la mano alcanza el objetivo: Vector3 / {x,y,z} del mundo, un Object3D (lo sigue) o una función () => Vector3. null la suelta (vuelve suave)
//   pj.ik.manos(objeto3D, {izq:[x,y,z], der:[x,y,z]}, peso)   las dos manos agarran puntos locales de un objeto (balón, volante, cuerda); manos(null) las suelta
//   pj.ik.pies = false                      apaga el IK de pies (vuelve a la animación de siempre) · pj.ik.activo = false apaga todo el módulo
//   pj.ik.estado                            depuración: peso, modo, pies {plantado, punto de apoyo, tobillo}, hundimiento de cadera, manos
(function (root) {
'use strict';
const V3 = root.FIESTA && root.FIESTA.V3, T = root.THREE; if (!V3 || !V3.PJ || !T) return;
const Vv = T.Vector3, Qq = T.Quaternion, Mm = T.Matrix4;
const TAU = Math.PI * 2, UP = new Vv(0, 1, 0), EX = new Vv(1, 0, 0);
const SOLE = .03, LT = .2, LH = .12;                                    // altura de la suela bajo el tobillo · distancia del tobillo a la bola del pie (sobre ella pivota el talón al despegar)
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const sm = (x) => { x = cl(x, 0, 1); return x * x * (3 - 2 * x); };
const sm5 = (x) => { x = cl(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const wr = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const lp = (a, b, k) => a + (b - a) * k;
const ex = (dt, r) => 1 - Math.exp(-dt * r);                  // factor de suavizado exponencial independiente del dt

/* ───────────── IK analítico de dos huesos ─────────────
   H: raíz de la cadena · Tg: objetivo (ambos en el marco del padre) · l1/l2: largos · j: hacia dónde sobresale la articulación del medio (rodilla adelante, codo atrás)
   flip: los codos giran al revés que las rodillas. Deja en out: q (cuaternión del hueso de arriba), k (ángulo de la articulación del medio: >0 rodilla, <0 codo),
   t (objetivo realmente alcanzado, recortado al alcance) y dist (distancia pedida) */
const _d = new Vv(), _dh = new Vv(), _p = new Vv(), _xt = new Vv(), _yt = new Vv(), _zt = new Vv(), _td = new Vv(), _s = new Vv(), _mb = new Mm();
function dosHuesos(H, Tg, l1, l2, j, flip, out) {
  _d.subVectors(Tg, H); let L = _d.length(); out.dist = L;
  if (L < 1e-5) { _d.set(0, -1, 0); L = 1; }
  _dh.copy(_d).multiplyScalar(1 / L);
  const Lmax = (l1 + l2) * .9995, Lmin = Math.abs(l1 - l2) + .03;
  L = cl(L, Lmin, Lmax);
  out.t.copy(H).addScaledVector(_dh, L);
  const ca = cl((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1), al = Math.acos(ca), sa = Math.sin(al);
  _p.copy(j).addScaledVector(_dh, -j.dot(_dh));
  if (_p.lengthSq() < 1e-6) { _p.set(0, 0, 1).addScaledVector(_dh, -_dh.z); if (_p.lengthSq() < 1e-6) _p.set(1, 0, 0); }
  _p.normalize();
  _xt.crossVectors(_p, _dh).normalize(); if (flip) _xt.negate();    // eje de la bisagra = eje x local del hueso
  _td.copy(_dh).multiplyScalar(ca).addScaledVector(_p, sa);        // dirección del hueso de arriba (inclinada hacia j)
  _yt.copy(_td).negate(); _zt.crossVectors(_xt, _yt);
  _s.copy(out.t).sub(H).addScaledVector(_td, -l1);                 // el hueso de abajo, en el marco del padre
  out.k = Math.atan2(-_s.dot(_zt), -_s.dot(_yt));
  _mb.makeBasis(_xt, _yt, _zt); out.q.setFromRotationMatrix(_mb);
  return out;
}
const nuevoOut = () => ({ q: new Qq(), k: 0, t: new Vv(), dist: 0 });
V3.PJ.IK = { dosHuesos: dosHuesos, nuevoOut: nuevoOut };   // expuesto para pruebas

/* ───────────── estilos por animación ───────────── */
// m: 'a' = marcha procedural según la velocidad real (si el grupo está quieto se deja la animación de siempre: marcha en el sitio) · 'p' = pies plantados con pasos de giro y ajuste ·
//    'f' = ese pie queda libre (animación de siempre) · array [izq, der] para decidir pie por pie. Sin entrada: sin IK (sentado, nadar, bailar, celebrar, colgar…)
// d: fracción del ciclo con el pie en el piso · dmin: lo mínimo al forzar zancadas largas · Hs: altura del paso · kick: patada de talón · Sm: media zancada máxima · ancho/z: separación lateral y escalonado
const EST = {
  caminar: { m: 'a', d: .58, dmin: .5, Hs: .085, kick: 0, Sm: .36, ancho: 0, sway: .035 }, correr: { m: 'a', d: .4, dmin: .4, Hs: .17, kick: .16, Sm: .52, ancho: -.04, sway: .02, salta: true },
  cansado: { m: 'a', d: .64, dmin: .55, Hs: .03, kick: 0, Sm: .2, ancho: 0, sway: .03 }, pesado: { m: 'a', d: .62, dmin: .55, Hs: .05, kick: 0, Sm: .26, ancho: .05, sway: .05 },
  asustado: { m: 'a', d: .4, dmin: .34, Hs: .18, kick: .12, Sm: .44, ancho: -.02, sway: .02, salta: true }, sigilo: { m: 'a', d: .62, dmin: .55, Hs: .13, kick: 0, Sm: .24, ancho: .03, sway: .03 },
  cargar: { m: 'a', d: .6, dmin: .52, Hs: .06, kick: 0, Sm: .28, ancho: .02, sway: .04 }, empujar: { m: 'a', d: .64, dmin: .55, Hs: .05, kick: 0, Sm: .26, ancho: .03, sway: .03 },
  quieto: { m: 'p' }, saludar: { m: 'p' }, asentir: { m: 'p' }, negar: { m: 'p' }, asombrado: { m: 'p' }, pensar: { m: 'p' }, revolver: { m: 'p' }, senalar: { m: 'p' }, provocar: { m: 'p' },
  triste: { m: 'p' }, mojado: { m: 'p' }, gritar: { m: 'p' }, aplaudir: { m: 'p' }, reirse: { m: 'p' }, burla: { m: 'p' }, lloron: { m: 'p' }, mareado: { m: 'p' }, aturdido: { m: 'p' }, dormitar: { m: 'p' },
  campeon: { m: 'p', ancho: .09 }, preparado: { m: 'p', ancho: .1, z: [.04, .12] }, jadeo: { m: 'p', ancho: .04 }, agacharse: { m: 'p', ancho: .06 }, cubrirse: { m: 'p', ancho: .06 },
  forcejear: { m: 'p', z: [-.3, .3], ancho: .04 }, halar: { m: 'p', z: [.25, -.15], ancho: .06 }, impaciente: { m: ['p', 'f'] }, equilibrio: { m: ['f', 'p'], carga: 1 }
};
// gestos que mueven las piernas por sí mismos (patadas, saltos, pasos laterales, caídas): con ellos las piernas quedan en la animación de siempre
const LIBRES = { saltar: 1, festejo: 1, giro: 1, patear: 1, cabecear: 1, esquivar: 1, esquivar_izq: 1, esquivar_der: 1, esquivar_salto: 1, caer: 1, golpe: 1, tropezar: 1, derrapar: 1, susto: 1,
  lanzar: 1, lanzar_arriba: 1, lanzar_abajo: 1, lanzar_lado: 1, pegar: 1, empujon: 1, atrapar: 1, caer_atras: 1, caer_adelante: 1, resbalon: 1 };

V3.PJ.EXT.push(function (pj, ctx) {
  const g = ctx.g, J = ctx.J, cad = ctx.cad, tor = ctx.tor, rig = ctx.rig, C = ctx.C;
  const PIER = -J.rI.position.y, HOM = -J.cI.position.y, MANO = -pj.mano('izq').position.y;     // largos reales del rig: muslo/espinilla · brazo · antebrazo+mano

  /* tobillo propio: el zapato (y lo que lleva: cordones, suela, pantuflas) pasa a colgar de un pivote en el tobillo, para poder apoyarlo plano y despegar con el talón */
  const tob = [J.rI, J.rD].map((rod) => {
    const a = new T.Group(); a.position.y = -PIER; rod.add(a);
    const mover = rod.children.filter((c, i) => i >= 2 && c !== a && c.position.y < -PIER + .1 && !(c.geometry && c.geometry.type === 'CylinderGeometry' && c.scale.x === 1 && c.scale.z === 1 && c.position.x === 0 && c.position.z === 0));
    for (const c of mover) { a.add(c); c.position.y += PIER; }
    a.userData.n = mover.length; return a;
  });
  const conTobillo = tob[0].userData.n > 0 && tob[1].userData.n > 0;

  /* ───────────── estado ───────────── */
  let terreno = null;
  const S = { wf: [0, 0], w: 0, estilo: null, modos: ['', ''], mov: false, air: false, gAir: false, vyMin: 0, py: 0, base: g.position.y, fd: 8, fasePrev: ctx.fase, dS: .5, dyS: 0, hipD: 0,
    dip: { x: 0, v: 0 }, om: 0, thv: 0, lean: [0, 0], gaze: 0, eq: 0, sway: 0, activo: true, pies: true, prevG: new Vv(NaN, 0, 0), wH: 0, pisa: 0 };
  const gW = new Vv(), tmp = new Vv(), tmp2 = new Vv(), Minv = new Mm();
  const nF = (i) => ({ i: i, sx: i ? 1 : -1, mus: i ? J.mD : J.mI, rod: i ? J.rD : J.rI, tob: tob[i], lock: new Vv(), pos: new Vv(), from: new Vv(), to: new Vv(), ank: new Vv(), fk: new Vv(), err: new Vv(), hipW: new Vv(),
    rest: new Vv(), qF: new Qq(), qS: new Qq(), vuelo: false, u: 0, uRate: 3, yaw: 0, yawFrom: 0, yawTo: 0, pitch: 0, init: false, plant: true, modo: '', out: nuevoOut(), kap: 0, alc: 0, wasA: false });
  const F = [nF(0), nF(1)];
  const manos = [-1, 1].map((sx) => ({ sx: sx, hom: sx < 0 ? J.hI : J.hD, cod: sx < 0 ? J.cI : J.cD, w: 0, wt: 0, spec: null, T: new Vv(), out: nuevoOut(), q0: new Qq(), k0: 0, alcanza: false }));
  const hipC = [new Vv(), new Vv()], ankC = [new Vv(), new Vv()], jP = [new Vv(), new Vv()], qA = new Qq(), qB = new Qq(), qC = new Qq(), qD = new Qq(), qE = new Qq(), qI = new Qq();

  const piso = (x, z) => terreno ? (+terreno(x, z) || 0) : S.base;
  const normal = (x, z, out) => {                                // normal del piso (por diferencias del terreno); sin terreno, vertical
    if (!terreno) return out.set(0, 1, 0);
    const e = .12, dhx = (piso(x + e, z) - piso(x - e, z)) / (2 * e), dhz = (piso(x, z + e) - piso(x, z - e)) / (2 * e);
    const m = Math.hypot(dhx, dhz), k = m > .42 ? .42 / m : 1;                                // pendiente máxima del pie ~23°: en un escalón el pie no se voltea
    return out.set(-dhx * k, 1, -dhz * k).normalize();
  };
  const nP = new Vv();
  const pp = (x, z, yaw) => {                                      // altura del piso para un PIE: plano de la pendiente + lo que sobresalga bajo el talón o la punta (bordes de escalón)
    const c = piso(x, z); if (!terreno) return c;
    normal(x, z, nP); const fx = Math.sin(yaw), fz = Math.cos(yaw), sl = -(nP.x * fx + nP.z * fz) / nP.y; let ex2 = 0;
    for (const s of [-.13, .22]) ex2 = Math.max(ex2, piso(x + fx * s, z + fz * s) - (c + sl * s));
    return c + ex2;
  };

  /* ───────────── pose (antes de escribir los huesos): peso, aterrizaje, inclinación en curva, mirada, equilibrio ───────────── */
  ctx.pose.push((p, dt) => {
    if (ctx.vol || (pj.ragdoll && pj.ragdoll.activo)) { S.vol = true; return; } S.vol = false;
    dt = cl(dt, 0, .05); const sc = g.scale.x || 1, v = ctx.vel, vx = v.x * sc, vz = v.z * sc, vyW = v.y * sc, vs = Math.hypot(vx, vz);
    const an = ctx.anim, e = S.activo ? EST[an] || null : null, ges = ctx.uno; S.estilo = e;
    const gait = !!e && (e.m === 'a');
    // ¿en el aire? por la pose (salto del gesto) o por el movimiento vertical del grupo (caída); con terreno, por la altura sobre él
    const thr = gait ? .3 : .05, poseAir = p.y > (S.air ? thr * .6 : thr);
    if (terreno) S.gAir = g.position.y - piso(g.position.x, g.position.z) > .1 && Math.abs(vyW) > .4; else S.gAir = Math.abs(vyW) > (S.gAir ? .9 : 1.6);
    const air = poseAir || S.gAir;
    if (dt > 0) {
      const vyT = (p.y - S.py) / dt + vyW; if (air) S.vyMin = Math.min(S.vyMin, vyT);
      if (S.air && !air && e) {                                    // aterrizó: la cadera cede según lo que cayó (rodillas dobladas por el IK), con resorte
        const f = ges ? .55 : 1, prof = cl((.03 + .07 * Math.sqrt(Math.max(0, -S.vyMin))) * f, 0, .27); S.dip.v = -prof * 24; S.dip.x = 0; S.pisa = .3;
      }
      if (!air) S.vyMin = 0;
      S.air = air; S.py = p.y; S.pisa = Math.max(0, S.pisa - dt);
    } else S.air = air;
    // movimiento: histéresis para pasar de 'parado' a 'marcha'
    S.mov = S.mov ? vs > .18 : vs > .3;
    // peso por pie
    const tw = [0, 0], ms = e ? (Array.isArray(e.m) ? e.m : [e.m, e.m]) : ['', ''];
    if (e && !air && !(ges && LIBRES[ges]) && S.pies) for (let i = 0; i < 2; i++) { if (ms[i] === 'f') continue; tw[i] = ms[i] === 'a' ? (S.mov ? 1 : 0) : (vs > 2.4 ? 0 : 1); }
    S.modos[0] = ms[0]; S.modos[1] = ms[1];
    for (let i = 0; i < 2; i++) S.wf[i] += (tw[i] - S.wf[i]) * ex(dt, tw[i] > S.wf[i] ? (S.pisa > 0 ? 40 : 9) : (air ? 26 : 8));
    const w = S.w = Math.max(S.wf[0], S.wf[1]);
    // resorte del aterrizaje
    if (dt > 0) { const W = 17, Z = .5, n = 2, h = dt / n; for (let k = 0; k < n; k++) { S.dip.v += (-W * W * S.dip.x - 2 * Z * W * S.dip.v) * h; S.dip.x += S.dip.v * h; } S.dip.x = cl(S.dip.x, -.32, .12); }
    p.y += S.dip.x * w; p.tx += -S.dip.x * 1.5 * w; p.hIz += S.dip.x * .8 * w; p.hDz -= S.dip.x * .8 * w;
    if (w < .01) return;
    // inclinación hacia la curva con la fuerza centrípeta real (el cuerpo gira alrededor de los pies) + corrige la inclinación "hacia adelante" al ir de lado o hacia atrás
    const th = Math.atan2(vx, vz); if (dt > 0 && vs > 1) S.om += (cl(wr(th - S.thv) / dt, -9, 9) - S.om) * ex(dt, 9); else if (dt > 0) S.om *= Math.exp(-dt * 5); S.thv = th;
    const psi = ctx.rumbo, fx = Math.sin(psi), fz = Math.cos(psi), vfw = vs > .3 ? (vx * fx + vz * fz) / vs : 1, vlat = vs > .3 ? (vx * fz - vz * fx) / vs : 0;
    const mv = gait ? cl((vs - .5) / 2.5, 0, 1) : 0;
    const ac = vs * S.om, ang = cl(Math.atan(ac / 9.8 * 1.25), -.42, .42) * mv;               // hacia dónde está el centro de la curva
    const lwx = Math.cos(th) * ang, lwz = -Math.sin(th) * ang;                                  // inclinación en el mundo: vector lat(θ)·ang
    const lxL = lwx * fz - lwz * fx, lzL = lwx * fx + lwz * fz;                                  // al marco del cuerpo
    const lk = ex(dt, 10); S.lean[0] += (-lxL - S.lean[0]) * lk; S.lean[1] += (lzL * .6 - S.lean[1]) * lk;
    p.rz += S.lean[0]; p.rx += S.lean[1];
    if (gait) { const base = an === 'correr' || an === 'asustado' ? .2 : .08, fwd = cl(vfw, 0, 1);      // sin ir hacia adelante, fuera la inclinación de "caminar hacia adelante"
      p.tx -= base * cl(vs / 4, 0, 1) * (1 - fwd); p.rz -= vlat * .1 * cl(vs / 4, 0, 1) * (an === 'correr' ? 1.4 : 1) * mv; }
    // contrapeso: la cadera se carga hacia el pie de apoyo y el torso se queda derecho
    if (gait && e.sway) { const c = Math.cos(ctx.fase), q = e.sway * (.5 + .5 * mv) * w; p.sx += -c * q; p.cz += c * q * .5; p.tz -= -c * q * .8; }
    // mirada: además de ojos, cabeza y torso, gira la cadera cuando el objetivo está muy al costado (los pies terminan dando el paso de giro)
    const gz = cl(ctx.SP.gH.t / .7, -1.4, 1.4); S.gaze += (gz - S.gaze) * ex(dt, 6);
    const gs = Math.sign(S.gaze), ga = Math.abs(S.gaze); p.cy += gs * (ga * .12 + Math.max(0, ga - .55) * .42) * w; p.ty += S.gaze * .2 * w;
    // equilibrio: el cuerpo se carga sobre el pie de apoyo (derecho) y la cadera corrige con el vaivén
    const eqT = e && e.carga && !air ? 1 : 0; S.eq += (eqT - S.eq) * ex(dt, 6);
    if (S.eq > .01) p.sx += (.15 + Math.sin(ctx.t * 3.1) * .03) * S.eq;
  });

  /* ───────────── post (después de escribir los huesos): pies, cadera, manos ───────────── */
  const sepMin = .2;
  function reiniciarPies() { for (const f of F) { f.init = false; f.vuelo = false; f.err.set(0, 0, 0); } S.dyS = 0; S.hipD = 0; }
  function arcoDesp(vx, vz, om, tau, out) {              // desplazamiento en tau segundos con velocidad (vx,vz) que gira a om rad/s (arco: cuerda rotada la mitad del giro)
    const a = om * tau, h = a / 2, k = Math.abs(a) < 1e-3 ? 1 : Math.sin(h) / h, c = Math.cos(h), s = Math.sin(h);
    out.x = (vx * c + vz * s) * k * tau; out.z = (-vx * s + vz * c) * k * tau; return out;
  }
  const dsp = { x: 0, z: 0 };
  function pitchVuelo(u) { return .55 * (1 - sm(u / .4)) - .25 * sm((u - .6) / .4); }
  function orientarPie(f, sW) {                          // punto de apoyo + guiñada + cabeceo -> tobillo en el mundo y orientación del pie
    normal(f.pos.x, f.pos.z, tmp2); f.qS.setFromUnitVectors(UP, tmp2);
    qA.setFromAxisAngle(UP, f.yaw); qB.setFromAxisAngle(EX, f.pitch);
    f.qF.copy(f.qS).multiply(qA).multiply(qB);
    if (f.pitch >= 0) { tmp.set(0, SOLE * sW, -LT * sW).applyQuaternion(qB); tmp.z += LT * sW; }              // despegue: el pie gira sobre la bola (adelante)
    else { tmp.set(0, SOLE * sW, LH * sW).applyQuaternion(qB); tmp.z -= LH * sW; }                              // pisada: gira sobre el talón (atrás)
    tmp.applyQuaternion(qA).applyQuaternion(f.qS);
    f.ank.copy(f.pos).add(tmp);
  }

  ctx.post.push((dt, c) => {
    if (ctx.vol || (pj.ragdoll && pj.ragdoll.activo) || !S.activo) { if (S.wf[0] || S.wf[1]) { S.wf[0] = S.wf[1] = 0; reiniciarPies(); } return; }
    dt = cl(dt, 0, .1);
    const W0 = S.wf[0] > .003, W1 = S.wf[1] > .003, manosOn = manos[0].w > .003 || manos[1].w > .003 || manos[0].wt > 0 || manos[1].wt > 0;
    if (dt > 0) { const fdn = (ctx.fase - S.fasePrev) / dt; if (fdn > 0 && fdn < 60) S.fd += (fdn - S.fd) * ex(dt, 12); } S.fasePrev = ctx.fase;
    if (!(W0 || W1)) { if (S.wH !== 0) reiniciarPies(); S.wH = 0; if (manosOn) { g.updateMatrixWorld(true); aplicarManos(dt); g.updateMatrixWorld(true); } return; }
    S.wH = 1;
    cad.updateWorldMatrix(true, false); gW.copy(g.position);
    if (!isNaN(S.prevG.x) && gW.distanceTo(S.prevG) > 2.5) reiniciarPies(); S.prevG.copy(gW);
    if (!S.air && !S.gAir) S.base = gW.y;
    const sc = g.scale.x || 1, sW = sc * C.alto, psi = ctx.rumbo, fx = Math.sin(psi), fz = Math.cos(psi), vel = ctx.vel, vx = vel.x * sc, vz = vel.z * sc, vs = Math.hypot(vx, vz);
    const psiP = psi + cad.rotation.y, est = S.estilo || EST.quieto, ancho0 = (est.ancho || 0), z0 = est.z || [0, 0];
    const gait = S.modos[0] === 'a' || S.modos[1] === 'a';
    // ciclo de la marcha
    let dEff = est.d || .5, T_ = TAU / Math.max(2, S.fd);
    if (gait && vs > .2) dEff = cl(2 * est.Sm / (vs * T_), est.dmin || .45, est.d); S.dS += (dEff - S.dS) * ex(dt, 6);
    const dPi = S.dS * Math.PI, Tst = S.dS * T_, Tsw = (1 - S.dS) * T_;
    // 1) estado de cada pie (clavado / en vuelo) y su punto de apoyo en el mundo
    for (const f of F) {
      const w = S.wf[f.i], modo = S.modos[f.i]; f.modo = modo;
      if (w <= .003 || modo === 'f') { f.init = false; f.vuelo = false; continue; }
      f.mus.updateWorldMatrix(true, false); f.hipW.copy(f.mus.position); cad.localToWorld(f.hipW);
      f.rod.updateWorldMatrix(true, false); f.fk.set(0, -PIER, 0); f.rod.localToWorld(f.fk);
      if (!f.init) {                                              // primer cuadro con peso: el pie se queda donde la animación lo tiene
        f.init = true; f.lock.set(f.fk.x, pp(f.fk.x, f.fk.z, psiP), f.fk.z); f.pos.copy(f.lock); f.yaw = psiP; f.pitch = 0; f.vuelo = false; f.wasA = modo === 'a';
        if (modo === 'a') { const ph = wr(ctx.fase + (f.i ? Math.PI : 0)); if (Math.abs(ph) >= dPi) { f.vuelo = true; f.from.copy(f.lock); f.yawFrom = f.yaw; } }
      }
      const lat = f.sx, ancho = ancho0 * sW;
      if (modo === 'a') {
        f.wasA = true;
        const ph = wr(ctx.fase + (f.i ? Math.PI : 0)), stance = Math.abs(ph) < dPi;
        if (stance && f.vuelo) { f.vuelo = false; f.lock.copy(f.pos); f.lock.y = pp(f.lock.x, f.lock.z, f.yaw); f.yaw = f.yawTo; }       // pisó
        else if (!stance && !f.vuelo) { f.vuelo = true; f.from.copy(f.lock); f.yawFrom = f.yaw; }                                    // despegó
        const hxL = f.hipW.x + (fz * lat * ancho), hzL = f.hipW.z + (-fx * lat * ancho);         // bajo la cadera con el ancho de paso
        if (f.vuelo) {
          let u; if (ph >= dPi) u = (ph - dPi) / Math.max(.2, TAU - 2 * dPi); else u = (ph + TAU - dPi) / Math.max(.2, TAU - 2 * dPi);
          u = cl(u, 0, 1); f.u = u; const trem = (1 - u) * Tsw;
          // dónde va a pisar: bajo la cadera de ese momento y adelantada media zancada en la dirección en que se mueve el grupo
          arcoDesp(vx, vz, S.om, trem, dsp); const hx = hxL + dsp.x, hz = hzL + dsp.z;
          let sx = 0, sz = 0; if (vs > .1) { const half = Math.min(vs * Tst / 2, est.Sm * sW); const a = Math.atan2(vx, vz) + S.om * (trem + Tst / 4); sx = Math.sin(a) * half; sz = Math.cos(a) * half; }
          f.to.set(hx + sx, 0, hz + sz); f.yawTo = psiP + S.om * (trem + Tst / 2) + lat * .05 * (est.kick ? 0 : 1);
          const o = F[1 - f.i];                                                                                      // los pies no se cruzan ni se pisan
          if (o.init && Math.abs(vx * fz - vz * fx) < vs * .3) { const po = o.vuelo ? o.to : o.lock, dif = ((f.to.x - po.x) * fz - (f.to.z - po.z) * fx) * lat; if (dif < sepMin * sW) { const m = (sepMin * sW - dif) * lat; f.to.x += fz * m; f.to.z -= fx * m; } }
          const eU = sm5(est.kick ? Math.pow(u, 1.25) : u);
          f.pos.set(lp(f.from.x, f.to.x, eU), 0, lp(f.from.z, f.to.z, eU));
          const y0 = pp(f.from.x, f.from.z, f.yawFrom), y1 = pp(f.to.x, f.to.z, f.yawTo), yp = pp(f.pos.x, f.pos.z, f.yaw);
          f.pos.y = Math.max(lp(y0, y1, eU), yp) + (est.Hs * Math.sin(Math.PI * u) + est.kick * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u) * 1.2) * sW * Math.min(1, .35 + vs / 3);
          f.yaw = f.yawFrom + wr(f.yawTo - f.yawFrom) * sm(u); f.pitch = pitchVuelo(u) * Math.min(1, .5 + vs / 2);
          f.pos.y += (LT * Math.sin(Math.max(0, f.pitch)) + LH * Math.sin(Math.max(0, -f.pitch))) * sW;      // la punta o el talón inclinados no se clavan en el piso
        } else {
          f.lock.y = pp(f.lock.x, f.lock.z, f.yaw);
          const R = (est.Sm + Math.abs(ancho0) + .03) * sW * 1.1, dx = f.lock.x - hxL, dz = f.lock.z - hzL, d2 = dx * dx + dz * dz;       // límite de alcance: si no llega, el pie se arrastra
          if (d2 > R * R) { const k = R / Math.sqrt(d2); f.lock.x = hxL + dx * k; f.lock.z = hzL + dz * k; f.lock.y = pp(f.lock.x, f.lock.z, f.yaw); }
          f.pos.copy(f.lock);
          const q = cl((ph + dPi) / Math.max(.2, 2 * dPi), 0, 1);                                   // progreso del apoyo: talón al pisar, despega el talón al final
          f.pitch = (-.25 * (1 - sm(q / .2)) + .5 * sm((q - .65) / .35)) * Math.min(1, .5 + vs / 2);
        }
      } else {
        if (f.wasA) { f.wasA = false; if (f.vuelo) f.uRate = 1 / Math.max(.15, Tsw); }          // viene de la marcha: el vuelo en curso se termina en el tiempo que le quedaba
        const zz = (z0[f.i] || 0) * sW, ancho1 = (est.ancho || 0) * sW;
        f.rest.set(f.hipW.x + fz * lat * ancho1 + fx * zz, 0, f.hipW.z - fx * lat * ancho1 + fz * zz);
        const yawT = psiP + lat * .06;
        if (f.vuelo) {
          f.u += f.uRate * dt; f.to.set(f.rest.x, 0, f.rest.z); f.yawTo = yawT;
          if (f.u >= 1) { f.vuelo = false; f.lock.set(f.to.x, pp(f.to.x, f.to.z, f.yawTo), f.to.z); f.yaw = f.yawTo; f.pos.copy(f.lock); f.pitch = 0; }
          else { const u = f.u, eU = sm5(u), y0 = pp(f.from.x, f.from.z, f.yawFrom), y1 = pp(f.to.x, f.to.z, f.yawTo), dd = Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z) / sW;
            f.pos.set(lp(f.from.x, f.to.x, eU), 0, lp(f.from.z, f.to.z, eU)); f.pos.y = Math.max(lp(y0, y1, eU), pp(f.pos.x, f.pos.z, f.yaw)) + (.06 + .12 * Math.min(1, dd)) * Math.sin(Math.PI * u) * sW;
            f.yaw = f.yawFrom + wr(f.yawTo - f.yawFrom) * sm(u); f.pitch = pitchVuelo(u) * .6; f.pos.y += (LT * Math.sin(Math.max(0, f.pitch)) + LH * Math.sin(Math.max(0, -f.pitch))) * sW; }
        } else { f.lock.y = pp(f.lock.x, f.lock.z, f.yaw); f.pos.copy(f.lock); f.pitch *= Math.exp(-dt * 12); f.pos.y = f.lock.y; }
      }
    }
    // pasos de giro y de ajuste (parado): se mueve el pie con más necesidad si el otro está plantado
    {
      const need = [0, 0];
      for (const f of F) { if (f.modo !== 'p' || f.vuelo || !f.init) continue;
        const d = Math.hypot(f.lock.x - f.rest.x, f.lock.z - f.rest.z) / sW, ye = Math.abs(wr(psiP + f.sx * .06 - f.yaw)); need[f.i] = Math.max(d / .24, ye / .62); }
      const i = need[0] >= need[1] ? 0 : 1, f = F[i], o = F[1 - i];
      if (need[i] > 1 && (!o.vuelo || o.u > .6) && o.modo !== 'f') {        // en equilibrio sobre un solo pie no se levanta el único apoyo
        { f.vuelo = true; f.u = 0; f.from.copy(f.lock); f.to.set(f.rest.x, 0, f.rest.z); f.yawFrom = f.yaw; f.yawTo = psiP + f.sx * .06;
          const d = Math.hypot(f.from.x - f.rest.x, f.from.z - f.rest.z) / sW, ye = Math.abs(wr(f.yawTo - f.yaw)); f.uRate = 1 / cl(.2 + d * .55 + ye * .12, .22, .5); }
      }
    }
    // 2) cadera: sube con el desnivel y baja lo que haga falta para que las piernas lleguen al piso
    let pl = 0, hy = 0; for (const f of F) if (f.init && f.modo !== 'f' && !f.vuelo) { pl++; hy += f.lock.y; }
    const wH = Math.max(S.wf[0], S.wf[1]);
    const hipD = (pl ? hy / pl : (terreno ? piso(gW.x, gW.z) : S.base)) - S.base;
    S.hipD += (hipD - S.hipD) * ex(dt, 14);
    const sy = sc * rig.scale.y;
    cad.position.y += wH * (SOLE + S.hipD / sy);
    cad.updateWorldMatrix(true, false); Minv.copy(cad.matrixWorld).invert();
    let dyT = 0; const alc = PIER * 2 * .985;
    for (const f of F) { if (!f.init || f.modo === 'f') continue;
      orientarPie(f, sW); f.ank.y += 0; hipC[f.i].copy(f.mus.position); ankC[f.i].copy(f.ank).applyMatrix4(Minv);
      if (f.vuelo && f.modo === 'a') continue;                       // un pie en el aire no sostiene la cadera
      const d = tmp.subVectors(ankC[f.i], hipC[f.i]); const L2 = d.lengthSq();
      if (L2 > alc * alc) { const dy = d.y, disc = dy * dy - (L2 - alc * alc); dyT = Math.max(dyT, disc >= 0 ? -dy - Math.sqrt(disc) : -dy); } }
    dyT = cl(dyT, 0, .4);
    S.dyS += (dyT - S.dyS) * ex(dt, dyT > S.dyS ? 45 : 16);
    cad.position.y -= wH * S.dyS;
    cad.updateWorldMatrix(true, false); Minv.copy(cad.matrixWorld).invert();
    cad.getWorldQuaternion(qC);
    // 3) IK de piernas (se mezcla con la animación por el peso de cada pie)
    for (const f of F) {
      const w = S.wf[f.i]; if (!f.init || f.modo === 'f' || w <= .003) continue;
      ankC[f.i].copy(f.ank).applyMatrix4(Minv);
      jP[f.i].set(Math.sin(f.yaw), 0, Math.cos(f.yaw)).applyQuaternion(f.qS).transformDirection(Minv);                // la rodilla apunta hacia donde apunta el pie
      dosHuesos(hipC[f.i], ankC[f.i], PIER, PIER, jP[f.i], false, f.out);
      f.out.k = cl(f.out.k, 0, 2.75); f.kap = f.out.k; f.alc = f.out.dist;
      f.mus.quaternion.slerp(f.out.q, w); f.rod.rotation.x = lp(f.rod.rotation.x, f.out.k, w);
      if (conTobillo) {                                              // el pie queda plano sobre el piso (con pendiente y despegue del talón)
        qD.copy(qC).multiply(f.mus.quaternion).multiply(qE.setFromAxisAngle(EX, f.rod.rotation.x));
        qI.copy(qD).invert().multiply(f.qF); f.tob.quaternion.set(0, 0, 0, 1).slerp(qI, w);
      }
    }
    if (manosOn) { tor.updateWorldMatrix(true, false); }
    g.updateMatrixWorld(true);
    if (manosOn) { aplicarManos(dt); g.updateMatrixWorld(true); }
  });

  /* ───────────── manos ───────────── */
  const resolverObjetivo = (m) => {
    const s = m.spec; if (!s) return false;
    if (s.v) m.T.set(s.v.x, s.v.y, s.v.z);
    else if (s.o) { s.o.updateWorldMatrix(true, false); if (s.off) m.T.set(s.off[0], s.off[1], s.off[2]).applyMatrix4(s.o.matrixWorld); else m.T.setFromMatrixPosition(s.o.matrixWorld); }
    else if (s.f) { const r = s.f(); if (!r) return false; m.T.set(r.x, r.y, r.z); }
    else return false;
    return m.T.x === m.T.x && m.T.y === m.T.y && m.T.z === m.T.z;
  };
  const jCodo = new Vv(), Ht = new Vv(), Tt = new Vv(), Mi = new Mm();
  function brazoIK(m, w) {                                            // aplica el IK de un brazo con peso w sobre la pose actual (guardada en q0/k0)
    m.hom.quaternion.copy(m.q0); m.cod.rotation.x = m.k0; if (w <= .001) return;
    tor.updateWorldMatrix(true, false); Mi.copy(tor.matrixWorld).invert(); Tt.copy(m.T).applyMatrix4(Mi); Ht.copy(m.hom.position);
    jCodo.set(m.sx * 1, -.4, -.2);                                    // el codo sale hacia afuera, abajo y atrás
    dosHuesos(Ht, Tt, HOM, MANO, jCodo, true, m.out); m.out.k = cl(m.out.k, -2.6, 0);
    m.hom.quaternion.copy(m.q0).slerp(m.out.q, w); m.cod.rotation.x = lp(m.k0, m.out.k, w);
  }
  function aplicarManos(dt) {
    let hay = false;
    for (const m of manos) {
      const ok = resolverObjetivo(m);                                // si el objetivo desaparece se conserva el último punto mientras la mano se suelta
      const objetivo = ok ? m.wt : 0;
      m.w += (objetivo - m.w) * ex(dt || 0, objetivo > m.w ? 9 : 5); if (!ok && m.w < .003) { m.w = 0; m.spec = null; }
      m.q0.copy(m.hom.quaternion); m.k0 = m.cod.rotation.x; m.alcanza = false;
      if (m.w > .003) {
        hay = true; brazoIK(m, m.w);
        if (pj.sinChoques && pj.choques().length) { const col = pj.choques().some((s) => s.indexOf(m.sx < 0 ? 'izq' : 'der') === 0);       // el brazo no atraviesa el cuerpo: se afloja o se suelta
          if (col) { brazoIK(m, m.w * .5); if (pj.choques().some((s) => s.indexOf(m.sx < 0 ? 'izq' : 'der') === 0)) brazoIK(m, 0); } }
        m.hom.updateWorldMatrix(true, true);
        const hp = pj.mano(m.sx < 0 ? 'izq' : 'der').getWorldPosition(tmp); m.alcanza = hp.distanceTo(m.T) < .06 * (g.scale.x || 1) * C.alto + .02;
      } else if (m.w > .003) hay = true;
    }
    return hay;
  }

  /* ───────────── API ───────────── */
  const lado = (l) => l === 'izq' || l === 'i' || l === 'left' ? manos[0] : manos[1];
  const spec = (o) => { if (!o) return null; if (typeof o === 'function') return { f: o }; if (o.isObject3D) return { o: o }; return { v: o }; };
  const ik = {
    get terreno() { return terreno; }, set terreno(f) { terreno = typeof f === 'function' ? f : null; },
    get pies() { return S.pies; }, set pies(v) { S.pies = !!v; },
    get activo() { return S.activo; }, set activo(v) { S.activo = !!v; if (!S.activo) { for (const m of manos) m.wt = 0; } },
    mano: function (l, objetivo, peso) { const m = lado(l); m.spec = spec(objetivo); m.wt = objetivo ? cl(peso == null ? 1 : peso, 0, 1) : 0; return pj; },
    manos: function (obj, offs, peso) {
      for (const k of ['izq', 'der']) { const m = lado(k); if (!obj) { m.wt = 0; continue; } const of = offs && offs[k]; m.spec = { o: obj, off: of ? [of[0], of[1], of[2]] : null }; m.wt = cl(peso == null ? 1 : peso, 0, 1); }
      return pj;
    },
    get estado() { return { peso: S.wf.slice(), modo: S.modos.slice(), mov: S.mov, aire: S.air, hundimiento: S.dyS, giro: S.om, inclinacion: S.lean.slice(), aterrizaje: S.dip.x,
      pies: F.map((f) => ({ plantado: f.init && !f.vuelo, punto: f.pos.clone(), tobillo: f.ank.clone(), rodilla: f.kap, alcance: f.alc, modo: f.modo })), manos: manos.map((m) => ({ peso: m.w, alcanza: m.alcanza, objetivo: m.T.clone() })) }; }
  };
  pj.ik = ik;
});
})(typeof window !== 'undefined' ? window : globalThis);
