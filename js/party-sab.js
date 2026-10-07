'use strict';
/* Shared sabotage + idle-trap kit for the party modes (loaded before party-modes.js).
   Four building blocks, each usable by any mode that opts in:
   1. SAB_KINDS      registry of screen sabotages (label, icon, colour, life, pre/draw) plus the sabBegin/sabEnd renderer
   2. createSabCharges(cfg)   charge economy: earn per time / trap / combo, spend with a cooldown
   3. createSabChannel(R, relay, o) + sabStrip/sabPicker/sabOrbs   target picker, relay send/receive, the buttons and the charge orbs
   4. createIdleTraps(o)      jam / bubble / dial / seq / fly mini-games for players who would otherwise just wait
   SAB_IDS, the `ghost` kinds, SAB_MODES, SAB_GHOST_MODES and SAB_RACE_MODES must match SAB_KINDS, GHOST_KINDS, SAB_MODES, GHOST_MODES and RACE_MODES in pocketbase/pb_hooks/party.js (the server validates the relay; test/party-sab.test.js checks both).
   Three ways to opt a mode in, all through createSabChannel: SAB_MODES (everybody sabotages everybody), SAB_GHOST_MODES (only the eliminated, js/party-ghost.js) and
   SAB_RACE_MODES (only a player who already finished, at the ones still playing, js/party-wait.js). The last two throw the `ghost` kinds, soft (SAB_SOFT). */
const SAB_MODES = ['balloon', 'cards'];     // co-op modes (team, lantern, duo, squad) never appear here: nobody sabotages a teammate
const SAB_RACE_MODES = ['versus'];                 // a finished player waits for the others: they may throw soft hits at the ones still playing (never in co-op: TEAM only cheers, see js/party-wait.js)
const SAB_GHOST_MODES = ['survival', 'knockout'];   // the living never sabotage each other there: only an ELIMINATED player (a ghost) haunts them, with the `ghost` kinds and softer hits (see SAB_SOFT)
const SAB_SOFT = { str: .6, life: .75 };            // a ghost's (or a finished racer's) hit is weaker (envelope x str) and shorter (life x life) than a balloon or cards sabotage
const sabTry = fn => { try { fn(); } catch (_) { /* sound or particles must never stop a round */ } };
let sabBufCv = null;
const sabBuf = () => sabBufCv || (sabBufCv = document.createElement('canvas'), sabBufCv.width = 280, sabBufCv.height = 210, sabBufCv);
const SAB_SPAM = ['#FF4D9E', '#4DB8FF', '#B49CFF', '#5CFF7A', '#F28CB1', '#FF9A3D'];

/* ───────────── art (the DUO look, drawn with the shared kit js/party-ui.js) ───────────── */
/* Every overlay / button below follows docs/ART-STYLE.md: INK outlines at 2x, rounded shapes, base / shade / light with one glint, idle motion, outBack pop-ins.
   Art only: durations, strengths, input effects and hit rectangles are untouched. Cosmetic variety comes from PARTY_UI.hash(index), never from the game's RNG.
   Without the kit (the headless unit tests load this file alone) overlays draw nothing and the buttons fall back to button(). */
const SABU = typeof PARTY_UI !== 'undefined' ? PARTY_UI : null;
const sabGuard = fn => function (c, t, a, s) { if (!SABU) return; const prev = SABU.target(c); try { fn(c, t, a, s); } finally { SABU.target(prev); } };
/* base on a shifted copy of the shape: `path()` builds the shape on the current context, the shade shows as a crescent on the (sx, sy) side */
function sabCel(c, path, base, shd, sx, sy, o) { path(); SABU.ink(shd, o); c.save(); path(); c.clip(); c.translate(-sx, -sy); c.fillStyle = base; c.fill(); c.restore(); }
const sabBlobs = [];
/* a lumpy unit blob (radius ~1), memoized per index: an ink splat */
function sabBlob(i) {
  if (sabBlobs[i]) return sabBlobs[i];
  const p = new Path2D(), n = 9, pts = [];
  for (let j = 0; j < n; j++) { const an = j / n * Math.PI * 2, r = .74 + SABU.hash(i * 31 + j) * .4; pts.push([Math.cos(an) * r, Math.sin(an) * r]); }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let j = 0; j < n; j++) { const q = pts[j], m = mid(q, pts[(j + 1) % n]); p.quadraticCurveTo(q[0], q[1], m[0], m[1]); }
  p.closePath(); return (sabBlobs[i] = p);
}
const sabPuffs = [];
/* a unit cartoon cloud (a flat-ish bottom, bumps on top), memoized per variant */
function sabPuff(v) {
  if (sabPuffs[v]) return sabPuffs[v];
  const p = new Path2D(), C = [[-.62, .1, .4], [-.3, -.2, .5], [.14, -.3, .58], [.55, -.02, .46], [.05, .16, .6], [-.25, .24, .46], [.38, .22, .42]], k = 1 + (v % 3) * .08;
  for (const [x, y, r] of C) { p.moveTo(x * k + r, y); p.arc(x * k, y, r, 0, Math.PI * 2); }
  return (sabPuffs[v] = p);
}
const SAB_INK = { base: '#2a1f4d', shade: '#170f2e', rim: '#8E7CC3' };
/* one ink splat: a drip first (so the blob covers where it leaves), then the lumpy body with a glint, a rim light and satellite droplets */
function sabSplat(c, i, x, y, r, t) {
  const U = SABU, sway = Math.sin(t * 2 + i) * 1.4;
  for (let d = 0; d < 1 + (i % 2); d++) {   // one or two drips that run down from the lower edge (the original length: 30 + up to 80 px)
    const dw = 6.5 + (i + d) % 3 * 1.5, dx = x + (d ? .5 : -.35 + U.hash(i + 40) * .5) * r * .6 + sway, L = (d ? 14 : 24) + Math.min(d ? 40 : 70, t * (d ? 24 : 40) + i * 6) + r * .45;
    U.rr(dx - dw, y, dw * 2, L, dw); c.moveTo(dx + dw * 1.35, y + L); c.arc(dx, y + L, dw * 1.35, 0, 7); U.ink(SAB_INK.base, 3);
    c.save(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(dx - dw * .45, y + r * .9); c.lineTo(dx - dw * .45, y + L - 4); c.stroke(); c.restore();
  }
  const p = sabBlob(i);
  c.save(); c.translate(x, y); c.scale(r, r); c.lineJoin = 'round'; c.lineWidth = 8 / r; c.strokeStyle = INK; c.stroke(p);
  c.fillStyle = SAB_INK.shade; c.fill(p); c.save(); c.clip(p); c.translate(-.13, -.2); c.fillStyle = SAB_INK.base; c.fill(p); c.restore();
  c.save(); c.clip(p);
  c.strokeStyle = SAB_INK.rim; c.globalAlpha *= .55; c.lineWidth = .1; c.beginPath(); c.arc(0, 0, .74, 1.0 * Math.PI, 1.55 * Math.PI); c.stroke(); c.globalAlpha /= .55;
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-.36, -.38, .27, .13, -.5, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-.05, -.58, .06, 0, 7); c.fill(); c.beginPath(); c.arc(.4, .36, .05, 0, 7); c.fill();
  c.restore(); c.restore();
  for (let j = 0; j < 6; j++) {
    const an = j * 1.05 + i, d = r * (1.28 + U.hash(i * 7 + j) * .24), rd = r * (.13 + U.hash(i * 9 + j) * .13), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d;
    U.el(px, py, rd, rd * .92); U.ink(SAB_INK.base, 2.5); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(px - rd * .3, py - rd * .35, rd * .26, 0, 7); c.fill();
  }
}
/* a soft fog cloud at (x, y), radius R; sleepy = a calm little face */
function sabCloud(c, x, y, R, v, sleepy) {
  const p = sabPuff(v);
  c.save(); c.translate(x, y); c.scale(R, R); c.lineJoin = 'round';
  c.lineWidth = 6 / R; c.strokeStyle = '#a3b3e6'; c.stroke(p);                 // far things get a coloured outline, not INK
  c.fillStyle = '#c7d4f5'; c.fill(p); c.save(); c.clip(p); c.translate(-.08, -.16); c.fillStyle = '#f6f8ff'; c.fill(p); c.restore();
  c.save(); c.clip(p); c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(-.3, -.36, .3, .12, -.35, 0, 7); c.fill(); c.restore();
  c.restore();
  if (sleepy) {
    c.save(); c.strokeStyle = '#6f80c4'; c.lineWidth = 3; c.lineCap = 'round';
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * R * .2, y + R * .02, R * .07, .15 * Math.PI, .85 * Math.PI); c.stroke(); }
    c.beginPath(); c.arc(x, y + R * .13, R * .045, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,140,170,.45)'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(x + sx * R * .34, y + R * .1, R * .08, R * .05, 0, 0, 7); c.fill(); }
    c.restore();
  }
}
let sabVigG = null;
const SAB_BUGC = [['#ff6a5a', '#b8283a'], ['#7fd34a', '#3f8f35'], ['#ffd23f', '#c99512'], ['#9fe3ff', '#3c6fb4'], ['#ff8fb8', '#c2477a']];
/* one cute inked bug seen from the front: wings that buzz, big eyes that look at the middle of the screen, antennae, spots */
function sabBug(c, x, y, i, T, vx) {
  const U = SABU, col = SAB_BUGC[i % SAB_BUGC.length], flap = Math.sin(T * 50 + i), lx = clamp0(400 - x) * .6, ly = clamp0(300 - y) * .6;
  c.save(); c.translate(x, y); c.rotate(Math.max(-.3, Math.min(.3, vx / 300)));
  c.fillStyle = 'rgba(20,16,28,.22)'; c.beginPath(); c.ellipse(3, 20, 11, 3.5, 0, 0, 7); c.fill();
  for (const sx of [-1, 1]) {      // wings
    c.save(); c.translate(sx * 10, -7); c.rotate(sx * (.55 + flap * .4)); U.el(sx * 6, -2, 11, 5.5); U.ink('rgba(255,255,255,.82)', 2); c.restore();
  }
  c.strokeStyle = INK; c.lineWidth = 3.2; c.lineCap = 'round';   // antennae
  for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 4, -10); c.quadraticCurveTo(sx * 9, -19, sx * 12 + Math.sin(T * 7 + i) * 2, -21); c.stroke(); U.el(sx * 12 + Math.sin(T * 7 + i) * 2, -22, 2.8, 2.8); U.ink(col[0], 1.8); }
  for (const sx of [-1, 1]) for (const k of [0, 1]) { c.beginPath(); c.moveTo(sx * 9, 6 + k * 5); c.lineTo(sx * 15, 9 + k * 5 + Math.sin(T * 14 + i + k) * 1.5); c.stroke(); }   // legs
  sabCel(c, () => U.el(0, 2, 13, 12), col[0], col[1], 3.5, 4.5, 3);
  c.save(); U.el(0, 2, 13, 12); c.clip();
  if (i % 5 === 2) { c.fillStyle = 'rgba(20,16,28,.78)'; for (const yy of [8, 13]) { U.rr(-14, yy, 28, 3.2, 1.5); c.fill(); } }   // a bee stripe
  else { c.fillStyle = 'rgba(20,16,28,.6)'; for (const [sx, sy] of [[-7, 9], [7, 10], [0, 14]]) { c.beginPath(); c.arc(sx, sy, 2.2, 0, 7); c.fill(); } }    // ladybug dots
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-6, -4, 4.2, 2.1, -.5, 0, 7); c.fill(); c.restore();
  for (const sx of [-1, 1]) {      // eyes
    U.el(sx * 5.2, -2, 4.6, 5); U.ink('#fff', 2);
    c.fillStyle = INK; c.beginPath(); c.ellipse(sx * 5.2 + lx * 1.6, -2 + ly * 1.8, 2.5, 2.8, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * 5.2 + lx * 1.6 - .8, -3.2 + ly * 1.8, 1, 0, 7); c.fill();
  }
  c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 5.5, 2.6, .15 * Math.PI, .85 * Math.PI); c.stroke();
  c.restore();
}
const clamp0 = v => Math.max(-1, Math.min(1, v / 300));
/* a pair of eyes that peek out of the dark: glow, big sclera, pupils that look toward the middle, blinks */
function sabEyes(c, x, y, r, k, T, al) {
  const U = SABU, dx = 400 - x, dy = 300 - y, d = Math.hypot(dx, dy) || 1, look = [dx / d * .8 + Math.sin(T * .9 + k) * .3, dy / d * .8], gap = r * 1.2;
  const g0 = c.globalAlpha; c.save();
  c.fillStyle = '#ffe9a0'; for (let q = 0; q < 3; q++) { c.globalAlpha = g0 * al * (.1 + q * .05); U.el(x, y, r * (3.6 - q * .9), r * (2.4 - q * .55)); c.fill(); }
  c.globalAlpha = g0 * al;
  U.eye(x - gap, y, r, k % 2 ? 'eager' : 'idle', look, T + k, 0); U.eye(x + gap, y, r, k % 2 ? 'eager' : 'idle', look, T + k, 1);
  c.strokeStyle = INK; c.lineWidth = r * .3; c.lineCap = 'round';
  for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(x + sx * gap - sx * r * .8, y - r * 1.5 - sx * r * .1 * (k % 2 ? -1 : 1)); c.lineTo(x + sx * gap + sx * r * .8, y - r * 1.5 + sx * r * .1 * (k % 2 ? -1 : 1)); c.stroke(); }
  c.restore();
}
const SAB_EYES = [[66, 480, 15], [738, 120, 13], [722, 514, 17], [92, 134, 12], [402, 566, 13]];
/* a spam pop-up item i: a window, a star, a heart, a chip or a smiley */
function sabSpamItem(c, i, T, col) {
  const U = SABU, k = i % 5;
  if (k === 0) { star(0, 0, 18, 8, 5, T + i, col, 3); c.save(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-5, -6, 3.4, 1.8, -.6, 0, 7); c.fill(); c.restore(); }
  else if (k === 1) { c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-22, -4, -11, -21, 0, -8); c.bezierCurveTo(11, -21, 22, -4, 0, 10); c.closePath(); U.ink(col, 3); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-8, -8, 3.6, 1.8, -.6, 0, 7); c.fill(); }
  else if (k === 2) { U.rr(-10, -7, 20, 14, 4); U.ink(col, 2.5); c.fillStyle = 'rgba(255,255,255,.4)'; U.rr(-7, -5, 14, 3, 1.5); c.fill(); }
  else if (k === 3) {
    U.rr(-21, -16, 42, 32, 6); U.ink('#fff', 3);
    c.save(); U.rr(-21, -16, 42, 32, 6); c.clip(); c.fillStyle = col; U.rr(-22, -17, 44, 11, 0); c.fill(); c.restore();
    c.fillStyle = INK; c.beginPath(); c.arc(-15, -11, 2, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(15, -11, 2.2, 0, 7); c.fill();
    U.text('!', 0, 5, 19, INK, 'center', 30);
  } else U.avatar(0, 0, 13, col, { t: T, mood: ['happy', 'eager', 'smug', 'happy'][(i / 5 | 0) % 4], seed: i, look: [Math.sin(T + i), .3] });
}
/* the big badge that pops when a sabotage lands on me (drawn inside the overlay so it follows the same screen as the hit) */
function sabHitBadge(fx) {
  const kind = fx.kind, age = fx.age;
  if (!SABU || kind.pop === false || age > 1.3) return;
  const prev = SABU.target(fx.c), k = SABU.outBack(age / .25), fade = SABU.clamp((1.3 - age) / .4, 0, 1);
  try { fx.c.save(); fx.c.globalAlpha = fade; SABU.badge(kind.label, 400, 250, 40, kind.col, '#fff', k, (SABU.hash(Math.floor((fx.s.seed || 0) * 7)) - .5) * .14); fx.c.restore(); } finally { SABU.target(prev); }
}
/* Every kind draws in the 800x600 space of whatever it covers (the actor's television or a helper's whole screen), 3 to 4 seconds, never touches input
   (flip mirrors the pointer and the arrow keys so the game stays playable).
     pre(ctx, t, a, s)   optional: transform the view before the game is drawn (shake, flip)
     draw(ctx, t, a, s)  optional: overlay after the game; t = seconds since it landed, a = fade envelope 0..1, s.seed = per-hit random
     full                a helper (who plays no microgame) gets it over the whole screen; otherwise only over the television
     tvOnly              it means nothing to a helper, so it is never thrown at one
     ghost               a ghost (or a finished VERSUS player) may throw it: it never blocks the input, it only makes the picture harder to read
     pop                 false = no label badge on landing (the picture is mirrored, so a badge would be too); the channel shouts it with floatText instead */
const SAB_KINDS = {
  /* ink splats pop in with a bounce, glint and drip down the screen */
  ink: { id: 'ink', label: 'INK!', icon: '🖋', col: '#8E7CC3', life: 3.4, full: true, ghost: true, draw: sabGuard((c, t, a, s) => {
    for (let i = 0; i < 6; i++) {
      const x = 110 + (s.seed * 37 + i * 173) % 580, y = 90 + (s.seed * 91 + i * 131) % 420, r = 38 + (i * 13) % 30, g = SABU.outBack((t - i * .04) / .3);
      if (g > .02) sabSplat(c, i, x, y, r * g, t);
    }
  }) },
  /* a pale veil and drifting, sleepy clouds */
  fog: { id: 'fog', label: 'FOG!', icon: '🌫', col: '#E8EEFF', life: 3.4, full: true, draw: sabGuard((c, t, a, s) => {
    SABU.rr(-2, -2, W + 4, H + 4, 0); c.fillStyle = 'rgba(232,238,255,.8)'; c.fill();
    for (let i = 0; i < 9; i++) {
      const R = 82 + SABU.hash(i * 5 + 1) * 34, x = (i * 120 + now * 40) % 900 - 50, y = 80 + (i * 67) % 460 + Math.sin(now * .9 + i) * 8;
      c.save(); c.globalAlpha *= .94; sabCloud(c, x, y, R, i, i % 4 === 0); c.restore();
    }
  }) },
  /* the lights go out: a night veil with darker corners and curious eyes that peek in from the edges */
  dark: { id: 'dark', label: 'DARK!', icon: '🌑', col: '#6C6A99', life: 3.4, full: true, draw: sabGuard((c, t, a) => {
    const g = c.globalAlpha;
    SABU.rr(-2, -2, W + 4, H + 4, 0); c.fillStyle = 'rgba(8,6,20,' + ((.62 + Math.sin(now * 3) * .2) * .88).toFixed(3) + ')'; c.fill();   // the veil is trimmed by the vignette's share, so no pixel gets darker than the old .42-.82 veil
    if (!sabVigG) { sabVigG = c.createRadialGradient(400, 300, 190, 400, 300, 520); sabVigG.addColorStop(0, 'rgba(8,6,20,0)'); sabVigG.addColorStop(1, 'rgba(8,6,20,.16)'); }
    c.globalAlpha = g; SABU.rr(-2, -2, W + 4, H + 4, 0); c.fillStyle = sabVigG; c.fill();
    SAB_EYES.forEach(([x, y, r], k) => sabEyes(c, x + Math.sin(now * .7 + k * 2) * 7, y + Math.cos(now * .6 + k) * 5, r, k, now, SABU.ease((t - .35 - k * .3) / .4)));
  }) },
  /* a swarm of cute buzzing bugs */
  bugs: { id: 'bugs', label: 'BUGS!', icon: '🪰', col: '#9fe3ff', life: 3.4, full: true, ghost: true, draw: sabGuard((c, t, a, s) => {
    for (let i = 0; i < 16; i++) {
      const x = (s.seed * 50 + i * 57 + Math.sin(now * (1.5 + i % 3) + i) * 90 + 800) % 800, y = (i * 83 + Math.cos(now * (1.2 + i % 4) + i) * 70 + 600) % 600;
      sabBug(c, x, y, i, now, Math.cos(now * (1.5 + i % 3) + i) * 90 * (1.5 + i % 3));
    }
  }) },
  /* the picture jitters and sways; for a helper the whole screen does (buttons move a few px, they stay hittable). Little speed marks shiver at the edges */
  shake: { id: 'shake', label: 'SHAKE!', icon: '📳', col: '#FF9A3D', life: 3.6, full: true, ghost: true, pre(ctx, t, a) {
    const k = 3 + 7 * a;
    ctx.translate(W / 2, H / 2); ctx.rotate(Math.sin(t * 43) * .018 * a); ctx.translate(-W / 2 + Math.sin(t * 61) * k + Math.sin(t * 29) * k * .5, -H / 2 + Math.cos(t * 53) * k * .7);
  }, draw: sabGuard((c, t, a) => {
    c.lineCap = 'round';
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = sx < 0 ? 14 : W - 14, y = 170 + i * 130, j = Math.sin(t * 40 + i * 2) * 4 * a;
      for (const [w, col, dr] of [[12, INK, 0], [6, i % 2 ? '#FFE14D' : '#FF9A3D', 0], [10, INK, 14], [4.5, '#FF9A3D', 14]]) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.arc(x - sx * (20 + dr) + j * sx, y, 28 + dr, sx < 0 ? -.3 * Math.PI : .7 * Math.PI, sx < 0 ? .3 * Math.PI : 1.3 * Math.PI); c.stroke(); }
    }
  }) },
  /* the television turns around like a card and everything is mirrored; the actor's pointer and arrow keys are mirrored too (sabMirrored) so it stays fair.
     The frame is symmetric so mirroring cannot hurt it; the label badge is left to floatText (a mirrored badge would read backwards) */
  flip: { id: 'flip', label: 'MIRROR!', icon: '🔄', col: '#B49CFF', life: 4, tvOnly: true, pop: false, mirrored: a => a > .5, pre(ctx, t, a) {
    ctx.translate(W / 2, H / 2); ctx.scale(Math.cos(Math.PI * a), 1); ctx.translate(-W / 2, -H / 2);
  }, draw: sabGuard((c, t, a) => {
    const g = c.globalAlpha, pu = .5 + .5 * Math.sin(now * 8);
    SABU.rr(8, 8, W - 16, H - 16, 22); c.lineJoin = 'round';
    c.lineWidth = 20; c.strokeStyle = INK; c.stroke(); c.lineWidth = 12; c.strokeStyle = '#B49CFF'; c.globalAlpha = g * (.55 + .3 * pu); c.stroke();
    c.globalAlpha = g * .8; c.lineWidth = 3; c.strokeStyle = '#fff'; SABU.rr(14, 14, W - 28, H - 28, 17); c.setLineDash([26, 40]); c.lineDashOffset = -now * 40; c.stroke(); c.setLineDash([]);
    c.globalAlpha = g;
    for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) {   // two arrows that swap places: the same picture when mirrored
      c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
      for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(-sx * 9, sx * -5 + 5); c.lineTo(sx * 9, sx * -5 + 5); c.moveTo(sx * 9 - sx * 6, sx * -5 + 5 - 5); c.lineTo(sx * 9, sx * -5 + 5); c.lineTo(sx * 9 - sx * 6, sx * -5 + 5 + 5); c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); }
      c.restore();
    }
  }) },
  /* what is under it is re-drawn as big blocks: shapes stay guessable, details do not. Chunky inked chips drift down the sides */
  pixel: { id: 'pixel', label: 'PIXELS!', icon: '👾', col: '#4DB8FF', life: 3.6, full: true, ghost: true, draw: sabGuard((c, t, a) => {
    const b = 3 + Math.round(a * 3), m = c.getTransform(), tw = Math.ceil(W / b), th = Math.ceil(H / b), buf = sabBuf(), bx = buf.getContext('2d');
    bx.imageSmoothingEnabled = true; bx.clearRect(0, 0, buf.width, buf.height);
    bx.drawImage(cv, m.e, m.f, Math.round(W * m.a), Math.round(H * m.d), 0, 0, tw, th);
    c.globalAlpha = 1; c.imageSmoothingEnabled = false; c.drawImage(buf, 0, 0, tw, th, 0, 0, tw * b, th * b); c.imageSmoothingEnabled = true;
    for (let i = 0; i < 10; i++) {
      const left = i % 2 === 0, x = left ? 10 + SABU.hash(i) * 14 : W - 34 - SABU.hash(i) * 14, y = (i * 71 + t * (40 + i * 7)) % 640 - 20, col = ['#4DB8FF', '#B49CFF', '#5CFF7A', '#FF4D9E'][i % 4], sz = 14 + i % 3 * 4;
      c.save(); c.globalAlpha = a; c.translate(x + sz / 2, y + sz / 2); c.rotate(Math.floor(t * 2 + i) * Math.PI / 2);
      SABU.rr(-sz / 2, -sz / 2, sz, sz, 3); SABU.ink(SABU.shade(col, .25), 2.5); c.save(); SABU.rr(-sz / 2, -sz / 2, sz, sz, 3); c.clip(); c.fillStyle = col; SABU.rr(-sz / 2 - 3, -sz / 2 - 3, sz, sz, 2); c.fill(); c.restore();
      c.fillStyle = 'rgba(255,255,255,.6)'; SABU.rr(-sz / 2 + 2.5, -sz / 2 + 2.5, sz * .35, 3, 1.5); c.fill(); c.restore();
    }
  }) },
  /* a hail of fake rewards and pop-ups: harmless, only there to steal the eyes (nothing here is clickable and none of it is gold) */
  spam: { id: 'spam', label: 'SPAM!', icon: '🎉', col: '#FF4D9E', life: 3.8, full: true, ghost: true, draw: sabGuard((c, t, a, s) => {
    for (let i = 0; i < 20; i++) {
      const x = (s.seed * 53 + i * 91 + Math.sin(t * (1.1 + i % 4 * .4) + i) * 60 + 1600) % 860 - 30, y = (s.seed * 29 + i * 67 + t * (70 + (i * 37) % 90)) % 680 - 40, col = SAB_SPAM[i % SAB_SPAM.length];
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2 + i) * .4); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 3; c.fillStyle = col;
      sabSpamItem(c, i, t, col);
      c.restore();
    }
  }) },
};
const SAB_IDS = Object.keys(SAB_KINDS);
/* one hit: when it landed, who threw it and a random seed so every ink splat or bug swarm differs */
const sabMake = (k, name, soft) => ({ k, at: now, name: name || '', seed: Math.random() * 100, life: SAB_KINDS[k].life * (soft ? SAB_SOFT.life : 1), str: soft ? SAB_SOFT.str : 1 });
const sabLive = s => !!s && SAB_KINDS[s.k] !== undefined && now - s.at <= s.life;
const sabEnvelope = s => Math.max(0, Math.min(1, (now - s.at) / .25, (s.life - (now - s.at)) / .6)) * (s.str || 1);
const sabMirrored = s => !!s && sabLive(s) && !!SAB_KINDS[s.k].mirrored && SAB_KINDS[s.k].mirrored(sabEnvelope(s));
const SAB_SWAP = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft', KeyA: 'KeyD', KeyD: 'KeyA', a: 'd', d: 'a', A: 'D', D: 'A' };
const sabMirrorKey = d => Object.assign({}, d, { code: SAB_SWAP[d.code] || d.code, key: SAB_SWAP[d.key] || d.key });
/* Render protocol. `where`: 'view' = the actor's television (every kind), 'tv' = a helper's television (kinds without `full`),
   'full' = a helper's whole screen, called first thing in the frame (kinds with `full`). Always pair sabBegin with sabEnd; both accept null. */
function sabBegin(s, c, where) {
  if (!sabLive(s)) return null;
  const kind = SAB_KINDS[s.k];
  if (where !== 'view' && (where === 'full') !== !!kind.full) return null;
  const fx = { s, kind, c, age: now - s.at, a: sabEnvelope(s) };
  c.save();
  if (kind.pre) sabTry(() => kind.pre(c, fx.age, fx.a, s));
  return fx;
}
function sabEnd(fx) {
  if (!fx) return;
  if (fx.kind.draw) { fx.c.save(); fx.c.globalAlpha = fx.a; sabTry(() => fx.kind.draw(fx.c, fx.age, fx.a, fx.s)); fx.c.restore(); }
  sabTry(() => sabHitBadge(fx));
  fx.c.restore();
}

/* ───────────── charge economy ───────────── */
/* One factory, every mode picks its numbers: { max: 3, every: 6 (s per free charge), trap: 1 (per trap success), comboEvery: 10, combo: 1, cooldown: 3 (s between sends) } */
function createSabCharges(cfg = {}) {
  const k = Object.assign({ max: 3, every: 6, trap: 1, comboEvery: 10, combo: 1, cooldown: 3 }, cfg);
  const c = { n: 0, max: k.max, clock: 0, cd: 0, cfg: k };
  const add = v => { c.n = Math.min(k.max, c.n + v); };
  c.tick = dt => { c.cd = Math.max(0, c.cd - dt); c.clock += dt; if (c.clock > k.every) { c.clock = 0; add(1); } };
  /* 'trap': a trap minigame was won; 'combo': pass the running streak, a charge drops every `comboEvery`th tap. Returns true when the reward fired (even if already full) so the caller can celebrate. */
  c.earn = (src, streak) => {
    if (src === 'trap') { add(k.trap); return true; }
    if (src === 'combo' && streak > 0 && streak % k.comboEvery === 0) { add(k.combo); return true; }
    return false;
  };
  c.ready = () => c.n > 0 && c.cd <= 0;
  c.spend = () => { if (!c.ready()) return false; c.n--; c.cd = k.cooldown; return true; };
  return c;
}

/* ───────────── pop-ups: "X SABOTEA A Y" toasts and thrown-kind badges ───────────── */
/* A pop is a short banner that is drawn by sabPopsDraw() from the UI the player already has on screen (sabStrip, sabPicker, sabOrbs, and createIdleTraps().draw, which the ghost and wait screens call every frame), once per frame, in screen space.
   A screen that draws none of those can call sabPopsDraw() itself. If nobody drew a pop within ~120 ms it falls back to floatText, so a message is never lost.
   p: { kind: 'toast' | 'badge', label, col, x, y, from, to (player colours), size, life } */
const sabPops = [];
let sabPopStamp = -1;
function sabPop(p) {
  if (!SABU) { floatText(p.label, p.x, p.y, p.col, p.kind === 'badge' ? 44 : 20); return; }   // no art kit: the plain floating word
  p.at = now; p.life = p.life || 1.5; p.seen = false; sabPops.push(p); if (sabPops.length > 5) sabPops.shift();
  if (typeof setTimeout === 'function') setTimeout(() => { if (!p.seen) { p.dead = true; sabTry(() => floatText(p.label, p.x, p.y, p.col, p.kind === 'badge' ? 44 : 20)); } }, 120);
}
function sabPopsDraw() {
  if (!SABU || sabPopStamp === now) return;
  sabPopStamp = now;
  for (let i = sabPops.length - 1; i >= 0; i--) {
    const p = sabPops[i], age = now - p.at;
    if (p.dead || age > p.life) { sabPops.splice(i, 1); continue; }
    p.seen = true;
    const k = Math.min(1, age / .25), a = SABU.clamp((p.life - age) / .3, 0, 1);
    if (p.kind === 'badge') { ctx.save(); ctx.globalAlpha = a; SABU.badge(p.label, p.x, p.y - SABU.ease(age / p.life) * 24, p.size || 36, p.col, '#fff', SABU.outBack(k), -.05); ctx.restore(); }
    else SABU.toast(p.x, p.y - SABU.ease(age / p.life) * 18, p.label, p.col, { k, a, from: p.from, to: p.to, size: p.size || 18, t: now });
  }
}

/* ───────────── send / receive + UI ───────────── */
/* o: { charges, actorId (so nothing is thrown at a helper that would not notice it), ghost (I am an eliminated player haunting the living: only `ghost` kinds, only at living
   players who are still playing), wait (I finished my VERSUS microgame and wait: the same soft kinds, only at players who have not finished), onSend(kind, targetId)
   (replaces the default toast), onHit(state, fromId) }.
   ch.state is the sabotage currently on me; read it through ch.active() so expired hits clear themselves. */
function createSabChannel(R, relay, o = {}) {
  const ch = { charges: o.charges, idx: 0, state: null, last: '' };
  const room = () => party.room && party.room.id === R.id ? party.room : R, haunts = () => SAB_GHOST_MODES.includes(R.mode), races = () => SAB_RACE_MODES.includes(R.mode), soft = !!(o.ghost || o.wait);
  ch.targets = () => room().players.filter(p => !p.left && p.id !== party.you.id && (!o.ghost || p.lives > 0) && (!soft || !(room().cur && room().cur[p.id])));
  ch.target = () => { const l = ch.targets(); return l.length ? l[ch.idx % l.length] : null; };
  ch.next = () => { ch.idx++; };
  ch.pick = to => {
    const ids = SAB_IDS.filter(k => k !== ch.last && !(SAB_KINDS[k].tvOnly && o.actorId && to !== o.actorId) && (!soft || SAB_KINDS[k].ghost));
    return ids[Math.floor(Math.random() * ids.length)];
  };
  ch.send = id => {
    if (!(SAB_MODES.includes(R.mode) || o.ghost && haunts() || o.wait && races()) || !ch.charges.ready()) return false;
    const list = ch.targets(), to = typeof id === 'string' ? id : list.length ? list[ch.idx % list.length].id : '';
    if (!to || !list.some(p => p.id === to)) return false;
    ch.charges.spend(); ch.idx++; const k = ch.last = ch.pick(to);
    relay.send('sab', { k, to });
    if (o.onSend) sabTry(() => o.onSend(k, to)); else sabTry(() => { sfx.whoosh(true); if (SABU) sabPop({ kind: 'badge', label: 'SABOTAGE SENT!', col: '#FF9A3D', x: 300, y: 300, size: 30 }); else floatText('SABOTAGE SENT!', 300, 300, '#FF9A3D', 30); });
    return true;
  };
  ch.receive = (type, data, from) => {
    if (type !== 'sab' || !data || !SAB_IDS.includes(data.k) || typeof data.to !== 'string') return false;
    const cur = room(), pl = cur.players.find(p => p.id === from), tg = cur.players.find(p => p.id === data.to), mine = cur.players.find(p => p.id === party.you.id);
    if (haunts()) { if (!pl || !(pl.lives <= 0) || !SAB_KINDS[data.k].ghost || data.to === party.you.id && mine && !(mine.lives > 0)) return false; }   // only a ghost throws here, and only at the living
    else if (races()) { if (!pl || !SAB_KINDS[data.k].ghost) return false; }   // the server already checked that the thrower has finished and I have not; the room copy here may lag behind
    else if (!SAB_MODES.includes(cur.mode)) return false;
    if (data.to === party.you.id && from !== party.you.id) {
      if (!soft && sabLive(ch.state)) return true;   // never restart a hit that is still on me: the server spaces them out, this keeps a late or duplicated one from chaining overlays
      ch.state = sabMake(data.k, pl ? pl.name : '', haunts() || races());
      sabTry(() => { sfx.whoosh(false); shake(5, .3); if (!SABU || SAB_KINDS[data.k].pop === false) floatText(SAB_KINDS[data.k].label, 400, 250, SAB_KINDS[data.k].col, 40); });   // the label is a badge drawn by sabEnd (floatText only without the kit or on a mirrored picture)
      if (o.onHit) o.onHit(ch.state, from);
    } else if (from !== party.you.id) sabTry(() => sabPop({ kind: 'toast', label: t('{a} SABOTAGES {b}!', { a: pl ? pl.name : '', b: tg ? tg.name : '' }), col: '#FF9A3D', x: 300, y: 340, from: pl && pl.color, to: tg && tg.color, size: 18 }));
    return true;
  };
  ch.active = () => { if (ch.state && !sabLive(ch.state)) ch.state = null; return ch.state; };
  return ch;
}
/* Direct to the server, not through the DUO input queue: a late sabotage is worse than a lost one (the players of VERSUS / TEAM / SURVIVAL are not in a DUO round, so there is
   no queue to wait for). A refused throw (the target just finished, a rate limit) gives the charge back: mine(R) returns the kit's charges if its room and round are still this
   one. 403 (not in the round) and 0 (offline) do not refund. */
function sabSendDirect(type, data, mine) {
  const R = party.room; if (!R) return;
  pcall('sig', Object.assign(auth(), { round: R.round, m: [sigStamp({ t: type, d: data })] })).then(r => {
    const c = mine(R);
    if (r.status === 404) roomGone();
    else if (!r.ok && c && r.status !== 0 && r.status !== 403) c.n = Math.min(c.max, c.n + 1);
  });
}
/* A relay-shaped sender for createSabChannel that goes straight to the server (sabSendDirect) instead of the DUO input queue, so a refused throw (rate limit, the round just
   ended) hands the charge back instead of retrying the whole batch. mine(R) returns the charges to refund while R is still the kit's room and round, else null. */
const sabDirectRelay = mine => ({ send: (type, data) => sabSendDirect(type, data, mine) });
/* The kit of a thrower who watches somebody else's game on a viewer whose middle is (250, 280) (ghosts and finished VERSUS players): the viewer flashes in the
   sabotage's colour, the thrower lunges and a toast says who hit whom. k = the thrower's kit { flash, lunge, hits }. */
function sabThrownFx(k, kind, to) {
  const R = party.room, kd = SAB_KINDS[kind], tg = R && R.players.find(p => p.id === to);
  k.flash = { k: kind, at: now, to }; k.lunge = 1; if (tg) k.hits[to] = now;
  sfx.whoosh(true); shake(4, .22); ring(250, 280, kd.col, 160, .5); burst(250, 280, kd.col, 22, 420);
  sabPop({ kind: 'badge', label: kd.label, col: kd.col, x: 250, y: 236, size: 40 });
  if (tg) sabPop({ kind: 'toast', label: t('{a} SABOTAGES {b}!', { a: me().name, b: tg.name }), col: '#FF9A3D', x: 250, y: 300, from: me().color, to: tg.color, size: 17 });
}
/* A compact plate for the small buttons of the sabotage UI: the same slab with depth as PARTY_UI.plate (base under, face on top, gloss, 3 px ink) scaled to fit inside its
   own hit rectangle (x, y, w, h): the face sinks when pressed, lightens on hover, goes grey when off. Returns the y of the face's middle for the label / icon. */
function sabPlate(x, y, w, h, col, o = {}) {
  const U = SABU, dep = Math.max(3, Math.min(6, Math.round(h * .2))), r = Math.min(11, h * .42), fh = h - dep, fy = y + dep - (o.down ? dep - 1.5 : dep);
  const face = o.off ? '#d3cfe0' : o.hover ? U.lite(col, .16) : col, base = o.off ? '#8f88a6' : U.shade(col, .3);
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,28,.24)'; U.rr(x + 2, y + dep + 4, w, fh, r); ctx.fill();
  U.rr(x, y + dep, w, fh, r); U.ink(base, 3);
  U.rr(x, fy, w, fh, r); U.ink(face, 3);
  ctx.fillStyle = o.off ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.3)'; U.rr(x + 5, fy + 2.5, w - 10, Math.max(3, fh * .2), 2); ctx.fill();
  if (o.lit && !o.off) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.globalAlpha *= .45 + .45 * Math.sin(now * 10); U.rr(x + 4, fy + 4, w - 8, fh - 8, Math.max(3, r - 3)); ctx.stroke(); }
  ctx.restore();
  return fy + fh / 2 + 1;
}
/* button(x, y, w, h, label, fn, { size, fill }) drawn as a plate. Same hit rectangle and handler as button(); o.icon(cx, cy) draws on the face, o.lit pulses a ring,
   fill '#d3cfe0' means disabled (grey, dimmed label). Without the kit it IS button(). */
function sabBtn(x, y, w, h, label, fn, o = {}) {
  if (!SABU) { button(x, y, w, h, label, fn, o); return; }
  const off = o.fill === '#d3cfe0', hv = typeof hovered === 'function' && hovered(x, y, w, h), dn = hv && typeof pressing !== 'undefined' && !!pressing;
  const cy = sabPlate(x, y, w, h, off ? '#d3cfe0' : (o.fill || '#fff'), { down: dn, hover: hv && !off, off, lit: o.lit });
  if (o.icon) o.icon(x + w / 2, cy);
  if (label) { ctx.save(); if (off) ctx.globalAlpha *= .62; SABU.text(label, x + w / 2, cy, o.size || 26, off ? '#14101c' : (o.fg || '#fff'), 'center', w - 14); ctx.restore(); }
  btns.push({ x, y, w, h, fn });
}
/* one button per rival along the bottom (cards table, the actor's screen) */
function sabStrip(ch, y = 567) {
  const list = ch.targets(), ready = ch.charges.ready(), w = Math.min(190, 570 / Math.max(1, list.length));
  list.forEach((p, i) => sabBtn(16 + i * w, y, w - 6, 26, t('SABOTAGE {name}', { name: p.name }), () => ch.send(p.id), { size: 13, fill: ready ? p.color : '#d3cfe0' }));
  sabOrbs(ch.charges, 692, y + 13, { r: 8, gap: 22 });
  sabPopsDraw();
}
/* compact picker for a side panel: tap the name to change target, tap the big button to throw */
function sabPicker(ch, x = 492, y = 414, w = 96) {
  const ready = ch.charges.ready(), tg = ch.target();
  if (tg) sabBtn(x, y, w, 20, tg.name, () => ch.next(), { size: 11, fill: tg.color, icon: SABU && ((cx, cy) => { ctx.save(); ctx.translate(x + w - 9, cy); ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(3, 0); ctx.lineTo(-3, 4); ctx.closePath(); SABU.ink('#fff', 1.6); ctx.restore(); }) });
  sabBtn(x, y + 22, w, 28, ready ? 'SABOTAGE!' : '', () => ch.send(), { size: 12, fill: ready ? '#FF9A3D' : '#d3cfe0', lit: ready });
  if (!ready) sabOrbs(ch.charges, x + w / 2, y + 36, { r: 7, gap: 22 });   // charging: the orbs fill up instead of a number
  sabPopsDraw();
}
/* the charges as glossy inked orbs, no numbers: full ones breathe (the next throw pulses), the next one shows its recharge ring, the rest are empty sockets.
   Centred on (cx, cy). o: { r: 13, gap, col, pulse (time of the last gain: the full orbs pop) } */
function sabOrbs(c, cx, cy, o = {}) {
  const r = o.r || 13, gap = o.gap || r * 2.5, col = o.col || '#FF9A3D', pop = o.pulse !== undefined && now - o.pulse < .5 ? 1 + (1 - (now - o.pulse) / .5) * .4 : 1;
  if (!SABU) { for (let i = 0; i < c.max; i++) circ(cx + (i - (c.max - 1) / 2) * gap, cy, r * (i < c.n ? pop : 1), i < c.n ? col : '#14101c', 3); return; }
  const ready = c.ready();
  for (let i = 0; i < c.max; i++) {
    const x = cx + (i - (c.max - 1) / 2) * gap, full = i < c.n, next = i === c.n;
    if (full) SABU.orb(x, cy, r * pop, { col, t: now, seed: i * .9, state: ready && i === c.n - 1 ? 'pulse' : 'full' });
    else {
      SABU.orb(x, cy, r, { col, state: 'empty', t: now });
      if (next && c.cfg) {   // the recharge ring fills clockwise inside the socket
        const f = Math.min(1, c.clock / c.cfg.every), a0 = -Math.PI / 2;
        if (f > .02) { ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, cy, r * .56, a0, a0 + Math.PI * 2 * f); ctx.lineWidth = r * .52 + 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = r * .52; ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); }
      }
    }
  }
  sabPopsDraw();
}
/* the idle panel of the traps ("HEADS UP!" / what to do): a rounded slab in the trap-panel colours. A host that draws its own idle panel can call this instead of box(). */
function sabIdlePanel(mx, y, mw, o = {}) { if (SABU) sabSlab(mx, y, mw, o.h || 88, 14, o.col || '#322d52', 3); else box(mx, y, mw, o.h || 88, o.col || '#322d52', 3); }
/* "HEADS UP!": a danger badge that breathes and wiggles. Centred on (cx, cy). */
function sabHeadsUp(cx, cy, size = 22, maxW = 330) { if (SABU) SABU.badge('HEADS UP!', cx, cy, size, '#ff4d5e', '#fff', 1 + Math.sin(now * 14) * .05, Math.sin(now * 9) * .05, maxW); else { ctx.globalAlpha = .5 + .5 * Math.sin(now * 16); txt('HEADS UP!', cx, cy, size + 4, '#FF4D5E', 'center', maxW); ctx.globalAlpha = 1; } }

/* ───────────── idle traps ───────────── */
/* a trap panel: a rounded slab with a drop shadow, a darker crescent along the bottom and a gloss strip */
function sabSlab(x, y, w, h, r, col, o = 3) {
  const U = SABU;
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,28,.3)'; U.rr(x + 3, y + 7, w, h, r); ctx.fill();
  U.rr(x, y, w, h, r); U.ink(U.shade(col, .32), o);
  ctx.save(); U.rr(x, y, w, h, r); ctx.clip(); ctx.fillStyle = col; U.rr(x - 2, y - 3, w + 4, h - 3, r); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; U.rr(x + 12, y + 5, w - 24, 5, 2.5); ctx.fill();
  ctx.restore();
}
/* a rounded progress bar: dark track, coloured fill with a glint, faint notches (one per step) */
function sabBar(x, y, w, h, frac, col, steps) {
  const U = SABU; ctx.save();
  U.rr(x, y, w, h, h / 2); U.ink('#1d1830', 3);
  ctx.save(); U.rr(x, y, w, h, h / 2); ctx.clip();
  if (frac > .001) { ctx.fillStyle = U.shade(col, .3); U.rr(x, y, Math.max(h, w * frac), h, h / 2); ctx.fill(); ctx.fillStyle = col; U.rr(x, y - 2, Math.max(h, w * frac), h - 2, h / 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.55)'; U.rr(x + 4, y + 1.5, Math.max(h, w * frac) - 8, 2.5, 1.2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(20,16,28,.35)'; ctx.lineWidth = 2; for (let i = 1; i < steps; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / steps, y); ctx.lineTo(x + w * i / steps, y + h); ctx.stroke(); }
  ctx.restore(); ctx.restore();
}
/* a red valve wheel with three spokes; ang turns it */
function sabValve(cx, cy, r, ang) {
  const c = ctx; c.save(); c.translate(cx, cy); c.rotate(ang); c.lineCap = 'round';
  c.fillStyle = 'rgba(20,16,28,.28)'; c.beginPath(); c.ellipse(2, r + 4, r * .9, r * .28, 0, 0, 7); c.fill();
  for (const [w, col] of [[7, INK], [3.4, '#ff6b78']]) {
    c.strokeStyle = col; c.lineWidth = w + (w > 5 ? r * .5 : r * .22); c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(0, 0); c.lineTo(Math.cos(i * 2.094) * r, Math.sin(i * 2.094) * r); } c.stroke();
  }
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.lineWidth = r * .5 + 6; c.strokeStyle = INK; c.stroke(); c.lineWidth = r * .5; c.strokeStyle = '#ff4d5e'; c.stroke();
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(0, 0, r, 1.1 * Math.PI, 1.5 * Math.PI); c.stroke();
  c.beginPath(); c.arc(0, 0, r * .3, 0, 7); SABU.ink('#ffd23f', 2); c.restore();
}
/* the pesky fly on the pump line: buzzing wings, big eyes that follow the swatter (the middle), tiny legs */
function sabFly(x, y, age, seed) {
  const U = SABU, c = ctx, vx = Math.cos(age * 3.1 + seed) * 140 * 3.1 + Math.cos(age * 9) * 12 * 9, flap = Math.sin(now * 60);
  c.save(); c.translate(x, y); c.scale(1.15, 1.15); c.rotate(Math.max(-.35, Math.min(.35, vx / 900)));
  c.fillStyle = 'rgba(20,16,28,.22)'; c.beginPath(); c.ellipse(2, 17, 9, 3, 0, 0, 7); c.fill();
  c.strokeStyle = INK; c.lineWidth = 2.6; c.lineCap = 'round';
  for (const sx of [-1, 1]) for (const k of [0, 1]) { c.beginPath(); c.moveTo(sx * 7, 5 + k * 3); c.lineTo(sx * 12, 10 + k * 3 + Math.sin(now * 20 + k) * 1.2); c.stroke(); }
  for (const sx of [-1, 1]) { c.save(); c.translate(sx * 6, -6); c.rotate(sx * (.6 + flap * .35)); U.el(sx * 8, -3, 12, 5.5); U.ink('rgba(255,255,255,.85)', 2); c.restore(); }
  sabCel(c, () => U.el(0, 1, 11, 10), '#5a5470', '#2c2740', 3, 4, 3);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-4, -3, 3.6, 1.8, -.5, 0, 7); c.fill();
  for (const sx of [-1, 1]) {
    U.el(sx * 5, -3, 4.6, 5); U.ink('#fff', 2); c.fillStyle = INK; c.beginPath(); c.ellipse(sx * 5 - sx * .4, -2.4, 2.4, 2.8, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * 5 - 1.2, -3.6, 1, 0, 7); c.fill();
  }
  c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 4, 2.4, .15 * Math.PI, .85 * Math.PI); c.stroke();
  c.restore();
}
/* a chunky rounded arrow (d: 0 left, 1 up, 2 right) centred on (x, y) */
function sabArrow(x, y, d, fill, k = 1) {
  const c = ctx; c.save(); c.translate(x, y); c.scale(k, k); c.lineJoin = 'round'; c.beginPath();
  if (d === 0) { c.moveTo(10, -11); c.lineTo(-11, 0); c.lineTo(10, 11); } else if (d === 1) { c.moveTo(-11, 10); c.lineTo(0, -12); c.lineTo(11, 10); } else { c.moveTo(-10, -11); c.lineTo(11, 0); c.lineTo(-10, 11); }
  c.closePath(); c.lineWidth = fill === INK ? 4 : 7; c.strokeStyle = INK; c.stroke(); c.fillStyle = fill; c.fill();
  if (fill !== INK) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(d === 0 ? 2 : d === 1 ? -3 : -3, d === 1 ? 0 : -4, 1.8, 0, 7); c.fill(); }
  c.restore();
}
/* the idle panel pulses a danger rim when the next trap is about to land (drawn under whatever the host puts in the panel) */
function sabAlarmRim(mx, y, mw) {
  const p = .5 + .5 * Math.sin(now * 14), c = ctx; c.save(); c.lineJoin = 'round';
  const top = y - 4, bot = Math.min(y + 92, Math.max(552, y + 88));   // hugs the 88-high host panel; never grows into the bottom HUD strip beyond what the panel already covers
  SABU.rr(mx - 4, top, mw + 8, bot - top, 17); c.lineWidth = 7; c.strokeStyle = INK; c.globalAlpha *= .55 + .45 * p; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#ff4d5e'; c.stroke();
  c.restore();
}

/* Mini-games thrown at a player who is just waiting (a pumper): a stuck valve (wiggle), gold bubbles (some fake), a stop-in-the-green dial, an arrow
   sequence and a fly that swallows half the taps. Winning the bubble, dial or sequence gives TURBO (x2 for a few seconds) and calls o.onReward(type).
   Layout is a 362x88 panel; coordinates below are written for the panel at y = 492 and moved with Y().
   o: { at: {x, y} (where the sparks go), first: [min, span] s before the first trap, gap: [min, span] between traps, weights: {fly, jam, bubble, dial, seq} (0 = off), onReward(type),
        words: {bubble, dial, seq, over} the pop-up shouted on a win / a missed dial (a ghost has no pump, so no TURBO) }
   The host keeps its own pump button: ask gate() before counting a tap (0 = swallowed, 1 or 2 = air) and read stuck() / shaking() / turboOn() / soon() to dress it. */
function createIdleTraps(o = {}) {
  const at = o.at || { x: 400, y: 534 }, first = o.first || [1.2, 1.3], gap = o.gap || [2.2, 2.2];
  const wt = Object.assign({ fly: .18, jam: .2, bubble: .2, dial: .22, seq: .2 }, o.weights), words = Object.assign({ bubble: 'TURBO!', dial: 'PERFECT! TURBO', seq: 'COMBO! TURBO', over: 'OVERPRESSURE!' }, o.words);
  let el = 0, nextTrap = first[0] + Math.random() * first[1], turbo = 0, stall = 0, shakeT = 0, flash = 0;
  const T = { jam: null, bubble: null, dial: null, seq: null, fly: null }, busy = () => !!(T.jam || T.bubble || T.dial || T.seq || T.fly);
  const nextIn = () => { nextTrap = el + gap[0] + Math.random() * gap[1]; };
  const reward = (type, sec, word, col) => {
    turbo = el + sec; nextIn(); flash = 1;
    sabTry(() => { sfx.hit(); burst(at.x, at.y, col, 24, 400); ring(at.x, at.y, col, 100, .4); floatText(word, at.x, at.y - 34, col, 34); });
    if (o.onReward) o.onReward(type);
  };
  const fail = word => { stall = el + .9; nextIn(); shakeT = .4; sabTry(() => { sfx.miss(); shake(6, .25); floatText(word, at.x, at.y - 34, '#FF4D5E', 30); }); };
  const dialPos = () => .5 + .5 * Math.sin(T.dial.seed + (el - T.dial.at) * 4.6);
  const api = {
    get jam() { return T.jam; }, get bubble() { return T.bubble; }, get dial() { return T.dial; }, get seq() { return T.seq; }, get fly() { return T.fly; },
    active: () => Object.keys(T).find(k => T[k]) || '',
    stuck: () => !!T.jam || stall > el, shaking: () => shakeT > 0, turboOn: () => turbo > el, turboLeft: () => Math.max(0, turbo - el), soon: () => !busy() && nextTrap - el < 1.2, flash: () => flash,
    spawn(type) {
      if (type === 'fly') { T.fly = { at: el, life: 4.5, seed: Math.random() * 6 }; sabTry(() => noise(.3, .04, 1500, 2500, 'bandpass')); }
      else if (type === 'jam') { T.jam = { have: 0, need: 8, side: 0 }; sabTry(() => { sfx.miss(); shake(7, .3); }); }
      else if (type === 'bubble') { T.bubble = { at: el, life: 2.8, seed: Math.random() * 6, fakes: Math.random() < .5 ? [Math.random() * 6, Math.random() * 6] : [] }; sabTry(() => sfx.blip(14)); }
      else if (type === 'dial') { T.dial = { at: el, life: 3.2, seed: Math.random() * 6, zone: .3 + Math.random() * .4, w: .2 }; sabTry(() => sfx.blip(10)); }
      else if (type === 'seq') { T.seq = { at: el, life: 4, i: 0, keys: [0, 1, 2].map(() => Math.floor(Math.random() * 3)) }; sabTry(() => sfx.blip(12)); }
    },
    update(dt) {
      el += dt; shakeT = Math.max(0, shakeT - dt); flash = Math.max(0, flash - dt * 2);
      if (!busy() && el >= nextTrap) {
        const order = ['fly', 'jam', 'bubble', 'dial', 'seq'], total = order.reduce((n, k) => n + wt[k], 0);
        let r = Math.random() * total, pick = order[order.length - 1];
        for (const k of order) { if (r < wt[k]) { pick = k; break; } r -= wt[k]; }
        api.spawn(pick);
      }
      for (const k of ['bubble', 'dial', 'seq', 'fly']) if (T[k] && el - T[k].at > T[k].life) { T[k] = null; nextIn(); }
    },
    /* a pump tap arrives: 0 = swallowed (jam, stall, or the fly ate it), otherwise how much air it is worth */
    gate() {
      if (T.jam || stall > el) { shakeT = .3; sabTry(() => sfx.miss()); return 0; }
      const v = turbo > el ? 2 : 1;
      if (T.fly && Math.random() < .55) { sabTry(() => noise(.06, .03, 1800, 2600, 'bandpass')); shakeT = .15; return 0; }
      return v;
    },
    swat() { if (!T.fly) return; T.fly = null; nextIn(); flash = 1; sabTry(() => { sfx.hit(); burst(at.x, at.y + 2, '#9fe3ff', 14, 300); floatText('SPLAT!', at.x, at.y - 34, '#9fe3ff', 30); }); },
    wiggle(side) {
      const j = T.jam; if (!j) return;
      if (side === j.side) { shakeT = .25; return; }
      j.side = side; j.have++; sabTry(() => sfx.blip(j.have * 2));
      if (j.have >= j.need) { T.jam = null; turbo = el + 1.6; nextIn(); flash = 1; sabTry(() => { sfx.whoosh(true); burst(at.x, at.y, '#5CFF7A', 22, 380); floatText('UNJAMMED!', at.x, at.y - 34, '#5CFF7A', 34); }); }
    },
    hitBubble() { if (T.bubble) { T.bubble = null; reward('bubble', 4, words.bubble, '#FFE14D'); } },
    dialStop() { if (!T.dial) return; const hit = Math.abs(dialPos() - T.dial.zone) < T.dial.w / 2; T.dial = null; if (hit) reward('dial', 3.5, words.dial, '#5CFF7A'); else fail(words.over); },
    seqPress(d) {
      const s = T.seq; if (!s) return;
      if (d === s.keys[s.i]) { s.i++; sabTry(() => sfx.blip(s.i * 3)); if (s.i >= s.keys.length) { T.seq = null; reward('seq', 3.5, words.seq, '#4DB8FF'); } }
      else { s.i = 0; shakeT = .3; sabTry(() => sfx.miss()); }
    },
    /* keyboard: A/D or arrows (left 0, up 1, right 2), Enter, F. Returns true when a trap used the key. */
    key(c) {
      const d = c === 'ArrowLeft' || c === 'KeyA' ? 0 : c === 'ArrowUp' || c === 'KeyW' ? 1 : c === 'ArrowRight' || c === 'KeyD' ? 2 : -1;
      if (T.jam && d !== 1 && d >= 0) api.wiggle(d - 1);
      else if (T.seq && d >= 0) api.seqPress(d);
      else if (T.dial && (c === 'Enter' || d === 1)) api.dialStop();
      else if (T.fly && (c === 'Enter' || c === 'KeyF')) api.swat();
      else if (c === 'Enter') api.hitBubble();
      else return false;
      return true;
    },
    /* draws the active trap into the panel (and its tap targets into btns); with no trap it calls idle(mx, y, mw) so the host can draw its own status.
       Every panel is a rounded slab with a drop shadow; the valve, the fly, the gauge, the arrow slots and the bubble are inked cartoon props. */
    draw(mx, y, mw, idle) {
      const Y = n => y + n - 492, cxm = mx + mw / 2, c = ctx;
      if (!SABU) {   // no art kit (headless tests): only the tap targets
        if (T.jam) { sabBtn(mx + 14, Y(542), mw / 2 - 18, 36, '< A / LEFT', () => api.wiggle(-1), {}); sabBtn(mx + mw / 2 + 4, Y(542), mw / 2 - 18, 36, 'D / RIGHT >', () => api.wiggle(1), {}); }
        else if (T.fly) { const f = T.fly, age = el - f.at; btns.unshift({ x: cxm + Math.sin(age * 3.1 + f.seed) * 140 + Math.sin(age * 9) * 12 - 34, y: Y(544) + Math.sin(age * 4.7 + f.seed) * 14 - 34, w: 68, h: 68, fn: api.swat }); }
        else if (T.dial) sabBtn(cxm - 70, Y(548), 140, 32, 'STOP!', api.dialStop, {});
        else if (T.seq) [0, 1, 2].forEach(d => sabBtn(mx + 14 + d * ((mw - 28) / 3), Y(558), (mw - 28) / 3 - 8, 22, '', () => api.seqPress(d), {}));
        else if (T.bubble) { const b = T.bubble, age = el - b.at; btns.unshift({ x: mx + 60 + (mw - 120) * (.5 + .5 * Math.sin(b.seed + age * 2.2)) - 36, y: Y(550) + Math.sin(age * 5 + b.seed) * 5 - 36, w: 72, h: 72, fn: api.hitBubble }); }
        else if (idle) idle(mx, y, mw);
        return;
      }
      if (T.jam) {
        const j = T.jam, pulse = .5 + .5 * Math.sin(now * 12);
        sabSlab(mx, y, mw, 88, 14, SABU.mix('#5a1626', '#8a2338', pulse), 3);
        sabValve(mx + 26, Y(509), 10, j.have * .6 + Math.sin(now * 24) * .12 * (shakeT > 0 ? 1 : .3));
        sabValve(mx + mw - 26, Y(509), 10, -j.have * .6 - Math.sin(now * 24) * .12 * (shakeT > 0 ? 1 : .3));
        SABU.text('VALVE JAMMED!', cxm, Y(510), 21, '#FFE14D', 'center', mw - 120);
        sabBar(mx + 14, Y(522), mw - 28, 12, j.have / j.need, '#5CFF7A', j.need);
        sabBtn(mx + 14, Y(542), mw / 2 - 18, 36, '< A / LEFT', () => api.wiggle(-1), { size: 18, fill: j.side !== -1 ? '#FFE14D' : '#d3cfe0', lit: j.side !== -1 });
        sabBtn(mx + mw / 2 + 4, Y(542), mw / 2 - 18, 36, 'D / RIGHT >', () => api.wiggle(1), { size: 18, fill: j.side !== 1 ? '#FFE14D' : '#d3cfe0', lit: j.side !== 1 });
      } else if (T.fly) {
        const f = T.fly, age = el - f.at, fx = cxm + Math.sin(age * 3.1 + f.seed) * 140 + Math.sin(age * 9) * 12, fy = Y(544) + Math.sin(age * 4.7 + f.seed) * 14;
        sabSlab(mx, y, mw, 88, 14, '#322d52', 3); SABU.text('A FLY! HALF YOUR PUMPS FAIL · SWAT IT! TAP / ENTER', cxm, Y(502), 12, '#FF9A3D', 'center', mw - 24);
        c.lineCap = 'round'; c.beginPath(); c.moveTo(mx + 14, Y(548)); c.lineTo(mx + mw - 26, Y(548)); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#c9ced6'; c.lineWidth = 7; c.stroke();
        c.beginPath(); c.moveTo(mx + 14, Y(546)); c.lineTo(mx + mw - 26, Y(546)); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.stroke();
        sabFly(fx, fy, age, f.seed);
        btns.unshift({ x: fx - 34, y: fy - 34, w: 68, h: 68, fn: api.swat });
      } else if (T.dial) {
        const d = T.dial, age = el - d.at, tx = mx + 30, tw = mw - 60, pos = dialPos(), late = age > d.life * .75;
        sabSlab(mx, y, mw, 88, 14, '#3b3550', 3); SABU.text('STOP IN THE GREEN! TAP / ENTER / W', cxm, Y(508), 14, '#FFE14D', 'center', mw - 24);
        SABU.rr(tx, Y(522), tw, 22, 11); SABU.ink('#1d1830', 3);
        c.save(); SABU.rr(tx, Y(522), tw, 22, 11); c.clip();
        c.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 1; i < 10; i++) { SABU.rr(tx + tw * i / 10 - 1, Y(526), 2, 14, 1); c.fill(); }
        const zx = tx + tw * (d.zone - d.w / 2), zw = tw * d.w;
        SABU.rr(zx, Y(524), zw, 18, 9); SABU.ink('#23a046', 0); c.fillStyle = '#5CFF7A'; SABU.rr(zx, Y(524), zw, 14, 8); c.fill();
        c.fillStyle = 'rgba(255,255,255,.55)'; SABU.rr(zx + 6, Y(526), zw - 12, 3, 1.5); c.fill();
        c.restore();
        c.save(); const nx = tx + tw * pos; c.translate(nx, 0);
        SABU.rr(-4.5, Y(517), 9, 32, 4.5); SABU.ink(late ? '#FF4D5E' : '#fff', 2.5); c.fillStyle = late ? 'rgba(255,255,255,.55)' : 'rgba(80,70,120,.25)'; SABU.rr(-1.5, Y(521), 3, 12, 1.5); c.fill(); c.restore();
        sabBtn(cxm - 70, Y(548), 140, 32, 'STOP!', api.dialStop, { size: 20, fill: '#5CFF7A' });
      } else if (T.seq) {
        const s = T.seq;
        sabSlab(mx, y, mw, 88, 14, '#3b3550', 3); SABU.text('COPY THE ARROWS!', cxm, Y(508), 15, '#FFE14D', 'center', mw - 24);
        s.keys.forEach((d, i) => {
          const x = cxm + (i - 1) * 56, cur = i === s.i, done = i < s.i, col = done ? '#5CFF7A' : cur ? '#FFE14D' : '#d3cfe0', by = Y(518) + (cur ? -Math.abs(Math.sin(now * 6)) * 2 : 0);
          c.fillStyle = 'rgba(20,16,28,.28)'; SABU.rr(x - 21, by + 5, 44, 34, 9); c.fill();
          SABU.rr(x - 22, by, 44, 34, 9); SABU.ink(col, 3); c.fillStyle = 'rgba(255,255,255,.4)'; SABU.rr(x - 16, by + 3, 32, 4, 2); c.fill();
          sabArrow(x, by + 18, d, INK, 1);
          if (done) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 11, by + 5); c.lineTo(x + 14, by + 9); c.lineTo(x + 19, by + 3); c.stroke(); }
        });
        [0, 1, 2].forEach(d => { const x = mx + 14 + d * ((mw - 28) / 3); sabBtn(x, Y(558), (mw - 28) / 3 - 8, 22, '', () => api.seqPress(d), { fill: '#fff', icon: (cx, cy) => sabArrow(cx, cy, d, '#4fd06a', .72) }); });
      } else if (T.bubble) {
        const b = T.bubble, age = el - b.at, u = Math.min(1, age / b.life), bx = mx + 60 + (mw - 120) * (.5 + .5 * Math.sin(b.seed + age * 2.2)), by = Y(550) + Math.sin(age * 5 + b.seed) * 5;
        sabSlab(mx, y, mw, 88, 14, '#3b3550', 3); SABU.text('GOLD BUBBLE! TAP IT / ENTER', cxm, Y(501), 12, '#FFE14D', 'center', mw - 24);
        (b.fakes || []).forEach((sd, i) => {
          const fx = mx + 60 + (mw - 120) * (.5 + .5 * Math.sin(sd + age * (1.6 + i * .7))), fy = Y(548) + Math.sin(age * 4 + sd) * 8;
          SABU.orb(fx, fy, 20, { col: '#9a98ad', t: now, seed: sd, state: 'full' });
          c.save(); c.lineCap = 'round'; c.beginPath(); c.moveTo(fx - 7, fy - 7); c.lineTo(fx + 7, fy + 7); c.moveTo(fx + 7, fy - 7); c.lineTo(fx - 7, fy + 7); c.lineWidth = 9; c.strokeStyle = '#fff'; c.stroke(); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); c.restore();
          btns.push({ x: fx - 30, y: fy - 30, w: 60, h: 60, fn: () => { T.bubble = null; fail('FAKE!'); } });
        });
        c.save(); c.lineCap = 'round'; c.beginPath(); c.arc(bx, by, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - u)); c.lineWidth = 9; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = u > .7 ? '#FF4D5E' : '#FFE14D'; c.stroke(); c.restore();
        SABU.orb(bx, by, 22, { col: '#FFD23F', t: now, seed: b.seed, state: 'pulse' });
        c.save(); c.translate(bx, by); c.beginPath(); c.moveTo(3, -12); c.lineTo(-8, 2); c.lineTo(-1, 2); c.lineTo(-4, 12); c.lineTo(8, -3); c.lineTo(1, -3); c.closePath(); SABU.ink(INK, 1.5); c.fillStyle = '#fff3a0'; c.beginPath(); c.moveTo(2, -9); c.lineTo(-5, 1); c.lineTo(0, 1); c.lineTo(-2, 8); c.lineTo(5, -2); c.lineTo(.5, -2); c.closePath(); c.fill(); c.restore();   // a bolt: TURBO
        btns.unshift({ x: bx - 36, y: by - 36, w: 72, h: 72, fn: api.hitBubble });
      } else {
        if (api.soon()) sabAlarmRim(mx, y, mw);
        if (idle) idle(mx, y, mw);
      }
      if (flash > 0) { c.save(); c.globalAlpha *= flash * .5; c.fillStyle = '#fff'; SABU.rr(mx, y, mw, 88, 14); c.fill(); c.restore(); }
      sabPopsDraw();
    },
  };
  return api;
}
