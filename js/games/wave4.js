'use strict';
/* Wave 4 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 23 ── BALANCE: keep Claude upright on the ball (← → / A D, or mouse left-right of centre) */
function gBalance(sp) {
  let a = (Math.random() < .5 ? -1 : 1) * .12, w = 0, bx = 0, c = 0; const ph = Math.random() * 6;
  const g = {
    cmd: 'BALANCE!', hint: 'LEAN THE SAME WAY: ← → OR MOUSE', thint: 'TOUCH LEFT OR RIGHT', dur: 5, timeWin: true,
    update(dt) {
      if (g.result) return;
      c = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      if (!c) c = Math.max(-1, Math.min(1, (mouse.x - W / 2) / 250));
      w += (a * 5 * sp + Math.sin(now * 2.3 + ph) * 1.2 * sp - c * 11) * dt; w *= Math.pow(.4, dt); a += w * dt;
      bx += (c * 70 - bx) * Math.min(1, 8 * dt);
      if (Math.abs(a) > 1) { g.result = 'lose'; snd(110, .4, 'sawtooth', .12, 0, 40); }
    },
    draw(t) {
      bg('#FFB3D9', '#ff9fcd', t);
      ctx.fillStyle = INK; ctx.fillRect(0, 516, W, 90); ctx.fillStyle = '#9b6bd1'; ctx.fillRect(0, 524, W, 80);
      const cx = W / 2 + bx;
      circ(cx, 466, 50, '#4DB8FF', 5);
      ctx.save(); ctx.translate(cx, 466); ctx.rotate(bx / 50); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -48, 12, 96); ctx.fillRect(-48, -6, 96, 12); ctx.restore();
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
  const cards = kinds.map((k, i) => ({ k, x: x0 + i * (cw + gap), up: true, done: false }));
  let clock = 0, lock = 0, sel = [], pairs = 0, flipped = false; const peek = 1.6 / Math.sqrt(sp);
  const g = {
    cmd: 'FLIP!', hint: 'REMEMBER, THEN MATCH PAIRS', thint: 'REMEMBER, THEN TAP PAIRS', dur: 6.5,
    down(p) {
      if (clock < peek || lock > 0 || g.result) return;
      const c = cards.find(c => !c.up && !c.done && p.x > c.x && p.x < c.x + cw && p.y > 170 && p.y < 370);
      if (!c) return;
      c.up = true; sel.push(c); snd(500, .06);
      if (sel.length === 2) {
        if (sel[0].k === sel[1].k) { sel.forEach(c => c.done = true); sel = []; snd(900, .15); if (++pairs === n / 2) g.result = 'win'; }
        else lock = .5;
      }
    },
    update(dt) {
      clock += dt;
      if (clock >= peek && !flipped) { flipped = true; cards.forEach(c => c.up = false); snd(300, .08); }
      if (lock > 0 && (lock -= dt) <= 0) { sel.forEach(c => c.up = false); sel = []; }
    },
    draw(t) {
      bg('#FFE29A', '#ffd97f', t);
      for (const c of cards) {
        const cx = c.x + cw / 2;
        box(c.x, 170, cw, 200, c.done ? '#5CFF7A' : c.up ? '#fff' : '#7C4DFF', 6);
        if (!c.up && !c.done) txt('?', cx, 270, 70);
        else if (c.k === 0) circ(cx, 270, 38, '#ff4d4d', 5);
        else if (c.k === 1) star(cx, 270, 48, 22, 5, -Math.PI / 2, '#ffd23f', 5);
        else box(cx - 34, 236, 68, 68, '#4DB8FF', 5);
      }
      if (clock < peek) txt('MEMORISE!', W / 2, 110, 40, '#fff');
    }
  };
  return g;
}

/* 25 ── CHARGE: hold SPACE (or the mouse button), release inside the green zone */
function gCharge(sp) {
  const zc = 58 + Math.random() * 24, zw = 20, GY = 500, LH = zc * 3.8;
  let p = 0, hold = false, fired = false, jt = 0, endX = 300, endY = 0, A = 0;
  const start = () => { if (!fired && !g.result) hold = true; };
  const release = () => {
    if (!hold || g.result) return; hold = false; fired = true;
    const win = p >= zc - zw / 2 && p <= zc + zw / 2;
    endX = win ? 580 : p < zc ? 250 + (p / zc) * 230 : 700 + (p - zc) * 3; endY = win ? LH : 0; A = 60 + p * 1.2;
    g.result = win ? 'win' : 'lose'; snd(win ? 700 : 200, .3, 'square', .08, 0, win ? 1400 : 80);
  };
  const g = {
    cmd: 'CHARGE!', hint: 'HOLD SPACE, RELEASE IN GREEN', thint: 'HOLD, RELEASE IN GREEN', dur: 5,
    key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') release(); },
    down() { start(); }, up() { release(); },
    update(dt) {
      if (hold) { p = Math.min(100, p + 60 * sp * dt); if (Math.random() < .3) snd(200 + p * 6, .03, 'square', .03); }
      if (fired) jt += dt;
    },
    draw(t) {
      bg('#9BF6FF', '#87ecf7', t);
      ctx.fillStyle = INK; ctx.fillRect(0, GY - 4, W, 110); ctx.fillStyle = '#58c24a'; ctx.fillRect(0, GY, W, 100);
      box(540, GY - LH, 80, 18, '#7a5230', 4);
      box(90, 150, 50, 350, '#fff', 6);
      ctx.fillStyle = '#5CFF7A'; ctx.fillRect(90, 500 - (zc + zw / 2) * 3.5, 50, zw * 3.5);
      ctx.fillStyle = '#FFE14D'; ctx.fillRect(94, 500 - p * 3.5, 42, p * 3.5 - 2);
      ctx.fillStyle = INK; ctx.fillRect(80, 500 - p * 3.5 - 3, 70, 6);
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
  const pipes = [{ x: 700, gy: 200 + Math.random() * 200 }, { x: 700 + 416 * sp, gy: 200 + Math.random() * 200 }];
  const flap = () => { if (!g.result) { vy = -520; snd(500, .08, 'square', .05, 0, 800); } };
  const g = {
    cmd: 'FLAP!', hint: 'SPACE OR CLICK TO FLAP', thint: 'TAP TO FLAP', dur: 4.5, timeWin: true,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') flap(); }, down() { flap(); },
    update(dt) {
      if (g.result) return;
      vy += 1800 * dt; py += vy * dt;
      if (py < 90 || py > 520) g.result = 'lose';
      for (const q of pipes) {
        q.x -= spd * dt;
        if (q.x - 45 < 180 + 48 && q.x + 45 > 180 - 48 && (py - 80 < q.gy - 95 || py > q.gy + 95)) g.result = 'lose';
      }
      if (g.result === 'lose') snd(110, .4, 'sawtooth', .12, 0, 40);
    },
    draw(t) {
      bg('#8FD3FF', '#7fc7f7', t);
      for (const q of pipes) {
        box(q.x - 45, 40, 90, q.gy - 95 - 40, '#5CC24A', 5); box(q.x - 54, q.gy - 95 - 24, 108, 24, '#4aa83a', 5);
        box(q.x - 45, q.gy + 95, 90, 560 - q.gy - 95, '#5CC24A', 5); box(q.x - 54, q.gy + 95, 108, 24, '#4aa83a', 5);
      }
      ctx.fillStyle = INK; ctx.fillRect(0, 524, W, 80); ctx.fillStyle = '#d9a066'; ctx.fillRect(0, 530, W, 80);
      ctx.save(); ctx.translate(180, py); ctx.rotate(Math.max(-.5, Math.min(.8, vy / 900)));
      claude(0, 0, 8, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null }); ctx.restore();
    }
  };
  return g;
}

/* 27 ── PONG: don't let the ball past you (mouse or ↑ ↓) */
function gPong(sp) {
  const pad = { y: 300, h: 120 }; let target = 300, hits = 0;
  const ball = { x: 420, y: 200 + Math.random() * 200, vx: -360 * sp, vy: (Math.random() < .5 ? -1 : 1) * (150 + Math.random() * 120) * sp, r: 16 };
  const g = {
    cmd: 'PONG!', hint: 'BLOCK THE BALL: MOUSE OR ↑ ↓', thint: 'DRAG UP AND DOWN', dur: 4.8, timeWin: true,
    move(p) { target = p.y; },
    update(dt) {
      if (g.result) return;
      if (keys.ArrowUp || keys.KeyW) target -= 650 * dt; if (keys.ArrowDown || keys.KeyS) target += 650 * dt;
      target = Math.max(130, Math.min(480, target)); pad.y += (target - pad.y) * Math.min(1, 20 * dt);
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < 76 + ball.r) { ball.y = 76 + ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.y > 524 - ball.r) { ball.y = 524 - ball.r; ball.vy = -Math.abs(ball.vy); }
      if (ball.x > 750 - ball.r) { ball.x = 750 - ball.r; ball.vx = -Math.abs(ball.vx); snd(300, .05); }
      if (ball.vx < 0 && ball.x - ball.r <= 62 && ball.x > 30 && Math.abs(ball.y - pad.y) < pad.h / 2 + ball.r) {
        ball.vx = Math.abs(ball.vx); ball.vy += (ball.y - pad.y) * 3; hits++; snd(600, .07);
      }
      if (ball.x < 0) { g.result = 'lose'; snd(110, .4, 'sawtooth', .12, 0, 40); }
    },
    draw(t) {
      bg('#1f2a44', '#26335a', t);
      ctx.fillStyle = '#fff'; ctx.fillRect(20, 64, 760, 8); ctx.fillRect(20, 524, 760, 8);
      for (let i = 0; i < 9; i++) { box(750, 80 + i * 50, 30, 42, i % 2 ? '#ff6b6b' : '#ffd23f', 3); }
      box(34, pad.y - pad.h / 2, 22, pad.h, OR, 4);
      claude(120, pad.y + 30, 3.2, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null });
      token(ball.x, ball.y, ball.r + 4);
    }
  };
  return g;
}

/* 28 ── CRANK: whirl the mouse around the wheel (3 turns) */
function gCrank(sp) {
  const cx = 400, cy = 300, need = (sp > 1.5 ? 4 : 3) * Math.PI * 2;
  let acc = 0, pa = null, ang = 0;
  const g = {
    cmd: 'CRANK!', hint: 'SPIN THE MOUSE AROUND THE WHEEL', thint: 'SPIN YOUR FINGER AROUND', dur: 5,
    move(p) {
      if (g.result) return;
      const d = Math.hypot(p.x - cx, p.y - cy); if (d < 40) { pa = null; return; }
      const a = Math.atan2(p.y - cy, p.x - cx); ang = a;
      if (pa !== null) { let dd = a - pa; if (dd > Math.PI) dd -= Math.PI * 2; if (dd < -Math.PI) dd += Math.PI * 2; acc += Math.abs(dd); if (Math.random() < .2) snd(250 + acc * 8, .03, 'square', .03); }
      pa = a; if (acc >= need) { g.result = 'win'; snd(900, .2); confetti(cx, 140, 30); }
    },
    update() {},
    draw(t) {
      bg('#C3F584', '#b4ea6e', t);
      box(cx - 160, 340, 320, 180, '#7C4DFF', 6); txt('?', cx, 430, 80);
      const k = Math.min(1, acc / need);
      circ(cx, cy - 20, 110, '#fff', 6);
      ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(cx, cy - 20, 90, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + Math.cos(ang) * 100, cy - 20 + Math.sin(ang) * 100); ctx.stroke();
      circ(cx + Math.cos(ang) * 100, cy - 20 + Math.sin(ang) * 100, 18, '#FFE14D', 4);
      circ(cx, cy - 20, 14, '#FFE14D', 4);
      if (g.result === 'win') claude(cx, 340 - Math.abs(Math.sin(now * 9)) * 40, 9, { mood: 'happy' });
    }
  };
  return g;
}

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
  const me = { r: 0, c: 0, x: ox + cs / 2, y: oy + cs / 2 };
  const dirs = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const g = {
    cmd: 'MAZE!', swipe: true, hint: 'REACH THE STAR WITH ARROWS', thint: 'SWIPE TO MOVE', dur: 7,
    key(e) {
      const d = dirs[e.code]; if (!d || g.result) return; const { r, c } = me;
      if (d === 'r' && c < C - 1 && !wr[r][c]) me.c++; else if (d === 'l' && c > 0 && !wr[r][c - 1]) me.c--;
      else if (d === 'd' && r < R - 1 && !wd[r][c]) me.r++; else if (d === 'u' && r > 0 && !wd[r - 1][c]) me.r--;
      else { snd(130, .05, 'sawtooth', .05); return; }
      snd(500, .04); if (me.r === R - 1 && me.c === C - 1) { g.result = 'win'; snd(900, .2); }
    },
    update(dt) {
      me.x += (ox + (me.c + .5) * cs - me.x) * Math.min(1, 20 * dt); me.y += (oy + (me.r + .5) * cs - me.y) * Math.min(1, 20 * dt);
    },
    draw(t) {
      bg('#B8C0FF', '#a8b1f5', t);
      ctx.fillStyle = '#fff'; ctx.fillRect(ox, oy, C * cs, R * cs);
      ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.rect(ox, oy, C * cs, R * cs);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (wr[r][c] && c < C - 1) { ctx.moveTo(ox + (c + 1) * cs, oy + r * cs); ctx.lineTo(ox + (c + 1) * cs, oy + (r + 1) * cs); }
        if (wd[r][c] && r < R - 1) { ctx.moveTo(ox + c * cs, oy + (r + 1) * cs); ctx.lineTo(ox + (c + 1) * cs, oy + (r + 1) * cs); }
      }
      ctx.stroke(); ctx.lineCap = 'butt';
      star(ox + (C - .5) * cs, oy + (R - .5) * cs, cs * .3, cs * .13, 5, now * 2, '#FFE14D', 3);
      claude(me.x, me.y + cs * .22, cs / 30, { mood: g.result === 'win' ? 'happy' : null, run: null });
    }
  };
  return g;
}

/* 30 ── WIRES: connect matching colours (mouse: click left, then right) */
function gWires(sp) {
  const n = sp > 1.5 ? 4 : 3, ys = n === 3 ? [160, 290, 420] : [135, 240, 345, 450];
  const cols = ['#ff4d4d', '#4DB8FF', '#ffd23f', '#5CFF7A'].slice(0, n);
  const L = shuffle(cols.slice()), Rr = shuffle(cols.slice()), conns = []; let sel = -1, shake = 0;
  const g = {
    cmd: 'WIRES!', hint: 'CLICK LEFT, THEN THE SAME COLOUR', thint: 'TAP LEFT, THEN SAME COLOUR', dur: 5.5,
    down(p) {
      const li = ys.findIndex((y, i) => Math.abs(p.x - 150) < 55 && Math.abs(p.y - y) < 36 && !conns.some(c => c.l === i));
      if (li >= 0) { sel = li; snd(450, .05); return; }
      const ri = ys.findIndex((y, i) => Math.abs(p.x - 650) < 55 && Math.abs(p.y - y) < 36 && !conns.some(c => c.r === i));
      if (ri >= 0 && sel >= 0) {
        if (L[sel] === Rr[ri]) { conns.push({ l: sel, r: ri }); snd(700 + conns.length * 100, .1); if (conns.length === n) g.result = 'win'; }
        else { shake = .3; snd(140, .1, 'sawtooth'); }
        sel = -1;
      }
    },
    update(dt) { shake = Math.max(0, shake - dt); },
    draw(t) {
      bg('#CDB4DB', '#c0a4d0', t);
      for (const c of conns) {
        ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(190, ys[c.l]); ctx.lineTo(610, ys[c.r]); ctx.stroke();
        ctx.strokeStyle = L[c.l]; ctx.lineWidth = 12; ctx.stroke(); ctx.lineCap = 'butt';
      }
      for (let i = 0; i < n; i++) {
        const dl = conns.some(c => c.l === i), dr = conns.some(c => c.r === i), sx = Math.sin(now * 80) * shake * 20;
        box(110 + (sel === i ? Math.sin(now * 20) * 3 : 0), ys[i] - 32, 80, 64, L[i], 5); if (!dl) circ(190, ys[i], 10, INK, 0);
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
