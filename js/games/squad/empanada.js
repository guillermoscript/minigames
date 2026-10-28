'use strict';
/* ═════════ SQUAD · EMPANADA EN EL AIRE (sq_empanada) ═════════
   A bodega counter at lunch rush. Seven empanada orders come in on a seeded schedule; the team must land 5 of them on the tray(s).
   Seat 0 FRYER (JUDGE): an order shows up at the pot; HOLD to fry, LET GO while the gauge is in the golden zone (too early = raw, too late = burnt: wasted).
   Seat 1 TOSSER: the golden empanada lands in his hand spinning; only he sees the dial. Tap when the crimp is on top (green zone): the toss error
        moves the landing spot (tossed at the wrong angle it flies wide). He publishes the landing x of every toss ('throw').
   Seat 2 TRAY: slides the tray under the landing spot. Only the tray screens show the fan's gust and the chalk X marks (spot + wind, both seeded).
   Seat 3 (4 seats) is a second TRAY: seat 2 owns the left half, seat 3 the right half; the side where an empanada lands decides which tray judges it.
   Netcode: everybody builds the same 7 orders from the seed (spot, wind, spin phase, ticket time). Each role owns its own state and publishes it:
   'hold' (fryer on/off), 'fry' {i,q}, 'throw' {i,x}, 'tray' x (coalesced), 'got'/'miss' (the tray that owns the landing side), 'lost' (tosser dropped it).
   Every screen settles an order once (res[i]); the judge finishes 'win' at 5 caught, 'lose' at the 3rd wasted order or at the limit.
   Win = a heap of empanadas and cheers; lose = a tiny cocuyo-shaped crater (or the tio's head) and a sad counter. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/* ───────────── balance (all times in show seconds S = g.c * sqrt(sp)) ───────────── */
const N_ORD = 7, NEED = 5, MAXFAIL = 3;
const SPAN = 1.7, T0 = .7;                  // order i shows up at T0 + i*SPAN (+ a small jitter)
const GO0 = .75, GO1 = 1.2, HMAX = 1.75;    // fry hold: golden between GO0 and GO1, auto-release (burnt) at HMAX
const OM = 7.4, ZONE = .95, KEEP = 1.9;     // dial speed (rad/s), half-width of the green zone (rad), how long the tosser can keep it
const TF = 1.05, TRW = 58, TV = 720;        // flight time, tray half-width, tray speed (px / s)
const SL = 240, HY = 268, TY = 486, GY = 508, FLR = 400, CTOP = 335;
const TIO = 715;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const WALL = '#ffcf5a', BLUE = '#2f9bd6', WOOD = '#c9783a', WOOD2 = '#e8b06a', GOLD = '#e9a23b';

/* ───────────── tiny drawing kit (draws on the global ctx) ───────────── */
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function el(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); } if (fill) { ctx.fillStyle = fill; ctx.fill(); } }
function glint(x, y, rx, ry, rot = -.5, a = .5) { ctx.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); ctx.fill(); }
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(300, ctx.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); ctx.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  ctx.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); ctx.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 300); ctx.restore();
}
function pill(x, y, label, col, size = 16) {
  ctx.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = Math.min(300, ctx.measureText(t(label)).width + 24), h = size + 11;
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 3, w - 12, h * .24, h * .12); ctx.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 12);
}
function arrow(x, y, dir, s, col) {          // a fat arrow pointing left (-1) / right (1)
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.beginPath();
  ctx.moveTo(-14, -5); ctx.lineTo(2, -5); ctx.lineTo(2, -13); ctx.lineTo(16, 0); ctx.lineTo(2, 13); ctx.lineTo(2, 5); ctx.lineTo(-14, 5); ctx.closePath(); ink(col, 3); ctx.restore();
}
function emp(x, y, s, rot, q) {              // q: 0 raw, 1 golden, 2 burnt. Flat side down, crimp on the curved edge (up at rot = 0)
  const c = ['#f7e3b0', '#ecaa3f', '#4b3524'][q], d = ['#dcc088', '#c47a18', '#2a1d14'][q];
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(0, 7, 23, Math.PI, 0); ctx.closePath(); ink(d, 3.5);
  ctx.beginPath(); ctx.arc(0, 7, 23, Math.PI, 0); ctx.closePath(); ctx.save(); ctx.clip(); ctx.fillStyle = c; el(-3, 1, 25, 22); ctx.fill(); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 1; i < 8; i++) { const a = Math.PI + i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, 7 + Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 23, 7 + Math.sin(a) * 23); ctx.stroke(); }
  if (q === 1) glint(-8, -6, 7, 3, -.6, .6);
  ctx.restore();
}
function cocuyo(x, y, s, a) {                // the crater: a squashed ring with a firefly in the middle
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s, s);
  el(0, 0, 30, 9); ink('#5a3a22', 3); el(0, 1, 20, 5); ctx.fillStyle = '#2d1e14'; ctx.fill();
  ctx.fillStyle = 'rgba(190,255,90,.35)'; el(7, -4, 12, 8); ctx.fill();
  ctx.fillStyle = '#c8ff4a'; el(8, -4, 5, 4); ctx.fill(); ctx.fillStyle = '#4a4a2a'; el(-3, -4, 6, 4); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-12, -11); ctx.moveTo(-6, -7); ctx.lineTo(-7, -13); ctx.stroke();
  ctx.restore();
}
function cloud(x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); for (const [a, b, r] of [[0, 0, 18], [20, -8, 22], [42, 0, 16]]) { ctx.beginPath(); ctx.arc(a, b, r, 0, TAU); ink('#fff', 3); } for (const [a, b, r] of [[0, 0, 18], [20, -8, 22], [42, 0, 16]]) { ctx.beginPath(); ctx.arc(a, b, r - 1, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); } ctx.restore(); }

/* ───────────── the level and the game ───────────── */
function sqEmpanada(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0;
  const side0 = R() < .5 ? 0 : 1;
  const Q = Array.from({ length: N_ORD }, (_, i) => {       // six draws per order whatever the role
    const side = (side0 + i) & 1, spot = side ? 495 + R() * 85 : 225 + R() * 85, wr = R(), ws = R(), wm = R(), p = R() * TAU, jit = R();
    return { spot, side, wind: wr < .62 ? (ws < .5 ? -1 : 1) * (35 + wm * 30) : 0, p, c: T0 + i * SPAN + (jit - .5) * .2 };
  });
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i];
  const owner = xl => n === 3 ? 2 : xl < 400 ? 2 : 3;
  const lo = n === 3 ? 50 : me === 3 ? 380 : 50, hi = n === 3 ? 750 : me === 3 ? 750 : 420;
  /* state */
  let S = 0, trX = me === 3 ? 730 : 70, tgt = trX, kx = 0, ptr = false, lastTray = -9, lastTrayX = -1, resAt = -1, endFx = false;
  let holding = false, h0 = 0, hand = null, hold = { on: false, s0: 0, i: -1 }, sizzle = 0;
  const res = Array(N_ORD).fill(0), kind = Array(N_ORD).fill(''), fryQ = Array(N_ORD).fill(-1), fryAt = Array(N_ORD).fill(-9);
  const its = [], craters = [], pops = [], pile = { 2: [], 3: [] }, trT = { 2: track(), 3: track() };
  let tioHit = -9, cheer = -9, windNow = 0;
  const caught = () => res.filter(v => v === 1).length, failed = () => res.filter(v => v === 2).length;
  const pop = (s, x, y, col, size = 26) => { pops.push({ s, x, y, col, size, t0: S }); if (pops.length > 4) pops.shift(); };
  function settle(i, ok, why, x) {
    if (i < 0 || i >= N_ORD || res[i]) return; res[i] = ok ? 1 : 2; kind[i] = why;
    const o = owner(x || Q[i].spot);
    if (ok) { pile[o].push(i); cheer = S; sfx.coin(); burst(x, TY - 10, '#FFE14D', 10); pop(['¡UEPA!', 'NICE!', 'CATCH!'][i % 3], x, TY - 60, '#22a447'); }
    else if (why === 'raw') { sfx.buzz(); pop('RAW!', 110, 230, '#8fb7ff'); }
    else if (why === 'burnt') { sfx.miss(); pop('BURNT!', 110, 230, '#d9435a'); }
    else if (why === 'late') { sfx.miss(); pop('ORDER LOST!', 110, 230, '#d9435a'); }
    else if (why === 'drop') { sfx.miss(); pop('DROPPED!', SL, 200, '#d9435a'); }
    else if (why === 'head') { sfx.thud(); tioHit = S; shake(5, .2); pop('MY HEAD!', x, TY - 80, '#d9435a'); craters.push({ x, t0: S, head: true }); }
    else { sfx.splat(); sfx.thud(); shake(4, .15); burst(x, GY, '#c97f1c', 8); craters.push({ x, t0: S, head: false }); pop('SPLAT!', x, TY - 60, '#d9435a'); }
  }
  function addItem(i, x) { if (its.some(q => q.i === i)) return; its.push({ i, xl: x, t0: S, done: false }); sfx.whoosh(true); }
  function giveHand(i) { if (hand) { D.send('lost', { i: hand.i }); settle(hand.i, false, 'drop'); } hand = { i, a: S + .3 }; }
  const angle = () => hand ? wrap(Q[hand.i].p + OM * (S - hand.a)) : 0;

  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: ['FRY!', 'TOSS!', 'CATCH!', 'CATCH!'][me],
    roleLabel: me < 2 ? ['FRYER', 'TOSSER'][me] : n === 4 ? (me === 2 ? 'LEFT TRAY' : 'RIGHT TRAY') : 'TRAY',
    hint: me === 0 ? 'HOLD CLICK / SPACE TO FRY - LET GO WHEN THE GAUGE IS GOLDEN: RAW OR BURNT IS WASTED'
      : me === 1 ? 'CLICK / SPACE WHEN THE CRIMP IS ON TOP (GREEN ZONE) TO TOSS IT TO THE TRAY'
      : 'MOVE THE MOUSE (OR ◄ ►) TO PUT THE TRAY UNDER THE EMPANADA - THE FAN SHOWS THE WIND',
    thint: me === 0 ? 'HOLD TO FRY - LET GO WHEN THE GAUGE IS GOLDEN: RAW OR BURNT IS WASTED'
      : me === 1 ? 'TAP WHEN THE CRIMP IS ON TOP (GREEN ZONE) TO TOSS IT TO THE TRAY'
      : 'DRAG TO PUT THE TRAY UNDER THE EMPANADA - THE FAN SHOWS THE WIND',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; const dS = dt * TS;
      if (g.result && resAt < 0) resAt = S;
      S += dS;
      // fryer: orders, the hold gauge, auto-release
      if (me === 0 && !g.result) {
        if (holding) {
          if (S - h0 >= HMAX || S >= Q[hold.i].c + SPAN) g.release();
          else if (Math.floor(S * 9) !== sizzle) { sizzle = Math.floor(S * 9); noise(.07, .025, 2500, 6500, 'highpass'); }
        }
        for (let i = 0; i < N_ORD; i++) if (!res[i] && fryQ[i] < 0 && S >= Q[i].c + SPAN && !(holding && hold.i === i)) { fryQ[i] = 3; fryAt[i] = S; D.send('fry', { i, q: 3 }); settle(i, false, 'late'); }
      }
      // tosser: drop it if kept too long
      if (me === 1 && hand && S - hand.a > KEEP) { D.send('lost', { i: hand.i }); settle(hand.i, false, 'drop'); hand = null; }
      // tray: pointer / keys move the target, the tray follows at a capped speed
      if (me >= 2 && !g.result) {
        if (kx) tgt = clamp(tgt + kx * 700 * dS, lo, hi);
        trX += clamp(clamp(tgt, lo, hi) - trX, -TV * dS, TV * dS);
        const r = Math.round(trX); if (r !== lastTrayX && g.c - lastTray >= .07) { lastTrayX = r; lastTray = g.c; D.send('tray', r, true); }
      }
      // flights land: the tray that owns the landing side decides
      for (let k = its.length - 1; k >= 0; k--) {
        const it = its[k], f = (S - it.t0) / TF;
        if (!it.done && f >= 1) {
          it.done = true;
          if (me >= 2 && me === owner(it.xl) && !res[it.i]) {
            if (Math.abs(trX - it.xl) < TRW) { D.send('got', { i: it.i, x: Math.round(it.xl) }); settle(it.i, true, '', it.xl); }
            else { const hd = Math.abs(it.xl - TIO) < 46; D.send('miss', { i: it.i, x: Math.round(it.xl), h: hd ? 1 : 0 }); settle(it.i, false, hd ? 'head' : 'floor', it.xl); }
          }
        }
        if (f > 1.7) its.splice(k, 1);
      }
      for (let k = pops.length - 1; k >= 0; k--) if (S - pops[k].t0 > 1.1) pops.splice(k, 1);
      // wind the tray screens show: the next order that has not landed
      let w = 0; for (let i = 0; i < N_ORD; i++) if (!res[i] && !its.some(q => q.i === i && q.done)) { if (S > Q[i].c - .2) w = Q[i].wind; break; }
      windNow += (w - windNow) * Math.min(1, dt * 6);
      // the judge
      if (judge && !g.result) {
        if (caught() >= NEED) g.finish('win'); else if (failed() >= MAXFAIL) g.finish('lose'); else if (g.c >= g.limit) g.finish('lose');
      }
      if (g.result && !endFx) { endFx = true; cheer = S; }
    },
    msg(type, d, from) {
      if (type === 'tray') { if (trT[from]) trT[from].push(d); }
      else if (type === 'hold') { hold = { on: !!d.on, s0: S, i: d.i }; }
      else if (type === 'fry') {
        if (d.i < 0 || d.i >= N_ORD) return; fryQ[d.i] = d.q; fryAt[d.i] = S; hold = { on: false, s0: S, i: d.i };
        if (d.q === 1) { sfx.sparkle && sfx.sparkle(); if (me === 1) giveHand(d.i); }
        else settle(d.i, false, d.q === 0 ? 'raw' : d.q === 2 ? 'burnt' : 'late');
      }
      else if (type === 'throw') addItem(d.i, d.x);
      else if (type === 'got') settle(d.i, true, '', d.x);
      else if (type === 'miss') settle(d.i, false, d.h ? 'head' : 'floor', d.x);
      else if (type === 'lost') { settle(d.i, false, 'drop'); }
    },
    /* public helpers (bots and input go through these) */
    holdOn() {
      if (me !== 0 || g.result || holding) return;
      const cur = Q.reduce((a, q, i) => S >= q.c ? i : a, -1);
      if (cur < 0 || fryQ[cur] >= 0 || res[cur] || S >= Q[cur].c + SPAN) return;
      holding = true; h0 = S; hold = { on: true, s0: S, i: cur }; D.send('hold', { on: 1, i: cur }); sfx.blip(2);
    },
    release() {
      if (me !== 0 || !holding) return; holding = false; const h = S - h0, i = hold.i, q = h < GO0 ? 0 : h <= GO1 ? 1 : 2;
      fryQ[i] = q; fryAt[i] = S; hold = { on: false, s0: S, i }; D.send('fry', { i, q });
      if (q === 1) { sfx.sparkle(); sfx.coin(); burst(110, 280, '#FFE14D', 8); pop('GOLDEN!', 110, 230, '#22a447'); } else settle(i, false, q === 0 ? 'raw' : 'burnt');
    },
    toss() {
      if (me !== 1 || g.result || !hand || S < hand.a) return;
      const i = hand.i, a = angle(), off = clamp(a, -Math.PI, Math.PI) / Math.PI * 230, xl = Math.round(clamp(Q[i].spot + Q[i].wind + off, 60, 740));
      hand = null; D.send('throw', { i, x: xl }); addItem(i, xl);
    },
    setTray(x) { tgt = clamp(x, lo, hi); },
    down(p) { ptr = true; if (me >= 2) tgt = clamp(p.x, lo, hi); else if (me === 0) g.holdOn(); else g.toss(); },
    move(p) { if (me >= 2 && p && p.x > -OX && p.x < W + OX) tgt = clamp(p.x, lo, hi); },
    up() { ptr = false; if (me === 0) g.release(); },
    key(e) {
      if (me >= 2) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; return; }
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') { if (me === 0) g.holdOn(); else g.toss(); }
    },
    keyup(e) {
      if (me >= 2) { if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && kx < 0) kx = 0; else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && kx > 0) kx = 0; return; }
      if (me === 0 && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW')) g.release();
    },
    draw(T) {
      const won = g.result === 'win', lost = g.result === 'lose', mood = won ? 'happy' : lost ? 'sad' : null, rk = resAt >= 0 ? S - resAt : -1;
      /* wall, window with the moving gag, shelves, fan */
      ctx.fillStyle = WALL; ctx.fillRect(-OX, 0, VW, CTOP);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let x = -OX - 40 + ((T * 6) % 80); x < W + OX; x += 80) ctx.fillRect(x, 0, 14, CTOP);
      ctx.fillStyle = BLUE; ctx.fillRect(-OX, 285, VW, 50); ctx.fillStyle = INK; ctx.fillRect(-OX, 282, VW, 5);
      const wx = 545, wy = 98, ww = 215, wh = 150;
      ctx.fillStyle = INK; ctx.fillRect(wx - 7, wy - 7, ww + 14, wh + 14); ctx.fillStyle = '#8fd8ff'; ctx.fillRect(wx, wy, ww, wh);
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      cloud(wx + ((T * 8) % (ww + 120)) - 60, wy + 30, .8);
      ctx.fillStyle = '#6a7390'; ctx.fillRect(wx, wy + 108, ww, 42); ctx.fillStyle = '#fff'; for (let x = wx - 30 + ((T * 50) % 60); x < wx + ww; x += 60) ctx.fillRect(x, wy + 128, 28, 4);
      ctx.fillStyle = '#e35f4b'; for (let k = 0; k < 3; k++) { const bx = wx + 20 + k * 70; ctx.fillRect(bx, wy + 50, 46, 58); ctx.fillStyle = '#ffd36b'; ctx.fillRect(bx + 8, wy + 60, 12, 14); ctx.fillRect(bx + 26, wy + 60, 12, 14); ctx.fillStyle = '#e35f4b'; }
      const mx = wx + ww + 60 - ((T * 85) % (ww + 160));          // a mototaxi with three passengers crosses (and a dog behind it)
      ctx.fillStyle = INK; ctx.fillRect(mx - 24, wy + 96, 54, 6); ctx.beginPath(); ctx.arc(mx - 18, wy + 112, 11, 0, TAU); ctx.arc(mx + 24, wy + 112, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#22a447'; ctx.fillRect(mx - 18, wy + 70, 40, 28); ctx.fillStyle = '#ffe14d'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(mx - 10 + k * 14, wy + 66 + Math.sin(T * 9 + k) * 1.5, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
      const dx = mx + 70; ctx.fillStyle = '#a0662d'; ctx.fillRect(dx, wy + 118, 22, 10); ctx.fillRect(dx + 16, wy + 110, 10, 10); ctx.fillStyle = INK; ctx.fillRect(dx + 2, wy + 128, 4, 6 + Math.sin(T * 14) * 2); ctx.fillRect(dx + 16, wy + 128, 4, 6 - Math.sin(T * 14) * 2);
      ctx.restore();
      ctx.fillStyle = INK; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh);
      for (let r = 0; r < 2; r++) {                                 // shelf with cans and a jar of ají
        const sy = 175 + r * 52; ctx.fillStyle = INK; ctx.fillRect(250, sy + 28, 190, 9); ctx.fillStyle = '#a5622c'; ctx.fillRect(250, sy + 28, 190, 5);
        for (let k = 0; k < 6; k++) { const c = ['#e35f4b', '#2f9bd6', '#7CE08A', '#FFE14D', '#FF8FB1', '#fff'][(k + r * 2) % 6]; ctx.fillStyle = INK; ctx.fillRect(257 + k * 30, sy + 2, 24, 28); ctx.fillStyle = c; ctx.fillRect(259 + k * 30, sy + 4, 20, 24); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(261 + k * 30, sy + 6, 5, 18); }
      }
      // the fan: spins with the next gust (only the tray screens also get the streaks and the arrow below)
      const fx = 478, fy = 162, spin = T * (3 + Math.abs(windNow) * .25) * (windNow < 0 ? -1 : 1);
      ctx.fillStyle = INK; ctx.fillRect(fx - 5, fy + 24, 10, 40); el(fx, fy, 36, 36); ink('#d9e4f2', 4);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(spin); for (let k = 0; k < 4; k++) { ctx.rotate(TAU / 4); el(0, -17, 8, 17); ink('#8f9cb3', 3); } ctx.restore(); ctx.beginPath(); ctx.arc(fx, fy, 6, 0, TAU); ink('#ffe14d', 3);
      /* counter + floor */
      for (let r = 0; r < 4; r++) for (let c = Math.floor(-OX / 50) - 1; c < (W + OX) / 50 + 1; c++) { ctx.fillStyle = (r + c) & 1 ? '#e9dfc8' : '#cdbf9f'; ctx.fillRect(c * 50, FLR + r * 50, 50, 50); }
      ctx.fillStyle = INK; ctx.fillRect(-OX, FLR - 4, VW, 5);
      ctx.fillStyle = INK; ctx.fillRect(-OX, CTOP - 4, VW, 70); ctx.fillStyle = WOOD; ctx.fillRect(-OX, CTOP + 14, VW, FLR - CTOP - 14); ctx.fillStyle = WOOD2; ctx.fillRect(-OX, CTOP, VW, 14);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; for (let x = -OX; x < W + OX; x += 66) ctx.fillRect(x, CTOP + 14, 4, FLR - CTOP - 14);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-OX, CTOP + 2, VW, 3);
      rr(330, 349, 180, 36, 8); ink('#fff3c4', 3); txt('BODEGA', 420, 368, 24, '#d9435a', 'center', 160);
      /* cook, fryer, tosser */
      caos(36, CTOP + 10, 3.4, { col: cols(0), mood: mood || (cheer > 0 && S - cheer < .6 ? 'happy' : null), run: undefined });
      rr(62, 296, 98, 42, 12); ink('#8d8aa3', 4); glint(80, 308, 12, 4, 0, .5);
      el(111, 296, 46, 13); ink('#f2a516', 4); ctx.fillStyle = '#ffd36b'; el(100, 294, 24, 6); ctx.fill();
      for (let k = 0; k < 4; k++) { const a = (T * 2 + k * .27) % 1; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(88 + k * 14, 296 - a * 5, 2.5, 0, TAU); ctx.fill(); }
      // the empanada in the oil, cooking to the colour it will have (everybody sees it)
      const curO = Q.reduce((a, q, i) => S >= q.c && !res[i] ? i : a, -1);
      const fh = hold.on ? S - hold.s0 : 0;
      if (hold.on) { const cq = fh < GO0 ? 0 : fh <= GO1 ? 1 : 2; emp(111, 290 + Math.sin(T * 7) * 1.5, .9, Math.sin(T * 5) * .12, cq);
        for (let k = 0; k < 3; k++) { const a = (T * 1.4 + k / 3) % 1; ctx.globalAlpha = 1 - a; el(100 + k * 12 + Math.sin(a * 6 + k) * 5, 250 - a * 46, 9 + a * 8, 7 + a * 6); ink('#fff', 2.5); ctx.globalAlpha = 1; } }
      else if (curO >= 0 && fryQ[curO] < 0) { emp(180, 326, .8, -.2, 0); if (S - Q[curO].c < .9) badge('ORDER!', 150, 218, 20, '#e35f4b', '#fff', outBack((S - Q[curO].c) / .25), -.05); }
      // tosser
      caos(212, CTOP + 10, 3.6, { col: cols(1), mood: mood || null });
      /* tio on his plastic chair: gets hit by wild tosses */
      { const hit = tioHit > 0 ? clamp(1 - (S - tioHit) / 1.2, 0, 1) : 0, bob = Math.sin(T * 2) * 1.5;
        rr(TIO - 30, 520, 60, 8, 3); ink('#d9435a', 3); ctx.fillStyle = INK; ctx.fillRect(TIO - 26, 528, 6, 26); ctx.fillRect(TIO + 20, 528, 6, 26);
        caos(TIO, 534 + bob, 3.2, { col: '#b9c3d4', mood: hit > 0 ? 'sad' : mood });
        ctx.fillStyle = INK; ctx.fillRect(TIO - 15, 478 + bob, 30, 5); rr(TIO - 12, 466 + bob, 24, 14, 6); ink('#e35f4b', 3);   // a cap
        ctx.fillStyle = '#eee'; ctx.fillRect(TIO - 9, 502 + bob, 18, 4);                                                       // moustache
        if (hit > 0) { el(TIO + 2, 470 + bob, 18, 8); ink('#ecaa3f', 3); badge('EPA!', TIO, 430, 20, '#ff9a3a', '#fff', outBack((S - tioHit) / .2), .08); }
      }
      /* craters on the floor */
      for (const c of craters) if (!c.head) cocuyo(c.x, GY + 4, Math.min(1, (S - c.t0) * 8 + .2), 1);
      /* landing shadows + chalk X marks (the marks only on the tray screens) */
      for (const it of its) { const f = clamp((S - it.t0) / TF, 0, 1); ctx.fillStyle = `rgba(30,20,10,${.12 + .28 * f})`; el(it.xl, GY + 6, 14 + 26 * f, 4 + 6 * f); ctx.fill(); }
      if (me >= 2 && !g.result) {
        let shown = 0;
        for (let i = 0; i < N_ORD && shown < 2; i++) {
          if (res[i] || its.some(q => q.i === i)) continue; if (S < Q[i].c - 1.2) break;
          const mx2 = clamp(Q[i].spot + Q[i].wind, 60, 740); if (n === 4 && owner(mx2) !== me) { continue; }
          shown++; ctx.globalAlpha = shown === 1 ? .9 : .45; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx2 - 14, GY - 6); ctx.lineTo(mx2 + 14, GY + 12); ctx.moveTo(mx2 + 14, GY - 6); ctx.lineTo(mx2 - 14, GY + 12); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
      /* trays + the Caos holding each one */
      for (let r = 2; r < n; r++) {
        const mine = r === me, x = mine ? trX : (trT[r].at() === null ? (r === 3 ? 730 : 70) : trT[r].at());
        caos(x, 556, 3.2, { col: cols(r), mood: mood || (cheer > 0 && S - cheer < .5 && pile[r].length ? 'happy' : null), run: Math.abs(x - (mine ? tgt : x)) > 6 ? T : undefined });
        el(x, TY + 12, 66, 11); ink('#9fb0c9', 4); el(x, TY + 8, 58, 8); ink('#e4edf8', 3);
        for (let k = 0; k < pile[r].length; k++) emp(x - 22 + (k % 3) * 22, TY + 6 - Math.floor(k / 3) * 12 - (k % 2) * 3, .62, (k - 2) * .18, 1);
        if (mine) pill(x, 586, 'YOU', '#ffe14d', 13);
      }
      /* flights */
      for (const it of its) {
        const f = (S - it.t0) / TF; if (f < 0 || f > 1) continue;
        const hd = Math.abs(it.xl - TIO) < 46, yEnd = hd ? 462 : TY - 6, x = SL + (it.xl - SL) * f, y = HY + (yEnd - HY) * f - 205 * 4 * f * (1 - f);
        emp(x, y, 1, f * TAU * 2.5, 1);
      }
      /* heap + banner */
      if (won && rk >= 0) { for (let k = 0; k < 9; k++) { const kk = clamp((rk - k * .05) / .3, 0, 1); if (kk > 0) emp(400 + ((k % 5) - 2) * 26 + (k > 4 ? 13 : 0), 440 - (k > 4 ? 18 : 0) - (1 - ease(kk)) * 120, 1.1, (k - 4) * .12, 1); } }
      if (won && rk >= 0 && rk < 1.3 && Math.floor(rk * 12) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(-OX, 0, VW, H); }
      /* HUD: five plates for the catches + the strikes (inside the world: painted on the wall) */
      for (let i = 0; i < NEED; i++) {
        const x = 400 + (i - 2) * 42, got = caught() > i; ctx.beginPath(); ctx.arc(x, 86, 17, 0, TAU); ink(got ? '#fff' : '#d9d4ee', 3); if (got) emp(x, 82, .5, 0, 1);
      }
      for (let i = 0; i < MAXFAIL; i++) { const x = 400 + (i - 1) * 40, bad = failed() > i; ctx.globalAlpha = bad ? 1 : .35; cocuyo(x, 122, .5, 1); ctx.globalAlpha = 1; }
      /* role cues */
      if (me === 0 && !g.result) {                                  // the gauge, above the pot (only the fryer sees it)
        const gx = 28, gy = 214, gw = 170, k = holding ? clamp((S - h0) / HMAX, 0, 1) : 0;
        rr(gx, gy, gw, 24, 12); ink('#3a3550', 3);
        ctx.save(); rr(gx, gy, gw, 24, 12); ctx.clip(); ctx.fillStyle = '#f7e3b0'; ctx.fillRect(gx, gy, gw * GO0 / HMAX, 24); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(gx + gw * GO0 / HMAX, gy, gw * (GO1 - GO0) / HMAX, 24);
        ctx.fillStyle = '#d9435a'; ctx.fillRect(gx + gw * GO1 / HMAX, gy, gw, 24); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(gx, gy + 3, gw, 5); ctx.restore();
        rr(gx, gy, gw, 24, 12); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
        if (holding) { const mx2 = gx + gw * k; ctx.beginPath(); ctx.moveTo(mx2, gy - 3); ctx.lineTo(mx2 - 9, gy - 16); ctx.lineTo(mx2 + 9, gy - 16); ctx.closePath(); ink('#fff', 3); }
        pill(113, 262, holding ? 'LET GO WHEN GOLDEN!' : 'HOLD TO FRY', '#fff', 14);
      }
      if (me === 1 && !g.result) {                                  // the spin dial (only the tosser sees it)
        const dx2 = 340, dy2 = 218, a = angle();
        ctx.beginPath(); ctx.arc(dx2, dy2, 50, 0, TAU); ink('#fff', 4);
        ctx.beginPath(); ctx.arc(dx2, dy2, 42, -Math.PI / 2 - ZONE, -Math.PI / 2 + ZONE); ctx.lineWidth = 12; ctx.strokeStyle = '#5CFF7A'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dx2, dy2 - 56); ctx.lineTo(dx2 - 8, dy2 - 72); ctx.lineTo(dx2 + 8, dy2 - 72); ctx.closePath(); ink('#ff4d5e', 3);
        if (hand && S >= hand.a) { const ok = Math.abs(a) < ZONE; emp(dx2, dy2 - 6, 1.15, a, 1); if (ok) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = .6 + .4 * Math.sin(T * 20); ctx.beginPath(); ctx.arc(dx2, dy2, 56, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } }
        else pill(dx2, dy2 + 2, 'WAIT...', '#fff', 14);
        pill(dx2, dy2 + 76, 'TOSS ON GREEN!', '#fff', 13);
      }
      if (me >= 2 && !g.result) {                                   // wind: streaks across the counter and an arrow on the fan (only the tray screens)
        const wv = windNow;
        if (Math.abs(wv) > 8) { ctx.globalAlpha = clamp(Math.abs(wv) / 60, .2, .7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (let k = 0; k < 6; k++) { const yy = 120 + k * 58, xx = ((T * 420 * Math.sign(wv) + k * 190) % 900 + 900) % 900 - 50; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 46 * Math.sign(wv), yy); ctx.stroke(); } ctx.globalAlpha = 1; }
        pill(478, 222, 'WIND', '#fff', 14);
        if (Math.abs(wv) > 8) { const st2 = Math.abs(wv) > 55 ? 2 : 1; for (let k = 0; k < st2; k++) arrow(478 + Math.sign(wv) * (k * 14 - (st2 - 1) * 7) + (st2 === 1 ? 0 : 0), 252, Math.sign(wv), .7, '#4DB8FF'); }
        else pill(478, 252, 'NO WIND', '#fff', 12);
      }
      /* feedback pops + outro */
      for (const p of pops) { const a = S - p.t0; ctx.globalAlpha = clamp(1 - (a - .8) / .3, 0, 1); badge(p.s, p.x, p.y - a * 10, p.size, p.col, '#fff', a < .2 ? outBack(a / .2) : 1, .06); ctx.globalAlpha = 1; }
      if (rk >= 0) { const sc = outBack(rk / .3); if (won) badge('EMPANADAS FOR ALL!', 400, 290, 58, '#22a447', '#fff', sc, -.05); else badge('SPLAT!', 400, 290, 58, '#d9435a', '#fff', sc, .05); }
    },
  };
  g.dbg = { view: () => ({ S, n, me, holding, h: holding ? S - h0 : 0, cur: Q.reduce((a, q, i) => S >= q.c && fryQ[i] < 0 && !res[i] && S < q.c + SPAN ? i : a, -1), hand: hand ? { i: hand.i, ready: S >= hand.a, ang: angle() } : null, trX, items: its.filter(q => !q.done).map(q => ({ i: q.i, xl: q.xl, own: owner(q.xl) })), res: res.slice(), next: Q.map(q => ({ x: clamp(q.spot + q.wind, 60, 740), c: q.c })), owner, lo, hi, GO0, GO1, ZONE }) };
  wire(g, D, 0, sp, 'sq_empanada');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  ctx.fillStyle = WALL; ctx.fillRect(0, 0, 520, 150); ctx.fillStyle = BLUE; ctx.fillRect(0, 108, 520, 42); ctx.fillStyle = INK; ctx.fillRect(0, 106, 520, 4);
  ctx.fillStyle = WOOD2; ctx.fillRect(0, 150, 520, 12); ctx.fillStyle = INK; ctx.fillRect(0, 148, 520, 4); ctx.fillStyle = WOOD; ctx.fillRect(0, 162, 520, 22);
  ctx.fillStyle = '#e9dfc8'; ctx.fillRect(0, 184, 520, 56); ctx.fillStyle = '#cdbf9f'; for (let k = 0; k < 11; k++) if (k % 2) ctx.fillRect(k * 50, 184, 50, 28);
  const u = t % 4;
  if (role === 0) {
    const k = clamp((u - .3) / 1.6, 0, 1), hold = u > .3 && u < 1.9, gx = 150, gy = 200, gw = 220;
    rr(100, 120, 120, 36, 12); ink('#8d8aa3', 3); el(160, 122, 54, 12); ink('#f2a516', 3);
    emp(160, 118, 1, 0, hold ? (k * 1.8 < GO0 ? 0 : k * 1.8 <= GO1 ? 1 : 2) : u >= 1.9 ? 1 : 0);
    rr(gx, gy, gw, 22, 11); ink('#3a3550', 3); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(gx + gw * GO0 / HMAX, gy + 3, gw * (GO1 - GO0) / HMAX, 16);
    if (hold || u >= 1.9) { const mx = gx + gw * (hold ? k : 1.15 / HMAX); ctx.beginPath(); ctx.moveTo(mx, gy - 3); ctx.lineTo(mx - 8, gy - 15); ctx.lineTo(mx + 8, gy - 15); ctx.closePath(); ink('#fff', 3); }
    demoFinger(430, 200, hold, 0); txt(hold ? 'HOLD...' : u >= 1.9 ? 'GOLDEN!' : 'HOLD TO FRY', 410, 120, 24, '#fff');
  } else if (role === 1) {
    const a = wrap(1.6 + t * 2.6), ok = Math.abs(a) < ZONE, tossK = clamp((u - 2.3) / 1, 0, 1);
    ctx.beginPath(); ctx.arc(150, 112, 50, 0, TAU); ink('#fff', 4); ctx.beginPath(); ctx.arc(150, 112, 41, -Math.PI / 2 - ZONE, -Math.PI / 2 + ZONE); ctx.lineWidth = 11; ctx.strokeStyle = '#5CFF7A'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(150, 52); ctx.lineTo(142, 36); ctx.lineTo(158, 36); ctx.closePath(); ink('#ff4d5e', 3);
    emp(150, 106, 1.1, a, 1);
    if (tossK > 0) { const x = 150 + 250 * tossK, y = 70 + 110 * tossK - 160 * tossK * (1 - tossK); emp(x, y, .9, tossK * 9, 1); }
    ctx.globalAlpha = ok ? 1 : .35; txt('TAP!', 330, 70, 36, '#fff'); ctx.globalAlpha = 1; demoFinger(430, 200, ok && u < 2.8, 0);
  } else {
    const f = clamp((u - .3) / 1.6, 0, 1), xl = role === 3 ? 380 : 330, tx = 90 + (xl - 90) * ease(clamp(u / 1.3, 0, 1)), y = 40 + 120 * f;
    ctx.fillStyle = 'rgba(30,20,10,.3)'; el(xl, 188, 14 + 20 * f, 5); ctx.fill();
    if (u > .3 && u < 2.1) emp(xl, y, 1, f * 8, 1);
    caos(tx, 236, 2.4, { col: COLS[role], mood: u > 1.9 ? 'happy' : null }); el(tx, 188, 52, 9); ink('#9fb0c9', 3);
    if (u > 1.9) emp(tx, 184, .6, 0, 1);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xl - 10, 196); ctx.lineTo(xl + 10, 210); ctx.moveTo(xl + 10, 196); ctx.lineTo(xl - 10, 210); ctx.stroke();
    arrow(430, 60, 1, .8, '#4DB8FF'); txt('WIND', 430, 92, 20, '#fff'); demoFinger(tx, 224, true, 0);
  }
}

reg('sq_empanada', sqEmpanada, 'EMPANADA VOLADORA'); REGMAP.sq_empanada.duo = true; REGMAP.sq_empanada.squad = true;
DUO.INFO.sq_empanada = n => [
  ['FRYER', 'FRY IT GOLDEN', 'HOLD, LET GO WHEN GOLDEN'],
  ['TOSSER', 'TOSS ON THE GREEN ZONE', 'TAP / CLICK / SPACE'],
  [n === 4 ? 'LEFT TRAY' : 'TRAY', 'CATCH THEM', 'MOVE / DRAG OR ◄ ►'],
  ['RIGHT TRAY', 'CATCH THEM', 'MOVE / DRAG OR ◄ ►'],
].slice(0, n);
DUO.DEMOS.sq_empanada = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
