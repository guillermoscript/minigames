'use strict';
/* Game flow: title → stage select / practice → stage intro → microgames → boss → clear / game over.
   Input: mouse, keyboard and touch all arrive as pointer + key events and are forwarded to the active microgame. */

/* ───────────── save data ───────────── */
const SAVE_KEY = 'claudeware-save-v2';
let save = { unlocked: 1, stars: [], best: [] };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.stars) save = Object.assign(save, s); } catch (e) {}
while (save.stars.length < STAGES.length) save.stars.push(0);
while (save.best.length < STAGES.length) save.best.push(0);
if (typeof location !== 'undefined' && /[?&]unlock/.test(location.search)) save.unlocked = STAGES.length;
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

/* ───────────── online profile glue (all optional; see js/api.js) ───────────── */
const progressOfSave = () => ({ unlocked: save.unlocked, stars: save.stars.slice(0, STAGES.length), best: save.best.slice(0, STAGES.length) });
/* merge server progress into the local save (max), persist, and push the merged result back up */
async function syncProgress(serverProg) {
  await api.mergeProgress(save, serverProg); persist();
  api.pushProgress(progressOfSave()); api.flushQueue();
}
let runRank = null, toast = null;       // rank info for the current run, transient message
const say = (s, col = '#5CFF7A') => { toast = { s, col, t: 0 }; };
function submitRun(starsEarned) {
  runRank = null;
  if (!net.user || score <= 0) return;
  const i = stageIdx; runRank = { stage: i, loading: true };
  api.pushProgress(progressOfSave());
  api.submitScore(i, Math.min(score, 2000), starsEarned).then(r => {
    if (runRank && runRank.stage === i) runRank = r ? Object.assign({ stage: i }, r) : { stage: i, queued: true };
    if (!r && net.lastStatus === 429) say('SLOW DOWN', '#FFE14D');
  });
}
if (net.user) api.me().then(r => { if (r.ok) syncProgress(r.data.progress); });

/* ───────────── state ───────────── */
let state = 'title', st = 0, mode = 'stage';
let stageIdx = 0, stage = STAGES[0], lives = 4, played = 0, score = 0, lastOut = null, stars = 0;
let cur = null, t = 0, dur = 5, outcome = null, outT = 0, tickN = 0, recent = [], isBoss = false;
let practiceId = 'swat', practiceSp = 1, menuPage = 0, practicePage = 0;
const PER_MENU = 6, PER_PRACTICE = 30;
const pageCount = (n, per) => Math.ceil(n / per);
let btns = [];
/* profile / leaderboard UI state */
let from = { profile: 'menu', board: 'menu', pview: 'menu' };
let pf = { avail: 'loading', busy: false, msg: '', msgCol: '#FF4D4D' };   // Google sign-in screen
let rn = { on: false, busy: false, msg: '' };                              // CHANGE NAME dialog
let lb = { tab: 0, page: 0, cache: {} };
let pv = { name: '', data: null, err: '', loading: false };
const PER_TABS = 6;
const inName = document.getElementById('in-name'), ov = document.getElementById('ov');

const speed = () => stage.sp0 + Math.floor(played / 2) * .1;
const poolOf = s => s.pool || REG.map(r => r.id);

function goProfile() {
  if (net.user) return openProfile(net.user.username);
  from.profile = state; state = 'profile'; st = 0; pf.msg = '';
  if (!pf.busy) checkSignIn();
}
/* is Google sign-in switched on at the server? (drives the button / "not available" state) */
function checkSignIn() {
  pf.avail = 'loading';
  api.authMethods().then(m => { pf.avail = m.ok ? (m.available ? 'yes' : 'no') : 'down'; });
}
function openProfile(name) {
  if (state !== 'pview' && state !== 'profile') from.pview = state;
  rn.on = false; state = 'pview'; st = 0; pv = { name, data: null, err: '', loading: true };
  api.profile(name).then(r => { if (pv.name !== name) return; pv.loading = false; if (r.ok) pv.data = r.data; else pv.err = r.status === 404 ? 'NO SUCH PLAYER' : 'CAN\'T REACH SERVER'; });
}
function loadBoard(tab) {
  const c = lb.cache[tab] = lb.cache[tab] || {}; if (c.loading) return; c.loading = true; c.err = '';
  api.leaderboard(tab === STAGES.length ? 'total' : tab).then(r => {
    c.loading = false; if (r.ok) { c.data = r.data; c.err = ''; } else c.err = r.status === 0 ? 'CAN\'T REACH SERVER' : (r.data.error || 'ERROR').toUpperCase();
  });
}
function setTab(i) { const n = STAGES.length + 1; lb.tab = (i + n) % n; lb.page = lb.tab / PER_TABS | 0; loadBoard(lb.tab); }
function goBoard(tab) {
  if (state !== 'pview') from.board = state;
  state = 'board'; st = 0; setTab(tab == null ? Math.min(lb.tab, STAGES.length) : tab);
}
function back() {
  if (state === 'profile') { state = from.profile; }
  else if (state === 'board') { state = from.board; }
  else if (state === 'pview') { state = from.pview; if (state === 'board') st = 1; }
  if (state === 'board') loadBoard(lb.tab);
  st = 0;
}
/* must run synchronously inside the click/key handler so the popup isn't blocked */
async function doGoogle() {
  if (pf.busy) return;
  if (pf.avail === 'no') return;
  let w = null;
  try { w = window.open('', 'claudeware-google', 'popup=yes,width=500,height=680'); } catch (e) {}
  if (!w) { pf.msg = 'POPUP BLOCKED - ALLOW POPUPS & TRY AGAIN'; pf.msgCol = '#FF4D4D'; return; }
  pf.busy = true; pf.msg = 'WAITING FOR GOOGLE...'; pf.msgCol = '#fff';
  const r = await api.googleSignIn(w);
  pf.busy = false;
  if (!r.ok) {
    if (r.unavailable) pf.avail = 'no';
    pf.msg = r.cancelled ? 'CANCELLED - NO WORRIES, KEEP PLAYING' : r.status === 0 && /unreachable/i.test(r.data.error) ? 'CAN\'T REACH SERVER - PLAY AS GUEST' : (r.data.error || 'ERROR').toUpperCase();
    pf.msgCol = r.cancelled ? '#FFE14D' : '#FF4D4D'; return;
  }
  await syncProgress(r.data.progress);
  lb.cache = {};
  if (r.data.isNew) { say('WELCOME! PICK A NAME & COLOUR', '#5CFF7A'); openProfile(r.data.user.username); }
  else { say('WELCOME BACK, ' + r.data.user.username.toUpperCase() + '!'); state = from.profile === 'profile' ? 'menu' : from.profile; st = 0; }
}
function cancelGoogle() { api.cancelOAuth(); }
function openRename() { rn = { on: true, busy: false, msg: '' }; inName.value = net.user ? net.user.username : ''; setTimeout(() => { inName.focus(); inName.select(); }, 0); }
function closeRename() { rn.on = false; inName.blur(); }
async function doRename() {
  if (rn.busy) return;
  const n = inName.value.trim();
  if (net.user && n === net.user.username) return closeRename();
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(n)) { rn.msg = 'NAME: 3-16 LETTERS, NUMBERS, _ -'; return; }
  rn.busy = true; rn.msg = 'ONE MOMENT...';
  const r = await api.rename(n);
  rn.busy = false;
  if (!r.ok) { rn.msg = (r.status === 0 ? 'CAN\'T REACH SERVER' : r.status === 429 ? 'SLOW DOWN - TRY AGAIN IN A MOMENT' : (r.data.error || 'ERROR')).toUpperCase().replace('USERNAME TAKEN', 'USERNAME TAKEN - TRY ANOTHER'); return; }
  closeRename(); lb.cache = {}; say('NAME CHANGED!');
  openProfile(net.user.username);
}
async function doLogout() { closeRename(); await api.logout(); runRank = null; lb.cache = {}; say('LOGGED OUT', '#FFE14D'); state = 'menu'; st = 0; }
function pickColor(c) {
  if (net.user && state === 'pview' && pv.name === net.user.username) {
    api.setColor(c).then(r => { if (r.ok) { if (pv.data) pv.data.color = c; lb.cache = {}; } else say('COULD NOT SAVE COLOUR', '#FF4D4D'); });
    net.user.color = c; if (pv.data) pv.data.color = c;
  }
}

function goTitle() { state = 'title'; st = 0; }
function goMenu() { state = 'menu'; st = 0; mode = 'stage'; parts.length = 0; }
function goPractice() { state = 'practice'; st = 0; mode = 'practice'; parts.length = 0; }
function startStage(i) {
  if (i > save.unlocked - 1) return;
  runRank = null;
  mode = 'stage'; stageIdx = i; stage = STAGES[i]; lives = 4; played = 0; score = 0; lastOut = null; recent = [];
  state = 'stagein'; st = 0; jingleGo();
}
function startPractice(id) { mode = 'practice'; practiceId = id; lastOut = null; stage = STAGES[0]; state = 'inter'; st = 0; }
function toInter() { state = 'inter'; st = 0; if (mode !== 'practice') jingleGo(); }

function beginGame() {
  let s;
  if (mode === 'practice') {
    s = practiceSp; cur = REGMAP[practiceId].fn(s); isBoss = false; dur = cur.dur / Math.sqrt(s);
  } else if (played >= stage.n) {
    s = stage.sp0 + Math.floor(stage.n / 2) * .1; cur = BOSSES[stage.boss](s, stage); isBoss = true; dur = cur.dur;
  } else {
    const pool = poolOf(stage); let id;
    do { id = pool[Math.random() * pool.length | 0]; } while (recent.includes(id));
    recent.push(id); if (recent.length > Math.min(6, pool.length - 2)) recent.shift();
    s = speed(); cur = REGMAP[id].fn(s); isBoss = false; dur = cur.dur / Math.sqrt(s);
  }
  t = 0; outcome = null; outT = 0; tickN = 0; state = 'play';
}
function setOutcome(r) {
  outcome = r; outT = 0;
  if (r === 'win') { if (mode === 'stage') score += 100 + Math.round((1 - t / dur) * 50); jingleWin(); confetti(W / 2, H / 2, 45); }
  else { if (mode === 'stage') lives--; jingleLose(); }
}
function clearStage() {
  stars = lives >= 3 ? 3 : lives >= 2 ? 2 : 1;
  save.stars[stageIdx] = Math.max(save.stars[stageIdx], stars);
  save.best[stageIdx] = Math.max(save.best[stageIdx], score);
  save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, stageIdx + 2)); persist();
  submitRun(stars);
  state = 'clear'; st = 0; jingleWin(); confetti(W / 2, 200, 60);
}
function toOver() { state = 'over'; st = 0; submitRun(0); }
function afterClear() { if (stageIdx < STAGES.length - 1) startStage(stageIdx + 1); else goMenu(); }
function exitPlay() { mode === 'practice' ? goPractice() : goMenu(); }

/* ───────────── update ───────────── */
function update(dt) {
  updateParts(dt); st += dt;
  if (state === 'stagein') { if (st > 2.2) toInter(); }
  else if (state === 'inter') { if (st > (mode === 'practice' ? .6 : 1.5)) beginGame(); }
  else if (state === 'play') {
    if (!outcome) {
      t += dt;
      const n = Math.floor(t * 2);
      if (n !== tickN) { tickN = n; snd(dur - t < 1.5 ? 900 : 480, .04, 'square', .035); }
    } else outT += dt;
    cur.update(dt, t);
    if (!outcome) {
      if (cur.result) setOutcome(cur.result);
      else if (t >= dur) { cur.result = cur.timeWin ? 'win' : 'lose'; setOutcome(cur.result); }
    } else if (outT > .95) {
      lastOut = outcome;
      if (mode === 'practice') { state = 'inter'; st = 0; }
      else if (isBoss) { if (outcome === 'win') clearStage(); else if (lives <= 0) toOver(); else toInter(); }
      else { played++; if (lives <= 0) toOver(); else toInter(); }
    }
  } else if (state === 'clear' && Math.random() < dt * 6) confetti(Math.random() * W, 100, 12);
}

/* ───────────── UI helpers ───────────── */
function button(x, y, w, h, label, fn, o = {}) {
  box(x, y, w, h, o.fill || '#fff', 5);
  txt(label, x + w / 2, y + h / 2 + 2, o.size || 26, o.col || INK, 'center', w - 16);
  btns.push({ x, y, w, h, fn });
}
/* logged-in badge (avatar-coloured Claude + name) or a PROFILE button for guests */
function profileBtn(x, y, w, h) {
  const u = net.user;
  box(x, y, w, h, '#fff', 5);
  claude(x + 30, y + h - 9, Math.max(2, h / 22), { col: u ? u.color : '#9a98ad' });
  txt(u ? u.username : 'PROFILE', x + 56 + (w - 62) / 2, y + h / 2 + 2, u ? 20 : 22, u ? u.color : INK, 'center', w - 68);
  btns.push({ x, y, w, h, fn: goProfile });
}
function drawToast(dt) {
  if (!toast) return; toast.t += dt; if (toast.t > 2.6) { toast = null; return; }
  const k = Math.min(1, toast.t / .15), y = H - 24 - (1 - k) * 30;
  ctx.save(); ctx.globalAlpha = toast.t > 2.2 ? (2.6 - toast.t) / .4 : 1; txt(toast.s, W / 2, y, 26, toast.col, 'center', 740); ctx.restore();
}
function swatches(cx, cy, r, gap, sel, fn) {
  AVATAR_COLORS.forEach((c, i) => {
    const x = cx + (i - (AVATAR_COLORS.length - 1) / 2) * gap;
    circ(x, cy, r, c, c === sel ? 6 : 3);
    if (c === sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy, r + 8, 0, 7); ctx.stroke(); }
    btns.push({ x: x - r - 6, y: cy - r - 6, w: 2 * r + 12, h: 2 * r + 12, fn: () => fn(c) });
  });
}
/* the multicolour Google "G", drawn on canvas (no external image); grey = disabled */
function googleG(cx, cy, r, grey) {
  const lw = r * .42, rr = r - lw / 2, d = Math.PI / 180, c = grey ? ['#9a98a8', '#aaa8b6', '#8e8c9c', '#9a98a8'] : ['#EA4335', '#FBBC05', '#34A853', '#4285F4'];
  ctx.save(); ctx.lineWidth = lw; ctx.lineCap = 'butt';
  const arc = (a0, a1, col) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, rr, a0 * d, a1 * d); ctx.stroke(); };
  arc(-135, -42, c[0]); arc(135, 225, c[1]); arc(42, 135, c[2]); arc(-2, 42, c[3]);
  ctx.fillStyle = c[3]; ctx.fillRect(cx, cy - lw / 2, r, lw);
  ctx.restore();
}
function placeInputs() {
  const show = state === 'pview' && rn.on && !!net.user;
  ov.style.display = show ? 'block' : 'none';
  if (!show) return;
  const r = cv.getBoundingClientRect(), k = r.width / W;
  const put = (el, x, y, w, h) => { const s = el.style; s.left = r.left + x * k + 'px'; s.top = r.top + y * k + 'px'; s.width = w * k + 'px'; s.height = h * k + 'px'; s.fontSize = h * k * .5 + 'px'; };
  put(inName, 200, 262, 400, 52);
}
function hintOf(g) {
  let h = (TOUCH && g.thint) || g.hint;
  if (TOUCH) h = h.replace(/CLICK/g, 'TAP').replace(/MOUSE/g, 'FINGER');
  return h;
}
function livesRow(x, y, u, gap, col) { for (let i = 0; i < 4; i++) claude(x + i * gap, y, u, { col: i < lives ? col : '#4a4558' }); }
function stars3(cx, cy, n, size, gap) { for (let i = 0; i < 3; i++) star(cx + (i - 1) * gap, cy, size, size * .45, 5, -Math.PI / 2, i < n ? '#FFE14D' : '#4a4558', 3); }
function fuse() {
  const f = Math.min(1, t / dur);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, H - 46, W, 46);
  const x0 = 24, x1 = W - 70, sx = x0 + (x1 - x0) * f, y = H - 23;
  ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 6; ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
  if (!outcome) star(sx, y, 14 + Math.random() * 6, 5, 8, now * 10, '#FFB020', 3);
  const shake = f > .75 && !outcome ? (Math.random() - .5) * 5 : 0;
  circ(W - 40 + shake, y, 19, f > .85 && Math.sin(now * 30) > 0 ? '#ff3b3b' : '#2b2b3a', 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 48 + shake, y - 8, 6, 6);
}

/* ───────────── render ───────────── */
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); btns = [];
  const col = mode === 'stage' ? stage.col : OR;

  if (state === 'title') {
    bg('#7C4DFF', '#6a3de8', now);
    ctx.save(); ctx.translate(W / 2, 130); ctx.rotate(Math.sin(now * 2) * .03); txt('CLAUDE', 0, 0, 120, '#FFE14D'); ctx.restore();
    ctx.save(); ctx.translate(W / 2, 250); ctx.rotate(-Math.sin(now * 2 + 1) * .03); txt('WARE!', 0, 0, 120, '#fff'); ctx.restore();
    claude(W / 2, 470 - Math.abs(Math.sin(now * 4)) * 30, 14, { mood: 'happy' });
    txt(`${REG.length} MICROGAMES · ${STAGES.length} STAGES · MOUSE + KEYBOARD + TOUCH`, W / 2, 505, 19, '#fff', 'center', 760);
    if (Math.sin(now * 6) > -.3) txt(TOUCH ? 'TAP TO START' : 'CLICK OR PRESS ENTER', W / 2, 558, 34, '#5CFF7A');
    txt('M = MUTE', 20, 28, 18, '#fff', 'left');
    profileBtn(W - 194, 12, 180, 52);
  } else if (state === 'menu') {
    bg('#2b2757', '#322d66', now);
    txt('SELECT STAGE', W / 2, 40, 44, '#FFE14D');
    STAGES.forEach((s, i) => {
      if ((i / PER_MENU | 0) !== menuPage) return;
      const k = i % PER_MENU, x = 20 + (k % 3) * 260, y = 95 + (k / 3 | 0) * 175, locked = i > save.unlocked - 1;
      box(x, y, 240, 155, locked ? '#5a5870' : s.bg[0], 5);
      claude(x + 62, y + 118 - (locked ? 0 : Math.abs(Math.sin(now * 3 + i)) * 6), 5.2, { col: locked ? '#7a7890' : s.col, mood: locked ? null : undefined });
      txt('STAGE ' + (i + 1), x + 14, y + 20, 17, '#fff', 'left');
      const words = s.name.split(' ');
      txt(words[0], x + 160, y + 58, 26, locked ? '#aaa' : '#fff', 'center', 150);
      if (words[1]) txt(words[1], x + 160, y + 90, 26, locked ? '#aaa' : '#fff', 'center', 150);
      if (locked) txt('LOCKED', x + 160, y + 130, 22, '#ddd');
      else stars3(x + 160, y + 128, save.stars[i], 14, 34);
      btns.push({ x, y, w: 240, h: 155, fn: () => startStage(i) });
    });
    const mp = pageCount(STAGES.length, PER_MENU);
    if (mp > 1) {
      button(20, 455, 74, 74, '◄', () => { menuPage = (menuPage + mp - 1) % mp; }, { size: 30, fill: '#FFE14D' });
      button(706, 455, 74, 74, '►', () => { menuPage = (menuPage + 1) % mp; }, { size: 30, fill: '#FFE14D' });
      txt(`PAGE ${menuPage + 1}/${mp}`, W / 2, 440, 18, '#fff');
    }
    profileBtn(14, 10, 170, 56);
    button(W - 184, 10, 170, 56, 'RANKS', () => goBoard(), { size: 22, fill: '#FFE14D' });
    button(110, 455, 280, 74, 'PRACTICE', goPractice, { fill: '#5CFF7A' });
    button(410, 455, 280, 74, 'TITLE', goTitle, { fill: '#fff' });
    if (!TOUCH) txt('1-6 STAGE · ◄ ► PAGE · P PRACTICE · L RANKS · A PROFILE · ESC BACK', W / 2, 568, 18, '#fff');
  } else if (state === 'practice') {
    bg('#1f2a44', '#26335a', now);
    txt('PRACTICE', W / 2, 38, 44, '#FFE14D');
    button(14, 10, 130, 56, '◄ BACK', goMenu, { size: 22 });
    button(W - 184, 10, 170, 56, 'SPEED x' + practiceSp, () => { practiceSp = practiceSp === 1 ? 1.5 : practiceSp === 1.5 ? 2 : 1; }, { size: 22, fill: '#FFE14D' });
    const pp = pageCount(REG.length, PER_PRACTICE);
    if (pp > 1) {
      button(150, 10, 56, 56, '◄', () => { practicePage = (practicePage + pp - 1) % pp; }, { size: 24 });
      button(W - 250, 10, 56, 56, '►', () => { practicePage = (practicePage + 1) % pp; }, { size: 24 });
      txt(`${practicePage + 1}/${pp}`, W / 2 + 120, 38, 20, '#fff');
    }
    REG.forEach((r, ri) => {
      if ((ri / PER_PRACTICE | 0) !== practicePage) return;
      const i = ri % PER_PRACTICE;
      const x = 26 + (i % 6) * 126, y = 92 + (i / 6 | 0) * 92;
      box(x, y, 118, 82, `hsl(${i * 12},70%,70%)`, 4);
      txt(r.name, x + 59, y + 41, 20, '#fff', 'center', 106);
      btns.push({ x, y, w: 118, h: 82, fn: () => startPractice(r.id) });
    });
  } else if (state === 'stagein') {
    bg(stage.bg[0], stage.bg[1], now);
    txt('STAGE ' + (stageIdx + 1), W / 2, 105, 90, '#fff');
    txt(stage.name, W / 2, 205, 64, '#FFE14D', 'center', 740);
    txt(stage.tag, W / 2, 275, 28, '#fff', 'center', 700);
    claude(W / 2, 480 - Math.abs(Math.sin(now * 5)) * 40, 16, { col: stage.col, mood: 'happy' });
    txt(`${stage.n} GAMES + BOSS`, W / 2, 545, 28, '#fff');
  } else if (state === 'inter') {
    const bossNext = mode === 'stage' && played >= stage.n;
    bg(bossNext ? (Math.sin(now * 12) > 0 ? '#3b0d14' : '#4d1119') : '#1b1b3a', bossNext ? '#5b1d2b' : '#26265a', now);
    let msg, mc = '#5CFF7A';
    if (mode === 'practice') { msg = 'READY?'; mc = '#FFE14D'; }
    else if (bossNext) { msg = lastOut === 'lose' ? 'AGAIN!' : 'BOSS!'; mc = '#FF4D4D'; }
    else if (played === 0) { msg = 'GET READY!'; mc = '#FFE14D'; }
    else if (played % 2 === 0) { msg = 'SPEED UP!'; mc = '#FFE14D'; }
    else if (lastOut === 'win') msg = 'NICE!';
    else { msg = 'OUCH!'; mc = '#FF4D4D'; }
    ctx.save(); ctx.translate(W / 2, 120); ctx.rotate(Math.sin(now * 8) * .04); txt(msg, 0, 0, 96, mc); ctx.restore();
    txt(mode === 'practice' ? REGMAP[practiceId].name : bossNext ? stage.name : `GAME ${played + 1} / ${stage.n}`, W / 2, 205, 36, '#fff', 'center', 700);
    const mood = !lastOut || msg === 'READY?' ? null : lastOut === 'win' ? 'happy' : 'sad';
    claude(W / 2, 400 - (mood === 'happy' ? Math.abs(Math.sin(now * 9)) * 40 : 0), 16, { col, mood });
    if (mode === 'stage') { livesRow(W / 2 - 108, 520, 3.2, 72, col); txt('SCORE ' + score, W / 2, 572, 24); }
  } else if (state === 'play') {
    ctx.save();
    if (outcome === 'lose' && outT < .4) ctx.translate((Math.random() - .5) * 14, (Math.random() - .5) * 14);
    cur.draw(t);
    ctx.restore();
    drawParts();
    if (!outcome) {
      if (t < .9) {
        const k = Math.min(1, t / .15);
        ctx.save(); ctx.translate(W / 2, H / 2 - 20); const sc = 1 + (1 - k) * .8; ctx.scale(sc, sc);
        ctx.rotate(Math.sin(now * 12) * .03); ctx.globalAlpha = t > .7 ? 1 - (t - .7) / .2 : 1;
        txt(cur.cmd, 0, 0, 130, isBoss ? '#FF4D4D' : '#FFE14D', 'center', 760); txt(hintOf(cur), 0, 95, 34, '#fff', 'center', 760); ctx.restore();
      } else txt(hintOf(cur), W / 2, 36, 24, '#fff', 'center', 520);
    } else {
      const k = Math.min(1, outT / .2);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.1);
      const sc = .3 + .7 * k + Math.sin(k * Math.PI) * .25; ctx.scale(sc, sc);
      txt(outcome === 'win' ? 'NICE!' : 'FAIL!', 0, 0, 150, outcome === 'win' ? '#5CFF7A' : '#FF4D4D'); ctx.restore();
    }
    if (mode === 'stage') {
      livesRow(36, 62, 2.4, 40, col);
      txt(isBoss ? 'BOSS' : `${played + 1}/${stage.n}`, W - 16, 30, 26, isBoss ? '#FF4D4D' : '#fff', 'right');
      txt(String(score), W - 16, 62, 22, '#FFE14D', 'right');
    } else txt('PRACTICE', W - 16, 30, 22, '#fff', 'right');
    button(W - 78, 80, 66, 30, mode === 'practice' ? 'EXIT' : 'MENU', exitPlay, { size: 15, fill: 'rgba(255,255,255,.85)' });
    fuse();
  } else if (state === 'over') {
    bg('#3b0d14', '#4d1119', now);
    txt('GAME OVER', W / 2, 120, 110, '#FF4D4D', 'center', 760);
    claude(W / 2, 390, 16, { col, mood: 'sad' });
    txt(stage.name + ' · SCORE ' + score, W / 2, 455, 34, '#fff', 'center', 760);
    if (st > .4) { button(110, 495, 280, 70, 'RETRY', () => startStage(stageIdx), { fill: '#5CFF7A' }); button(410, 495, 280, 70, 'STAGES', goMenu); }
  } else if (state === 'clear') {
    bg(stage.bg[0], stage.bg[1], now);
    const last = stageIdx === STAGES.length - 1;
    txt(last ? 'YOU SHIPPED IT!' : 'STAGE CLEAR!', W / 2, 105, last ? 84 : 92, '#fff', 'center', 760);
    txt(stage.name, W / 2, 180, 40, '#FFE14D', 'center', 700);
    claude(W / 2, 410 - Math.abs(Math.sin(now * 6)) * 50, 15, { col: stage.col, mood: 'happy' });
    stars3(W / 2, 260, st > .3 ? stars : 0, 30 + Math.sin(now * 6) * 3, 80);
    drawParts();
    txt('SCORE ' + score + (score >= save.best[stageIdx] && score > 0 ? '  NEW BEST!' : '  BEST ' + save.best[stageIdx]), W / 2, 443, 30, '#fff', 'center', 760);
    if (!net.user) txt('GUEST · SIGN IN WITH GOOGLE (PROFILE) TO JOIN THE LEADERBOARD', W / 2, 474, 17, '#ddd', 'center', 760);
    else if (runRank && runRank.loading) txt('RANKING...', W / 2, 474, 26, '#FFE14D');
    else if (runRank && runRank.rank) txt(`#${runRank.rank} ON ${stage.name}!`, W / 2, 474, 28, '#FFE14D', 'center', 760);
    else if (runRank && runRank.queued) txt('OFFLINE · SCORE WILL BE SENT LATER', W / 2, 474, 20, '#ddd', 'center', 760);
    if (st > .5) {
      if (!last) button(110, 500, 280, 66, 'NEXT STAGE ►', afterClear, { fill: '#5CFF7A' });
      button(last ? 260 : 410, 500, 280, 66, 'STAGES', goMenu);
    }

  } else if (state === 'profile') {
    bg('#2b2757', '#322d66', now);
    txt('PROFILE', W / 2, 40, 54, '#FFE14D');
    button(14, 10, 130, 56, '◄ BACK', back, { size: 22 });
    claude(W / 2, 205, 6, { mood: 'happy' });
    txt('SAVE YOUR PROGRESS · JOIN THE LEADERBOARDS', W / 2, 262, 22, '#fff', 'center', 740);
    const ok = pf.avail === 'yes' || pf.avail === 'loading', bx = 190, by = 298, bw = 420, bh = 84;
    box(bx, by, bw, bh, ok ? '#fff' : '#bdbbc9', 5);
    googleG(bx + 56, by + bh / 2, 20, !ok);
    ctx.font = '900 25px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ok ? INK : '#6d6a80'; ctx.fillText(pf.busy ? 'Waiting for Google...' : 'Sign in with Google', bx + 96, by + bh / 2 + 2, bw - 110);
    if (pf.busy) button(bx + 60, by + bh + 18, bw - 120, 46, 'CANCEL', cancelGoogle, { size: 20, fill: '#FFE14D' });
    else if (pf.avail === 'down') { txt('CAN\'T REACH SERVER RIGHT NOW', W / 2, by + bh + 36, 22, '#FF4D4D', 'center', 740); button(300, by + bh + 62, 200, 46, 'RETRY', checkSignIn, { size: 20, fill: '#FFE14D' }); }
    else if (pf.avail === 'no') txt('SIGN-IN NOT AVAILABLE RIGHT NOW', W / 2, by + bh + 36, 24, '#FF4D4D', 'center', 740);
    if (!pf.busy && pf.avail !== 'no' && pf.avail !== 'down') btns.push({ x: bx, y: by, w: bw, h: bh, fn: doGoogle });
    if (pf.msg && !pf.busy && pf.avail !== 'no' && pf.avail !== 'down') txt(pf.msg, W / 2, by + bh + 36, 20, pf.msgCol, 'center', 740);
    box(190, 500, 420, 50, '#5CFF7A', 4);
    txt('OR JUST PLAY AS A GUEST', W / 2, 526, 22, INK, 'center', 400);
    btns.push({ x: 190, y: 500, w: 420, h: 50, fn: back });
    txt('GUESTS KEEP PLAYING FULLY OFFLINE · NO PASSWORD EVER', W / 2, 578, 16, '#ddd', 'center', 760);
  } else if (state === 'board') {
    bg('#1f2a44', '#26335a', now);
    const n = STAGES.length + 1, tp = pageCount(n, PER_TABS), tot = lb.tab === STAGES.length, s = STAGES[lb.tab];
    txt('LEADERBOARD', W / 2, 38, 44, '#FFE14D');
    button(14, 10, 130, 56, '◄ BACK', back, { size: 22 });
    if (tp > 1) {
      button(56, 80, 56, 52, '◄', () => { lb.page = (lb.page + tp - 1) % tp; }, { size: 24, fill: '#FFE14D' });
      button(W - 112, 80, 56, 52, '►', () => { lb.page = (lb.page + 1) % tp; }, { size: 24, fill: '#FFE14D' });
    }
    for (let k = 0; k < PER_TABS; k++) {
      const i = lb.page * PER_TABS + k; if (i >= n) break;
      button(128 + k * 90, 80, 82, 52, i === STAGES.length ? 'ALL' : String(i + 1), () => setTab(i), { size: 24, fill: i === lb.tab ? '#5CFF7A' : '#fff' });
    }
    txt(tot ? 'TOTAL · BEST OF EVERY STAGE' : `STAGE ${lb.tab + 1} · ${s.name}`, W / 2, 168, 28, tot ? '#5CFF7A' : '#fff', 'center', 740);
    const c = lb.cache[lb.tab] || {}, d = c.data;
    if (d) {
      if (!d.entries.length) txt('NO SCORES YET - BE FIRST!', W / 2, 330, 32, '#fff');
      d.entries.forEach((e, i) => {
        const col = i / 10 | 0, x = 20 + col * 392, y = 190 + (i % 10) * 33, mine = net.user && e.username === net.user.username;
        box(x, y, 368, 28, mine ? '#FFE14D' : i % 2 ? '#35406a' : '#2c3659', 2);
        txt('#' + e.rank, x + 8, y + 15, 16, mine ? INK : '#fff', 'left');
        claude(x + 62, y + 24, 1.7, { col: e.color });
        ctx.save(); txt(e.username, x + 82, y + 15, 17, mine ? INK : e.color, 'left', 170); ctx.restore();
        txt(String(e.score), x + 360, y + 15, 17, mine ? INK : '#fff', 'right');
        btns.push({ x, y, w: 368, h: 28, fn: () => openProfile(e.username) });
      });
      if (d.me) {
        const inTop = d.entries.some(e => net.user && e.username === net.user.username);
        txt(`YOU: #${d.me.rank} OF ${d.players} · ${d.me.score}` + (inTop ? '' : '  (OUTSIDE TOP 20)'), W / 2, 530, 24, '#FFE14D', 'center', 760);
      } else if (net.user) txt('YOU HAVEN\'T SET A SCORE HERE YET', W / 2, 530, 20, '#ddd');
      else txt('GUEST · SIGN IN WITH GOOGLE (PROFILE) TO GET RANKED', W / 2, 530, 20, '#ddd');
    } else if (c.err) {
      txt(c.err, W / 2, 300, 30, '#FF4D4D', 'center', 740);
      button(300, 340, 200, 56, 'RETRY', () => loadBoard(lb.tab), { size: 24, fill: '#FFE14D' });
    } else txt('LOADING...', W / 2, 320, 36, '#fff');
    if (!TOUCH) txt('◄ ► TAB · ESC BACK', W - 12, 584, 14, '#ddd', 'right');
    if (!net.user && !c.err) button(W - 184, 10, 170, 56, 'PROFILE', goProfile, { size: 22, fill: '#5CFF7A' });
  } else if (state === 'pview') {
    bg('#2b2757', '#322d66', now);
    button(14, 10, 130, 56, '◄ BACK', back, { size: 22 });
    const d = pv.data, me = net.user && pv.name === net.user.username;
    if (!d) {
      txt(pv.loading ? 'LOADING...' : pv.err, W / 2, 300, 36, pv.loading ? '#fff' : '#FF4D4D', 'center', 740);
      if (!pv.loading) button(300, 340, 200, 56, 'RETRY', () => openProfile(pv.name), { size: 24, fill: '#FFE14D' });
    } else {
      claude(110, 215, 8, { col: d.color, mood: 'happy' });
      txt(d.username, 210, 110, 52, d.color, 'left', 560);
      txt(d.rank ? `RANK #${d.rank} · TOTAL ${d.total}` : 'NOT RANKED YET', 210, 165, 28, '#fff', 'left', 580);
      stars3(260, 210, Math.min(3, Math.round(d.totalStars / (STAGES.length * 3) * 3)), 18, 48);
      txt(`${d.totalStars}/${STAGES.length * 3} STARS · ${d.unlocked}/${STAGES.length} UNLOCKED`, 340, 210, 18, '#ddd', 'left', 440);
      const cw = 146, ch = 112;
      STAGES.forEach((s2, i) => {
        const x = 24 + (i % 5) * (cw + 10), y = 262 + (i / 5 | 0) * (ch + 12), played2 = d.best[i] > 0 || d.stars[i] > 0;
        box(x, y, cw, ch, played2 ? s2.bg[0] : '#5a5870', 4);
        txt('STAGE ' + (i + 1), x + 8, y + 14, 14, '#fff', 'left');
        txt(played2 ? String(d.best[i]) : '-', x + cw / 2, y + 48, 30, '#fff', 'center', cw - 12);
        stars3(x + cw / 2, y + 80, d.stars[i], 10, 28);
        if (d.stageRanks[i]) txt('#' + d.stageRanks[i], x + cw - 8, y + 14, 15, '#FFE14D', 'right');
      });
      if (me) {
        swatches(262, 548, 12, 34, net.user.color, pickColor);
        txt('COLOUR', 24, 548, 17, '#fff', 'left');
        button(414, 520, 186, 56, 'CHANGE NAME', openRename, { size: 18, fill: '#FFE14D' });
        button(612, 520, 178, 56, 'LOG OUT', doLogout, { size: 22, fill: '#FF4D4D', col: '#fff' });
      }
    }
    if (rn.on && me) {
      btns = []; ctx.fillStyle = 'rgba(10,8,24,.8)'; ctx.fillRect(0, 0, W, H);
      box(150, 150, 500, 300, '#2b2757', 6);
      txt('CHANGE NAME', W / 2, 195, 40, '#FFE14D');
      txt('3-16 LETTERS, NUMBERS, _ -', W / 2, 232, 17, '#ddd');
      button(215, 340, 170, 52, rn.busy ? '...' : 'SAVE', doRename, { size: 24, fill: '#5CFF7A' });
      button(415, 340, 170, 52, 'CANCEL', closeRename, { size: 24 });
      if (rn.msg) txt(rn.msg, W / 2, 418, 18, rn.msg === 'ONE MOMENT...' ? '#fff' : '#FF4D4D', 'center', 470);
    }
  }
  drawToast(lastDt); placeInputs();
}

/* ───────────── input events ───────────── */
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') { // typing in a profile field: don't leak keys into the game
    if (e.code === 'Enter') { e.preventDefault(); doRename(); }
    else if (e.code === 'Escape') closeRename();
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') { muted = !muted; return; }
  keys[e.code] = true;
  if (e.repeat) return;
  const go = e.code === 'Enter' || e.code === 'Space';
  if (e.code === 'Escape') {
    if (rn.on) { closeRename(); return; }
    if (state === 'play' || state === 'inter' || state === 'stagein') exitPlay();
    else if (state === 'menu') goTitle(); else if (state === 'practice') goMenu();
    else if (state === 'profile' || state === 'board' || state === 'pview') back();
    return;
  }
  if (state === 'title' && go) goMenu();
  else if (state === 'title' && e.code === 'KeyA') goProfile();
  else if (state === 'board') { if (e.code === 'ArrowRight') setTab(lb.tab + 1); else if (e.code === 'ArrowLeft') setTab(lb.tab - 1); }
  else if (state === 'profile' && go) doGoogle();
  else if (state === 'menu') {
    const d = +e.key, mp = pageCount(STAGES.length, PER_MENU);
    if (d >= 1 && d <= 6 && menuPage * PER_MENU + d - 1 < STAGES.length) startStage(menuPage * PER_MENU + d - 1);
    else if (e.code === 'KeyP') goPractice();
    else if (e.code === 'KeyL') goBoard();
    else if (e.code === 'KeyA') goProfile();
    else if (e.code === 'ArrowRight') menuPage = (menuPage + 1) % mp; else if (e.code === 'ArrowLeft') menuPage = (menuPage + mp - 1) % mp;
  } else if (state === 'practice') {
    const pp = pageCount(REG.length, PER_PRACTICE);
    if (e.code === 'ArrowRight') practicePage = (practicePage + 1) % pp; else if (e.code === 'ArrowLeft') practicePage = (practicePage + pp - 1) % pp;
  }
  else if (state === 'over' && go && st > .4) startStage(stageIdx);
  else if (state === 'clear' && go && st > .5) afterClear();
  if (state === 'play' && !outcome && cur.key) cur.key(e);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (state === 'play' && !outcome && cur.keyup) cur.keyup(e);
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

let sw = null;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  const p = pos(e); mouse = p;
  const b = btns.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
  if (b) { snd(520, .05, 'square', .05); b.fn(); return; }
  if (state === 'title') { goMenu(); return; }
  if (state === 'play' && !outcome) { sw = { x: p.x, y: p.y }; if (cur.move) cur.move(p); if (cur.down) cur.down(p); }
});
cv.addEventListener('pointermove', e => {
  const p = pos(e); mouse = p;
  if (state !== 'play' || outcome) return;
  if (cur.move) cur.move(p);
  if (sw && cur.swipe) {
    const dx = p.x - sw.x, dy = p.y - sw.y;
    if (Math.hypot(dx, dy) > 40) {
      const code = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
      cur.key({ code, key: '' }); sw = { x: p.x, y: p.y };
    }
  }
});
const endPtr = e => { if (state === 'play' && !outcome && cur.up) cur.up(pos(e)); sw = null; };
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);

let lastTs = 0, lastDt = 0;
function loop(ts) {
  const dt = Math.min(.05, (ts - lastTs) / 1000 || 0); lastTs = ts; now += dt; lastDt = dt;
  update(dt); render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
