'use strict';
/* CRITTER CLUB - farmyard animal microgames: SHOO, HERD, TEASE, RUN, WIGGLE, GRAB, LICK, PINCH.
   Input model (works on touch and desktop): everything is driven by down/move/up (pointer) plus optional keys.
   Pointer-follow games keep a persistent target so a lifted finger never "teleports" anything, and never rely on hover.
   Each game: {cmd, hint, thint, dur, update(dt), draw(t), key/keyup/down/move/up}; g.result = 'win'|'lose' */
(function () {

const GRASS = '#86DE5C', GRASS2 = '#78d34f', BARN = '#E8553D', BUTTER = '#FFD966', SKY = '#6EC6FF', PINK = '#FF9EC0',
  BROWN = '#A86B3C', CREAM = '#FFF3D6', YEL = '#FFE14D', MINT = '#5CFF7A', RED = '#ff4d4d', ORG = '#F5A84A';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const ccMood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
const ccLose = (x = 400, y = 300) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };
const ccWin = (x = 400, y = 300) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 34); ring(x, y, '#fff', 110); };
/* survive-the-clock games: win the moment the clock runs out (with fanfare) */
const survive = g => { if (!g.result && g.c >= g.dur) { g.result = 'win'; ccWin(); } };

/* ── shared art ── */
const TUFTS = []; for (let i = 0; i < 26; i++) TUFTS.push([(i * 173) % 760 + 20, (i * 97) % 480 + 90]);
function field(t, a, b) {
  bg(a || GRASS, b || GRASS2, t);
  ctx.strokeStyle = 'rgba(20,16,28,.14)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const p of TUFTS) { ctx.beginPath(); ctx.moveTo(p[0] - 7, p[1]); ctx.lineTo(p[0] - 2, p[1] - 9); ctx.moveTo(p[0] + 2, p[1] - 10); ctx.lineTo(p[0] + 4, p[1]); ctx.moveTo(p[0] + 4, p[1]); ctx.lineTo(p[0] + 10, p[1] - 7); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
function blob(x, y, rx, ry, fill, rot = 0, o = 4) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7);
  if (o > 0) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function tri(x1, y1, x2, y2, x3, y3, fill, o = 4) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath();
  ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
}
function heart(x, y, r, fill) {
  ctx.beginPath(); ctx.moveTo(x, y + r * .9);
  ctx.bezierCurveTo(x - r * 1.5, y - r * .1, x - r * .8, y - r * 1.1, x, y - r * .35);
  ctx.bezierCurveTo(x + r * .8, y - r * 1.1, x + r * 1.5, y - r * .1, x, y + r * .9); ctx.closePath();
  ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - r * .5, y - r * .35, r * .2, r * .12, -.6, 0, 7); ctx.fill();
}
function eye(x, y, r, px, py) { circ(x, y, r, '#fff', 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + px * r * .45, y + py * r * .45, r * .5, 0, 7); ctx.fill(); }
function dots(n, got, x0, y, step, col) { for (let i = 0; i < n; i++) { circ(x0 + i * step, y, 15, i < got ? col : '#fff', 4); if (i < got) star(x0 + i * step, y, 9, 4, 5, 0, '#fff', 0); } }

/* y = feet */
function rabbit(x, y, s, o) {
  o = o || {}; const sq = o.sq || 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + sq * .15), s * (1 - sq * .15));
  const W = '#F7F1E8';
  blob(-12, -80, 8, 22, W, -.15, 3); blob(12, -80, 8, 22, W, .15, 3); blob(-12, -80, 4, 15, PINK, -.15, 0); blob(12, -80, 4, 15, PINK, .15, 0);
  blob(-26, -24, 9, 9, '#fff', 0, 3); blob(0, -26, 26, 22, W);
  blob(-10, -5, 10, 6, W, 0, 3); blob(10, -5, 10, 6, W, 0, 3);
  blob(0, -54, 19, 16, W);
  if (o.scared) { eye(-8, -57, 6, 0, -.3); eye(8, -57, 6, 0, -.3); }
  else { ctx.fillStyle = INK; ctx.fillRect(-11, -60, 5, 7); ctx.fillRect(6, -60, 5, 7); }
  blob(0, -50, 4, 3, PINK, 0, 2);
  ctx.restore();
}
function pig(x, y, s, dir, o) {
  o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); shadow(0, 2, 40, 9, .25);
  const w = o.run ? Math.sin((o.t || 0) * 22) * 4 : 0, P2 = '#F57FA8';
  box(-26, -20 + w, 10, 18, P2, 3); box(14, -20 - w, 10, 18, P2, 3); box(-12, -20 - w, 10, 18, P2, 3); box(26, -20 + w, 10, 18, P2, 3);
  ctx.beginPath(); ctx.arc(-40, -42, 8, 0.5, 5.5); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = P2; ctx.stroke();
  blob(0, -36, 38, 28, PINK);
  tri(20, -62, 32, -80, 40, -58, P2, 3); blob(32, -44, 22, 20, PINK); blob(48, -38, 10, 12, P2, 0, 3);
  ctx.fillStyle = INK; ctx.fillRect(45, -41, 3, 6); ctx.fillRect(51, -41, 3, 6);
  if (o.fear) { eye(33, -48, 6, 0, -.2); ctx.fillStyle = '#4DB8FF'; ctx.beginPath(); ctx.arc(14, -64 + (now * 40 % 14), 4, 0, 7); ctx.fill(); }
  else ctx.fillRect(30, -52, 5, 7);
  ctx.restore();
}
function cat(x, y, s, o) {
  o = o || {}; ctx.save(); ctx.translate(x + (o.sway || 0), y); ctx.scale(s, s * (1 - (o.crouch || 0) * .08));
  const lx = o.lx || 0, ly = o.ly || 0, D = '#E08A2E';
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(60, -30); ctx.bezierCurveTo(120, -20, 120 + Math.sin(now * 4) * 20, -110, 80, -120); ctx.stroke();
  ctx.strokeStyle = ORG; ctx.lineWidth = 16; ctx.stroke(); ctx.lineCap = 'butt';
  blob(0, -62, 62, 62, ORG); blob(0, -48, 36, 44, CREAM, 0, 0);
  blob(-34, -6, 26, 13, ORG); blob(34, -6, 26, 13, ORG);
  tri(-52, -156, -34, -200, -12, -164, ORG); tri(52, -156, 34, -200, 12, -164, ORG);
  tri(-42, -164, -34, -186, -22, -168, PINK, 0); tri(42, -164, 34, -186, 22, -168, PINK, 0);
  blob(0, -138, 56, 46, ORG);
  ctx.strokeStyle = D; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(k * 14, -182); ctx.lineTo(k * 14, -168); ctx.stroke(); }
  ctx.lineCap = 'butt';
  for (const k of [-1, 1]) {
    const ex = k * 22, ey = -140;
    blob(ex, ey, 13, o.focus ? 15 : 12, '#E6FF70', 0, 3);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex + lx * 5, ey + ly * 5, o.focus ? 8 : 3.5, o.focus ? 11 : 11, 0, 0, 7); ctx.fill();
  }
  tri(-6, -124, 6, -124, 0, -116, PINK, 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -116); ctx.lineTo(0, -110); ctx.moveTo(0, -110); ctx.quadraticCurveTo(-8, -102, -14, -108); ctx.moveTo(0, -110); ctx.quadraticCurveTo(8, -102, 14, -108); ctx.stroke();
  for (const k of [-1, 1]) for (const j of [-6, 4]) { ctx.beginPath(); ctx.moveTo(k * 30, -118 + j * .5); ctx.lineTo(k * 62, -118 + j * 2); ctx.stroke(); }
  ctx.lineCap = 'butt'; ctx.restore();
}
function dog(x, y, s, dir, o) {
  o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s); shadow(0, 2, 38, 8, .25);
  const w = Math.sin((o.t || 0) * 24) * 5, DK = '#8a4f24';
  box(-26, -22 + w, 10, 20, DK, 3); box(14, -22 - w, 10, 20, DK, 3); box(-12, -22 - w, 10, 20, DK, 3); box(26, -22 + w, 10, 20, DK, 3);
  blob(-38, -46 + Math.sin(now * 20) * 4, 8, 15, BROWN, -.7, 3);
  blob(0, -38, 38, 24, BROWN);
  blob(34, -52, 22, 19, '#C9803F'); blob(22, -52, 8, 17, DK, .3, 3);
  blob(50, -46, 13, 10, '#EBCB9E', 0, 3); circ(60, -50, 4, INK, 0);
  if (o.mouth) { blob(54, -36, 6, 11, PINK, 0, 3); }
  if (o.mad) { ctx.fillStyle = INK; ctx.fillRect(34, -62, 14, 4); }
  eye(38, -56, 6, 1, 0);
  ctx.restore();
}
function plush(x, y, r, col) {
  circ(x - r * .7, y - r * .75, r * .38, col, 3); circ(x + r * .7, y - r * .75, r * .38, col, 3);
  circ(x, y, r, col, 4); circ(x, y + r * .25, r * .45, 'rgba(255,255,255,.55)', 0);
  ctx.fillStyle = INK; ctx.fillRect(x - r * .4, y - r * .3, r * .16, r * .22); ctx.fillRect(x + r * .24, y - r * .3, r * .16, r * .22);
  blob(x, y + r * .08, r * .13, r * .1, INK, 0, 0);
}
function bee(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const fl = Math.sin(now * 60) * .4;
  blob(-8, -16, 8, 14 + fl * 8, 'rgba(255,255,255,.85)', -.4, 3); blob(8, -16, 8, 14 - fl * 8, 'rgba(255,255,255,.85)', .4, 3);
  blob(0, 0, 22, 16, YEL);
  ctx.fillStyle = INK; for (const bx of [-6, 6]) { const h = Math.sqrt(1 - (bx / 22) * (bx / 22)) * 16; ctx.fillRect(bx - 2.5, -h, 5, h * 2); }
  tri(22, -3, 22, 3, 32, 0, INK, 2);
  ctx.fillRect(-18, -8, 4, 5); ctx.fillRect(-14, -9, 8, 3);
  ctx.restore();
}
function hen(x, y, s, o) {
  o = o || {}; ctx.save(); ctx.translate(x, y - (o.lift || 0)); ctx.scale(s, s);
  const bob = o.peck ? Math.sin(now * 14) * 3 : 0;
  tri(-52, -62, -78, -92, -40, -88, '#E8E0D0', 4); tri(-50, -52, -84, -66, -48, -76, '#fff', 3);
  blob(0, -52, 52, 44, '#fff');
  blob(-8, -50, 30, 20, '#E8E0D0', .2, 3);
  blob(30, -96 + bob, 22, 20, '#fff');
  circ(26, -118 + bob, 7, RED, 3); circ(36, -118 + bob, 7, RED, 3); circ(31, -122 + bob, 8, RED, 3);
  tri(46, -98 + bob, 66, -92 + bob, 46, -88 + bob, '#FFB43A', 3); blob(48, -82 + bob, 5, 8, RED, 0, 3);
  if (o.dizzy) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, -102 + bob); ctx.lineTo(36, -94 + bob); ctx.moveTo(36, -102 + bob); ctx.lineTo(26, -94 + bob); ctx.stroke(); }
  else { ctx.fillStyle = INK; ctx.fillRect(28, -104 + bob, 5, 8); }
  ctx.restore();
}
function egg(x, y, r) { blob(x, y, r * .8, r, '#FFD23F', 0, 4); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - r * .25, y - r * .3, r * .15, r * .28, .3, 0, 7); ctx.fill(); }

/* ───────── 1 SHOO: rabbits creep out of the garden; tap one to scare it back towards the centre ───────── */
function ccHare(sp) {
  const rs = Math.sqrt(sp), N = sp > 1.8 ? 4 : 3, CX = 400, CY = 310, R0 = 130, ROUT = 330;
  const hares = []; let c = 0;
  for (let i = 0; i < N; i++) hares.push({ a: i * 6.283 / N + rnd(-.3, .3), r: R0 + rnd(0, 50), v: rnd(58, 70) * rs, hop: rnd(0, 6), back: 0, scared: 0, delay: .45 + i * .3 });
  const hp = h => ({ x: CX + Math.cos(h.a) * h.r * 1.15, y: CY + Math.sin(h.a) * h.r * .78 });
  const scare = h => {
    if (g.result) return;
    const q = hp(h); h.back = Math.min(135, h.r - 45); h.scared = .45; h.delay = 0;
    sfx.pop(); burst(q.x, q.y - 30, '#fff', 8, 200); ring(q.x, q.y - 30, YEL, 56, .3); floatText('SHOO!', q.x, q.y - 90, YEL, 30);
  };
  const g = {
    get c() { return c; }, cmd: 'SHOO!', hint: 'CLICK THE RABBITS (OR SPACE) TO SHOO THEM BACK', thint: 'TAP THE RABBITS TO SHOO THEM BACK', dur: 5.6, timeWin: true,
    down(p) {
      if (g.result) return;
      let b = null, bd = 82;
      for (const h of hares) { const q = hp(h), d = Math.hypot(p.x - q.x, p.y - (q.y - 45)); if (d < bd) { bd = d; b = h; } }
      if (b) scare(b); else sfx.tick();
    },
    key(e) {
      if (e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      let b = null; for (const h of hares) if (!b || h.r > b.r) b = h;
      if (b) scare(b);
    },
    update(dt) {
      c += dt; survive(g); if (g.result) return;
      for (const h of hares) {
        h.scared = Math.max(0, h.scared - dt);
        if (h.delay > 0) { h.delay -= dt; continue; }
        h.hop += dt * 7;
        if (h.back > 0) { const s = Math.min(h.back, 900 * dt); h.r -= s; h.back -= s; }
        else h.r += h.v * (.4 + 1.2 * Math.max(0, Math.sin(h.hop))) * dt;
        h.a += Math.sin(c * 1.3 + h.hop * .1) * .12 * dt;
        if (h.r >= ROUT) { const q = hp(h); g.result = 'lose'; ccLose(q.x, q.y); floatText('IT ESCAPED!', 400, 300, RED, 44); break; }
      }
    },
    draw(t) {
      field(t, '#86DE5C', '#78d34f');
      // vegetable patch + scarecrow
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(CX, CY + 10, 126, 84, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.ellipse(CX, CY + 10, 118, 76, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 9; i++) { const a = i * .7, cx = CX + Math.cos(a) * (50 + i % 3 * 18), cy = CY + 14 + Math.sin(a) * (30 + i % 2 * 14); tri(cx - 7, cy, cx + 7, cy, cx, cy - 15, '#2fae4e', 2); tri(cx - 6, cy, cx + 6, cy, cx, cy + 14, '#FF8A2B', 2); }
      // fence ring
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(CX, CY, ROUT * 1.15 + 20, ROUT * .78 + 20, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = BROWN; ctx.lineWidth = 5; ctx.stroke();
      for (let i = 0; i < 30; i++) { const a = i * 6.283 / 30, px = CX + Math.cos(a) * (ROUT * 1.15 + 20), py = CY + Math.sin(a) * (ROUT * .78 + 20); box(px - 5, py - 16, 10, 28, BROWN, 3); }
      const list = hares.map(h => ({ h, q: hp(h) })).sort((a, b) => a.q.y - b.q.y);
      claude(CX, CY + 40, 6, { mood: ccMood(g) });
      for (const { h, q } of list) {
        const hopY = h.delay > 0 || h.back > 0 ? 0 : Math.abs(Math.sin(h.hop)) * 16, near = h.r > ROUT - 70;
        if (near && !g.result) { ctx.globalAlpha = .5 + .5 * Math.sin(now * 20); txt('!', clamp(q.x, 30, 770), Math.max(q.y - 118 - hopY, 100), 36, RED); ctx.globalAlpha = 1; }
        rabbit(q.x, q.y - hopY, .95, { scared: h.scared > 0 || near, sq: h.back > 0 ? .6 : (Math.sin(h.hop) < -.7 ? .5 : 0) });
      }
      vignette(.22);
    }
  };
  return g;
}
reg('cc_hare', ccHare, 'Hare Scare');

/* ───────── 2 HERD: the pig flees you; drive it into the pen ───────── */
function ccPig(sp) {
  const rs = Math.sqrt(sp), PR = 30, FR = 190, MINX = 40, MAXX = 760, MINY = 130, MAXY = 530;
  const walls = [[548, 188, 224, 12], [548, 400, 224, 12], [760, 188, 12, 224]];
  let held = false, c = 0, mx = 110, my = 500, tx = 110, ty = 500, px = 260, py = 300 + rnd(-110, 110), vx = 0, vy = 0, fear = 0, oinkT = 0, face = 1, pt = 0;
  const g = {
    get c() { return c; }, cmd: 'HERD!', hint: 'MOUSE OR ARROWS: HERD THE PIG INTO THE PEN', thint: 'DRAG TO HERD THE PIG INTO THE PEN', dur: 6,
    down(p) { held = true; tx = p.x; ty = p.y; }, move(p) { if (!TOUCH || held) { tx = p.x; ty = p.y; } }, up() { held = false; },
    update(dt) {
      c += dt; pt += dt; oinkT -= dt; fear = Math.max(0, fear - dt);
      if (g.result) { vx *= .9; vy *= .9; return; }
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if (kx || ky) { const l = Math.hypot(kx, ky); mx += kx / l * 380 * dt; my += ky / l * 380 * dt; tx = mx; ty = my; }
      else { const d = Math.hypot(tx - mx, ty - my), s = Math.min(d, 650 * dt); if (d > .01) { mx += (tx - mx) / d * s; my += (ty - my) / d * s; } }
      mx = clamp(mx, 20, 780); my = clamp(my, 90, 548);
      const dx = px - mx, dy = py - my, d = Math.hypot(dx, dy) || 1;
      if (d < FR) {
        const k = 1 - d / FR, push = 250 * rs * (.4 + k), ux = dx / d, uy = dy / d;
        const side = Math.sign(300 - py) || 1, wx = -uy * side, wy = ux * side;
        const bx = ux * push + wx * 70 * k * (wy * side > 0 ? 1 : .3), by = uy * push + wy * 70 * k * .5;
        vx += (bx - vx) * Math.min(1, dt * 9); vy += (by - vy) * Math.min(1, dt * 9);
        fear = .25; if (oinkT <= 0 && k > .5) { oinkT = 1.2; sfx.boing(); }
      } else { vx *= 1 - Math.min(1, dt * 4); vy *= 1 - Math.min(1, dt * 4); }
      px += vx * dt; py += vy * dt;
      if (Math.abs(vx) > 8) face = vx > 0 ? 1 : -1;
      if (px < MINX) { px = MINX; vx = Math.max(0, vx); } if (px > MAXX) { px = MAXX; vx = Math.min(0, vx); }
      if (py < MINY) { py = MINY; vy = Math.max(0, vy); } if (py > MAXY) { py = MAXY; vy = Math.min(0, vy); }
      for (const w of walls) {
        const nx = clamp(px, w[0], w[0] + w[2]), ny = clamp(py - 20, w[1], w[1] + w[3]), ddx = px - nx, ddy = py - 20 - ny, dd = Math.hypot(ddx, ddy);
        if (dd < PR) {
          if (dd > .001) { px = nx + ddx / dd * PR; py = ny + 20 + ddy / dd * PR; const dv = vx * ddx / dd + vy * ddy / dd; if (dv < 0) { vx -= dv * ddx / dd; vy -= dv * ddy / dd; } }
          else { py -= PR; vy = -Math.abs(vy); }
        }
      }
      if (px > 585 && py > 218 && py < 392) {
        g.result = 'win'; ccWin(px, py); sfx.boing(); floatText('OINK!', px, py - 90, PINK, 46);
      }
    },
    draw(t) {
      field(t, '#9BE36B', '#8ad95c');
      // hay in pen
      ctx.fillStyle = INK; ctx.fillRect(544, 196, 220, 208); ctx.fillStyle = BUTTER; ctx.fillRect(548, 200, 212, 200);
      ctx.strokeStyle = '#E0B840'; ctx.lineWidth = 3; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(556 + i * 17, 210 + i % 3 * 30); ctx.lineTo(572 + i * 17, 224 + i % 3 * 30); ctx.stroke(); }
      txt('PEN', 654, 160, 28, '#fff');
      // dust trail hint arrow
      ctx.globalAlpha = .55 + .3 * Math.sin(now * 5); drawArrow(520, 300, 1, 18, '#fff'); ctx.globalAlpha = 1;
      for (const w of walls) { box3(w[0], w[1], w[2], w[3], BROWN, 3, 4); }
      for (let i = 0; i < 5; i++) { box(552 + i * 52, 180, 12, 32, BROWN, 3); box(552 + i * 52, 392, 12, 32, BROWN, 3); }
      box(752, 196, 16, 32, BROWN, 3); box(752, 372, 16, 32, BROWN, 3);
      // herder zone
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.arc(mx, my, FR, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const items = [{ y: py, f: () => pig(px, py + 20, 1, face, { run: Math.hypot(vx, vy) > 40, t: pt, fear: fear > 0 && !g.result }) }, { y: my, f: () => { shadow(mx, my + 2, 28, 8, .25); claude(mx, my, 4.5, { mood: ccMood(g) }); } }];
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      vignette(.2);
    }
  };
  return g;
}
reg('cc_pig', ccPig, 'Bacon Patrol');

/* ───────── 3 TEASE: dangle the toy; dodge the paw before it lands ───────── */
function ccCat(sp) {
  const rs = Math.sqrt(sp), CATX = 400, CATY = 520, SHX = 400, SHY = 430, HIT = 68;
  const W = .7 / rs, LOCK = W - .3 / rs, STR = .09, HOLD = .24, RET = .2, GAP = .28 / rs;
  let held = false, c = 0, tx = 400, ty = 190, x = 400, y = 190, ph = 'idle', pt = .9, aim = { x: 400, y: 200 }, locked = false, ext = 0, caught = false, swipes = 0;
  const g = {
    get c() { return c; }, cmd: 'TEASE!', hint: 'MOUSE OR ARROWS: KEEP THE TOY OUT OF THE PAW', thint: 'DRAG THE TOY AWAY FROM THE PAW', dur: 5.6, timeWin: true,
    down(p) { held = true; tx = p.x; ty = p.y; }, move(p) { if (!TOUCH || held) { tx = p.x; ty = p.y; } }, up() { held = false; },
    update(dt) {
      c += dt; survive(g);
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if (kx || ky) { tx += kx * 560 * dt; ty += ky * 560 * dt; }
      tx = clamp(tx, 50, 750); ty = clamp(ty, 120, 545);
      if (!caught) { x += (tx - x) * Math.min(1, dt * 14); y += (ty - y) * Math.min(1, dt * 14); }
      else { x += 300 * dt; y -= 200 * dt; }
      pt -= dt;
      if (ph === 'idle') { ext = Math.max(0, ext - dt * 6); if (pt <= 0 && !g.result) { ph = 'wind'; pt = W; locked = false; } }
      else if (ph === 'wind') {
        if (!locked) { aim.x += (x - aim.x) * Math.min(1, dt * 12); aim.y += (y - aim.y) * Math.min(1, dt * 12); }
        if (!locked && pt <= W - LOCK) { locked = true; aim.x = x; aim.y = y; sfx.tickHi(); }
        if (pt <= 0) { ph = 'strike'; pt = STR; sfx.whoosh(); }
      } else if (ph === 'strike') {
        ext = Math.min(1, 1 - pt / STR);
        if (pt <= 0) { ext = 1; ph = 'hold'; pt = HOLD; swipes++; sfx.thud(); shake(4, .12); g.hitCheck(); }
      } else if (ph === 'hold') { g.hitCheck(); if (pt <= 0) { ph = 'ret'; pt = RET; } }
      else if (ph === 'ret') { ext = Math.max(0, pt / RET); if (pt <= 0) { ph = 'idle'; pt = GAP; ext = 0; } }
    },
    hitCheck() {
      if (g.result || caught || Math.hypot(x - aim.x, y - aim.y) > HIT) return;
      caught = true; g.result = 'lose'; ccLose(x, y); floatText('CAUGHT!', 400, 300, RED, 48);
    },
    draw(t) {
      field(t, '#FFD9A0', '#f7cc8c');
      // rug + floor boards
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(400, 330, 330, 210, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#E96A5A'; ctx.beginPath(); ctx.ellipse(400, 330, 322, 202, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#F7A99C'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(400, 330, 270, 160, 0, 0, 7); ctx.stroke();
      const wind = ph === 'wind', look = clamp((x - CATX) / 300, -1, 1), lookY = clamp((y - 300) / 300, -1, 1);
      // lock marker
      if (wind || ph === 'strike') {
        const mxp = locked ? aim.x : aim.x, myp = locked ? aim.y : aim.y, pul = locked ? 1 + Math.sin(now * 40) * .08 : 1;
        ctx.globalAlpha = locked ? 1 : .45; ctx.strokeStyle = locked ? RED : '#fff'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(mxp, myp, HIT * pul, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mxp - 24, myp - 24); ctx.lineTo(mxp + 24, myp + 24); ctx.moveTo(mxp + 24, myp - 24); ctx.lineTo(mxp - 24, myp + 24); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      cat(CATX, CATY, 1.35, { sway: wind ? Math.sin(now * 40) * 4 : 0, crouch: wind ? 1 : 0, focus: wind || ph === 'strike' || ph === 'hold', lx: look, ly: lookY });
      // rubber arm
      if (ext > 0) {
        const ex = SHX + (aim.x - SHX) * ext, ey = SHY + (aim.y - SHY) * ext;
        ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(SHX, SHY); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = ORG; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(SHX, SHY); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineCap = 'butt';
        circ(ex, ey, 36, ORG, 5); circ(ex, ey + 6, 14, PINK, 0);
        for (const k of [-1, 0, 1]) circ(ex + k * 18, ey - 20, 6, PINK, 0);
      }
      // wand string + toy
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + (x - 400) * .15, -10); ctx.quadraticCurveTo(x + Math.sin(now * 5) * 10, y * .5, x, y - 18); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * 6) * .3 + (caught ? now * 8 : 0));
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = -2.6 + i * .42; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36 + 10); ctx.stroke(); }
      ctx.lineCap = 'butt'; circ(0, 8, 15, '#FF4D9E', 4); circ(-4, 4, 5, '#fff', 0); ctx.restore();
      if (g.result === 'lose') txt('GOTCHA', 400, 80, 30, '#fff');
      vignette(.2);
    }
  };
  return g;
}
reg('cc_cat', ccCat, 'Kit-tease');

/* ───────── 4 RUN: loop round the post so the dog never catches you ───────── */
function ccDog(sp) {
  const rs = Math.sqrt(sp), POX = 400, POY = 330, PRAD = 46, MR = 20, DR = 26, MINX = 36, MAXX = 764, MINY = 120, MAXY = 530;
  const DSP = Math.min(255, 175 * rs), MSP = 290;
  let held = false, c = 0, mx = 670, my = 470, tx = 670, ty = 470, dx = 120, dy = 160, side = 0, face = 1, dt0 = 0, mface = -1;
  const push = (x, y, r) => {
    const ddx = x - POX, ddy = y - POY, dd = Math.hypot(ddx, ddy) || 1, m = PRAD + r;
    return dd < m ? [POX + ddx / dd * m, POY + ddy / dd * m] : [x, y];
  };
  const g = {
    get c() { return c; }, cmd: 'RUN!', hint: 'MOUSE OR ARROWS: CIRCLE THE POST, DODGE THE DOG', thint: 'DRAG TO RUN ROUND THE POST AND DODGE THE DOG', dur: 5.6, timeWin: true,
    down(p) { held = true; tx = p.x; ty = p.y; }, move(p) { if (!TOUCH || held) { tx = p.x; ty = p.y; } }, up() { held = false; },
    update(dt) {
      c += dt; dt0 += dt; survive(g); if (g.result) return;
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if (kx || ky) { const l = Math.hypot(kx, ky); mx += kx / l * MSP * dt; my += ky / l * MSP * dt; tx = mx; ty = my; if (kx) mface = kx; }
      else { const d = Math.hypot(tx - mx, ty - my), s = Math.min(d, MSP * dt); if (d > 1) { mx += (tx - mx) / d * s; my += (ty - my) / d * s; if (Math.abs(tx - mx) > 4) mface = tx > mx ? 1 : -1; } }
      [mx, my] = push(clamp(mx, MINX, MAXX), clamp(my, MINY, MAXY), MR);
      if (c > .7) {
        let ux = mx - dx, uy = my - dy; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
        const sd = (function () { const ax = dx, ay = dy, bx = mx, by = my, ddx = bx - ax, ddy = by - ay, l = ddx * ddx + ddy * ddy || 1, k = clamp(((POX - ax) * ddx + (POY - ay) * ddy) / l, 0, 1); return Math.hypot(POX - ax - k * ddx, POY - ay - k * ddy); })();
        if (sd < PRAD + DR + 10) {
          if (!side) side = ((mx - dx) * (POY - dy) - (my - dy) * (POX - dx)) > 0 ? -1 : 1;
          const a = side * .85, cs = Math.cos(a), sn = Math.sin(a), rx = ux * cs - uy * sn, ry = ux * sn + uy * cs; ux = rx; uy = ry;
        } else side = 0;
        dx += ux * DSP * dt; dy += uy * DSP * dt; if (Math.abs(ux) > .2) face = ux > 0 ? 1 : -1;
      }
      dx = clamp(dx, MINX, MAXX); dy = clamp(dy, MINY, MAXY); [dx, dy] = push(dx, dy, DR);
      if (c > .7 && Math.hypot(dx - mx, dy - my) < 44) { g.result = 'lose'; ccLose(mx, my); floatText('CHOMP!', 400, 250, RED, 50); }
    },
    draw(t) {
      field(t, '#A8E67A', '#99dd6a');
      // dirt ring round the post
      ctx.fillStyle = 'rgba(168,107,60,.35)'; ctx.beginPath(); ctx.ellipse(POX, POY + 6, 150, 130, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.arc(POX, POY, 118, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      // post (top-down stump)
      circ(POX, POY + 8, PRAD, '#7a4a22', 5); circ(POX, POY, PRAD, BROWN, 5);
      ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3; for (const r of [14, 28]) { ctx.beginPath(); ctx.arc(POX, POY, r, 0, 7); ctx.stroke(); }
      box(POX - 8, POY - 6, 16, 12, BARN, 2);
      if (!g.result && c < .9) { txt('GET READY', 400, 105, 26, '#fff'); }
      const run = Math.hypot(tx - mx, ty - my) > 4 || keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown;
      const items = [{ y: dy, f: () => dog(dx, dy + 20, 1.05, face, { t: dt0, mouth: true, mad: c > .6 }) },
        { y: my, f: () => { shadow(mx, my + 2, 26, 7, .25); ctx.save(); ctx.translate(mx, my); if (run) ctx.rotate(Math.sin(now * 20) * .06); claude(0, 0, 4, { mood: ccMood(g) }); ctx.restore(); } }];
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      if (!TOUCH || (tx !== mx || ty !== my)) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, 10, 0, 7); ctx.stroke(); }
      vignette(.2);
    }
  };
  return g;
}
reg('cc_dog', ccDog, 'Beware of Dog');

/* ───────── 5 WIGGLE: draw a path (or steer with arrows) so the worm reaches the pond ───────── */
function ccWorm(sp) {
  const rs = Math.sqrt(sp), SPEED = 225 * rs, POND = { x: 685, y: 330, r: 82 };
  const rocks = [{ x: 280 + rnd(-20, 20), y: 240 + rnd(-30, 30), r: 42 }, { x: 440 + rnd(-20, 20), y: 400 + rnd(-30, 20), r: 46 }, { x: 540 + rnd(-10, 10), y: 230 + rnd(-20, 30), r: 40 }];
  const head = { x: 90, y: 330 }, hist = [{ x: head.x, y: head.y }], queue = [];
  let c = 0, held = false, stall = 0, hx0 = 0, hy0 = 0, wig = 0;
  const bad = (x, y, m) => { for (const r of rocks) if (Math.hypot(x - r.x, y - r.y) < r.r + m) return true; return x < 20 || x > 780 || y < 110 || y > 540; };
  const tail = () => queue.length ? queue[queue.length - 1] : head;
  const addPt = (p, first) => {
    const l = tail();
    if (bad(p.x, p.y, 16) || (!first && Math.hypot(p.x - l.x, p.y - l.y) < 16)) return;
    if (queue.length < 300) queue.push({ x: p.x, y: p.y });
  };
  const g = {
    get c() { return c; }, cmd: 'WIGGLE!', hint: 'DRAG (OR ARROWS) TO LEAD THE WORM TO THE POND', thint: 'DRAG A PATH TO THE POND', dur: 6,
    down(p) { if (g.result) return; held = true; addPt(p, true); }, move(p) { if (held && !g.result) addPt(p); }, up() { held = false; },
    update(dt) {
      c += dt; wig += dt; if (g.result) return;
      let kx = 0, ky = 0;
      if (keys.ArrowLeft || keys.KeyA) kx -= 1; if (keys.ArrowRight || keys.KeyD) kx += 1;
      if (keys.ArrowUp || keys.KeyW) ky -= 1; if (keys.ArrowDown || keys.KeyS) ky += 1;
      if ((kx || ky) && queue.length < 4) { const l = tail(), n = Math.hypot(kx, ky); addPt({ x: l.x + kx / n * 16, y: l.y + ky / n * 16 }, true); }
      let step = SPEED * dt; const sx = head.x, sy = head.y;
      while (step > 0 && queue.length) {
        const q = queue[0], d = Math.hypot(q.x - head.x, q.y - head.y);
        if (d <= step) { head.x = q.x; head.y = q.y; step -= d; queue.shift(); } else { head.x += (q.x - head.x) / d * step; head.y += (q.y - head.y) / d * step; step = 0; }
      }
      for (const r of rocks) { const ddx = head.x - r.x, ddy = head.y - r.y, dd = Math.hypot(ddx, ddy) || 1, m = r.r + 12; if (dd < m) { head.x = r.x + ddx / dd * m; head.y = r.y + ddy / dd * m; } }
      const mv = Math.hypot(head.x - sx, head.y - sy);
      if (queue.length && mv < SPEED * dt * .2) { stall += dt; if (stall > .45) { queue.length = 0; stall = 0; sfx.miss(); floatText('STUCK!', head.x, head.y - 50, '#fff', 26); } } else stall = 0;
      const lh = hist[hist.length - 1];
      if (Math.hypot(head.x - lh.x, head.y - lh.y) >= 7) { hist.push({ x: head.x, y: head.y }); if (hist.length > 80) hist.shift(); }
      if (Math.hypot(head.x - POND.x, head.y - POND.y) < POND.r - 14) {
        g.result = 'win'; ccWin(POND.x, POND.y); sfx.splat(); burst(POND.x, POND.y, '#4DB8FF', 18); floatText('SPLASH!', POND.x, POND.y - 100, '#fff', 44);
      }
    },
    draw(t) {
      field(t, '#C99A63', '#bd8d57');
      // pond
      circ(POND.x, POND.y, POND.r, '#4DB8FF', 6); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(POND.x, POND.y, 24 + i * 22 + Math.sin(now * 3 + i) * 3, .3, 2.2); ctx.stroke(); }
      txt('POND', POND.x, POND.y - POND.r - 24, 26, '#fff');
      for (const r of rocks) { circ(r.x, r.y + 5, r.r, '#6b6580', 5); circ(r.x - 4, r.y - 2, r.r - 5, '#9a94b0', 0); circ(r.x - r.r * .3, r.y - r.r * .3, r.r * .25, 'rgba(255,255,255,.35)', 0); }
      // sun
      const heat = g.result === 'win' ? 0 : clamp(c / g.dur, 0, 1);
      star(70, 160, 46, 32, 12, now, heat > .6 ? '#FF8A2B' : YEL, 4); circ(70, 160, 26, heat > .6 ? '#FF6A2B' : '#FFD23F', 3);
      ctx.fillStyle = INK; ctx.fillRect(58, 154, 5, heat > .6 ? 4 : 8); ctx.fillRect(76, 154, 5, heat > .6 ? 4 : 8);
      // queued path
      if (queue.length) {
        ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(head.x, head.y); for (const q of queue) ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.strokeStyle = YEL; ctx.lineWidth = 5; ctx.setLineDash([2, 12]); ctx.beginPath(); ctx.moveTo(head.x, head.y); for (const q of queue) ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
      } else if (!g.result && c < 3.2) {
        ctx.globalAlpha = .7; drawArrow(head.x + 60, head.y - 56, 1, 18, '#fff'); ctx.globalAlpha = 1;
      }
      // worm body (older history = further back)
      const n = 13;
      for (let i = n; i >= 0; i--) {
        const k = Math.min(hist.length - 1, Math.max(0, hist.length - 1 - i * 2)), q = i === 0 ? head : hist[k];
        const wob = Math.sin(wig * 9 - i * .9) * 3;
        circ(q.x + wob * .6, q.y + wob, i === 0 ? 17 : 15 - i * .35, i % 2 ? '#FF8FB0' : PINK, 4);
      }
      const hx = head.x, hy = head.y; ctx.fillStyle = INK; ctx.fillRect(hx + 2, hy - 8, 5, 8); ctx.fillRect(hx + 9, hy - 8, 5, 8);
      if (g.result === 'win') txt('♥', hx + 8, hy - 36, 34, '#ff4d9e');
      vignette(.2);
    }
  };
  return g;
}
reg('cc_worm', ccWorm, 'Worm Squirm');

/* ───────── 6 GRAB: aim the claw, drop it, lift a plush all the way up ───────── */
function ccClaw(sp) {
  const rs = Math.sqrt(sp), TOP = 130, BOT = 372, FLOOR = 420, LX = 150, RX = 650;
  const cols = ['#FF4D9E', '#4DB8FF', '#5CFF7A', '#FF8A2B', '#B67BFF'];
  const toys = cols.map((col, i) => ({ col, ph: i * 1.3 + rnd(0, .6), w: (.5 + i % 3 * .12) * rs, amp: 150 + i % 2 * 60, x: 400, y: FLOOR - 36, got: false }));
  let pdown = false, c = 0, cx = 400, tx = 400, cy = TOP, st = 'idle', stt = 0, grab = null, btn = '', open = 1, tries = 0;
  const B = { L: [24, 482, 170, 62], R: [210, 482, 170, 62], D: [470, 482, 306, 62] };
  const hit = (p, b) => p.x >= b[0] - 6 && p.x <= b[0] + b[2] + 6 && p.y >= b[1] - 8 && p.y <= b[1] + b[3] + 8;
  const drop = () => { if (g.result || st !== 'idle') return; st = 'down'; stt = 0; sfx.whoosh(false); };
  const g = {
    get c() { return c; }, cmd: 'GRAB!', hint: 'MOUSE OR ARROWS: MOVE. CLICK OR SPACE: DROP THE CLAW', thint: 'MOVE THE CLAW, THEN TAP DROP', dur: 6,
    down(p) {
      if (g.result) return;
      btn = ''; pdown = true;
      for (const k in B) if (hit(p, B[k])) { btn = k; break; }
      if (btn === 'D') { drop(); return; }
      if (btn) return;
      tx = p.x; if (!TOUCH) drop();
    },
    move(p) { if (!btn && (!TOUCH || pdown)) tx = p.x; }, up() { btn = ''; pdown = false; },
    key(e) { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS')) drop(); },
    update(dt) {
      c += dt;
      for (const p of toys) if (!p.got || p !== grab) { p.x = 400 + Math.sin(c * p.w + p.ph) * p.amp; }
      if (g.result) return;
      let dir = 0; if (keys.ArrowLeft || keys.KeyA) dir -= 1; if (keys.ArrowRight || keys.KeyD) dir += 1; if (btn === 'L') dir -= 1; if (btn === 'R') dir += 1;
      if (st === 'idle') { if (dir) { tx = clamp(cx + dir * 400 * dt, LX, RX); cx = tx; } else { const d = clamp(tx, LX, RX) - cx; cx += clamp(d, -700 * dt, 700 * dt); } }
      stt += dt;
      if (st === 'down') { cy = Math.min(BOT, cy + 520 * dt); open = 1; if (cy >= BOT) { st = 'close'; stt = 0; sfx.click(); } }
      else if (st === 'close') {
        open = Math.max(.15, 1 - stt / .22);
        if (stt >= .26) {
          let b = null, bd = 46; for (const p of toys) { const d = Math.abs(p.x - cx); if (d < bd) { bd = d; b = p; } }
          if (b) { grab = b; b.got = true; sfx.coin(); burst(cx, BOT + 10, '#fff', 6, 160); floatText('GOT IT!', cx, BOT - 40, YEL, 28); }
          else { sfx.miss(); floatText('MISS!', cx, BOT - 40, '#fff', 28); }
          st = 'up'; stt = 0; tries++;
        }
      } else if (st === 'up') {
        cy = Math.max(TOP, cy - 400 * dt); if (grab) { grab.x = cx; grab.y = cy + 36; }
        if (cy <= TOP) {
          if (grab) { g.result = 'win'; ccWin(cx, 300); }
          else { st = 'idle'; open = 1; }
        }
      }
    },
    draw(t) {
      bg('#FF8FC7', '#f57db8', t);
      // cabinet
      box3(70, 70, 660, 400, '#2c2540', 6, 8);
      ctx.fillStyle = '#d9f4ff'; ctx.fillRect(86, 86, 628, 368); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(86, 86, 628, 368);
      ctx.fillStyle = '#e7d3ff'; ctx.fillRect(86, FLOOR, 628, 34);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) ctx.fillRect(110 + i * 80, 96, 10, 360);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(86, 86, 628, 10);
      // toys
      for (const p of toys) { if (p.got && grab === p) continue; shadow(p.x, FLOOR - 2, 34, 8, .25); plush(p.x, FLOOR - 36, 34, p.col); }
      // claw
      ctx.fillStyle = INK; ctx.fillRect(86, 112, 628, 14); ctx.fillStyle = '#b8b0cc'; ctx.fillRect(86, 114, 628, 8);
      box(cx - 22, 104, 44, 30, '#FFD23F', 4);
      ctx.fillStyle = INK; ctx.fillRect(cx - 4, 134, 8, Math.max(0, cy - 134)); ctx.fillStyle = '#b8b0cc'; ctx.fillRect(cx - 2, 134, 4, Math.max(0, cy - 134));
      if (grab) plush(grab.x, grab.y, 34, grab.col);
      const o = 16 + open * 30;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const s of [-1, 1]) {
        ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(cx + s * 8, cy); ctx.lineTo(cx + s * o, cy + 24); ctx.lineTo(cx + s * (o - 12 - open * 6), cy + 54); ctx.stroke();
        ctx.strokeStyle = '#ff6a6a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx + s * 8, cy); ctx.lineTo(cx + s * o, cy + 24); ctx.lineTo(cx + s * (o - 12 - open * 6), cy + 54); ctx.stroke();
      }
      ctx.lineCap = 'butt'; box(cx - 14, cy - 8, 28, 20, '#FFD23F', 4);
      if (st === 'idle' && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(cx, cy + 56); ctx.lineTo(cx, FLOOR); ctx.stroke(); ctx.setLineDash([]); }
      // controls
      const lab = { L: '◀', R: '▶', D: 'DROP' };
      for (const k in B) { const b = B[k], on = btn === k, dis = k === 'D' && st !== 'idle'; box3(b[0], b[1], b[2], b[3], dis ? '#9a94b0' : k === 'D' ? '#FF4D4D' : YEL, 4, on ? 2 : 6); txt(lab[k], b[0] + b[2] / 2, b[1] + b[3] / 2 + (on ? 3 : 0), k === 'D' ? 36 : 44, k === 'D' ? '#fff' : INK); }
      claude(765, 468, 3, { mood: ccMood(g) });
      vignette(.2);
    }
  };
  return g;
}
reg('cc_claw', ccClaw, 'The Claw');

/* ───────── 7 LICK: flick the frog's tongue at hearts, avoid the bees ───────── */
function ccFrog(sp) {
  const rs = Math.sqrt(sp), FX = 400, FY = 545, MX = 400, MY = 508, NEED = 3, NB = sp > 1.5 ? 3 : 2;
  const ents = []; let c = 0, got = 0, tg = null, tt = 0, aimA = -Math.PI / 2, mstick = null;
  for (let i = 0; i < NEED + NB; i++) {
    const heartE = i < NEED, a = rnd(0, 6.283), v = (heartE ? rnd(55, 85) : rnd(85, 120)) * rs;
    ents.push({ k: heartE ? 'h' : 'b', x: 120 + (i * 137) % 560 + rnd(-20, 20), y: 160 + (i * 71) % 190 + rnd(0, 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6, ph: rnd(0, 6), dead: false });
  }
  const flick = (x, y, ent) => {
    if (g.result || tg) return;
    tg = { x, y, ent }; tt = 0; sfx.whoosh(true);
  };
  const near = (px, py, rad) => {
    let b = null, bd = rad;
    for (const e of ents) { if (e.dead) continue; const d = Math.hypot(e.x - px, e.y - py) * (rad / (e.k === 'h' ? rad : 50)); if (d < bd) { bd = d; b = e; } }
    return b;
  };
  const g = {
    get c() { return c; }, cmd: 'LICK!', hint: 'CLICK A HEART (OR AIM WITH ARROWS, SPACE): AVOID BEES', thint: 'TAP THE HEARTS, NOT THE BEES', dur: 6,
    down(p) { if (g.result) return; const e = near(p.x, p.y, 72); aimA = Math.atan2(p.y - MY, p.x - MX); flick(e ? e.x : p.x, e ? e.y : p.y, e); },
    key(e) {
      if (e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      const dx = Math.cos(aimA), dy = Math.sin(aimA); let b = null, bp = 1e9;
      for (const en of ents) { if (en.dead) continue; const rx = en.x - MX, ry = en.y - MY, pr = rx * dx + ry * dy, pe = Math.abs(rx * dy - ry * dx); if (pr > 0 && pe < 50 && pr < bp) { bp = pr; b = en; } }
      flick(b ? b.x : MX + dx * 380, b ? b.y : MY + dy * 380, b);
    },
    update(dt) {
      c += dt;
      if (!g.result && (keys.ArrowLeft || keys.KeyA)) aimA -= 1.5 * dt;
      if (!g.result && (keys.ArrowRight || keys.KeyD)) aimA += 1.5 * dt;
      aimA = clamp(aimA, -Math.PI * .96, -Math.PI * .04);
      for (const e of ents) {
        if (e.dead) continue;
        if (!g.result && !(tg && tg.ent === e && tt > .08)) {
          e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(c * 2 + e.ph) * 12 * dt;
          if (e.x < 60) { e.x = 60; e.vx = Math.abs(e.vx); } if (e.x > 700) { e.x = 700; e.vx = -Math.abs(e.vx); }
          if (e.y < 150) { e.y = 150; e.vy = Math.abs(e.vy); } if (e.y > 390) { e.y = 390; e.vy = -Math.abs(e.vy); }
          if (e.k === 'b') { e.vx += Math.sin(c * 3 + e.ph) * 40 * dt; }
        }
      }
      if (tg) {
        tt += dt; if (tg.ent && !tg.ent.dead) { tg.x = tg.ent.x; tg.y = tg.ent.y; }
        if (tt >= .12 && !tg.done) {
          tg.done = true;
          if (tg.ent && !tg.ent.dead && Math.hypot(tg.ent.x - tg.x, tg.ent.y - tg.y) < 60) {
            const e = tg.ent;
            if (e.k === 'h') { e.dead = true; got++; sfx.coin(); sfx.blip(got * 3); burst(e.x, e.y, '#ff4d9e', 12); ring(e.x, e.y, '#fff', 60, .3); floatText('YUM!', e.x, e.y - 40, '#ff4d9e', 32); if (got >= NEED) { g.result = 'win'; ccWin(400, 300); } }
            else { e.dead = true; g.result = 'lose'; ccLose(e.x, e.y); floatText('OUCH!', e.x, e.y - 40, RED, 44); }
          } else sfx.miss();
        }
        if (tt >= .26) tg = null;
      }
    },
    draw(t) {
      bg('#3CC8A8', '#34b898', t);
      // lily pond
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(400, 520, 420, 120, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2f9ad4'; ctx.beginPath(); ctx.ellipse(400, 520, 410, 112, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(90 + i * 210, 560, 36 + Math.sin(now * 2 + i) * 3, .2, 2.4); ctx.stroke(); }
      circ(150, 540, 36, '#5CD65C', 4); circ(650, 548, 36, '#5CD65C', 4);
      // reticle (keyboard)
      if (!TOUCH && !g.result) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(MX, MY); ctx.lineTo(MX + Math.cos(aimA) * 420, MY + Math.sin(aimA) * 420); ctx.stroke(); ctx.setLineDash([]); }
      for (const e of ents) {
        if (e.dead) continue;
        if (e.k === 'h') { const s = 1 + Math.sin(now * 5 + e.ph) * .08; heart(e.x, e.y, 30 * s, '#ff4d9e'); }
        else bee(e.x, e.y + Math.sin(now * 8 + e.ph) * 3, 1.5);
      }
      // frog + tongue
      let tip = null;
      if (tg) { const u = tt < .12 ? tt / .12 : 1 - (tt - .12) / .14, k = clamp(u, 0, 1); tip = { x: MX + (tg.x - MX) * k, y: MY + (tg.y - MY) * k }; }
      if (tip) {
        ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(MX, MY); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.strokeStyle = '#FF6F91'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(MX, MY); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.lineCap = 'butt';
        circ(tip.x, tip.y, 13, '#FF6F91', 4);
      }
      shadow(FX, FY + 24, 90, 18, .25);
      blob(FX, FY - 20, 74, 54, '#4ADE5A'); blob(FX, FY - 8, 46, 32, '#C8F7A0', 0, 0);
      blob(-0 + FX - 64, FY + 12, 24, 12, '#4ADE5A'); blob(FX + 64, FY + 12, 24, 12, '#4ADE5A');
      for (const s of [-1, 1]) { circ(FX + s * 36, FY - 74, 22, '#4ADE5A', 4); eye(FX + s * 36, FY - 76, 14, Math.cos(aimA) * 1, Math.sin(aimA) * 1); }
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      if (g.result === 'lose') { ctx.moveTo(FX - 28, FY - 22); ctx.quadraticCurveTo(FX, FY - 40, FX + 28, FY - 22); }
      else if (tip) { ctx.ellipse(FX, FY - 36, 18, 8, 0, 0, 7); } else { ctx.moveTo(FX - 32, FY - 36); ctx.quadraticCurveTo(FX, FY - 20, FX + 32, FY - 36); }
      ctx.stroke(); ctx.lineCap = 'butt';
      dots(NEED, got, 330, 98, 70, '#ff4d9e');
      vignette(.2);
    }
  };
  return g;
}
reg('cc_frog', ccFrog, 'Lickety-Split');

/* ───────── 8 PINCH: shell game with hens - follow the golden egg, then pinch the right hen ───────── */
function ccHen(sp) {
  const rs = Math.sqrt(sp), SX = [190, 400, 610], SY = 400, ST = .42 / rs, SHOW = .95;
  const hens = [0, 1, 2].map(i => ({ id: i, slot: i, fx: SX[i], fy: 0, lift: 0 }));
  const eggHen = Math.floor(Math.random() * 3), NSW = Math.max(3, Math.min(7, 4 + Math.round((sp - 1) * 1.5), Math.floor((5.8 - SHOW - 2.1) / ST)));
  let c = 0, ph = 'show', pt = SHOW, swaps = 0, sw = null, cur = 1, chosen = -1, last = [-1, -1];
  const slotOf = id => hens.find(h => h.id === id);
  const startSwap = () => {
    let a, b; do { a = Math.floor(Math.random() * 3); b = (a + 1 + Math.floor(Math.random() * 2)) % 3; } while ((a === last[0] && b === last[1]) || (a === last[1] && b === last[0]));
    last = [a, b];
    const ha = hens.find(h => h.slot === a), hb = hens.find(h => h.slot === b);
    sw = { ha, hb, a, b, t: 0 }; sfx.tick();
  };
  const pick = slot => {
    if (g.result || ph !== 'pick') return;
    const h = hens.find(h => h.slot === slot); chosen = h.id; ph = 'reveal'; pt = .3;
    if (h.id === eggHen) { g.result = 'win'; ccWin(SX[slot], 300); sfx.boing(); floatText('PINCH!', SX[slot], 220, YEL, 44); }
    else { g.result = 'lose'; ccLose(SX[slot], 360); floatText('EMPTY!', SX[slot], 220, RED, 44); }
  };
  const g = {
    get c() { return c; }, cmd: 'PINCH!', hint: 'WATCH THE EGG, THEN CLICK OR PRESS 1 2 3 TO PICK THE HEN', thint: 'WATCH THE EGG, THEN TAP ITS HEN', dur: 6,
    down(p) {
      if (ph !== 'pick') return;
      let b = 0, bd = 1e9; for (let i = 0; i < 3; i++) { const d = Math.abs(p.x - SX[i]); if (d < bd) { bd = d; b = i; } }
      cur = b; pick(b);
    },
    key(e) {
      if (e.repeat || ph !== 'pick') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') cur = (cur + 2) % 3;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') cur = (cur + 1) % 3;
      else if (e.code === 'Digit1' || e.code === 'Numpad1') { cur = 0; pick(0); }
      else if (e.code === 'Digit2' || e.code === 'Numpad2') { cur = 1; pick(1); }
      else if (e.code === 'Digit3' || e.code === 'Numpad3') { cur = 2; pick(2); }
      else if (e.code === 'Space' || e.code === 'Enter') pick(cur);
    },
    update(dt) {
      c += dt; pt -= dt;
      if (ph === 'show') {
        const hh = slotOf(eggHen); hh.lift = Math.sin(clamp((SHOW - pt) / SHOW, 0, 1) * Math.PI) * 70;
        if (pt <= 0) { hh.lift = 0; ph = 'shuffle'; startSwap(); }
      } else if (ph === 'shuffle') {
        sw.t += dt; const u = clamp(sw.t / ST, 0, 1), e = u * u * (3 - 2 * u);
        sw.ha.fx = SX[sw.a] + (SX[sw.b] - SX[sw.a]) * e; sw.hb.fx = SX[sw.b] + (SX[sw.a] - SX[sw.b]) * e;
        sw.ha.fy = -Math.sin(u * Math.PI) * 46; sw.hb.fy = Math.sin(u * Math.PI) * 30;
        if (u >= 1) {
          sw.ha.slot = sw.b; sw.hb.slot = sw.a; sw.ha.fx = SX[sw.b]; sw.hb.fx = SX[sw.a]; sw.ha.fy = sw.hb.fy = 0; swaps++; sfx.blip(swaps);
          if (swaps >= NSW) { ph = 'pick'; sw = null; sfx.tickHi(); } else startSwap();
        }
      } else if (ph === 'reveal') {
        const h = slotOf(chosen); h.lift = Math.min(70, h.lift + 400 * dt);
        if (g.result === 'lose') { const e = slotOf(eggHen); e.lift = Math.min(70, e.lift + 300 * dt); }
      }
    },
    draw(t) {
      field(t, '#FFE08A', '#f7d472');
      // barn wall + straw floor
      ctx.fillStyle = INK; ctx.fillRect(0, 0, W, 232); ctx.fillStyle = BARN; ctx.fillRect(0, 0, W, 228);
      ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < 16; i++) ctx.fillRect(i * 50 + 8, 0, 4, 228);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.strokeRect(300, 20, 200, 190); ctx.beginPath(); ctx.moveTo(300, 20); ctx.lineTo(500, 210); ctx.moveTo(500, 20); ctx.lineTo(300, 210); ctx.stroke();
      ctx.fillStyle = BUTTER; ctx.fillRect(0, 232, W, 368); ctx.fillStyle = 'rgba(20,16,28,.08)'; ctx.fillRect(0, 232, W, 14);
      ctx.strokeStyle = '#E0B840'; ctx.lineWidth = 3; for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.moveTo((i * 97) % 780 + 10, 270 + (i * 53) % 300); ctx.lineTo((i * 97) % 780 + 28, 280 + (i * 53) % 300); ctx.stroke(); }
      // nests (+ egg when revealed)
      const eggShown = ph === 'show' || g.result === 'lose' || (g.result === 'win' && ph === 'reveal');
      for (let i = 0; i < 3; i++) {
        const sx = SX[i]; blob(sx, SY + 6, 88, 28, '#C8913E'); blob(sx, SY + 2, 76, 20, '#E0B060', 0, 0);
        if (ph === 'pick' && cur === i && !TOUCH) { ctx.strokeStyle = YEL; ctx.lineWidth = 6; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.ellipse(sx, SY - 40, 110, 80, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      }
      if (eggShown) { const h = slotOf(eggHen); egg(h.fx, SY - 4, 24); if (ph === 'show') star(h.fx, SY - 4, 40, 22, 8, now * 2, 'rgba(255,225,77,.6)', 0); }
      const order = hens.slice().sort((a, b) => (a.fy + SY) - (b.fy + SY));
      for (const h of order) {
        const rev = ph === 'reveal' && (h.id === chosen || (g.result === 'lose' && h.id === eggHen));
        hen(h.fx, SY + h.fy, 1.05, { lift: h.lift, peck: ph === 'shuffle' || (ph === 'pick' && Math.sin(now * 3 + h.id) > .9), dizzy: g.result === 'lose' && h.id === chosen });
        if (ph === 'pick' && !TOUCH) txt(String(h.slot + 1), SX[h.slot], SY + 54, 26, '#fff');
      }
      if (ph === 'show') txt('WATCH', 400, 270, 38, '#fff');
      else if (ph === 'shuffle') txt('WATCH', 400, 270, 38, '#fff');
      else if (ph === 'pick') { ctx.globalAlpha = .75 + .25 * Math.sin(now * 8); txt('PICK!', 400, 270, 44, YEL); ctx.globalAlpha = 1; }
      dots(NSW, swaps, 400 - (NSW - 1) * 20, 515, 40, '#fff');
      vignette(.2);
    }
  };
  return g;
}
reg('cc_hen', ccHen, 'Chicken Pinch');

})();
