'use strict';
/* TILES boss (BRAINY BUNCH): a 3x3 sliding number puzzle, put 1-8 back in order before the fuse burns.
   After WarioWare D.I.Y.'s "Wily Tiles" (Orbulon's IQ boss). Scrambled exactly 3 moves from solved (4 at sp >= 1.3, 5 at sp >= 1.6). */
(function () {
  const C = 108, BX = 400 - C * 1.5, BY = 172, SLIDE = .09;       // cell size, board top-left, slide time
  const DIR = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
  const DOODLES = ['E=mc²', 'π≈3.14', 'a²+b²=c²', '√2', '∑n', '1+1=2', 'x=?', '∞', 'IQ>9000', 'Δt', '∫dx', '42'];
  const cxy = c => [BX + (c % 3) * C, BY + (c / 3 | 0) * C];
  const adj = (a, b) => Math.abs(a % 3 - b % 3) + Math.abs((a / 3 | 0) - (b / 3 | 0)) === 1;
  const nbrs = c => [c - 3, c + 3, c % 3 ? c - 1 : -1, c % 3 < 2 ? c + 1 : -1].filter(n => n >= 0 && n < 9);
  const GOAL = '123456780';
  const solve = s => {                                               // BFS: [next cell to slide on a shortest path, its length]
    if (s === GOAL) return [-1, 0]; const seen = new Map([[s, -1]]); let q = [s];
    for (let d = 0; d < 20 && q.length; d++) { const nq = [];
      for (const u of q) { const g = u.indexOf('0');
        for (const c of nbrs(g)) { const a = u.split(''); a[g] = a[c]; a[c] = '0'; const v = a.join('');
          if (seen.has(v)) continue; seen.set(v, seen.get(u) < 0 ? c : seen.get(u)); if (v === GOAL) return [seen.get(v), d + 1]; nq.push(v); } }
      q = nq; }
    return [-1, 0];
  };
  const num = (s, x, y, size, fill, o) => {                          // numbers/formulas: drawn raw, never translated
    ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (o) { ctx.lineWidth = o; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); } ctx.fillStyle = fill; ctx.fillText(s, x, y);
  };
  const clack = n => { snd(260 + n * 30, .05, 'triangle', .09, 0, 160); noise(.05, .06, 1800, 900, 'bandpass'); };

  /* ── art kit: the DUO look (docs/ART-STYLE.md). Local copy of the drawing helpers; everything draws on X (swapped for the baked scene).
     Cosmetic only: no Math.random in here, so the boss's own randomness is untouched. ── */
  const TAU = Math.PI * 2;
  let X = typeof ctx !== 'undefined' ? ctx : null;   // (the party catalog script loads this file without a canvas)
  const MXC = {}, mix = (a, b, k) => { const key = a + b + k; if (MXC[key]) return MXC[key]; const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const x = p(a), y = p(b); return MXC[key] = 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',') + ')'; };
  const sh = c => c[0] === '#' ? mix(c, '#2a1d6b', .3) : 'rgba(20,16,28,.3)';
  const mkRR = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const rrp = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = (fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } };
  const inkP = (p, fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } };
  const cel = (p, base, shade, sx, sy, o = 4) => { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = (p, x, y, rx, ry, a = .45, rot = -.5) => { X.save(); X.clip(p); X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); X.restore(); };
  const celRR = (x, y, w, h, r, base, o = 4, gl = true) => { const p = mkRR(x, y, w, h, r); cel(p, base, sh(base), 2.5, 3.5, o); if (gl) glint(p, x + w * .3, y + h * .2, w * .22, Math.min(h * .1, 6), .45, -.3); return p; };
  const celC = (x, y, r, base, o = 4, gl = true) => { const p = new Path2D(); p.arc(x, y, r, 0, TAU); cel(p, base, sh(base), r * .16, r * .2, o); if (gl) glint(p, x - r * .35, y - r * .4, r * .3, r * .16, .45, -.6); return p; };
  const celE = (x, y, rx, ry, base, o = 4, gl = true) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, TAU); cel(p, base, sh(base), rx * .14, ry * .2, o); if (gl) glint(p, x - rx * .35, y - ry * .4, rx * .3, ry * .16, .45, -.5); return p; };
  const celPoly = (pts, base, o = 4, sx = 3, sy = 4) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); cel(p, base, sh(base), sx, sy, o); return p; };
  const curve = (a, b, c, d, e, f, w, col) => { X.beginPath(); X.moveTo(a, b); X.quadraticCurveTo(c, d, e, f); X.lineCap = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); };
  const eye = (x, y, r, mood, look, T, k) => {                       // crane.js eye: sclera, pupil, white dot, blink, moods
    X.lineCap = 'round';
    el(x, y, r * (mood === 'panic' ? 1.3 : 1), r * (mood === 'panic' ? 1.3 : 1) * 1.08); ink('#fff', Math.max(1.5, r * .28));
    if (mood !== 'panic' && Math.sin(T * 1.9 + k * .7 + x * .01) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const pr = mood === 'panic' ? r * .32 : r * .52, lx = Math.max(-1, Math.min(1, look[0])) * r * .38, ly = Math.max(-1, Math.min(1, look[1])) * r * .38;
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill(); X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .38, pr * .32); X.fill();
  };
  const pill = (x, y, label, col) => {                               // name tag with a pointer
    label = window.t(label); X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = X.measureText(label).width + 24, h = 24;
    X.save(); X.translate(x, y); X.beginPath(); X.moveTo(-6, h / 2 - 2); X.lineTo(6, h / 2 - 2); X.lineTo(0, h / 2 + 8); X.closePath(); ink(col, 3);
    rrp(-w / 2, -h / 2, w, h, h / 2); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rrp(-w / 2 + 6, -h / 2 + 3, w - 12, h * .24, 3); X.fill();
    X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(label, 0, 1); X.restore();
  };
  const BAKED = {};                                                  // the static classroom, baked once per view width (it spans the whole wide screen)
  const baked = fn => { const k = VW; if (!BAKED[k]) { const c = document.createElement('canvas'); c.width = VW; c.height = H; const prev = X; X = c.getContext('2d'); try { X.translate(OX, 0); fn(); } finally { X = prev; } BAKED[k] = c; } return BAKED[k]; };
  const scene = () => {                                              // wall, chalkboard with doodles, chalk tray, wooden floor
    const L = -OX, R = W + OX;
    let gr = X.createLinearGradient(0, 0, 0, 520); gr.addColorStop(0, '#f6e4b0'); gr.addColorStop(1, '#ffeec6'); X.fillStyle = gr; X.fillRect(L, 0, VW, 520);
    X.fillStyle = 'rgba(200,120,70,.14)'; for (let x = L - 20; x < R; x += 56) X.fillRect(x, 0, 28, 520);
    const bx = L + 14, bw = VW - 28;                                 // the chalkboard
    X.fillStyle = 'rgba(20,16,28,.3)'; rrp(bx + 4, 66, bw, 440, 18); X.fill();
    celRR(bx - 8, 58, bw + 16, 448, 20, '#c98443', 5, false);
    gr = X.createLinearGradient(0, 66, 0, 498); gr.addColorStop(0, '#2f6b55'); gr.addColorStop(1, '#245543'); rrp(bx, 66, bw, 432, 12); X.fillStyle = gr; X.fill(); ink(null, 3);
    X.save(); rrp(bx, 66, bw, 432, 12); X.clip(); X.fillStyle = 'rgba(255,255,255,.05)'; el(L + VW * .3, 190, 240, 60, -.3); X.fill(); X.restore();
    X.font = '700 30px Fredoka, "Comic Sans MS", sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = 'rgba(255,255,255,.2)';
    let di = 0; for (let y = 172; y < 500; y += 108) for (let x = -OX + 70 + (y / 108 & 1) * 70; x < W + OX - 40; x += 175, di++) {
      if (Math.abs(x - 400) < 230 || di % 3 === 2) continue; X.save(); X.translate(x, y); X.rotate((di % 3 - 1) * .12); X.fillText(DOODLES[di % DOODLES.length], 0, 0); X.restore(); }
    celRR(bx - 6, 494, bw + 12, 18, 7, '#a5622c', 4, false);         // the chalk tray with a few sticks
    for (const [cx, col] of [[L + 120, '#ffffff'], [L + 148, '#FFE14D'], [R - 150, '#ff9ad5']]) celRR(cx, 486, 22, 8, 3, col, 2.5, false);
    gr = X.createLinearGradient(0, 516, 0, 600); gr.addColorStop(0, '#b97a46'); gr.addColorStop(1, '#8a5530'); X.fillStyle = gr; X.fillRect(L, 516, VW, 90);
    X.strokeStyle = 'rgba(80,45,20,.4)'; X.lineWidth = 2; X.beginPath(); for (let x = L - (L % 90); x < R; x += 90) { X.moveTo(x, 516); X.lineTo(x - 18, 600); } X.stroke();
    X.fillStyle = INK; X.fillRect(L, 514, VW, 5);
  };

  function alien(x, y, mood, k, zap) {                               // an Orbulon-ish brainiac in a purple robe
    const bob = Math.sin(k * 2.4) * 3, hy = y - 150 + bob, GRN = '#9be07a';
    celPoly([[x - 50, y], [x - 28, y - 112], [x + 28, y - 112], [x + 50, y]], '#6a3fb5', 5, 5, 3);
    celPoly([[x - 30, y - 110], [x, y - 82], [x + 30, y - 110]], '#FFE14D', 4, 2, 3);
    const arm = (sx, ex, ey) => { curve(x + sx, y - 96, x + sx * 1.9, (y - 96 + ey) / 2 + 20, ex, ey, 8, GRN); celC(ex, ey, 7, GRN, 3.5, false); };
    if (mood === 'laugh') { arm(-26, x - 64, y - 190 + Math.sin(k * 30) * 6); arm(26, x + 64, y - 190 - Math.sin(k * 30) * 6); }
    else if (mood === 'shock') { arm(-26, x - 46, hy - 50); arm(26, x + 46, hy - 50); }
    else { arm(-26, x - 40, y - 40); arm(26, x + 8, hy + 40); }                    // hand on chin: thinking
    celE(x, hy, 46, 40, GRN, 5);
    for (const sd of [-1, 1]) { X.fillStyle = 'rgba(255,110,165,.45)'; el(x + sd * 32, hy + 14, 7, 4.5); X.fill(); }
    const by = hy - 46, bs = 1 + (mood === 'aha' ? .08 : 0) + zap * .15;           // the giant brain
    const flash = zap > 0 && (k * 20 | 0) % 2;
    celE(x, by, 54 * bs, 38 * bs, flash ? '#ffffff' : '#ff9ad5', 5);
    X.strokeStyle = '#d0569c'; X.lineWidth = 4; X.lineCap = 'round';
    for (const [a, b, c] of [[-34, -10, 8], [-10, -24, -6], [14, -8, 10], [30, -18, -4], [-24, 14, 6], [6, 16, -8]]) { X.beginPath(); X.moveTo(x + a * bs, by + b * bs); X.quadraticCurveTo(x + (a + 10) * bs, by + (b + c) * bs, x + (a + 20) * bs, by + b * bs); X.stroke(); }
    X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 4; X.beginPath(); X.ellipse(x, by - 2, 64, 50, 0, Math.PI * 1.05, Math.PI * 1.95); X.stroke();
    X.beginPath(); X.arc(x - 30, by - 22, 9, Math.PI, Math.PI * 1.5); X.stroke();
    if (zap > 0) for (let i = 0; i < 4; i++) {                                     // fried brain: zigzag sparks
      const a = i * 1.6 + k * 6, r = 60 + Math.sin(k * 40 + i) * 6; X.strokeStyle = '#FFE14D'; X.lineWidth = 5; X.beginPath();
      X.moveTo(x + Math.cos(a) * 46, by + Math.sin(a) * 30); X.lineTo(x + Math.cos(a + .2) * r, by + Math.sin(a + .2) * r * .7); X.lineTo(x + Math.cos(a - .1) * (r + 14), by + Math.sin(a - .1) * (r + 14) * .7); X.stroke(); }
    for (const sd of [-1, 1]) {                                                    // eyes + mouth by mood
      const ex = x + sd * 18, ey = hy - 2;
      if (mood === 'laugh') { X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(ex - 9, ey + 4); X.lineTo(ex, ey - 5); X.lineTo(ex + 9, ey + 4); X.stroke(); }
      else if (mood === 'shock') eye(ex + Math.sin(k * 50) * 1.5, ey, 11, 'panic', [0, 0], k, sd);
      else eye(ex, ey, mood === 'aha' ? 11.5 : 10.5, null, [-.6, .5], k, sd);
    }
    X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = 5; const my = hy + 24;
    if (mood === 'laugh') { X.beginPath(); X.arc(x, my - 4, 14, 0, Math.PI); X.closePath(); X.fill(); X.fillStyle = '#ff6b8a'; el(x, my + 6, 8, 4); X.fill(); }
    else if (mood === 'shock') { X.beginPath(); X.ellipse(x, my, 8, 11 + Math.sin(k * 30) * 2, 0, 0, 7); X.fill(); }
    else if (mood === 'aha') { X.beginPath(); X.arc(x, my, 6, 0, 7); X.fill(); }
    else { X.beginPath(); X.moveTo(x - 12, my); for (let i = 1; i <= 4; i++) X.lineTo(x - 12 + i * 6, my + (i % 2 ? 3 : -1)); X.stroke(); }
    X.lineCap = 'butt';
  }
  function bubble(x, y, s, w) {                                      // wraps onto two lines instead of shrinking the text
    s = window.t(s); ctx.font = '700 20px Fredoka, "Helvetica Neue", Arial, sans-serif'; let L = [s];
    if (ctx.measureText(s).width > w - 26) { const sp = [...s.matchAll(/ /g)].map(m => m.index).sort((a, b) => Math.abs(a - s.length / 2) - Math.abs(b - s.length / 2))[0];
      if (sp) L = [s.slice(0, sp), s.slice(sp + 1)]; }
    const h = 28 + L.length * 24, b = y + h / 2;
    X.fillStyle = 'rgba(20,16,28,.3)'; rrp(x - w / 2 + 3, y - h / 2 + 6, w, h, 18); X.fill();
    rrp(x - w / 2, y - h / 2, w, h, 18); ink('#fff', 4); ctx.beginPath(); ctx.moveTo(x - 12, b - 4); ctx.lineTo(x + 4, b + 20); ctx.lineTo(x + 14, b - 4); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x - 12, b); ctx.lineTo(x + 4, b + 20); ctx.lineTo(x + 14, b); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    L.forEach((l, i) => ctx.fillText(l, x, y + 1 + (i - (L.length - 1) / 2) * 24, w - 22));
  }

  BOSSES.tiles = function (sp, s) {
    const steps = sp >= 1.599 ? 5 : sp >= 1.299 ? 4 : 3, grid = [1, 2, 3, 4, 5, 6, 7, 8, 0], tiles = [];
    let gap = 8, moves = 0, clk = 0, ptr = null, cheer = 0, aha = 0, winT = -1, loseT = -1, winAt = -1, nudge = [0, 0], hover = -1;
    do {                                                             // scramble: legal walk, never undoing the last move; keep it only if
      grid.splice(0, 9, 1, 2, 3, 4, 5, 6, 7, 8, 0); gap = 8; let prev = -1;      // the shortest solution really is `steps` moves
      for (let i = 0; i < steps; i++) { const opts = nbrs(gap).filter(c => c !== prev), c = opts[Math.random() * opts.length | 0]; grid[gap] = grid[c]; grid[c] = 0; prev = gap; gap = c; }
    } while (solve(grid.join(''))[1] !== steps);
    for (let c = 0; c < 9; c++) if (grid[c]) { const [x, y] = cxy(c); tiles[grid[c]] = { n: grid[c], c, x, y, sx: x, sy: y, k: 1, pop: 0, wob: 0 }; }
    const ok = tl => tl.c === tl.n - 1;
    const slide = c => {
      if (g.result || c < 0 || c > 8 || !grid[c]) return;
      const tl = tiles[grid[c]];
      if (!adj(c, gap)) { tl.wob = .3; sfx.miss(); return; }                     // not next to the gap: wobble "no"
      const was = ok(tl); grid[gap] = tl.n; grid[c] = 0; tl.c = gap; gap = c; moves++;
      tl.sx = tl.x; tl.sy = tl.y; tl.k = 0; tl.pop = 1; clack(moves % 6);
      const [x, y] = cxy(tl.c);
      if (ok(tl)) { sfx.blip(4 + tiles.filter(t => t && ok(t)).length); aha = .5; cheer = .35; burst(x + C / 2, y + C / 2, '#7BD88F', 8, 200); }
      else if (was) sfx.blip(-5);
      if (grid.join('') === GOAL) {
        g.result = 'win'; winT = 0; winAt = clk; mkChord([1047, 1319, 1568, 2093], .6, 'triangle', .05, .1); sfx.sparkle(); shake(12, .4);
        confetti(400, 330, 60); ring(400, 330, '#FFE14D', 260, .6); floatText('GENIUS!', 400, 128, '#FFE14D', 52);
      }
    };
    const press = code => {                                          // arrow = the way the tile moves (into the gap)
      const d = DIR[code]; if (!d || g.result) return;
      const gx = gap % 3 - d[0], gy = (gap / 3 | 0) - d[1];
      if (gx < 0 || gx > 2 || gy < 0 || gy > 2) { nudge = [d[0] * 8, d[1] * 8]; snd(140, .06, 'square', .05); return; }
      slide(gy * 3 + gx);
    };
    const cellAt = p => { const i = Math.floor((p.x - BX) / C), j = Math.floor((p.y - BY) / C); return i >= 0 && i < 3 && j >= 0 && j < 3 ? j * 3 + i : -1; };
    const g = {
      cmd: 'BOSS!', hint: 'SLIDE INTO ORDER (OR ↑↓←→)!', thint: 'SLIDE THE TILES INTO ORDER!', dur: 10, boss: true, wide: true, swipe: true,
      key(e) {
        if (e.key === '') { if (!ptr || ptr.used) return; ptr.used = true; }   // a swipe slides one tile per drag
        press(e.code);
      },
      down(p) { ptr = { c: cellAt(p), used: false }; },
      move(p) { hover = cellAt(p); },
      up() { if (ptr && !ptr.used) slide(ptr.c); ptr = null; },
      update(dt) {
        clk += dt; cheer = Math.max(0, cheer - dt); aha = Math.max(0, aha - dt); nudge = nudge.map(v => v * Math.pow(.001, dt));
        for (const tl of tiles) if (tl) {
          tl.k = Math.min(1, tl.k + dt / SLIDE); tl.pop = Math.max(0, tl.pop - dt * 5); tl.wob = Math.max(0, tl.wob - dt);
          const [x, y] = cxy(tl.c), e = 1 - Math.pow(1 - tl.k, 3); tl.x = tl.sx + (x - tl.sx) * e; tl.y = tl.sy + (y - tl.sy) * e;
        }
        if (winT >= 0) winT += dt;
        if (g.result === 'lose' && loseT < 0) { loseT = 0; sfx.buzz(); shake(8, .3); }
        if (loseT >= 0) loseT += dt;
      },
      draw(t) {
        const GX = 686 + Math.min(OX, 80) * .5, AX = 112 - Math.min(OX, 80) * .5;
        ctx.drawImage(baked(scene), -OX, 0);
        // bubbling flasks on the floor, only in the extra wide margins
        for (const [fx, col] of [[-OX + 52, '#4DB8FF'], [W + OX - 56, '#FF4D9E'], [-OX + 120, '#FFE14D'], [W + OX - 128, '#7BD88F']]) {
          if (fx > AX - 90 && fx < GX + 90) continue;
          X.beginPath(); X.moveTo(fx - 10, 450); X.lineTo(fx - 10, 478); X.lineTo(fx - 32, 516); X.lineTo(fx + 32, 516); X.lineTo(fx + 10, 478); X.lineTo(fx + 10, 450); X.closePath();
          ink('rgba(255,255,255,.45)', 5); X.fillStyle = col; X.beginPath(); X.moveTo(fx - 22, 498); X.lineTo(fx + 22, 498); X.lineTo(fx + 31, 514); X.lineTo(fx - 31, 514); X.closePath(); X.fill();
          X.fillStyle = 'rgba(255,255,255,.55)'; el(fx - 14, 486, 4, 9, .2); X.fill();
          for (let b = 0; b < 3; b++) { const u = (clk * .8 + b / 3 + fx * .01) % 1; ctx.globalAlpha = 1 - u; celC(fx + Math.sin(u * 9 + b) * 6, 446 - u * 60, 4 + b, col, 2, false); ctx.globalAlpha = 1; }
        }
        // HUD: move counter on a plate (GENIUS! takes its place on a win)
        if (winT < 0) {
          const mt = window.t('MOVES {n}', { n: moves }); X.font = '700 24px Fredoka, "Helvetica Neue", Arial, sans-serif'; const mw = X.measureText(mt).width + 44;
          X.fillStyle = 'rgba(20,16,28,.3)'; rrp(400 - mw / 2 + 3, 110, mw, 32, 16); X.fill(); rrp(400 - mw / 2, 106, mw, 32, 16); ink('#fff7e0', 4);
          X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(mt, 400, 123);
        }
        if (winT >= 0) { X.save(); X.translate(400, 330); X.rotate(winT * .6); X.fillStyle = 'rgba(255,240,150,.22)'; for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-26, 60); X.lineTo(26, 60); X.lineTo(0, 300); X.fill(); } X.restore(); }
        // the board: a wooden tray with nine wells
        ctx.save(); ctx.translate(nudge[0] + (loseT >= 0 && loseT < .5 ? Math.sin(loseT * 80) * 6 : 0), nudge[1]);
        X.fillStyle = 'rgba(20,16,28,.3)'; rrp(BX - 10, BY - 8, C * 3 + 32, C * 3 + 32, 24); X.fill();
        celRR(BX - 16, BY - 16, C * 3 + 32, C * 3 + 32, 24, '#a5622c', 6, false);
        X.fillStyle = '#5a3a22'; for (let c = 0; c < 9; c++) { const [x, y] = cxy(c); rrp(x + 4, y + 4, C - 8, C - 8, 14); X.fill(); }
        X.fillStyle = 'rgba(0,0,0,.3)'; for (let c = 0; c < 9; c++) { const [x, y] = cxy(c); rrp(x + 4, y + 4, C - 8, 14, 10); X.fill(); }
        if (winT >= 0) { const [x, y] = cxy(8), sc = easeBack(winT / .4); star(x + C / 2, y + C / 2, 44 * sc, 20 * sc, 5, -Math.PI / 2 + winT * 2, '#FFE14D', 5); }
        else if (!g.result && TOUCH === false && hover >= 0 && grid[hover] && adj(hover, gap)) { const [x, y] = cxy(hover); X.fillStyle = 'rgba(255,225,77,.35)'; rrp(x + 2, y + 2, C - 4, C - 4, 16); X.fill(); }
        for (const tl of tiles) if (tl) {
          const good = ok(tl), wave = winT >= 0 ? Math.max(0, 1 - Math.abs(winT * 6 - tl.n * .5)) : 0;
          const lift = TOUCH === false && !g.result && adj(tl.c, gap) && hover === tl.c && tl.k >= 1 ? 4 : 0, sc = 1 + tl.pop * .08 + wave * .12;
          const x = tl.x + C / 2 + (tl.wob > 0 ? Math.sin(tl.wob * 70) * 7 : 0), y = tl.y + C / 2 - lift - wave * 14;
          ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
          if (good && !g.result) { ctx.globalAlpha = .35 + .2 * Math.sin(clk * 6 + tl.n); rrp(-C / 2 - 2, -C / 2 - 2, C + 4, C + 4, 20); X.fillStyle = '#c8ff7a'; X.fill(); ctx.globalAlpha = 1; }
          const face = loseT >= 0 ? '#c9b7b7' : winT >= 0 && (winT * 12 + tl.n | 0) % 2 ? '#ffffff' : good ? '#7BD88F' : '#fdf0cf', side = loseT >= 0 ? '#8a7676' : good ? '#3f9a55' : '#d6a85c';
          celRR(-C / 2 + 6, -C / 2 + 12, C - 12, C - 14, 16, side, 4.5, false); celRR(-C / 2 + 6, -C / 2 + 6, C - 12, C - 18, 16, face, 4.5);
          num(String(tl.n), 0, -6, 54, good ? '#fff' : INK, good ? 10 : 0);
          ctx.restore();
        }
        if (!g.result) for (const c of nbrs(gap)) if (grid[c]) {                    // little chevrons: "this one can slide"
          const [x, y] = cxy(c), [gx, gy] = cxy(gap), dx = Math.sign(gx - x), dy = Math.sign(gy - y), p = Math.sin(clk * 8) * 3;
          const ax = x + C / 2 + dx * (C / 2 - 12 + p), ay = y + C / 2 + dy * (C / 2 - 12 + p) - 4;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(dy, dx)); ctx.beginPath(); ctx.moveTo(-5, -9); ctx.lineTo(5, 0); ctx.lineTo(-5, 9);
          ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); ctx.restore(); ctx.lineCap = 'butt';
        }
        ctx.restore();
        // the GOAL card (right), taped to the board, with Claude in a lab coat under it
        X.fillStyle = 'rgba(20,16,28,.3)'; rrp(GX - 62, 198, 132, 150, 8); X.fill();
        celRR(GX - 66, 190, 132, 150, 8, '#fff7e0', 4.5, false); celRR(GX - 20, 180, 40, 16, 3, '#ffe98a', 2, false); txt('GOAL', GX, 210, 22, '#FFE14D');
        for (let c = 0; c < 8; c++) { const x = GX - 51 + (c % 3) * 34, y = 228 + (c / 3 | 0) * 34, hit = grid[c] === c + 1;
          celRR(x + 2, y + 2, 30, 30, 7, hit ? '#7BD88F' : '#fdf0cf', 3, false); num(String(c + 1), x + 17, y + 18, 18, INK, 0); }
        const cy = 516 - Math.abs(Math.sin(cheer * 9)) * 18 * (cheer > 0 ? 1 : 0) - (winT >= 0 ? Math.abs(Math.sin(clk * 10)) * 16 : 0), U = 7;
        shadow(GX, 518, 46, 9, .35);
        {                                                                      // blocky arms (hippo.js arms): cheer on a win, slump on a loss
          const up = winT >= 0 ? .4 + Math.sin(clk * 14) * .2 : loseT >= 0 ? 2.9 : 2.35;
          const aa = (sx, an) => { ctx.save(); ctx.translate(GX + sx * 6.6 * U, cy - 5.2 * U); ctx.rotate(an); const L = 3.3 * U, aw = 1.2 * U, hs = 2 * U, ol = Math.max(3, U * .5);
            ctx.fillStyle = INK; ctx.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); ctx.fillRect(-hs / 2 - ol, -L - .35 * U - hs - ol, hs + ol * 2, hs + ol * 2);
            ctx.fillStyle = OR; ctx.fillRect(-aw / 2, -L, aw, L); ctx.fillRect(-hs / 2, -L - .35 * U - hs, hs, hs); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-hs / 2, -L - .35 * U - hs, hs * .45, hs * .4); ctx.restore(); };
          aa(-1, -up); aa(1, up);
        }
        claude(GX, cy, U, { mood: winT >= 0 ? 'happy' : loseT >= 0 ? 'sad' : null });
        const cl = (x, w) => { ctx.fillStyle = INK; ctx.fillRect(x - 3, cy - 4.2 * U - 3, w + 6, 2.2 * U + 6); ctx.fillStyle = '#f4f6fb'; ctx.fillRect(x, cy - 4.2 * U, w, 2.2 * U); ctx.fillStyle = 'rgba(20,16,28,.14)'; ctx.fillRect(x + w * .62, cy - 4.2 * U, w * .38, 2.2 * U); };
        cl(GX - 6 * U, 3.8 * U); cl(GX + 2.2 * U, 3.8 * U); celRR(GX + 4.2 * U, cy - 5 * U, 4, 1.2 * U, 2, '#4DB8FF', 2, false);   // lab coat + pen
        celRR(GX - 6 * U, cy - 9.4 * U, 12 * U, 4, 2, '#4a3a66', 2, false); for (const sd of [-1, 1]) celC(GX + sd * 2.8 * U, cy - 9 * U, 1.3 * U, '#9fe3ff', 3);   // goggles on the forehead
        pill(GX, cy - 9.4 * U - 22, 'CLAUDE', '#FFE14D');
        if (winT >= 0) for (let i = 0; i < 2; i++) { const k = (winT * 1.4 + i * .5) % 1; ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(GX + (i ? 44 : -44), cy - 9.4 * U - 44 - k * 40); ctx.scale(.9, .9); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath(); ink('#ff5c8a', 3); ctx.restore(); }
        // the alien host (left) + speech
        shadow(AX, 518, 56, 10, .35); alien(AX, 518, loseT >= 0 ? 'laugh' : winT >= 0 ? 'shock' : aha > 0 ? 'aha' : 'think', clk, winT >= 0 ? 1 : 0);
        pill(AX, 518 - 250, 'DR. BRAIN', '#9be07a');
        const say = loseT >= 0 ? 'TOO SLOW!' : winT >= 0 ? 'IMPOSSIBLE!' : clk < 2.2 ? 'SOLVE IT, EARTHLING!' : null;
        if (say) bubble(AX + 6, 196, say, 190 + Math.min(OX, 80) * .5);
        vignette(.22);
      },
      probe: () => {
        const [nx, left] = g.result ? [-1, 0] : solve(grid.join('')), d = nx < 0 ? null : [gap % 3 - nx % 3, (gap / 3 | 0) - (nx / 3 | 0)];
        const press = d ? (d[0] > 0 ? 'ArrowRight' : d[0] < 0 ? 'ArrowLeft' : d[1] > 0 ? 'ArrowDown' : 'ArrowUp') : null;
        return { phase: g.result || 'play', grid: grid.slice(), gap, moves, steps, left, next: nx, press, tap: nx < 0 ? null : [cxy(nx)[0] + C / 2, cxy(nx)[1] + C / 2],
          cells: Array.from({ length: 9 }, (_, c) => [cxy(c)[0] + C / 2, cxy(c)[1] + C / 2]), sliding: tiles.some(tl => tl && tl.k < 1), winAt: +winAt.toFixed(2), result: g.result || null };
      }
    };
    return g;
  };
})();
