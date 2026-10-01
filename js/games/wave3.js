'use strict';
/* Wave 3 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 13 ── WHACK: bugs pop out of holes (mouse) */
function gWhack(sp) {
  const holes = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) holes.push({ x: 200 + c * 200, y: 190 + r * 120 });
  const moles = []; let clock = 0, next = .1, hits = 0;
  const rise = m => { const a = clock - m.t; return m.dead ? 0 : Math.max(0, Math.min(1, a / .15, (m.life - a) / .15)); };
  const g = {
    cmd: 'WHACK!', hint: 'HIT 3 BUGS', thint: 'TAP 3 BUGS', dur: 5,
    down(p) {
      for (const m of moles) {
        const h = holes[m.h];
        if (!m.dead && rise(m) > .4 && Math.hypot(p.x - h.x, p.y - (h.y - 30)) < 52) {
          m.dead = 1; hits++; confetti(h.x, h.y - 30, 8); snd(700, .09, 'square', .07, 0, 1200);
          if (hits >= 3) g.result = 'win'; return;
        }
      }
      snd(170, .08, 'sawtooth');
    },
    update(dt) {
      clock += dt;
      if (g.result || clock < next) return;
      const live = moles.filter(m => !m.dead && clock - m.t < m.life);
      const free = holes.map((h, i) => i).filter(i => !live.some(m => m.h === i));
      if (live.length < 2) moles.push({ h: free[Math.random() * free.length | 0], t: clock, life: 1 / Math.sqrt(sp) + .2, dead: 0 });
      next = clock + .5 / sp;
    },
    draw(t) {
      bg('#F6C28B', '#eeb57a', t);
      for (const h of holes) { ctx.beginPath(); ctx.ellipse(h.x, h.y, 64, 20, 0, 0, 7); ctx.fillStyle = INK; ctx.fill(); }
      for (const m of moles) {
        const h = holes[m.h], r = rise(m); if (r <= 0) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(h.x - 80, h.y - 120, 160, 120); ctx.clip();
        drawBug(h.x, h.y + 70 - r * 90, 0, 1.1, now); ctx.restore();
      }
      for (const h of holes) { ctx.beginPath(); ctx.ellipse(h.x, h.y + 2, 66, 20, 0, 0, Math.PI); ctx.fillStyle = '#7a5230'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
      for (let k = 0; k < 3; k++) circ(W - 100 + k * 36, 90, 12, k < hits ? '#e8433a' : '#c99a64', 3);
    }
  };
  return g;
}

/* 14 ── DRAG: carry the token into the bin, avoid the guard (mouse drag) */
function gDrag(sp) {
  const sy = 140 + Math.random() * 300, tok = { x: 120, y: sy, drag: false };
  const bin = { x: 690, y: 140 + Math.random() * 300, r: sp > 1.5 ? 50 : 66 };
  let gy = 120, gv = 260 * sp;
  const g = {
    cmd: 'DRAG!', hint: 'DRAG THE TOKEN INTO THE BIN', thint: 'DRAG THE TOKEN INTO THE BIN', dur: 5.5,
    down(p) { if (Math.hypot(p.x - tok.x, p.y - tok.y) < 48) tok.drag = true; },
    up() { tok.drag = false; },
    move(p) {
      if (!tok.drag) return;
      tok.x = p.x; tok.y = p.y;
      if (Math.hypot(tok.x - bin.x, tok.y - bin.y) < bin.r * .75) { tok.drag = false; tok.x = bin.x; tok.y = bin.y; g.result = 'win'; snd(900, .2); }
    },
    update(dt) {
      if (g.result) return;
      gy += gv * dt; if (gy > 470) { gy = 470; gv = -gv; } if (gy < 100) { gy = 100; gv = -gv; }
      if (Math.hypot(tok.x - 400, tok.y - gy) < 62) { tok.x = 120; tok.y = sy; tok.drag = false; snd(130, .2, 'sawtooth'); }
    },
    draw(t) {
      bg('#8EE3EF', '#7ed7e4', t);
      ctx.setLineDash([14, 10]); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bin.x, bin.y, bin.r + 12, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      circ(bin.x, bin.y, bin.r, '#4DB8FF', 5); txt('IN', bin.x, bin.y + 3, 40);
      drawBug(400, gy, Math.PI / 2 * (gv > 0 ? 1 : -1), 1.5, now);
      token(tok.x, tok.y, 30);
    }
  };
  return g;
}

/* 15 ── RACE: alternate ← → (or A D) to outrun the bug */
function gRace(sp) {
  let me = 0, rival = 0, last = '', shake = 0, clock = 0;
  const rate = 100 / (5 * .88 / Math.sqrt(sp));
  const g = {
    cmd: 'RACE!', hint: 'ALTERNATE LEFT AND RIGHT', thint: 'TAP LEFT / RIGHT SIDE', dur: 5,
    down(p) { g.key({ code: p.x < W / 2 ? 'ArrowLeft' : 'ArrowRight' }); },
    key(e) {
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (!k) return;
      if (k === last) { shake = .15; return; }
      last = k; me += 5; snd(300 + me * 4, .04, 'square', .05);
      if (me >= 100) { g.result = 'win'; }
    },
    update(dt) {
      clock += dt; shake = Math.max(0, shake - dt);
      if (g.result) return;
      rival += rate * dt; if (rival >= 100) g.result = 'lose';
    },
    draw(t) {
      bg('#FFD166', '#ffc54d', t);
      for (const ly of [150, 330]) { ctx.fillStyle = INK; ctx.fillRect(0, ly - 4, W, 188); ctx.fillStyle = '#d9a066'; ctx.fillRect(0, ly, W, 180); }
      for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#fff' : INK; ctx.fillRect(724 + c * 16, 150 + r * 15, 16, 15); ctx.fillRect(724 + c * 16, 330 + r * 15, 16, 15); }
      const mx = 80 + Math.min(me, 100) * 6.2 + Math.sin(now * 80) * shake * 20, rx = 80 + Math.min(rival, 100) * 6.2;
      claude(mx, 300, 8, { run: g.result ? null : now, mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      drawBug(rx, 420, Math.PI / 2, 1.3, now);
      txt('YOU', 50, 175, 24); txt('BUG', 50, 355, 24);
    }
  };
  return g;
}

/* 16 ── WAIT: press only when the light turns green */
function gReflex(sp) {
  const goAt = (.9 + Math.random() * 1.5) / Math.sqrt(sp), win = 1.0 / sp;
  let clock = 0, rt = 0;
  const press = () => {
    if (g.result) return;
    if (clock < goAt) { g.result = 'lose'; snd(110, .3, 'sawtooth'); }
    else { rt = (clock - goAt) * 1000 | 0; g.result = 'win'; snd(900, .15); }
  };
  const g = {
    cmd: 'WAIT!', hint: 'PRESS ONLY AT GREEN', thint: 'TAP ONLY AT GREEN', dur: 4,
    key() { press(); }, down() { press(); },
    update(dt) { if (g.result) return; clock += dt; if (clock > goAt + win) g.result = 'lose'; },
    draw(t) {
      bg('#6B7A8F', '#5f6e83', t);
      const go = clock >= goAt, early = g.result === 'lose' && clock < goAt;
      box(W / 2 - 80, 90, 160, 300, '#2b2b3a', 6);
      circ(W / 2, 150, 42, go ? '#4a1d1d' : '#ff3b3b', 4);
      circ(W / 2, 240, 42, '#5a4d1d', 4);
      circ(W / 2, 330, 42, go ? '#5CFF7A' : '#1d4a2a', 4);
      ctx.fillStyle = '#2b2b3a'; ctx.fillRect(W / 2 - 14, 394, 28, 80);
      claude(W / 2 + 190, 520, 9, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      if (g.result === 'win') txt(rt + ' ms', W / 2 - 220, 300, 56, '#5CFF7A');
      if (early) txt('TOO SOON!', W / 2 - 220, 300, 50, '#FF4D4D');
    }
  };
  return g;
}

/* 17 ── BEAT IT: pick the move that beats the opponent (1 2 3 or click) */
function gRps(sp) {
  const o = Math.random() * 3 | 0, names = ['ROCK', 'PAPER', 'SCISSORS'];
  let picked = -1;
  const icon = (k, cx, cy, s) => {
    if (k === 0) { circ(cx, cy, s * .8, '#9a9aa8', 5); ctx.fillStyle = '#c8c8d4'; ctx.fillRect(cx - s * .45, cy - s * .4, s * .3, s * .22); }
    else if (k === 1) { box(cx - s * .7, cy - s * .85, s * 1.4, s * 1.7, '#fff', 5); ctx.fillStyle = '#9ad'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - s * .45, cy - s * .5 + i * s * .45, s * .9, s * .12); }
    else {
      ctx.lineCap = 'round';
      for (const [w, c] of [[s * .42, INK], [s * .26, '#ff5a4d']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - s * .8, cy - s * .8); ctx.lineTo(cx + s * .5, cy + s * .5); ctx.moveTo(cx + s * .8, cy - s * .8); ctx.lineTo(cx - s * .5, cy + s * .5); ctx.stroke(); }
      circ(cx - s * .55, cy + s * .7, s * .26, '#FFE14D', 4); circ(cx + s * .55, cy + s * .7, s * .26, '#FFE14D', 4); ctx.lineCap = 'butt';
    }
  };
  const choose = c => { if (g.result) return; picked = c; g.result = (c - o + 3) % 3 === 1 ? 'win' : 'lose'; snd(g.result === 'win' ? 800 : 140, .15); };
  const g = {
    cmd: 'BEAT IT!', hint: 'PICK WHAT BEATS IT', thint: 'TAP WHAT BEATS IT', dur: 4.5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 380 && p.y < 520) choose(i); },
    update() {},
    draw(t) {
      bg('#F4A6C0', '#ee95b3', t);
      box(300, 90, 200, 200, 'rgba(255,255,255,.55)', 6); icon(o, 400, 190 + Math.sin(now * 6) * 4, 62);
      for (let i = 0; i < 3; i++) {
        const show = g.result && i === picked;
        box(100 + i * 220, 380, 200, 140, show ? (g.result === 'win' ? '#5CFF7A' : '#FF4D4D') : '#fff', 5);
        icon(i, 200 + i * 220, 440, 32); txt((i + 1) + ' ' + names[i], 200 + i * 220, 500, 22, INK);
      }
    }
  };
  return g;
}

/* 18 ── SOLVE: quick maths (1 2 3 or click) */
function gMath(sp) {
  let a = 2 + Math.random() * 8 | 0, b = 2 + Math.random() * 7 | 0, op = ['+', '-', 'x'][sp > 1.5 ? Math.random() * 3 | 0 : Math.random() * 2 | 0];
  if (op === '-' && b > a) [a, b] = [b, a];
  if (op === 'x') { a = 2 + Math.random() * 5 | 0; b = 2 + Math.random() * 4 | 0; }
  const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const opts = [ans]; while (opts.length < 3) { const v = ans + ((Math.random() * 7 | 0) - 3); if (v >= 0 && !opts.includes(v)) opts.push(v); }
  shuffle(opts); let picked = -1;
  const choose = i => { if (g.result) return; picked = i; g.result = opts[i] === ans ? 'win' : 'lose'; snd(g.result === 'win' ? 800 : 140, .15); };
  const g = {
    cmd: 'SOLVE!', hint: 'PICK THE ANSWER (1 2 3)', thint: 'TAP THE ANSWER', dur: 5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 340 && p.y < 470) choose(i); },
    update() {},
    draw(t) {
      bg('#C0F0A0', '#b0e690', t);
      txt(`${a} ${op} ${b} = ?`, W / 2, 170, 110, '#fff');
      for (let i = 0; i < 3; i++) {
        const show = g.result && (opts[i] === ans || i === picked);
        box(100 + i * 220, 340, 200, 130, show ? (opts[i] === ans ? '#5CFF7A' : '#FF4D4D') : '#fff', 5);
        txt(String(opts[i]), 200 + i * 220, 405, 72, show ? '#fff' : INK);
      }
      claude(W / 2, 560, 5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
    }
  };
  return g;
}

/* 19 ── SORT: click the numbers in order (mouse) */
function gSort(sp) {
  const n = sp > 1.5 ? 6 : 5;
  const cells = shuffle([...Array(12).keys()]).slice(0, n);
  const balls = cells.map((c, i) => ({ v: i + 1, x: (c % 4) * 200 + 100 + (Math.random() - .5) * 40, y: 160 + (c / 4 | 0) * 135 + (Math.random() - .5) * 30, done: false, sh: 0 }));
  shuffle(balls); let next = 1;
  const cols = ['#ff6b6b', '#4DB8FF', '#ffd23f', '#9be564', '#c792ea', '#ff9f43'];
  const g = {
    cmd: 'SORT!', hint: 'CLICK 1, 2, 3... IN ORDER', thint: 'TAP 1, 2, 3... IN ORDER', dur: 5,
    down(p) {
      for (const b of balls) if (!b.done && Math.hypot(p.x - b.x, p.y - b.y) < 44) {
        if (b.v === next) { b.done = true; next++; snd(400 + next * 100, .09); if (next > n) g.result = 'win'; }
        else { b.sh = .3; snd(150, .1, 'sawtooth'); }
        return;
      }
    },
    update(dt) { balls.forEach(b => b.sh = Math.max(0, b.sh - dt)); },
    draw(t) {
      bg('#FFB4A2', '#ffa690', t);
      for (const b of balls) {
        const sx = Math.sin(now * 70) * b.sh * 30;
        circ(b.x + sx, b.y, 40, b.done ? '#5CFF7A' : cols[b.v - 1], 5); txt(String(b.v), b.x + sx, b.y + 3, 46);
      }
    }
  };
  return g;
}

/* 20 ── FIND IT: the cup shuffle (mouse) */
function gShell(sp) {
  const xs = [200, 400, 600], cups = xs.map(x => ({ x, from: x, to: x, lift: 0 }));
  const hid = Math.random() * 3 | 0, swaps = 4 + (sp > 1.4) * 2 + (sp > 1.8), sd = .4 / sp;
  let phase = 'show', clock = 0, done = 0, sw = null, swT = 0, picked = -1;
  const startSwap = () => {
    const a = Math.random() * 3 | 0; let b; do { b = Math.random() * 3 | 0; } while (b === a);
    sw = { a, b }; swT = 0; cups[a].from = cups[a].x; cups[a].to = cups[b].x; cups[b].from = cups[b].x; cups[b].to = cups[a].x;
  };
  const g = {
    cmd: 'FIND IT!', hint: 'FIND CLAUDE', dur: 6.5,
    down(p) {
      if (phase !== 'pick' || g.result) return;
      cups.forEach((c, i) => { if (Math.abs(p.x - c.x) < 66 && p.y > 250 && p.y < 400) { picked = i; g.result = i === hid ? 'win' : 'lose'; snd(g.result === 'win' ? 800 : 140, .15); } });
    },
    update(dt) {
      clock += dt;
      cups.forEach((c, i) => {
        const up = (phase === 'show' && i === hid) || (g.result && (i === hid || i === picked));
        c.lift += ((up ? 1 : 0) - c.lift) * Math.min(1, 12 * dt);
      });
      if (phase === 'show' && clock > 1.1) { phase = 'swap'; g.hint = 'WATCH...'; startSwap(); }
      else if (phase === 'swap') {
        swT += dt; const k = Math.min(1, swT / sd), e = k * k * (3 - 2 * k);
        for (const i of [sw.a, sw.b]) cups[i].x = cups[i].from + (cups[i].to - cups[i].from) * e;
        if (k >= 1) { if (++done >= swaps) { phase = 'pick'; g.hint = 'PICK A CUP!'; } else startSwap(); }
      }
    },
    draw(t) {
      bg('#6C5CE7', '#5e4ed8', t);
      ctx.fillStyle = INK; ctx.fillRect(0, 384, W, 10); ctx.fillStyle = '#4b3fb3'; ctx.fillRect(0, 394, W, 206);
      claude(cups[hid].x, 380, 5.5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      for (const c of cups) {
        ctx.save(); ctx.translate(c.x, 380 - c.lift * 120);
        ctx.beginPath(); ctx.moveTo(-42, -112); ctx.lineTo(42, -112); ctx.lineTo(62, 0); ctx.lineTo(-62, 0); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#4DB8FF'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-26, -90, 10, 50); ctx.restore();
      }
    }
  };
  return g;
}

/* 21 ── SCRUB: wipe the grime off the window (mouse, rub back and forth) */
function gScrub(sp) {
  const cols = 16, rows = 10, cw = 37.5, ch = 38, ox = 100, oy = 90;
  const dirt = Array.from({ length: cols * rows }, () => 1);
  let prev = null;
  const g = {
    cmd: 'SCRUB!', hint: 'RUB THE MOUSE ALL OVER', thint: 'RUB YOUR FINGER ALL OVER', dur: 5.5,
    move(p) {
      if (g.result) { prev = p; return; }
      if (prev) {
        const d = Math.min(80, Math.hypot(p.x - prev.x, p.y - prev.y));
        for (let i = 0; i < dirt.length; i++) {
          const cx = ox + (i % cols + .5) * cw, cy = oy + ((i / cols | 0) + .5) * ch;
          if (Math.hypot(cx - p.x, cy - p.y) < 56) dirt[i] = Math.max(0, dirt[i] - d * .009);
        }
        if (dirt.filter(v => v < .25).length >= dirt.length * .9) { g.result = 'win'; snd(1000, .2); }
      }
      prev = p;
    },
    update() {},
    draw(t) {
      bg('#A8DADC', '#97cfd2', t);
      box(ox, oy, cols * cw, rows * ch, '#cfefff', 8);
      claude(400, 450, 17, { mood: g.result === 'win' ? 'happy' : null });
      for (let i = 0; i < dirt.length; i++) {
        if (g.result === 'win' || dirt[i] <= .02) continue;
        ctx.fillStyle = `rgba(105,78,50,${dirt[i] * .93})`;
        ctx.fillRect(ox + (i % cols) * cw, oy + (i / cols | 0) * ch, cw + 1, ch + 1);
      }
      if (g.result === 'win') star(560, 180, 26, 10, 4, now * 2, '#fff', 3);
      const m = mouse; box(m.x - 24, m.y - 16, 48, 32, '#FFE14D', 4);
    }
  };
  return g;
}

/* 22 ── DODGE: survive the bouncing bugs (mouse or arrows / WASD) */
function gDodge(sp, extra = 0) {
  const me = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 };
  const n = 5 + (sp > 1.5) + extra;
  const balls = Array.from({ length: n }, () => {
    const a = Math.random() * 6.28, left = Math.random() < .5;
    return { x: left ? 70 : 730, y: 110 + Math.random() * 380, vx: Math.cos(a) * 250 * sp, vy: Math.sin(a) * 250 * sp, r: 24 };
  });
  const g = {
    cmd: 'DODGE!', hint: 'MOUSE OR ARROWS', thint: 'DRAG TO DODGE', dur: 5, timeWin: true,
    move(p) { me.tx = p.x; me.ty = p.y; },
    update(dt) {
      if (g.result) return;
      if (keys.ArrowLeft || keys.KeyA) me.tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) me.tx += 700 * dt;
      if (keys.ArrowUp || keys.KeyW) me.ty -= 700 * dt; if (keys.ArrowDown || keys.KeyS) me.ty += 700 * dt;
      me.tx = Math.max(50, Math.min(750, me.tx)); me.ty = Math.max(90, Math.min(500, me.ty));
      me.x += (me.tx - me.x) * Math.min(1, 16 * dt); me.y += (me.ty - me.y) * Math.min(1, 16 * dt);
      for (const b of balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 30 || b.x > 770) { b.vx = -b.vx; b.x = Math.max(30, Math.min(770, b.x)); }
        if (b.y < 70 || b.y > 520) { b.vy = -b.vy; b.y = Math.max(70, Math.min(520, b.y)); }
        if (Math.hypot(b.x - me.x, b.y - me.y) < b.r + 24) { g.result = 'lose'; snd(100, .4, 'sawtooth', .15, 0, 40); confetti(me.x, me.y, 20); }
      }
    },
    draw(t) {
      bg('#2b2757', '#322d66', t);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(20, 60, 760, 470);
      for (const b of balls) drawBug(b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI / 2, .8, now);
      claude(me.x, me.y + 16, 3.4, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, run: g.result ? null : now });
    }
  };
  return g;
}

reg('whack', gWhack, 'WHACK');
reg('drag', gDrag, 'DRAG');
reg('race', gRace, 'RACE');
reg('reflex', gReflex, 'WAIT');
reg('rps', gRps, 'BEAT IT');
reg('math', gMath, 'SOLVE');
reg('sort', gSort, 'SORT');
reg('shell', gShell, 'FIND IT');
reg('scrub', gScrub, 'SCRUB');
reg('dodge', gDodge, 'DODGE');
