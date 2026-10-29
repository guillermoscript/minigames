'use strict';
/* LA FIESTA · kit de pixel al estilo del tablero de Margarita (docs/margarita/pixel.js): la escena se pinta a media resolución en un canvas aparte,
   pixel a pixel (fillRect 1×1, contorno de 1 px, tramas), con la fuente 3x5 y sprites por cadenas, y se copia ampliada ×2 sin suavizado.
   Prueba de estilo: un juego lo usa solo si FIESTA.PX.on() (?pixel=1 en la URL). Sin dependencias del motor; no toca la jugabilidad. */
(function () {
if (typeof window === 'undefined' || !window.FIESTA || FIESTA.PX) return;

var ESC = 2;                                                         // 1 pixel lógico = 2 px de pantalla (como el tablero: 640x360 → 1280x720)
var INK = '#14101c';

/* ───────── fuente 3x5 (la del tablero, con la puntuación que usan los minijuegos) ───────── */
var F3 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '?': '110001010000010', ' ': '000000000000000',
  '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', '¡': '010000010010010', '¿': '010000010100011', "'": '010010000000000',
  '/': '001001010100100', '·': '000000010000000', '▲': '000010111111000', '▼': '000111111010000'
};
function limpia(t) {
  return String(t).toUpperCase().replace(/…/g, '...').replace(/[ÁÀ]/g, 'A').replace(/[ÉÈ]/g, 'E').replace(/[ÍÌ]/g, 'I').replace(/[ÓÒ]/g, 'O').replace(/[ÚÙÜ]/g, 'U').replace(/Ñ/g, 'N');
}
function glyph(c, g, x, y, col, s) {
  var b = F3[g] || F3[' '], i; c.fillStyle = col;
  for (i = 0; i < 15; i++) if (b[i] === '1') c.fillRect(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
}
function ancho(t, s) { return limpia(t).length * 4 * (s || 1) - (s || 1); }
/* texto centrado en x; sombra = color de la sombra 1 px abajo-derecha (como el tablero) */
function texto(c, t, x, y, col, s, sombra) {
  s = s || 1; t = limpia(t); var w = t.length * 4 * s - s, i; x = Math.round(x - w / 2); y = Math.round(y);
  for (i = 0; i < t.length; i++) { if (sombra) glyph(c, t[i], x + i * 4 * s + s, y + s, sombra, s); glyph(c, t[i], x + i * 4 * s, y, col, s); }
}

/* ───────── primitivas ───────── */
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
/* caja con contorno de 1 px y luz arriba / sombra abajo */
function caja(c, x, y, w, h, col, luz, sombra) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  R(c, x, y, w, h, INK); R(c, x + 1, y + 1, w - 2, h - 2, col);
  if (luz) R(c, x + 1, y + 1, w - 2, 1, luz);
  if (sombra) R(c, x + 1, y + h - 2, w - 2, 1, sombra);
}
/* trama de tablero de ajedrez (la textura del terreno del tablero) */
function trama(c, x, y, w, h, col, fase) {
  x = Math.round(x); y = Math.round(y); c.fillStyle = col; var i, j;
  for (j = 0; j < h; j++) for (i = (j + (fase || 0)) & 1; i < w; i += 2) c.fillRect(x + i, y + j, 1, 1);
}
/* elipse llena por filas (sombras, anillos) */
function elipse(c, cx, cy, rx, ry, col) {
  cx = Math.round(cx); cy = Math.round(cy); c.fillStyle = col; var j;
  for (j = -ry; j <= ry; j++) { var k = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry || 1)))); c.fillRect(cx - k, cy + j, 2 * k + 1, 1); }
}
function anillo(c, cx, cy, rx, ry, col) {
  cx = Math.round(cx); cy = Math.round(cy); c.fillStyle = col; var n = Math.max(12, Math.round((rx + ry) * 3)), i;
  for (i = 0; i < n; i++) { var a = i / n * Math.PI * 2; c.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
}
/* línea de 1 px (Bresenham): rayos de la rueda, varas, cables */
function linea(c, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); c.fillStyle = col;
  var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy, n = 0;
  for (;;) { c.fillRect(x0, y0, 1, 1); if ((x0 === x1 && y0 === y1) || ++n > 2000) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
/* sprite por cadenas: '.' = vacío; fx/fy = espejo horizontal / vertical */
function sprite(c, rows, pal, x, y, fx, fy) {
  x = Math.round(x); y = Math.round(y); var j, i;
  for (j = 0; j < rows.length; j++) {
    var r = rows[fy ? rows.length - 1 - j : j];
    for (i = 0; i < r.length; i++) { var k = r[fx ? r.length - 1 - i : i]; if (k === '.' || !pal[k]) continue; c.fillStyle = pal[k]; c.fillRect(x + i, y + j, 1, 1); }
  }
}

/* ───────── gente (14x20): la ficha del tablero, cabezona, en grande para los minijuegos ───────── */
var PERSONA = [
  '....oooooo....',
  '...ohhHHhho...',
  '..ohhHhhhhho..',
  '.ohhhhhhhhhho.',
  '.ohssssssssho.',
  '.ossessssesso.',
  '.okssssssssko.',
  '..osssmmssso..',
  '...oossssoo...',
  '..occcccccCo..',
  '.occcccccccCo.',
  'osccccccccCCso',
  'osccccccccCCso',
  '..occcccccCo..',
  '..obbbbbbbbo..',
  '..oppppppppo..',
  '..opppoopppo..',
  '..opppoopppo..',
  '..ozzzoozzzo..',
  '...ooo..ooo...'
];
var MONO = ['...oooo...', '..owwwwo..', '..owwwwo..', '...oooo...'];      // el moño de la abuela
var GORRA = ['...oooooo.....', '..oggggggo....', '.ogggggggooooo', '.ogggggggggggo', '..oooooooooo..'];   // la gorra del pana, con visera
var PALPJ = {
  tu: { h: '#3a2414', s: '#e8b48a', c: '#3fb0ff', p: '#2a4a8a' },
  mama: { h: '#2a1a14', s: '#c98a5a', c: '#27b8c4', p: '#6a3a5a', k: 'largo' },
  abuela: { h: '#e8e8e8', s: '#d8a070', c: '#f27fb0', p: '#4a3a6a', k: 'mono' },
  pana: { h: '#2a1a14', s: '#8a5a3a', c: '#ff7a2b', p: '#2a3a5a', k: 'gorra', g: '#d23b3b' },
  tio: { h: '#4a3020', s: '#c98a5a', c: '#5cd27a', p: '#3a3a3a' },
  prima: { h: '#6a2a1a', s: '#e8b48a', c: '#b88aff', p: '#4a3a6a', k: 'largo' },
  profe: { h: '#9a9a9a', s: '#e0b088', c: '#ffd23f', p: '#3a3a5a' },
  chuo: { h: '#1a1a24', s: '#a8703f', c: '#e8a020', p: '#2a3a5a', k: 'gorra', g: '#2f6fe0' },
  vendedor: { h: '#1a1a24', s: '#a8703f', c: '#3fa06a', p: '#3a3a3a', k: 'gorra', g: '#d23b3b' }
};
/* aclara (k>0) u oscurece (k<0) un #rrggbb */
function tono(hex, k) {
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (v) { return Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); };
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}
function palDe(ch, col) {
  var b = PALPJ[ch] || { h: '#3a2414', s: '#d8a070', c: col || '#3fb0ff', p: '#2a3a5a' };
  return { o: INK, h: b.h, H: tono(b.h, 0.35), s: b.s, k: tono(b.s, -0.12), e: INK, m: '#8a3030', c: b.c, C: tono(b.c, -0.3), b: '#4a2a1a', p: b.p, z: INK, x: b.k, g: b.g || '#d23b3b', w: '#ffffff' };
}
/* persona con los pies en (x, y); o.fx espejo, o.fy de cabeza (rodando), o.cuerpo = color de camisa */
function persona(c, ch, col, x, y, o) {
  o = o || {}; var pal = palDe(ch, col), x0 = Math.round(x - 7), y0 = Math.round(y - 20);
  if (o.cuerpo) { pal.c = o.cuerpo; pal.C = tono(o.cuerpo, -0.3); }
  if (pal.x === 'largo' && !o.fy) { R(c, x0, y0 + 3, 2, 8, INK); R(c, x0 + 12, y0 + 3, 2, 8, INK); R(c, x0 + 1, y0 + 4, 1, 6, pal.h); R(c, x0 + 12, y0 + 4, 1, 6, pal.h); }
  sprite(c, PERSONA, pal, x0, y0, o.fx, o.fy);
  if (o.fy) return;
  if (pal.x === 'mono') sprite(c, MONO, { o: INK, w: pal.h }, x0 + 2, y0 - 3);
  else if (pal.x === 'gorra') sprite(c, GORRA, { o: INK, g: pal.g }, x0, y0 - 1, o.fx);
}

/* solo la cabeza (filas 0-8 del sprite): el retrato de las fichas del HUD; gris = fuera */
function cabeza(c, ch, col, x, y, gris) {
  var pal = palDe(ch, col), x0 = Math.round(x - 7), y0 = Math.round(y);
  if (gris) { var k; for (k in pal) if (typeof pal[k] === 'string' && pal[k].charAt(0) === '#' && k !== 'o' && k !== 'e') pal[k] = tono(pal[k], -0.45); }
  if (pal.x === 'largo') { R(c, x0, y0 + 3, 2, 6, INK); R(c, x0 + 12, y0 + 3, 2, 6, INK); R(c, x0 + 1, y0 + 4, 1, 5, pal.h); R(c, x0 + 12, y0 + 4, 1, 5, pal.h); }
  sprite(c, PERSONA.slice(0, 9), pal, x0, y0);
  if (pal.x === 'mono') sprite(c, MONO, { o: INK, w: pal.h }, x0 + 2, y0 - 3);
  else if (pal.x === 'gorra') sprite(c, GORRA, { o: INK, g: pal.g }, x0, y0 - 1);
}
/* texto pixel directo en el contexto del motor (sin buffer): s = tamaño en pixeles lógicos; cae en la rejilla de ×ESC */
function textoEn(dst, t, x, y, col, s, sombra) {
  s = (s || 1) * ESC; t = limpia(t); var w = t.length * 4 * s - s, i, j;
  x = Math.round((x - w / 2) / ESC) * ESC; y = Math.round(y / ESC) * ESC;
  var pinta = function (g, gx, gy, cc) { var b = F3[g] || F3[' ']; dst.fillStyle = cc; for (j = 0; j < 15; j++) if (b[j] === '1') dst.fillRect(gx + (j % 3) * s, gy + Math.floor(j / 3) * s, s, s); };
  for (i = 0; i < t.length; i++) { if (sombra) pinta(t[i], x + i * 4 * s + ESC, y + ESC, sombra); pinta(t[i], x + i * 4 * s, y, col); }
}

/* ───────── el lienzo: buffer de baja resolución que se copia ampliado ───────── */
var cv = null, cx = null;
function lienzo(w, h) {
  w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
  if (!cv) { cv = document.createElement('canvas'); cx = cv.getContext('2d'); }
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.imageSmoothingEnabled = false; cx.clearRect(0, 0, w, h);
  return cx;
}
/* copia el buffer al contexto del motor en (x, y) de pantalla, ×ESC, sin suavizado */
function volcar(dst, x, y) {
  FIESTA.PX.puro = true;                                             // el motor no le pasa el filtro del estilo (engine.js, postSNES)
  var s = dst.imageSmoothingEnabled; dst.imageSmoothingEnabled = false;
  dst.drawImage(cv, Math.round(x), Math.round(y), cv.width * ESC, cv.height * ESC);
  dst.imageSmoothingEnabled = s;
}
function on() { try { return new URLSearchParams(location.search).get('pixel') === '1'; } catch (e) { return false; } }

FIESTA.PX = { ESC: ESC, INK: INK, on: on, lienzo: lienzo, volcar: volcar, R: R, caja: caja, trama: trama, linea: linea, elipse: elipse, anillo: anillo,
  sprite: sprite, texto: texto, textoEn: textoEn, ancho: ancho, persona: persona, cabeza: cabeza, palDe: palDe, tono: tono, PERSONA: PERSONA, puro: false };
})();
