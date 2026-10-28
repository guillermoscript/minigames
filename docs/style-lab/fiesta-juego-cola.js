'use strict';
/* LA FIESTA · ¡LA COLA DE LA GASOLINA! (f_cola) · modelo A (cancha propia) · FFA rank · 1 botón
   Luz roja / luz verde en la cola de la bomba: cada TOQUE de A adelanta tu carrito un paso, pero SOLO mientras el fiscal está de espaldas.
   Si se voltea (luz roja) y tocas: «¡COLEADO!» (3 pasos atrás y 0,6 s congelado). Gana el primero que llena el tanque (llega al 100 %).
   El horario del fiscal es función PURA de (semilla, gt): `evs` sale de c.rng en mk, así que las n pantallas ven al mismo fiscal a la
   misma hora. Cada dueño juzga SU carrito (gt local de su toque contra el calendario) y lo difunde por `o` = [x·100, congelado, tl]
   (tl = tick de llegada, 0 si no ha llegado; es el desempate y decide el +25). Los rivales se ven EN VIVO por ese cuerpo.
   Reglas (doc 08 §9 ficha 1):
     - Puntaje = % del recorrido (0..100) + 25 al primero que llega (menor tl; empate de tick: menor asiento). Enteros, scoreMax 125.
     - Niveles: Nv1 el fiscal avisa 0,6 s antes (semáforo amarillo). Nv2 igual + giros FALSOS (se asoma y se arrepiente).
       Nv3 giros DOBLES (se voltea, mira de nuevo a los 0,5 s) y aviso de solo 0,35 s.
     - done() = alguien llegó hace ≥0,3 s (margen para que el cuerpo de otro que llegó en el mismo instante alcance al juez).
     - CPU (el juez la corre): toques a 3+5·skill por seg., se congela al ver el aviso tras 450-250 ms; a veces se distrae y se cuela.
   Se carga DESPUÉS de fiesta-live.js. Dibuja SOLO con las primitivas del laboratorio. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_cola')) return;

var STEP_N = { 1: 50, 2: 56, 3: 62 };           // toques para llenar el tanque por nivel (100 / n por toque)
var AVISO = { 1: 0.6, 2: 0.6, 3: 0.35 }, FREEZE = 0.6, GRACIA = 0.06, ATRAS = 3, INKC = '#14101c';
var TEAM = ['#ffd23f', '#3fb0ff', '#ff5c8a', '#5cff7a'];
var FRASES = ['¿Y su terminal de placa, ciudadano?', '¡Aquí nadie se cuela, mi amor!', 'Yo vi eso, yo vi eso...', '¿Ese carro es de cartón o qué?', 'Cédula y papeles del carro, pues.'];
var PAL = {
  1: { sky: '#8fd8ff', sky2: '#d8f4ff', techo: '#e8553d', asf: '#4d4a6e', asf2: '#5a577c', raya: '#f5f0dc', acera: '#d8d2c4', luz: '#fff8d8' },
  2: { sky: '#ff8f5a', sky2: '#ffd08a', techo: '#b8452f', asf: '#4a3a5a', asf2: '#574668', raya: '#f0d8b0', acera: '#c8b4a0', luz: '#ffe39a' },
  3: { sky: '#1d1a4a', sky2: '#3a3478', techo: '#7a2a3a', asf: '#2a2840', asf2: '#34324e', raya: '#b8b4d0', acera: '#6a6684', luz: '#ffe27a' }
};

function cl01(u) { return u < 0 ? 0 : u > 1 ? 1 : u; }

FIESTA.LIVE.add('f_cola', {
  name: '¡LA COLA DE LA GASOLINA!', modos: ['ffa'], clase: 'rank', modelo: 'A', dur: 20,
  stick: false, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 125, scoreRate: 30, minT: 4, finTemprano: 1 },
  cuerpo: ['x', 'fz', 'tl', 'sb'], discretos: ['fz', 'tl', 'sb'],
  carta: {
    obj: 'Toca A para avanzar, pero NO cuando el fiscal te mire',
    gana: 'El primero que llena el tanque (+25). Si nadie llega, gana el que va más lejos.',
    como: { tactil: 'A = avanzar un paso (toca rápido)', teclado: 'ESPACIO o J (machácalo)' },
    demos: [{ id: 'quieto', txt: 'Luz amarilla: ¡ya se va a voltear! Suelta el botón hasta que se vire de nuevo' }],
    roles: null
  },
  mk: function (c) {
    var n = c.n, dur = c.dur, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, pal = PAL[lv], rng = c.rng, STEP = 100 / STEP_N[lv], AV = AVISO[lv], i;

    /* ───── el fiscal: lista de giros, idéntica en todos (solo c.rng, solo aquí) ───── */
    var evs = [], t = Math.min(2.2, 0.15 * dur) + rng.next() * 0.6;
    function nuevo(a, fake) {
      var rd = (lv === 1 ? 1.0 : lv === 2 ? 0.9 : 0.8) + rng.next() * 0.5;
      var e = { a: a, r0: a + AV, r1: 0, fake: fake, dbl2: false };
      e.r1 = e.r0 + rd;
      evs.push(e);
      return e;
    }
    while (t <= dur + 1.5) {
      var fake = lv >= 2 && rng.next() < (lv === 3 ? 0.25 : 0.3);
      var e1 = nuevo(t, fake), fin = fake ? e1.r0 + 0.3 : e1.r1;
      if (lv === 3 && !fake && rng.next() < 0.4) {      // giro doble: mira, se voltea 0,5 s y vuelve a mirar
        var e2 = { a: e1.r1 + 0.15, r0: e1.r1 + 0.5, r1: 0, fake: false, dbl2: true };
        e2.r1 = e2.r0 + 0.7 + rng.next() * 0.4; evs.push(e2); fin = e2.r1;
      }
      t = fin + (lv === 1 ? 1.7 + rng.next() * 1.3 : lv === 2 ? 1.4 + rng.next() * 1.4 : 1.2 + rng.next() * 1.2);
    }
    var estrellas = [];
    for (i = 0; i < 24; i++) estrellas.push([rng.next(), rng.next() * 0.5, 1 + rng.next() * 1.6]);
    var frases = [];
    for (i = 0; i < evs.length; i++) frases.push(rng.int(0, FRASES.length - 1));

    /* estado del fiscal en gt: {s:'verde'|'aviso'|'rojo'|'falso', i: índice del giro, u: avance 0..1 dentro del estado} */
    function fiscal(gt) {
      for (var k = 0; k < evs.length; k++) {
        var e = evs[k];
        if (gt < e.a) break;
        if (gt < e.r0) return { s: 'aviso', i: k, u: (gt - e.a) / (e.r0 - e.a) };
        if (e.fake) { if (gt < e.r0 + 0.3) return { s: 'falso', i: k, u: (gt - e.r0) / 0.3 }; }
        else if (gt < e.r1) return { s: 'rojo', i: k, u: (gt - e.r0) / (e.r1 - e.r0) };
      }
      return { s: 'verde', i: -1, u: 0 };
    }
    function rojo(gt) { for (var k = 0; k < evs.length; k++) if (!evs[k].fake && gt >= evs[k].r0 + GRACIA && gt < evs[k].r1) return true; return false; }

    /* ───── el caos (todo sale de c.rng en mk: las n pantallas ven los mismos peatones y las mismas cajas) ─────
       Peatones: cruzan TODOS los carriles por un paso de cebra (aviso desde 3 s antes); al que lo pille en la cebra lo frenan (fk 4).
       Cajas sorpresa: iguales en todos los carriles; al pasarlas salen BIDÓN (+5 pasos) o un sabotaje que cae sobre el rival más cercano por delante
       (CLAVOS, ACEITE, COLAO) o sobre el primero (DENUNCIA: el fiscal lo devuelve). El golpe lo APLICA el dueño del golpeado: el lanzador difunde
       `sb` = secuencia·64 + tipo·8 + objetivo en su cuerpo, y `fz` ahora lleva el motivo (1 coleado · 2 clavos · 3 colao · 4 peatón · 5 denuncia · 6 aceite). */
    var PW = 0.8, NPEDS = lv === 1 ? 2 : lv === 2 ? 2 : 3, NBOX = lv === 1 ? 3 : lv === 2 ? 3 : 4;
    var FKT = [0, 2, 6, 3, 5], DURFZ = { 2: 1.1, 3: 0.9, 4: 0.9, 5: 0.7 }, PASOS = { 2: 1, 3: 2, 4: 0, 5: 4 };
    var peds = [], cajas = [], vis = [], visId = 0;
    for (i = 0; i < NPEDS; i++) {
      var tf = (i + 0.15 + rng.next() * 0.7) / NPEDS;
      peds.push({ t0: 3.4 + (dur - 7) * Math.pow(tf, 0.85), x: 22 + rng.next() * 58, dir: rng.next() < 0.5 ? 1 : -1, ch: rng.int(0, 5), h: [] });
    }
    for (i = 0; i < NBOX; i++) {
      var xb = 9 + (i + 0.15 + rng.next() * 0.7) * (80 / NBOX), rk = rng.next();
      cajas.push({ x: xb, k: i === 0 || rk < 0.2 ? 0 : rk < 0.44 ? 1 : rk < 0.64 ? 2 : rk < 0.8 ? 3 : 4 });
    }
    function pedT(pd, p) { return pd.t0 + (pd.dir > 0 ? p : n - 1 - p) * PW; }

    /* ───── estado por jugador ───── */
    var P = [], cpuR = [], cs = [], seenAt = -1;
    for (i = 0; i < n; i++) {
      P.push({ x: 0, dx: 0, fz: 0, fk: 0, fzU: -9, slipU: -9, inmU: -9, tl: 0, own: false, cn: 0, hits: 0, cajas: 0, mx: 0, sb: 0, sbSeq: 0, pickT: -9, pickK: -1, colAt: -9, llegoAt: -9, bounce: 0, pfz: 0 });
      cpuR.push(c.rngFor('cpu' + i));
      cs.push({ nextT: 0, win: {}, pm: {} });
    }
    function SND(f, d, ty, v) { try { if (typeof snd === 'function') snd(f, d, ty, v); } catch (e) { /* sin audio */ } }
    function mio(p) { return c.mio(p); }
    function primero() {                          // asiento que llenó el tanque antes (menor tl; empate de tick: menor asiento)
      var b = -1, p;
      for (p = 0; p < n; p++) if (P[p].tl > 0 && (b < 0 || P[p].tl < P[b].tl)) b = p;
      return b;
    }
    /* un golpe sobre v (solo lo llama el dueño de v). Inmune un rato después: no se encadenan. */
    function golpear(v, fk, gt) {
      var q = P[v];
      if (q.tl > 0 || gt < 0 || gt < q.inmU) return false;
      if (fk === 6) { q.slipU = gt + 3.2; q.inmU = gt + 4.2; q.fk = 6; }
      else { q.x = Math.max(0, q.x - PASOS[fk] * STEP); q.fzU = Math.max(q.fzU, gt + DURFZ[fk]); q.fz = 1; q.fk = fk; q.inmU = gt + DURFZ[fk] + 1.3; q.colAt = gt; }
      q.hits++;
      return true;
    }
    function objetivo(p, kd, j) {                 // a quién le cae: clavos/aceite/colao al más cercano por delante (si voy primero, al de detrás); denuncia al primero. Empates: rotan según la caja
      var q = P[p], best = -1, bd = 1e9, r, d, o;
      for (o = 1; o < n; o++) {
        r = (p + o + j) % n; if (r === p) continue;
        if (kd === 4) { if (!P[r].tl && P[r].x > q.x + 0.5 && (best < 0 || P[r].x > P[best].x)) best = r; }
        else if (!P[r].tl && !P[r].fz) { d = P[r].x - q.x; if (d >= 0 && d < bd) { bd = d; best = r; } }
      }
      if (best < 0 && kd !== 4) for (o = 1; o < n; o++) { r = (p + o + j) % n; if (r !== p && !P[r].tl && !P[r].fz) { d = q.x - P[r].x; if (d > 0 && d < bd) { bd = d; best = r; } } }
      return best;
    }
    function lanzar(p, kd, t, gt) {
      var q = P[p];
      q.sbSeq++; q.sb = q.sbSeq * 64 + kd * 8 + t;
      vis.push({ id: ++visId, from: p, to: t, k: kd, t0: gt }); if (vis.length > 14) vis.shift();
      if (mio(t)) golpear(t, FKT[kd], gt);
    }
    function recoger(p, j, gt) {
      var q = P[p], kd = cajas[j].k, t = -1;
      q.pickT = gt; q.cajas++;
      if (kd !== 0 && q.tl === 0) { t = objetivo(p, kd, j); if (t < 0) kd = 0; }
      if (kd === 0 || q.tl > 0) { q.pickK = 0; if (q.tl === 0) avanzar(p, 5 * STEP, gt); return; }
      q.pickK = kd; lanzar(p, kd, t, gt);
    }
    function avanzar(p, amt, gt) {                // mueve el carro, cobra las cajas que cruzó y detecta la llegada
      var q = P[p], old = q.mx, j, got = [];
      q.x = Math.min(100, q.x + amt);
      if (q.x > q.mx) { q.mx = q.x; for (j = 0; j < cajas.length; j++) if (cajas[j].x > old && cajas[j].x <= q.x) got.push(j); }
      if (q.x >= 100 && !q.tl) { q.x = 100; q.tl = Math.max(1, Math.floor(gt * 30)); q.llegoAt = gt; if (p === c.yo && !v3) SND(660, 0.3, 'square', 0.06); }
      for (j = 0; j < got.length; j++) recoger(p, got[j], gt);
    }
    function recibeSb(p, sb) {                    // sabotaje que difundió el dueño de p: se anota (visual) y, si el golpeado es mío, lo aplico
      var q = P[p], seq = Math.floor(sb / 64), kd = (sb >> 3) & 7, t = sb & 7;
      if (seq <= q.sbSeq) return;
      q.sbSeq = seq; q.sb = sb;
      if (kd < 1 || kd > 4 || t >= n || t === p) return;
      vis.push({ id: ++visId, from: p, to: t, k: kd, t0: c.ahora() }); if (vis.length > 14) vis.shift();
      if (mio(t)) golpear(t, FKT[kd], c.ahora());
    }
    function suave(q, dt) {
      q.dx += (q.x - q.dx) * Math.min(1, dt * (q.x < q.dx ? 7 : 22));
      if (Math.abs(q.x - q.dx) < 0.05) q.dx = q.x;
    }

    function updJugador(p, gt, dt) {
      var q = P[p], k;
      if (!mio(p)) {                              // remoto: lo que manda su dueño (o el juez si es CPU). x/tl/fz/sb crudos llegan por alRemoto.
        q.own = false;
        var r = c.remoto(p);
        if (r) q.dx = (r.x || 0) / 100;
        else q.dx = q.x;
        if (q.fz && !q.pfz) q.colAt = gt;
        q.pfz = q.fz;
        return;
      }
      if (!q.own) { q.own = true; q.dx = q.x; }   // empiezo o heredo (el juez que toma una CPU, o el humano que vuelve)
      var taps = c.tap(p, 'a');
      if (gt < 0 || q.tl > 0) { q.fz = gt < q.fzU ? 1 : 0; suave(q, dt); return; }
      for (k = 0; k < peds.length; k++) {         // ¿me pilla un peatón en la cebra?
        var pd = peds[k];
        if (!pd.h[p] && Math.abs(gt - pedT(pd, p)) < 0.3 && Math.abs(q.x - pd.x) < 7) { pd.h[p] = 1; golpear(p, 4, gt); }
      }
      q.fz = gt < q.fzU ? 1 : 0;
      if (!q.fz) q.fk = gt < q.slipU ? 6 : 0;
      if (taps > 0 && !q.fz) {
        if (rojo(gt)) {                           // ¡COLEADO!: el fiscal te vio
          q.x = Math.max(0, q.x - ATRAS * STEP); q.fzU = gt + FREEZE; q.fz = 1; q.fk = 1; q.cn++; q.colAt = gt;
          if (p === c.yo && !v3) SND(180, 0.25, 'square', 0.07);
        } else {
          avanzar(p, Math.min(taps, 3) * STEP * (gt < q.slipU ? 0.45 : 1), gt); q.bounce = 1;
        }
      }
      suave(q, dt);
      if (q.bounce > 0) q.bounce = Math.max(0, q.bounce - dt * 6);
    }

    /* ───── dibujo ───── */
    var lastEst = '';
    /* campo visible: el ancho real de la pantalla (vertical ~340, apaisado ~1300 unidades). c.campo() en el navegador hoy devuelve 0..800 (gameLeft es un const de
       script, no cuelga de window), así que se lee gameLeft/gameRight directo si existen. El juego se juega en una franja central de ≤620; el fondo cubre todo. */
    function geo() {
      var f = c.campo(), fx0 = f.x0, fx1 = f.x1;
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') { fx0 = gameLeft(); fx1 = gameRight(); }
      var cx = (fx0 + fx1) / 2, pw = Math.min(fx1 - fx0, 620), x0 = cx - pw / 2, x1 = cx + pw / 2;
      var lh = Math.min(66, 268 / Math.max(1, n)), top = 204 + (268 - lh * n) / 2;
      return { fx0: fx0, fx1: fx1, fw: fx1 - fx0, x0: x0, x1: x1, w: pw, cx: cx, L: x0 + 48, R: x1 - 72, lh: lh, top: top };
    }
    function fondo(G, gt) {
      var x0 = G.fx0, w = G.fw, k;
      rr(x0, 0, w, 150, 0, pal.sky, 0); rr(x0, 150, w, 60, 0, pal.sky2, 0);
      if (lv === 3) for (k = 0; k < estrellas.length; k++) { var e = estrellas[k]; ell(x0 + e[0] * w, 70 + e[1] * 70, e[2], e[2], '#fffdf2', 0); }
      else ell(lv === 1 ? G.fx1 - 50 : x0 + 46, lv === 1 ? 104 : 170, 20, 20, lv === 1 ? '#ffe14d' : '#ffe9a0', 0);
      /* techo del bodegón de gasolina */
      rr(x0, 82, w, 20, 0, pal.techo, 3); rr(x0, 102, w, 8, 0, '#ffd23f', 0);
      for (k = x0 + 14; k < G.fx1 - 10; k += 46) rr(k, 110, 4, 42, 0, '#d8d2c4', 2);
      rr(x0, 208, w, 270, 0, pal.asf, 0); line([[x0, 208], [G.fx1, 208]], 4, INKC);
      rr(x0, 152, w, 56, 0, pal.acera, 0); line([[x0, 152], [G.fx1, 152]], 3, INKC);
    }
    function semaforo(x, y, est) {
      rr(x - 11, y - 28, 22, 56, 8, '#2a2438', 3);
      ell(x, y - 16, 7, 7, est.s === 'rojo' ? '#ff3b3b' : '#5a2a2a', 2);
      ell(x, y, 7, 7, est.s === 'aviso' || est.s === 'falso' ? '#ffd23f' : '#5a4a1a', 2);
      ell(x, y + 16, 7, 7, est.s === 'verde' ? '#3fe06a' : '#1f4a2a', 2);
    }
    function dibujaFiscal(G, gt, est) {
      var x = G.cx, y = 178, mirando = est.s === 'rojo', asoma = est.s === 'aviso' || est.s === 'falso';
      var tem = asoma ? Math.sin(gt * 40) * 1.5 : 0;
      ell(x, y + 4, 30, 6, 'rgba(20,16,28,.3)', 0);
      rr(x - 20 + tem, y - 42, 40, 44, 10, '#ff9a1f', 3.5);                        // chaleco naranja
      rr(x - 4 + tem, y - 42, 8, 44, 0, '#f5f0dc', 0);
      if (mirando) {
        c.util.pj('tio', x, y - 66, 50, { animo: 'perder', sombra: false });
        line([[x - 20, y - 74], [x - 7, y - 70]], 4, '#ff3b3b'); line([[x + 20, y - 74], [x + 7, y - 70]], 4, '#ff3b3b');
        for (var k = 0; k < 5; k++) { var a = -2.4 + k * 0.57; line([[x + Math.cos(a) * 34, y - 66 + Math.sin(a) * 34], [x + Math.cos(a) * 44, y - 66 + Math.sin(a) * 44]], 3, '#ff3b3b'); }
      } else {                                                                      // de espaldas: nuca y gorra
        var gi = est.s === 'falso' ? Math.sin(est.u * Math.PI) * 8 : est.s === 'aviso' ? est.u * 6 : 0;
        ell(x + tem + gi, y - 62, 20, 22, '#e8b48a', 3.5);
        ell(x + tem + gi, y - 69, 21, 17, '#2a1a14', 3.5);
        rr(x - 22 + tem + gi, y - 77, 44, 9, 4, '#2f6fd8', 3);
      }
      if (est.s === 'rojo') {                                                       // globito a la derecha de la cabeza, en dos renglones
        var f = FRASES[frases[est.i] % FRASES.length], sp = f.indexOf(' ', f.length / 2 - 3), a1 = f.slice(0, sp < 0 ? f.length : sp), a2 = sp < 0 ? '' : f.slice(sp + 1);
        var bx0 = x + 38, bw = Math.min(G.x1 - 6 - bx0, 150), bcx = bx0 + bw / 2, by = 116;
        rr(bx0, by - 20, bw, 40, 10, '#fffdf2', 3.5);
        poly([[bx0 + 1, by - 6], [bx0 + 1, by + 6], [bx0 - 12, by + 2]], '#fffdf2', 3);
        txt(a1, bcx, by - 8, 11, '#c4283a', 0, true); txt(a2, bcx, by + 8, 11, '#c4283a', 0, true);
      } else if (est.s === 'aviso') txt('¡!', x + 34, y - 88, 22, '#ffd23f');
    }
    function dibujaCarro(G, p, gt, est) {
      var q = P[p], s = c.seats[p], y = G.top + p * G.lh, yy = y + G.lh / 2, x = G.L + (q.dx / 100) * (G.R - G.L), col = s.color || TEAM[p % 4];
      var frz = q.fz || (gt < q.fzU), sacude = frz ? Math.sin(gt * 70 + p) * 2.5 : 0, br = q.bounce > 0 ? -3 * q.bounce : 0, cy = yy + 9 + br;
      rr(G.x0 + 12, y + 3, G.w - 24, G.lh - 6, 10, p === c.yo ? '#6a5f92' : p % 2 ? pal.asf : pal.asf2, 3);
      for (var d = 0; d < 9; d++) rr(G.L - 12 + d * (G.R - G.L + 40) / 9, yy + G.lh * 0.34, 18, 3, 1, pal.raya, 0);
      /* bomba al final del carril */
      var bx = G.R + 40;
      rr(bx, yy - 22, 24, 40, 5, '#d63a3a', 3); rr(bx + 4, yy - 16, 16, 12, 3, '#bfe6ff', 2); rr(bx + 2, yy + 8, 20, 5, 2, '#ffd23f', 0);
      line([[bx + 24, yy - 6], [bx + 32, yy], [bx + 30, yy + 12]], 3, INKC);
      if (p === c.yo) txt('TÚ', G.x0 + 22, yy - 9, 13, '#ffd23f', 0, true);
      /* el carrito de cartón con su conductor */
      ell(x, cy + 16, 30, 6, 'rgba(20,16,28,.3)', 0);
      ell(x - 15 + sacude, cy + 11, 7, 7, INKC, 3); ell(x + 15 + sacude, cy + 11, 7, 7, INKC, 3);
      rr(x - 24 + sacude, cy - 7, 48, 20, 7, frz ? '#8c8c96' : col, 3.5);
      rr(x - 8 + sacude, cy - 16, 22, 11, 5, '#bfe6ff', 3);
      c.util.pj(s.ch, x - 2 + sacude, cy - 24, 30, { sombra: false, animo: q.tl > 0 ? 'celebrar' : (frz ? 'perder' : null) });
      ell(x + 24 + sacude, cy, 3, 3, '#fff6a0', 0);
      txt(Math.round(q.dx) + '%', G.x0 + 22, yy + 7, 11, '#fffdf2', 0, true);
      if (frz && gt - q.colAt < 1.0) {
        var al = cl01(1 - (gt - q.colAt) / 1.0), bx2 = Math.min(G.x1 - 54, Math.max(G.x0 + 54, x));
        rr(bx2 - 44, y - 12, 88, 18, 6, '#ff4d5e', 3); txt('¡COLEADO!', bx2, y - 3, 12, '#fff', 0, true);
      }
      if (q.tl > 0 && gt - q.llegoAt < 1.6) txt('¡LLENÓ EL TANQUE!', Math.min(G.x1 - 80, Math.max(G.x0 + 80, x)), y - 2, 13, '#fffdf2');
    }

    function dibujar2D() {                        // el 2D de siempre (sin WebGL o con ?plano=1)
      var G = geo(), gt = c.ahora(), est = fiscal(gt), p;
      fondo(G, gt);
      semaforo(G.x0 + 26, 128, est);
      dibujaFiscal(G, gt, est);
      var msg = gt < 1.6 ? '¡DALE, TOCA!' : est.s === 'rojo' ? '¡QUIETO!' : est.s === 'aviso' ? '¡OJO!' : '¡AVANZA!';
      var mc = est.s === 'rojo' ? '#ff4d5e' : est.s === 'aviso' ? '#ffd23f' : '#5cff7a';
      txt(msg, G.cx, 190, 22, mc);
      for (p = 0; p < n; p++) dibujaCarro(G, p, gt, est);
      if (est.s === 'rojo') { line([[G.fx0, 208], [G.fx1, 208]], 5, '#ff3b3b'); line([[G.fx0, 478], [G.fx1, 478]], 5, '#ff3b3b'); }
    }

    /* ───── 3D low poly (fiesta-3d.js): la bomba de gasolina con su cola de carros. Solo dibujo: lee P, evs y fiscal(); no toca la simulación ─────
       Cada jugador EMPUJA su carrito por su carril hacia el surtidor (ahorrando gasolina, como debe ser). Al fondo, el fiscal con chaleco y su semáforo:
       de espaldas = verde, se asoma = amarillo, te mira = rojo. Si te pilla, el carro se CALA (humo, se pone gris) y el conductor queda mareado. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0, absT = 0;
    var LZ = 3.2, X0 = -10, X1 = 8.5;                          // carriles a lo largo de x; el 100 % deja el carro pegado al surtidor
    function LZp(p) { return (p - (n - 1) / 2) * LZ; }
    function CX(dx) { return X0 + cl01(dx / 100) * (X1 - X0); }
    var ZF = LZp(0) - LZ / 2 - 3.6;                             // dónde se para el fiscal (detrás de la cola)
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, .55], sol: [0xfff2d8, .7], niebla: '#cfeeff', asf: '#5d5b72', acera: '#d8d2c4', tierra: '#c9b48a', cerro: '#5aa04a', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, .5], sol: [0xffb070, .8], niebla: '#ffcf9a', asf: '#5a4a62', acera: '#c8b4a0', tierra: '#b8946a', cerro: '#6a8a42', noche: 0 },
      3: { cielo: ['#141238', '#3a2f6a'], hemi: [0x8a8aff, 0x3a2a4a, .45], sol: [0x9aa8ff, .3], niebla: '#2a2550', asf: '#3a3850', acera: '#6a6684', tierra: '#4a4258', cerro: '#2a3a3a', noche: 1 }
    };
    var NPC = ['#3fb0ff', '#f5f0dc', '#5cff7a', '#ff8a3d', '#a9a0ff', '#e8553d', '#7fd6c9', '#ffd23f'];
    var RANCHOS = ['#ff9ec7', '#7fd6c9', '#ffb36b', '#a9a0ff', '#8fd8ff', '#ff7a6a', '#fff1c2'];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 60, 150], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      /* la pista de la cola: gaita zuliana en La menor (Am–Dm–E–Am), con su furruco imaginario */
      V3.pista('cola', { bpm: 126, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 74, 72, 0, 71, 72, 0, 74, 0, 77, 76, 0, 74, 72, 0, 71, 0, 72, 74, 0, 76, 80, 0, 81, 0, 76, 0, 72, 0, 0, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, GM = V3.toon('#fff').gradientMap;
      function luz(col, em, emI) { var m = tn(col, { em: em }); m.emissiveIntensity = emI; return m; }   // el material va en caché: el brillo se fija según el nivel
      /* piso: tierra alrededor, acera de la bomba y el asfalto de la cola */
      var piso = new T.Mesh(new T.PlaneGeometry(200, 140), tn(pl.tierra)); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      var zmin = LZp(0) - LZ / 2 - .4, zmax = LZp(n - 1) + LZ / 2 + .4;
      var acera = new T.Mesh(new T.PlaneGeometry(64, zmax - ZF + 12), tn(pl.acera)); acera.rotation.x = -Math.PI / 2; acera.position.set(0, .005, (ZF - 9 + zmax + 3) / 2); acera.receiveShadow = true; S3.add(acera);
      var asfT = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = pl.asf; x.fillRect(0, 0, w, h);
        for (var i2 = 0; i2 < 160; i2++) { x.fillStyle = V3.oscurecer(pl.asf, .82 + ((i2 * 37) % 10) / 25); x.fillRect((i2 * 53) % w, (i2 * 29) % h, 3, 3); }
        x.fillStyle = 'rgba(10,8,20,.25)'; x.fillRect(30, 40, 22, 14); x.fillRect(84, 90, 16, 10);   // manchas de aceite
      }, [10, 4]);
      var asf = new T.Mesh(new T.PlaneGeometry(44, zmax - zmin), new T.MeshToonMaterial({ map: asfT, gradientMap: GM }));
      asf.rotation.x = -Math.PI / 2; asf.position.set(-2, .012, (zmin + zmax) / 2); asf.receiveShadow = true; S3.add(asf);
      /* rayas entre carriles, línea de salida y la cuadriculada de llegada frente al surtidor */
      for (k = 1; k < n; k++) for (j = 0; j < 12; j++) { var ra = new T.Mesh(new T.PlaneGeometry(1.2, .12), tn('#f5f0dc')); ra.rotation.x = -Math.PI / 2; ra.position.set(-22 + j * 3.4, .02, LZp(k) - LZ / 2); ra.receiveShadow = true; S3.add(ra); }
      var cuadT = V3.texturaCanvas(32, 64, function (x, w, h) { for (var a = 0; a < 2; a++) for (var b = 0; b < 4; b++) { x.fillStyle = (a + b) % 2 ? '#14101c' : '#fffdf2'; x.fillRect(a * 16, b * 16, 16, 16); } }, [1, n * 3]);
      var meta = new T.Mesh(new T.PlaneGeometry(.7, zmax - zmin - .8), new T.MeshToonMaterial({ map: cuadT, gradientMap: GM })); meta.rotation.x = -Math.PI / 2; meta.position.set(X1 + 1.5, .022, (zmin + zmax) / 2); S3.add(meta);
      /* el carril propio, resaltado */
      if (c.yo >= 0 && c.yo < n) { var mio3 = new T.Mesh(new T.PlaneGeometry(X1 - X0 + 6, LZ - .5), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .14, depthWrite: false })); mio3.rotation.x = -Math.PI / 2; mio3.position.set((X0 + X1) / 2, .025, LZp(c.yo)); S3.add(mio3); }
      /* bordillos que se pintan con el semáforo (verde / amarillo / rojo) */
      var bordeMat = tn('#3fe06a', { nuevo: true, em: '#3fe06a', emI: .35 });
      [zmin - .15, zmax + .15].forEach(function (z) { var b = M(new T.BoxGeometry(44, .22, .3), null, { mat: bordeMat, g: .02, recibe: true }); b.position.set(-2, .11, z); S3.add(b); });

      /* surtidores (uno por carril) */
      function surtidor(x, z) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        var isla = M(new T.BoxGeometry(1.6, .25, 2.2), '#e8e2d4', { recibe: true, g: .03 }); isla.position.y = .125; g3.add(isla);
        var cu = M(new T.BoxGeometry(.8, 2.1, 1.1), '#d63a3a', { g: .04 }); cu.position.y = 1.3; g3.add(cu);
        var tapa = M(new T.BoxGeometry(.95, .22, 1.25), '#ffd23f', { g: .04 }); tapa.position.y = 2.45; g3.add(tapa);
        var pant = new T.Mesh(new T.BoxGeometry(.06, .5, .8), tn('#bfe6ff', { nuevo: true, em: '#5cffc0', emI: pl.noche ? 1.2 : .25 })); pant.position.set(-.42, 1.85, 0); g3.add(pant);
        var pist = M(new T.BoxGeometry(.25, .16, .35), '#2a2a34', { g: .05 }); pist.position.set(-.45, 1.2, .32); g3.add(pist);
        var cur = new T.CatmullRomCurve3([new T.Vector3(-.4, 1.6, .45), new T.Vector3(-.8, .9, .58), new T.Vector3(-.55, .4, .5), new T.Vector3(-.45, 1.12, .34)]);
        g3.add(new T.Mesh(new T.TubeGeometry(cur, 16, .045, 5), tn('#14101c')));
        return { g: g3, pant: pant, flash: 0 };
      }
      /* un carrito low poly: chasis, cabina con vidrios, ruedas que giran, faros */
      function carro(col, largo) {
        var L = largo || 2.6, g3 = new T.Group(), cuerpo = new T.Group(); g3.add(cuerpo);
        var ch = M(new T.BoxGeometry(L, .7, 1.5), col, { g: .03 }); ch.position.y = .68; cuerpo.add(ch);
        var cab = M(new T.BoxGeometry(L * .54, .6, 1.3), '#fffdf2', { g: .03 }); cab.position.set(-L * .08, 1.32, 0); cuerpo.add(cab);
        var vid = new T.Mesh(new T.BoxGeometry(L * .54 + .04, .34, 1.34), tn(pl.noche ? '#2a3a5a' : '#7fb8e0')); vid.position.copy(cab.position); cuerpo.add(vid);
        var faros = [];
        [-.45, .45].forEach(function (z) { var f = new T.Mesh(new T.BoxGeometry(.06, .18, .3), luz('#fff6c0', '#ffe27a', pl.noche ? 1.6 : .2)); f.position.set(L / 2 + .01, .78, z); cuerpo.add(f); faros.push(f);
          var s = new T.Mesh(new T.BoxGeometry(.06, .16, .26), luz('#ff4d5e', '#ff2a3a', pl.noche ? 1.2 : .15)); s.position.set(-L / 2 - .01, .78, z); cuerpo.add(s); });
        var tapon = M(new T.CylinderGeometry(.1, .1, .06, 8), '#2a2a34', { borde: false }); tapon.rotation.x = Math.PI / 2; tapon.position.set(-L * .32, .85, .76); cuerpo.add(tapon);
        var ruedas = [], rg = new T.CylinderGeometry(.34, .34, .3, 10); rg.rotateX(Math.PI / 2);
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (r) { var w = M(rg, '#22202c', { g: .05 }); w.position.set(r[0] * L * .33, .34, r[1] * .72); g3.add(w); ruedas.push(w);
          var rin = new T.Mesh(new T.CylinderGeometry(.14, .14, .32, 6), tn('#d8d2c4')); rin.rotation.x = Math.PI / 2; w.add(rin); });
        return { g: g3, cuerpo: cuerpo, chasis: ch, ruedas: ruedas, col: col };
      }

      /* los jugadores: su carro y ellos empujándolo por detrás */
      var pjs = [], surt = [];
      for (k = 0; k < n; k++) {
        var s2 = c.seats[k] || {}, col = s2.color && s2.color !== '#fff' && s2.color !== '#ffffff' ? s2.color : TEAM[k % 4];
        var ca = carro(col); S3.add(ca.g);
        var pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }); S3.add(pj.g);
        var x3 = CX(P[k].dx);
        ca.g.position.set(x3, 0, LZp(k)); pj.g.position.set(x3 - 1.95, 0, LZp(k));
        surt.push(surtidor(X1 + 2.75, LZp(k)));
        pjs.push({ fk: 0, bTxt: '', sc: pj.g.scale.x, pkSeen: -1, turbo: -9, cT: 0, pkT: -9, pkTxt: '', pj: pj, car: ca, x: x3, px: x3, frz: 0, tl: 0, colT: -9, llT: -9, humo: 0, polvo: 0, vb: 0, gris: false });
      }
      /* la cola de verdad: carros esperando detrás de la línea de salida (tocan corneta) */
      var cola = [];
      for (k = 0; k < n; k++) for (j = 0; j < 2; j++) { var cn = carro(NPC[(k * 3 + j * 5) % NPC.length]); cn.g.position.set(X0 - 3.8 - j * 3.3, 0, LZp(k)); S3.add(cn.g);
        var cab2 = M(new T.SphereGeometry(.24, 8, 6), ['#e8b48a', '#b07a58', '#c98a5a'][(k + j) % 3], { g: .05 }); cab2.position.set(-.1, 1.38, -.3); cn.cuerpo.add(cab2);
        cola.push({ c: cn, pito: -9, prox: 2 + ((k * 7 + j * 3) % 5) }); }

      /* el fiscal y su semáforo */
      var fg = new T.Group(); fg.position.set(0, 0, ZF); S3.add(fg);
      var fpj = V3.PJ.crear('tio', { prop: false, escala: 1.55 }); fpj.color('#ff9a1f'); fg.add(fpj.g);
      var tarima = M(new T.CylinderGeometry(1.1, 1.2, .18, 12), '#ffd23f', { recibe: true, g: .03 }); tarima.position.set(0, .09, ZF); S3.add(tarima);
      fpj.g.position.y = .18;
      for (k = 0; k < 4; k++) { var cono = M(new T.ConeGeometry(.22, .6, 8), '#ff7a2a', { g: .05 }); cono.position.set(-3.6 + k * 2.4 + (k > 1 ? 2.4 : 0), .3, ZF + 1.6); S3.add(cono);
        var fr = new T.Mesh(new T.CylinderGeometry(.13, .17, .12, 8), tn('#fffdf2')); fr.position.set(cono.position.x, .3, cono.position.z); S3.add(fr); }
      var semX = -2.6, poste = M(new T.CylinderGeometry(.1, .13, 3.6, 6), '#2a2a34'); poste.position.set(semX, 1.8, ZF); S3.add(poste);
      var caja = M(new T.BoxGeometry(.75, 2, .55), '#2a2438', { g: .04 }); caja.position.set(semX, 4.3, ZF); S3.add(caja);
      var focos = [];
      ['#ff3b3b', '#ffd23f', '#3fe06a'].forEach(function (cc, i2) { var m = tn(V3.oscurecer(cc, .35), { nuevo: true, em: cc, emI: 0 });
        var f = new T.Mesh(new T.SphereGeometry(.22, 10, 8), m); f.position.set(semX, 4.95 - i2 * .64, ZF + .26); S3.add(f); focos.push({ m: m, cc: cc }); });
      var luzS = new T.PointLight(0x3fe06a, pl.noche ? 1.4 : .6, 14, 2); luzS.position.set(semX, 4.2, ZF + 2); S3.add(luzS);

      /* la estación: tienda, techo con luces, aviso grande y la bandera */
      var tx = 9, tz = ZF - 5.5;
      var tienda = M(new T.BoxGeometry(12, 4, 4), '#fffdf2', { recibe: true, g: .015 }); tienda.position.set(tx, 2, tz); S3.add(tienda);
      var franja = M(new T.BoxGeometry(12.05, .7, 4.05), '#d63a3a', { borde: false }); franja.position.set(tx, 3.45, tz); S3.add(franja);
      for (k = 0; k < 4; k++) { var vt = M(new T.BoxGeometry(1.8, 1.4, .12), pl.noche ? '#ffd36a' : '#3a4a7a', { g: .04, em: pl.noche ? '#ffb030' : null, emI: .9 }); vt.position.set(tx - 4.2 + k * 2.8, 1.7, tz + 2.02); S3.add(vt); }
      var techoMat = tn('#d63a3a');
      var techo = M(new T.BoxGeometry(14, .5, 6.5), null, { mat: techoMat, g: .02 }); techo.position.set(tx, 6.1, ZF - 2.4); S3.add(techo);
      var cenefa = M(new T.BoxGeometry(14.05, .35, 6.55), '#ffd23f', { borde: false }); cenefa.position.set(tx, 5.75, ZF - 2.4); S3.add(cenefa);
      for (k = 0; k < 4; k++) { var col2 = M(new T.BoxGeometry(.35, 5.8, .35), '#e8e2d4', { g: .03 }); col2.position.set(tx - 6 + (k % 2) * 12, 2.9, ZF - 5 + Math.floor(k / 2) * 5.2); S3.add(col2); }
      for (k = 0; k < 6; k++) { var bomb = new T.Mesh(new T.BoxGeometry(1.2, .08, .5), luz('#fffdf2', '#fff2c8', pl.noche ? 1.5 : .2)); bomb.position.set(tx - 5 + k * 2, 5.5, ZF - 2.4); S3.add(bomb); }
      surtidor(tx - 2.5, ZF - 2.4); surtidor(tx + 2.5, ZF - 2.4);
      var avisoT = V3.texturaCanvas(256, 128, function (x, w, h) {
        x.fillStyle = '#14101c'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.fillRect(6, 6, w - 12, h - 12);
        x.fillStyle = '#d63a3a'; x.fillRect(6, 6, w - 12, 44);
        x.textAlign = 'center'; x.fillStyle = '#fffdf2'; x.font = 'bold 34px sans-serif'; x.fillText('GASOLINA', w / 2, 42);
        x.fillStyle = '#14101c'; x.font = 'bold 30px sans-serif'; x.fillText('¿HAY? ¡SÍ HAY!', w / 2, 98);
      });
      var posteA = M(new T.CylinderGeometry(.16, .2, 7, 6), '#2a2a34'); posteA.position.set(-9, 3.5, ZF - 3); S3.add(posteA);
      var panel = new T.Mesh(new T.BoxGeometry(4.4, 2.2, .2), [tn('#14101c'), tn('#14101c'), tn('#14101c'), tn('#14101c'),
        new T.MeshToonMaterial({ map: avisoT, gradientMap: GM, emissive: new T.Color(pl.noche ? '#ffffff' : '#000000'), emissiveMap: avisoT, emissiveIntensity: pl.noche ? .8 : 0 }), tn('#14101c')]);
      panel.position.set(-9, 7.4, ZF - 3); panel.castShadow = true; S3.add(panel); V3.borde(panel, .03);
      var bandera = [];
      var mastil = M(new T.CylinderGeometry(.07, .09, 7.5, 6), '#d8d2c4'); mastil.position.set(15.8, 3.75, ZF - 2); S3.add(mastil);
      ['#ffd23f', '#2f6fd8', '#d63a3a'].forEach(function (cc, i2) { var b = new T.Mesh(new T.PlaneGeometry(2.4, .5), new T.MeshToonMaterial({ color: cc, side: T.DoubleSide, gradientMap: GM }));
        b.geometry.translate(1.2, 0, 0); b.position.set(15.8, 7.1 - i2 * .5, ZF - 2); b.castShadow = true; S3.add(b); bandera.push(b); });

      /* al fondo: la avenida con tráfico (carros y una camionetica que pasan solos) y el cerro con sus ranchitos */
      var zAv = ZF - 12;
      var av = new T.Mesh(new T.PlaneGeometry(200, 6), tn(V3.oscurecer(pl.asf, .9))); av.rotation.x = -Math.PI / 2; av.position.set(0, .015, zAv); av.receiveShadow = true; S3.add(av);
      for (k = 0; k < 30; k++) { var lr = new T.Mesh(new T.PlaneGeometry(1.6, .14), tn('#ffd23f')); lr.rotation.x = -Math.PI / 2; lr.position.set(-90 + k * 6.2, .025, zAv); S3.add(lr); }
      var trafico = [];
      for (k = 0; k < 4; k++) { var bus = k === 1, tc = carro(bus ? '#ffd23f' : NPC[(k * 3 + 1) % NPC.length], bus ? 5 : 2.6);
        if (bus) { tc.cuerpo.scale.set(1, 1.35, 1.1); }
        var dir = k % 2 ? -1 : 1; tc.g.rotation.y = dir > 0 ? 0 : Math.PI; tc.g.position.set(-40 + k * 23, 0, zAv + (dir > 0 ? 1.4 : -1.4)); S3.add(tc.g);
        trafico.push({ c: tc, dir: dir, v: 6 + k * 1.3, x: -40 + k * 23 }); }
      for (k = 0; k < 7; k++) { var ce = M(new T.IcosahedronGeometry(14 + (k % 3) * 4, 0), V3.oscurecer(pl.cerro, .85 + (k % 3) * .1), { g: .01, recibe: true }); ce.scale.set(1.6, .7, 1); ce.position.set(-70 + k * 24, -3, zAv - 26 - (k % 2) * 6); S3.add(ce); }
      for (k = 0; k < 34; k++) { var rx = -55 + ((k * 37) % 110), rh = 1.4 + (k % 3) * .5;
        var ran = M(new T.BoxGeometry(2 + (k % 2), rh, 1.8), RANCHOS[k % RANCHOS.length], { g: .03, em: pl.noche && k % 3 === 0 ? '#ffb030' : null, emI: .35 });
        ran.position.set(rx, 1.5 + (k % 4) * 1.6 + rh / 2, zAv - 16 - (k % 4) * 2.4); S3.add(ran);
        var tch = M(new T.BoxGeometry(2.3 + (k % 2), .18, 2.1), '#8a8a96', { borde: false }); tch.position.set(rx, ran.position.y + rh / 2 + .09, ran.position.z); S3.add(tch); }
      var hojas = [];
      function palmera(x, z, h) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        for (var i2 = 0; i2 < 6; i2++) { var tr = M(new T.CylinderGeometry(.28 - i2 * .02, .34 - i2 * .02, h / 6, 6), i2 % 2 ? '#a07040' : '#8a5a30', { g: .04 }); tr.position.set(Math.sin(i2 * .3) * .3, h / 12 + i2 * h / 6, 0); g3.add(tr); }
        for (var j2 = 0; j2 < 7; j2++) { var hoja = M(new T.ConeGeometry(.5, 3.6, 4), j2 % 2 ? '#3fae4a' : '#2f9a3c', { g: .03 }); hoja.geometry.translate(0, 1.8, 0); hoja.position.set(.5, h, 0); hoja.rotation.set(0, j2 / 7 * 6.28, 0); hoja.rotateZ(1.9); g3.add(hoja); hojas.push(hoja); }
      }
      palmera(-15.5, ZF - 1, 7.5); palmera(-19, zmax + 2.5, 6.5); palmera(19.5, zmax + 2, 7); palmera(-4.5, ZF - 6, 8);
      var nubes = [];
      if (!pl.noche) for (k = 0; k < 6; k++) { var nu = M(new T.IcosahedronGeometry(2 + (k % 3), 0), '#fffdf2', { borde: false, sombra: false }); nu.scale.set(2, .6, 1); nu.position.set(-60 + k * 22, 20 + (k % 3) * 3, zAv - 40); S3.add(nu); nubes.push(nu); }
      /* de noche: un farol al frente y la luz del techo */
      var fp = M(new T.CylinderGeometry(.1, .14, 5, 6), '#2a2a34'); fp.position.set(-14, 2.5, zmax + 1.4); S3.add(fp);
      var fl = new T.Mesh(new T.BoxGeometry(.5, .6, .5), luz('#fff2a0', '#ffd36a', pl.noche ? 1.6 : .2)); fl.position.set(-14, 5.1, zmax + 1.4); S3.add(fl);
      if (pl.noche) { var l1 = new T.PointLight(0xfff2c8, 1.3, 22, 2); l1.position.set(tx, 5, ZF - 2.4); S3.add(l1); var l2 = new T.PointLight(0xffc870, 1.2, 18, 2); l2.position.set(-12, 4.6, zmax); S3.add(l2); }

      /* ───── el caos en 3D: cajas sorpresa, peatones con su cebra, charco de aceite, colaos, proyectiles ───── */
      var cajaT = V3.texturaCanvas(64, 64, function (x, w, h) {
        x.fillStyle = '#ffd23f'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8a010'; x.fillRect(0, 0, w, 6); x.fillRect(0, h - 6, w, 6); x.fillRect(0, 0, 6, h); x.fillRect(w - 6, 0, 6, h);
        x.fillStyle = '#14101c'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; x.fillText('?', w / 2, 49);
      });
      var cajaMat = new T.MeshToonMaterial({ map: cajaT, gradientMap: GM, emissive: new T.Color('#ffb020'), emissiveMap: cajaT, emissiveIntensity: .35 });
      var cajaGeo = new T.BoxGeometry(.8, .8, .8), cajasM = [];
      for (k = 0; k < n; k++) { cajasM.push([]); for (j = 0; j < cajas.length; j++) { var cm = M(cajaGeo, null, { mat: cajaMat, g: .03 }); cm.position.set(CX(cajas[j].x), 1.3, LZp(k)); S3.add(cm); cajasM[k].push({ m: cm, vis: true }); } }
      var cebraT = V3.texturaCanvas(32, 32, function (x, w, h) { x.clearRect(0, 0, w, h); x.fillStyle = '#fffdf2'; x.fillRect(0, 0, 16, h); }, [5, 1]);
      var PEDCH = ['pana', 'prima', 'abuela', 'mama', 'cobrador', 'portu'], pedsV = [], pz0 = LZp(0), pz1 = LZp(n - 1);
      for (k = 0; k < peds.length; k++) {
        var pdm = new T.MeshBasicMaterial({ map: cebraT, transparent: true, opacity: 0, depthWrite: false });
        var ceb = new T.Mesh(new T.PlaneGeometry(3, pz1 - pz0 + LZ + 1), pdm); ceb.rotation.x = -Math.PI / 2; ceb.position.set(CX(peds[k].x), .03, (pz0 + pz1) / 2); S3.add(ceb);
        var ppj = V3.PJ.crear(PEDCH[peds[k].ch % PEDCH.length], { prop: false, escala: 1.3 }); ppj.g.visible = false; S3.add(ppj.g);
        pedsV.push({ pj: ppj, ceb: ceb, mat: pdm, reac: -9 });
      }
      var aceiteM = [], colaosM = [];
      for (k = 0; k < n; k++) {
        var ac = new T.Group(); ac.visible = false; ac.position.y = .035;
        [[1.9, '#14101c', .8], [1.2, '#3a2a6a', .6], [.6, '#2a8a6a', .5]].forEach(function (d, i2) { var di = new T.Mesh(new T.CircleGeometry(d[0], 12), new T.MeshBasicMaterial({ color: d[1], transparent: true, opacity: d[2], depthWrite: false })); di.rotation.x = -Math.PI / 2; di.position.y = i2 * .004; di.scale.y = .8; ac.add(di); });
        S3.add(ac); aceiteM.push(ac);
        var cc2 = carro(NPC[(k * 2 + 3) % NPC.length], 2.4); cc2.g.visible = false; S3.add(cc2.g); colaosM.push({ c: cc2, t: -9 });
      }
      var KCOL = ['#ffd23f', '#3a3a46', '#14101c', '#e8553d', '#fffdf2'], proy = [];
      for (k = 0; k < 6; k++) { var pm = M(new T.IcosahedronGeometry(.3, 0), '#3a3a46', { g: .03 }); pm.visible = false; S3.add(pm); proy.push({ m: pm, v: null }); }
      /* la gente de la estación: vendedor que pasea, hinchas del lado de la bomba que reaccionan, y un camión cisterna de fondo */
      var gente = [];
      [['cobrador', 4, ZF + 1.6, 'vend'], ['pana', -8.2, ZF - 1.9, 'hin'], ['abuela', -6.6, ZF - 2.3, 'hin'], ['tio', -5.2, ZF - 1.7, 'hin'], ['prima', 14.4, ZF + 1.5, 'hin']].forEach(function (d, i2) {
        var gp = V3.PJ.crear(d[0], { prop: false, escala: 1.25 }); gp.g.position.set(d[1], 0, d[2]); S3.add(gp.g); gente.push({ pj: gp, tipo: d[3], x: d[1], z: d[2], i: i2, dir: 1, ult: -9 }); });
      var cis = new T.Group(); cis.position.set(-19.5, 0, ZF - 8); S3.add(cis);
      var tanque = M(new T.CylinderGeometry(1.5, 1.5, 6.4, 12), '#e8e2d4', { g: .03 }); tanque.rotation.z = Math.PI / 2; tanque.position.y = 2.1; cis.add(tanque);
      var fr2 = M(new T.CylinderGeometry(1.53, 1.53, .9, 12), '#d63a3a', { borde: false }); fr2.rotation.z = Math.PI / 2; fr2.position.set(-.8, 2.1, 0); cis.add(fr2);
      var cabi = M(new T.BoxGeometry(1.8, 1.9, 2.8), '#2f6fd8', { g: .03 }); cabi.position.set(4.1, 1.5, 0); cis.add(cabi);
      var cabv = M(new T.BoxGeometry(.1, .8, 2.3), '#bfe6ff', { borde: false }); cabv.position.set(5.02, 1.95, 0); cis.add(cabv);
      [-2.2, 0, 2.4, 4.3].forEach(function (rx) { [-1.4, 1.4].forEach(function (rz) { var rw = M(new T.CylinderGeometry(.5, .5, .4, 10), '#22202c', { g: .04 }); rw.rotation.x = Math.PI / 2; rw.position.set(rx, .5, rz); cis.add(rw); }); });
      /* banderines de fiesta entre el cartel y la bandera, y pájaros (de noche, murciélagos) */
      var banderines = [], BANDC = ['#ffd23f', '#2f6fd8', '#d63a3a', '#fffdf2', '#3fe06a'];
      for (k = 0; k < 24; k++) { var bu = k / 23, bxp = -9 + bu * 24.8, byp = 6.9 - Math.sin(bu * Math.PI) * 1.1;
        var bf = new T.Mesh(new T.ConeGeometry(.28, .6, 3), new T.MeshToonMaterial({ color: BANDC[k % 5], gradientMap: GM, side: T.DoubleSide })); bf.rotation.x = Math.PI; bf.position.set(bxp, byp - .3, ZF - 2.6); S3.add(bf); banderines.push(bf); }
      var pajaros = [];
      for (k = 0; k < 5; k++) { var pg = new T.Group(), pcol = pl.noche ? '#14101c' : '#2a2a34';
        [-1, 1].forEach(function (sd) { var al = M(new T.BoxGeometry(.9, .06, .35), pcol, { borde: false, sombra: false }); al.geometry = al.geometry.clone(); al.geometry.translate(sd * .45, 0, 0); pg.add(al); });
        pg.position.set(-50 + k * 24, 17 + (k % 3) * 2.5, zAv - 22 - k * 3); S3.add(pg); pajaros.push({ g: pg, v: 3 + (k % 3) * 1.2, ph: k }); }

      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 600);
      esc.encuadrar(27, 13.5, new T.Vector3(-.5, 1.2, (ZF + zmax) / 2 + .2), .62);
      return V3.ultimo = { esc: esc, pjs: pjs, surt: surt, cola: cola, fpj: fpj, fg: fg, focos: focos, luzS: luzS, bordeMat: bordeMat, bandera: bandera, trafico: trafico, hojas: hojas,
        nubes: nubes, flecha: flecha, part: part, est: '', fRot: Math.PI, motorT: 0, pitoT: 0, fin: false, confT: 0,
        cajasM: cajasM, pedsV: pedsV, aceiteM: aceiteM, colaosM: colaosM, proy: proy, KCOL: KCOL, gente: gente, banderines: banderines, pajaros: pajaros, visN: 0, denT: -9, denA: -1, humoQ: 0, sigT: 0 };
    }
    function finJuego(now) { return primero() >= 0 || now >= dur; }
    function ganador() {                                       // el primero en llenar; si nadie llenó, el que va más lejos
      var w = primero(), p;
      if (w >= 0) return w;
      for (p = 0; p < n; p++) if (w < 0 || P[p].x > P[w].x) w = p;
      return w;
    }
    var SEMC = { verde: ['#3fe06a', 0x3fe06a], aviso: ['#ffd23f', 0xffd23f], falso: ['#ffd23f', 0xffd23f], rojo: ['#ff3b3b', 0xff3b3b] };
    var NOMK = ['', '¡CLAVOS!', '¡ACEITE!', '¡UN COLAO!', '¡DENUNCIA!'];
    var BANF = { 1: '¡COLEADO!', 2: '¡PINCHAZO!', 3: '¡UN COLAO!', 4: '¡UN PEATÓN!', 5: '¡DENUNCIADO!', 6: '¡ACEITE!' };
    function pedZ(pd, now) {
      var lo = LZp(0) - 1.5 * LZ, hi = LZp(n - 1) + 1.5 * LZ, z = pd.dir > 0 ? LZp(0) + (now - pd.t0) / PW * LZ : LZp(n - 1) - (now - pd.t0) / PW * LZ;
      return Math.max(lo, Math.min(hi, z));
    }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, k, p, est = fiscal(now), fin = finJuego(now) && now > 0, w = fin ? ganador() : -1, i2;
      V.part.update(dt);
      /* lo que se mueve solo: palmeras, bandera, banderines, pájaros, nubes y el tráfico de la avenida */
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.3 + k) * .06;
      for (k = 0; k < V.bandera.length; k++) { V.bandera[k].rotation.y = Math.sin(t * 3 + k * .4) * .35; V.bandera[k].rotation.x = Math.sin(t * 4.2 + k) * .08; }
      for (k = 0; k < V.banderines.length; k++) V.banderines[k].rotation.z = Math.sin(t * 2.6 + k * .6) * .3;
      for (k = 0; k < V.pajaros.length; k++) { var pa = V.pajaros[k]; pa.g.position.x += pa.v * dt; if (pa.g.position.x > 70) pa.g.position.x = -70; pa.g.position.y += Math.sin(t * 1.5 + k) * dt * .6;
        pa.g.children[0].rotation.z = Math.sin(t * 9 + pa.ph) * .6; pa.g.children[1].rotation.z = -Math.sin(t * 9 + pa.ph) * .6; }
      for (k = 0; k < V.nubes.length; k++) { V.nubes[k].position.x += dt * .6; if (V.nubes[k].position.x > 70) V.nubes[k].position.x = -70; }
      for (k = 0; k < V.trafico.length; k++) { var tr = V.trafico[k]; tr.x += tr.dir * tr.v * dt; if (tr.x > 60) tr.x = -60; if (tr.x < -60) tr.x = 60;
        tr.c.g.position.x = tr.x; for (var r = 0; r < 4; r++) tr.c.ruedas[r].rotation.z -= tr.v * dt / .34; tr.c.cuerpo.position.y = Math.abs(Math.sin(t * 9 + k)) * .04; }
      /* el semáforo y los bordillos */
      var sc = SEMC[est.s] || SEMC.verde, parpa = est.s === 'aviso' ? (Math.sin(t * 22) > 0 ? 1 : .35) : 1;
      for (k = 0; k < 3; k++) { var on = (k === 0 && est.s === 'rojo') || (k === 1 && (est.s === 'aviso' || est.s === 'falso')) || (k === 2 && est.s === 'verde'); V.focos[k].m.emissiveIntensity = on ? 1.6 * parpa : 0; }
      V.bordeMat.color.set(sc[0]); V.bordeMat.emissive.set(sc[0]); V.bordeMat.emissiveIntensity = .3 + (est.s === 'rojo' ? .35 * Math.abs(Math.sin(t * 8)) : 0);
      V.luzS.color.setHex(sc[1]);
      /* sabotajes nuevos (de cualquiera): proyectil, gesto de quien lo tira, y el fiscal que silba en la denuncia */
      for (k = 0; k < vis.length; k++) {
        var rc = vis[k];
        if (rc.id <= V.visId) continue;
        V.visId = rc.id;
        var fr = V.pjs[rc.from], slot = null;
        for (i2 = 0; i2 < V.proy.length; i2++) if (!V.proy[i2].v) { slot = V.proy[i2]; break; }
        if (slot) { slot.v = { f: rc.from, to: rc.to, k: rc.k, t0: t }; slot.m.material = V3.toon(V.KCOL[rc.k]); slot.m.visible = true; }
        if (fr) { fr.pj.uno(rc.k === 4 ? 'pegar' : 'lanzar'); fr.pkT = t; fr.pkTxt = NOMK[rc.k]; }
        V3.sfx('whoosh');
        if (rc.k === 4) { V3.sfx('silbato'); V.esc.sacudir(.3); V.fpj.uno('lanzar'); V.denT = t; V.denA = rc.to; }
      }
      for (k = 0; k < V.proy.length; k++) {
        var pr = V.proy[k]; if (!pr.v) continue;
        var u = (t - pr.v.t0) / .55, a = V.pjs[pr.v.f], b = V.pjs[pr.v.to];
        if (!a || !b) { pr.v = null; pr.m.visible = false; continue; }
        if (u >= 1) {
          var zz = LZp(pr.v.to), kk = pr.v.k;
          if (kk === 1) { V.part.soltar(b.x, .3, zz, 12, { k: 'chispa', cols: ['#3a3a46', '#8a8896', '#ffd23f'], vel: 2.5, arriba: 2, vida: .5 }); V3.sfx('golpe'); }
          else if (kk === 2) { V.part.soltar(b.x, .2, zz, 14, { k: 'gota', cols: ['#14101c', '#3a2a6a'], vel: 1.8, arriba: 1.6, g: 3, vida: .8, esc: 1.2 }); V3.sfx('resbalon'); }
          else if (kk === 3) V3.sfx('bocina');
          else V.part.soltar(b.x, 2.4, zz, 10, { k: 'chispa', cols: ['#fffdf2', '#ff4d5e'], vel: 3, arriba: 2, vida: .5 });
          V.esc.sacudir(pr.v.to === c.yo ? .7 : .2); pr.v = null; pr.m.visible = false; continue;
        }
        pr.m.position.set(a.x + (b.x - a.x) * u, 1.6 + Math.sin(u * Math.PI) * 2.4, LZp(pr.v.f) + (LZp(pr.v.to) - LZp(pr.v.f)) * u); pr.m.rotation.set(t * 9, t * 7, 0);
      }
      var den = (t - V.denT < 1.4 && V.denA >= 0 && V.pjs[V.denA]) ? V.pjs[V.denA] : null;
      /* el fiscal: de espaldas mirando la bomba; se asoma en el aviso; en rojo te clava los ojos */
      if (est.s !== V.est) {
        if (now >= 0 && !fin) {
          if (est.s === 'aviso') { V3.sfx('tic'); }
          else if (est.s === 'rojo') { V3.sfx('silbato'); V.esc.sacudir(.3); V.fpj.uno('lanzar'); }
          else if (est.s === 'falso') { V3.sfx('whoosh'); }
          else if (est.s === 'verde' && V.est === 'rojo') { V3.sfx('bocina'); pitar(2); }
        }
        V.est = est.s;
      }
      var objR = est.s === 'rojo' ? 0 : est.s === 'aviso' ? Math.PI - est.u * .7 + Math.sin(t * 40) * .04 : est.s === 'falso' ? Math.PI - .7 * (1 - est.u) : Math.PI;
      if (den && est.s !== 'rojo') objR = Math.atan2(den.x, LZp(V.denA) - ZF);
      if (fin) objR = 0;
      V.fRot += (objR - V.fRot) * Math.min(1, dt * 14); V.fg.rotation.y = V.fRot;
      if (fin) V.fpj.anim('aplaudir').cara('feliz');
      else if (est.s === 'rojo' || den) V.fpj.anim('gritar').cara('enojado');
      else if (est.s === 'aviso' || est.s === 'falso') V.fpj.anim('quieto').cara('concentrado');
      else V.fpj.anim('quieto').cara('normal');
      V.fpj.rumbo(0).update(dt);
      V.fpj.g.position.set(0, .18 + (est.s === 'rojo' ? Math.abs(Math.sin(t * 10)) * .1 : est.s === 'aviso' ? Math.abs(Math.sin(t * 20)) * .04 : Math.sin(t * 2) * .01), 0);
      /* los peatones: esperan en el bordillo con la cebra pintada, cruzan todos los carriles y se asustan si pillan a alguien */
      for (k = 0; k < peds.length; k++) {
        var pd = peds[k], pv = V.pedsV[k], tfin = pd.t0 + n * PW, act = now >= pd.t0 - 3.2 && now < tfin + 1.5, pz = pedZ(pd, now);
        pv.pj.g.visible = !!act; pv.ceb.visible = !!act;
        pv.mat.opacity = act ? Math.min(1, (now - (pd.t0 - 3.2)) * 2) * Math.max(0, Math.min(1, (tfin + 1.3 - now) * 2)) * .85 : 0;
        if (!act) continue;
        var mov = now > pd.t0 - 1.5 * PW && now < tfin - 1.5 * PW + 1.5 * PW + .01 && pz > LZp(0) - 1.49 * LZ && pz < LZp(n - 1) + 1.49 * LZ;
        if (now < pd.t0 - 3 + dt * 2 && now >= pd.t0 - 3.2) V3.sfx('tic');
        if (t - pv.reac < .9) pv.pj.anim('quieto').cara('susto');
        else if (mov) pv.pj.anim('caminar', { vel: 1 }).cara('normal');
        else if (now < pd.t0) pv.pj.anim('quieto').cara('concentrado');
        else pv.pj.anim('saludar').cara('feliz');
        if (now < pd.t0 && now > pd.t0 - 3.2) pv.pj.mirar(Math.sin(t * 2) * .8, 0); else pv.pj.mirar(0, 0);
        pv.pj.rumbo(pd.dir > 0 ? 0 : Math.PI).update(dt);
        pv.pj.g.position.set(CX(pd.x), 0, pz);
      }
      /* los jugadores: empujan su carro; los sabotajes y los peatones los frenan con su motivo */
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], pj = s3.pj, car = s3.car, z = LZp(p), tx = CX(q.dx), frz = !!(q.fz || now < q.fzU);
        var fk = q.fz ? (q.fk || 1) : (q.fk === 6 ? 6 : 0);
        var paso = tx - s3.x; s3.x = tx;
        var v = Math.abs(tx - s3.px) / Math.max(dt, 1e-3); s3.px = tx;
        if (paso > .02 && now >= 0) {                          // avanzó: rebote del carro, polvito y el motorcito (solo el mío suena)
          s3.vb = 1; s3.polvo -= dt;
          if (s3.polvo < 0) { s3.polvo = .12; V.part.soltar(tx - 1.3, .2, z, 3, { k: 'chispa', cols: ['#d8c49a', '#b8a47a'], vel: 1.2, arriba: 1, vida: .35, esc: .7 }); }
          if (p === c.yo && t - V.motorT > .5) { V.motorT = t; V3.sfx('motor'); }
        }
        for (k = 0; k < 4; k++) car.ruedas[k].rotation.z -= paso / .34;
        if (fk !== s3.fk) {                                    // entra (o sale) un estado: reacción propia de cada motivo
          if (fk >= 1 && now >= 0) {
            s3.colT = t; s3.bTxt = BANF[fk]; V.sigT = t; V.esc.sacudir(p === c.yo ? 1 : .35);
            if (fk === 1) { pj.impacto(-1, 0, 1.7); V3.sfx('error'); V3.sfx('golpe'); V.fpj.uno('lanzar');
              V.part.soltar(tx + 1.1, 1, z, 18, { k: 'gota', cols: ['#5a5866', '#8a8896', '#3a3846'], vel: 1.6, arriba: 1.5, g: -1.2, vida: 1.2, esc: 1.7 });
              V.part.soltar(tx + 1.2, .9, z, 10, { k: 'chispa', cols: ['#ffd23f', '#ff8a3d', '#fffdf2'], vel: 3.5, arriba: 3, vida: .45 }); }
            else if (fk === 2) { pj.impacto(1, 0, 1.2); V3.sfx('golpe'); V.part.soltar(tx + .9, .4, z - .7, 10, { k: 'chispa', cols: ['#fffdf2', '#8a8896'], vel: 1.6, arriba: 1.5, vida: .6 }); }
            else if (fk === 3) { pj.impacto(-1, -.25, 2.0); V3.sfx('bocina'); V3.sfx('choque'); s3.cT = t; }
            else if (fk === 4) { var pdz = 0; V3.sfx('choque'); V3.sfx('bocina');
              for (k = 0; k < peds.length; k++) if (Math.abs(pedT(peds[k], p) - now) < 1 && Math.abs(peds[k].x - q.x) < 14) { V.pedsV[k].reac = t; pdz = z - pedZ(peds[k], now); }
              pj.impacto(-.6, pdz > 0 ? 1 : pdz < 0 ? -1 : .6, 1.5); }
            else if (fk === 5) { pj.impacto(-1, 0, 1.4); V3.sfx('error'); V.part.soltar(tx, 3.2, z, 12, { k: 'chispa', cols: ['#ff4d5e', '#fffdf2'], vel: 3, arriba: 2, vida: .5 }); }
            else if (fk === 6) { V3.sfx('resbalon'); }
          }
          s3.fk = fk;
        }
        if (q.pickT !== s3.pkSeen && now >= 0) {               // recogí una caja (solo lo sé yo o la CPU del juez)
          s3.pkSeen = q.pickT; V3.sfx(p === c.yo ? 'moneda' : 'pop'); V.part.soltar(tx + 1.5, 1.5, z, 14, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff8a3d'], vel: 3, arriba: 2.5, vida: .5 });
          if (q.pickK === 0) { s3.turbo = t; s3.pkTxt = '¡BIDÓN +5!'; s3.pkT = t; pj.uno('saltar'); }
        }
        s3.frz = frz;
        var gris = fk === 1; if (gris !== s3.gris) { s3.gris = gris; car.chasis.material = V3.toon(gris ? '#8c8c96' : car.col); }
        if (frz) { s3.humo -= dt; if (s3.humo < 0) { s3.humo = .14; V.part.soltar(tx + 1.1, 1.1, z, 1, { k: 'gota', cols: ['#6a6876', '#9a98a6'], vel: .4, arriba: .6, g: -1.5, vida: 1, esc: 1.5 }); } }
        if (t - (s3.turbo || -9) < .9) { V.part.soltar(tx - 1.4, .6, z, 2, { k: 'chispa', cols: ['#ffd23f', '#ff8a3d', '#ff4d5e'], vel: 2.4, arriba: .6, vida: .35 }); }
        if (q.tl > 0 && !s3.tl) {                              // ¡LLENÓ EL TANQUE!
          s3.tl = 1; s3.llT = t; pj.uno('festejo'); V.surt[p].flash = 1.5;
          V.part.soltar(X1 + 2.5, 2.8, z, 40, { k: 'confeti', cols: ['#ffd23f', '#3fb0ff', '#ff5c8a', '#5cff7a', '#fffdf2'], vel: 4, arriba: 6, g: 4, vida: 2.2 });
          V3.sfx('ding'); if (p === primero()) V3.sfx('aplauso'); V.esc.sacudir(.4);
        }
        var sf = V.surt[p]; sf.flash = Math.max(0, sf.flash - dt);
        sf.pant.material.emissiveIntensity = (PAL3[lv].noche ? 1.2 : .25) + (sf.flash > 0 ? 1.5 * Math.abs(Math.sin(t * 14)) : 0);
        /* el carro: rebote al empujar, temblor calado, ruedas aplastadas con los clavos, derrape en el aceite */
        s3.vb = Math.max(0, s3.vb - dt * 5);
        car.g.position.set(tx, 0, z);
        car.g.rotation.y = fk === 6 ? Math.sin(t * 13 + p) * .4 : 0;
        car.g.scale.x = t - (s3.turbo || -9) < .5 ? 1.1 : 1;
        car.cuerpo.position.y = s3.vb * .12 + (frz ? Math.abs(Math.sin(t * 30)) * .05 : 0) + (fk === 2 ? -.12 : 0);
        car.cuerpo.rotation.z = frz ? Math.sin(t * 34 + p) * .04 : -s3.vb * .05;
        car.cuerpo.rotation.x = fk === 2 ? .09 : 0;
        car.ruedas[0].scale.set(fk === 2 ? .7 : 1, fk === 2 ? .7 : 1, 1);
        var ace = V.aceiteM[p]; ace.visible = !!(fk === 6); ace.position.set(tx, .035, z); ace.rotation.y = t;
        var col3 = V.colaosM[p], cu = t - col3.t, cv = V.colaosM[p].c;
        if (s3.cT && t - s3.cT < 1.7) { var uu = Math.min(1, (t - s3.cT) / .3); cv.g.visible = true; cv.g.position.set(tx + 3.2, 0, z + 3.2 * (1 - uu) - Math.max(0, t - s3.cT - 1.1) * 8); cv.g.rotation.y = -.5 * (1 - uu); }
        else cv.g.visible = false;
        /* el conductor-empujador: anticipa, reacciona a cada motivo, y mira al peligro */
        var look = est.s === 'aviso' || est.s === 'rojo' ? 1 : 0;
        var mt = look === 1 ? { x: 0, y: 2, z: ZF } : null;
        for (k = 0; k < peds.length; k++) { var pzz = pedZ(peds[k], now); if (now > peds[k].t0 - 2.8 && now < peds[k].t0 + n * PW && Math.abs(peds[k].x - q.x) < 25) mt = { x: CX(peds[k].x), y: 1.5, z: pzz }; }
        if (fin) pj.anim(p === w ? 'celebrar' : 'triste').cara(p === w ? 'feliz' : 'triste');
        else if (q.tl > 0) pj.anim('aplaudir').cara('feliz');
        else if (fk === 2) pj.anim('agacharse').cara('triste');
        else if (fk === 3) pj.anim('gritar').cara('enojado');
        else if (fk === 4) pj.anim('quieto').cara('susto');
        else if (fk === 5) pj.anim('mareado').cara('enojado');
        else if (fk === 1) pj.anim('mareado').cara('mareado');
        else if (fk === 6) pj.anim('aire').cara('susto');
        else if (v > .4) pj.anim('empujar', { vel: Math.min(1, v / 6) }).cara(est.s === 'aviso' ? 'susto' : 'concentrado');
        else pj.anim('quieto').cara(est.s === 'rojo' || est.s === 'aviso' ? 'susto' : 'normal');
        if (mt && !fin && q.tl <= 0) pj.mirarA(mt); else pj.mirar(0, 0);
        pj.rumbo(q.tl > 0 || fin ? 0 : Math.PI / 2).update(dt);
        var sq = s3.vb * .05 + (frz ? Math.sin(t * 30) * .015 : 0);
        pj.g.scale.set(s3.sc * (1 + sq * .5), s3.sc * (1 - sq), s3.sc * (1 + sq * .5));
        pj.g.position.set(tx - 1.95, 0, z);
        if (fin && p === w) { V.confT -= dt; if (V.confT < 0) { V.confT = .2; V.part.soltar(tx - 1.95, 4, z, 3, { k: 'confeti', cols: ['#ffd23f', '#ff5c8a', '#3fb0ff', '#5cff7a'], vel: 1.5, arriba: 1, g: 3, vida: 2 }); } }
      }
      /* las cajas sorpresa: giran y flotan en cada carril; al cruzarlas estallan */
      for (p = 0; p < n; p++) for (k = 0; k < cajas.length; k++) {
        var cb = V.cajasM[p][k], vs = P[p].mx < cajas[k].x;
        if (!vs && cb.vis && now > 0) V.part.soltar(CX(cajas[k].x), 1.3, LZp(p), 8, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 2, arriba: 2, vida: .5 });
        cb.vis = vs; cb.m.visible = !!vs; cb.m.rotation.y = t * 2 + k; cb.m.position.y = 1.3 + Math.sin(t * 3 + k + p) * .15;
      }
      /* la gente de la estación */
      for (k = 0; k < V.gente.length; k++) {
        var gg = V.gente[k], gp = gg.pj;
        if (gg.tipo === 'vend') {
          var gx = 9 + Math.sin(t * .25) * 5, rd = Math.cos(t * .25) > 0 ? Math.PI / 2 : -Math.PI / 2;
          gp.anim('caminar', { vel: .5 }).cara('feliz').rumbo(rd).update(dt); gp.g.position.set(gx, 0, gg.z);
        } else {
          var react = t - V.sigT < 1.3 && now > 0;
          if (fin) gp.anim(k % 2 ? 'aplaudir' : 'celebrar').cara('feliz');
          else if (react) gp.anim(k % 2 ? 'aplaudir' : 'celebrar').cara('feliz');
          else if (est.s === 'rojo') gp.anim('quieto').cara('susto');
          else gp.anim(k % 3 === 1 ? 'bailar' : k % 3 === 2 ? 'saludar' : 'quieto').cara('normal');
          gp.mirar(0, 0).rumbo(0).update(dt);
        }
      }
      /* la cola de atrás toca corneta de vez en cuando (y todos juntos cuando el fiscal se voltea) y echa humito */
      V.humoQ -= dt;
      for (k = 0; k < V.cola.length; k++) { var cq = V.cola[k];
        if (now >= 0 && !fin && est.s === 'verde' && t > cq.prox) { cq.prox = t + 5 + c.fx() * 7; cq.pito = t; if (t - V.pitoT > 4) { V.pitoT = t; V3.sfx('bocina'); } }
        var ag = t - cq.pito; cq.c.cuerpo.position.y = ag < .5 ? Math.abs(Math.sin(ag * 25)) * .1 : Math.abs(Math.sin(t * 2 + k)) * .015;
        if (V.humoQ < 0) { var cp = cq.c.g.position; V.part.soltar(cp.x - 1.5, .5, cp.z, 1, { k: 'gota', cols: ['#9a98a6', '#c8c6d2'], vel: .3, arriba: .7, g: -1, vida: 1, esc: 1 }); } }
      if (V.humoQ < 0) V.humoQ = .35;
      var yo = c.yo >= 0 && c.yo < n ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo; if (yo) V.flecha.position.set(yo.x - 1.95, 3.9 + Math.abs(Math.sin(t * 4)) * .3, LZp(c.yo));
    }
    function pitar(m) {                                        // m carros de la cola tocan corneta a la vez
      for (var k = 0; k < v3.cola.length && m > 0; k++) if (absT - v3.cola[k].pito > 1) { v3.cola[k].pito = absT; m--; }
    }
    function dibujar3D() {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p, k; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && !finJuego(now)) V3.musica('cola');
      v3.esc.render(dt);
      var G = geo(), est = fiscal(now), t = absT;
      /* el aviso grande: la regla en una palabra */
      var yq = c.yo >= 0 && c.yo < n ? P[c.yo] : null;
      var msg = now < 1.6 ? '¡DALE, TOCA!' : est.s === 'rojo' ? '¡QUIETO!' : est.s === 'aviso' ? '¡OJO! ¡SE VOLTEA!' : yq && yq.fk === 6 ? '¡ACEITE! ¡CUESTA AVANZAR!' : '¡AVANZA!';
      var mc = est.s === 'rojo' ? '#ff4d5e' : est.s === 'aviso' ? '#ffd23f' : '#5cff7a';
      if (finJuego(now) && now > 0) { msg = '¡TANQUE LLENO!'; mc = '#ffd23f'; }
      txt(msg, G.cx, 100 + (est.s === 'rojo' ? Math.sin(t * 30) * 2 : 0), 26, mc, 0, true);
      if (now < 4 && !c.practica) { txt('A = EMPUJA · ¡NO CUANDO EL FISCAL TE MIRE!', G.cx, 126, 13, '#fffdf2', 0, true); txt('Recoge las ? · ¡ojo con los peatones!', G.cx, 143, 12, '#ffd23f', 0, true); }
      /* el fiscal: globito cuando te mira o denuncia, «¡!» cuando se va a voltear */
      var pf = v3.esc.proyectar(0, 4.3, ZF), den = absT - v3.denT < 1.4 && v3.denA >= 0;
      if (est.s === 'rojo' || den) {
        var f = den && est.s !== 'rojo' ? '¡TÚ! ¡A LA COLA, PUES!' : FRASES[frases[est.i] % FRASES.length], sp = f.indexOf(' ', f.length / 2 - 3), a1 = f.slice(0, sp < 0 ? f.length : sp), a2 = sp < 0 ? '' : f.slice(sp + 1);
        var bw = 156, bx0 = Math.min(G.x1 - 6 - bw, pf.x + 26), by = Math.max(150, pf.y - 6);
        rr(bx0, by - 20, bw, 40, 10, '#fffdf2', 3.5);
        poly([[bx0 + 1, by - 6], [bx0 + 1, by + 6], [bx0 - 12, by + 2]], '#fffdf2', 3);
        txt(a1, bx0 + bw / 2, by - 8, 11, '#c4283a', 0, true); txt(a2, bx0 + bw / 2, by + 8, 11, '#c4283a', 0, true);
      } else if (est.s === 'aviso') txt('¡!', pf.x + 24, Math.max(150, pf.y - 6), 24, '#ffd23f', 0, true);
      /* peatones en camino: aviso sobre la cebra */
      for (k = 0; k < peds.length; k++) { var pd = peds[k];
        if (now > pd.t0 - 3.1 && now < pd.t0 - .2) { var pe = v3.esc.proyectar(CX(pd.x), 3.2 + Math.abs(Math.sin(t * 6)) * .2, pd.dir > 0 ? LZp(0) - 1.5 * LZ : LZp(n - 1) + 1.5 * LZ); txt('¡PEATÓN!', pe.x, pe.y, 12, '#ffd23f', 0, true); } }
      /* por carro: nombre y tanque; avisos de cada golpe, de tanque lleno y de lo que recoge o lanza */
      for (p = 0; p < n; p++) {
        var s3 = v3.pjs[p], z = LZp(p), pt = v3.esc.proyectar(s3.x - .6, 3.6, z), q = P[p];
        txt(p === c.yo ? 'TÚ' : String((c.seats[p] || {}).name || '').slice(0, 7), pt.x, pt.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        txt(Math.round(q.dx) + '%', pt.x, pt.y + 14, 11, q.tl > 0 ? '#5cff7a' : '#fffdf2', 0, true);
        if (t - s3.colT < 1.1 && s3.bTxt) { var pc = v3.esc.proyectar(s3.x + .5, 2.6, z), bx2 = Math.min(G.x1 - 54, Math.max(G.x0 + 54, pc.x)), yy = pc.y - 6 - (t - s3.colT) * 14;
          rr(bx2 - 50, yy - 10, 100, 20, 6, '#ff4d5e', 3); txt(s3.bTxt, bx2, yy, 12, '#fff', 0, true); }
        else if (t - (s3.pkT || -9) < 1 && s3.pkTxt) { var pk2 = v3.esc.proyectar(s3.x, 3.2, z); txt(s3.pkTxt, pk2.x, pk2.y - 22 - (t - s3.pkT) * 16, 12, '#ffd23f', 0, true); }
        if (q.tl > 0 && t - s3.llT < 1.8) { var pl2 = v3.esc.proyectar(X1 + 1, 3.4, z); txt('¡LLENÓ EL TANQUE!', Math.min(G.x1 - 80, Math.max(G.x0 + 80, pl2.x)), pl2.y - (t - s3.llT) * 10, 13, '#fffdf2', 0, true); }
      }
      for (k = 0; k < v3.cola.length; k++) { var ag = t - v3.cola[k].pito; if (ag < .7) { var cg = v3.cola[k].c.g.position, pp = v3.esc.proyectar(cg.x, 2.4, cg.z); txt('¡PIII!', pp.x, pp.y - ag * 16, 11, '#ffd23f', 0, true); } }
    }

    var g = {
      update: function (dt) {
        var gt = c.ahora(), p;
        absT += dt;
        for (p = 0; p < n; p++) updJugador(p, gt, dt);
        if (seenAt < 0) for (p = 0; p < n; p++) if (P[p].tl > 0) { seenAt = gt; break; }
        var est = fiscal(gt).s;
        if (est !== lastEst) { if (!v3 && gt >= 0 && est === 'aviso') SND(1500, 0.12, 'square', 0.04); if (!v3 && gt >= 0 && est === 'rojo') SND(1900, 0.3, 'square', 0.05); lastEst = est; }   // en 3D suenan los V3.sfx
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D();
        dibujar2D();
      },
      ai: function (p, dt, api) {
        var gt = c.ahora(), q = P[p], I = cs[p], sk = c.skill[p], r = cpuR[p];
        if (gt < 0 || q.tl > 0 || q.fz) return;
        var bloq = false, k;
        for (k = 0; k < evs.length; k++) {
          var e = evs[k];
          if (e.a > gt) break;
          var fin = e.fake ? e.r0 + 0.3 : e.r1;
          if (gt > fin + 1) continue;
          var w = I.win[k];
          if (!w) {                               // cuándo se entera, cuándo se atreve a volver y si se distrae (sale de rngFor del juez)
            var rd = (0.45 - 0.2 * sk) * (0.85 + 0.3 * r.next());
            w = I.win[k] = { stop: e.a + rd, res: (e.fake ? e.r0 + (1 - sk) * 0.45 : e.r1 + 0.12 + 0.2 * r.next() * (1.3 - sk)), miss: r.next() < 0.07 * (1 - sk) };
          }
          if (!w.miss && gt >= w.stop && gt < w.res) bloq = true;
        }
        for (k = 0; k < peds.length && !bloq; k++) {   // el peatón de la cebra: frena justo antes de la zona de choque si hay tiempo (a veces no lo ve)
          var pd = peds[k], tl = pedT(pd, p);
          if (gt > tl - 1.3 && gt < tl + 0.35 && q.x > pd.x - 16 && q.x < pd.x - 6) {
            if (I.pm[k] === undefined) I.pm[k] = r.next() < 0.12 * (1 - sk);
            if (!I.pm[k]) bloq = true;
          }
        }
        if (bloq || gt < I.nextT) return;
        api.press('a');
        I.nextT = gt + (1 / (3 + 5 * sk)) * (0.7 + 0.6 * r.next());
      },
      scores: function () {
        var out = [], p, w = primero();
        for (p = 0; p < n; p++) out.push(Math.round(Math.max(0, Math.min(100, P[p].x))) + (p === w ? 25 : 0));
        return out;
      },
      cuerpo: function (p) { var q = P[p]; return { x: Math.round(q.x * 100), fz: q.fz ? (q.fk || 1) : (q.fk === 6 ? 6 : 0), tl: q.tl, sb: q.sb }; },
      done: function () { return seenAt >= 0 && c.ahora() - seenAt >= 0.3; },
      vivo: function (p) { return true; },
      alRemoto: function (p, o, t) {
        var q = P[p];
        if (!o) return;
        q.x = Math.max(0, Math.min(100, (o.x || 0) / 100)); q.fk = (o.fz | 0) > 6 ? 1 : (o.fz | 0); q.fz = q.fk >= 1 && q.fk <= 5 ? 1 : 0;
        if (q.x > q.mx) q.mx = q.x;
        if (o.tl > 0 && !q.tl) { q.tl = o.tl; q.llegoAt = c.ahora(); }
        if (o.sb > 0) recibeSb(p, o.sb);
      },
      alCpu: function (p) { P[p].own = false; },
      alHum: function (p, o) { P[p].own = false; if (o) g.alRemoto(p, o, 0); },
      onEv: function () {},
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0], w = primero();
        if (!q) return '';
        if (w === (c.yo >= 0 ? c.yo : 0)) return q.cn ? 'llenó primero con ' + q.cn + ' colada' + (q.cn > 1 ? 's' : '') : 'llenó primero sin una sola colada';
        return q.cn ? 'lo pillaron ' + q.cn + ' vez' + (q.cn > 1 ? 'ces' : '') : 'no lo pilló el fiscal ni una vez';
      },
      vista: function () {
        var gt = c.ahora(), h = 7, j;
        for (j = 0; j < evs.length; j++) h = (Math.imul(h ^ Math.round(evs[j].r0 * 1000) ^ (evs[j].fake ? 77 : 0), 16777619) >>> 0);
        return { gt: gt, lv: lv, step: STEP, nEv: evs.length, evHash: h, evs: evs.map(function (e) { return { a: e.a, r0: e.r0, r1: e.r1, fake: e.fake }; }),
          est: fiscal(gt).s, x: P.map(function (q) { return q.x; }), tl: P.map(function (q) { return q.tl; }), fz: P.map(function (q) { return q.fz; }), cn: P.map(function (q) { return q.cn; }), hits: P.map(function (q) { return q.hits; }), cajas: P.map(function (q) { return q.cajas; }),
          fk: P.map(function (q) { return q.fk; }), peds: peds.map(function (d) { return { t0: d.t0, x: d.x, dir: d.dir }; }), caj: cajas.map(function (d) { return { x: d.x, k: d.k }; }), primero: primero() };
      }
    };
    return g;
  }
});
})();
