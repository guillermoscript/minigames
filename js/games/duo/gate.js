'use strict';
/* ═════════ DUO · DRAGON GATE (du_crank) ═════════
   GATEKEEPER (role 0): stands on the gatehouse and HOLDS the big lever (click / Space / finger) to keep the portcullis up; letting go drops
   it at once. A dragon on the hill inhales (about 1 s of warning: glowing throat, "!" bubble, dotted aim line), then spits a fireball at the gate.
   CRANKER (role 1, JUDGE): turns the winch (drag in circles anywhere, or mash Space) that reels a string of giant sausages in through the gate.
   The portcullis spikes pin the string while the gate is down, so cranking only reels while it is up.
   Fireball + open gate = it flies in and toasts the cranker (the sausages slide back out). Fireball + shut gate = CLANG.
   Reel all 6 sausages in before the time runs out; on a time-out the dragon roasts whatever is still outside.
   Netcode (lag must never punish a player for what their partner did right a moment ago):
   - 'g' 0|1 (gatekeeper -> cranker, on change): the gate's target. The gatekeeper's gate moves the instant the lever does; the cranker
     animates its own gate toward the latest target at the same speed (no extra interpolation delay).
   - The GATEKEEPER judges every fireball with its own gate (it is the one acting on it) and sends 'fb' {i, r} (r 1 = it got in).
     On the cranker's screen the fireball presses on the bars until that verdict arrives, then splats or flies in.
   - The CRANKER owns the progress and the verdict. A crank counts while the gate it sees is up, and for CLOSE_GRACE after it sees it drop;
     cranks made while it is down are buffered for PEND seconds and paid out when the 'up' arrives (a crank that beat the lag still counts).
   - 'w' {p, a} (cranker -> gatekeeper, coalesced, <= 10/s): progress + winch angle, rendered through track(). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); k = clamp(k, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box (x<320, y<170), the top-right corner and y>552) ───────────── */
const GY = 420;                                          // ground line
const TX0 = 316, TX1 = 464, TTOP = 168;                  // the gatehouse: its walkway is TTOP, its face goes down to the ground
const AX0 = 346, AX1 = 434, ACX = 390, ASP = 300, AR = 44; // the arch: straight jambs from the ground up to ASP, a round top of radius AR
const LINK = 54, NL = 6, SR = 14, CHY = GY - 15;         // a sausage link: length, how many, half thickness, centre line on the road
const WX = 190, WY = 344, FR = 60;                       // the winch: hub + flange radius
const P0 = [WX + 10, WY + 30], P1 = [300, CHY];          // the string leaves the drum at P0, reaches the road at P1, then runs right
const LB = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
const U_HEAD0 = LB + (474 - P1[0]);                      // where the first link starts (just outside the gate)
const U_IN = LB + (AX0 - P1[0]);                         // a link whose tail passed this is IN
const TRAVEL = U_HEAD0 + NL * LINK - U_IN;               // how far the string moves from the start to "all in"
const LIFT = 152, PCY = CHY - SR + 6;                    // portcullis travel + where its bottom bar rests when down (the spikes bite the sausage)
const LPX = 448, LPY = TTOP - 6, LLEN = 82;              // the lever pivot + handle length
const LA_UP = .25, LA_HELD = -.74;                      // lever angle when let go (gate down) / pulled (gate up)
const KX = 348, CKX = 84;                                // the gatekeeper stands on the walkway, the cranker on the courtyard floor
const DGX = 700, DGY = 250, DS = 1;                      // the dragon's head
const MOUTH = [628, 270], AIMC = [540, 236], HIT = [AX1 + 6, 338];
const INC = [300, 300], TOAST = [CKX + 6, 384];           // a fireball that gets in: through the arch, into the cranker
const BTN = [200, 452, 400, 88];
const fbPos = k => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * MOUTH[0] + b * AIMC[0] + c * HIT[0], a * MOUTH[1] + b * AIMC[1] + c * HIT[1]]; };
const inPos = k => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * HIT[0] + b * INC[0] + c * TOAST[0], a * HIT[1] + b * INC[1] + c * TOAST[1]]; };
const pathAt = u => u < LB ? [lerp(P0[0], P1[0], u / LB), lerp(P0[1], P1[1], u / LB), Math.atan2(P1[1] - P0[1], P1[0] - P0[0])] : [P1[0] + (u - LB), CHY, 0];
const linksIn = p => clamp(Math.floor((U_IN - (U_HEAD0 - p * TRAVEL)) / LINK + 1e-6), 0, NL);

/* palette */
const STONE = '#c3bddc', STONE2 = '#958db8', STONEL = '#e0dcf0', MORTAR = '#a39cc4';
const SAUS = '#e2694c', SAUS2 = '#ad4330', SAUSL = '#ffae8f', BURNT = '#3b2b2a';
const DRG = '#68c95a', DRG2 = '#3d9449', DRGL = '#a8ec8c', BELLY = '#ffe39a';
const IRON = '#5b5670', IRON2 = '#3c3850', WOOD = '#c98a4b', WOOD2 = '#9a6232';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading with a shifted copy of the same shape: base on top, the shade shows as a crescent on the (sx, sy) side */
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function glint(p, x, y, rx, ry, col, rot = 0) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
function pill(x, y, label, col, up) {                // a name tag with a little pointer (down, or up), e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 9, y + 13 * py); X.lineTo(x, y + 24 * py); X.lineTo(x + 9, y + 13 * py); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
function plate(b, col, dk, down, lit) {
  const [x, y, w, h] = b, d = down ? 3 : 9;
  rr(x, y + 9, w, h, 20); ink(dk, 4);
  rr(x, y + 9 - d, w, h, 20); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 12, 6); X.fill();
  rr(x, y + 9 - d, w, h, 20); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  if (lit) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(now * 10); rr(x + 7, y + 16 - d, w - 14, h - 14, 15); X.stroke(); X.globalAlpha = 1; }
  return 9 - d;
}
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(236, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 236);
  X.restore();
}
/* a blocky arm from a shoulder to a hand point, with a square fist (Caos's arms are stubs: these stretch, cartoon style) */
function arm(x0, y0, x1, y1, u, col) {
  const ol = Math.max(3, u * .5), aw = 1.15 * u, hs = 1.9 * u;
  X.lineCap = 'square'; X.strokeStyle = INK; X.lineWidth = aw + ol * 2; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke();
  X.fillStyle = INK; X.fillRect(x1 - hs / 2 - ol, y1 - hs / 2 - ol, hs + ol * 2, hs + ol * 2);
  X.strokeStyle = col; X.lineWidth = aw; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke();
  X.fillStyle = col; X.fillRect(x1 - hs / 2, y1 - hs / 2, hs, hs); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(x1 - hs / 2, y1 - hs / 2, hs * .45, hs * .4);
  X.lineCap = 'round';
}
function puff(x, y, r, a, col) { X.globalAlpha = a; X.beginPath(); X.arc(x, y, r, 0, TAU); ink(col || '#d9d4e8', 2.5); X.fillStyle = 'rgba(255,255,255,.5)'; el(x - r * .3, y - r * .35, r * .35, r * .22); X.fill(); X.globalAlpha = 1; }

/* ───────────── props ───────────── */
/* one sausage link centred at (x, y) along angle a. burnt 0..1 chars it */
const SAUSP = `M${-LINK / 2 + 3 + SR} ${-SR} L${LINK / 2 - 3 - SR} ${-SR} A${SR} ${SR} 0 0 1 ${LINK / 2 - 3 - SR} ${SR} L${-LINK / 2 + 3 + SR} ${SR} A${SR} ${SR} 0 0 1 ${-LINK / 2 + 3 + SR} ${-SR} Z`;
function sausage(x, y, a, burnt, wob) {
  X.save(); X.translate(x, y); X.rotate(a + (wob || 0));
  const p = P(SAUSP), b = burnt || 0;
  cel(p, mix(SAUS, BURNT, b), mix(SAUS2, '#1e1616', b), 0, -6, 3.5);
  X.save(); X.clip(p); X.fillStyle = b > .5 ? 'rgba(255,140,60,.35)' : mix(SAUSL, '#6a4a40', b); rr(-LINK / 2 + 12, -SR + 4, LINK - 30, 5, 2.5); X.fill();
  if (b > .2) { X.fillStyle = 'rgba(20,10,10,.5)'; for (const [q, w] of [[-12, 2], [4, -4], [14, 4]]) { el(q, w, 4 * b, 2.5 * b); X.fill(); } }
  X.restore();
  X.restore();
}
function knot(x, y) { X.beginPath(); X.arc(x, y, 4.5, 0, TAU); ink('#f3dfae', 2.5); X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(x - 1, y - 4); X.quadraticCurveTo(x - 6, y - 13, x - 1, y - 14); X.moveTo(x + 1, y - 4); X.quadraticCurveTo(x + 7, y - 12, x + 3, y - 15); X.stroke(); }
/* the string of sausages for progress p (0..1): links along the path from the drum, a rope before the first one */
function drawString(p, t, burnAt, moving, pinned) {
  const uh = U_HEAD0 - p * TRAVEL;
  // rope from the drum to the first link
  if (uh > 0) {
    X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(P0[0], P0[1]);
    if (uh > LB) { X.lineTo(P1[0], P1[1]); X.lineTo(P1[0] + uh - LB, CHY); } else { const [x, y] = pathAt(uh); X.lineTo(x, y); }
    X.stroke(); X.strokeStyle = '#e8cf95'; X.lineWidth = 4; X.stroke();
    X.setLineDash([5, 7]); X.lineDashOffset = -p * TRAVEL; X.strokeStyle = '#b99a5a'; X.lineWidth = 2; X.stroke(); X.setLineDash([]); X.lineDashOffset = 0;
  }
  for (let i = NL - 1; i >= 0; i--) {
    const u0 = uh + i * LINK, um = u0 + LINK / 2; if (um < 6) continue;
    const [x, y, a] = pathAt(um), b = burnAt ? burnAt(x) : 0;
    const wob = moving ? Math.sin(t * 22 + i * 1.7) * .03 : pinned && x > AX0 - 20 && x < AX1 + 30 ? Math.sin(t * 30) * .02 : 0;
    sausage(x, y - (moving ? Math.abs(Math.sin(t * 18 + i)) * 1.5 : 0), a, b, wob);
    if (i > 0 && u0 > 4) { const [kx, ky] = pathAt(u0); knot(kx, ky - 2); }
  }
}
/* the winch: an A-frame, a big spool flange that turns (angle a), the coiled sausages on the drum, an iron crank arm + handle */
function winchFrame() {
  for (const [lx, ly] of [[WX - 50, GY], [WX + 50, GY]]) { X.beginPath(); X.moveTo(lx - 9, ly); X.lineTo(WX - 6, WY); X.lineTo(WX + 6, WY); X.lineTo(lx + 9, ly); X.closePath(); ink(WOOD2, 3.5); }
  rr(WX - 66, GY - 12, 132, 14, 5); ink(WOOD, 3.5);
}
function winch(a, coil, glow) {
  winchFrame();
  // flange with bolt holes that show the spin
  X.beginPath(); X.arc(WX, WY, FR, 0, TAU); ink(WOOD, 4.5);
  X.save(); X.beginPath(); X.arc(WX, WY, FR, 0, TAU); X.clip(); X.fillStyle = WOOD2; X.beginPath(); X.arc(WX + 6, WY + 8, FR, 0, TAU); X.arc(WX, WY, FR, 0, TAU, true); X.fill(); X.restore();
  X.strokeStyle = 'rgba(120,70,30,.45)'; X.lineWidth = 3; X.beginPath(); X.arc(WX, WY, FR - 9, 0, TAU); X.stroke();
  for (let i = 0; i < 6; i++) { const q = a + i * TAU / 6; X.beginPath(); X.arc(WX + Math.cos(q) * (FR - 17), WY + Math.sin(q) * (FR - 17), 5.5, 0, TAU); ink('#7a4a22', 2); }
  // the coil of reeled-in sausage on the drum
  const cr0 = 20, cr1 = 20 + 15 * clamp(coil, 0, 1);
  X.beginPath(); X.arc(WX, WY, cr1 + 5, 0, TAU); ink(coil > .02 ? SAUS2 : '#7a4a22', 3.5);
  if (coil > .02) { X.fillStyle = SAUS; X.beginPath(); X.arc(WX, WY, cr1 + 1, 0, TAU); X.fill(); X.strokeStyle = SAUS2; X.lineWidth = 2.5; for (let r = cr0 + 5; r < cr1; r += 6) { X.beginPath(); X.arc(WX, WY, r, a, a + 5.4); X.stroke(); } X.strokeStyle = SAUSL; X.lineWidth = 3; X.beginPath(); X.arc(WX, WY, cr1 - 2, -2.4, -1.4); X.stroke(); }
  if (glow > 0) { X.globalAlpha = glow; X.strokeStyle = '#fff6b0'; X.lineWidth = 5; X.beginPath(); X.arc(WX, WY, cr1 + 9, 0, TAU); X.stroke(); X.globalAlpha = 1; }
  X.beginPath(); X.arc(WX, WY, 11, 0, TAU); ink(IRON, 3);
  // crank arm + handle
  const hx = WX + Math.cos(a) * 48, hy = WY + Math.sin(a) * 48;
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 15; X.beginPath(); X.moveTo(WX, WY); X.lineTo(hx, hy); X.stroke(); X.strokeStyle = IRON; X.lineWidth = 8; X.stroke();
  X.beginPath(); X.arc(WX, WY, 6, 0, TAU); ink('#9a96ad', 2.5);
  X.beginPath(); X.arc(hx, hy, 10, 0, TAU); ink('#ff5a4f', 3); X.fillStyle = 'rgba(255,255,255,.55)'; el(hx - 3, hy - 4, 3.5, 2.5, -.5); X.fill();
  return [hx, hy];
}
/* the portcullis inside the arch: k 0 = down (pinning the string), 1 = up. heat: red-hot glow after a fireball */
const ARCHP = `M${AX0} ${GY} L${AX0} ${ASP} A${AR} ${AR} 0 0 1 ${AX1} ${ASP} L${AX1} ${GY} Z`;
function portcullis(k, heat, t, shake) {
  const y0 = PCY - k * LIFT, sx = shake ? Math.sin(t * 70) * shake * 3 : 0;
  X.save(); X.clip(P(ARCHP)); X.translate(sx, 0);
  const col = mix(IRON, '#ff5a2a', heat * .9), lt = mix('#8a85a3', '#ffd27a', heat);
  for (let i = 0; i < 4; i++) {                          // cross bars
    const y = y0 - 18 - i * 40; X.fillStyle = INK; X.fillRect(AX0 - 4, y - 7, AX1 - AX0 + 8, 14); X.fillStyle = col; X.fillRect(AX0 - 4, y - 4, AX1 - AX0 + 8, 8); X.fillStyle = lt; X.fillRect(AX0 - 4, y - 4, AX1 - AX0 + 8, 2.5);
  }
  for (let i = 0; i < 5; i++) {                          // uprights, each ending in a spike
    const x = AX0 + 10 + i * 17;
    X.beginPath(); X.moveTo(x - 4, y0 - 200); X.lineTo(x + 4, y0 - 200); X.lineTo(x + 4, y0 - 2); X.lineTo(x, y0 + 10); X.lineTo(x - 4, y0 - 2); X.closePath(); ink(col, 2.5);
    X.fillStyle = lt; X.fillRect(x - 3, y0 - 198, 2, 192);
    for (let j = 0; j < 4; j++) { X.fillStyle = INK; X.beginPath(); X.arc(x, y0 - 18 - j * 40, 2.6, 0, TAU); X.fill(); }
  }
  if (heat > 0) { X.globalAlpha = heat * .35; X.fillStyle = '#ff9a3c'; X.fillRect(AX0, y0 - 200, AX1 - AX0, 210); X.globalAlpha = 1; }
  X.restore();
}
/* the lever on the battlements: an iron box, a chain into the tower, the handle at angle la (0 = straight up, + leans right) */
function leverAt(la) { return [LPX + Math.sin(la) * LLEN, LPY - Math.cos(la) * LLEN]; }
function lever(la, lit, t) {
  X.strokeStyle = INK; X.lineWidth = 6; X.setLineDash([6, 4]); X.beginPath(); X.moveTo(LPX + 14, LPY + 2); X.lineTo(LPX + 22, TTOP + 2); X.stroke(); X.strokeStyle = '#a7a3bc'; X.lineWidth = 3; X.stroke(); X.setLineDash([]);
  const [kx, ky] = leverAt(la);
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 15; X.beginPath(); X.moveTo(LPX, LPY); X.lineTo(kx, ky); X.stroke(); X.strokeStyle = '#8f8aa8'; X.lineWidth = 8; X.stroke(); X.strokeStyle = 'rgba(255,255,255,.45)'; X.lineWidth = 2.5; X.stroke();
  rr(LPX - 20, LPY - 10, 40, 18, 5); ink(IRON, 3.5); X.fillStyle = '#7d7895'; X.fillRect(LPX - 16, LPY - 7, 32, 4);
  X.beginPath(); X.arc(LPX, LPY - 1, 6, 0, TAU); ink('#bbb7cc', 2.5);
  const r = 15 + (lit ? Math.sin(t * 16) * 1.5 : 0);
  X.beginPath(); X.arc(kx, ky, r, 0, TAU); ink(lit ? '#ff3b3b' : '#ff5a4f', 3.5); X.fillStyle = 'rgba(255,255,255,.6)'; el(kx - 5, ky - 6, 5, 3.5, -.5); X.fill();
}

/* ───────────── the dragon (facing left), head at (x, y) ───────────── */
const D_HEAD = 'M34 -26 C26 -50 -10 -54 -30 -36 C-44 -30 -66 -32 -80 -22 C-92 -12 -90 6 -76 10 L-8 12 C12 26 44 18 44 -2 Z';
const D_JAW = 'M-4 4 L-70 6 C-84 8 -84 22 -70 24 C-46 28 -18 26 2 18 Z';
const D_NECK = 'M2 4 C14 46 30 82 54 128 L120 128 C100 76 74 30 40 -16 Z';
const D_HORN = 'M10 -40 Q18 -70 44 -80 Q34 -58 30 -36 Z';
const D_HORN2 = 'M28 -30 Q44 -52 64 -54 Q50 -38 42 -22 Z';
const D_WING = 'M80 70 Q120 10 168 0 Q150 26 156 48 Q134 44 124 70 Q110 60 96 82 Z';
/* o: inh 0..1 (inhale), open 0..1, mood ('idle' 'inhale' 'spit' 'grump' 'laugh' 'sad' 'roast'), t, look [dx, dy] */
function dragon(x, y, s, o) {
  const t = o.t || 0, inh = o.inh || 0, mood = o.mood || 'idle', open = clamp(o.open || 0, 0, 1);
  X.save(); X.translate(x, y); X.scale(s, s);
  const tilt = inh * .26 - (mood === 'spit' ? .12 : 0) + (mood === 'laugh' ? Math.sin(t * 20) * .05 - .08 : 0) + (mood === 'sad' ? .1 : 0) + (mood === 'roast' ? -.1 : 0);
  // wing flapping behind the hill, then the neck
  X.save(); X.translate(30, 40); X.rotate(Math.sin(t * 3) * .08 - (mood === 'laugh' ? .2 : 0)); X.translate(-30, -40); cel(P(D_WING), '#58b84c', DRG2, 10, 8, 4);
  X.strokeStyle = DRG2; X.lineWidth = 3; X.beginPath(); X.moveTo(96, 80); X.lineTo(150, 8); X.moveTo(110, 70); X.lineTo(152, 30); X.stroke(); X.restore();
  const np = P(D_NECK); cel(np, DRG, DRG2, -12, 0, 5);
  X.save(); X.clip(np); X.fillStyle = BELLY; X.beginPath(); X.moveTo(0, 4); X.bezierCurveTo(12, 46, 26, 84, 48, 130); X.lineTo(68, 130); X.bezierCurveTo(46, 84, 30, 46, 22, 0); X.closePath(); X.fill();
  X.strokeStyle = '#e8b85a'; X.lineWidth = 3; for (let i = 0; i < 5; i++) { const yy = 20 + i * 22, xx = 8 + i * 8.5; X.beginPath(); X.moveTo(xx - 2, yy); X.lineTo(xx + 20, yy - 4); X.stroke(); }
  if (inh > 0 || mood === 'roast') {                      // the fire building up in the throat
    const k = mood === 'roast' ? 1 : inh, pulse = .75 + .25 * Math.sin(t * 30);
    const gr = X.createRadialGradient(24, 40, 2, 24, 40, 70); gr.addColorStop(0, `rgba(255,250,170,${k * pulse})`); gr.addColorStop(.45, `rgba(255,150,40,${k * .85 * pulse})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
    X.fillStyle = gr; X.fillRect(-40, -20, 140, 150);
  }
  X.restore();
  for (let i = 0; i < 4; i++) { const yy = 30 + i * 26, xx = 58 + i * 13; X.beginPath(); X.moveTo(xx, yy - 10); X.lineTo(xx + 20, yy - 2); X.lineTo(xx + 4, yy + 10); X.closePath(); ink('#ffc94d', 2.5); }
  // the head tilts back while it inhales, snaps forward to spit
  X.save(); X.translate(10, 10); X.rotate(tilt); X.translate(-10, -10);
  X.save(); X.translate(-4, 4); X.rotate(-open * .5); X.translate(4, -4);
  const jp = P(D_JAW); cel(jp, DRG, DRG2, 0, 6, 4);
  X.save(); X.clip(jp); X.fillStyle = BELLY; X.fillRect(-90, 16, 100, 12); X.restore();
  if (open > .05) for (const tx of [-60, -40]) { X.beginPath(); X.moveTo(tx - 5, 6); X.lineTo(tx, -4); X.lineTo(tx + 5, 6); X.closePath(); ink('#fffbea', 2); }
  X.restore();
  if (open > .05) {                                       // mouth inside
    X.save(); X.beginPath(); X.moveTo(-6, 4); X.lineTo(-76, 10); X.lineTo(-76 + Math.sin(open * .5) * 6, 10 + Math.sin(open * .5) * 70); X.closePath(); X.clip();
    X.fillStyle = '#7a1838'; X.fillRect(-90, 0, 100, 60); X.fillStyle = '#ff7a95'; el(-36, 20 + open * 10, 26, 8); X.fill();
    if (mood === 'roast' || mood === 'spit') { const gr = X.createRadialGradient(-20, 14, 2, -20, 14, 50); gr.addColorStop(0, '#fff6a0'); gr.addColorStop(1, 'rgba(255,120,30,.2)'); X.fillStyle = gr; X.fillRect(-90, 0, 100, 60); }
    X.restore();
  }
  for (const hp of [D_HORN2, D_HORN]) cel(P(hp), '#fff1c9', '#d9c08a', 3, 0, 3.5);
  const hp = P(D_HEAD), cheek = inh * 12;
  cel(hp, DRG, DRG2, 0, -9, 5);
  glint(hp, -20, -38, 26, 7, DRGL, -.2);
  X.save(); X.clip(hp); X.fillStyle = DRGL; el(-70, -12, 14, 9, -.3); X.fill(); X.restore();
  if (cheek > .5) { X.fillStyle = DRG; el(-24, 2, 18 + cheek, 10 + cheek * .7); X.fill(); X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.ellipse(-24, 2, 18 + cheek, 10 + cheek * .7, 0, .2, Math.PI - .2); X.stroke(); X.fillStyle = 'rgba(255,170,80,.6)'; el(-24, 0, 10 + cheek * .5, 5 + cheek * .3); X.fill(); }
  // nostrils (flare while inhaling), little plumes of smoke
  const fl = 1 + inh * .6 + (mood === 'grump' ? .4 : 0);
  for (const [nx, ny] of [[-80, -18], [-68, -22]]) { el(nx, ny, 3.5 * fl, 2.5 * fl, -.4); X.fillStyle = INK; X.fill(); }
  // blush + eye
  X.fillStyle = mood === 'grump' ? 'rgba(255,90,60,.55)' : 'rgba(255,130,150,.45)'; el(-14, -6, 11, 6); X.fill();
  const ex = -18, ey = -30, lk = o.look || [-1, 0];
  if (mood === 'laugh') { X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 10, ey + 3); X.quadraticCurveTo(ex, ey - 9, ex + 10, ey + 3); X.stroke(); }
  else {
    el(ex, ey, 12, 14); ink('#fff', 3);
    const sq = mood === 'inhale' ? inh * .55 : mood === 'grump' ? .45 : 0, px = ex + lk[0] * 4, py = ey + lk[1] * 4 + 1;
    X.fillStyle = mood === 'roast' || inh > .6 ? '#ff6a1a' : INK; el(px, py, 5.5, 7.5); X.fill(); X.fillStyle = INK; el(px, py, 2.4, 6); X.fill(); X.fillStyle = '#fff'; el(px - 2, py - 3, 2, 2); X.fill();
    if (sq > 0) { X.save(); el(ex, ey, 11, 13); X.clip(); X.fillStyle = DRG; X.fillRect(ex - 14, ey - 16, 28, 28 * sq); X.restore(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(ex - 12, ey - 14 + 28 * sq); X.lineTo(ex + 12, ey - 14 + 28 * sq); X.stroke(); }
    if (mood === 'sad') { X.fillStyle = '#9fe3ff'; const dy = (t * 50) % 30; el(ex - 6, ey + 14 + dy, 3.5, 5); ink('#9fe3ff', 2); }
  }
  X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.beginPath();         // the brow sells the mood
  if (mood === 'grump' || mood === 'inhale' || mood === 'roast') { X.moveTo(ex - 14, ey - 22); X.lineTo(ex + 10, ey - 13); }
  else if (mood === 'sad') { X.moveTo(ex - 12, ey - 13); X.lineTo(ex + 10, ey - 21); }
  else { X.moveTo(ex - 12, ey - 19); X.quadraticCurveTo(ex, ey - 24, ex + 12, ey - 19); }
  X.stroke();
  if (open < .1 && mood !== 'laugh') {                     // a smug little grin line
    X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); if (mood === 'sad' || mood === 'grump') { X.moveTo(-50, 10); X.quadraticCurveTo(-36, 4, -22, 10); } else { X.moveTo(-58, 8); X.quadraticCurveTo(-40, 15, -20, 6); } X.stroke();
  }
  X.restore();
  X.restore();
}

/* a fireball at (x, y) flying along angle a; s: scale */
function fireball(x, y, a, s, t) {
  X.save(); X.translate(x, y); X.rotate(a); X.scale(s, s);
  const f = 1 + Math.sin(t * 40) * .08;
  X.beginPath(); X.moveTo(18, 0); X.bezierCurveTo(18, -22, -6, -24, -30 * f, -14); X.quadraticCurveTo(-18, -6, -46 * f, 0); X.quadraticCurveTo(-18, 6, -30 * f, 14); X.bezierCurveTo(-6, 24, 18, 22, 18, 0); X.closePath(); ink('#ff6a1a', 3.5);
  X.beginPath(); X.moveTo(13, 0); X.bezierCurveTo(13, -14, -4, -16, -20 * f, -8); X.quadraticCurveTo(-10, -2, -28 * f, 0); X.quadraticCurveTo(-10, 2, -20 * f, 8); X.bezierCurveTo(-4, 16, 13, 14, 13, 0); X.closePath(); X.fillStyle = '#ffb13b'; X.fill();
  X.beginPath(); X.arc(4, 0, 8, 0, TAU); X.fillStyle = '#fff3a0'; X.fill();
  X.restore();
}
function flameStream(k, sweep, t) {                       // the losing gag: a long gout of fire from the mouth onto the road at x = sweep
  const [mx, my] = MOUTH, ex = sweep, ey = CHY - 6, n = 18;
  X.save(); X.globalAlpha = clamp(k, 0, 1);
  for (const [col, w] of [['#14101c', 34], ['#ff5a1a', 28], ['#ffb13b', 18], ['#fff3a0', 7]]) {
    X.beginPath();
    for (let i = 0; i <= n; i++) { const u = i / n, x = lerp(mx, ex, u), y = lerp(my, ey, u) - Math.sin(u * Math.PI) * 30 + Math.sin(t * 40 + u * 12) * 4 * u; X.lineTo(x, y); }
    X.strokeStyle = col; X.lineWidth = w * (col === '#14101c' ? 1 : 1) + Math.sin(t * 50) * 2; X.lineCap = 'round'; X.lineJoin = 'round'; X.stroke();
  }
  X.restore();
}
/* the "!" bubble over the dragon while it inhales */
function alarm(x, y, k, t) {
  if (k <= 0) return; const sc = outBack(Math.min(1, k * 4)), sh = k > .7 ? Math.sin(t * 50) * 3 * (k - .7) / .3 : 0;
  X.save(); X.translate(x + sh, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-26, -24); X.quadraticCurveTo(-30, -48, 0, -48); X.quadraticCurveTo(30, -48, 26, -24); X.quadraticCurveTo(24, -6, 8, -6); X.lineTo(18, 10); X.lineTo(-2, -6); X.quadraticCurveTo(-24, -6, -26, -24); X.closePath();
  ink(k > .7 ? '#ff4d4d' : '#ffe14d', 4);
  rr(-4.5, -42, 9, 22, 4); X.fillStyle = INK; X.fill(); X.beginPath(); X.arc(0, -14, 4.5, 0, TAU); X.fill();
  X.restore();
}

/* ───────────── Caoses ───────────── */
function soot(x, y, u, k) {                               // toasted: a black face mask + smoke tufts on top
  if (k <= 0) return; X.globalAlpha = k; X.fillStyle = '#2a2228'; X.fillRect(x - 6 * u, y - 9 * u, 12 * u, 7 * u); X.fillStyle = '#fff'; X.fillRect(x - 3.4 * u, y - 7 * u, 1.3 * u, 1.3 * u); X.fillRect(x + 2.2 * u, y - 7 * u, 1.3 * u, 1.3 * u);
  X.globalAlpha = 1;
}

function keeperArms(ku, kHop, gp, kx, ky, kcol, won, T) {    // both hands on the knob while the gate is up; let go: arms drop (or cheer)
  const sy = TTOP - 5.2 * ku - kHop - gp * 3, k = ease(clamp(gp * 1.6, 0, 1));
  for (const s of [-1, 1]) {
    const sx = KX + s * 6.6 * ku, rest = won ? [sx + s * 12, sy - 40 - Math.sin(T * 14 + s) * 6] : [sx + s * 8, sy + 12];
    if (k > .02) arm(sx, sy, lerp(rest[0], kx + s * 7, k), lerp(rest[1], ky + 4, k), ku, kcol); else arm(sx, sy, rest[0], rest[1], ku, kcol);
  }
}

/* ───────────── the static scene, painted once into offscreen canvases ───────────── */
let SKY = null, BG = null, FG = null;
function stones(x0, y0, x1, y1, bh, bw, seed) {           // a stone-block pattern inside the current clip
  X.fillStyle = STONE; X.fillRect(x0, y0, x1 - x0, y1 - y0);
  let r = seed; const rnd = () => (r = r * 16807 % 2147483647) / 2147483647;
  for (let y = y0, row = 0; y < y1; y += bh, row++) {
    X.fillStyle = MORTAR; X.fillRect(x0, y, x1 - x0, 2.5);
    for (let x = x0 - (row % 2) * bw / 2; x < x1; x += bw) {
      X.fillStyle = MORTAR; X.fillRect(x, y, 2.5, bh);
      const v = rnd(); if (v < .22) { X.fillStyle = 'rgba(255,255,255,.18)'; X.fillRect(x + 4, y + 4, bw - 9, 4); } else if (v > .82) { X.fillStyle = 'rgba(80,70,120,.14)'; X.fillRect(x + 3, y + 3, bw - 6, bh - 5); }
    }
  }
}
function buildBg() {
  const sk = document.createElement('canvas'); sk.width = W; sk.height = H; const old = X; X = sk.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, '#6f7fe6'); g.addColorStop(.5, '#b8a2e6'); g.addColorStop(1, '#ffd6a6'); X.fillStyle = g; X.fillRect(0, 0, W, H);
  // big low sun behind the hills
  X.fillStyle = 'rgba(255,240,190,.5)'; X.beginPath(); X.arc(560, 300, 92, 0, TAU); X.fill(); X.beginPath(); X.arc(560, 300, 66, 0, TAU); X.fillStyle = '#fff1bd'; X.fill();
  // far mountains + hills
  X.fillStyle = '#9d8fd0'; X.beginPath(); X.moveTo(0, 330); for (const [x, y] of [[60, 270], [130, 300], [230, 236], [330, 296], [420, 250], [520, 304], [610, 246], [700, 292], [800, 252]]) X.lineTo(x, y); X.lineTo(800, 380); X.lineTo(0, 380); X.closePath(); X.fill();
  X.fillStyle = '#b6a8e2'; for (const [x, y] of [[230, 236], [420, 250], [610, 246]]) { X.beginPath(); X.moveTo(x, y); X.lineTo(x + 20, y + 16); X.lineTo(x + 7, y + 13); X.lineTo(x - 2, y + 22); X.lineTo(x - 14, y + 12); X.closePath(); X.fill(); }
  X.fillStyle = '#8fc98a'; X.beginPath(); X.moveTo(0, 360); for (let x = 0; x <= W; x += 20) X.lineTo(x, 334 - Math.sin(x * .012 + 2) * 14 - Math.sin(x * .03) * 5); X.lineTo(W, 420); X.lineTo(0, 420); X.closePath(); X.fill();
  X.strokeStyle = '#5f9a6a'; X.lineWidth = 3; X.stroke();
  SKY = sk;
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; X = cv2.getContext('2d');
  // the inner keep (courtyard background): crenellations, a window with a ledge, a banner with a sausage on it
  X.save(); rr(14, 176, 182, 260, 0); X.clip(); stones(14, 176, 196, 436, 24, 40, 11); X.restore();
  rr(14, 176, 182, 260, 0); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
  for (let i = 0; i < 5; i++) { rr(14 + i * 38, 156, 28, 24, 2); ink(STONE, 3); X.fillStyle = STONEL; X.fillRect(17 + i * 38, 159, 22, 4); }
  X.fillStyle = 'rgba(60,50,100,.22)'; X.fillRect(14, 176, 182, 10);
  rr(84, 206, 44, 58, 22); ink('#2b2244', 4); X.fillStyle = '#ffd36b'; rr(90, 214, 32, 46, 16); X.fill(); X.fillStyle = '#ffbf3a'; X.fillRect(104, 214, 4, 46); X.fillRect(90, 236, 32, 4);
  rr(76, 262, 60, 10, 4); ink(STONEL, 3);
  X.beginPath(); X.moveTo(26, 190); X.lineTo(66, 190); X.lineTo(66, 290); X.lineTo(46, 274); X.lineTo(26, 290); X.closePath(); ink('#e8434f', 3.5);
  X.fillStyle = '#ffe14d'; X.fillRect(26, 196, 40, 4);
  X.save(); X.translate(46, 236); X.rotate(-.7); rr(-18, -7, 36, 14, 7); ink(SAUS, 2.5); X.restore();
  // inner curtain wall between the keep and the gatehouse, a torch
  X.save(); rr(196, 286, 124, 150, 0); X.clip(); stones(196, 286, 320, 436, 22, 36, 5); X.fillStyle = 'rgba(60,50,100,.2)'; X.fillRect(196, 286, 124, 150); X.restore();
  X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(196, 286); X.lineTo(320, 286); X.stroke();
  for (let i = 0; i < 3; i++) { rr(204 + i * 40, 270, 26, 18, 2); ink(STONE2, 3); }
  // courtyard floor (cobbles)
  g = X.createLinearGradient(0, GY, 0, 600); g.addColorStop(0, '#b5aac8'); g.addColorStop(1, '#8e84a8'); X.fillStyle = g; X.fillRect(0, GY, TX1, 180);
  X.fillStyle = 'rgba(255,255,255,.25)'; for (let y = GY + 12, r = 0; y < 600; y += 20, r++) for (let x = (r % 2) * 18; x < TX1; x += 36) { el(x, y, 13, 6); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, GY); X.lineTo(TX1, GY); X.stroke();
  // the gatehouse: stones, a dark tunnel through the arch, a ring of arch stones, merlons on the walkway, a little flag
  const face = new Path2D(`M${TX0} ${TTOP} L${TX1} ${TTOP} L${TX1} ${GY} L${AX1} ${GY} L${AX1} ${ASP} A${AR} ${AR} 0 0 0 ${AX0} ${ASP} L${AX0} ${GY} L${TX0} ${GY} Z`);
  X.save(); X.clip(face); stones(TX0, TTOP, TX1, GY, 24, 42, 3); X.fillStyle = 'rgba(60,50,100,.12)'; X.fillRect(TX1 - 18, TTOP, 18, GY - TTOP); X.restore();
  X.lineWidth = 7; X.strokeStyle = INK; X.lineJoin = 'round'; X.stroke(face);
  g = X.createLinearGradient(0, ASP - AR, 0, GY); g.addColorStop(0, '#1d1630'); g.addColorStop(1, '#3d3158'); X.fillStyle = g; X.fill(P(ARCHP));
  X.fillStyle = 'rgba(255,214,140,.16)'; X.fillRect(AX0, GY - 26, AX1 - AX0, 26);
  for (let i = 0; i <= 8; i++) {                          // voussoirs
    const a0 = Math.PI + i * Math.PI / 9, a1 = a0 + Math.PI / 9;
    X.beginPath(); X.arc(ACX, ASP, AR + 16, a0, a1); X.arc(ACX, ASP, AR + 1, a1, a0, true); X.closePath(); ink(i === 4 ? '#e6e1f5' : STONEL, 2.5);
  }
  for (const jx of [AX0 - 16, AX1]) for (let y = ASP; y < GY; y += 30) { rr(jx, y + 2, 16, 26, 2); ink(STONEL, 2.5); }
  X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; X.beginPath(); X.moveTo(AX0 + 2, ASP - 12); X.lineTo(AX0 + 2, GY); X.moveTo(AX1 - 2, ASP - 12); X.lineTo(AX1 - 2, GY); X.stroke();
  rr(TX0 - 8, TTOP - 8, TX1 - TX0 + 16, 18, 4); ink(STONEL, 4);
  for (let i = 0; i < 4; i++) { const mx = TX0 - 8 + i * 44; if (i === 2) continue; rr(mx, TTOP - 36, 30, 30, 3); ink(STONE, 3.5); X.fillStyle = STONEL; X.fillRect(mx + 3, TTOP - 33, 24, 5); }
  X.lineWidth = 4; X.strokeStyle = INK; X.beginPath(); X.moveTo(TX0 + 6, TTOP - 36); X.lineTo(TX0 + 6, TTOP - 96); X.stroke();
  X.beginPath(); X.moveTo(TX0 + 8, TTOP - 96); X.lineTo(TX0 + 46, TTOP - 86); X.lineTo(TX0 + 8, TTOP - 74); X.closePath(); ink('#ff5d8f', 3);
  X = old; return cv2;
}
function buildFg() {                                     // in front of the dragon: its hill, the road outside, the grass
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  const hill = new Path2D('M520 430 C548 366 610 318 690 312 C750 308 790 318 830 328 L830 430 Z');
  X.lineWidth = 8; X.strokeStyle = INK; X.stroke(hill); let g = X.createLinearGradient(0, 312, 0, 430); g.addColorStop(0, '#79c86a'); g.addColorStop(1, '#4f9f50'); X.fillStyle = g; X.fill(hill);
  X.save(); X.clip(hill); X.fillStyle = 'rgba(255,255,255,.18)'; el(640, 330, 70, 10, -.12); X.fill(); X.restore();
  for (const [x, y, r] of [[600, 352, 16], [622, 360, 11], [770, 336, 14]]) { el(x, y, r * 1.4, r); ink('#c9c3d6', 3); X.fillStyle = '#e4e0ee'; el(x - r * .4, y - r * .35, r * .5, r * .3); X.fill(); }
  // a bone pile: this dragon has done this before
  X.save(); X.translate(728, 352); X.rotate(-.3); rr(-14, -3, 28, 6, 3); ink('#fff4dc', 2.5); for (const s of [-1, 1]) { X.beginPath(); X.arc(s * 14, -3, 4, 0, TAU); X.arc(s * 14, 3, 4, 0, TAU); ink('#fff4dc', 2); } X.restore();
  // outside ground + road
  g = X.createLinearGradient(0, GY - 20, 0, 600); g.addColorStop(0, '#86d35c'); g.addColorStop(1, '#5cae46'); X.fillStyle = g; X.fillRect(TX1, GY - 30, W - TX1, 210);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(TX1, GY - 30); X.lineTo(W, GY - 30); X.stroke();
  X.beginPath(); X.moveTo(TX1, GY - 30); X.lineTo(W, GY - 30); X.lineTo(W, GY + 14); X.lineTo(TX1, GY + 6); X.closePath(); ink('#e8c48a', 0);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(TX1, GY + 6); X.lineTo(W, GY + 14); X.stroke();
  X.fillStyle = '#d4a96a'; for (const [x, y] of [[500, 400], [560, 412], [640, 398], [720, 410], [780, 402]]) { el(x, y, 6, 2.5); X.fill(); }
  // tufts and flowers
  const tuft = (x, y) => { X.strokeStyle = '#3f8f35'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 6, y); X.lineTo(x - 9, y - 10); X.moveTo(x, y); X.lineTo(x, y - 13); X.moveTo(x + 6, y); X.lineTo(x + 9, y - 10); X.stroke(); };
  for (const [x, y] of [[490, 446], [690, 452], [760, 470], [640, 560], [740, 590]]) tuft(x, y);
  for (const [x, y, c] of [[620, 448, '#fff'], [780, 446, '#ffe14d'], [700, 520, '#ff9ac2']]) { for (let i = 0; i < 5; i++) { const a = i * TAU / 5; X.beginPath(); X.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, TAU); X.fillStyle = c; X.fill(); } X.beginPath(); X.arc(x, y, 3, 0, TAU); X.fillStyle = '#ffb13b'; X.fill(); }
  X = old; return cv2;
}
function sky(t) {
  const cloud = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]]; for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#f3e6ff'; X.fill(); } for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore(); };
  cloud(((t * 8 + 420) % 1000) - 140, 200, .8); cloud(((t * 5 + 60) % 1000) - 140, 150, .6);
}
/* the cat on the keep's window ledge: its eyes follow the first sausage outside the castle, it licks its lips */
function cat(t, tx, happy) {
  const x = 106, y = 262;
  X.save(); X.translate(x, y);
  X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(14, -6); X.quadraticCurveTo(34 + Math.sin(t * 3) * 6, 0, 30, 24); X.stroke(); X.strokeStyle = '#ffa94d'; X.lineWidth = 4; X.stroke();
  el(0, -14, 18, 15); ink('#ffa94d', 3.5);
  X.beginPath(); X.arc(-2, -36, 14, 0, TAU); ink('#ffa94d', 3.5);
  for (const s of [-1, 1]) { X.beginPath(); X.moveTo(-2 + s * 6, -46); X.lineTo(-2 + s * 14, -58); X.lineTo(-2 + s * 15, -42); X.closePath(); ink('#ffa94d', 3); }
  X.fillStyle = '#e57f22'; X.fillRect(-12, -24, 6, 3); X.fillRect(4, -24, 6, 3);
  const lx = clamp((tx - x) / 300, -1, 1) * 2.5;
  if (happy) { X.strokeStyle = INK; X.lineWidth = 2.5; for (const s of [-1, 1]) { X.beginPath(); X.moveTo(-2 + s * 6 - 3, -37); X.quadraticCurveTo(-2 + s * 6, -42, -2 + s * 6 + 3, -37); X.stroke(); } }
  else for (const s of [-1, 1]) { X.fillStyle = '#fff'; el(-2 + s * 6, -38, 3.6, 4.2); X.fill(); X.fillStyle = INK; el(-2 + s * 6 + lx, -37.5, 1.8, 3.2); X.fill(); }
  X.fillStyle = '#ff7a95'; el(-2, -31, 2.4, 1.6); X.fill();
  if (Math.sin(t * 1.7) > .8 || happy) { X.fillStyle = '#ff7a95'; el(1, -27, 2.5, 3); X.fill(); }
  X.restore();
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave the lever held or a drag stuck */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duGate(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), keeper = D.role === 0, TS = Math.sqrt(sp);
  const NEED = sp < 1.3 ? 10 : 8.5;                        // winch turns to reel all 6 sausages in
  const INH = Math.max(.85, 1.05 / TS), FLY = .5 / TS;     // the inhale (the warning) + the flight
  const UPS = 1 / .2, DOWNS = 1 / .09;                     // gate speed: rises in .2 s, slams in .09 s
  const CLOSE_GRACE = .2, PEND = .45, RATE = 2.2, SETBACK = .38, STUN = 1.1, JUDGE_LATE = .04, WAIT_MAX = 1;
  const KEY_TURN = 1 / 4.5;
  /* the fireball schedule: same draws whatever the role */
  const fbs = []; let tt = 1.2 / TS + R() * .4;
  for (let i = 0; i < 8; i++) { fbs.push({ i, t0: tt, hit: tt + INH + FLY, res: null, at: -1, rAt: -1, contact: -1, gone: -1, fx: false }); tt += INH + FLY + (1.0 + R() * .9) / TS; }

  // the gatekeeper's lever
  let pN = 0, fN = FOCUSN, seeded = false, lastG = -1, lastGSend = -9; const kHeld = new Set();
  // shared view state
  let gT = 0, gAt = -9, gp = 0, heat = 0, slamAt = -9, prog = 0, dp = 0, ang = 0, lastLinks = 0, linkPop = -9, turnAt = -9, stunAt = -9, toastAt = -9;
  // cranker input
  let dragging = false, lastPt = null, lastH = null, dir = 0, budget = .5, pend = [], lastW = -9, sentP = -1, sentA = 1e9, clickAcc = 0;
  const pT = track(), aT = track();
  const pops = [], bits = [];
  let resAt = -1, won = false, slammed = false, roastFx = false;
  const HKEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS']);
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const holding = () => pN > 0 || kHeld.size > 0;

  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, vx: 0, vy: 0, r: 4, sh: 0 }, o)); }
  function embers(x, y, n, sp2) { for (let i = 0; i < n; i++) bit({ sh: 0, x, y, vx: (cr() - .5) * sp2 * 2, vy: -(80 + cr() * sp2), r: 3 + cr() * 4, c: cr() < .5 ? '#ffb13b' : '#ff6a1a', life: .45 + cr() * .3 }); }
  function smoke(x, y, n) { for (let i = 0; i < n; i++) bit({ sh: 1, x: x + (cr() - .5) * 30, y: y + (cr() - .5) * 20, vx: (cr() - .5) * 40, vy: -(30 + cr() * 50), gr: -20, r: 8 + cr() * 8, life: .7 + cr() * .4 }); }
  function done() { return !!g.result; }

  /* a fireball's outcome is known: the visible part (CLANG / it flies in) */
  function fbFx(f) {
    f.fx = true;
    if (f.res === 0) {
      heat = 1; f.gone = g.c; sfx.thud(); snd(880, .06, 'square', .05, 0, 620); snd(1320, .12, 'triangle', .04, .02); noise(.25, .05, 3000, 800, 'highpass', .03);
      embers(HIT[0], HIT[1], 12, 220); smoke(HIT[0] + 10, HIT[1] - 10, 3); ring(HIT[0], HIT[1], '#ffb13b', 60, .3); shake(3, .1);
      pop('CLANG!', 556, 196, 34, '#6c6a8a', '#fff');
    } else f.contact = g.c + .22;
  }
  /* the fireball reaches the cranker (both screens; only the cranker changes the progress) */
  function toast(f) {
    f.gone = g.c; toastAt = g.c; sfx.splat(); sfx.boing(); snd(520, .2, 'sawtooth', .05, 0, 120); shake(7, .25);
    embers(TOAST[0], TOAST[1] - 20, 16, 260); smoke(TOAST[0], TOAST[1] - 40, 5); ring(TOAST[0], TOAST[1] - 20, '#ff6a1a', 80, .35);
    pop('OUCH!', 212, 232, 36, '#e8434f', '#fff');
    if (!keeper && !done()) { stunAt = g.c; prog = Math.max(0, prog - SETBACK); pend = []; }
  }
  function add(f) {                                       // the cranker: f turns actually reel the string
    if (f <= 0) return; prog = Math.min(1, prog + f / NEED); turnAt = g.c;
  }
  function gateMsg(v) {                                   // the cranker hears the lever
    if (v === gT) return; gT = v; gAt = g.c;
    if (v === 1) { let due = 0; for (const q of pend) if (g.c - q.t < PEND) due += q.f; pend = []; add(due); }
  }

  const g = {
    c: 0, dur: 14, pts: 0,
    cmd: keeper ? 'HOLD!' : 'CRANK!', roleLabel: keeper ? 'GATEKEEPER' : 'CRANKER',
    hint: keeper ? 'HOLD CLICK / SPACE TO RAISE THE GATE - LET GO WHEN THE DRAGON SPITS!' : 'DRAG IN CIRCLES (OR MASH SPACE) TO REEL THE SAUSAGES IN - ONLY WHILE THE GATE IS UP',
    thint: keeper ? 'HOLD TO RAISE THE GATE - LET GO WHEN THE DRAGON SPITS!' : 'DRAG IN CIRCLES TO REEL THE SAUSAGES IN - ONLY WHILE THE GATE IS UP',
    update(dt) {
      g.c += dt; budget = Math.min(.5, budget + RATE * dt); heat = Math.max(0, heat - dt * 1.4);
      if (g.result && resAt < 0) {
        resAt = g.c; won = g.result === 'win';
        for (const f of fbs) if (f.gone < 0 && g.c >= f.t0 + INH) { const [x, y] = fbPos(clamp((g.c - f.t0 - INH) / FLY, 0, 1)); f.gone = g.c; f.fade = true; embers(x, y, 6, 120); }
      }
      const rk = resAt >= 0 ? g.c - resAt : -1;
      if (won && !slammed && rk >= .04) { slammed = true; slamAt = g.c; sfx.thud(); snd(660, .08, 'square', .05, 0, 330); noise(.2, .06, 2400, 600, 'bandpass'); shake(4, .12); for (let i = 0; i < 6; i++) bit({ sh: 2, x: ACX + (cr() - .5) * 80, y: GY - 6, vx: (cr() - .5) * 200, vy: -(60 + cr() * 120), r: 5 + cr() * 4, life: .5 }); }
      if (won && rk > .25 && rk < .3 + dt) { for (let i = 0; i < 10; i++) bit({ sh: 3, x: WX + (cr() - .5) * 40, y: WY - 20, vx: (cr() - .5) * 360, vy: -(260 + cr() * 260), r: 0, rot: cr() * 6, vr: (cr() - .5) * 14, life: 1.1, gr: 900 }); snd(988, .08, 'square', .05); snd(1319, .2, 'square', .05, .08); snd(1760, .25, 'triangle', .04, .16); pop('FEAST!', 580, 170, 40, '#ff9f1c', '#FFE14D'); }
      if (g.result === 'lose' && !roastFx && rk > .12) { roastFx = true; noise(.9, .1, 300, 2400, 'bandpass'); snd(90, .8, 'sawtooth', .07, 0, 60); pop('ROASTED!', 580, 170, 38, '#c2361f', '#ffe14d'); }
      if (g.result === 'lose' && rk > .15 && rk < .95 && cr() < dt * 30) { const sw = sweepX(rk); smoke(sw + (cr() - .5) * 40, CHY - 20, 1); embers(sw, CHY - 10, 2, 120); }
      // fireballs: the gatekeeper judges them, both screens play them
      for (const f of fbs) {
        if (f.gone >= 0 && f.contact < 0) continue;
        if (!done() && g.c >= f.t0 + INH && g.c - dt < f.t0 + INH) { sfx.whoosh(false); snd(140, .25, 'sawtooth', .06, 0, 70); for (let i = 0; i < 6; i++) bit({ sh: 0, x: MOUTH[0], y: MOUTH[1], vx: -(60 + cr() * 140), vy: (cr() - .5) * 120, gr: 200, r: 3 + cr() * 3, c: '#ffb13b', life: .35 }); }
        if (!done() && g.c >= f.t0 && g.c - dt < f.t0) noise(INH, .05, 200, 1600, 'bandpass', 0, 2);   // the long inhale
        if (keeper && f.res === null && !done() && g.c >= f.hit + JUDGE_LATE) {
          f.res = (gT === 0 || gp < .35) ? 0 : 1; f.rAt = g.c; D.send('fb', { i: f.i, r: f.res });
        }
        if (!keeper && f.res === null && g.c > f.hit + WAIT_MAX) { f.res = 0; f.rAt = g.c; f.quiet = true; }   // no verdict (partner gone): it fizzles
        if (f.res !== null && !f.fx && g.c >= f.hit && !done()) { if (f.quiet) { f.fx = true; f.gone = g.c; embers(HIT[0], HIT[1], 5, 80); } else fbFx(f); }
        if (f.contact >= 0 && f.gone < 0 && g.c >= f.contact) toast(f);
      }
      if (keeper) {
        if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; pN = 0; kHeld.clear(); seeded = false; }
        // a press that started during the intro never reached down(): main.js keeps 'pressing', so a finger held through GO raises the gate
        const pr = typeof pressing !== 'undefined' ? pressing : null;
        if (g.c < .3 && pr && pN === 0) { pN = 1; seeded = true; } else if (seeded && pr === false) { pN = Math.max(0, pN - 1); seeded = false; }
        const v = !done() && holding() ? 1 : 0;
        if (v !== lastG || (g.c - lastGSend > 1 && !done())) {
          if (v !== lastG) { if (v) { snd(220, .12, 'square', .04, 0, 330); noise(.12, .04, 2000, 4000, 'highpass'); } else if (gp > .2) { sfx.thud(); snd(700, .05, 'square', .04, 0, 400); } }
          lastG = v; lastGSend = g.c; D.send('g', v, true);
        }
        gT = won ? 0 : v;
        const p = pT.at(), a = aT.at(); if (a !== null) ang = a;
        prog = won ? Math.max(p === null ? prog : p, Math.min(1, prog + dt * 3)) : p === null ? prog : p;   // on a win the last link zips in at once
      } else {
        if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; dragging = false; lastPt = null; lastH = null; }
        for (let i = pend.length - 1; i >= 0; i--) if (g.c - pend[i].t >= PEND) pend.splice(i, 1);
        if (won) gT = 0;
        if (!done()) {
          if (prog >= 1) g.finish('win'); else if (g.c >= g.limit) g.finish('lose');
        }
        if (g.c - lastW > .1 && (Math.abs(prog - sentP) > .0005 || Math.abs(ang - sentA) > .04)) { lastW = g.c; sentP = prog; sentA = ang; D.send('w', { p: Math.round(prog * 1000) / 1000, a: Math.round(ang * 100) / 100 }, true); }
      }
      // the gate (on the gatekeeper it follows the lever this very frame; on the cranker it follows the last word it heard)
      const tgt = gT; gp = tgt > gp ? Math.min(tgt, gp + UPS * dt) : Math.max(tgt, gp - DOWNS * dt);
      dp = won ? Math.min(1, Math.max(dp, prog) + dt * 2) : dp + (prog - dp) * Math.min(1, dt * (prog < dp ? 7 : 14));
      const li = linksIn(dp);
      if (li > lastLinks) { linkPop = g.c; snd(700 + li * 70, .07, 'sine', .07, 0, 1300 + li * 90); snd(1500, .05, 'triangle', .03, .05); ring(AX0 - 10, CHY, '#fff', 40, .25); }
      lastLinks = li;
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.vr) b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.length = 0;
    },
    msg(type, d) {
      if (type === 'g' && !keeper) gateMsg(d ? 1 : 0);
      else if (type === 'fb' && !keeper) { const f = fbs[d.i]; if (f && f.res === null) { f.res = d.r ? 1 : 0; f.rAt = g.c; } }
      else if (type === 'w' && keeper && d) { pT.push(d.p); aT.push(d.a); }
    },
    turn(f) {                                              // the cranker: f = a fraction of a turn of the handle
      if (keeper || done() || g.c < .05) return;
      if (g.c - stunAt < STUN) return;                    // toasted: the hands slip off the handle
      f = Math.min(f, budget); if (f <= 0) return; budget -= f;
      ang += f * TAU;
      const open = gT === 1 || g.c - gAt < CLOSE_GRACE;
      if (open) add(f); else { pend.push({ t: g.c, f }); let s = 0; for (const q of pend) s += q.f; while (s > .5 && pend.length) s -= pend.shift().f; }
      clickAcc += f; if (clickAcc > 1 / 8) { clickAcc = 0; if (open) snd(560 + dp * 500, .03, 'square', .03); else snd(300, .03, 'square', .025); }
    },
    hold(on) { if (!keeper) return; pN = on ? pN + 1 : Math.max(0, pN - 1); if (!on) seeded = false; },
    drag(p) {                                              // circles anywhere: the heading of the stroke turning = the handle turning
      if (!lastPt) { lastPt = p; return; }
      const dx = p.x - lastPt.x, dy = p.y - lastPt.y; if (dx * dx + dy * dy < 49) return;
      const h = Math.atan2(dy, dx); lastPt = { x: p.x, y: p.y };
      if (lastH !== null) {
        let dh = h - lastH; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU;
        if (Math.abs(dh) < 1.4) { dir = dir * .85 + dh; if (Math.sign(dh) === Math.sign(dir) || Math.abs(dir) < .2) g.turn(Math.abs(dh) / TAU); }
      }
      lastH = h;
    },
    draw() {
      const T = g.c, rk = resAt >= 0 ? T - resAt : -1, lost = g.result === 'lose';
      if (!BG) { BG = buildBg(); FG = buildFg(); } X = ctx;
      X.drawImage(SKY, 0, 0); sky(T); X.drawImage(BG, 0, 0);
      // the dragon behind its hill
      const dm = dragonState(T), dy = Math.sin(T * 1.8) * 3 + (dm.mood === 'laugh' ? -Math.abs(Math.sin(T * 14)) * 6 : 0) + (dm.mood === 'sad' ? 6 : 0);
      dragon(DGX, DGY + dy, DS, { t: T, inh: dm.inh, open: dm.open, mood: dm.mood, look: dm.look });
      if (dm.mood === 'grump' || dm.mood === 'sad') for (let i = 0; i < 2; i++) { const k = (T * 1.2 + i * .5) % 1; puff(DGX - 82 + i * 10 - k * 20, DGY - 24 - k * 40, 5 + k * 7, (1 - k) * .8); }
      X.drawImage(FG, 0, 0);
      cat(T, stringHeadX(), won && rk > .3);
      // the warning: "!" + a dotted aim line from the mouth to the gate while it inhales
      const thr = threat(T);
      if (thr && !done()) {
        alarm(604, 196, thr.k, T);
        X.save(); X.setLineDash([4, 12]); X.lineDashOffset = -T * 60; X.lineCap = 'round'; X.strokeStyle = `rgba(255,${thr.k > .7 ? 70 : 200},60,${.35 + thr.k * .5})`; X.lineWidth = 5; X.beginPath();
        for (let i = 0; i <= 16; i++) { const [x, y] = fbPos(i / 16); X.lineTo(x, y); } X.stroke(); X.restore();
        const [hx, hy] = HIT; X.globalAlpha = .4 + .4 * Math.sin(T * 18); X.strokeStyle = '#ff5a3a'; X.lineWidth = 4; X.beginPath(); X.arc(hx, hy, 18 + thr.k * 6, 0, TAU); X.stroke(); X.globalAlpha = 1;
      }
      // the string of sausages, the winch, the gate
      const burn = lost && rk > .15 ? x => clamp((x - sweepX(rk)) / 60 + .3, 0, 1) * (x > TX1 - 10 ? 1 : 0) : null;
      const moving = !done() && T - turnAt < .15 && gT === 1, pinned = gp < .25;
      drawString(dp, T, burn, moving, pinned && !done());
      const coil = clamp((dp * TRAVEL - U_HEAD0) / (TRAVEL - U_HEAD0 + 60), 0, 1);
      const stun = T - stunAt < STUN || T - toastAt < STUN, soo = T - toastAt < 1.4 ? 1 - ease((T - toastAt - .8) / .6) : 0;
      // the cranker on the courtyard floor, one stretchy arm on the handle
      const ccol = keeper ? pCol() : myCol(), cu = 5.4, hop = won && rk > .1 ? Math.abs(Math.sin(T * 9)) * 16 : 0, sag = lost && rk > .2 ? ease((rk - .2) / .3) : 0;
      const effort = !done() && T - turnAt < .2 ? Math.sin(T * 30) * 1.5 : 0;
      X.save(); X.translate(CKX, GY - hop); X.rotate(stun ? Math.sin(T * 25) * .05 : -sag * .1);
      shadow(0, hop + 2, 34, 6, .25);
      caos(0, 0, cu, { col: soo > .5 ? mix(ccol, '#2a2228', .7) : ccol, mood: won ? 'happy' : stun || lost ? 'sad' : null });
      soot(0, 0, cu, soo * .9);
      X.restore();
      const hpos = winch(ang, coil, won ? .5 + .5 * Math.sin(T * 12) : T - linkPop < .3 ? 1 - (T - linkPop) / .3 : 0);
      if (!won && !stun) arm(CKX + 6.6 * cu, GY - 5.2 * cu - hop + effort, hpos[0], hpos[1], cu, ccol);
      else if (won) arm(CKX + 6.6 * cu, GY - 5.2 * cu - hop, CKX + 6.6 * cu + 18, GY - 5.2 * cu - hop - 40 - Math.sin(T * 14) * 6, cu, ccol);
      if (soo > 0) for (let i = 0; i < 3; i++) { const k = (T * 1.4 + i / 3) % 1; puff(CKX - 14 + i * 14, GY - 60 - k * 46, 5 + k * 6, soo * (1 - k) * .8, '#6a6470'); }
      if (stun) for (let i = 0; i < 3; i++) { const a = T * 7 + i * TAU / 3; star(CKX + Math.cos(a) * 34, GY - 70 + Math.sin(a) * 8, 8, 4, 5, a, '#FFE14D', 2.5); }
      if (!keeper && !done() && T - turnAt > .9 && T > 1) { X.globalAlpha = .55 + .45 * Math.sin(T * 6); circArrows(WX, WY, 84, T); X.globalAlpha = 1; }
      const slamK = T - slamAt < .3 ? 1 - (T - slamAt) / .3 : 0;
      portcullis(gp, heat, T, slamK);
      // fireballs
      for (const f of fbs) {
        if (T < f.t0 + INH) continue;
        if (f.gone >= 0 && !(f.fade && T - f.gone < .12)) continue;
        let x, y, a, s = 1;
        if (f.contact >= 0) { const k = clamp((T - (f.contact - .22)) / .22, 0, 1); [x, y] = inPos(k); const [x2, y2] = inPos(Math.min(1, k + .05)); a = Math.atan2(y2 - y, x2 - x); s = 1.1; }
        else { const k = Math.min(1, (T - f.t0 - INH) / FLY); [x, y] = fbPos(k); const [x2, y2] = fbPos(Math.min(1, k + .03)); a = k >= 1 ? Math.PI * .95 : Math.atan2(y2 - y, x2 - x); s = .8 + .25 * k; if (k >= 1) { x += Math.sin(T * 50) * 2; y += Math.sin(T * 37) * 2; } }
        if (f.fade) s *= 1 - clamp((T - f.gone) / .12, 0, 1);
        fireball(x, y, a, s, T);
      }
      if (lost && rk > .1 && rk < 1.1) flameStream(rk < .25 ? (rk - .1) / .15 : rk > .95 ? (1.1 - rk) / .15 : 1, sweepX(rk), T);
      // the gatekeeper on the walkway, hanging on the lever
      const kcol = keeper ? myCol() : pCol(), ku = 5.2, la = lerp(LA_UP, LA_HELD, ease(gp)), [kx, ky] = leverAt(la);
      const kHop = won && rk > .1 ? Math.abs(Math.sin(T * 9 + 1)) * 14 : 0, warnLit = !!thr && !done() && gT === 1;
      X.save(); X.translate(KX, TTOP - kHop - gp * 3); X.scale(1 + gp * .04, 1 - gp * .06);
      caos(0, 0, ku, { col: kcol, mood: won ? 'happy' : lost ? 'sad' : null });
      X.restore();
      lever(la, warnLit, T);
      keeperArms(ku, kHop, gp, kx, ky, kcol, won, T);
      if (warnLit) { X.globalAlpha = .6 + .4 * Math.sin(T * 20); for (const s2 of [-1, 1]) { X.fillStyle = '#9fe3ff'; el(KX + s2 * 30, TTOP - 46 + ((T * 60) % 14), 3.5, 5); X.fill(); } X.globalAlpha = 1; }
      drawBits(T);
      scoreboard(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, q.x, q.y - Math.min(a, .6) * 8, q.size, q.bgc, q.fg, a < .25 ? outBack(a / .25) : 1, q.rot); X.globalAlpha = 1; }
      pill(KX + 44, 206, keeper ? 'YOU' : 'YOUR FRIEND', kcol, true);
      pill(CKX + 6, 446, keeper ? 'YOUR FRIEND' : 'YOU', ccol, true);
      controls(T, thr);
      vignette(.16);
    },
    down(p) { if (keeper) g.hold(true); else { dragging = true; lastPt = { x: p.x, y: p.y }; lastH = null; } },
    move(p) { if (!keeper && (dragging || !p.touch)) g.drag(p); },   // a mouse may circle without holding the button
    up() { if (keeper) g.hold(false); else { dragging = false; lastPt = null; lastH = null; } },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (keeper) { if (HKEYS.has(e.code)) kHeld.add(e.code); }
      else if (!e.repeat && (HKEYS.has(e.code) || e.code === 'KeyA' || e.code === 'KeyD')) g.turn(KEY_TURN);
    },
    keyup(e) { if (keeper) kHeld.delete(e.code); },
  };
  function sweepX(rk) { return lerp(W + 20, TX1 - 10, ease((rk - .15) / .7)); }
  function stringHeadX() { return pathAt(Math.max(0, U_HEAD0 - dp * TRAVEL) + LINK / 2)[0]; }
  /* the fireball that matters right now, as anyone can see it: inhaling (k 0..1 of the inhale) or in the air, not yet decided */
  function threat(T) {
    for (const f of fbs) { if (f.res !== null && f.fx) continue; if (f.gone >= 0) continue; if (T >= f.t0 && T < f.hit + .1) return { f, k: clamp((T - f.t0) / INH, 0, 1), left: f.hit - T }; }
    return null;
  }
  function dragonState(T) {
    if (g.result === 'lose') { const rk = T - resAt; return { mood: rk > 1 ? 'laugh' : 'roast', inh: 0, open: rk < 1 ? 1 : .6, look: [-1, 1] }; }
    if (won) return { mood: 'sad', inh: 0, open: 0, look: [-1, .5] };
    let mood = 'idle', inh = 0, open = 0;
    for (const f of fbs) {
      if (T >= f.t0 && T < f.t0 + INH) { mood = 'inhale'; inh = (T - f.t0) / INH; }
      else if (T >= f.t0 + INH && T < f.t0 + INH + .3) { mood = 'spit'; open = 1 - (T - f.t0 - INH) / .3; }
      if (f.fx && !f.quiet && T - f.hit < 1.1 && T >= f.hit) mood = f.res === 1 ? 'laugh' : 'grump';
      if (f.res === 1 && f.contact >= 0 && T - f.contact < .9) { mood = 'laugh'; open = .5; }
    }
    return { mood, inh, open, look: [-1, .5] };
  }
  function circArrows(x, y, r, T) {                       // "turn me": two curved arrows around the winch
    X.save(); X.translate(x, y); X.rotate(T * 2);
    for (let i = 0; i < 2; i++) {
      X.rotate(Math.PI); X.beginPath(); X.arc(0, 0, r, -.2, 1.5); X.lineCap = 'round'; X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5; X.strokeStyle = '#fff'; X.stroke();
      const ax = Math.cos(1.5) * r, ay = Math.sin(1.5) * r; X.save(); X.translate(ax, ay); X.rotate(1.5 + Math.PI / 2); X.beginPath(); X.moveTo(-2, -12); X.lineTo(12, 0); X.lineTo(-2, 12); X.closePath(); ink('#fff', 3); X.restore();
    }
    X.restore();
  }
  function drawBits(T) {
    for (const b of bits) {
      const a = T - b.t0, fade = a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1; X.globalAlpha = clamp(fade, 0, 1);
      if (b.sh === 0) { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink(b.c, 2); }
      else if (b.sh === 1) { X.globalAlpha *= .8; X.beginPath(); X.arc(b.x, b.y, b.r * (1 + a), 0, TAU); ink('#8a8496', 2); X.fillStyle = 'rgba(255,255,255,.3)'; el(b.x - b.r * .3, b.y - b.r * .4, b.r * .4, b.r * .25); X.fill(); }
      else if (b.sh === 2) { X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); ink('#cfc8e0', 2); }
      else if (b.sh === 3) { X.save(); X.translate(b.x, b.y); X.rotate(b.rot); X.scale(.42, .42); sausage(0, 0, 0, 0, 0); X.restore(); }
    }
    X.globalAlpha = 1;
  }
  function scoreboard(T) {                                // a wooden sign hanging from the top: 6 sausage slots
    const x0 = 492, y0 = 70, w = 284, h = 62, cx = x0 + w / 2, li = won ? NL : linksIn(dp), pop2 = T - linkPop < .25;
    X.save(); X.translate(cx, 40); X.rotate(Math.sin(T * 1.3) * .012); X.translate(-cx, -40);
    X.lineCap = 'round'; for (const rx of [x0 + 30, x0 + w - 30]) { X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.moveTo(rx, 40); X.lineTo(rx, y0 + 6); X.stroke(); X.strokeStyle = '#e6c58c'; X.lineWidth = 3.5; X.stroke(); }
    rr(x0, y0 + 5, w, h, 16); ink('#a5622c', 5);
    rr(x0, y0, w, h, 16); ink('#d9944f', 0); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
    X.save(); rr(x0, y0, w, h, 16); X.clip(); X.fillStyle = '#c98443'; X.fillRect(x0, y0 + h / 2 - 2, w, 3); X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x0, y0 + 4, w, 7); X.restore();
    for (let i = 0; i < NL; i++) {
      const px = x0 + 32 + i * 44, py = y0 + h / 2 + 1, full = i < li, nxt = i === li && !done();
      rr(px - 21, py - 13, 42, 26, 13); ink(full ? '#fff3cf' : nxt ? '#f1e3c8' : '#e3cfa8', 3);
      if (full) { const k = i === li - 1 && pop2 ? outBack((T - linkPop) / .25) : 1; X.save(); X.translate(px, py); X.scale(.62 * k, .62 * k); sausage(0, 0, 0, 0, 0); X.restore(); }
      else { X.strokeStyle = 'rgba(120,64,24,.35)'; X.lineWidth = 2; X.setLineDash([4, 4]); rr(px - 15, py - 7, 30, 14, 7); X.stroke(); X.setLineDash([]); }
    }
    if (pop2) { X.globalAlpha = .5; rr(x0, y0, w, h, 16); X.strokeStyle = '#fff'; X.lineWidth = 4; X.stroke(); X.globalAlpha = 1; }
    X.restore();
  }
  function controls(T, thr) {                            // my own plate at the bottom (after the verdict it goes flat and grey)
    const GR = '#d3cfe0', GRD = '#8f88a6', GT = '#f6f4fb';
    if (done()) {
      X.globalAlpha = .8; const o = plate(BTN, GR, GRD, true, false);
      if (keeper) leverIcon(BTN[0] + 52, BTN[1] + 50 + o, 0); else crankIcon(BTN[0] + 52, BTN[1] + 44 + o, T, false);
      txt(won ? 'FEAST!' : 'ROASTED!', BTN[0] + 228, BTN[1] + 44 + o, 32, GT, 'center', 270); X.globalAlpha = 1; return;
    }
    if (keeper) {
      const hd = holding(), danger = !!thr;
      const col = danger ? (hd ? '#ff4d5e' : '#ff9a4d') : hd ? '#5CFF7A' : '#ffd23f', dk = danger ? (hd ? '#b8283a' : '#c4621c') : hd ? '#23a046' : '#c99512';
      const o = plate(BTN, col, dk, hd, danger && hd);
      leverIcon(BTN[0] + 52, BTN[1] + 50 + o, gp);
      const label = danger ? (hd ? 'FIRE! LET GO!' : 'KEEP IT DOWN!') : hd ? 'GATE UP!' : 'HOLD TO RAISE';
      if (TOUCH) txt(label, BTN[0] + 228, BTN[1] + 44 + o, 32, '#fff', 'center', 270);
      else { txt(label, BTN[0] + 228, BTN[1] + 34 + o, 28, '#fff', 'center', 270); keyCap(BTN[0] + 228, BTN[1] + 66 + o, 'SPACE'); }
    } else {
      const stun = T - stunAt < STUN, open = gT === 1 || T - gAt < CLOSE_GRACE, busy = T - turnAt < .2;
      const col = stun ? '#ff4d5e' : !open ? '#ff9a4d' : busy ? '#5CFF7A' : '#ffd23f', dk = stun ? '#b8283a' : !open ? '#c4621c' : busy ? '#23a046' : '#c99512';
      const o = plate(BTN, col, dk, busy, false);
      crankIcon(BTN[0] + 52, BTN[1] + 44 + o, T, busy);
      const label = stun ? 'OUCH!' : !open ? 'GATE DOWN!' : busy ? 'REELING!' : 'DRAG IN CIRCLES';
      if (TOUCH) txt(label, BTN[0] + 228, BTN[1] + 44 + o, 32, '#fff', 'center', 270);
      else { txt(label, BTN[0] + 228, BTN[1] + 34 + o, 28, '#fff', 'center', 270); keyCap(BTN[0] + 228, BTN[1] + 66 + o, 'MASH SPACE'); }
    }
  }
  g.dbg = {
    fbs, NEED,
    threat: () => { const th = threat(g.c); return th ? { k: th.k, left: th.left } : null; },   // the gatekeeper sees the dragon inhale + the fireball fly
    hub: [WX, WY], prog: () => prog, gate: () => gT, links: () => linksIn(dp),
  };
  wire(g, D, 1, sp, 'du_crank');
  return g;
}
reg('du_crank', duGate, 'DRAGON GATE'); REGMAP.du_crank.duo = true;

function leverIcon(x, y, k) {                             // a little lever in a box, pulled by k
  X.save(); X.translate(x, y);
  const a = lerp(.55, -1.0, k), kx = Math.sin(a) * 34, ky = -Math.cos(a) * 34 + 10;
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 11; X.beginPath(); X.moveTo(0, 10); X.lineTo(kx, ky); X.stroke(); X.strokeStyle = '#8f8aa8'; X.lineWidth = 5; X.stroke();
  rr(-18, 6, 36, 16, 5); ink(IRON, 3); X.beginPath(); X.arc(kx, ky, 9, 0, TAU); ink('#ff5a4f', 3);
  X.restore();
}
function crankIcon(x, y, T, spin) {
  X.save(); X.translate(x, y + 6); X.rotate(spin ? T * 9 : 0);
  X.beginPath(); X.arc(0, 0, 24, 0, TAU); ink(WOOD, 3.5); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink(IRON, 3);
  X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 10; X.beginPath(); X.moveTo(0, 0); X.lineTo(22, 0); X.stroke(); X.strokeStyle = IRON; X.lineWidth = 5; X.stroke();
  X.beginPath(); X.arc(22, 0, 7, 0, TAU); ink('#ff5a4f', 3);
  X.restore();
}

/* ───────────── intro card: what each role does (520×240 frame), a 4.4 s loop ───────────── */
const DSC = .5, DOX = 120, DOY = -60 * DSC;              // the demo shows the main scene's band y 60..440 at half size, flush right
let DBG = null;
function buildDemoBg() {
  if (!BG) { BG = buildBg(); FG = buildFg(); }
  const c2 = document.createElement('canvas'); c2.width = 520; c2.height = 240; const old = X; X = c2.getContext('2d');
  X.drawImage(SKY, 0, 0, W, 440, 0, DOY, 520, 440 * DSC);                      // the sky stretched to the full card width
  const gy = DOY + GY * DSC; X.drawImage(BG, 0, GY, 260, 180, 0, gy, 130, 90);   // more courtyard cobbles on the left
  X.save(); X.translate(DOX, DOY); X.scale(DSC, DSC); X.drawImage(BG, 0, 0); X.restore();
  X.strokeStyle = INK; X.lineWidth = 2.5; X.beginPath(); X.moveTo(0, gy); X.lineTo(DOX, gy); X.stroke();
  X = old; return c2;
}
const MBTN = [130, 192, 260, 40];
function miniBtn(b, col, dk, down, label, icon) {
  const [x, y, w, h] = b, d = down ? 2 : 6;
  rr(x, y + 6, w, h, 14); ink(dk, 3); rr(x, y + 6 - d, w, h, 14); ink(col, 3);
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 8, y + 9 - d, w - 16, 7, 3.5); X.fill();
  if (icon) icon(x + 32, y + h / 2 + 2 - d);
  txt(label, x + w / 2 + 22, y + h / 2 + 4 - d, 22, '#fff', 'center', w - 76);
}
function demo(role, t) {
  X = ctx; if (!DBG) DBG = buildDemoBg(); X.drawImage(DBG, 0, 0);
  const u = t % 4.4, keeperRole = role === 0;
  // the story: gate up + reeling -> the dragon inhales -> let go -> CLANG -> hold again
  const inh0 = 1.0, spitT = 2.0, hitT = 2.45, relT = 1.75, reT = 2.85;
  const held = u < relT || u > reT, gp = held ? (u < relT ? 1 : clamp((u - reT) / .2, 0, 1)) : clamp(1 - (u - relT) / .09, 0, 1);
  const reel = held && gp > .9 ? 1 : 0, p = .12 + .1 * ((u < relT ? u : u > reT ? relT + (u - reT) : relT) / 3);
  const inhK = u >= inh0 && u < spitT ? (u - inh0) / (spitT - inh0) : 0;
  X.save(); X.translate(DOX, DOY); X.scale(DSC, DSC);
  dragon(DGX, DGY + Math.sin(t * 1.8) * 3, DS, { t, inh: inhK, open: u >= spitT && u < spitT + .3 ? 1 - (u - spitT) / .3 : 0, mood: inhK > 0 ? 'inhale' : u > hitT && u < hitT + 1 ? 'grump' : 'idle', look: [-1, .3] });
  X.save(); X.beginPath(); X.rect(0, 0, W, 446); X.clip(); X.drawImage(FG, 0, 0); X.restore();
  if (inhK > 0) alarm(604, 196, inhK, t);
  drawString(p, t, null, reel, gp < .25);
  const ang = t * (reel ? 7 : 0) + (keeperRole ? 0 : t * 2);
  X.save(); X.translate(CKX, GY); caos(0, 0, 5.4, { col: keeperRole ? '#6EA8FE' : '#FFC93C' }); X.restore();
  const hp = winch(keeperRole ? (u < relT ? u * 7 : u > reT ? (u - reT + relT) * 7 : relT * 7) : t * 6, 0, 0);
  arm(CKX + 6.6 * 5.4, GY - 5.2 * 5.4, hp[0], hp[1], 5.4, keeperRole ? '#6EA8FE' : '#FFC93C');
  portcullis(gp, u > hitT && u < hitT + .8 ? 1 - (u - hitT) / .8 : 0, t, 0);
  if (u >= spitT && u < hitT) { const k = (u - spitT) / (hitT - spitT), [x, y] = fbPos(k), [x2, y2] = fbPos(Math.min(1, k + .03)); fireball(x, y, Math.atan2(y2 - y, x2 - x), .9, t); }
  const la = lerp(LA_UP, LA_HELD, ease(gp)), [kx, ky] = leverAt(la), kc = keeperRole ? '#FFC93C' : '#6EA8FE';
  X.save(); X.translate(KX, TTOP - gp * 3); caos(0, 0, 5.2, { col: kc }); X.restore(); lever(la, inhK > 0 && held, t);
  keeperArms(5.2, 0, gp, kx, ky, kc, false, t);
  X.restore();
  if (u > hitT && u < hitT + .7) badge('CLANG!', 240, 44, 22, '#6c6a8a', '#fff', outBack((u - hitT) / .2), -.05);
  if (keeperRole) {
    const danger = inhK > 0 || (u >= spitT && u < hitT);
    miniBtn(MBTN, danger ? (held ? '#ff4d5e' : '#ff9a4d') : held ? '#5CFF7A' : '#ffd23f', danger ? (held ? '#b8283a' : '#c4621c') : held ? '#23a046' : '#c99512', held,
      danger ? (held ? 'FIRE! LET GO!' : 'KEEP IT DOWN!') : held ? 'GATE UP!' : 'HOLD TO RAISE', (x, y) => { X.save(); X.translate(x, y - 4); X.scale(.62, .62); leverIcon(0, 0, gp); X.restore(); });
    demoFinger(MBTN[0] + 32, MBTN[1] + 26, held, held ? (t * 1.8) % 1 : 0);
  } else {
    const open = gp > .5;
    miniBtn(MBTN, open ? '#5CFF7A' : '#ff9a4d', open ? '#23a046' : '#c4621c', open, open ? 'REELING!' : 'GATE DOWN!', (x, y) => { X.save(); X.translate(x, y - 6); X.scale(.62, .62); crankIcon(0, 0, t, open); X.restore(); });
    const fa = t * 6, fx = DOX + (WX + Math.cos(fa) * 40) * DSC, fy = DOY + (WY + Math.sin(fa) * 40) * DSC;
    X.globalAlpha = .5; X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.arc(DOX + WX * DSC, DOY + WY * DSC, 40 * DSC, fa - 2, fa); X.stroke(); X.globalAlpha = 1;
    demoFinger(fx, fy, true, 0);
  }
}
DUO.INFO.du_crank = [['GATEKEEPER', 'RAISE THE GATE, DROP IT FOR FIRE', 'HOLD · LET GO FOR FIREBALLS'], ['CRANKER', 'REEL IN THE SAUSAGES', 'DRAG IN CIRCLES']];
DUO.DEMOS.du_crank = [t => demo(0, t), t => demo(1, t)];

})();
