'use strict';
/* LA FIESTA · EN VIVO · f_cotufas · ¡LLUEVEN COTUFAS!  (FFA, ranking, modelo B: dueño + juez)
   Sala de cine con butacas rojas. Del techo caen cotufas: el calendario (x, y, t) sale de c.rng en mk, idéntico en todas las pantallas (2 por tanda; tandas cada 1 / 0,8 / 0,6 s según nivel).
   A los 15 s cae UNA COTUFA DE MANTEQUILLA (vale x5). En Nv3 la máquina de cotufas «explota» dos veces (30 % y 76 %) y dispara 6 cotufas cada vez en arco (también sembradas).
   Recoger = claim al juez: cada dueño detecta el roce con SU cuerpo, c.claim(id) es optimista (la cotufa se esconde) y el juez concede al menor t dentro de 120 ms (claimOk: id válido,
   ya en el suelo, no concedida antes, y una CPU que la tocó antes gana). Las CPU las simula el juez: al tocar una anotan una ventana de 0,15 s y emiten ev `got {id}` (fiable) si ningún humano la ganó.
   A = embestir (0,22 s, 84 px, enfriamiento 1,2 s): ev `shot {x, y, a}`; LA VÍCTIMA juzga el contacto (cada pantalla revisa solo los cuerpos que simula: el suyo y, si es juez, las CPU): si el segmento
   de la embestida la roza (y no es inmune 1 s) pierde min(3, n) cotufas, queda aturdida 0,35 s y emite ev `hit {de, k, x, y, s, T, a}`; todas las pantallas siembran las k cotufas tumbadas con id
   determinista h<víctima>_<s>_<j> (son objetos nuevos que cualquiera recoge igual: claim).
   CAEN CON AVISO: cada cotufa marca en la alfombra su SOMBRA (crece y se oscurece al acercarse) y un aro que se cierra justo donde va a caer; caen en 1,1 / 1,0 / 0,85 s según la fase.
   ESCALADA (fracción de dur, sirve igual a 10 s): CALMA (<35 %, tandas ×1,15) · ¡SE PRENDIÓ LA FUNCIÓN! (35-72 %, ×0,95) · ¡ÚLTIMOS SEGUNDOS! (>=72 %, ×0,7, música más rápida, luces locas
   y en Nv1-2 una SEGUNDA cotufa de mantequilla). EVENTOS de la sala (sembrados en mk con c.rng, con aviso ~1 s): el ACOMODADOR cruza la cancha por un carril con su linterna (quien lo toca: «¡SHHH!»,
   aturdido y suelta 2, lo juzga el dueño del cuerpo como la embestida y emite el mismo ev `hit` con de=-1); RÁFAGA del aire acondicionado (empuja a todos de lado y las cotufas caen en diagonal: la
   sombra dice dónde); APAGÓN en el frenesí (solo se ven los aros y las sombras que brillan); en Nv1-2 la olla se desborda a media función (5 cotufas en arco).
   Puntaje = cotufas (dorada cuenta x5) = n del dueño; los demás lo leen del cuerpo `o` (x, y, n, ds, fc, sn). Sin Math.random/Date.now: azar de c.rng (solo en mk) o c.rngFor('cpu'+p); lo cosmético c.fx(). */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_cotufas')) return;

var AW = 500, AH = 270, PIV = 190, SPD = 165, DASH_T = 0.22, DASH_V = 380, DASH_L = DASH_V * DASH_T, CD = 1.2, STUN = 0.35, INV = 1.0, KNOCK = 3, KB = 26;
var PICK_R = 24, HIT_R = 30, FALLS = [1.1, 1.0, 0.85], FAC = [1.15, 0.95, 0.7], F1 = 0.35, F2 = 0.72, FALL_G = 1.4, LIFE = 7.0, GOLD_T = 15, GOLD_LIFE = 9, GOLD_V = 5, BODY_X = 20, VENT = 0.14, EXPL_N = 6, EXPL_FLY = 0.9;
var UJ_R = 28, UJ_K = 2, UJ_STUN = 0.6, WIND = 75, AVISO = 1.0;                  // acomodador (radio, cotufas que suelta, aturdido), viento px/s, aviso de los eventos
var YMIN = 48;                                                // arriba la cabeza del jugador taparía la pantalla del cine
var MX = AW - 46, MY = -58;                                   // la máquina de cotufas (en coordenadas de la cancha)
var INK = '#14101c';
var SALIDA = { 1: [[0.5, 0.55]], 2: [[0.3, 0.55], [0.7, 0.55]], 3: [[0.25, 0.4], [0.75, 0.4], [0.5, 0.75]], 4: [[0.28, 0.38], [0.72, 0.38], [0.28, 0.74], [0.72, 0.74]] };   // salida en rejilla: todos los asientos equivalentes
var PAL = {
  1: { pared: '#7d2c3c', pared2: '#5f1f2e', piso: '#a8433f', piso2: '#8f3636', butaca: '#d3303f', butaca2: '#a8202e', luz: 0 },
  2: { pared: '#7a2e4e', pared2: '#5a2040', piso: '#9a3f55', piso2: '#843348', butaca: '#c2304f', butaca2: '#96213c', luz: 0 },
  3: { pared: '#2b2146', pared2: '#1d1632', piso: '#5a2f4a', piso2: '#47243a', butaca: '#9a2644', butaca2: '#701a32', luz: 1 }
};
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }
function valDe(id) { return String(id).charAt(0) === 'g' ? GOLD_V : 1; }

FIESTA.LIVE.add('f_cotufas', {
  name: '¡LLUEVEN COTUFAS!', modos: ['ffa'], clase: 'rank', modelo: 'B', dur: 30,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 120, scoreRate: 5, minT: 27, finTemprano: 0 },
  cuerpo: ['x', 'y', 'n', 'ds', 'fc', 'sn'], discretos: ['n', 'ds', 'fc', 'sn'],
  carta: {
    obj: 'Párate en la sombra: ahí cae la cotufa. La de mantequilla vale ×5. Embiste para que el rival suelte las suyas y esquiva al acomodador.',
    gana: 'Quien junte más cotufas en 30 s. Si empatan, comparten puesto.',
    como: { tactil: 'Joystick para moverte · A para embestir', teclado: 'WASD o flechas · ESPACIO' },
    roles: null,
    demos: [
      { id: 'mover', txt: 'Corre hacia donde caen las cotufas: la sombra te avisa' },
      { id: 'saltar', txt: 'A embiste: el rival suelta 3 cotufas, pero tarda 1,2 s en recargar' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv], rng = c.rng, i;
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };

    /* ───── el mundo: calendario de cotufas, idéntico en todos (solo c.rng, solo aquí) ───── */
    var objs = [], byId = {}, base = [1.0, 0.8, 0.6][lv - 1], lead = Math.min(1.2, 0.1 * dur), tv = lead, k = 0, j, hash = 7;
    function fase(t) { return t < F1 * dur ? 0 : t < F2 * dur ? 1 : 2; }                      // 0 calma · 1 se prendió · 2 ¡últimos segundos!
    function add(o) { o.t1 = o.t1 === undefined ? o.t0 + FALLS[fase(o.t0)] : o.t1; o.t2 = o.t1 + (o.life || LIFE); if (o.ox0 === undefined) { o.ox0 = o.x; o.oy0 = o.y - 170; o.arc = 0; } objs.push(o); byId[o.id] = o; return o; }
    /* eventos de la sala (antes que las cotufas: la ráfaga tuerce las que caen en su ventana) */
    var EVS = [];
    function evAdd(e) { e.av = Math.min(AVISO, 0.08 * dur + 0.2); EVS.push(e); return e; }
    var ujD = cl(0.1 * dur, 1.8, 3.0);
    evAdd({ k: 'ujier', t: dur * (0.2 + 0.08 * rng.next()), d: ujD, y: YMIN + 34 + rng.next() * (AH - YMIN - 70), dir: rng.next() < 0.5 ? 1 : -1 });
    evAdd({ k: 'viento', t: dur * (0.44 + 0.08 * rng.next()), d: cl(0.08 * dur, 1.4, 2.4), dir: rng.next() < 0.5 ? 1 : -1 });
    evAdd({ k: 'apagon', t: dur * (0.74 + 0.03 * rng.next()), d: cl(0.085 * dur, 1.2, 2.6) });
    if (dur >= 20) evAdd({ k: 'ujier', t: dur * (0.86 + 0.02 * rng.next()), d: ujD * 0.8, y: YMIN + 34 + rng.next() * (AH - YMIN - 70), dir: rng.next() < 0.5 ? 1 : -1 });
    function evDe(kind, t) { for (var q2 = 0; q2 < EVS.length; q2++) if (EVS[q2].k === kind && t >= EVS[q2].t && t < EVS[q2].t + EVS[q2].d) return EVS[q2]; return null; }
    while (tv < dur - 2.0) {
      for (j = 0; j < 2; j++) {
        var oc = add({ id: 'c' + (k++), x: 30 + rng.next() * (AW - 60), y: YMIN + rng.next() * (AH - YMIN - 16), t0: tv + j * 0.12, v: 1 });
        var vw = evDe('viento', oc.t0 + 0.3);
        if (vw) { oc.ox0 = oc.x - vw.dir * 130; oc.wd = vw.dir; }                     // con el aire acondicionado cae en diagonal: la sombra marca el sitio de verdad
      }
      tv += base * FAC[fase(tv)];
    }
    var goldT = dur >= 20 ? GOLD_T : Math.max(lead + 2, 0.5 * dur);
    add({ id: 'g0', x: 120 + rng.next() * (AW - 240), y: 64 + rng.next() * (AH - 110), t0: goldT, t1: goldT + FALL_G, v: GOLD_V, life: GOLD_LIFE });
    if (lv < 3 && dur >= 12) { var g1T = dur * 0.8; add({ id: 'g1', x: 120 + rng.next() * (AW - 240), y: 64 + rng.next() * (AH - 110), t0: g1T, t1: g1T + FALL_G, v: GOLD_V, life: Math.min(GOLD_LIFE, dur - g1T - FALL_G + 0.5) }); }
    var explT = lv >= 3 ? (dur >= 20 ? [0.3 * dur, 0.76 * dur] : [0.5 * dur]) : [0.56 * dur], explN = lv >= 3 ? EXPL_N : 5, e;
    for (e = 0; e < explT.length; e++) for (j = 0; j < explN; j++) {
      var o2 = { id: 'e' + e + '_' + j, x: 36 + rng.next() * (AW - 72), y: YMIN + rng.next() * (AH - YMIN - 20), t0: explT[e] + j * 0.04, v: 1, ex: 1 };
      o2.t1 = o2.t0 + EXPL_FLY; o2.ox0 = MX; o2.oy0 = MY; o2.arc = 70 + rng.next() * 50; add(o2);
    }
    objs.sort(function (a, b) { return a.t0 - b.t0 || (a.id < b.id ? -1 : 1); });
    for (i = 0; i < objs.length; i++) hash = (Math.imul(hash ^ Math.round(objs[i].t0 * 1000) ^ Math.round(objs[i].x) * 31 ^ Math.round(objs[i].y) * 997, 16777619)) >>> 0;
    for (i = 0; i < EVS.length; i++) hash = (Math.imul(hash ^ Math.round(EVS[i].t * 1000) ^ Math.round(EVS[i].y || 0) * 13, 16777619)) >>> 0;
    /* el acomodador: dónde está (x lógico) en el instante t, o null si no está cruzando */
    function ujierEn(t) {
      for (var q2 = 0; q2 < EVS.length; q2++) { var u2 = EVS[q2]; if (u2.k !== 'ujier' || t < u2.t || t >= u2.t + u2.d) continue; var f2 = (t - u2.t) / u2.d; return { x: u2.dir > 0 ? -30 + f2 * (AW + 60) : AW + 30 - f2 * (AW + 60), y: u2.y, e: u2 }; }
      return null;
    }
    function ujierAviso(t) { for (var q2 = 0; q2 < EVS.length; q2++) { var u2 = EVS[q2]; if (u2.k === 'ujier' && t >= u2.t - u2.av && t < u2.t + u2.d) return u2; } return null; }
    function apagon(t) { var a2 = 1; for (var q2 = 0; q2 < EVS.length; q2++) { var e2 = EVS[q2]; if (e2.k !== 'apagon') continue; if (t >= e2.t && t < e2.t + e2.d) return 0.12; if (t >= e2.t - e2.av && t < e2.t) a2 = Math.floor(t * 13) % 3 === 0 ? 0.35 : 1; } return a2; }   // factor de luz
    var nSched = objs.length;

    /* ───── estado ───── */
    var P = [], cpuR = [], plan = [];
    for (i = 0; i < n; i++) {
      P.push({ x: AW * SALIDA[n < 4 ? n : 4][i][0], y: AH * SALIDA[n < 4 ? n : 4][i][1], n: 0, fx: 1, fy: 0, ds: 0, dsT: -9, cd: 0, snT: -9, inv: -9, hs: 0, hurt: -9, fc: 1, sn: 0, mood: 0, pops: 0 });
      cpuR.push(c.rngFor('cpu' + i)); plan.push({ re: -9, tgt: null, err: 0, atk: -1, ex: 0, ey: 0 });
    }
    var taken = {}, pend = {}, cpuPend = {}, tarde = {}, lat = 0.05, nextCl = 0, absT = 0, shake = 0, banner = '', banT = 0, lastGold = false, explDone = [], explAv = [], evAv = [], evOn = [], faseV = 0, act = [], mouth = 0, hits = 0, gotTot = 0;
    var cp = function () { return c.campo(); };
    /* La física usa SIEMPRE la cancha lógica AW×AH (idéntica en todas las pantallas); en vertical el campo visible (~340) es más estrecho y la cancha se encoge (k<1) alrededor de (cx, PIV). */
    function geom() { var f = cp(), w = f.x1 - f.x0, cx = (f.x0 + f.x1) / 2; return { ox: cx - AW / 2, oy: 188, cx: cx, w: w, k: Math.min(1, Math.max(0.5, (w - 6) / (AW + 16))) }; }
    function scr(G, x, y) { return { x: G.cx + (G.ox + x - G.cx) * G.k, y: PIV + (G.oy + y - PIV) * G.k }; }      // posición lógica -> pantalla (burbujas, partículas)

    function markTaken(id, p) {
      if (taken[id] !== undefined) return;
      taken[id] = p; delete cpuPend[id]; delete pend[id]; delete tarde[id];
      var o = byId[id], v = o ? o.v : valDe(id);
      if (p < 0 || p >= n) return;
      if (c.mio(p)) P[p].n += v;
      gotTot++;
      if (!o) return;
      var G = geom(), q = P[p], mine = p === c.yo;
      q.mood = 1; q.pops = absT;
      if (v3) { recoge3D(p, o, v); var pt3 = v3.esc.proyectar(WX(o.x), 1.8, WZ(o.y)); S(v > 1 ? '¡×5!' : (mine ? '+1' : ''), pt3.x, pt3.y, v > 1 ? '#ffd23f' : '#fffdf2'); return; }
      var sp = scr(G, o.x, o.y);
      S(v > 1 ? '¡×5!' : (mine ? '+1' : ''), sp.x, sp.y - 24, v > 1 ? '#ffd23f' : '#fffdf2');
      SPAWN(sp.x, sp.y - 10, v > 1 ? 14 : (mine ? 4 : 2), 'bit', v > 1 ? ['#ffd23f', '#fff6a0', '#fffdf2'] : ['#fffdf2', '#ffd23f'], v > 1 ? 280 : 140, 400, v > 1 ? 0.5 : 0.3);
      if (mine) SND(v > 1 ? 900 : 640, v > 1 ? 0.2 : 0.05, 'square', 0.06, v > 1 ? 400 : 120);
    }
    function actualiza(now) {                                   // objetos con vida ahora mismo (visibles y sin dueño)
      act.length = 0;
      for (var a = 0; a < objs.length; a++) { var o = objs[a]; if (o.t0 > now + 0.01) break; if (now < o.t2 && taken[o.id] === undefined && !o.dead) act.push(o); }
    }
    function suelo(o, now) { return now >= o.t1 && now < o.t2; }

    /* ───── movimiento y recogida ───── */
    function pasos(p, now) {
      var q = P[p], a, o, dx, dy;
      for (a = 0; a < act.length; a++) {
        o = act[a];
        if (!suelo(o, now) || taken[o.id] !== undefined || pend[o.id] !== undefined || (o.retry && now < o.retry)) continue;
        dx = q.x - o.x; dy = (q.y - o.y) * 1.2;
        if (dx * dx + dy * dy > PICK_R * PICK_R) continue;
        recoge(p, o, now);
      }
    }
    function recoge(p, o, now) {
      if (p === c.yo) {                                         // mi cuerpo: claim optimista al juez (uno cada 90 ms: el lote del relé es de 512 B)
        if (now < nextCl || (!c.juez() && Object.keys(pend).length >= 2)) return;      // y a lo sumo 2 sin respuesta: tras una petición perdida el lote se acumula
        nextCl = now + 0.09; pend[o.id] = now;
        if (c.juez() && !c.practica && espera() > 0) tarde[o.id] = now + espera();     // el juez se frena lo que tardan en llegar los claims remotos (si no, ganaría todas las disputas)
        else envia(o);
      } else {                                                   // CPU que simula el juez: ventana corta por si un humano llegó antes
        var q = P[p], dd = (q.x - o.x) * (q.x - o.x) + (q.y - o.y) * (q.y - o.y), cu = cpuPend[o.id];
        if (!cu) cpuPend[o.id] = { p: p, t: now, d: dd };
        else if (cu.t === now && dd < cu.d) { cu.p = p; cu.d = dd; }      // mismo instante: gana la más cercana (sin sesgo por número de asiento)
      }
    }
    function envia(o) {
      c.claim(o.id, function (res) {
        delete pend[o.id];
        if (res !== 'ok' && taken[o.id] === undefined) { o.no = (o.no || 0) + 1; o.retry = c.ahora() + 0.5; if (o.no >= 3) o.dead = 1; }
      });
    }
    /* La ventana del juez es de 120 ms desde SU primer claim; un claim remoto tarda `lat` en llegar. Si el juez reclamara al tocar, ganaría toda disputa cercana.
       Se estima `lat` con los claims ajenos que resuelve (ahora − t − 0,06 de media) y el juez retrasa su claim lat − 0,1 s (tope 0,6); las CPU esperan lo mismo. */
    function espera() { return cl(lat * 1.0, 0, 0.8); }          // el juez se frena parte de lo que tardan los claims remotos; el resto lo cubre la ventana alargada de fiesta-live.js
    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        var r = c.remoto(p);
        if (r) { q.x = r.x; q.y = r.y; q.n = r.n | 0; q.ds = r.ds; q.fc = r.fc; q.sn = r.sn; }
        return;
      }
      var e = c.eje(p), taps = c.tap(p, 'a'), ex = e.x, ey = e.y, mag = Math.sqrt(ex * ex + ey * ey);
      if (now < 0) return;
      if (mag > 1) { ex /= mag; ey /= mag; mag = 1; }
      var stun = now < q.snT;
      if (!stun && mag > 0.25) { q.fx = ex / mag; q.fy = ey / mag; if (Math.abs(q.fx) > 0.2) q.fc = q.fx >= 0 ? 1 : -1; }
      if (taps > 0 && !stun && now >= q.cd && now >= q.dsT + DASH_T) {
        q.cd = now + CD; q.dsT = now;
        var ang = Math.round(Math.atan2(q.fy, q.fx) * 180 / Math.PI); if (ang < 0) ang += 360;
        c.ev('shot', { x: Math.round(q.x), y: Math.round(q.y), a: ang }, p);
        if (p === c.yo) SND(260, 0.12, 'sawtooth', 0.05, 200);
      }
      var dash = now < q.dsT + DASH_T;
      if (dash) { q.x += q.fx * DASH_V * dt; q.y += q.fy * DASH_V * dt; }
      else if (!stun) { q.x += ex * SPD * dt; q.y += ey * SPD * dt; }
      var vw = evDe('viento', now); if (vw) q.x += vw.dir * WIND * dt;                         // el aire acondicionado empuja a todos (hay que remar contra él)
      q.x = cl(q.x, BODY_X, AW - BODY_X); q.y = cl(q.y, YMIN, AH - 8);
      q.ds = dash ? 1 : 0; q.sn = stun ? 1 : 0;
      pasos(p, now);
      juzgaUjier(p, now);
    }
    /* el acomodador: el dueño del cuerpo juzga si lo tocó (mismo camino en todas las pantallas); suelta UJ_K cotufas con el mismo ev `hit` (de = -1) */
    function juzgaUjier(p, now) {
      var u = ujierEn(now), q = P[p]; if (!u || now < q.inv) return;
      var dx = q.x - u.x, dy = (q.y - u.y) * 1.2;
      if (dx * dx + dy * dy > UJ_R * UJ_R) return;
      var kk = Math.min(UJ_K, q.n), up = q.y < u.y ? -1 : 1;
      q.n -= kk; q.inv = now + INV; q.snT = now + UJ_STUN; q.dsT = -9; q.hs++;
      q.y = cl(q.y + up * KB, YMIN, AH - 8);
      c.ev('hit', { de: -1, k: kk, x: Math.round(q.x), y: Math.round(q.y), s: q.hs, T: Math.round(now * 1000), a: up > 0 ? 90 : 270 }, p);
    }
    /* la víctima juzga: ¿la embestida de `de` me roza? (solo cuerpos que simulo yo) */
    function juzgaShot(de, d, now) {
      var rad = d.a * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), v, q;
      for (v = 0; v < n; v++) {
        if (v === de || !c.mio(v)) continue;
        q = P[v];
        if (now < q.inv || now < 0) continue;
        var px = q.x - d.x, py = q.y - d.y, t = cl(px * ux + py * uy, 0, DASH_L), dx = px - ux * t, dy = (py - uy * t) * 1.15;
        if (dx * dx + dy * dy > HIT_R * HIT_R) continue;
        var kk = Math.min(KNOCK, q.n);
        q.n -= kk; q.inv = now + INV; q.snT = now + STUN; q.dsT = -9; q.hs++;
        q.x = cl(q.x + ux * KB, BODY_X, AW - BODY_X); q.y = cl(q.y + uy * KB, YMIN, AH - 8);
        c.ev('hit', { de: de, k: kk, x: Math.round(q.x), y: Math.round(q.y), s: q.hs, T: Math.round(now * 1000), a: d.a }, v);
      }
    }

    /* ───── IA ───── */
    function aiCpu(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], a, o, r;
      if (now < 0) return;
      if (now < q.snT) { api.eje(0, 0); return; }
      if (now >= pl.re) {
        pl.re = now + 0.12 + R2.next() * 0.08;
        var rt = 0.45 - 0.2 * sk + (apagon(now) < 0.5 ? 0.25 : 0), best = null, bs = 1e9;       // 250-450 ms de reacción desde que la ve caer (a oscuras, más)
        for (a = 0; a < act.length; a++) {
          o = act[a];
          if (now < o.t0 + rt || now > o.t2 - 0.25) continue;
          var d0 = Math.sqrt((o.x - q.x) * (o.x - q.x) + (o.y - q.y) * (o.y - q.y)), eta = Math.max(d0 / SPD, o.t1 - now);
          if (now + eta > o.t2 - 0.1) continue;
          var sc = eta / (o.v > 1 ? 2.5 : 1);
          if (sk >= 0.5) for (r = 0; r < n; r++) if (r !== p) { var dr = Math.sqrt((o.x - P[r].x) * (o.x - P[r].x) + (o.y - P[r].y) * (o.y - P[r].y)) / SPD; if (dr < eta * 0.6) { sc += 0.5; break; } }
          if (sc < bs) { bs = sc; best = o; }
        }
        pl.tgt = best; pl.ex = (R2.next() * 2 - 1) * (1 - sk) * 14; pl.ey = (R2.next() * 2 - 1) * (1 - sk) * 10;
        var rich = -1, rn = 3;                                   // al que lleva más, si está cerca
        for (r = 0; r < n; r++) if (r !== p && P[r].n > rn && now >= P[r].inv) { rn = P[r].n; rich = r; }
        var okAtk = rich >= 0 && P[rich].n >= P[p].n && now >= q.cd;
        if (okAtk) { var ddx = P[rich].x - q.x, ddy = P[rich].y - q.y; okAtk = ddx * ddx + ddy * ddy < 70 * 70 && R2.next() < 0.1 + 0.25 * sk; }
        pl.atk = okAtk ? rich : -1;
      }
      var ua = ujierAviso(now);                                   // el acomodador viene por su carril: apartarse (las listas antes)
      if (ua && Math.abs(q.y - ua.y) < UJ_R + 16) {
        var up2 = ujierEn(now), adel = up2 ? (q.x - up2.x) * ua.dir : 999;
        if (adel > -20 && adel < 70 + 140 * sk) { var sal = q.y < ua.y ? -1 : 1; if (ua.y + sal * 60 < YMIN || ua.y + sal * 60 > AH - 8) sal = -sal; api.eje(0, sal); return; }
      }
      if (pl.atk >= 0) {
        var tx = P[pl.atk].x - q.x, ty = P[pl.atk].y - q.y, tl = Math.sqrt(tx * tx + ty * ty) || 1;
        api.eje(tx / tl, ty / tl); api.press('a'); pl.atk = -1; pl.re = now + 0.35; return;
      }
      if (pl.tgt && taken[pl.tgt.id] === undefined && now < pl.tgt.t2) {
        var gx = pl.tgt.x + pl.ex - q.x, gy = pl.tgt.y + pl.ey - q.y, gl = Math.sqrt(gx * gx + gy * gy);
        if (gl < 5) api.eje(0, 0); else api.eje(gx / gl, gy / gl);
      } else {
        var hx = AW * SALIDA[n < 4 ? n : 4][p][0] - q.x, hy = AH * SALIDA[n < 4 ? n : 4][p][1] - q.y;
        api.eje(Math.abs(hx) > 30 ? (hx > 0 ? 0.6 : -0.6) : 0, Math.abs(hy) > 30 ? (hy > 0 ? 0.6 : -0.6) : 0);
      }
    }

    /* ───── dibujo ───── */
    function popcorn(x, y, s, col) {
      ell(x, y + 3 * s, 8 * s, 3 * s, INK, 0);
      ell(x - 5 * s, y, 6 * s, 5 * s, '#fff8e0', 2); ell(x + 5 * s, y, 6 * s, 5 * s, '#fff8e0', 2);
      ell(x, y - 4 * s, 6.5 * s, 5.5 * s, col || '#fffdf2', 2); ell(x + 1 * s, y - 3 * s, 2.6 * s, 2 * s, '#ffd23f', 0);
    }
    function dorada(x, y, s, t) {
      var pul = 1 + 0.12 * Math.sin(t * 9);
      ell(x, y + 4 * s, 15 * s, 5 * s, INK, 0);
      ell(x, y - 2 * s, 17 * s * pul, 13 * s * pul, '#fff2a0', 0);
      ell(x - 5 * s, y, 8 * s, 7 * s, '#ffd23f', 2.5); ell(x + 6 * s, y, 8 * s, 7 * s, '#ffd23f', 2.5); ell(x, y - 6 * s, 9 * s, 7 * s, '#ffe15a', 2.5);
      txt('×5', x, y - 2 * s, 12 * s, '#7a4a00', 0, true);
    }
    function fondo(f, G) {
      var w = G.w / G.k + 24, x0 = G.cx - w / 2, x1 = G.cx + w / 2, kk;                                // en capa escalada: las paredes se ensanchan lo que se encoge la cancha
      rr(x0, -300, w, 630, 0, pal.pared, 0); rr(x0, 150, w, 180, 0, pal.pared2, 0);
      for (kk = 0; kk < Math.ceil((AW + 24) / 47); kk++) rr(G.ox - 10 + kk * 47, 144, 40, 30, 9, pal.butaca, 3);     // respaldos de las butacas del fondo
      rr(x0, G.oy - 20, w, 700, 0, pal.piso, 0);
      for (kk = 0; kk < 12; kk++) rr(G.ox - 8, G.oy - 10 + kk * 24, AW + 16, 2, 0, pal.piso2, 0);
      rr(G.ox + AW / 2 - 18, G.oy - 20, 36, 700, 0, pal.piso2, 0);                                   // el pasillo de alfombra
      var sw = Math.max(30, G.ox - x0 - 22);
      for (kk = 0; kk < 3; kk++) { rr(x0 + 8, G.oy + 30 + kk * 62, sw, 50, 10, pal.butaca, 3.5); rr(x1 - sw - 8, G.oy + 30 + kk * 62, sw, 50, 10, pal.butaca2, 3.5); }
    }
    function pantalla(f) {                                                                              // la pantalla del cine con el gag, a tamaño real (no se encoge)
      var cx = (f.x0 + f.x1) / 2, w = Math.min(320, f.x1 - f.x0 - 16);
      rr(cx - w / 2, 92, w, 40, 5, lv === 3 ? '#cfd8ff' : '#f4f1e6', 3.5);
      txt('Mi mamá metió las cotufas en la cartera.', cx, 116, 12, '#3a2a2a', 0, true);
    }
    function maquina(G, now, boom) {
      var mx = G.ox + MX, my = G.oy + MY + 24, sh = boom > 0 ? Math.sin(absT * 70) * 3 * boom : 0;
      rr(mx - 26 + sh, my - 4, 52, 56, 5, '#c4283a', 3.5); rr(mx - 20 + sh, my + 2, 40, 28, 4, '#fff2c4', 2.5);
      for (var b = 0; b < 4; b++) ell(mx - 11 + (b % 2) * 22 + sh, my + 10 + Math.floor(b / 2) * 12 - boom * 4, 7, 6, '#fffdf2', 2);
      rr(mx - 30 + sh, my - 14, 60, 12, 3, '#ffd23f', 3); txt('COTUFAS', mx + sh, my - 4, 8, '#7a2a00', 0, true);
      if (boom > 0) { ell(mx, my - 16, 16 * boom, 10 * boom, '#fffdf2', 0); }
    }
    function persona(p, x, y, now) {
      var s = asiento(p), col = s.color || '#ffd23f', q = P[p], blink = now < q.inv && Math.floor(absT * 14) % 2, dash = q.ds, st = q.sn;
      ctx.save(); ctx.globalAlpha = blink ? 0.45 : 1;
      if (dash) { for (var tr = 1; tr <= 3; tr++) { ctx.save(); ctx.globalAlpha = 0.4 / tr; ell(x - q.fc * tr * 14, y - 30, 14, 26, col, 0); ctx.restore(); } }
      ell(x, y + 3, 20, 6, INK, 0);
      rr(x - 11, y - 26, 8, 24, 4, '#2f3a7a', 3); rr(x + 3, y - 26, 8, 24, 4, '#2f3a7a', 3);
      rr(x - 15, y - 62, 30, 38, 10, col, 3.5);
      c.util.pj(s.ch, x, y - 78, 62, { animo: q.hurt > now - 0.5 ? 'perder' : (q.mood > 0 && now < q.pops + 0.5 ? 'celebrar' : null), sombra: false });
      ctx.restore();
      if (dash) line([[x + q.fc * 12, y - 40], [x + q.fc * 30, y - 40]], 3, '#fffdf2');
      if (st) { var sa = absT * 8; ell(x + Math.cos(sa) * 14, y - 112, 4, 4, '#ffd23f', 1.5); ell(x - Math.cos(sa) * 14, y - 112, 4, 4, '#ffd23f', 1.5); }
      popcorn(x - 16, y - 118, 0.6); txt(String(q.n | 0), x + 10, y - 113, 17, '#fffdf2', 0, true);
      if (p === c.yo) poly([[x - 8, y - 144], [x + 8, y - 144], [x, y - 132]], '#ffd23f', 3);
    }
    function objPos(o, now, G) {
      var u = cl((now - o.t0) / (o.t1 - o.t0), 0, 1), px = o.ox0 + (o.x - o.ox0) * u, py = o.oy0 + (o.y - o.oy0) * u - Math.sin(u * Math.PI) * o.arc;
      return { x: G.ox + px, y: G.oy + py, u: u };
    }

    /* sombra + aro de caída en 2D: la sombra crece y se oscurece, el aro se cierra sobre el punto (sombra=0: solo aros, para el apagón) */
    function marcas(vis, now, ox, oy, sombra) {
      for (var a = 0; a < vis.length; a++) {
        var o1 = vis[a], u = cl((now - o1.t0) / (o1.t1 - o1.t0), 0, 1), gd = o1.v > 1, x = ox + o1.x, y = oy + o1.y + 6, uu = u * u, r, pts = [], m;
        if (sombra) { ctx.save(); ctx.globalAlpha = 0.45 + 0.45 * uu; ell(x, y, (gd ? 26 : 17) * (0.35 + 0.9 * uu), (gd ? 10 : 7) * (0.35 + 0.9 * uu), INK, 0); ctx.restore(); }
        if (u >= 1) continue;
        r = (gd ? 26 : 17) * (2.2 - 1.3 * u);
        for (m = 0; m <= 16; m++) pts.push([x + Math.cos(m / 16 * 6.2832) * r, y + Math.sin(m / 16 * 6.2832) * r * 0.38]);
        ctx.save(); ctx.globalAlpha = 0.45 + 0.5 * u; line(pts, gd ? 3 : 2, gd ? '#ffd23f' : '#fff6d8'); ell(x, y, 2.5, 1.2, gd ? '#ffd23f' : '#fff6d8', 0); ctx.restore();
      }
    }
    /* el dibujo 2D de siempre (sin WebGL o con ?plano=1) */
    function dibujar2D() {
      var f = cp(), G = geom(), now = c.ahora(), p, a, ox = G.ox, oy = G.oy;
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3;
      ctx.save(); ctx.translate(sxk, syk); ctx.translate(G.cx, PIV); ctx.scale(G.k, G.k); ctx.translate(-G.cx, -PIV);
      fondo(f, G);
      var boom = 0, ee; for (ee = 0; ee < explT.length; ee++) if (now >= explT[ee] - 0.4 && now < explT[ee] + 0.8) boom = Math.max(boom, 1 - Math.abs(now - explT[ee]) / 0.8);
      maquina(G, now, boom > 0 ? boom : (mouth > 0 ? mouth : 0));
      var vis = [];
      for (a = 0; a < objs.length; a++) { var o = objs[a]; if (o.t0 > now + 0.02) break; if (now >= o.t2 || taken[o.id] !== undefined || o.dead) continue; vis.push(o); }
      var ua = ujierAviso(now), up = ujierEn(now);
      if (ua) { ctx.save(); ctx.globalAlpha = up ? 0.22 : 0.1 + 0.18 * Math.abs(Math.sin(absT * 9)); rr(ox - 10, oy + ua.y - UJ_R - 4, AW + 20, UJ_R * 2 + 8, 6, '#fff0a0', 0); ctx.restore(); }
      marcas(vis, now, ox, oy, 1);
      ctx.restore();
      pantalla(f);                                                                                    // entre el fondo y los jugadores: nadie la tapa salvo desde YMIN
      ctx.save(); ctx.translate(sxk, syk); ctx.translate(G.cx, PIV); ctx.scale(G.k, G.k); ctx.translate(-G.cx, -PIV);
      var ord = [];
      for (p = 0; p < n; p++) ord.push(p);
      ord.sort(function (a2, b2) { return P[a2].y - P[b2].y; });
      for (a = 0; a < vis.length; a++) {
        var o3 = vis[a], pos = objPos(o3, now, G), gl = o3.v > 1, fade = o3.t2 - now < 1.2 ? (Math.floor(absT * 12) % 2 ? 0.35 : 1) : 1;
        ctx.save(); ctx.globalAlpha = fade;
        if (gl) dorada(pos.x, pos.y - (pos.u >= 1 ? 4 + Math.sin(absT * 5) * 3 : 0), 1, absT); else popcorn(pos.x, pos.y - (pos.u >= 1 ? 2 : 0), 1);
        ctx.restore();
      }
      for (a = 0; a < ord.length; a++) {
        p = ord[a]; var q = P[p];
        persona(p, ox + q.x, oy + q.y, now);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 15, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
      }
      if (up) {                                                                                       // el acomodador cruzando con su linterna
        var ux = ox + up.x, uy = oy + up.y;
        ell(ux, uy + 3, 18, 6, INK, 0); rr(ux - 12, uy - 60, 24, 58, 8, '#2f3a7a', 3); ell(ux, uy - 72, 12, 12, '#c98a5a', 2.5); rr(ux - 13, uy - 86, 26, 8, 3, '#14101c', 0);
        poly([[ux + up.e.dir * 12, uy - 40], [ux + up.e.dir * 70, uy - 58], [ux + up.e.dir * 70, uy - 22]], '#fff6c0', 0);
        txt('¡SHHH!', ux, uy - 98, 14, '#fff6c0', 0, true);
      }
      var vw2 = evDe('viento', now);
      if (vw2) for (a = 0; a < 10; a++) { var lx = ((absT * 420 * vw2.dir + a * 97) % (AW + 80) + AW + 80) % (AW + 80) - 40; line([[ox + lx, oy + 20 + a * 24], [ox + lx - vw2.dir * 46, oy + 20 + a * 24]], 2, '#eaf6ff'); }
      var luz = apagon(now);
      if (luz < 1) { ctx.save(); ctx.globalAlpha = luz < 0.5 ? 0.78 : 0.35; rr(ox - 400, -300, AW + 800, 900, 0, '#05030a', 0); ctx.restore(); marcas(vis, now, ox, oy, 0); }   // a oscuras solo se ven los aros
      if (fase(now) === 2 && now < dur && luz > 0.5) { ctx.save(); ctx.globalAlpha = 0.08 + 0.06 * Math.abs(Math.sin(absT * 8.8)); rr(ox - 400, -300, AW + 800, 900, 0, Math.floor(absT * 2.8) % 2 ? '#ff4060' : '#ffc040', 0); ctx.restore(); }
      ctx.restore();
      if (banT > 0) txt(banner, (f.x0 + f.x1) / 2, 84, 18 + Math.sin(absT * 14), '#ffd23f', 0, true);
      if (now >= -0.4 && now < 1.8 && !c.practica) txt('¡JUNTA COTUFAS!', (f.x0 + f.x1) / 2, 84, 22, '#fffdf2', 0, true);
      if (typeof drawP === 'function') drawP();
    }

    /* ───── 3D low poly (fiesta-3d.js): la sala de cine con la máquina de cotufas gigante. Solo dibujo: lee P, objs, taken y los eventos; no toca la simulación ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;                   // v3: null = sin probar, false = sin 3D (2D de siempre)
    var ESX = 1 / 18, ESZ = 1.15 / 18;                                          // px de la simulación -> metros (z con el mismo 1.2 de la recogida, redondeado)
    function WX(x) { return (x - AW / 2) * ESX; }
    function WZ(y) { return (y - AH / 2) * ESZ; }
    var MQX = WX(MX), MQZ = WZ(MY);                                             // la máquina, donde la pone la simulación (de ahí salen las de la explosión)
    var PAL3 = {
      1: { fondo: '#2a1018', hemi: [0xfff0e0, 0x7a4a40, .62], sol: [0xfff2d8, .62], pared: '#7d2c3c', pared2: '#5f1f2e', alf: '#a8433f', alf2: '#8f3636', motivo: '#d9a23a', butaca: '#d3303f', pantalla: '#f4f1e6', noche: 0 },
      2: { fondo: '#2a1028', hemi: [0xffc8d8, 0x5a3050, .55], sol: [0xffa878, .62], pared: '#7a2e4e', pared2: '#5a2040', alf: '#9a3f55', alf2: '#843348', motivo: '#e0a050', butaca: '#c2304f', pantalla: '#ffe6c8', noche: 0 },
      3: { fondo: '#120c22', hemi: [0x7a7aff, 0x2a1a3a, .4], sol: [0x8a9aff, .26], pared: '#2b2146', pared2: '#1d1632', alf: '#5a2f4a', alf2: '#47243a', motivo: '#8a6ac0', butaca: '#9a2644', pantalla: '#cfd8ff', noche: 1 }
    };
    var CAMISAS = ['#3fa9ff', '#ffd23f', '#5cff7a', '#ff8a5a', '#a9a0ff', '#fffdf2', '#ff5c8a', '#2f3a7a'], PIELES = ['#f2c9a0', '#c98a5a', '#8a5a3a', '#e0b080'];
    var CREMA = ['#fffdf2', '#fff3c4', '#ffd23f'], ORO = ['#ffd23f', '#fff6a0', '#ffb000', '#fffdf2'];
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j, a;
      var esc = V3.escena({ fondo: pl.fondo, niebla: [pl.fondo, 60, 130], fov: 32 });
      if (!esc) return null;
      /* salsa brava de matiné: i–iv–V–i en La menor, con su campanita */
      if (V3.pista) V3.pista('cotufas', { bpm: 128, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 76, 0, 74, 72, 0, 71, 72, 0, 74, 0, 76, 0, 0, 0, 77, 0, 76, 74, 0, 72, 71, 0, 68, 0, 71, 0, 69, 0, 0, 0] });
      /* ¡últimos segundos!: la misma salsa, más rápida y una octava arriba */
      if (V3.pista) V3.pista('cotufas_loca', { bpm: 168, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [88, 0, 88, 86, 84, 0, 83, 84, 86, 0, 88, 0, 89, 88, 86, 0, 88, 0, 88, 86, 84, 0, 83, 0, 80, 0, 83, 86, 81, 0, 0, 0] });
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1];
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, GM = V3.toon('#fff').gradientMap;
      /* piso: alfombra de cine con rombitos */
      var alfombra = V3.texturaCanvas(128, 128, function (x, w, h) {
        x.fillStyle = pl.alf; x.fillRect(0, 0, w, h);
        x.fillStyle = pl.alf2; for (var i = 0; i < 4; i++) x.fillRect(0, i * 32 + 29, w, 3);
        x.fillStyle = pl.motivo;
        for (var i2 = 0; i2 < 4; i2++) for (var j2 = 0; j2 < 4; j2++) { x.save(); x.translate(i2 * 32 + 16, j2 * 32 + 14); x.rotate(Math.PI / 4); x.fillRect(-4, -4, 8, 8); x.restore(); }
      }, [18, 13]);
      var piso = new T.Mesh(new T.PlaneGeometry(72, 52), new T.MeshToonMaterial({ map: alfombra, gradientMap: GM }));
      piso.rotation.x = -Math.PI / 2; piso.position.z = -2; piso.receiveShadow = true; S3.add(piso);
      /* la cancha: cinta dorada en el piso */
      var bx = AW * ESX + .8, z0c = WZ(YMIN) - .9, z1c = WZ(AH) + .5, bd = z1c - z0c, bzc = (z0c + z1c) / 2;
      [[0, z0c, bx, .16], [0, z1c, bx, .16], [-bx / 2, bzc, .16, bd], [bx / 2, bzc, .16, bd]].forEach(function (r) {
        var m = new T.Mesh(new T.PlaneGeometry(r[2], r[3]), tn('#ffd23f')); m.rotation.x = -Math.PI / 2; m.position.set(r[0], .02, r[1]); m.receiveShadow = true; S3.add(m);
      });
      /* la pared del fondo con paneles, apliques y el letrero de SALIDA */
      var pared = M(new T.BoxGeometry(64, 18, .6), pl.pared, { recibe: true, borde: false }); pared.position.set(0, 9, -15.4); S3.add(pared);
      for (k = 0; k < 9; k++) { var pa = M(new T.BoxGeometry(.5, 18, .3), pl.pared2, { borde: false, recibe: true }); pa.position.set(-24 + k * 6, 9, -15); S3.add(pa); }
      var zoc = M(new T.BoxGeometry(64, 1, .4), pl.pared2, { borde: false, recibe: true }); zoc.position.set(0, .5, -15); S3.add(zoc);
      var bombillos = [];
      [-19.5, -14.2, 14.2, 19.5].forEach(function (x) {
        var ap = M(new T.SphereGeometry(.5, 8, 6), '#ffe0a0', { em: '#ffb040', emI: pl.noche ? 1.5 : .45, g: .05 }); ap.scale.set(1, .7, .5); ap.position.set(x, 6.2, -14.8); S3.add(ap);
      });
      var salidaTx = V3.texturaCanvas(128, 48, function (x, w, h) { x.fillStyle = '#1f8a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#eaffea'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SALIDA', w / 2, h / 2 + 2); });
      var salida = new T.Mesh(new T.PlaneGeometry(2.4, .9), new T.MeshBasicMaterial({ map: salidaTx })); salida.position.set(-17, 7.6, -14.8); S3.add(salida);
      /* la pantalla con el chiste (no recibe luz: brilla sola) y su marco */
      var lienzo = V3.texturaCanvas(512, 192, function (x, w, h) {
        x.fillStyle = pl.pantalla; x.fillRect(0, 0, w, h);
        x.fillStyle = '#7a4a2a'; x.fillRect(40, 70, 110, 80); x.fillRect(60, 52, 70, 12);                // la cartera de mamá
        x.fillStyle = '#5a3018'; x.fillRect(40, 96, 110, 8);
        x.fillStyle = '#fffdf2'; for (var i = 0; i < 6; i++) x.fillRect(48 + i * 16, 58 - (i % 2) * 8, 14, 12);
        x.fillStyle = '#3a2a2a'; x.font = 'bold 28px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
        x.fillText('Mi mamá metió las', 180, 78); x.fillText('cotufas en la cartera.', 180, 116);
      });
      var pmat = new T.MeshBasicMaterial({ map: lienzo });
      var marco = M(new T.BoxGeometry(18.8, 7.6, .3), '#14101c', { borde: false }); marco.position.set(0, 5.2, -15.05); S3.add(marco);
      var pant = new T.Mesh(new T.PlaneGeometry(18, 6.8), pmat); pant.position.set(0, 5.2, -14.88); S3.add(pant);
      /* telones rojos a los lados (se mecen solos) y la cenefa */
      var pliegues = [];
      [-1, 1].forEach(function (sx) {
        for (var i = 0; i < 8; i++) {
          var pli = M(new T.CylinderGeometry(.34, .4, 10, 6), i % 2 ? '#b0182e' : '#c4283a', { g: .02, recibe: true });
          pli.geometry.translate(0, -5, 0); pli.position.set(sx * (9.6 + i * .5), 10, -14.5 + (i % 2) * .15); S3.add(pli); pliegues.push(pli);
        }
      });
      var cenefa = M(new T.BoxGeometry(28, 1.4, .8), '#b0182e', { g: .02 }); cenefa.position.set(0, 9.6, -14.4); S3.add(cenefa);
      var flecos = M(new T.BoxGeometry(28, .2, .85), '#ffd23f', { borde: false }); flecos.position.set(0, 8.9, -14.4); S3.add(flecos);
      /* butacas: fila de atrás (entre la cancha y la pantalla) y los dos bloques de los lados; todas miran a la pantalla */
      function butaca(x, z) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); g3.rotation.y = Math.PI; S3.add(g3);
        var resp = M(new T.BoxGeometry(1.1, 1.5, .28), pl.butaca, { g: .03 }); resp.position.set(0, 1.05, -.38); g3.add(resp);
        var coj = M(new T.BoxGeometry(1.05, .3, .8), V3.oscurecer(pl.butaca, .8), { g: .03, recibe: true }); coj.position.set(0, .55, 0); g3.add(coj);
        var pata = M(new T.BoxGeometry(.9, .4, .5), '#2a2a34', { borde: false }); pata.position.set(0, .2, 0); g3.add(pata);
        return g3;
      }
      var gente = [], zb = WZ(YMIN) - 2.4;
      for (k = 0; k < 18; k++) { var xb = -12.2 + k * 1.44; if (Math.abs(xb) < .9) continue; butaca(xb, zb); }
      function espectador(x, z, k2) {
        var g3 = new T.Group(); g3.position.set(x, 0, z); S3.add(g3);
        var cu = M(new T.CylinderGeometry(.36, .44, 1.1, 7), CAMISAS[k2 % CAMISAS.length], { g: .04 }); cu.position.y = 1.15; g3.add(cu);
        var cab = new T.Group(); cab.position.y = 2.05; g3.add(cab);
        var ca = M(new T.SphereGeometry(.36, 8, 6), PIELES[k2 % PIELES.length], { g: .05 }); cab.add(ca);
        var pe = M(new T.SphereGeometry(.38, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), ['#2a1a10', '#5a3018', '#14101c', '#c8c0b0'][k2 % 4], { borde: false }); pe.position.set(0, .04, .04); cab.add(pe);
        var bal = null;
        if (k2 % 3 === 0) { bal = M(new T.CylinderGeometry(.2, .15, .35, 7), '#d3303f', { g: .06 }); bal.position.set(.45, 1.5, 0); g3.add(bal); }
        var brazos = [];                                                           // brazos: se levantan cuando el público se emociona
        [-1, 1].forEach(function (sx2) {
          var pv = new T.Group(); pv.position.set(sx2 * .42, 1.62, 0); g3.add(pv);
          pv.add(M(new T.BoxGeometry(.2, .9, .22).translate(0, -.42, 0), CAMISAS[k2 % CAMISAS.length], { g: .04 }));
          brazos.push({ pv: pv, sx: sx2 });
        });
        gente.push({ g: g3, cab: cab, bal: bal, f: k2 * 1.7, salto: 0, vy: 0, br: brazos, hy: 0 });
      }
      [-1, 1].forEach(function (sx) {
        for (var r = 0; r < 4; r++) for (var i = 0; i < 5; i++) {
          var x = sx * (15.8 + i * 1.25), z = -4 + r * 4.4, kk = r * 5 + i + (sx > 0 ? 20 : 0);
          butaca(x, z);
          if ((kk * 7) % 10 < 4) espectador(x, z + .1, kk);
        }
      });
      /* luces del pasillo a los lados de la cancha */
      for (k = 0; k < 7; k++) [-1, 1].forEach(function (sx) {
        var lu = M(new T.BoxGeometry(.3, .12, .3), '#ffe0a0', { em: '#ffb040', emI: pl.noche ? 2 : .6, borde: false }); lu.position.set(sx * 14.6, .06, -5 + k * 2.3); S3.add(lu);
      });
      /* LA MÁQUINA DE COTUFAS gigante (carrito rojo, vitrina, olla que gira, cotufas que saltan, marquesina con bombillos) */
      var maq = new T.Group(); maq.position.set(MQX, 0, MQZ); S3.add(maq);
      var carro = M(new T.BoxGeometry(4.2, 2.6, 2.8), '#c4283a', { recibe: true, g: .03 }); carro.position.y = 1.5; maq.add(carro);
      var franja = M(new T.BoxGeometry(4.3, .35, 2.9), '#ffd23f', { borde: false }); franja.position.y = 2.65; maq.add(franja);
      [[-1.6, 1.2], [1.6, 1.2], [-1.6, -1.2], [1.6, -1.2]].forEach(function (r) { var ru = M(new T.CylinderGeometry(.42, .42, .3, 10), '#2a2a34', { g: .05 }); ru.rotation.x = Math.PI / 2; ru.rotation.z = Math.PI / 2; ru.position.set(r[0], .42, r[1]); maq.add(ru); });
      var vidrio = M(new T.BoxGeometry(4, 3.4, 2.6), '#cfefff', { op: .22, borde: false, sombra: false }); vidrio.position.y = 4.55; maq.add(vidrio);
      [[-2, 1.3], [2, 1.3], [-2, -1.3], [2, -1.3]].forEach(function (r) { var po = M(new T.BoxGeometry(.18, 3.4, .18), '#c4283a', { g: .05 }); po.position.set(r[0], 4.55, r[1]); maq.add(po); });
      var GEO_L = new T.IcosahedronGeometry(.26, 0), GEO_S = new T.IcosahedronGeometry(.16, 0);
      for (k = 0; k < 34; k++) { var mo = M(GEO_L, k % 3 ? '#fffdf2' : '#fff3c4', { borde: false }); mo.position.set(((k * 37) % 34) / 34 * 3.4 - 1.7, 3.05 + (k % 4) * .16, ((k * 13) % 20) / 20 * 2 - 1); maq.add(mo); }
      var saltarinas = [];
      for (k = 0; k < 10; k++) { var sa = M(GEO_L, '#fffdf2', { g: .08 }); sa.position.set(-1.4 + (k % 5) * .7, 3.4, -.6 + Math.floor(k / 5) * 1.1); maq.add(sa); saltarinas.push({ m: sa, f: k * .63, y0: 3.4 }); }
      var olla = new T.Group(); olla.position.y = 5.55; maq.add(olla);
      var ol = M(new T.CylinderGeometry(.8, .6, .7, 10), '#c9ced8', { g: .04 }); olla.add(ol);
      var ota = M(new T.CylinderGeometry(.85, .85, .1, 10), '#9aa2b0', { g: .04 }); ota.position.y = .4; olla.add(ota);
      var ova = M(new T.BoxGeometry(.08, .8, .08), '#5a5a64', { borde: false }); ova.position.set(.5, .7, 0); olla.add(ova);
      var tapa = new T.Group(); tapa.position.y = 6.25; maq.add(tapa);
      var tch = M(new T.BoxGeometry(4.6, .4, 3), '#c4283a', { g: .03 }); tapa.add(tch);
      var cup = M(new T.ConeGeometry(2.7, 1.3, 4), '#d3303f', { g: .03 }); cup.rotation.y = Math.PI / 4; cup.scale.set(1, 1, .7); cup.position.y = .85; tapa.add(cup);
      var letreroTx = V3.texturaCanvas(256, 64, function (x, w, h) { x.fillStyle = '#ffd23f'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a2a00'; x.font = 'bold 46px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('COTUFAS', w / 2, h / 2 + 3); });
      var tabla = M(new T.BoxGeometry(3.8, 1.1, .2), '#ffd23f', { g: .04 }); tabla.position.set(0, 2.05, 0); tapa.add(tabla);
      var letrero = new T.Mesh(new T.PlaneGeometry(3.6, .95), new T.MeshBasicMaterial({ map: letreroTx })); letrero.position.set(0, 2.05, .11); tapa.add(letrero);
      for (k = 0; k < 10; k++) {
        var bm = V3.toon('#fff6c0', { nuevo: true, em: '#ffb030', emI: 1 }), bo = new T.Mesh(new T.SphereGeometry(.11, 6, 4), bm);
        var ang = k / 10 * Math.PI * 2; bo.position.set(Math.cos(ang) * 2.05, 2.05 + Math.sin(ang) * .62, .14); tapa.add(bo); bombillos.push(bm);
      }
      if (pl.noche) {
        var luzP = new T.PointLight(0x9ab8ff, 1.1, 30, 2); luzP.position.set(0, 5, -11); S3.add(luzP);
      }
      var luzM = new T.PointLight(0xffc060, pl.noche ? 1.3 : 0, 16, 2); luzM.position.set(MQX, 4.5, MQZ + 2.6); S3.add(luzM);
      var luzOro = new T.PointLight(0xffd040, 0, 8, 2); S3.add(luzOro);
      /* el haz del proyector (de detrás del público a la pantalla) */
      var hg = new T.ConeGeometry(4.2, 1, 16, 1, true); hg.rotateX(-Math.PI / 2);
      var haz = new T.Mesh(hg, new T.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: pl.noche ? .08 : .045, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      var pr0 = new T.Vector3(0, 17, 28), pr1 = new T.Vector3(0, 5.2, -14.8); haz.position.copy(pr0).add(pr1).multiplyScalar(.5); haz.scale.set(1, 1, pr0.distanceTo(pr1)); haz.lookAt(pr1); S3.add(haz);
      /* el rayo de la cotufa de mantequilla */
      var rayo = new T.Mesh(new T.CylinderGeometry(.9, 1.3, 22, 14, 1, true), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .2, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      rayo.position.y = 11; rayo.visible = false; S3.add(rayo);
      /* el acomodador que pasea por el pasillo de atrás con su linterna */
      var acom = V3.PJ.crear('cobrador', { prop: false, escala: 1.2 }); acom.g.position.set(-10, 0, zb - 1.9); S3.add(acom.g);
      var lint = new T.Mesh(new T.CylinderGeometry(.07, .1, .35, 6), tn('#fff6c0', { em: '#ffd36a', emI: pl.noche ? 2 : .4 })); lint.rotation.x = Math.PI / 2; acom.mano('der').add(lint);
      /* las cotufas: un montón de mallas que se reciclan por id (cae, rebota en la alfombra, parpadea antes de irse) */
      var GEO_SOM = new T.CircleGeometry(.62, 18), GEO_ARO = new T.RingGeometry(.86, 1, 28), todas = [];
      /* la sombra: disco negro con borde nítido (sobre la alfombra roja se lee de lejos); una textura compartida para todas */
      var SOMBRA_TX = V3.texturaCanvas(64, 64, function (x, w, h) {
        var gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(8,4,14,1)'); gr.addColorStop(.8, 'rgba(8,4,14,1)'); gr.addColorStop(.92, 'rgba(8,4,14,.6)'); gr.addColorStop(1, 'rgba(8,4,14,0)');
        x.fillStyle = gr; x.fillRect(0, 0, w, h);
      });
      function cotufa3D(oro) {
        var g3 = new T.Group(), c1 = oro ? '#ffd23f' : '#fffdf2', c2 = oro ? '#ffe15a' : '#fff3c4', em = oro ? '#ff9a00' : null;
        var a1 = M(GEO_L, c1, { g: .1, em: em, emI: .5 }); a1.position.set(-.17, 0, 0); g3.add(a1);
        var a2 = M(GEO_L, c2, { g: .1, em: em, emI: .5 }); a2.position.set(.17, .03, .05); g3.add(a2);
        var a3 = M(GEO_L, c1, { g: .1, em: em, emI: .5 }); a3.position.set(0, .22, -.04); g3.add(a3);
        var a4 = M(GEO_S, oro ? '#fff6a0' : '#e8a83a', { borde: false }); a4.position.set(.06, .12, .22); g3.add(a4);
        if (oro) g3.scale.setScalar(1.9);
        /* LA SOMBRA (disco oscuro que crece y se oscurece al acercarse) + EL ARO (se cierra sobre el punto de caída; brilla solo, se ve hasta en el apagón) */
        var sh = new T.Mesh(GEO_SOM, new T.MeshBasicMaterial({ map: SOMBRA_TX, transparent: true, opacity: .5, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.renderOrder = 2; g3.visible = false; sh.visible = false; S3.add(g3); S3.add(sh);
        var mk = new T.Mesh(GEO_ARO, new T.MeshBasicMaterial({ color: oro ? 0xffd23f : 0xfff6d8, transparent: true, opacity: .8, depthWrite: false, side: T.DoubleSide }));
        mk.rotation.x = -Math.PI / 2; mk.renderOrder = 3; mk.visible = false; S3.add(mk);
        var pu = new T.Mesh(GEO_SOM, new T.MeshBasicMaterial({ color: oro ? 0xffd23f : 0xfff6d8, transparent: true, opacity: .6, depthWrite: false }));
        pu.rotation.x = -Math.PI / 2; pu.renderOrder = 3; pu.scale.setScalar(.16); pu.visible = false; S3.add(pu);           // el puntico del centro: «aquí cae»
        var it = { g: g3, sh: sh, mk: mk, pu: pu, id: null, usado: false, toco: false, oro: !!oro, rx: 0, ry: 0 };
        todas.push(it); return it;
      }
      var pool = [];
      for (k = 0; k < 64; k++) pool.push(cotufa3D(false));
      var oros = [cotufa3D(true), cotufa3D(true)];
      /* los jugadores: cada uno con su balde de cotufas sobre la cabeza (pose «cargar»), que se llena con lo que junta */
      var rayas = V3.texturaCanvas(64, 32, function (x, w, h) { x.fillStyle = '#fffdf2'; x.fillRect(0, 0, w, h); x.fillStyle = '#d3303f'; for (var i = 0; i < 8; i += 2) x.fillRect(i * 8, 0, 8, h); });
      var matBalde = new T.MeshToonMaterial({ map: rayas, gradientMap: GM });
      var GEO_BAL = new T.CylinderGeometry(.62, .42, .85, 12), pjs = [];
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 });
        pj.g.position.set(WX(P[k].x), 0, WZ(P[k].y)); S3.add(pj.g);
        var colA = s2.color && s2.color !== '#fff' ? s2.color : CAMISAS[k % CAMISAS.length];
        var aro = new T.Mesh(new T.RingGeometry(.75, .95, 20), new T.MeshBasicMaterial({ color: colA, transparent: true, opacity: .85 }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = .04; S3.add(aro);
        var balde = new T.Group(); S3.add(balde);
        var cubo = V3.malla(GEO_BAL, null, { mat: matBalde, g: .06 }); balde.add(cubo);
        var monton = new T.Group(); monton.position.y = .42; balde.add(monton);
        for (j = 0; j < 7; j++) { var mm = M(GEO_L, j % 3 ? '#fffdf2' : '#fff3c4', { g: .08 }); a = j / 7 * Math.PI * 2; mm.position.set(j ? Math.cos(a) * .32 : 0, j ? .02 : .2, j ? Math.sin(a) * .32 : 0); monton.add(mm); }
        var estrellas = [];
        for (j = 0; j < 2; j++) { var es = M(new T.OctahedronGeometry(.18, 0), '#ffd23f', { g: .08, em: '#ffb000', emI: .6 }); es.visible = false; S3.add(es); estrellas.push(es); }
        pjs.push({ pj: pj, aro: aro, balde: balde, monton: monton, estrellas: estrellas, x: WX(P[k].x), z: WZ(P[k].y), px: WX(P[k].x), pz: WZ(P[k].y), rumbo: 0,
          pulso: 0, popT: -9, dashT: -9, golpeT: -9, rastro: 0, enojo: -9, saltoT: -9, estiraT: -9, lean: 0, polvoT: 0 });
      }
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; S3.add(flecha);
      var part = V3.particulas(esc, 600);
      esc.encuadrar(AW * ESX + 3, 20, new T.Vector3(0, 2, -1.5), .55);
      /* el carril del acomodador: la franja que alumbra su linterna (aviso) */
      var carril = new T.Mesh(new T.PlaneGeometry(AW * ESX + 6, (UJ_R * 2 + 10) * ESZ), new T.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0, depthWrite: false }));
      carril.rotation.x = -Math.PI / 2; carril.position.y = .05; carril.renderOrder = 1; carril.visible = false; S3.add(carril);
      var flechasC = [];
      for (k = 0; k < 5; k++) { var fc3 = new T.Mesh(new T.ConeGeometry(.45, 1, 3), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .8, depthWrite: false })); fc3.rotation.set(-Math.PI / 2, 0, 0); fc3.visible = false; S3.add(fc3); flechasC.push(fc3); }
      var rachas = [];                                                            // las rayitas del aire acondicionado
      for (k = 0; k < 16; k++) { var ra = new T.Mesh(new T.BoxGeometry(2.2, .06, .06), new T.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: .55, depthWrite: false })); ra.visible = false; S3.add(ra); rachas.push({ m: ra, f: k * 2.3, y: .6 + (k * 7 % 11) * .35, z: -7 + (k * 5 % 16) * .8 }); }
      var luzLoca = new T.PointLight(0xff4060, 0, 40, 2); luzLoca.position.set(0, 9, 2); S3.add(luzLoca);
      var linterna = new T.SpotLight(0xfff0b0, 0, 18, .45, .5, 1.5); S3.add(linterna); S3.add(linterna.target);
      return { esc: esc, pjs: pjs, part: part, pool: pool, oros: oros, todas: todas, carril: carril, flechasC: flechasC, rachas: rachas, acz0: zb - 1.9, luzLoca: luzLoca, linterna: linterna, base: [pl.hemi[2], pl.sol[1]], faseV: 0, evV: [], vientoT: 0, uso: {}, flecha: flecha, pmat: pmat, pliegues: pliegues, gente: gente,
        maq: maq, tapa: tapa, olla: olla, saltarinas: saltarinas, bombillos: bombillos, luzM: luzM, luzOro: luzOro, rayo: rayo, haz: haz,
        acom: acom, acx: -10, acz: zb - 1.9, acd: 1, ondas: [], polvoT: 0, popT: -9, boomV: [], tapaY: 0, tapaVy: 0, oroV: false, finV: false, callado: false, oroLand: {}, oroDone: {}, sustoT: -9 };
    }
    function libre() { for (var i = 0; i < v3.pool.length; i++) if (!v3.pool[i].id) return v3.pool[i]; return null; }
    /* lo que está cayendo ahora (aún no tocó el piso y nadie lo recogió): cualquiera, la dorada, y la más cercana a p (solo dibujo) */
    function enAire(now) { for (var i3 = 0; i3 < objs.length; i3++) { var o3 = objs[i3]; if (o3.t0 > now + .02) break; if (now >= o3.t0 && now < o3.t1 && taken[o3.id] === undefined && !o3.dead) return o3; } return null; }
    function oroEnAire(now) { for (var i4 = 0; i4 < objs.length; i4++) { var o4 = objs[i4]; if (o4.t0 > now + .02) break; if (o4.v > 1 && now >= o4.t0 && now < o4.t1 && taken[o4.id] === undefined) return o4; } return null; }
    function cercanaAire(p, now, rad) { var q3 = P[p], best = null, bd = rad * rad; for (var i5 = 0; i5 < objs.length; i5++) { var o5 = objs[i5]; if (o5.t0 > now + .02) break; if (now < o5.t0 || now >= o5.t1 || taken[o5.id] !== undefined || o5.dead) continue; var dx5 = o5.x - q3.x, dy5 = (o5.y - q3.y) * 1.2, d5 = dx5 * dx5 + dy5 * dy5; if (d5 < bd) { bd = d5; best = o5; } } return best; }
    function aterriza(it, x, z) {
      if (it.oro) { v3.part.soltar(x, .5, z, 24, { k: 'chispa', cols: ORO, vel: 4, arriba: 5, g: 12, vida: .8 }); V3.sfx('tambor'); v3.esc.sacudir(.35); }
      else v3.part.soltar(x, .3, z, 3, { k: 'chispa', cols: CREMA, vel: 1.4, arriba: 2, g: 12, vida: .35, esc: .6 });
    }
    function ponCotufa(it, o, now, t, dt) {
      var u = cl((now - o.t0) / (o.t1 - o.t0), 0, 1), x1 = WX(o.x), z1 = WZ(o.y), ch = String(o.id).charAt(0), base = it.oro ? .55 : .32, x, y, z;
      if (ch === 'e') { x = MQX + (x1 - MQX) * u; z = MQZ + (z1 - MQZ) * u; y = 6.6 * (1 - u) + base * u + Math.sin(u * Math.PI) * o.arc / 14; }      // sale disparada de la máquina
      else if (ch === 'h') { var x0 = WX(o.ox0), zz0 = WZ(o.oy0 + 30); x = x0 + (x1 - x0) * u; z = zz0 + (z1 - zz0) * u; y = 4.2 * (1 - u) + base * u + Math.sin(u * Math.PI) * o.arc / 18; }   // del balde del golpeado
      else { x = x1 - (o.wd || 0) * 7 * (1 - u); z = z1; y = base + (15 - base) * (1 - u * u); }                                                       // del techo, con gravedad (con viento, en diagonal)
      if (u >= 1) {
        if (!it.toco) { it.toco = true; aterriza(it, x, z); }
        var ag = now - o.t1;
        y = base + (it.oro ? .3 + Math.sin(t * 5) * .22 : Math.abs(Math.sin(ag * 10)) * .45 * Math.max(0, 1 - ag * 2.2));
      }
      it.g.visible = !(o.t2 - now < 1.2 && Math.floor(t * 12) % 2 === 1);
      it.g.position.set(x, y, z);
      if (u < 1) { it.g.rotation.x += 5 * dt; it.g.rotation.y += 7 * dt; } else { it.g.rotation.x *= .8; if (it.oro) it.g.rotation.y += 2 * dt; }
      /* la sombra y el aro van SIEMPRE en el punto de caída (x1, z1), no bajo la cotufa: con viento o en arco igual dicen dónde va a caer */
      var so = it.oro ? 1.8 : 1, uu = u * u;
      it.sh.visible = true; it.sh.position.set(x1, .04, z1);
      it.sh.scale.setScalar((.35 + .9 * uu) * so); it.sh.material.opacity = .45 + .45 * uu;   // crece y se oscurece hasta el aterrizaje (1,25 × y casi negra)
      it.mk.visible = u < 1; it.pu.visible = u < 1;
      if (u < 1) {
        it.mk.position.set(x1, .06, z1); it.mk.scale.setScalar((2.3 - 1.45 * u) * so * (1 + .05 * Math.sin(t * 18)));
        it.mk.material.opacity = .45 + .5 * u; it.pu.position.set(x1, .06, z1); it.pu.material.opacity = .4 + .5 * u;
      }
      if (it.oro) { v3.rayo.visible = true; v3.rayo.position.x = x; v3.rayo.position.z = z; v3.rayo.material.opacity = .14 + .08 * Math.sin(t * 6); v3.luzOro.position.set(x, 1.6, z); v3.luzOro.intensity = 1.4; }
    }
    function boom3D() {
      var V = v3, x = MQX, z = MQZ, k;
      V.tapaVy = 9; V.esc.sacudir(1.1); V3.sfx('trueno'); V3.sfx('pop');
      V.part.soltar(x, 6.8, z, 60, { k: 'chispa', cols: CREMA, vel: 7, arriba: 9, g: 12, vida: 1.4, esc: 1.4 });
      V.part.soltar(x, 6.8, z, 30, { k: 'confeti', cols: ['#fffdf2', '#ffd23f', '#ff5c6a'], vel: 5, arriba: 7, g: 5, vida: 2 });
      for (k = 0; k < V.gente.length; k++) { V.gente[k].vy = 3 + c.fx() * 2; V.gente[k].hy = 1; }
      V.sustoT = absT;
    }
    function recoge3D(p, o, v) {
      var s3 = v3.pjs[p], x = WX(o.x), z = WZ(o.y), oro = v > 1;
      v3.part.soltar(x, .7, z, oro ? 26 : 7, { k: 'chispa', cols: oro ? ORO : CREMA, vel: oro ? 5 : 2.6, arriba: oro ? 6 : 4, g: 12, vida: .6, esc: .9 });
      s3.pulso = 1; s3.popT = absT;
      for (var gi = 0; gi < v3.gente.length; gi += 2) v3.gente[gi].hy = Math.max(v3.gente[gi].hy, oro ? 1 : .25);   // el público grita (más con la dorada)
      if (oro) { v3.part.soltar(s3.x, 4.8, s3.z, 34, { k: 'confeti', cols: ORO, vel: 4, arriba: 5, g: 6, vida: 1.4 }); s3.pj.uno('festejo'); V3.sfx('moneda'); V3.sfx('aplauso'); v3.esc.sacudir(.5); }
      else if (absT - v3.popT > .05) { v3.popT = absT; V3.sfx('pop'); }
    }
    function embiste3D(p) {
      var s3 = v3.pjs[p]; if (!s3) return;
      s3.dashT = absT; s3.enojo = absT; s3.pj.uno('lanzar'); V3.sfx('whoosh');
      v3.part.soltar(s3.x, .3, s3.z, 8, { k: 'chispa', cols: ['#e8d8c0', '#fffdf2', '#c9a576'], vel: 2.4, arriba: 1.5, g: 8, vida: .45, esc: .7 });
    }
    function golpe3D(p, kk, de) {
      var T = THREE, s3 = v3.pjs[p]; if (!s3) return;
      s3.golpeT = absT; s3.pj.uno('golpe');
      v3.part.soltar(s3.x, 2.6, s3.z, 16, { k: 'chispa', cols: ['#ffd23f', '#fffdf2', '#ff8a8a'], vel: 5, arriba: 3, g: 6, vida: .5 });
      if (kk > 0) { v3.part.soltar(s3.x, 4.6, s3.z, 6 + kk * 5, { k: 'chispa', cols: CREMA, vel: 3.5, arriba: 6, g: 12, vida: .8, esc: 1.2 }); V3.sfx('pop'); }
      var onda = new T.Mesh(new T.RingGeometry(.6, .9, 24), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false }));
      onda.rotation.x = -Math.PI / 2; onda.position.set(s3.x, .06, s3.z); v3.esc.scene.add(onda); v3.ondas.push({ m: onda, t: absT });
      V3.sfx('golpe'); v3.esc.sacudir(kk > 0 ? .7 : .4);
      if (de >= 0 && de < n && v3.pjs[de]) v3.pjs[de].enojo = absT;
    }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, p, a, k;
      V.part.update(dt);
      /* lo que se mueve solo: polvo en el haz, la pantalla que titila, telones, público, acomodador, la máquina */
      V.polvoT -= dt; if (V.polvoT < 0) { V.polvoT = .2; V.part.soltar((c.fx() - .5) * 16, 8 + c.fx() * 5, (c.fx() - .5) * 14 + 2, 1, { k: 'chispa', cols: ['#fff6c0', '#fffdf2'], vel: .25, arriba: .1, g: .04, vida: 3.5, esc: .22, suelo: false }); }
      var boom = 0;
      for (a = 0; a < explT.length; a++) if (now >= explT[a] - 0.4 && now < explT[a] + 0.8) boom = Math.max(boom, 1 - Math.abs(now - explT[a]) / 0.8);
      V.pmat.color.setScalar(.9 + .06 * Math.sin(t * 23) * Math.sin(t * 7.3));
      for (a = 0; a < V.pliegues.length; a++) V.pliegues[a].rotation.z = Math.sin(t * .9 + a * .5) * .015;
      /* el público: mira arriba cuando cae algo, se da vuelta al acomodador y levanta los brazos cuando se emociona (hy); salta con la dorada, la explosión y la función */
      var caeN = enAire(now) ? 1 : 0, uaG = ujierAviso(now);
      for (a = 0; a < V.gente.length; a++) {
        var ge = V.gente[a], exc = (ge.hy = Math.max(0, ge.hy - dt * .5)), yaw = Math.sin(t * .45 + ge.f) * .7;
        if (uaG) yaw = cl((V.acx - ge.g.position.x) * .25, -.9, .9);
        ge.cab.rotation.y += (yaw - ge.cab.rotation.y) * Math.min(1, dt * 5);
        ge.cab.rotation.x += ((caeN ? -.3 : 0) - ge.cab.rotation.x) * Math.min(1, dt * 3);
        ge.cab.position.y = 2.05 + Math.sin(t * 2.2 + ge.f) * .04 + exc * .06 * Math.abs(Math.sin(t * 9 + ge.f));
        for (var kb = 0; kb < ge.br.length; kb++) ge.br[kb].pv.rotation.z = ge.br[kb].sx * (.1 + exc * (2.3 + .35 * Math.sin(t * 10 + ge.f + kb)));
        if (exc > .75 && ge.salto === 0 && ge.vy === 0 && ((ge.f * 37 + t * .6) % 1) < .03) ge.vy = 3.6;
        if (ge.bal) ge.bal.position.y = 1.5 + Math.max(0, Math.sin(t * 1.3 + ge.f)) * .5;            // se echa cotufas a la boca
        if (ge.vy !== 0 || ge.salto > 0) { ge.vy -= 14 * dt; ge.salto += ge.vy * dt; if (ge.salto <= 0) { ge.salto = 0; ge.vy = 0; } }
        ge.g.position.y = ge.salto;
      }
      /* EL ACOMODADOR: pasea atrás; cuando le toca, se para al borde alumbrando su carril (aviso) y lo cruza corriendo */
      var ua = ujierAviso(now), up = ujierEn(now);
      if (ua) {
        var tz = WZ(ua.y), tx = WX(up ? up.x : (ua.dir > 0 ? -30 : AW + 30)), kk3 = Math.min(1, dt * (up ? 30 : 5));
        V.acx += (tx - V.acx) * kk3; V.acz += (tz - V.acz) * kk3;
        V.acom.g.position.set(V.acx, 0, V.acz); V.acom.anim(up ? 'correr' : 'caminar', { vel: up ? 1 : .3 }).cara('enojado').rumbo(ua.dir > 0 ? Math.PI / 2 : -Math.PI / 2).mirar(Math.sin(t * 2.4) * .7, 0).update(dt);
        V.carril.visible = true; V.carril.position.set(0, .05, tz); V.carril.material.opacity = up ? .16 : .08 + .14 * Math.abs(Math.sin(t * 9));
        for (a = 0; a < V.flechasC.length; a++) { var fc4 = V.flechasC[a], fp = ((t * 1.4 + a / V.flechasC.length) % 1); fc4.visible = true; fc4.position.set((fp - .5) * AW * ESX * ua.dir, .08, tz); fc4.rotation.z = ua.dir > 0 ? -Math.PI / 2 : Math.PI / 2; fc4.rotation.x = -Math.PI / 2; }
        V.linterna.intensity = 2.2; V.linterna.position.set(V.acx, 2.6, V.acz); V.linterna.target.position.set(V.acx + ua.dir * 7, 0, V.acz);
      } else {
        V.acx += V.acd * 1.5 * dt; if (V.acx > 6.5) V.acd = -1; if (V.acx < -13) V.acd = 1;
        V.acz += (V.acz0 - V.acz) * Math.min(1, dt * 3);
        V.acom.g.position.set(V.acx, 0, V.acz); V.acom.anim('caminar', { vel: .35 }).cara('normal').rumbo(V.acd > 0 ? Math.PI / 2 : -Math.PI / 2).mirar(Math.sin(t * 1.3) * .8, -.1).update(dt);
        V.carril.visible = false; V.linterna.intensity = 0;
        for (a = 0; a < V.flechasC.length; a++) V.flechasC[a].visible = false;
      }
      /* la ESCALADA y los eventos: luz (apagón), luces locas y música del frenesí, el viento */
      var luz = apagon(now), fz = now >= 0 && now < dur ? fase(now) : 0;
      V.esc.luces.hemi.intensity = V.base[0] * luz; V.esc.luces.sol.intensity = V.base[1] * luz;
      V.luzLoca.intensity = fz === 2 && luz > .5 ? .5 + .6 * Math.abs(Math.sin(t * 8.8)) : 0;
      V.luzLoca.color.setHex(Math.floor(t * 2.8) % 2 ? 0xff4060 : 0xffc040);
      if (fz > V.faseV) { V.faseV = fz; V.esc.sacudir(fz === 2 ? .9 : .5); V3.sfx(fz === 2 ? 'bocina' : 'ding'); for (a = 0; a < V.gente.length; a++) V.gente[a].vy = 3 + c.fx() * 2; }
      for (a = 0; a < EVS.length; a++) {
        var e3 = EVS[a], sk3 = e3.k === 'ujier' ? 'silbato' : e3.k === 'viento' ? 'viento' : 'latido';
        if (!V.evV[a] && now >= e3.t - e3.av && now < e3.t + e3.d) { V.evV[a] = 1; V3.sfx(sk3); }
        if (V.evV[a] === 1 && now >= e3.t && now < e3.t + e3.d) {
          V.evV[a] = 2; V3.sfx(e3.k === 'apagon' ? 'trueno' : sk3); V.esc.sacudir(.35); V.sustoT = t;
          for (var gi2 = 0; gi2 < V.gente.length; gi2++) V.gente[gi2].hy = Math.max(V.gente[gi2].hy, e3.k === 'ujier' ? .3 : e3.k === 'viento' ? .6 : 1);   // el público se sobresalta (el silbato, el viento o el apagón)
        }
      }
      var vw3 = evDe('viento', now);
      for (a = 0; a < V.rachas.length; a++) {
        var rc = V.rachas[a]; rc.m.visible = !!vw3;
        if (vw3) { var rx = (((t * 24 + rc.f * 3) % 40) + 40) % 40 - 20; rc.m.position.set(rx * vw3.dir, rc.y, rc.z); }
      }
      if (vw3) for (a = 0; a < V.pliegues.length; a++) V.pliegues[a].rotation.z = vw3.dir * (.12 + .05 * Math.sin(t * 9 + a));
      V.olla.rotation.y += dt * (2 + boom * 10);
      for (a = 0; a < V.saltarinas.length; a++) { var sa = V.saltarinas[a], fa = (t * 1.6 + sa.f) % 1; sa.m.position.y = sa.y0 + Math.sin(fa * Math.PI) * (1.2 + boom * 1.5); sa.m.rotation.x = fa * 6; }
      for (a = 0; a < V.bombillos.length; a++) V.bombillos[a].emissiveIntensity = (Math.floor(t * 8) + a) % 3 === 0 ? 2.2 : .5;
      V.maq.position.x = MQX + Math.sin(t * 70) * .14 * boom;
      V.maq.scale.set(1 + .06 * boom, 1 - .04 * boom, 1 + .06 * boom);
      if (V.tapaVy !== 0 || V.tapaY > 0) { V.tapaVy -= 18 * dt; V.tapaY += V.tapaVy * dt; if (V.tapaY <= 0) { V.tapaY = 0; V.tapaVy = 0; V.esc.sacudir(.3); } }
      V.tapa.position.y = 6.25 + V.tapaY; V.tapa.rotation.z = V.tapaY * .08;
      V.luzM.intensity = (lv === 3 ? 1.3 : 0) + boom * 2.5;
      for (a = 0; a < explT.length; a++) if (!V.boomV[a] && now >= explT[a]) { V.boomV[a] = 1; if (now < explT[a] + 1) boom3D(); }
      if (!V.oroV && now >= goldT) { V.oroV = true; if (now < goldT + 1) { V3.sfx('ding'); for (a = 0; a < V.gente.length; a++) V.gente[a].vy = 2.5; } }
      /* las cotufas en juego (mismo filtro que el 2D) */
      for (a = 0; a < V.todas.length; a++) V.todas[a].usado = false;
      V.rayo.visible = false; V.luzOro.intensity = 0;
      for (a = 0; a < objs.length; a++) {
        var o = objs[a];
        if (o.t0 > now + 0.02) break;
        if (now >= o.t2 || taken[o.id] !== undefined || o.dead) continue;
        var it = V.uso[o.id];
        if (!it) { it = o.v > 1 ? (!V.oros[0].id ? V.oros[0] : !V.oros[1].id ? V.oros[1] : null) : libre(); if (!it) continue; it.id = o.id; it.toco = false; V.uso[o.id] = it; }
        it.usado = true; ponCotufa(it, o, now, t, dt);
      }
      for (a = 0; a < V.todas.length; a++) { var it2 = V.todas[a]; if (it2.id && !it2.usado) { delete V.uso[it2.id]; it2.id = null; it2.g.visible = false; it2.sh.visible = false; it2.mk.visible = false; it2.pu.visible = false; } }
      /* los jugadores */
      var fin = now >= dur, maxN = 0;
      for (p = 0; p < n; p++) maxN = Math.max(maxN, P[p].n | 0);
      if (fin && !V.finV) { V.finV = true; V3.sfx('aplauso'); for (p = 0; p < n; p++) if ((P[p].n | 0) >= maxN && maxN > 0) V.pjs[p].pj.uno('festejo'); }
      /* el oro: cuando toca el piso, todos se asustan; al que lo gana lo celebra (recoge3D) y los demás se quejan y caen */
      var oroA = oroEnAire(now);
      for (a = 0; a < 2; a++) {
        var gid = a ? 'g1' : 'g0', go = byId[gid];
        if (!go) continue;
        if (!V.oroLand[gid] && now >= go.t1) { V.oroLand[gid] = 1; V.sustoT = t; for (k = 0; k < V.gente.length; k++) V.gente[k].hy = Math.max(V.gente[k].hy, 1); }
        if (!V.oroDone[gid] && taken[gid] !== undefined) { V.oroDone[gid] = 1; for (p = 0; p < n; p++) if (p !== taken[gid]) { V.pjs[p].pj.uno('caer'); V.pjs[p].enojo = t; } }
      }
      for (p = 0; p < n; p++) {
        var q = P[p], s3 = V.pjs[p], kq = Math.min(1, dt * 22);
        s3.x += (WX(q.x) - s3.x) * kq; s3.z += (WZ(q.y) - s3.z) * kq;
        var vx = (s3.x - s3.px) / Math.max(dt, 1e-3), vz = (s3.z - s3.pz) / Math.max(dt, 1e-3), v = Math.sqrt(vx * vx + vz * vz);
        s3.px = s3.x; s3.pz = s3.z;
        if (v > .6) s3.rumbo = Math.atan2(vx, vz);
        var dash = !!q.ds || t - s3.dashT < DASH_T, stun = !!q.sn || t - s3.golpeT < STUN, pj = s3.pj, vn = Math.min(1, v / 9), gana = (q.n | 0) >= maxN && maxN > 0;
        /* atrapar: la cotufa que cae a menos de 46 px y toca el piso en menos de 0,32 s: salta y se estira hacia arriba */
        var cerca = cercanaAire(p, now, 240), tl = cerca ? cerca.t1 - now : 9, alcanza = !!cerca && tl <= .32 && tl > .04 && Math.abs(cerca.x - q.x) < 46 && Math.abs(cerca.y - q.y) < 46;
        if (alcanza && !fin && !stun && !dash && t - s3.saltoT > .8) { s3.saltoT = t; s3.estiraT = t; pj.uno('saltar'); }
        if (fin && now > 0) { pj.anim(gana ? 'celebrar' : 'triste').cara(gana ? 'feliz' : 'triste'); s3.rumbo = 0; }
        else if (stun) pj.anim('cargar', { vel: 0 }).cara('mareado');
        else if (dash) pj.anim('correr', { vel: 1 }).cara('enojado');
        else if (t - s3.popT < .5) pj.anim('celebrar', { vel: 1 }).cara('feliz');                                   // celebra cada cotufa que junta
        else pj.anim('cargar', { vel: vn }).cara(oroA || t - V.sustoT < .9 ? 'susto' : t - s3.golpeT < 1.2 ? 'triste' : t - s3.enojo < .8 ? 'enojado' : 'concentrado');
        /* la cabeza sigue lo que cae (la dorada manda): sube la vista según qué tan alto está; sin nada, mira alrededor */
        var mira = oroA || cerca, arriba = 0;
        if (mira && !fin && !stun && !dash) { var fr = cl((now - mira.t0) / (mira.t1 - mira.t0), 0, 1); pj.mirar(cl((mira.x - q.x) / 60, -1, 1), cl(1 - 2.2 * fr, -1, 1)); arriba = 1 - fr; }
        else pj.mirar(Math.sin(t * .6 + p * 1.3) * .5, 0);
        /* el cuerpo: se inclina atrás al aturdirse (linterna) y adelante al embestir; se estira al saltar y se aplasta al recoger */
        var lt = stun ? -.22 + Math.sin(t * 26) * .06 : dash ? .28 : -.1 * arriba;
        s3.lean += (lt - s3.lean) * Math.min(1, dt * 10);
        var e1 = Math.max(0, 1 - (t - s3.estiraT) / .3), e2 = Math.max(0, 1 - (t - s3.popT) / .3), sxz = 1 - .07 * e1 * e1 + .08 * e2 * e2, sy = 1 + .16 * e1 * e1 - .1 * e2 * e2;
        pj.g.rotation.x = s3.lean; pj.g.scale.set(sxz, sy, sxz);
        pj.rumbo(s3.rumbo).update(dt);
        pj.g.position.set(s3.x, 0, s3.z);
        pj.g.visible = !(now < q.inv && Math.floor(t * 14) % 2 === 1);
        s3.aro.position.set(s3.x, .04, s3.z);
        if (dash) { s3.rastro -= dt; if (s3.rastro < 0) { s3.rastro = .04; V.part.soltar(s3.x, .25, s3.z, 2, { k: 'chispa', cols: ['#e8d8c0', '#fffdf2'], vel: 1, arriba: 1.5, g: 6, vida: .4, esc: .6 }); } }
        if (vn > .45 && !stun && !fin) { s3.polvoT -= dt; if (s3.polvoT < 0) { s3.polvoT = .14; V.part.soltar(s3.x, .2, s3.z, 2, { k: 'chispa', cols: ['#e8d8c0', '#fffdf2'], vel: 1, arriba: 1, g: 6, vida: .45, esc: .6 }); } }   // polvo al correr
        /* el balde: arriba con los brazos, salta al recoger, tiembla aturdido; al final el que pierde lo deja en el piso */
        s3.pulso = Math.max(0, s3.pulso - dt * 4);
        var tirado = fin && now > 0 && !gana, bob = Math.sin(t * (6 + vn * 8)) * .06 * vn;
        if (tirado) { s3.balde.position.set(s3.x + .95, .43, s3.z + .3); s3.balde.rotation.set(0, 0, 0); }
        else { s3.balde.position.set(s3.x, 4.45 + bob + Math.sin(s3.pulso * Math.PI) * .35, s3.z); s3.balde.rotation.set(0, s3.rumbo, stun ? Math.sin(t * 30) * .18 : 0); }
        var ps = 1 + .25 * Math.sin(s3.pulso * Math.PI);
        s3.balde.scale.set(ps, 1 / ps * (1 + .1 * s3.pulso), ps);
        s3.monton.visible = (q.n | 0) > 0; s3.monton.scale.setScalar(.45 + .75 * Math.min(1, (q.n | 0) / 18));
        for (k = 0; k < 2; k++) { var es = s3.estrellas[k], ae = t * 8 + k * Math.PI; es.visible = !!stun && !fin; es.position.set(s3.x + Math.cos(ae) * .8, 3.6, s3.z + Math.sin(ae) * .8); es.rotation.y = t * 6; }
      }
      var yo = c.yo >= 0 ? V.pjs[c.yo] : null;
      V.flecha.visible = !!yo && !fin;
      if (yo) V.flecha.position.set(yo.x, 6.4 + Math.abs(Math.sin(t * 4)) * .3, yo.z);
      for (a = V.ondas.length - 1; a >= 0; a--) { var on = V.ondas[a], ag = t - on.t; if (ag > .6) { V.esc.scene.remove(on.m); V.ondas.splice(a, 1); continue; } on.m.scale.setScalar(1 + ag * 7); on.m.material.opacity = .8 * (1 - ag / .6); }
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), p, cx = (f.x0 + f.x1) / 2; v3T = absT;   // reloj cosmético del juego (absT avanza en update)
      if (dt > 0) actualizar3D(dt, now);                                          // sin update entre dos cuadros no hay nada que mover
      if (now >= 0 && now < dur) V3.musica(fase(now) === 2 ? 'cotufas_loca' : 'cotufas');
      else if (now >= dur && !v3.callado) { v3.callado = true; if (V3.callar) V3.callar(); }
      v3.esc.render(dt);
      for (p = 0; p < n; p++) {
        var s3 = v3.pjs[p], pt = v3.esc.proyectar(s3.x, 0, s3.z + 1.1), pb = v3.esc.proyectar(s3.x, 5.45, s3.z);
        txt(p === c.yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === c.yo ? '#ffd23f' : '#fffdf2', 0, true);
        txt(String(P[p].n | 0), pb.x, pb.y, 17, s3.pulso > 0 ? '#ffd23f' : '#fffdf2', 0, true);
      }
      for (var oi = 0; oi < 2; oi++) { var orx = v3.oros[oi]; if (orx.id && orx.g.visible) { var po = orx.g.position, pg = v3.esc.proyectar(po.x, po.y + 1.3, po.z); txt('×5', pg.x, pg.y, 18 + Math.sin(absT * 9) * 2, '#ffd23f', 0, true); } }
      if (banT > 0) txt(banner, cx, 84, 18 + Math.sin(absT * 14), '#ffd23f', 0, true);
      else if (now >= -0.4 && now < 1.8 && !c.practica) txt('¡PÁRATE EN LA SOMBRA Y AGARRA LA COTUFA!', cx, 84, 20, '#fffdf2', 0, true);
      else if (now >= 1.8 && now < 5 && !c.practica) txt('A = ¡EMBISTE! y el otro suelta 3', cx, 84, 15, '#fffdf2', 0, true);
    }

    var g = {
      update: function (dt) {
        var now = c.ahora(), p, a;
        absT += dt; banT = Math.max(0, banT - dt); shake = Math.max(0, shake - dt * 3); mouth = Math.max(0, mouth - dt);
        actualiza(now);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        for (var td in tarde) if (tarde.hasOwnProperty(td) && now >= tarde[td]) { var to = byId[td]; delete tarde[td]; if (to && taken[td] === undefined && pend[td] !== undefined) envia(to); else delete pend[td]; }
        if (c.juez()) {                                          // el juez cierra las ventanas de las CPU: si ningún humano ganó la cotufa, es de la CPU
          for (var id in cpuPend) if (cpuPend.hasOwnProperty(id)) {
            var cq = cpuPend[id];
            if (taken[id] !== undefined) { delete cpuPend[id]; continue; }
            if (now >= cq.t + VENT + espera()) { delete cpuPend[id]; c.ev('got', { id: id }, cq.p); }
          }
        }
        /* pendientes viejos (red perdida o juez migrado): se liberan para reintentar */
        for (var pk in pend) if (pend.hasOwnProperty(pk) && now - pend[pk] > 3.2) { delete pend[pk]; delete tarde[pk]; if (byId[pk]) { byId[pk].no = (byId[pk].no || 0) + 1; byId[pk].retry = now + 0.4; if (byId[pk].no >= 3) byId[pk].dead = 1; } }
        /* anuncios: dorada y explosiones (cosmético, mismos tiempos en todas las pantallas) */
        if (!lastGold && now >= goldT) { lastGold = true; banner = '¡LA COTUFA DE MANTEQUILLA! ×5'; banT = 2.2; SND(1200, 0.2, 'square', 0.07, 300); }
        if (byId.g1 && !byId.g1.avi && now >= byId.g1.t0) { byId.g1.avi = 1; banner = '¡OTRA DE MANTEQUILLA! ×5'; banT = 2.0; SND(1200, 0.2, 'square', 0.07, 300); }
        for (a = 0; a < explT.length; a++) {
          if (!explAv[a] && now >= explT[a] - 0.9 && now < explT[a]) { explAv[a] = 1; banner = lv >= 3 ? '¡LA MÁQUINA VA A EXPLOTAR!' : '¡LA OLLA SE VA A DESBORDAR!'; banT = 0.9; }
          if (!explDone[a] && now >= explT[a]) { explDone[a] = 1; banner = lv >= 3 ? '¡EXPLOTÓ LA MÁQUINA!' : '¡SE DESBORDÓ LA OLLA!'; banT = 2.2; shake = 0.7; mouth = 0.7; SND(110, 0.5, 'sawtooth', 0.1, -60); }
        }
        /* la escalada: cartel y sacudón al cambiar de fase */
        var fz = now >= 0 ? fase(now) : 0;
        if (fz > faseV) { faseV = fz; banner = fz === 1 ? '¡SE PRENDIÓ LA FUNCIÓN! ¡MÁS COTUFAS!' : '¡ÚLTIMOS SEGUNDOS! ¡LLUEVEN!'; banT = 2.0; shake = 0.6; SND(fz === 2 ? 990 : 760, 0.25, 'square', 0.07, 400); }
        /* los eventos de la sala: aviso ~1 s antes y cartel al empezar */
        for (a = 0; a < EVS.length; a++) {
          var ev = EVS[a];
          if (!evAv[a] && now >= ev.t - ev.av && now < ev.t) { evAv[a] = 1; banner = ev.k === 'ujier' ? '¡OJO! VIENE EL ACOMODADOR ' + (ev.dir > 0 ? '→' : '←') : ev.k === 'viento' ? '¡OJO! VA A SOPLAR EL AIRE ' + (ev.dir > 0 ? '→' : '←') : '¡SE VA A IR LA LUZ!'; banT = ev.av; SND(520, 0.08, 'square', 0.05, 0); }
          if (!evOn[a] && now >= ev.t) { evOn[a] = 1; if (now < ev.t + ev.d) { banner = ev.k === 'ujier' ? '¡SHHH! ¡APÁRTATE DEL ACOMODADOR!' : ev.k === 'viento' ? '¡VIENTO! LA SOMBRA DICE DÓNDE CAE' : '¡APAGÓN! SIGUE LOS AROS'; banT = Math.min(2, ev.d); shake = 0.3; SND(ev.k === 'apagon' ? 90 : 300, 0.3, 'sawtooth', 0.06, -40); } }
        }
      },
      ai: function (p, dt, api) { aiCpu(p, dt, api, c.ahora()); },
      cuerpo: function (p) {
        var q = P[p], now = c.ahora();
        return { x: Math.round(q.x), y: Math.round(q.y), n: q.n | 0, ds: now < q.dsT + DASH_T ? 1 : 0, fc: q.fc >= 0 ? 1 : -1, sn: now < q.snT ? 1 : 0 };
      },
      onEv: function (ty, p, d, t) {
        var now = c.ahora(), G = geom(), q = P[p], a;
        if (ty === 'shot' && d && q) {
          q.dsT = now; if (!c.mio(p)) q.ds = 1;
          juzgaShot(p, d, now);
          if (v3) embiste3D(p);
        } else if (ty === 'hit' && d && q) {
          q.hurt = now; q.inv = Math.max(q.inv, now + INV); q.mood = 0; hits++; shake = 0.4;
          var kk = Math.max(0, Math.min(KNOCK, d.k | 0)), T = (d.T | 0) / 1000, ang = (d.a || 0) * Math.PI / 180, jj;
          for (jj = 0; jj < kk; jj++) {
            var id = 'h' + p + '_' + d.s + '_' + jj;
            if (byId[id]) continue;
            var af = ang + (jj - 1) * 0.95, dd = 38 + 12 * jj;
            add({ id: id, x: cl(d.x + Math.cos(af) * dd, 24, AW - 24), y: cl(d.y + Math.sin(af) * dd * 0.7, YMIN, AH - 10), t0: T, t1: T + 0.45, v: 1, ox0: d.x, oy0: d.y - 30, arc: 46 });
          }
          objs.sort(function (a2, b2) { return a2.t0 - b2.t0 || (a2.id < b2.id ? -1 : 1); });
          var grito = d.de < 0 ? '¡SHHH!' : '¡' + (kk > 0 ? 'SUELTA' : 'AY') + '!';
          if (v3) { golpe3D(p, kk, d.de); var ph = v3.esc.proyectar(v3.pjs[p].x, 5.9, v3.pjs[p].z); S(grito, ph.x + 16, ph.y, '#ff8a8a'); }
          else {
            var sh = scr(G, d.x, d.y);
            S(grito, sh.x + 16, sh.y - 70 * G.k, '#ff8a8a');
            SPAWN(sh.x, sh.y - 30 * G.k, 10, 'conf', ['#fffdf2', '#ffd23f', '#ff8a8a'], 260, 450, 0.6);
            SND(150, 0.22, 'sawtooth', 0.08, -90);
          }
        } else if (ty === 'got' && d) {
          markTaken(String(d.id), p);
        }
        void t; void a;
      },
      claimOk: function (id, p, tMs) {
        var o = byId[id];
        if (!o || taken[id] !== undefined) return false;
        var t = tMs / 1000;
        if (p !== c.yo && !c.practica) { var sm = cl(c.ahora() - t - 0.12, 0, 0.6); lat = sm > lat ? lat * 0.5 + sm * 0.5 : lat * 0.93 + sm * 0.07; }
        if (t < o.t1 - 0.25 || t > o.t2 + 0.25) return false;
        if (cpuPend[id] && t >= cpuPend[id].t) return false;       // una CPU la tocó antes
        return true;
      },
      concede: function (id, p) { if (p >= 0) markTaken(String(id), p); },
      alCpu: function (p) { var r = c.remoto(p); if (r) { P[p].x = r.x; P[p].y = r.y; P[p].n = r.n | 0; } },
      alHum: function (p, o) { if (o) { P[p].x = o.x; P[p].y = o.y; P[p].n = o.n | 0; } },
      alRemoto: function () {},
      scores: function () { var out = [], p; for (p = 0; p < n; p++) out.push(Math.max(0, P[p].n | 0)); return out; },
      destacado: function () { var q = P[c.yo >= 0 ? c.yo : 0]; return q ? 'juntó ' + (q.n | 0) + ' cotufas' : ''; },
      vista: function () {
        var now = c.ahora();
        return { gt: now, lv: lv, hash: hash, nSched: nSched, nObjs: objs.length, taken: Object.keys(taken).length, x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }),
          n: P.map(function (q) { return q.n | 0; }), cd: P.map(function (q) { return q.cd; }), inv: P.map(function (q) { return q.inv; }), sn: P.map(function (q) { return q.snT > now ? 1 : 0; }),
          fase: now >= 0 ? fase(now) : 0, evs: EVS.map(function (e2) { return { k: e2.k, t: e2.t, d: e2.d, y: e2.y, dir: e2.dir }; }), ujier: ujierEn(now), luz: apagon(now),
          gold: byId.g0 ? [byId.g0.t0, byId.g0.t1, byId.g0.t2] : null, expl: explT.slice(), hits: hits, got: gotTot, objs: objs.map(function (o) { return { id: o.id, x: o.x, y: o.y, t0: o.t0, t1: o.t1, t2: o.t2, v: o.v }; }),
          lat: lat, pend: Object.keys(pend).length, cpuPend: Object.keys(cpuPend).length };
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
