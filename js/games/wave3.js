'use strict';
/* Wave 3 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 13 ── WHACK: bugs pop out of holes (mouse) */
function gWhack(sp) {
  const holes = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) holes.push({ x: 200 + c * 200, y: 190 + r * 120 });
  const moles = []; let clock = 0, next = .1, hits = 0;
  const rise = m => { const a = clock - m.t; return m.dead ? 0 : Math.max(0, Math.min(1, a / .15, (m.life - a) / .15)); };
  const g = {
    wide: true, cmd: 'WHACK!', hint: 'HIT 3 BUGS', thint: 'TAP 3 BUGS', dur: 5,
    down(p) {
      for (const m of moles) {
        const h = holes[m.h];
        if (!m.dead && rise(m) > .4 && Math.hypot(p.x - h.x, p.y - (h.y - 30)) < 52) {
          m.dead = 1; hits++; confetti(h.x, h.y - 30, 8); burst(h.x, h.y - 30, '#FFE14D', 10); ring(h.x, h.y - 30, '#fff', 60, .3); floatText('+1', h.x, h.y - 70, '#fff', 36); sfx.hit(); sfx.blip(hits * 3); shake(3, .12);
          if (hits >= 3) { g.result = 'win'; sfx.sparkle(); } return;
        }
      }
      sfx.miss(); ring(p.x, p.y, '#7a5230', 30, .25);
    },
    update(dt) {
      clock += dt;
      if (g.result || clock < next) return;
      const live = moles.filter(m => !m.dead && clock - m.t < m.life);
      const free = holes.map((h, i) => i).filter(i => !live.some(m => m.h === i));
      if (live.length < 2) { moles.push({ h: free[Math.random() * free.length | 0], t: clock, life: 1 / Math.sqrt(sp) + .2, dead: 0 }); sfx.blip(-5); }
      next = clock + .5 / sp;
    },
    draw(t) {
      bg('#F6C28B', '#eeb57a', t);
      for (const h of holes) { ctx.beginPath(); ctx.ellipse(h.x, h.y + 6, 72, 24, 0, 0, 7); ctx.fillStyle = '#c99a64'; ctx.fill(); ctx.beginPath(); ctx.ellipse(h.x, h.y, 64, 20, 0, 0, 7); ctx.fillStyle = INK; ctx.fill(); }
      for (const m of moles) {
        const h = holes[m.h], r = rise(m); if (r <= 0) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(h.x - 80, h.y - 120, 160, 120); ctx.clip();
        const e = 1 + Math.sin(r * Math.PI) * .12 * (r < 1 ? 1 : 0); ctx.translate(h.x, h.y + 70 - r * 90); ctx.scale(1 / e, e); drawBug(0, 0, 0, 1.1, now); ctx.restore();
      }
      for (const h of holes) { ctx.beginPath(); ctx.ellipse(h.x, h.y + 2, 66, 20, 0, 0, Math.PI); ctx.fillStyle = '#7a5230'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); }
      for (let k = 0; k < 3; k++) circ(W + OX - 100 + k * 36, 90, 12, k < hits ? '#e8433a' : '#c99a64', 3);
      vignette(.2);
    }
  };
  return g;
}

/* 14 ── DRAG: carry the token into the bin, avoid the guard (mouse drag) */
function gDrag(sp) {
  const sy = 140 + Math.random() * 300, sx = 120 - OX * .8, tok = { x: sx, y: sy, drag: false };
  const bin = { x: 690 + OX * .8, y: 140 + Math.random() * 300, r: sp > 1.5 ? 50 : 66 };
  let gy = 120, gv = 260 * sp;
  const g = {
    wide: true, cmd: 'DRAG!', hint: 'DRAG THE TOKEN INTO THE BIN', thint: 'DRAG THE TOKEN INTO THE BIN', dur: 5.5,
    down(p) { if (Math.hypot(p.x - tok.x, p.y - tok.y) < 48) { tok.drag = true; sfx.click(); ring(tok.x, tok.y, '#fff', 44, .25); } },
    up() { tok.drag = false; },
    move(p) {
      if (!tok.drag) return;
      tok.x = p.x; tok.y = p.y;
      if (Math.hypot(tok.x - bin.x, tok.y - bin.y) < bin.r * .75) { tok.drag = false; tok.x = bin.x; tok.y = bin.y; g.result = 'win'; sfx.coin(); sfx.sparkle(); burst(bin.x, bin.y, '#4DB8FF', 16); ring(bin.x, bin.y, '#fff', 90); floatText('NICE!', bin.x, bin.y - 70, '#fff'); }
    },
    update(dt) {
      if (g.result) return;
      gy += gv * dt; if (gy > 470) { gy = 470; gv = -gv; } if (gy < 100) { gy = 100; gv = -gv; }
      if (Math.hypot(tok.x - 400, tok.y - gy) < 62) { tok.x = sx; tok.y = sy; tok.drag = false; sfx.buzz(); sfx.zap(); shake(7, .25); burst(tok.x, tok.y, '#FF4D4D', 14); ring(tok.x, tok.y, '#FF4D4D', 80); }
    },
    draw(t) {
      bg('#8EE3EF', '#7ed7e4', t);
      ctx.setLineDash([14, 10]); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bin.x, bin.y, bin.r + 12, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      circ(bin.x, bin.y, bin.r, '#4DB8FF', 5); txt('IN', bin.x, bin.y + 3, 40);
      shadow(400, gy + 46, 44, 12); drawBug(400, gy, Math.PI / 2 * (gv > 0 ? 1 : -1), 1.5, now);
      shadow(tok.x + 4, tok.y + 34 + (tok.drag ? 8 : 0), 26, 8, tok.drag ? .18 : .28); token(tok.x, tok.y - (tok.drag ? 6 : 0), tok.drag ? 33 : 30);
    }
  };
  return g;
}

/* 15 ── RACE: alternate ← → (or A D) to outrun the bug */
function gRace(sp) {
  let me = 0, rival = 0, last = '', shk = 0, clock = 0;
  const rate = 100 / (5 * .88 / Math.sqrt(sp)), x0 = 80 - OX, kx = (620 + OX * 2) / 100, fx = 724 + OX;
  const g = {
    wide: true, cmd: 'RACE!', hint: 'ALTERNATE LEFT AND RIGHT', thint: 'TAP LEFT / RIGHT SIDE', dur: 5,
    down(p) { g.key({ code: p.x < W / 2 ? 'ArrowLeft' : 'ArrowRight' }); },
    key(e) {
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (!k) return;
      if (k === last) { shk = .15; sfx.miss(); return; }
      last = k; me += 5; sfx.blip(me / 8); burst(x0 + Math.min(me, 100) * kx - 30, 330, '#d9a066', 3, 140);
      if (me >= 100) { g.result = 'win'; sfx.coin(); sfx.sparkle(); shake(5, .2); floatText('WINNER!', 400, 250, '#fff', 48); confetti(fx, 240, 30); }
    },
    update(dt) {
      clock += dt; shk = Math.max(0, shk - dt);
      if (g.result) return;
      rival += rate * dt; if (rival >= 100) { g.result = 'lose'; sfx.buzz(); shake(6, .25); }
    },
    draw(t) {
      bg('#FFD166', '#ffc54d', t);
      for (const ly of [150, 330]) { ctx.fillStyle = INK; ctx.fillRect(-OX, ly - 4, VW, 188); ctx.fillStyle = '#d9a066'; ctx.fillRect(-OX, ly, VW, 180); }
      for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#fff' : INK; ctx.fillRect(fx + c * 16, 150 + r * 15, 16, 15); ctx.fillRect(fx + c * 16, 330 + r * 15, 16, 15); }
      const mx = x0 + Math.min(me, 100) * kx + Math.sin(now * 80) * shk * 20, rx = x0 + Math.min(rival, 100) * kx;
      shadow(mx, 372, 46, 12); shadow(rx, 450, 40, 10);
      claude(mx, 300, 8, { run: g.result ? null : now, mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      drawBug(rx, 420, Math.PI / 2, 1.3, now);
      txt('YOU', 50 - OX, 175, 24); txt('BUG', 50 - OX, 355, 24);
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
    if (clock < goAt) { g.result = 'lose'; sfx.buzz(); shake(7, .25); }
    else { rt = (clock - goAt) * 1000 | 0; g.result = 'win'; sfx.hit(); sfx.coin(); burst(W / 2, 330, '#5CFF7A', 16); ring(W / 2, 330, '#5CFF7A', 100); floatText(rt < 300 ? 'FAST!' : 'NICE!', W / 2 - 220, 230, '#fff'); }
  };
  const g = {
    wide: true, cmd: 'WAIT!', hint: 'PRESS ONLY AT GREEN', thint: 'TAP ONLY AT GREEN', dur: 4,
    key() { press(); }, down() { press(); },
    update(dt) {
      if (g.result) return;
      const was = clock < goAt; clock += dt;
      if (was && clock >= goAt) { sfx.pop(); sfx.blip(7); ring(W / 2, 330, '#5CFF7A', 80, .35); }
      if (clock > goAt + win) { g.result = 'lose'; sfx.miss(); }
    },
    draw(t) {
      bg('#6B7A8F', '#5f6e83', t);
      const go = clock >= goAt, early = g.result === 'lose' && clock < goAt;
      shadow(W / 2 + 10, 478, 90, 16); box3(W / 2 - 80, 90, 160, 300, '#2b2b3a', 6);
      if (!go) { ctx.globalAlpha = .25; circ(W / 2, 150, 62, '#ff3b3b', 0); ctx.globalAlpha = 1; } else { ctx.globalAlpha = .3 + Math.sin(now * 20) * .1; circ(W / 2, 330, 64, '#5CFF7A', 0); ctx.globalAlpha = 1; }
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
  let picked = -1, pk = 1;
  const icon = (k, cx, cy, s) => {
    if (k === 0) { circ(cx, cy, s * .8, '#9a9aa8', 5); ctx.fillStyle = '#c8c8d4'; ctx.fillRect(cx - s * .45, cy - s * .4, s * .3, s * .22); }
    else if (k === 1) { box(cx - s * .7, cy - s * .85, s * 1.4, s * 1.7, '#fff', 5); ctx.fillStyle = '#9ad'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - s * .45, cy - s * .5 + i * s * .45, s * .9, s * .12); }
    else {
      ctx.lineCap = 'round';
      for (const [w, c] of [[s * .42, INK], [s * .26, '#ff5a4d']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx - s * .8, cy - s * .8); ctx.lineTo(cx + s * .5, cy + s * .5); ctx.moveTo(cx + s * .8, cy - s * .8); ctx.lineTo(cx - s * .5, cy + s * .5); ctx.stroke(); }
      circ(cx - s * .55, cy + s * .7, s * .26, '#FFE14D', 4); circ(cx + s * .55, cy + s * .7, s * .26, '#FFE14D', 4); ctx.lineCap = 'butt';
    }
  };
  const choose = c => {
    if (g.result) return; picked = c; g.result = (c - o + 3) % 3 === 1 ? 'win' : 'lose'; pk = 0;
    if (g.result === 'win') { sfx.hit(); sfx.coin(); burst(200 + c * 220, 440, '#5CFF7A', 14); floatText('NICE!', 400, 320, '#fff'); } else { sfx.buzz(); shake(6, .22); burst(200 + c * 220, 440, '#FF4D4D', 10); }
  };
  const g = {
    wide: true, cmd: 'BEAT IT!', hint: 'PICK WHAT BEATS IT', thint: 'TAP WHAT BEATS IT', dur: 4.5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 380 && p.y < 520) choose(i); },
    update(dt) { pk = Math.min(1, pk + dt * 5); },
    draw(t) {
      bg('#F4A6C0', '#ee95b3', t);
      box3(300, 90, 200, 200, 'rgba(255,255,255,.55)', 6); icon(o, 400, 190 + Math.sin(now * 6) * 4, 62);
      for (let i = 0; i < 3; i++) {
        const show = g.result && i === picked;
        const pop = show ? 1 + Math.sin(pk * Math.PI) * .1 : 1; ctx.save(); ctx.translate(200 + i * 220, 450); ctx.scale(pop, pop); ctx.translate(-200 - i * 220, -450);
        box3(100 + i * 220, 380, 200, 140, show ? (g.result === 'win' ? '#5CFF7A' : '#FF4D4D') : '#fff', 5, show ? 3 : 6);
        icon(i, 200 + i * 220, 440, 32); txt((i + 1) + ' ' + window.t(names[i]), 200 + i * 220, 500, 22, INK); ctx.restore();
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
  shuffle(opts); let picked = -1, pk = 1;
  const choose = i => {
    if (g.result) return; picked = i; g.result = opts[i] === ans ? 'win' : 'lose'; pk = 0;
    if (g.result === 'win') { sfx.hit(); sfx.coin(); burst(200 + i * 220, 405, '#5CFF7A', 14); ring(200 + i * 220, 405, '#fff', 90); floatText('NICE!', 400, 260, '#fff'); } else { sfx.buzz(); shake(6, .22); burst(200 + i * 220, 405, '#FF4D4D', 10); }
  };
  const g = {
    wide: true, cmd: 'SOLVE!', hint: 'PICK THE ANSWER (1 2 3)', thint: 'TAP THE ANSWER', dur: 5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 3) choose(v - 1); },
    down(p) { const i = Math.floor((p.x - 100) / 220); if (i >= 0 && i < 3 && p.x - 100 - i * 220 <= 200 && p.y > 340 && p.y < 470) choose(i); },
    update(dt) { pk = Math.min(1, pk + dt * 5); },
    draw(t) {
      bg('#C0F0A0', '#b0e690', t);
      txt(`${a} ${op} ${b} = ?`, W / 2, 170, 110, '#fff');
      for (let i = 0; i < 3; i++) {
        const show = g.result && (opts[i] === ans || i === picked);
        const pop = i === picked ? 1 + Math.sin(pk * Math.PI) * .1 : 1; ctx.save(); ctx.translate(200 + i * 220, 405); ctx.scale(pop, pop); ctx.translate(-200 - i * 220, -405);
        box3(100 + i * 220, 340, 200, 130, show ? (opts[i] === ans ? '#5CFF7A' : '#FF4D4D') : '#fff', 5, show ? 3 : 6);
        txt(String(opts[i]), 200 + i * 220, 405, 72, show ? '#fff' : INK); ctx.restore();
      }
      shadow(W / 2, 566, 40, 10); claude(W / 2, 560, 5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
    }
  };
  return g;
}

/* 19 ── SORT: click the numbers in order (mouse) */
function gSort(sp) {
  const n = sp > 1.5 ? 6 : 5;
  const cells = shuffle([...Array(12).keys()]).slice(0, n);
  const balls = cells.map((c, i) => ({ v: i + 1, x: 100 - OX + (c % 4) * (VW - 200) / 3 + (Math.random() - .5) * 40, y: 160 + (c / 4 | 0) * 135 + (Math.random() - .5) * 30, done: false, sh: 0, pk: 1 }));
  shuffle(balls); let next = 1;
  const cols = ['#ff6b6b', '#4DB8FF', '#ffd23f', '#9be564', '#c792ea', '#ff9f43'];
  const g = {
    wide: true, cmd: 'SORT!', hint: 'CLICK 1, 2, 3... IN ORDER', thint: 'TAP 1, 2, 3... IN ORDER', dur: 5,
    down(p) {
      for (const b of balls) if (!b.done && Math.hypot(p.x - b.x, p.y - b.y) < 44) {
        if (b.v === next) { b.done = true; b.pk = 0; next++; sfx.pop(); sfx.blip(next * 2); burst(b.x, b.y, cols[b.v - 1], 8); floatText('+1', b.x, b.y - 40, '#fff', 30); if (next > n) { g.result = 'win'; sfx.coin(); sfx.sparkle(); ring(b.x, b.y, '#fff', 100); } }
        else { b.sh = .3; sfx.miss(); shake(3, .12); }
        return;
      }
    },
    update(dt) { balls.forEach(b => { b.sh = Math.max(0, b.sh - dt); b.pk = Math.min(1, b.pk + dt * 4); }); },
    draw(t) {
      bg('#FFB4A2', '#ffa690', t);
      for (const b of balls) {
        const sx = Math.sin(now * 70) * b.sh * 30;
        const s = 1 + Math.sin(b.pk * Math.PI) * .25; shadow(b.x + sx + 4, b.y + 44, 34 * s, 9);
        ctx.save(); ctx.translate(b.x + sx, b.y); ctx.scale(s, s); circ(0, 0, 40, b.done ? '#5CFF7A' : cols[b.v - 1], 5); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-12, -16, 10, 6, -.6, 0, 7); ctx.fill(); txt(String(b.v), 0, 3, 46); ctx.restore();
      }
    }
  };
  return g;
}

/* 20 ── FIND IT: the cup shuffle (mouse) */
function gShell(sp) {
  const gap = 200 + OX * .6, xs = [W / 2 - gap, W / 2, W / 2 + gap], cups = xs.map(x => ({ x, from: x, to: x, lift: 0 }));
  const hid = Math.random() * 3 | 0, swaps = 4 + (sp > 1.4) * 2 + (sp > 1.8), sd = .4 / sp;
  let phase = 'show', clock = 0, done = 0, sw = null, swT = 0, picked = -1;
  const startSwap = () => {
    const a = Math.random() * 3 | 0; let b; do { b = Math.random() * 3 | 0; } while (b === a);
    sw = { a, b }; swT = 0; cups[a].from = cups[a].x; cups[a].to = cups[b].x; cups[b].from = cups[b].x; cups[b].to = cups[a].x;
  };
  const g = {
    wide: true, cmd: 'FIND IT!', hint: 'FIND CLAUDE', dur: 6.5,
    down(p) {
      if (phase !== 'pick' || g.result) return;
      cups.forEach((c, i) => { if (Math.abs(p.x - c.x) < 66 && p.y > 250 && p.y < 400) { picked = i; g.result = i === hid ? 'win' : 'lose'; if (g.result === 'win') { sfx.coin(); sfx.sparkle(); burst(c.x, 340, '#FFE14D', 16); ring(c.x, 340, '#fff', 90); floatText('NICE!', c.x, 230, '#fff'); } else { sfx.buzz(); shake(6, .22); } } });
    },
    update(dt) {
      clock += dt;
      cups.forEach((c, i) => {
        const up = (phase === 'show' && i === hid) || (g.result && (i === hid || i === picked));
        c.lift += ((up ? 1 : 0) - c.lift) * Math.min(1, 12 * dt);
      });
      if (phase === 'show' && clock > 1.1) { phase = 'swap'; g.hint = 'WATCH...'; sfx.thud(); startSwap(); }
      else if (phase === 'swap') {
        swT += dt; const k = Math.min(1, swT / sd), e = k * k * (3 - 2 * k);
        for (const i of [sw.a, sw.b]) cups[i].x = cups[i].from + (cups[i].to - cups[i].from) * e;
        if (k >= 1) { sfx.blip(-7); if (++done >= swaps) { phase = 'pick'; g.hint = 'PICK A CUP!'; sfx.pop(); } else { sfx.whoosh(); startSwap(); } }
      }
    },
    draw(t) {
      bg('#6C5CE7', '#5e4ed8', t);
      ctx.fillStyle = INK; ctx.fillRect(-OX, 384, VW, 10); ctx.fillStyle = '#4b3fb3'; ctx.fillRect(-OX, 394, VW, 206);
      for (const c of cups) shadow(c.x, 386, 62 - c.lift * 10, 14, .3 - c.lift * .12);
      claude(cups[hid].x, 380, 5.5, { mood: g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : null });
      for (const c of cups) {
        ctx.save(); ctx.translate(c.x, 380 - c.lift * 120);
        ctx.beginPath(); ctx.moveTo(-42, -112); ctx.lineTo(42, -112); ctx.lineTo(62, 0); ctx.lineTo(-62, 0); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#4DB8FF'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-26, -90, 10, 50); ctx.fillStyle = '#2f9ae6'; ctx.fillRect(34, -100, 8, 90); ctx.restore();
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
    wide: true, cmd: 'SCRUB!', hint: 'RUB THE MOUSE ALL OVER', thint: 'RUB YOUR FINGER ALL OVER', dur: 5.5,
    move(p) {
      if (g.result) { prev = p; return; }
      if (prev) {
        const d = Math.min(80, Math.hypot(p.x - prev.x, p.y - prev.y));
        for (let i = 0; i < dirt.length; i++) {
          const cx = ox + (i % cols + .5) * cw, cy = oy + ((i / cols | 0) + .5) * ch;
          if (Math.hypot(cx - p.x, cy - p.y) < 56) dirt[i] = Math.max(0, dirt[i] - d * .009);
        }
        if (d > 14 && Math.random() < .3) { sfx.blip(Math.random() * 6 | 0); burst(p.x, p.y, '#fff', 2, 120); }
        if (dirt.filter(v => v < .25).length >= dirt.length * .9) { g.result = 'win'; sfx.coin(); sfx.sparkle(); ring(400, 270, '#fff', 160); floatText('SPARKLING!', 400, 270, '#fff', 56); burst(400, 270, '#FFE14D', 20); }
      }
      prev = p;
    },
    update() {},
    draw(t) {
      bg('#A8DADC', '#97cfd2', t);
      box3(ox, oy, cols * cw, rows * ch, '#cfefff', 8, 8);
      claude(400, 450, 17, { mood: g.result === 'win' ? 'happy' : null });
      for (let i = 0; i < dirt.length; i++) {
        if (g.result === 'win' || dirt[i] <= .02) continue;
        ctx.fillStyle = `rgba(105,78,50,${dirt[i] * .93})`;
        ctx.fillRect(ox + (i % cols) * cw, oy + (i / cols | 0) * ch, cw + 1, ch + 1);
      }
      if (g.result === 'win') star(560, 180, 26, 10, 4, now * 2, '#fff', 3);
      const m = mouse; box3(m.x - 24, m.y - 16, 48, 32, '#FFE14D', 4, 4);
    }
  };
  return g;
}

/* 22 ── DODGE: survive the bouncing bugs (mouse or arrows / WASD) */
function gDodge(sp, extra = 0) {
  const me = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2 };
  const n = 5 + (sp > 1.5) + extra + Math.round(OX / 200), L = -OX + 30, R = W + OX - 30;
  const balls = Array.from({ length: n }, () => {
    const a = Math.random() * 6.28, left = Math.random() < .5;
    return { x: left ? L + 40 : R - 40, y: 110 + Math.random() * 380, vx: Math.cos(a) * 250 * sp, vy: Math.sin(a) * 250 * sp, r: 24 };
  });
  const g = {
    wide: true, cmd: 'DODGE!', hint: 'MOUSE OR ARROWS', thint: 'DRAG TO DODGE', dur: 5, timeWin: true,
    move(p) { me.tx = p.x; me.ty = p.y; },
    update(dt) {
      if (g.result) return;
      if (keys.ArrowLeft || keys.KeyA) me.tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) me.tx += 700 * dt;
      if (keys.ArrowUp || keys.KeyW) me.ty -= 700 * dt; if (keys.ArrowDown || keys.KeyS) me.ty += 700 * dt;
      me.tx = Math.max(L + 20, Math.min(R - 20, me.tx)); me.ty = Math.max(90, Math.min(500, me.ty));
      me.x += (me.tx - me.x) * Math.min(1, 16 * dt); me.y += (me.ty - me.y) * Math.min(1, 16 * dt);
      for (const b of balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < L || b.x > R) { b.vx = -b.vx; b.x = Math.max(L, Math.min(R, b.x)); b.w = .15; if (Math.random() < .3) sfx.blip(-12); }
        if (b.y < 70 || b.y > 520) { b.vy = -b.vy; b.y = Math.max(70, Math.min(520, b.y)); b.w = .15; if (Math.random() < .3) sfx.blip(-12); }
        if (b.w > 0) b.w -= dt;
        if (Math.hypot(b.x - me.x, b.y - me.y) < b.r + 24) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); confetti(me.x, me.y, 20); burst(me.x, me.y, '#FF4D4D', 18); ring(me.x, me.y, '#fff', 90); }
      }
    },
    draw(t) {
      bg('#2b2757', '#322d66', t);
      ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.strokeRect(L - 10, 60, VW - 40, 470); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(L - 10, 60, VW - 40, 470);
      for (const b of balls) { shadow(b.x + 4, b.y + 28, 22, 7); drawBug(b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI / 2, .8 * (1 + (b.w > 0 ? b.w : 0)), now); }
      shadow(me.x, me.y + 38, 24, 7);
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
