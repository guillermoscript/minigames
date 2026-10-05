'use strict';
/* GALAXY BOUNCE: TOUCH SCREEN boss, after WarioWare: Touched!'s "Galaxy Bounce".
   A little Claude-coloured planet falls; draw lines under it so it bounces up, 6 times, until it reaches the moon.
   Pointer: drag to draw a line (a tap makes a short flat one). Keyboard: ←/→ slide the pen along its rail (it does NOT follow the ball), Space drops a flat line there (0.8 s cooldown).
   Art: the DUO look. A rooftop city at dusk, a night sky with inked planets, a UFO cow-napper, a sleepy moon in a nightcap. */
(() => {
  const mix = (a, b, f) => 'rgb(' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - f) + parseInt(b.substr(i, 2), 16) * f)).join() + ')';
  const CHEERS = ['BOING!', 'WHEE!', 'HIGHER!', 'BOING!', 'ONE MORE!'];

  /* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
  const TAU = Math.PI * 2;
  let X = ctx;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor randomness: never the game RNG
  const outBack = k => { k = Math.max(0, Math.min(1, k)); return 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2); };
  const rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); };
  const ink = (fill, o = 4, col = INK) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const cc = (x, y, r) => { X.beginPath(); X.arc(x, y, r, 0, TAU); };
  /* flat shade + base copy shifted (-sx,-sy) clipped to the same silhouette: a crescent of shade stays on the far side */
  const celC = (x, y, r, base, shade, o, sx, sy, col) => { cc(x, y, r); ink(shade, o, col); X.save(); X.clip(); cc(x - sx, y - sy, r); X.fillStyle = base; X.fill(); X.restore(); };
  const celR = (x, y, w, h, r, base, shade, o, sx, col) => { rr(x, y, w, h, r); ink(shade, o, col); X.save(); X.clip(); rr(x - sx, y, w, h, r); X.fillStyle = base; X.fill(); X.restore(); };
  const sparkle = (x, y, r, col, rot = 0) => { X.save(); X.translate(x, y); X.rotate(rot); X.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? r * .28 : r; X.lineTo(Math.cos(a) * d, Math.sin(a) * d); } X.closePath(); X.fillStyle = col; X.fill(); X.restore(); };
  const heart = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath(); ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore(); };
  /* an eye: white sclera, pupil that looks around, a highlight dot; lid blinks now and then */
  const eye = (x, y, r, look, lx, ly, k, big) => {
    const bl = Math.sin(now * 1.9 + k) > .985;
    if (bl) { X.strokeStyle = INK; X.lineWidth = r * .5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const sr = r * (big ? 1.3 : 1); el(x, y, sr, sr * 1.08); ink('#fff', Math.max(1.6, r * .28));
    const pr = r * (big ? .38 : .52); cc(x + lx * r * .38, y + ly * r * .38, pr); X.fillStyle = INK; X.fill();
    cc(x + lx * r * .38 - pr * .35, y + ly * r * .38 - pr * .4, pr * .35); X.fillStyle = '#fff'; X.fill();
  };
  const blush = (x, y, rx, a) => { X.fillStyle = 'rgba(255,110,165,' + a + ')'; el(x, y, rx, rx * .6); X.fill(); };
  const drop = (x, y, s) => { X.fillStyle = '#9fe3ff'; X.beginPath(); X.moveTo(x, y - 6 * s); X.quadraticCurveTo(x + 5 * s, y, x, y + 3 * s); X.quadraticCurveTo(x - 5 * s, y, x, y - 6 * s); X.fill(); };

  /* ───────────── the goal: a big sleepy moon with a ring, in a nightcap; wakes up as you get closer ───────────── */
  function moon(x, y, r, mood, tt, lk) {
    X.save(); X.translate(x, y);
    const ringP = (a0, a1) => { X.beginPath(); X.ellipse(0, 0, r * 1.55, r * .32, -.18, a0, a1); };
    ringP(Math.PI, TAU); X.strokeStyle = INK; X.lineWidth = r * .16 + 8; X.lineCap = 'round'; X.stroke(); X.strokeStyle = '#FFC93C'; X.lineWidth = r * .16; X.stroke();
    celC(0, 0, r, '#9a88ff', '#6a58df', Math.max(4, r * .075), r * .16, r * .16);
    X.save(); cc(0, 0, r); X.clip();
    for (const [cx, cy, cr] of [[-.45, -.4, .2], [.5, -.15, .14], [.2, .62, .17], [-.62, .35, .1]]) { cc(cx * r, cy * r, cr * r); X.fillStyle = '#7e6cf0'; X.fill(); cc(cx * r - cr * r * .12, cy * r - cr * r * .12, cr * r * .78); X.fillStyle = '#6a58df'; X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.34)'; el(-r * .36, -r * .42, r * .3, r * .17, -.6); X.fill(); X.restore();
    const e = r * .3, ey = r * .02, er = r * .15, lx = lk ? lk[0] : 0, ly = lk ? lk[1] : 0;
    X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = Math.max(3, r * .07); X.lineCap = 'round'; X.lineJoin = 'round';
    for (const s of [-1, 1]) {
      if (mood === 'sleep') { X.beginPath(); X.arc(s * e, ey - r * .02, r * .11, .15, Math.PI - .15); X.stroke(); }
      else if (mood === 'happy') { X.beginPath(); X.arc(s * e, ey + r * .06, r * .1, Math.PI, 0); X.stroke(); }
      else if (mood === 'laugh') { X.beginPath(); X.moveTo(s * e - s * r * .1, ey - r * .09); X.lineTo(s * e + s * r * .1, ey); X.lineTo(s * e - s * r * .1, ey + r * .09); X.stroke(); }
      else { eye(s * e, ey, er, 0, lx, ly, s * 2, false); X.beginPath(); X.moveTo(s * e - er, ey - er * 1.5); X.lineTo(s * e + er, ey - er * 1.7 + s * er * .2); X.lineWidth = Math.max(3, r * .06); X.stroke(); }
    }
    if (mood !== 'sleep') { blush(-r * .6, r * .2, r * .13, .55); blush(r * .6, r * .2, r * .13, .55); }
    X.lineWidth = Math.max(3, r * .07);
    if (mood === 'laugh') { el(0, r * .4, r * .22, r * .14 + Math.abs(Math.sin(tt * 18)) * r * .06); ink('#6e1838', Math.max(3, r * .05)); el(0, r * .5, r * .12, r * .06); X.fillStyle = '#ff92ad'; X.fill();
      for (const s of [-1, 1]) { const q = (tt * 1.3 + (s > 0 ? .5 : 0)) % 1; drop(s * e * 1.25, ey + r * .12 + q * r * .5, r * .05); } }
    else if (mood === 'happy') { X.beginPath(); X.arc(0, r * .27, r * .2, 0, Math.PI); ink('#6e1838', Math.max(3, r * .05)); }
    else if (mood === 'awake') { X.beginPath(); X.ellipse(0, r * .42, r * .08, r * .1, 0, 0, TAU); ink('#6e1838', Math.max(2.5, r * .04)); }
    else { X.beginPath(); X.arc(0, r * .3, r * .1, .2, Math.PI - .2); X.stroke(); }
    if (mood === 'sleep' || mood === 'awake') {          /* nightcap: droops while asleep, flips up when it wakes */
      X.save(); X.rotate(mood === 'sleep' ? -.5 : -.2); X.translate(-r * .1, -r * .86);
      X.beginPath(); X.moveTo(-r * .45, r * .08); X.quadraticCurveTo(-r * .3, -r * .55, r * .3 + (mood === 'sleep' ? r * .5 : 0), mood === 'sleep' ? -r * .05 : -r * .6); X.quadraticCurveTo(r * .4, -r * .1, r * .45, r * .1); X.closePath();
      ink('#ff5c8a', Math.max(3, r * .06)); X.save(); X.clip(); X.fillStyle = '#ff8fae'; X.fillRect(-r, -r, r * 2, r * .08); X.fillStyle = 'rgba(0,0,0,.13)'; X.fillRect(r * .15, -r, r, r * 2); X.restore();
      cc(r * .3 + (mood === 'sleep' ? r * .5 : 0), mood === 'sleep' ? -r * .05 : -r * .6, r * .09); ink('#fff', Math.max(3, r * .05)); X.restore();
    }
    X.restore(); X.lineCap = 'butt';
    X.save(); X.translate(x, y); ringP(0, Math.PI); X.strokeStyle = INK; X.lineWidth = r * .16 + 8; X.lineCap = 'round'; X.stroke(); X.strokeStyle = '#FFC93C'; X.lineWidth = r * .16; X.stroke();
    X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = r * .03; ringP(.6, 1.4); X.stroke(); X.restore(); X.lineCap = 'butt';
    if (mood === 'sleep') { for (let i = 0; i < 2; i++) { const z = (tt * .8 + i * .5) % 1; ctx.globalAlpha = 1 - z; txt('Z', x + r * .8 + z * 30 + i * 12, y - r * .6 - z * 40, 18 + z * 14, '#fff'); ctx.globalAlpha = 1; } }
  }
  /* the ball: a cel-shaded Claude planet with a ring and a face that reacts */
  function planet(bx, by, b, scared, rising, win, dizzy) {
    const R = 29, st = Math.min(.22, Math.abs(b.vy) / 4000), sx = 1 + b.sq * .35 - st * .6, syy = 1 - b.sq * .3 + st;
    X.save(); X.translate(bx, by + b.sq * 8); X.scale(sx, syy);
    const ringP = (a0, a1) => { X.beginPath(); X.ellipse(0, R * .45, R * 1.55, R * .4, -.12, a0, a1); };
    const ringS = () => { X.strokeStyle = INK; X.lineWidth = 12; X.lineCap = 'round'; X.stroke(); X.strokeStyle = '#23a09a'; X.lineWidth = 6; X.stroke(); X.strokeStyle = '#5CFFE0'; X.lineWidth = 3.5; X.translate(0, -1); X.stroke(); X.translate(0, 1); };
    ringP(Math.PI, TAU); ringS();
    celC(0, 0, R, OR, '#b4553a', 5, 6, 6);
    X.save(); cc(0, 0, R); X.clip(); X.fillStyle = '#b4553a'; for (const [cx, cy, cr] of [[-.55, -.45, 5], [.6, .5, 4]]) { cc(cx * R, cy * R, cr); X.fill(); } X.fillStyle = 'rgba(255,255,255,.4)'; el(-R * .36, -R * .42, R * .3, R * .17, -.6); X.fill(); X.restore();
    const lx = Math.max(-1, Math.min(1, b.vx / 200)), ly = Math.max(-1, Math.min(1, b.vy / 400));
    X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.lineJoin = 'round';
    for (const e of [-9, 9]) {
      if (dizzy) { X.beginPath(); for (let i = 0; i < 20; i++) { const a = i * .6 + now * 8, r = i * .38; X.lineTo(e + Math.cos(a) * r * .8, -6 + Math.sin(a) * r * .8); } X.lineWidth = 2.2; X.stroke(); X.lineWidth = 3.5; }
      else if (win || (rising && !scared)) { X.beginPath(); X.arc(e, -4, 5.5, Math.PI, 0); X.stroke(); }
      else eye(e, -7, 5.6, 0, lx, ly, e, scared);
    }
    if (!dizzy) { blush(-17, 3, 6, win || rising ? .8 : .5); blush(17, 3, 6, win || rising ? .8 : .5); }
    X.beginPath();
    if (dizzy) { X.moveTo(-6, 9); X.quadraticCurveTo(0, 3, 6, 9); X.stroke(); }
    else if (scared) { X.ellipse(0, 8, 5, 6 + Math.sin(now * 30), 0, 0, TAU); ink('#6e1838', 2.5); }
    else if (rising || win) { X.arc(0, 3, 9, 0, Math.PI); ink('#6e1838', 2.5); X.fillStyle = '#ff92ad'; X.beginPath(); X.ellipse(0, 9, 4.5, 2.4, 0, 0, Math.PI); X.fill(); }
    else { X.arc(0, 3, 6, .3, Math.PI - .3); X.stroke(); }
    ringP(0, Math.PI); ringS();
    if (scared) drop(R + 2 + Math.sin(now * 8) * 2, -R * .35, 1.3);
    X.restore(); X.lineCap = 'butt';
  }
  /* the city, baked once: inked rooftops with lit windows, water tanks and antennas (world x -750..1550, ground at y 150) */
  function bakeCity(city) {
    const c = document.createElement('canvas'); c.width = 2300; c.height = 360; const o = c.getContext('2d'), keep = X; X = o;
    o.translate(750, 0);
    city.forEach((b, i) => {
      const top = 150 - b.h, k = hash(i);
      if (k > .78) { rr(b.x + b.w * .3, top - 22, b.w * .4, 22, 4); ink('#7a5a3a', 3); }                  // a water tank
      if (k < .3) { o.strokeStyle = INK; o.lineWidth = 5; o.beginPath(); o.moveTo(b.x + b.w * .7, top); o.lineTo(b.x + b.w * .7, top - 24); o.stroke(); cc(b.x + b.w * .7, top - 26, 4); ink('#ff4d5e', 2); }
      celR(b.x, top, b.w, b.h + 210, 5, i % 2 ? '#35295f' : '#2b2150', i % 2 ? '#241a45' : '#1c1536', 3, 7);
      rr(b.x - 3, top - 5, b.w + 6, 9, 4); ink(i % 2 ? '#4a3b80' : '#3b2f6a', 3);
      for (let wy = top + 14; wy < 150 - 6; wy += 16) for (let wx = b.x + 8; wx < b.x + b.w - 14; wx += 14) if ((wx * 7 + wy * 3) % 5 < 2) { rr(wx, wy, 7, 8, 2); ink((wx + wy) % 3 ? '#ffd96a' : '#ff9f5a', 1.4); }
    });
    X = keep; return c;
  }

  BOSSES.galaxy = function (sp, s) {
    const need = 6, R = 29, G = 950, BOOST = 900, MAXL = 220, KBL = 160, k = Math.sqrt(Math.min(sp, 1.3));
    const b = { x: W / 2 + (Math.random() - .5) * 200, y: 230, vx: (Math.random() - .5) * 140, vy: -220, sq: 0, docked: false };
    const lines = [], trail = [], stars = [], clouds = [], city = [];
    for (let i = 0; i < 110; i++) stars.push({ x: Math.random(), y: Math.random() * H, r: 1 + Math.random() * 2.2, tw: Math.random() * 6 });
    for (let i = 0; i < 6; i++) clouds.push({ x: Math.random(), y: 420 - i * 300, w: 70 + Math.random() * 70 });
    for (let x = -700; x < 1500; x += 50 + Math.random() * 40) city.push({ x, w: 46 + Math.random() * 40, h: 30 + Math.random() * 70 });
    let CITY = null, endNow = -1, cam = 0, camT = 0, hits = 0, pv = 0, drawing = null, kbMode = false, usedPtr = false, pen = b.x, cool = 0, clock = 0, cheer = 0, lastHit = -9;
    const sy = y => y - cam;                                         // world y -> screen y
    const PENY = 470, penLo = () => -OX + KBL / 2 + 10, penHi = () => W + OX - KBL / 2 - 10;   // the pen rides a fixed rail
    const moonF = () => Math.min(1.15, pv / need + (g.result === 'win' ? Math.min(.15, clock - lastHit) : 0));
    const moonPos = () => {                                          // off to the right while climbing, centre stage on the win
      const f = moonF(), e = Math.min(1, f), w = g.result === 'win' ? Math.min(1, (clock - lastHit) * 1.5) : 0, L = (a, c) => a + (c - a) * w;
      return { x: L(W / 2 + 190 + OX * .5, W / 2), y: L(195 - 95 * e, 185 - 40 * f), r: L(34 + 50 * e, 34 + 80 * f) };
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
        X = ctx;
        const f = Math.min(1, pv / need), m = moonPos(), win = g.result === 'win', lose = g.result === 'lose';
        if (g.result && endNow < 0) endNow = now;
        const oT = endNow >= 0 ? now - endNow : 0;
        /* sky: dusk at the bottom, deep space as we climb */
        const gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, mix('#1a1048', '#03020c', f)); gr.addColorStop(1, mix('#6b3f8f', '#1a0f45', f));
        ctx.fillStyle = gr; ctx.fillRect(-OX, 0, VW, H);
        for (const st of stars) {
          const y = ((st.y - cam * .25) % H + H) % H, x = -OX + st.x * VW; ctx.globalAlpha = (.35 + .6 * f) * (.6 + .4 * Math.sin(now * 3 + st.tw));
          if (st.r > 2.6) sparkle(x, y, st.r * 2.6, '#FFE14D', st.tw); else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, st.r * .7, 0, TAU); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
        /* far planets: coloured outlines, no ink (they are far away) */
        const far = (base, rep, fn) => { const y = (((base - cam * .3) % rep) + rep) % rep - 260; if (y > -120 && y < H + 120) fn(y); };
        far(520, 1500, y => {                                     // a striped gas giant with a ring
          const x = -OX + VW * .12, r = 44; X.save(); X.translate(x, y); X.globalAlpha = .9;
          const rg = () => { X.strokeStyle = '#8a5fb8'; X.lineWidth = 11; X.stroke(); X.strokeStyle = '#ffd9a0'; X.lineWidth = 6; X.stroke(); };
          X.beginPath(); X.ellipse(0, 0, r * 1.7, r * .36, -.35, Math.PI, TAU); rg();
          celC(0, 0, r, '#ffb36b', '#e0894a', 3, 8, 8, '#8a5fb8'); X.save(); cc(0, 0, r); X.clip(); X.fillStyle = '#ff9a6b'; for (const by of [-.35, .05, .45]) X.fillRect(-r, by * r, r * 2, r * .2); X.fillStyle = 'rgba(255,255,255,.3)'; el(-r * .35, -r * .4, r * .3, r * .15, -.5); X.fill(); X.restore();
          X.beginPath(); X.ellipse(0, 0, r * 1.7, r * .36, -.35, 0, Math.PI); rg(); X.restore();
        });
        far(900, 1500, y => {                                     // a tiny cratered planet
          const x = -OX + VW * .86, r = 26; X.save(); X.translate(x, y); celC(0, 0, r, '#7fe0d0', '#4fb8b0', 3, 5, 5, '#2f8f95');
          X.save(); cc(0, 0, r); X.clip(); for (const [a, b2, c] of [[-.4, -.2, .22], [.3, .35, .18], [.4, -.4, .12]]) { cc(a * r, b2 * r, c * r); X.fillStyle = '#4fb8b0'; X.fill(); } X.fillStyle = 'rgba(255,255,255,.35)'; el(-r * .3, -r * .4, r * .3, r * .15, -.5); X.fill(); X.restore(); X.restore();
        });
        ctx.globalAlpha = .5;
        for (const c of clouds) { const y = c.y - cam * .6, x = -OX + ((c.x * VW + now * 14) % (VW + 300)) - 150; if (y < -60 || y > H + 60) continue; X.fillStyle = '#d8ceff'; for (const [dx, dy, r] of [[0, 0, .32], [.4, .08, .24], [-.4, .1, .22], [.12, -.14, .24]]) { cc(x + dx * c.w, y + dy * c.w, r * c.w); X.fill(); } }
        ctx.globalAlpha = 1;
        /* background gag: a UFO cow-napper cruises by and watches the ball */
        { const uy = ((((450 - cam * .35) % 1100) + 1100) % 1100) - 250, ux = -OX - 90 + ((now * 34 + 420) % (VW + 220));
          if (uy > -80 && uy < H + 60) {
            const bob = Math.sin(now * 2.2) * 4, yy = uy + bob, lookx = Math.max(-1, Math.min(1, (b.x - ux) / 220)), looky = Math.max(-1, Math.min(1, (sy(b.y) - yy) / 220));
            X.save(); X.translate(ux, yy);
            X.beginPath(); X.moveTo(-14, 12); X.lineTo(14, 12); X.lineTo(34, 78); X.lineTo(-34, 78); X.closePath(); X.fillStyle = 'rgba(190,255,200,.2)'; X.fill();
            X.save(); X.translate(Math.sin(now * 1.4) * 5, 52 + Math.sin(now * 3) * 4); X.rotate(Math.sin(now * 1.4) * .15);   // the abducted cow
            rr(-11, -6, 22, 12, 5); ink('#fff', 2.2); X.fillStyle = '#2b2150'; cc(-3, -1, 3); X.fill(); cc(5, 2, 2.5); X.fill(); cc(11, -9, 5); ink('#fff', 2.2); X.fillStyle = INK; cc(12, -10, 1.2); X.fill(); X.restore();
            X.beginPath(); X.ellipse(0, 0, 34, 10, 0, 0, TAU); X.fillStyle = '#8f9cb3'; X.fill(); cc(0, -8, 14); ink('#bff6ff', 3); X.save(); cc(0, -8, 14); X.clip(); X.fillStyle = 'rgba(255,255,255,.4)'; el(-5, -14, 5, 3, -.5); X.fill(); X.restore();
            cc(lookx * 2, -7 + looky * 2, 7); ink('#7fd34a', 2.5); eye(-2.5 + lookx * 2, -8 + looky * 2, 2.6, 0, lookx, looky, 5); eye(3 + lookx * 2, -8 + looky * 2, 2.6, 0, lookx, looky, 7);
            X.beginPath(); X.ellipse(0, 0, 34, 10, 0, 0, TAU); ink('#cfd8e6', 3.5); X.save(); X.clip(); X.fillStyle = '#8f9cb3'; el(8, 6, 40, 8); X.fill(); X.restore();
            for (let i = -2; i <= 2; i++) { cc(i * 11, 2, 2.6); X.fillStyle = (Math.floor(now * 4) + i) % 2 ? '#FFE14D' : '#ff4d5e'; X.fill(); }
            X.restore();
          } }
        moon(m.x, m.y, m.r, lose ? 'laugh' : win ? 'happy' : hits >= 3 ? 'awake' : 'sleep', now, [Math.max(-1, Math.min(1, (b.x - m.x) / 300)), Math.max(-1, Math.min(1, (sy(b.y) - m.y) / 300))]);
        /* the city we leave behind, with Claude cheering from a rooftop */
        const gy = 600 - cam;
        if (gy < H + 150) {
          if (!CITY) CITY = bakeCity(city);
          ctx.drawImage(CITY, -750, gy - 150);
          const tx0 = W / 2 - 262, ty0 = gy - 110, cmood = lose ? 'sad' : (hits > 0 || win) ? 'happy' : null, cy0 = ty0 + (cheer > 0 ? -8 : 0);
          celR(tx0, ty0, 64, 300, 6, '#3a2d66', '#241a45', 4, 8);
          for (let wy = ty0 + 28; wy < Math.min(H, gy) - 6; wy += 22) { rr(tx0 + 12, wy, 12, 10, 3); ink('#ffd96a', 1.5); rr(tx0 + 38, wy, 12, 10, 3); ink(hash(wy) < .5 ? '#ffd96a' : '#ff9f5a', 1.5); }
          rr(tx0 - 5, ty0 - 8, 74, 12, 5); ink('#4a3b80', 3);
          X.fillStyle = 'rgba(20,16,28,.3)'; el(W / 2 - 230, ty0 - 2, 22, 5); X.fill();
          claude(W / 2 - 230, cy0, 2.8, { mood: cmood });
          X.save(); X.translate(W / 2 - 192, cy0 - 20); X.rotate(-.5 + (cheer > 0 ? -.3 : 0)); rr(-3, -34, 6, 30, 3); ink('#FFE14D', 2.5); X.beginPath(); X.moveTo(-3, -4); X.lineTo(3, -4); X.lineTo(0, 4); X.closePath(); ink('#5CFFE0', 2); X.restore();
          if (lose) sparkle(W / 2 - 216, cy0 - 36, 6, '#9fe3ff', 0);
          else if (!hits && !win) drop(W / 2 - 207, cy0 - 20 + (now * 14 % 12), 1);
        }
        /* HUD: a compact title + bounce-stars sign (top-left, fades when the ball passes behind), altitude tube on the right */
        const hx0 = -OX + 16, near = b.x < hx0 + 250 && sy(b.y) < 175;
        ctx.globalAlpha = near ? .35 : 1;
        rr(hx0, 94, 226, 62, 14); ink('#14103a', 4); rr(hx0, 88, 226, 62, 14); ink('#3b2f7a', 4);
        X.fillStyle = 'rgba(255,255,255,.14)'; rr(hx0 + 8, 92, 210, 8, 4); X.fill();
        for (const [rx, ry] of [[12, 12], [214, 12], [12, 56], [214, 56]]) { cc(hx0 + rx, 88 + ry, 3.2); ink('#c9ced6', 1.5); }
        txt('GALAXY BOUNCE', hx0 + 113, 106, 16, '#5CFFE0');
        for (let i = 0; i < need; i++) {
          const on = i < hits, pop = on && i === hits - 1 ? Math.min(1, (clock - lastHit) / .25) : 1, sc = pop < 1 ? 1 + .6 * (1 - outBack(pop)) : 1;
          star(hx0 + 26 + i * 35, 131, 12 * sc, 5.5 * sc, 5, -Math.PI / 2, on ? '#FFE14D' : '#2a2150', 3);
        }
        ctx.globalAlpha = 1;
        const mx = W + OX - 44, m0 = 510, m1 = 190, my = m0 - (m0 - m1) * f;
        rr(mx - 12, m1 - 6, 24, m0 - m1 + 12, 12); ink('#241a45', 4); rr(mx - 6, m1 - 1, 12, m0 - m1 + 2, 6); ink('#0d0922', 0);
        if (f > .01) { rr(mx - 6, my, 12, m0 - my, 6); ink('#5CFFE0', 0); X.fillStyle = 'rgba(255,255,255,.5)'; rr(mx - 3, my + 2, 3, Math.max(0, m0 - my - 4), 1.5); X.fill(); }
        for (let i = 1; i < need; i++) { X.fillStyle = '#c9ced6'; X.fillRect(mx + 9, m0 - (m0 - m1) * i / need - 1, 6, 2); }
        cc(mx, m1 - 18, 13); ink('#8f7dff', 3); X.fillStyle = '#6a58df'; cc(mx - 3, m1 - 15, 4); X.fill(); X.strokeStyle = '#FFC93C'; X.lineWidth = 3; X.beginPath(); X.ellipse(mx, m1 - 18, 19, 4, -.18, 0, TAU); X.stroke();
        cc(mx, m0 + 16, 12); ink('#4DB8FF', 3); X.fillStyle = '#4fd06a'; cc(mx - 3, m0 + 13, 4); X.fill();
        cc(mx, my, 9); ink(OR, 3); X.fillStyle = 'rgba(255,255,255,.4)'; cc(mx - 3, my - 3, 2.6); X.fill();
        txt(String(Math.round(f * 384400)), mx - 34, my - 7, 18, '#fff', 'right'); txt('KM', mx - 34, my + 11, 13, '#5CFFE0', 'right');
        /* trampolines: bouncy rubber bands pinned with star knobs */
        ctx.lineCap = 'round';
        for (const l of lines) {
          const ax = l.ax, ay = sy(l.ay), bx = l.bx, by = sy(l.by), pop = Math.min(1, (clock - l.born) / .15), u = l.die ? (clock - l.die) / .3 : 0;
          const cx = (ax + bx) / 2, cy = (ay + by) / 2, sc = .4 + .6 * outBack(pop), bow = l.die ? Math.sin(u * Math.PI) * 34 * (1 - u) : 0;
          const p0x = cx + (ax - cx) * sc, p0y = cy + (ay - cy) * sc, p1x = cx + (bx - cx) * sc, p1y = cy + (by - cy) * sc;
          ctx.globalAlpha = 1 - u * u;
          const col = l.kb ? '#FFE14D' : '#5CFFE0';
          for (const [w, c, oy] of [[18, INK, 0], [11, l.kb ? '#c99512' : '#23a09a', 2], [11, col, -1], [3, 'rgba(255,255,255,.85)', -3]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p0x, p0y + oy); ctx.quadraticCurveTo(l.hx, cy + bow * 2 + oy, p1x, p1y + oy); ctx.stroke(); }
          for (const [px, py] of [[p0x, p0y], [p1x, p1y]]) { cc(px, py, 9); ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.55)'; cc(px - 2.5, py - 3, 2.4); X.fill(); }
          ctx.globalAlpha = 1;
        }
        if (drawing && !g.result) {
          const d = drawing; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -now * 60; ctx.lineCap = 'round';
          ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(d.ax, d.ay); ctx.lineTo(d.bx, d.by); ctx.stroke();
          ctx.strokeStyle = '#5CFFE0'; ctx.lineWidth = 7; ctx.stroke(); ctx.setLineDash([]);
          cc(d.bx, d.by, 9); ink('#fff', 3); cc(d.ax, d.ay, 6); ink('#ff5c8a', 2.5);
        }
        /* first fall: a ghost line shows where to draw */
        if (!g.result && !kbMode && hits === 0 && !lines.some(l => !l.kb) && !drawing) {
          const y = Math.max(sy(b.y) + 110, 430); ctx.globalAlpha = .4 + .25 * Math.sin(now * 10); ctx.setLineDash([12, 12]); ctx.lineCap = 'round';
          ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(b.x - 90, y); ctx.lineTo(b.x + 90, y); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
        /* keyboard pen on its rail: shown once a key is used, or faintly on desktop until the mouse is used */
        if (!g.result && (kbMode || (!TOUCH && !usedPtr))) {
          const x = pen, y = PENY, on = cool <= 0, a = kbMode ? 1 : .55;
          ctx.globalAlpha = a; rr(penLo() - KBL / 2, y - 5, penHi() - penLo() + KBL, 10, 5); ink('rgba(255,225,77,.35)', 2.5);
          ctx.globalAlpha = (on ? .75 : .35) * a; ctx.setLineDash([10, 8]); ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - KBL / 2, y); ctx.lineTo(x + KBL / 2, y); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalAlpha = (.3 + .15 * Math.sin(now * 12)) * a; if (on) { cc(x, y, 24); X.fillStyle = '#FFE14D'; X.fill(); }
          ctx.globalAlpha = a; cc(x, y + (on ? 0 : 3), 15); ink(on ? '#FFE14D' : '#d3cfe0', 4); X.fillStyle = on ? '#c99512' : '#8f88a6'; cc(x, y + 2, 5); X.fill(); X.fillStyle = on ? '#fff' : '#f6f4fb'; cc(x, y, 5); X.fill();
          if (clock < 4) { ctx.globalAlpha = Math.min(1, 4 - clock) * a; rr(W / 2 - 150, 508, 300, 34, 17); ink('#fff', 3); txt('←/→ MOVE · SPACE = LINE', W / 2, 526, 18, INK); }
          ctx.globalAlpha = 1;
        }
        /* the ball: comet trail, then a tiny Claude planet with a face */
        const bx = b.x, by = sy(b.y), rising = b.vy < -200 && !lose;
        if (rising || win) for (let i = 0; i < trail.length; i++) { ctx.globalAlpha = i / trail.length * .5; ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.arc(trail[i].x, sy(trail[i].y), R * (.3 + .6 * i / trail.length), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        const scared = !g.result && b.vy > 250 && by > 330 && !lines.some(l => !l.die && Math.min(l.ay, l.by) > b.y && b.x > Math.min(l.ax, l.bx) - 40 && b.x < Math.max(l.ax, l.bx) + 40);
        if (!lose) planet(bx, by, b, scared, rising, win);
        /* payoffs */
        if (win) for (let i = 0; i < 5; i++) {                          // the moon blushes: hearts float up beside it
          const q = (now * .6 + i * .2) % 1, hx2 = i % 2 ? W / 2 + 190 + (i * 13) % 40 : W / 2 - 260 - (i * 17) % 40, hy2 = 330 - q * 230;
          ctx.globalAlpha = Math.min(1, q * 5) * (1 - q * q); heart(hx2, hy2, .9 - q * .2); ctx.globalAlpha = 1;
        }
        if (lose) {                                                       // the moon cackles; the ball pops back up dizzy in the smog, tiny
          const gx = Math.max(-OX + 90, Math.min(W + OX - 90, b.x)), q = Math.min(1, oT * 3), gyy = 455 - (1 - outBack(q)) * 80;
          X.fillStyle = 'rgba(20,16,28,.3)'; el(gx, gyy + 34, 26, 6); X.fill();
          planet(gx, gyy, { vx: 0, vy: 0, sq: 0 }, false, false, false, true);
          for (let i = 0; i < 3; i++) { const a = now * 5 + i * 2.1; sparkle(gx + Math.cos(a) * 30, gyy - 38 + Math.sin(a) * 8, 5, '#FFE14D', a); }
          for (let i = 0; i < 3; i++) { const q2 = (now * 1.2 + i * .33) % 1; cc(gx - 40 + i * 40, gyy + 44 - q2 * 14, 8 + q2 * 6); X.fillStyle = 'rgba(200,190,230,' + (.6 * (1 - q2)).toFixed(2) + ')'; X.fill(); }
        }
        vignette(.2);
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
