'use strict';
/* MEGA MICROGAME$ pack 2 - GBA WarioWare inspired. Strict 4-shade green palette, 8px pixel grid, flat bg, square-wave beeps. */
(() => {
  const A = '#0f380f', B = '#306230', C = '#8bac0f', D = '#9bbc0f';
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const sn = v => Math.round(v / 8) * 8;
  const flat = () => { ctx.fillStyle = D; ctx.fillRect(0, 0, W, H); };
  const bp = (f, d = .06, v = .05, delay = 0) => snd(f, d, 'square', v, delay);
  const sndWin = () => [523, 659, 784, 1047].forEach((f, i) => bp(f, .1, .05, i * .07));
  const sndLose = () => [262, 220, 175, 131].forEach((f, i) => bp(f, .13, .05, i * .09));
  const ptxt = (s, x, y, size, c, align = 'center') => {
    ctx.font = `900 ${size}px "Courier New", monospace`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = c; ctx.fillText(t(s), x, y);
  };
  /* 3x5 pixel font for digits / * / # */
  const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111', '*': '101010111010101', '#': '101111101111101', '_': '000000000000111' };
  function pf(ch, x, y, s, c) {
    const m = FONT[ch]; if (!m) return; ctx.fillStyle = c;
    for (let i = 0; i < 15; i++) if (m[i] === '1') ctx.fillRect(x + (i % 3) * s, y + ((i / 3) | 0) * s, s, s);
  }
  /* tiny per-game square particles + floating labels (no outlines, palette only) */
  function mkFx() {
    const ps = [], fl = [];
    return {
      pop(x, y, n = 8, cols = [A, B, C], sp = 240) {
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (.4 + Math.random() * .7); ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, l: .45 + Math.random() * .3, c: cols[i % cols.length], s: 8 }); }
      },
      text(s, x, y, c = A, size = 36) { fl.push({ s, x, y, l: .9, t: 0, c, z: size }); },
      upd(dt) {
        for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; if (p.l <= 0) ps.splice(i, 1); }
        for (let i = fl.length - 1; i >= 0; i--) { fl[i].t += dt; if (fl[i].t > fl[i].l) fl.splice(i, 1); }
      },
      draw() {
        for (const p of ps) R(sn(p.x), sn(p.y), p.s, p.s, p.c);
        for (const f of fl) { const u = f.t / f.l; if (u < .75 || ((f.t * 16) | 0) % 2) ptxt(f.s, f.x, f.y - sn(u * 40), f.z, f.c); }
      }
    };
  }
  const flatShadow = (x, y, w) => R(sn(x - w / 2), y, sn(w), 8, C);

  /* ── 1 PUMP: mash to inflate into the OK band, don't pass the X line ── */
  reg('mm_pump', sp => {
    const fx = mkFx(), cx = 400, cy = 235, TG = .62, BU = .82, PUMP = .05, LEAK = .08 * sp;
    let s = .06, el = 0, hnd = 0, shards = null, D0 = 5 / Math.sqrt(sp);
    const Rr = v => 24 + v * 170;
    const g = {
      cmd: 'PUMP!', hint: 'MASH CLICK / SPACE - STOP IN THE OK ZONE', thint: 'TAP FAST - STOP IN THE OK ZONE', dur: 5,
      timeWin: true,
      pump() {
        if (g.result) return;
        s += PUMP; hnd = 1; bp(300 + s * 500, .04, .045); fx.pop(cx, 480, 2, [B, C], 120);
        if (s > BU) {
          g.result = 'lose'; shake(10, .35); sndLose(); bp(90, .3, .08, 0); fx.text('BOOM!', cx, 200, A, 56);
          shards = []; const Rb = Rr(BU);
          for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28; shards.push({ x: cx + Math.cos(a) * Rb * .8, y: cy + Math.sin(a) * Rb * .8, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380 - 120, c: [A, B, C][i % 3] }); }
        }
      },
      key(e) { if (e.repeat) return; if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyX' || e.code === 'Enter') g.pump(); },
      down() { g.pump(); },
      update(dt) {
        fx.upd(dt); hnd = Math.max(0, hnd - dt * 7);
        if (shards) for (const p of shards) { p.vy += 800 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        if (g.result) return;
        el += dt; s = Math.max(.02, s - LEAK * dt);
        if (el >= D0 - .04) {
          if (s >= TG) { g.result = 'win'; sndWin(); fx.text('NICE!', cx, 150, A, 52); fx.pop(cx, cy, 14); }
          else { g.result = 'lose'; sndLose(); fx.text('FLAT...', cx, 150, A, 48); }
        }
      },
      draw(t) {
        flat(); flatShadow(cx, 470, 260);
        const R0 = Rr(s), trem = (!g.result && s > BU - .06) ? (((now * 40) | 0) % 2 ? 4 : -4) : 0;
        if (!shards) {
          const ox = trem;
          for (let dy = -R0; dy < R0; dy += 8) {
            const hw = sn(Math.sqrt(Math.max(0, R0 * R0 - (dy + 4) * (dy + 4)))); if (hw <= 0) continue;
            R(cx - hw + ox, cy + dy, hw * 2, 8, B);
            R(cx + hw - 16 + ox, cy + dy, 16, 8, A);
            if (dy < -R0 * .3 && dy > -R0 * .8) R(cx - hw + 8 + ox, cy + dy, 16, 8, C);
          }
          const ri = sn(R0 * .42);
          for (let dy = -ri; dy < ri; dy += 8) { const hw = sn(Math.sqrt(Math.max(0, ri * ri - (dy + 4) * (dy + 4)))); if (hw > 0) R(cx - hw + ox, cy + dy, hw * 2, 8, D); }
          R(cx - 8, cy + R0, 16, 16, A);
        } else for (const p of shards) R(sn(p.x), sn(p.y), 16, 16, p.c);
        // marked rings: OK (thin dots) and X (heavy blocks)
        for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; R(sn(cx + Math.cos(a) * Rr(TG)) - 2, sn(cy + Math.sin(a) * Rr(TG)) - 2, 4, 4, A); }
        for (let i = 0; i < 24; i += 2) { const a = i / 24 * 6.28; R(sn(cx + Math.cos(a) * Rr(BU)) - 4, sn(cy + Math.sin(a) * Rr(BU)) - 4, 8, 8, A); }
        // pump
        const hy = 446 + hnd * 32;
        R(cx - 32, 556, 64, 8, A); R(cx - 24, 504, 48, 52, B); R(cx - 24, 504, 48, 8, A); R(cx - 16, 520, 8, 24, C);
        R(cx - 4, hy + 8, 8, 504 - hy - 8, A); R(cx - 40, hy, 80, 16, A); R(cx - 32, hy + 2, 64, 4, C);
        // gauge
        const gx = 688, gt = 110, gh = 400;
        R(gx - 8, gt - 8, 48, gh + 16, A); R(gx, gt, 32, gh, D);
        const yb = gt + gh * (1 - BU), yt = gt + gh * (1 - TG);
        for (let y = sn(yb); y < yt; y += 8) R(gx, y, 32, 8, (y / 8 & 1) ? C : B);
        R(gx - 16, sn(yb) - 4, 64, 8, A);
        ctx.fillStyle = A; ctx.fillRect(gx, gt + gh * (1 - Math.min(1, s)), 32, gh * Math.min(1, s));
        ptxt('OK', gx + 16, sn(yt) + 20, 20, A); ptxt('X', gx + 16, sn(yb) - 22, 26, A);
        fx.draw();
      }
    };
    return g;
  }, 'Pump');

  /* ── 2 DIAL: memorise a 3-digit number, then punch it in ── */
  reg('mm_phone', sp => {
    const fx = mkFx(), N = 3, num = [];
    while (num.length < N) { const d = (Math.random() * 10) | 0; if (num.indexOf(d) < 0) num.push(d); }
    const SHOW = 1.4 / Math.sqrt(sp), D0 = 6.5 / Math.sqrt(sp);
    const LAY = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const kx = 220, ky = 236, kw = 112, kh = 68, gap = 12;
    let el = 0, got = [], flash = -1, fT = 0;
    const press = k => {
      if (g.result || el < SHOW) return;
      flash = k; fT = .15;
      if (LAY[k] === String(num[got.length])) {
        got.push(num[got.length]); bp(440 + got.length * 130, .08, .05); fx.pop(kx + (k % 3) * (kw + gap) + kw / 2, ky + ((k / 3) | 0) * (kh + gap) + kh / 2, 6, [A, B]);
        if (got.length === N) { g.result = 'win'; sndWin(); fx.text('CALLING!', 400, 160, A, 40); }
      } else { g.result = 'lose'; sndLose(); shake(7, .25); fx.text('WRONG #', 400, 160, A, 40); }
    };
    const g = {
      cmd: 'DIAL!', hint: 'MEMORISE - THEN CLICK / TYPE THE DIGITS', thint: 'MEMORISE - THEN TAP THE DIGITS', dur: 6.5,
      down(p) {
        for (let k = 0; k < 12; k++) {
          const x = kx + (k % 3) * (kw + gap), y = ky + ((k / 3) | 0) * (kh + gap);
          if (p.x >= x && p.x < x + kw && p.y >= y && p.y < y + kh) { press(k); return; }
        }
      },
      key(e) { const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code); if (m) { const k = LAY.indexOf(m[1]); if (k >= 0) press(k); } },
      update(dt) {
        fx.upd(dt); fT -= dt;
        if (g.result) return;
        const was = el; el += dt;
        if (was < SHOW && el >= SHOW) { bp(880, .08, .05); bp(660, .08, .05, .08); }
        if (el >= D0 - .04) { g.result = 'lose'; sndLose(); fx.text('TOO SLOW', 400, 160, A, 40); }
      },
      draw() {
        flat();
        // handset-style display
        R(200, 96, 400, 100, A); R(208, 104, 384, 84, C);
        const showing = el < SHOW && !g.result, sx = 400 - (N * 3 * 16 + (N - 1) * 24) / 2;
        for (let i = 0; i < N; i++) {
          const x = sx + i * (48 + 24);
          if (showing) pf(num[i], x, 116, 16, A);
          else if (g.result === 'lose' && i === got.length) pf(num[i], x, 116, 16, B);
          else if (i < got.length) pf(num[i], x, 116, 16, A);
          else pf('_', x, 116, 16, B);
        }
        if (showing) { R(208, 104 + 84 - 8, 384 * (1 - el / SHOW), 8, B); }
        // keypad
        for (let k = 0; k < 12; k++) {
          const x = kx + (k % 3) * (kw + gap), y = ky + ((k / 3) | 0) * (kh + gap), on = (k === flash && fT > 0);
          flatShadow(x + kw / 2 + 4, y + kh + 8, kw);
          R(x, y, kw, kh, A); R(x + 8, y + 8, kw - 16, kh - 16, showing ? C : on ? A : D);
          if (!showing) pf(LAY[k], x + kw / 2 - 12, y + kh / 2 - 20, 8, on ? D : A);
          else R(x + kw / 2 - 8, y + kh / 2 - 8, 16, 16, B);
        }
        fx.draw();
      }
    };
    return g;
  }, 'Dial');

  /* ── 3 PUSH: alternate left/right to shove the rival out of the dohyo ── */
  reg('mm_sumo', sp => {
    const fx = mkFx(), D0 = 5 / Math.sqrt(sp), PUSH = .075, GY = 440;
    let pos = 0, el = 0, last = 0, pushT = 0, lt = 0, rt = 0, fly = 0, vx = 0, cd = 0;
    const act = side => {
      if (g.result) return;
      const alt = side !== last; last = side; pos += alt ? PUSH : PUSH * .3; pushT = .12;
      if (side < 0) lt = .12; else rt = .12;
      bp(alt ? 330 + pos * 100 + 120 : 200, .04, .045);
      if (alt && ((++cd) % 3 === 0)) fx.pop(400 + pos * 220, GY - 30, 3, [A, B], 160);
      if (pos >= 1) done('win'); else if (pos <= -1) done('lose');
    };
    function done(r) {
      g.result = r; fly = 1; vx = r === 'win' ? 420 : -420; shake(r === 'win' ? 9 : 7, .3);
      bp(110, .25, .08); if (r === 'win') { sndWin(); fx.text('OUT!', 400, 190, A, 52); } else { sndLose(); fx.text('OOPS!', 400, 190, A, 52); }
    }
    const sumo = (x, y, face, col, push, dead, sx) => {
      const ox = push ? -face * 0 : 0, lean = push ? face * 8 : 0, b = x + lean;
      R(sn(x - 48), y, 96, 8, C);                       // ground shadow
      R(sn(x - 40), y - 24, 24, 24, col); R(sn(x + 16), y - 24, 24, 24, col);          // legs
      R(sn(b - 48), y - 96, 96, 72, col); R(sn(b - 48), y - 52, 96, 16, A); R(sn(b - 8), y - 60, 16, 16, B);   // belly + mawashi
      R(sn(b - 24), y - 136, 48, 40, col); R(sn(b - 8), y - 152, 16, 16, A); R(sn(b - 24), y - 140, 48, 8, A); // head + topknot
      if (dead) { R(sn(b - 16 + face * 8), y - 120, 8, 8, A); R(sn(b + 8 + face * 8), y - 120, 8, 8, A); R(sn(b - 8 + face * 8), y - 104, 16, 8, A); }
      else { R(sn(b - 16 + face * 8), y - 120, 8, 16, A); R(sn(b + 8 + face * 8), y - 120, 8, 16, A); R(sn(b - 8 + face * 8), y - 100, 16, 8, B); }
      R(sn(b + face * 40), y - 88 + (push ? 0 : 8), 24, 16, col);                       // arm
    };
    const g = {
      cmd: 'PUSH!', hint: 'ALTERNATE ← → (OR A / D) TO SHOVE', thint: 'TAP LEFT / RIGHT HALF, ALTERNATING', dur: 5,
      key(e) {
        if (e.repeat) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') act(-1); else if (e.code === 'ArrowRight' || e.code === 'KeyD') act(1);
      },
      down(p) { act(p.x < W / 2 ? -1 : 1); },
      update(dt) {
        fx.upd(dt); pushT -= dt; lt -= dt; rt -= dt;
        if (fly) { fly += dt; return; }
        el += dt;
        pos -= dt * .1 * sp * (.7 + .6 * Math.abs(Math.sin(el * 3)));
        if (pos <= -1) done('lose');
        else if (el >= D0 - .04) { if (pos > 0) done('win'); else done('lose'); }
      },
      draw() {
        flat();
        // dohyo: raised platform, straw-bale ends
        R(120, GY, 560, 16, B); R(120, GY + 16, 560, 72, A); for (let x = 128; x < 680; x += 32) R(x, GY + 24, 16, 16, B);
        R(120, GY - 8, 24, 24, A); R(656, GY - 8, 24, 24, A);
        R(100, GY + 88, 600, 8, C);
        const cxp = 400 + pos * 220; let px = cxp - 52, rx = cxp + 52, py = GY, ry = GY;
        if (fly) {
          const k = Math.min(1.2, fly - 1) * 1.0;
          if (g.result === 'win') { rx += vx * k * .5; ry = GY + Math.min(110, k * k * 260 - k * 40); }
          else { px += vx * k * .5; py = GY + Math.min(110, k * k * 260 - k * 40); }
        }
        sumo(px, py, 1, B, pushT > 0 && !fly, g.result === 'lose', 0);
        sumo(rx, ry, -1, C, !fly || g.result === 'lose', g.result === 'win', 0);
        // arrows
        for (const s of [-1, 1]) {
          const on = (s < 0 ? lt : rt) > 0, nxt = s !== last, x = s < 0 ? 200 : 520;
          R(x, 520, 80, 56, A); R(x + 8, 528, 64, 40, on ? A : nxt ? D : C);
          const ac = on ? D : A;
          for (let i = 0; i < 3; i++) { const h = 8 + 16 * i; R(s < 0 ? x + 12 + i * 8 : x + 60 - i * 8, 548 - h / 2, 8, h, ac); }
          R(s < 0 ? x + 36 : x + 12, 544, 32, 8, ac);
        }
        // edge danger meter
        R(200, 100, 400, 16, A); R(208, 104, 384, 8, D); R(sn(400 + pos * 192) - 8, 96, 16, 24, B);
        R(396, 96, 8, 24, A);
        fx.draw();
      }
    };
    return g;
  }, 'Push');

  /* ── 4 SCRUB: rub the mouse over a grimy plate until every cell is clean ── */
  reg('mm_wash', sp => {
    const fx = mkFx(), cells = [], PX = 400, PY = 310, RAD = 48, RATE = .008, D0 = 5.5 / Math.sqrt(sp);
    for (let j = 0; j < 10; j++) for (let i = 0; i < 12; i++) {
      const x = 208 + i * 32, y = 150 + j * 32, dx = (x + 16 - PX) / 190, dy = (y + 16 - PY) / 150;
      if (dx * dx + dy * dy > 1 || Math.random() < .12) continue;
      const ord = []; for (let k = 0; k < 16; k++) ord.push(k); ord.sort(() => Math.random() - .5);
      cells.push({ x, y, d: (.9 + Math.random() * .25) * (.85 + .15 * sp), ord, done: false });
    }
    let left = cells.length, lx = null, ly = null, el = 0, sq = 0;
    const g = {
      cmd: 'SCRUB!', hint: 'RUB THE MOUSE OVER THE DIRT', thint: 'DRAG YOUR FINGER OVER THE DIRT', dur: 5.5,
      move(p) {
        if (g.result) return;
        if (lx === null) { lx = p.x; ly = p.y; return; }
        const d = Math.min(90, Math.hypot(p.x - lx, p.y - ly)); lx = p.x; ly = p.y;
        if (d < 1) return;
        let hit = false;
        for (const c of cells) {
          if (c.done) continue;
          const dx = c.x + 16 - p.x, dy = c.y + 16 - p.y;
          if (dx * dx + dy * dy < RAD * RAD) {
            hit = true; c.d -= d * RATE;
            if (c.d <= 0) { c.done = true; left--; fx.pop(c.x + 16, c.y + 16, 3, [A, B], 120); bp(700 + Math.random() * 300, .04, .04); }
          }
        }
        sq -= d; if (hit && sq <= 0) { sq = 70; bp(260 + Math.random() * 120, .03, .03); }
        if (left <= 0 && !g.result) { g.result = 'win'; sndWin(); fx.pop(PX, PY, 16, [A, B, C]); fx.text('SPARKLY!', 400, 90, A, 44); }
      },
      down(p) { g.move(p); },
      update(dt) {
        fx.upd(dt); if (g.result) return;
        el += dt; if (el >= D0 - .04) { g.result = 'lose'; sndLose(); shake(6, .2); fx.text('STILL DIRTY', 400, 90, A, 40); }
      },
      draw() {
        flat();
        // plate (pixel ellipse rows), shadow offset
        const ell = (cy, rx, ry, c, ox, oy) => {
          for (let y = -ry; y < ry; y += 8) { const hw = sn(rx * Math.sqrt(Math.max(0, 1 - ((y + 4) / ry) * ((y + 4) / ry)))); if (hw > 0) R(PX - hw + ox, cy + y + oy, hw * 2, 8, c); }
        };
        ell(PY, 208, 168, C, 8, 16); ell(PY, 208, 168, B, 0, 0); ell(PY, 184, 144, C, 0, 0);
        for (const c of cells) {
          if (c.done) continue;
          const n = Math.max(1, Math.ceil(Math.min(1, c.d) * 12)), col = c.d > .6 ? A : B;
          for (let k = 0; k < n; k++) { const o = c.ord[k]; R(c.x + (o % 4) * 8, c.y + ((o / 4) | 0) * 8, 8, 8, col); }
        }
        // shiny rim highlight
        R(PX - 120, 160, 40, 8, D); R(PX - 160, 176, 16, 8, D);
        // sponge
        const mx = sn(lx === null ? mouse.x : lx), my = sn(ly === null ? mouse.y : ly);
        R(mx - 32, my - 16, 64, 40, A); R(mx - 24, my - 8, 48, 24, C); R(mx - 16, my - 8, 8, 8, B); R(mx + 8, my + 0, 8, 8, B); R(mx - 24, my - 8, 48, 8, D);
        // progress pips
        const tot = cells.length || 1, f = 1 - left / tot;
        R(200, 548, 400, 24, A); R(208, 556, 384, 8, C); R(208, 556, Math.round(384 * f), 8, A); R(208, 556, Math.round(384 * f), 8, B);
        fx.draw();
      }
    };
    return g;
  }, 'Scrub');
})();
