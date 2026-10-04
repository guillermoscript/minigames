'use strict';
/* Wave 2 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* ───────────── DUO-look drawing kit for this file (docs/ART-STYLE.md). Everything draws on the kit's X,
   which use(c) points at the live ctx or at an offscreen layer (so the same code bakes and draws live). ───────────── */
const W2K = (() => {
  const TAU = Math.PI * 2, K = { TAU };
  let X = null;
  K.use = c => { X = c; };
  K.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  K.outBack = k => { k = K.clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
  K.rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  K.rrP = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  K.elP = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; };
  K.el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); };
  K.ink = (fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  K.inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  /* cel shading: the base is a copy shifted by (-sx, -sy), so the shade shows as a crescent on the (sx, sy) side */
  K.cel = (p, base, shade, sx, sy, o = 4) => { K.inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  K.glint = (p, x, y, rx, ry, col = 'rgba(255,255,255,.55)', rot = -.5) => { X.save(); X.clip(p); X.fillStyle = col; K.el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  K.line = (pts, w, col) => { X.lineJoin = 'round'; X.lineCap = 'round'; X.beginPath(); pts.forEach(q => X.lineTo(q[0], q[1])); X.strokeStyle = INK; X.lineWidth = w + 6; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); };
  K.layer = fn => { const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; K.use(c.getContext('2d')); X.translate(OX, 0); fn(X); K.use(old); return c; };
  /* a chunky control slab with depth (hippo plate()): returns how far the face is lifted */
  K.plate = (x, y, w, h, col, dk, down, r = 18) => {
    const d = down ? 3 : 9;
    K.rr(x, y + 9, w, h, r); K.ink(dk, 4);
    K.rr(x, y + 9 - d, w, h, r); K.ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; K.rr(x + 8, y + 13 - d, w - 16, 10, 5); X.fill();
    K.rr(x, y + 9 - d, w, h, r); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    return 9 - d;
  };
  K.keyCap = (x, y, s) => { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(s).width + 14); K.rr(x - w / 2, y - 12, w, 24, 6); K.ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); };
  /* thin blocky arms out of claude()'s side stubs (origin = Claude's feet); angles 0 = straight up */
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
  K.heart = (x, y, s, a = 1) => {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    K.ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; K.el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  };
  K.sweat = (x, y, s, k) => {                 // a drop that slides down and fades (k = 0..1 loop)
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
  K.bird = (bx, by, f) => { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(bx - 9, by - f); X.quadraticCurveTo(bx - 4, by - 6, bx, by); X.quadraticCurveTo(bx + 4, by - 6, bx + 9, by - f); X.stroke(); };
  /* a cartoon eye (crane eye()): look = unit-ish vector toward the action; moods: happy, dead, panic, sleepy */
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
    if (mood === 'sleepy') { X.save(); K.el(x, y, rx, ry); X.clip(); X.fillStyle = '#ffb347'; X.fillRect(x - rx, y - ry, rx * 2, ry * .9); X.restore(); }
  };
  return K;
})();

/* 7 ── STOP art. Scene: a ski-lift in the Alps. Claude rides a red gondola (the plumb rope under it is the needle) and must stop
   over the green landing mat. Win: the gondola docks, the penguin station master jumps, the snowman cheers. Fail: the hanger
   snaps and the gondola drops onto the platform in a cloud of snow. */
const W2STOP = (() => {
  const K = W2K, TAU = K.TAU, CY = 118, PT = 312;
  let SKY = null, MTN = null, FRONT = null, KW = -1;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function pine(X, x, y, s) {
    X.beginPath(); X.rect(x - 3 * s, y - 10 * s, 6 * s, 12 * s); K.ink('#8a5a34', 2.5);
    for (let i = 0; i < 3; i++) {
      const w = (24 - i * 5) * s, yb = y - (6 + i * 15) * s, h = 24 * s;
      X.beginPath(); X.moveTo(x - w, yb); X.lineTo(x, yb - h); X.lineTo(x + w, yb); X.closePath(); K.ink(i % 2 ? '#3fb260' : '#2f9a55', 3);
      X.beginPath(); X.moveTo(x - w * .5, yb - h * .55); X.lineTo(x, yb - h); X.lineTo(x + w * .5, yb - h * .55); X.quadraticCurveTo(x, yb - h * .4, x - w * .5, yb - h * .55); X.fillStyle = '#fff'; X.fill();
    }
  }
  function ridge(X, base, hmin, hvar, step, seed, fill, line) {
    const p = new Path2D(), pk = [];
    p.moveTo(-OX - 80, base + 20);
    for (let i = 0, x = -OX - 60; x < W + OX + 120; i++, x += step) {
      const tx = x + (hash(i + seed) - .5) * step * .4, ty = base - hmin - hash(i * 3 + seed) * hvar;
      p.lineTo(tx, ty); pk.push([tx, ty]);
      p.lineTo(tx + step / 2, base - 8 - hash(i * 5 + seed) * 22);
    }
    p.lineTo(W + OX + 140, base + 20); p.closePath();
    X.lineJoin = 'round'; X.fillStyle = fill; X.fill(p); X.lineWidth = 3; X.strokeStyle = line; X.stroke(p);
    X.save(); X.clip(p); X.fillStyle = '#f6f8ff';
    for (const [tx, ty] of pk) {
      X.beginPath(); X.moveTo(tx - 160, ty - 6); X.lineTo(tx + 160, ty - 6); X.lineTo(tx + 160, ty + 26);
      for (let k = 6; k >= -6; k--) X.lineTo(tx + k * 26, ty + 26 + (k % 2 ? 11 : 0)); X.closePath(); X.fill();
    }
    X.restore();
  }
  function build() {
    KW = VW;
    SKY = K.layer(X => {
      const g = X.createLinearGradient(0, 0, 0, 310); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff');
      X.fillStyle = g; X.fillRect(-OX, 0, VW, H);
    });
    MTN = K.layer(X => {
      ridge(X, 250, 70, 62, 170, 1, '#c9d0fb', '#7b80c6');
      ridge(X, 288, 38, 38, 130, 7, '#a4b1f2', '#5b5fa8');
      // snowy hill + a row of pines standing on the horizon
      X.beginPath(); X.moveTo(-OX - 10, 300); for (let x = -OX - 10; x <= W + OX + 10; x += 40) X.lineTo(x, 288 + Math.sin(x * .013) * 8 + Math.sin(x * .04) * 3); X.lineTo(W + OX + 10, 302); X.lineTo(-OX - 10, 302); X.closePath();
      X.fillStyle = '#eaf6ff'; X.fill(); X.strokeStyle = '#8fb7d6'; X.lineWidth = 3; X.stroke();
      for (let i = 0, x = -OX + 20; x < W + OX; i++, x += 70 + hash(i) * 70) pine(X, x, 301 - hash(i + 4) * 4, .8 + hash(i + 9) * .45);
    });
    FRONT = K.layer(X => {
      const g = X.createLinearGradient(0, 300, 0, 600); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfe6f7');
      X.fillStyle = g; X.fillRect(-OX, 300, VW, 300);
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-OX, 300); X.lineTo(W + OX, 300); X.stroke();
      X.fillStyle = 'rgba(143,183,214,.28)'; for (let i = 0; i < 9; i++) { X.beginPath(); X.ellipse(-OX + hash(i) * VW, 400 + hash(i + 3) * 170, 50 + hash(i + 6) * 50, 7, 0, 0, TAU); X.fill(); }
      // ski tracks
      X.strokeStyle = 'rgba(143,183,214,.7)'; X.lineWidth = 3; X.lineCap = 'round';
      for (const d of [0, 11]) { X.beginPath(); X.moveTo(380 + d, 600); X.bezierCurveTo(360 + d, 520, 470 + d, 480, 420 + d, 400); X.stroke(); }
      // pylons and the cable
      for (const px of [14, 786]) {
        K.rr(px - 10, 112, 20, 196, 4); K.ink('#8f9cb3', 3.5);
        X.strokeStyle = '#c9ced6'; X.lineWidth = 3; X.beginPath(); X.moveTo(px - 8, 130); X.lineTo(px + 8, 180); X.lineTo(px - 8, 230); X.lineTo(px + 8, 280); X.stroke();
        K.rr(px - 28, 106, 56, 14, 6); K.ink('#c9ced6', 3.5);
      }
      K.line([[-OX - 10, CY], [W + OX + 10, CY]], 5, '#5a5274');
      // the boarding platform: planks with depth, posts under it
      for (const px of [96, 400, 704]) { K.rr(px - 12, 366, 24, 40, 4); K.ink('#a5622c', 3.5); }
      const pl = K.rrP(50, PT, 700, 62, 10); K.cel(pl, '#e9a35c', '#a5622c', 0, 8, 4);
      X.save(); X.clip(pl); X.strokeStyle = '#b06d33'; X.lineWidth = 2.5; for (let x = 90; x < 750; x += 50) { X.beginPath(); X.moveTo(x, PT + 4); X.lineTo(x, PT + 54); X.stroke(); }
      X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(54, PT + 4, 692, 6); X.restore();
      // snow drifts piled against the platform front
      for (const [x, y, r] of [[60, 380, 44], [250, 384, 52], [470, 382, 46], [650, 386, 56], [770, 380, 40]]) {
        const d = new Path2D(); d.ellipse(x, y, r, r * .36, 0, 0, TAU); K.cel(d, '#fff', '#cfe6f7', 3, 5, 3);
      }
      // the snowman (face is live): three balls, a top hat, a scarf, twig arms
      for (const [sx, sy] of [[-1, 22], [1, 22]]) K.line([[690 + sx * 20, 448], [690 + sx * 46, 438 - sy * .4]], 3.5, '#8a5a34');
      for (const [r, y] of [[30, 490], [22, 450], [16, 418]]) { const p = new Path2D(); p.arc(690, y, r, 0, TAU); K.cel(p, '#fff', '#cfe6f7', 4, 5, 4); }
      K.rr(670, 394, 40, 6, 3); K.ink('#14101c', 3); K.rr(676, 372, 28, 26, 4); K.ink('#3b3550', 3); X.fillStyle = '#ff5c6c'; X.fillRect(678, 386, 24, 5);
      K.rr(674, 430, 32, 10, 5); K.ink('#ff5c6c', 3); K.rr(698, 434, 9, 22, 4); K.ink('#d93a4a', 3);
      X.fillStyle = INK; for (const y of [452, 468, 484]) { X.beginPath(); X.arc(690, y, 3, 0, TAU); X.fill(); }
    });
  }
  /* the gondola, drawn with its hanger at local (0,0); window and Claude inside */
  function cabin(mood, la, ra, sw, T) {
    X2.save(); X2.scale(1.25, 1.25);
    K.rr(-52, 26, 104, 16, 8); K.ink('#d93a4a', 4);
    const hull = K.rrP(-46, 36, 92, 66, 14); K.cel(hull, '#ff5c6c', '#c9344a', 3, 5, 4); K.glint(hull, -28, 48, 16, 3.5, 'rgba(255,255,255,.55)', -.1);
    K.rr(-38, 44, 76, 46, 10); K.ink('#dff4ff', 3);
    K.rr(-38, 44, 76, 46, 10); X2.fillStyle = 'rgba(191,233,255,.25)'; X2.fill(); X2.lineWidth = 6; X2.strokeStyle = INK; X2.stroke();
    X2.save(); K.rr(-38, 44, 76, 46, 10); X2.clip(); X2.fillStyle = 'rgba(255,255,255,.4)'; X2.beginPath(); X2.moveTo(-28, 44); X2.lineTo(-14, 44); X2.lineTo(-30, 90); X2.lineTo(-44, 90); X2.fill(); X2.restore();
    // open-top cabin: Claude's head and eyes rise over the window frame so his face reads
    const u = 5, cx = 0, cyf = 94;
    X2.save(); X2.translate(cx, cyf); K.arms(u, la, ra); X2.restore(); claude(cx, cyf, u, { mood });
    // beanie with a pom-pom (it sits above the eyes)
    const y0 = cyf - 9 * u; K.rr(cx - 5.2 * u, y0 - 1.8 * u, 10.4 * u, 2.6 * u, u * .8); K.ink('#4DB8FF', 2.4);
    X2.beginPath(); X2.arc(cx, y0 - 2.4 * u, 1.2 * u, 0, TAU); K.ink('#fff', 2.2);
    if (mood !== 'happy') { X2.fillStyle = 'rgba(255,110,165,.5)'; for (const sx of [-1, 1]) { X2.beginPath(); X2.ellipse(cx + sx * 4.9 * u, cyf - 4 * u, .9 * u, .55 * u, 0, 0, TAU); X2.fill(); } }
    if (sw > 0) K.sweat(cx + 5.6 * u, y0 + 1.5 * u, .9, (T * 1.4) % 1);
    K.rr(-48, 94, 96, 12, 5); K.ink('#8f9cb3', 3.5);
    X2.restore();
  }
  let X2 = null;
  function penguin(x, y, s, mood, lx, ly, flip, T, covers) {
    X2.save(); X2.translate(x, y); X2.scale(s, s);
    for (const sx of [-1, 1]) { K.el(sx * 8, -2, 8, 4); K.ink('#ffa63d', 2.5); }
    const body = new Path2D(); body.ellipse(0, -26, 18, 27, 0, 0, TAU); K.cel(body, '#2c3e66', '#1b2747', 4, 3, 3.2);
    X2.fillStyle = '#fff'; K.el(1, -22, 11.5, 19); X2.fill(); X2.fillStyle = 'rgba(143,183,214,.35)'; K.el(5, -20, 5, 15); X2.fill();
    // flippers
    const up = mood === 'happy' ? .9 + Math.sin(T * 12) * .25 : covers ? 2.2 : .15;
    for (const sx of [-1, 1]) { X2.save(); X2.translate(sx * 17, -34); X2.rotate(-sx * up); K.el(sx * 2, 12, 5, 14); K.ink('#2c3e66', 2.5); X2.restore(); }
    // conductor cap
    K.rr(-13, -60, 26, 11, 4); K.ink('#ff5c6c', 2.8); K.el(0, -49, 17, 3.5); K.ink('#d93a4a', 2.2); X2.fillStyle = '#ffe14d'; X2.beginPath(); X2.arc(0, -55, 2.6, 0, TAU); X2.fill();
    // beak + eyes
    X2.beginPath(); X2.moveTo(-5, -34); X2.quadraticCurveTo(0, -27, 5, -34); X2.quadraticCurveTo(0, -38, -5, -34); K.ink('#ffa63d', 2.2);
    if (!covers) { K.eye(-7, -41, 5.2, mood, lx, ly, 1.3); K.eye(7, -41, 5.2, mood, lx, ly, 2.1); }
    X2.restore();
  }
  function draw(S, T, rt) {
    K.use(ctx); X2 = ctx;
    if (!SKY || KW !== VW) build();
    const won = S.result === 'win', lost = S.result === 'lose', res = !!S.result, p = S.p;
    ctx.drawImage(SKY, -OX, 0);
    // sun: turning rays + disc
    ctx.save(); ctx.translate(630, 126); ctx.rotate(T * .25); ctx.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(0, -66); ctx.lineTo(8, -40); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(630, 126, 32, 0, TAU); K.ink('#ffe14d', 4); ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(621, 117, 11, 0, TAU); ctx.fill();
    for (const [o, y, s, v] of [[0, 150, 1, 8], [420, 190, .8, 6], [760, 128, 1.1, 10]]) K.cloud(((T * v + o) % 1000) - 140, y, s);
    ctx.drawImage(MTN, -OX, 0);
    // background gag: a far gondola ping-pongs on a thin cable with a polar bear waving
    ctx.strokeStyle = '#5b5fa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-OX, 86); ctx.lineTo(W + OX, 86); ctx.stroke();
    const fw = (T * .055) % 2, fx = 210 + 410 * (fw < 1 ? fw : 2 - fw);
    ctx.save(); ctx.translate(fx, 86); ctx.rotate(Math.sin(T * 1.7) * .05); ctx.scale(.55, .55);
    K.line([[0, 0], [0, 34]], 4, '#8492e2'); K.rr(-34, 30, 68, 50, 12); K.ink('#7dd3a8', 4);
    K.rr(-26, 38, 52, 30, 8); K.ink('#dff4ff', 3);
    ctx.beginPath(); ctx.arc(0, 62, 15, Math.PI, TAU); K.ink('#fff', 3); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 11, 46, 5, 0, TAU); K.ink('#fff', 2.5); }
    ctx.beginPath(); ctx.arc(0, 56, 14, 0, TAU); K.ink('#fff', 3); ctx.fillStyle = INK; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 5, 54, 2, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.arc(0, 60, 2.6, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(18, 56); ctx.rotate(-1 + Math.sin(T * 7) * .4); K.rr(-3, -16, 6, 16, 3); K.ink('#fff', 2.5); ctx.restore();
    ctx.restore();
    ctx.drawImage(FRONT, -OX, 0);
    // falling snow
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 26; i++) { const sx = (hash(i) * 900 + Math.sin(T + i) * 14 - 50) % 900 - 50, sy = (T * (28 + hash(i + 2) * 22) + hash(i + 5) * 620) % 620; ctx.beginPath(); ctx.arc(sx, sy - 10, 1.5 + hash(i + 8) * 1.8, 0, TAU); ctx.fill(); }
    // the landing mat
    const zx = S.zx, zw = S.zw, pulse = won ? .5 + .5 * Math.sin(T * 12) : 0;
    ctx.save(); ctx.fillStyle = 'rgba(20,16,28,.2)'; K.rr(zx + 3, 326, zw, 44, 8); ctx.fill(); ctx.restore();
    const mat = K.rrP(zx, 320, zw, 44, 8); K.cel(mat, won ? '#8dffa3' : '#5CFF7A', '#23a046', 0, 6, 3.5);
    ctx.save(); ctx.clip(mat); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([9, 8]); K.rr(zx + 6, 326, zw - 12, 32, 5); ctx.stroke(); ctx.restore();
    txt('GO', zx + zw / 2, 341, 26, '#fff');
    if (won) { ctx.save(); ctx.globalAlpha = .35 + .5 * pulse; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; K.rr(zx - 3, 317, zw + 6, 50, 11); ctx.stroke(); ctx.restore(); }
    // mat flags
    for (const fx2 of [zx + 6, zx + zw - 6]) { K.line([[fx2, 322], [fx2, 292]], 3, '#c9ced6'); ctx.beginPath(); ctx.moveTo(fx2, 292); ctx.lineTo(fx2 + 18 + Math.sin(T * 5 + fx2) * 3, 298); ctx.lineTo(fx2, 306); ctx.closePath(); K.ink('#5CFF7A', 2.5); }
    // snowman face reacts: watches the gondola, cheers, or gapes
    const sl = Math.max(-1, Math.min(1, (p - 690) / 300));
    K.eye(683, 416, 3.6, won ? 'happy' : lost ? 'panic' : null, sl, -.7, 3); K.eye(697, 416, 3.6, won ? 'happy' : lost ? 'panic' : null, sl, -.7, 4);
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(688, 421); ctx.lineTo(704 + sl * 4, 424); ctx.lineTo(688, 427); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    // penguin station master
    const pj = won ? Math.abs(Math.sin(T * 9)) * 16 : 0;
    ctx.fillStyle = 'rgba(20,16,28,.2)'; ctx.beginPath(); ctx.ellipse(110, 457, 30 - pj * .4, 7, 0, 0, TAU); ctx.fill();
    penguin(110, 455 - pj, 1.45, won ? 'happy' : lost ? 'panic' : (T > 3.5 ? 'panic' : null), (p - 110) / 200, -1, 0, T, lost);
    if (lost) K.sweat(150, 380, 1.2, (T * 1.8) % 1);
    // ── the gondola ──
    const dir = S.dir;
    let dy = 0, rot = S.lean, snapped = false;
    if (won) { dy = 56 * K.outBack(rt / .4); rot = 0; }
    if (lost) {
      if (rt < .18) rot = Math.sin(rt * 46) * .07; else { snapped = true; const q = rt - .18; dy = Math.min(70, .5 * 2800 * q * q); rot = -dir * .22 * K.clamp(q / .22, 0, 1); if (dy >= 70) dy = 70 - Math.abs(Math.sin((rt - .4) * 15)) * 10 * Math.exp(-(rt - .4) * 5); }
    }
    // plumb rope (the needle) hangs from the gondola to the mat
    const by = CY + 128 + (snapped ? 0 : dy);
    if (!snapped || by < 326) {
      const ry = snapped ? CY + 128 + dy : by;
      K.line([[p, ry], [p, 334]], 3, '#ffd23f');
      ctx.beginPath(); ctx.moveTo(p, 352); ctx.quadraticCurveTo(p + 9, 338, p, 330); ctx.quadraticCurveTo(p - 9, 338, p, 352); K.ink('#ffd23f', 3);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(p - 3, 340, 2, 4, 0, 0, TAU); ctx.fill();
    }
    ctx.save(); ctx.translate(p, CY);
    const la = won ? -.5 + Math.sin(T * 14) * .3 : lost ? -.3 + Math.sin(T * 30) * .12 : -.18, ra = won ? .5 - Math.sin(T * 14) * .3 : lost ? .3 - Math.sin(T * 30) * .12 : .18;
    const mood = won ? 'happy' : lost ? 'sad' : null, sw = (!res && (T > 3.3 || S.near)) || lost;
    if (!snapped) {
      ctx.rotate(rot);
      K.line([[0, 4], [0, 37 + dy]], 5, '#5a5274');
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); K.ink('#c9ced6', 3.2); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      ctx.translate(0, dy); if (won) { const gs = 1 + .12 * K.outBack(K.clamp(rt / .4, 0, 1)); ctx.scale(gs, gs); } cabin(mood, la, ra, sw, T);
    } else {
      // snapped hanger: a frayed stub on the pulley, the gondola falls and tilts on its bottom edge
      K.line([[0, 4], [3, 16]], 5, '#5a5274'); ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); K.ink('#c9ced6', 3.2);
      const q = rt - .18; if (q < .3) star(0, 14, 15 - q * 20, 6, 7, T * 6, '#FFE14D', 3);
      ctx.translate(0, dy); ctx.translate(0, 100); ctx.rotate(rot); ctx.translate(0, -100); cabin(mood, la, ra, sw, T);
    }
    ctx.restore();
    // snow cloud when it lands
    if (lost && rt > .4) {
      const d = rt - .4;
      for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI, rr2 = 10 + d * 70 + i % 3 * 6; ctx.globalAlpha = Math.max(0, .9 - d * 1.6); ctx.beginPath(); ctx.arc(p + Math.cos(a) * (30 + d * 130), PT - 2 + Math.sin(a) * (14 + d * 50), rr2 * .55, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8fb7d6'; ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) star(p - 36 + i * 36, 236 + Math.sin(T * 5 + i) * 5, 9, 4, 5, T * 3 + i, '#FFE14D', 2.5);
    }
    // win: docking sparkle
    if (won && rt < .8) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + T * 2, rr2 = 70 + rt * 80; star(p + Math.cos(a) * rr2, CY + 110 + dy + Math.sin(a) * rr2 * .5, 8, 3.5, 4, T * 4, '#FFE14D', 2.2); }
    vignette(.16);
  }
  return { draw };
})();
function gStop(sp) {
  const zw = 150 / Math.sqrt(sp), zx = 150 + Math.random() * (500 - zw);
  let ph = Math.random() * 2, stopped = false, lq = Math.floor(ph), lean = 0, resAt = null;
  const pos = () => 100 + 600 * Math.abs(((ph % 2) + 2) % 2 - 1);
  const dirOf = () => (((ph % 2) + 2) % 2) < 1 ? -1 : 1;
  const g = {
    cmd: 'STOP!', hint: 'STOP IN THE GREEN', thint: 'TAP TO STOP', dur: 5, wide: true,
    stop() {
      if (stopped) return; stopped = true;
      const p = pos(); g.result = p >= zx && p <= zx + zw ? 'win' : 'lose'; resAt = now;
      if (g.result === 'win') { sfx.stamp(); sfx.coin(); burst(p, 342, '#5CFF7A', 14); ring(p, 342, '#fff', 90); floatText('PERFECT!', p, 270, '#FFE14D', 36); } else { sfx.buzz(); shake(8, .25); burst(p, 342, '#FF4D4D', 10); }
    },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') g.stop(); },
    down() { g.stop(); },
    update(dt) { if (g.result && resAt == null) resAt = now; if (!stopped) { ph += dt * .9 * sp; const q = Math.floor(ph); if (q !== lq) { lq = q; sfx.tick(); } } lean += ((stopped ? 0 : dirOf() * .08) - lean) * Math.min(1, dt * 5); },
    draw(t) {
      if (g.result && resAt == null) resAt = now;
      const p = pos();
      W2STOP.draw({ p, zx, zw, dir: dirOf(), lean, result: g.result, near: p >= zx - 40 && p <= zx + zw + 40 && !g.result && t > 2 }, t, resAt == null ? 0 : Math.max(0, now - resAt));
    }
  };
  return g;
}

/* 8 ── DON'T art. Scene: the control room of the Totally Safe Rocket Company. A grinning red button on a hazard pedestal begs to
   be pressed; Claude (hard hat, sweating) sits on his hands while they creep toward it. A worried rocket watches from the
   window. Win: Claude gets a medal, the button sulks, the rocket dozes. Fail: slam, siren, and the rocket blasts off. */
const W2DONT = (() => {
  const K = W2K, TAU = K.TAU, WIN = [40, 96, 210, 166], FEET = 380;
  let WALL = null, CON = null, KW = -1;
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function build() {
    KW = VW;
    WALL = K.layer(X => {
      const g = X.createLinearGradient(0, 0, 0, 350); g.addColorStop(0, '#8fd0da'); g.addColorStop(1, '#d7f5f2');
      X.fillStyle = g; X.fillRect(-OX, 0, VW, H);
      // riveted wall panels
      X.strokeStyle = 'rgba(60,140,160,.35)'; X.lineWidth = 3;
      for (let x = -OX - ((OX | 0) % 100); x < W + OX; x += 100) { X.beginPath(); X.moveTo(x, 50); X.lineTo(x, 352); X.stroke(); }
      X.beginPath(); X.moveTo(-OX, 200); X.lineTo(W + OX, 200); X.stroke();
      X.fillStyle = 'rgba(60,140,160,.5)'; for (let x = -OX - ((OX | 0) % 100); x < W + OX; x += 100) for (const y of [62, 188, 212, 336]) { X.beginPath(); X.arc(x + 8, y, 2.6, 0, TAU); X.fill(); X.beginPath(); X.arc(x + 92, y, 2.6, 0, TAU); X.fill(); }
      // ceiling beam with a hazard line
      X.fillStyle = '#5b6a92'; X.fillRect(-OX, 0, VW, 50); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(-OX, 4, VW, 6);
      X.save(); X.beginPath(); X.rect(-OX, 50, VW, 10); X.clip(); X.fillStyle = '#ffd23f'; X.fillRect(-OX, 50, VW, 10); X.fillStyle = INK; for (let x = -OX - 20; x < W + OX; x += 28) { X.beginPath(); X.moveTo(x, 60); X.lineTo(x + 10, 50); X.lineTo(x + 24, 50); X.lineTo(x + 14, 60); X.fill(); } X.restore();
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-OX, 50); X.lineTo(W + OX, 50); X.moveTo(-OX, 60); X.lineTo(W + OX, 60); X.stroke();
      // leaky pipe along the wall with a red valve over the drip
      K.rr(360, 66, 600, 16, 7); K.ink('#9fb0c9', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(366, 70, 590, 4);
      K.rr(458, 62, 24, 24, 5); K.ink('#7a8bad', 3.5); X.beginPath(); X.arc(470, 84, 5, 0, TAU); K.ink('#6ea8d8', 2);
      for (const x of [420, 560, 700]) { K.rr(x - 6, 62, 12, 24, 3); K.ink('#7a8bad', 3); }
      // the window: a launch pad outside (static); the rocket is live
      const w = K.rrP(WIN[0], WIN[1], WIN[2], WIN[3], 16);
      X.save(); X.clip(w);
      const sg = X.createLinearGradient(0, WIN[1], 0, WIN[1] + WIN[3]); sg.addColorStop(0, '#5cc4f2'); sg.addColorStop(1, '#e6fbff'); X.fillStyle = sg; X.fillRect(WIN[0], WIN[1], WIN[2], WIN[3]);
      X.beginPath(); X.moveTo(40, 240); X.quadraticCurveTo(100, 196, 160, 232); X.quadraticCurveTo(210, 206, 250, 236); X.lineTo(250, 262); X.lineTo(40, 262); X.fillStyle = '#9be38a'; X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
      X.fillStyle = '#7cd46f'; X.fillRect(40, 250, 210, 12);
      X.restore();
      // launch gantry tower beside the pad
      K.rr(212, 150, 14, 102, 3); K.ink('#c9ced6', 3); X.strokeStyle = '#8f9cb3'; X.lineWidth = 2.5; X.beginPath(); for (let y = 160; y < 240; y += 20) { X.moveTo(213, y); X.lineTo(225, y + 20); } X.stroke();
      K.rr(180, 150, 36, 8, 3); K.ink('#ff5c6c', 3);
    });
    CON = K.layer(X => {
      // window frame goes over the rocket
      X.lineJoin = 'round'; const w = K.rrP(WIN[0] - 5, WIN[1] - 5, WIN[2] + 10, WIN[3] + 10, 18);
      X.lineWidth = 22; X.strokeStyle = INK; X.stroke(w); X.lineWidth = 12; X.strokeStyle = '#8f9cb3'; X.stroke(w); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.45)'; X.stroke(K.rrP(WIN[0] - 9, WIN[1] - 9, WIN[2] + 18, WIN[3] + 18, 20));
      X.fillStyle = INK; for (const [x, y] of [[36, 92], [254, 92], [36, 262], [254, 262]]) { X.beginPath(); X.arc(x, y, 3, 0, TAU); X.fill(); }
      // console: a lip, the steel face, a hazard band, dials and switches
      const face = K.rrP(-OX - 16, 380, VW + 32, 320, 14);
      X.fillStyle = 'rgba(20,16,28,.3)'; X.save(); X.translate(0, -5); X.fill(face); X.restore();
      K.cel(face, '#cfd8e6', '#8f9cb3', 0, 10, 4.5);
      X.save(); X.clip(face); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(-OX, 384, VW, 10); X.restore();
      X.save(); X.beginPath(); X.rect(-OX - 10, 496, VW + 20, 30); X.clip(); X.fillStyle = '#ffd23f'; X.fillRect(-OX - 10, 496, VW + 20, 30); X.fillStyle = INK;
      for (let x = -OX - 40; x < W + OX + 20; x += 38) { X.beginPath(); X.moveTo(x, 526); X.lineTo(x + 14, 496); X.lineTo(x + 32, 496); X.lineTo(x + 18, 526); X.fill(); } X.restore();
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-OX, 496); X.lineTo(W + OX, 496); X.moveTo(-OX, 526); X.lineTo(W + OX, 526); X.stroke();
      X.fillStyle = '#5a6a8a'; for (let x = -OX + 14; x < W + OX; x += 60) for (const y of [396, 548]) { X.beginPath(); X.arc(x, y, 3, 0, TAU); X.fill(); }
      // dials (left) and toggle switches (right)
      for (const [x, y] of [[70, 448], [150, 448]]) { X.beginPath(); X.arc(x, y, 28, 0, TAU); K.ink('#fff', 4); X.strokeStyle = '#ff4d5e'; X.lineWidth = 4; X.beginPath(); X.arc(x, y, 20, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 14, y - 12); X.stroke(); }
      for (const x of [590, 650, 710]) { K.rr(x - 14, 428, 28, 52, 8); K.ink('#5a6a8a', 3.5); X.beginPath(); X.arc(x, 442, 12, 0, TAU); K.ink('#ff4d5e', 3); }
      // pedestal under the button
      const ped = new Path2D(); ped.ellipse(400, 452, 172, 30, 0, 0, TAU); K.cel(ped, '#ffd23f', '#c99512', 0, 7, 4.5);
      X.save(); X.clip(ped); X.fillStyle = INK; for (let x = 220; x < 590; x += 34) { X.beginPath(); X.moveTo(x, 478); X.lineTo(x + 14, 428); X.lineTo(x + 24, 428); X.lineTo(x + 10, 478); X.fill(); } X.restore();
      X.beginPath(); X.ellipse(400, 452, 172, 30, 0, 0, TAU); X.lineWidth = 9; X.strokeStyle = INK; X.stroke();
      const ped2 = new Path2D(); ped2.ellipse(400, 448, 128, 18, 0, 0, TAU); K.inkP(ped2, '#8f9cb3', 4);
    });
  }
  function portrait(x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      
      K.rr(-52, -44, 104, 88, 8); K.ink('#f0b73f', 4); K.rr(-44, -36, 88, 72, 4); K.ink('#fff3d6', 2.5);
      K.rr(-24, -10, 48, 30, 14); K.ink('#ff4d5e', 3); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 9, 1, 3.4, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx * 9, 2, 1.6, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 10, 7, .2, Math.PI - .2); ctx.stroke();
      ctx.beginPath(); ctx.arc(34, 24, 11, 0, TAU); K.ink('#ffd23f', 2.5); ctx.beginPath(); ctx.arc(34, 24, 5, 0, TAU); K.ink('#ff4d5e', 2); K.rr(28, 32, 7, 14, 2); K.ink('#4DB8FF', 2);
    ctx.restore();
  }
  function rocket(x, yb, s, mood, lx, ly, fl) {
    ctx.save(); ctx.translate(x, yb); ctx.scale(s, s);
    if (fl > 0) { ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(0, 46 * fl); ctx.lineTo(12, 0); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, 28 * fl); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill(); }
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 15, -34); ctx.lineTo(sx * 31, 2); ctx.lineTo(sx * 15, -4); ctx.closePath(); K.ink('#ff5c6c', 3); }
    const body = new Path2D(); body.moveTo(-17, 0); body.lineTo(-17, -62); body.quadraticCurveTo(0, -130, 17, -62); body.lineTo(17, 0); body.closePath();
    K.cel(body, '#fff', '#c9d6f0', 5, 0, 3.5);
    ctx.save(); ctx.clip(body); ctx.fillStyle = '#ff5c6c'; ctx.fillRect(-20, -110, 40, 38); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-12, -108, 6, 34); ctx.fillStyle = '#ff5c6c'; ctx.fillRect(-20, -14, 40, 8); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-17, -62); ctx.quadraticCurveTo(0, -130, 17, -62); ctx.lineTo(17, 0); ctx.closePath(); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    K.eye(-7, -42, 5.4, mood, lx, ly, 1.1); K.eye(7, -42, 5.4, mood, lx, ly, 2.2);
    ctx.restore();
  }
  function draw(S, T, rt) {
    K.use(ctx);
    if (!WALL || KW !== VW) build();
    const won = S.result === 'win', lost = S.result === 'lose', creep = lost ? 1 : won ? 0 : K.clamp((T - .5) / 3, 0, 1), cx = W / 2;
    ctx.drawImage(WALL, -OX, 0);
    // the rocket in the window (clipped to it): worried, then dozing, or launching
    ctx.save(); ctx.beginPath(); ctx.rect(WIN[0], WIN[1], WIN[2], WIN[3]); ctx.clip();
    for (const [o, y, s, v] of [[0, 130, .7, 6], [300, 118, .55, 4]]) K.cloud(((T * v + o) % 420) - 60, y, s);
    const lq = lost ? Math.max(0, rt - .14) : 0, up = lost ? lq * lq * 1700 : 0, rm = won ? 'sleepy' : lost ? 'panic' : creep > .55 ? 'panic' : null;
    if (lost && rt < .14) ctx.translate(Math.sin(rt * 90) * 2, 0);
    ctx.fillStyle = 'rgba(20,16,28,.2)'; ctx.beginPath(); ctx.ellipse(145, 254, 34, 6, 0, 0, TAU); ctx.fill();
    K.rr(100, 248, 90, 14, 4); K.ink('#8f9cb3', 3);
    rocket(145, 250 - up, 1.05, rm, 1, 0.3, lost && rt > .14 ? .8 + Math.sin(T * 60) * .2 : 0);
    if (lost && rt > .14) { const d = rt - .14; for (let i = 0; i < 6; i++) { ctx.globalAlpha = Math.max(0, .9 - d * 1.3); ctx.beginPath(); ctx.arc(145 + (i - 2.5) * 14 * (1 + d * 2), 250 - hash(i) * 14, 9 + d * 34, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8fb7d6'; ctx.stroke(); } ctx.globalAlpha = 1; }
    if (won) { for (let i = 0; i < 3; i++) { const k = (T * .6 + i / 3) % 1; ctx.globalAlpha = Math.sin(k * Math.PI); txt('z', 172 + k * 14, 150 - k * 36, 16 + i * 4, '#fff'); } ctx.globalAlpha = 1; }
    ctx.restore();
    if (!won && creep > .55 && !lost) K.sweat(176, 156, 1, (T * 1.6) % 1);
    // the leaky pipe drips onto the console
    const dc = (T * .9) % 1; ctx.fillStyle = '#6ea8d8';
    if (dc < .85) { const dyy = 90 + 288 * dc * dc; ctx.beginPath(); ctx.moveTo(470, dyy - 8); ctx.quadraticCurveTo(476, dyy + 2, 470, dyy + 5); ctx.quadraticCurveTo(464, dyy + 2, 470, dyy - 8); K.ink('#9fe3ff', 2); }
    else { const s2 = (dc - .85) / .15; ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 3; ctx.globalAlpha = 1 - s2; ctx.beginPath(); ctx.ellipse(470, 378, 4 + s2 * 12, 2 + s2 * 4, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    // the framed portrait: the shake knocks it off its nail when you press
    { const fk = lost ? Math.max(0, rt - .1) : 0; portrait(692 + fk * 30, 168 + fk * fk * 1500, lost ? -.04 - fk * 1.6 : -.04 + Math.sin(T * 1.3) * .012); }
    // siren hanging from the pipe
    const sirA = T * (lost ? 9 : 2.5);
    if (lost) { ctx.save(); ctx.globalAlpha = .28 * Math.min(1, rt * 5); ctx.fillStyle = '#ff4d5e'; for (let i = 0; i < 2; i++) { const a = sirA + i * Math.PI; ctx.beginPath(); ctx.moveTo(545, 106); ctx.lineTo(545 + Math.cos(a - .28) * 330, 106 + Math.sin(a - .28) * 330); ctx.lineTo(545 + Math.cos(a + .28) * 330, 106 + Math.sin(a + .28) * 330); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    K.line([[545, 82], [545, 92]], 4, '#8f9cb3'); K.rr(530, 90, 30, 8, 3); K.ink('#8f9cb3', 3);
    ctx.beginPath(); ctx.arc(545, 98, 14, Math.PI, 0); ctx.lineTo(559, 98); ctx.lineTo(531, 98); ctx.closePath(); K.ink(lost ? '#ff4d5e' : '#ff9aa6', 3.5);
    ctx.fillStyle = lost ? '#fff' : 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(545 + Math.cos(sirA) * 5, 92, 3.5, 5, 0, 0, TAU); ctx.fill();
    // ── Claude, standing behind the console ──
    const sag = won ? 0 : Math.sin(T * 3.1) * .03 + creep * .04;
    ctx.save(); ctx.translate(cx, FEET); ctx.scale(1 + sag, 1 - sag); ctx.translate(-cx, -FEET);
    claude(cx, FEET, 10, { mood: lost ? 'sad' : won ? 'happy' : null });
    // hard hat with a lamp (sits above the eyes)
    const hy = FEET - 90, hat = new Path2D(); hat.moveTo(cx - 54, hy + 4); hat.quadraticCurveTo(cx - 54, hy - 34, cx, hy - 34); hat.quadraticCurveTo(cx + 54, hy - 34, cx + 54, hy + 4); hat.closePath();
    K.rr(cx - 66, hy - 2, 132, 10, 5); K.ink('#ffd23f', 3.5); K.cel(hat, '#ffd23f', '#c99512', 4, 4, 4); K.glint(hat, cx - 24, hy - 22, 16, 5, 'rgba(255,255,255,.6)', -.4);
    ctx.beginPath(); ctx.arc(cx, hy - 18, 8, 0, TAU); K.ink('#fff', 3);
    if (creep > .25 && !won) for (const [sx, o] of [[-1, 0], [1, .5]]) K.sweat(cx + sx * 64, FEET - 70, 1.5, (T * 1.5 + o) % 1);
    if (lost) for (let i = 0; i < 3; i++) { const a = T * 5 + i * TAU / 3; star(cx + Math.cos(a) * 52, FEET - 126 + Math.sin(a) * 9, 10, 4.5, 5, T * 3, '#FFE14D', 2.5); }
    if (won) {                       // a gold medal on a ribbon
      const sw = Math.sin(T * 4) * .08, k = K.outBack(rt / .3);
      ctx.save(); ctx.translate(cx, FEET - 56); ctx.rotate(sw); ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(0, 2); ctx.lineTo(-4, 2); ctx.lineTo(-22, -22); ctx.closePath(); K.ink('#ff4d5e', 2.5);
      ctx.beginPath(); ctx.moveTo(14, -22); ctx.lineTo(0, 2); ctx.lineTo(4, 2); ctx.lineTo(22, -22); ctx.closePath(); K.ink('#4DB8FF', 2.5);
      ctx.beginPath(); ctx.arc(0, 12, 16, 0, TAU); K.ink('#ffd23f', 3.5); star(0, 12, 10, 4.5, 5, 0, '#fff3a0', 2); ctx.restore();
    }
    ctx.restore();
    ctx.drawImage(CON, -OX, 0);
    // console extras: blinking lamps and the coffee mug that steams
    for (let i = 0; i < 3; i++) { const on = lost ? true : Math.sin(T * (2 + i) + i * 2) > -.2; ctx.beginPath(); ctx.arc(60 + i * 30, 486, 6, 0, TAU); K.ink(lost ? '#ff4d5e' : on ? '#5CFF7A' : '#7a8bad', 3); }
    K.rr(716, 350, 38, 30, 6); K.ink('#fff', 3.5); ctx.beginPath(); ctx.arc(758, 365, 9, -1.4, 1.4); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#7a4a2a'; K.rr(719, 353, 32, 6, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const o of [0, 1]) { ctx.beginPath(); for (let i = 0; i <= 12; i++) { const yy = 346 - i * 3.5, xx = 728 + o * 14 + Math.sin(T * 3 + i * .6 + o) * 4; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.globalAlpha = .7; ctx.stroke(); } ctx.globalAlpha = 1;
    let la, ra;
    // arms wobble upward in the beginning, creep toward the button, then slam it (or wave with the medal)
    if (lost) { const k = K.outBack(rt / .12); la = 2.2 + .6 * k; ra = -2.2 - .6 * k; }
    else if (won) { la = -.5 + Math.sin(T * 12) * .25; ra = .5 - Math.sin(T * 12) * .25; }
    else { const j = creep * creep * Math.sin(T * 26) * .14; la = 2.2 + creep * .45 + j; ra = -2.2 - creep * .45 - j * 1.1; }
    // ── the button: a grinning dome; it sinks when pressed, sulks when ignored ──
    const pr = lost ? 16 : 0, top = 376 + pr, bot = 450;
    const dome = new Path2D(); dome.moveTo(270, bot); dome.lineTo(270, top + 46); dome.quadraticCurveTo(270, top, 330, top); dome.lineTo(470, top); dome.quadraticCurveTo(530, top, 530, top + 46); dome.lineTo(530, bot); dome.closePath();
    K.cel(dome, won ? '#ff7d8c' : '#ff4d5e', '#b8283a', 0, 10, 5); K.glint(dome, 322, top + 16, 44, 7, 'rgba(255,255,255,.6)', -.12);
    ctx.save(); ctx.translate(cx, FEET); ctx.scale(1 + sag, 1 - sag); ctx.translate(0, 0);
    K.arms(10, la, ra);
    ctx.restore();
    const dm = lost ? 'dead' : null, ey = top + 24, lk = won ? 1 : -.5;
    K.eye(350, ey, 9.5, dm, creep > .6 ? 1 : 0, lk, 5); K.eye(450, ey, 9.5, dm, creep > .6 ? -1 : 0, lk, 6);
    if (!lost) { ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; const dr = won ? -1 : 1; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sx * 64, ey - 15); ctx.lineTo(cx + sx * 36, ey - 15 + dr * 8); ctx.stroke(); } }
    if (won) K.sweat(cx + 62, ey + 12, 1.4, (T * 1.1) % 1);
    txt(S.taunt, cx, top + 62, 26, '#fff', 'center', 200);
    // the second taunt swings across the bottom on a tag
    if (!lost && !won) { const tx = cx + Math.sin(S.now * 9) * 160, ty = 500 + Math.cos(S.now * 7) * 20; K.rr(tx - 98, ty - 20, 196, 40, 20); K.ink('#FFE14D', 3); txt(S.taunt2, tx, ty + 1, 26, INK, 'center', 170); }
    if (won) { for (let i = 0; i < 4; i++) { const k = (T * .7 + i * .25) % 1, hx = i % 2 ? 560 + hash(i) * 120 : 150 + hash(i + 3) * 100; K.heart(hx + Math.sin(T * 3 + i) * 8, 330 - k * 120, .9, Math.sin(k * Math.PI)); } txt('GOOD CLAUDE', cx, 138, 48, '#5CFF7A'); }
    vignette(.18);
  }
  return { draw };
})();
function gDont(sp) {
  const taunts = ['PRESS ME!', 'DO IT!', 'CLICK!', 'SPACE!!!', 'JUST ONCE!', 'GO ON...'];
  const fail = () => { if (g.result) return; g.result = 'lose'; resAt = now; sfx.buzz(); sfx.thud(); shake(10, .3); burst(W / 2, 382, '#ee3b3b', 16); floatText('OOPS!', W / 2, 250, '#FF4D4D', 44); };
  let resAt = null, wonFx = false;
  const g = {
    cmd: "DON'T!", hint: "DON'T TOUCH ANYTHING", dur: 4, timeWin: true, wide: true,
    key() { fail(); }, down() { fail(); },
    update() { if (g.result && resAt == null) resAt = now; },
    draw(t) {
      if (g.result && resAt == null) resAt = now;
      W2DONT.draw({ result: g.result, now, taunt: taunts[(now * 1.4 | 0) % taunts.length], taunt2: taunts[((now * 1.4 | 0) + 3) % taunts.length] }, t, resAt == null ? 0 : Math.max(0, now - resAt));
      if (g.result === 'win' && !g.won) { g.won = 1; sfx.coin(); sfx.sparkle(); confetti(W / 2, 200, 30); }
    }
  };
  return g;
}

/* 9 ── COUNT: how many Claudes? (number keys or click)
   Scene: census day at a peach apartment block. Shutters bang open and Claudes in nightcaps, curlers and party hats lean out;
   you ring the right doorbell on the intercom. Win: the whole building cheers and the roof pigeon takes off. Fail: a flowerpot
   drops off the roof onto the doorbell you rang. */
const W2COUNT = (() => {
  const K = W2K, TAU = Math.PI * 2;
  let SKY = null, BLD = null, FG = null, KW = -1;
  const wc = c => [(c % 4) * 200 + 100, 175 + (c / 4 | 0) * 150];
  const FLOWERBOX = [0, 3, 5, 6];
  function build() {
    KW = VW;
    SKY = K.layer(X => {
      const g = X.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff');
      X.fillStyle = g; X.fillRect(-OX, 0, VW, H);
      // far skyline: pale lilac towers with their own darker outline (distance), windows a lighter tint
      for (let i = 0, x = -OX - 30; x < W + OX + 30; i++) {
        const w = 70 + (i * 23) % 40, top = 34 + (i * 37) % 4 * 13;
        K.rr(x, top, w, 460 - top, 6); X.fillStyle = i % 2 ? '#c9d0fb' : '#b7c0f3'; X.fill(); X.strokeStyle = '#7b80c6'; X.lineWidth = 3; X.stroke();
        X.fillStyle = 'rgba(246,248,255,.7)'; for (let yy = top + 12; yy < 440; yy += 22) for (let xx = x + 10; xx < x + w - 14; xx += 18) X.fillRect(xx, yy, 8, 10);
        x += w + 8;
      }
    });
    BLD = K.layer(X => {
      // the apartment block (warm stucco wall, gradient is allowed on walls)
      const wall = K.rrP(6, 86, 788, 340, 6), g = X.createLinearGradient(0, 86, 0, 424);
      g.addColorStop(0, '#ffd6a6'); g.addColorStop(1, '#f2a66e');
      X.lineWidth = 8; X.strokeStyle = INK; X.stroke(wall); X.fillStyle = g; X.fill(wall);
      X.save(); X.clip(wall);
      X.strokeStyle = 'rgba(176,96,48,.15)'; X.lineWidth = 2;
      for (let y = 112, r = 0; y < 380; y += 22, r++) { X.beginPath(); X.moveTo(6, y); X.lineTo(794, y); X.stroke(); for (let x = 30 + (r % 2) * 22; x < 794; x += 44) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 22); X.stroke(); } }
      X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(6, 96, 788, 10);
      X.restore();
      // stone base course
      K.rr(4, 380, 792, 46, 5); K.ink('#cbb9a5', 4);
      X.fillStyle = '#a8937e'; for (let x = 60; x < 790; x += 86) X.fillRect(x, 384, 3, 38); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(8, 384, 784, 5);
      // middle cornice + roof parapet (terracotta)
      K.rr(-6, 68, 812, 24, 8); K.ink('#e8845a', 4.5); X.fillStyle = '#c9673e'; X.fillRect(-2, 84, 804, 6); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(0, 72, 800, 5);
      // TV antenna on the roof (line art)
      K.line([[626, 68], [626, 38]], 4, '#c9ced6'); K.line([[610, 44], [642, 44]], 3.5, '#c9ced6'); K.line([[614, 54], [638, 54]], 3.5, '#c9ced6');
      // windows: white frames, a dim room inside with a lamp, a lintel on top
      for (let c = 0; c < 8; c++) {
        const [cx, cy] = wc(c);
        K.rr(cx - 74, cy - 82, 148, 14, 5); K.ink('#e98d5b', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(cx - 70, cy - 80, 140, 3);
        K.cel(K.rrP(cx - 66, cy - 68, 132, 104, 12), '#fff4e2', '#e3c9a8', 3, 4, 4);
        const room = K.rrP(cx - 56, cy - 58, 112, 88, 8), rg = X.createLinearGradient(0, cy - 58, 0, cy + 30);
        rg.addColorStop(0, '#c9b8ec'); rg.addColorStop(1, '#a28ed6'); K.inkP(room, rg, 3);
        X.save(); X.clip(room);
        X.fillStyle = 'rgba(255,255,255,.16)'; for (let x = cx - 52; x < cx + 56; x += 16) X.fillRect(x, cy - 58, 7, 88);
        const lx = cx + (c % 2 ? -30 : 30);
        X.fillStyle = 'rgba(255,220,140,.22)'; X.beginPath(); X.arc(lx, cy - 30, 30, 0, TAU); X.fill();
        X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(lx, cy - 58); X.lineTo(lx, cy - 44); X.stroke();
        X.fillStyle = '#ffd98a'; X.beginPath(); X.moveTo(lx - 10, cy - 34); X.lineTo(lx - 5, cy - 44); X.lineTo(lx + 5, cy - 44); X.lineTo(lx + 10, cy - 34); X.closePath(); X.fill();
        K.rr(cx + (c % 2 ? 14 : -40), cy - 46, 26, 20, 3); K.ink('#8fd3ff', 2); X.fillStyle = '#4fbf5a'; X.fillRect(cx + (c % 2 ? 14 : -40), cy - 34, 26, 8);
        X.restore();
      }
      // sidewalk: hard ink line where the ground starts, slabs, a curb
      const sg = X.createLinearGradient(0, 426, 0, 600); sg.addColorStop(0, '#dcd7e6'); sg.addColorStop(1, '#b3adc4');
      X.fillStyle = sg; X.fillRect(-OX, 426, VW, 174);
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-OX, 426); X.lineTo(W + OX, 426); X.stroke();
      X.strokeStyle = 'rgba(20,16,28,.12)'; X.lineWidth = 3; for (let x = -OX - 40 + ((OX | 0) % 110); x < W + OX; x += 110) { X.beginPath(); X.moveTo(x, 428); X.lineTo(x - 30, 572); X.stroke(); }
      K.rr(-OX - 10, 572, VW + 20, 40, 6); K.ink('#a7a1bb', 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-OX, 576, VW, 4);
      for (const [x, y] of [[-OX + 30, 566], [20, 560], [790, 562], [W + OX - 40, 566]]) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); }
      // the intercom console: two posts and a steel plate with screws
      for (const px of [130, 670]) { K.rr(px - 10, 520, 20, 70, 4); K.ink('#8f9cb3', 3.5); }
      const panel = K.rrP(32, 424, 736, 118, 20);
      X.fillStyle = 'rgba(20,16,28,.3)'; X.save(); X.translate(4, 7); X.fill(panel); X.restore();
      K.cel(panel, '#cfd8e6', '#8f9cb3', 0, 7, 4); K.glint(panel, 120, 432, 90, 6, 'rgba(255,255,255,.5)', 0);
      for (const [sx, sy] of [[48, 440], [752, 440], [48, 526], [752, 526]]) { X.beginPath(); X.arc(sx, sy, 5, 0, TAU); K.ink('#e8edf5', 2); X.strokeStyle = '#8f9cb3'; X.lineWidth = 2; X.beginPath(); X.moveTo(sx - 3, sy - 3); X.lineTo(sx + 3, sy + 3); X.stroke(); }
    });
    FG = K.layer(X => {          // sills (and flower boxes) in front of the Claudes, so they lean OUT of the window
      for (let c = 0; c < 8; c++) {
        const [cx, cy] = wc(c);
        K.cel(K.rrP(cx - 76, cy + 28, 152, 16, 6), '#fff4e2', '#d9b98f', 0, 4, 4);
        if (FLOWERBOX.includes(c)) {
          for (let i = 0; i < 4; i++) { const fx = cx - 33 + i * 22; X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(fx, cy + 50); X.lineTo(fx, cy + 40); X.stroke(); X.strokeStyle = '#4fbf5a'; X.lineWidth = 3; X.stroke(); X.beginPath(); X.arc(fx, cy + 39, 6, 0, TAU); K.ink(['#ff5c8a', '#FFE14D', '#fff', '#ff8fc4'][(i + c) % 4], 2.5); X.fillStyle = '#ffb347'; X.beginPath(); X.arc(fx, cy + 39, 2.2, 0, TAU); X.fill(); }
          K.cel(K.rrP(cx - 46, cy + 46, 92, 20, 5), '#d9944f', '#a5622c', 0, 4, 3.5); X.fillStyle = '#b06d33'; X.fillRect(cx - 44, cy + 55, 88, 3);
        }
      }
    });
  }
  function shutters(cx, cy, k) {      // k 0 = shut, 1 = banged open flat against the wall
    const a = K.clamp(k, 0, 1) * Math.PI, cw = Math.cos(a), ww = cw >= 0 ? 56 * cw : 38 * cw;
    if (Math.abs(ww) < 2) return;
    for (const s of [-1, 1]) {
      const hx = cx + s * 56, x1 = hx - s * ww, x = Math.min(hx, x1), w = Math.abs(ww);
      const p = K.rrP(x, cy - 60, w, 92, 5);
      K.cel(p, '#5fc06c', '#3f8a4c', s * (cw >= 0 ? -3 : 3), 0, 3.5);
      X().save(); X().clip(p); X().fillStyle = 'rgba(20,16,28,.22)'; for (let y = cy - 50; y < cy + 28; y += 12) X().fillRect(x, y, w, 3); X().restore();
      if (cw > .4) { X().fillStyle = '#FFE14D'; X().beginPath(); X().arc(hx - s * (ww - 8), cy - 14, 3, 0, TAU); X().fill(); }
    }
  }
  const X = () => ctx;
  function hat(a, u, T, i) {         // a different silly hat per window (deterministic from the cell, no RNG)
    const c = ctx, top = -9 * u;
    if (a === 1) {          // nightcap
      const sw = Math.sin(T * 3 + i) * u * .6;
      c.beginPath(); c.moveTo(-5.2 * u, top + .8 * u); c.quadraticCurveTo(-1 * u, top - 7 * u, 6.5 * u + sw, top - 2.5 * u); c.lineTo(4.8 * u, top + .8 * u); c.closePath(); W2K.ink('#6EA8FE', 3);
      c.fillStyle = '#fff'; c.fillRect(-5.2 * u, top - .2 * u, 10 * u, 1.1 * u); c.beginPath(); c.arc(6.5 * u + sw, top - 2.5 * u, 1.5 * u, 0, TAU); W2K.ink('#fff', 2.5);
    } else if (a === 2) {   // sunglasses
      for (const s of [-1, 1]) { W2K.rr(s * 2.8 * u - 1.9 * u, -7.5 * u, 3.8 * u, 2.6 * u, u * .9); W2K.ink('#2b2440', 2.2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(s * 2.8 * u - 1.2 * u, -7.1 * u, u * .9, u * .5); }
      c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(-1 * u, -6.6 * u); c.lineTo(1 * u, -6.6 * u); c.stroke();
    } else if (a === 3) {   // hair curlers
      for (const s of [-1, 0, 1]) { W2K.rr(s * 3.4 * u - 1.3 * u, top - 1.6 * u, 2.6 * u, 2 * u, u * .7); W2K.ink(s ? '#ff8fc4' : '#9fe3ff', 2.5); }
    } else if (a === 4) {   // party hat
      c.beginPath(); c.moveTo(-2.6 * u, top + .6 * u); c.lineTo(.6 * u, top - 6 * u); c.lineTo(3.2 * u, top + .6 * u); c.closePath(); W2K.ink('#FFE14D', 3);
      c.fillStyle = '#ff5c8a'; for (const [a1, b1] of [[-.6, -1.4], [1.3, -3.2], [1.6, -.6]]) { c.beginPath(); c.arc(a1 * u, top + b1 * u, u * .45, 0, TAU); c.fill(); }
      star(.6 * u, top - 6.4 * u, u * 1.1, u * .5, 5, T * 3, '#5CFF7A', 2);
    } else if (a === 5) {   // bath towel turban
      c.beginPath(); c.moveTo(-5.6 * u, top + 1 * u); c.quadraticCurveTo(-6 * u, top - 4.2 * u, 0, top - 4.6 * u); c.quadraticCurveTo(6 * u, top - 4.2 * u, 5.6 * u, top + 1 * u); c.closePath(); W2K.ink('#9fe3ff', 3);
      c.strokeStyle = '#6fc3e6'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-4.4 * u, top - .6 * u); c.quadraticCurveTo(0, top - 3.6 * u, 4.6 * u, top - 1.6 * u); c.stroke();
      c.beginPath(); c.arc(1.2 * u, top - 4.6 * u, 1.6 * u, 0, TAU); W2K.ink('#9fe3ff', 2.5); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-3.6 * u, top - 2.6 * u, 1.6 * u, .6 * u);
    }
  }
  function pigeon(x, y, dir, T, fly) {
    const c = ctx; c.save(); c.translate(x, y); c.scale(dir, 1);
    const peck = !fly && Math.sin(T * 6) > .75 ? 5 : 0;
    if (fly) for (const s of [-1, 1]) { const f = Math.sin(T * 30) * .9; c.save(); c.translate(-2, -14); c.rotate(s < 0 ? -1.2 - f : -1.9 + f); W2K.el(0, -12, 6, 14); W2K.ink('#8f88a6', 2.5); c.restore(); }
    else { c.strokeStyle = '#ff9a3c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-3, -4); c.lineTo(-4, 0); c.moveTo(3, -4); c.lineTo(4, 0); c.stroke(); }
    W2K.cel(W2K.elP(0, -12, 14, 10), '#b9b4c8', '#8f88a6', 2, 3, 3);
    c.beginPath(); c.moveTo(-12, -14); c.lineTo(-22, -18); c.lineTo(-20, -9); c.closePath(); W2K.ink('#8f88a6', 2.5);
    c.save(); c.translate(10, -22 + peck); c.rotate(peck ? .5 : 0);
    c.beginPath(); c.arc(0, 0, 8, 0, TAU); W2K.ink('#a39dbb', 3); c.fillStyle = '#7fd3a0'; c.fillRect(-5, 5, 9, 3);
    c.beginPath(); c.moveTo(7, -2); c.lineTo(13, 1); c.lineTo(7, 3); c.closePath(); W2K.ink('#ffb347', 1.8);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(3, -2, 3, 0, TAU); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(4, -2, 1.6, 0, TAU); c.fill();
    c.restore(); c.restore();
  }
  function pot(x, y, rot) {
    const c = ctx; c.save(); c.translate(x, y); c.rotate(rot);
    for (const [a, l] of [[-.4, 26], [.2, 30], [.6, 22]]) { c.save(); c.rotate(a); W2K.line([[0, -12], [0, -12 - l]], 3, '#4fbf5a'); c.restore(); }
    c.save(); c.rotate(.2); c.beginPath(); c.arc(0, -46, 8, 0, TAU); W2K.ink('#ff5c8a', 2.5); c.restore();
    c.beginPath(); c.moveTo(-17, -14); c.lineTo(17, -14); c.lineTo(12, 16); c.lineTo(-12, 16); c.closePath(); W2K.ink('#e8845a', 3.5);
    W2K.rr(-20, -18, 40, 9, 3); W2K.ink('#c9673e', 3); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-10, -6, 4, 18);
    c.restore();
  }
  function draw(s) {
    const { g, pts, cells, clock, n, picked, x0, bw, step, by, resAt, late } = s, T = now;
    if (KW !== VW || !SKY) build();
    K.use(ctx);
    ctx.drawImage(SKY, -OX, 0);
    for (const [sp2, off, y, sc] of [[8, 120, 46, .6], [5, 560, 66, .5], [11, 860, 30, .45]]) K.cloud(((T * sp2 + off) % (VW + 240)) - OX - 160, y, sc);
    for (let i = 0; i < 2; i++) K.bird(((T * 40 + i * 70) % (VW + 300)) - OX - 150, 40 + i * 14 + Math.sin(T * 2 + i) * 5, Math.sin(T * 10 + i) * 5);
    ctx.drawImage(BLD, -OX, 0);
    const won = g.result === 'win', lost = g.result === 'lose', rt = resAt == null ? 0 : clock - resAt;
    const hi = Math.floor((mouse.x - x0) / step), hover = !g.result && !TOUCH && hi >= 0 && hi < 8 && mouse.x - x0 - hi * step <= bw && mouse.y > by && mouse.y < by + 80;
    // windows: shutters bang open and a Claude leans out
    const at = {}; pts.forEach((p, i) => { at[cells[i]] = i; });
    for (let c = 0; c < 8; c++) {
      const [cx, cy] = wc(c), i = at[c], p = i == null ? null : pts[i];
      if (p && clock >= p.at) {
        const k = Math.min(1, (clock - p.at) / .2), sc = k * (1 + Math.sin(k * Math.PI) * .3), u = 5.8 * sc;
        const duck = lost ? K.clamp((rt - .3) / .18, 0, 1) : 0, slam = lost ? K.clamp((rt - .42) / .1, 0, 1) : 0;
        const jump = won ? Math.abs(Math.sin(T * 9 + i)) * 26 : 0, fx = K.clamp(p.x, cx - 18, cx + 18), fy = cy + 22 - jump + Math.sin(T * 5 + p.x) * 3 + duck * 90 + (hover ? 2 : 0);          // hover: everyone glances down at the bell
        if (duck < 1) {
          ctx.save(); ctx.beginPath(); ctx.rect(cx - 100, cy - 160, 200, 190); ctx.clip(); ctx.translate(fx, fy);
          if (won) K.arms(u, -.45 + Math.sin(T * 12 + i) * .2, .45 - Math.sin(T * 12 + i) * .2);
          else if (!lost && i % 2 === 0) K.arms(u, null, .5 + Math.sin(T * 9 + i) * .45);
          claude(0, 0, u, { mood: won ? 'happy' : lost ? 'sad' : null });
          hat(1 + (i + cells[0] % 5) % 5, u, T, i);          // the first five tenants always wear five different looks
          ctx.restore();
        }
        if (!g.result && late) K.sweat(fx + 6 * u, fy - 9 * u, .9, (T * 1.8 + i * .37) % 1);
        if (lost && duck < .5) K.sweat(fx + 6 * u, fy - 9 * u, 1, (T * 1.4 + i * .3) % 1);
        if (won) for (let h = 0; h < 2; h++) { const hk = (rt * 1.1 + h * .5 + i * .17) % 1; K.heart(fx + (h ? 34 : -34) + Math.sin(T * 4 + h + i) * 6, fy - 70 - hk * 70, .8, 1 - hk); }
        shutters(cx, cy, Math.min(1, k * 1.15) * (1 - slam));
        if (slam > 0 && slam < 1) { ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s2 * 74, cy - 50); ctx.lineTo(cx + s2 * 92, cy - 62); ctx.moveTo(cx + s2 * 76, cy - 14); ctx.lineTo(cx + s2 * 96, cy - 14); ctx.stroke(); } }
      } else shutters(cx, cy, 0);
    }
    ctx.drawImage(FG, -OX, 0);
    // background gag: the roof pigeon struts and pecks (flies off when the census is right)
    const wk = (T * .09) % 2, wx = 250 + 260 * (wk < 1 ? wk : 2 - wk), dir = wk < 1 ? 1 : -1;
    if (won) pigeon(wx + rt * 260 * dir, 68 - rt * 240, dir, T, true); else pigeon(wx, 68, dir, T, false);
    // win: a census banner unrolls from the roof with the head count on it
    if (won) {
      const k = K.outBack(rt / .35), bh = 64 * k, sw = Math.sin(T * 3) * .03;
      ctx.save(); ctx.translate(W / 2, 88); ctx.rotate(sw);
      if (bh > 4) { ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.lineTo(70, bh); ctx.lineTo(0, bh - 12); ctx.lineTo(-70, bh); ctx.closePath(); K.ink('#ff4d5e', 4); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-62, 4, 124, 6);
        if (k > .6) { txt(String(n), 0, bh * .44, 40, '#FFE14D'); star(-44, bh * .42, 11, 5, 5, T * 2, '#FFE14D', 2.5); star(44, bh * .42, 11, 5, 5, -T * 2, '#FFE14D', 2.5); } }
      K.rr(-80, -8, 160, 14, 7); K.ink('#d9944f', 3.5);
      ctx.restore();
    }
    // doorbells on the intercom: chunky plates with the number (which is also the key)
    for (let i = 0; i < 8; i++) {
      const v = i + 1, bx = x0 + i * step, show = g.result && (v === n || v === picked), right = v === n;
      const col = show ? (right ? '#4fd06a' : '#ff4d5e') : g.result ? '#d3cfe0' : '#ffd23f', dk = show ? (right ? '#24803a' : '#b8283a') : g.result ? '#8f88a6' : '#c99512';
      ctx.globalAlpha = g.result && !show ? .8 : 1;
      const lift = K.plate(bx, by, bw, 72, col, dk, v === picked, 16);
      const fy = by + 9 - lift;
      txt(String(v), bx + bw / 2, fy + 36, 44, g.result && !show ? '#f6f4fb' : '#fff');          // the digit IS the key, so no key cap here
      if (show && right && won) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = .6 + .4 * Math.sin(T * 10); K.rr(bx + 6, fy + 6, bw - 12, 60, 12); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // the fail gag: a flowerpot slides off the roof and lands on the doorbell you rang
    if (lost && resAt != null) {
      const tx = picked ? x0 + (picked - 1) * step + bw / 2 : W / 2, gy = by - 8, y0 = 70, ti = Math.sqrt((gy - y0) / 2000);
      if (rt < ti) { ctx.save(); ctx.translate(tx, y0 + 2000 * rt * rt); ctx.scale(1.4, 1.4); pot(0, 0, rt * 5); ctx.restore(); }
      else {
        const d = rt - ti;
        ctx.globalAlpha = Math.max(0, 1 - d * 1.4); ctx.fillStyle = '#7a5040';
        for (let k = 0; k < 6; k++) { const a = -Math.PI * (k + .5) / 6; ctx.beginPath(); ctx.arc(tx + Math.cos(a) * (20 + d * 140), gy + Math.sin(a) * (10 + d * 90) + 400 * d * d, 9 + d * 14, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        for (const [sx, r0] of [[-1, -.6], [1, .7], [-.4, 2.4]]) { ctx.save(); ctx.translate(tx + sx * (14 + d * 150), gy - 4 - 260 * d + 1100 * d * d); ctx.rotate(r0 + d * 9 * sx); ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -9); ctx.lineTo(9, 12); ctx.lineTo(-12, 9); ctx.closePath(); K.ink('#e8845a', 3.5); ctx.restore(); }
        ctx.save(); ctx.translate(tx + 6, gy + 2); ctx.rotate(1.3); K.line([[0, 0], [0, -28]], 3, '#4fbf5a'); ctx.beginPath(); ctx.arc(0, -32, 7, 0, TAU); K.ink('#ff5c8a', 2.5); ctx.restore();
        star(tx - 22, gy - 26 - d * 20, 12, 5, 4, T * 4, '#FFE14D', 2.5);
      }
    }
  }
  return { draw };
})();
function gCount(sp) {
  const n = 2 + (Math.random() * 4 | 0) + (sp > 1.5 ? 1 : 0);
  const cells = [...Array(8).keys()].sort(() => Math.random() - .5).slice(0, n);
  const pts = cells.map((c, i) => ({ x: (c % 4) * 200 + 100 + (Math.random() - .5) * 40, y: 175 + (c / 4 | 0) * 150 + (Math.random() - .5) * 20, at: .1 + i * .22 / sp }));
  let clock = 0, picked = 0, resAt = null, potHit = false;
  const x0 = 56, bw = 76, step = 86, by = 440;
  const choose = v => { if (g.result) return; picked = v; g.result = v === n ? 'win' : 'lose';
    const bx = x0 + (v - 1) * step + bw / 2;
    if (v === n) { sfx.coin(); sfx.sparkle(); burst(bx, by, '#5CFF7A', 14); ring(bx, by + 40, '#fff', 90); floatText('YES!', bx, by - 30, '#5CFF7A', 38); } else { sfx.buzz(); shake(6, .2); burst(bx, by, '#FF4D4D', 8); } };
  const g = {
    cmd: 'COUNT!', hint: 'HOW MANY CLAUDES?', thint: 'TAP THE NUMBER', dur: 5, wide: true,
    key(e) { const v = +e.key; if (v >= 1 && v <= 8) choose(v); },
    down(p) { const i = Math.floor((p.x - x0) / step); if (i >= 0 && i < 8 && p.x - x0 - i * step <= bw && p.y > by && p.y < by + 80) choose(i + 1); },
    update(dt) {
      clock += dt; pts.forEach(p => { if (!p.s && clock >= p.at) { p.s = 1; sfx.pop(); } });
      if (g.result && resAt == null) resAt = clock;          // art only: when the ending started
      if (g.result === 'lose' && !potHit && clock - resAt >= Math.sqrt((by - 78) / 2000)) { potHit = true; sfx.thud(); shake(5, .15); }
    },
    draw(t) { W2COUNT.draw({ g, pts, cells, clock, n, picked, x0, bw, step, by, resAt, late: clock > g.dur / Math.sqrt(sp) * .7 }); }
  };
  return g;
}

/* 10 ── SLICE: swipe the fruit, avoid the bombs (mouse)
   Scene: Claude's juice-bar kitchen. Fruit with faces get tossed up, panic when the knife comes near and land in halves;
   juice splats the tiles and the blender on the counter fills up. Win: the blender whirs, the lid hops, Claude cheers.
   Fail (bomb): KABOOM, Claude and the cat are covered in soot. Fail (missed): the blender sulks. */
const W2SLICE = (() => {
  const K = W2K, TAU = Math.PI * 2;
  const COLS = ['#ff4d4d', '#9be564', '#ffd23f', '#ff8c42'];
  // per fruit: base, shade, light/rind, flesh, juice
  const FR = [['#ff4d5e', '#c42f43', '#ff9aa5', '#fff1c9', '#ff6b7a'], ['#5cc95a', '#2f8a3f', '#c9f59a', '#ff4d6d', '#ff5c7a'], ['#ffe14d', '#e0b21a', '#fff3a0', '#fff6b8', '#ffe14d'], ['#ff9a3c', '#d9701e', '#ffc58a', '#ffb347', '#ff9a3c']];
  const WX = 318, WY = 172, WW = 164, WH = 112;
  let BG = null, OVR = null, KW = -1;
  function build() {
    KW = VW;
    BG = K.layer(X => {
      // tiled wall (gradient allowed on walls) + a cream backsplash
      let g = X.createLinearGradient(0, 0, 0, 490); g.addColorStop(0, '#cbe9ff'); g.addColorStop(1, '#e6f5ff');
      X.fillStyle = g; X.fillRect(-OX, 0, VW, 490);
      X.strokeStyle = 'rgba(70,130,190,.16)'; X.lineWidth = 2;
      for (let y = 40; y < 400; y += 40) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); }
      for (let x = -OX - (OX % 40); x < W + OX; x += 40) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, 400); X.stroke(); }
      X.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 4; y < 400; y += 40) for (let x = -OX - (OX % 40) + 4; x < W + OX; x += 40) X.fillRect(x, y, 8, 3);
      X.fillStyle = '#ffe9c4'; X.fillRect(-OX, 400, VW, 90);
      X.fillStyle = '#ffd6e0'; for (let x = -OX - (OX % 60), i = 0; x < W + OX; x += 30, i++) for (let y = 400; y < 490; y += 30) if (((x / 30 | 0) + (y / 30 | 0)) % 2) X.fillRect(x, y, 30, 30);
      X.strokeStyle = 'rgba(160,110,60,.25)'; X.beginPath(); X.moveTo(-OX, 400); X.lineTo(W + OX, 400); X.stroke();
      // the window: sky + far hills (clouds drift live), frame and curtains go in the overlay
      g = X.createLinearGradient(0, WY, 0, WY + WH); g.addColorStop(0, '#36b0ea'); g.addColorStop(.6, '#86d8fb'); g.addColorStop(1, '#d6f7ff');
      X.fillStyle = g; X.fillRect(WX, WY, WW, WH);
      X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(WX, WY + WH); for (let x = WX; x <= WX + WW; x += 8) X.lineTo(x, WY + 86 - Math.sin(x * .05) * 8); X.lineTo(WX + WW, WY + WH); X.fill();
      X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(WX, WY + WH); for (let x = WX; x <= WX + WW; x += 8) X.lineTo(x, WY + 98 - Math.sin(x * .07 + 2) * 6); X.lineTo(WX + WW, WY + WH); X.closePath(); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
      // left shelf with jars
      const lx = -OX + 18;
      K.rr(lx, 236, 200, 14, 4); K.ink('#d9944f', 4); X.fillStyle = '#f2b878'; X.fillRect(lx + 2, 238, 196, 3);
      for (const bx of [lx + 30, lx + 170]) { X.beginPath(); X.moveTo(bx - 8, 250); X.lineTo(bx + 8, 250); X.lineTo(bx - 8, 270); X.closePath(); K.ink('#a5622c', 3); }
      [['#c98443', 44], ['#ffd23f', 38], ['#4fbf5a', 46], ['#ff6b7a', 34]].forEach(([fill, h], i) => {
        const jx = lx + 16 + i * 46, p = K.rrP(jx, 236 - h, 34, h, 7);
        K.inkP(p, 'rgba(225,245,255,.9)', 3); X.save(); X.clip(p); X.fillStyle = fill; X.fillRect(jx, 236 - h * .7, 34, h); X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(jx + 5, 236 - h + 4, 5, h - 8); X.restore();
        K.rr(jx - 2, 230 - h, 38, 9, 3); K.ink(['#ff4d5e', '#6EA8FE', '#ffd23f', '#5fc06c'][i], 2.5);
      });
      // right shelf (the cat sits here) with cookbooks
      const rx = W + OX - 238;
      K.rr(rx, 244, 220, 14, 4); K.ink('#d9944f', 4); X.fillStyle = '#f2b878'; X.fillRect(rx + 2, 246, 216, 3);
      for (const bx of [rx + 30, rx + 190]) { X.beginPath(); X.moveTo(bx - 8, 258); X.lineTo(bx + 8, 258); X.lineTo(bx - 8, 278); X.closePath(); K.ink('#a5622c', 3); }
      [['#ff5c8a', 52], ['#6EA8FE', 46], ['#ffd23f', 56]].forEach(([fill, h], i) => { K.rr(rx + 156 + i * 18, 244 - h, 16, h, 3); K.ink(fill, 2.5); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(rx + 159 + i * 18, 244 - h + 8, 10, 3); });
      // wall clock face (hands move live)
      X.beginPath(); X.arc(612, 120, 30, 0, TAU); K.ink('#ff5a4f', 4); X.beginPath(); X.arc(612, 120, 22, 0, TAU); K.ink('#fffaf0', 2.5);
      X.fillStyle = INK; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; X.fillRect(612 + Math.cos(a) * 17 - 1.5, 120 + Math.sin(a) * 17 - 1.5, 3, 3); }
      // counter: ink line where it starts, wooden top, cabinets with doors and knobs
      K.rr(-OX - 10, 490, VW + 20, 26, 6); K.ink('#d9944f', 4); X.fillStyle = '#f2b878'; X.fillRect(-OX, 494, VW, 5); X.fillStyle = '#a5622c'; X.fillRect(-OX, 510, VW, 4);
      g = X.createLinearGradient(0, 518, 0, 600); g.addColorStop(0, '#e3a868'); g.addColorStop(1, '#c4874e'); X.fillStyle = g; X.fillRect(-OX, 518, VW, 82);
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-OX, 518); X.lineTo(W + OX, 518); X.stroke();
      for (let x = -OX - (OX % 170) + 16; x < W + OX; x += 170) { K.cel(K.rrP(x, 530, 150, 90, 10), '#eab577', '#c4874e', 0, -4, 3.5); X.beginPath(); X.arc(x + 75, 552, 6, 0, TAU); K.ink('#fff3a0', 2.5); }
      // cutting board with a knife resting on it
      K.cel(K.rrP(318, 474, 164, 20, 9), '#f2c48a', '#c98443', 0, 4, 3.5); X.beginPath(); X.arc(466, 484, 4, 0, TAU); X.fillStyle = INK; X.fill();
      K.rr(352, 476, 54, 8, 3); K.ink('#e8edf5', 2.5); K.rr(404, 475, 30, 10, 4); K.ink('#3b3550', 2.5);
    });
    OVR = K.layer(X => {        // window frame + curtains, drawn over the drifting clouds
      X.lineWidth = 10; X.strokeStyle = INK; X.strokeRect(WX, WY, WW, WH); X.lineWidth = 6; X.strokeStyle = '#fff4e2'; X.strokeRect(WX, WY, WW, WH);
      K.line([[WX + WW / 2, WY], [WX + WW / 2, WY + WH]], 5, '#fff4e2'); K.line([[WX, WY + WH / 2], [WX + WW, WY + WH / 2]], 5, '#fff4e2');
      K.rr(WX - 14, WY + WH - 2, WW + 28, 14, 5); K.ink('#fff4e2', 4);
      for (const s of [-1, 1]) {
        const cx = s < 0 ? WX - 6 : WX + WW + 6;
        X.beginPath(); X.moveTo(cx - s * 2, WY - 16); X.lineTo(cx + s * 40, WY - 16); X.quadraticCurveTo(cx + s * 18, WY + 50, cx + s * 30, WY + WH + 6); X.lineTo(cx - s * 14, WY + WH + 6); X.closePath(); K.ink('#ff7c9c', 3.5);
        X.strokeStyle = '#e8577c'; X.lineWidth = 3; X.beginPath(); X.moveTo(cx + s * 8, WY - 10); X.quadraticCurveTo(cx + s * 4, WY + 50, cx + s * 2, WY + WH); X.stroke();
      }
      K.rr(WX - 30, WY - 24, WW + 60, 12, 6); K.ink('#d9944f', 3.5);
    });
  }
  /* a fruit with a face, kind 0 apple / 1 melon / 2 lemon / 3 orange */
  function fruitBody(kd, r) {
    const [b, s] = FR[kd], c = ctx;
    if (kd === 2) { for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 1.12, 0, r * .2, 0, TAU); K.ink(b, 3); } }
    const p = kd === 2 ? K.elP(0, 0, r * 1.12, r * .86) : kd === 1 ? K.elP(0, 0, r * 1.06, r * .96) : K.elP(0, 0, r, r * .96);
    K.cel(p, b, s, 5, 5, 4);
    if (kd === 1) { c.save(); c.clip(p); c.strokeStyle = '#2f8a3f'; c.lineWidth = 5; for (const x of [-18, 0, 18]) { c.beginPath(); c.moveTo(x - 4, -r); c.quadraticCurveTo(x + 6, 0, x - 4, r); c.stroke(); } c.restore(); }
    if (kd === 2 || kd === 3) { c.fillStyle = 'rgba(20,16,28,.12)'; for (const [a1, b1] of [[-14, 12], [12, 16], [18, -6], [-4, 20], [-20, -2]]) { c.beginPath(); c.arc(a1, b1, 1.6, 0, TAU); c.fill(); } }
    K.glint(p, -r * .42, -r * .48, r * .3, r * .17, 'rgba(255,255,255,.6)', -.6);
    if (kd === 0 || kd === 3) {
      K.line([[0, -r * .8], [3, -r * 1.2]], 3, '#8a5a34');
      c.save(); c.translate(r * .3, -r * 1.02); c.rotate(-.5); K.el(0, 0, r * .34, r * .15); K.ink('#5fd068', 2.5); c.restore();
    }
  }
  function face(r, mood, lx, ly, k) {
    const c = ctx, ey = -r * .1;
    if (mood !== 'happy' && mood !== 'dead') { c.fillStyle = 'rgba(255,110,165,.55)'; K.el(-r * .56, r * .22, r * .17, r * .1); c.fill(); K.el(r * .56, r * .22, r * .17, r * .1); c.fill(); }
    K.eye(-r * .32, ey, r * .23, mood, lx, ly, k); K.eye(r * .32, ey, r * .23, mood, lx, ly, k + 1);
    c.strokeStyle = INK; c.lineWidth = 3.5; c.lineCap = 'round';
    if (mood === 'panic') { K.el(0, r * .42, r * .16, r * .2); K.ink(INK, 0); c.fillStyle = '#ff7c9c'; K.el(0, r * .5, r * .1, r * .07); c.fill(); }
    else if (mood === 'dead') { c.beginPath(); c.moveTo(-r * .2, r * .45); c.lineTo(r * .2, r * .4); c.stroke(); }
    else { c.beginPath(); c.arc(0, r * .26, r * .18, .3, Math.PI - .3); c.stroke(); }
  }
  function bomb(it, T, lx, ly, done) {
    const c = ctx, r = 30;
    c.save(); c.translate(it.x, it.y); c.rotate(Math.sin(T * 7 + it.at * 9) * .08);
    K.line([[0, -r - 4], [6, -r - 16], [14, -r - 20]], 4, '#c9a46a');
    K.rr(-10, -r - 8, 20, 12, 4); K.ink('#8f88a6', 3);
    const p = K.elP(0, 0, r, r); K.cel(p, '#3b3550', '#231d33', 5, 5, 4); K.glint(p, -12, -14, 9, 5, 'rgba(255,255,255,.45)', -.6);
    // angry face: brows, eyes that track the knife, a toothy grin
    c.strokeStyle = INK; c.lineWidth = 4.5; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 18, -14); c.lineTo(s * 4, -8); c.stroke(); }
    K.eye(-10, -2, 6, done ? 'happy' : null, lx, ly, it.at); K.eye(10, -2, 6, done ? 'happy' : null, lx, ly, it.at);
    c.beginPath(); c.moveTo(-14, 10); c.quadraticCurveTo(0, 22, 14, 10); c.closePath(); K.ink('#fff', 2.5);
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, 11); c.lineTo(-5, 16); c.moveTo(5, 11); c.lineTo(5, 16); c.stroke();
    c.restore();
    star(it.x + 14, it.y - r - 20, 10 + Math.sin(T * 30) * 3, 4, 6, T * 9, '#FFE14D', 2);
    star(it.x + 14, it.y - r - 20, 4, 2, 4, -T * 12, '#fff', 0);
  }
  function half(kd, r, side) {      // one half of a cut fruit, flesh side showing
    const c = ctx, [b, s, l, fl] = FR[kd];
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI); c.closePath(); K.ink(kd === 1 ? '#5cc95a' : b, 4);
    c.beginPath(); c.arc(0, 0, r * (kd === 1 ? .78 : .86), 0, Math.PI); c.closePath(); c.fillStyle = kd === 1 ? l : fl; c.fill();
    if (kd === 1) { c.beginPath(); c.arc(0, 0, r * .68, 0, Math.PI); c.closePath(); c.fillStyle = fl; c.fill(); c.fillStyle = INK; for (const [a1, b1] of [[-10, 8], [0, 14], [10, 8], [-16, 4], [16, 4]]) { K.el(a1, b1, 1.8, 2.8); c.fill(); } }
    else if (kd === 0) { c.fillStyle = '#7a4a2a'; K.el(-5, 6, 2.2, 3.5, .3); c.fill(); K.el(5, 6, 2.2, 3.5, -.3); c.fill(); }
    else { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; for (let i = 1; i < 6; i++) { const a = i / 6 * Math.PI; c.beginPath(); c.moveTo(0, 2); c.lineTo(Math.cos(a) * r * .8, Math.sin(a) * r * .8); c.stroke(); } }
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke();
    c.fillStyle = side ? s : 'rgba(255,255,255,.4)'; c.globalAlpha = .35; c.beginPath(); c.arc(0, 0, r, .1, .9); c.lineTo(0, 0); c.fill(); c.globalAlpha = 1;
  }
  function stain(st, T) {           // juice on the tiles: a blob with drips that run down
    const c = ctx, y = Math.min(st.y, 430), age = T - st.t;
    c.globalAlpha = st.soot ? .55 : .5; c.fillStyle = st.soot ? '#2b2440' : st.col;
    for (let i = 0; i < 6; i++) { const a = i * 1.9 + st.x * .01; c.beginPath(); c.arc(st.x + Math.cos(a) * 22, y + Math.sin(a) * 16, (st.soot ? 24 : 12) + (i % 3) * 4, 0, TAU); c.fill(); }
    c.beginPath(); c.arc(st.x, y, st.soot ? 34 : 20, 0, TAU); c.fill();
    if (!st.soot) for (let i = 0; i < 3; i++) { const dx = st.x - 14 + i * 14, L = Math.min(40 + i * 8, age * (30 + i * 10)); c.fillRect(dx - 2.5, y + 6, 5, L); c.beginPath(); c.arc(dx, y + 6 + L, 4, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
  function chef(x, y, T, st) {      // Claude the juice-bar chef, standing on the counter
    const u = 6, c = ctx, won = st === 'win', soot = st === 'boom', sad = st === 'miss' || soot, scared = st === 'scared';
    const jump = won ? Math.abs(Math.sin(T * 9)) * 16 : 0, br = 1 + Math.sin(T * 3.1) * .025;
    shadow(x, y + 2, 34, 6, .3);
    c.save(); c.translate(x, y - jump); c.scale(2 - br, br);
    if (won) K.arms(u, -.4 + Math.sin(T * 14) * .2, .4 - Math.sin(T * 14) * .2);
    else if (scared) K.arms(u, -1.1, 1.1);
    else if (!sad) K.arms(u, null, .9 + Math.sin(T * 4) * .25);
    claude(0, 0, u, { mood: won ? 'happy' : sad ? 'sad' : null, col: soot ? '#4a3f55' : OR });
    // chef's toque (blackened and knocked crooked by the blast)
    c.save(); c.translate(0, -9 * u); c.rotate(soot ? -.35 : 0);
    const hc = soot ? '#6b6378' : '#fff';
    for (const [a1, b1, r1] of [[-2.6, -3.2, 2.4], [2.6, -3.2, 2.4], [0, -4.2, 2.8]]) { c.beginPath(); c.arc(a1 * u, b1 * u, r1 * u, 0, TAU); K.ink(null, 3); }
    for (const [a1, b1, r1] of [[-2.6, -3.2, 2.4], [2.6, -3.2, 2.4], [0, -4.2, 2.8]]) { c.beginPath(); c.arc(a1 * u, b1 * u, r1 * u, 0, TAU); c.fillStyle = hc; c.fill(); }
    K.rr(-4.4 * u, -2 * u, 8.8 * u, 2.2 * u, 4); K.ink(hc, 3); c.fillStyle = soot ? 'rgba(0,0,0,.2)' : 'rgba(170,190,220,.5)'; c.fillRect(-4.4 * u, -.5 * u, 8.8 * u, .7 * u);
    c.restore(); c.restore();
    if (scared || st === 'miss') K.sweat(x + 6 * u, y - 10 * u, 1, (T * 1.6) % 1);
    if (soot) for (let i = 0; i < 3; i++) { const k = (T * .8 + i / 3) % 1; c.globalAlpha = (1 - k) * .7; c.beginPath(); c.arc(x - 16 + i * 16 + Math.sin(T * 3 + i) * 6, y - 14 * u - k * 50, 7 + k * 10, 0, TAU); c.fillStyle = '#8f88a6'; c.fill(); c.globalAlpha = 1; }
    if (won) for (let h = 0; h < 3; h++) { const hk = (T * .9 + h / 3) % 1; K.heart(x - 30 + h * 30 + Math.sin(T * 4 + h) * 6, y - 14 * u - hk * 80, .8, 1 - hk); }
  }
  function blender(x, y, T, fill, cuts, st, look) {
    const c = ctx, won = st === 'win', wob = won ? Math.sin(T * 60) * 2.5 : 0;
    c.save(); c.translate(x + wob, y);
    // jar: glass, juice level, swirl when blending
    const jar = new Path2D('M-36 -150 L36 -150 L26 -50 L-26 -50 Z');
    K.inkP(jar, 'rgba(225,245,255,.75)', 4);
    if (fill > 0) {
      c.save(); c.clip(jar);
      // one wavy band per cut fruit, in that fruit's juice colour (highest first, lower bands paint over)
      for (let i = Math.min(cuts.length, 3) - 1; i >= 0; i--) {
        const lv = Math.min(fill, (i + 1) / 3), bt = -50 - 100 * lv;
        if (lv <= i / 3) continue;
        c.fillStyle = FR[cuts[i].kd][4]; c.beginPath(); c.moveTo(-40, -50); for (let xx = -40; xx <= 40; xx += 8) c.lineTo(xx, bt + Math.sin(xx * .15 + T * (won ? 18 : 4) + i * 2) * (won ? 6 : 2)); c.lineTo(40, -50); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(20,16,28,.18)'; c.lineWidth = 2; c.stroke();
      }
      if (won) { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, -70 - i * 22, 20 - i * 3, 5, 0, T * 20 + i, T * 20 + i + 3); c.stroke(); } }
      c.restore();
    }
    c.save(); c.clip(jar); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-26, -146, 7, 90); c.restore();
    K.inkP(jar, null, 4);
    // lid hops while blending
    const hop = won ? Math.abs(Math.sin(T * 22)) * 16 : 0;
    c.save(); c.translate(0, -hop); K.rr(-40, -162, 80, 14, 6); K.ink('#3b3550', 3.5); K.rr(-9, -172, 18, 12, 4); K.ink('#5a5274', 3); c.restore();
    // base with a face
    const base = K.rrP(-40, -52, 80, 52, 14); K.cel(base, '#a48fdc', '#7a63b9', 4, 5, 4); K.glint(base, -22, -42, 14, 5);
    const mood = won ? 'happy' : st === 'boom' ? 'dead' : st === 'miss' ? 'sleepy' : st === 'scared' ? 'panic' : null;
    K.eye(-14, -30, 7, mood, look[0], look[1], 3); K.eye(14, -30, 7, mood, look[0], look[1], 4);
    c.strokeStyle = INK; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath();
    if (won) { c.moveTo(-9, -16); c.quadraticCurveTo(0, -6, 9, -16); }
    else if (st === 'miss' || st === 'boom') { c.moveTo(-8, -10); c.quadraticCurveTo(0, -18, 8, -10); }
    else { c.arc(0, -16, 5, .2, Math.PI - .2); }
    c.stroke();
    c.fillStyle = 'rgba(255,110,165,.55)'; K.el(-26, -18, 5, 3); c.fill(); K.el(26, -18, 5, 3); c.fill();
    c.restore();
    if (won) { for (let i = 0; i < 3; i++) { const k = (T * 2 + i / 3) % 1; star(x + (i - 1) * 46, y - 120 - k * 70, 8 * Math.sin(k * Math.PI), 3, 4, 0, '#FFE14D', 2); } K.line([[x - 54, y - 70], [x - 66, y - 74]], 3, '#fff'); K.line([[x + 54, y - 70], [x + 66, y - 74]], 3, '#fff'); }
  }
  function cat(x, y, T, st, look) {    // background gag: the shelf cat watches the fruit fly; the blast frizzes it
    const c = ctx, boom = st === 'boom', puff = boom ? 1.12 : 1;
    c.save(); c.translate(x, y);
    const tw = boom ? 0 : Math.sin(T * 2.4) * .6;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(18, -8); c.quadraticCurveTo(48, -10 + (boom ? -40 : 0), 44 + tw * 20, -40 + (boom ? -20 : 0) + Math.abs(tw) * 8);
    c.strokeStyle = INK; c.lineWidth = 15; c.stroke(); c.strokeStyle = boom ? '#6b6378' : '#ffb347'; c.lineWidth = 8; c.stroke();
    c.scale(puff, puff);
    const body = K.elP(0, -24, 26, 24); K.cel(body, boom ? '#6b6378' : '#ffb347', boom ? '#4a3f55' : '#e0892a', 4, 4, 4);
    if (boom) { c.strokeStyle = INK; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; c.beginPath(); c.moveTo(Math.cos(a) * 26, -24 + Math.sin(a) * 24); c.lineTo(Math.cos(a) * 34, -24 + Math.sin(a) * 32); c.stroke(); } }
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 8, -70); c.lineTo(s * 20, -86); c.lineTo(s * 21, -62); c.closePath(); K.ink(boom ? '#6b6378' : '#ffb347', 3); }
    const head = K.elP(0, -60, 23, 20); K.cel(head, boom ? '#6b6378' : '#ffb347', boom ? '#4a3f55' : '#e0892a', 3, 4, 4);
    c.fillStyle = boom ? '#4a3f55' : '#e0892a'; c.fillRect(-3, -79, 6, 8);
    K.eye(-9, -62, 5.5, boom ? 'panic' : st === 'win' ? 'happy' : st === 'idle' ? 'sleepy' : null, look[0], look[1], 7);
    K.eye(9, -62, 5.5, boom ? 'panic' : st === 'win' ? 'happy' : st === 'idle' ? 'sleepy' : null, look[0], look[1], 8);
    c.fillStyle = '#ff7c9c'; c.beginPath(); c.moveTo(-3, -53); c.lineTo(3, -53); c.lineTo(0, -50); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 10, -52); c.lineTo(s * 26, -55); c.moveTo(s * 10, -49); c.lineTo(s * 26, -47); c.stroke(); }
    c.restore();
  }
  function sign(cuts, T) {          // a wooden sign hanging at the top: 3 plates, each gets the fruit you cut
    const c = ctx, x0 = 322, y0 = 64, w = 156, h = 58, sw = Math.sin(T * 1.3) * .015, cx = x0 + w / 2;
    c.save(); c.translate(cx, 0); c.rotate(sw); c.translate(-cx, 0);
    for (const rx of [x0 + 26, x0 + w - 26]) {          // short ropes from wall hooks, kept below the hint zone (y < 58)
      c.strokeStyle = INK; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(rx, 58); c.lineTo(rx, y0 + 6); c.stroke(); c.strokeStyle = '#e6c58c'; c.lineWidth = 3.5; c.stroke();
      c.beginPath(); c.arc(rx, 56, 4, 0, TAU); K.ink('#c9ced6', 2.5);
    }
    K.rr(x0, y0 + 5, w, h, 16); K.ink('#a5622c', 5); K.rr(x0, y0, w, h, 16); K.ink('#d9944f', 0); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    c.save(); K.rr(x0, y0, w, h, 16); c.clip(); c.fillStyle = '#c98443'; c.fillRect(x0, y0 + h / 2 - 2, w, 3); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x0, y0 + 4, w, 6); c.restore();
    for (let i = 0; i < 3; i++) {
      const px = x0 + 30 + i * 48, py = y0 + h / 2 + 1, cut = cuts[i], k = cut ? K.outBack((T - cut.t) / .3) : 0;
      c.fillStyle = 'rgba(20,16,28,.25)'; c.beginPath(); c.arc(px, py + 3, 19, 0, TAU); c.fill();
      c.beginPath(); c.arc(px, py, 19, 0, TAU); K.ink(cut ? '#fffaf0' : '#f1e3c8', 3.5);
      c.strokeStyle = 'rgba(20,16,28,.16)'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 13, 0, TAU); c.stroke();
      if (cut && k > 0) { c.save(); c.translate(px, py + 4); c.scale(.5 * k, .5 * k); c.rotate(-.3); half(cut.kd, 26, 0); c.restore(); }
    }
    c.restore();
  }
  function draw(s) {
    const { g, items, trail, cuts, stains, booms, resAt, sliced, sp } = s, T = now;
    if (KW !== VW || !BG) build();
    K.use(ctx);
    ctx.drawImage(BG, -OX, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(WX, WY, WW, WH); ctx.clip();
    K.cloud(WX + ((T * 12) % (WW + 120)) - 70, WY + 34, .55); K.cloud(WX + ((T * 7 + 90) % (WW + 120)) - 70, WY + 62, .4);
    K.bird(WX + ((T * 30) % (WW + 60)) - 30, WY + 50 + Math.sin(T * 2) * 4, Math.sin(T * 10) * 4);
    ctx.restore();
    ctx.drawImage(OVR, -OX, 0);
    for (const st of stains) stain(st, T);
    // the wall clock spins way too fast (time flies when you're slicing)
    K.line([[612, 120], [612 + Math.cos(T * 6) * 15, 120 + Math.sin(T * 6) * 15]], 2.5, '#ff5a4f'); K.line([[612, 120], [612 + Math.cos(T * .5) * 10, 120 + Math.sin(T * .5) * 10]], 3, INK);
    const live = items.filter(it => it.on && !it.gone), bombUp = !g.result && live.some(it => it.k === 'b');
    const boom = booms.length > 0, st = g.result === 'win' ? 'win' : boom ? 'boom' : g.result ? 'miss' : bombUp ? 'scared' : live.length ? 'watch' : 'idle';
    const tgt = live[0] || { x: mouse.x, y: mouse.y }, lookAt = (x, y) => { const dx = tgt.x - x, dy = tgt.y - y, m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
    const cx = W + OX - 150, bx = W + OX - 92;
    cat(cx, 244, T, st, lookAt(cx, 182));
    sign(cuts, T);
    chef(-OX + 82, 492, T, st);
    const lastT = cuts.length ? cuts[cuts.length - 1].t : 0;
    const fill = (Math.max(0, sliced - 1) + K.clamp((T - lastT) / .35, 0, 1) * (sliced ? 1 : 0)) / 3;
    blender(bx, 492, T, Math.min(1, fill), cuts, st, lookAt(bx, 462));
    // cut halves tumble apart with the slash
    for (const it of items) if (it.cut) {
      const d = (T - it.cut.t) * Math.min(sp, 1.6), nx = -Math.sin(it.cut.a), ny = Math.cos(it.cut.a);
      for (const side of [0, 1]) {
        const sg = side ? 1 : -1, hx = it.x + (it.cut.vx * .35 + nx * sg * 150) * d, hy = it.y + (it.cut.vy * .25 + ny * sg * 150) * d + 1300 * d * d;
        if (hy > 700) continue;
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(it.cut.a + (side ? Math.PI : 0) + sg * d * 5); half(it.cut.kd, 30, side); ctx.restore();
      }
    }
    const drop = resAt == null ? 0 : 900 * (T - resAt) * (T - resAt);          // outro: what was still flying falls out of frame (draw only)
    for (const it0 of live) {
      if (it0.y + drop > 640) continue;
      const it = drop ? { ...it0, y: it0.y + drop } : it0;
      const [lx, ly] = [mouse.x - it.x, mouse.y - it.y], dm = Math.hypot(lx, ly);
      if (it.k === 'b') { bomb(it, T, lx, ly, !!g.result); continue; }
      const kd = Math.max(0, COLS.indexOf(it.c)), mood = boom ? 'dead' : g.result ? 'happy' : dm < 140 ? 'panic' : null;
      ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.sin(T * 5 + it.at * 7) * .12);
      fruitBody(kd, 30); face(30, mood, lx, ly, it.at * 9);
      ctx.restore();
      if (mood === 'panic') K.sweat(it.x + 30, it.y - 24, .9, (T * 2 + it.at) % 1);
    }
    // the bomb blast: flash star, then soot clouds rolling up
    for (const b of booms) {
      const d = T - b.t;
      if (d < .3) { const k = K.outBack(d / .12); star(b.x, b.y, 90 * k, 40 * k, 10, d * 3, '#FFE14D', 4); star(b.x, b.y, 50 * k, 22 * k, 10, -d * 3, '#ff8c42', 0); }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + .3, r = 30 + d * 90, k = K.clamp(1 - d / 1.4, 0, 1);
        if (k <= 0) continue;
        ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r * .7 - d * 60, 22 + d * 26, 0, TAU); K.ink(i % 2 ? '#8f88a6' : '#6b6378', 3); ctx.globalAlpha = 1;
      }
    }
    // the knife swoosh: ink under white, like every other line in the scene
    if (trail.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = Math.min(1, trail[i].l * 4), w = 3 + trail[i].l * 36;
        ctx.strokeStyle = `rgba(20,16,28,${a * .55})`; ctx.lineWidth = w + 7; ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      for (let i = 1; i < trail.length; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, trail[i].l * 4)})`; ctx.lineWidth = 3 + trail[i].l * 36;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }
  return { draw, COLS };
})();
function gSlice(sp) {
  const kinds = ['f', 'f', 'f', 'f', 'b', 'b'].sort(() => Math.random() - .5);
  const cols = ['#ff4d4d', '#9be564', '#ffd23f', '#ff8c42'];
  const items = kinds.map((k, i) => {
    const x = 160 - OX + Math.random() * (480 + 2 * OX);
    return { k, x, y: 560, vx: (W / 2 - x) * .45 + (Math.random() - .5) * 120, vy: -(930 + Math.random() * 80), at: .2 + i * .5 / sp, c: cols[i % 4] };
  });
  const trail = []; let prev = null, clock = 0, sliced = 0;
  const cuts = [], stains = [], booms = []; let resAt = null;          // art only (what got cut, where the juice went)
  const g = {
    cmd: 'SLICE!', hint: 'SWIPE FRUIT, NOT BOMBS', thint: 'SWIPE THE FRUIT', dur: 5, wide: true,
    move(p) {
      if (!prev) prev = p;
      trail.push({ x: p.x, y: p.y, l: .25 });
      if (!g.result) for (const it of items) {
        if (!it.on || it.gone) continue;
        if (segD(it.x, it.y, prev.x, prev.y, p.x, p.y) < 30) {
          it.gone = true;
          if (it.k === 'b') { booms.push({ x: it.x, y: it.y, t: now }); stains.push({ x: it.x, y: it.y, t: now, soot: 1 }); }
          else { const kd = Math.max(0, cols.indexOf(it.c)); it.cut = { t: now, a: Math.atan2(p.y - prev.y, p.x - prev.x) || 0, vx: it.vx, vy: it.vy, kd }; cuts.push({ kd, t: now }); stains.push({ x: it.x, y: it.y, t: now, col: ['#ff6b7a', '#ff5c7a', '#ffe14d', '#ff9a3c'][kd] }); }
          if (it.k === 'b') { g.result = 'lose'; confetti(it.x, it.y, 25); sfx.splat(); sfx.thud(); sfx.buzz(); shake(12, .35); ring(it.x, it.y, '#FFE14D', 130); }
          else { sliced++; confetti(it.x, it.y, 10); sfx.whoosh(false); sfx.hit(); sfx.blip(sliced * 3); burst(it.x, it.y, it.c, 12, 300); floatText('+1', it.x, it.y - 30, '#fff', 34); shake(3, .1); if (sliced >= 3) { g.result = 'win'; sfx.sparkle(); } }
        }
      }
      prev = p;
    },
    update(dt) {
      for (let i = trail.length - 1; i >= 0; i--) if ((trail[i].l -= dt) <= 0) trail.splice(i, 1);
      if (g.result && resAt == null) resAt = now;                    // art only
      if (g.result) return;
      clock += dt; const s = dt * sp;
      for (const it of items) {
        if (!it.on && clock >= it.at) it.on = true;
        if (!it.on || it.gone) continue;
        it.vy += 1400 * s; it.x += it.vx * s; it.y += it.vy * s;
        if (it.y > 600 && it.vy > 0) it.gone = true;
      }
      if (sliced + items.filter(i => i.k === 'f' && !i.gone).length < 3) g.result = 'lose';
    },
    draw(t) { W2SLICE.draw({ g, items, trail, cuts, stains, booms, resAt, sliced, sp }); }
  };
  return g;
}

/* 11 ── COPY: press the arrows in order (arrow keys or WASD)
   Scene: the throne room of Keyboard Kingdom. The King (a big keycap in a crown and a curly moustache) points his sceptre at
   the royal dance scroll; Claude the court dancer, in a sweatband, copies every move on the palace dance pad while the royal
   corgi chases its own tail. Win: the King laughs and claps, roses fly, a wax seal stamps the scroll. Fail: the King goes red
   and lobs a tomato at Claude's face. */
const W2COPY = (() => {
  const K = W2K, TAU = Math.PI * 2, KX = 690, CX = 400, CY = 474, VY = 140;
  let BG = null, KW = -1;
  const PAD = [[3, 262, 494, 84, 30], [0, 352, 512, 84, 32], [2, 448, 512, 84, 32], [1, 538, 494, 84, 30]];   // dir, x, y, w, h (a DDR row: left, up, down, right)
  const fx = (xb, y) => 400 + (xb - 400) * (y - VY) / (600 - VY);                 // floor ray through xb at the bottom
  function build() {
    KW = VW;
    BG = K.layer(X => {
      // lilac castle wall with stone blocks (gradients are fine on walls)
      const wg = X.createLinearGradient(0, 0, 0, 330); wg.addColorStop(0, '#c9b4f2'); wg.addColorStop(1, '#f0d6f7');
      X.fillStyle = wg; X.fillRect(-OX, 0, VW, 330);
      X.strokeStyle = 'rgba(110,70,170,.16)'; X.lineWidth = 3;
      for (let y = 84, r = 0; y < 300; y += 34, r++) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); for (let x = -OX + (r % 2) * 40; x < W + OX; x += 80) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 34); X.stroke(); } }
      // gold moulding under the ceiling (below the hint line)
      K.rr(-OX - 10, 60, VW + 20, 14, 6); K.ink('#ffd23f', 3.5); X.fillStyle = '#c99512'; X.fillRect(-OX, 69, VW, 4); X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(-OX, 63, VW, 3);
      // a tall arched window on the left (sky inside, clouds drift through it live)
      const win = new Path2D(); win.moveTo(22, 300); win.lineTo(22, 132); win.arc(62, 132, 40, Math.PI, 0); win.lineTo(102, 300); win.closePath();
      X.lineWidth = 14; X.strokeStyle = INK; X.stroke(win); X.lineWidth = 8; X.strokeStyle = '#e3d6f5'; X.stroke(win);
      const sg = X.createLinearGradient(0, 92, 0, 300); sg.addColorStop(0, '#36b0ea'); sg.addColorStop(.6, '#86d8fb'); sg.addColorStop(1, '#d6f7ff'); X.fillStyle = sg; X.fill(win);
      X.save(); X.clip(win); X.fillStyle = '#87d19b'; K.el(40, 300, 70, 34); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke(); X.restore();
      // wide screens: royal banners on the extra wall
      for (const bx of [-60, 860]) {
        X.beginPath(); X.moveTo(bx - 34, 80); X.lineTo(bx + 34, 80); X.lineTo(bx + 34, 250); X.lineTo(bx, 226); X.lineTo(bx - 34, 250); X.closePath(); K.ink('#6EA8FE', 4);
        X.fillStyle = '#4a7fd6'; X.fillRect(bx + 22, 84, 10, 150);
        X.beginPath(); X.moveTo(bx - 18, 160); X.lineTo(bx - 18, 136); X.lineTo(bx - 8, 148); X.lineTo(bx, 132); X.lineTo(bx + 8, 148); X.lineTo(bx + 18, 136); X.lineTo(bx + 18, 160); X.closePath(); K.ink('#ffd23f', 3);
        K.rr(bx - 44, 72, 88, 12, 6); K.ink('#d9944f', 3);
      }
      // wooden wainscot
      K.rr(-OX - 10, 286, VW + 20, 46, 4); K.ink('#d9944f', 4); X.fillStyle = '#a5622c'; X.fillRect(-OX, 322, VW, 6); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(-OX, 291, VW, 4);
      X.strokeStyle = '#b06d33'; X.lineWidth = 3; for (let x = -OX + 20; x < W + OX; x += 70) { K.rr(x, 298, 50, 20, 4); X.stroke(); }
      // the throne (gold frame, red velvet)
      const back = K.rrP(KX - 78, 222, 156, 230, 30);
      X.fillStyle = 'rgba(20,16,28,.25)'; X.save(); X.translate(6, 8); X.fill(back); X.restore();
      K.cel(back, '#ffd23f', '#c99512', 5, 0, 5); K.glint(back, KX - 46, 250, 18, 30, 'rgba(255,255,255,.5)');
      K.cel(K.rrP(KX - 58, 242, 116, 196, 22), '#e8434f', '#b8283a', 4, 0, 3.5);
      X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { X.beginPath(); X.arc(KX - 34 + i * 34, 270 + j * 44, 4, 0, TAU); X.fill(); }
      for (const s of [-1, 1]) { X.beginPath(); X.arc(KX + s * 70, 222, 13, 0, TAU); K.ink('#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.6)'; K.el(KX + s * 70 - 4, 218, 4, 3, -.5); X.fill(); }
      X.beginPath(); X.moveTo(KX - 22, 228); X.lineTo(KX - 22, 204); X.lineTo(KX - 10, 216); X.lineTo(KX, 196); X.lineTo(KX + 10, 216); X.lineTo(KX + 22, 204); X.lineTo(KX + 22, 228); X.closePath(); K.ink('#ffd23f', 4);
      X.beginPath(); X.arc(KX, 216, 5, 0, TAU); K.ink('#6EA8FE', 2);
      // floor: hard ink horizon, pink checker tiles in perspective, the red carpet
      const fg = X.createLinearGradient(0, 330, 0, 600); fg.addColorStop(0, '#f6b8dc'); fg.addColorStop(1, '#ffe3f2'); X.fillStyle = fg; X.fillRect(-OX, 330, VW, 270);
      const rows = []; for (let k = 0; k <= 7; k++) rows.push(330 + 270 * Math.pow(k / 7, 1.5));
      for (let r = 0; r < 7; r++) for (let c = -12; c < 12; c++) {
        if ((r + c) % 2 === 0) continue; const y1 = rows[r], y2 = rows[r + 1], a = 400 + c * 110, b = a + 110;
        X.beginPath(); X.moveTo(fx(a, y1), y1); X.lineTo(fx(b, y1), y1); X.lineTo(fx(b, y2), y2); X.lineTo(fx(a, y2), y2); X.closePath(); X.fillStyle = 'rgba(255,255,255,.55)'; X.fill();
      }
      X.strokeStyle = 'rgba(160,60,120,.18)'; X.lineWidth = 2; for (const y of rows) { X.beginPath(); X.moveTo(-OX, y); X.lineTo(W + OX, y); X.stroke(); }
      X.beginPath(); X.moveTo(fx(260, 330), 330); X.lineTo(fx(540, 330), 330); X.lineTo(fx(540, 600), 600); X.lineTo(fx(260, 600), 600); X.closePath(); X.fillStyle = '#e8434f'; X.fill();
      X.fillStyle = 'rgba(184,40,58,.55)'; X.beginPath(); X.moveTo(fx(470, 330), 330); X.lineTo(fx(540, 330), 330); X.lineTo(fx(540, 600), 600); X.lineTo(fx(470, 600), 600); X.closePath(); X.fill();
      for (const xb of [260, 540]) { X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.moveTo(fx(xb, 330), 330); X.lineTo(fx(xb, 600), 600); X.stroke(); X.strokeStyle = '#ffd23f'; X.lineWidth = 4; X.stroke(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-OX, 330); X.lineTo(W + OX, 330); X.stroke();
      // throne seat + legs (in front of the back, behind the King)
      for (const s of [-1, 1]) { K.rr(KX + s * 56 - 9, 440, 18, 74, 5); K.ink('#c99512', 4); }
      X.fillStyle = 'rgba(20,16,28,.25)'; K.el(KX, 516, 90, 12); X.fill();
      K.cel(K.rrP(KX - 76, 430, 152, 34, 14), '#e8434f', '#b8283a', 0, 5, 4); K.rr(KX - 80, 456, 160, 14, 6); K.ink('#ffd23f', 3.5);
      // the royal dance pad (base slab, perspective-squashed cross)
      X.fillStyle = 'rgba(20,16,28,.28)'; K.el(CX, 504, 214, 46); X.fill();
      const pad = new Path2D(); pad.ellipse(CX, 496, 204, 46, 0, 0, TAU);
      K.cel(pad, '#8f9cb3', '#5f6a84', 0, 6, 4); K.glint(pad, CX - 100, 466, 80, 9, 'rgba(255,255,255,.3)', -.05);
      // the royal corgi's velvet cushion
      X.fillStyle = 'rgba(20,16,28,.22)'; K.el(150, 536, 76, 12); X.fill();
      K.cel(K.elP(150, 524, 72, 18), '#6EA8FE', '#4a7fd6', 0, 4, 3.5); for (const s of [-1, 1]) { X.beginPath(); X.arc(150 + s * 70, 526, 6, 0, TAU); K.ink('#ffd23f', 2.5); }
    });
  }
  /* keycap King: x/feet y, mood: idle|cross|late|win|lose, look = card x he points at */
  function king(T, mood, lookX, rt, clap) {
    const c = ctx, br = Math.sin(T * 3.1) * .02, hop = mood === 'win' ? Math.abs(Math.sin(T * 8)) * 10 : 0, by = 448 - hop;
    c.save(); c.translate(KX, by); c.scale(1 - br, 1 + br);
    // legs dangling off the throne (they kick on a win)
    for (const s of [-1, 1]) { const sw = mood === 'win' ? Math.sin(T * 14 + s) * .4 : mood === 'late' && s > 0 ? Math.sin(T * 16) * .25 : 0; c.save(); c.translate(s * 26, -6); c.rotate(sw); K.line([[0, 0], [0, 34]], 8, '#f6f4fb'); K.el(s * 6, 40, 13, 8); K.ink('#6EA8FE', 3); c.restore(); }
    // ermine cape
    c.beginPath(); c.moveTo(-70, -6); c.quadraticCurveTo(-82, -70, -40, -110); c.lineTo(40, -110); c.quadraticCurveTo(82, -70, 70, -6); c.closePath(); K.ink('#e8434f', 4);
    c.fillStyle = '#b8283a'; c.beginPath(); c.moveTo(56, -100); c.quadraticCurveTo(80, -60, 70, -10); c.lineTo(60, -10); c.closePath(); c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 66, -14); c.quadraticCurveTo(s * 78, -64, s * 42, -104); c.strokeStyle = INK; c.lineWidth = 15; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 8; c.stroke(); c.fillStyle = INK; for (const k of [.25, .6]) c.fillRect(s * (66 + 6 * Math.sin(k * 3)) - 1.5 - s * k * 22, -20 - k * 70, 3, 6); }
    // the keycap body: outer skirt (shade) + dished top face
    const body = K.rrP(-62, -118, 124, 118, 24); K.cel(body, '#ece8f6', '#b9b2cf', 0, 6, 5);
    const top = K.rrP(-50, -112, 100, 92, 18); K.inkP(top, '#fbfaff', 2.5); K.glint(top, -24, -100, 22, 8, 'rgba(255,255,255,.9)');
    const red = mood === 'lose' ? Math.min(1, rt * 4) : mood === 'cross' ? .55 : 0;
    if (red) { c.save(); c.clip(top); c.fillStyle = `rgba(255,77,94,${red * .45})`; c.fillRect(-60, -120, 120, 110); c.restore(); }
    // the little legend letter in the corner (drawn, not text)
    c.strokeStyle = '#9a93b4'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-40, -104); c.lineTo(-40, -86); c.moveTo(-31, -104); c.lineTo(-40, -95); c.lineTo(-31, -86); c.stroke();
    // face
    const lx = K.clamp((lookX - KX) / 200, -1, 1), ly = -.6;
    const em = mood === 'win' ? 'happy' : mood === 'lose' ? null : mood === 'late' ? null : null;
    for (const s of [-1, 1]) {
      K.eye(s * 20, -76, 11, em, mood === 'lose' ? 0 : lx, mood === 'lose' ? .2 : ly, s);
      c.strokeStyle = INK; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath();
      if (mood === 'cross' || mood === 'lose') { c.moveTo(s * 32, -96); c.lineTo(s * 9, -88); }
      else if (mood === 'late') { c.moveTo(s * 31, -92 + (s > 0 ? -2 : 3)); c.lineTo(s * 10, -94 + (s > 0 ? -5 : 2)); }
      else if (mood === 'win') { c.moveTo(s * 30, -96); c.quadraticCurveTo(s * 20, -102, s * 10, -96); }
      else { c.moveTo(s * 30, -91 - (s > 0 ? 6 : 0)); c.lineTo(s * 10, -93 - (s > 0 ? 4 : 0)); }
      c.stroke();
    }
    c.fillStyle = 'rgba(255,110,165,.5)'; for (const s of [-1, 1]) { K.el(s * 33, -58, 8, 5); c.fill(); }
    // mouth (under the moustache)
    if (mood === 'win') { c.beginPath(); c.moveTo(-14, -48); c.quadraticCurveTo(0, -24, 14, -48); c.closePath(); K.ink('#b8283a', 2.5); c.fillStyle = '#ff8fa8'; K.el(0, -36, 6, 4); c.fill(); }
    else if (mood === 'lose' || mood === 'cross') { c.beginPath(); c.moveTo(-12, -36); c.quadraticCurveTo(0, -46, 12, -36); c.strokeStyle = INK; c.lineWidth = 4; c.stroke(); }
    else { c.beginPath(); c.moveTo(-6, -40); c.lineTo(6, -40); c.strokeStyle = INK; c.lineWidth = 4; c.stroke(); }
    // curly moustache (twitches)
    const tw = mood === 'cross' ? Math.sin(T * 40) * 3 : Math.sin(T * 2.3) * 1.5;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, -54); c.quadraticCurveTo(s * 20, -62 + tw, s * 30, -50); c.quadraticCurveTo(s * 38, -42, s * 30, -40 - tw); c.quadraticCurveTo(s * 34, -48, s * 24, -50); c.quadraticCurveTo(s * 12, -52, 0, -46); c.closePath(); K.ink('#5a3a2a', 2.5); }
    // ermine collar
    // crown (hops on a win, flies up on a rage)
    const ch = mood === 'win' ? Math.abs(Math.sin(T * 8 + .6)) * 14 : mood === 'lose' ? Math.min(1, rt * 5) * 16 : 0;
    c.save(); c.translate(0, -118 - ch); c.rotate(mood === 'lose' ? Math.sin(T * 30) * .08 : -.06);
    c.beginPath(); c.moveTo(-34, 6); c.lineTo(-38, -30); c.lineTo(-18, -12); c.lineTo(0, -38); c.lineTo(18, -12); c.lineTo(38, -30); c.lineTo(34, 6); c.closePath(); K.ink('#ffd23f', 4);
    c.fillStyle = '#c99512'; c.fillRect(-34, -2, 68, 6); c.fillStyle = 'rgba(255,255,255,.5)'; K.el(-20, -14, 4, 7, -.4); c.fill();
    for (const [gx, gc] of [[-20, '#ff4d5e'], [0, '#6EA8FE'], [20, '#4fd06a']]) { c.beginPath(); c.arc(gx, -3, 5, 0, TAU); K.ink(gc, 2); }
    c.restore();
    if (mood === 'lose' || mood === 'cross') for (const s of [-1, 1]) { const k = (T * 2.2 + (s > 0 ? .5 : 0)) % 1; c.globalAlpha = 1 - k; c.beginPath(); c.arc(s * (44 + k * 14), -130 - k * 40, 7 + k * 10, 0, TAU); K.ink('#fff', 2.5); c.globalAlpha = 1; }
    c.restore();
    // arms: right hand points the sceptre at the scroll; on a win both hands clap; on a fail the left one throws
    const ay = by - 70;
    if (mood === 'win') { const cl = Math.abs(Math.sin(T * 16)) * 16; K.line([[KX - 58, ay], [KX - 20 - cl, ay - 52]], 10, '#ece8f6'); K.line([[KX + 58, ay], [KX + 20 + cl, ay - 52]], 10, '#ece8f6'); for (const s of [-1, 1]) { c.beginPath(); c.arc(KX + s * (18 + cl), ay - 56, 11, 0, TAU); K.ink('#fff', 3); } if (clap) for (const s of [-1, 1]) K.line([[KX + s * 30, ay - 90], [KX + s * 40, ay - 104]], 2, '#FFE14D'); }
    else {
      const wig = Math.sin(T * (mood === 'late' ? 12 : 2)) * (mood === 'late' ? 6 : 3);
      if (mood !== 'lose') {
        // left hand aims the sceptre at the current card (slides a little toward it, rotates to point)
        const px = KX - 100 + K.clamp((lookX - 560) * .05, -18, 4) + wig, py = ay - 60, hx = px + 16, hy = py + 22;
        const ang = K.clamp(Math.atan2(190 - hy, lookX - hx) + Math.PI / 2, -1.3, -.05) + (mood === 'late' ? Math.sin(T * 12) * .12 : 0);
        K.line([[KX - 58, ay], [hx, hy]], 10, '#ece8f6');
        c.save(); c.translate(hx, hy); c.rotate(ang); K.line([[0, 18], [0, -70]], 5, '#ffd23f'); c.beginPath(); c.arc(0, -76, 11, 0, TAU); K.ink('#6EA8FE', 3); c.fillStyle = 'rgba(255,255,255,.6)'; K.el(-4, -80, 3, 2, -.5); c.fill(); c.restore();
        c.beginPath(); c.arc(hx, hy, 11, 0, TAU); K.ink('#fff', 3);
        K.line([[KX + 58, ay], [KX + 70, ay + 34]], 10, '#ece8f6'); c.beginPath(); c.arc(KX + 70, ay + 38, 11, 0, TAU); K.ink('#fff', 3);
      } else {
        // rage: right fist shakes the sceptre overhead, left hand slings the tomato underhand, low and flat
        const k = Math.min(1, rt / .12), shk2 = Math.sin(T * 30) * 4;
        K.line([[KX + 58, ay], [KX + 64 - 30 * k + shk2, ay - 40 - 20 * k]], 10, '#ece8f6');
        c.save(); c.translate(KX + 64 - 30 * k + shk2, ay - 44 - 20 * k); c.rotate(.35 + Math.sin(T * 30) * .12); K.line([[0, 18], [0, -70]], 5, '#ffd23f'); c.beginPath(); c.arc(0, -76, 11, 0, TAU); K.ink('#6EA8FE', 3); c.restore();
        c.beginPath(); c.arc(KX + 64 - 30 * k + shk2, ay - 44 - 20 * k, 11, 0, TAU); K.ink('#fff', 3);
        const tx2 = KX - 70 - 40 * k, ty2 = ay + 34 - 6 * k;
        K.line([[KX - 58, ay], [tx2, ty2]], 10, '#ece8f6'); c.beginPath(); c.arc(tx2, ty2, 11, 0, TAU); K.ink('#fff', 3);
      }
    }
  }
  function tomato(x, y, r, rot) { const c = ctx; c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.arc(0, 0, r, 0, TAU); K.ink('#ff4d5e', 3); c.fillStyle = 'rgba(255,255,255,.55)'; K.el(-r * .35, -r * .4, r * .3, r * .2, -.5); c.fill(); for (let i = 0; i < 5; i++) { c.save(); c.rotate(i * TAU / 5); c.beginPath(); c.ellipse(0, -r - 3, 3, 6, 0, 0, TAU); K.ink('#4fbf5a', 1.5); c.restore(); } c.restore(); }
  function corgi(T, won) {
    const c = ctx, a = T * 5.5, hop = won ? Math.abs(Math.sin(T * 10)) * 18 : Math.abs(Math.sin(T * 11)) * 3;
    const x = 150 + Math.cos(a) * 22, y = 520 + Math.sin(a) * 5 - hop, dir = won ? 1 : (-Math.sin(a) >= 0 ? 1 : -1);
    c.save(); c.translate(x, y); c.scale(dir * 1.25, 1.25);
    for (const lx of [-16, -6, 8, 18]) { K.rr(lx - 3, -10, 7, 12 + (Math.sin(T * 22 + lx) > 0 ? 0 : -2), 3); K.ink('#f6a04a', 2); }
    K.cel(K.elP(0, -20, 30, 15), '#f6a04a', '#c9762c', 0, 4, 3); c.save(); c.clip(K.elP(0, -20, 30, 15)); c.fillStyle = '#fff'; K.el(4, -8, 22, 8); c.fill(); c.restore();
    c.beginPath(); c.arc(-30, -24, 6, 0, TAU); K.ink('#fff', 2.5);                       // the fluffy butt it keeps chasing
    c.save(); c.translate(26, -32);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 5 - 4, -8); c.lineTo(s * 9 - 2, -26); c.lineTo(s * 12 + 4, -6); c.closePath(); K.ink('#f6a04a', 2.5); }
    K.cel(K.elP(0, 0, 15, 13), '#f6a04a', '#c9762c', 0, 3, 3); K.el(9, 5, 10, 6); K.ink('#fff', 2); c.fillStyle = INK; c.beginPath(); c.arc(18, 3, 3, 0, TAU); c.fill();
    if (won) { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(4, -3, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } else K.eye(4, -3, 4.2, null, 1, 0, 2);
    c.beginPath(); c.moveTo(-8, -12); c.lineTo(-8, -22); c.lineTo(-3, -16); c.lineTo(2, -24); c.lineTo(6, -16); c.lineTo(10, -22); c.lineTo(10, -12); c.closePath(); K.ink('#ffd23f', 2);
    c.restore(); c.restore();
  }
  function draw(s) {
    const { g, seq, len, i, shk, art } = s, T = now, won = g.result === 'win', lost = g.result === 'lose';
    if (KW !== VW || !BG) build();
    K.use(ctx);
    if (art.t0 == null) art.t0 = T;
    if (g.result && art.resAt == null) art.resAt = T;
    const rt = art.resAt == null ? 0 : T - art.resAt, el = T - art.t0, late = !g.result && el > g.dur / Math.sqrt(s.sp) * .62;
    ctx.drawImage(BG, -OX, 0);
    // live window: clouds and a bird drift past behind the glass
    ctx.save(); ctx.beginPath(); ctx.moveTo(22, 300); ctx.lineTo(22, 132); ctx.arc(62, 132, 40, Math.PI, 0); ctx.lineTo(102, 300); ctx.closePath(); ctx.clip();
    K.cloud(((T * 9) % 220) - 70, 150, .55); K.cloud(((T * 6 + 120) % 220) - 70, 220, .45); K.bird(((T * 30) % 260) - 60, 190 + Math.sin(T * 2) * 6, Math.sin(T * 10) * 4);
    ctx.restore();
    const sz = 120, gap = 16, tot = len * sz + (len - 1) * gap, x0 = (W - tot) / 2, sx = Math.sin(now * 80) * shk * 40;
    // the royal scroll: gold rod, parchment, a curled bottom roll
    const sw = Math.sin(T * 1.3) * .006, pw = tot + (len > 3 ? 44 : 64), ko = len > 3 ? 16 : 30;   // ko: rod knob overhang (tighter on 4 cards so it clears the window)
    ctx.save(); ctx.translate(W / 2, 80); ctx.rotate(sw); ctx.translate(-W / 2, -80);
    const paper = K.rrP(W / 2 - pw / 2, 84, pw, 188, 8);
    ctx.fillStyle = 'rgba(20,16,28,.25)'; ctx.save(); ctx.translate(5, 8); ctx.fill(paper); ctx.restore();
    K.cel(paper, '#fbecc8', '#e3c48a', 6, 0, 4);
    ctx.strokeStyle = 'rgba(185,128,66,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2 - pw / 2 + 16, 110); ctx.lineTo(W / 2 + pw / 2 - 16, 110); ctx.stroke();
    K.rr(W / 2 - pw / 2 - 14, 268, pw + 28, 20, 10); K.ink('#f7d297', 3.5); ctx.fillStyle = '#e3ac66'; ctx.fillRect(W / 2 - pw / 2 - 8, 280, pw + 16, 4);
    K.rr(W / 2 - pw / 2 - (ko - 4), 74, pw + 2 * (ko - 4), 14, 7); K.ink('#ffd23f', 3.5); for (const e of [-1, 1]) { ctx.beginPath(); ctx.arc(W / 2 + e * (pw / 2 + ko), 81, 11, 0, TAU); K.ink('#ffd23f', 3.5); ctx.fillStyle = 'rgba(255,255,255,.55)'; K.el(W / 2 + e * (pw / 2 + ko) - 3, 77, 3.5, 2.5, -.5); ctx.fill(); }
    // the move cards: keycaps on the scroll (gold = now, green = done, grey after the verdict)
    for (let k = 0; k < len; k++) {
      const done = k < i, cur = k === i && !g.result, miss = lost && k === i, y = 130 - (cur ? Math.abs(Math.sin(now * 8)) * 12 : 0), bx = x0 + k * (sz + gap) + sx;
      const col = done ? '#4fd06a' : miss ? '#ff4d5e' : cur ? '#ffd23f' : lost ? '#d3cfe0' : '#f6f4fb', dk = done ? '#24803a' : miss ? '#b8283a' : cur ? '#c99512' : lost ? '#8f88a6' : '#b9b2cf';
      const lift = K.plate(bx, y - 9, sz, sz - 8, col, dk, done, 18), fy = y - lift;
      drawArrow(bx + sz / 2, fy + sz / 2 - 4, seq[k], 32, done || miss ? '#fff' : lost ? '#f6f4fb' : '#6EA8FE');
      if (cur && Math.sin(T * 10) > 0) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; K.rr(bx + 7, fy + 7, sz - 14, sz - 22, 12); ctx.stroke(); }
    }
    // win: the royal wax seal thumps onto the scroll's corner
    if (won) { const k = K.outBack((rt - .12) / .25), sxp = Math.min(W / 2 + pw / 2 - 34, W - 190), syp = 120; if (k > 0) { ctx.save(); ctx.translate(sxp, syp); ctx.rotate(-.25); ctx.scale(k * 1.0 + (1 - Math.min(1, rt * 3)) * .6, k); ctx.beginPath(); for (let a = 0; a < 14; a++) { const r = a % 2 ? 30 : 34, an = a * TAU / 14; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); K.ink('#d6283d', 3.5); ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.strokeStyle = '#a81d2e'; ctx.lineWidth = 3; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(-14, -8); ctx.lineTo(-6, 0); ctx.lineTo(0, -12); ctx.lineTo(6, 0); ctx.lineTo(14, -8); ctx.lineTo(12, 8); ctx.closePath(); ctx.fillStyle = '#ffb3bf'; ctx.fill(); ctx.restore(); } }
    ctx.restore();
    // dance pad tiles (the one Claude just stepped on lights up)
    const lit = art.dir != null && T - art.at < .3 ? art.dir : -1;
    for (const [d, px, py, w, h] of PAD) {
      const on = d === lit || (won && Math.sin(T * 12 + d * 1.6) > 0), p = K.rrP(px - w / 2, py - h / 2, w, h, 10);
      K.cel(p, on ? '#5CFF7A' : '#cfd8e6', on ? '#23a046' : '#8f9cb3', 0, 5, 3.5);
      ctx.save(); ctx.translate(px, py - 2); ctx.scale(1, .42); drawArrow(0, 0, d, 26 * w / 94, on ? '#fff' : '#6EA8FE'); ctx.restore();
    }
    // the royal corgi chases its own tail (background gag)
    corgi(T, won);
    // the King on his throne
    const kmood = won ? 'win' : lost ? 'lose' : T - (art.miss ?? -9) < .5 ? 'cross' : late ? 'late' : 'idle';
    king(T, kmood, x0 + Math.min(i, len - 1) * (sz + gap) + sz / 2, rt, won && Math.sin(T * 16) > .6);
    // Claude, court dancer in a sweatband, copying the pose
    const pk = T - (art.at ?? -9), d = art.dir, wob = T - (art.miss ?? -9) < .45 ? Math.sin(T * 40) * .12 * (1 - (T - art.miss) / .45) : 0;
    let la = -2.5, ra = 2.5, lean = 0, sy = 1 + Math.sin(T * 3.1) * .025, jy = 0;
    if (won) { la = -.4 + Math.sin(T * 12) * .25; ra = .4 - Math.sin(T * 12) * .25; jy = Math.abs(Math.sin(T * 9)) * 26; }
    else if (lost) { la = -2.9; ra = 2.9; sy = .94; lean = -.08; }
    else if (d === 0) { la = -.2; ra = .2; sy *= 1.06; }
    else if (d === 1) { la = -.7; ra = 1.57; lean = .14; }
    else if (d === 3) { la = -1.57; ra = .7; lean = -.14; }
    else if (d === 2) { la = -2.2; ra = 2.2; sy *= .86; }
    else { la = -1.2 + Math.sin(T * 4) * .15; ra = 1.2 - Math.sin(T * 4) * .15; }      // waiting: a little shimmy
    const sq = d != null && pk < .22 && !won ? 1.18 - .18 * pk / .22 : 1, u = 9;
    shadow(CX, CY + 2, 54 - jy * .4, 10, .3);
    ctx.save(); ctx.translate(CX, CY - jy); ctx.rotate(lean + wob); ctx.scale(sq * (2 - sy), (2 - sq) * sy);
    K.arms(u, la, ra);
    claude(0, 0, u, { mood: won ? 'happy' : lost ? 'sad' : null });
    // sweatband with fluttering tails
    K.rr(-6.3 * u, -9.2 * u, 12.6 * u, 1.5 * u, 4); K.ink('#ff5c8a', 2.5); ctx.fillStyle = '#fff'; ctx.fillRect(-6.3 * u, -8.6 * u, 12.6 * u, .35 * u);
    const fl = Math.sin(T * 14) * 4; K.line([[6.2 * u, -8.5 * u], [6.2 * u + 16, -8.5 * u - 8 + fl], [6.2 * u + 28, -8.5 * u + fl]], 4, '#ff5c8a');
    ctx.restore();
    if ((late || T - (art.miss ?? -9) < .6) && !g.result) K.sweat(CX - 44, CY - 64 - jy, 1, (T * 1.6) % 1);
    // win: roses (hearts) fly from the throne to the stage
    if (won) for (let h = 0; h < 5; h++) { const k = (rt * 1.2 + h * .2) % 1, hx = KX - 50 - k * (180 + h * 40), hy = 400 - Math.sin(k * Math.PI) * (40 + h * 8) + k * 70; K.heart(hx, hy, 1.15, Math.min(1, (1 - k) * 3)); }
    // fail: the King lobs a tomato, SPLAT on Claude's face
    if (lost) {
      // thrown underhand from the King's low hand, flat (arc 30 px) and below the FAIL! stamp, lands on Claude's chest/face line
      const ft = .22, w0 = .1, sxx = KX - 110, syy = 412, tx = CX + 6, ty = CY - 30, Z = 1.3;
      if (rt < w0) tomato(KX - 70 - 400 * rt, 412 - 60 * rt, 13, 0);
      else if (rt < w0 + ft) { const k = (rt - w0) / ft; tomato(sxx + (tx - sxx) * k, syy + (ty - syy) * k - Math.sin(k * Math.PI) * 30, 15, k * 9); }
      else {
        const d2 = rt - w0 - ft, sp2 = Math.min(1, d2 * 8);
        const blob = new Path2D(); for (let a = 0; a < 10; a++) { const r = (a % 2 ? 24 : 38) * Z * sp2, an = a * TAU / 10; blob.lineTo(tx + Math.cos(an) * r, ty + Math.sin(an) * r * .8); } blob.closePath();
        ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke(blob); ctx.fillStyle = '#ff4d5e'; ctx.fill(blob);
        for (const [ox, len2] of [[-18, 1], [5, 1.5], [21, .8]]) { const y2 = ty + 18 + Math.min(1, d2 * 2) * 30 * len2; K.line([[tx + ox, ty + 14], [tx + ox, y2]], 9, INK); K.line([[tx + ox, ty + 14], [tx + ox, y2]], 5, '#ff4d5e'); }
        ctx.fillStyle = '#ffb3bf'; K.el(tx, ty + 2, 26 * sp2, 17 * sp2, -.15); ctx.fill();                // pale pulp core
        ctx.fillStyle = '#fff'; K.el(tx - 16 * sp2, ty - 14 * sp2, 9 * sp2, 5 * sp2, -.5); ctx.fill();      // white highlight
        ctx.fillStyle = '#ffe14d'; for (const [ox, oy] of [[-10, -4], [8, 3], [-2, 10], [14, -8], [-16, 6]]) { K.el(tx + ox * sp2, ty + oy * sp2, 3, 2, .5); ctx.fill(); }
        for (let k = 0; k < 6; k++) { const an = k * TAU / 6 + .3, r = 52 + d2 * 120; ctx.globalAlpha = Math.max(0, 1 - d2 * 2); ctx.beginPath(); ctx.arc(tx + Math.cos(an) * r, ty + Math.sin(an) * r * .7, 6, 0, TAU); K.ink('#ff4d5e', 2.5); ctx.globalAlpha = 1; }
        star(tx - 62, ty - 20 - d2 * 20, 10, 4.5, 4, T * 4, '#FFE14D', 2.5);
      }
    }
    vignette(.16);
  }
  return { draw };
})();
function gCopy(sp) {
  const len = 3 + (sp > 1.5), seq = Array.from({ length: len }, () => Math.random() * 4 | 0);
  const map = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  let i = 0, shk = 0;
  const art = {};                                                     // art only: last pose (dir, at), last miss, ending start
  const g = {
    cmd: 'COPY!', swipe: true, hint: 'PRESS THE ARROWS IN ORDER', thint: 'SWIPE THE ARROWS', dur: 5, wide: true,
    key(e) {
      if (!(e.code in map)) return;
      if (g.result) return;
      if (map[e.code] === seq[i]) { const bx = (W - (len * 136 - 16)) / 2 + i * 136 + 60; i++; art.dir = seq[i - 1]; art.at = now; sfx.blip(i * 3); burst(bx, 190, '#5CFF7A', 8, 200); ring(bx, 190, '#fff', 70, .3); if (i === len) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(W / 2, 200, 40); } }
      else { shk = .25; art.miss = now; sfx.miss(); shake(5, .15); }
    },
    update(dt) { shk = Math.max(0, shk - dt); if (art.t0 == null) art.t0 = now; if (g.result && art.resAt == null) art.resAt = now; },   // art clock only
    draw(t) { W2COPY.draw({ g, seq, len, i, shk, art, sp }); }
  };
  return g;
}

/* 12 ── STEADY: guide Claude through the tunnel without touching the walls (mouse) */
function gSteady(sp) {
  const hw = sp > 1.5 ? 28 : 36;
  const pts = [{ x: 90, y: 300 }];
  let y = 300;
  for (let k = 1; k <= 4; k++) { do { y = 170 + Math.random() * 260; } while (Math.abs(y - pts[k - 1].y) < 90); pts.push({ x: 90 + k * 155, y }); }
  pts.push({ x: 730, y: pts[4].y });
  const dist = p => { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segD(p.x, p.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)); return d; };
  let started = false;
  const end = pts[pts.length - 1];
  const g = {
    cmd: 'STEADY!', hint: 'ENTER AT GO. DO NOT TOUCH THE WALLS', thint: 'TOUCH GO, THEN DRAG', dur: 6, wide: true,
    move(p) {
      if (g.result) return;
      if (!started) { if (Math.hypot(p.x - pts[0].x, p.y - pts[0].y) < hw) { started = true; sfx.click(); sfx.blip(5); ring(pts[0].x, pts[0].y, '#5CFF7A', 80); } return; }
      if (Math.hypot(p.x - end.x, p.y - end.y) < hw) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(end.x, end.y, '#FFE14D', 18); ring(end.x, end.y, '#fff', 100); floatText('SMOOTH!', end.x - 40, end.y - 50, '#5CFF7A', 36); return; }
      if (dist(p) > hw) { g.result = 'lose'; sfx.zap(); sfx.buzz(); shake(10, .3); burst(p.x, p.y, '#FF4D4D', 14); }
    },
    update() {},
    draw(t) {
      bg('#FFE9A8', '#ffe08c', t);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(q => ctx.lineTo(q.x, q.y));
      ctx.save(); ctx.translate(5, 7); ctx.strokeStyle = 'rgba(20,16,28,.2)'; ctx.lineWidth = hw * 2 + 12; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = hw * 2 + 12; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = hw * 2; ctx.stroke(); ctx.lineCap = 'butt';
      circ(pts[0].x, pts[0].y, hw - 6, started ? '#bbb' : '#5CFF7A', 4); txt('GO', pts[0].x, pts[0].y, 24);
      circ(end.x, end.y, hw - 6, '#FFE14D', 4); star(end.x, end.y, 20, 9, 5, now * 2, '#fff', 2);
      const m = mouse;
      claude(m.x, m.y + 12, 2.6, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null });
    }
  };
  return g;
}

reg('stop', gStop, 'STOP');
reg('dont', gDont, "DON'T");
reg('count', gCount, 'COUNT');
reg('slice', gSlice, 'SLICE');
reg('copy', gCopy, 'COPY');
reg('steady', gSteady, 'STEADY');
