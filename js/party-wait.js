'use strict';
/* WAITING in the modes where everybody plays at once (VERSUS and TEAM). A player who finishes or fails early waits a few seconds for the others: instead of only watching
   they play the shared trap minigames (createIdleTraps, js/party-sab.js: gold bubble, stop-in-the-green dial, arrow sequence), and every win charges an orb that is spent on:
     VERSUS  SABOTAGE  a soft hit (the `ghost` kinds of SAB_KINDS at SAB_SOFT strength) on a player who has NOT finished yet. Competitive and fair: nobody is hit after their
                       result is in, and the thrower is already done, so it can only reshuffle the players behind them.
     TEAM    CHEER     a harmless sparkle border + toast on the teammates still playing (createCheerChannel below). Co-op: there is never a sabotage between teammates,
                       and a cheer changes no score, life or timer; it is only feedback.
   Waiting never lengthens a round and never blocks the next one: the server closes the round as before, and this screen simply stops being drawn.
   Server rules (pocketbase/pb_hooks/party.js): only a player whose result is in may send, only 'sab' (VERSUS) or 'cheer' (TEAM), after the instruction card, rate limited.
   CHEER_IDS and WAIT_CHEER_MODES must match CHEER_KINDS and CHEER_MODES in the hook (test/party-wait.test.js checks it). The pieces:
     partyWaitOn(R)           is the waiting screen showing (my result is in, the round is still live)
     partyWaitUpdate(R, dt)   every frame: charges and traps tick
     partyWaitDraw(R, pick)   the whole waiting screen, in place of the plain spectator one (pick = partyWatchPick(R))
     partyWaitKey(e)          keyboard: trap keys, E = throw / cheer
     partyWaitReceiver(R)     the players still playing: a receive-only channel (soft hit or cheer overlay) that partySpectatorGame draws
   ART (docs/ART-STYLE.md, kit js/party-ui.js = PARTY_UI): the waiting screen is a backstage lounge. Marquee title with chasing bulbs, a TV with the watched game, player cards with
   an avatar disc, per-card SABOTAGE! plates (VERSUS), a lounge scene where the idle trap panel is (sofa, hanging sign, plant, bulb rail), a charge console with glossy orbs (no digits)
   and one big plate. The four cheers are inked border scenes (gold frame + sparkles, rainbow + clouds, rising hearts, bunting + party poppers). Art only: every clickable keeps its meaning. */
const WAIT_CHEER_MODES = ['team'];
const WAIT_CFG = { versus: { max: 2, every: 4, trap: 1, comboEvery: 1e9, cooldown: 2.4 }, team: { max: 3, every: 4, trap: 1, comboEvery: 1e9, cooldown: 1.6 } };   // rounds last 5-8 s, so charges come fast; the client cooldown is a little longer than the server gap
const WAIT_TRAPS = { fly: 0, jam: 0, bubble: .34, dial: .33, seq: .33 };       // no pump to jam and nothing to swat: only the three that pay a charge
const WAIT_WORDS = { bubble: 'NICE!', dial: 'PERFECT!', seq: 'COMBO!', over: 'TOO LATE!' };

/* ───────────── art helpers (local; PARTY_UI is read lazily so a sandbox without the kit still loads this file) ───────────── */
const wUI = () => (typeof PARTY_UI !== 'undefined' ? PARTY_UI : null);
const wHov = (x, y, w, h) => typeof hovered === 'function' && !!hovered(x, y, w, h);
const wDown = () => typeof pressing !== 'undefined' && !!pressing;
const wLum = c => { const n = parseInt(c.slice(1), 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; };
/* SVG path of a rounded rectangle, so it can be a memoized Path2D (PARTY_UI.P) for cel shading */
const wRrd = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const W_SPARK = 'M0 -1Q.16 -.16 1 0Q.16 .16 0 1Q-.16 .16 -1 0Q-.16 -.16 0 -1Z';                       // 4-point twinkle, unit size
const W_HEART = 'M0 .86C-1.5 -.1 -1 -1.3 0 -.55C1 -1.3 1.5 -.1 0 .86Z';                              // heart, unit size
const W_CLOUD = [[-24, 8, 10], [-11, -1, 14], [6, -5, 16], [22, 3, 13], [-2, 9, 13], [14, 10, 11]].map(([x, y, r]) => `M${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}Z`).join('');
const WTW = Object.create(null);
/* text width in px: dark = the Fredoka face (+ its letter spacing) the kit uses for INK text, else Arial Black */
function wTw(s, size, dark) {
  const key = size + (dark ? 'd' : 'l') + s; if (WTW[key] !== undefined) return WTW[key];
  ctx.save(); ctx.font = dark ? `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif` : `900 ${size}px "Arial Black", Impact, sans-serif`;
  const w = (+ctx.measureText(s).width || 0) + (dark ? s.length * Math.max(.5, size / 24) : 0); ctx.restore();
  if (Object.keys(WTW).length > 300) for (const q in WTW) delete WTW[q];
  return (WTW[key] = w);
}
/* split a label in two balanced lines at a space (one line when it fits) */
function wWrap(s, size, maxW) {
  if (wTw(s, size) <= maxW) return [s];
  const w = s.split(' '); let best = [s], bw = 1e9;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(wTw(a, size), wTw(b, size)); if (m < bw) { bw = m; best = [a, b]; } }
  return best;
}
/* a baked layer: painted once through PARTY_UI.target onto an offscreen canvas, then blitted every frame (docs/ART-STYLE.md section 9) */
const W_BAKE = {};
function wBake(U, key, w, h, fn) {
  if (W_BAKE[key]) return W_BAKE[key];
  let c2 = null; try { c2 = document.createElement('canvas'); c2.width = w; c2.height = h; } catch (_) { return null; }
  const g = c2.getContext && c2.getContext('2d'); if (!g) return null;
  const prev = U.target(g); try { fn(g); } finally { U.target(prev); }
  return (W_BAKE[key] = c2);
}
/* a slab with depth, a soft drop shadow and a gloss strip (cards, console, panels) */
function wSlab(U, x, y, w, h, r, face, dk, o = 4, dep = 5) {
  const c = ctx; c.save();
  c.fillStyle = 'rgba(20,16,28,.26)'; U.rr(x + 2, y + dep + 7, w, h, r); c.fill();
  U.rr(x, y + dep, w, h, r); U.ink(dk, o);
  U.rr(x, y, w, h, r); U.ink(face, o);
  c.fillStyle = 'rgba(255,255,255,.22)'; U.rr(x + 8, y + 5, w - 16, Math.min(9, h * .14), 4); c.fill();
  c.restore();
}
/* a name tab / status pill without a pointer: fully round, ink 3, gloss. Returns its width. */
function wTag(U, x, y, label, col, size = 15, maxW = 0, fg) {
  const s = U.tr(label), w = Math.min(maxW || size * 11, wTw(s, size, true) + size * 1.6), h = size * 1.7, dk = wLum(col) < .3, c = ctx;
  c.save(); c.fillStyle = 'rgba(20,16,28,.25)'; U.rr(x + 2, y + 4, w, h, h / 2); c.fill();
  U.rr(x, y, w, h, h / 2); U.ink(col, 3);
  c.fillStyle = 'rgba(255,255,255,.35)'; U.rr(x + size * .4, y + 3, w - size * .8, h * .22, h * .11); c.fill();
  U.text(label, x + w / 2, y + h / 2 + 1, size, fg || (dk ? '#fff' : INK), 'center', w - size);
  c.restore(); return w;
}
function wSpark(U, x, y, r, rot, fill, o = 2.5) {
  if (r < 1.5) return; const c = ctx; c.save(); c.translate(x, y); c.rotate(rot); c.scale(r, r);
  U.inkP(U.P(W_SPARK), fill, o / r); c.restore();
}
/* a cel-shaded heart; s = half width in px */
function wHeart(U, x, y, s, rot, col) {
  if (s < 1.5) return; const c = ctx, p = U.P(W_HEART); c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  U.cel(p, col, U.shade(col, .3), .16, .2, 3 / s);
  U.glint(p, -.42, -.42, .26, .13, 'rgba(255,255,255,.7)', -.6);
  c.restore();
}
/* the DUO cloud: a 4-puff body, ink 3, a white copy on top */
function wCloud(U, x, y, s) {
  const c = ctx, p = U.P(W_CLOUD); c.save(); c.translate(x, y); c.scale(s, s);
  U.inkP(p, '#e4f5ff', 3 / s);
  c.save(); c.translate(-2, -3); c.scale(.82, .8); c.fillStyle = '#fff'; c.fill(p); c.restore();
  c.restore();
}
/* a chunky inked bomb for the sabotage plates */
function wBomb(U, x, y, r, off) {
  const c = ctx; c.save(); c.translate(x, y); c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = 3.6; c.beginPath(); c.moveTo(r * .5, -r * .7); c.quadraticCurveTo(r * .9, -r * 1.35, r * 1.35, -r * 1.1); c.stroke();
  U.el(0, 0, r, r); U.ink(off ? '#8f88a6' : '#3b3550', 2.5);
  c.fillStyle = 'rgba(255,255,255,.7)'; U.el(-r * .36, -r * .38, r * .28, r * .18, -.6); c.fill();
  if (!off) wSpark(U, r * 1.4, -r * 1.1, 4 + 2 * Math.sin(now * 14), now * 3, '#FFE14D', 1.5);
  c.restore();
}
/* a ring of bulbs along a stadium (fully rounded) outline; alert = red/gold and faster */
function wMarqueeBulbs(U, cx, cy, w, h, n, alert) {
  const c = ctx, r = h / 2 - 5, L = w - h, per = 2 * L + 2 * Math.PI * r;
  for (let i = 0; i < n; i++) {
    let d = i / n * per, x, y;
    if (d < L) { x = -L / 2 + d; y = -r; } else if ((d -= L) < Math.PI * r) { const a = -Math.PI / 2 + d / r; x = L / 2 + Math.cos(a) * r; y = Math.sin(a) * r; }
    else if ((d -= Math.PI * r) < L) { x = L / 2 - d; y = r; } else { d -= L; const a = Math.PI / 2 + d / r; x = -L / 2 + Math.cos(a) * r; y = Math.sin(a) * r; }
    wBulb(U, cx + x, cy + y, 3.4, ((i + (now * (alert ? 9 : 5) | 0)) % 3) !== 0, alert);
  }
}
function wBulb(U, x, y, r, lit, alert) {
  const c = ctx, col = alert ? ((x * .05 | 0) % 2 ? '#ff4d5e' : '#FFE14D') : '#FFE14D';
  c.save();
  if (lit) { c.save(); c.globalAlpha *= .3; c.fillStyle = col; U.el(x, y, r * 2.1, r * 2.1); c.fill(); c.restore(); }
  U.el(x, y, r, r); U.ink(lit ? col : '#6b5a2e', 1.8);
  if (lit) { c.fillStyle = 'rgba(255,255,255,.85)'; U.el(x - r * .3, y - r * .35, r * .3, r * .22); c.fill(); }
  c.restore();
}

/* ───────────── cheers (the co-op counterpart of the sabotage registry) ─────────────
   Every kind draws in the 800x600 space of the receiver's game, 2 to 3 s, ONLY along the edges (never over the middle) and never touches input.
     label, col   what the toast says and its colour; life = seconds
     draw(ctx, t, a, s)  t = seconds since it landed, a = fade envelope 0..1, s.seed = per-cheer random
   The art only uses `now`, `t` and `s.seed` (a hash, never Math.random), so two frames at the same time are identical. */
const WCHEER_COLS = ['#FF4D9E', '#4DB8FF', '#FFE14D', '#5CFF7A', '#FF9A3D', '#B49CFF'];
/* a point on the rectangle perimeter at inset `ins`, d in px along it (clockwise from the top-left corner) */
function wPerim(d, ins) {
  const w = W - 2 * ins, h = H - 2 * ins, per = 2 * (w + h); d = ((d % per) + per) % per;
  if (d < w) return [ins + d, ins]; if (d < w + h) return [W - ins, ins + d - w]; if (d < 2 * w + h) return [W - ins - (d - w - h), H - ins]; return [ins, H - ins - (d - 2 * w - h)];
}
/* a confetti piece: a small inked rounded strip (or a dot) */
function wConfetti(U, x, y, rot, col, kind, sc = 1) {
  const c = ctx; c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc, sc);
  if (kind) { U.el(0, 0, 4.2, 4.2); U.ink(col, 1.4); } else { U.rr(-6, -2.8, 12, 5.6, 2); U.ink(col, 1.4); c.fillStyle = 'rgba(255,255,255,.4)'; U.rr(-4.5, -1.8, 5, 1.6, 1); c.fill(); }
  c.restore();
}
const CHEER_KINDS = {
  /* a trophy frame: INK edge, gold band with a travelling glint, big twinkles in the corners and a ring of small ones that walk around the edge */
  sparkle: { id: 'sparkle', label: 'SPARKLE!', col: '#FFE14D', life: 2.4, draw(c, t, a, s) {
    const U = wUI(); if (!U) return;
    const pul = .5 + .5 * Math.sin(now * 8), ins = 8, g0 = c.globalAlpha;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = '#FFE14D';
    for (const [lw, al] of [[46, .06], [32, .09], [20, .13]]) { c.globalAlpha = g0 * al * (.8 + .4 * pul); U.rr(ins, ins, W - 2 * ins, H - 2 * ins, 26); c.lineWidth = lw; c.stroke(); }
    c.globalAlpha = g0;
    U.rr(ins, ins, W - 2 * ins, H - 2 * ins, 26); c.lineWidth = 17; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 10.5; c.strokeStyle = '#ffd23f'; c.stroke();
    c.lineWidth = 3; c.strokeStyle = '#fff3a0'; c.globalAlpha = g0 * (.7 + .3 * pul); c.stroke();                 // light along the outer edge
    c.globalAlpha = g0; c.setLineDash([46, 520]); c.lineDashOffset = -now * 190; c.lineWidth = 5; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke(); c.setLineDash([]);
    const n = 16, per = 2 * (W + H - 4 * ins);
    for (let i = 0; i < n; i++) {
      const [x, y] = wPerim((i / n + t * .06 + s.seed * .013) * per, ins), tw = Math.max(0, Math.sin(now * 6 + i * 2.1));
      wSpark(U, x, y, 7 + 12 * tw, now * 1.4 + i, i % 3 ? '#FFE14D' : '#fff', 2.2);
    }
    [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(([x, y], i) => wSpark(U, x, y, 21 + 5 * Math.sin(now * 5 + i * 1.6), Math.sin(now * 2 + i) * .3, '#FFE14D', 3));
    c.restore();
  } },
  /* a rainbow band round the screen (INK edged, a shine runs along it) with a puffy cloud in every corner */
  rainbow: { id: 'rainbow', label: 'RAINBOW!', col: '#4DB8FF', life: 2.4, draw(c, t) {
    const U = wUI(); if (!U) return;
    const cols = ['#ff4d5e', '#ff9a3d', '#ffe14d', '#5cff7a', '#4db8ff', '#b49cff'], bw = 5.6, ins0 = 3, R0 = 40, tot = cols.length * bw, g0 = c.globalAlpha;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    const at = o => { const m = ins0 + o; U.rr(m, m, W - 2 * m, H - 2 * m, Math.max(4, R0 - o)); };
    at(tot / 2); c.lineWidth = tot + 7; c.strokeStyle = INK; c.stroke();
    cols.forEach((col, i) => { at(bw * (i + .5)); c.lineWidth = bw + .7; c.strokeStyle = col; c.stroke(); });
    at(bw * .5); c.setLineDash([60, 640]); c.lineDashOffset = -now * 330; c.lineWidth = 3.2; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke(); c.setLineDash([]);
    c.globalAlpha = g0;
    [[44, 36, 1], [W - 44, 36, .92], [44, H - 38, .92], [W - 44, H - 38, 1]].forEach(([x, y, sc], i) => wCloud(U, x, y + Math.sin(now * 2 + i * 1.3) * 3, sc * 1.1));
    c.restore();
  } },
  /* hearts float up both sides inside a soft pink frame */
  hearts: { id: 'hearts', label: 'LOVE!', col: '#FF4D8D', life: 2.6, draw(c, t, a, s) {
    const U = wUI(); if (!U) return;
    const g0 = c.globalAlpha, sd = (s.seed * 7 | 0);
    c.save(); c.lineJoin = 'round'; c.strokeStyle = '#FF9DC4';
    const pul = .5 + .5 * Math.sin(now * 5);
    for (const [lw, al] of [[44, .06], [28, .1], [14, .16]]) { c.globalAlpha = g0 * al * (.8 + .4 * pul); U.rr(8, 8, W - 16, H - 16, 30); c.lineWidth = lw; c.stroke(); }
    c.globalAlpha = g0;
    for (let i = 0; i < 20; i++) {
      const left = i % 2 === 0, P = 2.5 + U.hash(i * 13 + sd) * 1.1, ph = ((t + U.hash(i * 7 + sd) * P) % P) / P, big = 11 + (i % 3) * 5;
      const x = (left ? 34 : W - 34) + (left ? 1 : -1) * U.hash(i * 5 + sd) * 36 + Math.sin(t * 2.2 + i) * 9, y = H + 30 - ph * (H + 70);
      c.globalAlpha = g0 * Math.min(1, ph * 7, (1 - ph) * 3.5);
      wHeart(U, x, y, big * U.outBack(Math.min(1, ph * 6)), Math.sin(t * 2.6 + i * 1.7) * .3, i % 4 === 0 ? '#FF8FB8' : i % 4 === 2 ? '#ff6b9d' : '#FF5C8A');
    }
    c.restore();
  } },
  /* bunting from the top corners, confetti ribbons down both sides and a party popper in each bottom corner */
  party: { id: 'party', label: 'PARTY!', col: '#B49CFF', life: 2.6, draw(c, t, a, s) {
    const U = wUI(); if (!U) return;
    const cols = WCHEER_COLS, sd = (s.seed * 5 | 0), g0 = c.globalAlpha;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    for (const side of [1, -1]) {                                                   // two strings of bunting, one off each top corner
      const x0 = side > 0 ? -6 : W + 6, x1 = side > 0 ? 190 : W - 190, y0 = 5, cy = 36, B = k => [(1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * (x0 + x1) / 2 + k * k * x1, (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * y0];
      c.beginPath(); for (let i = 0; i <= 16; i++) { const [x, y] = B(i / 16); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = INK; c.lineWidth = 6.5; c.stroke(); c.strokeStyle = '#e6c58c'; c.lineWidth = 3; c.stroke();
      for (let i = 0; i < 8; i++) {
        const k = (i + .6) / 8.2, [x, y] = B(k), [x2, y2] = B(k + .02), ang = Math.atan2(y2 - y, x2 - x) * (side > 0 ? 1 : -1), col = cols[(i + (side > 0 ? 0 : 3)) % cols.length];
        c.save(); c.translate(x, y); c.rotate(Math.sin(now * 3.2 + i * 1.3) * .1 + ang * .9 * side); c.fillStyle = col;
        const p = U.P('M-11 0L11 0L0 24Z'); U.cel(p, col, U.shade(col, .28), 0, -4, 2.6); U.glint(p, -4, 5, 2.2, 5, 'rgba(255,255,255,.55)', -.3);
        c.restore();
      }
    }
    for (let i = 0; i < 22; i++) {                                                  // ribbons falling along the side margins
      const left = i % 2 === 0, x = (left ? 14 : W - 74) + (i * 29 + sd * 5) % 60, y = (t * (90 + i * 4 % 50) + i * 53) % (H + 40) - 20;
      if (y > 480 && (i % 2 ? x > W - 90 : x < 90)) continue;                      // keep the popper corners clear
      wConfetti(U, x, y, t * 3 + i, cols[i % cols.length], i % 3 === 0 ? 1 : 0);
    }
    for (const side of [1, -1]) {                                                   // party poppers: cone + a burst every 1.15 s
      const bx = side > 0 ? 34 : W - 34, by = 548, lean = side * .5, mx = bx + Math.sin(lean) * 46, my = by - Math.cos(lean) * 46;
      c.save(); c.translate(bx, by); c.rotate(lean);
      const cone = U.P('M-6 0L6 0L15 -44L-15 -44Z'); U.cel(cone, '#ff4d9e', '#b8286e', 3, -2, 3.4);
      c.save(); c.clip(cone); c.fillStyle = '#ffe14d'; for (let j = 0; j < 3; j++) { c.beginPath(); c.moveTo(-18, -4 - j * 14); c.lineTo(18, -12 - j * 14); c.lineTo(18, -17 - j * 14); c.lineTo(-18, -9 - j * 14); c.closePath(); c.fill(); } c.restore();
      U.glint(cone, -7, -24, 2.4, 11, 'rgba(255,255,255,.5)', .1);
      U.el(0, -44, 15.5, 5); U.ink('#7a2b52', 2.4); c.fillStyle = '#ffd23f'; U.el(0, -45, 12, 3); c.fill();
      c.restore();
      const cyc = Math.floor((t + .1) / 1.15), tt = (t + .1) % 1.15;
      if (tt < .13) { wSpark(U, mx, my, 22 * (1 - tt / .13) + 6, tt * 12, '#FFE14D', 2.5); }
      if (tt < .95) for (let i = 0; i < 16; i++) {
        const h1 = U.hash(cyc * 31 + i * 3 + (side > 0 ? 0 : 977) + sd), h2 = U.hash(cyc * 17 + i * 5 + 11 + sd), ang = -Math.PI / 2 + side * (.28 + .32 * h1) + (h2 - .5) * .7, v = 230 + h1 * 220;
        const x = mx + Math.cos(ang) * v * tt * (side > 0 ? 1 : 1), y = my + Math.sin(ang) * v * tt + 520 * tt * tt / 2;
        c.globalAlpha = g0 * Math.min(1, (.95 - tt) * 6);
        wConfetti(U, x, y, tt * 9 + i, cols[(i + cyc) % cols.length], i % 3 === 0 ? 1 : 0, 1.3);
      }
    }
    c.restore();
  } },
};
const CHEER_IDS = Object.keys(CHEER_KINDS);
/* the seed only decorates (where the sparkles start, which hearts rise): a hash of the kind, the name and the clock, never Math.random */
const wSeed = (k, name) => { let h = 2166136261; for (const ch of String(k) + String(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 5000 + Math.floor(now * 977) % 5000) / 100; };
const cheerMake = (k, name, col) => ({ k, at: now, name: name || '', col: col || '', seed: wSeed(k, name), life: CHEER_KINDS[k].life });
const cheerLive = c => !!c && CHEER_KINDS[c.k] !== undefined && now - c.at <= c.life;
const cheerEnvelope = c => Math.max(0, Math.min(1, (now - c.at) / .2, (c.life - (now - c.at)) / .5));
function cheerDraw(c) {
  if (!cheerLive(c)) return;
  ctx.save(); ctx.globalAlpha = cheerEnvelope(c); sabTry(() => CHEER_KINDS[c.k].draw(ctx, now - c.at, cheerEnvelope(c), c)); ctx.restore();
}
/* the little picture on the right of the cheer banner */
function wCheerIcon(U, k, x, y) {
  if (k === 'sparkle') wSpark(U, x, y, 13 + 2 * Math.sin(now * 7), now * 1.2, '#fff', 2.4);
  else if (k === 'hearts') wHeart(U, x, y + 1, 12 + 1.5 * Math.sin(now * 7), Math.sin(now * 3) * .2, '#FF5C8A');
  else if (k === 'rainbow') { const c = ctx; c.save(); c.translate(x, y + 5); c.lineCap = 'round'; ['#ff4d5e', '#ffe14d', '#4db8ff'].forEach((col, i) => { c.beginPath(); c.arc(0, 0, 14 - i * 4.4, Math.PI, 0); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); }); ['#ff4d5e', '#ffe14d', '#4db8ff'].forEach((col, i) => { c.beginPath(); c.arc(0, 0, 14 - i * 4.4, Math.PI, 0); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); }); c.restore(); }
  else { for (let i = 0; i < 3; i++) wConfetti(U, x - 9 + i * 9, y + Math.sin(now * 6 + i * 2) * 3, now * 4 + i * 2, WCHEER_COLS[(i * 2 + 1) % 6], i === 1 ? 1 : 0, 1.2); }
}
/* "NAME CHEERS YOU ON!" over the bottom of my game while it lasts (the same place as the ghost pill): a round banner in the cheer's colour with the cheerer's avatar */
function cheerBanner(c) {
  if (!cheerLive(c)) return;
  const U = wUI(); if (!U) return;
  try {
    const kd = CHEER_KINDS[c.k], age = now - c.at, k = U.clamp(age / .3, 0, 1), a = Math.min(1, (c.life - age) / .5);
    const label = t('{name} CHEERS YOU ON!', { name: c.name.toUpperCase() }), dark = wLum(kd.col) >= .3, size = 20;
    const w = U.clamp((dark ? wTw(label, size, true) : wTw(label, size)) + 128, 300, 700), h = 46, y = 516 + Math.sin(now * 3) * 1.5, x = 400;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); const sc = U.outBack(k); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(20,16,28,.3)'; U.rr(-w / 2 + 3, -h / 2 + 7, w, h, h / 2); ctx.fill();
    U.rr(-w / 2, -h / 2, w, h, h / 2); U.ink(kd.col, 4);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; U.rr(-w / 2 + h * .35, -h / 2 + 5, w - h * .7, h * .2, h * .1); ctx.fill();
    U.text(label, 0, 2, size, dark ? INK : '#fff', 'center', w - 118);
    U.avatar(-w / 2 + 31, 1, 15, c.col || '#FFE14D', { t: now, mood: 'happy', seed: 3 });
    wCheerIcon(U, c.k, w / 2 - 31, 0);
    ctx.restore();
  } catch (_) { /* art must never stop a round */ }
}

/* The cheer channel, shaped like createSabChannel: o = { charges, send(type, data) (the relay), onSend(kind), onHit(state, fromId) }.
   cc.send() spends a charge and tells the whole team; cc.receive(type, data, from) is for the relay handler; cc.active() is the cheer on me (expires by itself). */
function createCheerChannel(R, o = {}) {
  const cc = { charges: o.charges, state: null, last: '' };
  cc.pick = () => { const ids = CHEER_IDS.filter(k => k !== cc.last); return ids[Math.floor(Math.random() * ids.length)]; };
  cc.send = () => {
    if (!WAIT_CHEER_MODES.includes(R.mode) || !cc.charges.ready()) return false;
    cc.charges.spend(); const k = cc.last = cc.pick();
    if (o.send) o.send('cheer', { k });
    if (o.onSend) sabTry(() => o.onSend(k));
    return true;
  };
  cc.receive = (type, data, from) => {
    if (type !== 'cheer' || !data || !CHEER_IDS.includes(data.k) || from === party.you.id) return false;
    const cur = party.room && party.room.id === R.id ? party.room : R, pl = cur.players.find(p => p.id === from);
    if (!pl || !WAIT_CHEER_MODES.includes(cur.mode)) return false;
    cc.state = cheerMake(data.k, pl.name, pl.color);
    sabTry(() => { sfx.sparkle(); floatText(CHEER_KINDS[data.k].label, 400, 150, CHEER_KINDS[data.k].col, 36); });
    if (o.onHit) o.onHit(cc.state, from);
    return true;
  };
  cc.active = () => { if (cc.state && !cheerLive(cc.state)) cc.state = null; return cc.state; };
  return cc;
}

/* ───────────── the waiting player's kit ───────────── */
const partyWaitOn = R => !!R && R.state === 'round' && (SAB_RACE_MODES.includes(R.mode) || WAIT_CHEER_MODES.includes(R.mode)) && party.view === 'wait' && !!me() && !!(R.cur && R.cur[party.you.id] || party.pending);
/* built once per room (charges survive the rounds), traps and channel rebuilt every round */
function partyWaitKit(R) {
  let k = party.wait;
  if (!k || k.room !== R.id) k = party.wait = { room: R.id, round: -1, charges: createSabCharges(WAIT_CFG[R.mode]), pulse: -9, flash: null, lunge: 0, hits: {} };
  if (k.round !== R.round) {
    k.round = R.round; k.hits = {};
    k.traps = createIdleTraps({ at: { x: 250, y: 500 }, first: [.25, .35], gap: [.8, 1], weights: WAIT_TRAPS, words: WAIT_WORDS, onReward: () => { k.charges.earn('trap'); k.pulse = now; } });
    const send = (type, data) => sabSendDirect(type, data, R2 => { const w = party.wait; return w && w.room === R2.id && w.round === R2.round ? w.charges : null; });
    if (SAB_RACE_MODES.includes(R.mode)) k.ch = createSabChannel(R, { send }, { charges: k.charges, wait: true, onSend: (kind, to) => sabThrownFx(k, kind, to) });
    else k.cc = createCheerChannel(R, { charges: k.charges, send, onSend: kind => partyWaitCheered(k, kind) });
  }
  return k;
}
/* TEAM: the cheer went out. Everybody still playing is lit on its card, the viewer glows in the cheer's colour, and a toast says what it was */
function partyWaitCheered(k, kind) {
  const R = party.room, kd = CHEER_KINDS[kind];
  k.flash = { k: kind, at: now, to: '*' }; k.lunge = 1; if (R) R.players.forEach(p => { if (!p.left && p.id !== party.you.id && !R.cur[p.id]) k.hits[p.id] = now; });
  sfx.sparkle(); shake(3, .2); ring(250, 280, kd.col, 160, .5); burst(250, 280, kd.col, 22, 420); floatText(kd.label, 250, 236, kd.col, 48);
}
function partyWaitUpdate(R, dt) {
  const k = party.wait;
  if (!partyWaitOn(R)) { if (k) k.charges.cd = Math.max(0, k.charges.cd - dt); return; }   // the cooldown keeps running through the results screen
  const w = partyWaitKit(R); w.lunge = Math.max(0, w.lunge - dt * 3.2); w.charges.tick(dt); w.traps.update(dt);
}
/* E (or Q) throws at the player I am watching (VERSUS) or cheers the team (TEAM) */
function partyWaitThrow(k) {
  if (k.cc) { k.cc.send(); return; }
  const list = k.ch.targets(), pick = list.find(p => p.id === party.watch.target) || list[0];
  if (pick) k.ch.send(pick.id);
}
function partyWaitKey(e) {
  const R = party.room; if (!R || e.repeat || !partyWaitOn(R)) return;
  const k = partyWaitKit(R); if (!k.traps.key(e.code) && (e.code === 'KeyE' || e.code === 'KeyQ')) partyWaitThrow(k);
}

/* ───────────── drawing the waiting screen ───────────── */
/* a plate button: hover lifts it, a press sinks it, `off` greys it. icon(dy) draws on the face. Registers the hit rectangle `hit` = [x, y, w, h]. */
function wPlateBtn(U, b, col, o, hit, fn, label) {
  const hv = wHov(hit[0], hit[1], hit[2], hit[3]), dn = hv && wDown(), bb = [b[0], b[1] - (hv && !dn && !o.off ? 2 : 0), b[2], b[3]];
  const face = Array.isArray(col) ? col[0] : col, base = Array.isArray(col) ? col[1] : U.PLATE[col] ? undefined : U.shade(col, .35);
  const dy = U.plate(bb, face, base, dn, !!o.lit, !!o.off);
  if (o.icon) o.icon(bb, dy);
  // an off plate has a pale grey face: its label is dark ink (no outline), faded, so it reads as "not now" and stays readable in every language
  if (o.ly != null) { ctx.save(); if (o.off) ctx.globalAlpha *= .62; U.text(label, o.x != null ? o.x : bb[0] + bb[2] / 2, bb[1] + dy + o.ly, o.size || 24, o.off ? INK : (o.fg || '#fff'), 'center', o.w); ctx.restore(); }
  else { ctx.save(); if (o.off) ctx.globalAlpha *= .62; U.plateLabel(bb, dy, label, o.key || '', { size: o.size || 24, w: o.w, off: false, x: o.x, fg: o.off ? INK : o.fg }); ctx.restore(); }
  btns.push({ x: hit[0], y: hit[1], w: hit[2], h: hit[3], fn, label });
}
/* the title: a marquee sign with chasing bulbs */
function wMarquee(U, label, alert) {
  const w = U.clamp(wTw(label, 24) + 74, 220, 430), h = 42, x = 400 - w / 2, y = 7, c = ctx;
  c.save(); c.fillStyle = 'rgba(20,16,28,.3)'; U.rr(x + 3, y + 8, w, h, h / 2); c.fill();
  U.rr(x, y, w, h, h / 2); U.ink('#2b2540', 4);
  c.fillStyle = 'rgba(255,255,255,.14)'; U.rr(x + 14, y + 5, w - 28, 7, 3.5); c.fill();
  wMarqueeBulbs(U, 400, y + h / 2, w, h, Math.round(w / 15), alert);
  U.text(label, 400, y + h / 2 + 2, 22, '#FFE14D', 'center', w - 52);
  c.restore();
}
function wSubtitle(U, label, col) {
  const w = U.clamp(wTw(label, 18) + 36, 220, 752), h = 26, x = 400 - w / 2, y = 58, c = ctx;
  c.save(); c.fillStyle = 'rgba(20,16,28,.28)'; U.rr(x + 2, y + 5, w, h, h / 2); c.fill();
  U.rr(x, y, w, h, h / 2); U.ink('#2b2540', 3);
  c.fillStyle = 'rgba(255,255,255,.12)'; U.rr(x + 10, y + 4, w - 20, 5, 2.5); c.fill();
  U.text(label, 400, y + h / 2 + 1, 18, col, 'center', w - 24);
  c.restore();
}
/* the lounge where the idle trap panel is: baked wall, rug, sofa (back and front layers), plant pot; live bulbs, sign, plant leaves, motes, Claude and a name tag */
const W_LOUNGE = { w: 468, h: 88 };
function wLoungeBack(U, g) {
  g.save(); U.rr(1.5, 1.5, 465, 85, 14); g.clip();
  g.fillStyle = '#4a3f7a'; U.rr(0, 0, 468, 88, 0); g.fill();
  g.fillStyle = '#54488a'; for (let x = 6; x < 468; x += 30) { U.rr(x, 0, 14, 88, 4); g.fill(); }
  g.fillStyle = 'rgba(255,124,168,.42)'; for (let i = 0; i < 16; i++) { U.el(10 + U.hash(i * 3 + 1) * 448, 20 + U.hash(i * 5 + 2) * 34, 2.2, 2.2); g.fill(); }
  g.fillStyle = '#2b2540'; U.rr(0, 0, 468, 14, 0); g.fill();                                  // the bulb rail
  g.fillStyle = INK; U.rr(0, 13, 468, 3.2, 1); g.fill();
  g.fillStyle = '#b97a46'; U.rr(0, 60, 468, 28, 0); g.fill();                                   // floor
  g.fillStyle = '#8a5530'; U.rr(0, 72, 468, 16, 0); g.fill();
  g.strokeStyle = '#7a4a28'; g.lineWidth = 2; g.lineCap = 'round'; for (let x = 20; x < 468; x += 58) { g.beginPath(); g.moveTo(x, 62); g.lineTo(x - 6, 72); g.moveTo(x + 29, 72); g.lineTo(x + 23, 86); g.stroke(); }
  g.fillStyle = INK; U.rr(0, 58, 468, 4, 1); g.fill();                                          // the horizon line
  U.el(70, 77, 82, 8); U.ink('#e8434f', 3); g.fillStyle = '#ffd23f'; U.el(70, 77, 64, 5); g.fill(); g.fillStyle = '#e8434f'; U.el(70, 77, 50, 3.6); g.fill();   // rug
  U.cel(U.P(wRrd(14, 32, 114, 42, 14)), '#9B8AD6', '#6a5aa6', 3, 5, 3.5);                      // sofa back
  g.save(); g.translate(36, 49); g.rotate(-.3); U.rr(-9, -9, 18, 18, 5); U.ink('#ff7ca8', 2.5); g.fillStyle = 'rgba(255,255,255,.45)'; U.rr(-6, -6.5, 8, 3, 1.5); g.fill(); g.restore();   // pillow
  U.cel(U.P(wRrd(141, 55, 23, 21, 5)), '#d9944f', '#a5622c', 3, 5, 3);                          // plant pot
  g.fillStyle = '#6b4a2c'; U.el(152.5, 56, 10, 2.4); g.fill();
  g.restore();
}
function wLoungeFront(U, g) {
  g.save();
  g.fillStyle = INK; U.rr(16, 71, 7, 6, 2); g.fill(); U.rr(117, 71, 7, 6, 2); g.fill();         // sofa feet
  U.cel(U.P(wRrd(8, 40, 25, 33, 11)), '#B49CFF', '#8E7CC3', 3, 5, 3.5);                          // arms
  U.cel(U.P(wRrd(107, 40, 25, 33, 11)), '#B49CFF', '#8E7CC3', 3, 5, 3.5);
  const seat = U.P(wRrd(22, 57, 96, 17, 8)); U.cel(seat, '#C7B6FF', '#9B8AD6', 2, 4, 3.5); U.glint(seat, 44, 61, 18, 3, 'rgba(255,255,255,.5)', 0);
  g.fillStyle = 'rgba(255,255,255,.45)'; U.el(17, 49, 3, 6, .2); g.fill(); U.el(116, 49, 3, 6, -.2); g.fill();
  g.restore();
}
function wLounge(U, mx, y, mw, st) {
  const c = ctx, back = wBake(U, 'lb', W_LOUNGE.w, W_LOUNGE.h, g => wLoungeBack(U, g)), front = wBake(U, 'lf', W_LOUNGE.w, W_LOUNGE.h, g => wLoungeFront(U, g));
  c.save(); c.translate(mx, y);
  c.fillStyle = 'rgba(20,16,28,.3)'; U.rr(4.5, 8.5, 465, 85, 14); c.fill();
  U.rr(1.5, 1.5, 465, 85, 14); c.save(); c.clip();
  if (back) c.drawImage(back, 0, 0, W_LOUNGE.w, W_LOUNGE.h);
  const alert = st.soon, glad = st.flash > 0 || st.lunge > 0;
  for (let i = 0; i < 6; i++) { c.globalAlpha = .2 + .3 * Math.max(0, Math.sin(now * (.7 + i * .13) + i * 2)); c.fillStyle = '#fff'; U.el(30 + U.hash(i * 11 + 4) * 410 + Math.sin(now * .5 + i) * 8, 20 + (U.hash(i * 7 + 3) * 36 + now * 3 * (1 + i % 3 * .4)) % 38, 1.5, 1.5); c.fill(); }   // dust in the stage light
  c.globalAlpha = 1;
  for (let i = 0; i < 21; i++) wBulb(U, 12 + i * 22.2, 6.8, 3.5, ((i + (now * (alert ? 10 : 4) | 0)) % 3) !== 0, alert);
  // the plant (leaves sway)
  c.save(); c.translate(152.5, 56);
  [[-.75, 21, '#2f9a55'], [.8, 22, '#2f9a55'], [-.22, 28, '#3fb260'], [.3, 25, '#3fb260']].forEach(([a, l, col], i) => { c.save(); c.rotate(a + Math.sin(now * 1.6 + i * 1.4) * .06); U.el(0, -l * .55, 5.4, l * .55); U.ink(col, 2.5); c.fillStyle = 'rgba(255,255,255,.28)'; U.el(-1.6, -l * .7, 1.5, l * .22, 0); c.fill(); c.restore(); });
  c.restore();
  // Claude on the sofa
  const m = me(), glow = Math.sin(now * 3.1), hop = alert ? Math.abs(Math.sin(now * 13)) * 4 : st.lunge > 0 ? Math.sin(st.lunge * Math.PI) * 7 : glad ? Math.abs(Math.sin(now * 9)) * 3 : 0;
  c.save(); c.translate(71, 66 - hop); c.scale(1 + glow * .012, 1 - glow * .012);
  U.el(0, hop - 8, 20, 3); c.fillStyle = 'rgba(20,16,28,.22)'; c.fill();
  claude(0, 0, 3.6, { col: m ? m.color : OR, mood: st.mood });
  c.restore();
  if (back && front) c.drawImage(front, 0, 0, W_LOUNGE.w, W_LOUNGE.h);
  if (m) U.pill(71, 18, m.name, m.color, false, 10.5);
  if (alert) { const by = 31 + Math.sin(now * 11) * 2; U.el(108, by, 9, 9); U.ink('#ff4d5e', 2.5); U.text('!', 108, by + 1, 13, '#fff'); }
  // the sign: wood, or red when a trap is about to land, gold when I just won one
  const sx = 312, face = alert ? '#ff4d5e' : st.flash > 0 ? '#FFE14D' : '#d9944f', dk = alert ? '#b8283a' : st.flash > 0 ? '#c99512' : '#a5622c';
  const lines = alert ? [st.heads] : wWrap(U.tr(st.msg), 16, 244), sh = 46, sw = 280;
  c.save(); c.translate(sx + (alert ? Math.sin(now * 40) * 2 : 0), 14); c.rotate(Math.sin(now * 1.3) * .012 + (alert ? Math.sin(now * 30) * .012 : 0));
  c.strokeStyle = INK; c.lineWidth = 6.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-sw / 2 + 26, 0); c.lineTo(-sw / 2 + 32, 9); c.moveTo(sw / 2 - 26, 0); c.lineTo(sw / 2 - 32, 9); c.stroke();
  c.strokeStyle = '#e6c58c'; c.lineWidth = 3; c.stroke();
  c.translate(0, 7); c.fillStyle = 'rgba(20,16,28,.28)'; U.rr(-sw / 2 + 3, 7, sw, sh, 12); c.fill();
  const sp = U.P(wRrd(-sw / 2, 0, sw, sh, 12)); U.cel(sp, face, dk, 3, 5, 4);
  c.save(); c.clip(sp); c.strokeStyle = alert ? 'rgba(255,255,255,.18)' : st.flash > 0 ? 'rgba(201,149,18,.45)' : '#c98443'; c.lineWidth = 2; c.lineCap = 'round';
  for (const [gx, gy, gl] of [[-110, 11, 34], [50, 9, 52], [-40, sh - 8, 40], [84, sh - 11, 28]]) { c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + gl, gy); c.stroke(); } c.restore();
  U.glint(sp, -sw * .28, 7, 40, 3.6, 'rgba(255,255,255,.45)', -.04);
  for (const nx of [-sw / 2 + 10, sw / 2 - 10]) { U.el(nx, 9, 2.6, 2.6); U.ink(dk, 1.2); }
  if (lines.length > 1) { U.text(lines[0], 0, sh / 2 - 8.5, 16, '#fff', 'center', sw - 34); U.text(lines[1], 0, sh / 2 + 9.5, 16, '#fff', 'center', sw - 34); }
  else U.text(lines[0], 0, sh / 2 + 1, alert ? 27 : 17, '#fff', 'center', sw - 34);
  if (st.flash > 0) for (let i = 0; i < 5; i++) wSpark(U, (i - 2) * 62 + Math.sin(now * 5 + i) * 6, -2 + (i % 2) * (sh + 4), 5 + 4 * Math.max(0, Math.sin(now * 9 + i * 1.7)) * st.flash, now * 2 + i, i % 2 ? '#fff' : '#FFE14D', 1.8);
  c.restore();
  c.restore();                                                                                    // end clip
  U.rr(1.5, 1.5, 465, 85, 14); c.lineWidth = 6; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.2)'; U.rr(14, 5.5, 140, 3, 1.5); c.fill();
  c.restore();
}
/* a charge: glossy orb, or a socket with a recharge ring when it is the next one to come */
function wOrbs(U, k, cx, cy, accent, ready) {
  const c = k.charges, u = k.ui || (k.ui = { n: c.n, at: [] }), r = 14, gap = 41;
  if (c.n > u.n) for (let i = u.n; i < c.n; i++) u.at[i] = now; u.n = c.n;
  for (let i = 0; i < c.max; i++) {
    const x = cx + (i - (c.max - 1) / 2) * gap, full = i < c.n, at = u.at[i];
    U.orb(x, cy, r, { col: accent, state: !full ? 'empty' : ready ? 'pulse' : 'full', t: now, seed: i * .7, k: full && at !== undefined ? U.clamp((now - at) / .4, 0, 1) : 1 });
    if (i === c.n) {                                                                              // the next orb is charging: a chunky ring fills round it
      const f = U.clamp(c.clock / c.cfg.every, 0, 1);
      ctx.save(); ctx.lineCap = 'round';
      if (f > .02) { ctx.beginPath(); ctx.arc(x, cy, r + 5.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.strokeStyle = INK; ctx.lineWidth = 7.5; ctx.stroke(); ctx.strokeStyle = accent; ctx.lineWidth = 3.6; ctx.stroke(); }
      ctx.restore();
    }
  }
}
function partyWaitDraw(R, pk) {
  const U = wUI(); if (!U) return;
  const k = partyWaitKit(R), m = me(), watch = party.watch, target = pk.target, frame = pk.frame, race = !k.cc, ready = k.charges.ready(), my = R.cur[m.id] || party.pending;
  const kindOf = id => SAB_KINDS[id] || CHEER_KINDS[id] || SAB_KINDS.ink, accent = race ? '#FF9A3D' : '#FFE14D', c = ctx, soon = k.traps.soon();
  wMarquee(U, t('ROUND {n} / {total}', { n: R.round + 1, total: R.total }), false);
  wSubtitle(U, race ? 'DONE! WIN TRAPS TO SABOTAGE THE REST' : 'DONE! WIN TRAPS TO CHEER YOUR TEAM ON', my && my.r === 'win' ? '#5CFF7A' : '#FFE14D');
  // the game of the player I am watching, as everybody sees it: a sabotage I throw lands here (a TV)
  const tc = target ? target.color : '#4a5aa0', tvp = U.P(wRrd(16, 100, 468, 358, 18));
  c.save(); c.fillStyle = 'rgba(20,16,28,.3)'; U.rr(19, 107, 468, 358, 18); c.fill(); c.restore();
  U.cel(tvp, tc, U.shade(tc, .3), 0, 7, 4);
  c.save(); c.fillStyle = 'rgba(255,255,255,.3)'; U.rr(30, 104, 190, 5, 2.5); c.fill(); c.restore();
  c.save(); U.rr(25, 109, 450, 340, 10); U.ink('#19172d', 3); U.rr(25, 109, 450, 340, 10); c.clip();
  if (frame && frame.image) {
    c.drawImage(frame.image, 25, 109, 450, 338);
    if (target && !R.cur[target.id] && now - frame.at > 3) { c.fillStyle = 'rgba(20,16,28,.5)'; U.rr(25, 109, 450, 340, 0); c.fill(); }
  } else {
    ['#fff', '#FFE14D', '#4DDBE8', '#5CFF7A', '#FF5CC8', '#ff4d5e', '#4D6BFF'].forEach((col, i) => { c.globalAlpha = .8; c.fillStyle = col; U.rr(31 + i * 62.6, 115, 56, 200, 10); c.fill(); }); c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { c.fillStyle = '#FFE14D'; U.el(214 + i * 36, 362 + Math.sin(now * 6 - i * .8) * 7, 7, 7); U.ink('#FFE14D', 2.4); }
    U.badge(target ? 'CONNECTING TO THE PLAYER...' : 'WAITING FOR THE NEXT ROUND', 250, 320, 20, '#2b2540', '#FFE14D', 1, -.02, 420);
  }
  if (target && R.cur[target.id]) {                                                              // finished: dimmed, with a badge, nothing to see
    c.fillStyle = 'rgba(20,16,28,.42)'; U.rr(25, 109, 450, 340, 0); c.fill();
    U.badge('FINISHED', 250, 395, 30, '#5CFF7A', '#fff', 1, -.04 + Math.sin(now * 2) * .012);
  }
  U.glint(U.P(wRrd(25, 109, 450, 340, 10)), 70, 150, 90, 20, 'rgba(255,255,255,.07)', -.5);
  c.restore();
  if (frame && frame.image && target && !R.cur[target.id] && now - frame.at > 3) wTag(U, 250 - 160, 118, 'RECONNECTING TO THE PLAYER...', '#ff4d5e', 15, 320, '#fff');
  if (target) wTag(U, 31, 116, target.name, target.color, 15, 200);
  c.save(); const blink = .5 + .5 * Math.sin(now * 4); U.el(463, 453.5, 3.2, 3.2); U.ink(blink > .5 ? '#ff4d5e' : '#7a2b3a', 1.6); c.restore();   // the little REC lamp on the bezel
  const fl = k.flash && now - k.flash.at < .7 ? k.flash : null;
  if (fl && (fl.to === '*' || fl.to === watch.target)) {
    const u = (now - fl.at) / .7; c.save(); c.globalAlpha = 1 - u; c.lineJoin = 'round';
    U.rr(21, 105, 458, 348, 14); c.lineWidth = 20; c.strokeStyle = INK; c.stroke(); c.lineWidth = 12; c.strokeStyle = kindOf(fl.k).col; c.stroke();
    c.restore();
  }
  // everybody else: tap a card to watch them; VERSUS also has a SABOTAGE! plate on every player still playing
  pk.friends.forEach((p, i) => {
    const y = 104 + i * 90, done = !!R.cur[p.id], sel = p.id === watch.target, hit = now - (k.hits[p.id] || -9) < .9, can = race && ready && !done;
    const face = hit ? balMix('#35406a', kindOf((k.flash || { k: 'ink' }).k).col, .5) : sel ? '#46507a' : '#2f2b4d';
    wSlab(U, 496, y, 288, 75, 16, face, U.shade(face, .45), 4, 5);
    if (sel) { c.save(); c.strokeStyle = '#FFE14D'; c.lineWidth = 3.4; c.globalAlpha = .75 + .25 * Math.sin(now * 5); U.rr(500.5, y + 4.5, 279, 66, 12); c.stroke(); c.restore(); }
    if (sel) { c.save(); c.translate(488 + Math.sin(now * 5) * 2, y + 36); U.inkP(U.P('M6 -9L-5 0L6 9Z'), '#FFE14D', 2.2); c.restore(); }
    const shake = hit ? Math.sin(now * 60) * 3 : 0, mood = hit && race ? 'sad' : hit || done ? 'happy' : null;
    c.save(); U.el(532, y + 38, 29, 29); U.ink(U.shade(p.color, .5), 3); c.clip();
    c.fillStyle = 'rgba(255,255,255,.12)'; U.el(524, y + 25, 15, 6, -.5); c.fill();
    claude(532 + shake, y + 55 + (done ? 0 : Math.sin(now * 3 + i) * 1.2), 2.6, { col: p.color, mood }); c.restore();
    U.el(532, y + 38, 29, 29); c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
    if (done) { c.save(); c.translate(551, y + 56); U.el(0, 0, 11, 11); U.ink('#5CFF7A', 2.5); c.strokeStyle = INK; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-4.5, 0); c.lineTo(-1, 3.6); c.lineTo(5, -3.4); c.stroke(); c.restore(); }
    if (hit) for (let s = 0; s < 3; s++) { const q = (now - k.hits[p.id]) / .9; wSpark(U, 532 + (s - 1) * 22, y + 8 - q * 8 + (s % 2) * 6, 7 * (1 - q) + 2, now * 4 + s, race ? '#FFE14D' : '#FF8FB8', 1.8); }
    U.text(p.name, 574, y + 24, 18, p.color, 'left', race ? 100 : 196);
    const st = done ? 'FINISHED' : 'PLAYING NOW', sw = Math.min(race ? 100 : 196, wTw(U.tr(st), 12.5, true) + 28);
    c.save(); U.rr(574, y + 43, sw, 21, 10.5); U.ink(done ? '#c9c6e0' : '#7BD88F', 2.6);
    if (!done) { c.fillStyle = INK; c.globalAlpha = .55 + .45 * Math.sin(now * 5 + i); U.el(585, y + 53.5, 3, 3); c.fill(); c.globalAlpha = 1; }
    U.text(st, 574 + sw / 2 + (done ? 0 : 5), y + 54, 12.5, INK, 'center', sw - (done ? 10 : 24)); c.restore();
    btns.push({ x: 496, y, w: race ? 184 : 288, h: 80, fn: () => { watch.target = p.id; watch.manual = true; } });
    if (race) wPlateBtn(U, [684, y + 5, 94, 52], ['#FF9A3D', '#b8581a'], { off: !can, lit: can, size: 13, w: 82, x: 731, ly: 38, icon: (b, dy) => wBomb(U, 731, b[1] + dy + 17, 8.5, !can) }, [682, y + 2, 100, 68], () => k.ch.send(p.id), 'SABOTAGE!');
  });
  // the traps: win them to charge. A trap on screen paints its own panel (js/party-sab.js); the idle one is the lounge.
  k.traps.draw(16, 466, 468, (mx, y, mw) => wLounge(U, mx, y, mw, { soon, heads: 'HEADS UP!', msg: race ? 'WIN TRAPS TO CHARGE SABOTAGE' : 'WIN TRAPS TO CHARGE A CHEER', flash: k.traps.flash(), lunge: k.lunge, mood: my && my.r === 'win' ? 'happy' : null }));
  // my charges: orbs, no numbers, and the big throw / cheer plate
  const px = 496, py = 466, rim = ready ? .5 + .5 * Math.sin(now * 6) : 0;
  wSlab(U, px, py + 2, 288, 77, 16, ready ? '#4a3f6e' : '#3b3550', ready ? '#241d3a' : '#221e38', 4, 5);
  if (ready) { c.save(); c.strokeStyle = accent; c.globalAlpha = .5 + .4 * rim; c.lineWidth = 3; U.rr(px + 5, py + 7, 278, 68, 12); c.stroke(); c.restore(); }
  wOrbs(U, k, px + 74, py + 30, accent, ready);
  const msg = ready ? race ? 'SABOTAGE READY!' : 'CHEER READY!' : k.charges.n > 0 && k.charges.cd > 0 ? 'RECHARGING...' : 'WIN A TRAP!', mw2 = Math.min(138, wTw(U.tr(msg), 13, true) + 24);
  wTag(U, px + 74 - mw2 / 2, py + 52, msg, ready ? '#5CFF7A' : k.charges.n > 0 && k.charges.cd > 0 ? '#FFD23F' : '#d3cfe0', 13, 138);
  wPlateBtn(U, [px + 152, py + 8, 126, 58], ready ? race ? ['#FF9A3D', '#b8581a'] : 'yellow' : 'off', { off: !ready, lit: ready, size: 21, w: 104, key: 'E' }, [px + 150, py + 8, 130, 70], () => partyWaitThrow(k), race ? 'SABOTAGE!' : 'CHEER!');
  wPlateBtn(U, [16, 9, 118, 34], ['#f6f4fb', '#8f88a6'], { size: 17, w: 100, fg: INK }, [14, 10, 130, 44], () => partyLeave(), 'LEAVE');
}

/* ───────────── the players still playing ───────────── */
/* a receive-only channel that attaches itself to the relay: { active() = the soft sabotage on me, after() = what to draw over my game after the sabotage (the cheer) } */
function partyWaitReceiver(R) {
  if (!party.sig || !(SAB_RACE_MODES.includes(R.mode) || WAIT_CHEER_MODES.includes(R.mode))) return null;
  const S = party.sig, race = SAB_RACE_MODES.includes(R.mode), ch = race ? createSabChannel(R, null, {}) : createCheerChannel(R, {});
  const h = (type, data, from) => { ch.receive(type, data, from); };
  S.handler = h; S.buf.splice(0).forEach(x => x.round === S.round && h(x.t, x.d, x.from));
  return race ? { active: ch.active, after: null } : { active: () => null, after: () => { const c = ch.active(); if (c) { cheerDraw(c); cheerBanner(c); } } };
}
