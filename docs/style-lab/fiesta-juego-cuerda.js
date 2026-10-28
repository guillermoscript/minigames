'use strict';
/* LA FIESTA · EN VIVO · f_cuerda · ¡HALA LA CUERDA!  (2v2, modelo C: el juez integra la cuerda; cada pulsación viaja SELLADA con el reloj de quien pulsa)
   Tira y afloja de playa con un mecate: 3 tandas de 6 s (escala con dur/30) separadas por pausas. Un tambor marca el compás y se hala con A AL COMPÁS.
     · Un tirón vale si cae a ±WIN_MS de un golpe de tambor que ese jugador no ha usado todavía. Cada golpe se usa una vez: machacar es pulsar de más.
     · Pulsar FUERA de compás (o dos veces el mismo golpe) aturde 0,4 s: mientras tanto el jugador no hala nada (0,8 s en el charco de barro del Nv2).
     · Si los DOS panas tiran dentro de DOBLE_MS el uno del otro, el tirón es DOBLE: bono extra para los dos (la perilla de balance, M4: 120-160 ms).
     · Gana la tanda quien tenga la cuerda de su lado al terminar (se cuenta lo que llegue hasta 1 s tarde: tirones sellados antes del final). La 3ª tanda VALE DOBLE.
   AGARRE (la decisión de cada golpe): cada uno tiene 5 de agarre. Halar gasta 1; dejar pasar un golpe sin pulsar DESCANSA las manos (+1). Con agarre ≥3 el tirón es FIRME (7),
     con 1-2 es FLOJO (4) y con 0 la cuerda SE RESBALA (no hala y se corre 3 hacia el rival). Los panas deciden juntos cuándo descansar para que sus tirones caigan a la vez (doble).
     · RACHA: 3 golpes SEGUIDOS con tirón doble = ¡JALÓN! (+14 de una).
   Escalada (por tanda, escala con dur): T1 calmadita (solo la malta) · T2 el tambor acelera ×1,12, una ola y un cangrejo · T3 «¡ÚLTIMA TANDA, VALE DOBLE!»: el tambor acelera
     de ×1,15 a ×1,4 dentro de la tanda, dos olas (una por lado), dos cangrejos (uno por lado), el doble vale 9 y el barro se agranda (aturde el doble en cualquier nivel); al 70 % de dur «¡ÚLTIMOS SEGUNDOS!».
   Escalada 3D: público que hincha, racha de VIENTO (empuja la cuerda 1,8 s hacia un lado, T2-T3), atardecer en T2 y tormenta con lluvia y relámpagos en T3.
   Eventos de la playa (sembrados en mk con c.rng: los mismos en todas las pantallas; se avisan ~1,3 s antes en el carril, con banner, sonido y efecto 3D):
     · MALTA: un golpe DORADO en el carril; el que lo clave más cerca del golpe se la lleva: +12 de cuerda para su equipo y agarre lleno para los dos panas.
     · OLA: revuelca a un lado: quien tenga agarre ≥3 aguanta (−2 de agarre); con menos, se cae (aturdido 1 s, agarre 0). Hay que descansar ANTES de que llegue.
     · CANGREJO: va hacia los pies de uno: ese jugador pulsa A cuando llega (marca roja del carril) para SALTAR; si no, lo muerde: −10 de cuerda y −2 de agarre.
       Pulsar en la marca del cangrejo no es «fuera de compás» para él (para los demás sí).
   Modelo C sin ventaja de red por construcción de reglas:
     · Los humanos que no son el juez mandan `xtir {t:[sellos]}` (los últimos 3 sellos en ms de c.ahora(), reenviados 0,2 s después por si se pierde uno). El juez NO usa la hora de llegada:
       valida cada sello contra el calendario del tambor (determinista, sembrado en mk) y suma al llegar. Pareja (doble) = comparación de SELLOS, simétrica sea cual sea el orden de llegada.
     · El juez lee SU PROPIA pulsación por c.tap(): el runtime se la entrega retrasada por fairDelayEq (≈ el retardo de red de los rivales). Se resta (c.fair() si el runtime lo da; si no, se estima
       con la latencia medida de los xtir rivales) para sellarla con la hora REAL en que pulsó. Las CPU pulsan en el tick del juez.
   Estado entero: pack() = 53 enteros (≈300 B). Los eventos de la cola (xtir recién llegados) no van en el snapshot: se pierden solo los de los últimos 100 ms al migrar el juez.
   Puntaje (M4): sc[asiento] = U·tandasGanadas(la 3ª vale 2) + min(U−1, floor(ventaja/ADVU)), IGUAL para los dos panas; compara() suma por equipo (duplica ambos lados: simétrico, sin empates falsos).
   U se ajusta a dur para que ningún asiento pase del tope del servidor min(scoreMax, scoreRate·(t+1,5)): dur 30 ⇒ U=8 ⇒ 0..39 (4 tandas-peso·8 + 7); dur 3 ⇒ U=1.
   Niveles: 1 día 90 BPM · 2 atardecer 110 BPM + charco de barro en el centro (aturde 0,8 s) · 3 noche, joropo sincopado sembrado + «falso tambor» (gris con ✗: NO se tira).
   Gag: «¡Halen, halen, que el compadre se está quedando!» (burbuja cuando tu equipo va perdiendo feo). Dibujo: 3D low poly (doc 15: playa, tambor, la cuerda por las manos, el barro del que pierde; pista «cuerda» solo entre tandas)
   o, sin WebGL / ?plano=1, el 2D de siempre (rr/ell/line/poly/txt + c.util.pj). Sin Math.random/Date.now: lo cosmético sale de c.fx() y del reloj at. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_cuerda')) return;

var TK = 30, MAXP = 4;
var DOBLE_MS = 140;                    // PERILLA (M4: 120-160): dos tirones válidos de los panas a ≤ DOBLE_MS son un tirón doble
var WIN_MS = 140;                      // tolerancia al golpe de tambor (±)
var PULL = 7, FLOJO = 4, DBL = [6, 6, 9];             // unidades de cuerda: tirón firme / flojo (agarre 1-2) / bono del doble por tanda (para el equipo)
var GMAX = 5, JALON = 14, MALTA = 12, CANG = 10, RESB = 3;   // agarre lleno · resbalón (cuerda que se va al rival) · bono de la racha de 3 dobles · malta · mordida del cangrejo
var PERRO = 9, PERRO_OK = 5, STUN = 400, STUN_MUD = 800, STUN_OLA = 1000, MUD = 30, MUD3 = 38, POS_MAX = 140, LINE = 100;
var WIND_MS = 1800;                                    // RACHA DE VIENTO: durante 1,8 s empuja la cuerda 1 unidad cada 3 ticks hacia un lado (sin estado: función de la hora)
var REG_D = 250, EV_D = 350;                           // ms de espera (por los sellos que llegan tarde) antes de dar el descanso de un golpe / de resolver malta y cangrejo
var ADVU = 12, SENT = 9999, QMAX = 40, PESO = [1, 1, 2];
var PERIOD = [60 / 90, 60 / 110, 0.6];                 // s entre golpes: 90 BPM, 110 BPM, joropo (sincopa los golpes)
var ACEL = [[1, 1], [1.12, 1.12], [1.15, 1.4]];        // el tambor se acelera: factor al empezar / al terminar cada tanda
var INK = '#14101c', COL_EQ = ['#2f6fdb', '#d93a3a'], NOM_EQ = ['AZUL', 'ROJO'];
var PAL = [
  { cielo: '#8fd8ff', mar: '#3fb0d8', arena: '#f2d38a', sol: '#ffe14d', cuerda: '#b9783a' },
  { cielo: '#ff8f5a', mar: '#c9704f', arena: '#e0b878', sol: '#ffe9a0', cuerda: '#a56a38' },
  { cielo: '#1d1a4a', mar: '#2f2d6a', arena: '#a4906c', sol: '#f4f0d0', cuerda: '#8e5c34' }
];
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S_(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
var G0 = 13, PS = 10, PACKN = G0 + PS * MAXP;         // 13 globales + 10 por asiento = 53
var DISC = [];
(function () { var i; for (i = 0; i < PACKN; i++) if (i !== 1) DISC.push(i); })();

FIESTA.LIVE.add('f_cuerda', {
  name: '¡HALA LA CUERDA!', modos: ['2v2'], clase: 'binary', modelo: 'C', dur: 30,
  stick: false, botones: 1, snapHz: 10, migra: true, minHumanos: 1,
  limites: { scoreMax: 39, scoreRate: 1.4, minT: 29, finTemprano: 0 },
  packN: PACKN, packDiscretos: DISC,
  carta: {
    obj: 'Hala el mecate AL COMPÁS del tambor. Si no pulsas, descansas las manos: sin agarre la cuerda se resbala. ¡Con tu pana a la vez, el tirón vale doble!',
    gana: 'Gana el equipo con más tandas (la 3ª vale doble). Ojo con la ola (agarra fuerte), el cangrejo (salta con A), el perro del mecate (tirón doble en el golpe marrón) y la malta del golpe dorado.',
    como: { tactil: 'Botón A al compás = halar · no pulsar = descansar · A en la marca roja = saltar el cangrejo', teclado: 'ESPACIO al compás = halar · no pulsar = descansar · ESPACIO en la marca roja = saltar el cangrejo' },
    roles: null,
    demos: [{
      id: 'compas', txt: 'Pulsa A justo cuando el tambor cruza la marca. ¡Con tu pana a la vez, el tirón es doble!',
      dibuja: function (cx, cy, k, t, teclado) {
        var u = (t * 0.9) % 1, x = cx + 50 - u * 110, hit = u > 0.44 && u < 0.56;
        rr(cx - 62, cy - 14, 124, 28, 8, '#2b2540', 3); rr(cx - 62 + 40, cy - 14, 20, 28, 4, '#6c5fb0', 0);
        ell(x, cy, 9, 9, '#ffd23f', 3);
        if (teclado) { rr(cx - 40, cy + 22, 80, 24, 6, hit ? '#ff8a3d' : '#f0ead8', 3); txt('ESPACIO', cx, cy + 35, 12, INK, 0, true); }
        else { ell(cx, cy + 36, 15, 15, hit ? '#ff8a3d' : '#ffe14d', 3); txt('A', cx, cy + 37, 16, INK, 0, true); }
      }
    }]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur > 0 ? c.dur : 30, pal = PAL[lv - 1], i, p, r;
    var teams = (c.equipos && c.equipos.length === n) ? c.equipos.slice() : [];
    if (!teams.length) for (i = 0; i < n; i++) teams.push(n === 4 ? (i < 2 ? 0 : 1) : i % 2);
    var tL = teams[0]; for (i = 0; i < n; i++) if (teams[i] < tL) tL = teams[i];
    var tR = -1; for (i = 0; i < n; i++) if (teams[i] !== tL) { tR = teams[i]; break; }
    var side = [], mate = [], first = [-1, -1];
    for (i = 0; i < n; i++) { side.push(teams[i] === tL ? 0 : 1); if (first[side[i]] < 0) first[side[i]] = i; }
    for (i = 0; i < n; i++) { mate.push(-1); for (p = 0; p < n; p++) if (p !== i && side[p] === side[i]) { mate[i] = p; break; } }

    /* ───── calendario (ticks, escalado con dur/30) ───── */
    var SC = Math.max(0.1, dur / 30);
    function tk(sec) { return Math.max(1, Math.round(sec * TK * SC)); }
    var lead = tk(1.0), len = tk(6.0), gap = tk(3.6), grace = tk(1.0), TS = [], TE = [], FIN = [];
    for (r = 0; r < 3; r++) { TS.push(lead + r * (len + gap)); TE.push(TS[r] + len); FIN.push(TE[r] + grace); }
    function msOf(t) { return Math.round(t * 1000 / TK); }
    var ps = SC >= 0.6 ? 1 : cl(SC / 0.6, 0.7, 1), per = PERIOD[lv - 1] * ps, lenS = len / TK;
    var winMs = Math.min(WIN_MS, Math.round(per / ACEL[2][1] * 1000 * 0.28)), dobleMs = DOBLE_MS, dodgeMs = Math.round(winMs * 1.4);
    /* escala de puntaje: ningún asiento puede pasar del tope del servidor min(scoreMax, scoreRate·(dur+1,4)); tandas-peso máx 1+1+2 = 4 */
    var capD = Math.floor(Math.min(39, 1.4 * (dur + 1.4))), U = Math.max(1, Math.floor((capD + 1) / 5));

    /* ───── tambor sembrado (mismo en todas las pantallas: c.rng con la semilla de la partida) ───── */
    var beats = [], fakes = [], rng = c.rng, idx, t, shifted, prevSh, r1, r2, tb, cand, m, ok, j, q2;
    for (r = 0; r < 3; r++) {
      var bl = [], fl = [], base = TS[r] / TK;
      t = 0.8 * per; idx = 0; prevSh = false;
      while (t <= lenS - 0.35) {
        r1 = rng.next(); r2 = rng.next(); void r2;
        var pn = per / (ACEL[r][0] + (ACEL[r][1] - ACEL[r][0]) * cl(t / lenS, 0, 1));       // el tamborero se acelera
        shifted = lv === 3 && r1 < 0.35 && !prevSh && idx > 0 && pn / 2 >= 0.29;
        tb = shifted ? t + pn / 2 : t;
        if (tb <= lenS - 0.3) bl.push(Math.round((base + tb) * 1000));
        prevSh = shifted; t += pn; idx++;
      }
      cand = [];
      for (j = 0; j < bl.length; j++) {
        m = bl[j] + Math.round(per * 500); ok = m <= Math.round((base + lenS - 0.3) * 1000);
        for (q2 = 0; q2 < bl.length; q2++) if (Math.abs(bl[q2] - m) < winMs + 110) ok = false;
        if (ok) cand.push(m);
      }
      var a1 = rng.next(), a2 = rng.next();
      if (lv === 3 && cand.length) {
        var f1 = Math.floor(a1 * cand.length); fl.push(cand[f1]);
        if (cand.length > 2) { var f2 = Math.floor(a2 * (cand.length - 1)); if (f2 >= f1) f2++; fl.push(cand[f2]); }
        fl.sort(function (x, y) { return x - y; });
      }
      beats.push(bl); fakes.push(fl);
    }
    /* ───── eventos de la playa, sembrados DESPUÉS del tambor (no le cambian los golpes): malta (golpe dorado), olas y cangrejos ───── */
    var EV = [], e0, lo, hi, z0;
    function libre(rq, tm, sep) {
      var z;
      for (z = 0; z < EV.length; z++) if (EV[z].r === rq && Math.abs(EV[z].t - tm) < sep) return false;
      for (z = 0; z < fakes[rq].length; z++) if (Math.abs(fakes[rq][z] - tm) < 300) return false;
      return true;
    }
    for (r = 0; r < 3; r++) {
      var bl2 = beats[r], L = bl2.length, b0 = msOf(TS[r]), lenMs = msOf(len);
      if (L >= 3) { lo = Math.max(1, Math.floor(L * 0.35)); hi = Math.max(lo, L - 2); j = lo + Math.floor(rng.next() * (hi - lo + 1)); EV.push({ ty: 'malta', r: r, t: bl2[j], j: j }); }
      if (r >= 1) {
        var no = r === 2 ? 2 : 1, s0 = rng.next() < 0.5 ? 0 : 1;
        for (q2 = 0; q2 < no; q2++) EV.push({ ty: 'ola', r: r, t: b0 + Math.round(lenMs * ((r === 2 ? (q2 ? 0.62 : 0.24) : 0.4) + rng.next() * 0.14)), sd: q2 ? 1 - s0 : s0 });
        var c0 = rng.next() < 0.5 ? 0 : 1;
        for (q2 = 0; q2 < no; q2++) {
          var sdC = q2 ? 1 - c0 : c0, mem = [], cnd = [];
          for (p = 0; p < n; p++) if (side[p] === sdC) mem.push(p);
          var tgt = mem.length ? mem[Math.floor(rng.next() * mem.length)] : 0, pick = rng.next();
          for (j = 1; j < L - 1; j++) { var mm = Math.round((bl2[j] + bl2[j + 1]) / 2); if (mm - b0 > Math.min(900, lenMs * 0.3) && libre(r, mm, 700)) cnd.push(mm); }
          if (cnd.length) EV.push({ ty: 'cang', r: r, t: cnd[Math.floor(pick * cnd.length)], p: tgt });
        }
        /* PERRO: se cuelga del mecate de un lado en un golpe; si ese equipo no responde con un tirón DOBLE en ese golpe, arrastra la cuerda */
        var sp0 = rng.next() < 0.5 ? 0 : 1, usados = [];
        for (z0 = 0; z0 < EV.length; z0++) if (EV[z0].r === r && EV[z0].ty === 'malta') usados.push(EV[z0].j);
        for (q2 = 0; q2 < no; q2++) {
          var jd = 2 + Math.floor(rng.next() * Math.max(1, L - 4)), g2 = 0;
          while (g2++ < L && (usados.indexOf(jd) >= 0 || usados.indexOf(jd - 1) >= 0 || usados.indexOf(jd + 1) >= 0 || jd > L - 2)) jd = jd + 1 > L - 2 ? 2 : jd + 1;
          if (jd < 0 || jd >= L || usados.indexOf(jd) >= 0) continue;
          usados.push(jd); EV.push({ ty: 'perro', r: r, t: bl2[jd], j: jd, sd: q2 ? 1 - sp0 : sp0 });
        }
      }
    }
    for (r = 1; r < 3; r++) {                              /* RACHAS DE VIENTO (sembradas al final: no cambian lo demás) */
      var nw = r === 2 ? 2 : 1, ws = rng.next() < 0.5 ? 0 : 1;
      for (q2 = 0; q2 < nw; q2++) EV.push({ ty: 'viento', r: r, t: msOf(TS[r]) + Math.round(msOf(len) * ((r === 2 ? (q2 ? 0.66 : 0.4) : 0.58) + rng.next() * 0.06)), sd: q2 ? 1 - ws : ws });
    }
    EV.sort(function (a, b) { return a.t - b.t; });
    for (j = 0; j < EV.length; j++) EV[j].id = j;
    var maltaDe = [-1, -1, -1];                           // índice del golpe dorado por tanda
    for (j = 0; j < EV.length; j++) { e0 = EV[j]; if (e0.ty === 'malta') maltaDe[e0.r] = e0.j; }

    /* ───── estado autoritativo ───── */
    /* rch/rb: racha de dobles seguidos por lado y el último golpe doble · bc: golpes de la tanda ya cerrados (descanso dado) · evD/evA/evB: máscaras de eventos resueltos
       (evA: malta para el lado 1 / cangrejo que mordió; evB: malta que nadie clavó) · por asiento: grip (agarre 0..5) y dodge (máscara de cangrejos saltados) */
    var st = { k: 0, pos: 0, res: [SENT, SENT, SENT], rch: [0, 0], rb: [-9, -9], bc: 0, evD: 0, evA: 0, evB: 0, s: [] };
    for (p = 0; p < MAXP; p++) st.s.push({ last: 0, used: -1, stun: 0, e: [0, 0, 0], pulls: 0, fouls: 0, grip: GMAX, dodge: 0 });
    var queue = [], dobles = [0, 0], offEma = [null, null, null, null], latMs = [-1, -1, -1, -1], seenT = [-1, -1, -1, -1];
    var cpr = []; for (p = 0; p < n; p++) cpr.push({ rnd: c.rngFor('cpu' + p), round: -1, plan: [], seen: -1, fseen: -1, cs: 0 });
    var asiento = function (pp) { return (c.seats && c.seats[pp]) || { name: 'P' + (pp + 1), color: '#fff', ch: null }; };
    function teamOfSide(sd) { return sd === 0 ? tL : tR; }
    function sideColor(sd) { var t = teamOfSide(sd); return COL_EQ[t === 1 ? 1 : 0]; }
    function sideName(sd) { var t = teamOfSide(sd); return NOM_EQ[t === 1 ? 1 : 0]; }
    function curRound(k) { for (var q = 0; q < 3; q++) if (k >= TS[q] && k <= FIN[q]) return q; return -1; }
    function roundOfMs(ms) { for (var q = 0; q < 3; q++) if (ms >= msOf(TS[q]) && ms <= msOf(TE[q])) return q; return -1; }
    function nearest(bl, ms) { var b = -1, bd = 1e9, q; for (q = 0; q < bl.length; q++) { var d = Math.abs(bl[q] - ms); if (d < bd) { bd = d; b = q; } } return { j: b, d: bd }; }
    function enc(j, off, m) { return (((j + 1) * 1024 + cl(off, -500, 500) + 512) * 2) + m; }      // golpe j+1 · desfase (−500..500 ms) · bit «ya fue doble»
    function decIdx(e) { return Math.floor(Math.floor(e / 2) / 1024) - 1; }
    function decOff(e) { return (Math.floor(e / 2) % 1024) - 512; }
    function mtOf(s) { return s.e[0] & 1; }
    function inMud() { var r3 = curRound(st.k) === 2; return (lv === 2 || r3) && Math.abs(st.pos) < (r3 ? MUD3 : MUD); }
    function usoGolpe(s, jj) { for (var z = 0; z < 3; z++) if (s.e[z] !== 0 && decIdx(s.e[z]) === jj) return true; return false; }
    function cangDe(p, t, rq) { for (var z = 0; z < EV.length; z++) { var ev = EV[z]; if (ev.ty === 'cang' && ev.r === rq && ev.p === p && Math.abs(t - ev.t) <= dodgeMs) return z; } return -1; }
    function fase() { var cr = curRound(st.k); if (cr === 2 || c.ahora() >= dur * 0.7) return 2; if (st.k >= TS[1]) return 1; return 0; }
    function bit(m, q) { return (m >> q) & 1; }

    /* mmi retraso de entrada (juez humano): c.fair() si el runtime lo da; si no, se estima con la latencia medida de los xtir de los rivales (misma fórmula que fairDelayEq) */
    function fairMs() {
      if (typeof c.fair === 'function') { var v = +c.fair(); if (v >= 0) return Math.round(Math.min(500, v * 1000)); }
      var ls = [], q;
      for (q = 0; q < n; q++) if (side[q] !== side[c.yo] && !c.cpu[q] && latMs[q] >= 0) ls.push(latMs[q]);
      if (!ls.length) return 0;
      ls.sort(function (a, b) { return a - b; });
      var f = Math.min(120, ls[Math.floor(ls.length / 2)]);
      return Math.round(Math.min(500, 2 * f + 40));
    }

    /* ───────────────────────── reglas (solo juez) ───────────────────────── */
    function resetRound() {
      st.pos = 0; st.bc = 0; st.rch[0] = 0; st.rch[1] = 0; st.rb[0] = -9; st.rb[1] = -9;
      for (var q = 0; q < MAXP; q++) { var s = st.s[q]; s.used = -1; s.stun = 0; s.e[0] = 0; s.e[1] = 0; s.e[2] = 0; s.grip = GMAX; }
    }
    function pullFor(p, amt) { st.pos = cl(st.pos + (side[p] === 0 ? amt : -amt), -POS_MAX, POS_MAX); }
    function pullSide(sd, amt) { st.pos = cl(st.pos + (sd === 0 ? amt : -amt), -POS_MAX, POS_MAX); }
    function applyPull(p, t) {
      var s = st.s[p]; if (!s || t <= s.last) return;
      s.last = t;
      var rr0 = curRound(st.k), rt = roundOfMs(t);
      if (rr0 < 0 || rt !== rr0) return;                        // entre tandas, o de una tanda ya cerrada: no cuenta
      if (t < s.stun) return;                                   // aturdido: no hala (ni se castiga de nuevo)
      var cg = cangDe(p, t, rt), salto = false;                 // el cangrejo que viene por MIS pies: pulsar en su marca es saltar, no un error
      if (cg >= 0 && !bit(s.dodge, cg)) { s.dodge = s.dodge | (1 << cg); salto = true; }
      var nb = nearest(beats[rt], t);
      if (nb.j >= 0 && nb.d <= winMs && nb.j > s.used) {
        s.used = nb.j;
        if (s.grip <= 0) { pullFor(p, -RESB); return; }         // sin agarre: la cuerda SE RESBALA hacia el rival (gastó el golpe; cuenta como descanso)
        s.pulls++;
        var amt = s.grip >= 3 ? PULL : FLOJO, m = mate[p], sd = side[p];
        s.grip--;
        var off = t - beats[rt][nb.j], mt = 0, ms = m >= 0 ? st.s[m] : null, z;
        if (ms) for (z = 0; z < 3; z++) {                       // el tirón del pana en ESTE MISMO golpe (puede llegar después del mío: se compara por sello, no por llegada)
          var ez = ms.e[z]; if (ez === 0 || decIdx(ez) !== nb.j || (ez & 1)) continue;
          if (Math.abs(off - decOff(ez)) <= dobleMs) {
            amt += DBL[rt]; ms.e[z] = ez + 1; mt = 1; dobles[sd]++;
            st.rch[sd] = st.rb[sd] === nb.j - 1 ? st.rch[sd] + 1 : 1; st.rb[sd] = nb.j;
            if (st.rch[sd] % 3 === 0) amt += JALON;             // ¡JALÓN! 3 dobles seguidos
          }
          break;
        }
        s.e[2] = s.e[1]; s.e[1] = s.e[0]; s.e[0] = enc(nb.j, off, mt);
        pullFor(p, amt);
        offEma[p] = offEma[p] === null ? (t - beats[rt][nb.j]) / 1000 : offEma[p] * 0.6 + 0.4 * (t - beats[rt][nb.j]) / 1000;
      } else if (!salto) {
        s.fouls++; s.stun = t + (inMud() ? STUN_MUD : STUN);
      }
    }
    /* descanso de las manos y eventos de la playa (solo juez; en step, con espera para los sellos que llegan tarde) */
    function playa(k, tickMs) {
      var r = curRound(k), q, p, s, e;
      if (r < 0) return;
      while (st.bc < beats[r].length && tickMs > beats[r][st.bc] + winMs + REG_D) {
        for (p = 0; p < n; p++) { s = st.s[p]; if (!usoGolpe(s, st.bc) && s.grip < GMAX) s.grip++; }
        st.bc++;
      }
      for (q = 0; q < EV.length; q++) {                      // viento: empuje continuo, sin estado
        e = EV[q]; if (e.ty === 'viento' && e.r === r && tickMs >= e.t && tickMs < e.t + WIND_MS && k < TE[r] && k % 3 === 0) pullSide(e.sd, 1);
      }
      for (q = 0; q < EV.length; q++) {
        e = EV[q]; if (e.ty === 'viento' || e.r !== r || bit(st.evD, q)) continue;
        if (e.ty === 'ola') {
          if (tickMs < e.t) continue;
          for (p = 0; p < n; p++) if (side[p] === e.sd) { s = st.s[p]; if (s.grip >= 3) s.grip -= 2; else { s.grip = 0; s.stun = Math.max(s.stun, e.t + STUN_OLA); } }
        } else if (e.ty === 'malta') {
          if (tickMs <= e.t + winMs + EV_D && k < FIN[r]) continue;
          var best = -1, bd = 1e9, z;
          for (p = 0; p < n; p++) for (z = 0; z < 3; z++) { var ez = st.s[p].e[z]; if (ez !== 0 && decIdx(ez) === e.j && (Math.abs(decOff(ez)) < bd || (Math.abs(decOff(ez)) === bd && ((e.id + p) & 1) === 0 && side[p] !== side[best]))) { bd = Math.abs(decOff(ez)); best = p; } }
          if (best >= 0) { pullFor(best, MALTA); for (p = 0; p < n; p++) if (side[p] === side[best]) st.s[p].grip = GMAX; if (side[best] === 1) st.evA = st.evA | (1 << q); }
          else st.evB = st.evB | (1 << q);
        } else if (e.ty === 'perro') {
          if (tickMs <= e.t + winMs + EV_D && k < FIN[r]) continue;
          var dbl = false, z2;
          for (p = 0; p < n; p++) if (side[p] === e.sd) for (z2 = 0; z2 < 3; z2++) { var ee = st.s[p].e[z2]; if (ee !== 0 && decIdx(ee) === e.j && (ee & 1)) dbl = true; }
          if (dbl) pullSide(e.sd, PERRO_OK); else { st.evA = st.evA | (1 << q); pullSide(e.sd, -PERRO); }
        } else {
          if (tickMs <= e.t + dodgeMs + EV_D && k < FIN[r]) continue;
          s = st.s[e.p];
          if (e.p < n && !bit(s.dodge, q)) { st.evA = st.evA | (1 << q); pullFor(e.p, -CANG); s.grip = Math.max(0, s.grip - 2); }
        }
        st.evD = st.evD | (1 << q);
      }
    }
    function pushQ(p, t) { queue.push({ p: p, t: t }); if (queue.length > QMAX) queue.shift(); }
    c.on('xtir', function (d, p) {
      if (!c.juez() || p === undefined || p < 0 || p >= n || p === c.yo || c.cpu[p] || !d || !d.t || typeof d.t.length !== 'number') return;
      var now = Math.round(c.ahora() * 1000), q2;
      for (q2 = 0; q2 < d.t.length && q2 < 3; q2++) {
        var t = +d.t[q2]; if (!(t >= 0) || t > now + 400) continue;
        if (t > seenT[p]) { seenT[p] = t; var L = now - t; if (L >= 0 && L < 1500) latMs[p] = latMs[p] < 0 ? L : latMs[p] + (L - latMs[p]) * 0.3; }
        pushQ(p, Math.round(t));
      }
    });
    function step() {
      var k = st.k, tickMs = msOf(k), q, p, e;
      for (q = 0; q < 3; q++) if (k === TS[q]) resetRound();
      for (p = 0; p < n; p++) {
        if (p === c.yo && !c.cpu[p]) { var tn = c.tap(p, 'a'); for (q = 0; q < tn && q < 3; q++) pushQ(p, Math.min(Math.round(c.ahora() * 1000), tickMs + 33) - fairMs() + q); }
        else if (c.cpu[p]) { var tc = c.tap(p, 'a'); for (q = 0; q < tc && q < 2; q++) pushQ(p, tickMs + q); }
      }
      queue.sort(function (a, b) { return a.t - b.t || a.p - b.p; });
      var keep = [];
      for (q = 0; q < queue.length; q++) { e = queue[q]; if (e.t > tickMs + 16) keep.push(e); else applyPull(e.p, e.t); }
      queue = keep;
      playa(k, tickMs);
      for (q = 0; q < 3; q++) if (k === FIN[q]) st.res[q] = cl(st.pos, -POS_MAX, POS_MAX);
      st.k++;
    }

    /* ───────────────────────── puntaje ───────────────────────── */
    function tally() {
      var w = [0, 0], adv = [0, 0], q, v;
      for (q = 0; q < 3; q++) { v = st.res[q]; if (v === SENT) continue; if (v > 0) { w[0] += PESO[q]; adv[0] += v; } else if (v < 0) { w[1] += PESO[q]; adv[1] -= v; } }
      return { w: w, adv: adv };
    }
    function scSide(sd, tl) { return tl.w[sd] * U + Math.min(U - 1, Math.floor(tl.adv[sd] / ADVU)); }
    function scores() { var tl = tally(), a = [], q; for (q = 0; q < n; q++) a.push(scSide(side[q], tl)); return a; }
    function allDone() { return st.res[0] !== SENT && st.res[1] !== SENT && st.res[2] !== SENT; }

    /* ───────────────────────── snapshot ───────────────────────── */
    function pack() {
      var a = [st.k, st.pos, st.res[0], st.res[1], st.res[2], st.rch[0], st.rch[1], st.rb[0], st.rb[1], st.bc, st.evD, st.evA, st.evB], q, s;
      for (q = 0; q < MAXP; q++) { s = st.s[q]; a.push(s.last, s.used, s.stun, s.e[0], s.e[1], s.e[2], s.pulls, s.fouls, s.grip, s.dodge); }
      return a;
    }
    function load(a) {
      if (!a || a.length < PACKN) return;
      st.k = a[0] | 0; st.pos = a[1] | 0; st.res[0] = a[2] | 0; st.res[1] = a[3] | 0; st.res[2] = a[4] | 0;
      st.rch[0] = a[5] | 0; st.rch[1] = a[6] | 0; st.rb[0] = a[7] | 0; st.rb[1] = a[8] | 0; st.bc = a[9] | 0; st.evD = a[10] | 0; st.evA = a[11] | 0; st.evB = a[12] | 0;
      for (var q = 0; q < MAXP; q++) {
        var o = G0 + PS * q, s = st.s[q]; s.last = a[o] | 0; s.used = a[o + 1] | 0; s.stun = a[o + 2] | 0; s.e[0] = a[o + 3] | 0; s.e[1] = a[o + 4] | 0; s.e[2] = a[o + 5] | 0;
        s.pulls = a[o + 6] | 0; s.fouls = a[o + 7] | 0; s.grip = a[o + 8] | 0; s.dodge = a[o + 9] | 0;
      }
    }
    function lerp(a, b, u) {
      var out = b.slice();
      if (Math.abs(b[1] - a[1]) < 120 && b[0] - a[0] < TK * 2 && b[0] >= a[0]) out[1] = Math.round(a[1] + (b[1] - a[1]) * u);
      return out;
    }

    /* ───────────────────────── CPU ───────────────────────── */
    // Una CPU planea cada golpe de tambor con ≤1 s de antelación: lo salta con prob. 0,30·(1−skill), y si no, pulsa en golpe + error N(0, σ), σ = 0,11·(1,15−skill) s (σ .3 → .09; .9 → .03).
    // Con pana humano: con prob. 0,5+0,35·skill copia el desfase medio de su pana (lo acompaña para que el tirón sea doble). El falso tambor del Nv3 la engaña con prob. 0,5·(1−skill).
    function gauss(r) { return (r.next() + r.next() + r.next() - 1.5) * 2; }
    function ai(pp, dt, api) {
      var A = cpr[pp], sk = (c.skill && typeof c.skill[pp] === 'number') ? c.skill[pp] : 0.6, now = c.ahora(), nowMs = now * 1000, rr0 = roundOfMs(nowMs + 600), q, fireAt;
      api.hold('a', false); api.eje(0, 0);
      if (rr0 < 0) { A.round = -1; A.plan = []; return; }
      if (A.round !== rr0) { A.round = rr0; A.plan = []; A.seen = -1; A.fseen = -1; }
      var sig = 0.11 * (1.15 - sk), m = mate[pp], bias = null;
      if (m >= 0 && !c.cpu[m] && offEma[m] !== null && A.rnd.next() < 0.5 + 0.35 * sk) bias = offEma[m];
      for (q = A.seen + 1; q < beats[rr0].length; q++) {
        if (beats[rr0][q] - nowMs > 1000) break;
        A.seen = q;
        if (beats[rr0][q] < nowMs - 80) continue;
        if (A.rnd.next() < 0.3 * (1 - sk)) continue;
        var off = bias !== null ? bias + gauss(A.rnd) * sig * 0.5 : gauss(A.rnd) * sig;
        A.plan.push({ t: beats[rr0][q] + off * 1000, k: 0 });
      }
      for (q = A.fseen + 1; q < fakes[rr0].length; q++) {
        if (fakes[rr0][q] - nowMs > 1000) break;
        A.fseen = q;
        if (A.rnd.next() < 0.5 * (1 - sk)) A.plan.push({ t: fakes[rr0][q] + gauss(A.rnd) * sig * 1000, k: 0 });
      }
      for (q = 0; q < EV.length; q++) {                        // el cangrejo que viene por mí: salta (mejor cuanto más hábil)
        var ev = EV[q]; if (ev.ty !== 'cang' || ev.p !== pp || ev.r !== rr0 || bit(A.cs, q) || ev.t - nowMs > 1000) continue;
        A.cs = A.cs | (1 << q);
        if (A.rnd.next() < 0.5 + 0.45 * sk) A.plan.push({ t: ev.t + gauss(A.rnd) * sig * 800, k: 1 });
      }
      fireAt = nowMs + 1000 / TK / 2;
      for (q = A.plan.length - 1; q >= 0; q--) if (A.plan[q].t <= fireAt) {
        var pl = A.plan[q]; A.plan.splice(q, 1);
        if (st.s[pp].stun > nowMs) continue;
        if (pl.k === 0 && !perroEn(pp, pl.t) && descansa(pp, A, sk, nowMs)) continue;
        api.press('a');
      }
    }
    function perroEn(pp, tm) { for (var q = 0; q < EV.length; q++) if (EV[q].ty === 'perro' && EV[q].sd === side[pp] && Math.abs(EV[q].t - tm) < winMs * 2) return true; return false; }
    /* ¿la CPU deja pasar este golpe para descansar las manos? sin agarre casi siempre; con una ola encima y poco agarre, si es hábil; con 1-2, a veces */
    function descansa(pp, A, sk, nowMs) {
      var g = st.s[pp].grip, ola = false, q;
      for (q = 0; q < EV.length; q++) if (EV[q].ty === 'ola' && EV[q].sd === side[pp] && EV[q].t > nowMs && EV[q].t - nowMs < 1700) ola = true;
      if (g <= 0) return A.rnd.next() < 0.35 + 0.6 * sk;
      if (ola && g < 4) return A.rnd.next() < 0.2 + 0.7 * sk;
      if (g <= 2) return A.rnd.next() < 0.45 * sk;
      return false;
    }

    /* ───────────────────────── presentación ───────────────────────── */
    var at = 0, myStamps = [], resendAt = -1, loc = { r: -1, used: -1, stun: 0 }, flash = null, flashT = 0, fxs = [], prevPulls = [0, 0, 0, 0], prevFouls = [0, 0, 0, 0], prevMt = [0, 0, 0, 0];
    var prevBeat = -1, prevFake = -1, prevRes = [SENT, SENT, SENT], banner = null, bannerT = 0, gagDone = [false, false, false], lastDbl = [-9, -9, -9, -9];
    function isJudge() { return c.juez(); }
    function banr(s, col, t) { banner = { s: s, col: col }; bannerT = t || 1.6; }
    function addFx(p, kind) {
      if (kind === 'dbl') { var q;                     // un solo «¡DOBLE!» por pareja, al medio entre los dos panas
        for (q = 0; q < fxs.length; q++) if (fxs[q].kind === 'dbl' && fxs[q].t < 0.4 && (fxs[q].p === mate[p] || fxs[q].p === p)) return;
      }
      fxs.push({ p: p, kind: kind, t: 0 }); if (fxs.length > 14) fxs.shift();
    }
    function localPress(ms) {              // respuesta inmediata en la pantalla de quien pulsa (el juez confirma después)
      var rt = roundOfMs(ms);
      if (rt < 0) { flash = { s: '', col: '#fff' }; flashT = 0; return; }
      if (loc.r !== rt) { loc.r = rt; loc.used = -1; loc.stun = 0; }
      if (ms < loc.stun) return;
      var nb = nearest(beats[rt], ms), salto = cangDe(c.yo, ms, rt) >= 0, g = st.s[c.yo] ? st.s[c.yo].grip : GMAX;
      if (nb.j >= 0 && nb.d <= winMs && nb.j > loc.used) {
        loc.used = nb.j;
        if (g <= 0) flash = { s: '¡SE TE RESBALA! DESCANSA', col: '#ffb03a' };
        else flash = { s: nb.d <= winMs * 0.45 ? (nb.j === maltaDe[rt] ? '¡PERFECTO! ¡LA MALTA!' : '¡PERFECTO!') : (g < 3 ? 'FLOJO…' : '¡BIEN!'), col: g < 3 ? '#ffe14d' : '#7dff9a' };
        if (v3) V3.sfx('pop'); else SND(520, 0.05, 'square', 0.05, 80);
      } else if (salto) { flash = { s: '¡SALTASTE!', col: '#7dff9a' }; if (v3) V3.sfx('salto'); else SND(660, 0.08, 'square', 0.05, 300); }
      else { loc.stun = ms + STUN; flash = { s: '¡FUERA DE COMPÁS!', col: '#ff6b6b' }; if (v3) V3.sfx('error'); else SND(120, 0.12, 'sawtooth', 0.06, 0); }
      flashT = 0.7;
    }
    /* avisos de la playa: por la hora de la partida (el calendario es el mismo en todas las pantallas) y por diferencia de estado (lo que resolvió el juez) */
    var avisado = 0, prevEvD = 0, prevRch = [0, 0], prevUsed = [-1, -1, -1, -1], prevCr = -2, frenesiDicho = false;
    function nomP(p) { return p === c.yo ? 'TI' : String(asiento(p).name || 'P' + (p + 1)).toUpperCase().slice(0, 9); }
    function ladoTxt(sd) { return sd === 0 ? 'LA IZQUIERDA' : 'LA DERECHA'; }
    function playaFx(nowMs) {
      var q, e, p, tele;
      for (q = 0; q < EV.length; q++) {
        e = EV[q]; tele = e.ty === 'malta' ? 1500 : 1300;
        if (bit(avisado, q) || nowMs < e.t - tele || nowMs >= e.t) continue;
        avisado = avisado | (1 << q);
        if (e.ty === 'ola') { banr('¡OLA POR ' + ladoTxt(e.sd) + '! ¡DESCANSA Y AGARRA DURO!', '#8fe0ff', 1.6); if (v3) V3.sfx('viento'); else SND(90, 0.5, 'sawtooth', 0.04, -40); }
        else if (e.ty === 'cang') { banr(e.p === c.yo ? '¡CANGREJO! PULSA EN LA MARCA ROJA PA\' SALTAR' : '¡UN CANGREJO VA PA\' ' + nomP(e.p) + '!', '#ff7a5c', 1.5); if (v3) V3.sfx('silbido'); else SND(880, 0.06, 'square', 0.04, -200); }
        else if (e.ty === 'viento') { banr('¡RACHA DE VIENTO! LA CUERDA SE VA PA\' EL ' + sideName(e.sd) + (e.sd === side[c.yo] ? '' : ' · ¡HALEN DURO!'), '#dff4ff', 1.8); if (v3) V3.sfx('viento'); else SND(110, 0.7, 'sawtooth', 0.04, -30); }
        else if (e.ty === 'perro') { banr(e.sd === side[c.yo] ? '¡PERRO EN TU MECATE! ¡TIRÓN DOBLE EN EL GOLPE MARRÓN!' : '¡UN PERRO VA PA\' EL MECATE DEL ' + sideName(e.sd) + '!', '#e0a060', 1.6); if (v3) V3.sfx('silbido'); else SND(300, 0.1, 'sawtooth', 0.05, -100); }
        else { banr('¡MALTA EN EL GOLPE DORADO! CLÁVALO', '#ffd23f', 1.5); if (v3) V3.sfx('ding'); else SND(990, 0.08, 'triangle', 0.05, 200); }
      }
      for (q = 0; q < EV.length; q++) {
        if (!bit(st.evD, q) || bit(prevEvD, q)) continue;
        e = EV[q];
        if (e.ty === 'ola') {
          var cae = 0; for (p = 0; p < n; p++) if (side[p] === e.sd && st.s[p].stun >= e.t + STUN_OLA - 40) cae++;
          banr(cae ? '¡LA OLA REVOLCÓ A ' + sideName(e.sd) + '!' : '¡' + sideName(e.sd) + ' AGUANTÓ LA OLA!', cae ? '#8fe0ff' : sideColor(e.sd), 1.4);
          if (v3) ola3(e); else SND(70, 0.4, 'sawtooth', 0.05, -20);
        } else if (e.ty === 'perro') {
          var gano = bit(st.evA, q);
          banr(gano ? '¡EL PERRO ARRASTRÓ EL MECATE DEL ' + sideName(e.sd) + '!' : '¡' + sideName(e.sd) + ' ESPANTÓ AL PERRO!', gano ? '#ff6b6b' : sideColor(e.sd), 1.4);
          if (v3) perro3(e, gano); else SND(gano ? 120 : 800, 0.12, 'square', 0.05, gano ? -60 : 200);
        } else if (e.ty === 'malta') {
          if (bit(st.evB, q)) banr('NADIE CLAVÓ LA MALTA', '#c9c4dd', 1.2);
          else { var ms = bit(st.evA, q) ? 1 : 0; banr('¡MALTA PA\'L ' + sideName(ms) + '! AGARRE LLENO', sideColor(ms), 1.6); if (v3) malta3(ms); else SND(1200, 0.12, 'square', 0.06, 300); }
        } else {
          var mordio = bit(st.evA, q);
          banr(mordio ? '¡EL CANGREJO MORDIÓ A ' + nomP(e.p) + '!' : '¡' + nomP(e.p) + ' SALTÓ EL CANGREJO!', mordio ? '#ff6b6b' : '#7dff9a', 1.3);
          if (v3) cang3(e, mordio); else SND(mordio ? 140 : 700, 0.1, 'square', 0.05, mordio ? -60 : 200);
        }
      }
      prevEvD = st.evD;
    }
    function update(dt) {
      update0(dt);
      var nowMs = Math.round(c.ahora() * 1000), cr = curRound(st.k), sd, p;
      playaFx(nowMs);
      /* escalada: banner al empezar cada tanda y al entrar en los últimos segundos */
      var enT = cr >= 0 && st.k < TE[cr] ? cr : -1;
      if (enT !== prevCr) {
        if (enT === 0) banr('TANDA 1 · ¡AGARRA EL RITMO!', '#fffdf2', 1.6);
        else if (enT === 1) banr('TANDA 2 · ¡EL TAMBOR SE ACELERA!', '#ffd23f', 1.8);
        else if (enT === 2) { banr('¡ÚLTIMA TANDA: VALE DOBLE!', '#ff8a3d', 2); if (v3) { V3.sfx('bocina'); v3.esc.sacudir(0.6); } }
        prevCr = enT;
      }
      if (!frenesiDicho && enT === 2 && c.ahora() >= dur * 0.75) { frenesiDicho = true; banr('¡ÚLTIMOS SEGUNDOS! ¡HALEN!', '#ff5c5c', 1.6); if (v3) { V3.sfx('latido'); v3.esc.sacudir(0.8); } }
      /* racha de dobles y resbalones */
      for (sd = 0; sd < 2; sd++) {
        if (st.rch[sd] > prevRch[sd] && st.rch[sd] >= 2) {
          if (st.rch[sd] % 3 === 0) { banr('¡JALÓN DEL ' + sideName(sd) + '!', sideColor(sd), 1.4); if (v3) { V3.sfx('golpe'); v3.esc.sacudir(0.9); v3.tens = 2.2; v3.cheer[sd] = 2; } }
          else if (st.rch[sd] % 3 === 2 && side[c.yo] === sd) S_('¡UNA MÁS JUNTOS Y ES JALÓN!', (c.campo().x0 + c.campo().x1) / 2, 190, '#ffd23f');
        }
        prevRch[sd] = st.rch[sd];
      }
      for (p = 0; p < n; p++) {
        var s = st.s[p];
        if (s.used > prevUsed[p] && s.used >= 0 && s.pulls === prevPulls2[p] && s.fouls === prevFouls2[p]) { addFx(p, 'resb'); if (v3 && v3.pjs[p]) v3.pjs[p].pj.uno('golpe'); }
        prevUsed[p] = s.used; prevPulls2[p] = s.pulls; prevFouls2[p] = s.fouls;
      }
    }
    var prevPulls2 = [0, 0, 0, 0], prevFouls2 = [0, 0, 0, 0];
    function update0(dt) {
      at += dt; bannerT = Math.max(0, bannerT - dt); flashT = Math.max(0, flashT - dt);
      var now = c.ahora(), nowMs = Math.round(now * 1000), q, p;
      /* no-juez: sella y manda MIS pulsaciones (el juez las suma por sello, no por llegada) */
      if (!isJudge() && c.yo >= 0 && c.yo < n && !c.cpu[c.yo]) {
        var tn = c.tap(c.yo, 'a');
        if (tn > 0 && nowMs >= 0) {
          for (q = 0; q < tn && q < 3; q++) { var stamp = nowMs + q; myStamps.push(stamp); localPress(stamp); }
          while (myStamps.length > 3) myStamps.shift();
          c.send('xtir', { t: myStamps.slice() }, true); resendAt = at + 0.2;
        } else if (resendAt >= 0 && at >= resendAt) { resendAt = -1; if (myStamps.length) c.send('xtir', { t: myStamps.slice() }, true); }
      }
      /* tambor local: suena en cada golpe (también el falso, distinto) */
      var rr0 = roundOfMs(nowMs), bi = -1;
      if (rr0 >= 0) { for (q = 0; q < beats[rr0].length; q++) if (beats[rr0][q] <= nowMs) bi = rr0 * 100 + q; }
      if (bi !== prevBeat && bi >= 0) { if (v3) { V3.sfx('tambor'); v3.golpe = 1; v3.palo = 1 - v3.palo; if (rr0 === 2) v3.esc.sacudir(.15); } else SND(bi % 2 ? 150 : 190, 0.06, 'triangle', 0.07, 40); }
      prevBeat = bi;
      var fi = -1;                                                  /* el falso tambor del Nv3: en 3D el cuero se pone gris y suena distinto (¡no se tira!) */
      if (rr0 >= 0) { for (q = 0; q < fakes[rr0].length; q++) if (fakes[rr0][q] <= nowMs) fi = rr0 * 100 + q; }
      if (fi !== prevFake && fi >= 0 && v3) { V3.sfx('tic'); v3.falso = 1; }
      prevFake = fi;
      /* efectos por diferencia de estado (valen igual en el juez y en las pantallas que interpolan) */
      for (p = 0; p < n; p++) {
        var s = st.s[p], mine = p === c.yo && !isJudge();
        if (s.fouls > prevFouls[p]) { if (!mine) addFx(p, 'foul'); if (v3) fx3(p, 'foul'); }
        if (s.pulls > prevPulls[p]) { if (!mine) addFx(p, 'ok'); if (v3) fx3(p, 'ok'); }
        if (mtOf(s) === 1 && (prevMt[p] === 0 || s.pulls > prevPulls[p]) && at - lastDbl[p] > 0.25) { addFx(p, 'dbl'); lastDbl[p] = at; if (v3) fx3(p, 'dbl'); else if (p === c.yo) SND(760, 0.08, 'square', 0.06, 200); }
        prevPulls[p] = s.pulls; prevFouls[p] = s.fouls; prevMt[p] = mtOf(s);
      }
      for (q = fxs.length - 1; q >= 0; q--) { fxs[q].t += dt; if (fxs[q].t > 0.8) fxs.splice(q, 1); }
      for (q = 0; q < 3; q++) if (st.res[q] !== SENT && prevRes[q] === SENT) {
        var v = st.res[q], sd = v > 0 ? 0 : 1;
        if (v === 0) banr('¡TANDA EMPATADA!', '#ffd23f', 2.4); else { banr('¡TANDA PARA ' + sideName(sd) + '!', sideColor(sd), 2.6); }
        if (v3) fin3(v); else if (v !== 0) { SPAWN(c.campo().x0 + (c.campo().x1 - c.campo().x0) / 2, 260, 18, 'conf', ['#ffd23f', '#fffdf2', '#ff5c8a', '#4fd06a'], 300, 400, 0.9); SND(900, 0.25, 'square', 0.08, 300); }
        prevRes[q] = st.res[q];
      }
      for (q = 0; q < 3; q++) if (st.k > TS[q] && st.k < TE[q] && !gagDone[q] && c.yo >= 0 && c.yo < n) {      // el gag: el equipo propio va perdiendo feo
        var mi = side[c.yo], dd = mi === 0 ? -st.pos : st.pos;
        if (dd > 60) { gagDone[q] = true; S_('¡HALEN, HALEN, QUE EL COMPADRE SE ESTÁ QUEDANDO!', (c.campo().x0 + c.campo().x1) / 2, 214, '#fffdf2'); }
      }
    }

    /* ───────────────────────── dibujo ───────────────────────── */
    function lay() {
      var f = c.campo();
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width, y0: f.y0, y1: f.y1 };
      var vw = f.x1 - f.x0;
      return { f: f, vw: vw, cx: (f.x0 + f.x1) / 2, zs: cl(vw / 410, 0.74, 1.35), gy: vw < 520 ? 392 : 338 };
    }
    function fondo(l) {
      var f = l.f, x0 = f.x0, w = l.vw, k;
      rr(x0, 0, w, 150, 0, pal.cielo, 0);
      if (lv === 3) { for (k = 0; k < 14; k++) ell(x0 + ((k * 151) % w), 10 + (k * 29) % 90, 2, 2, '#fffdf2', 0); ell(x0 + w - 70, 60, 20, 20, pal.sol, 0); }
      else ell(lv === 1 ? x0 + w - 70 : x0 + 70, lv === 1 ? 60 : 118, 26, 26, pal.sol, 0);
      rr(x0, 150, w, 44, 0, pal.mar, 0);
      for (k = 0; k < Math.ceil(w / 60); k++) line([[x0 + k * 60 + 8, 168 + (k % 2) * 10], [x0 + k * 60 + 30, 164 + (k % 2) * 10], [x0 + k * 60 + 52, 168 + (k % 2) * 10]], 2, '#fffdf2');
      rr(x0, 194, w, 460, 0, pal.arena, 0);
      line([[x0, 194], [x0 + w, 194]], 3, INK);
      if (lv === 3) { var fx = x0 + 34, fy = l.gy + 20; poly([[fx - 10, fy + 14], [fx, fy - 6], [fx + 10, fy + 14]], '#ff8a3d', 2.5); poly([[fx - 5, fy + 14], [fx, fy + 2], [fx + 5, fy + 14]], '#ffd23f', 0); }
    }
    function teamPos(l) {                     // x de cada asiento en pantalla (según la cuerda actual)
      var kx = l.cx - cl(st.pos, -110, 110) / 100 * (l.vw * 0.15), out = [], cnt = [0, 0], q;
      for (q = 0; q < n; q++) { var sd = side[q], j = cnt[sd]++; out.push({ x: kx + (sd === 0 ? -1 : 1) * (62 + 52 * j) * l.zs, kx: kx }); }
      return out;
    }
    function carga(l) {                       // el carril del tambor
      var lw = Math.min(l.vw - 24, 520), lx = l.cx - lw / 2, ly = 134, lh = 34, hitX = lx + lw * 0.24, pxs = (lx + lw - 10 - hitX) / 2.0;
      var nowMs = c.ahora() * 1000, rr0 = roundOfMs(nowMs + 2200), q, tt;
      rr(lx, ly, lw, lh, 10, '#2b2540', 3);
      var ww = winMs * pxs / 1000, near = false;
      if (rr0 >= 0) for (q = 0; q < beats[rr0].length; q++) if (Math.abs(beats[rr0][q] - nowMs) <= winMs) near = true;
      rr(hitX - ww, ly + 3, ww * 2, lh - 6, 6, near ? '#7a6bd0' : '#4a4070', 0);
      line([[hitX, ly - 2], [hitX, ly + lh + 2]], 3, '#fffdf2');
      for (tt = 0; tt < 3; tt++) if (tt === rr0 || roundOfMs(nowMs + 2200) === tt || roundOfMs(nowMs - 600) === tt) {
        var bl = beats[tt], fl = fakes[tt];
        for (q = 0; q < bl.length; q++) {
          var dx = (bl[q] - nowMs) / 1000 * pxs, x = hitX + dx;
          if (x < lx + 8 || x > lx + lw - 8) continue;
          if (q === maltaDe[tt]) { ell(x, ly + lh / 2, 13, 13, dx < -winMs * pxs / 1000 ? '#8a7a40' : '#ff9a1a', 3); txt('M', x, ly + lh / 2 + 1, 12, INK, 0, true); }
          else ell(x, ly + lh / 2, 9, 9, dx < -winMs * pxs / 1000 ? '#8a7a40' : '#ffd23f', 3);
        }
        for (q = 0; q < EV.length; q++) if (EV[q].ty === 'cang' && EV[q].r === tt) {          /* la marca del cangrejo: SOLO su objetivo salta ahí */
          var dx3 = (EV[q].t - nowMs) / 1000 * pxs, x3 = hitX + dx3, mio = EV[q].p === c.yo;
          if (x3 < lx + 8 || x3 > lx + lw - 8) continue;
          poly([[x3 - 9, ly + lh / 2 + 6], [x3, ly + lh / 2 - 9], [x3 + 9, ly + lh / 2 + 6]], mio ? '#ff4a3a' : '#7a4040', 2.5);
          if (mio && dx3 > -20) txt('¡SALTA!', x3, ly - 8, 11, '#ff7a5c', 0, true);
        }
        for (q = 0; q < EV.length; q++) if (EV[q].ty === 'perro' && EV[q].r === tt) {
          var dx4 = (EV[q].t - nowMs) / 1000 * pxs, x4 = hitX + dx4, mio2 = c.yo >= 0 && c.yo < n && EV[q].sd === side[c.yo];
          if (x4 < lx + 8 || x4 > lx + lw - 8) continue;
          ell(x4, ly + lh / 2, 12, 12, mio2 ? '#b0703a' : '#6a5040', 3); txt('G', x4, ly + lh / 2 + 1, 11, '#fffdf2', 0, true);
          ell(x4, ly + lh + 7, 3, 3, sideColor(EV[q].sd), 0);
          if (mio2 && dx4 > -20 && dx4 < 200) txt('¡JUNTOS!', x4, ly - 8, 11, '#e0a060', 0, true);
        }
        for (q = 0; q < fl.length; q++) {
          var dx2 = (fl[q] - nowMs) / 1000 * pxs, x2 = hitX + dx2;
          if (x2 < lx + 8 || x2 > lx + lw - 8) continue;
          ell(x2, ly + lh / 2, 9, 9, '#c9c4dd', 2.5); line([[x2 - 4, ly + lh / 2 - 4], [x2 + 4, ly + lh / 2 + 4]], 2, '#d93a3a'); line([[x2 + 4, ly + lh / 2 - 4], [x2 - 4, ly + lh / 2 + 4]], 2, '#d93a3a');
        }
      }
    }
    function persona(pp, l, ppos) {
      var s = asiento(pp), ss = st.s[pp], tc = sideColor(side[pp]), x = ppos.x, y = l.gy - 4, z = l.zs, nowMs = c.ahora() * 1000;
      var stun = ss.stun > nowMs && st.k < TE[2] + grace, wob = stun ? Math.sin(at * 34) * 2 : 0, lean = (side[pp] === 0 ? 1 : -1) * 5 * z;
      var pana = c.yo >= 0 && c.yo < n && pp !== c.yo && side[pp] === side[c.yo];
      ell(x, y + 6 * z, 22 * z, 8 * z, 'rgba(0,0,0,.25)', 0);
      ell(x, y + 5 * z, 20 * z, 7 * z, tc, 3);
      c.util.pj(s.ch, x + wob + lean, y - 40 * z, 54 * z, { animo: (mtOf(ss) && ss.e[0] && at - lastDbl[pp] < 0.9) ? 'celebrar' : (stun ? 'perder' : null), sombra: false });
      rr(x - 11 * z + wob, y - 14 * z, 22 * z, 8 * z, 3, tc, 2.5);
      if (pp === c.yo) poly([[x - 8, y - 86 * z], [x + 8, y - 86 * z], [x, y - 74 * z]], '#ffd23f', 3);
      else if (pana) txt('PANA', x, y - 82 * z, 11, '#fffdf2', 0, true);
      if (stun) txt('✖', x, y - 66 * z, 16, '#ff6b6b', 0, true);
      agarre(pp, x, y - 96 * z);
    }
    /* el agarre de cada uno: 5 rayitas (verde firme ≥3, amarillo flojo, rojo sin agarre) */
    function agarre(pp, x, y) {
      var cr = curRound(st.k); if (cr < 0 || st.k >= TE[cr]) return;
      var g = st.s[pp].grip, col = g >= 3 ? '#4fd06a' : (g > 0 ? '#ffd23f' : '#ff4a3a'), q;
      rr(x - 21, y - 4, 42, 8, 3, INK, 0);
      for (q = 0; q < GMAX; q++) rr(x - 19 + q * 8, y - 2, 6, 4, 1, q < g ? col : '#3a3450', 0);
      if (g <= 0 && pp === c.yo) txt('¡DESCANSA!', x, y - 10, 11, '#ff7a5c', 0, true);
    }
    /* HUD común (2D y 3D): marcador de tandas arriba, efectos flotantes y textos de estado */
    function marcador(l, tl, cr) {
      var cx = l.cx;
      rr(cx - 100, 80, 200, 46, 12, INK, 3);
      rr(cx - 96, 84, 6, 38, 3, sideColor(0), 0); rr(cx + 90, 84, 6, 38, 3, sideColor(1), 0);
      txt(String(tl.w[0]), cx - 50, 106, 32, '#fffdf2', 0, true); txt('TANDAS', cx, 100, 11, '#ffd23f', 0, true);
      var rl = cr < 0 ? (allDone() ? 3 : (st.k < TS[0] ? 1 : 0)) : cr + 1;
      txt(rl >= 1 && rl <= 3 ? rl + ' / 3' : '', cx, 116, 11, '#fffdf2', 0, true); txt(String(tl.w[1]), cx + 50, 106, 32, '#fffdf2', 0, true);
    }
    function textosFx(l, posDe, posPar) {           /* «+», «¡FUERA!» y «¡DOBLE!» sobre cada asiento; posDe(p) -> {x, y} de la cabeza */
      var f = l.f, q;
      for (q = 0; q < fxs.length; q++) {
        var e = fxs[q], pp = posDe(e.p); if (!pp) continue;
        var px = pp.x; if (e.kind === 'dbl' && mate[e.p] >= 0) { var pm = posPar(e.p); if (pm) px = pm.x; }
        var txs = e.kind === 'dbl' ? '¡DOBLE!' : (e.kind === 'foul' ? '¡FUERA!' : (e.kind === 'resb' ? '¡RESBALÓN!' : '+')), col = e.kind === 'dbl' ? '#ffd23f' : (e.kind === 'foul' ? '#ff6b6b' : (e.kind === 'resb' ? '#ffb03a' : '#7dff9a'));
        txt(txs, cl(px, f.x0 + 46, f.x1 - 46), pp.y - e.t * 36, e.kind === 'ok' ? 14 : 18, col, 0, true);
      }
    }
    function textosEstado(l, tl, cr, yA, yB, colA) {
      var cx = l.cx;
      if (flashT > 0 && flash && flash.s) txt(flash.s, cx, 214, 20, flash.col, 0, true);
      if (bannerT > 0 && banner) txt(banner.s, cx, 236, Math.min(30, 0.07 * l.vw + 8) * (1 + Math.sin(at * 14) * 0.05), banner.col, 0, true);
      else if (cr >= 0 && st.k >= TS[cr] && st.k < TS[cr] + 24) txt('¡A HALAR!', cx, 236, 26, '#fffdf2', 0, true);
      else if (cr < 0 && st.k < TS[0]) txt('¡PREPÁRENSE!', cx, 236, 24, '#fffdf2', 0, true);
      if (allDone()) {
        var s0 = scSide(0, tl), s1 = scSide(1, tl);
        txt(s0 === s1 ? '¡EMPATE!' : '¡GANÓ EL EQUIPO ' + sideName(s0 > s1 ? 0 : 1) + '!', cx, 236, Math.min(30, 0.07 * l.vw + 8), s0 === s1 ? '#ffd23f' : sideColor(s0 > s1 ? 0 : 1), 0, true);
      }
      var mi = (c.yo >= 0 && c.yo < n) ? side[c.yo] : -1;
      if (mi >= 0 && cr >= 0 && st.k < TE[cr]) txt('TU EQUIPO HALA HACIA ' + (mi === 0 ? 'LA IZQUIERDA' : 'LA DERECHA') + (cr === 2 ? ' · ¡ESTA VALE DOBLE!' : ''), cx, yA, 12, colA, 0, true);
      if (cr >= 0 && st.k < TE[cr]) txt(lv === 3 && st.k < TS[cr] + 90 ? '¡CUIDADO CON EL FALSO TAMBOR (GRIS)!' : 'A AL COMPÁS = HALA · NO PULSES = DESCANSA LAS MANOS', cx, yB, 12, '#fffdf2', 0, true);
      if (c.ahora() >= -0.4 && c.ahora() < 1.5 && !c.practica) txt('¡AL COMPÁS!', cx, 62, 20, '#fffdf2', 0, true);
    }

    /* la ola, el cangrejo y la malta en 2D (simple) */
    function playa2D(l, tp, gy, z) {
      var nowMs = c.ahora() * 1000, q, e, u;
      for (q = 0; q < EV.length; q++) {
        e = EV[q];
        if (e.ty === 'ola' && nowMs > e.t - 1300 && nowMs < e.t + 700) {
          u = cl((nowMs - (e.t - 1300)) / 1300, 0, 1); var ox = l.cx + (e.sd === 0 ? -1 : 1) * l.vw * 0.25, oy = 194 + u * (gy - 194), ow = l.vw * 0.24;
          poly([[ox - ow, oy + 14], [ox - ow * 0.6, oy - 12], [ox, oy - 4], [ox + ow * 0.6, oy - 14], [ox + ow, oy + 14]], nowMs < e.t ? '#5ec8ee' : '#bfefff', 3);
        } else if (e.ty === 'cang' && tp[e.p] && nowMs > e.t - 1300 && nowMs < e.t + 900) {
          u = cl((nowMs - (e.t - 1300)) / 1300, 0, 1); var cx2 = tp[e.p].x + (1 - u) * 60, cy2 = gy + 40 - u * 30;
          ell(cx2, cy2, 10 * z, 6 * z, '#e8452e', 2.5); line([[cx2 - 10 * z, cy2 - 2], [cx2 - 16 * z, cy2 - 8]], 2, '#e8452e'); line([[cx2 + 10 * z, cy2 - 2], [cx2 + 16 * z, cy2 - 8]], 2, '#e8452e');
        } else if (e.ty === 'perro' && nowMs > e.t - 1400 && nowMs < e.t + 1100) {
          u = cl((nowMs - (e.t - 1400)) / 1400, 0, 1); var dxx = l.cx + (e.sd === 0 ? -1 : 1) * l.vw * (0.46 - 0.12 * u), dyy = gy + 30 + (1 - u) * 28;
          ell(dxx, dyy, 14 * z, 8 * z, '#b0703a', 2.5); ell(dxx + (e.sd === 0 ? 12 : -12) * z, dyy - 5 * z, 7 * z, 6 * z, '#b0703a', 2.5);
        } else if (e.ty === 'malta' && nowMs > e.t - 2500 && !bit(st.evD, q)) {
          var mx = tp.length ? tp[0].kx : l.cx, my = gy + 34 + Math.sin(at * 5) * 3;
          rr(mx - 5, my - 18, 10, 20, 3, '#3a1a0a', 2); rr(mx - 5, my - 12, 10, 6, 0, '#ffd23f', 0);
        }
      }
    }
    /* ───────────────────────── dibujo 2D (respaldo: sin WebGL o con ?plano=1) ───────────────────────── */
    function dibujar2D() {
      var l = lay(), z = l.zs, q;
      fondo(l);
      var tl = tally(), cr = curRound(st.k);
      marcador(l, tl, cr);
      carga(l);
      /* playa: marcas */
      var cx = l.cx, gy = l.gy, rawX = l.vw * 0.15;
      if (lv === 2 || cr === 2) ell(cx, gy + 6, (cr === 2 ? 92 : 70) * z, (cr === 2 ? 19 : 15) * z, '#6b4a2b', 3);
      line([[cx, gy - 70 * z], [cx, gy + 18]], 3, '#fffdf2');
      line([[cx - rawX, gy - 40 * z], [cx - rawX, gy + 18]], 2, sideColor(0)); line([[cx + rawX, gy - 40 * z], [cx + rawX, gy + 18]], 2, sideColor(1));
      var tp = teamPos(l), kx = tp.length ? tp[0].kx : cx, y0 = gy - 34 * z;
      /* cuerda */
      var xa = kx - 215 * z, xb = kx + 215 * z, sag = 5 * z * Math.sin(at * 14) * (cr >= 0 && st.k < TE[cr] ? 1 : 0.3), pts = [], sgm = 10;
      for (q = 0; q <= sgm; q++) { var u = q / sgm; pts.push([xa + (xb - xa) * u, y0 + Math.sin(u * Math.PI * 6 + at * 6) * sag]); }
      line(pts, 6, pal.cuerda);
      poly([[kx - 7, y0 - 24 * z], [kx + 7, y0 - 24 * z], [kx + 7, y0 - 8 * z], [kx - 7, y0 - 8 * z]], st.pos === 0 ? '#fffdf2' : (st.pos > 0 ? sideColor(0) : sideColor(1)), 3);
      ell(kx, y0, 7, 7, '#fffdf2', 3);
      for (q = 0; q < n; q++) persona(q, l, tp[q]);
      playa2D(l, tp, gy, z);
      /* efectos flotantes sobre cada asiento */
      textosFx(l, function (p) { return tp[p] ? { x: tp[p].x, y: gy - 100 * z } : null; },
        function (p) { return tp[mate[p]] ? { x: (tp[p].x + tp[mate[p]].x) / 2, y: 0 } : null; });
      textosEstado(l, tl, cr, gy + 66 * z, gy + 84 * z, lv === 3 ? '#fffdf2' : '#14101c');
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (doc 15): playa de la costa (Choroní) al atardecer de un domingo, un tambor de fondo, la cuerda pasa por las manos de los
       cuatro y en el medio hay un charco de barro: el equipo que pierde la tanda se va de boca al barro. Sin WebGL o con ?plano=1: dibujar2D(). ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0, musOn = false;
    var KX = 0.042, BARRO_R = lv === 2 ? 2.4 : 1.8, GIRO = Math.PI / 2 - 0.32, PIEL_T = '#f2dfb0', BARRO = ['#6b4a2b', '#8a6a45', '#4a3220'];
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', arena: '#f2d38a', mar: '#2fa7d0', morro: '#3f8a4a', astro: '#fff2a0', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', arena: '#e0b878', mar: '#c06a6a', morro: '#6a4a5a', astro: '#ffe9a0', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', arena: '#a4906c', mar: '#2a2d6a', morro: '#222048', astro: '#f4f0d0', noche: 1 }
    };
    var TOLDOS = [['#ff5c8a', '#fffdf2'], ['#ffd23f', '#3fa9ff'], ['#4fd06a', '#fffdf2']];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, i2;
      /* tambor de la costa (Barlovento): La menor, i–iv–V–i; suena solo ENTRE tandas, en la tanda manda el tambor del juego */
      V3.pista('cuerda', { bpm: 124, acordes: [[57, 60, 64], [53, 57, 62], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 76, 74, 72, 0, 69, 0, 72, 74, 0, 76, 0, 74, 72, 0, 74, 0, 74, 72, 71, 0, 68, 0, 69, 0, 72, 0, 69, 0, 0, 0] });
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 50, 170], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 8);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, gm = V3.toon('#fff').gradientMap;
      /* arena con granitos, la orilla mojada, el mar con olas que llegan y la espuma que va y viene */
      var arenaT = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = pl.arena; x.fillRect(0, 0, w, h);
        for (var j = 0; j < 110; j++) { x.fillStyle = V3.oscurecer(pl.arena, j % 3 ? .88 : 1.1); x.fillRect((j * 37) % w, (j * 53 + (j % 7) * 11) % h, 2 + j % 3, 2); }
      }, [34, 9]);
      var arena = new T.Mesh(new T.PlaneGeometry(220, 46), new T.MeshToonMaterial({ map: arenaT, gradientMap: gm }));
      arena.rotation.x = -Math.PI / 2; arena.position.set(0, 0, 14); arena.receiveShadow = true; S3.add(arena);
      var mojada = new T.Mesh(new T.PlaneGeometry(220, 2.4), tn(V3.oscurecer(pl.arena, .8))); mojada.rotation.x = -Math.PI / 2; mojada.position.set(0, .006, -7.9); mojada.receiveShadow = true; S3.add(mojada);
      var mar = new T.Mesh(new T.PlaneGeometry(240, 160), tn(pl.mar)); mar.rotation.x = -Math.PI / 2; mar.position.set(0, -.03, -89); S3.add(mar);
      var espuma = new T.Mesh(new T.PlaneGeometry(220, .7), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 })); espuma.rotation.x = -Math.PI / 2; espuma.position.set(0, .012, -9); S3.add(espuma);
      var olas = [];
      for (k = 0; k < 8; k++) { var ola = new T.Mesh(new T.BoxGeometry(10 + (k % 3) * 4, .06, .28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6 }));
        ola.position.set(((k * 23.7) % 60) - 30, .02, -30); S3.add(ola); olas.push({ m: ola, off: k / 8 }); }
      /* el astro y los morros del fondo (la costa de Aragua) */
      var astro = new T.Mesh(new T.SphereGeometry(7, 16, 12), new T.MeshBasicMaterial({ color: pl.astro, fog: false }));
      astro.position.set(lv === 2 ? -45 : 40, lv === 2 ? 9 : 34, -150); S3.add(astro);
      for (k = 0; k < 5; k++) { var mo = M(new T.IcosahedronGeometry(14 + (k % 3) * 5, 0), V3.oscurecer(pl.morro, .9 + (k % 2) * .15), { borde: false, sombra: false });
        mo.scale.set(1.6, .55 + (k % 2) * .2, 1); mo.position.set(-80 + k * 40, -2, -110 - (k % 2) * 15); S3.add(mo); }
      /* el peñero que se mece y los alcatraces que vuelan en círculo */
      var bote = new T.Group(); bote.position.set(-15, 0, -26); S3.add(bote);
      var casco = M(new T.BoxGeometry(5, .7, 1.5), '#fffdf2', { g: .03 }); casco.position.y = .2; bote.add(casco);
      var franja = M(new T.BoxGeometry(5.05, .22, 1.55), '#d93a3a', { borde: false }); franja.position.y = .35; bote.add(franja);
      var proa = M(new T.ConeGeometry(.75, 1.4, 4), '#fffdf2', { g: .03 }); proa.rotation.z = -Math.PI / 2; proa.position.set(3.1, .25, 0); proa.scale.set(1, 1, 1); bote.add(proa);
      var aves = [];
      for (k = 0; k < 3; k++) {
        var ave = new T.Group(); S3.add(ave);
        var cu = M(new T.BoxGeometry(.18, .14, .6), '#fffdf2', { g: .06 }); ave.add(cu);
        var aI = M(new T.BoxGeometry(.9, .04, .3), '#fffdf2', { g: .06 }); aI.geometry.translate(-.45, 0, 0); ave.add(aI);
        var aD = M(new T.BoxGeometry(.9, .04, .3), '#fffdf2', { g: .06 }); aD.geometry.translate(.45, 0, 0); ave.add(aD);
        aves.push({ g: ave, i: aI, d: aD, k: k });
      }
      /* palmeras, toldos y el kiosco de empanadas */
      var hojas = [], palmas = [];
      function palmera(x, z, h) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3); palmas.push(g3);
        for (var a = 0; a < 6; a++) { var tr = M(new T.CylinderGeometry(.28 - a * .02, .34 - a * .02, h / 6, 6), a % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(a * .3) * .3, h / 12 + a * h / 6, 0); g3.add(tr); }
        for (var b = 0; b < 7; b++) { var hoja = M(new T.ConeGeometry(.5, 3.6, 4), b % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); hoja.geometry.translate(0, 1.8, 0); hoja.position.set(.5, h, 0); hoja.rotation.set(0, b / 7 * 6.28, 0); hoja.rotateZ(1.9); g3.add(hoja); hojas.push(hoja); }
        for (b = 0; b < 3; b++) { var coco = M(new T.SphereGeometry(.2, 6, 5), '#6a4a22', { g: .06 }); coco.position.set(.5 + Math.cos(b * 2.1) * .3, h - .3, Math.sin(b * 2.1) * .3); g3.add(coco); }
      }
      palmera(-13.5, -5, 7.5); palmera(14.5, -6, 8); palmera(-17, 2.5, 6.5); palmera(18, 3, 7);
      function toldo(x, z, cols) {
        var po = M(new T.CylinderGeometry(.06, .06, 2.8, 6), '#fffdf2', { g: .08 }); po.position.set(x, 1.4, z); S3.add(po);
        var te = M(new T.ConeGeometry(1.9, .75, 8), cols[0], { g: .03 }); te.position.set(x, 2.85, z); S3.add(te);
        var pu = M(new T.ConeGeometry(.7, .3, 8), cols[1], { g: .05 }); pu.position.set(x, 3.25, z); S3.add(pu);
        var to = M(new T.BoxGeometry(1.8, .12, .7), cols[1], { recibe: true, g: .04 }); to.position.set(x + .6, .25, z + 1); to.rotation.y = .4; S3.add(to);
      }
      toldo(-9.5, -5.5, TOLDOS[0]); toldo(8, -6.5, TOLDOS[1]); toldo(-19, -3, TOLDOS[2]);
      var kio = new T.Group(); kio.position.set(11.5, 0, -3.5); kio.rotation.y = -.35; S3.add(kio);
      var kc = M(new T.BoxGeometry(3.4, 2.2, 2.2), '#7fd6c9', { recibe: true, g: .02 }); kc.position.y = 1.1; kio.add(kc);
      var mostr = M(new T.BoxGeometry(3.6, .2, .6), '#c4783a', { g: .04 }); mostr.position.set(0, 1.2, 1.25); kio.add(mostr);
      var techo = M(new T.ConeGeometry(2.9, 1.4, 4), '#d9b060', { g: .02 }); techo.rotation.y = Math.PI / 4; techo.position.y = 2.9; kio.add(techo);
      var cartel = new T.Mesh(new T.PlaneGeometry(3, .6), new T.MeshBasicMaterial({ map: V3.texturaCanvas(256, 52, function (x, w, h) {
        x.fillStyle = '#ffd23f'; x.fillRect(0, 0, w, h); x.fillStyle = '#d93a3a'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EMPANADAS · MALTA', w / 2, h / 2 + 2);
      }) }));
      cartel.position.set(0, 1.85, 1.12); kio.add(cartel);
      var vent = M(new T.BoxGeometry(2.2, .7, .1), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .03, em: pl.noche ? '#ffb030' : null, emI: .9 }); vent.position.set(0, 1.55, 1.11); kio.add(vent);
      var cava = M(new T.BoxGeometry(1, .65, .65), '#3f7fd0', { recibe: true, g: .04 }); cava.position.set(-6.8, .33, -2.6); S3.add(cava);
      var tapa = M(new T.BoxGeometry(1.05, .15, .7), '#fffdf2', { g: .05 }); tapa.position.set(-6.8, .72, -2.6); S3.add(tapa);
      /* PÚBLICO: dos filas detrás de la cuerda; cada lado hincha a su equipo (salta más el que va ganando y estalla con dobles, malta y jalones) */
      var fans = [], skins = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
      for (k = 0; k < 34; k++) {
        var frow = k % 2, fxp = -24 + (k >> 1) * 2.9 + frow * 1.3 + ((k * 13) % 5) * .12, fzp = -6.6 - frow * 1.5;
        if (Math.abs(fxp - 8) < 1.5 || Math.abs(fxp + 9.5) < 1.5 || Math.abs(fxp + 19) < 1.5 || Math.abs(fxp - 13.5) < 2 || Math.abs(fxp + 13.5) < 1.2) continue;
        var fg = new T.Group(); fg.position.set(fxp, 0, fzp); S3.add(fg);
        var fs = fxp < 0 ? 0 : 1, fcol = (k % 3 === 0) ? '#fffdf2' : sideColor(fs);
        var fcu = M(new T.BoxGeometry(.5, .8, .34), fcol, { g: .04 }); fcu.position.y = .85; fg.add(fcu);
        var fpi = M(new T.BoxGeometry(.36, .55, .3), '#3a3a5a', { borde: false }); fpi.position.y = .3; fg.add(fpi);
        var fca = M(new T.SphereGeometry(.24, 8, 6), skins[k % 5], { g: .05 }); fca.position.y = 1.5; fg.add(fca);
        if (k % 4 === 1) { var gor = M(new T.ConeGeometry(.22, .25, 6), sideColor(fs), { borde: false }); gor.position.y = 1.8; fg.add(gor); }
        var fbr = [];
        for (i2 = 0; i2 < 2; i2++) { var far = M(new T.BoxGeometry(.12, .5, .12), skins[k % 5], { borde: false }); far.geometry.translate(0, .25, 0); far.position.set((i2 ? 1 : -1) * .33, 1.15, 0); far.rotation.z = (i2 ? -1 : 1) * Math.PI; fg.add(far); fbr.push(far); }
        fans.push({ g: fg, sd: fs, br: fbr, ph: k * 1.7 });
      }
      /* sombrillas, antorchas (la llama baila), un castillo de arena, tablas de surf, piedras y dunas: el entorno vive */
      var antorchas = [];
      function sombrilla(x, z, col) {
        var sp = M(new T.CylinderGeometry(.05, .05, 2.4, 5), '#fffdf2', { g: .08 }); sp.position.set(x, 1.2, z); sp.rotation.z = .12; S3.add(sp);
        var sc = M(new T.ConeGeometry(1.5, .55, 8), col, { g: .03 }); sc.position.set(x - .14, 2.45, z); sc.rotation.z = .12; S3.add(sc);
        var tw = M(new T.BoxGeometry(1.5, .04, .7), col, { borde: false }); tw.position.set(x + .6, .03, z + 1.1); tw.rotation.y = .5; S3.add(tw);
      }
      sombrilla(-22, 4.5, '#ff5c8a'); sombrilla(21.5, 5, '#3fa9ff'); sombrilla(-15.5, 7, '#ffd23f');
      function antorcha(x, z) {
        var ap = M(new T.CylinderGeometry(.06, .08, 2.2, 5), '#5a3a20', { g: .06 }); ap.position.set(x, 1.1, z); S3.add(ap);
        var al = new T.Mesh(new T.ConeGeometry(.2, .55, 6), tn('#ff8a3d', { em: '#ff6a1a', emI: 1.4 })); al.position.set(x, 2.45, z); S3.add(al); antorchas.push(al);
      }
      antorcha(-5, -4.6); antorcha(5, -4.6); antorcha(-16.5, -1.5); antorcha(16.5, -1.5);
      var castillo = new T.Group(); castillo.position.set(-11.5, 0, 3); S3.add(castillo);
      var cb = M(new T.CylinderGeometry(.8, 1, .55, 8), '#e8c47a', { g: .03 }); cb.position.y = .27; castillo.add(cb);
      for (k = 0; k < 3; k++) { var ct = M(new T.CylinderGeometry(.22, .3, .9 + (k % 2) * .3, 7), '#e8c47a', { g: .03 }); ct.position.set(-.55 + k * .55, .6, (k % 2) * .25 - .1); castillo.add(ct); var cf = M(new T.ConeGeometry(.28, .3, 6), ['#ff5c8a', '#ffd23f', '#3fa9ff'][k], { borde: false }); cf.position.set(-.55 + k * .55, 1.25 + (k % 2) * .15, (k % 2) * .25 - .1); castillo.add(cf); }
      for (k = 0; k < 3; k++) { var tab = M(new T.BoxGeometry(.5, 2.6, .12), ['#ffd23f', '#ff5c8a', '#4fd06a'][k], { g: .04 }); tab.position.set(14.2 + k * .55, 1.3, -1.6 + k * .1); tab.rotation.z = -.2 + k * .06; S3.add(tab); }
      for (k = 0; k < 5; k++) { var roc = M(new T.IcosahedronGeometry(.5 + (k % 3) * .25, 0), V3.oscurecer(pl.morro, 1.1), { g: .03 }); roc.position.set(-26 + k * 13, .25, -8.6 - (k % 2)); roc.scale.set(1.3, .7, 1); S3.add(roc); }
      for (k = 0; k < 2; k++) { var dun = M(new T.IcosahedronGeometry(5, 1), V3.oscurecer(pl.arena, .94), { borde: false, sombra: false }); dun.scale.set(2.2, .35, 1); dun.position.set(k ? 31 : -31, -.2, -9); S3.add(dun); }
      /* nubes (se ponen negras en la tormenta de la última tanda) y rachas de viento */
      var nubeM = V3.toon(pl.noche ? '#4a4870' : '#ffffff', { nuevo: true }), nubes = [];
      for (k = 0; k < 7; k++) { var nb = M(new T.IcosahedronGeometry(2.6 + k % 3, 0), null, { mat: nubeM, borde: false, sombra: false }); nb.scale.set(2.6, .75, 1.3); nb.position.set(-52 + k * 17, 17 + (k % 3) * 2, -48 - (k % 2) * 8); S3.add(nb); nubes.push(nb); }
      var rafM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), rafagas = [];
      for (k = 0; k < 10; k++) { var rf = new T.Mesh(new T.BoxGeometry(2.2 + (k % 3), .04, .04), rafM); rf.position.set(-24 + k * 5, .8 + (k * 7 % 5) * .9, -2 + (k % 4) * 1.4); rf.visible = false; S3.add(rf); rafagas.push(rf); }
      /* banderines de cada equipo en su raya, la raya del medio y el charco de barro */
      var banderas = [], sd;
      for (sd = 0; sd < 2; sd++) {
        var bx = (sd === 0 ? -1 : 1) * 100 * KX;
        var raya = new T.Mesh(new T.PlaneGeometry(.14, 3.4), tn(sideColor(sd))); raya.rotation.x = -Math.PI / 2; raya.position.set(bx, .02, 0); raya.receiveShadow = true; S3.add(raya);
        var asta = M(new T.CylinderGeometry(.05, .05, 2.6, 6), '#fffdf2', { g: .08 }); asta.position.set(bx, 1.3, -2); S3.add(asta);
        var tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, -.7, 0, (sd === 0 ? -1 : 1) * 1.1, -.35, 0], 3)); tri.computeVertexNormals();
        var ban = new T.Mesh(tri, new T.MeshToonMaterial({ color: sideColor(sd), side: T.DoubleSide, gradientMap: gm })); ban.position.set(bx, 2.55, -2); ban.castShadow = true; S3.add(ban); banderas.push(ban);
      }
      var medio = new T.Mesh(new T.PlaneGeometry(.12, 3.4), tn('#fffdf2')); medio.rotation.x = -Math.PI / 2; medio.position.set(0, .021, 0); S3.add(medio);
      var charco = new T.Mesh(new T.CircleGeometry(1, 28), tn('#6b4a2b')); charco.rotation.x = -Math.PI / 2; charco.scale.set(BARRO_R, BARRO_R * .62, 1); charco.position.set(0, .015, .1); charco.receiveShadow = true; S3.add(charco);
      for (k = 0; k < 4; k++) { var man = new T.Mesh(new T.CircleGeometry(.3 + (k % 2) * .15, 12), tn(k % 2 ? '#8a6a45' : '#5a3a20')); man.rotation.x = -Math.PI / 2;
        man.position.set((k - 1.5) * BARRO_R * .45, .018, ((k * 7) % 3 - 1) * .35); man.scale.set(1.4, .7, 1); S3.add(man); }
      var brillo = new T.Mesh(new T.CircleGeometry(.4, 12), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25 })); brillo.rotation.x = -Math.PI / 2; brillo.scale.set(2.2, .5, 1); brillo.position.set(-.5, .02, -.3); S3.add(brillo);
      /* el tambor (culo e' puya) detrás de la cuerda: late con cada golpe; el falso tambor lo pone gris */
      var tam = new T.Group(); tam.position.set(0, 0, -3.9); S3.add(tam);
      var cuerpoT = M(new T.CylinderGeometry(.5, .36, 1.3, 12), '#8a2f1f', { g: .04 }); cuerpoT.position.y = .65; tam.add(cuerpoT);
      for (k = 0; k < 2; k++) { var aro = M(new T.CylinderGeometry(.5 - k * .1, .5 - k * .1, .1, 12), '#ffd23f', { borde: false }); aro.position.y = 1.15 - k * .55; tam.add(aro); }
      var pielM = V3.toon(PIEL_T, { nuevo: true }), piel = M(new T.CylinderGeometry(.52, .52, .06, 14), null, { mat: pielM, g: .04 }); piel.position.y = 1.32; tam.add(piel);
      var palos = [];
      for (k = 0; k < 2; k++) { var pv = new T.Group(); pv.position.set(k ? .45 : -.45, 1.75, .1); tam.add(pv);
        var pa = M(new T.CylinderGeometry(.035, .035, .8, 5), '#c4783a', { g: .1 }); pa.geometry.translate(0, -.4, 0); pv.add(pa); pv.rotation.z = (k ? 1 : -1) * .9; palos.push(pv); }
      var onda = new T.Mesh(new T.RingGeometry(.5, .62, 24), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
      onda.rotation.x = -Math.PI / 2; onda.position.set(0, 1.4, -3.9); S3.add(onda);
      /* la noche: bombillos en el kiosco, una fogata, y dos luces de verdad */
      var fuego = null, luzF = null;
      if (pl.noche) {
        for (k = 0; k < 7; k++) { var bo = new T.Mesh(new T.SphereGeometry(.11, 6, 4), tn('#fff6c0', { em: TOLDOS[k % 3][0], emI: 2 })); bo.position.set(-1.5 + k * .5, 2.15 - Math.sin(k / 6 * Math.PI) * .2, 1.2); kio.add(bo); }
        var luzK = new T.PointLight(0xffd890, 1.1, 16, 2); luzK.position.set(11, 3, -1.5); S3.add(luzK);
        fuego = new T.Group(); fuego.position.set(-9, 0, -2.5); S3.add(fuego);
        for (k = 0; k < 3; k++) { var le = M(new T.CylinderGeometry(.1, .1, 1.2, 5), '#5a3a20', { g: .06 }); le.rotation.set(Math.PI / 2, k * 1.05, 0); le.position.y = .12; fuego.add(le); }
        for (k = 0; k < 3; k++) { var ll = new T.Mesh(new T.ConeGeometry(.35 - k * .08, .9 - k * .15, 6), tn(k ? '#ffd23f' : '#ff8a3d', { em: k ? '#ffd23f' : '#ff6a1a', emI: 1.6 })); ll.position.y = .5; fuego.add(ll); }
        luzF = new T.PointLight(0xff9a40, 1.4, 14, 2); luzF.position.set(-9, 1.4, -2.5); S3.add(luzF);
      }
      /* los cuatro: cada uno dentro de un «soporte» que se inclina hacia atrás al halar; aro del color del equipo en los pies */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), sop = new T.Group(), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        sop.add(pj.g); S3.add(sop);
        var anillo = new T.Mesh(new T.RingGeometry(.62, .8, 20), new T.MeshBasicMaterial({ color: sideColor(side[k]), transparent: true, opacity: .85 }));
        anillo.rotation.x = -Math.PI / 2; S3.add(anillo);
        pjs.push({ pj: pj, sop: sop, aro: anillo, x: (side[k] === 0 ? -1 : 1) * 3, z: 0, lean: 0, pulso: 0, arr: 0, barro: false, moj: 0, susto: 0, mano: new T.Vector3() });
      }
      /* la cuerda: un tubo que pasa por las manos de los cuatro (se rehace cada cuadro), y el pañuelo del medio */
      var cuerda = new T.Mesh(new T.BufferGeometry(), tn(pal.cuerda)); cuerda.castShadow = true; S3.add(cuerda);
      var panoM = V3.toon('#fffdf2', { nuevo: true }), pano = M(new T.ConeGeometry(.2, .55, 4), null, { mat: panoM, g: .08 }); pano.rotation.x = Math.PI; S3.add(pano);
      var flecha = M(new T.ConeGeometry(.3, .6, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      /* la ola que revuelca a un lado: una lomita de agua con su cresta de espuma */
      var olaG = new T.Group(); olaG.visible = false; S3.add(olaG);
      var olaM = new T.MeshToonMaterial({ color: V3.oscurecer(pl.mar, 1.35), gradientMap: gm, transparent: true, opacity: .85 });
      var lomo = new T.Mesh(new T.CylinderGeometry(1, 1, 8.5, 14, 1, false, 0, Math.PI), olaM); lomo.rotation.set(0, 0, Math.PI / 2); lomo.scale.set(1, 1, .9); olaG.add(lomo);
      var crestaM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 });
      var cresta = new T.Mesh(new T.BoxGeometry(8.7, .22, .5), crestaM); cresta.position.set(0, .98, .25); olaG.add(cresta);
      /* los cangrejos (uno por evento): caparazón, patas y tenazas */
      var cangs = [];
      for (k = 0; k < EV.length; k++) if (EV[k].ty === 'cang') {
        var cg = new T.Group(); cg.visible = false; S3.add(cg);
        var capa = M(new T.SphereGeometry(.32, 10, 6), '#e8452e', { g: .05 }); capa.scale.set(1, .5, .8); capa.position.y = .2; cg.add(capa);
        var tz = [];
        for (i2 = 0; i2 < 2; i2++) {
          var te2 = M(new T.SphereGeometry(.13, 6, 4), '#ff6a4a', { g: .06 }); te2.scale.set(1.3, .7, .8); te2.position.set((i2 ? 1 : -1) * .3, .25, .32); cg.add(te2); tz.push(te2);
          var oj = M(new T.SphereGeometry(.05, 5, 4), '#fffdf2', { g: .1 }); oj.position.set((i2 ? 1 : -1) * .1, .42, .18); cg.add(oj);
          for (var pt2 = 0; pt2 < 3; pt2++) { var pa2 = M(new T.BoxGeometry(.28, .04, .04), '#c43a22', { borde: false }); pa2.position.set((i2 ? 1 : -1) * .38, .1, -.12 + pt2 * .12); pa2.rotation.z = (i2 ? -1 : 1) * .5; cg.add(pa2); }
        }
        cangs.push({ ev: EV[k], g: cg, tz: tz });
      }
      /* los perros (uno por evento): cuerpo, cabeza, orejas y cola que se menea */
      var perros = [];
      for (k = 0; k < EV.length; k++) if (EV[k].ty === 'perro') {
        var pg = new T.Group(); pg.visible = false; S3.add(pg);
        var pcu = M(new T.BoxGeometry(.9, .42, .38), '#b0703a', { g: .04 }); pcu.position.y = .5; pg.add(pcu);
        var pca = M(new T.BoxGeometry(.38, .34, .34), '#c4824a', { g: .04 }); pca.position.set(.55, .72, 0); pg.add(pca);
        var hoc = M(new T.BoxGeometry(.2, .14, .2), '#3a1a0a', { borde: false }); hoc.position.set(.78, .66, 0); pg.add(hoc);
        for (i2 = 0; i2 < 2; i2++) { var por = M(new T.BoxGeometry(.1, .2, .08), '#6a4020', { borde: false }); por.position.set(.5, .95, (i2 ? 1 : -1) * .14); pg.add(por);
          var ppa = M(new T.BoxGeometry(.1, .4, .1), '#a0602a', { borde: false }); ppa.position.set((i2 ? .3 : -.3), .2, (i2 ? 1 : -1) * .13); pg.add(ppa); }
        var pco = M(new T.BoxGeometry(.4, .08, .08), '#b0703a', { borde: false }); pco.geometry.translate(-.2, 0, 0); pco.position.set(-.45, .68, 0); pg.add(pco);
        perros.push({ ev: EV[k], g: pg, cola: pco });
      }
      /* la malta del golpe dorado: brilla en la arena frente al nudo */
      var malta = new T.Group(); malta.visible = false; S3.add(malta);
      var bot = M(new T.CylinderGeometry(.16, .18, .55, 10), '#3a1a0a', { g: .05 }); bot.position.y = .28; malta.add(bot);
      var cue = M(new T.CylinderGeometry(.06, .14, .25, 10), '#3a1a0a', { g: .05 }); cue.position.y = .68; malta.add(cue);
      var eti = M(new T.CylinderGeometry(.175, .175, .2, 10), '#ffd23f', { borde: false }); eti.position.y = .3; malta.add(eti);
      var chapa = M(new T.CylinderGeometry(.07, .07, .05, 8), '#d93a3a', { borde: false }); chapa.position.y = .82; malta.add(chapa);
      var halo = new T.Mesh(new T.RingGeometry(.3, .5, 20), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = .03; malta.add(halo);
      esc.encuadrar(17, 7.6, new T.Vector3(0, 2.6, -.5), .16);
      return { esc: esc, pjs: pjs, part: part, cuerda: cuerda, pano: pano, panoM: panoM, flecha: flecha, olas: olas, espuma: espuma, bote: bote, aves: aves, hojas: hojas, banderas: banderas,
        tam: tam, pielM: pielM, palos: palos, onda: onda, fuego: fuego, luzF: luzF, kx: 0, tens: 0, golpe: 0, palo: 0, falso: 0, cr: -1, lado: -1, resT: -9, dblT: [-9, -9], burT: 0, confT: 0,
        fans: fans, antorchas: antorchas, palmas: palmas, nubes: nubes, nubeM: nubeM, nubeC0: new T.Color(pl.noche ? '#4a4870' : '#ffffff'), nubeC1: new T.Color('#2a2c3c'), rafagas: rafagas, rafM: rafM,
        cheer: [0, 0], vi: 0, visd: 0, tor: 0, cal: 0, rayo: 0, rayoT: 3, lluvT: 0, fwT: 0, fog0: esc.scene.fog ? esc.scene.fog.color.clone() : null, fogS: new T.Color('#3a3f55'),
        olaG: olaG, olaM: olaM, crestaM: crestaM, cangs: cangs, perros: perros, malta: malta, halo: halo, charco: charco, barroK: 1, maltaV: null,
        hemi0: pl.hemi[2], sol0: new T.Color(pl.sol[0]), solF: new T.Color(0xff6a3a), fz: 0,
        va: new T.Vector3(), vb: new T.Vector3() };
    }
    function enBarro(x) { return Math.abs(x) < BARRO_R + .2; }
    /* efectos de cada evento (los llama update() por diferencia de estado: valen igual en el juez y en las pantallas que interpolan) */
    function fx3(p, kind) {
      var V = v3, o = V.pjs[p], d = side[p] === 0 ? -1 : 1; if (!o) return;
      if (kind === 'ok') {
        o.pulso = 1; V.tens = 1;
        V.part.soltar(o.x + d * .3, .1, o.z, 5, { k: 'chispa', cols: [pal.arena, V3.oscurecer(pal.arena, .8)], vel: 1.8, arriba: 1.4, vida: .4, esc: .55 });
        if (p === c.yo && isJudge()) V3.sfx('pop');
      } else if (kind === 'foul') {
        o.pj.uno('golpe');
        V.part.soltar(o.x, 3.1, o.z, 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 1.4, arriba: .8, g: 1.5, vida: .8, esc: .7 });
        if (inMud() && enBarro(o.x)) V.part.soltar(o.x, .2, o.z, 12, { k: 'gota', cols: BARRO, vel: 2.5, arriba: 3, vida: .6, esc: .8 });
        if (p === c.yo && isJudge()) V3.sfx('error');
      } else if (kind === 'dbl') {
        if (at - V.dblT[side[p]] < 0.3) return;
        V.dblT[side[p]] = at;
        var m = mate[p], om = m >= 0 ? V.pjs[m] : null, mx = om ? (o.x + om.x) / 2 : o.x;
        o.pulso = 1.5; o.pj.uno('lanzar'); if (om) { om.pulso = 1.5; om.pj.uno('lanzar'); }
        V.tens = 1.6; V.cheer[side[p]] = Math.max(V.cheer[side[p]], .9);
        V.part.soltar(mx, 1.8, 0, 16, { k: 'chispa', cols: ['#ffd23f', '#fff6c0', sideColor(side[p])], vel: 3.5, arriba: 3, g: 6, vida: .6 });
        V.part.soltar(mx, 2.2, 0, 8, { k: 'confeti', cols: ['#ffd23f', sideColor(side[p])], vel: 2.5, arriba: 3, g: 5, vida: 1 });
        V3.sfx('ding'); V.esc.sacudir(.2);
      }
    }
    /* la ola llegó: salpica al lado, sacude, y los que no agarraban se caen (los demás quedan mojados) */
    function ola3(e) {
      var V = v3, p;
      V3.sfx('splash'); V.esc.sacudir(.7);
      for (p = 0; p < n; p++) if (side[p] === e.sd) {
        var o = V.pjs[p]; o.moj = 2.2; o.pj.color('#5a9ad0');
        if (st.s[p].stun >= e.t + STUN_OLA - 40) { o.pj.uno('caer'); o.susto = 1; }
        V.part.soltar(o.x, 1.2, o.z, 22, { k: 'gota', cols: ['#bfefff', '#ffffff', V3.oscurecer(pl3().mar, 1.3)], vel: 4, arriba: 4.5, vida: .9, esc: 1 });
      }
    }
    function malta3(sd) {
      var V = v3, p; V3.sfx('moneda'); V.cheer[sd] = Math.max(V.cheer[sd], 1.4); V.maltaV = { sd: sd, t: at, x: V.malta.position.x };
      for (p = 0; p < n; p++) if (side[p] === sd) { var o = V.pjs[p]; o.pj.uno('festejo'); V.part.soltar(o.x, 2.4, o.z, 12, { k: 'chispa', cols: ['#ffd23f', '#fff6c0', sideColor(sd)], vel: 3, arriba: 3, g: 5, vida: .7 }); }
    }
    function cang3(e, mordio) {
      var V = v3, o = V.pjs[e.p]; if (!o) return;
      if (mordio) { o.pj.uno('golpe'); o.susto = 1.2; V3.sfx('golpe'); V.esc.sacudir(.5); V.part.soltar(o.x, .6, o.z + .3, 8, { k: 'chispa', cols: ['#ff4a3a', '#ffd23f'], vel: 2, arriba: 2, vida: .5 }); }
      else { o.pj.uno('saltar'); V3.sfx('salto'); V.part.soltar(o.x, .1, o.z, 8, { k: 'chispa', cols: [pal.arena, '#fffdf2'], vel: 2, arriba: 1.5, vida: .5, esc: .6 }); }
    }
    function perro3(e, gano) {
      var V = v3, p;
      for (p = 0; p < n; p++) if (side[p] === e.sd) {
        var o = V.pjs[p];
        if (gano) { o.pj.uno('golpe'); o.susto = 1; V.part.soltar(o.x, 1, o.z, 8, { k: 'chispa', cols: ['#b0703a', '#ffd23f'], vel: 2, arriba: 2, vida: .5 }); }
        else { o.pj.uno('festejo'); V.part.soltar(o.x, 2.4, o.z, 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', sideColor(e.sd)], vel: 3, arriba: 3, g: 5, vida: .7 }); }
      }
      V3.sfx(gano ? 'golpe' : 'salto'); V.esc.sacudir(gano ? .5 : .2);
    }
    function pl3() { return PAL3[lv]; }
    function fin3(v) {                                  /* se cerró una tanda: el que pierde se va de boca al barro */
      var V = v3, p, sd = v > 0 ? 0 : 1;
      V.esc.sacudir(1);
      if (v === 0) { V3.sfx('bocina'); return; }
      V3.sfx('splash'); V3.sfx('aplauso'); V.lado = sd; V.resT = at; V.cheer[sd] = 3; V.cheer[1 - sd] = Math.max(V.cheer[1 - sd], .2);
      for (p = 0; p < n; p++) {
        var o = V.pjs[p], d = side[p] === 0 ? -1 : 1;
        if (side[p] === sd) { o.pj.uno('festejo'); V.part.soltar(o.x, 2.6, o.z, 14, { k: 'confeti', cols: [sideColor(sd), '#ffd23f', '#fffdf2'], vel: 3, arriba: 5, g: 6, vida: 1.4 }); }
        else {
          o.arr = 1.3; o.barro = true; o.pj.uno('caer'); o.pj.color('#7a5232');
          V.part.soltar(o.x - d * 1.3, .3, o.z, 30, { k: 'gota', cols: BARRO, vel: 4.5, arriba: 4.5, vida: .9, esc: 1.1 });
        }
      }
    }
    function actualizar3D(dt, now) {
      var V = v3, t = at, nowMs = now * 1000, p, k;
      V.part.update(dt);
      var cr = curRound(st.k), agarra = cr >= 0 && st.res[cr] === SENT, tira = cr >= 0 && st.k < TE[cr], fin = allDone(), gl = fin ? ganaLado() : -2;
      if (cr !== V.cr) {                                  /* tanda nueva: pito, la ropa limpia otra vez y todos a su sitio */
        if (cr >= 0 && st.k < TE[cr]) { V3.sfx('silbato'); for (p = 0; p < n; p++) { var o0 = V.pjs[p]; o0.arr = 0; if (o0.barro) { o0.barro = false; o0.pj.color(null); } } V.lado = -1; }
        V.cr = cr;
      }
      /* lo que se mueve solo: olas, espuma, alcatraces, el peñero, banderines, palmeras, la fogata */
      for (k = 0; k < V.olas.length; k++) { var w = V.olas[k], u = (t * .07 + w.off) % 1; w.m.position.z = -34 + u * 25; w.m.material.opacity = Math.sin(u * Math.PI) * .65; }
      V.espuma.position.z = -9 + Math.sin(t * .8) * .5;
      for (k = 0; k < V.aves.length; k++) { var a = V.aves[k], ang = t * .35 + k * 2.1, r = 7 + k * 2;
        a.g.position.set(Math.cos(ang) * r - 3, 8 + k * 1.2 + Math.sin(t + k) * .4, -14 + Math.sin(ang) * r * .5); a.g.rotation.y = -ang;
        a.i.rotation.z = Math.sin(t * 7 + k) * .6; a.d.rotation.z = -Math.sin(t * 7 + k) * .6; }
      V.bote.position.y = Math.sin(t * 1.3) * .15; V.bote.rotation.z = Math.sin(t * 1.1) * .06; V.bote.rotation.x = Math.sin(t * .9) * .04;
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .06;
      if (V.fuego) { V.luzF.intensity = 1.3 + Math.sin(t * 13) * .25 + Math.sin(t * 7.3) * .15; for (k = 3; k < V.fuego.children.length; k++) V.fuego.children[k].scale.set(1, 1 + Math.sin(t * 11 + k * 2) * .18, 1); }
      /* el tambor: late, los palos caen, y una onda sale del cuero */
      V.golpe = Math.max(0, V.golpe - dt * 5); V.falso = Math.max(0, V.falso - dt * 3);
      V.tam.scale.set(1 + .07 * V.golpe, 1 - .05 * V.golpe, 1 + .07 * V.golpe);
      for (k = 0; k < 2; k++) V.palos[k].rotation.z = (k ? 1 : -1) * (.9 - (k === V.palo ? V.golpe * .9 : 0));
      V.pielM.color.set(V.falso > 0 ? '#9a96a8' : PIEL_T);
      V.onda.scale.setScalar(1 + (1 - V.golpe) * 2.2); V.onda.material.opacity = V.golpe * .8;
      V.onda.material.color.set(V.falso > V.golpe ? 0xd93a3a : 0xffd23f); if (V.falso > V.golpe) { V.onda.scale.setScalar(1 + (1 - V.falso) * 2.2); V.onda.material.opacity = V.falso * .8; }
      /* el barro burbujea (más en el Nv2, donde aturde el doble) */
      V.burT -= dt; if (V.burT < 0) { V.burT = lv === 2 ? .3 : .8; V.part.soltar((c.fx() - .5) * BARRO_R * 1.6, .05, (c.fx() - .5) * BARRO_R, 2, { k: 'gota', cols: BARRO, vel: .4, arriba: 1.6, vida: .4, esc: .55 }); }
      playa3D(dt, nowMs, cr);
      ambiente3D(dt, nowMs, cr, tira, fin, gl);
      /* el nudo: sigue a la cuerda de la simulación */
      V.kx += (-cl(st.pos, -POS_MAX, POS_MAX) * KX - V.kx) * Math.min(1, dt * 12);
      V.tens = Math.max(0, V.tens - dt * 3);
      /* los cuatro */
      var cnt = [0, 0];
      for (p = 0; p < n; p++) {
        var o = V.pjs[p], sd = side[p], j = cnt[sd]++, d = sd === 0 ? -1 : 1, ss = st.s[p], pj = o.pj;
        var stun = ss.stun > nowMs && st.k < TE[2] + grace, va = sd === 0 ? st.pos : -st.pos;
        o.pulso = Math.max(0, o.pulso - dt * 2.5); o.susto = Math.max(0, o.susto - dt);
        if (o.moj > 0) { o.moj -= dt; if (o.moj <= 0 && !o.barro) o.pj.color(null); }
        o.arr = Math.max(0, o.arr - (agarra ? dt * 2 : 0));
        var tx = V.kx + d * (1.7 + 1.45 * j) - d * (o.arr > 0 && !agarra ? o.arr : 0), tz = j % 2 ? -.4 : .25;
        o.x += (tx - o.x) * Math.min(1, dt * 9); o.z = tz;
        var anim = 'quieto', cara = 'normal', vel = .5, lean = 0, ru = d < 0 ? GIRO : -GIRO, agarro = false, desde = t - V.resT;
        if (fin) {
          ru = 0;
          if (gl === sd) { anim = 'celebrar'; cara = 'feliz'; }
          else if (gl === 1 - sd) { anim = o.barro && desde < 1.6 ? 'sentado' : 'triste'; cara = 'triste'; }
          else { anim = 'saludar'; cara = 'normal'; }
        } else if (agarra) {
          agarro = true;
          if (stun) { anim = o.moj > 0 ? 'mojado' : 'quieto'; cara = 'mareado'; lean = .08 + Math.sin(t * 30) * .07; }
          else if (o.susto > 0) { anim = 'quieto'; cara = 'susto'; lean = .2; }
          else if (tira) { anim = 'empujar'; vel = .3 + o.pulso * 1.4; cara = va < -60 ? 'susto' : (o.pulso > .6 ? 'enojado' : 'concentrado'); lean = .34 + o.pulso * .2 + (va < 0 ? .06 : 0); }
          else { anim = 'empujar'; vel = .15; cara = 'concentrado'; lean = .3; }
        } else if (V.lado >= 0 && desde < 3.5) {
          if (V.lado === sd) { anim = desde < 2.2 ? 'celebrar' : 'quieto'; cara = 'feliz'; ru = d < 0 ? .6 : -.6; }
          else { anim = desde < 1.4 ? 'sentado' : 'triste'; cara = 'triste'; ru = 0; }
        } else if (st.k < TS[0]) { agarro = true; anim = 'quieto'; cara = 'concentrado'; lean = .14; }
        else { anim = 'quieto'; cara = 'normal'; }
        o.agarra = agarro;
        o.lean += (lean - o.lean) * Math.min(1, dt * 8);
        o.sop.rotation.z = (sd === 0 ? 1 : -1) * o.lean;
        o.sop.position.set(o.x, 0, o.z);
        pj.anim(anim, { vel: vel }).cara(cara).rumbo(ru).update(dt);
        o.aro.position.set(o.x, .03, o.z);
        if (o.barro && c.fx() < dt * 3) V.part.soltar(o.x, 1.2, o.z, 1, { k: 'gota', cols: BARRO, vel: .3, arriba: 0, vida: .5, esc: .7 });
        if (agarro) { o.sop.updateMatrixWorld(true); pj.mano('der').getWorldPosition(V.va); pj.mano('izq').getWorldPosition(V.vb); o.mano.set((V.va.x + V.vb.x) / 2, (V.va.y + V.vb.y) / 2, (V.va.z + V.vb.z) / 2); }
        else o.mano.set(o.x + d * -.5, .08, o.z * .4);
      }
      cuerda3D(t);
      /* la flecha sobre mí */
      var yo = c.yo >= 0 && c.yo < n ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.x, 3.7 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      /* fin: confeti sobre los ganadores */
      if (fin && gl >= 0) { V.confT -= dt; if (V.confT < 0) { V.confT = .2; V.part.soltar((gl === 0 ? -1 : 1) * 4 + (c.fx() - .5) * 6, 7, (c.fx() - .5) * 3, 3, { k: 'confeti', cols: [sideColor(gl), '#ffd23f', '#fffdf2'], vel: .8, arriba: 0, g: 2.5, vida: 3 }); } }
    }
    /* el público, el viento, la tormenta de la última tanda (nubes negras, lluvia, relámpagos), el atardecer de la 2ª y los fuegos artificiales del final */
    function ambiente3D(dt, nowMs, cr, tira, fin, gl) {
      var V = v3, t = at, k, f, e, q, wv = 0, wsd = V.visd;
      V.cheer[0] = Math.max(0, V.cheer[0] - dt * .6); V.cheer[1] = Math.max(0, V.cheer[1] - dt * .6);
      for (k = 0; k < V.fans.length; k++) {
        f = V.fans[k];
        var lead = f.sd === 0 ? st.pos : -st.pos, base = fin ? (gl === f.sd ? 1 : .1) : (tira ? (lead > 12 ? 1 : (lead < -12 ? .15 : .55)) : .3), ch = Math.max(V.cheer[f.sd], base * .6);
        f.g.position.y = Math.abs(Math.sin(t * (5 + (k % 3)) + f.ph)) * (.03 + .32 * Math.min(1.4, ch));
        var up = Math.min(1, ch * .9), wave = Math.sin(t * 9 + f.ph) * .25;
        f.br[0].rotation.z = Math.PI * (1 - up) * .9 + .25 + wave; f.br[1].rotation.z = -(Math.PI * (1 - up) * .9 + .25 - wave);
      }
      for (q = 0; q < EV.length; q++) {
        e = EV[q]; if (e.ty !== 'viento' || nowMs < e.t - 1000 || nowMs > e.t + WIND_MS + 400) continue;
        var rp = nowMs < e.t ? (nowMs - (e.t - 1000)) / 1000 * .35 : (nowMs < e.t + WIND_MS ? 1 : 1 - (nowMs - e.t - WIND_MS) / 400);
        if (rp > wv) { wv = rp; wsd = e.sd; }
      }
      V.vi += (wv - V.vi) * Math.min(1, dt * 5); V.visd = wsd;
      var wd = wsd === 0 ? -1 : 1;
      V.rafM.opacity = V.vi * .55;
      for (k = 0; k < V.rafagas.length; k++) {
        var rf = V.rafagas[k]; rf.visible = V.vi > .05; if (!rf.visible) continue;
        rf.position.x += wd * dt * (16 + (k % 3) * 5); if (rf.position.x > 26) rf.position.x = -26; else if (rf.position.x < -26) rf.position.x = 26;
      }
      for (k = 0; k < V.palmas.length; k++) V.palmas[k].rotation.z = -wd * V.vi * .13 + Math.sin(t * 1.3 + k) * .02;
      for (k = 0; k < V.banderas.length; k++) V.banderas[k].rotation.y = Math.sin(t * (3 + V.vi * 6) + k * 1.7) * (.4 + .5 * V.vi);
      if (V.vi > .5 && c.fx() < dt * 6) V.part.soltar(wd < 0 ? 20 : -20, .6 + c.fx() * 3, (c.fx() - .5) * 3, 1, { k: 'chispa', cols: [pal.arena, '#ffffff'], vel: 1, arriba: .2, g: 0, vida: .6, esc: .4 });
      for (k = 0; k < V.antorchas.length; k++) V.antorchas[k].scale.set(1, 1 + Math.sin(t * 12 + k * 2) * .22, 1);
      /* atardecer en la 2ª tanda, tormenta en la 3ª */
      V.cal += (((cr === 1 && !fin) ? 1 : 0) - V.cal) * Math.min(1, dt * .8);
      var torT = (cr === 2 && !fin) ? 1 : 0; V.tor += (torT - V.tor) * Math.min(1, dt * .8);
      V.nubeM.color.copy(V.nubeC0).lerp(V.nubeC1, V.tor);
      for (k = 0; k < V.nubes.length; k++) { var nb = V.nubes[k]; nb.position.x += dt * (.5 + V.tor * 1.5 + wd * V.vi * 3); if (nb.position.x > 60) nb.position.x = -60; else if (nb.position.x < -60) nb.position.x = 60; nb.position.y = 17 + (k % 3) * 2 - V.tor * 5; nb.scale.y = .75 + V.tor * .5; }
      if (V.fog0 && V.esc.scene.fog) V.esc.scene.fog.color.copy(V.fog0).lerp(V.fogS, V.tor * .7);
      if (V.tor > .3) {
        V.lluvT -= dt; if (V.lluvT < 0) { V.lluvT = .03; V.part.soltar((c.fx() - .5) * 30, 12, -3 + c.fx() * 7, 3, { k: 'gota', cols: ['#cfe8ff', '#ffffff'], vel: .1, arriba: -4, g: 14, vida: .9, esc: .3 }); }
        V.rayoT -= dt; if (V.rayoT < 0) { V.rayoT = 2.5 + c.fx() * 3; V.rayo = 1; V3.sfx('bocina'); V.esc.sacudir(.4); }
      }
      V.rayo = Math.max(0, V.rayo - dt * 4);
      V.esc.luces.hemi.intensity = V.hemi0 * (1 + .12 * V.fz) * (1 - .3 * V.tor) + V.rayo * 1.4;
      V.esc.luces.sol.color.copy(V.sol0).lerp(V.solF, Math.max(V.fz * .45, V.cal * .3));
      /* fuegos artificiales al terminar */
      if (fin && gl >= 0) { V.fwT -= dt; if (V.fwT < 0) { V.fwT = .55; V.part.soltar((c.fx() - .5) * 18, 8 + c.fx() * 3, -4, 22, { k: 'chispa', cols: [sideColor(gl), '#ffd23f', '#fffdf2', '#ff5c8a'], vel: 5, arriba: 0, g: 2, vida: 1.1, esc: .8 }); V3.sfx('pop'); } }
    }
    /* la ola, los cangrejos, la malta, el barro que crece y la luz del frenesí (todo por la hora de la partida: igual en todas las pantallas) */
    function playa3D(dt, nowMs, cr) {
      var V = v3, q, e, u, k;
      V.olaG.visible = false;
      for (q = 0; q < EV.length; q++) {
        e = EV[q]; if (e.ty !== 'ola' || nowMs < e.t - 1300 || nowMs > e.t + 900) continue;
        var d = e.sd === 0 ? -1 : 1, ox = V.kx + d * 3.2;
        V.olaG.visible = true;
        if (nowMs < e.t) { u = (nowMs - (e.t - 1300)) / 1300; V.olaG.position.set(ox, 0, -11 + u * 11.3); V.olaG.scale.set(1, .35 + u * 1.15, .8 + u * .5); V.olaM.opacity = .85; V.crestaM.opacity = .9; }
        else { u = (nowMs - e.t) / 900; V.olaG.position.set(ox, 0, .3 + u * 2.5); V.olaG.scale.set(1 + u * .3, 1.5 * (1 - u) + .05, 1.3); V.olaM.opacity = .85 * (1 - u); V.crestaM.opacity = .9 * (1 - u); }
      }
      for (k = 0; k < V.cangs.length; k++) {
        var cg = V.cangs[k]; e = cg.ev; var o = V.pjs[e.p], vis = !!o && nowMs > e.t - 1400 && nowMs < e.t + 2600;
        cg.g.visible = vis; if (!vis) continue;
        var fx0 = o.x + (side[e.p] === 0 ? -1.6 : 1.6), hecho = bit(st.evD, e.id), mordio = hecho && bit(st.evA, e.id), x, z;
        if (nowMs < e.t) { u = cl((nowMs - (e.t - 1400)) / 1400, 0, 1); x = fx0 + (o.x - fx0) * u; z = 5.5 + (o.z + .55 - 5.5) * u; }
        else if (!hecho || (mordio && nowMs < e.t + 1300)) { x = o.x; z = o.z + .55; }
        else { u = cl((nowMs - e.t - (mordio ? 1300 : 400)) / 1000, 0, 1); x = o.x + (side[e.p] === 0 ? -1 : 1) * u * 3; z = o.z + .55 + u * 5; }
        cg.g.position.set(x, 0, z); cg.g.rotation.y = Math.sin(at * 9 + k) * .25;
        var pinza = Math.abs(Math.sin(at * (mordio ? 22 : 10)));
        cg.tz[0].rotation.z = pinza * .6; cg.tz[1].rotation.z = -pinza * .6;
      }
      for (k = 0; k < V.perros.length; k++) {
        var pr = V.perros[k]; e = pr.ev; var dd = e.sd === 0 ? -1 : 1, vis2 = nowMs > e.t - 1500 && nowMs < e.t + 2200, hecho2 = bit(st.evD, e.id), gano2 = hecho2 && bit(st.evA, e.id), px, pz, lado2 = [];
        pr.g.visible = vis2; if (!vis2) continue;
        var cola = -9, cm; for (cm = 0; cm < n; cm++) if (side[cm] === e.sd) { var xx = V.pjs[cm].x * dd; if (xx > cola) cola = xx; }
        var tx2 = (cola + 1.3) * dd;
        if (nowMs < e.t) { u = cl((nowMs - (e.t - 1500)) / 1500, 0, 1); px = tx2 + dd * (1 - u) * 5; pz = 1.2 + (1 - u) * 4; }
        else if (!hecho2 || gano2) { px = tx2 + dd * (gano2 ? cl((nowMs - e.t) / 1000, 0, 1) * 2.5 : 0); pz = 1.2; }
        else { u = cl((nowMs - e.t) / 1000, 0, 1); px = tx2 + dd * u * 6; pz = 1.2 + u * 4; }
        pr.g.position.set(px, Math.abs(Math.sin(at * 12)) * (nowMs < e.t || hecho2 ? .12 : 0), pz); pr.g.rotation.y = nowMs < e.t ? (dd < 0 ? Math.PI : 0) + (dd < 0 ? -.4 : .4) : (dd < 0 ? Math.PI : 0);
        pr.cola.rotation.z = Math.sin(at * 20) * .6; void lado2;
      }
      var mt = null;
      for (q = 0; q < EV.length; q++) if (EV[q].ty === 'malta' && nowMs > EV[q].t - 2500 && !bit(st.evD, q)) mt = EV[q];
      if (mt) { V.malta.visible = true; V.maltaV = null; V.malta.position.set(V.kx, Math.abs(Math.sin(at * 4)) * .15, 1.7); V.malta.rotation.y = at * 2; V.halo.material.opacity = .4 + Math.sin(at * 10) * .25; }
      else if (V.maltaV && at - V.maltaV.t < .6) { u = (at - V.maltaV.t) / .6; V.malta.visible = true; V.malta.position.set(V.maltaV.x + (V.maltaV.sd === 0 ? -1 : 1) * u * 4, Math.sin(u * Math.PI) * 2.5, 1.7 - u); }
      else V.malta.visible = false;
      /* el barro crece en la última tanda; y la luz se pone roja con el frenesí */
      var bk = cr === 2 ? 1.45 : 1; V.barroK += (bk - V.barroK) * Math.min(1, dt * 2);
      V.charco.scale.set(BARRO_R * V.barroK, BARRO_R * .62 * V.barroK, 1);
      var fzT = fase() === 2 && !allDone() ? 1 : 0; V.fz += (fzT - V.fz) * Math.min(1, dt * 1.5);
    }
    function cuerda3D(t) {                            /* puntos de izquierda a derecha: cola en la arena, manos del lado azul, nudo, manos del lado rojo, cola */
      var T = THREE, V = v3, L = [], R = [], p, q, pts = [];
      for (p = 0; p < n; p++) (side[p] === 0 ? L : R).push(V.pjs[p]);
      L.sort(function (a, b) { return a.x - b.x; }); R.sort(function (a, b) { return a.x - b.x; });
      var x0 = L.length ? L[0].x - 1 : V.kx - 4, x1 = R.length ? R[R.length - 1].x + 1 : V.kx + 4;
      var y0 = L.length && L[0].agarra ? .45 : .08, y1 = R.length && R[R.length - 1].agarra ? .45 : .08;
      pts.push(new T.Vector3(x0 - 1.4, .06, .4), new T.Vector3(x0, y0, .2));
      for (q = 0; q < L.length; q++) pts.push(L[q].mano.clone());
      var hl = L.length ? L[L.length - 1].mano : null, hr = R.length ? R[0].mano : null, ky = .08;
      if (hl && hr) ky = (hl.y + hr.y) / 2 - .06; else if (hl || hr) ky = (hl || hr).y;
      var vib = Math.sin(t * 46) * V.tens * .06;
      if (ky > .3) ky += vib;
      pts.push(new T.Vector3(V.kx, ky, hl && hr ? (hl.z + hr.z) / 2 : 0));
      for (q = 0; q < R.length; q++) pts.push(R[q].mano.clone());
      pts.push(new T.Vector3(x1, y1, .2), new T.Vector3(x1 + 1.4, .06, .4));
      var geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 64, .065, 6, false);
      V.cuerda.geometry.dispose(); V.cuerda.geometry = geo;
      V.pano.position.set(V.kx, Math.max(.3, ky - .32), pts[L.length + 2].z); V.pano.rotation.z = Math.sin(t * 6) * .2 + vib * 2;
      V.panoM.color.set(st.pos > 8 ? sideColor(0) : st.pos < -8 ? sideColor(1) : '#fffdf2');
    }
    function cabeza3D(p) { var o = v3.pjs[p]; return o ? v3.esc.proyectar(o.x, 3.2, o.z) : null; }
    function dibujar3D(l) {
      var dt = Math.max(0, Math.min(.05, v3T ? at - v3T : 1 / 60)), now = c.ahora(), cr = curRound(st.k), tl = tally(), q; v3T = at;
      if (dt > 0) actualizar3D(dt, now);
      /* la música suena antes, entre tandas y al final; en la tanda se calla y manda el tambor (si no, dos ritmos se pisan) */
      var enTanda = cr >= 0 && st.k < TE[cr];
      if (enTanda) { if (musOn) { V3.callar(); musOn = false; } }
      else if (now >= 0) { V3.musica('cuerda'); musOn = true; }
      v3.esc.render(dt);
      for (q = 0; q < n; q++) {
        var o = v3.pjs[q], pt = v3.esc.proyectar(o.x, 0, o.z + 1.1), pana = c.yo >= 0 && c.yo < n && q !== c.yo && side[q] === side[c.yo];
        txt(q === c.yo ? 'TÚ' : (pana ? 'PANA' : String(asiento(q).name || '').slice(0, 7)), pt.x, pt.y, 12, q === c.yo ? '#ffd23f' : sideColor(side[q]) === COL_EQ[0] ? '#bfe0ff' : '#ffc4c4', 0, true);
        var pc = cabeza3D(q);
        if (pc && st.s[q].stun > now * 1000 && st.k < TE[2] + grace) txt('✖', pc.x, pc.y - 4, 16, '#ff6b6b', 0, true);
        if (pc) agarre(q, pc.x, pc.y - 24);
      }
      marcador(l, tl, cr);
      carga(l);
      textosFx(l, function (p) { var h = cabeza3D(p); return h ? { x: h.x, y: h.y - 18 } : null; },
        function (p) { var a = cabeza3D(p), b = cabeza3D(mate[p]); return a && b ? { x: (a.x + b.x) / 2, y: 0 } : null; });
      textosEstado(l, tl, cr, 560, 578, '#fffdf2');
      if ((lv === 2 || cr === 2) && enTanda && st.k >= TS[cr] + 24) txt('EN EL BARRO, FALLAR ATURDE EL DOBLE', l.cx, 596, 12, '#fffdf2', 0, true);
      if (typeof drawP === 'function') drawP();
    }
    function draw() {
      if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
      if (v3) return dibujar3D(lay());
      dibujar2D();
    }

    function ganaLado() { var tl = tally(), a = scSide(0, tl), b = scSide(1, tl); return a === b ? -1 : (a > b ? 0 : 1); }
    return {
      update: update, draw: draw, ai: ai,
      step: step, pack: pack, unpack: load, restore: load, lerp: lerp,
      scores: scores,
      done: function () { return allDone(); },
      vivo: function () { return true; },
      alCpu: function (p) { if (cpr[p]) { cpr[p].plan = []; cpr[p].round = -1; } }, alHum: function () {},
      hudChip: function (p) { var tl = tally(), sd = side[p]; if (sd === undefined) return ''; return tl.w[sd] + '-' + tl.w[1 - sd]; },
      destacado: function () {
        var tl = tally(), j, bj = -1, bv = 0;
        for (j = 0; j < n; j++) if (st.s[j].pulls > bv) { bv = st.s[j].pulls; bj = j; }
        return '¡' + tl.w[0] + ' – ' + tl.w[1] + ' en tandas!' + (bj >= 0 ? ' Más tirones: ' + asiento(bj).name : ' Nadie halaba');
      },
      vista: function () {
        var o = { k: st.k, pos: st.pos, res: st.res.slice(), sc: scores(), w: tally().w, adv: tally().adv, gana: ganaLado(), U: U, TS: TS.slice(), TE: TE.slice(), FIN: FIN.slice(), beats: beats.map(function (b) { return b.slice(); }),
          fakes: fakes.map(function (b) { return b.slice(); }), side: side.slice(), equipos: teams.slice(), winMs: winMs, dobleMs: dobleMs, queue: queue.length, dobles: dobles.slice(), offEma: offEma.slice(), lat: latMs.slice(),
          ev: EV.map(function (x) { return { ty: x.ty, r: x.r, t: x.t, j: x.j, sd: x.sd, p: x.p, id: x.id }; }), maltaDe: maltaDe.slice(), dodgeMs: dodgeMs,
          rch: st.rch.slice(), rb: st.rb.slice(), bc: st.bc, evD: st.evD, evA: st.evA, evB: st.evB, fase: fase(),
          last: [], used: [], stun: [], e: [], mt: [], pulls: [], fouls: [], grip: [], dodge: [] }, j;
        for (j = 0; j < n; j++) { var s = st.s[j]; o.last.push(s.last); o.used.push(s.used); o.stun.push(s.stun); o.e.push(s.e.slice()); o.mt.push(mtOf(s)); o.pulls.push(s.pulls); o.fouls.push(s.fouls); o.grip.push(s.grip); o.dodge.push(s.dodge); }
        return o;
      }
    };
  }
});
})();
