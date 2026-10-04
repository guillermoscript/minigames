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
      if (fired) { const j0 = jt; jt += dt; if (j0 < .7 && jt >= .7) { if (g.result === 'win') { sfx.coin(); sfx.sparkle(); burst(endX, GY - endY, '#FFE14D', 16); ring(endX, GY - endY, '#fff', 90); floatText('NICE!', endX, GY - endY - 80, '#fff'); } else { sfx.thud(); shake(6, .22); burst(endX, GY, '#d9a066', 10); } } }
    },
    draw(t) {
      bg('#9BF6FF', '#87ecf7', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, GY - 4, VW, 110); ctx.fillStyle = '#58c24a'; ctx.fillRect(-OX, GY, VW, 100);
      box3(540, GY - LH, 80, 18, '#7a5230', 4, 5);
      box3(90, 150, 50, 350, '#fff', 6, 5);
      ctx.fillStyle = hold && p >= zc - zw / 2 && p <= zc + zw / 2 ? '#c8ffd2' : '#5CFF7A'; ctx.fillRect(90, 500 - (zc + zw / 2) * 3.5, 50, zw * 3.5);
      ctx.fillStyle = '#FFE14D'; ctx.fillRect(94, 500 - p * 3.5, 42, p * 3.5 - 2);
      ctx.fillStyle = INK; ctx.fillRect(80, 500 - p * 3.5 - 3, 70, 6);
      shadow(fired ? 300 + (endX - 300) * Math.min(1, jt / .7) : 300, GY + 6, 46 - (fired ? Math.sin(Math.min(1, jt / .7) * Math.PI) * 14 : 0), 12);
      if (!fired) { ctx.save(); ctx.translate(300, GY); ctx.scale(1 + p / 400, 1 - p / 100 * .35); claude(0, 0, 9, { mood: null }); ctx.restore(); }
      else {
        const k = Math.min(1, jt / .7), x = 300 + (endX - 300) * k, y = endY * k + A * 4 * k * (1 - k);
        claude(x, GY - y, 9, { mood: g.result === 'win' ? 'happy' : 'sad' });
      }
    }
  };
  return g;
}

/* 26 ── FLAP: slip through the gaps (space / up / click) */
function gFlap(sp) {
  const spd = 320 * sp; let py = 300, vy = 0;
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
    draw(t) {
      bg('#8FD3FF', '#7fc7f7', t);
      for (const q of pipes) {
        if (q.x < -OX - 60) continue;
        box(q.x - 45, 40, 90, q.gy - 95 - 40, '#5CC24A', 5); box(q.x - 54, q.gy - 95 - 24, 108, 24, '#4aa83a', 5);
        box(q.x - 45, q.gy + 95, 90, 560 - q.gy - 95, '#5CC24A', 5); box(q.x - 54, q.gy + 95, 108, 24, '#4aa83a', 5);
      }
      ctx.fillStyle = INK; ctx.fillRect(-OX, 524, VW, 80); ctx.fillStyle = '#d9a066'; ctx.fillRect(-OX, 530, VW, 80);
      shadow(180, 540, 40 - Math.max(0, Math.min(20, (540 - py) / 20)), 8, .25);
      ctx.save(); ctx.translate(180, py); ctx.rotate(Math.max(-.5, Math.min(.8, vy / 900)));
      claude(0, 0, 8, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null }); ctx.restore();
    }
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
  return { maze };
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
