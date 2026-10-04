'use strict';
/* SORT boss (CRITTER CLUB): critters waddle out of the barn one at a time; send each to its pen, SHEEP left, PIGS right.
   After Smooth Moves' "Toilet Training" (point each person to the right door). 12 sorted wins; one critter in the wrong
   pen (chaos!) or one left waiting too long loses. The last three may come disguised: a pig in a wool coat, a sheep with
   a pink bow. The FACE always tells the truth (dark face = sheep, pink snout = pig). */
(function () {
  const FX = 400, FY = 440, DY = 238, NEED = 12, RUSH = 6, SLOTS = [1, .56, .27, .05], CY = 548;
  const PINK = '#FFA3C2', P2 = '#F57FA8', FACE = '#3b3340', DIRT = '#dcaa6e', WOOD = '#c98a4b';
  const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R' };
  const GATE = { L: [250, 478], R: [550, 478] };
  const at = u => [FX, DY + (FY - DY) * u, .42 + .58 * u];                       // path point + perspective scale
  const pen = sd => sd === 'L' ? [-OX + 24, 250] : [550, W + OX - 24];             // pen x-range (y 300..540)
  const WOOL = [[0, -50, 30], [-27, -44, 19], [27, -44, 19], [-20, -66, 18], [20, -66, 18], [0, -74, 18], [-19, -27, 17], [19, -27, 17], [0, -24, 19]];
  const blob = (x, y, rx, ry, fill, rot = 0, o = 4) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); };
  const wool = (pts, fill) => {                                                     // union of puffs with one outline
    ctx.lineWidth = 9; ctx.strokeStyle = INK; for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
    ctx.fillStyle = fill; for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(20,16,28,.07)'; for (const [x, y, r] of pts) { ctx.beginPath(); ctx.arc(x + r * .25, y + r * .3, r * .55, 0, 7); ctx.fill(); }
  };
  const raw = (s, x, y, size, fill) => { ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size / 5; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y); };
  const baa = () => { for (let i = 0; i < 4; i++) snd(470 + (i % 2) * 45, .07, 'sawtooth', .04, i * .055); snd(490, .2, 'sawtooth', .035, .22, 400); };
  const oink = () => { snd(260, .07, 'square', .05, 0, 170); snd(235, .11, 'square', .05, .09, 140); noise(.07, .05, 500, 300, 'bandpass', .09); };

  function eyes(x, y, r, mood) {
    for (const sd of [-1, 1]) { const ex = x + sd * r * 1.45;
      if (mood === 'happy') { ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, y + 2, r * .75, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.lineCap = 'butt'; }
      else { circ(ex, y, mood === 'scared' ? r * 1.35 : r, '#fff', 2.5); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, y + (mood === 'scared' ? 0 : 1), mood === 'scared' ? r * .4 : r * .58, 0, 7); ctx.fill(); }
    }
  }
  /* front-facing critter, feet at (x, y) */
  function critter(c, x, y, s, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); const sq = c.sq || 0; ctx.scale(s * (1 + sq * .22), s * (1 - sq * .2));
    const w = o.walk != null ? Math.sin(o.walk * 17) : 0; ctx.translate(0, -Math.abs(w) * 6);
    const sheep = c.kind === 'sheep', leg = sheep ? FACE : P2, mood = o.mood;
    box(-24, -24 - Math.max(0, w) * 7, 12, 24, leg, 3); box(12, -24 - Math.max(0, -w) * 7, 12, 24, leg, 3);
    if (sheep || c.dis) wool(WOOL, '#fff'); else { blob(0, -44, 41, 35, PINK); blob(0, -36, 24, 16, '#ffc2d6', 0, 0); }
    if (sheep) {
      blob(-30, -72, 15, 7, FACE, -.45, 3); blob(30, -72, 15, 7, FACE, .45, 3);
      blob(0, -68, 20, 25, FACE);
      wool([[-11, -90, 10], [0, -95, 11], [11, -90, 10]], '#fff');
      eyes(0, -70, 5.5, mood); blob(-12, -58, 4, 2.5, '#ff8fb0', 0, 0); blob(12, -58, 4, 2.5, '#ff8fb0', 0, 0);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -55, 4, .3, Math.PI - .3); ctx.stroke();
      if (c.dis) { blob(-13, -97, 13, 9, '#ff5fa2', .4, 3); blob(13, -97, 13, 9, '#ff5fa2', -.4, 3); circ(0, -97, 6, '#ff8fc0', 3); }   // the pink bow
    } else {
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 12, -88); ctx.lineTo(sd * 32, -104); ctx.lineTo(sd * 30, -78); ctx.closePath(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = P2; ctx.fill(); }
      blob(0, -68, 30, 27, PINK);
      if (c.dis) wool([[-12, -94, 9], [0, -98, 10], [12, -94, 9]], '#fff');                    // fake wool wig
      eyes(0, -76, 5, mood); blob(-19, -62, 5, 3, '#ff6f9a', 0, 0); blob(19, -62, 5, 3, '#ff6f9a', 0, 0);
      blob(0, -60, 15, 11, P2, 0, 3); ctx.fillStyle = INK; blob(-5, -60, 2.6, 4, INK, 0, 0); blob(5, -60, 2.6, 4, INK, 0, 0);
    }
    if (o.sweat) { ctx.fillStyle = '#6ec6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; const yy = -96 + (now * 60 % 20); ctx.beginPath(); ctx.arc(30, yy, 5, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function rail(xa, ya, xb, yb) { ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke(); ctx.strokeStyle = WOOD; ctx.lineWidth = 7; ctx.stroke(); ctx.lineCap = 'butt'; }
  const post = (x, y) => box(x - 6, y - 28, 12, 32, '#a86b3c', 3);
  function fenceH(x0, x1, y) { rail(x0, y - 18, x1, y - 18); rail(x0, y - 6, x1, y - 6); for (let x = x0; x <= x1 + 1; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 56))) post(x, y); }
  function fenceV(x, y0, y1) { rail(x, y0 - 12, x, y1 - 12); for (let y = y0; y <= y1 + 1; y += (y1 - y0) / Math.max(1, Math.round((y1 - y0) / 44))) post(x, y); }

  BOSSES.sort = function (sp, s) {
    const k = Math.sqrt(Math.min(sp, 1.8));
    let f = 0, sorted = 0, clk = 0, point = 0, pointT = 0, hop = 0, knock = 0, ptr = null, ticked = false, why = null;
    const pops = [], buf = [];                                                        // buf: early presses, one per critter, in order
    const crits = []; let last = null, run = 0;
    for (let i = 0; i < NEED; i++) {
      let kind = Math.random() < .5 ? 'sheep' : 'pig'; if (kind === last && run >= 2) kind = kind === 'sheep' ? 'pig' : 'sheep';
      run = kind === last ? run + 1 : 1; last = kind;
      crits.push({ kind, dis: i >= NEED - 3 && Math.random() < .55, st: 'q', u: i === 0 ? .3 : SLOTS[i] || 0, sq: 0, walk: null, ph: Math.random() * 6 });
    }
    if (!crits.slice(-3).some(c => c.dis)) crits[NEED - 2].dis = true;
    crits[RUSH].rush = true;                                                          // mid-run twist: this one comes sprinting
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 260, y: 30 + (i * 37) % 90, v: 12 + i * 3, s: .7 + (i % 3) * .2 }));
    const front = () => crits[f];
    const ready = c => c && !g.result && (c.st === 'wait' || (c.st === 'q' && c.u > .72));
    const choose = side => {                                                         // every press sends one critter; early ones wait their turn
      const c = front(); if (!c || g.result) return false;
      if (ready(c) && !buf.length) { decide(side); return true; }
      if (buf.length >= 2) return false;
      buf.push(side); point = side === 'L' ? -1 : 1; pointT = .35; sfx.tick(); return true;
    };
    const decide = side => {
      const c = front(); if (!ready(c)) return;
      [c.x, c.y, c.s] = at(c.u); c.from = [c.x, c.y, c.s]; c.st = 'go'; c.side = side; c.t = 0; c.walk = 0;
      c.ok = (side === 'L') === (c.kind === 'sheep'); point = side === 'L' ? -1 : 1; pointT = .35; sfx.whoosh(); ticked = false;
      if (c.ok) {
        sorted++; f++; hop = .25; c.sq = .4; (c.kind === 'sheep' ? baa : oink)(); sfx.blip(sorted * 1.5);
        const [x0, x1] = pen(side); c.tx = x0 + 45 + Math.random() * (x1 - x0 - 90); c.ty = 350 + Math.random() * 165;
        pops.push({ s: window.t(c.kind === 'sheep' ? 'BAA!' : 'OINK!'), x: c.tx, y: Math.max(320, c.ty - 100), t: 0 }); burst(FX, FY - 50, '#FFE14D', 10); ring(FX, FY - 50, '#fff', 80, .3);
        if (sorted >= NEED) { g.result = 'win'; why = 'ALL SORTED!'; sfx.sparkle(); confetti(FX, 300, 60); ring(FX, 300, '#FFE14D', 220, .6); shake(8, .3); }
      } else { g.result = 'lose'; why = 'WRONG PEN!'; sfx.buzz(); }
    };
    const chaos = c => {                                                              // the wrong critter wrecks the pen
      c.st = 'bad'; c.vx = (c.side === 'L' ? -1 : 1) * 420; c.vy = -300; shake(14, .45); sfx.thud(); sfx.splat(); noise(.4, .15, 500, 150, 'lowpass');
      (c.kind === 'sheep' ? baa : oink)(); burst(c.x, c.y - 40, c.kind === 'pig' ? '#fff' : '#7a4a26', 26, 440); burst(c.x, c.y - 40, WOOD, 10, 360); ring(c.x, c.y - 40, '#ff4d4d', 130, .5);
      for (const r of crits) if (r.st === 'in' && r.side === c.side) { r.scared = 1; r.vx = (Math.random() - .5) * 500; r.vy = -200 - Math.random() * 200; }
    };
    const g = {
      cmd: 'BOSS!', hint: 'SORT: ← SHEEP · PIGS →', thint: 'TAP: ← SHEEP · PIGS →', dur: 14, boss: true, wide: true, swipe: true,
      key(e) { const d = KEYS[e.code]; if (!d || (ptr && ptr.used)) return; if (choose(d) && ptr) ptr.used = true; },   // one swipe = one decision
      down(p) { ptr = { x: p.x, used: false }; },
      up(p) { if (ptr && !ptr.used) { const dx = p.x - ptr.x; choose(Math.abs(dx) < 40 ? (ptr.x < FX ? 'L' : 'R') : dx < 0 ? 'L' : 'R'); } ptr = null; },   // tap = half, flick = direction
      update(dt) {
        clk += dt; pointT = Math.max(0, pointT - dt); hop = Math.max(0, hop - dt); knock *= Math.pow(.05, dt);
        for (const c of clouds) c.x += c.v * dt;
        for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].t += dt) > .8) pops.splice(i, 1);
        crits.forEach((c, i) => {
          c.sq *= Math.pow(.003, dt);
          if (c.st === 'q') {
            const rush = c.rush && i === f, tgt = i - f < SLOTS.length ? SLOTS[i - f] : 0, d = tgt - c.u, v = (.85 + f * .11) * k * (rush ? 2.6 : 1) * dt;
            if (Math.abs(d) > .001) { c.u += Math.sign(d) * Math.min(Math.abs(d), v); c.walk = (c.walk || 0) + dt * (rush ? 1.6 : 1);
              if (rush && Math.random() < dt * 25) { const [x, y] = at(c.u); burst(x + (Math.random() - .5) * 40, y - 6, '#f0dcb4', 2, 90); } } else c.walk = null;
            if (i === f && c.u >= .999 && !g.result) { c.st = 'wait'; c.win = c.wt = Math.max(.85, 1.75 - f * .15) / k * (f ? 1 : 1.25) * (c.dis ? 1.12 : 1); c.sq = .5; c.walk = null; sfx.pop(); }
          } else if (c.st === 'go') {
            c.walk += dt;
            if (c.t < 1) { c.t = Math.min(1, c.t + dt / .32); const u = c.t, [ax, ay] = c.from, [gx, gy] = GATE[c.side], qx = FX + (c.side === 'L' ? -60 : 60), qy = FY + 55;
              c.x = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * qx + u * u * gx; c.y = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * qy + u * u * gy; c.s = 1 - u * .3;
              if (c.t >= 1 && !c.ok) chaos(c); }
            else { const dx = c.tx - c.x, dy = c.ty - c.y, l = Math.hypot(dx, dy), m = 380 * dt; c.s += (.62 - c.s) * Math.min(1, 6 * dt);
              if (l <= m) { c.x = c.tx; c.y = c.ty; c.st = 'in'; c.walk = null; c.sq = .4; burst(c.x, c.y - 40, '#ff6fa8', 6, 160); } else { c.x += dx / l * m; c.y += dy / l * m; } }
          } else if (c.st === 'bad' || (c.st === 'in' && c.scared)) {                 // bouncing around the wrecked pen
            const [x0, x1] = pen(c.side); c.walk = (c.walk || 0) + dt; c.vy += 900 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
            if (c.x < x0 + 30 || c.x > x1 - 30) { c.vx *= -1; c.x = Math.max(x0 + 30, Math.min(x1 - 30, c.x)); }
            if (c.y > 520) { c.y = 520; c.vy = -260 - Math.random() * 260; c.vx += (Math.random() - .5) * 300; }
          } else if (c.st === 'off') { c.walk += dt;                                    // ambles down, bonks Claude, wanders off sideways
            if (!c.bump) { c.y += 300 * dt; c.s += .4 * dt; c.x += Math.sin(c.walk * 3) * 40 * dt; if (c.y > CY - 40) { c.bump = 1; knock = 60; sfx.thud(); shake(6, .2); } }
            else c.x += (c.kind === 'sheep' ? -1 : 1) * 260 * dt; }
        });
        if (g.result) return;
        const c = front();
        if (buf.length && ready(c)) decide(buf.shift());
        if (c && c.st === 'wait') {
          c.wt -= dt; if (!ticked && c.wt < c.win * .4) { ticked = true; sfx.tickHi(); }
          if (c.wt <= 0) {                                                             // got bored and wanders off
            g.result = 'lose'; why = 'TOO SLOW!'; [c.x, c.y, c.s] = at(1); c.st = 'off'; c.walk = 0; sfx.miss(); sfx.buzz();
          }
        }
      },
      draw(t) {
        bg('#7cc8f5', '#8fd3fa', t);
        for (const c of clouds) { const x = ((c.x % (VW + 300)) + VW + 300) % (VW + 300) - OX - 150;     // drifting clouds
          ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, dy, r] of [[-40, 6, 26], [0, -6, 34], [42, 6, 24]]) { ctx.beginPath(); ctx.arc(x + dx * c.s, c.y + dy * c.s, r * c.s, 0, 7); ctx.fill(); } }
        ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.fillStyle = '#5fbf4a';               // hills + grass
        for (const [x, r] of [[-OX + 60, 220], [260, 170], [560, 200], [W + OX - 40, 240]]) { ctx.beginPath(); ctx.ellipse(x, 240, r, 70, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#86DE5C'; ctx.fillRect(-OX, 232, VW, H - 232); ctx.fillStyle = INK; ctx.fillRect(-OX, 229, VW, 6);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 262; y < H; y += 64) ctx.fillRect(-OX, y, VW, 30);
        // the barn the critters come out of
        box3(338, 172, 124, 66, '#E8553D', 5, 5); ctx.beginPath(); ctx.moveTo(326, 176); ctx.lineTo(FX, 140); ctx.lineTo(474, 176); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#b8352a'; ctx.fill();
        box(378, 196, 44, 42, '#3a1f1a', 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(350, 186, 20, 20); ctx.strokeRect(430, 186, 20, 20);
        // dirt path: trunk from the barn, then the fork to both gates (all outlines first, then the fills)
        const trunk = () => { ctx.beginPath(); ctx.moveTo(FX - 18, DY); ctx.lineTo(FX + 18, DY); ctx.lineTo(FX + 66, FY + 18); ctx.lineTo(FX - 66, FY + 18); ctx.closePath(); };
        const branch = sd => { const [gx, gy] = GATE[sd]; ctx.beginPath(); ctx.moveTo(FX, FY); ctx.quadraticCurveTo(FX + (sd === 'L' ? -60 : 60), FY + 55, gx + (sd === 'L' ? -20 : 20), gy); };
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 70; branch('L'); ctx.stroke(); branch('R'); ctx.stroke(); ctx.lineWidth = 10; trunk(); ctx.stroke();
        ctx.strokeStyle = DIRT; ctx.lineWidth = 56; branch('L'); ctx.stroke(); branch('R'); ctx.stroke(); ctx.fillStyle = DIRT; trunk(); ctx.fill(); ctx.lineCap = 'butt';
        ctx.fillStyle = 'rgba(20,16,28,.12)'; for (let i = 0; i < 9; i++) { const u = (i + .5) / 9, [x, y, sc] = at(u); ctx.beginPath(); ctx.ellipse(x + (i % 2 ? 14 : -14) * sc, y, 6 * sc, 3 * sc, 0, 0, 7); ctx.fill(); }
        // pens: floor, back fence, inner fence with a gate gap, signs
        for (const sd of ['L', 'R']) {
          const [x0, x1] = pen(sd), inner = sd === 'L' ? x1 : x0;
          ctx.fillStyle = sd === 'L' ? '#b9ec8e' : '#c99561'; ctx.fillRect(x0, 300, x1 - x0, 240);
          if (sd === 'R') { blob(x0 + (x1 - x0) * .55, 470, (x1 - x0) * .32, 34, '#8a5a32', 0, 0); blob(x0 + (x1 - x0) * .5, 380, (x1 - x0) * .2, 20, '#8a5a32', 0, 0); }
          else for (const [hx, hy] of [[x0 + 40, 330], [x0 + (x1 - x0) * .6, 512]]) { box(hx - 26, hy - 18, 52, 30, '#f2c94c', 4); ctx.fillStyle = '#d9a83a'; ctx.fillRect(hx - 26, hy - 6, 52, 4); }
          fenceH(x0, x1, 300); fenceV(inner, 300, 430); fenceV(inner, 520, 540);
          const bx = (sd === 'L' ? Math.max(x0 + 105, 130) : Math.min(x1 - 105, 670));
          box(bx - 7, 240, 14, 62, '#a86b3c', 3); box3(bx - 98, 208, 196, 62, '#f3d9a4', 5, 5);
          critter({ kind: sd === 'L' ? 'sheep' : 'pig' }, bx - 58, 262, .46, {});
          txt(sd === 'L' ? 'SHEEP' : 'PIGS', bx + 28, 240, 28, sd === 'L' ? '#fff' : PINK, 'center', 120);
        }
        // critters + Claude, back to front
        const items = [];
        crits.forEach((c, i) => { if (c.st === 'q' && i - f >= SLOTS.length) return;
          const [x, y, sc] = c.st === 'q' || c.st === 'wait' ? at(c.u) : [c.x, c.y, c.s]; items.push({ y, fn: () => {
            const w = c.st === 'in' && !c.scared ? null : c.walk, win = g.result === 'win';
            if (i === f && !g.result && ready(c)) { const p = 1 + .06 * Math.sin(clk * 14);                    // spotlight on the decider
              ctx.beginPath(); ctx.ellipse(x, y + 2, 62 * sc * p, 17 * sc * p, 0, 0, 7); ctx.fillStyle = 'rgba(255,225,77,.5)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); }
            shadow(x, y + 2, 40 * sc, 9 * sc, .25);
            const mood = c.st === 'bad' || c.scared ? 'scared' : c.st === 'in' || (c.st === 'go' && c.ok) ? 'happy' : c.st === 'off' ? 'happy' : null;
            const yy = y - (c.st === 'in' && win ? Math.abs(Math.sin(clk * 12 + c.ph)) * 20 : c.st === 'in' ? Math.abs(Math.sin(clk * 3 + c.ph)) * 3 : 0);
            critter(c, x, yy, sc, { walk: w, mood, tilt: c.st === 'go' ? (c.side === 'L' ? -.18 : .18) : c.st === 'bad' ? Math.sin(clk * 30) * .3 : 0, sweat: c.st === 'wait' && c.wt < c.win * .5 });
            if (c.st === 'wait' && !g.result) {                                      // "?" bubble with a draining timer ring
              const bx = x + 86, by = y - 72, u = c.wt / c.win;                      // beside the decider's own head
              ctx.beginPath(); ctx.moveTo(bx - 18, by - 10); ctx.lineTo(bx - 40, by + 6); ctx.lineTo(bx - 16, by + 12); ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.fill(); ctx.stroke();
              circ(bx, by, 24, '#fff', 4); raw('?', bx, by + 2, 34 + Math.sin(clk * 20) * 3, u < .4 ? '#ff4d4d' : '#4DB8FF');
              ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + u * 6.283); ctx.stroke();
              ctx.strokeStyle = u < .4 ? '#ff4d4d' : '#FFE14D'; ctx.lineWidth = 6; ctx.stroke(); ctx.lineCap = 'butt';
            }
            if (c.st === 'off') { raw('♪', x + 40 * sc, y - 120 * sc + Math.sin(clk * 8) * 6, 30, '#fff'); }
          } }); });
        items.push({ y: CY, fn: () => {                                                   // Claude the farmer, pointing the way
          const cx = FX + knock + point * pointT * 30, cy = CY - (g.result === 'win' ? Math.abs(Math.sin(clk * 10)) * 18 : hop > 0 ? Math.sin(hop / .25 * Math.PI) * 14 : 0);
          shadow(FX + knock, CY + 2, 34, 7, .3);
          ctx.save(); ctx.translate(cx, cy); ctx.transform(1, 0, -point * pointT * .9, 1, 0, 0);
          claude(0, 0, 4, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' || hop > 0 ? 'happy' : null });
          blob(0, -37, 34, 7, '#f2c94c', 0, 3); box(-14, -54, 28, 15, '#f2c94c', 3); ctx.fillStyle = '#e8433a'; ctx.fillRect(-14, -44, 28, 5);
          ctx.restore();
          if (pointT > 0) drawArrow(FX + point * 74, CY - 30, point < 0 ? 3 : 1, 24 * (1 + pointT), '#FFE14D');
        } });
        items.sort((a, b) => a.y - b.y).forEach(it => it.fn());
        for (const sd of ['L', 'R']) { const [x0, x1] = pen(sd); fenceH(x0, x1, 548); }   // front rails over the pens
        const c = front();                                                               // big L/R arrows by the waiting critter
        if (ready(c)) { const p = 1 + .08 * Math.sin(clk * 16), live = c.st === 'wait' ? 1 : .55;
          ctx.globalAlpha = live; drawArrow(FX - 112, FY + 22, 3, 32 * p, '#fff'); drawArrow(FX + 112, FY + 22, 1, 32 * p, '#fff'); ctx.globalAlpha = 1; }
        for (const q of pops) { ctx.globalAlpha = 1 - q.t * q.t * 1.5; raw(q.s, q.x, q.y - q.t * 50, 30 * (1 + Math.max(0, .15 - q.t) * 2), '#fff'); ctx.globalAlpha = 1; }
        // HUD (raw: the strings are translated once here)
        raw(window.t('SORTED {n} / {need}', { n: sorted, need: NEED }), FX, 98, 26, '#fff');
        for (let i = 0; i < NEED; i++) { const d = crits[i], on = i < sorted, x = FX + (i - (NEED - 1) / 2) * 30;
          circ(x, 128, 10, on ? (d.kind === 'sheep' ? '#fff' : PINK) : 'rgba(255,255,255,.35)', 3); if (on) { ctx.fillStyle = d.kind === 'sheep' ? FACE : P2; ctx.beginPath(); ctx.arc(x, 130, 4, 0, 7); ctx.fill(); } }
        if (why) raw(window.t(why), FX, 482 + Math.sin(clk * 16) * 4, why === 'ALL SORTED!' ? 50 : 42, g.result === 'win' ? '#FFE14D' : '#ff6b6b');   // below the NICE!/FAIL! stamp
        vignette(.3);
      },
      probe: () => { const c = front(), side = c ? (c.kind === 'sheep' ? 'L' : 'R') : null, r = ready(c);
        return { phase: c ? c.st : 'done', front: f, kind: c ? c.kind : null, disguised: c ? !!c.dis : null, side, ready: !!r, u: c ? +(c.u || 0).toFixed(3) : null,
          press: r ? (side === 'L' ? 'ArrowLeft' : 'ArrowRight') : null, tap: r ? (side === 'L' ? [200, 420] : [600, 420]) : null,
          left: c && c.st === 'wait' ? +c.wt.toFixed(3) : null, window: c && c.win ? +c.win.toFixed(3) : null, rush: c ? !!c.rush : null, buffered: buf.join(''), sorted, need: NEED, result: g.result || null, why }; }
    };
    return g;
  };
})();
