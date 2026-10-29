'use strict';
/* LA FIESTA · ¡SUBE EL CERRO! (f_cerro) · modelo A (cancha propia) · FFA por puestos (rank) · 35 s
   La ladera del Ávila: repisas de roca y tierra (se suben desde abajo) con huecos. Hay que llegar a la cima.
   Eventos (telegrafiados, de c.rng en mk): ráfagas de viento que empujan a todos (aviso 1 s antes), derrumbes que botan una repisa (tiembla, cae, vuelve) y, desde el 70 % del tiempo, ¡ÚLTIMOS SEGUNDOS!: piedras más rápidas y seguidas.
   Stick izquierda/derecha + A = saltar. Sin contacto entre jugadores: los demás se ven EN VIVO, semitransparentes, y no estorban.
   Cada dueño simula SOLO su cuerpo (los de CPU los simula el juez con el mismo físico y el mismo `ai`). El mundo (plataformas, tendederos, tobos de agua
   desde las ventanas) sale de c.rng en mk, idéntico en las n pantallas. Los tobos se juzgan LOCALMENTE (la víctima decide): te tumban 1 piso.
   Niveles: 1 huecos + tobos; 2 suma tendederos que rebotan y más tobos; 3 suma el perro de la señora Carmen, que te persigue en tu piso (local de cada dueño).
   Puntaje (entero): quien no llegó = altura alcanzada en milésimas de la platabanda (0..999, solo cuenta parado en un piso); quien llegó = 1000 + (dur*30 - tick)
   (llegar antes = más). Un empate comparte puesto. done() = todos llegaron, o 3,5 s después del primero (los demás aún suben).
   Empujones (nivel 1, 2 y 3): los cuerpos SÍ se tocan. Quien se te echa encima te empuja (más fuerte cuanto más rápido venga) y te puede sacar de la repisa; un pisotón (caer sobre otro) te rebota y aturde al de abajo.
   Cada dueño aplica el empujón SOLO a su cuerpo, viendo al otro en vivo (la víctima decide, como los tobos).
   Aves (zamuro lento y grande, loro rápido y ondulante, en bandada al final): cruzan la ladera en vuelo horizontal, avisan 1 s antes con un carril en pantalla y, si te alcanzan, te aturden y te lanzan de lado. Se esquivan saltando.
   Brisa: las ráfagas se ven (rayas de aire, hojas) y arrastran de lado; los jugadores se inclinan contra ellas. Más fuertes en los últimos segundos.
   Cuerpo en red (o): x, y, sc, tf (tick de llegada, 0 si no), st (0 normal, 1 aturdido, 2 arriba). Sin mensajes propios (solo `o`). Sin Math.random/Date.now:
   azar de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético usa spawn/say del lab. Se carga DESPUÉS de fiesta-live.js. Dibuja SOLO con primitivas del lab.
   Dibujo 3D low poly (fiesta-3d.js, doc 15): el edificio y el barrio del cerro, pista 'cerro' (salsa brava); el 2D de siempre queda de respaldo (sin WebGL o ?plano=1). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_cerro')) return;

var AW = 320, FH = 56, NF = 18, ROOFY = NF * FH;           // ancho de la ladera, alto de repisa, nº de repisas, altura de la cima
var SPD = 150, JV = 380, GR = 1000, BOUNCE = 560, H = 1 / 60;     // px/s, impulso de salto, gravedad, rebote del tendedero, paso físico
var JBUF = 0.14, COYO = 0.08, STUN = 0.5, INV = 1.2, GRACIA = 3.5, WV = 65;   // WV: empuje del viento (px/s) mientras dura una ráfaga (×1,45 en los últimos segundos)
var VT = 230, DOGV = 100, DOGWAIT = 1.3, DOGCD = 3.2;      // velocidad de caída del tobo, velocidad del perro, espera antes de saltar a tu piso, descanso tras morder
var FOCO = 350, INKC = '#14101c';
var KD = 0.93, BCD = 1.0;      // KD: lo que sobra por paso del empujón recibido (kx se frena solo); BCD: descanso entre empujones

/* paleta por nivel: 1 día, 2 atardecer, 3 noche */
var PAL = {
  1: { sky: '#8fd8ff', sky2: '#d8f4ff', wall: '#e0925f', wall2: '#d27f4d', brick: '#b9663d', plat: '#c9c4d4', win: '#6fb8ee', winlit: '#fff2a8', cerro: '#7cae62', cerro2: '#5f9450', sol: '#ffe14d', calle: '#5a5878' },
  2: { sky: '#ff8f5a', sky2: '#ffd08a', wall: '#c27250', wall2: '#b16342', brick: '#8f4a32', plat: '#b4a8b8', win: '#6a86b8', winlit: '#ffe39a', cerro: '#7a8a52', cerro2: '#5f7040', sol: '#ffe9a0', calle: '#4a3a5a' },
  3: { sky: '#1d1a4a', sky2: '#3a3478', wall: '#5a4a68', wall2: '#4c3d5a', brick: '#3c2f4a', plat: '#8a86a4', win: '#2a3a6a', winlit: '#ffe27a', cerro: '#2f3f5a', cerro2: '#243248', sol: '#f4f0d0', calle: '#2a2840' }
};

function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function SND(f, d, ty, v, sl) { try { if (typeof snd === 'function') snd(f, d, ty, v, sl); } catch (e) { /* sin audio */ } }
function SPAWN(x, y, n, k, cols, sp, g, life) { try { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); } catch (e) { /* sin partículas */ } }
function SAY(s, x, y, col) { try { if (typeof say === 'function') say(s, x, y, col); } catch (e) { /* sin globo */ } }

FIESTA.LIVE.add('f_cerro', {
  name: '¡SUBE EL CERRO!', modos: ['ffa'], clase: 'rank', modelo: 'A', dur: 35,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 2100, scoreRate: 150, minT: 8, finTemprano: 1 },
  cuerpo: ['x', 'y', 'sc', 'tf', 'st'], discretos: ['sc', 'tf', 'st'],
  carta: {
    obj: 'Sube las repisas de la ladera hasta la cima. Cuidado con las piedras y el viento.',
    gana: 'El primero en llegar arriba. Los demás, por la altura alcanzada.',
    como: { tactil: 'Joystick izquierda/derecha · A para saltar', teclado: 'A D o flechas · ESPACIO' },
    demos: [
      { id: 'saltar', txt: 'Salta justo debajo de un piso: lo atraviesas y aterrizas encima' },
      { id: 'tobo', txt: 'La piedra tiembla en la repisa de arriba: sal de la columna antes de que caiga' }
    ],
    roles: null
  },

  mk: function (c) {
    var n = c.n, dur = c.dur, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, pal = PAL[lv], rng = c.rng, i, f;
    var lead = Math.min(2.6, 0.2 * dur);

    /* ───── el mundo: pisos con huecos, tendederos y tobos, idéntico en todos (solo c.rng, solo aquí) ───── */
    var plat = [{ id: 0, f: 0, x0: -40, x1: AW + 40, y: 0, k: 'n' }], pf = [[0]];
    function nueva(f2, x0, x1, k) { var o = { id: plat.length, f: f2, x0: x0, x1: x1, y: f2 * FH, k: k }; plat.push(o); return o; }
    for (f = 1; f < NF; f++) {
      var prev = pf[f - 1].map(function (id) { return plat[id]; }), side = rng.next() < 0.75 ? (f % 2 ? 1 : -1) : (rng.next() < 0.5 ? -1 : 1);
      var w = 64 + rng.int(0, 30), xa = AW / 2 - w / 2, s2 = prev[0], ov0 = 26 + rng.int(0, 14), kp, tries;
      for (tries = 0; tries < 2; tries++) {           // el tramo nuevo solo toca al de abajo por el extremo `side`: obliga a caminar en zigzag
        var cand = prev.slice().sort(function (a1, b1) { return side > 0 ? b1.x1 - a1.x1 : a1.x0 - b1.x0; });
        s2 = cand[rng.int(0, Math.min(1, cand.length - 1))];
        xa = side > 0 ? s2.x1 - ov0 : s2.x0 + ov0 - w;
        xa = cl(xa, 6, AW - 6 - w);
        if (Math.min(s2.x1, xa + w) - Math.max(s2.x0, xa) >= 24) break;
        side = -side;
      }
      var lista = [{ x0: xa, x1: xa + w }];
      var extra = rng.next() < 0.5 ? 2 : 1, e;
      for (e = 0; e < extra; e++) {
        var dir = rng.next() < 0.5 ? -1 : 1, gap = 30 + rng.int(0, 40), w2 = 60 + rng.int(0, 36), t2;
        for (t2 = 0; t2 < 2; t2++) {
          var first = lista[0], last = lista[lista.length - 1], nx0, nx1;
          if (dir > 0) { nx0 = last.x1 + gap; nx1 = nx0 + w2; if (nx1 <= AW - 6) { lista.push({ x0: nx0, x1: nx1 }); break; } }
          else { nx1 = first.x0 - gap; nx0 = nx1 - w2; if (nx0 >= 6) { lista.unshift({ x0: nx0, x1: nx1 }); break; } }
          dir = -dir;
        }
      }
      pf[f] = [];
      for (i = 0; i < lista.length; i++) pf[f].push(nueva(f, Math.round(lista[i].x0), Math.round(lista[i].x1), 'n').id);
    }
    pf[NF] = [nueva(NF, 10, AW - 10, 'r').id];
    var pads = [], npads = lv === 1 ? 0 : lv === 2 ? 4 : 6;
    for (i = 0; i < npads; i++) {                       // tendederos: soltarse sobre ellos rebota ~3 pisos (atajo o susto)
      var pfl = 2 + rng.int(0, NF - 5), px0 = 8 + rng.next() * (AW - 16 - 54), okp = true, j2;
      for (j2 = 0; j2 < pads.length; j2++) if (Math.abs(pads[j2].f - pfl) < 2 && Math.abs(pads[j2].x0 - px0) < 60) okp = false;
      if (okp) { var pd = nueva(pfl, Math.round(px0), Math.round(px0 + 54), 'b'); pd.y = (pfl + 0.5) * FH; pads.push(pd); }
    }
    var tobos = [], tt = lead + 0.6, gB = [1.05, 0.7, 0.55][lv - 1], late = 0.7 * dur;
    while (tt < dur - 1.5) {                            // piedras: se desprenden de la repisa de arriba (aviso de 0,9 s), columna x, hora T. Tras el 70 % van más rápido y seguidas
      var tf2 = rng.int(2, NF), tard = tt >= late;
      tobos.push({ i: tobos.length, T: +tt.toFixed(3), x: Math.round(18 + rng.next() * (AW - 36)), f: tf2, y0: tf2 * FH + 26, k: rng.int(0, 1), v: tard ? VT * 1.3 : VT });
      tt += gB * (tard ? 0.6 : 1) * (0.7 + rng.next() * 0.6);
    }
    /* viento del Ávila: ráfagas de 1,5 s que empujan a todos hacia d (-1 izquierda, 1 derecha). Nivel 1 arranca tarde */
    var gustas = [];
    for (tt = lv === 1 ? 9 : lead + 1.5; tt < dur - 2; ) {
      gustas.push({ T: +tt.toFixed(3), L: 1.5, d: rng.next() < 0.5 ? -1 : 1 });
      tt += (tt >= late ? 3.2 : 5.5) * (0.8 + rng.next() * 0.4);
    }
    /* derrumbes (niveles 2 y 3): la repisa tiembla 1,2 s, se cae y vuelve 3,5 s después. Caes con ella si estás encima */
    if (lv >= 2) for (tt = lead + 4; tt < dur - 4; ) {
      var fd = 2 + rng.int(0, NF - 5), cand = pf[fd].map(function (id) { return plat[id]; }).filter(function (o2) { return o2.k === 'n'; });
      if (cand.length) { var ch = cand[rng.int(0, cand.length - 1)]; ch.caeT = +(tt + 1.2).toFixed(3); ch.volT = +(tt + 4.7).toFixed(3); }
      tt += (tt >= late ? 4.5 : 7) * (0.8 + rng.next() * 0.4);
    }
    var estrellas = [];
    for (i = 0; i < 26; i++) estrellas.push([rng.next(), rng.next(), 1 + rng.next() * 2]);
    var casitas = [];
    for (i = 0; i < 9; i++) casitas.push([rng.next(), 0.2 + rng.next() * 0.7, 0.6 + rng.next() * 0.6, rng.int(0, 5)]);
    var aves = [], at = lead + 2.2, gA = [4.0, 3.0, 2.3][lv - 1];
    while (at < dur - 2.5) {                            // aves en vuelo horizontal: la altura sigue la subida esperada (±2 pisos). Al final, bandadas de loros
      var late2 = at >= late, fa = cl(Math.round(1 + (at / dur) * (NF - 3) + rng.int(-2, 2)), 1, NF - 1), loro = rng.next() < (late2 ? 0.7 : 0.4) ? 1 : 0, dd = rng.next() < 0.5 ? -1 : 1;
      var nb = late2 && loro && rng.next() < 0.5 ? 3 : 1, mb, ya0 = fa * FH + 20 + rng.int(0, 14), ph0 = rng.next() * 6;
      for (mb = 0; mb < nb; mb++) aves.push({ i: aves.length, T: +(at + mb * 0.4).toFixed(3), d: dd, y: ya0 + mb * 9, k: loro, v: loro ? 190 : 125, amp: loro ? 16 : 5, ph: ph0 + mb * 0.8 });
      at += gA * (late2 ? 0.6 : 1) * (0.7 + rng.next() * 0.6);
    }
    var CASAC = ['#ffb36b', '#a9a0ff', '#ff9ec7', '#6ecf8f', '#ffd23f', '#8aa0ff'];

    /* ───── estado por jugador ───── */
    var P = [], cpuR = [], AIS = [];
    function nuevoQ(p) {
      return { x: AW / 2 + (p - (n - 1) / 2) * 26, y: 0, vx: 0, vy: 0, g: 0, co: 0, jb: 0, stun: 0, ig: 1e9, inv: 0, hmax: 0, tf: 0, sc: 0, st: 0, fc: 1,
        own: false, hit: {}, hits: 0, kx: 0, bcd: 0, vel: 0, vely: 0, empN: 0, empK: 0, empD: 0, empT: -9, empes: 0, pisos: 0, lr: null, dog: { pl: -1, x: 0, w: 0, cd: 0, dir: 1, ladra: 0 }, gy: 0, ult: 0, saltos: 0 };
    }
    for (i = 0; i < n; i++) { P.push(nuevoQ(i)); cpuR.push(c.rngFor('cpu' + i)); AIS.push({ plan: null, wait: 0.2, air: 0, cd: 0 }); }
    var acc = 0, cam = 0;

    function scDe(q) { return q.tf ? 1000 + Math.max(0, dur * 30 - q.tf) : Math.min(999, Math.floor(1000 * q.hmax / ROOFY)); }
    function mio(p) { return c.mio(p); }

    function golpe(q, kind) {                           // tobo o perro: aturdido y caes al piso de abajo (ignora el piso donde estás)
      if (q.inv > 0 || q.tf) return false;
      q.stun = STUN; q.inv = INV; q.ig = q.y - 0.5; q.g = -1; q.co = 0; q.vx = 0; q.vy = Math.min(q.vy, 0) - 60; q.hits++; q.ult = kind;
      return true;
    }
    function golpeAve(q, b) {                           // ave: aturdido y lanzado de lado (no te hunde un piso)
      if (q.inv > 0 || q.tf) return false;
      q.stun = 0.45; q.inv = INV; q.kx = b.d * 260; q.g = -1; q.co = 0; q.vy = Math.max(q.vy, 0) + 170; q.hits++; q.ult = 3;
      return true;
    }
    function marca(x, k, d) { x.empN++; x.empK = k; x.empD = d; x.empT = absT; }
    /* contacto entre cuerpos (la víctima decide): empujón según la velocidad de aproximación del otro, y pisotón al caer encima */
    function choques(q, p, t) {
      var k, o, dx, dy, dir, apO, apM;
      if (q.bcd > 0) { q.bcd -= H; return; }
      if (t < 0.3 || q.tf) return;
      for (k = 0; k < n; k++) {
        if (k === p) continue;
        o = P[k]; if (o.tf) continue;
        dx = q.x - o.x; dy = q.y - o.y; dir = dx > 0.01 ? 1 : dx < -0.01 ? -1 : (p > k ? 1 : -1);
        if (Math.abs(dx) < 14 && dy > 14 && dy < 36 && q.vy < -40) {          // caí sobre su cabeza: rebote
          q.vy = 330; q.g = -1; q.co = 0; q.jb = 0; q.ig = 1e9; q.bcd = BCD; q.pisos++; marca(q, 3, dir); if (!o.own) { marca(o, 2, -dir); o.empes++; }
          if (p === c.yo) SND(380, 0.12, 'square', 0.06, 200);
          return;
        }
        if (Math.abs(dx) < 14 && dy < -14 && dy > -36 && o.vely < -10) {      // me cayó encima: me aplasta un momento
          q.stun = Math.max(q.stun, 0.4); q.vx = 0; q.ult = 4; q.bcd = BCD + 0.2; q.empes++; marca(q, 2, -dir); if (p === c.yo) SND(150, 0.2, 'sawtooth', 0.06, -60);
          return;
        }
        if (Math.abs(dy) < 24 && Math.abs(dx) < 15) {
          apO = Math.max(0, o.vel * dir); apM = Math.max(0, -q.vel * dir);
          q.kx = dir * 60 + dir * (0.6 * apO + 0.15 * apM); q.bcd = BCD; q.empes++;
          if (apO > 90 && q.g >= 0) { q.vy = 150; q.g = -1; q.co = 0; }       // empujón fuerte: te despega del piso
          if (apM > apO + 25) { marca(q, 5, -dir); if (!o.own) { marca(o, 1, -dir); o.empes++; } }
          else { marca(q, 1, dir); if (!o.own) marca(o, 5, dir); }
          if (p === c.yo) SND(210, 0.12, 'square', 0.06, -80);
          return;
        }
      }
    }
    function aterriza(q, pl, t) {
      q.ig = 1e9;
      if (pl.k === 'b') { q.y = pl.y; q.vy = BOUNCE; q.g = -1; q.co = 0; return; }
      q.y = pl.y; q.vy = 0; q.g = pl.id; q.gy = pl.y;
      if (pl.y > q.hmax) q.hmax = pl.y;
      if (pl.k === 'r' && !q.tf) { q.tf = Math.max(1, Math.floor(t * 30)); q.vx = 0; }
      q.sc = scDe(q);
    }

    /* un paso físico de 1/60 s de un cuerpo mío */
    function paso(q, t, ax, p) {
      var j, pl;
      if (q.tf) { q.vx = 0; q.vy = 0; q.st = 2; return; }
      if (q.stun > 0) { q.stun -= H; ax = 0; }
      if (q.inv > 0) q.inv -= H;
      if (q.jb > 0) q.jb -= H;
      if (q.co > 0) q.co -= H;
      q.vx = ax * SPD; if (ax) q.fc = ax > 0 ? 1 : -1;
      q.vx += gusta(t) * WV + q.kx;                      // viento y empujones: te arrastran aunque no pulses nada
      q.kx = Math.abs(q.kx) < 4 ? 0 : q.kx * KD;
      if (q.g >= 0) {                                   // sigo parado en mi piso? (y no se está derrumbando)
        pl = plat[q.g];
        if (q.x < pl.x0 - 3 || q.x > pl.x1 + 3 || (pl.caeT !== undefined && t >= pl.caeT && t < pl.volT)) { q.g = -1; q.co = COYO; }
      }
      if (q.jb > 0 && (q.g >= 0 || q.co > 0) && q.stun <= 0) {
        q.vy = JV; q.g = -1; q.co = 0; q.jb = 0; q.saltos++;
        if (p === c.yo) SND(520, 0.1, 'square', 0.05, 160);
      }
      var py = q.y;
      if (q.g < 0) {
        q.vy -= GR * H; q.y += q.vy * H;
        q.x = cl(q.x + q.vx * H, 12, AW - 12);
        if (q.vy <= 0) {                                // ¿aterrizo? (piso de paso: solo cae desde arriba)
          var best = null;
          for (j = 0; j < plat.length; j++) {
            pl = plat[j];
            if (pl.y >= q.ig && pl.id !== 0) continue;
            if (pl.caeT !== undefined && t >= pl.caeT && t < pl.volT) continue;
            if (py >= pl.y - 0.01 && q.y <= pl.y && q.x >= pl.x0 - 3 && q.x <= pl.x1 + 3 && (!best || pl.y > best.y)) best = pl;
          }
          if (best) { aterriza(q, best, t); if (best.k === 'b' && p === c.yo) SND(300, 0.25, 'sine', 0.06, 500); }
        }
      } else q.x = cl(q.x + q.vx * H, 12, AW - 12);
      if (q.stun > 0 || q.tf) q.st = q.tf ? 2 : 1; else q.st = 0;
      choques(q, p, t);
      /* aves: la víctima decide */
      if (!q.tf && q.inv <= 0) {
        for (j = 0; j < aves.length; j++) {
          var av = aves[j];
          if (av.T > t) break;
          if (q.hit['a' + av.i] || t > av.T + aveDur(av)) continue;
          var ay = aveY(av, t), ax2 = aveX(av, t);
          if (Math.abs(ax2 - q.x) < (av.k ? 13 : 17) && ay > q.y - 4 && ay < q.y + 40) { q.hit['a' + av.i] = 1; if (golpeAve(q, av) && p === c.yo) { SND(170, 0.25, 'sawtooth', 0.07, -60); SAY(av.k ? '¡LORO!' : '¡ZAMURO!', q.x, 300, '#ffd23f'); } break; }
        }
      }
      /* tobos de agua desde las ventanas: la víctima decide */
      if (!q.tf && q.inv <= 0) {
        for (j = 0; j < tobos.length; j++) {
          var b = tobos[j];
          if (b.T > t) break;
          if (q.hit[b.i]) continue;
          var by = b.y0 - b.v * (t - b.T);
          if (by < -20) continue;
          if (Math.abs(b.x - q.x) < 22 && by > q.y - 6 && by < q.y + 38) { q.hit[b.i] = 1; if (golpe(q, 1) && p === c.yo) { SND(120, 0.3, 'sawtooth', 0.07, -60); SAY('¡PIEDRAAA!', q.x, 300, '#3fb0ff'); } break; }
        }
      }
    }

    function gusta(t) { var k2, g2; for (k2 = 0; k2 < gustas.length; k2++) { g2 = gustas[k2]; if (t >= g2.T && t < g2.T + g2.L) return g2.d * (g2.T >= late ? 1.45 : 1); } return 0; }
    function aveX(b, t) { return b.d > 0 ? -40 + b.v * (t - b.T) : AW + 40 - b.v * (t - b.T); }
    function aveY(b, t) { return b.y + b.amp * Math.sin(b.ph + 4 * (t - b.T)); }
    function aveDur(b) { return (AW + 80) / b.v; }

    /* el perro cimarrón (solo nivel 3): vive en la repisa de su víctima */
    function perro(q, t) {
      var d = q.dog, pl, dx;
      if (d.cd > 0) { d.cd -= H; return; }
      if (q.g < 0 || q.tf) return;
      pl = plat[q.g];
      if (d.pl !== q.g) {
        d.w += H;
        if (d.w >= DOGWAIT) { d.pl = q.g; d.w = 0; d.x = (q.x - pl.x0) > (pl.x1 - q.x) ? pl.x0 + 10 : pl.x1 - 10; d.ladra = 0.6; SND(220, 0.15, 'square', 0.05, -80); }
        return;
      }
      if (d.ladra > 0) { d.ladra -= H; return; }
      dx = q.x - d.x; d.dir = dx >= 0 ? 1 : -1;
      d.x = cl(d.x + d.dir * DOGV * H, pl.x0 + 6, pl.x1 - 6);
      if (Math.abs(dx) < 17 && q.y - pl.y < 14) { if (golpe(q, 2)) { d.cd = DOGCD; d.pl = -1; d.w = 0; SND(140, 0.25, 'sawtooth', 0.07, -50); } }
    }

    function adoptar(q, p, gt) {                        // soy el dueño (empiezo, o heredo a una CPU que cayó / un humano que se fue)
      q.own = true;
      if (q.lr && gt > 0) {
        q.x = q.lr.x; q.y = q.lr.y; q.vy = 0; q.vx = 0; q.g = -1; q.co = 0; q.ig = 1e9;
        if (q.lr.tf && !q.tf) q.tf = q.lr.tf;
        var sc0 = q.lr.sc | 0; if (!q.tf) q.hmax = Math.max(q.hmax, Math.min(999, sc0) * ROOFY / 1000);
        q.sc = scDe(q);
      }
    }

    function updJugador(p, pasos) {
      var xa = P[p].x, ya = P[p].y;
      updJugador2(p, pasos);
      if (pasos > 0) { var qq = P[p], dtp = pasos * H, nv = (qq.x - xa) / dtp, nvy = (qq.y - ya) / dtp; qq.vel += (nv - qq.vel) * 0.6; qq.vely += (nvy - qq.vely) * 0.6; }
    }
    function updJugador2(p, pasos) {
      var q = P[p], gt = c.ahora();
      if (!mio(p)) {                                    // remoto: lo que manda su dueño (o el juez si es CPU)
        q.own = false;
        var r = c.remoto(p);
        if (r) {
          if (r.x > q.x + 0.5) q.fc = 1; else if (r.x < q.x - 0.5) q.fc = -1;
          q.x = r.x; q.y = r.y; q.st = r.st | 0;
          if (r.tf && !q.tf) q.tf = r.tf | 0;
          q.sc = r.sc | 0;
          q.lr = { x: r.x, y: r.y, sc: r.sc | 0, tf: r.tf | 0, st: r.st | 0 };
        }
        return;
      }
      if (!q.own) adoptar(q, p, gt);
      var taps = c.tap(p, 'a');
      if (gt < 0) return;
      if (taps > 0) q.jb = JBUF;
      var ex = c.eje(p), ax = ex && ex.x ? (Math.abs(ex.x) < 0.2 ? 0 : cl(ex.x, -1, 1)) : 0;
      var k;
      for (k = 1; k <= pasos; k++) {
        var t = gt - (pasos - k) * H;
        paso(q, t, ax, p);
        if (lv >= 3) perro(q, t);
      }
      q.sc = scDe(q);
    }

    function nTf() { var k = 0, p; for (p = 0; p < n; p++) if (P[p].tf) k++; return k; }
    function minTf() { var m = 1e9, p; for (p = 0; p < n; p++) if (P[p].tf && P[p].tf < m) m = P[p].tf; return m; }

    /* ───── dibujo ───── */
    function Y(wy) { return FOCO + cam - wy; }
    function fondo(x0, x1, cx, gt) {
      var w = x1 - x0, k, p = pal, par = cam * 0.12;
      rr(x0, 0, w, 330, 0, p.sky, 0); rr(x0, 330, w, 280, 0, p.sky2, 0);
      if (lv === 3) { for (k = 0; k < estrellas.length; k++) { var e = estrellas[k]; ell(x0 + e[0] * w, 12 + e[1] * 300, e[2], e[2], '#fffdf2', 0); } ell(x1 - 60, 110, 24, 24, p.sol, 0); ell(x1 - 50, 105, 21, 21, p.sky, 0); }
      else ell(lv === 1 ? x1 - 60 : x0 + 70, lv === 1 ? 110 : 250, 28, 28, p.sol, 0);
      /* el cerro de fondo con sus casitas (parallax lento) */
      var base = 560 + par;
      poly([[x0 - 10, 620], [x0 - 10, base - 40], [x0 + w * 0.25, base - 120], [x0 + w * 0.5, base - 70], [x0 + w * 0.8, base - 150], [x1 + 10, base - 90], [x1 + 10, 620]], p.cerro2, 3);
      poly([[x0 - 10, 620], [x0 - 10, base + 10], [x0 + w * 0.3, base - 50], [x0 + w * 0.6, base - 10], [x1 + 10, base - 60], [x1 + 10, 620]], p.cerro, 3);
      for (k = 0; k < casitas.length; k++) {
        var h0 = casitas[k], hx = x0 + h0[0] * w, hy = base - 30 - h0[1] * 90, hs = 16 * h0[2];
        rr(hx - hs, hy - hs, hs * 2, hs * 1.5, 2, CASAC[h0[3]], 2.5); rr(hx - hs * 0.3, hy - hs * 0.4, hs * 0.5, hs * 0.5, 1, lv === 3 ? p.winlit : p.win, 0);
      }
    }
    function edificio(ax0, gt) {
      var p = pal, ytop = Math.max(-20, Y(ROOFY + 8)), ybot = Math.min(620, Y(0));
      if (ybot > ytop) rr(ax0 - 6, ytop, AW + 12, ybot - ytop, 0, p.wall, 4);
      var fa = Math.max(0, Math.floor((cam - (600 - FOCO) - 40) / FH)), fb = Math.min(NF, Math.ceil((cam + FOCO + 40) / FH)), k;
      for (f = fa; f <= fb; f++) {
        var yy = Y(f * FH);
        if (f > 0 && f % 2 === 0) rr(ax0 - 4, yy - FH, AW + 8, FH, 0, p.wall2, 0);
        for (k = 0; k < 6; k++) { var by0 = yy - 8 - k * 9; if (by0 > -10 && by0 < 610) line([[ax0, by0], [ax0 + AW, by0]], 1.5, p.brick); }
        if (f > 0 && f < NF) for (k = 0; k < 3; k++) {  // ventanas fijas del bloque (las que sueltan tobos se abren aparte)
          var wx = ax0 + 38 + k * 122 + ((f * 37 + k * 11) % 24) - 12, lit = lv === 3 && ((f * 7 + k * 3) % 5 < 3);
          rr(wx - 12, yy - FH * 0.55 - 16, 24, 30, 3, lit ? p.winlit : p.win, 3);
          line([[wx, yy - FH * 0.55 - 16], [wx, yy - FH * 0.55 + 14]], 2, INKC);
        }
      }
      var ys = Y(0), cp2 = c.campo();
      if (ys < 640) {
        rr(cp2.x0 - 20, ys + 12, cp2.x1 - cp2.x0 + 40, 700, 0, p.calle, 0);                          // calle a todo lo ancho
        rr(cp2.x0 - 20, ys, cp2.x1 - cp2.x0 + 40, 12, 0, '#8a8696', 3.5);                         // acera
        rr(ax0 - 6, ys - 2, AW + 12, 14, 0, '#6a6680', 3.5);                                      // zócalo del edificio
      }
    }
    function platabanda(ax0) {
      var yr = Y(ROOFY);
      rr(ax0 + 6, yr, AW - 12, 12, 2, '#d8d2e0', 3.5);
      for (var kp = 0; kp <= 8; kp++) line([[ax0 + 12 + kp * 37, yr], [ax0 + 12 + kp * 37, yr - 14]], 3, '#d8d2e0');   // baranda
      line([[ax0 + 12, yr - 14], [ax0 + AW - 12, yr - 14]], 4, '#d8d2e0');
      rr(ax0 + 14, yr - 70, 34, 52, 8, '#3f7fd0', 3.5);                     // tanque de agua
      rr(ax0 + 18, yr - 18, 5, 18, 0, INKC, 0); rr(ax0 + 40, yr - 18, 5, 18, 0, INKC, 0);
      ell(ax0 + AW - 54, yr - 54, 20, 14, '#e8e8f0', 3.5);                  // antena de DirecTV
      line([[ax0 + AW - 54, yr - 54], [ax0 + AW - 54, yr - 18]], 3, INKC); line([[ax0 + AW - 54, yr - 54], [ax0 + AW - 40, yr - 66]], 2.5, INKC);
      txt('LA CIMA', ax0 + AW / 2 + 6, yr - 36, 16, '#ffd23f');
    }
    function pisos(ax0, gt) {
      var p = pal, j, pl;
      for (j = 1; j < plat.length; j++) {
        pl = plat[j];
        if (pl.k === 'r') continue;
        var yy = Y(pl.y);
        if (yy < -30 || yy > 640) continue;
        if (pl.k === 'b') {                                   // tendedero: cuerda con ropa colgada, rebota
          var sag = Math.sin(gt * 4 + j) * 1.5, pts = [], s2;
          for (s2 = 0; s2 <= 8; s2++) pts.push([ax0 + pl.x0 + (pl.x1 - pl.x0) * s2 / 8, yy + 5 * Math.sin(Math.PI * s2 / 8) + sag]);
          line([[ax0 + pl.x0, yy - 12], [ax0 + pl.x0, yy + 18]], 4, INKC); line([[ax0 + pl.x1, yy - 12], [ax0 + pl.x1, yy + 18]], 4, INKC);
          line(pts, 3, '#fffdf2');
          rr(ax0 + pl.x0 + 8, yy + 4, 9, 12, 2, '#ff7ab0', 2); rr(ax0 + pl.x0 + 24, yy + 5, 9, 14, 2, '#ffd23f', 2); rr(ax0 + pl.x0 + 38, yy + 4, 8, 11, 2, '#3fb0ff', 2);
          continue;
        }
        rr(ax0 + pl.x0, yy, pl.x1 - pl.x0, 10, 2, p.plat, 3);
        line([[ax0 + pl.x0 + 4, yy + 3], [ax0 + pl.x1 - 4, yy + 3]], 1.5, '#ffffff');
        rr(ax0 + pl.x0 + 6, yy + 10, 5, 10, 0, '#6a6680', 0); rr(ax0 + pl.x1 - 11, yy + 10, 5, 10, 0, '#6a6680', 0);
      }
    }
    function toboVentana(ax0, b, gt) {                       // la vecina asoma 0,9 s antes: telegrafía de la columna de agua
      var dtv = gt - b.T;
      if (dtv < -0.9 || dtv > 0.3) return;
      var yy = Y(b.y0), flash = Math.floor(gt * 10) % 2;
      if (yy < -40 || yy > 640) return;
      rr(ax0 + b.x - 15, yy - 22, 30, 34, 4, '#2a2638', 3.5);
      var cast = BUS.AP.CAST[b.k ? 'abuela' : 'mama'];
      bust(Object.assign({ x: ax0 + b.x, y: yy - 4, s: 0.3, flip: 0, look: 0, talk: Math.abs(Math.sin(gt * 9)) }, cast));
      rr(ax0 + b.x - 9, yy + 4, 18, 11, 3, '#3fb0ff', 2.5);
      if (dtv < 0) {
        var a = Math.min(1, (0.9 + dtv) * 2);
        line([[ax0 + b.x, yy + 16], [ax0 + b.x, Math.min(630, yy + 180)]], flash ? 3 : 2, 'rgba(63,176,255,' + (0.35 * a).toFixed(2) + ')');
        txt('¡PIEDRA!', ax0 + b.x, yy - 32, 12, flash ? '#ffffff' : '#7fd0ff');
      }
    }
    function tobosVivos(ax0, gt) {
      var j;
      for (j = 0; j < tobos.length; j++) {
        var b = tobos[j]; toboVentana(ax0, b, gt);
        if (gt < b.T) continue;
        var by = b.y0 - b.v * (gt - b.T);
        if (by < -30) continue;
        var yy = Y(by);
        if (yy < -40 || yy > 640) continue;
        line([[ax0 + b.x, yy - 6], [ax0 + b.x, yy - 38]], 4, 'rgba(120,200,255,.55)');
        rr(ax0 + b.x - 9, yy - 6, 18, 14, 3, '#3fb0ff', 3); rr(ax0 + b.x - 11, yy - 8, 22, 4, 2, '#8fd8ff', 2.5);
        ell(ax0 + b.x, yy - 20, 5, 9, 'rgba(160,220,255,.8)', 0);
      }
    }
    function chico(ax0, p, alfa, tu, gt) {
      var q = P[p], s = c.seats[p] || { ch: 'tu', color: '#ffd23f' }, sx = ax0 + q.x, sy = Y(q.y), st = q.st, air = q.g < 0 && !q.tf;
      if (sy < -80 || sy > 700) return;
      var cr = air ? 1 : 0, camina = Math.abs(q.vx) > 1 ? Math.sin(gt * 18 + p) * 3 : 0, sq = q.stun > 0 ? Math.sin(gt * 40) * 2 : 0;
      ctx.save(); ctx.globalAlpha = alfa;
      ell(sx, Y(q.gy) + 4, 15, 4, 'rgba(20,16,28,.3)', 0);
      rr(sx - 8 + camina + sq, sy - 13, 7, 13, 3, '#2f3a7a', 2.5); rr(sx + 1 - camina + sq, sy - 13, 7, 13, 3, '#2f3a7a', 2.5);
      rr(sx - 11 + sq, sy - 30 - cr * 2, 22, 19, 7, s.color || '#ffd23f', 3);
      var hcy = sy - 42 - cr * 2, hh = 34;                 // solo la cabeza del personaje (recortada): el cuerpo es el de arriba
      c.util.pj(s.ch, sx + sq, hcy, hh, { animo: st === 2 ? 'celebrar' : st === 1 ? 'perder' : (air && !st ? 'celebrar' : null), sombra: false, clip: { x: sx + sq - hh * 0.55, y: hcy - hh * 0.55, w: hh * 1.1, h: hh * 1.0 } });
      ctx.restore();
      if (tu) { poly([[sx - 6, sy - 70], [sx + 6, sy - 70], [sx, sy - 62]], '#ffd23f', 2.5); txt('TÚ', sx, sy - 80, 13, '#ffd23f'); }
      else { poly([[sx - 5, sy - 66], [sx + 5, sy - 66], [sx, sy - 59]], s.color || '#fff', 2); }
      if (q.inv > 0 && q.stun > 0) txt('¡AY!', sx, sy - 92, 12, '#ff5c8a');
    }
    function perroDib(ax0, q, gt) {
      var d = q.dog;
      if (d.pl < 0) return;
      var pl = plat[d.pl], dx = ax0 + d.x, dy = Y(pl.y), wag = Math.sin(gt * 22) * 3;
      if (dy < -30 || dy > 640) return;
      ell(dx, dy - 8, 14, 8, '#8a5a32', 3); ell(dx + d.dir * 11, dy - 15, 7, 6, '#8a5a32', 3);
      rr(dx + d.dir * 14 - 2, dy - 22, 5, 8, 2, '#5a3a22', 2); rr(dx - 11, dy - 6, 4, 8, 1, '#5a3a22', 2); rr(dx + 7, dy - 6, 4, 8, 1, '#5a3a22', 2);
      line([[dx - d.dir * 13, dy - 10], [dx - d.dir * 20, dy - 18 + wag]], 3, '#5a3a22');
      if (d.ladra > 0) { txt('¡GUAU!', dx, dy - 32, 13, '#ffffff'); }
    }
    function aves2D(ax0, gt) {
      var j, k2, gv = viento(gt);
      for (j = 0; j < aves.length; j++) {
        var b = aves[j], d0 = gt - b.T, yy = Y(b.y);
        if (d0 < -1.1 || d0 > aveDur(b) || yy < -30 || yy > 640) continue;
        if (d0 < 0) { line([[ax0, yy], [ax0 + AW, yy]], 3, 'rgba(255,210,63,' + (Math.floor(gt * 12) % 2 ? .6 : .25) + ')'); txt(b.k ? '¡LORO!' : '¡ZAMURO!', ax0 + (b.d > 0 ? 40 : AW - 40), yy - 12, 12, '#ffd23f'); continue; }
        var bx = ax0 + aveX(b, gt), by = Y(aveY(b, gt)), fl = Math.sin(gt * (b.k ? 20 : 5)) * (b.k ? 9 : 6);
        ell(bx, by, b.k ? 9 : 13, b.k ? 5 : 6, b.k ? '#3fcf6a' : '#1a1620', 2.5);
        line([[bx - 2, by], [bx - 8, by - 10 - fl], [bx - 16, by - fl]], 3, b.k ? '#ff8a3d' : '#1a1620'); line([[bx + 2, by], [bx + 8, by - 10 + fl], [bx + 16, by + fl]], 3, b.k ? '#ff8a3d' : '#1a1620');
        ell(bx + b.d * 10, by - 2, 4, 4, b.k ? '#e8404a' : '#9a4a4a', 2);
      }
      if (gv && gt >= gv.T) for (k2 = 0; k2 < 14; k2++) {
        var u = (gt * (0.9 + (k2 % 3) * 0.2) + k2 * 0.37) % 1, wy = 120 + ((k2 * 53) % 360), wx = ax0 + (gv.d > 0 ? u : 1 - u) * AW;
        line([[wx, wy], [wx + gv.d * 34, wy]], 2, 'rgba(255,255,255,.6)');
      }
    }
    function barra(cx) {
      var margen = (c.campo().x1 - c.campo().x0 - AW) / 2, bx = cx + AW / 2 + Math.min(14, margen / 2) + 2, ya = 92, yb = 440, p, hi;
      rr(bx - 3, ya, 6, yb - ya, 3, 'rgba(20,16,28,.5)', 1.5);
      ell(bx, ya, 4, 3, '#ffd23f', 1.5);
      for (p = 0; p < n; p++) {
        var q = P[p], fr = q.tf ? 1 : cl(q.y / ROOFY, 0, 1), s = c.seats[p] || { color: '#fff' }, yy = yb - fr * (yb - ya);
        ell(bx, yy, p === c.yo ? 5 : 3.5, p === c.yo ? 5 : 3.5, s.color || '#fff', p === c.yo ? 2.5 : 1.5);
      }
    }

    /* ───── 3D low poly (fiesta-3d.js): la ladera natural del Ávila (roca, monte, quebrada, niebla). Solo dibujo: lee P, plat, tobos, gustas, cam; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0, absT = 0;   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var ES = 1 / 16;                                                     // px de la simulación -> metros (una repisa = 3,5 m)
    var PEND = 0.3;                                                      // la ladera se aleja 0,3 m por metro de altura
    function WX(x) { return (x - AW / 2) * ES; }
    function WY(y) { return y * ES; }
    function zLad(y) { return -6 - y * PEND; }                          // la superficie de la ladera detrás de las repisas
    function asiento(p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; }
    var PAL3 = {
      1: { cielo: ['#4aa8f0', '#e4f6ff'], hemi: [0xffffff, 0x6a7a50, .6], sol: [0xfff2d8, .75], niebla: '#cfeeff', roca: '#9a9486', verde: '#5fb04a', verde2: '#3a8a3a', pino: '#2a6a36', tierra: '#9a7450', rojo: '#c0603c', agua: '#4fb8ff', lejos: '#8fb4d8', lej2: '#7aa2cc', lej3: '#5f8cb8', rep: ['#d8cfbc', '#c8bea8', '#e0d6c2'], pasto: ['#9be85a', '#82d44a'], noche: 0 },
      2: { cielo: ['#ff7a4a', '#ffd7a0'], hemi: [0xffd0a0, 0x5a4a4a, .5], sol: [0xffb070, .85], niebla: '#ffc89a', roca: '#9a7a68', verde: '#68b048', verde2: '#437e38', pino: '#2f5a2c', tierra: '#7a5a3a', rojo: '#c0583a', agua: '#9fe0ff', lejos: '#d09aa4', lej2: '#bb8a9c', lej3: '#9a7a96', rep: ['#e6d6c0', '#d6c4ae', '#eadcc8'], pasto: ['#a8ee62', '#8cd84e'], noche: 0 },
      3: { cielo: ['#121038', '#3a2f6a'], hemi: [0xa0a0ff, 0x3a3a50, .6], sol: [0xc8d4ff, 1.0], niebla: '#26234c', roca: '#4a4a62', verde: '#4a8a78', verde2: '#386a5c', pino: '#1a3434', tierra: '#3a3044', rojo: '#5a3a4a', agua: '#6ab0ff', lejos: '#34346a', lej2: '#2a2a5a', lej3: '#222048', rep: ['#c8c8e4', '#b8b8d8', '#d4d4ec'], pasto: ['#7af0a0', '#62e090'], noche: 1 }
    };
    var ROCAS = ['#8a8a7a', '#9a9080', '#7a7a70', '#a8a090'];
    var ROPA = ['#ff7ab0', '#ffd23f', '#3fb0ff', '#5cff7a', '#fffdf2', '#ff8a3d'];   // colores de confeti y de los loros
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j, pp, cxp, wp, yp, rnd, col;
      function rndF() { return c.fx(); }
      function colNoc(base) { return pl.noche ? V3.oscurecer(base, .55) : base; }
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 55, 210], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      V3.pista('cerro', { bpm: 168, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],      // salsa brava de barrio: i–iv–V–i en La menor
        mel: [76, 0, 74, 72, 0, 71, 72, 0, 74, 0, 76, 77, 0, 76, 74, 0, 72, 0, 71, 69, 0, 68, 69, 0, 71, 0, 72, 74, 0, 76, 0, 0] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, GM = tn('#fff').gradientMap, ALTO = WY(ROOFY), ANCHO = AW * ES;
      var TINTA = new T.MeshBasicMaterial({ color: 0x14101c, side: T.BackSide });
      var dummy = new T.Object3D(), colT = new T.Color();
      function caja(w, h, d, cc, x, y, z, op) { var m = M(new T.BoxGeometry(w, h, d), cc, op || { recibe: true, g: .02 }); m.position.set(x, y, z); S3.add(m); return m; }
      /* InstancedMesh con su contorno (otro InstancedMesh con la misma matriz, 7 % más grande). lista: [{x,y,z,sx,sy,sz,rx,ry,c}] */
      function pon(m, o, i, a) {
        dummy.position.set(a.x, a.y, a.z); dummy.rotation.set(a.rx || 0, a.ry || 0, 0); dummy.scale.set(a.sx, a.sy, a.sz); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
        if (o) { dummy.scale.set(a.sx * 1.07, a.sy * 1.07, a.sz * 1.07); dummy.updateMatrix(); o.setMatrixAt(i, dummy.matrix); }
      }
      function enjambre(geo, lista, mat, sinTinta, conSombra) {
        var n = lista.length, m = new T.InstancedMesh(geo, mat, n), o = sinTinta ? null : new T.InstancedMesh(geo, TINTA, n), kk;
        m.castShadow = !!conSombra; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage);
        if (o) { o.frustumCulled = false; o.instanceMatrix.setUsage(T.DynamicDrawUsage); S3.add(o); }
        S3.add(m);
        for (kk = 0; kk < n; kk++) { pon(m, o, kk, lista[kk]); colT.set(lista[kk].c || '#ffffff'); m.setColorAt(kk, colT); }
        return { m: m, o: o, poner: function (i2, a) { pon(m, o, i2, a); m.instanceMatrix.needsUpdate = true; if (o) o.instanceMatrix.needsUpdate = true; } };
      }

      /* el cielo: sol o luna, estrellas de noche, y las crestas del Ávila lejos */
      var lej = new T.Group(); S3.add(lej);                    // lo lejano cuelga de aquí y sube más despacio que la cámara (paralaje)
      var celeste = new T.Mesh(new T.SphereGeometry(5, 14, 10), new T.MeshBasicMaterial({ color: pl.noche ? 0xfff6d0 : 0xffe14d, fog: false }));
      celeste.position.set(pl.noche ? 40 : -44, 34, -150); lej.add(celeste);
      if (pl.noche) {
        var estr = [];
        for (k = 0; k < 40; k++) estr.push({ x: (rndF() - .5) * 170, y: -35 + rndF() * 95, z: -140, sx: .4 + rndF() * .3, sy: .4 + rndF() * .3, sz: .4, c: '#ffffff' });
        lej.add(enjambre(new T.SphereGeometry(1, 5, 4), estr, new T.MeshBasicMaterial({ color: 0xffffff, fog: false }), true).m);
      }
      /* tres capas de cordillera a los lados (la ladera tapa el centro): chicas, azuladas por la distancia, cada capa más oscura */
      var capas = [[-150, 8, 7, 62, 26, 'lejos', 40], [-104, 9, 9, 34, 17, 'lej2', 26], [-72, 7, 7, 24, 13, 'lej3', 20]];
      for (j = 0; j < capas.length; j++) for (k = 0; k < capas[j][2]; k++) {
        var cm = new T.Mesh(new T.DodecahedronGeometry(1, 0), new T.MeshBasicMaterial({ color: new T.Color(pl[capas[j][5]]) }));
        var wk = capas[j][3] * (.7 + ((k * 37 + j * 11) % 10) / 16), hk = capas[j][4] * (.65 + ((k * 23 + j * 7) % 10) / 14);
        cm.scale.set(wk, hk, 12); cm.position.set((k - (capas[j][2] - 1) / 2) * capas[j][6] * 1.25 + ((k * 13) % 7) - 3, hk * .35 - 14 - j * 2, capas[j][0] + (k % 2) * 4); lej.add(cm);
      }
      var telef = new T.Group(); S3.add(telef);               // el teleférico del Ávila: cable y dos cabinas que van y vienen
      var cable = new T.Mesh(new T.BoxGeometry(110, .14, .14), tn('#2a2438')); cable.rotation.z = .2; cable.position.z = -24; telef.add(cable);
      var cabinas = [];
      for (k = 0; k < 2; k++) {
        var cg2 = new T.Group(); telef.add(cg2);
        var colg = M(new T.BoxGeometry(2.2, 1.5, 1.4), k ? '#ffd23f' : '#e8504a', { g: .05 }); colg.position.y = -1.6; cg2.add(colg);
        var techo2 = M(new T.BoxGeometry(2.5, .25, 1.6), '#2a2438', { g: .05 }); techo2.position.y = -.8; cg2.add(techo2);
        var gancho = new T.Mesh(new T.BoxGeometry(.1, .9, .1), tn('#2a2438')); gancho.position.y = -.35; cg2.add(gancho);
        var vv = new T.Mesh(new T.BoxGeometry(1.6, .6, .05), new T.MeshBasicMaterial({ color: pl.noche ? 0xffe27a : 0x9fd8ff })); vv.position.set(0, -1.55, .72); cg2.add(vv);
        cabinas.push(cg2);
      }

      /* la ladera: monte verde con parches de roca, sube alejándose (una superficie inclinada) */
      var tLad = V3.texturaCanvas(256, 256, function (x, w, h) {
        x.fillStyle = pl.verde; x.fillRect(0, 0, w, h);
        for (var r = 0; r < 150; r++) {
          x.fillStyle = r % 7 === 0 ? pl.roca : r % 9 === 0 ? pl.rojo : r % 3 === 0 ? pl.pasto[0] : (r % 2 ? pl.verde2 : pl.verde);
          var sz = 8 + (r * 13) % 22; x.fillRect((r * 37) % w, (r * 61) % h, sz, sz * .5);
        }
        x.strokeStyle = pl.rojo; x.lineWidth = 2; x.globalAlpha = .35;                       // surcos de tierra rojiza por donde baja el agua
        for (var r2 = 0; r2 < 6; r2++) { x.beginPath(); x.moveTo(r2 * 47 % w, 0); x.lineTo((r2 * 47 + 30) % w, h); x.stroke(); }
        x.globalAlpha = 1;
      }, [3, 8]);
      var ladGeo = new T.PlaneGeometry(27, 80, 8, 16), lp = ladGeo.attributes.position, vi;
      for (vi = 0; vi < lp.count; vi++) {                               // bordes y cresta irregulares: se lee como cerro, no como pared
        var lx = lp.getX(vi), ly = lp.getY(vi);
        if (Math.abs(lx) > 13) lp.setX(vi, lx + Math.sign(lx) * (rndF() - .3) * 3.5);
        if (ly > 39) lp.setY(vi, ly - rndF() * 5);
        lp.setZ(vi, (rndF() - .5) * .9);
      }
      ladGeo.computeVertexNormals();
      var ladera = new T.Mesh(ladGeo, new T.MeshToonMaterial({ map: tLad, gradientMap: GM }));
      ladera.rotation.x = -Math.atan(PEND); ladera.position.set(0, 30, zLad(30)); ladera.receiveShadow = true; S3.add(ladera);

      /* el barrio colgado de la ladera: casitas de colores con techo y ventanas (de noche, prendidas) */
      var casaL = [], techoL = [], ventL = [], CASAL = ['#ffb36b', '#a9a0ff', '#ff9ec7', '#6ecf8f', '#ffd23f', '#8aa0ff'];
      for (k = 0; k < 40; k++) {
        var yc = 3 + rndF() * 60, xc = (rndF() - .5) * 26, scc = .7 + rndF() * .7, zc = zLad(yc) + .15 + rndF() * .5;
        casaL.push({ x: xc, y: yc + scc * .5, z: zc, sx: scc * 1.5, sy: scc, sz: scc * 1.2, c: colNoc(CASAL[k % 6]) });
        techoL.push({ x: xc, y: yc + scc + scc * .3, z: zc, sx: scc * 1.25, sy: scc * .6, sz: scc * 1.0, ry: .785, c: colNoc(k % 3 ? '#b25a3e' : '#7a4a3a') });
        ventL.push({ x: xc - scc * .3, y: yc + scc * .6, z: zc + scc * .6 + .03, sx: scc * .3, sy: scc * .3, sz: .06, c: pl.noche ? (k % 3 ? '#ffe27a' : '#3a3a60') : '#7fb0d8' });
      }
      enjambre(new T.BoxGeometry(1, 1, 1), casaL, tn('#ffffff'));
      enjambre(new T.ConeGeometry(1, 1, 4), techoL, tn('#ffffff'));
      enjambre(new T.BoxGeometry(1, 1, 1), ventL, new T.MeshBasicMaterial({ color: 0xffffff }), true);

      /* peñascos, pinos y matas pegados a la ladera (instanciados: pocas mallas) */
      var peds = [], trunks = [], pinos = [], matas = [];
      for (k = 0; k < 16; k++) {
        var yr = 4 + rndF() * 62, sr = .8 + rndF() * 1.2;
        peds.push({ x: (rndF() - .5) * 25, y: yr + sr * .2, z: zLad(yr) + sr * .3, sx: sr * (1 + rndF() * .6), sy: sr * (.7 + rndF() * .3), sz: sr * (.9 + rndF() * .3), rx: rndF() * 3, ry: rndF() * 3, c: colNoc(ROCAS[k % 4]) });
      }
      for (k = 0; k < 22; k++) {
        var yp2 = rndF() * 64, xp = (rndF() - .5) * 26, h = 2.4 + rndF() * 2.4, zz = zLad(yp2) + .3 + rndF() * .4;
        trunks.push({ x: xp, y: yp2 + h * .22, z: zz, sx: .16, sy: h * .44, sz: .16, c: colNoc('#6a4a2a') });
        pinos.push({ x: xp, y: yp2 + h * .62, z: zz, sx: h * .3, sy: h * .72, sz: h * .3, c: colNoc(k % 3 ? pl.pino : pl.verde2) });
      }
      for (k = 0; k < 60; k++) {
        var ym = rndF() * 66, sm = 1.0 + rndF() * 1.0;
        matas.push({ x: (rndF() - .5) * 26, y: ym, z: zLad(ym) + .4, sx: sm * 1.3, sy: sm * .7, sz: sm * 1.1, c: colNoc(k % 2 ? pl.verde : pl.verde2) });
      }
      enjambre(new T.DodecahedronGeometry(1, 0), peds, tn('#ffffff'));
      enjambre(new T.CylinderGeometry(1, 1, 1, 6), trunks, tn('#ffffff'));
      enjambre(new T.ConeGeometry(1, 1, 7), pinos, tn('#ffffff'));
      enjambre(new T.IcosahedronGeometry(1, 0), matas, tn('#ffffff'));

      /* la quebrada: un chorro que baja por la ladera (la textura corre) y el río al pie del sendero */
      var agua = V3.texturaCanvas(64, 256, function (x, w, h) { x.fillStyle = pl.agua; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; for (var r = 0; r < 16; r++) x.fillRect((r * 23) % w, (r * 67) % h, 5, 36); }, [1, 9]);
      var cas = new T.Mesh(new T.PlaneGeometry(1.5, 76), new T.MeshToonMaterial({ map: agua, gradientMap: GM, transparent: true, opacity: .92 }));
      cas.rotation.x = -Math.atan(PEND); cas.position.set(9, 30, zLad(30) + .3); S3.add(cas);
      var aguaH = V3.texturaCanvas(256, 64, function (x, w, h) { x.fillStyle = pl.agua; x.fillRect(0, 0, w, h); x.fillStyle = '#ffffff'; for (var r = 0; r < 24; r++) x.fillRect((r * 41) % w, (r * 29) % h, 22, 4); }, [6, 1]);
      var rio = new T.Mesh(new T.PlaneGeometry(220, 2.2), new T.MeshToonMaterial({ map: aguaH, gradientMap: GM }));
      rio.rotation.x = -Math.PI / 2; rio.position.set(0, .05, 8.8); S3.add(rio);

      /* el sendero de tierra al pie, con piedritas */
      caja(220, .3, 3.4, pl.tierra, 0, .15, 3.6, { recibe: true, borde: false });
      var guijas = [];
      for (k = 0; k < 26; k++) guijas.push({ x: (rndF() - .5) * 60, y: .1, z: 2 + rndF() * 3.4, sx: .4 + rndF() * .3, sy: .25, sz: .4 + rndF() * .2, rx: rndF(), ry: rndF() * 3, c: colNoc(ROCAS[k % 4]) });
      enjambre(new T.DodecahedronGeometry(1, 0), guijas, tn('#ffffff'));

      /* las repisas: roca y tierra con su pasto arriba. Se pueden derrumbar: se guardan para cambiarlas en vivo */
      var repL = [], stoneL = [], grassL = [];
      for (j = 1; j < plat.length; j++) {
        pp = plat[j];
        if (pp.k !== 'n') continue;
        cxp = WX((pp.x0 + pp.x1) / 2); wp = (pp.x1 - pp.x0) * ES; yp = WY(pp.y);
        stoneL.push({ x: cxp, y: yp - .22, z: 0, sx: wp, sy: .44, sz: 3, c: pl.rep[j % 3] });
        grassL.push({ x: cxp, y: yp + .02, z: .05, sx: wp + .3, sy: .2, sz: 3.3, c: pl.pasto[j % 2] });
        repL.push({ pl: pp, i: stoneL.length - 1, est: 0, cx: cxp, y: yp, sx: wp });
      }
      var piedra = enjambre(new T.BoxGeometry(1, 1, 1), stoneL, tn('#ffffff')), pasto = enjambre(new T.BoxGeometry(1, 1, 1), grassL, (pl.noche ? new T.MeshBasicMaterial({ color: 0xffffff }) : tn('#ffffff')));

      /* los bejucos (repisas elásticas: rebotan): dos troncos, una liana y hojas que se mecen */
      var pads3 = [];
      for (j = 1; j < plat.length; j++) {
        pp = plat[j];
        if (pp.k === 'b') {
          cxp = WX((pp.x0 + pp.x1) / 2); wp = (pp.x1 - pp.x0) * ES; yp = WY(pp.y);
          var gt3 = new T.Group(); gt3.position.set(cxp, yp, 0); S3.add(gt3);
          [-1, 1].forEach(function (s) { var tr = M(new T.CylinderGeometry(.22, .3, 2.6, 6), '#6a4a2a', { g: .05 }); tr.position.set(s * (wp / 2 + .2), -.8, 0); gt3.add(tr); });
          var cuerda = new T.Group(); gt3.add(cuerda);
          cuerda.add(new T.Mesh(new T.BoxGeometry(wp, .09, .09), tn('#8a6a3a')));
          var hojas = [];
          for (k = 0; k < 5; k++) {
            var ho = M(new T.SphereGeometry(.55, 7, 5), k % 2 ? pl.verde : pl.verde2, { g: .05 });
            ho.scale.set(1, .4, .7); ho.position.set(-wp / 2 + (k + .5) * wp / 5, -.35, 0); cuerda.add(ho); hojas.push(ho);
          }
          pads3.push({ pl: pp, g: gt3, cuerda: cuerda, prendas: hojas, wob: 0 });
        } else if (pp.k === 'r') {
          /* la cima: un plano de pasto con un pino, un asta y la bandera */
          cxp = WX((pp.x0 + pp.x1) / 2); wp = (pp.x1 - pp.x0) * ES; yp = WY(pp.y);
          caja(wp, .9, 3.4, pl.roca, cxp, yp - .45, 0, { recibe: true, g: .02 });
          caja(wp + .3, .2, 3.6, pl.verde, cxp, yp + .02, 0, { recibe: true, g: .02 });
          var tr2 = M(new T.CylinderGeometry(.18, .24, 2.4, 6), '#6a4a2a', { g: .04 }); tr2.position.set(WX(pp.x0) + 2.2, yp + 1.2, -.6); S3.add(tr2);
          var cr2 = M(new T.ConeGeometry(1.8, 4.6, 7), pl.pino, { g: .05 }); cr2.position.set(WX(pp.x0) + 2.2, yp + 4.2, -.6); S3.add(cr2);
          var asta = M(new T.CylinderGeometry(.05, .05, 3.6, 4), '#d8d2e0', { g: .08 }); asta.position.set(WX(pp.x1) - 2.2, yp + 1.8, .2); S3.add(asta);
          var bandera = new T.Group(); bandera.position.set(WX(pp.x1) - 2.2, yp + 3.5, .3); S3.add(bandera);
          ['#ffd23f', '#1f4fbf', '#d0283a'].forEach(function (col2, i2) { var fr = new T.Mesh(new T.PlaneGeometry(1.6, .3), new T.MeshToonMaterial({ color: col2, side: T.DoubleSide, gradientMap: GM })); fr.position.set(.8, -i2 * .3, 0); bandera.add(fr); });
        }
      }

      /* lo que se mueve solo: zamuros dando vueltas, loros y la niebla que pasa */
      var zamuros = [];
      for (k = 0; k < 3; k++) {
        var zg = new T.Group(); S3.add(zg);
        var cuerpo = M(new T.ConeGeometry(.22, .9, 4), '#1a1620', { g: .06 }); cuerpo.rotation.x = Math.PI / 2; zg.add(cuerpo);
        var cab4 = M(new T.SphereGeometry(.12, 5, 4), '#8a4a4a', { g: .06 }); cab4.position.z = .5; zg.add(cab4);
        var al1 = new T.Mesh(new T.BoxGeometry(1.4, .04, .45), tn('#1a1620')); al1.geometry.translate(.7, 0, 0); zg.add(al1);
        var al2 = new T.Mesh(new T.BoxGeometry(1.4, .04, .45), tn('#1a1620')); al2.geometry.translate(-.7, 0, 0); zg.add(al2);
        zamuros.push({ g: zg, a1: al1, a2: al2, r: 9 + k * 4, f: k * 2.1, alto: 9 + k * 3, x: -6 + k * 6 });
      }
      var papagayos = [];
      for (k = 0; k < 2; k++) {
        var pg = new T.Group(); S3.add(pg);
        var rombo = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), new T.MeshToonMaterial({ color: k ? '#ff5c8a' : '#ffd23f', side: T.DoubleSide, gradientMap: GM })); rombo.rotation.z = Math.PI / 4; rombo.scale.y = 1.4; pg.add(rombo);
        var cola = [];
        for (j = 0; j < 5; j++) { var lz = new T.Mesh(new T.BoxGeometry(.25, .12, .02), tn(ROPA[(j + k * 2) % ROPA.length])); lz.position.y = -1.2 - j * .45; pg.add(lz); cola.push(lz); }
        papagayos.push({ g: pg, cola: cola, x: k ? 16 : -20, dy: k ? 7 : 10, z: k ? -14 : -18 });
      }
      var nubes = [];
      for (k = 0; k < 6; k++) {
        var nb = new T.Mesh(new T.SphereGeometry(7 + (k % 3) * 2, 9, 6), new T.MeshBasicMaterial({ color: pl.noche ? 0x4a4a7a : 0xffffff, transparent: true, opacity: .4, depthWrite: false, fog: false }));
        nb.scale.set(2.2, .45, 1); nb.position.set(-40 + k * 16, 14 + (k * 19) % 70, 0); nb.position.z = zLad(nb.position.y) + 2.5; S3.add(nb); nubes.push(nb);
      }
      /* la brisa del Ávila: rayas de aire que cruzan la pantalla en la dirección del viento */
      var matRaya = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }), rayas = [];
      for (k = 0; k < 34; k++) {
        var rym = new T.Mesh(new T.PlaneGeometry(1, .13), matRaya); rym.visible = false; S3.add(rym);
        rayas.push({ m: rym, h: rndF(), l: 2.5 + rndF() * 3.5, z: 1.2 + rndF() * 2.4, sp: .7 + rndF() * .6, dy: rndF() * 20 - 9 });
      }
      /* las aves que cruzan: zamuros (grandes, lentos) y loros (chicos, rápidos, ondulantes), con su carril de aviso */
      function crearAve(loro) {
        var ag = new T.Group(); S3.add(ag); ag.visible = false;
        var sw = loro ? .8 : 1.5;
        var cu = M(new T.ConeGeometry(loro ? .2 : .3, loro ? .9 : 1.3, 5), loro ? '#3fcf6a' : '#1a1620', { g: .06 }); cu.rotation.x = Math.PI / 2; ag.add(cu);
        var ca = M(new T.SphereGeometry(loro ? .2 : .17, 6, 5), loro ? '#e8404a' : '#9a4a4a', { g: .06 }); ca.position.z = loro ? .55 : .75; ag.add(ca);
        var pico = M(new T.ConeGeometry(.08, .28, 4), loro ? '#ffd23f' : '#d8c8a0', { g: .08 }); pico.rotation.x = Math.PI / 2; pico.position.z = loro ? .78 : .95; ag.add(pico);
        var cola2 = M(new T.BoxGeometry(.18, .05, loro ? .9 : .6), loro ? '#3fb0ff' : '#1a1620', { g: .06 }); cola2.position.z = loro ? -.8 : -.8; ag.add(cola2);
        var w1 = new T.Mesh(new T.BoxGeometry(1.5 * sw, .05, loro ? .45 : .6), tn(loro ? '#2fa858' : '#1a1620')); w1.geometry.translate(.75 * sw, 0, 0); ag.add(w1);
        var w2 = new T.Mesh(new T.BoxGeometry(1.5 * sw, .05, loro ? .45 : .6), tn(loro ? '#ff8a3d' : '#1a1620')); w2.geometry.translate(-.75 * sw, 0, 0); ag.add(w2);
        ag.scale.set(loro ? 1.6 : 1.5, loro ? 1.6 : 1.5, loro ? 1.6 : 1.5);
        return { g: ag, a1: w1, a2: w2, loro: loro };
      }
      var poolZ = [], poolL = [], aves3 = [], slotZ = 0, slotL = 0;
      for (k = 0; k < 4; k++) poolZ.push(crearAve(0));
      for (k = 0; k < 6; k++) poolL.push(crearAve(1));
      for (k = 0; k < aves.length; k++) {
        var carMat = new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, depthWrite: false, fog: false });
        var car = new T.Mesh(new T.PlaneGeometry(1, .45), carMat); car.visible = false; S3.add(car);
        var fle = new T.Mesh(new T.ConeGeometry(.55, 1.1, 3), new T.MeshBasicMaterial({ color: 0xffd23f, fog: false })); fle.visible = false; S3.add(fle);
        aves3.push({ b: aves[k], ob: aves[k].k ? poolL[slotL++ % poolL.length] : poolZ[slotZ++ % poolZ.length], car: car, carMat: carMat, fle: fle, aviso: 0, paso: 0 });
      }
      var luces = [];
      if (pl.noche) for (k = 0; k < 2; k++) { var pl3 = new T.PointLight(0xffc870, 1.1, 24, 2); S3.add(pl3); luces.push(pl3); }

      /* las piedras: una pieza de roca y su columna de aviso (un rectángulo azul que baja hasta la acera) */
      var caen = [];
      for (k = 0; k < 12; k++) {
        var cg = new T.Group(); cg.visible = false; S3.add(cg);
        cg.add(M(new T.DodecahedronGeometry(.8, 0), '#9a9080', { g: .05 }));
        var av = new T.Mesh(new T.BoxGeometry(.5, 1, .05), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .4, depthWrite: false, fog: false }));
        av.visible = false; S3.add(av);
        caen.push({ g: cg, av: av, b: -1 });
      }

      /* el perro cimarrón (nivel 3, solo en tu pantalla) */
      var perroG = new T.Group(); perroG.visible = false; S3.add(perroG);
      var pc = M(new T.BoxGeometry(1, .5, .45), '#c8a060', { g: .05 }); pc.position.y = .6; perroG.add(pc);
      var pcab = M(new T.BoxGeometry(.45, .42, .42), '#c8a060', { g: .05 }); pcab.position.set(.6, .95, 0); perroG.add(pcab);
      var hoc = M(new T.BoxGeometry(.25, .2, .25), '#5a3a22', { g: .05 }); hoc.position.set(.88, .88, 0); perroG.add(hoc);
      var or1 = M(new T.BoxGeometry(.1, .25, .12), '#5a3a22', { g: .08 }); or1.position.set(.5, 1.22, .15); perroG.add(or1);
      var or2 = or1.clone(); or2.position.z = -.15; perroG.add(or2);
      var patas = [];
      [[.35, .15], [.35, -.15], [-.35, .15], [-.35, -.15]].forEach(function (q2) { var pa = M(new T.BoxGeometry(.14, .4, .14), '#8a6a3a', { g: .06 }); pa.geometry.translate(0, -.2, 0); pa.position.set(q2[0], .4, q2[1]); perroG.add(pa); patas.push(pa); });
      var rabo = M(new T.BoxGeometry(.08, .45, .08), '#c8a060', { g: .08 }); rabo.geometry.translate(0, .22, 0); rabo.position.set(-.5, .75, 0); rabo.rotation.z = .6; perroG.add(rabo);

      /* los jugadores: tú adelante, los demás un poco atrás en la misma repisa */
      var pjs = [], otro = 0;
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        var zc = k === c.yo ? .95 : -.3 + (otro++) * .4;
        var env = new T.Group(); env.position.set(WX(P[k].x), WY(P[k].y), zc); env.add(pj.g); S3.add(env);   // env: inclinación y squash por encima de lo que pone el kit
        pjs.push({ pj: pj, env: env, sq: 0, sqv: 0, lw: 0, lr: 0, eT: 0, eK: 0, eD: 0, emp: 0, empN: 0, jad: 0, desl: 0, agarre: 0, gy: WY(P[k].y), dustT: 0, slipSnd: 0, lam: 0, z: zc, x: WX(P[k].x), y: WY(P[k].y), vx: 0, vy: 0, st: P[k].st, tf: P[k].tf, aire: false, moj: 0, saltos: P[k].saltos, rumbo: 0 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var part = V3.particulas(esc, 400);
      var mira = new T.Vector3(0, 3.5, 0);
      esc.encuadrar(ANCHO + 4, 17, mira, .1);
      /* lo que se mueve queda vivo; el resto del escenario se congela (matrices fijas) */
      var vivos3 = [flecha, perroG, esc.luces.sol.target, cas, lej, telef], o3;
      pads3.forEach(function (o) { vivos3.push(o.g); }); caen.forEach(function (o) { vivos3.push(o.g); vivos3.push(o.av); });
      pjs.forEach(function (o) { vivos3.push(o.env); }); rayas.forEach(function (o) { vivos3.push(o.m); });
      aves3.forEach(function (o) { vivos3.push(o.car); vivos3.push(o.fle); }); poolZ.concat(poolL).forEach(function (o) { vivos3.push(o.g); }); zamuros.forEach(function (o) { vivos3.push(o.g); }); papagayos.forEach(function (o) { vivos3.push(o.g); });
      nubes.forEach(function (o) { vivos3.push(o); }); luces.forEach(function (o) { vivos3.push(o); });
      for (k = 0; k < S3.children.length; k++) {
        o3 = S3.children[k];
        if (o3.isLight || vivos3.indexOf(o3) >= 0) continue;
        o3.updateMatrixWorld(true);
        o3.traverse(function (h) { h.matrixAutoUpdate = false; });
      }
      return V3.ultimo = { esc: esc, pjs: pjs, flecha: flecha, part: part, pads: pads3, caen: caen, perro: perroG, patas: patas, rabo: rabo,
        zamuros: zamuros, papagayos: papagayos, lej: lej, telef: telef, cabinas: cabinas, rayas: rayas, matRaya: matRaya, aves3: aves3, textos: [], vsnd: null, nubes: nubes, luces: luces, mira: mira, lanzado: {}, salpico: {}, ladro: 0, llego: 0,
        piedra: piedra, pasto: pasto, stoneL: stoneL, grassL: grassL, repL: repL, noche: !!pl.noche };
    }
    function finJ() { var k = nTf(); return k >= n || (k > 0 && c.ahora() * 30 - minTf() >= GRACIA * 30) || c.ahora() >= dur; }
    function toboCerca(x, y, gt) {                                            // ¿hay una piedra cayendo (o por caer) sobre esta columna? devuelve {x, y} de la piedra o null
      var j;
      for (j = 0; j < tobos.length; j++) {
        var b = tobos[j];
        if (b.T - 0.9 > gt) break;
        if (gt > b.T + 1.5 || Math.abs(b.x - x) > 34) continue;
        var by = gt < b.T ? b.y0 : b.y0 - b.v * (gt - b.T);
        if (by > y - 10 && by < y + FH * 3) return { x: b.x, y: by };
      }
      return null;
    }
    function viento(gt) { var k2, g2; for (k2 = 0; k2 < gustas.length; k2++) { g2 = gustas[k2]; if (gt >= g2.T - 1 && gt < g2.T + g2.L) return g2; } return null; }
    function aveToca(q, gt) {                                                 // ¿hay un ave encima de este cuerpo? (para pintar el golpe en los remotos)
      var j;
      for (j = 0; j < aves.length; j++) {
        var b = aves[j];
        if (b.T > gt) break;
        if (gt > b.T + aveDur(b) + 0.2) continue;
        if (Math.abs(aveX(b, gt) - q.x) < 34 && Math.abs(aveY(b, gt) - (q.y + 18)) < 40) return b;
      }
      return null;
    }
    function texto3(x, y, z, s2, col) { var tx = v3.textos; tx.push({ x: x, y: y, z: z, s: s2, col: col, t0: absT }); if (tx.length > 8) tx.shift(); }
    function golpe3D(p, gt) {
      var V = v3, s3 = V.pjs[p], q = P[p], ult = q.own ? q.ult : (aveToca(q, gt) ? 3 : toboCerca(q.x, q.y, gt) ? 1 : 4), mio = p === c.yo, ave = ult === 3 ? aveToca(q, gt) || aveToca({ x: q.x, y: q.y }, gt - 0.1) : null;
      if (ult === 3) {
        s3.pj.impacto(ave ? ave.d : 1, 0, 2); s3.sqv -= 6;             // el ave pasa de lado: el golpe va en su dirección
        V.part.soltar(s3.x, s3.y + 1.6, s3.z, 26, { k: 'confeti', cols: ave && ave.k ? ['#3fcf6a', '#e8404a', '#3fb0ff', '#ff8a3d'] : ['#1a1620', '#3a3040', '#8a4a4a'], vel: 4, arriba: 3, g: 4, vida: 1.1, esc: 1.2 });
        V3.sfx('golpe'); texto3(s3.x, s3.y + 3.8, s3.z, ave && ave.k ? '¡LORO!' : '¡ZAMURO!', '#ffd23f');
      } else if (ult === 4) {
        s3.pj.uno('susto'); s3.sqv -= 10;
        V.part.soltar(s3.x, s3.y + 3.2, s3.z, 14, { k: 'chispa', cols: ['#ffd23f', '#fffdf2'], vel: 2.4, arriba: 2, g: 0, vida: .8, esc: 1.1 });
        V3.sfx('choque'); texto3(s3.x, s3.y + 3.8, s3.z, '¡PISOTÓN!', '#ff8a3d');
      } else {
        if (ult === 1) {                                              // piedra: empuja desde el lado donde cayó
          var tb = toboCerca(q.x, q.y, gt);
          s3.pj.impacto(tb && q.x !== tb.x ? (q.x > tb.x ? 1 : -1) : 1, 0, 2);
          V.part.soltar(s3.x, s3.y + 2.4, s3.z, 22, { k: 'gota', cols: ['#c9c4d4', '#8a8a7a', '#8a6a4a'], vel: 3, arriba: 4, vida: .7, esc: 1.3 }); V3.sfx('choque');
        } else {                                                      // perro: te tumba al piso de abajo
          s3.pj.uno('caer');
          V.part.soltar(s3.x, s3.y + 1, s3.z, 14, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#8a5a32'], vel: 4, arriba: 3, vida: .5 }); V3.sfx('golpe');
        }
      }
      if (mio || Math.abs(s3.y - V.mira.y) < 9) V.esc.sacudir(mio ? 1 : .35);
    }
    function empuje3D(p, s3, q) {                                              // contacto entre cuerpos: empujón (1 recibe, 5 da) o pisotón (2 aplastado, 3 pisa)
      var V = v3, K = q.empK, d = q.empD, mio = p === c.yo;
      s3.eK = K; s3.eD = d; s3.eT = .5;
      if (K === 1) {
        s3.pj.impacto(d, 0, 1.6); s3.sqv -= 5;                         // el empujón va en la dirección en que te empujaron
        V.part.soltar(s3.x - d * .5, s3.y + 1.8, s3.z, 12, { k: 'chispa', cols: ['#fffdf2', '#ffd23f', '#ff8a3d'], vel: 3.2, arriba: 1.5, g: 2, vida: .45, esc: 1.2 });
        V3.sfx('golpe'); texto3(s3.x, s3.y + 3.8, s3.z, '¡PUM!', '#fffdf2'); if (mio) V.esc.sacudir(.35);
      } else if (K === 5) { s3.emp = .5; s3.pj.uno('pegar'); }
      else if (K === 2) { s3.pj.uno('susto'); s3.sqv -= 12; }
      else if (K === 3) { s3.pj.uno('saltar'); s3.sqv += 8; V.part.soltar(s3.x, s3.y + .2, s3.z, 8, { k: 'gota', cols: ['#fffdf2', '#c9c4d4'], vel: 2.4, arriba: 1, vida: .35, esc: .8 }); V3.sfx('salto'); }
    }
    function actualizar3D(dt, now) {
      var T = THREE, V = v3, p, k, j, t = absT, fin = finJ(), yo = c.yo, camY, gv;
      V.part.update(dt);
      /* cámara: sigue la repisa que sigue la simulación (cam), un poco por encima para ver lo que viene */
      camY = WY(cam);
      V.mira.set(0, camY + 3.5, 0); V.esc.encuadrar(AW * ES + 4, 17, V.mira, .1);
      V.esc.luces.sol.position.set(lv === 2 ? -26 : -12, camY + (lv === 2 ? 12 : 26), 14); V.esc.luces.sol.target.position.set(0, camY, 0);
      for (k = 0; k < V.luces.length; k++) V.luces[k].position.set(k ? 7 : -7, camY + (k ? 7 : 2), 5);
      var gsN0 = gusta(now);
      /* brisa visible: rayas de aire que cruzan en el sentido del viento (finas en el aviso, densas mientras sopla) */
      var gvv = viento(now), inten = 0, dirv = 0;
      if (gvv && !fin) { dirv = gvv.d; inten = now < gvv.T ? .3 : now > gvv.T + gvv.L - .3 ? Math.max(0, (gvv.T + gvv.L - now) / .3) : 1; }
      V.matRaya.opacity = .8 * inten;
      for (k = 0; k < V.rayas.length; k++) {
        var ry = V.rayas[k], vis = inten > 0 && (inten > .5 || k < 8);
        ry.m.visible = vis;
        if (!vis) continue;
        var u3 = (t * ry.sp * (gvv && gvv.T >= late ? 1.4 : 1) * .9 + ry.h * 7) % 1;
        ry.m.position.set(dirv * (-17 + 34 * u3), camY + 3.5 + ry.dy + Math.sin(u3 * 12 + k) * .35, ry.z); ry.m.scale.set(ry.l, 1, 1);
      }
      if (gvv && V.vsnd !== gvv && now >= gvv.T - 1) { V.vsnd = gvv; V3.sfx('viento'); }
      if (now >= late && !fin && c.fx() < .03) V.esc.sacudir(.15);                 // los últimos segundos: el cerro retumba
      /* aves que cruzan: carril de aviso 1 s antes, luego el ave en vuelo con plumas */
      for (k = 0; k < V.aves3.length; k++) {
        var a3 = V.aves3[k], b3 = a3.b, dtb = now - b3.T, dur3 = aveDur(b3), by3 = WY(aveY(b3, now));
        a3.car.visible = a3.fle.visible = false;
        if (dtb < -1.1 || dtb > dur3 + .1) { if (dtb > dur3 + .1) a3.ob.g.visible = false; continue; }
        var enVista = Math.abs(WY(b3.y) - V.mira.y) < 13;
        if (dtb < 0) {
          var fl2 = Math.floor(t * 12) % 2, byw = WY(b3.y);
          a3.car.visible = a3.fle.visible = enVista; a3.carMat.opacity = (.18 + .14 * fl2) * Math.min(1, (1.1 + dtb) * 3);
          a3.car.position.set(0, byw, .8); a3.car.scale.set(AW * ES + 4, 1, 1);
          a3.fle.position.set(-b3.d * (AW * ES / 2 + .9 - Math.abs(Math.sin(t * 6)) * .5), byw, .8); a3.fle.rotation.z = -b3.d * Math.PI / 2;
          if (!a3.aviso && enVista) { a3.aviso = 1; V3.sfx(b3.k ? 'silbido' : 'error'); }
        } else {
          var g4 = a3.ob.g, bxw = WX(aveX(b3, now));
          g4.visible = true; a3.paso = 1;
          g4.position.set(bxw, by3, .5); g4.rotation.y = b3.d > 0 ? Math.PI / 2 : -Math.PI / 2; g4.rotation.z = b3.k ? Math.cos(b3.ph + 4 * dtb) * .35 * b3.d * -1 : 0;
          var fa2 = Math.sin(t * (b3.k ? 20 : 5) + k) * (b3.k ? .7 : .35); a3.ob.a1.rotation.z = fa2; a3.ob.a2.rotation.z = -fa2;
          if (c.fx() < .45 && enVista) V.part.soltar(bxw, by3, .5, 1, { k: 'confeti', cols: b3.k ? ['#3fcf6a', '#e8404a', '#3fb0ff'] : ['#1a1620', '#3a3040'], vel: .5, arriba: -.2, g: 3, vida: .9, esc: .7 });
          if (!a3.sono && enVista) { a3.sono = 1; V3.sfx('whoosh'); }
        }
      }
      /* lo que se mueve solo: zamuros, loros, niebla y cocuyos */
      for (k = 0; k < V.zamuros.length; k++) {
        var zm = V.zamuros[k], an = t * .35 + zm.f;
        zm.g.position.set(zm.x + Math.cos(an) * zm.r, camY + zm.alto + Math.sin(t * .7 + k) * .8, -48 + Math.sin(an) * 6); zm.g.scale.set(2.2, 2.2, 2.2);
        zm.g.rotation.y = -an; var al = Math.sin(t * 3 + k) * .25 + .1; zm.a1.rotation.z = al; zm.a2.rotation.z = -al;
      }
      for (k = 0; k < V.papagayos.length; k++) {
        var pg = V.papagayos[k];
        pg.g.position.set(pg.x + Math.sin(t * .6 + k) * 1.2, camY + pg.dy + Math.sin(t * 1.1 + k * 2) * .6, pg.z); pg.g.rotation.z = Math.sin(t * 1.3 + k) * .25;
        for (j = 0; j < pg.cola.length; j++) pg.cola[j].position.x = Math.sin(t * 4 - j * .8 + k) * .12 * (j + 1);
      }
      V.lej.position.y = camY * .9;                                             // lo lejano sube más despacio: profundidad
      V.telef.position.set(0, camY + 15, 0);
      for (k = 0; k < V.cabinas.length; k++) { var u2 = (Math.sin(t * .09 + k * Math.PI) + 1) / 2, cx2 = -44 + u2 * 88; V.cabinas[k].position.set(cx2, cx2 * .2 + (k ? -1.2 : 0), -24); V.cabinas[k].rotation.z = Math.sin(t * 1.3 + k) * .06; }
      for (k = 0; k < V.nubes.length; k++) { var nb = V.nubes[k]; nb.position.x += dt * (.8 + (k % 3) * .3 + gsN0 * 6); if (nb.position.x > 80) nb.position.x = -80; }
      if (V.noche && c.fx() < .2) V.part.soltar(WX(c.fx() * AW), camY + c.fx() * 14, 2.4, 1, { k: 'chispa', cols: ['#e8ff7a', '#fff6a0'], vel: .3, arriba: .4, g: 0, vida: 2.4, esc: .9 });   // cocuyos
      for (k = 0; k < V.pads.length; k++) {                                    // bejucos: se mecen; tiemblan fuerte al rebotar
        var pd = V.pads[k]; pd.wob = Math.max(0, pd.wob - dt * 1.6);
        pd.cuerda.position.y = -Math.sin(t * 2 + k) * .05 - Math.sin(t * 26) * pd.wob * .35;
        for (j = 0; j < pd.prendas.length; j++) pd.prendas[j].rotation.x = Math.sin(t * 2.4 + j + k) * .25 + Math.sin(t * 20 + j) * pd.wob * .6;
      }
      /* viento: aviso con hojas que vuelan desde el lado de donde sopla */
      gv = viento(now);
      if (gv && now >= gv.T && c.fx() < .6) V.part.soltar(gv.d > 0 ? -11 : 11, camY + 1 + c.fx() * 14, 2.6, 2, { k: 'confeti', cols: ['#8ad04a', '#5f9a4a', '#ffd23f'], vel: 7, arriba: 1, g: 2, vida: 1.2, esc: .9 });
      /* repisas que se derrumban: tiemblan 1,2 s, se caen y vuelven */
      for (k = 0; k < V.repL.length; k++) {
        var r2 = V.repL[k], pl2 = r2.pl;
        if (pl2.caeT === undefined) continue;
        var est = now < pl2.caeT - 1.2 ? 0 : now < pl2.caeT ? 1 : now < pl2.volT ? 2 : 0;
        if (est !== r2.est) {
          repisa(r2, 0, est === 2 ? 0 : 1);
          if (est === 2) { V.part.soltar(r2.cx, r2.y + .5, 0, 30, { k: 'gota', cols: ['#c9c4d4', '#8a8a7a', '#5f9a4a'], vel: 4, arriba: 3, g: 14, vida: 1.1, esc: 1.2 }); V3.sfx('caida'); }
          r2.est = est;
        }
        if (est === 1) { repisa(r2, Math.sin(t * 45) * .06, 1); if (c.fx() < .4) V.part.soltar(r2.cx + (c.fx() - .5) * r2.sx, r2.y - .1, .6, 1, { k: 'gota', cols: ['#c9c4d4', '#8a8a7a'], vel: .5, arriba: 1, g: 6, vida: .5, esc: .9 }); }
      }
      function repisa(r2, dx, sc) {
        var a = V.stoneL[r2.i], g2 = V.grassL[r2.i];
        V.piedra.poner(r2.i, { x: a.x + dx, y: a.y, z: a.z, sx: a.sx * sc, sy: a.sy * sc, sz: a.sz * sc, c: a.c });
        V.pasto.poner(r2.i, { x: g2.x + dx, y: g2.y, z: g2.z, sx: g2.sx * sc, sy: g2.sy * sc, sz: g2.sz * sc, c: g2.c });
      }
      /* las piedras: tiemblan en la repisa de arriba (la columna avisa 0,9 s) y caen */
      for (k = 0; k < V.caen.length; k++) { V.caen[k].g.visible = false; V.caen[k].av.visible = false; }
      for (j = 0; j < tobos.length; j++) {
        var b = tobos[j], dtv = now - b.T;
        if (dtv < -0.9) break;
        var cn = V.caen[b.i % V.caen.length];
        if (dtv < 0) {
          cn.g.visible = true; cn.g.position.set(WX(b.x) + Math.sin(t * 40 + b.i) * .08, WY(b.y0), 2.2); cn.g.rotation.set(0, t * 2, 0);
          cn.av.visible = true; cn.av.position.set(WX(b.x), WY(b.y0) / 2, 2.2); cn.av.scale.set(1, WY(b.y0), 1);
        } else {
          var by = b.y0 - b.v * dtv;
          if (by < -20) { if (!V.salpico[b.i]) { V.salpico[b.i] = 1; if (camY < 8) { V.part.soltar(WX(b.x), .1, 2.2, 16, { k: 'gota', cols: ['#c9c4d4', '#8a8a7a'], vel: 3, arriba: 3, vida: .6 }); V3.sfx('choque'); } } continue; }
          cn.g.visible = true; cn.g.position.set(WX(b.x), WY(by), 2.2); cn.g.rotation.set(t * 3 + b.i, dtv * 6, 0);
          if (c.fx() < .5) V.part.soltar(WX(b.x), WY(by) + .5, 2.2, 1, { k: 'gota', cols: ['#c9c4d4', '#8a8a7a'], vel: .4, arriba: 1, g: 6, vida: .4, esc: .9 });
        }
      }
      /* el perro cimarrón (nivel 3): corre por tu repisa, ladra antes de arrancar */
      var dq = yo >= 0 && lv >= 3 ? P[yo].dog : null, ver = !!(dq && dq.pl >= 0);
      V.perro.visible = ver;
      if (ver) {
        var ppl = plat[dq.pl], brinco = dq.ladra > 0 ? Math.abs(Math.sin(t * 16)) * .25 : 0;
        V.perro.position.set(WX(dq.x), WY(ppl.y) + brinco, 1.25); V.perro.rotation.y = dq.dir > 0 ? 0 : Math.PI;
        for (k = 0; k < V.patas.length; k++) V.patas[k].rotation.z = dq.ladra > 0 ? 0 : Math.sin(t * 22 + (k % 2) * Math.PI) * .7;
        V.rabo.rotation.z = .6 + Math.sin(t * 24) * .5;
        if (dq.ladra > 0 && !V.ladro) V3.sfx('error');
        V.ladro = dq.ladra > 0 ? 1 : 0;
      } else V.ladro = 0;
      /* los jugadores: squash/stretch, inclinación contra el viento, resbalones en el borde, jadeo al trepar, empujones */
      var gsN = gusta(now), avisoAve = null;
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], nx = WX(q.x), ny = WY(q.y), pj = s3.pj, env = s3.env;
        var vx = (nx - s3.x) / dt, vy = (ny - s3.y) / dt;
        s3.vx += (vx - s3.vx) * Math.min(1, dt * 14); s3.vy += (vy - s3.vy) * Math.min(1, dt * 14);
        s3.x = nx; s3.y = ny;
        var aire = q.own ? q.g < 0 && !q.tf : Math.abs(s3.vy) > 2.5 && !q.tf;
        var subio = q.own ? q.saltos > s3.saltos : (!s3.aire && aire && s3.vy > 6);
        if (subio) {
          pj.uno('saltar'); s3.sqv += 7;
          if (p === yo) V3.sfx('salto');
          for (k = 0; k < V.pads.length; k++) { var pa2 = V.pads[k].pl; if (Math.abs(q.y - pa2.y) < 14 && q.x > pa2.x0 - 6 && q.x < pa2.x1 + 6) { V.pads[k].wob = 1; if (p === yo) V3.sfx('resbalon'); } }
        }
        if (q.own) s3.saltos = q.saltos;
        if (q.own && q.jb > 0 && q.g >= 0 && !aire) s3.sq = Math.min(s3.sq, -.2);                 // se agacha un cuarto de segundo antes del salto
        if (q.own && q.vy > JV + 20 && absT > (s3.rebT || 0) && !subio) {                  // rebote en el bejuco
          s3.rebT = absT + .4;
          for (k = 0; k < V.pads.length; k++) { var pa3 = V.pads[k].pl; if (Math.abs(q.y - pa3.y) < 24 && q.x > pa3.x0 - 6 && q.x < pa3.x1 + 6) V.pads[k].wob = 1; }
          pj.uno('saltar'); s3.sqv += 8; if (p === yo) V3.sfx('resbalon');
        }
        if (s3.aire && !aire && !q.tf) {                                                    // aterriza: squash según la caída; si subió un piso, se agarra y jadea
          var cae = Math.max(0, -s3.vy), subioPiso = ny - s3.gy > FH * ES * .8;
          s3.sqv -= 4 + Math.min(9, cae * .5);
          V.part.soltar(nx, ny + .1, s3.z, 6, { k: 'gota', cols: ['#c9c4d4', '#a8a2b4'], vel: 1.6, arriba: 1, g: 6, vida: .35, esc: .7 }); if (p === yo) V3.sfx('tic');
          if (subioPiso) {
            s3.jad = 1.1; s3.agarre = .3;
            V.part.soltar(nx + q.fc * .7, ny + .15, s3.z, 9, { k: 'gota', cols: ['#8a8a7a', '#5f9a4a', '#c9c4d4'], vel: 1.8, arriba: 1.4, g: 6, vida: .5, esc: .9 });
            if (p === yo) texto3(nx, ny + 3.6, s3.z, '¡UF!', '#fffdf2');
          }
        }
        s3.aire = aire; if (!aire) s3.gy = ny;
        if (q.st === 1 && s3.st !== 1) golpe3D(p, now);
        if (q.empN !== s3.empN) { s3.empN = q.empN; empuje3D(p, s3, q); }
        if (q.tf && !s3.tf) {                                                   // ¡llegó a la cima!
          pj.uno('festejo');
          V.part.soltar(nx, ny + 2.5, s3.z, 50, { k: 'confeti', cols: ROPA, vel: 4, arriba: 5, g: 5, vida: 1.6 });
          V3.sfx(V.llego ? 'ding' : 'bocina'); if (p === yo) { V3.sfx('aplauso'); V.esc.sacudir(.5); }
          V.llego++;
          for (k = 0; k < n; k++) if (k !== p && !P[k].tf) V.pjs[k].lam = 1.4;     // los demás se lamentan
        }
        s3.st = q.st; s3.tf = q.tf;
        var corre = Math.abs(s3.vx) > 1.5, vn = Math.min(1, Math.abs(s3.vx) / 9);
        /* resbalón: al borde de la repisa yendo hacia afuera */
        var out = 0, plx = null, jj;
        if (!aire && !q.tf) {
          for (jj = 1; jj < plat.length; jj++) { var pq = plat[jj]; if (pq.k !== 'b' && Math.abs(pq.y - q.y) < 1 && q.x > pq.x0 - 3 && q.x < pq.x1 + 3) { plx = pq; break; } }
          if (plx) { if (q.x - plx.x0 < 8 && s3.vx < -.8) out = -1; else if (plx.x1 - q.x < 8 && s3.vx > .8) out = 1; }
        }
        if (out) {
          if (s3.desl <= 0 && p === yo) V3.sfx('resbalon');
          s3.desl = .3; s3.outD = out;
          if (absT > s3.slipSnd) { s3.slipSnd = absT + .16; V.part.soltar(nx + out * .5, ny + .1, s3.z, 3, { k: 'gota', cols: ['#8a8a7a', '#c9c4d4'], vel: 1.2, arriba: .8, g: 8, vida: .5, esc: .8 }); }
        } else if (s3.desl > 0) { s3.desl -= dt; if (s3.desl <= 0 && !aire && !q.tf) { s3.agarre = .3; s3.sqv -= 4; V.part.soltar(nx, ny + .15, s3.z, 6, { k: 'gota', cols: ['#fffdf2', '#c9c4d4'], vel: 1.4, arriba: 1, vida: .35, esc: .8 }); if (p === yo) V3.sfx('tic'); } }
        if (s3.jad > 0) s3.jad -= dt; if (s3.agarre > 0) s3.agarre -= dt; if (s3.emp > 0) s3.emp -= dt; if (s3.eT > 0) s3.eT -= dt; if (s3.lam > 0) s3.lam -= dt;
        /* polvo al correr y al ser arrastrado por la brisa */
        if (!aire && !q.tf && (corre || gsN) && absT > s3.dustT) { s3.dustT = absT + (corre ? .16 : .3); V.part.soltar(nx - (s3.vx > 0 ? .3 : -.3), ny + .1, s3.z, 2, { k: 'gota', cols: ['#c9c4d4', '#a8a2b4'], vel: .9, arriba: .7, g: 5, vida: .35, esc: .6 }); }
        var toboC = toboCerca(q.x, q.y, now), aveC = null, aj;
        for (aj = 0; aj < aves.length; aj++) {                                  // ave que viene hacia mí
          var ab = aves[aj]; if (ab.T - 1 > now) break; if (now > ab.T + aveDur(ab)) continue;
          var da = (q.x - aveX(ab, now)) * ab.d; if (da > 0 && da < 110 && Math.abs(aveY(ab, now) - (q.y + 18)) < 44) { aveC = ab; break; }
        }
        if (q.tf) pj.anim(p % 2 ? 'bailar' : 'celebrar').cara('feliz');
        else if (fin && now > 0) pj.anim('triste').cara('triste');
        else if (q.st === 1) pj.anim(q.ult === 4 ? 'mareado' : 'mojado').cara('mareado');
        else if (s3.emp > 0) pj.anim('empujar', { vel: 1 }).cara('enojado');
        else if (s3.eT > 0 && s3.eK === 1) pj.anim('empujado').cara('susto');
        else if (s3.desl > 0) pj.anim('empujado').cara('susto');
        else if (aire) pj.anim('aire').cara(s3.vy < -6 ? 'susto' : 'concentrado');
        else if (aveC && !corre) pj.anim('agacharse').cara('susto');
        else if (s3.jad > 0) pj.anim('agacharse').cara('concentrado');
        else if (s3.lam > 0) pj.anim('gritar').cara('enojado');
        else pj.anim(corre ? 'correr' : 'quieto', { vel: vn }).cara(toboC || aveC ? 'susto' : corre ? 'concentrado' : 'normal');
        if (aveC && !aire && !q.tf && absT > (s3.esqT || 0)) { s3.esqT = absT + 1.2; pj.uno('esquivar'); }
        if (toboC && !q.tf) pj.mirarA({ x: WX(toboC.x), y: WY(toboC.y), z: 2.2 });            // mira la piedra que cae
        else if (aveC && !q.tf) pj.mirarA({ x: WX(aveX(aveC, now)), y: WY(aveY(aveC, now)), z: .5 });   // y el ave que viene
        else pj.mirar(Math.sin(absT * .8 + p * 2) * .5, Math.sin(absT * .5 + p) * .2);
        var ru = q.tf ? 0 : aveC ? -aveC.d * Math.PI / 2 : corre || aire ? q.fc * Math.PI / 2 : q.fc * .55;
        pj.rumbo(ru).update(dt);
        /* resorte de squash/stretch + inclinación (viento, carrera, resbalón, empujón) */
        if (!aire && !q.tf && !corre) s3.sq += Math.sin(absT * 2.2 + p) * .0006;
        s3.sqv += (-170 * s3.sq - 13 * s3.sqv) * dt; s3.sq = cl(s3.sq + s3.sqv * dt, -.45, .45);
        var tilt = (aire || q.tf ? 0 : gsN * .17) + (corre && !q.tf ? -(s3.vx > 0 ? 1 : -1) * .1 : 0);
        if (s3.desl > 0) tilt += -s3.outD * (.25 + .12 * Math.sin(absT * 30));
        if (s3.eT > 0) tilt += (s3.eK === 1 ? s3.eD * .5 : s3.eK === 5 ? -s3.eD * .3 : 0) * (s3.eT / .5);
        s3.lr += (tilt - s3.lr) * Math.min(1, dt * 12);
        var resp = s3.jad > 0 ? Math.sin(absT * 24) * .035 : 0;
        /* el cuerpo se mueve con pj.g.position (la cadencia del kit sale de esa velocidad real). env solo lleva la inclinación y el squash:
           world = E + R·S·x, así que E = W − R·S·W deja el pivote en los pies, en W */
        var sxq = 1 - (s3.sq + resp) * .5, syq = 1 + s3.sq + resp, cz2 = Math.cos(s3.lr), sz2 = Math.sin(s3.lr);
        var ax2 = sxq * nx, ay2 = syq * ny, az2 = sxq * s3.z;
        env.scale.set(sxq, syq, sxq);
        env.rotation.z = s3.lr;
        env.position.set(nx - (ax2 * cz2 - ay2 * sz2), ny - (ax2 * sz2 + ay2 * cz2), s3.z - az2);
        pj.g.position.set(nx, ny, s3.z);
      }
      var mi = yo >= 0 ? V.pjs[yo] : null;
      V.flecha.visible = !!mi && !P[yo].tf;
      if (mi) V.flecha.position.set(mi.x, mi.y + 3.6 + Math.abs(Math.sin(t * 4)) * .3, mi.z);
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p, j, yo = c.yo, cx = (f.x0 + f.x1) / 2; v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      /* avisos: máximo 2 textos a la vez (un cartel grande + 1 etiqueta, o 2 etiquetas) */
      var gv = viento(now), ban = null, nT = 0;
      if (yo >= 0 && P[yo].tf) ban = ['¡ARRIBA!', 126, 26, '#ffd23f'];
      else if (now >= late && now < late + 2.6 && !finJ()) ban = ['¡ÚLTIMOS SEGUNDOS!', 126, 24, '#ff5c8a'];
      else if (yo >= 0 && lv >= 3 && P[yo].dog.ladra > 0) ban = ['¡UN PERRO CIMARRÓN!', 126, 14, '#ffffff'];
      else if (gv && now >= gv.T - 1 && now < gv.T + gv.L && !finJ()) ban = [gv.d > 0 ? '¡VIENTO →!' : '¡VIENTO ←!', 126, 18, '#fffdf2'];
      else if (now >= 0 && now < 2.5 && !c.practica) ban = ['¡SUBE HASTA LA CIMA!', 126, 22, '#fffdf2'];
      else if (now < 0 && !c.practica) ban = ['SALTA BAJO LA REPISA DE ARRIBA · OJO CON LAS PIEDRAS', 126, 14, '#fffdf2'];
      if (ban) nT = 1;
      function av(s2, x, y, sz, col) { if (nT >= 2) return; nT++; txt(s2, x, y, sz, col, 0, true); }
      if (now >= 0 && !finJ()) V3.musica('cerro');
      v3.esc.render(dt);
      /* textos encima del 3D: piedras, derrumbes, viento, la cima y los últimos segundos */
      for (j = 0; j < tobos.length; j++) {
        var b = tobos[j], dtv = now - b.T;
        if (dtv < -0.9) break;
        if (dtv >= 0) continue;
        var pa = v3.esc.proyectar(WX(b.x), WY(b.y0) + 1.8, 2.2);
        if (pa.y > 72 && pa.y < 590) av('¡PIEDRA!', pa.x, pa.y, 13, Math.floor(absT * 10) % 2 ? '#ffffff' : '#ffd23f');
      }
      for (j = 0; j < v3.repL.length; j++) {
        var rr2 = v3.repL[j], pdv = rr2.pl;
        if (pdv.caeT === undefined || now < pdv.caeT - 1.2 || now >= pdv.caeT) continue;
        var pd2 = v3.esc.proyectar(rr2.cx, rr2.y + 1.6, 0);
        if (pd2.y > 72 && pd2.y < 590) av('¡DERRUMBE!', pd2.x, pd2.y, 13, Math.floor(absT * 10) % 2 ? '#ffffff' : '#ff8a3d');
      }
      var pr = v3.esc.proyectar(0, WY(ROOFY) + 5.2, -1);
      if (pr.y > 80 && pr.y < 590) txt('LA CIMA', pr.x, pr.y, 16, '#ffd23f', 0, true);
      if (v3.perro.visible && P[yo].dog.ladra > 0) { var pg = v3.esc.proyectar(v3.perro.position.x, v3.perro.position.y + 1.8, 1.2); av('¡GUAU!', pg.x, pg.y, 13, '#ffffff'); }
      for (p = 0; p < n; p++) {
        var s3 = v3.pjs[p], pt = v3.esc.proyectar(s3.x, s3.y + (p === yo ? 4.6 : 3.4), s3.z);
        if (pt.y < 72 || pt.y > 600) continue;
        txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (P[p].st === 1) txt('¡AY!', pt.x, pt.y - 16, 12, '#ff5c8a', 0, true);
      }
      for (j = v3.textos.length - 1; j >= 0; j--) {
        var tx3 = v3.textos[j], ag3 = absT - tx3.t0;
        if (ag3 > .9) { v3.textos.splice(j, 1); continue; }
        var pp3 = v3.esc.proyectar(tx3.x, tx3.y + ag3 * 1.4, tx3.z);
        if (pp3.y > 72 && pp3.y < 600) av(tx3.s, pp3.x, pp3.y, 14, tx3.col);
      }
      for (j = 0; j < v3.aves3.length; j++) {
        var a4 = v3.aves3[j], d4 = now - a4.b.T;
        if (d4 < -1.1 || d4 >= 0 || Math.abs(WY(a4.b.y) - v3.mira.y) > 13) continue;
        var pa4 = v3.esc.proyectar(-a4.b.d * (AW * ES / 2 - 2), WY(a4.b.y) + 1.4, .8);
        if (pa4.y > 72 && pa4.y < 590) av(a4.b.k ? '¡LORO!' : '¡ZAMURO!', pa4.x, pa4.y, 13, Math.floor(absT * 10) % 2 ? '#ffffff' : '#ffd23f');
      }
      barra(cx);
      if (yo >= 0) { var qy = P[yo]; txt(qy.tf ? 'ARRIBA' : 'REPISA ' + Math.floor(qy.hmax / FH) + '/' + NF, f.x0 + 56, 92, 15, '#ffd23f', 0, true); }
      if (ban) txt(ban[0], cx, ban[1], ban[2], ban[3], 0, true);
      drawP();
    }

    /* el dibujo 2D de siempre: respaldo sin WebGL o con ?plano=1 */
    function dibujar2D() {
      var cp = c.campo(), x0 = cp.x0, x1 = cp.x1, cx = (x0 + x1) / 2, ax0 = cx - AW / 2, gt = c.ahora(), p, yo = c.yo;
      fondo(x0, x1, cx, gt);
      edificio(ax0, gt);
      platabanda(ax0);
      pisos(ax0, gt);
      tobosVivos(ax0, gt);
      aves2D(ax0, gt);
      if (lv >= 3 && yo >= 0) perroDib(ax0, P[yo], gt);
      for (p = 0; p < n; p++) if (p !== yo) chico(ax0, p, 0.55, false, gt);
      if (yo >= 0) chico(ax0, yo, 1, true, gt);
      barra(cx);
      if (yo >= 0 && P[yo].tf) txt('¡ARRIBA!', cx, 120, 26, '#ffd23f');
      else if (gt >= 0 && gt < 1.2 && !c.practica) txt('¡SUBE!', cx, 120, 26, '#fffdf2');
      if (yo >= 0 && lv >= 3 && P[yo].dog.ladra > 0) txt('¡UN PERRO CIMARRÓN!', cx, 150, 13, '#ffffff');
    }

    var g = {
      update: function (dt) {
        var gt = c.ahora(), p, d = Math.min(dt, 0.1);
        acc += d; absT += d;
        var pasos = Math.floor(acc / H + 1e-6);
        acc -= pasos * H;
        for (p = 0; p < n; p++) updJugador(p, pasos);
        /* cámara: sigue el piso donde estoy (no mi salto) y se suaviza */
        var foco = 0, yo = c.yo >= 0 ? c.yo : -1;
        if (yo >= 0) { var qy = P[yo]; foco = qy.tf ? ROOFY : (qy.g >= 0 ? qy.gy : Math.max(qy.gy, qy.y - 20)); }
        else { for (p = 0; p < n; p++) foco = Math.max(foco, P[p].y); }
        cam += (foco - cam) * Math.min(1, d * 6);
      },
      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(c.campo());
        dibujar2D();
      },
      /* CPU: sigue la ruta (piso por piso) con 3-12 % de error de salto según skill; esquiva tobos tras ≥0,18 s de reacción */
      ai: function (p, dt, api) {
        var q = P[p], a = AIS[p], gt = c.ahora(), sk = c.skill[p], r = cpuR[p], j, pl;
        if (gt < 0 || q.tf) return;
        if (q.stun > 0) { api.eje(0, 0); return; }
        /* tobos: columnas que me alcanzan en < 0,6 s y que ya "vi" (aviso + reacción) */
        var dg = 0, seg = q.g >= 0 ? plat[q.g] : null, react = 0.2 + (1 - sk) * 0.5;
        for (j = 0; j < tobos.length; j++) {
          var b = tobos[j];
          if (b.T - 0.9 + react > gt) break;
          if (q.hit[b.i]) continue;
          var tArr = b.T + (b.y0 - (q.y + 20)) / b.v;
          if (tArr < gt - 0.05 || tArr > gt + 0.5) continue;
          if (Math.abs(b.x - q.x) >= 34) continue;
          var d1 = q.x < b.x ? -1 : 1, tx1 = b.x + d1 * 36;
          if (seg && (tx1 < seg.x0 + 4 || tx1 > seg.x1 - 4)) d1 = -d1;
          dg = d1; break;
        }
        if (dg) { api.eje(dg, 0); return; }
        /* aves: si una viene hacia mí a la altura del pecho y llega en < ~0,4 s, salto (los buenos esperan menos) */
        if (q.g >= 0 && a.cd <= 0) {
          for (j = 0; j < aves.length; j++) {
            var av = aves[j];
            if (av.T > gt) break;
            if (q.hit['a' + av.i] || gt > av.T + aveDur(av)) continue;
            var dd2 = (q.x - aveX(av, gt)) * av.d, ay2 = aveY(av, gt);
            if (dd2 > 0 && dd2 < av.v * (0.2 + 0.25 * sk) && ay2 > q.y - 6 && ay2 < q.y + 46) { api.press('a'); a.cd = 0.8; return; }
          }
        } else if (a.cd > 0) a.cd -= dt;
        if (!seg) { api.eje(a.air, 0); return; }
        if (a.wait > 0) { a.wait -= dt; api.eje(0, 0); return; }
        if (!a.plan) {
          var up = null, bd = 1e9, S = seg, U, k2, ov, tx;
          for (k2 = 0; k2 < (pf[S.f + 1] || []).length; k2++) {
            U = plat[pf[S.f + 1][k2]]; ov = Math.min(S.x1, U.x1) - Math.max(S.x0, U.x0);
            if (ov < 24) continue;
            if (U.caeT !== undefined && gt > U.caeT - 1.2 && gt < U.volT) continue;
            tx = (Math.max(S.x0, U.x0) + Math.min(S.x1, U.x1)) / 2;
            tx = cl(tx + ((p % 4) - 1.5) * 7, Math.max(S.x0, U.x0) + 5, Math.min(S.x1, U.x1) - 5);   // cada CPU salta desde un punto un poco distinto: no se amontonan a empujones
            if (Math.abs(tx - q.x) < bd) { bd = Math.abs(tx - q.x); up = { tx: tx, dir: 0 }; }
          }
          if (!up) {                                    // ningún piso de arriba sobre este tramo: saltar el hueco hacia el vecino que sí tenga
            var fl = pf[S.f] || [], idx = fl.indexOf(S.id), dirb = 0, kk;
            for (kk = 0; kk < fl.length; kk++) {
              U = plat[fl[kk]]; if (U.id === S.id) continue;
              var tiene = false, k3;
              for (k3 = 0; k3 < (pf[S.f + 1] || []).length; k3++) { var W2 = plat[pf[S.f + 1][k3]]; if (Math.min(U.x1, W2.x1) - Math.max(U.x0, W2.x0) >= 24) tiene = true; }
              if (tiene) { dirb = kk > idx ? 1 : -1; break; }
            }
            if (dirb === 0) dirb = q.x < AW / 2 ? 1 : -1;
            up = { tx: dirb > 0 ? S.x1 - 6 : S.x0 + 6, dir: dirb };
          }
          var pErr = 0.12 - 0.09 * sk;
          if (r.next() < pErr) up.tx += (up.dir ? up.dir * (16 + r.next() * 14) : (r.next() < 0.5 ? -1 : 1) * (26 + r.next() * 22));
          a.plan = up;
        }
        var pl2 = a.plan, dx = pl2.tx - q.x;
        if (Math.abs(dx) > 3) api.eje(dx > 0 ? 1 : -1, 0);
        else { api.eje(0, 0); api.press('a'); a.air = pl2.dir; a.plan = null; a.wait = 0.06 + (1 - sk) * 0.5 * r.next(); }
      },
      scores: function () {
        var out = [], p;
        for (p = 0; p < n; p++) out.push(P[p].tf ? 1000 + Math.max(0, dur * 30 - P[p].tf) : Math.min(999, Math.max(P[p].sc | 0, 0)));
        return out;
      },
      cuerpo: function (p) { var q = P[p]; return { x: q.x, y: q.y, sc: q.sc, tf: q.tf, st: q.st }; },
      done: function () {
        var k = nTf();
        if (k >= n) return true;
        return k > 0 && c.ahora() * 30 - minTf() >= GRACIA * 30;
      },
      vivo: function (p) { return true; },
      alRemoto: function (p, o, t) { var q = P[p]; if (!q || q.own) return; if (o.tf && !q.tf) q.tf = o.tf | 0; q.sc = o.sc | 0; q.lr = { x: o.x, y: o.y, sc: o.sc | 0, tf: o.tf | 0, st: o.st | 0 }; },
      alCpu: function (p) { P[p].own = false; },
      alHum: function (p, o) { var q = P[p]; q.own = false; if (o) { q.lr = { x: o.x, y: o.y, sc: o.sc | 0, tf: o.tf | 0, st: o.st | 0 }; if (o.tf && !q.tf) q.tf = o.tf | 0; q.sc = o.sc | 0; } },
      destacado: function () {
        var q = P[c.yo >= 0 ? c.yo : 0];
        if (!q) return '';
        if (q.tf) return 'llegó a la platabanda' + (q.hits ? ' pese a ' + q.hits + (q.hits === 1 ? ' tobo' : ' tobos') : '');
        return 'subió al piso ' + Math.floor(q.hmax / FH) + ' de ' + NF + (q.hits ? ' · ' + q.hits + (q.hits === 1 ? ' tobo' : ' tobos') : '');
      },
      vista: function () {
        var h = 7, j;
        for (j = 0; j < plat.length; j++) h = (Math.imul(h ^ (plat[j].x0 * 7 + plat[j].x1 * 13 + plat[j].y), 16777619) >>> 0);
        for (j = 0; j < tobos.length; j++) h = (Math.imul(h ^ Math.round(tobos[j].T * 1000 + tobos[j].x), 16777619) >>> 0);
        return { gt: c.ahora(), lv: lv, layoutHash: h, plat: plat, pf: pf, tobos: tobos, aves: aves, nPads: pads.length, empes: P.map(function (q) { return q.empes; }), pisos: P.map(function (q) { return q.pisos; }), NF: NF, ROOFY: ROOFY, FH: FH,
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), g: P.map(function (q) { return q.g; }), sc: P.map(function (q) { return q.sc; }),
          tf: P.map(function (q) { return q.tf; }), hits: P.map(function (q) { return q.hits; }), stun: P.map(function (q) { return q.stun; }), hmax: P.map(function (q) { return q.hmax; }),
          saltos: P.map(function (q) { return q.saltos; }), ult: P.map(function (q) { return q.ult; }), dog: P.map(function (q) { return q.dog; }), cam: cam };
      }
    };
    return g;
  }
});
})();
