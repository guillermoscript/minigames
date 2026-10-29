'use strict';
/* RÉCORDS on the menu kit (docs/ui/01-menu-redesign.md §1, K0). CLÁSICO: the online leaderboards (js/main.js loadBoard / setTab),
   one stage at a time with a ◄ ► stepper and a TOTAL toggle. VENEZUELA has no server board yet: it shows this device's records
   per level and says the online one is coming. */
let lbWorld = 0, lbPage = 0;
const LB_ROWS = 4;   // per column in the wide layout (two columns, then the pager)
function boardStep(d) { const n = STAGES.length; setTab(lb.tab === n ? (d > 0 ? 0 : n - 1) : (lb.tab + d + n) % n); lbPage = 0; }   // stages wrap; from TOTAL, to the first or last
function boardRow(e, i, x, y, w) {
  const mine = net.user && e.username === net.user.username;
  MCUI.tile('lbr-' + i, x, y, w, 52, mine ? '#FFE14D' : i % 2 ? '#35406a' : '#2c3659', dy => {
    const ink = mine ? INK : '#fff';
    MCUI.text('#' + e.rank, x + 12, y + 27 + dy, 16, i < 3 && !mine ? ['#FFE14D', '#dfe6f2', '#e8a070'][i] : ink, 'left');
    caos(x + 92, y + 44 + dy, 2.2, { col: e.color });
    MCUI.text(e.username, x + 116, y + 27 + dy, 16, mine ? INK : e.color, 'left', w - 116 - 92);
    MCUI.text(String(e.score), x + w - 12, y + 27 + dy, 16, ink, 'right');
  }, () => openProfile(e.username), { depth: 4 });
}
function drawBoardClassic(x, w, y) {
  const V = MCUI.view(), tot = lb.tab === STAGES.length, s = STAGES[lb.tab];
  // stepper: ◄ STAGE n · NAME ► and TOTAL
  const tw = V.tall ? w : w - 176;
  MCUI.btn('lb-prev', x, y, 56, 56, '', () => boardStep(-1), { icon: 'left', tone: 'gold' });
  MCUI.panel(x + 68, y, tw - 136, 56, { tone: 'panelDk' });
  MCUI.label(tot ? 'TOTAL · BEST OF EVERY STAGE' : t('STAGE {n} · {name}', { n: lb.tab + 1, name: t(s.name) }), x + tw / 2, y + 28, tw - 152, 52, 16, tot ? '#5CFF7A' : '#fff');
  MCUI.btn('lb-next', x + tw - 56, y, 56, 56, '', () => boardStep(1), { icon: 'right', tone: 'gold' });
  if (V.tall) y += 72;
  MCUI.btn('lb-total', V.tall ? x : x + w - 160, y, 160, 56, tot ? 'STAGES' : 'TOTAL', () => { setTab(tot ? 0 : STAGES.length); lbPage = 0; }, { tone: tot ? 'paper' : 'go' });
  const c = lb.cache[lb.tab] || {}, d = c.data, top = y + 72;
  const me = !d ? '' : d.me ? t(d.entries.some(e => net.user && e.username === net.user.username) ? 'YOU: #{rank} OF {players} · {score}' : 'YOU: #{rank} OF {players} · {score}  (OUTSIDE TOP 20)', { rank: d.me.rank, players: d.players, score: d.me.score })
    : net.user ? 'YOU HAVEN\'T SET A SCORE HERE YET' : 'GUEST · SIGN IN WITH GOOGLE (PROFILE) TO GET RANKED';
  if (V.tall) { if (me) MCUI.text(me, x + (w - 176) / 2 + 176, y + 20, 8, d && d.me ? '#FFE14D' : '#ddd', 'center', w - 184); }
  else if (me) MCUI.text(me, x, 488, 8, d && d.me ? '#FFE14D' : '#ddd', 'left', w - 260);
  if (!d) {
    if (c.err) { MCUI.text(c.err, V.w / 2, top + 60, 16, '#FF4D4D', 'center', V.w - 32); MCUI.btn('lb-retry', (V.w - 200) / 2, top + 96, 200, 56, 'RETRY', () => loadBoard(lb.tab), { tone: 'gold' }); }
    else MCUI.text('LOADING...', V.w / 2, top + 60, 16, '#fff');
    return;
  }
  if (!d.entries.length) { MCUI.text('NO SCORES YET - BE FIRST!', V.w / 2, top + 60, 16, '#fff', 'center', V.w - 32); return; }
  if (V.tall) {
    const off = MCUI.scrollStart('board', top, V.h - 8, d.entries.length * 60 + 8);
    d.entries.forEach((e, i) => boardRow(e, i, x, top + 4 + i * 60 + off, w));
    MCUI.scrollEnd();
    return;
  }
  const per = LB_ROWS * 2, pages = pageCount(d.entries.length, per); lbPage = Math.min(lbPage, pages - 1);
  d.entries.slice(lbPage * per, lbPage * per + per).forEach((e, k) => boardRow(e, lbPage * per + k, x + (k / LB_ROWS | 0) * (w / 2 + 8), top + (k % LB_ROWS) * 56, w / 2 - 8));
  MCUI.pager('lbpage', V.w - 160, 504, lbPage, pages, p => { lbPage = p; }, 'lbr-');
}
/* Venezuela: this device's records per stage and level (docs/style-lab/campana.js keeps them in minicaos-lab-niveles-v1) */
function drawBoardVenezuela(x, w, y) {
  const V = MCUI.view(), sv = readJSON('minicaos-lab-niveles-v1') || {};
  const best = n => (n === 1 ? sv.best : sv['best' + n]) || [], stars = n => (n === 1 ? sv.stars : sv['stars' + n]) || [];
  MCUI.panel(x, y, w, 56, { tone: 'panelDk', band: MCUI.WORLD.venezuela });
  MCUI.label('ONLINE RECORDS COMING SOON · THESE ARE YOURS ON THIS DEVICE', x + w / 2, y + 32, w - 32, 48, 8, '#FFE14D');
  const cols = ['LEVEL 1', 'LEVEL 2', 'LEVEL 3'], lx = x + (V.tall ? 96 : 200), cw = (x + w - lx) / 3;
  cols.forEach((c, i) => MCUI.text(c, lx + cw * i + cw / 2, y + 84, 8, '#ddd', 'center', cw - 8));
  for (let e = 0; e < 5; e++) {
    const ry = y + 100 + e * 56;
    MCUI.panel(x, ry, w, 44, { tone: e % 2 ? '#35406a' : '#2c3659' });
    MCUI.text(t('STAGE {n}', { n: e + 1 }), x + 16, ry + 22, V.tall ? 8 : 16, '#fff', 'left', lx - x - 24);
    for (let n = 1; n <= 3; n++) {
      const b = best(n)[e] || 0, s = stars(n)[e] || 0, cx = lx + cw * (n - 1) + cw / 2;
      MCUI.text(b ? String(b) : '-', cx, ry + 14, V.tall ? 8 : 16, b ? '#fff' : '#8f8b9c', 'center', cw - 8);
      for (let k = 0; k < 3; k++) MCUI.icon('star', cx + (k - 1) * 14, ry + 33, 2, k < s ? '#FFE14D' : 'rgba(255,255,255,.18)');
    }
  }
}
function drawBoard() {
  const V = MCUI.view(), x = V.tall ? 16 : 40, w = V.tall ? V.w - 32 : 720;
  MCUI.bg('menu');
  MCUI.header('RECORDS');
  MCUI.back(back, 'GO BACK');
  kitChip();
  MCUI.tabBar('lbw', x, 104, V.tall ? w : 360, 52, ['CLASSIC', 'VENEZUELA'], lbWorld, i => { lbWorld = i; });
  if (!net.user && lbWorld === 0 && !V.tall) MCUI.btn('lb-signin', x + 376, 104, w - 376, 48, 'MY PROFILE', goProfile, { tone: 'lilac', size: 16 });
  if (lbWorld === 0) drawBoardClassic(x, w, 172); else drawBoardVenezuela(x, w, 172);
  MCUI.keybar([['ESC', 'GO BACK'], ['Q/E', 'WORLD'], ['ENTER', 'SEE PROFILE']]);
}
