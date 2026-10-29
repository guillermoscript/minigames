'use strict';
/* LA FIESTA · ¡LA ABUELA DICE! (f_abuela) · modelo A (cancha propia) · supervivencia
   La abuela canta órdenes desde la cocina: «¡ARRIBA LA AREPA!» (A) o «¡ABAJO LA CHANCLA!» (B). Solo vale la orden que empieza por «LA ABUELA DICE:».
   Si la orden viene sin el prefijo (o, en el nivel 3, con la voz del ABUELO) es trampa: hay que quedarse quieto.
   La lista de órdenes es función PURA de (semilla, dur): `rondas` sale de c.rng en mk, así que las n pantallas ven las mismas órdenes en los mismos instantes
   (gt, reloj compartido). Cada dueño juzga SU respuesta dentro de la ventana [T, T+W] y la hora del fallo es el plazo D=T+W (determinista), de modo que
   kk = floor(D*30) es igual para cualquier observador. Los rivales se ven EN VIVO por el `o` (pose, st, sc): se ve cómo se equivocan los demás.
   Reglas (doc 08 §9.2 #13):
     - Orden real: gana quien da el botón correcto como PRIMER toque dentro de la ventana. Botón equivocado, ambos a la vez, o nada a tiempo = fuera.
     - Trampa: cualquier toque dentro de la ventana = fuera; quedarse quieto la supera.
     - La pose se reinicia en cada orden (no vale adelantarse). Fuera de la ventana se puede mover el cuerpo sin castigo.
     - Nivel 1/2/3: ventana 1,2 / 0,9 / 0,6 s al inicio, encogiéndose ~30 % hacia el final; trampas 20 / 28 / 36 %; nivel 3: trampa con la voz del abuelo.
     - Puntaje: eliminado = tick del plazo fallado; vivo al final = dur*30+1. done() = queda <=1 vivo. Empatan los que llegan al final o caen en la misma orden.
   La fiesta se va poniendo brava (fases por gt/dur, sirve igual en relámpago dur 10):
     - CALMA (< 33 %): órdenes sencillas, pocas trampas. SE PONE BRAVA (33–72 %): más trampas, menos pausa, COMBOS («¡ARRIBA Y ABAJO!»: dos toques en orden).
     - ¡ÚLTIMOS SEGUNDOS! (≥ 72 %): pausas cortas, ventanas más chiquitas, 40 % combos, trampas ×1,3; música más rápida y bombillos locos.
     - Eventos del patio (sembrados en mk, avisados ~1 s antes con cartel): EL LORO (se alborota y en la 2.ª orden del bloque canta «EL LORO DICE:» = trampa),
       APAGÓN (se va la luz: la orden se ve a ratos, en destellos) y AL REVÉS (en el final: ARRIBA = B, ABAJO = A durante el bloque).
     - Un combo se juzga toque a toque: cada toque tiene que ser el que toca; un toque malo o quedarse corto al plazo = fuera.
   Teclado: ESPACIO/J = ARRIBA (A), SHIFT/K = ABAJO (B); flecha arriba/abajo también valen (eje). Se carga DESPUÉS de fiesta-live.js. Dibuja SOLO con las primitivas del laboratorio. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_abuela')) return;

var INKC = '#14101c', LEAD = 2.6, GRACIA = 0.05, TRAMPA_DESDE = 3;
var CFG = {
  1: { w0: 1.20, w1: 0.84, g0: 1.00, g1: 0.62, trampa: 0.20 },
  2: { w0: 0.90, w1: 0.63, g0: 0.90, g1: 0.56, trampa: 0.28 },
  3: { w0: 0.60, w1: 0.46, g0: 0.80, g1: 0.52, trampa: 0.36 }
};
var TXT = ['¡ARRIBA LA AREPA!', '¡ABAJO LA CHANCLA!'], VOZ_TXT = ['LA ABUELA DICE:', 'EL ABUELO DICE:', '', 'EL LORO DICE:'];
var TXT2 = ['¡DOS VECES ARRIBA!', '¡ARRIBA Y ABAJO!', '¡ABAJO Y ARRIBA!', '¡DOS VECES ABAJO!'];   // combos: seq[0]*2 + seq[1]
var FASE_U = [0.33, 0.72];                                          // CALMA | SE PONE BRAVA | ¡ÚLTIMOS SEGUNDOS!
var FASE_TXT = [null, ['¡SE PONE BRAVA!', 'ahora vienen combos y más trampas', '#ff8a3d'], ['¡ÚLTIMOS SEGUNDOS!', '¡la abuela canta rapidito!', '#ff3b4e']];
var EV_TXT = {
  loro: ['¡SE ALBOROTÓ EL LORO!', 'si lo dice el loro, ¡quieto!', '#3fbf4a'],
  apagon: ['¡SE FUE LA LUZ!', 'la orden se ve a ratos', '#ffd23f'],
  reves: ['¡LA ABUELA DICE: AL REVÉS!', 'ARRIBA = B · ABAJO = A', '#a98bff']
};
function faseDe(u) { return u >= FASE_U[1] ? 2 : u >= FASE_U[0] ? 1 : 0; }

function lerp(a, b, u) { return a + (b - a) * u; }
function cl01(u) { return u < 0 ? 0 : u > 1 ? 1 : u; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* paleta por nivel: 1 día, 2 atardecer, 3 noche (cocina con el foco prendido) */
var PAL = {
  1: { pared: '#ffe9b8', azul: '#7fc8e8', azul2: '#5aa8cc', meson: '#c98a50', mesonT: '#e2a868', piso: '#d9b38a', piso2: '#c79c72', ven: '#bfe9ff', sombra: 'rgba(20,16,28,.28)' },
  2: { pared: '#f6b98a', azul: '#c98a8a', azul2: '#a96a78', meson: '#a8683a', mesonT: '#c98a50', piso: '#b98a6a', piso2: '#a67858', ven: '#ffb06a', sombra: 'rgba(20,16,28,.32)' },
  3: { pared: '#4a4478', azul: '#3a5a8a', azul2: '#2f4a74', meson: '#6a4a3a', mesonT: '#8a6648', piso: '#4a3a52', piso2: '#3e3046', ven: '#1d1a4a', sombra: 'rgba(0,0,0,.4)' }
};

FIESTA.LIVE.add('f_abuela', {
  name: '¡LA ABUELA DICE!', modos: ['ffa', '1v1'], clase: 'survival', modelo: 'A', dur: 45,
  stick: false, botones: 2, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
  cuerpo: ['pose', 'st', 'sc'], discretos: ['pose', 'st', 'sc'],
  carta: {
    obj: 'Haz lo que diga la abuela... solo si lo dice la abuela',
    gana: 'El último en pie. Si quedan varios, empatan arriba.',
    como: { tactil: 'A = ARRIBA la arepa · B = ABAJO la chancla', teclado: 'ESPACIO o J = arriba · SHIFT o K = abajo' },
    demos: [
      { id: 'real', txt: '«LA ABUELA DICE: ¡ARRIBA LA AREPA!»: toca A antes de que se acabe la barra' },
      { id: 'trampa', txt: 'Sin «LA ABUELA DICE» (o si lo dice el abuelo o el loro) es trampa: ¡no toques nada! Al final vienen combos y AL REVÉS' }
    ],
    roles: null
  },
  mk: function (c) {
    var n = c.n, dur = c.dur, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, pal = PAL[lv], cfg = CFG[lv], rng = c.rng;

    /* ───── el mundo: lista de órdenes, idéntica en todos (solo c.rng, solo aquí) ───── */
    var rondas = [], t = LEAD, k = 0, trampasSeguidas = 0, i;
    for (;;) {
      var u = cl01(t / dur), fa = faseDe(u), W = lerp(cfg.w0, cfg.w1, u) * (fa === 2 ? 0.92 : 1);
      if (t + W > dur - 0.2) break;
      var combo = fa >= 1 && k >= TRAMPA_DESDE && rng.next() < (fa === 2 ? 0.4 : 0.18), Wr = combo ? W * 1.55 + 0.2 : W;
      if (combo && t + Wr > dur - 0.2) { combo = false; Wr = W; }
      var dir = rng.next() < 0.5 ? 0 : 1, n1 = rondas.length;
      if (n1 >= 2 && rondas[n1 - 1].dir === dir && rondas[n1 - 2].dir === dir) dir = 1 - dir;
      var seq = [dir];
      if (combo) seq.push(rng.next() < 0.7 ? 1 - dir : dir);
      var real = !(k >= TRAMPA_DESDE && trampasSeguidas < 2 && rng.next() < cfg.trampa * [0.7, 1, 1.3][fa]);
      var voz = real ? 0 : (lv === 3 && rng.next() < 0.6 ? 1 : 2);
      trampasSeguidas = real ? 0 : trampasSeguidas + 1;
      rondas.push({ T: t, W: Wr, D: t + Wr, dir: dir, seq: seq, real: real, voz: voz, fa: fa, inv: false, apa: false, ev: -1 });
      t += Wr + lerp(cfg.g0, cfg.g1, u) * [1, 0.9, 0.72][fa]; k++;
    }
    var N = rondas.length;
    /* eventos del patio: bloques de órdenes seguidas, sembrados aquí (mismo rng => mismos eventos en todas las pantallas) */
    var evs = [];
    function bloque(kind, desde, hasta, largo) {
      var j;
      for (j = TRAMPA_DESDE; j < N; j++) if (rondas[j].T / dur >= desde && rondas[j].ev < 0 && (j === 0 || rondas[j - 1].ev < 0)) break;
      if (j >= N || rondas[j].T / dur >= hasta) return;
      var r1 = j, x;
      while (r1 + 1 < N && r1 + 1 - j < largo && rondas[r1 + 1].ev < 0) r1++;
      if (kind === 'loro' && r1 - j < 1) return;                        // el loro necesita al menos dos órdenes (la suya es la 2.ª)
      var e = { k: kind, r0: j, r1: r1, T0: Math.max(j > 0 ? rondas[j - 1].D + 0.1 : 0, rondas[j].T - 1.1), T1: rondas[r1].D + 0.35 };
      for (x = j; x <= r1; x++) {
        var R = rondas[x]; R.ev = evs.length;
        if (kind === 'apagon') R.apa = true;
        else if (kind === 'reves') { R.inv = true; R.seq = [R.dir]; }      // al revés: órdenes sencillas (ya es bastante lío)
        else if (kind === 'loro') {
          if (x === j + 1) { R.real = false; R.voz = 3; R.seq = [R.dir]; }   // la del loro: trampa
          else { R.real = true; R.voz = 0; }                            // las del bloque, de la abuela de verdad (no hay tres trampas seguidas)
        }
      }
      evs.push(e);
    }
    if (rng.next() < 0.5) { bloque('loro', 0.36, FASE_U[1], 3); bloque('apagon', 0.52, FASE_U[1], 3); }
    else { bloque('apagon', 0.36, FASE_U[1], 3); bloque('loro', 0.52, FASE_U[1], 3); }
    bloque('reves', FASE_U[1] + 0.03, 2, 3);
    for (i = 0, trampasSeguidas = 0; i < N; i++) {                     // nunca tres trampas seguidas (el loro pudo armar una racha)
      if (rondas[i].real) { trampasSeguidas = 0; continue; }
      if (++trampasSeguidas > 2) { rondas[i].real = true; rondas[i].voz = 0; trampasSeguidas = 0; }
    }
    function esperado(R, i) { return R.inv ? 1 - R.seq[i] : R.seq[i]; }    // botón (0 = A, 1 = B) que pide el toque i
    function evEn(gt) { var j; for (j = 0; j < evs.length; j++) if (gt >= evs[j].T0 && gt <= evs[j].T1) return evs[j]; return null; }
    var humo = [];                                    // vaporcito de la olla (sembrado, igual en todas)
    for (i = 0; i < 6; i++) humo.push([rng.next(), rng.next()]);

    /* ───── estado por jugador ───── */
    var P = [], plan = [];
    for (i = 0; i < n; i++) {
      P.push({ pose: 0, st: 0, sc: 0, own: false, rs: 0, cur: -1, hecha: -1, prog: 0, ey: 0, outAt: -9, pasa: 0 });
      plan.push({ k: -1, q: [] });
    }
    var sndK = -1, absT = 0;                          // absT: reloj cosmético (avanza en update)

    function SND(f, d, ty, v) { if (v3) return; try { if (typeof snd === 'function') snd(f, d, ty, v); } catch (e) { /* sin audio */ } }
    function mio(p) { return c.mio(p); }
    function elim(p, kk) {
      var q = P[p];
      if (q.st) return;
      q.st = 1; q.sc = Math.max(0, kk | 0); q.pose = 0; q.outAt = c.ahora();
    }
    function ronda(gt) { var j = -1; while (j + 1 < N && rondas[j + 1].T <= gt) j++; return j; }   // última ronda ya empezada
    function falla(p, r) {                            // el dueño pierde en la ronda r (plazo determinista)
      var kk = Math.floor(rondas[r].D * 30);
      elim(p, kk); c.out(p, kk);
      if (p === c.yo) SND(160, 0.35, 'sawtooth', 0.06);
    }

    function updJugador(p, gt) {
      var q = P[p];
      if (!mio(p)) {                                  // remoto: lo que manda su dueño (o el juez si es CPU)
        q.own = false;
        var r = c.remoto(p);
        if (r) { if (!q.st) q.pose = r.pose || 0; if (r.st && !q.st) elim(p, r.sc); }
        return;
      }
      var a = c.tap(p, 'a'), b = c.tap(p, 'b'), ey = c.eje(p).y;
      if (ey < -0.5 && q.ey >= -0.5) a++;             // flecha arriba / abajo del teclado = A / B
      if (ey > 0.5 && q.ey <= 0.5) b++;
      q.ey = ey;
      if (!q.own) {                                   // empiezo o heredo (juez que toma una CPU): la ronda en curso no me la cobran
        q.own = true; q.rs = ronda(gt) + 1; q.cur = -1; q.prog = 0; q.hecha = ronda(gt);
      }
      if (q.st) { q.pose = 0; return; }
      if (gt < 0) return;
      while (q.rs < N && rondas[q.rs].T <= gt) { q.pose = 0; q.cur = q.rs; q.prog = 0; q.rs++; }   // empieza una orden: pose limpia
      var R = q.cur >= 0 ? rondas[q.cur] : null, dentro = R && q.hecha < q.cur && gt <= R.D + GRACIA;
      if (a > 0 || b > 0) {
        var btn = a > 0 && b > 0 ? 3 : a > 0 ? 1 : 2, veces = btn === 1 ? a : btn === 2 ? b : 1;
        q.pose = btn === 3 ? 0 : btn;
        while (dentro && veces-- > 0) {               // cada toque dentro de la ventana cuenta (un combo pide dos)
          if (!R.real || btn === 3 || btn !== esperado(R, q.prog) + 1) { q.hecha = q.cur; falla(p, q.cur); return; }
          q.prog++;
          if (q.prog >= R.seq.length) { q.hecha = q.cur; q.pasa++; dentro = false; if (p === c.yo) SND(660, 0.08, 'triangle', 0.05); }   // orden cumplida
          else if (p === c.yo) SND(520, 0.06, 'triangle', 0.04);
        }
      }
      if (R && q.hecha < q.cur && gt > R.D + GRACIA) {   // se acabó la ventana
        q.hecha = q.cur;
        if (R.real) falla(p, q.cur); else q.pasa++;   // no hizo nada: a la trampa se sobrevive
      }
    }

    function vivos() { var j = 0, p; for (p = 0; p < n; p++) if (!P[p].st) j++; return j; }
    function pose(p) {                                // lo que se dibuja de p (remoto en vivo desde el interpolador)
      var q = P[p], r = !mio(p) ? c.remoto(p) : null;
      if (r) return { pose: q.st ? 0 : (r.pose || 0), st: q.st || (r.st ? 1 : 0) };
      return { pose: q.pose, st: q.st };
    }
    function campo() {                                // la vista real puede ser más angosta que c.campo() (vertical ≈ 340)
      var f = c.campo();
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width, y0: f.y0, y1: f.y1 };
      return f;
    }

    /* ───── dibujo ───── */
    function cocina(x0, x1, gt) {
      var w = x1 - x0, j, p = pal;
      rr(x0, 0, w, 340, 0, p.pared, 0);
      rr(x0, 214, w, 126, 0, p.azul, 0);                                // zócalo de azulejos
      for (j = x0 + 24; j < x1; j += 48) line([[j, 214], [j, 340]], 2, p.azul2);
      for (j = 244; j < 340; j += 36) line([[x0, j], [x1, j]], 2, p.azul2);
      line([[x0, 214], [x1, 214]], 4, INKC);
      rr(x0, 340, w, 270, 0, p.piso, 0);
      for (j = x0 + 30; j < x1 + 60; j += 60) line([[j, 340], [j - 40, 600]], 2, p.piso2);
      line([[x0, 340], [x1, 340]], 4, INKC);
      if (lv === 3) {                                                  // foco colgado: la luz parpadea con el apagón
        var par = Math.sin(gt * 9) > 0.92 ? 0.55 : 1;
        line([[x1 - 40, 0], [x1 - 40, 44]], 3, INKC); ell(x1 - 40, 54, 20 * par, 20 * par, 'rgba(255,226,122,.35)', 0); ell(x1 - 40, 54, 9, 9, '#ffe27a', 2);
      } else if (w >= 520) {                                           // ventana al patio
        rr(x0 + 38, 92, 96, 84, 8, p.ven, 4); line([[x0 + 86, 92], [x0 + 86, 176]], 4, INKC); line([[x0 + 38, 134], [x0 + 134, 134]], 4, INKC);
      }
      if (w >= 520) {                                                  // la olla de la sopa, colgada de un clavo
        ell(x1 - 90, 170, 30, 22, '#8a8aa0', 4); rr(x1 - 122, 150, 64, 10, 5, '#a8a8c0', 3.5);
      }
    }
    function mesonDib(x0, x1, gt) {                                    // el mesón de la abuela: tapa la mitad del cuerpo y trae la olla humeante
      var w = x1 - x0, j;
      rr(x0 - 8, 286, w + 16, 58, 0, pal.meson, 4); rr(x0 - 8, 280, w + 16, 14, 0, pal.mesonT, 4);
      var ox = x0 + w * 0.2, oy = 276;
      rr(ox - 24, oy - 20, 48, 24, 8, '#6a6a86', 3.5); rr(ox - 28, oy - 24, 56, 8, 4, '#8a8aa8', 3);
      for (j = 0; j < humo.length; j++) {                              // vapor de la olla
        var ph = (gt * 0.6 + humo[j][0]) % 1, hx = ox + (humo[j][1] - 0.5) * 22 + Math.sin(gt * 3 + j) * 4;
        ell(hx, oy - 30 - ph * 46, 5 + ph * 6, 5 + ph * 6, 'rgba(255,255,255,' + (0.5 * (1 - ph)).toFixed(2) + ')', 0);
      }
      var px = x1 - w * 0.2;                                           // plato de arepas
      ell(px, 278, 34, 9, '#fffdf2', 3);
      for (j = 0; j < 3; j++) ell(px - 16 + j * 16, 270 - (j === 1 ? 4 : 0), 13, 8, '#f2c46d', 3);
    }
    function vozDib(cx, gt, activa, voz, hablando) {                   // la abuela (o el abuelo del nivel 3) tras el mesón: delantal + cara del reparto
      var bob = Math.sin(gt * 3) * 3, col = voz === 1 ? '#4a6fb5' : '#e8553d';
      rr(cx - 36, 250 + bob, 72, 60, 16, col, 4);
      rr(cx - 14, 262 + bob, 28, 30, 8, '#fffdf2', 3);                  // el delantal
      c.util.pj(voz === 1 ? 'tio' : 'abuela', cx, 222 + bob, 112, { animo: hablando ? 'hablar' : 'esperar', sombra: false });
    }
    function globo(cx, w, gt, ronda0, rr0) {                           // el globo con la orden y la barra de la ventana
      var bw = Math.min(w - 24, 440), bx = cx - bw / 2, by = 72, bh = 78, R = rr0 >= 0 ? rondas[rr0] : null;
      var activa = R && gt >= R.T && gt <= R.D, pre = gt < LEAD - 0.15, linea1 = '', linea2 = '', fill = '#fffdf2', col1 = '#c4283a', col2 = INKC;
      if (pre) { linea1 = '¡ATENTOS A LA ABUELA!'; linea2 = 'A = ARRIBA · B = ABAJO'; col2 = '#2a5a9a'; }
      else if (activa) {
        linea1 = VOZ_TXT[R.voz]; linea2 = R.seq.length > 1 ? TXT2[R.seq[0] * 2 + R.seq[1]] : TXT[R.dir];
        if (R.voz === 2) { fill = '#e4dccf'; }
        if (R.voz === 1) col1 = '#2a5a9a';
        if (R.voz === 3) { col1 = '#1f8a2c'; fill = '#e6f6dc'; }
        if (R.apa && ((gt - R.T) * 2.6) % 1 > 0.5) { linea1 = ''; linea2 = '...'; fill = '#2a2438'; col2 = '#5a5070'; }   // apagón: la orden se ve a destellos
      } else if (R && !R.real && gt - R.D < 0.8) { linea1 = R.voz === 3 ? '¡CUÁ CUÁ!' : '¡JAJÁ!'; linea2 = R.voz === 3 ? '¡ESA LA DIJO EL LORO!' : '¡ESA NO LA DIJE YO!'; col1 = '#c4283a'; col2 = '#6a3a1a'; fill = '#fff2c4'; }
      else { linea2 = '...'; col2 = '#8a7a6a'; fill = R && R.apa ? '#2a2438' : '#f4ecdc'; }
      rr(bx, by, bw, bh, 16, fill, 4);
      poly([[cx - 12, by + bh - 2], [cx + 12, by + bh - 2], [cx, by + bh + 16]], fill, 3.5);
      if (linea1) txt(linea1, cx, by + 17, Math.min(15, bw / 17), col1, 0, true);
      var l2 = Math.min(pre ? 17 : 26, (bw - (activa && bw >= 300 ? 92 : 28)) / (linea2.length * 0.68));
      txt(linea2, cx, by + (linea1 ? 43 : 38), Math.max(10, l2), col2, 0, !activa && !pre ? true : false);
      if (activa) {
        var u = cl01((R.D - gt) / R.W), bw2 = bw - 36;
        rr(bx + 18, by + bh - 17, bw2, 8, 4, 'rgba(20,16,28,.2)', 0);
        rr(bx + 18, by + bh - 17, Math.max(6, bw2 * u), 8, 4, u > 0.5 ? '#3fbf6a' : u > 0.25 ? '#ffd23f' : '#ff3b4e', 0);
        var ix = bx + 24, iy = by + 43;                                 // icono: flecha + objeto
        if (bw >= 300) {
          if (R.dir === 0) { poly([[ix, iy - 11], [ix + 12, iy + 8], [ix - 12, iy + 8]], '#3fbf6a', 3); ell(bx + bw - 28, iy, 15, 11, '#f2c46d', 3); ell(bx + bw - 28, iy - 1, 8, 5, '#ffe9a8', 0); }
          else { poly([[ix, iy + 11], [ix + 12, iy - 8], [ix - 12, iy - 8]], '#4aa0e8', 3); rr(bx + bw - 44, iy - 8, 34, 16, 8, '#e8553d', 3); line([[bx + bw - 34, iy - 8], [bx + bw - 30, iy - 14]], 4, INKC); }
        }
        var yo = c.yo >= 0 && c.yo < n ? P[c.yo] : null, j;
        if (R.seq.length > 1 && yo && !yo.st) for (j = 0; j < R.seq.length; j++)   // combo: mis toques hechos (puntitos)
          ell(cx - 9 + j * 18, by + bh + 26, 6, 6, yo.cur === rr0 && yo.prog > j ? '#3fbf6a' : '#fffdf2', 2.5);
      }
      if (R && R.inv && gt >= R.T - 0.2 && gt <= R.D + 0.3) {             // al revés: el sello con la regla, siempre a la vista
        rr(cx - 104, by - 22, 208, 22, 10, '#a98bff', 3);
        txt('AL REVÉS: ARRIBA = B · ABAJO = A', cx, by - 11, Math.min(12, bw / 30), '#fffdf2', 0, true);
      }
    }
    function cartel(cx, w, gt) {                                       // los avisos grandes: cambio de fase y evento del patio que viene
      if (gt < 0) return;
      var j, k, e = null, f = null, a0 = 0;
      for (j = 1; j <= 2; j++) { var tf = FASE_U[j - 1] * dur; if (gt >= tf && gt - tf < 1.6) { f = FASE_TXT[j]; a0 = gt - tf; } }
      for (k = 0; k < evs.length; k++) if (gt >= evs[k].T0 && gt - evs[k].T0 < 1.4) { e = EV_TXT[evs[k].k]; a0 = gt - evs[k].T0; }
      var m = e || f;
      if (!m) return;
      var bw = Math.min(w - 20, 360), y = 196 + Math.sin(a0 * 14) * (a0 < 0.4 ? 4 : 0), s = a0 < 0.15 ? 0.6 + a0 * 2.6 : 1;
      rr(cx - bw / 2 * s, y - 22, bw * s, 46, 12, m[2], 4);
      txt(m[0], cx, y - 6, Math.min(20, bw / (m[0].length * 0.62)) * s, '#fffdf2', 0, true);
      txt(m[1], cx, y + 13, Math.min(12, bw / (m[1].length * 0.6)), INKC, 0, true);
    }
    function dibujaJugador(p, gt, sp, x, gy) {
      var q = P[p], ps = pose(p), s = c.seats[p], ch = s.ch, z = clamp(sp / 105, 0.62, 1.15), po = ps.pose;
      if (!ps.st) {
        var ys = po === 2 ? 18 * z : po === 1 ? -14 * z : 0, hy = gy - 98 * z + ys, f = 4 * z, sk = '#e8b48a', dx = 40 * z;
        ell(x, gy + 6, 34 * z, 7 * z, pal.sombra, 0);
        c.util.pj(ch, x, hy, 86 * z, { animo: po === 1 ? 'celebrar' : po === 2 ? 'esperar' : null, sombra: false });
        if (po === 1) {                                               // brazos arriba con la arepa sobre la cabeza
          line([[x - dx, hy + 38 * z], [x - 30 * z, hy - 58 * z]], 9 * z + f, INKC); line([[x - dx, hy + 38 * z], [x - 30 * z, hy - 58 * z]], 9 * z, sk);
          line([[x + dx, hy + 38 * z], [x + 30 * z, hy - 58 * z]], 9 * z + f, INKC); line([[x + dx, hy + 38 * z], [x + 30 * z, hy - 58 * z]], 9 * z, sk);
          ell(x, hy - 66 * z, 26 * z, 13 * z, '#f2c46d', 3); ell(x, hy - 68 * z, 14 * z, 6 * z, '#ffe9a8', 0);
        } else if (po === 2) {                                        // agachado: brazos abajo con la chancla
          line([[x - dx, hy + 30 * z], [x - dx - 6 * z, hy + 92 * z]], 9 * z + f, INKC); line([[x - dx, hy + 30 * z], [x - dx - 6 * z, hy + 92 * z]], 9 * z, sk);
          line([[x + dx, hy + 30 * z], [x + dx + 6 * z, hy + 92 * z]], 9 * z + f, INKC); line([[x + dx, hy + 30 * z], [x + dx + 6 * z, hy + 92 * z]], 9 * z, sk);
          rr(x + dx - 6 * z, hy + 86 * z, 40 * z, 15 * z, 7 * z, '#e8553d', 3); line([[x + dx + 8 * z, hy + 86 * z], [x + dx + 12 * z, hy + 77 * z]], 3.5, INKC);
        }
      } else {                                                        // se equivocó: patas arriba con el chancletazo
        ell(x, gy + 2, 52 * z, 10 * z, pal.sombra, 0);
        ctx.save(); ctx.translate(x, gy - 32 * z); ctx.rotate(-1.35 * (p % 2 ? -1 : 1)); c.util.pj(ch, 0, 0, 80 * z, { animo: 'perder' }); ctx.restore();
        txt('X', x + 30 * z, gy - 62 * z, 22 * z, '#ff3b4e');
        var edad = gt - q.outAt;
        if (edad >= 0 && edad < 1.5 && q.outAt > -1) {
          var by = clamp(gy - 118 * z - Math.min(edad, 0.4) * 14, 300, 400);
          rr(x - 38, by - 12, 76, 24, 10, '#fffdf2', 3);
          txt('¡FUERA!', x, by, 14, '#c4283a', 0, true);
        }
      }
    }

    function dibujar2D() {                                          // el 2D de siempre (sin WebGL o con ?plano=1)
      var cp = campo(), gt = c.ahora(), w = cp.x1 - cp.x0, cx = (cp.x0 + cp.x1) / 2, p, rk = ronda(gt), R = rk >= 0 ? rondas[rk] : null;
      cocina(cp.x0, cp.x1, gt);
      var hablando = R && gt >= R.T && gt <= R.D + 0.2;
      vozDib(cx, gt, !!hablando, hablando ? R.voz : 0, !!hablando);
      mesonDib(cp.x0, cp.x1, gt);
      var sp = Math.min(150, (w - 24) / Math.max(1, n)), gy = 405;
      for (p = 0; p < n; p++) dibujaJugador(p, gt, sp, cx + (p - (n - 1) / 2) * sp, gy);
      var ev = evEn(gt);
      if (ev && ev.k === 'apagon' && gt >= rondas[ev.r0].T - 0.3) rr(cp.x0, 0, w, 620, 0, 'rgba(10,8,24,.6)', 0);   // se fue la luz
      if (faseDe(cl01(gt / dur)) === 2 && !finJuego(gt) && Math.floor(gt * 4) % 2) rr(cp.x0, 0, w, 8, 0, '#ff3b4e', 0);   // final: la franja roja late
      globo(cx, w, gt, rk, rk);
      cartel(cx, w, gt);
      var yo = c.yo >= 0 ? c.yo : -1;
      if (yo >= 0 && !P[yo].st) {                                   // marca de TÚ bajo los pies (los brazos suben, el marcador no estorba)
        var xx = cx + (yo - (n - 1) / 2) * sp;
        poly([[xx - 9, gy + 24], [xx + 9, gy + 24], [xx, gy + 12]], '#ffd23f', 3); txt('TÚ', xx, gy + 38, 15, '#ffd23f');
      }
    }

    /* ───── 3D low poly (fiesta-3d.js): el patio de la casa de la abuela. Solo dibujo: lee rondas, P y pose(); no toca la simulación ─────
       La abuela (grande, en el escalón del corredor) hace cada pose y los jugadores la imitan con su personaje cuando tocan:
       ARRIBA = la misma pose de brazos arriba que ella (cargar / celebrar / aire, según la orden) con la arepa en la mano; ABAJO = agachados con la chancla.
       Acierto = cara feliz + ding; error = cara triste + error, y la abuela le tira un chancletazo. En el nivel 3 el abuelo se para de la mecedora y hace la trampa. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', piso: '#d9875a', junta: '#b8a48a', pared: '#fff1c2', zoc: '#4a9ad0', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', piso: '#c9784e', junta: '#a8907a', pared: '#ffd9a8', zoc: '#3a82b8', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', piso: '#8a5a4a', junta: '#5a4a62', pared: '#b8a8c8', zoc: '#2f5a8a', noche: 1 }
    };
    var VARIA = ['cargar', 'celebrar', 'aire'];                          // las poses de ARRIBA (cada orden trae la suya); ABAJO = agachado
    var AZ = -5, ABZ = .35, ESC_AB = 2.3, JZ = 1.4;                     // la abuela (z, alto del escalón, tamaño) y la fila de jugadores
    var BANCOS = [[-8.3, -2.3, Math.PI / 2], [8.3, -2.3, -Math.PI / 2], [-8.3, -.5, Math.PI / 2], [8.3, -.5, -Math.PI / 2]];
    var CONF3 = ['#ff5c8a', '#ffd23f', '#3fa9ff', '#5cff7a', '#ff8a3d', '#a98bff'];
    function asiento(p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; }
    function animDe(rk) { var R = rondas[rk]; return R.dir === 0 ? VARIA[rk % 3] : 'sentado'; }
    function jx(p) { var sp = Math.min(3.3, 13 / Math.max(1, n)); return (p - (n - 1) / 2) * sp; }
    function finJuego(now) { return (n > 1 ? vivos() <= 1 : vivos() === 0) || now >= dur; }
    function cosas(T, M) {                                               // la arepa y la chancla que se cuelgan de la mano (medidas locales del personaje)
      var ar = new T.Group(), a1 = M(new T.CylinderGeometry(.19, .19, .08, 10), '#f2c46d', { g: .1 }); a1.rotation.x = Math.PI / 2; ar.add(a1);
      var a2 = M(new T.CylinderGeometry(.12, .12, .085, 8), '#e0a850', { borde: false }); a2.rotation.x = Math.PI / 2; a2.position.z = .005; ar.add(a2);
      ar.position.set(0, .12, 0); ar.visible = false;
      var ch = new T.Group(), s1 = M(new T.BoxGeometry(.17, .05, .42), '#ff5c8a', { g: .1 }); s1.position.set(0, -.05, .12); ch.add(s1);
      var s2 = M(new T.TorusGeometry(.06, .018, 4, 8, Math.PI), '#ffd23f', { borde: false }); s2.position.set(0, -.02, .07); ch.add(s2);
      ch.rotation.x = -.4; ch.visible = false;
      return { ar: ar, ch: ch };
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 50, 130], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 10);
      V3.pista('abuela', { bpm: 124, acordes: [[57, 60, 64], [50, 53, 57], [55, 59, 62], [48, 52, 55]],   // gaita de diciembre en La menor: i–iv–VII–III
        mel: [76, 0, 76, 74, 72, 0, 74, 76, 77, 0, 76, 74, 72, 0, 0, 0, 74, 0, 74, 72, 71, 0, 72, 74, 76, 0, 72, 0, 69, 0, 0, 0] });
      V3.pista('abuela2', { bpm: 158, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],   // ¡últimos segundos!: la misma gaita, acelerada y con el V
        mel: [76, 76, 74, 76, 77, 76, 74, 72, 74, 74, 72, 74, 76, 74, 72, 71, 72, 72, 74, 76, 77, 79, 77, 76, 74, 0, 71, 0, 69, 0, 69, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* piso: baldosas de terracota del patio */
      var bald = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.junta; x.fillRect(0, 0, w, h);
        for (var j = 0; j < 4; j++) for (var i = 0; i < 4; i++) { var sh = ((i * 7 + j * 13) % 5) / 5; x.fillStyle = V3.oscurecer(pl.piso, .9 + sh * .14); x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58); }
      }, [26, 18]);
      var piso = new T.Mesh(new T.PlaneGeometry(110, 76), new T.MeshToonMaterial({ map: bald, gradientMap: V3.toon('#fff').gradientMap }));
      piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      /* la casa: pared del fondo con zócalo azul, puerta, ventanas con reja, corredor con columnas y techo de tejas */
      var pared = M(new T.BoxGeometry(34, 7, .5), pl.pared, { recibe: true, g: .012 }); pared.position.set(0, 3.5, -10); S3.add(pared);
      var zoc = M(new T.BoxGeometry(34.05, 1.2, .55), pl.zoc, { borde: false, recibe: true }); zoc.position.set(0, .6, -10); S3.add(zoc);
      var puerta = M(new T.BoxGeometry(2.4, 4.2, .2), '#7a4a2a', { g: .03 }); puerta.position.set(0, 2.1, -9.7); S3.add(puerta);
      var marco = M(new T.BoxGeometry(2.9, 4.5, .12), '#fffdf2', { borde: false }); marco.position.set(0, 2.25, -9.74); S3.add(marco);
      var ventanas = [];
      [-6.5, 6.5, -12, 12].forEach(function (vx) {
        var v = M(new T.BoxGeometry(2, 2.2, .15), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); v.position.set(vx, 3.2, -9.7); S3.add(v); ventanas.push(v);
        for (var b = 0; b < 5; b++) { var rj = M(new T.BoxGeometry(.07, 2.2, .07), '#2a2a34', { borde: false }); rj.position.set(vx - .8 + b * .4, 3.2, -9.55); S3.add(rj); }
      });
      var escalon = M(new T.BoxGeometry(34, ABZ, 3.2), '#c9b8a0', { recibe: true, g: .015 }); escalon.position.set(0, ABZ / 2, -8.2); S3.add(escalon);
      var tarima = M(new T.BoxGeometry(4.6, ABZ, 2.4), '#c9b8a0', { recibe: true, g: .015 }); tarima.position.set(0, ABZ / 2, AZ - .4); S3.add(tarima);
      [-12.5, -8.5, -4, 4, 8.5, 12.5].forEach(function (cx) {
        var co = M(new T.CylinderGeometry(.32, .36, 5.6, 8), '#fffdf2', { recibe: true, g: .03 }); co.position.set(cx, ABZ + 2.8, -7); S3.add(co);
        var ba = M(new T.BoxGeometry(.9, .3, .9), '#c4783a', { g: .03 }); ba.position.set(cx, ABZ + .15, -7); S3.add(ba);
      });
      var viga = M(new T.BoxGeometry(34, .45, .5), '#8a5a30', { g: .02 }); viga.position.set(0, ABZ + 5.8, -7); S3.add(viga);
      var techo = M(new T.BoxGeometry(34.6, .3, 3.8), '#c4563a', { g: .015 }); techo.position.set(0, ABZ + 6.4, -8.7); techo.rotation.x = -.3; S3.add(techo);
      /* matas en materos a lo largo del corredor (se mecen solas) */
      var matas = [];
      [-10.5, -6.3, 6.3, 10.5, -2.6, 2.6].forEach(function (mx, i) {
        var mt = M(new T.CylinderGeometry(.5, .36, .8, 8), i % 2 ? '#c4563a' : '#e8d8b0', { g: .04 }); mt.position.set(mx, ABZ + .4, -8.6); S3.add(mt);
        var hj = M(new T.IcosahedronGeometry(.8, 0), i % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); hj.position.set(mx, ABZ + 1.3, -8.6); S3.add(hj); matas.push(hj);
        var fo = M(new T.SphereGeometry(.16, 6, 4), CONF3[i % CONF3.length], { borde: false }); fo.position.set(mx + .4, ABZ + 1.7, -8.2); S3.add(fo);
      });
      /* la hamaca guindada entre dos columnas (se mece sola) */
      var hamaca = new T.Group(); hamaca.position.set(6.25, ABZ + 3.4, -7); S3.add(hamaca);
      var tela = M(new T.TorusGeometry(1.9, .22, 4, 14, Math.PI), '#ff5c8a', { g: .04 }); tela.rotation.z = Math.PI; tela.scale.set(1, .55, 3.2); hamaca.add(tela);
      var tela2 = M(new T.TorusGeometry(1.9, .225, 4, 14, Math.PI), '#ffd23f', { borde: false }); tela2.rotation.z = Math.PI; tela2.scale.set(1, .55, 1.2); hamaca.add(tela2);
      /* la jaula del loro colgada de la viga (el loro se balancea) */
      var jaula = new T.Group(); jaula.position.set(-2.3, ABZ + 4.2, -7.3); S3.add(jaula);
      var jb = M(new T.CylinderGeometry(.55, .55, .1, 10), '#d9a520', { g: .06 }); jb.position.y = -.6; jaula.add(jb);
      var jt = M(new T.ConeGeometry(.6, .4, 10), '#d9a520', { g: .06 }); jt.position.y = .65; jaula.add(jt);
      for (k = 0; k < 8; k++) { var bj = new T.Mesh(new T.CylinderGeometry(.02, .02, 1.2, 3), tn('#d9a520')); bj.position.set(Math.cos(k * .785) * .52, 0, Math.sin(k * .785) * .52); jaula.add(bj); }
      var loro = new T.Group(); jaula.add(loro); loro.position.y = -.25;
      var lc = M(new T.SphereGeometry(.2, 7, 5), '#3fbf4a', { g: .08 }); lc.scale.set(1, 1.3, 1); loro.add(lc);
      var lca = M(new T.SphereGeometry(.14, 7, 5), '#ffd23f', { g: .08 }); lca.position.set(0, .28, .04); loro.add(lca);
      var lpi = M(new T.ConeGeometry(.05, .12, 4), '#ff5c3a', { borde: false }); lpi.rotation.x = Math.PI / 2; lpi.position.set(0, .26, .19); loro.add(lpi);
      /* el mango del patio a la izquierda (con mangos) */
      var mango = new T.Group(); mango.position.set(-13.5, 0, -3.5); S3.add(mango);
      var tronco = M(new T.CylinderGeometry(.5, .7, 5, 7), '#8a5a30', { g: .03 }); tronco.position.y = 2.5; mango.add(tronco);
      var copa = new T.Group(); copa.position.y = 6; mango.add(copa);
      [[0, 0, 0, 3.2], [2, -.4, .5, 2.3], [-2, -.3, -.4, 2.4], [0, 1.6, 0, 2.2]].forEach(function (b, i) { var bo = M(new T.IcosahedronGeometry(b[3], 0), i % 2 ? '#2f9a3c' : '#3fae4a', { g: .02 }); bo.position.set(b[0], b[1], b[2]); copa.add(bo); });
      for (k = 0; k < 6; k++) { var mg = M(new T.SphereGeometry(.28, 6, 4), k % 2 ? '#ffb030' : '#ff7a3a', { g: .06 }); mg.scale.set(.85, 1.1, .85); mg.position.set(Math.cos(k * 1.1) * 2.6, -1.8 - (k % 3) * .3, Math.sin(k * 1.1) * 2.2 + 1.2); copa.add(mg); }
      /* bancos de madera a los lados: ahí se sientan los que se equivocan */
      [-8.3, 8.3].forEach(function (bx) {
        var bn = new T.Group(); bn.position.set(bx, 0, -1.4); S3.add(bn);
        var tb = M(new T.BoxGeometry(1, .2, 3.8), '#c4783a', { recibe: true }); tb.position.y = .85; bn.add(tb);
        [-1.6, 1.6].forEach(function (z) { var pa = M(new T.BoxGeometry(.9, .85, .2), '#7a4a2a'); pa.position.set(0, .42, z); bn.add(pa); });
      });
      /* el abuelo en su mecedora (en el nivel 3 se para y hace la trampa) */
      var mece = new T.Group(); mece.position.set(-5.3, ABZ, -5.8); mece.rotation.y = .35; S3.add(mece);
      var mAs = M(new T.BoxGeometry(1.8, .16, 1.6), '#a0662e', { g: .03 }); mAs.position.y = 1.15; mece.add(mAs);
      var mRe = M(new T.BoxGeometry(1.8, 2, .16), '#a0662e', { g: .03 }); mRe.position.set(0, 2.15, -.78); mRe.rotation.x = -.18; mece.add(mRe);
      [-.8, .8].forEach(function (x) {
        var pat = M(new T.BoxGeometry(.14, .12, 2.4), '#7a4a2a', { g: .04 }); pat.position.set(x, .06, 0); mece.add(pat);   // el balancín
        var pf = M(new T.BoxGeometry(.12, 1.1, .12), '#7a4a2a', { borde: false }); pf.position.set(x, .6, .55); mece.add(pf);
        var pt2 = M(new T.BoxGeometry(.12, 1.1, .12), '#7a4a2a', { borde: false }); pt2.position.set(x, .6, -.6); mece.add(pt2);
      });
      var abuelo = V3.PJ.crear('tio', { prop: false, escala: 1.9 }); abuelo.color('#efe6cc'); S3.add(abuelo.g);   // guayabera crema
      /* bombillos colgados de lado a lado del patio (de noche alumbran) */
      var bombillos = [];
      var pts = [], i0;
      for (i0 = 0; i0 <= 24; i0++) { var u0 = i0 / 24; pts.push(new T.Vector3(-14 + 28 * u0, ABZ + 6.4 - Math.sin(u0 * Math.PI) * 1.4, -3.5 - Math.sin(u0 * Math.PI) * 1.2)); }
      var cur = new T.CatmullRomCurve3(pts); S3.add(new T.Mesh(new T.TubeGeometry(cur, 30, .03, 4), tn('#14101c')));
      for (i0 = 0; i0 < 13; i0++) {
        var bp = cur.getPoint((i0 + .5) / 13), bc = CONF3[i0 % CONF3.length];
        var bo = new T.Mesh(new T.SphereGeometry(.16, 6, 4), tn(pl.noche ? '#fff6c0' : V3.oscurecer(bc, 1.2), { em: bc, emI: pl.noche ? 2 : .25 })); bo.position.copy(bp); bo.position.y -= .2; S3.add(bo); bombillos.push(bo);
      }
      if (pl.noche) {
        var l1 = new T.PointLight(0xffc870, 1.2, 18, 2); l1.position.set(-5, ABZ + 5, -3); S3.add(l1);
        var l2 = new T.PointLight(0xffc870, 1.2, 18, 2); l2.position.set(5, ABZ + 5, -3); S3.add(l2);
        var l3 = new T.PointLight(0xffe0a0, .8, 12, 2); l3.position.set(0, ABZ + 4.5, -7.6); S3.add(l3);   // el foco del corredor sobre la abuela
      }
      /* mariposas de día; de noche, luciérnagas (partículas) */
      var mariposas = [];
      if (!pl.noche) for (k = 0; k < 3; k++) {
        var mp = new T.Group(); S3.add(mp);
        var ala = new T.Mesh(new T.PlaneGeometry(.35, .28), new T.MeshBasicMaterial({ color: ['#ffd23f', '#ff8a3d', '#a98bff'][k], side: T.DoubleSide }));
        var ala2 = ala.clone(); ala.position.x = .18; ala2.position.x = -.18;
        var piv1 = new T.Group(), piv2 = new T.Group(); piv1.add(ala); piv2.add(ala2); mp.add(piv1); mp.add(piv2);
        mariposas.push({ g: mp, a: piv1, b: piv2, f: k * 2.1 });
      }

      /* la abuela, grande, en su tarima */
      var ab = V3.PJ.crear('abuela', { prop: false, escala: ESC_AB }); ab.g.position.set(0, ABZ, AZ); S3.add(ab.g);
      var abC = cosas(T, M); ab.mano('der').add(abC.ar); ab.mano('der').add(abC.ch);
      var abeC = cosas(T, M); abuelo.mano('der').add(abeC.ar); abuelo.mano('der').add(abeC.ch);
      /* los jugadores en fila, de frente */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }), x3 = jx(k);
        pj.g.position.set(x3, 0, JZ); S3.add(pj.g);
        var cs = cosas(T, M); pj.mano('der').add(cs.ar); pj.mano('der').add(cs.ch);
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: s2.color && s2.color !== '#fff' ? s2.color : CONF3[k % CONF3.length], transparent: true, opacity: .85 }));
        aro.rotation.x = -Math.PI / 2; aro.position.set(x3, .04, JZ); S3.add(aro);
        pjs.push({ pj: pj, cs: cs, aro: aro, x: x3, z: JZ, x0: x3, rumbo: 0, fuera: -1, golpe: -1, banco: -1, poseV: 0, okK: -1, trK: -1, caraT: -9, cara: 'normal', msg: '', msgT: -9, msgC: '#fff', anim: 'quieto' });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      esc.encuadrar(19, 11.5, new T.Vector3(0, 3.3, -1.6), .3);
      return V3.ultimo = { esc: esc, ab: ab, abC: abC, abuelo: abuelo, abeC: abeC, mece: mece, pjs: pjs, flecha: flecha, part: part, matas: matas, hamaca: hamaca, loro: loro, copa: copa,
        bombillos: bombillos, mariposas: mariposas, ventanas: ventanas, vuelos: [], rk: -1, finT: -1, sentados: 0, luzT: 0, abuT: 0,
        luzBase: [esc.luces.hemi.intensity, esc.luces.sol.intensity], luzK: 1, fa: 0, evVisto: -1, giroT: -9, loroT: -9, chispaT: 0 };
    }
    function verCosas(cs, an, po) { cs.ar.visible = po === 1 && an !== 'sentado'; cs.ch.visible = po === 2 || (po === 1 && an === 'sentado'); }
    function chancletazo(p) {                                           // la abuela le tira la chancla al que se equivocó
      var T = THREE, V = v3, m = new T.Group(), s1 = V3.malla(new T.BoxGeometry(.32, .1, .8), '#ff5c8a', { g: .08 }); m.add(s1);
      var s2 = V3.malla(new T.TorusGeometry(.12, .035, 4, 8, Math.PI), '#ffd23f', { borde: false }); s2.position.set(0, .05, -.1); m.add(s2);
      m.position.set(0, ABZ + 4, AZ + .6); V.esc.scene.add(m);
      V.vuelos.push({ m: m, p: p, t: absT, de: m.position.clone() });
      V.ab.uno('lanzar'); V3.sfx('whoosh');
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, t = absT, p, k, rk = ronda(now), R = rk >= 0 ? rondas[rk] : null;
      var activa = !!(R && now >= R.T && now <= R.D + GRACIA), fin = finJuego(now) && now > 0;
      V.part.update(dt);
      /* lo que se mueve solo */
      V.hamaca.rotation.x = Math.sin(t * 1.3) * .22;
      V.loro.rotation.z = Math.sin(t * 2.6) * .25; V.loro.rotation.y = Math.sin(t * .7) * .8;
      V.copa.rotation.z = Math.sin(t * .9) * .025;
      for (k = 0; k < V.matas.length; k++) V.matas[k].rotation.z = Math.sin(t * 1.4 + k) * .08;
      for (k = 0; k < V.mariposas.length; k++) {
        var mp = V.mariposas[k], ph = t * .35 + mp.f;
        mp.g.position.set(Math.sin(ph) * 9, 2.4 + Math.sin(ph * 2.3) * 1.2, -3 + Math.cos(ph * 1.3) * 3);
        mp.g.rotation.y = Math.cos(ph) > 0 ? Math.PI / 2 : -Math.PI / 2;
        mp.a.rotation.y = Math.sin(t * 18 + k) * .9; mp.b.rotation.y = -Math.sin(t * 18 + k) * .9;
      }
      if (lv === 3) { V.luzT -= dt; if (V.luzT < 0) { V.luzT = .3; V.part.soltar((c.fx() - .5) * 26, 1 + c.fx() * 3, -6 + c.fx() * 8, 1, { k: 'chispa', cols: ['#d8ff6a', '#fff6a0'], vel: .3, arriba: .2, g: -.2, vida: 2.2, esc: .6 }); } }
      /* la fiesta se pone brava: cambio de fase = pito/bocina, sacudida y confeti */
      var fa = now >= 0 && !fin ? faseDe(cl01(now / dur)) : V.fa;
      if (fa !== V.fa) {
        V.fa = fa;
        if (fa > 0) { V3.sfx(fa === 2 ? 'bocina' : 'silbato'); V.esc.sacudir(fa === 2 ? 1 : .6); V.part.soltar(0, 6, -2, 40, { k: 'confeti', cols: CONF3, vel: 6, arriba: 4, g: 5, vida: 1.6 }); }
      }
      for (k = 0; k < V.bombillos.length; k++) V.bombillos[k].scale.setScalar(V.fa === 2 && !fin ? 1 + .4 * Math.abs(Math.sin(t * 9 + k * .7)) : lv === 3 ? 1 + .12 * Math.sin(t * 3 + k) : 1);
      /* eventos del patio: aviso (efecto + sonido) una vez, y lo que dura el bloque */
      var ev = now >= 0 ? evEn(now) : null, ei = ev ? evs.indexOf(ev) : -1;
      if (ev && ei !== V.evVisto) {
        V.evVisto = ei; V.esc.sacudir(.5);
        if (ev.k === 'loro') { V.loroT = t; V3.sfx('silbido'); V.part.soltar(-2.3, ABZ + 4, -7.1, 16, { k: 'confeti', cols: ['#3fbf4a', '#ffd23f', '#ff5c3a'], vel: 3, arriba: 1, g: 3, vida: 1.4 }); }
        else if (ev.k === 'apagon') { V3.sfx('chispa'); V.part.soltar(0, ABZ + 6, -3.5, 24, { k: 'chispa', cols: ['#fff6a0', '#ffd23f'], vel: 5, arriba: 2, vida: .7 }); }
        else { V.giroT = t; V3.sfx('whoosh'); V3.sfx('tambor'); V.part.soltar(0, ABZ + 4, AZ + .5, 30, { k: 'confeti', cols: ['#a98bff', '#fffdf2', '#ff5c8a'], vel: 4, arriba: 4, g: 5, vida: 1.2 }); }
      }
      var oscuro = !!(ev && ev.k === 'apagon' && now >= rondas[ev.r0].T - .3), luzObj = oscuro ? .22 + (Math.floor(t * 7) % 5 === 0 ? .25 : 0) : 1;
      V.luzK += (luzObj - V.luzK) * Math.min(1, dt * 8);
      V.esc.luces.hemi.intensity = V.luzBase[0] * V.luzK; V.esc.luces.sol.intensity = V.luzBase[1] * V.luzK;
      for (k = 0; k < V.bombillos.length; k++) V.bombillos[k].visible = !oscuro;
      if (oscuro) { V.chispaT -= dt; if (V.chispaT < 0) { V.chispaT = .5; V.part.soltar((c.fx() - .5) * 20, ABZ + 6, -3.5, 3, { k: 'chispa', cols: ['#fff6a0'], vel: 2, arriba: 1, vida: .5, esc: .7 }); } }
      if (ev && ev.k === 'loro') { V.loro.position.y = -.25 + Math.abs(Math.sin(t * 14)) * .18; V.loro.rotation.z = Math.sin(t * 22) * .5; }
      else V.loro.position.y = -.25;
      /* una orden nueva: la abuela (o el abuelo) agarra la pose; tic */
      if (rk !== V.rk) { V.rk = rk; if (rk >= 0 && now >= 0) { V3.sfx(R.voz === 1 ? 'tambor' : 'tic'); V.abuT = t; } }
      var quien = activa && R.voz === 1 ? 'abuelo' : activa && R.voz === 3 ? 'loro' : 'abuela', an = activa ? animDe(rk) : null, po = activa ? R.dir + 1 : 0;
      var hablando = activa && t - V.abuT < .55, boca = hablando && Math.floor(t * 9) % 2 ? 'feliz' : 'normal';
      /* la abuela */
      var abA, abCara;
      if (fin) { abA = 'saludar'; abCara = 'feliz'; }
      else if (now < 0) { abA = 'bailar'; abCara = 'feliz'; }
      else if (quien === 'abuela' && an) { abA = an; abCara = hablando ? boca : 'concentrado'; }
      else if (quien === 'abuelo' || quien === 'loro') { abA = 'quieto'; abCara = 'enojado'; }
      else if (R && !R.real && now - R.D < .9) { abA = 'celebrar'; abCara = 'feliz'; }   // ¡jajá, esa no la dije yo!
      else { abA = 'quieto'; abCara = 'normal'; }
      var giro = t - V.giroT < 1 ? (t - V.giroT) * Math.PI * 4 : 0;          // al revés: la abuela da dos vueltas
      V.ab.anim(abA).cara(abCara).rumbo(quien === 'abuelo' ? -.7 : quien === 'loro' ? -.45 : giro).update(dt);
      verCosas(V.abC, abA, quien === 'abuela' ? po : 0);
      /* el abuelo: se mece dormido; en su trampa se para y hace la pose */
      var de = quien === 'abuelo', ax = de ? -5.6 : -5.3, az = de ? -4.5 : -5.65, ay = de ? ABZ : ABZ + .58;
      V.abuelo.g.position.set(V.abuelo.g.position.x + (ax - V.abuelo.g.position.x) * Math.min(1, dt * 10), ay, V.abuelo.g.position.z + (az - V.abuelo.g.position.z) * Math.min(1, dt * 10));
      var meceR = de ? 0 : Math.sin(t * 1.6) * .12; V.mece.rotation.x = meceR; V.abuelo.g.rotation.x = meceR;
      V.abuelo.anim(de ? an : 'sentado').cara(de ? (hablando ? boca : 'feliz') : (lv === 3 ? 'normal' : 'dormido')).rumbo(.35).update(dt);
      verCosas(V.abeC, de ? an : 'sentado', de ? po : 0);
      /* los jugadores: imitan con su personaje lo que hizo la abuela */
      for (p = 0; p < n; p++) {
        var s3 = V.pjs[p], ps = pose(p), q = P[p], pj = s3.pj, cara = 'normal', anim = 'quieto';
        if (q.st) {                                                    // se equivocó: chancletazo, se pone triste y se va al banco
          if (s3.fuera < 0) {
            s3.fuera = t; s3.msg = '¡FUERA!'; s3.msgC = '#ff3b4e'; s3.msgT = t; pj.uno('golpe');
            if (p === c.yo) { V3.sfx('error'); V.esc.sacudir(1); }
            chancletazo(p);
          }
          var seat = s3.banco >= 0 ? BANCOS[s3.banco] : null;
          if (s3.golpe >= 0 && t - s3.golpe > .9 && !seat) { s3.banco = V.sentados++ % 4; seat = BANCOS[s3.banco]; }
          if (seat) {
            var dx = seat[0] - s3.x, dz = seat[1] - s3.z, dd = Math.sqrt(dx * dx + dz * dz), lim = 6 * dt;
            if (dd > lim) { s3.x += dx / dd * lim; s3.z += dz / dd * lim; s3.rumbo = Math.atan2(dx, dz); anim = 'caminar'; }
            else { s3.x = seat[0]; s3.z = seat[1]; s3.rumbo = seat[2]; anim = 'sentado'; }
          } else anim = 'triste';
          cara = 'triste';
          pj.g.position.set(s3.x + (anim === 'sentado' ? Math.sin(s3.rumbo) * .25 : 0), anim === 'sentado' ? .45 : 0, s3.z);
          s3.aro.visible = false; verCosas(s3.cs, anim, 0);
          pj.anim(anim, { vel: .6 }).cara(cara).rumbo(s3.rumbo).update(dt);
          continue;
        }
        var pv = ps.pose;
        if (pv !== s3.poseV) {                                         // tocó: hace la pose
          if (pv && p === c.yo && !activa) V3.sfx('pop');
          if (pv === 1 && an && an !== 'cargar') pj.uno('saltar');
          s3.poseV = pv;
        }
        var okYa = !R ? false : mio(p) ? q.cur === rk && q.hecha === rk : pv === esperado(R, R.seq.length - 1) + 1;
        if (pv && activa && R.real && okYa && s3.okK !== rk) {           // ¡acierto! (la orden entera, combo incluido)
          s3.okK = rk; s3.caraT = t; s3.cara = 'feliz'; s3.msg = R.seq.length > 1 ? '¡COMBO!' : '¡BIEN!'; s3.msgC = '#5cff7a'; s3.msgT = t;
          V.part.soltar(s3.x, 3.4, s3.z, R.seq.length > 1 ? 24 : 12, { k: 'confeti', cols: CONF3, vel: 3, arriba: 3, g: 6, vida: .9 });
          if (p === c.yo) V3.sfx(R.seq.length > 1 ? 'moneda' : 'ding');
        }
        if (R && !R.real && now > R.D + GRACIA + .05 && now - R.D < 1 && s3.trK !== rk) {   // aguantó la trampa
          s3.trK = rk; s3.caraT = t; s3.cara = 'feliz'; s3.msg = '¡NO CAÍ!'; s3.msgC = '#ffd23f'; s3.msgT = t;
          if (p === c.yo) V3.sfx('ding');
        }
        if (fin) { anim = 'celebrar'; cara = 'feliz'; }
        else if (pv === 1) anim = activa && an && an !== 'sentado' ? an : 'cargar';
        else if (pv === 2) anim = 'sentado';
        else if (now < 0) anim = 'bailar';
        if (!fin) cara = t - s3.caraT < .9 ? s3.cara : activa && !pv ? 'concentrado' : 'normal';
        s3.x = s3.x0; s3.z = JZ; s3.rumbo = 0;
        pj.g.position.set(s3.x, 0, s3.z);
        verCosas(s3.cs, anim, fin ? 0 : pv);
        pj.anim(anim).cara(cara).rumbo(0).update(dt);
        pj.mirar(0, activa && !pv ? .25 : 0);
        s3.aro.visible = true;
      }
      /* chancletas en el aire: arco desde la abuela hasta el que falló */
      for (k = V.vuelos.length - 1; k >= 0; k--) {
        var vu = V.vuelos[k], u = (t - vu.t) / .5, sv = V.pjs[vu.p];
        if (u >= 1) {
          V.esc.scene.remove(vu.m); V.vuelos.splice(k, 1);
          sv.golpe = t; sv.pj.uno('caer'); V3.sfx('golpe'); V.esc.sacudir(vu.p === c.yo ? 1 : .4);
          V.part.soltar(sv.x, 3.2, sv.z, 14, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff5c8a'], vel: 4, arriba: 3, vida: .6 });
          continue;
        }
        vu.m.position.set(vu.de.x + (sv.x - vu.de.x) * u, vu.de.y + (3.2 - vu.de.y) * u + Math.sin(u * Math.PI) * 3, vu.de.z + (sv.z - vu.de.z) * u);
        vu.m.rotation.set(t * 14, t * 5, 0);
      }
      /* fin: confeti y aplausos una vez */
      if (fin && V.finT < 0) { V.finT = t; V3.sfx('aplauso'); for (p = 0; p < n; p++) if (!P[p].st) V.part.soltar(V.pjs[p].x, 4, V.pjs[p].z, 30, { k: 'confeti', cols: CONF3, vel: 4, arriba: 5, g: 5, vida: 1.6 }); }
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !P[c.yo].st;
      if (yo) V.flecha.position.set(yo.x, 4.5 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p, cx = (f.x0 + f.x1) / 2, rk = ronda(now); v3T = absT;   // reloj cosmético (absT avanza en update)
      if (dt > 0) actualizar3D(dt, now);                              // sin update entre dos cuadros no hay nada que mover
      if (now >= 0 && !finJuego(now)) V3.musica(faseDe(cl01(now / dur)) === 2 ? 'abuela2' : 'abuela');   // el final va más rápido
      v3.esc.render(dt);
      for (p = 0; p < n; p++) {
        var s3 = v3.pjs[p];
        if (!P[p].st) { var pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.1); txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true); }
        var edad = absT - s3.msgT;
        if (s3.msg && edad < 1.1) { var pm = v3.esc.proyectar(s3.x, 3.9 + Math.min(edad, .4) * 1.2, s3.z); txt(s3.msg, pm.x, Math.max(176, pm.y), 16, s3.msgC, 0, true); }
      }
      globo(cx, f.x1 - f.x0, now, rk, rk);                            // la orden y la barra del tiempo, igual que en 2D
      cartel(cx, f.x1 - f.x0, now);
    }
    var g = {
      update: function (dt) {
        var gt = c.ahora(), p;
        absT += dt;
        for (p = 0; p < n; p++) updJugador(p, gt);
        var r = ronda(gt);                                            // pitido de aviso al empezar cada orden (cosmético)
        if (r !== sndK) { if (r >= 0 && gt >= 0) SND(rondas[r].dir === 0 ? 700 : 330, 0.09, 'square', 0.04); sndK = r; }
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(campo());
        dibujar2D();
      },
      ai: function (p, dt, api) {
        var gt = c.ahora(), q = P[p], pl = plan[p], sk = c.skill[p];
        if (q.st || gt < 0) return;
        var rk = ronda(gt);
        if (rk >= 0 && pl.k !== rk) {                                 // nueva orden: se decide TODO una vez (reacción, toques y si se equivoca)
          pl.k = rk; pl.q = [];
          var R = rondas[rk], r = c.rngFor('cpu' + p + ':' + rk), L = R.seq.length, j;
          var err = (0.03 + 0.12 * (1 - sk)) * [0.4, 0.7, 1.25][R.fa] + (L > 1 ? 0.04 : 0) + (R.inv ? 0.07 : 0) + (R.apa ? 0.03 : 0) + (R.voz === 3 ? 0.04 : 0);
          var roll = r.next(), gs = (r.next() + r.next() + r.next() - 1.5) * 2, paso = 0.2 + 0.1 * (1 - sk);
          var react = clamp(0.2 + 0.16 * (1 - sk) + 0.05 * Math.abs(gs) + (R.apa ? 0.08 : 0) + (R.inv ? 0.06 : 0), 0.2, Math.max(0.2, R.W - 0.07 - (L - 1) * paso)), ok = roll >= err;
          if (R.real) {
            if (ok) for (j = 0; j < L; j++) pl.q.push([R.T + react + j * paso, esperado(R, j) === 0 ? 'a' : 'b']);
            else if (r.next() < 0.5) pl.q.push([R.T + react, esperado(R, 0) === 0 ? 'b' : 'a']);   // se confunde de botón (si no, se queda dormida)
          } else if (!ok) pl.q.push([R.T + react, r.next() < 0.5 ? 'a' : 'b']);                       // cae en la trampa
        }
        while (pl.q.length && gt >= pl.q[0][0]) api.press(pl.q.shift()[1]);
      },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) out.push(P[p].st ? P[p].sc : dur * 30 + 1);
        return out;
      },
      cuerpo: function (p) { return { pose: P[p].pose, st: P[p].st, sc: P[p].sc }; },
      done: function () { return n > 1 ? vivos() <= 1 : vivos() === 0; },
      vivo: function (p) { return !P[p].st; },
      alRemoto: function (p, o, tt) { if (o && o.st && !P[p].st) elim(p, o.sc); },
      alCpu: function (p) { P[p].own = false; },
      alHum: function (p, o) { P[p].own = false; if (o) { if (o.st && !P[p].st) elim(p, o.sc); else if (!o.st) P[p].pose = o.pose || 0; } },
      onEv: function (ty, p, d, tt) { if (ty === 'out' && P[p]) elim(p, d && d.kk != null ? d.kk : Math.floor(c.ahora() * 30)); },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0], j, ok = 0;
        if (!q) return '';
        if (!q.st) return 'la abuela quedó sin trucos: ni una falla';
        for (j = 0; j < N; j++) if (Math.floor(rondas[j].D * 30) < q.sc) ok++;
        return ok ? 'obedeció ' + ok + (ok === 1 ? ' orden' : ' órdenes') + ' bien' : 'cayó en la primera orden';
      },
      vista: function () {
        var gt = c.ahora(), h = 7, j;
        for (j = 0; j < N; j++) h = (Math.imul(h ^ Math.round(rondas[j].T * 1000) ^ Math.round(rondas[j].W * 1000) ^ (rondas[j].dir * 7 + (rondas[j].real ? 0 : 3) + rondas[j].voz * 11 + rondas[j].seq.length * 101 + (rondas[j].inv ? 409 : 0) + (rondas[j].apa ? 1201 : 0)), 16777619) >>> 0);
        return { gt: gt, lv: lv, N: N, mundoHash: h, fase: faseDe(cl01(gt / dur)), evs: evs.map(function (e) { return [e.k, e.r0, e.r1, +e.T0.toFixed(3)]; }),
          rondas: rondas.map(function (R) { return [+R.T.toFixed(3), +R.W.toFixed(3), R.dir, R.real ? 1 : 0, R.voz, R.seq.map(function (d, i) { return esperado(R, i); }), R.inv ? 1 : 0, R.apa ? 1 : 0, R.fa]; }),
          st: P.map(function (q) { return q.st; }), sc: P.map(function (q) { return q.sc; }), pose: P.map(function (q) { return q.pose; }),
          pasa: P.map(function (q) { return q.pasa; }), vivos: vivos(), ronda: ronda(gt) };
      }
    };
    return g;
  }
});
})();
