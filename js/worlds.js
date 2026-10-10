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
function drawWorlds() {
  bg('#2b2757', '#322d66', now);
  txt(worldText('ELIGE MUNDO', 'CHOOSE WORLD'), W / 2, 55, 48, '#FFE14D');
  const worlds = [
    { name: worldText('CLÁSICO', 'CLASSIC'), hint: worldText('LOS JUEGOS DE SIEMPRE', 'THE ORIGINAL GAMES'), fill: '#DDF3FF', fn: chooseClassic },
    { name: 'VENEZUELA', hint: worldText('CAMIONETICA, CASA Y RUMBA', 'BUS, HOME & PARTY'), fill: '#FFE9A8', fn: chooseVenezuela }
  ];
  worlds.forEach((world, i) => {
    const x = 60 + i * 380, y = 130, w = 300, h = 340, cx = x + w / 2;
    const hoveredCard = hoverBox(x, y, w, h, world.fill, 5, 7);
    const bob = Math.abs(Math.sin(now * 3 + i)) * 6;
    shadow(cx, y + 174, 50, 10, .2);
    if (i === 0) CAST.host('sapito', cx, y + 170 - bob, 10, { mood: hoveredCard ? 'happy' : null });
    else AP.person(AP.CAST.chamo, { mouth: 'smile', bob: -bob, la: [.2, .1], ra: [-.2, .1] }, cx, y + 174, .65);
    txt(world.name, cx, y + 213, 34, '#fff', 'center', w - 24);
    txt(world.hint, cx, y + 249, 15, INK, 'center', w - 24);
    ctx.restore();
    button(x + 28, y + 270, w - 56, 52, worldText('JUGAR ►', 'PLAY ►'), world.fn, { fill: i === 0 ? '#4DB8FF' : '#FFE14D', size: 24 });
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
