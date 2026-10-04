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
if (net.user) { OP.identify(net.user); api.me().then(r => { if (r.ok) syncProgress(r.data.progress); }); }
track('app_loaded', { touch: !!TOUCH, challenge: !!CH, challenger: CH ? CH.from : undefined, signed_in: !!net.user });

/* ───────────── sharing / friend challenges ───────────── */
let chOpen = !!CH;                       // title screen still offers the incoming challenge
const attempts = {};                     // stage index -> tries this session (retry funnel)
let sh = { on: false, surface: '', text: '', url: '' };   // desktop share menu
async function doShare(surface) {
  const run = surface === 'invite' ? null : { score: Math.round(score), stage: stageIdx };
  const name = net.user ? net.user.username : '';
  const url = run ? challengeUrl(run.score, run.stage, name) : gameUrl();
  const text = run ? t('I scored {score} on {stage} in Claude Ware. Think you can beat me?', { score: run.score, stage: t(STAGES[run.stage].name) }) : t('Claude Ware: 100+ five-second microgames. Come play!');
  const props = { surface, native: !!navigator.share, score: run ? run.score : undefined, stage: run ? run.stage + 1 : undefined };
  track('share_click', props);
  if (!navigator.share) { sh = { on: true, surface, text, url }; return; }       // desktop: pick a network
  const blob = run ? await scoreCard({ score: run.score, stage: run.stage, stars: surface === 'stage_clear' ? stars : null, name, color: net.user ? net.user.color : null, best: surface === 'stage_clear' && run.score > 0 && run.score >= save.best[run.stage] }).catch(() => null) : null;
  const r = await shareText(text, url, blob);
  track('share_result', { surface, result: r, method: 'native' });
  if (r === 'copied') say('LINK COPIED! SEND IT TO A FRIEND', '#5CFF7A'); else if (r === 'failed') say('COULDN\'T SHARE', '#FF4D4D');
}
function shareVia(tg) {
  track('share_result', { surface: sh.surface, result: 'opened', method: tg.id });
  try { window.open(tg.href(sh.text, sh.url), '_blank', 'noopener'); } catch (e) {}
  sh.on = false;
}
async function shareCopy() {
  const r = await shareText(sh.text, sh.url);   // desktop => clipboard
  track('share_result', { surface: sh.surface, result: r, method: 'copy' });
  say(r === 'failed' ? 'COULDN\'T COPY' : 'LINK COPIED! SEND IT TO A FRIEND', r === 'failed' ? '#FF4D4D' : '#5CFF7A'); sh.on = false;
}
function drawShareMenu() {
  btns = [];
  ctx.fillStyle = 'rgba(10,8,24,.82)'; ctx.fillRect(-OX, 0, VW, H);
  txt('CHALLENGE YOUR FRIENDS', W / 2, 70, 44, '#FFE14D', 'center', 740);
  SHARE_TARGETS.forEach((tg, i) => button(130 + (i % 2) * 280, 130 + (i / 2 | 0) * 90, 260, 70, tg.label, () => shareVia(tg), { fill: tg.fill, size: 24 }));
  button(130, 330, 540, 70, 'COPY LINK', shareCopy, { fill: '#B49CFF', size: 26 });
  button(250, 440, 300, 64, 'CLOSE', () => { sh.on = false; }, { size: 24 });
}
/* title tap / Enter: a room invite wins over a score challenge, which wins over the stage menu */
function titleGo() { if (inviteOpen()) joinInvite(); else if (chOpen) acceptChallenge(); else goMenu(); }
function acceptChallenge() {
  const i = Math.min(CH.stage, save.unlocked - 1);          // locked stage? start from the furthest one you can play
  chOpen = false; track('challenge_accept', { from: CH.from, target: CH.score, stage: CH.stage + 1, played: i + 1 });
  startStage(i);
}
const chFrom = () => CH.from === 'A FRIEND' ? t('A FRIEND') : CH.from.toUpperCase();
/* verdict vs. the incoming challenge, only while playing the challenged stage */
function challengeLine() {
  if (!CH || stageIdx !== CH.stage || mode !== 'stage') return null;
  const d = CH.score - Math.round(score);
  const from = chFrom();
  return d < 0 ? { s: t('YOU BEAT {from}\'S {score}!', { from, score: CH.score }), col: '#5CFF7A' } : { s: t('{from}\'S SCORE: {score} · {left} TO GO', { from, score: CH.score, left: d }), col: '#FFE14D' };
}

/* ───────────── state ───────────── */
let state = 'title', st = 0, mode = 'stage';
const PRE = 1.4; let pre = 0, preMax = PRE;   // read-time: game frozen while the instruction is shown
let stageIdx = 0, stage = STAGES[0], lives = 4, played = 0, score = 0, lastOut = null, stars = 0;
let cur = null, curId = '', tt = 0, dur = 5, outcome = null, outT = 0, tickN = 0, recent = [], isBoss = false;
let practiceId = 'swat', practiceSp = 1, menuPage = 0, practicePage = 0;
const PER_MENU = 6, PER_PRACTICE = 30;
const pageCount = (n, per) => Math.ceil(n / per);
let btns = [];
/* ui juice state: hover / press, count-up score, life-loss pop, clear-screen star pops, music sync */
let hp = { x: -999, y: -999 }, pressing = false, hoverKey = '', interacted = false, musKey = '';
let shownScore = 0, scorePop = 0, lifeT = 99, shownStars = 0, lastState = 'title';
const clamp01 = k => Math.max(0, Math.min(1, k));
const easeOut = k => 1 - Math.pow(1 - clamp01(k), 3);
const easeBack = k => { k = clamp01(k); return 1 + 2.9 * Math.pow(k - 1, 3) + 1.9 * Math.pow(k - 1, 2); };
const hovered = (x, y, w, h) => hp.x >= x && hp.x <= x + w && hp.y >= y && hp.y <= y + h;
/* decide which music should be playing right now; restart only when that changes. Respects mute. */
function syncMusic() {
  let want = null;
  if (!muted && interacted) {
    if (state === 'play' && outcome) want = null;
    else if (state === 'play' || state === 'inter' || state === 'stagein') {
      if (mode === 'practice') want = ['play', 0, +(.9 + (practiceSp - 1) * .4).toFixed(2)];
      else {
        const boss = state === 'play' ? isBoss : state === 'inter' && played >= stage.n;
        want = [boss ? 'boss' : 'play', stageIdx, +Math.min(1.7, .85 + (stage.sp0 - 1) * .7 + Math.min(played, stage.n) * .02 + (boss ? .1 : 0)).toFixed(2)];
      }
    } else if (state !== 'clear' && state !== 'over') want = ['menu', 0, .75];
  }
  const key = want ? want.join() : '';
  if (key === musKey) return;
  musKey = key;
  if (!want) stopMusic(); else startMusic(want[1], want[2], want[0]);
}
/* profile / leaderboard UI state */
let from = { profile: 'menu', board: 'menu', pview: 'menu', friends: 'party' };
let pf = { avail: 'loading', busy: false, msg: '', msgCol: '#FF4D4D' };   // Google sign-in screen
let rn = { on: false, busy: false, msg: '' };                              // CHANGE NAME dialog
let lb = { tab: 0, page: 0, cache: {} };
let pv = { name: '', data: null, err: '', loading: false };
let fr = { tab: 0, page: 0, list: null, loading: false, err: '', add: false, busy: false, msg: '' };   // friends (follows)
const inFriend = document.getElementById('in-friend');
const PER_TABS = 6;
const inName = document.getElementById('in-name'), ov = document.getElementById('ov');

const speed = () => stage.sp0 + Math.floor(played / 2) * .1;
const poolOf = s => s.pool || REG.filter(r => !r.duo).map(r => r.id);
const PREG = REG.filter(r => !r.duo);          // microgames you can play alone (DUO games need a partner, so no practice for them)

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
  if (net.user && !fr.list) loadFriends();
  track('profile_view', { own: !!net.user && net.user.username === name }); rn.on = false; state = 'pview'; st = 0; pv = { name, data: null, err: '', loading: true };
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
  track('leaderboard_view', { tab: tab == null ? 'default' : tab }); state = 'board'; st = 0; setTab(tab == null ? Math.min(lb.tab, STAGES.length) : tab);
}
function back() {
  if (state === 'profile') { state = from.profile; }
  else if (state === 'board') { state = from.board; }
  else if (state === 'pview') { state = from.pview; if (state === 'board') st = 1; }
  else if (state === 'friends') { state = from.friends; if (state === 'party') party.view = party.room ? roomView() : 'menu'; }
  if (state === 'friends') loadFriends();
  if (state === 'board') loadBoard(lb.tab);
  st = 0;
}
/* Start OAuth from the user gesture. Mobile browsers use a same-tab redirect,
   which avoids their stricter popup blockers; desktop keeps the popup flow. */
async function doGoogle() {
  if (pf.busy) return;
  if (pf.avail === 'no') return;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
    (navigator.userAgentData && navigator.userAgentData.mobile);
  let w = null;
  if (!mobile) {
    try { w = window.open('', 'claudeware-google', 'popup=yes,width=500,height=680'); } catch (e) {}
    if (!w) { pf.msg = 'POPUP BLOCKED - TRY AGAIN'; pf.msgCol = '#FF4D4D'; return; }
  }
  pf.busy = true; pf.msg = 'WAITING FOR GOOGLE...'; pf.msgCol = '#fff';
  const r = await api.googleSignIn(w, mobile ? url => { location.href = url; } : null);
  pf.busy = false;
  if (!r.ok) {
    if (r.unavailable) pf.avail = 'no';
    pf.msg = r.cancelled ? 'CANCELLED - NO WORRIES, KEEP PLAYING' : r.status === 0 && /unreachable/i.test(r.data.error) ? 'CAN\'T REACH SERVER - PLAY AS GUEST' : (r.data.error || 'ERROR').toUpperCase();
    pf.msgCol = r.cancelled ? '#FFE14D' : '#FF4D4D'; return;
  }
  OP.identify(r.data.user); track('sign_in', { is_new: !!r.data.isNew });
  await syncProgress(r.data.progress);
  lb.cache = {}; fr.list = null;
  if (r.data.isNew) { say('WELCOME! PICK A NAME & COLOUR', '#5CFF7A'); openProfile(r.data.user.username); }
  else { say(t('WELCOME BACK, {name}!', { name: r.data.user.username.toUpperCase() })); state = from.profile === 'profile' ? 'menu' : from.profile; st = 0; }
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
async function doLogout() { closeRename(); fr.list = null; await api.logout(); runRank = null; lb.cache = {}; say('LOGGED OUT', '#FFE14D'); state = 'menu'; st = 0; }
function pickColor(c) {
  if (net.user && state === 'pview' && pv.name === net.user.username) {
    api.setColor(c).then(r => { if (r.ok) { if (pv.data) pv.data.color = c; lb.cache = {}; } else say('COULD NOT SAVE COLOUR', '#FF4D4D'); });
    net.user.color = c; if (pv.data) pv.data.color = c;
  }
}

/* ───────────── friends: follow players; two follows pointing at each other = friends ───────────── */
const FR_PER = 6, FR_TABS = ['FRIENDS {n}', 'FOLLOWING {n}', 'FOLLOWERS {n}'];
const frRel = uid => (fr.list || []).find(f => f.uid === uid);
const frOf = tab => (fr.list || []).filter(f => tab === 0 ? f.following && f.followsMe : tab === 1 ? f.following : f.followsMe).sort((a, b) => b.total - a.total || a.username.localeCompare(b.username));
const frPending = () => (fr.list || []).filter(f => f.followsMe && !f.following).length;   // people who follow me and I don't follow back
function loadFriends() {
  if (!net.user || fr.loading) return Promise.resolve();
  fr.loading = true; fr.err = '';
  return api.friends().then(r => { fr.loading = false; if (r.ok) fr.list = r.data.list; else fr.err = r.status === 0 ? 'CAN\'T REACH SERVER' : (r.data.error || 'ERROR').toUpperCase(); });
}
function goFriends() {
  if (state !== 'pview') from.friends = state;
  track('friends_view', { signed_in: !!net.user }); state = 'friends'; st = 0; fr.page = 0; fr.add = false; fr.msg = ''; loadFriends();
}
async function followToggle(uid, name) {
  if (fr.busy) return; fr.busy = true;
  const rel = frRel(uid), un = !!(rel && rel.following);
  const r = un ? await api.unfollow(rel.rec) : await api.follow(uid);
  fr.busy = false;
  if (!r.ok && !(r.status === 404 && un)) { say(r.status === 0 ? 'CAN\'T REACH SERVER' : r.status === 429 ? 'SLOW DOWN' : (r.data.error || 'ERROR').toUpperCase(), '#FF4D4D'); return; }
  track(un ? 'unfollow' : 'follow', {});
  await loadFriends();
  say(t(un ? 'UNFOLLOWED {name}' : 'FOLLOWING {name}!', { name: String(name).toUpperCase() }), un ? '#FFE14D' : '#5CFF7A');
}
function openAddFriend() { fr.add = true; fr.msg = ''; inFriend.value = ''; setTimeout(() => inFriend.focus(), 0); }
function closeAddFriend() { fr.add = false; inFriend.blur(); }
async function doAddFriend() {
  if (fr.busy) return;
  const n = inFriend.value.trim();
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(n)) { fr.msg = 'NAME: 3-16 LETTERS, NUMBERS, _ -'; return; }
  if (net.user && n.toLowerCase() === net.user.username.toLowerCase()) { fr.msg = 'THAT\'S YOU!'; return; }
  fr.busy = true; fr.msg = 'ONE MOMENT...';
  const u = await api.findUser(n);
  fr.busy = false;
  if (!u.ok) { fr.msg = u.status === 0 ? 'CAN\'T REACH SERVER' : 'NO SUCH PLAYER'; return; }
  closeAddFriend(); openProfile(u.data.username);
}

/* three.js (590 KB) is only for the 3D stage's games: fetched when a 3D game is about to be needed, not at page load */
let threeP = null;
const is3D = id => /^td_/.test(id);
function loadThree() {
  if (typeof THREE !== 'undefined') return Promise.resolve();
  return threeP || (threeP = new Promise(res => {
    const sc = document.createElement('script'); sc.src = 'js/vendor/three.min.js?v=1790992357';
    sc.onload = sc.onerror = () => res(); document.head.appendChild(sc);   // on error the 3D games fall back (T3.ok stays false)
  }));
}

function goTitle() { state = 'title'; st = 0; }
function goMenu() { state = 'menu'; st = 0; mode = 'stage'; parts.length = 0; }
function goPractice() { state = 'practice'; st = 0; mode = 'practice'; parts.length = 0; }
function startStage(i) {
  if (i > save.unlocked - 1) return;
  runRank = null; attempts[i] = (attempts[i] || 0) + 1;
  track('stage_start', { stage: i + 1, stage_name: STAGES[i].name, attempt: attempts[i], unlocked: save.unlocked });
  if (poolOf(STAGES[i]).some(is3D)) loadThree();
  mode = 'stage'; stageIdx = i; stage = STAGES[i]; lives = 4; played = 0; score = 0; lastOut = null; recent = [];
  state = 'stagein'; st = 0; shownScore = 0; lifeT = 99; jingleGo();
}
function startPractice(id) { if (is3D(id)) loadThree(); track('practice_start', { game: id }); mode = 'practice'; practiceId = id; lastOut = null; stage = STAGES[0]; state = 'inter'; st = 0; }
function toInter() { state = 'inter'; st = 0; if (mode !== 'practice') jingleGo(); }

function beginGame() {
  let s;
  if (mode === 'practice' && is3D(practiceId) && typeof THREE === 'undefined') { loadThree().then(() => { if (state === 'inter') beginGame(); }); st = -99; return; }   // still downloading: wait on the intro card
  if (mode === 'party') {
    const R = party.room; s = R.sp; const dc = R.mode === 'duo' ? duoCtx(R) : undefined; cur = withSeed(R.seed, () => partyBuildGame(R, s, dc)); curId = R.game; isBoss = false; dur = cur.dur / Math.sqrt(s); I18N.scope = I18N.scopeOf(curId);
  } else if (mode === 'practice') {
    s = practiceSp; cur = REGMAP[practiceId].fn(s); curId = practiceId; isBoss = false; dur = cur.dur / Math.sqrt(s); I18N.scope = I18N.scopeOf(curId);
  } else if (played >= stage.n) {
    s = stage.sp0 + Math.floor(stage.n / 2) * .1; cur = BOSSES[stage.boss](s, stage); curId = 'boss:' + stage.boss; isBoss = true; dur = cur.dur;
  } else {
    const pool = poolOf(stage); let id;
    do { id = pool[Math.random() * pool.length | 0]; } while (recent.includes(id));
    if (is3D(id) && typeof THREE === 'undefined') { loadThree().then(() => { if (state === 'inter') beginGame(); }); st = -99; return; }
    recent.push(id); if (recent.length > Math.min(6, pool.length - 2)) recent.shift();
    s = speed(); cur = REGMAP[id].fn(s); curId = id; isBoss = false; dur = cur.dur / Math.sqrt(s); I18N.scope = I18N.scopeOf(curId);
  }
  tt = 0; outcome = null; outT = 0; tickN = 0; preMax = mode === 'party' ? party.room.mode === 'duo' ? DUO_PRE : partyTurnMode(party.room) ? TURN_PRE : PRE : PRE; pre = preMax; state = 'play';
}
function setOutcome(r) {
  outcome = r; outT = 0;
  track('microgame_end', { game: curId, result: r, mode, boss: isBoss, stage: mode === 'stage' ? stageIdx + 1 : undefined, speed: +(isBoss ? stage.sp0 : mode === 'practice' ? practiceSp : speed()).toFixed(2), secs: +tt.toFixed(2), lives_left: mode === 'stage' ? lives - (r === 'win' ? 0 : 1) : undefined });
  sfx.stamp();
  if (r === 'win') {
    if (mode === 'stage') { const g = 100 + Math.round((1 - tt / dur) * 50); score += g; scorePop = 1; floatText('+' + g, W - 80, 108, '#FFE14D', 30); }
    jingleWin(); confetti(W / 2, H / 2, 45); burst(W / 2, H / 2, '#5CFF7A', 18);
  } else {
    if (mode === 'stage') { lives--; lifeT = 0; ring(36 + Math.max(0, lives) * 40, 52, '#FF4D4D', 40, .5); }
    shake(12, .35); jingleLose();
  }
}
function clearStage() {
  stars = lives >= 3 ? 3 : lives >= 2 ? 2 : 1;
  save.stars[stageIdx] = Math.max(save.stars[stageIdx], stars);
  save.best[stageIdx] = Math.max(save.best[stageIdx], score);
  save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, stageIdx + 2)); persist();
  submitRun(stars);
  track('stage_clear', { stage: stageIdx + 1, stars, score, lives_left: lives, attempt: attempts[stageIdx] });
  const cl = challengeLine(); if (cl && score > CH.score) track('challenge_beaten', { from: CH.from, target: CH.score, score });
  state = 'clear'; st = 0; shownStars = 0; jingleWin(); confetti(W / 2, 200, 60);
}
function toOver() {
  track('game_over', { stage: stageIdx + 1, score, microgames: played, attempt: attempts[stageIdx] });
  state = 'over'; st = 0; submitRun(0); sfx.thud(); shake(14, .45);
}
function afterClear() { if (stageIdx < STAGES.length - 1) startStage(stageIdx + 1); else goMenu(); }
function exitPlay() { if (mode === 'party') return partyLeave(); if (mode === 'stage') track('stage_quit', { stage: stageIdx + 1, microgames: played, score, lives_left: lives, in_state: state }); mode === 'practice' ? goPractice() : goMenu(); }

/* ───────────── update ───────────── */
function update(dt) {
  partyUpdate(dt); updateParts(dt); st += dt; lifeT += dt; scorePop = Math.max(0, scorePop - dt * 3);
  shownScore += (score - shownScore) * Math.min(1, dt * 7); if (Math.abs(score - shownScore) < .5) shownScore = score;
  if (state === 'clear' && shownStars < stars && st > .5 + shownStars * .45) {   // stars pop in one by one
    const sx = W / 2 + (shownStars - 1) * 100; shownStars++;
    sfx.coin(); burst(sx, 265, '#FFE14D', 16, 300); ring(sx, 265, '#fff', 70, .45); if (shownStars === stars) sfx.sparkle();
  }
  if (state === 'stagein') { if (st > (stage.intro === 'ap' ? 4.9 : 2.4)) toInter(); }
  else if (state === 'inter') { if (st > (mode === 'practice' ? .8 : 1.4)) beginGame(); }
  else if (state === 'play') {
    if (pre > 0) { pre -= dt; return; }
    if (!outcome) {
      tt += dt;
      const n = Math.floor(tt * 2);
      if (n !== tickN) { tickN = n; snd(430 + 520 * Math.min(1, tt / dur) + (dur - tt < 1.5 ? 200 : 0), .04, 'square', dur - tt < 1.5 ? .045 : .03); }
    } else outT += dt;
    cur.update(dt, tt);
    if (!outcome) {
      if (cur.result) setOutcome(cur.result);
      else if (tt >= dur && !cur.partyHelper && !cur.partyDraw && !(cur.duoWait && tt < dur + DUO_WAIT)) {   // DUO: the non-judge waits for the judge's verdict so both screens show the same ending
        cur.result = cur.timeWin ? 'win' : 'lose'; setOutcome(cur.result); }
    } else if (outT > .95) {
      lastOut = outcome;
      if (mode === 'party') partyLocalDone(outcome);
      else if (mode === 'practice') { state = 'inter'; st = 0; }
      else if (isBoss) { if (outcome === 'win') clearStage(); else if (lives <= 0) toOver(); else toInter(); }
      else { played++; if (lives <= 0) toOver(); else toInter(); }
    }
  } else if (state === 'clear' && Math.random() < dt * 6) confetti(Math.random() * W, 100, 12);
}

/* ───────────── UI helpers ───────────── */
/* chunky plate with depth; lifts on hover, sinks on press. Caller must ctx.restore() when done drawing on it. */
function hoverBox(x, y, w, h, fill, o = 5, depth = 5) {
  const hv = hovered(x, y, w, h), pr = hv && pressing;
  ctx.save(); const off = pr ? depth - 1 : hv ? -2 : 0; ctx.translate(off, off);
  box3(x, y, w, h, fill, o, pr ? 1 : hv ? depth + 2 : depth);
  if (hv) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, y, w, h); }
  return hv;
}
function button(x, y, w, h, label, fn, o = {}) {
  hoverBox(x, y, w, h, o.fill || '#fff', 5);
  txt(label, x + w / 2, y + h / 2 + 2, o.size || 26, o.col || INK, 'center', w - 16);
  ctx.restore();
  btns.push({ x, y, w, h, fn });
}
/* logged-in badge (avatar-coloured Claude + name) or a PROFILE button for guests */
function profileBtn(x, y, w, h) {
  const u = net.user;
  hoverBox(x, y, w, h, '#fff', 5);
  claude(x + 30, y + h - 9, Math.max(2, h / 22), { col: u ? u.color : '#9a98ad' });
  txt(u ? u.username : 'PROFILE', x + 56 + (w - 62) / 2, y + h / 2 + 2, u ? 20 : 22, u ? u.color : INK, 'center', w - 68);
  ctx.restore();
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
  const showName = state === 'pview' && rn.on && !!net.user, showCode = state === 'party' && party.view === 'menu', showFriend = state === 'friends' && fr.add && !!net.user;
  ov.style.display = showName || showCode || showFriend ? 'block' : 'none';
  inName.style.display = showName ? 'block' : 'none'; inCode.style.display = showCode ? 'block' : 'none'; inFriend.style.display = showFriend ? 'block' : 'none';
  if (!showName && !showCode && !showFriend) return;
  const r = cv.getBoundingClientRect(), k = r.width / VW;
  const put = (el, x, y, w, h) => { const s = el.style; s.left = r.left + (x + OX) * k + 'px'; s.top = r.top + y * k + 'px'; s.width = w * k + 'px'; s.height = h * k + 'px'; s.fontSize = h * k * .5 + 'px'; };
  if (showName) put(inName, 200, 262, 400, 52);
  else if (showFriend) put(inFriend, 200, 262, 400, 52);
  else put(inCode, 200, 322, 260, 64);
}
function hintOf(g) {
  if (!TOUCH) return t(g.hint);
  return g.thint ? t(g.thint) : I18N.touch(t(g.hint));      // no touch wording of its own: reword the translated hint
}
function livesRow(x, y, u, gap, col) {
  for (let i = 0; i < 4; i++) {
    const cx = x + i * gap;
    if (i < lives) { claude(cx, y - (lives === 1 ? Math.abs(Math.sin(now * 8)) * u * .8 : 0), u, { col }); continue; }
    const k = i === lives ? lifeT / .9 : 9;
    if (k >= 1) { claude(cx, y, u, { col: '#4a4558', mood: 'sad' }); continue; }   // just-lost mascot pops big, flashes red, then greys out
    const sc = k < .25 ? 1 + k * 2.4 : 1.6 - (k - .25) / .75 * .6;
    ctx.save(); ctx.translate(cx + (Math.random() - .5) * 4 * (1 - k), y); ctx.scale(sc, sc);
    claude(0, 0, u, { col: k < .5 ? (Math.sin(k * 40) > 0 ? '#FF4D4D' : '#fff') : '#4a4558', mood: 'sad' }); ctx.restore();
  }
}
function stars3(cx, cy, n, size, gap) { for (let i = 0; i < 3; i++) star(cx + (i - 1) * gap, cy, size, size * .45, 5, -Math.PI / 2, i < n ? '#FFE14D' : '#4a4558', 3); }
function fuse() {
  const f = Math.min(1, tt / dur), left = dur - tt, danger = !outcome && left < 2;
  const col = f < .5 ? '#5CFF7A' : f < .75 ? '#FFE14D' : '#FF4D4D';
  const x0 = 24 - OX, x1 = W + OX - 70, sx = x0 + (x1 - x0) * f, y = H - 23 + (danger ? (Math.random() - .5) * 4 : 0);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-OX, H - 46, VW, 46);
  ctx.fillStyle = INK; ctx.fillRect(x0 - 4, y - 10, x1 - x0 + 8, 20);
  ctx.fillStyle = '#3a3550'; ctx.fillRect(x0, y - 6, x1 - x0, 12);
  ctx.globalAlpha = danger && Math.sin(now * 26) > .4 ? .6 : 1;
  ctx.fillStyle = col; ctx.fillRect(sx, y - 6, x1 - sx, 12);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(sx, y - 6, x1 - sx, 3); ctx.globalAlpha = 1;
  if (!outcome) star(sx, y, 14 + Math.random() * 6, 5, 8, now * 10, '#FFB020', 3);
  const shk = f > .75 && !outcome ? (Math.random() - .5) * 5 : 0;
  circ(W + OX - 40 + shk, y, 19, f > .85 && Math.sin(now * 30) > 0 ? '#ff3b3b' : '#2b2b3a', 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(W + OX - 48 + shk, y - 8, 6, 6);
  if (danger) txt(Math.ceil(left) + '', W + OX - 40, y - 34 - Math.abs(Math.sin(now * 10)) * 6, 30, '#FF4D4D');
}

/* ───────────── render ───────────── */
function render() {
  btns = []; I18N.scope = state === 'play' ? I18N.scopeOf(curId) : '';
  const col = mode === 'stage' ? stage.col : OR;

  if (state === 'title') {
    bg('#7C4DFF', '#6a3de8', now);
    const SC = ['#FFE14D', '#5CFF7A', '#4DB8FF', '#FF4D9E'];
    for (let i = 0; i < 8; i++) { const a = now * .5 + i * Math.PI / 4; star(W / 2 + Math.cos(a) * 340, 300 + Math.sin(a) * 215, 9 + (i % 3) * 4, 4, 5, now * 2 + i, SC[i % 4], 3); }
    const drop = easeBack(st / .6), bob = Math.sin(now * 2.2) * 8;
    ctx.save(); ctx.translate(W / 2, 130 + bob - (1 - drop) * 200); ctx.rotate(Math.sin(now * 2) * .03); ctx.scale(.6 + .4 * drop, .6 + .4 * drop);
    txt('CLAUDE', 6, 8, 120, INK); txt('CLAUDE', 0, 0, 120, '#FFE14D'); ctx.restore();
    ctx.save(); ctx.translate(W / 2, 250 - bob * .8 - (1 - easeBack(st / .6 - .15)) * 200); ctx.rotate(-Math.sin(now * 2 + 1) * .03);
    txt('WARE!', 6, 8, 120, INK); txt('WARE!', 0, 0, 120, '#fff'); ctx.restore();
    const jump = Math.abs(Math.sin(now * 4)) * 30;
    shadow(W / 2, 474, 90 - jump, 14 - jump * .2, .3);
    claude(W / 2, 470 - jump, 14, { mood: 'happy' });
    if (inviteOpen()) txt(t('A FRIEND INVITES YOU TO ROOM {code}', { code: PINVITE }), W / 2, 505, 21, '#5CFF7A', 'center', 760);
    else if (chOpen) txt(t('{from} CHALLENGES YOU: BEAT {score} ON {stage}', { from: chFrom(), score: CH.score, stage: t(STAGES[CH.stage].name) }), W / 2, 505, 21, '#FFE14D', 'center', 760);
    else txt(t('{games} MICROGAMES · {stages} STAGES · MOUSE + KEYBOARD + TOUCH', { games: PREG.length, stages: STAGES.length }), W / 2, 505, 19, '#fff', 'center', 760);
    ctx.save(); ctx.translate(W / 2, 558); const pl = 1 + Math.sin(now * 6) * .07; ctx.scale(pl, pl);
    txt(inviteOpen() ? (TOUCH ? 'TAP TO JOIN' : 'CLICK TO JOIN') : chOpen ? (TOUCH ? 'TAP TO ACCEPT' : 'CLICK TO ACCEPT') : TOUCH ? 'TAP TO START' : 'CLICK OR PRESS ENTER', 0, 0, 34, '#5CFF7A', 'center', 700); ctx.restore();
    txt(muted ? 'MUTED · M = SOUND' : 'M = MUTE', 20 - OX, 28, 18, '#fff', 'left');
    profileBtn(W + OX - 194, 12, 180, 52);
    button(14 - OX, 48, 140, 42, LANGS.find(l => l.code === I18N.lang).name, () => I18N.next(), { size: 18, fill: '#fff' });
    button(14 - OX, 536, 150, 50, 'INVITE', () => doShare('invite'), { size: 22, fill: '#4DB8FF' });
    button(W + OX - 164, chOpen || inviteOpen() ? 478 : 536, 150, 50, 'FRIENDS', () => goParty('title'), { size: 22, fill: '#5CFF7A' });
    if (chOpen || inviteOpen()) button(W + OX - 164, 536, 150, 50, 'MENU ►', () => { chOpen = false; PINVITE_USED = true; goMenu(); }, { size: 22 });
  } else if (state === 'menu') {
    bg('#2b2757', '#322d66', now);
    txt('SELECT STAGE', W / 2, 40, 44, '#FFE14D');
    STAGES.forEach((s, i) => {
      if ((i / PER_MENU | 0) !== menuPage) return;
      const k = i % PER_MENU, x = 20 + (k % 3) * 260, y = 95 + (k / 3 | 0) * 175, locked = i > save.unlocked - 1;
      const pop = easeOut((st - k * .05) / .3);
      ctx.save(); ctx.translate(0, (1 - pop) * 40); ctx.globalAlpha = pop;
      hoverBox(x, y, 240, 155, locked ? '#5a5870' : s.bg[0], 5, 7);
      shadow(x + 62, y + 120, 36, 7, .25);
      if (s.intro === 'ap' && !locked) AP.person(AP.CAST.chamo, { la: [2.4 + Math.sin(now * 9) * .2, .3], ra: [.12, .1], mouth: 'yell', talk: .8, wide: 1, bob: Math.abs(Math.sin(now * 8)) * -8 }, x + 62, y + 140, .44);   // Luisito, shouting
      else claude(x + 62, y + 118 - (locked ? 0 : Math.abs(Math.sin(now * 3 + i)) * 6), 5.2, { col: locked ? '#7a7890' : s.col, mood: locked ? null : undefined });
      txt(t('STAGE {n}', { n: i + 1 }), x + 14, y + 20, 17, '#fff', 'left');
      const words = t(s.name).split(' ');
      txt(words[0], x + 160, y + 58, 26, locked ? '#aaa' : '#fff', 'center', 150);
      if (words[1]) txt(words.slice(1).join(' '), x + 160, y + 90, 26, locked ? '#aaa' : '#fff', 'center', 150);
      if (locked) txt('LOCKED', x + 160, y + 130, 22, '#ddd');
      else stars3(x + 160, y + 128, save.stars[i], 14, 34);
      ctx.restore(); ctx.restore();
      btns.push({ x, y, w: 240, h: 155, fn: () => startStage(i) });
    });
    const mp = pageCount(STAGES.length, PER_MENU);
    if (mp > 1) {
      button(20, 455, 74, 74, '◄', () => { menuPage = (menuPage + mp - 1) % mp; }, { size: 30, fill: '#FFE14D' });
      button(706, 455, 74, 74, '►', () => { menuPage = (menuPage + 1) % mp; }, { size: 30, fill: '#FFE14D' });
      txt(t('PAGE {n}/{total}', { n: menuPage + 1, total: mp }), W / 2, 440, 18, '#fff');
    }
    profileBtn(14 - OX, 10, 170, 56);
    button(W + OX - 184, 10, 170, 56, 'RANKS', () => goBoard(), { size: 22, fill: '#FFE14D' });
    button(110, 455, 280, 74, 'PRACTICE', goPractice, { fill: '#5CFF7A' });
    button(410, 455, 280, 74, 'TITLE', goTitle, { fill: '#fff' });
    if (!TOUCH) txt('1-6 STAGE · ◄ ► PAGE · P PRACTICE · L RANKS · A PROFILE · ESC BACK', W / 2, 568, 18, '#fff');
  } else if (state === 'party') {
    drawParty();
  } else if (state === 'practice') {
    bg('#1f2a44', '#26335a', now);
    txt('PRACTICE', W / 2, 38, 44, '#FFE14D');
    button(14 - OX, 10, 130, 56, '◄ BACK', goMenu, { size: 22 });
    button(W + OX - 184, 10, 170, 56, t('SPEED x{n}', { n: practiceSp }), () => { practiceSp = practiceSp === 1 ? 1.5 : practiceSp === 1.5 ? 2 : 1; }, { size: 22, fill: '#FFE14D' });
    const pp = pageCount(PREG.length, PER_PRACTICE);
    if (pp > 1) {
      button(150, 10, 56, 56, '◄', () => { practicePage = (practicePage + pp - 1) % pp; }, { size: 24 });
      button(W - 250, 10, 56, 56, '►', () => { practicePage = (practicePage + 1) % pp; }, { size: 24 });
      txt(`${practicePage + 1}/${pp}`, W / 2 + 120, 38, 20, '#fff');
    }
    PREG.forEach((r, ri) => {
      if ((ri / PER_PRACTICE | 0) !== practicePage) return;
      const i = ri % PER_PRACTICE;
      const x = 26 + (i % 6) * 126, y = 92 + (i / 6 | 0) * 92;
      hoverBox(x, y, 118, 82, `hsl(${i * 12},70%,70%)`, 4, 5);
      I18N.scope = I18N.scopeOf(r.id); txt(r.name, x + 59, y + 41, 20, '#fff', 'center', 106); I18N.scope = ''; ctx.restore();
      btns.push({ x, y, w: 118, h: 82, fn: () => startPractice(r.id) });
    });
  } else if (state === 'stagein' && stage.intro === 'mv') {
    mvIntro(st, stage, stageIdx);
  } else if (state === 'stagein' && stage.intro === 'ap') {
    apIntro(st, stage, stageIdx);
  } else if (state === 'stagein') {
    bg(stage.bg[0], stage.bg[1], now);
    const e1 = easeOut(st / .45), e2 = easeOut((st - .15) / .45), e3 = easeBack((st - .35) / .4);
    const stn = t('STAGE {n}', { n: stageIdx + 1 });
    txt(stn, W / 2 - (1 - e1) * 800 + 5, 110, 90, INK, 'center', 760); txt(stn, W / 2 - (1 - e1) * 800, 105, 90, '#fff', 'center', 760);
    txt(stage.name, W / 2 + (1 - e2) * 900 + 4, 209, 64, INK, 'center', 740); txt(stage.name, W / 2 + (1 - e2) * 900, 205, 64, '#FFE14D', 'center', 740);
    ctx.globalAlpha = clamp01((st - .5) / .3); txt(stage.tag, W / 2, 275, 28, '#fff', 'center', 700); ctx.globalAlpha = 1;
    const jb = Math.abs(Math.sin(now * 5)) * 40;
    shadow(W / 2, 484, 100 - jb * .6, 14, .3);
    ctx.save(); ctx.translate(W / 2, 480 - jb); ctx.scale(e3, e3); claude(0, 0, 16, { col: stage.col, mood: 'happy' }); ctx.restore();
    ctx.globalAlpha = clamp01((st - .7) / .3); txt(t('{n} GAMES + BOSS', { n: stage.n }), W / 2, 545, 28, '#fff'); ctx.globalAlpha = 1;
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
    const zk = easeBack(st / .3), zs = bossNext ? 1 + Math.sin(now * 14) * .03 : 1;
    ctx.save(); ctx.translate(W / 2 + (bossNext ? (Math.random() - .5) * 4 : 0), 120); ctx.rotate(Math.sin(now * 8) * .04); ctx.scale(zk * zs, zk * zs);
    txt(msg, 5, 7, 96, INK, 'center', 760); txt(msg, 0, 0, 96, mc, 'center', 760); ctx.restore();
    ctx.globalAlpha = clamp01((st - .12) / .2); txt(mode === 'practice' ? (I18N.scope = I18N.scopeOf(practiceId), t(REGMAP[practiceId].name)) : bossNext ? stage.name : t('GAME {n} / {total}', { n: played + 1, total: stage.n }), W / 2 - (1 - easeOut((st - .1) / .3)) * 300, 205, 36, '#fff', 'center', 700); ctx.globalAlpha = 1;
    const mood = !lastOut || msg === 'READY?' ? null : lastOut === 'win' ? 'happy' : 'sad';
    const hop = mood === 'happy' ? Math.abs(Math.sin(now * 9)) * 40 : 0, rise = (1 - easeOut(st / .35)) * 220;
    shadow(W / 2, 404, 100 - hop * .5, 14, .3);
    claude(W / 2, 400 - hop + rise, 16, { col, mood });
    if (mode === 'stage') {
      livesRow(W / 2 - 108, 520, 3.2, 72, col);
      const sp = 1 + scorePop * .3; ctx.save(); ctx.translate(W / 2, 572); ctx.scale(sp, sp); txt(t('SCORE {n}', { n: Math.round(shownScore) }), 0, 0, 24); ctx.restore();
    }
  } else if (state === 'play') {
    if (pre > 0) bg(isBoss ? '#3b0d14' : '#1b1b3a', isBoss ? '#5b1d2b' : '#26265a', now);   // instruction card first, game only after
    else {
      const framed = OX > 0 && !cur.wide;
      if (framed) {                                      // wide screens: stage backdrop on the sides, game framed in the middle
        if (mode === 'stage') bg(isBoss ? '#3b0d14' : stage.bg[0], isBoss ? '#5b1d2b' : stage.bg[1], now); else bg('#1f2a44', '#26335a', now);
        ctx.fillStyle = INK; ctx.fillRect(W, 8, 10, H - 8);
      }
      if (cur.wide) cur.draw(tt); else { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); cur.draw(tt); ctx.restore(); }
      if (framed) { ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeRect(-3, -3, W + 6, H + 6); }
    }
    if (!cur.partyDark && !cur.partyScene) drawParts();
    if (!outcome) {
      if (pre > 0 && mode === 'party' && partyTurnMode(party.room)) drawPartyModeIntro(pre);
      else if (pre > 0 && preMax === DUO_PRE) drawDuoIntro(pre);
      else if (pre > 0) {
        const k = Math.min(1, (PRE - pre) / .15);
        ctx.save(); ctx.translate(W / 2, H / 2 - 20); const sc = 1 + (1 - k) * .8; ctx.scale(sc, sc);
        ctx.rotate(Math.sin(now * 12) * .03); 
        txt(cur.cmd, 0, 0, 130, isBoss ? '#FF4D4D' : '#FFE14D', 'center', 760); txt(hintOf(cur), 0, 95, 34, '#fff', 'center', 760); ctx.restore();
      } else if (!cur.partyScene) txt(hintOf(cur), W / 2, 36, 24, '#fff', 'center', mode === 'party' ? 400 : 520);
    } else {
      const win = outcome === 'win', sc = outT < .14 ? 2.6 - 1.6 * easeOut(outT / .14) : 1 + Math.max(0, .12 - (outT - .14)) * 1.2, lab = t(win ? 'NICE!' : 'FAIL!'), cc = win ? '#5CFF7A' : '#FF4D4D';
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.1); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, outT / .06);
      ctx.font = '900 150px "Arial Black", Impact, sans-serif'; const tw = Math.min(700, ctx.measureText(lab).width) + 50;
      ctx.fillStyle = 'rgba(20,16,28,.55)'; ctx.fillRect(-tw / 2 + 8, -88 + 10, tw, 176);
      ctx.lineWidth = 10; ctx.strokeStyle = cc; ctx.strokeRect(-tw / 2, -88, tw, 176); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(-tw / 2 - 8, -96, tw + 16, 192);
      txt(lab, 0, 4, 150, cc, 'center', tw - 30); ctx.restore();
    }
    if (mode === 'stage') {
      ctx.fillStyle = 'rgba(20,16,28,.4)'; ctx.fillRect(10 - OX, 36, 176, 40); ctx.fillRect(W + OX - 140, 10, 132, 66);
      livesRow(36 - OX, 66, 2.4, 40, col);
      txt(isBoss ? 'BOSS' : `${played + 1}/${stage.n}`, W + OX - 16, 30, 26, isBoss ? '#FF4D4D' : '#fff', 'right');
      ctx.save(); const sp = 1 + scorePop * .3; ctx.translate(W + OX - 16, 62); ctx.scale(sp, sp); txt(String(Math.round(shownScore)), 0, 0, 22, '#FFE14D', 'right'); ctx.restore();
    } else if (mode === 'party') { if (!(pre > 0 && (preMax === DUO_PRE || partyTurnMode(party.room))) && !cur.partyScene) drawPartyHud(); }
    else txt('PRACTICE', W + OX - 16, 30, 22, '#fff', 'right');
    button(W + OX - 78, 80, 66, 30, mode === 'party' ? 'LEAVE' : mode === 'practice' ? 'EXIT' : 'MENU', exitPlay, { size: 15, fill: 'rgba(255,255,255,.85)' });
    if (pre <= 0 && !cur.partyHelper && !cur.partyDraw && !cur.partyScene) fuse();
  } else if (state === 'over') {
    bg('#3b0d14', '#4d1119', now);
    const gk = st < .14 ? 2.6 - 1.6 * easeOut(st / .14) : 1;
    ctx.save(); ctx.translate(W / 2, 120); ctx.rotate(-.06); ctx.scale(gk, gk); ctx.globalAlpha = Math.min(1, st / .06);
    txt('GAME OVER', 6, 8, 110, INK, 'center', 760); txt('GAME OVER', 0, 0, 110, '#FF4D4D', 'center', 760); ctx.restore();
    shadow(W / 2, 394, 90, 13, .3);
    claude(W / 2, 390 + (1 - easeOut(st / .5)) * 120, 16, { col, mood: 'sad' });
    txt(t('{stage} · SCORE {n}', { stage: t(stage.name), n: Math.round(shownScore) }), W / 2, 455, 34, '#fff', 'center', 760);
    const cl = challengeLine(); if (cl) txt(cl.s, W / 2, 206, 28, cl.col, 'center', 760);
    if (st > .4) {
      button(40, 495, 220, 70, 'RETRY', () => startStage(stageIdx), { fill: '#5CFF7A' });
      button(290, 495, 220, 70, 'SHARE', () => doShare('game_over'), { fill: '#4DB8FF' });
      button(540, 495, 220, 70, 'STAGES', goMenu);
    }
  } else if (state === 'clear') {
    bg(stage.bg[0], stage.bg[1], now);
    const last = stageIdx === STAGES.length - 1;
    txt(last ? 'YOU SHIPPED IT!' : 'STAGE CLEAR!', W / 2, 105, last ? 84 : 92, '#fff', 'center', 760);
    txt(stage.name, W / 2, 180, 40, '#FFE14D', 'center', 700);
    const jc = Math.abs(Math.sin(now * 6)) * 50;
    shadow(W / 2, 414, 95 - jc * .6, 13, .3);
    claude(W / 2, 410 - jc, 15, { col: stage.col, mood: 'happy' });
    for (let i = 0; i < 3; i++) {                      // stars pop in one at a time (sfx + burst fired from update)
      const thr = .5 + i * .45, on = i < stars && st >= thr, k = on ? easeBack((st - thr) / .35) : 1, sz = on ? 40 * k : 34;
      star(W / 2 + (i - 1) * 100, 265, sz, sz * .45, 5, -Math.PI / 2 + (on ? (1 - k) * .9 : 0), on ? '#FFE14D' : '#4a4558', 3);
    }
    drawParts();
    const ccl = challengeLine(), dy = ccl ? -16 : 0;
    if (ccl) txt(ccl.s, W / 2, 456, 24, ccl.col, 'center', 760);
    txt(score >= save.best[stageIdx] && score > 0 ? t('SCORE {n}  NEW BEST!', { n: Math.round(shownScore) }) : t('SCORE {n}  BEST {best}', { n: Math.round(shownScore), best: save.best[stageIdx] }), W / 2, 443 + dy, 30, '#fff', 'center', 760);
    if (!net.user) txt('GUEST · SIGN IN WITH GOOGLE (PROFILE) TO JOIN THE LEADERBOARD', W / 2, 474 + (ccl ? 8 : 0), 17, '#ddd', 'center', 760);
    else if (runRank && runRank.loading) txt('RANKING...', W / 2, 474 + (ccl ? 8 : 0), 26, '#FFE14D');
    else if (runRank && runRank.rank) txt(t('#{rank} ON {stage}!', { rank: runRank.rank, stage: t(stage.name) }), W / 2, 474 + (ccl ? 8 : 0), 28, '#FFE14D', 'center', 760);
    else if (runRank && runRank.queued) txt('OFFLINE · SCORE WILL BE SENT LATER', W / 2, 474 + (ccl ? 8 : 0), 20, '#ddd', 'center', 760);
    if (st > .5) {
      if (!last) button(40, 500, 220, 66, 'NEXT ►', afterClear, { fill: '#5CFF7A' });
      button(last ? 110 : 290, 500, last ? 280 : 220, 66, 'SHARE', () => doShare('stage_clear'), { fill: '#4DB8FF' });
      button(last ? 410 : 540, 500, last ? 280 : 220, 66, 'STAGES', goMenu);
    }

  } else if (state === 'profile') {
    bg('#2b2757', '#322d66', now);
    txt('PROFILE', W / 2, 40, 54, '#FFE14D');
    button(14 - OX, 10, 130, 56, '◄ BACK', back, { size: 22 });
    claude(W / 2, 205, 6, { mood: 'happy' });
    txt('SAVE YOUR PROGRESS · JOIN THE LEADERBOARDS', W / 2, 262, 22, '#fff', 'center', 740);
    const ok = pf.avail === 'yes' || pf.avail === 'loading', bx = 190, by = 298, bw = 420, bh = 84;
    if (ok && !pf.busy) hoverBox(bx, by, bw, bh, '#fff', 5); else box3(bx, by, bw, bh, ok ? '#fff' : '#bdbbc9', 5, 5);
    googleG(bx + 56, by + bh / 2, 20, !ok);
    ctx.font = '900 25px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ok ? INK : '#6d6a80'; ctx.fillText(t(pf.busy ? 'Waiting for Google...' : 'Sign in with Google'), bx + 96, by + bh / 2 + 2, bw - 110);
    if (ok && !pf.busy) ctx.restore();
    if (pf.busy) button(bx + 60, by + bh + 18, bw - 120, 46, 'CANCEL', cancelGoogle, { size: 20, fill: '#FFE14D' });
    else if (pf.avail === 'down') { txt('CAN\'T REACH SERVER RIGHT NOW', W / 2, by + bh + 36, 22, '#FF4D4D', 'center', 740); button(300, by + bh + 62, 200, 46, 'RETRY', checkSignIn, { size: 20, fill: '#FFE14D' }); }
    else if (pf.avail === 'no') txt('SIGN-IN NOT AVAILABLE RIGHT NOW', W / 2, by + bh + 36, 24, '#FF4D4D', 'center', 740);
    if (!pf.busy && pf.avail !== 'no' && pf.avail !== 'down') btns.push({ x: bx, y: by, w: bw, h: bh, fn: doGoogle });
    if (pf.msg && !pf.busy && pf.avail !== 'no' && pf.avail !== 'down') txt(pf.msg, W / 2, by + bh + 36, 20, pf.msgCol, 'center', 740);
    hoverBox(190, 500, 420, 50, '#5CFF7A', 4);
    txt('OR JUST PLAY AS A GUEST', W / 2, 526, 22, INK, 'center', 400); ctx.restore();
    btns.push({ x: 190, y: 500, w: 420, h: 50, fn: back });
    txt('GUESTS KEEP PLAYING FULLY OFFLINE · NO PASSWORD EVER', W / 2, 578, 16, '#ddd', 'center', 760);
  } else if (state === 'board') {
    bg('#1f2a44', '#26335a', now);
    const n = STAGES.length + 1, tp = pageCount(n, PER_TABS), tot = lb.tab === STAGES.length, s = STAGES[lb.tab];
    txt('LEADERBOARD', W / 2, 38, 44, '#FFE14D');
    button(14 - OX, 10, 130, 56, '◄ BACK', back, { size: 22 });
    if (tp > 1) {
      button(56, 80, 56, 52, '◄', () => { lb.page = (lb.page + tp - 1) % tp; }, { size: 24, fill: '#FFE14D' });
      button(W - 112, 80, 56, 52, '►', () => { lb.page = (lb.page + 1) % tp; }, { size: 24, fill: '#FFE14D' });
    }
    for (let k = 0; k < PER_TABS; k++) {
      const i = lb.page * PER_TABS + k; if (i >= n) break;
      button(128 + k * 90, 80, 82, 52, i === STAGES.length ? 'ALL' : String(i + 1), () => setTab(i), { size: 24, fill: i === lb.tab ? '#5CFF7A' : '#fff' });
    }
    txt(tot ? 'TOTAL · BEST OF EVERY STAGE' : t('STAGE {n} · {name}', { n: lb.tab + 1, name: t(s.name) }), W / 2, 168, 28, tot ? '#5CFF7A' : '#fff', 'center', 740);
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
        txt(t(inTop ? 'YOU: #{rank} OF {players} · {score}' : 'YOU: #{rank} OF {players} · {score}  (OUTSIDE TOP 20)', { rank: d.me.rank, players: d.players, score: d.me.score }), W / 2, 530, 24, '#FFE14D', 'center', 760);
      } else if (net.user) txt('YOU HAVEN\'T SET A SCORE HERE YET', W / 2, 530, 20, '#ddd');
      else txt('GUEST · SIGN IN WITH GOOGLE (PROFILE) TO GET RANKED', W / 2, 530, 20, '#ddd');
    } else if (c.err) {
      txt(c.err, W / 2, 300, 30, '#FF4D4D', 'center', 740);
      button(300, 340, 200, 56, 'RETRY', () => loadBoard(lb.tab), { size: 24, fill: '#FFE14D' });
    } else txt('LOADING...', W / 2, 320, 36, '#fff');
    if (!TOUCH) txt('◄ ► TAB · ESC BACK', W + OX - 12, 584, 14, '#ddd', 'right');
    if (!net.user && !c.err) button(W + OX - 184, 10, 170, 56, 'PROFILE', goProfile, { size: 22, fill: '#5CFF7A' });
  } else if (state === 'friends') {
    bg('#1f2a44', '#26335a', now);
    txt('FRIENDS', W / 2, 38, 44, '#FFE14D');
    button(14 - OX, 10, 130, 56, '◄ BACK', back, { size: 22 });
    if (!net.user) {
      claude(W / 2, 215, 6, { mood: 'happy' });
      txt('SIGN IN WITH GOOGLE TO FOLLOW PLAYERS', W / 2, 290, 26, '#fff', 'center', 740);
      txt('FOLLOW EACH OTHER = FRIENDS', W / 2, 328, 20, '#ddd', 'center', 740);
      button(250, 380, 300, 64, 'PROFILE', goProfile, { fill: '#5CFF7A', size: 28 });
    } else {
      button(W + OX - 184, 10, 170, 56, 'ADD', openAddFriend, { size: 22, fill: '#5CFF7A' });
      for (let i = 0; i < 3; i++) button(40 + i * 245, 80, 235, 52, t(FR_TABS[i], { n: fr.list ? frOf(i).length : '-' }), () => { fr.tab = i; fr.page = 0; }, { size: 20, fill: i === fr.tab ? '#FFE14D' : '#fff' });
      const list = frOf(fr.tab), pages = pageCount(list.length, FR_PER);
      if (fr.list) {
        if (!list.length) {
          txt(fr.tab === 0 ? 'NO FRIENDS YET' : fr.tab === 1 ? 'YOU\'RE NOT FOLLOWING ANYONE' : 'NOBODY FOLLOWS YOU YET', W / 2, 280, 30, '#fff', 'center', 740);
          txt('PRESS ADD OR OPEN SOMEONE\'S PROFILE FROM THE LEADERBOARD', W / 2, 322, 18, '#ddd', 'center', 740);
        }
        list.slice(fr.page * FR_PER, fr.page * FR_PER + FR_PER).forEach((f, i) => {
          const y = 150 + i * 56, act = fr.tab === 2 && !f.following, w = act ? 560 : 720, mut = f.following && f.followsMe;
          box(40, y, w, 50, i % 2 ? '#35406a' : '#2c3659', 3);
          claude(80, y + 46, 2.2, { col: f.color });
          ctx.save(); txt(f.username, 112, y + 25, 22, f.color, 'left', 250); ctx.restore();
          txt(mut ? '✓ FRIENDS' : f.following ? 'FOLLOWING' : 'FOLLOWS YOU', 395, y + 25, 16, mut ? '#5CFF7A' : f.following ? '#FFE14D' : '#ddd', 'left', 140);
          txt(String(f.total), 40 + w - 12, y + 25, 20, '#fff', 'right');
          btns.push({ x: 40, y, w, h: 50, fn: () => openProfile(f.username) });
          if (act) button(610, y, 150, 50, 'FOLLOW BACK', () => followToggle(f.uid, f.username), { size: 16, fill: '#5CFF7A' });
        });
        if (pages > 1) {
          button(40, 530, 90, 50, '◄', () => { fr.page = (fr.page + pages - 1) % pages; }, { size: 24, fill: '#FFE14D' });
          button(670, 530, 90, 50, '►', () => { fr.page = (fr.page + 1) % pages; }, { size: 24, fill: '#FFE14D' });
          txt(t('PAGE {n}/{total}', { n: fr.page + 1, total: pages }), W / 2, 556, 18, '#fff');
        }
      } else if (fr.err) {
        txt(fr.err, W / 2, 300, 30, '#FF4D4D', 'center', 740);
        button(300, 340, 200, 56, 'RETRY', loadFriends, { size: 24, fill: '#FFE14D' });
      } else txt('LOADING...', W / 2, 320, 36, '#fff');
      if (fr.add) {
        btns = []; ctx.fillStyle = 'rgba(10,8,24,.8)'; ctx.fillRect(-OX, 0, VW, H);
        box(150, 150, 500, 300, '#2b2757', 6);
        txt('ADD A FRIEND', W / 2, 195, 40, '#FFE14D');
        txt('TYPE THEIR PLAYER NAME', W / 2, 232, 17, '#ddd');
        button(215, 340, 170, 52, fr.busy ? '...' : 'FIND', doAddFriend, { size: 24, fill: '#5CFF7A' });
        button(415, 340, 170, 52, 'CANCEL', closeAddFriend, { size: 24 });
        if (fr.msg) txt(fr.msg, W / 2, 418, 18, fr.msg === 'ONE MOMENT...' ? '#fff' : '#FF4D4D', 'center', 470);
      }
    }
  } else if (state === 'pview') {
    bg('#2b2757', '#322d66', now);
    button(14 - OX, 10, 130, 56, '◄ BACK', back, { size: 22 });
    const d = pv.data, me = net.user && pv.name === net.user.username;
    if (!d) {
      txt(pv.loading ? 'LOADING...' : pv.err, W / 2, 300, 36, pv.loading ? '#fff' : '#FF4D4D', 'center', 740);
      if (!pv.loading) button(300, 340, 200, 56, 'RETRY', () => openProfile(pv.name), { size: 24, fill: '#FFE14D' });
    } else {
      claude(110, 215, 8, { col: d.color, mood: 'happy' });
      txt(d.username, 210, 110, 52, d.color, 'left', 560);
      txt(d.rank ? t('RANK #{rank} · TOTAL {total}', { rank: d.rank, total: d.total }) : 'NOT RANKED YET', 210, 165, 28, '#fff', 'left', 370);
      if (me) button(590, 150, 190, 50, 'FRIENDS', goFriends, { size: 22, fill: '#5CFF7A' });
      else if (!net.user) button(560, 150, 220, 50, 'SIGN IN TO FOLLOW', goProfile, { size: 16, fill: '#FFE14D' });
      else if (fr.list) {
        const rl = frRel(d.uid), fol = !!(rl && rl.following), mut = fol && rl.followsMe;
        button(590, 150, 190, 50, fr.busy ? '...' : mut ? '✓ FRIENDS' : fol ? 'FOLLOWING' : rl && rl.followsMe ? 'FOLLOW BACK' : 'FOLLOW', () => followToggle(d.uid, d.username), { size: 22, fill: fol ? '#FFE14D' : '#5CFF7A' });
        if (rl && rl.followsMe && !fol) txt('FOLLOWS YOU', 685, 238, 15, '#5CFF7A', 'center', 190);
      }
      stars3(260, 210, Math.min(3, Math.round(d.totalStars / (STAGES.length * 3) * 3)), 18, 48);
      txt(t('{stars}/{max} STARS · {unlocked}/{stages} UNLOCKED', { stars: d.totalStars, max: STAGES.length * 3, unlocked: d.unlocked, stages: STAGES.length }), 340, 210, 18, '#ddd', 'left', 440);
      const cw = 146, ch = 112;
      STAGES.forEach((s2, i) => {
        const x = 24 + (i % 5) * (cw + 10), y = 262 + (i / 5 | 0) * (ch + 12), played2 = d.best[i] > 0 || d.stars[i] > 0;
        box(x, y, cw, ch, played2 ? s2.bg[0] : '#5a5870', 4);
        txt(t('STAGE {n}', { n: i + 1 }), x + 8, y + 14, 14, '#fff', 'left', cw - 40);
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
      btns = []; ctx.fillStyle = 'rgba(10,8,24,.8)'; ctx.fillRect(-OX, 0, VW, H);
      box(150, 150, 500, 300, '#2b2757', 6);
      txt('CHANGE NAME', W / 2, 195, 40, '#FFE14D');
      txt('3-16 LETTERS, NUMBERS, _ -', W / 2, 232, 17, '#ddd');
      button(215, 340, 170, 52, rn.busy ? '...' : 'SAVE', doRename, { size: 24, fill: '#5CFF7A' });
      button(415, 340, 170, 52, 'CANCEL', closeRename, { size: 24 });
      if (rn.msg) txt(rn.msg, W / 2, 418, 18, rn.msg === 'ONE MOMENT...' ? '#fff' : '#FF4D4D', 'center', 470);
    }
  }
  vignette(state === 'play' ? .22 : .35);
  if (state !== 'play' && st < .3) {                    // slanted ink curtain wipes off to the right on every screen change
    const x0 = -OX + easeOut(st / .3) * (VW + 160), xr = W + OX + 200;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(xr, 0); ctx.lineTo(xr, H); ctx.lineTo(x0 - 160, H); ctx.closePath(); ctx.fill();
  }
  drawToast(lastDt); placeInputs();
}

/* ───────────── input events ───────────── */
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') { // typing in a profile field: don't leak keys into the game
    if (e.target.id === 'in-code') { if (e.code === 'Enter') { e.preventDefault(); joinTyped(); } else if (e.code === 'Escape') e.target.blur(); return; }
    if (e.target.id === 'in-friend') { if (e.code === 'Enter') { e.preventDefault(); doAddFriend(); } else if (e.code === 'Escape') closeAddFriend(); return; }
    if (e.code === 'Enter') { e.preventDefault(); doRename(); }
    else if (e.code === 'Escape') closeRename();
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  interacted = true;
  if (e.code === 'KeyM') { muted = !muted; if (!muted) sfx.click(); return; }
  keys[e.code] = true;
  if (e.repeat) return;
  if (sh.on && e.code !== 'Escape') return;
  const go = e.code === 'Enter' || e.code === 'Space';
  if (e.code === 'Escape') {
    if (sh.on) { sh.on = false; return; }
    if (rn.on) { closeRename(); return; }
    if (fr.add && state === 'friends') { closeAddFriend(); return; }
    if (mode === 'party' && (state === 'play' || (state === 'party' && party.view !== 'menu' && party.view !== 'lobby'))) return;   // no accidental leaving mid-match
    if (state === 'party') { party.view === 'lobby' ? partyLeave('menu') : goTitle(); return; }
    if (state === 'play' || state === 'inter' || state === 'stagein') exitPlay();
    else if (state === 'menu') goTitle(); else if (state === 'practice') goMenu();
    else if (state === 'profile' || state === 'board' || state === 'pview' || state === 'friends') back();
    return;
  }
  if (state === 'title' && go) titleGo();
  else if (state === 'title' && e.code === 'KeyA') goProfile();
  else if (state === 'title' && e.code === 'KeyF') goParty('title');
  else if (state === 'title' && e.code === 'KeyG') I18N.next();
  else if (state === 'board') { if (e.code === 'ArrowRight') setTab(lb.tab + 1); else if (e.code === 'ArrowLeft') setTab(lb.tab - 1); }
  else if (state === 'profile' && go) doGoogle();
  else if (state === 'party' && go) { if (party.view === 'lobby') partyStart(); else if (party.view === 'end' && isHost() && st > .6) partyAgain(); }
  else if (state === 'menu') {
    const d = +e.key, mp = pageCount(STAGES.length, PER_MENU);
    if (d >= 1 && d <= 6 && menuPage * PER_MENU + d - 1 < STAGES.length) startStage(menuPage * PER_MENU + d - 1);
    else if (e.code === 'KeyP') goPractice();
    else if (e.code === 'KeyL') goBoard();
    else if (e.code === 'KeyA') goProfile();
    else if (e.code === 'ArrowRight') menuPage = (menuPage + 1) % mp; else if (e.code === 'ArrowLeft') menuPage = (menuPage + mp - 1) % mp;
  } else if (state === 'practice') {
    const pp = pageCount(PREG.length, PER_PRACTICE);
    if (e.code === 'ArrowRight') practicePage = (practicePage + 1) % pp; else if (e.code === 'ArrowLeft') practicePage = (practicePage + pp - 1) % pp;
  }
  else if (state === 'over' && go && st > .4) startStage(stageIdx);
  else if (state === 'clear' && go && st > .5) afterClear();
  if (state === 'play' && !outcome && pre <= 0 && cur.key) cur.key(e);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (state === 'play' && !outcome && pre <= 0 && cur.keyup) cur.keyup(e);
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// phones: go fullscreen so the browser bars stop eating the canvas once it's rotated to landscape.
// Browsers only allow this from a user gesture (not from the rotation itself), so it runs on the first tap,
// in either orientation, and rotating afterwards fills the screen right away.
function goFull() {
  if (!TOUCH || document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rq) return;                                          // iPhone Safari: no element fullscreen (Add to Home Screen covers it)
  try { const p = rq.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (_) {}
}

let sw = null;
const inGame = p => (cur && cur.wide) ? p : ({ ...p, x: Math.max(0, Math.min(W, p.x)) });   // classic games only see their own 800×600 area; g.wide games get the full screen (x from -OX to W+OX)
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  goFull();
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
  interacted = true; pressing = true;
  const p = pos(e); mouse = inGame(p); hp = p;
  const b = btns.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
  if (b) { sfx.click(); b.fn(); return; }
  if (sh.on) return;
  if (state === 'title') { titleGo(); return; }
  if (state === 'play' && !outcome && pre <= 0) { const g = inGame(p); sw = { x: g.x, y: g.y }; if (cur.move) cur.move(g); if (cur.down) cur.down(g); }
});
cv.addEventListener('pointermove', e => {
  const raw = pos(e), p = inGame(raw); mouse = p; hp = raw;
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
const endPtr = e => { pressing = false; if (e.pointerType === 'touch') hp = { x: -999, y: -999 }; if (state === 'play' && !outcome && pre <= 0 && cur.up) cur.up(inGame(pos(e))); sw = null; };
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => { hp = { x: -999, y: -999 }; pressing = false; });

let lastTs = 0, lastDt = 0;
function loop(ts) {
  const dt = Math.min(.05, (ts - lastTs) / 1000 || 0); lastTs = ts; now += dt; lastDt = dt;
  update(dt); updateFx(dt); syncMusic();
  if (state !== lastState) {                              // screen-change whoosh (not on every microgame)
    if (['stagein', 'menu', 'practice', 'profile', 'board', 'pview', 'party', 'friends'].includes(state) || (state === 'inter' && mode === 'stage')) sfx.whoosh(true);
    lastState = state;
  }
  ctx.setTransform(1, 0, 0, 1, OX, 0); ctx.save(); applyShake(dt); render(); drawFx(); if (sh.on) drawShareMenu(); ctx.restore();
  const hb = btns.find(b => hovered(b.x, b.y, b.w, b.h)), hk = hb ? hb.x + ',' + hb.y : '';
  if (hk !== hoverKey) { hoverKey = hk; if (hk && state !== 'play') sfx.tick(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
