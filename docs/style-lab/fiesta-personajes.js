// LA FIESTA · personajes (FIESTA.PJ): el elenco de la hoja de referencia (assets/fiesta/referencia-personajes.png) como DATOS + un solo dibujante.
// Se dibuja SOLO con las primitivas del laboratorio (rr, ell, line, poly, txt, bust, hand, limb), así sale igual en los 6 estilos
// (snes, felt, ww, anime, tinta, garabato) y se parece al elenco de los minijuegos (BUS.AP.CAST): la base de cada personaje es una
// opción de bust() de engine.js (cara, pelo, lentes, camisa, brazos con mano, piernas); encima van los adornos (casco, pañuelo, bigote…),
// el parpadeo, las lágrimas y los objetos que cada mano sostiene (taza, pan, chancla, consola…).
//
// API (window.FIESTA.PJ / module.exports):
//   draw(c, id, x, y, s, mood, t, op)  dibuja el personaje. c = ctx del laboratorio (se usa el global `ctx`; c solo es respaldo).
//        (x, y) = CENTRO DE LA CABEZA (op.ancla:'pies' => y son los pies de un personaje de cuerpo entero); s = escala de bust() (alto de
//        cabeza ≈ 84·s; con h = alto-de-cabeza-de-tarjeta, s = h/110); mood = 'esperar'|'hablar'|'celebrar'|'perder' o un mood crudo de
//        bust ('worry', 'yell', 'sleep'…); t = segundos (todo es función pura de (id, mood, t): sin azar).
//        op = {modo:'cara'|'busto'|'cuerpo' (cara = sin brazos; cuerpo = con piernas), flip, clip:{x,y,w,h}, clipC:{x,y,r}, sombra, gris,
//              tinte (color de camisa), semilla, mood (crudo), talk, rot, sy, confeti:false, ancla:'cabeza'|'pies'}
//   token(id, x, y, r, mood, t, op)   medallón redondo para el tablero (aro con el color del personaje + cara recortada)
//   lista(todos?) -> ids activos en orden (todos = los 24 de la hoja) · color(id) · frase(id, ctx, idx) · ficha(id) -> fila de CHARS · ident(id)
//   retrato / dibujaPj / pose / placa / glifo / animoMood / oscuro: lo que fiesta-ui reexporta (mismas firmas de siempre)
//   CHARS (tabla por id) · PJ / PJ_IDS (vista de los ACTIVOS, se rellena en sitio) · cargarRoster(R.PERSONAJES) · def(id, spec) · ANIMOS
// Todo lo del personaje es SABOR (frases, rasgo, color, voz): nada afecta números del juego. Sumar uno de los 16 inactivos = que el dueño del
// reductor lo agregue a PERSONAJES (fiesta-reglas.js); aquí ya tiene su diseño.
// Cada personaje activo vive en su región «// <<pj:ID>>» … «// <</pj:ID>>»: spec (colores, look de bust, adornos, objetos, frases) y un gancho
// opcional ex(K) que dibuja extras propios encima (K = marco del cuadro: hw, hh, ex, ey, my, t, an, s).
(function (root) {
'use strict';
const F = root.FIESTA = root.FIESTA || {};
const TAU = Math.PI * 2, HY = -64, INKC = '#14101c', GRIS = '#9a96a8';
const ANIMOS = ['esperar', 'hablar', 'celebrar', 'perder'];
const ANIM_SET = { esperar: 1, hablar: 1, celebrar: 1, perder: 1 };
const CONF = ['#ffd23f', '#ff5c8a', '#5cff7a', '#3fb0ff', '#ff8a3d', '#b49cff'];
const num = (v) => { v = +v; return isFinite(v) ? v : 0; };
const fr = (v) => v - Math.floor(v);
const hs = (n) => fr(Math.sin(n * 12.9898 + 78.233) * 43758.5453);       // hash determinista (0..1) para parpadeo, sílabas, confeti
const labP = () => typeof rr === 'function' && typeof ell === 'function' && typeof txt === 'function';
const labB = () => labP() && typeof bust === 'function' && typeof ctx !== 'undefined' && !!ctx;
const tnow = () => (typeof now === 'number' ? now : 0);
const estilo = () => (typeof style === 'string' ? style : 'snes');

/* ───────────── color ───────────── */
function oscuro(c, k) {                  // mezcla hacia negro, siempre #rrggbb válido
  const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return '#4a4558';
  const n = parseInt(m[1], 16), f = (v) => ('0' + Math.max(0, Math.min(255, Math.round(v * k))).toString(16)).slice(-2);
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}
function claro(c, k) {                   // mezcla hacia blanco
  const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return '#ffffff';
  const n = parseInt(m[1], 16), f = (v) => ('0' + Math.max(0, Math.min(255, Math.round(v + (255 - v) * k))).toString(16)).slice(-2);
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

/* ───────────── tabla de personajes ─────────────
   spec = { n, hoja, col, glifo, frase, rasgo, pitch?, base? ('calm'|'smile'|'grin': cara en reposo), v:{esperar,hablar,celebrar,perder: [frases…]},
            look: opciones de bust() (skin, shirt, pat, sh2, hair, hairCol, glasses, earring, cheeks, brow, bw, hw, hh, cap, hat, stache, chain…),
            legs: [pantalón, zapato, largo, zapato2?], sobre: [[adorno, color]…], prop: {k, lado:'izq'|'der', idle?, talk?, centro?, col?}, prop2, otra }
   otra = qué hace la mano libre: 'cadera' | 'boca' | 'puno' | 'cruzado' · ex(K) = gancho de extras propios (opcional) */
const CHARS = {}, ORDEN_PJ = ['tu', 'mama', 'abuela', 'tio', 'pana', 'prima', 'cobrador', 'portu'];
const semillaDe = (id) => { let h = 7; String(id || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) % 9973; }); return 600 + h; };
const NOARMS = [];
function brazo(sd) { return { side: sd, len: 66, a: sd * .2, w: 21, col: '#fff', hand: null }; }
function def(id, d) {
  d.id = id; d.col2 = oscuro(d.col, .62); d.pitch = d.pitch || 1; d.activo = false; d.sobre = d.sobre || []; d.otra = d.otra || '';
  d.v = d.v || {}; d.frases = {};
  ANIMOS.forEach((a) => { const l = d.v[a]; d.frases[a] = (l && l[0]) || d.frase; });
  d.sem = semillaDe(id); d.ph = hs(d.sem) * TAU;
  d.legs = d.legs || ['#3a3a4a', '#f4f4f4', 58];
  // arma lo que bust() consume: UN objeto de opciones por personaje (se reutiliza; cero asignaciones por cuadro) y sus brazos con su mano-objeto
  d.o = Object.assign({}, d.look, { x: 0, y: 0, s: 1, flip: false, mood: 'calm', talk: 0, look: 0, rot: 0, sy: 1, th: 0, legs: null, arms: NOARMS });
  d.lg = { skin: '#8a8696', shirt: '#5a5668', hairCol: '#3a3648' };
  d.aI = brazo(-1); d.aD = brazo(1);
  const pi = d.prop && (d.prop.centro || d.prop.lado === 'izq') ? d.prop : d.prop2 && d.prop2.lado === 'izq' ? d.prop2 : null,
    pd = d.prop && !d.prop.centro && d.prop.lado !== 'izq' ? d.prop : d.prop2 && d.prop2.lado !== 'izq' ? d.prop2 : null;
  d.pI = pi; d.pD = pd && pd !== pi ? pd : null;
  d.aI.hand = manoDe(d, -1, d.pI); d.aD.hand = manoDe(d, 1, d.pD);
  d.arms2 = [d.aI, d.aD]; d.armsI = [d.aI]; d.armsD = [d.aD];
  d.frente = d.otra === 'boca' ? (d.pI ? 1 : -1) : 0;            // brazo que sube a la boca (se dibuja DESPUÉS de la cabeza)
  CHARS[id] = d; return d;
}

/* ───────────── marco del cuadro (reutilizado) ───────────── */
const K = { an: 'esperar', t: 0, s: 1, hw: 40, hh: 42, ex: 17, ey: HY - 6, rx: 10, ry: 12, rect: 0, my: HY + 24, skin: '#e8b48a', shirt: '#fff', sp: null, big: true };
const PS = { mood: 'calm', talk: 0, dy: 0, rot: 0, sy: 1, look: 0, blink: 0, lloro: 0 };
function medidas(st, lk) {               // geometría de cabeza/ojos/boca de CADA estilo (lo que dibuja engine.js en CHAR.<estilo>)
  const hw = lk.hw || 40, hh = lk.hh || 42, es = lk.eyeS || 17, er = lk.eyeR || 9.5;
  K.rect = 0;
  if (st === 'snes') { K.hw = hw + 2; K.hh = hh - 2; K.ex = Math.round(es / 4) * 4; K.ey = HY - 2; K.rx = 8; K.ry = 9; K.rect = 1; K.my = HY + K.hh * .55; }
  else if (st === 'felt') { K.hw = hw + 3; K.hh = hh + 3; K.ex = es; K.ey = HY - 6; K.rx = 14; K.ry = 14; K.my = HY + K.hh * .6; }
  else if (st === 'ww') { K.hw = hw + 4; K.hh = hh + 3; K.ex = 17; K.ey = HY - 2; K.rx = 11.5; K.ry = 15; K.my = HY + K.hh * .58; }
  else if (st === 'anime') { K.hw = hw - 3; K.hh = hh + 2; K.ex = es; K.ey = HY + 2; K.rx = 11.5; K.ry = 16; K.my = HY + K.hh * .62; }
  else { K.hw = hw; K.hh = hh; K.ex = es; K.ey = HY - 6; K.rx = er + 1.5; K.ry = er * 1.15 + 1.5; K.my = HY + K.hh * .56; }
}

/* ───────────── poses de brazo: [ángulo hacia afuera (negativo = hacia adentro), largo] ───────────── */
const HOLD = { festLado: [2.3, 66], centroAlto: [-.26, 46], cuelga: [.16, 70], pecho: [.5, 36], cadera: [.62, 54], lado: [1.0, 58], alto: [2.5, 70], oreja: [2.77, 53], centro: [-.3, 60], festejo: [2.75, 72], caida: [.05, 78] };
function brazoPose(A, sd, pr, otra, an, tt) {
  let h = HOLD.cuelga, w = 0;
  if (an === 'celebrar') { h = (pr && pr.fest && HOLD[pr.fest]) || HOLD.festejo; w = Math.sin(tt * 9 + sd) * .2; }
  else if (an === 'perder') { h = HOLD.caida; w = Math.sin(tt * 1.4 + sd) * .03; }
  else if (pr && pr.centro) { h = (pr.pose && HOLD[pr.pose]) || HOLD.centro; w = Math.sin(tt * (an === 'hablar' ? 6 : 2)) * .03; }
  else if (pr) {
    if (an === 'hablar') { h = HOLD[pr.talk || 'lado'] || HOLD.lado; w = Math.sin(tt * (pr.talk === 'alto' ? 11 : 4)) * (pr.talk === 'alto' ? .22 : .16); }
    else { h = HOLD[pr.idle || 'pecho'] || HOLD.pecho; w = Math.sin(tt * 2.2 + sd) * .03; }
  } else if (otra === 'cadera') { h = HOLD.cadera; w = Math.sin(tt * 2.2) * .02; }
  else if (an === 'hablar') { h = HOLD.lado; w = .2 + Math.sin(tt * 5 + sd) * .4; }
  else if (otra === 'puno' || otra === 'cruzado') { h = HOLD.pecho; w = Math.sin(tt * 2) * .03; }
  else { w = Math.sin(tt * 1.7 + sd) * .04 + Math.sin(tt * 2.2) * .02; }
  A.a = sd * (h[0] + w); A.len = h[1];
}

/* ───────────── pose por ánimo (función pura de (id, ánimo, t)) ───────────── */
const BOCAS = ['smile', 'grin', 'o', 'smile'];
function posa(P, sp, an, t, raw) {
  const tt = t + sp.ph, br = Math.sin(tt * 2.2);
  P.mood = raw || sp.base || 'calm'; P.talk = 0; P.dy = 0; P.rot = 0; P.sy = 1; P.lloro = 0;
  P.look = Math.sin(tt * .7) * .55;
  const per = 3.3 + (sp.ph % 1.4);                                       // parpadeo cada ~3 s, dura .14 s
  P.blink = ((t + sp.ph * 5) % per) < .14 ? 1 : 0;
  if (an === 'hablar') {
    P.dy = Math.sin(tt * 5) * .9; P.rot = Math.sin(tt * 3.1) * .025; P.look = Math.sin(tt * 1.3) * .4;
    if (!raw) P.mood = BOCAS[(hs(Math.floor(t * 8) + sp.ph * 10) * 4) | 0];      // sílabas: boca que abre y cierra
  } else if (an === 'celebrar') {
    P.dy = -Math.abs(Math.sin(tt * 3.2)) * 14; P.rot = Math.sin(tt * 3.2) * .07; P.look = 0;
    if (!raw) P.mood = ((tt * 3) | 0) % 3 === 2 ? 'grin' : 'happy';
  } else if (an === 'perder') {
    P.dy = 7 + br * .8; P.sy = .95; P.rot = .05 + Math.sin(tt * 1.3) * .015; P.lloro = 1; P.look = 0;
    if (!raw) P.mood = 'frown';
  } else { P.dy = br * 1.6; P.sy = 1 + br * .012; }
}
// ánimo -> parámetros de bust (puro, siempre números finitos): lo que reexporta fiesta-ui como animoMood
function animoMood(animo, t) {
  t = num(t); const o = { mood: 'calm', talk: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
  if (animo === 'esperar') o.dy = Math.sin(t * 2.2) * 1.5;
  else if (animo === 'hablar') { o.mood = 'smile'; o.talk = (Math.sin(t * 6 * TAU) + 1) / 2; o.dy = Math.sin(t * 5) * .8; }
  else if (animo === 'celebrar') { o.mood = 'happy'; o.dy = -Math.abs(Math.sin(t * Math.PI * 2)) * 14; o.rot = Math.sin(t * TAU) * .08; }
  else if (animo === 'perder') { o.mood = 'frown'; o.dy = 4; o.sy = .96; o.rot = .04; }
  else if (typeof animo === 'string' && animo) o.mood = animo;
  return o;
}

/* ───────────── geometría común ───────────── */
function arco(cx, cy, r, a0, a1, n, sy) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (sy || 1)]); } return p; }
function estrella(x, y, r, col, o) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * .45 : r; p.push([x + Math.cos(a) * k, y + Math.sin(a) * k]); } poly(p, col, o === undefined ? 2.5 : o); }
function vapor(x, y, t, col) {            // vapor de taza (dos hilos que ondulan)
  for (let i = 0; i < 2; i++) { const ox = x + (i ? 5 : -4), a = t * 3 + i * 1.7;
    line([[ox, y], [ox - 3 + Math.sin(a) * 3, y - 9], [ox + 1 + Math.sin(a + 1) * 3, y - 18]], 3, col); }
}
const BIGOTE = [[-30, HY + 11], [-14, HY + 6], [0, HY + 12], [14, HY + 6], [30, HY + 11], [27, HY + 19], [20, HY + 24], [8, HY + 19], [0, HY + 21], [-8, HY + 19], [-20, HY + 24], [-27, HY + 19]];
const PANO = [[-24, -21], [24, -21], [14, 2], [0, 18], [-14, 2]];

/* ───────────── adornos de cabeza/cara (se dibujan DESPUÉS de bust, en su marco local; HY = -64 es el centro de la cabeza) ───────────── */
const SOBRE = {
  casco(c) { const hw = K.hw + 6, top = HY - K.hh;
    poly(arco(0, top + 20, hw, Math.PI, TAU, 14, 32 / hw), c, 4);
    rr(-hw - 2, top + 15, hw * 2 + 4, 9, 4, oscuro(c, .72), 3);
    rr(-6, top - 11, 12, 28, 3, '#ffffff', 0);                                    // franja del casco
    rr(-hw + 4, top + 23, hw * 2 - 8, 7, 3, '#bfe8ff', 2.5);                       // visor levantado
    line([[-hw + 2, top + 28], [-hw + 4, HY + K.hh * .5]], 3, oscuro(c, .6)); line([[hw - 2, top + 28], [hw - 4, HY + K.hh * .5]], 3, oscuro(c, .6)); },   // correa
  panuelo(c) { const hw = K.hw, top = HY - K.hh;
    rr(-hw - 3, top + 8, hw * 2 + 6, 15, 7, c, 3.5);
    for (let i = 0; i < 4; i++) ell(-24 + i * 16, top + 15, 2.6, 2.6, '#ffffff', 0);
    ell(0, top + 2, 10, 8, c, 3.5);                                               // el nudo
    poly([[-3, top + 2], [-26, top - 12], [-22, top + 4]], c, 3); poly([[3, top + 2], [26, top - 12], [22, top + 4]], c, 3); },
  turbante(c) { const hw = K.hw, top = HY - K.hh;
    ell(0, top - 2, hw + 9, 27, c, 4); line(arco(0, top - 4, hw - 4, Math.PI * 1.1, Math.PI * 1.9, 8, .5), 3, oscuro(c, .78)); line(arco(0, top + 2, hw - 12, Math.PI * 1.1, Math.PI * 1.9, 8, .5), 3, oscuro(c, .78));
    rr(-hw - 4, top + 11, hw * 2 + 8, 11, 5, oscuro(c, .85), 3.5); ell(hw - 6, top + 2, 9, 8, c, 3); },
  lentesFrente(c) { const top = HY - K.hh;
    rr(-30, top + 1, 27, 16, 7, c, 3); rr(3, top + 1, 27, 16, 7, c, 3); line([[-3, top + 8], [3, top + 8]], 3.5, INKC);
    ell(-22, top + 6, 5, 2.6, '#7a8ab0', 0); ell(11, top + 6, 5, 2.6, '#7a8ab0', 0); },
  bigote(c) { poly(BIGOTE, c, 3); },
  bigoteTio(c) { const y = HY + K.hh * .22; poly([[-26, y + 4], [-12, y - 2], [0, y + 3], [12, y - 2], [26, y + 4], [23, y + 11], [16, y + 12], [6, y + 7], [0, y + 8], [-6, y + 7], [-16, y + 12], [-23, y + 11]], c, 3); },
  lentesGato(c) { const e = K.ex, y = K.ey;
    for (let sg = -1; sg <= 1; sg += 2) line([[sg * (e - 14), y - 2], [sg * (e + 1), y - 12], [sg * (e + 17), y - 18], [sg * (e + 16), y + 2], [sg * (e + 6), y + 12], [sg * (e - 10), y + 10]], 3.6, c, true);
    line([[-e + 14, y - 3], [e - 14, y - 3]], 3.2, c); },
  clips(c) { const top = HY - K.hh; estrella(K.hw - 8, top + 24, 7, c, 2); estrella(K.hw - 22, top + 16, 5, c, 2); },
  cinta(c) { const hw = K.hw, top = HY - K.hh; rr(-hw - 1, top + 12, hw * 2 + 2, 9, 4, c, 3); ell(-hw + 6, top + 11, 10, 7, c, 3); ell(-hw - 2, top + 20, 6, 8, c, 3); },
  cola(c) { const hw = K.hw, top = HY - K.hh; ell(hw + 4, top + 22, 8, 10, c, 3.5); rr(hw + 1, top + 24, 15, 46, 7, c, 3.5); },
  mecha(c) { const top = HY - K.hh; line([[-K.hw + 8, top + 6], [-K.hw + 2, top + 46]], 7, c); line([[-K.hw + 18, top + 4], [-K.hw + 14, top + 30]], 5, c); },
  lapiz(c) { const hw = K.hw; poly([[hw - 4, HY - 26], [hw + 3, HY - 28], [hw + 14, HY + 4], [hw + 8, HY + 8]], c, 2.5); poly([[hw + 8, HY + 8], [hw + 14, HY + 4], [hw + 12, HY + 12]], '#f3d9b0', 1.5); },
  panoCuello(c) { poly(PANO, c, 3); rr(-26, -25, 52, 8, 4, oscuro(c, .8), 3); }
};

/* ───────────── objetos en mano (origen = la mano; arriba = −y). sd = −1 izq / +1 der; se dibujan dentro del marco de bust, así se espejan solos ───────────── */
const PROP = {
  taza(sd, pr, t) { ell(sd * 13, -9, 5.5, 6.5, '#e8e4f0', 2.5); rr(-12, -20, 24, 24, 6, '#fffdf2', 3); ell(0, -20, 10, 3.5, '#7a4a2a', 0); rr(-12, -9, 24, 6, 2, '#ff8fb8', 0); vapor(0, -24, t, '#e8e4f0'); },
  vaso(sd, pr, t) { rr(-9, -28, 18, 34, 4, '#f4e9d8', 3); rr(-8, -14, 16, 19, 3, '#8a5a3a', 0); ell(0, -28, 10, 3.6, '#ffffff', 2.5); line([[3, -28], [7, -44]], 3.4, '#ff6fa8'); },
  pan(sd, pr, t) { ctx.save(); ctx.rotate(sd * .55); rr(-8, -42, 16, 56, 8, '#e6a85a', 3.5); for (let i = 0; i < 3; i++) line([[-4, -34 + i * 14], [4, -29 + i * 14]], 2.6, '#fff3c8'); ctx.restore(); },
  chancla(sd, pr, t) { ctx.save(); ctx.rotate(sd * (.3 + (K.an === 'hablar' ? Math.sin(t * 10) * .3 : 0)));
    ell(0, -20, 11, 25, '#2f7fe0', 3.5); ell(0, -22, 7, 19, '#6fb0ff', 0); line([[-8, -26], [0, -9], [8, -26]], 5, '#ffffff'); ell(0, -9, 3.6, 3.6, '#ffffff', 2);
    ell(0, -5, 9, 8.5, K.skin, 3); for (let i = -1; i <= 1; i++) line([[i * 4, -9], [i * 4, -6]], 1.6, oscuro(K.skin, .6)); ctx.restore(); },   // el puño agarra la chancla (siempre se ve la mano)
  telefono(sd, pr, t) { rr(-8, -22, 16, 31, 4, pr.col || '#ff6fa8', 3); rr(-5.5, -18, 11, 21, 2, '#7fe0ff', 0); ell(0, 6, 1.6, 1.6, '#ffffff', 0); },
  monedas(sd, pr, t) { for (let i = 0; i < 3; i++) { ell(-9 + i * 9, -14 - (i === 1 ? 5 : 0), 8.5, 8.5, '#ffd23f', 2.5); ell(-9 + i * 9, -14 - (i === 1 ? 5 : 0), 4.6, 4.6, '#f0b020', 0); } },
  tambor(sd, pr, t) { ctx.save(); ctx.translate(-sd * 15, -2); rr(-19, -20, 38, 31, 9, '#8a2f1f', 3.5); ell(0, -20, 19, 6.5, '#f2dfb0', 3); line([[-14, -14], [-7, 5], [0, -14], [7, 5], [14, -14]], 2.6, '#f2dfb0'); ctx.restore(); },
  consola(sd, pr, t) { const cel = K.an === 'celebrar'; if (sd > 0 && !cel) return; ctx.save();   // en reposo va entre las dos manos (la dibuja la izquierda); al celebrar la alza en el puño
    if (cel) { ctx.translate(0, -20 + Math.sin(t * 9) * 2); ctx.rotate(-.22); } else ctx.translate(24, -2);
    rr(-33, -16, 66, 32, 6, '#2a2a38', 3); rr(-21, -11, 42, 22, 3, '#d8fbff', 2); rr(-33, -16, 12, 32, 5, '#ff2d55', 2.5); rr(21, -16, 12, 32, 5, '#19d3ff', 2.5);
    ell(-5, -2, 8, 5, '#ffffff', 0); ell(6, 0, 3, 3, '#ffd23f', 0); ctx.restore(); if (!cel) ell(0, 0, 12, 12, K.skin, 3); else ell(0, 2, 11, 10, K.skin, 3); },
  control(sd, pr, t) { rr(-18, -10, 36, 19, 8, '#2a2a38', 3); rr(-13, -2, 10, 3.2, 0, '#dddddd', 0); rr(-9.5, -5.5, 3.2, 10, 0, '#dddddd', 0); ell(9, -3, 2.8, 2.8, '#ff4d5e', 0); ell(14, 2, 2.8, 2.8, '#5cff7a', 0); },
  guitarra(sd, pr, t) { ctx.save(); ctx.rotate(sd * .7); rr(-3, -76, 6, 58, 2, '#6a3a1a', 3); rr(-6, -86, 12, 14, 3, '#3a2010', 3); ell(0, -6, 17, 21, '#c9733a', 3.5); ell(0, -6, 5.5, 5.5, INKC, 0); ctx.restore(); },
  cuatro(sd, pr, t) { ctx.save(); ctx.rotate(sd * .7); rr(-2.5, -58, 5, 42, 2, '#6a3a1a', 3); rr(-5, -66, 10, 11, 3, '#3a2010', 3); ell(0, -6, 13, 17, '#d9983e', 3.5); ell(0, -6, 4.2, 4.2, INKC, 0); ctx.restore(); },
  micro(sd, pr, t) { ctx.save(); ctx.rotate(-sd * .3); rr(-4.5, -30, 9, 36, 4, '#2a2a38', 3); ell(0, -35, 8.5, 8.5, '#c8c8d8', 3); ctx.restore(); },
  planta(sd, pr, t) { ell(-6, -27, 6, 11, '#3fa85a', 2.5); ell(6, -29, 6, 12, '#4fc86a', 2.5); ell(0, -33, 5, 12, '#3fa85a', 2.5); rr(-11, -15, 22, 17, 3, '#c0562e', 3); },
  llave(sd, pr, t) { ctx.save(); ctx.rotate(sd * .6); rr(-3.2, -36, 6.4, 44, 3, '#c8ccd8', 3); ell(0, -38, 8.5, 8.5, '#c8ccd8', 3); ell(0, -42, 3.4, 3.4, '#8a8ea0', 0); ctx.restore(); },
  caja(sd, pr, t) { rr(-15, -21, 30, 24, 3, '#ffe8f2', 3); rr(-15, -12, 30, 5, 0, '#ff8fb8', 0); line([[-7, -22], [-7, -29], [7, -29], [7, -22]], 3, '#e8c0d0'); },
  bolso(sd, pr, t) { line(arco(0, -8, 10, Math.PI, TAU, 6, 1), 3.5, '#8a5a2a'); rr(-15, -8, 30, 21, 6, '#c9873a', 3); ell(0, 1, 3, 3, '#ffd23f', 1.5); },
  panuelo(sd, pr, t) { ell(0, -10, 9, 7, '#ffffff', 2.5); poly([[5, -14], [13, -20], [11, -9]], '#ffffff', 2); }
};
function manoDe(sp, sd, pr) {
  return function (ex, ey, ang) {          // bust() la llama con la mano ya dibujada, en su marco local
    if (!pr || !labP()) return; const f = PROP[pr.k]; if (!f) return;
    ctx.save(); ctx.translate(ex, ey + 2); f(sd, pr, K.t); ctx.restore();
  };
}

/* ═══════════════════ LOS 8 PERSONAJES ACTIVOS (una región por id: cada dueño toca SOLO la suya) ═══════════════════ */

// <<pj:tu>>
def('tu', { n: 'TÚ', hoja: 'Tú', col: '#3fb0ff', glifo: 'Y', base: 'smile', frase: '¡Ahorita sí!', rasgo: 'Siempre llega «ahorita»',
  v: { esperar: ['¿Y ahora qué?', 'Yo listo, ¿y ustedes?', 'Ahorita me toca…'], hablar: ['¡Vamos, pues!', '¡Epa, escuchen!', 'Tengo un plan…'],
    celebrar: ['¡Eso es todo, mi pana!', '¡Ahorita sí, ahorita sí!', '¡Soy yo, soy yo!'], perder: ['Ni modo, otra vez.', 'Ahorita me recupero.', 'Qué vaina, chamo.'] },
  look: { skin: '#e8b48a', shirt: '#3fb0ff', pat: 'hoodie', hair: 'curly', hairCol: '#2a1a14', cheeks: 1, brow: 'thin', bw: 50, hw: 38, hh: 40, eyeR: 10 },
  legs: ['#3a5a9a', '#f4f4f4', 58], otra: 'cadera', lagr: true,
  ex: function (K) {                     // audífonos EN LA CABEZA: arco grueso sobre el pelo, copas amarillas con aro oscuro a la altura de las orejas + chapita de estrella
    const hw = K.hw, top = HY - K.hh, w = K.big ? 6 : 7, cx = hw + 1, cy = HY + 4, am = '#ffd23f', ar = '#2a2438';
    line(arco(0, HY - 2, hw + 3, Math.PI * 1.04, Math.PI * 1.96, 14, (K.hh + 8) / (hw + 3)), w + 3.2, INKC);          // contorno de la diadema
    line(arco(0, HY - 2, hw + 3, Math.PI * 1.04, Math.PI * 1.96, 14, (K.hh + 8) / (hw + 3)), w, '#f4f4f8');
    for (let sg = -1; sg <= 1; sg += 2) {
      rr(sg * cx - 8, cy - 14, 16, 28, 7, am, 3.2); rr(sg * cx - 4.5, cy - 9, 9, 18, 4, ar, 0);                      // copa: ambas a la MISMA altura (atadas a la cabeza)
    }
    if (K.an === 'perder') for (let sg = -1; sg <= 1; sg += 2) {                                                     // lágrimas propias, finas y simétricas (no tapan el ojo)
      const ty = K.ey + K.ry + 3 + ((K.t * 14 + (sg > 0 ? 5 : 0)) % 14);
      line([[sg * K.ex, K.ey + K.ry + 1], [sg * K.ex, ty]], 2.4, '#bfe8ff'); ell(sg * K.ex, ty + 2, 2.6, 3.4, '#7fd0ff', 0);
    }
    estrella(-19, 30, 10, '#ffd23f', 3); } });
// <</pj:tu>>

// <<pj:mama>>
def('mama', { n: 'MAMÁ', hoja: 'La Mamá', col: '#27b8c4', glifo: 'C', base: 'smile', frase: '¿Y quién va a recoger esto?', rasgo: 'Siempre trae la chancla a mano', pitch: .92,
  v: { esperar: ['Yo espero, pero poquito.', '¿Y esa cara, mijo?', 'Me vas a oír, ¿ah?'], hablar: ['¡Mijo, escúchame!', '¡Te lo dije mil veces!', '¡Ven acá, ahorita!'],
    celebrar: ['¡Ese es mi muchacho!', '¡Esa es mi sangre!', '¡Bendito sea Dios!'], perder: ['¡Ay, Dios mío!', 'Y yo que te avisé…', '¡Qué vergüenza, mijo!'] },
  look: { skin: '#b07a58', shirt: '#2fc4c9', hair: 'bun', hairCol: '#3a2418', earring: 1, brow: 'thin', bw: 54, hw: 38, hh: 41 },
  legs: ['#2a4aa8', '#2a2a38', 58, '#2a2a38'], prop: { k: 'chancla', lado: 'der', idle: 'lado', talk: 'alto' }, otra: 'cadera',
  ex(K) {                                  // la mamá de la hoja: blusa de botones con cuello, aretes de aro dorados y su ceja de «me vas a oír»
    const hw = K.hw, c = K.shirt, cl = claro(c, .35), oro = '#ffd23f';
    poly([[-3, -27], [-20, -26], [-9, -8]], cl, 3); poly([[3, -27], [20, -26], [9, -8]], cl, 3);          // cuello de la blusa
    line([[0, -8], [0, 30]], 2.4, oscuro(c, .7));                                                          // tapa de botones
    for (let i = 0; i < 3; i++) ell(0, 2 + i * 12, 2.4, 2.4, '#fff7d8', 1.5);
    for (let sg = -1; sg <= 1; sg += 2) { line(arco(sg * (hw + 1), HY + 18, 5.5, 0, TAU, 10, 1), 3, oro, true); }   // aretes de aro
    if (K.an !== 'perder') line([[-K.ex - K.rx - 3, K.ey - K.ry - 3], [-K.ex - 1, K.ey - K.ry - 13], [-K.ex + K.rx + 4, K.ey - K.ry - 8]], 5, INKC, true);   // ceja alzada y gruesa (la izquierda): «me vas a oír»
    if (K.sp.o.arms.length === 0) {                                                                         // cara/ficha chica: la chancla asoma por el hombro para que el gag se lea
      ctx.save(); ctx.translate(hw + 7, -22); ctx.rotate(.35);
      ell(0, 0, 10, 21, '#2f7fe0', 3.5); ell(0, -2, 6, 15, '#6fb0ff', 0); line([[-6, -8], [0, 5], [6, -8]], 4, '#ffffff'); ctx.restore(); }
  } });
// <</pj:mama>>

// <<pj:abuela>>
// la taza de la abuela: brazo con codo (manga + puño de la rebeca) hasta una mano que SÍ agarra la taza; la taza va sobre la mano, los dedos por delante
HOLD.abuI = [.62, 44]; HOLD.abuH = [.95, 46];
PROP.tazaAbu = function (sd, pr, t) {
  const sp = K.sp, a = sp.aI, an = K.an, bw = sp.look.bw || 50, sx = sd * bw * .78, hx = sx + a.len * Math.sin(a.a), cel = an === 'celebrar', per = an === 'perder';
  if (!cel) {                                // brazo flexionado por encima del de bust(): hombro -> codo -> mano (la mano es el origen de este marco)
    const dx = sx - hx, dy = -a.len * Math.cos(a.a) - 2, ex = dx * .5 + sd * (per ? 6 : 8), ey = dy * .5 + (per ? 0 : 8), sl = K.shirt;
    limb(dx, dy, ex, ey, 21, sl, 4); limb(ex, ey, 0, 0, 18, sl, 4);
    ell(sd * -.5, -1, 11, 7, '#fff0e0', 3);                                  // puño de la rebeca
  }
  ctx.save(); if (per) { ctx.translate(0, 4); ctx.rotate(sd * .3); }
  line(arco(sd * 11, -14, 5.5, 0, TAU, 10, 1.15), 3.4, '#d9d4e4');              // asa
  rr(-11, -27, 22, 24, 6, '#fffdf2', 3); ell(0, -27, 9.6, 3.2, '#7a4a2a', 0); rr(-11, -16, 22, 5, 2, '#ff8fb8', 0);
  if (!per) vapor(0, -31, t, '#e8e4f0');
  ell(0, -6, 10.5, 8, K.skin, 3);                                            // los dedos rodean la taza
  line([[-6, -9], [-6, -3]], 1.6, oscuro(K.skin, .6)); line([[0, -10], [0, -3]], 1.6, oscuro(K.skin, .6)); line([[6, -9], [6, -3]], 1.6, oscuro(K.skin, .6));
  ctx.restore();
};
def('abuela', { n: 'LA ABUELA', hoja: 'La Abuela', col: '#f27fb0', glifo: 'T', base: 'smile', frase: 'Bendición, mijo.', rasgo: 'Siempre tiene un mango en el bolso', pitch: .85,
  v: { esperar: ['Con calma, mijito.', '¿Quieres un cafecito?', 'Siéntate, mi vida.'], hablar: ['En mis tiempos…', 'Escucha a la vieja.', 'Eso no se hacía así.'],
    celebrar: ['¡Dios te bendiga!', '¡Ese es mi nieto!', '¡Gloria a Dios!'], perder: ['Ay, qué pena, mijo.', 'Dios proveerá, mijo.', 'Así es la vida, mijo.'] },
  look: { skin: '#f0c8a0', shirt: '#f27fb0', hair: 'bun', hairCol: '#b9b5bf', glasses: 'round', earring: 1, cheeks: 1, wrinkles: 1, brow: 'thin', bw: 50, hw: 38, hh: 40 },
  legs: ['#e2b894', '#f5a0c0', 46, '#f5a0c0'], prop: { k: 'tazaAbu', lado: 'izq', idle: 'abuI', talk: 'abuH' }, lagr: true,
  ex(K) {                                  // pelo propio (línea del cabello, mechas, moño con liga), rebeca abierta sobre vestido de flores, lentes finos, lágrimas cortas
    const e = K.ex, y = K.ey, cr = '#fff0e0', fl = ['#e8553d', '#7a5ad0', '#ffd23f'], hw = K.hw, hh = K.hh, ht = HY - hh, hc = K.sp.look.hairCol, big = K.big;
    const ar = oscuro(K.skin, .74); line([[-13, HY - hh * .56], [0, HY - hh * .6], [13, HY - hh * .56]], 2, ar);                // arrugas: solo en la frente (las de las mejillas ensuciaban la boca al llorar)
    for (let sg = -1; sg <= 1; sg += 2) line([[sg * (e + 19), y + 3], [sg * (e + 23), y + 7]], 1.8, ar);
    poly([[-15, 2], [15, 2], [20, 76], [-20, 76]], '#3a2a58', 0); poly([[-14, 3], [14, 3], [18, 74], [-18, 74]], cr, 2.5);   // vestido
    for (let i = 0; i < 6; i++) { const fx = (i % 2 ? 7 : -7) + (i % 3 - 1) * 2, fy = 16 + i * 10; ell(fx, fy, 4, 4, fl[i % 3], 0); ell(fx, fy, 1.5, 1.5, '#fffdf2', 0); }
    const rb = '#e0609a', rbo = '#a83a72', lw = big ? 8 : 9;                                                              // rebeca: solapa ancha con filo oscuro por dentro y dobladillo
    for (let sg = -1; sg <= 1; sg += 2) {
      line([[sg * 15, 3], [sg * 21, 76]], lw, rb); line([[sg * 11.5, 3], [sg * 17, 76]], 2.2, rbo);
      line([[sg * 15.5, 75], [sg * 20.5, 75]], 5, rbo);
    }
    ell(0, 5, 12, 5, cr, 2.5); ell(-4, 7, 2, 2, '#ffd23f', 1.5); ell(4, 7, 2, 2, '#ffd23f', 1.5);                           // cuello de encaje + collar
    // pelo: moño angosto detrás, casquete que sigue la cabeza con el nacimiento curvo y mechones en las sienes, liga como banda en la base del moño
    ell(0, ht - 8, 13, 11, hc, 3.5); line(arco(0, ht - 8, 7, Math.PI * .1, Math.PI * 1.1, 6, .8), 2, claro(hc, .5));
    const cap = arco(0, HY - 2, hw + 2, Math.PI * 1.02, Math.PI * 1.98, 16, (hh + 1) / (hw + 2));
    for (let i = 8; i >= 0; i--) { const u = (i / 8) * 2 - 1, xx = u * (hw - 2), q = Math.abs(xx) / hw; cap.push([xx, ht + 11 + q * q * hh * .58 - (i === 4 ? 2 : 0)]); }
    poly(cap, hc, 4);
    const sc = claro(hc, .5), as = (hh + 1) / (hw + 2);
    line(arco(0, HY - 2, (hw + 2) * .86, Math.PI * 1.12, Math.PI * 1.46, 6, as), 2, sc); line(arco(0, HY - 2, (hw + 2) * .8, Math.PI * 1.56, Math.PI * 1.9, 6, as), 2, sc);
    line([[-6, ht + 9], [-hw * .5, ht + 14], [-hw * .72, ht + 24]], 2, sc);
    ell(0, ht - 1, 14, 4, '#ff6fa8', 2.5);
    if ((estilo() === 'garabato' || estilo() === 'tinta') && K.an !== 'celebrar' && !PS.blink)          // ojos más chicos tras los lentes (en estos estilos la pupila sale enorme)
      for (let sg = -1; sg <= 1; sg += 2) { ell(sg * e, y, K.rx * .86, K.ry * .86, '#fffdf6', 1.8); ell(sg * e + PS.look * 2.2, y + 1, 3.4, 3.9, INKC, 0); ell(sg * e + PS.look * 2.2 - 1, y - .6, 1.2, 1.2, '#fff', 0); }
    for (let sg = -1; sg <= 1; sg += 2) line(arco(sg * e, y, K.rect ? 14 : 16, 0, TAU, 14, 1), K.rect ? 2 : 3, '#e8892a', true);                       // aros naranja (finos en snes para no tapar el ojo)
    line([[-e + 14, y - 1], [e - 14, y - 1]], K.rect ? 2 : 2.6, '#e8892a');
    if (K.an === 'perder') for (let sg = -1; sg <= 1; sg += 2) {                                                            // lágrimas cortas, bajo el aro del lente y fuera de la boca
      const f = fr(K.t * .9 + (sg > 0 ? .5 : 0)), x = sg * (e + 6), y0 = y + 17, y1 = y0 + 3 + f * 9;
      if (!(estilo() === 'garabato' || estilo() === 'tinta')) line([[x, y0], [x + sg * .8, y1]], 2.4, '#bfeaff');                // en tinta/garabato solo la gota (la línea se enreda con el trazo)
      ell(x + sg * .8, y1 + 2, 2.6, 3.4, '#8fdcff', 0);
    }
  } });
CHARS.abuela.o.hair = 'none'; CHARS.abuela.o.glasses = null; CHARS.abuela.o.wrinkles = 0;          // el pelo y los lentes los dibuja ex(K): así no se duplican con los de bust() en ningún estilo
// <</pj:abuela>>

// <<pj:tio>>
// tambor propio del tío: la mano lo AGARRA (dedos encima del aro) y en celebrar lo levanta sobre la palma, no flota
PROP.tamborTio = function (sd, pr, t) {
  const up = K.an === 'celebrar';
  ctx.save(); ctx.translate(-sd * (up ? 3 : 15), up ? -15 : -2);
  rr(-19, -20, 38, 31, 9, '#8a2f1f', 3.5); ell(0, -20, 19, 6.5, '#f2dfb0', 3); line([[-14, -14], [-7, 5], [0, -14], [7, 5], [14, -14]], 2.6, '#f2dfb0');
  ctx.restore();
  ell(0, up ? 1 : 0, 11, 11, K.skin, 3.5); ell(-sd * 4, up ? -7 : -8, 4.6, 4.6, K.skin, 2.5);     // mano + pulgar sobre el tambor
};
const MB = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
const MT = [-26, 4, -12, -2, 0, 3, 12, -2, 26, 4, 23, 11, 16, 12, 6, 7, 0, 8, -6, 7, -16, 12, -23, 11];
def('tio', { n: 'EL TÍO', hoja: 'El Maracucho', col: '#f2b01e', glifo: 'D', frase: 'Yo en mis tiempos…', rasgo: 'Tiene una anécdota pa\' todo', pitch: .88, base: 'smile',
  v: { esperar: ['Déjame pensar un rato.', 'Esto me recuerda algo…', '¿Y el guarapo, dónde?'], hablar: ['¡Escuchen al tío!', 'Eso fue en el 85…', 'Mira, mijo, mira.'],
    celebrar: ['¡Eso se lo dije yo!', '¡Que suene el tambor!', '¡Vamo\' a bailar!'], perder: ['¡Esto está arreglado!', 'Eso fue sabotaje.', 'Eso antes no pasaba.'] },
  look: { skin: '#c98a5a', shirt: '#f2d23a', sh2: '#2fbf8f', hair: 'slick', hairCol: '#15110e', cheeks: 1, brow: 'thin', bw: 58, hw: 42, hh: 42 },
  legs: ['#2a2a34', '#5a3a22', 54], 
  prop: { k: 'tamborTio', lado: 'der', idle: 'pecho', talk: 'pecho' }, otra: 'cadera', 
  ex: function (K) {                      // estampado de flores DENTRO de la camisa, lentes de sol con aro claro, bigote (más chico en snes / al llorar)
    const fl = '#2fbf8f', an = K.an, top = HY - K.hh;
    for (let i = 0; i < 9; i++) {         // rejilla escalonada: 3 filas, cada flor (radio 5.5) queda dentro del torso y lejos del tambor
      const r = (i / 3) | 0, c = i % 3, fx = (r === 1 ? -20 : -32) + c * 20, fy = 26 + r * 24;
      ell(fx, fy, 5.5, 5.5, fl, 0); ell(fx, fy, 2.2, 2.2, '#ffd23f', 0);
    }
    for (let sg = -1; sg <= 1; sg += 2) {
      const cx = sg * 16;
      rr(cx - 14, top + 1, 28, 17, 8, '#f4f4f8', 3); rr(cx - 11.5, top + 3.5, 23, 12, 6, '#2b8aa6', 0); ell(cx - sg * 4, top + 7.5, 4, 2, '#bfeaf6', 0);
    }
    line([[-3, top + 9], [3, top + 9]], 3.5, '#f4f4f8');
    const wx = an === 'perder' ? .42 : K.rect ? .8 : 1, hy = K.rect ? .7 : 1, y = HY + K.hh * (K.rect ? .2 : .22);
    for (let i = 0; i < 12; i++) { MB[i][0] = MT[i * 2] * wx; MB[i][1] = y + MT[i * 2 + 1] * hy; }
    poly(MB, '#15110e', 3);
  } });
// <</pj:tio>>

// <<pj:pana>>
def('pana', { n: 'EL PANA', hoja: 'El Carajito', col: '#ff7a2b', glifo: 'J', frase: '¡Mi paaana!', rasgo: 'Nunca le dice que no a una rumba', pitch: 1.18, base: 'smile',
  v: { esperar: ['Tranqui, tranqui.', 'Una partidita más…', 'Ya casi paso el nivel.'], hablar: ['¡Epa, qué más!', '¡Mira esto, mira!', '¡Qué locura, pana!'],
    celebrar: ['¡Qué nivel, mi pana!', '¡Eso fue épico!', '¡Dame cinco, pana!'], perder: ['Aguanta, pana, aguanta.', 'Fue el lag, te juro.', 'Otra ronda, ¿sí?'] },
  look: { skin: '#d8a070', shirt: '#8fd13f', hair: 'curly', hairCol: '#3a2418', cap: '#ff8a3d', capBack: 1, cheeks: 1, brow: 'thin', bw: 48, hw: 38, hh: 40, eyeR: 10 },
  legs: ['#2a2a34', '#e8553d', 36], prop: { k: 'consola', lado: 'der', centro: true, pose: 'centroAlto', fest: 'festLado' }, lagr: 1,
  ex: function (K) {                      // cuello en V + franja del buzo, mechones bajo la gorra (sienes), pecas, y gotita de llanto propia
    const hw = K.hw, hc = K.sp.look.hairCol, o = K.big ? 3 : 2.2, ht = HY - K.hh, sn = K.rect, an = K.an;
    poly([[-15, -25], [15, -25], [0, -6]], '#fffdf2', o); line([[-14, -25], [0, -9], [14, -25]], 2.4, '#2a3f12');                      // cuello en V blanco
    rr(-40, -2, 80, 6, 2, '#ff7a2b', 0);                                                                                             // franja naranja (la de la gorra) en el pecho
    for (let sg = -1; sg <= 1; sg += 2) {                                                                                           // rizos chiquitos y bajos, a la altura de las sienes
      ell(sg * (hw - 2), ht + 36, 4.6, 5.6, hc, o); ell(sg * (hw - 5), ht + 42, 3.6, 4, hc, o);
    }
    if (K.big || sn) {
      const pc = oscuro(K.skin, .55);
      for (let i = 0; i < 3; i++) for (let sg = -1; sg <= 1; sg += 2) {
        const px = sg * (K.ex - 2 + i * 5 * sg) + (sg < 0 ? -4 : 4), py = K.my - 7 - (i % 2) * 3;
        if (sn) rr(Math.round(px / 2) * 2 - 1, Math.round(py / 2) * 2 - 1, 3, 3, 0, pc, 0); else ell(px, py, 1.5, 1.5, pc, 0);
      }
    }
    if (an === 'perder') {                                                                                                          // lágrima: gotita que nace bajo el ojo y cae poquito, con vaivén
      for (let sg = -1; sg <= 1; sg += 2) {
        const f = fr(K.t * .8 + (sg > 0 ? .5 : 0)), x = sg * (K.ex + 3) + Math.sin(K.t * 3 + sg) * .8, y = K.ey + K.ry + 2 + f * 10;
        poly([[x, y - 5], [x + 3.2, y + 1], [x, y + 4.5], [x - 3.2, y + 1]], '#8fdcff', 1.5);
      }
    }
  } });
// <</pj:pana>>

// <<pj:prima>>
def('prima', { n: 'LA PRIMA', hoja: 'La Chismosa', col: '#9b5de5', glifo: 'F', frase: '¡Ay, qué fastidio!', rasgo: 'Se sabe todos los chismes', pitch: 1.12,
  v: { esperar: ['Apúrense, que me aburro.', '¿Supieron lo de…?', 'Yo no digo nada, pero…'], hablar: ['¡Oigan, oigan!', '¡Me contaron algo!', '¡No se lo digan a nadie!'],
    celebrar: ['¡Yo sabía, yo sabía!', '¡Eso estaba cantado!', '¡Todo el mundo lo sabía!'], perder: ['¡Qué injusticia, gente!', '¡Eso no es justo!', '¡Qué escándalo, gente!'] },
  look: { skin: '#c98a68', shirt: '#8a4fd0', pat: 'floral', sh2: '#f0d0ff', hair: 'rolos', hairCol: '#4a2a1a', cheeks: 1, brow: 'thin', bw: 58, hw: 40, hh: 41 },
  legs: ['#c98a68', '#ff8fc0', 48, '#ff8fc0'], sobre: [['panuelo', '#ff6fa8']], prop: { k: 'telefono', lado: 'der', idle: 'pecho', talk: 'lado', col: '#ff6fa8' }, otra: 'boca',
  ex(K) {                                // aretes de aro dorados + chisme: ondas «ssh» al hablar, brillito de «yo sabía» al celebrar
    const ar = K.big ? 6 : 8;            // en tamaño chico el aro crece para que se lea
    for (let sg = -1; sg <= 1; sg += 2) line(arco(sg * (K.hw + 1), HY + 14, ar, 0, TAU, 10, 1.25), K.big ? 3.2 : 4.2, '#ffb800', true);
    if (K.an === 'hablar') for (let i = 0; i < 3; i++) {           // tres rayitas en abanico, fuera de la cabeza, con borde claro para fondos oscuros y claros
      const a = K.t * 7 + i * 2.1, w = Math.sin(a) * 2, x0 = K.hw + 12 + i * 3, y0 = HY + 4 - i * 14 + w, p = [[x0, y0], [x0 + 24, y0 - 8 - i * 5 - w]];
      line(p, K.hw * .24 + 3, '#f6e8ff'); line(p, K.hw * .12 + 1.5, '#5a2a8a');
    }
    else if (K.an === 'celebrar' && K.big) estrella(-K.hw - 22, HY - K.hh * .35 + Math.sin(K.t * 8) * 4, 15, '#ffd23f', 3); } });
// <</pj:prima>>

// <<pj:cobrador>>
def('cobrador', { n: 'EL COBRADOR', hoja: 'El Mototaxista', col: '#e8553d', glifo: '$', base: 'smile', frase: '¡Pasaje, pasaje!', rasgo: 'Cuenta las monedas sin mirar', pitch: 1.05,
  v: { esperar: ['¡Hay puesto atrás!', 'Casi lleno, casi.', 'Con vuelto o sin vuelto.'], hablar: ['¡Corre, corre, corre!', '¡Pasaje, pasaje!', '¡Suban, suban, suban!'],
    celebrar: ['¡Todos pagaron hoy!', '¡Llegamos primero!', '¡Cayó el pasaje!'], perder: ['¡Se me fue el autobús!', 'Se pinchó la moto.', '¡Sin vuelto, qué dolor!'] },
  look: { skin: '#c0845a', shirt: '#d94a3a', pat: 'jersey', sh2: '#ffffff', hair: 'slick', hairCol: '#1a1410', brow: 'thin', bw: 56, hw: 38, hh: 40 },
  legs: ['#2a3f8a', '#6a4020', 56], sobre: [['casco', '#3a7fd0']], prop: { k: 'monedas', lado: 'der', idle: 'pecho', talk: 'lado' }, otra: 'cadera',
  ex(K) {                                // chaqueta roja abierta sobre franela negra, cierre, correas de mochila, rayas blancas, barbuquejo y reflector
    const rj = '#d94a3a', neg = '#3a3646', bl = '#ffffff', est = estilo(), garab = est === 'garabato' || est === 'tinta';
    poly([[-9, -25], [9, -25], [8, 34], [-8, 34]], neg, 2.5);                                      // franela oscura: solo el tercio de arriba del torso
    poly([[-8, 34], [8, 34], [9, 74], [-9, 74]], rj, 2.5);                                         // la chaqueta cierra abajo
    poly([[-3, -25], [-18, -24], [-13, 2], [-5, 4]], oscuro(rj, .8), 2.5); poly([[3, -25], [18, -24], [13, 2], [5, 4]], oscuro(rj, .8), 2.5);   // solapas que enmarcan la franela
    line([[-30, 10], [-31, 60]], 3, bl); line([[30, 10], [31, 60]], 3, bl);                           // rayas blancas de la chaqueta
    if (K.big) {                                                                                      // cierre: dientes solo en estilos limpios, rayitas en los garabateados
      if (garab) { for (let i = 0; i < 2; i++) line([[-3, 42 + i * 14], [3, 42 + i * 14]], 2, '#c8ccd8'); }
      else for (let i = 0; i < 4; i++) rr(-1.2, 38 + i * 9, 2.4, 5, 1, '#c8ccd8', 0);
    }
    if (K.big) for (let sg = -1; sg <= 1; sg += 2) { line([[sg * 22, -22], [sg * 20, 18]], 4, '#4a4a58'); rr(sg * 20 - 3, 16, 6, 6, 1.5, '#c8ccd8', 2); }   // correas hasta el pecho con hebilla
    rr(-34, 40, 14, 9, 3, '#ffd23f', 2.5);                                                            // reflector amarillo
    if (K.an === 'celebrar' && K.big) estrella(-K.hw - 6, HY - K.hh + 20 + Math.sin(K.t * 8) * 3, 7, '#ff8a2a', 2);   // estrella naranja del lado contrario a la mano con monedas
    if (K.an === 'hablar' && K.big) { const w = Math.sin(K.t * 9); rr(-K.hw - 16, HY - 4 + w * 3, 8, 8, 3, '#c0845a', 2.5); }   // manito que gesticula al hablar
  } });
// <</pj:cobrador>>

// <<pj:portu>>
// la baguette se agarra con el puño ENCIMA (tercio inferior); al perder cuelga hacia abajo de la mano
PROP.panPortu = function (sd, pr, t) {
  ctx.save(); ctx.rotate(K.an === 'perder' ? Math.PI - sd * .18 : -sd * .32 + (K.an === 'hablar' ? Math.sin(t * 6) * .08 : 0));
  rr(-8, -46, 16, 58, 8, '#e6a85a', 3.5); for (let i = 0; i < 3; i++) line([[-4, -38 + i * 12], [4, -33 + i * 12]], 2.6, '#fff3c8');
  ell(0, -3, 9.5, 8.5, K.skin, 3); for (let i = -1; i <= 1; i++) line([[i * 4.2, -9], [i * 4.2, -5]], 1.8, oscuro(K.skin, .6));
  ell(-sd * 8, -9, 3.6, 5, K.skin, 2); ctx.restore();                                                          // el puño y el pulgar sobre el pan
};
def('portu', { n: 'EL PORTU', hoja: 'El Portu', col: '#2f9e63', glifo: 'P', frase: '¡Olha o pão!', rasgo: 'Su pan sale calentito siempre', pitch: .95, base: 'grin',
  v: { esperar: ['Calma, calma…', 'El horno ya está listo.', 'Huele a pan caliente.'], hablar: ['¡Bom dia, vizinho!', '¡Pão fresquinho!', '¡Venha, venha!'],
    celebrar: ['¡Que beleza, gente!', '¡Pão pra todos!', '¡Hoje é dia de festa!'], perder: ['¡Ai, que pena!', 'Se quemó el pan…', '¡Ai, meu Deus!'] },
  look: { skin: '#e0a878', shirt: '#e8d8a8', pat: '', hair: 'slick', hairCol: '#1a1410', cheeks: 1, brow: 'thin', bw: 58, hw: 42, hh: 42 },
  legs: ['#3a3a44', '#5a3a22', 54], sobre: [['bigote', '#1a1410']], prop: { k: 'panPortu', lado: 'izq', centro: true, pose: 'pecho' }, otra: 'cadera',
  ex(K) {                                  // el delantal verde de panadero (peto + falda + bolsillo + tirantes), cuello de la camisa y harina en la mejilla
    const v = '#1f7a4a', o = K.big ? 3 : 2.2;
    poly([[-13, -18], [13, -18], [24, 4], [27, 98], [-27, 98], [-24, 4]], v, o);                                  // peto y falda
    line([[-12, -18], [-26, -30]], 4.5, oscuro(v, .8)); line([[12, -18], [26, -30]], 4.5, oscuro(v, .8));          // tirantes hacia los hombros
    rr(-14, 40, 28, 22, 4, claro(v, .12), 2.5); line([[-14, 46], [14, 46]], 2.2, oscuro(v, .75));                    // bolsillo
    ell(-17, 20, 3, 3, '#fff7d8', 0); ell(17, 20, 3, 3, '#fff7d8', 0);                                              // botoncitos de la camisa
    if (K.big) { ell(-K.hw + 8, HY + 13, 7, 4.5, 'rgba(255,255,255,.88)', 0); ell(-K.hw + 18, HY + 20, 3.2, 2.2, 'rgba(255,255,255,.8)', 0);       // harina: una mancha suave en la mejilla, lejos del ojo
      line([[-K.hw + 6, HY + 19], [-K.hw + 13, HY + 23]], 3, 'rgba(255,255,255,.8)'); }
    if (K.an === 'celebrar' && estilo() === 'snes') { rr(-11, HY + 26, 22, 11, 4, '#7a1a2a', 2.5); rr(-9, HY + 27, 18, 3.5, 0, '#ffffff', 0); }   // sonrisa abierta bajo el bigote
  } });
// <</pj:portu>>

/* ───────────── HOJA: los otros 16 (INACTIVOS hasta que el reductor los sume a PERSONAJES; ya tienen diseño) ───────────── */
function h16(id, n, col, glifo, frase, rasgo, vs, look, o) {
  o = o || {}; o.n = n; o.hoja = n; o.col = col; o.glifo = glifo; o.frase = frase; o.rasgo = rasgo;
  o.v = { esperar: [vs[0]], hablar: [vs[1]], celebrar: [vs[2]], perder: [vs[3]] }; o.look = look; return def(id, o);
}
h16('chino', 'EL CHINO', '#1fb5a8', 'G', 'Dame un segundito.', 'Nunca suelta el control', ['Un nivel más y voy.', 'Mira, es fácil.', '¡GG, pues!', 'Fue lag, lo juro.'],
  { skin: '#e8c090', shirt: '#2bb5c0', hair: 'slick', hairCol: '#14110f', glasses: 'round', brow: 'thin', bw: 50, hw: 38, hh: 40 }, { prop: { k: 'control', lado: 'der' }, legs: ['#2a3a5a', '#f4f4f4', 56] });
h16('llave', 'EL LLAVE', '#c9a35a', 'L', '¿Qué más, llave?', 'Siempre llega en crocs', ['Tranquilo, llave.', 'Oye, llave, oye.', '¡Cómo es la vaina!', 'Ni modo, llave.'],
  { skin: '#d49a68', shirt: '#f4f4f4', pat: 'tank', hair: 'slick', hairCol: '#3a2a1a', glasses: 'shades', hat: '#e8d4a8', bw: 52, hw: 38, hh: 40 }, { otra: 'puno', legs: ['#2a3a5a', '#f4f4f4', 56] });
h16('caribeno', 'EL CARIBEÑO SIFRINO', '#d98c3a', 'K', 'Qué vibra tan rica.', 'Le pone música a todo', ['Sin prisa, mi rey.', 'Escucha esta nota.', '¡A cantar, pues!', 'Se desafinó la vida.'],
  { skin: '#d9a070', shirt: '#efe2bd', pat: 'floral', sh2: '#3aa66a', hair: 'long', hairCol: '#5a3418', glasses: 'shades', chain: 1, stubble: 1, bw: 54, hw: 40, hh: 41 }, { prop: { k: 'guitarra', lado: 'der' }, legs: ['#efe2bd', '#a8783a', 50] });
h16('sifrina', 'LA SIFRINA', '#f08ab8', 'S', 'Qué oso, ¿no?', 'Con su café frío a todas partes', ['Qué lento, por favor.', 'Ay, escúchame.', '¡Obvio que gané!', 'Qué oso, de verdad.'],
  { skin: '#e6b48c', shirt: '#f6a0c4', hair: 'long', hairCol: '#8a5a32', earring: 1, cheeks: 1, brow: 'thin', bw: 50, hw: 38, hh: 40 }, { sobre: [['lentesFrente', '#2a2a3a']], prop: { k: 'vaso', lado: 'izq' }, prop2: { k: 'bolso', lado: 'der' }, legs: ['#fffdf2', '#f4f4f4', 40] });
h16('llanero', 'EL LLANERO', '#c0562e', 'N', 'Pa\' lante, compadre.', 'Canta antes de cada tirada', ['Despacito se llega.', 'Escuche, compadre.', '¡Viva el joropo!', 'Así es el llano.'],
  { skin: '#a8683e', shirt: '#f0e6c8', hair: 'slick', hairCol: '#1a1410', hat: '#e0c070', brow: 'thin', bw: 52, hw: 38, hh: 40 }, { sobre: [['panoCuello', '#d63a2a']], prop: { k: 'cuatro', lado: 'der' }, legs: ['#4a3a2a', '#6a4020', 56] });
h16('alternativa', 'LA ALTERNATIVA', '#7ab86a', 'A', 'Eso ya es mainstream.', 'Habla con sus plantas', ['Fluye, solo fluye.', 'Es una vibra, ¿ves?', '¡Qué buena energía!', 'Mercurio retrógrado.'],
  { skin: '#e0b090', shirt: '#6aa860', hair: 'curly', hairCol: '#2a1a2e', glasses: 'round', earring: 1, brow: 'thin', bw: 50, hw: 38, hh: 40 }, { sobre: [['mecha', '#a070e0']], prop: { k: 'planta', lado: 'der' }, legs: ['#b9a0e0', '#f4f4f4', 56] });
h16('resuelve', 'EL RESUELVE', '#f08a2a', 'R', 'Eso lo resuelvo yo.', 'Siempre con una llave a mano', ['Déjame ver qué es.', 'Mira, es sencillo.', '¡Quedó como nuevo!', 'Eso no es mío.'],
  { skin: '#8a5a3a', shirt: '#f08a2a', hair: 'curly', hairCol: '#14110f', cheeks: 1, brow: 'thin', bw: 56, hw: 38, hh: 40 }, { sobre: [['lapiz', '#f2c230']], prop: { k: 'llave', lado: 'der' }, otra: 'cadera', legs: ['#2a3f8a', '#6a4020', 56] });
h16('novelera', 'LA NOVELERA', '#a8325a', 'V', '¡Qué dramón, mija!', 'Llora con cada capítulo', ['Ya va a empezar…', '¡No me lo creo!', '¡Final feliz!', '¡Ay, me muero!'],
  { skin: '#d9a888', shirt: '#9a2a52', hair: 'long', hairCol: '#8a4a28', earring: 1, cheeks: 1, brow: 'thin', bw: 52, hw: 40, hh: 41 }, { prop: { k: 'panuelo', lado: 'izq' }, otra: 'boca', legs: ['#d9a888', '#7a1a3a', 46] });
h16('mototaxista', 'EL MOTOTAXISTA', '#d4503a', 'H', '¡Monta, que nos vamos!', 'Conoce todos los atajos', ['Casi lleno, casi.', '¡Agárrate, pues!', '¡Llegamos primero!', 'Se pinchó la moto.'],
  { skin: '#c89068', shirt: '#d84a3a', pat: 'jersey', sh2: '#ffffff', hair: 'slick', hairCol: '#1a1410', brow: 'thin', bw: 56, hw: 38, hh: 40 }, { sobre: [['casco', '#4a8ae0']], legs: ['#2a3f8a', '#6a4020', 56] });
h16('tiaaudio', 'LA TÍA DEL AUDIO', '#e8c020', 'U', '¡Le mando un audio!', 'Sus audios duran diez minutos', ['Te grabo uno corto.', 'Escucha el audio.', '¡Mando mil audios!', 'Se me cortó el audio.'],
  { skin: '#8a5a3e', shirt: '#f0c818', hair: 'bald', hairCol: '#14110f', earring: 1, cheeks: 1, brow: 'thin', bw: 54, hw: 40, hh: 41 }, { sobre: [['turbante', '#f2c418'], ['lentesGato', '#ff6fa8']], prop: { k: 'telefono', lado: 'der', col: '#2a2a38' }, legs: ['#7a4aa8', '#c9a35a', 46] });
h16('emprendedora', 'LA EMPRENDEDORA', '#f0705a', 'E', '¡Pídala, que es fresca!', 'Vende tortas hasta en el chat', ['Ya casi hornea.', '¡Pida su pedido!', '¡Agotamos todo!', 'Se quemó la torta.'],
  { skin: '#9a6a48', shirt: '#f0705a', pat: 'apron', sh2: '#f89a88', hair: 'bun', hairCol: '#3a2418', earring: 1, brow: 'thin', bw: 54, hw: 38, hh: 40 }, { prop: { k: 'caja', lado: 'izq' }, otra: 'cadera', legs: ['#3a3a44', '#f4f4f4', 54] });
h16('popstar', 'LA POPSTAR', '#e04aa8', 'Q', '¡Un selfie, ya!', 'Ensaya hasta en la cola', ['Un minuto, maquillaje.', '¡Check, check, uno!', '¡Gracias, Caracas!', 'Se fue el sonido.'],
  { skin: '#e8b890', shirt: '#4ab8e8', hair: 'long', hairCol: '#14101c', cheeks: 1, brow: 'thin', bw: 48, hw: 38, hh: 40 }, { sobre: [['clips', '#ffd23f']], prop: { k: 'micro', lado: 'der' }, otra: 'puno', legs: ['#7fb8e8', '#ff8fc0', 56] });
h16('rival', 'LA RIVAL', '#b07ae0', 'X', 'Ni te esfuerces.', 'Sigue todas tus historias', ['Qué aburrimiento.', 'Ajá, ¿y?', '¡Te lo dije!', 'Eso fue suerte.'],
  { skin: '#e0ac88', shirt: '#b090e8', hair: 'long', hairCol: '#6a3a22', earring: 1, brow: 'thin', bw: 50, hw: 38, hh: 40 }, { sobre: [['cinta', '#ff6fa8'], ['cola', '#6a3a22']], prop: { k: 'telefono', lado: 'der' }, otra: 'cruzado', legs: ['#ff9ac8', '#f4f4f4', 40] });
h16('galan', 'EL GALÁN DE BANDA', '#2a6ad0', 'B', 'Esta va pa\' ti.', 'Toca en cada esquina', ['Afinando, afinando.', 'Escucha esta nota.', '¡Otra, otra, otra!', 'Se rompió una cuerda.'],
  { skin: '#d8a078', shirt: '#2a5ad0', pat: 'stripes', sh2: '#fafafa', hair: 'slick', hairCol: '#14110f', brow: 'thin', bw: 52, hw: 38, hh: 40 }, { base: 'smile', prop: { k: 'guitarra', lado: 'der' }, legs: ['#3a5a9a', '#e8553d', 56] });
h16('dona', 'LA DOÑA', '#2a8a52', 'W', 'Con permiso, caballeros.', 'Nunca falta a un cumpleaños', ['Qué falta de modales.', 'Hágame el favor.', '¡Estaba escrito!', 'Qué barbaridad.'],
  { skin: '#b07a58', shirt: '#2a8a52', hair: 'curly', hairCol: '#2a1a14', chain: 1, earring: 1, brow: 'thin', bw: 54, hw: 40, hh: 41 }, { prop: { k: 'taza', lado: 'der' }, legs: ['#2a8a52', '#2a2a38', 46] });
h16('habibi', 'EL HABIBI', '#8a2a4a', 'I', 'Habibi, tranquilo.', 'Todo se arregla con un café', ['Tómate un café.', 'Escucha, habibi.', '¡Yalla, yalla!', 'Ya Allah, qué día.'],
  { skin: '#c89068', shirt: '#7a2a40', hair: 'slick', hairCol: '#1a1410', stubble: 1, brow: 'thin', bw: 52, hw: 38, hh: 40 }, { prop: { k: 'taza', lado: 'der' }, legs: ['#efe2bd', '#6a4020', 56] });
h16('toyobobo', 'EL TOYOBOBO', '#3a64c8', 'Z', '¡Mi 4x4 no se vara!', 'Presume su camioneta', ['Calentando el motor.', 'Mira qué máquina.', '¡Subió la loma!', 'Se varó la 4x4.'],
  { skin: '#cc9468', shirt: '#2a52c8', hair: 'slick', hairCol: '#14110f', glasses: 'shades', bw: 58, hw: 38, hh: 40 }, { prop: { k: 'llave', lado: 'der' }, legs: ['#3a5a9a', '#2a2a38', 56] });
h16('cafetal', 'LA SEÑORA DEL CAFETAL', '#d09a60', 'O', 'Qué tiempos, mija.', 'Tiene finca y chisme', ['Sírvase otro cafecito.', 'Mija, le cuento.', '¡Cosecha buena!', 'Se helaron los cafetos.'],
  { skin: '#e8c0a0', shirt: '#f0b08a', hair: 'curly', hairCol: '#e8d090', chain: 1, earring: 1, cheeks: 1, brow: 'thin', bw: 54, hw: 40, hh: 41 }, { prop: { k: 'bolso', lado: 'izq' }, prop2: { k: 'telefono', lado: 'der' }, legs: ['#5a3a22', '#a8783a', 46] });
/* ───────────── roster: PJ/PJ_IDS son la vista de los ACTIVOS y se rellenan EN SITIO (los demás archivos guardan la referencia) ───────────── */
const CHAR_IDS_ALL = Object.keys(CHARS), PJ = {}, PJ_IDS = [];
const LOOK0 = { skin: '#e8b48a', shirt: '#9a96a8', hair: 'curly', hairCol: '#2a1a14' };
function vistaPj(id) { const d = CHARS[id]; return Object.assign({}, d, { look: () => d.look }); }
function cargarRoster(personajes) {      // personajes = R.PERSONAJES [{id, n}]; sin lista: los 8 de siempre. Devuelve los ids activos en orden estable
  const ids = Array.isArray(personajes) && personajes.length ? personajes.map((p) => p && p.id).filter((id) => CHARS[id]) : ORDEN_PJ.slice();
  CHAR_IDS_ALL.forEach((id) => { CHARS[id].activo = ids.indexOf(id) >= 0; });
  (personajes || []).forEach((p) => { if (p && CHARS[p.id] && typeof p.n === 'string' && p.n) CHARS[p.id].n = p.n; });
  const orden = ORDEN_PJ.filter((id) => CHARS[id].activo).concat(ids.filter((id) => ORDEN_PJ.indexOf(id) < 0));
  Object.keys(PJ).forEach((k) => { delete PJ[k]; }); PJ_IDS.length = 0;
  orden.forEach((id) => { PJ[id] = vistaPj(id); PJ_IDS.push(id); });
  return orden.slice();
}
cargarRoster();
// identidad pura: lo ÚNICO que lobby y tablero usan para nombre/color/frase
function ident(ch) {
  const d = ch && PJ[ch];
  if (!d) return { id: '', n: '¿?', col: GRIS, col2: oscuro(GRIS, .62), frase: '', rasgo: '', look: () => LOOK0 };
  return { id: ch, n: d.n, col: d.col, col2: d.col2, frase: d.frase, rasgo: d.rasgo, look: d.look };
}
const lista = (todos) => (todos ? CHAR_IDS_ALL.slice() : PJ_IDS.slice());
const color = (id) => (CHARS[id] ? CHARS[id].col : GRIS);
const ficha = (id) => CHARS[id] || null;
// frase corta por ánimo/contexto ('esperar'|'hablar'|'celebrar'|'perder'|'saludo'|'rasgo'); idx elige entre las variantes (módulo su cantidad)
function frase(id, ctxo, idx) {
  const d = CHARS[id]; if (!d) return '';
  if (ctxo === 'saludo' || !ctxo) return d.frase; if (ctxo === 'rasgo') return d.rasgo || '';
  const l = d.v[ctxo]; if (!l || !l.length) return d.frase;
  const i = Math.floor(num(idx)); return l[((i % l.length) + l.length) % l.length];
}
const lookDe = (id) => (CHARS[id] ? CHARS[id].look : LOOK0);

/* ───────────── dibujo ───────────── */
// marco local del busto, idéntico al de bust() de engine.js (snes redondea a la cuadrícula y se mece 2 cuadros; felt se aplasta) para que los adornos peguen
function entra(x, y, s, flip, rot, sy) {
  const st = estilo(); ctx.save();
  if (st === 'snes') {
    const sn = (v) => Math.round(v / 4) * 4, lean = Math.abs(rot) > .08 ? sn(Math.sign(rot) * 14) : 0, bob = Math.floor(tnow() * 6 + x * .02) % 2 ? 0 : -4;
    ctx.translate(sn(x), sn(y)); ctx.scale(flip * s, s * sy); ctx.translate(lean, bob);
  } else {
    ctx.translate(x, y); if (rot) ctx.rotate(rot);
    if (st === 'felt') { const sq = Math.sin(tnow() * 4 + x * .05) * .02; ctx.scale(flip * s * (1 - sq), s * sy * (1 + sq)); } else ctx.scale(flip * s, s * sy);
  }
}
function parpadeo(sp) {
  if (sp.look.glasses === 'shades') return;
  for (let sg = -1; sg <= 1; sg += 2) {
    if (K.rect) rr(sg * K.ex - 8, K.ey - 9, 16, 18, 0, K.skin, 0); else ell(sg * K.ex, K.ey, K.rx, K.ry, K.skin, 0);
    line([[sg * K.ex - K.rx * .75, K.ey + K.ry * .1], [sg * K.ex, K.ey + K.ry * .32], [sg * K.ex + K.rx * .75, K.ey + K.ry * .1]], 3.4, INKC);
  }
}
function lagrimas(t, ph, big) {
  for (let sg = -1; sg <= 1; sg += 2) {
    const f = fr(t * .9 + ph * .3 + (sg > 0 ? .5 : 0)), y0 = K.ey + K.ry * .8, x = sg * (K.ex + 1);
    if (big) line([[x, y0], [x + sg * 1.5, y0 + 6 + f * 26]], 3.4, '#bfeaff');
    ell(x + sg * 1.5, y0 + 8 + f * 26, 3.4, 4.8, '#8fdcff', 1.5);
  }
}
function brazoBoca(sp, P, t) {             // la mano sube a la boca (¡ay!): brazo con codo, encima de la cara
  const sd = sp.frente, bw = sp.look.bw || 54, sx = sd * bw * .78, hx = sd * 11 + Math.sin(t * 11) * .5, hy = K.my + 5, ex = sd * (bw + 4), ey = 34;
  if (typeof limb !== 'function') return;
  const sl = K.shirt;
  limb(sx, 4, ex, ey, 19, sl, 4); limb(ex, ey, hx, hy + 8, 15, K.skin, 3.5);
  if (typeof hand === 'function') hand(hx, hy + 5, -sd * .35, .85, K.skin); else ell(hx, hy, 12, 12, K.skin, 3);
}
const OFF = { x: 0, y: 0 };
function draw(c, id, x, y, s, mood, t, op) {
  if (!labB()) return false;
  op = op || NOOP; x = num(x); y = num(y); s = num(s); if (!(s > 0)) s = .1; t = num(t);
  const sp = CHARS[id] || GEN; let an = 'esperar', raw = typeof op.mood === 'string' && op.mood ? op.mood : null;
  if (ANIM_SET[mood]) an = mood; else if (typeof mood === 'string' && mood && !raw) raw = mood;
  if (ANIM_SET[op.animo]) an = op.animo;
  const modo = op.modo || 'busto', cuerpo = modo === 'cuerpo', st = estilo(), P = PS, o = sp.o, lk = sp.look, tt = t + sp.ph;
  posa(P, sp, an, t, raw);
  if (op.talk) P.talk = num(op.talk);
  const big = s * 110 >= 56, legLen = sp.legs[2] || 58;
  const hy = op.ancla === 'pies' ? y - (64 + 110 + legLen) * s : y;               // centro de la cabeza
  medidas(st, lk);
  K.an = an; K.t = t; K.s = s; K.sp = sp; K.big = big; K.skin = op.gris ? sp.lg.skin : lk.skin || '#e8b48a'; K.shirt = op.gris ? sp.lg.shirt : op.tinte || lk.shirt || '#e8553d';
  // opciones de bust (objeto por personaje, se pisan todos los campos variables)
  const by = hy + (64 + P.dy) * s, rot = P.rot + num(op.rot), sy = P.sy * (op.sy > 0 ? num(op.sy) : 1);
  const fm = st === 'felt' && (P.mood === 'happy' || P.mood === 'sleep');   // felt dibuja X en los ojos de happy/sleep (parece muerto): ojos de botón normales, y dormido = párpados cerrados
  o.x = x; o.y = by; o.s = s; o.flip = !!op.flip; o.mood = fm ? (P.mood === 'happy' ? 'smile' : 'calm') : P.mood; o.talk = P.talk; o.look = P.look; o.rot = rot; o.sy = sy;
  const cp = cuerpo && sp.cp;                                                      // cp = camisa/patrón alterno de cuerpo entero (el delantal no cabe en un torso corto)
  o.skin = K.skin; o.shirt = cp ? cp.shirt : K.shirt; o.pat = cp ? cp.pat : lk.pat; o.sh2 = lk.sh2; o.hairCol = op.gris ? sp.lg.hairCol : lk.hairCol;
  o.legs = cuerpo ? sp.legs : null; o.th = cuerpo ? 112 : 0;
  const frente = sp.frente && an === 'esperar' && modo !== 'cara' ? sp.frente : 0;
  if (modo === 'cara') o.arms = NOARMS;
  else {
    brazoPose(sp.aI, -1, sp.pI, sp.otra, an, tt); brazoPose(sp.aD, 1, sp.pD, sp.otra, an, tt); sp.aI.col = sp.aD.col = K.shirt;
    o.arms = frente < 0 ? sp.armsD : frente > 0 ? sp.armsI : sp.arms2;
  }
  // recorte + semilla estable (tinta/garabato no parpadean al repintar)
  const cl = op.clip, cc = op.clipC; let sid0, haySid = typeof sid !== 'undefined';
  if (cl || cc) { ctx.save(); ctx.beginPath(); if (cl) ctx.rect(cl.x, cl.y, cl.w, cl.h); else if (ctx.arc) ctx.arc(cc.x, cc.y, cc.r, 0, TAU); ctx.clip(); }
  if (op.sombra) { const sw = cuerpo ? 52 : 40, gy = cuerpo ? hy + (64 + 110 + legLen + 8) * s : hy + 72 * s, k = 1 - Math.min(.4, -Math.min(0, P.dy) / 40); ell(x, gy, sw * s * k, 8 * s * k, 'rgba(20,16,28,.32)', 0); }
  if (haySid) { sid0 = sid; sid = op.semilla === undefined ? sp.sem : op.semilla; }
  try {
    bust(o);
    entra(x, by, s, o.flip ? -1 : 1, rot, sy);
    if (frente) brazoBoca(sp, P, tt);
    if ((P.blink && !raw && P.mood !== 'happy' && P.mood !== 'sleep') || (fm && P.mood === 'sleep')) parpadeo(sp);
    if (P.lloro && !sp.lagr) lagrimas(tt, sp.ph, big);
    for (let i = 0; i < sp.sobre.length; i++) { const f = SOBRE[sp.sobre[i][0]]; if (f) f(sp.sobre[i][1]); }
    if (sp.ex) sp.ex(K);
    ctx.restore();
    if (an === 'celebrar' && big && op.confeti !== false) confeti(x, hy, s, t);
  } finally { if (haySid) sid = sid0; if (cl || cc) ctx.restore(); }
  return true;
}
function confeti(x, hy, s, t) {            // papelitos que caen (función pura de t; el color y la fase salen de un hash)
  for (let i = 0; i < 14; i++) {
    const u = fr(i * .618034), f = fr(t * .55 + fr(i * .37)), w = (3 + 5 * Math.abs(Math.sin(t * 6 + i * 1.3))) * s * 1.1, h = 9 * s * 1.1;
    rr(x + (u * 2 - 1) * 82 * s, hy - 112 * s + f * 200 * s, Math.max(2, w), Math.max(3, h), 1, CONF[i % 6], 0);
  }
}
const NOOP = {}, GEN = { id: '', look: LOOK0, o: null };
(function () { GEN.n = '¿?'; GEN.col = GRIS; GEN.sobre = []; GEN.legs = ['#5a5668', '#3a3648', 58]; GEN.ph = 0; GEN.sem = 599; GEN.otra = ''; GEN.pI = GEN.pD = null; GEN.frente = 0; GEN.v = {};
  GEN.o = Object.assign({}, LOOK0, { x: 0, y: 0, s: 1, flip: false, mood: 'calm', talk: 0, look: 0, rot: 0, sy: 1, th: 0, legs: null, arms: NOARMS }); GEN.lg = { skin: '#8a8696', shirt: '#5a5668', hairCol: '#3a3648' };
  GEN.aI = brazo(-1); GEN.aD = brazo(1); GEN.arms2 = [GEN.aI, GEN.aD]; GEN.armsI = [GEN.aI]; GEN.armsD = [GEN.aD]; })();

/* ───────────── medallón de tablero, y las firmas de siempre que reexporta fiesta-ui ───────────── */
function token(id, x, y, r, mood, t, op) {
  if (!labB()) return false; op = op || NOOP; const sp = CHARS[id], col = sp ? sp.col : GRIS;
  x = num(x); y = num(y); r = Math.max(4, num(r));
  ell(x, y, r, r, col, 3.5); ell(x, y, r * .84, r * .84, op.gris ? '#c9c5d4' : claro(col, .78), 0);
  const o = TOK; TOKC.x = x; TOKC.y = y; TOKC.r = r * .84; o.clipC = TOKC; o.gris = !!op.gris; o.modo = 'cara'; o.mood = op.mood; o.semilla = op.semilla; o.flip = op.flip; o.confeti = false;
  const q = draw(ctx, id, x, y + r * .05, r * .0165, mood, t, o); o.clipC = null; return q;
}
const TOK = {}, TOKC = { x: 0, y: 0, r: 1 };
function retrato(ch, cx, cy, hc, op) {     // cara con alto de cabeza ≈ hc, centrada en (cx, cy)
  op = op || NOOP; return draw(ctx, ch, cx, cy, hc / 110, op.animo || 'esperar', op.t === undefined ? tnow() : op.t,
    { modo: 'cara', mood: op.mood, talk: op.talk, flip: op.flip, gris: op.gris, clip: op.clip, rot: op.rot, sy: op.sy, semilla: op.semilla, sombra: op.sombra, confeti: false });
}
function dibujaPj(ch, cx, cy, h, op) {
  if (!labB()) return; op = op || NOOP; const hc = Math.max(8, num(h) || 80);
  draw(ctx, ch, cx, cy, hc / 110, op.animo || 'esperar', op.t === undefined ? tnow() : op.t,
    { modo: 'cara', mood: op.mood, talk: op.talk, flip: op.flip, gris: op.gris, clip: op.clip, semilla: op.semilla, sombra: op.sombra, confeti: false });
}
function pose(ch, cx, cy, h, op) {         // con cuerpo opcional (brazos arriba al celebrar, caídos al perder) para el podio y la selección grande
  if (!labB()) return; op = op || NOOP; const hc = Math.max(8, num(h) || 80);
  draw(ctx, ch, cx, cy, hc / 110, op.animo || 'esperar', op.t === undefined ? tnow() : op.t,
    { modo: op.modo || (op.cuerpo ? 'busto' : 'cara'), mood: op.mood, talk: op.talk, flip: op.flip, gris: op.gris, clip: op.clip, semilla: op.semilla, sombra: op.sombra, tinte: op.tinte });
}
// insignia redonda con la inicial del personaje (centro x,y radio r)
function glifo(ch, x, y, r) {
  if (!labP()) return; const d = CHARS[ch]; r = Math.max(4, num(r) || 10);
  ell(x, y, r, r, d ? d.col : GRIS, 2.5); txt(d ? d.glifo : '?', x, y + 1, r * 1.25, '#fffdf2', 0, true);
}
// placa de nombre con el color de identidad (centro x,y). op = {w, cpu:'auto'|'afk'|null, equipo:0|1}. Devuelve {w,h}
function placa(x, y, texto, ch, op) {
  op = op || NOOP; const id = ident(ch), h = 22, size = 14, s = String(texto == null ? '' : texto);
  const ins = op.equipo === 0 || op.equipo === 1 ? 14 : 0, tag = op.cpu === 'afk' ? ' zzz' : op.cpu ? ' CPU' : '', lab = labP() && typeof tw === 'function';
  const w = op.w || Math.max(48, (lab ? tw(s + tag, size) : s.length * 8) + 24 + ins);
  if (labP()) {
    rr(x - w / 2 + 2, y - h / 2 + 3, w, h, h / 2, 'rgba(20,16,28,.35)', 0);
    rr(x - w / 2, y - h / 2, w, h, h / 2, id.col, 3);
    rr(x - w / 2 + 4, y + h * .05, w - 8, h * .38, h * .2, id.col2, 0);   // franja inferior más oscura
    if (ins) rr(x - w / 2 + 6, y - 5, 10, 10, 3, op.equipo === 0 ? '#2f6fdb' : '#d93a3a', 2);
    let sz = size; if (lab) { const w0 = tw(s + tag, size), mx = w - 16 - ins; if (w0 > mx) sz = Math.max(8, size * mx / w0); }
    txt(s + tag, x + ins / 2, y + 1, sz, '#fffdf2', 0, true);
  }
  return { w, h };
}

const PJM = { draw, token, lista, color, frase, ficha, ident, retrato, dibujaPj, pose, placa, glifo, animoMood, oscuro, claro, def, cargarRoster, lookDe,
  CHARS, PJ, PJ_IDS, ORDEN_PJ, ANIMOS, LOOK0, GRIS, SOBRE, PROP, semillaDe, ids: CHAR_IDS_ALL };
F.PJ = PJM;
if (typeof module !== 'undefined') module.exports = PJM;
})(typeof window !== 'undefined' ? window : globalThis);
