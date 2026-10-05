'use strict';
/* ONE STEP AT A TIME (after WarioWare: Twisted!'s staircase boss): every full turn of the crank lifts Claude one step,
   while a hungry frog hops up the stairs behind. Reach the door on step 10 before it catches up.
   Pointer: circle the crank (hover or drag), one way only. Keys: ↑ → ↓ ← in order (or W D S A); a wrong key jams the crank.
   Art: the DUO look (docs/ART-STYLE.md): a sunny hillside garden stair up to a round hobbit door, a windmill, a frog with a napkin bib. */
(function () {
  // ---- local drawing kit (draws on X so the sky/hills can be baked offscreen) ----
  let X = null;
  const ease = k => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k;
  const hsh = i => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };   // decor randomness: never the game RNG
  function rr(x, y, w, h, r) { X.beginPath(); if (X.roundRect) X.roundRect(x, y, w, h, r); else X.rect(x, y, w, h); }
  function ink(fill, o) { X.lineJoin = 'round'; X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = o * 2; X.stroke(); X.fillStyle = fill; X.fill(); }
  // inked + cel-shaded shape: p() builds the path; the shade stays as a crescent on the (dx,dy) side
  function cel(p, base, shade, o, dx, dy) {
    X.save(); p(); X.lineJoin = 'round'; if (o) { X.strokeStyle = INK; X.lineWidth = o * 2; X.stroke(); } X.fillStyle = shade; X.fill(); X.clip();
    X.translate(-dx, -dy); p(); X.fillStyle = base; X.fill(); X.restore();
  }
  const bl = (cx, cy, rx, ry, rot, base, shade, o, dx = 4, dy = 5) => cel(() => { X.beginPath(); X.ellipse(cx, cy, rx, ry, rot, 0, 7); }, base, shade, o, dx, dy);
  const rb = (x, y, w, h, r, base, shade, o, dx = 5, dy = 0) => cel(() => rr(x, y, w, h, r), base, shade, o, dx, dy);
  function glint(x, y, rx, ry, rot, a = .45) { X.fillStyle = `rgba(255,255,255,${a})`; X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, 7); X.fill(); }
  function tube(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; for (const [c, ww] of [[INK, w + 7], [col, w]]) { X.strokeStyle = c; X.lineWidth = ww; X.beginPath(); pts.forEach((q, i) => i ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])); X.stroke(); } }
  function cloud(x, y, k) {
    const blobs = [[0, 0, 26], [28, -10, 22], [-28, 4, 18], [54, 2, 16]];
    X.lineJoin = 'round';
    X.beginPath(); for (const [px, py, pr] of blobs) { X.moveTo(x + px * k + pr * k, y + py * k); X.arc(x + px * k, y + py * k, pr * k, 0, 7); }
    X.strokeStyle = '#9cc9ee'; X.lineWidth = 6; X.stroke(); X.fillStyle = '#e4f5ff'; X.fill();
    X.beginPath(); for (const [px, py, pr] of blobs) { X.moveTo(x + (px - 3) * k + pr * k * .8, y + (py - 5) * k); X.arc(x + (px - 3) * k, y + (py - 5) * k, pr * k * .8, 0, 7); }
    X.fillStyle = '#fff'; X.fill();
  }
  function lolli(x, y, h, s) {                                     // lollipop tree (far hills, coloured outline)
    X.fillStyle = '#6b8f5a'; X.fillRect(x - 2 * s, y - h * s, 4 * s, h * s);
    X.beginPath(); X.arc(x, y - h * s - 9 * s, 14 * s, 0, 7); X.fillStyle = '#3f9a5a'; X.fill(); X.strokeStyle = '#2f7a49'; X.lineWidth = 3; X.stroke();
    X.fillStyle = 'rgba(255,255,255,.22)'; X.beginPath(); X.ellipse(x - 5 * s, y - h * s - 14 * s, 5 * s, 3 * s, -.5, 0, 7); X.fill();
  }

  // sky + sun halo + mountains + hills, baked once per screen width. hills sit in their own layer so they can sink as we climb
  let SKY = null, HILL = null, bakedVW = 0;
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function bake() {
    const keep = X; bakedVW = VW; SKY = mk(VW, H); HILL = mk(VW, 900);
    X = SKY.getContext('2d');
    const g = X.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff');
    X.fillStyle = g; X.fillRect(0, 0, VW, H);
    for (const [r, a] of [[120, .1], [84, .14], [58, .2]]) { X.fillStyle = `rgba(255,248,200,${a})`; X.beginPath(); X.arc(VW - 100, 170, r, 0, 7); X.fill(); }
    X = HILL.getContext('2d');
    for (const [bx, w, h, a, b, ol] of [[110, 240, 170, '#c9d0fb', '#aab3f2', '#7b80c6'], [330, 280, 140, '#a4b1f2', '#8492e2', '#5b5fa8'], [640, 260, 180, '#c9d0fb', '#aab3f2', '#7b80c6'], [920, 240, 130, '#a4b1f2', '#8492e2', '#5b5fa8']]) {
      const x = bx + OX, base = 520, tri = () => { X.beginPath(); X.moveTo(x - w / 2, base); X.lineTo(x - w * .05, base - h); X.lineTo(x + w / 2, base); X.closePath(); };
      cel(tri, a, b, 0, w * .09, 0); tri(); X.strokeStyle = ol; X.lineWidth = 3; X.lineJoin = 'round'; X.stroke();
      X.fillStyle = '#f6f8ff'; X.beginPath(); X.moveTo(x - w * .05, base - h); X.lineTo(x - w * .15, base - h + h * .22); X.lineTo(x - w * .08, base - h + h * .17); X.lineTo(x - w * .02, base - h + h * .24); X.lineTo(x + w * .05, base - h + h * .2); X.closePath(); X.fill();
    }
    X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(0, 900); for (let x = 0; x <= VW; x += 30) X.lineTo(x, 450 + Math.sin(x * .008 + 1) * 26 + Math.sin(x * .02) * 8); X.lineTo(VW, 900); X.fill();
    X.fillStyle = '#87d19b'; X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 900); for (let x = 0; x <= VW; x += 30) X.lineTo(x, 492 + Math.sin(x * .011 + 3) * 22); X.lineTo(VW, 900); X.fill();
    X.beginPath(); for (let x = 0; x <= VW; x += 30) { const y = 492 + Math.sin(x * .011 + 3) * 22; x ? X.lineTo(x, y) : X.moveTo(x, y); } X.stroke();
    for (const x of [90, 215, 470, 690, 980]) if (x < VW - 20) lolli(x, 492 + Math.sin(x * .011 + 3) * 22 + 6, 16, 1.1);
    X = keep;
  }
  function windmill(x, y, s, t) {                                  // background gag: a windmill that keeps spinning
    X.save(); X.translate(x, y); X.scale(s, s);
    const tw = () => { X.beginPath(); X.moveTo(-26, 0); X.lineTo(-16, -92); X.lineTo(16, -92); X.lineTo(26, 0); X.closePath(); };
    cel(tw, '#f2e6d0', '#d6c3a4', 0, 9, 0); tw(); X.strokeStyle = '#a68a6a'; X.lineWidth = 3; X.lineJoin = 'round'; X.stroke();
    X.fillStyle = '#c0583a'; X.beginPath(); X.moveTo(-22, -92); X.lineTo(0, -122); X.lineTo(22, -92); X.closePath(); X.fill(); X.stroke();
    X.fillStyle = '#7a5a3a'; X.beginPath(); X.arc(0, 0, 11, Math.PI, 0); X.fill();
    X.translate(0, -88);
    for (let i = 0; i < 4; i++) { X.save(); X.rotate(t * .9 + i * Math.PI / 2); X.strokeStyle = '#a68a6a'; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -64); X.stroke(); X.fillStyle = '#fff6e4'; X.fillRect(2, -62, 15, 40); X.lineWidth = 2.5; X.strokeRect(2, -62, 15, 40); X.restore(); }
    X.fillStyle = '#a68a6a'; X.beginPath(); X.arc(0, 0, 6, 0, 7); X.fill(); X.restore();
  }
  function bird(x, y, t, k) { X.strokeStyle = '#4a4468'; X.lineWidth = 2.5; X.lineCap = 'round'; const f = Math.sin(t * 9 + k) * 5; X.beginPath(); X.moveTo(x - 9, y - f); X.quadraticCurveTo(x - 4, y - 6, x, y); X.quadraticCurveTo(x + 4, y - 6, x + 9, y - f); X.stroke(); }

  // the chaser: a big hungry frog facing right with a napkin bib; air = 0..1 hop height, open = jaw, tongue = 0..1 lash
  // look = -1..1 (pupils toward Claude), mood: null | 'dizzy' (flattened) | 'glee' (got him)
  function frog(x, y, s, air, open, tongue, look, mood) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - air * .12), s * (1 + air * .16)); X = ctx;
    const G = '#6cc04a', GS = '#4a9a38', GL = '#d8f0a8';
    if (tongue > 0) {
      tube([[28, -30], [28 + tongue * 40, -46 - tongue * 14], [30 + tongue * 78, -40]], 7, '#ff7aa2');
      bl(30 + tongue * 78, -40, 8, 8, 0, '#ff7aa2', '#e0568a', 3, 2, 2);
    }
    bl(-26, -4 + air * 6, 22, 9, .2 + air * .5, '#5cb03e', GS, 4, 4, 4);                                 // back foot
    bl(0, -30, 40, 28, -.12, G, GS, 5, 8, 8);                                                           // body
    bl(10, -20, 24, 14, -.12, GL, '#b8d98a', 0, 4, 4);                                                  // belly
    bl(-20, -22, 16, 14, 0, '#5cb03e', GS, 4, 4, 4);                                                    // haunch
    bl(20, -4 + air * 4, 13, 7, 0, '#5cb03e', GS, 4, 3, 3);                                             // front foot
    glint(-12, -48, 11, 5, -.4);
    // napkin bib tucked under the chin
    X.beginPath(); X.moveTo(8, -30); X.lineTo(34, -26); X.lineTo(26, -6); X.lineTo(10, -8); X.closePath(); ink('#fff', 3);
    X.fillStyle = '#ff4d5e'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) X.fillRect(12 + i * 5 + j * 1.5, -26 + j * 6, 5, 5);
    // eyes bulging on top
    const dz = mood === 'dizzy';
    for (const ex of [4, 26]) {
      bl(ex, -58, 13, 13, 0, G, GS, 5, 3, 3);
      X.beginPath(); X.ellipse(ex + 1, -59, 9, 10, 0, 0, 7); X.fillStyle = '#fff'; X.fill();
      if (dz) { X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); for (let a = 0; a < 11; a += .4) { const r = 1 + a * .7; X.lineTo(ex + 1 + Math.cos(a + now * 12) * r, -59 + Math.sin(a + now * 12) * r); } X.stroke(); }
      else if (mood === 'glee') { X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.arc(ex + 1, -56, 6, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
      else { const pr = open > .3 ? 4 : 5; X.fillStyle = INK; X.beginPath(); X.arc(ex + 2 + look * 3, -59, pr, 0, 7); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(ex + 3.5 + look * 3, -61, 1.6, 0, 7); X.fill(); }
    }
    // jaw
    X.beginPath(); X.moveTo(14, -36); X.quadraticCurveTo(30, -30 + open * 18, 42, -38);
    if (open > .1) { X.lineTo(42, -38); X.quadraticCurveTo(30, -34 + open * 20, 14, -36); X.closePath(); X.fillStyle = '#b8203f'; X.fill(); }
    X.lineWidth = 4; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke();
    if (open > .45) { X.fillStyle = '#ff9aa8'; X.beginPath(); X.ellipse(30, -34 + open * 13, 8, 3.5, 0, 0, 7); X.fill(); }
    X.fillStyle = 'rgba(255,110,140,.55)'; X.beginPath(); X.ellipse(24, -46, 6, 3.4, 0, 0, 7); X.fill();   // blush
    if (open > .5 && !mood) { X.fillStyle = '#9fe3ff'; X.beginPath(); X.ellipse(36, -26 + (now * 40 % 12), 2.4, 4, 0, 0, 7); X.fill(); }   // drool
    ctx.restore();
  }

  BOSSES.crank = function (sp, s) {
    const k = Math.min(sp, 1.3) / 1.3, NEED = 10, SW = 80, SR = 30, Q = Math.PI / 2, TAU = Math.PI * 2, CY = 405, CR = 80;
    const KQ = Q * 1.4, MAXR = 2 * TAU, DEAD = 40, BAND = 2.4;                    // a key is worth 1.4 quarter turns; pointer counts ≤ 2 rev/s
    const KEYS = [['ArrowUp', 'KeyW'], ['ArrowRight', 'KeyD'], ['ArrowDown', 'KeyS'], ['ArrowLeft', 'KeyA']];
    let clock = 0, c = 0, cd = 0, b = -3, acc = 0, dir = 0, pend = 0, lastA = null, crankT = -Q, crankA = -Q, notch = 0, idle = 0, sq = 0, kick = 0, f = -1;
    let fall = null, doorT = -1, splat = 0, jam = 0, badKey = -1, lick = 0;
    const CX = () => W + OX - 150;
    const hc = x => Math.max(0, Math.min(NEED, x)) * SR;                       // stair height (px) at step position x
    const sx = x => W / 2 - 40 + (x - f) * SW, sy = h => 455 - (h - hc(f));    // world -> screen (camera on step f)
    const quad = () => ((Math.round(crankT / Q) + 1) % 4 + 4) % 4;             // handle at 0 up, 1 right, 2 down, 3 left
    const nextK = () => (quad() + (dir < 0 ? 3 : 1)) % 4;                      // spinning counter-clockwise reverses the key order
    const frogH = () => { const fl = Math.floor(b), fr = b - fl; return hc(fl) + (hc(fl + 1) - hc(fl)) * Math.min(1, fr * 1.4) + Math.sin(fr * Math.PI) * 30; };

    const climb = () => {
      c++; sq = 1; sfx.blip(c * 2); snd(150 + c * 12, .07, 'triangle', .06);
      burst(sx(c), sy(hc(c)), '#fff', 7, 160);
      if (c === 5) floatText('HALFWAY!', W / 2, 190, '#fff', 40);
      if (c === 8) floatText('ALMOST!', W / 2, 190, '#FFE14D', 40);
      if (c >= NEED) { g.result = 'win'; doorT = 0; sfx.sparkle(); confetti(sx(NEED), sy(hc(NEED)) - 60, 50); ring(sx(NEED), sy(hc(NEED)) - 40, '#FFE14D', 160, .5); }
    };
    const turn = d => {                                                          // net signed crank progress (radians)
      if (g.result || !clock) return;
      acc += d; idle = 0;
      if (!dir && Math.abs(acc) >= TAU) dir = Math.sign(acc);                   // the first full turn locks the direction
      if (dir) acc = dir * Math.max(dir * acc, (c - 2) * TAU);                   // turning back only unwinds (at most two turns of debt)
      const n = Math.floor(acc / (Math.PI / 4)); if (n !== notch) { notch = n; snd(420 + Math.max(0, Math.abs(acc) / TAU - c) * 520, .03, 'square', .03); }
      while (dir && acc * dir >= (c + 1) * TAU && !g.result) climb();
    };
    const lose = () => {
      g.result = 'lose'; b = Math.max(b, cd - .6); lick = 1; fall = { x: cd, h: hc(cd), vx: -3.2, vh: 560, r: 0 };
      sfx.splat(); sfx.buzz(); shake(12, .4); floatText('GOTCHA!', sx(cd), sy(hc(cd)) - 120, '#FF4D6D', 52);
    };

    const g = {
      cmd: 'BOSS!', hint: 'SPIN TO CLIMB (OR ↑→↓←)!', thint: 'DRAW CIRCLES TO CLIMB!', dur: 11, boss: true, wide: true,
      key(e) {
        const i = KEYS.findIndex(q => q.includes(e.code)); if (i < 0 || g.result || jam > 0) return;
        if (i === nextK()) { kick = 1; crankT = (Math.round(crankT / Q) + (dir < 0 ? -1 : 1)) * Q; turn(KQ * (dir || 1)); }
        else { jam = .3; badKey = i; sfx.buzz(); snd(90, .12, 'sawtooth', .05); floatText('JAMMED!', CX(), CY - CR - 70, '#FF4D6D', 30); }  // mashing jams the gears
      },
      move(p) {                                                                  // hover (mouse) or drag (touch) around the crank
        const dx = p.x - CX(), dy = p.y - CY; if (dx * dx + dy * dy < DEAD * DEAD) return;   // wrist jitter near the hub doesn't count
        const a = Math.atan2(dy, dx); if (lastA === null) { lastA = a; return; }
        let d = a - lastA; d -= Math.round(d / TAU) * TAU; lastA = a;
        if (Math.abs(d) < 1 && !g.result) { crankT += d; pend += d; }            // the handle follows the pointer; progress is metered in update
      },
      down(p) { g.move(p); },
      up() { lastA = null; },
      update(dt) {
        clock += dt; idle += dt; sq = Math.max(0, sq - dt * 5); kick = Math.max(0, kick - dt * 6); jam = Math.max(0, jam - dt); lick = Math.max(0, lick - dt * 2.5);
        crankA += (crankT - crankA) * Math.min(1, dt * 28);
        if (pend) { const m = MAXR * dt, u = Math.max(-m, Math.min(m, pend)); pend = Math.max(-.6, Math.min(.6, pend - u)); turn(u); }
        if (cd < c) cd = Math.min(c, cd + dt * 7);
        const gap = c - b, tgt = g.result === 'win' ? NEED - 3.6 : Math.max(cd - Math.min(Math.max(gap, 0), 5) / 2 + .5, cd - 30 / SW);
        f += (tgt - f) * Math.min(1, dt * (g.result === 'win' ? 7 : 4));
        if (g.result === 'lose' && !fall) lose();                                // ran out of time: the frog pounces anyway
        if (fall) { fall.vh -= 1700 * dt; fall.h += fall.vh * dt; fall.x += fall.vx * dt; fall.r -= 10 * dt; b = Math.min(cd, b + dt * 4); }
        if (g.result === 'win') {
          doorT += dt;
          if (doorT > .28 && doorT - dt <= .28) { sfx.thud(); shake(6, .2); burst(sx(NEED + .65), sy(hc(NEED)) - 50, '#c0392b', 10, 220); }
          if (doorT > .3 && !splat) { b = Math.min(NEED + .45, b + dt * 10); if (b >= NEED + .45) { splat = 1; sfx.splat(); shake(10, .3); floatText('SPLAT!', Math.min(sx(NEED + 1.5), W + OX - 100), sy(hc(NEED)) - 40, '#fff', 40); } }
        }
        if (g.result) return;
        b += (.55 + .25 * k + .03 * clock) * dt;                                 // the frog hops steadily, faster over time
        if (c - b > BAND) b += (c - b - BAND) * 3 * dt;                          // ...and never falls far behind
        if (b >= c - .3) lose();
      },
      draw(t) {
        X = ctx; if (!SKY || bakedVW !== VW) { bake(); X = ctx; }
        const won = g.result === 'win', lost = g.result === 'lose';
        const par = hc(f) * .35;
        ctx.drawImage(SKY, -OX, 0);
        // sun rays turn behind the hills, clouds drift (they sink slowly as we climb)
        ctx.save(); ctx.translate(W + OX - 100, 170); ctx.rotate(now * .25); ctx.fillStyle = 'rgba(255,240,150,.3)';
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(40, -7); ctx.lineTo(96, -3); ctx.lineTo(96, 3); ctx.lineTo(40, 7); ctx.fill(); }
        ctx.restore();
        circ(W + OX - 100, 170, 32, '#ffe14d', 4); glint(W + OX - 110, 160, 11, 6, -.5, .6);
        for (const [x, y, k] of [[-120, 200, 1], [180, 262, .8], [520, 150, 1.05], [880, 220, .9], [1050, 300, .8]]) {
          const cx = ((x - f * 18 + now * 12) % (VW + 300) + VW + 300) % (VW + 300) - OX - 150, cy = y + par * .6;
          cloud(cx, cy, k);
        }
        ctx.drawImage(HILL, -OX, par);
        windmill(120, 470 + par, .8, now);                                       // background gag
        for (let i = 0; i < 3; i++) bird(((now * 40 + i * 120) % (VW + 200)) - OX - 100, 250 + i * 26 + Math.sin(now * 2 + i) * 6 + par * .5, now, i);
        // ground (step 0 and below): grass with a hard horizon, tufts, flowers, a pebble
        const gy = sy(0), gx1 = sx(.5);
        const gg = ctx.createLinearGradient(0, gy, 0, H); gg.addColorStop(0, '#8fdc5c'); gg.addColorStop(1, '#5fb944');
        ctx.fillStyle = gg; ctx.fillRect(-OX - 10, gy, gx1 + OX + 10, H - gy + 10);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let x = -OX - 40; x < gx1; x += 70) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 28, gy); ctx.lineTo(x - 34, H); ctx.lineTo(x - 62, H); ctx.fill(); }
        ctx.fillStyle = INK; ctx.fillRect(-OX - 10, gy - 2, gx1 + OX + 10, 4);
        for (let i = 0; i < 16; i++) {
          const wx = -.6 - i * .75 - hsh(i) * .4, px = sx(wx), py = gy + 20 + hsh(i + 40) * 70;
          if (px < -OX - 20 || px > gx1 - 8 || py > 530) continue;
          if (i % 3 === 0) { ctx.strokeStyle = '#3f8f35'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (const d of [-6, 0, 6]) { ctx.moveTo(px + d, py); ctx.lineTo(px + d * 1.6, py - 12); } ctx.stroke(); }
          else if (i % 3 === 1) { ctx.strokeStyle = '#3f8f35'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py + 8); ctx.lineTo(px, py - 2); ctx.stroke(); circ(px, py - 5, 5, i % 2 ? '#ff7aa2' : '#fff', 2); circ(px, py - 5, 2, '#ffe14d', 0); }
          else { X = ctx; bl(px, py, 9, 5, 0, '#e6dfd0', '#bdb3a0', 3, 3, 3); }
        }
        // the stairs: sandstone blocks with a light top, shaded right side, moss and a painted number
        const i0 = Math.max(1, Math.floor(f - (W / 2 + OX) / SW)), i1 = Math.min(NEED, Math.ceil(f + (W / 2 + OX + 80) / SW));
        for (let i = i0; i <= i1; i++) {
          const x = sx(i - .5), y = sy(hc(i)), w = i === NEED ? W + OX - x + 20 : SW;
          X = ctx; rb(x, y, w, H - y + 30, 6, i % 2 ? '#e8cc98' : '#e1c48d', i % 2 ? '#c9a46b' : '#c29c64', 5, 12, 0);
          ctx.fillStyle = '#f7e6b8'; rr(x + 3, y + 3, w - 6, 9, 4); ctx.fill();
          ctx.strokeStyle = 'rgba(20,16,28,.14)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          for (let yy = y + 56, r = 0; yy < H; yy += 34, r++) { ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.lineTo(x + w - 6, yy); ctx.stroke(); ctx.beginPath(); const vx = x + (r & 1 ? w * .35 : w * .65); ctx.moveTo(vx, yy - 34); ctx.lineTo(vx, yy); ctx.stroke(); }
          ctx.fillStyle = '#4fb04a'; ctx.strokeStyle = '#2f7a49'; ctx.lineWidth = 2.5;                         // moss tufts on the lip
          for (let m = 0; m < 3; m++) { const mx = x + 10 + hsh(i * 3 + m) * (SW - 24); ctx.beginPath(); ctx.arc(mx, y + 2, 5 + hsh(i + m) * 3, Math.PI, 0); ctx.fill(); ctx.stroke(); }
          if (i < NEED) { rr(x + SW / 2 - 17, y + 20, 34, 26, 8); ink('#fff7dc', 3); txt(String(i), x + SW / 2, y + 33, 20, INK); }
        }
        // the goal: a round hobbit door in the hill, bunting over it
        const dx0 = sx(NEED + .25), dy0 = sy(hc(NEED)), DW = 76, DH = 104;
        X = ctx;
        rb(dx0 - 14, dy0 - DH - 30, DW + 28, DH + 30, 38, '#9be38a', '#6cc45e', 5, 9, 4);
        rb(dx0 - 4, dy0 - DH - 4, DW + 8, DH + 4, 34, '#8a5a2b', '#6e4520', 4, 6, 0);
        rr(dx0, dy0 - DH, DW, DH, [34, 34, 4, 4]); ink('#2a1f33', 3);
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx0 - 28, dy0 - DH - 34); ctx.quadraticCurveTo(dx0 + DW / 2, dy0 - DH - 8 + Math.sin(now * 2) * 3, dx0 + DW + 28, dy0 - DH - 34); ctx.stroke();
        for (let q = 0; q < 6; q++) { const u = (q + .5) / 6, bx = lerp(dx0 - 28, dx0 + DW + 28, u), by = dy0 - DH - 34 + Math.sin(u * Math.PI) * 18 + Math.sin(now * 2) * 1.5;
          ctx.beginPath(); ctx.moveTo(bx - 7, by); ctx.lineTo(bx + 7, by); ctx.lineTo(bx, by + 14); ctx.closePath(); ink(['#ff4d5e', '#ffd23f', '#4dc0ff'][q % 3], 2); }
        // Claude: hop from step to step (or walk into the doorway on a win)
        const walk = won ? Math.min(1, doorT / .25) : 0, frc = cd - Math.floor(cd), cx = sx(won ? NEED + walk * .73 : cd);
        const cy = sy(hc(cd) + (cd < c ? Math.sin(frc * Math.PI) * 26 : 0)), U = 6 * (1 - walk * .18);
        if (fall) {
          ctx.save(); ctx.translate(sx(fall.x), sy(fall.h) - 30); ctx.rotate(fall.r); claude(0, 30, 6, { mood: 'sad' }); ctx.restore();
        } else if (!won || doorT < .3) {
          shadow(cx, cy + 2, 40 * (1 - walk * .3), 9, .3);
          const st = sq * .22; ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + st, 1 - st); ctx.translate(-cx, -cy);
          claude(cx, cy, U, { mood: won ? 'happy' : null, run: cd < c || won ? now * .8 : null }); ctx.restore();
          if (!g.result && c - b < 1.4) {                                         // panic sweat + alarm
            ctx.fillStyle = '#9fe4ff'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + d * 44, cy - 58 + Math.sin(now * 20 + d) * 4, 5, 8, 0, 0, 7); ctx.fill(); }
            txt('!', cx, cy - 90 + Math.sin(now * 25) * 3, 44, '#FF4D6D');
          }
        }
        // door panel swings shut after Claude walks through; Claude waves from the little round window
        if (won && doorT > .25) {
          const cl = Math.min(1, (doorT - .25) / .05), pw = DW * cl;
          X = ctx; rr(dx0 + DW - pw, dy0 - DH, pw, DH, [34, 34, 4, 4]); ink('#c0392b', 4);
          if (cl >= 1) {
            circ(dx0 + DW / 2, dy0 - DH + 40, 22, '#9fd8ff', 4); circ(dx0 + DW - 14, dy0 - 52, 6, '#FFE14D', 3);
            ctx.save(); ctx.beginPath(); ctx.arc(dx0 + DW / 2, dy0 - DH + 40, 19, 0, 7); ctx.clip(); claude(dx0 + DW / 2, dy0 - DH + 62, 3.1, { mood: 'happy' }); ctx.restore();
            for (let q = 0; q < 3; q++) { const u = ((doorT * 1.1 + q / 3) % 1); ctx.globalAlpha = 1 - u; X = ctx; ctx.save(); ctx.translate(dx0 + DW + 6 + Math.sin(u * 6 + q) * 8, dy0 - DH - 26 - u * 46); ctx.scale(.8, .8);
              ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ink('#ff5c8a', 3); ctx.restore(); ctx.globalAlpha = 1; }
          }
        }
        // the hungry frog: hops a step at a time, tongue flicking when close, flat with swirly eyes if the door got him
        const flat = won && splat, fr = b - Math.floor(b), bx = sx(flat ? NEED + .45 : b), by = sy(flat ? hc(NEED) : frogH());
        if (bx > -OX - 80) {
          const close = !g.result && c - b < 1.6, air = flat ? 0 : Math.sin(fr * Math.PI);
          shadow(bx, sy(hc(Math.round(b))) + 2, 44 * (1 - air * .3), 10, .25);
          ctx.save(); ctx.translate(bx, by); if (flat) ctx.scale(.35, 1.25);
          frog(0, 0, 1.25, air, close || lost ? .6 + Math.sin(now * 18) * .4 : .15, lost ? lick : close ? Math.max(0, Math.sin(now * 7)) * .5 : 0, Math.max(-1, Math.min(1, (cd - b) * .5)), flat ? 'dizzy' : lost ? 'glee' : null);
          ctx.restore();
          if (flat) for (let q = 0; q < 3; q++) { const a = now * 5 + q * 2.1; X = ctx; star(bx + Math.cos(a) * 30, by - 118 + Math.sin(a) * 8, 8, 3.5, 5, a, '#FFE14D', 2); }
        }
        // the crank: a brass winch on a wooden post. A grumpy face lives in the hub (jam = dizzy, frog close = worried, win = happy)
        const X0 = CX(), A = crankA + (jam ? Math.sin(now * 70) * .08 : 0), kk = 1 + kick * .06;
        ctx.save(); ctx.globalAlpha = won ? Math.max(0, 1 - doorT * 4) : 1;        // on a win the winch fades so the door payoff reads
        ctx.translate(X0 + (jam ? Math.sin(now * 90) * 4 : 0), CY); ctx.scale(kk, kk); X = ctx;
        shadow(6, CR + 30, CR + 10, 14, .3);
        rb(-14, CR - 10, 28, 46, 6, '#b97a46', '#8a5530', 4, 6, 0);                                      // wooden post
        circ(0, 0, CR + 22, jam ? '#a8384e' : '#7a7f96', 5); bl(0, 0, CR + 22, CR + 22, 0, jam ? '#e8606f' : '#9aa0b8', jam ? '#a8384e' : '#7a7f96', 5, 8, 8);
        for (let i = 0; i < 8; i++) { const ga = i * TAU / 8 + .4; circ(Math.cos(ga) * (CR + 14), Math.sin(ga) * (CR + 14), 4, '#dfe4f0', 2); }
        bl(0, 0, CR + 8, CR + 8, 0, '#e3a83a', '#b8801f', 5, 7, 7);
        bl(0, 0, CR - 4, CR - 4, 0, jam ? '#f8d0d6' : '#fff1c4', jam ? '#e8a8b2' : '#ecd48c', 4, 6, 6);
        glint(-CR * .4, -CR * .45, 20, 8, -.6, .5);
        for (let i = 0; i < 6; i++) { const a = A + i * TAU / 6; tube([[Math.cos(a) * 18, Math.sin(a) * 18], [Math.cos(a) * (CR - 8), Math.sin(a) * (CR - 8)]], 4, '#b8801f'); }
        const pr = acc - (dir || 1) * c * TAU;                                   // progress toward the next step (red = unwinding)
        if (Math.abs(pr) > .02 && !won) { ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, CR + 2, -Q, -Q + pr, pr < 0); ctx.stroke(); ctx.strokeStyle = dir && pr * dir < 0 ? '#FF4D6D' : '#FFE14D'; ctx.lineWidth = 8; ctx.stroke(); }
        const hx = Math.cos(A) * (CR - 18), hy = Math.sin(A) * (CR - 18);
        tube([[0, 0], [hx, hy]], 10, '#b97a46');
        const danger0 = !g.result && c - b < 1.4, bl2 = Math.sin(now * 1.9) > .985;
        circ(0, 0, 20, '#e3a83a', 4); glint(-6, -7, 6, 3, -.5, .6);                       // hub with a face
        for (const ex of [-7, 7]) {
          if (won || (!jam && !danger0 && c > 0 && Math.sin(now * 3) > .6)) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ex, -1, 3.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
          else if (jam) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); for (let a = 0; a < 9; a += .5) ctx.lineTo(ex + Math.cos(a + now * 14) * (1 + a * .4), -2 + Math.sin(a + now * 14) * (1 + a * .4)); ctx.stroke(); }
          else { circ(ex, -2, danger0 ? 4.6 : 3.8, '#fff', 1.5); if (!bl2) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + Math.cos(A) * 1.6, -2 + Math.sin(A) * 1.6, 1.9, 0, 7); ctx.fill(); } }
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); if (won) ctx.arc(0, 4, 5, .1, Math.PI - .1); else if (jam || danger0) { ctx.ellipse(0, 8, 4, 3, 0, 0, 7); } else { ctx.moveTo(-4, 7); ctx.lineTo(4, 7); } ctx.stroke();
        circ(hx, hy, 21, '#FF4D6D', 5); bl(hx, hy, 21, 21, 0, '#FF4D6D', '#cc2f4f', 5, 5, 5); glint(hx - 7, hy - 8, 7, 3.5, -.5, .7);
        ctx.restore();
        if (!g.result && idle > .8) {                                             // ghost: a big arrow sweeping round the rim
          const a = now * 5, R = TOUCH ? CR + 36 : CR + 22;
          ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(X0, CY, R, a - 2.6, a - .2); ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 11; ctx.stroke(); ctx.lineCap = 'butt';
          ctx.save(); ctx.translate(X0 + Math.cos(a) * R, CY + Math.sin(a) * R); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(-22, -6); ctx.lineTo(22, -6); ctx.closePath(); ctx.lineJoin = 'round'; ctx.fillStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fill(); ctx.restore();
          txt('SPIN!', X0, CY - CR - 64 + Math.sin(now * 10) * 3, 32, '#FFE14D');
        }
        if (!TOUCH) for (let i = 0; i < 4; i++) {                                 // keycaps: next key in the rotation glows, a wrong one flashes red
          const a = -Q + i * Q, kx = X0 + Math.cos(a) * (CR + 42), ky = CY + Math.sin(a) * (CR + 42), nx = !g.result && !jam && i === nextK(), bad = jam && i === badKey;
          const z = nx ? 1 + Math.sin(now * 14) * .08 : bad ? 1.05 : .85;
          ctx.save(); ctx.translate(kx, ky); ctx.scale(z, z); X = ctx;
          rr(-17, -13, 34, 34, 7); ink(nx ? '#c99512' : bad ? '#b8283a' : '#8f88a6', 4);                    // plate depth
          rr(-17, -17, 34, 34, 7); ink(bad ? '#ff4d5e' : nx ? '#FFE14D' : '#f4f0fa', 4);
          drawArrow(0, 1, i, 10, bad ? '#fff' : nx ? OR : '#9a90a8'); ctx.restore();
        }
        // HUD: a wooden sign on strings: step counter, pips with the frog's position, the goal door at the end
        const danger = !g.result && c - b < 1.4, wob = danger ? Math.sin(now * 40) * 3 : 0, SX = 325, SY = 64;
        ctx.save(); ctx.translate(0, 0); X = ctx;
        ctx.strokeStyle = '#e6c58c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const sxx of [SX + 28, SX + 232]) { ctx.beginPath(); ctx.moveTo(sxx, 58); ctx.lineTo(sxx, SY + 4); ctx.stroke(); }
        ctx.fillStyle = 'rgba(20,16,28,.3)'; rr(SX + 4, SY + 7, 260, 72, 14); ctx.fill();
        rb(SX, SY, 260, 72, 14, '#d9944f', '#a5622c', 4, 0, 8);
        ctx.strokeStyle = 'rgba(165,98,44,.5)'; ctx.lineWidth = 2; for (const yy of [SY + 12, SY + 54]) { ctx.beginPath(); ctx.moveTo(SX + 12, yy); ctx.lineTo(SX + 248, yy + 1); ctx.stroke(); }
        circ(SX + 12, SY + 12, 3, '#6e4520', 0); circ(SX + 248, SY + 12, 3, '#6e4520', 0);
        txt(window.t('STEP {n} / {need}', { n: c, need: NEED }), SX + 130 + wob, SY + 20, 26, danger ? '#FF4D6D' : '#FFE14D');
        for (let i = 0; i < NEED; i++) { rr(SX + 14 + i * 21, SY + 38, 17, 13, 4); ink(i < c ? OR : '#7a4a22', 2.5); }
        rr(SX + 14 + NEED * 21 + 2, SY + 34, 16, 22, 7); ink('#c0392b', 3); circ(SX + 14 + NEED * 21 + 12, SY + 46, 2, '#FFE14D', 0);
        if (b > -.5 && !won) { const px = SX + 22 + Math.min(b, NEED) * 21; circ(px, SY + 62, 6.5, '#6cc04a', 3); circ(px + 2.5, SY + 60, 2, INK, 0); }
        ctx.restore();
        vignette(.2);
      },
      probe: () => ({ step: c, need: NEED, bug: +b.toFixed(2), gap: +(c - b).toFixed(2), turn: +((acc - (dir || 1) * c * TAU) / TAU).toFixed(2), dir, jam: +jam.toFixed(2), tumble: !!fall,
        clock: +clock.toFixed(2), nextKey: KEYS[nextK()][0], crank: { x: CX(), y: CY, r: CR - 18 }, result: g.result || null }),
    };
    return g;
  };
})();
