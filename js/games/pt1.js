'use strict';
/* PARTY microgames: MASH!, STOP!, COPY!, GRAB! - built for rooms with friends (see js/party.js).
   Everyone in a room builds the same game from the same seed (withSeed in core.js), so all the randomness is drawn once in the
   constructor from the local rng `R`; update/draw never touch Math.random for gameplay. Each game also reports `pts` (higher is
   better, used for ranking) and wins when it reaches `need`. Inputs: pointer, keyboard and touch all work.
   Each game: {cmd, hint, thint, dur, pts, update(dt), draw(t), down/move/up/key/keyup}; g.result = 'win'|'lose'
   Art follows docs/ART-STYLE.md (the DUO look): each game is a place with a gag, its UI lives in the world and the scene plays the ending. */
(function () {

const YEL = '#FFE14D', GRN = '#5CFF7A', RED = '#ff4d4d', BLU = '#4DB8FF', PNK = '#FF4D9E';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mkR = () => mulberry32(Math.floor(Math.random() * 4294967296));   // Math.random is seeded while the constructor runs
const ptWin = (x, y) => { sfx.coin(); sfx.sparkle(); confetti(x, y, 30); ring(x, y, '#fff', 110); };
const ptLose = (x, y) => { sfx.miss(); sfx.thud(); shake(8, .25); burst(x, y, RED, 14); ring(x, y, RED, 80); };

/* ───────────── drawing kit (draws on X; X is swapped to an offscreen context while baking) ───────────── */
const TAU = Math.PI * 2;
let X = null;                                                                 // set to ctx at the top of each draw()
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const rgbC = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixC = (a, b, k) => { const A = rgbC(a), B = rgbC(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only, never R
const mkCv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(base, shade, build, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function tube(build, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; build(); X.strokeStyle = INK; X.lineWidth = w + 7; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function arms(u, la, ra, k, col) {
  const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gp = .35 * u;
  const one = (sx, an) => {
    X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
    X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gp - hs - ol, hs + ol * 2, hs + ol * 2);
    X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gp - hs, hs, hs);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gp - hs, hs * .45, hs * .4); X.restore();
  };
  one(-1, la); one(1, ra);
}
function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x - k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(300, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 300); X.restore();
}
/* one badge on screen at a time: pop = {s, at, x, y, col}; pops in with outBack, fades after 0.8 s */
function drawPop(pop, size = 30) { if (!pop) return; const a = now - pop.at, sc = a < .25 ? outBack(a / .25) : 1; X.globalAlpha = clamp(1 - (a - .8) / .25, 0, 1); badge(pop.s, pop.x, pop.y, size, pop.col, pop.fg, sc, pop.rot || .07); X.globalAlpha = 1; }
function tagC(x, y, label, col, size = 13) {
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = X.measureText(t(label)).width + 16, h = size + 9;
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 2.5); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 5, y - h / 2 + 3, w - 10, 4, 2); X.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 8);
}
function keyCap(x, y, label, size = 14) {
  X.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = Math.max(size * 1.7, X.measureText(t(label)).width + 16), h = size + 10;
  rr(x - w / 2, y - h / 2 + 3, w, h, 6); ink('#b9b3c9', 2.5); rr(x - w / 2, y - h / 2, w, h, 6); ink('#fff', 2.5);
  txt(label, x, y + 1, size, INK, 'center', w - 6);
}
/* chunky control plate (hippo plate): base 9 px lower, the face drops when pressed, grey once the round is over */
function plate(x, y, w, h, col, dk, down, label, key, grey) {
  const d = down ? 3 : 9, fy = y + 9 - d;
  rr(x - w / 2, y + 9, w, h, 20); ink(grey ? '#8f88a6' : dk, 4);
  rr(x - w / 2, fy, w, h, 20); ink(grey ? '#d3cfe0' : col, 4);
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(x - w / 2 + 14, fy + 6, w - 28, 8, 4); X.fill();
  X.globalAlpha = grey ? .8 : 1; txt(label, x, fy + h / 2 - (key ? 9 : 0), key ? 24 : 28, grey ? '#f6f4fb' : '#fff', 'center', w - 24); X.globalAlpha = 1;
  if (key) keyCap(x, fy + h / 2 + 17, key, 13);
}
/* the sun (rays turn slowly) and a 4-puff cloud */
function sun(sx, sy, T) {
  X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
  for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 66); X.fill(); }
  X.restore(); X.beginPath(); X.arc(sx, sy, 30, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 9, sy - 9, 11, 7, -.6); X.fill();
}
function cloud(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); }
/* a music note (head + stem + flag) */
function note(x, y, s, col, rot = 0) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  tube(() => { X.beginPath(); X.moveTo(7, -1); X.lineTo(7, -24); X.quadraticCurveTo(17, -20, 16, -9); }, 3.5, col);
  el(0, 0, 9, 6.5, -.4); ink(col, 3); glint(-3, -2, 3, 1.6, -.4, .6);
  X.restore();
}

/* ═════════ 1 MASH: hit as often as you can; reach the goal to win, the most taps takes the round ═════════
   Art: the fair at dusk. Claude runs in a hamster wheel that powers the Ferris wheel through a little dynamo: every tap lights
   one more bulb on the Ferris wheel's rim (the rim is the progress bar) and spins both wheels. A mouse rides in one gondola.
   Win: the wheel whirls with rainbow bulbs and fireworks go off. Lose: the bulbs die, the dynamo smokes and Claude gets
   flung round the hamster wheel. */
const MS_HX = 168, MS_HY = 432, MS_HR = 86, MS_FX = 532, MS_FY = 256, MS_FR = 146, MS_GY = 404, MS_DX = 322, MS_DY = 502;
function ptMash(sp) {
  const R = mkR(), need = Math.round(13 + R() * 3 + (sp - 1) * 10);
  let taps = 0, squish = 0, last = 0;
  // art only (never touches R): outro clock, how fast the wheels turn (fed by the taps), their angles, Claude's stride, the GO ON! pop
  let rT0 = -1, spin = 0, rot = 0, hrot = 0, run = 0, pop = null;
  const g = {
    c: 0, cmd: 'MASH!', hint: 'CLICK / TAP / SPACE AS FAST AS YOU CAN!', thint: 'TAP AS FAST AS YOU CAN!', dur: 5, need, pts: 0, timeWin: false,
    update(dt) {
      g.c += dt; squish = Math.max(0, squish - dt * 7);
      if (!g.result && g.c >= g.dur) { g.result = taps >= need ? 'win' : 'lose'; (g.result === 'win' ? ptWin : ptLose)(MS_FX, MS_FY); }
      if (g.result && rT0 < 0) rT0 = now;
      const res = g.result;
      spin = res === 'win' ? Math.min(4, spin + dt * 6) : Math.max(0, spin - dt * (res ? 3 : 1.5));
      rot += spin * dt * .45; hrot += spin * dt * 2.4; run = !res && spin > .25 ? run + dt * Math.min(1.5, .45 + spin * .35) : 0;
    },
    draw() {
      X = ctx; if (!MS_BG) MS_BG = mashBg(); X.drawImage(MS_BG, 0, 0);
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0;
      mashSky(T, res, rT);
      mashFerris(T, rot, res === 'win' ? need : Math.min(taps, need), need, res, rT, taps);
      mashDynamo(T, squish, res, rT);
      mashSign(T, taps, need, res);
      mashHamster(T, hrot, run, res, rT, !res && g.c > g.dur / Math.sqrt(sp) - 1.6 && taps < need);
      drawPop(pop, 26); if (pop && now - pop.at > 1.05) pop = null;
      vignette(.16);
    },
    down() { g.tap(); },
    key(e) { if (e.repeat) return; if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; g.tap(); },
    tap() {
      if (g.result) return; taps++; g.pts = taps; squish = 1; last = g.c; sfx.blip(Math.min(18, taps)); burst(MS_DX, MS_DY - 44, YEL, 3, 160);
      spin = Math.min(3, spin + .55); if (taps === need) pop = { s: 'GO ON!', at: now, x: MS_HX + 10, y: MS_HY - MS_HR - 46, col: '#4fd06a' };
    },
  };
  return g;
}
reg('pt_mash', ptMash, 'MASH!');

/* stars twinkle; on a win three fireworks go off around the stamp */
function mashSky(T, res, rT) {
  for (let i = 0; i < 16; i++) { const x = 30 + hash(i) * 740, y = 70 + hash(i + 40) * 170, a = .35 + .35 * Math.sin(T * (1.5 + hash(i + 9) * 2) + i * 2);
    if (x > 380 && x < 690 && y > 100) continue; X.globalAlpha = a; X.fillStyle = '#fff6d0'; el(x, y, 2.2, 2.2); X.fill(); }
  X.globalAlpha = 1;
  // string of lights from the left edge to the hamster-wheel pole
  const sag = x => 166 + (x / 330) * 30 + Math.sin(x / 330 * Math.PI) * 26;
  X.strokeStyle = '#2a2040'; X.lineWidth = 2.5; X.beginPath(); for (let x = -10; x <= 330; x += 10) x === -10 ? X.moveTo(x, sag(x)) : X.lineTo(x, sag(x)); X.stroke();
  const lc = ['#FFE14D', '#ff7ab8', '#6EC3FF', '#5CFF7A'];
  for (let i = 0, x = 6; x < 330; i++, x += 26) { const on = res === 'lose' ? .25 : .6 + .4 * Math.sin(T * 4 + i * 1.7); X.fillStyle = lc[i % 4]; X.globalAlpha = on * .35; el(x, sag(x) + 6, 9, 9); X.fill(); X.globalAlpha = 1; el(x, sag(x) + 6, 4.5, 5.5); ink(lc[i % 4], 2); }
  if (res !== 'win') return;
  for (const [fx, fy, d, c] of [[252, 196, 0, '#FFE14D'], [700, 210, .22, '#ff7ab8'], [420, 120, .45, '#6EC3FF']]) {
    const k = (rT - d) / .75; if (k <= 0 || k > 1) continue;
    const r = 78 * (1 - (1 - k) * (1 - k)); X.globalAlpha = 1 - k * k;
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; X.fillStyle = i % 2 ? '#fff' : c; el(fx + Math.cos(a) * r, fy + Math.sin(a) * r + k * k * 20, 4, 4); X.fill(); }
    X.globalAlpha = 1;
  }
}
/* the Ferris wheel: rim bulbs = progress (lit < need), gondolas stay level, the mouse rides gondola 0 */
function mashFerris(T, rot, lit, need, res, rT, taps) {
  const cx = MS_FX, cy = MS_FY, Rr = MS_FR;
  for (let i = 0; i < 16; i++) { const a = rot + i * TAU / 16; tube(() => { X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + Math.cos(a) * Rr, cy + Math.sin(a) * Rr); }, 3, '#e9e1ff'); }
  for (const [r, w, c] of [[Rr - 30, 4, '#ffd6e8'], [Rr, 7, '#ff7ab8']]) { X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.strokeStyle = INK; X.lineWidth = w + 7; X.stroke(); X.strokeStyle = c; X.lineWidth = w; X.stroke(); }
  X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 2.5; X.beginPath(); X.arc(cx, cy, Rr - 1, -2.7, -1.9); X.stroke();
  // gondolas (hang level from the rim)
  const GC = ['#6EC3FF', '#FFE14D', '#5CFF7A', '#ff9a5c'];
  for (let j = 0; j < 8; j++) {
    const a = rot + j * TAU / 8 + TAU / 32, px = cx + Math.cos(a) * Rr, py = cy + Math.sin(a) * Rr, sw = Math.sin(T * 2.2 + j) * .07 + (res === 'lose' ? Math.sin(rT * 12) * .2 * Math.max(0, 1 - rT) : 0);
    X.save(); X.translate(px, py); X.rotate(sw);
    tube(() => { X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 14); }, 3, '#cfd8e6');
    if (j === 0) mashMouse(T, res, rT, lit / need);
    X.beginPath(); X.moveTo(-21, 14); X.lineTo(21, 14); X.quadraticCurveTo(23, 36, 0, 37); X.quadraticCurveTo(-23, 36, -21, 14); X.closePath(); ink(GC[j % 4], 3.5);
    X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(-18, 24, 36, 4); glint(-11, 19, 6, 2.5, -.2, .5);
    X.restore();
  }
  // the bulbs on the rim
  for (let i = 0; i < need; i++) {
    const a = -Math.PI / 2 + rot + i * TAU / need, x = cx + Math.cos(a) * Rr, y = cy + Math.sin(a) * Rr, on = i < lit;
    let col = on ? '#FFE14D' : '#5a5070';
    if (res === 'win') col = `hsl(${(i * 30 + T * 500) % 360},100%,66%)`; else if (res === 'lose') col = rT > i * .03 ? '#3b3550' : col;
    if (col !== '#5a5070' && col !== '#3b3550') { X.fillStyle = 'rgba(255,232,130,.3)'; el(x, y, 15, 15); X.fill(); }
    X.beginPath(); X.arc(x, y, 7.5, 0, TAU); ink(col, 2.5); if (col !== '#5a5070' && col !== '#3b3550') glint(x - 2.5, y - 2.5, 2.8, 1.6, -.5, .85);
  }
  X.beginPath(); X.arc(cx, cy, 21, 0, TAU); ink('#ffd23f', 4); X.beginPath(); X.arc(cx, cy, 8, 0, TAU); ink('#c99512', 2.5); glint(cx - 7, cy - 8, 6, 3, -.6, .6);
  if (taps > need && res !== 'lose') { const k = (T * 3) % 1; X.globalAlpha = 1 - k; X.beginPath(); X.arc(cx, cy, Rr + 10 + k * 18, 0, TAU); X.strokeStyle = '#FFE14D'; X.lineWidth = 3; X.stroke(); X.globalAlpha = 1; }
}
/* the mouse in gondola 0: excited while the bulbs light, cheers on a win, clings and shakes when the wheel dies */
function mashMouse(T, res, rT, k) {
  const scared = res === 'lose', y = 6 - (res === 'win' ? Math.abs(Math.sin(rT * 10)) * 5 : 0), sh = scared ? Math.sin(T * 40) * 1.2 : 0;
  X.save(); X.translate(sh, y);
  if (res === 'win' || k > .7) for (const s of [-1, 1]) tube(() => { X.beginPath(); X.moveTo(s * 7, 8); X.lineTo(s * 15, -4 - Math.sin(T * 12 + s) * 3); }, 3, '#c9c3d9');
  for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 9, -4, 7, 0, TAU); ink('#c9c3d9', 2.5); X.fillStyle = '#ff9fc0'; el(s * 9, -4, 3.5, 3.5); X.fill(); }
  el(0, 4, 10, 9); ink('#c9c3d9', 2.5);
  if (res === 'win') { X.strokeStyle = INK; X.lineWidth = 2; for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 4, 3, 2.2, Math.PI, 0); X.stroke(); } }
  else { const r = scared ? 3 : 2.4; X.fillStyle = '#fff'; for (const s of [-1, 1]) { el(s * 4, 2, r, r + .4); X.fill(); } X.fillStyle = INK; for (const s of [-1, 1]) { el(s * 4 + .5, 2.4, 1.3, 1.5); X.fill(); } }
  X.fillStyle = '#ff7a9a'; el(0, 7.5, 2, 1.6); X.fill();
  if (scared) sweat(12, -6, .6, T);
  X.restore();
}
/* the dynamo between the wheels: its bulb flashes on every tap; on a lose it sparks and smokes */
function mashDynamo(T, squish, res, rT) {
  const x = MS_DX, y = MS_DY;
  cel('#8f9cb3', '#6d7a92', () => rr(x - 28, y - 32, 56, 36, 9), 6, 0, 4); glint(x - 14, y - 26, 9, 3, -.2, .5);
  for (const s of [-1, 1]) { X.beginPath(); X.arc(x + s * 18, y - 14, 3, 0, TAU); ink('#cfd8e6', 1.5); }
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x - 6, y - 20); X.lineTo(x + 2, y - 14); X.lineTo(x - 3, y - 12); X.lineTo(x + 6, y - 6); X.stroke();
  const glow = res === 'lose' ? 0 : res === 'win' ? .7 + .3 * Math.sin(T * 20) : squish;
  rr(x - 7, y - 40, 14, 9, 3); ink('#cfd8e6', 2.5);
  if (glow > .15) { X.fillStyle = `rgba(255,232,120,${glow * .45})`; el(x, y - 50, 22, 22); X.fill(); }
  el(x, y - 50, 10, 12); ink(mixC('#6a6080', '#FFE14D', glow), 2.5); glint(x - 3, y - 54, 3, 2, -.5, .7);
  if (res === 'lose') {
    for (let i = 0; i < 4; i++) { const k = ((rT * .9 + i * .25) % 1); X.globalAlpha = (1 - k) * .8; el(x + Math.sin(i * 2.3 + k * 3) * 10, y - 62 - k * 60, 9 + k * 12, 7 + k * 9); ink('#8a8398', 2); }
    X.globalAlpha = 1; if (rT < .5) star(x + 10, y - 44, 18 * (1 - rT), 7, 8, T * 9, '#FFE14D', 2.5);
  }
}
/* the count, on a little wooden board under the Ferris wheel */
function mashSign(T, taps, need, res) {
  const x = MS_FX, y = 470;
  rr(x - 70, y + 5, 140, 40, 13); ink('#a5622c', 4); rr(x - 70, y, 140, 40, 13); ink('#d9944f', 4);
  X.fillStyle = 'rgba(255,255,255,.22)'; rr(x - 60, y + 4, 120, 5, 2.5); X.fill();
  const col = res === 'lose' ? '#ff8a96' : taps >= need ? GRN : YEL;
  txt(`${taps} / ${need}`, x, y + 21, 24, col, 'center', 124);
}
/* the hamster wheel with Claude running in it */
function mashHamster(T, hrot, run, res, rT, tired) {
  const cx = MS_HX, cy = MS_HY, r = MS_HR, won = res === 'win', lost = res === 'lose', U = 5;
  X.beginPath(); X.arc(cx, cy, r - 6, 0, TAU); X.fillStyle = 'rgba(255,255,255,.08)'; X.fill();
  for (let i = 0; i < 8; i++) { const a = hrot + i * TAU / 8; tube(() => { X.beginPath(); X.moveTo(cx, cy); X.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); }, 2.5, '#9fc6e6'); }
  X.beginPath(); X.arc(cx, cy, r - 6, 0, TAU); X.strokeStyle = INK; X.lineWidth = 8; X.stroke(); X.strokeStyle = '#7aa7c9'; X.lineWidth = 3; X.stroke();
  X.beginPath(); X.arc(cx, cy, 11, 0, TAU); ink('#cfd8e6', 3);
  // Claude: runs at the bottom; on a win it hops, on a lose the dying wheel carries it up the side and it tumbles back
  const fl = lost ? Math.sin(clamp(rT / .75, 0, 1) * Math.PI) * 1.35 : 0, hop = won ? Math.abs(Math.sin(rT * 9)) * 14 : 0;
  X.save(); X.translate(cx, cy); X.rotate(fl); X.translate(0, r - 14 - hop); X.rotate(run && !res ? .1 : 0);
  const sw = Math.sin(run * 16);
  const la = won ? -2.6 + Math.sin(rT * 14) * .2 : lost ? -.9 : -.75 + sw * .55, ra = won ? 2.6 - Math.sin(rT * 14) * .2 : lost ? .9 : .75 - sw * .55;
  arms(U, la, ra, 1.1, OR);
  claude(0, 0, U, { mood: won ? 'happy' : lost ? 'sad' : null, run: run > 0 ? run : null });
  X.restore();
  if (lost && rT > .3) { const k = rT * 4; for (let i = 0; i < 3; i++) star(cx + Math.cos(k + i * 2.1) * 30, cy + r - 72 + Math.sin(k + i * 2.1) * 8, 8, 3.5, 5, T * 3, '#FFE14D', 2.5); }
  if (tired || lost) sweat(cx - 34, cy + r - 62, 1, T);
  // the running rim in front, with its rungs
  X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.strokeStyle = INK; X.lineWidth = 15; X.stroke(); X.strokeStyle = '#bfe3ff'; X.lineWidth = 8; X.stroke();
  X.strokeStyle = '#6f9fc4'; X.lineWidth = 2.5; for (let i = 0; i < 22; i++) { const a = hrot + i * TAU / 22; X.beginPath(); X.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3)); X.lineTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); X.stroke(); }
  X.strokeStyle = 'rgba(255,255,255,.65)'; X.lineWidth = 3; X.beginPath(); X.arc(cx, cy, r, -2.7, -1.95); X.stroke();
  tagC(cx, cy - r - 16, 'YOU', YEL, 12);
}
/* the baked fairground: dusk sky, moon, hills, a big top, a popcorn stand, grass, both wheels' frames and the cables */
let MS_BG = null;
function mashBg() {
  const cv = mkCv(), old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, MS_GY); gr.addColorStop(0, '#22225e'); gr.addColorStop(.45, '#5c4396'); gr.addColorStop(.8, '#d9819a'); gr.addColorStop(1, '#ffc48a'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
  X.fillStyle = 'rgba(255,243,176,.1)'; el(712, 136, 50, 50); X.fill(); el(712, 136, 38, 38); X.fill();
  X.beginPath(); X.arc(712, 136, 26, 0, TAU); ink('#fff3b0', 3); X.fillStyle = '#efe0a0'; el(704, 142, 6, 5); X.fill(); el(720, 128, 4, 3.5); X.fill();
  X.fillStyle = '#6b4f9c'; X.beginPath(); X.moveTo(0, MS_GY); for (let x = 0; x <= W; x += 20) X.lineTo(x, 330 - Math.sin(x * .009 + 1) * 26 - Math.sin(x * .023) * 8); X.lineTo(W, MS_GY); X.closePath(); X.fill(); X.strokeStyle = '#523b80'; X.lineWidth = 3; X.stroke();
  X.fillStyle = '#7b5aa8'; X.beginPath(); X.moveTo(0, MS_GY); for (let x = 0; x <= W; x += 20) X.lineTo(x, 362 - Math.sin(x * .013 + 3) * 14); X.lineTo(W, MS_GY); X.closePath(); X.fill(); X.strokeStyle = '#5f4590'; X.lineWidth = 3; X.stroke();
  // the big top (right) with its pennant
  X.save(); X.beginPath(); X.moveTo(640, MS_GY); X.lineTo(650, 336); X.quadraticCurveTo(720, 300, 735, 262); X.quadraticCurveTo(752, 300, 820, 336); X.lineTo(830, MS_GY); X.closePath(); ink('#fff6e6', 4); X.clip();
  X.fillStyle = '#ff5d5d'; for (let i = -3; i < 8; i++) { X.beginPath(); X.moveTo(735, 262); X.lineTo(640 + i * 30, MS_GY); X.lineTo(655 + i * 30, MS_GY); X.closePath(); X.fill(); } X.restore();
  X.beginPath(); X.moveTo(640, MS_GY); X.lineTo(650, 336); X.quadraticCurveTo(720, 300, 735, 262); X.quadraticCurveTo(752, 300, 820, 336); X.lineTo(830, MS_GY); X.strokeStyle = INK; X.lineWidth = 4; X.stroke();
  rr(717, 364, 36, 40, 14); ink('#3b2a55', 3);
  tube(() => { X.beginPath(); X.moveTo(735, 262); X.lineTo(735, 236); }, 2.5, '#e6c58c'); X.beginPath(); X.moveTo(737, 236); X.lineTo(760, 242); X.lineTo(737, 249); X.closePath(); ink('#FFE14D', 2.5);
  // the ground
  gr = X.createLinearGradient(0, MS_GY, 0, H); gr.addColorStop(0, '#4f8a5f'); gr.addColorStop(1, '#2f5a42'); X.fillStyle = gr; X.fillRect(0, MS_GY, W, H - MS_GY);
  X.fillStyle = 'rgba(255,255,255,.06)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, H); X.lineTo(i * 90 + 45, H); X.lineTo(i * 90 + 145, MS_GY); X.lineTo(i * 90 + 100, MS_GY); X.fill(); }
  X.fillStyle = '#b69a7a'; X.beginPath(); X.moveTo(300, H); X.quadraticCurveTo(420, 470, 470, MS_GY); X.lineTo(600, MS_GY); X.quadraticCurveTo(620, 470, 760, H); X.closePath(); X.fill();
  X.fillStyle = 'rgba(255,255,255,.12)'; X.beginPath(); X.moveTo(380, H); X.quadraticCurveTo(470, 470, 520, MS_GY); X.lineTo(545, MS_GY); X.quadraticCurveTo(540, 470, 470, H); X.fill();
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, MS_GY); X.lineTo(W, MS_GY); X.stroke();
  for (const [tx, ty] of [[40, 560], [280, 452], [740, 470], [640, 556], [96, 424]]) { X.strokeStyle = '#2a5a35'; X.lineWidth = 3; X.lineCap = 'round'; for (const d of [-6, 0, 6]) { X.beginPath(); X.moveTo(tx + d * .5, ty); X.lineTo(tx + d, ty - 10 - (d ? 0 : 4)); X.stroke(); } }
  // the popcorn stand (left, behind the hamster wheel)
  rr(4, 300, 96, 104, 6); ink('#ff9a5c', 4); X.fillStyle = '#e07a3c'; X.fillRect(4, 300, 96, 10);
  for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(-2 + i * 26, 300); X.lineTo(24 + i * 26, 300); X.lineTo(24 + i * 26, 318); X.arc(11 + i * 26, 318, 13, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff6e6' : '#5c8bff', 3); }
  rr(20, 330, 64, 40, 8); ink('#3d5a80', 3.5); for (let i = 0; i < 14; i++) { X.fillStyle = '#fff6d0'; el(28 + hash(i + 70) * 48, 352 + hash(i + 90) * 14, 5, 4); X.fill(); }
  // Ferris wheel A-frame (behind the wheel) and its platform
  for (const s of [-1, 1]) tube(() => { X.beginPath(); X.moveTo(MS_FX, MS_FY); X.lineTo(MS_FX + s * 92, 486); }, 11, '#cfd8e6');
  tube(() => { X.beginPath(); X.moveTo(MS_FX - 60, 410); X.lineTo(MS_FX + 60, 410); }, 6, '#cfd8e6');
  rr(MS_FX - 122, 480, 244, 18, 6); ink('#8a5530', 4); X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(MS_FX - 112, 484, 224, 3);
  // hamster wheel stand
  for (const s of [-1, 1]) tube(() => { X.beginPath(); X.moveTo(MS_HX, MS_HY); X.lineTo(MS_HX + s * 60, 532); }, 9, '#8f9cb3');
  rr(MS_HX - 80, 526, 160, 12, 5); ink('#6d7a92', 3);
  // the belt to the dynamo and the cable to the Ferris wheel
  tube(() => { X.beginPath(); X.moveTo(MS_HX, MS_HY); X.lineTo(MS_DX - 10, MS_DY - 18); }, 4, '#3b3550');
  tube(() => { X.beginPath(); X.moveTo(MS_DX + 26, MS_DY - 4); X.quadraticCurveTo(370, 528, MS_FX - 118, 494); }, 4, '#3b3550');
  X = old; return cv;
}

/* ═════════ 2 STOP: a needle swings back and forth; stop it inside the zone. Closer to the middle of the zone = more points ═════════
   Art: an ice-cream stand on the seaside boardwalk. The needle is a scoop dispenser that runs along an overhead rail; the zone
   is the green stretch of rail right above Claude, who holds a cone up. Tap and the scoop drops; the score shows on a bulb
   marquee on the rail. A dog sits by, hoping. Win: Claude steps under the scoop and catches it (the dog sulks).
   Lose: the scoop splats on the boards and the dog runs over to lick it up. */
const ST_RY = 112, ST_FEET = 530, ST_U = 5.4;
function ptSync(sp) {
  const R = mkR(), spd = (2.1 + R() * .5) * (.9 + sp * .1), ph = R() * 6.28, zc = .2 + R() * .6, zw = .13 - Math.min(.04, (sp - 1) * .1);
  const X0 = 90, X1 = 710, Y = 330, pos = c => .5 + .5 * Math.sin(spd * c + ph);
  let stopAt = -1, stopPos = 0, acc = 0;
  // art only (never touches R): outro clock, where the scoop drops, the feedback badge
  const cx = X0 + (X1 - X0) * zc, side = cx < 400 ? -1 : 1;                   // the cone sits under the zone centre; the dog on the outer side
  let rT0 = -1, dropX = -1, pop = null;
  const g = {
    c: 0, cmd: 'STOP!', hint: 'CLICK / TAP / SPACE TO STOP THE NEEDLE IN THE ZONE', thint: 'TAP TO STOP THE NEEDLE IN THE ZONE', dur: 5, need: 40, pts: 0,
    update(dt) {
      g.c += dt;
      if (!g.result && g.c >= g.dur) { g.result = 'lose'; ptLose(400, 330); }
      if (g.result && rT0 < 0) { rT0 = now; if (dropX < 0) dropX = X0 + (X1 - X0) * pos(g.c); }
    },
    stop() {
      if (g.result || g.c < .12) return;
      stopAt = g.c; stopPos = pos(g.c); const d = Math.abs(stopPos - zc);
      acc = Math.max(0, Math.round(100 * (1 - d / (zw * 1.6)))); g.pts = acc; sfx.stamp();
      const x = X0 + (X1 - X0) * stopPos;
      dropX = x; rT0 = now;
      const px = x < 400 ? 610 : 190;                                         // in the sky, away from the dispenser and the stamp
      if (acc >= g.need) { g.result = 'win'; ptWin(x, 300); pop = { s: acc >= 90 ? 'PERFECT!' : acc >= 70 ? 'GREAT!' : 'NICE!', at: now + .2, x: px, y: 160, col: '#4fd06a' }; }
      else { g.result = 'lose'; ptLose(x, 300); pop = { s: 'MISSED!', at: now + .2, x: px, y: 160, col: '#ff4d5e' }; }
    },
    draw() {
      X = ctx; if (!ST_BG) ST_BG = stopBg(); X.drawImage(ST_BG, 0, 0);
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0, won = res === 'win', lost = res === 'lose';
      stopSky(T);
      // the zone: the green stretch of rail, with a white notch at its centre
      const zx = X0 + (X1 - X0) * (zc - zw), zww = (X1 - X0) * zw * 2;
      rr(zx, ST_RY - 3, zww, 20, 10); ink(lost ? '#a9b8a9' : GRN, 3); X.fillStyle = 'rgba(255,255,255,.45)'; rr(zx + 8, ST_RY, zww - 16, 4, 2); X.fill();
      rr(cx - 3.5, ST_RY - 8, 7, 30, 3.5); ink('#fff', 2);
      stopMarquee(T, stopAt >= 0 ? acc : -1, res);
      const p = stopAt >= 0 ? stopPos : res ? (dropX - X0) / (X1 - X0) : pos(g.c), nx = X0 + (X1 - X0) * p;
      const sway = res ? Math.cos(spd * (stopAt >= 0 ? stopAt : g.c) + ph) * .07 * Math.max(0, 1 - rT * 2.5) * Math.cos(rT * 20) : Math.cos(spd * g.c + ph) * .07;
      // where the cone ends up: on a win Claude steps under the scoop; on a lose it lunges, too short
      const reach = won ? nx - cx : lost && stopAt >= 0 ? clamp(nx - cx, -30, 30) : 0, coneX = cx + reach * ease(rT / .3);
      const fall = res ? clamp(rT, 0, 1) : -1, sy0 = 228, landY = won ? 404 : 522, fy = sy0 + 1300 * fall * fall, landed = res && fy >= landY;
      const landAt = res ? Math.sqrt((landY - sy0) / 1300) : 9;
      // the dog: watches the dispenser; on a lose it runs to the splat and licks; on a win it sulks
      const dx0 = cx + side * 112, splatSide = Math.sign(nx - dx0) || 1;
      const dogRun = lost && rT > landAt ? ease((rT - landAt) / .25) : 0, dogX = dx0 + (nx - splatSide * 44 - dx0) * dogRun;
      const dogFace = dogRun > 0 ? splatSide : -side;
      if (lost && landed) stopSplat(nx, rT - landAt);
      stopDog(dogX, ST_FEET, dogFace, T, won && landed ? 'sad' : lost && landed ? 'happy' : null, clamp((nx - dogX) / 300, -1, 1) * dogFace, dogRun >= 1 ? Math.abs(Math.sin(T * 14)) * 5 : -1);
      stopClaude(coneX, T, res, rT, won && landed, !res && g.c > g.dur / Math.sqrt(sp) - 1.6);
      stopDispenser(nx, T, sway, !res);
      if (res && !landed) stopScoop(nx, fy, 1, 0);
      if (won && landed) stopScoop(coneX, landY, 1, Math.sin(Math.max(0, rT - landAt) * 26) * .15 * Math.max(0, 1 - (rT - landAt) * 3));
      plate(cx < 400 ? 688 : 112, 462, 168, 64, '#ff4d5e', '#b8283a', stopAt >= 0 && rT < .14, res ? (won ? 'YUM!' : 'SPLAT!') : TOUCH ? 'TAP!' : 'STOP!', !TOUCH && !res ? 'SPACE' : null, !!res);
      if (pop && now >= pop.at) drawPop(pop, 26);
      vignette(.16);
    },
    down() { g.stop(); },
    key(e) { if (e.repeat) return; if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') g.stop(); },
  };
  return g;
}
reg('pt_sync', ptSync, 'STOP!');

/* sun, drifting clouds, sea glints and a gull gliding over the water */
function stopSky(T) {
  sun(132, 196, T);
  cloud(((T * 8 + 300) % 1000) - 140, 186, .7); cloud(((T * 5 + 760) % 1000) - 140, 232, .55);
  X.strokeStyle = 'rgba(255,255,255,.75)'; X.lineWidth = 2.5; X.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const x = ((hash(i) * 800 + T * (12 + i * 3)) % 840) - 20, y = 312 + hash(i + 20) * 40, w = 10 + hash(i + 5) * 14, a = .5 + .5 * Math.sin(T * 3 + i);
    X.globalAlpha = a; X.beginPath(); X.moveTo(x, y); X.lineTo(x + w, y); X.stroke(); }
  X.globalAlpha = 1;
  const gx = ((T * 46 + 200) % 1040) - 120, gy = 262 + Math.sin(T * 1.6) * 8, f = Math.sin(T * 7) * 5;
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(gx - 14, gy - 2 + f); X.quadraticCurveTo(gx - 6, gy - 8, gx, gy); X.quadraticCurveTo(gx + 6, gy - 8, gx + 14, gy - 2 + f); X.stroke();
}
/* the bulb marquee on the rail: shows the score (-- before the drop); rainbow on a win, dead red bulbs on a lose */
function stopMarquee(T, acc, res) {
  const x = 400, y = 62, w = 132, h = 42;
  for (const s of [-1, 1]) tube(() => { X.beginPath(); X.moveTo(x + s * 40, y + h); X.lineTo(x + s * 40, ST_RY); }, 4, '#cfd8e6');
  rr(x - w / 2, y + 5, w, h, 14); ink('#b8283a', 4); rr(x - w / 2, y, w, h, 14); ink('#ff4d5e', 4);
  rr(x - w / 2 + 14, y + 8, w - 28, h - 16, 8); ink('#2b2140', 3);
  for (let i = 0; i < 12; i++) {
    const a = i / 12, bx = a < .5 ? x - w / 2 + 8 + (w - 16) * (a * 2) : x + w / 2 - 8 - (w - 16) * ((a - .5) * 2), by = a < .5 ? y + 5 : y + h - 5;
    const on = res === 'win' ? 1 : res === 'lose' ? 0 : (Math.floor(T * 8) + i) % 3 === 0;
    X.beginPath(); X.arc(bx, by, 3.6, 0, TAU); ink(res === 'win' ? `hsl(${(i * 30 + T * 600) % 360},100%,65%)` : res === 'lose' ? '#7a2a3a' : on ? '#FFE14D' : '#a8424f', 1.5);
  }
  const s = acc < 0 ? '--' : String(acc);
  txt(s, x, y + h / 2 + 1, 22, acc < 0 ? '#c9c3d9' : res === 'win' ? GRN : '#ff8a96', 'center', w - 34);
}
/* the dispenser: trolley on the rail, a pink tank with a window of flavours, a nozzle, the scoop waiting under it */
function stopDispenser(x, T, sway, loaded) {
  for (const wx of [x - 16, x + 16]) { X.beginPath(); X.arc(wx, ST_RY - 7, 7, 0, TAU); ink('#8f9cb3', 3); X.fillStyle = INK; el(wx, ST_RY - 7, 2, 2); X.fill(); }
  X.save(); X.translate(x, ST_RY + 6); X.rotate(sway);
  rr(-7, -6, 14, 26, 4); ink('#cfd8e6', 3);
  cel('#ff8ab3', '#d9578f', () => rr(-38, 18, 76, 60, 16), 7, 0, 4); glint(-20, 26, 12, 4, -.2, .55);
  rr(-24, 30, 48, 24, 9); ink('#fff6e6', 3);
  for (const [fx, c] of [[-12, '#9ff0c8'], [0, '#ffd9a0'], [12, '#ff9fc0']]) { el(fx, 44, 7, 6); ink(c, 1.5); }
  X.beginPath(); X.moveTo(-18, 76); X.lineTo(18, 76); X.lineTo(9, 98); X.lineTo(-9, 98); X.closePath(); ink('#cfd8e6', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-12, 80, 4, 12);
  X.restore();
  if (loaded) stopScoop(x + Math.sin(sway) * -100, 228, 1, sway);
}
/* a scoop of mint ice cream with sprinkles and drips */
function stopScoop(x, y, s, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(s, s);
  const body = () => { X.beginPath(); X.arc(0, -2, 19, Math.PI * .95, Math.PI * 2.05); X.quadraticCurveTo(20, 10, 12, 12); X.quadraticCurveTo(8, 18, 4, 12); X.quadraticCurveTo(-4, 14, -9, 11); X.quadraticCurveTo(-14, 16, -16, 9); X.quadraticCurveTo(-21, 6, -19, 0); X.closePath(); };
  cel('#9ff0c8', '#62c79a', body, 5, -4, 3.5); glint(-7, -10, 6, 3.5, -.5, .7);
  for (const [a, b, c] of [[-6, -4, '#ff5d5d'], [5, -9, '#FFE14D'], [9, 0, '#6EC3FF'], [-1, 4, '#ff7ab8']]) { X.save(); X.translate(a, b); X.rotate(a); X.fillStyle = c; X.fillRect(-3, -1, 6, 2.4); X.restore(); }
  X.restore();
}
function stopSplat(x, a) {
  const k = clamp(a / .12, 0, 1), sq = 1 - k;
  el(x, ST_FEET - 2, 20 + 22 * k, 6 + 4 * k); ink('#9ff0c8', 3);
  for (const s of [-1, 1]) { el(x + s * (30 + 12 * k), ST_FEET - 4, 6 * k, 3 * k); ink('#9ff0c8', 2); }
  el(x, ST_FEET - 10 + sq * 6, 18 - 4 * k, 10 + sq * 6); ink('#9ff0c8', 3); glint(x - 6, ST_FEET - 14, 5, 2.5, -.3, .6);
}
/* Claude holding the cone up in its right hand; it hops on a catch, slumps on a miss */
function stopClaude(coneX, T, res, rT, caught, late) {
  const won = res === 'win', lost = res === 'lose', U = ST_U, x = coneX - 6.6 * U;
  const hop = caught ? Math.abs(Math.sin(rT * 9)) * 14 : 0;
  shadow(x, ST_FEET + 2, 46 - hop * .6, 10, .28);
  X.save(); X.translate(x, ST_FEET - hop); X.rotate(lost ? -.06 : 0);
  arms(U, won ? -.6 - Math.sin(rT * 14) * .25 : lost ? -2.5 : -.5 + Math.sin(T * 3) * .08, 0, 1.45, OR);
  claude(0, 0, U, { mood: won ? 'happy' : lost ? 'sad' : null });
  X.restore();
  if (late || lost) sweat(x - U * 7.4, ST_FEET - hop - U * 8, 1, T);
  // the cone (in the raised fist)
  const tipY = ST_FEET - hop - 64, rimY = tipY - 50;
  X.save(); X.translate(coneX, 0);
  const cone = () => { X.beginPath(); X.moveTo(0, tipY + 4); X.lineTo(-21, rimY); X.lineTo(21, rimY); X.closePath(); };
  cel('#e3ac66', '#b98042', cone, 5, 0, 3.5);
  X.save(); cone(); X.clip(); X.strokeStyle = '#b98042'; X.lineWidth = 2; for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(i * 10 - 20, rimY); X.lineTo(i * 10 + 20, tipY); X.stroke(); X.beginPath(); X.moveTo(i * 10 + 20, rimY); X.lineTo(i * 10 - 20, tipY); X.stroke(); } X.restore();
  rr(-24, rimY - 5, 48, 9, 4.5); ink('#f7d297', 3);
  X.restore();
  tagC(x - 6.6 * U - 8, ST_FEET - 72 - hop, 'YOU', YEL, 12);
}
/* the dog: sits and watches the scoop; tongue out while it waits; licks the splat (lick = tongue bob) or sulks */
function stopDog(x, y, face, T, mood, look, lick) {
  X.save(); X.translate(x, y); X.scale(face * 1.1, 1.1);
  shadow(0, 2, 30, 7, .25);
  const sad = mood === 'sad', wag = sad ? 0 : Math.sin(T * (mood === 'happy' ? 24 : 12)) * .45;
  X.save(); X.translate(-20, -12); X.rotate(-.9 + wag); tube(() => { X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(-8, -12, -3, -24); }, 6, '#e0a868'); X.restore();
  cel('#e0a868', '#b97a46', () => el(-4, -22 + (sad ? 6 : 0), 23, sad ? 16 : 22), 5, 0, 3.5);
  X.fillStyle = '#f7d6a8'; el(4, -18 + (sad ? 6 : 0), 9, 12); X.fill();
  for (const lx of [-2, 10]) { rr(lx - 5, -16 + (sad ? 6 : 0), 10, 16 - (sad ? 6 : 0), 5); ink('#e0a868', 3); }
  const hy = sad ? -26 : -46, tilt = sad ? .35 : clamp(-look * .5, -.5, .3);
  X.save(); X.translate(10, hy); X.rotate(tilt);
  el(-8, -6, 7, 13, .5); ink('#8a5530', 3);
  el(0, 0, 17, 15); ink('#e0a868', 3.5); glint(-6, -6, 5, 3, -.5, .45);
  el(14, 5, 11, 8); ink('#f7d6a8', 3); X.fillStyle = INK; el(23, 2, 4.5, 3.5); X.fill(); glint(22, 1, 1.5, 1, 0, .8);
  if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.arc(5, -3, 3.4, Math.PI, 0); X.stroke(); }
  else { X.fillStyle = '#fff'; el(5, -3, 4.2, 4.8); X.fill(); X.strokeStyle = INK; X.lineWidth = 1.6; X.stroke(); X.fillStyle = INK; el(6.4, -4 - (sad ? -1 : 1), 2.3, 2.6); X.fill(); X.fillStyle = '#fff'; el(5.6, -5, .9, .9); X.fill(); }
  if (sad) { X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(0, -11); X.lineTo(9, -8); X.stroke(); }
  if (lick >= 0 || mood !== 'sad') { el(15, 13 + (lick >= 0 ? lick : Math.sin(T * 8) * 1.2), 4, 6); ink('#ff7a9a', 2); }
  X.save(); X.translate(-3, 1); X.rotate(sad ? .5 : .15 + Math.sin(T * 5) * .05); el(0, 8, 6, 13); ink('#8a5530', 3); X.restore();
  X.restore();
  X.restore();
}
/* the baked boardwalk: sky, sea, beach, the ice-cream kiosk, a palm, the railing, planks and the rail gantry */
let ST_BG = null;
function stopBg() {
  const cv = mkCv(), old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(560, 300); X.quadraticCurveTo(640, 262, 720, 280); X.quadraticCurveTo(780, 270, 820, 300); X.closePath(); X.fill();
  gr = X.createLinearGradient(0, 300, 0, 362); gr.addColorStop(0, '#62d3f0'); gr.addColorStop(1, '#2a8fcb'); X.fillStyle = gr; X.fillRect(0, 300, W, 62);
  X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 5; X.beginPath(); for (let x = 0; x <= W; x += 10) X.lineTo(x, 360 + Math.sin(x * .05) * 2); X.stroke();
  X.fillStyle = '#f4d998'; X.fillRect(0, 362, W, 34); X.fillStyle = 'rgba(200,150,80,.25)'; for (let i = 0; i < 30; i++) { el(hash(i) * 800, 368 + hash(i + 3) * 24, 3, 1.5); X.fill(); }
  // palm (right)
  tube(() => { X.beginPath(); X.moveTo(706, 396); X.quadraticCurveTo(690, 300, 716, 214); }, 13, '#b97a46');
  X.strokeStyle = '#8a5530'; X.lineWidth = 2; for (let y = 230; y < 390; y += 16) { X.beginPath(); X.moveTo(698 + (390 - y) * .02, y); X.lineTo(712 + (390 - y) * .02, y + 5); X.stroke(); }
  for (const [a, l] of [[-2.7, 70], [-2.2, 60], [-1.3, 56], [-.6, 66], [-.1, 62], [2.9, 54]]) { X.save(); X.translate(716, 212); X.rotate(a); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(l * .5, -18, l, 8); X.quadraticCurveTo(l * .5, -4, 0, 0); ink('#3fb260', 3); X.restore(); }
  for (const [a, b] of [[-6, 4], [6, 6]]) { X.beginPath(); X.arc(716 + a, 216 + b, 7, 0, TAU); ink('#8a5530', 2.5); }
  // the kiosk (centre back)
  rr(280, 246, 240, 150, 6); ink('#fff6e6', 4); X.fillStyle = '#f0e2c8'; X.fillRect(280, 246, 240, 10);
  rr(300, 296, 200, 60, 8); ink('#3d5a80', 3.5); X.fillStyle = 'rgba(255,255,255,.3)'; X.beginPath(); X.moveTo(312, 352); X.lineTo(340, 300); X.lineTo(356, 300); X.lineTo(328, 352); X.fill();
  for (const [tx, c] of [[330, '#9ff0c8'], [370, '#ffd9a0'], [410, '#ff9fc0'], [450, '#c9a0ff']]) { rr(tx - 16, 334, 32, 18, 5); ink('#cfd8e6', 2.5); el(tx, 334, 13, 7); ink(c, 2); }
  rr(286, 356, 228, 40, 6); ink('#ff8ab3', 4); X.fillStyle = '#d9578f'; X.fillRect(286, 386, 228, 10);
  for (let i = 0; i < 10; i++) { X.beginPath(); X.moveTo(272 + i * 26, 250); X.lineTo(298 + i * 26, 250); X.lineTo(298 + i * 26, 270); X.arc(285 + i * 26, 270, 13, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff6e6' : '#ff7ab8', 3); }
  // the giant cone on the kiosk roof
  X.beginPath(); X.moveTo(400, 250); X.lineTo(380, 212); X.lineTo(420, 212); X.closePath(); ink('#e3ac66', 3.5);
  el(400, 200, 22, 17); ink('#ff9fc0', 3.5); glint(392, 193, 7, 3.5, -.5, .6); rr(376, 207, 48, 9, 4.5); ink('#f7d297', 3);
  // railing between the boardwalk and the beach
  X.strokeStyle = INK; X.lineWidth = 4; for (let x = 10; x < W; x += 56) { rr(x - 4, 372, 8, 30, 3); ink('#fff6e6', 2.5); }
  rr(-4, 368, W + 8, 9, 4); ink('#fff6e6', 3);
  // the boardwalk planks
  gr = X.createLinearGradient(0, 400, 0, H); gr.addColorStop(0, '#d9a066'); gr.addColorStop(1, '#a8703e'); X.fillStyle = gr; X.fillRect(0, 400, W, 200);
  X.strokeStyle = 'rgba(110,60,25,.35)'; X.lineWidth = 2; for (let y = 412, hh = 12; y < H; y += hh, hh *= 1.25) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let r = 0, y = 400, hh = 12; y < H; r++, y += hh, hh *= 1.25) for (let x = (r % 2) * 70 + 20; x < W; x += 140 + r * 20) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + hh); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 400); X.lineTo(W, 400); X.stroke();
  // the rail gantry: two striped posts and the beam (the dispenser runs on top of it)
  for (const px of [40, 760]) { cel('#fff6e6', '#d8ccb4', () => rr(px - 10, ST_RY, 20, 316, 6), 5, 0, 3.5); X.save(); rr(px - 10, ST_RY, 20, 316, 6); X.clip(); X.fillStyle = '#ff7ab8'; for (let y = ST_RY; y < 440; y += 34) { X.beginPath(); X.moveTo(px - 12, y); X.lineTo(px + 12, y + 12); X.lineTo(px + 12, y + 24); X.lineTo(px - 12, y + 12); X.fill(); } X.restore(); rr(px - 16, 420, 32, 12, 4); ink('#d8ccb4', 3); }
  rr(22, ST_RY - 2, 756, 16, 8); ink('#cfd8e6', 4); X.fillStyle = 'rgba(255,255,255,.45)'; rr(30, ST_RY + 1, 740, 3, 1.5); X.fill(); X.fillStyle = '#8f9cb3'; X.fillRect(26, ST_RY + 9, 748, 3);
  X = old; return cv;
}

/* ═════════ 3 COPY: watch a sequence of pads light up, then repeat it. Wrong pad loses; the fastest correct player wins ═════════
   Art: a clockmaker's shop. The four pads are four cuckoo clocks on the wall (blue up, yellow right, green down on a stool, pink
   left); a pad "lights" when its bird pops out and sings. A wooden board shows WATCH... / YOUR TURN! and one note slot per step.
   A shop cat watches the birds. Win: all four birds sing together. Lose: the wrong bird boings out on a broken spring, dizzy,
   and the cat laughs. */
const CP_FLOOR = 470, CP_FEET = 530;
const CP_CK = [
  { base: '#6EC3FF', shade: '#3f8fd1', bird: '#2f86d9', belly: '#cfeaff', note: BLU },
  { base: '#FFE14D', shade: '#d9b52a', bird: '#ffcf1f', belly: '#fff6c0', note: '#e0b000' },
  { base: '#6fe08a', shade: '#3aa858', bird: '#2fb85a', belly: '#d6ffd9', note: '#2fb85a' },
  { base: '#ff7ab8', shade: '#d0508a', bird: '#ff4d9e', belly: '#ffd6ea', note: PNK },
];
function ptMemo(sp) {
  const R = mkR(), n = 4 + (sp > 1.25 ? 1 : 0) + (sp > 1.5 ? 1 : 0), seq = Array.from({ length: n }, () => Math.floor(R() * 4));
  const pads = [{ x: 400, y: 215, c: BLU, k: 'ArrowUp', l: 'W' }, { x: 560, y: 340, c: YEL, k: 'ArrowRight', l: 'D' }, { x: 400, y: 465, c: GRN, k: 'ArrowDown', l: 'S' }, { x: 240, y: 340, c: PNK, k: 'ArrowLeft', l: 'A' }];
  const STEP = .55, SHOW0 = .3, showEnd = SHOW0 + n * STEP + .2;
  let at = 0, glow = -1, glowT = 0, wrong = -1;
  const lit = c => { const i = Math.floor((c - SHOW0) / STEP); return i >= 0 && i < n && (c - SHOW0) % STEP < STEP * .75 ? seq[i] : -1; };
  let lastLit = -1;
  let rT0 = -1;                                                               // art only: outro clock
  const g = {
    c: 0, cmd: 'COPY!', hint: 'WATCH, THEN CLICK THE PADS (OR ARROWS / WASD)', thint: 'WATCH, THEN TAP THE PADS IN ORDER', dur: 8, need: 0, pts: 0,
    update(dt) {
      g.c += dt; glowT = Math.max(0, glowT - dt);
      const l = g.c < showEnd ? lit(g.c) : -1; if (l !== lastLit) { lastLit = l; if (l >= 0) snd(330 + l * 110, .22, 'triangle', .07); }
      if (!g.result && g.c >= g.dur) { g.result = 'lose'; ptLose(400, 340); }
      if (g.result && rT0 < 0) rT0 = now;
    },
    press(i) {
      if (g.result || g.c < showEnd) return;
      glow = i; glowT = .18;
      if (i === seq[at]) { snd(330 + i * 110, .2, 'triangle', .08); at++; if (at === n) { g.result = 'win'; g.pts = 1; rT0 = now; ptWin(400, 340); } }
      else { wrong = i; g.result = 'lose'; rT0 = now; ptLose(pads[i].x, pads[i].y); }
    },
    draw() {
      X = ctx; if (!CP_BG) CP_BG = copyBg(); X.drawImage(CP_BG, 0, 0);
      const T = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0, showing = g.c < showEnd;
      const L = res ? -1 : showing ? lit(g.c) : glowT > 0 ? glow : -1;
      const ph = showing && L >= 0 ? ((g.c - SHOW0) % STEP) : glowT > 0 ? .18 - glowT : 0;
      copyBoard(T, res === 'win' ? 'COPIED!' : wrong >= 0 ? 'WRONG!' : showing ? 'WATCH...' : 'YOUR TURN!', n, at, res, showing);
      const focus = L >= 0 ? L : wrong;
      copyCat(712, CP_FEET, T, focus >= 0 ? clamp((pads[focus].x - 712) / 300, -1, 1) : -.3, res, rT, L >= 0);
      copyClaude(T, res, rT, glowT > 0 ? pads[glow] : null, showing);
      pads.forEach((p, i) => {
        let out = 0, st = null;
        if (res === 'win') { out = outBack((rT - i * .08) / .25); st = 'win'; }
        else if (wrong === i) { out = 1; st = 'bad'; }
        else if (L === i) { out = outBack(ph / .1); st = 'lit'; }
        cuckoo(i, p, T, out, st, rT, ph);
      });
      vignette(.16);
    },
    down(p) { let b = -1, bd = 1e9; pads.forEach((q, i) => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < 90 && d < bd) { bd = d; b = i; } }); if (b >= 0) g.press(b); },
    key(e) {
      if (e.repeat) return;
      const m = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 }[e.code];
      if (m !== undefined) g.press(m);
    },
  };
  return g;
}
reg('pt_memo', ptMemo, 'COPY!');

/* the hanging board: the state word, and under it one note slot per step of the tune (filled as you copy) */
function copyBoard(T, word, n, at, res, showing) {
  const w = 214, x0 = 400 - w / 2, y0 = 62, h = 54, sw = Math.sin(T * 1.3) * .012;
  X.save(); X.translate(400, 58); X.rotate(sw); X.translate(-400, -58);
  for (const rx of [x0 + 24, x0 + w - 24]) tube(() => { X.beginPath(); X.moveTo(rx, 58); X.lineTo(rx, y0 + 6); }, 3, '#e6c58c');
  rr(x0, y0 + 5, w, h, 14); ink('#a5622c', 4); rr(x0, y0, w, h, 14); ink('#d9944f', 4);
  X.fillStyle = 'rgba(255,255,255,.22)'; rr(x0 + 10, y0 + 4, w - 20, 5, 2.5); X.fill();
  if (res === 'win') { X.globalAlpha = .5 + Math.sin(T * 12) * .3; rr(x0 - 3, y0 - 3, w + 6, h + 6, 16); X.strokeStyle = `hsl(${(T * 400) % 360},100%,65%)`; X.lineWidth = 5; X.stroke(); X.globalAlpha = 1; }
  txt(word, 400, y0 + 19, 21, res === 'win' ? GRN : res === 'lose' ? '#ff8a96' : showing ? '#fff' : YEL, 'center', w - 24);
  for (let i = 0; i < n; i++) {
    const px = 400 - (n - 1) * 12 + i * 24, py = y0 + 40;
    X.beginPath(); X.arc(px, py, 8, 0, TAU); ink('#a5622c', 0); X.fillStyle = '#b06d33'; X.fill();
    if (i < at || res === 'win') note(px - 2, py + 4, .5, GRN);
  }
  X.restore();
}
/* one cuckoo clock: pendulum and weights, the painted house, a roof ornament, the dial, the key on its plaque, and the bird
   on its spring (out 0..1). st: 'lit' (sings), 'win' (sings in the chorus), 'bad' (boings out dizzy on a broken spring) */
function cuckoo(i, p, T, out, st, rT, ph) {
  const P = CP_CK[i], stool = i === 2, wob = st === 'lit' ? Math.sin(T * 60) * 1.6 : st === 'bad' ? Math.sin(rT * 30) * 3 * Math.max(0, 1 - rT) : 0;
  X.save(); X.translate(p.x + wob, p.y);
  if (st === 'lit' || st === 'win') { const k = st === 'win' ? (T * 2) % 1 : clamp(ph / .4, 0, 1); X.globalAlpha = .55 * (1 - k); X.beginPath(); X.arc(0, -14, 70 + k * 26, 0, TAU); X.strokeStyle = st === 'win' ? `hsl(${(i * 90 + T * 300) % 360},100%,70%)` : '#fff'; X.lineWidth = 8; X.stroke(); X.globalAlpha = 1;
    X.fillStyle = 'rgba(255,255,255,.22)'; X.beginPath(); X.arc(0, -14, 72, 0, TAU); X.fill(); }
  if (st === 'bad') { X.fillStyle = 'rgba(255,77,94,.22)'; X.beginPath(); X.arc(0, -14, 76, 0, TAU); X.fill(); X.strokeStyle = '#ff4d5e'; X.lineWidth = 5; X.stroke(); }
  if (stool) { rr(-50, 40, 100, 14, 5); ink('#b06d33', 3.5); for (const s of [-1, 1]) { rr(s * 36 - 5, 52, 10, 20, 3); ink('#8a5530', 3); } }
  else {
    const sw = Math.sin(T * 3.4 + i * 1.3) * .32;
    X.save(); X.translate(0, 36); X.rotate(sw); tube(() => { X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 40); }, 2.5, '#e6c58c'); X.beginPath(); X.arc(0, 46, 10, 0, TAU); ink('#ffd23f', 3); glint(-3, 43, 3.5, 2, -.5, .6); X.restore();
    for (const s of [-1, 1]) { X.strokeStyle = '#8a8398'; X.lineWidth = 2; X.beginPath(); X.moveTo(s * 22, 38); X.lineTo(s * 22, 56 + s * 6); X.stroke(); rr(s * 22 - 6, 56 + s * 6, 12, 22, 6); ink('#8a5530', 2.5); }
  }
  cel(P.base, P.shade, () => rr(-48, -42, 96, 82, 12), 7, 0, 4); glint(-30, -32, 12, 4, -.3, .45);
  X.fillStyle = 'rgba(20,16,28,.12)'; rr(-40, 18, 80, 16, 6); X.fill();
  tube(() => { X.beginPath(); X.moveTo(-60, -32); X.lineTo(0, -80); X.lineTo(60, -32); }, 11, '#8a5530');
  X.strokeStyle = '#b06d33'; X.lineWidth = 3; X.beginPath(); X.moveTo(-50, -36); X.lineTo(0, -75); X.lineTo(50, -36); X.stroke();
  // roof ornament: leaves, a star, a sprout, a heart (so the four houses read apart)
  X.save(); X.translate(0, -86);
  if (i === 0) { for (const s of [-1, 1]) { el(s * 8, 0, 9, 5, s * .5); ink('#3fb260', 2.5); } }
  else if (i === 1) { X.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.5 : 10; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); ink('#FFE14D', 2.5); }
  else if (i === 2) { tube(() => { X.beginPath(); X.moveTo(0, 6); X.lineTo(0, -4); }, 2.5, '#3fb260'); el(5, -6, 6, 4, -.5); ink('#5bcf72', 2); }
  else { X.beginPath(); X.moveTo(0, 7); X.bezierCurveTo(-13, -2, -7, -12, 0, -5); X.bezierCurveTo(7, -12, 13, -2, 0, 7); ink('#ff5c8a', 2.5); }
  X.restore();
  // the dial
  X.beginPath(); X.arc(0, -2, 24, 0, TAU); ink('#fff6e6', 3.5);
  X.fillStyle = INK; for (let k = 0; k < 12; k++) { const a = k * TAU / 12; el(Math.cos(a) * 18, -2 + Math.sin(a) * 18, k % 3 ? 1.2 : 2.2, k % 3 ? 1.2 : 2.2); X.fill(); }
  const hm = T * .9 + i, hh = T * .075 + i * 2;
  X.strokeStyle = INK; X.lineCap = 'round'; X.lineWidth = 3.5; X.beginPath(); X.moveTo(0, -2); X.lineTo(Math.sin(hh) * 10, -2 - Math.cos(hh) * 10); X.stroke();
  X.lineWidth = 2.5; X.beginPath(); X.moveTo(0, -2); X.lineTo(Math.sin(hm) * 16, -2 - Math.cos(hm) * 16); X.stroke();
  X.beginPath(); X.arc(0, -2, 3, 0, TAU); ink('#ffd23f', 1.5);
  if (!TOUCH) keyCap(0, 28, p.l, 12);
  // the door under the roof, and the bird
  const dy = -54;
  if (out > .02) { for (const s of [-1, 1]) { rr(s > 0 ? 12 : -22, dy - 12, 10, 24, 4); ink(P.shade, 2.5); } X.beginPath(); X.arc(0, dy, 12, 0, TAU); ink('#2b1d3d', 2.5); }
  else { rr(-12, dy - 12, 24, 24, 10); ink('#a5622c', 2.5); X.strokeStyle = '#7a4a24'; X.lineWidth = 2; X.beginPath(); X.moveTo(0, dy - 10); X.lineTo(0, dy + 10); X.stroke(); }
  X.restore();
  if (out > .02) {
    const bad = st === 'bad', hang = bad ? 34 + Math.sin(rT * 16) * 8 * Math.max(.2, 1 - rT) : 0, bx = p.x + wob + (bad ? Math.sin(rT * 9) * 10 : 0), by = p.y + dy + 6 * out + hang;
    if (bad || out > .3) { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); const n2 = 6; for (let k = 0; k <= n2; k++) { const yy = p.y + dy + (by - p.y - dy) * k / n2; X.lineTo(p.x + wob + (k % 2 ? 5 : -5) * (k && k < n2 ? 1 : 0) + (bx - p.x - wob) * k / n2, yy); } X.stroke(); }
    cuckooBird(i, bx, by, .55 + .5 * Math.min(out, 1.1), T, bad, st === 'win' ? Math.sin(T * 20 + i) > 0 : true);
    if (st === 'lit' || st === 'win') { const k = st === 'win' ? ((rT * 1.4 + i * .25) % 1) : clamp(ph / .41, 0, 1); X.globalAlpha = 1 - k; note(p.x + 34 + k * 18, p.y - 70 - k * 46, .9, P.note, Math.sin(k * 6) * .2); X.globalAlpha = 1; }
  }
}
/* the cuckoo: round body, belly, wing, beak (open while it sings), and its own accessory (top hat, glasses, crest, bow) */
function cuckooBird(i, x, y, s, T, dizzy, open) {
  const P = CP_CK[i];
  X.save(); X.translate(x, y); X.scale(s, s); if (dizzy) X.rotate(Math.sin(T * 6) * .3);
  el(0, 4, 18, 16); ink(P.bird, 3); X.fillStyle = P.belly; el(3, 9, 10, 9); X.fill();
  el(-9, 6, 9, 6, -.5); ink(P.bird, 2.5); glint(-6, -6, 6, 3, -.5, .5);
  const bo = open ? 6 : 1.5;
  X.beginPath(); X.moveTo(14, -2); X.lineTo(28, -2 - bo * .3); X.lineTo(15, 2); X.closePath(); ink('#ffb84d', 2);
  X.beginPath(); X.moveTo(15, 3); X.lineTo(26, 3 + bo); X.lineTo(14, 6); X.closePath(); ink('#ff9a3a', 2);
  if (dizzy) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); for (let k = 0; k < 14; k++) { const a = k * .7 + T * 8, r = k * .45; X.lineTo(6 + Math.cos(a) * r, -4 + Math.sin(a) * r); } X.stroke(); }
  else { X.fillStyle = '#fff'; el(6, -4, 5, 5.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); X.fillStyle = INK; el(7.5, -4, 2.6, 3); X.fill(); X.fillStyle = '#fff'; el(6.8, -5.2, 1, 1); X.fill(); }
  if (i === 0) { rr(-8, -26, 16, 14, 2); ink('#2b2140', 2.5); rr(-12, -14, 24, 5, 2.5); ink('#2b2140', 2.5); X.fillStyle = '#ff5d5d'; X.fillRect(-8, -17, 16, 3); }
  else if (i === 1) { X.strokeStyle = INK; X.lineWidth = 2.2; X.beginPath(); X.arc(6, -4, 6.5, 0, TAU); X.stroke(); X.beginPath(); X.moveTo(-1, -5); X.lineTo(-8, -7); X.stroke(); }
  else if (i === 2) { for (const [a, l] of [[-.5, 12], [-.15, 14], [.2, 11]]) { X.save(); X.translate(-2, -10); X.rotate(a); el(0, -l / 2, 3.5, l / 2); ink('#ff5d5d', 2); X.restore(); } }
  else { X.save(); X.translate(-4, -12); for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(0, 0); X.lineTo(sd * 10, -6); X.lineTo(sd * 10, 6); X.closePath(); ink('#fff6e6', 2); } X.beginPath(); X.arc(0, 0, 3, 0, TAU); ink('#fff6e6', 2); X.restore(); }
  X.restore();
}
/* Claude by the bench (left): watches, points at the clock it just pressed, cheers or slumps */
function copyClaude(T, res, rT, pressed, showing) {
  const x = 96, U = 5.4, won = res === 'win', lost = res === 'lose', hop = won ? Math.abs(Math.sin(rT * 9)) * 16 : 0;
  shadow(x, CP_FEET + 2, 46 - hop * .6, 10, .28);
  X.save(); X.translate(x, CP_FEET - hop);
  const ra = won ? 2.6 - Math.sin(rT * 14) * .2 : lost ? 2.5 : pressed ? Math.atan2(pressed.x - x - 36, -(pressed.y - CP_FEET + 28)) : .25 + Math.sin(T * 3) * .05;
  arms(U, won ? -2.6 + Math.sin(rT * 14) * .2 : lost ? -2.5 : -.25 - Math.sin(T * 3) * .05, ra, pressed ? 1.6 : 1.1, OR);
  claude(0, 0, U, { mood: won ? 'happy' : lost ? 'sad' : null });
  X.restore();
  if (lost) sweat(x - U * 7.4, CP_FEET - U * 8, 1, T);
  tagC(x, CP_FEET - 74 - hop, 'YOU', YEL, 12);
}
/* the shop cat: tail swish, looks at the singing bird, ears up while one sings; laughs on a lose, purrs on a win */
function copyCat(x, y, T, look, res, rT, alert) {
  const laugh = res === 'lose', purr = res === 'win', sh = laugh ? Math.sin(T * 30) * 1.5 : 0;
  X.save(); X.translate(x + sh, y);
  shadow(0, 2, 30, 7, .25);
  X.save(); X.translate(18, -8); X.rotate(Math.sin(T * 2.4) * .35); tube(() => { X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(26, -6, 22, -36); X.quadraticCurveTo(20, -46, 28, -48); }, 7, '#f2a65a'); X.restore();
  cel('#f2a65a', '#d9843a', () => el(0, -24, 22, 25), -5, 0, 3.5);
  X.fillStyle = '#fff3e0'; el(-2, -20, 10, 15); X.fill();
  for (const lx of [-9, 5]) { rr(lx - 5, -14, 10, 14, 5); ink('#f2a65a', 3); }
  X.save(); X.translate(look * 5, -56 - (alert ? 3 : 0));
  for (const s of [-1, 1]) { X.beginPath(); X.moveTo(s * 7, -12); X.lineTo(s * 17, -27 - (alert ? 4 : 0)); X.lineTo(s * 20, -6); X.closePath(); ink('#f2a65a', 3); X.fillStyle = '#ffb7c8'; X.beginPath(); X.moveTo(s * 10, -11); X.lineTo(s * 16, -21 - (alert ? 4 : 0)); X.lineTo(s * 17, -9); X.closePath(); X.fill(); }
  el(0, 0, 22, 18); ink('#f2a65a', 3.5); glint(-8, -8, 6, 3, -.5, .45);
  X.strokeStyle = '#d9843a'; X.lineWidth = 3; for (const s of [-6, 0, 6]) { X.beginPath(); X.moveTo(s, -17); X.lineTo(s, -11); X.stroke(); }
  if (laugh || purr) { X.strokeStyle = INK; X.lineWidth = 2.5; for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 8, -1, 4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); } }
  else { const r = alert ? 5.5 : 4.5; for (const s of [-1, 1]) { X.fillStyle = '#d6ff8a'; el(s * 8, -2, r, r + .5); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); X.fillStyle = INK; el(s * 8 + look * 2, -2, 1.6, r - 1); X.fill(); } }
  X.fillStyle = '#ff7a9a'; X.beginPath(); X.moveTo(-3, 5); X.lineTo(3, 5); X.lineTo(0, 8); X.closePath(); X.fill();
  if (laugh) { X.beginPath(); X.arc(0, 10, 6, 0, Math.PI); ink('#7a2a3a', 2); }
  else { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(-5, 11); X.quadraticCurveTo(0, 14, 0, 9); X.quadraticCurveTo(0, 14, 5, 11); X.stroke(); }
  X.strokeStyle = 'rgba(20,16,28,.6)'; X.lineWidth = 1.5; for (const s of [-1, 1]) for (const d of [-2, 2]) { X.beginPath(); X.moveTo(s * 12, 7 + d); X.lineTo(s * 26, 5 + d * 2); X.stroke(); }
  X.restore();
  X.restore();
  if (laugh && rT > .1) { const k = (rT * 2) % 1; X.globalAlpha = 1 - k; txt('HA', x - 30, y - 98 - k * 20, 16, '#fff', 'center'); txt('HA', x + 26, y - 108 - k * 24, 14, '#fff', 'center'); X.globalAlpha = 1; }
  if (purr) { const k = (rT * 1.5) % 1; X.globalAlpha = 1 - k; X.fillStyle = '#ff5c8a'; X.save(); X.translate(x - 24, y - 96 - k * 30); X.beginPath(); X.moveTo(0, 6); X.bezierCurveTo(-10, -2, -5, -10, 0, -4); X.bezierCurveTo(5, -10, 10, -2, 0, 6); ink('#ff5c8a', 2); X.restore(); X.globalAlpha = 1; }
}
/* the baked shop: wallpaper, a window, shelves of little clocks, wainscot, plank floor and a rug */
let CP_BG = null;
function copyBg() {
  const cv = mkCv(), old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, CP_FLOOR); gr.addColorStop(0, '#d9a86a'); gr.addColorStop(1, '#ffe0a8'); X.fillStyle = gr; X.fillRect(0, 0, W, CP_FLOOR);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < W; x += 40) X.fillRect(x, 0, 16, CP_FLOOR);
  X.fillStyle = 'rgba(255,120,150,.45)'; for (let y = 30, r = 0; y < 400; y += 56, r++) for (let x = (r % 2) * 20 + 12; x < W; x += 40) { el(x, y, 3, 3); X.fill(); }
  // window (left) with the street outside
  rr(28, 150, 132, 150, 10); ink('#8a5530', 5);
  X.save(); rr(38, 160, 112, 130, 6); X.clip(); gr = X.createLinearGradient(0, 160, 0, 290); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(38, 160, 112, 130);
  X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(38, 290); X.quadraticCurveTo(90, 240, 150, 262); X.lineTo(150, 290); X.fill();
  X.fillStyle = '#fff'; el(70, 190, 16, 8); X.fill(); el(84, 186, 12, 8); X.fill(); X.restore();
  X.strokeStyle = '#8a5530'; X.lineWidth = 6; X.beginPath(); X.moveTo(94, 160); X.lineTo(94, 290); X.moveTo(38, 225); X.lineTo(150, 225); X.stroke();
  rr(20, 296, 148, 12, 5); ink('#b06d33', 3.5); for (const [a, c] of [[44, '#ff5c8a'], [56, '#FFE14D']]) { rr(a - 8, 280, 16, 16, 4); ink('#d9944f', 2.5); X.beginPath(); X.arc(a, 274, 6, 0, TAU); ink(c, 2); }
  // shelves (right) with small clocks, an hourglass and gears
  for (const sy of [180, 270]) { rr(640, sy, 150, 12, 4); ink('#b06d33', 3.5); for (const s of [652, 778]) { X.beginPath(); X.moveTo(s, sy + 12); X.lineTo(s, sy + 24); X.lineTo(s + (s < 700 ? 10 : -10), sy + 12); X.closePath(); ink('#8a5530', 2.5); } }
  const mini = (x, y, r, c) => { for (const s of [-1, 1]) { X.beginPath(); X.arc(x + s * r * .6, y - r * .9, r * .32, 0, TAU); ink('#cfd8e6', 2); } X.beginPath(); X.arc(x, y, r, 0, TAU); ink(c, 3); X.beginPath(); X.arc(x, y, r * .7, 0, TAU); ink('#fff6e6', 1.5); X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(x, y); X.lineTo(x, y - r * .5); X.moveTo(x, y); X.lineTo(x + r * .4, y + r * .1); X.stroke(); };
  mini(668, 164, 13, '#ff5d5d'); mini(752, 160, 16, '#6EC3FF'); mini(700, 256, 12, '#5CFF7A');
  X.beginPath(); X.moveTo(744, 232); X.lineTo(768, 232); X.lineTo(756, 250); X.lineTo(768, 268); X.lineTo(744, 268); X.lineTo(756, 250); X.closePath(); ink('#e4f5ff', 2.5); X.fillStyle = '#f4d998'; X.beginPath(); X.moveTo(750, 266); X.lineTo(762, 266); X.lineTo(756, 256); X.fill(); rr(740, 228, 32, 6, 3); ink('#8a5530', 2); rr(740, 266, 32, 6, 3); ink('#8a5530', 2);
  const gear = (x, y, r, c) => { X.beginPath(); for (let k = 0; k < 16; k++) { const a = k * TAU / 16, rr2 = k % 2 ? r : r * .78; X.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } X.closePath(); ink(c, 2.5); X.beginPath(); X.arc(x, y, r * .3, 0, TAU); ink('#8a5530', 2); };
  gear(110, 96, 26, '#e6c58c'); gear(146, 120, 16, '#cfd8e6'); gear(690, 104, 22, '#e6c58c');
  // wainscot and floor
  rr(-4, 404, W + 8, 66, 0); ink('#c4874e', 4); for (let x = 20; x < W; x += 110) { rr(x, 414, 86, 46, 6); ink('#b06d33', 2.5); X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(x + 6, 418, 74, 3); }
  rr(-4, 398, W + 8, 12, 4); ink('#e3a868', 3);
  gr = X.createLinearGradient(0, CP_FLOOR, 0, H); gr.addColorStop(0, '#b97a46'); gr.addColorStop(1, '#8a5530'); X.fillStyle = gr; X.fillRect(0, CP_FLOOR, W, H - CP_FLOOR);
  X.strokeStyle = 'rgba(60,30,10,.3)'; X.lineWidth = 2; for (let y = CP_FLOOR + 14, hh = 14; y < H; y += hh, hh *= 1.2) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, CP_FLOOR); X.lineTo(W, CP_FLOOR); X.stroke();
  el(400, 548, 190, 34); ink('#c94c6a', 3.5); el(400, 548, 160, 25); X.strokeStyle = '#ffd6a0'; X.lineWidth = 3; X.stroke(); el(400, 548, 120, 17); X.strokeStyle = '#7a2a4a'; X.lineWidth = 2; X.stroke();
  X = old; return cv;
}

/* 4 GRAB: coins (and a few bombs) rain on the town square; Claude carries a basket on its head and slides under them.
   The coins follow a walk the basket can always reach in time (even with the arrow keys), and each bomb falls just OUTSIDE
   the stretch between two coins, so going straight from coin to coin is always safe and overshooting is what gets you.
   Every coin lands before the real end of the round (main.js runs it for dur/√sp). A bomb in the basket costs one coin.
   Art (docs/ART-STYLE.md): a sunny plaza with a bank, a café and bunting; a pigeon on the lamp post watches the coins and
   flaps when a bomb goes off. Win: coins fountain out of the basket. Lose: the pigeon swoops down and steals one. */
const GR_Y0 = -30, GR_CATCH = 436, GR_FEET = 532, GR_LAND = 528, GR_U = 5.4, GR_LAMP = 470;
function ptGrab(sp) {
  const R = mkR(), T = 7 / Math.sqrt(sp), vy = 380 + (sp - 1) * 160, N = 10, KS = 640;
  const fall = (GR_CATCH - GR_Y0) / vy, gap = (T - .3 - fall - .45) / (N - 1), reach = Math.min(250, KS * gap * .7);
  const items = []; let x = 220 + R() * 360;
  for (let i = 0; i < N; i++) {
    if (i) { let st = (R() < .5 ? -1 : 1) * (60 + R() * (reach - 60)); if (x + st < 90 || x + st > 710) st = -st; x = clamp(x + st, 90, 710); }
    items.push({ t0: .45 + i * gap, x, bomb: false, k: i });
  }
  const pb = .5 + Math.min(.3, (sp - 1) * .3);
  for (let i = 0; i < N - 1; i++) {
    const a = items[i].x, b = items[i + 1].x, side = R() < .5 ? -1 : 1, off = 80 + R() * 50, k = R(), on = R() < pb;
    if (!on) continue;
    let bx = side > 0 ? Math.max(a, b) + off : Math.min(a, b) - off;
    if (bx < 70 || bx > 730) bx = side > 0 ? Math.min(a, b) - off : Math.max(a, b) + off;
    if (bx >= 70 && bx <= 730) items.push({ t0: items[i].t0 + gap * (.4 + k * .2), x: bx, bomb: true, k: 20 + i });
  }
  let bx = 400, kx = 0, caught = 0;
  const yOf = it => GR_Y0 + (g.c - it.t0) * vy;
  // art only (never touches R): outro clock, lean, the last catch / bomb, slot pops, the coin knocked out by a bomb
  let rT0 = -1, lastBx = 400, lean = 0, run = 0, happyAt = -9, hitAt = -9, hitX = 0, lostAt = -9, flapAt = -9, pop = null;
  const slotAt = [];
  const g = {
    c: 0, cmd: 'GRAB!', hint: 'MOVE THE MOUSE (OR ◄ ►) TO CATCH COINS, AVOID BOMBS', thint: 'DRAG TO CATCH COINS, AVOID BOMBS', dur: 7, need: 7, pts: 0, timeWin: false,
    dbg: { items, T, get bx() { return bx; } },
    update(dt) {
      g.c += dt;
      if (g.result && rT0 < 0) rT0 = now;
      if (!g.result) {
        bx = clamp(bx + kx * KS * dt, 60, 740);
        for (const it of items) {
          if (it.got || it.land) continue; const y = yOf(it);
          if (y > GR_CATCH - 20 && y < GR_CATCH + 28 && Math.abs(it.x - bx) < (it.bomb ? 46 : 64)) {
            it.got = g.c;
            if (it.bomb) {
              if (caught > 0) { lostAt = now; slotAt[caught - 1] = -now; }
              caught = Math.max(0, caught - 1); hitAt = now; hitX = it.x; flapAt = now;
              sfx.thud(); sfx.buzz(); shake(7, .2); burst(it.x, GR_CATCH, '#4a4452', 12); burst(it.x, GR_CATCH, '#ff9a3a', 8);
              pop = { s: 'BOOM!', at: now, x: clamp(it.x, 130, 670), y: GR_CATCH - 92, col: '#ff4d5e' };
            } else {
              caught++; slotAt[caught - 1] = now; happyAt = now;
              sfx.coin(); sfx.blip(Math.min(14, caught * 2)); burst(it.x, GR_CATCH - 6, '#FFC93C', 8); floatText('+1', it.x, GR_CATCH - 60, '#FFE14D', 30);
            }
            g.pts = caught;
          } else if (y >= GR_LAND) { it.land = now; if (it.bomb) flapAt = now; }
        }
        g.timeWin = caught >= g.need;
        if (g.c >= T) {
          g.result = g.timeWin ? 'win' : 'lose'; rT0 = now;
          (g.result === 'win' ? ptWin : ptLose)(bx, GR_CATCH);
        }
      }
      const v = (bx - lastBx) / Math.max(dt, 1e-3); lastBx = bx;
      lean += (clamp(v / 4000, -.1, .1) - lean) * Math.min(1, dt * 12); run = Math.abs(v) > 60 ? run + dt : 0;
    },
    draw() {
      X = ctx; if (!GR_BG) GR_BG = grabBg(); ctx.drawImage(GR_BG, 0, 0);
      const Tn = now, res = g.result, rT = rT0 < 0 ? 0 : now - rT0;
      grabSky(Tn);
      grabSign(Tn, caught, g.need, slotAt, res);
      // what landed on the plaza: coins bounce and fade, bombs fizzle out in a small grey puff
      for (const it of items) {
        if (!it.land) continue; const a = now - it.land; if (a > .6) continue;
        if (it.bomb) { X.globalAlpha = 1 - a / .6; for (let i = 0; i < 4; i++) { el(it.x + (i - 1.5) * 14 * (1 + a * 2), GR_LAND - 8 - a * 40 - (i % 2) * 10, 14 + a * 20, 11 + a * 14); ink('#d9d4e6', 2.5); } X.globalAlpha = 1; }
        else { X.globalAlpha = 1 - a / .6; grabCoin(it.x + a * (it.k % 2 ? 60 : -60), GR_LAND - 6 - Math.abs(Math.sin(a * 9)) * 26 * (1 - a / .6), 18, a * 20); X.globalAlpha = 1; }
      }
      // where things will land: a shadow on the plaza that firms up as they come down (helps the dodge)
      for (const it of items) {
        if (it.got || it.land) continue; const y = yOf(it); if (y < 40 || y > GR_LAND) continue;
        const k = clamp((y - 40) / (GR_CATCH - 40), 0, 1); shadow(it.x, GR_LAND + 4, 10 + 14 * k, 4 + 4 * k, .1 + .2 * k);
      }
      grabPigeon(Tn, items, yOf, flapAt, res, rT, bx);
      // Claude with the basket on its head
      const won = res === 'win', lost = res === 'lose', soot = clamp(1 - (now - hitAt) / .7, 0, 1);
      const danger = !res && items.some(it => it.bomb && !it.got && !it.land && Math.abs(it.x - bx) < 100 && yOf(it) > 220 && yOf(it) < GR_CATCH + 20);
      const hop = won ? Math.abs(Math.sin(rT * 9)) * 18 : (Tn - happyAt < .25 ? Math.sin((Tn - happyAt) / .25 * Math.PI) * 6 : 0);
      shadow(bx, GR_FEET + 2, 52 - hop * .6, 11, .28);
      X.save(); X.translate(bx, GR_FEET - hop); X.rotate(lean + (lost ? Math.sin(Math.min(1, rT / .3) * Math.PI * .5) * -.08 : 0));
      const col = soot > 0 ? mixC(OR, '#4a4452', soot) : OR, br = res ? 0 : Math.sin(Tn * 3.1) * .025;
      const la = won ? -.3 - Math.sin(rT * 14) * .1 : -.1, ra = won ? .3 + Math.sin(rT * 14) * .1 : .1;
      X.save(); X.scale(1 + br, 1 - br); arms(GR_U, la, ra, 1.45, col);
      claude(0, 0, GR_U, { mood: won || Tn - happyAt < .35 ? 'happy' : lost || soot > .3 ? 'sad' : null, run: run > 0 && !res ? run : null, col });
      X.restore();
      if (danger || lost) sweat(-GR_U * 7.4, -GR_U * 7.4, 1, Tn);
      grabBasket(0, GR_CATCH - GR_FEET, won ? 9 : Math.min(9, caught) - (lost && rT > .35 ? 1 : 0), Tn, soot, lostAt);
      X.restore();
      if (soot > 0) { const k = 1 - soot; X.globalAlpha = soot; for (let i = 0; i < 5; i++) { el(hitX + Math.sin(i * 2.1) * 30 * (1 + k), GR_CATCH - 20 - k * 70 - i * 9, 16 + k * 14, 12 + k * 10); ink('#5a5468', 2.5); } X.globalAlpha = 1;
        if (soot > .6) star(hitX, GR_CATCH - 10, 46 * soot, 22 * soot, 10, Tn * 2, '#ff9a3a', 3); }
      if (lostAt > 0 && now - lostAt < .7) { const a = (now - lostAt) / .7, d = hitX < bx ? 1 : -1; grabCoin(bx + d * a * 150, GR_CATCH - 20 - Math.sin(a * Math.PI) * 120 + a * 60, 16, a * 30); }
      if (won) for (let i = 0; i < 10; i++) {                             // the coin fountain
        const a = rT * 1.25 - i * .05; if (a <= 0 || a > 1) continue;
        const vx = (i % 2 ? 1 : -1) * (170 + (i * 53) % 160), h = 70 + (i * 29) % 50;   // low and wide, so it reads beside the stamp
        grabCoin(bx + vx * a, GR_CATCH - 14 - h * 4 * a * (1 - a) + a * (GR_LAND - GR_CATCH), 15, a * 14 + i);
      }
      // the falling coins and bombs, on top of everything
      for (const it of items) {
        if (it.got || it.land) continue; const y = yOf(it); if (y < -40) continue;
        it.bomb ? grabBomb(it.x, y, Tn) : grabCoin(it.x, y, 22, Tn * 6 + it.k);
      }
      if (pop) { const a = now - pop.at, sc = a < .25 ? outBack(a / .25) : 1; X.globalAlpha = clamp(1 - (a - .8) / .25, 0, 1); badge(pop.s, pop.x, pop.y, 30, pop.col, pop.fg, sc, .07); X.globalAlpha = 1; if (a > 1.05) pop = null; }
      vignette(.16);
    },
    move(p) { if (!g.result) bx = clamp(p.x, 60, 740); },
    down(p) { g.move(p); },
    key(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1; },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; } },
  };
  return g;
}

/* ───────────── GRAB art (uses the drawing kit at the top of the file) ───────────── */
let GR_BG = null;
/* a gold coin seen spinning (spin = angle); r is the radius */
function grabCoin(x, y, r, spin) {
  const sx = Math.max(.18, Math.abs(Math.cos(spin)));
  X.save(); X.translate(x, y); X.scale(sx, 1);
  el(0, 0, r, r); ink('#d9971f', 3.5 / Math.max(sx, .5));
  X.fillStyle = '#FFC93C'; el(-r * .12, -r * .1, r * .86, r * .86); X.fill();
  X.strokeStyle = '#d9971f'; X.lineWidth = 2.5; el(-r * .06, -r * .05, r * .58, r * .58); X.stroke();
  if (sx > .45) { X.fillStyle = '#c7861a'; X.font = `900 ${r * .95}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('$', -r * .04, r * .02); }
  glint(-r * .42, -r * .44, r * .3, r * .16, -.6, .7);
  X.restore();
}
/* a cartoon bomb with a cross face and a sparking fuse */
function grabBomb(x, y, T) {
  const w = Math.sin(T * 9 + x) * .12;
  X.save(); X.translate(x, y); X.rotate(w);
  rr(-8, -27, 16, 10, 3); ink('#8f9cb3', 3);
  X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, -27); X.quadraticCurveTo(4, -38, 12, -40); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.stroke();
  cel('#3b3550', '#1f1a2e', () => el(0, 0, 21, 21), -4, -4, 4);
  glint(-8, -9, 6, 3.5, -.6, .55);
  X.strokeStyle = '#fff'; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(-11, -3); X.lineTo(-4, 0); X.moveTo(11, -3); X.lineTo(4, 0); X.stroke();
  X.fillStyle = '#fff'; el(-6, 4, 2.6, 3); X.fill(); el(6, 4, 2.6, 3); X.fill();
  X.strokeStyle = '#fff'; X.lineWidth = 2.5; X.beginPath(); X.arc(0, 15, 5, Math.PI * 1.15, Math.PI * 1.85); X.stroke();
  X.restore();
  star(x + 12 + Math.cos(w) * 0, y - 41, 9 + Math.sin(T * 30) * 2.5, 4, 7, T * 8, '#FFB020', 2);
  X.fillStyle = '#fff'; el(x + 12, y - 41, 2.5, 2.5); X.fill();
}
/* the wicker basket on Claude's head; n coins piled in it, with a name label on the front */
function grabBasket(x, y, n, T, soot, lostAt) {
  X.save(); X.translate(x, y);
  el(0, 0, 64, 13); ink('#7a4a24', 4);                                          // inside
  for (let i = 0; i < n; i++) { const row = i < 5 ? 0 : 1, j = row ? i - 5 : i, cnt = row ? 4 : 5, px = (j - (cnt - 1) / 2) * 22, py = -4 - row * 11 + (j % 2) * 2;
    const k = i === n - 1 && T - lostAt < .2 ? 0 : 1; if (k) grabCoin(px, py, 12, .3 + i * .7); }
  const body = () => { X.beginPath(); X.moveTo(-64, 0); X.bezierCurveTo(-60, 26, -46, 30, -40, 30); X.lineTo(40, 30); X.bezierCurveTo(46, 30, 60, 26, 64, 0); X.ellipse(0, 0, 64, 13, 0, 0, Math.PI); X.closePath(); };
  cel(soot > 0 ? mixC('#d9944f', '#6a6274', soot) : '#d9944f', '#a5622c', body, -6, -5, 4);
  X.save(); body(); X.clip(); X.strokeStyle = '#b06d33'; X.lineWidth = 3;
  for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(i * 18, 6); X.lineTo(i * 15, 30); X.stroke(); }
  for (const yy of [12, 21]) { X.beginPath(); X.moveTo(-64, yy); X.lineTo(64, yy); X.stroke(); } X.restore();
  X.beginPath(); X.ellipse(0, 0, 64, 13, 0, 0, Math.PI); ink(null, 0); X.strokeStyle = INK; X.lineWidth = 9; X.stroke(); X.strokeStyle = '#f2b878'; X.lineWidth = 4.5; X.stroke();
  tagC(0, 19, 'YOU', '#FFE14D', 12);
  X.restore();
}
/* the hanging wooden sign: one slot per coin needed, the count on a little tag underneath */
function grabSign(T, caught, need, slotAt, res) {
  const pitch = 27, w = need * pitch + 26, x0 = 400 - w / 2, y0 = 80, h = 40, sw = Math.sin(T * 1.3) * .012;
  X.save(); X.translate(400, 66); X.rotate(sw); X.translate(-400, -66);
  X.lineCap = 'round'; for (const rx of [x0 + 26, x0 + w - 26]) { X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.moveTo(rx, 66); X.lineTo(rx, y0 + 6); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.stroke(); }
  rr(x0, y0 + 5, w, h, 14); ink('#a5622c', 4);
  rr(x0, y0, w, h, 14); ink('#d9944f', 4);
  X.save(); rr(x0, y0, w, h, 14); X.clip(); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x0, y0 + 3, w, 6); X.fillStyle = '#c98443'; X.fillRect(x0, y0 + h - 9, w, 2); X.restore();
  for (let i = 0; i < need; i++) {
    const px = x0 + 26 + i * pitch, py = y0 + h / 2, at = slotAt[i], full = i < caught || res === 'win';
    X.beginPath(); X.arc(px, py, 11, 0, TAU); ink(res === 'lose' ? '#b9a88c' : '#f1e3c8', 2.5);
    if (full) { const k = at > 0 && i < caught ? outBack((T - at) / .3) : 1; X.save(); X.translate(px, py); X.scale(k, k);
      grabCoin(0, 0, 10, res === 'win' ? T * 8 + i : 0); X.restore(); }
    else if (at < 0 && T + at < .3) { const k = 1 + (T + at) * 3; X.globalAlpha = 1 - (T + at) / .3; grabCoin(px, py - (T + at) * 60, 10 * k, 0); X.globalAlpha = 1; }
  }
  if (res === 'win') { X.globalAlpha = .5 + Math.sin(T * 12) * .3; rr(x0 - 3, y0 - 3, w + 6, h + 6, 16); X.strokeStyle = `hsl(${(T * 400) % 360},100%,65%)`; X.lineWidth = 5; X.stroke(); X.globalAlpha = 1; }
  X.restore();
  tagC(400, y0 + h + 22, `${caught} / ${need}`, res === 'lose' ? '#ff8a96' : caught >= need ? '#5CFF7A' : '#FFE14D', 15);
}
/* sun rays + drifting clouds (live, behind the buildings' roofs) */
function grabSky(T) {
  const sx = 668, sy = 158;
  X.save(); X.translate(sx, sy); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
  for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-8, 40); X.lineTo(8, 40); X.lineTo(0, 66); X.fill(); }
  X.restore(); X.beginPath(); X.arc(sx, sy, 30, 0, TAU); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(sx - 9, sy - 9, 11, 7, -.6); X.fill();
  const cloud = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); };
  cloud(((T * 9 + 380) % 980) - 120, 176, .75); cloud(((T * 5 + 40) % 1000) - 140, 200, .6); cloud(((T * 7 + 760) % 1000) - 140, 150, .55);
  X.drawImage(GR_FG, 0, 0);                                                       // the roofs go back in front of the clouds
}
/* the pigeon on the lamp post: bobs, looks at the coins, flaps when a bomb goes off; on a lose it swoops down and steals a coin */
function grabPigeon(T, items, yOf, flapAt, res, rT, bx) {
  let x = GR_LAMP, y = 214, dir = -1, fly = clamp(1 - (T - flapAt) / .6, 0, 1), coin = false;
  let look = 0; { let best = -1; for (const it of items) { if (it.bomb || it.got || it.land) continue; const yy = yOf(it); if (yy > 0 && yy > best) { best = yy; look = clamp((it.x - x) / 200, -1, 1); } } }
  dir = look > 0 ? 1 : -1;
  if (res === 'lose') {                                                          // swoop: lamp → basket → off the top-left
    const a = clamp(rT / .85, 0, 1), m = .42;
    if (a < m) { const k = a / m; x = GR_LAMP + (bx + 40 - GR_LAMP) * k; y = 214 + (GR_CATCH - 26 - 214) * Math.sin(k * Math.PI / 2); dir = bx + 40 < GR_LAMP ? -1 : 1; }
    else { const k = (a - m) / (1 - m); x = bx + 40 + (-80 - bx - 40) * k * k; y = GR_CATCH - 26 - (GR_CATCH + 40) * Math.sin(k * Math.PI / 2); dir = -1; coin = true; }
    fly = a > 0 && a < 1 ? 1 : 0;
  } else if (res === 'win') fly = Math.abs(Math.sin(rT * 10)) * .8;
  const bob = fly ? 0 : Math.max(0, Math.sin(T * 5)) * 4, hop = fly * 16;
  X.save(); X.translate(x, y - hop); X.scale(dir, 1);
  if (!fly) { X.strokeStyle = INK; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.moveTo(-4, 12); X.lineTo(-4, 20); X.moveTo(5, 12); X.lineTo(5, 20); X.stroke(); X.strokeStyle = '#ff8a6a'; X.lineWidth = 2.5; X.stroke(); }
  X.beginPath(); X.moveTo(-14, 2); X.lineTo(-30, -4 + (fly ? 0 : 6)); X.lineTo(-26, 10); X.closePath(); ink('#77809a', 3);   // tail
  cel('#9aa3b8', '#77809a', () => el(0, 4, 18, 13), -4, -4, 3.5);
  const wf = fly ? Math.sin(T * 40) : 0;
  X.save(); X.translate(-2, 2); X.rotate(-.3 - wf * .9 - fly * .4); el(-4, 0, 15, 7, 0); ink('#c3cad8', 3); X.restore();
  X.save(); X.translate(10, -10 + bob); el(0, 0, 10, 10); ink('#6fc3a8', 3); X.fillStyle = '#9aa3b8'; el(1, -3, 9, 6); X.fill();
  X.beginPath(); X.moveTo(8, -2); X.lineTo(17, 1); X.lineTo(8, 4); X.closePath(); ink('#ffb84d', 2);
  X.fillStyle = '#fff'; el(3, -3, 3.4, 3.6); X.fill(); X.fillStyle = INK; el(4 + (fly ? 0 : 1), -3, 1.8, 2.2); X.fill();
  if (coin) grabCoin(17, 6, 9, T * 10);
  X.restore();
  X.restore();
}
/* the baked plaza: sky, hills, a bank with columns, a café with an awning, the lamp post, bunting and cobbles */
let GR_FG = null;
function grabBg() {
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cv = mk(), fg = mk(), old = X; X = cv.getContext('2d');
  let gr = X.createLinearGradient(0, 0, 0, 372); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
  X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(0, 372); for (let x = 0; x <= W; x += 20) X.lineTo(x, 292 - Math.sin(x * .011 + 1) * 20 - Math.sin(x * .027) * 8); X.lineTo(W, 372); X.fill();
  X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(0, 372); for (let x = 0; x <= W; x += 20) X.lineTo(x, 318 - Math.sin(x * .014 + 3) * 14); X.lineTo(W, 372); X.closePath(); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
  const tree = (x, y, r, dark) => {
    rr(x - 7, y, 14, 372 - y, 5); ink('#8a5a34', 3);
    const blobs = [[0, 0, r], [-r * .7, r * .25, r * .7], [r * .7, r * .25, r * .72], [0, -r * .55, r * .72]];
    for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a, y + b, c, 0, TAU); ink(null, 3.5); }
    for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a, y + b, c, 0, TAU); X.fillStyle = dark ? '#2f9a55' : '#3fb260'; X.fill(); }
    for (const [a, b, c] of blobs) { X.beginPath(); X.arc(x + a - c * .2, y + b - c * .25, c * .72, 0, TAU); X.fillStyle = dark ? '#43b366' : '#5bcf72'; X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.28)'; for (const [a, b, c] of blobs.slice(1)) { el(x + a - c * .35, y + b - c * .45, c * .25, c * .14, -.5); X.fill(); }
  };
  tree(318, 300, 36, true); tree(552, 292, 42, false);
  // hedge along the back of the plaza
  for (let x = 250; x < 580; x += 34) { X.beginPath(); X.arc(x, 372, 20, Math.PI, 0); ink('#3fb260', 3); X.fillStyle = 'rgba(255,255,255,.18)'; el(x - 6, 362, 7, 4, -.4); X.fill(); }
  // the plaza floor
  gr = X.createLinearGradient(0, 372, 0, 600); gr.addColorStop(0, '#f2dfb2'); gr.addColorStop(1, '#d4b07a'); X.fillStyle = gr; X.fillRect(0, 372, W, 228);
  X.strokeStyle = 'rgba(150,104,52,.32)'; X.lineWidth = 2;
  for (let r = 0, y = 380, hh = 9; y < 600; r++, y += hh + 3, hh *= 1.22) { const cw = 30 + r * 9; for (let x = -(r % 2) * cw / 2; x < W; x += cw) { rr(x + 2, y, cw - 4, hh, Math.min(6, hh / 2)); X.stroke(); } }
  X.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, 600); X.lineTo(i * 90 + 45, 600); X.lineTo(i * 90 + 145, 374); X.lineTo(i * 90 + 100, 374); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 372); X.lineTo(W, 372); X.stroke();
  // the bank (left): pediment with a coin, four columns, steps
  rr(14, 244, 238, 128, 4); ink('#efe4cc', 4); X.fillStyle = '#ded0b2'; X.fillRect(14, 244, 238, 12);
  rr(68, 286, 128, 86, 6); ink('#5a3b2e', 3.5); X.fillStyle = '#7a5040'; X.fillRect(68, 286, 128, 10);
  for (const cx of [40, 92, 172, 224]) { cel('#fffaf0', '#d8ccb4', () => rr(cx - 12, 252, 24, 112, 4), 5, 0, 3); rr(cx - 16, 248, 32, 9, 3); ink('#fffaf0', 2.5); }
  X.beginPath(); X.moveTo(4, 248); X.lineTo(133, 196); X.lineTo(262, 248); X.closePath(); ink('#f6eedb', 4); X.fillStyle = '#ded0b2'; X.fillRect(18, 240, 230, 6);
  X.beginPath(); X.arc(133, 228, 15, 0, TAU); ink('#FFC93C', 3); X.fillStyle = '#c7861a'; X.font = '900 18px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('$', 133, 229);
  for (let i = 0; i < 3; i++) { rr(4 + i * 8, 362 - i * 7, 258 - i * 16, 10, 3); ink(i % 2 ? '#e2d5ba' : '#efe4cc', 2.5); }
  // the café (right): wall, window with a cup, striped awning, a little table
  rr(560, 232, 250, 140, 4); ink('#ffcf8a', 4); X.fillStyle = '#f2b868'; for (let y = 248; y < 370; y += 18) X.fillRect(560, y, 250, 3);
  rr(586, 286, 120, 70, 8); ink('#3d5a80', 4); X.fillStyle = 'rgba(255,255,255,.3)'; X.beginPath(); X.moveTo(596, 350); X.lineTo(626, 292); X.lineTo(642, 292); X.lineTo(612, 350); X.fill();
  rr(726, 300, 60, 72, 6); ink('#7a5040', 3.5); X.beginPath(); X.arc(772, 338, 4, 0, TAU); ink('#FFE14D', 2);
  for (let i = 0; i < 10; i++) { X.beginPath(); X.moveTo(554 + i * 26, 248); X.lineTo(580 + i * 26, 248); X.lineTo(580 + i * 26, 268); X.arc(567 + i * 26, 268, 13, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff6e6' : '#ff5d5d', 3); }
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(560, 282, 250, 6);
  rr(632, 214, 104, 28, 10); ink('#5a3b2e', 3.5); X.beginPath(); rr(668, 220, 22, 16, 4); ink('#fff', 2); X.beginPath(); X.arc(692, 228, 5, -1.2, 1.2); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
  X.strokeStyle = '#fff'; X.lineWidth = 2.5; for (const sx2 of [674, 684]) { X.beginPath(); X.moveTo(sx2, 217); X.quadraticCurveTo(sx2 + 3, 212, sx2, 207); X.stroke(); }
  // planters with flowers by the doors
  for (const [px, py] of [[278, 372], [540, 372]]) { rr(px - 16, py - 24, 32, 26, 5); ink('#d9944f', 3); for (const [a, b, c] of [[-8, -30, '#ff5c8a'], [0, -36, '#FFE14D'], [8, -30, '#ff5c8a']]) { X.beginPath(); X.arc(px + a, py + b, 6, 0, TAU); ink(c, 2.5); } }
  // the lamp post (the pigeon stands on the lantern)
  rr(GR_LAMP - 5, 236, 10, 136, 3); ink('#3b3550', 3); rr(GR_LAMP - 14, 362, 28, 12, 4); ink('#3b3550', 3);
  rr(GR_LAMP - 15, 222, 30, 26, 6); ink('#fff3a0', 3); X.beginPath(); X.moveTo(GR_LAMP - 19, 224); X.lineTo(GR_LAMP + 19, 224); X.lineTo(GR_LAMP + 11, 214); X.lineTo(GR_LAMP - 11, 214); X.closePath(); ink('#3b3550', 3);
  // bunting across the top (hangs below the hint line)
  const bunt = x => 62 + Math.sin(((x + 40) / 880) * Math.PI) * 14;
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); for (let x = -20; x <= W + 20; x += 10) x === -20 ? X.moveTo(x, bunt(x)) : X.lineTo(x, bunt(x)); X.stroke();
  const fc = ['#ff5d5d', '#FFE14D', '#6EA8FE', '#5CFF7A', '#ff8ad0'];
  for (let i = 0, x = -6; x < W + 10; i++, x += 38) { const y1 = bunt(x), y2 = bunt(x + 26); X.beginPath(); X.moveTo(x, y1); X.lineTo(x + 26, y2); X.lineTo(x + 13, (y1 + y2) / 2 + 24); X.closePath(); ink(fc[i % fc.length], 2.5); }
  // the roofs that sit in front of the drifting clouds
  X = fg.getContext('2d');
  X.beginPath(); X.moveTo(4, 248); X.lineTo(133, 196); X.lineTo(262, 248); X.closePath(); ink('#f6eedb', 4); X.fillStyle = '#ded0b2'; X.fillRect(18, 240, 230, 6);
  X.beginPath(); X.arc(133, 228, 15, 0, TAU); ink('#FFC93C', 3); X.fillStyle = '#c7861a'; X.font = '900 18px "Arial Black", Impact, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('$', 133, 229);
  rr(560, 232, 250, 16, 4); ink('#ffcf8a', 4);
  for (let i = 0; i < 10; i++) { X.beginPath(); X.moveTo(554 + i * 26, 248); X.lineTo(580 + i * 26, 248); X.lineTo(580 + i * 26, 268); X.arc(567 + i * 26, 268, 13, 0, Math.PI); X.closePath(); ink(i % 2 ? '#fff6e6' : '#ff5d5d', 3); }
  rr(632, 214, 104, 28, 10); ink('#5a3b2e', 3.5); rr(668, 220, 22, 16, 4); ink('#fff', 2); X.beginPath(); X.arc(692, 228, 5, -1.2, 1.2); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
  X.strokeStyle = '#fff'; X.lineWidth = 2.5; for (const sx2 of [674, 684]) { X.beginPath(); X.moveTo(sx2, 217); X.quadraticCurveTo(sx2 + 3, 212, sx2, 207); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); for (let x = -20; x <= W + 20; x += 10) x === -20 ? X.moveTo(x, bunt(x)) : X.lineTo(x, bunt(x)); X.stroke();
  for (let i = 0, x = -6; x < W + 10; i++, x += 38) { const y1 = bunt(x), y2 = bunt(x + 26); X.beginPath(); X.moveTo(x, y1); X.lineTo(x + 26, y2); X.lineTo(x + 13, (y1 + y2) / 2 + 24); X.closePath(); ink(fc[i % fc.length], 2.5); }
  X = old; GR_FG = fg; return cv;
}
reg('pt_grab', ptGrab, 'GRAB!');

})();
