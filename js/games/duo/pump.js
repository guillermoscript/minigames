'use strict';
/* ═════════ DUO · DRAGON PUMP (du_pump), a real two-hander: one pumps, one holds the valve ═════════
   A street-fair balloon seller needs a giant dragon balloon for the parade. The dragon fills in order: tail, belly, wings, head.
   PUMPER (role 0, JUDGE): works the bellows (hold Space / drag up and down / alternate pointer up-down). Every full stroke (handle up, then down)
   pushes air into the dragon. The pumper never sees a gauge: only the dragon's size, a neck that trembles when the pressure climbs, and a hiss
   (+ a sagging dragon) when the valve is open. Hiss = STOP pumping (air only escapes); quiet = GO.
   VALVE (role 1): holds the relief valve and watches the pressure gauge. The red line creeps down as the thinner parts fill, above it the
   dragon pops. HOLD to vent (pressure falls, the dragon sags a little). When the dragon is full the valve ties the knot: tap when the needle
   crosses the green zone, with the pressure low enough (a tight neck slips). A pumper alone pops it, a valve alone never fills it.
   Netcode: the PUMPER owns the whole simulation (bellows, air, pressure, size) and publishes 'st' [S, P, handle, redTimer] (coalesced, ≤10/s, latest).
   The VALVE owns only its hand: 'v' [open] (on change, ≤10/s) and 'tie' {n, q} (the needle value at the tap, a sequence number q). The judge answers a
   tie with 'tres' [ok, why, q] and tells the other screen about a pop with 'pop' before the verdict ('end', via wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const GY = 408;                                      // where the street starts
const DX = 470, NZ = [470, 470];                     // the dragon's axis and the neck (nozzle) it hangs from
const BX = 208, BY = 540;                            // the bellows: centre x and floor y
const PX = 84, PY = 548;                             // the pumper's feet
const VX = 628, VY = 548;                            // the valve player's feet
const VW = [566, 498];                               // the relief valve wheel
const SX = 742, SY = 548;                            // the seller's feet
const GXY = [704, 214, 74];                          // the pressure gauge (x, y, radius)
const FULL = .955;                                   // the dragon counts as full from here (knot allowed)
const REDMAX = .7;                                   // seconds above the red line before it pops
const lim = S => 1 - .22 * S;                        // the red line slides down as the thin parts fill (tail 1.0 ... head .78)

/* palette */
const PALS = [
  { body: '#2fc9a0', shade: '#1a9478', light: '#8ff5d3', wing: '#ff6fb0', wing2: '#c93d82', belly: '#fff0b8' },
  { body: '#ff8a3d', shade: '#c9561c', light: '#ffc58f', wing: '#7c5cff', wing2: '#5238c9', belly: '#fff0b8' },
  { body: '#4db8ff', shade: '#2680c9', light: '#a9e0ff', wing: '#ffd23f', wing2: '#c99512', belly: '#ffffff' },
];
const GOLD = '#ffcf33', GOLD2 = '#d99a12', BRASS = '#e8b93f', BRASS2 = '#a8761c';
const SKIN = '#f2c7a0', SKIN2 = '#d9a47a';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tube(pts, w, col) { line(pts, w + 7, INK); line(pts, w, col); }
function pill(x, y, label, col) {
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 250);
  X.restore();
}
function bubble(s, x, y, size, sc) {                 // speech bubble with a tail pointing down to (x, y)
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(200, X.measureText(t(s)).width) + 26, h = size * 1.5;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-8, -18); X.lineTo(2, 0); X.lineTo(10, -18); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -18 - h, w, h, h * .45); ink('#fff', 3);
  X.fillStyle = '#fff'; X.fillRect(-6, -21, 15, 6);
  txt(s, 0, -18 - h / 2 + 2, size, INK, 'center', 200); X.restore();
}
/* blocky arm from caos()'s side stub; an = angle (0 = up), k = reach (stretches like a cartoon arm when > 1) */
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
/* reach with the arm of a caos() standing at (bx, by) towards (tx, ty) */
function reach(bx, by, u, sx, tx, ty, col) {
  const sx0 = bx + sx * 6.6 * u, sy0 = by - 5.2 * u, dx = tx - sx0, dy = ty - sy0, d = Math.hypot(dx, dy), L0 = 3.3 * u + .35 * u + 2 * u;
  X.save(); X.translate(bx, by); arm(u, sx, Math.atan2(dx, -dy), clamp((d - 1.2 * u) / L0, .2, 3.4), col); X.restore();
}
function sweat(x, y, T, k) {                          // a sweat drop that slides and fades
  const a = (T * 1.6 + k) % 1; X.globalAlpha = 1 - a; X.beginPath(); X.moveTo(x, y - 8 + a * 12); X.quadraticCurveTo(x + 6, y + 1 + a * 12, x, y + 6 + a * 12); X.quadraticCurveTo(x - 6, y + 1 + a * 12, x, y - 8 + a * 12); ink('#9fe3ff', 2); X.globalAlpha = 1;
}
/* a cel-shaded ellipse: ink, shade, base shifted up-left, one glint */
function cel(x, y, rx, ry, rot, col, shade, glint) {
  el(x, y, rx, ry, rot); ink(shade, 4.5);
  X.save(); el(x, y, rx, ry, rot); X.clip(); X.fillStyle = col; el(x - rx * .16, y - ry * .16, rx * 1.02, ry * 1.02, rot); X.fill(); X.restore();
  if (glint !== false) { X.fillStyle = 'rgba(255,255,255,.42)'; el(x - rx * .38, y - ry * .42, rx * .22, ry * .12, rot - .5); X.fill(); }
}
const eyeBall = (x, y, r, lx, ly, mood) => {          // a big eye; mood: null | 'happy' | 'worry' | 'dead'
  el(x, y, r, r * 1.1); ink('#fff', 3);
  if (mood === 'dead') { X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .5, y - r * .5); X.lineTo(x + r * .5, y + r * .5); X.moveTo(x + r * .5, y - r * .5); X.lineTo(x - r * .5, y + r * .5); X.stroke(); return; }
  const d = Math.hypot(lx, ly) || 1, k = Math.min(1, d / 40) * r * .38, px = x + lx / d * k, py = y + ly / d * k, pr = mood === 'worry' ? r * .34 : r * .52;
  X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .32, 0, TAU); X.fill();
};

/* ───────────── the dragon ───────────── */
/* S: 0..1 filled. o: { jit 0..1 (trembling), droop 0..1 (venting), pal, puff (pump pulse), look [x, y], mood, bow (knot tied) } */
const RAG = [[-16, 452], [4, 448], [-46, 452], [46, 452], [56, 446]];     // where each part lies when it is not inflated yet (tail, belly, wing L, wing R, head)
const FIN = [[0, 424], [0, 330], [-98, 288], [98, 288], [10, 178]];       // ... and where it floats when it is
function dragon(S, T, o) {
  const pal = PALS[o.pal || 0], f = [clamp(S / .22, 0, 1), clamp((S - .22) / .28, 0, 1), clamp((S - .5) / .25, 0, 1), clamp((S - .75) / .25, 0, 1)];
  const pu = 1 + (o.puff || 0) * .03 + Math.sin(T * 3.1) * .008, jit = o.jit || 0, drp = o.droop || 0;
  const jx = Math.sin(T * 47) * jit * 3.4, jy = Math.cos(T * 53) * jit * 2.6;
  const pos = (i, k) => { const e = ease(k); return [DX + lerp(RAG[i][0], FIN[i][0], e) + jx, lerp(RAG[i][1], FIN[i][1], e) + jy + (i >= 3 || i === 2 ? drp * 6 * e : 0) + (i === 4 ? drp * 16 * e : 0)]; };
  const sz = (k, w, h) => { const e = ease(k); return [w * (.26 + .74 * e) * pu, h * (.1 + .9 * e) * pu]; };
  X.save();
  if (o.rot) { X.translate(NZ[0], NZ[1]); X.rotate(o.rot); X.translate(-NZ[0], -NZ[1]); }
  // wings (behind the belly): bat wings with ribs and a scalloped edge
  for (const [i, sg] of [[2, -1], [3, 1]]) {
    const k = f[2]; if (k <= .02) continue; const [x, y] = pos(i, k), [rx, ry] = sz(k, 62, 46);
    X.save(); X.translate(x, y); X.rotate(sg * (.5 - .5 * (1 - ease(k))) + Math.sin(T * 2.2 + i) * .03 + sg * drp * .25);
    el(0, 0, rx, ry); ink(pal.wing2, 4.5);
    for (let c = 0; c < 3; c++) { el(sg * (rx * (.62 - c * .5)), ry * .8, rx * .34, ry * .3); ink(pal.wing2, 4); }
    X.save(); el(0, 0, rx, ry); X.clip(); X.fillStyle = pal.wing; el(-sg * rx * .1, -ry * .16, rx * 1.02, ry * 1.02); X.fill(); X.restore();
    X.strokeStyle = pal.wing2; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); for (let c = 0; c < 3; c++) { X.moveTo(-sg * rx * .85, 0); X.lineTo(sg * rx * (.2 + c * .3), -ry * (.7 - c * .15) + ry * .1 * c); } X.stroke();
    X.fillStyle = 'rgba(255,255,255,.4)'; el(-sg * rx * .3, -ry * .35, rx * .2, ry * .1, -.4); X.fill();
    X.restore();
  }
  // tail: a lump with a spade tip
  { const k = f[0], [x, y] = pos(0, k), [rx, ry] = sz(k, 38, 40);
    if (k > .02) {
      X.save(); X.translate(x - rx * .9, y + ry * .35); X.rotate(-.5); X.beginPath(); X.moveTo(0, 0); X.lineTo(-22 * k - 4, -9 * k - 3); X.lineTo(-12 * k - 2, 7 * k + 2); X.closePath(); ink(pal.wing, 3.5); X.restore();
      cel(x, y, rx, ry, 0, pal.body, pal.shade);
    }
  }
  // belly: big, with cream plates
  { const k = f[1], [x, y] = pos(1, k), [rx, ry] = sz(k, 80, 90);
    if (k > .02) {
      cel(x, y, rx, ry, 0, pal.body, pal.shade);
      X.save(); el(x, y, rx, ry); X.clip(); X.fillStyle = pal.belly;
      for (let c = 0; c < 4; c++) { el(x + rx * .05, y + ry * (-.1 + c * .3), rx * .62, ry * .12); X.fill(); X.strokeStyle = 'rgba(217,150,50,.55)'; X.lineWidth = 2; X.stroke(); }
      X.fillStyle = 'rgba(255,255,255,.12)'; el(x - rx * .35, y - ry * .3, rx * .3, ry * .55, -.3); X.fill(); X.restore();
      X.fillStyle = 'rgba(255,255,255,.45)'; el(x - rx * .52, y - ry * .5, rx * .13, ry * .09, -.6); X.fill();
      if (jit > .45) { X.strokeStyle = '#fff'; X.lineWidth = 3; X.lineCap = 'round'; const fl = Math.sin(T * 28) > 0 ? 1 : -1;     // stress lines: it is about to burst
        for (const sg of [-1, 1]) for (let c = 0; c < 3; c++) { const a = (c - 1) * .5 + (sg < 0 ? Math.PI : 0), r0 = 1.04, r1 = 1.18 + c * .02 * fl; X.beginPath(); X.moveTo(x + Math.cos(a) * rx * r0, y + Math.sin(a) * ry * r0); X.lineTo(x + Math.cos(a) * rx * r1, y + Math.sin(a) * ry * r1); X.stroke(); } }
    }
  }
  // head
  { const k = f[3], [x, y] = pos(4, k), [rx, ry] = sz(k, 72, 56);
    if (k > .02) {
      const lk = o.look || [0, 0], mood = o.mood;
      X.save(); X.translate(x, y); X.rotate((mood === 'dead' ? .5 : 0) + drp * .22 + Math.sin(T * 2.7) * .02);
      for (const sg of [-1, 1]) { X.beginPath(); X.moveTo(sg * rx * .4 - 9 * k, -ry * .75); X.lineTo(sg * rx * .6, -ry * 1.5); X.lineTo(sg * rx * .4 + 11 * k, -ry * .8); X.closePath(); ink(GOLD, 3.5); }
      for (let c = -1; c <= 1; c++) { X.beginPath(); X.moveTo(c * rx * .22 - 7 * k, -ry * .92); X.lineTo(c * rx * .22, -ry * 1.22 + Math.abs(c) * 8 * k); X.lineTo(c * rx * .22 + 7 * k, -ry * .92); X.closePath(); ink(GOLD2, 3); }
      cel(0, 0, rx, ry, 0, pal.body, pal.shade);
      cel(rx * .5, ry * .34, rx * .5, ry * .46, 0, mix(pal.body, '#ffffff', .25), pal.shade, false);              // the snout
      X.fillStyle = INK; for (const nx of [.56, .8]) { el(rx * nx, ry * .16, 3.4 * k, 4.4 * k); X.fill(); }
      const eyes = [[-rx * .2, -ry * .22], [rx * .28, -ry * .22]], er = 15 * k + 3;
      for (const [ex, ey] of eyes) eyeBall(ex, ey + (mood === 'worry' ? Math.sin(T * 30) * .8 : 0), er, lk[0], lk[1], mood === 'dead' ? 'dead' : mood);
      X.strokeStyle = INK; X.lineWidth = 4; X.lineCap = 'round';
      for (const [ex, ey] of eyes) { X.beginPath(); X.moveTo(ex - er, ey - er * 1.35 + (mood === 'worry' ? 5 : 0)); X.lineTo(ex + er, ey - er * 1.35 - (mood === 'worry' ? 5 : 0) * (ex < 0 ? -1 : 1)); X.stroke(); }
      X.beginPath();
      if (mood === 'happy') { X.moveTo(rx * .22, ry * .56); X.quadraticCurveTo(rx * .6, ry * 1.0, rx * .92, ry * .52); X.closePath(); ink('#7a1830', 3); X.fillStyle = '#ff7a9a'; el(rx * .58, ry * .8, rx * .13, ry * .1); X.fill(); }
      else if (mood === 'worry') { X.moveTo(rx * .2, ry * .66); for (let c = 1; c <= 4; c++) X.lineTo(rx * (.2 + c * .17), ry * (.66 + (c % 2 ? -.06 : .06))); X.stroke(); }
      else if (mood === 'dead') { X.moveTo(rx * .25, ry * .7); X.quadraticCurveTo(rx * .55, ry * .5, rx * .9, ry * .72); X.stroke(); }
      else { X.moveTo(rx * .22, ry * .6); X.quadraticCurveTo(rx * .55, ry * .84, rx * .92, ry * .56); X.stroke(); }
      X.fillStyle = 'rgba(255,110,165,.5)'; el(rx * .02, ry * .26, rx * .12, ry * .08); X.fill();
      X.fillStyle = 'rgba(255,255,255,.45)'; el(-rx * .5, -ry * .55, rx * .14, ry * .08, -.5); X.fill();
      X.restore();
    }
  }
  // the tied bow on the neck
  if (o.bow) { const x = DX + jx, y = 458; for (const sg of [-1, 1]) { X.beginPath(); X.moveTo(x, y); X.quadraticCurveTo(x + sg * 22, y - 18, x + sg * 30, y - 2); X.quadraticCurveTo(x + sg * 22, y + 12, x, y); ink('#ff4d6d', 3); } X.beginPath(); X.arc(x, y, 6, 0, TAU); ink('#d93a57', 3); }
  X.restore();
}

/* ───────────── the rig: bellows, hose, relief valve, gauge ───────────── */
/* h: handle 0..1 (1 = up). Returns the grip position, where the pumper's hands go. */
function bellows(h, T, glow) {
  const n = 5, top = BY - 12 - (20 + 52 * h), segH = (BY - 12 - top) / n, hw = 46;
  rr(BX - 60, BY - 14, 120, 18, 6); ink('#8a5a34', 4); X.fillStyle = '#b87a44'; X.fillRect(BX - 54, BY - 12, 108, 4);
  for (let i = 0; i < n; i++) {                                       // accordion folds: wide, narrow, wide...
    const y0 = top + (n - 1 - i) * segH + 2, wd = hw + (i % 2 ? -7 : 5);
    rr(BX - wd, y0, wd * 2, segH + 4, 7); ink(i % 2 ? '#7a4426' : '#a05a32', 3.5);
    X.fillStyle = 'rgba(255,200,140,.28)'; X.fillRect(BX - wd + 7, y0 + 3, 7, Math.max(2, segH - 4));
  }
  rr(BX - 56, top - 12, 112, 16, 6); ink('#8a5a34', 4); X.fillStyle = '#d89a58'; X.fillRect(BX - 50, top - 9, 100, 4);
  rr(BX + 40, BY - 36, 26, 20, 5); ink(BRASS, 3.5);                      // the air outlet
  const gx = BX - 66, gy = top - 4;                                       // the handle
  X.lineCap = 'round'; line([[BX - 50, top - 4], [gx, gy]], 15, INK); line([[BX - 50, top - 4], [gx, gy]], 8, '#d9a066');
  rr(gx - 11, gy - 9, 22, 18, 8); ink('#ff4d5e', 3.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(gx - 3, gy - 4, 4, 2); X.fill();
  return [gx, gy];
}
function hose(T, flow) {                                              // outlet -> neck
  const P0 = [BX + 66, BY - 26], P1 = [BX + 150, BY + 22], P2 = [NZ[0] - 90, NZ[1] + 62], P3 = [NZ[0] - 8, NZ[1] + 14];
  const at = u => { const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3; return [a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]; };
  const pts = []; for (let i = 0; i <= 26; i++) pts.push(at(i / 26));
  tube(pts, 11, '#e8434f'); line(pts, 2.5, 'rgba(255,255,255,.4)');
  if (flow > 0) for (let i = 0; i < 4; i++) { const [x, y] = at(((T * 3 + i / 4) % 1)); X.globalAlpha = Math.min(1, flow * 1.4); X.fillStyle = '#fff'; X.beginPath(); X.arc(x, y - 1, 3.4, 0, TAU); X.fill(); X.globalAlpha = 1; }
}
/* the neck fitting + the pipe to the relief valve; open 0..1: how far the valve is open (the wheel turns, steam puffs) */
function fitting(T, jit, open, tied) {
  const sh = Math.sin(T * 50) * jit * 2.2;
  rr(NZ[0] - 20 + sh, NZ[1] - 6, 40, 30, 8); ink(BRASS, 4); X.fillStyle = 'rgba(255,255,255,.45)'; X.fillRect(NZ[0] - 13 + sh, NZ[1] - 1, 6, 18);
  line([[NZ[0] + 18, NZ[1] + 12], [VW[0], VW[1] + 10]], 12, INK); line([[NZ[0] + 18, NZ[1] + 12], [VW[0], VW[1] + 10]], 6, BRASS); line([[NZ[0] + 18, NZ[1] + 10], [VW[0], VW[1] + 8]], 2, 'rgba(255,255,255,.5)');
  X.save(); X.translate(VW[0], VW[1] + 12); rr(-9, -3, 18, 24, 4); ink(BRASS2, 3.5);                 // valve body
  X.rotate(open * 1.9); X.beginPath(); X.moveTo(-1, 0); X.lineTo(-1, -20); ink(null, 0); line([[0, 0], [0, -14]], 7, INK); line([[0, 0], [0, -14]], 3, '#9a9aa8');
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { X.save(); X.translate(0, -16); X.rotate(a); rr(-3, -14, 6, 14, 3); ink(open > .5 ? '#5CFF7A' : '#ff4d5e', 3); X.restore(); }
  X.restore();
}
/* the pressure gauge post: v = pressure (0..1.25), lr = the red line, jit = the needle shakes */
function gauge(cx, cy, r, v, lr, T, jit) {
  rr(cx - 7, cy + r - 6, 14, 560 - cy - r, 4); ink('#8a5a34', 3.5);                                 // post
  X.beginPath(); X.arc(cx, cy, r + 8, 0, TAU); ink('#cfd8e6', 4.5);
  X.beginPath(); X.arc(cx, cy, r, 0, TAU); ink('#fffaf0', 3);
  const A0 = Math.PI * .8, SW = Math.PI * 1.4, MAXV = 1.25, ang = q => A0 + SW * clamp(q / MAXV, 0, 1);
  const arc = (a, b, col, w) => { X.beginPath(); X.arc(cx, cy, r * .74, ang(a), ang(b)); X.lineWidth = w; X.strokeStyle = col; X.lineCap = 'butt'; X.stroke(); };
  arc(0, MAXV, INK, 20); arc(0, lr - .4, '#5CFF7A', 13); arc(lr - .4, lr, '#ffd23f', 13); arc(lr, MAXV, '#ff4d5e', 13);
  X.strokeStyle = INK; X.lineWidth = 2.5; for (let i = 0; i <= 10; i++) { const a = ang(i * .125), c = Math.cos(a), s = Math.sin(a); X.beginPath(); X.moveTo(cx + c * r * .9, cy + s * r * .9); X.lineTo(cx + c * r * (i % 2 ? .84 : .8), cy + s * r * (i % 2 ? .84 : .8)); X.stroke(); }
  const a = ang(v) + Math.sin(T * 55) * jit * .05, c = Math.cos(a), s = Math.sin(a);                 // needle
  line([[cx - c * 10, cy - s * 10], [cx + c * r * .8, cy + s * r * .8]], 9, INK); line([[cx - c * 10, cy - s * 10], [cx + c * r * .8, cy + s * r * .8]], 4, '#e8434f');
  X.beginPath(); X.arc(cx, cy, 8, 0, TAU); ink('#9a9aa8', 3);
  X.fillStyle = 'rgba(255,255,255,.4)'; el(cx - r * .38, cy - r * .5, r * .26, r * .1, -.7); X.fill();
  txt('PSI', cx, cy + r * .5, 16, INK, 'center', 50);
}
/* the knot UI: a green zone on an arc above the neck, a marker sweeping across */
function knotUI(n, ready, T) {
  const cx = NZ[0], cy = NZ[1] + 10, r = 64, A = q => -Math.PI / 2 + q * Math.PI * .46;
  X.lineCap = 'round'; X.beginPath(); X.arc(cx, cy, r, A(-1), A(1)); X.lineWidth = 20; X.strokeStyle = INK; X.stroke(); X.lineWidth = 13; X.strokeStyle = ready ? '#ffffff' : '#c8c3d8'; X.stroke();
  X.beginPath(); X.arc(cx, cy, r, A(-.3), A(.3)); X.lineWidth = 13; X.strokeStyle = ready ? '#5CFF7A' : '#8fb99a'; X.stroke();
  const a = A(n), mx = cx + Math.cos(a) * r, my = cy + Math.sin(a) * r;
  X.beginPath(); X.arc(mx, my, 11, 0, TAU); ink('#ffd23f', 3.5); X.fillStyle = 'rgba(255,255,255,.7)'; el(mx - 3, my - 4, 3, 2); X.fill();
}

/* ───────────── the people ───────────── */
function seller(x, y, u, mood, T, hatOn, shreds, bal) {                // mood: null | 'worry' | 'cheer' | 'shred' | 'sad'
  const bob = mood === 'cheer' ? Math.abs(Math.sin(T * 10)) * 12 : 0, sh = mood === 'worry' ? Math.sin(T * 40) * 1.2 : 0;
  X.save(); X.translate(x + sh, y - bob);
  X.beginPath(); X.ellipse(0, bob + 1, 34, 8, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  // balloon bunch tied to his wrist (the small ones)
  if (bal) for (let i = 0; i < 5; i++) { const bx = -26 + i * 14 + Math.sin(T * 1.7 + i) * 4, by = -170 - (i % 3) * 14 + Math.sin(T * 2.1 + i * 2) * 3, col = ['#ff5c8a', '#ffd23f', '#4db8ff', '#5CFF7A', '#b49cff'][i];
    line([[22, -62], [bx * .5 + 8, by * .5 - 30], [bx, by + 18]], 2.5, INK); el(bx, by, 15, 19); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.55)'; el(bx - 5, by - 7, 4, 6, -.4); X.fill(); }
  // legs + shoes
  for (const sg of [-1, 1]) { rr(sg * 10 - 6, -26, 12, 26, 4); ink('#3a3550', 3.5); el(sg * 11 + sg * 3, -2, 11, 6); ink('#5a3b2e', 3); }
  // vest + shirt
  rr(-24, -78, 48, 56, 12); ink('#ffffff', 4); rr(-24, -78, 16, 56, 8); ink('#d93a57', 3.5); rr(8, -78, 16, 56, 8); ink('#d93a57', 3.5);
  X.fillStyle = GOLD; for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(0, -68 + i * 14, 3, 0, TAU); X.fill(); }
  // arms
  const up = mood === 'cheer' ? 1 : mood === 'shred' ? .2 : 0, wr = mood === 'worry' ? Math.sin(T * 9) * 6 : 0;
  for (const sg of [-1, 1]) { X.save(); X.translate(sg * 25, -68); X.rotate(sg * (up ? -2.5 + Math.sin(T * 14 + sg) * .3 : mood === 'worry' ? 2.2 : mood === 'sad' ? 2.6 : 2.7)); rr(-5, 0, 10, 28 + wr * .1, 5); ink('#ffffff', 3.5); el(0, 31, 7, 7); ink(SKIN, 3); X.restore(); }
  // head
  X.save(); X.translate(0, -96 - (mood === 'shred' ? -3 : 0)); X.rotate(mood === 'sad' ? -.15 : 0);
  X.beginPath(); X.arc(0, 0, 22, 0, TAU); ink(SKIN2, 4); X.save(); X.beginPath(); X.arc(0, 0, 22, 0, TAU); X.clip(); X.fillStyle = SKIN; X.beginPath(); X.arc(-3, -3, 22, 0, TAU); X.fill(); X.restore();
  X.fillStyle = 'rgba(255,255,255,.4)'; el(-9, -12, 5, 3, -.5); X.fill();
  X.fillStyle = 'rgba(255,100,120,.55)'; el(-12, 5, 5, 3.4); X.fill(); el(12, 5, 5, 3.4); X.fill();
  const ey = -4;                                                       // eyes
  for (const sg of [-1, 1]) {
    if (mood === 'cheer') { X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(sg * 8 - 5, ey + 3); X.lineTo(sg * 8, ey - 3); X.lineTo(sg * 8 + 5, ey + 3); X.stroke(); }
    else if (mood === 'shred') { el(sg * 8, ey, 4, 4); ink('#fff', 2); X.fillStyle = INK; X.fillRect(sg * 8 - 1, ey - 1, 2, 2); }
    else { el(sg * 8, ey, 5, mood === 'worry' ? 7 : 6); ink('#fff', 2.5); X.fillStyle = INK; X.beginPath(); X.arc(sg * 8 + 1, ey + 1, mood === 'worry' ? 1.8 : 2.6, 0, TAU); X.fill(); }
  }
  X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round';          // brows
  for (const sg of [-1, 1]) { X.beginPath(); X.moveTo(sg * 4, ey - 9 - (mood === 'worry' ? 3 : 0)); X.lineTo(sg * 13, ey - 9 + (mood === 'worry' ? 3 : -1) * (mood === 'sad' ? -1 : 1)); X.stroke(); }
  X.beginPath(); X.moveTo(-3, 3); X.quadraticCurveTo(0, 7, 3, 3); ink(SKIN2, 2);                         // nose
  for (const sg of [-1, 1]) { X.beginPath(); X.moveTo(0, 7); X.bezierCurveTo(sg * 8, 5, sg * 20, 7, sg * 21, 14 + (mood === 'worry' ? 3 : 0)); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#3a2a1a'; X.stroke(); }   // moustache
  X.beginPath();                                                       // mouth
  if (mood === 'cheer') { X.arc(0, 13, 6, 0, Math.PI); ink('#7a1830', 2.5); }
  else if (mood === 'worry') { X.arc(0, 17, 4.5, Math.PI, 0); ink('#7a1830', 2); }
  else if (mood === 'sad' || mood === 'shred') { X.moveTo(-5, 17); X.quadraticCurveTo(0, 12, 5, 17); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
  else { X.moveTo(-4, 15); X.quadraticCurveTo(0, 18, 4, 15); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
  if (mood === 'worry') { sweat(-22, -14, T, 0); sweat(24, -8, T, .5); }
  if (hatOn) {                                                         // the straw boater
    X.save(); X.translate(0, -20); X.rotate(mood === 'shred' ? .35 : mood === 'sad' ? -.2 : 0);
    el(0, 2, 32, 8); ink('#e8c36a', 3.5); rr(-19, -22, 38, 24, 7); ink('#f2d98a', 3.5); X.fillStyle = '#d93a57'; X.fillRect(-19, -8, 38, 7); X.strokeStyle = INK; X.lineWidth = 2.5; X.strokeRect(-19, -8, 38, 7);
    X.fillStyle = 'rgba(255,255,255,.5)'; el(-9, -15, 6, 2.5, -.2); X.fill(); X.restore();
  } else { X.fillStyle = 'rgba(255,255,255,.55)'; el(-8, -15, 7, 3, -.4); X.fill(); }
  X.restore();
  if (shreds) for (const [sx, sy, sa, c] of shreds) { X.save(); X.translate(sx, sy); X.rotate(sa); rr(-9, -3, 18, 6, 2); ink(c, 2); X.restore(); }
  X.restore();
}
function kid(x, y, s, T, mood, k) {                                    // the kid with the pin; mood: null (sneaking) | 'innocent' | 'oops'
  X.save(); X.translate(x, y); X.scale(s, s);
  X.beginPath(); X.ellipse(0, 1, 22, 6, 0, 0, TAU); X.fillStyle = 'rgba(20,16,28,.25)'; X.fill();
  for (const sg of [-1, 1]) { rr(sg * 7 - 4, -26, 8, 26, 3); ink('#4d7cff', 3); el(sg * 7 + sg * 3, -1, 8, 4.5); ink('#fff', 2.5); }
  rr(-14, -56, 28, 34, 9); ink('#ffd23f', 3.5); X.fillStyle = '#ff5c8a'; X.fillRect(-14, -41, 28, 6); X.strokeStyle = INK; X.lineWidth = 2.5; X.strokeRect(-14, -41, 28, 6);
  const sneak = mood === null;
  if (sneak) { X.save(); X.translate(13, -48); X.rotate(.95 + Math.sin(T * 5) * .05); rr(-4, 0, 8, 22, 4); ink('#ffd23f', 3); el(0, 24, 5.5, 5.5); ink(SKIN, 2.5);
    line([[0, 24], [0, 54]], 3.5, INK); line([[0, 24], [0, 54]], 1.8, '#e6e6f0'); X.beginPath(); X.arc(0, 56, 4.2, 0, TAU); ink('#ff4d5e', 2); X.restore();                // the pin
  } else { for (const sg of [-1, 1]) { rr(sg * 15 - 3, -50, 6, 16, 3); ink('#ffd23f', 2.5); } }
  X.save(); X.translate(0, -70); X.beginPath(); X.arc(0, 0, 18, 0, TAU); ink(SKIN, 3.5);
  X.beginPath(); X.moveTo(-18, -4); X.quadraticCurveTo(-8, -26, 8, -22); X.quadraticCurveTo(20, -18, 18, -4); X.quadraticCurveTo(4, -14, -18, -4); X.closePath(); ink('#8a4a22', 3);
  for (const sg of [-1, 1]) { if (mood === 'oops') { el(sg * 7, 1, 4.5, 6); ink('#fff', 2); X.fillStyle = INK; X.fillRect(sg * 7 - 1, 0, 2, 2); } else { X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(sg * 7 - 4, 1 + (sneak ? 0 : -1)); X.lineTo(sg * 7 + 4, 2 + (sneak ? 0 : -1)); X.stroke(); } }
  X.beginPath(); if (mood === 'oops') { X.arc(0, 11, 4, 0, TAU); ink('#7a1830', 2); } else if (sneak) { X.moveTo(-6, 9); X.quadraticCurveTo(0, 15, 8, 8); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); } else { X.moveTo(-4, 11); X.lineTo(4, 11); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.arc(1, 15, 2.5 + Math.sin(T * 6) * .6, 0, TAU); ink('#ff7ea8', 1.5); }
  if (mood === 'innocent') { X.fillStyle = INK; X.beginPath(); X.arc(0, 12, 2.2, 0, TAU); X.fill(); }
  X.restore();
  X.restore();
}
function pigeon(x, y, s, T, mode, dir) {                               // mode: 'peck' | 'walk' | 'fly'
  X.save(); X.translate(x, y); X.scale(s * dir, s);
  const pk = mode === 'peck' ? Math.max(0, Math.sin(T * 9)) : 0, wb = mode === 'fly' ? Math.sin(T * 30) : 0, hop = mode === 'walk' ? Math.abs(Math.sin(T * 8)) * 3 : 0;
  X.translate(0, -hop);
  for (const sg of [-1, 1]) { line([[sg * 4, -8], [sg * 4, 0]], 2.5, '#ff9a7a'); }
  if (mode === 'fly') { X.save(); X.translate(-4, -22); X.rotate(-.8 + wb * .7); el(-2, -14, 8, 18, -.3); ink('#b9bfd2', 3); X.restore(); }
  el(0, -18, 15, 11, -.15); ink('#9aa2bd', 3.5); X.save(); el(0, -18, 15, 11, -.15); X.clip(); X.fillStyle = '#c4cae0'; el(-2, -21, 15, 10, -.15); X.fill(); X.restore();
  el(-12, -20, 8, 4, .3); ink('#7a82a0', 2.5);
  X.save(); X.translate(11, -26 + pk * 10); X.rotate(pk * .5); el(0, 0, 8, 8); ink('#8a92af', 3);
  el(-1, 4, 6, 3.6); ink('#3fae8a', 2); el(3, -1, 2.8, 2.8); ink('#ffcf33', 1.5); X.fillStyle = INK; X.beginPath(); X.arc(3.4, -1, 1.2, 0, TAU); X.fill();
  X.beginPath(); X.moveTo(7, 0); X.lineTo(14, 2); X.lineTo(7, 4); X.closePath(); ink('#ffb04d', 2); X.restore();
  X.restore();
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, '#5a49c9'); g.addColorStop(.55, '#ff8fb0'); g.addColorStop(1, '#ffd9a0'); X.fillStyle = g; X.fillRect(0, 0, W, GY);
  X.fillStyle = 'rgba(255,240,170,.6)'; X.beginPath(); X.arc(640, 150, 56, 0, TAU); X.fill(); X.fillStyle = '#fff3b0'; X.beginPath(); X.arc(640, 150, 34, 0, TAU); X.fill();                // the low sun
  // far fair: tents and a skyline, coloured outlines (distance)
  X.fillStyle = '#9c78d8'; X.strokeStyle = '#6a4bb8'; X.lineWidth = 3;
  for (const [x, w, h] of [[20, 70, 90], [96, 54, 130], [470, 60, 110], [532, 70, 80], [610, 54, 125], [680, 80, 95], [764, 50, 110]]) { rr(x, GY - h, w, h + 6, 6); X.fill(); X.stroke(); X.fillStyle = '#ffe9a8'; for (let r = 0; r < Math.floor(h / 36); r++) for (let c = 0; c < Math.floor(w / 28); c++) X.fillRect(x + 9 + c * 25, GY - h + 12 + r * 32, 11, 14); X.fillStyle = '#9c78d8'; }
  // the big striped tent (back right)
  X.save(); X.translate(668, GY); X.beginPath(); X.moveTo(-110, 0); X.lineTo(-90, -104); X.lineTo(0, -156); X.lineTo(90, -104); X.lineTo(110, 0); X.closePath(); ink('#ffffff', 4);
  X.save(); X.clip(); for (let i = -6; i < 6; i++) { X.fillStyle = i % 2 ? '#ff5c8a' : '#fff'; X.beginPath(); X.moveTo(0, -156); X.lineTo(i * 20, 0); X.lineTo(i * 20 + 20, 0); X.closePath(); X.fill(); } X.restore();
  X.beginPath(); X.moveTo(-110, 0); X.lineTo(-90, -104); X.lineTo(0, -156); X.lineTo(90, -104); X.lineTo(110, 0); X.closePath(); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.moveTo(-26, 0); X.lineTo(0, -62); X.lineTo(26, 0); X.closePath(); ink('#3b2a6e', 3.5);
  line([[0, -156], [0, -190]], 4, INK); X.beginPath(); X.moveTo(0, -190); X.lineTo(34, -180); X.lineTo(0, -168); X.closePath(); ink('#ffd23f', 3); X.restore();
  // ground: sidewalk + cobbled street
  g = X.createLinearGradient(0, GY, 0, H); g.addColorStop(0, '#d9c3ae'); g.addColorStop(.2, '#c9ae98'); g.addColorStop(1, '#a98d78'); X.fillStyle = g; X.fillRect(0, GY, W, H - GY);
  X.fillStyle = '#ece0d2'; X.fillRect(0, GY, W, 24); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, GY); X.lineTo(W, GY); X.moveTo(0, GY + 24); X.lineTo(W, GY + 24); X.stroke();
  X.strokeStyle = 'rgba(80,50,40,.25)'; X.lineWidth = 2;
  for (let r = 0; r < 9; r++) { const y = GY + 38 + r * 22 + r * r * .8; for (let x = -40 + (r % 2) * 22; x < W + 40; x += 44 + r * 3) { X.beginPath(); X.ellipse(x, y, 20 + r * 1.5, 8 + r * .6, 0, 0, TAU); X.stroke(); } }
  X.fillStyle = 'rgba(255,255,255,.14)'; for (let i = -2; i < 8; i++) { X.beginPath(); X.moveTo(i * 130, H); X.lineTo(i * 130 + 50, H); X.lineTo(i * 130 + 170, GY + 24); X.lineTo(i * 130 + 130, GY + 24); X.fill(); }
  // bunting between two poles (kept out of the top-left HUD box)
  for (const px of [330, 790]) { rr(px - 4, 70, 8, GY - 60, 3); ink('#8a5a34', 3); }
  X.beginPath(); X.moveTo(330, 84); X.quadraticCurveTo(560, 150, 790, 84); X.lineWidth = 3.5; X.strokeStyle = INK; X.stroke();
  for (let i = 1; i < 12; i++) { const u = i / 12, x = lerp(330, 790, u), y = (1 - u) * (1 - u) * 84 + 2 * (1 - u) * u * 150 + u * u * 84; X.beginPath(); X.moveTo(x - 11, y); X.lineTo(x + 11, y); X.lineTo(x, y + 26); X.closePath(); ink(['#ff5c8a', '#ffd23f', '#4db8ff', '#5CFF7A'][i % 4], 2.5); }
  X = old; return cv2;
}
function ferris(T) {                                                    // a slow ferris wheel behind the pumper (live)
  const cx = 150, cy = 296, r = 92;
  X.save(); X.translate(cx, cy);
  line([[-34, 118], [0, 0], [34, 118]], 8, '#6a4bb8'); X.lineWidth = 6; X.strokeStyle = '#6a4bb8'; X.beginPath(); X.arc(0, 0, r, 0, TAU); X.stroke(); X.beginPath(); X.arc(0, 0, r * .55, 0, TAU); X.stroke();
  X.rotate(T * .12); X.lineWidth = 4; X.beginPath(); for (let i = 0; i < 8; i++) { X.moveTo(0, 0); X.lineTo(Math.cos(i * TAU / 8) * r, Math.sin(i * TAU / 8) * r); } X.stroke();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8, gx = Math.cos(a) * r, gy = Math.sin(a) * r; X.save(); X.translate(gx, gy); X.rotate(-T * .12); rr(-11, -3, 22, 18, 5); ink(['#ff5c8a', '#ffd23f', '#4db8ff', '#5CFF7A'][i % 4], 2.5); X.restore(); }
  X.beginPath(); X.arc(0, 0, 7, 0, TAU); ink('#ffd23f', 3); X.restore();
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 17; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave a key or the valve stuck */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duPump(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), pump = D.role === 0, TS = Math.sqrt(sp);
  const pal = Math.floor(R() * 3), nph = R() * TAU, nsp = 2.4 + R() * .5, kpv = .94 + R() * .12;       // palette; the knot needle's phase + speed; a little pressure luck
  const GAIN = .1 * TS, KP = 1.9 * kpv, LEAK = .1, VENT = 1.15, SAG = .035, OPENF = .12;              // air per full stroke / pressure per air / closed leak / vent per s / sag per s / inflow that still gets in with the valve open
  const UPS = 5.2, DNS = 6.6;                                                                            // handle speed up / down (per s): ≈ 3 strokes/s at most
  /* state (the pumper owns it all; the valve screen mirrors it) */
  let h = 0, ht = 0, bel = 0, S = 0, Pr = 0, redT = 0, vOpen = false, vAt = -9, ending = null, popped = false, resAt = -1, tied = false, tieQ = -1, tieCool = 0, stSent = -9, lastSt = '';
  let ptrY = null, ptrAt = -9, pDown = false, fN = FOCUSN, puffK = 0, lastDn = -9, creakAt = -9, hissAt = -9, squeakAt = -9, hitAt = -9, slipAt = -9, flow = 0;
  const kHeld = new Set();
  const Ts = track(), Tp = track(), Th = track(), Tr = track();
  /* the valve player's own hand */
  let vWant = false, vSent = false, vSentAt = -9, vPtr = false, fullAt = -9, nSeq = 0, tieAt = -9, tieMsg = null, tieMsgAt = -9, tieLocal = 0, seenFull = false;
  const bits = [], pops = [], TIEKEY = new Set(['Enter', 'KeyE', 'KeyF', 'KeyT']);
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
    function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .8, gr: 600, vr: 0, rot: 0, k: 0 }, o)); }
  const needleAt = t => Math.sin(nph + (t - fullAt) * nsp);                                             // the knot needle (valve screen): -1..1
  function steam(n) { for (let i = 0; i < n; i++) bit({ k: 1, x: VW[0] + (cr() - .5) * 8, y: VW[1] - 14, vx: (cr() - .2) * 70 + 20, vy: -(70 + cr() * 90), gr: -30, r: 8 + cr() * 8, life: .7 }); }
  function strokeFx() { puffK = 1; noise(.13, .05, 500, 1800, 'bandpass'); snd(150, .07, 'sine', .06, 0, 90); }
  function popFx() {
    const cols = ['#2fc9a0', '#ff6fb0', '#fff0b8', '#ffcf33', '#1a9478'];
    for (let i = 0; i < 46; i++) bit({ k: 2, x: DX + (cr() - .5) * 150, y: 150 + cr() * 260, vx: (SX - DX) * (.15 + cr() * .45) + (cr() - .5) * 160, vy: -(100 + cr() * 260), gr: 520, r: 5 + cr() * 8, life: 1.7, c: cols[i % cols.length], vr: (cr() - .5) * 16 });
    sfx.pop(); sfx.pop(); noise(.3, .12, 2500, 400, 'lowpass'); shake(9, .3); ring(DX, 300, '#fff', 190, .35);
  }
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: pump ? 'PUMP!' : 'VENT!', roleLabel: pump ? 'PUMPER' : 'VALVE',
    hint: pump ? 'PUMP: HOLD SPACE (OR DRAG UP AND DOWN) AND LET GO, AGAIN AND AGAIN - STOP WHEN YOU HEAR THE HISS!' : 'WATCH THE GAUGE: HOLD CLICK / SPACE TO LET AIR OUT BEFORE IT HITS RED - WHEN FULL, CLICK THE KNOT (OR ENTER) IN THE GREEN!',
    thint: pump ? 'DRAG UP AND DOWN TO PUMP - STOP WHEN YOU HEAR THE HISS!' : 'WATCH THE GAUGE: HOLD TO LET AIR OUT BEFORE IT HITS RED - WHEN FULL, TAP THE KNOT IN THE GREEN!',
    update(dt) {
      g.c += dt; puffK = Math.max(0, puffK - dt * 6); tieCool = Math.max(0, tieCool - dt);
      if (g.result && resAt < 0) { resAt = g.c; if (g.result === 'win') { sfx.coin(); sfx.sparkle(); } else if (!popped) { sfx.miss(); snd(300, .7, 'sawtooth', .05, 0, 70); noise(.7, .08, 2400, 500, 'bandpass'); } }
      const done = !!(g.result || ending);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); pDown = false; vPtr = false; }
      if (pump) {
        // the handle: keys (hold = up) or the pointer's height
        let want = 0;
        const keyUp = kHeld.size > 0;
        if (keyUp) want = 1; else if (ptrY !== null && (pDown || g.c - ptrAt < 1.2)) want = clamp((520 - ptrY) / 300, 0, 1);
        ht = done ? 0 : want;
        const old = h; h = ht > h ? Math.min(ht, h + UPS * dt) : Math.max(ht, h - DNS * dt);
        const dh = h - old; let air = 0;
        if (dh > 0) { bel = Math.min(1, bel + dh); if (g.c - creakAt > .18 && dh > .02) { creakAt = g.c; snd(260 + h * 140, .05, 'triangle', .02); } }
        else if (dh < 0) { const q = Math.min(bel, -dh); bel -= q; air = q * GAIN; if (q > 0 && g.c - lastDn > .12) { lastDn = g.c; strokeFx(); } }
        // the shared physics
        const open = vOpen;
        flow = air > 0 ? 1 : Math.max(0, flow - dt * 6);
        if (!done) {
          const k = open ? OPENF : 1;
          if (S >= 1) { Pr += air * KP * 2.4; }
          else { S = Math.min(1, S + air * k); Pr += air * KP * (open ? .4 : 1); }
          if (open) { Pr = Math.max(0, Pr - VENT * dt); if (S > FULL || S < FULL - .004) S = Math.max(S > FULL ? FULL : 0, S - SAG * dt); }
          else Pr = Math.max(0, Pr - Pr * LEAK * dt);
          const L = lim(S); redT = Pr > L ? redT + dt : Math.max(0, redT - dt * 1.6);
          if (redT >= REDMAX && !g.result) { popped = true; popFx(); D.send('pop', 1); g.finish('lose'); }
        }
        // sounds: the hiss when the valve is open; the rubber creaks when the neck is about to give
        if (open && g.c - hissAt > .09 && !g.result) { hissAt = g.c; noise(.1, .028, 3600, 5200, 'highpass'); }
        if (Pr > lim(S) - .22 && g.c - squeakAt > .3 && !g.result) { squeakAt = g.c; snd(700 + Pr * 500, .08, 'triangle', .02, 0, 1200); }
        if (!g.result) {
          if (!ending && tied) ending = { res: 'win', at: g.c + .3 };
          if (ending && g.c >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && g.c >= g.limit) g.finish('lose');
        }
        const st = [Math.round(S * 1000), Math.round(Pr * 1000), Math.round(h * 100), Math.round(redT * 100)].join();
        if (st !== lastSt && g.c - stSent >= .1) { lastSt = st; stSent = g.c; D.send('st', [Math.round(S * 1000), Math.round(Pr * 1000), Math.round(h * 100), Math.round(redT * 100)], true); }
      } else {
        // my hand on the valve: hold = open
        vWant = !done && (vPtr || kHeld.size > 0);
        if ((vWant !== vSent && g.c - vSentAt >= .09) || (g.c - vSentAt > .8 && vSent)) { vSent = vWant; vSentAt = g.c; D.send('v', [vWant ? 1 : 0], true); }
        if (vWant && g.c - hissAt > .09) { hissAt = g.c; noise(.1, .03, 3600, 5200, 'highpass'); steam(1); }
        const P = Tp.at() || 0, Sv = Ts.at() || 0, L = lim(Sv);
        if (P > L - .3 && !g.result && g.c - squeakAt > .22) { squeakAt = g.c; snd(900 + clamp(P - L + .3, 0, .5) * 3200, .09, 'sine', .035, 0, 1400 + (P - L + .3) * 3000); }
        const full = Sv >= FULL - .01;
        if (full && !seenFull) { seenFull = true; fullAt = g.c; } else if (!full && seenFull && Sv < FULL - .06) seenFull = false;
        if (tieMsg && g.c - tieMsgAt > 1.4) tieMsg = null;
      }
      if (vOpen && pump && g.c - hitAt > .1) { hitAt = g.c; steam(1); }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (b.k === 2 && b.y > SY - 6) { b.y = SY - 6; b.vy = 0; b.vx *= .8; b.vr = 0; } if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
    },
    msg(type, d) {
      if (pump) {
        if (type === 'v' && Array.isArray(d)) { const o = vOpen; vOpen = !!d[0]; vAt = g.c; if (vOpen && !o) { steam(3); noise(.2, .05, 3000, 6000, 'highpass'); } }
        else if (type === 'tie' && d && !tied && !g.result) {
          if (d.q <= tieQ) return; tieQ = d.q;
          if (tieCool > 0) return;
          const ok = Math.abs(d.n) <= .34;
          if (!ok) { S = Math.max(0, S - .1); Pr *= .85; tieCool = .5; slipAt = g.c; D.send('tres', [0, 0, d.q]); snd(250, .15, 'sawtooth', .05, 0, 120); }
          else if (S < FULL - .03) { tieCool = .5; D.send('tres', [0, 2, d.q]); }
          else if (Pr > .78) { S = Math.max(0, S - .06); Pr *= .8; tieCool = .5; slipAt = g.c; D.send('tres', [0, 1, d.q]); snd(250, .15, 'sawtooth', .05, 0, 120); }
          else { tied = true; D.send('tres', [1, 0, d.q]); sfx.stamp(); pop('KNOT!', NZ[0] + 70, NZ[1] - 40, 30, '#22a447', '#fff'); }
        }
      } else {
        if (type === 'st' && Array.isArray(d)) { Ts.push(d[0] / 1000); Tp.push(d[1] / 1000); Th.push(d[2] / 100); Tr.push(d[3] / 100); }
        else if (type === 'tres' && Array.isArray(d)) {
          tieMsg = d[0] ? 'KNOT!' : d[1] === 1 ? 'TOO TIGHT!' : d[1] === 2 ? 'NOT FULL YET' : 'MISSED!'; tieMsgAt = g.c;
          if (d[0]) { tieLocal = 2; sfx.stamp(); } else { tieLocal = 0; sfx.buzz(); }
        } else if (type === 'pop') { popped = true; popFx(); }
      }
    },
    draw() {
      const T = g.c, won = g.result === 'win' || (ending && ending.res === 'win') || tieLocal === 2, lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx; if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      ferris(T);
      // the numbers this screen shows
      const Sv = pump ? S : (Ts.at() || 0), Pv = pump ? Pr : (Tp.at() || 0), Hv = pump ? h : (Th.at() === null ? 0 : Th.at()), Rv = pump ? redT : (Tr.at() || 0);
      const L = lim(Sv), jit = clamp((Pv - (L - .42)) / .42, 0, 1), open = pump ? vOpen : vWant;
      const wasPop = lost && popped, deflate = lost && !popped;
      // the gauge (valve screen) or a plain sign (pumper screen: it cannot see the pressure)
      if (pump) {
        rr(GXY[0] - 7, GXY[1] + 56, 14, 560 - GXY[1] - 56, 4); ink('#8a5a34', 3.5);
        X.save(); X.translate(GXY[0], GXY[1]); X.rotate(Math.sin(T * 1.3) * .03); rr(-62, -38, 124, 76, 10); ink('#d9944f', 4); X.fillStyle = '#c98443'; X.fillRect(-52, -6, 104, 3); txt('GLOBOS', 0, -12, 28, '#fff', 'center', 104); txt('2 COINS', 0, 22, 20, INK, 'center', 100); X.restore();
      } else gauge(GXY[0], GXY[1], GXY[2], Pv, L, T, Rv > 0 ? 1 : jit * .5);
      // gags: the kid with the pin, the pigeon
      const creep = Math.min(1, T / 12), kx = 330 + creep * 22;
      kid(kx, GY + 40, 1.15, T, wasPop ? 'innocent' : won ? 'oops' : null, creep);
      const pg = wasPop && rk > .05 ? 'fly' : Math.abs(Math.cos(T * .45)) > .35 ? 'walk' : 'peck', px = 90 + Math.sin(T * .45) * 55;
      if (pg === 'fly') pigeon(px + (rk - .05) * 160, GY + 14 - Math.pow(rk - .05, .7) * 220, 1, T, 'fly', 1); else pigeon(px, GY + 14, 1, T, pg, Math.cos(T * .45) > 0 ? 1 : -1);
      // seller
      const sMood = won ? 'cheer' : wasPop && rk > .35 ? 'shred' : deflate ? 'sad' : jit > .5 ? 'worry' : null;
      const hatGone = won && rk > .05;
      const shr = wasPop && rk > .5 ? SHREDS : null;
      seller(SX, SY, 1, sMood, T, !hatGone, shr, !wasPop);
      // the dragon (behind the rig)
      const droopK = open ? 1 : 0;
      let dS = Sv, dOpts = { pal, jit: lost ? 0 : jit, droop: droopK * clamp(.6, 0, 1), puff: puffK, look: [kx - DX, GY - 200], mood: won ? 'happy' : deflate ? 'dead' : jit > .55 ? 'worry' : null, bow: won || tieLocal === 2, rot: 0 };
      if (won) { const k = rk >= 0 ? rk : 0; dOpts.oy = 0; dOpts.rot = Math.sin(T * 5) * .04; }
      if (won && rk > 0) { const up = Math.pow(rk, 1.6) * 400; X.save(); X.translate(0, -up); X.translate(NZ[0], NZ[1]); X.rotate(Math.sin(T * 4) * .05); X.translate(-NZ[0], -NZ[1]); dragon(1, T, dOpts); X.restore(); }
      else if (wasPop) { if (rk < .2) { X.save(); const k = rk / .2; star(DX, 290, 40 + k * 120, 20 + k * 52, 14, rk * 2, '#fff', 3); star(DX, 290, 24 + k * 80, 12 + k * 34, 12, -rk, '#ffe14d', 0); X.restore(); } dragon(0, T, { pal, mood: 'dead' }); }
      else if (deflate) { const k = ease(clamp(rk / .9, 0, 1)); dragon(Sv * (1 - k), T, Object.assign(dOpts, { jit: (1 - k) * .5, puff: 0 })); if (rk < .9) for (let i = 0; i < 3; i++) { const a = (T * 9 + i * 2) % 1; X.globalAlpha = 1 - a; drawPuff(NZ[0] + 18 + a * 60, NZ[1] - 30 - a * 70 - i * 12, 9 + a * 12); X.globalAlpha = 1; } }
      else dragon(dS, T, dOpts);
      // hat carried away by the dragon
      if (won && rk > 0) {
        const up = Math.pow(rk, 1.6) * 400, hk = clamp(rk / .55, 0, 1), hx = lerp(SX, DX + 22, ease(hk)), hy = lerp(SY - 114, 178 - 80 - up + 4, ease(hk)) - Math.sin(hk * Math.PI) * 70;
        X.save(); X.translate(hx, hy); X.rotate(-.5 * hk + Math.sin(T * 12) * .1 * (1 - hk)); el(0, 2, 32, 8); ink('#e8c36a', 3.5); rr(-19, -22, 38, 24, 7); ink('#f2d98a', 3.5); X.fillStyle = '#d93a57'; X.fillRect(-19, -8, 38, 7); X.strokeStyle = INK; X.lineWidth = 2.5; X.strokeRect(-19, -8, 38, 7); X.restore();
      }
      // the rig
      const grip = bellows(Hv, T, 0);
      hose(T, pump ? flow : (Hv > 0 ? 0 : 0));
      fitting(T, lost ? 0 : jit, open ? 1 : 0, tied);
      // players
      const pcol = pump ? myCol() : pCol(), vcol = pump ? pCol() : myCol();
      const happy = won, sadm = lost, mp = happy ? 'happy' : sadm ? 'sad' : null;
      const bob = pump ? Math.sin(Hv * Math.PI) * 0 : 0;
      reach(PX, PY, 5.4, 1, grip[0], grip[1], pcol);
      if (!happy) reach(PX, PY, 5.4, -1, grip[0] - 4, grip[1] + 2, pcol); else { X.save(); X.translate(PX, PY); const w = Math.sin(T * 14) * .3; arm(5.4, -1, -.45 + w, 1.3, pcol); X.restore(); }
      caos(PX, PY - bob, 5.4, { col: pcol, mood: mp });
      if (!happy && !sadm && jit > .55) sweat(PX + 22, PY - 70, T, 0);
      reach(VX, VY, 5.4, -1, VW[0] + 4, VW[1] + 6, vcol);
      caos(VX, VY, 5.4, { col: vcol, mood: mp });
      if (!happy && !sadm && jit > .55) sweat(VX - 20, VY - 70, T, .4);
      if (open && !lost) for (let i = 0; i < 2; i++) { const a = (T * 3 + i * .5) % 1; X.globalAlpha = (1 - a) * .9; drawPuff(VW[0] + 6 + a * 24, VW[1] - 20 - a * 40, 6 + a * 8); X.globalAlpha = 1; }
      pill(PX, PY - 76, pump ? 'YOU' : 'YOUR FRIEND', pcol); pill(VX, VY - 76, pump ? 'YOUR FRIEND' : 'YOU', vcol);
      // knot UI (valve): when the dragon is full
      const fullNow = Sv >= FULL - .01;
      if (!pump && fullNow && !won && !lost) {
        const n = needleAt(T), tight = Pv > .74;
        knotUI(n, !tight, T);
        badge(tight ? 'TOO TIGHT: VENT!' : TOUCH ? 'TAP THE KNOT!' : 'CLICK THE KNOT!', 618, 426, 18, tight ? '#e8434f' : '#22a447', '#fff', 1, -.03);
      }
      if (pump && fullNow && !won && !lost) bubble('FULL!', DX + 70, 112, 26, 1);
      // particles, words
      drawBits(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, clamp(q.x, 120, 680), Math.max(176, q.y - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!pump && tieMsg && !won && !lost) badge(tieMsg, NZ[0] + 60, NZ[1] - 120, 22, tieMsg === 'KNOT!' ? '#22a447' : '#e8434f', '#fff', outBack((T - tieMsgAt) / .15), -.04);
      if (wasPop && rk > .08) badge('POP!', DX, 280, 64, '#e8434f', '#fff', outBack((rk - .08) / .2) * (rk < 1 ? 1 : Math.max(0, 1 - (rk - 1) / .3)), -.08);
      if (deflate && rk > .1 && rk < 1.4) badge('PFFFT...', DX, 250, 40, '#7a5040', '#fff', outBack((rk - .1) / .2), .05);
      if (won && rk > .4) badge('UP, UP!', 400, 260, 44, '#22a447', '#fff', outBack((rk - .4) / .2) * (rk < 1.4 ? 1 : Math.max(0, 1 - (rk - 1.4) / .3)), -.05);
      // controls hint inside the scene for the first seconds
      if (!g.result && T < 3.6) {
        if (pump) badge(TOUCH ? 'DRAG UP AND DOWN' : 'HOLD SPACE, LET GO', 190, 424, 18, '#2b9ee6', '#fff', 1, -.04);
        else badge(TOUCH ? 'HOLD TO LET AIR OUT' : 'HOLD CLICK / SPACE TO VENT', 560, 560 - 70, 17, '#2b9ee6', '#fff', 1, -.04);
      }
      if (!pump && !g.result && T < 6 && open) badge('HISSSS', VW[0] - 30, VW[1] - 70, 20, '#7a5040', '#fff', 1, .05);
      if (pump && !g.result && open && !won) badge('HISS = STOP!', BX + 60, BY - 150, 20, '#e8434f', '#fff', 1, -.04);
      vignette(.14);
    },
    down(p) { if (pump) { ptrY = p.y; ptrAt = g.c; pDown = true; } else if (!g.tie(p)) vPtr = true; },
    up() { if (pump) pDown = false; else vPtr = false; },
    move(p) { if (pump) { ptrY = p.y; ptrAt = g.c; } },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (pump) { if (e.code === 'ArrowDown' || e.code === 'KeyS') kHeld.clear(); else kHeld.add(e.code); }
      else if (TIEKEY.has(e.code)) { if (!e.repeat) g.tie(null); } else kHeld.add(e.code);
    },
    keyup(e) { kHeld.delete(e.code); },
    /* valve: the knot. A press on the knot (or Enter / E / F) while the dragon is full is the tie attempt; true = it was used as a tie press */
    tie(p) {
      if (pump || g.result || tieLocal === 2) return false; const Sv = Ts.at() || 0, full = Sv >= FULL - .01;
      if (p && !(full && Math.hypot(p.x - NZ[0], (p.y - (NZ[1] - 30)) * .8) < 120)) return false;
      if (!full || g.c - tieAt < .4) return !!p && full; tieAt = g.c; nSeq++;
      D.send('tie', { n: Math.round(needleAt(g.c) * 1000) / 1000, q: nSeq }); sfx.click(); return true;
    },
  };
  const SHREDS = Array.from({ length: 9 }, (_, i) => [-26 + (i * 37 % 52), -108 + (i * 53 % 90), (i * 1.7) % 3, ['#2fc9a0', '#ff6fb0', '#fff0b8', '#ffcf33'][i % 4]]);
  function drawPuff(x, y, r) { X.beginPath(); X.arc(x, y, r, 0, TAU); X.arc(x + r * .8, y + r * .3, r * .8, 0, TAU); X.arc(x - r * .6, y + r * .4, r * .7, 0, TAU); ink('#ffffff', 2); }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1);
      X.globalAlpha = fade;
      if (b.k === 1) drawPuff(b.x, b.y, b.r * (.6 + a));
      else if (b.k === 2) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); rr(-b.r * 1.5, -b.r * .5, b.r * 3, b.r, b.r * .3); ink(b.c, 2); X.restore(); }
      X.globalAlpha = 1;
    }
  }
  g.dbg = {
    /* what the PUMPER screen shows: the handle (mine), the dragon's size, how hard the neck trembles (0..1), whether it hears the hiss, whether the dragon looks full */
    pumpView: () => ({ h, bel, S, jit: clamp((Pr - (lim(S) - .42)) / .42, 0, 1), hiss: vOpen, full: S >= FULL - .01 }),
    /* what the VALVE screen shows: the gauge (pressure + the red line), the dragon's size, the knot needle, whether my valve is open */
    valveView: () => { const Sv = Ts.at() || 0, Pv = Tp.at() || 0; return { P: Pv, lim: lim(Sv), S: Sv, red: Tr.at() || 0, full: Sv >= FULL - .01, needle: needleAt(g.c), open: vWant, handle: Th.at() || 0, tight: Pv > .74, tieMsg }; },
    S: () => S, P: () => Pr, popped: () => popped, FULL, lim,
  };
  wire(g, D, 0, sp, 'du_pump');
  return g;
}
reg('du_pump', duPump, 'DRAGON PUMP'); REGMAP.du_pump.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.6 s loop ───────────── */
function demo(role, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, '#5a49c9'); gr.addColorStop(1, '#ffd9a0'); X.fillStyle = gr; X.fillRect(0, 0, 520, 150);
  X.fillStyle = '#d9c3ae'; X.fillRect(0, 150, 520, 90); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 150); X.lineTo(520, 150); X.stroke();
  const u = t % 3.6, S = clamp(u / 2.6, 0, 1) * .8 + (u > 3 ? .2 * ease((u - 3) / .4) : 0), hh = (Math.sin(u * 7) + 1) / 2;
  const P = role ? (u < 1.2 ? u / 1.2 * .75 : u < 1.8 ? .75 - (u - 1.2) / .6 * .5 : u < 2.8 ? .25 + (u - 1.8) * .4 : .65) : 0, venting = role && u > 1.2 && u < 1.8;
  X.save(); X.translate(130, 0); X.scale(.46, .46); X.translate(-DX, 6 - 130);
  X.translate(0, 330 * .46 / .46 * 0); dragon(S, t, { pal: 0, jit: venting ? 0 : clamp((P - .5) * 3, 0, 1), mood: u > 3 ? 'happy' : null, bow: u > 3.1, droop: venting ? 1 : 0 });
  X.restore();
  if (role === 0) {
    X.save(); X.translate(330, 214); X.scale(.52, .52); X.translate(-BX, -BY); const gp = bellows(hh, t, 0); X.restore();
    X.save(); X.translate(262, 218); X.scale(.52, .52); X.translate(-PX, -PY); reach(PX, PY, 5.4, 1, gp[0] * 0 + PX + 52, PY - 40 - hh * 22, '#FFC93C'); caos(PX, PY, 5.4, { col: '#FFC93C' }); X.restore();
    demoFinger(330 - 30, 120 + (1 - hh) * 60, true, 0); badge('PUMP!', 400, 34, 18, '#2b9ee6', '#fff', 1, -.03);
  } else {
    X.save(); X.translate(380, 120); X.scale(.62, .62); gauge(0, 0, 66, P, 1 - .22 * S, t, P > .75 ? 1 : 0); X.restore();
    X.save(); X.translate(300, 234); X.scale(.55, .55); X.translate(-VX, -VY); caos(VX, VY, 5.4, { col: '#6EA8FE', mood: u > 3 ? 'happy' : null }); X.restore();
    demoFinger(330, 206, venting, venting ? ((u - 1.2) / .6) : 0); badge(venting ? 'HISSSS' : u > 2.8 ? 'TIE IT!' : 'WATCH THE GAUGE', 390, 34, 18, venting ? '#7a5040' : '#22a447', '#fff', 1, -.03);
  }
}
DUO.INFO.du_pump = [['PUMPER', 'PUMP THE DRAGON UP', 'HOLD / RELEASE, OVER AND OVER'], ['VALVE', 'VENT, THEN TIE THE KNOT', 'HOLD TO VENT, TAP THE KNOT']];
DUO.DEMOS.du_pump = [t => demo(0, t), t => demo(1, t)];

})();
