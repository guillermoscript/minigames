'use strict';
/* CO-OP TEST: play any DUO / SQUAD microgame alone against the computer. Every other seat is a bot (js/coop-bots.js, the same bots
   test/duo.test.js and test/squad.test.js use) driving a hidden copy of the game; copies talk through an in-memory relay with a small
   delay, like the live one. You play your seat on the real screen, as in practice. Menu: CO-OP TEST (or key C); direct: ?coop=du_hippo[&seats=3][&role=1] */
const COOP = { on: false, n: 3, role: -1, page: 0, id: null, games: [], bots: [], handlers: [], q: [], T: 0, dur: 1, delay: .06, idle: false };
const COOP_PER = 24;
const coopList = () => REG.filter(r => r.duo || r.squad);
const coopEvery = (T, st, k) => { const n = Math.floor(T / k); if (n !== st.n) { st.n = n; return true; } return false; };
function goCoop() { EGGS.stop(); COOP.on = false; state = 'coop'; st = 0; mode = 'practice'; parts.length = 0; }
function startCoop(id) { COOP.on = true; COOP.id = id; EGGS.stage(); track('coop_test_start', { game: id }); mode = 'practice'; practiceId = id; lastOut = null; stage = STAGES[0]; state = 'inter'; st = 0; }
function coopBuild(id, sp) {
  const e = REGMAP[id], n = e.squad ? COOP.n : 2, role = COOP.role >= 0 && COOP.role < n ? COOP.role : Math.random() * n | 0, seed = Math.random() * 2147483647 | 0;
  const C = COOP; C.q = []; C.handlers = Array(n).fill(null); C.games = []; C.bots = []; C.T = 0; C.myRole = role;
  const seats = Array.from({ length: n }, (_, r) => ({ id: 'cpu' + r, name: r === role ? 'YOU' : 'CPU ' + (r + 1), color: r === role ? '#FFE14D' : '#6EA8FE', role: r, you: r === role }));
  const mk = r => ({ role: r, roles: n, partner: { name: 'CPU', color: '#6EA8FE' }, seats, byRole: seats.slice(),
    send(t, d) { const data = JSON.parse(JSON.stringify(d === undefined ? null : d)); for (let to = 0; to < n; to++) if (to !== r) C.q.push({ at: C.T + C.delay, to, from: r, t, d: data }); },
    onMsg(fn) { C.handlers[r] = fn; } });
  for (let r = 0; r < n; r++) C.games[r] = withSeed(seed, () => e.fn(sp, mk(r)));
  const make = window.COOP_BOTS && window.COOP_BOTS[id], list = make ? (e.squad ? make(n) : make) : null;
  C.idle = !list;
  for (let r = 0; r < n; r++) if (r !== role) {
    C.bots[r] = list && list[r] ? list[r](C.games[r], r, { every: coopEvery }) : {};
    const orig = C.handlers[r], bot = C.bots[r];
    C.handlers[r] = (t, d, from) => { if (orig) orig(t, d, from); if (bot.on) bot.on(t, d, from); };
  }
  C.dur = C.games[role].dur / Math.sqrt(sp);
  return C.games[role];
}
function coopQuiet(fn) {   // the computer's copies must not make noise, confetti or floating text on YOUR screen
  const o = snd, np = parts.length, nf = fxs.length;
  snd = () => {};
  try { fn(); } finally { snd = o; parts.length = np; fxs.length = nf; }
}
function coopStep(dt, tt) {
  const C = COOP; C.T = tt;
  const due = C.q.filter(m => m.at <= tt);
  if (due.length) { C.q = C.q.filter(m => m.at > tt); coopQuiet(() => due.forEach(m => { const h = C.handlers[m.to]; if (h && m.to !== C.myRole) h(m.t, m.d, m.from); })); due.filter(m => m.to === C.myRole).forEach(m => { const h = C.handlers[m.to]; if (h) h(m.t, m.d, m.from); }); }
  coopQuiet(() => C.games.forEach((g, i) => {
    if (i === C.myRole) return;
    const end = C.dur + (g.duoWait ? DUO_WAIT : 0), bot = C.bots[i];
    if (!g.result && tt < end) { if (tt < C.dur && bot.tick) bot.tick(tt, dt); g.update(dt, tt); if (!g.result && tt + dt >= end) g.result = 'lose'; }
  }));
}
function coopHud() {
  const g = cur, n = COOP.games.length; if (!g || !g.roles) return;
  ctx.fillStyle = 'rgba(20,16,28,.5)'; ctx.fillRect(10 - OX, 84, 262, 22 + 20 * n - 20 + 18);
  txt(t('YOU: {role}', { role: t(g.roles[COOP.myRole].label) }), 18 - OX, 100, 17, '#FFE14D', 'left', 248);
  g.roles.forEach((r, i) => { if (i !== COOP.myRole) txt(t('CPU {n}: {role}', { n: i + 1, role: t(r.label) }), 18 - OX, 118 + (i - (i > COOP.myRole ? 1 : 0)) * 17, 14, '#9fd0ff', 'left', 248); });
  if (COOP.idle) txt('NO CPU BOT FOR THIS GAME YET', W / 2, 560, 18, '#FF4D4D');
}
function drawCoop() {
  bg('#1f3a44', '#264a5a', now);
  txt('CO-OP TEST', W / 2, 38, 40, '#FFE14D', 'center', 240);
  button(14 - OX, 10, 130, 56, '◄ BACK', goPractice, { size: 22 });
  button(W + OX - 184, 10, 170, 56, t('SPEED x{n}', { n: practiceSp }), () => { practiceSp = practiceSp === 1 ? 1.5 : practiceSp === 1.5 ? 2 : 1; }, { size: 22, fill: '#FFE14D' });
  const list = coopList(), pp = pageCount(list.length, COOP_PER);
  button(150, 10, 56, 56, '◄', () => { COOP.page = (COOP.page + pp - 1) % pp; }, { size: 24 });
  button(W - 250, 10, 56, 56, '►', () => { COOP.page = (COOP.page + 1) % pp; }, { size: 24 });
  txt(`${COOP.page + 1}/${pp}`, W / 2, 68, 15, '#fff');
  button(26, 78, 360, 40, COOP.role < 0 ? t('YOUR ROLE: RANDOM') : t('YOUR ROLE: {n}', { n: COOP.role + 1 }), () => { COOP.role = COOP.role >= 3 ? -1 : COOP.role + 1; }, { size: 18, depth: 4, fill: '#fff' });
  button(414, 78, 360, 40, t('SQUAD GAMES: {n} PLAYERS', { n: COOP.n }), () => { COOP.n = COOP.n === 3 ? 4 : 3; }, { size: 18, depth: 4, fill: '#fff' });
  list.forEach((r, ri) => {
    if ((ri / COOP_PER | 0) !== COOP.page) return;
    const i = ri % COOP_PER, x = 26 + (i % 6) * 126, y = 132 + (i / 6 | 0) * 102, bot = !!(window.COOP_BOTS && window.COOP_BOTS[r.id]);
    hoverBox(x, y, 118, 92, r.squad ? `hsl(${150 + i * 9},60%,62%)` : `hsl(${20 + i * 11},75%,70%)`, 4, 5);
    I18N.scope = I18N.scopeOf(r.id); txt(r.name, x + 59, y + 40, 18, '#fff', 'center', 106); I18N.scope = '';
    txt(r.squad ? 'SQUAD' : 'DUO', x + 59, y + 76, 13, bot ? INK : '#FF4D4D'); ctx.restore();
    btns.push({ x, y, w: 118, h: 92, fn: () => startCoop(r.id) });
  });
  txt('DUO = 2 SEATS · SQUAD = 3-4 SEATS · THE OTHER SEATS ARE PLAYED BY THE COMPUTER', W / 2, 580, 15, '#fff', 'center', 780);
}
function coopBoot() {
  const q = new URLSearchParams(location.search), id = q.get('coop');
  if (!id) return;
  if (+q.get('seats') >= 3) COOP.n = Math.min(4, +q.get('seats'));
  if (q.has('role')) COOP.role = (+q.get('role') || 1) - 1;
  if (REGMAP[id] && (REGMAP[id].duo || REGMAP[id].squad)) startCoop(id); else goCoop();
}
