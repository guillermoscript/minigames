'use strict';
/* Nintendo DS pack (WarioWare Touched!/Snapped! inspired) — every game: {cmd, hint, thint, dur, update(dt), draw(t)}; set g.result = 'win'|'lose'
   Art: DUO look (docs/ART-STYLE.md). Each game is a place with a gag; static scenery is baked once per game (DSK.bake). Decor randomness is DSK.hr (a hash), never the game RNG. */

/* ───────────── DUO-look drawing kit for this file. Everything draws on the kit's X, which use(c) points at the live ctx or at an offscreen layer. ───────────── */
const DSK = (() => {
  const TAU = Math.PI * 2, K = { TAU };
  let X = null;
  K.use = c => { X = c; };
  K.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  K.ease = k => { k = K.clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  K.outBack = k => { k = K.clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
  K.hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  K.rrP = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  K.elP = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; };
  K.polyP = pts => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; };
  K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); };
  K.ink = (fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  /* cel shading: the base is a copy shifted by (-sx, -sy), so the shade shows as a crescent on the (sx, sy) side */
  K.cel = (p, base, shade, sx, sy, o = 4) => { K.inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  K.glint = (p, x, y, rx, ry, col = 'rgba(255,255,255,.55)', rot = -.5) => { X.save(); X.clip(p); X.fillStyle = col; K.el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  K.line = (pts, w, col, ol = 6) => { X.lineJoin = 'round'; X.lineCap = 'round'; X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.strokeStyle = INK; X.lineWidth = w + ol; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); };
  K.dot = (x, y, r, col, o = 3) => { X.beginPath(); X.arc(x, y, r, 0, TAU); K.ink(col, o); };
  K.text = (s, x, y, size, fill) => { X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round'; X.lineWidth = size / 5; X.strokeStyle = INK; X.strokeText(s, x, y); X.fillStyle = fill; X.fillText(s, x, y); };
  K.starP = (cx, cy, ro, ri, n, rot, fill, o = 3) => { X.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; X.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } X.closePath(); K.ink(fill, o); };
  K.layer = fn => { const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; K.use(c.getContext('2d')); X.translate(OX, 0); fn(X); K.use(old); return c; };
  K.bake = (h, fn) => { if (!h.c || h.ox !== OX || h.w !== VW) { h.c = K.layer(fn); h.ox = OX; h.w = VW; } ctx.drawImage(h.c, -OX, 0); };
  K.grad = (y0, y1, stops) => { const g = X.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); X.fillStyle = g; X.fillRect(-OX, y0, VW, y1 - y0); };
  K.pill = (x, y, label, col = '#FFE14D', up = false) => {
    X.font = '700 15px Fredoka, Arial, sans-serif'; const w = X.measureText(t(label)).width + 26, h = 24;
    X.save(); X.translate(x, y);
    X.beginPath(); X.moveTo(-7, up ? -h / 2 + 1 : h / 2 - 1); X.lineTo(0, up ? -h / 2 - 9 : h / 2 + 9); X.lineTo(7, up ? -h / 2 + 1 : h / 2 - 1); X.closePath(); K.ink(col, 3);
    K.rr(-w / 2, -h / 2, w, h, h / 2); K.ink(col, 3);
    X.fillStyle = 'rgba(255,255,255,.35)'; K.rr(-w / 2 + 8, -h / 2 + 4, w - 16, 5, 2.5); X.fill();
    txt(label, 0, 1, 15, INK); X.restore();
  };
  K.badge = (s, x, y, size, bg, fg, sc = 1, rot = 0) => {
    X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc);
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(560, X.measureText(t(s)).width + size * .9), h = size * 1.4;
    X.fillStyle = 'rgba(20,16,28,.3)'; K.rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); X.fill();
    K.rr(-w / 2, -h / 2, w, h, h * .46); K.ink(bg, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; K.rr(-w / 2 + 10, -h / 2 + 5, w - 20, h * .2, h * .1); X.fill();
    txt(s, 0, 2, size, fg, 'center', w - 16); X.restore();
  };
  K.keyCap = (x, y, s) => { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(s).width + 14); K.rr(x - w / 2, y - 12, w, 24, 6); K.ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); };
  /* blocky arms out of claude()'s side stubs (origin = Claude's feet); angle 0 = straight up, PI = down */
  K.arms = (u, la, ra, col = OR) => {
    const ol = Math.max(3, u * .5), L = 3.3 * u, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    const one = (sx, an) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
      X.restore();
    };
    if (la != null) one(-1, la); if (ra != null) one(1, ra);
  };
  /* Claude with arms and a ground shadow; o = {mood, col, la, ra} */
  K.hero = (x, y, u, o = {}) => {
    shadow(x, y + 3, u * 7, u * 1.4, .28);
    X.save(); X.translate(x, y); K.arms(u, o.la == null ? -2.7 : o.la, o.ra == null ? 2.7 : o.ra, o.col || OR); X.restore();
    claude(x, y, u, { mood: o.mood, col: o.col });
  };
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    K.ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; K.el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, k) => {
    X.save(); X.globalAlpha = 1 - k; X.translate(x, y + k * 16); X.scale(s, s);
    X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 5); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath(); K.ink('#9fe3ff', 2.2);
    X.fillStyle = '#fff'; K.el(-1.6, -1, 1.4, 2.2, -.3); X.fill(); X.restore();
  };
  K.cloud = (x, y, s) => {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); K.ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); }
    X.restore();
  };
  K.sun = (x, y, r, tt, mood) => {
    X.save(); X.translate(x, y); X.rotate(tt * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(r * 1.1, -r * .14); X.lineTo(r * 1.9, 0); X.lineTo(r * 1.1, r * .14); X.closePath(); X.fill(); }
    X.restore();
    X.beginPath(); X.arc(x, y, r, 0, TAU); K.ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; K.el(x - r * .3, y - r * .35, r * .35, r * .22, -.5); X.fill();
    if (mood) {
      X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round';
      if (mood === 'shades') { K.rr(x - r * .75, y - r * .3, r * .6, r * .36, 6); K.ink('#2b2b3a', 3); K.rr(x + r * .15, y - r * .3, r * .6, r * .36, 6); K.ink('#2b2b3a', 3); X.beginPath(); X.moveTo(x - r * .15, y - r * .2); X.lineTo(x + r * .15, y - r * .2); X.stroke(); X.beginPath(); X.arc(x, y + r * .15, r * .38, .25, Math.PI - .25); X.stroke(); }
      else { X.beginPath(); X.moveTo(x - r * .5, y - r * .15); X.lineTo(x - r * .2, y - r * .02); X.moveTo(x + r * .5, y - r * .15); X.lineTo(x + r * .2, y - r * .02); X.stroke(); X.beginPath(); X.arc(x, y + r * .35, r * .3, Math.PI + .3, -.3); X.stroke(); }
    }
  };
  /* a cartoon eye (crane eye()): moods happy, dead, panic, plus idle */
  K.eye = (x, y, r, mood, lx = 0, ly = 0, k = 0) => {
    X.lineJoin = 'round'; X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = Math.max(2.5, r * .36);
    if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .45, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
    if (mood === 'dead') { const q = r * .62; X.beginPath(); X.moveTo(x - q, y - q); X.lineTo(x + q, y + q); X.moveTo(x + q, y - q); X.lineTo(x - q, y + q); X.stroke(); return; }
    const s = mood === 'panic' ? 1.3 : 1, rx = r * s, ry = r * 1.08 * s;
    if (mood !== 'panic' && Math.sin(now * 1.9 + k) > .985) { X.beginPath(); X.moveTo(x - rx * .8, y); X.lineTo(x + rx * .8, y); X.stroke(); return; }
    K.el(x, y, rx, ry); K.ink('#fff', Math.max(1.4, r * .28));
    const m = Math.max(1, Math.hypot(lx, ly)), pr = r * (mood === 'panic' ? .3 : .52), px = x + lx / m * r * .4, py = y + ly / m * r * .4;
    X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fill();
    X.fillStyle = '#fff'; X.beginPath(); X.arc(px - pr * .35, py - pr * .4, Math.max(1.2, pr * .38), 0, TAU); X.fill();
  };
  K.stylus = (x, y, ang = -1) => {                 // a DS stylus; the tip is at (x, y)
    X.save(); X.translate(x, y); X.rotate(ang);
    K.rr(-4, -78, 8, 66, 4); K.ink('#cfd8e6', 3); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(-2, -74, 2.5, 56);
    X.beginPath(); X.moveTo(-4, -12); X.lineTo(0, 0); X.lineTo(4, -12); X.closePath(); K.ink('#4a4560', 3); X.restore();
  };
  return K;
})();
const dsPtIn = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
function dsInPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const dsMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const dsRnd = (a, b) => a + Math.random() * (b - a);
const dsWin = (x, y, n = 30) => { confetti(x, y, n); sfx.sparkle(); ring(x, y, '#FFE14D', 120); burst(x, y, '#5CFF7A', 12); };
const dsLose = (x, y) => { sfx.miss(); shake(10, .3); if (x != null) { burst(x, y, '#ff4d5e', 12); ring(x, y, '#ff4d5e', 80); } };
function dsBoom(x, y, r, t) {
  star(x, y, r, r * .55, 12, t * 3, '#ffd23f', 6); star(x, y, r * .62, r * .3, 10, -t * 4, '#ff7a2f', 4); star(x, y, r * .3, r * .14, 8, t * 5, '#fff3a0', 2);
}
/* the hero's arms: idle down, cheering on a win, flopped on a loss (a = bounce phase) */
const dsArms = (g, t) => g.result === 'win' ? [-.5 + Math.sin(t * 12) * .25, .5 - Math.sin(t * 12) * .25] : g.result === 'lose' ? [-2.3, 2.3] : [-2.7, 2.7];

/* ── 1 ── RAMP IT UP: draw a ramp so the ball lands in the cup
   Art: a tiled kitchen. The ball is a tomato with a face, the cup is a hungry cooking pot, the ink is a vial, the cat clock's eyes tick. */
function dsRamp(sp) {
  const K = DSK, k = Math.sqrt(sp), INKMAX = 340, cupX = dsRnd(570, 700), cupY = 470;
  const ball = { x: dsRnd(120, 250), y: 110, vx: 0, vy: 0, r: 15, on: false };
  const strokes = []; let cur = null, used = 0, drawing = false, clock = 0, drop = 0, rT0 = -1;
  const fixed = [
    [380, 430, 470, 430], [380, 430, 380, 600], [470, 430, 470, 600],
    [cupX - 55, cupY, cupX - 40, cupY + 70], [cupX + 55, cupY, cupX + 40, cupY + 70], [cupX - 40, cupY + 70, cupX + 40, cupY + 70]
  ];
  const release = () => { if (!ball.on) { ball.on = true; sfx.whoosh(false); sfx.click(); } };
  const bk = {};
  const kitchen = c => {
    K.grad(0, 520, ['#aee9dc', '#e3fff4']);
    c.strokeStyle = 'rgba(40,130,110,.3)'; c.lineWidth = 2;
    for (let x = -Math.ceil(OX / 52) * 52; x < W + OX; x += 52) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 520); c.stroke(); }
    for (let y = 52; y < 520; y += 52) { c.beginPath(); c.moveTo(-OX, y); c.lineTo(W + OX, y); c.stroke(); }
    // window with a sill
    K.rr(590, 92, 150, 112, 10); K.ink('#8fdcff', 4); c.fillStyle = '#c9f1ff'; c.fillRect(594, 150, 142, 50);
    c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(665, 92); c.lineTo(665, 204); c.moveTo(590, 148); c.lineTo(740, 148); c.stroke();
    K.rr(578, 202, 174, 14, 5); K.ink('#d9944f', 3);
    // shelf with jars
    K.rr(556, 330, 190, 12, 4); K.ink('#d9944f', 3);
    [['#ff7a8a', 570], ['#ffd23f', 622], ['#7fd34a', 676]].forEach(([col, x], i) => { const h = 40 + i * 6; K.rr(x, 330 - h, 40, h, 8); K.ink(col, 3); c.fillStyle = 'rgba(255,255,255,.4)'; K.rr(x + 6, 330 - h + 6, 7, h - 14, 3); c.fill(); K.rr(x + 6, 330 - h - 8, 28, 10, 3); K.ink('#d9944f', 2.5); });
    // floor
    K.grad(518, H, ['#e8c48a', '#c4965a']); c.fillStyle = INK; c.fillRect(-OX, 516, VW, 5);
    c.strokeStyle = 'rgba(120,70,30,.3)'; c.lineWidth = 3; for (let x = -Math.ceil(OX / 90) * 90; x < W + OX; x += 90) { c.beginPath(); c.moveTo(x, 521); c.lineTo(x - 30, H); c.stroke(); }
    // the wooden stool the ramp must clear (hitbox 380..470 x 430..)
    const sp1 = K.rrP(380, 430, 90, 170, 6); K.cel(sp1, '#d9944f', '#a5622c', 8, 0, 4);
    c.strokeStyle = 'rgba(120,70,30,.45)'; c.lineWidth = 3; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(380 + i * 22, 444); c.lineTo(380 + i * 22, 598); c.stroke(); }
    K.rr(372, 424, 106, 16, 6); K.ink('#f2b878', 4);
  };
  const g = {
    wide: true, cmd: 'DRAW!', hint: 'DRAG TO DRAW A RAMP FOR THE BALL', thint: 'DRAW A RAMP WITH YOUR FINGER', dur: 4.8,
    down(p) { if (used >= INKMAX || g.result) return; cur = { pts: [{ x: p.x, y: p.y }] }; strokes.push(cur); drawing = true; },
    move(p) {
      if (!drawing || !cur || g.result) return;
      const l = cur.pts[cur.pts.length - 1], d = Math.hypot(p.x - l.x, p.y - l.y);
      if (d < 7) return;
      let q = p, dd = d;
      if (used + d > INKMAX) { const f = (INKMAX - used) / d; q = { x: l.x + (p.x - l.x) * f, y: l.y + (p.y - l.y) * f }; dd = INKMAX - used; }
      cur.pts.push({ x: q.x, y: q.y }); used += dd;
      if (Math.random() < .3) sfx.blip((used / 40) | 0);
      if (used >= INKMAX - .01) { drawing = false; release(); }
    },
    up() { drawing = false; release(); },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result) return;
      clock += dt; drop = Math.max(0, drop);
      if (!ball.on && clock > 1.9 / k) release();
      if (!ball.on) return;
      const gt = dt * k, N = 6;
      for (let s = 0; s < N; s++) {
        const h = gt / N;
        ball.vy += 900 * h; ball.x += ball.vx * h; ball.y += ball.vy * h;
        const segs = fixed.slice();
        for (const st of strokes) for (let i = 1; i < st.pts.length; i++) segs.push([st.pts[i - 1].x, st.pts[i - 1].y, st.pts[i].x, st.pts[i].y]);
        for (const sg of segs) {
          const dx = sg[2] - sg[0], dy = sg[3] - sg[1], l2 = dx * dx + dy * dy || 1;
          const kk = Math.max(0, Math.min(1, ((ball.x - sg[0]) * dx + (ball.y - sg[1]) * dy) / l2));
          const qx = sg[0] + dx * kk, qy = sg[1] + dy * kk, ddx = ball.x - qx, ddy = ball.y - qy, d = Math.hypot(ddx, ddy), R = ball.r + 4;
          if (d < R && d > 1e-6) {
            const nx = ddx / d, ny = ddy / d; ball.x += nx * (R - d); ball.y += ny * (R - d);
            const vn = ball.vx * nx + ball.vy * ny;
            if (vn < 0) { ball.vx -= 1.3 * vn * nx; ball.vy -= 1.3 * vn * ny; if (vn < -120) { if (Math.random() < .6) sfx.tick(); if (vn < -300) burst(ball.x, ball.y + ball.r, '#fff', 3, 120); } }
          }
        }
        ball.vx *= 1 - .15 * h;
      }
      if (Math.abs(ball.x - cupX) < 42 && ball.y > cupY + 14 && ball.y < cupY + 70) { g.result = 'win'; sfx.splat(); sfx.coin(); dsWin(cupX, cupY, 36); }
      else if (ball.y > H + 40 || ball.x < -OX - 40 || ball.x > W + OX + 40) { g.result = 'lose'; dsLose(Math.max(30 - OX, Math.min(W + OX - 30, ball.x)), Math.min(H - 30, ball.y)); }
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose';
      K.bake(bk, kitchen);
      // sky inside the window: a drifting cloud
      ctx.save(); K.rr(594, 96, 142, 104, 8); ctx.clip(); K.cloud(530 + (t * 10) % 230, 140, .6); ctx.restore();
      // cat clock: its eyes and tail tick together
      const sw = Math.sin(t * 3.2), cx = 470, cy = 150;
      K.line([[cx, cy + 24], [cx + sw * 14, cy + 66]], 5, '#ff9f4d', 6); K.dot(cx + sw * 14, cy + 70, 9, '#ff9f4d', 3);
      const ears = K.polyP([[cx - 28, cy - 12], [cx - 20, cy - 42], [cx - 6, cy - 24]]); K.cel(ears, '#ff9f4d', '#d9792e', 3, 0, 3);
      const ears2 = K.polyP([[cx + 28, cy - 12], [cx + 20, cy - 42], [cx + 6, cy - 24]]); K.cel(ears2, '#ff9f4d', '#d9792e', 3, 0, 3);
      K.dot(cx, cy, 30, '#ff9f4d', 4); ctx.fillStyle = '#fff'; K.el(cx - 11, cy - 4, 8, 10); ctx.fill(); K.el(cx + 11, cy - 4, 8, 10); ctx.fill();
      ctx.fillStyle = INK; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 11 + sw * 3, cy - 3, 4, 0, 7); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy + 8, 7, .2, Math.PI - .2); ctx.stroke();
      // Claude the cook watches the tomato
      const ar = dsArms(g, t), cook = { x: 100, y: 540 };
      K.hero(cook.x, cook.y, 4.4, { mood: dsMood(g), la: ar[0], ra: ar[1] });
      ctx.save(); ctx.translate(cook.x, cook.y - 9 * 4.4 - 6); K.rr(-17, -6, 34, 12, 4); K.ink('#fff', 3); K.dot(-9, -16, 10, '#fff', 3); K.dot(9, -16, 10, '#fff', 3); K.dot(0, -20, 11, '#fff', 3); ctx.restore();
      // the pot: back rim, then (later) the front body
      const sqz = win ? 1 + .1 * Math.sin(ot * 18) * Math.exp(-ot * 3) : 1;
      shadow(cupX, cupY + 76, 58, 8, .25);
      ctx.save(); ctx.translate(cupX, cupY + 70); ctx.scale(1 / sqz, sqz); ctx.translate(-cupX, -cupY - 70);
      for (const s of [-1, 1]) { K.rr(cupX + s * 56 - 7, cupY + 8, 14, 22, 6); K.ink('#d9552e', 3); }
      K.el(cupX, cupY, 55, 11); K.ink('#5a2a1a', 4);
      ctx.restore();
      // strokes: a yellow marker with an ink edge
      for (const st of strokes) { if (st.pts.length > 1) K.line(st.pts.map(q => [q.x, q.y]), 6, '#FFE14D', 7); else K.dot(st.pts[0].x, st.pts[0].y, 4, '#FFE14D', 3); }
      // the tomato
      const outOfBounds = lose && (ball.y > H + 20 || ball.x < -OX || ball.x > W + OX);
      if (!outOfBounds && !(win)) {
        const by = ball.on ? ball.y : 110 + Math.sin(t * 5) * 4, sq = ball.on ? Math.min(.25, Math.hypot(ball.vx, ball.vy) / 3500) : 0;
        ctx.save(); ctx.translate(ball.x, by); ctx.scale(1 - sq, 1 + sq);
        const body = K.elP(0, 0, ball.r, ball.r); K.cel(body, '#ff4d4d', '#c9302f', 4, 3, 4); K.glint(body, -5, -7, 5, 3, 'rgba(255,255,255,.6)');
        for (const a of [-.9, 0, .9]) { ctx.save(); ctx.rotate(a); K.el(0, -ball.r + 1, 3.2, 6); K.ink('#3fbf5a', 2); ctx.restore(); }
        const fast = ball.on && Math.hypot(ball.vx, ball.vy) > 420;
        K.eye(-5.5, -1, 4.4, lose ? 'dead' : fast ? 'panic' : null, (cupX - ball.x) / 80, 1, 3); K.eye(5.5, -1, 4.4, lose ? 'dead' : fast ? 'panic' : null, (cupX - ball.x) / 80, 1, 5);
        ctx.restore();
        if (!ball.on) txt('v', ball.x, by + 36 + Math.sin(t * 8) * 3, 22, '#fff');
      }
      // pot front with a face that follows the ball
      ctx.save(); ctx.translate(cupX, cupY + 70); ctx.scale(1 / sqz, sqz); ctx.translate(-cupX, -cupY - 70);
      const pot = K.polyP([[cupX - 55, cupY], [cupX + 55, cupY], [cupX + 40, cupY + 70], [cupX - 40, cupY + 70]]);
      K.cel(pot, '#ff8a4d', '#d9552e', 9, 0, 5); K.glint(pot, cupX - 30, cupY + 16, 8, 18, 'rgba(255,255,255,.5)', -.3);
      const near = Math.hypot(ball.x - cupX, ball.y - cupY) < 150 && ball.on;
      const look = [K.clamp((ball.x - cupX) / 60, -1, 1), K.clamp((ball.y - cupY) / 60, -1, 1)];
      K.eye(cupX - 15, cupY + 30, 7.5, win ? 'happy' : lose ? 'dead' : near ? 'panic' : null, look[0], look[1], 1); K.eye(cupX + 15, cupY + 30, 7.5, win ? 'happy' : lose ? 'dead' : near ? 'panic' : null, look[0], look[1], 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      if (win) ctx.arc(cupX, cupY + 40, 12, .1, Math.PI - .1); else if (lose) ctx.arc(cupX, cupY + 58, 11, Math.PI + .3, -.3); else if (near) { ctx.ellipse(cupX, cupY + 52, 9, 12, 0, 0, 7); } else ctx.arc(cupX, cupY + 44, 9, .2, Math.PI - .2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,110,150,.5)'; K.el(cupX - 28, cupY + 44, 7, 4); ctx.fill(); K.el(cupX + 28, cupY + 44, 7, 4); ctx.fill();
      ctx.restore();
      K.el(cupX, cupY, 55, 11); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.strokeStyle = '#ffb77a'; ctx.lineWidth = 3; ctx.stroke();
      if (win) { // soup steam + the lid hops
        const lh = Math.abs(Math.sin(ot * 10)) * 18 * Math.exp(-ot * 1.5);
        K.rr(cupX - 40, cupY - 22 - lh, 80, 12, 6); K.ink('#cfd8e6', 3); K.dot(cupX, cupY - 28 - lh, 6, '#cfd8e6', 3);
        for (let i = 0; i < 3; i++) { const ph = (ot * 1.4 + i * .33) % 1; K.heart(cupX - 26 + i * 26, cupY - 40 - ph * 70, .8, 1 - ph); }
      }
      if (lose) { // a splat on the floor
        const sx = K.clamp(ball.x, 44 - OX, W + OX - 44), sc = K.outBack(ot / .18);
        ctx.save(); ctx.translate(sx, 532); ctx.scale(sc, sc); K.el(0, 0, 40, 11); K.ink('#ff4d4d', 3);
        for (const [a, b] of [[-26, -5], [18, 3], [30, -8], [-8, 4]]) K.dot(a, b, 3.5, '#fff3a0', 1.5);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; K.el(-12, -3, 8, 2); ctx.fill(); ctx.restore();
        K.sweat(cupX + 34, cupY + 18, 1, (ot * 1.5) % 1);
      }
      // the ink vial
      K.rr(24, 114, 34, 214, 15); K.ink('rgba(255,255,255,.85)', 4);
      const f = 1 - used / INKMAX; ctx.save(); K.rr(28, 118, 26, 206, 11); ctx.clip(); ctx.fillStyle = '#4D7CFF'; ctx.fillRect(28, 118 + 206 * (1 - f), 26, 206 * f); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(32, 126, 5, 190); ctx.restore();
      K.rr(26, 104, 30, 14, 5); K.ink('#d9944f', 3);
      txt('INK', 41, 344, 16, '#fff');
      if (drawing && !g.result) K.stylus(mouse.x, mouse.y);
      vignette(.16);
    }
  };
  return g;
}

/* ── 2 ── MIDNIGHT WEIRDO: find the creep with the flashlight
   Art: a sleepy suburban street at night. Every shape is inked and shaded, lit things get startled, the creep's trench coat flaps open on a win. */
function dsCreep(sp) {
  const K = DSK, R = TOUCH ? 110 : 95, kinds = shuffle(['creep', 'cat', 'mailbox', 'trash', 'bush']);
  const cells = shuffle([[150, 250], [400, 230], [650, 260], [220, 440], [440, 450], [660, 440]]).slice(0, 5).map(c => [W / 2 + (c[0] - W / 2) * VW / W, c[1]]);
  const figs = kinds.map((kd, i) => ({ kind: kd, x: cells[i][0] + dsRnd(-35, 35), y: cells[i][1] + dsRnd(-25, 25), ph: Math.random() * 6 }));
  const eyeY = { creep: -104, cat: -34, trash: -38, bush: -30 };
  let rT0 = -1; const bk = {};
  const night = c => {
    K.grad(0, 230, ['#1b2350', '#3a4a8a', '#5a64a8']);
    for (let i = 0; i < 40 * VW / W; i++) { c.fillStyle = 'rgba(255,255,255,' + (.5 + K.hr(i) * .5) + ')'; c.fillRect(K.hr(i + 9) * VW - OX, K.hr(i + 31) * 160 + 14, 3, 3); }
    // far houses (coloured outlines, no ink) with lit windows
    for (let i = -1; i < 7 * VW / W; i++) {
      const x = i * 130 - OX + K.hr(i + 5) * 30, h = 70 + K.hr(i + 2) * 50, hue = ['#2a3466', '#33407a', '#27305c'][i & 1 ? 1 : (i & 3) ? 0 : 2];
      c.fillStyle = hue; c.strokeStyle = '#1d2550'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 232); c.lineTo(x, 232 - h); c.lineTo(x + 52, 232 - h - 34); c.lineTo(x + 104, 232 - h); c.lineTo(x + 104, 232); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = K.hr(i + 8) > .35 ? '#ffd86b' : '#4a5690'; c.fillRect(x + 24, 232 - h + 14, 18, 22); c.fillRect(x + 62, 232 - h + 14, 18, 22);
    }
    // lawn, sidewalk, road
    K.grad(226, 330, ['#2f7a55', '#27604a']); c.fillStyle = INK; c.fillRect(-OX, 224, VW, 5);
    c.fillStyle = '#6c7390'; c.fillRect(-OX, 330, VW, 40); c.fillStyle = INK; c.fillRect(-OX, 368, VW, 4);
    K.grad(372, H, ['#3a3f5c', '#2c3048']); c.fillStyle = '#e8d56a'; for (let x = -OX + 20; x < W + OX; x += 120) c.fillRect(x, 500, 60, 8);
    // picket fence
    for (let x = -Math.ceil(OX / 40) * 40; x < W + OX; x += 40) { K.rr(x, 214, 18, 74, 5); K.ink('#e9ecf8', 3); }
    K.rr(-OX, 236, VW, 10, 4); K.ink('#dfe3f2', 3); K.rr(-OX, 266, VW, 10, 4); K.ink('#dfe3f2', 3);
    // moon
    K.dot(W + OX - 110, 90, 34, '#FFF3B0', 4); c.fillStyle = 'rgba(220,200,130,.5)'; K.el(W + OX - 98, 98, 8, 6); c.fill(); K.el(W + OX - 122, 82, 6, 5); c.fill();
  };
  const creepFig = (lit, win, lose, t) => {
    const skin = '#f1c8a0';
    for (const s of [-1, 1]) { K.rr(s * 14 - 8, -16, 16, 18, 4); K.ink('#3a3550', 3); }
    if (win) {
      const body = K.rrP(-20, -96, 40, 82, 10); K.cel(body, '#ffe0b8', '#e8b98a', 5, 0, 4);
      K.rr(-18, -48, 36, 26, 8); K.ink('#ff7a9a', 3); for (const [a, b] of [[-8, -38], [8, -32]]) K.heart(a, b, .5);
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 22, -96); ctx.rotate(-s * (.5 + Math.sin(t * 14) * .08)); const fl = K.rrP(-9, 0, 18, 88, 7); K.cel(fl, '#b9925e', '#8a6a40', s * 4, 0, 4); ctx.restore(); }
    } else {
      const coat = K.rrP(-30, -98, 60, 94, 16); K.cel(coat, '#b9925e', '#8a6a40', 8, 0, 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(0, -6); ctx.stroke();
      for (const y of [-70, -48, -26]) K.dot(7, y, 3, '#ffe14d', 2);
      K.rr(-32, -88, 12, 52, 5); K.ink('#a47f4e', 3);
    }
    const head = K.elP(0, -112, 20, 21); K.cel(head, skin, '#d8a77c', 5, 2, 4);
    const hx = K.clamp((mouse.x - 0) / 800 - .5, -.5, .5);
    K.eye(-8, -112, 5.6, win ? 'happy' : lose ? null : lit ? 'panic' : null, hx * 8, 2, 1); K.eye(8, -112, 5.6, win ? 'happy' : lose ? null : lit ? 'panic' : null, hx * 8, 2, 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, -122); ctx.lineTo(-3, -118); ctx.moveTo(14, -122); ctx.lineTo(3, -118); ctx.stroke();   // sly brows
    ctx.fillStyle = '#2c2840'; K.el(0, -102, 11, 3.6); ctx.fill();   // moustache
    ctx.beginPath(); ctx.arc(0, -98, 8, .2, Math.PI - .2); ctx.lineWidth = 3.5; ctx.stroke();
    K.rr(-33, -133, 66, 10, 5); K.ink('#3a3550', 3.5); const crown = K.rrP(-18, -158, 36, 30, 8); K.cel(crown, '#4a4560', '#2c2840', 5, 0, 3.5); K.rr(-18, -135, 36, 7, 2); K.ink('#ff4d5e', 2);
  };
  const drawFig = (f, lit, t, ot) => {
    const { x, y, kind } = f, hitIt = g.hit === f;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    if (hitIt && g.result) { const sq = 1 + Math.sin(ot * 24) * .05 * Math.exp(-ot * 2); ctx.scale(sq, 2 - sq); }
    if (kind === 'creep') creepFig(lit, hitIt && g.result === 'win', g.result === 'lose' && !hitIt, t);
    else if (kind === 'cat') {
      K.line([[26, -10], [58, -20], [48, -52 + Math.sin(t * 3 + f.ph) * 6]], 7, '#ff9f4d', 6);
      const b = K.elP(0, -22, 30, 26); K.cel(b, '#ff9f4d', '#d9792e', 6, 3, 4); K.glint(b, -10, -34, 8, 5);
      const h = K.elP(0, -54, 23, 21); K.cel(h, '#ff9f4d', '#d9792e', 5, 2, 4);
      for (const s of [-1, 1]) { const e = K.polyP([[s * 8, -68], [s * 22, -86], [s * 24, -58]]); K.cel(e, '#ff9f4d', '#d9792e', 2, 0, 3.5); }
      const bad = hitIt && g.result === 'lose';
      K.eye(-9, -54, 6, bad || lit ? 'panic' : null, 0, 1, f.ph); K.eye(9, -54, 6, bad || lit ? 'panic' : null, 0, 1, f.ph + 1);
      ctx.fillStyle = '#ff6b8a'; ctx.beginPath(); ctx.moveTo(-3, -46); ctx.lineTo(3, -46); ctx.lineTo(0, -42); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 10, -44); ctx.lineTo(s * 28, -46); ctx.moveTo(s * 10, -41); ctx.lineTo(s * 28, -38); ctx.stroke(); }
      if (bad) { for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(0, -22); ctx.rotate(-1.2 + i * .5); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(42, 0); ctx.stroke(); ctx.restore(); } }
    } else if (kind === 'mailbox') {
      K.rr(-5, -50, 10, 50, 3); K.ink('#a5622c', 3);
      const m = K.rrP(-34, -92, 68, 46, 18); K.cel(m, '#4D7CFF', '#2f55c4', 8, 4, 4); K.glint(m, -14, -80, 12, 4);
      K.rr(-22, -76, 44, 8, 3); K.ink('#14101c', 2);
      const up = hitIt && g.result ? 0 : -.8; ctx.save(); ctx.translate(34, -76); ctx.rotate(up); K.rr(-3, -34, 7, 40, 3); K.ink('#ff4d5e', 2.5); K.rr(-3, -34, 22, 12, 3); K.ink('#ff4d5e', 2.5); ctx.restore();
      if (hitIt && g.result === 'lose') { K.rr(-24, -66, 48, 6, 2); K.ink('#fff', 2); }
    } else if (kind === 'trash') {
      const c2 = K.rrP(-26, -66, 52, 66, 8); K.cel(c2, '#8e98a8', '#667184', 9, 0, 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; for (const i of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(i, -58); ctx.lineTo(i, -10); ctx.stroke(); }
      ctx.save(); ctx.translate(0, -80); ctx.rotate(hitIt && g.result ? -.5 : 0); K.rr(-32, -7, 64, 14, 6); K.ink('#aab3c2', 4); ctx.restore();
      K.line([[18, -84], [26, -96], [34, -86]], 4, '#ffe14d', 4);
    } else {
      for (const [a, b, r] of [[-22, -22, 24], [20, -24, 28], [0, -44, 26]]) { const p = K.elP(a, b, r, r); K.cel(p, '#3fbf5a', '#2a8f44', 5, 4, 4); }
      ctx.fillStyle = '#ff7a9a'; for (const [a, b] of [[-26, -34], [12, -52], [30, -24]]) { ctx.beginPath(); ctx.arc(a, b, 4, 0, 7); ctx.fill(); }
      if (hitIt && g.result === 'lose') for (const s of [-1, 1]) K.eye(s * 12, -40, 6, 'panic', 0, 1, 1);
    }
    ctx.restore();
  };
  let lx = 0, ly = 0;
  const g = {
    wide: true, cmd: 'LOOK!', hint: 'FIND THE CREEP: LIGHT IT, CLICK IT', thint: 'FIND THE CREEP: TAP IT', dur: 5.5,
    down(p) {
      if (g.result) return;
      if (Math.hypot(p.x - mouse.x, p.y - mouse.y) > R + 20) return;
      for (const f of figs) {
        if (Math.hypot(p.x - f.x, p.y - (f.y - 45)) < 62) {
          if (f.kind === 'creep') { g.result = 'win'; sfx.zap(); dsWin(f.x, f.y - 60); } else { g.result = 'lose'; dsLose(f.x, f.y - 50); }
          g.hit = f; return;
        }
      }
    },
    update() { if (g.result && rT0 < 0) rT0 = now; if (!g.result && Math.hypot(mouse.x - lx, mouse.y - ly) > 60) { lx = mouse.x; ly = mouse.y; for (const f of figs) if (Math.hypot(mouse.x - f.x, mouse.y - (f.y - 45)) < 55) { sfx.blip(f.kind === 'creep' ? 7 : 0); } } },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0;
      K.bake(bk, night);
      // street lamp that flickers + a bat
      const fl = Math.sin(t * 17) > .92 ? .4 : 1;
      K.rr(48, 150, 12, 180, 4); K.ink('#4a4560', 3); K.rr(30, 138, 48, 18, 8); K.ink('#4a4560', 3);
      ctx.fillStyle = 'rgba(255,230,140,' + .5 * fl + ')'; K.el(54, 150, 30, 8); ctx.fill();
      const bx = (t * 60) % (VW + 100) - 50 - OX, by = 70 + Math.sin(t * 2) * 20;
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - 13, by - Math.sin(t * 18) * 6); ctx.quadraticCurveTo(bx - 5, by - 8, bx, by); ctx.quadraticCurveTo(bx + 5, by - 8, bx + 13, by - Math.sin(t * 18) * 6); ctx.stroke();
      const mx = mouse.x, my = mouse.y;
      const order = figs.slice().sort((a, b) => a.y - b.y);
      for (const f of order) { shadow(f.x, f.y + 3, f.kind === 'bush' ? 50 : 36, 8, .3); drawFig(f, !g.result && Math.hypot(mx - f.x, my - (f.y - 45)) < R * .9, t, ot); }
      if (g.result && g.hit) {
        const f = g.hit, pu = K.outBack(ot / .25);
        if (g.result === 'win') {
          K.badge('GOTCHA!', f.x, Math.max(80, f.y - 182), 30, '#5CFF7A', '#fff', pu, -.05);
          for (let i = 0; i < 3; i++) { const ph = (ot * 1.2 + i * .33) % 1; K.heart(f.x - 30 + i * 30, f.y - 130 - ph * 36, .8, 1 - ph); }
        } else { K.badge('NOPE!', f.x, Math.max(80, f.y - 124), 28, '#ff4d5e', '#fff', pu, .05); }
      }
      if (!g.result) {   // darkness with a soft spotlight
        ctx.fillStyle = 'rgba(6,5,18,.97)'; ctx.beginPath(); ctx.rect(-OX, 0, VW, H); ctx.arc(mx, my, R, 0, Math.PI * 2, true); ctx.fill('evenodd');
        const gr = ctx.createRadialGradient(mx, my, R * .55, mx, my, R); gr.addColorStop(0, 'rgba(6,5,18,0)'); gr.addColorStop(1, 'rgba(6,5,18,.97)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, my, R + .5, 0, Math.PI * 2); ctx.fill();
        for (const f of figs) {
          const ey = eyeY[f.kind]; if (ey == null || Math.sin(t * 2.6 + f.ph) < -.6) continue;
          if (Math.hypot(mx - f.x, my - (f.y + ey)) < R * .8) continue;
          ctx.fillStyle = f.kind === 'cat' ? 'rgba(255,225,77,.35)' : 'rgba(255,255,255,.3)';
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(f.x + s * 9, f.y + ey, 9, 0, 7); ctx.fill(); }
          ctx.fillStyle = f.kind === 'cat' ? '#FFE14D' : '#fff';
          for (const s of [-1, 1]) { K.el(f.x + s * 9, f.y + ey, 3.4, 5); ctx.fill(); }
        }
        ctx.strokeStyle = 'rgba(255,240,150,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(mx, my, R, 0, 7); ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, R + 3, 0, 7); ctx.stroke();
        ctx.save(); ctx.translate(mx + R * .8, my + R * .8); ctx.rotate(-2.36); K.rr(-9, 0, 18, 42, 6); K.ink('#4a4560', 3); K.rr(-12, -10, 24, 14, 5); K.ink('#FFE14D', 3); ctx.restore();   // the flashlight
      }
      vignette(.2);
    }
  };
  return g;
}

/* ── 3 ── SHORT FUSE: cut the wire named by the word (not the ink!)
   Art: the bomb squad's garage. A pegboard of wires under a big round bomb, a hard-hatted Claude sweating, a rubber duck in a tiny helmet. Win: a flag pops out of the fuse. Lose: soot, debris and a black Claude. */
function dsFuse(sp) {
  const K = DSK, names = ['RED', 'BLUE', 'YELLOW'], cols = ['#ff4d4d', '#4DB8FF', '#ffd23f'];
  const slots = [180, 400, 620], perm = shuffle([0, 1, 2]), want = Math.random() * 3 | 0;
  let inkI; do { inkI = Math.random() * 3 | 0; } while (inkI === want);
  const wires = [0, 1, 2].map(i => {
    const sx = [350, 400, 450][i], ex = slots[perm[i]], pts = [], ph = Math.random() * 6;
    for (let s = 0; s <= 40; s++) {
      const u = s / 40, e = u * u * (3 - 2 * u);
      pts.push({ x: sx + (ex - sx) * e + Math.sin(u * Math.PI * 3 + ph) * 34 * Math.sin(u * Math.PI), y: 255 + u * 305 });
    }
    return { col: cols[i], slot: perm[i], pts, cut: -1 };
  });
  const durA = 4.6 / Math.sqrt(sp); let clock = 0, lastT = 99, rT0 = -1; const bk = {};
  const cutIt = w => {
    if (g.result || w.cut >= 0) return;
    let bi = 0, bd = 1e9; w.pts.forEach((q, i) => { const d = Math.abs(q.y - (g.cy || 400)); if (d < bd) { bd = d; bi = i; } });
    w.cut = g.cy ? bi : 20; sfx.zap(); burst(w.pts[w.cut].x, w.pts[w.cut].y, '#FFE14D', 10);
    if (w === wires[want]) { g.result = 'win'; sfx.coin(); dsWin(400, 250); }
    else { g.result = 'lose'; sfx.stamp(); sfx.buzz(); dsLose(400, 190); shake(16, .5); }
  };
  const garage = c => {
    K.grad(0, H, ['#aec3d8', '#d7e3ee']);
    c.strokeStyle = 'rgba(80,100,130,.3)'; c.lineWidth = 2;
    for (let y = 0; y < 520; y += 40) { c.beginPath(); c.moveTo(-OX, y); c.lineTo(W + OX, y); c.stroke(); for (let x = -OX + ((y / 40) & 1) * 40; x < W + OX; x += 80) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 40); c.stroke(); } }
    // hazard stripe + floor
    K.grad(520, H, ['#8c93a6', '#6c7388']); c.fillStyle = INK; c.fillRect(-OX, 516, VW, 5);
    c.save(); c.beginPath(); c.rect(-OX, 521, VW, 14); c.clip(); for (let x = -OX - 30; x < W + OX + 30; x += 36) { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x, 521); c.lineTo(x + 18, 521); c.lineTo(x + 4, 535); c.lineTo(x - 14, 535); c.closePath(); c.fill(); } c.restore();
    // pegboard behind the wires
    K.rr(150, 236, 500, 312, 16); K.ink('#5a6f8c', 5); c.fillStyle = 'rgba(20,16,28,.35)'; for (let y = 252; y < 540; y += 22) for (let x = 168; x < 640; x += 22) { c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); }
    // shelf with the duck
    K.rr(560, 108, 190, 12, 4); K.ink('#d9944f', 3);
  };
  const g = {
    wide: true, cmd: 'CUT!', hint: 'CUT THE WIRE THE WORD SAYS: CLICK OR 1 2 3', thint: 'TAP THE WIRE THE WORD SAYS', dur: 4.6,
    down(p) {
      if (g.result) return;
      let best = null, bd = 22;
      for (const w of wires) { if (w.cut >= 0) continue; for (let i = 0; i < w.pts.length; i++) { const d = Math.hypot(p.x - w.pts[i].x, p.y - w.pts[i].y); if (d < bd) { bd = d; best = w; g.cy = w.pts[i].y; } } }
      if (best) cutIt(best);
    },
    key(e) { const m = /^Digit([123])$/.exec(e.code || ''); if (m && !g.result) { const w = wires.find(w => w.slot === +m[1] - 1); g.cy = 400; cutIt(w); } },
    update(dt) { if (g.result && rT0 < 0) rT0 = now; if (!g.result) { clock += dt; const r = Math.max(0, durA - clock), c = Math.ceil(r); if (c !== lastT && c > 0) { lastT = c; if (c < durA) c <= 1 ? sfx.tickHi() : sfx.tick(); } } },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, boom = g.result === 'lose', win = g.result === 'win', sh = boom ? Math.sin(t * 90) * 8 : 0;
      K.bake(bk, garage);
      // siren lamp (turns faster as the clock runs down) + the duck in a helmet
      const rem = Math.max(0, durA - clock), pan = !g.result ? t * (3 + (1 - rem / durA) * 8) : t * 2;
      K.rr(56, 330, 34, 14, 4); K.ink('#4a4560', 3); ctx.save(); K.rr(60, 300, 26, 32, 12); ctx.clip(); ctx.fillStyle = '#ff4d5e'; ctx.fillRect(60, 300, 26, 32); ctx.fillStyle = '#ffe14d'; ctx.fillRect(60 + 13 + Math.sin(pan) * 9, 300, 10, 32); ctx.restore(); K.rr(60, 300, 26, 32, 12); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      if (!g.result) { ctx.fillStyle = 'rgba(255,77,94,' + (.1 + .08 * Math.sin(pan)) + ')'; ctx.beginPath(); ctx.arc(73, 316, 42, 0, 7); ctx.fill(); }
      const dk = K.elP(655, 92, 20, 15); K.cel(dk, '#ffe14d', '#e0b52a', 4, 3, 3.5); K.dot(672, 74, 11, '#ffe14d', 3.5); ctx.fillStyle = '#ff9f4d'; K.rr(681, 74, 12, 6, 3); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); K.eye(670, 72, 3.2, boom ? 'panic' : null, -1, 0, 3);
      ctx.beginPath(); ctx.arc(672, 70, 11, Math.PI, 0); ctx.closePath(); K.ink('#ffd23f', 3); K.rr(661, 68, 22, 5, 2); K.ink('#e0b52a', 2);
      ctx.save(); ctx.translate(sh, 0);
      // wires
      for (const w of wires) {
        const draw = (a, b) => { ctx.beginPath(); for (let i = a; i <= b; i++) i === a ? ctx.moveTo(w.pts[i].x, w.pts[i].y) : ctx.lineTo(w.pts[i].x, w.pts[i].y); };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const a = w.cut >= 0 ? w.cut - 3 : 40, b0 = w.cut + 3;
        ctx.strokeStyle = INK; ctx.lineWidth = 17; draw(0, Math.max(1, a)); ctx.stroke(); if (w.cut >= 0) { draw(Math.min(39, b0), 40); ctx.stroke(); }
        ctx.strokeStyle = w.col; ctx.lineWidth = 9; draw(0, Math.max(1, a)); ctx.stroke(); if (w.cut >= 0) { draw(Math.min(39, b0), 40); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5; ctx.save(); ctx.translate(-2, -2); draw(0, Math.max(1, a)); ctx.stroke(); ctx.restore();
        ctx.lineCap = 'butt';
        if (w.cut >= 0) { star(w.pts[w.cut].x, w.pts[w.cut].y, 20 + Math.sin(t * 40) * 4, 8, 6, t * 5, '#fff', 3); }
      }
      // numbered terminals
      for (let i = 0; i < 3; i++) { K.rr(slots[i] - 22, 556, 44, 38, 8); K.ink('#e9ecf8', 4); K.dot(slots[i], 562, 4, '#8e98a8', 2); txt('' + (i + 1), slots[i], 580, 24, INK); }
      // the bomb: a big cel-shaded sphere with a hot fuse
      shadow(400, 268, 90, 14, .25);
      const bomb = K.elP(400, 170, 92, 92); K.cel(bomb, '#4a4560', '#2d2a3a', 14, 12, 6); K.glint(bomb, 362, 128, 26, 14, 'rgba(255,255,255,.4)', -.7);
      K.rr(380, 62, 40, 24, 6); K.ink('#8e98a8', 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(400, 62); ctx.quadraticCurveTo(432, 54, 458, 82); ctx.stroke();
      if (win) { // a little flag pops out of the fuse hole
        const k2 = K.outBack(ot / .3); ctx.save(); ctx.translate(400, 66); ctx.scale(1, k2); K.rr(-2.5, -52, 5, 52, 2); K.ink('#cfd8e6', 2.5); ctx.restore();
        ctx.save(); ctx.translate(402, 66 - 52 * k2); ctx.scale(k2, k2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(44, 8 + Math.sin(t * 10) * 3); ctx.lineTo(0, 22); ctx.closePath(); K.ink('#5CFF7A', 3); ctx.restore();
      } else if (!g.result) star(460, 84, 11 + Math.sin(t * 30) * 3, 5, 6, t * 6, '#FFE14D', 2);
      K.rr(340, 150, 120, 58, 10); K.ink('#1b1f12', 4);
      txt(win ? ':)' : '0:0' + Math.min(9, Math.ceil(rem)), 400, 181, 38, win ? '#5CFF7A' : rem < 1.5 && Math.sin(t * 20) > 0 ? '#ff4d4d' : '#6bff6b');
      if (win) K.badge('DEFUSED!', 585, 200, 26, '#5CFF7A', '#fff', K.outBack(ot / .25), -.05);
      ctx.restore();
      // the sticky note: words in the wrong ink on purpose
      ctx.save(); ctx.translate(135, 200); ctx.rotate(-.07);
      ctx.fillStyle = 'rgba(20,16,28,.25)'; K.rr(-96, -66, 200, 150, 6); ctx.fill();
      K.rr(-100, -75, 200, 150, 6); K.ink('#fff6a8', 5); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-94, -69, 188, 12);
      K.rr(-22, -86, 44, 18, 4); K.ink('rgba(255,255,255,.7)', 2.5); txt('CUT THE', 0, -40, 28, INK);
      ctx.fillStyle = INK; ctx.fillRect(-70, -18, 140, 3);
      txt(names[want], 0, 22, 46, cols[inkI], 'center', 180); ctx.restore();
      // Claude, hard-hat and sweat
      const ar = dsArms(g, t), cx2 = 700, cy2 = 536, u = 6;
      K.hero(cx2, cy2, u, { mood: dsMood(g), col: boom ? '#3a3340' : OR, la: boom ? -2.4 : ar[0], ra: boom ? 2.4 : ar[1] });
      ctx.beginPath(); ctx.arc(cx2, cy2 - 9 * u + 3, 4.6 * u, Math.PI, 0); ctx.closePath(); K.ink('#ffd23f', 4); K.rr(cx2 - 5.6 * u, cy2 - 9 * u, 11.2 * u, 7, 3.5); K.ink('#e0b52a', 3);
      K.rr(cx2 - 3, cy2 - 9 * u - 16, 6, 12, 3); K.ink('#fff3a0', 2.5);
      if (!g.result) { const hot = 1 - rem / durA; for (let i = 0; i < 1 + hot * 3; i++) K.sweat(cx2 + (i % 2 ? 1 : -1) * (40 + i * 6), cy2 - 9 * u + 10 + i * 6, 1.2, ((t * 1.1 + i * .37) % 1)); }
      K.pill(cx2, cy2 - 9 * u - 34, 'YOU', '#FFE14D');
      if (boom) {
        ctx.fillStyle = 'rgba(255,120,40,' + Math.max(0, .32 - ot * .3) + ')'; ctx.fillRect(-OX, 0, VW, H);
        dsBoom(400, 190, 150 + Math.sin(t * 30) * 12, t); K.badge('BOOM!', 400, 190, 60, '#ff4d5e', '#fff', 1, -.06);
        for (let i = 0; i < 12; i++) { const a = K.hr(i) * 6.28, v = 160 + K.hr(i + 3) * 240, px = 400 + Math.cos(a) * v * ot, py = 190 + Math.sin(a) * v * ot + 700 * ot * ot; ctx.save(); ctx.translate(px, py); ctx.rotate(ot * 10 + i); K.rr(-6, -4, 12, 8, 2); K.ink(i % 2 ? '#4a4560' : '#ff7a2f', 2); ctx.restore(); }
      }
      vignette(.16);
    }
  };
  return g;
}

/* ── 4 ── IN THE LOOP: lasso the buttons, dodge the decoys
   Art: a tailor's cutting mat. The "lasso" is a coral thread, buttons are real buttons, the grey ones are dull decoys. Win: every target is stitched shut. A cat's yarn ball rolls along the tape measure. */
function dsLoop(sp) {
  const K = DSK, C = { x: dsRnd(300 - OX / 2, 500 + OX / 2), y: dsRnd(260, 380) }, tg = [], dc = [];
  const far = (a, r) => tg.concat(dc).every(o => Math.hypot(o.x - a.x, o.y - a.y) > r);
  const nT = sp > 1.5 ? 4 : 3, nD = 3, cols = ['#ff4d4d', '#4DB8FF', '#FFE14D', '#5CFF7A', '#FF4D9E'];
  for (let i = 0; i < nT; i++) { let p, n = 0; do { const a = Math.random() * 6.28, r = Math.random() * 100; p = { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r, col: cols[i] }; } while (!far(p, 78) && ++n < 60); tg.push(p); }
  for (let i = 0; i < nD; i++) {
    let p, n = 0;
    do { const a = Math.random() * 6.28, r = dsRnd(230, 290); p = { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * .8 }; n++; }
    while ((p.x < 60 - OX || p.x > 740 + OX || p.y < 130 || p.y > 550 || !far(p, 90)) && n < 80);
    if (p.x < 60 - OX || p.x > 740 + OX || p.y < 120 || p.y > 560) { p.x = Math.max(60 - OX, Math.min(740 + OX, p.x)); p.y = Math.max(125, Math.min(555, p.y)); }
    dc.push(p);
  }
  let pts = [], pr = false, flash = 0, msg = '', rT0 = -1; const bk = {};
  const mat = c => {
    K.grad(0, H, ['#3fa56a', '#2f8a56']);
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2;
    for (let x = -Math.ceil(OX / 50) * 50; x < W + OX; x += 50) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 50) { c.beginPath(); c.moveTo(-OX, y); c.lineTo(W + OX, y); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(W / 2, H / 2, 200, 0, 7); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, 120, 0, 7); c.stroke();
    // tape measure along the top and the wooden table edge
    K.rr(-OX - 10, 82, VW + 20, 26, 5); K.ink('#ffe9a8', 3.5); c.fillStyle = INK; for (let x = -OX; x < W + OX; x += 14) c.fillRect(x, 82, 2, x % 70 < 14 ? 14 : 8);
    K.rr(-OX - 10, 570, VW + 20, 50, 8); K.ink('#d9944f', 4);
    // scissors in the corner and a pin cushion
    K.rr(-OX + 14, 500, 74, 14, 6); K.ink('#cfd8e6', 3); K.dot(-OX + 22, 540, 12, '#ff4d5e', 3); K.dot(-OX + 56, 540, 12, '#ff4d5e', 3);
    const pc = K.elP(W + OX - 60, 520, 36, 24); K.cel(pc, '#ff7a9a', '#d9506f', 6, 4, 3.5); for (const [a, b, col] of [[-12, -22, '#fff'], [4, -26, '#ffd23f'], [16, -18, '#4DB8FF']]) { K.line([[W + OX - 60 + a, 520 + b + 14], [W + OX - 60 + a, 520 + b]], 2.5, '#cfd8e6', 4); K.dot(W + OX - 60 + a, 520 + b, 4, col, 2); }
  };
  const button = (x, y, col, sew, hit) => {
    shadow(x, y + 24, 24, 7, .3);
    const rim = K.elP(x, y, 27, 27), face = K.elP(x, y, 19, 19);
    K.cel(rim, col, 'rgba(20,16,28,.28)', 5, 5, 4); ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 27, 0, 7); ctx.fill(); ctx.restore();
    K.cel(rim, col, col === '#9a9aa5' ? '#6e6e7c' : 'rgba(20,16,28,.3)', 5, 5, 4);
    ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.strokeStyle = 'rgba(20,16,28,.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; K.el(x - 11, y - 14, 7, 3, -.5); ctx.fill();
    for (const o of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + o[0], y + o[1], 3, 0, 7); ctx.fill(); }
    if (sew) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
  };
  const g = {
    wide: true, cmd: 'LOOP!', hint: 'CIRCLE ALL THE COLOURED BUTTONS', thint: 'DRAW A LOOP AROUND THE COLOURED BUTTONS', dur: 5.8,
    down(p) { if (g.result) return; pr = true; pts = [{ x: p.x, y: p.y, t: now }]; sfx.click(); },
    move(p) { if (!pr || g.result) return; const l = pts[pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 6) { pts.push({ x: p.x, y: p.y, t: now }); if (pts.length % 6 === 0) sfx.tick(); } },
    up() {
      if (!pr || g.result) return; pr = false;
      if (pts.length < 8) { pts = []; return; }
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 90) { msg = 'CLOSE THE LOOP!'; flash = .7; sfx.miss(); return; }
      const inn = o => dsInPoly(o.x, o.y, pts);
      if (tg.every(inn) && !dc.some(inn)) { g.result = 'win'; tg.forEach((o, i) => { sfx.blip(i * 3); burst(o.x, o.y, o.col, 8); }); dsWin(C.x, C.y, 36); }
      else { msg = dc.some(inn) ? 'NOT THE GREY ONES!' : 'GET THEM ALL!'; flash = .8; sfx.buzz(); shake(5, .2); dc.filter(inn).forEach(o => burst(o.x, o.y, '#9a9aa5', 8)); pts.length = 0; }
    },
    update(dt) { if (g.result && rT0 < 0) rT0 = now; flash = Math.max(0, flash - dt); },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win';
      K.bake(bk, mat);
      // a yarn ball rolls along the tape measure, trailing its strand
      const yx = (t * 55) % (VW + 160) - 80 - OX; ctx.save(); ctx.translate(yx, 95);
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.bezierCurveTo(-40, -14, -20, 14, 0, 0); ctx.stroke(); ctx.strokeStyle = '#ff7a9a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.rotate(t * 3); const yb = K.elP(0, 0, 18, 18); K.cel(yb, '#ff7a9a', '#d9506f', 4, 3, 3.5); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, .4, 2.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 5, 2, 5); ctx.stroke(); ctx.restore();
      // the tailor perched on a spool in the corner
      const sx = W + OX - 62, ar = dsArms(g, t);
      K.rr(sx - 26, 166, 52, 30, 5); K.ink('#e9ecf8', 3.5); ctx.fillStyle = '#ff7a9a'; ctx.fillRect(sx - 24, 174, 48, 14); K.rr(sx - 26, 166, 52, 30, 5); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
      K.hero(sx, 168, 3, { mood: dsMood(g), la: ar[0], ra: ar[1] });
      for (const o of dc) button(o.x, o.y, '#9a9aa5', false);
      for (const o of tg) button(o.x, o.y, o.col, win && ot > .1);
      const live = pts.filter(q => now - q.t < 1.1 || pr && q === pts[pts.length - 1]);
      if (live.length > 1) K.line(live.map(q => [q.x, q.y]), 5, '#ff7a9a', 5);
      if (pr && live.length) K.stylus(live[live.length - 1].x, live[live.length - 1].y);
      if (flash > 0) K.badge(msg, W / 2, 112, 28, '#ffd23f', INK, K.outBack(1 - flash / .8 + .2), 0);
      if (win) { for (const o of tg) star(o.x, o.y - 42 - Math.sin(t * 6 + o.x) * 4, 14, 6, 5, t * 3, '#FFE14D', 3); K.heart(sx - 30, 142 - Math.abs(Math.sin(t * 5)) * 8, .9); }
      vignette(.16);
    }
  };
  return g;
}

/* ── 5 ── CAGE MATCH: cut the rope when the pig is under the cage
   Art: a barnyard with a wooden gantry. A cel-shaded pig trots under a slatted cage; win = the pig is caged and steaming, lose = the pig laughs at you. A hen crosses the yard. */
function dsCage(sp) {
  const K = DSK, k = Math.sqrt(sp), GY = 490, cx0 = dsRnd(290, 510), PS = 230 * (1 + (VW / W - 1) * .6), CW = 180, CH = 140;
  let px = dsRnd(130 - OX, 670 + OX), dir = Math.random() < .5 ? -1 : 1, cy = 100, vy = 0, cut = false, landed = false, clang = 0, esc = 0, rT0 = -1; const bk = {};
  const farm = c => {
    K.grad(0, GY, ['#7fd0f6', '#c8f0ff', '#f0fcff']);
    // far hills (no ink) and a red barn with a silo
    for (const [x, r, col] of [[120, 160, '#a9dfc6'], [420, 200, '#a0d8bd'], [720, 170, '#a9dfc6']]) { c.fillStyle = col; c.beginPath(); c.ellipse(x - OX * (x < 400 ? 1 : -1) * 0, GY + 20, r, 120, 0, Math.PI, 0); c.fill(); }
    const bx = 36 - OX * .4;
    const barn = K.polyP([[bx, GY], [bx, 340], [bx + 40, 300], [bx + 150, 300], [bx + 190, 340], [bx + 190, GY]]); K.cel(barn, '#e8553f', '#b83a2a', 10, 0, 4);
    K.rr(bx + 50, 380, 90, GY - 380, 4); K.ink('#fff3e0', 3.5); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(bx + 50, 380); c.lineTo(bx + 140, GY); c.moveTo(bx + 140, 380); c.lineTo(bx + 50, GY); c.stroke();
    K.rr(bx + 196, 330, 44, GY - 330, 10); K.ink('#cfd8e6', 4); K.polyP([[0, 0]]); c.beginPath(); c.arc(bx + 218, 330, 22, Math.PI, 0); K.ink('#d9552e', 4);
    // sun and clouds (clouds are live)
    K.sun(W + OX - 190, 135, 30, 0, 'grin');
    // gantry posts, ground
    for (const x of [90 - OX, 710 + OX]) { K.rr(x - 11, 70, 22, GY - 70, 4); K.ink('#a5622c', 4); c.strokeStyle = 'rgba(80,40,10,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 3, 90); c.lineTo(x - 3, GY - 10); c.stroke(); }
    K.grad(GY, H, ['#8fdc5c', '#5fb944']); c.fillStyle = INK; c.fillRect(-OX, GY - 4, VW, 5);
    c.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -OX - 60; x < W + OX; x += 90) { c.beginPath(); c.moveTo(x, GY); c.lineTo(x + 40, GY); c.lineTo(x - 10, H); c.lineTo(x - 50, H); c.fill(); }
    c.strokeStyle = '#3f8f35'; c.lineWidth = 3; c.lineCap = 'round'; for (let i = 0; i < 16; i++) { const x = K.hr(i + 40) * VW - OX, y = GY + 20 + K.hr(i + 50) * 70; for (const d of [-5, 0, 5]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + d, y - 11); c.stroke(); } }
    // hay bales
    for (const x of [bx + 40, W + OX - 40]) { K.rr(x - 30, GY - 36, 60, 40, 7); K.ink('#f2c75a', 4); c.strokeStyle = 'rgba(120,80,10,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 10, GY - 34); c.lineTo(x - 10, GY + 2); c.moveTo(x + 10, GY - 34); c.lineTo(x + 10, GY + 2); c.stroke(); }
    // the beam
    const bm = K.rrP(60 - OX, 60, 680 + OX * 2, 26, 6); K.cel(bm, '#c47b3d', '#8e5428', 0, 6, 5);
  };
  const g = {
    wide: true, cmd: 'CUT!', hint: 'CLICK TO CUT THE ROPE WHEN IT IS UNDER', thint: 'TAP TO CUT THE ROPE', dur: 4.6,
    down() { if (cut || g.result) return; cut = true; sfx.click(); sfx.whoosh(false); },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') g.down(); },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      const gt = dt * k;
      if (!g.result || !landed) { px += dir * PS * gt; if (px < 110 - OX) { px = 110 - OX; dir = 1; } if (px > 690 + OX) { px = 690 + OX; dir = -1; } }
      if (g.result && !(g.result === 'win')) { esc += dt; }
      if (cut && !landed) {
        vy += 2600 * gt; cy += vy * gt;
        if (cy + CH >= GY) {
          cy = GY - CH; landed = true; clang = .5;
          sfx.thud(); shake(12, .3); burst(cx0, GY, '#fff', 10, 200);
          if (Math.abs(px - cx0) < CW / 2 - 28) { g.result = 'win'; sfx.coin(); dsWin(cx0, 400); }
          else { g.result = 'lose'; sfx.miss(); burst(px, GY - 40, '#ff4d4d', 8); }
        }
      }
      clang = Math.max(0, clang - dt);
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose';
      K.bake(bk, farm);
      K.cloud(((t * 8 + 40) % (VW + 200)) - 100 - OX, 130, .9); K.cloud(((t * 5 + 400) % (VW + 200)) - 100 - OX, 220, .7);
      // the hen crossing the yard
      const hx = ((t * 40) % (VW + 160)) - 80 - OX, hb = Math.abs(Math.sin(t * 9)) * 3;
      ctx.save(); ctx.translate(hx, GY + 34 - hb); const hb2 = K.elP(0, -12, 15, 12); K.cel(hb2, '#fff', '#d6dbe8', 3, 3, 3); K.dot(13, -22, 7, '#fff', 3); ctx.fillStyle = '#ff9f4d'; ctx.beginPath(); ctx.moveTo(19, -23); ctx.lineTo(26, -20); ctx.lineTo(19, -18); ctx.fill(); K.dot(16, -25, 1.8, INK, 0); K.rr(8, -34, 6, 6, 3); K.ink('#ff4d5e', 2); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-3, 6); ctx.moveTo(4, 0); ctx.lineTo(4, 6); ctx.stroke(); ctx.restore();
      // Claude, foreground right, ready to cut
      const ar = dsArms(g, t), cl = { x: W + OX - 62, y: 546 };
      K.hero(cl.x, cl.y, 3.4, { mood: dsMood(g), la: g.result ? ar[0] : -2.7, ra: g.result ? ar[1] : (cut ? 2 : .7 + Math.sin(t * 6) * .12) });
      K.pill(cl.x, cl.y - 9 * 3.4 - 14, 'YOU', '#FFE14D');
      // shadows and rope
      shadow(px, GY + 4, 46, 8, .3);
      if (!cut) shadow(cx0, GY + 4, CW / 2, 8, .12);
      K.line([[cx0, 86], [cx0, cut ? 100 : cy]], 6, '#e6c58c', 6);
      if (!cut) { ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx0 - 6, 150 + i * 14); ctx.lineTo(cx0 + 6, 144 + i * 14); ctx.stroke(); } }
      // the pig (nose towards +x, flipped by dir)
      const pigDrawn = () => {
        const bob = Math.abs(Math.sin(t * 12)) * (landed && g.result ? 0 : 5), spook = cut && !landed;
        ctx.save(); ctx.translate(px, GY - bob); ctx.scale(dir, 1);
        for (const o of [-24, 20]) { K.rr(o, -18, 12, 18, 4); K.ink('#ff8fb8', 3); }
        K.line([[-48, -46], [-62, -52], [-58, -40]], 4, '#ff8fb8', 6);
        const b = K.elP(0, -44, 48, 36); K.cel(b, '#ffa6c9', '#e87aa6', 8, 7, 4.5); K.glint(b, -14, -64, 14, 6);
        const e = K.polyP([[14, -78], [24, -98], [34, -76]]); K.cel(e, '#ff8fb8', '#e87aa6', 3, 0, 3.5);
        K.rr(38, -58, 26, 24, 9); K.ink('#ff8fb8', 3); ctx.fillStyle = INK; ctx.fillRect(46, -50, 4, 9); ctx.fillRect(55, -50, 4, 9);
        K.eye(26, -62, 7, win ? 'panic' : lose ? 'happy' : spook ? 'panic' : null, 1, 0, 2);
        if (win) { ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(16, -78); ctx.lineTo(34, -70); ctx.stroke(); }
        if (lose) { ctx.fillStyle = '#ff5c8a'; K.rr(46, -40, 12, 14 + Math.sin(ot * 14) * 3, 5); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,90,140,.5)'; K.el(14, -50, 7, 4); ctx.fill();
        ctx.restore();
      };
      if (lose || !g.result) pigDrawn();
      // the cage
      const top = cy, wob = !cut ? Math.sin(t * 2) * 3 : 0;
      if (cut && !landed) { ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) ctx.fillRect(cx0 - 60 + i * 60, cy - 30 - i * 10, 4, 28); }
      ctx.save(); ctx.translate(cx0 + wob, 0);
      if (win) { ctx.restore(); pigDrawn(); ctx.save(); ctx.translate(cx0, 0); }
      for (let i = 0; i <= 6; i++) { const bxx = -CW / 2 + 5 + i * (CW - 14) / 6; K.rr(bxx, top + 10, 8, CH - 14, 3); K.ink('#d9944f', 2.5); }
      K.rr(-CW / 2, top, CW, 16, 5); K.ink('#c47b3d', 4); K.rr(-CW / 2, top + CH - 12, CW, 12, 5); K.ink('#a8602f', 4);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-CW / 2 + 6, top + 3, CW - 12, 3);
      K.dot(0, top - 4, 10, '#cfd8e6', 3);
      ctx.restore();
      if (win) { for (let i = 0; i < 3; i++) { const ph = (ot * 1.3 + i * .3) % 1, sx = cx0 + (i - 1) * 40; ctx.fillStyle = 'rgba(255,255,255,' + (.9 - ph) + ')'; ctx.beginPath(); ctx.arc(sx, GY - 150 - ph * 50, 9 + ph * 8, 0, 7); ctx.fill(); } }
      if (lose) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const sx = px + dir * (46 + i * 14); ctx.beginPath(); ctx.moveTo(sx, GY - 110 - i * 9); ctx.lineTo(sx + dir * 9, GY - 118 - i * 9); ctx.stroke(); } K.sweat(cl.x + 20, cl.y - 40, 1, (ot * 1.4) % 1); }
      if (clang > 0) { star(cx0, GY - 20, 90 + clang * 40, 50, 10, t * 2, '#FFE14D', 6); K.badge('CLANG!', cx0, GY - 20, 40 * (1 + clang * .3), '#ff4d5e', '#fff', 1, -.05); }
      if (!cut) { ctx.fillStyle = 'rgba(20,16,28,.18)'; K.rr(cx0 - CW / 2, GY - 6, CW, 6, 3); ctx.fill(); }
      vignette(.16);
    }
  };
  return g;
}

/* ── 6 ── TOUCHDOWN: use the cursor as a fan to steer the umbrella onto the pad
   Art: a sunny airfield. Claude hangs under a polka-dot umbrella, the cursor is an electric fan, a windsock on the pad and a windmill turn with the wind. Lose: the umbrella flips and Claude is splatted dizzy. */
function dsFan(sp) {
  const K = DSK, k = Math.sqrt(sp), GY = 500, padX = dsRnd(260, 540), R = 175;
  const side = padX > 400 ? -1 : 1;
  const ch = { x: Math.max(110, Math.min(690, padX + side * dsRnd(130, 230) * -1)), y: 130, vx: dsRnd(-25, 25), vy: 0 };
  let px = mouse.x, py = mouse.y, spd = 0, spin = 0, wt = 0, rT0 = -1; const clouds = [[120, 130], [520, 100], [680, 220], [300, 260]]; const bk = {};
  const field = c => {
    K.grad(0, GY, ['#36b0ea', '#86d8fb', '#d6f7ff']);
    // far hills, near hills with lollipop trees
    c.fillStyle = '#a9dfc6'; for (const [x, r] of [[80, 190], [400, 240], [720, 200], [W + OX, 160], [-OX, 150]]) { c.beginPath(); c.ellipse(x, GY, r, 120, 0, Math.PI, 0); c.fill(); }
    c.save(); c.beginPath(); c.rect(-OX, 0, VW, GY + 6); c.clip();
    for (const [x, r] of [[240, 170], [600, 190], [-OX + 40, 140], [W + OX - 40, 150]]) { c.beginPath(); c.ellipse(x, GY + 4, r, 90, 0, Math.PI, 0); c.fillStyle = '#87d19b'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#4f9a6a'; c.stroke(); }
    c.restore();
    for (const x of [90 - OX * .3, 700 + OX * .3]) { c.fillStyle = INK; c.fillRect(x - 3, GY - 78, 6, 70); K.dot(x, GY - 90, 20, '#3fb260', 4); c.fillStyle = 'rgba(255,255,255,.28)'; K.el(x - 6, GY - 98, 7, 4, -.5); c.fill(); }
    K.grad(GY, H, ['#8fdc5c', '#5fb944']); c.fillStyle = INK; c.fillRect(-OX, GY + 4, VW, 5);
    c.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -OX - 60; x < W + OX; x += 90) { c.beginPath(); c.moveTo(x, GY + 9); c.lineTo(x + 40, GY + 9); c.lineTo(x - 10, H); c.lineTo(x - 50, H); c.fill(); }
    // the landing pad: a bulls-eye in perspective
    for (const [rx, ry, col] of [[84, 17, '#ff4d5e'], [64, 13, '#fff'], [44, 9, '#ff4d5e'], [24, 5, '#FFE14D']]) { K.el(padX, GY + 12, rx, ry); if (rx === 84) K.ink(col, 4); else { c.fillStyle = col; c.fill(); } }
    // windmill base
    const wx = 56 - OX * .2, wy = GY - 6; K.polyP([[0, 0]]); c.beginPath(); c.moveTo(wx - 22, wy); c.lineTo(wx - 10, wy - 90); c.lineTo(wx + 10, wy - 90); c.lineTo(wx + 22, wy); c.closePath(); K.ink('#f1e4c4', 4);
  };
  const g = {
    wide: true, fistHand: true, cmd: 'BLOW!', hint: 'WAVE THE MOUSE TO FAN HIM ONTO THE PAD', thint: 'WAVE YOUR FINGER TO FAN HIM ONTO THE PAD', dur: 4.8,
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result) { return; }
      const gt = dt * k, mx = mouse.x, my = mouse.y;
      const px0 = px, py0 = py;
      spd = dt > 0 ? Math.hypot(mx - px, my - py) / dt : 0; px = mx; py = my; spd = Math.min(spd, 3000);
      const cy = ch.y - 50, dx = ch.x - mx, dy = cy - my, d = Math.hypot(dx, dy);
      if (d < R && d > 1) {
        const F = 1700 * (1 - d / R) * Math.min(1, .15 + spd / 900) * (spd / 700 > 0 ? 1 : 1);
        const mv = Math.hypot(mx - px0, my - py0), ux = mv > 2 ? (mx - px0) / mv : 0, uy = mv > 2 ? (my - py0) / mv : 0;   // the gust follows the swing as well as pushing away from the fan
        const wx = dx / d * .55 + ux * .45, wy = dy / d * .55 + uy * .45, wl = Math.hypot(wx, wy) || 1;
        ch.vx += wx / wl * F * gt; ch.vy += wy / wl * F * gt * .6;
      }
      ch.vx *= Math.exp(-1.5 * gt); ch.vx = Math.max(-340, Math.min(340, ch.vx));
      ch.vy += 420 * gt; ch.vy = Math.min(ch.vy, 100); ch.vy = Math.max(ch.vy, -120);
      ch.x += ch.vx * gt; ch.y += ch.vy * gt; spin += (ch.vx / 700 - spin) * Math.min(1, 6 * dt);
      if (spd > 900 && d < R && (wt -= dt) < 0) { wt = .12; sfx.whoosh(); burst(mx + (ch.x - mx) * .5, my + (cy - my) * .5, '#fff', 2, 120); }
      if (ch.x < 10 - OX || ch.x > W + OX - 10) { g.result = 'lose'; dsLose(Math.max(40 - OX, Math.min(W + OX - 40, ch.x)), ch.y - 40); }
      else if (ch.y >= GY) {
        ch.y = GY;
        sfx.thud(); shake(8, .25); if (Math.abs(ch.x - padX) < 66) { g.result = 'win'; sfx.coin(); dsWin(ch.x, GY - 40); } else { g.result = 'lose'; dsLose(ch.x, GY - 20); }
      }
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose';
      K.bake(bk, field);
      K.sun(W + OX - 90, 110, 30, t);
      for (const c of clouds) K.cloud((c[0] + OX + t * 12) % (VW + 100) - 50 - OX, c[1], 1);
      // a pair of gulls
      for (let i = 0; i < 2; i++) { const bx = ((t * 30 + i * 300) % (VW + 100)) - 50 - OX, by = 190 + i * 70 + Math.sin(t * 2 + i) * 10, fl = Math.sin(t * 9 + i) * 6; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - 10, by - fl); ctx.quadraticCurveTo(bx - 4, by - 7, bx, by); ctx.quadraticCurveTo(bx + 4, by - 7, bx + 10, by - fl); ctx.stroke(); }
      // windmill blades + windsock
      const wx = 56 - OX * .2, wy = GY - 96; ctx.save(); ctx.translate(wx, wy); ctx.rotate(t * (1 + Math.abs(ch.vx) / 120));
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); K.rr(-5, -64, 10, 62, 3); K.ink('#fff', 3); } ctx.restore(); K.dot(wx, wy, 7, '#ff4d5e', 3);
      const sx = padX + 96, sdir = K.clamp(ch.vx / 200, -1, 1) || (Math.sin(t) > 0 ? .3 : -.3);
      K.rr(sx - 3, GY - 70, 6, 76, 3); K.ink('#cfd8e6', 2.5); ctx.save(); ctx.translate(sx, GY - 66); ctx.scale(sdir >= 0 ? 1 : -1, 1);
      for (let i = 0; i < 3; i++) { const dy = Math.sin(t * 6 + i) * 2 + (1 - Math.abs(sdir)) * i * 5; K.rr(i * 14 + 2, -7 + dy - i * .5, 15, 14 - i * 2, 3); K.ink(i % 2 ? '#fff' : '#ff7a2f', 2.5); } ctx.restore();
      shadow(ch.x, GY + 10, 40 * Math.max(.3, 1 - (GY - ch.y) / 450), 9, .25);
      // character: umbrella + Claude
      const flat = lose && ch.y >= GY - 1 ? K.ease(ot / .2) : 0;
      ctx.save(); ctx.translate(ch.x, ch.y); ctx.rotate(spin * .5); ctx.scale(1 + flat * .3, 1 - flat * .3);
      K.line([[0, -48], [0, -4]], 3, '#ffd23f', 5);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; for (const s of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * 52, lose ? -70 : -92); ctx.lineTo(0, -48); ctx.stroke(); }
      const can = new Path2D(); if (lose) { can.moveTo(-56, -92); can.quadraticCurveTo(0, -30, 56, -92); can.quadraticCurveTo(0, -60, -56, -92); } else { can.arc(0, -92, 56, Math.PI, 0); can.quadraticCurveTo(38, -80, 28, -90); can.quadraticCurveTo(14, -78, 0, -90); can.quadraticCurveTo(-14, -78, -28, -90); can.quadraticCurveTo(-38, -80, -56, -92); }
      K.cel(can, '#ff4d9e', '#c9307a', 8, 8, 4.5); ctx.save(); ctx.clip(can); ctx.fillStyle = 'rgba(255,255,255,.75)'; for (const [a, b] of [[-32, -112], [0, -128], [30, -112], [-14, -100], [16, -102]]) { ctx.beginPath(); ctx.arc(a, b, 6, 0, 7); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.4)'; K.el(-24, -122, 12, 5, -.5); ctx.fill(); ctx.restore();
      ctx.fillStyle = INK; ctx.fillRect(-3, -150, 6, 8);
      const ar = win ? [-.5, .5] : lose ? [-2.3, 2.3] : [-.35 + Math.sin(t * 5) * .1, .35 - Math.sin(t * 5) * .1];
      ctx.save(); K.arms(5, ar[0], ar[1]); ctx.restore();
      claude(0, 0, 5, { mood: dsMood(g) });
      ctx.restore();
      if (!g.result && ch.y > GY - 200) K.sweat(ch.x + 26, ch.y - 30, 1, (t * 1.3) % 1);
      if (lose && ch.y >= GY - 1) for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; star(ch.x + Math.cos(a) * 34, ch.y - 56 + Math.sin(a) * 9, 7, 3, 5, a, '#FFE14D', 2); }
      if (win) { for (let i = 0; i < 4; i++) { const ph = (ot * 1.2 + i * .25) % 1; K.heart(ch.x - 48 + i * 32, ch.y - 130 - ph * 50, .9, 1 - ph); } }
      // the cursor is an electric fan
      if (!g.result) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(mouse.x, mouse.y, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 30 + i * 6, a, a + 1.6); ctx.stroke(); }
        ctx.lineCap = 'butt'; ctx.save(); ctx.translate(mouse.x, mouse.y); K.dot(0, 0, 22, '#cfd8e6', 4);
        ctx.save(); ctx.rotate(t * 22); for (let i = 0; i < 3; i++) { ctx.rotate(2.094); K.el(10, 0, 10, 4.5); K.ink('#4DB8FF', 2.5); } ctx.restore();
        K.dot(0, 0, 4.5, '#ff4d5e', 2.5); ctx.restore();
      }
      vignette(.16);
    }
  };
  return g;
}

/* ── 7 ── DEAD SIMON SAYS: drag the skeleton's hands and feet to match the pose
   Art: a haunted disco. The example plays on a TV, yours is on the stage, Claude spins records between them. Win: the skeleton gets a crown and the floor lights up. Lose: its skull falls off and rolls. */
function dsPose(sp) {
  const K = DSK;
  const POSES = [
    { h: [[-95, 60], [95, 60]], f: [[-85, 465], [85, 465]] },
    { h: [[-165, 200], [165, 200]], f: [[-35, 465], [35, 465]] },
    { h: [[-130, 90], [150, 230]], f: [[-60, 465], [110, 425]] },
    { h: [[-32, 105], [32, 105]], f: [[-80, 465], [80, 465]] },
    { h: [[-125, 260], [105, 150]], f: [[-95, 455], [95, 395]] }
  ];
  const T = POSES[Math.random() * POSES.length | 0], TX = 200 - OX / 2, MX = 600 + OX / 2, TOL = TOL_();
  function TOL_() { return sp > 1.5 ? 36 : 44; }
  const me = { h: [[-45, 360], [45, 360]], f: [[-30, 465], [30, 465]] };
  const handles = [{ a: me.h[0], sh: [-28, 198], max: 175 }, { a: me.h[1], sh: [28, 198], max: 175 }, { a: me.f[0], sh: [-22, 335], max: 150 }, { a: me.f[1], sh: [22, 335], max: 150 }];
  const target = [T.h[0], T.h[1], T.f[0], T.f[1]];
  let grab = -1, okT = 0, rT0 = -1; const was = [false, false, false, false]; const match = i => Math.hypot(handles[i].a[0] - target[i][0], handles[i].a[1] - target[i][1]) < TOL; const bk = {};
  const club = c => {
    K.grad(0, H, ['#2a1659', '#4a2a8a', '#6a3fb8']);
    for (let i = 0; i < 50 * VW / W; i++) { c.fillStyle = 'rgba(255,255,255,' + (.2 + K.hr(i) * .5) + ')'; c.fillRect(K.hr(i + 7) * VW - OX, K.hr(i + 19) * 440, 3, 3); }
    // cobwebs in the top corners
    c.strokeStyle = 'rgba(220,220,255,.35)'; c.lineWidth = 2; for (const sx of [-OX, W + OX]) { const d = sx < 0 ? 1 : -1; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx + d * (30 + i * 18), 130); c.stroke(); } for (let j = 1; j < 4; j++) { c.beginPath(); c.moveTo(sx + d * 30 * j * .6, 0 + 12 * j); c.quadraticCurveTo(sx + d * 40 * j, 40 * j, sx + d * 100 * j * .5, 128 * (j / 3)); c.stroke(); } }
    // floor
    K.grad(482, H, ['#3b2270', '#241450']); c.fillStyle = INK; c.fillRect(-OX, 478, VW, 5);
    for (let i = -8; i < 20; i++) for (let r = 0; r < 3; r++) { c.fillStyle = (i + r) & 1 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.14)'; c.fillRect(i * 60 + r * 10 - 40, 488 + r * 36, 58, 34); }
    // the TV showing the example (a DS-like top screen)
    K.rr(TX - 148, 62, 296, 414, 22); K.ink('#cfd8e6', 5); K.rr(TX - 134, 74, 268, 388, 12); K.ink('#1d1546', 4);
    c.fillStyle = 'rgba(255,255,255,.07)'; for (let y = 78; y < 460; y += 6) c.fillRect(TX - 130, y, 260, 2);
    K.rr(TX - 60, 476, 120, 12, 4); K.ink('#8f9cb3', 3);
    K.dot(TX + 120, 470, 5, '#5CFF7A', 2);
    // the stage for you
    K.rr(MX - 170, 470, 340, 14, 6); K.ink('#d9944f', 4); c.fillStyle = 'rgba(255,225,77,.7)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(MX - 150 + i * 37.5, 477, 3.2, 0, 7); c.fill(); }
    // the DJ booth between them
    K.rr(362, 446, 76, 34, 7); K.ink('#4a4560', 4); K.dot(384, 463, 9, '#14101c', 2); K.dot(416, 463, 9, '#14101c', 2);
  };
  const skull = (cx, cy, mood, look, t, crown) => {
    const sk = K.elP(cx, cy, 34, 33); K.cel(sk, '#f6f0dc', '#d4cbb0', 6, 5, 5); K.glint(sk, cx - 12, cy - 18, 11, 5);
    for (const s of [-1, 1]) {
      if (mood === 'happy') { ctx.strokeStyle = '#2b2b3a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx + s * 12, cy - 2, 8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); continue; }
      K.el(cx + s * 12, cy - 5, 9, 10.5); ctx.fillStyle = INK; ctx.fill();
      if (mood === 'dead') { ctx.strokeStyle = '#7bffb0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + s * 12 - 4, cy - 9); ctx.lineTo(cx + s * 12 + 4, cy - 1); ctx.moveTo(cx + s * 12 + 4, cy - 9); ctx.lineTo(cx + s * 12 - 4, cy - 1); ctx.stroke(); }
      else { ctx.fillStyle = '#7bffb0'; ctx.beginPath(); ctx.arc(cx + s * 12 + look[0] * 3, cy - 5 + look[1] * 3, 3.4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + s * 12 + look[0] * 3 - 1, cy - 6 + look[1] * 3, 1.2, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx - 4, cy + 6); ctx.lineTo(cx + 4, cy + 6); ctx.lineTo(cx, cy + 13); ctx.closePath(); ctx.fill();
    K.rr(cx - 18, cy + 17, 36, 14, 4); K.ink('#fff', 3); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 7, cy + 17); ctx.lineTo(cx + i * 7, cy + 31); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,110,165,.45)'; K.el(cx - 24, cy + 8, 6, 3.5); ctx.fill(); K.el(cx + 24, cy + 8, 6, 3.5); ctx.fill();
    if (crown) { ctx.save(); ctx.translate(cx, cy - 40 - Math.abs(Math.sin(t * 8)) * 4); ctx.beginPath(); ctx.moveTo(-20, 8); ctx.lineTo(-22, -14); ctx.lineTo(-10, -4); ctx.lineTo(0, -18); ctx.lineTo(10, -4); ctx.lineTo(22, -14); ctx.lineTo(20, 8); ctx.closePath(); K.ink('#ffd23f', 3.5); K.dot(0, 0, 3.5, '#ff4d5e', 1.5); ctx.restore(); }
  };
  const bone = (x0, y0, x1, y1) => { K.line([[x0, y0], [x1, y1]], 8, '#f6f0dc', 9); ctx.strokeStyle = 'rgba(160,150,120,.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0 + 1, y0 + 3); ctx.lineTo(x1 + 1, y1 + 3); ctx.stroke(); };
  const skel = (cx, hands, feet, o) => {
    bone(cx, 190, cx, 335);
    bone(cx - 28, 198, cx + 28, 198); bone(cx - 22, 335, cx + 22, 335);
    for (let i = 0; i < 3; i++) bone(cx - 20, 225 + i * 26, cx + 20, 225 + i * 26);
    bone(cx - 28, 198, cx + hands[0][0], hands[0][1]); bone(cx + 28, 198, cx + hands[1][0], hands[1][1]);
    bone(cx - 22, 335, cx + feet[0][0], feet[0][1]); bone(cx + 22, 335, cx + feet[1][0], feet[1][1]);
    for (const q of [[-28, 198], [28, 198], [-22, 335], [22, 335]]) K.dot(cx + q[0], q[1], 7, '#f6f0dc', 3);
    for (const q of [feet[0], feet[1]]) { K.rr(cx + q[0] - 16, q[1] - 3, 32, 12, 5); K.ink('#f6f0dc', 3.5); }
    if (!o.noHead) skull(cx, 148, o.mood, o.look || [0, 0], o.t, o.crown);
  };
  const g = {
    wide: true, cmd: 'POSE!', hint: 'DRAG HANDS AND FEET TO COPY THE POSE', thint: 'DRAG HANDS AND FEET TO COPY THE POSE', dur: 5.8,
    down(p) {
      if (g.result) return; let bi = -1, bd = 52;
      handles.forEach((h, i) => { const d = Math.hypot(p.x - (MX + h.a[0]), p.y - h.a[1]); if (d < bd) { bd = d; bi = i; } });
      grab = bi; if (bi >= 0) { sfx.click(); burst(MX + handles[bi].a[0], handles[bi].a[1], '#FFE14D', 5, 140); }
    },
    move(p) {
      if (grab < 0 || g.result) return; const h = handles[grab];
      let x = p.x - MX, y = p.y, dx = x - h.sh[0], dy = y - h.sh[1], d = Math.hypot(dx, dy);
      if (d > h.max) { x = h.sh[0] + dx / d * h.max; y = h.sh[1] + dy / d * h.max; }
      if (grab >= 2) y = Math.max(380, Math.min(470, y)); else y = Math.max(40, Math.min(470, y));
      h.a[0] = x; h.a[1] = y;
      if (match(grab) && !was[grab]) { was[grab] = true; sfx.pop(); ring(MX + x, y, '#5CFF7A', 50, .3); } else if (!match(grab)) was[grab] = false;
    },
    up() { grab = -1; },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result) return;
      if ([0, 1, 2, 3].every(match)) { okT += dt; if (okT > .15) { g.result = 'win'; dsWin(MX, 250, 36); } } else okT = 0;
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose', nOk = [0, 1, 2, 3].filter(match).length;
      K.bake(bk, club);
      // sweeping spotlights; the floor flashes on a win
      for (const [sx, ph, col] of [[MX - 80, 0, '255,225,77'], [MX + 80, 2, '255,92,138']]) { const sw = Math.sin(t * 1.3 + ph) * 60; const gr = ctx.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, 'rgba(' + col + ',.28)'); gr.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx - 10, 0); ctx.lineTo(sx + 10, 0); ctx.lineTo(sx + sw + 70, 480); ctx.lineTo(sx + sw - 70, 480); ctx.closePath(); ctx.fill(); }
      if (win) for (let i = 0; i < 6; i++) { ctx.fillStyle = 'hsla(' + ((i * 60 + t * 300) % 360) + ',90%,60%,.55)'; K.rr(MX - 165 + i * 55, 488, 52, 30, 5); ctx.fill(); }
      K.rr(TX - 78, 497, 156, 32, 10); K.ink('#1d1546', 3.5); txt('COPY THIS', TX, 513, 22, '#fff'); K.rr(MX - 36, 497, 72, 32, 10); K.ink('#1d1546', 3.5); txt('YOU', MX, 513, 22, '#fff');
      // a bat on the wall
      const bx = 400 + Math.sin(t * .8) * 40, by = 190 + Math.sin(t * 1.9) * 14, fl = Math.sin(t * 16) * 7; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = '#4a4560'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - 12, by - 12 - fl, bx - 22, by - fl); ctx.quadraticCurveTo(bx - 14, by + 4, bx, by + 6); ctx.quadraticCurveTo(bx + 14, by + 4, bx + 22, by - fl); ctx.quadraticCurveTo(bx + 12, by - 12 - fl, bx, by); ctx.fill(); ctx.stroke();
      const tlook = grab >= 0 ? [(handles[grab].a[0] > 0 ? 1 : -1), 0] : [0, 0];
      skel(TX, T.h, T.f, { mood: win ? 'happy' : null, look: [Math.sin(t * 2), 0], t });
      // ghost targets on my side
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
      target.forEach((q, i) => { ctx.beginPath(); ctx.arc(MX + q[0], q[1], TOL, 0, 7); ctx.stroke(); });
      ctx.setLineDash([]);
      // my skeleton (hops on a win; the skull rolls off on a loss)
      ctx.save(); ctx.translate(0, win ? -Math.abs(Math.sin(t * 9)) * 14 : 0);
      skel(MX, me.h, me.f, { mood: win ? 'happy' : lose ? 'dead' : null, look: tlook, t, crown: win, noHead: lose });
      if (lose) { const e = Math.min(1, ot / .55), hx = MX + 90 * e, hy = Math.min(448, 148 + 1400 * ot * ot * .5); ctx.save(); ctx.translate(hx, hy); ctx.rotate(e * 5); ctx.translate(-hx, -hy); skull(hx, hy, 'dead', [0, 0], t, false); ctx.restore(); }
      ctx.restore();
      handles.forEach((h, i) => { const ok = match(i), hy = h.a[1] + (win ? -Math.abs(Math.sin(t * 9)) * 14 : 0); if (ok) { ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(MX + h.a[0], hy, 26 + Math.sin(t * 10) * 2, 0, 7); ctx.stroke(); } const hp = K.elP(MX + h.a[0], hy, 18 + (grab === i ? 4 : 0), 18 + (grab === i ? 4 : 0)); K.cel(hp, ok ? '#5CFF7A' : '#FFE14D', ok ? '#23a046' : '#c99512', 4, 4, 4); K.glint(hp, MX + h.a[0] - 6, hy - 7, 6, 3.5); });
      // Claude spins the records
      const ar = win ? [-.5 + Math.sin(t * 12) * .25, .5 - Math.sin(t * 12) * .25] : lose ? [-2.3, 2.3] : [-.7 + Math.sin(t * 7) * .3, .8 - Math.sin(t * 7 + 1) * .3];
      K.hero(400, 456, 3.2, { mood: dsMood(g), la: ar[0], ra: ar[1] });
      ctx.beginPath(); ctx.arc(400, 456 - 9 * 3.2 + 4, 6.6 * 3.2, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); K.dot(400 - 6.6 * 3.2 - 1, 456 - 9 * 3.2 + 20, 5, '#ff4d5e', 3); K.dot(400 + 6.6 * 3.2 + 1, 456 - 9 * 3.2 + 20, 5, '#ff4d5e', 3);
      K.rr(366, 458, 68, 22, 6); K.ink('#4a4560', 3.5); ctx.save(); ctx.translate(386, 469); ctx.rotate(t * 5); K.dot(0, 0, 8, '#14101c', 2); ctx.fillStyle = '#ff4d5e'; ctx.fillRect(-1, -8, 2, 6); ctx.restore(); ctx.save(); ctx.translate(414, 469); ctx.rotate(-t * 5); K.dot(0, 0, 8, '#14101c', 2); ctx.fillStyle = '#ff4d5e'; ctx.fillRect(-1, -8, 2, 6); ctx.restore();
      if (win) K.badge('PERFECT!', 400, 88, 34, '#5CFF7A', '#fff', K.outBack(ot / .25) * (1 + Math.sin(t * 12) * .03), -.03);
      vignette(.16);
    }
  };
  return g;
}

/* ── 8 ── SINKING FEELING: hold the bridge up while the car crosses (watch your grip)
   Art: a volcano canyon at sunset. A plank bridge sags over lava, a big glove props it up, a lava piranha jumps. The grip meter is carved into the cliff. Lose: the car sinks with a splash. */
function dsSink(sp) {
  const K = DSK, k = Math.sqrt(sp), BY = 330, X0 = 150, X1 = 650;
  let cx = 95, s = -20, grip = 100, hold = false, fall = 0, tired = false, wasH = false, wasT = false, rT0 = -1; const bk = {};
  const prof = x => Math.max(0, 1 - Math.pow((x - 400) / 250, 2));
  const by = x => BY + s * prof(x);
  const start = () => { hold = true; }, stop = () => { hold = false; };
  const canyon = c => {
    K.grad(0, 520, ['#ff9e5e', '#ffc593', '#ffe3b8']);
    // volcano with a glowing crater (far: coloured outline, no ink)
    const v = K.polyP([[330, 330], [470, 130], [530, 130], [700, 330]]); c.lineWidth = 4; c.strokeStyle = '#8a3a2a'; c.stroke(v); c.fillStyle = '#b5563a'; c.fill(v);
    c.save(); c.clip(v); c.fillStyle = '#8a3a2a'; c.fillRect(500, 130, 220, 220); c.restore();
    c.fillStyle = '#ff6a2f'; K.el(500, 132, 32, 9); c.fill(); c.fillStyle = '#ffd23f'; K.el(500, 131, 20, 5); c.fill();
    c.fillStyle = '#d98a6a'; c.beginPath(); c.ellipse(120, 340, 150, 90, 0, Math.PI, 0); c.fill();
    // lava band
    K.grad(508, H, ['#ff8a3f', '#ff4a1f']); c.fillStyle = INK; c.fillRect(-OX, 504, VW, 5);
    // cliffs: rock with grass tops (hitboxes unchanged)
    for (const x0 of [-10 - OX, 650]) {
      const w = 160 + OX, rock = K.rrP(x0, 330, w, 280, 6); K.cel(rock, '#b27a47', '#8e5a30', x0 < 100 ? -9 : 9, 0, 5);
      c.strokeStyle = 'rgba(70,35,10,.4)'; c.lineWidth = 3; c.lineCap = 'round'; for (let i = 0; i < 6; i++) { const yy = 362 + i * 40, xx = x0 + 18 + K.hr(i + (x0 > 0 ? 9 : 0)) * (w - 50); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 34, yy + 4); c.stroke(); }
      K.rr(x0, 322, w, 14, 6); K.ink('#58c24a', 4); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x0 + 8, 325, w - 16, 3);
    }
    // grip meter carved into the left cliff
    K.rr(24, 352, 112, 28, 8); K.ink('#5a3a1c', 4);
  };
  const g = {
    wide: true, cmd: 'HOLD!', hint: 'HOLD CLICK OR SPACE TO LIFT THE ROAD', thint: 'HOLD TO LIFT THE ROAD', dur: 5.2,
    down: start, up: stop, key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') stop(); },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result) { if (g.result === 'lose') fall += dt * 500; return; }
      const gt = dt * k, u = Math.max(0, Math.min(1, (cx - X0) / (X1 - X0))), w = Math.pow(Math.sin(Math.PI * u), 2);
      if (grip <= 0) tired = true; else if (grip > 30) tired = false;
      const useHold = hold && !tired;
      if (useHold) grip = Math.max(0, grip - 50 * gt); else grip = Math.min(100, grip + 22 * gt);
      s += (50 + 400 * w) * gt * (useHold ? 0 : 1);
      if (useHold) s -= (560 - 120 * (1 - grip / 100)) * gt * Math.max(.0, 1) * (1 - 0) * (1);
      s = Math.max(-60, Math.min(320, s));
      if (hold && tired && Math.random() < .2) sfx.buzz();
      if (useHold && !wasH) { sfx.boing(); } wasH = useHold; if (tired && !wasT) { wasT = true; sfx.miss(); } if (!tired) wasT = false;
      if (useHold && Math.random() < .25) burst(dsRnd(330, 470), by(400) + 30, '#fff', 1, 80);
      cx += 150 * gt;
      if (cx > X0 && cx < X1 && s * prof(cx) > 105) { g.result = 'lose'; sfx.splat(); sfx.whoosh(false); dsLose(cx, 330); }
      else if (cx >= 690) { g.result = 'win'; sfx.coin(); dsWin(cx, 280); }
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose';
      K.bake(bk, canyon);
      // smoke plume + a drifting cloud
      for (let i = 0; i < 5; i++) { const ph = (t * .18 + i * .2) % 1; ctx.fillStyle = 'rgba(120,90,90,' + (.55 - ph * .5) + ')'; ctx.beginPath(); ctx.arc(500 + Math.sin(ph * 5 + i) * 14 + ph * 40, 124 - ph * 90, 12 + ph * 22, 0, 7); ctx.fill(); }
      K.cloud((t * 7) % (VW + 140) - 100 - OX, 150, .8);
      // lava ripples and the piranha leaping out of it
      ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 8 * VW / W; i++) { const x = (i * 113 + t * 30) % VW - OX; K.rr(x, 520 + Math.sin(t * 3 + i) * 8, 40, 8, 4); ctx.fill(); }
      const fp = (t % 3.4) / 3.4;
      if (fp < .42 && !lose) { const e = fp / .42, fx = 220 + ((t / 3.4) | 0) % 3 * 170, fy = 520 - Math.sin(e * Math.PI) * 120, ang = Math.cos(e * Math.PI) * -.9; ctx.save(); ctx.translate(fx, fy); ctx.rotate(ang);
        K.polyP([[0, 0]]); ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-40, -14); ctx.lineTo(-40, 14); ctx.closePath(); K.ink('#ff7a2f', 3);
        const fb = K.elP(0, 0, 26, 16); K.cel(fb, '#ff4d3f', '#c92f2a', 4, 4, 3.5); ctx.fillStyle = '#fff'; K.rr(8, 2, 16, 8, 3); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); K.eye(10, -5, 4.5, null, 1, 0, 4); ctx.restore(); }
      // bridge: planks on a rope line, posts at both ends
      const pts = []; for (let x = X0; x <= X1; x += 10) pts.push([x, by(x) - 8]);
      for (const x of [X0 - 10, X1 + 10]) { K.rr(x - 6, by(x) - 40, 12, 44, 3); K.ink('#a5622c', 3); }
      K.line(pts, 14, '#c98b4d', 10); ctx.strokeStyle = INK; ctx.lineWidth = 4; for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1] - 7); ctx.lineTo(pts[i][0], pts[i][1] + 7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,230,180,.6)'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1] - 4) : ctx.moveTo(q[0], q[1] - 4)); ctx.stroke();
      // the big glove
      if (hold && !tired && !g.result) {
        const gx = 400, gy = by(400) + 46 + Math.sin(t * 30) * 2;
        K.rr(gx - 40, gy - 4, 80, 40, 16); K.ink('#fff', 4); ctx.fillStyle = 'rgba(160,170,200,.5)'; ctx.fillRect(gx - 34, gy + 22, 68, 8);
        for (const [dx, h] of [[-30, 30], [-10, 36], [10, 36], [30, 28]]) { K.rr(gx + dx - 8, gy - h, 16, h + 6, 8); K.ink('#fff', 3.5); }
        for (const x of [330, 470]) { const y = by(x) + 34; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x, y); ctx.lineTo(x - 10, y + 10); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 10); ctx.stroke(); }
      }
      // the convertible with Claude at the wheel
      let y = by(cx) - 20 + (lose ? fall : 0);
      if (lose && y > 560) y = 560;
      if (!lose) shadow(cx, by(cx) + 4, 36, 6, .3);
      const bounce = !g.result ? Math.sin(t * 22) * 1 : 0;
      ctx.save(); ctx.translate(cx, y + bounce); ctx.rotate(lose ? Math.min(.6, ot * 1.2) : 0);
      const body = K.rrP(-36, -24, 72, 24, 9); K.cel(body, '#4D7CFF', '#2f55c4', 0, 5, 4);
      const ar = dsArms(g, t);
      claude(2, -12, 3.2, { mood: dsMood(g) });
      K.rr(-36, -16, 72, 16, 7); K.ink('#4D7CFF', 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-28, -14, 36, 3);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, -24); ctx.lineTo(-20, -34); ctx.lineTo(-12, -34); ctx.stroke();
      for (const wx of [-21, 21]) { K.dot(wx, 0, 9, '#333', 3); ctx.save(); ctx.translate(wx, 0); ctx.rotate(cx * .15); ctx.fillStyle = '#cfd8e6'; ctx.fillRect(-1.5, -6, 3, 12); ctx.fillRect(-6, -1.5, 12, 3); ctx.restore(); }
      if (win) { K.heart(0, -52 - Math.abs(Math.sin(ot * 9)) * 8, .8); }
      ctx.restore();
      void ar;
      // lava in front of everything that sinks, with bubbles and a splash
      const lf = ctx.createLinearGradient(0, 508, 0, H); lf.addColorStop(0, 'rgba(255,138,63,.96)'); lf.addColorStop(1, 'rgba(255,74,31,.98)');
      ctx.fillStyle = lf; ctx.beginPath(); ctx.moveTo(-OX, H); ctx.lineTo(-OX, 512); for (let x = -OX; x <= W + OX; x += 20) ctx.lineTo(x, 510 + Math.sin(x * .04 + t * 3) * 4); ctx.lineTo(W + OX, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); for (let x = -OX; x <= W + OX; x += 20) { const yy = 510 + Math.sin(x * .04 + t * 3) * 4; x === -OX ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
      for (let i = 0; i < 5; i++) { const ph = (t * .5 + i * .2) % 1, bx = (i * 191 + 60) % VW - OX; K.dot(bx, 590 - ph * 60, 4 + ph * 5, '#ffd23f', 2); }
      if (lose) { for (let i = 0; i < 7; i++) { const ph = Math.min(1, ot / .8), a = -1.2 - i * .25, v = 160 + K.hr(i) * 120; K.dot(cx + Math.cos(a) * v * ph, 510 + Math.sin(a) * v * ph + 500 * ph * ph, 6 - ph * 3, '#ffd23f', 2); } for (let i = 0; i < 3; i++) { const ph = (ot * 1.5 + i * .3) % 1; ctx.fillStyle = 'rgba(70,60,70,' + (.6 - ph * .5) + ')'; ctx.beginPath(); ctx.arc(cx - 20 + i * 20, 500 - ph * 80, 10 + ph * 14, 0, 7); ctx.fill(); } }
      // the grip meter on the cliff
      ctx.save(); K.rr(28, 356, 104, 20, 6); ctx.clip(); ctx.fillStyle = '#2a2018'; ctx.fillRect(28, 356, 104, 20); ctx.fillStyle = grip > 25 ? '#5CFF7A' : '#ff4d4d'; ctx.fillRect(28, 356, 104 * grip / 100, 20); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(28, 358, 104 * grip / 100, 4); ctx.restore();
      txt(tired ? 'TIRED!' : 'GRIP', 80 + (tired ? Math.sin(t * 40) * 3 : 0), 398, tired ? 24 : 20, tired ? '#ff4d4d' : '#fff');
      vignette(.16);
    }
  };
  return g;
}

/* ── 9 ── SCRATCH AND MATCH: scratch the foil, find the lucky symbols
   Art: a ticket on a shop counter. Silver foil with a rainbow sheen, a coin for a stylus, a cat guarding the till and Claude the shopkeeper. Win: gold coins rain and the ticket glows. Lose: a rain cloud over Claude. */
function dsScratch(sp) {
  const K = DSK, SY = 5, lucky = Math.random() * SY | 0, others = shuffle([...Array(SY).keys()].filter(i => i !== lucky));
  const syms = shuffle([lucky, lucky, ...others.slice(0, 4)]);
  const pos = [[220, 300], [400, 300], [580, 300], [220, 460], [400, 460], [580, 460]], RAD = 66, CELL = 12;
  const cells = pos.map(() => new Set()); const done = pos.map(() => false);
  let foil = null, fc = null, pr = false, lp = null, rT0 = -1; const bk = {};
  try {
    foil = document.createElement('canvas'); foil.width = W; foil.height = H; fc = foil.getContext('2d');
    for (const p of pos) {
      const gr = fc.createLinearGradient(p[0] - RAD, p[1] - RAD, p[0] + RAD, p[1] + RAD);
      gr.addColorStop(0, '#e9edf2'); gr.addColorStop(.5, '#a9b2bf'); gr.addColorStop(1, '#dfe4ea');
      fc.fillStyle = gr; fc.beginPath(); fc.arc(p[0], p[1], RAD, 0, 7); fc.fill();
      fc.save(); fc.beginPath(); fc.arc(p[0], p[1], RAD, 0, 7); fc.clip();
      for (let i = -3; i < 4; i++) { fc.fillStyle = 'hsla(' + (200 + i * 40) + ',90%,75%,.22)'; fc.beginPath(); fc.moveTo(p[0] + i * 24 - 14, p[1] - RAD); fc.lineTo(p[0] + i * 24 + 6, p[1] - RAD); fc.lineTo(p[0] + i * 24 - 40, p[1] + RAD); fc.lineTo(p[0] + i * 24 - 60, p[1] + RAD); fc.fill(); }
      fc.restore();
      fc.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * (RAD - 6); fc.fillRect(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 3, 3); }
      fc.fillStyle = '#7f8896'; for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = Math.random() * (RAD - 6); fc.fillRect(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 3, 3); }
    }
  } catch (e) { foil = null; }
  const sym = (i, x, y, s) => {
    if (i === 0) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 14 * s, y + 10 * s); ctx.quadraticCurveTo(x - 4 * s, y - 20 * s, x + 6 * s, y - 32 * s); ctx.moveTo(x + 14 * s, y + 10 * s); ctx.quadraticCurveTo(x + 10 * s, y - 20 * s, x + 6 * s, y - 32 * s); ctx.stroke(); for (const o of [-14, 14]) { const c = K.elP(x + o * s, y + 14 * s, 13 * s, 13 * s); K.cel(c, '#ff4d4d', '#c9302f', 3 * s, 3 * s, 4); K.glint(c, x + o * s - 4 * s, y + 8 * s, 4 * s, 2.5 * s); } K.el(x + 12 * s, y - 28 * s, 11 * s, 5 * s, -.5); K.ink('#3fbf5a', 2.5); }
    else if (i === 1) txt('7', x, y, 78 * s, '#ff4d4d');
    else if (i === 2) { star(x, y, 38 * s, 17 * s, 5, -Math.PI / 2, '#FFE14D', 4); ctx.fillStyle = 'rgba(255,255,255,.6)'; K.el(x - 8 * s, y - 10 * s, 7 * s, 3 * s, -.7); ctx.fill(); }
    else if (i === 3) { const l = K.elP(x, y, 36 * s, 24 * s, -.4); K.cel(l, '#FFE14D', '#e0b52a', 5 * s, 5 * s, 4); K.glint(l, x - 10 * s, y - 8 * s, 10 * s, 4 * s); }
    else { const d = K.polyP([[x, y - 34 * s], [x + 28 * s, y], [x, y + 34 * s], [x - 28 * s, y]]); K.cel(d, '#4DB8FF', '#2a7fc9', 8 * s, 0, 4); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14 * s, y - 4 * s); ctx.lineTo(x, y - 20 * s); ctx.lineTo(x + 8 * s, y - 8 * s); ctx.stroke(); }
  };
  const scratch = (a, b) => {
    if (fc) {
      fc.globalCompositeOperation = 'destination-out'; fc.lineCap = 'round'; fc.lineWidth = 46; fc.beginPath(); fc.moveTo(a.x, a.y); fc.lineTo(b.x, b.y); fc.stroke(); fc.globalCompositeOperation = 'source-over';
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
      pos.forEach((p, i) => {
        if (done[i] || Math.hypot(x - p[0], y - p[1]) > RAD + 20) return;
        for (let cy = -RAD; cy <= RAD; cy += CELL) for (let cxx = -RAD; cxx <= RAD; cxx += CELL) {
          if (cxx * cxx + cy * cy > RAD * RAD) continue;
          if (Math.hypot(p[0] + cxx - x, p[1] + cy - y) < 23) cells[i].add(cxx + ',' + cy);
        }
      });
    }
    pos.forEach((p, i) => {
      if (done[i]) return;
      let tot = 0; for (let cy = -RAD; cy <= RAD; cy += CELL) for (let cxx = -RAD; cxx <= RAD; cxx += CELL) if (cxx * cxx + cy * cy <= RAD * RAD) tot++;
      if (cells[i].size > tot * .42) {
        done[i] = true; if (syms[i] === lucky) { sfx.coin(); ring(p[0], p[1], '#5CFF7A', 80); floatText('LUCKY!', p[0], p[1] - 50, '#5CFF7A', 30); } else { sfx.pop(); burst(p[0], p[1], '#aab3c2', 8); }
        if (fc) { fc.globalCompositeOperation = 'destination-out'; fc.beginPath(); fc.arc(p[0], p[1], RAD + 2, 0, 7); fc.fill(); fc.globalCompositeOperation = 'source-over'; }
        if (syms[i] === lucky) confetti(p[0], p[1], 14);
      }
    });
    if (pos.every((p, i) => !(syms[i] === lucky) || done[i])) { g.result = 'win'; dsWin(400, 300, 40); }
  };
  const shop = c => {
    // wallpaper strip + counter surface
    K.grad(0, 92, ['#ff9fb8', '#ffb3c7']); c.fillStyle = 'rgba(255,255,255,.28)'; for (let x = -OX + 10; x < W + OX; x += 40) c.fillRect(x, 0, 18, 92);
    K.grad(88, H, ['#d9944f', '#b9783c']); c.fillStyle = INK; c.fillRect(-OX, 86, VW, 5);
    c.strokeStyle = 'rgba(120,60,20,.28)'; c.lineWidth = 3; for (let y = 140; y < H; y += 62) { c.beginPath(); c.moveTo(-OX, y); c.lineTo(W + OX, y); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(-OX, 100); c.lineTo(W + OX, 100); c.lineTo(W + OX, 126); c.lineTo(-OX, 126); c.fill();
  };
  const g = {
    wide: true, cmd: 'SCRATCH!', hint: 'SCRATCH FOR BOTH LUCKY SYMBOLS', thint: 'SCRATCH FOR BOTH LUCKY SYMBOLS', dur: 5.8,
    down(p) { if (g.result) return; pr = true; lp = { x: p.x, y: p.y }; scratch(lp, lp); },
    move(p) { if (!pr || g.result) return; scratch(lp, p); lp = { x: p.x, y: p.y }; if (Math.random() < .25) noise(.05, .025, 3000 + Math.random() * 2000, 6000, 'bandpass'); if (Math.random() < .3) burst(p.x, p.y, '#dfe4ea', 1, 110); },
    up() { pr = false; },
    update() { if (g.result && rT0 < 0) rT0 = now; },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose';
      K.bake(bk, shop);
      // neon stars on the wall, one flickering
      for (let i = 0; i < 5; i++) { const fl = i === 2 && Math.sin(t * 13) > .6 ? .3 : 1; ctx.globalAlpha = fl; star(110 + i * 145, 68, 9, 4, 5, t * .5 + i, '#FFE14D', 2.5); ctx.globalAlpha = 1; }
      // the ticket: a yellow card with punched edges
      ctx.fillStyle = 'rgba(20,16,28,.28)'; K.rr(88, 110, 640, 480, 22); ctx.fill();
      const tk = K.rrP(80, 100, 640, 480, 22); K.cel(tk, win ? '#ffe36a' : '#ffe9a8', win ? '#f0b83a' : '#e8c878', 0, 8, 6);
      ctx.fillStyle = '#c47b3d'; for (let y = 130; y < 570; y += 40) { ctx.beginPath(); ctx.arc(80, y, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(720, y, 8, 0, 7); ctx.fill(); }
      K.rr(140, 112, 520, 64, 16); K.ink('#fff', 5); txt('LUCKY', 255, 144, 34, '#ff4d9e'); K.rr(360, 118, 60, 52, 10); K.ink('#fff', 3); sym(lucky, 390, 144, .55);
      txt('= WIN', 520, 144, 34, '#ff4d9e');
      pos.forEach((p, i) => { K.dot(p[0], p[1], RAD, '#fff', 5); sym(syms[i], p[0], p[1], 1); });
      if (foil) ctx.drawImage(foil, 0, 0);
      else pos.forEach((p, i) => { if (!done[i]) circ(p[0], p[1], RAD, '#aab3c2', 0); });
      pos.forEach((p, i) => { if (!done[i]) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p[0], p[1], RAD, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p[0], p[1], RAD - 5, 3.6, 4.7); ctx.stroke(); } });
      pos.forEach((p, i) => { if (done[i] && syms[i] === lucky) { ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(p[0], p[1], RAD + 7, 0, 7); ctx.stroke(); } });
      // Claude the shopkeeper (left margin) and the cat guarding the till (right)
      const ar = dsArms(g, t), cx = 40, cyy = 330;
      if (lose) { // a fat storm cloud rains on Claude
        const cl = [[0, 0, 30], [34, -12, 36], [74, 0, 28], [36, 10, 30]], bx = cx - 10, by = cyy - 92;
        for (const [a, b, r] of cl) { ctx.beginPath(); ctx.arc(bx + a, by + b, r, 0, 7); K.ink(null, 3.5); }
        for (const [a, b, r] of cl) { ctx.beginPath(); ctx.arc(bx + a, by + b, r, 0, 7); ctx.fillStyle = '#7d869e'; ctx.fill(); }
        ctx.fillStyle = '#a3abc2'; for (const [a, b, r] of cl) { ctx.beginPath(); ctx.arc(bx + a - 4, by + b - 7, r * .72, 0, 7); ctx.fill(); }
        ctx.strokeStyle = '#4DB8FF'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const ph = (ot * 2.2 + i * .23) % 1, rx = bx - 14 + i * 12, ry = by + 30 + ph * 130; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 13); ctx.stroke(); }
        K.sweat(cx + 26, cyy - 52, 1.2, (ot * 1.2) % 1); }
      K.hero(cx, cyy - Math.abs(win ? Math.sin(t * 9) * 14 : 0), 3.4, { mood: dsMood(g), la: ar[0], ra: ar[1] });
      K.pill(cx, cyy - 9 * 3.4 - 18, 'YOU', '#FFE14D');
      const kx = W + OX - 42, ky = 330, tl = Math.sin(t * 3) * 10;
      shadow(kx, ky + 6, 26, 6, .28); K.line([[kx + 14, ky - 8], [kx + 34 + tl, ky - 20], [kx + 28 + tl * 1.4, ky - 46]], 6, '#ff9f4d', 6);
      const cb = K.elP(kx, ky - 22, 24, 22); K.cel(cb, '#ff9f4d', '#d9792e', 5, 4, 4); const ch2 = K.elP(kx - 6, ky - 52, 19, 17); K.cel(ch2, '#ff9f4d', '#d9792e', 4, 2, 4);
      for (const s of [-1, 1]) { const e = K.polyP([[kx - 6 + s * 7, ky - 62], [kx - 6 + s * 18, ky - 78], [kx - 6 + s * 19, ky - 56]]); K.cel(e, '#ff9f4d', '#d9792e', 2, 0, 3.5); }
      K.eye(kx - 13, ky - 52, 5, win ? 'happy' : lose ? 'dead' : null, -1, 1, 3); K.eye(kx + 1, ky - 52, 5, win ? 'happy' : lose ? 'dead' : null, -1, 1, 4);
      if (lose) K.sweat(kx - 22, ky - 40, 1.1, (ot * 1.3) % 1);
      if (win) for (let i = 0; i < 2; i++) { const ph = (ot * 1.4 + i * .5) % 1; K.heart(kx - 4 + i * 8, ky - 84 - ph * 40, .7, 1 - ph); }
      // coin stylus
      if (pr && !g.result && lp) { ctx.save(); ctx.translate(lp.x, lp.y); ctx.rotate(-.4); K.dot(0, 0, 18, '#ffd23f', 3.5); K.dot(0, 0, 11, '#ffe98a', 2); txt('$', 0, 1, 16, '#c99512'); ctx.restore(); }
      // win: gold coins rain down
      if (win) for (let i = 0; i < 14; i++) { const x0 = 30 + K.hr(i + 4) * 740, ph = ot * (260 + K.hr(i) * 120) - K.hr(i + 8) * 200, y0 = 90 + ph; if (y0 < 90 || y0 > 535 || x0 < 310 && y0 < 150) continue; ctx.save(); ctx.translate(x0, y0); ctx.scale(Math.abs(Math.cos(ot * 8 + i)) * .8 + .2, 1); K.dot(0, 0, 13, '#ffd23f', 3); ctx.restore(); }
      vignette(.16);
    }
  };
  return g;
}

/* ── 10 ── STRAIGHT FACES: click each row to make the face match the poster
   Art: a carnival tent. The example is a framed portrait, yours is a slot machine whose reels are the eyes, nose and mouth. Win: jackpot bulbs and a coin shower. Lose: the machine tilts, smoking. */
function dsFaces(sp) {
  const K = DSK, N = sp > 1.5 ? 5 : 4, RW = 240, RH = 104, SY = 150;
  const feat = (row, i, x, y) => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.fillStyle = INK;
    const glint = (a, b, r) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a - r * .3, b - r * .35, r * .3, 0, 7); ctx.fill(); };
    if (row === 0) {
      if (i === 0) { for (const s of [-1, 1]) { circ(x + s * 46, y, 11, INK, 0); glint(x + s * 46, y, 11); } }
      else if (i === 1) { for (const s of [-1, 1]) { circ(x + s * 46, y + 4, 10, INK, 0); glint(x + s * 46, y + 4, 10); } ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 68, y - 22); ctx.lineTo(x - 28, y - 8); ctx.moveTo(x + 68, y - 22); ctx.lineTo(x + 28, y - 8); ctx.stroke(); }
      else if (i === 2) { ctx.lineWidth = 8; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 46, y + 8, 18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
      else if (i === 3) { for (const s of [-1, 1]) { circ(x + s * 46, y, 26, '#fff', 4); circ(x + s * 46 + s * -4, y + 6, 10, INK, 0); glint(x + s * 46 - s * 4, y + 6, 10); } }
      else { for (const s of [-1, 1]) star(x + s * 46, y, 22, 10, 5, -Math.PI / 2, '#FFE14D', 3); }
    } else if (row === 1) {
      if (i === 0) { circ(x, y, 14, '#ff9f4d', 4); glint(x, y, 14); }
      else if (i === 1) { const p = K.polyP([[x, y - 18], [x + 18, y + 16], [x - 18, y + 16]]); K.cel(p, '#ff9f4d', '#d9792e', 4, 3, 4); }
      else if (i === 2) { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x, y + 20); ctx.lineTo(x + 14, y + 20); ctx.stroke(); }
      else if (i === 3) { const p = K.elP(x, y, 26, 18); K.cel(p, '#ff8fb8', '#e87aa6', 4, 4, 4); ctx.fillStyle = INK; ctx.fillRect(x - 12, y - 6, 7, 12); ctx.fillRect(x + 6, y - 6, 7, 12); }
      else { circ(x, y, 24, '#ff4d4d', 4); glint(x, y, 24); }
    } else {
      if (i === 0) { ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y - 18, 40, .35, Math.PI - .35); ctx.stroke(); }
      else if (i === 1) { ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y + 30, 40, Math.PI + .35, -.35); ctx.stroke(); }
      else if (i === 2) { K.el(x, y, 20, 26); K.ink('#6b1f2a', 4); ctx.fillStyle = '#ff6b7a'; K.el(x, y + 12, 10, 8); ctx.fill(); }
      else if (i === 3) { ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y - 18, 40, .35, Math.PI - .35); ctx.stroke(); K.el(x + 8, y + 22, 13, 18); K.ink('#ff4d6e', 3); }
      else { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x - 50, y); for (let q = 1; q <= 6; q++) ctx.lineTo(x - 50 + q * 100 / 6, y + (q % 2 ? 14 : -14)); ctx.stroke(); }
    }
    ctx.lineCap = 'butt';
  };
  const tgt = [0, 1, 2].map(() => Math.random() * N | 0);
  const rows = [0, 1, 2].map(r => ({ idx: tgt[r], prev: 0, anim: 1 }));
  const wrong = shuffle([0, 1, 2]).slice(0, 2 + (Math.random() < .5 ? 1 : 0));
  for (const r of wrong) rows[r].idx = (tgt[r] + 1 + (Math.random() * (N - 1) | 0)) % N;
  let press = null, rT0 = -1; const bk = {};
  const cyc = (r, d) => {
    if (g.result) return; const o = rows[r]; o.prev = o.idx; o.idx = (o.idx + d + N) % N; o.anim = 0; o.d = d; sfx.blip(r * 3 + (o.idx === tgt[r] ? 7 : 0)); if (o.idx === tgt[r]) { ring(580, SY + r * RH + RH / 2, '#5CFF7A', 90, .35); sfx.pop(); }
    if (rows.every((q, i) => q.idx === tgt[i])) { g.result = 'win'; dsWin(580, 300, 36); }
  };
  const rowAt = p => { for (let r = 0; r < 3; r++) if (p.x > 460 && p.x < 460 + RW && p.y > SY + r * RH && p.y < SY + (r + 1) * RH) return r; return -1; };
  const tent = c => {
    K.grad(0, 520, ['#fff1d6', '#ffe0b0']);
    for (let x = -Math.ceil(OX / 60) * 60; x < W + OX; x += 120) { c.fillStyle = 'rgba(255,92,100,.5)'; c.fillRect(x, 0, 60, 520); }
    K.grad(516, H, ['#c47b3d', '#8a5530']); c.fillStyle = INK; c.fillRect(-OX, 514, VW, 5);
    c.strokeStyle = 'rgba(60,30,10,.3)'; c.lineWidth = 3; for (let x = -OX; x < W + OX; x += 70) { c.beginPath(); c.moveTo(x, 519); c.lineTo(x - 24, H); c.stroke(); }
    // scalloped tent valance across the top
    for (let x = -Math.ceil(OX / 50) * 50; x < W + OX + 50; x += 50) { c.beginPath(); c.arc(x + 25, 50, 25, 0, Math.PI); c.closePath(); K.ink((x / 50 & 1) ? '#ff5c64' : '#fff', 3); }
    // portrait frame + the hair and ears of the example face
    K.rr(80, SY - 18, RW + 40, RH * 3 + 36, 24); K.ink('#d9944f', 5);
    K.el(220, SY + 6, 130, 46); K.ink('#6b3d1f', 4);
    for (const x of [96, 344]) { K.dot(x, SY + RH * 1.5, 18, '#f3c79a', 4); }
    // the slot machine around the reels
    K.rr(436, 118, 312, 394, 26); K.ink('#e8434f', 5); c.fillStyle = 'rgba(255,255,255,.22)'; K.rr(448, 126, 288, 12, 6); c.fill();
    K.rr(450, 140, 262, 326, 14); K.ink('#ffd23f', 4); K.rr(436, 476, 312, 38, 14); K.ink('#b8283a', 5); K.rr(520, 486, 144, 18, 6); K.ink('#14101c', 3);
    for (let i = 0; i < 3; i++) { K.dot(722, SY + i * RH + RH / 2, 17, '#ffd23f', 3.5); }
    K.rr(758, 250, 12, 90, 5); K.ink('#cfd8e6', 3);
  };
  const g = {
    wide: true, cmd: 'MATCH!', hint: 'CLICK EACH ROW TO CHANGE IT (OR 1 2 3)', thint: 'TAP EACH ROW TO CHANGE IT', dur: 5.5,
    down(p) { if (g.result) return; const r = rowAt(p); press = r >= 0 ? { r, y: p.y } : null; },
    up(p) { if (!press) return; const dy = p.y - press.y; cyc(press.r, Math.abs(dy) > 30 ? (dy < 0 ? 1 : -1) : 1); press = null; },
    key(e) { const m = /^Digit([123])$/.exec(e.code || ''); if (m) cyc(+m[1] - 1, 1); },
    update(dt) { if (g.result && rT0 < 0) rT0 = now; for (const r of rows) r.anim = Math.min(1, r.anim + dt * 8); },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose', allOk = rows.every((q, i) => q.idx === tgt[i]);
      K.bake(bk, tent);
      const drawRow = (x, r, idx, prev, anim, d, base) => {
        ctx.save(); ctx.beginPath(); ctx.rect(x, SY + r * RH, RW, RH); ctx.clip();
        ctx.fillStyle = base; ctx.fillRect(x, SY + r * RH, RW, RH);
        const cy = SY + r * RH + RH / 2;
        if (anim < 1) { const e = anim * anim * (3 - 2 * anim); feat(r, prev, x + RW / 2, cy - e * RH * d); feat(r, idx, x + RW / 2, cy + (1 - e) * RH * d); }
        else feat(r, idx, x + RW / 2, cy);
        ctx.restore();
      };
      // the example portrait: a face-shaped panel
      txt('MAKE THIS', 220, 100, 28, '#fff');
      ctx.save(); K.rr(100, SY, RW, RH * 3, 38); ctx.clip(); for (let r = 0; r < 3; r++) drawRow(100, r, tgt[r], 0, 1, 1, '#f9d9b0'); ctx.fillStyle = 'rgba(255,110,140,.22)'; K.el(128, SY + RH * 1.75, 16, 9); ctx.fill(); K.el(312, SY + RH * 1.75, 16, 9); ctx.fill(); ctx.restore(); K.rr(100, SY, RW, RH * 3, 38); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
      for (const [a, b] of [[88, SY - 8], [352, SY - 8]]) { ctx.save(); ctx.translate(a + 14, b + 6); ctx.rotate(a < 200 ? -.6 : .6); K.rr(-18, -6, 36, 12, 2); K.ink('rgba(255,243,200,.85)', 2); ctx.restore(); }
      // the slot machine: the reels
      txt('YOURS', 580, 100, 28, '#fff');
      ctx.save(); K.rr(460, SY, RW, RH * 3, 8); ctx.clip();
      for (let r = 0; r < 3; r++) {
        drawRow(460, r, rows[r].idx, rows[r].prev, rows[r].anim, rows[r].d || 1, '#f9d9b0');
        if (rows[r].idx === tgt[r]) { ctx.fillStyle = 'rgba(92,255,122,.28)'; ctx.fillRect(460, SY + r * RH, RW, RH); }
        const sh = ctx.createLinearGradient(0, SY + r * RH, 0, SY + (r + 1) * RH); sh.addColorStop(0, 'rgba(20,16,28,.28)'); sh.addColorStop(.25, 'rgba(20,16,28,0)'); sh.addColorStop(.75, 'rgba(20,16,28,0)'); sh.addColorStop(1, 'rgba(20,16,28,.28)'); ctx.fillStyle = sh; ctx.fillRect(460, SY + r * RH, RW, RH);
      }
      ctx.restore(); ctx.fillStyle = INK; ctx.fillRect(460, SY + RH - 2, RW, 4); ctx.fillRect(460, SY + RH * 2 - 2, RW, 4); K.rr(460, SY, RW, RH * 3, 8); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      for (let r = 0; r < 3; r++) txt('' + (r + 1), 722, SY + r * RH + RH / 2, 24, rows[r].idx === tgt[r] ? '#5CFF7A' : '#fff');
      // marquee bulbs
      for (let i = 0; i < 11; i++) { const on = win ? ((i + Math.floor(t * 12)) % 3) : lose ? 1 : (Math.floor(t * 4) + i) % 2; ctx.fillStyle = win ? 'hsl(' + ((i * 33 + t * 300) % 360) + ',95%,60%)' : lose ? '#7a1f2a' : on ? '#fff3a0' : '#c99512'; ctx.beginPath(); ctx.arc(458 + i * 22.5, 128, 5, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
      // the lever
      const lv = win ? Math.min(1, ot / .25) * 50 : 0; K.dot(764, 246 + lv, 12, '#ff4d5e', 3.5);
      txt('=', 400, SY + RH * 1.5, 50 + (allOk ? Math.sin(t * 12) * 4 : 0), '#fff');
      // Claude between the pictures, eyes on the reels
      const ar = dsArms(g, t), jy = win ? Math.abs(Math.sin(t * 10)) * 14 : 0;
      K.hero(400, 538 - jy, 5.6, { mood: dsMood(g), la: ar[0], ra: ar[1] });
      K.pill(400, 538 - 9 * 5.6 - 22, 'YOU', '#FFE14D');
      if (lose) { for (let i = 0; i < 3; i++) { const ph = (ot * 1.3 + i * .33) % 1; ctx.fillStyle = 'rgba(120,120,130,' + (.7 - ph * .6) + ')'; ctx.beginPath(); ctx.arc(660 + i * 20, 470 - ph * 70, 10 + ph * 12, 0, 7); ctx.fill(); } K.sweat(430, 538 - 9 * 5.6 + 10, 1, (ot * 1.4) % 1); }
      if (win) for (let i = 0; i < 12; i++) { const x0 = 500 + K.hr(i) * 200, v = 120 + K.hr(i + 3) * 200, a = -1.57 + (K.hr(i + 6) - .5) * 1.6; ctx.save(); ctx.translate(x0 + Math.cos(a) * v * ot * .5, 480 + Math.sin(a) * v * ot * 1.4 + 600 * ot * ot); ctx.scale(Math.abs(Math.cos(ot * 9 + i)) * .8 + .2, 1); K.dot(0, 0, 10, '#ffd23f', 3); ctx.restore(); }
      vignette(.16);
    }
  };
  return g;
}

/* ── 11 ── CATCH A TUNE: drag the dial until the picture is clear
   Art: a 1980s living room. A wooden TV with rabbit ears, a cat on top, a cooking-show Claude on the screen under the snow. Win: the picture clears and the cat purrs hearts. Lose: the CRT shrinks to a dot. */
function dsTune(sp) {
  const K = DSK, spot = dsRnd(.15, .85); let d = spot + (Math.random() < .5 ? -1 : 1) * dsRnd(.32, .48);
  d = Math.max(.02, Math.min(.98, d)); if (Math.abs(d - spot) < .3) d = spot < .5 ? .95 : .05;
  const SX = 130, SW = 540; let pr = false, hold = 0, beep = 0, rT0 = -1; const bk = {};
  const clarity = () => Math.pow(Math.max(0, 1 - Math.abs(d - spot) / .3), 2);
  const room = c => {
    K.grad(0, 556, ['#ffc89b', '#ffba85']); c.fillStyle = 'rgba(200,120,70,.16)'; for (let x = -OX + 8; x < W + OX; x += 44) c.fillRect(x, 0, 20, 556);
    c.fillStyle = 'rgba(255,120,150,.4)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(K.hr(i) * VW - OX, K.hr(i + 20) * 540, 4, 0, 7); c.fill(); }
    K.grad(556, H, ['#b97a46', '#8a5530']); c.fillStyle = INK; c.fillRect(-OX, 552, VW, 5);
    // the plant and the lamp
    K.rr(24, 500, 46, 54, 8); K.ink('#d9552e', 4); for (const [a, b, an] of [[-26, -50, -.7], [0, -70, 0], [26, -50, .7]]) { c.save(); c.translate(47, 504); c.rotate(an); K.el(0, b, 14, 38); K.ink('#3fbf5a', 3); c.restore(); }
    const lx = W + OX - 44; K.rr(lx - 4, 360, 8, 190, 3); K.ink('#4a4560', 3); K.polyP([[0, 0]]); c.beginPath(); c.moveTo(lx - 30, 360); c.lineTo(lx + 30, 360); c.lineTo(lx + 20, 310); c.lineTo(lx - 20, 310); c.closePath(); K.ink('#fff3a0', 4);
    // the wooden console
    c.fillStyle = 'rgba(20,16,28,.25)'; K.rr(98, 118, 620, 440, 28); c.fill();
    const tv = K.rrP(90, 110, 620, 440, 28); K.cel(tv, '#c97b4a', '#9a5a30', 0, 9, 6); K.rr(98, 118, 604, 14, 7); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill();
    for (const x of [150, 600]) { K.rr(x, 546, 50, 16, 5); K.ink('#6a3d20', 3.5); }
    // screen bezel
    K.rr(158, 138, 484, 294, 36); K.ink('#3a3550', 5); K.rr(172, 146, 456, 278, 30); c.lineWidth = 3; c.strokeStyle = '#14101c'; c.stroke();
    // dial tray
    K.rr(120, 455, 560, 66, 16); K.ink('#f4e2c4', 5); c.strokeStyle = INK; c.lineWidth = 3; for (let i = 0; i <= 20; i++) { const x = SX + i * SW / 20; c.beginPath(); c.moveTo(x, 470); c.lineTo(x, i % 5 ? 484 : 494); c.stroke(); }
    // rabbit ears
    for (const [x0, x1, y1] of [[330, 270, 62], [470, 530, 62]]) { K.line([[x0, 112], [x1, y1]], 6, '#cfd8e6', 6); K.dot(x1, y1, 8, '#ff4d5e', 3); }
  };
  const g = {
    wide: true, cmd: 'TUNE!', hint: 'DRAG THE DIAL (OR ← →) TILL IT IS CLEAR', thint: 'DRAG THE DIAL TILL IT IS CLEAR', dur: 5.4,
    down(p) { if (g.result) return; pr = true; d = Math.max(0, Math.min(1, (p.x - SX) / SW)); },
    move(p) { if (pr && !g.result) d = Math.max(0, Math.min(1, (p.x - SX) / SW)); },
    up() { pr = false; },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (g.result) return;
      const kk = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      if (kk) d = Math.max(0, Math.min(1, d + kk * .45 * dt * Math.sqrt(sp)));
      beep -= dt; if (beep <= 0) { beep = .12; snd(180 + clarity() * 900, .06, 'triangle', .03); if (clarity() < .6) noise(.08, .03 * (1 - clarity()), 2000, 5000, 'bandpass'); }
      if (Math.abs(d - spot) < .035) { hold += dt; if (hold > .45) { g.result = 'win'; sfx.coin(); dsWin(400, 260); } } else hold = Math.max(0, hold - dt);
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, win = g.result === 'win', lose = g.result === 'lose';
      K.bake(bk, room);
      const SXs = 180, SYs = 150, SWs = 440, SHs = 270, cl = g.result ? (lose ? 0 : 1) : clarity();
      // the cat on top of the set
      ctx.save(); ctx.translate(400, 110); ctx.scale(.72, .72); ctx.translate(-400, -110);
      const tl = Math.sin(t * 3) * 12; K.line([[418, 108], [450 + tl, 96], [452 + tl * 1.3, 72]], 6, '#ff9f4d', 6);
      const cb = K.elP(398, 92, 30, 20); K.cel(cb, '#ff9f4d', '#d9792e', 5, 4, 4); const ch2 = K.elP(380, 64, 20, 18); K.cel(ch2, '#ff9f4d', '#d9792e', 4, 2, 4);
      for (const s of [-1, 1]) { const e = K.polyP([[380 + s * 8, 52], [380 + s * 19, 36], [380 + s * 20, 58]]); K.cel(e, '#ff9f4d', '#d9792e', 2, 0, 3.5); }
      K.eye(372, 64, 5, win ? 'happy' : null, cl < .5 ? 1 : 0, 1, 3); K.eye(388, 64, 5, win ? 'happy' : null, cl < .5 ? 1 : 0, 1, 4);
      if (win) for (let i = 0; i < 3; i++) { const ph = (ot * 1.3 + i * .33) % 1; K.heart(360 + i * 24, 40 - ph * 20, .7, 1 - ph); }
      ctx.restore();
      // the picture tube
      ctx.save(); K.rr(SXs, SYs, SWs, SHs, 28); ctx.clip();
      ctx.fillStyle = '#9BF6FF'; ctx.fillRect(SXs, SYs, SWs, SHs);
      K.cloud(SXs + 60 + (t * 14) % 340, SYs + 40, .8);
      K.sun(SXs + 380, SYs + 62, 26, t, cl > .85 ? 'smile' : null);
      ctx.fillStyle = '#7cd46f'; ctx.beginPath(); ctx.ellipse(SXs + 120, SYs + 240, 200, 70, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#58c24a'; ctx.fillRect(SXs, SYs + 200, SWs, 70);
      ctx.fillStyle = INK; ctx.fillRect(SXs, SYs + 198, SWs, 4);
      const bfx = SXs + 300 + Math.sin(t * 1.3) * 60, bfy = SYs + 150 + Math.sin(t * 2.2) * 18; ctx.fillStyle = '#ff4d9e'; ctx.beginPath(); ctx.ellipse(bfx - 6, bfy, 8, 5 + Math.sin(t * 20) * 3, .5, 0, 7); ctx.ellipse(bfx + 6, bfy, 8, 5 + Math.sin(t * 20) * 3, -.5, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(SXs + 220, SYs + 250); const hp = cl > .85 ? Math.abs(Math.sin(t * 8)) * 8 : 0; ctx.translate(0, -hp); ctx.translate(-(SXs + 220), -(SYs + 250));
      claude(SXs + 220, SYs + 250, 11, { mood: cl > .85 ? 'happy' : null });
      ctx.restore();
      const sd = Math.floor(now * 24);
      if (lose) { // CRT switch-off: the picture folds into a line, then a dot
        ctx.fillStyle = '#000'; ctx.fillRect(SXs, SYs, SWs, SHs);
        const e = K.ease(ot / .4), lw = SWs * (1 - e * .96), lh = Math.max(3, 8 * (1 - e)); ctx.fillStyle = 'rgba(255,255,255,' + (1 - K.ease((ot - .5) / .4)) + ')'; ctx.fillRect(SXs + SWs / 2 - lw / 2, SYs + SHs / 2 - lh / 2, lw, lh);
      } else {
        const n = Math.round(60 + 1100 * (1 - cl));
        if (cl < .98) for (let i = 0; i < n; i++) {
          const x = SXs + ((K.hr(i * 3 + sd * 7) * (SWs / 10)) | 0) * 10, y = SYs + ((K.hr(i * 5 + sd * 11 + 1) * (SHs / 10)) | 0) * 10, v = (K.hr(i + sd * 17) * 255) | 0;
          ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 10, 10);
        }
        if (cl < .98) { ctx.fillStyle = 'rgba(120,120,120,' + (1 - cl) * .55 + ')'; ctx.fillRect(SXs, SYs, SWs, SHs); const ry = SYs + ((t * 90) % (SHs + 40)) - 20; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(SXs, ry, SWs, 22); }
      }
      ctx.fillStyle = 'rgba(255,255,255,.14)'; K.el(SXs + 90, SYs + 50, 70, 24, -.5); ctx.fill();
      ctx.restore(); K.rr(SXs, SYs, SWs, SHs, 28); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      // dial knob and label
      const kx = SX + d * SW; K.rr(kx - 9, 460, 18, 56, 6); K.ink('#ff4d5e', 3.5); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(kx - 5, 466, 4, 40);
      txt(window.t('FM {n}', { n: (88 + d * 20).toFixed(1) }), 400, 534, 20, INK);
      if (hold > 0 && !g.result) { ctx.fillStyle = '#5CFF7A'; K.rr(SXs + 10, SYs + SHs - 16, (SWs - 20) * Math.min(1, hold / .45), 8, 4); ctx.fill(); }
      if (lose) { K.sweat(372, 54, 1, (ot * 1.4) % 1); }
      vignette(.16);
    }
  };
  return g;
}

/* ── 12 ── HOT FLASH: flick every layer off before the thermometer pops
   Art: a scorching beach. Claude on a towel is wrapped in winter clothes, the sun grins, an ice cream melts. Win: the sun puts on shades and it snows. Lose: the thermometer bursts. */
function dsStrip(sp) {
  const K = DSK, durA = 4.8 / Math.sqrt(sp), X = 330, Y = 520, U = 17;
  const L = [
    { id: 'hat', r: { x: X - 7.5 * U, y: Y - 14 * U, w: 15 * U, h: 6 * U }, acc: 0, on: true },
    { id: 'scarf', r: { x: X - 6 * U, y: Y - 5.6 * U, w: 12 * U, h: 3.2 * U }, acc: 0, on: true },
    { id: 'mitts', r: { x: X - 10.5 * U, y: Y - 8.5 * U, w: 21 * U, h: 5 * U }, acc: 0, on: true, split: true },
    { id: 'boots', r: { x: X - 6 * U, y: Y - 3.2 * U, w: 12 * U, h: 4.2 * U }, acc: 0, on: true }
  ];
  const fly = []; let pr = false, lp = null, clock = 0, left = 4, warned = false, boomed = false, rT0 = -1; const bk = {};
  const rr = (x, y, w, h, col, o = 4) => { K.rr(x, y, w, h, Math.min(w, h) * .3); K.ink(col, o); };
  const drawL = (id, ox, oy) => {
    const x = X + ox, y = Y + oy;
    if (id === 'hat') { rr(x - 6.6 * U, y - 12.4 * U, 13.2 * U, 3.4 * U, '#4DB8FF'); rr(x - 5.4 * U, y - 14 * U, 10.8 * U, 2 * U, '#4DB8FF'); K.dot(x, y - 14.6 * U, 1.5 * U, '#fff', 4); ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 2 * U - 2, y - 12.2 * U, 4, 3 * U); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - 5 * U, y - 13.8 * U, 10 * U, 4); }
    else if (id === 'scarf') { rr(x - 6.4 * U, y - 5.6 * U, 12.8 * U, 2.8 * U, '#ff4d4d'); ctx.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 1.8 * U - 3, y - 5.6 * U, 6, 2.8 * U); rr(x + 3.4 * U, y - 3 * U, 2.4 * U, 3.4 * U, '#ff4d4d'); }
    else if (id === 'mitts') { rr(x - 9.6 * U, y - 7.4 * U, 3.6 * U, 3.6 * U, '#5CFF7A'); rr(x + 6 * U, y - 7.4 * U, 3.6 * U, 3.6 * U, '#5CFF7A'); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x - 9.2 * U, y - 7 * U, 1.2 * U, 4); ctx.fillRect(x + 6.4 * U, y - 7 * U, 1.2 * U, 4); }
    else { rr(x - 5.6 * U, y - 2.8 * U, 4.2 * U, 3.8 * U, '#9a6a3c'); rr(x + 1.4 * U, y - 2.8 * U, 4.2 * U, 3.8 * U, '#9a6a3c'); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 5.2 * U, y - 2.4 * U, 3 * U, 4); ctx.fillRect(x + 1.8 * U, y - 2.4 * U, 3 * U, 4); }
  };
  const beach = c => {
    K.grad(0, 300, ['#ffb35e', '#ffd98a', '#fff0c4']);
    // sea with a foam line, then sand with a towel
    K.grad(296, 352, ['#62d3f0', '#2a8fcb']); c.fillStyle = INK; c.fillRect(-OX, 293, VW, 5);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.lineCap = 'round'; for (let i = 0; i < 9; i++) { const x = K.hr(i) * VW - OX, y = 310 + K.hr(i + 5) * 34; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 14, y - 6, x + 28, y); c.stroke(); }
    K.grad(350, H, ['#f4d998', '#e8c27a']); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-OX, 348, VW, 5);
    c.fillStyle = 'rgba(160,110,50,.25)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(K.hr(i + 60) * VW - OX, 370 + K.hr(i + 70) * 220, 2.5, 0, 7); c.fill(); }
    // palm
    const palm = [[590, 420], [598, 340], [590, 290]]; c.lineCap = 'round'; K.line(palm, 14, '#a5622c', 9);
    for (const a of [-2.6, -2.1, -.9, -.4, -1.5]) { c.save(); c.translate(590, 286); c.rotate(a); K.el(34, 0, 38, 11); K.ink('#3fbf5a', 3.5); c.restore(); }
    K.dot(580, 296, 8, '#8a5a34', 3); K.dot(598, 298, 8, '#8a5a34', 3);
    // towel under Claude
    K.rr(X - 160, 508, 320, 30, 10); K.ink('#ff7a9a', 4.5); c.save(); K.rr(X - 160, 508, 320, 30, 10); c.clip(); c.fillStyle = '#fff'; for (let i = -8; i < 8; i++) c.fillRect(X + i * 40, 508, 20, 30); c.restore(); K.rr(X - 160, 508, 320, 30, 10); c.lineWidth = 9; c.strokeStyle = INK; c.stroke();
  };
  const hit = (p, l) => dsPtIn(p.x, p.y, { x: l.r.x - 12, y: l.r.y - 12, w: l.r.w + 24, h: l.r.h + 24 });
  const strip = l => {
    l.on = false; left--; sfx.whoosh(); sfx.blip(3 * (4 - left)); burst(X, l.r.y + l.r.h / 2, '#fff', 8); floatText('+1', X + (l.r.w / 2), l.r.y, '#4DB8FF', 30);
    fly.push({ id: l.id, x: 0, y: 0, vx: (Math.random() < .5 ? -1 : 1) * dsRnd(300, 600), vy: -dsRnd(300, 500), r: 0 });
    if (!left) { g.result = 'win'; dsWin(X, 300, 36); }
  };
  const g = {
    wide: true, cmd: 'STRIP!', hint: 'FLICK EVERY LAYER OFF THE CLAUDE', thint: 'SWIPE EVERY LAYER OFF', dur: 4.8,
    down(p) { if (g.result) return; pr = true; lp = { x: p.x, y: p.y }; },
    move(p) {
      if (!pr || g.result) return;
      const d = Math.hypot(p.x - lp.x, p.y - lp.y);
      for (const l of L) if (l.on && hit(p, l)) { l.acc += d; if (l.acc > 55) strip(l); }
      lp = { x: p.x, y: p.y };
    },
    up() { pr = false; },
    update(dt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (!g.result) { clock += dt; if (clock / durA > .7 && !warned) { warned = true; sfx.buzz(); } if (clock >= durA && !boomed) { boomed = true; sfx.stamp(); shake(14, .4); } }
      for (const f of fly) { f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vx * dt / 80; }
    },
    draw(t) {
      K.use(ctx); if (g.result && rT0 < 0) rT0 = now;
      const ot = g.result ? now - rT0 : 0, lose = g.result === 'lose', cool = g.result === 'win', heat = lose ? 1 : Math.min(1, clock / durA);
      K.bake(bk, beach);
      if (heat > .7 && !cool) { ctx.fillStyle = 'rgba(255,90,40,' + (heat - .7) * .35 + ')'; ctx.fillRect(-OX, 0, VW, H); }
      K.sun(150, 160, 38, t, cool ? 'shades' : 'grin');
      if (!cool) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = 440 + i * 50, ph = (t * .6 + i * .25) % 1; ctx.beginPath(); ctx.moveTo(x, 280 - ph * 40); ctx.quadraticCurveTo(x + 8, 270 - ph * 40, x, 260 - ph * 40); ctx.stroke(); } }
      // the melting ice cream
      const ix = 110, iy = 500, melt = cool ? 0 : heat;
      const cone = K.polyP([[ix - 18, iy - 50], [ix + 18, iy - 50], [ix, iy + 10]]); K.cel(cone, '#f2b878', '#c98443', 5, 0, 4);
      ctx.save(); ctx.translate(ix, iy - 50); ctx.scale(1, 1 - melt * .25); K.dot(0, -2, 22, '#ff9ac4', 4); K.dot(0, -26, 17, '#fff3c4', 4); ctx.restore();
      for (let i = 0; i < 3; i++) { const dl = (8 + melt * 34) * (.6 + .4 * Math.sin(i * 2)); K.rr(ix - 14 + i * 14, iy - 52, 8, dl, 4); K.ink('#ff9ac4', 3); }
      if (cool) { star(ix, iy - 86, 12, 5, 6, t, '#fff', 2.5); }
      // Claude on the towel, wrapped in layers
      const sweatN = Math.floor(1 + heat * 4);
      K.hero(X, Y, U, { col: heat > .55 && !cool ? '#e8452f' : OR, mood: cool ? 'happy' : null, la: cool ? -.5 : -2.7, ra: cool ? .5 : 2.7 });
      for (const l of L) if (l.on) drawL(l.id, 0, 0);
      for (const f of fly) { ctx.save(); ctx.translate(X + f.x, Y + f.y); ctx.rotate(f.r); ctx.translate(-X, -Y); drawL(f.id, 0, 0); ctx.restore(); }
      if (!cool) for (let i = 0; i < sweatN; i++) { const ph = (t * 1.4 + i * .37) % 1; K.sweat(X + (i % 2 ? 1 : -1) * (30 + i * 12), Y - 9 * U + ph * 50, 1.5, ph); }
      if (cool) for (let i = 0; i < 18; i++) { const x = K.hr(i + 80) * VW - OX, y = ((K.hr(i + 90) * 600 + (ot + t) * 70) % 600); star(x, y, 7 + K.hr(i) * 5, 3, 6, t + i, '#fff', 2); }
      if (cool) for (let i = 0; i < 4; i++) star(150 + i * 140 + Math.sin(t * 3 + i) * 10, 150 + (i % 2) * 40, 18, 8, 6, t, '#fff', 3);
      // thermometer: a glass tube with a bulb
      const hh = 280 * (cool ? .1 : heat);
      K.rr(690, 130, 34, 300, 17); K.ink('#fff', 5); K.dot(707, 455, 30, '#fff', 5);
      ctx.save(); K.rr(697, 137, 20, 288, 10); ctx.clip(); ctx.fillStyle = '#ff4d4d'; ctx.fillRect(697, 428 - hh, 20, hh + 8); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(700, 428 - hh, 4, hh); ctx.restore();
      K.dot(707, 455, 22, '#ff4d4d', 0); ctx.fillStyle = 'rgba(255,255,255,.55)'; K.el(699, 447, 6, 4, -.5); ctx.fill();
      ctx.fillStyle = INK; for (let i = 0; i < 6; i++) ctx.fillRect(728, 140 + i * 48, 14, 4);
      if (heat >= .999 && !cool) { dsBoom(707, 165, 46, t); for (let i = 0; i < 8; i++) { const a = K.hr(i) * 4.2 - .5, v = 100 + K.hr(i + 4) * 120, p2 = Math.min(1, ot / .7); ctx.save(); ctx.translate(707 + Math.cos(a) * v * p2, 165 + Math.sin(a) * v * p2 + 300 * p2 * p2); ctx.rotate(i + ot * 8); K.rr(-5, -3, 10, 6, 2); K.ink('#cfeeff', 1.5); ctx.restore(); } }
      vignette(.16);
    }
  };
  return g;
}

reg('ds_ramp', dsRamp, 'RAMP IT UP');
reg('ds_creep', dsCreep, 'MIDNIGHT WEIRDO');
reg('ds_fuse', dsFuse, 'SHORT FUSE');
reg('ds_loop', dsLoop, 'IN THE LOOP');
reg('ds_cage', dsCage, 'CAGE MATCH');
reg('ds_fan', dsFan, 'TOUCHDOWN');
reg('ds_pose', dsPose, 'DEAD SIMON SAYS');
reg('ds_sink', dsSink, 'SINKING FEELING');
reg('ds_scratch', dsScratch, 'SCRATCH AND MATCH');
reg('ds_faces', dsFaces, 'STRAIGHT FACES');
reg('ds_tune', dsTune, 'CATCH A TUNE');
reg('ds_strip', dsStrip, 'HOT FLASH');
