'use strict';
/* LA FIESTA · EN VIVO · f_guaya · ¡LA GUAYA DEL TELEFÉRICO!  (1v3, modelo B: dueño + juez)   rehecho 27 oct (nota del dueño: «el del péndulo es aburrido»)
   El teleférico del Ávila, en loco. El TRÍO sube CORRIENDO por encima de las guayas (tres guayas paralelas, de la estación de abajo a la del Waraira Repano,
   3 / 4 / 5 tramos de 140 px). Suben solos; lo que hacen es ESQUIVAR: el stick ↑/↓ los cambia de guaya y A los hace SALTAR (0,6 s en el aire, enfriamiento).
   Por las guayas hay FRESAS CON CREMA (personales: cada quien agarra las suyas) que dan TURBO.
   El SOLO es el operario de ARRIBA: elige una guaya con ↑/↓ y con A SUELTA UNA CABINA que baja por esa guaya arrasando. Se avisa AVISO s antes (la guaya se pone
   roja y la cabina tiembla en la estación); quien esté en esa guaya cuando pase y no esté en el aire, ¡PUM!: queda colgando FALL_T s y baja KNOCK px.
   Además pasan cosas en el Ávila (agenda fija sacada de c.rng en mk(): igual en todas las pantallas), cada una avisada ~1 s antes con banner, sonido y efecto 3D:
     ZAMUROS  una bandada baja por TODAS las guayas: hay que saltarla (y ojo, el salto queda en enfriamiento: el operario aprovecha).
     RÁFAGA   el viento del Ávila sopla 1,6 s en dos guayas y los echa para atrás (saltando, el doble); una guaya queda AL ABRIGO (verde): todos corren a esa… y el operario lo sabe.
     NEBLINA  4 s de neblina: el trío solo ve las cabinas cuando ya están cerca, y el operario no ve al trío (su CPU lo estima).
   ESCALADA por c.ahora()/dur (sirve igual a dur 10): fase 1 tranquila; desde 35 % «¡SE PRENDIÓ LA GUAYA!» (cabinas más rápidas y seguidas, más eventos);
   desde 70 % «¡ÚLTIMOS SEGUNDOS!»: cabinas exprés, el trío corre más, fresas que dan más turbo, eventos cada poco, otra música, luz roja y cámara que tiembla.

   POR QUÉ B: no hay objeto compartido. La cabina es un aviso `xs {i, s, tl}` (índice, guaya, ms de gt en que SALE de arriba) que ven todas las pantallas; su
   velocidad sale de la fase de tl (determinista). Cada miembro del trío simula SU carrera y JUZGA su propio golpe (`ev cae`) y su llegada (`ev cruzo`).
   Aviso mínimo EFECTIVO: cada pantalla suelta la cabina en max(tl, momento en que la RECIBIÓ + AVISO): a 300 ms de red el trío sigue viendo >= 0,5 s de aviso.
   Puntaje (M4, umbral con U=10): c = cruzaron; solo = 10·(T−c) (T = miembros del trío, 3), cada miembro del trío = 10·H−5 = 15 con H = T−2+1 = 2. 1v3: el solo contra la
   MEDIA del trío => el solo gana con c <= 1, sin empates. El veredicto lo da SOLO compara(); este archivo no decide al ganador.
   Perilla única de balance: PERILLA.SUBE[nivel] = fracción de dur que tarda en subir alguien a quien no le pega nada. El resto (velocidades, modelo de la CPU) es fijo.
   Cuerpo en red (o): x (px de guaya; el solo: 0), l (guaya 0..2; el solo: su cursor), st (0 corriendo, 1 colgando, 2 llegó), j (inicio del salto en ms+1, 0 ninguno).
   Dibujo: 3D low poly (fiesta-3d.js) o, sin WebGL / ?plano=1, un 2D sencillo. Sin Math.random / Date.now: azar de c.rng / c.rngFor('cpu'+p); lo cosmético de c.fx(). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_guaya')) return;

/* ───── la perilla (única) y las constantes del juego ───── */
var PERILLA = { SUBE: [0.9, 0.9, 0.93] };                      // fracción de dur que tarda en subir sin golpes, por nivel
var AVISO = 0.7, AVISO_MIN = 0.5, AVE = 1.0;                  // s de aviso de la cabina (el código nunca baja de AVISO_MIN) y de los eventos
var TW = 140, NL = 3, FALL_T = 1.3, KNOCK = 50, INV = 0.7, JUMP_T = 0.6, JUMP_CD = 1.1, LANE_CD = 0.2;
var VC = 240, VZ = 300, HITR = 16, HITZ = 14, FRR = 13, TURBO_T = 1.0, NIEBLA_V = 150, MAXS = 160, NEED = 2, CELEBRA = 0.9, GRACIA_CPU = 1.3;
var F2 = 0.35, F3 = 0.7;                                      // fases de la escalada (fracción de dur)
var CDF = [1.25, 1.0, 0.75], VCF = [1, 1.15, 1.35], SPF = [1, 1.08, 1.25], TBF = [1.5, 1.6, 1.8];   // enfriamiento del operario, cabina, carrera, turbo por fase
var RAF_T = 1.6, RAF_V = -0.9, NIE_T = 4;
var PTS = 10, INK = '#14101c';
var PAL = {
  1: { cielo: '#7cd0ff', cielo2: '#d6f1ff', mon1: '#5f9f6a', mon2: '#3f7f56', cable: '#3a3a48', torre: '#a5642f', sol: '#ffe14d', agua: '#bfe7ff' },
  2: { cielo: '#ff8a5a', cielo2: '#ffd68c', mon1: '#8a5a7a', mon2: '#5a4468', cable: '#34303f', torre: '#8a4f35', sol: '#fff0b0', agua: '#ffc8a0' },
  3: { cielo: '#161a45', cielo2: '#2f3578', mon1: '#2a3a5a', mon2: '#1c2744', cable: '#8e8ca8', torre: '#4d4258', sol: '#f4f0d0', agua: '#2a3060' }
};
var GRITOS = ['¡AAAY!', '¡MI MADRE!', '¡PUM!', '¡ME TUMBARON!', '¡OPERARIO MALDITO!'];
var GAG = '¡Corre por la guaya, que el teleférico no espera a nadie!';
var EVN = { zam: '¡ZAMUROS! ¡SALTA!', raf: '¡RÁFAGA! ¡A LA GUAYA VERDE!', nie: '¡NEBLINA DEL ÁVILA!' };
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
function sube(lv) { var a = PERILLA.SUBE[lv - 1]; return num(a) && a > 0.1 ? a : 0.5; }

FIESTA.LIVE.add('f_guaya', {
  name: '¡LA GUAYA DEL TELEFÉRICO!', modos: ['1v3'], clase: 'binary', modelo: 'B', dur: 40,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 30, scoreRate: 10, minT: 6, finTemprano: 1 },
  cuerpo: ['x', 'l', 'st', 'j'], discretos: ['l', 'st', 'j'],
  perilla: PERILLA,
  carta: {
    obj: 'El trío sube corriendo por las guayas. El operario les suelta cabinas desde arriba.',
    gana: 'El trío gana si llegan 2 de 3 arriba. Si no, gana el operario.',
    como: { tactil: 'Joystick ↑↓ = cambiar de guaya · A = soltar cabina (solo) / saltar (trío)', teclado: 'W/S o flechas ↑↓ · ESPACIO' },
    roles: {
      solo: {
        obj: '¡TÚ CONTRA TODOS! Suelta cabinas por la guaya donde estén: que no lleguen arriba.',
        como: { tactil: 'Joystick ↑↓: elegir guaya · A: soltar cabina', teclado: 'W/S elegir guaya · ESPACIO soltar' },
        demos: [{ id: 'mover', txt: 'Elige la guaya donde van corriendo' }, { id: 'robar', txt: 'A: ¡suelta la cabina!' }]
      },
      trio: {
        obj: '¡Sube por la guaya! Esquiva las cabinas y salta los zamuros. Agarra fresas: turbo.',
        como: { tactil: 'Joystick ↑↓: cambiar de guaya · A: saltar', teclado: 'W/S o flechas ↑↓ cambiar · ESPACIO saltar' },
        demos: [{ id: 'mover', txt: 'Cámbiate de guaya cuando una se ponga ROJA' }, { id: 'saltar', txt: 'A: salta la cabina o los zamuros' }]
      }
    },
    demos: [
      { id: 'mover', txt: 'Cámbiate de guaya cuando se ponga roja' },
      { id: 'saltar', txt: 'A para saltar' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur > 0 ? c.dur : 40, pal = PAL[lv];
    var soloI = c.solo >= 0 && c.solo < n ? c.solo : 0, NS = lv + 2, L = NS * TW, AV = Math.max(AVISO_MIN, AVISO), SPD = L / (sube(lv) * dur);
    var trio = [], i;
    for (i = 0; i < n; i++) if (i !== soloI) trio.push(i);
    var T = Math.max(1, trio.length), HN = Math.min(NEED, T), HU = T - HN + 1;          // HN = cruces que hacen ganar al trío; HU = umbral del solo (v >= HU, v = T - c)
    var PTS_TRIO = PTS * HU - PTS / 2;
    var lead = Math.min(2, 0.08 * dur + 0.4);
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };
    var P = [], slot = [];
    for (i = 0; i < n; i++) {
      slot.push(i === soloI ? -1 : trio.indexOf(i));
      P.push({ x: 0, l: i === soloI ? 1 : trio.indexOf(i) % NL, lCd: -9, js: -9, st: 0, fallEnd: -9, inv: -9, falls: 0, nf: 0, crossAt: -1, turbo: -9, got: {}, hitK: {}, zamK: {},
        cur: 1, nextShake: lead, tap: -9, grace: -1, lastSeenX: 0, lastSeenL: 1, lastSeenT: 0, saltos: 0, fresas: 0, esq: 0 });
    }
    var shakes = [], fellK = {}, cr = {}, cAt = -1, absT = 0, flash = 0, shake = 0, voz = {}, camX = L / 2, banner = { t: '', col: '#fff', hasta: -9 }, faseVista = 0, evVisto = {};
    var cpuR = [], plan = [];
    for (i = 0; i < n; i++) { cpuR.push(c.rngFor('cpu' + i)); plan.push({ wl: -1, re: -9, ja: -1, dl: -1, tgt: -1 }); }
    var isSolo = function (p) { return p === soloI; };

    /* ───── la agenda del Ávila: eventos y fresas, sacados de c.rng (iguales en todas las pantallas) ───── */
    function fase(t) { return t < F2 * dur ? 0 : t < F3 * dur ? 1 : 2; }
    var EV = [], FR = [];
    (function () {
      var R = c.rng, t = Math.max(1.6, 0.1 * dur) + R.next() * 0.06 * dur, ult = '', k, x;
      while (t < dur - 1.2) {
        var r = R.next(), ki = r < 0.45 ? 'zam' : r < 0.8 ? 'raf' : 'nie';
        if (ki === ult && ki !== 'zam') ki = 'zam';
        var e = { k: ki, w: t, t: t + AVE, d: ki === 'zam' ? (L + 40) / VZ : ki === 'raf' ? RAF_T : NIE_T, safe: Math.floor(R.next() * NL) % NL };
        EV.push(e); ult = ki;
        var f = fase(t), gap = [0.2, 0.14, 0.085][f] * dur;
        t += Math.max(2.2, gap * (0.8 + 0.4 * R.next())) + (ki === 'nie' ? 1 : 0);
      }
      for (x = 60 + R.next() * 30, k = 0; x < L - 30 && k < 60; k++) { FR.push({ x: x, l: Math.floor(R.next() * NL) % NL }); x += 80 + R.next() * 70; }
    })();
    function evActivo(k, t) { for (var j = 0; j < EV.length; j++) { var e = EV[j]; if (e.k === k && t >= e.t && t < e.t + e.d) return e; } return null; }
    function evAviso(t) { for (var j = 0; j < EV.length; j++) { var e = EV[j]; if (t >= e.w && t < e.t) return e; } return null; }
    function zamX(e, t) { return L + 20 - VZ * (t - e.t); }                 // la bandada baja por todas las guayas
    function enNiebla(t) { return !!evActivo('nie', t); }

    var cp = function () {
      var f = c.campo();
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 };
      return f;
    };

    /* ───── cabinas ───── */
    function nextIdx() { var m = -1, j; for (j = 0; j < shakes.length; j++) if (shakes[j]) m = j; return m + 1; }
    function sincroniza() {
      var j, t = P[soloI].nextShake;
      for (j = 0; j < shakes.length; j++) if (shakes[j]) { var u = shakes[j].tl - AV + CDF[fase(shakes[j].tl - AV)]; if (u > t) t = u; }
      P[soloI].nextShake = t;
    }
    function addShake(d) {
      if (!d || typeof d !== 'object' || !num(d.i) || !num(d.s) || !num(d.tl)) return false;
      if (d.i % 1 !== 0 || d.i < 0 || d.i >= MAXS || d.s % 1 !== 0 || d.s < 0 || d.s >= NL) return false;
      var s = { i: d.i, s: d.s, tl: d.tl / 1000, tr: c.ahora() }, old = shakes[d.i];
      if (old && (old.tl < s.tl || (old.tl === s.tl && old.s <= s.s))) return false;
      if (old) s.tr = Math.min(old.tr, s.tr);
      s.vc = VC * VCF[fase(s.tl)];
      shakes[d.i] = s; sincroniza();
      if (!old && !v3) SND(150, 0.3, 'sawtooth', 0.05, 60);
      return true;
    }
    c.on('xs', function (d) { addShake(d); });
    function relTime(sh) { return Math.max(sh.tl, sh.tr + AV); }            // cuándo SALE la cabina PARA ESTA PANTALLA (siempre >= AV tras verla)
    function cabX(sh, t) { return L + 10 - sh.vc * (t - relTime(sh)); }     // dónde va (px de guaya); antes de salir está arriba
    function cabViva(sh, t) { return t >= relTime(sh) && cabX(sh, t) > -30; }
    function cabAviso(sh, t) { return t >= sh.tr - 0.01 && t < relTime(sh); }
    function guayaRoja(l, t) {                                             // 0 nada · 1 aviso · 2 cabina bajando
      var r = 0, j; for (j = 0; j < shakes.length; j++) { var sh = shakes[j]; if (!sh || sh.s !== l) continue; if (cabViva(sh, t)) return 2; if (cabAviso(sh, t)) r = 1; } return r;
    }
    function soltar(p, s, now) {
      var idx = nextIdx();
      if (idx >= MAXS || now < P[p].nextShake || now < 0 || s < 0 || s >= NL) return false;
      var d = { i: idx, s: s, tl: Math.round((now + AV) * 1000) };
      if (!addShake(d)) return false;
      shakes[idx].tr = now;                                                // el emisor ve su propia cabina desde que pulsa
      P[p].tap = now;
      c.send('xs', d, false);
      return true;
    }

    /* ───── el trío: carrera, saltos, golpes y llegada ───── */
    function enAire(p, t) { var q = P[p]; return q.js >= 0 && t >= q.js && t < q.js + JUMP_T; }
    function cruzaron() { var k = 0, j; for (j = 0; j < trio.length; j++) if (cr[trio[j]]) k++; return k; }
    function vel(p, t) {                                                    // px/s de subida ahora
      var q = P[p], f = fase(t), v = SPD * SPF[f] * (t < q.turbo ? TBF[f] : 1), e = evActivo('raf', t);
      if (e && q.l !== e.safe) v = SPD * RAF_V * (enAire(p, t) ? 2 : 1);
      return v;
    }
    function caer(p, now, k) {
      var q = P[p]; q.st = 1; q.fallEnd = now + FALL_T; q.x = Math.max(0, q.x - KNOCK); q.turbo = -9;
      c.ev('cae', { i: q.nf, k: k }, p); q.nf++;
    }
    function cruza(p, now) { var q = P[p]; q.st = 2; q.x = L; q.crossAt = now; c.ev('cruzo', {}, p); }
    function golpes(p, x0, now, dt) {                                       // ¿me pasó por encima una cabina o la bandada? (barrido entre cuadros)
      var q = P[p], j, aire = enAire(p, now);
      if (now < q.inv) return;
      for (j = 0; j < shakes.length; j++) {
        var sh = shakes[j]; if (!sh || q.hitK[sh.i] || sh.s !== q.l || !cabViva(sh, now)) continue;
        var d1 = cabX(sh, now) - q.x, d0 = now - dt >= relTime(sh) ? cabX(sh, now - dt) - x0 : d1 + 1;
        if (Math.abs(d1) < HITR || (d0 > 0 && d1 < 0)) {
          q.hitK[sh.i] = 1;
          if (aire) { q.esq++; continue; }
          caer(p, now, 0); return;
        }
      }
      for (j = 0; j < EV.length; j++) {
        var e = EV[j]; if (e.k !== 'zam' || q.zamK[j] || now < e.t || now > e.t + e.d) continue;
        var z1 = zamX(e, now) - q.x, z0 = now - dt >= e.t ? zamX(e, now - dt) - x0 : z1 + 1;
        if (Math.abs(z1) < HITZ || (z0 > 0 && z1 < 0)) {
          q.zamK[j] = 1;
          if (aire) { q.esq++; continue; }
          caer(p, now, 1); return;
        }
      }
    }
    function fresas(p, now) {
      var q = P[p], j;
      for (j = 0; j < FR.length; j++) {
        var fr = FR[j]; if (q.got[j] || fr.l !== q.l || Math.abs(fr.x - q.x) > FRR) continue;
        q.got[j] = 1; q.fresas++; q.turbo = now + TURBO_T;
        if (p === c.yo) { if (v3) { V3.sfx('moneda'); if (v3.part) v3.part.soltar(X3(fr.x), Y3(fr.x) + 1, Z3L(fr.l), 10, { k: 'confeti', cols: ['#ff3b4e', '#fffdf2', '#5cff7a'], vel: 3, arriba: 3, g: 6, vida: .7 }); } else SND(880, 0.12, 'square', 0.05, 300); }
      }
    }

    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        var r = c.remoto(p);
        if (r) {
          if (isSolo(p)) { if (num(r.l)) q.curR = cl(Math.round(r.l), 0, NL - 1); return; }
          q.x = r.x; q.l = num(r.l) ? cl(Math.round(r.l), 0, NL - 1) : q.l; q.st = r.st; q.js = r.j > 0 ? (r.j - 1) / 1000 : -9;
          if (r.st === 2) { cr[p] = 1; q.x = L; }
        }
        return;
      }
      var e = c.eje(p), taps = c.tap(p, 'a');
      if (now >= 0 && Math.abs(e.y) > 0.5 && now >= q.lCd) {                // ↑ = guaya de atrás (0), ↓ = la de adelante (2)
        var nl = cl(q[isSolo(p) ? 'cur' : 'l'] + (e.y > 0 ? 1 : -1), 0, NL - 1);
        if (isSolo(p)) { if (nl !== q.cur) { q.cur = nl; q.lCd = now + LANE_CD; } }
        else if (q.st === 0 && nl !== q.l) { q.l = nl; q.lCd = now + LANE_CD; if (p === c.yo && !v3) SND(520, 0.05, 'square', 0.03); }
      }
      if (isSolo(p)) {
        if (taps > 0 && now >= 0) soltar(p, q.cur, now);
        return;
      }
      if (q.st === 2) return;
      if (q.st === 1) { if (now >= q.fallEnd) { q.st = 0; q.inv = now + INV; q.js = -9; } return; }   // se vuelve a subir a la guaya
      if (now < 0) return;
      if (taps > 0 && now >= q.js + JUMP_CD) { q.js = now; q.saltos++; if (p === c.yo && !v3) SND(420, 0.1, 'square', 0.05, 300); }
      var x0 = q.x;
      q.x = cl(q.x + vel(p, now) * dt, 0, L);
      if (q.x >= L) { cruza(p, now); return; }
      golpes(p, x0, now, dt);
      if (q.st === 0) fresas(p, now);
    }

    /* ───── IA ───── */
    function gauss(R2) { return (R2.next() + R2.next() + R2.next() - 1.5) * 2; }
    function encuentro(sh, p, now) {                                        // cuándo me alcanza esa cabina (si me alcanza), suponiendo que sigo a mi ritmo
      var q = P[p], v = Math.max(0, SPD * SPF[fase(now)]), te = relTime(sh), x = q.x;
      if (now < te) { var xe = x + v * (te - now); if (xe >= L) return -1; return te + (L + 10 - xe) / (sh.vc + v); }
      var xc = cabX(sh, now); if (xc < x - HITR) return -1;
      return now + Math.max(0, xc - x) / (sh.vc + v);
    }
    function aiTrio(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], j, l;
      if (now < 0 || q.st !== 0) { api.eje(0, 0); pl.ja = -1; pl.wl = -1; return; }
      if (now >= pl.re) {                                                   // decide cada «reacción»: a qué guaya ir y cuándo saltar
        pl.re = now + 0.3 - 0.18 * sk + R2.next() * 0.08;
        var niebla = enNiebla(now), costo = [0, 0, 0], peligro = [99, 99, 99], H = 1.7, despiste = R2.next() < 0.28 - 0.24 * sk;
        for (j = 0; j < shakes.length; j++) {
          var sh = shakes[j]; if (!sh || q.hitK[sh.i] || now < sh.tr) continue;
          if (niebla && now >= relTime(sh) && cabX(sh, now) - q.x > NIEBLA_V) continue;
          var tm = encuentro(sh, p, now); if (tm < 0) continue;
          if (tm - now < peligro[sh.s]) peligro[sh.s] = tm - now;
        }
        if (despiste) peligro[(q.l + 1 + Math.floor(R2.next() * 2)) % NL] = 99;
        var raf = evActivo('raf', now) || (function () { var w = evAviso(now); return w && w.k === 'raf' ? w : null; })();
        for (l = 0; l < NL; l++) {
          costo[l] = Math.abs(l - q.l) * 0.6 + gauss(R2) * (0.5 - 0.4 * sk);
          if (peligro[l] < H) costo[l] += (H - peligro[l]) * 8 + 2;
          if (raf && l !== raf.safe) costo[l] += 3.5;
          for (j = 0; j < FR.length; j++) if (!q.got[j] && FR[j].l === l && FR[j].x > q.x && FR[j].x - q.x < 70) { costo[l] -= 1.2 * sk + 0.3; break; }
        }
        if (Math.abs(q.l - 1) === 1 && peligro[1] < 0.5) costo[2 - q.l] += 6;   // no se cruza por encima de una cabina
        var best = q.l; for (l = 0; l < NL; l++) if (costo[l] < costo[best] - 0.05) best = l;
        pl.wl = best;
        /* saltar: los zamuros (todas las guayas) o una cabina en mi guaya si no me da tiempo de cambiarme */
        var tj = -1, zj;
        for (zj = 0; zj < EV.length; zj++) {
          var ze = EV[zj]; if (ze.k !== 'zam' || q.zamK[zj] || now > ze.t + ze.d) continue;
          var vz = Math.max(0, SPD * SPF[fase(now)]), tz = now < ze.t ? ze.t + (zamX(ze, ze.t) - q.x - vz * (ze.t - now)) / (VZ + vz) : now + (zamX(ze, now) - q.x) / (VZ + vz);
          if (tz >= now && tz - now < 1.2) { tj = tz; break; }
        }
        if (tj < 0 && peligro[q.l] < 0.75 && (best === q.l || peligro[q.l] < 0.35)) tj = now + peligro[q.l];
        if (tj >= 0 && !despiste && now >= q.js + JUMP_CD - 0.4) pl.ja = tj - JUMP_T * 0.45 + gauss(R2) * (0.17 - 0.13 * sk);
      }
      var dy = pl.wl >= 0 && pl.wl !== q.l ? (pl.wl > q.l ? 1 : -1) : 0;
      api.eje(0, dy);
      if (pl.ja >= 0 && now >= pl.ja) { if (now >= q.js + JUMP_CD) api.press('a'); pl.ja = -1; }
    }
    function visto(m, now) { return !enNiebla(now); }
    function aiSolo(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], a, l;
      if (nextIdx() >= MAXS || now < q.grace || now < 0) { api.eje(0, 0); pl.tgt = -1; return; }
      if (pl.tgt < 0 && now >= q.nextShake + pl.dl) {                     // a qué guaya: donde más gente hay, pesando a los que van más arriba
        var val = [0, 0, 0];
        for (a = 0; a < trio.length; a++) {
          var m = trio[a], Q = P[m];
          if (Q.st === 2 || cr[m]) continue;
          if (visto(m, now)) { Q.lastSeenX = Q.x; Q.lastSeenL = Q.l; Q.lastSeenT = now; }
          var xl = Q.lastSeenL, w = 0.6 + Q.lastSeenX / L + (Q.st === 1 ? -0.5 : 0);
          if (sk > R2.next() && now < Q.js + JUMP_CD && now > Q.js + JUMP_T) w += 0.5;   // el bueno castiga al que acaba de saltar
          val[xl] += w;
        }
        var raf = evActivo('raf', now); if (raf) val[raf.safe] += 0.8 * sk;
        var best = 0, bs = -9;
        for (l = 0; l < NL; l++) { var v2 = val[l] + gauss(R2) * (0.6 - 0.45 * sk); if (v2 > bs) { bs = v2; best = l; } }
        pl.tgt = best;
      }
      if (pl.tgt < 0) { api.eje(0, 0); return; }
      if (q.cur !== pl.tgt) { api.eje(0, now >= q.lCd ? (pl.tgt > q.cur ? 1 : -1) : 0); return; }
      api.eje(0, 0);
      if (now >= q.nextShake) { api.press('a'); pl.tgt = -1; pl.dl = (0.55 - 0.45 * sk) * R2.next(); }
    }

    /* ───── 2D de respaldo (solo rr / ell / line / poly / txt / pj) ───── */
    function geom() {
      var f = cp(), w = f.x1 - f.x0, WLOG = L + 160, k = cl((w - 10) / WLOG, 0.45, 1.15), vs = (w - 10) / k, cx = (f.x0 + f.x1) / 2;
      var cam = vs >= WLOG ? L / 2 : cl(camX, vs / 2 - 60, L + 60 - vs / 2);
      return { k: k, cx: cx, cam: cam, f: f, CY: 300 };
    }
    function sx(G, x) { return G.cx + (x - G.cam) * G.k; }
    function sy(G, x, l) { return G.CY - (x / L) * 120 + (l - 1) * 30; }
    function fondo(G) {
      var f = G.f, x0 = f.x0, x1 = f.x1, w = x1 - x0, m;
      rr(x0, 0, w, 200, 0, pal.cielo, 0); rr(x0, 160, w, 120, 0, pal.cielo2, 0);
      ell(lv === 1 ? x1 - 90 : x0 + 90, lv === 3 ? 60 : 80, 26, 26, pal.sol, 0);
      var pts = [[x0 - 20, 440]];
      for (m = 0; m <= 10; m++) pts.push([x0 - 20 + (w + 40) * m / 10, 210 + Math.abs(Math.sin(m * 1.7 + 1)) * 60 - (m % 3) * 14]);
      pts.push([x1 + 20, 440]); poly(pts, pal.mon2, 0);
      rr(x0, 400, w, 200, 0, pal.mon1, 0);
    }
    function dibujar2D() {
      var G = geom(), now = c.ahora(), p, k, l, yo = c.yo, s = cl(G.k, 0.6, 1.1), soloVe = yo === soloI, nie = enNiebla(now);
      ctx.save(); ctx.translate(Math.sin(absT * 90) * shake * 4, Math.cos(absT * 77) * shake * 4);
      fondo(G);
      rr(sx(G, 0) - 50 * s, sy(G, 0, 1) - 10, 50 * s, 160, 4, '#e8553d', 3); rr(sx(G, L), sy(G, L, 1) - 10, 50 * s, 160, 4, '#2fae4a', 3);
      txt('¡ARRIBA!', sx(G, L) + 25 * s, sy(G, L, 1) - 24, 12, '#fffdf2', 0, true);
      var raf = evActivo('raf', now);
      for (l = 0; l < NL; l++) {
        var gr = guayaRoja(l, now), col = gr === 2 ? '#ff3b4e' : gr === 1 ? (Math.sin(absT * 20) > 0 ? '#ff3b4e' : '#ffd23f') : raf ? (l === raf.safe ? '#5cff7a' : '#9ad8ff') : pal.cable;
        line([[sx(G, 0), sy(G, 0, l)], [sx(G, L), sy(G, L, l)]], gr ? 5 : 3, col);
        if (soloVe && P[soloI].cur === l) txt('▶', sx(G, L) + 60 * s, sy(G, L, l), 16, '#ffd23f', 0, true);
      }
      for (k = 0; k < FR.length; k++) { var fr = FR[k]; if (yo >= 0 && P[yo] && P[yo].got[k]) continue; ell(sx(G, fr.x), sy(G, fr.x, fr.l) - 8, 5, 5, '#ff3b4e', 1.5); }
      for (k = 0; k < shakes.length; k++) {
        var sh = shakes[k]; if (!sh) continue;
        var vivo = cabViva(sh, now), av = cabAviso(sh, now); if (!vivo && !av) continue;
        var xc = vivo ? cabX(sh, now) : L + 10;
        if (nie && !soloVe && yo >= 0 && P[yo] && xc - P[yo].x > NIEBLA_V) continue;
        rr(sx(G, xc) - 12 * s, sy(G, xc, sh.s) + 4, 24 * s, 18 * s, 3, '#e8553d', 2);
      }
      for (k = 0; k < EV.length; k++) { var e = EV[k]; if (e.k === 'zam' && now >= e.t && now < e.t + e.d) for (l = 0; l < NL; l++) poly([[sx(G, zamX(e, now)) - 9, sy(G, zamX(e, now), l) - 14], [sx(G, zamX(e, now)) + 9, sy(G, zamX(e, now), l) - 14], [sx(G, zamX(e, now)), sy(G, zamX(e, now), l) - 8]], INK, 0); }
      for (k = 0; k < trio.length; k++) {
        p = trio[k]; var q = P[p];
        if (soloVe && nie && q.st !== 2) continue;
        var X = sx(G, q.x), Y = sy(G, q.x, q.l) - (enAire(p, now) ? 18 * Math.sin((now - q.js) / JUMP_T * Math.PI) : 0) + (q.st === 1 ? 26 : 0);
        c.util.pj(asiento(p).ch, X, Y - 12, 26 * s, { animo: q.st === 1 ? 'perder' : null, sombra: false });
        txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), X, Y - 34 * s, 10, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      c.util.pj(asiento(soloI).ch, sx(G, L) + 30 * s, sy(G, L, 0) - 30, 40 * s, { animo: now - P[soloI].tap < 0.3 ? 'celebrar' : null, sombra: false });
      if (nie) { ctx.save(); ctx.globalAlpha = 0.45; rr(G.f.x0, 120, G.f.x1 - G.f.x0, 300, 0, '#c8d0e0', 0); ctx.restore(); }
      ctx.restore();
      marcador(G.f);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.25; rr(G.f.x0, 0, G.f.x1 - G.f.x0, 600, 0, '#ffffff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }
    /* marcador (texto 2D, igual en 3D): ARRIBA x/2, la regla, el banner de fase/evento y lo de cada rol */
    function marcador(f) {
      var cx = (f.x0 + f.x1) / 2, now = c.ahora(), cn = cruzaron(), k, my = 86, yo = c.yo, soloVe = yo === soloI, ancho = f.x1 - f.x0;
      txt('ARRIBA', cx - 44, my, 13, '#fffdf2', 0, true);
      for (k = 0; k < HN; k++) ell(cx + 30 + k * 22, my, 8, 8, k < cn ? '#5cff7a' : 'rgba(20,16,28,.5)', 2.5);
      if (now >= 0 && now < dur) {
        var fz = fase(now), rest = Math.max(0, Math.ceil(dur - now));
        txt(fz === 2 ? '¡ÚLTIMOS ' + rest + ' s!' : fz === 1 ? 'FASE 2 · ' + rest + ' s' : rest + ' s', cx, 108, fz === 2 ? 15 : 12, fz === 2 ? '#ff3b4e' : '#fffdf2', 0, true);
      }
      if (soloVe && now >= 0) {
        var listo = now >= P[soloI].nextShake;
        txt(listo ? '↑↓ guaya · A = ¡SUELTA LA CABINA!' : 'cargando cabina…', cx, 130, ancho < 500 ? 12 : 14, listo ? '#5cff7a' : '#ffd23f', 0, true);
        if (enNiebla(now)) txt('NEBLINA: no los ves', cx, 150, 12, '#c8d0e0', 0, true);
      } else if (yo >= 0 && yo < n && !isSolo(yo) && now >= 0 && P[yo].st !== 2) {
        var q = P[yo], g2 = guayaRoja(q.l, now), jr = now >= q.js + JUMP_CD;
        if (q.st === 1) txt('¡TE TUMBARON! subiendo otra vez…', cx, 130, 14, '#ff3b4e', 0, true);
        else if (g2) txt('¡CABINA EN TU GUAYA! ↑↓ cámbiate' + (jr ? ' o A salta' : ''), cx, 130, ancho < 500 ? 12 : 15, '#ff3b4e', 0, true);
        else txt('↑↓ cambia de guaya · A salta' + (jr ? '' : ' (…)'), cx, 130, 12, '#fffdf2', 0, true);
        if (now < q.turbo) txt('¡TURBO DE FRESAS!', cx, 150, 13, '#ff9ec7', 0, true);
      }
      if (now < banner.hasta) txt(banner.t, cx, 186, ancho < 500 ? 17 : 24, banner.col, 0, true);
      else if (now > -0.5 && now < 3 && !c.practica) txt(soloVe ? '¡TUMBA AL TRÍO DE LA GUAYA!' : '¡SUBE AL ÁVILA POR LA GUAYA!', cx, 186, 20, '#fffdf2', 0, true);
      else if (now >= 3 && now < 4.6 && !c.practica && !soloVe) txt(GAG, cx, 186, ancho < 500 ? 11 : 14, '#fffdf2', 0, true);
    }

    /* ───── 3D low poly (fiesta-3d.js): el teleférico del Ávila. Solo dibujo: lee P, shakes y EV; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;              // v3: null = sin probar, false = sin 3D
    var ESX = 1 / 15, HC = 6, SL = 0.16, SAG = 0.3, ZL = 3.2;
    function X3(x) { return (x - L / 2) * ESX; }
    function Y3(x) { var xx = cl(x, 0, L), u = (xx % TW) / TW; if (xx >= L) u = 0; return HC + SL * X3(xx) - SAG * Math.sin(Math.PI * u); }
    function Z3L(l) { return (l - 1) * ZL; }
    function suelo(x, z) {
      var b = SL * x - 9.5, xi = X3(0) - 6;
      if (x < xi) b -= (xi - x) * 0.55;
      b = Math.max(-26, b);
      if (z < -8) b += (-8 - z) * 0.45;
      if (z > 8) b -= (z - 8) * 0.5;
      return b + 0.9 * Math.sin(0.31 * x + 1.3) * Math.cos(0.27 * z) + 0.4 * Math.sin(0.9 * x + 0.7 * z);
    }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#d6f1ff'], hemi: [0xffffff, 0x7a8a60, .55], sol: [0xfff2d8, .7], niebla: ['#d6f1ff', 45, 150], monte: '#4f9a52', monte2: '#3f8048', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x6a5a6a, .5], sol: [0xffb070, .8], niebla: ['#ffc99a', 40, 130], monte: '#7a7a4a', monte2: '#5a5a48', noche: 0 },
      3: { cielo: ['#101640', '#2f3578'], hemi: [0x8a8aff, 0x2a2a4a, .45], sol: [0x9aa8ff, .3], niebla: ['#2a3060', 22, 80], monte: '#2a4a4a', monte2: '#1f3a40', noche: 1 }
    };
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: pl.niebla, fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      V3.pista('guaya', { bpm: 112, acordes: [[52, 55, 59], [57, 60, 64], [59, 63, 66], [52, 55, 59]],      // gaita zuliana: Mi menor, i–iv–V7–i
        mel: [71, 0, 74, 72, 71, 0, 69, 0, 67, 0, 69, 71, 0, 72, 71, 0, 69, 0, 72, 0, 71, 69, 67, 0, 66, 0, 69, 0, 71, 0, 0, 0] });
      V3.pista('guaya3', { bpm: 150, acordes: [[52, 55, 59], [59, 63, 66], [57, 60, 64], [59, 63, 66]],    // los últimos segundos: la misma gaita, embalada
        mel: [76, 74, 76, 0, 79, 0, 76, 74, 72, 0, 74, 76, 0, 79, 81, 0, 79, 76, 74, 0, 72, 74, 71, 0, 69, 71, 72, 0, 74, 0, 76, 0] });
      var geoS = new T.PlaneGeometry(200, 130, 50, 32); geoS.rotateX(-Math.PI / 2);
      var pos = geoS.attributes.position;
      for (k = 0; k < pos.count; k++) pos.setY(k, suelo(pos.getX(k), pos.getZ(k)));
      geoS.computeVertexNormals();
      var matS = tn(pl.monte, { nuevo: true }); matS.flatShading = true; matS.needsUpdate = true;
      var ladera = new T.Mesh(geoS, matS); ladera.receiveShadow = true; S3.add(ladera);
      var arboles = [];
      for (k = 0; k < 80; k++) {
        var tx = ((k * 37.7) % 120) - 55, tz = ((k * 23.3) % 40) - 26 + (k % 3) * 2;
        if (Math.abs(tz) < 6 && tx > X3(0) - 4 && tx < X3(L) + 4) continue;
        var ty = suelo(tx, tz), ar = M(new T.ConeGeometry(.9 + (k % 4) * .2, 2.6 + (k % 5) * .5, 6), k % 2 ? pl.monte2 : V3.oscurecer(pl.monte, .8), { g: .03 });
        ar.position.set(tx, ty + 1.3, tz); S3.add(ar); arboles.push(ar);
      }
      [[30, -70, 38, 30, pl.monte2], [-10, -80, 30, 26, V3.oscurecer(pl.monte2, .9)], [65, -60, 34, 26, pl.monte], [-50, -75, 26, 22, pl.monte2]].forEach(function (m) {
        var mo = M(new T.ConeGeometry(m[3], m[2], 7), m[4], { borde: false }); mo.position.set(m[0], m[2] / 2 - 12, m[1]); S3.add(mo);
      });
      var hum = M(new T.CylinderGeometry(1.6, 1.6, 7, 12), '#f4f0e6', { g: .03 }); hum.position.set(30, 38 - 12 + 3.2, -70); S3.add(hum);
      var CASAS = ['#ff9ec7', '#ffd23f', '#7fd6c9', '#ffb36b', '#a9a0ff', '#8fd8ff', '#ff7a6a', '#fffdf2'];
      var luces = [];
      for (k = 0; k < 60; k++) {
        var cxk = -32 - ((k * 13.7) % 50), czk = 6 - ((k * 9.1) % 40), cyk = suelo(cxk, czk), ch = 1 + (k % 5) * .8;
        var ca = M(new T.BoxGeometry(1.4 + (k % 3) * .5, ch, 1.4), CASAS[k % CASAS.length], { borde: false }); ca.position.set(cxk, cyk + ch / 2, czk); S3.add(ca);
        if (pl.noche) luces.push(cxk, cyk + ch + .2, czk);
      }
      if (pl.noche) {
        for (k = 0; k < 160; k++) { var lx = -30 - ((k * 7.3) % 60), lz = 10 - ((k * 5.7) % 50); luces.push(lx, suelo(lx, lz) + .3, lz); }
        var gl = new T.BufferGeometry(); gl.setAttribute('position', new T.Float32BufferAttribute(luces, 3));
        S3.add(new T.Points(gl, new T.PointsMaterial({ color: 0xffd36a, size: .45 })));
      }
      function estacion(x, col, txtE) {
        var g3 = new T.Group(), y0 = Y3(x <= 0 ? 0 : L); g3.position.set(X3(x), 0, 0); S3.add(g3);
        var base = suelo(X3(x), 0) - 1, alto = y0 - .3 - base;
        var cu = M(new T.BoxGeometry(6.5, alto, 11), '#e8e0d0', { recibe: true, g: .015 }); cu.position.set(0, base + alto / 2, 0); g3.add(cu);
        var te = M(new T.BoxGeometry(7.4, .5, 12), col, { g: .02 }); te.position.set(0, y0 + 3.2, 0); g3.add(te);
        [[-3, -5.2], [3, -5.2], [-3, 5.2], [3, 5.2]].forEach(function (c4) { var co = M(new T.BoxGeometry(.35, 3.4, .35), '#c8c0b0', { g: .04 }); co.position.set(c4[0], y0 + 1.5, c4[1]); g3.add(co); });
        var cart = V3.texturaCanvas(256, 64, function (x2, w, h) { x2.fillStyle = col; x2.fillRect(0, 0, w, h); x2.fillStyle = '#fffdf2'; x2.font = 'bold 34px sans-serif'; x2.textAlign = 'center'; x2.fillText(txtE, w / 2, 44); });
        var le = new T.Mesh(new T.PlaneGeometry(5.6, 1.4), new T.MeshBasicMaterial({ map: cart })); le.position.set(0, y0 + 4.3, 6.05); g3.add(le);
        if (pl.noche) { var luz = new T.PointLight(0xffc870, 1.3, 18, 2); luz.position.set(0, y0 + 2, 3); g3.add(luz); }
        return g3;
      }
      estacion(0 - 3.5 / ESX, '#e8553d', 'TELEFÉRICO');
      estacion(L + 3.5 / ESX, '#2fae4a', 'WARAIRA REPANO');
      for (k = 1; k < NS; k++) {
        var xt = X3(k * TW), yt = Y3(k * TW), bt = suelo(xt, 0), ht = yt - bt - .3;
        var po = M(new T.CylinderGeometry(.22, .55, ht, 6), '#7a7a88', { g: .03 }); po.position.set(xt, bt + ht / 2, -ZL * 1.6); S3.add(po);
        var po2 = M(new T.CylinderGeometry(.22, .55, ht, 6), '#7a7a88', { g: .03 }); po2.position.set(xt, bt + ht / 2, ZL * 1.6); S3.add(po2);
        var tr = M(new T.BoxGeometry(.4, .4, ZL * 3.4), '#e8553d', { g: .04 }); tr.position.set(xt, yt - .45, 0); S3.add(tr);
      }
      /* las tres guayas: una malla por guaya con su material (roja con cabina, verde/azul con la ráfaga) */
      var guayas = [];
      for (j = 0; j < NL; j++) {
        var mat = tn(lv === 3 ? '#8e8ca8' : '#3a3a48', { nuevo: true }), pts = [], m2;
        for (m2 = 0; m2 <= 6 * NS; m2++) { var xx = L * m2 / (6 * NS); pts.push(new T.Vector3(X3(xx), Y3(xx), Z3L(j))); }
        var tubo = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 12 * NS, .1, 5), mat); S3.add(tubo);
        var fl = M(new T.ConeGeometry(.5, 1, 4), '#ff3b4e', { g: .06 }); fl.rotation.x = Math.PI; fl.visible = false; S3.add(fl);
        guayas.push({ mat: mat, flecha: fl });
      }
      /* las cabinas (un grupo por cabina; las de aviso esperan arriba) */
      var cabs = [];
      for (k = 0; k < 8; k++) { var cv = cabina3D(['#e8553d', '#ffd23f', '#3fa9ff', '#ff9ec7'][k % 4], pl.noche); cv.g.visible = false; S3.add(cv.g); cabs.push(cv); }
      /* las fresas con crema (de cada quien): vaso blanco, crema y fresa */
      var fres = [];
      for (k = 0; k < FR.length; k++) {
        var gf = new T.Group(), vaso = M(new T.CylinderGeometry(.32, .22, .45, 8), '#fffdf2', { g: .04 }); gf.add(vaso);
        var crema = M(new T.SphereGeometry(.3, 8, 6), '#fff6e0', { borde: false }); crema.position.y = .3; gf.add(crema);
        var fresa = M(new T.ConeGeometry(.17, .32, 6), '#ff3b4e', { g: .04 }); fresa.position.y = .58; fresa.rotation.x = Math.PI; gf.add(fresa);
        gf.position.set(X3(FR[k].x), Y3(FR[k].x) + .9, Z3L(FR[k].l)); S3.add(gf); fres.push(gf);
      }
      /* el trío corre por encima de la guaya; el operario arriba con su palanca */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: isSolo(k) ? 1.3 : 1.05 });
        S3.add(pj.g);
        pjs.push({ pj: pj, x: 0, z: isSolo(k) ? 0 : Z3L(P[k].l), stC: 0, jsC: -9, vientoT: 0 });
        if (isSolo(k)) pj.g.position.set(X3(L) + 2.6, Y3(L) + .1, 1.6);
      }
      var panel = M(new T.BoxGeometry(1.4, 1.1, .8), '#5a5a6a', { g: .04 }); panel.position.set(X3(L) + 1.2, Y3(L) + .55, 2.6); S3.add(panel);
      var palanca = new T.Group(); palanca.position.set(X3(L) + 1.2, Y3(L) + 1.1, 2.6); S3.add(palanca);
      var vara = M(new T.CylinderGeometry(.07, .07, 1.1, 6), '#2a2a34', { g: .08 }); vara.position.y = .55; palanca.add(vara);
      var pomo = M(new T.SphereGeometry(.2, 8, 6), '#ff3b4e', { g: .06 }); pomo.position.y = 1.1; palanca.add(pomo);
      /* zamuros (la bandada del evento) y los que vuelan de adorno */
      var bandada = [];
      for (k = 0; k < 9; k++) bandada.push(zamuro(S3, M, T));
      var adorno = [];
      for (k = 0; k < 3; k++) { var za = zamuro(S3, M, T); za.g.visible = true; adorno.push({ z: za, r: 6 + k * 3, cx: -10 + k * 12, cy: HC + 9 + k, f: .4 + k * .07 }); }
      /* nubes (en la neblina bajan y tapan todo) */
      var nubes = [];
      for (k = 0; k < 12; k++) {
        var nb = new T.Group(), mn = V3.toon(lv === 3 ? '#9aa6c8' : '#fffdf2', { op: .75 });
        for (j = 0; j < 4; j++) { var bo = new T.Mesh(new T.IcosahedronGeometry(1.4 + (j % 2) * .6, 0), mn); bo.position.set(j * 1.4 - 2, (j % 2) * .5, (j % 3) * .4); nb.add(bo); }
        nb.position.set(((k * 31) % 90) - 45, HC + 6 + (k % 3) * 3, -14 - (k % 4) * 6); S3.add(nb); nubes.push({ g: nb, y0: nb.position.y, z0: nb.position.z });
      }
      var abrigo = new T.Mesh(new T.BoxGeometry(L * ESX, .1, 1.6), new T.MeshBasicMaterial({ color: 0x5cff7a, transparent: true, opacity: .35, depthWrite: false })); abrigo.visible = false; S3.add(abrigo);
      var cursor = new T.Mesh(new T.BoxGeometry(4.5, .14, 1.8), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .45, depthWrite: false })); cursor.visible = false; S3.add(cursor);
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      var Wfull = L * ESX + 16, cam = { x: 0, w: Math.min(Wfull, 34) };
      esc.encuadrar(cam.w, 15, new T.Vector3(0, HC - 2, 0), .42);
      return V3.ultimo = { esc: esc, pjs: pjs, guayas: guayas, cabs: cabs, fres: fres, bandada: bandada, adorno: adorno, nubes: nubes, abrigo: abrigo, cursor: cursor, flecha: flecha,
        palanca: palanca, arboles: arboles, part: part, cam: cam, Wfull: Wfull, vistos: 0, fin: 0, nie: 0, base: { hemi: pl.hemi[2], sol: pl.sol[1], niebla: pl.niebla.slice() }, palT: 0, vientoT: 0 };
    }
    function zamuro(S3, M, T) {
      var za = new T.Group(), cu2 = M(new T.SphereGeometry(.3, 6, 4), '#14101c', { borde: false }); za.add(cu2);
      var cab = M(new T.SphereGeometry(.16, 6, 4), '#c84a3a', { borde: false }); cab.position.set(0, .1, .35); za.add(cab);
      var al1 = M(new T.BoxGeometry(1.3, .06, .4), '#14101c', { borde: false }); al1.position.x = .65; za.add(al1);
      var al2 = M(new T.BoxGeometry(1.3, .06, .4), '#14101c', { borde: false }); al2.position.x = -.65; za.add(al2);
      za.visible = false; S3.add(za);
      return { g: za, a1: al1, a2: al2 };
    }
    function cabina3D(col, noche) {                                         // pivote en el carro de la guaya: g > caja (se mece)
      var T = THREE, M = V3.malla, g3 = new T.Group(), caja = new T.Group(); g3.add(caja);
      var carro = M(new T.BoxGeometry(1.6, .7, .7), '#2a2a34', { g: .05 }); carro.position.y = .2; g3.add(carro);
      var rueda = M(new T.CylinderGeometry(.35, .35, .8, 10), '#ffd23f', { g: .05 }); rueda.rotation.x = Math.PI / 2; rueda.position.y = .45; g3.add(rueda);
      var vara = M(new T.CylinderGeometry(.06, .06, 1.2, 6), '#2a2a34', { g: .08 }); vara.position.y = -.6; caja.add(vara);
      var techo = M(new T.BoxGeometry(2.6, .3, 2.1), col, { g: .03 }); techo.position.y = -1.3; caja.add(techo);
      var pared = M(new T.BoxGeometry(2.6, 1.6, 2.1), col, { g: .025 }); pared.position.y = -2.4; caja.add(pared);
      var vidrio = M(new T.BoxGeometry(2.65, .6, 2.15), noche ? '#ffd36a' : '#bfe7ff', { borde: false, em: noche ? '#ffb030' : null, emI: .8 }); vidrio.position.y = -2.1; caja.add(vidrio);
      return { g: g3, caja: caja };
    }
    function luzFase(V, fz, nie, t) {
      var b = V.base, sh = fz === 2 ? .15 + .1 * Math.sin(t * 6) : 0, e = V.esc;
      e.luces.hemi.intensity = b.hemi * (fz === 2 ? .8 : 1);
      e.luces.sol.intensity = b.sol * (fz === 2 ? 1.25 : fz === 1 ? 1.1 : 1);
      if (fz === 2) e.luces.sol.color.setRGB(1, .55 + sh * .3, .45); else if (fz === 1) e.luces.sol.color.setRGB(1, .82, .62);
      if (e.scene.fog) { var k = V.nie; e.scene.fog.near = b.niebla[1] * (1 - k) + 6 * k; e.scene.fog.far = b.niebla[2] * (1 - k) + 26 * k; }
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, t = absT, p, k, l, cn = cruzaron(), fin = cn >= HN || now >= dur, ganaTrio = cn >= HN, yo = c.yo >= 0 && c.yo < n ? c.yo : -1, soloVe = yo === soloI;
      var fz = now >= 0 ? fase(now) : 0, nie = enNiebla(now), raf = evActivo('raf', now), w = evAviso(now);
      V.part.update(dt);
      V.nie += ((nie ? 1 : 0) - V.nie) * Math.min(1, dt * 2.5);
      luzFase(V, fz, V.nie, t);
      /* nubes: bajan con la neblina; los árboles se doblan con la ráfaga */
      for (k = 0; k < V.nubes.length; k++) { var nb = V.nubes[k]; nb.g.position.x += dt * (.5 + (k % 3) * .25 + (raf ? 9 : 0)); if (nb.g.position.x > 55) nb.g.position.x = -55; nb.g.position.y = nb.y0 - V.nie * 7; nb.g.position.z = nb.z0 + V.nie * (8 + (k % 4) * 4); }
      for (k = 0; k < V.arboles.length; k++) V.arboles[k].rotation.z = raf ? -.25 + Math.sin(t * 9 + k) * .08 : Math.sin(t * 1.3 + k) * .02;
      for (k = 0; k < V.adorno.length; k++) { var a = V.adorno[k], an = t * a.f + k * 1.6; a.z.g.position.set(a.cx + Math.cos(an) * a.r, a.cy, -16 + Math.sin(an) * a.r * .5); a.z.g.rotation.y = -an; var f1 = Math.sin(t * 6 + k) * .35; a.z.a1.rotation.z = f1; a.z.a2.rotation.z = -f1; }
      /* las guayas: rojas con cabina (parpadean en el aviso), verde la del abrigo y azul las del viento */
      for (l = 0; l < NL; l++) {
        var G = V.guayas[l], gr = guayaRoja(l, now), base = lv === 3 ? '#8e8ca8' : '#3a3a48';
        G.mat.color.set(base);
        if (gr === 2) G.mat.color.set('#ff3b4e');
        else if (gr === 1) G.mat.color.lerp(new T.Color(0xff3b4e), .5 + .5 * Math.sin(t * 22));
        else if (raf || (w && w.k === 'raf')) G.mat.color.set(l === (raf || w).safe ? '#5cff7a' : '#9ad8ff');
        G.flecha.visible = gr === 1;
        if (gr === 1) G.flecha.position.set(X3(L) - 2, Y3(L) + 3.4 + Math.abs(Math.sin(t * 8)) * .4, Z3L(l));
      }
      var rz = raf || (w && w.k === 'raf' ? w : null);
      V.abrigo.visible = !!rz;
      if (rz) { V.abrigo.position.set(0, HC + .2, Z3L(rz.safe)); V.abrigo.rotation.z = Math.atan(SL); V.abrigo.material.opacity = .25 + .15 * Math.sin(t * 8); }
      if (raf) { V.vientoT -= dt; if (V.vientoT < 0) { V.vientoT = .25; V.part.soltar(X3(L * (.2 + .6 * c.fx())), HC + 1 + c.fx() * 2, -ZL * 1.5, 4, { k: 'chispa', cols: ['#ffffff', '#d6f1ff'], vel: 7, arriba: .3, vida: .6, suelo: false }); } }
      /* cabinas: las de aviso tiemblan arriba, las vivas bajan por su guaya */
      var cs = 0, nv = nextIdx();
      if (nv > V.vistos) { var ult = shakes[nv - 1]; V.vistos = nv; if (ult && now - ult.tr < 0.6) { V.pjs[soloI].pj.uno('lanzar'); V3.sfx('motor'); V.palT = t; } }
      V.palanca.rotation.z = V.palT && t - V.palT < 0.3 ? .9 * Math.sin((t - V.palT) / 0.3 * Math.PI) : 0;
      var miX = yo >= 0 && !soloVe ? P[yo].x : -1;
      for (k = 0; k < shakes.length && cs < V.cabs.length; k++) {
        var sh = shakes[k]; if (!sh) continue;
        var vivo = cabViva(sh, now), av = cabAviso(sh, now); if (!vivo && !av) continue;
        var xc = vivo ? cabX(sh, now) : L + 10, cb = V.cabs[cs++];
        if (nie && miX >= 0 && xc - miX > NIEBLA_V) { cb.g.visible = false; continue; }
        cb.g.visible = true;
        cb.g.position.set(X3(cl(xc, -30, L + 10)) + (av ? Math.sin(t * 50) * .08 : 0), Y3(cl(xc, 0, L)) + .1, Z3L(sh.s));
        cb.caja.rotation.z = vivo ? .25 + Math.sin(t * 7 + k) * .08 : Math.sin(t * 30) * .06;
        if (vivo && !sh.vis3) { sh.vis3 = 1; V3.sfx('whoosh'); V.esc.sacudir(.15); }
      }
      for (; cs < V.cabs.length; cs++) V.cabs[cs].g.visible = false;
      /* la bandada de zamuros */
      var zv = 0;
      for (k = 0; k < EV.length && zv < 1; k++) {
        var e = EV[k]; if (e.k !== 'zam' || now < e.w || now > e.t + e.d) continue; zv = 1;
        var xz = now < e.t ? L + 20 + (e.t - now) * 25 : zamX(e, now);
        for (l = 0; l < V.bandada.length; l++) {
          var zb = V.bandada[l], ll = l % NL, of = Math.floor(l / NL);
          zb.g.visible = true; zb.g.position.set(X3(xz) + of * .9, Y3(cl(xz, 0, L)) + 1.3 + of * .35 + Math.sin(t * 5 + l) * .15, Z3L(ll) + (of - 1) * .5);
          zb.g.rotation.y = -Math.PI / 2; var fa = Math.sin(t * 14 + l) * .5; zb.a1.rotation.z = fa; zb.a2.rotation.z = -fa;
        }
      }
      if (!zv) for (l = 0; l < V.bandada.length; l++) V.bandada[l].g.visible = false;
      /* fresas: las mías que no he agarrado; giran */
      for (k = 0; k < V.fres.length; k++) { var fg = V.fres[k]; fg.visible = !(yo >= 0 && P[yo].got[k]); fg.rotation.y = t * 2 + k; fg.position.y = Y3(FR[k].x) + .9 + Math.sin(t * 3 + k) * .12; }
      /* el operario */
      var sq = P[soloI], so = V.pjs[soloI], activo = now - sq.tap < 0.7;
      if (fin && now > 0) so.pj.anim(ganaTrio ? 'triste' : 'celebrar').cara(ganaTrio ? 'triste' : 'feliz');
      else so.pj.anim(activo ? 'empujar' : 'quieto', { vel: .6 }).cara(activo ? 'enojado' : 'concentrado');
      so.pj.rumbo(-Math.PI / 2 + .5).update(dt);
      var curL = soloVe ? sq.cur : num(sq.curR) ? sq.curR : sq.cur;
      V.cursor.visible = !!(soloVe && now >= 0 && !fin);
      if (V.cursor.visible) { V.cursor.position.set(X3(L) - 2.5, Y3(L) + .15, Z3L(curL)); V.cursor.material.opacity = now >= sq.nextShake ? .55 + .2 * Math.sin(t * 10) : .2; }
      /* el trío: corren sobre su guaya, saltan, cuelgan */
      for (k = 0; k < trio.length; k++) {
        p = trio[k]; var q = P[p], s3 = V.pjs[p], pj = s3.pj, mine = c.mio(p);
        var tx = q.st === 2 ? L + 30 : q.x, vx = (tx - s3.x) / Math.max(dt, 1e-3);
        s3.x += (tx - s3.x) * Math.min(1, dt * (Math.abs(tx - s3.x) > 40 ? 3 : mine ? 30 : 10));
        s3.z += (Z3L(q.l) - s3.z) * Math.min(1, dt * 12);
        var air = enAire(p, now), hy = air ? Math.sin(cl((now - q.js) / JUMP_T, 0, 1) * Math.PI) * 1.6 : 0;
        var oculto = soloVe && nie && q.st !== 2;
        pj.g.visible = !oculto;
        if (q.st !== s3.stC) { if (q.st === 0 && s3.stC === 1) { pj.uno('saltar'); V3.sfx('salto'); } s3.stC = q.st; }
        if (q.js !== s3.jsC) { s3.jsC = q.js; if (air) { pj.uno('saltar'); V3.sfx('salto'); } }
        if (q.st === 1) {
          pj.g.position.set(X3(s3.x), Y3(s3.x) - 2.3 + Math.sin(t * 3) * .1, s3.z);
          pj.anim('cargar', { vel: 0 }).cara('susto');
          s3.vientoT -= dt; if (s3.vientoT < 0) { s3.vientoT = .6; if (p === yo) V3.sfx('viento'); }
        } else {
          pj.g.position.set(X3(s3.x), Y3(s3.x) + .1 + hy, s3.z);
          if (fin && now > 0) pj.anim(ganaTrio ? 'celebrar' : 'triste').cara(ganaTrio ? 'feliz' : 'triste');
          else if (q.st === 2) pj.anim('celebrar').cara('feliz');
          else if (now < 0) pj.anim('quieto').cara('concentrado');
          else pj.anim(vx < -2 ? 'caminar' : 'correr', { vel: cl(Math.abs(vx) / 30, .5, 1.6) }).cara(guayaRoja(q.l, now) === 2 ? 'susto' : now < q.turbo ? 'feliz' : 'concentrado');
        }
        pj.rumbo(vx < -2 && q.st === 0 ? -Math.PI / 2 : Math.PI / 2).update(dt);
      }
      V.flecha.visible = yo >= 0 && !(fin && now > 0);
      if (yo >= 0 && !soloVe) { var sy2 = V.pjs[yo]; V.flecha.position.set(X3(sy2.x), Y3(sy2.x) + 3.2 + Math.abs(Math.sin(t * 4)) * .3, sy2.z); }
      else if (yo >= 0) V.flecha.position.set(X3(L) + 2.6, Y3(L) + 4.4 + Math.abs(Math.sin(t * 4)) * .3, 1.6);
      /* cámara: el trío sigue a su corredor; el solo, al trío desde arriba; temblor en los últimos segundos */
      var asp = V.esc.camera.aspect || 16 / 9, ww = asp < 1.1 ? 20 : Math.min(V.Wfull, 36), cxw = 0;
      if (yo >= 0 && !soloVe) cxw = X3(V.pjs[yo].x) + 4;
      else { var sm = 0, nm = 0; for (k = 0; k < trio.length; k++) if (P[trio[k]].st !== 2) { sm += X3(V.pjs[trio[k]].x); nm++; } cxw = nm ? (sm / nm + X3(L)) / 2 : X3(L); }
      var lim = Math.max(0, (V.Wfull - ww) / 2); cxw = cl(cxw, -lim, lim);
      var kc = Math.min(1, dt * 2); V.cam.x += (cxw - V.cam.x) * kc; V.cam.w += (ww - V.cam.w) * kc;
      V.esc.encuadrar(V.cam.w, 15, new T.Vector3(V.cam.x, HC + SL * V.cam.x - 2.2, 0), .42);
      if (fz === 2 && !fin && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) V.esc.sacudir(.08);
      if (fin && !V.fin && now > 0) { V.fin = 1; V3.sfx(ganaTrio ? 'aplauso' : 'bocina'); }
    }
    function golpe3D(p, mio, k) {
      if (!v3) return;
      var s3 = v3.pjs[p], x = X3(s3.x), y = Y3(s3.x) + 1, z = s3.z;
      s3.pj.uno('caer'); V3.sfx(k === 1 ? 'golpe' : 'choque'); V3.sfx('caida');
      v3.part.soltar(x, y, z, 18, { k: 'chispa', cols: ['#ffd23f', '#ff3b4e', '#fffdf2'], vel: 5, arriba: 3, vida: .7, suelo: false });
      if (k === 1) v3.part.soltar(x, y, z, 10, { k: 'confeti', cols: ['#14101c', '#3a3a48'], vel: 3, arriba: 3, g: 5, vida: 1.2 });
      v3.esc.sacudir(mio ? 1 : .4);
    }
    function cruce3D(p) {
      if (!v3) return;
      var s3 = v3.pjs[p], x = X3(L) + 1, y = Y3(L) + 1;
      s3.pj.uno('festejo'); V3.sfx('ding');
      v3.part.soltar(x, y, s3.z, 40, { k: 'confeti', cols: ['#5cff7a', '#ffd23f', '#3fa9ff', '#ff9ec7'], vel: 5, arriba: 5, g: 6, vida: 1.6 });
      v3.esc.sacudir(.3);
    }
    function sobre(p, alto) {                                               // dónde van los avisos de un jugador (3D o 2D)
      if (v3) { var s3 = v3.pjs[p]; return isSolo(p) ? v3.esc.proyectar(X3(L) + 2.6, Y3(L) + alto, 1.6) : v3.esc.proyectar(X3(s3.x), Y3(s3.x) + alto, s3.z); }
      var G = geom(); return { x: sx(G, isSolo(p) ? L : P[p].x), y: sy(G, isSolo(p) ? L : P[p].x, isSolo(p) ? 0 : P[p].l) - 40 };
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && cruzaron() < HN) V3.musica(fase(now) === 2 ? 'guaya3' : 'guaya');
      v3.esc.render(dt);
      for (k = 0; k < n; k++) {
        var s3 = v3.pjs[k], pt;
        if (isSolo(k)) pt = v3.esc.proyectar(X3(L) + 2.6, Y3(L) - .6, 1.6);
        else { if (c.yo === soloI && enNiebla(now) && P[k].st !== 2) continue; pt = v3.esc.proyectar(X3(s3.x), Y3(s3.x) - .7, s3.z + .8); }
        txt(k === c.yo ? 'TÚ' : String(asiento(k).name || '').slice(0, 7), pt.x, pt.y, 12, k === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      marcador(f);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#ffffff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }

    /* avisos cosméticos de fase y eventos (en todas las pantallas por igual: salen de now y de la agenda) */
    function avisos(now) {
      if (now < 0) return;
      var fz = fase(now), j;
      if (fz > faseVista) {
        faseVista = fz;
        banner = { t: fz === 2 ? '¡ÚLTIMOS SEGUNDOS!' : '¡SE PRENDIÓ LA GUAYA!', col: fz === 2 ? '#ff3b4e' : '#ffd23f', hasta: now + 1.6 };
        shake = Math.max(shake, 0.6); flash = Math.max(flash, 0.5);
        if (v3) { V3.sfx(fz === 2 ? 'trueno' : 'bocina'); v3.esc.sacudir(fz === 2 ? 1 : .5); } else SND(fz === 2 ? 180 : 260, 0.4, 'sawtooth', 0.07, -60);
      }
      for (j = 0; j < EV.length; j++) {
        var e = EV[j];
        if (now >= e.w && !evVisto[j] && now < e.t + e.d) {
          evVisto[j] = 1; if (now < banner.hasta && banner.t.charAt(1) === 'Ú') continue;
          banner = { t: EVN[e.k], col: e.k === 'zam' ? '#ffd23f' : e.k === 'raf' ? '#9ad8ff' : '#c8d0e0', hasta: e.t + 0.6 };
          if (v3) V3.sfx(e.k === 'zam' ? 'silbato' : e.k === 'raf' ? 'viento' : 'latido'); else SND(e.k === 'zam' ? 700 : 300, 0.25, 'triangle', 0.05, -100);
        }
        if (now >= e.t && evVisto[j] === 1) { evVisto[j] = 2; if (e.k === 'raf') { shake = Math.max(shake, 0.5); if (v3) { V3.sfx('viento'); v3.esc.sacudir(.6); } } if (e.k === 'zam' && v3) V3.sfx('whoosh'); }
      }
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p;
        absT += dt; flash = Math.max(0, flash - dt * 2.5); shake = Math.max(0, shake - dt * 3);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        var tgt = L / 2;
        if (c.yo >= 0 && c.yo < n && !isSolo(c.yo)) tgt = P[c.yo].x;
        camX += (tgt - camX) * Math.min(1, dt * 5);
        avisos(now);
        var cn = cruzaron();
        if (cn >= HN && cAt < 0) cAt = now;
        if (now >= 0.2 && !voz.ini) { voz.ini = 1; if (!c.practica) { var sp = sobre(soloI, 3); S(isSolo(c.yo) ? '¡SUELTA CABINAS!' : '¡A SUBIR!', sp.x, sp.y, '#ffd23f'); } }
        if (cn >= HN && !voz.gana) { voz.gana = 1; var f = cp(); S('¡LLEGARON ARRIBA!', (f.x0 + f.x1) / 2, 150, '#5cff7a'); }
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (isSolo(p)) aiSolo(p, dt, api, now); else aiTrio(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p];
        if (isSolo(p)) return { x: 0, l: q.cur, st: 0, j: 0 };
        return { x: Math.round(q.x), l: q.l, st: q.st, j: q.js >= 0 ? Math.round(q.js * 1000) + 1 : 0 };
      },
      onEv: function (ty, p, d) {
        if (!num(p) || p < 0 || p >= n || isSolo(p)) return;
        var q = P[p], mio = p === c.yo, sa;
        if (ty === 'cruzo') {
          if (cr[p]) return;
          cr[p] = 1; q.crossAt = c.ahora(); if (!c.mio(p)) q.st = 2;
          sa = sobre(p, 3); S('¡LLEGÓ!', sa.x, sa.y, '#5cff7a');
          if (v3) cruce3D(p); else SND(660, 0.25, 'square', 0.06, 200);
          return;
        }
        if (ty === 'cae') {
          if (!d || !num(d.i) || d.i % 1 !== 0 || d.i < 0 || d.i >= MAXS) return;
          var key = d.i * 10 + p; if (fellK[key]) return;
          fellK[key] = 1; q.falls++;
          shake = mio ? 0.7 : 0.25; flash = mio ? 1 : 0.3;
          sa = sobre(p, 2);
          S(GRITOS[Math.floor(c.fx() * GRITOS.length) % GRITOS.length], sa.x, sa.y, '#ffd23f');
          if (v3) golpe3D(p, mio, d.k === 1 ? 1 : 0);
          else { SPAWN(sa.x, sa.y + 30, 10, 'conf', ['#ffd23f', '#e8453c', '#fff'], 260, 500, 0.8); SND(140, 0.3, 'sawtooth', 0.08, -80); }
        }
      },
      /* un caído que vuelve a humano retoma su sitio; una CPU recién tomada como operario espera un poco (el xs del humano pudo quedar en camino) */
      alCpu: function (p) { plan[p] = { wl: -1, re: -9, ja: -1, dl: -1, tgt: -1 }; P[p].grace = c.ahora() + GRACIA_CPU; },
      alHum: function (p, o) {
        if (o && num(o.l)) {
          if (isSolo(p)) P[p].cur = cl(Math.round(o.l), 0, NL - 1);
          else { if (num(o.x)) P[p].x = cl(o.x, 0, L); P[p].l = cl(Math.round(o.l), 0, NL - 1); if (num(o.st)) P[p].st = o.st; if (num(o.j)) P[p].js = o.j > 0 ? (o.j - 1) / 1000 : -9; }
        }
        plan[p].tgt = -1; plan[p].wl = -1;
      },
      scores: function () {                                  // umbral (M3 DM3-3): el ganador lo decide compara('1v3', …), no este archivo
        var out = [], p, cn = Math.min(T, cruzaron());
        for (p = 0; p < n; p++) out.push(isSolo(p) ? PTS * (T - cn) : PTS_TRIO);
        return out;
      },
      done: function () { return cAt >= 0 && c.ahora() >= cAt + CELEBRA; },
      hudChip: function (p) {
        if (isSolo(p)) return cruzaron() + '/' + HN;
        if (cr[p]) return '¡LLEGÓ!';
        return P[p].falls ? '×' + P[p].falls : 'EN GUAYA';
      },
      destacado: function () {
        var me = c.yo >= 0 ? c.yo : 0, cn = cruzaron();
        if (isSolo(me)) { var f = 0, j; for (j = 0; j < n; j++) f += P[j].falls; return f + ' tumbado' + (f === 1 ? '' : 's') + ' · llegaron ' + cn; }
        return cr[me] ? '¡llegaste arriba!' : (P[me].falls ? 'te tumbaron ' + P[me].falls + ' vez' + (P[me].falls > 1 ? 'es' : '') : 'no te tumbaron');
      },
      vista: function () {                                   // observable para bancos y pruebas
        var now = c.ahora(), f = 0, j;
        for (j = 0; j < n; j++) f += P[j].falls;
        return { gt: now, lv: lv, NS: NS, L: L, soloI: soloI, aviso: AV, spd: SPD, fase: now >= 0 ? fase(now) : 0, cruzaron: cruzaron(), caidas: f, falls: P.map(function (q) { return q.falls; }),
          shakes: shakes.filter(Boolean).map(function (s) { return [s.i, s.s, Math.round(s.tl * 1000), s.tr, relTime(s), s.vc]; }), x: P.map(function (q) { return q.x; }), l: P.map(function (q) { return q.l; }),
          js: P.map(function (q) { return q.js; }), st: P.map(function (q) { return q.st; }), turbo: P.map(function (q) { return q.turbo; }), fresas: P.map(function (q) { return q.fresas; }),
          saltos: P.map(function (q) { return q.saltos; }), esq: P.map(function (q) { return q.esq; }), eventos: EV.map(function (e) { return [e.k, e.w, e.t, e.d, e.safe]; }),
          fr: FR.map(function (r) { return [r.x, r.l]; }), banner: now < banner.hasta ? banner.t : '', nextShake: P[soloI].nextShake, cur: P[soloI].cur, gana: cruzaron() >= HN,
          cr: P.map(function (q, i2) { return !!cr[i2]; }) };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        dibujar2D();
      }
    };
    return g;
  }
});
})();
