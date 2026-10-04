'use strict';
/* Wave 2 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 7 ── STOP: freeze the needle in the green zone (space or click) */
function gStop(sp) {
  const zw = 150 / Math.sqrt(sp), zx = 150 + Math.random() * (500 - zw);
  let ph = Math.random() * 2, stopped = false, lq = Math.floor(ph);
  const pos = () => 100 + 600 * Math.abs(((ph % 2) + 2) % 2 - 1);
  const g = {
    cmd: 'STOP!', hint: 'STOP IN THE GREEN', thint: 'TAP TO STOP', dur: 5, wide: true,
    stop() {
      if (stopped) return; stopped = true;
      const p = pos(); g.result = p >= zx && p <= zx + zw ? 'win' : 'lose';
      if (g.result === 'win') { sfx.stamp(); sfx.coin(); burst(p, 342, '#5CFF7A', 14); ring(p, 342, '#fff', 90); floatText('PERFECT!', p, 270, '#FFE14D', 36); } else { sfx.buzz(); shake(8, .25); burst(p, 342, '#FF4D4D', 10); }
    },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') g.stop(); },
    down() { g.stop(); },
    update(dt) { if (!stopped) { ph += dt * .9 * sp; const q = Math.floor(ph); if (q !== lq) { lq = q; sfx.tick(); } } },
    draw(t) {
      bg('#FF9AA2', '#ff8892', t);
      shadow(400, 392, 300, 12, .2);
      box3(100, 320, 600, 44, '#fff', 6, 6);
      ctx.fillStyle = '#ffd6da'; for (let i = 0; i < 12; i++) ctx.fillRect(100 + i * 50, 320, 25, 44);
      box(zx, 320, zw, 44, '#5CFF7A', 6);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(zx, 320, zw, 8);
      txt('GO', zx + zw / 2, 342, 28, '#fff');
      const p = pos();
      claude(p, 305, 5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      ctx.fillStyle = INK; ctx.fillRect(p - 5, 305, 10, 80);
      ctx.fillStyle = '#FFE14D'; ctx.fillRect(p - 2, 308, 4, 74);
    }
  };
  return g;
}

/* 8 ── DON'T: resist the urge. Touch nothing! */
function gDont(sp) {
  const taunts = ['PRESS ME!', 'DO IT!', 'CLICK!', 'SPACE!!!', 'JUST ONCE!', 'GO ON...'];
  const fail = () => { if (g.result) return; g.result = 'lose'; sfx.buzz(); sfx.thud(); shake(10, .3); burst(W / 2, 382, '#ee3b3b', 16); floatText('OOPS!', W / 2, 250, '#FF4D4D', 44); };
  const g = {
    cmd: "DON'T!", hint: "DON'T TOUCH ANYTHING", dur: 4, timeWin: true, wide: true,
    key() { fail(); }, down() { fail(); },
    update() {},
    draw(t) {
      bg('#8E94B0', '#8189a8', t);
      const lost = g.result === 'lose', won = g.result === 'win';
      shadow(W / 2, 326, 80, 14, .25);
      claude(W / 2, 320, 10, { mood: lost ? 'sad' : won ? 'happy' : null });
      if (!lost && !won) {
        const d = (now * 90) % 60; circ(W / 2 + 70, 190 + d, 6, '#4DB8FF', 2);
      }
      box3(W / 2 - 130, lost ? 354 : 340, 260, lost ? 70 : 84, '#ee3b3b', 6, lost ? 2 : 6);
      txt(taunts[(now * 1.4 | 0) % taunts.length], W / 2, lost ? 390 : 382, 36, '#fff');
      if (!lost) txt(taunts[((now * 1.4 | 0) + 3) % taunts.length], W / 2 + Math.sin(now * 9) * 160, 500 + Math.cos(now * 7) * 20, 32, '#FFE14D');
      if (won) { if (!g.won) { g.won = 1; sfx.coin(); sfx.sparkle(); confetti(W / 2, 200, 30); } }
      if (won) txt('GOOD CLAUDE', W / 2, 140, 60, '#5CFF7A');
    }
  };
  return g;
}

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

/* 11 ── COPY: press the arrows in order (arrow keys or WASD) */
function gCopy(sp) {
  const len = 3 + (sp > 1.5), seq = Array.from({ length: len }, () => Math.random() * 4 | 0);
  const map = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  let i = 0, shk = 0;
  const g = {
    cmd: 'COPY!', swipe: true, hint: 'PRESS THE ARROWS IN ORDER', thint: 'SWIPE THE ARROWS', dur: 5, wide: true,
    key(e) {
      if (!(e.code in map)) return;
      if (g.result) return;
      if (map[e.code] === seq[i]) { const bx = (W - (len * 136 - 16)) / 2 + i * 136 + 60; i++; sfx.blip(i * 3); burst(bx, 190, '#5CFF7A', 8, 200); ring(bx, 190, '#fff', 70, .3); if (i === len) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(W / 2, 200, 40); } }
      else { shk = .25; sfx.miss(); shake(5, .15); }
    },
    update(dt) { shk = Math.max(0, shk - dt); },
    draw(t) {
      bg('#B39DFF', '#a58cf5', t);
      const sz = 120, gap = 16, tot = len * sz + (len - 1) * gap, x0 = (W - tot) / 2, sx = Math.sin(now * 80) * shk * 40;
      for (let k = 0; k < len; k++) {
        const done = k < i, cur = k === i && !g.result, y = 130 - (cur ? Math.abs(Math.sin(now * 8)) * 12 : 0);
        shadow(x0 + k * (sz + gap) + sx + sz / 2 + 6, 130 + sz + 12, sz * .5, 9, .2);
        box3(x0 + k * (sz + gap) + sx, y, sz, sz, done ? '#5CFF7A' : cur ? '#FFE14D' : '#fff', 5, 6);
        drawArrow(x0 + k * (sz + gap) + sz / 2 + sx, y + sz / 2 - 4, seq[k], 34, done ? '#fff' : '#7C4DFF');
      }
      const dirFace = i < len ? seq[i] : 0;
      shadow(W / 2, 476, 90, 14, .25);
      claude(W / 2, 470 - (g.result === 'win' ? Math.abs(Math.sin(now * 9)) * 40 : 0), 11, { mood: g.result === 'win' ? 'happy' : null });
    }
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
