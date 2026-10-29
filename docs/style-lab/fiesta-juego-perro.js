'use strict';
/* LA FIESTA · EN VIVO · f_perro · ¡PERRO CALIENTE CON TODO!  (FFA, rank, modelo A: cancha propia)
   El carrito de perros en la noche. Llegan clientes (la misma fila para todos, sembrada con c.rng en mk) y cada uno pide su perro: los ingredientes
   EN ORDEN, que se ven en la COMANDA de arriba como los mismos potes del mesón (mismo color, mismo nombre).
   Mesón de 6 potes en 2 filas de 3: el STICK apunta al pote (arriba = fila de atrás, abajo/lados = fila de adelante; queda elegido aunque suelte), A lo echa.
   Ingrediente equivocado = perro arruinado: se bota solo (0,6 s) y hay que empezar ese perro otra vez (+1 error). B = «¡CHU!» espanta al perrito callejero
   (y bota ya el perro arruinado).
   Cada cliente tiene paciencia: si tardas mucho se va bravo (pierdes ese perro). Puntos = ingredientes × valor de la fase (×2 si es VIP), normalizados
   para que el total posible nunca pase de 940.
   ESCALADA por c.ahora()/dur: CALMA (<35 %) · ¡HORA PICO! (<70 %: más clientes, perros más largos, VIP) · ¡ÚLTIMOS SEGUNDOS! (clientes cada 1,5 s,
   valen más, música más rápida, bombillos a millón).
   EVENTOS en la calle (sembrados en mk, iguales en todas las pantallas, con aviso): EL PERRITO (aviso 1,2 s: si no das B a tiempo se roba la salchicha),
   VENTARRÓN (aviso 1 s: dos potes se cambian de sitio), APAGÓN (aviso 1 s: solo se ve el pote al que apuntas). Niveles: 1/2/3 = perros más largos,
   más VIP y en 2/3 el cliente cambia de idea a mitad («¡SIN CEBOLLA!»).
   Puntaje (entero, rank) = pts. Cuerpo en red (o): ord (cliente de turno), paso, err, pts, srv, mal, cam.
   Sin Math.random/Date.now: el azar sale de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético de c.fx(). Se carga DESPUÉS de fiesta-live.js. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_perro')) return;

var LENS = [[3, 3, 4, 4], [3, 4, 5, 5], [4, 5, 6, 6]];          // ingredientes por perro [nivel][fase]
var GAP = [3.0, 2.2, 1.5, 1.15], PAC = [11, 9, 7, 6], VAL = [5, 8, 12, 14], LVK = [1, 1.1, 1.25];
var FZ1 = 0.32, FZ2 = 0.66, FZ3 = 0.85, DEADZ = 0.3, MAXC = 70, TOPE = 940;
var AV_V = 1.0, AV_L = 1.0, AV_P = 1.2, MAL_T = 0.6, ROBO_T = 0.9;
var INKC = '#14101c';
var ING = [
  { n: 'REPOLLO', col: '#38c23a', tx: '#08240a' }, { n: 'PAPITAS', col: '#ffe600', tx: '#3a2a00' }, { n: 'AJO', col: '#ffffff', tx: '#2a2438' },
  { n: 'ROSADA', col: '#ff3f93', tx: '#3a0a1c' }, { n: 'QUESO', col: '#ff7a00', tx: '#3a1400' }, { n: 'CEBOLLA', col: '#8a3fe0', tx: '#fffdf2' }
];
/* casilla del mesón -> dirección del stick (col = s % 3, fila = s / 3: 0 = atrás/arriba, 1 = adelante/abajo) */
var DIR = [[-0.7, -0.7], [0, -1], [0.7, -0.7], [-0.7, 0.7], [0, 1], [0.7, 0.7]];
var FASES = [{ n: 'CALMA', col: '#fffdf2' }, { n: '¡HORA PICO!', col: '#ffb030' }, { n: '¡ÚLTIMOS SEGUNDOS!', col: '#ff4a4a' }];
var PAL = [
  { sky: '#8fd8ff', ground: '#a9855a', panel: '#3b2f4a', luz: 0 },
  { sky: '#ff9a5a', ground: '#7d5f43', panel: '#2f2540', luz: 0 },
  { sky: '#0f1530', ground: '#3d3a4f', panel: '#1d1a33', luz: 1 }
];
/* lo que grita cada cliente al pedir (según el largo del pedido; el «completo» siempre es ¡PERRO CON TODO!) */
var FR_TODO = ['¡PERRO CON TODO!', '¡PERRO CON TODO!', '¡CON TODO, MI PANA!', '¡PERRO CON TODO, CHAMO!', '¡CON TODO TODO, VALE!'];
var FR_SIMPLE = ['¡UN PERRO, CHAMO!', '¡ÉCHALE CARIÑO!', '¡SIN PENA, PERRERO!', '¡DALE, QUE VOY TARDE!', '¡UN PERRITO, COMPAI!', '¡A LA ORDEN, MI REY!', '¡QUE EL BUS SALE YA!', '¡PERRERO, UNO CARGADO!'];
var FR_VIP = ['¡SOY VIP, MI REY!', '¡ATIÉNDEME A MÍ, PERRERO!'], FR_PRISA = ['¡RÁPIDO, QUE VOY TARDE!', '¡APÚRATE, PERRERO!'];
var CUST = ['tio', 'abuela', 'pana', 'mama', 'portu'];

function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function slotDe(e) {                                     // stick -> casilla 0..5 (rejilla 3x2; las 8 direcciones del teclado alcanzan las 6)
  var col = e.x < -0.38 ? 0 : e.x > 0.38 ? 2 : 1, fila = e.y < -0.38 ? 0 : 1;
  return fila * 3 + col;
}

FIESTA.LIVE.add('f_perro', {
  name: '¡PERRO CALIENTE CON TODO!', modos: ['ffa'], clase: 'rank', modelo: 'A', dur: 35,
  stick: true, botones: 2, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 950, scoreRate: 200, minT: 4, finTemprano: 1 },
  cuerpo: ['ord', 'paso', 'err', 'pts', 'srv', 'mal', 'cam'], discretos: ['ord', 'paso', 'err', 'pts', 'srv', 'mal', 'cam'],
  carta: {
    obj: 'Atiende a los clientes: arma cada perro con los ingredientes EN EL ORDEN de la comanda antes de que se cansen.',
    gana: 'Más puntos. Los perros de la hora pico y de los últimos segundos valen más; el VIP vale doble.',
    como: { tactil: 'Stick apunta al pote · A lo echa · B ¡CHU! espanta al perrito', teclado: 'WASD o flechas apuntan · ESPACIO echa · SHIFT ¡CHU! al perrito' },
    roles: null,
    demos: [
      { id: 'elegir', txt: 'La comanda de arriba dice qué va y en qué orden: apunta a ese pote y dale A' },
      { id: 'error', txt: 'Si echas el equivocado el perro se bota solo: empieza otra vez rapidito' },
      { id: 'cambio', txt: 'Cuando ladre el perrito dale B o se roba la salchicha. Ojo con el ventarrón y el apagón' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = cl(c.lv || 1, 1, 3), dur = c.dur, rng = c.rng, PL = PAL[lv - 1], i, p, k;
    function faseDe(t) { var f = t / Math.max(1, dur); return f < FZ1 ? 0 : f < FZ2 ? 1 : 2; }
    function faseJ(t) { return t / Math.max(1, dur) >= FZ3 ? 3 : faseDe(t); }      // 4 fases de juego (la 4.ª = LOCURA TOTAL, dentro de la 3.ª visual)
    /* ───── el mundo (idéntico en todos: SOLO de c.rng, solo aquí) ───── */
    var lay = rng.shuffle([0, 1, 2, 3, 4, 5]);          // casilla -> ingrediente (el ventarrón cambia dos de sitio)
    /* eventos de la calle (se reparten por casillas de tiempo: más duración = más eventos; antes de 2 s no hay) */
    var EV = [], lastK = '';
    function evento(kk, te, hur) {
      te = Math.round(te * 100) / 100;
      var e = { k: kk, t: te, d: 0, a: -1, b: -1, a2: -1, b2: -1 };
      if (kk === 'viento') {
        if (hur) { var pm = rng.shuffle([0, 1, 2, 3, 4, 5]); e.a = pm[0]; e.b = pm[1]; e.a2 = pm[2]; e.b2 = pm[3]; }
        else { e.a = rng.int(0, 5); e.b = (e.a + rng.int(1, 5)) % 6; }
      }
      if (kk === 'luz') e.d = Math.round(cl(dur * 0.075, 1.5, 3) * 100) / 100;
      if (kk === 'espejo') e.d = Math.round(cl(dur * 0.09, 3, 5) * 100) / 100;
      if (kk === 'bus') e.d = Math.round(cl(dur * 0.1, 3.5, 5) * 100) / 100;
      if (te >= 2 && te < dur - 1.5) EV.push(e);
    }
    var nSl = Math.max(5, Math.round(dur / 5.0) + (lv >= 3 ? 1 : 0));
    for (i = 0; i < nSl; i++) {
      var fe = 0.12 + 0.8 * (i + 0.15 + 0.7 * rng.next()) / nSl, pool;
      if (fe < FZ1) pool = lv === 1 ? ['perro', 'viento', 'perro'] : ['perro', 'viento', 'espejo'];
      else if (fe < FZ2) pool = ['perro', 'viento', 'luz', 'bus', lv > 1 ? 'espejo' : 'luz'];
      else pool = ['perro', 'viento', 'luz', 'bus', 'espejo', 'huracan', 'perro'];
      var kz = pool[rng.int(0, pool.length - 1)], tries = 0;
      while (kz === lastK && tries++ < 5) kz = pool[rng.int(0, pool.length - 1)];
      if (i % 3 === 1) kz = 'perro';
      lastK = kz;
      if (kz === 'huracan') evento('viento', dur * fe, 1); else evento(kz, dur * fe, 0);
    }
    EV.sort(function (a, b) { return a.t - b.t; });
    var PER = EV.filter(function (e) { return e.k === 'perro'; });
    function enBus(tt) { for (var e = 0; e < EV.length; e++) if (EV[e].k === 'bus' && tt >= EV[e].t && tt < EV[e].t + EV[e].d) return true; return false; }
    var CRT = lv === 1 ? [0.55, 0.9] : lv === 2 ? [0.4, 0.72, 0.92] : [0.3, 0.55, 0.78, 0.93];
    var CL = [], t = 0, crtI = 0;
    while (CL.length < MAXC) {
      var fz = faseJ(t), L = LENS[lv - 1][fz], sh = rng.shuffle([0, 1, 2, 3, 4, 5]), bus = enBus(t) ? 1 : 0, crit = 0;
      if (crtI < CRT.length && CL.length >= 3 && t >= dur * CRT[crtI] && t < dur - 6) { crit = 1; crtI++; L = Math.min(6, L + 1 + (lv > 1 ? 1 : 0)); }
      var q = { t: Math.round(t * 100) / 100, seq: sh.slice(0, L), cp: -1, drop: -1, seq2: null, vip: 0, imp: 0, fase: fz, pac: 0, val: 0, ch: 0, crit: crit, bus: bus };
      q.vip = crit ? 1 : CL.length >= 2 && rng.next() < [0, 0.15, 0.22, 0.25][fz] ? 1 : 0;
      var pCam = lv === 3 ? (fz ? 0.3 : 0.12) : lv === 2 ? (fz >= 2 ? 0.2 : 0) : (fz === 3 ? 0.15 : 0);
      if (L >= 3 && rng.next() < pCam) {
        q.cp = rng.int(1, L - 2); q.drop = rng.int(q.cp + 1, L - 1);
        q.seq2 = q.seq.filter(function (z, ix) { return ix !== q.drop; });
      }
      q.imp = !q.vip && CL.length >= 2 && (bus || rng.next() < [0, 0.2, 0.35, 0.4][fz]) ? 1 : 0;        // impaciente: con prisa, paga +50 %
      q.pac = Math.round(PAC[fz] * LVK[lv - 1] * (crit ? 1.35 : q.vip ? 0.75 : 1) * (q.imp ? 0.7 : 1) * 100) / 100;
      q.val = Math.round(L * VAL[fz] * (crit ? 3 : q.vip ? 2 : q.imp ? 1.5 : 1));
      q.ch = rng.int(0, CUST.length - 1);
      CL.push(q);
      t += CL.length === 1 ? 1.2 : GAP[fz] * LVK[lv - 1] * (0.85 + 0.3 * rng.next()) * (bus ? 0.62 : 1);
      if (t > dur - 2) break;
    }
    /* HUEVO DE PASCUA: de vez en cuando un cliente pide el perro más simple del mundo, solo PAPITAS y salsas (AJO, ROSADA): se le escapa un «¡AY, VALE!» */
    var eg = c.rngFor ? c.rngFor('huevo') : null;
    if (eg && eg.next() < 0.25) {
      var cand = []; for (i = 3; i < CL.length - 2; i++) if (!CL[i].vip && !CL[i].imp && CL[i].cp < 0 && !CL[i].bus) cand.push(i);
      if (cand.length) {
        var ge = CL[cand[eg.int(0, cand.length - 1)]];
        ge.seq = eg.shuffle([1, 2, 3]); ge.huevo = 1; ge.val = Math.round(3 * VAL[ge.fase]);
      }
    }
    var NC = CL.length, tot = 0;
    for (i = 0; i < NC; i++) tot += CL[i].val;
    if (tot > TOPE) for (i = 0; i < NC; i++) CL[i].val = Math.max(1, Math.floor(CL[i].val * TOPE / tot));
    var hash = 7;
    function mezcla(v) { hash = (Math.imul(hash ^ (v | 0), 16777619)) >>> 0; }
    for (i = 0; i < NC; i++) { var qq = CL[i]; for (var j = 0; j < qq.seq.length; j++) mezcla((qq.seq[j] + 1) ^ (j << 4)); mezcla(Math.round(qq.t * 100)); mezcla(qq.cp + 3 + ((qq.drop + 3) << 3) + (qq.vip << 7) + (qq.imp << 8)); mezcla(qq.val); mezcla(qq.crit + (qq.bus << 1)); }
    for (i = 0; i < 6; i++) mezcla((lay[i] + 1) ^ (i << 5));
    for (i = 0; i < EV.length; i++) mezcla(Math.round(EV[i].t * 100) ^ (EV[i].k.length << 12) ^ ((EV[i].a + 2) << 16) ^ ((EV[i].a2 + 2) << 20) ^ Math.round(EV[i].d * 10));

    /* ───── estado por asiento (mío o de un rival: el de los rivales se copia de su cuerpo) ───── */
    var ord = [], paso = [], err = [], pts = [], srv = [], mal = [], cam = [], sel = [], bad = [], malT = [], bT = [], perIx = [], perRes = [];
    var pop = [], okT = [], badT = [], cpuT = [], cpuP = [], cpuPT = [], crng = [], idoT = [], srvLog = [];
    for (p = 0; p < n; p++) {
      ord[p] = 0; paso[p] = 0; err[p] = 0; pts[p] = 0; srv[p] = 0; mal[p] = 0; cam[p] = 0; sel[p] = -1; bad[p] = -1; malT[p] = 0; bT[p] = -99; perIx[p] = 0; perRes[p] = [];
      pop[p] = 0; okT[p] = 0; badT[p] = 0; cpuT[p] = -1; cpuP[p] = -1; cpuPT[p] = 1e9; crng[p] = null; idoT[p] = -9; srvLog[p] = [];
    }
    var critV = {}, locuraV = 0, ayudaT = 0, absT = 0, big = null, bigT = 0, chico = null, chicoT = 0, shake = 0, hintT = 0, hintS = '', faseV = -1, evV = [], popPts = null, popPtsT = 0;
    for (i = 0; i < EV.length; i++) evV.push(0);
    function asiento(q2) { return (c.seats && c.seats[q2]) || { name: 'P' + (q2 + 1), color: '#fff', ch: null }; }
    function colOf(q2) { return asiento(q2).color || '#fff'; }
    function me() { return c.yo >= 0 ? c.yo : 0; }
    function cli(o) { return CL[cl(o, 0, NC - 1)]; }
    function fraseDe(i) {                                   // lo que grita el cliente i (cosmético, igual en todas las pantallas)
      var q2 = cli(i), L2 = q2.seq.length, h = (i * 7 + q2.ch * 3 + 1) >>> 0;
      if (q2.huevo) return '¡AY, VALE!';
      if (q2.crit) return '¡SOY CRÍTICO DE PERROS!';
      if (L2 >= 4) return FR_TODO[h % FR_TODO.length];      // «¡PERRO CON TODO!» solo con 4 o más ingredientes
      if (q2.vip) return FR_VIP[h % FR_VIP.length];
      if (q2.imp) return FR_PRISA[h % FR_PRISA.length];
      return FR_SIMPLE[h % FR_SIMPLE.length];
    }
    function seqOf(o, cm) { var q2 = cli(o); return cm && q2.seq2 ? q2.seq2 : q2.seq; }
    function casillaDe(ing) { return lay.indexOf(ing); }
    function avisa(s, col, d) { big = { s: s, col: col, t0: absT }; bigT = d || 1.6; }
    function dice(s, col) { chico = { s: s, col: col }; chicoT = 1.3; }
    function layoutP() {
      var f = c.campo();
      if (typeof GAME_VIEW !== 'undefined' && GAME_VIEW && GAME_VIEW.width > 0) f = { x0: -(GAME_VIEW.offsetX || 0), x1: -(GAME_VIEW.offsetX || 0) + GAME_VIEW.width };
      return { x0: f.x0, x1: f.x1, w: f.x1 - f.x0, cx: (f.x0 + f.x1) / 2 };
    }
    function luzFuera(now) { for (var e = 0; e < EV.length; e++) if (EV[e].k === 'luz' && now >= EV[e].t && now < EV[e].t + EV[e].d) return true; return false; }
    function espejoOn(now) { for (var e = 0; e < EV.length; e++) if (EV[e].k === 'espejo' && now >= EV[e].t && now < EV[e].t + EV[e].d) return true; return false; }
    function perroAviso(now) { for (var e = 0; e < PER.length; e++) if (now >= PER[e].t - AV_P && now < PER[e].t) return e; return -1; }
    function llegado(o, now) { return o < NC && CL[o].t <= now; }
    function paciencia(o, now) { if (o >= NC) return 0; var q2 = CL[o]; return cl(1 - (now - q2.t) / q2.pac, 0, 1); }
    /* el viento: se aplica en TODAS las pantallas a la misma hora (c.ahora sincronizado) antes de leer los botones */
    function aplicaEventos(now) {
      for (var e = 0; e < EV.length; e++) {
        var ev = EV[e];
        if (ev.k === 'viento' && !ev.hecho && now >= ev.t) { ev.hecho = 1; var z = lay[ev.a]; lay[ev.a] = lay[ev.b]; lay[ev.b] = z; if (ev.a2 >= 0) { z = lay[ev.a2]; lay[ev.a2] = lay[ev.b2]; lay[ev.b2] = z; } ev.hT = absT; }
      }
    }

    /* ───── reglas (solo mi asiento: p con mio(p)) ───── */
    function agrega(q2, now) {
      if (ord[q2] >= NC) return;
      if (mal[q2]) { badT[q2] = 0.25; return; }
      if (!llegado(ord[q2], now)) { if (q2 === c.yo) { hintT = 1.1; hintS = '¡ESPERA AL CLIENTE!'; } return; }
      var s = sel[q2];
      if (s < 0) { if (q2 === c.yo) { hintT = 1.2; hintS = 'APUNTA AL POTE CON EL STICK'; } return; }
      var ing = lay[s], o = cli(ord[q2]), sq = seqOf(ord[q2], cam[q2]);
      if (ing === sq[paso[q2]]) {
        paso[q2]++; pop[q2] = 1; okT[q2] = 0.25;
        SND(520 + paso[q2] * 70, 0.05, 'square', 0.05, 80);
        if (paso[q2] >= sq.length) {
          pts[q2] += o.val; srv[q2]++; srvLog[q2].push(ord[q2]);
          ord[q2]++; paso[q2] = 0; mal[q2] = 0; cam[q2] = 0; bad[q2] = -1;
          if (q2 === c.yo) { popPts = { s: '+' + o.val + (o.crit ? ' CRÍTICO' : o.vip ? ' VIP' : ''), col: o.vip ? '#ffd23f' : '#5cff7a' }; popPtsT = 1.1; SND(900, 0.12, 'square', 0.06, 300); }
        } else if (o.seq2 && !cam[q2] && paso[q2] === o.cp) {
          cam[q2] = 1; cpuT[q2] = Math.max(cpuT[q2], now + 0.6);
          if (q2 === c.yo) { avisa('¡SIN ' + ING[o.seq[o.drop]].n + '!', '#ff5c5c', 1.3); shake = 0.6; SND(180, 0.25, 'sawtooth', 0.07, -60); }
        }
      } else {
        err[q2]++; mal[q2] = 1; bad[q2] = ing; badT[q2] = 0.5; malT[q2] = now + MAL_T; shake = Math.max(shake, 0.3);
        SND(120, 0.14, 'square', 0.06, -40);
        if (q2 === c.yo) { dice('¡ESE NO! ERA ' + ING[sq[paso[q2]]].n, '#ff8a8a'); ayudaT = 2.2; }
      }
    }
    function chu(q2, now) {                                // B: ¡CHU! al perrito; si el perro está arruinado, lo bota ya
      bT[q2] = now;
      if (mal[q2] && bad[q2] >= 0) { mal[q2] = 0; paso[q2] = 0; bad[q2] = -1; SND(260, 0.08, 'triangle', 0.05, -80); }
    }
    function reglasTiempo(q2, now) {
      if (mal[q2] && now >= malT[q2]) { mal[q2] = 0; paso[q2] = 0; bad[q2] = -1; }
      while (perIx[q2] < PER.length && now >= PER[perIx[q2]].t) {
        var ev = PER[perIx[q2]], ok = bT[q2] >= ev.t - AV_P - 0.05;
        perRes[q2][perIx[q2]] = ok ? 1 : 2;
        if (!ok && ord[q2] < NC) { paso[q2] = 0; mal[q2] = 1; bad[q2] = -2; malT[q2] = now + ROBO_T; }
        if (q2 === c.yo) { if (ok) dice('¡CHU! SE FUE EL PERRITO', '#5cff7a'); else { avisa('¡SE ROBÓ LA SALCHICHA!', '#ff5c5c', 1.3); shake = 0.7; } }
        perIx[q2]++;
      }
      while (ord[q2] < NC && now > CL[ord[q2]].t + CL[ord[q2]].pac) {      // se cansó y se fue
        ord[q2]++; paso[q2] = 0; cam[q2] = 0; if (bad[q2] >= 0) { mal[q2] = 0; bad[q2] = -1; }
        idoT[q2] = absT;
        if (q2 === c.yo) { dice('¡SE FUE BRAVO! MUY LENTO', '#ff8a8a'); SND(150, 0.3, 'sawtooth', 0.06, -50); }
      }
    }
    function adopta(q2, o) {                              // copia el cuerpo de un rival (o de mi asiento si el juez lo lleva)
      if (!o) return;
      if ((o.err | 0) > err[q2]) { badT[q2] = 0.5; }
      if ((o.srv | 0) > srv[q2] || (o.paso | 0) > paso[q2]) { pop[q2] = 1; okT[q2] = 0.25; }
      ord[q2] = cl(o.ord | 0, 0, NC); paso[q2] = Math.max(0, o.paso | 0); err[q2] = Math.max(0, o.err | 0); pts[q2] = Math.max(0, o.pts | 0); srv[q2] = Math.max(0, o.srv | 0);
      mal[q2] = o.mal ? 1 : 0; cam[q2] = o.cam ? 1 : 0;
    }
    /* avisos de fase y de eventos (cosméticos: cada pantalla los dice a su hora) */
    function anuncios(now) {
      if (now < 0 || now > dur) return;
      var fz2 = faseDe(now);
      if (fz2 !== faseV) {
        if (faseV >= 0 && fz2 > faseV) { avisa(FASES[fz2].n, FASES[fz2].col, 1.8); shake = Math.max(shake, 0.6); if (v3) { v3.esc.sacudir(fz2 === 2 ? 1 : 0.6); V3.sfx(fz2 === 2 ? 'bocina' : 'silbato'); } }
        faseV = fz2;
      }
      if (!locuraV && faseJ(now) === 3) { locuraV = 1; avisa('¡LOCURA TOTAL! ¡TODO VALE MÁS!', '#ff2f9a', 1.8); shake = Math.max(shake, 0.8); if (v3) { v3.esc.sacudir(1); V3.sfx('bocina'); } }
      for (var ci = 0; ci < NC; ci++) if (CL[ci].crit && !critV[ci] && now >= CL[ci].t) { critV[ci] = 1; avisa('¡LLEGÓ EL CRÍTICO! PEDIDO GRANDE ×3', '#ffd23f', 1.7); if (v3) V3.sfx('silbido'); }
      for (var e = 0; e < EV.length; e++) {
        var ev = EV[e], av = ev.k === 'perro' ? AV_P : ev.k === 'viento' ? AV_V : ev.k === 'luz' ? AV_L : 1;
        if (evV[e] === 0 && now >= ev.t - av) {
          evV[e] = 1;
          if (ev.k === 'perro') { if (!v3) avisa('¡GUAU! ¡DALE B!', '#ffd23f', av); if (v3) V3.sfx('silbido'); }
          else if (ev.k === 'viento') { avisa(ev.a2 >= 0 ? '¡VIENE UN HURACÁN! ¡CUATRO POTES!' : '¡VIENE UN VENTARRÓN!', '#8fd8ff', av); if (v3) V3.sfx('viento'); }
          else if (ev.k === 'espejo') { avisa('¡CUIDADO! SE VA A MAREAR…', '#ff8ad0', av); if (v3) V3.sfx('silbido'); }
          else if (ev.k === 'bus') { avisa('¡VIENE UN BUS LLENO!', '#ffb030', av); if (v3) V3.sfx('silbido'); }
          else { avisa('LA LUZ ESTÁ FALLANDO…', '#ffd23f', av); if (v3) V3.sfx('chispa'); }
        }
        if (evV[e] === 1 && now >= ev.t) {
          evV[e] = 2;
          if (ev.k === 'espejo') { avisa('¡MAREO! EL STICK VA AL REVÉS', '#ff8ad0', 1.5); shake = 0.6; if (v3) { V3.sfx('trueno'); v3.esc.sacudir(0.6); } }
          else if (ev.k === 'bus') { avisa('¡LLEGÓ EL BUS! ¡TODOS CON PRISA!', '#ffb030', 1.5); shake = 0.5; if (v3) { V3.sfx('bocina'); v3.esc.sacudir(0.6); } }
          else if (ev.k === 'viento') { avisa(ev.a2 >= 0 ? '¡HURACÁN! ¡SE REVOLVIERON 4 POTES!' : '¡SE CAMBIARON ' + ING[lay[ev.b]].n + ' Y ' + ING[lay[ev.a]].n + '!', '#8fd8ff', 1.5); shake = 0.5; if (v3) { V3.sfx('whoosh'); v3.esc.sacudir(0.6); } }
          else if (ev.k === 'luz') { avisa('¡APAGÓN! APUNTA PARA VER', '#ffd23f', 1.4); if (v3) { V3.sfx('trueno'); v3.esc.sacudir(0.5); } }
          else if (v3) V3.sfx(perRes[me()][PER.indexOf(ev)] === 2 ? 'error' : 'golpe');
        }
        if (ev.k === 'espejo' && evV[e] === 2 && now >= ev.t + ev.d) { evV[e] = 3; dice('¡YA PASÓ EL MAREO!', '#ff8ad0'); if (v3) V3.sfx('ding'); }
        if (ev.k === 'luz' && evV[e] === 2 && now >= ev.t + ev.d) { evV[e] = 3; dice('¡VOLVIÓ LA LUZ!', '#ffe14d'); if (v3) V3.sfx('ding'); }
      }
    }

    /* ───── 2D de respaldo (sin WebGL o ?plano=1): solo primitivas del laboratorio ───── */
    function chip(k, x, y, w, h, grande, apagado) {
      var I = ING[k];
      rr(x - w / 2, y - h / 2, w, h, h / 2.4, apagado ? '#2a2638' : I.col, grande ? 3.5 : 2);
      if (!apagado) txt(I.n, x, y + 1, grande ? 13 : Math.min(11, w / 6.2), I.tx, 0, true);
    }
    function rivales2D(L, y) {
      var m = me(), riv = [], k2, pq;
      for (pq = 0; pq < n; pq++) if (pq !== m) riv.push(pq);
      if (!riv.length) return;
      var bw = Math.min(150, (L.w - 16 - (riv.length - 1) * 6) / riv.length), bx0 = L.cx - (bw * riv.length + 6 * (riv.length - 1)) / 2;
      for (k2 = 0; k2 < riv.length; k2++) {
        var r = riv[k2], bx = bx0 + k2 * (bw + 6), sq = seqOf(ord[r], cam[r]), dd;
        rr(bx, y, bw, 30, 8, 'rgba(20,16,28,.72)', 2); rr(bx, y, 5, 30, 3, colOf(r), 0);
        txt(String(asiento(r).name || 'P' + (r + 1)).slice(0, 8), bx + 8 + (bw - 12) * 0.32, y + 10, 10, colOf(r), 0, true);
        txt(pts[r] + ' pts', bx + bw - 8 - (bw - 12) * 0.22, y + 10, 10, '#fffdf2', 0, true);
        for (dd = 0; dd < sq.length && ord[r] < NC; dd++) ell(bx + 12 + dd * Math.min(12, (bw - 20) / 6), y + 22, 4, 4, dd < paso[r] ? ING[sq[dd]].col : '#4a4458', 1);
        if (mal[r]) txt('✕', bx + bw - 14, y + 22, 11, '#ff5c5c', 0, true);
        else txt(srv[r] + ' perros', bx + bw - 8 - (bw - 12) * 0.22, y + 22, 9, '#cfc6e0', 0, true);
      }
    }
    function dibujar2D() {
      var now = c.ahora(), L = layoutP(), x0 = L.x0, w = L.w, cx = L.cx, m = me(), i, oscuro = luzFuera(now);
      var sx = Math.sin(absT * 95) * shake * 3, sy = Math.cos(absT * 83) * shake * 3;
      rr(x0 - 2, 0, w + 4, 330, 0, oscuro ? '#05060c' : PL.sky, 0); rr(x0 - 2, 330, w + 4, 280, 0, oscuro ? '#0c0a12' : PL.ground, 0);
      ctx.save(); ctx.translate(sx, sy);
      rivales2D(L, 74);
      /* la comanda */
      var o = ord[m], hay = o < NC, cu = hay ? CL[o] : null, sq = hay ? seqOf(o, cam[m]) : [], bw2 = Math.min(w - 12, 460);
      rr(cx - bw2 / 2, 110, bw2, 74, 10, '#fffdf2', 3); rr(cx - bw2 / 2, 110, bw2, 16, 6, '#d9382f', 0);
      txt(hay ? 'PEDIDO · CLIENTE ' + (o + 1) + (cu.crit ? ' · CRÍTICO ×3' : cu.vip ? ' · VIP ×2' : cu.imp ? ' · ¡CON PRISA!' : '') : 'SIN MÁS CLIENTES', cx, 119, 10, '#fffdf2', 0, true);
      if (hay && llegado(o, now)) {
        var cw = Math.min(74, (bw2 - 12) / Math.max(1, sq.length)), rx0 = cx - cw * sq.length / 2;
        for (i = 0; i < sq.length; i++) {
          var ix = rx0 + cw * (i + 0.5), iy = 150, act = i === paso[m] && !mal[m];
          ctx.save(); if (i < paso[m]) ctx.globalAlpha = 0.4;
          chip(sq[i], ix, iy, cw - 6, act ? 30 : 24, act, false); ctx.restore();
          txt(String(i + 1), ix, 133, 9, act ? '#d9382f' : '#8a8090', 0, true);
          if (i < paso[m]) line([[ix - 7, iy + 1], [ix - 2, iy + 7], [ix + 9, iy - 7]], 3.5, '#2a8a3a');
        }
        var pc = paciencia(o, now);
        rr(cx - bw2 / 2 + 8, 172, (bw2 - 16), 6, 3, '#d8d0c0', 0); rr(cx - bw2 / 2 + 8, 172, (bw2 - 16) * pc, 6, 3, pc > 0.5 ? '#3ac46a' : pc > 0.25 ? '#ffb030' : '#ff4a4a', 0);
        if (now - cu.t < 3) txt(fraseDe(o), cx, 198, cu.huevo ? 17 : 13, cu.huevo ? '#ff5c9a' : '#fffdf2', 0, true);
      } else if (hay) txt('¡YA VIENE EL CLIENTE!', cx, 152, 14, INKC, 0, true);
      /* el perro */
      var dy = 222, ds = 0.7 * (1 + pop[m] * 0.08);
      rr(cx - 50 * ds, dy - 4 * ds, 100 * ds, 30 * ds, 14 * ds, '#d9984a', 3);
      if (bad[m] !== -2) rr(cx - 46 * ds, dy - 12 * ds, 92 * ds, 17 * ds, 8 * ds, '#c4452f', 3);
      for (i = 0; i < paso[m] && i < sq.length; i++) { var px = sq.length > 1 ? cx - 34 * ds + i * 68 * ds / (sq.length - 1) : cx; ell(px, dy - 14 * ds - (i % 2) * 3 * ds, 11 * ds, 6.5 * ds, ING[sq[i]].col, 2); }
      if (mal[m] && bad[m] >= 0) { ell(cx, dy - 18 * ds, 13 * ds, 8 * ds, ING[bad[m]].col, 2); line([[cx - 12, dy - 26], [cx + 12, dy - 8]], 3.4, '#e0222e'); line([[cx + 12, dy - 26], [cx - 12, dy - 8]], 3.4, '#e0222e'); }
      rr(cx - 50 * ds, dy + 6 * ds, 100 * ds, 20 * ds, 10 * ds, '#f0b868', 3);
      /* el mesón: 2 filas de 3 potes, como el stick */
      var mw = Math.min(w - 12, 440), gx = Math.min(130, mw / 3.2);
      rr(cx - mw / 2, 262, mw, 190, 14, oscuro ? '#0e0c18' : PL.panel, 3);
      var objetivo = hay && llegado(o, now) && !mal[m] && ((lv === 1 && faseDe(now) === 0) || ayudaT > 0) ? casillaDe(sq[paso[m]]) : -1;
      for (i = 0; i < 6; i++) {
        var bx = cx + ((i % 3) - 1) * gx, by = i < 3 ? 312 : 400, on = sel[m] === i, kk = lay[i], ver = !oscuro || on;
        if (objetivo === i) ell(bx, by, 40 + Math.sin(absT * 8) * 3, 40 + Math.sin(absT * 8) * 3, 'rgba(255,255,255,.25)', 0);
        if (on) ell(bx, by, 38, 38, '#ffe14d', 0);
        ell(bx, by, 31, 31, ver ? ING[kk].col : '#1c1828', 3);
        if (ver) txt(ING[kk].n, bx, by + 1, 11, ING[kk].tx, 0, true);
        else txt('?', bx, by + 1, 16, '#4a4458', 0, true);
      }
      ctx.restore();
      var ay = 458;
      if (perroAviso(now) >= 0) txt('¡EL PERRITO! ¡DALE B!', cx, ay, 14, '#ffd23f', 0, true);
      else if (hintT > 0) txt(hintS, cx, ay, 12, '#ffe14d', 0, true);
      else if (mal[m]) txt(bad[m] === -2 ? 'SE LLEVÓ LA SALCHICHA…' : '¡ESE NO! SE BOTA SOLO…', cx, ay, 12, '#ff8a8a', 0, true);
      else if (now < 4) txt('APUNTA AL POTE DE LA COMANDA · A LO ECHA', cx, ay, 11, '#fffdf2', 0, true);
      if (chicoT > 0 && chico) txt(chico.s, cx, 252, 12, chico.col, 0, true);
      if (popPtsT > 0 && popPts) txt(popPts.s, cx + 70, 205 - (1.1 - popPtsT) * 20, 16, popPts.col, 0, true);
      txt(pts[m] + ' pts · ' + (faseJ(Math.max(0, now)) === 3 ? '¡LOCURA!' : FASES[cl(faseDe(Math.max(0, now)), 0, 2)].n), cx, 102, 10, '#fffdf2', 0, true);
      if (bigT > 0 && big) { var pz = 1 + Math.sin(absT * 18) * 0.05; txt(big.s, cx, 300, 22 * pz, big.col, 0, false); }
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): el carrito de perros en la calle. Solo dibujo: lee el estado; no toca la simulación ─────
       Carrito de cerca con el perrero DETRÁS del mesón (se le ve de la cintura para arriba), el perro en la bandeja y 6 potes grandes en 2 filas
       (misma dirección que el stick), cada uno con su ícono acostado y su nombre GRANDE. La COMANDA, el globo del cliente y los avisos son carteles
       colgados de la cámara (nítidos a la resolución real, cada cosa en su sitio, sin amontonarse). El cliente de turno está a un lado y la cola detrás.
       El perrito callejero, el ventarrón y el apagón pasan de verdad en la escena. */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var CY = 1.87, DS = 1.05, DOGZ = -1.5, FLY = 0.26, INCL = 0.8, HD = 10;
    var SALIDA = { x: 15, z: 4 }, ENTRA = { x: 14, z: -5 }, ENT = 0.62, STAY = 1.5;
    var COOK = { x: 0.1, y: 0.95, z: -2.5 };
    var PXS = 2.3, PZ0 = 0.1, PZ1 = 2.4;
    var BPM = [138, 154, 174];
    var PAL3 = {
      1: { cielo: ['#5ab8ff', '#cfeeff'], hemi: [0xffffff, 0x9a8a70, 0.55], sol: [0xfff2d8, 0.7], niebla: '#cfeeff', piso: '#d6ccb8', junta: '#aea28c', calle: '#5a5a66', noche: 0 },
      2: { cielo: ['#ff8a5a', '#ffd9a0'], hemi: [0xffd0a0, 0x7a5a6a, 0.5], sol: [0xffb070, 0.8], niebla: '#ffcf9a', piso: '#cdb39a', junta: '#9e8672', calle: '#4e4656', noche: 0 },
      3: { cielo: ['#0c1230', '#2a2f62'], hemi: [0x8a8aff, 0x3a2a4a, 0.45], sol: [0x9aa8ff, 0.3], niebla: '#1a1d44', piso: '#6e6880', junta: '#4c4660', calle: '#2a2a38', noche: 1 }
    };
    var EDIF = ['#ff9ec7', '#7fd6c9', '#ffb36b', '#a9a0ff', '#8fd8ff', '#ffd23f', '#ff7a6a'];
    var LOCALES = [['PANADERÍA', '#c4563a'], ['FARMACIA', '#2f9a5c'], ['LICORERÍA', '#3a4aa8'], ['AREPERA', '#d9382f'], ['BODEGA', '#7a3aa8']];
    function binPos(s) { return { x: ((s % 3) - 1) * PXS, z: s < 3 ? PZ0 : PZ1 }; }
    function slotX(i, m2) { return m2 > 1 ? -0.85 + i * 1.7 / (m2 - 1) : 0; }
    function spot() { var a = v3 ? v3.esc.camera.aspect || 1.5 : 1.5; return a < 1 ? { x: 4.05, z: 0.5, qx: 0.15, qz: -1.7 } : { x: 4.95, z: 0.6, qx: 0.95, qz: -1.2 }; }
    function sitioStay() { var sp = spot(); return { x: sp.x + 0.3, z: sp.z + 1.5 }; }

    /* un ingrediente encima del perro (también el que vuela del pote al pan): UNA malla sin contorno, con forma propia */
    function ingMalla(k) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), col = ING[k].col, m2, pts2, i;
      if (k === 0) { m2 = M(new T.IcosahedronGeometry(0.2, 0), col, { borde: false }); m2.scale.set(1.5, 0.55, 0.9); }
      else if (k === 1) { m2 = M(new T.BoxGeometry(0.1, 0.1, 0.62), col, { borde: false }); m2.rotation.y = 0.5; }
      else if (k === 2) { m2 = M(new T.SphereGeometry(0.19, 6, 5), col, { borde: false }); m2.scale.set(1.3, 0.8, 1); }
      else if (k === 3) {
        pts2 = []; for (i = 0; i <= 8; i++) pts2.push(new T.Vector3(Math.sin(i * 1.6) * 0.11, 0, -0.34 + i * 0.085));
        m2 = M(new T.TubeGeometry(new T.CatmullRomCurve3(pts2), 14, 0.075, 5), col, { borde: false });
      }
      else if (k === 4) { m2 = M(new T.BoxGeometry(0.46, 0.07, 0.34), col, { borde: false }); m2.rotation.y = 0.4; }
      else { m2 = M(new T.TorusGeometry(0.17, 0.065, 4, 10), col, { borde: false }); m2.rotation.x = Math.PI / 2; }
      g3.add(m2);
      return g3;
    }
    /* la forma de cada ingrediente (relleno + contorno + dibujo): la MISMA en el pote y en la comanda */
    function formaIcono(x, k, cx2, cy2, r) {
      var I = ING[k], a, i2;
      x.lineJoin = 'round'; x.lineCap = 'round'; x.fillStyle = I.col; x.strokeStyle = '#14101c'; x.lineWidth = r * 0.14;
      x.beginPath();
      if (k === 0) x.arc(cx2, cy2, r, 0, 6.2832);
      else if (k === 1) { x.moveTo(cx2 - r, cy2 - r); x.lineTo(cx2 + r, cy2 - r); x.lineTo(cx2 + r, cy2 + r); x.lineTo(cx2 - r, cy2 + r); x.closePath(); }
      else if (k === 2) { x.moveTo(cx2, cy2 - r - 6); x.lineTo(cx2 + r + 8, cy2 + r - 8); x.lineTo(cx2 - r - 8, cy2 + r - 8); x.closePath(); }
      else if (k === 3) { for (i2 = 0; i2 < 8; i2++) { a = i2 * 0.7854 + 0.3927; x.lineTo(cx2 + Math.cos(a) * (r + 6), cy2 + Math.sin(a) * (r + 6)); } x.closePath(); }
      else if (k === 4) { x.moveTo(cx2, cy2 - r - 8); x.lineTo(cx2 + r + 6, cy2); x.lineTo(cx2, cy2 + r + 8); x.lineTo(cx2 - r - 6, cy2); x.closePath(); }
      else { for (i2 = 0; i2 < 10; i2++) { a = i2 * 0.6283 - 1.5708; var rr2 = i2 % 2 ? r * 0.62 : r + 8; x.lineTo(cx2 + Math.cos(a) * rr2, cy2 + Math.sin(a) * rr2); } x.closePath(); }
      x.fill(); x.stroke();
      var u = r / 74;
      x.strokeStyle = I.tx; x.fillStyle = I.tx; x.lineWidth = 9 * u;
      if (k === 0) { x.beginPath(); x.arc(cx2, cy2, 36 * u, 0.4, 5.6); x.stroke(); x.beginPath(); x.arc(cx2, cy2, 14 * u, 0, 6.2832); x.stroke(); }
      else if (k === 1) { for (i2 = -1; i2 <= 1; i2++) { x.beginPath(); x.moveTo(cx2 + (i2 * 30 - 8) * u, cy2 + 44 * u); x.lineTo(cx2 + (i2 * 30 + 8) * u, cy2 - 44 * u); x.stroke(); } }
      else if (k === 2) { x.beginPath(); x.moveTo(cx2, cy2 - 28 * u); x.quadraticCurveTo(cx2 + 34 * u, cy2 + 24 * u, cx2, cy2 + 42 * u); x.quadraticCurveTo(cx2 - 34 * u, cy2 + 24 * u, cx2, cy2 - 28 * u); x.stroke(); }
      else if (k === 3) { x.beginPath(); x.moveTo(cx2 - 46 * u, cy2); x.bezierCurveTo(cx2 - 24 * u, cy2 - 40 * u, cx2 - 12 * u, cy2 + 40 * u, cx2, cy2); x.bezierCurveTo(cx2 + 12 * u, cy2 - 40 * u, cx2 + 24 * u, cy2 + 40 * u, cx2 + 46 * u, cy2); x.stroke(); }
      else if (k === 4) { for (i2 = -1; i2 <= 1; i2++) { x.beginPath(); x.moveTo(cx2 + (-34 + Math.abs(i2) * 10) * u, cy2 + i2 * 26 * u); x.lineTo(cx2 + (34 - Math.abs(i2) * 10) * u, cy2 + i2 * 26 * u); x.stroke(); } }
      else { x.beginPath(); x.arc(cx2, cy2, 40 * u, 0, 6.2832); x.stroke(); x.beginPath(); x.arc(cx2, cy2, 18 * u, 0, 6.2832); x.stroke(); }
    }
    var TEX = [], TEXS = [];
    function iconTex(k) {                                  // el del pote: forma + nombre GRANDE
      if (TEX[k]) return TEX[k];
      return TEX[k] = V3.texturaCanvas(320, 232, function (x, w, h) {
        var f = 58, n = ING[k].n;
        formaIcono(x, k, w / 2, 96, 72);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        do { x.font = 'bold ' + f + 'px "Arial Black", Arial, sans-serif'; f -= 2; } while (x.measureText(n).width > w - 16 && f > 20);
        x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = '#14101c'; x.fillStyle = '#ffffff';
        x.strokeText(n, w / 2, h - 30); x.fillText(n, w / 2, h - 30);
      });
    }
    function iconSolo(k) {                                 // el de la comanda: solo la forma
      if (TEXS[k]) return TEXS[k];
      return TEXS[k] = V3.texturaCanvas(192, 192, function (x, w, h) { formaIcono(x, k, w / 2, h / 2, 74); });
    }
    /* el perro: pan, salchicha (se la puede robar el perrito), 6 puestos de ingrediente y la X de «arruinado» */
    function perro3D() {
      var T = THREE, M = V3.malla, g3 = new T.Group(), i, k;
      var pan = M(new T.CylinderGeometry(0.36, 0.36, 2.3, 8), '#d9984a', { g: 0.04, recibe: true }); pan.rotation.z = Math.PI / 2; pan.scale.set(0.6, 1, 1); pan.position.y = 0.22; g3.add(pan);
      [-1, 1].forEach(function (sz) { var la = M(new T.CylinderGeometry(0.17, 0.17, 2.2, 7), '#f0b868', { g: 0.05 }); la.rotation.z = Math.PI / 2; la.position.set(0, 0.4, sz * 0.27); g3.add(la); });
      var sal = new T.Group(); g3.add(sal);
      var sc = M(new T.CylinderGeometry(0.17, 0.17, 2.55, 8), '#c4452f', { g: 0.05 }); sc.rotation.z = Math.PI / 2; sc.position.y = 0.44; sal.add(sc);
      [-1, 1].forEach(function (sx) { var pu = M(new T.SphereGeometry(0.17, 8, 6), '#c4452f', { borde: false }); pu.position.set(sx * 1.27, 0.44, 0); sal.add(pu); });
      var slots = [];
      for (i = 0; i < 6; i++) {
        var sg = new T.Group(); sg.position.y = 0.62; g3.add(sg);
        var s = { g: sg, hijos: [] };
        for (k = 0; k < 6; k++) { var h = ingMalla(k); h.scale.setScalar(1.7); h.visible = false; sg.add(h); s.hijos.push(h); }
        sg.visible = false; slots.push(s);
      }
      var xg = new T.Group(); xg.position.y = 1.5; xg.rotation.x = -0.5; g3.add(xg);
      [-1, 1].forEach(function (sx) { var b = M(new T.BoxGeometry(1.2, 0.2, 0.2), '#e0222e', { g: 0.08 }); b.rotation.z = sx * Math.PI / 4; xg.add(b); });
      xg.visible = false;
      return { g: g3, slots: slots, x: xg, sal: sal };
    }
    function pintaPerro(D, sq, np, malo, badK, land) {
      var m2 = sq.length, i, k;
      for (i = 0; i < 6; i++) {
        var s = D.slots[i], ing = -1;
        if (i < np && i < m2 && (!land || absT >= land[i])) ing = sq[i];
        else if (malo && i === np && badK >= 0) ing = badK;
        s.g.visible = ing >= 0;
        if (ing < 0) continue;
        s.g.position.set(slotX(i, m2), 0.62 + (i % 2) * 0.05, (i % 2 ? 0.05 : -0.05));
        for (k = 0; k < 6; k++) s.hijos[k].visible = k === ing;
      }
      D.x.visible = !!malo && badK >= 0;
      D.sal.visible = !(malo && badK === -2);
    }
    /* un pote grande del mesón: tazón con su montoncito del color + el ÍCONO acostado sobre la tapa (el mismo de la comanda, con su nombre) */
    function pote(k) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), col = ING[k].col, m2;
      m2 = M(new T.CylinderGeometry(0.88, 0.7, 0.55, 12), V3.oscurecer(col, 0.8), { g: 0.03, recibe: true }); m2.position.y = 0.27; g3.add(m2);
      var ri = M(new T.TorusGeometry(0.86, 0.08, 5, 18), col, { borde: false }); ri.rotation.x = Math.PI / 2; ri.position.y = 0.55; g3.add(ri);
      var mon = M(new T.SphereGeometry(0.62, 8, 5), col, { borde: false }); mon.scale.y = 0.45; mon.position.y = 0.6; g3.add(mon);
      var sg = new T.Group(); sg.position.set(0, 1.12, 0.25); g3.add(sg);
      var halo = new T.Mesh(new T.CircleGeometry(1.0, 22), new T.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95 })); halo.position.z = -0.03; halo.scale.y = 0.85; halo.visible = false; sg.add(halo);
      var ic = new T.Mesh(new T.PlaneGeometry(2.15, 1.56), new T.MeshBasicMaterial({ map: iconTex(k), transparent: true })); sg.add(ic);
      sg.rotation.x = -0.95;
      g3.userData.sign = sg; g3.userData.halo = halo; g3.userData.ic = ic;
      return g3;
    }
    /* un carrito de perros: cuerpo, mesón, ruedas, toldo a rayas con bombillos, letrero, olla humeando */
    function carrito(S3, pl, focos) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), i;
      S3.add(g3);
      var cu = M(new T.BoxGeometry(6.9, 1.45, 6), '#e8e4dc', { recibe: true, g: 0.015 }); cu.position.y = 1.02; g3.add(cu);
      var fr = M(new T.BoxGeometry(6.94, 0.35, 6.04), '#d9382f', { borde: false, recibe: true }); fr.position.y = 0.5; g3.add(fr);
      var me2 = M(new T.BoxGeometry(7.3, 0.12, 6.4), '#b9c0c8', { recibe: true, g: 0.02 }); me2.position.y = 1.81; g3.add(me2);
      var tex = V3.texturaCanvas(512, 96, function (cx2, w2, h2) {
        cx2.fillStyle = '#d9382f'; cx2.fillRect(0, 0, w2, h2); cx2.fillStyle = '#ffd23f'; cx2.fillRect(8, 8, w2 - 16, h2 - 16);
        cx2.fillStyle = '#d9382f'; cx2.font = 'bold 54px sans-serif'; cx2.textAlign = 'center'; cx2.textBaseline = 'middle'; cx2.fillText('PERROS CALIENTES', w2 / 2, h2 / 2 + 3);
      });
      var le = new T.Mesh(new T.PlaneGeometry(6.0, 1.0), new T.MeshBasicMaterial({ map: tex })); le.position.set(0, 1.12, 3.03); g3.add(le);
      [[-3.5, 1.9], [3.5, 1.9], [-3.5, -1.9], [3.5, -1.9]].forEach(function (r) {
        var ru = M(new T.CylinderGeometry(0.62, 0.62, 0.3, 12), '#2a2a34', { g: 0.04 }); ru.rotation.z = Math.PI / 2; ru.position.set(r[0], 0.62, r[1]); g3.add(ru);
      });
      var bd = M(new T.BoxGeometry(3.3, 0.1, 1.2), '#c9d0d8', { g: 0.03, recibe: true }); bd.position.set(0, CY + 0.06, DOGZ); g3.add(bd);      // bandeja del perro
      [-3.4, 3.4].forEach(function (px) { var pa = M(new T.CylinderGeometry(0.08, 0.08, 3.9, 6), '#c9d0d8', { g: 0.05 }); pa.position.set(px, 3.75, -2.9); g3.add(pa); });
      for (i = 0; i < 8; i++) { var ra = M(new T.BoxGeometry(7.6 / 8, 0.12, 2.2), i % 2 ? '#fff3d6' : '#d9382f', { borde: false, recibe: true }); ra.position.set(-3.8 + (i + 0.5) * 7.6 / 8, 5.75, -3.3); g3.add(ra); }
      for (i = 0; i < 12; i++) { var fl = M(new T.ConeGeometry(0.3, 0.38, 3), i % 2 ? '#fff3d6' : '#d9382f', { g: 0.04 }); fl.rotation.x = Math.PI; fl.position.set(-3.45 + i * 0.627, 5.5, -2.2); g3.add(fl); }
      for (i = 0; i < 9; i++) { var bb = new T.Mesh(new T.SphereGeometry(0.12, 6, 4), focos[i % 2]); bb.position.set(-3.3 + i * 0.825, 5.22, -2.15); g3.add(bb); }
      var ol = M(new T.CylinderGeometry(0.5, 0.45, 0.7, 10), '#9aa4b0', { g: 0.04 }); ol.position.set(-3.0, 2.22, -2.0); g3.add(ol);
      return g3;
    }
    function carro(S3, col, pl) {
      var T = THREE, M = V3.malla, g3 = new T.Group(); S3.add(g3);
      var cu = M(new T.BoxGeometry(3.8, 0.8, 1.8), col, { g: 0.03 }); cu.position.y = 0.7; g3.add(cu);
      var ca = M(new T.BoxGeometry(2, 0.7, 1.6), V3.oscurecer(col, 0.85), { g: 0.03 }); ca.position.set(-0.25, 1.45, 0); g3.add(ca);
      var vi = M(new T.BoxGeometry(2.05, 0.45, 1.5), '#3a4a7a', { borde: false }); vi.position.set(-0.25, 1.5, 0); g3.add(vi);
      [[-1.25, 0.9], [1.25, 0.9], [-1.25, -0.9], [1.25, -0.9]].forEach(function (r) { var ru = M(new T.CylinderGeometry(0.36, 0.36, 0.25, 10), '#1a1a22', { g: 0.04 }); ru.rotation.x = Math.PI / 2; ru.position.set(r[0], 0.36, r[1]); g3.add(ru); });
      [-0.55, 0.55].forEach(function (zz) { var fa = new T.Mesh(new T.BoxGeometry(0.08, 0.22, 0.38), V3.toon('#fff6c0', { em: '#ffe9a0', emI: pl.noche ? 1.8 : 0.2 })); fa.position.set(1.92, 0.8, zz); g3.add(fa); });
      return g3;
    }
    function edificio(S3, x, w, h, col, pl, k) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), lo = LOCALES[k % LOCALES.length]; g3.position.set(x, 0, -15.5); S3.add(g3);
      var cu = M(new T.BoxGeometry(w, h, 4), col, { recibe: true, borde: false }); cu.position.y = h / 2; g3.add(cu);
      /* la fachada entera es UNA textura: ventanas, puerta y letrero (antes eran ~25 mallas por edificio) */
      var nv = Math.max(1, Math.round(w / 2.4)), PX = 40;
      var tex = V3.texturaCanvas(Math.round(w * PX), Math.round(h * PX), function (x2, w2, h2) {
        var r, i2, sx = w2 / w, sy = h2 / h;
        x2.fillStyle = col; x2.fillRect(0, 0, w2, h2);
        for (r = 0; 4.2 + r * 2.6 < h - 1; r++) for (i2 = 0; i2 < nv; i2++) {
          var luz = pl.noche && (i2 + r + k) % 3 !== 0;
          x2.fillStyle = luz ? '#ffd36a' : '#3a4a7a'; x2.fillRect((-w / 2 + (i2 + 0.5) * w / nv + w / 2 - 0.5) * sx, h2 - (4.4 + r * 2.6 + 0.65) * sy, sx, 1.3 * sy);
        }
        x2.fillStyle = pl.noche ? '#ffcf7a' : '#2a2a34'; x2.fillRect(w2 * 0.15, h2 - 2.3 * sy, w2 * 0.7, 2.3 * sy);
        x2.fillStyle = lo[1]; x2.fillRect(w2 * 0.1, h2 - 3.5 * sy, w2 * 0.8, 1.1 * sy);
        x2.fillStyle = '#fffdf2'; x2.font = 'bold ' + Math.round(0.7 * sy) + 'px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(lo[0], w2 / 2, h2 - 2.95 * sy);
      });
      var fa = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex })); fa.position.set(0, h / 2, 2.02); g3.add(fa);
    }
    /* el perrito callejero: espera que se caiga algo… y a veces se roba la salchicha */
    function perrito(S3) {
      var T = THREE, M = V3.malla, g3 = new T.Group(), cuerpo = new T.Group(); g3.add(cuerpo); S3.add(g3);
      var cu = M(new T.BoxGeometry(1, 0.48, 0.45), '#b07a4a', { g: 0.05 }); cu.position.y = 0.62; cuerpo.add(cu);
      var ca = M(new T.BoxGeometry(0.46, 0.42, 0.42), '#b07a4a', { g: 0.05 }); ca.position.set(0.6, 0.95, 0); cuerpo.add(ca);
      var ho = M(new T.BoxGeometry(0.24, 0.2, 0.26), '#d9b08a', { g: 0.06 }); ho.position.set(0.88, 0.88, 0); cuerpo.add(ho);
      var na = M(new T.BoxGeometry(0.08, 0.08, 0.1), '#14101c', { borde: false }); na.position.set(1.0, 0.95, 0); cuerpo.add(na);
      [-1, 1].forEach(function (sz) { var o = M(new T.BoxGeometry(0.12, 0.26, 0.14), '#7a4a2a', { g: 0.06 }); o.position.set(0.52, 1.22, sz * 0.17); o.rotation.x = sz * 0.3; cuerpo.add(o);
        var oj = M(new T.BoxGeometry(0.06, 0.08, 0.06), '#14101c', { borde: false }); oj.position.set(0.84, 1.02, sz * 0.12); cuerpo.add(oj); });
      var patas = [];
      [[-0.38, 0.15], [0.38, 0.15], [-0.38, -0.15], [0.38, -0.15]].forEach(function (r) { var pa = M(new T.BoxGeometry(0.13, 0.42, 0.13), '#b07a4a', { g: 0.06 }); pa.position.set(r[0], 0.2, r[1]); cuerpo.add(pa); patas.push(pa); });
      var co = new T.Group(); co.position.set(-0.5, 0.78, 0); cuerpo.add(co);
      var cm = M(new T.BoxGeometry(0.1, 0.45, 0.1), '#b07a4a', { g: 0.06 }); cm.position.y = 0.2; cm.rotation.z = 0.4; co.add(cm);
      var boca = M(new T.CylinderGeometry(0.1, 0.1, 0.9, 7), '#c4452f', { g: 0.06 }); boca.rotation.x = Math.PI / 2; boca.position.set(1.02, 0.85, 0); boca.visible = false; cuerpo.add(boca);
      g3.scale.setScalar(1.25);
      return { g: g3, cuerpo: cuerpo, cola: co, patas: patas, boca: boca, x: -4.7, z: 1.6, px: -4.7, pz: 1.6, salto: -9 };
    }

    /* ───── carteles de pantalla: planos colgados de la cámara, nítidos a la resolución real (el texto 2D del motor sale pixelado y chico) ───── */
    var HC = {}, HN = 0, HM = null, HPR = 3, HG = null, HK = { cx: 0, kx: 1, ky: 1 }, HBL = null, HS = {};
    function fuente(px) { return 'bold ' + px + 'px "Arial Black", "Helvetica Neue", Arial, sans-serif'; }
    function med(t, f) { HM.font = fuente(f * HPR); return HM.measureText(t).width / HPR; }
    function rect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
    /* texto en pastilla/globo → {tex, w, h} en px lógicos. o: sz, fg, bg, bd, mw (ancho máx.), cola (globo con rabito), tr (color del trazo; 0 = sin), pad */
    function hTxt(s, o) {
      o = o || {};
      var sz = o.sz || 16, key = s + '|' + sz + '|' + (o.fg || '') + '|' + (o.bg || '') + '|' + (o.mw || 0) + '|' + (o.cola || 0) + '|' + (o.tr === undefined ? '' : o.tr) + '|' + (o.bd || '') + '|' + (o.pad === undefined ? '' : o.pad), r = HC[key];
      if (r) return r;
      if (!HM) HM = document.createElement('canvas').getContext('2d');
      if (HN > 500) { HC = {}; HN = 0; }
      var f = sz, ln = [s], w = med(s, f), pad = o.pad === undefined ? (o.bg ? sz * 0.55 : 4) : o.pad, mw = o.mw ? o.mw - 2 * pad : 0, cc = -1, p;
      if (mw && w > mw) {
        for (p = 0; p < s.length; p++) if (s.charAt(p) === ' ' && (cc < 0 || Math.abs(p - s.length / 2) < Math.abs(cc - s.length / 2))) cc = p;
        if (cc > 0) { ln = [s.slice(0, cc), s.slice(cc + 1)]; w = Math.max(med(ln[0], f), med(ln[1], f)); }
        while (w > mw && f > 9) { f--; w = ln.length > 1 ? Math.max(med(ln[0], f), med(ln[1], f)) : med(s, f); }
      }
      var lh = f * 1.12, cw = Math.ceil(w + 2 * pad + 6), cola = o.cola ? Math.round(sz * 0.55) : 0, bh = Math.ceil(ln.length * lh + (o.bg ? pad * 0.9 : 4) + 4), ch = bh + cola;
      var tex = V3.texturaCanvas(cw * HPR, ch * HPR, function (x) {
        var i2, bx = o.bd || INKC;
        x.scale(HPR, HPR); x.lineJoin = 'round'; x.lineCap = 'round';
        if (o.bg) {
          x.fillStyle = o.bg; x.strokeStyle = bx; x.lineWidth = 3;
          if (cola) { x.beginPath(); x.moveTo(cw / 2 - cola * 0.8, bh - 3); x.lineTo(cw / 2 + cola * 0.2, ch - 1.5); x.lineTo(cw / 2 + cola * 0.8, bh - 3); x.closePath(); x.fill(); x.stroke(); }
          rect(x, 2, 2, cw - 4, bh - 4, Math.min(16, (bh - 4) / 2)); x.fill(); x.stroke();
          if (cola) x.fillRect(cw / 2 - cola * 0.8 + 2.5, bh - 5, cola * 1.6 - 5, 4);
        }
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = fuente(f);
        for (i2 = 0; i2 < ln.length; i2++) {
          var ty = 2 + (o.bg ? pad * 0.45 : 2) + (i2 + 0.5) * lh;
          if (o.tr !== 0 && (!o.bg || o.tr)) { x.lineWidth = f * 0.2; x.strokeStyle = o.tr || INKC; x.strokeText(ln[i2], cw / 2, ty); }
          x.fillStyle = o.fg || '#ffffff'; x.fillText(ln[i2], cw / 2, ty);
        }
      });
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      HN++;
      return HC[key] = { tex: tex, w: cw, h: ch, cola: cola };
    }
    function hItem(tex, w, h, ord) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex || HBL, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      m.renderOrder = 900 + (ord || 0); m.visible = false; m.frustumCulled = false; HG.add(m);
      return { m: m, w: w || 1, h: h || 1 };
    }
    function hSet(it, r) { if (it.m.material.map !== r.tex) it.m.material.map = r.tex; it.w = r.w; it.h = r.h; }
    function hAt(it, x, y, sc, alpha, rot) {
      var s = sc === undefined ? 1 : sc, a = alpha === undefined ? 1 : alpha, m = it.m;
      m.visible = s > 0.001 && a > 0.01; if (!m.visible) return;
      m.position.set((x - HK.cx) * HK.kx, (300 - y) * HK.ky, 0); m.scale.set(it.w * s * HK.ky, it.h * s * HK.ky, 1);
      m.rotation.z = rot || 0; m.material.opacity = a;
    }
    function hOff(it) { it.m.visible = false; }
    /* texturas fijas de los carteles */
    function hEst(n) {
      if (HS[n]) return HS[n];
      var T = THREE;
      if (n === 'panel') return HS[n] = V3.texturaCanvas(660, 264, function (x, w, h) {
        x.lineJoin = 'round'; x.fillStyle = '#fffdf2'; x.strokeStyle = INKC; x.lineWidth = 7; rect(x, 5, 5, w - 10, h - 10, 24); x.fill(); x.stroke();
        x.save(); rect(x, 5, 5, w - 10, h - 10, 24); x.clip(); x.fillStyle = '#d9382f'; x.fillRect(0, 0, w, 46); x.restore(); x.lineWidth = 7; x.beginPath(); x.moveTo(5, 46); x.lineTo(w - 5, 46); x.stroke();
        rect(x, 5, 5, w - 10, h - 10, 24); x.stroke();
      });
      if (n === 'tile' || n === 'tileOn') return HS[n] = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.lineJoin = 'round'; x.fillStyle = n === 'tile' ? '#2a2438' : '#ffe14d'; x.strokeStyle = n === 'tile' ? INKC : '#d98a00'; x.lineWidth = 9; rect(x, 6, 6, w - 12, h - 12, 22); x.fill(); x.stroke();
        if (n === 'tile') { x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 4; rect(x, 14, 14, w - 28, h - 28, 16); x.stroke(); }
      });
      if (n === 'check') return HS[n] = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = 30; x.strokeStyle = INKC; x.beginPath(); x.moveTo(26, 68); x.lineTo(54, 96); x.lineTo(104, 32); x.stroke();
        x.lineWidth = 17; x.strokeStyle = '#4cff7a'; x.beginPath(); x.moveTo(26, 68); x.lineTo(54, 96); x.lineTo(104, 32); x.stroke();
      });
      if (n === 'bar') return HS[n] = V3.texturaCanvas(128, 32, function (x, w, h) { x.fillStyle = '#ffffff'; rect(x, 1, 1, w - 2, h - 2, 15); x.fill(); });
      if (n === 'barBg') return HS[n] = V3.texturaCanvas(128, 32, function (x, w, h) { x.fillStyle = '#d8d0c0'; x.strokeStyle = INKC; x.lineWidth = 4; rect(x, 3, 3, w - 6, h - 6, 13); x.fill(); x.stroke(); });
      if (n === 'burst') return HS[n] = V3.texturaCanvas(256, 256, function (x, w, h) {
        var i2, a, r;
        x.lineJoin = 'round'; x.fillStyle = '#ffe14d'; x.strokeStyle = '#ff5c8a'; x.lineWidth = 8; x.beginPath();
        for (i2 = 0; i2 < 24; i2++) { a = i2 * 0.2618; r = i2 % 2 ? 78 : 120; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
        x.closePath(); x.fill(); x.stroke();
      });
      return HBL;
    }
    function hNum(i) { return HS['n' + i] || (HS['n' + i] = V3.texturaCanvas(64, 64, function (x) { x.fillStyle = '#fffdf2'; x.strokeStyle = INKC; x.lineWidth = 5; x.beginPath(); x.arc(32, 32, 27, 0, 6.2832); x.fill(); x.stroke(); x.fillStyle = INKC; x.font = fuente(36); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), 32, 35); })); }

    function montar3D() {
      var T = THREE, pl = PAL3[lv], i;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, 40, 110], fov: 32 });
      if (!esc) return null;
      /* música propia: salsa caraqueña de carrito, la menor (i–iv–V–i); se acelera con la hora pico y los últimos segundos */
      var AC = [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]], MEL = [76, 0, 76, 72, 0, 74, 76, 0, 77, 0, 76, 74, 72, 0, 69, 0, 71, 0, 72, 74, 0, 71, 68, 0, 69, 0, 72, 0, 76, 0, 0, 0];
      V3.pista('perro', { bpm: BPM[0], acordes: AC, mel: MEL }); V3.pista('perro2', { bpm: BPM[1], acordes: AC, mel: MEL }); V3.pista('perro3', { bpm: BPM[2], acordes: AC, mel: MEL });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      if (lv === 2) esc.luces.sol.position.set(-26, 12, 6);
      var S3 = esc.scene, M = V3.malla;
      HBL = V3.texturaCanvas(2, 2, function () { }); HS = {};
      HG = new T.Group(); HG.position.z = -HD; esc.camera.add(HG); S3.add(esc.camera);
      /* la acera, la calle justo detrás del carrito y los locales */
      var bald = V3.texturaCanvas(256, 256, function (x, w2, h2) {
        x.fillStyle = pl.junta; x.fillRect(0, 0, w2, h2);
        for (var j = 0; j < 4; j++) for (var i2 = 0; i2 < 4; i2++) { x.fillStyle = V3.oscurecer(pl.piso, 0.92 + ((i2 * 5 + j * 3) % 4) * 0.04); x.fillRect(i2 * 64 + 3, j * 64 + 3, 58, 58); }
      }, [30, 12]);
      var piso = new T.Mesh(new T.PlaneGeometry(120, 50), new T.MeshToonMaterial({ map: bald, gradientMap: V3.toon('#fff').gradientMap }));
      piso.rotation.x = -Math.PI / 2; piso.position.z = 0; piso.receiveShadow = true; S3.add(piso);
      var calle = M(new T.BoxGeometry(120, 0.04, 6), pl.calle, { borde: false, recibe: true }); calle.position.set(0, 0.02, -9.5); S3.add(calle);
      for (i = -5; i <= 5; i++) { var ra = M(new T.BoxGeometry(2.8, 0.05, 0.18), '#f2e6b0', { borde: false }); ra.position.set(i * 11, 0.05, -9.5); S3.add(ra); }
      [-6.4, -12.6].forEach(function (zz) { var br = M(new T.BoxGeometry(120, 0.25, 0.4), '#d8d0c0', { borde: false, recibe: true }); br.position.set(0, 0.12, zz); S3.add(br); });
      var xs = -36;
      for (i = 0; xs < 36; i++) { var w0 = 7 + (i * 5) % 4, h0 = 7 + (i * 3) % 6; edificio(S3, xs + w0 / 2, w0, h0, EDIF[i % EDIF.length], pl, i); xs += w0 + 0.3; }
      var luces = [], lamps = [];
      [-8.5, 9.5].forEach(function (px) {
        var po = M(new T.CylinderGeometry(0.12, 0.16, 7, 6), '#2a2a34'); po.position.set(px, 3.5, -5.6); S3.add(po);
        var la = new T.Mesh(new T.BoxGeometry(0.7, 0.25, 0.5), V3.toon('#fff2a0', { em: '#ffd36a', emI: pl.noche ? 1.6 : 0.2, nuevo: true })); la.position.set(px + 1.0, 6.85, -5.6); S3.add(la);
        luces.push(la.position); lamps.push(la.material);
      });
      /* banderines tricolor entre los dos postes: ondean solos */
      var banderas = [], bcol = ['#ffd23f', '#2f6fd0', '#e0222e'];
      for (i = 0; i < 18; i++) {
        var bf = M(new T.ConeGeometry(0.26, 0.5, 3), bcol[i % 3], { g: 0.05 }); bf.rotation.x = Math.PI;
        var bu = i / 17; bf.position.set(-8.5 + 18 * bu, 6.55 - Math.sin(bu * Math.PI) * 0.9, -5.6); S3.add(bf); banderas.push(bf);
      }
      var focos = [V3.toon('#fff6c0', { em: '#ffd23f', emI: pl.noche ? 1.8 : 0.15, nuevo: true }), V3.toon('#ffe0b0', { em: '#ff9a3d', emI: pl.noche ? 1.8 : 0.15, nuevo: true })];
      carrito(S3, pl, focos);
      var lc = new T.PointLight(0xffd090, pl.noche ? 1.3 : 0, 14, 2); lc.position.set(0, 4.7, -1.2); S3.add(lc);
      var linterna = new T.PointLight(0xfff2c0, 0, 6, 2); S3.add(linterna);
      /* los 6 potes del mesón: grandes, de colores, en la rejilla del stick */
      var potes = [];
      for (i = 0; i < 6; i++) {
        var pp = binPos(i), po2 = pote(lay[i]); po2.position.set(pp.x, CY, pp.z); S3.add(po2);
        var aro = new T.Mesh(new T.RingGeometry(0.98, 1.28, 28), new T.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0, depthWrite: false })); aro.rotation.x = -Math.PI / 2; aro.position.set(pp.x, CY + 0.03, pp.z); S3.add(aro);
        var guia = new T.Mesh(new T.RingGeometry(1.0, 1.18, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); guia.rotation.x = -Math.PI / 2; guia.position.set(pp.x, CY + 0.025, pp.z); S3.add(guia);
        potes.push({ g: po2, aro: aro, guia: guia, k: lay[i], x: pp.x, z: pp.z, alto: 0, de: null, hT: -9, bump: 0, shake: 0 });
      }
      var flecha = M(new T.ConeGeometry(0.34, 0.65, 4), '#ffe14d', { g: 0.08, em: '#ffb000', emI: 0.6 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var D = perro3D(); D.g.position.set(0, CY + 0.1, DOGZ); D.g.scale.setScalar(DS); S3.add(D.g);
      /* el perrero: detrás del mesón, de la cintura para arriba (de pie sobre una tarima escondida en el carrito) */
      var cook = V3.PJ.crear(asiento(me()).ch || 'tu', { prop: false, escala: 1.35 }), cookW = new T.Group(); cookW.position.set(COOK.x, COOK.y, COOK.z); cookW.add(cook.g); S3.add(cookW);
      var vuelan = [];
      for (i = 0; i < 6; i++) { var vg = ingMalla(i); vg.scale.setScalar(DS * 1.4); vg.visible = false; S3.add(vg); vuelan.push({ g: vg, t0: -9, de: null, a: null, k: i }); }
      /* los clientes: 5 personajes que se turnan (cliente i -> personaje i % 5); el VIP lleva corona */
      var clientes = [];
      for (i = 0; i < 5; i++) {
        var cp3 = V3.PJ.crear(CUST[i], { prop: false, escala: 1.3 }), cw = new T.Group(); cw.add(cp3.g); S3.add(cw);
        var mini = new T.Group(); mini.scale.setScalar(0.32);
        var pan2 = M(new T.CylinderGeometry(0.4, 0.4, 2.3, 8), '#d9984a', { g: 0.06 }); pan2.rotation.z = Math.PI / 2; mini.add(pan2);
        var sal2 = M(new T.CylinderGeometry(0.2, 0.2, 2.5, 8), '#c4452f', { g: 0.06 }); sal2.rotation.z = Math.PI / 2; sal2.position.y = 0.3; mini.add(sal2);
        mini.position.y = -0.1; mini.visible = false; cp3.mano('der').add(mini);
        var cor = new T.Group(); cor.position.y = 3.25; cp3.g.add(cor);
        var cob = M(new T.CylinderGeometry(0.34, 0.3, 0.22, 8), '#ffd23f', { g: 0.06, em: '#ffb000', emI: 0.4 }); cor.add(cob);
        for (var pk = 0; pk < 5; pk++) { var pu = M(new T.ConeGeometry(0.08, 0.22, 4), '#ffd23f', { g: 0.08 }); pu.position.set(Math.cos(pk * 1.256) * 0.3, 0.2, Math.sin(pk * 1.256) * 0.3); cor.add(pu); }
        cor.visible = false;
        clientes.push({ pj: cp3, w: cw, mini: mini, cor: cor, cur: -1, x: ENTRA.x, z: ENTRA.z, px: ENTRA.x, pz: ENTRA.z, ph: i * 1.9, puf: 0 });
      }
      /* gente que pasa por la acera de atrás */
      var andan = [];
      ['prima', 'cobrador'].forEach(function (id, ix) {
        var wp = V3.PJ.crear(id, { prop: false, escala: 1.15 }), ww = new T.Group(); ww.add(wp.g); S3.add(ww);
        andan.push({ pj: wp, w: ww, x: ix ? 18 : -22, dir: ix ? -1 : 1, v: 1.5 + ix * 0.5, z: -5.2 - ix * 0.6, px: 0 });
      });
      var gato = perrito(S3);
      var autos = [carro(S3, '#e8433a', pl), carro(S3, '#3fa9ff', pl), carro(S3, '#ffd23f', pl), carro(S3, '#7fd6c9', pl)];
      var part = V3.particulas(esc, 700);
      /* carteles */
      var HU = {
        panel: hItem(hEst('panel'), 330, 132, 0), cab: hItem(null, 1, 1, 3), fase: hItem(null, 1, 1, 3),
        gTile: hItem(hEst('tileOn'), 88, 92, 1), gIc: hItem(iconSolo(0), 66, 66, 2), gNom: hItem(null, 1, 1, 3),
        pas: [], barBg: hItem(hEst('barBg'), 322, 13, 0), bar: hItem(hEst('bar'), 100, 8, 1),
        mid: hItem(null, 1, 1, 5), hint: hItem(null, 1, 1, 5), chico: hItem(null, 1, 1, 5), pop: hItem(null, 1, 1, 6),
        burst: hItem(hEst('burst'), 150, 150, 4), bubA: hItem(null, 1, 1, 7), bubB: hItem(null, 1, 1, 7),
        guau: hItem(null, 1, 1, 6), big: hItem(null, 1, 1, 8), cola: hItem(null, 1, 1, 6), vien: [hItem(null, 1, 1, 6), hItem(null, 1, 1, 6)], luz: hItem(null, 1, 1, 6), malo: hItem(null, 1, 1, 6)
      };
      for (i = 0; i < 6; i++) HU.pas.push({ bg: hItem(hEst('tile'), 66, 44, 1), ic: hItem(iconSolo(0), 34, 34, 2), nu: hItem(hNum(i), 18, 18, 3), ok: hItem(hEst('check'), 30, 30, 4) });
      v3 = { esc: esc, potes: potes, flecha: flecha, D: D, cook: cook, cookW: cookW, vuelan: vuelan, clientes: clientes, gato: gato, autos: autos, andan: andan, banderas: banderas, HU: HU,
        part: part, focos: focos, lamps: lamps, lc: lc, linterna: linterna, luces: luces, humoT: 0, polvoT: 0, polilla: [], pl: pl, autoX: [0, 31, 57, 80],
        est: { o: ord[me()], pa: paso[me()], e: err[me()], ma: mal[me()], ca: cam[me()], srv: srv[me()], entT: -9, entSeq: [], land: [0, 0, 0, 0, 0, 0], pop: 0, ido: idoT[me()] },
        servT: {}, idoAt: {}, say: [], shout: -1, shoutT: -9, ck: { bump: 0, shake: 0, triste: 0, hop: 0 }, ladra: 0,
        luzK: 1, base: { hemi: pl.hemi[2], sol: pl.sol[1] } };
      if (pl.noche) for (i = 0; i < 4; i++) { var mo = new T.Mesh(new T.SphereGeometry(0.06, 4, 3), new T.MeshBasicMaterial({ color: 0xfff6c0 })); S3.add(mo); v3.polilla.push(mo); }
      encuadra();
      return V3.ultimo = v3;
    }
    /* el encuadre depende del formato: vertical = carrito de frente y bien grande; horizontal = el carrito y el cliente a su lado */
    function encuadra() {
      var T = THREE, a = v3.esc.camera.aspect || 1.5, por = a < 1;
      if (v3.por === por) return; v3.por = por;
      if (por) v3.esc.encuadrar(10.2, 12.2, new T.Vector3(0.9, 4.1, -0.2), 0.86);
      else v3.esc.encuadrar(10.6, 10.4, new T.Vector3(0.9, 2.3, -0.6), INCL);
    }

    /* ───── frases de perrero venezolano ───── */
    var QUE_RICO = ['¡ÑAM! ¡ESO, PANA!', '¡QUÉ RICO, VALE!', '¡ASÍ SÍ, CHAMO!', '¡TÚ SÍ SABES!', '¡BENDITO SEA ESE PERRO!'];
    var BRAVOS = ['¡QUÉ LENTO, VALE!', '¡ME VOY, PANA!', '¡AY, NO, MI HERMANO!', '¡TARDASTE UNA VIDA!'];
    function clienteDe(j) { var V = v3, k; for (k = 0; k < 5; k++) if (V.clientes[k].cur === j) return V.clientes[k]; return null; }
    function dicen(i, s, st, dur) { v3.say.push({ i: i, s: s, st: st, t0: absT, dur: dur }); if (v3.say.length > 8) v3.say.shift(); }
    /* reacciones a los cambios de MI estado (locales o del cuerpo si el juez lleva mi asiento) */
    function eventos3D() {
      var V = v3, s = V.est, m = me(), cook = V.cook, ck = V.ck, sq, i, j, C, cpos = new THREE.Vector3(0, CY + 0.1, DOGZ);
      if (ord[m] > s.o) {
        for (j = s.o; j < ord[m]; j++) {
          C = clienteDe(j);
          if (srvLog[m].indexOf(j) >= 0) {
            V.servT[j] = absT; dicen(j, CL[cl(j, 0, NC - 1)].huevo ? '¡AY, VALE, GRACIAS!' : QUE_RICO[j % QUE_RICO.length], 'feliz', 1.5);
            if (C) V.part.soltar(C.x, 3.0, C.z, CL[cl(j, 0, NC - 1)].huevo ? 34 : 14, { k: 'confeti', cols: ['#ff5c8a', '#ffd23f', '#ffffff', '#5cff7a'], vel: 3, arriba: 4, g: 4, vida: 1.2 });
          } else {
            V.idoAt[j] = absT; dicen(j, BRAVOS[j % BRAVOS.length], 'bravo', 1.5); ck.triste = 1.3;
            if (C) V.part.soltar(C.x, 2.6, C.z, 14, { k: 'chispa', cols: ['#ff5c5c', '#ffb030', '#ffffff'], vel: 3.5, arriba: 2, vida: 0.6 });
          }
        }
      }
      if (srv[m] > s.srv) {                                  // perro entregado
        var ix = srvLog[m].length ? srvLog[m][srvLog[m].length - 1] : ord[m] - 1;
        s.entT = absT; s.entSeq = seqOf(ix, 0).slice(); if (CL[cl(ix, 0, NC - 1)].seq2 && s.ca) s.entSeq = CL[cl(ix, 0, NC - 1)].seq2.slice();
        cook.uno('festejo'); s.pop = 1; ck.hop = 1;
        V.part.soltar(cpos.x, cpos.y + 1, cpos.z, 30, { k: 'confeti', cols: ['#ffd23f', '#ff5c8a', '#5cff7a', '#3fa9ff'], vel: 4, arriba: 4, g: 5, vida: 1.2 });
        V3.sfx('moneda'); V3.sfx('ding'); V.esc.sacudir(0.3);
        if (s.pa < s.entSeq.length) vuela(s.entSeq[s.entSeq.length - 1], s.entSeq.length - 1, s.entSeq.length);
      } else if (paso[m] > s.pa && ord[m] === s.o) {         // ingrediente bien puesto
        sq = seqOf(ord[m], cam[m]);
        for (i = s.pa; i < paso[m]; i++) vuela(sq[i], i, sq.length);
        cook.uno('lanzar'); ck.bump = 1;
      }
      if (err[m] > s.e) {
        cook.uno('golpe'); ck.shake = 1; V.part.soltar(cpos.x, cpos.y + 0.8, cpos.z, 26, { k: 'gota', cols: ['#e0222e', '#7a3a2a', bad[m] >= 0 ? ING[bad[m]].col : '#5a8a2a'], vel: 4, arriba: 3, vida: 0.8, esc: 1.2 }); V3.sfx('error'); V.esc.sacudir(0.5);
        if (bad[m] >= 0) V.potes[casillaDe(bad[m])].shake = 1;
        C = clienteDe(ord[m]); if (C) C.sus = 0.8;
      }
      if (s.ma && !mal[m] && ord[m] === s.o) { cook.uno('lanzar'); s.pop = 1; V.part.soltar(cpos.x, cpos.y + 0.5, cpos.z, 12, { k: 'chispa', cols: ['#d9984a', '#f0b868', '#c4452f'], vel: 3, arriba: 4, vida: 0.6 }); V3.sfx('whoosh'); }
      if (cam[m] && !s.ca) {
        V3.sfx('silbato'); V.esc.sacudir(0.8); var sp = spot(); V.part.soltar(sp.x, 4.2, sp.z, 10, { k: 'chispa', cols: ['#ff5c5c', '#fffdf2'], vel: 3, arriba: 3, vida: 0.6 });
        if (ord[m] < NC && CL[ord[m]].seq2) dicen(ord[m], '¡SIN ' + ING[CL[ord[m]].seq[CL[ord[m]].drop]].n + ', PANA!', 'bravo', 1.7);
        C = clienteDe(ord[m]); if (C) C.sus = 0.9;
      }
      if (idoT[m] !== s.ido) { s.ido = idoT[m]; V3.sfx('golpe'); V.esc.sacudir(0.4); }
      s.o = ord[m]; s.pa = paso[m]; s.e = err[m]; s.ma = mal[m]; s.ca = cam[m]; s.srv = srv[m];
    }
    function vuela(k, i, m2) {
      var V = v3, vu = V.vuelan[k], pp = V.potes[casillaDe(k)], T = THREE;
      vu.t0 = absT; vu.de = new T.Vector3(pp.x, CY + 1.4, pp.z); vu.a = new T.Vector3(slotX(i, m2) * DS, CY + 0.1 + 0.62 * DS, DOGZ);
      V.est.land[i] = absT + FLY; pp.bump = 1;
      V3.sfx('whoosh');
    }
    function aterriza(vu) {
      var V = v3, a = vu.a, col = ING[vu.k].col, salsa = vu.k === 2 || vu.k === 3;
      V.part.soltar(a.x, a.y + 0.1, a.z, salsa ? 16 : 9, { k: 'gota', cols: [col, V3.oscurecer(col, 0.8), '#fffdf2'], vel: salsa ? 3.2 : 2, arriba: salsa ? 3 : 2.2, vida: 0.6, esc: salsa ? 1 : 0.8 });
      V3.sfx(salsa ? 'splash' : 'pop');
      V.est.pop = Math.max(V.est.pop, 0.8);
    }
    /* dónde va el cliente i (según mi fila): servido -> se queda un momento celebrando y se va; ido -> patalea y se va; de turno -> mostrador; esperando -> cola; por llegar -> viene caminando */
    function sitioCliente(i, now) {
      var m = me(), sp = spot(), o = ord[m], V = v3;
      if (i < o) {
        if (V.servT[i] !== undefined && absT - V.servT[i] < STAY) return sitioStay();
        if (V.idoAt[i] !== undefined && absT - V.idoAt[i] < 0.9) return { x: sp.x, z: sp.z };
        return SALIDA;
      }
      if (CL[i].t > now) return ENTRA;
      var j = 0, q2; for (q2 = o; q2 < i; q2++) if (CL[q2].t <= now) j++;
      return j === 0 ? sp : { x: sp.x + sp.qx * j, z: sp.z + sp.qz * j };
    }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, m = me(), i, k, termino = now >= dur, oscuro = luzFuera(now), fz = faseDe(cl(now, 0, dur)), ck = V.ck;
      encuadra();
      eventos3D();
      V.part.update(dt);
      ck.bump = Math.max(0, ck.bump - dt * 4); ck.shake = Math.max(0, ck.shake - dt * 2.5); ck.triste = Math.max(0, ck.triste - dt); ck.hop = Math.max(0, ck.hop - dt * 2.2);
      /* los potes: el viento los mueve a su casilla nueva (vuelan en arco); el elegido sube y baila; el que se usa da un saltito */
      for (i = 0; i < 6; i++) {
        var po = V.potes[i], s0 = casillaDe(po.k), dest = binPos(s0), on = sel[m] === s0;
        if (po.de === null) po.de = { x: dest.x, z: dest.z };
        if (Math.abs(po.x - dest.x) + Math.abs(po.z - dest.z) > 0.01 && po.hT < 0) { po.hT = t; po.de = { x: po.x, z: po.z }; }
        var hu = po.hT >= 0 ? Math.min(1, (t - po.hT) / 0.45) : 1, arco = 0;
        if (po.hT >= 0) { po.x = po.de.x + (dest.x - po.de.x) * hu; po.z = po.de.z + (dest.z - po.de.z) * hu; arco = Math.sin(hu * Math.PI) * 2.2; if (hu >= 1) { po.hT = -9; po.x = dest.x; po.z = dest.z; } }
        po.alto += ((on ? 0.45 : 0) - po.alto) * Math.min(1, dt * 14);
        po.bump = Math.max(0, po.bump - dt * 3.5); po.shake = Math.max(0, po.shake - dt * 2.2);
        po.g.position.set(po.x, CY + po.alto + arco + po.bump * 0.18 + (on ? Math.sin(t * 6) * 0.06 : 0), po.z);
        po.g.rotation.y = on ? Math.sin(t * 3) * 0.25 : arco * 2;
        po.g.rotation.z = po.shake > 0 ? Math.sin(t * 45) * 0.16 * po.shake : 0;
        po.g.scale.set(1 + po.bump * 0.12, 1 - po.bump * 0.16, 1 + po.bump * 0.12);
        po.aro.position.set(dest.x, CY + 0.03, dest.z); po.guia.position.set(dest.x, CY + 0.025, dest.z);
        po.aro.material.opacity = on ? 0.8 + 0.2 * Math.abs(Math.sin(t * 5)) : 0;
      }
      var sqm = ord[m] < NC ? seqOf(ord[m], cam[m]) : [], objetivo = ord[m] < NC && llegado(ord[m], now) && !mal[m] && ((lv === 1 && fz === 0) || ayudaT > 0) ? casillaDe(sqm[paso[m]]) : -1;
      for (i = 0; i < 6; i++) {
        var pg = V.potes[i], sg2 = pg.g.userData.sign, hl = pg.g.userData.halo, s5 = casillaDe(pg.k), sel5 = sel[m] === s5, obj5 = s5 === objetivo;
        pg.guia.material.opacity = obj5 ? 0.35 + 0.35 * Math.abs(Math.sin(t * 6)) : 0;
        hl.visible = sel5 || obj5; hl.material.color.set(sel5 ? '#ffe14d' : '#ffffff'); hl.material.opacity = sel5 ? 1 : 0.5 + 0.4 * Math.abs(Math.sin(t * 7));
        sg2.scale.setScalar(sel5 ? 1.18 + Math.sin(t * 8) * 0.04 : obj5 ? 1.08 + Math.sin(t * 8) * 0.03 : 1);
        sg2.rotation.x = -0.95 + (obj5 ? Math.sin(t * 8) * 0.07 : 0);
        pg.g.userData.ic.material.color.set(oscuro && !sel5 ? '#1a1a26' : '#ffffff');
      }
      for (i = 0; i < EV.length; i++) {
        var ev = EV[i];
        if (ev.k === 'viento' && now >= ev.t - AV_V && now < ev.t) {
          V.polvoT -= dt;
          if (V.polvoT < 0) { V.polvoT = 0.05; var pa2 = binPos(ev.a), pb = binPos(ev.b), u2 = c.fx(); V.part.soltar(pa2.x + (pb.x - pa2.x) * u2, CY + 0.6, pa2.z + (pb.z - pa2.z) * u2, 2, { k: 'gota', cols: ['#e8dcc0', '#fffdf2'], vel: 2.5, arriba: 1.5, g: 1, vida: 0.7, esc: 0.9 }); }
          V.potes.forEach(function (pq) { var s1 = casillaDe(pq.k); if (s1 === ev.a || s1 === ev.b) pq.g.rotation.z = Math.sin(t * 30) * 0.12; });
        }
      }
      /* flecha sobre el pote elegido */
      var sp2 = sel[m] >= 0 ? binPos(sel[m]) : null;
      V.flecha.visible = !!sp2 && ord[m] < NC;
      if (sp2) V.flecha.position.set(sp2.x, CY + 2.9 + Math.sin(t * 7) * 0.15, sp2.z);
      V.flecha.rotation.y = t * 2;
      /* los ingredientes en vuelo */
      for (k = 0; k < 6; k++) {
        var vu = V.vuelan[k], u = (t - vu.t0) / FLY;
        if (u < 0 || u > 1) { if (vu.g.visible && u > 1) { vu.g.visible = false; aterriza(vu); } continue; }
        vu.g.visible = true; vu.g.position.lerpVectors(vu.de, vu.a, u); vu.g.position.y += Math.sin(u * Math.PI) * 1.4; vu.g.rotation.y = u * 6;
      }
      /* el perro y la entrega (el perro listo vuela a la mano del cliente) */
      var s = V.est, D = V.D, eu = (t - s.entT) / ENT, sp = spot();
      s.pop = Math.max(0, s.pop - dt * 4);
      if (eu >= 0 && eu < 1) {
        pintaPerro(D, s.entSeq, s.entSeq.length, 0, -1, s.land);
        var w2 = Math.max(0, (eu - 0.35) / 0.65), ew = w2 * w2 * (3 - 2 * w2);
        D.g.position.set(sp.x * 0.85 * ew, CY + 0.1 + Math.sin(ew * Math.PI) * 1.8, DOGZ + (sp.z - DOGZ) * ew); D.g.scale.setScalar(DS * (1 - 0.6 * ew)); D.g.rotation.z = ew * 0.6;
      } else {
        var nu = Math.min(1, Math.max(0, (t - s.entT - ENT) / 0.2));
        D.g.position.set(0, CY + 0.1, DOGZ); D.g.rotation.z = 0; D.g.scale.setScalar(DS * (s.entT > 0 && t - s.entT < ENT + 0.2 ? nu : 1) * (1 + s.pop * 0.12));
        pintaPerro(D, sqm.length ? sqm : [0], paso[m], mal[m], bad[m], s.land);
      }
      D.g.visible = ord[m] < NC || eu < 1;
      D.x.rotation.y = Math.sin(t * 8) * 0.2;
      if (mal[m]) D.g.rotation.z = Math.sin(t * 40) * 0.05;
      /* el perrero: baila al ritmo mientras espera, se inclina hacia el pote, se encoge al lanzar y se sacude con el error */
      var cara = 'concentrado', an = 'quieto', W = V.cookW, llega = ord[m] < NC && llegado(ord[m], now), beat = Math.abs(Math.sin(t * Math.PI * BPM[fz] / 60));
      if (termino || ord[m] >= NC) { an = srv[m] > 0 ? 'celebrar' : 'triste'; cara = srv[m] > 0 ? 'feliz' : 'triste'; }
      else if (now < 0) { an = 'saludar'; cara = 'feliz'; }
      else if (mal[m] || badT[m] > 0 || ck.shake > 0.3 || espejoOn(now)) { cara = 'susto'; an = 'mareado'; }
      else if (ck.triste > 0) { cara = 'triste'; an = 'triste'; }
      else if (okT[m] > 0) cara = 'feliz';
      else if (!llega) { an = 'bailar'; cara = 'feliz'; }
      V.cook.anim(an).cara(cara).rumbo(0);
      var bp = sel[m] >= 0 ? binPos(sel[m]) : { x: 0, z: 1.2 };
      if (!(now < 0)) V.cook.mirar(bp.x * 0.3, -0.5); else V.cook.mirar(0, -0.2);
      W.rotation.y += (cl(bp.x * 0.1, -0.3, 0.3) - W.rotation.y) * Math.min(1, dt * 9);
      W.position.set(COOK.x + bp.x * 0.06, COOK.y + beat * (an === 'bailar' ? 0.02 : 0.05) + ck.hop * Math.abs(Math.sin(ck.hop * 6)) * 0.25, COOK.z + (ck.bump > 0.3 ? 0.12 : 0));
      W.scale.set(1 + ck.bump * 0.05, 1 - ck.bump * 0.07, 1 + ck.bump * 0.05); W.rotation.z = Math.sin(t * 45) * 0.07 * ck.shake;
      V.cook.update(dt);
      /* los clientes (5 personajes que se turnan) */
      var o = ord[m], st0;
      if (o < NC && llegado(o, now) && V.shout !== o) {
        V.shout = o; V.shoutT = absT; var egg = !!CL[o].huevo;
        dicen(o, fraseDe(o), egg ? 'egg' : CL[o].vip ? 'vip' : CL[o].imp ? 'prisa' : 'grito', egg ? 2.8 : 2.4);
        V3.sfx(egg ? 'resbalon' : 'silbido');
        if (egg) { var Ce = clienteDe(o) || V.clientes[o % 5]; V.part.soltar(Ce.x, 3.1, Ce.z, 12, { k: 'gota', cols: ['#8fd8ff', '#ffffff'], vel: 2.4, arriba: 2.5, vida: 0.7, esc: 0.7 }); V.part.soltar(Ce.x, 3.4, Ce.z, 10, { k: 'chispa', cols: ['#ffe14d', '#ff8ac0'], vel: 3, arriba: 3, vida: 0.8 }); V.esc.sacudir(0.35); ck.shake = 0.7; }
      }
      for (k = 0; k < 5; k++) {
        var C = V.clientes[k], want = -1, j2;
        for (j2 = o - 2; j2 <= o + 2; j2++) if (j2 >= 0 && j2 < NC && ((j2 % 5) + 5) % 5 === k) want = j2;
        if (want >= 0 && want >= o && CL[want].t - now > 1.6) want = -1;      // todavía muy lejos
        if (want !== C.cur) { C.cur = want; st0 = want >= 0 && CL[want].t <= now - 0.1 && want >= o ? sitioCliente(want, now) : ENTRA; C.x = C.px = st0.x; C.z = C.pz = st0.z; }
        if (want < 0) { C.w.visible = false; continue; }
        var st = sitioCliente(want, now), dx = st.x - C.x, dz = st.z - C.z, dd = Math.sqrt(dx * dx + dz * dz), enojado = want < o && V.idoAt[want] !== undefined, lim = (enojado ? 6.5 : fz === 2 ? 5 : 4) * dt;
        if (dd > lim) { C.x += dx / dd * lim; C.z += dz / dd * lim; } else { C.x = st.x; C.z = st.z; }
        var vx = (C.x - C.px) / Math.max(dt, 1e-3), vz = (C.z - C.pz) / Math.max(dt, 1e-3), vv = Math.sqrt(vx * vx + vz * vz); C.px = C.x; C.pz = C.z;
        var servido = V.servT[want] !== undefined, fuera = st === SALIDA && dd < 0.1, egg2 = !!CL[want].huevo, ph = C.ph + t;
        C.w.visible = !fuera;
        if (fuera) continue;
        C.mini.visible = servido && absT - s.entT > ENT * 0.9 && absT - V.servT[want] < 9;
        C.cor.visible = !!CL[want].vip; C.cor.rotation.y = t * 2;
        var cc = 'normal', ca = vv > 0.3 ? 'caminar' : 'quieto', rum = vv > 0.3 ? Math.atan2(vx, vz) : -1.3, bob = 0, tilt = 0, wob = 0, mx2 = -0.6, my2 = -0.2, sq3 = 1, ve = Math.min(1, vv / 5);
        C.sus = Math.max(0, (C.sus || 0) - dt);
        if (want < o) {
          if (servido) {
            cc = 'feliz';
            if (vv < 0.3) { ca = egg2 ? 'bailar' : 'celebrar'; rum = -1.3 + Math.sin(t * 5) * 0.4; sq3 = 1 + Math.abs(Math.sin(t * 9)) * 0.03; }
            else { ca = 'caminar'; bob = Math.abs(Math.sin(t * 9)) * 0.1; ve = 0.9; mx2 = 0; }
          } else { cc = 'enojado'; if (vv < 0.3) { ca = 'quieto'; bob = Math.abs(Math.sin(t * 16)) * 0.14; wob = Math.sin(t * 22) * 0.08; } else { ca = 'correr'; ve = 1; } }
        } else if (want === o && st !== ENTRA && vv < 0.3) {
          var pc = paciencia(o, now), tt = absT - V.shoutT;
          if (termino) { cc = 'enojado'; ca = 'triste'; }
          else if (C.sus > 0) { ca = 'susto'; cc = 'susto'; tilt = -0.12; }
          else if (egg2 && tt < 2.8) { ca = 'mareado'; cc = 'mareado'; tilt = -0.16 + Math.sin(t * 9) * 0.05; wob = Math.sin(t * 13) * 0.03; }
          else if (tt < 1.0) { ca = 'saludar'; cc = 'feliz'; bob = Math.abs(Math.sin(tt * 9)) * 0.06; }
          else if (mal[m] || badT[m] > 0) { cc = 'enojado'; ca = 'quieto'; wob = Math.sin(t * 20) * 0.05; }
          else if (okT[m] > 0) { cc = 'feliz'; tilt = 0.1; bob = Math.abs(Math.sin(t * 14)) * 0.05; }
          else if (pc < 0.3) {
            cc = 'enojado'; ca = pc < 0.12 ? 'gritar' : 'quieto'; bob = Math.abs(Math.sin(t * 13)) * 0.1; wob = Math.sin(t * 17) * 0.05;
            C.puf -= dt; if (C.puf < 0) { C.puf = 0.28; V.part.soltar(C.x, 3.3, C.z, 2, { k: 'gota', cols: ['#ff6a5a', '#ffd0c0'], vel: 1.4, arriba: 2.2, vida: 0.5, esc: 0.7 }); }
          }
          else if (pc < 0.6) { cc = 'concentrado'; bob = Math.max(0, Math.sin(t * 6)) * 0.05; tilt = Math.sin(t * 1.4) * 0.04; }
          else { tilt = 0.04 + Math.sin(ph * 1.1) * 0.02; }
          my2 = -0.35;
        } else if (want > o && vv < 0.3) {
          cc = (want - o) > 2 ? 'concentrado' : 'normal'; tilt = Math.sin(ph * 1.2) * 0.04; bob = Math.max(0, Math.sin(ph * 4)) * 0.025; wob = Math.sin(ph * 0.8) * 0.02;
        }
        C.pj.anim(ca, { vel: ve }).cara(cc).rumbo(rum).mirar(mx2, my2);
        C.w.position.set(C.x, bob, C.z); C.w.rotation.set(0, 0, tilt + wob); C.w.scale.set(1, sq3, 1); C.pj.update(dt);
      }
      /* la gente que pasa por la acera de atrás */
      for (k = 0; k < V.andan.length; k++) {
        var A = V.andan[k]; A.x += A.dir * A.v * dt; if (A.x > 26) A.x = -26; if (A.x < -26) A.x = 26;
        A.w.position.set(A.x, 0, A.z); A.pj.anim('caminar', { vel: 0.5 }).cara('normal').rumbo(A.dir > 0 ? 1.57 : -1.57); A.pj.update(dt);
      }
      for (k = 0; k < V.banderas.length; k++) V.banderas[k].rotation.z = Math.sin(t * 3.2 + k * 0.8) * 0.28;
      /* el perrito: echado, olfatea y mueve la cola; con el aviso corre ladrando al carrito; si nadie dice ¡CHU! salta y se lleva la salchicha */
      var gt = V.gato, pe = -1, pr = 0, tx = -4.7, tz = 1.6, gy = 0, velg = 3;
      for (i = 0; i < PER.length; i++) if (now >= PER[i].t - AV_P && now < PER[i].t + 2.5) pe = i;
      if (pe >= 0) {
        var ep = PER[pe], dtp = now - ep.t; pr = perRes[m][pe] || 0;
        if (dtp < 0) { tx = -3.9; tz = 0.4; velg = 7; }
        else if (pr === 2 && dtp < 0.45) { var jj = dtp / 0.45; tx = -3.9 + 3.9 * jj; tz = 0.4 + (DOGZ - 0.4) * jj; gy = CY + Math.sin(jj * Math.PI) * 1.2; velg = 99; gt.x = tx; gt.z = tz; }
        else { tx = -14; tz = 3; velg = pr === 1 ? 11 : 8; }
      }
      var gdx = tx - gt.x, gdz = tz - gt.z, gd = Math.sqrt(gdx * gdx + gdz * gdz), gl = velg * dt;
      if (gd > gl) { gt.x += gdx / gd * gl; gt.z += gdz / gd * gl; } else { gt.x = tx; gt.z = tz; }
      if (gd < 0.05 && pe < 0 && Math.abs(gt.x - -4.7) > 3) { gt.x = -4.7; gt.z = 1.6; }
      var corre = gd > 0.05, sa = t - gt.salto, ladrando = pe >= 0 && now < PER[pe].t;
      gt.g.position.set(gt.x, Math.max(gy, sa < 0.5 ? Math.sin(sa / 0.5 * Math.PI) * 0.9 : 0, ladrando && !corre ? Math.abs(Math.sin(t * 14)) * 0.25 : 0, corre ? Math.abs(Math.sin(t * 13)) * 0.18 : 0), gt.z);
      gt.g.rotation.y = corre ? Math.atan2(-(gdz), gdx) : 0.54;
      gt.boca.visible = pe >= 0 && pr === 2 && now >= PER[pe].t;
      gt.cola.rotation.x = Math.sin(t * (corre || ladrando ? 24 : 9)) * 0.6;
      for (i = 0; i < 4; i++) gt.patas[i].rotation.z = corre ? Math.sin(t * 20 + i * 1.6) * 0.6 : 0;
      gt.cuerpo.rotation.z = ladrando && !corre ? Math.sin(t * 28) * 0.09 : Math.sin(t * 2) * 0.03 + (Math.floor(t * 0.35) % 3 === 0 ? Math.sin(t * 5) * 0.08 : 0);
      gt.cuerpo.position.y = corre ? 0 : Math.sin(t * 2.4) * 0.015;
      /* los carros: más tráfico y más rápido con la hora pico */
      for (k = 0; k < V.autos.length; k++) {
        var ida = k % 2 === 0, vel = (6 + k * 2.2) * (1 + fz * 0.45); V.autoX[k] += vel * dt;
        var xx = (V.autoX[k] % 90) - 45; V.autos[k].visible = k < 2 + fz;
        V.autos[k].position.set(ida ? xx : -xx, 0, ida ? -8.2 : -10.8); V.autos[k].rotation.y = ida ? 0 : Math.PI;
      }
      V.humoT -= dt;
      if (V.humoT < 0) { V.humoT = 0.16; V.part.soltar(-3.0 + (c.fx() - 0.5) * 0.4, 2.7, -2.0, 1, { k: 'gota', cols: ['#ffffff', '#e8eef5'], vel: 0.3, arriba: 0.7, g: -1.2, vida: 1.3, esc: 1.5, suelo: false }); }
      /* luces: fase (los bombillos se aceleran), aviso de apagón (parpadeo) y apagón (solo la linterna del pote elegido) */
      var avisoLuz = false;
      for (i = 0; i < EV.length; i++) if (EV[i].k === 'luz' && now >= EV[i].t - AV_L && now < EV[i].t) avisoLuz = true;
      var parpa = avisoLuz && Math.floor(t * 14) % 3 === 0, kL = oscuro ? 0.16 : parpa ? 0.45 : 1;
      V.luzK += (kL - V.luzK) * Math.min(1, dt * (oscuro || parpa ? 30 : 4));
      var tinte = fz === 2 ? 1 + Math.abs(Math.sin(t * 6)) * 0.12 : 1;
      V.esc.luces.hemi.intensity = V.base.hemi * V.luzK * tinte; V.esc.luces.sol.intensity = V.base.sol * V.luzK;
      var vf = [2.5, 6, 12][fz], fa = Math.floor(t * vf) % 2, enc = oscuro ? 0 : (V.pl.noche ? 1.8 : 0.9) * (parpa ? 0.2 : 1);
      V.focos[0].emissiveIntensity = fa ? enc : enc * 0.4; V.focos[1].emissiveIntensity = fa ? enc * 0.4 : enc;
      V.lamps.forEach(function (lm) { lm.emissiveIntensity = oscuro ? 0 : V.pl.noche ? 1.6 : 0.2; });
      V.lc.intensity = oscuro ? 0 : V.pl.noche ? 1.3 : 0;
      if (oscuro && sp2) { V.linterna.intensity = 2.6; V.linterna.position.set(sp2.x, CY + 2.2, sp2.z + 0.4); } else V.linterna.intensity = 0;
      if (V.pl.noche) for (k = 0; k < V.polilla.length; k++) { var lz = V.luces[k % V.luces.length]; V.polilla[k].position.set(lz.x + Math.cos(t * (3 + k) + k) * 0.7, lz.y - 0.3 + Math.sin(t * (5 + k)) * 0.3, lz.z + Math.sin(t * (3 + k) + k) * 0.7); }
    }
    /* globo de un cliente: estilo según quién habla y qué siente; sale con un rebote y se desvanece */
    var BUB = {
      grito: { bg: '#fffdf2', fg: INKC, sz: 21, tr: 0 }, vip: { bg: '#ffd23f', fg: '#6a2400', sz: 21, tr: 0 }, prisa: { bg: '#ffb030', fg: INKC, sz: 20, tr: 0 },
      egg: { bg: '#ff8ac0', fg: '#fffdf2', sz: 26, tr: INKC }, bravo: { bg: '#ff5c5c', fg: '#fffdf2', sz: 19, tr: INKC }, feliz: { bg: '#8cf0a0', fg: '#0a3a1a', sz: 19, tr: 0 }
    };
    function globo(it, burst, sy, C, L, yMin, forzado) {
      var u = (absT - sy.t0) / sy.dur, B = BUB[sy.st] || BUB.grito, r, pt, k, x, y, a = 1;
      if (u < 0 || u > 1 || !C) { hOff(it); if (burst) hOff(burst); return; }
      r = hTxt(sy.s, { sz: B.sz, bg: B.bg, fg: B.fg, tr: B.tr, cola: 1, mw: Math.min(L.w - 12, 230) });
      hSet(it, r);
      pt = v3.esc.proyectar(C.x, 3.55, C.z);
      k = u < 0.12 ? 0.4 + 0.75 * (u / 0.12) : u < 0.2 ? 1.15 - 0.15 * ((u - 0.12) / 0.08) : 1;
      if (u > 0.86) a = (1 - u) / 0.14;
      x = cl(pt.x, L.x0 + r.w / 2 + 4, L.x1 - r.w / 2 - 4); y = Math.max(pt.y - r.h / 2 - 2, yMin + r.h / 2);
      hAt(it, x, y, k, a, sy.st === 'egg' ? Math.sin(absT * 16) * 0.05 : 0);
      if (burst) { if (sy.st === 'egg') { burst.w = burst.h = r.w * 0.95; hAt(burst, x, y - 4, k, a * 0.9, absT * 1.4); } else hOff(burst); }
    }
    /* los carteles de pantalla: comanda, globos, avisos. Cada cosa en su zona para que nada se amontone */
    function hud3D(L, now) {
      var V = v3, H = V.HU, m = me(), cam2 = V.esc.camera, hh = HD * Math.tan(cam2.fov * Math.PI / 360), hw = hh * cam2.aspect, i, k, r;
      HK.ky = hh / 300; HK.kx = hw / (L.w / 2); HK.cx = L.cx;
      var o = ord[m], hay = o < NC, llega = hay && llegado(o, now), sq = llega ? seqOf(o, cam[m]) : [], jug = now >= 0 && now < dur, fz = faseDe(cl(now, 0, dur));
      var vert = L.w < 560, PW = cl(L.w - 10, 280, 350), sc = PW / 330, pcx = vert ? L.cx : L.x0 + 8 + PW / 2, px0 = pcx - PW / 2, top = 60, abajo = vert ? top + 134 * sc : 62;
      function PX(u) { return px0 + u * sc; }
      function PY(v) { return top + v * sc; }
      hAt(H.panel, pcx, PY(66), sc, 1);
      var tag = hay ? 'PEDIDO ' + (o + 1) + (CL[o].crit ? ' · CRÍTICO ×3' : CL[o].vip ? ' · VIP ×2' : CL[o].imp ? ' · ¡CON PRISA!' : '') + (cam[m] ? ' · ¡CAMBIÓ!' : '') : 'SIN MÁS CLIENTES';
      hSet(H.cab, hTxt(tag, { sz: 14, fg: hay && CL[o].vip ? '#ffd23f' : '#fffdf2', tr: 0, mw: 200, pad: 2 })); hAt(H.cab, PX(105), PY(11), sc);
      if (jug) { hSet(H.fase, hTxt(fz === 2 ? '¡ÚLTIMOS!' : FASES[fz].n, { sz: 11, fg: FASES[fz].col, tr: 0, mw: 110, pad: 2 })); hAt(H.fase, PX(272), PY(11), sc); } else hOff(H.fase);
      if (llega && jug && sq.length) {
        var cur = sq[Math.min(paso[m], sq.length - 1)], act0 = !mal[m], pul = 1 + (act0 ? Math.sin(absT * 7) * 0.03 : 0);
        hAt(H.gTile, PX(50), PY(72), sc * pul, 1);
        H.gIc.m.material.map = iconSolo(cur); hAt(H.gIc, PX(50), PY(59), sc * pul, 1);
        hSet(H.gNom, hTxt(ING[cur].n, { sz: 15, fg: ING[cur].tx, bg: ING[cur].col, tr: 0, mw: 84, pad: 5 })); hAt(H.gNom, PX(50), PY(103), sc, 1);
        var filas = sq.length > 3 ? 2 : 1;
        for (i = 0; i < 6; i++) {
          var P = H.pas[i];
          if (i >= sq.length) { hOff(P.bg); hOff(P.ic); hOff(P.nu); hOff(P.ok); continue; }
          var col = i % 3, fila = Math.floor(i / 3), cx2 = PX(138 + col * 76), cy2 = PY(filas === 1 ? 72 : fila ? 96 : 48), act = i === paso[m] && !mal[m], hecho = i < paso[m], ps = act ? 1.1 + Math.sin(absT * 7) * 0.03 : 1;
          P.bg.w = 66; P.bg.h = filas === 1 ? 52 : 42; P.ic.w = P.ic.h = filas === 1 ? 40 : 34;
          P.bg.m.material.map = act ? hEst('tileOn') : hEst('tile'); P.ic.m.material.map = iconSolo(sq[i]);
          hAt(P.bg, cx2, cy2, sc * ps, hecho ? 0.55 : 1); hAt(P.ic, cx2, cy2, sc * ps, hecho ? 0.5 : 1);
          hAt(P.nu, cx2 - 26 * sc, cy2 - (P.bg.h / 2 - 3) * sc, sc, 1);
          if (hecho) hAt(P.ok, cx2 + 8 * sc, cy2 + 5 * sc, sc, 1); else hOff(P.ok);
        }
        hOff(H.mid);
        var pc = paciencia(o, now), bw = 218 * Math.max(0.02, pc);
        H.barBg.w = 228; hAt(H.barBg, PX(122), PY(123), sc, 1);
        H.bar.w = bw; H.bar.h = 7; H.bar.m.material.color.set(pc > 0.5 ? '#3ac46a' : pc > 0.25 ? '#ffb030' : '#ff4a4a'); hAt(H.bar, PX(13) + bw * sc / 2, PY(123), sc, 1);
        var cola = 0; for (k = o + 1; k < NC; k++) if (CL[k].t <= now) cola++;
        if (cola > 0) { hSet(H.cola, hTxt('+' + cola + ' EN COLA', { sz: 12, fg: cola >= 3 ? '#ffb0a0' : '#fffdf2', bg: '#14101c', bd: '#14101c', tr: 0, pad: 6 })); hAt(H.cola, PX(284), PY(123), sc, 1); } else hOff(H.cola);
      } else {
        hOff(H.gTile); hOff(H.gIc); hOff(H.gNom); hOff(H.barBg); hOff(H.bar); hOff(H.cola);
        for (i = 0; i < 6; i++) { hOff(H.pas[i].bg); hOff(H.pas[i].ic); hOff(H.pas[i].nu); hOff(H.pas[i].ok); }
        hSet(H.mid, hTxt(now >= dur ? '¡SE ACABÓ!' : hay ? (jug ? '¡YA VIENE EL CLIENTE!' : '¡A ATENDER!') : 'SIN MÁS CLIENTES', { sz: 20, fg: INKC, tr: 0, mw: 300 })); hAt(H.mid, PX(165), PY(72), sc, 1);
      }
      /* globos de los clientes: el de turno (grito, impaciencia) y el que se va */
      var turnoSay = null, otroSay = null, sy;
      for (i = V.say.length - 1; i >= 0; i--) { sy = V.say[i]; if (absT - sy.t0 > sy.dur) continue; if (sy.i === o) { if (!turnoSay) turnoSay = sy; } else if (!otroSay) otroSay = sy; }
      var hintOn = hintT > 0 || oscuro3(now) || (now < 4 && now > -3), yMin = abajo + 6 + (vert && hintOn ? 48 : 0);
      if (!turnoSay && llega && jug) { var pc2 = paciencia(o, now); if (pc2 < 0.3) turnoSay = { i: o, s: pc2 < 0.12 ? '¡ME VOY, PANA!' : '¡APÚRATE, PANA!', st: pc2 < 0.12 ? 'bravo' : 'prisa', t0: absT - 0.5, dur: 1.5 + 0.5 }; }
      var cupo = 2;                                            // máximo 2 globos a la vez: primero el del cliente de turno
      if (turnoSay) { globo(H.bubA, H.burst, turnoSay, clienteDe(o), L, yMin); cupo--; } else { hOff(H.bubA); hOff(H.burst); }
      var perAv = perroAviso(now) >= 0, quiereMalo = mal[m] && hay && !(bigT > 0), quiereViento = false;
      for (i = 0; i < EV.length; i++) if (EV[i].k === 'viento' && now >= EV[i].t - AV_V && now < EV[i].t) quiereViento = true;
      var usaGuau = perAv && cupo > 0; if (usaGuau) cupo--;
      var usaMalo = quiereMalo && cupo > 0; if (usaMalo) cupo--;
      var usaOtro = !!otroSay && cupo > 0; if (usaOtro) cupo--;
      var usaViento = quiereViento && cupo > 0; if (usaViento) cupo--;
      if (usaOtro) globo(H.bubB, null, otroSay, clienteDe(otroSay.i), L, yMin); else hOff(H.bubB);
      /* avisos grandes */
      if (bigT > 0 && big) {
        var age = absT - (big.t0 || absT), ks = Math.min(1.05, 0.5 + age * 2.8), pz = 1 + Math.sin(absT * 18) * 0.03;
        hSet(H.big, hTxt(big.s, { sz: 24, fg: big.col, mw: L.w - 14 })); hAt(H.big, L.cx, vert ? 436 : 150, ks * pz, Math.min(1, bigT * 3));
      } else hOff(H.big);
      var ay = vert ? abajo + 24 : 556;
      if (hintT > 0) { hSet(H.hint, hTxt(hintS, { sz: 16, fg: '#ffe14d', bg: 'rgba(20,16,28,.88)', tr: 0, mw: L.w - 12 })); hAt(H.hint, L.cx, ay, 1, 1); }
      else if (oscuro3(now)) { hSet(H.hint, hTxt('APAGÓN: APUNTA PARA VER EL POTE', { sz: 15, fg: '#ffd23f', bg: 'rgba(20,16,28,.88)', tr: 0, mw: L.w - 12 })); hAt(H.hint, L.cx, ay, 1, 1); }
      else if (espejoOn(now)) { hSet(H.hint, hTxt('MAREO: EL STICK VA AL REVÉS', { sz: 15, fg: '#ff8ad0', bg: 'rgba(20,16,28,.88)', tr: 0, mw: L.w - 12 })); hAt(H.hint, L.cx, ay, 1, 1); }
      else if (now < 4 && now > -3) { hSet(H.hint, hTxt('APUNTA AL POTE · A LO ECHA · B ¡CHU!', { sz: 15, fg: '#fffdf2', bg: 'rgba(20,16,28,.88)', tr: 0, mw: L.w - 12 })); hAt(H.hint, L.cx, ay, 1, 1); }
      else hOff(H.hint);
      if (chicoT > 0 && chico && !(vert && bigT > 0) && cupo > 0) { hSet(H.chico, hTxt(chico.s, { sz: 16, fg: chico.col, bg: 'rgba(20,16,28,.88)', tr: 0, mw: L.w - 12 })); hAt(H.chico, L.cx, vert ? 436 : ay - 32, 1, Math.min(1, chicoT * 3)); } else hOff(H.chico);
      if (usaMalo) {
        r = hTxt(bad[m] === -2 ? '¡SE LLEVÓ LA SALCHICHA!' : '¡ESE NO! OTRA VEZ…', { sz: 16, fg: '#fffdf2', bg: '#e0222e', tr: 0, mw: L.w - 12, cola: 1 });
        var pm = V.esc.proyectar(0, CY + 2.3, DOGZ); hSet(H.malo, r); hAt(H.malo, cl(pm.x, L.x0 + r.w / 2 + 4, L.x1 - r.w / 2 - 4), pm.y - r.h / 2, 1 + Math.sin(absT * 20) * 0.03, 1);
      } else hOff(H.malo);
      if (popPtsT > 0 && popPts) {
        var sp = spot(), pp2 = V.esc.proyectar(sp.x + 0.3, 3.9 + (1.1 - popPtsT) * 1.4, sp.z + 1.5); hSet(H.pop, hTxt(popPts.s, { sz: 30, fg: popPts.col })); hAt(H.pop, cl(pp2.x, L.x0 + 40, L.x1 - 40), pp2.y, 1, Math.min(1, popPtsT * 2.5));
      } else hOff(H.pop);
      /* el perrito: ladra y avisa qué hacer */
      var pe = perroAviso(now);
      if (pe >= 0 && usaGuau) {
        var ya = bT[m] >= PER[pe].t - AV_P - 0.05, pg2 = V.esc.proyectar(V.gato.x - 0.4, 3.3, V.gato.z), rg = hTxt(ya ? '¡CHU!' : '¡GUAU! ¡DALE B!', { sz: 19, fg: ya ? '#0a3a1a' : INKC, bg: ya ? '#8cf0a0' : '#ffd23f', tr: 0, cola: 1 });
        hSet(H.guau, rg); hAt(H.guau, cl(pg2.x, L.x0 + rg.w / 2 + 4, L.x1 - rg.w / 2 - 4), Math.max(pg2.y - rg.h / 2, abajo + rg.h / 2 + 4), ya ? 1 : 1 + Math.abs(Math.sin(absT * 14)) * 0.12, 1);
      } else hOff(H.guau);
      /* el ventarrón: los dos potes que se cambian se señalan */
      for (k = 0; k < 2; k++) hOff(H.vien[k]);
      for (i = 0; i < EV.length; i++) {
        var ev = EV[i];
        if (usaViento && ev.k === 'viento' && now >= ev.t - AV_V && now < ev.t) {
          for (k = 0; k < 2; k++) {
            var pq = binPos(k ? ev.b : ev.a), pv = V.esc.proyectar(pq.x, CY + 2.0, pq.z), rv = hTxt('¡CAMBIA!', { sz: 15, fg: INKC, bg: '#8fd8ff', tr: 0, cola: 1 });
            hSet(H.vien[k], rv); hAt(H.vien[k], cl(pv.x, L.x0 + rv.w / 2 + 4, L.x1 - rv.w / 2 - 4), pv.y - rv.h / 2, 1 + Math.abs(Math.sin(absT * 12)) * 0.1, 1);
          }
        }
      }
    }
    function oscuro3(now) { return luzFuera(now); }
    function dibujar3D(L) {
      var dt = Math.max(0, Math.min(0.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), fz = faseDe(cl(now, 0, dur)); v3T = absT;
      if (dt > 0) actualizar3D(dt, now);
      if (now >= 0 && now < dur) V3.musica(['perro', 'perro2', 'perro3'][fz]);
      hud3D(L, now);
      v3.esc.render(dt);
      if (typeof drawP === 'function') drawP();
    }

    var g = {
      update: function (dt) {
        var now = c.ahora();
        absT += dt; ayudaT = Math.max(0, ayudaT - dt); bigT = Math.max(0, bigT - dt); chicoT = Math.max(0, chicoT - dt); popPtsT = Math.max(0, popPtsT - dt); shake = Math.max(0, shake - dt * 3); hintT = Math.max(0, hintT - dt);
        if (now >= 0) aplicaEventos(now);
        anuncios(now);
        for (var q2 = 0; q2 < n; q2++) {
          pop[q2] = Math.max(0, pop[q2] - dt * 5); okT[q2] = Math.max(0, okT[q2] - dt); badT[q2] = Math.max(0, badT[q2] - dt);
          if (!c.mio(q2) || now < 0 || now > dur) continue;
          reglasTiempo(q2, now);
          var e = c.eje(q2);
          if (espejoOn(now)) e = { x: -e.x, y: e.y };
          if (e.x * e.x + e.y * e.y >= DEADZ * DEADZ) sel[q2] = slotDe(e);
          var ka = c.tap(q2, 'a'), kb = c.tap(q2, 'b'), u;
          for (u = 0; u < kb; u++) chu(q2, now);
          for (u = 0; u < ka; u++) agrega(q2, now);
        }
      },

      /* CPU: 0,5-0,9 s por ingrediente según skill (más lenta y con más errores en el apagón; duda tras el ventarrón);
         con el aviso del perrito da B con probabilidad .55-.95 según skill */
      ai: function (q2, dt, api) {
        var now = c.ahora(), sk = c.skill[q2];
        var R = crng[q2] || (crng[q2] = c.rngFor('cpu' + q2));
        if (now < 0 || ord[q2] >= NC) return;
        var pe = perroAviso(now);
        if (pe >= 0 && cpuP[q2] !== pe) { cpuP[q2] = pe; cpuPT[q2] = R.next() < 0.55 + 0.4 * sk ? PER[pe].t - AV_P + 0.3 + R.next() * 0.6 : 1e9; }
        if (pe >= 0 && now >= cpuPT[q2]) { api.press('b'); cpuPT[q2] = 1e9; return; }
        if (cpuT[q2] < 0) cpuT[q2] = now + 0.5 + R.next() * 0.4;
        if (now < cpuT[q2]) return;
        if (mal[q2]) { if (bad[q2] >= 0) api.press('b'); cpuT[q2] = now + 0.25 + R.next() * 0.25; return; }
        if (!llegado(ord[q2], now)) { cpuT[q2] = CL[ord[q2]].t + 0.3 + R.next() * 0.3; return; }
        var oscuro = luzFuera(now), sq = seqOf(ord[q2], cam[q2]), want = sq[paso[q2]], pick = want, duda = 0, e2;
        if (R.next() < 0.02 + 0.06 * (1 - sk) + (oscuro ? 0.1 : 0)) pick = (want + 1 + Math.floor(R.next() * 5)) % 6;
        for (e2 = 0; e2 < EV.length; e2++) if (EV[e2].k === 'viento' && now >= EV[e2].t && now < EV[e2].t + 1.2) duda = 0.35;
        var d = DIR[casillaDe(pick)];
        if (espejoOn(now) && R.next() > 0.15 + 0.3 * (1 - sk)) d = [-d[0], d[1]];
        api.eje(d[0], d[1]); api.press('a');
        cpuT[q2] = now + (0.5 + 0.4 * (1 - sk)) * (0.85 + 0.3 * R.next()) * (oscuro ? 1.35 : 1) + duda;
      },

      cuerpo: function (q2) { return { ord: ord[q2], paso: paso[q2], err: err[q2], pts: pts[q2], srv: srv[q2], mal: mal[q2], cam: cam[q2] }; },
      alRemoto: function (q2, o) { adopta(q2, o); },
      alCpu: function (q2) { cpuT[q2] = -1; sel[q2] = -1; },
      alHum: function (q2, o) { if (o) adopta(q2, o); sel[q2] = -1; },

      scores: function () { var out = [], q2; for (q2 = 0; q2 < n; q2++) out.push(pts[q2] | 0); return out; },
      done: function () { for (var q2 = 0; q2 < n; q2++) if (ord[q2] < NC) return false; return true; },
      hudChip: function (q2) { return pts[q2] + ' pts'; },
      destacado: function () { var q2 = me(); return srv[q2] + ' perros · ' + pts[q2] + ' pts · ' + err[q2] + ' errores'; },
      vista: function () {
        return { n: n, lv: lv, dur: dur, hash: hash, lay: lay.slice(), dir: DIR.map(function (d) { return d.slice(); }),
          clientes: CL.map(function (q2) { return { t: q2.t, seq: q2.seq.slice(), cp: q2.cp, drop: q2.drop, seq2: q2.seq2 ? q2.seq2.slice() : null, vip: q2.vip, imp: q2.imp, val: q2.val, pac: q2.pac, fase: q2.fase, huevo: q2.huevo ? 1 : 0, crit: q2.crit, bus: q2.bus }; }),
          ev: EV.map(function (e) { return { k: e.k, t: e.t, d: e.d, a: e.a, b: e.b, a2: e.a2, b2: e.b2 }; }), fase: faseJ(Math.max(0, c.ahora())),
          ord: ord.slice(), paso: paso.slice(), err: err.slice(), pts: pts.slice(), srv: srv.slice(), mal: mal.slice(), cam: cam.slice(), sel: sel.slice(), perRes: perRes.map(function (r) { return r.slice(); }) };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(layoutP());
        dibujar2D();
      }
    };
    return g;
  }
});
})();
