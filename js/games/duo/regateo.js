'use strict';
/* ═════════ DUO · REGATEO EN EL MERCADO (du_regateo): a street-market fruit stall, Don Chucho and his famous mustache ═════════
   THE OFFER (role 0, JUDGE): owns the price. DRAG LEFT / RIGHT anywhere (or ◄ ► / A D) slides the banknote along the price ruler. Sees Don Chucho's mood
   (face, forehead vein, twitching mustache, the 3 chilis of patience) but NOT his lowest price and NOT the budget. The offer starts at his asking price.
   THE EYE (role 1): reads the crooked chalk sign on the wall (the seller's last price, a 6-wide window that always holds it), the shopping list and the
   budget, and rings the bell (tap anywhere / space) to CLOSE THE DEAL at the price it is looking at. Cannot touch the price: has to TALK ("lower, a bit up, now!").
   2 products, one after the other. A deal is accepted if price >= the seller's reserve. An offer under the reserve makes him frown (patience drains); under 85 %
   he is insulted: patience drains fast and his reserve CLIMBS. Ringing under the reserve = "ni loco": patience -.3 and the reserve climbs. Paying a lot eats the budget.
   WIN: both products bought and the total is within the budget. LOSE: patience runs out (thrown out), the total is over the budget, or time. Gag: the señora of
   the stall throws a mango (a free ñapa on a win, a splat on the offerer's face on a loss).
   Netcode (all absolute, latest, repeated so a dropped message never matters): the OFFER publishes 's' [round, offer, patience*1000, raise, spent0, spent1, mood,
   refusals, reason] every change (<= 20/s) and every .4 s; the EYE publishes 'k' [count, round, price] every .5 s: the deal is closed at the price the eye SAW
   (lag is not the players' fault), only if the round still matches, and each count is processed once. The level comes from mkR(), identical on both screens. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only
const rgbC = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixC = (a, b, k) => { const A = rgbC(a), B = rgbC(b); k = clamp(k, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── tuning ───────────── */
const PMAX = 100, SX0 = 130, SX1 = 670, RY = 452;            // price range, ruler ends (x), ruler y
const SLACK = 14, WIN = 6, PAUSE = .8;                       // budget slack over the two reserves, hint window width, pause after a deal
const BELL = { x: 600, y: 352 };
const PROD = ['MANGOES', 'AVOCADOS', 'PINEAPPLES', 'BANANAS'];
const px = p => SX0 + clamp(p, 0, PMAX) / PMAX * (SX1 - SX0), fromX = x => clamp(Math.round((x - SX0) / (SX1 - SX0) * PMAX), 0, PMAX);

/* ───────────── drawing kit (X is ctx while playing, an offscreen context while a layer is baked) ───────────── */
let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function circ2(x, y, r, fill, o = 3) { X.beginPath(); X.arc(x, y, r, 0, TAU); ink(fill, o); }
function ntx(s, x, y, size, fill, align = 'center') {          // number text that also works on a baked layer (no translation)
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; X.textAlign = align; X.textBaseline = 'middle'; X.lineJoin = 'round'; X.lineWidth = size / 4.5; X.strokeStyle = INK; X.strokeText(s, x, y); X.fillStyle = fill; X.fillText(s, x, y);
}
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(170, X.measureText(t(label)).width + 24);
  X.beginPath(); X.moveTo(x - 8, y + 11); X.lineTo(x, y + 21); X.lineTo(x + 8, y + 11); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(380, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 380); X.restore();
}
function arm(u, sx, an, k, col) {            // blocky arm at a caos's shoulder (translate to feet first)
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
}

/* ───────────── produce ───────────── */
function prod(k, x, y, s, rot = 0) {         // 0 mango, 1 avocado, 2 pineapple, 3 bananas
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  if (k === 0) {
    cel('#ffa62b', '#e0701e', () => el(0, 0, 17, 14, -.4), 5, -3, 3); X.fillStyle = 'rgba(255,90,60,.55)'; el(7, 4, 8, 6, -.4); X.fill();
    X.beginPath(); X.moveTo(-2, -14); X.quadraticCurveTo(8, -26, 16, -18); X.quadraticCurveTo(8, -14, -2, -14); X.closePath(); ink('#4fbf4a', 2.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(-8, -5, 4, 2, -.7); X.fill();
  } else if (k === 1) {
    cel('#5f9f3a', '#3f7a28', () => { X.beginPath(); X.moveTo(0, -20); X.bezierCurveTo(16, -20, 15, -2, 20, 8); X.bezierCurveTo(24, 24, -24, 24, -20, 8); X.bezierCurveTo(-15, -2, -16, -20, 0, -20); X.closePath(); }, 5, -3, 3);
    circ2(0, 10, 7, '#8a5a2c', 2.5); X.fillStyle = 'rgba(255,255,255,.4)'; el(-8, -6, 3, 7, .2); X.fill();
  } else if (k === 2) {
    for (const a of [-.5, 0, .5]) { X.save(); X.rotate(a); X.beginPath(); X.moveTo(-5, -14); X.lineTo(0, -34); X.lineTo(5, -14); X.closePath(); ink('#4fbf4a', 2.5); X.restore(); }
    cel('#ffd23f', '#e0a31e', () => el(0, 2, 15, 20), 5, -3, 3);
    X.strokeStyle = 'rgba(160,100,20,.75)'; X.lineWidth = 2; X.beginPath(); for (let i = -2; i <= 2; i++) { X.moveTo(i * 6 - 10, -14); X.lineTo(i * 6 + 10, 18); X.moveTo(i * 6 + 10, -14); X.lineTo(i * 6 - 10, 18); } X.stroke();
  } else {
    for (const sx of [-1, 0, 1]) { X.save(); X.translate(sx * 7, 0); X.beginPath(); X.moveTo(-3, -18); X.quadraticCurveTo(-10, 4, 8, 16); X.quadraticCurveTo(-2, 0, 6, -18); X.closePath(); ink('#ffe14d', 2.5); X.fillStyle = 'rgba(224,170,30,.5)'; X.fillRect(2, -12, 3, 20); X.restore(); }
    X.fillStyle = '#6b4a22'; X.fillRect(-9, -22, 18, 6);
  }
  X.restore();
}
function chili(x, y, on) {
  X.save(); X.translate(x, y);
  X.beginPath(); X.moveTo(-6, -12); X.quadraticCurveTo(-14, 6, 4, 18); X.quadraticCurveTo(0, 2, 7, -12); X.closePath(); ink(on ? '#e8343f' : '#7b7690', 3);
  if (on) { X.fillStyle = 'rgba(255,255,255,.5)'; el(-3, -2, 1.6, 6, .2); X.fill(); }
  X.beginPath(); X.moveTo(-8, -12); X.lineTo(-6, -19); X.lineTo(9, -19); X.lineTo(8, -12); X.closePath(); ink(on ? '#4fbf4a' : '#59566a', 2.5); X.restore();
}

/* ───────────── the level layers (baked once): back = tarp, wall, shelves; front = counter, crates, ruler, cobbles ───────────── */
let BGB = null, BGF = null;
function layer(fn) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d'); fn(); X = old; return cv; }
function buildBack() {
  const wl = X.createLinearGradient(0, 0, 0, 400); wl.addColorStop(0, '#f6b8c8'); wl.addColorStop(1, '#ffd9c0'); X.fillStyle = wl; X.fillRect(0, 0, W, 400);
  X.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 40; i++) { X.beginPath(); X.arc(20 + (i % 10) * 82 + (Math.floor(i / 10) % 2) * 40, 120 + Math.floor(i / 10) * 70, 5, 0, TAU); X.fill(); }
  X.fillStyle = 'rgba(160,90,70,.18)'; X.beginPath(); X.moveTo(300, 330); X.quadraticCurveTo(330, 280, 372, 300); X.quadraticCurveTo(350, 340, 300, 330); X.fill();           // peeled paint patch
  // painted ad on the wall: a big mango
  X.save(); X.globalAlpha = .55; prod(0, 112, 300, 1.3, -.3); X.restore();
  // tarp with scalloped edge
  for (let i = 0; i < 10; i++) { X.fillStyle = i % 2 ? '#fff3d0' : '#22b5a3'; X.fillRect(i * 80, 0, 80, 88); }
  X.fillStyle = 'rgba(20,16,28,.14)'; X.fillRect(0, 62, W, 26);
  for (let i = 0; i < 10; i++) { X.beginPath(); X.arc(i * 80 + 40, 88, 40, 0, Math.PI); ink(i % 2 ? '#fff3d0' : '#22b5a3', 4); }
  X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, 8, W, 6);
  // posts
  line([[20, 20], [20, 380]], 10, '#a5622c'); line([[780, 20], [780, 380]], 10, '#a5622c');
  // crooked sign frame (text is dynamic) and the shopping-list paper
  X.save(); X.translate(145, 175); X.rotate(-.13); rr(-98, -62, 196, 124, 8); ink('#a5622c', 4); rr(-88, -52, 176, 104, 5); ink('#2d5a46', 3); X.restore();
  line([[140, 100], [143, 118]], 3, '#bbb');
  X.save(); X.translate(640, 176); X.rotate(.04); rr(-96, -80, 192, 160, 4); ink('#fffbe8', 4); X.fillStyle = 'rgba(200,120,70,.2)'; X.fillRect(-92, -48, 184, 3); X.restore();
  circ2(644, 94, 6, '#e8434f', 2.5);
  // hanging bananas
  line([[520, 90], [520, 112]], 3, '#a5622c'); prod(3, 520, 138, 1, .1);
  // a goat peeking from behind the left post (the stall gag)
  cel('#f4efe6', '#cfc6b6', () => el(48, 372, 24, 15), 5, -3, 3);
  cel('#f4efe6', '#cfc6b6', () => el(34, 348, 13, 16, -.3), 5, -3, 3);
  line([[26, 336], [20, 322]], 3, '#8a5a2c'); line([[40, 334], [44, 320]], 3, '#8a5a2c');
  circ2(30, 346, 2, INK, 0); circ2(40, 346, 2, INK, 0);
}
function buildFront() {
  // cobbles
  const gl = X.createLinearGradient(0, 500, 0, H); gl.addColorStop(0, '#b9b3bf'); gl.addColorStop(1, '#8f8998'); X.fillStyle = gl; X.fillRect(0, 505, W, H - 505);
  X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = 3; for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) { const x = c * 100 + (r % 2) * 50, y = 520 + r * 20; X.strokeRect(x, y, 100, 20); }
  // counter front panel with planks
  X.fillStyle = '#b97a46'; X.fillRect(30, 384, 740, 124); X.fillStyle = 'rgba(20,16,28,.18)'; for (let i = 0; i < 9; i++) X.fillRect(30 + i * 82 + 80, 386, 3, 120);
  X.strokeStyle = INK; X.lineWidth = 5; X.strokeRect(30, 384, 740, 124);
  rr(22, 356, 756, 30, 10); ink('#d89a5a', 4); X.fillStyle = 'rgba(255,255,255,.28)'; rr(32, 360, 736, 7, 3); X.fill();
  // price ruler: a long plank with ticks
  rr(SX0 - 34, RY - 28, SX1 - SX0 + 68, 56, 12); ink('#f1d9a0', 4); X.fillStyle = 'rgba(20,16,28,.12)'; rr(SX0 - 28, RY - 24, SX1 - SX0 + 56, 10, 5); X.fill();
  for (let p = 0; p <= PMAX; p += 5) { const x = px(p), big = p % 10 === 0; X.strokeStyle = 'rgba(20,16,28,.75)'; X.lineWidth = big ? 3 : 2; X.beginPath(); X.moveTo(x, RY + 8); X.lineTo(x, RY + (big ? 22 : 16)); X.stroke(); }
  for (let p = 0; p <= PMAX; p += 20) ntx(String(p), px(p), RY - 15, 13, '#fff');
  // crates with produce
  const crate = (x, y, w, h) => { rr(x, y, w, h, 6); ink('#a5622c', 4); X.fillStyle = 'rgba(20,16,28,.2)'; for (let i = 1; i < 3; i++) X.fillRect(x + 6, y + i * h / 3, w - 12, 3); };
  for (let i = 0; i < 7; i++) prod(0, 70 + (i % 4) * 36 + (i > 3 ? 18 : 0), 322 - (i > 3 ? 22 : 0), .95, hsh(i) - .5);
  crate(50, 326, 160, 36);
  for (let i = 0; i < 5; i++) prod(1, 256 + (i % 3) * 36 + (i > 2 ? 18 : 0), 328 - (i > 2 ? 20 : 0), .9, hsh(i + 9) - .5);
  crate(236, 332, 126, 30);
  prod(2, 480, 322, .9, .1); crate(446, 332, 70, 30);
}

/* ═════════ the game ═════════ */
function duRegateo(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), judge = D.role === 0;
  /* the level, from the seed (same draws on both screens) */
  const p0 = Math.floor(R() * 4); let p1 = Math.floor(R() * 3); if (p1 >= p0) p1++;
  const lv = [p0, p1].map(k => { const res = 34 + Math.floor(R() * 20), ask = res + 30 + Math.floor(R() * 8), lo = res - Math.floor(R() * 3); return { k, res, ask, lo }; });
  const budget = lv[0].res + lv[1].res + SLACK;
  /* S = what both screens draw; the judge simulates it, the eye mirrors it from 's' */
  const S = { round: 0, phase: 0, o: lv[0].ask, P: 1, raiseI: 0, sp0: -1, sp1: -1, mood: 2, refuse: 0, reason: 0 };
  let raise = 0, kSeen = 0, held = false, kDir = 0, dO = S.o, dP = 1, resAt = -1;
  const sAt = [-9, -9]; let refuseAt = -9, lastS = -9, lastO = -1, lastMood = 2;
  let kCnt = 0, kRound = 0, kPrice = 0, kSent = -9, ringAt = -9;
  const reserve = () => lv[S.round].res + S.raiseI;
  const spent = i => i ? S.sp1 : S.sp0;
  const sendS = () => { lastS = g.c; lastO = S.o; D.send('s', [S.round, S.o, Math.round(S.P * 1000), S.raiseI, S.sp0, S.sp1, S.mood, S.refuse, S.reason], true); };
  const sendK = () => { kSent = g.c; D.send('k', [kCnt, kRound, kPrice], true); };
  const setO = v => { v = clamp(Math.round(v), 0, PMAX); if (v !== S.o && S.phase === 0 && !g.result) S.o = v; };
  const fail = code => { S.reason = code; sendS(); g.finish('lose'); };
  function attempt(price) {                               // the eye rang the bell at 'price'
    ringAt = g.c;
    if (price >= reserve()) {
      if (S.round === 0) S.sp0 = price; else S.sp1 = price; sAt[S.round] = g.c; S.phase = 1; sfx.coin();
      if (S.round === 0 ? price + lv[1].res > budget : S.sp0 + S.sp1 > budget) { fail(2); return; }
      if (S.round === 1) { S.reason = 0; sendS(); g.finish('win'); return; }
      sendS();
    } else {
      S.P -= .3; raise = Math.min(8, raise + 1.5); S.raiseI = Math.floor(raise); S.refuse++; refuseAt = g.c; sfx.buzz();
      if (S.P <= 0) { S.P = 0; fail(1); return; } sendS();
    }
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: judge ? 'HAGGLE!' : 'RING IT!', roleLabel: judge ? 'THE OFFER' : 'THE EYE',
    hint: judge ? 'DRAG LEFT / RIGHT (OR ◄ ►) TO SLIDE THE PRICE YOU OFFER. WATCH DON CHUCHO: A SMILE MEANS HE ACCEPTS, A FROWN MEANS TOO LOW. YOUR FRIEND KNOWS THE BUDGET AND RINGS THE BELL TO CLOSE THE DEAL - TALK! BUY BOTH FRUITS WITHIN BUDGET'
      : 'READ THE CHALK SIGN (HIS LAST PRICE) AND THE BUDGET, AND TELL YOUR FRIEND WHICH WAY TO MOVE THE PRICE. TAP THE BELL (OR SPACE) TO CLOSE THE DEAL AT THE PRICE YOU SEE - NOT TOO LOW, NOT TOO HIGH!',
    thint: judge ? 'DRAG THE PRICE: LOW BUT NEVER INSULTING' : 'TELL THEM THE PRICE, THEN TAP THE BELL TO CLOSE',
    update(dt) {
      g.c += dt; const T = g.c;
      if (g.result && resAt < 0) resAt = T;
      if (judge) {
        if (!g.result) {
          if (kDir) setO(S.o + kDir * 36 * dt);
          if (S.phase === 1) {
            if (T - sAt[S.round] >= PAUSE) { S.round = 1; S.phase = 0; S.o = lv[1].ask; S.mood = 2; sendS(); }
          } else {
            const rs = reserve(), o = S.o;
            S.mood = o >= rs ? 2 : o >= rs * .85 ? 1 : 0;
            if (S.mood === 2) S.P = Math.min(1, S.P + .02 * dt);
            else if (S.mood === 1) S.P -= .1 * dt;
            else { S.P -= .45 * dt; raise = Math.min(8, raise + 2.5 * dt); S.raiseI = Math.floor(raise); }
            if (S.P <= 0) { S.P = 0; fail(1); }
          }
          if (!g.result && T >= g.limit) fail(3);
        }
        if (!g.result && (T - lastS >= .4 || (T - lastS >= .05 && (S.o !== lastO || S.mood !== lastMood)))) { lastMood = S.mood; sendS(); }
        dO = S.o; dP = S.P;
      } else {
        dO += (S.o - dO) * Math.min(1, dt * 16); dP += (S.P - dP) * Math.min(1, dt * 8);
        if (kCnt && T - kSent >= .5 && !g.result) sendK();
      }
    },
    msg(type, d) {
      if (judge) {
        if (type === 'k' && Array.isArray(d)) {
          const c = d[0] | 0; if (c > kSeen) { kSeen = c; if (!g.result && S.phase === 0 && (d[1] | 0) === S.round) attempt(clamp(d[2] | 0, 0, PMAX)); }
        }
      } else if (type === 's' && Array.isArray(d)) {
        const sp0 = d[4] | 0, sp1 = d[5] | 0, ref = d[7] | 0;
        if (sp0 >= 0 && S.sp0 < 0) { sAt[0] = g.c; sfx.coin(); }
        if (sp1 >= 0 && S.sp1 < 0) { sAt[1] = g.c; sfx.coin(); }
        if (ref > S.refuse) { refuseAt = g.c; sfx.buzz(); }
        S.round = clamp(d[0] | 0, 0, 1); S.o = clamp(d[1] | 0, 0, PMAX); S.P = clamp((d[2] | 0) / 1000, 0, 1); S.raiseI = d[3] | 0; S.sp0 = sp0; S.sp1 = sp1; S.mood = clamp(d[6] | 0, 0, 2); S.refuse = ref; S.reason = d[8] | 0;
        S.phase = spent(S.round) >= 0 ? 1 : 0;
      }
    },
    down(p) { if (g.result) return; if (judge) { held = true; setO(fromX(p.x)); } else ring(); },
    move(p) { if (g.result || !judge || !held) return; setO(fromX(p.x)); },
    up() { held = false; },
    key(e) {
      const c = e.code; if (g.result || c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (judge) { if (c === 'ArrowLeft' || c === 'KeyA') kDir = -1; else if (c === 'ArrowRight' || c === 'KeyD') kDir = 1; }
      else if (c === 'Space' || c === 'Enter' || c === 'ArrowDown' || c === 'KeyS') ring();
    },
    keyup(e) { const c = e.code; if (((c === 'ArrowLeft' || c === 'KeyA') && kDir < 0) || ((c === 'ArrowRight' || c === 'KeyD') && kDir > 0)) kDir = 0; },
  };
  function ring() {                                       // the eye rings the bell: the deal is closed at the price it is looking at
    if (S.phase !== 0 || g.result) return;
    kCnt++; kRound = S.round; kPrice = S.o; ringAt = g.c; sfx.hit(); sendK();
  }
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const lo = () => lv[S.round].lo + S.raiseI;

  /* ═════ draw ═════ */
  function chucho(T, mood, P, shake) {
    const cx = 400 + shake, cy = 238, red = mixC('#d9a066', '#e8434f', (1 - P) * .75);
    cel('#4aa3df', '#2f7fb8', () => { X.beginPath(); X.moveTo(cx - 112, 392); X.quadraticCurveTo(cx - 100, 304, cx, 298); X.quadraticCurveTo(cx + 100, 304, cx + 112, 392); X.closePath(); }, 7, 2, 5);
    rr(cx - 46, 322, 92, 72, 10); ink('#fff7e6', 4);
    for (const s of [-1, 1]) { el(cx + s * 52, cy + 6, 10, 15); ink(red, 4); }
    cel(red, mixC(red, '#8a3a2a', .35), () => el(cx, cy, 52, 58), 8, 4, 5);
    if (mood === 0 || P < .25) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const ph = (T * 1.6 + i * .5 + (s > 0 ? .25 : 0)) % 1; X.globalAlpha = (1 - ph) * .85; circ2(cx + s * (62 + ph * 14), cy - ph * 46, 5 + ph * 8, '#fff', 2.5); } X.globalAlpha = 1;
    // eyes + brows
    const look = clamp((px(S.o) - 400) / 270, -1, 1) * 4;
    for (const s of [-1, 1]) {
      el(cx + s * 20, cy - 8, 13, mood === 0 ? 11 : 15); ink('#fff', 3); circ2(cx + s * 20 + look * .6, cy - 6, mood === 0 ? 3.2 : 5, INK, 0); X.fillStyle = '#fff'; X.beginPath(); X.arc(cx + s * 20 + look * .6 - 1.5, cy - 8, 1.5, 0, TAU); X.fill();
      if (mood === 2) line([[cx + s * 34, cy - 30], [cx + s * 18, cy - 38], [cx + s * 6, cy - 33]], 4, '#2a1d1a');
      else if (mood === 1) line([[cx + s * 34, cy - 31], [cx + s * 8, cy - 28]], 4, '#2a1d1a');
      else line([[cx + s * 36, cy - 40], [cx + s * 8, cy - 26]], 5, '#2a1d1a');
    }
    el(cx, cy + 8, 10, 8); ink(mixC(red, '#8a3a2a', .25), 3);
    // the mustache: curls up when pleased, droops and twitches when angry
    const tw = Math.sin(T * (4 + (1 - P) * 28)) * (mood === 0 ? 6 : mood === 1 ? 2.5 : 1), curl = mood === 2 ? -16 : mood === 1 ? 2 : 14;
    for (const s of [-1, 1]) {
      const tx = cx + s * (48 + tw * .5), ty = cy + 26 + curl + tw;
      X.beginPath(); X.moveTo(cx, cy + 16); X.quadraticCurveTo(cx + s * 28, cy + 8, tx, ty); X.quadraticCurveTo(cx + s * 24, cy + 44, cx, cy + 32); X.closePath(); ink('#2a1d1a', 3);
      X.fillStyle = 'rgba(255,255,255,.22)'; el(cx + s * 22, cy + 22, 9, 2.5, s * .3); X.fill();
    }
    // mouth
    if (mood === 2) { X.beginPath(); X.arc(cx, cy + 40, 12, .15, Math.PI - .15); ink('#7a1d2e', 2.5); }
    else if (mood === 1) line([[cx - 11, cy + 46 + Math.sin(T * 9) * 1.5], [cx + 11, cy + 44]], 3, INK);
    else { el(cx, cy + 47, 16, 8 + Math.abs(Math.sin(T * 14)) * 6); ink('#7a1d2e', 3); X.fillStyle = '#fff'; X.fillRect(cx - 10, cy + 40, 20, 4); }
    // hat
    el(cx, cy - 44, 94, 18); ink('#f1d27a', 4); X.fillStyle = 'rgba(160,100,20,.35)'; for (let i = -4; i <= 4; i++) X.fillRect(cx + i * 20, cy - 56, 3, 22);
    cel('#f1d27a', '#d3ad4f', () => { X.beginPath(); X.moveTo(cx - 50, cy - 46); X.quadraticCurveTo(cx - 46, cy - 100, cx, cy - 100); X.quadraticCurveTo(cx + 46, cy - 100, cx + 50, cy - 46); X.closePath(); }, 7, 0, 4);
    rr(cx - 50, cy - 62, 100, 15, 4); ink('#e8434f', 3);
    // forehead vein: grows as the patience goes
    if (P < .62) { const k = (.62 - P) / .62; line([[cx + 22, cy - 36], [cx + 30, cy - 29], [cx + 22, cy - 24], [cx + 32, cy - 16]], 2 + 3 * k + Math.sin(T * 12) * .6 * k, '#b0124f'); }
    if (mood === 1) { const k = (T * 1.8) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(cx + 58, cy - 30 + k * 20); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
  }
  function senora(T, thr, mango) {                          // thr: 0..1 throw progress (-1 = not throwing)
    const hx = 706, hy = 308, grin = thr >= 0;
    cel('#ffd23f', '#e0a31e', () => rr(hx - 38, 332, 78, 60, 14), 6, 0, 4);
    rr(hx - 24, 340, 48, 52, 8); ink('#ff7ab0', 3);
    cel('#f0b890', '#d4946a', () => el(hx, hy, 27, 31), 6, 3, 4);
    X.beginPath(); X.moveTo(hx - 29, hy - 2); X.quadraticCurveTo(hx - 30, hy - 36, hx, hy - 34); X.quadraticCurveTo(hx + 30, hy - 36, hx + 29, hy - 2); X.quadraticCurveTo(hx + 20, hy - 20, hx, hy - 20); X.quadraticCurveTo(hx - 20, hy - 20, hx - 29, hy - 2); X.closePath(); ink('#6b3d22', 3.5);
    for (let i = 0; i < 5; i++) { const a = -2.6 + i * .55; X.save(); X.translate(hx + Math.cos(a) * 24, hy - 12 + Math.sin(a) * 24); X.rotate(a + 1.57); rr(-5, -8, 10, 16, 4); ink('#ff9bc7', 2.5); X.restore(); }
    for (const s of [-1, 1]) { circ2(hx + s * 10, hy + 1, 5, '#fff', 2); circ2(hx + s * 10 + (grin ? 0 : -1), hy + 2, 2.4, INK, 0); line([[hx + s * 18, hy - 8], [hx + s * 4, hy - (grin ? 6 : 10)]], 2.5, INK); }
    X.fillStyle = 'rgba(255,100,130,.55)'; el(hx - 18, hy + 10, 5, 3.5); X.fill(); el(hx + 18, hy + 10, 5, 3.5); X.fill();
    if (grin) { X.beginPath(); X.arc(hx, hy + 12, 8, .1, Math.PI - .1); ink('#7a1d2e', 2.5); } else line([[hx - 6, hy + 16], [hx + 6, hy + 15]], 3, INK);
    // throwing arm: idle = fanning herself, wind-up, release
    const sx = hx - 32, sy = 344; let ax, ay;
    if (thr < 0) { ax = hx - 52 + Math.sin(T * 9) * 6; ay = 322; } else if (thr < .5) { const k = ease(thr / .5); ax = lerp(hx - 52, hx + 40, k); ay = lerp(322, 250, k); } else { const k = ease((thr - .5) / .2); ax = lerp(hx + 40, hx - 110, k); ay = lerp(250, 300, k); }
    line([[sx, sy], [ax, ay]], 11, '#f0b890'); circ2(ax, ay, 8, '#f0b890', 3);
    if (thr < 0) { X.save(); X.translate(ax - 6, ay - 8); X.rotate(Math.sin(T * 9) * .5 - .4); X.beginPath(); X.moveTo(0, 0); X.lineTo(-16, -22); X.quadraticCurveTo(0, -30, 16, -22); X.closePath(); ink('#ff5c8a', 2.5); X.restore(); }
    else if (mango && thr < .55) prod(0, ax + 4, ay - 14, .8, T * 2);
  }
  function parrot(T, say) {
    const x = 300, y = 106, bob = Math.sin(T * 3.2) * 3;
    line([[x - 30, 95], [x - 30, 124]], 3, '#a5622c'); line([[x + 30, 95], [x + 30, 124]], 3, '#a5622c'); line([[x - 34, 124], [x + 34, 124]], 6, '#a5622c');
    cel('#e8434f', '#b8283a', () => { X.beginPath(); X.moveTo(x - 6, y + 14); X.lineTo(x - 11, y + 44); X.lineTo(x + 3, y + 36); X.lineTo(x + 9, y + 46); X.lineTo(x + 7, y + 14); X.closePath(); }, 4, 0, 2.5);
    cel('#e8434f', '#b8283a', () => el(x, y + bob * .3, 14, 20), 5, 2, 3);
    X.save(); X.translate(x + 6, y + 3); X.rotate(.2 + Math.sin(T * 5) * (say ? .22 : .04)); el(0, 8, 7, 14); ink('#2b9ee6', 2.5); X.restore();
    circ2(x - 2, y - 22 + bob, 11, '#e8434f', 3); circ2(x - 5, y - 24 + bob, 4, '#fff', 2); circ2(x - 5, y - 24 + bob, 1.6, INK, 0);
    X.beginPath(); X.moveTo(x - 11, y - 22 + bob); X.quadraticCurveTo(x - 24, y - 20 + bob, x - 14, y - 10 + bob); X.lineTo(x - 11, y - 15 + bob); X.closePath(); ink('#ffd23f', 2.5);
  }
  function bubble(s, x, y, col, k) {
    if (k <= 0) return; const sc = outBack(k * 3); X.save(); X.translate(x, y); X.scale(sc, sc); X.font = '900 22px "Arial Black", Impact, sans-serif'; const w = Math.min(230, X.measureText(t(s)).width) + 30;
    X.beginPath(); X.moveTo(-10, 17); X.lineTo(-24, 34); X.lineTo(8, 18); X.closePath(); ink('#fff', 3); rr(-w / 2, -19, w, 38, 19); ink('#fff', 3); X.beginPath(); X.moveTo(-9, 15); X.lineTo(-20, 28); X.lineTo(6, 16); X.closePath(); X.fillStyle = '#fff'; X.fill();
    txt(s, 0, 1, 22, col, 'center', w - 22); X.restore();
  }

  g.draw = function () {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (!BGB) { BGB = layer(buildBack); BGF = layer(buildFront); }
    ctx.drawImage(BGB, 0, 0);
    const mood = won ? 2 : S.mood, P = won ? 1 : dP, rf = T - refuseAt, refusing = rf < .9 && !g.result;
    // ── chalk sign (the eye can read it) ──
    X.save(); X.translate(145, 175); X.rotate(-.13);
    if (!judge) {
      txt('LAST PRICE', 0, -32, 16, '#fff7c9', 'center', 150); txt(`${lo()} - ${lo() + WIN}`, 0, 8, 46, '#fff', 'center', 150);
      X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; X.beginPath(); X.moveTo(-60, 38); X.quadraticCurveTo(0, 30, 60, 40); X.stroke();
    } else {
      X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(-60, -30 + i * 28); X.bezierCurveTo(-30, -42 + i * 28, 20, -20 + i * 28, 60, -32 + i * 28); X.stroke(); }
      txt('?', 0, 4, 44, 'rgba(255,255,255,.55)');
    }
    X.restore();
    // ── shopping list (the eye can read it) ──
    X.save(); X.translate(640, 176); X.rotate(.04);
    if (!judge) {
      txt('SHOPPING LIST', 0, -62, 17, INK, 'center', 150);
      for (let i = 0; i < 2; i++) {
        const y = -26 + i * 34, done = spent(i) >= 0; prod(lv[i].k, -72, y, .5); txt(PROD[lv[i].k], -50, y, 14, INK, 'left', 82);
        if (done) { txt(String(spent(i)), 74, y, 22, '#1d8a3a', 'right'); } else txt('-', 70, y, 22, '#8a8a95', 'right');
      }
      const left = budget - Math.max(0, S.sp0) - Math.max(0, S.sp1);
      txt('BUDGET', -86, 44, 15, INK, 'left', 80); txt(`Bs.${budget}`, 86, 44, 24, '#c2185b', 'right', 90);
      txt('MONEY LEFT', -86, 68, 13, INK, 'left', 60); txt(String(left), 86, 68, 19, left < 0 ? '#e8434f' : '#1d8a3a', 'right', 90);
    } else {
      X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(-70, -50 + i * 25); X.lineTo(-70 + 100 + hsh(i) * 40, -50 + i * 25); X.stroke(); }
    }
    X.restore();
    // ── the stall folk ──
    const throwing = rk >= 0 && (won ? rk > .3 : rk > .35), thr = !throwing ? -1 : clamp((rk - (won ? .3 : .35)) / .55, 0, 1) * .7 + 0;
    parrot(T, S.o > lv[S.round].ask - 7 && !g.result && (T % 5) < 1.8);
    if (S.o > lv[S.round].ask - 7 && !g.result && (T % 5) < 1.8 && T > .4) bubble('PRICEY!', 300, 40, '#e8434f', Math.min(1, (T % 5) * 3));
    const shake = refusing ? Math.sin(rf * 40) * 8 * (1 - rf / .9) : 0;
    chucho(T, lost && S.reason === 1 ? 0 : mood, P, shake);
    // chilis of patience hang from a string above the hat
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(344, 94); X.quadraticCurveTo(400, 118, 456, 94); X.stroke();
    for (let i = 0; i < 3; i++) chili(366 + i * 34, 118 + Math.sin(i * 1.3 + 0.2) * 1 + (i === 1 ? 8 : 0), P > i * .33 + .02);
    senora(T, won && rk >= .3 || lost && rk >= .35 ? clamp((rk - (won ? .3 : .35)) / .8, 0, 1) : -1, !(won && rk > .65 || lost && rk > .75));
    // ── front layer: counter, crates, ruler ──
    ctx.drawImage(BGF, 0, 0);
    // the scale pile with the product of this round (flies away when sold)
    const rd = S.round, soldK = T - sAt[rd], pk = lv[rd].k;
    if (S.phase === 0 || soldK < 0) for (let i = 0; i < 3; i++) prod(pk, 340 + i * 30, 346 - (i === 1 ? 10 : 0), .75, hsh(i + rd) - .5);
    else if (soldK < PAUSE) { const k = ease(soldK / PAUSE); for (let i = 0; i < 3; i++) prod(pk, lerp(340 + i * 30, 330 + i * 170, k), 346 - Math.sin(k * Math.PI) * 140 + k * 160, .75 * (1 - k * .3), k * 6); }
    rr(310, 352, 120, 10, 5); ink('#8e98ad', 3);
    // the price banknote on the ruler
    const bx = px(dO), bw = 78, shk = refusing ? Math.sin(rf * 50) * 5 : 0, hot = S.mood === 0 && judge && !g.result;
    X.save(); X.translate(bx + shk, RY + 2 + (held ? -4 : 0)); X.fillStyle = 'rgba(20,16,28,.28)'; rr(-bw / 2 + 4, -16 + 8, bw, 40, 6); X.fill();
    rr(-bw / 2, -20, bw, 40, 6); ink(refusing ? '#ff9a8a' : hot ? '#ffb199' : '#8be08a', 3.5); X.strokeStyle = 'rgba(20,16,28,.4)'; X.lineWidth = 2; rr(-bw / 2 + 5, -15, bw - 10, 30, 4); X.stroke();
    X.fillStyle = 'rgba(255,255,255,.4)'; rr(-bw / 2 + 8, -17, bw - 16, 6, 3); X.fill();
    txt(`Bs.${Math.round(dO)}`, 0, 1, 24, '#fff', 'center', bw - 12); X.restore();
    if (judge && !g.result) txt('DRAG LEFT / RIGHT', 400, 410, 15, 'rgba(255,255,255,.95)', 'center', 240);
    // bell
    const ra = T - ringAt, rot = ra < .6 ? Math.sin(T * 38) * .28 * (1 - ra / .6) : 0;
    X.save(); X.translate(BELL.x, BELL.y); X.rotate(rot); X.beginPath(); X.moveTo(-26, 0); X.quadraticCurveTo(-26, -36, 0, -38); X.quadraticCurveTo(26, -36, 26, 0); X.closePath(); ink('#e8b923', 4);
    X.fillStyle = 'rgba(255,255,255,.5)'; el(-10, -22, 4, 9, .3); X.fill(); circ2(0, -42, 5, '#e8b923', 3); X.restore(); rr(BELL.x - 32, BELL.y - 2, 64, 8, 4); ink('#a5622c', 3);
    if (!judge && !g.result && T < 3.4) { DUO.demoFinger(BELL.x + 4, BELL.y - 12 + Math.sin(T * 5) * 3, true, (T * 2) % 1); }
    if (judge && !g.result && T < 3.2) DUO.demoFinger(lerp(300, 520, (Math.sin(T * 2) + 1) / 2), RY + 36, true, (T * 2) % 1);
    // ── the players ──
    const aC = judge ? myCol() : pCol(), bC = judge ? pCol() : myCol();
    const hop = (k, on) => on ? Math.abs(Math.sin(T * 10 + k)) * 14 : 0;
    const splatT = lost ? rk - 1.0 : -1;
    X.save(); X.translate(170, 572 - hop(0, won && rk >= 0)); arm(3.2, -1, won ? -.5 + Math.sin(T * 14) * .3 : -2.0, 1, aC); arm(3.2, 1, won ? .5 - Math.sin(T * 14) * .3 : -1.5 + (judge && held ? Math.sin(T * 6) * .2 : 0), 1, aC); caos(0, 0, 3.2, { col: aC, mood: won ? 'happy' : lost ? 'sad' : null });
    if (lost && splatT >= 0) { X.fillStyle = '#ffa62b'; el(-2, -30, 16, 11); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.stroke(); for (let i = 0; i < 3; i++) { const dy = Math.min(22, splatT * 14 + i * 3); X.fillStyle = '#ffa62b'; X.fillRect(-14 + i * 12, -24, 5, 4 + dy); } }
    X.restore();
    X.save(); X.translate(630, 572 - hop(1.3, won && rk >= 0)); arm(3.2, -1, won ? -.5 + Math.sin(T * 14) * .3 : -1.7, 1, bC); arm(3.2, 1, won ? .5 - Math.sin(T * 14) * .3 : -2.2 + (!judge && ra < .3 ? -.4 : 0), 1, bC); caos(0, 0, 3.2, { col: bC, mood: won ? 'happy' : lost ? 'sad' : null }); X.restore();
    if (!g.result && T < 3.4) { pill(170, 572 - 3.2 * 12.6 - 34, judge ? 'YOU' : 'YOUR FRIEND', aC); pill(630, 572 - 3.2 * 12.6 - 34, judge ? 'YOUR FRIEND' : 'YOU', bC); }
    // ── the mango in flight / reactions ──
    if (refusing) bubble('NO WAY, JOSE!', 470, 58, '#e8434f', 1 - rf / .9);
    else if (!g.result && mood === 0 && S.phase === 0) bubble('TOO CHEAP!', 470, 58, '#e8434f', 1);
    if (!g.result && S.phase === 1 && T - sAt[rd] < PAUSE) badge('DEAL!', 400, 70, 34, '#1d8a3a', '#fff', outBack((T - sAt[rd]) / .2), -.04);
    if (rk >= 0) {
      const t0 = won ? .3 : .35, fly = (rk - t0 - .45) / .55;          // the mango leaves her hand at ~0.45 s after the wind-up starts
      if (fly >= 0 && fly <= 1) {
        const tx = won ? 630 : 170, ty = won ? 520 : 535, sx = 640, sy = 310;
        prod(0, lerp(sx, tx, fly), lerp(sy, ty, fly) - Math.sin(fly * Math.PI) * (won ? 90 : 150), 1.1, fly * 14);
        if (fly > .97 && lost) { for (let i = 0; i < 6; i++) { const a = i * TAU / 6, r = 18 + (fly - .97) * 400; star(tx + Math.cos(a) * r, ty + Math.sin(a) * r, 8, 4, 5, a, '#FFB23D', 3); } }
      } else if (fly > 1 && won) prod(0, 630, 505 - Math.abs(Math.sin(T * 8)) * 8, 1.1, 0);
      if (won) {
        if (rk > .2) badge('GOOD DEAL!', 400, 62, 36, '#1d8a3a', '#fff', outBack((rk - .2) / .25), -.03);
        if (rk > 1.1) badge('FREE MANGO!', 500, 450, 34, '#ffb23d', '#fff', outBack((rk - 1.1) / .25), .05);
        for (let i = 0; i < 6; i++) { const ph = (rk * .8 + i / 6) % 1; X.globalAlpha = 1 - ph; star(180 + i * 90 + Math.sin(ph * 6 + i) * 10, 470 - ph * 120, 8, 4, 5, ph * 4, '#FFE14D', 2.5); X.globalAlpha = 1; }
      } else {
        const why = S.reason === 2 ? 'OVER BUDGET!' : S.reason === 1 ? 'KICKED OUT!' : 'MARKET CLOSED!', col = S.reason === 2 ? '#7e5bd6' : S.reason === 1 ? '#e8434f' : '#2b9ee6';
        if (rk > .1) badge(why, 400, 62, 36, col, '#fff', outBack((rk - .1) / .25), -.03);
        if (rk > 1.0) badge('SPLAT!', 300, 440, 40, '#ffa62b', '#fff', outBack((rk - 1.0) / .2), -.07);
      }
    }
    vignette(.16);
  };

  // what a bot may see: the same things as the screen
  g.dbg = {
    pricePt: p => ({ x: px(p), y: RY }),
    view: () => judge ? { o: S.o, ask: lv[S.round].ask, mood: S.mood, P: S.P, round: S.round, phase: S.phase, max: PMAX }
      : { o: S.o, round: S.round, phase: S.phase, lo: lo(), hi: lo() + WIN, budget, sp0: S.sp0, sp1: S.sp1, P: S.P, mood: S.mood, win: WIN },
    truth: () => ({ S, lv, budget, raise, kSeen }),
  };
  wire(g, D, 0, sp, 'du_regateo');
  return g;
}
reg('du_regateo', duRegateo, 'REGATEO EN EL MERCADO'); REGMAP.du_regateo.duo = true;

/* ───────────── intro card (520×240), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  X.fillStyle = '#f6b8c8'; X.fillRect(0, 0, 520, 240);
  for (let i = 0; i < 7; i++) { X.fillStyle = i % 2 ? '#fff3d0' : '#22b5a3'; X.fillRect(i * 80, 0, 80, 34); }
  X.fillStyle = '#b97a46'; X.fillRect(0, 150, 520, 90); rr(-10, 140, 540, 20, 8); ink('#d89a5a', 3);
  // Don Chucho, tiny
  cel('#d9a066', '#b9824a', () => el(260, 98, 36, 40), 6, 3, 3.5); el(260, 70, 62, 12); ink('#f1d27a', 3);
  const ok = role === 0 ? u > 2.2 : u > 2.4;
  for (const s of [-1, 1]) { circ2(260 + s * 13, 92, 8, '#fff', 2); circ2(260 + s * 13, 94, 3, INK, 0); X.beginPath(); X.moveTo(260, 110); X.quadraticCurveTo(260 + s * 22, 104, 260 + s * 32, 110 + (ok ? -9 : 7)); X.quadraticCurveTo(260 + s * 16, 124, 260, 118); X.closePath(); ink('#2a1d1a', 2.5); }
  if (role === 0) {
    rr(60, 172, 400, 34, 8); ink('#f1d9a0', 3);
    const k = u < 2.2 ? ease(u / 2.2) : 1, bx = 410 - 200 * k; rr(bx - 34, 170, 68, 38, 6); ink('#8be08a', 3); ntx(String(Math.round(40 + (bx - 210) * .3)), bx, 190, 20, '#fff');
    DUO.demoFinger(bx, 214, u < 2.2, u % 1);
    badge('HAGGLE!', 260, 22, 15, '#c98a12', '#fff', 1, -.02);
  } else {
    X.save(); X.translate(110, 70); X.rotate(-.13); rr(-62, -34, 124, 68, 6); ink('#2d5a46', 3); ntx('42 - 48', 0, 4, 24, '#fff'); X.restore();
    X.save(); X.translate(400, 200 + Math.sin(Math.min(u, 2.6) * 12) * (u > 2.4 ? 3 : 0)); X.beginPath(); X.moveTo(-24, 0); X.quadraticCurveTo(-24, -34, 0, -36); X.quadraticCurveTo(24, -34, 24, 0); X.closePath(); ink('#e8b923', 3.5); X.restore();
    DUO.demoFinger(402, 186, u > 2.2 && u < 2.8, (u - 2.2) / .6);
    badge('RING IT!', 260, 22, 15, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_regateo = [['THE OFFER', 'SLIDE THE PRICE AND WATCH HIS MOOD', 'DRAG LEFT / RIGHT'], ['THE EYE', 'READ THE SIGN AND RING THE BELL', 'TAP THE BELL']];
DUO.DEMOS.du_regateo = [t => demo(0, t), t => demo(1, t)];

})();
