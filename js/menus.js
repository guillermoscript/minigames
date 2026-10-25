'use strict';
/* The console-style front end (docs/ui/01-menu-redesign.md): title (press start) → main menu → JUGAR (js/worlds.js) / panas / profile /
   records / options. These screens are drawn with the shared kit (js/ui/mcui.js) and have a tall layout for phones held upright.
   Loaded before js/main.js; everything here runs at draw / input time, so it can use main.js state freely. */
const KIT_STATES = ['title', 'main', 'worlds', 'options'];
const kitOn = () => KIT_STATES.includes(state) && !sh.on;
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
    avatar: (cx, feet, h) => caos(cx, feet, h / 24, { col: u ? u.color : '#9a98ad' }) }, goProfile);
}
function kitLang(x, y, w) {
  MCUI.btn('lang', x, y, w, 48, LANGS.find(l => l.code === I18N.lang).name, () => I18N.next(), { icon: 'globe', size: 16 });
}
function kitSound(x, y) {
  MCUI.btn('sound', x, y, 56, 48, '', () => { muted = !muted; if (!muted) sfx.click(); else EGGS.stop(); }, { icon: muted ? 'mute' : 'note' });
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
  { id: 'm-options', label: 'OPTIONS', icon: 'gear', tone: 'paper', desc: 'LANGUAGE, SOUND AND INSTALLING THE APP.', fn: () => goOptions() },
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
    MCUI.btn('m-invite', 16, top + 160 + MAIN_ITEMS.length * rowH + off, V.w - 32, 64, 'INVITE A FRIEND', () => doShare('invite'), { icon: 'share', tone: 'info' });
    MCUI.scrollEnd();
    return;
  }
  MAIN_ITEMS.forEach((m, i) => MCUI.btn(m.id, 40, 112 + i * 80, 352, 68, m.label, m.fn, { icon: m.icon, tone: m.tone, align: 'left', size: 24, prime: i === 0, dot: m.id === 'm-party' && pend ? pend : 0 }));
  const sel = MAIN_ITEMS.find(m => m.id === MCUI.focus()) || MAIN_ITEMS[0];
  MCUI.panel(424, 112, 336, 296, { tone: 'panel', band: MCUI.TONE[sel.tone] || '#fffdf2' });
  mainScene(sel.id, 592, 196);
  MCUI.para(sel.desc, 440, 320, 304, 16, '#fff', 'left', 24);
  MCUI.btn('m-invite', 424, 436, 336, 64, 'INVITE A FRIEND', () => doShare('invite'), { icon: 'share', tone: 'info' });
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['ARROWS', 'MOVE']]);
}

/* ───────────── O0 options (step 1: language, sound, install; volumes and controls come later) ───────────── */
function drawOptions() {
  const V = MCUI.view(), pwa = window.PWA;
  MCUI.bg('menu');
  MCUI.header('OPTIONS');
  MCUI.back(() => { state = optFrom; st = 0; }, 'GO BACK');
  kitChip();
  const rows = [
    { id: 'o-lang', label: 'LANGUAGE', value: LANGS.find(l => l.code === I18N.lang).name, icon: 'globe', fn: () => I18N.next() },
    { id: 'o-sound', label: 'SOUND', value: muted ? 'OFF' : 'ON', icon: muted ? 'mute' : 'note', fn: () => { muted = !muted; if (!muted) sfx.click(); else EGGS.stop(); }, tone: muted ? 'paper' : 'go' },
    { id: 'o-install', label: 'INSTALL APP', value: pwa && pwa.installed() ? 'INSTALLED' : 'INSTALL', icon: 'right', fn: () => pwa && pwa.install(), off: !(pwa && pwa.available()), tone: 'gold' },
  ];
  rows.forEach((r, i) => {
    if (V.tall) {
      const y = 112 + i * 128;
      MCUI.text(r.label, 24, y + 12, 16, '#fff', 'left', V.w - 48);
      MCUI.btn(r.id, 16, y + 36, V.w - 32, 64, r.value, r.fn, { icon: r.icon, tone: r.tone, off: r.off, prime: i === 0 });
    } else {
      const y = 128 + i * 96;
      MCUI.text(r.label, 64, y + 32, 24, '#fff', 'left', 320);
      MCUI.btn(r.id, 420, y, 316, 64, r.value, r.fn, { icon: r.icon, tone: r.tone, off: r.off, prime: i === 0 });
    }
  });
  if (!(pwa && pwa.available()) && !(pwa && pwa.installed())) MCUI.para('YOUR BROWSER CAN ADD MINICAOS TO THE HOME SCREEN FROM ITS OWN MENU.', V.tall ? 16 : 64, V.tall ? 520 : 440, V.tall ? V.w - 32 : 672, 8, '#ddd', 'left', 16);
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHANGE'], ['ARROWS', 'MOVE']]);
}

/* ───────────── frame + input ───────────── */
function drawKit() {
  MCUI.begin(ctx, kitView(), state);
  if (state === 'title') drawTitle();
  else if (state === 'main') drawMain();
  else if (state === 'worlds') drawWorlds();
  else if (state === 'options') drawOptions();
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
  if (e.code === 'KeyO' && state !== 'options') { goOptions(); return true; }
  if (e.code === 'KeyG' && (state === 'title' || state === 'options')) { I18N.next(); return true; }
  if (e.code === 'KeyF' && (state === 'title' || state === 'main')) { goParty(state); return true; }
  if (e.code === 'KeyL' && state === 'main') { goBoard(); return true; }
  if (state === 'worlds') return worldKey(e);
  return false;
}
addEventListener('pageshow', e => { if (e.persisted) leaving = null; });   // back/forward cache brought this page back: drop the closed curtain
