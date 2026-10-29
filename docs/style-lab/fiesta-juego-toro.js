'use strict';
/* LA FIESTA · ¡TOROS COLEADOS! (f_toro) · modelo A · FFA rank y BRONCA 1v1 · stick + 1 botón · reemplaza a ¡CAPICÚA! (doc 15 §8 #6)
   Rediseño (28 oct): ya no es una carrera por mangas separadas. Es UN corral del llano, con UN toro suelto y todos los jinetes a caballo dentro,
   moviéndose libres con el stick. Todos pelean por la misma cola.
   EL TORO (igual para todos: se simula una vez en mk con c.rng y es función pura del reloj): trota y cambia de rumbo -> ESCARBA (señal roja en el piso
   que muestra hacia dónde va a embestir) -> EMBISTE (rápido, con quiebros en los niveles 2 y 3) -> si choca con la cerca queda ATURDIDO ~1 s (ahí se amontona
   todo el mundo) y vuelve a trotar. Cada vez embiste más seguido y más fuerte.
   A (un solo botón, según dónde estés):
     - pegado a la cola y la cola libre: AGARRAS LA COLA y vas arrastrado detrás del toro.
     - en cualquier otro caso: ESPOLEAS (arranque de 0,4 s; si chocas con otro jinete lo empujas, y si era el que tenía la cola, ¡se le cae!). Se recarga 1,7 s.
   COLGADO DE LA COLA: el toro te tironea hacia los lados (más fuerte cuando escarba, embiste o hace un quiebro). La barra de abajo es tu equilibrio: el stick
   (izq/der) mueve la marca; mantenla cerca del centro. Si se sale de la barra, te sueltas y caes. Mientras aguantas, se llena la TUMBA: al llenarse
   ¡COLEADA! (40 a 70 pts según lo bien que equilibraste). Con A das un JALÓN: adelanta la tumba pero sacude tu equilibrio. Tras una coleada la cola queda
   «caliente» 1,4 s para todos y tú sales volando.
   Quita-cola: un espuela que te pega mientras colgabas, la cornada del toro (embistiendo, de frente), el caporal que cruza, el becerro suelto, te hacen caer.
   Eventos del llano (mismo reloj para todos): POLVAREDA (te frena adentro), EL CAPORAL cruza el corral a caballo, UN BECERRO SUELTO que corre en zigzag,
   LLUVIA (barro: el caballo resbala), y la ÚLTIMA EMBESTIDA (último 22 %): todo vale doble.
   Niveles: 1 embestida recta, cola ancha · 2 el toro embiste con curva y hace UN quiebro · 3 dos quiebros, cola más estrecha, tirones más fuertes.
   Red (modelo A): cada dueño simula SU jinete y lo difunde por `o` = {x, z, st, sc, q, h, d, k}. El toro, el caporal, el becerro, la polvareda y la lluvia no viajan:
   salen del reloj. El choque entre jinetes lo resuelve el dueño de quien lo recibe (leyendo `d` del otro); el empate por la cola lo resuelve la marca `h` (quien agarró primero).
   Puntaje = suma (entero <= scoreMax). done() nunca adelanta: se juega el tiempo entero (finTemprano 0).
   Sin Math.random / Date.now: azar de c.rng (solo en mk) y c.rngFor('cpu'+p); lo cosmético de c.fx(). Dibujo: 3D low poly (fiesta-3d.js) o el 2D de respaldo. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_toro')) return;

var AX = 20, AZ = 11, TAUR = Math.PI * 2;
var VM = 8.4, KACC = 8.5, KMUD = 3.2, DASH_V = 18.5, DASH_T = 0.42, DASH_CD = 1.7, STEER = 3.2, DRIFT = 0.35, JALON = 0.17, DRIP = 4, HOT = 1.4;
var REACH = { 1: 1.75, 2: 1.55, 3: 1.4 }, TUMBA_T = { 1: 2.6, 2: 2.4, 3: 2.2 }, GAIN = { 1: 1, 2: 1.12, 3: 1.25 };
var VC = { 1: 10.5, 2: 12, 3: 13.5 }, ATURDE = { 1: 1.3, 2: 1.1, 3: 0.9 }, LLUVIA = { 1: 0.64, 2: 0.5, 3: 0.4 };
var TEAM = ['#ffd23f', '#3fb0ff', '#ff5c8a', '#5cff7a'];
var PAL = {
  1: { tierra: '#c9a36a', tierra2: '#b48c58', pasto: '#7fc25a' },
  2: { tierra: '#c08a5a', tierra2: '#a8744a', pasto: '#8a9a4a' },
  3: { tierra: '#7a6a70', tierra2: '#665660', pasto: '#3a4a3a' }
};
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
function wrap(a) { while (a > Math.PI) a -= TAUR; while (a < -Math.PI) a += TAUR; return a; }
function dist(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }

FIESTA.LIVE.add('f_toro', {
  name: '¡TOROS COLEADOS!', modos: ['ffa', '1v1'], clase: 'rank', modelo: 'A', dur: 30,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 700, scoreRate: 40, minT: 27, finTemprano: 0 },
  cuerpo: ['x', 'z', 'st', 'sc', 'q', 'h', 'd', 'k'], discretos: ['st', 'sc', 'h', 'd', 'k'],
  carta: {
    obj: 'Agárrale la cola al toro suelto y tumba antes que los demás',
    gana: 'El que más puntos junte: cada coleada vale 40 a 70 (doble al final), y la cola es de uno solo a la vez.',
    como: { tactil: 'Joystick = mover el caballo (y equilibrarte en la cola) · A pegado a la cola = agarrar · A lejos = espolear y empujar', teclado: 'WASD o flechas · ESPACIO' },
    demos: [{ id: 'mover', txt: 'Pégate a la cola del toro y toca A para agarrarla' }, { id: 'saltar', txt: 'Colgado, mueve el stick para mantener la marca al centro' }],
    roles: null
  },

  mk: function (c) {
    var n = c.n, dur = c.dur, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, pal = PAL[lv], rng = c.rng, i, k;
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: TEAM[p % 4], ch: null }; };
    var S30 = Math.min(1, dur / 30);

    /* ───── el toro: se simula una vez (30 Hz) con c.rng; después es una tabla que se lee con el reloj ───── */
    var NSTEP = Math.ceil((dur + 14) * 30) + 3, TX = [], TZ = [], TH = [], TS = [], TP = [], TV = [], hash = 7;
    (function () {
      var x = -2, z = 0, h = rng.next() * TAUR - Math.PI, s = 0, ts = 0, td = 2.4, sp = 0, hc = h, cs = 1, cv = 0, turnTo = h, nextT = 0;
      var quT = [], quA = [], qi = 0, qhold = 0, qh = h, qs = 0, i2, t, f, pull, dh, tx, tz, nx;
      for (i2 = 0; i2 < NSTEP; i2++) {
        t = i2 / 30; f = cl(t / dur, 0, 1); pull = 0;
        if (s === 0) {                                          // trota y cambia de rumbo
          sp += (4.3 + 1.7 * f - sp) * (6 / 30);
          if (t >= nextT) { turnTo = h + (rng.next() - 0.5) * 2.4; nextT = t + 0.7 + rng.next() * 0.8; }
          if (Math.abs(x + Math.cos(h) * 5) > AX - 2.5 || Math.abs(z + Math.sin(h) * 5) > AZ - 2) turnTo = Math.atan2(-z, -x) + (rng.next() - 0.5) * 0.7;
          dh = wrap(turnTo - h); h += cl(dh, -2.4 / 30, 2.4 / 30); pull = cl(dh * 0.5, -1, 1) + Math.sin(t * 5) * 0.25;
          ts += 1 / 30;
          if (ts >= td) {
            s = 1; ts = 0; td = (1.05 - 0.45 * f) * (0.85 + 0.3 * rng.next());
            tx = (rng.next() - 0.5) * AX * 1.4; tz = (rng.next() - 0.5) * AZ * 1.4;
            hc = dist(tx, tz, x, z) < 6 ? Math.atan2(-z, -x) : Math.atan2(tz - z, tx - x);
          }
        } else if (s === 1) {                                   // escarba: señal de hacia dónde va
          sp = 0; dh = wrap(hc - h); h += cl(dh, -6 / 30, 6 / 30); pull = Math.sin(t * 18) * 0.9; ts += 1 / 30;
          if (ts >= td) {
            s = 2; ts = 0; td = 1.7 + 0.5 * rng.next(); cs = rng.next() < 0.5 ? -1 : 1; cv = lv === 1 ? 0 : cs * (0.3 + 0.3 * rng.next());
            quT = []; quA = []; qi = 0; qhold = 0;
            if (lv >= 2) { quT.push(0.45 + 0.35 * rng.next()); quA.push((rng.next() < 0.5 ? -1 : 1) * (0.7 + 0.35 * rng.next())); }
            if (lv >= 3) { quT.push(1.15 + 0.3 * rng.next()); quA.push((rng.next() < 0.5 ? -1 : 1) * (0.7 + 0.35 * rng.next())); }
          }
        } else if (s === 2) {                                   // embiste
          sp += ((VC[lv] * (1 + 0.18 * f)) - sp) * (7 / 30); ts += 1 / 30;
          if (qi < quT.length && ts >= quT[qi]) { qh = wrap(h + quA[qi]); qs = quA[qi] > 0 ? 1 : -1; qhold = 0.3; qi++; }
          if (qhold > 0) { qhold -= 1 / 30; h += cl(wrap(qh - h), -5 / 30, 5 / 30); pull = qs * 1.6; }
          else { h += cv / 30; pull = cs * 0.5 + Math.sin(t * 9) * 0.2; }
          if (ts >= td) {
            if (lv >= 2 && rng.next() < 0.4 + 0.1 * f) { s = 1; ts = 0; td = 0.4; hc = h + (rng.next() - 0.5) * 1.6; }
            else { s = 0; ts = 0; td = (1.9 - 1.0 * f) * (0.8 + 0.4 * rng.next()); sp *= 0.5; }
          }
        } else {                                                // aturdido contra la cerca
          sp = 0; pull = Math.sin(t * 7) * 0.3; ts += 1 / 30;
          if (ts >= td) { s = 0; ts = 0; td = (1.9 - 1.0 * f) * (0.8 + 0.4 * rng.next()); turnTo = h; nextT = t + 0.5; }
        }
        x += Math.cos(h) * sp / 30; z += Math.sin(h) * sp / 30;
        if (Math.abs(x) > AX - 1.4 || Math.abs(z) > AZ - 1.4) {
          x = cl(x, -(AX - 1.4), AX - 1.4); z = cl(z, -(AZ - 1.4), AZ - 1.4);
          if (s === 2) { s = 3; ts = 0; td = ATURDE[lv] * (1 - 0.3 * f); sp = 0; h = Math.atan2(-z, -x) + (rng.next() - 0.5) * 0.9; qhold = 0; }
        }
        TX.push(x); TZ.push(z); TH.push(h); TS.push(s); TP.push(cl(pull, -1.8, 1.8)); TV.push(sp);
        nx = Math.round(x * 100) ^ (Math.round(z * 100) << 8) ^ (s << 20);
        if (i2 % 7 === 0) hash = (Math.imul(hash ^ nx, 16777619) >>> 0);
      }
    })();
    var B = { x: 0, z: 0, h: 0, s: 0, pull: 0, sp: 0, cx: 1, sz: 0, tx: 0, tz: 0 };
    function bullAt(gt, o) {
      var tt = gt < 0 ? 0 : gt, ii = Math.min(NSTEP - 2, Math.floor(tt * 30)), u = Math.min(1, tt * 30 - ii);
      o.x = TX[ii] + (TX[ii + 1] - TX[ii]) * u; o.z = TZ[ii] + (TZ[ii + 1] - TZ[ii]) * u; o.h = TH[ii] + wrap(TH[ii + 1] - TH[ii]) * u;
      o.s = TS[ii]; o.pull = TP[ii]; o.sp = TV[ii]; o.cx = Math.cos(o.h); o.sz = Math.sin(o.h); o.tx = o.x - o.cx * 1.25; o.tz = o.z - o.sz * 1.25;
      return o;
    }

    /* ───── eventos del llano: todo sale del reloj y de c.rng en mk ───── */
    var POLV = [], CAPO = [], np = lv >= 2 ? 3 : 2, FRP = [0.16, 0.5, 0.74], FRC = [0.3, 0.62, 0.86], ncap = lv >= 3 ? 3 : 2, cdir = rng.next() < 0.5 ? 1 : -1;
    for (k = 0; k < np; k++) POLV.push({ t0: dur * FRP[k], len: Math.max(2.5, 6 * S30), x: (rng.next() - 0.5) * AX * 1.2, z: (rng.next() - 0.5) * AZ * 1.0, vx: (rng.next() - 0.5) * 2, vz: (rng.next() - 0.5) * 1.2, r: 4.2 });
    for (k = 0; k < ncap; k++) { var tc = Math.max(2.2, 4.0 * S30); CAPO.push({ t0: dur * FRC[k], dur: tc, dir: cdir * (k % 2 ? -1 : 1), z: (rng.next() - 0.5) * AZ * 1.5, v: (2 * AX + 8) / tc }); }
    var BEC = { t0: dur * 0.42, t1: dur * 0.42 + Math.max(3, 8 * S30), fa: 0.5 + rng.next() * 0.2, fb: 0.8 + rng.next() * 0.3, pa: rng.next() * 6.28, pb: rng.next() * 6.28 };
    var RT = dur * LLUVIA[lv], UL = dur * 0.78;
    function polvPos(e, gt, o) { o.x = e.x + e.vx * (gt - e.t0); o.z = e.z + e.vz * (gt - e.t0); return o; }
    function polvOn(e, gt) { return gt >= e.t0 && gt < e.t0 + e.len; }
    function polvDentro(x, z, gt) { var j, o = { x: 0, z: 0 }; for (j = 0; j < POLV.length; j++) if (polvOn(POLV[j], gt)) { polvPos(POLV[j], gt, o); if (dist(x, z, o.x, o.z) < POLV[j].r) return true; } return false; }
    function capOn(e, gt) { return gt >= e.t0 && gt < e.t0 + e.dur; }
    function capX(e, gt) { return e.dir > 0 ? -AX - 4 + e.v * (gt - e.t0) : AX + 4 - e.v * (gt - e.t0); }
    function becOn(gt) { return gt >= BEC.t0 && gt < BEC.t1; }
    function becPos(gt, o) { var u = gt - BEC.t0; o.x = (AX - 3) * Math.sin(BEC.fa * u * 2.2 + BEC.pa); o.z = (AZ - 2.5) * Math.sin(BEC.fb * u * 2.2 + BEC.pb); return o; }
    function llueve(gt) { return gt >= RT; }
    function mult(gt) { return gt >= UL ? 2 : 1; }
    function gain(gt) { return (0.9 + 0.5 * cl(gt / dur, 0, 1)) * GAIN[lv]; }

    /* ───── estado de cada jinete ───── */
    var P = [], cpuR = [], plan = [], tailOff = -9;
    for (i = 0; i < n; i++) {
      P.push({ x: -AX + 3, z: (i - (n - 1) / 2) * (n === 2 ? 7 : 5.2), vx: 0, vz: 0, fa: 0, st: 0, stU: -9, h: 0, q: 0, tp: 0, sc: 0, dU: -9, dCd: 0, jCd: 0, d: 0, k: 0, own: false,
        nTum: 0, nRob: 0, best: 0, qa: 0, hd: 0, stagU: -9, shU: {}, rcU: -9, evU: -9, why: '', whyT: -9, ult: 0, ultT: -9, fx: [], fxC: 0 });
      cpuR.push(c.rngFor('cpu' + i)); plan.push({ nx: 0, nz: 0, thr: -1, inR: -1, pe: 0 });
    }
    var absT = 0, CAP_O = { x: 0, z: 0 }, BEC_O = { x: 0, z: 0 }, POL_O = { x: 0, z: 0 };
    function evento(q, e) { q.fxC++; q.fx.push({ n: q.fxC, e: e }); if (q.fx.length > 8) q.fx.shift(); }
    function holderOtro(p) { var r; for (r = 0; r < n; r++) if (r !== p && P[r].st === 1) return r; return -1; }
    function holdPos(qq, b, o) { o.x = b.tx - b.cx * 1.7 - b.sz * qq * 1.1; o.z = b.tz - b.sz * 1.7 + b.cx * qq * 1.1; return o; }
    function posDe(r, o) { var q = P[r]; if (q.st === 1) return holdPos(q.q, B, o); o.x = q.x; o.z = q.z; return o; }
    function impulso3D(p, gt) {                                                 // de dónde viene el golpe (toro, caporal, becerro u otro jinete): el cuerpo sale en esa dirección
      var q = P[p], r, best = null, bd = 3, dd, o = { x: 0, z: 0 };
      dd = dist(q.x, q.z, B.x, B.z); if (dd < bd && dd > 0.01) { best = { x: B.x, z: B.z }; bd = dd; }
      for (r = 0; r < CAPO.length; r++) if (capOn(CAPO[r], gt)) { o.x = capX(CAPO[r], gt); o.z = CAPO[r].z; dd = dist(q.x, q.z, o.x, o.z); if (dd < 2.6 && dd < bd && dd > 0.01) { best = { x: o.x, z: o.z }; bd = dd; } }
      if (becOn(gt)) { becPos(gt, o); dd = dist(q.x, q.z, o.x, o.z); if (dd < 2.2 && dd < bd && dd > 0.01) { best = { x: o.x, z: o.z }; bd = dd; } }
      for (r = 0; r < n; r++) if (r !== p) { dd = dist(q.x, q.z, P[r].x, P[r].z); if (dd < 2.2 && dd < bd && dd > 0.01) { best = { x: P[r].x, z: P[r].z }; bd = dd; } }
      if (best) return { x: q.x - best.x, z: q.z - best.z };
      return { x: B.cx, z: B.sz };                                              // nadie a la vista: en la dirección en que va el toro
    }
    function puedeAgarrar(p, gt) {
      var q = P[p]; if (q.st !== 0 || gt < tailOff || gt < q.stagU || holderOtro(p) >= 0) return false;
      return dist(q.x, q.z, B.tx, B.tz) < REACH[lv];
    }
    function cae(q, gt, dur2, why, vx, vz) { q.st = 2; q.stU = gt + dur2; q.vx = vx; q.vz = vz; q.tp = 0; q.q = 0; q.h = 0; q.why = why; q.whyT = gt; q.d = 0; q.dU = -9; evento(q, 'cae'); }
    var HP = { x: 0, z: 0 };

    function updJugador(p, gt, dt) {
      var q = P[p], r, d, e, taps, nx, nz, m, hp = HP;
      if (!c.mio(p)) { q.own = false; return; }
      if (!q.own) q.own = true;
      e = c.eje(p); taps = c.tap(p, 'a');
      if (gt < 0) return;
      q.d = gt < q.dU ? 1 : 0;
      if (q.st === 2) {                                   // en el piso, rodando
        q.vx *= Math.max(0, 1 - 4 * dt); q.vz *= Math.max(0, 1 - 4 * dt);
        q.x = cl(q.x + q.vx * dt, -AX + 0.9, AX - 0.9); q.z = cl(q.z + q.vz * dt, -AZ + 0.9, AZ - 0.9);
        if (gt >= q.stU) q.st = 0;
        return;
      }
      if (q.st === 1) {                                   // colgado de la cola
        for (r = 0; r < n; r++) if (r !== p && P[r].st === 1 && (P[r].h < q.h || (P[r].h === q.h && r < p))) {      // otro la tenía primero
          q.st = 0; q.tp = 0; q.q = 0; q.h = 0; q.stagU = gt + 0.5; q.vx = -B.sz * 5; q.vz = B.cx * 5; q.nRob++; q.why = '¡OTRO LA AGARRÓ PRIMERO!'; q.whyT = gt; evento(q, 'perdio'); return;
        }
        for (r = 0; r < n; r++) if (r !== p && P[r].st !== 1 && P[r].d && gt * 10 - q.h > 9 && dist(q.x, q.z, P[r].x, P[r].z) < 2.1) {      // te pegó una espuela: se te cae la cola
          cae(q, gt, 0.8, '¡TE SACARON DE LA COLA!', -B.sz * 5 + B.cx * 3, B.cx * 5 + B.sz * 3); q.nRob++; return;
        }
        for (r = 0; r < CAPO.length; r++) if (capOn(CAPO[r], gt) && dist(q.x, q.z, capX(CAPO[r], gt), CAPO[r].z) < 2) { cae(q, gt, 0.7, '¡EL CAPORAL!', CAPO[r].dir * 7, 3); return; }
        if (becOn(gt) && dist(q.x, q.z, becPos(gt, BEC_O).x, BEC_O.z) < 1.6) { cae(q, gt, 0.6, '¡EL BECERRO!', 2, 2); return; }
        q.hd += dt;
        q.q += (B.pull * gain(gt) + DRIFT * q.q + STEER * e.x) * dt; q.qa += Math.abs(q.q) * dt;
        if (taps > 0 && gt >= q.jCd) { q.jCd = gt + 0.7; q.tp += JALON; q.q += (B.pull !== 0 ? (B.pull > 0 ? 1 : -1) : (e.x >= 0 ? 1 : -1)) * 0.4; evento(q, 'jalon'); }
        q.tp += dt / TUMBA_T[lv] * (Math.abs(q.q) < 0.6 ? 1 : 0.3);
        q.sc += DRIP * mult(gt) * dt;
        holdPos(q.q, B, hp); q.x = hp.x; q.z = hp.z; q.vx = B.cx * B.sp; q.vz = B.sz * B.sp; q.fa = B.h;
        if (Math.abs(q.q) >= 1) {
          var sg = q.q > 0 ? 1 : -1;
          cae(q, gt, 0.9, '¡SE SOLTÓ!', -B.sz * sg * 6 + B.cx * 2, B.cx * sg * 6 + B.sz * 2); q.nRob += 0; return;
        }
        if (q.tp >= 1) {
          var pts = Math.round((40 + 30 * (1 - cl(q.qa / Math.max(0.5, q.hd), 0, 1))) * mult(gt));
          q.sc += pts; q.nTum++; q.k++; if (pts > q.best) q.best = pts; q.ult = pts; q.ultT = gt; tailOff = gt + HOT;
          q.st = 0; q.tp = 0; q.q = 0; q.h = 0; q.hd = 0; q.qa = 0; q.stagU = gt + 0.3; q.vx = B.cx * 3 - B.sz * 7; q.vz = B.sz * 3 + B.cx * 7; evento(q, 'tumba'); return;
        }
        return;
      }
      /* libre */
      if (taps > 0) {
        if (puedeAgarrar(p, gt)) { q.st = 1; q.h = Math.max(1, Math.round(gt * 10)); q.q = 0; q.tp = 0; q.hd = 0; q.qa = 0; q.jCd = gt + 0.4; evento(q, 'agarra'); return; }
        if (gt >= q.dCd && gt >= q.stagU - 0.3) {
          q.dU = gt + DASH_T; q.dCd = gt + DASH_CD; q.d = 1; evento(q, 'espuela');
          m = Math.sqrt(e.x * e.x + e.y * e.y);
          if (m > 0.3) { q.dx = e.x / m; q.dz = e.y / m; } else { q.dx = Math.cos(q.fa); q.dz = Math.sin(q.fa); }
        }
      }
      var barro = llueve(gt), polvo = polvDentro(q.x, q.z, gt), lim = VM * (polvo ? 0.6 : 1) * (barro ? 0.92 : 1) * (gt < q.stagU ? 0.55 : 1);
      if (q.d) {
        var dv = DASH_V * (barro ? 0.78 : 1) * (polvo ? 0.7 : 1), k2 = Math.min(1, 22 * dt);
        q.vx += ((q.dx || 1) * dv - q.vx) * k2; q.vz += ((q.dz || 0) * dv - q.vz) * k2;
      } else {
        var ka = Math.min(1, (barro ? KMUD : KACC) * dt); m = Math.sqrt(e.x * e.x + e.y * e.y); if (m > 1) { e = { x: e.x / m, y: e.y / m }; }
        q.vx += (e.x * lim - q.vx) * ka; q.vz += (e.y * lim - q.vz) * ka;
      }
      q.x += q.vx * dt; q.z += q.vz * dt;
      m = Math.sqrt(q.vx * q.vx + q.vz * q.vz);
      if (m > 0.8) q.fa += wrap(Math.atan2(q.vz, q.vx) - q.fa) * Math.min(1, 10 * dt);
      /* la cerca */
      if (q.x < -AX + 0.9) { q.x = -AX + 0.9; if (q.vx < 0) q.vx = 0; } if (q.x > AX - 0.9) { q.x = AX - 0.9; if (q.vx > 0) q.vx = 0; }
      if (q.z < -AZ + 0.9) { q.z = -AZ + 0.9; if (q.vz < 0) q.vz = 0; } if (q.z > AZ - 0.9) { q.z = AZ - 0.9; if (q.vz > 0) q.vz = 0; }
      /* otros jinetes: se separan, y la espuela empuja */
      for (r = 0; r < n; r++) {
        if (r === p) continue;
        var o = P[r]; if (o.st === 1) continue;
        d = dist(q.x, q.z, o.x, o.z);
        if (d < 1.7 && d > 0.001) {
          nx = (q.x - o.x) / d; nz = (q.z - o.z) / d;
          q.x += nx * (1.7 - d) * 0.6; q.z += nz * (1.7 - d) * 0.6;
          if (o.d && gt >= (q.shU[r] || -9)) {
            q.shU[r] = gt + 0.7; q.vx += nx * 12; q.vz += nz * 12; q.stagU = gt + 0.45; q.why = '¡TE EMPUJARON!'; q.whyT = gt; evento(q, 'empujon');
          }
          if (q.d && gt >= q.rcU) { q.rcU = gt + 0.6; q.vx *= 0.45; q.vz *= 0.45; q.dU = gt; evento(q, 'choque'); }
        }
      }
      /* el toro: no se pasa por encima de él, y de frente embistiendo es CORNADA */
      d = dist(q.x, q.z, B.x, B.z);
      if (d < 1.55 && d > 0.001) { q.x += (q.x - B.x) / d * (1.55 - d); q.z += (q.z - B.z) / d * (1.55 - d); }
      if (B.s === 2 && B.sp > 6.5 && dist(q.x, q.z, B.x + B.cx * 1.0, B.z + B.sz * 1.0) < 1.7 && gt >= q.evU) {
        q.evU = gt + 1; cae(q, gt, 1.15, '¡CORNADA!', B.cx * 9 - B.sz * 3, B.sz * 9 + B.cx * 3); return;
      }
      /* el caporal y el becerro */
      for (r = 0; r < CAPO.length; r++) {
        if (!capOn(CAPO[r], gt)) continue;
        if (dist(q.x, q.z, capX(CAPO[r], gt), CAPO[r].z) < 1.9 && gt >= q.evU) { q.evU = gt + 0.9; cae(q, gt, 0.7, '¡EL CAPORAL!', CAPO[r].dir * 8, (q.z > CAPO[r].z ? 1 : -1) * 4); return; }
      }
      if (becOn(gt) && dist(q.x, q.z, becPos(gt, BEC_O).x, BEC_O.z) < 1.3 && gt >= q.evU) { q.evU = gt + 0.9; cae(q, gt, 0.6, '¡EL BECERRO TE HIZO TROPEZAR!', q.vx * 0.2, q.vz * 0.2); }
    }

    /* ───── CPU (el juez la corre para los asientos CPU) ───── */
    function gauss(R2) { return (R2.next() + R2.next() + R2.next() - 1.5) * 2; }
    function ai(p, dt, api, gt) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], ex, ey, m, h2, tx, tz, dx, dz, along, lat, r, thr = false, ax = 0, az = 0;
      if (gt < 0 || q.st === 2) { api.eje(0, 0); return; }
      bullAt(gt, B);
      if (q.st === 1) {                                  // colgado: contrarresta el tirón
        if (gt >= pl.nx) { pl.nx = gt + 0.1 + 0.12 * (1 - sk); pl.nz = gauss(R2) * 0.35 * (1 - sk); }
        ex = cl(-(B.pull * gain(gt) * (0.5 + 0.5 * sk)) / STEER - q.q * (1.2 + sk) + pl.nz, -1, 1);
        api.eje(ex, 0);
        if (gt >= q.jCd && Math.abs(q.q) < 0.3 && B.s !== 1 && R2.next() < 0.03 + 0.08 * sk) api.press('a');
        return;
      }
      h2 = holderOtro(p);
      dx = q.x - B.x; dz = q.z - B.z; along = dx * B.cx + dz * B.sz; lat = -dx * B.sz + dz * B.cx;
      if ((B.s === 1 || B.s === 2) && along > 0 && along < 18 && Math.abs(lat) < 3) {      // me va a embestir
        if (pl.thr < 0) pl.thr = gt;
        if (gt - pl.thr > 0.3 * (1 - sk) + 0.05) { thr = true; ax = -B.sz * (lat >= 0 ? 1 : -1); az = B.cx * (lat >= 0 ? 1 : -1); }
      } else pl.thr = -1;
      for (r = 0; r < CAPO.length && !thr; r++) if (capOn(CAPO[r], gt) && sk > 0.2) {
        var cx2 = capX(CAPO[r], gt) + CAPO[r].dir * CAPO[r].v * 0.5;
        if (Math.abs(q.x - cx2) < 5 && Math.abs(q.z - CAPO[r].z) < 3.2) { thr = true; ax = 0; az = q.z >= CAPO[r].z ? 1 : -1; }
      }
      if (!thr && becOn(gt) && sk > 0.4) { becPos(gt, BEC_O); if (dist(q.x, q.z, BEC_O.x, BEC_O.z) < 3.6) { thr = true; ax = q.x - BEC_O.x; az = q.z - BEC_O.z; m = Math.sqrt(ax * ax + az * az) || 1; ax /= m; az /= m; } }
      if (thr) { api.eje(ax, az); return; }
      if (h2 >= 0) {                                     // alguien la tiene: pégale o espera cerca
        tx = P[h2].x; tz = P[h2].z;
        if (sk > 0.35 && dist(q.x, q.z, tx, tz) < 6.5 && gt >= q.dCd && R2.next() < 0.008 + 0.02 * sk) { api.eje((tx - q.x), (tz - q.z)); api.press('a'); return; }
      } else {
        var lead = Math.min(0.5, dist(q.x, q.z, B.tx, B.tz) / 10);
        tx = B.tx + B.cx * B.sp * lead + pl.pe * 0.6; tz = B.tz + B.sz * B.sp * lead;
        if (R2.next() < 0.02) pl.pe = gauss(R2) * (0.5 - 0.4 * sk);
      }
      dx = tx - q.x; dz = tz - q.z; m = Math.sqrt(dx * dx + dz * dz) || 1;
      var mag = cl(m / 2, 0.25, 1); api.eje(dx / m * mag, dz / m * mag);
      if (h2 < 0 && puedeAgarrar(p, gt)) {
        if (pl.inR < 0) pl.inR = gt;
        if (gt - pl.inR > 0.25 * (1 - sk) + 0.04 && R2.next() < 0.45 + 0.5 * sk) { api.press('a'); pl.inR = -1; }
        return;
      }
      pl.inR = -1;
      if (h2 < 0 && m > 6.5 && B.s !== 2 && gt >= q.dCd && R2.next() < 0.02 + 0.04 * sk) api.press('a');
    }

    /* ───── avisos de eventos (los dos dibujos) ───── */
    function aviso(gt) {
      var j;
      if (gt >= UL && gt < UL + 2.2) return ['¡ÚLTIMA EMBESTIDA! TODO VALE DOBLE', '#ffd23f'];
      for (j = 0; j < CAPO.length; j++) if (gt >= CAPO[j].t0 - 1.4 && gt < CAPO[j].t0 + 0.6) return ['¡CUIDADO, EL CAPORAL!', '#ff8a3f'];
      if (gt >= BEC.t0 - 0.5 && gt < BEC.t0 + 1.6) return ['¡UN BECERRO SUELTO!', '#ffb36b'];
      for (j = 0; j < POLV.length; j++) if (gt >= POLV[j].t0 && gt < POLV[j].t0 + 1.4) return ['¡POLVAREDA! TE FRENA', '#e3c79a'];
      if (gt >= RT && gt < RT + 1.8) return ['¡LLUEVE! EL BARRO RESBALA', '#8fd8ff'];
      return null;
    }
    /* el HUD (2D, igual en 3D) */
    function hud(f) {
      var gt = c.ahora(), cx = (f.x0 + f.x1) / 2, yo = c.yo >= 0 ? c.yo : -1, av = aviso(gt);
      if (gt > -0.5 && gt < 3 && !c.practica) txt('¡CÓGELE LA COLA AL TORO!', cx, 118, 24, '#ffd23f', 0, true);
      if (av) txt(av[0], cx, 150 + Math.sin(absT * 12) * 2, 20, av[1], 0, true);
      if (gt >= UL) txt('x2', f.x1 - 40, 60, 28, '#ffd23f', 0, true);
      if (yo < 0 || gt < 0) return;
      var q = P[yo];
      if (q.st === 1) {
        var bw = 230, by = 520;
        rr(cx - bw / 2, by - 9, bw, 18, 9, 'rgba(20,16,28,.6)', 2);
        rr(cx - bw * 0.3, by - 9, bw * 0.6, 18, 6, 'rgba(92,255,122,.45)', 0);
        ell(cx + cl(q.q, -1.1, 1.1) * bw / 2, by, 10, 10, Math.abs(q.q) > 0.6 ? '#ff3b4e' : '#fffdf2', 2.5);
        txt('◀ MANTÉN LA MARCA AL CENTRO ▶', cx, by - 24, 13, '#fffdf2', 0, true);
        rr(cx - 90, by + 22, 180, 10, 5, 'rgba(20,16,28,.6)', 2); rr(cx - 90, by + 22, 180 * cl(q.tp, 0, 1), 10, 5, '#ffd23f', 0);
        txt('TUMBA  ·  A = JALÓN', cx, by + 48, 12, '#fffdf2', 0, true);
      } else if (q.st === 2) {
        txt(q.why || '¡AL PISO!', cx, 560, 22, '#ff3b4e', 0, true);
      } else {
        bullAt(gt, B);
        if (puedeAgarrar(yo, gt)) txt('¡A! ¡AGARRA LA COLA!', cx, 555 + Math.sin(absT * 14) * 3, 24, '#5cff7a', 0, true);
        else if (holderOtro(yo) >= 0) txt('¡LA TIENE OTRO! ESPOLÉALO (A)', cx, 560, 16, '#ffd23f', 0, true);
        else if (gt < tailOff) txt('LA COLA ESTÁ CALIENTE...', cx, 560, 16, '#ff8a3f', 0, true);
        else txt(gt < q.dCd ? 'ESPUELA RECARGANDO' : 'A = ESPOLEAR', cx, 560, 14, '#fffdf2', 0, true);
      }
      if (gt - q.ultT < 1.4 && q.ult) txt('¡COLEADA! +' + q.ult, cx, 190, 28, '#ffd23f', 0, true);
      else if (gt - q.whyT < 1.2 && q.why && q.st !== 2) txt(q.why, cx, 190, 20, '#ff8a3f', 0, true);
    }

    /* ───── 2D de respaldo (sin WebGL o ?plano=1): solo rr / ell / line / poly / txt ───── */
    function geom() { var f = c.campo(); if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 }; return f; }
    function dibujar2D() {
      var f = geom(), gt = c.ahora(), w = f.x1 - f.x0, cx = (f.x0 + f.x1) / 2, sx = w * 0.46 / AX, sy = 200 / AZ, p, j, hp = { x: 0, z: 0 };
      function X(x) { return cx + x * sx; } function Y(z) { return 330 + z * sy; }
      rr(f.x0, 0, w, 600, 0, pal.pasto, 0);
      rr(X(-AX), Y(-AZ), AX * 2 * sx, AZ * 2 * sy, 8, pal.tierra, 4);
      if (llueve(gt)) rr(X(-AX), Y(-AZ), AX * 2 * sx, AZ * 2 * sy, 8, 'rgba(40,60,90,.35)', 0);
      bullAt(gt, B);
      for (j = 0; j < POLV.length; j++) if (polvOn(POLV[j], gt)) { polvPos(POLV[j], gt, POL_O); ell(X(POL_O.x), Y(POL_O.z), POLV[j].r * sx, POLV[j].r * sy, 'rgba(227,199,154,.65)', 0); }
      for (j = 0; j < CAPO.length; j++) if (capOn(CAPO[j], gt)) ell(X(capX(CAPO[j], gt)), Y(CAPO[j].z), 18, 10, '#2f5fd0', 2.5);
      if (becOn(gt)) { becPos(gt, BEC_O); ell(X(BEC_O.x), Y(BEC_O.z), 11, 7, '#7a4a30', 2); }
      if (B.s === 1) line([[X(B.x), Y(B.z)], [X(B.x + B.cx * 14), Y(B.z + B.sz * 14)]], 4, 'rgba(255,59,78,.7)');
      ell(X(B.x), Y(B.z), 20, 12, '#2a1e1a', 2.5); poly([[X(B.x + B.cx * 1.3), Y(B.z + B.sz * 1.3)], [X(B.x + B.cx * 2.3 - B.sz * 0.4), Y(B.z + B.sz * 2.3 + B.cx * 0.4)], [X(B.x + B.cx * 2.3 + B.sz * 0.4), Y(B.z + B.sz * 2.3 - B.cx * 0.4)]], '#fffdf2', 1.5);
      ell(X(B.tx), Y(B.tz), 6, 6, gt < tailOff ? '#ff8a3f' : '#5cff7a', 1.5);
      for (p = 0; p < n; p++) {
        var q = P[p], yo = p === c.yo; posDe(p, hp);
        ell(X(hp.x), Y(hp.z), 17, 10, q.st === 2 ? '#6a4a30' : '#8a5a30', 2.5); rr(X(hp.x) - 6, Y(hp.z) - 14, 12, 10, 3, asiento(p).color || TEAM[p % 4], 2);
        txt((yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7)) + '  ' + Math.round(q.sc), X(hp.x), Y(hp.z) - 22, 12, yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      hud(f);
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): el corral del llano. Solo dibujo: lee P y la tabla del toro ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#e6f4ff'], hemi: [0xffffff, 0x9a8a60, .55], sol: [0xfff2d8, .72], niebla: '#e6f4ff', noche: 0 },
      2: { cielo: ['#ff7a4a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a5a, .5], sol: [0xffa860, .8], niebla: '#ffc890', noche: 0 },
      3: { cielo: ['#121034', '#33295e'], hemi: [0x8a8aff, 0x3a2a4a, .42], sol: [0x9aa8ff, .28], niebla: '#26204a', noche: 1 }
    };
    function patas(g3, M, col, w, h, d) {
      var T = THREE, out = [], j;
      for (j = 0; j < 4; j++) {
        var pg = new T.Group(); pg.position.set(j < 2 ? w * 0.36 : -w * 0.36, h, (j % 2 ? 1 : -1) * d * 0.3); g3.add(pg);
        var pa = M(new T.BoxGeometry(0.18, h, 0.18), col, { g: .05 }); pa.position.y = -h / 2; pg.add(pa);
        var ca = M(new T.BoxGeometry(0.22, 0.14, 0.22), '#2a2020', { borde: false }); ca.position.y = -h + 0.07; pg.add(ca);
        out.push(pg);
      }
      return out;
    }
    function caballo(colManta, col) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), cu = new T.Group(); g3.add(cu); col = col || '#8a5a30';
      var cuerpo = M(new T.BoxGeometry(1.7, 0.75, 0.62), col, { g: .04 }); cuerpo.position.y = 1.3; cu.add(cuerpo);
      var cue = M(new T.BoxGeometry(0.4, 0.9, 0.36), col, { g: .04 }); cue.position.set(0.85, 1.75, 0); cue.rotation.z = -0.5; cu.add(cue);
      var cab = M(new T.BoxGeometry(0.62, 0.32, 0.3), col, { g: .04 }); cab.position.set(1.25, 2.12, 0); cab.rotation.z = -0.35; cu.add(cab);
      var crin = M(new T.BoxGeometry(0.12, 0.8, 0.12), '#2a1a10', { borde: false }); crin.position.set(0.7, 1.95, 0); crin.rotation.z = -0.5; cu.add(crin);
      [-1, 1].forEach(function (s) { var o = M(new T.ConeGeometry(0.07, 0.18, 4), col, { borde: false }); o.position.set(1.05, 2.36, s * 0.1); cu.add(o); });
      var cola = M(new T.CylinderGeometry(0.05, 0.13, 0.75, 5), '#2a1a10', { g: .05 }); cola.position.set(-0.95, 1.2, 0); cola.rotation.z = -0.6; cu.add(cola);
      var manta = M(new T.BoxGeometry(0.7, 0.08, 0.78), colManta, { g: .04 }); manta.position.set(0, 1.7, 0); cu.add(manta);
      var silla = M(new T.BoxGeometry(0.5, 0.14, 0.5), '#5a3a22', { g: .04 }); silla.position.set(0, 1.79, 0); cu.add(silla);
      var lp = patas(cu, M, col, 1.7, 0.95, 0.62);
      return { g: g3, cu: cu, patas: lp, cola: cola, cab: cab };
    }
    function toro3D(esc) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), cu = new T.Group(); g3.add(cu); esc = esc || 1;
      var col = '#2a1e1a';
      var cuerpo = M(new T.BoxGeometry(1.8, 0.9, 0.8), col, { g: .04 }); cuerpo.position.y = 1.15; cu.add(cuerpo);
      var giba = M(new T.BoxGeometry(0.5, 0.3, 0.6), col, { g: .04 }); giba.position.set(0.55, 1.68, 0); cu.add(giba);
      var cab = new T.Group(); cab.position.set(1.05, 1.25, 0); cu.add(cab);
      var cr = M(new T.BoxGeometry(0.55, 0.5, 0.5), col, { g: .04 }); cr.position.x = 0.2; cab.add(cr);
      var hoc = M(new T.BoxGeometry(0.2, 0.3, 0.36), '#5a4038', { borde: false }); hoc.position.set(0.5, -0.08, 0); cab.add(hoc);
      var aro = M(new T.TorusGeometry(0.1, 0.025, 5, 8), '#ffd23f', { borde: false }); aro.position.set(0.58, -0.28, 0); aro.rotation.y = Math.PI / 2; cab.add(aro);
      [-1, 1].forEach(function (s) { var cn = M(new T.ConeGeometry(0.08, 0.6, 5), '#fffdf2', { g: .06 }); cn.position.set(0.2, 0.3, s * 0.32); cn.rotation.x = s * -0.9; cab.add(cn); });
      var cola = new T.Group(); cola.position.set(-0.9, 1.4, 0); cu.add(cola);
      var cv = M(new T.CylinderGeometry(0.04, 0.04, 1.0, 5), col, { borde: false }); cv.position.y = -0.5; cola.add(cv);
      var bor = M(new T.SphereGeometry(0.12, 6, 4), '#14101c', { borde: false }); bor.position.y = -1.02; cola.add(bor);
      cola.rotation.z = 0.9;
      var lp = patas(cu, M, col, 1.8, 0.75, 0.8);
      g3.scale.setScalar(esc);
      return { g: g3, cu: cu, patas: lp, cola: cola, cab: cab };
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], j, dm = new T.Object3D();
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 120, 420], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-28, 12, 8);
      V3.pista('toro', { bpm: 168, acordes: [[57, 61, 64], [62, 66, 69], [64, 68, 71], [57, 61, 64]],
        mel: [76, 0, 76, 78, 80, 0, 78, 76, 74, 0, 73, 0, 71, 73, 74, 0, 76, 0, 81, 0, 80, 78, 76, 0, 74, 76, 73, 0, 69, 0, 0, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* el llano y el piso del corral (huellas pintadas) */
      var pastoM = new T.MeshToonMaterial({ color: new T.Color(pal.pasto), gradientMap: tn('#fff').gradientMap });
      var pasto = new T.Mesh(new T.PlaneGeometry(900, 600), pastoM); pasto.rotation.x = -Math.PI / 2; pasto.position.y = -0.02; pasto.receiveShadow = true; S3.add(pasto);
      var tierra = V3.texturaCanvas(256, 128, function (x, w, h) {
        x.fillStyle = pal.tierra; x.fillRect(0, 0, w, h);
        for (var q2 = 0; q2 < 160; q2++) { x.fillStyle = q2 % 2 ? pal.tierra2 : V3.oscurecer(pal.tierra, 1.08); x.fillRect((q2 * 53) % w, (q2 * 29) % h, 6 + q2 % 7, 3); }
      }, [5, 2]);
      var pisoM = new T.MeshToonMaterial({ map: tierra, gradientMap: tn('#fff').gradientMap });
      var piso = new T.Mesh(new T.PlaneGeometry(AX * 2 + 2, AZ * 2 + 2), pisoM); piso.rotation.x = -Math.PI / 2; piso.position.y = 0.01; piso.receiveShadow = true; S3.add(piso);
      var charcos = [];
      for (j = 0; j < 7; j++) {
        var ch = new T.Mesh(new T.CircleGeometry(1, 10), new T.MeshBasicMaterial({ color: 0x3a4a60, transparent: true, opacity: .55, depthWrite: false }));
        ch.rotation.x = -Math.PI / 2; ch.position.set(-AX + 4 + (j * 6.1) % (AX * 2 - 8), 0.03, -AZ + 3 + (j * 4.7) % (AZ * 2 - 6)); ch.scale.set(0.01, 0.01, 0.01); S3.add(ch); charcos.push(ch);
      }
      /* la cerca: postes en instancias y varas */
      var posts = [], px, pz;
      for (px = -AX; px <= AX + 0.01; px += 2.5) { posts.push([px, -AZ - 0.5]); posts.push([px, AZ + 0.5]); }
      for (pz = -AZ + 2.5; pz < AZ; pz += 2.5) { posts.push([-AX - 0.5, pz]); posts.push([AX + 0.5, pz]); }
      var cp = new T.InstancedMesh(new T.BoxGeometry(0.22, 1.5, 0.22), tn('#7a5a3a'), posts.length);
      for (j = 0; j < posts.length; j++) { dm.position.set(posts[j][0], 0.75, posts[j][1]); dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); cp.setMatrixAt(j, dm.matrix); }
      cp.castShadow = true; S3.add(cp);
      [0.55, 1.1].forEach(function (y) {
        [-AZ - 0.5, AZ + 0.5].forEach(function (zz) { var va = M(new T.BoxGeometry(AX * 2 + 1, 0.1, 0.08), '#e8d8b8', { g: .03 }); va.position.set(0, y, zz); S3.add(va); });
        [-AX - 0.5, AX + 0.5].forEach(function (xx) { var va = M(new T.BoxGeometry(0.08, 0.1, AZ * 2 + 1), '#e8d8b8', { g: .03 }); va.position.set(xx, y, 0); S3.add(va); });
      });
      /* el toril, a la izquierda, con su techo */
      var toril = M(new T.BoxGeometry(2.4, 2.6, 7), '#8a5a3a', { recibe: true, g: .02 }); toril.position.set(-AX - 3.4, 1.3, 0); S3.add(toril);
      var techo = M(new T.BoxGeometry(3.2, 0.25, 8), '#c4563a', { g: .03 }); techo.position.set(-AX - 3.4, 2.75, 0); S3.add(techo);
      /* la tribuna del fondo con su gente en instancias, y los banderines */
      var NC = 260, zt = -AZ - 3.2, gradas = [];
      for (j = 0; j < 4; j++) { var gr = M(new T.BoxGeometry(260, 1, 1.6), '#b8ae9c', { recibe: true, g: .02 }); gr.position.set(0, (0.6 + j * 1.1) / 2, zt - j * 1.6); gr.scale.y = 0.6 + j * 1.1; S3.add(gr); gradas.push(gr); }
      var cB = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.6, 0.38), tn('#fff'), NC), cH = new T.InstancedMesh(new T.SphereGeometry(0.21, 6, 5), tn('#fff'), NC), cS = new T.InstancedMesh(new T.CylinderGeometry(0.42, 0.42, 0.06, 8), tn('#fff'), NC);
      var colr = new T.Color(), gx = [], gy = [], gz = [];
      for (j = 0; j < NC; j++) {
        var fila = j % 4, col4 = Math.floor(j / 4);
        gx.push(-60 + (col4 / 65) * 120 + ((j * 7) % 5) * 0.12); gy.push(0.6 + fila * 1.1 + 0.45); gz.push(zt - fila * 1.6 + ((j * 3) % 4) * 0.1);
        cB.setColorAt(j, colr.set(['#ff5c8a', '#3fa9ff', '#ffd23f', '#5cff7a', '#fffdf2', '#ff8a3f'][j % 6]));
        cH.setColorAt(j, colr.set(['#e8b48a', '#c98a5a', '#b07a58'][j % 3]));
        cS.setColorAt(j, colr.set(j % 3 === 0 ? '#d9b878' : '#8a6a4a'));
      }
      S3.add(cB, cH, cS);
      var banderas = [];
      for (j = 0; j < 18; j++) {
        var fr = new T.Mesh(new T.PlaneGeometry(1.1, 0.75), new T.MeshBasicMaterial({ color: ['#ffd23f', '#2f5fd0', '#e8453c'][j % 3], side: T.DoubleSide }));
        fr.position.set(-AX + 1 + j * ((AX * 2 - 2) / 17), 3.1, -AZ - 1.2); S3.add(fr); banderas.push(fr);
      }
      var cuerda = M(new T.BoxGeometry(AX * 2, 0.04, 0.04), '#14101c', { borde: false }); cuerda.position.set(0, 3.5, -AZ - 1.2); S3.add(cuerda);
      /* cerros, moriches, garzas y el sol */
      for (j = 0; j < 12; j++) { var ce = new T.Mesh(new T.ConeGeometry(14 + (j % 3) * 4, 9 + (j % 2) * 4, 5), tn(V3.oscurecer(pal.pasto, 0.78 - (j % 2) * 0.08))); ce.position.set(-150 + j * 28, 3, -95 - (j % 3) * 8); ce.rotation.y = j; S3.add(ce); }
      var hojas = [];
      function moriche(x, z, h) {
        var tr = M(new T.CylinderGeometry(0.25, 0.32, h, 6), '#8a6a4a', { g: .03 }); tr.position.set(x, h / 2, z); S3.add(tr);
        for (var q2 = 0; q2 < 8; q2++) { var ho = M(new T.ConeGeometry(0.4, 3.2, 4), q2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); ho.geometry.translate(0, 1.6, 0); ho.position.set(x, h, z); ho.rotation.set(0, q2 / 8 * 6.28, 0); ho.rotateZ(1.5); S3.add(ho); hojas.push(ho); }
      }
      for (j = 0; j < 22; j++) moriche(-90 + j * 8.6, zt - 14 - (j % 3) * 6, 7 + (j % 3));
      for (j = 0; j < 10; j++) { moriche(-AX - 14 - (j % 3) * 5, -AZ + 4 + j * 4.5 - (j % 2) * 20, 7 + (j % 3)); moriche(AX + 14 + (j % 3) * 5, -AZ + 4 + j * 4.5 - (j % 2) * 20, 7 + (j % 3)); }
      for (j = 0; j < 16; j++) moriche(-70 + j * 9.5, AZ + 16 + (j % 3) * 5, 7 + (j % 3));
      moriche(-AX - 9, AZ + 6, 8); moriche(AX + 8, AZ + 5, 7);
      var garzas = [];
      for (j = 0; j < 3; j++) { var gz2 = new T.Group(); S3.add(gz2); var cg = M(new T.SphereGeometry(0.25, 6, 4), '#fffdf2', { borde: false }); cg.scale.set(1.6, 0.7, 0.7); gz2.add(cg);
        [-1, 1].forEach(function (s) { var al = new T.Mesh(new T.PlaneGeometry(0.9, 0.3), new T.MeshBasicMaterial({ color: 0xfffdf2, side: T.DoubleSide })); al.position.z = s * 0.45; al.rotation.x = Math.PI / 2; gz2.add(al); });
        garzas.push(gz2); }
      var astro = new T.Mesh(new T.SphereGeometry(5, 16, 12), new T.MeshBasicMaterial({ color: lv === 3 ? 0xf4f0d0 : lv === 2 ? 0xffb050 : 0xfff3a0, fog: false })); astro.position.set(60, lv === 2 ? 12 : 34, -120); S3.add(astro);
      if (pl.noche) {
        [-AX * 0.5, AX * 0.5].forEach(function (x) {
          var to = M(new T.BoxGeometry(0.4, 10, 0.4), '#2a2a34'); to.position.set(x, 5, -AZ - 1.5); S3.add(to);
          var fo = new T.Mesh(new T.BoxGeometry(2.4, 0.6, 0.6), tn('#fff6c0', { em: '#ffe9a0', emI: 1.8 })); fo.position.set(x, 10.2, -AZ - 1.5); S3.add(fo);
          var luz = new T.PointLight(0xfff0c0, 1.6, 44, 1.6); luz.position.set(x, 9, -AZ + 1); S3.add(luz);
        });
      }
      /* el toro, la señal de embestida, el aturdimiento y el aro de la cola */
      var toro = toro3D(1.12); S3.add(toro.g);
      var senal = new T.Mesh(new T.PlaneGeometry(1, 2.4), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })); senal.rotation.x = -Math.PI / 2; S3.add(senal);
      var estrellas = [];
      for (j = 0; j < 4; j++) { var es = new T.Mesh(new T.OctahedronGeometry(0.2), new T.MeshBasicMaterial({ color: 0xffe14a })); es.visible = false; S3.add(es); estrellas.push(es); }
      var aroCola = new T.Mesh(new T.RingGeometry(0.45, 0.75, 20), new T.MeshBasicMaterial({ color: 0x5cff7a, transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide })); aroCola.rotation.x = -Math.PI / 2; S3.add(aroCola);
      /* polvaredas (nubes de esferas), el caporal y el becerro, la lluvia */
      var polvs = [];
      POLV.forEach(function (e) {
        var gp = new T.Group(); gp.visible = false; S3.add(gp);
        for (var q2 = 0; q2 < 7; q2++) { var sp = new T.Mesh(new T.SphereGeometry(1, 7, 5), new T.MeshBasicMaterial({ color: 0xd9bf8f, transparent: true, opacity: .5, depthWrite: false })); sp.position.set(Math.cos(q2 * 2.4) * e.r * 0.5, 0.9 + (q2 % 3) * 0.6, Math.sin(q2 * 2.4) * e.r * 0.5); sp.scale.setScalar(e.r * (0.35 + (q2 % 3) * 0.08)); gp.add(sp); }
        polvs.push(gp);
      });
      var cap = caballo('#2f5fd0', '#5a3a22'); S3.add(cap.g); cap.g.visible = false; var capPj = V3.PJ.crear('cobrador', { prop: false, escala: 0.95 }); var capL = new T.Group(); cap.cu.add(capL); capL.add(capPj.g); capPj.g.position.set(0, 1.62, 0); capPj.g.rotation.y = Math.PI / 2; capPj.anim('sentado').cara('feliz');
      var capAv = M(new T.ConeGeometry(0.7, 1.4, 4), '#ff3b4e', { g: .08 }); capAv.rotation.x = Math.PI; capAv.visible = false; S3.add(capAv);
      var bec = toro3D(0.55); bec.g.visible = false; S3.add(bec.g);
      var NR = 160, lluvia = new T.InstancedMesh(new T.BoxGeometry(0.04, 0.9, 0.04), new T.MeshBasicMaterial({ color: 0xbfd6ee, transparent: true, opacity: .6 }), NR); lluvia.visible = false; lluvia.frustumCulled = false; S3.add(lluvia);
      /* jinetes: caballo, jinete (con grupo de inclinación), aro de equipo, soga */
      var M3 = [];
      for (j = 0; j < n; j++) {
        var s2 = asiento(j), colM = s2.color && s2.color !== '#fff' ? s2.color : TEAM[j % 4];
        var cab = caballo(colM), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 0.95 }), lean = new T.Group();
        S3.add(cab.g); cab.cu.add(lean); lean.add(pj.g); pj.g.position.set(0, 1.62, 0); pj.g.rotation.y = Math.PI / 2;
        var aro = new T.Mesh(new T.RingGeometry(1.0, 1.25, 20), new T.MeshBasicMaterial({ color: colM, transparent: true, opacity: .85 })); aro.rotation.x = -Math.PI / 2; aro.position.y = .05; S3.add(aro);
        var soga = M(new T.BoxGeometry(1, 0.07, 0.07), '#e8d8b8', { borde: false }); soga.visible = false; S3.add(soga);
        M3.push({ cab: cab, pj: pj, lean: lean, aro: aro, soga: soga, x: P[j].x, z: P[j].z, px: P[j].x, pz: P[j].z, vx: 0, vz: 0, fa: 0, fase: 0, st: 0, k: 0, d: 0, sc: 0, polvo: 0, tcae: -9, tceleb: -9, tdash: -9, pop: 0, popT: -9, stT: 0 });
      }
      var flecha = M(new T.ConeGeometry(0.4, 0.8, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var part = V3.particulas(esc, 700);
      esc.encuadrar(AX * 2 + 6, AZ * 2 + 4, new T.Vector3(0, 0, 1.5), .98);
      return V3.ultimo = { esc: esc, M3: M3, toro: toro, senal: senal, estrellas: estrellas, aroCola: aroCola, flecha: flecha, part: part, banderas: banderas, hojas: hojas, garzas: garzas, polvs: polvs, cap: cap, capPj: capPj, capAv: capAv, bec: bec,
        lluvia: lluvia, charcos: charcos, pastoM: pastoM, pisoM: pisoM, cB: cB, cH: cH, cS: cS, gx: gx, gy: gy, gz: gz, NC: NC, NR: NR, dm: dm, cam: { x: 0, z: 1.5 }, confT: 0, rodar: -9, bs: -1, tk: 0, aviso: '', juego: g, lluviaOn: false, nodes: { luces: [] } };
    }
    function galope(pt, fase, a) { var j; for (j = 0; j < 4; j++) pt[j].rotation.z = Math.sin(fase + (j < 2 ? 0 : 1.6) + (j % 2) * 0.5) * 0.75 * a; }
    function dirY(g3, dx, dz) { g3.rotation.y = -Math.atan2(dz, dx); }
    function actualizar3D(dt, gt) {
      var V = v3, p, j, t = absT, T = THREE, dm = V.dm, hp = { x: 0, z: 0 }, emocion = 0, ev, mio;
      bullAt(gt, B); V.part.update(dt);
      var ll = llueve(gt) && gt >= 0, kll = ll ? cl((gt - RT) / 1.5, 0, 1) : 0;
      /* mundo vivo: banderines, hojas, garzas, gente */
      for (j = 0; j < V.banderas.length; j++) V.banderas[j].rotation.y = Math.sin(t * 3 + j * 0.7) * 0.4;
      for (j = 0; j < V.hojas.length; j++) V.hojas[j].rotation.x = Math.sin(t * 1.2 + j) * 0.05;
      for (j = 0; j < V.garzas.length; j++) { var ag = t * 0.25 + j * 2.1; V.garzas[j].position.set(Math.cos(ag) * (26 + j * 6), 13 + j * 2 + Math.sin(t + j) * 0.6, -34 + Math.sin(ag) * 10); V.garzas[j].rotation.y = -ag;
        V.garzas[j].children[1].rotation.y = Math.sin(t * 6 + j) * 0.5; V.garzas[j].children[2].rotation.y = -Math.sin(t * 6 + j) * 0.5; }
      /* lluvia: luz más baja, piso oscuro, charcos que crecen, gotas */
      V.esc.luces.hemi.intensity = PAL3[lv].hemi[2] * (1 - 0.3 * kll); V.esc.luces.sol.intensity = PAL3[lv].sol[1] * (1 - 0.4 * kll);
      V.pisoM.color.setRGB(1 - 0.35 * kll, 1 - 0.32 * kll, 1 - 0.28 * kll); V.pastoM.color.set(pal.pasto).multiplyScalar(1 - 0.2 * kll);
      for (j = 0; j < V.charcos.length; j++) { var cs2 = kll * (1.6 + (j % 3) * 0.7); V.charcos[j].scale.set(Math.max(0.01, cs2 * 1.4), Math.max(0.01, cs2), 1); }
      if (ll !== V.lluviaOn) { V.lluviaOn = ll; V.lluvia.visible = !!ll; if (ll) V3.sfx('trueno'); }
      if (ll) for (j = 0; j < V.NR; j++) { dm.position.set(-AX - 6 + ((j * 0.618) % 1) * (AX * 2 + 12), 14 - ((t * 20 + j * 3.1) % 14), -AZ - 4 + ((j * 0.381) % 1) * (AZ * 2 + 10)); dm.rotation.set(0, 0, 0.1); dm.scale.set(1, 1, 1); dm.updateMatrix(); V.lluvia.setMatrixAt(j, dm.matrix); }
      if (ll) V.lluvia.instanceMatrix.needsUpdate = true;
      /* el toro */
      var tr = V.toro, bs = B.s, fase = t * (6 + 1.1 * B.sp);
      if (bs !== V.bs) {
        if (bs === 1) { V3.sfx('latido'); }
        if (bs === 2) { V3.sfx('whoosh'); V.esc.sacudir(.3); }
        if (bs === 3) { V3.sfx('golpe'); V.esc.sacudir(.9); V.part.soltar(B.x + B.cx * 1.4, 1.2, B.z + B.sz * 1.4, 26, { k: 'chispa', cols: ['#fffdf2', '#ffd23f'], vel: 4, arriba: 3, vida: .6 }); V.part.soltar(B.x, 0.4, B.z, 24, { k: 'gota', cols: ['#c9a36a', '#e3c79a'], vel: 4, arriba: 3, vida: .9, esc: 1.4 }); }
        V.bs = bs;
      }
      tr.g.position.set(B.x, 0, B.z); dirY(tr.g, B.cx, B.sz);
      var rodando = t - V.rodar < 0.8 ? (t - V.rodar) / 0.8 : -1;
      tr.cu.rotation.set(0, 0, 0); tr.cu.position.y = 0;
      galope(tr.patas, fase, bs === 0 || bs === 2 ? cl(B.sp / 8, 0.05, 1.1) : 0.05);
      tr.cab.rotation.z = bs === 1 ? -0.55 + Math.sin(t * 18) * 0.12 : bs === 2 ? -0.5 : bs === 3 ? Math.sin(t * 6) * 0.35 : Math.sin(fase) * 0.08;
      if (bs === 1) { tr.patas[0].rotation.z = -Math.abs(Math.sin(t * 14)) * 1.2; if (Math.sin(t * 14) > 0.95) V.part.soltar(B.x + B.cx * 1.2, 0.2, B.z + B.sz * 1.2, 2, { k: 'gota', cols: ['#c9a36a', '#e3c79a'], vel: 2, arriba: 2, vida: .6 }); }
      if (bs === 3) { tr.cu.rotation.z = Math.sin(t * 5) * 0.12; tr.cu.rotation.x = Math.sin(t * 4) * 0.1; }
      if (rodando >= 0) { tr.cu.rotation.x = Math.sin(rodando * Math.PI) * 0.5 + rodando * TAUR * 0.0; tr.cu.rotation.z = rodando * TAUR * (rodando < 1 ? 1 : 0); tr.cu.position.y = Math.sin(rodando * Math.PI) * 0.8; }
      var halado = false;
      for (p = 0; p < n; p++) if (P[p].st === 1) halado = true;
      tr.cola.rotation.z = halado ? 1.35 + Math.sin(t * 16) * 0.1 : 0.9 + Math.sin(fase * 0.7) * 0.25 + (bs === 2 ? 0.4 : 0);
      if (B.sp > 5 && (V.tk -= dt) < 0) { V.tk = 0.06; V.part.soltar(B.x - B.cx * 1.0, 0.2, B.z - B.sz * 1.0, 2, { k: 'gota', cols: ['#c9a36a', '#e3c79a'], vel: 1.4, arriba: 1.2, vida: .7, esc: 1.2 }); }
      V.senal.material.opacity = bs === 1 ? 0.25 + 0.25 * Math.abs(Math.sin(t * 12)) : 0;
      V.senal.scale.set(2.4, 16, 1); V.senal.position.set(B.x + B.cx * 8, 0.05, B.z + B.sz * 8); V.senal.rotation.set(-Math.PI / 2, 0, -Math.atan2(B.sz, B.cx) + Math.PI / 2, 'YXZ');
      for (j = 0; j < V.estrellas.length; j++) { var es = V.estrellas[j]; es.visible = bs === 3; if (bs === 3) { es.position.set(B.x + B.cx * 1.3 + Math.cos(t * 5 + j * 1.6) * 0.8, 2.9 + Math.sin(t * 7 + j) * 0.2, B.z + B.sz * 1.3 + Math.sin(t * 5 + j * 1.6) * 0.8); es.rotation.y = t * 4; } }
      /* aro de la cola: verde si la puedo agarrar, naranja si está caliente */
      mio = c.yo >= 0 ? c.yo : -1;
      var libre = mio >= 0 ? puedeAgarrar(mio, gt) : false, caliente = gt < tailOff, ocupada = halado;
      V.aroCola.position.set(B.tx, 0.08, B.tz);
      V.aroCola.material.color.set(ocupada ? 0xff3b4e : caliente ? 0xff8a3f : libre ? 0x5cff7a : 0xfffdf2);
      V.aroCola.material.opacity = ocupada ? 0.25 : libre ? 0.95 : 0.55;
      V.aroCola.scale.setScalar(1 + (libre ? 0.15 * Math.sin(t * 14) : 0.06 * Math.sin(t * 5)));
      /* jinetes */
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.M3[p], cab = s3.cab, lean = s3.lean, pj = s3.pj, mo = p === c.yo;
        if (q.st === 1) posDe(p, hp); else { hp.x = q.x; hp.z = q.z; }
        var k = Math.min(1, dt * (q.st === 1 ? 30 : mo ? 22 : 14)), ox = s3.x, oz = s3.z;
        s3.x += (hp.x - s3.x) * k; s3.z += (hp.z - s3.z) * k;
        var vx = (s3.x - ox) / Math.max(dt, 1e-3), vz = (s3.z - oz) / Math.max(dt, 1e-3); s3.vx += (vx - s3.vx) * Math.min(1, dt * 8); s3.vz += (vz - s3.vz) * Math.min(1, dt * 8);
        var vel = Math.sqrt(s3.vx * s3.vx + s3.vz * s3.vz), nvel = cl(vel / 11, 0, 1.4);
        if (q.st === 1) s3.fa = B.h - (q.q * 0.25); else if (vel > 0.9) s3.fa += wrap(Math.atan2(s3.vz, s3.vx) - s3.fa) * Math.min(1, dt * 10);
        /* cambios de estado (iguales para locales y remotos) */
        if (q.st !== s3.st) {
          var de = s3.st;
          if (q.st === 1) { pj.uno('lanzar'); V.part.soltar(B.tx, 0.8, B.tz, 14, { k: 'chispa', cols: ['#fffdf2', '#5cff7a'], vel: 3, arriba: 3, vida: .5 }); if (mo) { V3.sfx('tambor'); V.esc.sacudir(.35); } emocion = 1; }
          if (q.st === 2) { var imp = impulso3D(p, gt); pj.volar(imp.x, imp.z, 1.5); s3.tcae = t; V.part.soltar(s3.x, 0.4, s3.z, 18, { k: 'gota', cols: ['#c9a36a', '#b48c58', '#e3c79a'], vel: 4, arriba: 3, vida: .8, esc: 1.3 }); if (mo) { V3.sfx('caida'); V3.sfx('choque'); V.esc.sacudir(.9); } else V3.sfx('golpe'); }
          if (q.st === 0 && de === 1 && q.k !== s3.k) {
            s3.tceleb = t; V.rodar = t; pj.uno('festejo'); V.part.soltar(B.x, 1.8, B.z, 36, { k: 'confeti', cols: ['#ffd23f', '#2f5fd0', '#e8453c'], vel: 4, arriba: 6, g: 6, vida: 1.5 });
            V3.sfx('golpe'); V3.sfx('aplauso'); V.esc.sacudir(1); emocion = 2; s3.pop = q.sc - s3.sc; s3.popT = t;
          } else if (q.st === 0 && de === 1) { pj.uno('susto').cara('susto'); }
          s3.st = q.st; s3.stT = t;
        }
        if (q.k !== s3.k) s3.k = q.k;
        s3.sc = q.sc;
        if (q.d !== s3.d) { s3.d = q.d; if (q.d) { s3.tdash = t; V.part.soltar(s3.x, 0.5, s3.z, 10, { k: 'chispa', cols: ['#fffdf2', '#c9a36a'], vel: 3, arriba: 1, vida: .4 }); if (mo) V3.sfx('whoosh'); } }
        for (j = 0; j < q.fx.length; j++) {            // golpes que solo ve el dueño (cornada, empujón, choque)
          if (q.fx[j].n <= (s3.fxN || 0)) continue;
          s3.fxN = q.fx[j].n; ev = q.fx[j].e;
          if (ev === 'empujon' || ev === 'choque') { V.part.soltar(s3.x, 1.2, s3.z, 14, { k: 'chispa', cols: ['#fffdf2', '#ffd23f'], vel: 4, arriba: 3, vida: .5 }); V3.sfx('choque'); V.esc.sacudir(.5); var imf = impulso3D(p, gt); pj.impacto(imf.x, imf.z, ev === 'choque' ? 1.8 : 1.4); }
          if (ev === 'espuela' && mo) V3.sfx('whoosh');
          if (ev === 'jalon') { pj.uno('lanzar'); V3.sfx('whoosh'); }
        }
        /* caballo */
        s3.fase += dt * (5 + 11 * nvel);
        var ccae = q.st === 2 ? cl((t - s3.tcae) / 0.25, 0, 1) : 0, tr2 = q.st === 2 ? 1 : 0;
        cab.g.position.set(s3.x, Math.abs(Math.sin(s3.fase)) * 0.18 * nvel, s3.z); dirY(cab.g, Math.cos(s3.fa), Math.sin(s3.fa));
        cab.cu.rotation.set(0, 0, tr2 ? 0.55 * (1 - Math.max(0, (t - s3.tcae - 0.5) / 0.5)) : (q.d ? -0.12 : 0)); cab.cu.rotation.z = Math.max(0, cab.cu.rotation.z);
        cab.cu.scale.x = q.d ? 1.12 : 1;
        galope(cab.patas, s3.fase, q.st === 2 ? 0.3 : nvel + 0.12);
        cab.cola.rotation.z = -0.6 - Math.sin(s3.fase * 0.5) * 0.25 * nvel;
        cab.cab.rotation.z = -0.35 + Math.sin(s3.fase) * 0.08 * nvel + (q.st === 2 ? 0.4 : 0);
        /* jinete: inclinación, anticipación, reacción */
        var lz2 = 0, lx2 = 0;
        if (q.st === 1) {
          lz2 = 0.3; lx2 = q.q * 0.5; pj.anim('empujar', { vel: 1 }).cara(Math.abs(q.q) > 0.6 ? 'susto' : 'concentrado'); pj.mirar && pj.mirar(1, 0);
          lean.position.set(0, 0, 0);
        } else if (q.st === 2) {
          lean.position.set(0, 0, 0); lz2 = 0; lx2 = 0; pj.anim('mareado').cara('mareado');     // la caída la lleva volar: el jinete ya no se inclina a mano
        } else {
          lean.position.set(0, 0, 0);
          if (t - s3.tceleb < 1.3) { pj.anim(p % 2 ? 'aplaudir' : 'celebrar').cara('feliz'); lz2 = -0.1; }
          else if (q.d) { pj.anim('agacharse').cara('enojado'); lz2 = -0.4; }
          else { lz2 = -0.1 * nvel + Math.sin(t * 2.2 + p) * 0.03; pj.anim('sentado').cara(nvel > 0.6 ? 'concentrado' : 'normal'); if (B.s === 1 && dist(q.x, q.z, B.x, B.z) < 9) pj.cara('susto'); }
          if (pj.mirar) pj.mirar(cl(B.x - s3.x, -6, 6) * 0.1, 0);
        }
        lean.rotation.z += (lz2 - lean.rotation.z) * Math.min(1, dt * 12); lean.rotation.x += (lx2 - lean.rotation.x) * Math.min(1, dt * 12);
        pj.update(dt);
        if (nvel > 0.35 && q.st !== 1) { s3.polvo -= dt; if (s3.polvo < 0) { s3.polvo = 0.09; V.part.soltar(s3.x - Math.cos(s3.fa) * 0.9, 0.2, s3.z - Math.sin(s3.fa) * 0.9, q.d ? 4 : 2, { k: 'gota', cols: ['#c9a36a', '#e3c79a'], vel: 1.2, arriba: 1.2, vida: .6, esc: 1.1 }); } }
        if (q.st === 1 && (s3.polvo -= dt) < 0) { s3.polvo = 0.07; V.part.soltar(s3.x, 0.2, s3.z, 3, { k: 'gota', cols: ['#c9a36a', '#e3c79a'], vel: 1.5, arriba: 1.2, vida: .6, esc: 1.2 }); }
        s3.aro.position.set(s3.x, .05, s3.z); s3.aro.visible = q.st !== 2;
        /* la soga entre la cola y el jinete colgado */
        s3.soga.visible = q.st === 1;
        if (q.st === 1) { var sx2 = B.tx - s3.x, sz2 = B.tz - s3.z, sl = Math.sqrt(sx2 * sx2 + sz2 * sz2) || 1; s3.soga.position.set((B.tx + s3.x) / 2, 1.6, (B.tz + s3.z) / 2); s3.soga.scale.x = sl; s3.soga.rotation.y = -Math.atan2(sz2, sx2); }
      }
      /* caporal */
      var capHoy = -1;
      for (j = 0; j < CAPO.length; j++) if (capOn(CAPO[j], gt)) capHoy = j;
      V.cap.g.visible = capHoy >= 0;
      if (capHoy >= 0) {
        var ce = CAPO[capHoy], cx3 = capX(ce, gt); V.cap.g.position.set(cx3, Math.abs(Math.sin(t * 16)) * 0.2, ce.z); dirY(V.cap.g, ce.dir, 0); galope(V.cap.patas, t * 16, 1);
        V.capPj.update(dt); if (Math.abs(cx3) < AX && ((t * 9) % 1) < dt * 9) V.part.soltar(cx3 - ce.dir, 0.2, ce.z, 3, { k: 'gota', cols: ['#c9a36a', '#e3c79a'], vel: 1.5, arriba: 1.2, vida: .6, esc: 1.2 });
      }
      var avisoCap = -1;
      for (j = 0; j < CAPO.length; j++) if (gt >= CAPO[j].t0 - 1.4 && gt < CAPO[j].t0) avisoCap = j;
      V.capAv.visible = avisoCap >= 0;
      if (avisoCap >= 0) { V.capAv.position.set(CAPO[avisoCap].dir > 0 ? -AX + 1.5 : AX - 1.5, 3 + Math.abs(Math.sin(t * 8)) * 0.6, CAPO[avisoCap].z); }
      /* becerro */
      V.bec.g.visible = becOn(gt);
      if (becOn(gt)) { becPos(gt, BEC_O); var bpx = V.bec.g.position.x, bpz = V.bec.g.position.z; V.bec.g.position.set(BEC_O.x, 0, BEC_O.z); dirY(V.bec.g, BEC_O.x - bpx, BEC_O.z - bpz); galope(V.bec.patas, t * 18, 1); V.bec.cu.position.y = Math.abs(Math.sin(t * 9)) * 0.25; }
      /* polvaredas */
      for (j = 0; j < POLV.length; j++) {
        var on = polvOn(POLV[j], gt), kk = on ? cl(Math.min((gt - POLV[j].t0) / 0.7, (POLV[j].t0 + POLV[j].len - gt) / 0.9), 0, 1) : 0;
        V.polvs[j].visible = kk > 0.01;
        if (on) { polvPos(POLV[j], gt, POL_O); V.polvs[j].position.set(POL_O.x, 0, POL_O.z); V.polvs[j].rotation.y = t * 0.6; V.polvs[j].scale.setScalar(kk); if (gt - POLV[j].t0 < dt * 2) V3.sfx('viento'); }
      }
      /* la gente: brinca con las coleadas y los eventos */
      if (emocion) V.confT = Math.max(V.confT, emocion);
      V.confT = Math.max(0, V.confT - dt);
      for (j = 0; j < V.NC; j++) {
        var by = V.gy[j] + (V.confT > 0 ? Math.abs(Math.sin(t * 9 + j)) * 0.4 : Math.sin(t * 2 + j) * 0.03);
        dm.rotation.set(0, 0, 0); dm.scale.set(1, 1, 1);
        dm.position.set(V.gx[j], by, V.gz[j]); dm.updateMatrix(); V.cB.setMatrixAt(j, dm.matrix);
        dm.position.set(V.gx[j], by + 0.45, V.gz[j]); dm.updateMatrix(); V.cH.setMatrixAt(j, dm.matrix);
        dm.position.set(V.gx[j], by + 0.62, V.gz[j]); dm.updateMatrix(); V.cS.setMatrixAt(j, dm.matrix);
      }
      V.cB.instanceMatrix.needsUpdate = true; V.cH.instanceMatrix.needsUpdate = true; V.cS.instanceMatrix.needsUpdate = true;
      /* cámara: encuadre fijo del corral con un respiro hacia donde pasa lo importante */
      var ret = typeof window.innerWidth === "number" && window.innerWidth < window.innerHeight, ww = ret ? 24 : 36, yy0 = c.yo >= 0 ? V.M3[c.yo].cab.g.position : null;
      var fx0 = yy0 ? (B.x + yy0.x * 2) / 3 : B.x, fz0 = yy0 ? (B.z + yy0.z * 2) / 3 : B.z;
      fx0 = cl(fx0, -(AX - ww / 2 + (ret ? 9 : 4)), AX - ww / 2 + (ret ? 9 : 4)); fz0 = cl(fz0, -4, 4) + 1.5;
      V.cam.x += (fx0 - V.cam.x) * Math.min(1, dt * 3); V.cam.z += (fz0 - V.cam.z) * Math.min(1, dt * 3);
      V.esc.encuadrar(ww, ww * 0.55, new T.Vector3(V.cam.x, 0, V.cam.z), .98);
      var yo = c.yo >= 0 ? V.M3[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.cab.g.position.x, 4.6 + Math.abs(Math.sin(t * 4)) * 0.3, yo.cab.g.position.z);
      /* sonido de los avisos (una vez) */
      var av = aviso(gt), avs = av ? av[0] : '';
      if (avs !== V.aviso) { V.aviso = avs; if (avs) V3.sfx(avs.indexOf('CAPORAL') >= 0 ? 'bocina' : avs.indexOf('ÚLTIMA') >= 0 ? 'ding' : 'silbido'); }
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), gt = c.ahora(), p; v3T = absT;
      if (dt > 0) actualizar3D(dt, gt);
      if (gt >= 0 && gt < dur) V3.musica('toro');
      v3.esc.render(dt);
      for (p = 0; p < n; p++) {
        var s3 = v3.M3[p], pt = v3.esc.proyectar(s3.cab.g.position.x, 0, s3.cab.g.position.z + 1.9), yo = p === c.yo;
        txt((yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7)) + ' · ' + Math.round(P[p].sc), pt.x, pt.y, 12, yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (c.ahora() - s3.popT < 1.3 && s3.pop > 0) { var pb = v3.esc.proyectar(s3.cab.g.position.x, 3.4 + (c.ahora() - s3.popT) * 1.4, s3.cab.g.position.z); txt('+' + Math.round(s3.pop), pb.x, pb.y, 18, '#ffd23f', 0, true); }
        if (!yo && P[p].st === 1) { var pc = v3.esc.proyectar(s3.cab.g.position.x, 3.6, s3.cab.g.position.z), tpp = cl(P[p].tp, 0, 1); rr(pc.x - 24, pc.y, 48, 7, 3, 'rgba(20,16,28,.6)', 1.5); rr(pc.x - 24, pc.y, 48 * tpp, 7, 3, '#ffd23f', 0); }
      }
      hud(f);
      if (typeof drawP === 'function') drawP();
    }

    var g = {
      update: function (dt) {
        var gt = c.ahora(), p;
        absT += dt;
        if (gt >= 0) bullAt(gt, B);
        for (p = 0; p < n; p++) updJugador(p, gt, dt);
        if (!v3) for (p = 0; p < n; p++) { var q = P[p]; if (p !== c.yo) continue;
          var e0 = q.fx[q.fx.length - 1], e = e0 && e0.n !== q.ult2D ? e0.e : null; if (e) { q.ult2D = e0.n; if (e === 'agarra') SND(220, 0.1, 'square', 0.05); if (e === 'tumba') SND(330, 0.3, 'triangle', 0.06); if (e === 'cae') SND(120, 0.2, 'sawtooth', 0.05); } }
      },
      ai: function (p, dt, api) { ai(p, dt, api, c.ahora()); },
      cuerpo: function (p) {
        var q = P[p];
        return { x: Math.round(q.x * 10), z: Math.round(q.z * 10), st: q.st, sc: Math.round(q.sc), q: Math.round(q.q * 100), h: q.st === 1 ? q.h : 0, d: q.d ? 1 : 0, k: q.k };
      },
      alRemoto: function (p, o) {
        var q = P[p];
        if (!o) return;
        if (num(o.x)) q.x = o.x / 10; if (num(o.z)) q.z = o.z / 10; if (num(o.q)) q.q = o.q / 100;
        if (num(o.st)) q.st = o.st; if (num(o.h)) q.h = o.h; if (num(o.d)) q.d = o.d;
        if (num(o.k) && o.k !== q.k) { if (o.k > q.k) tailOff = Math.max(tailOff, c.ahora() + HOT); q.k = o.k; }
        if (num(o.sc)) q.sc = Math.max(0, o.sc);
      },
      alCpu: function (p) { P[p].own = false; },
      alHum: function (p, o) { P[p].own = false; if (o) g.alRemoto(p, o); },
      onEv: function () {},
      scores: function () { var out = [], p; for (p = 0; p < n; p++) out.push(Math.max(0, Math.min(700, Math.round(P[p].sc)))); return out; },
      done: function () { return false; },
      vivo: function () { return true; },
      hudChip: function (p) { return String(Math.round(P[p].sc)); },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0];
        if (!q) return '';
        if (q.nTum) return q.nTum + ' coleada' + (q.nTum > 1 ? 's' : '') + (q.best ? ' · mejor ' + q.best : '');
        return 'no tumbó ni un toro';
      },
      vista: function () {
        var gt = c.ahora(); if (gt >= 0) bullAt(gt, B);
        return { gt: gt, lv: lv, hash: hash, n: n, B: B, tailOff: tailOff, REACH: REACH[lv],
          x: P.map(function (q) { return q.x; }), z: P.map(function (q) { return q.z; }), st: P.map(function (q) { return q.st; }), q: P.map(function (q) { return q.q; }),
          tp: P.map(function (q) { return q.tp; }), sc: P.map(function (q) { return q.sc; }), k: P.map(function (q) { return q.k; }), d: P.map(function (q) { return q.d; }),
          dCd: P.map(function (q) { return q.dCd; }), jCd: P.map(function (q) { return q.jCd; }), nTum: P.map(function (q) { return q.nTum; }),
          puede: P.map(function (q, p) { return gt >= 0 && puedeAgarrar(p, gt); }), gain: gain(gt), mult: mult(gt),
          cap: CAPO.map(function (e) { return capOn(e, gt) ? capX(e, gt) : null; }), bec: becOn(gt), polv: POLV.length, lluvia: llueve(gt), RT: RT, UL: UL };
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(geom());
        dibujar2D();
      }
    };
    return g;
  }
});
})();
