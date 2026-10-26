'use strict';
/* MI PERFIL on the menu kit (docs/ui/01-menu-redesign.md §1, R0): sign-in for guests ('profile') and the profile view ('pview', yours
   or another player's) with STATS / UNLOCKS / EDIT tabs. Sign-in, rename, colour and follow logic stay in js/main.js.
   The character is a per-device choice (localStorage), drawn wherever you appear in the menus. */
const PERFIL_KEY = 'minicaos-perfil-v1';
const CHARS = [['caos', 'CAOS'], ['sapito', 'SAPITO'], ['pulpi', 'PULPI'], ['zumbi', 'ZUMBI'], ['chigui', 'CHIGÜI'], ['lechuza', 'LECHUZA']];
let perfil = { ch: 'caos' }, pvTab = 0, nameSlot = null;
try { Object.assign(perfil, JSON.parse(localStorage.getItem(PERFIL_KEY)) || {}); } catch (e) {}
if (!CHARS.some(c => c[0] === perfil.ch)) perfil.ch = 'caos';
function setChar(d) {
  const i = CHARS.findIndex(c => c[0] === perfil.ch);
  perfil.ch = CHARS[(i + d + CHARS.length) % CHARS.length][0];
  try { localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil)); } catch (e) {}
  track('character_pick', { ch: perfil.ch });
}
/* you, as the cast member you picked (Caos takes your colour); feet at y, u = pixel unit */
function drawMe(x, y, u, col, mood) {
  if (perfil.ch === 'caos') caos(x, y, u, { col, mood });
  else CAST.host(perfil.ch, x, y, perfil.ch === 'chigui' || perfil.ch === 'zumbi' ? u * .85 : u, { mood });
}
function charPicker(x, y, w) {
  const name = CHARS.find(c => c[0] === perfil.ch)[1];
  MCUI.btn('ch-prev', x, y, 64, 56, '', () => setChar(-1), { icon: 'left', tone: 'gold' });
  MCUI.panel(x + 76, y, w - 152, 56, { tone: 'panelDk' });
  MCUI.text(name, x + w / 2, y + 28, 16, '#fff', 'center', w - 176);
  MCUI.btn('ch-next', x + w - 64, y, 64, 56, '', () => setChar(1), { icon: 'right', tone: 'gold' });
}
/* this device's progress: classic stars and stages, Venezuela stars */
function localStats() {
  const ve = readJSON('minicaos-lab-niveles-v1');
  return { stars: starSum(save.stars.slice(0, STAGES.length)), unlocked: save.unlocked, ve: starSum(ve && ve.stars) };
}

/* ───────────── R0 sign-in (guests) ───────────── */
function googleTile(x, y, w, h) {
  const ok = pf.avail === 'yes' || pf.avail === 'loading';
  MCUI.tile('google', x, y, w, h, ok ? '#fffdf2' : '#bdbbc9', dy => {
    googleG(x + 44, y + h / 2 + dy, 18, !ok);
    MCUI.label(t(pf.busy ? 'Waiting for Google...' : 'Sign in with Google').toUpperCase(), x + 72 + (w - 88) / 2, y + h / 2 + dy, w - 92, h - 8, 16, ok ? INK : '#6d6a80');
  }, doGoogle, { off: !ok || pf.busy, prime: true });
}
function drawSignIn() {
  const V = MCUI.view(), tall = V.tall, st0 = localStats();
  MCUI.bg('menu');
  MCUI.header('MY PROFILE');
  MCUI.back(back, 'GO BACK');
  kitChip();
  const jump = Math.floor(Math.abs(Math.sin(now * 3)) * 3) * 4;
  const col = tall ? 16 : 40, cw = tall ? V.w - 32 : 300, rx = tall ? 16 : 372, rw = tall ? V.w - 32 : 388;
  const ay = tall ? 220 : 270;
  shadow(col + cw / 2, ay + 4, 50, 9, .3); drawMe(col + cw / 2, ay - jump, tall ? 6 : 7, '#9a98ad', 'happy');
  charPicker(col, ay + 24, cw);
  MCUI.text(t('{stars}/{max} STARS · {unlocked}/{stages} UNLOCKED', { stars: st0.stars, max: STAGES.length * 3, unlocked: st0.unlocked, stages: STAGES.length }), col + cw / 2, ay + 104, 8, '#ddd', 'center', cw);
  MCUI.text(t('VENEZUELA: {n}/15 STARS', { n: st0.ve }), col + cw / 2, ay + 124, 8, '#ddd', 'center', cw);
  let y = tall ? ay + 156 : 120;
  const ph = tall ? 380 : 392;
  MCUI.panel(rx, y, rw, ph, { band: MCUI.TONE.gold });
  MCUI.para('SAVE YOUR PROGRESS · JOIN THE LEADERBOARDS', rx + 20, y + 36, rw - 40, 16, '#fff', 'center', 24);
  googleTile(rx + 20, y + 100, rw - 40, 72);
  let ly = y + 204;
  if (pf.busy) MCUI.btn('g-cancel', rx + 20, ly, rw - 40, 56, 'CANCEL', cancelGoogle, { tone: 'gold' });
  else if (pf.avail === 'down') { MCUI.text('CAN\'T REACH SERVER RIGHT NOW', rx + rw / 2, ly + 8, 8, '#FF4D4D', 'center', rw - 40); MCUI.btn('g-retry', rx + 20, ly + 24, rw - 40, 56, 'RETRY', checkSignIn, { tone: 'gold' }); }
  else if (pf.avail === 'no') MCUI.text('SIGN-IN NOT AVAILABLE RIGHT NOW', rx + rw / 2, ly + 8, 8, '#FF4D4D', 'center', rw - 40);
  else if (pf.msg) MCUI.text(pf.msg, rx + rw / 2, ly + 8, 8, pf.msgCol, 'center', rw - 40);
  ly = y + ph - 76;
  MCUI.btn('guest', rx + 20, ly, rw - 40, 56, 'OR JUST PLAY AS A GUEST', back, { tone: 'go' });
  MCUI.para('GUESTS KEEP PLAYING FULLY OFFLINE · NO PASSWORD EVER', tall ? 16 : 40, tall ? y + ph + 20 : 528, tall ? V.w - 32 : 720, 8, '#ddd', 'center', 16);
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['ARROWS', 'MOVE']]);
}

/* ───────────── R0 profile view ───────────── */
function stageStat(i, x, y, w, h, d) {
  const s2 = STAGES[i], played2 = d.best[i] > 0 || d.stars[i] > 0, fill = played2 ? s2.bg[0] : '#5a5870', ink = played2 && lightOn(fill) ? INK : '#fff';
  MCUI.notch(x - 2, y - 2, w + 4, h + 4, 2, INK); MCUI.notch(x, y, w, h, 0, fill);
  MCUI.text(String(i + 1), x + 6, y + 10, 8, ink, 'left');
  if (d.stageRanks && d.stageRanks[i]) MCUI.text('#' + d.stageRanks[i], x + w - 6, y + 10, 8, ink === INK ? '#7a4a00' : '#FFE14D', 'right');
  MCUI.text(played2 ? String(d.best[i]) : '-', x + w / 2, y + h / 2 + 2, 16, ink, 'center', w - 8);
  for (let k = 0; k < 3; k++) MCUI.icon('star', x + w / 2 + (k - 1) * 16, y + h - 10, 2, k < d.stars[i] ? '#FFE14D' : 'rgba(20,16,28,.35)');
}
function colourRow(x, y, w) {
  const n = AVATAR_COLORS.length, gap = 8, sw = Math.min(52, Math.floor((w - gap * (n - 1)) / n));
  AVATAR_COLORS.forEach((c, i) => MCUI.tile('col-' + i, x + i * (sw + gap), y, sw, 48, c, (dy, f) => {
    if (c === net.user.color) MCUI.iconInk('check', x + i * (sw + gap) + sw / 2, y + 24 + dy, 3, '#fff');
  }, () => pickColor(c), { depth: 4 }));
}
function drawPview() {
  const V = MCUI.view(), tall = V.tall, d = pv.data, me = !!net.user && pv.name === net.user.username;
  MCUI.bg('menu');
  MCUI.header(me ? 'MY PROFILE' : pv.name || 'PROFILE', { col: d && !me ? d.color : undefined });
  MCUI.back(back, 'GO BACK');
  kitChip();
  if (!d) {
    MCUI.text(pv.loading ? 'LOADING...' : pv.err, V.w / 2, 280, 16, pv.loading ? '#fff' : '#FF4D4D', 'center', V.w - 32);
    if (!pv.loading) MCUI.btn('pv-retry', (V.w - 200) / 2, 320, 200, 56, 'RETRY', () => openProfile(pv.name), { tone: 'gold' });
    return;
  }
  // top block: you, your name, your rank, the follow / sign-in action for other players
  const x = tall ? 16 : 40, w = tall ? V.w - 32 : 720, jump = Math.floor(Math.abs(Math.sin(now * 3)) * 3) * 4;
  if (me) drawMe(x + 52, 216 - jump, 6, d.color, 'happy'); else caos(x + 52, 216 - jump, 6, { col: d.color, mood: 'happy' });
  MCUI.text(d.username, x + 112, 132, tall ? 16 : 32, d.color, 'left', w - 112 - (tall ? 0 : 216));
  MCUI.text(d.rank ? t('RANK #{rank} · TOTAL {total}', { rank: d.rank, total: d.total }) : 'NOT RANKED YET', x + 112, 172, 8, '#fff', 'left', w - 112);
  MCUI.iconInk('star', x + 120, 200, 2, '#FFE14D');
  MCUI.text(t('{stars}/{max} STARS · {unlocked}/{stages} UNLOCKED', { stars: d.totalStars, max: STAGES.length * 3, unlocked: d.unlocked, stages: STAGES.length }), x + 136, 200, 8, '#ddd', 'left', w - 136);
  if (!me) {
    const bx = tall ? x + 112 : x + w - 200, by = tall ? 220 : 116, bw = tall ? w - 112 : 200;
    if (!net.user) MCUI.btn('pv-follow', bx, by, bw, 52, 'SIGN IN TO FOLLOW', goProfile, { tone: 'gold', size: 8 });
    else if (fr.list) {
      const rl = frRel(d.uid), fol = !!(rl && rl.following), mut = fol && rl.followsMe;
      MCUI.btn('pv-follow', bx, by, bw, 52, fr.busy ? '...' : mut ? 'FRIENDS' : fol ? 'FOLLOWING' : rl && rl.followsMe ? 'FOLLOW BACK' : 'FOLLOW', () => followToggle(d.uid, d.username), { tone: fol ? 'gold' : 'go', icon: mut ? 'check' : null, size: 16, prime: true });
    }
  }
  const tabs = me ? ['STATS', 'UNLOCKS', 'EDIT'] : ['STATS', 'UNLOCKS'];
  if (pvTab >= tabs.length) pvTab = 0;
  const ty = tall ? 288 : 240;
  MCUI.tabBar('pvtab', x, ty, w, 52, tabs, pvTab, i => { pvTab = i; }, ['star', 'lock', 'gear']);
  const top = ty + 68;
  if (pvTab === 0) {
    const cols = tall ? 4 : 7, gap = 8, cw = Math.floor((w - gap * (cols - 1)) / cols), ch = 64, rows = Math.ceil(STAGES.length / cols);
    const off = tall ? MCUI.scrollStart('pvstats', top, V.h - 8, rows * (ch + gap)) : 0;
    STAGES.forEach((s2, i) => stageStat(i, x + (i % cols) * (cw + gap), top + (i / cols | 0) * (ch + gap) + off, cw, ch, d));
    if (tall) MCUI.scrollEnd();
  } else if (pvTab === 1) {
    const ls = localStats(), rows = [
      ['CLASSIC', t('{n}/{total} STAGES', { n: d.unlocked, total: STAGES.length }), MCUI.WORLD.classic],
      ['VENEZUELA', me ? t('{n}/15 STARS ON THIS DEVICE', { n: ls.ve }) : 'PLAYED ON THEIR DEVICE', MCUI.WORLD.venezuela],
      ['LA FIESTA', 'ONLINE · 2-4 PLAYERS', MCUI.WORLD.fiesta],
      ['MARGARITA', LOCAL_DEV ? '1 + 3 CPU' : 'COMING SOON', MCUI.WORLD.margarita],
    ];
    rows.forEach((r, i) => {
      const y = top + i * 60;
      MCUI.panel(x, y, w, 48, { tone: 'panelDk' }); MCUI.notch(x, y, 12, 48, 0, r[2]);
      MCUI.text(r[0], x + 28, y + 24, 16, '#fff', 'left', w * .45);
      MCUI.text(r[1], x + w - 16, y + 24, 8, '#ddd', 'right', w * .5);
    });
  } else {
    const off = tall ? MCUI.scrollStart('pvedit', top, V.h - 8, 400) : 0;
    let y = top + off;
    MCUI.text('CHARACTER', x, y + 10, 8, '#ddd', 'left'); MCUI.text('COLOUR', tall ? x : x + 376, tall ? y + 100 : y + 10, 8, '#ddd', 'left');
    charPicker(x, y + 24, tall ? w : 344);
    colourRow(tall ? x : x + 376, tall ? y + 116 : y + 28, tall ? w : 344);
    y += tall ? 188 : 104;
    const bw = tall ? w : (w - 32) / 3;
    [['pv-rename', 'CHANGE NAME', openRename, 'gold'], ['pv-friends', 'MY FRIENDS', goFriends, 'lilac'], ['pv-logout', 'LOG OUT', doLogout, 'bad']].forEach((b, i) =>
      MCUI.btn(b[0], tall ? x : x + i * (bw + 16), tall ? y + i * 72 : y, bw, 60, b[1], b[2], { tone: b[3] }));
    if (tall) MCUI.scrollEnd();
  }
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['Q/E', 'TAB']]);
  if (rn.on && me) {
    nameSlot = MCUI.dialog({ title: 'CHANGE NAME', body: '3-16 LETTERS, NUMBERS, _ -', input: { focus: () => inName.focus() }, msg: rn.msg, msgCol: rn.msg === 'ONE MOMENT...' ? '#fff' : '#FF4D4D',
      buttons: [{ label: rn.busy ? '...' : 'SAVE', fn: doRename, tone: 'go' }, { label: 'CANCEL', fn: closeRename }] });
  }
}
