'use strict';
/* LA FIESTA · EN VIVO · f_silbon · ¡EL SILBÓN EN EL LLANO!  (1v3, modelo B: dueño + juez)   ficha: docs/mario-party/08-minijuegos-realtime.md §"24. f_silbon"
   El llano de noche, luna y palmas. El SOLO es el Silbón (en tono de cómic: flaco, larguísimo, sombrero de cogollo y un silbido desafinado) y el TRÍO tiene
   que juntar mangos a oscuras y llevarlos al rancho, donde el bombillo del porche espanta al Silbón. Tensión de oscuridad: nadie ve lejos.

   REGLAS
   - SOLO (el Silbón). Stick: caminar (algo más rápido que el trío). A: SILBIDO: durante 1 s el Silbón ve a TODO el trío (enfriamiento 3 s); el trío oye el
     silbido y ve el aro de dónde salió («cuando se oye cerca está lejos…»). Atrapa por CONTACTO. No puede entrar a la luz del bombillo del rancho.
   - TRÍO. Stick: caminar. A: LINTERNA 2 s: en su círculo se ve al Silbón (lo ven los tres), pero la luz también delata al que la lleva (enfriamiento 4 s).
     Se recoge un mango al pasarle por encima (uno a la vez) y cuenta al llevarlo al bombillo del rancho.
   - QUIÉN VE QUÉ (solo dibujo y CPU; nada de esto se juzga): el Silbón ve al trío a VS px, con el silbido, con la linterna encendida o cerca del bombillo.
     El trío ve al Silbón a VT px de sí mismo, dentro de una linterna o cerca del bombillo; los compañeros se ven siempre. Los mangos brillan: todos los ven.
   - ATRAPADO (la víctima decide, modelo B). Cada pantalla dibuja y juega a los cuerpos remotos donde están AHORA: imagen de remoto() + su velocidad × su edad
     (el cuerpo lleva `tm`, el reloj de partida del dueño; interpolado da la hora exacta de la imagen). Dos caminos, los dos los decide la víctima:
     (a) el dueño de un miembro del trío ve al Silbón a < CR px de SU cuerpo; (b) la pantalla del Silbón lo ve tocar a un miembro remoto y manda ev
     `toque {v, x, y, t}`: la víctima lo confirma contra SU PROPIO recorrido en el instante t (±0,25 s) con el radio de toque + tolerancia al lag (crece con lo
     que tardó el toque en llegar, hasta +20 px: ficha). Si confirma (o en (a)) manda ev `atrapado {n, id, x, y}` (n acumulativo del dueño: idempotente;
     id = mango que llevaba o ''). El atrapado se va al chinchorro del rancho 4 s y el mango se le cae donde lo agarraron (objeto nuevo r<p>_<n> que cualquiera
     recoge). Nada de «espantos» que frenen a nadie: es amistoso. Sin (b), a 150 ms el Silbón casi no atrapaba (medido sobre el stack real).
   - Mangos = objetos del juez (`claim`): calendario (x, y, t0) sembrado por c.rng en mk(), idéntico en todas las pantallas. El dueño humano hace c.claim(id)
     optimista (el mango se esconde) y el juez concede (claimOk: existe, ya salió, nadie lo tiene, el que pide no lleva otro). Las CPU las simula el juez: ev `got {id}`.
     Entregar: ev `entrega {n, id}` del dueño (n acumulativo: el total = suma de los n, igual en todas las pantallas aunque los eventos lleguen en otro orden).
   - Silbido: ev `silbo {k, x, y}` del Silbón (o del juez por la CPU). La linterna viaja en el cuerpo (`l`).
   - Veredicto binario: el trío gana si junta NEED mangos (8) antes de 45 s. Puntaje aditivo/comparable (M3 DM3-3, M4 U=2): solo = 2·(mangos que faltan),
     cada miembro del trío = 1 fijo: gana el solo ⇔ falta al menos uno, sin empates. El veredicto lo da SOLO compara(). Fin temprano al llegar a NEED (0,9 s de festejo).
   PERILLA de balance del solo (objetivo 38-52 % con 4 CPU de igual habilidad): el número de mangos que hay que juntar, PERILLA.NEED por nivel (ficha: «número de
   mangos»): cada mango de más sube ~10 puntos al solo. Valor elegido NEED = 8 en los 3 niveles (lo que pide la ficha), con lo que se fijó de antemano por nivel:
   el Silbón ve a VS = 86 px y camina a 176 px/s (+20 % por feedback); el trío ve a VT = 96 / 66 / 62 px (más oscuro) y camina a 122 px/s; árboles 5 / 8 / 11; 16 mangos por partida.
   MEDIDO con docs/style-lab/pruebas/fiesta-silbon-bench.js (4 CPU skill .6, 200 semillas, veredicto por compara): semillas 1-200: lv1 43 % · lv2 45 % · lv3 46 %;
   en otros tres bloques de 200: 39,5-48 % (las 12 celdas dentro de 38-52). Con skill .35 / .85: 31-38 % / 55-61 % (informativo). Lo que define «igual habilidad»
   (reacción, error, lapsos) vive en `ai` y NO se toca una vez medido. Sobre el stack real (banco --red: 4 humanos-bot skill .6, sin pérdida, 40 partidas por celda):
   0 ms 40-68 % · 150 ms 48-73 % · 300 ms 10-25 % según el nivel (a 300 ms la víctima ya se fue cuando llega el toque: el lag favorece al trío).
   Niveles: 1 llano con 5 árboles · 2 más oscuro (el trío ve menos) y 8 árboles · 3 noche cerrada y 11 árboles.
   Gag: «Cuando se oye cerca está lejos…», y una CPU del trío que en el primer silbido corre HACIA él («¿quién silba? ¡voy a ver!») antes de darse cuenta.
   Sin Math.random / Date.now: azar de c.rng (nivel) o c.rngFor('cpu'+p) (CPU); lo cosmético de c.fx(). Solo rr / ell / line / poly / txt y c.util.pj. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || !FIESTA.LIVE || FIESTA.LIVE.get('f_silbon')) return;

/* ───── la perilla (única) y las constantes ───── */
/* MEDIDO (banco, 4 CPU skill .6, 200 semillas, veredicto por compara): ver «PERILLA de balance» en la cabecera. */
var PERILLA = { NEED: [6, 6, 6], MANGOS: 14 };                              // NEED (la perilla): mangos que hay que llevar al rancho, por nivel; MANGOS: cuántos salen en la partida
var SW = 440, SH = 270, AX0 = 12, AX1 = SW - 12, AY0 = 14, AY1 = SH - 6, PIVY = 130;
var Y0_SILBON = 34, LX = 220, LY = 252, NO_SILBON = 58, ENTREGA = 42, LUZ_RANCHO = 92;    // el bombillo del rancho: el Silbón no entra, ahí se entrega, y alumbra
var VENT_TOQUE = 0.25, TOL_K = 1.0, EDAD_MAX = 0.45, SPD_T = 122, SPD_S = 176, RB = 10, CR = 17, TOL_LAG = 20, PICK = 16;
var SIL_T = 1.0, SIL_CD = 3.0, LIN_T = 1.2, LIN_CD = 5.0, LIN_R = 100, FRZ = 6.0, CELEBRA = 0.9, FIRST = 1.0, RW = 150;
var VS = [86, 86, 86], VT = [96, 66, 62], NTREE = [5, 8, 11];
var M_INI = 3, M_FIN = 0.86, M_LEJOS = 118, M_ORO = 0.7;                     // 3 al empezar; el resto sale repartido hasta el 86 %; desde el 70 % salen MANGOS DE ORO (valen 2)
/* ESCALADA (fracción de dur: sirve igual a 45 s que a 10 s): LA NOCHE (<34 %) · ¡SE PUSO OSCURO! (34-70 %) · ¡ÚLTIMOS SEGUNDOS! LA HORA MÁS OSCURA (>=70 %) */
var FASES = [0.34, 0.7], OSC = [1, 0.84, 0.7], AUTO = [7, 5, 3.2], SPF = [1, 1.03, 1.08];   // SPF: el Silbón se apura por fase             // OSC: cuánto ve el trío por fase; AUTO: el Silbón silba SOLO si lleva tanto sin silbar
var REP = 54, CERCA = 125;                                                    // REP: la linterna ESPANTA (el Silbón no entra a REP px de una encendida); CERCA: silbido suave = ¡está cerca!
/* eventos del llano (calendario de c.rng en mk): nube que tapa la luna, estampida de ganado, relámpago. Aviso AVISO s antes. */
var OIDO_T = 2.4, ENCIMA = 70;                                  // lo que OYE el trío: el aro de distancia y el medidor duran OIDO_T; < ENCIMA px = «¡lo tengo encima!»
var AVISO = 0.9, NUBE_T = 3.5, NUBE_K = 0.55, RAYO_T = 0.7, VACA_V = 215, VACA_R = 15, NVACAS = 3, VACA_SEP = 36;
var NOM_FASE = ['', '¡SE PUSO OSCURO!', '¡ÚLTIMOS SEGUNDOS!'], SUB_FASE = ['', 'el trío ve menos · el Silbón silba más', 'la hora más oscura · ¡MANGOS DE ORO valen 2!'];
var PTS = 2, INK = '#14101c';
var PAL = {
  1: { cielo: '#1b2452', cielo2: '#33407a', suelo: '#22402c', suelo2: '#1c3725', borde: '#152a1c', luna: '#fff4c8', copa: '#2f6a3a', copa2: '#3f8a48', sil: '#0f2016', sil2: '#14291c' },
  2: { cielo: '#111838', cielo2: '#232c5a', suelo: '#1a3022', suelo2: '#152a1c', borde: '#0f1e14', luna: '#f6eebc', copa: '#265a30', copa2: '#337a3e', sil: '#0b1810', sil2: '#0f1f15' },
  3: { cielo: '#080b20', cielo2: '#151a3c', suelo: '#122318', suelo2: '#0f1e14', borde: '#09140d', luna: '#e8e2b8', copa: '#1f4a28', copa2: '#2a6634', sil: '#07100a', sil2: '#0a160e' }
};
var GRITOS_ATR = ['¡FIUUU!', '¡TE AGARRÓ EL SILBÓN!', '¡AL CHINCHORRO!', '¡AY, MI MANGO!'];
var GRITOS_ENT = ['¡+1 MANGO!', '¡PA\' LA CESTA!', '¡QUÉ MANGAZO!', '¡ESO!'];
function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
function num(v) { return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity; }
function hyp(x, y) { return Math.sqrt(x * x + y * y); }
function S(s, x, y, col) { if (typeof say === 'function') say(s, x, y, col); }
function SND(f, d, ty, v, sl) { if (typeof snd === 'function') snd(f, d, ty, v, sl); }
function SPAWN(x, y, n, k, cols, sp, g, life) { if (typeof spawn === 'function') spawn(x, y, n, k, cols, sp, g, life); }

FIESTA.LIVE.add('f_silbon', {
  name: '¡EL SILBÓN EN EL LLANO!', modos: ['1v3'], clase: 'binary', modelo: 'B', dur: 45,
  stick: true, botones: 1, bodyHz: 12, migra: true, minHumanos: 1,
  limites: { scoreMax: 16, scoreRate: 8, minT: 5, finTemprano: 1 },
  cuerpo: ['x', 'y', 'l', 'st', 'tm'], discretos: ['l', 'st'],
  perilla: PERILLA,
  carta: {
    obj: 'El trío lleva 7 mangos al rancho antes del amanecer. El Silbón los caza en la oscuridad.',
    gana: 'El trío gana si junta 7 mangos en la cesta antes de que amanezca (45 s). Si no, gana el Silbón.',
    como: { tactil: 'Joystick · A = silbido (Silbón) / linterna (trío)', teclado: 'WASD o flechas · ESPACIO' },
    roles: {
      solo: {
        obj: '¡ERES EL SILBÓN! Toca al trío en la oscuridad. La luz te espanta: linternas y bombillo.',
        como: { tactil: 'Joystick: caminar · A: silbar (1 s los ves a todos)', teclado: 'WASD caminar · ESPACIO silbar' },
        demos: [{ id: 'mover', txt: 'Tócalos y se van al chinchorro 4 s' }, { id: 'robar', txt: 'Silba (A): 1 s los ves a todos. Si no silbas, se te sale solo' }]
      },
      trio: {
        obj: 'Mangos al rancho antes del amanecer. Silbido FUERTE = está lejos · suave = ¡CERCA!',
        como: { tactil: 'Joystick: caminar · A: linterna (lo ves y lo ESPANTAS, pero te delata)', teclado: 'WASD o flechas · ESPACIO linterna' },
        demos: [{ id: 'mover', txt: 'Pasa por encima de un mango y llévalo al rancho' }, { id: 'saltar', txt: 'A: la linterna lo muestra y no lo deja acercarse' }]
      }
    },
    demos: [
      { id: 'mover', txt: 'Cuando se oye cerca está lejos… y cuando se oye lejos, ¡está cerca!' },
      { id: 'saltar', txt: 'La noche se pone más oscura: al final los mangos de oro valen 2' }
    ]
  },

  mk: function (c) {
    var n = c.n, lv = c.lv >= 3 ? 3 : c.lv <= 1 ? 1 : 2, dur = c.dur, pal = PAL[lv];
    var soloI = c.solo >= 0 && c.solo < n ? c.solo : 0;
    var NEED = PERILLA.NEED[lv - 1], vS = VS[lv - 1], vT = VT[lv - 1];
    var asiento = function (p) { return (c.seats && c.seats[p]) || { name: 'P' + (p + 1), color: '#fff', ch: null }; };
    var trio = [], slot = [], P = [], i;
    for (i = 0; i < n; i++) { if (i === soloI) slot.push(-1); else { slot.push(trio.length); trio.push(i); } }
    var nt = Math.max(1, trio.length), need = NEED;
    function casa(p) { var k = Math.max(0, slot[p]); return { x: LX - 26 + 26 * (k % 3), y: LY + 4 - (k > 2 ? 14 : 0) }; }
    for (i = 0; i < n; i++) {
      var h0 = i === soloI ? { x: SW / 2, y: 40 } : casa(i);
      P.push({ hist: [], edad: 0, x: h0.x, y: h0.y, px: h0.x, py: h0.y, vx: 0, vy: 0, l: 0, linT: -9, nextL: FIRST, frz: -9, lleva: null, nEnt: 0, vEnt: 0, ultS: 0, nAtr: 0, remL: 0, remSt: 0, nextS: FIRST, sk: 0, grace: -1 });
    }
    var cpuR = [], plan = [];
    for (i = 0; i < n; i++) { cpuR.push(c.rngFor('cpu' + i)); plan.push(planNuevo()); }
    function planNuevo() { return { re: -9, tx: 0, ty: 0, mem: null, flee: -9, alarma: -9, fx: 0, fy: 0, lastSil: -9, gag: -9, tgt: null, pat: null, patT: -9 }; }
    var isSolo = function (p) { return p === soloI; };

    /* ───── el escenario sale de c.rng (idéntico en todas las pantallas): árboles y calendario de mangos ───── */
    var rg = c.rng, trees = [], tries = 0;
    while (trees.length < NTREE[lv - 1] && tries < 400) {
      tries++;
      var tx = 40 + rg.next() * (SW - 80), ty = 34 + rg.next() * (SH - 90), tr = 12 + rg.next() * 5, ok = hyp(tx - LX, ty - LY) > 105 && hyp(tx - SW / 2, ty - 40) > 50, a;
      for (a = 0; a < trees.length; a++) if (hyp(tx - trees[a].x, ty - trees[a].y) < 70) ok = false;
      if (ok) trees.push({ x: tx, y: ty, r: tr });
    }
    var objs = [], byId = {}, nM = Math.max(M_INI + 1, PERILLA.MANGOS), mGap = dur * M_FIN / (nM - M_INI);
    for (i = 0; i < nM; i++) {
      var mx = 0, my = 0, t2 = 0, ok2 = false;
      while (!ok2 && t2 < 200) {
        t2++; mx = 24 + rg.next() * (SW - 48); my = 22 + rg.next() * (SH - 50); ok2 = hyp(mx - LX, my - LY) > M_LEJOS;
        for (a = 0; a < trees.length && ok2; a++) if (hyp(mx - trees[a].x, my - trees[a].y) < trees[a].r + 14) ok2 = false;
        for (a = Math.max(0, objs.length - 5); a < objs.length && ok2; a++) if (hyp(mx - objs[a].x, my - objs[a].y) < 46) ok2 = false;
      }
      var o0 = { id: 'm' + i, x: Math.round(mx), y: Math.round(my), t0: i < M_INI ? 0 : Math.round((i - M_INI + 1) * mGap * 100) / 100 };
      if (o0.t0 >= dur * M_ORO) o0.oro = 1;                                   // ¡ÚLTIMOS SEGUNDOS!: los que salen ahora son de oro (valen 2)
      objs.push(o0); byId[o0.id] = o0;
    }
    /* los eventos del llano: también de c.rng (iguales en todas las pantallas). Repartidos del 18 al 92 % y otra tanda en los últimos segundos */
    var EVS = [], tipos = ['nube', 'ganado', 'rayo'], tk = Math.floor(rg.next() * 3), nEv = Math.max(1, Math.round(dur / 11)), nEv2 = Math.max(dur >= 9 ? 1 : 0, Math.round(dur / 22));
    function evNuevo(t, k) {
      var e = { k: k, t: Math.round(t * 100) / 100, d: k === 'nube' ? NUBE_T : k === 'rayo' ? RAYO_T : 0 };
      if (k === 'ganado') { e.y = Math.round(60 + rg.next() * (SH - 150)); e.dir = rg.next() < 0.5 ? 1 : -1; e.d = (SW + 2 * VACA_R + NVACAS * VACA_SEP + 40) / VACA_V; }
      EVS.push(e);
    }
    for (i = 0; i < nEv; i++) evNuevo(dur * (0.18 + 0.5 * (i + 0.5) / nEv) + (rg.next() - 0.5) * dur * 0.05, tipos[(tk + i) % 3]);
    for (i = 0; i < nEv2; i++) evNuevo(dur * (0.74 + 0.2 * (i + 0.5) / nEv2) + (rg.next() - 0.5) * dur * 0.03, tipos[(tk + nEv + i) % 3]);
    function fase(now) { var u = now / dur; return u >= FASES[1] ? 2 : u >= FASES[0] ? 1 : 0; }
    function evOn(k, now) { var j; for (j = 0; j < EVS.length; j++) if (EVS[j].k === k && now >= EVS[j].t && now < EVS[j].t + EVS[j].d) return EVS[j]; return null; }
    function vTn(now) { return vT * OSC[fase(Math.max(0, now))] * (evOn('nube', now) ? NUBE_K : 1); }   // lo que ve el trío AHORA: la noche se cierra y la nube tapa la luna
    function vacas(now) {                                     // las reses de la estampida activa (círculos que empujan a cualquiera)
      var e = evOn('ganado', now), out = [], k2; if (!e) return out;
      var x0 = e.dir > 0 ? -VACA_R - 20 : SW + VACA_R + 20;
      for (k2 = 0; k2 < NVACAS; k2++) out.push({ x: x0 + e.dir * (VACA_V * (now - e.t) - k2 * VACA_SEP), y: e.y + (k2 % 2 ? 11 : -9), e: e, k: k2 });
      return out;
    }
    var taken = {}, gastado = {}, pend = {}, ent = 0, avisos = [], faseV = 0, evSt = [], oido = null, entAt = -1, atrTot = 0, silbo = { k: 0, t: -99, x: 0, y: 0 }, ruido = [], absT = 0, flash = 0, shake = 0, voz = {}, gagHecho = false;
    var cp = function () {
      var f = c.campo();
      if (typeof gameLeft === 'function' && typeof gameRight === 'function') f = { x0: gameLeft(), x1: gameRight(), y0: f.y0, y1: f.y1 };
      return f;
    };
    function geom() { var f = cp(), w = f.x1 - f.x0, cx = (f.x0 + f.x1) / 2; return { ox: cx - SW / 2, oy: PIVY + 44, cx: cx, k: Math.min(1, Math.max(0.45, (w - 8) / (SW + 24))), w: w }; }
    function scr(G, x, y) { return { x: G.cx + (G.ox + x - G.cx) * G.k, y: PIVY + (G.oy + y - PIVY) * G.k }; }

    /* ───── geometría ───── */
    function empuja(q, ox, oy, m) { var dx = q.x - ox, dy = q.y - oy, d = hyp(dx, dy); if (d < m) { if (d < 1e-6) { dx = 0; dy = -1; d = 1; } q.x = ox + dx / d * m; q.y = oy + dy / d * m; return true; } return false; }
    function resolve(q, rad, esSolo, now) {
      var j, o, dx, dy, d, m, vs = num(now) ? vacas(now) : [];
      q.x = cl(q.x, AX0 + rad, AX1 - rad); q.y = cl(q.y, AY0 + rad, AY1 - rad);
      for (j = 0; j < vs.length; j++) if (empuja(q, vs[j].x, vs[j].y, VACA_R + rad + 2)) q.pis = now;      // ¡la estampida te arrastra!
      if (esSolo && num(now)) for (j = 0; j < trio.length; j++) {                                           // la linterna ESPANTA: el Silbón no entra a su luz
        var t = trio[j]; if (linV(t) && !frzV(t, now) && empuja(q, P[t].x, P[t].y, REP)) q.esp = now;
      }
      for (j = 0; j < trees.length; j++) {
        o = trees[j]; dx = q.x - o.x; dy = q.y - o.y; d = hyp(dx, dy); m = o.r + rad;
        if (d < m) { if (d < 1e-6) { dx = 1; dy = 0; d = 1; } q.x = o.x + dx / d * m; q.y = o.y + dy / d * m; }
      }
      if (esSolo) { if (q.y < Y0_SILBON) q.y = Y0_SILBON; dx = q.x - LX; dy = q.y - LY; d = hyp(dx, dy); if (d < NO_SILBON) { if (d < 1e-6) { dx = 0; dy = -1; d = 1; } q.x = LX + dx / d * NO_SILBON; q.y = LY + dy / d * NO_SILBON; } }
      q.x = cl(q.x, AX0 + rad, AX1 - rad); q.y = cl(q.y, AY0 + rad, AY1 - rad);
    }
    function frzV(p, now) { return c.mio(p) ? now < P[p].frz : !!P[p].remSt; }
    function linV(p) { return c.mio(p) ? P[p].l : P[p].remL; }
    function activo(o, now) { return now >= o.t0 && taken[o.id] === undefined && !pend[o.id]; }
    function revelado(now) { return now >= silbo.t && now < silbo.t + SIL_T; }
    /* quién ve a quién (dibujo y CPU; nada se juzga con esto) */
    function soloVe(t, now) {
      var q = P[t], so = P[soloI];
      if (frzV(t, now)) return false;
      return revelado(now) || !!evOn('rayo', now) || !!linV(t) || hyp(q.x - so.x, q.y - so.y) < vS || hyp(q.x - LX, q.y - LY) < LUZ_RANCHO;
    }
    function enLinterna(x, y) { var a2, t; for (a2 = 0; a2 < trio.length; a2++) { t = trio[a2]; if (linV(t) && hyp(P[t].x - x, P[t].y - y) < LIN_R) return true; } return false; }
    function trioVe(p, now) {                                   // ¿el miembro p (o el espectador si p<0) ve al Silbón ahora?
      var so = P[soloI];
      if (hyp(so.x - LX, so.y - LY) < LUZ_RANCHO || enLinterna(so.x, so.y) || evOn('rayo', now)) return true;
      return p >= 0 && !frzV(p, now) && hyp(P[p].x - so.x, P[p].y - so.y) < vTn(now);
    }

    /* ───── mangos: claim al juez (humano) o ev got (CPU que simula el juez) ───── */
    function toma(id, p) {
      if (taken[id] !== undefined) return;
      var o = byId[id], now = c.ahora(); taken[id] = p;
      if (!o) return;
      ruido.push({ x: o.x, y: o.y, t: now }); if (ruido.length > 8) ruido.shift();
      if (p >= 0 && p < n && !isSolo(p) && !gastado[id] && !P[p].lleva && !(c.mio(p) && now < P[p].frz)) P[p].lleva = id;
      var sm = pnt(o.x, o.y, -40, 2.4);
      if (p === c.yo) S('¡MANGO!', sm.x, sm.y, '#ffb02e');
      if (v3) toma3D(o, p);
      else { var G = geom(), sp = scr(G, o.x, o.y - 10); if (p === c.yo) SND(720, 0.08, 'square', 0.05, 260); SPAWN(sp.x, sp.y, 7, 'conf', ['#ffb02e', '#ffd23f', '#5cc24a'], 180, 360, 0.5); }
    }
    function recoge(p, now) {
      var q = P[p], j, o;
      if (q.lleva || now < q.frz) return;
      for (j = 0; j < objs.length; j++) {
        o = objs[j];
        if (!activo(o, now) || hyp(q.x - o.x, q.y - o.y) > PICK) continue;
        if (p === c.yo) {
          if (Object.keys(pend).length) return;
          pend[o.id] = 1;
          (function (oo) { c.claim(oo.id, function (res) { delete pend[oo.id]; if (res !== 'ok' && taken[oo.id] === undefined) oo.no = (oo.no || 0) + 1; }); })(o);
        } else c.ev('got', { id: o.id }, p);
        return;
      }
    }
    function valor(id) { var o = byId[id]; return o && o.oro ? 2 : 1; }
    function nuevoCaido(id, x, y, now, oro) {
      if (byId[id]) return;
      var o = { id: id, x: x, y: y, t0: now + 0.5, caido: 1, oro: oro ? 1 : 0 }, tt = { x: x, y: y };
      resolve(tt, 6, false, null); o.x = Math.round(tt.x); o.y = Math.round(tt.y);
      if (hyp(o.x - LX, o.y - LY) < ENTREGA + 8) { o.x = LX; o.y = LY - ENTREGA - 10; }
      objs.push(o); byId[id] = o;
    }

    /* ───── juicio: cada dueño juzga SU cuerpo ───── */
    function juzga(p, now) {
      var q = P[p], so = P[soloI];
      if (now < q.frz || now < q.grace) return;
      if (q.lleva && hyp(q.x - LX, q.y - LY) < ENTREGA) { c.ev('entrega', { n: q.nEnt + 1, id: q.lleva, v: q.vEnt + valor(q.lleva) }, p); return; }
      if (now < FIRST * 0.5 || q.l) return;                       // con la linterna encendida el Silbón no te puede tocar (lo espanta)
      if (hyp(q.x - so.x, q.y - so.y) < CR && hyp(q.x - LX, q.y - LY) >= NO_SILBON - CR) atrapa(p);
    }
    function atrapa(p) { var q = P[p]; c.ev('atrapado', { n: q.nAtr + 1, id: q.lleva || '', x: Math.round(q.x), y: Math.round(q.y) }, p); }
    /* el Silbón (su dueño) ve a un miembro remoto que toca: manda ev `toque {v, x, y, t}` y la VÍCTIMA lo confirma contra SU propio recorrido del último
       VENT_TOQUE s (lo que vio el Silbón es la imagen atrasada de la víctima) con el mismo radio +20 px. Así el lag no deja al Silbón sin atrapar a nadie. */
    var toqueAt = {};
    function tocaSilbon(now) {
      var so = P[soloI], a2, t;
      for (a2 = 0; a2 < trio.length; a2++) {
        t = trio[a2];
        var vq = P[t];                                          // P[t] ya es la posición estimada de AHORA (imagen + velocidad × edad)
        if (c.mio(t) || vq.remSt || vq.remL || now < (toqueAt[t] || -9) || hyp(vq.x - so.x, vq.y - so.y) >= CR || hyp(vq.x - LX, vq.y - LY) < NO_SILBON - CR) continue;
        toqueAt[t] = now + 0.15;
        c.ev('toque', { v: t, x: Math.round(so.x), y: Math.round(so.y), t: Math.round(now * 1000) }, soloI);
      }
    }
    function confirmaToque(v, d, now) {
      var q = P[v], j, t0 = d.t / 1000, h;
      if (!c.mio(v) || now < q.frz || now < q.grace || t0 > now + 0.2 || t0 < now - 2) return;
      /* los relojes de partida coinciden: se mira DÓNDE ESTABA YO en el instante t0 del toque (±VENT_TOQUE). La tolerancia crece con lo que tardó el toque
         en llegar (≈ el atraso con que el Silbón me vio) hasta +20 px (ficha): sin lag es el mismo toque que en el banco, con lag no deja al Silbón en blanco */
      var ta = t0, tol = cl(TOL_K * SPD_T * (now - t0), 0, TOL_LAG);
      for (j = 0; j < q.hist.length; j++) {
        h = q.hist[j];
        if (h.t < ta - VENT_TOQUE || h.t > ta + VENT_TOQUE || h.l) continue;
        if (hyp(h.x - d.x, h.y - d.y) < CR + tol && hyp(h.x - LX, h.y - LY) >= NO_SILBON - CR) { atrapa(v); return; }
      }
    }

    /* ───── movimiento ───── */
    function velo(q, dt) { if (dt > 0) { q.vx = q.vx * 0.75 + (q.x - q.px) / dt * 0.25; q.vy = q.vy * 0.75 + (q.y - q.py) / dt * 0.25; } q.px = q.x; q.py = q.y; }
    function silba(p, now) {
      var q = P[p];
      if (now < q.nextS || now < FIRST) return false;
      q.nextS = now + SIL_CD; q.ultS = now;
      c.ev('silbo', { k: silbo.k + 1, x: Math.round(q.x), y: Math.round(q.y) }, p);
      return true;
    }
    function updPos(p, dt, now) {
      var q = P[p];
      if (!c.mio(p)) {
        var r = c.remoto(p);
        if (r) {                                                 // la imagen llega atrasada: se dibuja y se juega donde está AHORA (imagen + su velocidad × su edad, por tm)
          if (q.ix == null || hyp(r.x - q.ix, r.y - q.iy) > 60) { q.ivx = 0; q.ivy = 0; }
          else if (dt > 0) { q.ivx = q.ivx * 0.7 + (r.x - q.ix) / dt * 0.3; q.ivy = q.ivy * 0.7 + (r.y - q.iy) / dt * 0.3; }
          q.ix = r.x; q.iy = r.y; q.remL = r.l ? 1 : 0; q.remSt = r.st ? 1 : 0; q.edad = num(r.tm) ? cl(now - r.tm / 20, 0, EDAD_MAX) : 0;
          var ed = q.remSt ? 0 : q.edad; q.x = cl(r.x + q.ivx * ed, AX0, AX1); q.y = cl(r.y + q.ivy * ed, AY0, AY1);
        }
        velo(q, dt);
        return;
      }
      var e = c.eje(p), taps = c.tap(p, 'a'), m = hyp(e.x, e.y);
      if (m > 1) { e = { x: e.x / m, y: e.y / m }; }
      if (now < 0) { velo(q, dt); return; }
      if (isSolo(p)) {
        q.x += e.x * SPD_S * SPF[fase(now)] * dt; q.y += e.y * SPD_S * SPF[fase(now)] * dt; resolve(q, RB, true, now);
        if (taps > 0) silba(p, now);
        else if (now - Math.max(q.ultS, 0) >= AUTO[fase(now)]) silba(p, now);     // no se aguanta: si no silba, se le sale solo (y cada vez más seguido)
      } else {
        if (now < q.frz) { var hc = casa(p); q.x = hc.x; q.y = hc.y; q.l = 0; velo(q, dt); return; }
        q.x += e.x * SPD_T * dt; q.y += e.y * SPD_T * dt; resolve(q, RB, false, now);
        if (taps > 0 && now >= q.nextL) { q.linT = now; q.nextL = now + LIN_T + LIN_CD; if (p === c.yo) SND(520, 0.06, 'square', 0.04, 120); }
        q.l = now < q.linT + LIN_T ? 1 : 0;
        q.hist.push({ t: now, x: q.x, y: q.y, l: q.l }); while (q.hist.length && q.hist[0].t < now - 1.2) q.hist.shift();
        recoge(p, now);
      }
      velo(q, dt);
    }

    /* ───── IA ───── */
    function lapso(sk, R2, base) { return R2.next() < base * (1 - sk); }
    function evitaArboles(q, dx, dy) {                          // dirección deseada + empuje lateral para rodear los árboles
      var j, o, ox, oy, d, mx = dx, my = dy;
      for (j = 0; j < trees.length; j++) {
        o = trees[j]; ox = q.x - o.x; oy = q.y - o.y; d = hyp(ox, oy);
        if (d < o.r + 26 && d > 0.5 && (ox * dx + oy * dy) < 0) { var s = (o.r + 26 - d) / 26; mx += (ox / d) * s * 1.2 - (oy / d) * s * (dx * oy - dy * ox > 0 ? -1 : 1) * 0.8; my += (oy / d) * s * 1.2 + (ox / d) * s * (dx * oy - dy * ox > 0 ? -1 : 1) * 0.8; }
      }
      var l = hyp(mx, my); return l > 1e-6 ? { x: mx / l, y: my / l } : { x: 0, y: 0 };
    }
    function hacia(api, q, tx, ty, um) {
      var dx = tx - q.x, dy = ty - q.y, d = hyp(dx, dy);
      if (d <= (um || 4)) { api.eje(0, 0); return true; }
      var v = evitaArboles(q, dx / d, dy / d); api.eje(v.x, v.y); return false;
    }
    function huye(q, fx, fy, goalX, goalY, sesgo) {             // la mejor de 16 direcciones: lejos de (fx,fy), sin paredes, algo hacia la meta
      var best = null, bs = -1e9, k;
      for (k = 0; k < 16; k++) {
        var a2 = k / 16 * 6.2832, dx = Math.cos(a2), dy = Math.sin(a2), nx = q.x + dx * 40, ny = q.y + dy * 40;
        var s = hyp(nx - fx, ny - fy) - Math.max(0, 30 - Math.min(nx - AX0, AX1 - nx, ny - AY0, AY1 - ny)) * 3;
        var gd = hyp(goalX - q.x, goalY - q.y); if (gd > 1) s += ((goalX - q.x) * dx + (goalY - q.y) * dy) / gd * sesgo;
        var j; for (j = 0; j < trees.length; j++) if (hyp(nx - trees[j].x, ny - trees[j].y) < trees[j].r + 12) s -= 25;
        if (s > bs) { bs = s; best = { x: dx, y: dy }; }
      }
      return best;
    }
    function aiTrio(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], so = P[soloI];
      if (now < 0 || now < q.frz) { api.eje(0, 0); return; }
      var rt = 0.32 - 0.22 * sk;
      /* lo que sabe del Silbón: lo que su pantalla vería (con su tiempo de reacción) */
      if (now >= pl.re) {
        pl.re = now + rt + R2.next() * 0.08;
        if (trioVe(p, now)) pl.mem = { x: so.x, y: so.y, t: now };
        if (silbo.t > pl.lastSil && now - silbo.t >= rt) {
          pl.lastSil = silbo.t;
          /* solo sabe lo que OYE: suave = cerca (no sabe por dónde). Prende la linterna (lo ve y lo espanta) y se arrima al rancho */
          if (!gagHecho && slot[p] === nt - 1 && nt >= 2) { gagHecho = true; pl.gag = now + 1.1; var sg = pnt(q.x, q.y, -100, 4.4); S('¿QUIÉN SILBA? ¡VOY A VER!', sg.x, sg.y, '#fffdf2'); }
          else if (hyp(q.x - silbo.x, q.y - silbo.y) < CERCA) { pl.alarma = now + 0.8 + 0.6 * sk; pl.flee = now + 0.4 + 0.5 * sk * (hyp(q.x - silbo.x, q.y - silbo.y) < ENCIMA ? 1.5 : 1); if (now >= q.nextL && R2.next() < 0.35 + 0.55 * sk) api.press('a'); }   // suena bajito: huye
        }
      }
      if (now < pl.gag) { hacia(api, q, silbo.x, silbo.y, 6); return; }                               // el gag: corre HACIA el silbido
      if (pl.gag > 0 && now >= pl.gag && !voz['gag' + p]) { voz['gag' + p] = 1; var s2 = pnt(q.x, q.y, -100, 4.4); S('¡AY, NO! ¡ERA ÉL!', s2.x, s2.y, '#ff8a5a'); pl.flee = now + 1.2; }
      if (lapso(sk, R2, 0.02)) { api.eje(0, 0); return; }
      var goal = q.lleva || (now < pl.alarma && !(pl.mem && now - pl.mem.t < 1)) ? { x: LX, y: LY } : null;
      if (!goal) {                                                                                     // con codicia: el mango más cercano que no esté junto al Silbón
        var j, o, bs = 1e9, bo = null;
        for (j = 0; j < objs.length; j++) {
          o = objs[j]; if (!activo(o, now)) continue;
          var s = hyp(o.x - q.x, o.y - q.y);
          if (pl.mem && now - pl.mem.t < 3 && hyp(o.x - pl.mem.x, o.y - pl.mem.y) < 90) s += 160;
          for (var a2 = 0; a2 < trio.length; a2++) { var t = trio[a2]; if (t !== p && !P[t].lleva && !frzV(t, now) && hyp(o.x - P[t].x, o.y - P[t].y) < s * 0.8) s += 70; }
          if (pl.tgt === o.id) s -= 25;
          if (o.oro) s -= 30;
          if (s < bs) { bs = s; bo = o; }
        }
        if (bo) { pl.tgt = bo.id; goal = { x: bo.x, y: bo.y }; } else goal = { x: LX, y: LY - 90 };
      }
      var cerca = pl.mem && now - pl.mem.t < 1.4 && hyp(q.x - pl.mem.x, q.y - pl.mem.y) < 105 + 25 * sk && hyp(q.x - LX, q.y - LY) > ENTREGA - 4;
      if (now < pl.flee || cerca) {                                                                    // huye: del Silbón visto o del silbido cercano
        var fx = pl.mem ? pl.mem.x : silbo.x, fy = pl.mem ? pl.mem.y : silbo.y, hv = huye(q, fx, fy, q.lleva ? LX : goal.x, q.lleva ? LY : goal.y, q.lleva ? 26 : 12);
        if (hv) { api.eje(hv.x, hv.y); }
      } else hacia(api, q, goal.x, goal.y, 2);
      /* linterna: si lo tiene encima, la prende para espantarlo; a ratos, a oscuras y lejos del rancho, para ver dónde anda */
      if (now >= q.nextL && !q.l) {
        if (pl.mem && now - pl.mem.t < 0.8 && hyp(q.x - pl.mem.x, q.y - pl.mem.y) < 70 + 20 * sk && R2.next() < dt * (1 + 3 * sk)) api.press('a');
        else if (hyp(q.x - LX, q.y - LY) > 120 && (!pl.mem || now - pl.mem.t > 2.2) && R2.next() < dt * (0.12 + 0.2 * sk)) api.press('a');
      }
    }
    function aiSolo(p, dt, api, now) {
      var q = P[p], sk = c.skill[p], R2 = cpuR[p], pl = plan[p], a2, t;
      if (now < 0 || now < q.grace) { api.eje(0, 0); return; }
      if (now >= pl.re) {
        pl.re = now + 0.2 + (1 - sk) * 0.28 + R2.next() * 0.08;
        var best = -1, bd = 1e9;
        for (a2 = 0; a2 < trio.length; a2++) {
          t = trio[a2];
          if (!soloVe(t, now) || hyp(P[t].x - LX, P[t].y - LY) < NO_SILBON + 4) continue;
          var d = hyp(P[t].x - q.x, P[t].y - q.y) + (P[t].lleva ? -30 : 0) + (linV(t) ? 60 + 80 * sk : 0);   // con la linterna prendida no se deja agarrar
          if (d < bd) { bd = d; best = t; }
        }
        if (best >= 0) {
          var lead = 0.15 + 0.35 * sk, er = (R2.next() - 0.5) * 30 * (1 - sk), bq = P[best];
          pl.tgt = best; pl.mem = { x: bq.x + bq.vx * lead + er, y: bq.y + bq.vy * lead + er, t: now };
        } else pl.tgt = null;
        var r0 = ruido.length ? ruido[ruido.length - 1] : null;
        if (!pl.tgt && r0 && now - r0.t < 4 && (!pl.mem || r0.t > pl.mem.t)) pl.mem = { x: r0.x, y: r0.y, t: r0.t };      // va al último ruido
        if (!pl.tgt && (!pl.mem || now - pl.mem.t > 1.2 || hyp(q.x - pl.mem.x, q.y - pl.mem.y) < 14) && now >= q.nextS && !lapso(sk, R2, 0.5)) api.press('a');   // ¿dónde andan? ¡FIUUU!
      }
      if (pl.tgt != null) { var tq = P[pl.tgt]; if (soloVe(pl.tgt, now)) { hacia(api, q, cl(tq.x + tq.vx * 0.2, AX0, AX1), cl(tq.y + tq.vy * 0.2, AY0, AY1), 0); return; } }
      if (pl.mem && now - pl.mem.t < 3.5 && hyp(q.x - pl.mem.x, q.y - pl.mem.y) > 12) { hacia(api, q, pl.mem.x, pl.mem.y, 4); return; }
      if (!pl.pat || now > pl.patT || hyp(q.x - pl.pat.x, q.y - pl.pat.y) < 14) {                   // patrulla: entre un mango y el rancho (por ahí pasará el trío)
        var lst = [], j; for (j = 0; j < objs.length; j++) if (activo(objs[j], now)) lst.push(objs[j]);
        var o = lst.length ? lst[Math.floor(R2.next() * lst.length)] : { x: SW / 2, y: SH / 2 };
        pl.pat = { x: (o.x + LX) / 2 * 0.6 + o.x * 0.4, y: (o.y + LY) / 2 * 0.6 + o.y * 0.4 }; pl.patT = now + 2 + R2.next() * 1.5;
      }
      hacia(api, q, pl.pat.x, pl.pat.y, 6);
    }

    /* ───── dibujo (solo rr / ell / line / poly / txt / c.util.pj) ───── */
    function fondo(f, G) {
      var x0 = f.x0, x1 = f.x1, w = x1 - x0, k;
      rr(x0, 0, w, 180, 0, pal.cielo, 0); rr(x0, 112, w, 68, 0, pal.cielo2, 0); rr(x0, 172, w, 520, 0, pal.borde, 0);
      for (k = 0; k < 22; k++) ell(x0 + ((k * 137 + 29) % w), 10 + (k * 31) % 84, k % 5 ? 1.3 : 2, k % 5 ? 1.3 : 2, '#fffdf2', 0);
      var mx = x1 - 96, my = 48; ell(mx, my, 24, 24, pal.luna, 0); ell(mx - 7, my - 6, 5, 4, '#e6d9a4', 0); ell(mx + 8, my + 7, 4, 3, '#e6d9a4', 0);
      /* el horizonte del llano con palmas de moriche en silueta */
      poly([[x0, 174], [x0, 158], [x0 + w * 0.3, 154], [x0 + w * 0.6, 160], [x1, 152], [x1, 174]], '#0f1a2a', 0);
      for (k = 0; k < 6; k++) { var px = x0 + 30 + ((k * 151) % Math.max(60, w - 60)), ph = 30 + (k * 13) % 18; palma(px, 162, ph); }
    }
    function palma(x, y, h) {
      line([[x, y], [x + 2, y - h]], 3, '#0b1220');
      var k; for (k = 0; k < 5; k++) { var a = -2.6 + k * 0.55; line([[x + 2, y - h], [x + 2 + Math.cos(a) * 14, y - h + Math.sin(a) * 6 + 5]], 3, '#0b1220'); }
    }
    function suelo(G) {
      var wx = G.w / G.k + 8, k;
      rr(G.cx - wx / 2, G.oy - 8, wx, SH + 70, 0, pal.borde, 0);
      rr(G.ox - 6, G.oy - 4, SW + 12, SH + 10, 6, pal.suelo, 3.5);
      for (k = 0; k < 40; k++) { var gx = G.ox + 14 + ((k * 97) % (SW - 28)), gy = G.oy + 10 + ((k * 61) % (SH - 20)); rr(gx, gy, 4, 2, 0, pal.suelo2, 0); }
    }
    function sombra(x, y, rx, ry) { ctx.save(); ctx.globalAlpha = 0.35; ell(x, y, rx, ry, '#06080a', 0); ctx.restore(); }   // sombra con alfa (las rgba() no pasan por el color del estilo)
    function charco(x, y, r, col, a) { ctx.save(); ctx.globalAlpha = a; ell(x, y, r, r, col, 0); ctx.globalAlpha = a * 0.8; ell(x, y, r * 0.66, r * 0.66, col, 0); ctx.restore(); }
    function rancho(G, now) {
      var x = G.ox + LX, y = G.oy + LY;
      charco(x, y, LUZ_RANCHO, '#ffe9a0', 0.12 + 0.02 * Math.sin(absT * 7));
      rr(x - 60, y + 14, 120, 30, 3, '#7a5a3a', 3); rr(x - 18, y + 20, 22, 24, 2, '#3a2a1a', 2.5);
      poly([[x - 76, y + 18], [x, y - 6], [x + 76, y + 18]], '#c9a35a', 3.5);
      for (var k = 0; k < 6; k++) line([[x - 62 + k * 24, y + 14], [x - 54 + k * 24, y + 4]], 2, '#a8843e');
      line([[x + 44, y + 16], [x + 44, y - 34]], 4, '#5a4026'); line([[x + 44, y - 34], [x + 32, y - 34]], 3, '#5a4026');
      ell(x + 32, y - 28, 6, 6, '#fff6b0', 2.5);
      /* la cesta de mangos */
      rr(x + 18, y - 6, 26, 14, 4, '#a8743a', 2.5); var kk; for (kk = 0; kk < Math.min(ent, 8); kk++) ell(x + 22 + (kk % 4) * 6, y - 8 - Math.floor(kk / 4) * 4, 3.5, 3.5, '#ffb02e', 1.5);
      txt(ent + '', x + 31, y + 18, 10, '#fffdf2', 0, true);
    }
    function arbol(x, y, r, vis) {                              // a oscuras: silueta; con luz: verde y con un mango arriba
      sombra(x, y + 3, r + 6, 5);
      rr(x - 4, y - 22, 8, 24, 2, vis ? '#5a3d24' : pal.sil, 2.5);
      ell(x, y - 34, r + 12, r + 6, vis ? pal.copa : pal.sil, 3);
      if (vis) { ell(x - 6, y - 38, r + 2, r - 2, pal.copa2, 0); ell(x + 7, y - 40, 4, 3, '#ffb02e', 1.5); }
      else ell(x - 5, y - 38, r, r - 4, pal.sil2, 0);
    }
    function alumbrado(x, y, now) {                             // ¿la pantalla de c.yo ve este punto? (solo dibujo)
      var yo = c.yo;
      if (yo < 0 || yo >= n || hyp(x - LX, y - LY) < LUZ_RANCHO || enLinterna(x, y) || evOn('rayo', now)) return true;
      if (isSolo(yo)) return hyp(x - P[soloI].x, y - P[soloI].y) < vS;
      return !frzV(yo, now) && hyp(x - P[yo].x, y - P[yo].y) < vTn(now);
    }
    function mango(x, y, now, o) {
      var b = Math.sin(absT * 5 + x) * 1.5, vida = now - o.t0;
      if (vida < 0) return;
      ctx.save(); ctx.globalAlpha = 0.22 + 0.08 * Math.sin(absT * 4 + y); ell(x, y - 6 + b, o.oro ? 20 : 13, o.oro ? 18 : 12, o.oro ? '#fff27a' : '#ffcf5a', 0); ctx.restore();
      if (o.oro) txt('×2', x, y - 22 + b, 10, '#fff27a', 0, true);
      sombra(x, y + 2, 7, 3);
      ell(x, y - 6 + b, 6.5, 7.5, '#ffb02e', 2); ell(x + 2, y - 4 + b, 3, 3.5, '#f0801c', 0); ell(x - 2, y - 9 + b, 1.6, 1.6, '#fff1b0', 0);
      poly([[x, y - 13 + b], [x + 6, y - 17 + b], [x + 3, y - 12 + b]], '#5cc24a', 1.5);
    }
    function persona(p, x, y, now, frz, lin) {
      var s = asiento(p), col = s.color || '#9a8cff';
      ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8); ctx.translate(-x, -y);
      sombra(x, y + 2, 18, 5);
      rr(x - 10, y - 24, 8, 22, 4, '#2f3a7a', 3); rr(x + 2, y - 24, 8, 22, 4, '#2f3a7a', 3);
      rr(x - 14, y - 58, 28, 36, 10, col, 3.5);
      if (lin) { rr(x + 12, y - 46, 12, 7, 2, '#c8c8d0', 2); ell(x + 25, y - 43, 4, 4, '#fff6b0', 1.5); }
      c.util.pj(s.ch, x, y - 74, 58, { animo: frz ? 'perder' : null, sombra: false });
      if (P[p].lleva) { var b = Math.sin(absT * 8) * 2; ell(x, y - 118 + b, 8, 9, '#ffb02e', 2.5); ell(x + 2, y - 116 + b, 4, 4, '#f0801c', 0); poly([[x, y - 127 + b], [x + 7, y - 131 + b], [x + 3, y - 125 + b]], '#5cc24a', 1.5); }
      ctx.restore();
    }
    function silbon(x, y, a, now) {                              // flaco, larguísimo, sombrero de cogollo; la cara es la del jugador
      var s = asiento(soloI), col = s.color || '#9a6ad0', sw = Math.sin(absT * 9) * 3, sil = now - silbo.t < 0.9 && now >= silbo.t;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(0.82, 0.82); ctx.translate(-x, -y);
      sombra(x, y + 2, 20, 5);
      line([[x - 5, y], [x - 4 + sw * 0.4, y - 34]], 5, '#2a1e14'); line([[x + 5, y], [x + 4 - sw * 0.4, y - 34]], 5, '#2a1e14');
      rr(x - 9, y - 82, 18, 50, 7, col, 3.5);
      line([[x - 9, y - 76], [x - 20, y - 52 + sw]], 4, '#2a1e14'); line([[x + 9, y - 76], [x + 22, y - 54 - sw]], 4, '#2a1e14');
      var hb = Math.min(atrTot, 6); rr(x + 16, y - 62 - sw - hb, 14 + hb * 1.5, 16 + hb * 1.5, 4, '#8a6a3a', 2.5); for (var hk = 0; hk < Math.min(hb, 3); hk++) line([[x + 20 + hk * 4, y - 62 - sw - hb], [x + 22 + hk * 4, y - 72 - sw - hb]], 2, '#efe8d0');                                           // el saco (de mangos ajenos)
      c.util.pj(s.ch, x, y - 96, 54, { animo: sil ? 'celebrar' : null, sombra: false });
      ell(x, y - 116, 30, 7, '#c9a35a', 3); rr(x - 13, y - 134, 26, 18, 6, '#c9a35a', 3); line([[x - 13, y - 120], [x + 13, y - 120]], 3, '#7a4a2a');
      if (sil) { var u = (now - silbo.t) / 0.9; txt('♪', x + 22 + u * 16, y - 104 - u * 20, 14, '#fffdf2', 0, true); txt('FIU', x + 30 + u * 10, y - 88 - u * 12, 11, '#fffdf2', 0, true); }
      ctx.restore();
    }

    function dibujar2D() {
      var f = cp(), G = geom(), now = c.ahora(), p, k, j, ox = G.ox, oy = G.oy, yo = c.yo, soyS = yo === soloI, espect = yo < 0 || yo >= n;
      var sxk = Math.sin(absT * 90) * shake * 3, syk = Math.cos(absT * 77) * shake * 3, so = P[soloI];
      ctx.save(); ctx.translate(sxk, syk);
      fondo(f, G);
      ctx.save(); ctx.translate(G.cx, PIVY); ctx.scale(G.k, G.k); ctx.translate(-G.cx, -PIVY);
      suelo(G);
      /* charcos de luz: lo que se ve en la oscuridad */
      if (soyS) charco(ox + so.x, oy + so.y, vS, '#c8b8ff', 0.14);
      else if (!espect && !frzV(yo, now)) charco(ox + P[yo].x, oy + P[yo].y, vTn(now), '#fff2c0', 0.16);
      if (!soyS && !espect && oido && !frzV(yo, now) && now >= oido.t && now < oido.t + OIDO_T) { var uo = (now - oido.t) / OIDO_T; ctx.save(); ctx.globalAlpha = 0.85 * (1 - uo); line(ellP(ox + P[yo].x, oy + P[yo].y, oido.rad * Math.min(1, uo * 5), oido.rad * Math.min(1, uo * 5) * 0.8, 40), 3, NIV_COL[oido.niv]); ctx.restore(); }   // el aro de distancia: el Silbón está en algún punto del aro (sin dirección)
      for (k = 0; k < trio.length; k++) { p = trio[k]; if (linV(p)) { charco(ox + P[p].x, oy + P[p].y, LIN_R, '#fff6b0', 0.26); line(ellP(ox + P[p].x, oy + P[p].y, REP, REP * 0.8, 24), 2, '#fff6b0'); } }
      /* la estampida: el carril se avisa en rojo y las vacas lo cruzan */
      for (k = 0; k < EVS.length; k++) { var eg = EVS[k]; if (eg.k === 'ganado' && now >= eg.t - AVISO && now < eg.t + eg.d) { ctx.save(); ctx.globalAlpha = 0.18 + 0.12 * Math.sin(absT * 14); rr(ox, oy + eg.y - 26, SW, 52, 6, '#ff6a3a', 0); ctx.restore(); if (now < eg.t) txt(eg.dir > 0 ? '→ → →' : '← ← ←', ox + SW / 2, oy + eg.y + 5, 16, '#ffd23f', 0, true); } }
      var vs2 = vacas(now);
      for (k = 0; k < vs2.length; k++) { var vq = vs2[k]; sombra(ox + vq.x, oy + vq.y + 2, 20, 5); rr(ox + vq.x - 20, oy + vq.y - 26, 40, 22, 8, '#e8e0d0', 3); ell(ox + vq.x + 6 * vq.e.dir, oy + vq.y - 18, 7, 6, '#2a2224', 0); ell(ox + vq.x + 22 * vq.e.dir, oy + vq.y - 24, 8, 7, '#e8e0d0', 2.5); }
      rancho(G, now);
      /* silbido: aro que se abre desde donde salió (el trío lo ve; el Silbón ve a todos 1 s) */
      var us = (now - silbo.t) / SIL_T;
      if (us >= 0 && us < 1 && (soyS || espect)) { ctx.save(); ctx.globalAlpha = 0.7 * (1 - us); line(ellP(ox + silbo.x, oy + silbo.y, RW * (0.3 + 0.7 * us), RW * (0.3 + 0.7 * us) * 0.8, 28), 3, '#c8b8ff'); ctx.restore(); }   // el trío no sabe de dónde salió: solo lo oye
      /* ruidos (solo los ve el Silbón): ¡CRONCH! donde alguien agarró un mango */
      if (soyS || espect) for (k = 0; k < ruido.length; k++) { var rz = ruido[k], ur = now - rz.t; if (ur >= 0 && ur < 1.4) { ctx.save(); ctx.globalAlpha = 1 - ur / 1.4; txt('¡CRONCH!', ox + rz.x, oy + rz.y - 20 - ur * 12, 12, '#ffcf5a', 0, true); ctx.restore(); } }
      for (j = 0; j < objs.length; j++) { var o = objs[j]; if (activo(o, now)) mango(ox + o.x, oy + o.y, now, o); }
      /* árboles y personas, ordenados por profundidad */
      var ord = [];
      for (k = 0; k < trees.length; k++) ord.push({ y: trees[k].y, t: 0, i: k });
      for (p = 0; p < n; p++) ord.push({ y: P[p].y, t: 1, i: p });
      ord.sort(function (a, b) { return a.y - b.y; });
      for (k = 0; k < ord.length; k++) {
        var it = ord[k];
        if (it.t === 0) { arbol(ox + trees[it.i].x, oy + trees[it.i].y, trees[it.i].r, alumbrado(trees[it.i].x, trees[it.i].y, now)); continue; }
        p = it.i; var q = P[p];
        if (isSolo(p)) {
          var aS = 1;
          if (!soyS && !espect) { var dS = frzV(yo, now) ? 1e9 : hyp(P[yo].x - q.x, P[yo].y - q.y), vt2 = vTn(now); aS = trioVe(yo, now) ? 1 : cl((vt2 * 1.12 - dS) / (vt2 * 0.12), 0, 1) * 0.5; }   // borde suave: se asoma la silueta
          if (aS > 0.02) { silbon(ox + q.x, oy + q.y, aS, now); txt(p === yo ? 'TÚ' : 'EL SILBÓN', ox + q.x, oy + q.y + 14, 11, p === yo ? '#ffd23f' : '#e8dcff', 0, true); }
          if (p === yo) poly([[ox + q.x - 8, oy + q.y - 126], [ox + q.x + 8, oy + q.y - 126], [ox + q.x, oy + q.y - 114]], '#ffd23f', 3);
        } else {
          var fz = frzV(p, now), ver = !soyS || soloVe(p, now) || fz;
          if (!ver) continue;
          if (fz) { var hc = casa(p); line([[ox + hc.x - 16, oy + hc.y - 8], [ox + hc.x, oy + hc.y - 2], [ox + hc.x + 16, oy + hc.y - 8]], 4, '#e05a4a'); }
          persona(p, ox + q.x, oy + q.y, now, fz, linV(p));
          if (soyS && revelado(now)) txt('!', ox + q.x, oy + q.y - 112, 18, '#ffd23f', 0, true);
          if (fz) txt('zZz', ox + q.x + 14, oy + q.y - 70 - Math.sin(absT * 3) * 3, 11, '#c8b8ff', 0, true);
          txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), ox + q.x, oy + q.y + 14, 11, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
          if (p === yo && !fz) poly([[ox + q.x - 8, oy + q.y - 106], [ox + q.x + 8, oy + q.y - 106], [ox + q.x, oy + q.y - 94]], '#ffd23f', 3);
          if (p === yo) dibujaOido(ox + q.x, oy + q.y - 130, now);
        }
      }
      ctx.restore(); ctx.restore();
      /* la noche se cierra por fases, la nube la cierra más, el relámpago lo aclara todo */
      var osc2 = [0, 0.14, 0.28][fase(Math.max(0, now))] + (evOn('nube', now) ? 0.22 : 0);
      if (osc2 > 0) { ctx.save(); ctx.globalAlpha = osc2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#05060f', 0); ctx.restore(); }
      if (evOn('rayo', now) && Math.sin(absT * 50) > -0.3) { ctx.save(); ctx.globalAlpha = 0.28; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#fffdf2', 0); ctx.restore(); }
      hud(G, Math.max(PIVY + (oy + SH + 40 - PIVY) * G.k + 24, 430));
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#c8b8ff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }
    function hud(G, by) {                                  // marcador y ayuda del botón A (texto 2D, igual en 2D y 3D)
      var now = c.ahora(), yo = c.yo, soyS = yo === soloI, espect = yo < 0 || yo >= n;
      /* marcador: mangos en la cesta (arriba, bajo la franja de burbujas del HUD) */
      var my = 86, eN = Math.min(ent, need), f = fase(Math.max(0, now)), falta = Math.max(0, Math.ceil(dur - Math.max(0, now))), chico = G.w < 500;
      ctx.save(); ctx.globalAlpha = 0.8; rr(G.cx - 150, my - 16, 300, 50, 10, INK, 0); ctx.restore();
      ell(G.cx - 126, my, 9, 10, '#ffb02e', 2.5);
      txt('MANGOS ' + eN + '/' + need, G.cx - 46, my + 1, 19, eN >= need ? '#5cff7a' : '#ffd23f', 0, true);
      /* el amanecer: la barrita del sol que sale (el reloj del trío) */
      txt('AMANECE EN ' + falta + ' s', G.cx + 82, my + 1, 13, f === 2 ? (Math.sin(absT * 10) > 0 ? '#ff6a5a' : '#ffd23f') : '#fffdf2', 0, true);
      ctx.save(); ctx.globalAlpha = 0.6; rr(G.cx - 136, my + 18, 272, 6, 3, '#2a2240', 0); ctx.restore();
      rr(G.cx - 136, my + 18, 272 * cl(Math.max(0, now) / dur, 0, 1), 6, 3, f === 2 ? '#ff8a3a' : f === 1 ? '#7a6ad0' : '#4a5ab0', 0);
      /* la regla en pantalla (siempre): se entiende en 3 segundos */
      var regla = espect ? 'El trío lleva mangos al rancho · el Silbón los caza a oscuras' : soyS ? 'TÓCALOS · A: silba y los ves 1 s · si te acercas, te oyen BAJITO' : 'Mango → rancho · silbido FUERTE = lejos, BAJITO = ¡CERCA! (el aro marca la distancia) · A: linterna';
      txt(regla, G.cx, my + 38, chico ? 10 : 12, '#e8dcff', 0, true);
      if (now > -0.5 && now < 2.4 && !c.practica) txt(soyS ? '¡AGÁRRALOS EN LA OSCURIDAD!' : '¡MANGOS AL RANCHO ANTES DEL AMANECER!', G.cx, my + 58, soyS ? 20 : (chico ? 13 : 16), '#fffdf2', 0, true);
      dibujaAvisos(G);
      vineta(cp(), now);
      /* ayuda del botón A del propio jugador */
      if (now >= 0 && !espect) {
        var bx = G.cx, rest, tot, lis, lab;
        if (soyS) { rest = Math.max(0, P[yo].nextS - now); tot = SIL_CD; lis = rest <= 0 && now >= FIRST; lab = lis ? 'SILBIDO LISTO (A)' : (revelado(now) ? '¡LOS VES!' : 'silbido recargando');
          var au = AUTO[f] - (now - Math.max(P[yo].ultS, 0)); if (au < 2.2 && au > 0 && !revelado(now)) lab = 'se te sale un silbido en ' + Math.ceil(au) + '…'; }
        else { rest = Math.max(0, P[yo].nextL - now); tot = LIN_T + LIN_CD; lis = rest <= 0; lab = linV(yo) ? '¡LINTERNA!' : (lis ? 'LINTERNA LISTA (A)' : 'linterna recargando'); if (frzV(yo, now)) { lab = '¡EN EL CHINCHORRO!'; lis = false; } }
        if (!soyS) oidoMedidor(G, by, now);
        else txt('SACO: ' + atrTot + ' hueso' + (atrTot === 1 ? '' : 's'), bx + 98, by + 6, 12, atrTot ? '#efe8d0' : '#9a90b8', 0, true);
        ctx.save(); ctx.globalAlpha = 0.6; rr(bx - 44, by, 88, 8, 4, INK, 0); ctx.restore(); rr(bx - 44, by, 88 * (1 - cl(rest / tot, 0, 1)), 8, 4, lis ? '#5cff7a' : '#ffd23f', 0);
        txt(lab, bx, by + 20, 12, lis ? '#5cff7a' : '#fffdf2', 0, true);
      }
    }
    /* ───── 3D low poly (fiesta-3d.js): el llano de noche, con el rancho, el bombillo, el chinchorro y los mangos. Solo dibujo: lee P, objs, silbo y
       las mismas reglas de «quién ve qué» del 2D (el Silbón se asoma solo donde el trío lo vería; el trío solo aparece donde el Silbón lo vería).
       Las linternas son SpotLight de verdad (intensidad 0 apagadas: así no cambia el número de luces ni se recompilan los materiales). ───── */
    var V3 = window.FIESTA && FIESTA.V3, v3 = null, v3T = 0;
    var ESX = 1 / 18, ESZ = 1.15 / 18;
    function WX(x) { return (x - SW / 2) * ESX; }
    function WZ(y) { return (y - SH / 2) * ESZ; }
    function pnt(x, y, dy, h) {                               // punto en pantalla para los avisos (S): proyectado del 3D, o el 2D de siempre
      if (v3) return v3.esc.proyectar(WX(x), h, WZ(y));
      return scr(geom(), x, y + dy);
    }
    /* tres looks: 1 atardecer que se va (sol bajo, sombras largas), 2 noche de luna azul, 3 noche cerrada con neblina */
    var PAL3 = {
      1: { cielo: ['#2a2260', '#ff9a6a'], hemi: [0xb8a8ff, 0x3a2a30, .5], sol: [0xffa070, .5], solP: [-30, 9, -22], niebla: '#4a3460', nb: [46, 92],
        suelo: '#41613a', suelo2: '#527446', bruma: .05, luci: 12, linI: 2.2, bomb: 1.2, ventana: .7, visI: .9 },
      2: { cielo: ['#070c2a', '#2a3a74'], hemi: [0x7a8aff, 0x1a1a2a, .42], sol: [0xb0c0ff, .36], solP: [20, 26, -16], niebla: '#141c3c', nb: [42, 82],
        suelo: '#2a4a2e', suelo2: '#335a36', bruma: .08, luci: 22, linI: 2.6, bomb: 1.5, ventana: 1.2, visI: 1.1 },
      3: { cielo: ['#02030c', '#0e1430'], hemi: [0x5a5a9a, 0x08080f, .28], sol: [0x8090d0, .15], solP: [16, 26, -18], niebla: '#070a18', nb: [38, 70],
        suelo: '#1c3322', suelo2: '#24402a', bruma: .13, luci: 34, linI: 3, bomb: 1.6, ventana: 1.6, visI: 1.3 }
    };
    function girar(a, b, k) { var d = b - a; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return a + d * k; }
    function mango3D(T, oro) {                                // un mango que brilla un poquito (de noche todos los ven); el de oro brilla mucho y es más grande
      var g3 = new T.Group();
      var cu = V3.malla(new T.SphereGeometry(.24, 9, 7), null, { mat: oro ? V3.toon('#ffe14a', { em: '#ffd23f', emI: 1.3 }) : V3.toon('#ffb02e', { em: '#ff9a1a', emI: .55 }), g: .07 }); cu.scale.set(1, 1.2, .9); g3.add(cu);
      if (oro) g3.scale.setScalar(1.45);
      var ro = new T.Mesh(new T.SphereGeometry(.13, 6, 5), V3.toon('#ff5a3a', { em: '#c83a1a', emI: .4 })); ro.position.set(.11, .06, .12); g3.add(ro);
      var ho = V3.malla(new T.ConeGeometry(.07, .26, 4), '#5cc24a', { g: .1 }); ho.position.set(.06, .32, 0); ho.rotation.z = -.9; g3.add(ho);
      return g3;
    }
    /* el Silbón: flaco, larguísimo, sombrero de cogollo, saco a la espalda y ojos que brillan. Materiales propios (se desvanece en la oscuridad) */
    function silbon3D(T, col) {
      var mats = [], tinta = new T.MeshBasicMaterial({ color: 0x14101c, side: T.BackSide, transparent: true });
      function pz(geo, c2, em) {
        var m = V3.toon(c2, { nuevo: true, em: em, emI: em ? 1.4 : 0 }); m.transparent = true; mats.push(m);
        var me = new T.Mesh(geo, m), b = new T.Mesh(geo, tinta); b.scale.setScalar(1.07); me.add(b); return me;
      }
      var g3 = new T.Group(), cu = new T.Group(), ropa = '#3a3048', piel = '#b8c4a8', paja = '#c9a35a'; g3.add(cu);
      function pierna(sx) {
        var pv = new T.Group(), gm = new T.CylinderGeometry(.075, .06, 2, 5); pv.position.set(sx, 2.05, 0); cu.add(pv);
        gm.translate(0, -1, 0); pv.add(pz(gm, '#2a2236'));
        var pie = pz(new T.BoxGeometry(.16, .08, .32), '#5a4026'); pie.position.set(0, -2, .07); pv.add(pie);
        return pv;
      }
      function brazo(sx) {
        var pv = new T.Group(), gm = new T.CylinderGeometry(.06, .05, 1.75, 5); pv.position.set(sx, 3.3, 0); cu.add(pv);
        gm.translate(0, -.875, 0); pv.add(pz(gm, ropa));
        var mn = pz(new T.SphereGeometry(.09, 6, 5), piel); mn.position.y = -1.8; pv.add(mn);
        return pv;
      }
      var pI = pierna(-.15), pD = pierna(.15), bI = brazo(-.28), bD = brazo(.28);
      var tor = pz(new T.CylinderGeometry(.22, .15, 1.35, 6), ropa); tor.position.y = 2.7; cu.add(tor);
      var pan = pz(new T.CylinderGeometry(.16, .22, .16, 8), col); pan.position.y = 3.38; cu.add(pan);            // el pañuelo: el color del jugador
      var saco = pz(new T.IcosahedronGeometry(.34, 0), '#8a6a3a'); saco.position.set(0, 2.75, -.38); saco.scale.set(1, 1.2, .9); cu.add(saco);
      var huesos = [], hi;
      for (hi = 0; hi < 6; hi++) { var hu = pz(new T.CylinderGeometry(.028, .028, .4, 4), '#efe8d0'); hu.position.set(-.14 + (hi % 3) * .14, 2.95 + (hi > 2 ? .12 : 0), -.5); hu.rotation.set(.5 + hi * .3, 0, (hi - 2.5) * .35); hu.visible = false; cu.add(hu); huesos.push(hu); }
      var cab = new T.Group(); cab.position.y = 3.45; cu.add(cab);
      var cara = pz(new T.SphereGeometry(.21, 8, 6), piel); cara.scale.set(.9, 1.15, .95); cara.position.y = .2; cab.add(cara);
      var oI = pz(new T.SphereGeometry(.045, 6, 4), '#ffe14a', '#ffd23f'); oI.position.set(-.08, .26, .18); cab.add(oI);
      var oD = pz(new T.SphereGeometry(.045, 6, 4), '#ffe14a', '#ffd23f'); oD.position.set(.08, .26, .18); cab.add(oD);
      var boca = pz(new T.SphereGeometry(.04, 6, 4), '#14101c'); boca.position.set(0, .1, .19); cab.add(boca);
      var som = new T.Group(); som.position.y = .42; som.rotation.x = -.1; cab.add(som);
      som.add(pz(new T.CylinderGeometry(.72, .72, .05, 12), paja));
      var copa = pz(new T.CylinderGeometry(.2, .27, .34, 8), paja); copa.position.y = .18; som.add(copa);
      var cinta = pz(new T.CylinderGeometry(.275, .28, .07, 8), '#7a4a2a'); cinta.position.y = .06; som.add(cinta);
      var somb = new T.Mesh(new T.CircleGeometry(.7, 16), new T.MeshBasicMaterial({ color: 0x06080a, transparent: true, opacity: .35, depthWrite: false }));
      somb.rotation.x = -Math.PI / 2; somb.position.y = .03; g3.add(somb);
      return { saco: saco, huesos: huesos, g: g3, cu: cu, pI: pI, pD: pD, bI: bI, bD: bD, cab: cab, som: som, boca: boca, mats: mats, tinta: tinta, somb: somb, fase: 0, rumbo: 0, atr: 0, a: -1, x: 0, z: 0, px: 0, pz: 0 };
    }
    function alfaSil(S2, a) {
      if (Math.abs(a - S2.a) < .01) return;
      var k; S2.a = a;
      for (k = 0; k < S2.mats.length; k++) S2.mats[k].opacity = a;
      S2.tinta.opacity = a; S2.somb.material.opacity = .35 * a; S2.g.visible = a > .02;
    }
    function animSil(S2, dt, v, now, fin, gana) {             // camina con zancadas largas, silba con la mano en la boca, agarra con los dos brazos
      var t = absT, amp = Math.min(1, v / 6), su = now - silbo.t, sil = su >= 0 && su < .9;
      S2.fase += dt * (3 + v * 1.1); S2.atr = Math.max(0, S2.atr - dt);
      var sw = Math.sin(S2.fase) * .6 * amp, lx = 0, ly = 0, bIx = -sw * .8, bDx = sw * .8, bIz = -.12 - .05 * Math.sin(t * 1.7), bDz = .12 + .05 * Math.sin(t * 1.7), cx = -.1, sm = 0;
      if (fin && gana) { ly = Math.abs(Math.sin(t * 7)) * .35; bIz = -2.6 + Math.sin(t * 9) * .3; bDz = 2.6 - Math.sin(t * 9) * .3; bIx = 0; bDx = 0; cx = -.3; sw = 0; }
      else if (fin) { lx = .35; bIx = .3; bDx = .3; bIz = -.05; bDz = .05; cx = .4; sm = .5 + Math.sin(t * 1.2) * .08; sw = 0; }
      else {
        lx = .1 + .14 * amp + Math.sin(t * 1.3) * .03; ly = Math.abs(Math.sin(S2.fase)) * .08 * amp;
        if (sil) { bDx = -2.5; bDz = .5; cx = -.35; }
        if (S2.atr > 0) { var k2 = Math.sin(S2.atr / .5 * Math.PI); bIx = -1.5 * k2; bDx = -1.5 * k2; bIz = -.3; bDz = .3; lx += .3 * k2; }
      }
      S2.pI.rotation.x = sw; S2.pD.rotation.x = -sw;
      S2.bI.rotation.x = bIx; S2.bD.rotation.x = bDx; S2.bI.rotation.z = bIz; S2.bD.rotation.z = bDz;
      S2.cu.rotation.x = lx; S2.cu.position.y = ly; S2.cab.rotation.x = cx; S2.som.rotation.z = sm;
      var hb = Math.min(atrTot, 6), hi;
      S2.saco.scale.set(1 + hb * .1, 1.2 + hb * .12, .9 + hb * .1); S2.saco.rotation.z = Math.sin(S2.fase * 2) * .12 * amp * (hb ? 1 : .4);   // el saco de huesos crece y suena (se mece)
      for (hi = 0; hi < S2.huesos.length; hi++) S2.huesos[hi].visible = hi < hb;
      S2.boca.scale.setScalar(sil ? 1.6 + Math.sin(t * 30) * .3 : 1);
    }
    function montar3D() {
      var T = THREE, pl = PAL3[lv], k, j;
      var esc = V3.escena({ fondo: V3.cielo(pl.cielo[0], pl.cielo[1]), niebla: [pl.niebla, pl.nb[0], pl.nb[1]], fov: 32 });
      if (!esc) return null;
      esc.luces.hemi.color.set(pl.hemi[0]); esc.luces.hemi.groundColor.set(pl.hemi[1]); esc.luces.hemi.intensity = pl.hemi[2];
      esc.luces.sol.color.set(pl.sol[0]); esc.luces.sol.intensity = pl.sol[1]; esc.luces.sol.position.set(pl.solP[0], pl.solP[1], pl.solP[2]);
      /* joropo llanero en La menor (i–iv–V–i), arpa rápida y un poco tenebrosa */
      V3.pista('silbon', { bpm: 152, acordes: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
        mel: [76, 0, 74, 72, 71, 0, 72, 74, 76, 0, 77, 76, 74, 72, 71, 0, 69, 0, 71, 72, 74, 0, 72, 71, 68, 0, 71, 0, 69, 0, 0, 0] });
      /* ¡ÚLTIMOS SEGUNDOS!: la misma, más rápida y medio tono arriba (se cambia sola en dibujar3D) */
      V3.pista('silbon3', { bpm: 186, acordes: [[58, 61, 65], [51, 54, 58], [53, 57, 60], [58, 61, 65]],
        mel: [77, 77, 75, 73, 72, 0, 73, 75, 77, 0, 78, 77, 75, 73, 72, 72, 70, 0, 72, 73, 75, 0, 73, 72, 69, 69, 72, 0, 70, 70, 0, 70] });
      var S3 = esc.scene, M = V3.malla, tn = V3.toon, GM = tn('#fff').gradientMap;
      /* el pasto del llano */
      var pasto = V3.texturaCanvas(256, 256, function (x, w, h) {
        var i2; x.fillStyle = pl.suelo; x.fillRect(0, 0, w, h);
        for (i2 = 0; i2 < 160; i2++) { var gx = (i2 * 97) % w, gy = (i2 * 61 + (i2 * i2) % 37) % h; x.fillStyle = i2 % 3 ? pl.suelo2 : V3.oscurecer(pl.suelo, .8); x.fillRect(gx, gy, 3, 8); x.fillRect(gx + 3, gy + 3, 2, 5); }
      }, [34, 34]);
      var piso = new T.Mesh(new T.PlaneGeometry(220, 220), new T.MeshToonMaterial({ map: pasto, gradientMap: GM }));
      piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; S3.add(piso);
      /* la cerca de alambre alrededor del potrero (al frente se abre para el rancho) */
      var rx = WX(LX), rz = WZ(LY), fx0 = WX(AX0) - .5, fx1 = WX(AX1) + .5, fz0 = WZ(AY0) - .6, fz1 = WZ(AY1) + .6, gPo = new T.CylinderGeometry(.07, .09, 1.1, 5);
      function cerca(ax, az, bx, bz) {
        var L = Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), nP = Math.max(2, Math.round(L / 2.2)), i2, ang = Math.atan2(bx - ax, bz - az);
        for (i2 = 0; i2 <= nP; i2++) { var u = i2 / nP, po = M(gPo, '#6a4a2a', { g: .05 }); po.position.set(ax + (bx - ax) * u, .55, az + (bz - az) * u); po.rotation.z = Math.sin(i2 * 1.7) * .06; S3.add(po); }
        for (i2 = 0; i2 < 2; i2++) { var al = new T.Mesh(new T.BoxGeometry(.025, .025, L), tn('#8a8a90')); al.position.set((ax + bx) / 2, .45 + i2 * .4, (az + bz) / 2); al.rotation.y = ang; S3.add(al); }
      }
      cerca(fx0, fz0, fx1, fz0); cerca(fx0, fz0, fx0, fz1); cerca(fx1, fz0, fx1, fz1); cerca(fx0, fz1, rx - 4.4, fz1); cerca(rx + 4.4, fz1, fx1, fz1);
      /* los árboles de mango (salen de la semilla: los mismos que la simulación) */
      var arboles = [];
      for (k = 0; k < trees.length; k++) {
        var tr = trees[k], ag = new T.Group(), r3 = (tr.r + 11) * ESX;
        ag.position.set(WX(tr.x), 0, WZ(tr.y)); S3.add(ag);
        var tro = M(new T.CylinderGeometry(.2, .3, 2, 6), '#4a3220', { g: .05 }); tro.position.y = 1; ag.add(tro);
        var cMat = V3.toon(k % 2 ? '#1f4a2a' : '#245430', { nuevo: true }); cMat.transparent = true;
        var copa = new T.Group(); copa.position.y = 2.5; ag.add(copa);
        var bols = [];
        for (j = 0; j < 3; j++) { var bo = M(new T.IcosahedronGeometry(r3 * (j ? .7 : 1), 0), null, { mat: cMat, g: .04 }); bo.position.set(j === 1 ? -r3 * .6 : j === 2 ? r3 * .55 : 0, j ? -.2 : .3, j ? .25 * (j - 1.5) : 0); copa.add(bo); bols.push(bo); }
        for (j = 0; j < 4; j++) { var mg = new T.Mesh(new T.SphereGeometry(.13, 6, 4), tn('#ffb02e', { em: '#ff8a1a', emI: .35 })); mg.position.set(Math.cos(j * 1.9 + k) * r3 * .8, -.3 - (j % 2) * .3, Math.sin(j * 1.9 + k) * r3 * .8); mg.scale.y = 1.2; copa.add(mg); }
        arboles.push({ copa: copa, mat: cMat, bols: bols, x: WX(tr.x), z: WZ(tr.y), f: k * 1.3, a: 1 });
      }
      /* el rancho: el bombillo del porche (luz de verdad), su charco de luz, el aro de entrega, la cesta, el chinchorro y la casita de bahareque */
      var poste = M(new T.CylinderGeometry(.11, .14, 4, 6), '#5a4026', { g: .05 }); poste.position.set(rx + 3.6, 2, rz); S3.add(poste);
      var brazo = M(new T.BoxGeometry(3.7, .1, .1), '#5a4026', { g: .05 }); brazo.position.set(rx + 1.8, 3.9, rz); S3.add(brazo);
      var cable = new T.Mesh(new T.CylinderGeometry(.015, .015, .45, 4), tn('#14101c')); cable.position.set(rx, 3.65, rz); S3.add(cable);
      var bombillo = new T.Mesh(new T.SphereGeometry(.2, 8, 6), tn('#fff6b0', { em: '#ffd36a', emI: 2 })); bombillo.position.set(rx, 3.3, rz); S3.add(bombillo);
      var luzR = new T.PointLight(0xffd890, pl.bomb, 10, 1.2); luzR.position.set(rx, 3.1, rz); S3.add(luzR);
      function disco(r, col, op, aditivo) {
        var m = new T.Mesh(new T.CircleGeometry(r, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: aditivo ? T.AdditiveBlending : T.NormalBlending }));
        m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.15, 1); S3.add(m); return m;
      }
      function aro(r, w, col, op) {
        var m = new T.Mesh(new T.RingGeometry(r - w, r, 48), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.scale.set(1, 1.15, 1); S3.add(m); return m;
      }
      var charcoR = disco(LUZ_RANCHO * ESX, 0xffe9a0, .1, true); charcoR.position.set(rx, .03, rz);
      var aroE = aro(ENTREGA * ESX, .14, 0xffd23f, .55); aroE.position.set(rx, .05, rz);
      var cxC = WX(LX + 52), czC = WZ(LY - 14);
      var cesta = M(new T.CylinderGeometry(.55, .42, .5, 9), '#a8743a', { g: .05 }); cesta.position.set(cxC, .25, czC); S3.add(cesta);
      var cestaM = [];
      for (k = 0; k < need; k++) { var mm = mango3D(T); mm.scale.setScalar(.75); mm.position.set(cxC + Math.cos(k * 2.4) * (.12 + .1 * (k % 3)), .5 + Math.floor(k / 4) * .16, czC + Math.sin(k * 2.4) * (.12 + .1 * (k % 3))); mm.visible = false; S3.add(mm); cestaM.push(mm); }
      var hz = WZ(LY + 6), hx = 44 * ESX + .3;
      [-1, 1].forEach(function (sg) { var pc = M(new T.CylinderGeometry(.1, .12, 1.8, 6), '#5a4026', { g: .05 }); pc.position.set(rx + sg * (hx + .2), .9, hz); S3.add(pc); });
      var pts = [], i3;
      for (i3 = 0; i3 <= 16; i3++) { var u3 = i3 / 16; pts.push(new T.Vector3(-hx + 2 * hx * u3, -Math.sin(u3 * Math.PI) * 1.05, 0)); }
      var rayas = V3.texturaCanvas(64, 4, function (x, w, h) { var cs = ['#e05a4a', '#ffd23f', '#3fae4a', '#3f7fd0'], i4; for (i4 = 0; i4 < 16; i4++) { x.fillStyle = cs[i4 % 4]; x.fillRect(i4 * 4, 0, 4, h); } });
      var chin = new T.Group(); chin.position.set(rx, 1.5, hz); S3.add(chin);
      var tela = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, .32, 6, false), new T.MeshToonMaterial({ map: rayas, gradientMap: GM }));
      V3.borde(tela, .03); tela.scale.z = .45; tela.receiveShadow = true; tela.castShadow = true; chin.add(tela);
      /* la casita va detrás del chinchorro, baja, y se vuelve transparente si alguien queda cerca (no tapa a nadie) */
      var casaZ = WZ(AY1) + 4.4, casaG = new T.Group(); casaG.position.set(rx - .5, 0, casaZ); S3.add(casaG);
      var mPared = V3.toon('#c8a878', { nuevo: true }), mTecho = V3.toon('#b89548', { nuevo: true }); mPared.transparent = true; mTecho.transparent = true;
      var pared = M(new T.BoxGeometry(8, 1.5, 2.4), null, { mat: mPared, recibe: true, g: .015 }); pared.position.y = .75; casaG.add(pared);
      var gTe = new T.ConeGeometry(5.2, 1.5, 4, 1); gTe.rotateY(Math.PI / 4);
      var techo = M(gTe, null, { mat: mTecho, g: .02 }); techo.scale.set(1, 1, .55); techo.position.y = 2.25; casaG.add(techo);
      var puerta = M(new T.BoxGeometry(1, 1.5, .1), '#4a3220', { g: .03 }); puerta.position.set(-1.2, .6, 1.21); casaG.add(puerta);
      [1.2, 2.9].forEach(function (vx) { var ve = new T.Mesh(new T.BoxGeometry(.9, .7, .1), tn('#ffd36a', { em: '#ffb030', emI: pl.ventana })); ve.position.set(vx, .9, 1.21); V3.borde(ve, .04); casaG.add(ve); });
      var luzC = new T.PointLight(0xffb060, .7, 7, 1.5); luzC.position.set(rx + 1.5, 1.3, casaZ + 1.8); S3.add(luzC);
      /* el fondo: moriches, matas y dos vacas que pastan solas */
      var hojas = [], gHoja = new T.ConeGeometry(.35, 2.8, 4); gHoja.translate(0, 1.4, 0);
      function moriche(x, z, h) {
        var g3 = new T.Group(), i2; g3.position.set(x, 0, z); S3.add(g3);
        var tr2 = M(new T.CylinderGeometry(.2, .3, h, 6), '#3a3024', { g: .03 }); tr2.position.y = h / 2; g3.add(tr2);
        for (i2 = 0; i2 < 9; i2++) { var ho = M(gHoja, i2 % 2 ? '#1f4a2a' : '#285a32', { g: .03 }); ho.position.y = h; ho.rotation.set(0, i2 / 9 * 6.28, 0); ho.rotateZ(1.15 + (i2 % 3) * .25); g3.add(ho); hojas.push(ho); }
      }
      for (k = 0; k < 11; k++) moriche(-34 + k * 6.8 + Math.sin(k * 3) * 1.8, fz0 - 4 - (k * 7) % 9, 5.5 + (k * 5) % 4);
      moriche(fx0 - 3, -2, 6.5); moriche(fx1 + 3.2, 2.5, 7); moriche(fx0 - 4.5, 5, 5.5); moriche(fx1 + 4, -5.5, 6);
      for (k = 0; k < 14; k++) { var ma = M(new T.IcosahedronGeometry(.5 + (k % 3) * .2, 0), k % 2 ? '#2a4a2a' : '#335a30', { g: .04 }); ma.position.set(k % 2 ? fx1 + 1.2 + (k % 4) : fx0 - 1.2 - (k % 4), .35, -8 + k * 1.3); ma.scale.y = .7; S3.add(ma); }
      function vaca(x, z, ry) {
        var g3 = new T.Group(), i2; g3.position.set(x, 0, z); g3.rotation.y = ry; S3.add(g3);
        var cu = M(new T.BoxGeometry(.9, .8, 1.8), '#e8e0d0', { g: .04 }); cu.position.y = 1.2; g3.add(cu);
        var mancha = new T.Mesh(new T.BoxGeometry(.93, .5, .7), tn('#2a2224')); mancha.position.set(0, 1.3, -.3); g3.add(mancha);
        for (i2 = 0; i2 < 4; i2++) { var pa = M(new T.CylinderGeometry(.09, .08, .8, 5), '#e8e0d0', { g: .05 }); pa.position.set(i2 % 2 ? .3 : -.3, .4, i2 < 2 ? .65 : -.65); g3.add(pa); }
        var cab = new T.Group(); cab.position.set(0, 1.35, .95); g3.add(cab);
        var ca = M(new T.BoxGeometry(.5, .5, .7), '#e8e0d0', { g: .05 }); ca.position.set(0, -.1, .3); cab.add(ca);
        [-1, 1].forEach(function (sg) { var cn = M(new T.ConeGeometry(.06, .32, 4), '#fffdf2', { g: .08 }); cn.position.set(sg * .2, .2, .1); cn.rotation.z = -sg * .7; cab.add(cn); });
        var cola = M(new T.CylinderGeometry(.03, .03, .8, 4), '#e8e0d0', { g: .1 }); cola.geometry.translate(0, -.4, 0); cola.position.set(0, 1.5, -.9); g3.add(cola);
        return { g: g3, cab: cab, cola: cola, f: x };
      }
      var vacas = [vaca(fx0 - 4, -6.5, .8), vaca(fx1 + 4.5, -9, -2.3)];
      /* la estampida: tres reses que cruzan el potrero por su carril (el carril se avisa en rojo antes) */
      var manada = [];
      for (k = 0; k < NVACAS; k++) { var vm = vaca(0, 0, 0); vm.g.visible = false; vm.g.scale.setScalar(1.05); manada.push(vm); }
      var carril = new T.Mesh(new T.PlaneGeometry((AX1 - AX0) * ESX + 1, 52 * ESZ), new T.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0, depthWrite: false }));
      carril.rotation.x = -Math.PI / 2; carril.position.set(0, .06, 0); carril.visible = false; S3.add(carril);
      /* bancos de neblina que pasan solos, y luciérnagas */
      var bruma = [];
      for (k = 0; k < 9; k++) {
        var bm = new T.Mesh(new T.CircleGeometry(3.5, 18), new T.MeshBasicMaterial({ color: 0xc8d0f0, transparent: true, opacity: pl.bruma, depthWrite: false }));
        bm.rotation.x = -Math.PI / 2; bm.scale.set(2.2, 1, 1); bm.position.set(-30 + k * 7.3, .5 + (k % 3) * .25, -9 + (k * 5.3) % 19); S3.add(bm); bruma.push({ m: bm, v: .35 + (k % 4) * .15 });
      }
      var luci = [], gLu = new T.SphereGeometry(.07, 5, 4);
      for (k = 0; k < pl.luci; k++) { var lu = new T.Mesh(gLu, new T.MeshBasicMaterial({ color: 0xd8ff6a })); S3.add(lu); luci.push({ m: lu, x: ((k * 7.7) % 34) - 17, z: ((k * 5.3) % 22) - 10, y: .6 + (k % 5) * .35, f: k * 2.1 }); }
      /* los jugadores: el trío con PJ (y su linterna = SpotLight), el Silbón con su figura propia */
      var pjs = [], ColH = 0xfff0c0;
      for (k = 0; k < n; k++) {
        var s2 = asiento(k), colS = s2.color && s2.color !== '#fff' ? s2.color : '#9a6ad0';
        if (isSolo(k)) {
          var sil = silbon3D(T, colS); S3.add(sil.g); sil.x = sil.px = WX(P[k].x); sil.z = sil.pz = WZ(P[k].y);
          pjs.push(sil); continue;
        }
        var pj = V3.PJ.crear(s2.ch || 'tu', { prop: false, escala: 1.35 }); S3.add(pj.g);
        var ar = aro(.95, .2, colS, .85);
        var lint = new T.Group(), lc = M(new T.CylinderGeometry(.06, .07, .32, 6), '#c8c8d0', { g: .08 }); lc.rotation.x = Math.PI / 2; lint.add(lc);
        var lente = new T.Mesh(new T.CylinderGeometry(.075, .075, .04, 8), tn('#fff6b0', { em: '#fff2a0', emI: 2 })); lente.rotation.x = Math.PI / 2; lente.position.z = .17; lint.add(lente);
        lint.visible = false; pj.mano('der').add(lint);
        var spot = new T.SpotLight(ColH, 0, 13, .9, .55, 1); var blanco = new T.Object3D(); S3.add(spot); S3.add(blanco); spot.target = blanco;
        var gHaz = new T.ConeGeometry(2, 5.2, 18, 1, true); gHaz.translate(0, -2.6, 0); gHaz.rotateX(-Math.PI / 2);
        var haz = new T.Group(), hm = new T.Mesh(gHaz, new T.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: .14, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
        hm.rotation.x = .38; haz.add(hm); haz.visible = false; S3.add(haz);
        var aroL = aro(LIN_R * ESX, .12, 0xfff2b0, .3); aroL.visible = false;
        var aroP = aro(REP * ESX, .1, 0xffffff, .7); aroP.visible = false;                              // el círculo que el Silbón no puede pisar
        var carg = mango3D(T), cargO = mango3D(T, true); carg.visible = false; cargO.visible = false; S3.add(carg); S3.add(cargO);
        pjs.push({ pj: pj, aro: ar, lint: lint, spot: spot, blanco: blanco, haz: haz, aroL: aroL, aroP: aroP, carg: carg, cargO: cargO, x: WX(P[k].x), z: WZ(P[k].y), px: WX(P[k].x), pz: WZ(P[k].y), rumbo: Math.PI, linC: 0, frzC: 0, vC: true });
      }
      /* lo que ve uno mismo: una luz que lo sigue (cálida para el trío, morada para el Silbón) */
      var luzV = new T.PointLight(isSolo(c.yo) ? 0xb8a0ff : 0xffe2b0, 0, 8, 1.5); S3.add(luzV);
      var flecha = M(new T.ConeGeometry(.35, .7, 4), '#ffd23f', { g: .1 }); flecha.rotation.x = Math.PI; flecha.visible = false; S3.add(flecha);
      var onda = aro(1, .08, 0xc8b8ff, 0); onda.visible = false;
      var ondaO = aro(1, .045, 0xffffff, 0); ondaO.visible = false;                                   // el aro de distancia del trío
      var part = V3.particulas(esc, 500);
      esc.encuadrar(fx1 - fx0 + 2, fz1 - fz0 + 3, new T.Vector3(0, 0, .9), .82);
      return { esc: esc, pjs: pjs, part: part, arboles: arboles, hojas: hojas, vacas: vacas, manada: manada, carril: carril, espT: -9, base: { hemi: pl.hemi[2], sol: pl.sol[1], far: pl.nb[1] }, bruma: bruma, luci: luci, chin: chin, charcoR: charcoR, aroE: aroE,
        cestaM: cestaM, cesta: cesta, casa: { z: casaZ, x: rx - .5, mats: [mPared, mTecho], bordes: [pared.children[0], techo.children[0]], a: 1 }, bombillo: bombillo, luzR: luzR, luzV: luzV, flecha: flecha, onda: onda, ondaO: ondaO, mangos: {}, viento: -1, veia: false, latT: -9, finHecho: false, pl: pl };
    }
    function toma3D(o, p) {
      if (!v3) return;
      v3.part.soltar(WX(o.x), .4, WZ(o.y), 10, { k: 'chispa', cols: ['#ffb02e', '#ffd23f', '#5cc24a'], vel: 2.5, arriba: 3, vida: .5 });
      V3.sfx('pop'); void p;
    }
    function entrega3D(p) {
      if (!v3) return;
      var s3 = v3.pjs[p], cz = v3.cesta.position;
      v3.part.soltar(cz.x, 1, cz.z, 22, { k: 'confeti', cols: ['#ffb02e', '#ffd23f', '#5cff7a', '#fffdf2'], vel: 3, arriba: 5, g: 6, vida: 1.1 });
      if (s3 && s3.pj) s3.pj.uno('festejo');
      V3.sfx('moneda'); if (p === c.yo) V3.sfx('ding');
      v3.esc.sacudir(.25);
    }
    function silbo3D() {
      if (!v3) return;
      var x = WX(silbo.x), z = WZ(silbo.y), yo = c.yo;
      if (yo === soloI || yo < 0 || yo >= n) { v3.part.soltar(x, 3.6, z, 10, { k: 'chispa', cols: ['#c8b8ff', '#e8dcff', '#9a6ad0'], vel: 1.2, arriba: 2.5, g: -1, vida: 1 }); V3.sfx('silbato'); v3.viento = absT + .35; v3.esc.sacudir(.2); }
      else if (oido && oido.cerca) { V3.sfx('viento'); v3.esc.sacudir(.08); }                      // suavecito… está cerca
      else { V3.sfx('silbato'); V3.sfx('silbido'); v3.viento = absT + .35; v3.esc.sacudir(.35); }   // ¡FUERTE! está lejos
    }
    function atrapado3D(p, d, conMango) {
      if (!v3) return;
      var x = WX(d.x), z = WZ(d.y), mio = p === c.yo, s0 = v3.pjs[soloI], s3 = v3.pjs[p];
      v3.part.soltar(x, 1.4, z, 26, { k: 'chispa', cols: ['#c8b8ff', '#9a6ad0', '#fffdf2'], vel: 4, arriba: 4, vida: .8 });
      v3.part.soltar(x, 1, z, 12, { k: 'gota', cols: ['#e8e8f0', '#c8d0f0'], vel: 2, arriba: 2, g: 2, vida: .9, esc: 1.4 });     // la polvareda
      if (conMango) v3.part.soltar(x, 2.4, z, 6, { k: 'confeti', cols: ['#ffb02e', '#5cc24a'], vel: 2, arriba: 3, vida: .8 });
      if (s0) s0.atr = .5;
      if (s3 && s3.pj) s3.pj.uno('caer');
      V3.sfx('golpe'); V3.sfx('silbido');
      v3.esc.sacudir(mio ? 1 : .45);
    }
    function actualizar3D(dt, now) {
      var V = v3, t = absT, k, p, yo = c.yo, soyS = yo === soloI, espect = yo < 0 || yo >= n, so = P[soloI];
      var gana = ent >= need, fin = (gana || now >= dur) && now > 0;
      V.part.update(dt);
      if (V.viento > 0 && t >= V.viento) { V.viento = -1; V3.sfx('viento'); }
      /* el ambiente: hojas, vacas, neblina, luciérnagas, chinchorro y bombillo */
      for (k = 0; k < V.hojas.length; k++) V.hojas[k].rotation.x = Math.sin(t * 1.1 + k * .7) * .07;
      for (k = 0; k < V.vacas.length; k++) { var va = V.vacas[k]; va.cab.rotation.x = .45 + Math.sin(t * .7 + va.f) * .35; va.cola.rotation.z = Math.sin(t * 2.6 + va.f) * .45; }
      for (k = 0; k < V.bruma.length; k++) { var bm = V.bruma[k].m; bm.position.x += V.bruma[k].v * dt; if (bm.position.x > 34) bm.position.x = -34; }
      for (k = 0; k < V.luci.length; k++) { var lu = V.luci[k]; lu.m.position.set(lu.x + Math.sin(t * .4 + lu.f) * 2.2, lu.y + Math.sin(t * 1.3 + lu.f) * .35, lu.z + Math.cos(t * .33 + lu.f) * 1.8); lu.m.scale.setScalar(.4 + .8 * Math.max(0, Math.sin(t * 2.1 + lu.f * 3))); }
      V.chin.rotation.x = Math.sin(t * 1.4) * .1;
      /* la noche se cierra por fases; la nube apaga la luna; el relámpago lo prende todo un instante */
      var fF = fase(Math.max(0, now)), mul = [1, .78, .56][fF] * (evOn('nube', now) ? .45 : 1), ray = evOn('rayo', now) && Math.sin(t * 50) > -.3;
      V.esc.luces.hemi.intensity = ray ? 1.1 : V.base.hemi * mul; V.esc.luces.sol.intensity = ray ? .2 : V.base.sol * mul;
      if (V.esc.scene.fog) V.esc.scene.fog.far = V.base.far * (.7 + .3 * mul);
      /* la estampida */
      var eG = null, vs3 = vacas(now);
      for (k = 0; k < EVS.length; k++) if (EVS[k].k === 'ganado' && now >= EVS[k].t - AVISO && now < EVS[k].t + EVS[k].d) eG = EVS[k];
      V.carril.visible = !!eG;
      if (eG) { V.carril.position.z = WZ(eG.y); V.carril.material.opacity = now < eG.t ? .22 + .14 * Math.sin(t * 16) : .12; }
      for (k = 0; k < V.manada.length; k++) {
        var vm = V.manada[k], vq = vs3[k]; vm.g.visible = !!vq;
        if (vq) { vm.g.position.set(WX(vq.x), Math.abs(Math.sin(t * 14 + k)) * .25, WZ(vq.y)); vm.g.rotation.y = vq.e.dir > 0 ? Math.PI / 2 : -Math.PI / 2; vm.cab.rotation.x = .1 + Math.sin(t * 14 + k) * .15; vm.cola.rotation.z = Math.sin(t * 9 + k) * .6;
          if (c.fx() < dt * 14) V.part.soltar(WX(vq.x) - vq.e.dir * .9, .3, WZ(vq.y), 2, { k: 'gota', cols: ['#a89070', '#c8b090'], vel: 1.5, arriba: 1.5, g: 3, vida: .5, esc: 1.2 }); }
      }
      /* ¡la linterna lo espantó! */
      var espN = false; for (k = 0; k < trio.length; k++) { p = trio[k]; if (linV(p) && !frzV(p, now) && hyp(P[p].x - so.x, P[p].y - so.y) < REP + 6) espN = true; }
      if (espN && now > V.espT + 1.2 && now >= 0) { V.espT = now; V.part.soltar(WX(so.x), 2.5, WZ(so.y), 10, { k: 'chispa', cols: ['#fff6b0', '#c8b8ff'], vel: 3, arriba: 2, vida: .5 }); if (soyS) V3.sfx('error'); else V3.sfx('whoosh'); var pe2 = V.esc.proyectar(WX(so.x), 4.6, WZ(so.y)); S('¡AY, LA LUZ!', pe2.x, pe2.y, '#fff6b0'); }
      V.luzR.intensity = V.pl.bomb * (.94 + .06 * Math.sin(t * 9) + (Math.sin(t * 23) > .97 ? -.3 : 0));
      V.charcoR.material.opacity = .09 + .02 * Math.sin(t * 7);
      V.aroE.material.opacity = .35 + .25 * Math.abs(Math.sin(t * 3));
      for (k = 0; k < V.cestaM.length; k++) V.cestaM[k].visible = k < ent;
      /* los mangos del suelo: aparecen con un brinco, flotan y brillan */
      for (k = 0; k < objs.length; k++) {
        var o = objs[k], mm = V.mangos[o.id], act = activo(o, now);
        if (!mm && act) { mm = V.mangos[o.id] = { g: mango3D(THREE, !!o.oro), t0: t }; V.esc.scene.add(mm.g); V.part.soltar(WX(o.x), .5, WZ(o.y), 6, { k: 'chispa', cols: ['#ffd23f', '#fff6b0'], vel: 1.5, arriba: 2, vida: .5 }); }
        if (!mm) continue;
        mm.g.visible = !!act;
        if (act) { var ap = Math.min(1, (t - mm.t0) * 4); mm.g.position.set(WX(o.x), .45 + Math.sin(t * 4 + o.x) * .1, WZ(o.y)); mm.g.rotation.y = t * 1.5 + o.y; mm.g.scale.setScalar(ap * (1 + .25 * Math.sin(ap * Math.PI))); }
      }
      /* el Silbón: dónde está, cuánto se ve desde esta pantalla (las mismas reglas del 2D) */
      var S0 = V.pjs[soloI], sx = WX(so.x), sz = WZ(so.y);
      S0.x = sx; S0.z = sz;
      var svx = (S0.x - S0.px) / dt, svz = (S0.z - S0.pz) / dt, sv = Math.sqrt(svx * svx + svz * svz); S0.px = S0.x; S0.pz = S0.z;
      if (sv > 15) sv = 0;                                      // un salto de red no es correr
      if (sv > .4) S0.rumbo = girar(S0.rumbo, Math.atan2(svx, svz), Math.min(1, dt * 10));
      if (fin) S0.rumbo = girar(S0.rumbo, 0, Math.min(1, dt * 4));
      var aS = 1;
      if (!soyS && !espect) { var dS = frzV(yo, now) ? 1e9 : hyp(P[yo].x - so.x, P[yo].y - so.y), vt2 = vTn(now); aS = trioVe(yo, now) ? 1 : cl((vt2 * 1.12 - dS) / (vt2 * 0.12), 0, 1) * 0.5; }
      if (fin) aS = 1;                                          // al final todos lo ven: o festeja o se va triste
      alfaSil(S0, aS);
      animSil(S0, dt, sv, now, fin, !gana);
      S0.g.position.set(S0.x, 0, S0.z); S0.g.rotation.y = S0.rumbo;
      /* ¿se me apareció el Silbón? (solo el trío) */
      if (!soyS && !espect && !fin) {
        var veo = trioVe(yo, now) && now >= 0;
        if (veo && !V.veia && t - V.latT > 2) { V.latT = t; V3.sfx('latido'); var mi = V.pjs[yo]; if (mi && mi.pj && !frzV(yo, now)) mi.pj.uno('saltar'); }
        V.veia = veo;
      }
      /* el trío */
      for (k = 0; k < trio.length; k++) {
        p = trio[k]; var q = P[p], s3 = V.pjs[p], pj = s3.pj, fz = frzV(p, now), lin = !!linV(p) && !fz;
        var tx = WX(q.x), tz = fz ? WZ(LY + 6) : WZ(q.y);
        s3.x = tx; s3.z = tz;
        var vx = (s3.x - s3.px) / dt, vz = (s3.z - s3.pz) / dt, v = Math.sqrt(vx * vx + vz * vz); s3.px = s3.x; s3.pz = s3.z;
        if (v > 15) v = 0;
        if (v > .5 && !fz) s3.rumbo = girar(s3.rumbo, Math.atan2(vx, vz), Math.min(1, dt * 12));
        if (fz) s3.rumbo = 0;
        var ver = espect || !soyS || soloVe(p, now) || fz || fin;
        pj.g.visible = !!ver; s3.aro.visible = !!(ver && !fz);
        var cerca = !fz && trioVe(p, now) && hyp(q.x - so.x, q.y - so.y) < 120;
        if (fin) pj.anim(gana ? 'celebrar' : 'triste').cara(gana ? 'feliz' : 'triste');
        else if (fz) pj.anim('sentado').cara('dormido');
        else if (q.lleva) pj.anim('cargar', { vel: Math.min(1, v / 7) }).cara(cerca ? 'susto' : 'concentrado');
        else pj.anim(v > 4 ? 'correr' : v > .7 ? 'caminar' : 'quieto', { vel: Math.min(1, v / 7) }).cara(cerca ? 'susto' : lin ? 'concentrado' : 'normal');
        pj.rumbo(s3.rumbo).update(dt);
        pj.g.position.set(s3.x, fz ? .3 : 0, s3.z);
        s3.aro.position.set(s3.x, .04, s3.z);
        /* la linterna: SpotLight que alumbra el círculo de la regla, haz visible y el aro del alcance */
        if (lin && !s3.linC && ver) { V3.sfx('tic'); V.part.soltar(s3.x, 2, s3.z, 5, { k: 'chispa', cols: ['#fff6b0'], vel: 1.5, arriba: 1.5, vida: .3 }); }
        s3.linC = lin;
        var lv2 = lin && ver;
        s3.lint.visible = lv2; s3.haz.visible = lv2; s3.aroL.visible = lv2; s3.aroP.visible = lv2;
        s3.spot.intensity = lv2 ? V.pl.linI * (.92 + .08 * Math.sin(t * 17 + k)) : 0;
        if (lv2) {
          var fx = Math.sin(s3.rumbo), fzz = Math.cos(s3.rumbo);
          s3.spot.position.set(s3.x - fx * .4, 4.6, s3.z - fzz * .4); s3.blanco.position.set(s3.x + fx * .9, 0, s3.z + fzz * .9);
          s3.haz.position.set(s3.x + fx * .45, 1.75, s3.z + fzz * .45); s3.haz.rotation.y = s3.rumbo;
          s3.haz.children[0].material.opacity = .1 + .04 * Math.sin(t * 13 + k);
          s3.aroL.position.set(s3.x, .05, s3.z); s3.aroP.position.set(s3.x, .06, s3.z); s3.aroP.material.opacity = .45 + .3 * Math.sin(t * 12 + k);
        }
        /* el mango que lleva, sobre la cabeza */
        var oroL = !!(q.lleva && valor(q.lleva) > 1);
        s3.carg.visible = !!(q.lleva && ver && !fz && !fin && !oroL); s3.cargO.visible = !!(q.lleva && ver && !fz && !fin && oroL);
        var cg = oroL ? s3.cargO : s3.carg;
        if (cg.visible) { cg.position.set(s3.x, 3.25 + Math.sin(t * 8) * .06, s3.z); cg.rotation.y = t * 2; }
      }
      /* las copas de los árboles se aclaran si alguien que se ve queda detrás */
      for (k = 0; k < V.arboles.length; k++) {
        var ab = V.arboles[k], tapa = false, j2;
        for (j2 = 0; j2 < n && !tapa; j2++) { var pp = V.pjs[j2], vis = j2 === soloI ? pp.a > .02 : pp.pj.g.visible; if (vis && Math.abs(pp.x - ab.x) < 1.8 && pp.z < ab.z + .4 && pp.z > ab.z - 2.6) tapa = true; }
        ab.a += ((tapa ? .35 : 1) - ab.a) * Math.min(1, dt * 6); ab.mat.opacity = ab.a;
        for (j2 = 0; j2 < ab.bols.length; j2++) ab.bols[j2].children[0].visible = ab.a > .9;
        ab.copa.rotation.z = Math.sin(t * .9 + ab.f) * .025;
      }
      /* la casita del rancho: transparente si hay alguien visible delante o debajo de ella */
      var ca = V.casa, tapaC = false;
      for (k = 0; k < n && !tapaC; k++) { var pc2 = V.pjs[k], vc = k === soloI ? pc2.a > .02 : pc2.pj.g.visible; if (vc && Math.abs(pc2.x - ca.x) < 5.5 && pc2.z > ca.z - 5.5) tapaC = true; }
      ca.a += ((tapaC ? .3 : 1) - ca.a) * Math.min(1, dt * 6);
      for (k = 0; k < 2; k++) { ca.mats[k].opacity = ca.a; ca.bordes[k].visible = ca.a > .9; }
      /* lo que veo yo: mi luz, mi flecha */
      if (soyS) { V.luzV.intensity = V.pl.visI; V.luzV.distance = vS * ESX * 1.7; V.luzV.position.set(S0.x, 2.6, S0.z); }
      else if (!espect && !frzV(yo, now)) { var me = V.pjs[yo]; V.luzV.intensity = V.pl.visI; V.luzV.distance = vTn(now) * ESX * 1.7; V.luzV.position.set(me.x, 2.4, me.z); }
      else V.luzV.intensity = 0;
      V.flecha.visible = !espect && now < 3.5 && !fin;
      if (V.flecha.visible) { var fy = V.pjs[yo]; V.flecha.position.set(fy.x, (soyS ? 5.2 : 4.3) + Math.abs(Math.sin(t * 4)) * .3, fy.z); V.flecha.rotation.y = t * 2; }
      /* el silbido: aro morado que se abre desde donde salió */
      var us = (now - silbo.t) / SIL_T;
      V.onda.visible = !!(us >= 0 && us < 1 && (soyS || espect));   // el trío no sabe de dónde salió: solo lo oye (fuerte = lejos)
      if (V.onda.visible) { var rr2 = RW * ESX * (0.3 + 0.7 * us); V.onda.position.set(WX(silbo.x), .07, WZ(silbo.y)); V.onda.scale.set(rr2, rr2 * 1.15, 1); V.onda.material.opacity = .75 * (1 - us); }
      /* el aro de distancia del trío: cuánto suena el silbido = qué tan lejos está (sin dirección) */
      var uO = oido ? (now - oido.t) / OIDO_T : 2;
      V.ondaO.visible = !!(!soyS && !espect && oido && !frzV(yo, now) && uO >= 0 && uO < 1);
      if (V.ondaO.visible) { var mO = V.pjs[yo], rO = oido.rad * ESX * Math.min(1, uO * 5); V.ondaO.position.set(mO.x, .08, mO.z); V.ondaO.scale.set(rO, rO * 1.15, 1); V.ondaO.material.color.set(NIV_COL[oido.niv]); V.ondaO.material.opacity = .85 * (1 - uO); }
      /* el final */
      if (fin && !V.finHecho) {
        V.finHecho = true;
        if (gana) { V3.sfx('aplauso'); var cz = V.cesta.position; V.part.soltar(cz.x, 1.5, cz.z, 50, { k: 'confeti', cols: ['#ffb02e', '#ffd23f', '#5cff7a', '#ff5c8a', '#fffdf2'], vel: 5, arriba: 7, g: 5, vida: 2 }); }
        else { V3.sfx('silbato'); V.viento = t + .4; V.part.soltar(S0.x, 4, S0.z, 18, { k: 'chispa', cols: ['#c8b8ff', '#9a6ad0'], vel: 2, arriba: 3, g: -1, vida: 1.2 }); }
      }
    }
    function dibujar3D(f) {
      var dt = Math.max(0, Math.min(.05, v3T ? absT - v3T : 1 / 60)), now = c.ahora(), k, p; v3T = absT;   // reloj cosmético del juego (absT avanza en update)
      if (dt > 0) actualizar3D(dt, now);
      var yo = c.yo, soyS = yo === soloI, espect = yo < 0 || yo >= n, V = v3;
      if (now >= 0 && !(ent >= need) && now < dur) V3.musica(fase(now) === 2 ? 'silbon3' : 'silbon');
      V.esc.render(dt);
      /* nombres, zZz del chinchorro y el ¡! de los que delató el silbido */
      for (p = 0; p < n; p++) {
        var s3 = V.pjs[p], pt;
        if (isSolo(p)) {
          if (s3.a <= .02) continue;
          pt = V.esc.proyectar(s3.x, 0, s3.z + 1.1);
          txt(p === yo ? 'TÚ' : 'EL SILBÓN', pt.x, pt.y, 12, p === yo ? '#ffd23f' : '#e8dcff', 0, true);
          continue;
        }
        if (!s3.pj.g.visible) continue;
        var fz = frzV(p, now);
        pt = V.esc.proyectar(s3.x, 0, s3.z + (fz ? .7 : 1.1));
        txt(p === yo ? 'TÚ' : String(asiento(p).name || '').slice(0, 7), pt.x, pt.y, 12, p === yo ? '#ffd23f' : '#fffdf2', 0, true);
        if (fz) { var pz2 = V.esc.proyectar(s3.x + .5, 2.9 + Math.sin(absT * 3) * .15, s3.z); txt('zZz', pz2.x, pz2.y, 12, '#c8b8ff', 0, true); }
        else if (soyS && revelado(now)) { var pe = V.esc.proyectar(s3.x, 3.6, s3.z); txt('!', pe.x, pe.y, 22, '#ffd23f', 0, true); }
      }
      if (!soyS && !espect) { var mi3 = V.pjs[yo], po = V.esc.proyectar(mi3.x, 4.4, mi3.z); dibujaOido(po.x, po.y, now); }
      if (evOn('rayo', now) && Math.sin(absT * 50) > -0.3) { ctx.save(); ctx.globalAlpha = 0.3; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#fffdf2', 0); ctx.restore(); }
      if (soyS || espect) for (k = 0; k < ruido.length; k++) { var rz = ruido[k], ur = now - rz.t; if (ur >= 0 && ur < 1.4) { var pr = V.esc.proyectar(WX(rz.x), 1.2 + ur, WZ(rz.y)); ctx.save(); ctx.globalAlpha = 1 - ur / 1.4; txt('¡CRONCH!', pr.x, pr.y, 13, '#ffcf5a', 0, true); ctx.restore(); } }
      var G = geom();
      hud(G, 540);
      if (flash > 0) { ctx.save(); ctx.globalAlpha = flash * 0.2; rr(f.x0, 0, f.x1 - f.x0, 600, 0, '#c8b8ff', 0); ctx.restore(); }
      if (typeof drawP === 'function') drawP();
    }
    /* ───── la crónica de la noche (cosmética, por pantalla, sale de c.ahora() y del calendario de c.rng): banners de fase y de eventos ───── */
    function anuncia(s1, s2, col, d) { avisos.push({ s: s1, s2: s2 || '', col: col, t: absT, d: d || 1.9 }); if (avisos.length > 3) avisos.shift(); }
    function sfx3(k, sacude) { if (v3) { V3.sfx(k); if (sacude) v3.esc.sacudir(sacude); } }
    var TXT_EV = {
      nube: ['se viene un nubarrón…', '¡UNA NUBE TAPÓ LA LUNA!', 'el trío casi no ve nada', '#9aa8ff'],
      ganado: ['¡OJO! ¡VIENE EL GANADO!', '¡ESTAMPIDA!', 'las vacas arrastran a todo el que esté en el medio', '#ffb02e'],
      rayo: ['retumba a lo lejos…', '¡RELÁMPAGO!', 'por un instante todo el mundo se ve', '#fffdf2']
    };
    function cronica(now) {
      var f = now >= 0 ? fase(now) : 0, j, e, tx;
      if (f > faseV) {
        faseV = f; anuncia(NOM_FASE[f], SUB_FASE[f], f === 2 ? '#ff6a5a' : '#c8b8ff', 2.4); shake = Math.max(shake, f === 2 ? 0.7 : 0.4);
        if (v3) sfx3(f === 2 ? 'bocina' : 'tambor', f === 2 ? 0.8 : 0.4); else SND(f === 2 ? 220 : 160, 0.5, 'sawtooth', 0.05, -60);
      }
      for (j = 0; j < EVS.length; j++) {
        e = EVS[j]; tx = TXT_EV[e.k];
        if (!evSt[j] && now >= e.t - AVISO && now < e.t) { evSt[j] = 1; anuncia(tx[0], '', tx[3], AVISO + 0.2); if (v3) sfx3(e.k === 'rayo' ? 'trueno' : e.k === 'ganado' ? 'tambor' : 'viento'); else SND(140, 0.3, 'sine', 0.04, -40); }
        else if ((evSt[j] || 0) < 2 && now >= e.t && now < e.t + e.d) {
          evSt[j] = 2; anuncia(tx[1], tx[2], tx[3], 2);
          if (e.k === 'rayo') { flash = 1.6; shake = Math.max(shake, 0.6); sfx3('trueno', 0.9); if (!v3) SND(90, 0.8, 'sawtooth', 0.07, -40); }
          else if (e.k === 'ganado') { shake = Math.max(shake, 0.5); sfx3('golpe', 0.6); sfx3('tambor'); if (!v3) SND(110, 0.6, 'square', 0.05, -30); }
          else { sfx3('viento', 0.2); if (!v3) SND(200, 0.6, 'sine', 0.04, -80); }
        }
      }
    }
    function dibujaAvisos(G) {                                 // los banners (iguales en 2D y 3D)
      var k, a, u, al, y0 = 168;
      for (k = 0; k < avisos.length; k++) {
        a = avisos[k]; u = (absT - a.t) / a.d; if (u < 0 || u >= 1) continue;
        al = u < 0.12 ? u / 0.12 : u > 0.8 ? (1 - u) / 0.2 : 1;
        ctx.save(); ctx.globalAlpha = al * 0.78; rr(G.cx - 210, y0 - 22, 420, a.s2 ? 50 : 36, 12, INK, 0); ctx.restore();
        ctx.save(); ctx.globalAlpha = al;
        txt(a.s, G.cx, y0 - 3 + (u < 0.12 ? (1 - u / 0.12) * -10 : 0), G.w < 500 ? 18 : 24, a.col, 0, true);
        if (a.s2) txt(a.s2, G.cx, y0 + 18, G.w < 500 ? 11 : 13, '#fffdf2', 0, true);
        ctx.restore(); y0 += 58;
      }
    }
    var NIV_TXT = ['FUERTE · está LEJOS', 'medio · algo lejos', 'bajito · ¡CERCA!', 'casi nada · ¡LO TIENES ENCIMA!'], NIV_COL = ['#5cff7a', '#c8e85a', '#ffb02e', '#ff4a3a'];
    function dibujaOido(x, y, now) {                           // lo que oye mi pantalla del trío cuando silba: la leyenda al revés
      if (!oido || now < oido.t || now > oido.t + OIDO_T) return;
      var u = (now - oido.t) / OIDO_T, al = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.save(); ctx.globalAlpha = al;
      if (oido.cerca) { txt('fiu… fiu…', x, y - u * 8, 11, '#c8b8ff', 0, true); txt(oido.niv > 2 ? '¡ENCIMA! ¡CORRE!' : '¡SUAVECITO: ESTÁ CERCA!', x, y + 16, 14, '#ff6a5a', 0, true); }
      else { txt('¡FIIIUUUU!', x + Math.sin(absT * 40) * 2, y - u * 8, Math.round(16 + 16 * oido.k), '#e8dcff', 0, true); txt('fuerte = está lejos', x, y + 18, 12, '#5cff7a', 0, true); }
      ctx.restore();
    }
    function oidoMedidor(G, by, now) {                         // el medidor del oído del trío (siempre en pantalla): 4 rayitas, MÁS RAYITAS = MÁS LEJOS
      var vivo = oido && now >= oido.t && now < oido.t + OIDO_T + 2.5, k, niv = vivo ? oido.niv : -1, nr = vivo ? 4 - niv : 0, bx = G.cx - 70;
      ctx.save(); ctx.globalAlpha = 0.6; rr(G.cx - 150, by - 26, 300, 22, 8, INK, 0); ctx.restore();
      txt('OÍDO', bx - 40, by - 14, 11, '#e8dcff', 0, true);
      for (k = 0; k < 4; k++) rr(bx - 14 + k * 17, by - 21, 13, 12, 3, k < nr ? NIV_COL[Math.max(0, niv)] : '#2a2240', 0);
      txt(vivo ? NIV_TXT[niv] : 'espera el silbido…', G.cx + 62, by - 14, 11, vivo ? NIV_COL[niv] : '#9a90b8', 0, true);
    }
    function vineta(f, now) {                                  // borde rojo que late cuando el silbido sonó bajito: ¡CERCA!
      if (!oido || oido.niv < 2 || now < oido.t || now > oido.t + OIDO_T) return;
      var u = (now - oido.t) / OIDO_T, a = (1 - u) * (0.18 + 0.12 * Math.sin(absT * (oido.niv > 2 ? 18 : 10))), w = f.x1 - f.x0;
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      rr(f.x0, 0, w, 16, 0, '#ff2a1a', 0); rr(f.x0, 584, w, 16, 0, '#ff2a1a', 0); rr(f.x0, 0, 16, 600, 0, '#ff2a1a', 0); rr(f.x1 - 16, 0, 16, 600, 0, '#ff2a1a', 0);
      ctx.restore();
    }
    var g = {
      update: function (dt) {
        var now = c.ahora(), p;
        absT += dt; flash = Math.max(0, flash - dt * 2.5); shake = Math.max(0, shake - dt * 3);
        cronica(now);
        for (p = 0; p < n; p++) updPos(p, dt, now);
        if (now >= 0) { for (p = 0; p < n; p++) if (!isSolo(p) && c.mio(p)) juzga(p, now); if (c.mio(soloI) && now >= FIRST * 0.5) tocaSilbon(now); }
        if (now >= 0.2 && !voz.ini) { voz.ini = 1; if (!c.practica) { var sp = pnt(SW / 2, 30, 0, 3); S(isSolo(c.yo) ? '¡FIUUU-FIU-FIU!' : 'Cuando se oye cerca está lejos…', sp.x, sp.y, '#fffdf2'); } }
        if (entAt >= 0 && !voz.fin) { voz.fin = 1; var sg = pnt(LX, LY, -120, 5.5); S('¡LA CESTA LLENA!', sg.x, sg.y, '#5cff7a'); }
      },
      ai: function (p, dt, api) {
        var now = c.ahora();
        if (isSolo(p)) aiSolo(p, dt, api, now); else aiTrio(p, dt, api, now);
      },
      cuerpo: function (p) {
        var q = P[p], now = c.ahora();
        return { x: Math.round(q.x), y: Math.round(q.y), l: isSolo(p) ? 0 : (q.l ? 1 : 0), st: isSolo(p) ? 0 : (now < q.frz ? 1 : 0), tm: Math.round(now * 20) };   // tm: reloj de partida del dueño (1/20 s); interpolado da la hora de la imagen
      },
      onEv: function (ty, p, d, t) {
        if (!d || typeof d !== 'object' || !num(p) || p < 0 || p >= n) return;
        var q = P[p], now = c.ahora();
        if (ty === 'silbo') {
          if (!isSolo(p) || !num(d.k) || d.k <= silbo.k || !num(d.x) || !num(d.y)) return;
          silbo = { k: d.k, t: now, x: cl(d.x, 0, SW), y: cl(d.y, 0, SH) };
          if (c.mio(p)) { q.nextS = Math.max(q.nextS, now + SIL_CD); q.ultS = Math.max(q.ultS, now); }
          /* lo que OYE mi pantalla del trío: FUERTE si está lejos, suave si está cerca (la leyenda) */
          oido = null;
          if (c.yo >= 0 && c.yo < n && !isSolo(c.yo) && !frzV(c.yo, now)) { var dO = hyp(P[c.yo].x - silbo.x, P[c.yo].y - silbo.y); oido = { t: now, d: dO, cerca: dO < CERCA, k: cl(dO / 260, 0.12, 1), niv: dO < ENCIMA ? 3 : dO < CERCA ? 2 : dO < 200 ? 1 : 0, rad: dO * (0.9 + 0.2 * c.fx()) }; }   // niv 0 lejos · 3 encima; rad: el aro de distancia (con un poquito de duda: sin dirección)
          if (v3) silbo3D(); else if (oido && oido.cerca) SND(1300, 0.35, 'sine', 0.015, 300); else { SND(620, 0.18, 'sine', 0.05, 380); SND(880, 0.28, 'sine', 0.04, 520); }
          return;
        }
        if (ty === 'toque') { if (isSolo(p) && num(d.v) && d.v >= 0 && d.v < n && !isSolo(d.v) && num(d.x) && num(d.y) && num(d.t)) confirmaToque(d.v, d, now); return; }
        if (isSolo(p)) return;
        if (ty === 'got') { if (typeof d.id === 'string' && byId[d.id]) toma(d.id, p); return; }
        if (ty === 'entrega') {
          if (!num(d.n) || d.n <= q.nEnt || d.n > q.nEnt + 3) return;
          var dn = d.n - q.nEnt, dv = cl(num(d.v) ? d.v - q.vEnt : dn, dn, 2 * dn);   // v: valor acumulado del dueño (los de oro valen 2); idempotente igual que n
          ent += dv; q.vEnt += dv; q.nEnt = d.n;
          if (typeof d.id === 'string') { gastado[d.id] = 1; if (taken[d.id] === undefined) taken[d.id] = p; }
          if (q.lleva === d.id || c.mio(p)) q.lleva = null;
          if (ent >= need && entAt < 0) entAt = now;
          var se2 = pnt(LX + 31, LY, -60, 4.2);
          S(GRITOS_ENT[(ent + p) % GRITOS_ENT.length], se2.x, se2.y, '#ffd23f');
          if (v3) entrega3D(p);
          else { var se = scr(geom(), LX + 31, LY - 30); SPAWN(se.x, se.y, 14, 'conf', ['#ffb02e', '#ffd23f', '#5cff7a', '#fff'], 280, 480, 0.8); SND(660, 0.12, 'square', 0.06, 300); SND(990, 0.16, 'square', 0.05, 200); }
          return;
        }
        if (ty === 'atrapado') {
          if (!num(d.n) || d.n <= q.nAtr || !num(d.x) || !num(d.y)) return;
          q.nAtr = d.n; atrTot++;
          var lid = typeof d.id === 'string' && d.id ? d.id : null;
          if (lid) { gastado[lid] = 1; if (taken[lid] === undefined) taken[lid] = p; nuevoCaido('r' + p + '_' + d.n, cl(d.x, AX0, AX1), cl(d.y, AY0, AY1), now, valor(lid) > 1); }
          q.lleva = null;
          if (c.mio(p)) { q.frz = now + FRZ; q.grace = now + FRZ + 0.6; q.l = 0; q.linT = -9; var hc = casa(p); q.x = hc.x; q.y = hc.y; q.px = q.x; q.py = q.y; }
          shake = p === c.yo ? 0.6 : 0.25; flash = p === c.yo ? 0.8 : 0.3;
          var sa = pnt(d.x, d.y, -90, 4.6);
          S(GRITOS_ATR[(atrTot + p) % GRITOS_ATR.length], sa.x, sa.y, '#ff8a5a');
          if (v3) atrapado3D(p, d, !!lid);
          else { var sb = scr(geom(), d.x, d.y - 30); SPAWN(sb.x, sb.y, 10, 'conf', ['#ffb02e', '#c9a35a', '#fff'], 260, 480, 0.7); SND(300, 0.3, 'sine', 0.06, -200); }
        }
        void t;
      },
      claimOk: function (id, p, tMs) {
        var o = byId[id];
        if (!o || taken[id] !== undefined || gastado[id] || !num(p) || p < 0 || p >= n || isSolo(p)) return false;
        if (tMs / 1000 < o.t0 - 0.25 || P[p].lleva) return false;
        return true;
      },
      concede: function (id, p) { if (p >= 0) toma(String(id), p); },
      alCpu: function (p) { plan[p] = planNuevo(); P[p].grace = Math.max(P[p].grace, c.ahora() + 0.6); if (P[p].remSt && P[p].frz < c.ahora()) P[p].frz = c.ahora() + 1.5; },
      alHum: function (p, o) { if (o && num(o.x) && num(o.y)) { P[p].x = o.x; P[p].y = o.y; } plan[p] = planNuevo(); },
      scores: function () {                                    // aditivo y comparable (M3 DM3-3): el ganador lo decide compara('1v3', …)
        var out = [], p, falta = need - Math.min(ent, need);
        for (p = 0; p < n; p++) out.push(isSolo(p) ? PTS * falta : PTS / 2);
        return out;
      },
      done: function () { return ent >= need && entAt >= 0 && c.ahora() >= entAt + CELEBRA; },
      hudChip: function (p) {
        if (isSolo(p)) return Math.min(ent, need) + '/' + need;
        return P[p].nEnt ? '+' + P[p].nEnt : (P[p].nAtr ? '×' + P[p].nAtr : '—');
      },
      destacado: function () {
        var me = c.yo >= 0 ? c.yo : 0;
        if (isSolo(me)) return ent >= need ? 'se le llenó la cesta al trío' : 'agarró ' + atrTot + ' vez' + (atrTot === 1 ? '' : 'es');
        return P[me].nEnt ? 'llevó ' + P[me].nEnt + ' mango' + (P[me].nEnt === 1 ? '' : 's') : P[me].nAtr ? 'lo agarró el Silbón ' + P[me].nAtr + ' vez' + (P[me].nAtr === 1 ? '' : 'es') : 'ni lo vieron';
      },
      vista: function () {                                     // observable para bancos y pruebas
        var now = c.ahora();
        return { gt: now, lv: lv, soloI: soloI, need: need, ent: ent, gana: ent >= need, atr: atrTot, silbos: silbo.k, silboT: silbo.t,
          x: P.map(function (q) { return q.x; }), y: P.map(function (q) { return q.y; }), lleva: P.map(function (q) { return q.lleva; }), frz: P.map(function (q, i) { return frzV(i, now) ? 1 : 0; }),
          l: P.map(function (q, i) { return linV(i) ? 1 : 0; }), nEnt: P.map(function (q) { return q.nEnt; }), nAtr: P.map(function (q) { return q.nAtr; }), nextS: P[soloI].nextS,
          trees: trees.map(function (k) { return [Math.round(k.x), Math.round(k.y), Math.round(k.r)]; }), sched: objs.filter(function (o) { return !o.caido; }).map(function (o) { return [o.id, o.x, o.y, o.t0]; }),
          mangos: objs.filter(function (o) { return activo(o, now); }).map(function (o) { return [o.id, o.x, o.y]; }), caidos: objs.filter(function (o) { return o.caido; }).length,
          lamp: [LX, LY], rv: revelado(now) };
      },

      draw: function () {
        if (v3 === null && V3 && V3.listo && V3.listo()) v3 = montar3D() || false;
        if (v3) return dibujar3D(cp());
        dibujar2D();
      }
    };
    function ellP(x, y, rx, ry, m) { var o = [], a; for (a = 0; a <= m; a++) o.push([x + Math.cos(a / m * 6.2832) * rx, y + Math.sin(a / m * 6.2832) * ry]); return o; }
    return g;
  }
});
})();
