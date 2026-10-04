'use strict';
/* Wave 4 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 23 ── BALANCE: keep Claude upright on the ball (← → / A D, or mouse left-right of centre) */
function gBalance(sp) {
  let a = (Math.random() < .5 ? -1 : 1) * .12, w = 0, bx = 0, c = 0, warn = 0; const ph = Math.random() * 6;
  const g = {
    cmd: 'BALANCE!', wide: true, hint: 'LEAN THE SAME WAY: ← → OR MOUSE', thint: 'TOUCH LEFT OR RIGHT', dur: 5, timeWin: true,
    update(dt) {
      if (g.result) return;
      c = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      if (!c) c = Math.max(-1, Math.min(1, (mouse.x - W / 2) / 250));
      w += (a * 5 * sp + Math.sin(now * 2.3 + ph) * 1.2 * sp - c * 11) * dt; w *= Math.pow(.4, dt); a += w * dt;
      bx += (c * 70 - bx) * Math.min(1, 8 * dt);
      if (!warn && Math.abs(a) > .7) { warn = 1; sfx.blip(-8); }
      if (Math.abs(a) < .55) warn = 0;
      if (Math.abs(a) > 1) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(8, .3); burst(W / 2 + bx, 440, '#FF4D4D', 12); }
    },
    draw(t) {
      bg('#FFB3D9', '#ff9fcd', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 516, VW, 90); ctx.fillStyle = '#9b6bd1'; ctx.fillRect(-OX, 524, VW, 80);
      const cx = W / 2 + bx;
      shadow(cx, 520, 56, 12, .3); circ(cx, 466, 50, '#4DB8FF', 5);
      ctx.save(); ctx.translate(cx, 466); ctx.rotate(bx / 50); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -48, 12, 96); ctx.fillRect(-48, -6, 96, 12); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-18, -22, 12, 7, -.6, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(cx, 416); ctx.rotate(g.result === 'lose' ? Math.sign(a) * 1.3 : a);
      claude(0, 0, 8, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null }); ctx.restore();
    }
  };
  return g;
}

/* 24 ── FLIP: memorise the cards, then match the pairs (mouse) */
function gFlip(sp) {
  const n = sp > 1.5 ? 6 : 4, kinds = shuffle([...Array(n / 2).keys(), ...Array(n / 2).keys()]);
  const cw = n === 4 ? 140 : 108, gap = n === 4 ? 24 : 14, x0 = (W - (n * cw + (n - 1) * gap)) / 2;
  const cards = kinds.map((k, i) => ({ k, x: x0 + i * (cw + gap), up: true, done: false, pk: 1 }));
  let clock = 0, lock = 0, sel = [], pairs = 0, flipped = false; const peek = 1.6 / Math.sqrt(sp);
  const g = {
    cmd: 'FLIP!', wide: true, hint: 'REMEMBER, THEN MATCH PAIRS', thint: 'REMEMBER, THEN TAP PAIRS', dur: 6.5,
    down(p) {
      if (clock < peek || lock > 0 || g.result) return;
      const c = cards.find(c => !c.up && !c.done && p.x > c.x && p.x < c.x + cw && p.y > 170 && p.y < 370);
      if (!c) return;
      c.up = true; c.pk = 0; sel.push(c); sfx.click(); sfx.blip(sel.length * 4);
      if (sel.length === 2) {
        if (sel[0].k === sel[1].k) { sel.forEach(c => { c.done = true; c.pk = 0; burst(c.x + cw / 2, 270, '#5CFF7A', 10); }); sel = []; sfx.coin(); floatText('MATCH!', W / 2, 140, '#fff'); if (++pairs === n / 2) { g.result = 'win'; sfx.sparkle(); } }
        else { lock = .5; sfx.miss(); shake(3, .12); }
      }
    },
    update(dt) {
      clock += dt;
      if (clock >= peek && !flipped) { flipped = true; cards.forEach(c => c.up = false); sfx.whoosh(false); sfx.thud(); }
      cards.forEach(c => c.pk = Math.min(1, c.pk + dt * 4));
      if (lock > 0 && (lock -= dt) <= 0) { sel.forEach(c => c.up = false); sel = []; }
    },
    draw(t) {
      bg('#FFE29A', '#ffd97f', t);
      for (const c of cards) {
        const cx = c.x + cw / 2;
        const s = 1 + Math.sin(c.pk * Math.PI) * .08; shadow(cx + 4, 384, cw / 2, 10); ctx.save(); ctx.translate(cx, 270); ctx.scale(s, s); ctx.translate(-cx, -270);
        box3(c.x, 170, cw, 200, c.done ? '#5CFF7A' : c.up ? '#fff' : '#7C4DFF', 6, c.done ? 3 : 6);
        if (!c.up && !c.done) txt('?', cx, 270, 70);
        else if (c.k === 0) circ(cx, 270, 38, '#ff4d4d', 5);
        else if (c.k === 1) star(cx, 270, 48, 22, 5, -Math.PI / 2, '#ffd23f', 5);
        else box(cx - 34, 236, 68, 68, '#4DB8FF', 5);
        ctx.restore();
      }
      if (clock < peek) txt('MEMORISE!', W / 2, 110, 40, '#fff');
    }
  };
  return g;
}

/* 25 ── CHARGE: hold SPACE (or the mouse button), release inside the green zone */
function gCharge(sp) {
  const zc = 58 + Math.random() * 24, zw = 20, GY = 500, LH = zc * 3.8;
  let p = 0, inz = 0, hold = false, fired = false, jt = 0, endX = 300, endY = 0, A = 0;
  const start = () => { if (!fired && !g.result) hold = true; };
  const release = () => {
    if (!hold || g.result) return; hold = false; fired = true;
    const win = p >= zc - zw / 2 && p <= zc + zw / 2;
    endX = win ? 580 : p < zc ? 250 + (p / zc) * 230 : 700 + (p - zc) * 3; endY = win ? LH : 0; A = 60 + p * 1.2;
    g.result = win ? 'win' : 'lose'; sfx.whoosh(); if (win) { sfx.boing(); ring(300, GY, '#fff', 70); } else { sfx.miss(); shake(4, .15); }
  };
  const g = {
    cmd: 'CHARGE!', wide: true, hint: 'HOLD SPACE, RELEASE IN GREEN', thint: 'HOLD, RELEASE IN GREEN', dur: 5,
    key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') release(); },
    down() { start(); }, up() { release(); },
    update(dt) {
      if (hold) { p = Math.min(100, p + 60 * sp * dt); if (Math.random() < .3) snd(200 + p * 6, .03, 'square', .03); if (!inz && p >= zc - zw / 2) { inz = 1; sfx.pop(); ring(115, 500 - zc * 3.5, '#5CFF7A', 40, .3); } if (p > zc + zw / 2) inz = 0; }
      if (fired) { const j0 = jt; jt += dt; if (j0 < .7 && jt >= .7) { if (g.result === 'win') { sfx.coin(); sfx.sparkle(); burst(endX, GY - endY, '#FFE14D', 16); ring(endX, GY - endY, '#fff', 90); floatText('NICE!', endX, GY - endY - 100, '#fff'); } else { sfx.thud(); shake(6, .22); burst(endX, GY, '#d9a066', 10); } } }
    },
    draw(t) { W4A.charge({ p, zc, zw, GY, LH, hold, fired, jt, endX, endY, A, res: g.result, T: now }); }
  };
  return g;
}

/* 26 ── FLAP: slip through the gaps (space / up / click) */
function gFlap(sp) {
  const spd = 320 * sp; let py = 300, vy = 0, rT0 = 0;
  const px0 = OX > 0 ? W + OX + 60 : 700; // first pipe enters from the true screen edge
  const pipes = [{ x: px0, gy: 200 + Math.random() * 200 }, { x: px0 + 416 * sp, gy: 200 + Math.random() * 200 }];
  const flap = () => { if (!g.result) { vy = -520; sfx.whoosh(); snd(500, .06, 'square', .04, 0, 800); burst(150, py + 20, '#fff', 4, 120); } };
  const g = {
    cmd: 'FLAP!', wide: true, hint: 'SPACE OR CLICK TO FLAP', thint: 'TAP TO FLAP', dur: 4.5, timeWin: true,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') flap(); }, down() { flap(); },
    update(dt) {
      if (g.result) return;
      vy += 1800 * dt; py += vy * dt;
      if (py < 90 || py > 520) g.result = 'lose';
      for (const q of pipes) {
        const px = q.x; q.x -= spd * dt;
        if (px >= 180 && q.x < 180) { sfx.blip(5); floatText('+1', 180, py - 60, '#fff', 28); }
        if (q.x - 45 < 180 + 48 && q.x + 45 > 180 - 48 && (py - 80 < q.gy - 95 || py > q.gy + 95)) g.result = 'lose';
      }
      if (g.result === 'lose') { sfx.thud(); sfx.buzz(); shake(8, .3); burst(180, py, '#FF4D4D', 14); ring(180, py, '#fff', 80); }
    },
    draw(t) { if (g.result && !rT0) rT0 = now; W4A.flap({ pipes, py, vy, res: g.result, rT: rT0 ? now - rT0 : 0, T: now }); }
  };
  return g;
}

/* 27 ── PONG: don't let the ball past you (mouse or ↑ ↓) */
function gPong(sp) {
  const pad = { y: 300, h: 120 }; let target = 300, hits = 0;
  const vs = VW / W, rx = W + OX - 50, px = -OX + 62, vMax = 360 * sp * vs, ball = { x: 300, y: 200 + Math.random() * 200, vx: 230 * Math.sqrt(sp) * vs, vy: (Math.random() < .5 ? -1 : 1) * (100 + Math.random() * 80) * Math.sqrt(sp), r: 16 };
  const faster = () => { ball.vx = Math.sign(ball.vx) * Math.min(vMax, Math.abs(ball.vx) * 1.12); };
  const g = {
    cmd: 'PONG!', wide: true, hint: 'BLOCK THE BALL: MOUSE OR ↑ ↓', thint: 'DRAG UP AND DOWN', dur: 4.8, timeWin: true,
    move(p) { target = p.y; },
    update(dt) {
      if (g.result) return;
      if (keys.ArrowUp || keys.KeyW) target -= 650 * dt; if (keys.ArrowDown || keys.KeyS) target += 650 * dt;
      target = Math.max(130, Math.min(480, target)); pad.y += (target - pad.y) * Math.min(1, 20 * dt);
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < 76 + ball.r) { ball.y = 76 + ball.r; ball.vy = Math.abs(ball.vy); sfx.tick(); }
      if (ball.y > 524 - ball.r) { ball.y = 524 - ball.r; ball.vy = -Math.abs(ball.vy); sfx.tick(); }
      if (ball.x > rx - ball.r) { ball.x = rx - ball.r; ball.vx = -Math.abs(ball.vx); faster(); sfx.blip(-5); burst(rx, ball.y, '#ffd23f', 5, 160); }
      if (ball.vx < 0 && ball.x - ball.r <= px && ball.x > px - 32 && Math.abs(ball.y - pad.y) < pad.h / 2 + ball.r) {
        ball.vx = Math.abs(ball.vx); faster(); ball.vy += (ball.y - pad.y) * 3; hits++; sfx.hit(); sfx.blip(hits * 2); shake(3, .1); burst(px, ball.y, OR, 8); ring(px, ball.y, '#fff', 50, .25); floatText('+1', px + 38, ball.y - 30, '#fff', 28);
      }
      if (ball.x < -OX) { g.result = 'lose'; sfx.miss(); sfx.buzz(); shake(9, .3); burst(-OX + 10, ball.y, '#FF4D4D', 14); }
    },
    draw(t) {
      bg('#1f2a44', '#26335a', t);
      ctx.fillStyle = '#fff'; ctx.fillRect(-OX + 20, 64, VW - 40, 8); ctx.fillRect(-OX + 20, 524, VW - 40, 8);
      for (let i = 0; i < 9; i++) { box(rx, 80 + i * 50, 30, 42, i % 2 ? '#ff6b6b' : '#ffd23f', 3); }
      box3(-OX + 34, pad.y - pad.h / 2, 22, pad.h, OR, 4, 4);
      claude(-OX + 120, pad.y + 30, 3.2, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null });
      shadow(ball.x + 4, 536, ball.r, 5, .35); token(ball.x, ball.y, ball.r + 4);
    }
  };
  return g;
}

/* 28 ── CRANK: whirl the mouse around the wheel (3 turns) */
function gCrank(sp) {
  const cx = 400, cy = 300, need = (sp > 1.5 ? 4 : 3) * Math.PI * 2;
  let acc = 0, pa = null, ang = 0, lt = 0;
  const g = {
    cmd: 'CRANK!', wide: true, hint: 'SPIN THE MOUSE AROUND THE WHEEL', thint: 'SPIN YOUR FINGER AROUND', dur: 5,
    move(p) {
      if (g.result) return;
      const d = Math.hypot(p.x - cx, p.y - cy); if (d < 40) { pa = null; return; }
      const a = Math.atan2(p.y - cy, p.x - cx); ang = a;
      if (pa !== null) { let dd = a - pa; if (dd > Math.PI) dd -= Math.PI * 2; if (dd < -Math.PI) dd += Math.PI * 2; acc += Math.abs(dd); const tk = Math.floor(acc / (Math.PI / 4)); if (tk !== lt) { lt = tk; sfx.tick(); snd(250 + acc * 8, .03, 'square', .03); } }
      pa = a; if (acc >= need) { g.result = 'win'; sfx.coin(); sfx.sparkle(); sfx.stamp(); shake(5, .2); confetti(cx, 140, 30); ring(cx, cy - 20, '#5CFF7A', 130); floatText('NICE!', cx, 150, '#fff'); }
    },
    update() {},
    draw(t) {
      bg('#C3F584', '#b4ea6e', t);
      box3(cx - 160, 340, 320, 180, '#7C4DFF', 6); txt('?', cx, 430, 80);
      const k = Math.min(1, acc / need);
      shadow(cx + 6, cy + 100, 100, 18, .22); circ(cx, cy - 20, 110, '#fff', 6);
      ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(cx, cy - 20, 90, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + Math.cos(ang) * 100, cy - 20 + Math.sin(ang) * 100); ctx.stroke();
      circ(cx + Math.cos(ang) * 100, cy - 20 + Math.sin(ang) * 100, 18, '#FFE14D', 4);
      circ(cx, cy - 20, 14, '#FFE14D', 4);
      if (g.result === 'win') claude(cx, 340 - Math.abs(Math.sin(now * 9)) * 40, 9, { mood: 'happy' });
    }
  };
  return g;
}

/* ───────────── DUO-look art kit for the stage-2 restyle of MAZE (docs/ART-STYLE.md) ─────────────
   Art only: nothing in here touches Math.random, game state or input. Cosmetic variety comes from hr(). */
const W4A = (() => {
  const TAU = Math.PI * 2;
  let X = null;                 // set to ctx on each draw (the file is also loaded headless by scripts/party-catalog.js)
  const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const cl = k => Math.max(0, Math.min(1, k));
  const ease = k => (k = cl(k), k * k * (3 - 2 * k));
  const outBack = k => { k = cl(k) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  const lerp = (a, b, k) => a + (b - a) * k;
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function line(pts, w, col) {   // INK tube under a colour stroke
    X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]));
    X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke();
  }
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function bake(fn) {            // paint once into a VW×600 layer (logical x from -OX), blit with layer(c)
    const c = cnv(VW, H), old = X; X = c.getContext('2d'); X.translate(OX, 0);
    try { fn(); } finally { X = old; } return c;
  }
  const layer = c => X.drawImage(c, -OX, 0);
  function cloud(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); }
    X.restore();
  }
  function tuft(x, y) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); }
  function drop(x, y, s, a = 1) {  // a sweat / water drop
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath();
    ink('#9fe3ff', 2.5); X.fillStyle = '#fff'; el(-1.8, 0, 1.6, 2.4); X.fill(); X.restore();
  }
  /* blocky arms from claude()'s side stubs (drawn before claude(), origin = Claude's feet). la/ra: 0 = straight up */
  function arms(u, la, ra, k, col) {
    if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    const one = (sx, an) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
      X.restore();
    };
    one(-1, la); one(1, ra);
  }
  function stars(x, y, rad, T) { for (let i = 0; i < 3; i++) { const a = T * 6 + i * TAU / 3; star(x + Math.cos(a) * rad, y + Math.sin(a) * rad * .4, 8, 3.5, 5, a, '#FFE14D', 2.5); } }
  function eyes(x, y, u, col, look, mood, T) {   // Claude's eyes, repainted: pupils look around, bonk = > <, panic = wide whites
    const ey = y - 6.2 * u, ex = [x - 2.8 * u, x + 2.8 * u];
    X.fillStyle = col; for (const e of ex) X.fillRect(e - 1.2 * u, ey - 1.6 * u, 2.4 * u, 3.2 * u);
    X.strokeStyle = INK; X.fillStyle = INK; X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = Math.max(2, u * .5);
    if (mood === 'bonk') { ex.forEach((e, i) => { const s = i ? -1 : 1; X.beginPath(); X.moveTo(e - s * .9 * u, ey - u); X.lineTo(e + s * .5 * u, ey); X.lineTo(e - s * .9 * u, ey + u); X.stroke(); }); return; }
    if (mood === 'panic') {
      for (const e of ex) { rr(e - 1.05 * u, ey - 1.45 * u, 2.1 * u, 2.9 * u, .5 * u); X.fillStyle = '#fff'; X.fill(); X.lineWidth = Math.max(1.5, u * .35); X.stroke(); X.fillStyle = INK; X.fillRect(e - .4 * u + look[0] * .45 * u, ey - .5 * u + look[1] * .6 * u, .8 * u, 1.1 * u); }
      return;
    }
    const shut = Math.sin(T * 1.7) > .985;
    for (const e of ex) {
      if (shut) X.fillRect(e - .7 * u, ey - .15 * u, 1.4 * u, .4 * u);
      else { X.fillRect(e - .6 * u + look[0] * .5 * u, ey - 1.2 * u + look[1] * .4 * u, 1.2 * u, 2.4 * u); X.fillStyle = '#fff'; X.fillRect(e - .45 * u + look[0] * .5 * u, ey - 1 * u + look[1] * .4 * u, .45 * u, .5 * u); X.fillStyle = INK; }
    }
  }

  /* ═════════════ MAZE: the royal hedge maze of the Keyboard Kingdom ═════════════ */
  const MZHZ = 56;
  let MZBG = null, MZW = -1;
  function mazeBg() {   // sky, the far keyboard castle, the striped royal lawn
    if (MZBG && MZW === VW) return MZBG; MZW = VW;
    return MZBG = bake(() => {
      const L = -OX - 2, R = W + OX + 2, HZ = MZHZ;
      let g = X.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, '#36b0ea'); g.addColorStop(.6, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, HZ + 4);
      X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, HZ); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 40 - Math.sin(x * .011 + 1) * 8 - Math.sin(x * .027) * 3); X.lineTo(R, HZ); X.closePath(); X.fill();
      // far castle: towers crowned with key caps instead of battlements (coloured outline, no ink: it is far away)
      const tw = (x, y, w) => {
        X.beginPath(); X.rect(x, y, w, HZ - y + 2); X.fillStyle = '#c9d0fb'; X.fill(); X.strokeStyle = '#7b80c6'; X.lineWidth = 2.5; X.stroke();
        X.fillStyle = '#aab3f2'; X.fillRect(x + w * .62, y + 1, w * .38 - 1, HZ - y);
        for (let i = 0; i < 3; i++) { const kx = x - 2 + i * (w + 4) / 3; rr(kx, y - 9, (w + 4) / 3 - 2, 10, 2.5); X.fillStyle = '#f6f8ff'; X.fill(); X.strokeStyle = '#7b80c6'; X.lineWidth = 2; X.stroke(); }
        rr(x + w / 2 - 3, y + 8, 6, 9, 3); X.fillStyle = '#5b5fa8'; X.fill();
      };
      for (const [x, y, w] of [[-250, 30, 26], [-180, 22, 34], [-140, 34, 22], [940, 26, 30], [990, 34, 22]]) tw(x, y, w);
      X.beginPath(); X.moveTo(L, HZ + 2); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 50 - Math.sin(x * .014 + 3) * 4); X.lineTo(R, HZ + 2); X.closePath(); X.fillStyle = '#87d19b'; X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
      // the royal lawn: mown stripes
      g = X.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, HZ, R - L, H - HZ);
      X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = Math.floor(L / 60) * 60; x < R; x += 120) X.fillRect(x, HZ, 60, H - HZ);
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, HZ); X.lineTo(R, HZ); X.stroke();
      for (let i = 0; i < 40; i++) { const x = L + hr(i + 3) * (R - L), y = HZ + 14 + hr(i + 40) * 520; tuft(x, y); }
      for (let i = 0; i < 16; i++) { const x = L + hr(i + 90) * (R - L), y = HZ + 20 + hr(i + 70) * 500; X.save(); X.translate(x, y); for (let p = 0; p < 5; p++) { X.rotate(TAU / 5); el(0, -5, 3.4, 5); ink(i % 3 ? '#fff' : '#ff9dc0', 1.5); } X.beginPath(); X.arc(0, 0, 3, 0, TAU); ink('#ffe14d', 1.5); X.restore(); }
    });
  }
  /* hedge segments of this maze (outer frame + every closed wall), in px */
  function segs(m) {
    const { R, C, cs, ox, oy, wr, wd } = m, s = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (wr[r][c] && c < C - 1) s.push([ox + (c + 1) * cs, oy + r * cs, ox + (c + 1) * cs, oy + (r + 1) * cs]);
      if (wd[r][c] && r < R - 1) s.push([ox + c * cs, oy + (r + 1) * cs, ox + (c + 1) * cs, oy + (r + 1) * cs]);
    }
    return s;
  }
  function mazeLayer(m) {   // gravel paths, hedges, the prize pedestal: baked once per maze
    if (m.L && m.LW === VW) return m.L; m.LW = VW;
    return m.L = bake(() => {
      const { R, C, cs, ox, oy } = m, w = C * cs, h = R * cs, hw = Math.round(cs * .2), dp = Math.round(cs * .08);
      // drop shadow + gravel
      X.fillStyle = 'rgba(20,16,28,.25)'; rr(ox + 8, oy + 12, w, h, 14); X.fill();
      rr(ox, oy, w, h, 12); ink('#f2dca0', 4);
      X.save(); rr(ox, oy, w, h, 12); X.clip();
      for (let i = 0; i < 420; i++) { const x = ox + hr(i + 500) * w, y = oy + hr(i + 900) * h, r = 1.2 + hr(i + 1300) * 2.2; el(x, y, r * 1.3, r); X.fillStyle = i % 4 ? 'rgba(185,128,66,.28)' : 'rgba(255,255,255,.55)'; X.fill(); }
      X.restore();
      // the start: a little round doormat
      { const mx = ox + cs / 2, my = oy + cs * .62, mw = cs * .56, mh = cs * .2; X.fillStyle = 'rgba(20,16,28,.2)'; rr(mx - mw / 2 + 3, my - mh / 2 + 4, mw, mh, 5); X.fill();
        rr(mx - mw / 2, my - mh / 2, mw, mh, 5); ink('#e3ac66', 3); X.strokeStyle = '#b98042'; X.lineWidth = 2; for (let i = 1; i < 8; i++) { const x = mx - mw / 2 + i * mw / 8; X.beginPath(); X.moveTo(x, my - mh / 2 + 3); X.lineTo(x, my + mh / 2 - 3); X.stroke(); }
        rr(mx - mw / 2 + 4, my - mh / 2 + 3, mw - 8, mh - 6, 3); X.strokeStyle = '#e8434f'; X.lineWidth = 2.5; X.stroke(); }
      // the goal: a stone pedestal with a velvet cushion (the star itself is live)
      const gx = ox + (C - .5) * cs, gy = oy + (R - .5) * cs + cs * .2;
      X.fillStyle = 'rgba(20,16,28,.25)'; el(gx + 4, gy + 8, cs * .3, cs * .09); X.fill();
      rr(gx - cs * .22, gy - cs * .1, cs * .44, cs * .2, 6); ink('#c9ced6', 3.5); X.fillStyle = '#8f9cb3'; X.fillRect(gx + cs * .08, gy - cs * .1 + 3, cs * .1, cs * .2 - 6);
      el(gx, gy - cs * .12, cs * .26, cs * .08); ink('#e8434f', 3.5); X.fillStyle = 'rgba(255,255,255,.35)'; el(gx - cs * .1, gy - cs * .15, cs * .08, cs * .025, -.2); X.fill();
      for (const s of [-1, 1]) { X.beginPath(); X.arc(gx + s * cs * .26, gy - cs * .1, 4, 0, TAU); ink('#ffd23f', 2); }
      // hedges: shadow, ink, dark side face, top, light, leaf speckles. One pass per layer so joints merge.
      const S = segs(m), frame = (dx, dy) => { X.beginPath(); X.rect(ox + dx, oy + dy, w, h); for (const q of S) { X.moveTo(q[0] + dx, q[1] + dy); X.lineTo(q[2] + dx, q[3] + dy); } };
      X.lineJoin = 'round'; X.lineCap = 'round';
      frame(6, dp + 9); X.strokeStyle = 'rgba(20,16,28,.22)'; X.lineWidth = hw; X.stroke();
      frame(0, dp); X.strokeStyle = INK; X.lineWidth = hw + 8; X.stroke(); frame(0, 0); X.stroke();
      frame(0, dp); X.strokeStyle = '#237a40'; X.lineWidth = hw; X.stroke();
      frame(0, 0); X.strokeStyle = '#3fb260'; X.lineWidth = hw; X.stroke();
      frame(-hw * .14, -hw * .18); X.strokeStyle = '#5bcf72'; X.lineWidth = hw * .42; X.stroke();
      const all = [[ox, oy, ox + w, oy], [ox + w, oy, ox + w, oy + h], [ox, oy + h, ox + w, oy + h], [ox, oy, ox, oy + h], ...S];
      all.forEach((q, j) => {
        const len = Math.hypot(q[2] - q[0], q[3] - q[1]), n = Math.max(2, len / 14 | 0);
        for (let i = 0; i < n; i++) {
          const k = (i + hr(j * 31 + i)) / n, x = lerp(q[0], q[2], k) + (hr(j * 17 + i * 3) - .5) * hw * .55, y = lerp(q[1], q[3], k) + (hr(j * 7 + i * 5) - .5) * hw * .55;
          el(x, y, 2.6, 2); X.fillStyle = i % 3 ? 'rgba(35,122,64,.55)' : 'rgba(210,255,200,.6)'; X.fill();
        }
      });
    });
  }
  /* win: the hedges burst into flowers, rippling out from the prize */
  function blooms(m, rT) {
    const { R, C, cs, ox, oy } = m, w = C * cs, h = R * cs, gx = ox + (C - .5) * cs, gy = oy + (R - .5) * cs;
    if (!m.F) {
      m.F = [];
      const all = [[ox, oy, ox + w, oy], [ox + w, oy, ox + w, oy + h], [ox, oy + h, ox + w, oy + h], [ox, oy, ox, oy + h], ...segs(m)];
      all.forEach((q, j) => { const len = Math.hypot(q[2] - q[0], q[3] - q[1]), n = Math.max(1, len / 44 | 0); for (let i = 0; i < n; i++) { const k = (i + .3 + hr(j * 13 + i) * .4) / n, x = lerp(q[0], q[2], k), y = lerp(q[1], q[3], k); if (x > W - 150 && y < 125) continue; m.F.push([x, y, Math.hypot(x - gx, y - gy), (j + i) % 3]); } });  // keep the counter + score pop clear
    }
    for (const [x, y, d, c] of m.F) {
      const s = outBack((rT - d / 1400) / .25); if (s <= 0) continue;
      X.save(); X.translate(x, y - 3); X.scale(s, s); X.rotate(d * .05 + rT * 1.5);
      for (let p = 0; p < 5; p++) { X.rotate(TAU / 5); el(0, -6, 4.6, 6.5); ink(['#ff5c8a', '#fff', '#ffd23f'][c], 2); }
      X.beginPath(); X.arc(0, 0, 4, 0, TAU); ink(c === 2 ? '#ff5c8a' : '#ffe14d', 2); X.restore();
    }
  }
  /* lose: sprinkler heads pop out of the hedges and soak the garden */
  function sprinklers(m, rT, T, cx, cy) {
    const { R, C, cs, ox, oy } = m;
    if (!m.N) { m.N = []; for (let r = 1; r < R; r++) for (let c = 0; c <= C; c++) if (hr(r * 19 + c * 7 + 3) < .42) m.N.push([ox + c * cs, oy + r * cs, r * 7 + c]); }
    // the one nearest Claude always fires straight at him
    const nx = ox + Math.round((cx - ox) / cs) * cs, ny = Math.min(oy + (R - 1) * cs, Math.max(oy + cs, oy + Math.round((cy - oy) / cs) * cs));
    const list = m.N.filter(n => Math.hypot(n[0] - nx, n[1] - ny) > 4).concat([[nx, ny, 99, 1]]);
    for (const [x, y, k, aim] of list) {
      const up = outBack((rT - (aim ? 0 : hr(k) * .15)) / .2); if (up <= 0) continue;
      const hy = y - 14 * up;
      if (rT > .1) {
        const jets = aim ? [[cx - x, cy - 34 - hy]] : [[Math.sin(T * 5 + k) * 70, 0], [-Math.sin(T * 5 + k) * 70 - 20, 0]];
        for (const [dx0, dy0] of jets) {
          const ex = x + dx0, ey = aim ? hy + dy0 : hy + 40, top = Math.min(hy, ey) - (aim ? 40 : 46);
          const q = ease((rT - .1) / .2), mx = lerp(x, ex, .5), px = lerp(x, ex, q), py = lerp(hy, ey, q);
          X.beginPath(); X.moveTo(x, hy); X.quadraticCurveTo(lerp(x, mx, q), lerp(hy, top, q), px, py); X.lineCap = 'round';
          X.lineWidth = 10; X.strokeStyle = 'rgba(60,111,180,.55)'; X.stroke(); X.lineWidth = 6; X.strokeStyle = 'rgba(159,227,255,.95)'; X.stroke(); X.lineWidth = 2; X.strokeStyle = 'rgba(255,255,255,.9)'; X.stroke();
          if (q >= 1) for (let i = 0; i < 4; i++) { const z = (T * 2.2 + i / 4 + hr(k + i)) % 1; el(ex + (hr(k * 3 + i) - .5) * 30, ey + z * 26, 3, 4); X.fillStyle = 'rgba(159,227,255,' + (1 - z).toFixed(2) + ')'; X.fill(); }
        }
      }
      rr(x - 7, hy, 14, 14 * up + 3, 4); ink('#c9ced6', 2.5); el(x, hy, 10, 5); ink('#8f9cb3', 2.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(x - 3, hy - 1, 3, 1.5); X.fill();
    }
  }
  /* the palace guard: a key cap in a bearskin hat, stiff as a board */
  function guard(x, y, T, look, res, rT) {
    const laugh = res === 'lose', cheer = res === 'win', jig = laugh ? Math.sin(T * 30) * 1.5 : 0, hop = cheer ? Math.abs(Math.sin(T * 9)) * 8 : 0;
    y -= hop; x += jig;
    X.fillStyle = 'rgba(20,16,28,.25)'; el(x, y + hop + 2, 22, 5); X.fill();
    // spear
    line([[x + 20, y - 4], [x + 20, y - 88]], 3.5, '#a5622c');
    X.beginPath(); X.moveTo(x + 20, y - 104); X.lineTo(x + 26, y - 88); X.lineTo(x + 14, y - 88); X.closePath(); ink('#c9ced6', 2.5);
    // legs + body (red tunic) + the key-cap head
    for (const s of [-1, 1]) { rr(x + s * 7 - 4, y - 16, 8, 16, 3); ink('#2b2b3a', 2.5); }
    rr(x - 15, y - 44, 30, 30, 8); ink('#e8434f', 3); X.fillStyle = '#b8283a'; X.fillRect(x + 6, y - 42, 7, 26); X.fillStyle = '#ffd23f'; for (const yy of [-36, -28, -20]) { X.beginPath(); X.arc(x, y + yy, 2.2, 0, TAU); X.fill(); }
    if (cheer) line([[x - 15, y - 36], [x - 26, y - 60]], 6, '#e8434f'); else line([[x - 15, y - 36], [x - 17, y - 18]], 6, '#e8434f');
    line([[x + 15, y - 36], [x + 20, y - 40]], 6, '#e8434f');
    rr(x - 17, y - 72, 34, 30, 7); ink('#cfc9de', 3); rr(x - 17, y - 72, 34, 24, 7); X.fillStyle = '#f6f4fb'; X.fill(); X.fillStyle = 'rgba(255,255,255,.7)'; el(x - 9, y - 66, 5, 2.5, -.3); X.fill();
    // face
    for (const s of [-1, 1]) {
      const ex = x + s * 7, ey = y - 60;
      if (laugh || cheer) { X.beginPath(); X.arc(ex, ey + 2, 3.5, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke(); }
      else if (Math.sin(T * 1.3 + 2) > .98) { X.fillStyle = INK; X.fillRect(ex - 3, ey, 6, 2); }
      else { el(ex, ey, 4, 4.5); ink('#fff', 1.2); X.beginPath(); X.arc(ex + look[0] * 1.8, ey + look[1] * 1.6, 2.1, 0, TAU); X.fillStyle = INK; X.fill(); }
    }
    X.beginPath(); if (laugh) { el(x, y - 52, 4, 3.5); X.fillStyle = INK; X.fill(); } else { X.moveTo(x - 4, y - 52); X.lineTo(x + 4, y - 52); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke(); }
    X.fillStyle = 'rgba(255,120,140,.5)'; el(x - 12, y - 54, 3.5, 2); X.fill(); el(x + 12, y - 54, 3.5, 2); X.fill();
    // bearskin hat (sits above the eyes, never over them)
    X.beginPath(); X.moveTo(x - 16, y - 69); X.bezierCurveTo(x - 20, y - 104, x + 20, y - 104, x + 16, y - 69); X.closePath(); ink('#2b2b3a', 3);
    X.fillStyle = 'rgba(255,255,255,.18)'; el(x - 6, y - 90, 4, 8, -.3); X.fill();
    line([[x - 16, y - 72], [x + 16, y - 72]], 2.5, '#ffd23f');
  }
  /* the ESC key, pacing the far side of the maze looking for the exit */
  function esc(x, y, T, res, rT, panic) {
    const run = res !== 'lose' || rT < .2, dir = res === 'lose' ? 1 : Math.cos(T * 1.1) >= 0 ? 1 : -1;  // on a loss it bolts right, facing the way it runs
    const hop = res === 'win' ? Math.abs(Math.sin(T * 9)) * 9 : Math.abs(Math.sin(T * (panic ? 22 : 13))) * 3;
    y -= hop;
    X.fillStyle = 'rgba(20,16,28,.25)'; el(x, y + hop + 2, 17, 4); X.fill();
    for (const s of [-1, 1]) { const st = Math.sin(T * (panic ? 22 : 13) + (s > 0 ? Math.PI : 0)) * 5; line([[x + s * 6, y - 12], [x + s * 6 + st, y - 1]], 3, '#f6f4fb'); }
    X.save(); X.translate(x, y - 24); X.rotate(res === 'lose' ? .2 + Math.sin(T * 40) * .05 : dir * .08);
    rr(-18, -14, 36, 28, 7); ink('#cfc9de', 3); rr(-18, -14, 36, 22, 7); X.fillStyle = '#f6f4fb'; X.fill();
    X.fillStyle = INK; X.font = '700 10px Fredoka, "Helvetica Neue", Arial, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('ESC', -dir * 6, -7);
    for (const s of [-1, 1]) {
      const ex = dir * 6 + s * 5, ey = 2;
      if (res === 'win') { X.beginPath(); X.arc(ex, ey + 1, 2.6, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = 2; X.strokeStyle = INK; X.stroke(); }
      else { el(ex, ey, 3, 3.4); ink('#fff', 1); X.beginPath(); X.arc(ex + dir * 1.2, ey, 1.6, 0, TAU); X.fillStyle = INK; X.fill(); }
    }
    X.restore();
    if (res === 'lose') { for (let i = 0; i < 3; i++) { const q = (T * 1.6 + i / 3) % 1; drop(x - 14 + i * 14, y - 46 + q * 30, .5, 1 - q); } }
    else if (panic) { const q = (T * 2.4) % 1; drop(x - dir * 20, y - 36 + q * 12, .55, 1 - q); }
  }

  function maze(s) {
    X = ctx;
    const { m, me, bump, res, rT, T, left, look, trail, moving } = s, { R, C, cs, ox, oy } = m;
    layer(mazeBg());
    for (let i = 0; i < 4; i++) { const sx = (T * (5 + i * 2) + i * 260 + 40) % (VW + 200) - OX - 120; cloud(sx, 14 + (i % 2) * 12, .32 + (i % 3) * .06); }
    layer(mazeLayer(m));
    // breadcrumb footprints on the gravel
    for (let i = 0; i < trail.length; i++) { const p = trail[i], a = .18 + .3 * (i / trail.length); X.fillStyle = `rgba(150,96,46,${a})`; for (const d of [-1, 1]) { el(p[0] + d * cs * .07, p[1] + cs * .22 + d * 2, cs * .028, cs * .04); X.fill(); } }
    // the prize: a golden star on the cushion; on a win Claude lifts it overhead
    const gx = ox + (C - .5) * cs, gy0 = oy + (R - .5) * cs, won = res === 'win', lost = res === 'lose';
    const u = cs / 27, fx = me.x + Math.sin(T * 90) * bump * 20, jump = won ? Math.abs(Math.sin(rT * 9)) * cs * .12 : 0, fy = me.y + cs * .26 - jump;
    const lift = won ? ease(rT / .3) : 0, sx = lerp(gx, fx, lift), sr = cs * .3 * (1 + lift * .2), sy = lerp(gy0 - cs * .02 + Math.sin(T * 3) * 3, fy - 12.5 * u - sr * .75, lift);
    const glowR = sr * (1.5 + Math.sin(T * 4) * .12);
    if (!lost) { X.save(); X.translate(sx, sy); X.rotate(T * (won ? 3 : .6)); X.fillStyle = won ? 'rgba(255,240,150,.55)' : 'rgba(255,240,150,.35)'; for (let i = 0; i < 8; i++) { X.rotate(TAU / 8); X.beginPath(); X.moveTo(-5, sr * .7); X.lineTo(5, sr * .7); X.lineTo(0, glowR + (won ? cs * .4 : 0)); X.fill(); } X.restore(); }
    if (!won) { star(sx, sy, sr, sr * .43, 5, T * 2, lost ? '#e8c84a' : '#FFE14D', 3.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(sx - sr * .2, sy - sr * .25, sr * .2, sr * .1, -.6); X.fill(); }
    // Claude
    const col = OR, mood = won ? 'happy' : lost ? 'sad' : null, bonk = !res && bump > 0 || (s.bonk >= 0 && T - s.bonk < .45), panic = !res && left < 1.8;
    shadow(me.x, me.y + cs * .27, cs * .26, cs * .07, .28);
    if (lost) { const pq = ease(rT / .7); X.fillStyle = 'rgba(95,210,247,.55)'; el(me.x, me.y + cs * .28, cs * .36 * pq, cs * .11 * pq); X.fill(); X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 2; X.stroke(); }
    if (won) { X.save(); X.translate(fx, fy); arms(u, -.25, .25, 1, col); X.restore(); }
    else if (lost) { X.save(); X.translate(fx, fy); arms(u, -2.6, 2.6, .8, col); X.restore(); }
    else if (panic) { const w = Math.sin(T * 26) * .4; X.save(); X.translate(fx, fy); arms(u, -.9 + w, .9 - w, .8, col); X.restore(); }
    claude(fx, fy, u, { mood, run: moving ? T : null });
    if (!mood) eyes(fx, fy, u, col, look, bonk ? 'bonk' : panic ? 'panic' : null, T);
    if (bonk) stars(fx, fy - 10 * u, 5 * u, T);
    if (panic) for (const d of [-1, 1]) { const q = (T * 2.6 + (d > 0 ? .5 : 0)) % 1; drop(fx + d * 7.5 * u, fy - 8 * u + q * 14, u / 7, 1 - q); }
    if (won) { star(sx, sy, sr, sr * .43, 5, T * 6, '#FFE14D', 3.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(sx - sr * .2, sy - sr * .25, sr * .2, sr * .1, -.6); X.fill(); }
    if (lost) for (let i = 0; i < 3; i++) { const q = (T * 1.7 + i / 3) % 1; drop(fx - 6 * u + i * 6 * u, fy - 9 * u + q * 12 * u, u / 6, 1 - q); }
    // payoffs that cover the whole garden, so they read around the centre stamp
    if (won) blooms(m, rT);
    if (lost) sprinklers(m, rT, T, fx, fy);
    // the two background regulars, in the lawn margins beside the maze
    const gdx = fx - (ox - 36), gdy = fy - 300, gd = Math.hypot(gdx, gdy) || 1;
    guard(ox - 36, Math.min(oy + R * cs - 20, 420), T, [gdx / gd, gdy / gd], res, rT);
    // on a loss ESC escapes off the true right edge of the screen (whatever its width), you didn't
    const ey = lerp(oy + 120, oy + R * cs - 30, .5 + .5 * Math.sin(T * 1.1)), eq = lost ? ease(Math.max(0, rT - .25) / .55) : 0, ex = lerp(ox + C * cs + 36, W + OX + 40, eq);
    esc(ex, Math.min(535, ey + eq * 50), T, res, rT, panic);
    vignette(.16);
  }

  /* ═════════════ shared bits for FLAP and CHARGE (stage 3) ═════════════ */
  function celF(path, base, shade, sx, sy, o = 4) {   // flat shade crescent: fill the shade, then the base shifted by (-sx,-sy) clipped to the shape
    path(); ink(shade, o); X.save(); path(); X.clip(); X.translate(-sx, -sy); path(); X.fillStyle = base; X.fill(); X.restore();
  }
  function glint(path, x, y, rx, ry, a = .45, rot = -.5) { X.save(); path(); X.clip(); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
  function eye(x, y, r, mood, lx, ly, T, k) {    // sclera + pupil that looks at the action + highlight; moods idle / wide / happy / shut / x
    X.lineJoin = 'round'; X.lineCap = 'round';
    if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .3, r * .8, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = Math.max(2.5, r * .5); X.strokeStyle = INK; X.stroke(); return; }
    if (mood === 'shut' || (mood === 'idle' && Math.sin(T * 1.9 + k) > .985)) { X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.lineWidth = Math.max(2.5, r * .5); X.strokeStyle = INK; X.stroke(); return; }
    if (mood === 'x') { X.beginPath(); X.moveTo(x - r * .7, y - r * .7); X.lineTo(x + r * .7, y + r * .7); X.moveTo(x + r * .7, y - r * .7); X.lineTo(x - r * .7, y + r * .7); X.lineWidth = Math.max(2.5, r * .5); X.strokeStyle = INK; X.stroke(); return; }
    const R = mood === 'wide' ? r * 1.3 : r; el(x, y, R, R * 1.08); ink('#fff', Math.max(1.5, R * .28));
    const pr = R * (mood === 'wide' ? .36 : .52), px = x + lx * R * .38, py = y + ly * R * .38;
    X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fillStyle = INK; X.fill();
    X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .35, 0, TAU); X.fillStyle = '#fff'; X.fill();
  }
  function heart(x, y, s, col = '#ff5c8a', a = 1) {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 7); X.bezierCurveTo(-14, -2, -7, -12, 0, -5); X.bezierCurveTo(7, -12, 14, -2, 0, 7); X.closePath(); ink(col, 2.5);
    X.fillStyle = 'rgba(255,255,255,.7)'; el(-4, -4, 2.2, 1.4, -.5); X.fill(); X.restore();
  }
  function sunRays(x, y, T, r = 30) {
    X.save(); X.translate(x, y); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, r + 4); X.lineTo(8, r + 4); X.lineTo(0, r + 40); X.closePath(); X.fill(); }
    X.restore(); X.beginPath(); X.arc(x, y, r, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(x - 9, y - 10, 10, 6, -.6); X.fill();
  }
  function wall(x0, x1, y0, y1, c0, c1) { const g = X.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); X.fillStyle = g; X.fillRect(x0, y0, x1 - x0, y1 - y0); }
  function flower(x, y, s, col) { X.save(); X.translate(x, y); X.scale(s, s); for (let p = 0; p < 5; p++) { X.rotate(TAU / 5); el(0, -5, 3.4, 5); ink(col, 1.5); } X.beginPath(); X.arc(0, 0, 3, 0, TAU); ink('#ffe14d', 1.5); X.restore(); }

  /* ═════════════ FLAP: a deli at closing time; Claude with a propeller beanie flies between hanging salamis and baguettes ═════════════ */
  let FLB = null, FLF = null, FLW = -1;
  function flapBg() {
    if (FLB && FLW === VW) return;
    FLW = VW; const L = -OX - 2, R = W + OX + 2;
    FLB = bake(() => {
      wall(L, R, 0, 530, '#ffe6a8', '#ffcf86');
      X.strokeStyle = 'rgba(200,120,70,.18)'; X.lineWidth = 2;                                   // subway tiles
      for (let y = 44; y < 524; y += 38) { X.beginPath(); X.moveTo(L, y); X.lineTo(R, y); X.stroke(); for (let x = (Math.round(y / 38) % 2 ? 0 : 40) + Math.floor(L / 80) * 80; x < R; x += 80) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 38); X.stroke(); } }
      // window with a plain blue day behind it
      rr(332, 108, 150, 150, 10); ink('#9fe0ff', 5); X.save(); rr(332, 108, 150, 150, 10); X.clip(); X.fillStyle = '#e4f5ff'; el(380, 150, 26, 14); X.fill(); el(440, 190, 20, 11); X.fill(); X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.moveTo(332, 258); X.lineTo(400, 108); X.lineTo(430, 108); X.lineTo(362, 258); X.fill(); X.restore();
      rr(332, 108, 150, 150, 10); X.lineWidth = 10; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#fff'; X.stroke();
      line([[407, 110], [407, 256]], 5, '#fff'); line([[334, 183], [480, 183]], 5, '#fff');
      rr(318, 252, 178, 16, 6); ink('#d9944f', 4);
      // pantry shelf with jars, far left and far right of the action
      for (const sx of [-OX + 20, 560]) {
        rr(sx, 330, W + OX - sx > 300 ? 250 : 220, 12, 4); ink('#b06d33', 3.5);
        for (let i = 0; i < 4; i++) { const jx = sx + 14 + i * 56, h = 36 + hr(i + sx) * 14, c = ['#ff7a6b', '#7fd34a', '#ffd23f', '#c68bff'][i]; rr(jx, 330 - h, 40, h, 8); ink('#e9f7ff', 3); rr(jx + 4, 330 - h * .6, 32, h * .55 - 3, 5); X.fillStyle = c; X.fill(); rr(jx + 6, 330 - h - 7, 28, 8, 3); ink('#b06d33', 2.5); }
      }
      // cuckoo clock (the pendulum and the bird are live)
      X.beginPath(); X.moveTo(588, 128); X.lineTo(640, 82); X.lineTo(692, 128); X.closePath(); ink('#a5622c', 4);
      rr(596, 124, 88, 92, 8); ink('#d9944f', 4); rr(612, 138, 56, 40, 14); ink('#7a4a2c', 3.5); X.beginPath(); X.arc(640, 196, 14, 0, TAU); ink('#fff', 3);
      X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(640, 196); X.lineTo(640, 187); X.moveTo(640, 196); X.lineTo(647, 199); X.stroke();
      // the ceiling rail with its hooks
      X.fillStyle = '#8a5530'; X.fillRect(L, 0, R - L, 40); X.fillStyle = '#a5622c'; X.fillRect(L, 0, R - L, 12); X.fillStyle = INK; X.fillRect(L, 38, R - L, 4);
      X.strokeStyle = '#6e4224'; X.lineWidth = 2; for (let x = Math.floor(L / 90) * 90; x < R; x += 90) { X.beginPath(); X.moveTo(x, 12); X.lineTo(x, 38); X.stroke(); }
    });
    FLF = bake(() => {   // the counter in front: planks, a lip, and a few crumbs
      const g = X.createLinearGradient(0, 524, 0, H); g.addColorStop(0, '#b97a46'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(L, 524, R - L, H - 524);
      X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(L, 530, R - L, 6);
      X.strokeStyle = 'rgba(90,50,24,.5)'; X.lineWidth = 2; for (let x = Math.floor(L / 130) * 130; x < R; x += 130) { X.beginPath(); X.moveTo(x, 538); X.lineTo(x - 18, H); X.stroke(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, 524); X.lineTo(R, 524); X.stroke();
      X.fillStyle = '#f7d08a'; for (let i = 0; i < 26; i++) { el(L + hr(i + 5) * (R - L), 530 + hr(i + 60) * 18, 2.5, 1.7); X.fill(); }
    });
  }
  function salami(q, i, look, T, res, bad) {          // hanging salami, twine knot at the bottom (the cap)
    const b = q.gy - 95, capT = b - 24, x = q.x - 45, len = capT - 36;
    if (len < 6) return;
    const body = () => rr(x, 36, 90, len, 22), cap = () => rr(q.x - 54, capT, 108, 24, 9);
    X.strokeStyle = '#e6c58c'; X.lineWidth = 5; X.beginPath(); X.moveTo(q.x, 30); X.lineTo(q.x, 42); X.stroke();   // loop on the hook
    celF(body, '#e0564b', '#a8323a', 11, 0, 4.5); glint(body, x + 20, 70, 7, Math.min(24, len * .3), .42, 0);
    X.save(); body(); X.clip(); X.fillStyle = 'rgba(255,230,214,.8)'; for (let k = 0; k < 14; k++) { el(x + 10 + hr(k + i * 20) * 70, 44 + hr(k + 50 + i * 9) * Math.max(1, len - 14), 3.4 + hr(k) * 2, 2.6); X.fill(); }
    X.strokeStyle = '#e6c58c'; X.lineWidth = 3.5; for (let yy = 70; yy < capT - 10; yy += 46) { X.beginPath(); X.moveTo(x, yy); X.quadraticCurveTo(q.x, yy + 6, x + 90, yy); X.stroke(); } X.restore();
    celF(cap, '#efd29a', '#c9a265', 0, 6, 4); X.save(); cap(); X.clip(); X.strokeStyle = 'rgba(150,100,40,.55)'; X.lineWidth = 2; for (let k = -30; k < 130; k += 14) { X.beginPath(); X.moveTo(q.x - 54 + k, capT); X.lineTo(q.x - 54 + k + 24, capT + 24); X.stroke(); } X.restore();
    if (len >= 38) { const fy = Math.min(capT - 16, 40 + len * .5), r = Math.min(10, len / 6 + 3), m = res === 'win' ? 'happy' : res === 'lose' ? 'idle' : bad ? 'wide' : 'idle';
      eye(q.x - 15, fy, r, m, look[0], look[1], T, i); eye(q.x + 15, fy, r, m, look[0], look[1], T, i + .5);
      X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); if (res === 'win') X.arc(q.x, fy + r * 1.1, 6, .15, Math.PI - .15); else if (bad) X.ellipse(q.x, fy + r * 2, 4, 3, 0, 0, TAU); else { X.moveTo(q.x - 6, fy + r * 1.8); X.lineTo(q.x + 6, fy + r * 1.8); } X.stroke();
      if (!bad && res !== 'win') { X.beginPath(); X.moveTo(q.x - 24, fy - r * 1.8); X.lineTo(q.x - 7, fy - r * 1.4); X.moveTo(q.x + 24, fy - r * 1.8); X.lineTo(q.x + 7, fy - r * 1.4); X.stroke(); } }
  }
  function baguette(q, i, look, T, res, bad) {        // baguette in a paper cuff, standing on the counter (the cap is the cuff)
    const b = q.gy + 95, x = q.x - 45, bh = 540 - (b + 12);
    const body = () => rr(x, b + 12, 90, bh, 30), cuff = () => rr(q.x - 54, b, 108, 24, 9);
    celF(body, '#e9ae5c', '#b9742e', 11, 0, 4.5); glint(body, x + 20, b + 48, 6, 22, .4, 0);
    X.save(); body(); X.clip(); for (let yy = b + 52, k = 0; yy < 530; yy += 62, k++) { X.save(); X.translate(q.x + (k % 2 ? 6 : -6), yy); X.rotate(-.6); rr(-24, -5, 48, 10, 5); X.fillStyle = '#f9dd9d'; X.fill(); X.strokeStyle = '#b9742e'; X.lineWidth = 2; X.stroke(); X.restore(); } X.restore();
    celF(cuff, '#f9f2e2', '#d8c9a8', 0, 6, 4); X.fillStyle = '#e8434f'; X.fillRect(q.x - 52, b + 9, 104, 5);
    if (540 - b - 12 > 100) { const fy = b + 62, r = 9, m = res === 'win' ? 'happy' : bad ? 'wide' : 'idle';
      eye(q.x - 14, fy, r, m, look[0], look[1], T, i + 3); eye(q.x + 14, fy, r, m, look[0], look[1], T, i + 3.5);
      X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); if (res === 'win') X.arc(q.x, fy + 10, 6, .15, Math.PI - .15); else if (bad) X.ellipse(q.x, fy + 17, 4, 3, 0, 0, TAU); else { X.moveTo(q.x - 6, fy + 16); X.quadraticCurveTo(q.x, fy + 12, q.x + 6, fy + 16); } X.stroke(); }
  }
  function beanie(u, T, spin, off) {     // propeller beanie on Claude's head (drawn in Claude's rotated frame, origin = feet)
    X.save(); X.translate(0, -9 * u);
    const dome = () => { X.beginPath(); X.moveTo(-3.8 * u, 0); X.bezierCurveTo(-3.8 * u, -4.4 * u, 3.8 * u, -4.4 * u, 3.8 * u, 0); X.closePath(); };
    celF(dome, '#4dd0ff', '#2a8fcb', 1.2 * u, 0, 3.5); glint(dome, -1.4 * u, -2.6 * u, 1.3 * u, .7 * u, .5, -.5);
    X.fillStyle = '#ffd23f'; X.fillRect(-.35 * u, -4.1 * u, .7 * u, 1.3 * u); X.beginPath(); X.arc(0, -4.4 * u, .8 * u, 0, TAU); ink('#ff4d5e', 2);
    X.translate(0, -4.8 * u); const a = Math.abs(Math.sin(spin * 2)) * 1; el(0, 0, 4.4 * u * (.25 + a * .75), .55 * u); ink(off ? '#c9ced6' : '#ff5c8a', 2.5);
    X.restore();
  }
  function flap(s) {
    X = ctx; flapBg();
    const { pipes, py, vy, res, rT, T } = s, won = res === 'win', lost = res === 'lose';
    X.drawImage(FLB, -OX, 0);
    // cat in the window: tail swings, eyes follow Claude, startled on a crash, winks on a win
    { const cx = 410, cy = 252, sw = Math.sin(T * 2.2) * 10;
      X.strokeStyle = INK; X.lineCap = 'round'; X.lineWidth = 17; X.beginPath(); X.moveTo(cx + 34, cy - 4); X.quadraticCurveTo(cx + 62, cy + 6, cx + 56 + sw, cy - 34); X.stroke(); X.strokeStyle = '#f0a05a'; X.lineWidth = 10; X.stroke();
      const body = () => el(cx, cy - 12, 40, 28); celF(body, '#f0a05a', '#c97b36', 8, 0, 4.5); glint(body, cx - 14, cy - 24, 12, 6, .4);
      const head = () => el(cx - 12, cy - 46, 25, 21); X.beginPath(); X.moveTo(cx - 33, cy - 54); X.lineTo(cx - 36, cy - 76); X.lineTo(cx - 20, cy - 62); X.moveTo(cx + 9, cy - 54); X.lineTo(cx + 12, cy - 76); X.lineTo(cx - 4, cy - 62); ink('#f0a05a', 3.5);
      celF(head, '#f0a05a', '#c97b36', 6, 0, 4);
      X.strokeStyle = '#c97b36'; X.lineWidth = 3; for (const d of [-1, 0, 1]) { X.beginPath(); X.moveTo(cx - 12 + d * 8, cy - 66); X.lineTo(cx - 12 + d * 8, cy - 58); X.stroke(); }
      const lk = [Math.max(-1, Math.min(1, (180 - cx) / 200)), Math.max(-1, Math.min(1, (py - cy) / 200))], m = lost ? 'wide' : won ? 'happy' : 'idle';
      eye(cx - 22, cy - 46, 6.5, m, lk[0], lk[1], T, 7); eye(cx - 2, cy - 46, 6.5, m, lk[0], lk[1], T, 7.4);
      X.beginPath(); X.moveTo(cx - 14, cy - 40); X.lineTo(cx - 10, cy - 40); X.lineTo(cx - 12, cy - 37); X.closePath(); X.fillStyle = '#ff7a9a'; X.fill(); }
    // cuckoo: pendulum + the bird that pops out every few seconds (and cheers on a win)
    { const pa = Math.sin(T * 3) * .35; X.save(); X.translate(640, 216); X.rotate(pa); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 30); X.stroke(); X.beginPath(); X.arc(0, 36, 8, 0, TAU); ink('#ffd23f', 3); X.restore();
      const k = won ? 1 : Math.max(0, 1 - Math.abs(((T % 3.4) - .3) / .3)); if (k > .02) { const bx = 640 + 12 - 28 * (1 - ease(k)) * 0 , by = 158; rr(612, 138, 56, 40, 14); X.save(); X.clip(); X.translate(0, (1 - ease(k)) * 36);
        el(bx - 12, by + 4, 11, 9); ink('#ff5c8a', 3); X.beginPath(); X.moveTo(bx - 22, by + 2); X.lineTo(bx - 34, by + 6 + Math.sin(T * 30) * 2); X.lineTo(bx - 22, by + 8); X.closePath(); ink('#ffd23f', 2); X.beginPath(); X.arc(bx - 17, by, 1.8, 0, TAU); X.fillStyle = INK; X.fill(); X.restore(); } }
    // pipes: salami above, baguettes below. Faces follow Claude, go wide when it is close
    for (let i = 0; i < pipes.length; i++) { const q = pipes[i]; if (q.x < -OX - 60 || q.x > W + OX + 70) continue;
      const d = Math.abs(q.x - 180), bad = !res && d < 120, lk = [Math.max(-1, Math.min(1, (180 - q.x) / 200)), Math.max(-1, Math.min(1, (py - q.gy) / 200))];
      salami(q, i, lk, T, res, bad); baguette(q, i, lk, T, res, bad); }
    X.drawImage(FLF, -OX, 0);
    // a mouse jogs along the counter edge
    { const mx = (((-T * 70 + 900) % (VW + 160)) + VW + 160) % (VW + 160) - OX - 40, my = 540, f = Math.sin(T * 24) * 2;
      X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath(); X.moveTo(mx + 14, my - 4); X.quadraticCurveTo(mx + 30, my + 4, mx + 38, my - 8 + f); X.stroke(); X.strokeStyle = '#f4a6b5'; X.lineWidth = 2; X.stroke();
      const mb = () => el(mx, my - 7, 15, 9); celF(mb, '#c9ced6', '#8f9cb3', 3, 0, 3.5); el(mx - 9, my - 15, 6, 6); ink('#f4a6b5', 2.5); X.beginPath(); X.arc(mx - 10, my - 8, 1.9, 0, TAU); X.fillStyle = INK; X.fill(); X.beginPath(); X.arc(mx - 16, my - 6, 2, 0, TAU); X.fillStyle = '#ff5c8a'; X.fill();
      for (const lx of [-6, 6]) { el(mx + lx, my + 1 + (lx > 0 ? f : -f) * .5, 3, 2); ink('#8f9cb3', 2); } }
    // Claude
    const u = 8; let fy = py, rot = Math.max(-.5, Math.min(.8, vy / 900)), jump = 0;
    if (lost) { const g = Math.min(1, rT / .8); fy = Math.min(528, py + 700 * rT * rT); if (fy >= 528 && py < 528) fy = 528 - Math.abs(Math.sin(Math.max(0, rT - .5) * 9)) * 10 * Math.max(0, 1 - rT); rot = rot + (1 - ease(g)) * rT * 9; }
    if (won) { const g = ease(Math.min(1, rT / .4)); rot = g * TAU * 1; jump = Math.abs(Math.sin(rT * 8)) * 8; }
    shadow(180, 540, 42 - Math.max(0, Math.min(24, (540 - fy) / 20)), 8, .25);
    X.save(); X.translate(180, fy - jump); X.rotate(rot);
    const flapK = Math.max(0, Math.min(1, .5 - vy / 1000)), la = won ? -.3 : lost ? -2.4 : -2.2 + flapK * 1.9 + Math.sin(T * 30) * .12 * (vy < -200 ? 1 : 0);
    arms(u, la, -la, .9, OR);
    const mood = won ? 'happy' : lost ? 'sad' : null; claude(0, 0, u, { mood });
    if (!mood) { let near = null; for (const q of pipes) if (q.x > 120 && (!near || q.x < near.x)) near = q;
      const lk = near ? [Math.max(-1, Math.min(1, (near.x - 180) / 160)), Math.max(-1, Math.min(1, (near.gy - py) / 120))] : [.4, 0];
      const danger = near && near.x - 50 < 180 + 130 && (py - 80 < near.gy - 95 + 34 || py > near.gy + 95 - 34);
      eyes(0, 0, u, OR, lk, danger ? 'panic' : null, T);
      if (danger) for (const d of [-1, 1]) { const qq = (T * 2.6 + (d > 0 ? .5 : 0)) % 1; drop(d * 8 * u, -8 * u + qq * 14, u / 7, 1 - qq); } }
    if (!lost) beanie(u, T * (won ? 3 : 1) * 10 + (vy < -150 ? T * 20 : 0), T * 14, false);
    X.restore();
    if (lost) {   // the beanie pops off and tumbles away; stars circle the dizzy head
      const bx = 180 + rT * 110, by = py - 70 - rT * 280 + 900 * rT * rT * .5; X.save(); X.translate(bx, by); X.rotate(rT * 12); beanie(u * .9, 0, rT * 6, true); X.restore();
      if (rT > .35) stars(180, fy - 11 * u, 5 * u, T);
      if (rT > .3 && fy >= 520) { const k = ease((rT - .3) / .5); X.fillStyle = `rgba(255,240,214,${.8 * (1 - k)})`; for (const d of [-1, 1]) { X.beginPath(); X.arc(180 + d * (30 + k * 40), 520 - k * 8, 12 + k * 14, 0, TAU); X.fill(); } }
    }
    if (won) {   // payoff staged left of the NICE! stamp: hearts drift up the left edge, a whee ring + stars around Claude
      for (let i = 0; i < 5; i++) { const q = (rT * 1.4 + i / 5) % 1; heart(48 + (i % 3) * 38 + Math.sin(i * 2.4 + rT * 3) * 8, fy + 40 - q * 150, 1.1 + (i % 2) * .3, '#ff5c8a', 1 - q); }
      const rk = Math.min(1, rT / .6); X.strokeStyle = `rgba(255,225,77,${1 - rk})`; X.lineWidth = 5; X.beginPath(); X.arc(180, fy, 50 + rk * 60, 0, TAU); X.stroke();
      for (let i = 0; i < 3; i++) star(60 + i * 40, 130 + (i % 2) * 36 + Math.sin(rT * 5 + i) * 6, 11, 5, 5, rT * 3 + i, '#FFE14D', 3);
    }
    vignette(.16);
  }

  /* ═════════════ CHARGE: a carnival lawn. Stretch the trampoline, ring the strength-tester bell, land on the giraffe's tray ═════════════ */
  let CHA = null, CHB = null, CHW = -1;
  function chargeBg() {
    if (CHA && CHW === VW) return;
    CHW = VW; const L = -OX - 2, R = W + OX + 2, GY = 500;
    CHA = bake(() => { const g = X.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, GY + 4); });
    CHB = bake(() => {
      X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, GY); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 420 - Math.sin(x * .011 + 1) * 24 - Math.sin(x * .027) * 8); X.lineTo(R, GY); X.closePath(); X.fill();
      X.beginPath(); X.moveTo(L, GY); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 458 - Math.sin(x * .014 + 3) * 14); X.lineTo(R, GY); X.closePath(); X.fillStyle = '#87d19b'; X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
      // far circus tent with a flag (coloured outline, it is far away)
      X.save(); X.translate(450, 470);
      X.beginPath(); X.moveTo(-70, 30); X.lineTo(-70, -12); X.lineTo(0, -62); X.lineTo(70, -12); X.lineTo(70, 30); X.closePath(); X.fillStyle = '#ff9aa8'; X.fill(); X.strokeStyle = '#c75b78'; X.lineWidth = 3; X.stroke();
      X.fillStyle = '#fff3f5'; for (let i = -2; i <= 2; i += 2) { X.beginPath(); X.moveTo(i * 14 - 14, 30); X.lineTo(i * 14 - 14, -12); X.lineTo(0, -62); X.lineTo(i * 14 + 14, -12); X.lineTo(i * 14 + 14, 30); X.closePath(); X.globalAlpha = .0; X.fill(); X.globalAlpha = 1; }
      for (let i = -3; i <= 3; i += 2) { X.beginPath(); X.moveTo(0, -62); X.lineTo(i * 10 - 10, -12 + Math.abs(i) * 0); X.lineTo(i * 10 + 10, -12); X.closePath(); X.fillStyle = '#fff3f5'; X.fill(); }
      X.beginPath(); X.moveTo(-70, -12); X.lineTo(0, -62); X.lineTo(70, -12); X.strokeStyle = '#c75b78'; X.lineWidth = 3; X.stroke();
      rr(-16, 4, 32, 26, 12); X.fillStyle = '#c75b78'; X.fill(); X.strokeStyle = '#c75b78'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, -62); X.lineTo(0, -82); X.stroke(); X.beginPath(); X.moveTo(0, -82); X.lineTo(22, -76); X.lineTo(0, -70); X.fillStyle = '#ffd23f'; X.fill(); X.restore();
      // the lawn
      const g = X.createLinearGradient(0, GY, 0, H); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, GY, R - L, H - GY);
      X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = Math.floor(L / 80) * 80; x < R; x += 160) { X.beginPath(); X.moveTo(x, GY); X.lineTo(x + 60, GY); X.lineTo(x + 20, H); X.lineTo(x - 40, H); X.fill(); }
      X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(L, GY); X.lineTo(R, GY); X.stroke();
      for (let i = 0; i < 34; i++) tuft(L + hr(i + 3) * (R - L), GY + 14 + hr(i + 40) * 36);
      for (let i = 0; i < 9; i++) flower(L + hr(i + 90) * (R - L), GY + 14 + hr(i + 70) * 34, .9, i % 3 ? '#fff' : '#ff9dc0');
      // the strength tester: base, tube, ticks (the fill, the green zone and the bell are live)
      rr(70, 486, 90, 26, 6); ink('#d9944f', 4); X.fillStyle = '#b06d33'; X.fillRect(78, 502, 74, 5);
      const tube = () => rr(88, 146, 54, 350, 14); celF(tube, '#fff', '#c9d8ee', 9, 0, 4.5); glint(tube, 100, 230, 5, 70, .5, 0);
      X.strokeStyle = 'rgba(20,16,28,.55)'; X.lineWidth = 2.5; for (let i = 1; i < 10; i++) { const y = 500 - i * 35; X.beginPath(); X.moveTo(88, y); X.lineTo(i % 2 ? 100 : 108, y); X.stroke(); }
      rr(110, 120, 10, 28, 3); ink('#b06d33', 3);
    });
  }
  function bell(x, y, ring, T) {   // brass bell on top of the tester; ring 0..1 swings it
    X.save(); X.translate(x, y); X.rotate(Math.sin(T * 40) * .35 * ring);
    const b = () => { X.beginPath(); X.moveTo(-20, 14); X.quadraticCurveTo(-18, -22, 0, -22); X.quadraticCurveTo(18, -22, 20, 14); X.closePath(); };
    celF(b, '#ffd23f', '#c99512', 6, 0, 3.5); glint(b, -8, -8, 4, 9, .6, .2); X.beginPath(); X.arc(0, 18, 5, 0, TAU); ink('#c99512', 2.5); X.restore();
    if (ring > .05) { X.strokeStyle = `rgba(255,225,77,${ring})`; X.lineWidth = 4; X.lineCap = 'round'; for (const d of [-1, 1]) for (let k = 0; k < 2; k++) { X.beginPath(); X.arc(x, y, 30 + k * 10, d > 0 ? -.5 : Math.PI - .5 - .0, d > 0 ? .5 : Math.PI + .5); X.stroke(); } }
  }
  function giraffe(hx, ty, T, mood, lx, ly, dip) {
    const bx = hx + 86, hy = ty + 34 + dip;
    // legs + tail + body
    const legs = [-38, -16, 14, 36];
    for (let i = 0; i < 4; i++) { const lg = () => rr(bx + legs[i] - 7, 462, 14, 38, 5); celF(lg, '#ffd35a', '#e0a52e', 4, 0, 3.5); X.fillStyle = '#6a4630'; X.fillRect(bx + legs[i] - 7, 492, 14, 8); }
    X.strokeStyle = INK; X.lineCap = 'round'; X.lineWidth = 12; X.beginPath(); X.moveTo(bx + 48, 448); X.quadraticCurveTo(bx + 66, 456 + Math.sin(T * 3) * 4, bx + 64, 480); X.stroke(); X.strokeStyle = '#ffd35a'; X.lineWidth = 6; X.stroke();
    // neck: a slanted column from the body up to the head (the tray sits on top)
    const neck = () => { X.beginPath(); X.moveTo(hx - 22, hy); X.lineTo(hx + 22, hy); X.bezierCurveTo(hx + 26, hy + (448 - hy) * .5, bx - 4, 440, bx + 6, 440); X.lineTo(bx - 40, 456); X.bezierCurveTo(bx - 40, 420, hx - 24, hy + (448 - hy) * .4, hx - 22, hy); X.closePath(); };
    celF(neck, '#ffd35a', '#e0a52e', 10, 0, 4.5); X.save(); neck(); X.clip(); X.fillStyle = '#c9803a'; const nl = 448 - hy; for (let k = 0; k < Math.max(2, Math.floor(nl / 46)); k++) { const f = (k + .5) / Math.max(2, Math.floor(nl / 46)), cx = lerp(hx, bx - 14, f) + (k % 2 ? 8 : -6), cy = hy + nl * f; el(cx, cy, 9, 7.5, .3); X.fill(); } X.restore();
    const body = () => el(bx, 450, 56, 32); celF(body, '#ffd35a', '#e0a52e', 9, -7, 4.5);
    X.save(); body(); X.clip(); X.fillStyle = '#c9803a'; for (const [a, b, r] of [[-26, 444, 9], [4, 460, 8], [28, 442, 10], [-4, 436, 6]]) { el(bx + a, b, r, r * .8); X.fill(); } X.restore();
    // head
    const ears = (s) => { X.save(); X.translate(hx + s * 33, hy - 6); X.rotate(s * (.5 + Math.sin(T * 2 + s) * .08)); el(0, 0, 12, 6); ink('#ffd35a', 3); el(1 * s, 0, 6, 2.5); X.fillStyle = '#ff9db0'; X.fill(); X.restore(); };
    ears(-1); ears(1);
    const head = () => el(hx, hy, 31, 26); celF(head, '#ffd35a', '#e0a52e', 8, 0, 4.5);
    el(hx, hy + 12, 19, 12); ink('#fff0b8', 3); for (const d of [-1, 1]) { X.beginPath(); X.arc(hx + d * 7, hy + 13, 2.2, 0, TAU); X.fillStyle = INK; X.fill(); }
    const m = mood === 'happy' ? 'happy' : mood === 'worry' ? 'wide' : mood === 'sad' ? 'shut' : 'idle';
    eye(hx - 13, hy - 6, 7.5, m, lx, ly, T, 11); eye(hx + 13, hy - 6, 7.5, m, lx, ly, T, 11.4);
    X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; for (const d of [-1, 1]) { X.beginPath(); if (mood === 'worry' || mood === 'sad') { X.moveTo(hx + d * 19, hy - 19); X.lineTo(hx + d * 7, hy - 15); } else { X.moveTo(hx + d * 20, hy - 18); X.lineTo(hx + d * 8, hy - 19); } X.stroke(); }
    if (mood === 'happy') { X.fillStyle = 'rgba(255,110,165,.7)'; for (const d of [-1, 1]) { el(hx + d * 22, hy + 3, 6, 3.5); X.fill(); } X.beginPath(); X.arc(hx, hy + 19, 5, .1, Math.PI - .1); X.lineWidth = 3; X.stroke(); }
    // ossicones peeking out beside the tray
    for (const d of [-1, 1]) { X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.moveTo(hx + d * 17, hy - 22); X.lineTo(hx + d * 18, hy - 30); X.stroke(); X.strokeStyle = '#c9803a'; X.lineWidth = 4; X.stroke(); }
    // silver serving tray balanced on top: the landing pad
    const tray = () => rr(hx - 42, ty + dip - 2, 84, 16, 7); celF(tray, '#cfd8e6', '#8f9cb3', 0, 5, 4); glint(tray, hx - 18, ty + dip + 2, 16, 2.2, .7, 0);
    if (mood === 'worry') { const q = (T * 2) % 1; drop(hx + 32, hy - 18 + q * 14, .8, 1 - q); }
    return hy;
  }
  function charge(s) {
    X = ctx; chargeBg();
    const { p, zc, zw, GY, LH, hold, fired, jt, endX, endY, A, res, T } = s, won = res === 'win', lost = res === 'lose', inz = p >= zc - zw / 2 && p <= zc + zw / 2, over = p > zc + zw / 2;
    X.drawImage(CHA, -OX, 0);
    sunRays(300, 104, T, 28);
    for (let i = 0; i < 4; i++) cloud((T * (5 + i * 2) + i * 260 + 40) % (VW + 200) - OX - 120, 78 + (i % 2) * 26, .5 + (i % 3) * .1);
    X.drawImage(CHB, -OX, 0);
    const k = fired ? Math.min(1, jt / .7) : 0, platY = GY - LH, land = fired && jt >= .7, lt = Math.max(0, jt - .7);
    // strength tester live parts: the green zone, the fill, the puck and the bell
    const zy = 500 - (zc + zw / 2) * 3.5, zh = zw * 3.5;
    X.save(); rr(88, 146, 54, 350, 14); X.clip(); rr(88, zy, 54, zh, 0); X.fillStyle = hold && inz ? '#c8ffd2' : '#5CFF7A'; X.fill(); X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(92, zy, 8, zh);
    X.fillStyle = '#ffd23f'; X.fillRect(94, 500 - p * 3.5, 42, p * 3.5 + 2); X.fillStyle = '#fff3a0'; X.fillRect(98, 500 - p * 3.5, 6, p * 3.5 + 2); X.restore();
    X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(88, zy); X.lineTo(142, zy); X.moveTo(88, zy + zh); X.lineTo(142, zy + zh); X.stroke();
    X.beginPath(); X.moveTo(72, zy + zh / 2 - 9); X.lineTo(86, zy + zh / 2); X.lineTo(72, zy + zh / 2 + 9); X.closePath(); ink('#5CFF7A', 2.5);
    rr(78, 500 - p * 3.5 - 5, 74, 10, 5); ink(over ? '#ff4d5e' : '#fff', 3);
    bell(115, 126, won ? Math.max(0, 1 - Math.max(0, jt - .6) / .35) * (jt > .6 ? 1 : 0) : (hold && inz ? .5 : 0), T);
    // the giraffe: watches the charge, beams on a win, winces on a loss
    const gm = won ? 'happy' : lost ? 'sad' : hold && over ? 'worry' : 'idle';
    const lkx = Math.max(-1, Math.min(1, (300 - 580) / 280)), lky = .2;
    const dip = won && land ? Math.sin(Math.min(1, lt / .5) * Math.PI * 2) * 7 * Math.max(0, 1 - lt / .5) + Math.min(1, lt / .1) * 3 : 0;
    giraffe(580, platY, T, gm, won && !land ? Math.max(-1, Math.min(1, (endX - 300) / 280 * k - 0)) * -1 : lkx, won && !land ? -.6 : lky, dip);
    if (won && jt > .55) for (let i = 0; i < 4; i++) { const q = ((jt - .55) * 1.6 + i / 4) % 1; heart(580 - 52 - (i % 2) * 22 + Math.sin(q * 6 + i) * 5, platY + 36 - q * 70, .9, '#ff5c8a', 1 - q); }   // hearts drift up on the giraffe's left, clear of Claude and the NICE! stamp
    // the trampoline on the lawn: its mat sags as the charge grows and bounces after the launch
    const sag = hold ? p / 100 : fired ? Math.max(0, Math.sin(Math.min(1, jt / .35) * Math.PI * 2) * .5 * (1 - jt / .35)) : 0;
    shadow(300, GY + 12, 82, 10, .28); X.save(); X.translate(300, GY + 4);
    for (const d of [-1, 1]) { rr(d * 62 - 5, 8, 10, 22, 4); ink('#8f9cb3', 3); }
    el(0, 0, 76, 16); ink('#ff4d5e', 4); el(0, 1 + sag * 3, 62, 11 + sag * 2); ink('#4DB8FF', 3); el(0, 3 + sag * 7, 38, 5 + sag * 2); X.fillStyle = '#2a8fcb'; X.fill(); X.fillStyle = 'rgba(255,255,255,.4)'; el(-26, -7, 18, 3, -.1); X.fill(); X.restore();
    // Claude
    const u = 9;
    if (!fired) {
      const sh = hold ? Math.sin(T * 60) * p / 100 * 2 : 0; X.save(); X.translate(300 + sh, GY); X.scale(1 + p / 400, 1 - p / 100 * .35);
      arms(u, hold ? -1.5 : -2.4, hold ? 1.5 : 2.4, .85, OR); claude(0, 0, u, { mood: null });
      eyes(0, 0, u, OR, [.8, -.3], hold ? (over ? 'panic' : 'bonk') : null, T);
      X.restore();
      if (hold) { for (const d of [-1, 1]) { const qq = (T * 2.2 + (d > 0 ? .5 : 0)) % 1; if (p > 35) drop(300 + d * 7 * u, GY - 8.5 * u + qq * 14, u / 7, 1 - qq); }
        if (p > 50) for (const d of [-1, 1]) { const qq = (T * 3 + (d > 0 ? .4 : 0)) % 1; el(300 + d * (8 * u + qq * 22), GY - 8 * u - qq * 22, 5 + qq * 6, 4 + qq * 4); X.fillStyle = `rgba(255,255,255,${.8 * (1 - qq)})`; X.fill(); } }
    } else {
      const x = 300 + (endX - 300) * k, y = endY * k + A * 4 * k * (1 - k), cy = GY - y;
      for (let i = 1; i <= 5; i++) { const k2 = Math.max(0, k - i * .05); if (k2 <= 0 || k >= 1) break; el(300 + (endX - 300) * k2, GY - (endY * k2 + A * 4 * k2 * (1 - k2)) + 2 * 9 * .3, 7 - i, 6 - i); X.fillStyle = `rgba(255,255,255,${.5 - i * .08})`; X.fill(); }
      if (!land) {
        X.save(); X.translate(x, cy); if (lost) X.rotate(k * TAU * 1.5 * (endX > 600 ? 1 : -1)); arms(u, won ? -.3 : -2.6, won ? .3 : 2.6, .85, OR);
        claude(0, 0, u, { mood: won ? 'happy' : 'sad' }); X.restore();
      } else if (won) {
        const j = Math.abs(Math.sin(lt * 9)) * 10 * Math.max(0, 1 - lt / .4) ; const fx = endX + 26, fy = platY + dip - j, ul = 7;   // smaller and nudged right: the giraffe's face stays visible under the tray
        shadow(fx, platY + 2 + dip, 26, 5, .25); X.save(); X.translate(fx, fy); arms(ul, -.25, .25, .9, OR); claude(0, 0, ul, { mood: 'happy' }); X.restore();
        for (let i = 0; i < 3; i++) { const q = (lt * 2 + i / 3) % 1; star(fx + (i - 1) * 24, fy - 12 * ul - q * 20, 6, 2.6, 5, T * 4 + i, '#FFE14D', 2.5); }
      } else {
        const fx = endX, sq = Math.min(1, lt / .1); X.save(); X.translate(fx, GY); X.scale(1 + .35 * sq, 1 - .45 * sq); arms(u, -2.6, 2.6, .8, OR); claude(0, 0, u, { mood: 'sad' }); X.restore();
        stars(fx, GY - 8 * u, 4.5 * u, T);
        const q = Math.min(1, lt / .4); X.fillStyle = `rgba(217,160,102,${.75 * (1 - q)})`; for (const d of [-1, 1]) { X.beginPath(); X.arc(fx + d * (32 + q * 36), GY - 4 - q * 10, 12 + q * 12, 0, TAU); X.fill(); }
      }
    }
    vignette(.16);
  }

  return { maze, flap, charge };
})();

/* 29 ── MAZE: walk Claude to the star (arrows / WASD) */
function gMaze(sp) {
  const R = 4, C = sp > 1.5 ? 7 : 6, cs = Math.min(660 / C, 440 / R), ox = (W - C * cs) / 2, oy = 70 + (440 - R * cs) / 2;
  const wr = Array.from({ length: R }, () => Array(C).fill(true)), wd = Array.from({ length: R }, () => Array(C).fill(true));
  const vis = Array.from({ length: R }, () => Array(C).fill(0)); vis[0][0] = 1; const st = [[0, 0]];
  while (st.length) {
    const [r, c] = st[st.length - 1];
    const nb = [[r - 1, c, 'u'], [r + 1, c, 'd'], [r, c - 1, 'l'], [r, c + 1, 'r']].filter(([a, b]) => a >= 0 && a < R && b >= 0 && b < C && !vis[a][b]);
    if (!nb.length) { st.pop(); continue; }
    const [a, b, d] = nb[Math.random() * nb.length | 0];
    if (d === 'r') wr[r][c] = false; if (d === 'l') wr[r][c - 1] = false; if (d === 'd') wd[r][c] = false; if (d === 'u') wd[r - 1][c] = false;
    vis[a][b] = 1; st.push([a, b]);
  }
  const me = { r: 0, c: 0, x: ox + cs / 2, y: oy + cs / 2 }; let bump = 0;
  const art = { R, C, cs, ox, oy, wr, wd }, trail = [], look = [1, 0];   // art only: baked maze layer, footprints, gaze
  let rT0 = -1, el = 0, bonk = -1, pb = 0, lr = 0, lc = 0;
  const dirs = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const g = {
    cmd: 'MAZE!', wide: true, swipe: true, hint: 'REACH THE STAR WITH ARROWS', thint: 'SWIPE TO MOVE', dur: 7,
    key(e) {
      const d = dirs[e.code]; if (!d || g.result) return; const { r, c } = me;
      if (d === 'r' && c < C - 1 && !wr[r][c]) me.c++; else if (d === 'l' && c > 0 && !wr[r][c - 1]) me.c--;
      else if (d === 'd' && r < R - 1 && !wd[r][c]) me.r++; else if (d === 'u' && r > 0 && !wd[r - 1][c]) me.r--;
      else { sfx.miss(); shake(2, .08); bump = .15; return; }
      sfx.blip(me.r + me.c); burst(me.x, me.y + cs * .3, '#fff', 3, 100); if (me.r === R - 1 && me.c === C - 1) { g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(me.x, me.y, '#FFE14D', 18); ring(ox + (C - .5) * cs, oy + (R - .5) * cs, '#FFE14D', 90); floatText('NICE!', W / 2, 60, '#fff'); }
    },
    update(dt, tt) {
      if (g.result && rT0 < 0) rT0 = now;
      if (tt != null) el = tt;
      if (bump > pb) bonk = now; pb = bump;                                              // art only: bonk face after a wall hit
      if (me.r !== lr || me.c !== lc) { trail.push([ox + (lc + .5) * cs, oy + (lr + .5) * cs]); if (trail.length > 24) trail.shift(); look[0] = Math.sign(me.c - lc); look[1] = Math.sign(me.r - lr); lr = me.r; lc = me.c; }
      bump = Math.max(0, bump - dt);
      me.x += (ox + (me.c + .5) * cs - me.x) * Math.min(1, 20 * dt); me.y += (oy + (me.r + .5) * cs - me.y) * Math.min(1, 20 * dt);
    },
    draw() {
      if (g.result && rT0 < 0) rT0 = now;
      const moving = Math.hypot(ox + (me.c + .5) * cs - me.x, oy + (me.r + .5) * cs - me.y) > 2;
      W4A.maze({ m: art, me, bump, res: g.result, rT: now - rT0, T: now, left: 7 / Math.sqrt(sp) - el, look, trail, moving, bonk });
    }
  };
  return g;
}

/* 30 ── WIRES: connect matching colours (mouse: click left, then right) */
function gWires(sp) {
  const n = sp > 1.5 ? 4 : 3, ys = n === 3 ? [160, 290, 420] : [135, 240, 345, 450];
  const cols = ['#ff4d4d', '#4DB8FF', '#ffd23f', '#5CFF7A'].slice(0, n);
  const L = shuffle(cols.slice()), Rr = shuffle(cols.slice()), conns = []; let sel = -1, shk = 0;
  const g = {
    cmd: 'WIRES!', wide: true, hint: 'CLICK LEFT, THEN THE SAME COLOUR', thint: 'TAP LEFT, THEN SAME COLOUR', dur: 5.5,
    down(p) {
      const li = ys.findIndex((y, i) => Math.abs(p.x - 150) < 55 && Math.abs(p.y - y) < 36 && !conns.some(c => c.l === i));
      if (li >= 0) { sel = li; sfx.click(); ring(150, ys[li], '#fff', 50, .25); return; }
      const ri = ys.findIndex((y, i) => Math.abs(p.x - 650) < 55 && Math.abs(p.y - y) < 36 && !conns.some(c => c.r === i));
      if (ri >= 0 && sel >= 0) {
        if (L[sel] === Rr[ri]) { conns.push({ l: sel, r: ri }); sfx.zap(); sfx.blip(conns.length * 3); burst(650, ys[ri], L[sel], 10); ring(650, ys[ri], '#fff', 60, .3); if (conns.length === n) { g.result = 'win'; sfx.coin(); sfx.sparkle(); floatText('NICE!', W / 2, 90, '#fff'); } }
        else { shk = .3; sfx.buzz(); shake(4, .15); }
        sel = -1;
      }
    },
    update(dt) { shk = Math.max(0, shk - dt); },
    draw(t) {
      bg('#CDB4DB', '#c0a4d0', t);
      for (const c of conns) {
        ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(190, ys[c.l]); ctx.lineTo(610, ys[c.r]); ctx.stroke();
        ctx.strokeStyle = L[c.l]; ctx.lineWidth = 12; ctx.stroke(); ctx.lineCap = 'butt';
      }
      for (let i = 0; i < n; i++) {
        const dl = conns.some(c => c.l === i), dr = conns.some(c => c.r === i), sx = Math.sin(now * 80) * shk * 20;
        box3(110 + (sel === i ? Math.sin(now * 20) * 3 : 0), ys[i] - 32, 80, 64, L[i], 5); if (!dl) circ(190, ys[i], 10, INK, 0);
        box(610 + sx, ys[i] - 32, 80, 64, Rr[i], 5); if (!dr) circ(610 + sx, ys[i], 10, INK, 0);
      }
    }
  };
  return g;
}

reg('balance', gBalance, 'BALANCE');
reg('flip', gFlip, 'FLIP');
reg('charge', gCharge, 'CHARGE');
reg('flap', gFlap, 'FLAP');
reg('pong', gPong, 'PONG');
reg('crank', gCrank, 'CRANK');
reg('maze', gMaze, 'MAZE');
reg('wires', gWires, 'WIRES');
