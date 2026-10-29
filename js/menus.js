'use strict';
/* The console-style front end (docs/ui/01-menu-redesign.md): title (press start) → main menu → JUGAR (js/worlds.js) / panas / profile /
   records / options. These screens are drawn with the shared kit (js/ui/mcui.js) and have a tall layout for phones held upright.
   Loaded before js/main.js; everything here runs at draw / input time, so it can use main.js state freely. */
const KIT_STATES = ['title', 'main', 'worlds', 'options', 'menu', 'practice', 'invite', 'friends', 'profile', 'pview', 'board', 'controls'];
const RESULT_STATES = ['clear', 'over'];   // old-style art, kit buttons: input goes through the kit, no tall layout
const kitOn = () => (KIT_STATES.includes(state) || panasMenuOn()) && !sh.on;   // panasMenuOn: the party screen before you are in a room (js/panas.js)
const kitInput = () => kitOn() || (!sh.on && RESULT_STATES.includes(state));
tallWanted = kitOn;
MCUI.sounds({ click: () => sfx.click(), tick: () => sfx.tick(), back: () => sfx.whoosh(false) });
let optFrom = 'main', leaving = null;
// Coming back from another page (Venezuela, LA FIESTA, Margarita) that closed its curtain: open it here with the same colour.
let arriveCol = null;
try { arriveCol = sessionStorage.getItem('mc-wipe'); sessionStorage.removeItem('mc-wipe'); } catch (e) {}

function goMain() { EGGS.stop(); state = 'main'; st = 0; mode = 'stage'; parts.length = 0; }
function goOptions() { if (state !== 'options') optFrom = state; state = 'options'; st = 0; }
/* leave for another page: close the curtain in the world's colour, then navigate (the next page opens it) */
function kitLeave(url, col) {
  if (leaving) return;
  try { sessionStorage.setItem('mc-wipe', col); } catch (e) {}
  leaving = { url, col, t0: now };
}
const kitView = () => ({ w: TALL ? TW : W, h: TALL ? TH : H, ox: TALL ? 0 : OX, tall: TALL, t: now });

/* ───────────── shared chrome ───────────── */
function kitChip() {
  const u = net.user, V = MCUI.view(), w = V.tall ? 56 : 184, x = V.tall ? V.w - 16 - w : W + OX - 16 - w;
  MCUI.player('chip', x, 16, w, 56, { name: u ? u.username : t('GUEST'), color: u ? u.color : null,
    avatar: (cx, feet, h) => drawMe(cx, feet, h / 24, u ? u.color : '#9a98ad') }, goProfile);   // your character (js/perfil.js)
}
function kitLang(x, y, w) {
  MCUI.btn('lang', x, y, w, 48, LANGS.find(l => l.code === I18N.lang).name, () => I18N.next(), { icon: 'globe', size: 16 });
}
function kitSound(x, y) {
  MCUI.btn('sound', x, y, 56, 48, '', muteToggle, { icon: muted ? 'mute' : 'note' });
}

/* ───────────── T0 title ───────────── */
function pixelSpark(x, y, u, col) {
  MCUI.notch(x - u * 1.5 - 2, y - u / 2 - 2, u * 3 + 4, u + 4, 0, INK); MCUI.notch(x - u / 2 - 2, y - u * 1.5 - 2, u + 4, u * 3 + 4, 0, INK);
  ctx.fillStyle = col; ctx.fillRect(x - u * 1.5, y - u / 2, u * 3, u); ctx.fillRect(x - u / 2, y - u * 1.5, u, u * 3);
}
function pixelLogo(s, cx, y, size, col) {
  for (let i = 4; i >= 1; i--) MCUI.text(s, cx + i * 2, y + i * 2, size, INK);
  MCUI.text(s, cx, y, size, col);
}
function drawTitle() {
  const V = MCUI.view(), cx = V.w / 2, tall = V.tall, banner = inviteOpen() || chOpen;
  MCUI.bg('title');
  const SC = ['#FFE14D', '#5CFF7A', '#4DB8FF', '#FF4D9E'];
  for (let i = 0; i < 8; i++) {
    const a = now * .5 + i * Math.PI / 4, rx = tall ? 170 : 340, ry = tall ? 300 : 215;
    pixelSpark(Math.round((cx + Math.cos(a) * rx) / 4) * 4, Math.round(((tall ? V.h * .42 : 300) + Math.sin(a) * ry) / 4) * 4, 6, SC[i % 4]);
  }
  MCUI.area('start', -OX, 0, V.w + 2 * OX + 1, V.h, titleGo);
  const drop = Math.floor(easeBack(st / .6) * 8) / 8, bob = Math.floor(Math.sin(now * 2.2) * 2) * 2, size = tall ? 64 : 80;
  const ly = tall ? Math.round(V.h * .2) : 130;
  pixelLogo('MINI', cx, ly + bob - Math.round((1 - drop) * 200 / 8) * 8, size, '#FFE14D');
  pixelLogo('CAOS!', cx, ly + (tall ? 88 : 108) - bob - Math.round((1 - drop) * 200 / 8) * 8, size, '#fff');
  const feet = banner ? (tall ? Math.round(V.h * .56) : 408) : (tall ? Math.round(V.h * .64) : 468), jump = Math.floor(Math.abs(Math.sin(now * 4)) * 5) * 4;
  shadow(cx, feet + 4, 70 - jump, 11, .3);
  caos(cx, feet - jump, banner ? 6 : tall ? 8 : 9, { mood: 'happy' });   // with the invite banner up, a smaller Caos fits under the logo
  if (!banner) {
    const side = tall ? 130 : 220, u = tall ? 4 : 5;
    CAST.host('sapito', cx - side, feet - (Math.floor(now * 3) % 2) * 4, u, { mood: 'happy' });
    CAST.host('pulpi', cx + side, feet - (Math.floor(now * 3 + 1) % 2) * 4, u, { mood: 'happy' });
    const sy = tall ? Math.round(V.h * .76) : 528;
    if (Math.floor(now * 2.4) % 3) {
      const s = TOUCH ? 'TAP TO START' : 'PRESS START', w = MCUI.width(t(s), tall ? 16 : 24);
      MCUI.text(s, cx, sy, tall ? 16 : 24, '#5CFF7A', 'center', V.w - 64);
      MCUI.iconInk('right', cx - w / 2 - 22, sy, 3, '#5CFF7A'); MCUI.iconInk('left', cx + w / 2 + 22, sy, 3, '#5CFF7A');
    }
    MCUI.area('go', cx - 200, sy - 28, 400, 56, titleGo, { focus: true, prime: true });
    if (!TOUCH) MCUI.text('ENTER · SPACE · (A) ON A GAMEPAD', cx, sy + 40, 8, '#fff', 'center', V.w - 32);
    else MCUI.text(t('{games} MICROGAMES · 4 WORLDS', { games: PREG.length }), cx, sy + 40, 8, '#fff', 'center', V.w - 32);
  } else {
    const bw = tall ? V.w - 32 : 720, bx = (V.w - bw) / 2, by = tall ? Math.round(V.h * .58) : 424, bh = tall ? 240 : 136;
    MCUI.panel(bx, by, bw, bh, { tone: 'night', band: inviteOpen() ? '#5CFF7A' : '#FFE14D' });
    const msg = inviteOpen() ? t('YOUR FRIEND INVITES YOU TO ROOM {code}', { code: PINVITE })
      : t('{from} CHALLENGES YOU: BEAT {score} ON {stage}', { from: chFrom(), score: CH.score, stage: t(STAGES[CH.stage].name) });
    MCUI.para(msg, bx + 16, by + 34, bw - 32, 16, inviteOpen() ? '#5CFF7A' : '#FFE14D', 'center', 24);
    const go = inviteOpen() ? joinInvite : acceptChallenge, skip = () => { chOpen = false; PINVITE_USED = true; goMain(); };
    if (tall) {
      MCUI.btn('t-go', bx + 16, by + bh - 148, bw - 32, 64, inviteOpen() ? 'JOIN ROOM' : 'ACCEPT', go, { tone: 'go', prime: true, size: 16 });
      MCUI.btn('t-menu', bx + 16, by + bh - 72, bw - 32, 56, 'MENU', skip, { size: 16 });
    } else {
      MCUI.btn('t-go', bx + 24, by + bh - 76, 320, 60, inviteOpen() ? 'JOIN ROOM' : 'ACCEPT', go, { tone: 'go', prime: true, key: 'ENTER' });
      MCUI.btn('t-menu', bx + bw - 24 - 240, by + bh - 76, 240, 60, 'MENU', skip, { icon: 'right' });
    }
  }
  if (tall) { kitLang(16, 16, 136); kitSound(160, 16); }
  else { kitLang(16 - OX, 16, 168); kitSound(192 - OX, 16); }
  kitChip();
}

/* ───────────── M0 main menu ───────────── */
const MAIN_ITEMS = [
  { id: 'm-play', label: 'PLAY', icon: 'play', tone: 'go', desc: 'PICK A WORLD AND GO: MICROGAMES, LEVELS AND BOARDS.', fn: () => { track('menu_open', { section: 'play' }); goWorlds(); } },
  { id: 'm-party', label: 'PARTY WITH FRIENDS', icon: 'friends', tone: 'info', desc: 'MAKE A ROOM, SHARE THE CODE AND PLAY LIVE WITH UP TO 4 FRIENDS.', fn: () => goParty('main') },
  { id: 'm-profile', label: 'MY PROFILE', icon: 'person', tone: 'lilac', desc: 'YOUR NAME, YOUR COLOUR, YOUR STARS AND YOUR RANK.', fn: () => goProfile() },
  { id: 'm-records', label: 'RECORDS', icon: 'cup', tone: 'gold', desc: 'THE BEST SCORES OF EVERY STAGE.', fn: () => goBoard() },
  { id: 'm-options', label: 'OPTIONS', icon: 'gear', tone: 'paper', desc: 'LANGUAGE, MUSIC AND EFFECTS VOLUME, CONTROLS AND INSTALLING THE APP.', fn: () => goOptions() },
];
function mainScene(id, cx, cy) {
  const hop = k => Math.floor(Math.abs(Math.sin(now * 4 + k)) * 4) * 4, u = net.user;
  if (id === 'm-play') {
    CAST.host('sapito', cx - 90, cy + 40 - hop(0), 5, { mood: 'happy' });
    ctx.save(); ctx.translate(cx + 40, cy - 40); ctx.scale(.6, .6); pixelVenezuelaFlag(0, 0); ctx.restore();
    ctx.save(); ctx.translate(cx + 60, cy + 10); ctx.scale(.5, .5); pixelIsland(0, 0); ctx.restore();
  } else if (id === 'm-party') {
    ['#D97757', '#6EA8FE', '#7BD88F', '#F28CB1'].forEach((c, i) => caos(cx - 105 + i * 70, cy + 40 - hop(i), 4, { col: c, mood: 'happy' }));
  } else if (id === 'm-profile') {
    caos(cx, cy + 50 - hop(0), 7, { col: u ? u.color : '#9a98ad', mood: 'happy' });
  } else if (id === 'm-records') {
    MCUI.iconInk('cup', cx, cy - hop(0) / 2, 10, '#FFE14D');
    for (let i = 0; i < 3; i++) MCUI.iconInk('star', cx - 80 + i * 80, cy + 70, 4, '#FFE14D');
  } else {
    MCUI.iconInk('gear', cx - 40, cy, 8, '#fffdf2'); MCUI.iconInk('note', cx + 60, cy - 20, 6, '#5CFF7A'); MCUI.iconInk('globe', cx + 50, cy + 50, 5, '#4DB8FF');
  }
}
function drawMain() {
  const V = MCUI.view();
  MCUI.bg('menu');
  MCUI.header('MAIN MENU');
  MCUI.back(goTitle, 'GO BACK');
  kitChip();
  const pend = net.user && fr.list ? frPending() : 0;
  if (V.tall) {
    const top = 104, rowH = 88, contentH = 160 + MAIN_ITEMS.length * rowH + 80, off = MCUI.scrollStart('main', top, V.h - 8, contentH);
    const fid = MCUI.focus() && MAIN_ITEMS.some(m => m.id === MCUI.focus()) ? MCUI.focus() : 'm-play';
    mainScene(fid, V.w / 2, top + 76 + off);
    MAIN_ITEMS.forEach((m, i) => MCUI.btn(m.id, 16, top + 160 + i * rowH + off, V.w - 32, 72, m.label, m.fn, { icon: m.icon, tone: m.tone, align: 'left', prime: i === 0, dot: m.id === 'm-party' && pend ? pend : 0 }));
    MCUI.btn('m-invite', 16, top + 160 + MAIN_ITEMS.length * rowH + off, V.w - 32, 64, 'INVITE A FRIEND', goInvite, { icon: 'share', tone: 'info' });
    MCUI.scrollEnd();
    return;
  }
  MAIN_ITEMS.forEach((m, i) => MCUI.btn(m.id, 40, 112 + i * 80, 352, 68, m.label, m.fn, { icon: m.icon, tone: m.tone, align: 'left', size: 24, prime: i === 0, dot: m.id === 'm-party' && pend ? pend : 0 }));
  const sel = MAIN_ITEMS.find(m => m.id === MCUI.focus()) || MAIN_ITEMS[0];
  MCUI.panel(424, 112, 336, 296, { tone: 'panel', band: MCUI.TONE[sel.tone] || '#fffdf2' });
  mainScene(sel.id, 592, 196);
  MCUI.para(sel.desc, 440, 320, 304, 16, '#fff', 'left', 24);
  MCUI.btn('m-invite', 424, 436, 336, 64, 'INVITE A FRIEND', goInvite, { icon: 'share', tone: 'info' });
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['ARROWS', 'MOVE']]);
}

/* ───────────── O0 options and O1 controls ───────────── */
const muteToggle = () => { muted = !muted; if (!muted) sfx.click(); else EGGS.stop(); };
function drawOptions() {
  const V = MCUI.view(), pwa = window.PWA, tall = V.tall;
  if (pwa) pwa.shown();
  MCUI.bg('menu');
  MCUI.header('OPTIONS');
  MCUI.back(() => { state = optFrom; st = 0; }, 'GO BACK');
  kitChip();
  const canInstall = !!(pwa && pwa.available()), installed = !!(pwa && pwa.installed());
  const rows = [
    ['LANGUAGE', (x, y, w, h) => MCUI.btn('o-lang', x, y, w, h, LANGS.find(l => l.code === I18N.lang).name, () => I18N.next(), { icon: 'globe', prime: true })],
    ['MUSIC', (x, y, w, h) => MCUI.slider('o-music', x, y, w, h, () => vol.music, v => setVolume('music', v))],
    ['EFFECTS', (x, y, w, h) => MCUI.slider('o-sfx', x, y, w, h, () => vol.sfx, v => { setVolume('sfx', v); sfx.coin(); })],
    ['SOUND', (x, y, w, h) => MCUI.btn('o-sound', x, y, w, h, muted ? 'OFF' : 'ON', muteToggle, { icon: muted ? 'mute' : 'note', tone: muted ? 'paper' : 'go', key: 'M' })],
    ['CONTROLS', (x, y, w, h) => MCUI.btn('o-controls', x, y, w, h, 'SEE', goControls, { icon: 'right', tone: 'lilac' })],
    ['INSTALL APP', (x, y, w, h) => MCUI.btn('o-install', x, y, w, h, installed ? 'INSTALLED' : 'INSTALL', () => pwa && pwa.install(), { icon: installed ? 'check' : 'right', tone: 'gold', off: !canInstall })],
  ];
  const rh = tall ? 56 : 52, gap = tall ? 16 : 8, top = 112, cx = tall ? 160 : 380, cw = tall ? V.w - 16 - 160 : 380, lx = tall ? 16 : 64;
  const off = tall ? MCUI.scrollStart('options', top - 8, V.h - 8, rows.length * (rh + gap) + 160) : 0;
  rows.forEach((r, i) => {
    const y = top + i * (rh + gap) + off;
    MCUI.text(r[0], lx, y + rh / 2, tall ? 8 : 16, '#fff', 'left', cx - lx - 16);
    r[1](cx, y, cw, rh);
  });
  let y = top + rows.length * (rh + gap) + off;
  if (!canInstall && !installed) { MCUI.para('YOUR BROWSER CAN ADD MINICAOS TO THE HOME SCREEN FROM ITS OWN MENU.', cx, y - 4, cw, 8, '#ddd', 'left', 14); y += 36; }
  const lw = tall ? (V.w - 48) / 2 : 180;
  MCUI.btn('o-privacy', tall ? 16 : cx, y + 8, lw, 44, 'PRIVACY', () => window.open('privacy/', '_blank', 'noopener'), { size: 8 });
  MCUI.btn('o-terms', tall ? 32 + lw : cx + lw + 20, y + 8, lw, 44, 'TERMS', () => window.open('terms/', '_blank', 'noopener'), { size: 8 });
  if (tall) MCUI.scrollEnd();
  MCUI.keybar([['ESC', 'GO BACK'], ['ARROWS', 'MOVE'], ['ENTER', 'CHANGE']]);
}
let ctlFrom = 'options';
function goControls() { if (state !== 'controls') ctlFrom = state; state = 'controls'; st = 0; }
/* O1: the same input rules everywhere (docs/ui/01-menu-redesign.md §4) */
const CONTROLS = [
  ['MOVE', 'ARROWS · WASD', 'D-PAD · STICK', 'TAP'],
  ['CHOOSE', 'ENTER · SPACE', 'A', 'TAP'],
  ['GO BACK', 'ESC · BACKSPACE', 'B', 'BACK BUTTON'],
  ['TABS', 'Q / E', 'LB / RB', 'TAP THE TAB'],
  ['OPTIONS', 'O', 'SELECT', 'MAIN MENU'],
  ['MUTE', 'M', '-', 'OPTIONS'],
];
function drawControls() {
  const V = MCUI.view(), tall = V.tall;
  MCUI.bg('menu');
  MCUI.header('CONTROLS');
  MCUI.back(() => { state = ctlFrom; st = 0; }, 'GO BACK');
  kitChip();
  const heads = ['', 'KEYBOARD', 'GAMEPAD', 'TOUCH'];
  if (tall) {
    const off = MCUI.scrollStart('controls', 104, V.h - 8, CONTROLS.length * 120 + 80);
    CONTROLS.forEach((r, i) => {
      const y = 112 + i * 120 + off;
      MCUI.panel(16, y, V.w - 32, 104, { tone: 'panelDk', band: MCUI.TONE.lilac });
      MCUI.text(r[0], 32, y + 28, 16, '#FFE14D', 'left', V.w - 64);
      for (let k = 1; k < 4; k++) { MCUI.text(heads[k], 32, y + 34 + k * 18, 8, '#ddd', 'left'); MCUI.text(r[k], V.w - 32, y + 34 + k * 18, 8, '#fff', 'right', 200); }
    });
    MCUI.para('IN A MICROGAME, EACH GAME SAYS ITS OWN CONTROLS ON ITS CARD.', 16, 112 + CONTROLS.length * 120 + 8 + off, V.w - 32, 8, '#ddd', 'center', 16);
    MCUI.scrollEnd();
    return;
  }
  const xs = [40, 240, 440, 600], ws = [192, 192, 152, 160];
  MCUI.panel(32, 112, 736, 52, { tone: 'panelDk', band: MCUI.TONE.lilac });
  heads.forEach((h, k) => { if (h) MCUI.text(h, xs[k] + 8, 144, 8, '#FFE14D', 'left', ws[k]); });
  CONTROLS.forEach((r, i) => {
    const y = 176 + i * 56;
    MCUI.panel(32, y, 736, 44, { tone: i % 2 ? '#35406a' : '#2c3659' });
    r.forEach((c, k) => MCUI.text(c, xs[k] + 8, y + 22, k ? 8 : 16, k ? '#fff' : '#FFE14D', 'left', ws[k] - 8));
  });
  MCUI.para('IN A MICROGAME, EACH GAME SAYS ITS OWN CONTROLS ON ITS CARD.', 32, 520, 736, 8, '#ddd', 'center', 16);
  MCUI.keybar([['ESC', 'GO BACK']]);
}

/* ───────────── W1 Clásico: world shell with ETAPAS · PRÁCTICA · RÉCORDS ───────────── */
const lightOn = c => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) / 255 > .55; };
/* flip tabs without the screen curtain (they are one screen) */
function classicTab(i) {
  if (i === 0) { state = 'menu'; mode = 'stage'; }
  else if (i === 1) { state = 'practice'; mode = 'practice'; }
  else { lbWorld = 0; goBoard(); }   // RÉCORDS from Clásico opens on Clásico's boards
}
function classicHeader(tab) {
  const V = MCUI.view();
  MCUI.bg('classic');
  MCUI.header('CLASSIC', { band: MCUI.WORLD.classic, col: '#fff' });
  MCUI.back(goWorlds, 'GO BACK');
  kitChip();
  const tw = V.tall ? V.w - 32 : 456;
  MCUI.tabBar('tab', V.tall ? 16 : 40, 104, tw, 52, ['STAGES', 'PRACTICE', 'RECORDS'], tab, classicTab, ['star', 'play', 'cup']);
}
function stageCard(i, x, y, w, h) {
  const s = STAGES[i], locked = i > save.unlocked - 1, fill = locked ? '#5a5870' : s.bg[0], ink = !locked && lightOn(fill) ? INK : '#fff', u = h / 40;
  MCUI.tile('stage-' + i, x, y, w, h, fill, (dy, f) => {
    const hx = x + 44, feet = y + h - 14 + dy, bob = locked || !f ? 0 : Math.floor(Math.abs(Math.sin(now * 6)) * 3) * 4;
    MCUI.text(t('STAGE {n}', { n: i + 1 }), x + 10, y + 16 + dy, 8, ink, 'left', w - 20);
    MCUI.label(t(s.name), x + w / 2, y + 52 + dy, w - 20, 48, 16, ink);   // the name gets the full width: two lines of 16 px
    shadow(hx, feet + 2, 26, 5, .25);
    if (s.intro === 'ap' && !locked) AP.person(AP.CAST.chamo, { la: [2.4, .3], ra: [.12, .1], mouth: 'yell', talk: .8, wide: 1, bob: -bob }, hx, feet + 4, h / 440);
    else CAST.host(s.host, hx, feet - bob, s.host === 'chigui' || s.host === 'zumbi' ? u * .85 : u, { col: s.col, locked });
    const sx = x + w - 52, sy = y + h - 26 + dy;
    if (locked) MCUI.iconInk('lock', sx + 16, sy, 3, '#ddd');
    else for (let k = 0; k < 3; k++) MCUI.iconInk('star', sx - 24 + k * 26, sy, 3, k < save.stars[i] ? '#FFE14D' : '#4a4558');
  }, () => startStage(i), { off: locked, prime: i === Math.min(save.unlocked - 1, STAGES.length - 1) });
}
function menuFlip(p) { const mp = pageCount(STAGES.length, PER_MENU); menuPage = (p + mp) % mp; }
function drawClassicStages() {
  const V = MCUI.view();
  classicHeader(0);
  const got = save.stars.slice(0, STAGES.length).reduce((a, b) => a + b, 0);
  if (V.tall) {
    const top = 172, cw = (V.w - 48) / 2, ch = 132, rows = Math.ceil(STAGES.length / 2), off = MCUI.scrollStart('stages', top, V.h - 8, rows * (ch + 16) + 40);
    MCUI.iconInk('star', 28, top + 16 + off, 3, '#FFE14D'); MCUI.text(got + '/' + STAGES.length * 3, 44, top + 16 + off, 16, '#FFE14D', 'left');
    STAGES.forEach((s, i) => stageCard(i, 16 + (i % 2) * (cw + 16), top + 40 + (i / 2 | 0) * (ch + 16) + off, cw, ch));
    MCUI.scrollEnd();
    return;
  }
  MCUI.iconInk('star', 640, 130, 3, '#FFE14D'); MCUI.text(got + '/' + STAGES.length * 3, 760, 130, 16, '#FFE14D', 'right');
  STAGES.forEach((s, i) => {
    if ((i / PER_MENU | 0) !== menuPage) return;
    const k = i % PER_MENU; stageCard(i, 40 + (k % 3) * 248, 176 + (k / 3 | 0) * 160, 224, 144);
  });
  MCUI.pager('spage', W / 2, 500, menuPage, pageCount(STAGES.length, PER_MENU), menuFlip, 'stage-');
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'PLAY'], ['Q/E', 'TAB'], ['1-6', 'STAGE']]);
}
const PCOLS = ['#5CFF7A', '#4DB8FF', '#B49CFF', '#FFE14D', '#fffdf2', '#FF9E7A'];
function practiceFlip(p) { const pp = pageCount(PREG.length, PER_PRACTICE); practicePage = (p + pp) % pp; }
function drawClassicPractice() {
  const V = MCUI.view(), pp = pageCount(PREG.length, PER_PRACTICE);
  classicHeader(1);
  const speed = () => { practiceSp = practiceSp === 1 ? 1.5 : practiceSp === 1.5 ? 2 : 1; };
  const tileOf = (r, ri, x, y, w, h) => MCUI.tile('pr-' + r.id, x, y, w, h, PCOLS[ri % PCOLS.length], dy => {
    I18N.scope = I18N.scopeOf(r.id); MCUI.label(t(r.name), x + w / 2, y + h / 2 + dy, w - 12, h - 8, 16, INK); I18N.scope = '';
  }, () => startPractice(r.id), { prime: ri % PER_PRACTICE === 0 });
  const page = PREG.filter((r, ri) => (ri / PER_PRACTICE | 0) === practicePage);
  if (V.tall) {
    const top = 172, cw = (V.w - 32 - 16) / 2, ch = 56, rows = Math.ceil(page.length / 2), off = MCUI.scrollStart('practice', top, V.h - 8, 72 + rows * (ch + 12) + 80);
    MCUI.btn('speed', 16, top + off, V.w - 32, 56, t('SPEED x{n}', { n: practiceSp }), speed, { tone: 'gold' });
    page.forEach((r, k) => tileOf(r, practicePage * PER_PRACTICE + k, 16 + (k % 2) * (cw + 16), top + 72 + (k / 2 | 0) * (ch + 12) + off, cw, ch));
    MCUI.pager('ppage', V.w / 2, top + 72 + rows * (ch + 12) + 8 + off, practicePage, pp, practiceFlip, 'pr-');
    MCUI.scrollEnd();
    return;
  }
  MCUI.btn('speed', 520, 104, 240, 48, t('SPEED x{n}', { n: practiceSp }), speed, { tone: 'gold' });
  page.forEach((r, k) => tileOf(r, practicePage * PER_PRACTICE + k, 40 + (k % 4) * 184, 176 + (k / 4 | 0) * 64, 168, 52));
  MCUI.pager('ppage', W / 2, 500, practicePage, pp, practiceFlip, 'pr-');
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'PLAY'], ['Q/E', 'TAB']]);
}

/* result screens (clear / over): their art stays in js/main.js; only the buttons are kit plates. items = [[id, label, fn, tone]] */
function kitButtons(items, y) {
  MCUI.begin(ctx, kitView(), state);
  const n = items.length, w = n === 3 ? 220 : 280, gap = n === 3 ? 30 : 40, x0 = (W - (n * w + (n - 1) * gap)) / 2;
  const size = items.every(b => MCUI.width(t(b[1]), 24) <= w - 32) ? 24 : 16;   // one size for the whole row
  items.forEach((b, i) => MCUI.btn(b[0], x0 + i * (w + gap), y, w, 66, b[1], b[2], { tone: b[3], prime: i === 0, size }));
  MCUI.setBack(goMenu);
  MCUI.end();
}

/* ───────────── frame + input ───────────── */
function drawKit() {
  MCUI.begin(ctx, kitView(), state);
  codeSlot = friendSlot = nameSlot = null;   // the screens below set the slot their <input> sits in
  if (state === 'title') drawTitle();
  else if (state === 'main') drawMain();
  else if (state === 'worlds') drawWorlds();
  else if (state === 'options') drawOptions();
  else if (state === 'controls') drawControls();
  else if (state === 'menu') drawClassicStages();
  else if (state === 'practice') drawClassicPractice();
  else if (state === 'party') drawPanas();
  else if (state === 'invite') drawInvite();
  else if (state === 'friends') drawFriends();
  else if (state === 'profile') drawSignIn();
  else if (state === 'pview') drawPview();
  else if (state === 'board') drawBoard();
  if (toast) { MCUI.toast(toast.s, toast.col); toast = null; }
  MCUI.end();
  if (leaving) {
    const k = (now - leaving.t0) / .25;
    MCUI.wipe(Math.max(0, 1 - k), leaving.col);
    if (k >= 1 && !leaving.gone) { leaving.gone = true; location.assign(leaving.url); }
  } else MCUI.wipe(st / .3, arriveCol || MCUI.TONE.gold);
  if (st > .3) arriveCol = null;
}
/* keys on kit screens: the kit takes arrows / WASD / Enter / Space / Esc / Backspace / Q E, then the shortcuts below */
function kitKey(e) {
  if (leaving || MCUI.stale(state)) return true;
  if (MCUI.key(e)) return true;
  if (e.code === 'KeyO' && kitOn() && state !== 'options') { goOptions(); return true; }
  if (e.code === 'KeyG' && (state === 'title' || state === 'options')) { I18N.next(); return true; }
  if (e.code === 'KeyF' && (state === 'title' || state === 'main')) { goParty(state); return true; }
  if (e.code === 'KeyL' && state === 'main') { goBoard(); return true; }
  if (state === 'worlds') return worldKey(e);
  if (state === 'menu') {
    const d = +e.key;
    if (d >= 1 && d <= 6 && menuPage * PER_MENU + d - 1 < STAGES.length) { startStage(menuPage * PER_MENU + d - 1); return true; }
    if (e.code === 'KeyP') { classicTab(1); return true; }
    if (e.code === 'KeyL') { goBoard(); return true; }
  }
  return false;
}
addEventListener('pageshow', e => { if (e.persisted) leaving = null; });   // back/forward cache brought this page back: drop the closed curtain
