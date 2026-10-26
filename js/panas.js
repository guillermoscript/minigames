'use strict';
/* FIESTA CON PANAS on the menu kit (docs/ui/01-menu-redesign.md §1): P0 the hub (create a room, join with a code, invite, friends),
   P2 invite (QR + link + chat apps) and P3 my friends. Room logic stays in js/party.js and the follow logic in js/main.js;
   this file only draws and routes. The room lobby itself (party.view lobby / between / end) is still js/party.js's screen. */
let panasKind = 'party', codeSlot = null, friendSlot = null, inviteFrom = 'main', frMsgSeen = '';
const panasMenuOn = () => state === 'party' && (!party.room || party.view === 'menu' || party.view === 'joining');

/* ───────────── P0 hub ───────────── */
function panasCreate() {
  if (panasKind === 'fiesta') { chooseFiesta(); return; }   // LA FIESTA rooms are made in its own lobby (worlds/venezuela/fiesta.html)
  partyCreate();
}
/* one JOIN box for both kinds of room: ask the server which kind the code is, LA FIESTA codes go to their page */
async function panasJoin() {
  const code = String(inCode ? inCode.value : '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) { party.msg = 'TYPE THE 4-LETTER ROOM CODE'; party.msgCol = '#FF4D4D'; return; }
  if (party.busy) return;
  party.msg = 'ONE MOMENT...'; party.msgCol = '#fff';
  let kind = 'party';
  try { const r = await fetch(API_BASE + '/api/party/kind/' + code); if (r.ok) kind = (await r.json()).kind || 'party'; } catch (e) {}   // unknown: the normal join explains the error
  if (inCode) inCode.blur();
  if (kind === 'fiesta') { track('party_join_route', { kind }); party.msg = ''; kitLeave('worlds/venezuela/fiesta.html?r=' + code + '&lang=' + encodeURIComponent(I18N.lang), MCUI.WORLD.fiesta); return; }
  partyJoin(code);
}
/* the dark slot the DOM code / name <input> sits in (placed by placeInputs in js/main.js); hidden when scrolled out of view */
function inputSlot(id, x, y, w, h, input, clip) {
  MCUI.notch(x - 4, y - 4, w + 8, h + 8, 4, INK); MCUI.notch(x, y, w, h, 0, '#171c34');
  MCUI.area(id, x, y, w, h, () => { if (input) input.focus(); }, { focus: true });
  return !clip || (y >= clip[0] && y + h <= clip[1]) ? [x, y, w, h] : null;
}
function panasBoxes(x, y, w, gap, clip) {
  const bw = Math.floor((w - 48 - 12) / 2);
  MCUI.panel(x, y, w, 196, { band: MCUI.TONE.go });
  MCUI.text('CREATE A ROOM', x + 24, y + 34, 16, MCUI.TONE.go, 'left', w - 48);
  [['party', 'MICROGAMES'], ['fiesta', 'LA FIESTA']].forEach(([k, lab], i) =>
    MCUI.btn('kind-' + k, x + 24 + i * (bw + 12), y + 60, bw, 52, lab, () => { panasKind = k; }, { tone: panasKind === k ? 'gold' : 'paper', icon: panasKind === k ? 'check' : null }));
  MCUI.btn('create', x + 24, y + 124, w - 48, 56, party.busy ? '...' : 'CREATE ROOM', panasCreate, { tone: 'go', icon: 'right', prime: true });
  y += 196 + gap;
  MCUI.panel(x, y, w, 172, { band: MCUI.TONE.info });
  MCUI.text('JOIN WITH CODE', x + 24, y + 34, 16, MCUI.TONE.info, 'left', w - 48);
  codeSlot = inputSlot('code', x + 24, y + 60, w - 48 - 100, 64, inCode, clip);
  MCUI.btn('join', x + w - 24 - 88, y + 60, 88, 64, '', panasJoin, { tone: 'info', icon: 'right' });
  MCUI.para('THE 4 LETTERS YOUR FRIEND SENT YOU', x + 24, y + 146, w - 48, 8, '#ddd', 'left', 14);
  return y + 172 + gap;
}
function drawPanas() {
  const V = MCUI.view(), pend = net.user && fr.list ? frPending() : 0, idn = partyIdentity();
  MCUI.bg('menu');
  MCUI.header('PARTY WITH FRIENDS');
  MCUI.back(partyHome, 'GO BACK');
  kitChip();
  const me = (x, y, w) => {
    caos(x + 24, y + 30, 2.6, { col: idn.color, mood: 'happy' });
    MCUI.text(t('PLAYING AS {name}', { name: idn.name.toUpperCase() }), x + 52, y + 12, 16, idn.color, 'left', w - 56);
    MCUI.text(net.user ? 'READY TO PLAY WITH YOUR PROFILE.' : 'NO ACCOUNT NEEDED TO PLAY.', x + 52, y + 36, 8, '#ddd', 'left', w - 56);
  };
  const msg = y => { if (party.msg) MCUI.text(party.msg, V.w / 2, y, 16, party.msgCol || '#fff', 'center', V.w - 32); };
  if (V.tall) {
    const top = 104, off = MCUI.scrollStart('panas', top, V.h - 8, 8 + 196 + 172 + 2 * 16 + 2 * 88 + 120);
    let y = panasBoxes(16, top + 8 + off, V.w - 32, 16, [top, V.h - 8]);
    MCUI.btn('p-invite', 16, y, V.w - 32, 72, 'INVITE A FRIEND', goInvite, { icon: 'share', tone: 'info', align: 'left' }); y += 88;
    MCUI.btn('p-friends', 16, y, V.w - 32, 72, 'MY FRIENDS', goFriends, { icon: 'friends', tone: 'lilac', align: 'left', dot: pend }); y += 92;
    me(16, y, V.w - 32); msg(y + 72);
    MCUI.scrollEnd();
    return;
  }
  panasBoxes(40, 112, 344, 24);   // left column: create, then join; right column: invite, friends, who you play as
  MCUI.btn('p-invite', 416, 112, 344, 72, 'INVITE A FRIEND', goInvite, { icon: 'share', tone: 'info', align: 'left' });
  MCUI.btn('p-friends', 416, 204, 344, 72, 'MY FRIENDS', goFriends, { icon: 'friends', tone: 'lilac', align: 'left', dot: pend });
  me(416, 420, 344);
  msg(540);
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['ARROWS', 'MOVE']]);
}

/* ───────────── P2 invite ───────────── */
let qrP = null, qrCache = null;
function loadQR() {
  if (typeof qrcode !== 'undefined') return Promise.resolve();
  return qrP || (qrP = new Promise(res => {
    const sc = document.createElement('script'); sc.src = 'js/vendor/qrcode.js?v=1791700000';
    sc.onload = sc.onerror = () => res(); document.head.appendChild(sc);
  }));
}
function qrMatrix(url) {
  if (qrCache && qrCache.url === url) return qrCache.m;
  if (typeof qrcode === 'undefined') return null;
  const q = qrcode(0, 'M'); q.addData(url); q.make();
  const n = q.getModuleCount(), m = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
  qrCache = { url, m }; return m;
}
/* pixel QR on a paper plate: whole-pixel modules, 4-module quiet zone */
function drawQR(x, y, size, url) {
  MCUI.plate(x, y, size, size, '#fffdf2', { depth: 6 });
  const m = qrMatrix(url);
  if (!m) { MCUI.text('LOADING...', x + size / 2, y + size / 2, 8, INK); return; }
  const n = m.length + 8, u = Math.floor((size - 8) / n), x0 = x + Math.floor((size - u * n) / 2) + 4 * u, y0 = y + Math.floor((size - u * n) / 2) + 4 * u;
  ctx.fillStyle = INK;
  m.forEach((row, r) => row.forEach((d, c) => { if (d) ctx.fillRect(x0 + c * u, y0 + r * u, u, u); }));
}
const inviteUrl = () => party.room ? location.origin + '/r/' + party.room.code : gameUrl();
const inviteLine = () => t('MiniCaos: 100+ five-second microgames. Come play!');
function goInvite() {
  if (state !== 'invite') inviteFrom = state;
  state = 'invite'; st = 0; loadQR(); track('invite_open', { from: inviteFrom });
}
async function copyInvite() {
  const s = inviteLine() + ' ' + inviteUrl();
  let ok = false;
  try { await navigator.clipboard.writeText(s); ok = true; } catch (e) {
    try { const ta = document.createElement('textarea'); ta.value = s; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) {}
  }
  track('share_result', { surface: 'invite', result: ok ? 'copied' : 'failed', method: 'copy' });
  say(ok ? 'LINK COPIED! SEND IT TO A FRIEND' : 'COULDN\'T COPY', ok ? '#5CFF7A' : '#FF4D4D');
}
function inviteVia(tg) {
  track('share_result', { surface: 'invite', result: 'opened', method: tg.id });
  try { window.open(tg.href(inviteLine(), inviteUrl()), '_blank', 'noopener'); } catch (e) {}
}
function drawInvite() {
  const V = MCUI.view(), url = inviteUrl(), host = url.replace(/^https?:\/\//, '');
  MCUI.bg('menu');
  MCUI.header('INVITE');
  MCUI.back(() => { state = inviteFrom; st = 0; }, 'GO BACK');
  kitChip();
  const actions = [];
  if (navigator.share) actions.push(['i-share', 'SHARE', () => doShare('invite'), 'go', 'share']);
  actions.push(['i-copy', 'COPY LINK', copyInvite, 'gold', 'right']);
  SHARE_TARGETS.slice(0, navigator.share ? 2 : 3).forEach(tg => actions.push(['i-' + tg.id, tg.label, () => inviteVia(tg), tg.id === 'whatsapp' ? 'go' : tg.id === 'telegram' ? 'info' : 'paper']));
  if (V.tall) {
    const top = 104, size = 232, off = MCUI.scrollStart('invite', top, V.h - 8, 16 + size + 120 + actions.length * 72);
    drawQR((V.w - size) / 2, top + 16 + off, size, url);
    let y = top + 16 + size + 28 + off;
    MCUI.text('SCAN IT OR SEND THE LINK', V.w / 2, y, 16, '#fff', 'center', V.w - 32);
    MCUI.text(host, V.w / 2, y + 30, 8, '#FFE14D', 'center', V.w - 32); y += 56;
    actions.forEach((a, i) => MCUI.btn(a[0], 16, y + i * 72, V.w - 32, 60, a[1], a[2], { tone: a[3], icon: a[4], prime: i === 0 }));
    MCUI.scrollEnd();
    return;
  }
  drawQR(48, 120, 296, url);
  MCUI.para('SCAN IT OR SEND THE LINK', 392, 132, 368, 16, '#fff', 'left', 24);
  MCUI.panel(392, 184, 368, 40, { tone: 'panelDk' });
  MCUI.text(host, 576, 204, 16, '#FFE14D', 'center', 352);
  actions.forEach((a, i) => MCUI.btn(a[0], 392 + (i % 2) * 192, 252 + (i / 2 | 0) * 76, 176, 60, a[1], a[2], { tone: a[3], icon: a[4], prime: i === 0 }));
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'CHOOSE'], ['ARROWS', 'MOVE']]);
}

/* ───────────── P3 my friends ───────────── */
function friendRow(f, x, y, w) {
  const act = fr.tab === 2 && !f.following, mut = f.following && f.followsMe, rw = act ? w - 160 : w;
  MCUI.tile('f-' + f.uid, x, y, rw, 52, '#35406a', dy => {
    caos(x + 28, y + 44 + dy, 2.2, { col: f.color });
    MCUI.text(f.username, x + 56, y + 18 + dy, 16, f.color, 'left', rw - 150);
    if (mut) MCUI.icon('check', x + 60, y + 38 + dy, 2, '#5CFF7A');
    MCUI.text(mut ? 'FRIENDS' : f.following ? 'FOLLOWING' : 'FOLLOWS YOU', x + (mut ? 72 : 56), y + 38 + dy, 8, mut ? '#5CFF7A' : f.following ? '#FFE14D' : '#ddd', 'left', 160);
    MCUI.text(String(f.total), x + rw - 14, y + 27 + dy, 16, '#fff', 'right');
  }, () => openProfile(f.username), { depth: 4 });
  if (act) MCUI.btn('fb-' + f.uid, x + w - 148, y, 148, 52, 'FOLLOW BACK', () => followToggle(f.uid, f.username), { tone: 'go', size: 8 });
}
function drawFriends() {
  const V = MCUI.view(), tall = V.tall;
  MCUI.bg('menu');
  MCUI.header('MY FRIENDS');
  MCUI.back(back, 'GO BACK');
  kitChip();
  if (fr.msg !== frMsgSeen) { frMsgSeen = fr.msg; if (fr.msg) MCUI.toast(fr.msg, fr.msg === 'ONE MOMENT...' ? 'paper' : 'bad'); }
  if (!net.user) {
    caos(V.w / 2, 260, 6, { mood: 'happy' });
    MCUI.para('SIGN IN WITH GOOGLE TO FOLLOW PLAYERS', 32, 300, V.w - 64, 16, '#fff', 'center', 24);
    MCUI.para('FOLLOW EACH OTHER = FRIENDS', 32, 360, V.w - 64, 8, '#ddd', 'center', 16);
    MCUI.btn('f-profile', (V.w - 280) / 2, 400, 280, 64, 'MY PROFILE', goProfile, { tone: 'go', prime: true });
    return;
  }
  const x = tall ? 16 : 40, w = tall ? V.w - 32 : 720;
  const tabs = [0, 1, 2].map(i => t(FR_TABS[i], { n: fr.list ? frOf(i).length : '-' }));
  let y0;
  if (tall) {
    friendSlot = inputSlot('f-search', x, 112, w - 112, 56, inFriend);
    MCUI.btn('f-go', x + w - 100, 112, 100, 56, '', doAddFriend, { tone: 'go', icon: 'right' });
    MCUI.tabBar('ftab', x, 184, w, 52, tabs, fr.tab, i => { fr.tab = i; fr.page = 0; });
    y0 = 252;
  } else {
    MCUI.text('SEARCH BY PLAYER NAME', x, 104, 8, '#ddd', 'left');
    friendSlot = inputSlot('f-search', x, 116, w - 200, 52, inFriend);
    MCUI.btn('f-go', x + w - 184, 116, 184, 52, fr.busy && !fr.found ? 'SEARCHING...' : 'SEARCH', doAddFriend, { tone: 'go' });
    MCUI.tabBar('ftab', x, 188, w, 52, tabs, fr.tab, i => { fr.tab = i; fr.page = 0; });
    y0 = 256;
  }
  if (fr.found) {
    const rel = frRel(fr.found.uid), following = !!(rel && rel.following);
    MCUI.panel(x, y0, w, 52, { tone: 'panelDk', band: MCUI.TONE.gold });
    MCUI.text(fr.found.username, x + 16, y0 + 30, 16, '#fff', 'left', w - 220);
    MCUI.btn('f-found', x + w - 184, y0 + 6, 176, 40, following ? 'FOLLOWING' : rel && rel.followsMe ? 'FOLLOW BACK' : 'FOLLOW',
      () => following ? openProfile(fr.found.username) : followToggle(fr.found.uid, fr.found.username), { tone: following ? 'gold' : 'go', size: 8, prime: true });
    y0 += 68;
  }
  if (!fr.list) {
    if (fr.err) { MCUI.text(fr.err, V.w / 2, y0 + 60, 16, '#FF4D4D', 'center', V.w - 32); MCUI.btn('f-retry', (V.w - 200) / 2, y0 + 96, 200, 56, 'RETRY', loadFriends, { tone: 'gold' }); }
    else MCUI.text('LOADING...', V.w / 2, y0 + 60, 16, '#fff');
    return;
  }
  const list = frOf(fr.tab);
  if (!list.length) {
    MCUI.para(fr.tab === 0 ? 'NO FRIENDS YET' : fr.tab === 1 ? 'YOU\'RE NOT FOLLOWING ANYONE' : 'NOBODY FOLLOWS YOU YET', x, y0 + 40, w, 16, '#fff', 'center', 24);
    MCUI.para('SEARCH FOR A PLAYER ABOVE TO GET STARTED', x, y0 + 96, w, 8, '#ddd', 'center', 16);
    return;
  }
  if (tall) {
    const off = MCUI.scrollStart('friends', y0, V.h - 8, list.length * 64 + 16);
    list.forEach((f, i) => friendRow(f, x, y0 + 4 + i * 64 + off, w));
    MCUI.scrollEnd();
    return;
  }
  const per = fr.found ? 3 : 4, pages = pageCount(list.length, per); fr.page = Math.min(fr.page, pages - 1);
  list.slice(fr.page * per, fr.page * per + per).forEach((f, i) => friendRow(f, x, y0 + i * 62, w));
  MCUI.pager('fpage', W / 2, 504, fr.page, pages, p => { fr.page = p; }, 'f-');
  MCUI.keybar([['ESC', 'GO BACK'], ['ENTER', 'SEE PROFILE'], ['Q/E', 'TAB']]);
}
