'use strict';
/* Wave 2 — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 7 ── STOP: freeze the needle in the green zone (space or click) */
function gStop(sp) {
  const zw = 150 / Math.sqrt(sp), zx = 150 + Math.random() * (500 - zw);
  let ph = Math.random() * 2, stopped = false, lq = Math.floor(ph);
  const pos = () => 100 + 600 * Math.abs(((ph % 2) + 2) % 2 - 1);
  const g = {
    cmd: 'STOP!', hint: 'STOP IN THE GREEN', thint: 'TAP TO STOP', dur: 5,
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
    cmd: "DON'T!", hint: "DON'T TOUCH ANYTHING", dur: 4, timeWin: true,
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

/* 9 ── COUNT: how many Claudes? (number keys or click) */
function gCount(sp) {
  const n = 2 + (Math.random() * 4 | 0) + (sp > 1.5 ? 1 : 0);
  const cells = [...Array(8).keys()].sort(() => Math.random() - .5).slice(0, n);
  const pts = cells.map((c, i) => ({ x: (c % 4) * 200 + 100 + (Math.random() - .5) * 40, y: 175 + (c / 4 | 0) * 150 + (Math.random() - .5) * 20, at: .1 + i * .22 / sp }));
  let clock = 0, picked = 0;
  const x0 = 56, bw = 76, step = 86, by = 440;
  const choose = v => { if (g.result) return; picked = v; g.result = v === n ? 'win' : 'lose';
    const bx = x0 + (v - 1) * step + bw / 2;
    if (v === n) { sfx.coin(); sfx.sparkle(); burst(bx, by, '#5CFF7A', 14); ring(bx, by + 40, '#fff', 90); floatText('YES!', bx, by - 30, '#5CFF7A', 38); } else { sfx.buzz(); shake(6, .2); burst(bx, by, '#FF4D4D', 8); } };
  const g = {
    cmd: 'COUNT!', hint: 'HOW MANY CLAUDES?', thint: 'TAP THE NUMBER', dur: 5,
    key(e) { const v = +e.key; if (v >= 1 && v <= 8) choose(v); },
    down(p) { const i = Math.floor((p.x - x0) / step); if (i >= 0 && i < 8 && p.x - x0 - i * step <= bw && p.y > by && p.y < by + 80) choose(i + 1); },
    update(dt) { clock += dt; pts.forEach(p => { if (!p.s && clock >= p.at) { p.s = 1; sfx.pop(); } }); },
    draw(t) {
      bg('#A0E7E5', '#8fdbd9', t);
      for (const p of pts) if (clock >= p.at) {
        const k = Math.min(1, (clock - p.at) / .2), sc = k * (1 + Math.sin(k * Math.PI) * .3);
        shadow(p.x, p.y + 28, 30 * sc, 6 * sc, .2);
        claude(p.x, p.y + 25 + Math.sin(now * 5 + p.x) * 4, 4.5 * sc);
      }
      for (let i = 0; i < 8; i++) {
        const v = i + 1, show = g.result && (v === n || v === picked);
        box3(x0 + i * step, by, bw, 80, show ? (v === n ? '#5CFF7A' : '#FF4D4D') : '#fff', 5, 5);
        txt(String(v), x0 + i * step + bw / 2, by + 42, 48, show ? '#fff' : INK);
      }
    }
  };
  return g;
}

/* 10 ── SLICE: swipe the fruit, avoid the bombs (mouse) */
function gSlice(sp) {
  const kinds = ['f', 'f', 'f', 'f', 'b', 'b'].sort(() => Math.random() - .5);
  const cols = ['#ff4d4d', '#9be564', '#ffd23f', '#ff8c42'];
  const items = kinds.map((k, i) => {
    const x = 160 + Math.random() * 480;
    return { k, x, y: 560, vx: (W / 2 - x) * .45 + (Math.random() - .5) * 120, vy: -(930 + Math.random() * 80), at: .2 + i * .5 / sp, c: cols[i % 4] };
  });
  const trail = []; let prev = null, clock = 0, sliced = 0;
  const g = {
    cmd: 'SLICE!', hint: 'SWIPE FRUIT, NOT BOMBS', thint: 'SWIPE THE FRUIT', dur: 5,
    move(p) {
      if (!prev) prev = p;
      trail.push({ x: p.x, y: p.y, l: .25 });
      if (!g.result) for (const it of items) {
        if (!it.on || it.gone) continue;
        if (segD(it.x, it.y, prev.x, prev.y, p.x, p.y) < 30) {
          it.gone = true;
          if (it.k === 'b') { g.result = 'lose'; confetti(it.x, it.y, 25); sfx.splat(); sfx.thud(); sfx.buzz(); shake(12, .35); ring(it.x, it.y, '#FFE14D', 130); }
          else { sliced++; confetti(it.x, it.y, 10); sfx.whoosh(false); sfx.hit(); sfx.blip(sliced * 3); burst(it.x, it.y, it.c, 12, 300); floatText('+1', it.x, it.y - 30, '#fff', 34); shake(3, .1); if (sliced >= 3) { g.result = 'win'; sfx.sparkle(); } }
        }
      }
      prev = p;
    },
    update(dt) {
      for (let i = trail.length - 1; i >= 0; i--) if ((trail[i].l -= dt) <= 0) trail.splice(i, 1);
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
    draw(t) {
      bg('#2E8B57', '#2a7f4f', t);
      for (const it of items) {
        if (!it.on || it.gone) continue;
        if (it.k === 'f') {
          shadow(it.x + 6, it.y + 34, 22, 6, .18);
          circ(it.x, it.y, 28, it.c, 4);
          ctx.fillStyle = '#3a9d23'; ctx.fillRect(it.x + 2, it.y - 40, 16, 10);
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(it.x - 16, it.y - 14, 8, 8);
          ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.beginPath(); ctx.arc(it.x + 6, it.y + 8, 16, 0, Math.PI); ctx.fill();
        } else {
          circ(it.x, it.y, 28, '#2b2b3a', 4);
          star(it.x + 20, it.y - 36, 9 + Math.sin(now * 30) * 3, 4, 6, now * 9, '#FFE14D', 2);
          ctx.fillStyle = '#fff'; ctx.fillRect(it.x - 14, it.y - 10, 7, 7);
        }
      }
      if (trail.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
          ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, trail[i].l * 4)})`; ctx.lineWidth = 3 + trail[i].l * 36;
          ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      for (let k = 0; k < 3; k++) circ(W - 100 + k * 36, 90, 12, k < sliced ? '#ffd23f' : '#1c5c38', 3);
    }
  };
  return g;
}

/* 11 ── COPY: press the arrows in order (arrow keys or WASD) */
function gCopy(sp) {
  const len = 3 + (sp > 1.5), seq = Array.from({ length: len }, () => Math.random() * 4 | 0);
  const map = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
  let i = 0, shk = 0;
  const g = {
    cmd: 'COPY!', swipe: true, hint: 'PRESS THE ARROWS IN ORDER', thint: 'SWIPE THE ARROWS', dur: 5,
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
    cmd: 'STEADY!', hint: 'ENTER AT GO. DO NOT TOUCH THE WALLS', thint: 'TOUCH GO, THEN DRAG', dur: 6,
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
