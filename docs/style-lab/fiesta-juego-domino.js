'use strict';
/* LA FIESTA · EN VIVO · f_domino · ¡CAPICÚA!  (modelo B: dueño + juez)
   Mesa de dominó bajo la mata de mango. Cada jugador tiene su pista y la MISMA partitura (sembrada con c.rng en mk): las fichas
   vienen con el compás y hay que PEGAR A justo cuando llegan a la raya dorada.
   Puntos (cada dueño juzga SU pista con c.ahora()): PERFECTO ±60 ms = 10 · BUENO ±130 ms = 6 · REGULAR ±200 ms = 3 ·
   toque sin ficha = -2 · 8 buenas seguidas = +10 (¡CAPICÚA!) · ficha dorada: 30 si es perfecta, 0 si no.
   TRANQUE (la parte B, objeto compartido): 3 fichas centrales (t0..t2). Quien pega PERFECTO esa nota hace c.claim('t'+j) con
   animación optimista; el juez concede al menor t dentro de 120 ms (claimOk: |t - nota| <= 80 ms y no concedido antes). +25 al ganador.
   Las CPU no reclaman por la red: si un humano no lo cobra, la CPU que lo pegó perfecto se lo lleva 0,5 s después (un humano lo anula).
   Cuerpo en red (o): pts, combo, cal (0 nada,1 mal,2 regular,3 bueno,4 perfecto,5 dorada), nn (toques) -> el rival ve saltar su
   «¡PERFECTO!» en su pista al cambiar nn.
   Sin Math.random / Date.now: el azar sale de c.rng (solo en mk) o de c.rngFor('cpu'+p); lo cosmético de c.fx(). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_domino')) return;

var WIN_P = 0.06, WIN_G = 0.13, WIN_O = 0.2, SPD = 330, TR_WIN = 0.08, CPU_DELAY = 0.5;
var BPM = [90, 110, 130];
var PIP = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]];
/* paletas por nivel: 1 día, 2 atardecer, 3 noche */
var PAL = [
  { sky: '#8fd8ff', sky2: '#d9f3ff', ground: '#a9855a', leaf: '#3f8a4a', leaf2: '#56a85c', mesa: '#f1ead6', felt: '#2f7452', felt2: '#2c6a4c', trunk: '#6b4a2b', sun: '#ffe14d' },
  { sky: '#ff9a5a', sky2: '#5a3b7a', ground: '#7d5f43', leaf: '#356b45', leaf2: '#42805a', mesa: '#e3d6c0', felt: '#2b6a52', felt2: '#275f49', trunk: '#5a3d24', sun: '#ffb347' },
  { sky: '#0f1530', sky2: '#26305e', ground: '#3d3a4f', leaf: '#1f4a3d', leaf2: '#285a4a', mesa: '#c9c2d8', felt: '#1f5a46', felt2: '#1c503f', trunk: '#3a2a22', sun: '#dfe8ff' }
];
function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }

/* ficha de dominó acostada, centrada en x,y; a|b = puntos de cada mitad (0..6) */
function ficha(x, y, w, a, b, o, gold) {
  var h = w / 2, d = h * 0.27, r = Math.max(2, h * 0.1);
  rr(x - w / 2, y - h / 2, w, h, h * 0.2, gold ? '#ffd23f' : '#fffdf2', o);
  line([[x, y - h * 0.36], [x, y + h * 0.36]], Math.max(1.6, h * 0.06), gold ? '#a8741a' : '#14101c');
  [a, b].forEach(function (n, i) {
    var cx = x + (i ? 1 : -1) * w / 4, P = PIP[n];
    for (var k = 0; k < P.length; k++) ell(cx + P[k][0] * d, y + P[k][1] * d, r, r, gold ? '#7a2a14' : '#14101c', 0);
  });
}

FIESTA.LIVE.add('f_domino', {
  name: '¡CAPICÚA!',
  modos: ['ffa', '1v1'],
  clase: 'rank',
  modelo: 'B',
  dur: 30,
  stick: false,
  botones: 1,
  bodyHz: 12,
  migra: true,
  minHumanos: 1,
  limites: { scoreMax: 1000, scoreRate: 40, minT: 27, finTemprano: 0 },
  cuerpo: ['pts', 'combo', 'cal', 'nn'],
  discretos: ['pts', 'combo', 'cal', 'nn'],
  carta: {
    obj: 'Pega cuando la ficha llegue a la raya',
    gana: 'Más puntos. ¡El primero en pegar el TRANQUE se lo lleva!',
    como: { tactil: 'A al compás', teclado: 'ESPACIO o J' },
    demos: [
      { id: 'compas', txt: 'Pega A justo cuando la ficha toca la raya dorada: perfecto vale 10.' },
      { id: 'tranque', txt: 'Si pegas perfecto la ficha del TRANQUE antes que nadie, +25.' }
    ],
    roles: null
  },

  mk: function (c) {
    var n = c.n, lv = cl(c.lv || 1, 1, 3), dur = c.dur, rng = c.rng, PL = PAL[lv - 1];
    var b0 = 60 / BPM[lv - 1];
    var T0 = Math.min(2.2, 0.25 * dur), TEND = Math.max(T0 + 2, dur - 1.5);
    /* ───── partitura (idéntica en todos: SOLO de c.rng, todo dentro de mk) ───── */
    var tcS = -1, tcE = -1;
    var r1 = rng.next();
    if (TEND - T0 >= 10) { tcS = T0 + (TEND - T0) * (0.3 + 0.25 * r1); tcE = tcS + 4; }
    var bl = function (t) { return (t >= tcS && t < tcE) ? b0 / 1.2 : b0; };
    var pD = [0.05, 0.14, 0.2][lv - 1], pO = [0.1, 0.18, 0.24][lv - 1], pR = [0.14, 0.14, 0.12][lv - 1];
    var beats = [], notes = [];
    for (var t = T0, i = 0; t < TEND; i++) {
      beats.push({ t: t, acc: i % 4 === 0 });
      var add = function (o, tt) { notes.push({ t: tt + o, a: rng.int(0, 6), b: rng.int(0, 6), gold: false, dark: false, on: o === 0, acc: i % 4 === 0 && o === 0, tr: -1 }); };
      var B = bl(t);
      if (i < 3) add(0, t);
      else {
        var r = rng.next();
        if (r < pD) { add(0, t); add(B * 0.5, t); }
        else if (r < pD + pO) add(B * 0.5, t);
        else if (r < pD + pO + pR) { /* silencio */ }
        else add(0, t);
      }
      t += B;
    }
    /* apagón (lv>=2): ~2 compases a oído */
    var dk0 = -1, dk1 = -1;
    if (lv >= 2 && beats.length >= 12) {
      var nb = Math.min(lv === 2 ? 6 : 8, Math.floor(beats.length * 0.25));
      var i0 = Math.floor(beats.length * (0.5 + rng.next() * 0.15));
      i0 = Math.min(i0, beats.length - nb - 1);
      dk0 = beats[i0].t; dk1 = beats[Math.min(beats.length - 1, i0 + nb)].t;
    } else rng.next();
    for (var q = 0; q < notes.length; q++) notes[q].dark = dk0 >= 0 && notes[q].t >= dk0 - 0.15 && notes[q].t <= dk1 + 0.1;
    var outDark = function (q) { return dk0 < 0 || q.t < dk0 - 0.6 || q.t > dk1 + 0.6; };
    /* tranques: 3, en tiempo fuerte entre 25% y 80% de dur, fuera del apagón; solo si dur >= 20 */
    var trq = [];
    if (dur >= 20) {
      var cand = notes.filter(function (q) { return q.acc && q.t >= 0.25 * dur && q.t <= 0.8 * dur && outDark(q); });
      if (cand.length < 3) cand = notes.filter(function (q) { return q.on && q.t >= 0.2 * dur && q.t <= 0.85 * dur && outDark(q); });
      var gap = 2.5;
      for (var k = 0; k < 3 && cand.length; k++) {
        var q1 = cand[Math.floor(rng.next() * cand.length)];
        q1.tr = trq.length; trq.push(q1);
        cand = cand.filter(function (z) { return Math.abs(z.t - q1.t) >= gap; });
      }
      trq.sort(function (a, b) { return a.t - b.t; });
      for (var j = 0; j < trq.length; j++) trq[j].tr = j;
    }
    /* ficha dorada (doble seis) */
    var gc = notes.filter(function (q, ix) { return q.on && q.tr < 0 && ix > notes.length * 0.3 && ix < notes.length * 0.8 && outDark(q) && trq.every(function (z) { return Math.abs(z.t - q.t) >= 1; }); });
    var gold = gc.length ? gc[Math.floor(rng.next() * gc.length)] : notes[Math.floor(notes.length / 2)];
    if (gold.tr >= 0) { var alt = notes.filter(function (q) { return q.tr < 0; }); gold = alt[Math.floor(alt.length / 2)] || gold; }
    gold.gold = true; gold.a = 6; gold.b = 6;
    var N = notes.length;
    var hash = 2166136261 >>> 0;
    for (var hi = 0; hi < N; hi++) { hash = (Math.imul(hash ^ Math.round(notes[hi].t * 1000), 16777619)) >>> 0; hash = (Math.imul(hash ^ (notes[hi].gold ? 1 : 0) ^ ((notes[hi].tr + 1) << 1), 16777619)) >>> 0; }

    /* ───── estado ───── */
    var st = [], hitT = [], pts = [], combo = [], cal = [], nn = [], perf = [], best = [], mood = [], ph = [], say0 = [], aiI = [], plan = [], crng = [], pop = [];
    for (var p = 0; p < n; p++) {
      st.push(new Int8Array(N)); hitT.push(new Float32Array(N));
      pts[p] = 0; combo[p] = 0; cal[p] = 0; nn[p] = 0; perf[p] = 0; best[p] = 0; mood[p] = 0; ph[p] = 0; say0[p] = 0; aiI[p] = 0; plan[p] = []; crng[p] = null; pop[p] = null;
    }
    var rem = [], remNN = [];                     // últimos cuerpos de los demás
    var owner = [-1, -1, -1], humOwner = [-1, -1, -1], cpuAward = [-1, -1, -1], cpuBest = [null, null, null];
    var trBan = [0, 0, 0];
    var bi = 0, lastBeatT = -9, shake = 0, bnc = 0, slams = 0, dogJ = 0, ban = null, banT = 0, warn = [false, false, false], absT = 0, abuT = 0, abuSay = '';
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };
    var colOf = function (p) { return asiento(p).color || '#fff'; };
    var banner = function (s, col) { ban = { s: s, col: col }; banT = 1.7; };

    /* ───── juicio de UN toque en MI pista (p con mio(p)) ───── */
    function pegar(p, now) {
      var bi2 = -1, bd = 9, i;
      for (i = 0; i < N; i++) {
        if (st[p][i] !== 0) continue;
        var d = Math.abs(notes[i].t - now);
        if (d < bd) { bd = d; bi2 = i; }
        if (notes[i].t > now + 0.5) break;
      }
      ph[p] = 1; slams++; bnc = Math.min(1, bnc + 0.25); nn[p]++;
      if (bi2 < 0 || bd > WIN_O) {
        pts[p] -= 2; combo[p] = 0; perf[p] = 0; cal[p] = 1; mood[p] = 0.9;
        SND(110, 0.1, 'square', 0.05, -50);
        if (p === c.yo && say0[p] <= 0) { say0[p] = 0.9; S('SE TE CAYÓ LA FICHA', laneX(p) - 20, laneY(p) - 30, '#ff8a8a'); }
        return;
      }
      var q = notes[bi2]; st[p][bi2] = 1; hitT[p][bi2] = now;
      var v, lab, perfecto = bd <= WIN_P;
      if (perfecto) { v = 10; lab = '¡PERFECTO!'; cal[p] = 4; } else if (bd <= WIN_G) { v = 6; lab = '¡PLA!'; cal[p] = 3; } else { v = 3; lab = 'pla'; cal[p] = 2; }
      if (q.gold) {
        if (perfecto) { v = 30; lab = '¡DOBLE SEIS!'; cal[p] = 5; shake = 1; SPAWN(MXc(), laneY(p), 16, 'conf', ['#ffd23f', '#fff3c4', '#ff9a3d'], 320, 500, 0.9); SND(1500, 0.18, 'square', 0.1, 600); }
        else { v = 0; lab = '¡SE ROMPIÓ!'; cal[p] = 1; }
      }
      pts[p] += v;
      var good = q.gold ? perfecto : bd <= WIN_G;
      if (good) {
        combo[p]++; best[p] = Math.max(best[p], combo[p]);
        if (perfecto) perf[p]++;
        if (combo[p] % 8 === 0) { pts[p] += 10; S('¡CAPICÚA! +10', laneX(p) + 70, laneY(p) - 48, '#5cff7a'); SPAWN(MXc(), laneY(p), 8, 'conf', ['#5cff7a', '#fff'], 260, 500, 0.8); }
      } else { combo[p] = 0; if (v <= 3) mood[p] = 0.5; }
      if (perfecto && q.gold === false && perf[p] % 3 === 0) { abuT = 1; abuSay = '¡TRANCAOOO!'; }
      S(lab, laneX(p) + (v >= 10 ? 44 : 34), laneY(p) - 30, v >= 10 ? '#ffd23f' : v >= 6 ? '#fff' : '#c9c0b0');
      SPAWN(MXc(), laneY(p) + 4, v >= 10 ? 7 : 4, 'bit', ['#ffffff', '#ffe14d', '#d8d2c4'], 200, 500, 0.45);
      shake = Math.max(shake, perfecto ? 0.45 : 0.2);
      SND(v >= 10 ? 420 : 300, 0.06, 'square', 0.07, -150);
      /* TRANQUE: perfecto en una ficha central */
      if (q.tr >= 0 && perfecto) {
        var j = q.tr;
        if (p === c.yo) {
          banner('¿TRANQUE?', '#ffd23f');
          c.claim('t' + j, function (res) {
            if (res === 'ok') { pts[p] += 25; cal[p] = 5; banner('¡TRANCADO! +25', '#5cff7a'); abuT = 1; abuSay = '¡TRANCAOOO!'; SND(1500, 0.18, 'square', 0.1, 600); }
            else banner('¡TE LO QUITARON!', '#ff8a8a');
          });
        } else if (!cpuBest[j] || bd < cpuBest[j].bd) cpuBest[j] = { p: p, bd: bd };   // CPU / asiento caído que simulo (solo el juez)
      }
    }
    function MXc() { return c.campo().x0 + 210; }
    function laneGeom() {
      var f = c.campo(), TOP = 96, BOT = 466;
      var LH = Math.min(n <= 2 ? 124 : n === 3 ? 104 : 92, (BOT - TOP) / n), Y0 = TOP + ((BOT - TOP) - LH * n) / 2;
      return { L: f.x0, R: f.x1, TOP: TOP, BOT: BOT, LH: LH, Y0: Y0, MX: f.x0 + 210, RR: f.x1 - 112 };
    }
    function laneY(p) { var G = laneGeom(); return G.Y0 + p * G.LH + G.LH / 2; }
    function laneX(p) { return laneGeom().MX; }
    function pasar(p, now) {   // fichas que se pasaron (solo pistas que simulo yo)
      for (var i = 0; i < N; i++) if (st[p][i] === 0 && now > notes[i].t + WIN_O) { st[p][i] = 2; combo[p] = 0; perf[p] = 0; mood[p] = 0.9; if (cal[p] !== 1) cal[p] = 0; }
    }
    function adoptar(p, o) {
      var now = c.ahora();
      if (o) { pts[p] = o.pts | 0; combo[p] = o.combo | 0; cal[p] = o.cal | 0; nn[p] = o.nn | 0; remNN[p] = nn[p]; }
      for (var i = 0; i < N; i++) if (st[p][i] === 0 && notes[i].t < now + 0.05) st[p][i] = 2;
      aiI[p] = 0; plan[p] = [];
      while (aiI[p] < N && notes[aiI[p]].t <= now + 0.05) aiI[p]++;
    }

    var g = {
      update: function (dt) {
        var now = c.ahora();
        absT += dt; shake = Math.max(0, shake - dt * 3); bnc = Math.max(0, bnc - dt * 3); dogJ = Math.max(0, dogJ - dt * 1.6); banT = Math.max(0, banT - dt); abuT = Math.max(0, abuT - dt * 1.4);
        /* avisos del caos */
        if (!warn[0] && now >= gold.t - 1.5) { warn[0] = true; banner('¡EL DOBLE SEIS! 30 SI ES PERFECTA', '#ffd23f'); }
        if (!warn[1] && tcS >= 0 && now >= tcS - 0.3) { warn[1] = true; banner('¡CAMBIO DE RITMO!', '#ff5c8a'); }
        if (!warn[2] && dk0 >= 0 && now >= dk0 - 0.9) { warn[2] = true; banner('¡SE FUE LA LUZ! JUEGA A OÍDO', '#9ad0ff'); }
        /* el compás suena */
        while (bi < beats.length && beats[bi].t <= now) {
          var bt = beats[bi]; lastBeatT = now;
          if (now - bt.t < 0.12) { SND(bt.acc ? 180 : 130, 0.07, 'sine', 0.07); if (dk0 >= 0 && now >= dk0 - 0.6 && now <= dk1 + 0.5 || bt.acc) SND(bt.acc ? 900 : 700, 0.03, 'square', 0.02); }
          bi++;
        }
        for (var p = 0; p < n; p++) {
          ph[p] = Math.max(0, ph[p] - dt * 5); mood[p] = Math.max(0, mood[p] - dt); say0[p] = Math.max(0, say0[p] - dt);
          if (!c.mio(p)) continue;
          pasar(p, now);
          var k = c.tap(p, 'a');
          for (var u = 0; u < k; u++) pegar(p, now);
        }
        /* la CPU que pegó perfecto un tranque que ningún humano cobró se lo lleva a los 0,5 s */
        for (var j = 0; j < trq.length; j++) {
          if (cpuBest[j] && humOwner[j] < 0 && cpuAward[j] < 0 && now >= trq[j].t + CPU_DELAY && c.mio(cpuBest[j].p) && cpuBest[j].p !== c.yo) {
            var pc = cpuBest[j].p; cpuAward[j] = pc; owner[j] = pc; pts[pc] += 25; trBan[j] = 1;
            banner('¡TRANCADO POR ' + asiento(pc).name + '!', colOf(pc));
          }
        }
      },

      ai: function (p, dt, api) {
        var now = c.ahora(), sk = c.skill[p], sg = 0.12 - 0.07 * sk;
        var R = crng[p] || (crng[p] = c.rngFor('cpu' + p));
        while (aiI[p] < N && notes[aiI[p]].t - now < 0.6) {
          var q = notes[aiI[p]++];
          if (st[p][aiI[p] - 1] !== 0) continue;
          if (R.next() < 0.12 * (1 - sk)) continue;
          var e = (R.next() + R.next() + R.next() - 1.5) * 2 * sg * (q.dark ? 1.6 : 1);
          if (q.tr >= 0 && R.next() < sk) e = cl(e, -0.035, 0.035);
          plan[p].push(q.t + e);
        }
        for (var i = plan[p].length - 1; i >= 0; i--) if (plan[p][i] <= now) { plan[p].splice(i, 1); api.press('a'); }
      },

      cuerpo: function (p) { return { pts: Math.max(0, Math.round(pts[p])), combo: combo[p], cal: cal[p], nn: nn[p] }; },

      alRemoto: function (p, o) {
        rem[p] = o;
        var prev = remNN[p] == null ? o.nn : remNN[p];
        if (o.nn > prev) {                       // el rival pegó: «¡PERFECTO!» salta EN VIVO en su pista
          var now = c.ahora(), bi2 = -1, bd = 9;
          for (var i = 0; i < N; i++) { if (st[p][i] !== 0) continue; var d = Math.abs(notes[i].t - now); if (d < bd) { bd = d; bi2 = i; } if (notes[i].t > now + 0.6) break; }
          if (o.cal >= 2 && bi2 >= 0 && bd < 0.6) { st[p][bi2] = 1; hitT[p][bi2] = now; }
          ph[p] = 1; slams++; bnc = Math.min(1, bnc + 0.2);
          var lab = o.cal === 5 ? '¡DOBLE SEIS!' : o.cal === 4 ? '¡PERFECTO!' : o.cal === 3 ? '¡PLA!' : o.cal === 2 ? 'pla' : '¡PASO!';
          S(lab, laneX(p) + 40, laneY(p) - 30, o.cal >= 4 ? '#ffd23f' : o.cal === 3 ? '#fff' : '#c9c0b0');
          if (o.cal >= 4) { shake = Math.max(shake, 0.3); SPAWN(MXc(), laneY(p), 5, 'bit', ['#ffffff', '#ffe14d'], 200, 500, 0.45); }
          else if (o.cal <= 1) mood[p] = 0.6;
        }
        remNN[p] = o.nn;
        for (var i2 = 0; i2 < N; i2++) if (st[p][i2] === 0 && c.ahora() > notes[i2].t + WIN_O + 0.35) st[p][i2] = 2;
      },

      alCpu: function (p) { adoptar(p, rem[p] || null); },
      alHum: function (p, o) { adoptar(p, o); if (p === c.yo) { bnc = 0.5; } },

      claimOk: function (id, p, tMs) {
        var j = +String(id).slice(1);
        if (!(j >= 0 && j < trq.length)) return false;
        if (humOwner[j] >= 0) return false;
        return Math.abs(tMs / 1000 - trq[j].t) <= TR_WIN;
      },
      concede: function (id, p) {
        var j = +String(id).slice(1);
        if (!(j >= 0 && j < trq.length) || p < 0) return;
        if (humOwner[j] >= 0) return;
        humOwner[j] = p; trBan[j] = 1;
        if (cpuAward[j] >= 0 && cpuAward[j] !== p) { pts[cpuAward[j]] -= 25; cpuAward[j] = -1; }
        owner[j] = p;
        if (p !== c.yo) { banner('¡TRANQUE DE ' + asiento(p).name + '!', colOf(p)); abuT = 1; abuSay = '¡TRANCAOOO!'; }
      },

      scores: function () {
        var out = [];
        for (var p = 0; p < n; p++) {
          var v = c.mio(p) ? pts[p] : (rem[p] ? rem[p].pts : 0);
          out.push(Math.max(0, Math.round(v)));
        }
        return out;
      },
      done: function () { return false; },
      destacado: function () {
        var p = c.yo >= 0 ? c.yo : 0;
        return perf[p] + ' PERFECTOS · racha de ' + best[p];
      },
      vista: function () {
        return {
          n: n, lv: lv, dur: dur, N: N, hash: hash, tempo: BPM[lv - 1],
          notas: notes.map(function (q) { return [Math.round(q.t * 1000), q.gold ? 1 : 0, q.tr]; }),
          tranques: trq.map(function (q) { return Math.round(q.t * 1000); }),
          oscuro: dk0 >= 0 ? [Math.round(dk0 * 1000), Math.round(dk1 * 1000)] : null,
          pts: pts.slice(), combo: combo.slice(), nn: nn.slice(), cal: cal.slice(), owner: owner.slice(), humOwner: humOwner.slice(),
          perf: perf.slice(), best: best.slice(), rem: rem.map(function (o) { return o ? [o.pts, o.combo, o.cal, o.nn] : null; })
        };
      },

      /* ───────────── dibujo (solo primitivas del laboratorio) ───────────── */
      draw: function () {
        var now = c.ahora(), G = laneGeom(), L = G.L, R = G.R, MX = G.MX, LH = G.LH, Y0 = G.Y0, FW = LH > 80 ? 64 : 54, RR = G.RR;
        var sx = Math.sin(absT * 95) * shake * 3.5, sy = Math.cos(absT * 83) * shake * 3.5;
        var beatP = Math.max(0, 1 - (now - lastBeatT) / 0.18);
        /* fondo: bajo el mango, según el nivel */
        rr(L - 2, 0, R - L + 4, 300, 0, PL.sky, 0); rr(L - 2, 300, R - L + 4, 320, 0, PL.ground, 0);
        ell(R - 70, 60, 26, 26, PL.sun, 0);
        if (lv === 3) { ell(L + 120, 50, 3, 3, '#ffffff', 0); ell(L + 330, 30, 2.5, 2.5, '#ffffff', 0); ell(L + 520, 54, 3, 3, '#ffffff', 0); }
        rr(L + 60, 20, 40, 120, 8, PL.trunk, 3);
        ell(L + 80, 42, 150, 44, PL.leaf, 0); ell(L + 300, 54, 120, 34, PL.leaf2, 0); ell(R - 150, 50, 160, 42, PL.leaf, 0); ell(R - 360, 56, 120, 32, PL.leaf2, 0);
        var mg = [L + 40, L + 160, L + 250, R - 60, R - 190, R - 300];
        for (var m = 0; m < mg.length; m++) { line([[mg[m], 78], [mg[m], 88]], 2, '#14101c'); ell(mg[m], 96, 8, 11, '#ffb02e', 2.5); ell(mg[m] - 2, 93, 3, 4, '#ffe08a', 0); }
        /* la mesa */
        var amp = 1.5 + Math.min(5, slams / 12), by = Math.sin(absT * 60) * bnc * amp + sy;
        ctx.save(); ctx.translate(sx, by);
        rr(L + 8, Y0 - 10, RR - L - 8, LH * n + 20, 18, PL.mesa, 3.5);
        var dA = darkA(now);
        for (var p = 0; p < n; p++) {
          var y = Y0 + p * LH, cy = y + LH / 2, mine = p === c.yo, S0 = asiento(p), col = S0.color || '#fff';
          rr(L + 16, y + 3, RR - L - 24, LH - 6, 12, p % 2 ? PL.felt2 : PL.felt, mine ? 4.5 : 3);
          rr(L + 16, y + 3, 10, LH - 6, 4, col, 2.5);
          if (mine) rr(L + 16, y + 3, 16, LH - 6, 5, col, 3);
          /* personaje y marcador */
          var shown = c.mio(p) ? pts[p] : (rem[p] ? rem[p].pts : 0), cmb = c.mio(p) ? combo[p] : (rem[p] ? rem[p].combo : 0);
          var md = mood[p] > 0 ? 'yell' : (cmb >= 2 ? 'grin' : 'calm');
          var cast = (window.BUS && BUS.AP && BUS.AP.CAST && BUS.AP.CAST[S0.ch]) || FACES[p % FACES.length];
          bust(Object.assign({}, cast, { x: L + 76, y: cy + Math.min(16, LH * 0.18), s: Math.min(0.28, LH / 330), th: 24, bw: 50, look: 1, mood: md, talk: mood[p] > 0 ? 1 : 0 }));
          txt((mine ? 'TÚ' : (S0.name || 'P' + (p + 1))) + (c.cpu && c.cpu[p] && !/CPU/i.test(S0.name || '') ? ' CPU' : ''), L + 138, cy - 18, 14, col, 0, true);
          txt(String(Math.max(0, Math.round(shown))), L + 138, cy + 6, 26, '#fff', 0, true);
          if (cmb >= 3) txt('x' + cmb, L + 138, cy + 28, 13, '#ffd23f', 0, true);
          /* fichas que viajan hacia la raya */
          for (var i = 0; i < N; i++) {
            var q = notes[i];
            if (st[p][i] === 1) {
              var a = now - hitT[p][i];
              if (a >= 0 && a < 0.3) { ctx.save(); ctx.globalAlpha = 1 - a / 0.3; ficha(MX, cy + 3, FW * 1.12, q.a, q.b, 3, q.gold); ctx.restore(); }
              continue;
            }
            if (st[p][i] === 2 && now - q.t > 0.5) continue;
            var x = MX + (q.t - now) * SPD;
            if (x > RR - 24 || x < MX - 100) continue;
            if (q.dark && st[p][i] === 0) continue;
            var al = Math.min(1, (RR - 20 - x) / 70) * (x < MX - 30 ? Math.max(0, (x - (MX - 100)) / 70) : 1);
            ctx.save(); ctx.globalAlpha = Math.max(0, al) * (st[p][i] === 2 ? 0.5 : 1);
            if (q.tr >= 0) {                                   // ficha del TRANQUE: dorada, con halo 0.6 s antes
              var dtq = q.t - now;
              if (dtq <= 0.6 && dtq >= -0.1) { var pu = 1 + Math.sin(absT * 18) * 0.12; ell(x, cy, 30 * pu, 24 * pu, 'rgba(255,210,63,0.35)', 0); }
              ficha(x, cy, FW * 1.12, 6, 6, 3.5, true);
              txt('T', x, cy + 0, 16, '#7a2a14', 0, true);
            } else ficha(x, cy, FW, q.a, q.b, 3.5, q.gold);
            ctx.restore();
          }
          if (dA > 0) {
            ctx.save(); ctx.globalAlpha = dA * 0.9; rr(L + 30, y + 4, RR - L - 46, LH - 8, 10, '#0a0818', 0); ctx.restore();
            var pe = Math.max(beatP, 0); ell(MX, cy, 5 + pe * 10, 5 + pe * 10, '#ff7a2a', 0); ell(MX, cy, 2.5, 2.5, '#ffe08a', 0);
          }
          /* la raya */
          rr(MX - 3, y + 5, 6, LH - 10, 3, '#ffd23f', 2);
          /* la mano que pega */
          if (typeof hand === 'function') hand(MX + 4, cy - 30 + ph[p] * 24 - 6, Math.PI, 0.9, '#e8b48a');
        }
        ctx.restore();
        /* los tres tranques en el centro de la mesa (objeto compartido) */
        if (trq.length) {
          var tx0 = (L + RR) / 2 - 56;
          for (var j = 0; j < trq.length; j++) {
            var tx = tx0 + j * 56, own = owner[j];
            var ta = j < 3 ? 1 : 1;
            ctx.save(); ctx.globalAlpha = ta;
            if (own >= 0) { ell(tx, 80, 22, 18, colOf(own), 3); }
            ficha(tx, 80, 44, 6, 6, 3, own < 0);
            ctx.restore();
            if (own >= 0) txt(asiento(own).name ? String(asiento(own).name).slice(0, 5) : '', tx, 100, 10, colOf(own), 0, true);
          }
        }
        /* el abuelo y su piedra (columna derecha) */
        var ax = R - 56, ay = 190, jmp = Math.sin(Math.min(1, abuT) * Math.PI) * 18;
        rr(ax - 38, ay + 70, 76, 90, 14, '#8a6a4a', 3);
        var F6 = (typeof FACES !== 'undefined' && FACES[6]) || {};
        var cast = (window.BUS && BUS.AP && BUS.AP.CAST && BUS.AP.CAST.tio) || F6;
        bust(Object.assign({}, cast, { x: ax, y: ay + 74 - jmp, s: 0.36, th: 24, bw: 50, look: -1, mood: abuT > 0 ? 'yell' : (cast.mood || 'calm'), talk: abuT > 0 ? 1 : 0 }));
        if (typeof hand === 'function') hand(ax - 30, ay + 96 - jmp * 1.6, Math.PI * 0.9 + abuT * 0.4, 0.8, cast.skin || '#c98a5a');
        rr(ax - 54, ay + 122 + (abuT > 0.5 ? -jmp : 0), 30, 18, 4, '#fffdf2', 3);
        if (abuT > 0.4) txt(abuSay || '¡TRANCAOOO!', ax - 10, ay + 36, 15, '#ffe14d', 0, true);
        /* franja de abajo: consigna / aviso / perro dormilón */
        var dy = -Math.sin((1 - dogJ) * Math.PI) * (dogJ > 0 ? 30 : 0);
        ell(L + 66, 520, 36, 6, 'rgba(0,0,0,.25)', 0);
        ell(L + 60, 508 + dy, 30, 13, '#b98a5a', 3); ell(L + 90, 502 + dy, 13, 11, '#c99a6a', 3); ell(L + 98, 496 + dy, 5, 9, '#8a5a32', 2.5);
        line([[L + 88, 501], [L + 95, 501]], 2, '#14101c'); txt('z', L + 112, 490, 14, '#cfe2ff', 0, true);
        if (banT > 0 && ban) { var pz = 1 + Math.sin(absT * 16) * 0.06; txt(ban.s, (L + RR) / 2, 480, 22 * pz, ban.col, 0, true); }
        else if (now < 4) txt('PEGA CUANDO LA FICHA LLEGUE A LA RAYA', (L + RR) / 2, 480, 20, '#fff', 0, true);
        if (typeof drawP === 'function') drawP();
      }
    };
    function darkA(now) {
      if (dk0 < 0) return 0;
      if (now < dk0 - 0.6 || now > dk1 + 0.5) return 0;
      return now < dk0 - 0.2 ? (now - (dk0 - 0.6)) / 0.4 : now > dk1 + 0.1 ? 1 - (now - dk1 - 0.1) / 0.4 : 1;
    }
    return g;
  }
});
})();
