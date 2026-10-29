'use strict';
/* LA FIESTA · EN VIVO · f_bombillo · ¡SE VA LA LUZ!  (FFA, supervivencia, modelo B: dueño + juez)
   Una cuadra de noche, en pleno apagón. El piso es de 7×5 baldosas y cada una es un bombillo. Cada ronda sale de c.rng en mk (idéntica en todas las pantallas):
   TITILA toda la cuadra (0,55 -> 0,3 s, suspenso) -> se APAGAN las condenadas y las que se quedan brillan con halo -> 1,5 s después las apagadas CAEN (hueco, 1 s) -> vuelve la luz.
   Telegrafía: 1,5 s a oscuras (+ el titileo). La luz se MUDA: las prendidas de una ronda nunca tocan (ni en diagonal) a las de la anterior, así que siempre hay que correr.
   Ritmo que aprieta: menos baldosas prendidas (Nv1 9->4, Nv2 7->3, Nv3 5->2), menos pausa, los últimos 12 s «¡SE VA TODO!» (una menos) y la última ronda «¡UN SOLO BOMBILLO!».
   Nv3: cada tercera ronda es de DON CORTE: apaga en espiral desde el borde (una baldosa cada 0,08 s, cada una cae 1,5 s después de apagarse) y solo quedan las 3 del centro.
   Empujado = tambalea sin control hasta que frena (STUN): el empujón decide las peleas por la última baldosa.
   Cada dueño juzga SU caída (la víctima juzga): pisando un hueco y sin estar en el aire -> c.out(p, kk). Si estaba parado ahí al abrirse, kk = tick de la apertura
   (determinista: todos los que caen juntos empatan); si entró después (caminando, aterrizando o empujado), kk = tick de su propio instante (va en el ev).
   A = saltico (0,42 s en el aire: cruza un hueco y empuja al aterrizar). El EMPUJÓN lo juzga la víctima: ve aterrizar a otro (local o por el campo `h` de su cuerpo)
   a menos de SHOVE de ella y se aplica el empujón a sí misma. La primera ronda nunca deja prendidas las baldosas de salida: el que no se mueve, cae (un ocioso nunca gana).
   Puntaje: eliminado = tick de la caída; vivo = dur*30+1 (mismo contrato que f_chancla/f_bombita). done() = quedan <=1 vivos.
   Cuerpo en red (o): x, y (piso lógico 560x270), h (en el aire), st (fuera), sc, it (1 = carga VELA, 2 = carga LINTERNA), pk (id+1 del último corotico que agarró).
   Sin Math.random/Date.now: azar de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético usa absT.

   LA LOCURA (todo sale de c.rng en mk, igual en todas las pantallas; cada dueño juzga lo suyo):
   · TRES FASES por c.ahora()/dur: CALMA (<35 %), «¡SE PONE FEO!» (35-72 %: subidones, la planta, el perro) y «¡ÚLTIMOS SEGUNDOS!» (>=72 %: una prendida menos,
     casi sin pausa, más subidones y dos perros, más coroticos, luz roja de alarma y música más rápida).
   · ¡SUBIDÓN!: una (o dos) de las que se quedaron prendidas se recalienta (blanca y zumbando) HOTA s después de la revelación, revienta HOTP s después y cae
     DROP s después de recalentarse: el que estaba ahí tiene que cambiarse de bombillo a mitad de ronda (siempre quedan >=2 prendidas).
   · ¡LA PLANTA DEL VECINO!: una baldosa apagada de la fila de la ventana se vuelve a prender RESCA s después con la extensión del vecino (no cae): premio al que mira.
   · ¡SE SOLTÓ EL PERRO!: aviso PAVISO s (ladra en el borde y el carril se pone rojo) y cruza una fila corriendo: al que toca lo manda volando (la víctima juzga
     con la posición del perro, que es pura función del tiempo). El que está en el aire (saltico) no lo toca.
   · COROTICOS sobre una baldosa prendida al revelarse: VELA (si se te abre el hueco, te salva una vez: saltas solo a la prendida más cerca) y LINTERNA (por dos rondas
     ves cuáles se quedan prendidas ANTES del titileo). Lo agarra el dueño que lo pisa primero en su pantalla (pk viaja en el cuerpo); un empujón te APAGA la vela. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_bombillo')) return;

var AW = 560, AH = 270, COLS = 7, ROWS = 5, TW = AW / COLS, TH = AH / ROWS, NT = COLS * ROWS;
var SPD = 150, HOP = 0.48, HOPV = 1.35, HOPCD = 0.3, SHOVE = 42, KB = 560, STUN = 140, SEP = 22, DROP = 1.5, HOLD = 1.0, RISE = 0.3, SPIR = 0.08, GRACE = 5;
var HOTA = 0.35, HOTP = 0.8, RESCA = 0.55, PAVISO = 0.9, PRX = 24, PRY = 22, TOMA = 26, SALVA = 2.6;
var INK = '#14101c';
var PAL = {
  1: { cielo: '#3a2f6a', cielo2: '#5a3f7a', edif: '#2a2648', edif2: '#221f3c', calle: '#2c2a3e', luna: 1 },
  2: { cielo: '#1c1c44', cielo2: '#2a2756', edif: '#1e1d38', edif2: '#18172e', calle: '#232234', luna: 1 },
  3: { cielo: '#0c0b20', cielo2: '#16142e', edif: '#141328', edif2: '#0f0e20', calle: '#1a1928', luna: 0 }
};
var REGLA = 'A: SALTICO (EMPUJA · BRINCA AL PERRO) · VELA TE SALVA · LINTERNA: VES ANTES';
var LUZ = '#ffd86a', LUZ2 = '#fff3a0', OSC = '#2a2d4a', OSC2 = '#1f2138', HUECO = '#07060c';
var SALIDA = [[1, 2], [5, 2], [3, 1], [3, 3]];           // baldosas de salida (col, fila) de los asientos 0..3
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function tileDe(x, y) { return cl(Math.floor(y / TH), 0, ROWS - 1) * COLS + cl(Math.floor(x / TW), 0, COLS - 1); }
/* ¿k es (o toca, si d=1) una baldosa marcada en m? para que la luz se MUDE de una ronda a la otra */
function cerca(m, k, d) { var c0 = k % COLS, r0 = Math.floor(k / COLS), a, b; for (a = -d; a <= d; a++) for (b = -d; b <= d; b++) { var cc = c0 + a, rw = r0 + b; if (cc >= 0 && cc < COLS && rw >= 0 && rw < ROWS && m[rw * COLS + cc]) return true; } return false; }
function centro(k) { return { x: (k % COLS + 0.5) * TW, y: (Math.floor(k / COLS) + 0.5) * TH }; }
/* espiral de 7×5 desde la esquina de arriba a la izquierda, en sentido horario: termina en las 3 del centro de la fila 2 */
function espiral() {
  var out = [], t = 0, b = ROWS - 1, l = 0, r = COLS - 1, i;
  while (t <= b && l <= r) {
    for (i = l; i <= r; i++) out.push(t * COLS + i); t++;
    for (i = t; i <= b; i++) out.push(i * COLS + r); r--;
    if (t <= b) { for (i = r; i >= l; i--) out.push(b * COLS + i); b--; }
    if (l <= r) { for (i = b; i >= t; i--) out.push(i * COLS + l); l++; }
  }
  return out;
}

FIESTA.LIVE.add('f_bombillo', {
  name: '¡SE VA LA LUZ!', modos: ['ffa'], clase: 'survival', modelo: 'B', dur: 45,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
  cuerpo: ['x', 'y', 'h', 'st', 'sc', 'it', 'pk'], discretos: ['h', 'st', 'sc', 'it', 'pk'],
  carta: {
    obj: 'Párate en un bombillo que se quede prendido. Los que se apagan, ¡se caen! Ojo con los subidones y el perro.',
    gana: 'El último en pie. Si quedan varios, empatan arriba.',
    como: { tactil: 'Joystick para moverte · A para un saltico (cruza huecos, empuja y brinca al perro)', teclado: 'WASD o flechas · ESPACIO' },
    roles: null,
    demos: [
      { id: 'mover', txt: 'Corre a una baldosa con halo: las que parpadean caen 1,5 s después de apagarse. Si la tuya se pone BLANCA, ¡revienta: cámbiate!' },
      { id: 'saltar', txt: 'A: saltico. Cruza un hueco, empuja al de al lado (le apagas la vela) o brinca al perro' },
      { id: 'corotos', txt: 'VELA: te salva de una caída · LINTERNA: ves antes cuáles se quedan prendidas' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], rng = c.rng, i, k;
    var lead = Math.min(2.6, 0.2 * dur);
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };

    /* ───── el mundo: las rondas de apagón, idénticas en todos (solo c.rng, solo aquí) ───── */
    var ESP = espiral(), salida = {}, rondas = [], t = lead, r = 0;
    for (i = 0; i < SALIDA.length; i++) salida[SALIDA[i][1] * COLS + SALIDA[i][0]] = 1;
    var base = [9, 7, 5][lv - 1], fin = [4, 3, 2][lv - 1], prev = null, F2 = 0.35 * dur, F3 = 0.72 * dur;
    function faseJ(now) { return now >= F3 ? 3 : now >= F2 ? 2 : 1; }
    while (true) {
      var u = Math.min(1, t / dur), fz = faseJ(t), tarde = fz === 3, flick = 0.55 - 0.25 * u, spir = lv >= 3 && r % 3 === 2, R = { i: r, S: t, spir: spir, safe: [], off: [], drop: [], hot: [], resc: -1, rescT: 0, W: 0, Tback: 0 }, lastDrop = 0;
      var rev = spir ? t : t + flick;
      for (k = 0; k < NT; k++) { R.safe.push(0); R.off.push(0); R.drop.push(0); R.hot.push(0); }
      if (spir) {
        var fx = rng.next() < 0.5, fy = rng.next() < 0.5, idx = 0;
        for (i = 0; i < NT - 3; i++) {
          var kk0 = ESP[i], col = kk0 % COLS, row = Math.floor(kk0 / COLS);
          if (fx) col = COLS - 1 - col; if (fy) row = ROWS - 1 - row;
          var kk = row * COLS + col; R.off[kk] = t + flick + idx * SPIR; R.drop[kk] = R.off[kk] + DROP; idx++;
          if (R.drop[kk] > lastDrop) lastDrop = R.drop[kk];
        }
        for (i = NT - 3; i < NT; i++) R.safe[ESP[i]] = 1;
      } else {
        var nS = Math.max(2, Math.round(base - (base - fin) * u) - (tarde ? 1 : 0)), libres = [], pat = rng.next();
        for (k = 0; k < NT; k++) if (!(r === 0 && salida[k]) && !(prev && cerca(prev, k, 1))) libres.push(k);
        if (libres.length < nS + 2) { libres = []; for (k = 0; k < NT; k++) if (!(r === 0 && salida[k]) && !(prev && prev[k])) libres.push(k); }
        if (pat < 0.22 && nS >= 4) {                         // un tramo de una fila (la cuadra con el cable bueno), solo en baldosas libres
          var len = Math.min(COLS, nS), fila = Math.floor(rng.next() * ROWS), x0 = Math.floor(rng.next() * (COLS - len + 1)), puestos = 0, okL = {};
          for (i = 0; i < libres.length; i++) okL[libres[i]] = 1;
          for (i = 0; i < len; i++) { var kf = fila * COLS + x0 + i; if (okL[kf]) { R.safe[kf] = 1; puestos++; } }
          while (puestos < len) { var kx = libres[Math.floor(rng.next() * libres.length)]; if (!R.safe[kx]) { R.safe[kx] = 1; puestos++; } }
        } else {
          for (i = 0; i < nS && libres.length; i++) { var j = Math.floor(rng.next() * libres.length); R.safe[libres[j]] = 1; libres.splice(j, 1); }
        }
        for (k = 0; k < NT; k++) if (!R.safe[k]) { R.off[k] = t + flick; R.drop[k] = t + flick + DROP; lastDrop = t + flick + DROP; }
        /* ¡SUBIDÓN! (fase 2-3): una o dos prendidas se recalientan, revientan y caen DROP s después del aviso; siempre quedan >=2 prendidas */
        var sg = []; for (k = 0; k < NT; k++) if (R.safe[k]) sg.push(k);
        if (r > 0 && fz >= 2 && rng.next() < (fz === 3 ? 0.6 : 0.4)) {
          var nB = fz === 3 && sg.length >= 5 ? 2 : 1;
          for (i = 0; i < nB && sg.length >= 3; i++) {
            var jb = Math.floor(rng.next() * sg.length), kb = sg[jb], th = rev + HOTA + i * 0.3; sg.splice(jb, 1);
            R.safe[kb] = 0; R.hot[kb] = th; R.off[kb] = th + HOTP; R.drop[kb] = th + DROP; if (R.drop[kb] > lastDrop) lastDrop = R.drop[kb];
          }
        }
        /* ¡LA PLANTA DEL VECINO! (fase 2-3): una apagada de la fila de la ventana se vuelve a prender con la extensión y no cae */
        if (r > 0 && fz >= 2 && rng.next() < (fz === 3 ? 0.35 : 0.3)) {
          var cand = []; for (k = 0; k < COLS; k++) if (!R.safe[k] && !R.hot[k] && !(prev && prev[k])) cand.push(k);
          if (cand.length) { var kr = cand[Math.floor(rng.next() * cand.length)]; R.safe[kr] = 1; R.off[kr] = 0; R.drop[kr] = 0; R.resc = kr; R.rescT = rev + RESCA; }
        }
      }
      if (lastDrop > dur - 0.2) break;
      R.W = t; R.rev = rev; R.Tback = lastDrop + HOLD; R.flick = flick; prev = R.safe;
      rondas.push(R);
      t = R.Tback + RISE + (tarde ? 0.35 : 1.1 - 0.6 * u);
      r++;
    }
    /* la última ronda (si no es de Don Corte): «¡UN SOLO BOMBILLO!», se queda una sola prendida */
    var ult = rondas[rondas.length - 1];
    if (ult && !ult.spir && rondas.length > 2) {
      var vs = [], vs2 = []; for (k = 0; k < NT; k++) if (ult.safe[k]) { vs.push(k); if (k !== ult.resc) vs2.push(k); }
      if (!vs2.length) vs2 = vs;
      var keep = vs2[Math.floor(rng.next() * vs2.length)];
      for (k = 0; k < vs.length; k++) if (vs[k] !== keep) { ult.safe[vs[k]] = 0; ult.off[vs[k]] = ult.rev; ult.drop[vs[k]] = ult.rev + DROP; }
      if (ult.resc !== keep) ult.resc = -1;
      ult.uno = 1;
    } else if (ult && ult.spir && rondas.length > 2) {     // Don Corte remata: sigue la espiral y deja solo el bombillo del medio
      var tl = 0; for (k = 0; k < NT; k++) if (!ult.safe[k] && ult.off[k] > tl) tl = ult.off[k];
      for (i = NT - 3; i < NT - 1; i++) { var kc = ESP[i]; ult.safe[kc] = 0; tl += SPIR; ult.off[kc] = tl; ult.drop[kc] = tl + DROP; }
      ult.Tback = tl + DROP + HOLD; ult.uno = 1;
    }
    for (i = 0; i < rondas.length; i++) { var dm0 = 1e9; for (k = 0; k < NT; k++) if (!rondas[i].safe[k] && rondas[i].drop[k] < dm0) dm0 = rondas[i].drop[k]; rondas[i].dmin = dm0; }
    /* COROTICOS: VELA o LINTERNA sobre una prendida de la ronda (más seguido mientras más tarde). Duran hasta que su baldosa se cae. */
    var ITEMS = [];
    for (i = 1; i < rondas.length - 1; i++) {
      var Ri = rondas[i];
      if (Ri.spir || rng.next() >= [0, 0.3, 0.45, 0.65][faseJ(Ri.S)]) continue;
      var sv = []; for (k = 0; k < NT; k++) if (Ri.safe[k] && k !== Ri.resc) sv.push(k);
      if (!sv.length) continue;
      var ki = sv[Math.floor(rng.next() * sv.length)], t1 = dur;
      for (var j = i + 1; j < rondas.length; j++) if (!rondas[j].safe[ki]) { t1 = rondas[j].drop[ki]; break; }
      ITEMS.push({ id: ITEMS.length, tipo: rng.next() < 0.6 ? 1 : 2, k: ki, t0: Ri.rev, t1: t1, R: i, hasta: rondas[i + 2] ? rondas[i + 2].rev : dur });
    }
    /* EL PERRO DEL VECINO: una pasada en la fase 2 y una o dos en la 3; cruza una fila entera (posición = función del tiempo) */
    var PERROS = [];
    function soltarPerro(a, b, v) {
      var cruza = (AW + 80) / v;
      if (b - a < 0.5) return;
      var t0 = a + rng.next() * (b - a), fila = Math.floor(rng.next() * ROWS), dir = rng.next() < 0.5 ? 1 : -1;
      if (t0 + PAVISO + cruza > dur - 0.2) return;
      PERROS.push({ i: PERROS.length, t0: t0, t1: t0 + PAVISO, t2: t0 + PAVISO + cruza, fila: fila, y: (fila + 0.5) * TH, dir: dir, v: v });
    }
    soltarPerro(F2 + 0.5, F3 - 2.5, 260);
    if (dur - F3 > 7) { var mf = (F3 + dur) / 2; soltarPerro(F3, mf - 2.6, 330); soltarPerro(mf, dur - 3, 360); }
    else soltarPerro(F3, dur - 2.8, 330);
    var hash = 7;
    for (i = 0; i < rondas.length; i++) for (k = 0; k < NT; k++) hash = (Math.imul(hash ^ (rondas[i].safe[k] ? 1 : Math.round(rondas[i].drop[k] * 1000)) ^ k * 131 ^ i * 7919, 16777619)) >>> 0;
    for (i = 0; i < ITEMS.length; i++) hash = (Math.imul(hash ^ (ITEMS[i].k * 3 + ITEMS[i].tipo) ^ Math.round(ITEMS[i].t0 * 1000), 16777619)) >>> 0;
    for (i = 0; i < PERROS.length; i++) hash = (Math.imul(hash ^ (PERROS[i].fila * 2 + (PERROS[i].dir > 0 ? 1 : 0)) ^ Math.round(PERROS[i].t0 * 1000), 16777619)) >>> 0;

    /* ───── estado ───── */
    var P = [], cpuR = [], plan = [];
    for (i = 0; i < n; i++) {
      var sp0 = SALIDA[i % SALIDA.length], cs = centro(sp0[1] * COLS + sp0[0]);
      P.push({ x: cs.x, y: cs.y + 8, h: 0, st: 0, sc: 0, own: false, hopT: -9, hvx: 0, hvy: 0, kvx: 0, kvy: 0, air: false, outSent: 0, outAt: -9, fx: 0, fy: 0, empT: -9, dx: 1,
        it: 0, pk: 0, lintH: 0, perroI: -1, salvT: -9, velaT: -9, tumbT: -9, perroT: -9 });
      cpuR.push(c.rngFor('cpu' + i)); plan.push({ r: -1, f: 0, tx: cs.x, ty: cs.y, rt: 0.4 });
    }
    var absT = 0, shake = 0, polvos = [], fxR = {}, banT = 0, banTxt = '', banCol = '#ff5c5c', fzVisto = 1, fxP = {}, fxI = {}, tomado = {};
    /* c.campo() lee root.gameLeft, pero engine.js la declara con const (no cuelga de window) y siempre da 0..800: si las globales existen, se usan directo */
    var cp = function () { var f = c.campo(); if (typeof gameLeft === 'function' && typeof gameRight === 'function') { var l = gameLeft(), r = gameRight(); if (r - l > 100) return { x0: l, x1: r, y0: f.y0, y1: f.y1 }; } return f; };
    function geom() {                                     // en pantalla angosta (360 de ancho) el piso entero se encoge para que se vean las 7 columnas
      var f = cp(), mx = (f.x0 + f.x1) / 2, s = cl((f.x1 - f.x0 - 12) / (AW + 24), 0.5, 1);
      return { ox: mx - AW / 2, oy: 188, s: s, mx: mx };
    }
    function bandera(s, col, dd) { banTxt = s; banCol = col || '#ff5c5c'; banT = dd || 1.6; }
    function aPant(G, x, y) { return { x: G.mx + (G.ox + x - G.mx) * G.s, y: G.oy + y * G.s }; }
    function vivos() { var q = 0, p; for (p = 0; p < n; p++) if (!P[p].st) q++; return q; }
    function aire(q, now) { return now >= q.hopT && now < q.hopT + HOP; }
    function elim(p, kk) { var q = P[p]; if (q.st) return; q.st = 1; q.h = 0; q.sc = Math.max(0, kk | 0); q.outAt = c.ahora(); q.fx = q.x; q.fy = q.y; }
    function rondaEn(now) { for (var a = 0; a < rondas.length; a++) { var R = rondas[a]; if (now >= R.S && now < R.Tback + RISE) return R; if (R.S > now) break; } return null; }
    /* ¿la baldosa k es un hueco en `now`? devuelve la hora en que se abrió, o -1 */
    function hueco(k, now) { var R = rondaEn(now); if (!R || R.safe[k] || now < R.drop[k] || now >= R.Tback) return -1; return R.drop[k]; }
    function sobreHueco(x, y, now) {                       // con un margen de GRACE px: si un pie toca baldosa firme, no cae
      var h0 = hueco(tileDe(x, y), now); if (h0 < 0) return -1;
      if (hueco(tileDe(x - GRACE, y), now) < 0 || hueco(tileDe(x + GRACE, y), now) < 0 || hueco(tileDe(x, y - GRACE), now) < 0 || hueco(tileDe(x, y + GRACE), now) < 0) return -1;
      return h0;
    }
    /* fase visual de una baldosa: 0 luz, 1 halo (segura en aviso), 2 parpadeo, 3 apagada, 4 hueco, 5 subiendo, 6 recalentada (¡subidón!), 7 prendida por la planta */
    function fase(k, now) {
      var R = rondaEn(now); if (!R) return { f: 0, u: 0 };
      if (R.safe[k]) {
        if (k === R.resc && now >= R.rev && now < R.Tback) return now < R.rescT ? { f: 3, u: (now - R.rev) / DROP } : { f: 7, u: 0 };
        return { f: now >= R.Tback ? 0 : now >= R.rev ? 1 : 2, u: 0 };
      }
      var h = R.hot[k];
      if (h) { if (now < R.rev) return { f: 2, u: 0 }; if (now < h) return { f: 1, u: 0 }; if (now < R.off[k]) return { f: 6, u: (now - h) / (R.off[k] - h) }; }
      var w = R.off[k] - R.flick;
      if (now < w) return { f: 0, u: 0 };
      if (now < R.off[k]) return { f: 2, u: (now - w) / R.flick };
      if (now < R.drop[k]) return { f: 3, u: (now - R.off[k]) / (R.drop[k] - R.off[k]) };
      if (now < R.Tback) return { f: 4, u: now - R.drop[k] };
      return { f: 5, u: (now - R.Tback) / RISE };
    }
    /* ¿lo que se ve como prendido en `now`? (la recalentada se ve prendida hasta que se recalienta; la de la planta, apagada hasta que se prende) */
    function seVeSegura(R, k, now) {
      if (R.safe[k]) return !(k === R.resc && now < R.rescT);
      return !!R.hot[k] && now < R.hot[k];
    }
    function proxima(now) { for (var a = 0; a < rondas.length; a++) if (rondas[a].S > now) return rondas[a]; return null; }
    /* la LINTERNA alumbra la ronda que viene: desde que cierran los huecos de la anterior (o 1,6 s antes) hasta que se revela */
    function previa(now) {
      var Rc = rondaEn(now);
      if (Rc && now < Rc.rev) return Rc;
      if (Rc && now < Rc.Tback) return null;
      var Rn = proxima(now); return Rn && Rn.S - now < 1.6 ? Rn : null;
    }
    /* el perro en `now`: null, o { P, x, y, corre } (aviso: ladra quieto en el borde) */
    function perroEn(now) {
      for (var a = 0; a < PERROS.length; a++) {
        var D = PERROS[a]; if (now < D.t0 || now >= D.t2) continue;
        if (now < D.t1) return { P: D, x: D.dir > 0 ? -18 : AW + 18, y: D.y, corre: false };
        var dd = D.v * (now - D.t1); return { P: D, x: D.dir > 0 ? -40 + dd : AW + 40 - dd, y: D.y + Math.sin((now - D.t1) * 9) * 8, corre: true };
      }
      return null;
    }
    function itemVivo(I, now) { return now >= I.t0 && now < I.t1 && !(I.id in tomado); }

    /* ───── movimiento, empujón y caída (cada dueño lo suyo) ───── */
    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        q.own = false;
        var rm = c.remoto(p);
        if (rm) {
          q.x = rm.x; q.y = rm.y; q.h = rm.h ? 1 : 0; if (rm.st && !q.st) elim(p, rm.sc);
          var it2 = rm.it | 0; if ((q.it & 1) && !(it2 & 1) && !q.st) q.velaT = now; q.it = it2;
          if (rm.pk > 0 && !((rm.pk - 1) in tomado)) tomado[rm.pk - 1] = p;
        }
        return;
      }
      q.own = true;
      if (q.st || now < 0) { q.h = 0; return; }
      var e = c.eje(p), ex = e.x || 0, ey = e.y || 0, m = Math.sqrt(ex * ex + ey * ey);
      if (m > 1) { ex /= m; ey /= m; }
      var tumbo = q.kvx * q.kvx + q.kvy * q.kvy > STUN * STUN || now < q.tumbT;          // empujado (o mordisqueado por el perro: 0,7 s fuera de control): tambalea y no controla hasta que frena
      if (tumbo) { ex = 0; ey = 0; }
      if (ex) q.dx = ex > 0 ? 1 : -1;
      var enAire = aire(q, now);
      if (!enAire && c.tap(p, 'a') > 0 && !tumbo && now >= q.hopT + HOP + HOPCD) {
        q.hopT = now; q.hvx = ex * SPD * HOPV; q.hvy = ey * SPD * HOPV; enAire = true;
        if (p === c.yo && !v3) SND(520, 0.08, 'square', 0.04, 260);
      }
      if (enAire) { q.x += q.hvx * dt; q.y += q.hvy * dt; }
      else { q.x += ex * SPD * dt; q.y += ey * SPD * dt; }
      q.x += q.kvx * dt; q.y += q.kvy * dt;
      var fr = Math.exp(-7 * dt); q.kvx *= fr; q.kvy *= fr;
      q.x = cl(q.x, 12, AW - 12); q.y = cl(q.y, 10, AH - 6);
      q.h = enAire ? 1 : 0;
    }
    function separar(p, dt, now) {                        // nadie se encima: cada dueño se corre a sí mismo
      var q = P[p], a;
      if (q.st || aire(q, now)) return;
      for (a = 0; a < n; a++) {
        if (a === p || P[a].st || P[a].h) continue;
        var dx = q.x - P[a].x, dy = (q.y - P[a].y) * 1.3, d = Math.sqrt(dx * dx + dy * dy);
        if (d < SEP) { if (d < 0.01) { dx = p < a ? -1 : 1; dy = 0; d = 1; } var pu = Math.min(SEP - d, 90 * dt); q.x = cl(q.x + dx / d * pu, 12, AW - 12); q.y = cl(q.y + dy / d * pu / 1.3, 10, AH - 6); }
      }
    }
    function aterriza(p, now) {                           // p tocó el piso: empuja a los míos que estén cerca (la víctima juzga)
      var a, q = P[p];
      polvos.push({ x: q.x, y: q.y, t: now });
      for (a = 0; a < n; a++) {
        if (a === p || !c.mio(a) || P[a].st || aire(P[a], now)) continue;
        var v = P[a], dx = v.x - q.x, dy = (v.y - q.y) * 1.2, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= SHOVE) continue;
        if (d < 0.5) { dx = q.dx || 1; dy = 0; d = 1; }
        var f = KB * (1 - 0.45 * d / SHOVE);
        v.kvx = dx / d * f; v.kvy = dy / d * f / 1.2; v.empT = now;
        if (v.it & 1) { v.it &= ~1; v.velaT = now; }          // el empujón te apaga la vela
        if (a === c.yo && !v3) SND(200, 0.12, 'square', 0.05, -60);
      }
    }
    /* el perro: la víctima (dueña) se juzga sola con la posición del perro (función del tiempo). En el aire no lo toca. Una vez por pasada. */
    function perroChoca(p, now) {
      var q = P[p], D = perroEn(now);
      if (!D || !D.corre || q.st || aire(q, now) || q.perroI === D.P.i) return;
      if (Math.abs(D.x - q.x) >= PRX || Math.abs(D.y - q.y) >= PRY) return;
      q.perroI = D.P.i; q.kvx = D.P.dir * KB * 1.35; q.kvy = (q.y >= D.y ? 1 : -1) * KB * 0.45; q.empT = now; q.perroT = now; q.tumbT = now + 0.7; if (q.it & 1) { q.it &= ~1; q.velaT = now; }
      if (p === c.yo && !v3) SND(160, 0.2, 'sawtooth', 0.06, -80);
    }
    /* agarrar un corotico: el dueño que lo pisa (en el piso) primero en su pantalla; pk viaja en el cuerpo y los demás lo dan por tomado */
    function recoger(p, now) {
      var q = P[p], a;
      if (q.st || aire(q, now)) return;
      for (a = 0; a < ITEMS.length; a++) {
        var I = ITEMS[a]; if (!itemVivo(I, now)) continue;
        var ct = centro(I.k); if (Math.abs(ct.x - q.x) >= TOMA || Math.abs(ct.y - q.y) >= TOMA) continue;
        tomado[I.id] = p; q.pk = I.id + 1;
        if (I.tipo === 1) q.it |= 1; else { q.it |= 2; q.lintH = I.hasta; }
        if (p === c.yo) { if (v3) V3.sfx('moneda'); else SND(990, 0.12, 'triangle', 0.05, 300); var pt = sobre(p, 4.6); S(I.tipo === 1 ? '¡VELA! TE SALVA UNA VEZ' : '¡LINTERNA! VES LA PRÓXIMA', pt.x, pt.y, LUZ2); }
      }
    }
    /* la VELA: si se te abre el hueco, saltas solo a la prendida más cerca (se gasta) */
    function salvar(p, now) {
      var q = P[p], R = rondaEn(now), a, bd = 1e9, tx = q.x, ty = q.y, lim = SALVA * TW;
      for (a = 0; a < NT; a++) {
        var ct = centro(a), dd = Math.sqrt((ct.x - q.x) * (ct.x - q.x) + (ct.y - q.y) * (ct.y - q.y));
        if (dd > lim || sobreHueco(ct.x, ct.y, now + HOP + 0.1) >= 0) continue;
        if (R && now < R.Tback && !R.safe[a]) dd += 400;     // mejor una que no se va a caer
        if (dd < bd) { bd = dd; tx = ct.x; ty = ct.y; }
      }
      q.it &= ~1; q.salvT = now; q.hopT = now; q.hvx = (tx - q.x) / HOP; q.hvy = (ty - q.y) / HOP; q.kvx = 0; q.kvy = 0; q.h = 1;
      if (p === c.yo) { if (v3) { V3.sfx('salto'); V3.sfx('ding'); } else SND(700, 0.2, 'triangle', 0.06, 400); var pt = sobre(p, 4.6); S('¡LA VELA TE SALVÓ!', pt.x, pt.y, LUZ2); }
    }
    function caida(p, now) {
      var q = P[p];
      if (q.st || q.outSent || now < 0 || aire(q, now)) return;
      var h0 = sobreHueco(q.x, q.y, now);
      if (h0 < 0) return;
      if (q.it & 1) { salvar(p, now); return; }
      var T = now - h0 < 0.2 ? h0 : now;
      q.outSent = 1;
      c.out(p, Math.floor(T * 30 + 1e-6));
    }

    /* ───── IA: a la baldosa prendida más cercana con 250-500 ms de reacción; se cambia si la suya se recalienta, ve la planta, brinca al perro y busca coroticos ───── */
    function libreEn(x, y, at) { return sobreHueco(cl(x, 12, AW - 12), cl(y, 10, AH - 6), at) < 0; }
    function itemEn(k, now) { for (var a = 0; a < ITEMS.length; a++) if (ITEMS[a].k === k && itemVivo(ITEMS[a], now)) return true; return false; }
    function d2(q, x, y) { return (x - q.x) * (x - q.x) + (y - q.y) * (y - q.y); }
    function apuntar(p, k, er) { var pl = plan[p], ct = centro(k), R2 = cpuR[p]; pl.tx = ct.x + (R2.next() * 2 - 1) * er; pl.ty = ct.y + (R2.next() * 2 - 1) * er * 0.6; pl.k = k; }
    function masCerca(p, R, now, sinK) {                  // la que se ve prendida más cerca (sin las recalentadas)
      var q = P[p], a, bd = 1e9, pick = -1;
      for (a = 0; a < NT; a++) if (a !== sinK && seVeSegura(R, a, now) && !R.hot[a]) { var ct = centro(a), dd = d2(q, ct.x, ct.y); if (dd < bd) { bd = dd; pick = a; } }
      if (pick < 0) for (a = 0; a < NT; a++) if (a !== sinK && R.safe[a]) { var c2 = centro(a), d3 = d2(q, c2.x, c2.y); if (d3 < bd) { bd = d3; pick = a; } }
      return pick;
    }
    function planear(p, R, now, rt, pre) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], a, pick = -1, bd = 1e9, aqui = tileDe(q.x, q.y);
      pl.r = R.i; pl.f = 1; pl.pas = 0; pl.rt = rt + R2.next() * 0.08; pl.hotR = -1; pl.rescR = -1; pl.pre = pre ? R.i : -1;
      if (!pre && !seVeSegura(R, aqui, now) && R2.next() < 0.02 + (1 - sk) * 0.12 + 0.05 * Math.min(1, now / dur) + 0.02 * (lv - 1)) {   // se queda pasmado en su baldosa apagada y tarda en reaccionar
        pick = aqui; pl.f = 2; pl.pas = 1;
        pl.cT = R.spir ? Math.max(now + 0.3, R.off[pick] + 0.4 + R2.next() * 0.3) : Math.max(now + 0.3, R.dmin - 0.45 + R2.next() * 0.25);
      } else {
        for (a = 0; a < NT; a++) {
          if (pre ? !R.safe[a] : !seVeSegura(R, a, now)) continue;   // con linterna ve la verdad
          var cs2 = centro(a), ds = d2(q, cs2.x, cs2.y);
          for (var z = 0; z < n; z++) if (z !== p && !P[z].st && tileDe(P[z].x, P[z].y) === a) ds += 900 * (1 - sk);
          if (itemEn(a, now)) ds -= 1600 + 2400 * sk;
          if (ds < bd) { bd = ds; pick = a; }
        }
      }
      if (pick >= 0) apuntar(p, pick, (1 - sk) * 18);
    }
    function ai(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], R = rondaEn(now), a;
      if (now < 0 || q.st) { api.eje(0, 0); return; }
      var rt = 0.5 - 0.25 * sk;
      if (q.it & 2) { var Rp = previa(now); if (Rp && Rp.i !== pl.r) planear(p, Rp, now, 0.15, true); }   // linterna: se adelanta
      if (R && R.i !== pl.r && now >= R.rev + rt) planear(p, R, now, rt, false);
      if (R && pl.r === R.i && pl.f === 2 && now >= pl.cT) {   // se dio cuenta: corrige a la prendida más cercana
        pl.f = 1; var k2 = masCerca(p, R, now, -1); if (k2 >= 0) apuntar(p, k2, 0);
      }
      if (R && pl.r === R.i && pl.f === 1 && pl.k >= 0 && R.hot[pl.k] && now >= R.hot[pl.k] + pl.rt && pl.hotR !== R.i) {   // ¡subidón en la mía!
        pl.hotR = R.i; var k3 = masCerca(p, R, now, pl.k); if (k3 >= 0) apuntar(p, k3, 0);
      }
      if (R && pl.r === R.i && R.resc >= 0 && now >= R.rescT + pl.rt && pl.rescR !== R.i && pl.k !== R.resc) {   // ¡la planta! si queda mucho más cerca, para allá
        pl.rescR = R.i; var cr = centro(R.resc);
        if (d2(q, cr.x, cr.y) < d2(q, pl.tx, pl.ty) * 0.36 && R2.next() < 0.4 + 0.5 * sk) apuntar(p, R.resc, 0);
      }
      if (!R || now >= R.Tback) {                                // entre rondas: a su sitio cerca del centro, o a buscar un corotico
        var Rn = proxima(now), gk = Rn ? Rn.i : -9;
        if (pl.home !== gk && !(pl.pre >= 0 && pl.r === pl.pre)) {
          pl.home = gk; var ib = -1, ibd = 260 * 260;
          for (a = 0; a < ITEMS.length; a++) if (itemVivo(ITEMS[a], now)) { var ci = centro(ITEMS[a].k), di = d2(q, ci.x, ci.y); if (di < ibd) { ibd = di; ib = ITEMS[a].k; } }
          if (ib >= 0 && R2.next() < 0.3 + 0.6 * sk) apuntar(p, ib, 0);
          else if (gk <= 1) { pl.tx = AW * (0.32 + 0.36 * R2.next()); pl.ty = AH * (0.35 + 0.3 * R2.next()); }
        }
      }
      var dx = pl.tx - q.x, dy = pl.ty - q.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 6) { api.eje(0, 0); }
      else {
        var vx = dx / d, vy = dy / d; api.eje(vx, vy);
        var ahead = libreEn(q.x + vx * 26, q.y + vy * 26, now + 0.12), aqui = libreEn(q.x, q.y, now);
        if (!ahead && aqui && !pl.pas && now >= q.hopT + HOP + HOPCD) {    // hueco adelante: saltico si se aterriza en firme
          var lx = q.x + vx * SPD * HOPV * HOP, ly = q.y + vy * SPD * HOPV * HOP;
          if (libreEn(lx, ly, now + HOP + 0.05)) api.press('a');
        }
      }
      /* el perro viene por mi fila: saltico en el sitio justo antes de que llegue */
      var D = perroEn(now);
      if (D && D.corre && Math.abs(D.y - q.y) < PRY + 8 && !aire(q, now) && now >= q.hopT + HOP + HOPCD) {
        var adel = (q.x - D.x) * D.P.dir;
        if (adel > PRX - 4 && adel < PRX + D.P.v * 0.16) {
          if (pl.perro !== D.P.i) { pl.perro = D.P.i; pl.brinca = R2.next() < 0.3 + 0.6 * sk; }
          if (pl.brinca) { api.eje(0, 0); api.press('a'); return; }
        }
      }
      /* empujón: con suerte y destreza, salta encima de un rival cercano si el aterrizaje es firme (mejor si carga vela: se la apaga) */
      if (R && now >= R.dmin - 0.3 && now < R.Tback && now >= q.hopT + HOP + HOPCD + 0.4 && R2.next() < (R.spir || R.uno ? 0.02 : 0.007) * sk) {
        var vic = -1, vd = 1e9;
        for (a = 0; a < n; a++) { if (a === p || P[a].st) continue; var ax = P[a].x - q.x, ay = P[a].y - q.y, ad = ax * ax + ay * ay - ((P[a].it & 1) ? 1500 : 0); if (ad < vd) { vd = ad; vic = a; } }
        if (vic >= 0) {
          a = vic;
          var rx = P[a].x - q.x, ry = P[a].y - q.y, rd = Math.sqrt(rx * rx + ry * ry);
          if (rd > 20 && rd < 75) {                           // salta para caer justo antes del rival (el stick corto acorta el saltico)
            var mg = cl((rd - 14) / (SPD * HOPV * HOP), 0.2, 1), tx = q.x + rx / rd * mg * SPD * HOPV * HOP, ty = q.y + ry / rd * mg * SPD * HOPV * HOP;
            if (libreEn(tx, ty, now + HOP + 0.3)) { api.eje(rx / rd * mg, ry / rd * mg); api.press('a'); }
          }
        }
      }
    }
    /* ───── dibujo ───── */
    function bombillo(cx, cy, prendido, s) {
      if (prendido) { ctx.save(); ctx.globalAlpha = 0.28; ell(cx, cy - 3, 24 * s, 20 * s, LUZ2, 0); ctx.restore(); }
      ell(cx, cy - 4, 9 * s, 11 * s, prendido ? '#fffbe0' : '#5a5a6e', 2.5);
      rr(cx - 5 * s, cy + 5 * s, 10 * s, 6 * s, 2, prendido ? '#c9c9d6' : '#4a4a58', 2);
      if (prendido) line([[cx - 3 * s, cy - 4 * s], [cx, cy - 8 * s], [cx + 3 * s, cy - 4 * s]], 1.5, '#ffb03a');
    }
    function baldosa(k, G, now) {
      var col = k % COLS, row = Math.floor(k / COLS), x = G.ox + col * TW, y = G.oy + row * TH, cx = x + TW / 2, cy = y + TH / 2, F = fase(k, now), pr;
      if (F.f === 4 || F.f === 5) {                          // hueco: negro con borde de profundidad
        rr(x + 2, y + 2, TW - 4, TH - 4, 4, HUECO, 2.5); rr(x + 6, y + 6, TW - 12, 8, 2, '#1a1730', 0);
        if (F.f === 4 && F.u < 0.4) {                      // la baldosa cayendo
          var ag = F.u / 0.4, s0 = 1 - 0.55 * ag;
          ctx.save(); ctx.globalAlpha = 1 - ag; rr(cx - (TW - 8) * s0 / 2, cy - (TH - 8) * s0 / 2 + ag * 26, (TW - 8) * s0, (TH - 8) * s0, 5, OSC, 3); ctx.restore();
        }
        if (F.f === 5) { var s1 = 0.6 + 0.4 * F.u; rr(cx - (TW - 6) * s1 / 2, cy - (TH - 6) * s1 / 2, (TW - 6) * s1, (TH - 6) * s1, 6, LUZ, 3); }
        return;
      }
      if (F.f === 6) {                                     // ¡subidón!: blanca, zumbando, con rayitos azules
        var zz = Math.sin(absT * 70 + k) * 1.5 * F.u;
        rr(x + 2 + zz, y + 2, TW - 4, TH - 4, 6, '#ffffff', 3); rr(x + 7 + zz, y + 6, TW - 14, TH - 14, 4, '#d8f0ff', 0);
        line([[cx - 16, cy - 8], [cx - 6, cy - 2], [cx - 12, cy + 4], [cx, cy + 10]], 2, '#4aa8ff'); line([[cx + 16, cy - 10], [cx + 8, cy - 2], [cx + 14, cy + 3]], 2, '#4aa8ff');
        bombillo(cx + zz, cy, true, 1 + 0.25 * F.u); return;
      }
      if (F.f === 7) {                                     // prendida por la planta del vecino: verdosa, con su cable
        rr(x + 2, y + 2, TW - 4, TH - 4, 6, '#d8ff8a', 3); rr(x + 7, y + 6, TW - 14, TH - 14, 4, '#efffc0', 0);
        line([[cx, y - 14], [cx + 4, y - 6], [cx, y + 4]], 2.5, '#14101c'); txt('PLANTA', cx, y + TH - 8, 8, '#3a6a1a', 0, true);
        bombillo(cx, cy, true, 1); return;
      }
      pr = F.f === 0 || F.f === 1 || (F.f === 2 && Math.floor(absT * 14 + k) % 2 === 0);
      rr(x + 2, y + 2, TW - 4, TH - 4, 6, pr ? LUZ : (F.f === 3 ? OSC2 : OSC), 3);
      rr(x + 7, y + 6, TW - 14, TH - 14, 4, pr ? '#ffe9a0' : '#33375a', 0);
      if (F.f === 1) {                                     // la que se queda: halo y rayitos
        var pu = 0.5 + 0.5 * Math.abs(Math.sin(absT * 8));
        ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * pu; ell(cx, cy, TW * 0.55, TH * 0.6, '#fff8c0', 0); ctx.restore();
        line([[x + 4, y + 4], [x + 11, y + 10]], 2.5, '#ffffff'); line([[x + TW - 4, y + 4], [x + TW - 11, y + 10]], 2.5, '#ffffff');
      }
      if (F.f === 3) {                                     // apagada: tiembla y se agrieta al final
        var tr = F.u > 0.6 ? Math.sin(absT * 60 + k) * 1.5 : 0;
        line([[cx - 14 + tr, cy + 10], [cx - 4 + tr, cy + 2], [cx + 6 + tr, cy + 12]], 1.5, F.u > 0.6 ? '#ff5c5c' : '#4a4e78');
      }
      bombillo(cx, cy, pr, 1);
    }
    function fondo(f, G, now) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, q;
      rr(x0, 0, w, 200, 0, pal.cielo, 0); rr(x0, 110, w, 90, 0, pal.cielo2, 0);
      for (q = 0; q < 10; q++) ell(x0 + 20 + ((q * 97) % Math.max(40, w - 40)), 18 + (q * 37) % 70, 1.6, 1.6, '#fffdf2', 0);
      if (pal.luna) ell(x0 + w * 0.12, 40, 15, 15, '#fff3c8', 2.5);
      /* la cuadra a oscuras */
      for (q = 0; q < 6; q++) {
        var bx = x0 + q * (w / 6), bh = 70 + (q * 29) % 46, bw = w / 6 - 6;
        rr(bx + 3, 172 - bh, bw, bh + 20, 3, q % 2 ? pal.edif : pal.edif2, 3);
        rr(bx + 12, 182 - bh, 14, 16, 2, '#0d0c18', 2); rr(bx + bw - 22, 182 - bh, 14, 16, 2, '#0d0c18', 2);
      }
      /* la casa del vecino de la planta: la única prendida */
      var vx = x1 - Math.min(150, w * 0.34), vw = Math.min(118, w * 0.28);
      ctx.save(); ctx.globalAlpha = 0.25; ell(vx + vw / 2, 130, vw * 0.9, 50, LUZ2, 0); ctx.restore();
      rr(vx, 96, vw, 84, 3, '#e8a860', 3); poly([[vx - 8, 98], [vx + vw / 2, 70], [vx + vw + 8, 98]], '#a84a3a', 3);
      rr(vx + 10, 110, 24, 22, 2, LUZ, 2.5); rr(vx + vw - 34, 110, 24, 22, 2, LUZ, 2.5);
      var vib = Math.sin(absT * 40) * 1.2;
      rr(vx + vw - 6 + vib, 154, 30, 22, 3, '#c0392b', 3); rr(vx + vw + vib, 158, 10, 6, 1, '#2a2a2a', 0); txt('PLANTA', vx + vw + 9, 148, 8, '#ffd23f', 0, true);
      for (q = 0; q < 3; q++) { var ag = (absT * 0.9 + q / 3) % 1; ctx.save(); ctx.globalAlpha = 0.5 * (1 - ag); ell(vx + vw + 26 + ag * 14, 150 - ag * 40, 4 + ag * 7, 4 + ag * 7, '#8a8a9a', 0); ctx.restore(); }
      /* el poste con el transformador (y Don Corte en Nv3) */
      var px = Math.max(x0 + 36, G.mx - AW * G.s / 2 - 50);
      rr(px - 4, 76, 8, 114, 2, '#5a4a3a', 2.5); rr(px - 26, 82, 52, 6, 2, '#5a4a3a', 2.5); rr(px + 8, 90, 18, 22, 3, '#7a7a8a', 2.5);
      line([[x0, 80], [px - 24, 84], [px + 24, 84], [x1, 76]], 1.5, '#0a0a14');
      var R = rondaEn(now);
      if (lv >= 3 && R && R.spir && now < R.Tback) {
        c.util.pj('tio', px - 2, 92, 44, { animo: 'celebrar', sombra: false }); txt('DON CORTE', px, 132, 9, '#ff8a8a', 0, true);
        if (Math.floor(absT * 10) % 3 === 0) { line([[px + 18, 92], [px + 30, 82], [px + 24, 78], [px + 36, 68]], 2.5, '#fff36a'); }
      }
      /* la acera alrededor del piso */
      rr(x0, G.oy - 16, w, 460, 0, pal.calle, 0);
    }
    function persona(p, x, y, now, hop) {
      var s = asiento(p), col = s.color || '#ffd23f', q = P[p], lift = hop > 0 ? Math.sin(Math.PI * hop) * 26 : 0, emp = now - q.empT < 0.5;
      ell(x, y + 3, 18 - lift * 0.25, 6, INK, 0);
      ctx.save(); ctx.translate(0, -lift);
      rr(x - 11, y - 26, 8, 24, 4, '#2f3a7a', 3); rr(x + 3, y - 26, 8, 24, 4, '#2f3a7a', 3);
      rr(x - 15, y - 62, 30, 38, 10, col, 3.5);
      c.util.pj(s.ch, x, y - 78, 62, { animo: emp ? 'perder' : (hop > 0 ? 'celebrar' : null), sombra: false });
      ctx.restore();
      if (p === c.yo) poly([[x - 8, y - 128 - lift], [x + 8, y - 128 - lift], [x, y - 116 - lift]], '#ffd23f', 3);
      if (q.it & 1) corotico(x - 20, y - 96 - lift, 1, 0.7);
      if (q.it & 2) corotico(x + 20, y - 96 - lift, 2, 0.7);
    }
    function corotico(x, y, tipo, s) {                     // 1 = vela, 2 = linterna
      ctx.save(); ctx.globalAlpha = 0.3; ell(x, y, 16 * s, 16 * s, LUZ2, 0); ctx.restore();
      if (tipo === 1) { rr(x - 4 * s, y - 6 * s, 8 * s, 16 * s, 2, '#fffdf2', 2); ell(x, y - 11 * s, 3.5 * s, 6 * s * (1 + 0.2 * Math.sin(absT * 17)), '#ffb03a', 1.5); }
      else { rr(x - 10 * s, y - 4 * s, 16 * s, 8 * s, 2, '#c0392b', 2); poly([[x + 6 * s, y - 6 * s], [x + 12 * s, y - 9 * s], [x + 12 * s, y + 9 * s], [x + 6 * s, y + 6 * s]], '#8a8a96', 2); ell(x + 12 * s, y, 2.5 * s, 8 * s, '#fff8c0', 0); }
    }
    function perro2D(x, y, dir, corre) {
      var pa = corre ? Math.sin(absT * 30) * 5 : 0, bo = corre ? Math.abs(Math.sin(absT * 30)) * 3 : Math.abs(Math.sin(absT * 12)) * 2;
      ell(x, y + 4, 22, 6, INK, 0);
      line([[x - 12, y - 8], [x - 12 + pa, y + 2]], 3, '#8a5a2a'); line([[x + 10, y - 8], [x + 10 - pa, y + 2]], 3, '#8a5a2a');
      rr(x - 18, y - 22 - bo, 36, 16, 7, '#c08a4a', 2.5);
      line([[x - dir * 18, y - 18 - bo], [x - dir * 28, y - 28 - bo + pa]], 3, '#c08a4a');
      rr(x + dir * 14 - 10, y - 34 - bo, 20, 16, 6, '#c08a4a', 2.5); rr(x + dir * 24 - 5, y - 28 - bo, 10, 8, 3, '#e8c89a', 2);
      ell(x + dir * 18, y - 28 - bo, 2.5, 2.5, '#ffe14a', 0); poly([[x + dir * 6, y - 34 - bo], [x + dir * 10, y - 42 - bo], [x + dir * 14, y - 34 - bo]], '#6a4a2a', 2);
    }
    function vela(x, y, k) {
      rr(x + 14, y - 30, 6, 18, 2, '#fffdf2', 2);
      var fl = 1 + 0.25 * Math.sin(absT * 17 + k * 2);
      ctx.save(); ctx.globalAlpha = 0.3; ell(x + 17, y - 38, 16 * fl, 16 * fl, LUZ2, 0); ctx.restore();
      ell(x + 17, y - 37, 3.5, 6 * fl, '#ffb03a', 1.5);
    }

    /* el dibujo 2D de siempre (sin WebGL o con ?plano=1) */
    function dibujar2D() {
      var f = cp(), G = geom(), now = c.ahora(), p, a, ox = G.ox, oy = G.oy;
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
      ctx.save(); ctx.translate(sxk, syk);
      fondo(f, G, now);
      ctx.save(); ctx.translate(G.mx, oy); ctx.scale(G.s, G.s); ctx.translate(-G.mx, -oy);
      rr(ox - 10, oy - 10, AW + 20, AH + 20, 6, '#3a3850', 3);
      for (a = 0; a < NT; a++) baldosa(a, G, now);
      for (a = 0; a < polvos.length; a++) { var ag = (now - polvos[a].t) / 0.4; if (ag >= 0 && ag < 1) { ctx.save(); ctx.globalAlpha = 1 - ag; ell(ox + polvos[a].x, oy + polvos[a].y + 4, 14 + ag * 26, 5 + ag * 8, '#c9c4d8', 2); ctx.restore(); } }
      /* la linterna (solo la ve el que la carga): círculos de luz donde se va a quedar prendido */
      var Rp = c.yo >= 0 && P[c.yo] && (P[c.yo].it & 2) && !P[c.yo].st ? previa(now) : null;
      if (Rp) for (a = 0; a < NT; a++) if (Rp.safe[a]) { var cp2 = centro(a); ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(absT * 9); ell(ox + cp2.x, oy + cp2.y, TW * 0.42, TH * 0.42, '#fff8c0', 2); ctx.restore(); }
      /* los coroticos */
      for (a = 0; a < ITEMS.length; a++) if (itemVivo(ITEMS[a], now)) { var ci = centro(ITEMS[a].k); corotico(ox + ci.x, oy + ci.y - 10 - Math.abs(Math.sin(absT * 4 + a)) * 6, ITEMS[a].tipo, 1); }
      /* el perro: carril en rojo, ladra en el borde y cruza */
      var D2 = perroEn(now);
      if (D2) {
        ctx.save(); ctx.globalAlpha = 0.18 + 0.14 * Math.abs(Math.sin(absT * 10)); rr(ox + 2, oy + D2.P.fila * TH + 2, AW - 4, TH - 4, 6, '#ff3a3a', 0); ctx.restore();
        if (!D2.corre) { for (a = 0; a < 3; a++) poly([[ox + AW / 2 + D2.P.dir * (a * 40 - 40) - D2.P.dir * 10, oy + D2.y - 9], [ox + AW / 2 + D2.P.dir * (a * 40 - 40) + D2.P.dir * 10, oy + D2.y], [ox + AW / 2 + D2.P.dir * (a * 40 - 40) - D2.P.dir * 10, oy + D2.y + 9]], '#ff8a8a', 0); txt('¡GUAU!', ox + D2.x + D2.P.dir * 30, oy + D2.y - 30, 12, '#ffb03a', 0, true); }
        perro2D(ox + D2.x, oy + D2.y, D2.P.dir, D2.corre);
      }
      /* los que se están cayendo: se encogen dentro del hueco */
      for (p = 0; p < n; p++) if (P[p].st) {
        var tq = P[p], ac = now - tq.outAt;
        if (ac >= 0 && ac < 0.7) { var sc = 1 - ac / 0.7, cx = ox + tq.fx, cy = oy + tq.fy; ctx.save(); ctx.globalAlpha = sc; ctx.translate(cx, cy + ac * 60); ctx.scale(sc, sc); ctx.translate(-cx, -cy); persona(p, cx, cy, now, 0); ctx.restore(); }
      }
      /* los vivos, por profundidad */
      var ord = [];
      for (p = 0; p < n; p++) if (!P[p].st) ord.push(p);
      ord.sort(function (a2, b2) { return P[a2].y - P[b2].y; });
      for (a = 0; a < ord.length; a++) {
        p = ord[a]; var q = P[p], hp = 0;
        if (c.mio(p)) { if (aire(q, now)) hp = (now - q.hopT) / HOP; } else if (q.h) hp = 0.5;
        persona(p, ox + q.x, oy + q.y, now, hp);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 15, 11, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      ctx.restore();
      /* los que se cayeron: en la acera, con la vela */
      var tn = 0;
      for (p = 0; p < n; p++) if (P[p].st && now - P[p].outAt >= 0.7) {
        var tx = Math.max(f.x0 + 46, G.mx - AW * G.s / 2 + 30) + tn * 70, ty = oy + AH * G.s + 38 + (1 - G.s) * 60; tn++;
        c.util.pj(asiento(p).ch, tx, ty, 46, { animo: 'perder', sombra: false }); vela(tx, ty, p);
        txt('CON VELA', tx, ty + 30, 10, LUZ2, 0, true);
      }
      ctx.restore();
      var mx = (f.x0 + f.x1) / 2;
      if (now < lead + 1.2 && !c.practica) { txt('SE FUE EN TODA LA CUADRA…', mx, 96, 15, '#fffdf2', 0, true); txt('…MENOS DONDE EL VECINO DE LA PLANTA', mx, 116, 13, LUZ2, 0, true); }
      if (now >= dur * 0.72) { ctx.save(); ctx.globalAlpha = 0.08 + 0.07 * Math.abs(Math.sin(absT * 5)); rr(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, 0, '#ff2020', 0); ctx.restore(); }   // alarma de los últimos segundos
      if (now >= -0.4 && now < 2.2 && !c.practica) txt('¡PÁRATE DONDE HAY LUZ!', mx, 140, 21, LUZ, 0, true);
      if (now >= lead + 1.2) txt(REGLA, mx, 100, 10, '#fffdf2', 0, true);
      if (banT > 0) txt(banTxt, mx, 140, 24 + Math.sin(absT * 14), banCol, 0, true);
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): la casa a oscuras en pleno apagón. Solo dibujo: lee P, rondas y fase(); no toca la simulación ─────
       El piso son 7×5 baldosas-bombillo sobre un hueco negro. Cada bombillo prendido alumbra de verdad (NLUZ PointLights que se reparten
       cada cuadro entre los prendidos más cerca de los vivos). Titila = aviso; apagada = se pone roja y tiembla; cae = la baldosa se va
       con gravedad y vueltas al vacío, y el que estaba encima `caer` detrás de ella. Los que se cayeron, en el banco de adelante con su vela. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;      // v3: null = sin probar, false = sin 3D (2D de siempre)
    var ESX = 1 / 18, ESZ = 1.15 / 18, BW = TW * ESX, BD = TH * ESZ, MW = AW * ESX, MD = AH * ESZ, NLUZ = 6;
    function WX(x) { return (x - AW / 2) * ESX; }
    function WZ(y) { return (y - AH / 2) * ESZ; }
    var PAL3 = {    // la casa siempre a oscuras; lo que cambia es la luz que entra por la ventana: tarde, atardecer, noche
      1: { cielo: ['#6aa8e0', '#ffcf90'], hemi: [0xffe2c4, 0x1a1428, .3], sol: [0xffd0a0, .3], niebla: '#120e1a', pared: '#7a5a52', piso: '#5a3e2c', vecino: .7 },
      2: { cielo: ['#ff6a4a', '#ffc078'], hemi: [0xffb48a, 0x1a1020, .24], sol: [0xff905a, .26], niebla: '#100a16', pared: '#6a4a4a', piso: '#4e3426', vecino: .9 },
      3: { cielo: ['#06061a', '#1c1a40'], hemi: [0x7078ff, 0x0a0812, .16], sol: [0x8090ff, .12], niebla: '#07060e', pared: '#3e3446', piso: '#3a2a22', vecino: 1.2 }
    };
    var BANCO3 = [-4.5, -1.5, 1.5, 4.5];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, a;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 70, 160], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      V3.pista('apagon', { bpm: 118,                           // gaita de furro en La menor: suspenso de apagón (i–iv–V–i)
        acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 74, 72, 0, 71, 72, 0, 69, 0, 72, 74, 0, 76, 77, 76, 74, 0, 71, 0, 68, 71, 74, 0, 76, 0, 72, 0, 69, 0, 0, 0] });
      V3.pista('apagon2', { bpm: 140,                          // «¡se pone feo!»: la misma gaita, más apurada
        acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 74, 72, 74, 76, 0, 72, 0, 74, 72, 71, 72, 74, 0, 71, 0, 72, 71, 69, 71, 72, 0, 68, 0, 71, 72, 74, 76, 77, 0, 76, 0] });
      V3.pista('apagon3', { bpm: 168,                          // «¡últimos segundos!»: a millón
        acordes: [[57, 60, 64], [53, 57, 60], [52, 56, 59], [52, 56, 59]],
        mel: [81, 76, 81, 76, 80, 76, 80, 76, 79, 76, 79, 76, 77, 76, 74, 72, 74, 71, 74, 71, 72, 69, 72, 69, 71, 68, 71, 68, 76, 0, 76, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon;
      /* el piso de la casa (tablas) alrededor del hueco */
      function tablas(w, d) {
        var tx = V3.texturaCanvas(128, 128, function (x, ww, hh) {
          x.fillStyle = pl.piso; x.fillRect(0, 0, ww, hh);
          for (var j = 0; j < 4; j++) {
            x.fillStyle = V3.oscurecer(pl.piso, .85 + (j % 2) * .2); x.fillRect(0, j * 32 + 2, ww, 28);
            x.fillStyle = V3.oscurecer(pl.piso, .55); x.fillRect(((j * 53) % 100) + 10, j * 32, 3, 32);
          }
        }, [Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(d / 3))]);
        return new T.MeshToonMaterial({ map: tx, gradientMap: tn('#fff').gradientMap });
      }
      function losa(x0, x1, z0, z1) {
        var m = new T.Mesh(new T.BoxGeometry(x1 - x0, .5, z1 - z0), tablas(x1 - x0, z1 - z0));
        m.position.set((x0 + x1) / 2, -.25, (z0 + z1) / 2); m.receiveShadow = true; S3.add(m);
      }
      var hx = MW / 2 + .1, hz = MD / 2 + .1, FX = 26, FZ0 = -14, FZ1 = 17;
      losa(-FX, FX, FZ0, -hz); losa(-FX, FX, hz, FZ1); losa(-FX, -hx, -hz, hz); losa(hx, FX, -hz, hz);
      /* el hueco: paredes negras que bajan y un fondo que no se ve */
      var neg = tn('#100c18');
      [[0, -hz - .15, MW + .5, .3], [0, hz + .15, MW + .5, .3], [-hx - .15, 0, .3, MD + .5], [hx + .15, 0, .3, MD + .5]].forEach(function (r) {
        var m = M(new T.BoxGeometry(r[2], 20, r[3]), null, { mat: neg, borde: false, sombra: false }); m.position.set(r[0], -10.5, r[1]); S3.add(m);
      });
      var fondoH = new T.Mesh(new T.PlaneGeometry(MW + 2, MD + 2), new T.MeshBasicMaterial({ color: 0x030208 })); fondoH.rotation.x = -Math.PI / 2; fondoH.position.y = -20; S3.add(fondoH);
      /* las paredes: la del fondo con la ventana (rejas y cortinas) y las de los lados */
      var pared = tn(pl.pared), pared2 = tn(V3.oscurecer(pl.pared, .75));
      function bloque(x0, x1, y0, y1, z, mat, gz) { var m = M(new T.BoxGeometry(x1 - x0, y1 - y0, gz || .6), null, { mat: mat, g: .01, recibe: true, sombra: false }); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); S3.add(m); return m; }
      var WZ0 = -14.3, VX0 = 5, VX1 = 14, VY0 = 3.5, VY1 = 8.5;
      bloque(-FX, VX0, 0, 12, WZ0, pared); bloque(VX1, FX, 0, 12, WZ0, pared); bloque(VX0, VX1, 0, VY0, WZ0, pared); bloque(VX0, VX1, VY1, 12, WZ0, pared);
      bloque(-FX - .3, -FX + .3, 0, 12, -4, pared2, 21).rotation.y = 0; bloque(FX - .3, FX + .3, 0, 12, -4, pared2, 21);
      var marco = tn('#e8e0d0');
      [[VX0, VY0, VX1, VY0 + .25], [VX0, VY1 - .25, VX1, VY1], [VX0, VY0, VX0 + .25, VY1], [VX1 - .25, VY0, VX1, VY1]].forEach(function (r) { bloque(r[0], r[2], r[1], r[3], WZ0 + .2, marco, .3); });
      for (k = 1; k < 7; k++) { var rej = M(new T.CylinderGeometry(.05, .05, VY1 - VY0, 5), '#1a1820', { borde: false }); rej.position.set(VX0 + k * (VX1 - VX0) / 7, (VY0 + VY1) / 2, WZ0 + .1); S3.add(rej); }
      var cortinas = [];
      [VX0 + .2, VX1 - .2].forEach(function (x, i) {
        var cg = new T.Group(); cg.position.set(x, VY1 + .3, WZ0 + .6); S3.add(cg);
        var cm = M(new T.BoxGeometry(1.6, VY1 - VY0 + 1.2, .08), '#b0405a', { g: .02 }); cm.position.set(i ? -.6 : .6, -(VY1 - VY0 + 1.2) / 2, 0); cg.add(cm);
        cortinas.push(cg);
      });
      /* afuera, por la ventana: la casa del vecino CON PLANTA (la única prendida) y su planta echando humo */
      var vec = M(new T.BoxGeometry(11, 8, 5), '#e8a860', { g: .015 }); vec.position.set(9.5, 4, -26); S3.add(vec);
      var techo = M(new T.ConeGeometry(8.2, 3, 4), '#a84a3a'); techo.position.set(9.5, 9.5, -26); techo.rotation.y = Math.PI / 4; techo.scale.set(1, 1, .5); S3.add(techo);
      var lucesVec = [];
      [6.5, 12.5].forEach(function (x) { var vv = new T.Mesh(new T.PlaneGeometry(2.4, 2.4), new T.MeshBasicMaterial({ color: new T.Color(LUZ).multiplyScalar(pl.vecino), fog: false })); vv.position.set(x, 5, -23.45); S3.add(vv); lucesVec.push(vv); });
      var planta = M(new T.BoxGeometry(2.2, 1.6, 1.6), '#c0392b', { g: .04 }); planta.position.set(15.5, .8, -21.5); S3.add(planta);
      var esc3 = M(new T.CylinderGeometry(.15, .15, 1, 6), '#2a2a2a'); esc3.position.set(16.2, 2, -21.5); S3.add(esc3);
      /* la caja de breakers en la pared (por ahí se va la luz; en Nv3 la maneja Don Corte) */
      var caja = M(new T.BoxGeometry(1.8, 2.4, .4), '#8a8a96', { g: .03 }); caja.position.set(-12, 5.5, WZ0 + .5); S3.add(caja);
      var palanca = M(new T.BoxGeometry(.25, .9, .25), '#ff5c5c', { g: .06 }); palanca.position.set(-12, 5.5, WZ0 + .8); S3.add(palanca);
      /* el reloj de pila (sigue andando), la nevera, el mueble con la tele apagada y la mecedora de la abuela, que se mece sola */
      var reloj = new T.Group(); reloj.position.set(-4, 9, WZ0 + .4); S3.add(reloj);
      var esfera = M(new T.CylinderGeometry(1, 1, .15, 16), '#fffdf2', { g: .05 }); esfera.rotation.x = Math.PI / 2; reloj.add(esfera);
      function aguja(l, w) { var gg = new T.BoxGeometry(w, l, .06); gg.translate(0, l / 2, 0); var m = new T.Mesh(gg, tn('#14101c')); m.position.z = .12; reloj.add(m); return m; }
      var hora = aguja(.55, .12), minu = aguja(.85, .07);
      var nev = M(new T.BoxGeometry(3, 6.5, 2.6), '#d8d8e0', { g: .02, recibe: true }); nev.position.set(-21.5, 3.25, -11.5); S3.add(nev);
      var asa = M(new T.BoxGeometry(.15, 1.6, .15), '#8a8a96', { g: .05 }); asa.position.set(-20.3, 3.6, -10.15); S3.add(asa);
      var mueble = M(new T.BoxGeometry(5, 2, 2), '#6a4428', { g: .02, recibe: true }); mueble.position.set(20.5, 1, -11.5); S3.add(mueble);
      var tele = M(new T.BoxGeometry(3.6, 2.4, 1.2), '#22202a', { g: .03 }); tele.position.set(20.5, 3.2, -11.5); S3.add(tele);
      var pant = new T.Mesh(new T.PlaneGeometry(3, 1.9), tn('#0c0c14')); pant.position.set(20.5, 3.2, -10.88); S3.add(pant);
      var meced = new T.Group(); meced.position.set(21, 0, 2); meced.rotation.y = -Math.PI / 3; S3.add(meced);
      var mc = new T.Group(); meced.add(mc);
      var asiento3 = M(new T.BoxGeometry(2, .25, 2), '#8a5a30', { g: .04 }); asiento3.position.y = 1.4; mc.add(asiento3);
      var espaldar = M(new T.BoxGeometry(2, 2.6, .25), '#8a5a30', { g: .04 }); espaldar.position.set(0, 2.7, -1); espaldar.rotation.x = -.2; mc.add(espaldar);
      [-.9, .9].forEach(function (x) { var pa = M(new T.BoxGeometry(.18, 1.3, .18), '#5a3a1a', { g: .05 }); pa.position.set(x, .75, 0); mc.add(pa); var pat = M(new T.BoxGeometry(.18, .15, 2.8), '#5a3a1a', { g: .05 }); pat.position.set(x, .1, 0); mc.add(pat); });
      /* el bombillo del techo, muerto, colgando del cable (se mece con la brisa) */
      var colg = new T.Group(); colg.position.set(-2, 15, -6); S3.add(colg);
      var cable = new T.Mesh(new T.CylinderGeometry(.04, .04, 5, 4), tn('#14101c')); cable.position.y = -2.5; colg.add(cable);
      var muerto = M(new T.SphereGeometry(.5, 8, 6), '#6a6a7a', { g: .06 }); muerto.position.y = -5.4; colg.add(muerto);
      /* el banco de adelante: ahí se sientan los que se cayeron, cada uno con su vela */
      var banco = new T.Group(); banco.position.set(0, 0, 11); S3.add(banco);
      var tabla = M(new T.BoxGeometry(11, .2, 1), '#7a4a2a', { recibe: true }); tabla.position.y = .85; banco.add(tabla);
      [-5, 5].forEach(function (x) { var pa = M(new T.BoxGeometry(.2, .85, .9), '#2a2a34'); pa.position.set(x, .42, 0); banco.add(pa); });
      var velas = [];
      for (k = 0; k < 4; k++) {
        var vg = new T.Group(); vg.position.set(BANCO3[k] + .9, 0, 12.3); vg.visible = false; S3.add(vg);
        var cera = M(new T.CylinderGeometry(.15, .17, .9, 8), '#fffdf2', { g: .06 }); cera.position.y = .45; vg.add(cera);
        var llama = new T.Mesh(new T.ConeGeometry(.13, .4, 6), new T.MeshBasicMaterial({ color: 0xffb03a })); llama.position.y = 1.1; vg.add(llama);
        velas.push({ g: vg, llama: llama });
      }
      var luzVela = new T.PointLight(0xff9a40, 0, 9, 2); luzVela.position.set(0, 2, 12); S3.add(luzVela);
      /* las 35 baldosas-bombillo: cuerpo, vidrio (su propio material: se prende y se apaga) y el bombillo empotrado */
      var tiles = [], matCuerpo = tn('#3a3346');
      var geoT = new T.BoxGeometry(BW - .24, .7, BD - .24), geoV = new T.BoxGeometry(BW - .7, .12, BD - .7), geoB = new T.SphereGeometry(.55, 12, 8);
      var geoRayo = new T.CylinderGeometry(BW * .34, BW * .44, 9, 16, 1, true);
      for (k = 0; k < NT; k++) {
        var cc = centro(k), grp = new T.Group(); grp.position.set(WX(cc.x), 0, WZ(cc.y)); S3.add(grp);
        var cu = M(geoT, null, { mat: matCuerpo, g: .03, recibe: true }); cu.position.y = -.35; grp.add(cu);
        var vm = tn('#fff1b0', { em: '#ffc850', emI: .9, nuevo: true });
        var vid = M(geoV, null, { mat: vm, borde: false, recibe: true }); vid.position.y = .02; grp.add(vid);
        var bm = tn('#fffbe0', { em: '#ffd36a', emI: 1.2, nuevo: true });
        var bul = M(geoB, null, { mat: bm, g: .05, sombra: false }); bul.position.y = .06; bul.scale.set(1, .38, 1); grp.add(bul);
        var rayo = new T.Mesh(geoRayo, new T.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
        rayo.position.y = 4.5; rayo.visible = false; grp.add(rayo);
        tiles.push({ g: grp, vm: vm, bm: bm, bul: bul, pf: 0, rayo: rayo, x: grp.position.x, z: grp.position.z, y: 0, vy: 0, rx: 0, rz: 0, vrx: 0, vrz: 0, cae: 0 });
      }
      var luces = [];
      for (k = 0; k < NLUZ; k++) { var L = new T.PointLight(0xffd890, 0, 11, 2); L.position.set(0, 1.6, 0); S3.add(L); luces.push(L); }
      /* los jugadores */
      var pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        pj.g.position.set(WX(P[k].x), 0, WZ(P[k].y)); S3.add(pj.g);
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: s2.color && s2.color !== '#fff' ? s2.color : '#ffd23f', transparent: true, opacity: .85, depthWrite: false }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = .1; S3.add(aro);
        pjs.push({ pj: pj, aro: aro, x: WX(P[k].x), z: WZ(P[k].y), y: 0, rumbo: 0, aire: false, hopT: -9, empT: -9, cayo: 0, caeT: 0, vy: 0, giro: 0, banco: -1, sustoT: -9, felizT: -9, perroI: -1, brincoI: -1, vueloT: -9, vueloDir: 1, pk: 0, salvT: -9, velaT: -9, aterT: -9, antT: -9, ptr: 0 });
      }
      /* Don Corte (Nv3): el tío en la caja de breakers, bajando la palanca */
      var corte = V3.PJ.crear('tio', { prop: false, escala: 1.35 }); corte.g.position.set(-12, 0, -11.6); corte.g.visible = false; S3.add(corte.g);
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var part = V3.particulas(esc, 500);
      /* EL PERRO DEL VECINO: un cuspo low poly (mira a +z; se gira según el lado por donde entra) */
      var perro = new T.Group(); perro.visible = false; S3.add(perro);
      var pelaje = '#c08a4a', patasP = [];
      var lomo = M(new T.BoxGeometry(.9, .75, 1.8), pelaje, { g: .04 }); lomo.position.y = 1; perro.add(lomo);
      var cabP = new T.Group(); cabP.position.set(0, 1.45, 1.05); perro.add(cabP);
      var craneo = M(new T.BoxGeometry(.8, .72, .75), pelaje, { g: .04 }); cabP.add(craneo);
      var hocico = M(new T.BoxGeometry(.44, .34, .45), '#e8c89a', { g: .03 }); hocico.position.set(0, -.12, .52); cabP.add(hocico);
      var nariz = new T.Mesh(new T.BoxGeometry(.18, .14, .1), tn('#14101c')); nariz.position.set(0, -.02, .76); cabP.add(nariz);
      [-1, 1].forEach(function (sx) {
        var oreja = M(new T.BoxGeometry(.18, .42, .3), '#6a4a2a', { g: .03 }); oreja.position.set(sx * .4, .2, -.05); oreja.rotation.z = sx * .5; cabP.add(oreja);
        var ojo = new T.Mesh(new T.SphereGeometry(.08, 6, 4), new T.MeshBasicMaterial({ color: 0xffe14a, fog: false })); ojo.position.set(sx * .2, .1, .38); cabP.add(ojo);
      });
      var cola = new T.Group(); cola.position.set(0, 1.25, -.9); perro.add(cola);
      var colaM = M(new T.BoxGeometry(.14, .14, .6), pelaje, { g: .03 }); colaM.position.z = -.28; colaM.rotation.x = .6; cola.add(colaM);
      [[-.3, .65], [.3, .65], [-.3, -.65], [.3, -.65]].forEach(function (pp) {
        var pg = new T.Group(); pg.position.set(pp[0], .7, pp[1]); perro.add(pg);
        var gp = new T.BoxGeometry(.22, .7, .22); gp.translate(0, -.35, 0); pg.add(M(gp, '#8a5a2a', { g: .03 })); patasP.push(pg);
      });
      var carril = new T.Mesh(new T.PlaneGeometry(MW - .2, BD - .3), new T.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0, depthWrite: false }));
      carril.rotation.x = -Math.PI / 2; carril.position.y = .12; carril.visible = false; S3.add(carril);
      /* los coroticos en el piso: VELA (cera + llama) y LINTERNA (cuerpo rojo + foco que alumbra) */
      function hacerCorotico(tipo, s) {
        var gr = new T.Group();
        if (tipo === 1) {
          var ce = M(new T.CylinderGeometry(.2 * s, .22 * s, 1 * s, 8), '#fffdf2', { g: .05 }); ce.position.y = .5 * s; gr.add(ce);
          var ll = new T.Mesh(new T.ConeGeometry(.16 * s, .45 * s, 6), new T.MeshBasicMaterial({ color: 0xffb03a })); ll.position.y = 1.2 * s; gr.add(ll); gr.userData.llama = ll;
        } else {
          var cu2 = M(new T.CylinderGeometry(.22 * s, .22 * s, .9 * s, 8), '#c0392b', { g: .05 }); cu2.rotation.z = Math.PI / 2; cu2.position.y = .4 * s; gr.add(cu2);
          var fo = M(new T.CylinderGeometry(.36 * s, .24 * s, .35 * s, 8), '#8a8a96', { g: .05 }); fo.rotation.z = -Math.PI / 2; fo.position.set(.6 * s, .4 * s, 0); gr.add(fo);
          var le = new T.Mesh(new T.CircleGeometry(.32 * s, 10), new T.MeshBasicMaterial({ color: 0xfff8c0 })); le.rotation.y = Math.PI / 2; le.position.set(.79 * s, .4 * s, 0); gr.add(le);
        }
        return gr;
      }
      var items3 = [];
      for (k = 0; k < ITEMS.length; k++) {
        var ig = hacerCorotico(ITEMS[k].tipo, 1.1), ic = centro(ITEMS[k].k); ig.position.set(WX(ic.x), .5, WZ(ic.y)); ig.visible = false; S3.add(ig);
        var halo = new T.Mesh(new T.RingGeometry(.7, 1.05, 18), new T.MeshBasicMaterial({ color: ITEMS[k].tipo === 1 ? 0xffb03a : 0xfff3a0, transparent: true, opacity: .7, depthWrite: false }));
        halo.rotation.x = -Math.PI / 2; halo.position.set(WX(ic.x), .14, WZ(ic.y)); halo.visible = false; S3.add(halo);
        items3.push({ g: ig, halo: halo });
      }
      for (k = 0; k < pjs.length; k++) {                    // lo que carga cada uno, flotando sobre la cabeza
        var iv = hacerCorotico(1, .55), il = hacerCorotico(2, .55); iv.visible = false; il.visible = false; S3.add(iv); S3.add(il); pjs[k].icoV = iv; pjs[k].icoL = il;
      }
      var spots = [];                                      // la linterna: círculos de luz donde se va a quedar prendido (solo los ve el que la carga)
      for (k = 0; k < 10; k++) { var sm = new T.Mesh(new T.CircleGeometry(BW * .4, 18), new T.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); sm.rotation.x = -Math.PI / 2; sm.position.y = .2; sm.visible = false; S3.add(sm); spots.push(sm); }
      /* la extensión de la planta del vecino: un cable que entra por la ventana hasta la baldosa que se vuelve a prender */
      var cableExt = [];
      for (k = 0; k < 2; k++) { var cbm = new T.Mesh(new T.BoxGeometry(.2, .2, 1), new T.MeshBasicMaterial({ color: 0x14101c })); cbm.visible = false; S3.add(cbm); cableExt.push(cbm); }
      var luzPl = new T.PointLight(0xa8ff5a, 0, 16, 2); luzPl.position.set(14, 3, -17); S3.add(luzPl);          // el verde de la extensión del vecino
      var luzCV = new T.PointLight(0xff9a40, 0, 13, 2), luzCL = new T.PointLight(0xfff3b0, 0, 17, 1.6); S3.add(luzCV); S3.add(luzCL);   // la vela y la linterna alumbran a quien las carga
      var estrellas = [];
      /* la alarma de los últimos segundos: una luz roja que late (siempre está; en las otras fases, en 0) */
      var alarma = new T.PointLight(0xff2a2a, 0, 60, 1.2); alarma.position.set(0, 10, -2); S3.add(alarma);
      esc.encuadrar(MW + 6, MD + 4, new T.Vector3(0, .5, 2.5), .82);
      return { esc: esc, pjs: pjs, tiles: tiles, luces: luces, velas: velas, luzVela: luzVela, corte: corte, flecha: flecha, part: part, cortinas: cortinas, colg: colg,
        hora: hora, minu: minu, mc: mc, lucesVec: lucesVec, planta: planta, palanca: palanca, caja: caja, cam: { x: 0 }, caidos: 0, humoT: 0, motaT: 0, flash: 0, festejo: 0, hemi0: pl.hemi[2],
        perro: perro, cabP: cabP, cola: cola, patasP: patasP, carril: carril, items3: items3, spots: spots, cableExt: cableExt, alarma: alarma, chispaT: 0, perroX: 0, luzPl: luzPl, luzCV: luzCV, luzCL: luzCL,
        mult: 1, sol0: pl.sol[1], chT: 1, sustos: 0, lomo: lomo, fin: 0, hotT: {}, plantaT: -9, guauT: 0, vecL: pl.vecino };
    }
    /* efectos 3D de los momentos de la ronda (los llama update cuando hay 3D; si no, suena el 2D de siempre) */
    function ronda3D(tipo, R) {
      var V = v3, cx = V.caja.position;
      if (tipo === 'w') {
        V3.sfx('chispa'); V3.sfx('trueno'); V.esc.sacudir(.5); V.flash = 1; V.part.soltar(cx.x, cx.y, cx.z + .5, 22, { k: 'chispa', cols: ['#fff36a', '#ffffff', '#ffb03a'], vel: 5, arriba: 4, vida: .6 });
        for (var pw = 0; pw < n; pw++) if (!P[pw].st) { V.pjs[pw].sustoT = absT + .9; if (!V.pjs[pw].aire) V.pjs[pw].pj.uno('susto'); }
        if (R.spir) { V3.sfx('trueno'); V.flash = 1; V.esc.sacudir(.8); V.corte.uno('lanzar'); }
        else if (R.uno) V3.sfx('silbato');
      } else if (tipo === 'o') { V3.sfx('whoosh'); }
      else if (tipo === 'd') { V3.sfx('caida'); V.esc.sacudir(.6); }
      else if (tipo === 'b') { V3.sfx('ding'); }
    }
    function cable3D(m, ax, ay, az, bx, by, bz) { var dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.scale.set(1, 1, L); m.lookAt(bx, by, bz); }
    function empujeDe3D(p, t) {                                              // quién nos empujó: el que aterrizó (o salta) cerca; la dirección va de él hacia la víctima
      var a, best = null, bd = 99, dd, s3 = v3.pjs[p], o;
      for (a = 0; a < n; a++) {
        o = v3.pjs[a]; if (a === p || !o || !(o.aire || t - o.aterT < 0.6)) continue;
        dd = Math.sqrt((s3.x - o.x) * (s3.x - o.x) + (s3.z - o.z) * (s3.z - o.z));
        if (dd < bd && dd > 0.01) { bd = dd; best = o; }
      }
      if (best) return { x: s3.x - best.x, z: s3.z - best.z };
      return { x: 1, z: 0 };
    }
    function chispazo3D(V, x, y, z, n, flash) { V.part.soltar(x, y, z, n, { k: 'chispa', cols: ['#fff36a', '#ffffff', '#ffb03a', '#9ad0ff'], vel: 5, arriba: 3, g: 14, vida: .6 }); V3.sfx('chispa'); V.flash = Math.max(V.flash, flash || .5); }
    function actualizar3D(dt, now) {
      var V = v3, p, a, k, t = absT, R = rondaEn(now), fin = vivos() <= 1 || now >= dur, fz3 = now >= F3, D = perroEn(now), pl0 = PAL3[lv];
      V.part.update(dt);
      /* lo que se mueve solo: cortinas, el bombillo colgado, el reloj, la mecedora, el humo de la planta, polvito en la luz */
      for (a = 0; a < V.cortinas.length; a++) V.cortinas[a].rotation.x = -.12 - .1 * Math.sin(t * 1.3 + a * 1.7) - (R && now >= R.W && now < R.rev ? .12 : 0);
      V.colg.rotation.z = Math.sin(t * .9) * .12 + (V.flash > .2 ? Math.sin(t * 40) * .1 : 0); V.colg.rotation.x = Math.sin(t * .7 + 1) * .06;
      V.minu.rotation.z = -t * .5; V.hora.rotation.z = -t * .5 / 12 - 1;
      V.mc.rotation.x = Math.sin(t * 1.6) * .14;
      var plantaOn = !!R && R.resc >= 0 && now >= R.rescT && now < R.Tback;
      V.planta.position.x = 15.5 + Math.sin(t * (plantaOn ? 90 : 50)) * (plantaOn ? .09 : .03);
      V.planta.scale.set(1, 1 + (plantaOn ? .12 * Math.abs(Math.sin(t * 14)) : 0), 1);
      V.humoT -= dt; if (V.humoT < 0) { V.humoT = plantaOn ? .08 : .35; V.part.soltar(16.2, 2.6, -21.5, plantaOn ? 2 : 1, { k: 'gota', cols: plantaOn ? ['#c8ff7a', '#8a8a9a'] : ['#8a8a9a', '#5a5a6a'], vel: plantaOn ? 1.2 : .4, arriba: plantaOn ? 2.4 : 1.2, g: -1.2, vida: 2.2, esc: plantaOn ? 2.6 : 1.8 }); }
      for (a = 0; a < V.lucesVec.length; a++) V.lucesVec[a].material.color.setHex(plantaOn ? 0xf0ffb0 : Math.floor(t * 3 + a * 7) % 9 === 0 ? 0xffe9a0 : 0xffd86a);
      V.flash = Math.max(0, V.flash - dt * 2.5);
      /* LA LUZ: casi oscuridad total mientras dura el apagón; en el titileo la luz da ráfagas; entre rondas VUELVE (más clara) */
      var mult = 1.05;
      if (R && now >= R.W && now < R.rev) mult = Math.floor(t * 21) % 3 === 0 ? .8 : .03;
      else if (R && now >= R.rev && now < R.Tback) mult = .22 + (Math.floor(t * 9) % 11 === 0 ? .2 : 0);
      V.mult += (mult - V.mult) * Math.min(1, dt * (R && now >= R.W && now < R.rev ? 40 : 9));
      V.esc.luces.hemi.intensity = V.hemi0 * V.mult + V.flash * (Math.floor(t * 20) % 2 ? .9 : .3) + (fz3 ? .05 * Math.abs(Math.sin(t * 6)) : 0);
      V.esc.luces.sol.intensity = V.sol0 * V.mult * .8;
      V.esc.luces.hemi.color.setHex(fz3 && R && now < R.Tback ? 0xd0607a : pl0.hemi[0]);
      V.alarma.intensity = fz3 && now > 0 ? (.5 + .5 * Math.sin(t * 6.5)) * .7 : 0;
      /* chispazos: la caja de breakers y el bombillo muerto sueltan chispas (más seguido mientras más feo) */
      V.chT -= dt;
      if (V.chT < 0 && now > 0) {
        V.chT = (fz3 ? .45 : now >= F2 ? .9 : 1.7) * (.6 + c.fx() * .8);
        var csel = c.fx() < .6; if (csel) chispazo3D(V, V.caja.position.x, V.caja.position.y, V.caja.position.z + .6, 10, .55); else chispazo3D(V, -2 + V.colg.rotation.z * 5, 9.7, -6, 7, .4);
      }
      /* las baldosas: luz, aviso, caída con física, y vuelta */
      var cand = [];
      for (k = 0; k < NT; k++) {
        var F = fase(k, now), ti = V.tiles[k], br = 0, rojo = 0, col = 0;
        if (F.f === 0) br = 1; else if (F.f === 1) br = 1.3; else if (F.f === 2) br = Math.floor(t * 14 + k) % 2 === 0 ? 1 : .05; else if (F.f === 5) br = F.u;
        else if (F.f === 6) { br = 1.5 + .9 * F.u; col = 1; } else if (F.f === 7) { br = 1.5 + .3 * Math.sin(t * 22); col = 2; }
        if (F.f === 3) rojo = F.u;
        if (F.f === 4) {
          if (!ti.cae) { ti.cae = 1; ti.y = 0; ti.vy = -.6 - c.fx() * .8; ti.vrx = (c.fx() - .5) * 3.2; ti.vrz = (c.fx() - .5) * 3.2;
            V.part.soltar(ti.x, .1, ti.z, 10, { k: 'gota', cols: ['#4a4458', '#2a2636', '#8a8496'], vel: 3, arriba: 1.5, vida: .6, esc: 1.1 }); }
          ti.vy -= 24 * dt; ti.y += ti.vy * dt; ti.rx += ti.vrx * dt; ti.rz += ti.vrz * dt;
        } else if (F.f === 5) { ti.cae = 0; var e = 1 - F.u; ti.y = -8 * e * e; ti.rx = 0; ti.rz = 0; }
        else { ti.cae = 0; ti.y = 0; ti.rx = 0; ti.rz = 0; }
        var tr = F.f === 3 && F.u > .45 ? Math.sin(t * 60 + k) * .07 * F.u : F.f === 6 ? Math.sin(t * 80 + k) * .1 * F.u : 0;
        ti.g.position.set(ti.x + tr, ti.y, ti.z); ti.g.rotation.set(ti.rx, 0, ti.rz + tr * .3);
        ti.g.visible = ti.y > -19;
        if (rojo > 0) {                                   // apagada y por caerse: oscura, con un rojo que late cada vez más rápido
          ti.vm.color.setHex(0x2a2638); ti.vm.emissive.setHex(0xff2a2a); ti.vm.emissiveIntensity = .08 + .85 * rojo * (.5 + .5 * Math.sin(t * (8 + 22 * rojo)));
          ti.bm.color.setHex(0x4a4a58); ti.bm.emissiveIntensity = 0;
        } else if (col === 1) {                          // ¡SUBIDÓN!: blanco-azul, zumbando y cada vez más fuerte
          ti.vm.color.setHex(0xe8f4ff); ti.vm.emissive.setHex(0x6ab4ff); ti.vm.emissiveIntensity = br * (.9 + .5 * Math.sin(t * 50));
          ti.bm.color.setHex(0xffffff); ti.bm.emissive.setHex(0xbfe4ff); ti.bm.emissiveIntensity = br * 1.4;
        } else if (col === 2) {                          // ¡LA PLANTA!: verde lima, prendida con la extensión
          ti.vm.color.setHex(0xe0ffa0); ti.vm.emissive.setHex(0x9aff3a); ti.vm.emissiveIntensity = br * .9;
          ti.bm.color.setHex(0xf4ffd0); ti.bm.emissive.setHex(0xc8ff7a); ti.bm.emissiveIntensity = br * 1.2;
        } else {
          ti.vm.color.setHex(br > .5 ? 0xfff1b0 : 0x2a2638); ti.vm.emissive.setHex(F.f === 1 ? 0xffe070 : 0xffc850); ti.vm.emissiveIntensity = br * .9;
          ti.bm.color.setHex(br > .5 ? 0xfffbe0 : 0x4a4a58); ti.bm.emissive.setHex(0xffd36a); ti.bm.emissiveIntensity = br * 1.2;
        }
        var bs = col === 1 ? 1 + .6 * F.u : 1; ti.bul.scale.set(bs, (.38 + (col === 1 ? .4 * F.u : 0)), bs);
        ti.rayo.visible = F.f === 1 || col > 0;            // la que se queda (o se recalienta, o la de la planta): un rayo de luz que la marca desde lejos
        if (ti.rayo.visible) { ti.rayo.material.color.setHex(col === 1 ? 0x9ad0ff : col === 2 ? 0xb8ff6a : 0xfff3a0); ti.rayo.material.opacity = col === 1 ? .25 + .3 * F.u : .14 + .08 * Math.sin(t * 8 + k); ti.rayo.scale.set(col === 1 ? 1 + .5 * F.u : 1, 1, col === 1 ? 1 + .5 * F.u : 1); }
        if (col === 1) {                                   // chispas azules y zumbido
          ti.sT = (ti.sT || 0) - dt;
          if (ti.sT < 0) { ti.sT = .07; V.part.soltar(ti.x + (c.fx() - .5) * 3, .8, ti.z + (c.fx() - .5) * 2, 2, { k: 'chispa', cols: ['#bfe4ff', '#ffffff', '#6ab4ff'], vel: 3, arriba: 3 + 3 * F.u, g: 12, vida: .45 }); if (!ti.sf) { ti.sf = 1; V3.sfx('chispa'); } }
        } else ti.sf = 0;
        if (br > .3 && ti.y > -3) {
          var dm = 1e9;
          for (p = 0; p < n; p++) if (!P[p].st) { var sp = V.pjs[p], ddx = ti.x - sp.x, ddz = ti.z - sp.z; dm = Math.min(dm, ddx * ddx + ddz * ddz); }
          if (dm === 1e9) dm = ti.x * ti.x + ti.z * ti.z;
          cand.push({ k: k, d: dm - (F.f === 1 ? 60 : col ? 120 : 0), br: br, col: col, f2: F.f === 2 });
        }
      }
      /* luz de verdad: las NLUZ luces se van a los bombillos prendidos más cerca de la gente (las sobrantes, en 0: nunca cambia el número de luces) */
      cand.sort(function (a2, b2) { return a2.d - b2.d; });
      for (a = 0; a < NLUZ; a++) {
        var L = V.luces[a];
        if (a < cand.length) {
          var tl = V.tiles[cand[a].k], cd = cand[a], fl2 = cd.f2 ? (Math.floor(t * 18 + a) % 2 ? 1 : .15) : (cd.br > 1.2 ? 1 : .9 + .1 * Math.sin(t * 31 + a * 5));
          L.position.set(tl.x, tl.y + 1.8, tl.z); L.intensity = 2.3 * cd.br * fl2; L.distance = 13; L.color.setHex(cd.col === 1 ? 0xaad4ff : cd.col === 2 ? 0xb8ff6a : 0xffd890);
        } else L.intensity = 0;
      }
      /* la extensión del vecino: del enchufe de la planta por la ventana hasta la baldosa que se vuelve a prender */
      var cabV = !!R && R.resc >= 0 && now >= R.rev && now < R.Tback;
      V.cableExt[0].visible = cabV; V.cableExt[1].visible = cabV;
      if (cabV) {
        var tr2 = V.tiles[R.resc], vivoC = now >= R.rescT;
        cable3D(V.cableExt[0], 15.8, 1.6, -21.5, 10.5, 4.6, -14.5); cable3D(V.cableExt[1], 10.5, 4.6, -14.5, tr2.x, .45, tr2.z);
        var cc2 = vivoC ? 0xb8ff6a : (Math.floor(t * 12) % 2 ? 0x2a3a1a : 0x14101c);
        V.cableExt[0].material.color.setHex(cc2); V.cableExt[1].material.color.setHex(cc2);
        if (vivoC) {                                       // pulsos de luz que viajan por el cable
          V.ptr = (V.ptr || 0) - dt;
          if (V.ptr < 0) { V.ptr = .07; var uu = c.fx(); V.part.soltar(15.8 + (10.5 - 15.8) * uu, 1.6 + 3 * uu, -21.5 + 7 * uu, 1, { k: 'chispa', cols: ['#d8ff8a', '#ffffff'], vel: .4, arriba: .3, g: 0, vida: .4, esc: .8 }); }
        }
      }
      V.luzPl.intensity = plantaOn ? 2.4 + .6 * Math.sin(t * 25) : 0;
      /* polvito y zancudos dando vueltas en la luz */
      V.motaT -= dt; if (V.motaT < 0 && cand.length) { V.motaT = .12; var tm = V.tiles[cand[Math.floor(c.fx() * Math.min(cand.length, NLUZ))].k];
        V.part.soltar(tm.x + (c.fx() - .5) * 3, 1 + c.fx() * 2.5, tm.z + (c.fx() - .5) * 2, 1, { k: 'chispa', cols: ['#fff3c0', '#ffe9a0'], vel: .5, arriba: .3, g: .2, vida: 1.8, esc: .3 }); }
      /* Don Corte */
      var dc = lv >= 3 && !!R && !!R.spir && now < R.Tback;
      V.corte.g.visible = dc;
      if (dc) {
        V.corte.anim('empujar', { vel: .8 }).cara(Math.floor(t * 2) % 2 ? 'feliz' : 'enojado').rumbo(Math.PI * .85).update(dt); V.corte.g.position.y = Math.abs(Math.sin(t * 9)) * .35;
        V.palanca.rotation.z = Math.sin(t * 9) * .5;
        V.dcT = (V.dcT || 0) - dt; if (V.dcT < 0) { V.dcT = .22; chispazo3D(V, -12 + (c.fx() - .5) * 2, 5.2, -13.4, 6, .35); }
      } else { V.palanca.rotation.z = 0; V.corte.g.position.y = 0; }
      /* EL PERRO: ladra en el borde (aviso) y cruza la fila corriendo; lo que toca, sale volando */
      var Pe = V.perro, pk;
      if (D) {
        var px3 = WX(D.x), pz3 = WZ(D.y), dir = D.P.dir;
        Pe.visible = true; Pe.scale.setScalar(1.7); Pe.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        V.carril.visible = true; V.carril.position.z = WZ(D.P.y); V.carril.material.opacity = .22 + .2 * Math.abs(Math.sin(t * 10));
        if (!D.corre) {                                    // ladrando: salta con cada ¡GUAU!, la cabeza hacia atrás, la cola loca
          var ld = Math.max(0, Math.sin(t * 13));
          Pe.position.set(px3, ld * .3, pz3); V.cabP.rotation.x = -.5 * ld; V.cola.rotation.y = Math.sin(t * 30) * .8; V.lomo.rotation.x = -.2 * ld;
          for (pk = 0; pk < V.patasP.length; pk++) V.patasP[pk].rotation.x = pk < 2 ? -.35 * ld : 0;
          V.guauT -= dt; if (V.guauT < 0) { V.guauT = .46; V.part.soltar(px3 + dir * 2.4, 3, pz3, 5, { k: 'chispa', cols: ['#ffd23f', '#ffffff'], vel: 3, arriba: 1.5, g: 2, vida: .4 }); V.esc.sacudir(.12); }
        } else {                                           // corriendo: patas a todo, cuerpo rebotando, polvo atrás
          var ph = t * 26;
          Pe.position.set(px3, Math.abs(Math.sin(ph)) * .45, pz3); V.cabP.rotation.x = .12 * Math.sin(ph); V.cola.rotation.y = Math.sin(ph * 1.3) * .9; V.lomo.rotation.x = .14 * Math.sin(ph + 1);
          for (pk = 0; pk < V.patasP.length; pk++) V.patasP[pk].rotation.x = Math.sin(ph + (pk % 2 ? Math.PI : 0) + (pk > 1 ? 1 : 0)) * 1.0;
          V.perroX = (V.perroX || 0) - dt; if (V.perroX < 0) { V.perroX = .04; V.part.soltar(px3 - dir * 1.8, .15, pz3, 2, { k: 'gota', cols: ['#c9c4d8', '#8a8496'], vel: 2.2, arriba: 1.2, g: 5, vida: .5, esc: 1 }); }
        }
      } else { Pe.visible = false; V.carril.visible = false; }
      /* los coroticos en el piso: giran, flotan, brillan; al agarrarlos estallan y se van volando hacia quien los tomó */
      for (a = 0; a < ITEMS.length; a++) {
        var I = ITEMS[a], i3 = V.items3[a], viv = itemVivo(I, now), ic = centro(I.k);
        if (viv) {
          if (!i3.on) { i3.on = 1; V.part.soltar(WX(ic.x), 1, WZ(ic.y), 14, { k: 'chispa', cols: ['#ffe9a0', '#ffffff', '#ffb03a'], vel: 3, arriba: 3, g: 6, vida: .7 }); }
          i3.g.visible = true; i3.g.position.set(WX(ic.x), 1 + .35 * Math.abs(Math.sin(t * 3 + a)), WZ(ic.y)); i3.g.rotation.y = t * 2.2; i3.g.scale.setScalar(1 + .08 * Math.sin(t * 8 + a));
          if (i3.g.userData.llama) i3.g.userData.llama.scale.set(1, 1 + .3 * Math.sin(t * 15 + a), 1);
          i3.halo.visible = true; i3.halo.scale.setScalar(1 + .25 * Math.sin(t * 6 + a)); i3.halo.material.opacity = .45 + .3 * Math.sin(t * 6 + a);
          if (fz3 && Math.floor(t * 10 + a) % 5 === 0) V.part.soltar(WX(ic.x), 1.8, WZ(ic.y), 1, { k: 'chispa', cols: ['#ffe9a0'], vel: .8, arriba: 1, g: 0, vida: .5, esc: .6 });
        } else if (i3.on) {
          i3.on = 0; i3.g.visible = false; i3.halo.visible = false;
          V.part.soltar(WX(ic.x), 1.2, WZ(ic.y), I.id in tomado ? 20 : 8, { k: 'chispa', cols: I.tipo === 1 ? ['#ffb03a', '#fffdf2'] : ['#fff8c0', '#ffffff', '#ffd23f'], vel: 4, arriba: 4, g: 7, vida: .8 });
          if (I.id in tomado) V3.sfx('moneda');
        }
      }
      /* la linterna: círculos de luz en las que se van a quedar prendidas (solo los ve el que la carga) */
      var Rp = c.yo >= 0 && P[c.yo] && (P[c.yo].it & 2) && !P[c.yo].st ? previa(now) : null, ns = 0;
      if (Rp) for (k = 0; k < NT && ns < V.spots.length; k++) if (Rp.safe[k]) { var cs3 = centro(k), sm = V.spots[ns++]; sm.visible = true; sm.position.x = WX(cs3.x); sm.position.z = WZ(cs3.y); sm.material.opacity = .45 + .25 * Math.sin(t * 9 + k); sm.scale.setScalar(1.4 + .15 * Math.sin(t * 9)); }
      for (; ns < V.spots.length; ns++) V.spots[ns].visible = false;
      /* los jugadores */
      var vela = 0, vx0 = 0, lcv = null, lcl = null, algunoNuevo = false;
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], pj = s3.pj;
        if (q.st) {
          if (!s3.cayo) {                                  // se fue con la luz: cae al vacío detrás de su baldosa
            s3.cayo = 1; s3.caeT = t; s3.x = WX(q.fx); s3.z = WZ(q.fy); s3.y = 0; s3.vy = 2.5; s3.giro = (c.fx() - .5) * 6; s3.silla = V.caidos++ % 4; algunoNuevo = true;
            pj.uno('caer'); V3.sfx('caida'); V3.sfx('error'); V3.sfx('silbido'); V.esc.sacudir(p === c.yo ? 1.2 : .7); V.flash = Math.max(V.flash, .35);
            V.part.soltar(s3.x, .4, s3.z, 22, { k: 'chispa', cols: [LUZ, '#fffdf2', '#5a5a6e'], vel: 5, arriba: 3.5, vida: .8 });
            V.part.soltar(s3.x, .3, s3.z, 10, { k: 'gota', cols: ['#4a4458', '#8a8496'], vel: 3, arriba: 1.5, vida: .7, esc: 1.2 });
          }
          var seat = s3.silla;
          if (t - s3.caeT < 1.3) {
            s3.vy -= 22 * dt; s3.y += s3.vy * dt; s3.rumbo += s3.giro * dt;
            pj.anim('gritar').cara('susto').rumbo(s3.rumbo).update(dt);
            pj.g.position.set(s3.x, s3.y, s3.z); pj.g.visible = s3.y > -19; pj.g.rotation.x = (t - s3.caeT) * 3; pj.g.scale.setScalar(1.35 * Math.max(.45, 1 + s3.y * .03));
          } else {                                           // en el banco, triste, con su vela
            if (s3.banco !== seat) { s3.banco = seat; pj.g.rotation.x = 0; pj.g.scale.setScalar(1.35); V.part.soltar(BANCO3[seat], 1.5, 11, 8, { k: 'chispa', cols: ['#c9c4d8', '#fffdf2'], vel: 2, arriba: 1.5, vida: .5 }); }
            pj.g.visible = true; pj.anim('sentado').cara(fin ? 'triste' : (Math.floor(t * .5 + p) % 3 ? 'dormido' : 'triste')).rumbo(0).mirar(Math.sin(t * .7 + p) * .6, 0).update(dt);
            pj.g.position.set(BANCO3[seat], .45, 11.25);
            var vl = V.velas[seat]; vl.g.visible = true; var fl = 1 + .25 * Math.sin(t * 17 + p * 2); vl.llama.scale.set(fl, 1 + .3 * Math.sin(t * 13 + p), fl);
            vela++; vx0 += BANCO3[seat];
          }
          s3.aro.visible = false; s3.icoV.visible = false; s3.icoL.visible = false;
          continue;
        }
        var enA = c.mio(p) ? aire(q, now) : !!q.h;
        if (enA && !s3.aire) { s3.hopT = t; pj.uno('saltar'); if (p === c.yo) V3.sfx('salto'); V.part.soltar(s3.x, .15, s3.z, 6, { k: 'gota', cols: ['#8a8496', '#c9c4d8'], vel: 2, arriba: .8, g: 4, vida: .35, esc: .7 }); }
        if (!enA && s3.aire) { s3.aterT = t; V.part.soltar(s3.x, .15, s3.z, 12, { k: 'gota', cols: ['#8a8496', '#c9c4d8'], vel: 3.2, arriba: 1.2, g: 6, vida: .5, esc: 1 }); }
        s3.aire = enA;
        if (q.empT !== s3.empT) { s3.empT = q.empT; if (q.empT > 0) { var emp3 = empujeDe3D(p, t); pj.impacto(emp3.x, emp3.z, 1.2); s3.sustoT = t + .9; V3.sfx('choque'); V.esc.sacudir(.4); V.part.soltar(s3.x, 2, s3.z, 14, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff8a8a'], vel: 5, arriba: 2.5, vida: .5 }); } }
        if (q.pk !== s3.pk) { s3.pk = q.pk; if (q.pk > 0) { pj.uno('festejo'); s3.felizT = t + 1.2; V.part.soltar(s3.x, 2.4, s3.z, 18, { k: 'chispa', cols: ['#ffe9a0', '#ffffff', '#ffb03a'], vel: 4, arriba: 4, g: 7, vida: .8 }); V3.sfx('moneda'); } }
        if (q.salvT !== s3.salvT) { s3.salvT = q.salvT; if (q.salvT > 0) { pj.uno('saltar'); s3.felizT = t + 1.2; V.part.soltar(s3.x, 1.5, s3.z, 22, { k: 'chispa', cols: ['#ffb03a', '#fffdf2'], vel: 5, arriba: 4, vida: .9 }); V.esc.sacudir(.5); } }
        if (q.velaT !== s3.velaT) { s3.velaT = q.velaT; if (q.velaT > 0) { s3.sustoT = t + .8; V.part.soltar(s3.x, 3.6, s3.z, 10, { k: 'gota', cols: ['#8a8a9a', '#5a5a6a'], vel: 1.2, arriba: 1.5, g: -1, vida: 1, esc: 1.2 }); V3.sfx('pop'); } }
        var tx = WX(q.x), tz = WZ(q.y), vx = (tx - s3.x) / dt, vz = (tz - s3.z) / dt, v = Math.sqrt(vx * vx + vz * vz);
        s3.x = tx; s3.z = tz;
        if (v > .5 && v < 60) s3.rumbo = Math.atan2(vx, vz);
        var hop = enA ? Math.min(1, (t - s3.hopT) / HOP) : 0, y = enA ? Math.sin(Math.PI * hop) * 1.6 : 0;
        var Ft = fase(tileDe(q.x, q.y), now), tumbo = c.mio(p) ? (q.kvx * q.kvx + q.kvy * q.kvy > STUN * STUN || now < q.tumbT) : t - s3.vueloT < .7, vn = Math.min(1, v / 9);
        /* ¡EL PERRO! el que está en su camino (en el piso) sale volando; el que brinca encima, lo esquiva */
        var vuelo = -1;
        if (D && D.corre && !enA) {
          if (s3.perroI !== D.P.i && Math.abs(D.x - q.x) < PRX + 8 && Math.abs(D.y - q.y) < PRY + 6) {
            s3.perroI = D.P.i; s3.vueloT = t; s3.vueloDir = D.P.dir; s3.sustoT = t + 1.2; pj.volar(s3.x - WX(D.x), s3.z - WZ(D.y), 1.6); V3.sfx('golpe'); V3.sfx('choque'); V.esc.sacudir(.9); V.flash = Math.max(V.flash, .3);
            V.part.soltar(s3.x, 2, s3.z, 20, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff8a8a'], vel: 6, arriba: 3, vida: .6 });
            var sb = V.esc.proyectar(s3.x, 5.4, s3.z); S('¡AUCH!', sb.x, sb.y, '#ff8a3f');
          }
        }
        if (D && D.corre && enA && s3.brincoI !== D.P.i && Math.abs(D.x - q.x) < PRX + 26 && Math.abs(D.y - q.y) < PRY + 10) {
          s3.brincoI = D.P.i; pj.uno('esquivar'); s3.felizT = t + 1.2; V3.sfx('ding'); V.part.soltar(s3.x, .5, s3.z, 12, { k: 'chispa', cols: ['#9affc8', '#ffffff'], vel: 4, arriba: 2, g: 6, vida: .6 });
          var sb2 = V.esc.proyectar(s3.x, 5.4, s3.z); S('¡BRINCÓ AL PERRO!', sb2.x, sb2.y, '#9affc8');
        }
        if (t - s3.vueloT < .8) vuelo = (t - s3.vueloT) / .8;
        if (fin && now > 0) { if (!s3.fest) { s3.fest = 1; pj.uno('festejo'); } pj.anim('celebrar').cara('feliz'); s3.rumbo = 0; }
        else if (vuelo >= 0) pj.anim('empujado').cara(vuelo < .55 ? 'susto' : 'mareado');
        else if (enA) pj.anim('aire').cara(t < s3.felizT ? 'feliz' : 'concentrado');
        else if (tumbo) pj.anim('mareado').cara('mareado');
        else {
          pj.anim(v > 4 ? 'correr' : v > .8 ? 'caminar' : 'quieto', { vel: vn });
          var enFila = D && Math.abs(D.y - q.y) < TH * .9 && Math.abs(D.x - q.x) < 190;
          pj.cara(t < s3.sustoT || Ft.f === 3 || Ft.f === 6 || enFila ? 'susto' : t < s3.felizT ? 'feliz' : Ft.f === 1 || Ft.f === 7 ? 'feliz' : Ft.f === 2 ? 'concentrado' : 'normal');
        }
        /* mira hacia el peligro: el perro, la baldosa que revienta o el titileo */
        if (D) pj.mirarA({ x: WX(D.x), y: 1.5, z: WZ(D.y) });
        else pj.mirar(0, Ft.f === 3 ? -.4 : 0);
        pj.rumbo(s3.rumbo).update(dt);
        /* squash/stretch, pánico en la baldosa que se apaga, el vuelo del perro */
        var sx = 1, sy = 1, rz = 0, rx = 0;
        if (enA) { var hu = (t - s3.hopT) / HOP; sy = hu < .12 ? .82 + 1.5 * hu : hu < .6 ? 1.16 : 1.16 - .3 * (hu - .6); sx = 1 / Math.sqrt(sy); }
        else if (t - s3.aterT < .22) { var au = (t - s3.aterT) / .22; sy = .72 + .28 * au; sx = 1 / Math.sqrt(sy); }
        if (!enA && Ft.f === 3 && Ft.u > .4) { rz = Math.sin(t * 40 + p) * .08 * Ft.u; y += Math.abs(Math.sin(t * 16 + p)) * .22 * Ft.u; }
        if (!enA && Ft.f === 6) { rz = Math.sin(t * 60 + p) * .12; y += Math.abs(Math.sin(t * 22 + p)) * .3; }
        pj.g.scale.set(1.35 * sx, 1.35 * sy, 1.35 * sx); pj.g.rotation.x = rx; pj.g.rotation.z = rz;
        pj.g.position.set(s3.x, y, s3.z); pj.g.visible = true;
        if (v > 4 && !enA && !tumbo) { s3.ptr -= dt; if (s3.ptr < 0) { s3.ptr = .11; V.part.soltar(s3.x, .1, s3.z, 1, { k: 'gota', cols: ['#8a8496', '#c9c4d8'], vel: 1.2, arriba: .6, g: 3, vida: .4, esc: .6 }); } }
        s3.aro.visible = true; s3.aro.position.set(s3.x, .1, s3.z); s3.aro.material.opacity = Ft.f === 3 ? .4 + .45 * Math.abs(Math.sin(t * 12)) : .85;
        /* lo que carga flota sobre la cabeza y alumbra */
        s3.icoV.visible = !!(q.it & 1); s3.icoL.visible = !!(q.it & 2);
        if (q.it & 1) { s3.icoV.position.set(s3.x - .7, y + 4.4 + .15 * Math.sin(t * 4 + p), s3.z); s3.icoV.rotation.y = t * 2; if (s3.icoV.userData.llama) s3.icoV.userData.llama.scale.set(1, 1 + .3 * Math.sin(t * 15 + p), 1); if (!lcv) lcv = s3; }
        if (q.it & 2) { s3.icoL.position.set(s3.x + .7, y + 4.4 + .15 * Math.sin(t * 4 + p + 1), s3.z); s3.icoL.rotation.y = t * 1.5; if (!lcl) lcl = s3; }
      }
      if (algunoNuevo) for (p = 0; p < n; p++) if (!P[p].st) { V.pjs[p].felizT = Math.max(V.pjs[p].felizT, t + 1); if (!V.pjs[p].aire) V.pjs[p].pj.uno('festejo'); }
      V.luzVela.intensity = vela ? 1.6 + .3 * Math.sin(t * 17) : 0; if (vela) V.luzVela.position.set(vx0 / vela, 2, 12.3);
      V.luzCV.intensity = lcv ? 2.2 + .4 * Math.sin(t * 17) : 0; if (lcv) V.luzCV.position.set(lcv.x, 4.2, lcv.z);
      V.luzCL.intensity = lcl ? 3.2 : 0; if (lcl) V.luzCL.position.set(lcl.x, 4.4, lcl.z);
      if (fin && now > 0 && !V.festejo) { V.festejo = 1; V3.sfx('aplauso'); }
      /* cámara: casi quieta, se corre un poquito hacia los vivos */
      var cxx = 0, vv = 0;
      for (p = 0; p < n; p++) if (!P[p].st) { cxx += V.pjs[p].x; vv++; }
      var meta = vv ? Math.max(-2.5, Math.min(2.5, cxx / vv * .25)) : 0;
      V.cam.x += (meta - V.cam.x) * Math.min(1, dt * 1.5);
      V.esc.encuadrar(MW + 6, MD + 4, new THREE.Vector3(V.cam.x, .5, 2.5), .82);
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !P[c.yo].st;
      if (yo && !P[c.yo].st) V.flecha.position.set(yo.x, yo.pj.g.position.y + 4.6 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
    }
    /* dónde poner un texto 2D sobre un jugador: proyectado desde el 3D, o la cuenta de siempre en 2D */
    function sobre(p, alto) {
      if (v3) { var s3 = v3.pjs[p]; return v3.esc.proyectar(s3.x, alto, s3.z); }
      var G = geom(), sp = aPant(G, P[p].x, P[p].y); return { x: sp.x, y: sp.y - 120 * G.s };
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p, mx = (f.x0 + f.x1) / 2; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);                    // sin update entre dos cuadros no hay nada que mover
      if (now >= 0 && vivos() > 1) V3.musica('apagon');
      v3.esc.render(dt);
      for (p = 0; p < n; p++) {
        var s3 = v3.pjs[p];
        if (P[p].st) {
          if (s3.banco >= 0 && absT - s3.caeT >= 1.3) { var pv = v3.esc.proyectar(BANCO3[s3.banco], 0, 12.6); txt('CON VELA', pv.x, pv.y, 10, LUZ2, 0, true); }
          continue;
        }
        var pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.2);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (p === c.yo && now >= 0 && fase(tileDe(P[p].x, P[p].y), now).f === 3) { var pm = v3.esc.proyectar(s3.x, 5.6, s3.z); txt('¡MUÉVETE!', pm.x, pm.y, 15, '#ff5c5c', 0, true); }
      }
      var Dl = perroEn(now);
      if (Dl) { var pg = v3.esc.proyectar(WX(Dl.x), 4.4, WZ(Dl.y)); if (!Dl.corre) { txt('¡GUAU!', pg.x, pg.y - 6 * Math.abs(Math.sin(absT * 13)), 17 + 3 * Math.sin(absT * 13), '#ffb03a', 0, true); txt(Dl.P.dir > 0 ? '>>>' : '<<<', pg.x + Dl.P.dir * 40, pg.y + 26, 16, '#ff5c5c', 0, true); } else txt('¡CUIDADO!', pg.x, pg.y, 13, '#ff8a8a', 0, true); }
      for (p = 0; p < n; p++) if (!P[p].st && now >= 0) { var Fh = fase(tileDe(P[p].x, P[p].y), now); if (Fh.f === 6) { var ph2 = v3.esc.proyectar(v3.pjs[p].x, 5.8, v3.pjs[p].z); txt('¡REVIENTA!', ph2.x, ph2.y, 14, '#bfe4ff', 0, true); } }
      if (v3.corte.g.visible) { var pc = v3.esc.proyectar(-12, 5, -11.6); txt('DON CORTE', pc.x, pc.y, 12, '#ff8a8a', 0, true); }
      txt('EN PIE ' + vivos() + '/' + n, mx, 86, 13, '#fffdf2', 0, true);
      var R = rondaEn(now);
      if (R && now >= lead + 1.2 && now >= R.dmin - DROP && now < R.dmin) txt('SE CAEN EN ' + (R.dmin - now).toFixed(1), mx, 108, 15, '#ff8a8a', 0, true);
      if (now < lead + 1.2 && !c.practica) { txt('SE FUE LA LUZ EN TODA LA CASA…', mx, 112, 15, '#fffdf2', 0, true); txt('…PERO ALGUNOS BOMBILLOS AGUANTAN', mx, 130, 13, LUZ2, 0, true); }
      if (now >= -0.4 && now < 2.2 && !c.practica) txt('¡PÁRATE DONDE HAY LUZ!', mx, 154, 21, LUZ, 0, true);
      if (banT > 0) txt(banTxt, mx, 154, 24 + Math.sin(absT * 14), '#ff5c5c', 0, true);
      else if (now >= dur - 12 && now < dur - 9.5) txt('¡SE VA TODO!', mx, 154, 24, '#ff8a3f', 0, true);
      if (typeof drawP === 'function') drawP();
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, a;
        absT += dt; shake = Math.max(0, shake - dt * 3); banT = Math.max(0, banT - dt);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        for (p = 0; p < n; p++) {                          // aterrizajes vistos en ESTA pantalla (propios o del campo h remoto)
          var q = P[p], enA = !q.st && (c.mio(p) ? aire(q, now) : !!q.h);
          if (q.air && !enA && !q.st) aterriza(p, now);
          q.air = enA;
        }
        if (now >= 0) for (p = 0; p < n; p++) if (c.mio(p)) {
          separar(p, dt, now); perroChoca(p, now); recoger(p, now);
          if ((P[p].it & 2) && now >= P[p].lintH) P[p].it &= ~2;
          caida(p, now);
        }
        /* fases, perro, subidón, planta y coroticos: avisos, banners y sonido (cosmético; los momentos salen del mundo determinista) */
        var R = rondaEn(now), fzN = now >= 0 ? faseJ(now) : 1;
        if (fzN !== fzVisto) {
          fzVisto = fzN;
          if (fzN === 2) { bandera('¡SE PONE FEO!', '#ff8a3f', 2); if (v3) { V3.sfx('bocina'); v3.esc.sacudir(.5); } else SND(220, 0.4, 'sawtooth', 0.05, 60); }
          else if (fzN === 3) { bandera('¡ÚLTIMOS SEGUNDOS!', '#ff3a3a', 2.4); shake = Math.max(shake, 0.6); if (v3) { V3.sfx('trueno'); V3.sfx('silbato'); v3.esc.sacudir(1); v3.flash = 1; } else SND(110, 0.6, 'sawtooth', 0.07, 200); }
        }
        var D = perroEn(now);
        if (D) {
          var fp = fxP[D.P.i] || (fxP[D.P.i] = {});
          if (!fp.a) { fp.a = 1; bandera('¡SE SOLTÓ EL PERRO!', '#ffb03a', 1.6); if (v3) { V3.sfx('silbido'); V3.sfx('bocina'); v3.esc.sacudir(.5); } else SND(520, 0.12, 'square', 0.05, -200); }
          if (D.corre && !fp.c) { fp.c = 1; if (v3) { V3.sfx('whoosh'); V3.sfx('golpe'); V3.sfx('latido'); v3.esc.sacudir(.6); } else SND(300, 0.15, 'square', 0.05, -150); }
          if (!D.corre && Math.floor(absT * 4) % 2 === 0 && !fp['l' + Math.floor(absT * 2)]) { fp['l' + Math.floor(absT * 2)] = 1; if (v3) V3.sfx('tic'); else SND(420, 0.06, 'square', 0.04, -120); }   // ¡guau!
        }
        if (R) {
          var fh = fxR[R.i] || (fxR[R.i] = {});
          for (a = 0; a < NT; a++) if (R.hot[a]) {
            if (now >= R.hot[a] && !fh['h' + a]) { fh['h' + a] = 1; bandera('¡SUBIDÓN!', '#bfe4ff', 1.3); if (v3) { V3.sfx('chispa'); V3.sfx('bocina'); v3.esc.sacudir(.45); var th = v3.tiles[a]; v3.part.soltar(th.x, .8, th.z, 20, { k: 'chispa', cols: ['#bfe4ff', '#ffffff'], vel: 5, arriba: 5, g: 10, vida: .6 }); var sh = v3.esc.proyectar(th.x, 4.2, th.z); S('¡SE RECALIENTA!', sh.x, sh.y, '#bfe4ff'); } else SND(1400, 0.25, 'sawtooth', 0.03, 600); }
            if (now >= R.off[a] && !fh['p' + a]) { fh['p' + a] = 1; shake = Math.max(shake, 0.35); if (v3) { V3.sfx('pop'); V3.sfx('trueno'); v3.esc.sacudir(1.1); v3.flash = 1; var tp = v3.tiles[a]; v3.part.soltar(tp.x, .8, tp.z, 34, { k: 'chispa', cols: ['#bfe4ff', '#ffffff', '#6ab4ff', '#ffd23f'], vel: 8, arriba: 6, g: 12, vida: .9 }); v3.part.soltar(tp.x, .3, tp.z, 12, { k: 'gota', cols: ['#3a3a4a', '#8a8a9a'], vel: 3, arriba: 2, g: -1, vida: 1.2, esc: 1.6 }); } else SND(160, 0.2, 'square', 0.07, -100); }
          }
          if (R.resc >= 0 && now >= R.rescT && !fh.pl) { fh.pl = 1; bandera('¡LA PLANTA DEL VECINO!', '#b8ff6a', 1.5); if (v3) { V3.sfx('motor'); V3.sfx('ding'); V3.sfx('chispa'); v3.esc.sacudir(.6); v3.flash = .8; var tq2 = v3.tiles[R.resc]; v3.part.soltar(tq2.x, .8, tq2.z, 30, { k: 'chispa', cols: ['#d8ff8a', '#ffffff', '#9aff3a'], vel: 6, arriba: 5, g: 8, vida: .9 }); v3.part.soltar(15.8, 2, -21.5, 18, { k: 'chispa', cols: ['#d8ff8a', '#ffffff'], vel: 4, arriba: 3, g: 6, vida: .8 }); var sq2 = v3.esc.proyectar(tq2.x, 4.2, tq2.z); S('¡LA PLANTA LA PRENDIÓ!', sq2.x, sq2.y, '#b8ff6a'); } else SND(660, 0.2, 'triangle', 0.05, 300); }
        }
        for (a = 0; a < ITEMS.length; a++) if (now >= ITEMS[a].t0 && !fxI[a]) {
          fxI[a] = 1; var ctI = centro(ITEMS[a].k), GI = geom(), spI = v3 ? v3.esc.proyectar(WX(ctI.x), 2.5, WZ(ctI.y)) : aPant(GI, ctI.x, ctI.y - 40);
          S(ITEMS[a].tipo === 1 ? '¡UNA VELA!' : '¡UNA LINTERNA!', spI.x, spI.y, LUZ2); if (v3) V3.sfx('ding'); else SND(1200, 0.08, 'triangle', 0.04, 200);
        }
        /* sonido y banners por ronda (cosmético) */
        if (R) {
          var fr = fxR[R.i] || (fxR[R.i] = {}), dmin = 1e9;
          for (a = 0; a < NT; a++) if (!R.safe[a] && R.drop[a] < dmin) dmin = R.drop[a];
          if (!fr.w && now >= R.W) { fr.w = 1; if (v3) ronda3D('w', R); else SND(880, 0.07, 'square', 0.03); if (R.spir) bandera('¡DON CORTE!', '#ff5c5c', 1.8); else if (R.uno) bandera('¡UN SOLO BOMBILLO!', '#ff5c5c', 1.8); }
          if (!fr.o && now >= dmin - DROP) { fr.o = 1; if (v3) ronda3D('o', R); else SND(90, 0.3, 'sawtooth', 0.05, -40); }
          if (!fr.d && now >= dmin) { fr.d = 1; if (v3) ronda3D('d', R); else SND(120, 0.25, 'triangle', 0.07, -80); shake = Math.max(shake, 0.3); }
          if (!fr.b && now >= R.Tback) { fr.b = 1; if (v3) ronda3D('b', R); else SND(660, 0.15, 'triangle', 0.05, 200); }
        }
        while (polvos.length && now - polvos[0].t > 0.4) polvos.shift();
      },
      ai: function (p, dt, api) { ai(p, dt, api, c.ahora()); },
      cuerpo: function (p) { var q = P[p]; return { x: Math.round(q.x), y: Math.round(q.y), h: q.h ? 1 : 0, st: q.st, sc: q.sc, it: q.it, pk: q.pk }; },
      onEv: function (ty, p, d) {
        var now = c.ahora(), q = P[p], G = geom();
        if (ty === 'out' && q) {
          var sp = aPant(G, q.x, q.y), pt = sobre(p, 4.4);
          if (!q.st) S(p === c.yo ? '¡ME FUI CON LA LUZ!' : '¡PA\'BAJO!', pt.x, pt.y, '#ffd23f');
          if (!q.st && !v3) { shake = 0.5; SPAWN(sp.x, sp.y - 20 * G.s, 10, 'conf', [LUZ, '#fffdf2', '#5a5a6e'], 240, 500, 0.6); SND(300, 0.5, 'sawtooth', 0.07, -260); }
          elim(p, d && d.kk != null ? d.kk : Math.floor(now * 30));
        }
      },
      claimOk: function () { return false; },
      concede: function () {},
      alCpu: function (p) { P[p].own = false; var rm = c.remoto(p); if (rm && !P[p].st) { P[p].x = rm.x; P[p].y = rm.y; P[p].it = rm.it | 0; if (P[p].it & 2) P[p].lintH = c.ahora() + 3; } },
      alHum: function (p, o) { P[p].own = false; if (o) { if (o.st && !P[p].st) elim(p, o.sc); else if (!o.st) { P[p].x = o.x; P[p].y = o.y; P[p].it = o.it | 0; } } },
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
        return q.st ? 'se fue con la luz a los ' + Math.max(0, Math.floor(q.sc / 30)) + ' s' : '¡más prendido que la planta del vecino!';
      },
      vista: function () {
        return { gt: c.ahora(), lv: lv, lead: lead, hash: hash, nRondas: rondas.length,
          rondas: rondas.map(function (R) { return { i: R.i, S: +R.S.toFixed(3), W: +R.W.toFixed(3), rev: R.rev, Tback: +R.Tback.toFixed(3), spir: R.spir, uno: !!R.uno, flick: R.flick, safe: R.safe.slice(), off: R.off.slice(), drop: R.drop.slice(), hot: R.hot.slice(), resc: R.resc, rescT: R.rescT }; }),
          F2: F2, F3: F3, fase: faseJ(c.ahora()), perros: PERROS.map(function (D) { return { t0: D.t0, t1: D.t1, t2: D.t2, fila: D.fila, y: D.y, dir: D.dir, v: D.v }; }),
          items: ITEMS.map(function (I) { return { id: I.id, tipo: I.tipo, k: I.k, t0: I.t0, t1: I.t1, hasta: I.hasta, por: I.id in tomado ? tomado[I.id] : -1 }; }),
          it: P.map(function (q) { return q.it; }), pk: P.map(function (q) { return q.pk; }), perro: (function () { var D = perroEn(c.ahora()); return D ? { x: D.x, y: D.y, corre: D.corre } : null; })(),
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), h: P.map(function (q) { return q.h; }), st: P.map(function (q) { return q.st; }),
          sc: P.map(function (q) { return q.sc; }), hopT: P.map(function (q) { return q.hopT; }), kv: P.map(function (q) { return Math.sqrt(q.kvx * q.kvx + q.kvy * q.kvy); }),
          vivos: vivos(), TW: TW, TH: TH, DROP: DROP, HOP: HOP };
      },
      hueco: function (k, t) { return hueco(k, t); },

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
