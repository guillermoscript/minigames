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
  const rr = (x, y, w, h, r, fill, o) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (o) { ctx.lineWidth = o; ctx.strokeStyle = INK; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); };
  const clack = n => { snd(260 + n * 30, .05, 'triangle', .09, 0, 160); noise(.05, .06, 1800, 900, 'bandpass'); };

  function alien(x, y, mood, k, zap) {                               // an Orbulon-ish brainiac in a purple robe
    const bob = Math.sin(k * 2.4) * 3, hy = y - 150 + bob;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(x - 50, y); ctx.lineTo(x - 28, y - 112); ctx.lineTo(x + 28, y - 112); ctx.lineTo(x + 50, y); ctx.closePath();
    ctx.lineWidth = 7; ctx.stroke(); ctx.fillStyle = '#6a3fb5'; ctx.fill();
    ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(x - 30, y - 110); ctx.lineTo(x, y - 82); ctx.lineTo(x + 30, y - 110); ctx.closePath(); ctx.lineWidth = 5; ctx.stroke(); ctx.fill();
    const arm = (sx, ex, ey) => { ctx.beginPath(); ctx.moveTo(x + sx, y - 96); ctx.quadraticCurveTo(x + sx * 1.9, (y - 96 + ey) / 2 + 20, ex, ey); ctx.lineWidth = 15; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = '#9be07a'; ctx.stroke(); circ(ex, ey, 7, '#9be07a', 4); };
    if (mood === 'laugh') { arm(-26, x - 64, y - 190 + Math.sin(k * 30) * 6); arm(26, x + 64, y - 190 - Math.sin(k * 30) * 6); }
    else if (mood === 'shock') { arm(-26, x - 46, hy - 50); arm(26, x + 46, hy - 50); }
    else { arm(-26, x - 40, y - 40); arm(26, x + 8, hy + 40); }                    // hand on chin: thinking
    ctx.beginPath(); ctx.ellipse(x, hy, 46, 40, 0, 0, 7); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#9be07a'; ctx.fill();
    const by = hy - 46, bs = 1 + (mood === 'aha' ? .08 : 0) + zap * .15;           // the giant brain
    ctx.beginPath(); ctx.ellipse(x, by, 54 * bs, 38 * bs, 0, 0, 7); ctx.lineWidth = 7; ctx.stroke(); ctx.fillStyle = zap > 0 && (k * 20 | 0) % 2 ? '#fff' : '#ff9ad5'; ctx.fill();
    ctx.strokeStyle = '#d0569c'; ctx.lineWidth = 4;
    for (const [a, b, c] of [[-34, -10, 8], [-10, -24, -6], [14, -8, 10], [30, -18, -4], [-24, 14, 6], [6, 16, -8]]) { ctx.beginPath(); ctx.moveTo(x + a * bs, by + b * bs); ctx.quadraticCurveTo(x + (a + 10) * bs, by + (b + c) * bs, x + (a + 20) * bs, by + b * bs); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, by - 2, 64, 50, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 30, by - 22, 9, Math.PI, Math.PI * 1.5); ctx.stroke();
    if (zap > 0) for (let i = 0; i < 4; i++) {                                     // fried brain: zigzag sparks
      const a = i * 1.6 + k * 6, r = 60 + Math.sin(k * 40 + i) * 6; ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 5; ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 46, by + Math.sin(a) * 30); ctx.lineTo(x + Math.cos(a + .2) * r, by + Math.sin(a + .2) * r * .7); ctx.lineTo(x + Math.cos(a - .1) * (r + 14), by + Math.sin(a - .1) * (r + 14) * .7); ctx.stroke(); }
    for (const sd of [-1, 1]) {                                                    // eyes + mouth by mood
      const ex = x + sd * 18, ey = hy - 2;
      if (mood === 'laugh') { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex - 9, ey + 4); ctx.lineTo(ex, ey - 5); ctx.lineTo(ex + 9, ey + 4); ctx.stroke(); }
      else if (mood === 'shock') { circ(ex, ey, 13, '#fff', 4); circ(ex + Math.sin(k * 50) * 2, ey, 3, INK, 0); }
      else { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, 11, mood === 'aha' ? 17 : 15, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 4, ey - 6, 4, 0, 7); ctx.fill(); }
    }
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 5; const my = hy + 24;
    if (mood === 'laugh') { ctx.beginPath(); ctx.arc(x, my - 4, 14, 0, Math.PI); ctx.closePath(); ctx.fill(); }
    else if (mood === 'shock') { ctx.beginPath(); ctx.ellipse(x, my, 8, 11 + Math.sin(k * 30) * 2, 0, 0, 7); ctx.fill(); }
    else if (mood === 'aha') { ctx.beginPath(); ctx.arc(x, my, 6, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x - 12, my); for (let i = 1; i <= 4; i++) ctx.lineTo(x - 12 + i * 6, my + (i % 2 ? 3 : -1)); ctx.stroke(); }
    ctx.lineCap = 'butt';
  }
  function bubble(x, y, s, w) {                                      // wraps onto two lines instead of shrinking the text
    s = window.t(s); ctx.font = '700 20px Fredoka, "Helvetica Neue", Arial, sans-serif'; let L = [s];
    if (ctx.measureText(s).width > w - 26) { const sp = [...s.matchAll(/ /g)].map(m => m.index).sort((a, b) => Math.abs(a - s.length / 2) - Math.abs(b - s.length / 2))[0];
      if (sp) L = [s.slice(0, sp), s.slice(sp + 1)]; }
    const h = 28 + L.length * 24, b = y + h / 2;
    rr(x - w / 2, y - h / 2, w, h, 18, '#fff', 8); ctx.beginPath(); ctx.moveTo(x - 12, b - 4); ctx.lineTo(x + 4, b + 20); ctx.lineTo(x + 14, b - 4); ctx.fillStyle = '#fff'; ctx.fill();
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
        bg('#1f4536', '#24503f', t);
        // chalk doodles across the whole (wide) board, a lab desk with bubbling flasks
        ctx.font = '700 30px Fredoka, "Comic Sans MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,.16)';
        let di = 0; for (let y = 172; y < 500; y += 108) for (let x = -OX + 70 + (y / 108 & 1) * 70; x < W + OX - 40; x += 175, di++) {
          if (Math.abs(x - 400) < 230 || di % 3 === 2) continue; ctx.save(); ctx.translate(x, y); ctx.rotate((di % 3 - 1) * .12); ctx.fillText(DOODLES[di % DOODLES.length], 0, 0); ctx.restore(); }
        ctx.fillStyle = '#6b4426'; ctx.fillRect(-OX, 520, VW, 80); ctx.fillStyle = '#835532'; ctx.fillRect(-OX, 520, VW, 12); ctx.fillStyle = INK; ctx.fillRect(-OX, 516, VW, 6);
        for (const [fx, col] of [[-OX + 52, '#4DB8FF'], [W + OX - 56, '#FF4D9E'], [-OX + 120, '#FFE14D'], [W + OX - 128, '#7BD88F']]) {
          if (fx > AX - 90 && fx < GX + 90) continue;                              // only in the extra wide margins
          ctx.beginPath(); ctx.moveTo(fx - 10, 450); ctx.lineTo(fx - 10, 478); ctx.lineTo(fx - 32, 516); ctx.lineTo(fx + 32, 516); ctx.lineTo(fx + 10, 478); ctx.lineTo(fx + 10, 450); ctx.closePath();
          ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx - 22, 498); ctx.lineTo(fx + 22, 498); ctx.lineTo(fx + 31, 514); ctx.lineTo(fx - 31, 514); ctx.closePath(); ctx.fill();
          for (let b = 0; b < 3; b++) { const u = (clk * .8 + b / 3 + fx * .01) % 1; ctx.globalAlpha = 1 - u; circ(fx + Math.sin(u * 9 + b) * 6, 446 - u * 60, 4 + b, col, 2); ctx.globalAlpha = 1; }
        }
        // HUD: move counter (GENIUS! takes its place on a win)
        if (winT < 0) txt(window.t('MOVES {n}', { n: moves }), 400, 122, 30, '#fff');
        // the board
        ctx.save(); ctx.translate(nudge[0] + (loseT >= 0 && loseT < .5 ? Math.sin(loseT * 80) * 6 : 0), nudge[1]);
        box3(BX - 16, BY - 16, C * 3 + 32, C * 3 + 32, '#2d2140', 6, 8);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let c = 0; c < 9; c++) { const [x, y] = cxy(c); ctx.beginPath(); ctx.roundRect(x + 6, y + 6, C - 12, C - 12, 14); ctx.fill(); }
        if (winT >= 0) { const [x, y] = cxy(8), sc = easeBack(winT / .4); star(x + C / 2, y + C / 2, 44 * sc, 20 * sc, 5, -Math.PI / 2 + winT * 2, '#FFE14D', 5); }
        else if (!g.result && TOUCH === false && hover >= 0 && grid[hover] && adj(hover, gap)) { const [x, y] = cxy(hover); ctx.fillStyle = 'rgba(255,225,77,.3)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, C - 4, C - 4, 16); ctx.fill(); }
        for (const tl of tiles) if (tl) {
          const good = ok(tl), wave = winT >= 0 ? Math.max(0, 1 - Math.abs(winT * 6 - tl.n * .5)) : 0;
          const lift = TOUCH === false && !g.result && adj(tl.c, gap) && hover === tl.c && tl.k >= 1 ? 4 : 0, sc = 1 + tl.pop * .08 + wave * .12;
          const x = tl.x + C / 2 + (tl.wob > 0 ? Math.sin(tl.wob * 70) * 7 : 0), y = tl.y + C / 2 - lift - wave * 14;
          ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
          if (good && !g.result) { ctx.globalAlpha = .35 + .2 * Math.sin(clk * 6 + tl.n); rr(-C / 2 - 2, -C / 2 - 2, C + 4, C + 4, 20, '#c8ff7a', 0); ctx.globalAlpha = 1; }
          const face = loseT >= 0 ? '#c9b7b7' : winT >= 0 && (winT * 12 + tl.n | 0) % 2 ? '#fff' : good ? '#7BD88F' : '#fdf0cf', side = loseT >= 0 ? '#8a7676' : good ? '#3f9a55' : '#d6a85c';
          rr(-C / 2 + 6, -C / 2 + 6, C - 12, C - 12, 16, side, 7); rr(-C / 2 + 9, -C / 2 + 9, C - 18, C - 26, 12, face, 0);
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-C / 2 + 20, -C / 2 + 13, C - 52, 6);
          num(String(tl.n), 0, -4, 54, good ? '#fff' : INK, good ? 10 : 0);
          ctx.restore();
        }
        if (!g.result) for (const c of nbrs(gap)) if (grid[c]) {                    // little chevrons: "this one can slide"
          const [x, y] = cxy(c), [gx, gy] = cxy(gap), dx = Math.sign(gx - x), dy = Math.sign(gy - y), p = Math.sin(clk * 8) * 3;
          const ax = x + C / 2 + dx * (C / 2 - 12 + p), ay = y + C / 2 + dy * (C / 2 - 12 + p) - 4;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(dy, dx)); ctx.beginPath(); ctx.moveTo(-5, -9); ctx.lineTo(5, 0); ctx.lineTo(-5, 9);
          ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); ctx.restore(); ctx.lineCap = 'butt';
        }
        ctx.restore();
        // the GOAL card (right) with Claude in a lab coat under it
        box3(GX - 66, 190, 132, 150, '#fff7e0', 5, 6); txt('GOAL', GX, 210, 22, '#FFE14D');
        for (let c = 0; c < 8; c++) { const x = GX - 51 + (c % 3) * 34, y = 228 + (c / 3 | 0) * 34, hit = grid[c] === c + 1;
          rr(x + 2, y + 2, 30, 30, 6, hit ? '#7BD88F' : '#fdf0cf', 4); num(String(c + 1), x + 17, y + 18, 18, INK, 0); }
        const cy = 516 - Math.abs(Math.sin(cheer * 9)) * 18 * (cheer > 0 ? 1 : 0) - (winT >= 0 ? Math.abs(Math.sin(clk * 10)) * 16 : 0), U = 7;
        shadow(GX, 518, 46, 9, .35); claude(GX, cy, U, { mood: winT >= 0 ? 'happy' : loseT >= 0 ? 'sad' : null });
        const cl = (x, w) => { ctx.fillStyle = INK; ctx.fillRect(x - 3, cy - 4.2 * U - 3, w + 6, 2.2 * U + 6); ctx.fillStyle = '#f4f6fb'; ctx.fillRect(x, cy - 4.2 * U, w, 2.2 * U); };
        cl(GX - 6 * U, 3.8 * U); cl(GX + 2.2 * U, 3.8 * U); box(GX + 4.2 * U, cy - 5 * U, 4, 1.2 * U, '#4DB8FF', 2);   // lab coat + pen
        box(GX - 6 * U, cy - 9.4 * U, 12 * U, 4, '#4a3a66', 2); for (const sd of [-1, 1]) circ(GX + sd * 2.8 * U, cy - 9 * U, 1.3 * U, '#9fe3ff', 4);                                          // goggles on the forehead
        // the alien host (left) + speech
        shadow(AX, 518, 56, 10, .35); alien(AX, 518, loseT >= 0 ? 'laugh' : winT >= 0 ? 'shock' : aha > 0 ? 'aha' : 'think', clk, winT >= 0 ? 1 : 0);
        const say = loseT >= 0 ? 'TOO SLOW!' : winT >= 0 ? 'IMPOSSIBLE!' : clk < 2.2 ? 'SOLVE IT, EARTHLING!' : null;
        if (say) bubble(AX + 6, 196, say, 190 + Math.min(OX, 80) * .5);
        vignette(.3);
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
