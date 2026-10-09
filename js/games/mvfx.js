'use strict';
/* MOVE IT! shared weirdness: the stage is a cursed cosmic disco where Caos is forced to dance for an audience of
   sentient snacks and one very judgmental disco ball. Everything here is plain canvas drawing built on core.js helpers.
   Loaded before mv1.js / mv2.js / main.js, so the globals below are visible to all three. */

const MVC = ['#FF3EA5', '#7B3FE4', '#19C6B7', '#FFE14D', '#5CFF7A', '#FF8A3D'];

/* full-screen psychedelic tunnel: spinning wedges + pulsing rings. a/b = the two main colours, t = time, k = intensity 0..1.5 */
function mvPsy(a, b, t, k = 1) {
  ctx.fillStyle = a; ctx.fillRect(-OX, 0, VW, H);
  const cx = W / 2 + Math.sin(t * .7) * 40 * k, cy = H / 2 + Math.cos(t * .9) * 30 * k, n = 14, rot = t * .35 * k;
  ctx.fillStyle = b;
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * Math.PI * 2 / n, a1 = a0 + Math.PI / n * (1 + .35 * Math.sin(t * 3 + i));
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * 1500, cy + Math.sin(a0) * 1500); ctx.lineTo(cx + Math.cos(a1) * 1500, cy + Math.sin(a1) * 1500); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  for (let i = 0; i < 6; i++) { const r = ((t * 120 * k + i * 110) % 660); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.lineWidth = 26; ctx.strokeStyle = i & 1 ? 'rgba(255,255,255,.10)' : 'rgba(20,16,28,.10)'; ctx.stroke(); }
}
/* a floor of coloured disco tiles that flash to the beat. y = top of floor */
function mvTiles(y, t, bpm = 120) {
  const step = 64, beat = (t * bpm / 60) | 0;
  ctx.fillStyle = INK; ctx.fillRect(-OX, y - 6, VW, H - y + 6);
  for (let r = 0; (y + r * 30) < H; r++) for (let x = -Math.ceil(OX / step) * step; x < W + OX; x += step) {
    const lit = ((x / step | 0) + r * 3 + beat) % 5 === 0;
    ctx.fillStyle = lit ? MVC[(((x / step | 0) + r + beat) % 4 + 4) % 4] : (((x / step | 0) + r) & 1 ? '#2b0f5e' : '#3b1d6e');
    ctx.fillRect(x + 2, y + r * 30 + 2, step - 4, 26);
  }
}
/* googly eye: pupil wanders / looks toward (lx, ly) unit-ish vector */
function mvEye(x, y, r, lx = 0, ly = 0) {
  circ(x, y, r, '#fff', Math.max(2, r * .2));
  const m = Math.min(1, Math.hypot(lx, ly) || 1), d = r * .45, ang = Math.atan2(ly, lx);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * d * m, y + Math.sin(ang) * d * m, r * .45, 0, 7); ctx.fill();
}
/* sentient snacks. kind: 0 hot dog, 1 eyeball donut, 2 banana, 3 lonely sock, 4 toaster, 5 cheese wedge.
   x,y = feet (middle), s = scale, t = time, w = wobble amount (0 calm .. 2 frantic). */
function mvFoodie(x, y, s, kind, t, w = 1, o = {}) {
  const ph = x * .013 + kind, hop = Math.abs(Math.sin(t * 6 + ph)) * 14 * s * w, sway = Math.sin(t * 6 + ph) * .22 * w;
  const lx = o.lx || 0, ly = o.ly != null ? o.ly : 0;
  shadow(x, y + 2, 26 * s, 6 * s, .25);
  ctx.save(); ctx.translate(x, y - hop); ctx.rotate(sway); ctx.scale(s, s * (1 + Math.sin(t * 12 + ph) * .05 * w));
  const arm = (ax, ay, dir) => { ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax + dir * 16, ay - 12 + Math.sin(t * 9 + ph + dir) * 14 * w, ax + dir * 26, ay - 26 + Math.sin(t * 9 + ph + dir) * 22 * w); ctx.stroke(); ctx.lineCap = 'butt'; };
  const legs = (lw) => { ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * lw, -6); ctx.lineTo(d * lw + Math.sin(t * 12 + ph + d) * 6 * w, 8); ctx.stroke(); } ctx.lineCap = 'butt'; };
  if (kind === 0) {            // hot dog
    arm(-22, -40, -1); arm(22, -40, 1); legs(8);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-24, -76, 48, 76, 24); ctx.fill();
    ctx.fillStyle = '#F0B35A'; ctx.beginPath(); ctx.roundRect(-20, -72, 40, 68, 20); ctx.fill();
    ctx.fillStyle = '#E0402F'; ctx.beginPath(); ctx.roundRect(-12, -78, 24, 80, 12); ctx.fill();
    ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -50); ctx.bezierCurveTo(-2, -58, 2, -42, 8, -52); ctx.stroke();
    mvEye(-6, -62, 6, lx, ly); mvEye(7, -62, 6, lx, ly);
  } else if (kind === 1) {     // donut with one giant eye
    arm(-30, -26, -1); arm(30, -26, 1); legs(10);
    circ(0, -34, 34, '#FF8FD0', 4); circ(0, -34, 11, '#7B3FE4', 3);
    ctx.fillStyle = '#fff'; for (const a of [0, 1.3, 2.6, 3.9, 5.2]) ctx.fillRect(Math.cos(a) * 24 - 3, -34 + Math.sin(a) * 24 - 1, 6, 3);
    mvEye(0, -34, 8, lx, ly);
  } else if (kind === 2) {     // banana
    arm(-14, -46, -1); arm(14, -46, 1); legs(6);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.bezierCurveTo(-44, -30, -22, -86, 18, -84); ctx.bezierCurveTo(2, -62, 6, -22, 14, 4); ctx.closePath(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#FFE14D'; ctx.fill();
    mvEye(-4, -52, 6, lx, ly); mvEye(8, -56, 6, lx, ly);
    ctx.fillStyle = INK; ctx.fillRect(-2, -38, 10, 5);
  } else if (kind === 3) {     // sock
    arm(-18, -34, -1); arm(18, -40, 1);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-18, -86); ctx.lineTo(14, -86); ctx.lineTo(14, -36); ctx.quadraticCurveTo(40, -10, 22, 4); ctx.lineTo(-24, 4); ctx.quadraticCurveTo(-26, -20, -18, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-14, -82); ctx.lineTo(10, -82); ctx.lineTo(10, -34); ctx.quadraticCurveTo(34, -10, 20, 0); ctx.lineTo(-20, 0); ctx.quadraticCurveTo(-22, -20, -14, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF3EA5'; ctx.fillRect(-14, -80, 24, 10); ctx.fillRect(-18, -50, 28, 6);
    mvEye(-3, -62, 5, lx, ly); mvEye(6, -62, 5, lx, ly);
  } else if (kind === 4) {     // toaster that pops toast to the beat
    arm(-34, -26, -1); arm(34, -26, 1); legs(14);
    ctx.fillStyle = '#F2E3B0'; ctx.fillRect(-14 + 6, -76 - Math.max(0, Math.sin(t * 6 + ph)) * 20, 14, 30); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-8, -76 - Math.max(0, Math.sin(t * 6 + ph)) * 20, 14, 30);
    box(-30, -52, 60, 52, '#C9D2E0', 4); ctx.fillStyle = '#E8EEF8'; ctx.fillRect(-30, -52, 60, 8);
    mvEye(-12, -28, 7, lx, ly); mvEye(12, -28, 7, lx, ly);
  } else {                     // cheese wedge
    arm(-24, -24, -1); arm(24, -24, 1); legs(10);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-36, 2); ctx.lineTo(0, -66); ctx.lineTo(36, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFC93C'; ctx.beginPath(); ctx.moveTo(-30, -2); ctx.lineTo(0, -58); ctx.lineTo(30, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E09A10'; for (const h of [[-12, -18, 5], [8, -30, 4], [10, -10, 6]]) { ctx.beginPath(); ctx.arc(h[0], h[1], h[2], 0, 7); ctx.fill(); }
    mvEye(-6, -34, 5, lx, ly); mvEye(7, -34, 5, lx, ly);
  }
  ctx.restore();
}
/* a back row of dancing snacks across the whole screen (cheap: ~10 sprites). y = feet, w = wobble */
function mvAudience(y, t, w = 1, s = .85, lx = 0, ly = 0) {
  const step = 96, m = Math.ceil(OX / step);
  for (let i = -m; i < 9 + m; i++) mvFoodie(30 + i * step + (i & 1) * 14, y + ((i & 1) ? 10 : 0), s, ((i % 6) + 6) % 6, t, w, { lx, ly });
}
/* the judgmental disco ball. swings from the ceiling */
function mvBall(x, y, r, t) {
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, y - r); ctx.stroke();
  circ(x, y, r, '#cfd8ee', 4);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  const rot = t * 1.4;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const u = (i + (rot % 1)) * r / 3.1, v = j * r / 3.1; if (u * u + v * v > r * r) continue;
    ctx.fillStyle = ((i + j + (rot | 0)) & 1) ? '#fff' : '#9fb0d6'; ctx.fillRect(x + u - r / 8, y + v - r / 8, r / 4.2, r / 4.2);
  }
  ctx.restore();
  /* the unimpressed eyes */
  mvEye(x - r * .32, y + r * .05, r * .2, 0, 1); mvEye(x + r * .32, y + r * .05, r * .2, 0, 1);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - r * .52, y - r * .18); ctx.lineTo(x - r * .14, y - r * .08); ctx.moveTo(x + r * .52, y - r * .18); ctx.lineTo(x + r * .14, y - r * .08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * .2, y + r * .5); ctx.lineTo(x + r * .2, y + r * .5); ctx.stroke();
  /* light beams that sweep the room */
  ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { const a = t * 1.1 + i * 1.256; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 900 - 40, y + Math.abs(Math.sin(a)) * 900); ctx.lineTo(x + Math.cos(a) * 900 + 40, y + Math.abs(Math.sin(a)) * 900); ctx.fill(); }
  ctx.restore();
}
/* wobble the whole canvas like a fever dream: wrap draw code in mvWarp(amount, t) … ctx.restore() */
function mvWarp(a, t) {
  ctx.save(); ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.sin(t * 2.3) * .012 * a); ctx.scale(1 + Math.sin(t * 5) * .012 * a, 1 + Math.cos(t * 4.1) * .012 * a);
  ctx.translate(-W / 2, -H / 2);
}
/* big screen-flash caption, e.g. 'WHAT?!' for the weird moments. Call from draw(); life 0..1 */
function mvSlam(s, life, col = '#FFE14D', y = 300, size = 110) {
  if (life <= 0) return;
  const k = easeBackLike(1 - life);
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(Math.sin(now * 30) * .03 - .06); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, life * 4);
  txt(s, 6, 8, size, INK, 'center', 700); txt(s, 0, 0, size, col, 'center', 700); ctx.restore();
}
function easeBackLike(x) { x = Math.max(0, Math.min(1, x)); const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

/* ── the stage-intro cutscene (drawn by main.js while state === 'stagein'). st = seconds since the stage began ── */
function mvIntro(st, stage, stageIdx) {
  const clamp01 = v => Math.max(0, Math.min(1, v));
  mvWarp(1.4, now);
  mvPsy('#FF3EA5', '#E0258F', now, 1.2);
  mvBall(W / 2 + Math.sin(now * 1.3) * 120, 90 + Math.sin(now * 2) * 8, 52, now);
  mvTiles(470, now, 140);
  mvAudience(468, now, 1.5, .85, Math.sin(now * 2), .6);
  /* the title lurches in from space, one letter at a time, drunk on disco */
  const stn = t('STAGE {n}', { n: stageIdx + 1 });
  txt(stn, W / 2 - (1 - easeOut(st / .4)) * 800 + 5, 190, 56, INK, 'center', 500); txt(stn, W / 2 - (1 - easeOut(st / .4)) * 800, 186, 56, '#fff', 'center', 500);
  const name = t(stage.name); ctx.font = '900 84px "Arial Black", Impact, sans-serif';
  const tw = ctx.measureText(name).width, k = Math.min(1, 700 / tw), fs = 84 * k;
  ctx.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; let px = W / 2 - ctx.measureText(name).width / 2;
  for (let i = 0; i < name.length; i++) {
    const ch = name[i], cw = ctx.measureText(ch).width, e = easeBackLike((st - .15 - i * .05) / .45);
    if (e > 0) {
      ctx.save(); ctx.translate(px + cw / 2, 275 + Math.sin(now * 7 + i * .9) * 10 + (1 - e) * -260); ctx.rotate(Math.sin(now * 5 + i * 1.7) * .14 + (1 - e) * 3); ctx.scale(e, e);
      txt(ch, 5, 6, fs, INK, 'center'); txt(ch, 0, 0, fs, ['#FFE14D', '#5CFF7A', '#4DDFFF', '#fff'][i % 4], 'center'); ctx.restore();
    }
    px += cw;
  }
  ctx.globalAlpha = clamp01((st - .7) / .3);
  ctx.save(); ctx.translate(W / 2, 352); ctx.rotate(-.03 + Math.sin(now * 4) * .02);
  txt('CURSED DISCO. NO REFUNDS.', 0, 0, 30, '#fff', 'center', 700); ctx.restore(); ctx.globalAlpha = 1;
  /* hero: a tiny Caos, front and centre, losing his mind */
  const jb = Math.abs(Math.sin(now * 7)) * 46, e3 = easeBackLike((st - .35) / .5);
  shadow(W / 2, 540, 100 - jb * .6, 14, .35);
  ctx.save(); ctx.translate(W / 2, 536 - jb); ctx.rotate(Math.sin(now * 7) * .12); ctx.scale(e3, e3 * (1 + Math.sin(now * 14) * .06));
  caos(0, 0, 11, { col: stage.col, mood: 'happy' }); ctx.restore();
  ctx.globalAlpha = clamp01((st - .9) / .3); txt(t('{n} GAMES + BOSS', { n: stage.n }), W / 2, 580, 24, '#fff'); ctx.globalAlpha = 1;
  ctx.restore();
  /* a hot dog flies across the screen. nobody explains. */
  const fx = ((st * 420 - 120) % 1100) - 120, fy = 250 + Math.sin(st * 6) * 40;
  ctx.save(); ctx.translate(fx, fy); ctx.rotate(st * 9); mvFoodie(0, 40, 1, 0, now, 2); ctx.restore();
  vignette(.3);
}
