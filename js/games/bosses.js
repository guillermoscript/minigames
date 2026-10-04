'use strict';
/* Boss games: longer, tougher, end a stage. Each takes (speed, stageDef) and returns a microgame
   object with boss:true (dur is NOT scaled by speed for bosses). */

/* ───────────── MEGA BUG art (stage 1 boss), in the DUO look (docs/ART-STYLE.md) ─────────────
   A park picnic on a gingham blanket: a crowned ladybug the size of a sofa runs riot, Claude waits with a flyswatter,
   ants on the horizon walk off with a slice of our cake. Win: the bug goes flat and its crown flies onto Claude's head.
   Lose: the bug strolls to the birthday cake and eats it, laughing. ART ONLY: no RNG calls (cosmetic noise is a hash). */
const BUGART = (() => {
  const TAU = Math.PI * 2;
  let X = null;                                  // set to ctx (or a bake canvas) when drawing; ctx may not exist at load time (node catalog scripts)
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k * k * (3 - 2 * k), outBack = k => { const c = 1.70158; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic, never touches Math.random
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  /* cel shading: f() builds the path; the shade stays as a crescent on the (sx, sy) side */
  function cel(f, base, shade, sx, sy, o = 4) { f(); ink(shade, o); X.save(); f(); X.clip(); X.translate(-sx, -sy); f(); X.fillStyle = base; X.fill(); X.restore(); }
  function glint(f, x, y, rx, ry, col, rot = -.5) { X.save(); f(); X.clip(); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
  function tube(pts, w, col) { X.lineJoin = 'round'; X.lineCap = 'round'; X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.strokeStyle = INK; X.lineWidth = w + 7; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
  function pill(x, y, label, col) {
    X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 26);
    X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
    rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
    txt(label, x, y + 1, 17, INK, 'center', w - 14);
  }
  function badge(s, x, y, size, bgc, rot) {
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(320, X.measureText(t(s)).width + size * .9), h = size * 1.45;
    X.save(); X.translate(x, y); X.rotate(rot);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .46); ink(bgc, 4); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 8, -h / 2 + 5, w - 16, h * .26, h * .13); X.fill();
    txt(s, 0, 2, size, '#fff', 'center', w - 18); X.restore();
  }
  function crown(x, y, s, rot) {
    X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(s, s); X.beginPath(); X.moveTo(-16, 6); X.lineTo(-18, -10); X.lineTo(-8, -2); X.lineTo(0, -14); X.lineTo(8, -2); X.lineTo(18, -10); X.lineTo(16, 6); X.closePath(); ink('#ffd23f', 3);
    X.fillStyle = '#fff3a0'; el(-9, -1, 3, 1.6, -.5); X.fill();
    for (const [a, c] of [[-8, '#ff4d6d'], [0, '#4db8ff'], [8, '#5CFF7A']]) { X.beginPath(); X.arc(a, 2, 2.6, 0, TAU); X.fillStyle = c; X.fill(); } X.restore();
  }
  function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }

  /* ── the baked park + blanket (static), VW wide so wide screens get scenery on the sides ── */
  const BLK = { ty: 202, tl: 168, tr: 632, by: 650, bl: -70, br: 870 };          // the blanket: a perspective quad
  const onBlk = (u, v) => { const y = lerp(BLK.ty, BLK.by, v); return [lerp(lerp(BLK.tl, BLK.bl, v), lerp(BLK.tr, BLK.br, v), u), y]; };
  let BG = null, BGW = 0;
  function tree(x, y, r) {
    rr(x - 5, y - 4, 10, r * 1.3, 4); ink('#8a5a34', 3);
    const f = () => { X.beginPath(); X.arc(x, y - r * .3, r, 0, TAU); X.arc(x - r * .7, y + r * .1, r * .7, 0, TAU); X.arc(x + r * .7, y + r * .1, r * .7, 0, TAU); };
    f(); X.lineWidth = 6; X.strokeStyle = INK; X.stroke(); X.fillStyle = '#2f9a55'; X.fill();
    X.fillStyle = '#3fb260'; X.beginPath(); X.arc(x - 3, y - r * .45, r * .78, 0, TAU); X.fill();
    X.fillStyle = 'rgba(255,255,255,.28)'; el(x - r * .4, y - r * .75, r * .32, r * .18, -.5); X.fill();
  }
  function tuft(x, y) { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y - 7); X.lineTo(x - 2, y); X.moveTo(x, y - 10); X.lineTo(x, y); X.moveTo(x + 6, y - 7); X.lineTo(x + 2, y); X.stroke(); }
  function flower(x, y, c) { X.fillStyle = c; for (let i = 0; i < 5; i++) { el(x + Math.cos(i * 1.256) * 4, y + Math.sin(i * 1.256) * 4, 3.4, 3.4); X.fill(); } X.fillStyle = '#ffe14d'; el(x, y, 2.6, 2.6); X.fill(); }
  function basket(x, y) {             // wicker picnic basket at the back of the blanket
    rr(x - 34, y - 26, 68, 34, 8); X.lineWidth = 7; X.strokeStyle = INK; X.stroke();
    X.beginPath(); X.arc(x, y - 22, 26, Math.PI, TAU); X.lineWidth = 12; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#a5622c'; X.stroke();
    cel(() => rr(x - 34, y - 26, 68, 34, 8), '#d9944f', '#a5622c', 4, 5, 3.5);
    X.strokeStyle = '#a5622c'; X.lineWidth = 2; for (let i = -24; i <= 24; i += 12) { X.beginPath(); X.moveTo(x + i, y - 22); X.lineTo(x + i, y + 4); X.stroke(); }
    X.beginPath(); X.moveTo(x - 26, y - 26); X.quadraticCurveTo(x - 10, y - 38, x + 4, y - 26); X.closePath(); ink('#ff4d5e', 2.5);   // napkin sticking out
    X.fillStyle = '#fff'; el(x - 12, y - 30, 3, 2); X.fill();
    X.fillStyle = 'rgba(255,255,255,.35)'; el(x - 20, y - 18, 9, 4, -.3); X.fill();
  }
  function sandwichPlate(x, y) {
    el(x, y, 34, 11); ink('#f6f4fb', 3); X.fillStyle = '#cfd8e6'; el(x, y + 1, 24, 6); X.fill();
    X.beginPath(); X.moveTo(x - 22, y - 2); X.lineTo(x + 20, y - 2); X.lineTo(x - 4, y - 26); X.closePath(); ink('#f7d297', 3);
    X.fillStyle = '#71d64b'; X.fillRect(x - 18, y - 6, 34, 3); X.fillStyle = '#ff7a6a'; X.fillRect(x - 16, y - 9, 28, 3);
  }
  function lemonade(x, y) {
    rr(x - 13, y - 34, 26, 34, 6); ink('rgba(255,236,120,.9)', 3); X.fillStyle = 'rgba(255,255,255,.55)'; rr(x - 9, y - 30, 5, 22, 2.5); X.fill();
    X.fillStyle = '#ffe14d'; el(x + 4, y - 22, 5, 5); X.fill();
    tube([[x + 6, y - 32], [x + 10, y - 48], [x + 16, y - 50]], 3, '#ff5c8a');
  }
  function bake() {
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
    const L = -OX, R = W + OX;
    let g = X.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(L, 0, R - L, H);
    // far + near hills
    X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(L, 178); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 150 - Math.sin(x * .011 + 1) * 16 - Math.sin(x * .027) * 6); X.lineTo(R, 178); X.fill();
    X.fillStyle = '#87d19b'; X.beginPath(); X.moveTo(L, 180); for (let x = L; x <= R + 20; x += 20) X.lineTo(x, 166 - Math.sin(x * .014 + 3) * 10); X.lineTo(R + 20, 180); X.closePath(); X.fill(); X.strokeStyle = '#4f9a6a'; X.lineWidth = 3; X.stroke();
    for (const [x, r] of [[40, 15], [196, 11], [598, 13], [760, 17], [-120, 14], [930, 13]]) if (x > L - 30 && x < R + 30) tree(x, 160 - r * .4, r);
    // ground: hard horizon, grass gradient, light stripes
    g = X.createLinearGradient(0, 178, 0, H); g.addColorStop(0, '#8fdc5c'); g.addColorStop(1, '#5fb944'); X.fillStyle = g; X.fillRect(L, 178, R - L, H - 178);
    X.save(); X.beginPath(); X.rect(L, 180, R - L, H); X.clip(); X.strokeStyle = 'rgba(255,255,255,.12)'; X.lineWidth = 26;
    for (let x = L - 600; x < R + 200; x += 90) { X.beginPath(); X.moveTo(x, H); X.lineTo(x + 420, 178); X.stroke(); } X.restore();
    X.fillStyle = INK; X.fillRect(L, 176, R - L, 4);
    for (let i = 0; i < 46; i++) { const x = L + hash(i) * (R - L), y = 190 + hash(i + 50) * 400; const [l] = onBlk(0, clamp((y - BLK.ty) / (BLK.by - BLK.ty), 0, 1)), [r] = onBlk(1, clamp((y - BLK.ty) / (BLK.by - BLK.ty), 0, 1)); if (y > BLK.ty - 6 && x > l - 14 && x < r + 14) continue; if (i % 3) tuft(x, y); else flower(x, y, ['#fff', '#ff8fb1', '#b9a2ff'][i % 3 === 0 ? (i / 3 | 0) % 3 : 0]); }
    // gingham blanket (the bug's dance floor)
    X.save(); X.translate(5, 8); X.beginPath(); { const a = onBlk(0, 0), b = onBlk(1, 0), d = onBlk(1, 1), e = onBlk(0, 1); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.lineTo(d[0], d[1]); X.lineTo(e[0], e[1]); } X.closePath(); X.fillStyle = 'rgba(20,16,28,.18)'; X.fill(); X.restore();
    const NU = 12, NV = 9, vv = j => Math.pow(j / NV, 1.25);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const p = [onBlk(i / NU, vv(j)), onBlk((i + 1) / NU, vv(j)), onBlk((i + 1) / NU, vv(j + 1)), onBlk(i / NU, vv(j + 1))];
      X.beginPath(); p.forEach((q, k) => k ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])); X.closePath();
      X.fillStyle = (i % 2) && (j % 2) ? '#6f9fe6' : (i % 2) || (j % 2) ? '#a9c9f8' : '#f4f8ff'; X.fill();
    }
    X.beginPath(); { const a = onBlk(0, 0), b = onBlk(1, 0), d = onBlk(1, 1), e = onBlk(0, 1); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.lineTo(d[0], d[1]); X.lineTo(e[0], e[1]); } X.closePath(); X.lineWidth = 8; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke();
    X.strokeStyle = 'rgba(255,255,255,.5)'; X.lineWidth = 3; X.beginPath(); X.moveTo(BLK.tl + 6, BLK.ty + 5); X.lineTo(BLK.tr - 6, BLK.ty + 5); X.stroke();
    basket(232, 236); sandwichPlate(560, 232); lemonade(612, 246);
    X = old; return c;
  }

  /* ── live layers ── */
  function sun(T) {
    const x = 650, y = 70;                                         // high in the sky: rays end at y~126, above the hills
    X.save(); X.translate(x, y); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-7, -38); X.lineTo(0, -56); X.lineTo(7, -38); X.fill(); } X.restore();
    el(x, y, 30, 30); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(x - 9, y - 10, 10, 6, -.5); X.fill();
  }
  function cloud(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
  }
  /* background gag: a line of ants marches along the horizon carrying a slice of OUR cake */
  function ants(T, tt, stop) {
    const x0 = 120 + tt * 40, y = 192;                            // game clock: starts on screen, crosses ~x 120 -> 440 in one fight
    const ant = (x, k) => {
      const st = stop ? 0 : Math.sin(T * 18 + k * 2) * 2;
      X.strokeStyle = INK; X.lineWidth = 2; X.lineCap = 'round';
      for (const d of [-4, 0, 4]) { X.beginPath(); X.moveTo(x + d, y - 4); X.lineTo(x + d - 2 + (d ? st : -st), y + 3); X.stroke(); }
      X.fillStyle = INK; el(x - 6, y - 6, 5, 4); X.fill(); el(x + 1, y - 6, 3.4, 3); X.fill(); el(x + 7, y - 8, 4, 3.6); X.fill();
      X.beginPath(); X.moveTo(x + 9, y - 11); X.lineTo(x + 13, y - 17); X.stroke();
      X.fillStyle = '#fff'; el(x + 8.5, y - 9, 1.2, 1.2); X.fill();
    };
    for (let k = 0; k < 4; k++) ant(x0 - k * 26, k);
    // the slice of cake, held overhead by the middle two
    const cx = x0 - 39, cy = y - 22 + (stop ? 0 : Math.sin(T * 9) * 1.5);
    X.beginPath(); X.moveTo(cx - 24, cy + 6); X.lineTo(cx + 22, cy + 6); X.lineTo(cx + 22, cy - 10); X.closePath(); ink('#ffb3c7', 2.5);
    X.fillStyle = '#fff4f8'; X.beginPath(); X.moveTo(cx - 24, cy + 6); X.lineTo(cx + 22, cy - 10); X.lineTo(cx + 22, cy - 6); X.lineTo(cx - 20, cy + 6); X.fill();
    X.beginPath(); X.arc(cx + 16, cy - 14, 4, 0, TAU); ink('#ff4d5e', 2);
  }
  /* the scoreboard: a wooden sign on strings with the bug's health in red */
  function sign(T, hp, hpv, max, flash, sq, result) {
    const cx = 400, y = 64, w = 336, h = 58;
    X.save(); X.translate(cx, 0); X.rotate(Math.sin(T * 1.3) * .012 + Math.sin(T * 40) * sq * .06); X.translate(-cx, 0);
    tube([[cx - 130, -10], [cx - 130, y + 6]], 3, '#e6c58c'); tube([[cx + 130, -10], [cx + 130, y + 6]], 3, '#e6c58c');
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(cx - w / 2 + 4, y + 7 + 7, w, h, 16); X.fill();
    rr(cx - w / 2, y + 7, w, h, 16); ink('#a5622c', 4);
    rr(cx - w / 2, y, w, h, 16); ink('#d9944f', 4);
    X.strokeStyle = '#c98443'; X.lineWidth = 2; for (const gy of [y + 16, y + 42]) { X.beginPath(); X.moveTo(cx - w / 2 + 22, gy); X.bezierCurveTo(cx - 60, gy - 4, cx + 40, gy + 4, cx + w / 2 - 22, gy); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.3)'; rr(cx - w / 2 + 10, y + 5, w - 20, 8, 4); X.fill();
    // nails + a tiny bug portrait
    for (const nx of [cx - 130, cx + 130]) { el(nx, y + 8, 3, 3); X.fillStyle = '#8f9cb3'; X.fill(); }
    const ix = cx - w / 2 + 34, iy = y + h / 2 + 1;
    el(ix, iy - 2, 18, 15); ink(result === 'win' ? '#c9e04a' : '#e8433a', 3); X.fillStyle = INK; el(ix - 8, iy - 7, 3.4, 3.4); X.fill(); el(ix + 7, iy - 8, 3, 3); X.fill();
    el(ix, iy + 9, 13, 8); ink('#3d3252', 3); X.fillStyle = '#fff'; el(ix - 5, iy + 8, 2.4, 2.4); X.fill(); el(ix + 5, iy + 8, 2.4, 2.4); X.fill();
    crown(ix, iy - 20, .55, -.2);
    // name + health bar
    txt(result === 'win' ? 'SPLAT!' : 'MEGA BUG', cx + 26, y + 15, 16, result === 'win' ? '#FFE14D' : '#fff', 'center', 220);
    const bx = cx - w / 2 + 64, by = y + 28, bw = w - 82, bh = 20;
    rr(bx, by, bw, bh, 10); ink('#5a3418', 3);
    X.save(); rr(bx, by, bw, bh, 10); X.clip();
    X.fillStyle = '#FFE14D'; X.fillRect(bx, by, bw * hpv / max, bh);
    X.fillStyle = flash > 0 ? '#fff' : '#ff4d5e'; X.fillRect(bx, by, bw * hp / max, bh);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(bx, by + 3, bw * Math.max(hp, hpv) / max, 5);
    X.fillStyle = 'rgba(20,16,28,.55)'; for (let i = 1; i < max; i++) X.fillRect(bx + bw * i / max - 1, by, 2, bh);
    X.restore();
    X.restore();
  }
  /* the birthday cake (the bug's real target); bites 0..3 */
  function cake(x, y, bites, T) {
    X.fillStyle = 'rgba(20,16,28,.25)'; el(x + 4, y + 6, 66, 16); X.fill();
    el(x, y, 64, 17); ink('#f6f4fb', 3.5); X.fillStyle = '#cfd8e6'; el(x, y + 2, 48, 10); X.fill();
    X.save();
    if (bites) { X.beginPath(); X.rect(x - 70, y - 130, 140, 140); const B = [[x + 44, y - 58, 22], [x - 44, y - 70, 20], [x + 8, y - 84, 22]]; for (let i = 0; i < bites; i++) { X.moveTo(B[i][0] + B[i][2], B[i][1]); X.arc(B[i][0], B[i][1], B[i][2], 0, TAU); } X.clip('evenodd'); }
    const body = () => { X.beginPath(); X.moveTo(x - 48, y - 62); X.lineTo(x - 48, y - 6); X.ellipse(x, y - 6, 48, 13, 0, Math.PI, 0, true); X.lineTo(x + 48, y - 62); X.closePath(); };
    cel(body, '#ffb3c7', '#e57f9e', 8, 0, 4);
    X.fillStyle = '#fff4f8'; X.fillRect(x - 46, y - 36, 92, 6);
    el(x, y - 62, 48, 14); ink('#fff4f8', 4);
    X.fillStyle = '#fff4f8'; for (const d of [-34, -14, 10, 30]) { rr(x + d - 5, y - 62, 10, 16 + (d & 3) * 2, 5); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.6)'; el(x - 26, y - 46, 6, 14, .1); X.fill();
    for (const [a, b] of [[-24, -64], [6, -68], [26, -60]]) { X.fillStyle = ['#ff4d5e', '#4db8ff', '#5CFF7A'][(a + 30) % 3]; rr(x + a - 2, y + b - 1, 5, 3, 1.5); X.fill(); }
    rr(x - 4, y - 96, 8, 28, 3); ink('#6EA8FE', 2.5); X.fillStyle = 'rgba(255,255,255,.6)'; X.fillRect(x - 3, y - 90, 2, 18);
    if (bites < 3) { const fl = Math.sin(T * 22) * 2; X.beginPath(); X.moveTo(x, y - 116 + fl); X.quadraticCurveTo(x + 8, y - 102, x, y - 97); X.quadraticCurveTo(x - 8, y - 102, x, y - 116 + fl); ink('#ffd23f', 2); X.fillStyle = '#fff3a0'; el(x, y - 103, 2.5, 4); X.fill(); }
    X.restore();
    if (bites) { X.fillStyle = '#ffb3c7'; for (let i = 0; i < bites * 3; i++) { el(x - 40 + hash(i + 9) * 80, y + 4 + hash(i + 19) * 10, 3, 2.2); X.fill(); } }
  }
  /* Claude with a flyswatter: arms are claude()'s blocky stubs; the swatter rides on the right hand */
  function hero(x, y, u, o) {
    const ol = Math.max(3, u * .5), L = 3.3 * u, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
    X.save(); X.translate(x, y);
    const arm = (sx, an, swat) => {
      X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
      if (swat) {                                                  // the flyswatter: handle + a mesh head
        const hy = -L - gap - hs / 2;
        tube([[0, hy], [0, hy - 62]], 5, '#ffd23f');
        rr(-24, hy - 112, 48, 54, 12); ink('#4fd06a', 4);
        X.save(); rr(-24, hy - 112, 48, 54, 12); X.clip(); X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2;
        for (let i = -20; i <= 20; i += 8) { X.beginPath(); X.moveTo(i, hy - 114); X.lineTo(i, hy - 56); X.stroke(); X.beginPath(); X.moveTo(-26, hy - 108 + i + 22); X.lineTo(26, hy - 108 + i + 22); X.stroke(); }
        X.fillStyle = 'rgba(255,255,255,.4)'; el(-10, hy - 100, 8, 5, -.5); X.fill(); X.restore();
        if (o.goo) { X.fillStyle = '#c9e04a'; X.beginPath(); X.arc(6, hy - 80, 10, 0, TAU); X.arc(-8, hy - 72, 7, 0, TAU); X.fill(); }
      }
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
      X.fillStyle = OR; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
      X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(-hs / 2 + 2, -L - gap - hs + 2, hs * .35, hs * .3);
      X.restore();
    };
    arm(-1, o.la, false); arm(1, o.ra, true);
    claude(0, 0, u, { mood: o.mood });
    if (o.crown) crown(0, -9 * u - 8, 1.1, -.12);
    if (o.sweat) sweat(-5 * u, -8 * u, 1.2, o.T);
    X.restore();
  }

  /* ── the bug. origin = body centre, feet near +64. o: { mood, look:[x,y], T, legT, sq, flash, dmg, lean, chomp } ── */
  const RED = '#e8433a', RED2 = '#b5282d', HEAD = '#3d3252', HEAD2 = '#271f38';
  function eye(x, y, r, mood, look, T, k) {
    if (mood === 'happy') { X.lineWidth = r * .5; X.strokeStyle = '#fff'; X.lineCap = 'round'; X.beginPath(); X.arc(x, y + r * .35, r * .7, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); return; }
    if (mood === 'bonk') { X.lineWidth = r * .42; X.strokeStyle = '#fff'; X.lineCap = 'round'; X.beginPath(); const s = k ? -1 : 1; X.moveTo(x - r * .7 * s, y - r * .6); X.lineTo(x + r * .5 * s, y); X.lineTo(x - r * .7 * s, y + r * .6); X.stroke(); return; }
    if (mood === 'dead') { X.lineWidth = r * .4; X.strokeStyle = '#fff'; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y + r * .6); X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y + r * .6); X.stroke(); return; }
    const big = mood === 'panic' ? 1.3 : 1;
    el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(2, r * .2));
    const blink = mood !== 'panic' && Math.sin(T * 1.9 + k * .2) > .985;
    if (blink) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const pr = mood === 'panic' ? r * .3 : r * .52, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38;
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
    X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .35, pr * .3); X.fill();
    if (mood === 'smug') { X.save(); el(x, y, r, r * 1.08); X.clip(); X.fillStyle = HEAD; X.fillRect(x - r - 2, y - r * 1.2, r * 2 + 4, r * .95); X.restore(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x - r, y - r * .2); X.lineTo(x + r, y - r * .2); X.stroke(); }
  }
  function bug(x, y, s, o) {
    const { mood, T } = o, look = o.look || [0, 0];
    X.save(); X.translate(x, y); X.rotate(o.lean || 0); X.scale(s * (1 + o.sq), s * (1 - o.sq * .8));
    // legs (behind)
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
      const w = Math.sin(o.legT * 25 + i * 2 + sd) * 8, lift = Math.max(0, w);
      tube([[sd * (30 + i * 8), 24 + i * 4], [sd * (74 + i * 12), 14 + i * 10 - lift], [sd * (66 + i * 20), 62 - lift * .6]], 8, HEAD);
    }
    // antennae (behind the shell top)
    for (const sd of [-1, 1]) {
      const wig = Math.sin(T * 6 + sd) * 6 + (mood === 'panic' ? Math.sin(T * 40 + sd) * 6 : 0), tx = sd * 46 + wig, ty = -104 + Math.abs(wig) * .4;
      X.beginPath(); X.moveTo(sd * 14, 0); X.quadraticCurveTo(sd * 18, -70, tx, ty); X.lineWidth = 12; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 5; X.strokeStyle = HEAD; X.stroke();
      el(tx, ty, 9, 9); ink(HEAD, 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(tx - 3, ty - 3, 3, 2, -.5); X.fill();
    }
    // shell
    const shell = () => el(0, -8, 82, 64);
    cel(shell, RED, RED2, 9, 7, 5);
    X.save(); shell(); X.clip();
    X.fillStyle = INK; for (const [a, b, r] of [[-46, -26, 13], [44, -30, 13], [-28, 14, 11], [36, 10, 11], [-14, -50, 9], [16, -52, 9], [-64, 6, 8], [66, 2, 8]]) { el(a, b, r, r * .9); X.fill(); }
    X.fillStyle = 'rgba(255,255,255,.18)'; for (const [a, b, r] of [[-46, -26, 13], [44, -30, 13], [-28, 14, 11], [36, 10, 11]]) { el(a - r * .3, b - r * .35, r * .35, r * .22, -.5); X.fill(); }
    X.restore();
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, -72); X.lineTo(0, 30); X.stroke();
    glint(shell, -38, -44, 26, 12, 'rgba(255,255,255,.5)', -.5);
    // band-aids, one per hit (up to 5): the fight leaves marks
    const AIDS = [[-48, -6, .6], [40, -44, -.5], [22, 22, .3], [-24, -50, -.2], [58, -10, 1.1]];
    for (let i = 0; i < Math.min(o.dmg, AIDS.length); i++) {
      const [a, b, r] = AIDS[i]; X.save(); X.translate(a, b); X.rotate(r);
      rr(-20, -7, 40, 14, 7); ink('#f2c79a', 2.5); rr(-7, -6, 14, 12, 3); X.fillStyle = '#e3a868'; X.fill();
      X.fillStyle = '#c4874e'; for (const d of [-14, 14]) { el(d, -2, 1.3, 1.3); X.fill(); el(d, 2.5, 1.3, 1.3); X.fill(); } X.restore();
    }
    // crown, knocked crooked as it gets hurt
    if (o.crown) crown(4 + o.dmg * 1.5, -76 + Math.abs(Math.sin(T * 12)) * -3, 1.25, .1 + o.dmg * .05 + Math.sin(T * 3) * .05);
    // head + face
    const head = () => el(0, 34, 52, 36);
    cel(head, HEAD, HEAD2, 6, 6, 5); glint(head, -22, 14, 14, 6, 'rgba(255,255,255,.22)', -.4);
    X.fillStyle = mood === 'panic' ? 'rgba(159,227,255,.55)' : 'rgba(255,110,165,.55)'; el(-34, 46, 9, 5); X.fill(); el(34, 46, 9, 5); X.fill();
    eye(-19, 26, 15, mood, look, T, 0); eye(19, 26, 15, mood, look, T, 1);
    X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round';                                // brows
    if (mood === 'smug') { X.beginPath(); X.moveTo(-34, 4); X.lineTo(-8, 12); X.moveTo(34, 4); X.lineTo(8, 12); X.stroke(); }
    else if (mood === 'worried' || mood === 'panic') { X.beginPath(); X.moveTo(-32, 12); X.lineTo(-10, 4); X.moveTo(32, 12); X.lineTo(10, 4); X.stroke(); }
    // mouth
    if (mood === 'smug') {
      X.beginPath(); X.moveTo(-20, 48); X.quadraticCurveTo(0, 62, 22, 46); X.closePath(); ink('#ff92ad', 2.5);
      X.fillStyle = '#fffbea'; for (const d of [-12, 8]) { X.beginPath(); X.moveTo(d, 50); X.lineTo(d + 4, 57); X.lineTo(d + 8, 50); X.fill(); }
    } else if (mood === 'worried') { X.strokeStyle = '#fff'; X.lineWidth = 3.5; X.beginPath(); for (let i = 0; i <= 6; i++) X.lineTo(-14 + i * 4.7, 52 + (i % 2 ? -3 : 3)); X.stroke(); }
    else if (mood === 'panic' || mood === 'bonk') { el(0, 54, 11, mood === 'bonk' ? 8 : 11); ink('#6e1838', 2.5); X.fillStyle = '#ff92ad'; el(0, 59, 7, 4); X.fill(); }
    else if (mood === 'happy') {                                   // chomping the cake, mouth open/shut
      const op = o.chomp ? 9 : 2; el(0, 52, 18, op); ink('#6e1838', 2.5);
      X.fillStyle = '#fffbea'; for (const d of [-10, 4]) { X.beginPath(); X.moveTo(d, 52 - op); X.lineTo(d + 3, 52 - op + 6); X.lineTo(d + 6, 52 - op); X.fill(); }
      X.fillStyle = '#ffb3c7'; el(22, 56, 5, 3.5); X.fill(); el(-20, 58, 4, 3); X.fill();          // frosting on the chin
    }
    if (o.flash > 0) { X.globalAlpha = Math.min(1, o.flash * 8) * .7; X.fillStyle = '#fff'; shell(); X.fill(); head(); X.fill(); X.globalAlpha = 1; }
    if (mood === 'worried' || mood === 'panic') { sweat(52, -6, 1.6, T); sweat(-58, 4, 1.3, T + .4); }
    X.restore();
  }
  /* a flattened bug: goo, a pancake shell, X eyes, splayed legs and springy antennae */
  function splat(x, y, k, T) {
    const sx = 1 + (1 - ease(clamp(k / .18, 0, 1))) * .4, sy = .3 + .7 * ease(clamp(k / .18, 0, 1));
    X.save(); X.translate(x, y + 44); X.scale(sx, 1);
    { const N = 14, pt = i => { const a = (i % N) / N * TAU, r = 1 + (i % 2 ? .2 : 0) + hash(i % N) * .14; return [Math.cos(a) * 124 * r, Math.sin(a) * 44 * r]; };   // a smooth lumpy puddle
      X.beginPath(); for (let i = 0; i <= N; i++) { const p = pt(i), q = pt(i + 1), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!i) X.moveTo(m[0], m[1]); else X.quadraticCurveTo(p[0], p[1], m[0], m[1]); } X.closePath(); ink('#c9e04a', 4); }
    X.fillStyle = '#9bb52c'; el(30, 10, 60, 16); X.fill(); X.fillStyle = 'rgba(255,255,255,.4)'; el(-60, -14, 26, 6, -.1); X.fill();
    for (const [a, b] of [[-150, -20], [158, 6], [-130, 34], [120, -40]]) { el(a, b, 8, 5); ink('#c9e04a', 2.5); }
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) tube([[sd * 50, -4 + i * 8], [sd * (112 + i * 6), -26 + i * 26]], 7, HEAD);
    X.scale(1, sy);
    el(0, -14, 96, 30); ink(RED, 5); X.fillStyle = RED2; el(10, -6, 84, 18); X.fill(); X.fillStyle = RED; el(0, -18, 86, 20); X.fill();
    X.fillStyle = INK; for (const [a, b, r] of [[-50, -18, 13], [46, -20, 13], [-16, -30, 8], [18, -32, 8]]) { el(a, b, r, r * .5); X.fill(); }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, -42); X.lineTo(0, 12); X.stroke();
    X.fillStyle = 'rgba(255,255,255,.45)'; el(-40, -32, 24, 6, -.1); X.fill();
    el(0, 14, 56, 18); ink(HEAD, 4);
    eye(-20, 12, 11, 'dead', [0, 0], T, 0); eye(20, 12, 11, 'dead', [0, 0], T, 1);
    X.beginPath(); X.moveTo(6, 22); X.quadraticCurveTo(18, 44, 8, 50); X.quadraticCurveTo(0, 46, 2, 24); ink('#ff92ad', 2.5);
    // antennae bent into springs
    for (const sd of [-1, 1]) { X.beginPath(); for (let i = 0; i <= 14; i++) X.lineTo(sd * (16 + i * 3.4) + Math.sin(i * 1.6 + T * 30 * (1 - clamp(k, 0, 1))) * 5, -4 - i * 3.6); X.lineWidth = 9; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = HEAD; X.stroke(); }
    X.restore();
    for (let i = 0; i < 3; i++) { const a = T * 5 + i * TAU / 3; star(x + Math.cos(a) * 70, y + 4 + Math.sin(a) * 18, 9, 4, 5, a, '#FFE14D', 3); }
  }
  function speech(x, y, s) {
    X.font = '900 22px "Arial Black", Impact, sans-serif'; const w = X.measureText(t(s)).width + 30;
    X.beginPath(); X.moveTo(x - 12, y + 16); X.lineTo(x - 22, y + 34); X.lineTo(x + 6, y + 16); X.closePath(); ink('#fff', 3);
    rr(x - w / 2, y - 20, w, 40, 20); ink('#fff', 3); txt(s, x, y + 1, 22, '#ff4d5e', 'center', w - 16);
  }

  function draw(st) {
    X = ctx; const T = now, { b, max, hp, hpv, flash, sq, result, ec, t: tt } = st;
    if (!BG || BGW !== VW) { BG = bake(); BGW = VW; }
    ctx.drawImage(BG, -OX, 0);
    sun(T);
    for (const [sp, off, y, s] of [[7, 0, 112, .62], [5, 430, 138, .5], [9, 760, 96, .45]]) cloud(((T * sp + off) % (VW + 200)) - OX - 100, y, s);
    ants(T, tt, result === 'win');
    // the cake + Claude live at the front corners
    const CK = [712, 532], CL = [96, 578];
    const bites = result === 'lose' ? clamp(Math.floor((ec - .5) / .14) + 1, 0, 3) : 0;
    if (result !== 'lose') cake(CK[0], CK[1], bites, T);          // on a loss the cake is drawn after the bug, so the bites stay readable
    const win = result === 'win', lose = result === 'lose';
    const swing = sq > 0 ? sq / .2 : 0;
    let ra = -.35 + Math.sin(T * 3) * .08, la = -.5 + Math.sin(T * 3 + 1) * .1, hop = Math.sin(T * 1.6) * 2;
    if (swing) { ra = lerp(-.35, 1.5, ease(swing)); la = -.9; }
    if (win) { ra = -.5 + Math.sin(T * 10) * .35; la = -.9 - Math.sin(T * 10) * .25; hop = -Math.abs(Math.sin(T * 9)) * 16; }
    if (lose) { ra = .9; la = -2.6; hop = 2; }                       // swatter drooping beside him, still on screen
    shadow(CL[0], CL[1] + 2, 34, 8, .3);
    const crownK = win ? clamp((ec - .12) / .55, 0, 1) : 0;
    hero(CL[0], CL[1] + hop, 4.8, { la, ra, mood: win ? 'happy' : lose ? 'sad' : null, crown: crownK >= 1, sweat: lose || (!result && tt > 5.5), goo: win, T });
    if (!win) pill(CL[0] - 34, CL[1] - 9 * 4.8 - 30, 'YOU', '#FFE14D');
    // the bug
    const dk = .78 + clamp((b.y - 170) / 280, 0, 1) * .28;          // art-only depth scale (hitbox stays 110)
    if (win) {
      splat(b.x, b.y, ec, T);
      if (crownK < 1) { const k = ease(crownK), cx = lerp(b.x, CL[0], k), cy = lerp(b.y - 80, CL[1] + hop - 9 * 4.8 - 8, k) - Math.sin(k * Math.PI) * 170; crown(cx, cy, 1.25 - k * .15, (1 - k) * TAU * 2); }
      // the NICE! stamp covers roughly y 180-420 in the middle: the badge sits below it, between Claude and the cake
      const bx = clamp(b.x, 300, 500), by = clamp(b.y + 130, 465, 545);
      badge('SPLAT!', bx, by, 34, '#ff4d5e', -.08 + Math.sin(T * 6) * .03);
    } else {
      let x = b.x, y = b.y, s = dk, mood, look = [Math.cos(b.a), Math.sin(b.a)], chomp = false, lean = clamp(Math.cos(b.a), -1, 1) * .12, legT = now * 1.5, bob = -Math.abs(Math.sin(T * 12)) * 5;
      if (lose) {
        const k = ease(clamp(ec / .45, 0, 1)), tx = CK[0] - 165, ty = CK[1] - 95;      // stops beside the cake, not on it
        x = lerp(b.x, tx, k); y = lerp(b.y, ty, k); s = lerp(dk, .85, k); mood = k < 1 ? 'smug' : 'happy'; look = [1, 0]; chomp = Math.sin(ec * 22) > 0; lean = k < 1 ? .1 : .18; legT = k < 1 ? legT : 0; bob = k < 1 ? bob : -Math.abs(Math.sin(T * 14)) * 4;
      } else mood = flash > 0 ? 'bonk' : hp > max * .6 ? 'smug' : hp > max * .25 ? 'worried' : 'panic';
      shadow(x, y + 64 * s, (70 + sq * 60) * s, 16 * s, .28);
      bug(x, y + bob, s, { mood, look, T, legT, sq, flash, dmg: max - hp, lean, crown: true, chomp });
      if (lose) { cake(CK[0], CK[1], bites, T); if (ec > .45) speech(x - 10, y - 130, 'HA HA!'); }
    }
    sign(T, hp, hpv, max, flash, sq, result);                        // drawn last so the bug's antennae never cover the health bar
    vignette(.18);
  }
  return { draw };
})();

/* ───────────── STEAMROLLER BOSS art (stage 3 boss "stomp"), in the DUO look (docs/ART-STYLE.md) ─────────────
   A roadworks street: a pigeon in a hard hat drives a steamroller after Claude, who hurdles striped barriers, cones and
   concrete blocks. A crane in the background swings a rubber duck. Win: the roller wheezes, backs off with a white flag and a
   dizzy pigeon. Lose: it rolls right over Claude, who is left flat as a pancake. ART ONLY: no RNG calls (noise is a hash). */
const STOMPART = (() => {
  const TAU = Math.PI * 2, GY = 452;                                  // GY: where the tyres touch the road
  let X = null;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k * k * (3 - 2 * k), outBack = k => { const c = 1.70158; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function cel(f, base, shade, sx, sy, o = 4) { f(); ink(shade, o); X.save(); f(); X.clip(); X.translate(-sx, -sy); f(); X.fillStyle = base; X.fill(); X.restore(); }
  function tube(pts, w, col) { X.lineJoin = 'round'; X.lineCap = 'round'; X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.strokeStyle = INK; X.lineWidth = w + 7; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
  function pill(x, y, label, col) {
    X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 26);
    X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
    rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
    txt(label, x, y + 1, 17, INK, 'center', w - 14);
  }
  function heart(x, y, s, col) { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 7); X.bezierCurveTo(-14, -2, -8, -12, 0, -5); X.bezierCurveTo(8, -12, 14, -2, 0, 7); X.closePath(); ink(col, 2.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(-4, -3, 2, 1.2, -.5); X.fill(); X.restore(); }
  function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -8); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
  function puff(x, y, r, a) { X.globalAlpha = a; X.fillStyle = '#e4f5ff'; X.strokeStyle = '#8f9cb3'; X.lineWidth = 2.5; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); X.stroke(); X.fillStyle = '#fff'; X.beginPath(); X.arc(x - r * .25, y - r * .3, r * .55, 0, TAU); X.fill(); X.globalAlpha = 1; }
  /* eye: white sclera, pupil looking at the action, highlight dot; moods: mad, glee, dizzy, wide */
  function eye(x, y, r, mood, look, T, k) {
    if (mood === 'dizzy') { X.strokeStyle = INK; X.lineWidth = 2.6; X.beginPath(); for (let i = 0; i < 28; i++) { const a = i * .5 + T * 6 + k, rad = 1 + i * r * .028; X.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } X.stroke(); return; }
    const big = mood === 'wide' ? 1.25 : 1;
    el(x, y, r * big, r * 1.08 * big); ink('#fff', r * .28);
    const pr = r * (mood === 'wide' ? .34 : .52) * big, px = x + look * r * .38, py = y + (mood === 'glee' ? r * .1 : 0);
    X.fillStyle = INK; el(px, py, pr, pr); X.fill(); X.fillStyle = '#fff'; el(px - pr * .35, py - pr * .4, pr * .35, pr * .35); X.fill();
    if (Math.sin(T * 1.9 + k) > .985) { X.fillStyle = '#c9ced6'; el(x, y, r * 1.1, r * 1.12); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x - r, y); X.lineTo(x + r, y); X.stroke(); }
  }

  /* ── baked layers: SKY (under the live sun and clouds) and STREET (skyline, buildings, sidewalk, road) ── */
  let SKY = null, ST = null, BW = 0;
  function bakeSky() {
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
    const g = X.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#36b0ea'); g.addColorStop(.55, '#86d8fb'); g.addColorStop(1, '#d6f7ff');
    X.fillStyle = g; X.fillRect(-OX, 0, VW, 400); X = old; return c;
  }
  function building(x, bot, w, h, base, shade, i, awning) {
    const y = bot - h; cel(() => rr(x, y, w, h, 6), base, shade, 9, 0, 3.5);
    X.save(); rr(x, y, w, h, 6); X.clip(); X.fillStyle = 'rgba(255,255,255,.28)'; el(x + 14, y + 16, 9, 24, -.3); X.fill(); X.restore();
    rr(x - 4, y - 7, w + 8, 12, 5); ink(shade, 3);                                        // roof cap
    const cols = Math.max(2, Math.floor((w - 16) / 30)), gap = (w - 16) / cols;
    for (let r = 0; r < Math.floor((h - 52) / 36); r++) for (let cI = 0; cI < cols; cI++) {
      const wx = x + 8 + cI * gap + (gap - 18) / 2, wy = y + 18 + r * 36, lit = hash(i * 31 + r * 7 + cI) > .45;
      rr(wx, wy, 18, 22, 4); ink(lit ? '#fff3b0' : '#b9dcff', 2.5); X.fillStyle = 'rgba(255,255,255,.55)'; rr(wx + 3, wy + 3, 4, 10, 2); X.fill();
    }
    if (awning) { const ay = bot - 38; rr(x + 8, ay, w - 16, 16, 5); ink('#ff4d5e', 3); X.save(); rr(x + 8, ay, w - 16, 16, 5); X.clip(); X.fillStyle = '#fff'; for (let s = x + 8; s < x + w; s += 20) X.fillRect(s + 10, ay, 10, 16); X.restore(); rr(x + w / 2 - 11, bot - 24, 22, 24, 4); ink('#8a5a34', 3); }
  }
  function crane() {                                                                       // tower + jib (the hook is live)
    tube([[740, 350], [740, 150]], 10, '#ffd23f'); tube([[766, 350], [766, 150]], 10, '#ffd23f');
    X.strokeStyle = '#c99512'; X.lineWidth = 3; for (let y = 350; y > 160; y -= 38) { X.beginPath(); X.moveTo(740, y); X.lineTo(766, y - 38); X.moveTo(766, y); X.lineTo(740, y - 38); X.stroke(); }
    rr(500, 134, 290, 14, 5); ink('#ffd23f', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; rr(508, 137, 270, 4, 2); X.fill();
    rr(770, 126, 24, 28, 4); ink('#8f9cb3', 3);                                             // counterweight
    X.beginPath(); X.moveTo(724, 134); X.lineTo(752, 106); X.lineTo(780, 134); X.closePath(); ink('#ffd23f', 3);
    rr(728, 150, 44, 26, 5); ink('#ffd23f', 3); rr(734, 154, 22, 14, 3); ink('#9fe3ff', 2);   // cab
  }
  function hydrant(x, y) { rr(x - 9, y - 30, 18, 30, 5); ink('#ff4d5e', 3); rr(x - 12, y - 38, 24, 12, 6); ink('#ff4d5e', 3); rr(x - 15, y - 20, 30, 8, 4); ink('#d9334a', 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(x - 4, y - 24, 2.5, 6); X.fill(); }
  function cone(x, y, s) {
    rr(x - 14 * s, y - 4 * s, 28 * s, 6 * s, 3); ink('#ff8a3d', 2.5);
    X.beginPath(); X.moveTo(x - 10 * s, y - 3 * s); X.lineTo(x - 3 * s, y - 32 * s); X.lineTo(x + 3 * s, y - 32 * s); X.lineTo(x + 10 * s, y - 3 * s); X.closePath(); ink('#ff8a3d', 2.5);
    X.save(); X.beginPath(); X.moveTo(x - 10 * s, y - 3 * s); X.lineTo(x - 3 * s, y - 32 * s); X.lineTo(x + 3 * s, y - 32 * s); X.lineTo(x + 10 * s, y - 3 * s); X.closePath(); X.clip(); X.fillStyle = '#fff'; X.fillRect(x - 12 * s, y - 20 * s, 24 * s, 6 * s); X.restore();
  }
  function bakeStreet() {
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
    const L = -OX, R = W + OX; let g;
    // far skyline: pale lilac, coloured outline
    for (let x = L - 20, i = 0; x < R + 40; x += 74, i++) { const h = 90 + hash(i + 3) * 120; rr(x, 352 - h, 70, h + 4, 5); X.lineWidth = 3; X.strokeStyle = '#7b80c6'; X.stroke(); X.fillStyle = i % 2 ? '#c9d0fb' : '#aab3f2'; X.fill();
      X.fillStyle = 'rgba(255,255,255,.25)'; for (let wy = 352 - h + 14; wy < 330; wy += 24) X.fillRect(x + 12, wy, 8, 10), X.fillRect(x + 36, wy, 8, 10); }
    // mid buildings (inked), pastel toys
    const pal = [['#ffb86b', '#d98a3c'], ['#ff9fbf', '#d9668f'], ['#9be38a', '#5cbc5e'], ['#8fc3ff', '#5a8fd6'], ['#ffe27a', '#d9b83c']];
    for (let x = L - 30, i = 0; x < R + 20; i++) { const w = 92 + hash(i + 9) * 40, h = 130 + hash(i + 19) * 60, p = pal[i % pal.length]; building(x, 354, w, h, p[0], p[1], i, i % 2 === 0); x += w + 10; }
    crane();
    // sidewalk + hard INK horizon where the building row ends
    X.fillStyle = INK; X.fillRect(L, 350, R - L, 4);
    g = X.createLinearGradient(0, 354, 0, 398); g.addColorStop(0, '#e6e2f2'); g.addColorStop(1, '#cfcae2'); X.fillStyle = g; X.fillRect(L, 354, R - L, 46);
    X.strokeStyle = 'rgba(20,16,28,.18)'; X.lineWidth = 2; for (let x = L - 20; x < R + 40; x += 64) { X.beginPath(); X.moveTo(x, 354); X.lineTo(x - 16, 398); X.stroke(); }
    hydrant(470, 392); for (const cx of [90, 330, 650]) cone(cx, 394, .9);
    // road
    g = X.createLinearGradient(0, 398, 0, H); g.addColorStop(0, '#6a6486'); g.addColorStop(1, '#3b3550'); X.fillStyle = g; X.fillRect(L, 398, R - L, H - 398);
    X.save(); X.beginPath(); X.rect(L, 400, R - L, H); X.clip(); X.strokeStyle = 'rgba(255,255,255,.06)'; X.lineWidth = 26; for (let x = L - 600; x < R + 200; x += 90) { X.beginPath(); X.moveTo(x, H); X.lineTo(x + 420, 398); X.stroke(); } X.restore();
    X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 2.5; X.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const x = L + hash(i + 70) * (R - L), y = 470 + hash(i + 80) * 70; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 12, y + 6); X.lineTo(x + 20, y + 3); X.lineTo(x + 30, y + 12); X.stroke(); }   // cracks
    rr(L - 10, 391, R - L + 20, 12, 5); ink('#f6f4fb', 3);                                  // curb
    X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(L, 394, R - L, 2);
    // scoreboard posts: a pair of road-sign poles (the sign itself is live)
    for (const px of [276, 524]) { tube([[px, 124], [px, 392]], 8, '#c9ced6'); X.strokeStyle = '#ff8a3d'; X.lineWidth = 8; for (let y = 140; y < 380; y += 36) { X.beginPath(); X.moveTo(px - 4, y); X.lineTo(px + 4, y + 8); X.stroke(); } }
    X = old; return c;
  }

  /* ── live layers ── */
  function sun(T) {
    const x = 118, y = 206; X.save(); X.translate(x, y); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-6, -32); X.lineTo(0, -48); X.lineTo(6, -32); X.fill(); } X.restore();
    el(x, y, 26, 26); ink('#ffe14d', 4); X.fillStyle = '#fff3a0'; el(x - 8, y - 9, 9, 5, -.5); X.fill();
  }
  function cloud(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
  }
  function lamp(x) {                                                                         // street lamps scroll past with the road
    tube([[x, 360], [x, 296]], 6, '#8f9cb3'); tube([[x, 296], [x + 16, 290]], 5, '#8f9cb3');
    rr(x + 8, 286, 22, 10, 5); ink('#ffe14d', 2.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(x + 15, 289, 4, 1.6); X.fill();
  }
  /* background gag: the crane swings a rubber duck on its hook (and the duck is not impressed) */
  function duck(T) {
    const px = 590, py = 148, a = Math.sin(T * 1.7) * .3, L = 62, hx = px + Math.sin(a) * L, hy = py + Math.cos(a) * L;
    tube([[px, py], [hx, hy - 20]], 2.4, '#8f9cb3'); rr(px - 8, py - 3, 16, 9, 3); ink('#ff4d5e', 2.5);
    X.save(); X.translate(hx, hy); X.rotate(-a * .8);
    el(0, 4, 26, 18); ink('#ffe14d', 3.5); X.fillStyle = '#f2b800'; el(8, 12, 15, 7, .1); X.fill();
    el(12, -14, 15, 14); ink('#ffe14d', 3.5);
    X.beginPath(); X.moveTo(24, -12); X.lineTo(38, -9); X.lineTo(25, -4); X.closePath(); ink('#ff8a3d', 2.5);
    X.fillStyle = INK; el(16, -18, 2.6, 3); X.fill(); X.strokeStyle = INK; X.lineWidth = 2.4; X.beginPath(); X.moveTo(11, -26); X.lineTo(21, -22); X.stroke();   // grumpy brow
    X.fillStyle = 'rgba(255,255,255,.7)'; el(6, -21, 4, 2, -.5); X.fill(); X.restore();
  }
  /* the gantry sign: BARRIERS n / 8, hazard stripes, with a pip per barrier cleared */
  function sign(st, T, dist, goal, result) {
    const cx = 400, y = 66, w = 320, h = 62;
    X.save(); X.translate(cx, y + h / 2); X.rotate(Math.sin(T * 1.3) * .008); X.translate(-cx, -(y + h / 2));
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(cx - w / 2 + 4, y + 7, w, h, 14); X.fill();
    rr(cx - w / 2, y + 6, w, h, 14); ink('#c99512', 4);
    rr(cx - w / 2, y, w, h, 14); ink('#ffd23f', 4);
    X.save(); rr(cx - w / 2, y, w, h, 14); X.clip(); X.fillStyle = '#14101c'; for (let s = -h; s < w; s += 26) { X.beginPath(); X.moveTo(cx - w / 2 + s, y + h); X.lineTo(cx - w / 2 + s + 12, y + h); X.lineTo(cx - w / 2 + s + 12 + h * .5, y + h - 8); X.lineTo(cx - w / 2 + s + h * .5, y + h - 8); X.closePath(); X.fill(); } X.restore();
    X.fillStyle = 'rgba(255,255,255,.4)'; rr(cx - w / 2 + 10, y + 4, w - 20, 7, 3.5); X.fill();
    txt(window.t('BARRIERS {dist} / {goal}', { dist, goal }), cx, y + 22, 26, result === 'win' ? '#5CFF7A' : '#fff', 'center', w - 30);
    for (let i = 0; i < goal; i++) {
      const px = cx - (goal - 1) * 17 + i * 34, py = y + 45, on = i < dist, k = on ? clamp((T - (st.pip[i] || 0)) / .3, 0, 1) : 0, s = on ? .55 + .45 * outBack(k) : 1;
      X.save(); X.translate(px, py); X.scale(s, s); rr(-9, -9, 18, 18, 9); ink(on ? '#ff8a3d' : '#6a6486', 2.5);
      if (on) { X.fillStyle = '#fff'; X.fillRect(-7, -1, 14, 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-3, -5, 2.4, 2); X.fill(); }
      X.restore();
    }
    X.restore();
  }
  /* barriers: striped road barrier / traffic cone / concrete block. Same rect as the hitbox: x, 450-h, w, h */
  function obstacle(o, T) {
    const x = o.x, w = o.w, h = o.h, y = 450 - h;
    X.fillStyle = 'rgba(20,16,28,.28)'; el(x + w / 2 + 3, 452, w / 2 + 8, 5); X.fill();
    if (o.v === 0) {
      rr(x + 3, y + h * .45, 6, h * .55, 2); ink('#c9ced6', 2.5); rr(x + w - 9, y + h * .45, 6, h * .55, 2); ink('#c9ced6', 2.5);
      const bh = h * .55; rr(x - 2, y + 4, w + 4, bh, 6); ink('#ff4d5e', 3.5);
      X.save(); rr(x - 2, y + 4, w + 4, bh, 6); X.clip(); X.fillStyle = '#fff'; for (let s = x - 20; s < x + w + 10; s += 22) { X.beginPath(); X.moveTo(s, y + 4 + bh); X.lineTo(s + 11, y + 4 + bh); X.lineTo(s + 11 + bh * .6, y + 4); X.lineTo(s + bh * .6, y + 4); X.closePath(); X.fill(); }
      X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x, y + 6, w, 4); X.restore();
      const on = Math.sin(T * 12 + x * .05) > 0; el(x + w / 2, y - 1, 6, 5); ink(on ? '#ffd23f' : '#c99512', 2.5); if (on) { X.fillStyle = 'rgba(255,225,77,.35)'; el(x + w / 2, y - 1, 13, 10); X.fill(); }
    } else if (o.v === 1) {
      rr(x - 4, y + h - 9, w + 8, 9, 4); ink('#ff8a3d', 3);
      const body = () => { X.beginPath(); X.moveTo(x + 3, y + h - 8); X.lineTo(x + w * .38, y); X.lineTo(x + w * .62, y); X.lineTo(x + w - 3, y + h - 8); X.closePath(); };
      cel(body, '#ff8a3d', '#d9602a', 6, 0, 3.5); X.save(); body(); X.clip(); X.fillStyle = '#fff'; X.fillRect(x, y + h * .36, w, h * .16); X.fillStyle = 'rgba(255,255,255,.4)'; el(x + w * .38, y + h * .3, 3, 9, .2); X.fill(); X.restore();
    } else {
      cel(() => rr(x, y, w, h, 7), '#d3cfe0', '#a49cc0', 7, 0, 3.5);
      X.save(); rr(x, y, w, h, 7); X.clip(); X.fillStyle = '#ff8a3d'; X.fillRect(x, y + h * .4, w, h * .2); X.fillStyle = '#fff'; X.fillRect(x, y + h * .46, w, h * .08); X.fillStyle = 'rgba(255,255,255,.45)'; el(x + 9, y + 12, 3.5, 8, -.3); X.fill(); X.restore();
    }
  }
  /* the pigeon at the wheel */
  function pigeon(x, y, mood, T, look) {
    const sh = mood === 'laugh' ? Math.sin(T * 30) * 1.6 : 0; X.save(); X.translate(x + sh, y);
    el(-6, 26, 20, 18); ink('#b9bfd0', 3.5);                                                // body (mostly hidden by the chassis)
    const head = () => { X.beginPath(); X.arc(0, 0, 16, 0, TAU); };
    cel(head, '#c9ced6', '#8f9cb3', 5, 3, 4);
    X.fillStyle = '#7fd0b0'; el(-5, 12, 9, 4, .3); X.fill();                               // iridescent neck
    X.fillStyle = 'rgba(255,255,255,.55)'; el(-6, -7, 5, 3, -.5); X.fill();
    const open = mood === 'laugh';
    X.beginPath(); X.moveTo(13, -2); X.lineTo(31, open ? -5 : 0); X.lineTo(13, open ? 2 : 5); X.closePath(); ink('#ffb347', 2.5);
    if (open) { X.beginPath(); X.moveTo(13, 4); X.lineTo(28, 7); X.lineTo(13, 10); X.closePath(); ink('#ffb347', 2.5); X.fillStyle = '#d9334a'; el(18, 5, 4, 2); X.fill(); }
    eye(5, -4, 5.4, mood === 'laugh' ? 'glee' : mood === 'dizzy' ? 'dizzy' : mood === 'wide' ? 'wide' : 'mad', look, T, 1);
    X.strokeStyle = INK; X.lineWidth = 3.4; X.lineCap = 'round';
    if (mood === 'mad' || mood === 'laugh') { X.beginPath(); X.moveTo(-2, -13); X.lineTo(12, -7); X.stroke(); }
    else if (mood === 'wide') { X.beginPath(); X.moveTo(-1, -12); X.lineTo(11, -14); X.stroke(); }
    X.fillStyle = 'rgba(255,110,165,.5)'; el(-2, 5, 4, 2.6); X.fill();
    X.beginPath(); X.moveTo(-15, -3); X.quadraticCurveTo(-1, -29, 15, -3); X.lineTo(-15, -3); X.closePath(); ink('#ffd23f', 3);   // hard hat
    X.fillStyle = 'rgba(255,255,255,.55)'; el(-5, -15, 4, 2, -.5); X.fill(); rr(-19, -6, 40, 6, 3); ink('#f2b800', 2.5);
    X.restore();
  }
  /* the steamroller; f = x of the drum's front edge, spin = wheel angle */
  function roller(f, bob, spin, T, mood, steam, flag) {
    X.save(); X.translate(f, GY); X.scale(.88, .88); X.translate(-f, -GY);
    const dr = 40, dcx = f - dr, dcy = GY - dr, rr0 = 40, rcx = f - 100, rcy = GY - rr0;
    X.save(); X.translate(0, bob);
    X.fillStyle = 'rgba(20,16,28,.3)'; el(f - 50, GY + 3, 92, 6); X.fill();
    // rear tyre
    el(rcx, rcy, rr0, rr0); ink('#3b3550', 4); X.fillStyle = '#5a5274'; el(rcx, rcy, 24, 24); X.fill(); el(rcx, rcy, 22, 22); ink('#ffd23f', 3);
    X.strokeStyle = INK; X.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = spin + i * Math.PI / 2; X.beginPath(); X.moveTo(rcx + Math.cos(a) * 4, rcy + Math.sin(a) * 4); X.lineTo(rcx + Math.cos(a) * 20, rcy + Math.sin(a) * 20); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.3)'; el(rcx - 18, rcy - 22, 8, 4, -.7); X.fill();
    // pigeon behind the cab pillars
    pigeon(f - 62, GY - 124, mood, T, 1);
    // chassis + hood
    cel(() => rr(f - 112, GY - 98, 98, 46, 10), '#ffd23f', '#c99512', 5, 7, 4);
    cel(() => rr(f - 58, GY - 90, 54, 36, 9), '#ffd23f', '#c99512', 5, 6, 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(f - 42, GY - 80, 10, 3.4, -.3); X.fill();
    X.fillStyle = INK; for (let i = 0; i < 3; i++) rr(f - 26 + i * 6, GY - 80, 3, 18, 1.5), X.fill();   // grille slits
    // frame arm to the drum
    rr(f - 56, GY - 60, 38, 12, 5); ink('#8f9cb3', 3);
    // drum
    el(dcx, dcy, dr, dr); ink('#8f9cb3', 4.5); X.save(); el(dcx, dcy, dr, dr); X.clip(); X.fillStyle = '#c9ced6'; el(dcx - 6, dcy - 6, dr, dr); X.fill(); X.restore();
    X.fillStyle = 'rgba(255,255,255,.6)'; el(dcx - 14, dcy - 18, 11, 5, -.7); X.fill();
    el(dcx, dcy, 12, 12); ink('#ffd23f', 3); X.fillStyle = INK; for (let i = 0; i < 6; i++) { const a = spin * 1.4 + i * TAU / 6; el(dcx + Math.cos(a) * 28, dcy + Math.sin(a) * 28, 2.6, 2.6); X.fill(); }
    // cab: two pillars + a red roof
    tube([[f - 98, GY - 98], [f - 98, GY - 158]], 5, '#ff8a3d'); tube([[f - 28, GY - 90], [f - 28, GY - 158]], 5, '#ff8a3d');
    rr(f - 112, GY - 170, 96, 16, 8); ink('#ff4d5e', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; rr(f - 104, GY - 167, 60, 4, 2); X.fill();
    // smokestack + chugging smoke
    rr(f - 20, GY - 128, 12, 38, 4); ink('#8f9cb3', 3); rr(f - 23, GY - 134, 18, 9, 4); ink('#6a6486', 3);
    for (let i = 0; i < 4; i++) { const k = (T * .9 + i / 4) % 1, rrad = 6 + k * 11 + (steam ? 5 : 0); puff(f - 14 + k * -22 - k * k * 10 + (steam ? Math.sin(T * 9 + i) * 6 : 0), GY - 140 - k * (steam ? 90 : 62), rrad, (1 - k) * (steam ? .95 : .8)); }
    if (flag) { const fp = f - 70; tube([[fp, GY - 170], [fp, GY - 214]], 3, '#c9ced6'); const w1 = Math.sin(T * 8) * 3; X.beginPath(); X.moveTo(fp + 2, GY - 212); X.quadraticCurveTo(fp + 16, GY - 218 + w1, fp + 30, GY - 210); X.quadraticCurveTo(fp + 18, GY - 202 - w1, fp + 30, GY - 194); X.quadraticCurveTo(fp + 16, GY - 200 + w1, fp + 2, GY - 196); X.closePath(); ink('#fff', 2.5); }
    X.restore(); X.restore();
  }

  function draw(c, T, st) {
    X = c; const { me, ob, dist, goal, result, k } = st, s = st.s;
    if (!SKY || BW !== VW) { SKY = bakeSky(); ST = bakeStreet(); BW = VW; }
    const outT = result ? clamp(s.out, 0, 2) : 0;
    if (dist > s.last) { s.pip[dist - 1] = T; } s.last = dist;
    const sc = s.sc;
    X.drawImage(SKY, -OX, 0);
    sun(T);
    for (const [off, y, sz, sp] of [[0, 100, .9, 6], [380, 160, .8, 9], [700, 186, .7, 7]]) cloud(((T * sp + off) % (VW + 260)) - OX - 140, y, sz);
    X.drawImage(ST, -OX, 0);
    duck(T);
    for (let x = -((sc * .6) % 330) - 40 - OX; x < W + OX + 40; x += 330) lamp(x);
    // road dashes scroll at the speed of the barriers
    X.fillStyle = 'rgba(255,255,255,.75)'; for (let x = -((sc) % 150) - 150 - OX; x < W + OX; x += 150) { rr(x, 503, 80, 8, 4); X.fill(); }
    X.fillStyle = 'rgba(255,225,77,.7)'; rr(-OX, 412, VW, 4, 2); X.fill();
    const near = ob.find(o => o.x + o.w > 160 - 14 && o.x < 330), danger = !result && near && near.x - 160 < 210;
    // the roller's front edge
    let f = 106 + Math.sin(T * 9) * 1.5, bobR = Math.sin(T * 22) * 1.4, mood = danger ? 'laugh' : 'mad', steam = false, flag = false;
    if (result === 'lose') { const q = clamp(outT / .8, 0, 1); f = 106 + 360 * q * q; bobR = Math.sin(now * 40) * 1.5; mood = 'laugh'; }
    else if (result === 'win') { const q = clamp(outT / .6, 0, 1); f = 106 + 14 * ease(q); steam = true; flag = outT > .2; mood = 'dizzy'; bobR = Math.sin(now * 30) * 2 * (1 - q); }
    else if (dist >= goal - 2) mood = 'mad';
    for (const o of ob) obstacle(o, T);
    // Claude
    const lose = result === 'lose', win = result === 'win';
    let cy = 440 - me.y;
    if (lose) cy = 440 - me.y * Math.max(0, 1 - outT * 6);
    const drumC = f - 35, flat = lose ? clamp((drumC - 152) / 40, 0, 1) : 0, jump = win ? Math.abs(Math.sin(outT * 9)) * 18 : 0;
    const stretch = !result && me.y > 0 ? 1 + clamp(Math.abs(me.vy) / 3000, 0, .12) : 1;
    X.fillStyle = 'rgba(20,16,28,.28)'; el(160, 453, (lose ? lerp(26, 38, flat) : 26 - me.y / 24), 6); X.fill();
    X.save(); X.translate(160, cy - jump); X.scale(lerp(1 / stretch, 1.5, flat), lerp(stretch, .16, flat)); X.translate(-160, -(cy - jump));
    claude(160, cy - jump, 2.8, { mood: lose ? 'sad' : win ? 'happy' : null, run: result || me.y > 0 ? null : now * 2 });
    X.restore();
    if (!result && me.y === 0) for (let i = 0; i < 3; i++) { const q = (now * 2.4 + i / 3) % 1; X.globalAlpha = (1 - q) * .55; X.fillStyle = '#e6e2f2'; el(150 - q * 46, 447 - q * 10, 3 + q * 5, 3 + q * 4); X.fill(); }
    X.globalAlpha = 1;
    if (!result) pill(160, Math.max(300, 440 - me.y - 78 - 20), 'YOU', '#FFE14D');
    if (danger) sweat(177, cy - 58, 1, now);
    if (win) for (let i = 0; i < 4; i++) { const q = (outT * 1.3 + i * .27) % 1; heart(210 + i * 34 + Math.sin(q * 6 + i) * 8, 380 - q * 150, 1.3 + (i % 2) * .4, i % 2 ? '#ff5c8a' : '#ff8fb1'); }
    if (lose) for (let i = 0; i < 3; i++) { const a = now * 5 + i * 2.1, sx = 160 + Math.cos(a) * 30 * flat, sy = 405 + Math.sin(a) * 7 * flat - 8; if (flat > .5) { X.save(); X.translate(sx, sy); X.rotate(a); X.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 3.4 : 8, an = j * Math.PI / 5; X.lineTo(Math.cos(an) * r, Math.sin(an) * r); } X.closePath(); ink('#FFE14D', 2.5); X.restore(); } }
    // obstacles, then the steamroller on top (it only overlaps Claude at the squash)
    roller(f, bobR, sc / 40, T, mood, steam, flag);
    if (win && outT < .8) for (let i = 0; i < 5; i++) { const q = clamp((outT - i * .06) / .7, 0, 1); if (q > 0 && q < 1) puff(f - 30 - i * 14 + q * 20, 330 - q * 70 + (i & 1) * 12, 8 + q * 14, 1 - q); }
    if (!result) pill(Math.max(64, f - 56), 262, 'BOSS!', '#ff4d5e');
    sign(s, T, dist, goal, result);
    X.fillStyle = 'rgba(0,0,0,0)';
  }
  return { draw };
})();

const BOSSES = {
  /* a giant bug: click it until its health bar is empty */
  bug(sp, s) {
    const max = s.bossHp || 10; let hp = max, flash = 0, hpv = max, sq = 0, ec = 0;   // ec: art-only clock since the result (payoff animation)
    const b = { x: 400, y: 300, a: Math.random() * 6.28, turn: 0 };
    const g = {
      cmd: 'BOSS!', hint: 'SQUASH THE GIANT BUG', thint: 'TAP THE GIANT BUG', dur: 8, boss: true, wide: true,
      down(p) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < 110) {
          hp--; flash = .12; sq = .2; confetti(p.x, p.y, 6); sfx.hit(); sfx.blip((max - hp) * 1.2); shake(5, .15);
          burst(p.x, p.y, '#FFE14D', 10); ring(p.x, p.y, '#fff', 60, .3); floatText('-1', p.x, p.y - 30, '#fff', 30);
          if (hp <= 0) { g.result = 'win'; confetti(b.x, b.y, 50); sfx.splat(); sfx.sparkle(); shake(14, .4); ring(b.x, b.y, '#FFE14D', 200, .6); burst(b.x, b.y, '#ff4d4d', 24, 380); }
        } else { sfx.miss(); }
      },
      update(dt) {
        flash = Math.max(0, flash - dt); sq = Math.max(0, sq - dt); hpv += (hp - hpv) * Math.min(1, 6 * dt);
        if (g.result) { ec += dt; return; }
        const v = (110 + (max - hp) * 14) * Math.min(sp, 1.3);
        b.turn -= dt; if (b.turn < 0) { b.a += (Math.random() - .5) * 2.6; b.turn = .3 + Math.random() * .5; }
        b.x += Math.cos(b.a) * v * dt; b.y += Math.sin(b.a) * v * dt;
        if (b.x < 130 - OX) { b.x = 130 - OX; b.a = Math.PI - b.a } if (b.x > 670 + OX) { b.x = 670 + OX; b.a = Math.PI - b.a }
        if (b.y < 170) { b.y = 170; b.a = -b.a } if (b.y > 450) { b.y = 450; b.a = -b.a }
      },
      draw(t) { BUGART.draw({ b, max, hp, hpv, flash, sq, result: g.result, ec, t }); }
    };
    return g;
  },
  /* rhythm: FINAL BOSS of the cursed disco. Hit Space when the ring closes on the target; 6 of 8 notes win.
     A giant DJ disco ball taunts, sheds tiles and gets more unhinged with every hit; on a win it falls off its pedestal and explodes into sandwiches. */
  rhythm(sp, s) {
    const need = 6, beat = 1.05 / Math.sqrt(sp), notes = []; let hits = 0, miss = 0, flash = 0, fb = '', fbT = 0, slam = '', slamT = 0, slamC = '#FFE14D', winAt = 0, boomed = false, kick = 0;
    for (let i = 0; i < 8; i++) notes.push({ t: 1.2 + i * beat, done: false });
    let clock = 0;
    const tiles = []; for (let i = 0; i < 14; i++) tiles.push({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, c: 0, life: 0 });
    let ti = 0;
    const shed = n => { for (let i = 0; i < n; i++) { const o = tiles[ti++ % tiles.length]; o.x = 400 + (Math.random() - .5) * 90; o.y = 150 + (Math.random() - .3) * 60; o.vx = (Math.random() - .5) * 420; o.vy = -200 - Math.random() * 200; o.r = Math.random() * 6; o.vr = (Math.random() - .5) * 14; o.c = (Math.random() * 3) | 0; o.life = 1.6; } };
    const SLAMS = ['WHAT?!', 'STOP IT!', 'NO WAY!', 'MY TILES!', 'HOW?!'], TAUNT = ['LOL', 'NOPE', 'SKILL ISSUE', 'OOF'];
    const hit = () => {
      if (g.result) return; const n = notes.find(n => !n.done && Math.abs(n.t - clock) < .3);
      if (!n) { miss++; sfx.miss(); fb = 'OOPS'; fbT = .4; return; }
      n.done = true; hits++; const d = Math.abs(n.t - clock); fb = d < .1 ? 'PERFECT!' : 'GOOD'; fbT = .4; flash = .12; kick = .35; sfx.blip(hits * 2); ring(400, 360, '#FFE14D', 100, .3);
      shed(2); sfx.boing(); slam = SLAMS[(hits - 1) % SLAMS.length]; slamT = hits < need ? .5 : 0; slamC = MVC[hits % 6];
      if (hits >= need) { g.result = 'win'; winAt = now; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); shed(14); }
    };
    const g = {
      cmd: 'BOSS!', hint: 'HIT SPACE ON THE BEAT!', thint: 'TAP ON THE BEAT', dur: 11, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter') hit(); },
      down() { hit(); },
      update(dt) {
        clock += dt; flash = Math.max(0, flash - dt); fbT = Math.max(0, fbT - dt); slamT = Math.max(0, slamT - dt); kick = Math.max(0, kick - dt);
        for (const o of tiles) if (o.life > 0) { o.life -= dt; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt; }
        if (g.result) return;
        for (const n of notes) if (!n.done && clock - n.t > .3) { n.done = true; miss++; sfx.miss(); fb = 'MISS'; fbT = .4; slam = TAUNT[miss % 4]; slamT = .5; slamC = '#FF4D4D'; }
        if (miss > notes.length - need) { g.result = 'lose'; sfx.buzz(); shake(8, .3); }
      },
      draw(t) {
        const k = hits / need, win = g.result === 'win', lose = g.result === 'lose', wt = win ? now - winAt : 0, B = clock / beat;
        mvWarp(.4 + k * 1.6 + (lose ? 1 : 0), now);
        mvPsy(Math.floor(B) % 2 ? '#3a1457' : '#4a1a70', Math.floor(B) % 2 ? '#6a1f9a' : '#7d2ab0', now, .5 + k * 1.1);
        mvTiles(470, now, 100 + k * 80);
        mvAudience(468, now, .6 + k * 1.4 + (win ? 1 : 0) + (lose ? -.5 : 0), .85, Math.sin(now * 2), -.3);
        /* the boss: giant DJ disco ball on a pedestal */
        let bx = 400 + Math.sin(now * (2 + k * 4)) * (6 + k * 26), by = 150 + Math.sin(now * 3) * 6 - kick * 40, br = 70 * (1 + Math.max(0, Math.sin(B * Math.PI * 2)) * .05 + kick * .4);
        if (win) { const f = Math.min(wt, 1); by = 150 + 900 * f * f * .33 + 320 * f; bx += wt * 60; }
        const alive = !win || by < 440;
        if (!win) { ctx.fillStyle = INK; ctx.fillRect(bx - 34, 232, 68, 240); ctx.fillStyle = '#8a6ad8'; ctx.fillRect(bx - 28, 236, 56, 236); }
        if (alive) {
          ctx.save(); ctx.translate(bx, by); ctx.rotate((win ? wt * 12 : Math.sin(now * (3 + k * 5)) * .12 * (1 + k * 2))); ctx.translate(-bx, -by);
          mvBall(bx, by, br, now * (1 + k * 3));
          const ex = Math.sin(now * (3 + k * 6)) * (k > .5 ? 1 : .3), ey = .8 + Math.cos(now * 4) * (k > .5 ? 1 : 0);
          mvEye(bx - br * .32, by + br * .05, br * .26, ex, ey); mvEye(bx + br * .32, by + br * .05, br * .26, -ex, ey);
          if (k > .6) { const sw = Math.sin(now * 30) * br * .1; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx - br * .32 + sw, by + br * .05, br * .09, 0, 7); ctx.arc(bx + br * .32 - sw, by + br * .05, br * .09, 0, 7); ctx.fill(); }
          ctx.fillStyle = INK; ctx.beginPath(); const mo = lose ? br * .3 : (win ? br * .35 : Math.max(0, Math.sin(B * Math.PI * 2 + 1)) * br * .22 * (1 + k));
          ctx.ellipse(bx, by + br * .55, br * .22, br * .05 + mo, 0, 0, 7); ctx.fill();
          if (mo > br * .08) { ctx.fillStyle = '#FF3EA5'; ctx.fillRect(bx - br * .1, by + br * .55 + mo * .3, br * .2, mo * .6); }
          ctx.restore();
          /* DJ hot dog riding on top, headphones on */
          if (!win) { mvFoodie(bx, by - br + 14, .55, 0, now, 1 + k * 2); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by - br - 22, 15, Math.PI, 0); ctx.stroke(); circ(bx - 15, by - br - 20, 6, '#FF3EA5', 3); circ(bx + 15, by - br - 20, 6, '#FF3EA5', 3); }
        } else if (!boomed) {
          boomed = true; sfx.splat(); sfx.boing(); shake(14, .5); confetti(bx, 440, 60); burst(bx, 440, '#F0B35A', 24, 420); ring(bx, 440, '#fff', 200, .5);
        }
        /* flying mirror tiles */
        for (const o of tiles) if (o.life > 0) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.r); ctx.fillStyle = o.c ? '#fff' : '#9fb0d6'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-8, -8, 16, 16); ctx.restore(); }
        /* explosion of sandwiches */
        if (win && boomed) { const e = wt - .75; if (e > 0) for (let i = 0; i < 6; i++) { const a = -1.2 - i * .5, v = 380 + i * 60, sx = bx + Math.cos(a) * v * e * (i & 1 ? -1 : 1), sy = 440 + Math.sin(a) * v * e + 700 * e * e;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(e * (4 + i)); ctx.fillStyle = INK; ctx.fillRect(-27, -19, 54, 38); ctx.fillStyle = '#F0B35A'; ctx.fillRect(-23, -15, 46, 10); ctx.fillRect(-23, 5, 46, 10); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(-25, -5, 50, 5); ctx.fillStyle = '#FF8FD0'; ctx.fillRect(-21, 0, 42, 5); ctx.restore(); } }
        txt('DANCE-OFF!', W / 2, 40, 28, '#fff'); txt(`${hits} / ${need}`, W / 2, 262, 26, '#FFE14D');
        ctx.lineWidth = 8; ctx.strokeStyle = flash > 0 ? '#fff' : '#FFE14D'; ctx.beginPath(); ctx.arc(400, 360, 60, 0, 7); ctx.stroke();
        for (const n of notes) { const d = n.t - clock; if (n.done || d > .9 || d < -.3) continue; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(400, 360, 60 + Math.max(0, d) * 220, 0, 7); ctx.stroke(); }
        claude(400, 380 + Math.sin(clock * Math.PI / beat * 2) * 8, 3, { mood: lose ? 'sad' : win ? 'happy' : null, run: g.result ? null : now });
        if (fbT > 0) txt(fb, 400, 300, 40, '#fff');
        if (win && wt > .9) mvSlam('SANDWICHES?!', Math.max(.3, 1 - (wt - .9) * 1.5), '#5CFF7A', 330, 80); else mvSlam(slam, slamT * 2, slamC, 330, 90);
        ctx.restore();
        vignette(.3);
      }
    };
    return g;
  },
  /* runner: jump over the barriers rushing at you — survive the timer or clear the goal */
  stomp(sp, s) {
    const k = Math.min(sp, 1.15), me = { y: 0, vy: 0 }, ob = []; let spawn = 1, dist = 0, buf = 0, vi = 0; const goal = 8, art = { last: 0, pip: [], out: 0, sc: 0 };
    const jump = () => { if (g.result) return; if (me.y === 0) { me.vy = 900; sfx.blip(6); } else buf = .18; };
    const g = {
      cmd: 'BOSS!', hint: 'SPACE TO JUMP!', thint: 'TAP TO JUMP', dur: 10, boss: true, wide: true, timeWin: true,
      key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jump(); }, down() { jump(); },
      update(dt) {
        if (g.result) { art.out += dt; return; }
        art.sc += 380 * k * dt;
        buf = Math.max(0, buf - dt);
        me.vy -= 2300 * dt; me.y = Math.max(0, me.y + me.vy * dt); if (me.y === 0) { me.vy = 0; if (buf > 0) { buf = 0; me.vy = 900; sfx.blip(6); } }
        spawn -= dt; if (spawn < 0) { spawn = (1.1 + Math.random() * .5) / k; ob.push({ x: W + OX + 60, w: 30 + Math.random() * 14, h: 38 + Math.random() * 18, v: vi++ % 3 }); }
        for (let i = ob.length - 1; i >= 0; i--) {
          const o = ob[i]; o.x -= 380 * k * dt;
          if (o.x < 160 + 14 && o.x + o.w > 160 - 14 && me.y < o.h - 14) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); burst(160, 440 - me.y, '#FF4D4D', 18); return; }
          if (o.x + o.w < -OX - 20) { ob.splice(i, 1); continue; }
          if (!o.done && o.x + o.w < 100) { o.done = true; dist++; sfx.blip(dist); if (dist >= goal) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); return; } }
        }
      },
      draw(t) { STOMPART.draw(ctx, t, { me, ob, dist, goal, result: g.result, k, s: art }); vignette(.2); }
    };
    return g;
  },
  /* memory: watch the arrows, then repeat them */
  simon(sp, s) {
    const len = 4, seq = Array.from({ length: len }, () => Math.random() * 4 | 0), cols = ['#ff4d4d', '#4dff88', '#4da6ff', '#FFE14D'], names = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'], alt = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
    let ph = 'show', clock = 0, idx = 0, lit = -1, litT = 0; const step = .65 / Math.sqrt(sp);
    const press = d => {
      if (g.result || ph !== 'input') return; lit = d; litT = .2;
      if (d !== seq[idx]) { g.result = 'lose'; sfx.buzz(); shake(8, .3); return; }
      sfx.blip(d * 3 + 2); if (++idx >= len) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); }
    };
    const g = {
      cmd: 'BOSS!', hint: 'REMEMBER, THEN REPEAT!', thint: 'TAP THE PADS', dur: 11, boss: true, wide: true,
      key(e) { let d = names.indexOf(e.code); if (d < 0) d = alt.indexOf(e.code); if (d >= 0) press(d); },
      down(p) { const dx = p.x - W / 2, dy = p.y - 330; if (Math.hypot(dx, dy) < 40) return; press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); },
      update(dt) {
        litT = Math.max(0, litT - dt); if (g.result) return; clock += dt;
        if (ph === 'show') { const k = Math.floor((clock - .8) / step); if (clock < .8) lit = -1; else if (k < len) { const fr = (clock - .8) / step - k; if (fr < .1 && lit !== seq[k]) sfx.blip(seq[k] * 3 + 2); lit = fr < .7 ? seq[k] : -1; litT = .01; } else { ph = 'input'; lit = -1; } }
      },
      draw(t) {
        bg('#1d1a4d', '#262266', t);
        txt(ph === 'show' ? 'WATCH...' : 'YOUR TURN!', W / 2, 110, 36, '#fff');
        const pos = [[0, -110], [110, 0], [0, 110], [-110, 0]];
        pos.forEach(([dx, dy], i) => { const on = litT > 0 && lit === i; ctx.fillStyle = on ? '#fff' : cols[i]; ctx.globalAlpha = on ? 1 : .55; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(W / 2 + dx - 50, 330 + dy - 50, 100, 100, 18); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; });
        for (let i = 0; i < len; i++) { ctx.fillStyle = i < idx ? '#FFE14D' : '#fff3'; ctx.beginPath(); ctx.arc(W / 2 - 45 + i * 30, 500, 9, 0, 7); ctx.fill(); }
        vignette(.3);
      }
    };
    return g;
  },
  /* a long word to type */
  type(sp, s) {
    const g = gType(sp, s.bossWord || 'REFACTOR');
    g.cmd = 'BOSS!'; g.hint = 'TYPE THE WORD!'; g.thint = 'TAP THE LETTERS'; g.dur = 12; g.boss = true;   // g.boss = the night throne-room look (wave1.js W1A.type)
    return g;
  },
  /* a bigger swarm of bouncing bugs */
  dodge(sp, s) {
    const g = gDodge(sp + .2, s.bossBalls || 3);
    g.cmd = 'BOSS!'; g.hint = 'SURVIVE THE SWARM!'; g.thint = 'DRAG TO DODGE'; g.dur = 9; g.boss = true;
    const d = g.draw; g.draw = t => { d(t); vignette(.3); };
    return g;
  }
};
if (typeof apBoss === 'function') BOSSES.blackout = apBoss;   // POWER OUT! boss, see js/games/ap1.js
