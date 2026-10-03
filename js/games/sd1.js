'use strict';
/* Sports Day wave 1 - eight athletics microgames: HAMMER TOSS, SKI JUMP, SPARE ME, PRO CURLING,
   HIGH HOOPS, VOLLEY GIRL, JUMP FOREVER, STAR STRUCK.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose'.
   Input rule: every game works with a touch (down/move/up with coordinates, move is only trusted while pressed)
   AND with mouse + keyboard. Palette: sunny stadium - sky blue, grass green, clay-track red, gold. */
(function () {

const SKY = '#4DB8FF', GRASS = '#43B85A', CLAY = '#E8553A', GOLD = '#FFC93C', NAVY = '#23408E', TEAL = '#2EC4B6', SAND = '#F6D58E';
const YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d4d', WOOD = '#E9A75B';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const sdMood = (g) => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
/* end a game once: win = fanfare + confetti, lose = thud + shake; msg floats near the top */
function sdEnd(g, ok, msg, x, y) {
  if (g.result) return;
  g.result = ok ? 'win' : 'lose';
  if (ok) { sfx.coin(); sfx.sparkle(); confetti(x == null ? 400 : x, y == null ? 300 : y, 36); ring(x == null ? 400 : x, y == null ? 300 : y, '#fff', 110); floatText(msg, 400, 190, YEL, 46); }
  else { sfx.miss(); sfx.thud(); shake(8, .25); floatText(msg, 400, 190, RED, 44); }
}
function sdSky(t, col, ray) {
  bg(col || SKY, ray || '#43AEEB', t);
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 3; i++) { const x = (i * 300 + t * 14) % 1000 - 100, y = 70 + i * 34; ctx.beginPath(); ctx.ellipse(x, y, 70, 22, 0, 0, 7); ctx.ellipse(x + 40, y - 12, 44, 18, 0, 0, 7); ctx.fill(); }
}
function sdGround(y, col, stripe) {
  ctx.fillStyle = INK; ctx.fillRect(0, y - 6, W, H - y + 10);
  ctx.fillStyle = col; ctx.fillRect(0, y, W, H - y);
  if (stripe) { ctx.fillStyle = stripe; for (let i = 0; i < 8; i += 2) ctx.fillRect(i * 100, y, 100, H - y); }
}
/* little pennant flag */
function sdFlag(x, y, col) { ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 50, 6, 52); ctx.beginPath(); ctx.moveTo(x + 3, y - 50); ctx.lineTo(x + 30, y - 40); ctx.lineTo(x + 3, y - 30); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 3, y - 47); ctx.lineTo(x + 24, y - 40); ctx.lineTo(x + 3, y - 33); ctx.fill(); }
function sdBar(x, y, w, v, col, label, z0, z1) {
  box3(x, y, w, 28, '#fff', 4, 4);
  if (z0 != null) { ctx.fillStyle = MINT; ctx.fillRect(x + w * z0, y, w * (z1 - z0), 28); }
  ctx.fillStyle = col; ctx.fillRect(x, y + 10, w * clamp(v, 0, 1), 8);
  if (label) txt(label, x + w / 2, y + 14, 18, '#fff');
  ctx.fillStyle = INK; ctx.fillRect(x + w * clamp(v, 0, 1) - 3, y - 6, 6, 40);
}
function sdDots(n, tot, x0, y, step) { for (let i = 0; i < tot; i++) { circ(x0 + i * step, y, 13, i < n ? GOLD : '#fff', 4); } }

/* 1 HAMMER TOSS: hold to spin up, release so the throw lands in the zone */
function sdHammer(sp) {
  const rs = Math.sqrt(sp), rate = .55 * rs, zc = .55 + Math.random() * .3, zw = .17 / Math.pow(rs, .4);
  const DX = p => 150 + p * 580;
  let c = 0, held = false, hold = 0, spin = 0, fly = null;
  const power = () => Math.min(1, hold * rate);
  const start = () => { if (g.result || fly || held) return; held = true; hold = 0; sfx.click(); };
  const release = () => {
    if (!held) return; held = false;
    const p = power(); if (p < .12) { hold = 0; return; }
    fly = { t: 0, p }; sfx.whoosh(); sfx.thud();
    const ok = Math.abs(p - zc) <= zw / 2;
    sdEnd(g, ok, ok ? 'GREAT THROW!' : p < zc ? 'TOO SHORT!' : 'TOO FAR!', DX(p), 480);
  };
  const g = {
    cmd: 'THROW!', hint: 'HOLD SPACE / MOUSE, RELEASE IN THE GREEN ZONE', thint: 'HOLD, THEN LET GO IN THE GREEN ZONE', dur: 5.6,
    key(e) { if (!e.repeat && e.code === 'Space') start(); },
    keyup(e) { if (e.code === 'Space') release(); },
    down() { start(); },
    up() { release(); },
    update(dt) {
      c += dt;
      if (held) { hold += dt; spin += dt * (4 + power() * 24); } else if (!fly) spin += dt * 2;
      if (fly) fly.t += dt;
    },
    draw(t) {
      sdSky(t); sdGround(392, GRASS, '#4CC764');
      const zx = DX(zc - zw / 2), zx2 = DX(zc + zw / 2);
      ctx.fillStyle = 'rgba(255,225,77,.5)'; ctx.fillRect(zx, 392, zx2 - zx, 208);
      ctx.fillStyle = '#fff'; ctx.fillRect(zx - 3, 392, 6, 208); ctx.fillRect(zx2 - 3, 392, 6, 208);
      sdFlag(zx, 392, MINT); sdFlag(zx2, 392, MINT);
      for (let i = 1; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(DX(i / 6) - 1, 392, 2, 208); }
      ctx.fillStyle = 'rgba(20,16,28,.25)'; ctx.beginPath(); ctx.ellipse(130, 520, 80, 24, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(130, 520, 80, 24, 0, 0, 7); ctx.stroke();
      claude(130, 526, 6, { mood: sdMood(g) });
      // hammer: orbits Claude while held; flies when released
      let bx = 130 + Math.cos(spin) * 82, by = 462 + Math.sin(spin) * 34;
      if (fly) {
        const u = Math.min(1, fly.t / .9), tx = DX(fly.p);
        bx = lerp(130, tx, u); by = lerp(462, 520, u) - 280 * Math.sin(Math.PI * u);
        if (u >= 1) { ctx.fillStyle = 'rgba(20,16,28,.3)'; ctx.beginPath(); ctx.ellipse(tx, 524, 30, 9, 0, 0, 7); ctx.fill(); }
      }
      if (!fly || fly.t < .9) {
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(142, 480); ctx.lineTo(bx, by); ctx.stroke();
      }
      circ(bx, by, 17, '#8A93A6', 4); ctx.fillStyle = '#c9d0de'; ctx.fillRect(bx - 8, by - 9, 7, 5);
      sdBar(180, 26, 440, held ? power() : fly ? fly.p : 0, held && power() >= 1 ? RED : GOLD, 'POWER', zc - zw / 2, zc + zw / 2);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_hammer', sdHammer, 'Hammer Toss');

/* 2 SKI JUMP: tap in the last stretch of the ramp, right before the lip */
function sdSki(sp) {
  const rs = Math.sqrt(sp), tLip = 2.3 / rs, tol = .3 / Math.pow(rs, .6);
  const RX0 = 70, RY0 = 190, LX = 520, LY = 360, ang = Math.atan2(LY - RY0, LX - RX0);
  let c = 0, sk = null;                        // sk: {k:'fly'|'early'|'late', t, q}
  const sOf = (tt) => Math.min(1.5, (tt / tLip) * (tt / tLip));
  const jump = () => {
    if (g.result || sk) return;
    if (c < tLip - tol) { sk = { k: 'early', t: 0, s: sOf(c) }; sdEnd(g, false, 'TOO EARLY!'); return; }
    const q = clamp(1 - (tLip - c) / tol, 0, 1) * .5 + .5; sk = { k: 'fly', t: 0, q };
    sfx.whoosh(); sfx.boing(); sdEnd(g, true, q > .9 ? 'PERFECT!' : 'NICE JUMP!', 650, 380);
  };
  const g = {
    cmd: 'JUMP!', hint: 'SPACE / CLICK AT THE END OF THE RAMP', thint: 'TAP AT THE END OF THE RAMP', dur: 5.4,
    key(e) { if (!e.repeat && e.code === 'Space') jump(); },
    down() { jump(); },
    update(dt) {
      c += dt;
      if (sk) sk.t += dt;
      else if (c > tLip + .08 && !g.result) { sk = { k: 'late', t: 0 }; sdEnd(g, false, 'TOO LATE!'); }
    },
    draw(t) {
      sdSky(t, '#9ADCFF', '#8ad0f6');
      ctx.fillStyle = '#7b87b5'; ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(140, 300); ctx.lineTo(260, 480); ctx.fill();
      // ramp + snowy ground
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(RX0 - 70, RY0 - 20); ctx.lineTo(LX + 8, LY - 4); ctx.lineTo(LX + 8, 600); ctx.lineTo(0, 600); ctx.lineTo(0, RY0 - 20); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(RX0 - 70, RY0 - 12); ctx.lineTo(LX, LY + 2); ctx.lineTo(LX, 600); ctx.lineTo(0, 600); ctx.lineTo(0, RY0 - 12); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(560, 600); ctx.lineTo(560, 498); ctx.lineTo(W, 440); ctx.lineTo(W, 600); ctx.fill();
      ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.moveTo(566, 600); ctx.lineTo(566, 506); ctx.lineTo(W, 448); ctx.lineTo(W, 600); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? CLAY : '#fff'; ctx.fillRect(590 + i * 40, 492 - i * 12, 14, 8); }
      // green window on the ramp
      const wa = sOf(tLip - tol), pa = [lerp(RX0, LX, wa), lerp(RY0, LY, wa)];
      ctx.strokeStyle = MINT; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pa[0], pa[1] - 6); ctx.lineTo(LX, LY - 6); ctx.stroke(); ctx.lineCap = 'butt';
      if (!sk && c > tLip - tol) { ctx.globalAlpha = .6 + .4 * Math.sin(now * 20); txt('NOW!', LX - 20, LY - 70, 36, YEL); ctx.globalAlpha = 1; }
      // skier
      let x, y, r = ang;
      if (!sk) { const s = sOf(c); x = lerp(RX0, LX, s); y = lerp(RY0, LY, s); }
      else if (sk.k === 'fly') {
        const u = Math.min(1, sk.t / 1.1), tx = 650 + sk.q * 60;
        x = lerp(LX, tx, u); y = lerp(LY, 468 - (tx - 650) * .25, u) - 150 * Math.sin(Math.PI * u) * (.6 + sk.q * .4); r = lerp(ang, 0, Math.min(1, u * 3)) - .1 * Math.sin(Math.PI * u);
      } else if (sk.k === 'early') {
        const u = sk.t; x = lerp(RX0, LX, sk.s) + u * 40; y = lerp(RY0, LY, sk.s) - Math.max(0, 60 * Math.sin(Math.min(1, u * 3) * Math.PI)) + (u > .35 ? (u - .35) * 160 * (u - .35) : 0) * 0; r = ang + u * 9;
        if (u > .5) { x = lerp(RX0, LX, sk.s) + 20 + (u - .5) * 40; y = lerp(RY0, LY, sk.s) - 4; }
      } else {
        const u = sk.t; x = LX + u * 120; y = LY + u * u * 600; r = ang + u * 5;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      shadow(0, 2, 28, 6, .15);
      box(-34, -6, 68, 8, CLAY, 3);
      claude(0, -4, 4.2, { mood: sdMood(g) });
      ctx.restore();
      vignette(.2);
    }
  };
  return g;
}
reg('sd_ski', sdSki, 'Ski Jump');

/* 3 SPARE ME: lock the sliding position, then flick (or tap) to roll at the 3 pins */
function sdBowl(sp) {
  const rs = Math.sqrt(sp), PX = 400, PY = 150, BY = 500;
  const ph = Math.random() * 6, sw = .3, swv = 3.2 * Math.pow(rs, .7);
  let c = 0, phase = 0, lockX = 400, aim = 0, grab = null, cur = null, ball = null; const pins = [-34, 0, 34].map(x => ({ x: PX + x, fall: 0, dx: 0 }));
  const baseA = () => Math.atan2(PX - lockX, BY - PY);
  const swing = () => baseA() + sw * Math.sin(c * swv + ph);
  const slideX = () => 400 + 125 * Math.sin(c * 1.9 * Math.pow(rs, .7) + ph);
  const lock = () => { if (g.result || phase !== 0) return; phase = 1; lockX = slideX(); sfx.click(); sfx.tickHi(); floatText('LOCKED!', lockX, 440, YEL, 28); };
  const roll = (a) => {
    if (g.result || phase !== 1) return; phase = 2;
    const dx = Math.sin(a), dy = -Math.cos(a), xp = lockX + dx / -dy * (BY - PY);
    ball = { x: lockX, y: BY, dx, dy, xp, t: 0, done: false }; sfx.whoosh(false);
  };
  const g = {
    cmd: 'BOWL!', hint: 'SPACE / CLICK TO LOCK, THEN SPACE OR DRAG UP + RELEASE TO ROLL', thint: 'TAP TO LOCK, THEN FLICK UP TO ROLL', dur: 5.8,
    key(e) { if (!e.repeat && e.code === 'Space') { if (phase === 0) lock(); else roll(swing()); } },
    down(p) { if (phase === 0) lock(); else if (phase === 1) { grab = { x: p.x, y: p.y }; cur = p; } },
    move(p) { if (grab) cur = p; },
    up(p) {
      if (!grab) return;
      const dx = p.x - grab.x, dy = p.y - grab.y, len = Math.hypot(dx, dy); grab = null; cur = null;
      if (len < 40) roll(swing());
      else if (dy < -20) roll(Math.atan2(dx, -dy));
    },
    update(dt) {
      c += dt;
      for (const p of pins) if (p.fall > 0) { p.fall += dt; }
      if (ball && !ball.done) {
        ball.t += dt; const sp2 = 760; ball.x += ball.dx * sp2 * dt; ball.y += ball.dy * sp2 * dt;
        const gut = Math.abs(ball.x - 400) > 150; if (gut) ball.x = clamp(ball.x, 400 - 168, 400 + 168);
        if (ball.y <= PY + 14) {
          ball.done = true; const off = ball.xp - PX, hit = Math.abs(off) < 150;
          const cen = hit && Math.abs(off) < 38;
          if (cen) pins.forEach((p, i) => { p.fall = .01; p.dx = (i - 1) * 90 + off; });
          else if (hit && Math.abs(off) < 74) { const k = off < 0 ? 0 : 2; [k, 1].forEach(i => { pins[i].fall = .01; pins[i].dx = (i - 1) * 60; }); }
          if (cen) { sfx.hit(); sfx.thud(); }
          sdEnd(g, cen, cen ? 'SPARE!' : Math.abs(off) >= 150 ? 'GUTTER!' : Math.abs(off) < 74 ? 'SPLIT!' : 'MISSED!', PX, 200);
        }
      }
    },
    draw(t) {
      bg('#7A3FD1', '#6c36bd', t);
      ctx.fillStyle = INK; ctx.fillRect(212, 70, 376, 540); ctx.fillStyle = '#3a1c70'; ctx.fillRect(220, 70, 360, 540);
      ctx.fillStyle = WOOD; ctx.fillRect(250, 70, 300, 540); ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let i = 0; i < 9; i++) ctx.fillRect(250 + i * 33, 70, 3, 540);
      ctx.fillStyle = INK; ctx.fillRect(250, 478, 300, 6);
      // pins
      for (const p of pins) {
        const f = p.fall, u = Math.min(1, f * 2.2);
        ctx.save(); ctx.translate(p.x + p.dx * u, PY + (f ? -u * 50 : 0)); ctx.rotate(f ? u * 3 * Math.sign(p.dx || 1) : 0); ctx.globalAlpha = f ? 1 - u * .7 : 1;
        box(-9, -18, 18, 36, '#fff', 3); ctx.fillStyle = CLAY; ctx.fillRect(-9, -8, 18, 6); ctx.restore();
      }
      // sliding / locked Claude
      const x = phase === 0 ? slideX() : lockX;
      claude(x, 596, 5, { mood: sdMood(g) });
      if (phase < 2) {
        circ(x, BY + 6, 17, NAVY, 4);
        if (phase === 0) { txt('LOCK IT!', 400, 105, 32, YEL); ctx.fillStyle = 'rgba(255,225,77,.5)'; ctx.fillRect(x - 3, PY + 30, 6, BY - PY - 40); }
        else {
          let a = swing(); if (grab && cur) { const dx = cur.x - grab.x, dy = cur.y - grab.y; if (Math.hypot(dx, dy) > 40 && dy < -20) a = Math.atan2(dx, -dy); }
          ctx.strokeStyle = MINT; ctx.lineWidth = 6; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(x, BY); ctx.lineTo(x + Math.sin(a) * 340, BY - Math.cos(a) * 340); ctx.stroke(); ctx.setLineDash([]);
          txt('FLICK!', 400, 105, 32, YEL);
          if (grab && cur) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(grab.x, grab.y); ctx.lineTo(cur.x, cur.y); ctx.stroke(); }
        }
      } else if (ball) circ(ball.x, ball.y, 17, NAVY, 4);
      vignette(.25);
    }
  };
  return g;
}
reg('sd_bowl', sdBowl, 'Spare Me');

/* 4 PRO CURLING: scrub in front of the stone to carry it into the house, but stop before you overshoot */
function sdCurl(sp) {
  const rs = Math.sqrt(sp), SH = 300, TOL = 70, Y0 = 540, HX = 400;
  const v0 = 190 * rs, mu = (v0 * v0) / (2 * 170);
  let c = 0, s = 0, v = 0, sweep = 0, down = false, last = null, brush = null, ended = false, lastKey = '', spark = 0;
  const addSweep = (k) => { sweep = Math.min(1, sweep + k); };
  const g = {
    cmd: 'SWEEP!', hint: 'HOLD MOUSE AND SCRUB IN FRONT OF THE STONE (OR ALTERNATE LEFT / RIGHT)', thint: 'SCRUB BACK AND FORTH IN FRONT OF THE STONE', dur: 5.6,
    key(e) {
      if (e.repeat || g.result) return;
      const k = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : '';
      if (k && k !== lastKey) { lastKey = k; addSweep(.34); sfx.tick(); }
    },
    down(p) { down = true; last = p; brush = p; },
    move(p) {
      brush = p;
      if (!down || !last) return;
      const stoneY = Y0 - s, d = stoneY - p.y;
      if (!g.result && v > 0 && d > -30 && d < 230 && Math.abs(p.x - HX) < 160) addSweep(Math.min(.5, Math.hypot(p.x - last.x, p.y - last.y) / 55));
      last = p;
    },
    up() { down = false; last = null; brush = null; },
    update(dt) {
      c += dt; sweep = Math.max(0, sweep - 2.2 * dt); spark -= dt;
      if (c > .4 && v === 0 && s === 0) v = v0;
      if (v > 0) {
        v -= mu * (1 - .7 * sweep) * dt; s += Math.max(0, v) * dt;
        if (sweep > .15 && spark <= 0) { spark = .06; burst(HX + (Math.random() - .5) * 40, Y0 - s - 50, '#fff', 2, 90); }
        if (!g.result && s > SH + TOL) sdEnd(g, false, 'TOO FAR!');
        if (v <= 2 && !ended) {
          v = -1; ended = true;
          const ok = Math.abs(s - SH) <= TOL; sdEnd(g, ok, ok ? 'IN THE HOUSE!' : s < SH ? 'TOO SHORT!' : 'TOO FAR!', HX, Y0 - SH);
        }
      }
    },
    draw(t) {
      bg('#9fe3ff', '#8fd8f6', t);
      ctx.fillStyle = INK; ctx.fillRect(244, 0, 312, 600); ctx.fillStyle = '#eefaff'; ctx.fillRect(250, 0, 300, 600);
      ctx.fillStyle = 'rgba(77,184,255,.25)'; for (let i = 0; i < 6; i++) ctx.fillRect(250, i * 110 + ((c * 20) % 110) - 50, 300, 3);
      const hy = Y0 - SH;
      circ(HX, hy, 78, '#2B6CE0', 3); circ(HX, hy, 54, '#fff', 3); circ(HX, hy, 32, CLAY, 3); circ(HX, hy, 10, '#fff', 3);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(250, Y0 + 24, 300, 4);
      // sweep zone hint
      const sy = Y0 - Math.max(s, 0);
      if (v > 0 || s === 0) { ctx.fillStyle = 'rgba(255,225,77,' + (.12 + sweep * .25) + ')'; ctx.fillRect(HX - 150, sy - 230, 300, 200); }
      // stone
      const sx = HX; shadow(sx, sy + 14, 36, 11, .25); circ(sx, sy, 30, '#8A93A6', 4); circ(sx, sy, 20, '#a9b2c6', 0); ctx.fillStyle = CLAY; ctx.fillRect(sx - 18, sy - 5, 36, 10); circ(sx, sy, 5, INK, 0);
      claude(HX - 130, Math.max(sy + 36, 120) + (s > 0 ? 0 : 0), 4, { mood: sdMood(g) });
      // broom
      let bx = null, by = null;
      if (brush) { bx = brush.x; by = brush.y; } else if (sweep > .05) { bx = HX + Math.sin(now * 30) * 40; by = sy - 70; }
      if (bx != null) { ctx.save(); ctx.translate(bx, by); ctx.rotate(.3); box(-30, -8, 60, 16, GOLD, 3); box(-3, -80, 6, 70, '#8a5a2b', 2); ctx.restore(); }
      if (s === 0 && c < 1.8) { ctx.globalAlpha = .6 + .4 * Math.sin(now * 14); txt('SCRUB!', 400, sy - 120, 36, YEL); ctx.globalAlpha = 1; }
      ctx.fillStyle = INK; ctx.fillRect(40, 130, 36, 260); ctx.fillStyle = '#fff'; ctx.fillRect(44, 134, 28, 252);
      ctx.fillStyle = sweep > .8 ? RED : MINT; ctx.fillRect(44, 386 - 252 * sweep, 28, 252 * sweep);
      txt('SWEEP', 58, 110, 18, '#fff');
      vignette(.15);
    }
  };
  return g;
}
reg('sd_curl', sdCurl, 'Pro Curling');

/* 5 HIGH HOOPS: hold to charge, release so the ball lands in the moving hoop. Two balls. */
function sdHoops(sp) {
  const rs = Math.sqrt(sp), rate = .85 * rs, w = 1.9 * Math.pow(rs, .7), T = .75 / Math.pow(rs, .3), ph = Math.random() * 6, HY = 215, RW = 56;
  const hx = (tt) => 540 + 165 * Math.sin(tt * w + ph);
  const lx = (p) => 200 + p * 560;
  let c = 0, held = false, hold = 0, balls = 2, shot = null, cd = 0, last = 0;
  const power = () => { const m = (hold * rate) % 2; return m < 1 ? m : 2 - m; };
  const start = () => { if (g.result || (shot && !shot.done) || held || cd > 0 || balls <= 0) return; held = true; hold = 0; sfx.click(); };
  const release = () => {
    if (!held) return; held = false;
    const p = power(); if (hold * rate < .08) { hold = 0; return; }
    balls--; const ok = Math.abs(lx(p) - hx(c + T)) < RW;
    shot = { t: 0, xl: lx(p), ok }; last = p; sfx.whoosh();
  };
  const g = {
    cmd: 'SHOOT!', hint: 'HOLD SPACE / MOUSE, RELEASE TO SHOOT AT THE HOOP', thint: 'HOLD TO CHARGE, LET GO TO SHOOT', dur: 5.6,
    key(e) { if (!e.repeat && e.code === 'Space') start(); },
    keyup(e) { if (e.code === 'Space') release(); },
    down() { start(); },
    up() { release(); },
    update(dt) {
      c += dt; cd -= dt; if (held) hold += dt;
      if (shot) {
        shot.t += dt;
        if (!shot.done && shot.t >= T) {
          shot.done = true;
          if (shot.ok) { sfx.pop(); sfx.hit(); sdEnd(g, true, 'SWISH!', shot.xl, HY); }
          else { sfx.thud(); if (balls <= 0) sdEnd(g, false, 'MISSED!'); else floatText('MISS!', shot.xl, HY - 30, '#fff', 30); }
        }
        if (shot.t > T + .45) { shot = null; cd = .1; }
      }
    },
    draw(t) {
      bg(WOOD, '#e29b45', t);
      ctx.fillStyle = INK; ctx.fillRect(0, 470, W, 140); ctx.fillStyle = '#C97F3A'; ctx.fillRect(0, 478, W, 130);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 500, W, 4); ctx.fillRect(0, 548, W, 4);
      ctx.fillStyle = INK; ctx.fillRect(300, 120, 480, 8);
      const x = hx(c);
      ctx.fillStyle = INK; ctx.fillRect(x - 3, 124, 6, 40);
      box3(x - 50, 150, 100, 50, '#fff', 4, 5); ctx.strokeStyle = CLAY; ctx.lineWidth = 5; ctx.strokeRect(x - 20, 168, 40, 28);
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 22, HY + 2); ctx.lineTo(x + i * 12, HY + 52); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(x, HY, 44, 11, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = CLAY; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, HY, 44, 11, 0, 0, 7); ctx.stroke();
      claude(110, 520, 7, { mood: sdMood(g) });
      // charge marker where the ball would land
      if (held) { const p = power(); ctx.strokeStyle = MINT; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(lx(p), HY, 22, 0, 7); ctx.stroke(); ctx.fillStyle = MINT; ctx.beginPath(); ctx.arc(lx(p), HY, 5, 0, 7); ctx.fill(); }
      // ball
      if (shot && shot.t < T + .3) {
        const u = Math.min(1, shot.t / T);
        let bx = lerp(150, shot.xl, u), by = lerp(420, HY, u) - 190 * Math.sin(Math.PI * u);
        if (shot.t > T) { const k = (shot.t - T); if (shot.ok) { bx = shot.xl; by = HY + k * 260; } else { bx = shot.xl + k * 220 * Math.sign(shot.xl - hx(c)); by = HY - 40 * k + k * k * 900; } }
        circ(bx, by, 18, GOLD, 4); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - 18, by); ctx.lineTo(bx + 18, by); ctx.stroke();
      } else if (!g.result && balls > 0) circ(150, 420, 18, GOLD, 4);
      sdBar(180, 26, 440, held ? power() : last, GOLD, 'POWER');
      for (let i = 0; i < 2; i++) circ(60 + i * 40, 50, 14, i < balls ? GOLD : '#ddd', 4);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_hoops', sdHoops, 'High Hoops');

/* 6 VOLLEY GIRL: bump the serve with good timing, then block the spike in the lane it comes down */
function sdVolley(sp) {
  const rs = Math.sqrt(sp), t1 = 1.25 / rs, tol = .2 / Math.pow(rs, .5), RISE = .5 / rs, TEL = .85 / rs, FALL = .36 / rs, JUMP = .6;
  const LX = [170, 400, 630], FY = 520, lane = Math.floor(Math.random() * 3);
  let c = 0, phase = 0, tB = 0, tA = 0, whiff = 0, bl = -1, tapT = -9, cx = 400, over = false;
  const bump = () => {
    if (g.result || phase !== 0) return;
    if (whiff > 0) return;
    if (Math.abs(c - t1) <= tol) {
      phase = 1; tB = c; tA = c + RISE + TEL; sfx.hit(); sfx.thud();
      floatText(Math.abs(c - t1) < tol * .4 ? 'PERFECT!' : 'BUMP!', 400, 380, YEL, 34); burst(400, 440, '#fff', 8);
    } else { whiff = .3; sfx.whoosh(); }
  };
  const block = (l) => { if (g.result || phase < 1 || c < tB + RISE * .4) return; bl = l; tapT = c; sfx.boing(); };
  const g = {
    cmd: 'VOLLEY!', hint: 'SPACE / CLICK TO BUMP, THEN LEFT / UP / RIGHT TO BLOCK', thint: 'TAP TO BUMP, THEN TAP THE SPIKE LANE TO BLOCK', dur: 5.4,
    key(e) {
      if (e.repeat) return;
      if (e.code === 'Space') { bump(); return; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') block(0);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowDown' || e.code === 'KeyS') block(1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') block(2);
    },
    down(p) { if (phase === 0) bump(); else block(p.x < 267 ? 0 : p.x < 533 ? 1 : 2); },
    update(dt) {
      c += dt; whiff = Math.max(0, whiff - dt);
      const tx = bl >= 0 ? LX[bl] : 400; cx += (tx - cx) * Math.min(1, dt * 16);
      if (g.result) return;
      if (phase === 0 && c > t1 + tol) sdEnd(g, false, 'DROPPED!');
      if (phase === 1 && c >= tA && !over) {
        over = true; const ok = bl === lane && c - tapT <= JUMP;
        if (ok) { sfx.hit(); shake(5, .15); burst(LX[lane], 440, '#fff', 12); }
        sdEnd(g, ok, ok ? 'BLOCKED!' : 'SPIKED!', LX[lane], 420);
      }
    },
    draw(t) {
      sdSky(t); sdGround(430, SAND, '#f0cb7c');
      // net band
      ctx.fillStyle = INK; ctx.fillRect(0, 196, W, 50); ctx.fillStyle = '#fff'; ctx.fillRect(0, 202, W, 38);
      ctx.fillStyle = 'rgba(20,16,28,.35)'; for (let i = 0; i < 40; i++) ctx.fillRect(i * 20, 202, 2, 38);
      ctx.fillStyle = INK; ctx.fillRect(0, 214, W, 3);
      // opponent behind the net
      const tx = phase === 1 ? lerp(400, LX[lane], clamp((c - tB - RISE) / TEL, 0, 1)) : 400;
      const jump = phase === 1 && c > tB + RISE ? Math.abs(Math.sin(clamp((c - tB - RISE) / TEL, 0, 1) * Math.PI)) * 30 : 0;
      ctx.save(); ctx.translate(tx, 190 - jump); box(-20, -56, 40, 40, '#7A3FD1', 3); box(-16, -86, 32, 30, '#FFCBA4', 3); ctx.fillStyle = INK; ctx.fillRect(-8, -74, 5, 6); ctx.fillRect(4, -74, 5, 6);
      if (phase === 1 && c > tB + RISE) { box(-30, -90 - 14, 12, 40, '#FFCBA4', 3); } ctx.restore();
      // lane tells
      if (phase === 1 && c > tB + RISE && !over) {
        const k = (c - tB - RISE) / TEL; ctx.globalAlpha = .55 + .45 * Math.sin(now * 24); drawArrow(LX[lane], 380, 2, 26, RED); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,77,77,' + (.12 + k * .2) + ')'; ctx.fillRect(LX[lane] - 85, 250, 170, 180);
      }
      // Claude
      const up = bl >= 0 && c - tapT <= JUMP, jh = up ? Math.sin((c - tapT) / JUMP * Math.PI) * 34 : 0;
      shadow(cx, FY + 4, 56, 12, .3);
      claude(cx, FY - jh, 8, { mood: sdMood(g) || (up ? 'happy' : null) });
      if (up) { box(cx - 52, FY - jh - 112, 24, 44, '#fff', 4); box(cx + 28, FY - jh - 112, 24, 44, '#fff', 4); }
      // ball
      let bx = 400, by;
      if (phase === 0) { by = -40 + (FY - 105 + 40) * Math.pow(c / t1, 2); if (whiff > 0 && c < t1 - tol) { /* swing, ball keeps falling */ } }
      else if (c < tB + RISE) { const u = (c - tB) / RISE; by = lerp(FY - 105, 120, 1 - (1 - u) * (1 - u)); }
      else if (!over) { const k = clamp((c - tA + FALL) / FALL, 0, 1); bx = LX[lane]; by = k <= 0 ? 150 - 20 * Math.sin(now * 20) : lerp(150, FY - 60, k * k); }
      else { bx = LX[lane]; by = g.result === 'win' ? FY - 150 - (c - tA) * 40 : FY - 40; if (g.result === 'win') bx += (c - tA) * 140; }
      shadow(bx, FY + 8, 24, 7, .2); circ(bx, by, 22, '#fff', 4); ctx.strokeStyle = CLAY; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, 14, .3, 2.2); ctx.stroke(); ctx.beginPath(); ctx.arc(bx, by, 14, 3.4, 5.2); ctx.stroke();
      if (phase === 0) {   // bump timing ring on the hands
        const k = clamp((t1 - c) / (t1 * .5), -.2, 1), ok = Math.abs(c - t1) <= tol;
        ctx.strokeStyle = ok ? MINT : '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(400, FY - 105, 30 + k * 60, 0, 7); ctx.stroke();
        txt('BUMP!', 400, 110, 34, YEL);
      } else if (!g.result) txt(c > tB + RISE ? 'BLOCK!' : 'SET!', 400, 110, 34, c > tB + RISE ? RED : YEL);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_volley', sdVolley, 'Volley Girl');

/* 7 JUMP FOREVER: tap to hop the rope as it speeds up; clear it enough times to win */
function sdRope(sp) {
  const rs = Math.sqrt(sp), N = 5, P0 = .95 / Math.pow(rs, .6), AIR = .5 / Math.pow(rs, .4), T0 = .85 / Math.pow(rs, .5);
  const pass = [T0]; for (let k = 1; k <= N; k++) pass.push(pass[k - 1] + P0 * Math.pow(.92, k - 1));
  let c = 0, jt = -1, cleared = 0, nextK = 0, tripped = false;
  const hop = () => { if (g.result || jt >= 0) return; jt = 0; sfx.boing(); };
  const hOf = () => jt >= 0 && jt < AIR ? 98 * Math.sin(Math.PI * jt / AIR) : 0;
  const theta = () => {
    // rope angle: 0 = at the feet; each period is one full turn
    let k = 0; while (k < N && c >= pass[k + 1]) k++;
    const a = k === 0 && c < pass[0] ? pass[0] - (pass[1] - pass[0]) : pass[k], b = k === 0 && c < pass[0] ? pass[0] : (k >= N ? pass[N] + P0 : pass[k + 1]);
    return k >= N ? .0001 : 2 * Math.PI * (c - a) / (b - a);
  };
  const g = {
    cmd: 'SKIP!', hint: 'SPACE / CLICK TO JUMP THE ROPE', thint: 'TAP TO JUMP THE ROPE', dur: 5.8,
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) hop(); },
    down() { hop(); },
    update(dt) {
      c += dt; if (jt >= 0) { jt += dt; if (jt >= AIR) jt = -1; }
      if (g.result) return;
      while (nextK <= N - 1 && c >= pass[nextK]) {
        if (hOf() > 22) { cleared++; sfx.blip(cleared * 2); floatText('+1', 400, 330, YEL, 34); burst(400, 480, '#fff', 4, 120); nextK++; if (cleared >= N) sdEnd(g, true, 'JUMP FOREVER!', 400, 300); }
        else { tripped = true; sfx.buzz(); sdEnd(g, false, 'TRIPPED!'); break; }
      }
    },
    draw(t) {
      sdSky(t); sdGround(486, GRASS, '#4CC764');
      const people = [170, 630];
      for (const px of people) {
        ctx.save(); ctx.translate(px, 500); shadow(0, 2, 30, 8, .25);
        box(-14, -64, 28, 36, px < 400 ? '#7A3FD1' : TEAL, 3); box(-12, -92, 24, 28, '#FFCBA4', 3); ctx.fillStyle = INK; ctx.fillRect(-6, -82, 4, 5); ctx.fillRect(3, -82, 4, 5); ctx.restore();
      }
      const th = theta(), mid = 369 + 109 * Math.cos(th), cy = 2 * mid - 408;
      const hj = hOf();
      shadow(400, 490, 56 - hj * .2, 12, .3);
      const ropeDraw = (front) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(205, 408); ctx.quadraticCurveTo(400, cy, 595, 408); ctx.stroke();
        ctx.strokeStyle = front ? GOLD : '#d9a91f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(205, 408); ctx.quadraticCurveTo(400, cy, 595, 408); ctx.stroke(); ctx.lineCap = 'butt';
      };
      const behind = Math.sin(th) >= 0;   // rope passes behind her on the way up
      if (behind) ropeDraw(false);
      claude(400, 488 - hj, 8, { mood: sdMood(g) || (hj > 0 ? 'happy' : null) });
      if (!behind) ropeDraw(true);
      if (tripped) { txt('✖', 400, 440, 40, RED); }
      // progress
      for (let i = 0; i < N; i++) { circ(300 + i * 50, 50, 16, i < cleared ? GOLD : '#fff', 4); if (i < cleared) star(300 + i * 50, 50, 10, 4, 5, 0, '#fff', 0); }
      vignette(.2);
    }
  };
  return g;
}
reg('sd_rope', sdRope, 'Jump Forever');

/* 8 STAR STRUCK: drag back and let go (or Up/Down + hold Space) to flick a star at the moving target */
function sdStar(sp) {
  const rs = Math.sqrt(sp), SX = 150, SY = 440, K = 5.2, G = 800, MAXP = 150, TX = 650, w = 2.3 * Math.pow(rs, .6), ph = Math.random() * 6;
  const ty = (tt) => 290 + 140 * Math.sin(tt * w + ph);
  let c = 0, stars = 2, proj = null, anchor = null, cur = null, kbAng = .8, kbHold = -1, kbMode = false, rest = 0, spin = 0;
  const pullVec = () => {
    if (anchor && cur) { let dx = anchor.x - cur.x, dy = anchor.y - cur.y; const l = Math.hypot(dx, dy); if (l > MAXP) { dx *= MAXP / l; dy *= MAXP / l; } return { x: dx, y: dy, l: Math.min(l, MAXP) }; }
    if (kbMode) { const pw = kbHold >= 0 ? (() => { const m = ((c - kbHold) * 1.1 * rs) % 2; return m < 1 ? m : 2 - m; })() : .6, l = 40 + 110 * pw; return { x: Math.cos(kbAng) * l, y: -Math.sin(kbAng) * l, l, kb: true }; }
    return null;
  };
  const fire = (v) => {
    if (g.result || proj || stars <= 0 || v.l < 30) return;
    stars--; proj = { x: SX, y: SY, vx: v.x * K, vy: v.y * K, t: 0 }; sfx.whoosh(); sfx.zap();
  };
  const g = {
    cmd: 'FLICK!', hint: 'DRAG BACK AND RELEASE (OR UP / DOWN + HOLD SPACE)', thint: 'DRAG BACK, THEN LET GO TO FLICK THE STAR', dur: 5.8,
    key(e) {
      if (g.result) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { kbMode = true; kbAng = Math.min(1.3, kbAng + .07); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { kbMode = true; kbAng = Math.max(.1, kbAng - .07); }
      else if (e.code === 'Space' && !e.repeat) { kbMode = true; if (!proj) kbHold = c; }
    },
    keyup(e) { if (e.code === 'Space' && kbHold >= 0) { const v = pullVec(); kbHold = -1; if (v) fire(v); } },
    down(p) { if (g.result || proj) return; anchor = { x: p.x, y: p.y }; cur = p; kbMode = false; },
    move(p) { if (anchor) cur = p; },
    up(p) { if (!anchor) return; cur = p; const v = pullVec(); anchor = null; cur = null; if (v) fire(v); },
    update(dt) {
      c += dt; spin += dt * 3; rest = Math.max(0, rest - dt);
      if (!proj) return;
      proj.t += dt; proj.vy += G * dt; proj.x += proj.vx * dt; proj.y += proj.vy * dt;
      if (!g.result && Math.hypot(proj.x - TX, proj.y - ty(c)) < 60) {
        sfx.hit(); sfx.thud(); burst(TX, proj.y, YEL, 20); sdEnd(g, true, 'BULLSEYE!', TX, ty(c)); proj.stuck = true; proj.vx = proj.vy = 0; proj.y = ty(c); proj.x = TX - 10;
      }
      if (!proj.stuck && (proj.y > 560 || proj.x > 860 || proj.x < -60)) {
        proj = null; rest = .3; if (!g.result) { sfx.miss(); if (stars <= 0) sdEnd(g, false, 'MISSED!'); else floatText('MISS!', 400, 300, '#fff', 34); }
      }
    },
    draw(t) {
      bg('#3558B8', '#2f4fa8', t);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 18; i++) { const x = (i * 97) % 800, y = (i * 53) % 260 + 20; ctx.fillRect(x, y + Math.sin(now * 3 + i) * 2, 4, 4); }
      sdGround(540, '#2d8f48'); ctx.fillStyle = CLAY; ctx.fillRect(0, 540, W, 8);
      claude(90, 538, 7, { mood: sdMood(g) });
      // target on a rail
      ctx.fillStyle = INK; ctx.fillRect(TX - 4, 120, 8, 350);
      const Y = ty(c);
      circ(TX, Y, 60, '#fff', 5); circ(TX, Y, 44, CLAY, 0); circ(TX, Y, 28, '#fff', 0); circ(TX, Y, 13, GOLD, 0);
      // launcher star + preview
      const v = pullVec();
      if (!proj && stars > 0 && !g.result) {
        const px = v ? SX - v.x * .35 : SX, py = v ? SY - v.y * .35 : SY;
        star(px, py, 26, 12, 5, spin, GOLD, 4);
        if (v) {
          if (anchor && cur) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(cur.x, cur.y); ctx.stroke(); }
          let x = SX, y = SY, vx = v.x * K, vy = v.y * K;
          ctx.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { vy += G * .06; x += vx * .06; y += vy * .06; ctx.globalAlpha = 1 - i / 10; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
          if (v.kb) sdBar(250, 520, 300, v.l > 0 ? (v.l - 40) / 110 : 0, GOLD, null);
        }
      }
      if (proj) star(proj.x, proj.y, 26, 12, 5, spin * 3, GOLD, 4);
      for (let i = 0; i < 2; i++) star(60 + i * 56, 50, 20, 9, 5, 0, i < stars ? GOLD : '#7d8bb5', 3);
      vignette(.2);
    }
  };
  return g;
}
reg('sd_star', sdStar, 'Star Struck');

})();
