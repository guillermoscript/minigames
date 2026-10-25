'use strict';
// World selection uses the same canvas, cast and controls as the stage menu.
let worldChoice = 0;
function worldText(es, en) { return I18N.lang === 'es' ? es : en; }
function goWorlds() {
  if (window.frameElement?.id === 'camp-app' && parent.CAMP) { parent.CAMP.closeClassic(); return; }
  EGGS.stop(); state = 'worlds'; st = 0; mode = 'stage'; parts.length = 0; worldChoice = 0;
}
function chooseClassic() { menuPage = 0; track('world_select', { world: 'classic' }); goMenu(); }
function chooseVenezuela() {
  EGGS.stop(); track('world_select', { world: 'venezuela' });
  location.assign('worlds/venezuela/?lang=' + encodeURIComponent(I18N.lang));
}
// Margarita's party board still lives in docs/ (not in the production build), so its card only shows on a local dev server.
const MARGARITA_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
function chooseMargarita() { EGGS.stop(); track('world_select', { world: 'margarita' }); location.assign('docs/margarita/'); }
function worldList() {
  const worlds = [
    { name: worldText('CLÁSICO', 'CLASSIC'), hint: worldText('LOS JUEGOS DE SIEMPRE', 'THE ORIGINAL GAMES'), fill: '#DDF3FF', btn: '#4DB8FF', fn: chooseClassic },
    { name: 'VENEZUELA', hint: worldText('CAMIONETICA, CASA Y RUMBA', 'BUS, HOME & PARTY'), fill: '#FFE9A8', btn: '#FFE14D', fn: chooseVenezuela }
  ];
  if (MARGARITA_LOCAL) worlds.push({ name: 'MARGARITA', hint: worldText('FIESTA EN LA ISLA · 4 JUGADORES', 'ISLAND PARTY · 4 PLAYERS'), fill: '#BFF0E4', btn: '#3DDC97', fn: chooseMargarita });
  return worlds;
}
function worldKey(e, go) {
  const worlds = worldList(), n = worlds.length;
  if (e.code === 'ArrowLeft') worldChoice = (worldChoice + n - 1) % n;
  else if (e.code === 'ArrowRight') worldChoice = (worldChoice + 1) % n;
  else if (/^Digit[1-9]$/.test(e.code) && +e.code.slice(5) <= n) worlds[+e.code.slice(5) - 1].fn();
  else if (go) { e.preventDefault(); worlds[worldChoice % n].fn(); }
}
function pixelVenezuelaFlag(cx, y) {
  const x = cx - 84, width = 168, stripe = 36;
  ctx.fillStyle = INK; ctx.fillRect(x - 6, y - 6, width + 12, stripe * 3 + 12);
  ['#FFE14D', '#2455C6', '#F04444'].forEach((color, i) => {
    ctx.fillStyle = color; ctx.fillRect(x, y + i * stripe, width, stripe);
  });
  // Eight pixel stars follow the arc across the blue stripe.
  const pixels = ['0001000', '0001000', '1111111', '0111110', '0011100', '0110110', '1100011'];
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const sx = x + 14 + i * 18;
    const sy = y + 40 + Math.round(Math.pow(i - 3.5, 2) / 2) * 2;
    pixels.forEach((row, py) => [...row].forEach((pixel, px) => {
      if (pixel === '1') ctx.fillRect(sx + px * 2, sy + py * 2, 2, 2);
    }));
  }
}
// Pixel island: sea, sand, palm trunk and fronds, drawn in 4px blocks.
function pixelIsland(cx, y) {
  const b = 4, px = (x, yy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + x * b, y + yy * b, w * b, h * b); };
  px(-20, 22, 40, 6, INK); px(-19, 23, 38, 4, '#2455C6'); px(-19, 23, 38, 1, '#4DB8FF');
  px(-13, 18, 26, 6, INK); px(-12, 19, 24, 4, '#FFE9A8');
  px(-1, 4, 3, 15, INK); px(0, 5, 1, 14, '#9a6a3a');
  px(-9, 2, 9, 3, INK); px(-8, 3, 8, 1, '#3DDC97'); px(1, 2, 9, 3, INK); px(1, 3, 8, 1, '#3DDC97');
  px(-6, 0, 5, 3, INK); px(-5, 1, 4, 1, '#2bb07a'); px(2, 0, 5, 3, INK); px(2, 1, 4, 1, '#2bb07a');
  px(10, -2, 5, 5, INK); px(11, -1, 3, 3, '#FFE14D');
}
function drawWorlds() {
  bg('#2b2757', '#322d66', now);
  txt(worldText('ELIGE MUNDO', 'CHOOSE WORLD'), W / 2, 55, 48, '#FFE14D');
  const worlds = worldList(), n = worlds.length, gap = n > 2 ? 30 : 80, w = n > 2 ? 226 : 300;
  const left = (W - (n * w + (n - 1) * gap)) / 2;
  worlds.forEach((world, i) => {
    const x = left + i * (w + gap), y = 130, h = 340, cx = x + w / 2;
    const hoveredCard = hoverBox(x, y, w, h, world.fill, 5, 7);
    const bob = Math.abs(Math.sin(now * 3 + i)) * 6;
    shadow(cx, y + 174, 50, 10, .2);
    if (i === 0) CAST.host('sapito', cx, y + 170 - bob, 10, { mood: hoveredCard ? 'happy' : null });
    else if (i === 1) pixelVenezuelaFlag(cx, y + 54 - Math.round(bob / 2) * 2);
    else pixelIsland(cx, y + 40 - Math.round(bob / 2) * 2);
    txt(world.name, cx, y + 213, 34, '#fff', 'center', w - 24);
    txt(world.hint, cx, y + 249, 15, INK, 'center', w - 24);
    ctx.restore();
    button(x + 28, y + 270, w - 56, 52, worldText('JUGAR ►', 'PLAY ►'), world.fn, { fill: world.btn, size: 24 });
    btns.push({ x, y, w, h, fn: world.fn });
    if (worldChoice === i && !TOUCH) { ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 3; ctx.strokeRect(x - 10, y - 10, w + 20, h + 20); }
  });
  button(260, 510, 280, 60, worldText('◄ INICIO', '◄ HOME'), goTitle, { size: 24 });
  if (!TOUCH) txt(worldText('◄ ► ELEGIR · ENTER JUGAR', '◄ ► CHOOSE · ENTER PLAY'), W / 2, 488, 17, '#fff');
}
function initWorldMenu() {
  const query = new URLSearchParams(location.search);
  if (!inviteOpen() && !chOpen) {
    if (query.get('world') === 'classic') chooseClassic();
    else if (query.has('worlds')) goWorlds();
  }
}
