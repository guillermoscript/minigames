'use strict';
/* BRAINY BUNCH wave 1 - observation and logic microgames: WEIGH!, TURN IT!, FOCUS!, SPOT IT!, PROFILE!, COUNT!, ALIGN!, PUSH!
   Every game is a "pick the right thing" puzzle, so mouse, finger and keyboard all work:
     pointer: down(p) on a big target (>= 56px logical) - no hover, no drag, no chords needed
     keyboard: digits 1-9 pick directly, arrows move a highlight and Space / Enter confirms (bbNav)
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose'
   Constructors only compute data: no DOM, no audio.
   Art: the DUO look (docs/ART-STYLE.md). Every game is a place (toy shop, photo studio, cinema, lab, detective office, party lawn,
   museum, game show). The static scene is baked once; only what moves is drawn each frame. Art randomness never touches Math.random. */

/* ───────────── art kit (a local copy of the DUO drawing helpers). Everything draws on X, which can be swapped for an offscreen context ───────────── */
const BBK = (() => {
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const K = { TAU };
  K.cx = () => X;
  const clamp = K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  K.hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const MX = {};
  K.mix = (a, b, k) => { const key = a + b + k; if (MX[key]) return MX[key]; const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const x = p(a), y = p(b); return MX[key] = 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')'; };
  K.sh = c => K.mix(c, '#2a1d6b', .3);
  K.bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = X; X = c.getContext('2d'); try { fn(X); } finally { X = p; } return c; };
  const BK = {};
  K.baked = (key, fn) => BK[key] || (BK[key] = K.bake(800, 600, fn));
  /* the outro clock: set in update() (shoot.js draws once), with a fallback in draw() */
  K.outro = () => { let t0 = -1; return { mark(g) { if (g.result && t0 < 0) t0 = now; }, t(g) { if (!g.result) return 0; if (t0 < 0) t0 = now; return Math.max(0, now - t0); } }; };
  const mkRR = K.mkRR = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const rr = K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = K.ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = K.cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = K.glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  K.celRR = (x, y, w, h, r, base, o = 4, gl = true) => { const p = mkRR(x, y, w, h, r); cel(p, base, K.sh(base), 2.5, 3.5, o); if (gl) glint(p, x + w * .3, y + h * .2, w * .22, Math.min(h * .1, 6), .45, -.3); return p; };
  K.celC = (x, y, r, base, o = 4, gl = true) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); cel(p, base, K.sh(base), r * .16, r * .2, o); if (gl) glint(p, x - r * .35, y - r * .4, r * .3, r * .16, .45, -.6); return p; };
  K.celE = (x, y, rx, ry, base, o = 4, gl = true) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); cel(p, base, K.sh(base), rx * .14, ry * .2, o); if (gl) glint(p, x - rx * .35, y - ry * .4, rx * .3, ry * .16, .45, -.5); return p; };
  K.celPoly = (pts, base, o = 4, sx = 3, sy = 4) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); cel(p, base, K.sh(base), sx, sy, o); return p; };
  K.line = (pts, w, col) => { X.beginPath(); for (const [a, b] of pts) X.lineTo(a, b); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  K.star = (x, y, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(fill, o); };
  K.vg = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  K.hills = (L, R, base, amp, freq, ph, fill, line, lw = 3, y2 = base + 4) => {
    X.beginPath(); X.moveTo(L, y2); for (let x = L; x <= R + 8; x += 8) X.lineTo(x, base - amp * (.55 + .45 * Math.sin(x * freq + ph) * Math.cos(x * freq * .37 + ph * 2)));
    X.lineTo(R, y2); X.closePath(); X.fillStyle = fill; X.fill(); if (line) { X.lineWidth = lw; X.strokeStyle = line; X.lineJoin = 'round'; X.stroke(); }
  };
  K.horizon = (y, L, R, w = 4) => { X.fillStyle = INK; X.fillRect(L, y - w / 2, R - L, w); };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; X.save(); X.globalAlpha = 1 - k; X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); };
  K.arms = (u, la, ra, k, col = OR) => {   // blocky Caos arms (hippo.js): origin at Caos's feet, drawn before caos()
    if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    const one = (sx, an) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4); X.restore();
    };
    one(-1, la); one(1, ra);
  };
  K.eye = (x, y, r, mood, look, T, k) => {   // crane.js eye: sclera, pupil looking at the action, white dot, blink, moods
    X.lineCap = 'round';
    if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = INK; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
    if (mood === 'sad') { X.lineWidth = r * .5; X.strokeStyle = INK; X.beginPath(); const d = k ? -1 : 1; X.moveTo(x - r * .7 * d, y - r * .5); X.lineTo(x + r * .4 * d, y); X.lineTo(x - r * .7 * d, y + r * .5); X.stroke(); return; }
    const big = mood === 'panic' ? 1.3 : 1;
    el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
    if (mood !== 'panic' && Math.sin(T * 1.9 + k * .7 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const pr = mood === 'panic' ? r * .32 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
    X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
  };
  K.cloud = (x, y, s, col = '#e4f5ff') => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = col; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
  };
  K.sun = (sx, sy, T) => {
    X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 70); X.fill(); }
    X.restore(); X.beginPath(); X.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 10, sy - 10, 12, 8, -.6); X.fill();
  };
  K.rays = (x, y, r, T, a = .5, col = '255,240,150') => {
    X.save(); X.translate(x, y); X.rotate(T * .6); X.fillStyle = `rgba(${col},${a})`;
    for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-r * .12, r * .25); X.lineTo(r * .12, r * .25); X.lineTo(0, r); X.fill(); }
    X.restore();
  };
  K.shade = (x, y, rx, ry, a = .25) => { X.fillStyle = `rgba(20,16,28,${a})`; el(x, y, rx, ry); X.fill(); };
  const FONT = '"Fredoka", "Helvetica Neue", Arial, sans-serif';
  const tr = s => (typeof window !== 'undefined' && window.t) ? window.t(s) : s;
  K.tx = (s, x, y, size, col = INK, align = 'center') => { X.font = `700 ${size}px ${FONT}`; X.textAlign = align; X.textBaseline = 'middle'; X.fillStyle = col; X.fillText(tr(s), x, y); };
  K.pill = (x, y, label, col, up = true) => {   // name tag / label: fully round, ink 3, gloss strip and a pointer
    label = tr(label); X.font = `700 15px ${FONT}`; const w = X.measureText(label).width + 24, h = 24;
    X.save(); X.translate(x, y);
    if (up) { X.beginPath(); X.moveTo(-6, h / 2 - 2); X.lineTo(6, h / 2 - 2); X.lineTo(0, h / 2 + 8); X.closePath(); ink(col, 3); }
    rr(-w / 2, -h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 6, -h / 2 + 3, w - 12, h * .24, 3); X.fill();
    X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(label, 0, 1); X.restore();
  };
  K.keyCap = (s, x, y, w = 30) => { rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); X.fillStyle = INK; X.font = `700 15px ${FONT}`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, x, y + 1); };
  K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0) => {   // feedback word: a coloured slab with a gloss and a drop shadow
    s = tr(s); X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = X.measureText(s).width + size * .9, h = size * 1.25;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .3); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .3); ink(bg, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(-w / 2 + 6, -h / 2 + 5, w - 12, h * .2, h * .1); X.fill();
    X.fillStyle = fg; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 0, size * .05); X.restore();
  };
  K.win = (x, y, w, h, topCol = '#8fdcff', botCol = '#e6fbff') => {   // a window onto the sky
    rr(x, y, w, h, 8); X.fillStyle = K.vg(y, y + h, [[0, topCol], [1, botCol]]); X.fill();
    rr(x, y, w, h, 8); ink(null, 5, '#8a5a34'); X.lineWidth = 3; X.strokeStyle = INK; rr(x - 5, y - 5, w + 10, h + 10, 12); X.stroke();
    X.lineWidth = 5; X.strokeStyle = '#d9944f'; X.beginPath(); X.moveTo(x + w / 2, y); X.lineTo(x + w / 2, y + h); X.moveTo(x, y + h / 2); X.lineTo(x + w, y + h / 2); X.stroke();
  };
  return K;
})();

(function () {

const BLU = '#4A5BE0', BLU2 = '#3F4ED0', LIME = '#B8F34A', PINK = '#FF6FB5', CREAM = '#FFF3D1', ORG = '#FF9F43';
const TEAL = '#2EC4B6', YEL = '#FFE14D', RED = '#ff4d4d', VIO = '#8B6CFF', NAVY = '#27306E', STONE = '#D8D2E8';
const K = BBK;

const bbMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const bbLoseFx = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
const bbWinFx = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 32); ring(x, y, '#fff', 110); };
const WINW = ['BRAINY!', 'SMART!', 'GENIUS!', 'NICE!'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const sum = a => a.reduce((s, v) => s + v, 0);

/* ── shared art: the prompt as a plate in the world, Caos with a reaction, cards with a verdict badge ── */
function bbPrompt(s) {                    // a cream plate below the hint line (y 62-90)
  const X = ctx; s = window.t(s); X.font = '700 21px Fredoka, "Helvetica Neue", Arial, sans-serif';
  const w = Math.min(560, X.measureText(s).width + 56), h = 30, x = 400 - w / 2, y = 62;
  X.fillStyle = 'rgba(20,16,28,.3)'; K.rr(x + 3, y + 6, w, h, 15); X.fill();
  K.rr(x, y, w, h, 15); K.ink('#fff7e0', 3.5); X.fillStyle = 'rgba(255,255,255,.7)'; K.rr(x + 10, y + 4, w - 20, 6, 3); X.fill();
  X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 400, y + h / 2 + 1, w - 28);
}
/* Caos with a name tag, arms that cheer / slump, a worried sweat in the last seconds and hearts on a win; ot = seconds since the verdict */
function bbCaos(g, x, y, u, ot, tag = true) {
  const R = g.result, up = R === 'win' ? .35 + Math.sin(now * 14) * .18 : R === 'lose' ? 2.9 : 2.35;
  K.shade(x, y + 1, 7 * u, 1.6 * u, .3);
  ctx.save(); ctx.translate(x, y); K.arms(u, -up, up, 1); ctx.restore();
  caos(x, y, u, { mood: bbMood(g) });
  if (tag) K.pill(x, y - 9 * u - 18, 'CAOS', YEL, true);
  if (!R && g.dur - g.c < 1.6) K.sweat(x + 6 * u, y - 9 * u - 4, u * .28, now);
  if (R === 'win') for (let i = 0; i < 2; i++) { const k = (ot * 1.4 + i * .5) % 1; K.heart(x + (i ? 10 : -10) * u * .8 + Math.sin(k * 6 + i) * 6, y - 9 * u - 10 - k * 46, .7 + .25 * (1 - k), 1 - k); }
}
/* a card that lifts on hover; draws the keyboard cursor, the number and a verdict badge in the corner (never over the picture) */
const MARKF = { good: '#c3f78a', bad: '#ffb4b4' };
function bbCard(r, i, st, g, mark, fill, badge = true, rad = 14) {
  const lift = (st.hov === i && !g.result) ? -4 : 0, x = r.x, y = r.y + lift;
  K.shade(x + r.w / 2 + 4, r.y + r.h + 8, r.w / 2 + 2, 7, .28);
  K.celRR(x, y, r.w, r.h, rad, MARKF[mark] || fill || CREAM, 4, false);
  K.rr(x + 6, y + 5, r.w - 12, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
  if (st.kb && st.sel === i && !g.result) { K.rr(x - 9, y - 9, r.w + 18, r.h + 18, rad + 6); ctx.lineWidth = 5 + Math.sin(now * 8) * 1; ctx.strokeStyle = YEL; ctx.stroke(); }
  if (badge && !TOUCH && i < 9) { ctx.beginPath(); ctx.arc(x + 16, y + 16, 12, 0, 7); K.ink(NAVY, 2.5); txt(String(i + 1), x + 16, y + 17, 14, '#fff'); }
  if (g.result && mark) { const ok = mark === 'good'; ctx.beginPath(); ctx.arc(x + r.w - 16, y + 16, 13, 0, 7); K.ink(ok ? '#4fd06a' : '#ff4d5e', 3); txt(ok ? '✓' : '✗', x + r.w - 16, y + 17, 16, '#fff'); }
  return lift;
}

/* ── shared input: hit-test big rects, keyboard digits / arrows + Space ── */
const inR = (p, r, pad) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
function bbHit(p, rs, pad) {             // nearest rect (by centre) that contains the point
  let best = -1, bd = 1e9;
  for (let i = 0; i < rs.length; i++) {
    if (!inR(p, rs[i], pad)) continue;
    const d = Math.hypot(p.x - (rs[i].x + rs[i].w / 2), p.y - (rs[i].y + rs[i].h / 2));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function bbNav(e, st, n, cols) {         // returns the chosen index or -1
  const c = e.code || '', m = /^(?:Digit|Numpad)([1-9])$/.exec(c);
  if (m) { st.kb = true; const i = +m[1] - 1; if (i < n) { st.sel = i; return i; } return -1; }
  if (c === 'ArrowLeft' || c === 'KeyA') { st.kb = true; st.sel = (st.sel + n - 1) % n; sfx.tick(); }
  else if (c === 'ArrowRight' || c === 'KeyD') { st.kb = true; st.sel = (st.sel + 1) % n; sfx.tick(); }
  else if ((c === 'ArrowUp' || c === 'KeyW') && cols > 1) { st.kb = true; st.sel = (st.sel - cols + n) % n; sfx.tick(); }
  else if ((c === 'ArrowDown' || c === 'KeyS') && cols > 1) { st.kb = true; st.sel = (st.sel + cols) % n; sfx.tick(); }
  else if (c === 'Space' || c === 'Enter') { st.kb = true; return st.sel; }
  return -1;
}
function bbInput(g, st, rects, cols, choose) {
  g.down = p => { if (g.result || g.c < .15) return; const i = bbHit(p, rects, 12); if (i >= 0) { st.kb = false; st.sel = i; choose(i); } };
  g.move = p => { if (!TOUCH) st.hov = bbHit(p, rects, 0); };
  g.up = () => {};
  g.key = e => { if (g.result || g.c < .15 || e.repeat) return; const i = bbNav(e, st, rects.length, cols); if (i >= 0) choose(i); };
  g.keyup = () => {};
}
const bbMark = (g, i, good, chosen) => !g.result ? null : i === good ? 'good' : i === chosen ? 'bad' : null;

/* a wooden floor from y downwards with a hard ink line (static) */
function bbFloor(y0) {
  const X = K.cx(); X.fillStyle = K.vg(y0, 600, [[0, '#d9944f'], [1, '#a5622c']]); X.fillRect(0, y0, 800, 600 - y0);
  X.strokeStyle = 'rgba(138,85,48,.55)'; X.lineWidth = 2; X.beginPath(); for (let y = y0 + 22; y < 600; y += 24) { X.moveTo(0, y); X.lineTo(800, y); }
  for (let r = 0, y = y0; y < 600; y += 24, r++) for (let x = (r % 2) * 60 - 60; x < 800; x += 120) { X.moveTo(x, y); X.lineTo(x, y + 24); } X.stroke();
  K.horizon(y0, 0, 800, 4);
}

/* ═════════════ 1 WEIGH: two piles of columns of blocks (1 or 2 high): the heavier pile has the MORE blocks, not more columns ═════════════
   a toy-shop counter with a brass scale, a ticking clock and a window with drifting clouds */
function scaleScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 520, [[0, '#bfe9d3'], [1, '#e8f9ee']]); X.fillRect(0, 0, 800, 520);
  X.fillStyle = 'rgba(255,255,255,.4)'; for (let x = -10; x < 800; x += 64) X.fillRect(x, 0, 32, 520);
  for (let i = 0; i < 30; i++) { X.fillStyle = 'rgba(255,120,150,.4)'; K.el(20 + K.hash(i) * 760, 100 + K.hash(i + 50) * 400, 4, 4); X.fill(); }
  K.win(600, 100, 140, 110);
  // toy shelf on the left wall, up high
  K.celRR(20, 118, 150, 12, 5, '#d9944f', 3.5, false);
  K.celRR(34, 82, 34, 36, 6, '#ff6fb5', 3); K.celC(112, 100, 17, '#ffd23f', 3); K.celRR(134, 92, 26, 26, 5, '#4DB8FF', 3);
  // wall clock
  K.celC(400, 148, 38, '#fff7e0', 5); for (let i = 0; i < 12; i++) { const a = i / 12 * K.TAU; X.strokeStyle = INK; X.lineWidth = i % 3 ? 2 : 4; X.beginPath(); X.moveTo(400 + Math.sin(a) * 28, 148 - Math.cos(a) * 28); X.lineTo(400 + Math.sin(a) * 33, 148 - Math.cos(a) * 33); X.stroke(); }
  // the counter
  X.fillStyle = K.vg(500, 600, [[0, '#a5622c'], [1, '#7a4420']]); X.fillRect(0, 500, 800, 100);
  X.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 60; x < 800; x += 120) X.fillRect(x, 522, 4, 80);
  K.celRR(-10, 500, 820, 24, 6, '#e0a15e', 4, false); K.horizon(500, 0, 800, 4);
  // scale pillar + base plate
  K.celRR(388, 238, 24, 262, 8, VIO, 4); K.celRR(340, 482, 120, 22, 10, TEAL, 4);
}
function bbScale(sp) {
  const minD = sp > 1.5 ? 1 : 2;
  let A = [2, 2, 2], B = [1, 1, 1, 1];
  for (let k = 0; k < 300; k++) {
    const mk = () => Array.from({ length: ri(3, 5) }, () => ri(1, 2));
    const a = mk(), b = mk(), d = Math.abs(sum(a) - sum(b));
    if (d >= minD && d <= minD + 1) { A = a; B = b; if ((a.length > b.length) !== (sum(a) > sum(b)) || k > 150) break; }
  }
  const P = [A, B], heavy = sum(A) > sum(B) ? 0 : 1, COL = [LIME, PINK];
  let ang = 0, chosen = -1, tap = 0;
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'WEIGH!', hint: 'CLICK THE HEAVIER PILE (OR LEFT / RIGHT)', thint: 'TAP THE HEAVIER PILE', dur: 5.4,
    down(p) { if (g.result || g.c < .15) return; choose(p.x < 400 ? 0 : 1); },
    move() {}, up() {}, keyup() {},
    key(e) {
      if (g.result || g.c < .15 || e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Digit1') choose(0);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Digit2') choose(1);
    },
    update(dt) {
      g.c += dt; tap = Math.max(0, tap - dt); ou.mark(g);
      const tgt = g.result ? (heavy === 1 ? .22 : -.22) : Math.sin(g.c * 1.6) * .02;
      ang += (tgt - ang) * Math.min(1, dt * 7);
    },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('scale', scaleScene), 0, 0);
      X.save(); X.beginPath(); X.rect(610, 108, 120, 94); X.clip(); K.cloud(600 + ((now * 9) % 190) - 60, 150, .8); K.cloud(600 + ((now * 6 + 100) % 190) - 60, 120, .55); X.restore();
      const sec = Math.floor(now) % 60;                                   // the clock hands tick
      X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(400, 148); X.lineTo(400 + Math.sin(now * .1) * 18, 148 - Math.cos(now * .1) * 18); X.stroke();
      X.lineWidth = 3; X.beginPath(); X.moveTo(400, 148); X.lineTo(400 + Math.sin(sec / 60 * K.TAU) * 28, 148 - Math.cos(sec / 60 * K.TAU) * 28); X.stroke(); X.lineCap = 'butt';
      bbPrompt('WHICH IS HEAVIER?');
      const ex = 250 * Math.cos(ang), ey = 250 * Math.sin(ang);
      K.line([[400 - ex, 230 - ey], [400 + ex, 230 + ey]], 12, '#ffd23f');
      X.fillStyle = 'rgba(255,255,255,.55)'; K.el(400 - ex * .5, 227 - ey * .5 - 3, 60, 2.5, ang); X.fill();
      K.celC(400, 230, 19, ORG, 4);
      for (let s = 0; s < 2; s++) {
        const px = 400 + (s ? ex : -ex), py = 230 + (s ? ey : -ey), top = py + 150, hot = !g.result && (s === 0 ? mouse.x < 400 : mouse.x >= 400) && !TOUCH;
        const won = g.result && s === chosen && g.result === 'win';
        if (won) K.rays(px, top - 50, 150, now, .3);
        K.line([[px, py], [px - 112, top + 6]], 2.5, '#e6c58c'); K.line([[px, py], [px + 112, top + 6]], 2.5, '#e6c58c');
        const n = P[s].length, x0 = px - n * 20, hop = g.result && s !== heavy ? Math.abs(Math.sin(ot * 9)) * 8 * Math.max(0, 1 - ot) : 0;
        for (let i = 0; i < n; i++) for (let k = 0; k < P[s][i]; k++) {
          const bx = x0 + i * 40 + 2, by = top - (k + 1) * 36 - hop;
          K.celRR(bx, by, 34, 34, 7, COL[s], 3.5); K.celRR(bx + 8, by + 8, 18, 18, 4, K.mix(COL[s], '#ffffff', .35), 0, false);
        }
        K.celRR(px - 122, top, 244, 18, 9, hot ? YEL : '#cfd8e6', 4);
        if (g.result && s === chosen) K.badge(g.result === 'win' ? '✓' : '✗', px + (s ? 100 : -100), top - 118, 30, g.result === 'win' ? '#5CFF7A' : '#ff4d5e', '#fff', K.outBack(ot / .3));
      }
      if (!TOUCH) { K.keyCap('◀', 250, 122, 36); K.keyCap('▶', 550, 122, 36); }
      bbCaos(g, 400, 540, 3.6, ot, false); vignette(.2);
    }
  };
  const choose = s => {
    chosen = s; tap = .2; sfx.click();
    if (s === heavy) { g.result = 'win'; bbWinFx(400, 330); floatText(pick(WINW), 400, 440, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(400, 330); floatText('WRONG!', 400, 440, RED, 46); }
  };
  return g;
}
reg('bb_scale', bbScale, 'WEIGH!');

/* ═════════════ 2 TURN IT: critter seen from the front; pick its back (the bag swaps sides when it turns round) ═════════════
   a photo studio: the critter on a turntable under a spotlight, the possible backs hung as framed pictures */
const BODYC = [TEAL, PINK, VIO, ORG, LIME], HATC = [YEL, RED, '#4DB8FF', '#fff', LIME];
function bbCritter(cx, by, s, view, P, look = 0) {
  const bw = 64 * s, bh = 60 * s, hw = 56 * s, hh = 42 * s, lh = 14 * s, bodyTop = by - lh - bh, headTop = bodyTop - hh + 4 * s;
  K.celRR(cx - 22 * s, by - lh, 14 * s, lh, 3 * s, '#4a4a9a', 3); K.celRR(cx + 8 * s, by - lh, 14 * s, lh, 3 * s, '#4a4a9a', 3);
  const side = view === 'front' ? P.bag : -P.bag;
  const bx = side > 0 ? cx + bw / 2 - 2 : cx - bw / 2 - 22 * s + 2;
  K.line([[cx + side * 10 * s, bodyTop + 2 * s], [bx + 11 * s, bodyTop + 22 * s]], 3 * s, '#8a5a34');
  K.celRR(cx - bw / 2, bodyTop, bw, bh, 14 * s, P.body, 3.5);
  K.celRR(bx, bodyTop + 22 * s, 22 * s, 28 * s, 6 * s, ORG, 3);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx + 2 * s, bodyTop + 30 * s); ctx.lineTo(bx + 20 * s, bodyTop + 30 * s); ctx.stroke();
  K.celRR(cx - hw / 2, headTop, hw, hh, 16 * s, P.body, 3.5);
  if (P.kind === 0) K.celPoly([[cx - hw / 2 + 2 * s, headTop + 2], [cx + hw / 2 - 2 * s, headTop + 2], [cx, headTop - 36 * s]], P.hat, 3.5);
  else if (P.kind === 1) { K.celRR(cx - hw / 2 - 6 * s, headTop - 8 * s, hw + 12 * s, 12 * s, 5 * s, P.hat, 3); K.celRR(cx - hw / 3, headTop - 24 * s, hw * 2 / 3, 18 * s, 5 * s, P.hat, 3); }
  else { K.celRR(cx - hw / 3, headTop - 6 * s, hw * 2 / 3, 8 * s, 4 * s, P.hat, 3); K.celC(cx, headTop - 14 * s, 13 * s, P.hat, 3); }
  if (view === 'front') {
    for (const sd of [-1, 1]) K.eye(cx + sd * 12 * s, headTop + 18 * s, 7.5 * s, null, [look, .3], now, sd);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, 2.4 * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, headTop + 28 * s, 7 * s, .25, Math.PI - .25); ctx.stroke(); ctx.lineCap = 'butt';
    for (const sd of [-1, 1]) { ctx.fillStyle = 'rgba(255,110,165,.5)'; K.el(cx + sd * 21 * s, headTop + 28 * s, 4.5 * s, 3 * s); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.4)'; K.el(cx, bodyTop + 30 * s, 16 * s, 14 * s); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(20,16,28,.22)'; for (let i = 0; i < 3; i++) { K.rr(cx - 18 * s, bodyTop + (14 + i * 14) * s, 36 * s, 5 * s, 2.5 * s); ctx.fill(); }
    K.celC(cx + 2 * s, by - lh - 6 * s, 7 * s, PINK, 3);
    ctx.strokeStyle = 'rgba(20,16,28,.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, headTop + 4 * s); ctx.lineTo(cx, headTop + hh - 4 * s); ctx.stroke();
  }
}
function behindScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 522, [[0, '#c9d0fb'], [1, '#e9ecff']]); X.fillRect(0, 0, 800, 522);
  X.fillStyle = 'rgba(255,255,255,.4)'; for (let x = 0; x < 800; x += 60) X.fillRect(x, 0, 30, 522);
  bbFloor(522);
  // the photo backdrop paper + the studio plinth
  X.fillStyle = 'rgba(20,16,28,.25)'; K.rr(46, 138, 220, 300, 14); X.fill();
  K.celRR(40, 130, 220, 300, 14, '#fff7e0', 4);
  X.fillStyle = 'rgba(20,16,28,.3)'; K.el(150, 440, 100, 16); X.fill();
  K.celE(150, 418, 94, 20, '#cfd8e6', 4); K.celRR(56, 410, 188, 28, 10, '#9aa6c4', 4, false);
  K.celE(150, 408, 94, 18, '#e4ebf8', 4);
  // tripod light on the right edge of the photo wall
  K.line([[280, 480], [292, 360]], 5, '#555a78'); K.line([[304, 480], [292, 360]], 5, '#555a78'); K.celRR(272, 330, 40, 32, 8, '#ffd23f', 4);
}
function bbBehind(sp) {
  const body = pick(BODYC), P = { body, hat: pick(HATC), kind: ri(0, 2), bag: Math.random() < .5 ? -1 : 1 };
  const mods = ['bag', 'hat', 'body', 'kind'].sort(() => Math.random() - .5).slice(0, 3);
  const opts = [{ P, ok: true }];
  for (const m of mods) {
    const Q = Object.assign({}, P);
    if (m === 'bag') Q.bag = -P.bag;
    else if (m === 'hat') Q.hat = pick(HATC.filter(c => c !== P.hat));
    else if (m === 'body') Q.body = pick(BODYC.filter(c => c !== P.body));
    else Q.kind = (P.kind + ri(1, 2)) % 3;
    opts.push({ P: Q, ok: false });
  }
  opts.sort(() => Math.random() - .5);
  const good = opts.findIndex(o => o.ok), st = { sel: 0, kb: false, hov: -1 };
  const rects = opts.map((o, i) => ({ x: 300 + (i % 2) * 230, y: 100 + Math.floor(i / 2) * 215, w: 210, h: 195 }));
  let chosen = -1;
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'TURN IT!', hint: 'CLICK ITS BACK (OR 1-4, ARROWS + SPACE)', thint: 'TAP WHAT IT LOOKS LIKE FROM BEHIND', dur: 5.8,
    update(dt) { g.c += dt; ou.mark(g); },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('behind', behindScene), 0, 0);
      bbPrompt('WHICH IS THE BACK?');
      K.pill(150, 128, 'FRONT', YEL, false);
      const sw = Math.sin(now * 1.3) * .06;                                   // the critter sways on its turntable
      X.save(); X.translate(150, 400); X.rotate(sw); bbCritter(0, 0, 1.5, 'front', P, Math.sin(now * .7)); X.restore();
      for (let i = 0; i < 4; i++) {
        const r = rects[i], lift = bbCard(r, i, st, g, bbMark(g, i, good, chosen), '#fff7e0');
        // the picture hangs on a cord from a nail
        X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(r.x + 40, r.y + lift - 2); X.lineTo(r.x + r.w / 2, r.y + lift - 22); X.lineTo(r.x + r.w - 40, r.y + lift - 2); X.stroke();
        bbCritter(r.x + r.w / 2, r.y + r.h - 18 + lift, 1.15, 'back', opts[i].P);
      }
      bbCaos(g, 150, 540, 3.8, ot); vignette(.2);
    }
  };
  bbInput(g, st, rects, 2, i => {
    chosen = i; sfx.click();
    if (i === good) { g.result = 'win'; bbWinFx(rects[i].x + 105, rects[i].y + 90); floatText(pick(WINW), 400, 300, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(rects[i].x + 105, rects[i].y + 90); floatText('WRONG!', 400, 300, RED, 46); }
  });
  return g;
}
reg('bb_behind', bbBehind, 'TURN IT!');

/* ═════════════ 3 FOCUS: a pixel mosaic sharpens step by step; pick which picture it is ═════════════
   a dim classroom: a projector beams the blurry picture on a pull-down screen, the answers lie on the floor as slides */
const PAL = { r: '#e8433a', g: '#3cb44b', y: '#FFD23F', b: '#3d8bff', w: '#ffffff', k: '#14101c', o: '#FF9F43', p: '#FF6FB5', n: '#8a5a2b', t: '#E8C79A' };
const ICONS = {
  apple: ['.....n......', '....nggg....', '..rrrnrrr...', '.rrrrrrrrr..', '.rrwrrrrrr..', 'rrrwrrrrrrr.', 'rrrrrrrrrrr.', 'rrrrrrrrrrr.', '.rrrrrrrrr..', '.rrrrrrrrr..', '..rrr.rrr...', '............'],
  heart: ['............', '.pppp..pppp.', 'pppppppppppp', 'pppwppppppp.', 'pppppppppppp', '.pppppppppp.', '..pppppppp..', '...pppppp...', '....pppp....', '.....pp.....', '............', '............'],
  star: ['.....yy.....', '.....yy.....', '....yyyy....', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', '..yyyyyyyy..', '...yyyyyy...', '...yyyyyy...', '..yyyy.yyy..', '..yyy...yyy.', '.yy.......yy', '............'],
  fish: ['............', '...bbbb...o.', '..bbbbbbb.oo', '.bbwkbbbbboo', 'bbbbbbbbbbo.', '.bbbbbbbbboo', '..bbbbbbb.oo', '...bbbb...o.', '............', '............', '............', '............'],
  house: ['............', '.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '..tttttttt..', '..tbbttbbt..', '..tbbttbbt..', '..ttttttt...', '..tttnnttt..', '..tttnnttt..'],
  moon: ['....yyyy....', '..yyyyy.....', '.yyyyy......', '.yyyy.......', 'yyyyy.......', 'yyyyy.......', 'yyyyy.......', '.yyyy.......', '.yyyyy......', '..yyyyyy....', '....yyyyy...', '............']
};
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BGRGB = hex(CREAM);
const GRIDS = {}; for (const k in ICONS) GRIDS[k] = ICONS[k].map(row => Array.from(row.padEnd(12, '.').slice(0, 12), ch => PAL[ch] ? hex(PAL[ch]) : null));
const LV = [12, 6, 4, 3, 2, 1];
function bbMosaic(grid, b) {             // average colour of each b x b block (transparent counts as paper)
  const out = [];
  for (let by = 0; by < 12; by += b) for (let bx = 0; bx < 12; bx += b) {
    let r = 0, gg = 0, bl = 0;
    for (let y = 0; y < b; y++) for (let x = 0; x < b; x++) { const c = grid[by + y][bx + x] || BGRGB; r += c[0]; gg += c[1]; bl += c[2]; }
    const n = b * b; out.push({ x: bx, y: by, c: `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(bl / n)})` });
  }
  return out;
}
function focusScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 400, [[0, '#4a52a6'], [1, '#7b83d8']]); X.fillRect(0, 0, 800, 400);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 0; x < 800; x += 56) X.fillRect(x, 0, 28, 400);
  bbFloor(400);
  // the pull-down screen: a roller on top, a white sheet with a black border
  K.celRR(236, 70, 328, 14, 7, '#9aa6c4', 4, false);
  X.fillStyle = 'rgba(20,16,28,.3)'; K.rr(244, 92, 312, 306, 8); X.fill();
  K.celRR(238, 84, 324, 316, 10, '#1d1840', 4, false);
  K.celRR(244, 88, 312, 308, 6, '#fffdf3', 0, false);
  // red stage curtains with folds
  for (const [x0, dir] of [[0, 1], [800, -1]]) {
    X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + dir * 78, 0); X.quadraticCurveTo(x0 + dir * 40, 220, x0 + dir * 70, 402); X.lineTo(x0, 402); X.closePath(); K.ink('#d9475a', 4);
    X.save(); X.clip(); X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 6; for (let i = 1; i < 4; i++) { X.beginPath(); X.moveTo(x0 + dir * i * 18, 0); X.lineTo(x0 + dir * (i * 16 + 4), 402); X.stroke(); } X.restore();
  }
}
function bbFocus(sp) {
  const rs = Math.sqrt(sp), names = Object.keys(ICONS).sort(() => Math.random() - .5).slice(0, 4), good = Math.floor(Math.random() * 4);
  const grid = GRIDS[names[good]], levels = LV.map(b => bbMosaic(grid, b)), step = .7 / rs;
  const st = { sel: 0, kb: false, hov: -1 };
  const rects = names.map((n, i) => ({ x: 55 + i * 170, y: 440, w: 150, h: 100 }));
  let chosen = -1;
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'FOCUS!', hint: 'CLICK WHAT IT IS (OR 1-4, ARROWS + SPACE)', thint: 'TAP WHAT THE BLURRY PICTURE IS', dur: 5.6,
    update(dt) { g.c += dt; ou.mark(g); },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('focus', focusScene), 0, 0);
      const lvl = g.result ? 5 : Math.min(5, Math.floor(g.c / step)), px = 25, x0 = 250, y0 = 94;
      // projector on the ceiling at the right with its beam
      X.fillStyle = `rgba(255,248,200,${.13 + Math.sin(now * 40) * .01})`; X.beginPath(); X.moveTo(612, 112); X.lineTo(556, 90); X.lineTo(556, 396); X.lineTo(612, 138); X.closePath(); X.fill();
      K.line([[690, 100], [690, 86]], 4, '#9aa6c4');
      K.celRR(628, 98, 112, 54, 14, '#cfd8e6', 4); K.celC(624, 125, 21, '#4a4a9a', 4);
      X.save(); X.translate(624, 125); X.rotate(lvl * 1.1); X.strokeStyle = INK; X.lineWidth = 3; for (let i = 0; i < 6; i++) { X.rotate(K.TAU / 6); X.beginPath(); X.moveTo(11, 0); X.lineTo(18, 0); X.stroke(); } X.restore();
      K.celC(624, 125, 9, '#fff3a0', 2.5); K.celC(718, 112, 5, g.result === 'lose' ? '#ff4d5e' : '#5CFF7A', 2, false);
      const b = LV[lvl];
      for (const m of levels[lvl]) { X.fillStyle = m.c; X.fillRect(x0 + m.x * px, y0 + m.y * px, b * px, b * px); }
      X.strokeStyle = 'rgba(20,16,28,.25)'; X.lineWidth = 2; X.strokeRect(x0, y0, 300, 300);
      if (!g.result) { const k = (g.c % step) / step; X.strokeStyle = 'rgba(255,255,255,' + (.55 * (1 - k)) + ')'; X.lineWidth = 6; X.strokeRect(x0 - 8 - k * 10, y0 - 8 - k * 10, 300 + 16 + k * 20, 300 + 16 + k * 20); }
      bbPrompt('WHAT IS IT?');
      if (g.result === 'win') K.rays(400, 244, 260, now, .12);
      for (let i = 0; i < 4; i++) {
        const r = rects[i], lift = bbCard(r, i, st, g, bbMark(g, i, good, chosen), '#fff7e0', true, 12);
        const G = GRIDS[names[i]], s = 7, ox = r.x + (r.w - 12 * s) / 2, oy = r.y + (r.h - 12 * s) / 2 + lift;
        for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (G[y][x]) { X.fillStyle = `rgb(${G[y][x][0]},${G[y][x][1]},${G[y][x][2]})`; X.fillRect(ox + x * s, oy + y * s, s, s); }
      }
      bbCaos(g, 105, 424, 3.4, ot); vignette(.2);
    }
  };
  bbInput(g, st, rects, 4, i => {
    chosen = i; sfx.click();
    if (i === good) { g.result = 'win'; bbWinFx(400, 230); floatText(pick(WINW), 400, 400, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(400, 230); floatText('WRONG!', 400, 400, RED, 46); }
  });
  return g;
}
reg('bb_focus', bbFocus, 'FOCUS!');

/* ═════════════ 4 SPOT IT: a grid of identical critters, one mutated ═════════════
   a lab: every critter lives in its own glass tank on the bench, a tiled wall behind */
function bbMon(cx, cy, r, P, k) {
  const X = ctx;
  for (let i = 0; i < P.ant; i++) {
    const d = P.ant === 1 ? 0 : (i ? 1 : -1) * .45, ax = cx + Math.sin(d) * r * 1.5, ay = cy - Math.cos(d) * r * 1.5;
    K.line([[cx + Math.sin(d) * r * .8, cy - Math.cos(d) * r * .8], [ax, ay]], 3, '#14101c'); K.celC(ax, ay, r * .17, YEL, 3);
  }
  if (P.ears) { K.celC(cx - r * .85, cy - r * .55, r * .3, P.col, 3); K.celC(cx + r * .85, cy - r * .55, r * .3, P.col, 3); }
  K.celC(cx, cy, r, P.col, 4);
  X.fillStyle = 'rgba(20,16,28,.25)';
  for (let i = 0; i < P.spots; i++) { X.beginPath(); X.arc(cx + [-.5, .55, .1][i] * r, cy + [.35, .4, .72][i] * r, r * .14, 0, 7); X.fill(); }
  const n = P.eyes, er = r * (n === 3 ? .2 : n === 2 ? .24 : .3);
  for (let i = 0; i < n; i++) {
    const ex = cx + (n === 1 ? 0 : n === 2 ? (i ? 1 : -1) * r * .38 : (i - 1) * r * .58), ey = cy - r * .22;
    K.eye(ex, ey, er * 1.05, null, [Math.sin(now * .8 + k) * .6, .4], now, k + i);
  }
  X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
  if (P.mouth === 0) X.arc(cx, cy + r * .2, r * .3, .2, Math.PI - .2); else if (P.mouth === 1) { X.moveTo(cx - r * .28, cy + r * .5); X.lineTo(cx + r * .28, cy + r * .5); } else X.arc(cx, cy + r * .5, r * .13, 0, 7);
  X.stroke(); X.lineCap = 'butt';
  X.fillStyle = 'rgba(255,110,165,.45)'; K.el(cx - r * .62, cy + r * .28, r * .14, r * .09); X.fill(); K.el(cx + r * .62, cy + r * .28, r * .14, r * .09); X.fill();
}
function mutationScene() {
  const X = K.cx();
  X.fillStyle = '#dff3ee'; X.fillRect(0, 0, 800, 600);
  X.strokeStyle = 'rgba(70,150,140,.3)'; X.lineWidth = 2; X.beginPath(); for (let x = 0; x <= 800; x += 50) { X.moveTo(x, 0); X.lineTo(x, 540); } for (let y = 0; y <= 540; y += 50) { X.moveTo(0, y); X.lineTo(800, y); } X.stroke();
  X.fillStyle = K.vg(0, 100, [[0, 'rgba(20,16,28,.25)'], [1, 'rgba(20,16,28,0)']]); X.fillRect(0, 0, 800, 100);
  // bench in front
  K.celRR(-10, 522, 820, 90, 10, '#b97a46', 4, false); K.horizon(522, 0, 800, 4);
}
function bbMutation(sp) {
  const big = sp > 1.4, cols = big ? 4 : 3, rows = big ? 3 : 2, n = cols * rows, cw = big ? 160 : 200, ch = big ? 130 : 190, gap = big ? 14 : 20;
  const col = pick([ORG, PINK, TEAL, LIME, VIO, YEL]);
  const base = { col, eyes: ri(2, 3), ant: ri(0, 2), spots: ri(0, 2), mouth: 0, ears: ri(0, 1) };
  const attrs = sp > 1.15 ? ['eyes', 'ant', 'spots', 'mouth', 'ears'] : ['eyes', 'ant', 'ears'];
  const M = Object.assign({}, base), a = pick(attrs);
  if (a === 'eyes') M.eyes = base.eyes === 2 ? 3 : 2; else if (a === 'ant') M.ant = (base.ant + ri(1, 2)) % 3;
  else if (a === 'spots') M.spots = (base.spots + ri(1, 2)) % 3; else if (a === 'mouth') M.mouth = ri(1, 2); else M.ears = 1 - base.ears;
  const good = Math.floor(Math.random() * n), st = { sel: 0, kb: false, hov: -1 };
  const x0 = (W - (cols * cw + (cols - 1) * gap)) / 2, y0 = big ? 100 : 105;
  const rects = Array.from({ length: n }, (_, i) => ({ x: x0 + (i % cols) * (cw + gap), y: y0 + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
  let chosen = -1;
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'SPOT IT!', hint: 'CLICK THE MUTANT (OR ARROWS + SPACE)', thint: 'TAP THE ONE THAT CHANGED', dur: 5.8,
    update(dt) { g.c += dt; ou.mark(g); },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('mutation', mutationScene), 0, 0);
      bbPrompt('WHO MUTATED?');
      for (let i = 0; i < n; i++) {
        const r = rects[i], mk = bbMark(g, i, good, chosen), lift = bbCard(r, i, st, g, mk, '#e4f8ff', false, 16);
        X.save(); K.rr(r.x + 5, r.y + 5 + lift, r.w - 10, r.h - 10, 12); X.clip();
        X.fillStyle = mk ? MARKF[mk] : '#e4f8ff'; X.fillRect(r.x, r.y + lift, r.w, r.h);
        X.fillStyle = '#e3b97e'; X.fillRect(r.x, r.y + lift + r.h * .8, r.w, r.h * .2); X.fillStyle = 'rgba(138,85,48,.4)'; for (let q = 0; q < 5; q++) { X.beginPath(); X.arc(r.x + 20 + q * (r.w - 40) / 4 + K.hash(i * 7 + q) * 8, r.y + lift + r.h * .88 + K.hash(i + q) * 8, 3, 0, 7); X.fill(); }
        for (let q = 0; q < 2; q++) { const kk = ((now * .35 + K.hash(i * 3 + q)) % 1); X.fillStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.arc(r.x + r.w * (.2 + .6 * K.hash(i * 5 + q)) + Math.sin(kk * 9) * 4, r.y + lift + r.h * .8 - kk * r.h * .7, 3 + q, 0, 7); X.fill(); }
        X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(r.x + 10, r.y + lift + 8, 10, r.h - 30);
        X.restore();
        if (g.result && mk) { X.beginPath(); X.arc(r.x + r.w - 16, r.y + lift + 16, 13, 0, 7); K.ink(mk === 'good' ? '#4fd06a' : '#ff4d5e', 3); txt(mk === 'good' ? '✓' : '✗', r.x + r.w - 16, r.y + lift + 17, 16, '#fff'); }
        const bob = Math.sin(now * 3 + i * .5) * 2.5, rad = Math.min(r.w, r.h) * .27;
        bbMon(r.x + r.w / 2, r.y + r.h * .5 + lift + bob, rad, i === good ? M : base, i);
      }
      bbCaos(g, 33, 538, 2.9, ot, false); vignette(.2);
    }
  };
  bbInput(g, st, rects, cols, i => {
    chosen = i; sfx.click();
    const r = rects[i];
    if (i === good) { g.result = 'win'; bbWinFx(r.x + r.w / 2, r.y + r.h / 2); floatText(pick(WINW), 400, 300, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(r.x + r.w / 2, r.y + r.h / 2); floatText('WRONG!', 400, 300, RED, 46); }
  });
  return g;
}
reg('bb_mutation', bbMutation, 'SPOT IT!');

/* ═════════════ 5 PROFILE: match a black silhouette to the right character ═════════════
   a detective's office: the shadow on the frosted door glass, the suspects pinned as wanted posters on a cork board */
function bbHead(cx, cy, s, P, sil, look = 0) {
  const X = ctx, F = c => sil ? INK : c, SK = '#FFCBA4';
  const cc = (x, y, r, c, o = 3) => { if (sil) { X.fillStyle = INK; X.beginPath(); X.arc(x, y, r + o, 0, 7); X.fill(); } else K.celC(x, y, r, c, o, false); };
  const cr = (x, y, w, h, rad, c, o = 3) => { if (sil) { X.fillStyle = INK; K.rr(x - o, y - o, w + o * 2, h + o * 2, rad + o); X.fill(); } else K.celRR(x, y, w, h, rad, c, o, false); };
  if (P.hair === 2) { cr(cx - 46 * s, cy - 22 * s, 20 * s, 76 * s, 8 * s, '#8a5a2b'); cr(cx + 26 * s, cy - 22 * s, 20 * s, 76 * s, 8 * s, '#8a5a2b'); }
  if (P.ears) { cc(cx - 43 * s, cy + 2 * s, 14 * s, SK); cc(cx + 43 * s, cy + 2 * s, 14 * s, SK); }
  if (P.beard) { X.fillStyle = INK; X.beginPath(); X.ellipse(cx, cy + 30 * s, 31 * s, 28 * s, 0, 0, 7); X.fill(); if (!sil) K.celE(cx, cy + 30 * s, 27 * s, 24 * s, '#6b4423', 0, false); }
  cc(cx, cy, 34 * s, SK);
  if (P.hair === 1) {
    for (let i = -2; i <= 2; i++) {
      const pts = [[cx + i * 14 * s - 9 * s, cy - 28 * s], [cx + i * 14 * s, cy - (58 - Math.abs(i) * 4) * s], [cx + i * 14 * s + 9 * s, cy - 28 * s]];
      if (sil) { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); K.ink(INK, 3); } else K.celPoly(pts, '#8a5a2b', 3);
    }
  }
  if (P.hat === 1) { cr(cx - 36 * s, cy - 40 * s, 72 * s, 10 * s, 4 * s, F(P.hc)); cr(cx - 21 * s, cy - 84 * s, 42 * s, 46 * s, 6 * s, F(P.hc)); }
  else if (P.hat === 2) {
    const pts = [[cx - 26 * s, cy - 28 * s], [cx + 26 * s, cy - 28 * s], [cx, cy - 86 * s]];
    if (sil) { X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.closePath(); K.ink(INK, 3); } else K.celPoly(pts, P.hc, 3);
    cc(cx, cy - 88 * s, 8 * s, '#fff');
  } else if (P.hat === 3) {
    X.beginPath(); X.arc(cx, cy - 8 * s, 39 * s, Math.PI, 0); X.closePath(); K.ink(F(P.hc), 3);
    cr(cx - 40 * s, cy - 12 * s, 80 * s, 9 * s, 4 * s, F(P.hc));
  }
  if (!sil) {
    for (const sd of [-1, 1]) K.eye(cx + sd * 13 * s, cy - 1 * s, 6.5 * s, null, [look, .3], now, sd);
    X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.arc(cx, cy + 12 * s, 11 * s, .3, Math.PI - .3); X.stroke(); X.lineCap = 'butt';
    X.fillStyle = 'rgba(255,110,165,.45)'; K.el(cx - 24 * s, cy + 12 * s, 6 * s, 4 * s); X.fill(); K.el(cx + 24 * s, cy + 12 * s, 6 * s, 4 * s); X.fill();
  }
}
function profilerScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 330, [[0, '#f0c98a'], [1, '#ffe3b0']]); X.fillRect(0, 0, 800, 330);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < 800; x += 50) X.fillRect(x, 0, 25, 330);
  // the frosted door: wood frame, glowing glass, gold lettering strip below
  K.celRR(286, 76, 228, 252, 16, '#8a5a34', 5, false);
  K.rr(300, 85, 200, 230, 12); X.fillStyle = K.vg(85, 315, [[0, '#fbffe0'], [1, '#e4f0b8']]); X.fill(); K.ink(null, 4);
  X.save(); K.rr(300, 85, 200, 230, 12); X.clip(); X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 5; for (let i = -6; i < 12; i++) { X.beginPath(); X.moveTo(300 + i * 30, 85); X.lineTo(260 + i * 30, 315); X.stroke(); } X.restore();
  // desk lamp, right
  K.line([[640, 330], [620, 250], [660, 200]], 8, '#555a78'); K.celE(640, 330, 30, 10, '#555a78', 3, false);
  K.celPoly([[640, 170], [700, 196], [668, 232], [630, 214]], '#ffd23f', 4);
  // the cork board
  X.fillStyle = 'rgba(20,16,28,.3)'; K.rr(30, 332, 750, 222, 16); X.fill();
  K.celRR(25, 326, 750, 222, 16, '#c98f55', 4.5, false);
  X.fillStyle = 'rgba(138,85,48,.5)'; for (let i = 0; i < 80; i++) { X.beginPath(); X.arc(40 + K.hash(i) * 720, 336 + K.hash(i + 99) * 205, 2 + K.hash(i + 7) * 2, 0, 7); X.fill(); }
}
function bbProfiler(sp) {
  const T = { hat: ri(0, 3), hair: ri(0, 2), ears: ri(0, 1), beard: ri(0, 1), hc: pick(HATC) };
  const fix = P => { if (P.hat > 0 && P.hair === 1) P.hair = 0; return P; };
  fix(T);
  const key = P => [P.hat, P.hair, P.ears, P.beard].join(), seen = new Set([key(T)]), opts = [{ P: T, ok: true }];
  const range = { hat: 3, hair: 2, ears: 1, beard: 1 }, flips = sp > 1.3 ? 1 : 2;
  for (let guard = 0; opts.length < 4 && guard < 400; guard++) {
    const Q = Object.assign({}, T, { hc: pick(HATC) }), as = Object.keys(range).sort(() => Math.random() - .5).slice(0, flips);
    for (const a of as) Q[a] = (T[a] + ri(1, range[a])) % (range[a] + 1);
    fix(Q);
    if (!seen.has(key(Q))) { seen.add(key(Q)); opts.push({ P: Q, ok: false }); }
  }
  for (let i = 0; opts.length < 4; i++) opts.push({ P: { hat: i % 4, hair: 2, ears: 1, beard: 1, hc: RED }, ok: false });   // unreachable safety net
  opts.sort(() => Math.random() - .5);
  const good = opts.findIndex(o => o.ok), st = { sel: 0, kb: false, hov: -1 };
  const rects = opts.map((o, i) => ({ x: 50 + i * 180, y: 340, w: 160, h: 190 }));
  let chosen = -1;
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'PROFILE!', hint: 'CLICK THE MATCH (OR 1-4, ARROWS + SPACE)', thint: 'TAP WHO CASTS THE SHADOW', dur: 5.8,
    update(dt) { g.c += dt; ou.mark(g); },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('profiler', profilerScene), 0, 0);
      bbPrompt('WHO IS IT?');
      // lamp light + a moth around it
      X.fillStyle = `rgba(255,240,150,${.16 + Math.sin(now * 5) * .02})`; X.beginPath(); X.moveTo(640, 214); X.lineTo(668, 232); X.lineTo(520, 318); X.lineTo(520, 160); X.closePath(); X.fill();
      X.save(); K.rr(300, 85, 200, 230, 12); X.clip();
      const shake = g.result === 'lose' ? Math.sin(now * 40) * 3 : Math.sin(now * 2.2) * 2;       // the shadow fidgets, nervous
      bbHead(400 + shake, 215, 1.3, T, true);
      X.fillStyle = 'rgba(255,255,255,.2)'; X.fillRect(300, 85, 200, 230); X.restore();
      const mx = 640 + Math.cos(now * 3) * 36, my = 190 + Math.sin(now * 4.4) * 20;
      X.fillStyle = '#fff'; X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.ellipse(mx - 4, my, 5, 3 + Math.sin(now * 30) * 2, 0, 0, 7); X.ellipse(mx + 4, my, 5, 3 + Math.sin(now * 30) * 2, 0, 0, 7); X.fill(); X.stroke();
      for (let i = 0; i < 4; i++) {
        const r = rects[i], mk = bbMark(g, i, good, chosen), lift = bbCard(r, i, st, g, mk, '#f6e3b0', true, 8);
        X.beginPath(); X.arc(r.x + r.w / 2, r.y + 4 + lift, 7, 0, 7); K.ink('#ff4d5e', 2.5);       // the pin
        bbHead(r.x + r.w / 2, r.y + 108 + lift, 1.1, opts[i].P, false, Math.sin(now * .9 + i) * .5);
      }
      // Caos the detective: standing on the board, hat and magnifying glass
      const cx = 150, cy = 322;
      bbCaos(g, cx, cy, 3.8, ot, false); K.pill(cx, cy - 9 * 3.8 - 40, 'CAOS', YEL, true);
      K.celRR(cx - 6.4 * 3.8, cy - 9 * 3.8 - 6, 12.8 * 3.8, 8, 4, '#6b4423', 3, false); K.celRR(cx - 3.8 * 3.8, cy - 9 * 3.8 - 22, 7.6 * 3.8, 18, 5, '#8a5a2b', 3, false);
      X.beginPath(); X.arc(cx + 66, cy - 40, 15, 0, 7); K.ink('rgba(200,240,255,.7)', 3.5); K.line([[cx + 56, cy - 28], [cx + 38, cy - 8]], 5, '#8a5a34');
      vignette(.2);
    }
  };
  bbInput(g, st, rects, 4, i => {
    chosen = i; sfx.click();
    if (i === good) { g.result = 'win'; bbWinFx(400, 200); floatText(pick(WINW), 400, 320, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(400, 200); floatText('WRONG!', 400, 320, RED, 46); }
  });
  return g;
}
reg('bb_profiler', bbProfiler, 'PROFILE!');

/* ═════════════ 6 COUNT: scattered numbered tiles, click 1..N in order (or type the digits) ═════════════
   a birthday lawn: the numbers are balloons, pop them in order */
const BALC = ['#ff6fb5', '#4DB8FF', '#ffd23f', '#5CFF7A', '#ff9f43', '#8B6CFF', '#ff4d5e'];
function numbersScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 400, [[0, '#3fb0ff'], [.55, '#8fdcff'], [1, '#e6fbff']]); X.fillRect(0, 0, 800, 520);
  K.hills(-20, 820, 470, 90, .011, 1.3, '#9be38a', '#2f7a49', 3, 520); K.hills(-20, 820, 500, 60, .016, 4.1, '#7cd46f', '#2f7a49', 3, 520);
  // lollipop trees on the hills
  for (const [x, y] of [[90, 436], [700, 440], [760, 450]]) { K.celRR(x - 5, y - 4, 10, 40, 4, '#8a5a34', 3, false); K.celC(x, y - 26, 26, '#2f9a55', 4); }
  X.fillStyle = K.vg(500, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(0, 500, 800, 100); K.horizon(500, 0, 800, 4);
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -100; x < 900; x += 90) { X.beginPath(); X.moveTo(x, 500); X.lineTo(x + 40, 500); X.lineTo(x - 40, 600); X.lineTo(x - 80, 600); X.closePath(); X.fill(); }
  X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; for (const [x, y] of [[200, 560], [330, 580], [560, 570], [710, 585], [450, 540]]) { X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 8, y - 12); X.moveTo(x, y); X.lineTo(x, y - 15); X.moveTo(x + 6, y); X.lineTo(x + 8, y - 12); X.stroke(); } X.lineCap = 'butt';
}
function bbNumbers(sp) {
  const N = sp > 1.8 ? 7 : sp > 1.3 ? 6 : 5, R = 40;
  const cells = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push({ x: 130 + c * 180, y: 170 + r * 150 });
  cells.sort(() => Math.random() - .5);
  const vals = Array.from({ length: N }, (_, i) => i + 1).sort(() => Math.random() - .5);
  const tiles = vals.map((v, i) => ({ v, x: cells[i].x + ri(-22, 22), y: cells[i].y + ri(-22, 22), done: 0, pop: 0, ph: Math.random() * 6 }));
  const rects = tiles.map(t => ({ x: t.x - R, y: t.y - R, w: R * 2, h: R * 2 }));
  let next = 1, bad = -1;
  const ou = K.outro();
  const tapTile = i => {
    const t = tiles[i]; if (g.result || t.done) return;
    if (t.v === next) {
      t.done = 1; t.pop = .3; next++; sfx.hit(); sfx.blip(next * 2); burst(t.x, t.y, YEL, 8, 200);
      if (next > N) { g.result = 'win'; bbWinFx(400, 320); floatText(pick(WINW), 400, 300, YEL, 46); }
    } else { bad = i; g.result = 'lose'; bbLoseFx(t.x, t.y); floatText('WRONG!', 400, 300, RED, 46); }
  };
  const g = {
    c: 0, cmd: 'COUNT!', hint: 'CLICK THE NUMBERS IN ORDER (OR TYPE THEM)', thint: 'TAP THE NUMBERS IN ORDER', dur: 5.8,
    down(p) { if (g.result || g.c < .15) return; const i = bbHit(p, rects, 8); if (i >= 0) tapTile(i); },
    move() {}, up() {}, keyup() {},
    key(e) {
      if (g.result || g.c < .15 || e.repeat) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || ''); if (!m) return;
      const i = tiles.findIndex(t => t.v === +m[1]); if (i >= 0) tapTile(i);
    },
    update(dt) { g.c += dt; ou.mark(g); for (const t of tiles) t.pop = Math.max(0, t.pop - dt); },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('numbers', numbersScene), 0, 0);
      K.sun(80, 150, now); K.cloud(((now * 6 + 40) % 1000) - 140, 130, 1); K.cloud(((now * 9 + 520) % 1000) - 140, 200, .8);
      const fx = ((now * 28) % 1000) - 100; X.fillStyle = INK; for (let i = 0; i < 3; i++) { const bx = fx - i * 26, by = 110 + Math.sin(now * 3 + i) * 6 + i * 8; X.lineWidth = 3; X.strokeStyle = INK; X.beginPath(); X.moveTo(bx - 8, by); X.quadraticCurveTo(bx - 4, by - 8 - Math.sin(now * 14 + i) * 4, bx, by); X.quadraticCurveTo(bx + 4, by - 8 - Math.sin(now * 14 + i) * 4, bx + 8, by); X.stroke(); }
      bbPrompt('1, 2, 3 ...');
      tiles.forEach((tl, i) => {
        const bob = tl.done ? 0 : Math.sin(now * 2.5 + tl.ph) * 3, k = tl.pop > 0 ? 1 + tl.pop * 1.2 : 1;
        X.save(); X.translate(tl.x, tl.y + bob); X.scale(k, k);
        const col = i === bad ? RED : BALC[tl.v % BALC.length];
        if (tl.done) {
          X.globalAlpha = tl.pop > 0 ? 1 : .5;
          if (tl.pop > 0) K.star(0, 0, 52, 26, 10, tl.pop * 6, YEL, 3);
          K.celE(0, 0, R * .8, R * .92, '#dbe4ff', 3, false);
          txt(String(tl.v), 0, 2, 34, '#fff'); X.globalAlpha = 1;
        } else {
          K.shade(0, R + 18, R * .6, 6, .18);
          X.beginPath(); X.moveTo(0, R * 1.05); X.bezierCurveTo(-8, R * 1.4, 8, R * 1.55, 0, R * 1.8); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2; X.strokeStyle = '#fff'; X.stroke();
          K.celPoly([[-7, R * 1.2], [7, R * 1.2], [0, R * .9]], col, 3, 1, 1);
          K.celE(0, 0, R * .92, R * 1.04, col, 4);
          X.fillStyle = 'rgba(255,255,255,.65)'; K.el(-R * .4, -R * .5, R * .17, R * .3, -.5); X.fill();
          txt(String(tl.v), 0, 2, 50, '#fff');
          if (i === bad) K.star(R * .6, -R * .8, 22, 11, 8, now * 3, YEL, 3);
        }
        X.restore();
      });
      // Caos with a pin
      bbCaos(g, 40, 532, 2.9, ot, false); vignette(.2);
    }
  };
  return g;
}
reg('bb_numbers', bbNumbers, 'COUNT!');

/* ═════════════ 7 ALIGN: statues that turn when clicked; make them all face the same way ═════════════
   a museum gallery: portraits whose eyes follow the statues, marble busts on plinths, a mouse on the skirting board */
function bbBust(cx, by, dir, sq, gold, ph) {       // dir: 0 front, 1 left, 2 back, 3 right; by = top of the pedestal
  const X = ctx, base = gold ? '#ffe28a' : STONE, dark = gold ? '#c99512' : '#b9b3cf';
  X.save(); X.translate(cx, by); X.scale(sq, 1);
  K.celRR(-46, -56, 92, 56, 14, base, 4);
  K.celC(0, -92, 38, base, 4);
  X.fillStyle = INK; X.strokeStyle = INK; X.lineCap = 'round'; X.lineWidth = 5;
  if (dir === 0) {
    for (const sd of [-1, 1]) { K.el(sd * 15, -98, 8, 9); ink2('#fff'); X.fillStyle = INK; K.el(sd * 15, -96, 4, 5); X.fill(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.arc(0, -82, 9, .3, Math.PI - .3); X.stroke();
    X.fillStyle = 'rgba(255,110,165,.4)'; K.el(-24, -82, 6, 4); X.fill(); K.el(24, -82, 6, 4); X.fill();
  } else if (dir === 2) {
    K.celC(0, -138, 12, dark, 3);
    X.strokeStyle = dark; X.lineWidth = 4; X.beginPath(); X.moveTo(-22, -108); X.lineTo(22, -108); X.moveTo(-26, -92); X.lineTo(26, -92); X.moveTo(-22, -76); X.lineTo(22, -76); X.stroke();
  } else {
    const d = dir === 1 ? -1 : 1;
    K.celC(-d * 12, -90, 9, dark, 3);
    K.celPoly([[d * 32, -104], [d * 58, -84], [d * 32, -74]], base, 3.5, 1, 2);
    K.el(d * 18, -98, 8, 9); ink2('#fff'); X.fillStyle = INK; K.el(d * 21, -97, 4, 5); X.fill();
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(d * 12, -66); X.lineTo(d * 30, -66); X.stroke();
  }
  X.lineCap = 'butt'; X.restore();
  function ink2(f) { K.ink(f, 2.5); }
}
function statuesScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 470, [[0, '#f3d1e8'], [1, '#fbeaf5']]); X.fillRect(0, 0, 800, 470);
  X.fillStyle = 'rgba(200,100,160,.14)'; for (let x = 0; x < 800; x += 56) X.fillRect(x, 0, 28, 470);
  K.celRR(-10, 440, 820, 30, 6, '#fff', 4, false);                       // skirting board
  // marble chequer floor
  X.fillStyle = '#f7f2ff'; X.fillRect(0, 470, 800, 130);
  for (let r = 0; r < 5; r++) for (let c = -2; c < 14; c++) if ((r + c) % 2) { X.fillStyle = '#d6cdf0'; X.beginPath(); const y = 470 + r * 26, w = 70 + r * 6, x = 400 + (c - 6) * w; X.moveTo(x, y); X.lineTo(x + w, y); X.lineTo(x + w + 6, y + 26); X.lineTo(x + 6 - 0, y + 26); X.closePath(); X.fill(); }
  K.horizon(470, 0, 800, 4);
  // gilt frames: three portraits (the faces are live: eyes that look around)
  for (const [x, w] of [[90, 120], [340, 120], [590, 120]]) { K.celRR(x - 8, 96, w + 16, 124, 8, '#e0a53a', 4.5, false); K.celRR(x, 104, w, 108, 4, '#a4d8f0', 2.5, false); }
  // ceiling lamp + curtain rod
  K.celRR(-10, 56, 820, 10, 5, '#a5622c', 3.5, false);
}
function bbStatues(sp) {
  const n = sp > 1.5 ? 6 : 5, S = sp > 1.15 ? 4 : 2, ORDER = S === 2 ? [1, 3] : [0, 1, 2, 3], sp0 = n === 5 ? 150 : 125;
  let v;
  for (let k = 0; k < 400; k++) {
    v = Array.from({ length: n }, () => ri(0, S - 1));
    let best = 99; for (let tg = 0; tg < S; tg++) best = Math.min(best, sum(v.map(x => (tg - x + S) % S)));
    if (!v.every(x => x === v[0]) && best <= (S === 2 ? 3 : 5) && best >= 2) break;
    if (k === 399) v = Array.from({ length: n }, (_, i) => i === 0 ? 1 % S : 0);
  }
  const st = { sel: 0, kb: false, hov: -1 }, tw = new Array(n).fill(0), last = { i: 0 };
  const cxs = v.map((_, i) => 400 + (i - (n - 1) / 2) * sp0);
  const rects = cxs.map(cx => ({ x: cx - (sp0 - 10) / 2, y: 190, w: sp0 - 10, h: 330 }));
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'ALIGN!', hint: 'CLICK STATUES TO TURN THEM (OR 1-6, ARROWS + SPACE)', thint: 'TAP STATUES UNTIL THEY ALL MATCH', dur: 5.8,
    update(dt) { g.c += dt; ou.mark(g); for (let i = 0; i < n; i++) tw[i] = Math.max(0, tw[i] - dt); },
    draw(t) {
      const X = ctx, ot = ou.t(g), won = g.result === 'win';
      X.drawImage(K.baked('statues', statuesScene), 0, 0);
      bbPrompt('ALL FACE THE SAME WAY');
      for (const [x, k] of [[90, 0], [340, 1], [590, 2]]) {     // painted faces, the eyes follow the last turned statue
        const fx = x + 60, look = clamp((cxs[last.i] - fx) / 300, -1, 1);
        K.celC(fx, 168, 30, ['#ffcba4', '#f0a37e', '#e8c79a'][k], 3.5, false); K.celRR(fx - 34, 190, 68, 22, 8, ['#6a3fb5', '#d9475a', '#2f9a55'][k], 3, false);
        for (const sd of [-1, 1]) K.eye(fx + sd * 11, 164, 6, g.result === 'lose' ? 'sad' : won ? 'happy' : null, [look, .1], now, k + sd);
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, 177, 7, .3, Math.PI - .3); ctx.stroke();
      }
      const mx = ((now * 40) % 1100) - 150; K.celE(mx, 462, 11, 7, '#9aa6c4', 2.5, false); K.celC(mx + 10, 459, 4.5, '#9aa6c4', 2, false); K.line([[mx - 10, 462], [mx - 22 - Math.sin(now * 20) * 3, 458]], 2, '#ff9ab0');
      for (let i = 0; i < n; i++) {
        const hov = st.hov === i && !g.result, cur = st.kb && st.sel === i && !g.result;
        const hop = won ? Math.abs(Math.sin(ot * 9 + i)) * 10 * Math.max(0, 1 - ot * .6) : 0;
        K.shade(cxs[i], 498, 58, 9, .28);
        K.celRR(cxs[i] - 52, 420, 104, 76, 12, hov ? YEL : TEAL, 4);
        if (cur) { K.rr(cxs[i] - 62, 200, 124, 300, 14); X.lineWidth = 5; X.strokeStyle = YEL; X.stroke(); }
        const sq = tw[i] > 0 ? Math.abs(Math.cos((1 - tw[i] / .18) * Math.PI / 2)) * .85 + .15 : 1;
        bbBust(cxs[i], 420 - hop, ORDER[v[i]], sq, won, i);
        if (!TOUCH) txt(String(i + 1), cxs[i], 460, 26, '#fff');
        if (!g.result && g.dur - g.c < 1.6) K.sweat(cxs[i] + 36, 330, .5, now + i * .3);
      }
      bbCaos(g, 400, 534, 3, ot, false); vignette(.2);
    }
  };
  bbInput(g, st, rects, n, i => {
    v[i] = (v[i] + 1) % S; tw[i] = .18; last.i = i; sfx.click(); sfx.whoosh(i % 2 === 0);
    if (v.every(x => x === v[0])) {
      g.result = 'win'; bbWinFx(400, 300); floatText(pick(WINW), 400, 150, YEL, 46);
      for (const cx of cxs) burst(cx, 300, YEL, 6, 200);
    }
  });
  return g;
}
reg('bb_statues', bbStatues, 'ALIGN!');

/* ═════════════ 8 PUSH: a clue (sum, product, dots or a numeral) and four buttons: push the one that fits ═════════════
   a game-show set: the clue on a bulb-lit TV, four arcade buzzers on the contestant console */
function bbDots(cx, cy, n, size, cells, col = ORG) {  // cells: list of [col,row] slots in a 5x2 / 3x3 grid, already chosen
  for (const c of cells.slice(0, n)) K.celC(cx + c[0], cy + c[1], size, col, 3);
}
function buttonsScene() {
  const X = K.cx();
  X.fillStyle = K.vg(0, 340, [[0, '#6a5fe0'], [1, '#9a92f7']]); X.fillRect(0, 0, 800, 340);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 0; x < 800; x += 60) X.fillRect(x, 0, 30, 340);
  for (const [x0, dir] of [[0, 1], [800, -1]]) {                          // curtains
    X.beginPath(); X.moveTo(x0, 0); X.lineTo(x0 + dir * 120, 0); X.quadraticCurveTo(x0 + dir * 70, 160, x0 + dir * 112, 340); X.lineTo(x0, 340); X.closePath(); K.ink('#d9475a', 4);
    X.save(); X.clip(); X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 7; for (let i = 1; i < 5; i++) { X.beginPath(); X.moveTo(x0 + dir * i * 22, 0); X.lineTo(x0 + dir * (i * 20 + 6), 340); X.stroke(); } X.restore();
  }
  // the console
  X.fillStyle = 'rgba(20,16,28,.3)'; X.fillRect(0, 324, 800, 12);
  K.celRR(-10, 330, 820, 290, 18, '#3a46b8', 4.5, false);
  X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(0, 346, 800, 4);
  X.fillStyle = 'rgba(20,16,28,.35)'; for (const x of [18, 782]) for (const y of [352, 540]) { X.beginPath(); X.arc(x, y, 5, 0, 7); X.fill(); }
  // TV bezel (bulbs are live)
  X.fillStyle = 'rgba(20,16,28,.3)'; K.rr(206, 106, 400, 200, 26); X.fill();
  K.celRR(194, 92, 412, 214, 26, '#2b3a8f', 5, false); K.celRR(212, 108, 376, 182, 16, CREAM, 4, false);
}
function bbButtons(sp) {
  const mx = clamp(5 + Math.floor((sp - 1) * 4), 5, 9), kinds = sp > 1.4 ? ['sum', 'dots', 'num', 'mul'] : ['sum', 'dots', 'num'], kind = pick(kinds);
  let ans, label = '';
  if (kind === 'sum') { const a = ri(1, mx), b = ri(1, mx); ans = a + b; label = `${a} + ${b} = ?`; }
  else if (kind === 'mul') { const a = ri(2, 5), b = ri(2, 5); ans = a * b; label = `${a} × ${b} = ?`; }
  else ans = ri(3, 9);
  const lo = kind === 'num' ? 1 : 0, hi = kind === 'num' ? 9 : 40, vals = new Set([ans]);
  for (let k = 0; vals.size < 4 && k < 200; k++) { const d = ri(1, 3) * (Math.random() < .5 ? -1 : 1), q = ans + d; if (q >= lo && q <= hi) vals.add(q); }
  for (let q = lo; vals.size < 4; q++) vals.add(q);
  const opts = [...vals].sort(() => Math.random() - .5), good = opts.indexOf(ans), st = { sel: 0, kb: false, hov: -1 };
  const slots = [], gridCells = (n, sx, sy, cols) => { const o = []; for (let i = 0; i < n; i++) o.push([(i % cols - (cols - 1) / 2) * sx, (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * sy]); return o; };
  const scatter = (() => {                                  // dots clue: n of 10 jittered slots
    const idx = Array.from({ length: 10 }, (_, i) => i).sort(() => Math.random() - .5).slice(0, ans);
    return idx.map(i => [((i % 5) - 2) * 64 + ri(-8, 8), (Math.floor(i / 5) - .5) * 56 + ri(-6, 6)]);
  })();
  const rects = opts.map((o, i) => ({ x: 55 + i * 172, y: 340, w: 150, h: 150 }));
  let chosen = -1, press = -1, pt = 0;
  const ou = K.outro();
  const g = {
    c: 0, cmd: 'PUSH!', hint: 'CLICK THE MATCHING BUTTON (OR 1-4, ARROWS + SPACE)', thint: 'TAP THE MATCHING BUTTON', dur: 5.6,
    update(dt) { g.c += dt; pt = Math.max(0, pt - dt); ou.mark(g); },
    draw(t) {
      const X = ctx, ot = ou.t(g);
      X.drawImage(K.baked('buttons', buttonsScene), 0, 0);
      bbPrompt('WHICH BUTTON?');
      // marquee bulbs round the TV: chase, rainbow on a win, dead red on a loss
      const pts = []; for (let i = 0; i < 12; i++) pts.push([212 + i * 34, 99]); for (let i = 0; i < 12; i++) pts.push([212 + i * 34, 299]); for (let i = 1; i < 6; i++) { pts.push([200, 99 + i * 33]); pts.push([600, 99 + i * 33]); }
      pts.forEach((q, i) => {
        const on = g.result === 'lose' ? false : g.result === 'win' ? true : ((now * 6 + i * .5) | 0) % 2 === 0;
        X.beginPath(); X.arc(q[0], q[1], 5.5, 0, 7); K.ink(g.result === 'lose' ? '#7a2530' : on ? (g.result === 'win' ? `hsl(${(i * 30 + now * 600) % 360},90%,60%)` : '#ffe14d') : '#b7a85a', 2);
      });
      X.save(); K.rr(212, 108, 376, 182, 16); X.clip();
      if (kind === 'dots') bbDots(400, 200, ans, 18, scatter);
      else if (kind === 'num') txt(String(ans), 400, 200, 120, INK);
      else txt(label, 400, 200, 80, INK, 'center', 340);
      X.fillStyle = 'rgba(255,255,255,.35)'; K.rr(222, 114, 150, 10, 5); X.fill(); X.restore();
      for (let i = 0; i < 4; i++) {
        const r = rects[i], mark = bbMark(g, i, good, chosen), down = (press === i && pt > 0) || (g.result && i === chosen);
        const lift = (st.hov === i && !g.result) ? -4 : 0, dy = down ? 10 : lift, cx = r.x + r.w / 2, cy = r.y + 70, col = mark === 'good' ? LIME : mark === 'bad' ? '#ff9a9a' : PINK;
        K.celRR(r.x, r.y + 14, r.w, r.h - 14, 22, NAVY, 4, false);                                // plate
        K.shade(cx, cy + 62, 60, 8, .28);
        K.celC(cx, cy + 8, 64, K.mix(col, '#14101c', .35), 4, false);                              // dome base
        K.celC(cx, cy - 4 + dy, 58, col, 4);                                                       // the cap
        if (st.kb && st.sel === i && !g.result) { X.beginPath(); X.arc(cx, cy, 72, 0, 7); X.lineWidth = 5; X.strokeStyle = YEL; X.stroke(); }
        if (kind === 'num') bbDots(cx, cy - 4 + dy, opts[i], 11, gridCells(opts[i], 27, 27, 3), '#fff'); else txt(String(opts[i]), cx, cy - 2 + dy, 64, '#fff');
        if (!TOUCH) { X.beginPath(); X.arc(r.x + 16, r.y + 28, 12, 0, 7); K.ink('#fff', 2.5); X.fillStyle = INK; X.font = '700 15px Fredoka, Arial, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(String(i + 1), r.x + 16, r.y + 29); }
        if (g.result && mark) { X.beginPath(); X.arc(r.x + r.w - 16, r.y + 28, 13, 0, 7); K.ink(mark === 'good' ? '#4fd06a' : '#ff4d5e', 3); txt(mark === 'good' ? '✓' : '✗', r.x + r.w - 16, r.y + 29, 16, '#fff'); }
      }
      bbCaos(g, 108, 336, 3.6, ot); vignette(.2);
    }
  };
  bbInput(g, st, rects, 4, i => {
    chosen = i; press = i; pt = .2; sfx.stamp();
    if (i === good) { g.result = 'win'; bbWinFx(rects[i].x + 75, rects[i].y + 60); floatText(pick(WINW), 400, 300, YEL, 44); }
    else { g.result = 'lose'; bbLoseFx(rects[i].x + 75, rects[i].y + 60); floatText('WRONG!', 400, 300, RED, 46); }
  });
  return g;
}
reg('bb_buttons', bbButtons, 'PUSH!');

})();
