'use strict';
/* Twisted! wave 1 — inspired by WarioWare: Twisted! (tilt the whole console).
   The whole room rotates with the tilt: mouse/pointer X (centre = level, edges = +-35deg) or Left/Right / A/D.
   Games: tw_tilt (marble), tw_spin (balance stack), tw_pour (pitcher), tw_dial (safe dial).
   Art: the DUO look (docs/ART-STYLE.md). Every room is baked once into an offscreen canvas and blitted rotated each frame. */
(function () {

const MAXT = 35 * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerp = (a, b, k) => a + (b - a) * k;
const mood = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;

/* world -> screen (room is rotated by th around the screen centre) */
const w2s = (x, y, th) => ({ x: W / 2 + x * Math.cos(th) - y * Math.sin(th), y: H / 2 + x * Math.sin(th) + y * Math.cos(th) });

/* tilt controller: pointer X, or keys (ramp while held, spring back when released) */
function twCtl(rate) {
  let ang = 0, tgt = 0, mode = 0, px = W / 2;
  return {
    get ang() { return ang; },
    move(p) { px = p.x; if (!(keys.ArrowLeft || keys.ArrowRight || keys.KeyA || keys.KeyD)) mode = 1; },
    update(dt) {
      const l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD;
      if (l || r) { mode = 2; tgt = clamp(tgt + ((r ? 1 : 0) - (l ? 1 : 0)) * 2.2 * dt, -MAXT, MAXT); }
      else if (mode === 2) { tgt += clamp(-tgt, -1.6 * dt, 1.6 * dt); }
      else if (mode === 1) tgt = clamp((px - W / 2) / 320, -1, 1) * MAXT;
      ang += (tgt - ang) * (1 - Math.exp(-rate * dt));
    }
  };
}

/* ───────────── DUO drawing kit (local copy; X can be swapped for an offscreen context while baking) ───────────── */
let X = null;   // set to ctx on each draw (the file is also loaded headless by scripts/party-catalog.js)
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const hh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor randomness: never the game RNG
function rrP(x, y, w, h, r) { const p = new Path2D(); r = Math.min(r, w / 2, h / 2); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; }
function elP(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; }
function polyP(pts) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; }
function rr(x, y, w, h, r) { X.beginPath(); X.roundRect ? X.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)) : X.rect(x, y, w, h); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading: shade fills the shape, the base is drawn again shifted by (-sx,-sy) so the shade stays as a crescent */
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function glint(p, x, y, rx, ry, col, rot = 0) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
function line(x0, y0, x1, y1, col, w) { X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = w + 7; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function spark(x, y, ro, col, rot, o = 2.5) { X.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? ro * .45 : ro, a = rot + i * Math.PI / 5; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); ink(col, o); }
function heart(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
  ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
}
function zee(x, y, s, a) { X.save(); X.globalAlpha = clamp(a, 0, 1); X.translate(x, y); X.scale(s, s); X.strokeStyle = INK; X.lineWidth = 9; X.lineJoin = 'round'; X.beginPath(); X.moveTo(-7, -7); X.lineTo(7, -7); X.lineTo(-7, 7); X.lineTo(7, 7); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 4; X.stroke(); X.restore(); }
function sweat(x, y, T, k) { const u = (T * .9 + k) % 1; X.globalAlpha = 1 - u * u; X.beginPath(); X.moveTo(x, y + u * 16 - 7); X.quadraticCurveTo(x + 5, y + u * 16 + 1, x, y + u * 16 + 5); X.quadraticCurveTo(x - 5, y + u * 16 + 1, x, y + u * 16 - 7); ink('#9fe3ff', 2); X.globalAlpha = 1; }
/* crane.js eye: sclera, pupil looking at the action, highlight, blink, moods */
function eye(x, y, r, md, lx, ly, T, k) {
  X.lineCap = 'round'; X.strokeStyle = INK;
  if (md === 'happy') { X.lineWidth = r * .55; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
  if (md === 'bonk') { X.lineWidth = r * .5; X.beginPath(); X.moveTo(x - r * .7, y - r * .7); X.lineTo(x + r * .7, y + r * .7); X.moveTo(x + r * .7, y - r * .7); X.lineTo(x - r * .7, y + r * .7); X.stroke(); return; }
  if (md === 'sleep') { X.lineWidth = r * .5; X.beginPath(); X.arc(x, y - r * .2, r * .7, Math.PI * .15, Math.PI * .85); X.stroke(); return; }
  const big = md === 'panic' ? 1.3 : 1;
  el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.5, r * .28));
  if (md !== 'panic' && Math.sin(T * 1.9 + k) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
  const pr = md === 'panic' ? r * .32 : r * .52, px = clamp(lx, -1, 1) * r * .38, py = clamp(ly, -1, 1) * r * .38;
  X.fillStyle = INK; el(x + px, y + py, pr, pr * 1.1); X.fill();
  X.fillStyle = '#fff'; el(x + px - pr * .35, y + py - pr * .4, pr * .38, pr * .32); X.fill();
}
function cloud(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
}

/* bake a room once: the painter draws in room coordinates (origin = screen centre) onto an offscreen canvas */
const BW = 1600, BH = 1300, CACHE = {};
function bake(key, fn) {
  if (CACHE[key]) return CACHE[key];
  const c = document.createElement('canvas'); c.width = BW; c.height = BH;
  const k = c.getContext('2d'), old = X; X = k; k.translate(BW / 2, BH / 2);
  try { fn(); } finally { X = old; }
  return CACHE[key] = c;
}
function blit(c) { X.drawImage(c, -BW / 2, -BH / 2); }
function planks(y0, base, dk, step) {                       // wooden floor from y0 to the bottom of the bake
  const g = X.createLinearGradient(0, y0, 0, 650); g.addColorStop(0, base); g.addColorStop(1, dk); X.fillStyle = g; X.fillRect(-800, y0, 1600, 650 - y0);
  X.strokeStyle = 'rgba(20,16,28,.2)'; X.lineWidth = 3; for (let x = -800; x < 800; x += step) { X.beginPath(); X.moveTo(x, y0); X.lineTo(x * 1.9, 650); X.stroke(); }
  X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(-800, y0 + 4, 1600, 8);
  X.fillStyle = INK; X.fillRect(-800, y0 - 2, 1600, 4);     // hard horizon line
}

/* HUD: a spirit level (functional tilt readout) — sits below the top-right counter, never inside it */
function level(th) {
  const x = W + OX - 64, y = 150, bx = x - clamp(th / MAXT, -1, 1) * 28;
  X.save(); rr(x - 46, y - 14, 92, 28, 14); X.shadowColor = 'rgba(20,16,28,.3)'; X.shadowOffsetY = 5; ink('#9fe3ff', 4); X.restore();
  rr(x - 46, y - 14, 92, 28, 14); ink('#d6f7ff', 4);
  X.strokeStyle = INK; X.lineWidth = 2.5; for (const d of [-9, 9]) { X.beginPath(); X.moveTo(x + d, y - 10); X.lineTo(x + d, y + 10); X.stroke(); }
  X.beginPath(); X.arc(bx, y, 9, 0, TAU); ink(Math.abs(th) < .06 ? '#5CFF7A' : '#FFE14D', 2.5);
  X.fillStyle = 'rgba(255,255,255,.7)'; el(bx - 3, y - 3, 3, 2, -.6); X.fill();
  X.fillStyle = 'rgba(255,255,255,.55)'; rr(x - 38, y - 11, 76, 5, 2.5); X.fill();
}
/* HUD: a wooden plate with an icon badge and a bar (balance, spill...). Wordless. */
function gauge(x, y, w, frac, col, icon, T) {
  X.save(); rr(x - w / 2, y - 12, w, 24, 12); X.shadowColor = 'rgba(20,16,28,.3)'; X.shadowOffsetY = 5; ink('#a5622c', 4); X.restore();
  rr(x - w / 2, y - 12, w, 24, 12); ink('#6b3b17', 4);
  X.save(); rr(x - w / 2 + 20, y - 7, w - 28, 14, 7); X.clip(); X.fillStyle = '#3a2a1c'; X.fillRect(x - w / 2, y - 12, w, 24);
  X.fillStyle = col; X.fillRect(x - w / 2 + 20, y - 8, (w - 28) * clamp(frac, 0, 1), 16);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x - w / 2 + 20, y - 7, (w - 28) * clamp(frac, 0, 1), 4); X.restore();
  const bx = x - w / 2 + 2, wob = Math.sin(T * 9) * (frac < .25 ? 1.5 : 0);
  X.beginPath(); X.arc(bx + wob, y, 15, 0, TAU); ink('#fff', 3.5);
  X.save(); X.translate(bx + wob, y); icon(); X.restore();
}

/* ───────────── 1 TILT: roll the marble to the flag, don't fall in a pit ───────────── */
/* a table made of cheese; the pits are holes with mice in them; a cat watches from the window; the clock's pendulum shows true down */
function mouseHead(x, y, md, lk, T, k) {
  const body = elP(x, y, 15, 14);
  for (const s of [-1, 1]) { X.beginPath(); X.arc(x + s * 12, y - 11, 8.5, 0, TAU); ink('#b9b4cc', 3); X.fillStyle = '#ff9fbf'; X.beginPath(); X.arc(x + s * 12, y - 11, 4.5, 0, TAU); X.fill(); }
  cel(body, '#c9c5dc', '#8d88a8', 3, 4, 3.5);
  eye(x - 6, y - 2, 4, md === 'happy' ? 'happy' : md === 'smirk' ? 'happy' : null, lk, 0, T, k); eye(x + 6, y - 2, 4, md === 'happy' ? 'happy' : md === 'smirk' ? 'happy' : null, lk, 0, T, k + 2);
  X.beginPath(); X.arc(x + lk * 2, y + 5, 3.4, 0, TAU); ink('#ff7aa5', 2);
  X.strokeStyle = INK; X.lineWidth = 1.6; X.lineCap = 'round';
  for (const s of [-1, 1]) for (const d of [-3, 3]) { X.beginPath(); X.moveTo(x + s * 9, y + 4 + d * .5); X.lineTo(x + s * 21, y + 4 + d * 2); X.stroke(); }
  if (md === 'happy' || md === 'smirk') { rr(x - 4, y + 8, 8, 6, 2); ink('#fff', 1.8); }
  if (md === 'cheer') {}
}
const TILT_GAPS = {};
reg('tw_tilt', sp => {
  const ctl = twCtl(7);
  const FY = 60, R = 17, HW = 34 + (sp - 1) * 9, PX = [-120, 70], VC = 235 + 35 * (sp - 1), G = 1250 + 250 * (sp - 1);
  let x = -285, vx = 0, y = FY - R, vy = 0, rot = 0, c = 0, mode = 0, rollT = 0, pit = -1, th = 0, crossed = [false, false], flagT = 0, rc = -1, zoneT = 0;
  const g = {
    wide: true, cmd: 'TILT!', hint: 'MOUSE X / ← → : TILT THE ROOM, ROLL TO THE FLAG', thint: 'DRAG LEFT / RIGHT TO TILT', dur: 5,
    move(p) { ctl.move(p); }, down(p) { ctl.move(p); },
    update(dt) {
      c += dt; flagT += dt; ctl.update(dt); th = ctl.ang;
      if (g.result && rc < 0) rc = c;
      if (mode === 0 && !g.result) {
        vx += G * Math.sin(th) * dt; vx *= Math.exp(-.3 * dt); x += vx * dt; rot += vx / R * dt;
        if (x < -300 + R) { if (vx < -80) { sfx.tick(); } x = -300 + R; vx *= -.3; }
        if (x > 300 - R) { x = 300 - R; vx = 0; }
        let hop = 0;
        zoneT = 0;
        PX.forEach((p, i) => {
          const dx = Math.abs(x - p);
          if (dx < HW + R * 2.6 && Math.abs(vx) < VC) zoneT = 1;
          if (dx < HW * .8 && Math.abs(vx) < VC) {
            mode = 1; pit = i; vy = 0; g.result = 'lose'; rc = c;
            sfx.miss(); sfx.thud(); shake(8, .25);
            const s = w2s(x, FY, th); burst(s.x, s.y, '#ff4d4d', 12); ring(s.x, s.y, '#ff4d4d', 70); floatText('OOPS!', s.x, s.y - 70, '#ff4d4d', 40);
          } else if (dx < HW + R * .6) {
            hop = Math.max(hop, 14 * (1 - (dx / (HW + R * .6)) ** 2));
            if (!crossed[i] && Math.abs(vx) >= VC) { crossed[i] = true; sfx.whoosh(true); sfx.boing(); const s = w2s(x, FY, th); floatText('HOP!', s.x, s.y - 50, '#5CFF7A', 28); ring(s.x, s.y, '#fff', 40, .3); }
          }
        });
        y = FY - R - hop;
        rollT -= dt;
        if (rollT <= 0 && Math.abs(vx) > 40) { rollT = .14; noise(.06, Math.min(.03, Math.abs(vx) / 12000), 180, 320, 'lowpass'); }
        if (x >= 268) {
          g.result = 'win'; vx = 0; rc = c; sfx.coin(); sfx.sparkle();
          const s = w2s(268, FY - 60, th); confetti(s.x, s.y, 30); burst(s.x, s.y, '#FFE14D', 14); ring(s.x, s.y, '#fff', 90); floatText('GOAL!', s.x, s.y - 40, '#5CFF7A', 44); shake(6, .2);
        }
      } else if (mode === 1) {
        vy += 2200 * dt; y += vy * dt; vx *= .9;
        const p = PX[pit]; x = clamp(x + (p - x) * .1, p - (HW - R * .6), p + (HW - R * .6));
      }
    },
    draw() {
      if (g.result && rc < 0) rc = c;
      const oT = g.result ? Math.max(0, c - rc) : 0, win = g.result === 'win', lose = g.result === 'lose';
      const BG = bake('tilt' + HW, () => bakeTilt(FY, PX, HW));
      X = ctx; X.save(); X.translate(W / 2, H / 2); X.rotate(th);
      blit(BG);
      // window: drifting cloud + the cat who watches the marble
      X.save(); X.beginPath(); X.rect(-303, -228, 106, 116); X.clip(); cloud(((c * 12 + 60) % 240) - 330, -190, .9); X.restore();
      const cx0 = -248, cy0 = -112, lkx = clamp((x - cx0) / 220, -1, 1), lky = clamp((y - cy0 - 40) / 200, -1, 1);
      const sway = Math.sin(c * 3.2) * 9 + (win ? Math.sin(c * 14) * 5 : 0);
      line(cx0 + 24, cy0 - 14, cx0 + 36 + sway * .5, cy0 + 24, '#d77c2a', 9);
      const cb = elP(cx0, cy0 - 20, 31, 24); cel(cb, '#f5a54a', '#d77c2a', 4, 6, 4);
      const ch = elP(cx0, cy0 - 52, 25, 22); X.save(); X.translate(0, Math.sin(c * 1.8) * 1.2);
      for (const s of [-1, 1]) { X.beginPath(); X.moveTo(cx0 + s * 8, cy0 - 66); X.lineTo(cx0 + s * 25, cy0 - 62); X.lineTo(cx0 + s * 21, cy0 - 84); X.closePath(); ink('#f5a54a', 3.5); X.fillStyle = '#ff9fbf'; X.beginPath(); X.moveTo(cx0 + s * 14, cy0 - 69); X.lineTo(cx0 + s * 21, cy0 - 68); X.lineTo(cx0 + s * 19, cy0 - 79); X.fill(); }
      cel(ch, '#f5a54a', '#d77c2a', 3, 5, 4);
      X.strokeStyle = '#c4631d'; X.lineWidth = 3; X.lineCap = 'round'; for (const d of [-7, 0, 7]) { X.beginPath(); X.moveTo(cx0 + d, cy0 - 72); X.lineTo(cx0 + d, cy0 - 64); X.stroke(); }
      const cm = win ? 'happy' : lose ? 'sleep' : zoneT ? 'panic' : null;
      eye(cx0 - 9, cy0 - 52, 6, cm, lkx, lky, c, 1); eye(cx0 + 9, cy0 - 52, 6, cm, lkx, lky, c, 3);
      X.beginPath(); X.moveTo(cx0 - 3, cy0 - 44); X.lineTo(cx0, cy0 - 41); X.lineTo(cx0 + 3, cy0 - 44); X.closePath(); ink('#ff7aa5', 1.5);
      X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.arc(cx0 - 4, cy0 - 41, 4, 0, 2.6); X.arc(cx0 + 4, cy0 - 41, 4, .5, Math.PI); X.stroke();
      X.lineWidth = 1.6; for (const s of [-1, 1]) for (const d of [-3, 4]) { X.beginPath(); X.moveTo(cx0 + s * 14, cy0 - 44 + d * .3); X.lineTo(cx0 + s * 30, cy0 - 44 + d); X.stroke(); }
      if (lose) { X.fillStyle = '#ff7aa5'; rr(cx0 + 4, cy0 - 38, 8, 8, 4); X.fill(); }
      X.restore();
      if (win) heart(cx0 + 26, cy0 - 84 - ease(oT / .8) * 20, 1 + .1 * Math.sin(c * 8));
      // wall clock + a pendulum that always hangs toward real "down"
      X.beginPath(); X.arc(40, -175, 34, 0, TAU); ink('#fff6e0', 4.5);
      X.strokeStyle = INK; X.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; X.beginPath(); X.moveTo(40 + Math.sin(a) * 26, -175 - Math.cos(a) * 26); X.lineTo(40 + Math.sin(a) * 30, -175 - Math.cos(a) * 30); X.stroke(); }
      X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.moveTo(40, -175); X.lineTo(40 + Math.sin(c * .4) * 20, -175 - Math.cos(c * .4) * 20); X.moveTo(40, -175); X.lineTo(40 + Math.sin(c * .033) * 13, -175 - Math.cos(c * .033) * 13); X.stroke();
      X.save(); X.translate(40, -141); X.rotate(-th + Math.sin(c * 3) * .12); line(0, 0, 0, 40, '#a5622c', 4); X.beginPath(); X.arc(0, 46, 11, 0, TAU); ink('#FFE14D', 3.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(-3, 43, 3.5, 2.5, -.6); X.fill(); X.restore();
      // the pits: a mouse lives in each one
      PX.forEach((p, i) => {
        X.save(); X.beginPath(); X.rect(p - HW + 3, FY - 44, 2 * HW - 6, 84); X.clip();
        if (mode === 1 && pit === i && y > 80) {
          X.globalAlpha = clamp(1 - (y - 120) / 70, 0, 1); drawMarble(); X.globalAlpha = 1;
        }
        const mine = lose && pit === i, rise = win ? ease(oT / .35) * 1.1 : mine ? ease((oT - .1) / .3) * 1.3 : .4 + .08 * Math.sin(c * 2.2 + i * 2);
        const mx = p + (win || mine ? 0 : clamp((x - p) / 160, -1, 1) * 5), my = FY + 46 - 36 * rise + (win ? -Math.abs(Math.sin(oT * 11 + i)) * 6 : 0);
        mouseHead(mx, my, win ? 'happy' : mine ? 'smirk' : null, clamp((x - p) / 120, -1, 1), c, i * 3);
        if (win) { for (const s of [-1, 1]) { X.beginPath(); X.arc(mx + s * 22, my - 10 - Math.sin(oT * 14 + s) * 4, 5, 0, TAU); ink('#ff9fbf', 2.5); } }
        X.restore();
      });
      // goal: toothpick flag on the cheese
      line(271, FY - 80, 271, FY, '#f2d79a', 5);
      X.beginPath(); for (let i = 0; i <= 8; i++) X.lineTo(274 + i * 4.5, FY - 78 + Math.sin(flagT * (win ? 16 : 8) + i * .7) * 3); for (let i = 8; i >= 0; i--) X.lineTo(274 + i * 4.5, FY - 50 + Math.sin(flagT * (win ? 16 : 8) + i * .7) * 3);
      X.closePath(); ink('#5CFF7A', 3.5); spark(284, FY - 64, 6, '#fff', flagT * 2, 1.8);
      if (mode === 0) { X.fillStyle = 'rgba(20,16,28,.28)'; el(x, FY + 2, 17, 5); X.fill(); drawMarble(); }
      if (win) { for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + oT * 4, rd = 30 + oT * 70; spark(268 + Math.cos(a) * rd * .9, FY - 40 + Math.sin(a) * rd * .7, 7, i % 2 ? '#FFE14D' : '#fff', a, 2); } heart(x - 6, y - 52 - ease(oT) * 24, 1.2); }
      if (lose) { for (let i = 0; i < 4; i++) { const u = clamp((oT - .12) / .6, 0, 1); X.fillStyle = '#e9a328'; el(PX[pit] + (hh(i) - .5) * 70 * u, FY - 14 - Math.sin(u * Math.PI) * 40 * (.5 + hh(i + 9)), 4, 3); X.fill(); } }
      // payoff above the stamp band: the pit mice leap high and big (win: both cheer; lose: the one who ate the marble gloats)
      if (win || lose) PX.forEach((p, i) => {
        if (lose && pit !== i) return;
        const u = ease((oT - .05) / .3), sc = win ? 1.5 : 2, bob = Math.sin(oT * (win ? 12 : 7) + i * 2) * (win ? 7 : 3);
        if (u <= 0) return;
        const mx = p + (win ? (i ? 30 : -30) * u : 0), my = FY - 24 - 190 * u + bob;
        X.save(); X.translate(mx, my); X.scale(sc, sc); X.rotate(-th * .5); mouseHead(0, 0, win ? 'happy' : 'smirk', 0, c, i * 3);
        X.restore();
        if (win) { for (const s of [-1, 1]) { X.beginPath(); X.arc(mx + s * 40, my - 18 - Math.sin(oT * 14 + s) * 8, 6, 0, TAU); ink('#ff9fbf', 2.5); } heart(mx, my - 52 - ease(oT / .6) * 12, 1 + .1 * Math.sin(c * 8)); }
        else { const cu = clamp((oT - .2) / .5, 0, 1); for (let k = 0; k < 6; k++) { X.fillStyle = '#e9a328'; el(mx + (hh(k + 20) - .5) * 110 * cu, my + 30 + cu * 40 * hh(k + 30) + k * 4, 5, 4); X.fill(); } }
      });
      X.restore();
      level(th); vignette(.18);

      function drawMarble() {
        const cx = x, cy = y, sad = lose, hap = win, md = sad ? 'bonk' : hap ? 'happy' : zoneT ? 'panic' : null;
        const body = elP(cx, cy, R, R); cel(body, OR, '#b4553a', 3, 5, 3.5);
        X.save(); X.clip(body); X.translate(cx, cy); X.rotate(rot); X.fillStyle = '#f3a283'; for (let i = 0; i < 3; i++) { const a = i * 2.1; el(Math.cos(a) * R * .72, Math.sin(a) * R * .72, 3, 3); X.fill(); } X.restore();
        X.fillStyle = 'rgba(255,255,255,.5)'; el(cx - 7, cy - 9, 4.5, 2.6, -.6); X.fill();
        const lk = clamp(vx / 220, -1, 1);
        eye(cx - 5.5, cy - 2, 4.4, md, lk, .2, c, 1); eye(cx + 5.5, cy - 2, 4.4, md, lk, .2, c, 4);
        X.strokeStyle = INK; X.lineWidth = 2.4; X.lineCap = 'round'; X.beginPath();
        if (hap) X.arc(cx, cy + 3, 4.5, .1, Math.PI - .1); else if (sad) X.arc(cx, cy + 9, 4, Math.PI + .3, -.3); else if (zoneT) X.arc(cx, cy + 7, 2.6, 0, TAU); else X.arc(cx, cy + 4, 3, .3, Math.PI - .3); X.stroke();
        if (zoneT && !g.result) sweat(cx + 13, cy - 12, c, 0);
        if (c < 1.2 && mode === 0) { const a = clamp(1.2 - c, 0, 1); X.globalAlpha = a; X.beginPath(); X.moveTo(cx - 8, cy - 33); X.lineTo(cx, cy - 23); X.lineTo(cx + 8, cy - 33); X.closePath(); ink('#FFE14D', 3); spark(cx, cy - 40 + Math.sin(c * 6) * 2, 8, '#FFE14D', c * 2, 2.5); X.globalAlpha = 1; }
      }
    }
  };
  return g;
}, 'Tilt');
function bakeTilt(FY, PX, HW) {
  // wallpaper + wainscot
  let g = X.createLinearGradient(0, -650, 0, 235); g.addColorStop(0, '#ffcf8a'); g.addColorStop(1, '#fff0c8'); X.fillStyle = g; X.fillRect(-800, -650, 1600, 885);
  X.fillStyle = 'rgba(217,119,87,.14)'; for (let x = -800; x < 800; x += 80) X.fillRect(x, -650, 38, 885);
  X.fillStyle = 'rgba(255,120,150,.35)'; for (let y = -600; y < 160; y += 70) for (let x = -780; x < 800; x += 80) { X.beginPath(); X.arc(x + 19 + (y % 140 ? 40 : 0), y, 4, 0, TAU); X.fill(); }
  X.fillStyle = '#e3ac66'; X.fillRect(-800, 175, 1600, 60); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-800, 175, 1600, 6); X.fillStyle = INK; X.fillRect(-800, 172, 1600, 4);
  planks(235, '#c98443', '#8a5530', 130);
  // mouse hole in the baseboard
  X.beginPath(); X.moveTo(-60, 232); X.lineTo(-60, 206); X.arc(-40, 206, 20, Math.PI, 0); X.lineTo(-20, 232); X.closePath(); ink('#2a1c30', 4);
  // window
  rr(-305, -230, 110, 120, 6); ink('#e3a868', 5);
  rr(-299, -224, 98, 108, 3); X.save(); X.clip(); g = X.createLinearGradient(0, -224, 0, -116); g.addColorStop(0, '#6fd0ff'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(-300, -225, 100, 110);
  X.beginPath(); X.moveTo(-300, -130); X.quadraticCurveTo(-270, -160, -240, -135); X.quadraticCurveTo(-220, -150, -200, -130); X.lineTo(-200, -112); X.lineTo(-300, -112); X.closePath(); X.fillStyle = '#87d19b'; X.fill();
  X.fillStyle = '#ffe14d'; X.beginPath(); X.arc(-222, -202, 11, 0, TAU); X.fill(); X.restore();
  rr(-312, -112, 124, 14, 4); ink('#d9944f', 4);
  // table: wooden legs + a shadow, a slab of cheese on top
  X.fillStyle = 'rgba(20,16,28,.28)'; el(0, 240, 330, 17); X.fill();
  for (const lx of [-285, 255]) { const p = rrP(lx, 100, 30, 136, 4); cel(p, '#d9944f', '#a5622c', 8, 0, 4); }
  X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(-278, 106, 5, 120); X.fillRect(262, 106, 5, 120);
  const segs = [[-300, PX[0] - HW], [PX[0] + HW, PX[1] - HW], [PX[1] + HW, 300]];
  for (const p of PX) { X.fillStyle = INK; X.fillRect(p - HW - 4, FY - 2, 2 * HW + 8, 46); X.fillStyle = '#2a1c30'; X.fillRect(p - HW, FY, 2 * HW, 44); }
  for (const s of segs) {
    const p = rrP(s[0], FY, s[1] - s[0], 40, 8); cel(p, '#ffd34e', '#e9a328', 4, 9, 4);
    glint(p, s[0] + (s[1] - s[0]) * .35, FY + 6, (s[1] - s[0]) * .3, 3.5, 'rgba(255,255,255,.5)');
    X.save(); X.clip(p); X.fillStyle = '#e9a328'; for (let i = 0; i < 4; i++) { const hx = s[0] + 22 + hh(s[0] + i) * (s[1] - s[0] - 44), hy = FY + 22 + hh(i + 3) * 10; el(hx, hy, 5 + hh(i) * 3, 4 + hh(i + 5) * 2); X.fill(); X.fillStyle = '#c98418'; el(hx + 1, hy + 2, 3, 2); X.fill(); X.fillStyle = '#e9a328'; } X.restore();
  }
  // hazard cones at both lips of every pit
  for (const p of PX) for (const sx of [p - HW - 12, p + HW + 2]) { const q = rrP(sx, FY - 14, 10, 14, 3); cel(q, '#ff9a2e', '#d9701a', 2, 3, 2.5); X.save(); X.clip(q); X.fillStyle = '#fff'; X.fillRect(sx, FY - 9, 10, 3); X.restore(); }
  // rind end stops
  for (const ex of [-312, 300]) { const q = rrP(ex, FY - 34, 12, 74, 5); cel(q, '#ff9a2e', '#d9701a', 3, 0, 4); }
  X.fillStyle = 'rgba(92,255,122,.5)'; X.fillRect(252, FY - 3, 34, 4);
}

/* ───────────── 2 SPIN: keep the stack balanced by rotating against its lean ───────────── */
/* a circus ring: plates on a drum, Caos on top with a parasol, a crowd that reacts */
function crowdHead(x, y, s, i, md, lx, T) {
  const skin = ['#f2c29b', '#c98558', '#8a5a3a', '#f7d3b2', '#b9714d', '#e0a47c'][i % 6], shirt = ['#4DB8FF', '#FF8FC8', '#5CFF7A', '#FFE14D', '#a48fdc', '#ff6b6b'][(i * 5 + 2) % 6];
  X.save(); X.translate(x, y); X.scale(s, s);
  const bob = md === 'happy' ? -Math.abs(Math.sin(T * 9 + i)) * 8 : Math.sin(T * 2 + i) * 1.2; X.translate(0, bob);
  X.beginPath(); X.moveTo(-24, 34); X.quadraticCurveTo(-24, 12, 0, 12); X.quadraticCurveTo(24, 12, 24, 34); X.lineTo(24, 40); X.lineTo(-24, 40); X.closePath(); ink(shirt, 4);
  if (md === 'happy') for (const sd of [-1, 1]) { line(sd * 20, 24, sd * 30, -14 - Math.sin(T * 12 + sd + i) * 4, skin, 8); }
  if (i % 6 === 1) { X.beginPath(); X.arc(0, -8, 28, 0, TAU); ink('#2a2230', 4); }
  if (i % 6 === 3) { X.beginPath(); X.moveTo(-12, -14); X.lineTo(0, -52); X.lineTo(12, -14); X.closePath(); ink('#FF8FC8', 3.5); }
  const head = elP(0, 0, 20, 21); cel(head, skin, mix2(skin), 3, 5, 4);
  if (i % 6 === 0) { X.beginPath(); X.arc(0, -17, 15, Math.PI, 0); ink('#4DB8FF', 3.5); X.save(); X.translate(0, -34); X.rotate(T * 14); line(-12, 0, 12, 0, '#FFE14D', 4); X.restore(); line(0, -32, 0, -20, INK, 1); }
  if (i % 6 === 2) { rr(-17, -34, 34, 22, 3); ink('#2a2230', 3.5); rr(-24, -15, 48, 6, 3); ink('#2a2230', 3.5); X.fillStyle = '#ff4d5e'; X.fillRect(-17, -21, 34, 4); }
  if (i % 6 === 5) { X.beginPath(); X.arc(0, -13, 19, Math.PI * 1.02, Math.PI * 1.98); ink('#ff4d5e', 3.5); rr(-6, -17, 26, 5, 2.5); ink('#ff4d5e', 3); }
  X.fillStyle = 'rgba(255,110,140,.45)'; el(-12, 7, 5, 3); X.fill(); el(12, 7, 5, 3); X.fill();
  if (i % 6 === 4) { rr(-16, -9, 14, 10, 4); ink('#14101c', 2.5); rr(2, -9, 14, 10, 4); ink('#14101c', 2.5); }
  else { eye(-8, -3, 5.4, md === 'happy' ? 'happy' : md === 'panic' || md === 'sad' ? 'panic' : null, lx, .2, T, i); eye(8, -3, 5.4, md === 'happy' ? 'happy' : md === 'panic' || md === 'sad' ? 'panic' : null, lx, .2, T, i + 1.3); }
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath();
  if (md === 'happy') { X.arc(0, 8, 7, .1, Math.PI - .1); } else if (md === 'panic' || md === 'sad') { X.ellipse(0, 12, 4, 5.5, 0, 0, TAU); } else X.arc(0, 12, 5, .3, Math.PI - .3);
  X.stroke();
  if (md === 'sad') for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 11, -2, 11, 0, TAU); ink(skin, 3); eye(sd * 8, -3, 5.4, 'panic', 0, 0, T, i); }
  X.restore();
}
function mix2(h) { const n = parseInt(h.slice(1), 16), f = .78; return '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(v * f).toString(16).padStart(2, '0')).join(''); }
reg('tw_spin', sp => {
  const ctl = twCtl(9);
  const D = 4.5 / Math.sqrt(sp), K = 6.5 + 2 * (sp - 1), FLOOR = 215, PY = 95;
  let r = (Math.random() < .5 ? -1 : 1) * .12, rv = 0, c = 0, th = 0, gust = .6 + Math.random() * .3, creak = 0, fallen = false, spinT = 0, rc = -1;
  const cols = ['#FFF6E0', OR, '#4DB8FF', '#FF8FC8', '#FFE14D'];
  const plates = cols.map((col, i) => ({ col, i, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0 }));
  let cl = null, dr = null;     // dr: drawn lean override (win pose settles upright; update never reads it)
  const lean = () => (dr == null ? r : dr) + th;     // absolute lean as seen on screen
  const plateLocal = (i) => ({ x: Math.sin(c * 3 + i) * 1.5 + (dr == null ? r : dr) * i * 6, y: -(i * 24 + 12), w: 118 - i * 8 });
  const g = {
    wide: true, cmd: 'SPIN!', hint: 'MOUSE X / ← → : ROTATE AGAINST ITS LEAN', thint: 'DRAG LEFT / RIGHT TO COUNTER THE LEAN', dur: 4.5, timeWin: true,
    move(p) { ctl.move(p); }, down(p) { ctl.move(p); },
    update(dt) {
      c += dt; spinT += dt; ctl.update(dt);
      if (g.result && rc < 0) rc = c;
      th = ctl.ang;
      if (!fallen) {
        const a = r + th;
        rv += (K * Math.sin(a) - 3 * r + Math.sin(c * 2.3 + 1) * .8) * dt;
        gust -= dt;
        if (gust <= 0) { gust = .7 + Math.random() * .6; rv += (Math.random() < .5 ? -1 : 1) * (1.1 + .4 * sp); sfx.whoosh(Math.random() < .5); }
        rv *= Math.exp(-2.5 * dt); r += rv * dt;
        creak -= dt;
        if (Math.abs(a) > .28 && creak <= 0) { creak = .14; sfx.blip(Math.round(Math.abs(a) * 14)); }
        if (Math.abs(a) > .58 && !g.result) {
          fallen = true; g.result = 'lose'; rc = c;
          const cs = Math.cos(r), sn = Math.sin(r);
          const dir = a > 0 ? 1 : -1;
          plates.forEach((p, i) => {
            const l = plateLocal(i);
            p.x = l.x * cs + l.y * sn; p.y = PY - l.x * sn + l.y * cs; p.a = r;
            p.vx = dir * (90 + i * 45); p.vy = -140 - i * 30; p.va = dir * (2 + i * 1.3);
          });
          const tp = plateLocal(plates.length - 1), ty = tp.y - 24;
          cl = { x: tp.x * cs + ty * sn, y: PY - tp.x * sn + ty * cs, a: r, vx: dir * 130, vy: -230, va: dir * 3.2, landed: 0 };
          sfx.miss(); sfx.thud(); sfx.splat(); shake(10, .35);
          const s = w2s(0, FLOOR - 40, th); burst(s.x, s.y, '#FFE14D', 18); ring(s.x, s.y, '#ff4d4d', 100); floatText('CRASH!', s.x, s.y - 120, '#ff4d4d', 48);
        }
      } else {
        const gx = Math.sin(th) * 1800, gy = Math.cos(th) * 1800;
        for (const p of plates) { p.vx += gx * dt; p.vy += gy * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; if (p.y > FLOOR - 10 && p.vy > 0) { p.y = FLOOR - 10; p.vy *= -.35; p.vx *= .7; p.va *= .6; } }
        if (cl) {
          cl.vx += gx * dt; cl.vy += gy * dt; cl.x += cl.vx * dt; cl.y += cl.vy * dt; cl.a += cl.va * dt;
          if (cl.y > FLOOR && cl.vy > 0) { cl.y = FLOOR; cl.vy *= -.3; cl.vx *= .5; cl.va *= .4; cl.landed++; }
          if (cl.landed) { cl.a += (0 - cl.a) * (1 - Math.exp(-6 * dt)); cl.vx *= .92; }
        }
      }
    },
    draw() {
      if (g.result && rc < 0) rc = c;
      const oT = g.result ? Math.max(0, c - rc) : 0, win = g.result === 'win', lose = g.result === 'lose';
      dr = win ? r * (1 - ease(oT / .3)) : null;
      const a0 = lean(), warn = clamp(Math.abs(a0) / .58, 0, 1);
      const BG = bake('spin', () => bakeSpin(FLOOR));
      X = ctx; X.save(); X.translate(W / 2, H / 2); X.rotate(th);
      blit(BG);
      // sweeping spotlights from the tent roof
      X.save(); X.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) { const sw = Math.sin(c * 1.3 + s) * 40, tx = (fallen && cl ? cl.x : 0) + sw; X.fillStyle = 'rgba(255,240,170,.1)'; X.beginPath(); X.moveTo(s * 380 - 12, -330); X.lineTo(s * 380 + 12, -330); X.lineTo(tx + 70, PY); X.lineTo(tx - 70, PY); X.closePath(); X.fill(); }
      X.restore();
      // the crowd
      const cm = win ? 'happy' : lose ? 'sad' : warn > .45 ? 'panic' : null, lookX = clamp(Math.sin(r) * 2, -1, 1);
      const spots = [[-345, 30, .85, 0], [-255, 28, .85, 1], [-175, 30, .85, 2], [175, 30, .85, 3], [255, 28, .85, 4], [345, 30, .85, 5], [-300, 78, 1, 6], [-215, 80, 1, 7], [-135, 76, 1, 8], [135, 76, 1, 9], [215, 80, 1, 10], [300, 78, 1, 11]];
      for (const [hx, hy, hs, hi] of spots) crowdHead(hx, hy, hs, hi, cm, (hx < 0 ? 1 : -1) * .6 + lookX * .4, c);
      shadow(0, FLOOR + 6, 130, 18, .3);
      // the drum: red with gold hoops and a stripe that scrolls
      const dp = rrP(-70, PY, 140, FLOOR - PY, 10); cel(dp, '#ee4b5e', '#b8283a', 12, 0, 5);
      X.save(); X.clip(dp); X.fillStyle = 'rgba(255,255,255,.34)'; for (let i = -2; i < 8; i++) { const yy = PY + ((i * 30 + spinT * 60) % 210); X.fillRect(-70, yy, 140, 10); }
      X.fillStyle = '#ffd23f'; X.fillRect(-70, PY + 22, 140, 8); X.fillRect(-70, FLOOR - 30, 140, 8); X.strokeStyle = INK; X.lineWidth = 2; X.strokeRect(-70, PY + 22, 140, 8); X.strokeRect(-70, FLOOR - 30, 140, 8); X.restore();
      el(0, PY, 90, 16); ink('#ffd23f', 4); X.fillStyle = 'rgba(255,255,255,.5)'; el(-30, PY - 5, 30, 4, -.1); X.fill();
      for (let i = 0; i < 6; i++) { const a = spinT * 3 + i * Math.PI / 3; X.beginPath(); X.arc(Math.cos(a) * 65, PY + Math.sin(a) * 9, 4, 0, TAU); ink(i % 2 ? '#fff' : '#ff4d5e', 1.8); }
      // stack of plates (+ Caos with a parasol)
      const plateDraw = (w, col) => { const q = rrP(-w / 2, -11, w, 22, 11); cel(q, col, mix2(col), 3, 5, 4); glint(q, -w * .2, -6, w * .22, 2.5, 'rgba(255,255,255,.6)'); };
      if (!fallen) {
        X.save(); X.translate(0, PY); X.rotate(dr == null ? r : dr);
        for (let i = 0; i < plates.length; i++) { const l = plateLocal(i); X.save(); X.translate(l.x, l.y); plateDraw(l.w, plates[i].col); X.restore(); }
        const top = plateLocal(plates.length - 1), md = win ? 'happy' : Math.abs(a0) > .3 ? 'sad' : null;
        const hop = win ? -Math.abs(Math.sin(oT * 9)) * 16 : 0;
        X.save(); X.translate(top.x, top.y - 22 + hop);
        // parasol (counter-lean) held in the right hand
        X.save(); X.translate(30, -20); X.rotate(-a0 * .5 + (win ? Math.sin(oT * 10) * .2 : 0)); line(0, 0, 0, -50, '#fff6e0', 4);
        X.beginPath(); X.moveTo(-34, -50); X.quadraticCurveTo(0, -92, 34, -50); X.quadraticCurveTo(17, -57, 0, -50); X.quadraticCurveTo(-17, -57, -34, -50); ink('#ff4d5e', 3.5);
        X.fillStyle = '#fff'; X.beginPath(); X.moveTo(-12, -52); X.quadraticCurveTo(0, -80, 12, -52); X.quadraticCurveTo(6, -57, 0, -52); X.quadraticCurveTo(-6, -57, -12, -52); X.fill(); X.restore();
        X.restore();
        caos(top.x, top.y - 24 + hop, 4.4, { mood: md });
        if (win) for (const s of [-1, 1]) line(top.x + s * 22, top.y - 42 + hop, top.x + s * 34, top.y - 66 + hop - Math.sin(oT * 12 + s) * 4, OR, 5);
        else for (const s of [-1, 1]) line(top.x + s * 22, top.y - 38, top.x + s * 40, top.y - 38 - Math.abs(Math.sin(r * 2)) * 3 + (s * a0 > 0 ? 8 : -2), OR, 5);
        if (Math.abs(a0) > .3) sweat(top.x + 14, top.y - 66, c, 0);
        X.restore();
      } else {
        for (const p of plates) { X.save(); X.translate(p.x, p.y); X.rotate(p.a); plateDraw(118 - p.i * 8, p.col); X.restore(); }
        if (cl) {
          X.save(); X.translate(cl.x, cl.y); X.rotate(cl.a); caos(0, 0, 4.4, { mood: 'sad' }); X.restore();
          if (cl.landed) for (let i = 0; i < 3; i++) { const a = c * 5 + i * TAU / 3; spark(cl.x + Math.cos(a) * 24, cl.y - 56 + Math.sin(a) * 6, 7, '#FFE14D', a, 2); }
        }
        if (oT < .8) { X.globalAlpha = clamp(1 - oT / .8, 0, 1); for (let i = 0; i < 5; i++) { const u = oT; X.fillStyle = '#f7d297'; X.beginPath(); X.arc((i - 2) * 46 * (1 + u * 1.4), FLOOR - 6 - u * 24 - (i % 2) * 8, 16 + u * 22, 0, TAU); X.fill(); } X.globalAlpha = 1; }
      }
      if (win) for (let i = 0; i < 22; i++) { const u = clamp(oT * .9 - hh(i) * .3, 0, 2), fx = (hh(i + 40) - .5) * 700, fy = -300 + u * 520 + hh(i + 7) * 40; if (u > 0 && fy < FLOOR) { X.fillStyle = ['#ff4d5e', '#FFE14D', '#4DB8FF', '#5CFF7A', '#FF8FC8'][i % 5]; X.save(); X.translate(fx + Math.sin(oT * 6 + i) * 12, fy); X.rotate(oT * 8 + i); X.fillRect(-5, -2, 10, 4); X.restore(); } }
      X.restore();
      // absolute vertical reference (screen space)
      X.save(); X.setLineDash([10, 10]); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 4;
      const piv = w2s(0, PY, th); X.beginPath(); X.moveTo(piv.x, piv.y); X.lineTo(piv.x, piv.y - 260); X.stroke(); X.restore();
      // HUD: balance + time as wooden plates under the hint
      const icBal = () => { for (let i = 0; i < 3; i++) { rr(-8 + i, -8 + i * 5, 16 - i * 2, 5, 2.5); ink(['#ff8fc8', '#4DB8FF', '#ffe14d'][i], 1.4); } };
      const icClock = () => { X.strokeStyle = INK; X.lineWidth = 2.4; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -8); X.moveTo(0, 0); X.lineTo(6, 3); X.stroke(); };
      gauge(400, 70, 250, 1 - warn, warn > .6 ? '#ff4d5e' : '#5CFF7A', icBal, c);
      gauge(400, 100, 250, c / D, '#4DB8FF', icClock, c);
      level(th); vignette(.18 + warn * .15);
    }
  };
  return g;
}, 'Spin');
function bakeSpin(FLOOR) {
  // tent wall: red and cream stripes, darker toward the floor
  for (let i = -12; i < 12; i++) { X.fillStyle = i % 2 ? '#ff6b6b' : '#ffe9c9'; X.fillRect(i * 70, -650, 70, 880); }
  let g = X.createLinearGradient(0, -650, 0, FLOOR); g.addColorStop(0, 'rgba(60,20,90,.45)'); g.addColorStop(.55, 'rgba(60,20,90,0)'); g.addColorStop(1, 'rgba(60,20,90,.18)'); X.fillStyle = g; X.fillRect(-800, -650, 1600, 880);
  // bleachers: three wooden steps behind the ring
  for (let k = 0; k < 3; k++) { const y = 20 + k * 42; X.beginPath(); X.rect(-800, y, 1600, 44); ink(k % 2 ? '#c98443' : '#d9944f', 0); X.fillStyle = INK; X.fillRect(-800, y, 1600, 4); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(-800, y + 4, 1600, 6); }
  X.fillStyle = '#8a5530'; X.fillRect(-800, 148, 1600, 70);
  // bunting
  X.beginPath(); X.moveTo(-560, -250); X.quadraticCurveTo(0, -180, 560, -250); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
  for (let i = 0; i < 17; i++) { const u = (i + .5) / 17, bx = -560 + u * 1120, by = -250 + 4 * u * (1 - u) * 70 * (-1) * -1 + 0; const yy = -250 + (1 - Math.pow(2 * u - 1, 2)) * 17; X.beginPath(); X.moveTo(bx - 14, yy + 5); X.lineTo(bx + 14, yy + 5); X.lineTo(bx, yy + 38); X.closePath(); ink(['#FFE14D', '#4DB8FF', '#5CFF7A', '#FF8FC8'][i % 4], 3); }
  // the curtain edges + tassels
  for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 800, -650); X.lineTo(s * 392, -650); X.quadraticCurveTo(s * 430, -250, s * 372, 230); X.lineTo(s * 800, 230); X.closePath(); X.save(); X.clip(); X.fillStyle = '#b8283a'; X.fillRect(-800, -650, 1600, 900); X.fillStyle = '#8f1d2e'; for (let i = 0; i < 8; i++) X.fillRect(s * (410 + i * 46), -650, 22, 900); X.restore(); X.beginPath(); X.moveTo(s * 800, -650); X.lineTo(s * 392, -650); X.quadraticCurveTo(s * 430, -250, s * 372, 230); ink(null, 4); X.beginPath(); X.arc(s * 386, -60, 9, 0, TAU); ink('#ffd23f', 3); }
  // sawdust ring with a striped curb
  const fg = X.createLinearGradient(0, FLOOR, 0, 650); fg.addColorStop(0, '#f6cf88'); fg.addColorStop(1, '#d99f55'); X.fillStyle = fg; X.fillRect(-800, FLOOR, 1600, 650 - FLOOR);
  X.fillStyle = 'rgba(160,100,40,.35)'; for (let i = 0; i < 40; i++) { X.fillRect(-780 + hh(i) * 1560, FLOOR + 14 + hh(i + 50) * 400, 8, 3); }
  for (let x = -800; x < 800; x += 56) { X.fillStyle = (x / 56) % 2 ? '#fff' : '#ff4d5e'; X.fillRect(x, FLOOR - 16, 56, 16); }
  X.fillStyle = INK; X.fillRect(-800, FLOOR - 18, 1600, 4); X.fillRect(-800, FLOOR - 2, 1600, 4);
}

/* ───────────── 3 POUR: tilt the pitcher to fill the glass to the line ───────────── */
/* a lemonade stand in the desert, and a very thirsty camel */
function bakePour(TABLE, GX, GWT, GWB, GTOP) {
  let g = X.createLinearGradient(0, -650, 0, 120); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(-800, -650, 1600, 900);
  // dunes (coloured outline, far to near)
  X.lineJoin = 'round';
  for (const [col, ol, y0, amp, ph] of [['#f6dc9a', '#d9b068', 70, 40, 0], ['#f0c978', '#c99a4e', 128, 30, 2]]) {
    X.beginPath(); X.moveTo(-800, 260); for (let x = -800; x <= 800; x += 40) X.lineTo(x, y0 + Math.sin(x * .006 + ph) * amp + Math.sin(x * .017 + ph) * amp * .3); X.lineTo(800, 260); X.closePath(); X.fillStyle = col; X.fill(); X.lineWidth = 4; X.strokeStyle = ol; X.stroke();
  }
  // distant cactus
  const cac = (cx, cy, s) => { X.save(); X.translate(cx, cy); X.scale(s, s); for (const [ax, ay, aw, ah] of [[-30, -52, 14, 34], [16, -70, 14, 40]]) { rr(ax, ay, aw, ah, 7); ink('#3fb260', 3.5); } rr(-30, -26, 52, 12, 6); ink('#3fb260', 3.5); const b = rrP(-16, -110, 32, 110, 16); cel(b, '#3fb260', '#2b8a45', 7, 0, 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-9, -98, 4, 60); X.strokeStyle = INK; X.lineWidth = 2; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(5, -90 + i * 22); X.lineTo(10, -94 + i * 22); X.stroke(); } X.restore(); };
  cac(-345, 236, 1.1); cac(-60, 142, .55);
  // sand
  g = X.createLinearGradient(0, TABLE + 60, 0, 650); g.addColorStop(0, '#f6dc9a'); g.addColorStop(1, '#e0b86a'); X.fillStyle = g; X.fillRect(-800, TABLE + 60, 1600, 650 - TABLE - 60);
  X.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 6; i++) X.fillRect(-800 + i * 280, TABLE + 70, 150, 8);
  X.fillStyle = INK; X.fillRect(-800, TABLE + 58, 1600, 4);
  // the stand: a counter in front, red/white check cloth on top, a lemon on the plank front
  X.fillStyle = 'rgba(20,16,28,.28)'; el(0, TABLE + 68, 330, 14); X.fill();
  const front = rrP(-292, TABLE + 24, 584, 40, 5); cel(front, '#d9944f', '#a5622c', 0, 8, 4);
  X.save(); X.clip(front); X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 3; for (let x = -240; x < 292; x += 96) { X.beginPath(); X.moveTo(x, TABLE + 20); X.lineTo(x, TABLE + 70); X.stroke(); } X.restore();
  const lem = (lx, ly, s) => { X.save(); X.translate(lx, ly); X.scale(s, s); X.beginPath(); X.ellipse(0, 0, 18, 13, -.3, 0, TAU); ink('#ffe14d', 3.5); X.fillStyle = '#fff3a0'; el(-5, -4, 7, 3, -.5); X.fill(); X.beginPath(); X.ellipse(10, -12, 9, 4, .6, 0, TAU); ink('#5cbc5e', 2.5); X.restore(); };
  lem(-160, TABLE + 47, 1); lem(160, TABLE + 47, 1);
  const top = rrP(-300, TABLE, 600, 24, 5); inkP(top, '#fff', 4); X.save(); X.clip(top); X.fillStyle = '#ff5b6b'; for (let i = -10; i < 14; i++) if (i % 2 === 0) X.fillRect(i * 28, TABLE, 28, 24); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-300, TABLE, 600, 5); X.fillStyle = 'rgba(20,16,28,.2)'; X.fillRect(-300, TABLE + 18, 600, 6); X.restore();
}
function camel(T, md, lx, ly, pouring) {
  const HX = 190, HY = 22, bob = Math.sin(T * 2.4) * 2;
  // body + hump behind the counter, then the neck
  const hump = elP(318, 118, 30, 34); cel(hump, '#d9a066', '#b57a3c', 6, 4, 4.5);
  const cb = elP(300, 176, 82, 56); cel(cb, '#d9a066', '#b57a3c', 10, 8, 4.5);
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 62; X.beginPath(); X.moveTo(262, 170); X.quadraticCurveTo(262, 90, HX + 16, HY + 24 + bob); X.stroke();
  X.strokeStyle = '#d9a066'; X.lineWidth = 54; X.stroke(); X.strokeStyle = '#b57a3c'; X.lineWidth = 16; X.beginPath(); X.moveTo(284, 170); X.quadraticCurveTo(286, 96, HX + 34, HY + 30 + bob); X.stroke();
  X.save(); X.translate(0, bob);
  for (const s of [-1, 1]) { X.beginPath(); X.ellipse(HX + s * 30, HY - 26, 8, 14, s * .5, 0, TAU); ink('#d9a066', 3.5); }
  const head = elP(HX, HY, 38, 32); cel(head, '#d9a066', '#b57a3c', 4, 6, 4.5);
  const mz = elP(HX - 4, HY + 18, 27, 18); cel(mz, '#f3cd9a', '#d7a874', 2, 5, 3.5);
  X.fillStyle = 'rgba(255,255,255,.4)'; el(HX - 16, HY - 14, 11, 5, -.5); X.fill();
  for (const s of [-1, 1]) { X.fillStyle = INK; el(HX - 4 + s * 9, HY + 12, 3.2, 4); X.fill(); }
  const m = md;
  for (const s of [-1, 1]) {
    eye(HX + s * 17, HY - 8, 10, m === 'happy' ? 'happy' : m === 'pour' ? 'panic' : null, lx, ly, T, s + 2);
    X.strokeStyle = INK; X.lineWidth = 2.2; X.lineCap = 'round'; for (const d of [-1, 0, 1]) { X.beginPath(); X.moveTo(HX + s * 17 + s * 9, HY - 12); X.lineTo(HX + s * 17 + s * (16 + (d === 0 ? 2 : 0)), HY - 16 + d * 5 - 4); X.stroke(); }
  }
  if (m === 'sad') { X.strokeStyle = INK; X.lineWidth = 4; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(HX + s * 8, HY - 26 + 0); X.lineTo(HX + s * 26, HY - 21 + 0 - 4 * 0); X.stroke(); } }
  // mouth: panting tongue / smile / wail
  X.strokeStyle = INK; X.lineWidth = 3.4; X.beginPath();
  if (m === 'happy') { X.arc(HX - 4, HY + 22, 11, .15, Math.PI - .15); X.stroke(); X.fillStyle = '#ff7a9a'; el(HX - 4, HY + 33 + Math.abs(Math.sin(T * 10)) * 3, 6, 5); X.fill(); }
  else if (m === 'sad') { X.arc(HX - 4, HY + 38, 10, Math.PI + .2, -.2); X.stroke(); }
  else { X.moveTo(HX - 14, HY + 26); X.quadraticCurveTo(HX - 4, HY + 30, HX + 8, HY + 26); X.stroke(); const tl = 12 + Math.abs(Math.sin(T * (pouring ? 12 : 6))) * 6; X.beginPath(); X.moveTo(HX - 8, HY + 27); X.lineTo(HX - 8, HY + 27 + tl); X.quadraticCurveTo(HX - 3, HY + 31 + tl, HX + 2, HY + 27 + tl); X.lineTo(HX + 2, HY + 27); X.closePath(); ink('#ff7a9a', 2.5); }
  if (m === 'sad') for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const u = (T * 1.3 + k * .5 + (s > 0 ? .25 : 0)) % 1; X.globalAlpha = 1 - u; X.fillStyle = '#9fe3ff'; X.beginPath(); X.ellipse(HX + s * 17 + s * 3, HY + 4 + u * 40, 3.5, 5, 0, 0, TAU); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.5; X.stroke(); X.globalAlpha = 1; }
  else sweat(HX + 40, HY - 28, T, .3);
  X.restore();
  if (m === 'happy') { heart(HX + 52, HY - 40 - Math.sin(T * 4) * 5, 1.1); heart(HX - 40, HY - 52 - Math.sin(T * 4 + 1) * 5, .8); }
}
reg('tw_pour', sp => {
  const ctl = twCtl(7);
  const P = { x: -200, y: -50 }, TABLE = 170, GX = -35, GWT = 110, GWB = 92, GTOP = 30, N = 52, LIM = 22 - 3 * (sp - 1);
  const LINEY = GTOP + 38, FLOORY = TABLE;
  let th = 0, phi = 0, V = 1, acc = 0, fill = 0, spilled = 0, lvl = 0, c = 0, parts = [], splT = 0, sndT = 0, hold = false, rc = -1;
  const half = y => lerp(GWT, GWB, clamp((y - GTOP) / (TABLE - GTOP), 0, 1)) / 2 - 6;
  const spout = () => ({ x: P.x + 84 * Math.cos(phi) + 78 * Math.sin(phi), y: P.y + 84 * Math.sin(phi) - 78 * Math.cos(phi) });
  const body = [[-48, -62], [30, -62], [84, -78], [52, -40], [56, 62], [-56, 62]];
  const g = {
    wide: true, cmd: 'POUR!', hint: 'MOUSE X / → : TILT TO POUR, FILL TO THE LINE', thint: 'DRAG RIGHT TO POUR, LEFT TO STOP', dur: 5,
    move(p) { ctl.move(p); }, down(p) { ctl.move(p); },
    update(dt) {
      c += dt; ctl.update(dt); const u = ctl.ang / MAXT; th = ctl.ang * .4; phi = u > 0 ? u * 1.5 : u * .5;
      if (g.result && rc < 0) rc = c;
      if (!g.result) {
        const phi0 = .3 + (1 - V) * .9, k = clamp((phi - phi0) * 5, 0, 1);
        if (k > 0 && V > 0) {
          acc += k * 60 * dt;
          while (acc >= 1 && V > 0) {
            acc -= 1; V -= 1 / 125; const s = spout(), sp0 = 110 + k * 120;
            parts.push({ x: s.x, y: s.y, vx: Math.cos(phi) * sp0 + (Math.random() - .5) * 24, vy: Math.sin(phi) * sp0 + (Math.random() - .5) * 24 });
          }
          sndT -= dt; if (sndT <= 0) { sndT = .09; noise(.1, .025, 900, 1800, 'bandpass', 0, 2); }
        }
      }
      const gx = Math.sin(th) * 1500, gy = Math.cos(th) * 1500;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.vx += gx * dt; p.vy += gy * dt; const py0 = p.y; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y >= GTOP && p.y < TABLE - 4 && Math.abs(p.x - GX) < half(p.y)) {
          parts.splice(i, 1); fill++; sfx.blip(Math.min(14, fill / 4 | 0) - 4);
          if (fill % 6 === 0) { const s = w2s(GX, LINEY + 30, th); burst(s.x, s.y, '#FFC27A', 4, 120); }
          continue;
        }
        if (p.y >= TABLE - 3 || p.y > 420 || Math.abs(p.x) > 520 + OX) {
          parts.splice(i, 1);
          if (!g.result) {
            spilled++; splT -= 1;
            if (spilled % 3 === 1) { sfx.splat(); const s = w2s(p.x, TABLE, th); burst(s.x, s.y, '#FFC27A', 5, 160); }
            if (spilled > LIM) { g.result = 'lose'; rc = c; sfx.miss(); sfx.thud(); shake(8, .25); const s = w2s(P.x + 120, -80, th); floatText('SPILLED!', s.x, s.y, '#ff4d4d', 44); }
          }
        }
      }
      lvl += (fill / N - lvl) * (1 - Math.exp(-14 * dt));
      if (!g.result) {
        if (fill >= N) {
          g.result = 'win'; rc = c; sfx.coin(); sfx.sparkle(); const s = w2s(GX, LINEY, th); confetti(s.x, s.y, 30); ring(s.x, s.y, '#fff', 100); burst(s.x, s.y, '#FFC27A', 14);
          floatText(spilled < 4 ? 'PERFECT!' : 'GULP!', s.x, s.y - 80, '#5CFF7A', 44); shake(5, .15);
        } else if (V <= 0 && parts.length === 0) { g.result = 'lose'; rc = c; sfx.miss(); sfx.thud(); const s = w2s(P.x, -130, th); floatText('EMPTY!', s.x, s.y, '#ff4d4d', 40); }
      }
    },
    draw() {
      if (g.result && rc < 0) rc = c;
      const oT = g.result ? Math.max(0, c - rc) : 0, win = g.result === 'win', lose = g.result === 'lose';
      const BG = bake('pour', () => bakePour(TABLE, GX, GWT, GWB, GTOP));
      X = ctx; X.save(); X.translate(W / 2, H / 2); X.rotate(th);
      blit(BG);
      // sun with sunglasses (its rays turn), clouds
      X.save(); X.translate(-275, -185); X.rotate(c * .25); X.fillStyle = 'rgba(255,240,150,.45)'; for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 42); X.lineTo(8, 42); X.lineTo(0, 72); X.fill(); } X.restore();
      X.beginPath(); X.arc(-275, -185, 32, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(-285, -196, 11, 7, -.6); X.fill();
      for (const sx of [-1, 1]) { rr(-275 + sx * 15 - 11, -192, 22, 14, 6); ink(INK, 1); X.fillStyle = 'rgba(255,255,255,.5)'; el(-275 + sx * 15 - 4, -188, 3, 2, -.5); X.fill(); }
      X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-275 - 4, -186); X.lineTo(-275 + 4, -186); X.stroke(); X.beginPath(); if (win) X.arc(-275, -178, 9, .1, Math.PI - .1); else if (lose) X.arc(-275, -164, 8, Math.PI + .3, -.3); else X.arc(-275, -176, 6, .3, Math.PI - .3); X.stroke();
      cloud(((c * 7 + 380) % 1000) - 480, -200, 1); cloud(((c * 5 + 40) % 1000) - 400, -135, .7);
      // the thirsty camel behind the counter
      const pouring = !g.result && parts.length > 0 && V > 0;
      camel(c, win ? 'happy' : lose ? 'sad' : pouring ? 'pour' : null, clamp((GX - 190) / 200, -1, 1), clamp(.55, -1, 1), pouring);
      // puddle on the counter
      if (spilled > 0) { const pw = Math.min(200, 12 + spilled * 7); X.fillStyle = INK; el(-60, TABLE - 1, pw + 4, 8); X.fill(); X.fillStyle = '#ffe45c'; el(-60, TABLE - 2, pw, 5.5); X.fill(); X.fillStyle = 'rgba(255,255,255,.6)'; el(-60 - pw * .3, TABLE - 4, pw * .3, 1.6); X.fill(); }
      // glass
      const gp = polyP([[GX - GWT / 2, GTOP], [GX + GWT / 2, GTOP], [GX + GWB / 2, TABLE], [GX - GWB / 2, TABLE]]);
      X.fillStyle = 'rgba(20,16,28,.3)'; el(GX + 6, TABLE, GWB / 2 + 12, 7); X.fill();
      cel(gp, '#e6f9ff', '#a9dcf0', 5, 0, 5);
      X.save(); X.beginPath(); X.moveTo(GX - half(GTOP), GTOP); X.lineTo(GX + half(GTOP), GTOP); X.lineTo(GX + half(TABLE), TABLE - 4); X.lineTo(GX - half(TABLE), TABLE - 4); X.closePath(); X.clip();
      const top = (TABLE - 4) - lvl * ((TABLE - 4) - LINEY);
      X.save(); X.translate(GX, top); X.rotate(-th); X.fillStyle = '#ffe45c'; X.fillRect(-200, 0, 400, 400); X.fillStyle = '#f2c230'; X.fillRect(30, 0, 400, 400); X.fillStyle = '#fff6b0'; X.fillRect(-200, 0, 400, 6); X.restore();
      X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const bu = (c * .6 + i * .27) % 1; X.globalAlpha = .6; el(GX - 20 + i * 14 + Math.sin(c * 3 + i) * 3, TABLE - 8 - bu * (TABLE - 8 - top), 2.4, 2.4); X.fill(); } X.globalAlpha = 1;
      X.restore();
      X.fillStyle = 'rgba(255,255,255,.7)'; rr(GX - GWT / 2 + 9, GTOP + 10, 6, 60, 3); X.fill();
      X.save(); X.setLineDash([10, 7]); X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(GX - GWT / 2 - 14, LINEY); X.lineTo(GX + GWT / 2 + 14, LINEY); X.stroke(); X.restore();
      spark(GX + GWT / 2 + 30, LINEY, 11, '#FFE14D', c * 2, 3);
      if (win) { const k = outBack(oT / .35); X.save(); X.translate(GX + GWT / 2 - 8, GTOP - 4); X.scale(k, k); X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink('#ffe14d', 3); X.strokeStyle = '#fff6b0'; X.lineWidth = 2; for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(i * 1.57 + .8) * 12, Math.sin(i * 1.57 + .8) * 12); X.stroke(); } line(0, 0, 8, -34, '#ff5c8a', 4); X.restore(); for (let i = 0; i < 4; i++) spark(GX + Math.cos(oT * 5 + i * 1.57) * 70, LINEY - 30 + Math.sin(oT * 5 + i * 1.57) * 30, 7, '#fff', oT * 4, 2); }
      // pitcher: handle, cel-shaded glass, lemonade, face
      X.save(); X.translate(P.x, P.y); X.rotate(phi);
      X.beginPath(); X.arc(-58, 0, 34, -1.2, 1.2); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = '#a9dcf0'; X.stroke();
      const bp = polyP(body); cel(bp, '#e6f9ff', '#a9dcf0', 8, 0, 5);
      X.save(); X.clip(bp); X.save(); X.rotate(-(phi + th)); const ly = 60 - V * 120; X.fillStyle = '#ffe45c'; X.fillRect(-300, ly, 600, 400); X.fillStyle = '#f2c230'; X.fillRect(20, ly, 600, 400); X.fillStyle = '#fff6b0'; X.fillRect(-300, ly, 600, 6); X.restore(); X.restore();
      inkP(bp, null, 5); X.fillStyle = 'rgba(255,255,255,.6)'; rr(-46, -50, 6, 70, 3); X.fill();
      X.fillStyle = OR; X.save(); X.clip(bp); X.fillRect(-56, 40, 112, 10); X.restore();
      const hap = win, sad = lose, md = hap ? 'happy' : sad ? 'bonk' : pouring ? 'panic' : null;
      eye(-14, -8, 7, md, pouring ? .6 : 0, pouring ? .5 : .1, c, 1); eye(16, -8, 7, md, pouring ? .6 : 0, pouring ? .5 : .1, c, 3);
      X.strokeStyle = INK; X.lineWidth = 3.4; X.lineCap = 'round'; X.beginPath(); if (pouring) X.arc(2, 12, 6, 0, TAU); else if (hap) X.arc(2, 8, 8, .1, Math.PI - .1); else if (sad) X.arc(2, 20, 7, Math.PI + .3, -.3); else X.arc(2, 14, 8, .2, Math.PI - .2); X.stroke();
      X.fillStyle = 'rgba(255,110,140,.4)'; el(-26, 8, 5, 3); X.fill(); el(30, 8, 5, 3); X.fill();
      if (sad) { for (const sx of [-14, 16]) { const u = (c * 1.4 + sx) % 1; X.fillStyle = '#9fe3ff'; X.globalAlpha = 1 - u; el(sx, 0 + u * 28, 3, 5); X.fill(); X.globalAlpha = 1; } } else if (pouring) sweat(36, -20, c, 0);
      X.restore();
      // droplets
      for (const p of parts) { X.beginPath(); X.arc(p.x, p.y, 5, 0, TAU); ink('#ffe45c', 2); X.fillStyle = 'rgba(255,255,255,.7)'; el(p.x - 1.5, p.y - 1.5, 1.6, 1.6); X.fill(); }
      X.restore();
      // spill meter: a drop badge + plate
      const icDrop = () => { X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(9, 3, 0, 9); X.quadraticCurveTo(-9, 3, 0, -9); ink('#ffe45c', 2); };
      const sp0 = clamp(spilled / LIM, 0, 1);
      gauge(400, 70, 250, 1 - sp0, sp0 > .6 ? '#ff4d5e' : '#ffd23f', icDrop, c);
      level(th); vignette(.18);
    }
  };
  return g;
}, 'Pour');

/* ───────────── 4 TWIST: crack the safe, turn the dial onto the ghost mark and hold ───────────── */
/* a burglar with a stethoscope in a mansion study at night; the guard dog sleeps on his bed; the alarm light waits */
function bakeDial(FLOOR) {
  let g = X.createLinearGradient(0, -650, 0, FLOOR); g.addColorStop(0, '#2c2766'); g.addColorStop(1, '#5a4fc4'); X.fillStyle = g; X.fillRect(-800, -650, 1600, FLOOR + 650);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let y = -640; y < FLOOR; y += 60) for (let x = -800; x < 800; x += 60) { X.beginPath(); X.moveTo(x + 30, y); X.lineTo(x + 45, y + 15); X.lineTo(x + 30, y + 30); X.lineTo(x + 15, y + 15); X.closePath(); X.fill(); }
  X.fillStyle = '#6b3b17'; X.fillRect(-800, FLOOR - 56, 1600, 56); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(-800, FLOOR - 56, 1600, 6); X.fillStyle = INK; X.fillRect(-800, FLOOR - 58, 1600, 4);
  planks(FLOOR, '#8a5530', '#5e381d', 120);
  // rug
  el(-20, FLOOR + 30, 300, 26); ink('#b8283a', 4); el(-20, FLOOR + 30, 270, 17); X.fillStyle = '#e2475a'; X.fill(); X.fillStyle = 'rgba(255,255,255,.2)'; el(-60, FLOOR + 24, 120, 5); X.fill();
  // window with the moon + stars
  rr(-385, -250, 110, 120, 6); ink('#e3a868', 5);
  rr(-379, -244, 98, 108, 3); X.save(); X.clip(); g = X.createLinearGradient(0, -244, 0, -136); g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#3d3480'); X.fillStyle = g; X.fillRect(-380, -245, 100, 110);
  X.fillStyle = '#fff3b0'; X.beginPath(); X.arc(-308, -212, 18, 0, TAU); X.fill(); X.fillStyle = '#3d3480'; X.beginPath(); X.arc(-300, -218, 15, 0, TAU); X.fill();
  X.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { X.beginPath(); X.arc(-370 + hh(i) * 80, -238 + hh(i + 8) * 70, 1.8, 0, TAU); X.fill(); } X.restore();
  X.fillStyle = INK; X.fillRect(-333, -244, 5, 108); X.fillRect(-379, -193, 98, 5);
  rr(-392, -132, 124, 14, 4); ink('#d9944f', 4);
  // wall alarm bell mount
  rr(246, -90, 40, 12, 4); ink('#8f9cb3', 3.5);
  // dog bed
  el(271, FLOOR + 4, 100, 20); ink('#b8283a', 4); el(271, FLOOR - 2, 88, 14); X.fillStyle = '#ff6b7e'; X.fill();
}
reg('tw_dial', sp => {
  const FLOOR = 228, CY = 0, HOLD = .75 + .15 * (sp - 1), TOL = (7.5 - 2.2 * (sp - 1)) * Math.PI / 180;
  const T = (Math.random() < .5 ? -1 : 1) * (1.1 + Math.random() * 1.2);
  let d = 0, c = 0, mode = 0, pa = 0, hold = 0, tickT = .2, th = 0, det = 0, flash = 0, rc = -1;
  const err = () => Math.abs(wrap(d - T));
  const g = {
    wide: true, cmd: 'TWIST!', hint: 'MOUSE AROUND THE DIAL / ← → : MATCH THE MARK & HOLD', thint: 'DRAG AROUND THE DIAL TO MATCH THE MARK',
    dur: 5,
    move(p) { const dx = p.x - W / 2, dy = p.y - (H / 2 + CY); if (Math.hypot(dx, dy) > 30 && !(keys.ArrowLeft || keys.ArrowRight || keys.KeyA || keys.KeyD)) { pa = Math.atan2(dx, -dy) - th; mode = 1; } },
    down(p) { g.move(p); },
    update(dt) {
      c += dt; flash = Math.max(0, flash - dt);
      if (g.result && rc < 0) rc = c;
      th = .06 * Math.sin(c * 1.7) + clamp(d, -2.4, 2.4) * .05;
      if (g.result) return;
      const l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD;
      if (l || r) { d = wrap(d + ((r ? 1 : 0) - (l ? 1 : 0)) * 2.4 * dt); mode = 2; }
      else if (mode === 1) d = wrap(d + wrap(pa - d) * (1 - Math.exp(-14 * dt)));
      const e = err(), inn = e < TOL;
      const nd = Math.floor(d / (Math.PI / 12)); if (nd !== det) { det = nd; snd(520 + (nd % 3) * 60, .025, 'square', .025); }
      hold = inn ? hold + dt : Math.max(0, hold - dt * 2);
      tickT -= dt;
      if (tickT <= 0) {
        const prox = clamp(1 - e / 1.5, 0, 1); tickT = .4 - .32 * prox;
        if (inn) { sfx.tickHi(); tickT = .08; } else sfx.blip(Math.round(-6 + prox * 20));
      }
      if (hold >= HOLD) {
        g.result = 'win'; rc = c; flash = .4; sfx.coin(); sfx.sparkle(); sfx.stamp(); shake(6, .2);
        const s = w2s(0, CY, th); confetti(s.x, s.y, 36); ring(s.x, s.y, '#fff', 150); burst(s.x, s.y, '#FFE14D', 16); floatText('CLICK!', s.x, s.y - 190, '#5CFF7A', 52);
      }
    },
    draw() {
      if (g.result && rc < 0) rc = c;
      const oT = g.result ? Math.max(0, c - rc) : 0, win = g.result === 'win', lose = g.result === 'lose';
      const BG = bake('dial', () => bakeDial(FLOOR));
      X = ctx; X.save(); X.translate(W / 2, H / 2); X.rotate(th);
      blit(BG);
      const e = err(), focus = !g.result && hold > 0, near = !g.result && e < .9, late = c > 3.4 / Math.sqrt(sp);
      // the alarm light on the wall: dark while all is well, flashing red when it goes wrong
      const al = lose ? .5 + .5 * Math.sin(oT * 22) : 0;
      X.beginPath(); X.moveTo(252, -90); X.lineTo(252, -104); X.arc(266, -104, 14, Math.PI, 0); X.lineTo(280, -90); X.closePath(); ink(lose ? '#ff4d5e' : '#8f2a3a', 3.5);
      if (lose) { X.save(); X.globalCompositeOperation = 'lighter'; X.translate(266, -104); X.rotate(oT * 12); X.fillStyle = 'rgba(255,60,80,.28)'; for (let i = 0; i < 2; i++) { X.rotate(Math.PI); X.beginPath(); X.moveTo(0, 0); X.lineTo(-90, -40); X.lineTo(-90, 40); X.closePath(); X.fill(); } X.restore(); X.fillStyle = 'rgba(255,40,70,' + (.1 + al * .12) + ')'; X.fillRect(-800, -650, 1600, 1300); }
      // the sleeping guard dog
      X.save(); X.translate(-34, 0);     // shifted left so the tail stays on a 4:3 screen
      const dg = (() => {
        const bodyP = elP(325, FLOOR - 26, 60, 28); cel(bodyP, '#c98a5a', '#9b6338', 6, 8, 4.5);
        const tail = Math.sin(c * (win ? 0 : lose ? 20 : .8)) * .3; X.save(); X.translate(380, FLOOR - 24); X.rotate(-.5 + tail); line(0, 0, 26, 0, '#c98a5a', 10); X.restore();
        const sn = Math.sin(c * 1.9); X.save(); X.translate(0, (lose ? -Math.abs(Math.sin(oT * 14)) * 8 : sn * 1.5));
        const ear = elP(252, FLOOR - 40, 12, 26, .2); cel(ear, '#6b3b17', '#4a2810', 3, 3, 3.5);
        const hd = elP(272, FLOOR - 34, 34, 30); cel(hd, '#c98a5a', '#9b6338', 4, 6, 4.5);
        const sm = elP(250, FLOOR - 24, 20, 14); cel(sm, '#f3cd9a', '#d7a874', 2, 4, 3.5);
        X.beginPath(); X.ellipse(236, FLOOR - 32, 6, 4.4, 0, 0, TAU); ink(INK, 1);
        X.fillStyle = 'rgba(255,255,255,.7)'; el(234, FLOOR - 34, 1.8, 1.2); X.fill();
        const awake = lose, cracked = !g.result && hold > HOLD * .35;
        eye(268, FLOOR - 46, 8, awake ? 'panic' : win ? 'sleep' : cracked ? null : 'sleep', -1, 0, c, 2);
        X.strokeStyle = INK; X.lineWidth = 3.4; X.lineCap = 'round'; X.beginPath(); X.moveTo(284, FLOOR - 50); X.lineTo(298, FLOOR - 54 - (awake ? 6 : 0)); X.stroke();
        if (awake) { rr(238, FLOOR - 24, 26, 14 + Math.abs(Math.sin(oT * 18)) * 5, 6); ink('#7a1830', 2.5); X.fillStyle = '#fff'; X.fillRect(242, FLOOR - 24, 5, 5); X.fillRect(254, FLOOR - 24, 5, 5); }
        else { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(250, FLOOR - 18, 8, .2, Math.PI - .2); X.stroke(); }
        X.restore();
        if (!awake) { const br = 5 + (1 + sn) * 8; X.save(); X.beginPath(); X.arc(228 - br * .3, FLOOR - 30, br, 0, TAU); X.globalAlpha = .8; ink('rgba(220,245,255,.5)', 2); X.fillStyle = 'rgba(255,255,255,.8)'; el(228 - br * .6, FLOOR - 33, br * .22, br * .15); X.fill(); X.restore(); for (let i = 0; i < 3; i++) zee(262 + i * 18 + Math.sin(c + i) * 4, FLOOR - 82 - ((c * 14 + i * 22) % 66), .7 + i * .12, 1 - ((c * 14 + i * 22) % 66) / 66); }
        else for (let i = 0; i < 3; i++) { const u = (oT * 2 + i * .33) % 1; X.save(); X.globalAlpha = 1 - u; X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.arc(230, FLOOR - 18, 24 + u * 60 + i * 6, Math.PI * .72, Math.PI * 1.28); X.stroke(); X.restore(); }
      })();
      X.restore();
      // the safe: the cavity is revealed when the door swings
      const sx = win ? 1 - .86 * ease(oT / .4) : 1;
      if (win) {
        const cav = rrP(-185, -215, 370, 425, 10); inkP(cav, '#1b1530', 4);
        X.save(); X.clip(cav); X.save(); X.translate(0, 0); X.rotate(oT * .8); X.fillStyle = 'rgba(255,225,90,.3)'; for (let i = 0; i < 8; i++) { X.rotate(TAU / 8); X.beginPath(); X.moveTo(0, 0); X.lineTo(-30, -300); X.lineTo(30, -300); X.closePath(); X.fill(); } X.restore();
        for (let s = 0; s < 3; s++) for (let k = 0; k < 3 - s; k++) { const q = polyP([[-130 + k * 64 + s * 32, 190 - s * 36], [-84 + k * 64 + s * 32, 190 - s * 36], [-92 + k * 64 + s * 32, 160 - s * 36], [-122 + k * 64 + s * 32, 160 - s * 36]]); cel(q, '#ffd23f', '#d9a60e', 2, 5, 3); glint(q, -108 + k * 64 + s * 32, 166 - s * 36, 14, 3, 'rgba(255,255,255,.7)'); }
        X.restore();
      }
      X.save(); X.translate(-195, 0); X.scale(sx, 1); X.translate(195, 0);
      const door = rrP(-195, -225, 390, 440, 16); X.save(); X.shadowColor = 'rgba(20,16,28,.3)'; X.shadowOffsetX = 6; X.shadowOffsetY = 8; cel(door, '#c9ced6', '#8f9cb3', 12, 0, 6); X.restore();
      X.save(); X.clip(door); X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.moveTo(-195, -225); X.lineTo(-90, -225); X.lineTo(-195, 40); X.closePath(); X.fill(); X.restore();
      rr(-170, -200, 340, 390, 10); X.lineWidth = 4; X.strokeStyle = 'rgba(20,16,28,.3)'; X.stroke();
      for (const q of [[-180, -210], [180, -210], [-180, 200], [180, 200]]) { X.beginPath(); X.arc(q[0], q[1], 7, 0, TAU); ink('#fff6e0', 3); X.fillStyle = '#8f9cb3'; X.fillRect(q[0] - 4, q[1] - 1, 8, 2); }
      for (const hy of [-150, 100]) { rr(-215, hy, 22, 44, 5); ink('#6b778f', 4); }
      // fixed ring + ticks
      const RR = 168; X.beginPath(); X.arc(0, CY, RR + 14, 0, TAU); ink('#ffd23f', 5); X.fillStyle = 'rgba(255,255,255,.4)'; X.beginPath(); X.arc(0, CY, RR + 14, Math.PI * 1.1, Math.PI * 1.55); X.arc(0, CY, RR + 4, Math.PI * 1.55, Math.PI * 1.1, true); X.fill();
      X.beginPath(); X.arc(0, CY, RR + 2, 0, TAU); X.fillStyle = '#fff6e0'; X.fill();
      X.strokeStyle = INK; X.lineCap = 'round';
      for (let i = 0; i < 48; i++) { const a = i * Math.PI / 24, big = i % 4 === 0, r1 = RR - (big ? 14 : 7), r2 = RR + 4; X.lineWidth = big ? 4 : 2; X.beginPath(); X.moveTo(Math.sin(a) * r1, CY - Math.cos(a) * r1); X.lineTo(Math.sin(a) * r2, CY - Math.cos(a) * r2); X.stroke(); }
      // ghost target mark
      const pulse = .55 + .45 * Math.sin(c * 9);
      if (!win) {
        X.save(); X.translate(0, CY); X.rotate(T);
        X.globalAlpha = .35 + .3 * pulse; X.setLineDash([8, 8]); X.lineWidth = 4; X.strokeStyle = '#E9873C'; X.beginPath(); X.moveTo(0, -30); X.lineTo(0, -RR + 20); X.stroke(); X.setLineDash([]); X.globalAlpha = 1;
        X.beginPath(); X.moveTo(0, -RR - 6); X.lineTo(-15, -RR - 36); X.lineTo(15, -RR - 36); X.closePath(); ink(e < TOL ? '#5CFF7A' : '#FFE14D', 4);
        X.restore();
      }
      // knob
      X.save(); X.translate(0, CY); X.rotate(d);
      const kb = elP(0, 0, 120, 120); cel(kb, '#ffe9b8', '#e2c382', 10, 12, 5);
      X.fillStyle = 'rgba(20,16,28,.1)'; X.beginPath(); X.arc(0, 0, 100, 0, TAU); X.fill();
      for (let i = 0; i < 3; i++) { X.save(); X.rotate(i * TAU / 3); const sp0 = rrP(-14, -104, 28, 98, 8); cel(sp0, '#ff6b5e', '#b8283a', 5, 0, 4); X.restore(); }
      X.beginPath(); X.arc(0, 0, 30, 0, TAU); ink('#fff6e0', 5); X.fillStyle = 'rgba(255,255,255,.7)'; el(-8, -9, 9, 5, -.5); X.fill();
      X.beginPath(); X.moveTo(0, -128); X.lineTo(-13, -102); X.lineTo(13, -102); X.closePath(); ink(OR, 4);
      X.restore();
      // hold progress arc
      if (hold > 0 && !win) { X.lineWidth = 12; X.strokeStyle = INK; X.beginPath(); X.arc(0, CY, RR + 28, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(hold / HOLD, 0, 1)); X.stroke(); X.lineWidth = 6; X.strokeStyle = '#5CFF7A'; X.stroke(); }
      // stethoscope chest-piece lives on the door
      const cpx = -176, cpy = 112;
      X.beginPath(); X.arc(cpx, cpy, 10, 0, TAU); ink('#c9ced6', 3.5); X.fillStyle = '#6b778f'; X.beginPath(); X.arc(cpx, cpy, 5, 0, TAU); X.fill();
      X.restore();
      // Caos the burglar
      const ccx = -300, jump = win ? -Math.abs(Math.sin(oT * 9)) * 16 : 0;
      X.fillStyle = 'rgba(20,16,28,.3)'; el(ccx, FLOOR + 6, 50, 11); X.fill();
      // swag sack
      const sk = elP(-352, FLOOR - 24, 26, 26); cel(sk, '#8a5a34', '#5e381d', 4, 6, 4); rr(-362, FLOOR - 56, 20, 10, 4); ink('#8a5a34', 3); X.fillStyle = '#ffd23f'; X.font = '900 22px "Arial Black",sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.strokeStyle = INK; X.lineWidth = 4; X.strokeText('$', -352, FLOOR - 24); X.fillText('$', -352, FLOOR - 24);
      // stethoscope tube from Caos's chest to the door
      const cpt = { x: -195 + (cpx + 195) * sx, y: cpy }, st = { x: ccx + 36, y: FLOOR + jump - 28 }, sag = 36 + (focus ? Math.sin(c * 16) * 2 : 0);
      X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.moveTo(st.x, st.y); X.quadraticCurveTo((st.x + cpt.x) / 2, Math.max(st.y, cpt.y) + sag, cpt.x, cpt.y); X.stroke(); X.strokeStyle = '#4a4458'; X.lineWidth = 4; X.stroke();
      const cm = win ? 'happy' : lose ? 'sad' : null;
      caos(ccx, FLOOR + jump, 6, { mood: cm });
      // beanie + arms
      X.save(); X.translate(0, jump);
      rr(ccx - 6.5 * 6, FLOOR - 9 * 6 - 14, 13 * 6, 20, 9); ink('#2a2230', 4); X.fillStyle = '#fff'; X.fillRect(ccx - 30, FLOOR - 9 * 6 - 2, 60, 5); X.beginPath(); X.arc(ccx, FLOOR - 9 * 6 - 18, 8, 0, TAU); ink('#ff4d5e', 3);
      // big readable eyes under the beanie, glancing at the sleeping dog
      for (const s of [-1, 1]) eye(ccx + s * 17, FLOOR - 33, 9, win ? 'happy' : (lose || (late && !g.result)) ? 'panic' : null, 1, .1, c, s > 0 ? 3 : 1);
      if (win || lose) for (const s of [-1, 1]) { line(ccx + s * 40, FLOOR - 36, ccx + s * 54, FLOOR - 82 - Math.sin(oT * 12 + s) * (win ? 6 : 1), OR, 8); X.beginPath(); X.arc(ccx + s * 54, FLOOR - 86 - Math.sin(oT * 12 + s) * (win ? 6 : 1), 7, 0, TAU); ink('#f3a283', 3); }
      else { line(ccx + 38, FLOOR - 34, st.x, st.y, OR, 8); }
      if (lose || (late && !g.result)) sweat(ccx + 34, FLOOR - 60, c, 0);
      if (focus) sweat(ccx - 34, FLOOR - 60, c, .5);
      X.restore();
      // payoff: coins fly out of the safe
      if (win) for (let i = 0; i < 12; i++) { const u = oT - .12; if (u < 0) continue; const cx2 = (hh(i) - .5) * 520 * u, cy2 = -(380 + hh(i + 20) * 200) * u + 1500 * u * u; X.save(); X.globalAlpha = clamp(1.1 - u, 0, 1); X.beginPath(); X.arc(cx2, cy2 - 20, 12, 0, TAU); ink('#ffd23f', 3); X.fillStyle = '#d9a60e'; X.beginPath(); X.arc(cx2, cy2 - 20, 6, 0, TAU); X.fill(); X.restore(); }
      X.restore();
      if (flash > 0) { X.save(); X.globalAlpha = flash * .8; const s0 = w2s(0, CY, th); const gr = X.createRadialGradient(s0.x, s0.y, 10, s0.x, s0.y, 200); gr.addColorStop(0, '#fff6a8'); gr.addColorStop(1, 'rgba(255,246,168,0)'); X.fillStyle = gr; X.fillRect(s0.x - 200, s0.y - 200, 400, 400); X.restore(); }
      level(th); vignette(.18);
    }
  };
  return g;
}, 'Twist');

})();
