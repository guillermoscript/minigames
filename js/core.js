
'use strict';
const W = 800, H = 600;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const INK = '#14101c', OR = '#D97757';
let muted = false, now = 0;

/* ───────────── sound ───────────── */
let AC;
function snd(f, d = .1, type = 'square', v = .06, delay = 0, f2) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + d + .02);
  } catch (e) {}
}
const jingleWin  = () => [523, 659, 784, 1047].forEach((f, i) => snd(f, .14, 'square', .06, i * .08));
const jingleLose = () => [392, 330, 262, 196].forEach((f, i) => snd(f, .18, 'sawtooth', .06, i * .1));
const jingleGo   = () => [330, 440, 554].forEach((f, i) => snd(f, .1, 'triangle', .07, i * .07));

/* ───────────── drawing helpers ───────────── */
function box(x, y, w, h, fill, o = 4) {
  ctx.fillStyle = INK; ctx.fillRect(x - o, y - o, w + o * 2, h + o * 2);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
}
function circ(x, y, r, fill, o = 4) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + o, 0, 7); ctx.fill();
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function txt(s, x, y, size, fill = '#fff', align = 'center', maxW = 0) {
  ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  if (maxW) { const w = ctx.measureText(s).width; if (w > maxW) { size *= maxW / w; ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; } }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size / 5; ctx.strokeStyle = INK; ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function star(cx, cy, ro, ri, n, rot, fill, o = 4) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.lineJoin = 'round';
  if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function bg(color, ray, t) {
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ray; const n = 16, rot = t * .12;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * Math.PI * 2 / n, a1 = a0 + Math.PI / n;
    ctx.beginPath(); ctx.moveTo(W / 2, H / 2);
    ctx.lineTo(W / 2 + Math.cos(a0) * 1200, H / 2 + Math.sin(a0) * 1200);
    ctx.lineTo(W / 2 + Math.cos(a1) * 1200, H / 2 + Math.sin(a1) * 1200);
    ctx.fill();
  }
}

/* The Claude Code mascot: a blocky orange crab-critter. x = centre, y = bottom of feet, u = pixel unit */
function claude(x, y, u, o = {}) {
  const c = o.col || OR, ol = Math.max(3, u * .5), mood = o.mood;
  const wave = mood === 'happy' ? Math.sin(now * 14) * 1.4 * u : 0;
  const legs = [-5, -2.6, 1.4, 3.8].map((lx, i) => {
    const lift = o.run != null ? Math.max(0, Math.sin(o.run * 16 + i * Math.PI)) * 1.1 * u : 0;
    return [x + lx * u, y - 2 * u - lift * 0 , 1.2 * u, 2 * u - lift];
  });
  const shapes = [
    [x - 6 * u, y - 9 * u, 12 * u, 7 * u],
    [x - 8 * u, y - 6.5 * u - wave, 2 * u, 2.4 * u],
    [x + 6 * u, y - 6.5 * u + wave, 2 * u, 2.4 * u],
    ...legs.map(l => [l[0], y - 2 * u, l[2], l[3]])
  ];
  ctx.fillStyle = INK;
  for (const s of shapes) ctx.fillRect(s[0] - ol, s[1] - ol, s[2] + ol * 2, s[3] + ol * 2);
  ctx.fillStyle = c;
  for (const s of shapes) ctx.fillRect(s[0], s[1], s[2], s[3]);
  // eyes
  const ex = [x - 2.8 * u, x + 2.8 * u], ey = y - 6.2 * u;
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = Math.max(2, u * .55); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const e of ex) {
    if (mood === 'happy') {
      ctx.beginPath(); ctx.moveTo(e - u * .9, ey + u * 1); ctx.lineTo(e, ey - u * .3); ctx.lineTo(e + u * .9, ey + u * 1); ctx.stroke();
    } else if (mood === 'sad') {
      ctx.beginPath(); ctx.moveTo(e - u * .8, ey - u * .9); ctx.lineTo(e + u * .8, ey + u * .9);
      ctx.moveTo(e + u * .8, ey - u * .9); ctx.lineTo(e - u * .8, ey + u * .9); ctx.stroke();
    } else {
      const blink = (Math.sin(now * 1.7) > .985) ? .25 : 1;
      ctx.fillRect(e - .6 * u, ey - 1.2 * u * blink, 1.2 * u, 2.4 * u * blink);
    }
  }
  ctx.lineCap = 'butt';
}

/* ───────────── particles ───────────── */
const parts = [];
function confetti(x, y, n = 40) {
  const cols = ['#FFE14D', '#5CFF7A', '#4DB8FF', '#FF4D9E', '#D97757', '#fff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = 150 + Math.random() * 450;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, c: cols[i % cols.length], life: 1 + Math.random(), r: Math.random() * 6 });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.r += dt * 8;
    if (p.life <= 0) parts.splice(i, 1);
  }
}
function drawParts() {
  for (const p of parts) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
    ctx.fillRect(-6, -4, 12, 8); ctx.restore();
  }
}

/* ───────────── input ───────────── */
const keys = {};
let mouse = { x: W / 2, y: H / 2 };
function pos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}


/* ───────────── touch + game registry ───────────── */
const TOUCH = (typeof window !== 'undefined' && 'ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
const REG = [], REGMAP = {};
function reg(id, fn, name) { const o = { id, fn, name }; REG.push(o); REGMAP[id] = o; }

/* ───────────── shared helpers for microgames ───────────── */
function segD(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - k * dx, py - ay - k * dy);
}
function drawArrow(cx, cy, dir, s, fill) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir * Math.PI / 2);
  const p = [[0, -s], [s * .9, 0], [s * .35, 0], [s * .35, s], [-s * .35, s], [-s * .35, 0], [-s * .9, 0]];
  ctx.beginPath(); p.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.lineJoin = 'round';
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
}

function drawBug(x, y, rot, sc, legT) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (const i of [-1, 0, 1]) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, i * 12); ctx.lineTo(s * 32, i * 12 + Math.sin(legT * 25 + i * 2 + s) * 9); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 21, 28, 0, 0, 7); ctx.fillStyle = '#e8433a'; ctx.fill(); ctx.stroke();
  circ(0, -30, 11, INK, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(-7, -35, 5, 5); ctx.fillRect(2, -35, 5, 5);
  ctx.fillStyle = INK; for (const d of [[-8, -6], [8, 4], [-6, 14], [7, -14]]) { ctx.beginPath(); ctx.arc(d[0], d[1], 4, 0, 7); ctx.fill(); }
  ctx.restore(); ctx.lineCap = 'butt';
}
function token(x, y, r) {
  circ(x, y, r, '#FFC93C', 4);
  ctx.strokeStyle = OR; ctx.lineWidth = r / 4.4; ctx.lineCap = 'round';
  for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4 + now * 2; ctx.beginPath(); ctx.moveTo(x - Math.cos(an) * r * .55, y - Math.sin(an) * r * .55); ctx.lineTo(x + Math.cos(an) * r * .55, y + Math.sin(an) * r * .55); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
const shuffle = a => a.sort(() => Math.random() - .5);

