'use strict';
/* ═════════ SQUAD · PASA EL BALDE (sq_balde), 3-4 players ═════════
   Water shortage in the barrio: the street tap (la pila) only gives a trickle, so the neighbours form a bucket brigade from the tap, along the
   sidewalk, into the kitchen where abuela pours into the blue barrel. Seats in a chain: TAP (0) - MIDDLE (1, plus 2 with 4 seats) - KITCHEN (last = JUDGE).
     TAP      hold to fill the bucket, let go to throw it to the next seat. Fuller = more water (worth 0.5 + level) but a tighter hand-off window.
     MIDDLE   tap to pass the bucket on. Water sloshes out while you hold it.
     KITCHEN  tap to pour into the barrel (8 units fill it) and slap the stray cat (a flip-flop!) before it runs off with the bucket.
   The READY RING hangs over every seat: a needle sweeps it once per P seconds and the green arc is the window in which that seat accepts a bucket
   (the arc shrinks with the level of the bucket the previous seat is holding). It is grey while that seat's hands are full.
   The tap pressure drops with time: the stream sputters and at 90 % of the time it runs dry.
   Netcode: every seat OWNS its hands. 'p' {i, l, t}: bucket i thrown to the next seat at round time t with level l. The receiver judges the
   hand-off as a pure function of (t, l, its ring phase): so the sender saw exactly the verdict it gets, whatever the lag. It answers 'a' {i}
   (caught) or 'r' {i} (busy / ring closed: the bucket splashes). 'f' {v} (latest) tap bucket level; 'o' {u, c, l} the judge's running count after a
   pour; 'x' {e, k} cat event verdict (0 slapped, 1 stolen). Rings and cat visits come from the seeded schedule (mkR), the same on every screen.
   The judge (the kitchen = the barrel owner) calls g.finish('win') when the barrel is full and ('lose') at the time limit. ═════════ */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

const NEED = 8, P = .9, UP0 = .86, UPD = .26, FILLR = 2.6, SLOSH = .08, MINL = .12;
const GY = 462, U = 4.2, HX = 40;                           // feet line, size of the neighbours, bucket side offset
const XS = { 3: [170, 372, 568], 4: [150, 292, 434, 580] };  // seat x
const BX = 734, BTOP = GY - 112;                            // barrel centre x and its rim y
const FLY = .36, STAY = 2.4, GRAB = .9;
const KEYS = ['Space', 'Enter', 'ArrowDown', 'ArrowUp', 'KeyS', 'KeyW'], SLAPKEYS = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyZ', 'KeyX'];
const COLS = ['#FFC93C', '#6EA8FE', '#ff8fb1', '#7CE08A'];
const WATER = '#4fc3f7', WATER2 = '#1f93d0';
const upf = L => UP0 - UPD * clamp(L, 0, 1);               // fraction of the ring period that accepts a bucket of level L

/* ───────────── tiny drawing kit (X can be an offscreen context while the background is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 26);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(260, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 260);
  X.restore();
}
function plate(x, y, w, h, col, dk, down, label, cap) {
  const d = down ? 3 : 9;
  rr(x, y + 9, w, h, 18); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 18); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 9, 4); X.fill();
  rr(x, y + 9 - d, w, h, 18); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  txt(label, x + w / 2 - (cap && !TOUCH ? 22 : 0), y + 9 - d + h / 2, 24, '#fff', 'center', w - (cap && !TOUCH ? 120 : 30));
  if (cap && !TOUCH) { X.font = '700 14px Fredoka, Arial, sans-serif'; const cw = Math.max(26, X.measureText(t(cap)).width + 14); rr(x + w - cw - 12, y + 9 - d + h / 2 - 10, cw, 20, 6); ink('#fff', 2.5); txt(cap, x + w - cw / 2 - 12, y + 9 - d + h / 2 + 1, 13, INK, 'center', cw - 4); }
}

/* the see-through plastic bucket: (x, y) = bottom centre, L = water level 0..1 */
function bucket(x, y, L, s, rot, T, rim) {
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s);
  const bw = 13, tw = 17, h = 32;
  const body = () => { X.beginPath(); X.moveTo(-tw, -h); X.lineTo(tw, -h); X.lineTo(bw, 0); X.lineTo(-bw, 0); X.closePath(); };
  X.beginPath(); X.moveTo(-tw, -h + 2); X.quadraticCurveTo(0, -h - 30, tw, -h + 2); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#8f9cb3'; X.stroke();
  body(); ink('rgba(232,246,255,.92)', 3.5);
  if (L > .02) {
    X.save(); body(); X.clip(); const sy = -3 - (h - 8) * clamp(L, 0, 1), w = Math.sin(T * 9 + x) * 1.6;
    X.beginPath(); X.moveTo(-tw, 2); X.lineTo(-tw, sy + w); X.quadraticCurveTo(0, sy - w * 1.6, tw, sy + w); X.lineTo(tw, 2); X.closePath();
    X.fillStyle = WATER; X.fill(); X.fillStyle = WATER2; X.fillRect(tw * .25, sy - 4, tw, h); X.restore();
    glint(-7, -h * .5, 2.4, 8, 0, .55);
  }
  X.fillStyle = rim || '#ff4d5e'; X.fillRect(-tw - 1, -h - 4, tw * 2 + 2, 7); X.strokeStyle = INK; X.lineWidth = 3; X.strokeRect(-tw - 1, -h - 4, tw * 2 + 2, 7);
  X.restore();
}

/* ───────────── the street, painted once per seat count ───────────── */
const BGC = {};
function buildBg(n) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  const gr = X.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
  X.beginPath(); X.moveTo(0, 250); [[80, 190], [170, 232], [260, 160], [360, 215], [450, 172], [560, 225], [680, 182], [800, 230]].forEach(p => X.lineTo(p[0], p[1])); X.lineTo(W, 340); X.lineTo(0, 340); X.closePath();
  X.fillStyle = '#c9d0fb'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#7b80c6'; X.stroke();
  X.beginPath(); X.moveTo(0, 214); X.quadraticCurveTo(240, 232, 520, 296); X.lineTo(520, 340); X.lineTo(0, 340); X.closePath(); X.fillStyle = '#87d19b'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#2f7a49'; X.stroke();
  let s = 11; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
  const HC = ['#ffb347', '#ff7a8a', '#7fd3ff', '#ffe066', '#b6e388', '#f49ac2', '#c9b6ff'];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 15; i++) {
    const hx = 6 + i * 34 + row * 13 + rnd() * 8, hy = 322 - row * 21 - hx * .12 - rnd() * 5; if (hx > 490) continue;
    rr(hx, hy, 24, 18, 3); ink(HC[(i + row * 3) % HC.length], 2.5);
    rr(hx - 3, hy - 5, 30, 6, 2); ink('#c9ced6', 2.5);
    X.fillStyle = INK; X.fillRect(hx + 9, hy + 7, 6, 11); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(hx + 3, hy + 4, 4, 4);
  }
  // road and sidewalk
  X.fillStyle = '#6a6779'; X.fillRect(0, 334, W, 66); X.fillStyle = '#ffd23f'; for (let x = 10; x < W; x += 70) X.fillRect(x, 366, 38, 5);
  X.fillStyle = INK; X.fillRect(0, 330, W, 5);
  X.fillStyle = '#d8cfc0'; X.fillRect(0, 400, W, 200); X.fillStyle = '#bfb4a0'; X.fillRect(0, 400, W, 10);
  X.strokeStyle = '#bfb4a0'; X.lineWidth = 2; for (let y = 440; y < 600; y += 60) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let y = 410, r = 0; y < 600; y += 60, r++) for (let x = (r % 2) * 50; x < W; x += 100) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 60); X.stroke(); }
  X.fillStyle = INK; X.fillRect(0, 398, W, 5);
  // the kitchen (cutaway house) on the right
  X.fillStyle = '#ffe0a8'; X.fillRect(500, 150, 310, 252);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 504; x < W; x += 30) X.fillRect(x, 150, 9, 252);
  X.fillStyle = 'rgba(255,120,150,.45)'; for (let y = 172; y < 396; y += 44) for (let x = 520 + (y / 44 & 1) * 15; x < W; x += 30) { X.beginPath(); X.arc(x, y, 3, 0, TAU); X.fill(); }
  X.fillStyle = '#f2d9a8'; X.fillRect(500, 400, 310, 200); X.fillStyle = '#e6c68a'; for (let y = 400, r = 0; y < 600; y += 40, r++) for (let x = 500 + (r % 2) * 40; x < W; x += 80) X.fillRect(x, y, 40, 40);
  X.fillStyle = INK; X.fillRect(500, 398, 310, 5);
  rr(488, 150, 14, 252, 4); ink('#ffd23f', 3.5);
  rr(486, 112, 330, 40, 6); ink('#ff7a8a', 4);
  X.fillStyle = '#c9ced6'; X.beginPath(); X.moveTo(470, 114); X.lineTo(520, 70); X.lineTo(826, 70); X.lineTo(826, 114); X.closePath(); X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.strokeStyle = '#8f9cb3'; X.lineWidth = 3; for (let x = 480; x < 826; x += 18) { X.beginPath(); X.moveTo(x, 112); X.lineTo(x + 10, 74); X.stroke(); }
  rr(640, 168, 90, 74, 6); ink('#bfeaff', 4); X.strokeStyle = '#d9944f'; X.lineWidth = 5; X.beginPath(); X.moveTo(685, 168); X.lineTo(685, 242); X.moveTo(640, 205); X.lineTo(730, 205); X.stroke();
  glint(656, 184, 5, 12, -.4, .6);
  rr(516, 238, 120, 10, 4); ink('#d9944f', 3.5);
  rr(530, 214, 26, 24, 4); ink('#8f9cb3', 3); rr(566, 220, 34, 18, 4); ink('#e8434f', 3); rr(612, 222, 18, 16, 4); ink('#ffd23f', 3);
  rr(756, 176, 34, 44, 3); ink('#fff', 3); X.fillStyle = '#e8434f'; X.fillRect(756, 176, 34, 12);
  // the barrio tank (la pila), left
  const sx = XS[n][0] + HX;
  rr(8, 262, 114, 140, 8); ink('#7fb6e8', 4);
  X.save(); rr(8, 262, 114, 140, 8); X.clip(); X.fillStyle = '#5d97d4'; X.fillRect(96, 262, 30, 140); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(18, 270, 8, 124); X.restore();
  rr(0, 250, 130, 20, 6); ink('#b8c4d8', 4);
  for (const px of [34, 94]) { X.fillStyle = INK; X.fillRect(px - 2, 300, 4, 6); }
  line([[122, 318], [sx, 318], [sx, 346]], 11, '#c9ced6');
  rr(sx - 11, 342, 22, 14, 4); ink('#8f9cb3', 3);
  X = old; return cv;
}

/* ═════════ the game ═════════ */
function sqBalde(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), last = n - 1, judge = me === last;
  const kind = me === 0 ? 'pila' : me === last ? 'cocina' : 'medio', xs = XS[n];
  /* the level: identical on every screen (the same number of draws whatever the role) */
  const OFF = [0, 1, 2, 3].map(() => R() * P);
  const EV = [0, 1, 2].map(k => ({ s0: 3.6 + k * 4.3 + R() * 1.4, done: 0, at: 0 }));
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  const hx = i => xs[i] + HX;
  /* state */
  let S = 0, hands = null, filling = false, ptrOn = false, keyOn = false, nextId = 0, units = 0, poured = 0, shownU = 0, lock = 0, lastF = -1, fAt = -9;
  let resAt = -1, endFx = false, pourFx = null, slap = null, lostN = 0, passAt = -9, lastFillNet = -9;
  const holds = [null, null, null, null], flights = [], splashes = [], pops = [];
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const press = s => { const f = s / Math.max(1, g.limit * TS); if (f >= .9) return 0; const base = f < .5 ? 1 : 1 - .5 * (f - .5) / .4; return f > .74 && Math.sin(s * 13) > .35 ? base * .3 : base; };
  const ringU = (seat, tt) => (((tt + OFF[seat]) % P) + P) % P / P;
  const ringOpen = (seat, tt, L) => ringU(seat, tt) < upf(L);
  const catNow = () => { for (let k = 0; k < 3; k++) { const e = EV[k]; if (!e.done && S >= e.s0 && S < e.s0 + STAY) return { k, e }; } return null; };
  const CATX = xs[last] + 90;
  const busyNext = () => !!holds[me + 1] || flights.some(f => f.f === me && f.res === -1 && g.c - f.t0 < 1.4);

  function startFill() {
    if (kind !== 'pila' || g.result || filling || hands || g.c < lock) return;
    hands = { i: me * 100 + nextId++, L: 0, at: g.c }; filling = true; holds[0] = hands;
  }
  function endFill() {
    if (!filling) return; filling = false;
    if (!hands || hands.L < MINL) { hands = null; holds[0] = null; D.send('f', 0); return; }
    doPass();
  }
  function doPass() {
    if (!hands || kind === 'cocina' || g.result || g.c < lock) return;
    const b = hands; hands = null; filling = false; holds[me] = null; passAt = g.c;
    D.send('p', { i: b.i, l: Math.round(b.L * 100), t: Math.round(S * 1000) });
    flights.push({ i: b.i, f: me, l: b.L, t0: g.c, res: -1 });
    snd(520, .08, 'triangle', .05, 0, 760); noise(.14, .04, 700, 2600, 'bandpass');
    if (flights.length > 24) flights.shift();
  }
  function pour() {
    if (kind !== 'cocina' || !hands || g.result || g.c < lock) return;
    const L = hands.L; hands = null; holds[me] = null; units += .5 + L; poured++; shownU = Math.max(shownU, 0);
    pourFx = { t0: g.c, L }; D.send('o', { u: Math.round(units * 100), c: poured, l: Math.round(L * 100) });
    noise(.5, .07, 500, 1800, 'bandpass'); snd(300, .12, 'sine', .06, .1, 520); sfx.pop();
  }
  function doSlap() {
    if (kind !== 'cocina' || g.result || g.c < lock) return;
    const c = catNow();
    if (!c) { lock = g.c + .3; slap = { t0: g.c, hit: false }; snd(240, .1, 'sawtooth', .04, 0, 100); return; }
    c.e.done = 2; c.e.at = g.c; slap = { t0: g.c, hit: true }; D.send('x', { e: c.k, k: 0 });
    sfx.hit(); shake(4, .14); pop('FLIP-FLOP!', CATX, GY - 120, 24, '#ff7a1a');
  }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['FILL UP!', 'PASS!', 'POUR IT!'][me === 0 ? 0 : me === last ? 2 : 1], roleLabel: ['WATER TAP', 'NEIGHBOUR', 'GRANNY'][me === 0 ? 0 : me === last ? 2 : 1],
    hint: [
      'HOLD SPACE (OR CLICK) TO FILL THE BUCKET, LET GO WHEN THE NEXT RING IS GREEN',
      'PRESS SPACE (OR CLICK) TO PASS THE BUCKET WHEN THE NEXT RING IS GREEN',
      'SPACE POURS INTO THE BARREL - ◄ ► SLAPS THE CAT WITH A FLIP-FLOP'][me === 0 ? 0 : me === last ? 2 : 1],
    thint: [
      'HOLD TO FILL THE BUCKET, LET GO WHEN THE NEXT RING IS GREEN',
      'TAP TO PASS THE BUCKET WHEN THE NEXT RING IS GREEN',
      'TAP TO POUR INTO THE BARREL - TAP THE CAT TO SLAP IT'][me === 0 ? 0 : me === last ? 2 : 1],
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!g.result;
      if (!done) {
        const ds = dt * TS; S += ds;
        if (filling && hands) {
          const pr = press(S); hands.L = Math.min(1, hands.L + FILLR * pr * ds);
          const v = Math.round(hands.L * 50); if (v !== lastF && g.c - fAt >= .1) { lastF = v; fAt = g.c; D.send('f', Math.round(hands.L * 100), true); }
          if (hands.L >= 1 && Math.floor(g.c * 6) % 3 === 0) burst(hx(0) + 8, GY - 6, '#7fd8ff', 1, 120);
        } else if (hands && kind !== 'pila') hands.L = Math.max(0, hands.L - SLOSH * ds);
        if (kind === 'cocina') {
          for (const e of EV) {
            if (e.done) continue;
            if (S >= e.s0 + GRAB && S < e.s0 + STAY && hands) { e.done = 1; e.at = g.c; hands = null; holds[me] = null; lostN++; D.send('x', { e: EV.indexOf(e), k: 1 }); sfx.buzz(); pop('STOLEN!', CATX - 30, GY - 130, 24, '#e8343d'); }
            else if (S >= e.s0 + STAY) e.done = 3;
          }
        }
        if (kind !== 'cocina') for (const e of EV) if (!e.done && S >= e.s0 + STAY) e.done = 3;
        // the tap runs dry: a sad last drip
        if (judge) {
          if (units >= NEED) g.finish('win');
          else if (g.c >= g.limit) g.finish('lose');
        }
      }
      shownU += (units - shownU) * Math.min(1, dt * 5);
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); noise(.7, .08, 800, 3000, 'bandpass'); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); noise(.6, .09, 600, 1200, 'lowpass'); snd(330, .5, 'sawtooth', .05, 0, 110); shake(5, .2); }
      while (pops.length && g.c - pops[0].t0 > 1.1) pops.shift();
      for (let i = splashes.length - 1; i >= 0; i--) if (g.c - splashes[i].t0 > 1) splashes.splice(i, 1);
      for (let i = flights.length - 1; i >= 0; i--) if (g.c - flights[i].t0 > 3) flights.splice(i, 1);
    },
    msg(type, d, from) {
      if (type !== 'f' && !d) return;
      if (type === 'p') {
        if (!d || typeof d.i !== 'number') return;
        const L = clamp((d.l || 0) / 100, 0, 1);
        if (from !== me && !flights.some(f => f.i === d.i)) flights.push({ i: d.i, f: from, l: L, t0: g.c, res: -1 });
        holds[from] = null; if (from === 0 && me !== 0) lastFillNet = -9;
        if (from === me - 1 && kind !== 'pila' && !g.result) {
          const ok = !hands && ringOpen(me, (d.t || 0) / 1000, L);
          if (ok) { hands = { i: d.i, L, at: g.c }; holds[me] = hands; D.send('a', { i: d.i }); snd(660, .06, 'triangle', .05); }
          else { D.send('r', { i: d.i, b: hands ? 1 : 0 }); splashes.push({ x: hx(me) - 10, y: GY - 6, t0: g.c }); sfx.splat(); }
        }
      } else if (type === 'a') {
        const f = flights.find(q => q.i === d.i); if (f) f.res = 1; holds[from] = { L: f ? f.l : .5 };
      } else if (type === 'r') {
        const f = flights.find(q => q.i === d.i); if (f) { f.res = 0; if (from !== me) splashes.push({ x: hx(from) - 10, y: GY - 6, t0: g.c }); if (f.f === me) { pop('SPLASH!', hx(me) + 20, GY - 90, 24, '#2b9ee6'); sfx.splat(); } }
      } else if (type === 'f') {
        if (from === 0 && me !== 0) { holds[0] = { L: (d || 0) / 100, fill: 1 }; lastFillNet = g.c; }
      } else if (type === 'o') {
        if (!judge) { units = Math.max(units, d.u / 100); poured = Math.max(poured, d.c); pourFx = { t0: g.c, L: d.l / 100 }; holds[last] = null; }
      } else if (type === 'x') {
        const e = EV[d.e]; if (!e) return; e.done = d.k ? 1 : 2; e.at = g.c;
        if (d.k) holds[last] = null;
      }
    },
    down(p) {
      if (g.result) return; ptrOn = true;
      if (kind === 'pila') startFill();
      else if (kind === 'medio') doPass();
      else {
        const c = catNow();
        if (p.y > 500 && p.x > 400) doSlap();
        else if (p.y > 500) pour();
        else if (c && Math.hypot(p.x - CATX, p.y - (GY - 24)) < 80) doSlap();
        else pour();
      }
    },
    move() {},
    up() { ptrOn = false; if (!keyOn) endFill(); },
    key(e) {
      if (e.repeat || g.result) return;
      if (kind === 'cocina') { if (KEYS.includes(e.code)) pour(); else if (SLAPKEYS.includes(e.code)) doSlap(); return; }
      if (!KEYS.includes(e.code)) return;
      keyOn = true; if (kind === 'pila') startFill(); else doPass();
    },
    keyup(e) { if (KEYS.includes(e.code)) { keyOn = false; if (!ptrOn) endFill(); } },
    draw(tm) {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      const LIMS = Math.max(1, g.limit * TS), f = clamp(S / LIMS, 0, 1), pr = press(S), dry = f >= .9, sputter = f > .72;
      if (!BGC[n]) BGC[n] = buildBg(n); X.drawImage(BGC[n], 0, 0);
      drawLive(T, won, lost, rk, f, pr, dry, sputter);
    },
  };

  /* ── drawing ── */
  function handBucket(i) { return i === me ? hands : holds[i]; }
  function ringUI(i, T, L, showTag) {
    const x = xs[i], y = GY - 112, u = ringU(i, S), up = upf(L), busy = !!handBucket(i), open = !busy && u < up && !g.result;
    X.save(); X.translate(x, y); const pulse = open ? 1.15 + Math.sin(T * 18) * .05 : 1; X.scale(pulse, pulse);
    if (open) { X.beginPath(); X.arc(0, 0, 33, 0, TAU); X.fillStyle = 'rgba(255,255,255,.55)'; X.fill(); }
    X.beginPath(); X.arc(0, 0, 24, 0, TAU); ink('#fff', 4);
    X.lineCap = 'butt'; X.lineWidth = 8; X.strokeStyle = busy ? '#a39fb8' : '#ff6b6b'; X.beginPath(); X.arc(0, 0, 17, 0, TAU); X.stroke();
    X.strokeStyle = busy ? '#cfcbe0' : '#3ddc5f'; X.beginPath(); X.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + up * TAU); X.stroke();
    const a = -Math.PI / 2 + u * TAU; X.lineCap = 'round'; X.lineWidth = 3.5; X.strokeStyle = INK; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); X.stroke();
    X.beginPath(); X.arc(0, 0, 4, 0, TAU); ink(INK, 0);
    if (busy) { X.fillStyle = INK; for (const q of [-1, 1]) { X.fillRect(q * 6 - 1.5, -3, 3, 9); } }
    X.restore();
    if (showTag && open) badge('NOW!', x, y - 46, 15, '#22a447', '#fff', 1, -.04);
  }
  function arm(i, T, bx, by) {
    const x = xs[i], sx = x + 7.2 * U, sy = GY - 6.5 * U;
    line([[sx, sy], [lerp(sx, bx, .5) + 4, lerp(sy, by, .5) + 6], [bx - 2, by]], 5, cols(i));
  }
  function worker(i, T, won, lost) {
    const x = xs[i], bob = won ? Math.abs(Math.sin(T * 9 + i)) * 10 : lost ? 0 : Math.sin(T * 5 + i * 1.3) * 1.2;
    shadow(x, GY + 4, 32, 7, .25);
    const b = handBucket(i), holding = !!b || (i === 0 && !g.result);
    caos(x, GY - bob, U, { col: cols(i), mood: won ? 'happy' : lost ? 'sad' : null });
    if (i === 0) { const cx = x, cy = GY - bob - 12.2 * U; X.beginPath(); X.arc(cx, cy, 3 * U, Math.PI, 0); X.closePath(); ink('#e8434f', 3); rr(cx - 4 * U, cy - 2, 7.5 * U, 5, 2.5); ink('#c92f43', 2.5); }
    else if (i < last) { X.fillStyle = INK; X.fillRect(x - 5.6 * U - 2, GY - bob - 10.6 * U - 2, 11.2 * U + 4, 2.4 * U + 4); for (let k = 0; k < 3; k++) { X.fillStyle = ['#ffd23f', '#2f6fe0', '#e8343d'][k]; X.fillRect(x - 5.6 * U + k * 3.73 * U, GY - bob - 10.6 * U, 3.73 * U, 2.4 * U); } }
    if (holding && i !== last) arm(i, T, hx(i), GY - 30 - bob);
  }
  function abuela(T, won, lost, rk) {
    const x = xs[last], u = 4.6, bob = won ? Math.abs(Math.sin(T * 8)) * 8 : 0;
    shadow(x, GY + 4, 34, 8, .25);
    caos(x, GY - bob, u, { col: cols(last), mood: won ? 'happy' : lost ? 'sad' : null });
    for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 4 * u, GY - bob - 12.8 * u, 1.9 * u, 0, TAU); ink('#e8e4f2', 3); }
    for (const sx of [-1, 1]) { X.beginPath(); X.arc(x + sx * 2.8 * u, GY - bob - 6.2 * u, 1.95 * u, 0, TAU); X.fillStyle = 'rgba(255,255,255,.4)'; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
    line([[x - .9 * u, GY - bob - 6.2 * u], [x + .9 * u, GY - bob - 6.2 * u]], 2, INK);
    rr(x - 5.2 * u, GY - bob - 5.2 * u, 10.4 * u, 4.6 * u, 6); ink('#ffb3cf', 3);
    X.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { X.beginPath(); X.arc(x - 3.6 * u + k * 1.8 * u, GY - bob - 4 * u + (k % 2) * 1.2 * u, .45 * u, 0, TAU); X.fill(); }
    rr(x - 4.6 * u, GY - bob - 1.4, 3.4 * u, 6, 3); ink('#5CFF7A', 2); rr(x + 1.2 * u, GY - bob - 1.4, 3.4 * u, 6, 3); ink('#5CFF7A', 2);
    if (!lost) { const b = handBucket(last); if (b || (!won && g.c < 1)) arm(last, T, hx(last), GY - 30 - bob); }
    if (won) {
      const k = clamp((rk - .1) / .3, 0, 1), by = GY - bob - 15.4 * u - (1 - ease(k)) * 80;
      bucket(x, by + 2, .55, 1.15, Math.PI, T, '#ffd23f');
      for (let q = 0; q < 5; q++) star(x + Math.cos(T * 5 + q * 1.26) * 36, by - 18 + Math.sin(T * 5 + q * 1.26) * 12, 7, 3, 5, T * 3 + q, '#FFE14D', 2);
    }
    if (lost && rk >= 0) {
      const k = clamp(rk / .5, 0, 1), by = GY - 15 * u - 80 + (1 - ease(k)) * -40;
      bucket(x - 8, by, 0, 1.5, 2.2, T, '#ff4d5e');
      X.save(); X.globalAlpha = .75;
      el(x, GY - 5.5 * u, 6.2 * u * ease(k), 7.6 * u * ease(k)); X.fillStyle = WATER; X.fill();
      X.globalAlpha = 1; X.restore();
      for (let q = 0; q < 8; q++) { const yy = GY - 13 * u + ((T * 2.2 + q * .37) % 1) * 12 * u, xx = x + Math.sin(q * 2.7) * 6 * u; el(xx, yy, 1.1, 2.4); ink(WATER, 1.5); }
      el(x, GY + 2, 54 * ease(k), 11 * ease(k)); X.fillStyle = 'rgba(79,195,247,.8)'; X.fill();
    }
  }
  function barrel(T, won, lost, rk) {
    const x = BX, u = clamp(shownU / NEED, 0, 1);
    shadow(x, GY + 4, 46, 9, .28);
    rr(x - 36, BTOP, 72, 114, 10); ink('#2d7fe6', 4);
    X.save(); rr(x - 36, BTOP, 72, 114, 10); X.clip(); X.fillStyle = '#1f5fb8'; X.fillRect(x + 12, BTOP, 30, 114); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(x - 28, BTOP + 6, 7, 100);
    X.fillStyle = '#17489a'; for (const yy of [BTOP + 30, BTOP + 62, BTOP + 92]) X.fillRect(x - 40, yy, 80, 5); X.restore();
    el(x, BTOP, 36, 10); ink(lost ? '#12304f' : '#0d3a6e', 3.5);
    if (u > .02 || won) { el(x, BTOP + 1, 31, 7); X.fillStyle = WATER; X.fill(); glint(x - 10, BTOP, 8, 2.4, 0, .6); }
    // sight tube with the eight marks
    rr(x - 66, BTOP + 8, 16, 100, 7); ink('#e8f6ff', 3.5);
    X.save(); rr(x - 66, BTOP + 8, 16, 100, 7); X.clip(); X.fillStyle = WATER; const wh = 100 * u; X.fillRect(x - 66, BTOP + 108 - wh, 16, wh); X.restore();
    X.strokeStyle = INK; X.lineWidth = 2; for (let k = 1; k < NEED; k++) { const yy = BTOP + 108 - 100 * k / NEED; X.beginPath(); X.moveTo(x - 50, yy); X.lineTo(x - 42, yy); X.stroke(); }
    if (won && rk >= 0) { for (let q = 0; q < 6; q++) { const k = (rk * 1.6 + q * .17) % 1, xx = x + (q - 2.5) * 11; el(xx, BTOP - k * 60 + k * k * 70, 5, 8); ink(WATER, 2); } for (const sx of [-1, 1]) { el(x + sx * 38, BTOP + 30 + (rk * 60) % 70, 4, 9); ink(WATER, 2); } }
    if (lost && rk > .3) {
      const k = outBack((rk - .3) / .3), by = BTOP - 30 + Math.sin(T * 3) * 2;
      X.save(); X.translate(x, by); X.scale(k, k);
      rr(-17, -17, 34, 34, 7); ink('#d8f6ff', 3.5); glint(-8, -8, 5, 3, -.5, .8);
      X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 8 - 4, -6); X.lineTo(sx * 8 + 4, -3); X.stroke(); }
      X.beginPath(); X.arc(0, 10, 6, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); el(15, 2 + (T * 20) % 10, 2.4, 4); ink('#9fe3ff', 1.5);
      X.restore();
    }
  }
  function cat(x, y, T, o) {                                  // sits at (x, y)=feet; o = {face (+1 looks right), tail, dizzy, bucketOn}
    const f = o.face || -1, tl = Math.sin(T * 6) * (o.tail || .5);
    X.save(); X.translate(x, y); X.rotate(o.rot || 0);
    X.beginPath(); X.moveTo(-f * 14, -12); X.quadraticCurveTo(-f * 34, -24 + tl * 14, -f * 26, -44 + tl * 10); X.lineWidth = 11; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#ffb04d'; X.stroke();
    el(0, -16, 18, 15); ink('#ffb04d', 3.5);
    X.strokeStyle = '#c97a1f'; X.lineWidth = 3; for (const k of [-6, 2, 10]) { X.beginPath(); X.moveTo(k, -29); X.lineTo(k - 2, -21); X.stroke(); }
    el(f * 12, -34, 13, 12); ink('#ffb04d', 3.5);
    for (const sx of [-1, 1]) tri(f * 12 + sx * 12, -38, f * 12 + sx * 5, -46, f * 12 + sx * 9, -30, '#ffb04d', 2.5);
    for (const sx of [-1, 1]) { const ex = f * 12 + sx * 5.5; if (o.dizzy) { X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(ex - 3, -39); X.lineTo(ex + 3, -33); X.moveTo(ex + 3, -39); X.lineTo(ex - 3, -33); X.stroke(); } else { el(ex, -36, 4.2, 5); ink('#fff', 1.8); X.fillStyle = INK; X.beginPath(); X.arc(ex - f * 1.5, -35, 2.2, 0, TAU); X.fill(); } }
    X.fillStyle = '#ff7ea8'; X.beginPath(); X.arc(f * 12, -31, 2, 0, TAU); X.fill();
    X.strokeStyle = INK; X.lineWidth = 1.6; for (const sx of [-1, 1]) for (const k of [-2, 2]) { X.beginPath(); X.moveTo(f * 12 + sx * 6, -30 + k); X.lineTo(f * 12 + sx * 18, -30 + k * 2); X.stroke(); }
    if (o.bucketOn) bucket(f * 12, -42, o.bL || .5, .8, 0, T, '#ff4d5e');
    X.restore();
  }
  function drawLive(T, won, lost, rk, f, pr, dry, sputter) {
    // sky life: sun rays, clouds, a macaw, a motorbike with the whole family
    X.save(); X.translate(430, 74); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 38); X.lineTo(8, 38); X.lineTo(0, 62); X.fill(); }
    X.restore(); X.beginPath(); X.arc(430, 74, 28, 0, TAU); ink('#ffe14d', 4); glint(422, 66, 10, 6, -.6, .7);
    for (const [sx, sy, sc, spd] of [[40, 140, .8, 9], [330, 190, .6, 5], [610, 40, .65, 7]]) {
      const cx = ((T * spd + sx) % 1000) - 140;
      X.save(); X.beginPath(); X.rect(-OX, 0, 490 + OX, 400); X.rect(490, 0, 330 + OX, 66); X.clip(); X.translate(cx, sy); X.scale(sc, sc); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
      for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
    }
    { const bx = ((T * 46 + 60) % 1000) - 100, by = 210 + Math.sin(T * 2.2) * 14, fl = Math.sin(T * 14) * 9;
      X.save(); X.translate(bx, by);
      el(0, 0, 16, 7, -.1); ink('#e8343d', 3); tri(-14, -2, -30, -6, -26, 6, '#2f6fe0', 2.5); tri(-2, 0, 6, fl - 14, 14, -2, '#ffd23f', 2.5);
      X.beginPath(); X.arc(15, -3, 6, 0, TAU); ink('#fff', 3); X.fillStyle = INK; X.beginPath(); X.arc(17, -4, 1.6, 0, TAU); X.fill(); tri(20, -3, 27, 0, 19, 2, '#ffb347', 2); X.restore(); }
    { const mx = ((T * 85 + 300) % 1200) - 200, my = 366;
      X.save(); X.translate(mx, my);
      for (const wx of [-26, 26]) { X.beginPath(); X.arc(wx, 0, 13, 0, TAU); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#7d7690'; X.stroke(); }
      rr(-24, -22, 50, 16, 7); ink('#e8343d', 3); line([[18, -20], [28, -8]], 4, '#8f9cb3'); rr(-26, -26, 26, 7, 3); ink('#3b3550', 2.5);
      for (const [k, c] of [[-10, '#6EA8FE'], [4, '#ffd23f'], [16, '#7CE08A']]) { rr(k - 5, -40 - (k === 4 ? 4 : 0), 11, 15, 3); ink(c, 2.5); }
      X.restore(); }
    // the kitchen telenovela
    X.fillStyle = INK; X.fillRect(522, 190, 4, 20); rr(522, 192, 36, 24, 4); ink('#3b3550', 3);
    rr(526, 196, 28, 16, 3); ink(Math.floor(T * 3) % 2 ? '#9fe3ff' : '#ff8fb1', 1.5);
    line([[532, 192], [524, 180]], 2.5, '#8f9cb3'); line([[548, 192], [558, 180]], 2.5, '#8f9cb3');
    if (Math.floor(T * 1.5) % 4 === 0) { X.globalAlpha = .9; txt('♥', 540, 204, 12, '#e8343d'); X.globalAlpha = 1; }
    // the tap: wheel, gauge, stream, sputter
    const sx = hx(0), tapOpen = me === 0 ? filling : (g.c - lastFillNet < .45 && !!holds[0] && holds[0].fill);
    X.save(); X.translate(sx + 16, 318); X.rotate(tapOpen ? T * 10 : 0); line([[-8, 0], [8, 0]], 5, '#e8343d'); line([[0, -8], [0, 8]], 5, '#e8343d'); X.restore();
    rr(sx - 11, 342, 22, 14, 4); ink('#8f9cb3', 3);
    const gx = 64, gyy = 332;
    X.beginPath(); X.arc(gx, gyy, 20, 0, TAU); ink('#fff', 3.5);
    X.lineWidth = 5; X.lineCap = 'butt'; for (const [a0, a1, c] of [[-2.4, -1.2, '#ff6b6b'], [-1.2, -.3, '#ffd23f'], [-.3, .7, '#3ddc5f']]) { X.beginPath(); X.arc(gx, gyy, 13, a0, a1); X.strokeStyle = c; X.stroke(); }
    const na = lerp(.7, -2.4, 1 - pr) + (dry ? Math.sin(T * 30) * .04 : 0); X.lineCap = 'round'; X.lineWidth = 3.5; X.strokeStyle = INK; X.beginPath(); X.moveTo(gx, gyy); X.lineTo(gx + Math.cos(na) * 14, gyy + Math.sin(na) * 14); X.stroke();
    rr(18, 372, 96, 24, 6); ink('#fff', 3); txt(dry ? 'NO WATER!' : 'WATER', 66, 385, 15, dry ? '#e8343d' : '#2b6fd0', 'center', 86);
    const topY = 356, botY = 408;
    if (!dry) {
      const open = tapOpen && pr > 0, w = open ? 4 + 8 * pr : 2 + 1.5 * pr, gap = sputter && Math.sin(T * 17) > .3;
      if (!gap || tapOpen === false) { X.fillStyle = WATER; X.globalAlpha = .95; rr(sx - w / 2, topY, w, botY - topY, w / 2); X.fill(); X.globalAlpha = 1; }
      if (sputter) for (let q = 0; q < 3; q++) { const k = (T * 3 + q * .33) % 1; X.globalAlpha = 1 - k; el(sx + 8 + k * 14, 346 - k * 12, 3 + k * 4, 2.6 + k * 3); ink('#fff', 1.5); X.globalAlpha = 1; }
    } else {
      const k = (T * 1.2) % 1; el(sx, topY + k * 40, 3, 4.5); ink(WATER, 2);
      X.globalAlpha = .7; txt('pfft...', sx + 36, 334 - ((T * 30) % 14), 13, '#fff'); X.globalAlpha = 1;
    }
    // the chain
    for (let i = 0; i < n; i++) if (i < last) worker(i, T, won, lost);
    abuela(T, won, lost, rk);
    // buckets in hands
    for (let i = 0; i < n; i++) {
      const b = handBucket(i); let L = b ? b.L : -1;
      if (i === 0 && !b && !g.result) L = 0;
      if (i === last && b) { const pf = pourFx && g.c - pourFx.t0 < .6; if (pf) continue; }
      if (L < 0) continue;
      const bob = i === me ? 0 : 0, sl = b && i > 0 ? Math.sin(T * 12 + i) * .06 * (1 - b.L * .3) : 0;
      bucket(hx(i), GY - 4 - bob, L, 1, sl, T, i === 0 && !b ? '#c9ced6' : undefined);
    }
    // pour animation (the bucket tips into the barrel)
    if (pourFx && g.c - pourFx.t0 < .6) {
      const k = (g.c - pourFx.t0) / .6, e = Math.sin(clamp(k, 0, 1) * Math.PI), px = lerp(hx(last), BX - 36, e), py = lerp(GY - 4, BTOP - 40, e), rot = e * 1.5;
      bucket(px, py, pourFx.L * (1 - clamp((k - .2) / .6, 0, 1)), 1, rot, T);
      if (k > .15 && k < .85) { X.fillStyle = WATER; rr(BX - 9, py - 12, 7, BTOP - py + 10, 3); X.fill(); }
    }
    // flights
    for (const fl of flights) {
      const k = (g.c - fl.t0) / FLY; if (k < 0 || k >= 1 || fl.res === 0 && k > .7) continue;
      const x0 = hx(fl.f), x1 = hx(Math.min(last, fl.f + 1)), x = lerp(x0, x1, ease(k)), y = GY - 4 - Math.sin(k * Math.PI) * 78;
      bucket(x, y, fl.l, 1, (k - .5) * .5, T);
    }
    for (const sp of splashes) { const k = (g.c - sp.t0) / 1; X.globalAlpha = 1 - k; for (let q = 0; q < 5; q++) { const a = -Math.PI * (q / 4); el(sp.x + Math.cos(a) * 26 * k, sp.y + Math.sin(a) * 30 * k + k * k * 20, 6 - k * 3, 6 - k * 3); ink(WATER, 1.8); } el(sp.x, sp.y + 6, 24 * Math.min(1, k * 3), 6); X.fillStyle = 'rgba(79,195,247,.8)'; X.fill(); X.globalAlpha = 1; }
    barrel(T, won, lost, rk);
    // the cat
    for (let k = 0; k < 3; k++) {
      const e = EV[k], ph = S - e.s0; if (g.result && e.done === 0) continue;
      if (e.done === 2) {                                           // slapped: sails away dizzy
        const a = g.c - e.at; if (a > 1.1) continue;
        cat(CATX + a * 220, GY - 24 - Math.sin(Math.min(1, a / 1.1) * Math.PI) * 130, T, { face: -1, dizzy: true, rot: a * 9 }); continue;
      }
      if (e.done === 1) {                                           // stole it: runs off with the bucket on its head
        const a = g.c - e.at; if (a > 1.4) continue;
        const run = a < .2 ? 0 : (a - .2); cat(a < .2 ? lerp(hx(last) + 6, CATX, a / .2) : CATX + run * 380, GY - (a < .2 ? 60 * Math.sin(a / .2 * Math.PI) : 0), T, { face: 1, tail: 1.2, bucketOn: true, bL: .7 }); continue;
      }
      if (ph < -.55 || ph > STAY + .9) continue;
      let cx = CATX, stage = 0;
      if (ph < 0) cx = lerp(CATX + 190, CATX, ease((ph + .55) / .55)); else if (ph > STAY) { cx = CATX + (ph - STAY) * 300; stage = 1; }
      cat(cx, GY - (ph < 0 || stage ? Math.abs(Math.sin(T * 20)) * 6 : 0), T, { face: stage ? 1 : -1, tail: ph > 1 ? 1.2 : .5 });
      if (ph >= 0 && ph < STAY && !g.result) { badge('MEOW!', cx, GY - 96, 18, '#ff7a1a', '#fff', outBack((ph + .1) / .25), .05); }
    }
    if (slap) { const a = g.c - slap.t0; if (a < .35) { const xx = lerp(xs[last] + 20, CATX - 10, ease(a / .3)), yy = GY - 40 - Math.sin(a / .35 * Math.PI) * 24; X.save(); X.translate(xx, yy); X.rotate(a * 22); rr(-9, -4, 18, 8, 4); ink('#5CFF7A', 2.5); X.restore(); } else slap = null; }
    // ready rings above every receiving seat
    if (!g.result) for (let i = 1; i < n; i++) { const pb = handBucket(i - 1); ringUI(i, T, pb ? pb.L : .5, i === me + 1 && !!hands && !g.result); }
    // name tags
    for (let i = 0; i < n; i++) pill(xs[i], GY + 28, i === me ? 'YOU' : name(i), cols(i));
    // the barrel sign: eight drops
    rr(560, 96, 200, 44, 12); ink('#d9944f', 4);
    for (let k = 0; k < NEED; k++) { const fill = clamp(units - k, 0, 1), dx = 584 + k * 23; el(dx, 118, 7, 9); ink('#fff', 2); if (fill > 0) { X.save(); el(dx, 118, 7, 9); X.clip(); X.fillStyle = WATER; X.fillRect(dx - 8, 127 - 18 * fill, 16, 18 * fill); X.restore(); } }
    // plates (controls in the world)
    if (!g.result) {
      if (kind === 'pila') plate(250, 502, 300, 40, '#4fd06a', '#24803a', filling, 'HOLD TO FILL', 'SPACE');
      else if (kind === 'medio') plate(250, 502, 300, 40, '#ffd23f', '#c99512', T - passAt < .12, 'PASS!', 'SPACE');
      else { plate(90, 502, 290, 40, '#4fd06a', '#24803a', pourFx && g.c - pourFx.t0 < .15, 'POUR IN', 'SPACE'); plate(420, 502, 290, 40, '#ff7a1a', '#b0540f', slap && g.c - slap.t0 < .15, 'FLIP-FLOP!', '◄ ►'); }
    }
    // payoffs
    if (won && rk > .15) badge('FULL BARREL!', 400, 150, 32, '#22a447', '#fff', outBack((rk - .15) / .25), -.04);
    if (lost && rk > .4) badge('DRENCHED!', 400, 150, 32, '#e8343d', '#fff', outBack((rk - .4) / .25), .04);
    if (!g.result && g.c < 2.6) badge('PASS THE WATER!', 400, 200, 24, '#2b9ee6', '#fff', outBack(g.c / .3), -.03);
    for (const q of pops) { const aa = g.c - q.t0; badge(q.s, q.x, q.y - aa * 20, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
    vignette(.14);
  }
  g.dbg = {
    view: () => ({ S, me, n, kind, hand: hands ? hands.L : null, filling, busyNext: kind !== 'cocina' ? busyNext() : false, f: S / Math.max(1, g.limit * TS), units, handAt: hands ? hands.at : 0 }),
    open: (L, ahead = 0) => me < last && ringOpen(me + 1, S + ahead, L),
    cat: () => { const c = catNow(); return c ? { x: CATX, y: GY - 24, age: S - c.e.s0 } : null; },
    OFF, EV, P, upf,
  };
  wire(g, D, last, sp, 'sq_balde');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  const gr = X.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 240);
  X.fillStyle = '#87d19b'; X.fillRect(0, 70, 520, 40); X.fillStyle = INK; X.fillRect(0, 108, 520, 4); X.fillStyle = '#d8cfc0'; X.fillRect(0, 112, 520, 128);
  X.fillStyle = '#ffe0a8'; X.fillRect(400, 46, 120, 64); X.fillStyle = INK; X.fillRect(400, 46, 4, 66);
  const u = t % 4, xs = n === 4 ? [60, 160, 262, 366] : [70, 220, 366], gy = 190, mine = Math.min(role, n - 1), cl = [COLS[0], COLS[1], COLS[2], COLS[3]];
  rr(6, 96, 36, 60, 5); ink('#7fb6e8', 3);
  rr(398 + 70, gy - 52, 40, 52, 6); ink('#2d7fe6', 3);
  const hxs = xs.map(x => x + 26);
  // bucket's journey: fill at the tap, hop to each seat, pour
  const legs = n - 1, hop = .55, t0 = 1.1; let bx, by, L = 0;
  if (u < t0) { bx = hxs[0]; by = gy - 4; L = u / t0 * .8; }
  else {
    const k = (u - t0) / 2.4 * legs, i = Math.min(legs - 1, Math.floor(k)), f = k - i;
    bx = lerp(hxs[i], hxs[i + 1], ease(clamp(f / .5, 0, 1))); by = gy - 4 - Math.sin(clamp(f / .5, 0, 1) * Math.PI) * 38; L = .8;
    if (u > 3.5) { bx = lerp(hxs[n - 1], 470 + 20, ease((u - 3.5) * 2)); by = gy - 4 - Math.sin(ease((u - 3.5) * 2) * Math.PI) * 20; L = .8 * (1 - clamp((u - 3.7) * 3, 0, 1)); }
  }
  for (let i = 0; i < n; i++) {
    const x = xs[i], isMe = i === mine, bob = isMe ? Math.sin(t * 8) * 1.5 : 0;
    shadow(x, gy + 3, 20, 5, .22);
    if (isMe) { X.globalAlpha = .6 + .2 * Math.sin(t * 8); X.beginPath(); X.arc(x, gy - 24, 34, 0, TAU); ink('#ffe14d', 0); X.globalAlpha = 1; }
    caos(x, gy - bob, 2.8, { col: cl[i] });
    if (i > 0) {
      const ru = ((t + i * .37) % 1.05) / 1.05, up = .58;
      X.beginPath(); X.arc(x, gy - 82, 14, 0, TAU); ink('#fff', 2.5); X.lineWidth = 5; X.lineCap = 'butt'; X.strokeStyle = '#ff6b6b'; X.beginPath(); X.arc(x, gy - 82, 10, 0, TAU); X.stroke();
      X.strokeStyle = '#3ddc5f'; X.beginPath(); X.arc(x, gy - 82, 10, -Math.PI / 2, -Math.PI / 2 + up * TAU); X.stroke();
      const a = -Math.PI / 2 + ru * TAU; X.lineWidth = 2.5; X.strokeStyle = INK; X.beginPath(); X.moveTo(x, gy - 82); X.lineTo(x + Math.cos(a) * 12, gy - 82 + Math.sin(a) * 12); X.stroke();
    }
  }
  X.save(); X.translate(0, 0); bucket(bx, by, L, .75, 0, t); X.restore();
  if (role === 0) { const dn = u < t0; demoFinger(hxs[0] + 60, gy + 20, dn, dn ? 0 : (u - t0) * 2); txt(dn ? 'HOLD' : 'LET GO!', 330, 24, 22, dn ? '#fff' : '#5CFF7A'); }
  else if (role === last) { const dn = u > 3.5 && u < 3.75; demoFinger(380, gy + 20, dn, 0); txt('POUR IT!', 330, 24, 22, '#5CFF7A'); }
  else { const dn = u > 1.3 + (role - 1) * .8 && u < 1.55 + (role - 1) * .8; demoFinger(xs[mine] + 40, gy + 20, dn, 0); txt('PASS ON GREEN', 330, 24, 20, '#5CFF7A'); }
}
reg('sq_balde', sqBalde, 'PASA EL BALDE'); REGMAP.sq_balde.duo = true; REGMAP.sq_balde.squad = true;
DUO.INFO.sq_balde = n => [
  ['WATER TAP', 'FILL THE BUCKET', 'HOLD, LET GO ON GREEN'],
  ['NEIGHBOUR', 'PASS IT ALONG', 'TAP ON GREEN'],
  ['NEIGHBOUR', 'PASS IT ALONG', 'TAP ON GREEN'],
  ['GRANNY', 'POUR, SLAP THE CAT', 'TAP / SPACE, ◄ ►'],
].filter((_, i) => n === 4 || i !== 2);
DUO.DEMOS.sq_balde = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
