'use strict';
// J0 · JUGAR: the world select, drawn with the shared kit (js/ui/mcui.js) on the same canvas, cast and controls as the rest of the menus.
function goWorlds() {
  if (window.frameElement?.id === 'camp-app' && parent.CAMP) { parent.CAMP.closeClassic(); return; }
  EGGS.stop(); state = 'worlds'; st = 0; mode = 'stage'; parts.length = 0;
}
function chooseClassic() { menuPage = 0; track('world_select', { world: 'classic' }); goMenu(); }
const langQ = () => '?lang=' + encodeURIComponent(I18N.lang);
function chooseVenezuela() { EGGS.stop(); track('world_select', { world: 'venezuela' }); kitLeave('worlds/venezuela/' + langQ(), MCUI.WORLD.venezuela); }
function chooseFiesta() { EGGS.stop(); track('world_select', { world: 'fiesta' }); kitLeave('worlds/venezuela/fiesta.html' + langQ(), MCUI.WORLD.fiesta); }
// Margarita's party board lives in docs/margarita and ships to docs/ in the production image (scripts/sync-world-assets.sh).
function chooseMargarita() { EGGS.stop(); track('world_select', { world: 'margarita' }); kitLeave('docs/margarita/' + langQ(), MCUI.WORLD.margarita); }
const comingSoon = () => MCUI.toast('ALMOST THERE! WE\'RE STILL BUILDING IT', 'gold');
function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } }
const starSum = a => (a || []).reduce((n, s) => n + (s || 0), 0);
/* one row per world: shipped = in the production build; LA FIESTA keeps its saved room for 6 h (docs/style-lab/fiesta-net.js) */
function worldList() {
  const ve = readJSON('minicaos-lab-niveles-v1'), room = readJSON('minicaos-fiesta-v1');
  const roomOk = room && room.code && Date.now() - (room.ts || 0) < 6 * 3600 * 1000;
  const worlds = [
    { id: 'w-classic', name: 'CLASSIC', desc: '100+ TINY 5-SEC GAMES', color: MCUI.WORLD.classic, shipped: true, fn: chooseClassic,
      foot: starSum(save.stars) + '/' + STAGES.length * 3, footIcon: 'star', players: '1', online: false,
      art: (cx, cy, tm, f) => CAST.host('sapito', cx, cy + 44 - (f ? Math.floor(Math.abs(Math.sin(tm * 6)) * 3) * 4 : 0), 7, { mood: f ? 'happy' : null }) },
    { id: 'w-venezuela', name: 'VENEZUELA', desc: 'BUS, HOME AND PARTY', color: MCUI.WORLD.venezuela, shipped: true, fn: chooseVenezuela,
      foot: starSum(ve && ve.stars) + '/15', footIcon: 'star', players: '1', online: false,
      art: (cx, cy, tm, f) => { ctx.save(); ctx.translate(cx, cy - 40 - (f ? Math.floor(Math.abs(Math.sin(tm * 4)) * 2) * 4 : 0)); ctx.scale(.65, .65); pixelVenezuelaFlag(0, 0); ctx.restore(); } },
    { id: 'w-fiesta', name: 'LA FIESTA', desc: 'BOARD GAME WITH FRIENDS', color: MCUI.WORLD.fiesta, shipped: true, fn: chooseFiesta,
      foot: roomOk ? t('ROOM {code}', { code: room.code }) : '', players: '2-4', online: true,
      art: (cx, cy, tm, f) => pixelBoard(cx, cy, tm, f) },
    { id: 'w-margarita', name: 'MARGARITA', desc: 'ISLAND BOARD VS 3 CPUS', color: MCUI.WORLD.margarita, shipped: true, fn: chooseMargarita,
      players: '1+3 CPU', online: false,
      art: (cx, cy, tm, f) => { ctx.save(); ctx.translate(cx, cy - 46 - (f ? Math.floor(Math.abs(Math.sin(tm * 4)) * 2) * 4 : 0)); ctx.scale(.7, .7); pixelIsland(0, 0); ctx.restore(); } },
  ];
  worlds.forEach(w => { w.playable = w.shipped; });
  return worlds;
}
function worldKey(e) {
  const worlds = worldList();
  if (/^Digit[1-9]$/.test(e.code) && +e.code.slice(5) <= worlds.length) { const w = worlds[+e.code.slice(5) - 1]; MCUI.focus(w.id); (w.playable ? w.fn : comingSoon)(); return true; }
  return false;
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
// Pixel party board: a zigzag of squares and a die that hops when the card has the focus.
function pixelBoard(cx, cy, tm, focused) {
  const b = 4, sq = [[-12, 6], [-6, 6], [0, 6], [6, 6], [6, 0], [0, 0], [-6, 0], [-12, 0], [-12, -6], [-6, -6]];
  const cols = ['#4DB8FF', '#FF4D4D', '#5CFF7A', '#FFE14D'];
  sq.forEach(([x, y], i) => { MCUI.notch(cx + x * b - 2, cy + y * b + 10 - 2, 5 * b + 4, 5 * b + 4, 0, INK); ctx.fillStyle = cols[i % 4]; ctx.fillRect(cx + x * b, cy + y * b + 10, 5 * b, 5 * b); });
  const hop = focused ? Math.floor(Math.abs(Math.sin(tm * 5)) * 4) * 4 : 0, dx = cx + 14, dy = cy - 58 - hop;
  MCUI.notch(dx - 4, dy - 4, 40, 40, 4, INK); ctx.fillStyle = '#fffdf2'; ctx.fillRect(dx, dy, 32, 32);
  ctx.fillStyle = INK; [[6, 6], [22, 6], [14, 14], [6, 22], [22, 22]].forEach(([x, y]) => ctx.fillRect(dx + x, dy + y, 4, 4));
}
function drawWorlds() {
  const V = MCUI.view();
  MCUI.bg('menu');
  MCUI.header('WHAT ARE WE PLAYING?');
  MCUI.back(goMain, 'GO BACK');
  kitChip();
  const worlds = worldList();
  const cardOf = (w, i, x, y, cw, ch) => MCUI.card(w.id, x, y, cw, ch, {
    color: w.color, art: w.art, title: w.name, desc: w.desc, foot: w.playable ? w.foot : '', footIcon: w.footIcon, prime: i === 0,
    badges: [{ icon: 'person', text: w.players, tone: 'paper' }, { text: w.online ? 'ONLINE' : 'OFFLINE', tone: w.online ? 'go' : 'paper' }],
    stamp: w.playable ? '' : 'COMING SOON', off: !w.playable, fn: w.playable ? w.fn : comingSoon });
  if (V.tall) {
    const top = 104, ch = 168, gap = 16, off = MCUI.scrollStart('worlds', top, V.h - 8, worlds.length * (ch + gap) + 8);
    worlds.forEach((w, i) => cardOf(w, i, 16, top + 8 + i * (ch + gap) + off, V.w - 32, ch));
    MCUI.scrollEnd();
    return;
  }
  worlds.forEach((w, i) => cardOf(w, i, 20 + (i % 2) * 388, 112 + (i / 2 | 0) * 204, 372, 184));
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'PLAY'], ['ARROWS', 'CHOOSE'], ['1-4', 'WORLD']]);
}
function initWorldMenu() {
  const query = new URLSearchParams(location.search), ref = document.referrer;
  // back from another world: the focus waits on that world's card
  const from = query.get('from') || (/\/fiesta\.html/.test(ref) ? 'fiesta' : /\/worlds\/venezuela\//.test(ref) ? 'venezuela' : /\/margarita\//.test(ref) ? 'margarita' : '');
  if (from) MCUI.setMemory('worlds', 'w-' + from);
  MCUI.setMemory('main', 'm-play');
  if (!inviteOpen() && !chOpen) {
    if (query.get('world') === 'classic') chooseClassic();
    else if (query.has('worlds')) goWorlds();
  }
}
