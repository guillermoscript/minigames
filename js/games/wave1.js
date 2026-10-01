'use strict';
/* Wave 1: the originals — each game: {cmd, hint, dur, update(dt), draw(t), key/down/up/move}; set g.result = 'win'|'lose' */
/* 1 ── SWAT: click the bugs (mouse) */
function gSwat(sp) {
  const n = 3 + (sp > 1.4) + (sp > 1.9);
  const bugs = Array.from({ length: n }, () => ({
    x: 120 + Math.random() * 560, y: 130 + Math.random() * 330, a: Math.random() * 6.28,
    v: (140 + Math.random() * 60) * sp, dead: 0, turn: 0
  }));
  const splats = [], pings = [];
  const g = {
    cmd: 'SWAT!', hint: 'CLICK THE BUGS', thint: 'TAP THE BUGS', dur: 5,
    update(dt) {
      pings.forEach(p => p.t += dt);
      if (g.result) return;
      for (const b of bugs) {
        if (b.dead) continue;
        b.turn -= dt; if (b.turn < 0) { b.a += (Math.random() - .5) * 2.4; b.turn = .25 + Math.random() * .5; }
        b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * dt;
        if (b.x < 50) { b.x = 50; b.a = Math.PI - b.a } if (b.x > 750) { b.x = 750; b.a = Math.PI - b.a }
        if (b.y < 100) { b.y = 100; b.a = -b.a } if (b.y > 500) { b.y = 500; b.a = -b.a }
      }
    },
    down(p) {
      pings.push({ x: p.x, y: p.y, t: 0 });
      let hit = false;
      for (const b of bugs) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < 44) { b.dead = 1; hit = true; splats.push({ x: b.x, y: b.y, r: Math.random() * 6 }); burst(b.x, b.y, '#e8433a', 12); ring(b.x, b.y, '#fff', 70); floatText('SPLAT!', b.x, b.y - 30, '#FFE14D', 30); }
      if (hit) { sfx.splat(); sfx.hit(); shake(5, .15); } else sfx.miss();
      if (bugs.every(b => b.dead)) { g.result = 'win'; sfx.sparkle(); }
    },
    draw(t) {
      bg('#B8E05A', '#a8d046', t);
      for (const s of splats) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r);
        circ(0, 0, 26, '#5f8a1a', 4);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; circ(Math.cos(a) * 36, Math.sin(a) * 36, 7, '#5f8a1a', 3); }
        ctx.restore();
      }
      for (const b of bugs) if (!b.dead) {
        shadow(b.x + 8, b.y + 30, 26, 8, .22);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a + Math.PI / 2);
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (const i of [-1, 0, 1]) for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, i * 12); ctx.lineTo(s * 32, i * 12 + Math.sin(now * 25 + i * 2 + s) * 9); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(0, 0, 21, 28, 0, 0, 7); ctx.fillStyle = '#e8433a'; ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
        circ(0, -30, 11, INK, 0);
        ctx.fillStyle = '#fff'; ctx.fillRect(-7, -35, 5, 5); ctx.fillRect(2, -35, 5, 5);
        ctx.fillStyle = INK; for (const d of [[-8, -6], [8, 4], [-6, 14], [7, -14]]) { ctx.beginPath(); ctx.arc(d[0], d[1], 4, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-8, -14, 4, 8, .3, 0, 7); ctx.fill();
        ctx.restore();
      }
      for (const p of pings) if (p.t < .3) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + p.t * 120, 0, 7); ctx.stroke();
      }
      if (g.result === 'win') claude(W - 90, 540, 5, { mood: 'happy' });
    }
  };
  return g;
}

/* 2 ── JUMP: hop over the bugs (space / up / click) */
function gJump(sp) {
  const spd = 420 * sp, GY = 450;
  let py = 0, vy = 0, scroll = 0, land = 0;
  const obs = [{ x: 860 }, { x: 860 + (500 + Math.random() * 80) * sp }];
  const g = {
    cmd: 'JUMP!', hint: 'SPACE OR CLICK TO JUMP', thint: 'TAP TO JUMP', dur: 4.4, timeWin: true,
    jump() { if (py === 0 && !g.result) { vy = -960; sfx.boing(); sfx.whoosh(); burst(150, GY, '#c9e8a0', 6, 140); } },
    key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') g.jump(); },
    down() { g.jump(); },
    update(dt) {
      if (g.result) return;
      scroll += spd * dt;
      vy += 2600 * dt; py += vy * dt; if (py >= 0) { if (vy > 300) { sfx.thud(); burst(150, GY, '#c9e8a0', 5, 120); land = .15; } py = 0; vy = 0; }
      land = Math.max(0, land - dt);
      for (const o of obs) {
        o.x -= spd * dt;
        if (Math.abs(o.x - 150) < 28 + 50 && py > -64) { g.result = 'lose'; sfx.buzz(); sfx.thud(); shake(10, .3); burst(150, GY - 30, '#ff5a4d', 14); }
        else if (!o.passed && o.x < 90 && !g.result) { o.passed = 1; sfx.blip(7); floatText('NICE!', 150, GY - 140, '#5CFF7A', 30); }
      }
    },
    draw(t) {
      bg('#6EC6FF', '#5fb8f5', t);
      for (let i = 0; i < 4; i++) { const cx = ((i * 260 - scroll * .25) % 1040 + 1040) % 1040 - 120; circ(cx, 110 + i * 25, 28, '#fff', 4); circ(cx + 34, 120 + i * 25, 22, '#fff', 4); circ(cx - 34, 124 + i * 25, 20, '#fff', 4); }
      ctx.fillStyle = INK; ctx.fillRect(0, GY - 4, W, 160);
      ctx.fillStyle = '#58c24a'; ctx.fillRect(0, GY, W, 26);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(0, GY + 26, W, 140);
      ctx.fillStyle = '#6a4526';
      for (let i = 0; i < 12; i++) ctx.fillRect(((i * 90 - scroll) % 1080 + 1080) % 1080 - 60, GY + 60 + (i % 3) * 30, 40, 10);
      for (const o of obs) {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(o.x - 32 + i * 22 - 4, GY - 62); ctx.lineTo(o.x - 21 + i * 22, GY - 92); ctx.lineTo(o.x - 10 + i * 22 + 4, GY - 62); ctx.fill();
          ctx.fillStyle = '#ff5a4d'; ctx.beginPath(); ctx.moveTo(o.x - 29 + i * 22, GY - 64); ctx.lineTo(o.x - 21 + i * 22, GY - 86); ctx.lineTo(o.x - 13 + i * 22, GY - 64); ctx.fill(); }
        box(o.x - 30, GY - 64, 60, 64, '#ff5a4d', 4);
        txt('!', o.x, GY - 32, 44, '#fff');
      }
      shadow(150, GY + 6, 46 - Math.min(20, -py * .12), 9, Math.max(.08, .28 + py * .0015));
      claude(150, GY + py + land * 20, 9, { run: py === 0 && !g.result ? now : null, mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null });
    }
  };
  return g;
}

/* 3 ── TYPE: type the word (keyboard) */
function gType(sp, forced) {
  const pool = sp < 1.2 ? ['BUG', 'FIX', 'SHIP', 'CODE'] : ['BUG', 'FIX', 'SHIP', 'CODE', 'DEBUG', 'MERGE', 'PUSH', 'TEST', 'CLAUDE', 'TOKEN'];
  const w = forced || pool[Math.random() * pool.length | 0];
  let i = 0, shk = 0;
  const uniq = [...new Set(w.split(''))];
  const extra = shuffle('ETAOINSHRDLUCMFWYPBGVK'.split('').filter(c => !uniq.includes(c))).slice(0, Math.max(0, 10 - uniq.length));
  const pad = shuffle(uniq.concat(extra));              // on-screen letters for touch devices
  const padRect = j => ({ x: 40 + (j % 5) * 124, y: 405 + (j / 5 | 0) * 66, w: 110, h: 56 });
  const press = k => {
    if (g.result) return;
    if (k === w[i]) { const bx = (W - (w.length * (w.length > 6 ? 74 : 108) - (w.length > 6 ? 8 : 12))) / 2 + i * (w.length > 6 ? 74 : 108) + (w.length > 6 ? 33 : 48); i++; sfx.blip(i * 2); burst(bx, 240, '#5CFF7A', 8, 200); if (i === w.length) { g.result = 'win'; sfx.coin(); sfx.sparkle(); confetti(W / 2, 240, 40); } }
    else { shk = .25; sfx.miss(); shake(5, .15); }
  };
  const g = {
    cmd: 'TYPE!', hint: 'TYPE THE WORD', dur: 5.5,
    key(e) { if (e.key && e.key.length === 1) press(e.key.toUpperCase()); },
    down(p) {
      if (!TOUCH) return;
      pad.forEach((c, j) => { const r = padRect(j); if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) press(c); });
    },
    update(dt) { shk = Math.max(0, shk - dt); },
    draw(t) {
      bg('#FF8FD0', '#ff7cc6', t);
      const n = w.length, sz = n > 6 ? 66 : 96, gap = n > 6 ? 8 : 12, tot = n * sz + (n - 1) * gap, x0 = (W - tot) / 2;
      const sx = Math.sin(now * 80) * shk * 40;
      for (let k = 0; k < n; k++) {
        const done = k < i, cur = k === i && !g.result;
        shadow(x0 + k * (sz + gap) + sx + sz / 2 + 6, 190 + sz + 12, sz * .5, 8, .2);
        const y = 190 - (cur ? Math.abs(Math.sin(now * 8)) * 12 : 0);
        box3(x0 + k * (sz + gap) + sx, y, sz, sz, done ? '#5CFF7A' : cur ? '#FFE14D' : '#fff', 5, 6);
        txt(w[k], x0 + k * (sz + gap) + sz / 2 + sx, y + sz / 2 + 4, sz * .66, done ? '#fff' : INK);
      }
      if (TOUCH) {
        pad.forEach((c, j) => { const r = padRect(j); box(r.x, r.y, r.w, r.h, '#fff', 5); txt(c, r.x + r.w / 2, r.y + r.h / 2 + 2, 38, INK); });
        claude(W - 70, 370, 5, { mood: g.result === 'win' ? 'happy' : null });
      } else {
        claude(W / 2, 470, 9, { mood: g.result === 'win' ? 'happy' : null });
        box(W / 2 - 200, 462, 400, 70, '#3c3c4e', 5);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) {
          const hot = ((now * 14 | 0) + r * 3 + c) % 7 === 0 && !g.result;
          ctx.fillStyle = hot ? '#FFE14D' : '#8a8aa0'; ctx.fillRect(W / 2 - 188 + c * 34, 472 + r * 19, 28, 14);
        }
      }
    }
  };
  return g;
}

/* 4 ── SPOT: find the odd one out (mouse) */
function gSpot(sp) {
  const cols = sp < 1.3 ? 4 : sp < 1.6 ? 5 : 6, rows = 3, y0 = 60;
  const cw = W / cols, ch = 450 / rows, u = Math.min(cw / 15, ch / 13);
  const odd = Math.random() * cols * rows | 0;
  const dh = sp < 1.3 ? 150 : sp < 1.6 ? 70 : 32;
  const base = 'hsl(15,68%,60%)', oddC = `hsl(${15 + dh},68%,60%)`;
  let pick = -1;
  const g = {
    cmd: 'SPOT IT!', hint: 'FIND THE ODD ONE', thint: 'TAP THE ODD ONE', dur: 4.5,
    down(p) {
      const c = p.x / cw | 0, r = (p.y - y0) / ch | 0;
      if (p.y < y0 || c < 0 || c >= cols || r < 0 || r >= rows) return;
      pick = r * cols + c; g.result = pick === odd ? 'win' : 'lose';
      const px = cw * c + cw / 2, py = y0 + ch * r + ch / 2;
      if (pick === odd) { sfx.coin(); sfx.sparkle(); burst(px, py, '#FFE14D', 16); ring(px, py, '#fff', 100); floatText('FOUND IT!', px, py - 40, '#5CFF7A', 36); } else { sfx.buzz(); shake(6, .2); burst(px, py, '#FF4D4D', 8); }
    },
    update() {},
    draw(t) {
      bg('#4FD1C5', '#42c4b8', t);
      for (let k = 0; k < cols * rows; k++) {
        const c = k % cols, r = k / cols | 0, cx = cw * c + cw / 2, cy = y0 + ch * r + ch / 2;
        const bob = Math.sin(now * 3 + k * 1.3) * 4;
        shadow(cx, cy + 5.5 * u + 4, u * 7, u * 1.4, .2 - bob * .01);
        claude(cx, cy + 5.5 * u + bob, u, { col: k === odd ? oddC : base, mood: g.result && k === pick ? (k === odd ? 'happy' : 'sad') : null });
      }
      if (g.result) {
        const c = odd % cols, r = odd / cols | 0;
        ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cw * c + cw / 2, y0 + ch * r + ch / 2, u * 8, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 7; ctx.stroke();
      }
    }
  };
  return g;
}

/* 5 ── MASH: pump the balloon (space or click) */
function gMash(sp) {
  let fill = 0, bump = 0, tick = 0;
  const g = {
    cmd: 'MASH!', hint: 'MASH SPACE OR CLICK', thint: 'TAP TAP TAP!', dur: 4.5,
    pump() {
      if (g.result) return;
      fill += 7.5; bump = .12; snd(220 + fill * 5, .06, 'square', .06); sfx.click(); if (fill > 70) noise(.06, .03, 2000, 4000, 'highpass');
      if (fill >= 100) { fill = 100; g.result = 'win'; confetti(W / 2, 260, 50); sfx.pop(); sfx.stamp(); shake(14, .4); ring(W / 2, 260, '#fff', 200, .5); burst(W / 2, 260, '#FF4D9E', 24, 400); }
    },
    key(e) { if (e.code === 'Space') g.pump(); },
    down() { g.pump(); },
    update(dt) { tick += dt; bump = Math.max(0, bump - dt); if (!g.result) fill = Math.max(0, fill - 14 * sp * dt); },
    draw(t) {
      bg('#FFD23F', '#ffc61a', t);
      claude(W / 2, 545, 8, { mood: g.result === 'win' ? 'happy' : null });
      if (g.result === 'win') {
        star(W / 2, 260, 240, 140, 14, now * .5, '#fff', 6);
        star(W / 2, 260, 200, 110, 14, -now * .4, '#FF4D9E', 0);
        txt('POP!', W / 2, 260, 120, '#FFE14D');
        return;
      }
      shadow(W / 2, 486, 40 + fill * .3, 9, .22);
      const r = 36 + fill * 1.5 + bump * 60, cx = W / 2 + Math.sin(tick * 40) * fill * .05, cy = 270 - bump * 20;
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy + r); ctx.lineTo(W / 2, 478); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, r * .88, r, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, r * .88 - 5, r - 5, 0, 0, 7); ctx.fillStyle = fill > 80 ? '#ff2d55' : '#ff4f8b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, r * .65, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx - 10, cy + r + 10); ctx.lineTo(cx + 10, cy + r + 10); ctx.lineTo(cx, cy + r - 4); ctx.fill();
    }
  };
  return g;
}

/* 6 ── CATCH: collect tokens, dodge bombs (mouse or arrows / A D) */
function gCatch(sp) {
  const FY = 528;
  const kinds = ['t', 't', 't', 'b', 'b'].sort(() => Math.random() - .5);
  const items = kinds.map((k, i) => ({ k, x: 90 + Math.random() * 620, y: -40, at: .2 + i * .6 / sp, on: false }));
  const me = { x: W / 2, tx: W / 2 };
  let caught = 0, happy = 0, clock = 0;
  const g = {
    cmd: 'CATCH!', hint: 'MOUSE OR ARROWS', thint: 'DRAG LEFT AND RIGHT', dur: 5.2,
    move(p) { me.tx = p.x; },
    update(dt) {
      happy = Math.max(0, happy - dt);
      if (g.result) return;
      clock += dt;
      if (keys.ArrowLeft || keys.KeyA) me.tx -= 760 * dt;
      if (keys.ArrowRight || keys.KeyD) me.tx += 760 * dt;
      me.tx = Math.max(60, Math.min(740, me.tx));
      me.x += (me.tx - me.x) * Math.min(1, 18 * dt);
      for (const it of items) {
        if (!it.on && clock >= it.at) it.on = true;
        if (!it.on || it.gone) continue;
        it.y += 380 * sp * dt;
        if (it.y + 22 >= FY - 100 && it.y - 22 <= FY && Math.abs(it.x - me.x) < 64 + 11) {
          it.gone = true;
          if (it.k === 'b') { g.result = 'lose'; confetti(it.x, it.y, 20); sfx.splat(); sfx.thud(); sfx.buzz(); shake(12, .35); ring(it.x, it.y, '#FFE14D', 120); }
          else { caught++; happy = .3; sfx.coin(); sfx.blip(caught * 3); burst(it.x, it.y, '#FFC93C', 10); floatText('+1', it.x, it.y - 30, '#FFE14D', 34); if (caught >= 3) { g.result = 'win'; sfx.sparkle(); } }
        } else if (it.y > H + 30) it.gone = true;
      }
      const left = items.filter(i => i.k === 't' && !i.gone).length;
      if (caught + left < 3) g.result = 'lose';
    },
    draw(t) {
      bg('#2A1B5C', '#34236e', t);
      ctx.fillStyle = '#fff'; for (let i = 0; i < 24; i++) ctx.fillRect((i * 97) % W, (i * 53 + now * 30 * (1 + i % 3)) % 520, 3, 3);
      shadow(me.x, FY + 4, 56, 10, .3);
      for (const it of items) {
        if (!it.on || it.gone) continue;
        shadow(it.x, FY + 4, 14 + it.y * .01, 4, .1 + it.y / 3000);
        if (it.k === 't') {
          circ(it.x, it.y, 22, '#FFC93C', 4);
          ctx.strokeStyle = OR; ctx.lineWidth = 5; ctx.lineCap = 'round';
          for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4 + now * 2; ctx.beginPath(); ctx.moveTo(it.x - Math.cos(an) * 12, it.y - Math.sin(an) * 12); ctx.lineTo(it.x + Math.cos(an) * 12, it.y + Math.sin(an) * 12); ctx.stroke(); }
          ctx.lineCap = 'butt';
        } else {
          circ(it.x, it.y, 22, '#2b2b3a', 4);
          ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(it.x + 10, it.y - 18); ctx.lineTo(it.x + 20, it.y - 32); ctx.stroke();
          star(it.x + 21, it.y - 34, 9 + Math.sin(now * 30) * 3, 4, 6, now * 9, '#FFE14D', 2);
          ctx.fillStyle = '#fff'; ctx.fillRect(it.x - 10, it.y - 8, 6, 6);
        }
      }
      claude(me.x, FY, 8, { mood: g.result === 'lose' ? 'sad' : (happy > 0 || g.result === 'win') ? 'happy' : null, run: Math.abs(me.tx - me.x) > 8 ? now : null });
      for (let k = 0; k < 3; k++) circ(W - 100 + k * 36, 90, 12, k < caught ? '#FFC93C' : '#3d2f7a', 3);
    }
  };
  return g;
}

reg('swat', gSwat, 'SWAT');
reg('jump', gJump, 'JUMP');
reg('type', gType, 'TYPE');
reg('spot', gSpot, 'SPOT IT');
reg('mash', gMash, 'MASH');
reg('catch', gCatch, 'CATCH');
