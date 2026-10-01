
'use strict';
const W = 800, H = 600;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const INK = '#14101c', OR = '#D97757';
let muted = false, now = 0;

/* ───────────── sound ───────────── */
/* Everything routes through master → compressor, so layered sfx never clip. snd() keeps its old signature. */
let AC, MASTER, NOISEBUF;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    MASTER = AC.createGain(); MASTER.gain.value = .9; MASTER.connect(comp); comp.connect(AC.destination);
    NOISEBUF = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NOISEBUF.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
/* tone: freq f (optionally gliding to f2), duration d, waveform, volume v, start delay, optional detune-layer */
function snd(f, d = .1, type = 'square', v = .06, delay = 0, f2, bus) {
  if (muted) return;
  try {
    const A = audio(), o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + .006);   // 6ms attack = no click
    g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(g); g.connect(bus || MASTER); o.start(t0); o.stop(t0 + d + .03);
  } catch (e) {}
}
/* filtered noise burst: hiss / thud / whoosh / crunch. lo→hi sweeps the filter */
function noise(d = .12, v = .08, lo = 800, hi = lo, type = 'bandpass', delay = 0, q = 1) {
  if (muted) return;
  try {
    const A = audio(), s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain(), t0 = A.currentTime + delay;
    s.buffer = NOISEBUF; s.loop = true; fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(lo, t0); if (hi !== lo) fl.frequency.exponentialRampToValueAtTime(hi, t0 + d);
    g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    s.connect(fl); fl.connect(g); g.connect(MASTER); s.start(t0, Math.random()); s.stop(t0 + d + .03);
  } catch (e) {}
}
/* named effects: use these instead of hand-rolled snd() chains so the whole game sounds like one thing */
const sfx = {
  click: () => { snd(900, .04, 'square', .04, 0, 600); },
  tick:  () => snd(480, .04, 'square', .03),
  tickHi:() => snd(920, .05, 'square', .04),
  hit:   () => { snd(620, .08, 'square', .06, 0, 1300); snd(1240, .1, 'triangle', .04, .02); noise(.05, .04, 3000, 6000, 'highpass'); },
  miss:  () => { snd(190, .14, 'sawtooth', .06, 0, 80); noise(.1, .03, 400, 200, 'lowpass'); },
  pop:   () => { snd(380, .09, 'sine', .1, 0, 1100); noise(.04, .035, 2500, 5000, 'highpass'); },
  coin:  () => { snd(988, .07, 'square', .05); snd(1319, .22, 'square', .05, .07); },
  thud:  () => { snd(120, .16, 'sine', .14, 0, 45); noise(.08, .05, 300, 120, 'lowpass'); },
  whoosh:(up = true) => noise(.28, .07, up ? 300 : 3000, up ? 3500 : 300, 'bandpass', 0, 1.4),
  boing: () => snd(220, .35, 'sine', .1, 0, 520),
  zap:   () => { snd(1800, .16, 'sawtooth', .05, 0, 150); noise(.12, .04, 4000, 800, 'bandpass'); },
  buzz:  () => { snd(110, .25, 'sawtooth', .07); snd(116, .25, 'sawtooth', .06); },
  splat: () => { noise(.16, .09, 900, 200, 'lowpass'); snd(150, .12, 'sine', .1, 0, 60); },
  blip:  (n = 0) => snd(440 * Math.pow(2, n / 12), .07, 'square', .045),   // n = semitones, for rising combos
  sparkle: () => [1568, 2093, 2637, 3136].forEach((f, i) => snd(f, .09, 'sine', .035, i * .045)),
  stamp: () => { snd(90, .22, 'sine', .2, 0, 40); noise(.1, .08, 1200, 200, 'lowpass'); },
};
const mkChord = (notes, d, type, v, delay = 0) => notes.forEach(f => snd(f, d, type, v, delay));
const jingleWin  = () => {
  [523, 659, 784, 1047].forEach((f, i) => { snd(f, .16, 'square', .045, i * .075); snd(f * 2, .12, 'triangle', .03, i * .075 + .01); });
  mkChord([784, 988, 1319], .4, 'triangle', .04, .32); sfx.sparkle();
};
const jingleLose = () => {
  [392, 349, 294, 220].forEach((f, i) => { snd(f, .22, 'sawtooth', .045, i * .11, f * .94); snd(f / 2, .22, 'triangle', .06, i * .11); });
  noise(.3, .03, 600, 150, 'lowpass', .3);
};
const jingleGo   = () => { [330, 440, 554, 740].forEach((f, i) => snd(f, .1, 'triangle', .07, i * .06)); noise(.25, .04, 400, 3000, 'bandpass'); };

/* ── music: a tiny step sequencer (bass + arp + hat + kick). startMusic(stageIdx, tempoMul) / stopMusic().
   Scheduled ahead of time on the audio clock so it never stutters when the canvas frame rate dips. ── */
const SCALES = [[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 7, 8], [0, 4, 5, 7, 11], [0, 2, 5, 7, 9]];
const mus = { on: false, step: 0, next: 0, bpm: 132, mul: 1, root: 57, scale: SCALES[0], seed: 1, timer: 0, kind: 'play' };
function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function musTick() {
  if (!mus.on || muted) return;
  try {
    const A = audio(); if (mus.next < A.currentTime) mus.next = A.currentTime + .05;
    while (mus.next < A.currentTime + .25) {
      const s = mus.step, sd = mus.next - A.currentTime, bpm = mus.bpm * mus.mul, st16 = 60 / bpm / 4;
      const bar = (s / 16) | 0, sc = mus.scale, root = mus.root + (bar % 4 === 3 ? 5 : bar % 4 === 2 ? 3 : 0);
      if (s % 4 === 0) { snd(midi(root - 12 + sc[(s / 4 + bar) % sc.length] % 12), st16 * 3, 'triangle', .07, sd); if (s % 8 === 0) { snd(150, .1, 'sine', .12, sd, 45); } }
      if (s % 4 === 2) noise(.04, .018, 7000, 7000, 'highpass', sd);
      if (mus.kind === 'play' || mus.kind === 'boss') {
        const k = (s * 7 + bar * 3 + mus.seed) % sc.length;
        if (s % 2 === 0 || mus.kind === 'boss') snd(midi(root + 12 + sc[k]), st16 * .8, 'square', .018, sd);
      }
      mus.next += st16; mus.step = (s + 1) % 64;
    }
  } catch (e) {}
}
function startMusic(i = 0, mul = 1, kind = 'play') {
  mus.scale = SCALES[i % SCALES.length]; mus.root = [57, 55, 60, 53, 58][i % 5]; mus.seed = i + 1; mus.mul = mul; mus.kind = kind;
  if (!mus.on) { mus.on = true; mus.step = 0; mus.next = 0; mus.timer = setInterval(musTick, 60); }
}
function stopMusic() { mus.on = false; clearInterval(mus.timer); }

/* ───────────── drawing helpers ───────────── */
function box(x, y, w, h, fill, o = 4) {
  ctx.fillStyle = INK; ctx.fillRect(x - o, y - o, w + o * 2, h + o * 2);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
}
function circ(x, y, r, fill, o = 4) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + o, 0, 7); ctx.fill();
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
if (document.fonts) document.fonts.load('700 20px Fredoka').catch(() => {});   // canvas won't trigger the webfont load by itself
function txt(s, x, y, size, fill = '#fff', align = 'center', maxW = 0) {
  s = t(s);
  const dark = fill === INK;   // dark label (buttons): lighter face + spacing, no outline (dark on dark = blob)
  const face = sz => dark ? `700 ${sz}px Fredoka, "Helvetica Neue", Arial, sans-serif` : `900 ${sz}px "Arial Black", Impact, sans-serif`;
  ctx.font = face(size); if ('letterSpacing' in ctx) ctx.letterSpacing = dark ? Math.max(.5, size / 24) + 'px' : '0px';
  if (maxW) { const w = ctx.measureText(s).width; if (w > maxW) { size *= maxW / w; ctx.font = face(size); } }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (!dark) { ctx.lineWidth = size / 5; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
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
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(20,16,28,.14)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(20,16,28,.06)';                       // halftone dots
  for (let y = 10; y < H; y += 28) for (let x = (y / 28 & 1) * 14 + 6; x < W; x += 28) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
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

/* ───────────── juice: screen shake, bursts, rings, floating text, vignette ───────────── */
let shakeT = 0, shakeA = 0;
function shake(a = 8, d = .25) { shakeA = a; shakeT = d; }
function applyShake(dt) {           // call right after ctx.save() at the top of a frame; pair with ctx.restore()
  if (shakeT > 0) { shakeT -= dt; const k = Math.max(0, shakeT) * shakeA * 3; ctx.translate((Math.random() - .5) * k, (Math.random() - .5) * k); }
}
const fxs = [];
function burst(x, y, col = '#FFE14D', n = 14, sp = 260) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (.4 + Math.random() * .8); fxs.push({ k: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .4 + Math.random() * .3, t: 0, r: 3 + Math.random() * 4, c: col }); }
}
function ring(x, y, col = '#fff', r1 = 90, d = .4) { fxs.push({ k: 'ring', x, y, life: d, t: 0, r: r1, c: col }); }
function floatText(s, x, y, col = '#FFE14D', size = 34) { fxs.push({ k: 'txt', x, y, s: t(s), life: .8, t: 0, c: col, r: size }); }
function updateFx(dt) {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i]; f.t += dt; if (f.t >= f.life) { fxs.splice(i, 1); continue; }
    if (f.k === 'dot') { f.vy += 500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
  }
}
function drawFx() {
  for (const f of fxs) {
    const u = f.t / f.life;
    if (f.k === 'dot') { ctx.globalAlpha = 1 - u; ctx.fillStyle = INK; ctx.fillRect(f.x - f.r - 2, f.y - f.r - 2, f.r * 2 + 4, f.r * 2 + 4); ctx.fillStyle = f.c; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); }
    else if (f.k === 'ring') { ctx.globalAlpha = 1 - u; ctx.strokeStyle = f.c; ctx.lineWidth = 6 * (1 - u) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * u + 6, 0, 7); ctx.stroke(); }
    else { ctx.globalAlpha = 1 - u * u; txt(f.s, f.x, f.y - u * 50, f.r * (1 + (1 - u) * .2), f.c); }
    ctx.globalAlpha = 1;
  }
}
let _vig;
function vignette(a = .35) {       // cheap cached radial darkening of the corners
  if (!_vig) { _vig = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95); _vig.addColorStop(0, 'rgba(20,16,28,0)'); _vig.addColorStop(1, 'rgba(20,16,28,1)'); }
  ctx.globalAlpha = a; ctx.fillStyle = _vig; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}
/* soft ground shadow under a sprite */
function shadow(x, y, rx, ry = rx * .3, a = .25) { ctx.fillStyle = `rgba(20,16,28,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }
/* drop-shadowed box: the chunky look with depth */
function box3(x, y, w, h, fill, o = 4, depth = 6) {
  ctx.fillStyle = INK; ctx.fillRect(x - o + depth, y - o + depth, w + o * 2, h + o * 2);
  box(x, y, w, h, fill, o);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w, Math.max(3, h * .12));
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

