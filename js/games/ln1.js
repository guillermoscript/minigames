'use strict';
/* LINES & LIGHT - drawing, tracing and light microgames: SEW EASY, ROAD WORK, HOOKIN' UP, WHAT'S YOUR SIGN?,
   MAGNAFIRE, GREEN THUMB, DIRE PLATES, ON THE EDGE.
   Every game works with touch (down/move/up with logical coordinates, targets >= 56px, no hover, no chords) and
   with mouse + keyboard (arrow keys / digits as the alternative to dragging).
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose'.
   The real time limit is dur / sqrt(sp) (see main.js), so every game keeps its own clock D = dur / rs. */
(function () {

const NAVY = '#1E2A5A', NAVY2 = '#2A3B78', CYAN = '#35D0E8', AMB = '#FFC93C', CORAL = '#FF6B6B', LIME = '#8DF06B',
  PLUM = '#9B6BFF', PINK = '#FF8AD8', PAP = '#FFF1D0', RED = '#ff4d4d';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lnMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const lnLose = (msg, x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); floatText(msg, x, y, RED, 46); };
const lnWin = (msg, x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 36); ring(x, y, '#fff', 110); floatText(msg, x, y - 110, AMB, 48); };

function lnBG(t) {
  bg(NAVY, NAVY2, t);
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}
function lnBar(x, y, w, v, col, label) {
  box3(x, y, w, 26, '#fff', 4, 4); ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(v, 0, 1), 26);
  txt(label, x + w / 2, y + 13, 18, '#fff');
}
function lnMascot(g, x, y, u) { shadow(x, y + 2, u * 8, u * 1.6, .3); claude(x, y, u, { mood: lnMood(g) }); }

/* A path sampled from f(u), u in 0..1. near() only looks at samples whose arc length lies in [s0, s1],
   which is what stops a player from "skipping" along the line. */
function lnPath(f, n = 240) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const p = f(i / n); pts.push({ x: p[0], y: p[1], s: 0 }); }
  for (let i = 1; i <= n; i++) pts[i].s = pts[i - 1].s + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const len = pts[n].s;
  const at = s => {
    s = clamp(s, 0, len); let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], k = (s - a.s) / ((b.s - a.s) || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const near = (x, y, s0, s1) => {
    let bd = 1e9, bs = s0;
    for (const p of pts) { if (p.s < s0 || p.s > s1) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; bs = p.s; } }
    return { d: bd, s: bs };
  };
  const stroke = (s0, s1) => {
    if (s1 <= s0) return;
    const a = at(s0); ctx.beginPath(); ctx.moveTo(a.x, a.y);
    for (const p of pts) if (p.s > s0 && p.s < s1) ctx.lineTo(p.x, p.y);
    const e = at(s1); ctx.lineTo(e.x, e.y); ctx.stroke();
  };
  return { pts, len, at, near, stroke };
}

/* The thing the player moves. Pointer: while held it homes in on the finger/mouse at a limited speed (so it can
   never teleport past a gate); keyboard: arrows / WASD move it directly. Hovering without pressing does nothing. */
function lnTool(x, y, spd, kspd, bx0 = 24, bx1 = 776, by0 = 118, by1 = 545) {
  const T = { x, y, tx: x, ty: y, held: false, used: false };
  T.down = p => { T.held = true; T.used = true; T.tx = p.x; T.ty = p.y; };
  T.move = p => { if (T.held) { T.tx = p.x; T.ty = p.y; } };
  T.up = () => { T.held = false; };
  T.step = (dt, fix) => {
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) dx--; if (keys.ArrowRight || keys.KeyD) dx++;
    if (keys.ArrowUp || keys.KeyW) dy--; if (keys.ArrowDown || keys.KeyS) dy++;
    if (dx || dy) {
      const l = Math.hypot(dx, dy); T.x += dx / l * kspd * dt; T.y += dy / l * kspd * dt; T.tx = T.x; T.ty = T.y; T.used = true;
    } else if (T.held) {
      const ex = T.tx - T.x, ey = T.ty - T.y, d = Math.hypot(ex, ey), m = spd * dt;
      if (d > m) { T.x += ex / d * m; T.y += ey / d * m; } else { T.x = T.tx; T.y = T.ty; }
    }
    T.x = clamp(T.x, bx0, bx1); T.y = clamp(T.y, by0, by1);
    if (fix) fix(T);
  };
  return T;
}

/* 1 SEW EASY: drag the needle along the dashed line to stitch it */
function lnNeedle(x, y, a) {   // tip at x,y
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(-84, 0); ctx.lineTo(0, 0); ctx.stroke();
  ctx.strokeStyle = '#e6edff'; ctx.lineWidth = 7; ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-72, 0, 8, 3.5, 0, 0, 7); ctx.fill();
  ctx.restore(); ctx.lineCap = 'butt';
}
function lnSew(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, TOL = Math.max(30, 38 - 5 * (rs - 1));
  const dir = Math.random() < .5 ? 1 : -1, amp = 68 + 16 * Math.min(rs, 1.8);
  const path = lnPath(u => [90 + 620 * u, 310 + dir * amp * Math.sin(u * Math.PI * 2)]);
  const tool = lnTool(90, 310, 900, 340);
  let c = 0, prog = 0, stitch = 0, off = 0;
  const g = {
    cmd: 'SEW!', hint: 'DRAG THE NEEDLE ALONG THE LINE (OR ARROWS)', thint: 'DRAG THE NEEDLE ALONG THE LINE', dur: 5.8,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      tool.step(dt);
      const nr = path.near(tool.x, tool.y, Math.max(0, prog - 25), prog + 90);
      if (nr.d <= TOL) { off = 0; if (nr.s > prog) prog = nr.s; } else off += dt;
      const st = Math.floor(prog / 48); if (st !== stitch) { stitch = st; sfx.tickHi(); }
      if (prog >= path.len - 10) { g.result = 'win'; lnWin('STITCHED!'); }
      else if (c >= D - .03) { g.result = 'lose'; lnLose('UNRAVELED!'); }
    },
    draw(t) {
      lnBG(t);
      box3(40, 140, 720, 340, PAP, 5, 7);
      ctx.strokeStyle = 'rgba(20,16,28,.07)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 56; x < 760; x += 16) { ctx.moveTo(x, 144); ctx.lineTo(x, 476); }
      for (let y = 156; y < 476; y += 16) { ctx.moveTo(44, y); ctx.lineTo(756, y); }
      ctx.stroke();
      ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      ctx.setLineDash([16, 14]); ctx.strokeStyle = '#6f7db5'; ctx.lineWidth = 6; path.stroke(0, path.len);
      ctx.setLineDash([22, 12]); ctx.strokeStyle = INK; ctx.lineWidth = 13; path.stroke(0, prog);
      ctx.strokeStyle = CORAL; ctx.lineWidth = 8; path.stroke(0, prog); ctx.setLineDash([]);
      const e = path.at(path.len), p0 = path.at(0);
      circ(p0.x, p0.y, 11 + Math.sin(now * 6) * 2, AMB, 4); circ(e.x, e.y, 11, LIME, 4);
      const a0 = path.at(prog - 8), a1 = path.at(prog + 8), ang = Math.atan2(a1.y - a0.y, a1.x - a0.x);
      // thread from the last stitch to the needle's eye
      const pe = path.at(prog);
      ctx.strokeStyle = CORAL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pe.x, pe.y); ctx.lineTo(tool.x - Math.cos(ang) * 72, tool.y - Math.sin(ang) * 72); ctx.stroke();
      lnNeedle(tool.x, tool.y, ang);
      if (!g.result && off > .15) { ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tool.x, tool.y, 26 + Math.sin(now * 20) * 3, 0, 7); ctx.stroke(); }
      if (!g.result && !tool.used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p0.x, p0.y, 30 + Math.sin(now * 6) * 5, 0, 7); ctx.stroke(); }
      lnBar(250, 516, 300, prog / path.len, CORAL, 'STITCHES');
      lnMascot(g, 720, 548, 4.5);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_sew', lnSew, 'Sew Easy');

/* 2 ROAD WORK: drag the paver along the route and stay ahead of the roller */
function lnRoad(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, TOL = 52, dir = Math.random() < .5 ? 1 : -1;
  const path = lnPath(u => [400 + dir * 165 * Math.sin(u * Math.PI * 2), 135 + 390 * u]);
  const tool = lnTool(path.at(0).x, path.at(0).y, 900, 340, 60, 740, 118, 545);
  const RV = path.len / D * .72;
  let c = 0, prog = 0, roll = -130, stitch = 0;
  const g = {
    cmd: 'PAVE!', hint: 'DRAG THE PAVER, OUTRUN THE ROLLER (OR ARROWS)', thint: 'DRAG THE PAVER, OUTRUN THE ROLLER', dur: 5.8,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      tool.step(dt);
      const nr = path.near(tool.x, tool.y, Math.max(0, prog - 25), prog + 90);
      if (nr.d <= TOL && nr.s > prog) prog = nr.s;
      const st = Math.floor(prog / 60); if (st !== stitch) { stitch = st; sfx.tick(); }
      if (c > 1) roll += RV * dt;
      if (prog >= path.len - 10) { g.result = 'win'; lnWin('PAVED!'); }
      else if (roll >= prog - 6 && c > 1) { g.result = 'lose'; lnLose('SQUASHED!'); }
      else if (c >= D - .03) { g.result = 'lose'; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      lnBG(t);
      box3(30, 105, 740, 440, '#C9A97A', 5, 7);
      ctx.fillStyle = 'rgba(20,16,28,.08)'; for (let i = 0; i < 30; i++) ctx.fillRect(50 + (i * 97) % 700, 120 + (i * 61) % 410, 8, 5);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 86; path.stroke(0, path.len);
      ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 76; path.stroke(0, path.len);
      ctx.setLineDash([14, 16]); ctx.lineCap = 'butt'; ctx.strokeStyle = AMB; ctx.lineWidth = 5; path.stroke(0, path.len); ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 86; path.stroke(0, prog);
      ctx.strokeStyle = '#4a5080'; ctx.lineWidth = 76; path.stroke(0, prog);
      ctx.setLineDash([16, 14]); ctx.lineCap = 'butt'; ctx.strokeStyle = AMB; ctx.lineWidth = 6; path.stroke(0, prog); ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      const e = path.at(path.len); ctx.fillStyle = INK; ctx.fillRect(e.x - 44, e.y - 6, 88, 12); ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) ctx.fillRect(e.x - 44 + i * 22, e.y - 6 + (i & 1) * 6, 22, 6);
      // roller
      const rp = roll < 0 ? { x: path.at(0).x, y: path.at(0).y + roll } : path.at(roll), gap = prog - roll;
      if (c > .2 && rp.y > 90) {
        shadow(rp.x, rp.y + 30, 42, 10, .3);
        circ(rp.x - 28, rp.y + 6, 22, '#cfd6ff', 4); circ(rp.x + 28, rp.y + 6, 22, '#cfd6ff', 4);
        box3(rp.x - 30, rp.y - 36, 60, 38, CORAL, 4, 3);
        ctx.fillStyle = INK; ctx.fillRect(rp.x - 18, rp.y - 26, 10, 8); ctx.fillRect(rp.x + 8, rp.y - 26, 10, 8);
        ctx.fillRect(rp.x - 22, rp.y - 32, 18, 4); ctx.fillRect(rp.x + 4, rp.y - 32, 18, 4);
      }
      if (!g.result && c > .3 && gap < 150 && Math.sin(now * 16) > 0) txt('!', Math.min(740, tool.x + 62), tool.y - 44, 44, AMB);
      // paver
      shadow(tool.x, tool.y + 28, 40, 9, .3);
      circ(tool.x - 28, tool.y + 22, 11, '#555d8c', 3); circ(tool.x + 28, tool.y + 22, 11, '#555d8c', 3);
      box3(tool.x - 36, tool.y - 26, 72, 46, AMB, 4, 3);
      ctx.fillStyle = INK; for (let i = 0; i < 4; i++) ctx.fillRect(tool.x - 32 + i * 18, tool.y + 8, 9, 7);
      box(tool.x - 12, tool.y - 40, 24, 16, '#fff', 3);
      if (!g.result && !tool.used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tool.x, tool.y, 50 + Math.sin(now * 6) * 5, 0, 7); ctx.stroke(); }
      lnBar(44, 120, 150, prog / path.len, AMB, 'ROAD');
      lnMascot(g, 720, 540, 4);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_road', lnRoad, 'Road Work');

/* 3 HOOKIN' UP: drag the cable around the rocks and plug it into the socket */
function lnCable(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, flip = Math.random() < .5 ? 1 : -1, jy = (Math.random() - .5) * 50;
  const Y = y => 345 + (y - 345) * flip;
  const A = { x: 96, y: Y(345 + jy) }, B = { x: 706, y: Y(345 - jy) };
  const rocks = [{ x: 400, y: Y(345 + (Math.random() - .5) * 30), r: 82 }, { x: 250, y: Y(425), r: 44 }, { x: 560, y: Y(265), r: 46 }];
  const MAXL = 1200, HR = 17;
  const tool = lnTool(A.x, A.y, 850, 330, 30, 770, 118, 545);
  const trail = [{ x: A.x, y: A.y }];
  let c = 0, bump = 0, used = 0;
  const fix = T => {
    for (const r of rocks) {
      const dx = T.x - r.x, dy = T.y - r.y, d = Math.hypot(dx, dy) || 1, m = r.r + HR;
      if (d < m) { T.x = r.x + dx / d * m; T.y = r.y + dy / d * m; if (bump <= 0) { bump = .25; sfx.tick(); } }
    }
  };
  const g = {
    cmd: 'PLUG IN!', hint: 'DRAG THE CABLE AROUND THE ROCKS TO THE SOCKET (OR ARROWS)', thint: 'DRAG THE CABLE AROUND THE ROCKS TO THE SOCKET', dur: 5.8,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; bump = Math.max(0, bump - dt); if (g.result) return;
      tool.step(dt, fix);
      const last = trail[trail.length - 1];
      if (Math.hypot(tool.x - last.x, tool.y - last.y) > 9) trail.push({ x: tool.x, y: tool.y });
      if (trail.length > 2) { const pv = trail[trail.length - 2]; if (Math.hypot(tool.x - pv.x, tool.y - pv.y) < 7) trail.pop(); }
      used = 0; for (let i = 1; i < trail.length; i++) used += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      used += Math.hypot(tool.x - trail[trail.length - 1].x, tool.y - trail[trail.length - 1].y);
      if (Math.hypot(tool.x - B.x, tool.y - B.y) < 36) {
        tool.x = B.x; tool.y = B.y; g.result = 'win'; sfx.zap(); lnWin('CONNECTED!'); burst(B.x, B.y - 80, AMB, 18);
      } else if (used > MAXL) { g.result = 'lose'; lnLose('OUT OF CABLE!'); }
      else if (c >= D - .03) { g.result = 'lose'; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      lnBG(t);
      for (const r of rocks) {
        shadow(r.x + 6, r.y + r.r - 6, r.r * .95, r.r * .28, .3);
        circ(r.x, r.y, r.r, bump > 0 ? '#c98a8a' : '#8c97c8', 5);
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(r.x - r.r * .3, r.y - r.r * .35, r.r * .35, r.r * .2, -.5, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.beginPath(); ctx.arc(r.x + r.r * .3, r.y + r.r * .2, r.r * .18, 0, 7); ctx.fill();
      }
      // power box and socket
      box3(A.x - 66, A.y - 34, 56, 68, '#9aa7d9', 4, 4);
      ctx.fillStyle = AMB; ctx.beginPath(); ctx.moveTo(A.x - 36, A.y - 22); ctx.lineTo(A.x - 52, A.y + 4); ctx.lineTo(A.x - 40, A.y + 4); ctx.lineTo(A.x - 46, A.y + 24); ctx.lineTo(A.x - 22, A.y - 4); ctx.lineTo(A.x - 34, A.y - 4); ctx.closePath(); ctx.fill();
      box3(B.x - 28, B.y - 46, 56, 92, '#e6edff', 4, 4);
      ctx.fillStyle = INK; ctx.fillRect(B.x - 16, B.y - 12, 8, 24); ctx.fillRect(B.x + 8, B.y - 12, 8, 24);
      const on = g.result === 'win';
      if (on) { ctx.fillStyle = 'rgba(255,201,60,.35)'; ctx.beginPath(); ctx.arc(B.x, B.y - 86, 50 + Math.sin(now * 12) * 4, 0, 7); ctx.fill(); }
      circ(B.x, B.y - 86, 15, on ? AMB : '#5d6aa3', 4);
      if (!g.result && Math.sin(now * 6) > -.3) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(B.x, B.y, 56 + Math.sin(now * 6) * 4, 0, 7); ctx.stroke(); }
      // cable
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const line = col => { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(A.x, A.y); for (const p of trail) ctx.lineTo(p.x, p.y); ctx.lineTo(tool.x, tool.y); ctx.stroke(); };
      ctx.lineWidth = 17; line(INK); ctx.lineWidth = 9; line(CORAL);
      // plug head
      ctx.save(); ctx.translate(tool.x, tool.y);
      ctx.fillStyle = INK; ctx.fillRect(2, -13, 18, 5); ctx.fillRect(2, 8, 18, 5);
      ctx.fillStyle = '#e6edff'; ctx.fillRect(4, -12, 14, 3); ctx.fillRect(4, 9, 14, 3);
      circ(-2, 0, HR - 2, AMB, 4); ctx.restore(); ctx.lineCap = 'butt';
      if (!g.result && !tool.used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tool.x, tool.y, 32 + Math.sin(now * 6) * 5, 0, 7); ctx.stroke(); }
      const left = 1 - used / MAXL;
      lnBar(250, 516, 300, left, left < .25 ? RED : AMB, 'CABLE');
      lnMascot(g, 90, 548, 4.5);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_cable', lnCable, "Hookin' Up");

/* 4 WHAT'S YOUR SIGN?: connect the numbered stars in order (tap them, or drag through them) */
function lnSign(sp) {
  const rs = Math.sqrt(sp), D = 5.6 / rs, N = rs > 1.4 ? 6 : 5, R = 62;
  const pts = []; let md = 190;
  for (let i = 0; i < N; i++) {
    let p, k = 0;
    do { p = { x: 110 + Math.random() * 540, y: 170 + Math.random() * 310, ph: Math.random() * 6 }; k++; if (k % 40 === 0) md -= 15; }
    while (pts.some(q => Math.hypot(q.x - p.x, q.y - p.y) < md));
    pts.push(p);
  }
  const dust = []; for (let i = 0; i < 40; i++) dust.push([Math.random() * W, Math.random() * H, Math.random() * 6]);
  let c = 0, nxt = 0, strikes = 0, held = false, ptr = { x: 400, y: 300 };
  const hit = (p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y) <= R;
  const connect = () => {
    const s = pts[nxt]; sfx.blip(nxt * 2); sfx.sparkle(); burst(s.x, s.y, AMB, 12); ring(s.x, s.y, '#fff', 70, .35); nxt++;
    if (nxt >= N) { g.result = 'win'; lnWin('CONSTELLATION!'); }
  };
  const strike = i => {
    strikes++; sfx.miss(); shake(4, .15); floatText('WRONG STAR!', pts[i].x, pts[i].y - 56, RED, 30);
    if (strikes >= 3) { g.result = 'lose'; lnLose('LOST IN SPACE!'); }
  };
  const g = {
    cmd: 'CONNECT!', hint: 'CLICK THE STARS IN ORDER (OR PRESS THEIR NUMBERS)', thint: 'TAP OR DRAG THROUGH THE STARS IN ORDER', dur: 5.6,
    down(p) {
      held = true; ptr = p; if (g.result) return;
      if (hit(p, nxt)) connect(); else for (let i = nxt + 1; i < N; i++) if (hit(p, i)) { strike(i); break; }
    },
    move(p) { ptr = p; if (!held || g.result) return; if (nxt < N && hit(p, nxt)) connect(); },
    up() { held = false; },
    key(e) {
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || ''); if (!m || e.repeat || g.result) return;
      const n = +m[1] - 1; if (n < 0 || n >= N) return;
      if (n === nxt) connect(); else if (n > nxt) strike(n);
    },
    keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      if (c >= D - .03) { g.result = 'lose'; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      lnBG(t);
      for (const d of dust) { ctx.globalAlpha = .35 + .35 * Math.sin(now * 2 + d[2]); ctx.fillStyle = '#fff'; ctx.fillRect(d[0], d[1], 4, 4); }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const seg = (a, b, w1, w2, col) => { ctx.lineWidth = w1; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.lineWidth = w2; ctx.strokeStyle = col; ctx.stroke(); };
      for (let i = 0; i + 1 < nxt; i++) seg(pts[i], pts[i + 1], 12, 6, CYAN);
      if (held && !g.result && nxt > 0 && nxt < N) { ctx.setLineDash([10, 12]); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(pts[nxt - 1].x, pts[nxt - 1].y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke(); ctx.setLineDash([]); }
      ctx.lineCap = 'butt';
      for (let i = 0; i < N; i++) {
        const p = pts[i], done = i < nxt, isNext = i === nxt && !g.result, k = isNext ? 1 + Math.sin(now * 7) * .1 : 1;
        shadow(p.x, p.y + 46, 28, 7, .22);
        star(p.x, p.y, 46 * k, 22 * k, 5, -Math.PI / 2 + Math.sin(now + p.ph) * .08, done ? AMB : PAP, 5);
        txt(String(i + 1), p.x, p.y + 4, 30, INK);
        if (isNext) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, 58 + Math.sin(now * 7) * 4, 0, 7); ctx.stroke(); }
      }
      for (let i = 0; i < 3; i++) circ(40 + i * 40, 520, 11, i < strikes ? RED : '#fff', 4);
      lnMascot(g, 730, 548, 4.5);
      vignette(.22);
    }
  };
  return g;
}
reg('ln_sign', lnSign, "What's Your Sign?");

/* 5 MAGNAFIRE: the sun dot drifts; keep it steady on one spot of the paper until it ignites */
function lnMagna(sp) {
  const rs = Math.sqrt(sp), D = 5.6 / rs, T = 1.5 / Math.pow(rs, .6), R = 54, amp = 62 + 8 * Math.min(rs, 1.8);
  const tool = lnTool(400, 305, 800, 340, 160, 640, 150, 460);
  const p1 = Math.random() * 6, p2 = Math.random() * 6, dir = Math.random() < .5 ? 1 : -1, W1 = 1.9 + .3 * Math.min(rs, 1.8), smoke = [];
  let c = 0, heat = 0, hx = 400, hy = 305, dx = 0, dy = 0, spawn = 0, flame = 0, cx = 400, cy = 305;
  const g = {
    cmd: 'BURN!', hint: 'HOLD AND MOVE AGAINST THE DRIFT TO KEEP THE DOT STILL (OR ARROWS)', thint: 'DRAG AGAINST THE DRIFT TO KEEP THE SUN DOT STILL', dur: 5.6,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt;
      for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.t += dt; s.y -= 50 * dt; s.x += Math.sin(s.t * 5 + s.ph) * 20 * dt; if (s.t > 1) smoke.splice(i, 1); }
      if (g.result) { if (g.result === 'win') flame += dt; return; }
      tool.step(dt);
      const k = Math.min(1, c / .5);
      // a loop (never lingers, so doing nothing can't ignite it) plus a wobble; the finger has to circle the other way
      dx = amp * k * (Math.cos(c * W1 + p1) + .25 * Math.sin(c * 3.7 + p2));
      dy = amp * k * (dir * Math.sin(c * W1 + p1) + .25 * Math.cos(c * 3.3 + p2));
      cx = clamp(tool.x + dx, 165, 635); cy = clamp(tool.y + dy, 150, 460);
      if (heat <= 0) { hx = cx; hy = cy; }
      if (Math.hypot(cx - hx, cy - hy) < R) heat = Math.min(1, heat + dt / T);
      else heat = Math.max(0, heat - dt * 1.6);
      spawn -= dt; if (heat > .35 && spawn <= 0) { spawn = .09; smoke.push({ x: hx + (Math.random() - .5) * 14, y: hy, t: 0, ph: Math.random() * 6 }); }
      if (heat >= 1) { g.result = 'win'; sfx.zap(); lnWin('IGNITED!', hx, hy); burst(hx, hy, CORAL, 20); }
      else if (c >= D - .03) { g.result = 'lose'; lnLose('FIZZLED!'); }
    },
    draw(t) {
      lnBG(t);
      box3(150, 125, 500, 360, PAP, 5, 7);
      ctx.strokeStyle = 'rgba(20,16,28,.12)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let y = 165; y < 470; y += 30) { ctx.moveTo(172, y); ctx.lineTo(628, y); }
      ctx.stroke();
      // sun and light cone
      const SX = 705, SY = 175;
      ctx.save(); ctx.translate(SX, SY); ctx.rotate(now * .4); ctx.fillStyle = AMB;
      for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.fillRect(-5, -56, 10, 18); }
      ctx.restore(); circ(SX, SY, 30, '#FFE14D', 5);
      ctx.fillStyle = 'rgba(255,225,77,.2)'; ctx.beginPath(); ctx.moveTo(SX - 26, SY + 14); ctx.lineTo(SX + 18, SY + 24); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
      // scorch mark + smoke
      if (heat > 0) {
        const r = 6 + heat * 28;
        ctx.fillStyle = `rgba(90,50,30,${.25 + heat * .6})`; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(20,16,28,${heat * .7})`; ctx.beginPath(); ctx.arc(hx, hy, r * .5, 0, 7); ctx.fill();
      }
      for (const s of smoke) { ctx.globalAlpha = .5 * (1 - s.t); ctx.fillStyle = '#cfd6ff'; ctx.beginPath(); ctx.arc(s.x, s.y, 8 + s.t * 16, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (g.result === 'win') {
        for (let i = -1; i <= 1; i++) {
          const fh = (46 + Math.sin(now * 18 + i) * 10) * Math.min(1, flame * 5) * (i ? .7 : 1);
          ctx.beginPath(); ctx.moveTo(hx + i * 22 - 16, hy + 8); ctx.lineTo(hx + i * 22, hy - fh); ctx.lineTo(hx + i * 22 + 16, hy + 8); ctx.closePath();
          ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = i ? AMB : CORAL; ctx.fill();
        }
      } else if (!g.result) {
        ctx.setLineDash([8, 8]); ctx.strokeStyle = heat > 0 ? CORAL : 'rgba(20,16,28,.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
      // the sun dot
      if (!g.result || g.result === 'lose') {
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, 24 + Math.sin(now * 14) * 3, 0, 7); ctx.fill();
        circ(cx, cy, 12, '#fffbe0', 3);
      }
      if (!g.result && !tool.used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 40 + Math.sin(now * 6) * 5, 0, 7); ctx.stroke(); }
      lnBar(250, 512, 300, heat, heat > .6 ? CORAL : AMB, 'HEAT');
      lnMascot(g, 80, 548, 4.5);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_magna', lnMagna, 'Magnafire');

/* 6 GREEN THUMB: aim the mirror so the sunbeam lands on the plant */
function lnGreen(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, S = { x: 92, y: 150 }, M = { x: 340, y: 230 + Math.random() * 40 };
  const P = { x: 480 + Math.random() * 220, y: 512 }, PR = 74 - 6 * Math.min(rs - 1, .8), NEED = .7;
  const nrm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const d = nrm(M.x - S.x, M.y - S.y), d2 = nrm(P.x - M.x, P.y - M.y - 50), tsol = nrm(d.x + d2.x, d.y + d2.y);
  const sol = Math.atan2(tsol.y, tsol.x), pc = { x: P.x, y: P.y - 50 };
  let th = sol + (Math.random() < .5 ? -1 : 1) * (.7 + Math.random() * .5), target = th, c = 0, grow = 0, held = false, ptr = { x: 0, y: 0 }, used = false;
  const dAng = (a, b) => { let x = (a - b) % Math.PI; if (x > Math.PI / 2) x -= Math.PI; if (x < -Math.PI / 2) x += Math.PI; return x; };
  const aim = () => { const tx = Math.cos(th), ty = Math.sin(th), dd = d.x * tx + d.y * ty; return nrm(2 * dd * tx - d.x, 2 * dd * ty - d.y); };
  const setT = p => { if (Math.hypot(p.x - M.x, p.y - M.y) > 12) { target = th + dAng(Math.atan2(p.y - M.y, p.x - M.x), th); used = true; } };
  const g = {
    cmd: 'REFLECT!', hint: 'DRAG TO AIM THE MIRROR AT THE PLANT (OR LEFT / RIGHT)', thint: 'DRAG TO AIM THE MIRROR AT THE PLANT', dur: 5.8,
    down(p) { held = true; ptr = p; setT(p); }, move(p) { ptr = p; if (held) setT(p); }, up() { held = false; }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) { if (g.result === 'win') grow = 1; return; }
      let kd = 0; if (keys.ArrowLeft || keys.KeyA) kd--; if (keys.ArrowRight || keys.KeyD) kd++;
      if (kd) { th += kd * 1.0 * dt; target = th; used = true; }
      else th += dAng(target, th) * Math.min(1, dt * 14);
      const r = aim(), s = (pc.x - M.x) * r.x + (pc.y - M.y) * r.y, perp = Math.abs((pc.x - M.x) * r.y - (pc.y - M.y) * r.x);
      const hit = s > 0 && perp <= PR; g._h = hit;
      if (hit) grow = Math.min(1, grow + dt / (NEED * 1.0)); else grow = Math.max(0, grow - dt * .25);
      if (hit && Math.random() < dt * 14) burst(pc.x + (Math.random() - .5) * 40, pc.y - 20, AMB, 2, 90);
      if (grow >= 1) { g.result = 'win'; lnWin('BLOOM!', P.x, P.y - 60); }
      else if (c >= D - .03) { g.result = 'lose'; lnLose('WILTED!'); }
    },
    draw(t) {
      lnBG(t);
      // ground
      ctx.fillStyle = INK; ctx.fillRect(0, 524, W, 80); ctx.fillStyle = '#3f8a5a'; ctx.fillRect(0, 532, W, 70);
      ctx.fillStyle = '#5bb577'; for (let i = 0; i < 9; i++) ctx.fillRect(i * 100 + 20, 548, 50, 7);
      // sun
      ctx.save(); ctx.translate(S.x, S.y); ctx.rotate(now * .4); ctx.fillStyle = AMB;
      for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.fillRect(-6, -64, 12, 20); }
      ctx.restore(); circ(S.x, S.y, 36, '#FFE14D', 5);
      // beams
      const r = aim(), hit = g._h && !g.result || g.result === 'win';
      let len = 1000; if (hit) len = Math.max(0, (pc.x - M.x) * r.x + (pc.y - M.y) * r.y);
      ctx.lineCap = 'round';
      const beam = (ax, ay, bx, by, w) => { ctx.strokeStyle = 'rgba(255,225,77,.4)'; ctx.lineWidth = w + 10; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = w; ctx.stroke(); };
      beam(S.x + d.x * 36, S.y + d.y * 36, M.x, M.y, 8); beam(M.x, M.y, M.x + r.x * len, M.y + r.y * len, 8);
      ctx.lineCap = 'butt';
      // mirror
      ctx.save(); ctx.translate(M.x, M.y); ctx.rotate(th);
      ctx.fillStyle = INK; ctx.fillRect(-66, -11, 132, 22); ctx.fillStyle = '#cfe9ff'; ctx.fillRect(-62, -7, 124, 14);
      ctx.fillStyle = '#fff'; ctx.fillRect(-58, -6, 60, 4);
      ctx.restore(); circ(M.x, M.y, 11, AMB, 4);
      if (held && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(M.x, M.y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke(); ctx.setLineDash([]); }
      if (!g.result && !used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(M.x + Math.cos(th) * 66, M.y + Math.sin(th) * 66, 24 + Math.sin(now * 6) * 4, 0, 7); ctx.stroke(); }
      // plant in a pot
      shadow(P.x, 528, 50, 10, .3);
      ctx.beginPath(); ctx.moveTo(P.x - 34, 478); ctx.lineTo(P.x + 34, 478); ctx.lineTo(P.x + 26, 526); ctx.lineTo(P.x - 26, 526); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = CORAL; ctx.fill();
      const h = 16 + grow * 92, droop = (1 - grow) * 16 * (g.result === 'lose' ? 2 : 1), sway = Math.sin(now * 3) * 3 * grow;
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(P.x, 480); ctx.quadraticCurveTo(P.x + sway, 480 - h * .6, P.x + droop + sway, 480 - h); ctx.stroke();
      ctx.strokeStyle = LIME; ctx.lineWidth = 7; ctx.stroke(); ctx.lineCap = 'butt';
      const tx = P.x + droop + sway, ty = 480 - h;
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate(P.x + sd * 3, 480 - h * .45); ctx.rotate(sd * (.9 - grow * .4)); ctx.fillStyle = LIME; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(sd * 18, 0, 22 + grow * 6, 9, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
      if (grow > .55) { const pr = (grow - .55) / .45 * 17; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + now * .5; circ(tx + Math.cos(a) * pr * 1.2, ty + Math.sin(a) * pr * 1.2, pr * .7, PINK, 3); } circ(tx, ty, pr * .8, AMB, 3); }
      else circ(tx, ty, 8 + grow * 8, LIME, 4);
      if (g.result === 'lose') { ctx.fillStyle = INK; ctx.fillRect(tx - 12, ty - 4, 8, 3); ctx.fillRect(tx + 4, ty - 4, 8, 3); }
      lnBar(30, 470, 200, grow, LIME, 'GROWTH');
      lnMascot(g, 90, 548, 4.5);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_green', lnGreen, 'Green Thumb');

/* 7 DIRE PLATES: three rings, each divided in 6 coloured wedges. Tap a ring to turn it until every wedge lines up. */
function lnPlates(sp) {
  const rs = Math.sqrt(sp), D = 5.8 / rs, CX = 400, CY = 332, S = Math.PI / 3, MAXN = rs > 1.3 ? 4 : 3;
  const BANDS = [[42, 98], [100, 156], [158, 214]], PAL = [CORAL, AMB, LIME, CYAN, PLUM, PINK];
  const tot = [0, 0, 0], vis = [0, 0, 0];
  for (let i = 0; i < 3; i++) { tot[i] = -(1 + Math.floor(Math.random() * MAXN)); vis[i] = tot[i] * S; }
  let c = 0, sel = 1, kb = false, solved = 0;
  const aligned = i => ((tot[i] % 6) + 6) % 6 === 0;
  const spin = i => {
    if (g.result) return; tot[i]++; sfx.click(); sfx.tick();
    const mid = (BANDS[i][0] + BANDS[i][1]) / 2; burst(CX, CY - mid, '#fff', 3, 120);
    if (aligned(0) && aligned(1) && aligned(2)) solved = .001;
  };
  const g = {
    cmd: 'ALIGN!', hint: 'CLICK THE RINGS TO TURN THEM (OR 1 / 2 / 3)', thint: 'TAP THE RINGS TO TURN THEM', dur: 5.8,
    down(p) {
      const r = Math.hypot(p.x - CX, p.y - CY); kb = false;
      for (let i = 0; i < 3; i++) if (r >= BANDS[i][0] - 3 && r <= BANDS[i][1] + 3) { sel = i; spin(i); return; }
    },
    move() {}, up() {},
    key(e) {
      if (e.repeat || g.result) return;
      const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code || '');
      if (m) { sel = +m[1] - 1; kb = true; spin(sel); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = Math.min(2, sel + 1); kb = true; }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = Math.max(0, sel - 1); kb = true; }
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight' || e.code === 'KeyD') { kb = true; spin(sel); }
    },
    keyup() {},
    update(dt) {
      c += dt;
      for (let i = 0; i < 3; i++) vis[i] += (tot[i] * S - vis[i]) * Math.min(1, dt * 14);
      if (g.result) return;
      if (solved > 0) { solved += dt; if (solved > .22) { g.result = 'win'; lnWin('ALIGNED!', CX, CY); } return; }
      if (c >= D - .03) { g.result = 'lose'; lnLose('JAMMED!'); }
    },
    draw(t) {
      lnBG(t);
      shadow(CX + 8, CY + 214, 215, 18, .3);
      circ(CX, CY, 218, INK, 0);
      for (let i = 0; i < 3; i++) {
        const [ri, ro] = BANDS[i];
        for (let k = 0; k < 6; k++) {
          const a0 = -Math.PI / 2 + k * S + vis[i], a1 = a0 + S;
          ctx.beginPath(); ctx.arc(CX, CY, ro, a0, a1); ctx.arc(CX, CY, ri, a1, a0, true); ctx.closePath();
          ctx.fillStyle = PAL[k]; ctx.fill();
          if (i) { ctx.fillStyle = `rgba(255,255,255,${i * .13})`; ctx.fill(); }
          ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
        }
        const mid = (ri + ro) / 2, ok = aligned(i);
        circ(CX, CY - mid, 9, ok ? LIME : '#5d6aa3', 3);
        if (kb && sel === i && !g.result) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(CX, CY, ro + 2, 0, 7); ctx.arc(CX, CY, ri - 2, 0, 7, true); ctx.stroke(); }
      }
      circ(CX, CY, 38, NAVY2, 5);
      claude(CX, CY + 14, 2.9, { mood: lnMood(g) });
      if (!g.result && c < 1.2 && Math.sin(now * 10) > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(CX, CY, 128, 0, 7); ctx.stroke(); }
      vignette(.2);
    }
  };
  return g;
}
reg('ln_plates', lnPlates, 'Dire Plates');

/* 8 ON THE EDGE: trace the outline; stay inside the band or the steadiness meter drains */
function lnEdge(sp) {
  const rs = Math.sqrt(sp), D = 5.9 / rs, TOL = Math.max(32, 40 - 5 * (rs - 1)), ph = Math.random() * 6;
  const path = lnPath(u => { const a = -Math.PI / 2 + u * Math.PI * 2, w = 1 + .15 * Math.cos(3 * a + ph); return [400 + 168 * Math.cos(a) * w, 330 + 118 * Math.sin(a) * w]; }, 300);
  const p0 = path.at(0), tool = lnTool(p0.x, p0.y, 900, 330, 30, 760, 118, 545);
  let c = 0, prog = 0, ste = 1, out = false, outT = 0;
  const g = {
    cmd: 'TRACE!', hint: 'DRAG ALONG THE OUTLINE, STAY IN THE BAND (OR ARROWS)', thint: 'DRAG ALONG THE OUTLINE, STAY IN THE BAND', dur: 5.9,
    down(p) { tool.down(p); }, move(p) { tool.move(p); }, up() { tool.up(); }, key() {}, keyup() {},
    update(dt) {
      c += dt; if (g.result) return;
      tool.step(dt);
      const full = path.near(tool.x, tool.y, 0, path.len);
      out = full.d > TOL;
      const nr = path.near(tool.x, tool.y, Math.max(0, prog - 25), prog + 90);
      if (nr.d <= TOL && nr.s > prog) prog = nr.s;
      outT = out ? outT + dt : 0;   // short grace so a first touch away from the start isn't punished
      if (tool.used) { if (outT > .25) ste -= dt * 1.0; else if (!out) ste = Math.min(1, ste + dt * .35); }
      if (prog >= path.len * .965) { g.result = 'win'; lnWin('TRACED!'); }
      else if (ste <= 0) { ste = 0; g.result = 'lose'; lnLose('OFF THE EDGE!'); }
      else if (c >= D - .03) { g.result = 'lose'; lnLose('TOO SLOW!'); }
    },
    draw(t) {
      lnBG(t);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // the shape: dark body, light rim, then the tracing band on its edge
      ctx.fillStyle = INK; ctx.beginPath(); for (const p of path.pts) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#26356d'; ctx.beginPath(); for (const p of path.pts) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = TOL * 2 + 10; path.stroke(0, path.len);
      ctx.strokeStyle = out && !g.result ? '#7a4a78' : '#3a64a8'; ctx.lineWidth = TOL * 2; path.stroke(0, path.len);
      ctx.lineCap = 'butt'; ctx.setLineDash([12, 12]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; path.stroke(0, path.len); ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK; ctx.lineWidth = 16; path.stroke(0, prog);
      ctx.strokeStyle = AMB; ctx.lineWidth = 8; path.stroke(0, prog);
      circ(p0.x, p0.y, 11, LIME, 4);
      // pen
      ctx.strokeStyle = INK; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(tool.x, tool.y); ctx.lineTo(tool.x + 46, tool.y - 78); ctx.stroke();
      ctx.strokeStyle = PLUM; ctx.lineWidth = 12; ctx.stroke(); ctx.lineCap = 'butt';
      circ(tool.x, tool.y, 11, out && !g.result ? RED : '#fff', 4);
      if (!g.result && !tool.used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tool.x, tool.y, 30 + Math.sin(now * 6) * 5, 0, 7); ctx.stroke(); }
      lnBar(250, 520, 300, ste, ste < .35 ? RED : LIME, 'STEADY');
      lnMascot(g, 80, 548, 4.5);
      vignette(.2);
    }
  };
  return g;
}
reg('ln_edge', lnEdge, 'On the Edge');

})();
