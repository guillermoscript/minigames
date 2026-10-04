'use strict';
/* GALAXY BOUNCE: TOUCH SCREEN boss, after WarioWare: Touched!'s "Galaxy Bounce".
   A little Claude-coloured planet falls; draw lines under it so it bounces up, 6 times, until it reaches the moon.
   Pointer: drag to draw a line (a tap makes a short flat one). Keyboard: ←/→ slide the pen along its rail (it does NOT follow the ball), Space drops a flat line there (0.8 s cooldown). */
(() => {
  const mix = (a, b, f) => 'rgb(' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - f) + parseInt(b.substr(i, 2), 16) * f)).join() + ')';
  const CHEERS = ['BOING!', 'WHEE!', 'HIGHER!', 'BOING!', 'ONE MORE!'];

  /* the goal: a big sleepy moon with a ring; wakes up as you get closer */
  function moon(x, y, r, mood, tt) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = INK; ctx.lineWidth = r * .16 + 8; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * .32, -.18, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#FFC93C'; ctx.lineWidth = r * .16; ctx.stroke();
    circ(0, 0, r, '#8f7dff', 6);
    ctx.fillStyle = '#7462e8'; for (const [cx, cy, cr] of [[-.45, -.4, .2], [.5, -.15, .14], [.2, .55, .17], [-.6, .35, .1]]) { ctx.beginPath(); ctx.arc(cx * r, cy * r, cr * r, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(-r * .3, -r * .35, r * .45, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = Math.max(3, r * .07); ctx.lineCap = 'round';
    const e = r * .3, ey = r * .02;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (mood === 'sleep') { ctx.moveTo(s * e - r * .12, ey); ctx.lineTo(s * e + r * .12, ey); ctx.stroke(); }
      else if (mood === 'happy') { ctx.arc(s * e, ey + r * .06, r * .1, Math.PI, 0); ctx.stroke(); }
      else { ctx.arc(s * e, ey, r * .07, 0, 7); ctx.fill(); }
    }
    ctx.beginPath();
    if (mood === 'laugh') { ctx.ellipse(0, r * .38, r * .2, r * .14 + Math.abs(Math.sin(tt * 18)) * r * .05, 0, 0, 7); ctx.fill(); }
    else if (mood === 'happy') { ctx.arc(0, r * .3, r * .2, 0, Math.PI); ctx.fill(); }
    else { ctx.arc(0, r * .3, r * .1, .2, Math.PI - .2); ctx.stroke(); }
    ctx.restore(); ctx.lineCap = 'butt';
    ctx.strokeStyle = INK; ctx.lineWidth = r * .16 + 8; ctx.beginPath(); ctx.ellipse(x, y, r * 1.55, r * .32, -.18, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = '#FFC93C'; ctx.lineWidth = r * .16; ctx.stroke();
    if (mood === 'sleep') { const z = (tt * .8) % 1; ctx.globalAlpha = 1 - z; txt('Z', x + r * .8 + z * 30, y - r * .6 - z * 40, 18 + z * 14, '#fff'); ctx.globalAlpha = 1; }
  }

  BOSSES.galaxy = function (sp, s) {
    const need = 6, R = 29, G = 950, BOOST = 900, MAXL = 220, KBL = 160, k = Math.sqrt(Math.min(sp, 1.3));
    const b = { x: W / 2 + (Math.random() - .5) * 200, y: 230, vx: (Math.random() - .5) * 140, vy: -220, sq: 0, docked: false };
    const lines = [], trail = [], stars = [], clouds = [], city = [];
    for (let i = 0; i < 110; i++) stars.push({ x: Math.random(), y: Math.random() * H, r: 1 + Math.random() * 2.2, tw: Math.random() * 6 });
    for (let i = 0; i < 6; i++) clouds.push({ x: Math.random(), y: 420 - i * 300, w: 70 + Math.random() * 70 });
    for (let x = -700; x < 1500; x += 50 + Math.random() * 40) city.push({ x, w: 46 + Math.random() * 40, h: 30 + Math.random() * 70 });
    let cam = 0, camT = 0, hits = 0, pv = 0, drawing = null, kbMode = false, usedPtr = false, pen = b.x, cool = 0, clock = 0, cheer = 0, lastHit = -9;
    const sy = y => y - cam;                                         // world y -> screen y
    const PENY = 470, penLo = () => -OX + KBL / 2 + 10, penHi = () => W + OX - KBL / 2 - 10;   // the pen rides a fixed rail
    const moonF = () => Math.min(1.15, pv / need + (g.result === 'win' ? Math.min(.15, clock - lastHit) : 0));
    const moonPos = () => {                                          // off to the right while climbing, centre stage on the win
      const f = moonF(), e = Math.min(1, f), w = g.result === 'win' ? Math.min(1, (clock - lastHit) * 1.5) : 0, L = (a, c) => a + (c - a) * w;
      return { x: L(W / 2 + 190 + OX * .5, W / 2), y: L(195 - 95 * e, 185 - 150 * f), r: L(34 + 50 * e, 34 + 96 * f) };
    };

    const add = (ax, ay, bx, by, kb) => {                            // a new trampoline line (world coords)
      if (kb) { for (const l of lines) if (l.kb && !l.die) l.die = clock; }
      else { const own = lines.filter(l => !l.kb && !l.die); if (own.length >= 2) own[0].die = clock; }
      const l = { ax, ay, bx, by, kb, born: clock, die: 0, hx: (ax + bx) / 2 }; lines.push(l);
      sfx.pop(); snd(520, .08, 'triangle', .05, 0, 1040); burst((ax + bx) / 2, sy((ay + by) / 2), '#5CFFE0', 6, 140);
      return l;
    };
    const commit = () => {
      const d = drawing; drawing = null; if (!d) return null;
      let { ax, ay, bx, by } = d;
      if (Math.hypot(bx - ax, by - ay) < 24) { ax = bx - 75; bx += 75; ay = by; }   // a tap: a short flat line
      return add(ax, ay + cam, bx, by + cam, false);
    };
    const kbLine = () => {
      if (g.result) return; kbMode = true;
      if (cool > 0) { sfx.tick(); return; }                           // no mashing: one fresh line per 0.8 s
      cool = .8; add(pen - KBL / 2, PENY + cam, pen + KBL / 2, PENY + cam, true);
    };
    /* does the falling ball touch segment l? bounce it: reflect about the normal, then a strong kick upward */
    const hit = l => {
      if (segD(b.x, b.y, l.ax, l.ay, l.bx, l.by) > R + 6) return false;
      const dx = l.bx - l.ax, dy = l.by - l.ay, L = Math.hypot(dx, dy) || 1; let nx = dy / L, ny = -dx / L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      if ((b.x - l.ax) * nx + (b.y - l.ay) * ny < 0 || b.vx * nx + b.vy * ny >= 0) return false;
      const vn = b.vx * nx + b.vy * ny, rx = b.vx - 2 * vn * nx;
      b.vx = Math.max(-460, Math.min(460, rx * .35 + nx * 620 + (Math.random() < .5 ? -1 : 1) * (90 + Math.random() * 150) * (1 + Math.max(0, hits - 1) * .25))); b.vy = -BOOST * (.85 + .15 * Math.min(1, -ny * 1.2));
      b.sq = 1; hits++; l.die = clock; l.hx = b.x; lastHit = clock; cheer = .5;
      const hx = b.x, hy = sy(b.y + R), tx = Math.max(-OX + 150, Math.min(W + OX - 150, hx));   // tx keeps the text on screen
      sfx.boing(); sfx.blip(hits * 2 + 2); shake(4, .12); ring(hx, hy, '#5CFFE0', 80, .35); burst(hx, hy, '#FFE14D', 12, 260);
      camT = Math.min(camT, cam - 200, b.y - 330);                     // the world scrolls up: we climb
      if (hits >= need) { g.result = 'win'; drawing = null; b.vy = -1100; b.vx = 0; sfx.sparkle(); sfx.whoosh(); confetti(hx, hy, 30); shake(10, .3); floatText('IN ORBIT!', tx, hy - 50, '#FFE14D', 40); }
      else floatText(hits === need - 1 ? 'ALMOST!' : CHEERS[(hits - 1) % CHEERS.length], tx, hy - 40, '#fff', 30);
      return true;
    };

    const g = {
      cmd: 'BOSS!', hint: 'DRAW LINES, BOUNCE TO SPACE!', thint: 'DRAW LINES UNDER THE BALL', dur: 12, boss: true, wide: true,
      key(e) { if (['Space', 'Enter', 'ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(e.code)) kbLine(); else if (/Arrow|KeyA|KeyD/.test(e.code)) kbMode = true; },
      down(p) { if (g.result) return; kbMode = false; usedPtr = true; drawing = { ax: p.x, ay: p.y, bx: p.x, by: p.y }; sfx.click(); },
      move(p) {
        if (!drawing || !pressing || g.result) return;
        const d = drawing, l = Math.hypot(p.x - d.ax, p.y - d.ay);
        if (Math.hypot(p.x - d.bx, p.y - d.by) > 18) snd(300 + Math.min(l, MAXL) * 3, .03, 'triangle', .025);
        d.bx = p.x; d.by = p.y;
        if (l > MAXL) { d.ax = p.x - (p.x - d.ax) / l * MAXL; d.ay = p.y - (p.y - d.ay) / l * MAXL; }   // keep the last 220 px
      },
      up() { if (!g.result) commit(); },
      update(dt) {
        if (g.result) drawing = null;                                     // a half-drawn stroke never outlives the round
        clock += dt; b.sq = Math.max(0, b.sq - dt * 4); cheer = Math.max(0, cheer - dt); cool -= dt;
        pv += (hits - pv) * Math.min(1, 5 * dt); cam += (camT - cam) * Math.min(1, 4 * dt);
        trail.push({ x: b.x, y: b.y }); if (trail.length > 12) trail.shift();
        for (const l of lines) if (l.kb && !l.die) l.ay = l.by = PENY + cam;     // a keyboard line stays on the pen's rail
        for (let i = lines.length - 1; i >= 0; i--) { const l = lines[i]; if ((l.die && clock - l.die > .3) || sy(Math.min(l.ay, l.by)) > H + 40) lines.splice(i, 1); }
        if (g.result === 'win') {                                        // fly up and land on the moon
          const m = moonPos(), tx = W / 2, ty = cam + m.y + m.r + R - 4;
          if (!b.docked) { b.x += (tx - b.x) * Math.min(1, 6 * dt); b.y = Math.max(ty, b.y + b.vy * dt); if (b.y <= ty) { b.docked = true; b.sq = 1; sfx.coin(); ring(tx, sy(ty), '#FFE14D', 160, .5); confetti(tx, sy(ty), 40); } }
          else { b.x = tx; b.y = ty; }
          return;
        }
        if (g.result) { b.vy += G * dt; b.y += b.vy * dt; return; }
        if (keys.ArrowLeft || keys.KeyA) { pen -= 650 * dt; kbMode = true; }
        if (keys.ArrowRight || keys.KeyD) { pen += 650 * dt; kbMode = true; }
        pen = Math.max(penLo(), Math.min(penHi(), pen));
        const N = 4, h = dt * k / N;
        for (let i = 0; i < N && !g.result; i++) {
          b.vy += G * (hits ? 1 : .5) * h; b.x += b.vx * h; b.y += b.vy * h; b.vx *= 1 - .3 * h;
          if (b.x < -OX + R) { b.x = -OX + R; b.vx = Math.abs(b.vx) * .8; sfx.tick(); }
          if (b.x > W + OX - R) { b.x = W + OX - R; b.vx = -Math.abs(b.vx) * .8; sfx.tick(); }
          if (b.vy <= 0) continue;
          for (const l of lines) if (!l.die && hit(l)) break;
          if (drawing && !g.result && b.vy > 0) {                         // the stroke being drawn already counts
            const d = drawing, l = { ax: d.ax, ay: d.ay + cam, bx: d.bx, by: d.by + cam };
            if (Math.hypot(d.bx - d.ax, d.by - d.ay) > 30 && segD(b.x, b.y, l.ax, l.ay, l.bx, l.by) < R + 6) { const c = commit(); if (c) hit(c); }
          }
        }
        if (sy(b.y) < 130) camT = Math.min(camT, b.y - 130);              // never lose the ball off the top
        if (sy(b.y) > H + R + 10) { g.result = 'lose'; drawing = null; sfx.whoosh(false); sfx.buzz(); shake(8, .3); floatText('BYE BYE!', Math.max(-OX + 150, Math.min(W + OX - 150, b.x)), H - 80, '#FF4D4D', 40); }
      },
      draw(t) {
        const f = Math.min(1, pv / need), m = moonPos(), win = g.result === 'win', lose = g.result === 'lose';
        /* sky: dusk at the bottom, deep space as we climb */
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, mix('#1a1048', '#03020c', f)); gr.addColorStop(1, mix('#6b3f8f', '#1a0f45', f));
        ctx.fillStyle = gr; ctx.fillRect(-OX, 0, VW, H);
        for (const st of stars) { const y = ((st.y - cam * .25) % H + H) % H; ctx.globalAlpha = (.35 + .6 * f) * (.6 + .4 * Math.sin(now * 3 + st.tw)); ctx.fillStyle = st.r > 2.6 ? '#FFE14D' : '#fff'; ctx.fillRect(-OX + st.x * VW, y, st.r, st.r); }
        ctx.globalAlpha = .22; ctx.fillStyle = '#e8dcff';
        for (const c of clouds) { const y = c.y - cam * .6, x = -OX + ((c.x * VW + now * 14) % (VW + 300)) - 150; if (y < -60 || y > H + 60) continue; for (const [dx, dy, r] of [[0, 0, .32], [.4, .08, .24], [-.4, .1, .22], [.12, -.14, .24]]) { ctx.beginPath(); ctx.arc(x + dx * c.w, y + dy * c.w, r * c.w, 0, 7); ctx.fill(); } }
        ctx.globalAlpha = 1;
        moon(m.x, m.y, m.r, lose ? 'laugh' : win ? 'happy' : hits >= 3 ? 'awake' : 'sleep', now);
        /* the city we leave behind, with Claude cheering from a rooftop */
        const gy = 600 - cam;
        if (gy < H + 120) {
          for (const c of city) { const top = gy - c.h; box(c.x, top, c.w, c.h + 200, '#241a3d', 3); ctx.fillStyle = '#FFE14D'; for (let wy = top + 10; wy < Math.min(H, gy) - 6; wy += 16) for (let wx = c.x + 8; wx < c.x + c.w - 8; wx += 14) if ((wx * 7 + wy * 3) % 5 < 2) ctx.fillRect(wx, wy, 6, 7); }
          claude(W / 2 - 230, gy - 110 + (cheer > 0 ? -8 : 0), 2.8, { mood: hits > 0 || win ? 'happy' : null });
          ctx.fillStyle = '#241a3d'; ctx.fillRect(W / 2 - 262, gy - 110, 64, 300); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 262, gy - 110, 64, 300);
        }
        /* HUD: a compact title + bounce-stars badge (top-left, fades when the ball passes behind), altitude meter on the right */
        const hx0 = -OX + 16, near = b.x < hx0 + 250 && sy(b.y) < 175;
        ctx.globalAlpha = near ? .35 : 1; ctx.fillStyle = 'rgba(10,6,30,.6)'; ctx.beginPath(); ctx.roundRect(hx0, 88, 226, 62, 14); ctx.fill();
        txt('GALAXY BOUNCE', hx0 + 113, 104, 16, '#5CFFE0');
        for (let i = 0; i < need; i++) star(hx0 + 26 + i * 35, 131, 12, 5.5, 5, -Math.PI / 2, i < hits ? '#FFE14D' : '#3a2f5c', 3);
        ctx.globalAlpha = 1;
        const mx = W + OX - 44, m0 = 510, m1 = 190;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(mx - 9, m1 - 4, 18, m0 - m1 + 8, 9); ctx.fill();
        ctx.fillStyle = '#5CFFE0'; ctx.beginPath(); ctx.roundRect(mx - 5, m0 - (m0 - m1) * f, 10, (m0 - m1) * f, 5); ctx.fill();
        circ(mx, m1 - 16, 12, '#8f7dff', 3); circ(mx, m0 + 14, 10, '#4DB8FF', 3);
        circ(mx, m0 - (m0 - m1) * f, 8, OR, 3);
        txt(String(Math.round(f * 384400)), mx - 18, m0 - (m0 - m1) * f - 7, 18, '#fff', 'right'); txt('KM', mx - 18, m0 - (m0 - m1) * f + 11, 13, '#5CFFE0', 'right');
        /* trampolines */
        ctx.lineCap = 'round';
        for (const l of lines) {
          const ax = l.ax, ay = sy(l.ay), bx = l.bx, by = sy(l.by), pop = Math.min(1, (clock - l.born) / .15), u = l.die ? (clock - l.die) / .3 : 0;
          const cx = (ax + bx) / 2, cy = (ay + by) / 2, sc = .4 + .6 * easeBack(pop), bow = l.die ? Math.sin(u * Math.PI) * 34 * (1 - u) : 0;
          const p0x = cx + (ax - cx) * sc, p0y = cy + (ay - cy) * sc, p1x = cx + (bx - cx) * sc, p1y = cy + (by - cy) * sc;
          ctx.globalAlpha = 1 - u * u;
          for (const [w, c] of [[17, INK], [10, l.kb ? '#FFE14D' : '#5CFFE0'], [3, '#fff']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.quadraticCurveTo(l.hx, cy + bow * 2, p1x, p1y); ctx.stroke(); }
          star(p0x, p0y, 10, 5, 5, now * 3, '#FFE14D', 2); star(p1x, p1y, 10, 5, 5, -now * 3, '#FFE14D', 2);
          ctx.globalAlpha = 1;
        }
        if (drawing && !g.result) {
          const d = drawing; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -now * 60;
          ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(d.ax, d.ay); ctx.lineTo(d.bx, d.by); ctx.stroke();
          ctx.strokeStyle = '#5CFFE0'; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]);
          circ(d.bx, d.by, 8, '#fff', 3);
        }
        /* first fall: a ghost line shows where to draw */
        if (!g.result && !kbMode && hits === 0 && !lines.some(l => !l.kb) && !drawing) {
          const y = Math.max(sy(b.y) + 110, 430); ctx.globalAlpha = .35 + .25 * Math.sin(now * 10); ctx.setLineDash([12, 12]);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(b.x - 90, y); ctx.lineTo(b.x + 90, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
        /* keyboard pen on its rail: shown once a key is used, or faintly on desktop until the mouse is used */
        if (!g.result && (kbMode || (!TOUCH && !usedPtr))) {
          const x = pen, y = PENY, on = cool <= 0, a = kbMode ? 1 : .45;
          ctx.globalAlpha = .12 * a; ctx.fillStyle = '#FFE14D'; ctx.fillRect(penLo() - KBL / 2, y - 2, penHi() - penLo() + KBL, 4);
          ctx.globalAlpha = (on ? .55 : .25) * a; ctx.setLineDash([10, 8]); ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x - KBL / 2, y); ctx.lineTo(x + KBL / 2, y); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalAlpha = (.3 + .15 * Math.sin(now * 12)) * a; circ(x, y, 18, '#FFE14D', 0); ctx.globalAlpha = a; circ(x, y, 7, on ? '#fff' : '#999', 3);
          if (clock < 4) { ctx.globalAlpha = Math.min(1, 4 - clock) * a; txt('←/→ MOVE · SPACE = LINE', W / 2, 525, 18, '#fff'); ctx.globalAlpha = 1; }
        }
        /* the ball: comet trail, then a tiny Claude planet with a face */
        const bx = b.x, by = sy(b.y), rising = b.vy < -200 && !lose;
        if (rising || win) for (let i = 0; i < trail.length; i++) { ctx.globalAlpha = i / trail.length * .5; ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.arc(trail[i].x, sy(trail[i].y), R * (.3 + .6 * i / trail.length), 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        const scared = !g.result && b.vy > 250 && by > 330 && !lines.some(l => !l.die && Math.min(l.ay, l.by) > b.y && b.x > Math.min(l.ax, l.bx) - 40 && b.x < Math.max(l.ax, l.bx) + 40);
        const st = Math.min(.22, Math.abs(b.vy) / 4000), sx = 1 + b.sq * .35 - st * .6, syy = 1 - b.sq * .3 + st;
        ctx.save(); ctx.translate(bx, by + b.sq * 8); ctx.scale(sx, syy);
        ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.ellipse(0, R * .45, R * 1.55, R * .4, -.12, Math.PI, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#5CFFE0'; ctx.lineWidth = 5; ctx.stroke();
        circ(0, 0, R, OR, 5); ctx.fillStyle = '#b85c3e'; ctx.beginPath(); ctx.arc(-R * .55, -R * .45, 5, 0, 7); ctx.arc(R * .6, R * .5, 4, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-R * .35, -R * .4, R * .3, 0, 7); ctx.fill();
        const lx = Math.max(-3, Math.min(3, b.vx / 80)), ly = Math.max(-3, Math.min(3, b.vy / 200));
        ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        for (const e of [-9, 9]) {
          ctx.beginPath();
          if (win || (rising && !scared)) { ctx.arc(e, -5, 5.5, Math.PI, 0); ctx.stroke(); }
          else if (scared || lose) { circ(e + lx, -7 + ly, 6, '#fff', 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(e + lx * 1.5, -7 + ly * 1.5, 2.5, 0, 7); ctx.fill(); }
          else { ctx.ellipse(e + lx, -7 + ly, 3.5, 5.5, 0, 0, 7); ctx.fill(); }
        }
        ctx.fillStyle = INK; ctx.beginPath();
        if (scared || lose) ctx.ellipse(0, 7, 5, 6 + Math.sin(now * 30), 0, 0, 7); else if (rising || win) ctx.arc(0, 3, 9, 0, Math.PI); else ctx.arc(0, 3, 6, .3, Math.PI - .3);
        if (scared || lose || rising || win) ctx.fill(); else ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.ellipse(0, R * .45, R * 1.55, R * .4, -.12, 0, Math.PI); ctx.stroke(); ctx.strokeStyle = '#5CFFE0'; ctx.lineWidth = 5; ctx.stroke();
        if (scared) { ctx.fillStyle = '#9fe0ff'; ctx.beginPath(); ctx.moveTo(R + 2, -R * .6); ctx.quadraticCurveTo(R + 10, -R * .1, R + 2, -R * .05); ctx.quadraticCurveTo(R - 6, -R * .1, R + 2, -R * .6); ctx.fill(); }
        ctx.restore(); ctx.lineCap = 'butt';
        vignette(.3);
      },
      probe() {
        const by = sy(b.y), py = PENY, fall = b.vy > 0;
        /* rough landing estimate at the pen's height, for bots (ignores walls and camera drift): time to fall from by to py */
        const gg = G * (hits ? 1 : .5) * k * k, vy = b.vy * k, tAt = y => y > by ? (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * gg * (y - by)))) / gg : 0, tt = tAt(py);
        return { phase: g.result || 'play', ball: { x: +b.x.toFixed(1), y: +by.toFixed(1), vx: +b.vx.toFixed(1), vy: +b.vy.toFixed(1) }, falling: fall, hits, need,
          pen: { x: +pen.toFixed(1), y: py, lo: +penLo().toFixed(1), hi: +penHi().toFixed(1) }, landPen: +(b.x + b.vx * k * tt).toFixed(1), land480: +(b.x + b.vx * k * tAt(480 - R)).toFixed(1), lines: lines.filter(l => !l.die).length, cool: +Math.max(0, cool).toFixed(2), cam: +cam.toFixed(1), drawing: !!drawing, clock: +clock.toFixed(3), lastHit: +lastHit.toFixed(3) };
      }
    };
    return g;
  };
})();
