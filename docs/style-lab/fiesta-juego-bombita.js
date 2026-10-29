'use strict';
/* LA FIESTA · EN VIVO · f_bombita · ¡AGUA EN CARNAVAL!  (FFA, supervivencia, modelo B: dueño + juez)
   La plaza en Carnaval. Una BOMBITA DE AGUA es una papa caliente: el que la lleva al estallar queda fuera (empapado). Se pasa TOCANDO a otro: el portador (dueño de su cuerpo)
   ve el contacto con la posición de los demás y emite el ev fiable `pasa {i,to,t}`; el nuevo portador no puede devolverla ni pasarla en 0,6 s (inmunidad). El calendario sale de c.rng
   en mk (idéntico en todas las pantallas): rondas con mecha oculta (Nv1 7-10 s, Nv2 5-8 s, Nv3 DOS bombitas por ronda, 5,5-8,5 s) y la bombita TIEMBLA el último segundo (telegrafía).
   Quién la tiene al inicio lo decide el JUEZ (ev `ini {i,to}`; to=-1 = bombita de relleno si quedan <3). Al estallar, el portador (o su CPU, que la simula el juez) emite `out` con
   kk = floor(T*30), la hora de estallido: determinista e igual para cualquier observador. Un pase en vuelo cuyo `t` es anterior a T cuenta aunque llegue después: el que la recibe
   ya la lleva al estallar y se lo juzga él mismo. Puntaje: eliminado = tick del estallido; vivo = dur*30+1 (mismo contrato que f_chancla/f_mecate). done() = quedan <=1 vivos.
   Cuerpo en red (o): x, y, st (fuera), sc. Sin Math.random/Date.now: azar de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético c.fx().
   Desviación de la ficha 08 §12: mechas 7-10 / 5-8 s (no 8-14 / 5-10) para que quepan 3 estallidos en 40 s con 4 jugadores.
   ESCALADA (sobre c.ahora()/dur, sirve igual con dur 10; con 3+ jugadores el primer mojado ya sube a fase 1 y quedar dos ya es la fase 2, ver faseJ): fase 0 tranquila (< 34 %), fase 1 «¡SE CALIENTA LA PLAZA!» (todos +7 % de velocidad), fase 2 «¡ÚLTIMOS SEGUNDOS!»
   (>= 72 %: +16 %, mechas x0,85, DOS bombitas por ronda también en Nv1/2, eventos más seguidos, embiste con menos espera, música más rápida y luces de fiesta).
   EVENTOS DE LA PLAZA (calendario de c.rng en mk, igual en todos; avisan 0,9 s antes con franja/columna/círculo en el piso + cartel + sonido): la COMPARSA cruza un carril y
   empuja al que agarre; el de la MANGUERA moja una columna (ahí vas a media velocidad); los TAMBORES marcan un círculo (ahí corres x1,35). Cada dueño aplica el efecto a su propio
   cuerpo (las CPU del juez, el juez), así que todo viaja en x/y como siempre. EMBISTE (botón A): arranque corto (0,22 s a x2,4) con espera de 1,5 s (1,3 s en fase 1, 1,1 s al final): el que la
   lleva lo usa para alcanzar, el que huye para zafarse. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_bombita')) return;

var AW = 560, AH = 270, SPD = 165, SPDB = 182, TOCA = 34, IMM = 0.6, TIEMBLA = 1.0, GAP = 1.2, BODY = 6;
var F1K = 0.34, F2K = 0.72, FASEV = [1, 1.07, 1.16], AVISO = 0.9;                  // escalada: fronteras de fase (fracción de dur) y velocidad por fase
var DASH = 0.22, DASHK = 2.4, DASHCD = [1.5, 1.3, 1.1];                         // embiste
var COMPW = 46, COMPH = 30, MANG = 36, TAMB = 58;                                   // tamaño de la comparsa (medio ancho/alto), media columna de manguera, radio de tambores
var EVK = ['comparsa', 'manguera', 'tambores'];
var EVTXT = {
  comparsa: ['¡AHÍ VIENE LA COMPARSA!', 'sal de la franja rosada o te arrastra', '#ff5c8a'],
  manguera: ['¡EL DE LA MANGUERA!', 'en el chorro azul vas lentico', '#3fa9ff'],
  tambores: ['¡LLEGARON LOS TAMBORES!', 'en el círculo amarillo corres más', '#ffd23f']
};
var INK = '#14101c';
var PAL = {
  1: { cielo: '#8fd8ff', edif: '#f2c48a', edif2: '#e6a87a', piso: '#d9c9a8', piso2: '#c9b48c', luz: 0 },
  2: { cielo: '#f7b36a', edif: '#e79a6a', edif2: '#c9785a', piso: '#cdb08c', piso2: '#b99870', luz: 0 },
  3: { cielo: '#2a2a5a', edif: '#4a4a7a', edif2: '#3a3a66', piso: '#5a5066', piso2: '#4c4358', luz: 1 }
};
var CONF = ['#ff5c8a', '#ffd23f', '#3fd0a0', '#3fa9ff', '#ff8a3f'];
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }

FIESTA.LIVE.add('f_bombita', {
  name: '¡AGUA EN CARNAVAL!', modos: ['ffa'], clase: 'survival', modelo: 'B', dur: 40,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 1201, scoreRate: 31, minT: 3, finTemprano: 1 },
  cuerpo: ['x', 'y', 'st', 'sc'], discretos: ['st', 'sc'],
  carta: {
    obj: 'Pásale la bombita de agua a otro tocándolo. ¡Al que le estalle encima queda mojado y fuera!',
    gana: 'El último seco. Si quedan varios al final, empatan arriba.',
    como: { tactil: 'Joystick para moverte · A = ¡embiste! (arranque corto) · tocar a alguien le pasa la bombita', teclado: 'WASD o flechas · ESPACIO = embiste' },
    roles: null,
    demos: [
      { id: 'mover', txt: 'Con la bombita, corre tras alguien y tócalo (A para embestir y alcanzarlo)' },
      { id: 'robar', txt: 'Sin ella, huye (A para zafarte). Ojo: comparsa, manguera y tambores cambian la plaza' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], rng = c.rng, i, j;
    var lead = Math.min(2.6, 0.2 * dur);
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };

    /* ───── el mundo: rondas de bombitas (idénticas en todos; solo c.rng, solo aquí) ───── */
    var F1 = dur * F1K, F2 = dur * F2K;
    var bombs = [], lo = lv === 1 ? 7 : lv === 2 ? 5 : 5.5, hi = lv === 1 ? 10 : lv === 2 ? 8 : 8.5, per0 = lv === 3 ? 2 : 1, per, Sx = lead, ronda = 0;
    while (true) {
      var f = lo + rng.next() * (hi - lo), tmax = 0, finRonda = Sx >= F2 - 0.5;
      if (finRonda) f *= 0.85;                                                  // ¡ÚLTIMOS SEGUNDOS!: mechas más cortas y bombita doble
      per = finRonda ? 2 : per0;
      var f2 = Math.min(f, dur - 0.4 - Sx - (per - 1) * 1.2);
      if (f2 < 1.2 && per > per0) { per = per0; f2 = Math.min(f, dur - 0.4 - Sx - (per - 1) * 1.2); }
      f = f2;
      if (f < 1.2) break;
      for (j = 0; j < per; j++) {
        var T = Sx + f + j * (0.9 + rng.next() * 0.6);
        bombs.push({ i: bombs.length, r: ronda, k: j, S: Sx, T: T, sel: Math.floor(rng.next() * 1000), holder: -1, imm: -9, prev: -1, prevT: -9, ini: 0, done: 0, plan: -2, outSent: 0, fxT: -9 });
        tmax = Math.max(tmax, T);
      }
      Sx = tmax + GAP; ronda++;
      if (Sx > dur - 2) break;
    }
    /* ───── eventos de la plaza (mismo c.rng, después de las bombitas): aviso en t0, efecto de t1 a t2 ───── */
    var EVS = [], tE = lead + 2.2 + rng.next() * 1.6, prevK = -1;
    while (tE < dur - 1.4) {
      var kE = Math.floor(rng.next() * 3) % 3; if (kE === prevK) kE = (kE + 1) % 3; prevK = kE;
      var durE = kE === 0 ? 2.8 : kE === 1 ? 2.6 : 3.4;
      var evE = { k: EVK[kE], t0: tE, t1: tE + AVISO, t2: Math.min(dur, tE + AVISO + durE), x: 0, y: 0, dir: 1, avis: 0, onF: 0 };
      if (kE === 0) { evE.y = 50 + rng.next() * (AH - 90); evE.dir = rng.next() < 0.5 ? 1 : -1; }
      else if (kE === 1) evE.x = 70 + rng.next() * (AW - 140);
      else { evE.x = 90 + rng.next() * (AW - 180); evE.y = 60 + rng.next() * (AH - 110); }
      EVS.push(evE);
      var gapE = (dur >= 20 ? 5.2 : 3.4) + rng.next() * 2;
      if (evE.t1 + gapE > F2) gapE *= 0.6; else if (evE.t1 > F1) gapE *= 0.8;          // más seguidos según se calienta
      tE = evE.t1 + gapE;
    }
    var hash = 7; for (i = 0; i < bombs.length; i++) hash = (Math.imul(hash ^ Math.round(bombs[i].T * 1000) ^ bombs[i].sel * 31 ^ Math.round(bombs[i].S * 100) * 997, 16777619)) >>> 0;
    for (i = 0; i < EVS.length; i++) hash = (Math.imul(hash ^ Math.round(EVS[i].t0 * 1000) ^ (i + 1) * Math.round(EVS[i].x * 7 + EVS[i].y * 13 + EVS[i].dir), 16777619)) >>> 0;
    function fase(now) { return now < F1 ? 0 : now < F2 ? 1 : 2; }
    /* la fase que se juega: la del reloj, o más si la partida va más adelantada (con 3+ jugadores: el primer mojado calienta la plaza; quedan dos = ¡últimos segundos!).
       Solo mueve lo que cada dueño aplica a su propio cuerpo (velocidad, espera del embiste) y lo cosmético; el calendario sigue siendo solo del reloj. */
    function faseJ(now) { var fz = fase(now), vv; if (n >= 3) { vv = vivos(); if (vv <= 2) fz = 2; else if (vv < n && fz < 1) fz = 1; } return fz; }
    function comparsaX(e, now) { var u = (now - e.t1) / Math.max(0.1, e.t2 - e.t1); return e.dir > 0 ? -80 + (AW + 160) * u : AW + 80 - (AW + 160) * u; }
    function enMang(x, now) { var a; for (a = 0; a < EVS.length; a++) { var e = EVS[a]; if (e.k === 'manguera' && now >= e.t1 && now < e.t2 && Math.abs(x - e.x) < MANG) return true; } return false; }
    function enTamb(x, y, now) { var a; for (a = 0; a < EVS.length; a++) { var e = EVS[a]; if (e.k !== 'tambores' || now < e.t1 || now >= e.t2) continue; var dx = x - e.x, dy = (y - e.y) * 1.15; if (dx * dx + dy * dy < TAMB * TAMB) return true; } return false; }
    function zona(x, y, now) { return (enMang(x, now) ? 0.5 : 1) * (enTamb(x, y, now) ? 1.35 : 1); }
    function evDe(k, now, antes, despues) { var a; for (a = 0; a < EVS.length; a++) { var e = EVS[a]; if (e.k === k && now >= e.t0 - antes && now < e.t2 + despues) return e; } return null; }

    /* ───── estado ───── */
    var P = [], cpuR = [], plan = [];
    for (i = 0; i < n; i++) {
      P.push({ x: AW * (0.2 + 0.6 * (i + 0.5) / n), y: AH * (i % 2 ? 0.7 : 0.4), st: 0, sc: 0, own: false, mood: 0, outAt: -9, passAt: -9, dx: 1, dy: 0, dashT: -9, dashCd: -9, dashX: 1, dashY: 0, empuje: -9 });
      cpuR.push(c.rngFor('cpu' + i)); plan.push({ dir: 0, re: -9 });
    }
    var absT = 0, banT = 2.2, shake = 0, splashes = [], pops = [];
    var ban = null, faseV = -1;                                                  // cartel grande del momento {s, sub, col, t, d} (cosmético) y la última fase anunciada
    function cartel(s, sub, col, d) { ban = { s: s, sub: sub || '', col: col || '#ffd23f', t: absT, d: d || 1.8 }; }
    function SFX(k) { if (V3 && V3.sfx) V3.sfx(k); }
    var cp = function () { return c.campo(); };
    function geom() { var f = cp(); return { ox: (f.x0 + f.x1) / 2 - AW / 2, oy: 188 }; }
    function vivos() { var k = 0, p; for (p = 0; p < n; p++) if (!P[p].st) k++; return k; }
    function elim(p, kk) { var q = P[p]; if (q.st) return; q.st = 1; q.sc = Math.max(0, kk | 0); q.outAt = c.ahora(); q.x = cl(q.x, 20, AW - 20); }
    function lleva(p) { var k = 0, a; for (a = 0; a < bombs.length; a++) if (bombs[a].holder === p && !bombs[a].done && bombs[a].ini) k++; return k; }
    function bombaDe(p) { var best = null, a; for (a = 0; a < bombs.length; a++) { var b = bombs[a]; if (b.holder === p && !b.done && b.ini && (!best || b.T < best.T)) best = b; } return best; }

    /* ───── movimiento y pase ───── */
    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        q.own = false;
        var r = c.remoto(p);
        if (r) { q.x = r.x; q.y = r.y; if (r.st && !q.st) elim(p, r.sc); }
        return;
      }
      q.own = true;
      var tp = c.tap(p, 'a');                                                    // se lee siempre (no se acumulan toques de la cuenta)
      if (q.st || now < 0) return;
      var e = c.eje(p), sp = (lleva(p) ? SPDB : SPD) * FASEV[faseJ(now)] * zona(q.x, q.y, now), a;
      if (e.x || e.y) { q.dx = e.x; q.dy = e.y; }
      if (tp > 0 && now >= q.dashCd) {                                           // ¡EMBISTE!: arranque corto hacia donde apuntas (o hacia donde mirabas)
        var l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1;
        q.dashX = q.dx / l; q.dashY = q.dy / l; q.dashT = now + DASH; q.dashCd = now + DASHCD[faseJ(now)];
        if (p === c.yo) SND(300, 0.08, 'triangle', 0.05, 200);
      }
      if (now < q.dashT) { q.x += q.dashX * sp * DASHK * dt; q.y += q.dashY * sp * DASHK * dt; }
      else { q.x += e.x * sp * dt; q.y += e.y * sp * dt; }
      /* la comparsa: si te agarra en su carril te arrastra y te saca de lado */
      for (a = 0; a < EVS.length; a++) {
        var ev = EVS[a];
        if (ev.k !== 'comparsa' || now < ev.t1 || now >= ev.t2) continue;
        var cx = comparsaX(ev, now);
        if (Math.abs(q.x - cx) < COMPW && Math.abs(q.y - ev.y) < COMPH) {
          var dirY = q.y >= ev.y ? 1 : -1;
          if (dirY < 0 && ev.y - COMPH < 28) dirY = 1; else if (dirY > 0 && ev.y + COMPH > AH - 14) dirY = -1;
          q.x += ev.dir * (AW + 160) / (ev.t2 - ev.t1) * dt; q.y += dirY * 280 * dt;
          if (now - q.empuje > 1) { q.empuje = now; if (p === c.yo) { var pe = sobre(p, 5.8); S('¡TE AGARRÓ LA COMPARSA!', pe.x, pe.y, '#ff5c8a'); } }
        }
      }
      q.x = cl(q.x, 20, AW - 20); q.y = cl(q.y, 22, AH - 8);
    }
    function pasar(p, now) {
      var b = bombaDe(p), a;
      if (!b || now < b.imm || now >= b.T || P[p].st) return;
      var q = P[p], best = -1, bd = 1e9;
      for (a = 0; a < n; a++) {
        if (a === p || P[a].st) continue;
        if (a === b.prev && now < b.prevT + 1.0) continue;                     // no se devuelve de inmediato
        var dx = q.x - P[a].x, dy = (q.y - P[a].y) * 1.15, d = Math.sqrt(dx * dx + dy * dy);
        if (d < TOCA + (c.mio(a) ? 0 : 4) && d < bd) { bd = d; best = a; }
      }
      if (best >= 0) { b.imm = now + IMM; c.ev('pasa', { i: b.i, to: best, t: Math.round(now * 1000) }, p); }
    }
    function resolver(now) {
      var a, b;
      for (a = 0; a < bombs.length; a++) {
        b = bombs[a];
        if (b.done || now < b.T) continue;
        if (!b.ini) { if (now > b.T + 1.5) b.done = 1; continue; }
        if (b.holder < 0 || P[b.holder].st) { b.done = 1; continue; }
        if (c.mio(b.holder) && !b.outSent) { b.outSent = 1; c.out(b.holder, Math.floor(b.T * 30)); }
      }
    }
    function iniciar(now) {
      if (!c.juez()) return;
      var a, b, vv = [], p, taken = [];
      for (p = 0; p < n; p++) if (!P[p].st) vv.push(p);
      for (a = 0; a < bombs.length; a++) {
        b = bombs[a];
        if (b.ini || b.plan !== -2 || now < b.S || now >= b.T - 0.5) continue;
        var cand = [], t2;
        for (t2 = 0; t2 < vv.length; t2++) { var cj = vv[t2], ocupado = false, z; for (z = 0; z < bombs.length; z++) if (bombs[z].r === b.r && bombs[z] !== b && (bombs[z].holder === cj || bombs[z].plan === cj)) ocupado = true; if (!ocupado) cand.push(cj); }
        var to = (b.k > 0 && vv.length < 3) || !cand.length ? -1 : cand[b.sel % cand.length];
        b.plan = to; c.ev('ini', { i: b.i, to: to, t: Math.round(now * 1000) });
      }
    }

    /* ───── IA ───── */
    var DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    function riesgo(x, y, now, sk) {                                             // cuánto le gusta a la CPU ese punto por los eventos (avisados o activos)
      var s = 0, a;
      for (a = 0; a < EVS.length; a++) {
        var e = EVS[a]; if (now < e.t0 + 0.25 * (1 - sk) || now >= e.t2) continue;
        if (e.k === 'comparsa') { var cx = now < e.t1 ? (e.dir > 0 ? -80 : AW + 80) : comparsaX(e, now), adel = (x - cx) * e.dir; if (Math.abs(y - e.y) < COMPH + 12 && adel > -COMPW && adel < 220) s -= 70 * sk + 20; }
        else if (e.k === 'manguera') { if (Math.abs(x - e.x) < MANG + 6) s -= 40 * sk + 10; }
        else { var dx = x - e.x, dy = (y - e.y) * 1.15; if (dx * dx + dy * dy < TAMB * TAMB) s += 22 * sk; }
      }
      return s;
    }
    function ai(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], d, a;
      if (now < 0 || q.st) { api.eje(0, 0); return; }
      if (now < pl.re) { var dd0 = DIRS[pl.dir]; api.eje(dd0[0], dd0[1]); return; }
      pl.re = now + 0.1 + (1 - sk) * 0.12;
      var err = (R2.next() * 2 - 1) * (50 - 40 * sk), err2 = (R2.next() * 2 - 1) * (50 - 40 * sk);
      var mb = bombaDe(p), bd = 0, bs = -1e9;
      if (mb) {                                                                  // con la bombita: tras el más cercano (sin el que me la pasó)
        var tgt = -1, td = 1e9;
        for (a = 0; a < n; a++) { if (a === p || P[a].st || (a === mb.prev && now < mb.prevT + 1.0)) continue; var ex = P[a].x - q.x, ey = P[a].y - q.y, dq = ex * ex + ey * ey; if (dq < td) { td = dq; tgt = a; } }
        if (tgt < 0) { api.eje(0, 0); return; }
        var tx = P[tgt].x + err, ty = P[tgt].y + err2;
        for (d = 0; d < DIRS.length; d++) { var v = DIRS[d], px = cl(q.x + v[0] * SPDB * 0.25, 20, AW - 20), py = cl(q.y + v[1] * SPDB * 0.25, 22, AH - 8), sc = -Math.sqrt((px - tx) * (px - tx) + (py - ty) * (py - ty)) + R2.next() * 2 + riesgo(px, py, now, sk) * 0.6; if (sc > bs) { bs = sc; bd = d; } }
        if (Math.sqrt(td) < 85 && now >= q.dashCd && bd && R2.next() < 0.15 + 0.45 * sk) api.press();   // embiste para alcanzarlo
      } else {                                                                   // sin ella: huir de quien la lleva (y del centro de las esquinas)
        var hs = [];
        for (a = 0; a < bombs.length; a++) if (bombs[a].ini && !bombs[a].done && bombs[a].holder >= 0 && bombs[a].holder !== p && !P[bombs[a].holder].st) hs.push(P[bombs[a].holder]);
        if (!hs.length) { var hx = AW * (0.18 + 0.64 * (p + 0.5) / n), hy = AH * 0.55; api.eje(Math.abs(hx - q.x) > 24 ? (hx > q.x ? 1 : -1) : 0, Math.abs(hy - q.y) > 24 ? (hy > q.y ? 1 : -1) : 0); pl.dir = 0; pl.re = now + 0.15; return; }
        for (d = 0; d < DIRS.length; d++) {
          var w = DIRS[d], qx = cl(q.x + w[0] * SPD * 0.4, 20, AW - 20), qy = cl(q.y + w[1] * SPD * 0.4, 22, AH - 8), md = 1e9, h;
          for (h = 0; h < hs.length; h++) { var gx = qx - hs[h].x + err * 0.4, gy = (qy - hs[h].y + err2 * 0.4) * 1.15, gd = Math.sqrt(gx * gx + gy * gy); if (gd < md) md = gd; }
          var borde = Math.min(qx - 20, AW - 20 - qx, (qy - 22) * 1.6, (AH - 8 - qy) * 1.6), s2 = Math.min(md, 220) + Math.min(borde, 60) * 0.9 + R2.next() * 3 - (d === 0 ? 8 : 0) + riesgo(qx, qy, now, sk);
          if (s2 > bs) { bs = s2; bd = d; }
        }
        var cerca = 1e9;
        for (h = 0; h < hs.length; h++) { var hx2 = q.x - hs[h].x, hy2 = (q.y - hs[h].y) * 1.15; cerca = Math.min(cerca, Math.sqrt(hx2 * hx2 + hy2 * hy2)); }
        if (cerca < 62 && now >= q.dashCd && bd && R2.next() < 0.12 + 0.45 * sk) api.press();   // embiste para zafarse
      }
      pl.dir = bd; var dv = DIRS[bd]; api.eje(dv[0], dv[1]);
    }

    /* ───── dibujo ───── */
    function px(x) { return geom().ox + x; }
    function bombita(x, y, s, b, now) {
      var rest = b ? b.T - now : 9, tem = b && rest < TIEMBLA && rest > -0.1, ox = tem ? Math.sin(absT * 70) * 2.5 : 0, oy2 = Math.sin(absT * 6 + (b ? b.i : 0)) * 2;
      var col = tem && Math.floor(absT * 16) % 2 ? '#ff5c6a' : '#3fa9ff', k = s * (tem ? 1 + 0.12 * Math.abs(Math.sin(absT * 30)) : 1);
      ell(x + ox, y + oy2, 13 * k, 15 * k, col, 3); poly([[x + ox - 4 * k, y + oy2 + 13 * k], [x + ox + 4 * k, y + oy2 + 13 * k], [x + ox, y + oy2 + 20 * k]], col, 2.5);
      ell(x + ox - 5 * k, y + oy2 - 6 * k, 3.5 * k, 5 * k, '#fffdf2', 0);
    }
    function fondo(f, G) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, k;
      rr(x0, 0, w, 330, 0, pal.cielo, 0);
      if (lv === 3) { for (k = 0; k < 8; k++) ell(x0 + 40 + k * (w / 8) + (k % 3) * 9, 40 + (k % 4) * 14, 1.6, 1.6, '#fffdf2', 0); } else { ell(x1 - 90, 60, 26, 26, '#fff3a0', 3); }
      for (k = 0; k < 5; k++) { var bx = x0 + 6 + k * (w / 5), bh = 74 + (k * 37 % 40); rr(bx, 196 - bh, w / 5 - 8, bh + 40, 3, k % 2 ? pal.edif : pal.edif2, 3); rr(bx + 10, 196 - bh + 12, 16, 20, 2, pal.luz ? '#ffe14d' : '#8fd8ff', 2.5); rr(bx + w / 5 - 36, 196 - bh + 12, 16, 20, 2, pal.luz ? '#ffe14d' : '#8fd8ff', 2.5); }
      /* guirnalda de banderines */
      var yb = 88; line([[x0, yb], [x0 + w * 0.25, yb + 16], [x0 + w * 0.5, yb], [x0 + w * 0.75, yb + 16], [x1, yb]], 2.5, INK);
      for (k = 0; k < 14; k++) { var u = (k + 0.5) / 14, bx2 = x0 + u * w, by2 = yb + Math.abs(Math.sin(u * Math.PI * 2)) * 16 * 0 + (u < 0.25 ? u / 0.25 * 16 : u < 0.5 ? (0.5 - u) / 0.25 * 16 : u < 0.75 ? (u - 0.5) / 0.25 * 16 : (1 - u) / 0.25 * 16); poly([[bx2 - 7, by2], [bx2 + 7, by2], [bx2, by2 + 14]], CONF[k % CONF.length], 2); }
      rr(x0, G.oy - 20, w, AH + 90, 0, pal.piso, 0);
      for (k = 0; k < 13; k++) rr(G.ox - 8, G.oy - 10 + k * 22, AW + 16, 2, 0, pal.piso2, 0);
      for (k = 0; k < 11; k++) line([[G.ox - 8 + k * 56 + (k % 2) * 6, G.oy - 12], [G.ox - 8 + k * 56 + (k % 2) * 6, G.oy + AH + 10]], 1.5, pal.piso2);
      /* serpentinas de papel en el piso */
      for (k = 0; k < 9; k++) rr(G.ox + 20 + (k * 61) % (AW - 40), G.oy + 14 + (k * 47) % (AH - 30), 14, 3, 1, CONF[k % CONF.length], 0);
    }
    function eventos2D(G, now) {                                                 // respaldo 2D: las mismas marcas en el piso, más sencillas
      var a, e, pul;
      if (vivos() <= 1) return;
      for (a = 0; a < EVS.length; a++) {
        e = EVS[a]; if (now < e.t0 || now >= e.t2) continue;
        pul = now < e.t1 ? 0.2 + 0.25 * Math.abs(Math.sin(absT * 14)) : 0.25;
        ctx.save(); ctx.globalAlpha = pul;
        if (e.k === 'comparsa') rr(G.ox, G.oy + e.y - COMPH, AW, COMPH * 2, 4, '#ff5c8a', 0);
        else if (e.k === 'manguera') rr(G.ox + e.x - MANG, G.oy - 10, MANG * 2, AH + 20, 4, '#3fa9ff', 0);
        else ell(G.ox + e.x, G.oy + e.y, TAMB, TAMB / 1.15, '#ffd23f', 3);
        ctx.restore();
        if (e.k === 'comparsa' && now >= e.t1) { var cx = G.ox + comparsaX(e, now), cy = G.oy + e.y; rr(cx - COMPW, cy - COMPH - 24, COMPW * 2, COMPH * 2 + 14, 8, '#ff5c8a', 3); ell(cx, cy - COMPH - 30, 16, 16, '#ffd9b0', 3); txt('COMPARSA', cx, cy - 2, 11, '#fffdf2', 0, true); }
        else if (e.k === 'manguera') { c.util.pj('tio', G.ox + e.x, G.oy - 14, 40, { animo: null, sombra: false }); }
        else if (e.k === 'tambores' && now >= e.t1) txt('♪ ♪', G.ox + e.x, G.oy + e.y + Math.sin(absT * 14) * 3, 16, '#ffd23f', 0, true);
      }
    }
    function persona(p, x, y, now) {
      var s = asiento(p), col = s.color || '#ffd23f', q = P[p], tiene = lleva(p) > 0, b = bombaDe(p);
      ctx.save();
      ell(x, y + 3, 20, 6, INK, 0);
      rr(x - 11, y - 26, 8, 24, 4, '#2f3a7a', 3); rr(x + 3, y - 26, 8, 24, 4, '#2f3a7a', 3);
      rr(x - 15, y - 62, 30, 38, 10, col, 3.5);
      c.util.pj(s.ch, x, y - 78, 62, { animo: tiene ? 'perder' : (now - q.passAt < 0.6 ? 'celebrar' : null), sombra: false });
      ctx.restore();
      if (tiene) {
        var pul = 0.35 + 0.3 * Math.abs(Math.sin(absT * 9));
        ctx.save(); ctx.globalAlpha = pul; ell(x, y + 6, 30, 10, '#ff3b4e', 0); ctx.restore();
        bombita(x, y - 118, 1, b, now);
        var k2 = lleva(p); if (k2 > 1) txt('x' + k2, x + 18, y - 108, 12, '#fffdf2', 0, true);
      }
      if (p === c.yo) poly([[x - 8, y - (tiene ? 148 : 126)], [x + 8, y - (tiene ? 148 : 126)], [x, y - (tiene ? 136 : 114)]], '#ffd23f', 3);
    }

    /* ───── 3D low poly (fiesta-3d.js): la plaza en Carnaval. Solo dibujo: lee P, bombs y los eventos; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var ESX = 1 / 18, ESZ = 1.15 / 18;                                          // px de la simulación -> metros (z con el mismo 1.15 del toque)
    function WX(x) { return (x - AW / 2) * ESX; }
    function WZ(y) { return (y - AH / 2) * ESZ; }
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', piso: '#e3c79a', junta: '#c9a576', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', piso: '#d9b48a', junta: '#b98f66', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', piso: '#7a6a80', junta: '#5a4a62', noche: 1 }
    };
    var CASAS = ['#ff9ec7', '#ffd23f', '#7fd6c9', '#ffb36b', '#a9a0ff', '#8fd8ff', '#ff7a6a'];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, a;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 70, 160], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* piso: adoquines de la plaza (textura pintada) */
      var adoq = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.junta; x.fillRect(0, 0, w, h);
        for (var j = 0; j < 8; j++) for (var i = 0; i < 8; i++) {
          var o = j % 2 ? 16 : 0, sh = ((i * 7 + j * 13) % 5) / 5;
          x.fillStyle = V3.oscurecer(pl.piso, .9 + sh * .12); x.fillRect(i * 32 + o + 2, j * 32 + 2, 28, 28);
        }
      }, [22, 14]);
      var piso = new T.Mesh(new T.PlaneGeometry(120, 80), new T.MeshToonMaterial({ map: adoq, gradientMap: V3.toon('#fff').gradientMap }));
      piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      /* la pista: borde pintado amarillo y confeti pegado en el piso */
      var bw = AW * ESX + 1.6, bd = AH * ESZ + 1.6;
      [[0, -bd / 2, bw, .18], [0, bd / 2, bw, .18], [-bw / 2, 0, .18, bd], [bw / 2, 0, .18, bd]].forEach(function (r) {
        var m = new T.Mesh(new T.PlaneGeometry(r[2], r[3]), tn('#ffd23f')); m.rotation.x = -Math.PI / 2; m.position.set(r[0], .02, r[1]); m.receiveShadow = true; S3.add(m);
      });
      for (k = 0; k < 70; k++) {
        var cf = new T.Mesh(new T.PlaneGeometry(.22, .12), tn(CONF[k % CONF.length])); cf.rotation.set(-Math.PI / 2, 0, (k * 2.39) % 6.28);
        cf.position.set(((k * 37.7) % 60) - 30, .015, ((k * 23.3) % 30) - 13); cf.receiveShadow = true; S3.add(cf);
      }
      /* fila de casas coloniales al fondo + la iglesia en el centro */
      var balcones = [];
      function casa(x, z, w, h, col, rot) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); g3.rotation.y = rot || 0; S3.add(g3);
        var cuerpo = M(new T.BoxGeometry(w, h, 4), col, { recibe: true, g: .015 }); cuerpo.position.y = h / 2; g3.add(cuerpo);
        var zoc = M(new T.BoxGeometry(w + .05, .9, 4.05), '#fffdf2', { borde: false, recibe: true }); zoc.position.y = .45; g3.add(zoc);
        var tejas = M(new T.CylinderGeometry(.01, 3.2, w + .6, 3, 1), '#c4563a', { g: .02 }); tejas.rotation.z = Math.PI / 2; tejas.scale.set(1, 1, .5); tejas.position.set(0, h + .55, 0); g3.add(tejas);
        var nv = Math.max(1, Math.round(w / 2.6));
        for (var i = 0; i < nv; i++) {
          var vx = -w / 2 + (i + .5) * w / nv;
          if (i === Math.floor(nv / 2) && h < 9) { var pu = M(new T.BoxGeometry(1.3, 2.4, .2), '#7a4a2a', { g: .03 }); pu.position.set(vx, 1.2, 2.02); g3.add(pu); }
          else { var v1 = M(new T.BoxGeometry(1, 1.5, .15), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); v1.position.set(vx, 1.9, 2.02); g3.add(v1); }
          if (h > 5.5) {
            var v2 = M(new T.BoxGeometry(.9, 1.3, .15), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); v2.position.set(vx, h - 2, 2.02); g3.add(v2);
            var bal = M(new T.BoxGeometry(1.5, .12, .7), '#5a3a22', { g: .04 }); bal.position.set(vx, h - 2.75, 2.35); g3.add(bal); if (!rot) balcones.push({ x: x + vx, y: h - 2.75, z: z + 2.3 });
            var rej = M(new T.BoxGeometry(1.5, .5, .06), '#2a2a34', { borde: false }); rej.position.set(vx, h - 2.45, 2.68); g3.add(rej);
          }
        }
        return g3;
      }
      var xs = -34;
      for (k = 0; xs < 34; k++) {
        var w0 = 6 + (k * 5) % 4, h0 = 5 + (k * 3) % 4;
        if (Math.abs(xs + w0 / 2) < 4) { var ig = casa(0, -15, 9, 11, '#fff1c2'); var torre = M(new T.BoxGeometry(2.6, 6, 2.6), '#fff1c2', { recibe: true, g: .02 }); torre.position.set(0, 14, 0); ig.add(torre);
          var cup = M(new T.ConeGeometry(2, 2.6, 4), '#c4563a'); cup.position.set(0, 18.3, 0); cup.rotation.y = Math.PI / 4; ig.add(cup);
          var camp = M(new T.SphereGeometry(.5, 6, 4), '#d9a520'); camp.position.set(0, 14.6, 1.35); ig.add(camp);
          var cruz = M(new T.BoxGeometry(.18, 1.2, .18), '#d9a520'); cruz.position.set(0, 20.2, 0); ig.add(cruz); xs = 4.6; continue; }
        casa(xs + w0 / 2, -14, w0, h0, CASAS[k % CASAS.length]); xs += w0 + .2;
      }
      /* casas de los lados (en ángulo, cierran la plaza) */
      casa(-27, -3, 8, 6, CASAS[3], Math.PI / 2 * .7); casa(27, -3, 8, 6, CASAS[5], -Math.PI / 2 * .7);
      /* palmeras y faroles */
      function palmera(x, z, h) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        for (var i = 0; i < 6; i++) { var tr = M(new T.CylinderGeometry(.28 - i * .02, .34 - i * .02, h / 6, 6), i % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(i * .3) * .3, h / 12 + i * h / 6, 0); g3.add(tr); }
        for (var j = 0; j < 7; j++) {
          var hoja = M(new T.ConeGeometry(.5, 3.6, 4), j % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 });
          hoja.geometry.translate(0, 1.8, 0); hoja.position.set(.5, h, 0); hoja.rotation.set(0, j / 7 * 6.28, 0); hoja.rotateZ(1.9); g3.add(hoja); hojas.push(hoja);
        }
        return g3;
      }
      var hojas = [];
      palmera(-19, -9, 7.5); palmera(19, -9, 8); palmera(-23, 6, 6.5); palmera(23, 7, 7);
      var focos = [];
      function farol(x, z) {
        var po = M(new T.CylinderGeometry(.1, .14, 5, 6), '#2a2a34'); po.position.set(x, 2.5, z); S3.add(po);
        var la = M(new T.BoxGeometry(.6, .7, .6), '#2a2a34'); la.position.set(x, 5.2, z); S3.add(la);
        var vi = new T.Mesh(new T.BoxGeometry(.45, .5, .45), tn('#fff2a0', { em: '#ffd36a', emI: pl.noche ? 1.6 : .2 })); vi.position.set(x, 5.2, z); S3.add(vi);
        if (pl.noche) { var luz = new T.PointLight(0xffc870, 1.3, 16, 2); luz.position.set(x, 4.6, z); S3.add(luz); }
      }
      farol(-17, 3); farol(17, 3); farol(-17, -9.5); farol(17, -9.5);
      /* banderines: tres guirnaldas de las casas a los faroles; cada banderín se mece con el viento */
      var banderas = [];
      function guirnalda(a0, a1, n2, caida) {
        var pts = [], i;
        for (i = 0; i <= 24; i++) { var u = i / 24; pts.push(new T.Vector3(a0.x + (a1.x - a0.x) * u, a0.y + (a1.y - a0.y) * u - Math.sin(u * Math.PI) * caida, a0.z + (a1.z - a0.z) * u)); }
        var cur = new T.CatmullRomCurve3(pts), tubo = new T.Mesh(new T.TubeGeometry(cur, 30, .03, 4), tn('#14101c')); S3.add(tubo);
        var tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-.32, 0, 0, .32, 0, 0, 0, -.7, 0], 3)); tri.computeVertexNormals();
        for (i = 0; i < n2; i++) {
          var p2 = cur.getPoint((i + .5) / n2), f2 = new T.Mesh(tri, new T.MeshToonMaterial({ color: CONF[i % CONF.length], side: T.DoubleSide, gradientMap: V3.toon('#fff').gradientMap }));
          f2.position.copy(p2); f2.castShadow = true; S3.add(f2); banderas.push(f2);
          if (pl.noche && i % 2) { var bo = new T.Mesh(new T.SphereGeometry(.13, 6, 4), tn('#fff6c0', { em: CONF[(i + 2) % CONF.length], emI: 2 })); bo.position.copy(p2).y -= .05; S3.add(bo); }
        }
      }
      guirnalda(new T.Vector3(-17, 5.4, 3), new T.Vector3(-8, 7.5, -12), 14, 1.4);
      guirnalda(new T.Vector3(17, 5.4, 3), new T.Vector3(8, 7.5, -12), 14, 1.4);
      guirnalda(new T.Vector3(-17, 5.6, -9.5), new T.Vector3(17, 5.6, -9.5), 26, 1.8);
      /* acera de adelante con su banco: ahí se sientan los mojados */
      var acera = M(new T.BoxGeometry(70, .25, 4), '#b8ae9c', { borde: false, recibe: true }); acera.position.set(0, .12, 12.2); S3.add(acera);
      var banco = new T.Group(); banco.position.set(0, 0, 11.6); S3.add(banco);
      var tabla = M(new T.BoxGeometry(9, .2, 1), '#c4783a', { recibe: true }); tabla.position.y = .85; banco.add(tabla);
      [-4, 4].forEach(function (x) { var pa = M(new T.BoxGeometry(.2, .85, .9), '#2a2a34'); pa.position.set(x, .42, 0); banco.add(pa); });
      /* el tobo de bombitas de la esquina (como en la plaza de verdad) */
      var tobo = M(new T.CylinderGeometry(1, .8, 1.1, 8), '#3f7fd0'); tobo.position.set(-14, .55, 10.6); S3.add(tobo);
      for (k = 0; k < 9; k++) { var bb = M(new T.SphereGeometry(.32, 7, 5), ['#3fa9ff', '#ff5c8a', '#ffd23f', '#5cff7a'][k % 4], { g: .05 }); bb.position.set(-14 + Math.cos(k * 2.4) * .5, 1.15 + (k % 3) * .15, 10.6 + Math.sin(k * 2.4) * .5); S3.add(bb); }

      /* ───── el público (InstancedMesh), la tarima con su música, serpentinas y globos: la plaza llena de Carnaval ───── */
      function hz(q) { var v = Math.sin(q * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
      var SKIN = ['#f1c9a0', '#d9a273', '#a8744a', '#7a4e2e', '#ffd9b0'], TRAJE = CONF.concat(['#8e5cff', '#ff3b4e', '#2fd0d0', '#fffdf2']);
      var TX = 12.6, TZ = -10.7;                                                // la tarima, al fondo a la derecha
      var gente = [];
      function pers(x, y, z, s, sy, tipo) {
        var q = gente.length, dia = hz(q + 11) < .13;                           // los diablos danzantes: cara y traje rojos
        gente.push({ x: x, y: y, z: z, s: s, sy: sy, tipo: tipo, ph: hz(q) * 6.28, f: 1.5 + hz(q + 50), ry: tipo === 'balcon' ? Math.atan2(-x * .2, 1) : Math.atan2(-x, 2 - z), arr: hz(q + 9) < .55, amp: 2.5 + hz(q + 3) * 4,
          body: dia ? '#d6203a' : TRAJE[Math.floor(hz(q + 7) * TRAJE.length)], head: dia ? '#d6203a' : SKIN[Math.floor(hz(q + 5) * SKIN.length)], hat: dia ? '#14101c' : CONF[Math.floor(hz(q + 13) * CONF.length)], dia: dia });
      }
      [[-10.8, .4, 1.1], [-11.7, .8, .8]].forEach(function (r) { var gr = M(new T.BoxGeometry(46, r[1], r[2]), '#b8ae9c', { borde: false, recibe: true }); gr.position.set(0, r[1] / 2, r[0]); S3.add(gr); });
      [[-9.9, 0, 2.0], [-10.8, .4, 1.2], [-11.7, .8, 1.1]].forEach(function (r, ri) {
        for (var xx = -21 + ri * .5; xx < 21; xx += r[2]) {
          if (Math.abs(xx - TX) < 5.4) continue;
          var zan = hz(gente.length + 31) < .09 ? 1.75 : 1;                       // zancudos entre la gente
          pers(xx + (hz(gente.length + 2) - .5) * .4, r[1], r[0], .9 + hz(gente.length + 4) * .25, zan, ri === 0 ? 'camina' : 'baila');
        }
      });
      balcones.forEach(function (b, bi) { var m2 = 1 + (hz(bi + 70) < .45 ? 1 : 0), ii; for (ii = 0; ii < m2; ii++) pers(b.x + (ii ? .3 : -.22), b.y + .06, b.z - .1, .6, 1, 'balcon'); });
      var nG = gente.length, dum = new T.Object3D(), gradG = V3.toon('#fff').gradientMap;
      function inst(geo, n2) { var m = new T.InstancedMesh(geo, new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gradG }), n2); m.frustumCulled = false; S3.add(m); return m; }
      var gCuerpo = new T.CylinderGeometry(.3, .4, 1.1, 7); gCuerpo.translate(0, .55, 0);
      var gSomb = new T.ConeGeometry(.3, .62, 6); gSomb.translate(0, .31, 0);
      var gBra = new T.BoxGeometry(.13, .75, .13); gBra.translate(0, -.375, 0);
      var iCuerpo = inst(gCuerpo, nG), iCab = inst(new T.SphereGeometry(.27, 7, 5), nG), iSomb = inst(gSomb, nG), iBra = inst(gBra, nG * 2), colG = new T.Color();
      gente.forEach(function (q, i) {
        iCuerpo.setColorAt(i, colG.set(q.body)); iCab.setColorAt(i, colG.set(q.head)); iSomb.setColorAt(i, colG.set(q.hat));
        iBra.setColorAt(i * 2, colG.set(q.body)); iBra.setColorAt(i * 2 + 1, colG.set(q.body));
      });
      [iCuerpo, iCab, iSomb, iBra].forEach(function (m) { m.instanceColor.needsUpdate = true; });
      /* la tarima: plataforma, telón con letrero, bocinas que laten, ecualizador, luces de colores y tres músicos */
      var tar = new T.Group(); tar.position.set(TX, 0, TZ); S3.add(tar);
      var tbase = M(new T.BoxGeometry(9.4, 1.2, 3.4), '#7a4a2a', { g: .03, recibe: true }); tbase.position.y = .6; tar.add(tbase);
      var talf = M(new T.BoxGeometry(9.2, .06, 3.2), '#c4263a', { borde: false, recibe: true }); talf.position.y = 1.23; tar.add(talf);
      var tcort = M(new T.BoxGeometry(8.6, 5, .15), '#5a2a8a', { g: .03 }); tcort.position.set(0, 3.7, -1.5); tar.add(tcort);
      [-4.5, 4.5].forEach(function (x) { var col2 = M(new T.CylinderGeometry(.22, .26, 6.4, 8), '#fffdf2', { g: .03 }); col2.position.set(x, 3.2, -1.35); tar.add(col2); });
      var tvig = M(new T.BoxGeometry(9.8, .5, .6), '#ffd23f', { g: .03 }); tvig.position.set(0, 6.4, -1.2); tar.add(tvig);
      var tcart = new T.Mesh(new T.PlaneGeometry(7.6, 1.5), new T.MeshBasicMaterial({ map: V3.texturaCanvas(512, 100, function (x, w, h) {
        x.fillStyle = '#ff5c8a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8);
        x.fillStyle = '#fffdf2'; x.font = 'bold 62px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('¡CARNAVAL!', w / 2, h / 2 + 3);
      }, [1, 1]) })); tcart.position.set(0, 5.35, -1.4); tar.add(tcart);
      var ecual = [];
      for (k = 0; k < 10; k++) { var geq = new T.BoxGeometry(.5, 1, .1); geq.translate(0, .5, 0); var eq = new T.Mesh(geq, tn(CONF[k % CONF.length], { em: CONF[k % CONF.length], emI: .6 })); eq.position.set(-4.05 + k * .9, .08, 1.72); tar.add(eq); ecual.push(eq); }
      var bocinas = [];
      [-3.6, 3.6].forEach(function (x) {
        var bg = new T.Group(); bg.position.set(x, 1.2, .4); tar.add(bg);
        var bc = M(new T.BoxGeometry(1.1, 1.9, 1), '#2a2a34', { g: .03 }); bc.position.y = .95; bg.add(bc);
        [.5, 1.4].forEach(function (yy, ii) { var wf = M(new T.CylinderGeometry(ii ? .22 : .38, ii ? .22 : .38, .1, 12), '#4a4a58', { borde: false }); wf.rotation.x = Math.PI / 2; wf.position.set(0, yy, .52); bg.add(wf); });
        bocinas.push(bg);
      });
      var lamparas = [], haces = [];
      for (k = 0; k < 6; k++) { var lm = new T.Mesh(new T.SphereGeometry(.22, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff })); lm.position.set(-3.75 + k * 1.5, 6, -.85); tar.add(lm); lamparas.push(lm); }
      [-2.2, 2.2].forEach(function (x, ii) {
        var hg = new T.Group(); hg.position.set(x, 6.0, -.6); tar.add(hg);
        var gcono = new T.ConeGeometry(1.3, 7.5, 12, 1, true); gcono.translate(0, -3.75, 0);
        var cono = new T.Mesh(gcono, new T.MeshBasicMaterial({ color: ii ? 0xff5c8a : 0x3fd0ff, transparent: true, opacity: pl.noche ? .22 : .1, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); hg.add(cono); haces.push({ g: hg, m: cono, ph: ii * 2.1 });
      });
      var musicos = [['cobrador', -1.6], ['pana', 1.6]].map(function (r) { var mu = V3.PJ.crear(r[0], { prop: false, escala: 1.3 }); mu.g.position.set(r[1], 1.26, .2); mu.rumbo(0); tar.add(mu.g); return mu; });
      var tamb2 = M(new T.CylinderGeometry(.5, .42, .9, 10), '#c4563a', { g: .04 }); tamb2.position.set(0, 1.7, 1.15); tar.add(tamb2);
      var tamb2p = M(new T.CylinderGeometry(.52, .52, .06, 10), '#fffdf2', { borde: false }); tamb2p.position.set(0, 2.17, 1.15); tar.add(tamb2p);
      /* serpentinas colgando de la guirnalda del medio y de los balcones */
      var serps = [];
      function serp(x, y, z, k2, largo) {
        var gs = new T.PlaneGeometry(.16, largo, 1, 6); gs.translate(0, -largo / 2, 0);
        var sm = new T.Mesh(gs, new T.MeshBasicMaterial({ color: new T.Color(CONF[k2 % CONF.length]), side: T.DoubleSide })); sm.position.set(x, y, z); S3.add(sm); serps.push({ m: sm, ph: hz(k2 + 90) * 6.28 });
      }
      for (k = 0; k < 20; k++) { var us = (k + .5) / 20; serp(-17 + 34 * us, 5.6 - Math.sin(us * Math.PI) * 1.8, -9.5, k, 1.6 + hz(k + 3) * 1.4); }
      balcones.forEach(function (b, bi) { if (bi % 2 === 0) serp(b.x, b.y + .3, b.z + .4, bi + 28, 1.8); });
      /* racimos de globos amarrados a los faroles y a la tarima */
      var racimos = [];
      [[-17, 5.5, 3], [17, 5.5, 3], [-17, 5.5, -9.5], [17, 5.5, -9.5], [TX - 4.5, 6.6, TZ + 1.5], [TX + 4.5, 6.6, TZ + 1.5]].forEach(function (r, ri) {
        var rg = new T.Group(); rg.position.set(r[0], r[1], r[2]); S3.add(rg);
        var cuer = new T.Mesh(new T.CylinderGeometry(.015, .015, 1.6, 3), new T.MeshBasicMaterial({ color: 0x14101c })); cuer.position.y = .8; rg.add(cuer);
        for (var bj = 0; bj < 5; bj++) { var gl = new T.Mesh(new T.SphereGeometry(.34, 8, 6), tn(CONF[(ri + bj) % CONF.length])); gl.scale.y = 1.2; gl.position.set(Math.cos(bj * 1.3) * .42, 1.85 + (bj % 3) * .22, Math.sin(bj * 1.3) * .3); rg.add(gl); }
        racimos.push({ g: rg, ph: ri * 1.7 });
      });

      /* los jugadores */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });   // manos libres: aquí se carga la bombita
        pj.g.position.set(WX(P[k].x), 0, WZ(P[k].y)); S3.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: s2.color && s2.color !== '#fff' ? s2.color : CONF[k % CONF.length], transparent: true, opacity: .85 }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = .04; S3.add(aro);
        var peligro = new T.Mesh(new T.CircleGeometry(1.25, 20), new T.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false })); peligro.rotation.x = -Math.PI / 2; peligro.position.y = .03; S3.add(peligro);
        pj.g.rotation.order = 'YXZ';
        pjs.push({ pj: pj, aro: aro, peligro: peligro, x: WX(P[k].x), z: WZ(P[k].y), px: WX(P[k].x), pz: WZ(P[k].y), rumbo: 0, sentado: -1, salio: -9, gota: 0, lanT: -9, hopT: -9, susT: -9, reaT: -9, reaA: -1, golpeT: -9, kx: 0, kz: 0, polvo: 0, sacT: 0, rePasa: -9, esqT: -9 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      /* las bombitas (una por bomba en juego) */
      var globos = bombs.map(function () {
        var g3 = new T.Group(), mat = V3.toon('#3fa9ff', { op: .92, nuevo: true });
        var cu = V3.malla(new T.SphereGeometry(.55, 10, 8), null, { mat: mat, g: .06 }); cu.scale.set(1, 1.12, 1); g3.add(cu);
        var nu = V3.malla(new T.ConeGeometry(.14, .3, 6), null, { mat: mat, g: .1 }); nu.position.y = -.68; nu.rotation.x = Math.PI; g3.add(nu);
        var br = new T.Mesh(new T.SphereGeometry(.14, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); br.position.set(-.2, .25, .38); br.scale.set(1, 1.4, .5); g3.add(br);
        g3.visible = false; S3.add(g3);
        return { g: g3, mat: mat, cu: cu, de: null, vuelo: 1, quien: -1, latio: -9 };
      });
      /* ───── eventos de la plaza: marcas en el piso (aviso) + lo que pasa ───── */
      function marca(geo, col) { var m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .035; m.visible = false; S3.add(m); return m; }
      var franja = marca(new T.PlaneGeometry(AW * ESX + 1.6, COMPH * 2 * ESZ), 0xff3b8a);
      var columna = marca(new T.PlaneGeometry(MANG * 2 * ESX, AH * ESZ + 1.6), 0x3fa9ff);
      var discoT = marca(new T.CircleGeometry(TAMB / 18, 32), 0xffd23f), aroT = marca(new T.RingGeometry(TAMB / 18 - .22, TAMB / 18, 32), 0xffb000);
      /* la carroza de la comparsa: plataforma con ruedas, un cabezón de Carnaval y dos que bailan encima */
      var carroza = new T.Group(); carroza.visible = false; S3.add(carroza);
      var plat = M(new T.BoxGeometry(COMPW * 2 * ESX, .7, COMPH * 2 * ESZ * .85), '#ff5c8a', { g: .04, recibe: true }); plat.position.y = .75; carroza.add(plat);
      var faldon = M(new T.BoxGeometry(COMPW * 2 * ESX + .1, .25, COMPH * 2 * ESZ * .85 + .1), '#ffd23f', { borde: false }); faldon.position.y = .45; carroza.add(faldon);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (r) { var ru = M(new T.CylinderGeometry(.35, .35, .25, 10), '#2a2a34', { g: .03 }); ru.rotation.x = Math.PI / 2; ru.position.set(r[0] * COMPW * ESX * .75, .35, r[1] * COMPH * ESZ * .8); carroza.add(ru); });
      var cabezon = new T.Group(); cabezon.position.set(0, 2.5, -.4); carroza.add(cabezon);
      var cara0 = M(new T.SphereGeometry(1, 10, 8), '#ffd9b0', { g: .05 }); cabezon.add(cara0);
      [-.35, .35].forEach(function (x) { var oj = M(new T.SphereGeometry(.16, 6, 4), '#14101c', { borde: false }); oj.position.set(x, .15, .9); cabezon.add(oj); });
      var boca = M(new T.BoxGeometry(.6, .12, .1), '#c4263a', { borde: false }); boca.position.set(0, -.35, .95); cabezon.add(boca);
      var gorro = M(new T.ConeGeometry(.7, 1.3, 8), '#3fd0a0', { g: .04 }); gorro.position.y = 1.4; cabezon.add(gorro);
      var bailarines = ['prima', 'pana'].map(function (id, i) { var b3 = V3.PJ.crear(id, { prop: false, escala: 1 }); b3.g.position.set((i ? 1 : -1) * 1.3, 1.1, .5); carroza.add(b3.g); return b3; });
      /* el chamo de la manguera, parado en el borde de atrás */
      var mangero = V3.PJ.crear('tio', { prop: false, escala: 1.35 }); mangero.g.visible = false; S3.add(mangero.g);
      var manguera = M(new T.CylinderGeometry(.09, .09, 1.6, 6), '#3fae4a', { g: .03 }); manguera.rotation.x = Math.PI / 2.4; manguera.visible = false; S3.add(manguera);
      /* los tambores: tres cueros y un tamborero que baila */
      var tambores = new T.Group(); tambores.visible = false; S3.add(tambores);
      var cueros = [];
      for (k = 0; k < 3; k++) {
        var tb = new T.Group(), ang = k / 3 * Math.PI * 2 + .5; tb.position.set(Math.cos(ang) * (TAMB / 18 + .5), 0, Math.sin(ang) * (TAMB / 18 + .5)); tambores.add(tb);
        var cu0 = M(new T.CylinderGeometry(.45, .38, 1.1, 10), ['#c4563a', '#7a4a2a', '#d9a520'][k], { g: .04 }); cu0.position.y = .55; tb.add(cu0);
        var pa0 = M(new T.CylinderGeometry(.46, .46, .06, 10), '#fffdf2', { borde: false }); pa0.position.y = 1.12; tb.add(pa0); cueros.push(tb);
      }
      var tamborero = V3.PJ.crear('abuela', { prop: false, escala: 1.2 }); tamborero.g.position.set(0, 0, -(TAMB / 18 + 1)); tambores.add(tamborero.g);
      if (V3.pista) V3.pista('bombita-fin', { bpm: 168, acordes: [[52, 56, 59], [57, 61, 64], [59, 63, 66], [52, 56, 59]],   // la misma calipso, un tono arriba y a toda mecha
        mel: [76, 0, 78, 80, 0, 78, 76, 0, 73, 0, 76, 78, 0, 76, 73, 71, 73, 0, 76, 0, 78, 76, 73, 0, 75, 0, 78, 0, 76, 0, 80, 0] });
      var charcos = [], ondas = [];
      var part = V3.particulas(esc, 800);
      esc.encuadrar(AW * ESX + 2, AH * ESZ + 3, new T.Vector3(0, .8, 2.2), .74);
      var R = V3.ultimo = { esc: esc, pjs: pjs, flecha: flecha, globos: globos, charcos: charcos, ondas: ondas, part: part, banderas: banderas, hojas: hojas, confT: 0,
        franja: franja, columna: columna, discoT: discoT, aroT: aroT, carroza: carroza, cabezon: cabezon, bailarines: bailarines, mangero: mangero, manguera: manguera,
        tambores: tambores, cueros: cueros, tamborero: tamborero, hemiBase: pl.hemi[0], aguaT: 0,
        cam: { x: 0, z: 2.2, w: AW * ESX + 2, h: AH * ESZ + 3 }, estallar: function (p) { estallido3D(p); } };
      R.gente = gente; R.dum = dum; R.iCuerpo = iCuerpo; R.iCab = iCab; R.iSomb = iSomb; R.iBra = iBra; R.ecual = ecual; R.bocinas = bocinas; R.lamparas = lamparas; R.haces = haces;
      R.musicos = musicos; R.serps = serps; R.racimos = racimos; R.balcones = balcones; R.tar = tar; R.vitor = 0; R.papT = 1.2; R.canonT = 3; R.tarX = TX; R.tarZ = TZ;
      return R;
    }
    var ASIENTOS_BANCO = [-3, -1, 1, 3];
    function peligroCerca(p) {                                                  // ¿una bombita que tiembla a menos de 4 m? (solo la cara)
      var a2, now = c.ahora();
      for (a2 = 0; a2 < bombs.length; a2++) { var b2 = bombs[a2]; if (!b2.ini || b2.done || b2.holder < 0 || b2.holder === p || b2.T - now > TIEMBLA) continue;
        var h2 = v3.pjs[b2.holder], m2 = v3.pjs[p], dx2 = h2.x - m2.x, dz2 = h2.z - m2.z; if (dx2 * dx2 + dz2 * dz2 < 16) return true; }
      return false;
    }
    function animarGente(V, t, en) {                                            // el público: salta, gira, levanta los brazos; los de la fila de adelante pasean
      var G = V.gente, d = V.dum, i, q, ph, bob, ry, px, H, raise, c1, s1, lx, th, wv;
      for (i = 0; i < G.length; i++) {
        q = G[i]; ph = t * q.f * (1 + .35 * en) + q.ph;
        bob = (q.tipo === 'balcon' ? .55 : 1) * Math.abs(Math.sin(ph * 2)) * (.05 + .2 * en) * q.s;
        px = q.x; ry = q.ry + Math.sin(ph) * .4 * (.4 + en);
        if (q.tipo === 'camina') { wv = Math.cos(t * .22 + q.ph); px += Math.sin(t * .22 + q.ph) * q.amp * .3; ry = wv > 0 ? 1.57 : -1.57; }
        H = q.s * q.sy;
        d.position.set(px, q.y + bob, q.z); d.rotation.set(0, ry, 0); d.scale.set(q.s, H * (1 + .05 * Math.sin(ph * 2 + 1.5) * en), q.s); d.updateMatrix(); V.iCuerpo.setMatrixAt(i, d.matrix);
        d.position.set(px, q.y + bob + 1.38 * H, q.z); d.scale.set(q.s, q.s, q.s); d.updateMatrix(); V.iCab.setMatrixAt(i, d.matrix);
        d.position.set(px, q.y + bob + 1.38 * H + .2 * q.s, q.z); d.rotation.set(0, ry, Math.sin(ph * 2) * .22); d.scale.set(q.s, q.s * (q.dia ? 1.5 : 1), q.s); d.updateMatrix(); V.iSomb.setMatrixAt(i, d.matrix);
        raise = q.arr ? Math.min(1, .3 + en * .9) : Math.max(0, Math.min(.7, en - .55));
        c1 = Math.cos(ry); s1 = Math.sin(ry);
        for (lx = -1; lx <= 1; lx += 2) {
          th = .3 + 2.2 * raise + Math.sin(ph * 2 + (lx > 0 ? 0 : 1.6)) * .45 * raise;
          d.position.set(px + lx * .4 * q.s * c1, q.y + bob + 1.0 * H, q.z - lx * .4 * q.s * s1); d.rotation.set(0, ry, lx * th); d.scale.set(q.s, H, q.s); d.updateMatrix(); V.iBra.setMatrixAt(i * 2 + (lx > 0 ? 1 : 0), d.matrix);
        }
      }
      V.iCuerpo.instanceMatrix.needsUpdate = V.iCab.instanceMatrix.needsUpdate = V.iSomb.instanceMatrix.needsUpdate = V.iBra.instanceMatrix.needsUpdate = true;
    }
    function vidaPlaza(V, dt, t, bt, fz3) {                                     // tarima con música, serpentinas, globos y papelillo
      var i, a, m, lado;
      for (i = 0; i < V.ecual.length; i++) V.ecual[i].scale.y = .2 + .8 * Math.abs(Math.sin(t * 3.1 + i * 1.3)) * (.45 + bt * .55);
      for (i = 0; i < V.bocinas.length; i++) { m = 1 + .07 * bt; V.bocinas[i].scale.set(m, 1 + .03 * bt, m); }
      for (i = 0; i < V.lamparas.length; i++) V.lamparas[i].material.color.setHSL((t * .35 + i * .17) % 1, .9, .6);
      for (i = 0; i < V.haces.length; i++) { a = V.haces[i]; a.g.rotation.set(-.35 + Math.sin(t * 1.3 + a.ph) * .3, 0, Math.sin(t * .9 + a.ph) * .45); a.m.material.color.setHSL((t * .25 + a.ph) % 1, .9, .6); }
      for (i = 0; i < V.musicos.length; i++) { m = V.musicos[i]; m.anim(i === 0 && Math.floor(t / 3.5) % 2 ? 'saludar' : 'bailar').cara('feliz').update(dt); }
      for (i = 0; i < V.serps.length; i++) { a = V.serps[i]; a.m.rotation.set(Math.sin(t * 1.7 + a.ph) * .3, 0, Math.sin(t * 1.3 + a.ph * 1.7) * .2); a.m.scale.y = .9 + .1 * Math.sin(t * 3 + a.ph); }
      for (i = 0; i < V.racimos.length; i++) { a = V.racimos[i]; if (a.y0 === undefined) a.y0 = a.g.position.y; a.g.position.y = a.y0 + Math.sin(t * 1.2 + a.ph) * .18; a.g.rotation.z = Math.sin(t * .9 + a.ph) * .12; }
      V.papT -= dt;
      if (V.papT < 0) {                                                         // papelillo desde los balcones
        V.papT = (fz3 === 2 ? .35 : .7) + c.fx() * .7; m = V.balcones[Math.floor(c.fx() * V.balcones.length)];
        if (m) V.part.soltar(m.x, m.y + .8, m.z + .6, 8, { k: 'confeti', cols: CONF, vel: 1.6, arriba: 3, g: 2.2, vida: 3.4 });
      }
      V.canonT -= dt;
      if (V.canonT < 0) {                                                       // los cañones de confeti de la tarima
        V.canonT = fz3 === 2 ? 2.2 : 3.8;
        for (lado = -1; lado <= 1; lado += 2) V.part.soltar(V.tarX + lado * 3.9, 2.6, V.tarZ + 1, 22, { k: 'confeti', cols: CONF, vel: 2.6, arriba: 9, g: 5, vida: 3.2 });
        V3.sfx('pop');
      }
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, p, a, t = absT;
      V.part.update(dt);
      /* confeti que cae siempre (Carnaval) */
      var fz3 = now >= 0 && now < dur && vivos() > 1 ? faseJ(now) : 0;
      V.confT -= dt; if (V.confT < 0) { V.confT = fz3 === 2 ? .035 : fz3 === 1 ? .08 : .12; V.part.soltar((c.fx() - .5) * 40, 11, (c.fx() - .5) * 18 - 2, 2, { k: 'confeti', cols: CONF, vel: .8, arriba: 0, g: 2.5, vida: 5 }); }
      var rafaga = 1 + .5 * Math.sin(t * .5) + .25 * Math.sin(t * 1.7);          // el viento sopla a ratos
      for (a = 0; a < V.banderas.length; a++) { V.banderas[a].rotation.x = Math.sin(t * 2.6 + a * .7) * .3 * rafaga; V.banderas[a].rotation.z = Math.sin(t * 3.1 + a * .45) * .14 * rafaga; }
      V.vitor = Math.max(0, V.vitor - dt * .6);
      animarGente(V, t, .5 + (fz3 === 2 ? .35 : fz3 === 1 ? .15 : 0) + Math.min(1, V.vitor) * .5);
      vidaPlaza(V, dt, t, Math.pow(Math.abs(Math.sin(t * Math.PI * 2.2)), 6), fz3);
      for (a = 0; a < V.hojas.length; a++) V.hojas[a].rotation.x = Math.sin(t * 1.3 + a) * .06;
      var fin = vivos() <= 1 || now >= dur;
      var banco = 0, hs = [], mha, mw;
      for (a = 0; a < bombs.length; a++) { var hb = bombs[a]; if (hb.ini && !hb.done && hb.holder >= 0 && !P[hb.holder].st) hs.push(hb.holder); }
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], tx = WX(q.x), tz = WZ(q.y), estado = 'quieto';
        if (q.st) {                                                             // mojado: se queda chorreando un momento y se va a su puesto en el banco
          if (s3.salio < 0) s3.salio = t;
          var seat = ASIENTOS_BANCO[banco++ % 4];
          if (t - s3.salio > .9) { tx = seat * 1.05; tz = 10.9; }
          else { tx = s3.x; tz = s3.z; }
          estado = 'mojado';
          s3.gota -= dt; if (s3.gota < 0) { s3.gota = .25; V.part.soltar(s3.x + (c.fx() - .5) * .8, 3.1, s3.z, 1, { k: 'gota', cols: ['#8fd8ff', '#3fa9ff'], vel: .3, arriba: 0, vida: .5, esc: .8 }); }
        }
        var dx = tx - s3.x, dz = tz - s3.z, dd = Math.sqrt(dx * dx + dz * dz);
        var lim = q.st ? 9 * dt : 1e9;                                          // camino al banco a paso de caminata; en juego, la posición exacta
        if (dd > lim) { s3.x += dx / dd * lim; s3.z += dz / dd * lim; } else { s3.x = tx; s3.z = tz; }
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3), vz = (s3.z - s3.pz) / Math.max(dt, 1e-3), v = Math.sqrt(vx * vx + vz * vz);
        s3.px = s3.x; s3.pz = s3.z;
        if (v > .5) s3.rumbo = Math.atan2(vx, vz);
        var sentado = q.st && t - s3.salio > .9 && dd < .05;
        if (sentado) s3.rumbo = Math.PI;                                        // de cara a la plaza (la cámara)
        if (!q.st) estado = lleva(p) ? 'carga' : v > .8 ? 'corre' : 'quieto';
        if (!q.st && fin && now > 0) estado = 'celebra';
        var b = bombaDe(p), tiembla = !!(b && b.T - now < TIEMBLA && b.T - now > -0.1);
        var pj = s3.pj, vn = Math.min(1, v / 9);                                // personaje 3D (fiesta-3d-pj.js): pose + cara según lo que pasa
        /* a quién mira y de quién huye: el más cercano que la lleva (si yo no) o el blanco al que se le va encima (si yo sí) */
        var dH = 1e9, hH = -1, tg = -1, dTg = 1e9, mex, mez, med;
        for (mha = 0; mha < hs.length; mha++) if (hs[mha] !== p) { mex = V.pjs[hs[mha]].x - s3.x; mez = V.pjs[hs[mha]].z - s3.z; med = Math.sqrt(mex * mex + mez * mez); if (med < dH) { dH = med; hH = hs[mha]; } }
        if (b && !q.st) for (mw = 0; mw < n; mw++) {
          if (mw === p || P[mw].st || (mw === b.prev && now < b.prevT + 1.0)) continue;
          mex = V.pjs[mw].x - s3.x; mez = V.pjs[mw].z - s3.z; med = Math.sqrt(mex * mex + mez * mez); if (med < dTg) { dTg = med; tg = mw; }
        }
        var carga = !!b && !q.st, huyendo = !q.st && !carga && hH >= 0 && dH < 4.4, rea = t < s3.reaT, asust = !q.st && t < s3.susT, mirarA = -1;
        if (q.st) { pj.anim(sentado ? (rea ? 'aplaudir' : 'sentado') : v > .5 ? 'caminar' : 'mojado', { vel: Math.min(1, v / 6) }).cara(sentado ? (rea ? 'feliz' : 'triste') : 'mareado'); }
        else if (estado === 'celebra') pj.anim('celebrar').cara('feliz');
        else if (carga) {
          pj.anim('cargar', { vel: vn }).cara(tiembla || asust ? 'susto' : (tg >= 0 && dTg < 4.5) ? 'enojado' : 'concentrado');
          mirarA = tg;
          if (tg >= 0 && dTg < 3.6 && t - s3.lanT > 1.3) { s3.lanT = t; pj.uno('lanzar'); }   // anticipación: arma el brazo antes de tocarlo
        } else {
          pj.anim(rea && v < 1.5 ? 'celebrar' : v > 4 ? 'correr' : v > .8 ? 'caminar' : 'quieto', { vel: vn }).cara(asust || huyendo ? 'susto' : rea ? 'feliz' : 'normal');
          mirarA = huyendo ? hH : rea ? s3.reaA : -1;
          if (huyendo && dH < 2.6 && t - s3.esqT > 1.4) { s3.esqT = t; pj.uno('esquivar'); }   // se tira de lado cuando se le viene encima
        }
        if (mirarA >= 0 && V.pjs[mirarA] && !sentado) { pj.mirarA({ x: V.pjs[mirarA].x, y: 1.7, z: V.pjs[mirarA].z }); }
        else pj.mirar(sentado ? Math.sin(t * .9 + p * 2) * .8 : 0, 0);
        if (!q.st && estado !== 'celebra' && now >= 0) {                        // lo que le hace la plaza: chorreando en la manguera, bailando en los tambores, polvo al embestir
          if (enMang(q.x, now)) { pj.cara('mareado'); s3.gota -= dt; if (s3.gota < 0) { s3.gota = .12; V.part.soltar(s3.x + (c.fx() - .5) * .8, 3.2, s3.z, 2, { k: 'gota', cols: ['#8fd8ff', '#3fa9ff'], vel: .5, arriba: 0, vida: .45, esc: .8 }); } }
          else if (estado !== 'carga' && v < .8 && enTamb(q.x, q.y, now)) pj.anim('bailar').cara('feliz');
          if (v > 18) { V.part.soltar(s3.x, .25, s3.z, 2, { k: 'chispa', cols: ['#e8dcc0', '#fffdf2'], vel: 1.5, arriba: 1, vida: .35 }); if (!s3.dashF) { s3.dashF = 1; V3.sfx('whoosh'); } }
          else if (v < 12) s3.dashF = 0;
        }
        if (!q.st && v > 5.5) { s3.polvo -= dt; if (s3.polvo < 0) { s3.polvo = .11; V.part.soltar(s3.x, .15, s3.z, 1, { k: 'chispa', cols: ['#e8dcc0', '#fffdf2'], vel: .9, arriba: .8, g: 3, vida: .4, esc: .7 }); } }   // polvito al correr
        if (estado === 'celebra') { s3.sacT -= dt; if (s3.sacT < 0) { s3.sacT = .3; V.part.soltar(s3.x, 3.6, s3.z, 5, { k: 'confeti', cols: CONF, vel: 2.2, arriba: 4, g: 4, vida: 1.4 }); } }
        if (q.st !== s3.mojadoC) { s3.mojadoC = q.st; pj.color(q.st ? V3.oscurecer(V3.PJ.ELENCO[pj.id] ? V3.PJ.ELENCO[pj.id].camisa : '#ffd23f', .62) : null); }
        pj.rumbo(sentado ? 0 : s3.rumbo).update(dt);
        /* cuerpo vivo encima de lo que pone el kit: inclinación al correr, aplasta y estira, salto al recibir, empujón al mojarse */
        var lean = vn * .16 + (carga ? .05 : 0), ksq = 0, hy = 0, kn = 0, dsh, hu2 = (t - s3.hopT) / .42, tl = t - s3.lanT, ag3 = t - s3.golpeT;
        if (!sentado && !q.st && (huyendo || asust) && v < 1.2) lean = -.14;                    // se echa para atrás del susto
        if (asust) lean -= .2 * Math.min(1, (s3.susT - t) / .5);
        if (hu2 >= 0 && hu2 < 1) { hy = Math.sin(hu2 * Math.PI) * .75; ksq = .16 * Math.sin(hu2 * Math.PI); }
        else if (hu2 >= 1 && hu2 < 1.6) ksq = -.22 * Math.cos((hu2 - 1) / .6 * Math.PI / 2) * (1 - (hu2 - 1) / .6);     // aterriza aplastado y se recupera
        if (tl >= 0 && tl < .25) { ksq -= .1 * Math.sin(tl / .25 * Math.PI); lean -= .1 * Math.sin(tl / .25 * Math.PI); }       // se agacha antes de lanzar
        dsh = s3.dsh = (s3.dsh || 0) + ((!q.st && v > 18 ? 1 : 0) - (s3.dsh || 0)) * Math.min(1, dt * 14);
                pj.g.rotation.x = sentado ? 0 : lean;
        pj.g.rotation.z = tiembla && carga ? Math.sin(t * 60) * .07 : 0;
        pj.g.scale.set(1.35 * (1 - ksq * .5 - dsh * .1), 1.35 * (1 + ksq), 1.35 * (1 - ksq * .5 + dsh * .18));
        pj.g.position.set(s3.x + s3.kx * kn, (sentado ? .45 : 0) + hy, s3.z + (sentado ? .25 : 0) + s3.kz * kn);
        if (sentado && s3.sacT !== -1) { s3.sacT = -1; V.part.soltar(s3.x, 2.4, s3.z, 14, { k: 'gota', cols: ['#8fd8ff', '#3fa9ff'], vel: 3, arriba: 1.5, vida: .6, esc: .9 }); }   // se sacude al sentarse
        s3.aro.visible = !q.st; s3.aro.position.set(s3.x, .04, s3.z);
        s3.peligro.position.set(s3.x, .03, s3.z); s3.peligro.material.opacity = lleva(p) && !q.st ? .25 + .25 * Math.abs(Math.sin(t * (tiembla ? 18 : 8))) : 0;
      }
      eventos3D(dt, now, t);
      /* luces de fiesta en los últimos segundos (mismo total de luz, solo cambia el tono del hemisferio) */
      V.esc.luces.hemi.color.set(fz3 === 2 ? (Math.floor(t * 4.4) % 3 === 0 ? 0xffc8e6 : Math.floor(t * 4.4) % 3 === 1 ? 0xc8e0ff : 0xfff0b0) : V.hemiBase);
      /* cámara: encuadra a los que siguen secos (mínimo media plaza, máximo la plaza entera), suave */
      var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, vv = 0;
      for (p = 0; p < n; p++) if (!P[p].st) { vv++; var sp3 = V.pjs[p]; x0 = Math.min(x0, sp3.x); x1 = Math.max(x1, sp3.x); z0 = Math.min(z0, sp3.z); z1 = Math.max(z1, sp3.z); }
      var W0 = AW * ESX + 2, H0 = AH * ESZ + 3;
      if (vv) {
        var cw = Math.min(W0, Math.max(30, x1 - x0 + 11)), chh = Math.min(H0, Math.max(19, z1 - z0 + 8));   // mínimo ancho: siempre se ven las gradas y la tarima del fondo
        var cx = Math.max(-(W0 - cw) / 2, Math.min((W0 - cw) / 2, (x0 + x1) / 2)), cz = Math.max(-(H0 - chh) / 2, Math.min((H0 - chh) / 2, (z0 + z1) / 2)) - 1.2;
        var kc = Math.min(1, dt * 1.8); V.cam.x += (cx - V.cam.x) * kc; V.cam.z += (cz - V.cam.z) * kc; V.cam.w += (cw - V.cam.w) * kc; V.cam.h += (chh - V.cam.h) * kc;
        V.esc.encuadrar(V.cam.w, V.cam.h, new T.Vector3(V.cam.x, .8, V.cam.z), .74);
      }
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !P[c.yo].st;
      if (yo) V.flecha.position.set(yo.x, (lleva(c.yo) ? 6 : 4.4) + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      /* bombitas: sobre la cabeza del que la lleva; al pasarse vuelan en arco; el último segundo tiemblan y se ponen rojas */
      for (a = 0; a < bombs.length; a++) {
        var bo = bombs[a], gl = V.globos[a], on = bo.ini && !bo.done && bo.holder >= 0 && !P[bo.holder].st;
        gl.g.visible = !!on; if (!on) { gl.quien = -1; continue; }
        var h = V.pjs[bo.holder], k2 = 0, z;
        for (z = 0; z < a; z++) if (bombs[z].holder === bo.holder && bombs[z].ini && !bombs[z].done) k2++;
        var destino = new T.Vector3(h.x + k2 * .7, 4.55 + k2 * .6, h.z);
        if (gl.quien !== bo.holder) { gl.de = gl.quien >= 0 ? gl.g.position.clone() : destino.clone(); gl.vuelo = 0; gl.quien = bo.holder; if (gl.de.distanceTo(destino) > .5) V3.sfx('whoosh'); }
        gl.vuelo = Math.min(1, gl.vuelo + dt / .28);
        var u = gl.vuelo, e = u * u * (3 - 2 * u);
        gl.g.position.lerpVectors(gl.de, destino, e); gl.g.position.y += Math.sin(u * Math.PI) * 1.6;
        var rest = bo.T - now, tem = rest < TIEMBLA && rest > -0.1;
        gl.g.position.x += tem ? Math.sin(t * 70) * .08 : 0;
        gl.g.position.y += Math.sin(t * 6 + a) * .08;
        var pul = tem ? 1 + .14 * Math.abs(Math.sin(t * 30)) : 1 + .03 * Math.sin(t * 5);
        gl.g.scale.set(pul, pul * (1 + .05 * Math.sin(t * 9)), pul);
        gl.g.rotation.z = Math.sin(t * 3 + a) * .15;
        gl.mat.color.set(tem && Math.floor(t * 14) % 2 ? '#ff5c6a' : '#3fa9ff');
        if (tem && t - gl.latio > .25) { gl.latio = t; V3.sfx('latido'); }
      }
      /* ondas y charcos */
      for (a = V.ondas.length - 1; a >= 0; a--) { var o = V.ondas[a], ag = t - o.t; if (ag > .7) { V.esc.scene.remove(o.m); V.ondas.splice(a, 1); continue; } o.m.scale.setScalar(1 + ag * 7); o.m.material.opacity = .8 * (1 - ag / .7); }
      for (a = V.charcos.length - 1; a >= 0; a--) { var ch = V.charcos[a], ag2 = t - ch.t; if (ag2 > 6) { V.esc.scene.remove(ch.m); V.charcos.splice(a, 1); continue; } var cr = Math.min(1, ag2 * 4); ch.m.scale.setScalar(.3 + cr * .7); ch.m.material.opacity = .6 * Math.min(1, (6 - ag2) / 2); }
    }
    function eventos3D(dt, now, t) {
      var V = v3, e, pul, vivo = vivos() > 1;
      /* comparsa: franja rosada que late en el aviso; la carroza cruza con su cabezón y sus bailarines */
      e = vivo ? evDe('comparsa', now, 0, 0) : null;
      V.franja.visible = !!e; V.carroza.visible = !!(e && now >= e.t1 - 0.4);
      if (e) {
        pul = now < e.t1 ? .18 + .22 * Math.abs(Math.sin(t * 14)) : .16;
        V.franja.material.opacity = pul; V.franja.position.set(0, .035, WZ(e.y));
        var cx = now < e.t1 ? (e.dir > 0 ? -80 : AW + 80) : comparsaX(e, now);
        V.carroza.position.set(WX(cx), 0, WZ(e.y));
        V.cabezon.rotation.z = Math.sin(t * 5) * .18; V.cabezon.position.y = 2.5 + Math.abs(Math.sin(t * 6)) * .2;
        V.bailarines.forEach(function (b3) { b3.anim('bailar').cara('feliz').update(dt); });
        if (now >= e.t1 && c.fx() < .3) V.part.soltar(WX(cx), 3.2, WZ(e.y), 2, { k: 'confeti', cols: CONF, vel: 2.5, arriba: 3, g: 4, vida: 1 });
      }
      /* manguera: columna azul (late en el aviso), el chamo apunta y el chorro cae a lo largo */
      e = vivo ? evDe('manguera', now, 0, 0.4) : null;
      V.columna.visible = !!(e && now < e.t2); V.mangero.g.visible = !!e; V.manguera.visible = !!(e && now >= e.t1 && now < e.t2);
      if (e) {
        var mx = WX(e.x), mz = WZ(0) - 2.2;
        V.columna.material.opacity = now < e.t1 ? .15 + .2 * Math.abs(Math.sin(t * 14)) : .22; V.columna.position.set(mx, .035, 0);
        V.mangero.g.position.set(mx - .6, 0, mz); V.mangero.anim(now < e.t1 ? 'saludar' : 'empujar').cara(now < e.t1 ? 'feliz' : 'concentrado').rumbo(0).update(dt);
        V.manguera.position.set(mx - .2, 1.6, mz + .8);
        if (now >= e.t1 && now < e.t2) { V.aguaT -= dt; if (V.aguaT < 0) { V.aguaT = .03; V.part.soltar(mx + (c.fx() - .5) * MANG * 2 * ESX * .8, 2.2 + c.fx() * 1.5, (c.fx() - .5) * AH * ESZ, 3, { k: 'gota', cols: ['#8fd8ff', '#3fa9ff', '#fffdf2'], vel: .8, arriba: 0, vida: .5, esc: 1 }); } }
      }
      /* tambores: círculo amarillo que late con el golpe; los cueros saltan y la abuela toca */
      e = vivo ? evDe('tambores', now, 0, 0.3) : null;
      V.discoT.visible = V.aroT.visible = !!(e && now < e.t2); V.tambores.visible = !!e;
      if (e) {
        var tx2 = WX(e.x), tz2 = WZ(e.y), golpe = Math.pow(Math.abs(Math.sin(t * Math.PI * 2.2)), 6);
        V.discoT.position.set(tx2, .033, tz2); V.aroT.position.set(tx2, .036, tz2);
        V.discoT.material.opacity = now < e.t1 ? .1 + .2 * Math.abs(Math.sin(t * 14)) : .14 + .14 * golpe; V.aroT.material.opacity = .5 + .4 * golpe;
        V.tambores.position.set(tx2, 0, tz2);
        V.cueros.forEach(function (cu, i) { cu.scale.y = 1 + .12 * Math.pow(Math.abs(Math.sin(t * Math.PI * 2.2 + i)), 6); });
        V.tamborero.anim(now < e.t1 ? 'quieto' : 'bailar').cara('feliz').update(dt);
      }
    }
    function estallido3D(p) {
      if (!v3) return;
      var T = THREE, s3 = v3.pjs[p], x = s3.x, z = s3.z, y = 4.55;
      v3.part.soltar(x, y, z, 70, { k: 'gota', cols: ['#3fa9ff', '#8fd8ff', '#fffdf2', '#1f7fe0'], vel: 7, arriba: 6, vida: 1.1, esc: 1.3 });
      v3.part.soltar(x, y, z, 14, { k: 'chispa', cols: ['#fffdf2', '#ff5c8a', '#ffd23f'], vel: 5, arriba: 4, vida: .6 });
      var onda = new T.Mesh(new T.RingGeometry(.6, .9, 24), new T.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }));
      onda.rotation.x = -Math.PI / 2; onda.position.set(x, .06, z); v3.esc.scene.add(onda); v3.ondas.push({ m: onda, t: absT });
      var ch = new T.Mesh(new T.CircleGeometry(1.8, 18), new T.MeshBasicMaterial({ color: 0x3f8fd8, transparent: true, opacity: .6, depthWrite: false }));
      ch.rotation.x = -Math.PI / 2; ch.position.set(x, .025, z); ch.scale.set(1, 1.3, 1); v3.esc.scene.add(ch); v3.charcos.push({ m: ch, t: absT });
      v3.esc.sacudir(1); V3.sfx('splash');
      var ka = c.fx() * 6.28, qq; s3.golpeT = absT; s3.kx = Math.cos(ka); s3.kz = Math.sin(ka); s3.pj.volar(s3.kx, s3.kz, 2, { alcance: .5 }); s3.sacT = 0; v3.vitor = 1.2;     // empujón del chorro; el público se vuelve loco
      for (qq = 0; qq < n; qq++) {
        if (qq === p) continue;
        var o3 = v3.pjs[qq];
        if (!P[qq].st && lleva(qq) > 0) o3.susT = absT + .9;                       // el que la lleva se asusta
        else if (c.fx() < .75) { o3.reaT = absT + 1.7; o3.reaA = p; if (!P[qq].st && c.fx() < .6) o3.pj.uno('festejo'); }   // los demás celebran y miran al mojado
      }
      V3.sfx('aplauso');
    }
    function pase3D(de, to) {
      if (!v3) return; var s3 = v3.pjs[to];
      if (de >= 0 && v3.pjs[de]) { var sd = v3.pjs[de]; if (absT - sd.lanT > .6) sd.pj.uno('lanzar'); sd.lanT = absT; sd.reaT = absT + .9; sd.reaA = to; }   // si ya armó el brazo, no repite
      s3.hopT = absT; s3.susT = absT + .8; v3.vitor = Math.max(v3.vitor, .4); s3.pj.uno('saltar'); v3.part.soltar(s3.x, 4.6, s3.z, 10, { k: 'confeti', cols: CONF, vel: 3, arriba: 3, g: 6, vida: .9 }); V3.sfx('pop'); }
    /* dónde poner un texto 2D sobre un jugador: proyectado desde el 3D, o la cuenta de siempre en 2D */
    function sobre(p, alto) {
      if (v3) { var s3 = v3.pjs[p]; return v3.esc.proyectar(s3.x, alto, s3.z); }
      var G = geom(); return { x: G.ox + P[p].x, y: G.oy + P[p].y - alto * 40 };
    }
    /* los textos de encima (2D y 3D): cartel del momento, la regla siempre a la vista y si el embiste está listo */
    function textos(f, now) {
      var cx = (f.x0 + f.x1) / 2, vivo = now >= 0 && vivos() > 1 && now < dur;
      if (banT > 0 && !c.practica) txt('¡EN CARNAVAL TODO SE VALE!', cx, 126, 21 + Math.sin(absT * 12), '#ff5c8a', 0, true);
      else if (ban && absT - ban.t < ban.d && vivo) {
        var ag = absT - ban.t, kb = ag < 0.15 ? 0.6 + ag / 0.15 * 0.4 : 1;
        txt(ban.s, cx, 126, Math.round((22 + Math.sin(absT * 14) * 1.2) * kb), ban.col, 0, true);
        if (ban.sub) txt(ban.sub, cx, 148, 13, '#fffdf2', 0, true);
      }
      else if (vivo && faseJ(now) === 2) txt('¡ÚLTIMOS SEGUNDOS!', cx, 126, Math.round(16 + Math.abs(Math.sin(absT * 8)) * 3), '#ff3b4e', 0, true);
      else if (now >= 0 && now < 5 && !c.practica && c.yo >= 0 && lleva(c.yo) > 0) txt('¡PÁSASELA A ALGUIEN TOCÁNDOLO!', cx, 126, 17, '#fffdf2', 0, true);
      if (vivo) {
        var yo = c.yo >= 0 && !P[c.yo].st ? P[c.yo] : null, listo = !!(yo && now >= yo.dashCd);
        txt('Tócalo para pasarle la bombita · ' + (yo ? (listo ? 'A: ¡EMBISTE!' : 'embiste recargando…') : 'A: embiste'), cx, 104, 12, listo ? '#ffd23f' : '#fffdf2', 0, true);
      }
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p; v3T = absT;   // reloj cosmético del juego (absT avanza en update)
      if (dt > 0) actualizar3D(dt, now);                                         // sin update entre dos cuadros no hay nada que mover (y la velocidad saldría 0)
      if (now >= 0 && !(vivos() <= 1)) V3.musica(now < dur && faseJ(now) === 2 && V3.pista ? 'bombita-fin' : 'carnaval');   // en los últimos segundos, la misma a toda mecha
      v3.esc.render(dt);
      for (p = 0; p < n; p++) {
        if (P[p].st) continue;
        var s3 = v3.pjs[p], pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.1);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        var k2 = lleva(p); if (k2 > 1) { var pb = v3.esc.proyectar(s3.x + .9, 5.5, s3.z); txt('x' + k2, pb.x, pb.y, 13, '#fffdf2', 0, true); }
      }
      textos(f, now);
      if (typeof drawP === 'function') drawP();                                 // los gritos (say) viven en las partículas del motor
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, a;
        absT += dt; banT = Math.max(0, banT - dt); shake = Math.max(0, shake - dt * 3);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        if (now >= 0) {
          resolver(now);
          for (p = 0; p < n; p++) if (c.mio(p) && !P[p].st) pasar(p, now);
          iniciar(now);
        }
        /* escalada y eventos: carteles, sonido y sacudón (cosmético; el calendario ya es igual en todos) */
        var fz = now >= 0 && vivos() > 1 && now < dur ? faseJ(now) : -1;
        if (fz > faseV) {
          if (fz === 1) { cartel('¡SE CALIENTA LA PLAZA!', 'todo va más rápido y el embiste recarga antes', '#ff8a3f', 1.7); SFX('silbato'); shake = Math.max(shake, 0.4); if (v3) v3.esc.sacudir(0.5); }
          else if (fz === 2) { cartel('¡ÚLTIMOS SEGUNDOS!', fase(now) === 2 ? 'mechas cortas · ¡bombitas dobles!' : '¡quedan dos! todo a toda mecha', '#ff3b4e', 2.2); SFX('tambor'); SFX('silbato'); shake = Math.max(shake, 0.8); if (v3) v3.esc.sacudir(1.1); }
          faseV = fz;
        }
        for (a = 0; a < EVS.length; a++) {
          var ev = EVS[a];
          if (!ev.avis && now >= ev.t0 && now < ev.t1) { ev.avis = 1; if (vivos() > 1) { cartel(EVTXT[ev.k][0], EVTXT[ev.k][1], EVTXT[ev.k][2], 1.5); SFX(ev.k === 'comparsa' ? 'silbato' : ev.k === 'manguera' ? 'viento' : 'tambor'); if (!v3) SND(880, 0.12, 'square', 0.04); } }
          if (!ev.onF && now >= ev.t1 && now < ev.t2) { ev.onF = 1; if (vivos() > 1) { SFX(ev.k === 'comparsa' ? 'bocina' : ev.k === 'manguera' ? 'splash' : 'tambor'); if (v3) v3.esc.sacudir(0.35); } }
        }
        /* aviso: la que tiembla (cosmético) */
        for (a = 0; a < bombs.length; a++) { var b = bombs[a]; if (b.ini && !b.done && b.T - now < TIEMBLA && b.T - now > TIEMBLA - dt * 1.5) SND(520, 0.2, 'square', 0.04, 80); }
        while (splashes.length && now - splashes[0].t > 0.8) splashes.shift();
        while (pops.length && now - pops[0].t > 0.8) pops.shift();
      },
      ai: function (p, dt, api) { ai(p, dt, api, c.ahora()); },
      cuerpo: function (p) { var q = P[p]; return { x: Math.round(q.x), y: Math.round(q.y), st: q.st, sc: q.sc }; },
      onEv: function (ty, p, d, t) {
        var now = c.ahora(), q = P[p], G = geom(), b, a;
        if (ty === 'ini' && d) {
          b = bombs[d.i]; if (!b || b.ini) return;
          b.ini = 1; b.plan = d.to;
          if (d.to >= 0 && !P[d.to].st) { b.holder = d.to; b.imm = Math.max(now, b.S) + IMM; if (d.to === c.yo) { var pt0 = sobre(d.to, 5.8); S('¡LA TIENES!', pt0.x, pt0.y, '#ff5c8a'); SND(660, 0.12, 'triangle', 0.05); } }
          else b.done = 1;
        } else if (ty === 'pasa' && d) {
          b = bombs[d.i]; if (!b || b.done || !b.ini) return;
          var tp = d.t / 1000;
          if (tp >= b.T || d.to < 0 || d.to >= n || P[d.to].st) return;
          if (b.holder !== p && b.holder >= 0) return;
          b.prev = b.holder; b.prevT = tp; b.holder = d.to; b.imm = tp + IMM;
          if (q) q.passAt = now;
          var pt1 = sobre(d.to, 5.8); S(d.to === c.yo ? '¡LA TIENES!' : '¡TOMA!', pt1.x, pt1.y, d.to === c.yo ? '#ff5c8a' : '#ffd23f');
          if (v3) pase3D(p, d.to); else { SPAWN(G.ox + P[d.to].x, G.oy + P[d.to].y - 60, 8, 'conf', ['#3fa9ff', '#fffdf2'], 220, 400, 0.5); SND(440, 0.1, 'triangle', 0.05); }
        } else if (ty === 'out' && q) {
          var kk = d && d.kk != null ? d.kk : Math.floor(now * 30);
          for (a = 0; a < bombs.length; a++) {
            b = bombs[a];
            if (b.holder === p && !b.done) { b.done = 1; if (Math.abs(b.T * 30 - kk) <= 1.5) { b.fxT = now; splashes.push({ x: q.x, y: q.y, t: now }); } }
          }
          if (!q.st) { shake = 0.6; var pt2 = sobre(p, 5.8); S('¡MOJADO!', pt2.x, pt2.y, '#3fa9ff');
            if (v3) estallido3D(p); else { SPAWN(G.ox + q.x, G.oy + q.y - 50, 18, 'conf', ['#3fa9ff', '#8fd8ff', '#fffdf2'], 330, 500, 0.8); SND(150, 0.3, 'sawtooth', 0.08, -90); } }
          elim(p, kk);
        }
      },
      claimOk: function () { return false; },
      concede: function () {},
      alCpu: function (p) { P[p].own = false; var r = c.remoto(p); if (r && !P[p].st) { P[p].x = r.x; P[p].y = r.y; } },
      alHum: function (p, o) { P[p].own = false; if (o) { if (o.st && !P[p].st) elim(p, o.sc); else if (!o.st) { P[p].x = o.x; P[p].y = o.y; } } },
      alRemoto: function (p, o) { if (o && o.st && !P[p].st) elim(p, o.sc); },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) out.push(P[p].st ? P[p].sc : dur * 30 + 1);
        return out;
      },
      done: function () { return vivos() <= 1; },
      vivo: function (p) { return !P[p].st; },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0];
        if (!q) return '';
        return q.st ? 'se mojó a los ' + Math.max(0, Math.floor(q.sc / 30)) + ' s' : '¡seco como la arepa!';
      },
      vista: function () {
        return { gt: c.ahora(), lv: lv, lead: lead, hash: hash, nBombs: bombs.length, rondas: ronda,
          bombs: bombs.map(function (b) { return { i: b.i, r: b.r, S: +b.S.toFixed(3), T: +b.T.toFixed(3), sel: b.sel, holder: b.holder, done: b.done, ini: b.ini }; }),
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), st: P.map(function (q) { return q.st; }), sc: P.map(function (q) { return q.sc; }),
          vivos: vivos(), TOCA: TOCA, IMM: IMM, fase: c.ahora() >= 0 ? faseJ(c.ahora()) : -1, F1: F1, F2: F2,
          evs: EVS.map(function (e) { return { k: e.k, t0: +e.t0.toFixed(3), t1: +e.t1.toFixed(3), t2: +e.t2.toFixed(3), x: e.x, y: e.y, dir: e.dir }; }),
          dash: P.map(function (q) { return { t: q.dashT, cd: q.dashCd }; }) };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        var f = cp(), G = geom(), now = c.ahora(), p, a, ox = G.ox, oy = G.oy;
        var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
        ctx.save(); ctx.translate(sxk, syk);
        fondo(f, G);
        eventos2D(G, now);
        /* charcos de las bombitas estalladas */
        for (a = 0; a < splashes.length; a++) {
          var sp = splashes[a], ag = now - sp.t, rd = 24 + ag * 120;
          if (ag < 0 || ag > 0.8) continue;
          ctx.save(); ctx.globalAlpha = 1 - ag / 0.8; ell(ox + sp.x, oy + sp.y + 6, rd, rd * 0.5, '#8fd8ff', 3); ell(ox + sp.x, oy + sp.y + 6, rd * 0.6, rd * 0.3, '#3fa9ff', 0); ctx.restore();
        }
        var ord = [];
        for (p = 0; p < n; p++) if (!P[p].st) ord.push(p);
        ord.sort(function (a2, b2) { return P[a2].y - P[b2].y; });
        for (a = 0; a < ord.length; a++) {
          p = ord[a]; var q = P[p];
          persona(p, ox + q.x, oy + q.y, now);
          txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 15, 11, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        }
        /* mojados: en la acera, con el pelo hecho sopa */
        var tn = 0;
        for (p = 0; p < n; p++) if (P[p].st) {
          var tq = P[p], tx = f.x0 + 46 + tn * 70, ty = oy + AH + 38; tn++;
          c.util.pj(asiento(p).ch, tx, ty, 46, { animo: 'perder', sombra: false });
          ell(tx - 12, ty - 40 + (absT * 40 + tn * 9) % 18, 2, 3, '#3fa9ff', 0); ell(tx + 14, ty - 36 + (absT * 33 + tn * 5) % 16, 2, 3, '#3fa9ff', 0);
          txt('MOJADO', tx, ty + 30, 10, '#8fd8ff', 0, true);
        }
        ctx.restore();
        textos(f, now);
        if (typeof drawP === 'function') drawP();
      }
    };
    return g;
  }
});
})();
