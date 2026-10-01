'use strict';
/* Nintendo DS pack (WarioWare Touched!/Snapped! inspired) — every game: {cmd, hint, thint, dur, update(dt), draw(t)}; set g.result = 'win'|'lose' */

const dsPtIn = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
function dsInPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
const dsMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const dsRnd = (a, b) => a + Math.random() * (b - a);
function dsBoom(x, y, r, t) {
  star(x, y, r, r * .55, 12, t * 3, '#FFE14D', 6); star(x, y, r * .62, r * .3, 10, -t * 4, '#ff7a2f', 4);
}

/* ── 1 ── RAMP IT UP: draw a ramp so the ball lands in the cup */
function dsRamp(sp) {
  const k = Math.sqrt(sp), INKMAX = 340, cupX = dsRnd(570, 700), cupY = 470;
  const ball = { x: dsRnd(120, 250), y: 110, vx: 0, vy: 0, r: 15, on: false };
  const strokes = []; let cur = null, used = 0, drawing = false, clock = 0, drop = 0;
  const fixed = [
    [380, 430, 470, 430], [380, 430, 380, 600], [470, 430, 470, 600],
    [cupX - 55, cupY, cupX - 40, cupY + 70], [cupX + 55, cupY, cupX + 40, cupY + 70], [cupX - 40, cupY + 70, cupX + 40, cupY + 70]
  ];
  const release = () => { if (!ball.on) { ball.on = true; snd(520, .12, 'triangle', .06, 0, 300); } };
  const g = {
    cmd: 'DRAW!', hint: 'DRAG TO DRAW A RAMP FOR THE BALL', thint: 'DRAW A RAMP WITH YOUR FINGER', dur: 4.8,
    down(p) { if (used >= INKMAX || g.result) return; cur = { pts: [{ x: p.x, y: p.y }] }; strokes.push(cur); drawing = true; },
    move(p) {
      if (!drawing || !cur || g.result) return;
      const l = cur.pts[cur.pts.length - 1], d = Math.hypot(p.x - l.x, p.y - l.y);
      if (d < 7) return;
      let q = p, dd = d;
      if (used + d > INKMAX) { const f = (INKMAX - used) / d; q = { x: l.x + (p.x - l.x) * f, y: l.y + (p.y - l.y) * f }; dd = INKMAX - used; }
      cur.pts.push({ x: q.x, y: q.y }); used += dd;
      if (Math.random() < .3) snd(300 + used, .03, 'square', .02);
      if (used >= INKMAX - .01) { drawing = false; release(); }
    },
    up() { drawing = false; release(); },
    update(dt) {
      if (g.result) return;
      clock += dt; drop = Math.max(0, drop);
      if (!ball.on && clock > 1.9 / k) release();
      if (!ball.on) return;
      const gt = dt * k, N = 6;
      for (let s = 0; s < N; s++) {
        const h = gt / N;
        ball.vy += 900 * h; ball.x += ball.vx * h; ball.y += ball.vy * h;
        const segs = fixed.slice();
        for (const st of strokes) for (let i = 1; i < st.pts.length; i++) segs.push([st.pts[i - 1].x, st.pts[i - 1].y, st.pts[i].x, st.pts[i].y]);
        for (const sg of segs) {
          const dx = sg[2] - sg[0], dy = sg[3] - sg[1], l2 = dx * dx + dy * dy || 1;
          const kk = Math.max(0, Math.min(1, ((ball.x - sg[0]) * dx + (ball.y - sg[1]) * dy) / l2));
          const qx = sg[0] + dx * kk, qy = sg[1] + dy * kk, ddx = ball.x - qx, ddy = ball.y - qy, d = Math.hypot(ddx, ddy), R = ball.r + 4;
          if (d < R && d > 1e-6) {
            const nx = ddx / d, ny = ddy / d; ball.x += nx * (R - d); ball.y += ny * (R - d);
            const vn = ball.vx * nx + ball.vy * ny;
            if (vn < 0) { ball.vx -= 1.3 * vn * nx; ball.vy -= 1.3 * vn * ny; if (vn < -120 && Math.random() < .5) snd(260 + Math.random() * 100, .05, 'triangle', .04); }
          }
        }
        ball.vx *= 1 - .15 * h;
      }
      if (Math.abs(ball.x - cupX) < 42 && ball.y > cupY + 14 && ball.y < cupY + 70) { g.result = 'win'; snd(900, .2); confetti(cupX, cupY, 36); }
      else if (ball.y > H + 40 || ball.x < -40 || ball.x > W + 40) { g.result = 'lose'; snd(110, .4, 'sawtooth', .12, 0, 40); }
    },
    draw(t) {
      ctx.fillStyle = '#fbfaf0'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#a9d4f5'; ctx.lineWidth = 2;
      for (let y = 40; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = '#ff9aa8'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(60, H); ctx.stroke();
      box(380, 430, 90, 190, '#9a6a3c', 5);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(386, 440, 78, 8);
      // cup
      ctx.beginPath(); ctx.moveTo(cupX - 55, cupY); ctx.lineTo(cupX + 55, cupY); ctx.lineTo(cupX + 40, cupY + 70); ctx.lineTo(cupX - 40, cupY + 70); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#5CFF7A'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cupX, cupY + 30, 14, .15, Math.PI - .15); ctx.stroke();
      circ(cupX - 14, cupY + 24, 4, INK, 0); circ(cupX + 14, cupY + 24, 4, INK, 0);
      // strokes
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 9;
      for (const st of strokes) { ctx.beginPath(); st.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); if (st.pts.length === 1) ctx.lineTo(st.pts[0].x + .1, st.pts[0].y); ctx.stroke(); }
      ctx.lineCap = 'butt';
      // ball
      const by = ball.on ? ball.y : 110 + Math.sin(t * 5) * 4;
      circ(ball.x, by, ball.r, '#ff4d4d', 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(ball.x - 9, by - 8, 7, 8); ctx.fillRect(ball.x + 2, by - 8, 7, 8);
      ctx.fillStyle = INK; ctx.fillRect(ball.x - 6, by - 5, 3, 4); ctx.fillRect(ball.x + 4, by - 5, 3, 4);
      if (!ball.on) txt('v', ball.x, by + 36, 22, '#fff');
      // ink bar
      box(30, 120, 22, 200, '#fff', 4); const f = 1 - used / INKMAX;
      ctx.fillStyle = '#4DB8FF'; ctx.fillRect(30, 120 + 200 * (1 - f), 22, 200 * f);
      txt('INK', 41, 340, 16, '#fff');
    }
  };
  return g;
}

/* ── 2 ── MIDNIGHT WEIRDO: find the creep with the flashlight */
function dsCreep(sp) {
  const R = TOUCH ? 110 : 95, kinds = shuffle(['creep', 'cat', 'mailbox', 'trash', 'bush']);
  const cells = shuffle([[150, 250], [400, 230], [650, 260], [220, 440], [440, 450], [660, 440]]).slice(0, 5);
  const figs = kinds.map((kd, i) => ({ kind: kd, x: cells[i][0] + dsRnd(-35, 35), y: cells[i][1] + dsRnd(-25, 25), ph: Math.random() * 6 }));
  const eyeY = { creep: -104, cat: -34, trash: -38, bush: -30 };
  const drawFig = f => {
    const { x, y, kind } = f;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    if (kind === 'creep') {
      box(-28, -92, 56, 92, '#4a4560', 4); box(-6, -92, 12, 92, '#2c2840', 0);
      circ(0, -108, 19, '#e8c9a0', 4);
      box(-30, -132, 60, 9, '#2c2840', 4); box(-17, -158, 34, 30, '#2c2840', 4);
      ctx.fillStyle = INK; ctx.fillRect(-14, -102, 7, 7); ctx.fillRect(7, -102, 7, 7);
      ctx.fillStyle = '#fff'; ctx.fillRect(-12, -101, 4, 4); ctx.fillRect(9, -101, 4, 4);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-13, -94); ctx.quadraticCurveTo(0, -78, 13, -94); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 5 - 2, -92, 4, 5);
    } else if (kind === 'cat') {
      ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(26, -10); ctx.quadraticCurveTo(58, -20, 44, -52); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = '#ff9f4d'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(26, -10); ctx.quadraticCurveTo(58, -20, 44, -52); ctx.stroke(); ctx.lineCap = 'butt';
      circ(0, -22, 30, '#ff9f4d', 4);
      circ(0, -52, 22, '#ff9f4d', 4);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 8, -66); ctx.lineTo(s * 22, -84); ctx.lineTo(s * 24, -58); ctx.closePath(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#ff9f4d'; ctx.fill(); }
      ctx.fillStyle = INK; ctx.fillRect(-2, -46, 4, 4);
    } else if (kind === 'mailbox') {
      box(-5, -50, 10, 50, '#7a5230', 3); box(-34, -90, 68, 44, '#4D7CFF', 4);
      ctx.fillStyle = INK; ctx.fillRect(-22, -72, 44, 5);
      box(30, -112, 7, 36, '#ff4d4d', 3); box(30, -112, 24, 12, '#ff4d4d', 3);
    } else if (kind === 'trash') {
      box(-26, -66, 52, 66, '#8e98a8', 4); box(-32, -80, 64, 14, '#aab3c2', 4);
      ctx.fillStyle = INK; for (const i of [-12, 0, 12]) ctx.fillRect(i - 2, -58, 4, 48);
    } else {
      circ(-22, -22, 24, '#3fbf5a', 4); circ(20, -24, 28, '#3fbf5a', 4); circ(0, -44, 26, '#3fbf5a', 4);
    }
    ctx.restore();
  };
  const g = {
    cmd: 'LOOK!', hint: 'FIND THE CREEP: LIGHT IT, CLICK IT', thint: 'FIND THE CREEP: TAP IT', dur: 5.5,
    down(p) {
      if (g.result) return;
      if (Math.hypot(p.x - mouse.x, p.y - mouse.y) > R + 20) return;
      for (const f of figs) {
        if (Math.hypot(p.x - f.x, p.y - (f.y - 45)) < 62) {
          if (f.kind === 'creep') { g.result = 'win'; snd(900, .2); confetti(f.x, f.y - 60, 30); } else { g.result = 'lose'; snd(110, .4, 'sawtooth', .12, 0, 40); }
          g.hit = f; return;
        }
      }
    },
    update() {},
    draw(t) {
      ctx.fillStyle = '#2a3b63'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1f2c4b'; ctx.fillRect(0, 190, W, 410);
      ctx.fillStyle = '#fff'; for (let i = 0; i < 24; i++) ctx.fillRect((i * 97) % W, (i * 53) % 150 + 20, 3, 3);
      circ(690, 90, 34, '#FFF3B0', 4);
      ctx.fillStyle = INK; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 215, 8, 70); ctx.fillRect(0, 232, W, 7);
      const order = figs.slice().sort((a, b) => a.y - b.y);
      for (const f of order) drawFig(f);
      if (g.result && g.hit) {
        const f = g.hit; if (g.result === 'win') txt('GOTCHA!', f.x, f.y - 190, 36, '#5CFF7A'); else txt('NOPE!', f.x, f.y - 120, 36, '#ff4d4d');
      }
      // darkness with a soft spotlight
      const mx = mouse.x, my = mouse.y;
      if (!g.result) {
        ctx.fillStyle = 'rgba(6,5,18,.97)'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(mx, my, R, 0, Math.PI * 2, true); ctx.fill('evenodd');
        const gr = ctx.createRadialGradient(mx, my, R * .55, mx, my, R); gr.addColorStop(0, 'rgba(6,5,18,0)'); gr.addColorStop(1, 'rgba(6,5,18,.97)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, my, R + .5, 0, Math.PI * 2); ctx.fill();
        for (const f of figs) {
          const ey = eyeY[f.kind]; if (ey == null || Math.sin(t * 2.6 + f.ph) < -.6) continue;
          if (Math.hypot(mx - f.x, my - (f.y + ey)) < R * .8) continue;
          ctx.fillStyle = f.kind === 'cat' ? '#FFE14D' : '#fff';
          ctx.fillRect(f.x - 12, f.y + ey - 3, 6, 6); ctx.fillRect(f.x + 6, f.y + ey - 3, 6, 6);
        }
        ctx.strokeStyle = 'rgba(255,240,150,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my, R, 0, 7); ctx.stroke();
      }
    }
  };
  return g;
}

/* ── 3 ── SHORT FUSE: cut the wire named by the word (not the ink!) */
function dsFuse(sp) {
  const names = ['RED', 'BLUE', 'YELLOW'], cols = ['#ff4d4d', '#4DB8FF', '#ffd23f'];
  const slots = [180, 400, 620], perm = shuffle([0, 1, 2]), want = Math.random() * 3 | 0;
  let inkI; do { inkI = Math.random() * 3 | 0; } while (inkI === want);
  const wires = [0, 1, 2].map(i => {
    const sx = [350, 400, 450][i], ex = slots[perm[i]], pts = [], ph = Math.random() * 6;
    for (let s = 0; s <= 40; s++) {
      const u = s / 40, e = u * u * (3 - 2 * u);
      pts.push({ x: sx + (ex - sx) * e + Math.sin(u * Math.PI * 3 + ph) * 34 * Math.sin(u * Math.PI), y: 255 + u * 305 });
    }
    return { col: cols[i], slot: perm[i], pts, cut: -1 };
  });
  const durA = 4.6 / Math.sqrt(sp); let clock = 0;
  const cutIt = w => {
    if (g.result || w.cut >= 0) return;
    let bi = 0, bd = 1e9; w.pts.forEach((q, i) => { const d = Math.abs(q.y - (g.cy || 400)); if (d < bd) { bd = d; bi = i; } });
    w.cut = g.cy ? bi : 20; snd(900, .08, 'sawtooth', .08, 0, 300);
    if (w === wires[want]) { g.result = 'win'; snd(700, .25, 'triangle', .08, .1, 1400); confetti(400, 250, 30); }
    else { g.result = 'lose'; snd(100, .5, 'sawtooth', .14, .05, 30); }
  };
  const g = {
    cmd: 'CUT!', hint: 'CUT THE WIRE THE WORD SAYS: CLICK OR 1 2 3', thint: 'TAP THE WIRE THE WORD SAYS', dur: 4.6,
    down(p) {
      if (g.result) return;
      let best = null, bd = 22;
      for (const w of wires) { if (w.cut >= 0) continue; for (let i = 0; i < w.pts.length; i++) { const d = Math.hypot(p.x - w.pts[i].x, p.y - w.pts[i].y); if (d < bd) { bd = d; best = w; g.cy = w.pts[i].y; } } }
      if (best) cutIt(best);
    },
    key(e) { const m = /^Digit([123])$/.exec(e.code || ''); if (m && !g.result) { const w = wires.find(w => w.slot === +m[1] - 1); g.cy = 400; cutIt(w); } },
    update(dt) { if (!g.result) clock += dt; },
    draw(t) {
      const boom = g.result === 'lose', sh = boom ? Math.sin(t * 90) * 8 : 0;
      bg(boom ? '#ff9d6e' : '#B5E6A2', boom ? '#ff8a55' : '#a5d992', t);
      ctx.save(); ctx.translate(sh, 0);
      for (const w of wires) {
        const draw = (a, b) => {
          ctx.beginPath(); for (let i = a; i <= b; i++) i === a ? ctx.moveTo(w.pts[i].x, w.pts[i].y) : ctx.lineTo(w.pts[i].x, w.pts[i].y);
        };
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const a = w.cut >= 0 ? w.cut - 3 : 40, b0 = w.cut + 3;
        ctx.strokeStyle = INK; ctx.lineWidth = 17; draw(0, Math.max(1, a)); ctx.stroke(); if (w.cut >= 0) { draw(Math.min(39, b0), 40); ctx.stroke(); }
        ctx.strokeStyle = w.col; ctx.lineWidth = 9; draw(0, Math.max(1, a)); ctx.stroke(); if (w.cut >= 0) { draw(Math.min(39, b0), 40); ctx.stroke(); }
        ctx.lineCap = 'butt';
        if (w.cut >= 0) { star(w.pts[w.cut].x, w.pts[w.cut].y, 20 + Math.sin(t * 40) * 4, 8, 6, t * 5, '#fff', 3); }
      }
      for (let i = 0; i < 3; i++) { box(slots[i] - 20, 560, 40, 34, '#fff', 4); txt('' + (i + 1), slots[i], 578, 24, INK); }
      // bomb
      circ(400, 170, 92, '#2d2a3a', 6); ctx.fillStyle = '#4a4560'; ctx.beginPath(); ctx.arc(368, 134, 26, 3.4, 5); ctx.lineWidth = 8; ctx.strokeStyle = '#4a4560'; ctx.stroke();
      box(380, 62, 40, 24, '#8e98a8', 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(400, 62); ctx.quadraticCurveTo(425, 30, 460, 44); ctx.stroke();
      if (!g.result) star(462, 44, 12 + Math.sin(t * 30) * 4, 5, 6, t * 6, '#FFE14D', 2);
      const rem = Math.max(0, durA - clock);
      box(340, 150, 120, 58, '#1b1f12', 4);
      txt('0:0' + Math.min(9, Math.ceil(rem)), 400, 181, 38, rem < 1.5 && Math.sin(t * 20) > 0 ? '#ff4d4d' : '#6bff6b');
      if (g.result === 'win') txt('DEFUSED!', 400, 100, 34, '#5CFF7A');
      ctx.restore();
      // sticky note
      ctx.save(); ctx.translate(135, 200); ctx.rotate(-.07);
      box(-100, -75, 200, 150, '#fff6a8', 5); txt('CUT THE', 0, -40, 28, INK);
      ctx.fillStyle = INK; ctx.fillRect(-70, -18, 140, 3);
      txt(names[want], 0, 22, 46, cols[inkI], 'center', 180); ctx.restore();
      if (boom) { dsBoom(400, 190, 150 + Math.sin(t * 30) * 12, t); txt('BOOM!', 400, 190, 60, '#fff'); }
      else claude(710, 600, 8, { mood: dsMood(g) });
    }
  };
  return g;
}

/* ── 4 ── IN THE LOOP: lasso the buttons, dodge the decoys */
function dsLoop(sp) {
  const C = { x: dsRnd(300, 500), y: dsRnd(260, 380) }, tg = [], dc = [];
  const far = (a, r) => tg.concat(dc).every(o => Math.hypot(o.x - a.x, o.y - a.y) > r);
  const nT = sp > 1.5 ? 4 : 3, nD = 3, cols = ['#ff4d4d', '#4DB8FF', '#FFE14D', '#5CFF7A', '#FF4D9E'];
  for (let i = 0; i < nT; i++) { let p, n = 0; do { const a = Math.random() * 6.28, r = Math.random() * 100; p = { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r, col: cols[i] }; } while (!far(p, 78) && ++n < 60); tg.push(p); }
  for (let i = 0; i < nD; i++) {
    let p, n = 0;
    do { const a = Math.random() * 6.28, r = dsRnd(230, 290); p = { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r * .8 }; n++; }
    while ((p.x < 60 || p.x > 740 || p.y < 130 || p.y > 550 || !far(p, 90)) && n < 80);
    if (p.x < 60 || p.x > 740 || p.y < 120 || p.y > 560) { p.x = Math.max(60, Math.min(740, p.x)); p.y = Math.max(125, Math.min(555, p.y)); }
    dc.push(p);
  }
  let pts = [], pr = false, flash = 0, msg = '';
  const button = (x, y, col) => {
    circ(x, y, 26, col, 4); circ(x, y, 18, col, 3);
    ctx.fillStyle = INK; for (const o of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) ctx.fillRect(x + o[0] - 2, y + o[1] - 2, 4, 4);
  };
  const g = {
    cmd: 'LOOP!', hint: 'CIRCLE ALL THE COLOURED BUTTONS', thint: 'DRAW A LOOP AROUND THE COLOURED BUTTONS', dur: 5.8,
    down(p) { if (g.result) return; pr = true; pts = [{ x: p.x, y: p.y, t: now }]; },
    move(p) { if (!pr || g.result) return; const l = pts[pts.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 6) pts.push({ x: p.x, y: p.y, t: now }); },
    up() {
      if (!pr || g.result) return; pr = false;
      if (pts.length < 8) { pts = []; return; }
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 90) { msg = 'CLOSE THE LOOP!'; flash = .7; return; }
      const inn = o => dsInPoly(o.x, o.y, pts);
      if (tg.every(inn) && !dc.some(inn)) { g.result = 'win'; snd(900, .2); confetti(C.x, C.y, 36); }
      else { msg = dc.some(inn) ? 'NOT THE GREY ONES!' : 'GET THEM ALL!'; flash = .8; snd(150, .15, 'sawtooth', .07); pts.length = 0; }
    },
    update(dt) { flash = Math.max(0, flash - dt); },
    draw(t) {
      ctx.fillStyle = '#2f6b4a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2a6143'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 131) % W, (i * 71) % H, 60, 3);
      for (const o of dc) button(o.x, o.y, '#9a9aa5');
      for (const o of tg) button(o.x, o.y, o.col);
      const live = pts.filter(q => now - q.t < 1.1 || pr && q === pts[pts.length - 1]);
      if (live.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const [w, c] of [[16, 'rgba(120,255,255,.35)'], [7, '#bffcff']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); live.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      if (flash > 0) txt(msg, W / 2, 110, 34, '#FFE14D');
      if (g.result === 'win') { for (const o of tg) star(o.x, o.y - 40, 14, 6, 5, t * 3, '#FFE14D', 3); }
    }
  };
  return g;
}

/* ── 5 ── CAGE MATCH: cut the rope when the pig is under the cage */
function dsCage(sp) {
  const k = Math.sqrt(sp), GY = 490, cx0 = dsRnd(290, 510), CW = 180, CH = 140;
  let px = dsRnd(130, 670), dir = Math.random() < .5 ? -1 : 1, cy = 100, vy = 0, cut = false, landed = false, clang = 0, esc = 0;
  const g = {
    cmd: 'CUT!', hint: 'CLICK TO CUT THE ROPE WHEN IT IS UNDER', thint: 'TAP TO CUT THE ROPE', dur: 4.6,
    down() { if (cut || g.result) return; cut = true; snd(700, .1, 'sawtooth', .07, 0, 200); },
    key(e) { if (e.code === 'Space' || e.code === 'Enter') g.down(); },
    update(dt) {
      const gt = dt * k;
      if (!g.result || !landed) { px += dir * 230 * gt; if (px < 110) { px = 110; dir = 1; } if (px > 690) { px = 690; dir = -1; } }
      if (g.result && !(g.result === 'win')) { esc += dt; }
      if (cut && !landed) {
        vy += 2600 * gt; cy += vy * gt;
        if (cy + CH >= GY) {
          cy = GY - CH; landed = true; clang = .5;
          if (Math.abs(px - cx0) < CW / 2 - 28) { g.result = 'win'; snd(160, .3, 'square', .12, 0, 60); snd(900, .2, 'triangle', .07, .15); confetti(cx0, 400, 30); }
          else { g.result = 'lose'; snd(160, .3, 'square', .12, 0, 60); snd(120, .4, 'sawtooth', .08, .2, 50); }
        }
      }
      clang = Math.max(0, clang - dt);
    },
    draw(t) {
      bg('#FFD59E', '#ffc98a', t);
      ctx.fillStyle = INK; ctx.fillRect(0, GY - 4, W, 120); ctx.fillStyle = '#7fcf5a'; ctx.fillRect(0, GY, W, 120);
      box(60, 60, 680, 26, '#7a5230', 5);
      // rope
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx0, 86); ctx.lineTo(cx0, cut ? 100 : cy); ctx.stroke();
      ctx.strokeStyle = '#d9b27a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx0, 86); ctx.lineTo(cx0, cut ? 100 : cy); ctx.stroke();
      if (!cut) { ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx0 - 6, 150 + i * 14); ctx.lineTo(cx0 + 6, 144 + i * 14); ctx.stroke(); } }
      // pig
      const pigDrawn = () => {
        const flip = dir, bob = Math.abs(Math.sin(t * 12)) * 5;
        ctx.save(); ctx.translate(px, GY - bob); ctx.scale(flip, 1);
        for (const o of [-24, 20]) box(o, -18, 12, 18, '#ff8fb8', 3);
        ctx.beginPath(); ctx.ellipse(0, -44, 48, 36, 0, 0, 7); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#ffa6c9'; ctx.fill();
        box(40, -52, 22, 20, '#ff8fb8', 3); ctx.fillStyle = INK; ctx.fillRect(46, -46, 4, 8); ctx.fillRect(54, -46, 4, 8);
        circ(26, -62, 6, INK, 0); ctx.fillStyle = '#fff'; ctx.fillRect(25, -65, 3, 3);
        ctx.beginPath(); ctx.moveTo(14, -78); ctx.lineTo(24, -96); ctx.lineTo(32, -76); ctx.closePath(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#ff8fb8'; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-50, -46, 10, 1, 5); ctx.stroke();
        ctx.restore();
      };
      if (g.result === 'lose') { pigDrawn(); } else if (!g.result) pigDrawn();
      // cage
      const cxA = cx0, top = cut ? cy : cy, wob = !cut ? Math.sin(t * 2) * 3 : 0;
      ctx.save(); ctx.translate(cxA + wob, 0);
      if (g.result === 'win') { ctx.restore(); pigDrawn(); ctx.save(); ctx.translate(cxA, 0); }
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.lineJoin = 'round';
      box(-CW / 2, top, CW, 16, '#a8602f', 4); box(-CW / 2, top + CH - 12, CW, 12, '#a8602f', 4);
      ctx.fillStyle = INK; for (let i = 0; i <= 6; i++) ctx.fillRect(-CW / 2 + 4 + i * (CW - 12) / 6, top + 14, 8, CH - 20);
      ctx.fillStyle = '#c47b3d'; for (let i = 0; i <= 6; i++) ctx.fillRect(-CW / 2 + 6 + i * (CW - 12) / 6, top + 14, 4, CH - 20);
      circ(0, top - 4, 10, '#8e98a8', 3);
      ctx.restore();
      if (clang > 0) { star(cx0, GY - 20, 90 + clang * 40, 50, 10, t * 2, '#FFE14D', 6); txt('CLANG!', cx0, GY - 20, 46, '#ff4d4d'); }
      if (!cut) { ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.fillRect(cx0 - CW / 2, GY - 6, CW, 6); }
    }
  };
  return g;
}

/* ── 6 ── TOUCHDOWN: use the cursor as a fan to steer the umbrella onto the pad */
function dsFan(sp) {
  const k = Math.sqrt(sp), GY = 500, padX = dsRnd(260, 540), R = 175;
  const side = padX > 400 ? -1 : 1;
  const ch = { x: Math.max(110, Math.min(690, padX + side * dsRnd(130, 230) * -1)), y: 130, vx: dsRnd(-25, 25), vy: 0 };
  let px = mouse.x, py = mouse.y, spd = 0, spin = 0; const clouds = [[120, 130], [520, 100], [680, 220], [300, 260]];
  const g = {
    cmd: 'BLOW!', hint: 'WAVE THE MOUSE TO FAN HIM ONTO THE PAD', thint: 'WAVE YOUR FINGER TO FAN HIM ONTO THE PAD', dur: 4.8,
    update(dt) {
      if (g.result) { return; }
      const gt = dt * k, mx = mouse.x, my = mouse.y;
      spd = dt > 0 ? Math.hypot(mx - px, my - py) / dt : 0; px = mx; py = my; spd = Math.min(spd, 3000);
      const cy = ch.y - 50, dx = ch.x - mx, dy = cy - my, d = Math.hypot(dx, dy);
      if (d < R && d > 1) {
        const F = 1700 * (1 - d / R) * Math.min(1, .15 + spd / 900) * (spd / 700 > 0 ? 1 : 1);
        ch.vx += dx / d * F * gt; ch.vy += dy / d * F * gt * .6;
      }
      ch.vx *= Math.exp(-1.5 * gt); ch.vx = Math.max(-340, Math.min(340, ch.vx));
      ch.vy += 420 * gt; ch.vy = Math.min(ch.vy, 100); ch.vy = Math.max(ch.vy, -120);
      ch.x += ch.vx * gt; ch.y += ch.vy * gt; spin += (ch.vx / 700 - spin) * Math.min(1, 6 * dt);
      if (ch.x < 10 || ch.x > W - 10) { g.result = 'lose'; snd(110, .4, 'sawtooth', .12, 0, 40); }
      else if (ch.y >= GY) {
        ch.y = GY;
        if (Math.abs(ch.x - padX) < 66) { g.result = 'win'; snd(900, .2); confetti(ch.x, GY - 40, 30); } else { g.result = 'lose'; snd(110, .4, 'sawtooth', .12, 0, 40); }
      }
    },
    draw(t) {
      bg('#9BDDFF', '#8ed2f7', t);
      for (const c of clouds) { const x = (c[0] + t * 12) % 900 - 50; circ(x, c[1], 30, '#fff', 4); circ(x + 34, c[1] + 8, 24, '#fff', 4); circ(x - 32, c[1] + 10, 22, '#fff', 4); circ(x, c[1] + 12, 26, '#fff', 0); }
      ctx.fillStyle = INK; ctx.fillRect(0, GY + 6, W, 120); ctx.fillStyle = '#58c24a'; ctx.fillRect(0, GY + 10, W, 120);
      box(padX - 70, GY + 4, 140, 10, '#FFE14D', 3);
      ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(padX - 28, GY + 40); ctx.lineTo(padX + 28, GY + 80); ctx.moveTo(padX + 28, GY + 40); ctx.lineTo(padX - 28, GY + 80); ctx.stroke(); ctx.lineCap = 'butt';
      // character
      ctx.save(); ctx.translate(ch.x, ch.y); ctx.rotate(spin * .5);
      ctx.strokeStyle = INK; ctx.lineWidth = 4;
      for (const s of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * 52, -92); ctx.lineTo(0, -48); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, -92, 56, Math.PI, 0); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#ff4d9e'; ctx.fill();
      ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(0, -148); ctx.lineTo(-20, -95); ctx.quadraticCurveTo(-10, -86, 0, -92); ctx.quadraticCurveTo(10, -86, 20, -95); ctx.closePath(); ctx.fill();
      claude(0, 0, 5, { mood: dsMood(g) });
      ctx.restore();
      // fan
      if (!g.result) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(mouse.x, mouse.y, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 18 + i * 5, a, a + 1.6); ctx.stroke(); }
        ctx.lineCap = 'butt'; circ(mouse.x, mouse.y, 7, '#fff', 3);
      }
    }
  };
  return g;
}

/* ── 7 ── DEAD SIMON SAYS: drag the skeleton's hands and feet to match the pose */
function dsPose(sp) {
  const POSES = [
    { h: [[-95, 60], [95, 60]], f: [[-85, 465], [85, 465]] },
    { h: [[-165, 200], [165, 200]], f: [[-35, 465], [35, 465]] },
    { h: [[-130, 90], [150, 230]], f: [[-60, 465], [110, 425]] },
    { h: [[-32, 105], [32, 105]], f: [[-80, 465], [80, 465]] },
    { h: [[-125, 260], [105, 150]], f: [[-95, 455], [95, 395]] }
  ];
  const T = POSES[Math.random() * POSES.length | 0], TX = 200, MX = 600, TOL = TOL_();
  function TOL_() { return sp > 1.5 ? 36 : 44; }
  const me = { h: [[-45, 360], [45, 360]], f: [[-30, 465], [30, 465]] };
  const handles = [{ a: me.h[0], sh: [-28, 198], max: 175 }, { a: me.h[1], sh: [28, 198], max: 175 }, { a: me.f[0], sh: [-22, 335], max: 150 }, { a: me.f[1], sh: [22, 335], max: 150 }];
  const target = [T.h[0], T.h[1], T.f[0], T.f[1]];
  let grab = -1, okT = 0; const match = i => Math.hypot(handles[i].a[0] - target[i][0], handles[i].a[1] - target[i][1]) < TOL;
  const bone = (x0, y0, x1, y1) => {
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke(); ctx.lineCap = 'butt';
  };
  const skel = (cx, hands, feet) => {
    bone(cx, 190, cx, 335);
    bone(cx - 28, 198, cx + 28, 198); bone(cx - 22, 335, cx + 22, 335);
    for (let i = 0; i < 3; i++) bone(cx - 20, 225 + i * 26, cx + 20, 225 + i * 26);
    bone(cx - 28, 198, cx + hands[0][0], hands[0][1]); bone(cx + 28, 198, cx + hands[1][0], hands[1][1]);
    bone(cx - 22, 335, cx + feet[0][0], feet[0][1]); bone(cx + 22, 335, cx + feet[1][0], feet[1][1]);
    circ(cx, 148, 34, '#fff', 5);
    ctx.fillStyle = INK; ctx.fillRect(cx - 20, 134, 13, 15); ctx.fillRect(cx + 7, 134, 13, 15);
    ctx.fillRect(cx - 4, 154, 8, 7); ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx - 17, 168); ctx.lineTo(cx + 17, 168); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 7, 164); ctx.lineTo(cx + i * 7, 172); ctx.stroke(); }
  };
  const g = {
    cmd: 'POSE!', hint: 'DRAG HANDS AND FEET TO COPY THE POSE', thint: 'DRAG HANDS AND FEET TO COPY THE POSE', dur: 5.8,
    down(p) {
      if (g.result) return; let bi = -1, bd = 52;
      handles.forEach((h, i) => { const d = Math.hypot(p.x - (MX + h.a[0]), p.y - h.a[1]); if (d < bd) { bd = d; bi = i; } });
      grab = bi; if (bi >= 0) snd(500, .04);
    },
    move(p) {
      if (grab < 0 || g.result) return; const h = handles[grab];
      let x = p.x - MX, y = p.y, dx = x - h.sh[0], dy = y - h.sh[1], d = Math.hypot(dx, dy);
      if (d > h.max) { x = h.sh[0] + dx / d * h.max; y = h.sh[1] + dy / d * h.max; }
      if (grab >= 2) y = Math.max(380, Math.min(470, y)); else y = Math.max(40, Math.min(470, y));
      h.a[0] = x; h.a[1] = y;
    },
    up() { grab = -1; },
    update(dt) {
      if (g.result) return;
      if ([0, 1, 2, 3].every(match)) { okT += dt; if (okT > .15) { g.result = 'win'; snd(900, .2); confetti(MX, 250, 36); } } else okT = 0;
    },
    draw(t) {
      bg('#C9B8FF', '#bba8f8', t);
      ctx.fillStyle = INK; ctx.fillRect(40, 474, 320, 8); ctx.fillRect(440, 474, 320, 8);
      txt('COPY THIS', TX, 100, 26, '#fff'); txt('YOU', MX, 100, 26, '#fff');
      skel(TX, T.h, T.f);
      // ghost targets on my side
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
      target.forEach((q, i) => { ctx.beginPath(); ctx.arc(MX + q[0], q[1], TOL, 0, 7); ctx.stroke(); });
      ctx.setLineDash([]);
      skel(MX, me.h, me.f);
      handles.forEach((h, i) => { const ok = match(i); circ(MX + h.a[0], h.a[1], 18 + (grab === i ? 4 : 0), ok ? '#5CFF7A' : '#FFE14D', 4); });
      if (g.result === 'win') txt('PERFECT!', 400, 540, 40, '#5CFF7A');
    }
  };
  return g;
}

/* ── 8 ── SINKING FEELING: hold the bridge up while the car crosses (watch your grip) */
function dsSink(sp) {
  const k = Math.sqrt(sp), BY = 330, X0 = 150, X1 = 650;
  let cx = 95, s = -20, grip = 100, hold = false, fall = 0, tired = false;
  const prof = x => Math.max(0, 1 - Math.pow((x - 400) / 250, 2));
  const by = x => BY + s * prof(x);
  const start = () => { hold = true; }, stop = () => { hold = false; };
  const g = {
    cmd: 'HOLD!', hint: 'HOLD CLICK OR SPACE TO LIFT THE ROAD', thint: 'HOLD TO LIFT THE ROAD', dur: 5.2,
    down: start, up: stop, key(e) { if (e.code === 'Space') start(); }, keyup(e) { if (e.code === 'Space') stop(); },
    update(dt) {
      if (g.result) { if (g.result === 'lose') fall += dt * 500; return; }
      const gt = dt * k, u = Math.max(0, Math.min(1, (cx - X0) / (X1 - X0))), w = Math.pow(Math.sin(Math.PI * u), 2);
      if (grip <= 0) tired = true; else if (grip > 30) tired = false;
      const useHold = hold && !tired;
      if (useHold) grip = Math.max(0, grip - 50 * gt); else grip = Math.min(100, grip + 22 * gt);
      s += (50 + 400 * w) * gt * (useHold ? 0 : 1);
      if (useHold) s -= (560 - 120 * (1 - grip / 100)) * gt * Math.max(.0, 1) * (1 - 0) * (1);
      s = Math.max(-60, Math.min(320, s));
      if (hold && tired && Math.random() < .2) snd(130, .05, 'sawtooth', .04);
      cx += 150 * gt;
      if (cx > X0 && cx < X1 && s * prof(cx) > 105) { g.result = 'lose'; snd(110, .5, 'sawtooth', .12, 0, 40); }
      else if (cx >= 690) { g.result = 'win'; snd(900, .2); confetti(cx, 280, 30); }
    },
    draw(t) {
      bg('#FFD1A3', '#ffc593', t);
      // lava
      ctx.fillStyle = INK; ctx.fillRect(0, 500, W, 110); ctx.fillStyle = '#ff6a2f'; ctx.fillRect(0, 508, W, 100);
      ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 8; i++) { const x = (i * 113 + t * 30) % W; ctx.fillRect(x, 520 + Math.sin(t * 3 + i) * 8, 40, 8); }
      box(-10, 330, 160, 280, '#9a6a3c', 5); box(650, 330, 160, 280, '#9a6a3c', 5);
      ctx.fillStyle = '#58c24a'; ctx.fillRect(-10, 322, 160, 12); ctx.fillRect(650, 322, 160, 12);
      // bridge
      const pts = []; for (let x = X0; x <= X1; x += 10) pts.push([x, by(x) - 8]);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 24; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
      ctx.strokeStyle = '#c98b4d'; ctx.lineWidth = 14; ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 4; for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1] - 7); ctx.lineTo(pts[i][0], pts[i][1] + 7); ctx.stroke(); }
      ctx.lineCap = 'butt';
      // hand
      if (hold && !tired && !g.result) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (const x of [330, 400, 470]) { const y = by(x) + 30; ctx.beginPath(); ctx.moveTo(x, y + 28); ctx.lineTo(x, y); ctx.lineTo(x - 10, y + 10); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 10); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
      // car
      let y = by(cx) - 20 + (g.result === 'lose' ? fall : 0);
      if (g.result === 'lose' && y > 560) y = 560;
      claude(cx, y - 14, 3.4, { mood: dsMood(g) });
      box(cx - 34, y - 24, 68, 22, '#4D7CFF', 4); box(cx - 20, y - 42, 38, 20, '#4D7CFF', 4);
      ctx.fillStyle = '#bfe6ff'; ctx.fillRect(cx - 14, y - 38, 12, 12); ctx.fillRect(cx + 2, y - 38, 12, 12);
      circ(cx - 20, y, 9, '#333', 3); circ(cx + 20, y, 9, '#333', 3);
      // grip meter
      box(60, 70, 140, 20, '#fff', 4); ctx.fillStyle = grip > 25 ? '#5CFF7A' : '#ff4d4d'; ctx.fillRect(60, 70, 140 * grip / 100, 20);
      txt(tired ? 'TIRED!' : 'GRIP', 130, 112, 20, '#fff');
    }
  };
  return g;
}

/* ── 9 ── SCRATCH AND MATCH: scratch the foil, find the lucky symbols */
function dsScratch(sp) {
  const SY = 5, lucky = Math.random() * SY | 0, others = shuffle([...Array(SY).keys()].filter(i => i !== lucky));
  const syms = shuffle([lucky, lucky, ...others.slice(0, 4)]);
  const pos = [[220, 300], [400, 300], [580, 300], [220, 460], [400, 460], [580, 460]], RAD = 66, CELL = 12;
  const cells = pos.map(() => new Set()); const done = pos.map(() => false);
  let foil = null, fc = null, pr = false, lp = null;
  try {
    foil = document.createElement('canvas'); foil.width = W; foil.height = H; fc = foil.getContext('2d');
    for (const p of pos) {
      const gr = fc.createLinearGradient(p[0] - RAD, p[1] - RAD, p[0] + RAD, p[1] + RAD);
      gr.addColorStop(0, '#e9edf2'); gr.addColorStop(.5, '#a9b2bf'); gr.addColorStop(1, '#dfe4ea');
      fc.fillStyle = gr; fc.beginPath(); fc.arc(p[0], p[1], RAD, 0, 7); fc.fill();
      fc.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * (RAD - 6); fc.fillRect(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 3, 3); }
      fc.fillStyle = '#7f8896'; for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = Math.random() * (RAD - 6); fc.fillRect(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, 3, 3); }
    }
  } catch (e) { foil = null; }
  const sym = (i, x, y, s) => {
    if (i === 0) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 14 * s, y + 10 * s); ctx.quadraticCurveTo(x - 4 * s, y - 20 * s, x + 6 * s, y - 32 * s); ctx.moveTo(x + 14 * s, y + 10 * s); ctx.quadraticCurveTo(x + 10 * s, y - 20 * s, x + 6 * s, y - 32 * s); ctx.stroke(); circ(x - 14 * s, y + 14 * s, 13 * s, '#ff4d4d', 4); circ(x + 14 * s, y + 14 * s, 13 * s, '#ff4d4d', 4); }
    else if (i === 1) txt('7', x, y, 78 * s, '#ff4d4d');
    else if (i === 2) star(x, y, 38 * s, 17 * s, 5, -Math.PI / 2, '#FFE14D', 4);
    else if (i === 3) { ctx.beginPath(); ctx.ellipse(x, y, 36 * s, 24 * s, -.4, 0, 7); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#FFE14D'; ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x, y - 34 * s); ctx.lineTo(x + 28 * s, y); ctx.lineTo(x, y + 34 * s); ctx.lineTo(x - 28 * s, y); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#4DB8FF'; ctx.fill(); }
  };
  const scratch = (a, b) => {
    if (fc) {
      fc.globalCompositeOperation = 'destination-out'; fc.lineCap = 'round'; fc.lineWidth = 46; fc.beginPath(); fc.moveTo(a.x, a.y); fc.lineTo(b.x, b.y); fc.stroke(); fc.globalCompositeOperation = 'source-over';
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
      pos.forEach((p, i) => {
        if (done[i] || Math.hypot(x - p[0], y - p[1]) > RAD + 20) return;
        for (let cy = -RAD; cy <= RAD; cy += CELL) for (let cxx = -RAD; cxx <= RAD; cxx += CELL) {
          if (cxx * cxx + cy * cy > RAD * RAD) continue;
          if (Math.hypot(p[0] + cxx - x, p[1] + cy - y) < 23) cells[i].add(cxx + ',' + cy);
        }
      });
    }
    pos.forEach((p, i) => {
      if (done[i]) return;
      let tot = 0; for (let cy = -RAD; cy <= RAD; cy += CELL) for (let cxx = -RAD; cxx <= RAD; cxx += CELL) if (cxx * cxx + cy * cy <= RAD * RAD) tot++;
      if (cells[i].size > tot * .42) {
        done[i] = true; snd(syms[i] === lucky ? 880 : 400, .1, 'triangle', .06);
        if (fc) { fc.globalCompositeOperation = 'destination-out'; fc.beginPath(); fc.arc(p[0], p[1], RAD + 2, 0, 7); fc.fill(); fc.globalCompositeOperation = 'source-over'; }
        if (syms[i] === lucky) confetti(p[0], p[1], 10);
      }
    });
    if (pos.every((p, i) => !(syms[i] === lucky) || done[i])) { g.result = 'win'; snd(900, .2); }
  };
  const g = {
    cmd: 'SCRATCH!', hint: 'SCRATCH FOR BOTH LUCKY SYMBOLS', thint: 'SCRATCH FOR BOTH LUCKY SYMBOLS', dur: 5.8,
    down(p) { if (g.result) return; pr = true; lp = { x: p.x, y: p.y }; scratch(lp, lp); },
    move(p) { if (!pr || g.result) return; scratch(lp, p); lp = { x: p.x, y: p.y }; if (Math.random() < .2) snd(900 + Math.random() * 400, .02, 'sawtooth', .02); },
    up() { pr = false; },
    update() {},
    draw(t) {
      bg('#FFB3C7', '#ffa3ba', t);
      box(80, 100, 640, 480, '#ffe9a8', 7);
      box(140, 112, 520, 64, '#fff', 5); txt('LUCKY', 255, 144, 34, '#ff4d9e'); box(360, 118, 60, 52, '#fff', 3); sym(lucky, 390, 144, .55);
      txt('= WIN', 520, 144, 34, '#ff4d9e');
      pos.forEach((p, i) => { circ(p[0], p[1], RAD, '#fff', 5); sym(syms[i], p[0], p[1], 1); });
      if (foil) ctx.drawImage(foil, 0, 0);
      else pos.forEach((p, i) => { if (!done[i]) circ(p[0], p[1], RAD, '#aab3c2', 0); });
      pos.forEach((p, i) => { if (!done[i]) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p[0], p[1], RAD, 0, 7); ctx.stroke(); } });
      pos.forEach((p, i) => { if (done[i] && syms[i] === lucky) { ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(p[0], p[1], RAD + 7, 0, 7); ctx.stroke(); } });
    }
  };
  return g;
}

/* ── 10 ── STRAIGHT FACES: click each row to make the face match the poster */
function dsFaces(sp) {
  const N = sp > 1.5 ? 5 : 4, RW = 240, RH = 104, SY = 150;
  const feat = (row, i, x, y) => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.fillStyle = INK;
    if (row === 0) {
      if (i === 0) { circ(x - 46, y, 11, INK, 0); circ(x + 46, y, 11, INK, 0); }
      else if (i === 1) { circ(x - 46, y + 4, 10, INK, 0); circ(x + 46, y + 4, 10, INK, 0); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 68, y - 22); ctx.lineTo(x - 28, y - 8); ctx.moveTo(x + 68, y - 22); ctx.lineTo(x + 28, y - 8); ctx.stroke(); }
      else if (i === 2) { ctx.lineWidth = 8; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 46, y + 8, 18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
      else if (i === 3) { for (const s of [-1, 1]) { circ(x + s * 46, y, 26, '#fff', 4); circ(x + s * 46 + s * -4, y + 6, 10, INK, 0); } }
      else { for (const s of [-1, 1]) star(x + s * 46, y, 22, 10, 5, -Math.PI / 2, '#FFE14D', 3); }
    } else if (row === 1) {
      if (i === 0) circ(x, y, 14, '#ff9f4d', 4);
      else if (i === 1) { ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 18, y + 16); ctx.lineTo(x - 18, y + 16); ctx.closePath(); ctx.lineWidth = 8; ctx.stroke(); ctx.fillStyle = '#ff9f4d'; ctx.fill(); }
      else if (i === 2) { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x, y + 20); ctx.lineTo(x + 14, y + 20); ctx.stroke(); }
      else if (i === 3) { ctx.beginPath(); ctx.ellipse(x, y, 26, 18, 0, 0, 7); ctx.lineWidth = 8; ctx.stroke(); ctx.fillStyle = '#ff8fb8'; ctx.fill(); ctx.fillStyle = INK; ctx.fillRect(x - 12, y - 6, 7, 12); ctx.fillRect(x + 6, y - 6, 7, 12); }
      else circ(x, y, 24, '#ff4d4d', 4);
    } else {
      if (i === 0) { ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y - 18, 40, .35, Math.PI - .35); ctx.stroke(); }
      else if (i === 1) { ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y + 30, 40, Math.PI + .35, -.35); ctx.stroke(); }
      else if (i === 2) { ctx.beginPath(); ctx.ellipse(x, y, 20, 26, 0, 0, 7); ctx.lineWidth = 8; ctx.stroke(); ctx.fillStyle = '#6b1f2a'; ctx.fill(); }
      else if (i === 3) { ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x, y - 18, 40, .35, Math.PI - .35); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + 8, y + 22, 13, 18, 0, 0, 7); ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = '#ff4d6e'; ctx.fill(); }
      else { ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x - 50, y); for (let q = 1; q <= 6; q++) ctx.lineTo(x - 50 + q * 100 / 6, y + (q % 2 ? 14 : -14)); ctx.stroke(); }
    }
    ctx.lineCap = 'butt';
  };
  const tgt = [0, 1, 2].map(() => Math.random() * N | 0);
  const rows = [0, 1, 2].map(r => ({ idx: tgt[r], prev: 0, anim: 1 }));
  const wrong = shuffle([0, 1, 2]).slice(0, 2 + (Math.random() < .5 ? 1 : 0));
  for (const r of wrong) rows[r].idx = (tgt[r] + 1 + (Math.random() * (N - 1) | 0)) % N;
  let press = null;
  const cyc = (r, d) => {
    if (g.result) return; const o = rows[r]; o.prev = o.idx; o.idx = (o.idx + d + N) % N; o.anim = 0; o.d = d; snd(400 + r * 120, .05, 'square', .05);
    if (rows.every((q, i) => q.idx === tgt[i])) { g.result = 'win'; snd(900, .2); confetti(580, 300, 36); }
  };
  const rowAt = p => { for (let r = 0; r < 3; r++) if (p.x > 460 && p.x < 460 + RW && p.y > SY + r * RH && p.y < SY + (r + 1) * RH) return r; return -1; };
  const g = {
    cmd: 'MATCH!', hint: 'CLICK EACH ROW TO CHANGE IT (OR 1 2 3)', thint: 'TAP EACH ROW TO CHANGE IT', dur: 5.5,
    down(p) { if (g.result) return; const r = rowAt(p); press = r >= 0 ? { r, y: p.y } : null; },
    up(p) { if (!press) return; const dy = p.y - press.y; cyc(press.r, Math.abs(dy) > 30 ? (dy < 0 ? 1 : -1) : 1); press = null; },
    key(e) { const m = /^Digit([123])$/.exec(e.code || ''); if (m) cyc(+m[1] - 1, 1); },
    update(dt) { for (const r of rows) r.anim = Math.min(1, r.anim + dt * 8); },
    draw(t) {
      bg('#FFD5A5', '#ffc995', t);
      const drawRow = (x, r, idx, prev, anim, d, base) => {
        ctx.save(); ctx.beginPath(); ctx.rect(x, SY + r * RH, RW, RH); ctx.clip();
        ctx.fillStyle = base; ctx.fillRect(x, SY + r * RH, RW, RH);
        const cy = SY + r * RH + RH / 2;
        if (anim < 1) { const e = anim * anim * (3 - 2 * anim); feat(r, prev, x + RW / 2, cy - e * RH * d); feat(r, idx, x + RW / 2, cy + (1 - e) * RH * d); }
        else feat(r, idx, x + RW / 2, cy);
        ctx.restore();
      };
      // poster
      txt('MAKE THIS', 220, 100, 28, '#fff');
      ctx.fillStyle = INK; ctx.fillRect(96 - 4, SY - 4, RW + 8, RH * 3 + 8);
      for (let r = 0; r < 3; r++) drawRow(100, r, tgt[r], 0, 1, 1, '#C8F7C5');
      ctx.fillStyle = INK; ctx.fillRect(100, SY + RH - 2, RW, 4); ctx.fillRect(100, SY + RH * 2 - 2, RW, 4);
      txt('YOURS', 580, 100, 28, '#fff');
      ctx.fillStyle = INK; ctx.fillRect(456, SY - 4, RW + 8, RH * 3 + 8);
      for (let r = 0; r < 3; r++) {
        drawRow(460, r, rows[r].idx, rows[r].prev, rows[r].anim, rows[r].d || 1, '#FFE0A8');
        if (rows[r].idx === tgt[r]) { ctx.fillStyle = 'rgba(92,255,122,.28)'; ctx.fillRect(460, SY + r * RH, RW, RH); }
      }
      ctx.fillStyle = INK; ctx.fillRect(460, SY + RH - 2, RW, 4); ctx.fillRect(460, SY + RH * 2 - 2, RW, 4);
      for (let r = 0; r < 3; r++) txt('' + (r + 1), 722, SY + r * RH + RH / 2, 28, '#fff');
      txt('=', 400, SY + RH * 1.5, 50, '#fff');
      if (g.result === 'win') claude(400, 570, 6, { mood: 'happy' });
    }
  };
  return g;
}

/* ── 11 ── CATCH A TUNE: drag the dial until the picture is clear */
function dsTune(sp) {
  const spot = dsRnd(.15, .85); let d = spot + (Math.random() < .5 ? -1 : 1) * dsRnd(.32, .48);
  d = Math.max(.02, Math.min(.98, d)); if (Math.abs(d - spot) < .3) d = spot < .5 ? .95 : .05;
  const SX = 130, SW = 540; let pr = false, hold = 0, beep = 0;
  const clarity = () => Math.pow(Math.max(0, 1 - Math.abs(d - spot) / .3), 2);
  const g = {
    cmd: 'TUNE!', hint: 'DRAG THE DIAL (OR ← →) TILL IT IS CLEAR', thint: 'DRAG THE DIAL TILL IT IS CLEAR', dur: 5.4,
    down(p) { if (g.result) return; pr = true; d = Math.max(0, Math.min(1, (p.x - SX) / SW)); },
    move(p) { if (pr && !g.result) d = Math.max(0, Math.min(1, (p.x - SX) / SW)); },
    up() { pr = false; },
    update(dt) {
      if (g.result) return;
      const kk = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      if (kk) d = Math.max(0, Math.min(1, d + kk * .45 * dt * Math.sqrt(sp)));
      beep -= dt; if (beep <= 0) { beep = .12; snd(180 + clarity() * 900, .06, 'triangle', .03); }
      if (Math.abs(d - spot) < .035) { hold += dt; if (hold > .45) { g.result = 'win'; snd(900, .2); confetti(400, 260, 30); } } else hold = Math.max(0, hold - dt);
    },
    draw(t) {
      bg('#FFC89B', '#ffba85', t);
      ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(250, 110); ctx.lineTo(180, 40); ctx.moveTo(550, 110); ctx.lineTo(620, 50); ctx.stroke();
      circ(180, 40, 8, '#ff4d4d', 3); circ(620, 50, 8, '#ff4d4d', 3);
      box(90, 110, 620, 440, '#c97b4a', 6);
      box(160, 140, 480, 290, INK, 5);
      const SXs = 180, SYs = 150, SWs = 440, SHs = 270, cl = g.result ? 1 : clarity();
      ctx.fillStyle = '#9BF6FF'; ctx.fillRect(SXs, SYs, SWs, SHs);
      ctx.fillStyle = '#58c24a'; ctx.fillRect(SXs, SYs + 200, SWs, 70);
      circ(SXs + 360, SYs + 60, 32, '#FFE14D', 4);
      claude(SXs + 220, SYs + 250, 11, { mood: cl > .85 ? 'happy' : null });
      // static
      const n = Math.round(60 + 1100 * (1 - cl));
      if (cl < .98) for (let i = 0; i < n; i++) {
        const x = SXs + ((Math.random() * (SWs / 10)) | 0) * 10, y = SYs + ((Math.random() * (SHs / 10)) | 0) * 10, v = (Math.random() * 255) | 0;
        ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 10, 10);
      }
      if (cl < .98) { ctx.fillStyle = 'rgba(120,120,120,' + (1 - cl) * .55 + ')'; ctx.fillRect(SXs, SYs, SWs, SHs); }
      // dial
      box(120, 455, 560, 66, '#f4e2c4', 5);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i <= 20; i++) { const x = SX + i * SW / 20; ctx.beginPath(); ctx.moveTo(x, 470); ctx.lineTo(x, i % 5 ? 484 : 494); ctx.stroke(); }
      const kx = SX + d * SW; box(kx - 7, 462, 14, 52, '#ff4d4d', 3);
      txt('FM ' + (88 + d * 20).toFixed(1), 400, 530, 20, INK);
      if (hold > 0 && !g.result) { ctx.fillStyle = '#5CFF7A'; ctx.fillRect(SXs, SYs + SHs - 8, SWs * Math.min(1, hold / .45), 8); }
    }
  };
  return g;
}

/* ── 12 ── HOT FLASH: flick every layer off before the thermometer pops */
function dsStrip(sp) {
  const durA = 4.8 / Math.sqrt(sp), X = 330, Y = 520, U = 17;
  const L = [
    { id: 'hat', r: { x: X - 7.5 * U, y: Y - 14 * U, w: 15 * U, h: 6 * U }, acc: 0, on: true },
    { id: 'scarf', r: { x: X - 6 * U, y: Y - 5.6 * U, w: 12 * U, h: 3.2 * U }, acc: 0, on: true },
    { id: 'mitts', r: { x: X - 10.5 * U, y: Y - 8.5 * U, w: 21 * U, h: 5 * U }, acc: 0, on: true, split: true },
    { id: 'boots', r: { x: X - 6 * U, y: Y - 3.2 * U, w: 12 * U, h: 4.2 * U }, acc: 0, on: true }
  ];
  const fly = []; let pr = false, lp = null, clock = 0, left = 4;
  const drawL = (id, ox, oy) => {
    const x = X + ox, y = Y + oy;
    if (id === 'hat') { box(x - 6.6 * U, y - 12.4 * U, 13.2 * U, 3.4 * U, '#4DB8FF', 4); box(x - 5.4 * U, y - 14 * U, 10.8 * U, 2 * U, '#4DB8FF', 4); circ(x, y - 14.6 * U, 1.5 * U, '#fff', 4); ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * 2 * U - 2, y - 12.2 * U, 4, 3 * U); }
    else if (id === 'scarf') { box(x - 6.4 * U, y - 5.6 * U, 12.8 * U, 2.8 * U, '#ff4d4d', 4); ctx.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 1.8 * U - 3, y - 5.6 * U, 6, 2.8 * U); box(x + 3.4 * U, y - 3 * U, 2.4 * U, 3.4 * U, '#ff4d4d', 4); }
    else if (id === 'mitts') { box(x - 9.6 * U, y - 7.4 * U, 3.6 * U, 3.6 * U, '#5CFF7A', 4); box(x + 6 * U, y - 7.4 * U, 3.6 * U, 3.6 * U, '#5CFF7A', 4); }
    else { box(x - 5.6 * U, y - 2.8 * U, 4.2 * U, 3.8 * U, '#9a6a3c', 4); box(x + 1.4 * U, y - 2.8 * U, 4.2 * U, 3.8 * U, '#9a6a3c', 4); }
  };
  const hit = (p, l) => dsPtIn(p.x, p.y, { x: l.r.x - 12, y: l.r.y - 12, w: l.r.w + 24, h: l.r.h + 24 });
  const strip = l => {
    l.on = false; left--; snd(500 + left * 120, .1, 'triangle', .07, 0, 900);
    fly.push({ id: l.id, x: 0, y: 0, vx: (Math.random() < .5 ? -1 : 1) * dsRnd(300, 600), vy: -dsRnd(300, 500), r: 0 });
    if (!left) { g.result = 'win'; snd(900, .2); confetti(X, 300, 36); }
  };
  const g = {
    cmd: 'STRIP!', hint: 'FLICK EVERY LAYER OFF THE CLAUDE', thint: 'SWIPE EVERY LAYER OFF', dur: 4.8,
    down(p) { if (g.result) return; pr = true; lp = { x: p.x, y: p.y }; },
    move(p) {
      if (!pr || g.result) return;
      const d = Math.hypot(p.x - lp.x, p.y - lp.y);
      for (const l of L) if (l.on && hit(p, l)) { l.acc += d; if (l.acc > 55) strip(l); }
      lp = { x: p.x, y: p.y };
    },
    up() { pr = false; },
    update(dt) {
      if (!g.result) clock += dt;
      for (const f of fly) { f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vx * dt / 80; }
    },
    draw(t) {
      const heat = Math.min(1, clock / durA), cool = g.result === 'win';
      bg(cool ? '#9BE7FF' : heat > .7 ? '#ff7a4d' : '#FF9E5E', cool ? '#8ad9f5' : '#ff8f45', t);
      ctx.fillStyle = INK; ctx.fillRect(0, Y, W, 100); ctx.fillStyle = cool ? '#cfeeff' : '#f0d9a0'; ctx.fillRect(0, Y + 6, W, 100);
      claude(X, Y, U, { col: heat > .55 && !cool ? '#e8452f' : OR, mood: cool ? 'happy' : null });
      for (const l of L) if (l.on) drawL(l.id, 0, 0);
      for (const f of fly) { ctx.save(); ctx.translate(X + f.x, Y + f.y); ctx.rotate(f.r); ctx.translate(-X, -Y); drawL(f.id, 0, 0); ctx.restore(); }
      if (!cool) for (let i = 0; i < 1 + heat * 5; i++) { const ph = (t * 1.4 + i * .37) % 1, sx = X + (i % 2 ? 1 : -1) * (30 + i * 12); ctx.fillStyle = '#7fd4ff'; ctx.beginPath(); ctx.arc(sx, Y - 9 * U + ph * 70, 6, 0, 7); ctx.fill(); }
      if (cool) for (let i = 0; i < 4; i++) star(150 + i * 140 + Math.sin(t * 3 + i) * 10, 150 + (i % 2) * 40, 18, 8, 6, t, '#fff', 3);
      // thermometer
      box(690, 130, 34, 300, '#fff', 5); circ(707, 455, 30, '#fff', 5);
      circ(707, 455, 22, '#ff4d4d', 0); const hh = 280 * (cool ? .1 : heat);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(697, 428 - hh, 20, hh + 8);
      ctx.fillStyle = INK; for (let i = 0; i < 6; i++) ctx.fillRect(724, 140 + i * 48, 14, 4);
      if (heat >= .999 && !g.result) dsBoom(707, 130, 60, t);
    }
  };
  return g;
}

reg('ds_ramp', dsRamp, 'RAMP IT UP');
reg('ds_creep', dsCreep, 'MIDNIGHT WEIRDO');
reg('ds_fuse', dsFuse, 'SHORT FUSE');
reg('ds_loop', dsLoop, 'IN THE LOOP');
reg('ds_cage', dsCage, 'CAGE MATCH');
reg('ds_fan', dsFan, 'TOUCHDOWN');
reg('ds_pose', dsPose, 'DEAD SIMON SAYS');
reg('ds_sink', dsSink, 'SINKING FEELING');
reg('ds_scratch', dsScratch, 'SCRATCH AND MATCH');
reg('ds_faces', dsFaces, 'STRAIGHT FACES');
reg('ds_tune', dsTune, 'CATCH A TUNE');
reg('ds_strip', dsStrip, 'HOT FLASH');
