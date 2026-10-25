'use strict';
/* Isla de Margarita · criaturas y visitantes de las noticias: el barco pirata de Lope de Aguirre, el Kraken, la sirena, el ovni,
   El Silbón, la cisterna, la procesión de la Virgen del Valle y los pescadores. margarita.js las crea y mueve (x, y, estado);
   aquí solo se dibujan. Se pueden tocar (MAPA.tocar las revisa). */
const CRIAT = (function () {
const lista = [];
function add(k, o) { const c = Object.assign({ k, x: 0, y: 0, t: 0, flip: false }, o || {}); lista.push(c); return c; }
function quitar(c) { const i = lista.indexOf(c); if (i >= 0) lista.splice(i, 1); }
const P = (s, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), s[0], s[1]); };

function barco(c, t) {
  const x = Math.round(c.x), y = Math.round(c.y + Math.sin(t * 2) * 1.2), f = c.flip ? -1 : 1;
  const r = (dx, dy, w, h, col) => P([w, h], f > 0 ? x + dx : x - dx - w, y + dy, col);
  r(-14, 0, 28, 5, '#14101c'); r(-13, 1, 26, 3, '#6a3a1a'); r(-12, 4, 24, 2, '#4a2a10'); r(10, -3, 5, 3, '#6a3a1a');
  r(-1, -22, 1, 22, '#3a2a1a'); r(-8, -20, 15, 8, '#e8e2d0'); r(-7, -11, 13, 7, '#d8d2c0');
  r(0, -26, 6, 4, '#14101c'); r(2, -25, 2, 2, '#fffdf2');
  for (let i = 0; i < 3; i++) r(-9 + i * 6, 2, 2, 1, '#14101c');
  if (c.humo > 0) { c.humo -= 1 / 60; for (let i = 0; i < 6; i++) P([2, 2], x + f * (16 + i * 2) + Math.sin(i + t * 9) * 2, y - 2 - i, `rgba(220,220,220,${c.humo})`); }
}
function kraken(c, t) {
  const x = Math.round(c.x), y = Math.round(c.y), a = c.a === undefined ? 1 : c.a;
  ctx.globalAlpha = a;
  for (let k = 0; k < 6; k++) {
    const bx = x - 22 + k * 9, fase = t * 2 + k;
    for (let i = 0; i < 9; i++) {
      const yy = y - i * 2.4, xx = bx + Math.sin(fase + i * .5) * (i * .6);
      P([3 - (i > 6 ? 1 : 0), 3], xx, yy, i % 3 ? '#7a2a6a' : '#a84a8a');
      if (i % 2 && i < 7) P([1, 1], xx + 1, yy + 1, '#f0b0e0');
    }
  }
  P([14, 6], x - 7, y - 3, '#7a2a6a'); P([3, 2], x - 4, y - 2, '#ffd23f'); P([3, 2], x + 2, y - 2, '#ffd23f'); P([1, 1], x - 3, y - 2, '#14101c'); P([1, 1], x + 3, y - 2, '#14101c');
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 10; i++) ctx.fillRect(Math.round(x - 28 + i * 6 + Math.sin(t * 3 + i) * 2), y + 2, 3, 1);
}
function sirena(c, t) {
  const x = Math.round(c.x), y = Math.round(c.y), b = Math.round(Math.sin(t * 2));
  P([12, 4], x - 6, y + 2, '#8a8a7a'); P([10, 2], x - 5, y + 1, '#a8a898');
  P([4, 3], x - 1, y - 9 + b, '#e8b48a'); P([5, 6], x - 2, y - 12 + b, '#d8a020'); P([3, 3], x - 1, y - 6 + b, '#e8b48a'); P([2, 2], x - 1, y - 7 + b, '#ff6fa8');
  P([3, 4], x - 1, y - 3 + b, '#2fb0a0'); P([4, 2], x + 1, y + 1, '#2fb0a0'); P([2, 2], x + 4, y - 1 + Math.round(Math.sin(t * 4)), '#40d0c0');
  if (Math.sin(t * 3) > 0) texto('♪', x + 6 + Math.round(Math.sin(t) * 2), y - 18 - Math.round((t * 6) % 6), '#fffdf2');
}
function ovni(c, t) {
  const x = Math.round(c.x), y = Math.round(c.y + Math.sin(t * 3) * 1.5);
  if (c.rayo) { ctx.fillStyle = 'rgba(160,255,160,.28)'; ctx.beginPath(); ctx.moveTo(x - 4, y + 3); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x + 12, c.suelo || y + 50); ctx.lineTo(x - 12, c.suelo || y + 50); ctx.fill(); }
  P([18, 4], x - 9, y, '#9aa8b8'); P([14, 2], x - 7, y + 3, '#6a7888'); P([8, 4], x - 4, y - 4, '#a0f0ff');
  for (let i = 0; i < 4; i++) P([1, 1], x - 7 + i * 5, y + 1, Math.floor(t * 8 + i) % 2 ? '#ffd23f' : '#ff4040');
  P([2, 2], x - 1, y - 3, '#5cd27a');
}
function silbon(c, t) {
  const x = Math.round(c.x), y = Math.round(c.y), s = Math.round(Math.sin(t * 1.5) * 1);
  ctx.globalAlpha = .75 + Math.sin(t * 5) * .15;
  P([3, 16], x - 1 + s, y - 22, '#1a1a24'); P([3, 3], x - 1 + s, y - 25, '#d8d0c0'); P([5, 1], x - 2 + s, y - 26, '#1a1a24');
  P([1, 10], x - 2 + s, y - 20, '#1a1a24'); P([1, 10], x + 2 + s, y - 20, '#1a1a24');
  P([4, 5], x + 3 + s, y - 12, '#8a6a4a'); P([1, 6], x - 1 + s, y - 6, '#1a1a24'); P([1, 6], x + 1 + s, y - 6, '#1a1a24');
  ctx.globalAlpha = 1;
  if (Math.sin(t * 2) > .3) texto('FIU', x + 8, y - 30 - Math.round((t * 4) % 4), '#b8f0ff');
}
function cisterna(c, t) {
  const x = Math.round(c.x), y = Math.round(c.y), f = c.flip;
  P([14, 6], x - 7, y - 6, '#14101c'); P([9, 4], f ? x - 2 : x - 6, y - 5, '#3fb0ff'); P([4, 4], f ? x - 6 : x + 3, y - 5, '#e0403a');
  P([2, 2], x - 5, y - 1, '#14101c'); P([2, 2], x + 3, y - 1, '#14101c');
  if (Math.floor(t * 4) % 2) P([1, 2], f ? x + 8 : x - 9, y - 4, '#9fd8ff');
}
function procesion(c, t) {
  for (let i = 0; i < 9; i++) {
    const u = c.u - i * .018, a = u * 6.283, x = Math.round(c.cx + Math.cos(a) * c.rx), y = Math.round(c.cy + Math.sin(a) * c.ry), b = Math.floor(t * 4 + i) % 2;
    if (i === 3) { P([7, 4], x - 3, y - 10, '#14101c'); P([5, 3], x - 2, y - 9, '#ffd23f'); P([3, 4], x - 1, y - 14, '#fffdf2'); P([1, 1], x, y - 15, '#ffd23f'); }
    else { P([1, 1], x, y - 4, '#c98a5a'); P([1, 2], x, y - 3, i % 2 ? '#fffdf2' : '#3fb0ff'); P([1, 1], x - b, y - 1, '#14101c'); if (c.velas && Math.sin(t * 6 + i) > -.5) P([1, 1], x + 1, y - 5, '#ffd23f'); }
  }
}
function peces(c, t) {
  for (let i = 0; i < 5; i++) {
    const k = (t * 1.2 + i * .2) % 1, x = c.x + i * 7 - 14, y = c.y - Math.sin(k * Math.PI) * 8;
    if (k < .9) P([2, 1], x + k * 6, y, '#c8e0f0');
  }
}
const DIB = { barco, kraken, sirena, ovni, silbon, cisterna, procesion, peces };
function dibujar(t, dt) { for (const c of lista) { c.t += dt; (DIB[c.k] || (() => {}))(c, t); } }
return { lista, add, quitar, dibujar };
})();
