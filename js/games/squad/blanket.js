'use strict';
/* ═════════ SQUAD · FIRE RESCUE (sq_blanket), 3-4 players, one corner each ═════════
   A (cartoon, harmless) apartment block is on fire and the residents are throwing themselves out of the windows: a cat, a grandma with an
   umbrella, a pizza, a sleepy walrus, a goldfish bowl and a piano. The firefighter Caoses hold the corners of ONE big rescue blanket.
   Every player owns ONE corner (n = 4: the four corners of a rectangle, n = 3: a triangle). The pointer is the corner:
     pointer X (or ◄ ► / A D)       = where this corner wants to stand. The blanket's centre is the AVERAGE of everybody's corners.
     pointer Y (or ▲ ▼ / W S, Space) = how high the corner is held. Arms get tired: ~3 s above the line and the corner droops until it rests.
   A window opens 0.8 s before the victim jumps (a shadow and a countdown ring show where it lands). To CATCH it, every corner has to be UP at
   the landing (the piano needs everybody all the way up). One corner that is down = the blanket sags through and the victim goes SPLAT.
   Then the victim rides the blanket: the team carries it to the ambulance (the right edge must reach the open doors) and tilts it (right
   corners low, left corners high) so the victim slides out into the ambulance. Slide out anywhere else: PLOP on the street.
   Win = 4 of the 6 victims saved. Lose = 3 splats. The victims are rubber: they bounce comically safe anyway.
   Netcode: every player OWNS its corner and publishes 'c' [vote x, h*100, tired] (coalesced ~10/s, latest); the others draw it ~LAG behind.
   The JUDGE (role 0) simulates the victims against the blanket as it sees it. The fall is a fixed seeded schedule, the same on every screen; the
   judge alone decides the outcomes and publishes them as events: 'imp' {id,u} (landed), 'cat' {id,u} / 'mis' {id} (caught or sagged through),
   'sav' {id,n} (ambulance), 'spl' {id,x,n} (street), plus 'it' [[id,u,vu]..] ~10/s while victims ride (the others ease towards it).
   The judge reads "was every corner up at the landing" over a short window of what it RECEIVED, so lag never costs a catch. The verdict is
   sent with 'end' (via wire). All randomness is drawn in the constructor, always the same number of draws whatever n / role. ═════════ */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
let CS = 23; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;     // cosmetic randomness: never touches the seeded level

/* ───────────── layout (800x600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const HAND0 = 58, LIFT = 70;                          // a corner's hand is HAND0 + LIFT*h above the firefighter's feet
const THR = .62, THR_H = .85, REST = .3, TIRED_CAP = .3;   // "up" for a catch / for the piano; where a corner rests; the cap while tired
const XW = [150, 220, 290, 360, 430], WROW = [172, 250], WBOT = 22;   // window columns / rows (the victim sits WBOT below the row's centre)
const GRND = 502;                                      // the street where victims splat
const XL0 = 130, MXL = 50, MYL = 424;                  // the safety mattress on the left: the blanket's left edge must reach XL0
const AX = 548, XM0 = 470, MX = AX + 32, MY = 428;                   // the blanket's right edge must reach XM0 for the ambulance; MX,MY the open doors
const NITEMS = 4, NEED = 3, SPLAT_MAX = NITEMS - NEED; // 3 splats and it is over
const TEL = .8, TEL_H = 1.0, GAP = 3.4, T0 = .4, DEC = .3;   // telegraph / heavy telegraph / seconds between victims / first window / the judge's wait to read the corners
const GR = 9000, DEAD = .07, FR = 1.5;                              // slide acceleration per unit of slope, friction
const VSPD = 520, HSPD = 4.2, KEYX = 560, KEYH = 2.3;   // corner x speed (px/s), corner height speed, keyboard rates
const DRAIN = .2, RECOV = 1;                          // arm stamina per second (held above .55 / resting)
const PCOL = ['#FFC93C', '#6EA8FE', '#7CE38B', '#FF8FC4'];
const SEATS = n => n >= 4
  ? [{ off: -150, row: 504, side: 0, u: 4.6, fr: 1, name: 'LEFT FRONT' }, { off: 150, row: 504, side: 1, u: 4.6, fr: 1, name: 'RIGHT FRONT' }, { off: -120, row: 442, side: 0, u: 3.9, fr: 0, name: 'LEFT BACK' }, { off: 120, row: 442, side: 1, u: 3.9, fr: 0, name: 'RIGHT BACK' }]
  : [{ off: -150, row: 473, side: 0, u: 4.3, fr: 1, name: 'LEFT' }, { off: 180, row: 442, side: 1, u: 3.9, fr: 0, name: 'BACK RIGHT' }, { off: 120, row: 504, side: 1, u: 4.6, fr: 1, name: 'FRONT RIGHT' }];
const ROT = { cat: 3, granny: 0, pizza: 5, walrus: 1.2, piano: .6, fish: 1 };   // how fast each one tumbles on the way down
const TYPES = {   // g: gravity px/s², vmax: umbrella terminal speed, m: how fast it slides, ih: how tall it is, hv: needs everyone all the way up, tag: window bubble
  cat: { g: 950, m: 1, ih: 40, tag: 'HELP!' }, granny: { g: 420, vmax: 190, m: .75, ih: 90, tag: 'HELP!' }, pizza: { g: 950, m: 1.5, ih: 46, tag: 'HELP!' },
  walrus: { g: 1000, m: .6, ih: 50, tag: 'ZZZ...' }, piano: { g: 1150, m: .4, ih: 70, hv: 1, tag: 'HEAVY!' }, fish: { g: 950, m: 1, ih: 44, tag: 'HELP!' },
};

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tube(pts, w, col) { line(pts, w + 7, INK); line(pts, w, col); }
function poly(pts) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); }
/* cel shading: the shape in its shade colour, then the base colour shifted by (-sx, -sy) inside it, so a crescent of shade stays on one side */
function cel(pf, base, shade, sx, sy, o = 4) { pf(); ink(shade, o); X.save(); pf(); X.clip(); X.translate(-sx, -sy); pf(); X.fillStyle = base; X.fill(); X.restore(); }
function glint(x, y, rx, ry, rot, a) { X.fillStyle = `rgba(255,255,255,${a || .45})`; el(x, y, rx, ry, rot || -.4); X.fill(); }
function pill(x, y, label, col, raw) {                // a name tag with a little pointer down
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = raw ? label : t(label), w = Math.min(150, X.measureText(s).width + 22);
  X.beginPath(); X.moveTo(x - 7, y + 10); X.lineTo(x, y + 19); X.lineTo(x + 7, y + 10); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 11, w, 22, 11); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 5, y - 8.5, w - 10, 6, 3); X.fill();
  if (raw) { X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = INK; X.fillText(s, x, y + 1, w - 12); }
  else txt(label, x, y + 1, 15, INK, 'center', w - 12);
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
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function bubble(s, x, y, size, sc) {                   // a speech bubble, pointer down at (x, y)
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(130, X.measureText(t(s)).width) + 22, h = size * 1.45;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-7, -h - 4); X.lineTo(2, 0); X.lineTo(9, -h - 4); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -h - 8, w, h, h * .45); ink('#fff', 3); X.fillStyle = '#fff'; X.fillRect(-6, -h - 11, 14, 8);
  txt(s, 0, -h / 2 - 6, size, INK, 'center', 120); X.restore();
}
function heart(x, y, s, col) { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 6); X.bezierCurveTo(-14, -4, -8, -14, 0, -7); X.bezierCurveTo(8, -14, 14, -4, 0, 6); X.closePath(); ink(col || '#ff5c8a', 2.5); X.fillStyle = 'rgba(255,255,255,.55)'; el(-4, -6, 2.4, 1.4, -.5); X.fill(); X.restore(); }
function sweat(x, y, T, k) { X.fillStyle = '#9fe3ff'; const q = (T * 1.6 + k) % 1; X.globalAlpha = 1 - q; X.beginPath(); X.moveTo(x, y - 6 + q * 8); X.quadraticCurveTo(x + 4, y + q * 8, x, y + 4 + q * 8); X.quadraticCurveTo(x - 4, y + q * 8, x, y - 6 + q * 8); X.fill(); X.globalAlpha = 1; }
function btxt(s, x, y, size, fill, ang) {            // text on the baked canvas (txt() only paints on the live one)
  X.save(); X.translate(x, y); X.rotate(ang || 0); X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineJoin = 'round';
  X.lineWidth = size / 5; X.strokeStyle = INK; const s2 = t(s); X.strokeText(s2, 0, 0); X.fillStyle = fill; X.fillText(s2, 0, 0); X.restore();
}

/* ───────────── faces ───────────── */
function eyes2(x, y, dx, r, mood, T) {                 // mood: scared | dizzy | happy | sleep | splat | calm
  for (const sx of [-1, 1]) {
    const ex = x + sx * dx;
    if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath(); X.arc(ex, y + 1.5, r * .8, Math.PI + .4, -.4); X.stroke(); }
    else if (mood === 'sleep') { X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round'; X.beginPath(); X.arc(ex, y - 1.5, r * .8, .4, Math.PI - .4); X.stroke(); }
    else if (mood === 'splat') { line([[ex - r * .6, y - r * .6], [ex + r * .6, y + r * .6]], 2.6, INK); line([[ex + r * .6, y - r * .6], [ex - r * .6, y + r * .6]], 2.6, INK); }
    else {
      const big = mood === 'scared' ? r * 1.25 : r; el(ex, y, big, big * 1.08); ink('#fff', 1.8); X.fillStyle = INK;
      const a = T * 9 + sx, dz = mood === 'dizzy';
      el(ex + (dz ? Math.cos(a) * big * .38 : 0), y + (dz ? Math.sin(a) * big * .38 : mood === 'scared' ? 1 : 0), big * (mood === 'scared' ? .3 : .45), big * (mood === 'scared' ? .3 : .5)); X.fill();
      X.fillStyle = '#fff'; el(ex - big * .22, y - big * .28, big * .14, big * .14); X.fill();
    }
  }
}
function mouth(x, y, w, mood, T) {
  X.strokeStyle = INK; X.lineWidth = 2.6; X.lineCap = 'round'; X.fillStyle = INK;
  if (mood === 'scared') { el(x, y + 2, w * .42, w * .55 + Math.sin(T * 30) * .6); X.fillStyle = '#7a2230'; X.fill(); X.stroke(); }
  else if (mood === 'happy') { X.beginPath(); X.arc(x, y - 1, w * .6, .15, Math.PI - .15); X.stroke(); }
  else if (mood === 'dizzy') { X.beginPath(); X.moveTo(x - w * .6, y + 1); X.quadraticCurveTo(x - w * .3, y - 3, x, y + 1); X.quadraticCurveTo(x + w * .3, y + 5, x + w * .6, y + 1); X.stroke(); }
  else if (mood === 'splat') { X.beginPath(); X.moveTo(x - w * .5, y + 2); X.lineTo(x + w * .5, y + 2); X.stroke(); }
  else { X.beginPath(); X.moveTo(x - w * .4, y + 1); X.quadraticCurveTo(x, y + 4, x + w * .4, y + 1); X.stroke(); }
}

/* ───────────── the victims: origin = bottom centre, y grows downwards ───────────── */
function vCat(m, T) {
  const f = '#a9b2c8', f2 = '#7d86a3';
  X.beginPath(); X.moveTo(11, -8); X.quadraticCurveTo(28, -10 + Math.sin(T * 6) * 4, 24, -30); X.lineWidth = 11; X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 5.5; X.strokeStyle = f; X.stroke();
  cel(() => el(0, -13, 15, 12), f, f2, 3, 4, 3.5); el(1, -9, 8.5, 7.5); ink('#eef1fb', 2);
  for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 11, -34); X.lineTo(sx * 15, -47); X.lineTo(sx * 3, -38); X.closePath(); ink(f, 3); X.beginPath(); X.moveTo(sx * 10.5, -36); X.lineTo(sx * 12.5, -43); X.lineTo(sx * 6, -38.5); X.closePath(); X.fillStyle = '#ffb3c0'; X.fill(); }
  cel(() => el(0, -27, 14, 11.5), f, f2, 3, 3, 3.5);
  X.strokeStyle = f2; X.lineWidth = 2.4; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, -37); X.lineTo(0, -33); X.moveTo(-5, -36.5); X.lineTo(-4, -33); X.moveTo(5, -36.5); X.lineTo(4, -33); X.stroke();
  eyes2(0, -28, 5.6, 3.7, m, T); X.beginPath(); X.moveTo(-2.2, -23.5); X.lineTo(2.2, -23.5); X.lineTo(0, -21); X.closePath(); ink('#ff7ea8', 1.4); mouth(0, -19.5, 7, m, T);
  X.strokeStyle = INK; X.lineWidth = 1.6; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 8, -23); X.lineTo(sx * 21, -25); X.moveTo(sx * 8, -21); X.lineTo(sx * 21, -20); X.stroke(); }
  for (const sx of [-1, 1]) { el(sx * 7, -2.5, 4.6, 3.2); ink(f, 2.5); }
}
function vGranny(m, T, open) {
  if (open) {                                                                                  // the umbrella catches the air
    line([[12, -42], [12, -92]], 8, INK); line([[12, -42], [12, -92]], 3.5, '#8f88a6');
    X.beginPath(); X.moveTo(-26, -88); X.quadraticCurveTo(12, -130, 50, -88); X.quadraticCurveTo(37, -80, 31, -88); X.quadraticCurveTo(21, -80, 12, -88); X.quadraticCurveTo(3, -80, -7, -88); X.quadraticCurveTo(-17, -80, -26, -88); X.closePath(); ink('#ff4d5e', 3.5);
    X.save(); X.beginPath(); X.moveTo(-26, -88); X.quadraticCurveTo(12, -128, 50, -88); X.closePath(); X.clip(); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(12, -112); X.lineTo(-8, -88); X.lineTo(32, -88); X.fill(); X.restore();
    glint(-2, -102, 12, 4, -.5, .55);
  } else { line([[12, -30], [18, -64]], 8, INK); line([[12, -30], [18, -64]], 3.5, '#ff4d5e'); }
  cel(() => rr(-15, -38, 30, 38, 11), '#b49cff', '#8a73e0', 4, 4, 3.5);
  X.fillStyle = '#fff'; rr(-8, -38, 16, 6, 3); X.fill();
  for (const sx of [-1, 1]) { el(sx * 7, -1.5, 5, 3.4); ink('#ffd9a8', 2.5); }
  cel(() => el(0, -50, 13, 12.5), '#ffd9a8', '#e8b27d', 3, 3, 3.5);
  cel(() => el(0, -61, 14, 8), '#f1eef8', '#c4bddb', 2, 3, 3); el(-10, -66, 6.4, 6); ink('#f1eef8', 2.5);
  eyes2(0, -51, 5.2, 3.3, m, T); X.strokeStyle = INK; X.lineWidth = 1.8; for (const sx of [-1, 1]) { X.beginPath(); X.arc(sx * 5.2, -51, 5.2, 0, TAU); X.stroke(); } line([[-1.5, -51], [1.5, -51]], 1.8, INK);
  X.fillStyle = 'rgba(255,120,140,.5)'; for (const sx of [-1, 1]) { el(sx * 9, -45, 3.4, 2.2); X.fill(); } mouth(0, -43, 7, m, T);
}
function vPizza(m, T) {
  X.save(); X.translate(0, -24);
  cel(() => { X.beginPath(); X.arc(0, 0, 24, 0, TAU); }, '#e8a24d', '#b87a2c', 3, 4, 4);
  X.beginPath(); X.arc(0, 0, 19, 0, TAU); ink('#ffd23f', 2.5);
  X.fillStyle = '#e8434f'; for (const [px, py, r] of [[-11, -9, 5], [10, -10, 4.6], [-4, 12, 5.2], [13, 6, 4]]) { X.beginPath(); X.arc(px, py, r, 0, TAU); X.fill(); X.lineWidth = 2; X.strokeStyle = INK; X.stroke(); }
  X.fillStyle = '#5fbf4f'; for (const [px, py] of [[2, -17], [-15, 4], [8, 16]]) { X.beginPath(); X.arc(px, py, 2, 0, TAU); X.fill(); }
  glint(-11, -15, 8, 3.4, -.6, .5); eyes2(0, -3, 6.5, 4.4, m, T); mouth(0, 9, 10, m, T);
  X.restore();
}
function vWalrus(m, T) {
  cel(() => el(0, -20, 34, 20), '#a98a74', '#7d634f', 5, 6, 4); el(-30, -4, 9, 4.6); ink('#8c6f5b', 3); el(30, -4, 9, 4.6); ink('#8c6f5b', 3);
  cel(() => el(0, -30, 21, 19), '#b59882', '#86695a', 3, 4, 4);
  el(-8, -22, 11, 8.5); ink('#e8d5c0', 2.5); el(8, -22, 11, 8.5); ink('#e8d5c0', 2.5);
  for (const sx of [-1, 1]) { rr(sx * 8 - 3, -22, 6, 17, 3); ink('#fffdf2', 2.5); }
  el(0, -28, 6.4, 4.4); ink('#3b2c28', 2);
  X.strokeStyle = INK; X.lineWidth = 1.6; for (const sx of [-1, 1]) for (const k of [-2, 2]) { X.beginPath(); X.moveTo(sx * 11, -23 + k); X.lineTo(sx * 21, -23 + k * 2.4); X.stroke(); }
  eyes2(0, -37, 9, 3.4, m === 'scared' ? 'sleep' : m, T);
  if (m === 'sleep' || m === 'scared') { for (let i = 0; i < 2; i++) { const q = (T * .9 + i * .5) % 1; X.globalAlpha = 1 - q; txt('Z', 28 + q * 12 + i * 6, -50 - q * 26, 15 + i * 4, '#fff'); X.globalAlpha = 1; } }
  glint(-10, -44, 7, 3, -.5, .5);
}
function vFish(m, T) {
  rr(-13, -4, 26, 6, 3); ink('#8a5a34', 2.5);
  X.beginPath(); X.arc(0, -22, 19, 0, TAU); ink('rgba(190,235,255,.78)', 3.5);
  X.save(); X.beginPath(); X.arc(0, -22, 17, 0, TAU); X.clip(); X.fillStyle = 'rgba(80,190,240,.7)'; X.fillRect(-20, -26 + Math.sin(T * 8) * 1.4, 40, 30); X.restore();
  X.save(); X.translate(0, -19 + Math.sin(T * 5) * 1.5); X.beginPath(); X.moveTo(-14, 0); X.lineTo(-23, -6); X.lineTo(-23, 6); X.closePath(); ink('#ff9a4d', 2.5); cel(() => el(0, 0, 13, 9.5), '#ff9a4d', '#d9671a', 2, 3, 3);
  el(5, -2, 3.6, 3.8); ink('#fff', 1.8); X.fillStyle = INK; el(6, -1.6, 1.7, 1.8); X.fill(); mouth(10, 4, 4, m === 'happy' ? 'happy' : 'scared', T); X.restore();
  X.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 3; i++) { const q = (T * .8 + i / 3) % 1; X.beginPath(); X.arc(-5 + i * 5, -14 - q * 14, 1.6, 0, TAU); X.fill(); }
  glint(-9, -32, 5, 2.4, -.6, .8);
}
function vPiano(m, T) {
  rr(-30, -8, 8, 8, 2); ink('#4a4660', 2.5); rr(22, -8, 8, 8, 2); ink('#4a4660', 2.5);
  cel(() => rr(-36, -64, 72, 58, 7), '#3b3550', '#1f1b2e', 5, 5, 4);
  rr(-39, -69, 78, 9, 4); ink('#4a4660', 3.5);
  rr(-33, -26, 66, 14, 3); ink('#fff', 2.5); X.fillStyle = INK; for (let i = 0; i < 7; i++) X.fillRect(-29 + i * 9.2, -26, 4.6, 8);
  rr(-24, -38, 48, 8, 3); ink('#fffdf2', 2); X.fillStyle = INK; for (let i = 0; i < 4; i++) X.fillRect(-18 + i * 12, -37, 7, 1.4);   // sheet music
  eyes2(0, -50, 10, 6, m === 'dizzy' ? 'dizzy' : m, T); mouth(0, -42, 14, m === 'calm' ? 'scared' : m, T);
  glint(-26, -58, 9, 3.2, -.2, .35);
}
const VIC = { cat: vCat, granny: vGranny, pizza: vPizza, walrus: vWalrus, fish: vFish, piano: vPiano };
/* an item at (x, y) = its bottom centre. o: rot, sx, sy (squash), s (scale), mood */
function drawVictim(type, x, y, T, o) {
  X.save(); X.translate(x, y); if (o.rot) X.rotate(o.rot); const vs = (o.s || 1) * 1.2; X.scale(vs * (o.sx || 1), vs * (o.sy || 1));
  VIC[type](o.mood || 'calm', T, o.open); X.restore();
}

/* ───────────── the firefighters ───────────── */
function helmet(u, y) {
  rr(-6.4 * u, y - 1.6 * u, 12.8 * u, 2.2 * u, 1.1 * u); ink('#e8434f', 3); rr(-4.2 * u, y - 4.4 * u, 8.4 * u, 3.4 * u, 1.6 * u); ink('#ff4d5e', 3);
  X.beginPath(); X.moveTo(-1.6 * u, y - 1 * u); X.lineTo(1.6 * u, y - 1 * u); X.lineTo(1.2 * u, y - 4 * u); X.lineTo(-1.2 * u, y - 4 * u); X.closePath(); ink('#ffd23f', 2);
  X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-3.4 * u, y - 3.6 * u, 2.4 * u, .6 * u);
}
/* one firefighter: feet at (fx, fy), both hands on the corner (hx, hy). h = 0..1 how high, tired, mood (null | happy | sad) */
function fighter(fx, fy, hx, hy, u, col, mood, tired, T, k, hat) {
  const sh = tired ? Math.sin(T * 30 + k) * 1.3 : 0;
  shadow(fx, fy + 1, 26 * u / 3.6, 6, .24);
  for (const sx of [-1, 1]) {                                                          // arms first: the body covers the shoulders
    const sxp = fx + sx * 6.4 * u, syp = fy - 6.6 * u, gx = hx + sx * 5.5 + sh, gy = hy + 5;
    tube([[sxp, syp], [(sxp + gx) / 2 + sx * 3, (syp + gy) / 2 + 2], [gx, gy]], Math.max(4, u * 1.15), col);
  }
  caos(fx, fy, u, { col, mood: tired && !mood ? null : mood });
  X.save(); if (hat) { X.translate(fx + hat.x, fy - 9.1 * u + hat.y); X.rotate(hat.rot); helmet(u, 0); } else { X.translate(fx, fy); helmet(u, -9.1 * u); } X.restore();
  for (const sx of [-1, 1]) { X.beginPath(); X.arc(hx + sx * 5.5 + sh, hy + 5, 5.2, 0, TAU); ink('#ffd23f', 2.5); }
}

/* ───────────── the scene: geometry of the blanket from the four (or three) corners ───────────── */
/* S = { n, SE, px[], py[], h[], tired[], cols[], names[], me, T, sag, items[], saved, splats, res, rk, ... } */
function corners(S) {   // BL BR FL FR as indices
  return S.n >= 4 ? { BL: 2, BR: 3, FL: 0, FR: 1 } : { BL: 0, BR: 1, FL: 0, FR: 2 };
}
function bpt(S, c, u, v) {
  const P = (i) => [S.px[i], S.py[i]];
  const bl = P(c.BL), br = P(c.BR), fl = P(c.FL), fr = P(c.FR);
  const bx = lerp(bl[0], br[0], u), by = lerp(bl[1], br[1], u), fx = lerp(fl[0], fr[0], u), fy = lerp(fl[1], fr[1], u);
  return [lerp(bx, fx, v), lerp(by, fy, v) + S.sag * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)];
}
const RED = '#e8434f', RED2 = '#b8283a', CRM = '#fff3e0', CRM2 = '#e6c9a8';
function blanketDraw(S) {
  const c = corners(S), NU = 10, NV = 4, T = S.T;
  // soft shadow on the street
  let cxm = 0, lo = 1e9; for (let i = 0; i < S.n; i++) cxm += S.px[i] / S.n;
  shadow(cxm, 480, 170, 20, .2);
  const edge = [];
  for (let i = 0; i <= NU; i++) edge.push(bpt(S, c, i / NU, 0)); for (let j = 1; j <= NV; j++) edge.push(bpt(S, c, 1, j / NV));
  for (let i = NU - 1; i >= 0; i--) edge.push(bpt(S, c, i / NU, 1)); for (let j = NV - 1; j > 0; j--) edge.push(bpt(S, c, 0, j / NV));
  // the thickness (a darker copy below) so the blanket reads as a thing
  X.save(); X.translate(0, 7); poly(edge); ink(RED2, 4); X.restore();
  poly(edge); ink(CRM, 4);
  X.save(); poly(edge); X.clip();
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = bpt(S, c, i / NU, j / NV), b = bpt(S, c, (i + 1) / NU, j / NV), d = bpt(S, c, (i + 1) / NU, (j + 1) / NV), e = bpt(S, c, i / NU, (j + 1) / NV), chk = (i + j) % 2;
    const shd = j >= NV - 1 ? .22 : j >= NV - 2 ? .08 : 0;
    poly([a, b, d, e]); X.fillStyle = mix(chk ? RED : CRM, chk ? RED2 : CRM2, shd + (chk ? 0 : .04)); X.fill(); X.lineWidth = .8; X.strokeStyle = X.fillStyle; X.stroke();
  }
  // a little light on the back-left
  const g0 = bpt(S, c, .3, .3); glint(g0[0], g0[1], 38, 7, -.18, .32);
  X.restore();
  poly(edge); X.lineWidth = 7; X.lineJoin = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.4; X.strokeStyle = '#ffd23f'; X.stroke();
}

/* ───────────── static background, baked once ───────────── */
let BG = null;
const FLOORS_Y = [160, 232];
function windowRect(c, r) { return [XW[c] - 25, FLOORS_Y[r] - 29, 50, 58]; }
function buildBg() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 440); g.addColorStop(0, '#4fb4f0'); g.addColorStop(.55, '#a9defa'); g.addColorStop(1, '#ffe9c4'); X.fillStyle = g; X.fillRect(0, 0, W, 450);
  // far skyline (lilac, coloured outline)
  X.fillStyle = '#c9d0fb'; X.strokeStyle = '#7b80c6'; X.lineWidth = 3;
  [[500, 260, 70, 190], [570, 300, 60, 150], [628, 250, 80, 200], [706, 290, 60, 160], [758, 270, 70, 180], [0, 300, 60, 150], [-4, 250, 50, 200]].forEach(([x, y, w, h]) => { rr(x, y, w, h, 6); X.fill(); X.stroke(); X.fillStyle = '#aab3f2'; for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) { X.fillRect(x + 10 + q * (w / 2 - 6), y + 16 + r * 32, 11, 14); } X.fillStyle = '#c9d0fb'; });
  // the street: sidewalk, kerb, asphalt, lane dashes
  X.fillStyle = '#e0d6c8'; X.fillRect(0, 440, W, 22); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(0, 440, W, 5);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 440); X.lineTo(W, 440); X.stroke();
  X.fillStyle = '#b8ad9f'; for (let x = 20; x < W; x += 72) X.fillRect(x, 446, 2, 14);
  X.strokeStyle = '#8f8678'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 462); X.lineTo(W, 462); X.stroke();
  g = X.createLinearGradient(0, 462, 0, H); g.addColorStop(0, '#6a6e86'); g.addColorStop(1, '#4a4d63'); X.fillStyle = g; X.fillRect(0, 462, W, H - 462);
  X.fillStyle = 'rgba(255,255,255,.07)'; for (let i = -3; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, H); X.lineTo(i * 90 + 40, H); X.lineTo(i * 90 + 100, 462); X.lineTo(i * 90 + 70, 462); X.fill(); }
  X.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 10; x < W; x += 84) X.fillRect(x, 540, 44, 5);
  // the burning building
  const BX = 98, BW = 384, BY = 92;
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(BX + 10, 436, BW, 8);
  cel(() => rr(BX, BY, BW, 350, 8), '#e0654a', '#b84833', 9, 0, 5);
  X.save(); rr(BX, BY, BW, 350, 8); X.clip();
  X.fillStyle = 'rgba(0,0,0,.09)'; for (let r = 0; r < 14; r++) { const y = BY + 8 + r * 26; X.fillRect(BX, y, BW, 3); for (let q = 0; q < 12; q++) X.fillRect(BX + ((q * 38 + (r % 2) * 19) % BW), y, 3, 26); }
  X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(BX + 8, BY, 22, 350);
  X.restore();
  rr(BX - 8, BY - 12, BW + 16, 22, 6); ink('#f0d9b5', 4); X.fillStyle = 'rgba(255,255,255,.5)'; rr(BX, BY - 9, BW - 12, 5, 2); X.fill();   // cornice
  rr(BX + 280, BY - 56, 40, 46, 4); ink('#8a5a34', 4); X.fillStyle = '#6e4626'; X.fillRect(BX + 286, BY - 52, 5, 38);   // chimney
  rr(BX + 40, BY - 40, 60, 30, 5); ink('#c9ced6', 4); rr(BX + 52, BY - 54, 36, 16, 4); ink('#8f9cb3', 3);              // water tank
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {                              // windows: frame, dark room, sill
    const [x, y, w, h] = windowRect(c, r);
    rr(x - 5, y - 5, w + 10, h + 10, 9); ink('#f6e9c8', 4); rr(x, y, w, h, 6); ink('#2a1424', 3); X.fillStyle = 'rgba(255,150,60,.35)'; rr(x + 3, y + 3, w - 6, h - 6, 4); X.fill();
    rr(x - 8, y + h + 2, w + 16, 8, 3); ink('#d8c39a', 3);
  }
  // door + sign
  rr(BX + 164, 372, 56, 68, 8); ink('#8a5a34', 4); X.fillStyle = '#c98443'; rr(BX + 171, 380, 42, 60, 4); X.fill(); X.fillStyle = '#ffd23f'; X.beginPath(); X.arc(BX + 204, 412, 3, 0, TAU); X.fill();
  rr(BX + 124, 336, 136, 24, 9); ink('#ffd23f', 3.5); btxt('HOT FLATS', BX + 192, 348, 15, '#e8434f');
  for (const bxx of [BX + 20, BX + 300]) { rr(bxx, 392, 70, 20, 5); ink('#8a5a34', 3); rr(bxx + 4, 380, 62, 14, 5); ink('#5fbf4f', 3); }   // planters
  // fire hydrant + the kerb
  const hx = 506; rr(hx - 10, 420, 20, 28, 6); ink('#ff4d5e', 3.5); rr(hx - 14, 414, 28, 10, 5); ink('#e8434f', 3); rr(hx - 17, 428, 34, 8, 4); ink('#ff4d5e', 3); glint(hx - 4, 428, 3, 8, 0, .5);
  // the ambulance body (the siren, doors, medic and wheels are live)
  X = old; return cv;
}
function ambulanceBody() {
  const x0 = AX, y0 = 372, y1 = 450;
  cel(() => rr(x0 + 8, y0, 180, 78, 10), '#f6f8ff', '#c4cbe4', 6, 6, 4.5);                       // box
  cel(() => { X.beginPath(); X.moveTo(x0 + 188, y0 + 18); X.lineTo(x0 + 222, y0 + 20); X.quadraticCurveTo(x0 + 236, y0 + 24, x0 + 238, y0 + 44); X.lineTo(x0 + 240, y1 - 4); X.lineTo(x0 + 188, y1 - 4); X.closePath(); }, '#f6f8ff', '#c4cbe4', 5, 5, 4.5);   // cab
  X.beginPath(); X.moveTo(x0 + 198, y0 + 26); X.lineTo(x0 + 220, y0 + 28); X.quadraticCurveTo(x0 + 230, y0 + 32, x0 + 230, y0 + 46); X.lineTo(x0 + 198, y0 + 46); X.closePath(); ink('#8fd8f0', 3);
  glint(x0 + 206, y0 + 33, 8, 3, -.5, .7);
  X.fillStyle = '#ff4d5e'; X.fillRect(x0 + 8, y0 + 50, 232, 9); X.fillStyle = 'rgba(255,255,255,.6)'; X.fillRect(x0 + 8, y0 + 52, 232, 2);
  X.fillStyle = '#ff4d5e'; rr(x0 + 120, y0 + 12, 44, 30, 4); X.fill(); X.fillStyle = '#fff'; X.fillRect(x0 + 138, y0 + 16, 8, 22); X.fillRect(x0 + 127, y0 + 25, 30, 8); X.lineWidth = 2.4; X.strokeStyle = INK; X.strokeRect(x0 + 127, y0 + 25, 30, 8);
  rr(x0 + 236, y1 - 14, 12, 12, 3); ink('#c9ced6', 3);                                                // bumper
}
function ambulance(S, T) {
  const x0 = AX, y0 = 372, y1 = 450, rk = S.rk, go = S.res === 'win' && rk > .15 ? (rk - .15) : 0, ox = go > 0 ? go * go * 3600 : 0, sb = S.res === 'lose' ? Math.sin(T * 40) * 0 : 0;
  X.save(); X.translate(ox, sb);
  ambulanceBody();
  // open rear doors: the dark inside, a stretcher, the medic
  rr(x0 - 2, y0 + 6, 38, 66, 4); ink('#2b2838', 3.5); X.fillStyle = '#4a4660'; X.fillRect(x0 + 4, y0 + 56, 30, 4); X.fillStyle = '#e8434f'; X.fillRect(x0 + 6, y0 + 50, 26, 6);
  const lit = S.ambGlow;
  if (lit > 0) { X.globalAlpha = .35 + .25 * Math.sin(T * 9); X.fillStyle = '#5CFF7A'; rr(x0 - 6, y0 + 2, 46, 74, 8); X.fill(); X.globalAlpha = 1; }
  caos(MX + 4, y1 - 4, 2.7, { col: '#fff', mood: S.res === 'win' ? 'happy' : null });
  X.save(); X.translate(MX + 4, y1 - 4); rr(-4.6 * 2.7, -11 * 2.7, 9.2 * 2.7, 2.4 * 2.7, 1.2 * 2.7); ink('#fff', 2.5); X.fillStyle = '#ff4d5e'; X.fillRect(-1 * 2.7, -11 * 2.7 + 2, 2 * 2.7, 2.4 * 2.7 - 4); X.restore();
  rr(x0 - 6, y0 - 2, 14, 82, 3); ink('#d3cfe0', 3);                                                   // door frame / the open door hinged flat
  if (S.res === 'win' && rk > .08) { rr(x0 - 4, y0 + 2, 12 + ease((rk - .08) / .1) * 28, 74, 3); ink('#f6f8ff', 3); }
  // wheels
  for (const wx of [x0 + 52, x0 + 196]) { X.save(); X.translate(wx, y1 + 1); X.rotate(go * 14); X.beginPath(); X.arc(0, 0, 17, 0, TAU); ink('#2b2838', 3.5); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink('#c9ced6', 2.5); line([[-8, 0], [8, 0]], 2, '#8f88a6'); X.restore(); }
  // flashing siren
  const on = Math.floor(T * 5) % 2, alarm = S.res === 'win' || S.ambGlow > 0 || (S.items && S.items.some(it => it.st === 3));
  rr(x0 + 74, y0 - 12, 56, 14, 6); ink(on || !alarm ? '#4db8ff' : '#8f88a6', 3); rr(x0 + 134, y0 - 12, 30, 14, 6); ink(!on || !alarm ? '#ff4d5e' : '#8f88a6', 3);
  if (alarm) { X.globalAlpha = .3; X.fillStyle = on ? '#4db8ff' : '#ff4d5e'; X.beginPath(); X.arc(x0 + (on ? 102 : 149), y0 - 6, 28 + Math.sin(T * 20) * 3, 0, TAU); X.fill(); X.globalAlpha = 1; }
  X.restore();
}

/* ───────────── live background: clouds, smoke, flames, helicopter, dalmatian ───────────── */
const CLOUDS = [[40, 66, 1], [380, 108, .8], [640, 70, 1.1]];
function clouds(T) {
  for (const [x0, y, s] of CLOUDS) {
    const x = (x0 + T * 6 * s) % 1000 - 140;
    X.save(); X.translate(x, y); X.scale(s, s);
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 8, 24]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); ink(null, 3); }
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 8, 24]]) { X.beginPath(); X.arc(dx, dy, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
    glint(14, -14, 14, 6, -.3, .8);
    X.restore();
  }
}
function smoke(T, big) {                               // dark puffs climb out of the roof and drift right
  for (let i = 0; i < 9; i++) {
    const q = (T * .22 + i / 9) % 1, x = 380 + (i % 3) * 30 + q * 170 + Math.sin(T + i) * 6, y = 96 - q * 90, r = (16 + q * 34) * (big ? 1.25 : 1);
    X.globalAlpha = (1 - q) * .88; X.fillStyle = '#5b5873'; X.strokeStyle = '#3a374d'; X.lineWidth = 3; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); X.stroke();
    X.fillStyle = 'rgba(255,255,255,.12)'; X.beginPath(); X.arc(x - r * .3, y - r * .3, r * .5, 0, TAU); X.fill();
  }
  X.globalAlpha = 1;
}
function flame(x, y, w, h, T, k) {                     // a flame tongue: bottom centre (x, y)
  const sw = Math.sin(T * 9 + k) * w * .18, sh = 1 + Math.sin(T * 13 + k * 2) * .1;
  X.beginPath(); X.moveTo(x - w / 2, y); X.quadraticCurveTo(x - w * .55 + sw, y - h * .5, x + sw * 1.6, y - h * sh); X.quadraticCurveTo(x + w * .55 + sw, y - h * .45, x + w / 2, y); X.closePath(); ink('#ff7a2f', 2.5);
  X.beginPath(); X.moveTo(x - w * .28, y); X.quadraticCurveTo(x - w * .3 + sw, y - h * .35, x + sw, y - h * .62 * sh); X.quadraticCurveTo(x + w * .3 + sw, y - h * .3, x + w * .28, y); X.closePath(); X.fillStyle = '#ffe14d'; X.fill();
}
function windowsLive(S, T) {
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const [x, y, w, h] = windowRect(c, r), act = S.items && r < 2 && S.items.find(it => it.st === 0 && it.col === c && it.row === r && S.sNow >= it.tTel);
    X.save(); rr(x, y, w, h, 6); X.clip();
    const fk = S.res === 'win' ? Math.max(0, 1 - S.rk * 1.3) : 1;
    if (hash(c * 7 + r * 13) < .62 && !act) { if (fk > .08) { flame(x + 12, y + h, 20 * fk, (30 + hash(c + r) * 18) * fk, T, c + r * 3); flame(x + 33, y + h, 22 * fk, (44 + hash(c * 3 + r) * 14) * fk, T, c * 2 + r); } if (S.res === 'lose') flame(x + 25, y + h, 28, 62, T, c); }
    else if (!act) { X.fillStyle = 'rgba(80,70,100,.55)'; for (let i = 0; i < 3; i++) { const q = (T * .5 + i / 3 + c * .13) % 1; X.beginPath(); X.arc(x + 14 + i * 12, y + h - q * h, 6 + q * 7, 0, TAU); X.fill(); } }
    X.restore();
    if (act) {                                                                         // the shutters flung open
      const k = clamp((S.sNow - act.tTel) / .25, 0, 1);
      for (const sx of [-1, 1]) { const sw = 12 * (1 - k * .8); rr(sx < 0 ? x - 5 - sw * (1 - 0) + 5 : x + w - 5, y - 2, sw + 5, h + 4, 3); ink('#2f9a55', 3); }
    }
  }
}
function heli(S, T) {
  const k = ((T * .09) % 1), x = S.res ? 560 + Math.sin(T * 2) * 8 : -90 + k * 1000, y = 118 + Math.sin(T * 1.7) * 6, dirf = 1;
  X.save(); X.translate(x, y);
  line([[-34, -2], [-72, -10]], 7, INK); line([[-34, -2], [-72, -10]], 3, '#c9ced6'); X.save(); X.translate(-72, -10); X.rotate(T * 22); line([[0, -9], [0, 9]], 3, INK); X.restore();
  cel(() => el(0, 0, 36, 22), '#4db8ff', '#2a82c6', 5, 6, 4.5);
  X.save(); el(0, 0, 36, 22); X.clip(); X.fillStyle = '#fff'; X.fillRect(-40, 4, 80, 8); X.restore();
  rr(6, -15, 26, 20, 8); ink('#cfe9ff', 3); caos(20, 5, 1.1, { col: '#FF6B3D' }); glint(12, -10, 6, 2, -.5, .8);
  line([[-30, 24], [30, 24]], 5, INK); line([[-20, 14], [-20, 24]], 4, INK); line([[20, 14], [20, 24]], 4, INK);
  line([[0, -22], [0, -28]], 5, INK); { const rl = 20 + 36 * Math.abs(Math.cos(T * 18)); line([[-rl, -28], [rl, -28]], 5, INK); line([[-rl, -28], [rl, -28]], 2.2, '#c9ced6'); }
  txt('7', -14, 1, 15, '#fff');
  if (S.res === 'lose' && S.rk > .1) bubble('OOPS!', 6, -34, 14, ease(S.rk * 5));
  if (S.res === 'win' && S.rk > .1) bubble('LIVE!', 6, -34, 14, ease(S.rk * 5));
  X.restore();
}
function mattress(S, T) {                             // the safety mattress: a puffy yellow cushion, the dalmatian sleeps on top
  const sq = S.matBounce || 0, lit = S.matGlow > 0;
  X.save(); X.translate(0, 0);
  shadow(46, 452, 62, 7, .25);
  if (lit) { X.globalAlpha = .35 + .2 * Math.sin(T * 9); X.fillStyle = '#5CFF7A'; rr(-22, 400, 130, 56, 22); X.fill(); X.globalAlpha = 1; }
  cel(() => rr(-18, 424 + sq, 112, 28 - sq, 13), '#ffd23f', '#d99a12', 4, 6, 4);
  X.fillStyle = '#ff4d5e'; for (const sx of [10, 46, 82]) { rr(sx - 5, 426 + sq, 10, 24 - sq, 3); X.fill(); }
  glint(2, 431 + sq, 10, 2.6, -.1, .6);
  X.restore();
}
function dalmatian(S, T) {
  const x = 52, y = 426 - Math.max(0, S.matBounce || 0) * .5, res = S.res, look = clamp((S.cx - x) / 300, -1, 1), wag = Math.sin(T * (res === 'win' ? 24 : 7)) * (res === 'lose' ? .05 : .5);
  X.save(); X.translate(x, y);
  X.save(); X.translate(-17, -14); X.rotate(-.6 + wag * .4); rr(-3, -16, 6, 18, 3); ink('#fff', 3); X.restore();
  cel(() => rr(-18, -26, 36, 22, 10), '#fff', '#dcd6e8', 3, 4, 3.5);
  X.fillStyle = INK; for (const [sx, sy, r] of [[-9, -20, 3.2], [3, -16, 2.6], [10, -22, 3]]) { X.beginPath(); X.arc(sx, sy, r, 0, TAU); X.fill(); }
  for (const sx of [-10, 8]) { rr(sx, -8, 7, 10, 3); ink('#fff', 2.5); }
  rr(8, -34, 8, 12, 3); ink('#fff', 2.5);
  cel(() => el(14, -38, 13, 11.5), '#fff', '#dcd6e8', 2, 3, 3.5);
  X.save(); X.translate(5, -42); X.rotate(.25 + (res === 'win' ? Math.sin(T * 14) * .2 : 0)); el(0, 3, 5, 9); ink(INK, 2); X.restore();
  X.fillStyle = INK; X.beginPath(); X.arc(10, -42, 3, 0, TAU); X.fill();
  el(21, -34, 6, 4.4); ink('#fff', 2.5); X.fillStyle = INK; el(24, -35, 2.6, 2); X.fill();
  rr(5, -29, 18, 4, 2); ink('#e8434f', 2);
  if (res === 'lose') { rr(10, -45, 10, 4, 2); ink('#fff', 2.5); line([[10, -42], [18, -42]], 2, INK); }
  else { eyes2(14, -41, 4.3, 2.4, res === 'win' ? 'happy' : 'calm', T); el(14 + look * 2, -41, 0, 0); }
  X.restore();
}

/* ───────────── the scene ───────────── */
function drawItemState(S, it, T) {
  const P = TYPES[it.type], hp = it.hopK > 0 ? Math.sin(Math.PI * it.hopK) * 30 : 0;
  if (it.st === 0) {
    if (S.sNow >= it.tTel) {
      const k = clamp((S.sNow - it.tTel) / (it.tDrop - it.tTel), 0, 1), [wx, wy, ww, wh] = windowRect(it.col, it.row);
      X.save(); rr(wx, wy, ww, wh, 6); X.clip();
      drawVictim(it.type, it.xw + Math.sin(T * 30) * (1 + k * 3), wy + wh - 2, T, { s: .78, mood: it.type === 'walrus' ? 'sleep' : 'scared', rot: Math.sin(T * 24) * .05 * k });
      X.restore();
      bubble(P.tag, it.xw, wy - 12, 14, outBack(clamp((S.sNow - it.tTel) / .2, 0, 1)));
    }
    return;
  }
  if (it.st === 1) {
    const mood = it.type === 'walrus' ? 'sleep' : 'scared';
    drawVictim(it.type, it.x, it.y, T, { mood, rot: it.type === 'granny' ? Math.sin(T * 4) * .16 : it.rot, s: 1, open: it.type === 'granny' });
    if (it.type === 'piano') for (let i = 0; i < 3; i++) { const q = (T * 2 + i / 3) % 1; X.globalAlpha = 1 - q; txt('♪', it.x + 44 + Math.sin(q * 6 + i) * 8, it.y - 70 + q * 30 + i * 10, 18, '#fff'); X.globalAlpha = 1; }
    return;
  }
  if (it.st === 2 || it.st === 3) {
    const sq = it.st === 2 ? clamp(1 - (S.cNow - it.impAt) / .12, 0, 1) * .3 + .7 : 1 + Math.sin(clamp((S.cNow - (it.catAt || 0)) / .4, 0, 1) * Math.PI) * .1;
    const mood = it.st === 2 ? 'dizzy' : (S.res === 'win' ? 'happy' : it.type === 'walrus' ? 'sleep' : 'happy');
    drawVictim(it.type, it.x, it.y - hp, T, { mood: it.st === 2 ? 'dizzy' : mood, sx: 2 - sq, sy: sq, rot: clamp(S.slope, -.6, .6) * (it.st === 3 ? .9 : .3) + Math.sin(T * 10) * .02, open: false });
    return;
  }
  if (it.st === 4) {
    const k = clamp((S.cNow - it.savAt) / .5, 0, 1), x = lerp(it.sx, it.dir ? MXL : MX, ease(k)), y = lerp(it.sy, it.dir ? MYL : MY + 18, ease(k)) - Math.sin(Math.PI * k) * 52;
    if (k < 1) drawVictim(it.type, x, y, T, { mood: 'happy', s: 1 - k * .35, rot: k * 5 * (it.type === 'pizza' ? 1 : .4) });
    return;
  }
  if (it.st === 5) {
    const a = S.cNow - it.splAt, sq = a < .18 ? .45 + .55 * (a / .18) : 1, flat = a < .12 ? 1 - a / .12 * .6 : .52 + Math.min(.12, (a - .12) * .5);
    if (!(a > .12 && it.type === 'pizza' && false)) drawVictim(it.type, it.x, it.y, T, { mood: 'splat', sx: 1.25 - flat * .2 + (1 - sq) * .3, sy: Math.max(.5, flat), rot: it.type === 'granny' ? .3 : 0 });
    if (a < 1.4) for (let i = 0; i < 3; i++) star(it.x + Math.cos(T * 7 + i * 2.1) * 22, it.y - 20 * Math.max(.5, flat) - 26 + Math.sin(T * 7 + i * 2.1) * 6, 7, 3, 5, T * 3 + i, '#FFE14D', 2);
  }
}
function drawScene(S) {
  X = ctx; const T = S.T, n = S.n; S.matBounce = 0;
  for (const it of S.items) if (it.st === 4 && it.dir) { const a = S.cNow - it.savAt - .4; if (a > 0 && a < .5) S.matBounce = Math.max(S.matBounce, Math.sin(a / .5 * Math.PI * 3) * 6 * (1 - a / .5)); }
  if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
  clouds(T); smoke(T, S.res === 'lose'); heli(S, T);
  windowsLive(S, T);
  ambulance(S, T);
  mattress(S, T); dalmatian(S, T);
  for (const it of S.items) if (it.st === 0) drawItemState(S, it, T);
  // falling shadows on the street
  for (const it of S.items) if (it.st === 1 && !it.passed) { const k = clamp((it.y - it.y0) / Math.max(1, (S.landY - it.y0)), 0, 1), r = 8 + k * 22; X.fillStyle = `rgba(20,16,28,${.12 + k * .22})`; el(it.x, 486, r * 1.6, r * .45); X.fill(); }
  // back row first, then the blanket, then the victims on it, then the front row
  const order = [...Array(n).keys()];
  blanketDraw(S);
  for (const it of S.items) if (it.st >= 1) drawItemState(S, it, T);
  for (const i of order) if (!S.SE[i].fr) drawFighter(S, i, T);
  for (const i of order) if (S.SE[i].fr) drawFighter(S, i, T);
  // the corner rings: red when this corner is not up for the next catch, green when it is
  for (const i of order) {
    const taut = S.h[i] >= S.thr, r = 10 + (taut ? Math.sin(T * 10) * 1 : 0);
    X.beginPath(); X.arc(S.px[i], S.py[i], r, 0, TAU); ink(S.cols[i], 3.5);
    if (taut && S.armed) { X.lineWidth = 4; X.strokeStyle = '#5CFF7A'; X.beginPath(); X.arc(S.px[i], S.py[i], r + 6, 0, TAU); X.stroke(); }
  }
  // name tags
  for (const i of order) pill(S.px[i], S.py[i] - 30 - (S.res === 'win' ? Math.abs(Math.sin(T * 9 + i)) * 6 : 0), i === S.me ? 'YOU' : S.names[i], S.cols[i], i !== S.me);
  if (S.armed && S.nlow > 0 && S.eta < 1.05 && !S.res) badge('UP!', S.cx, S.cyL - 52, 22, '#ff4d5e', '#fff', 1 + Math.sin(T * 14) * .06, -.04);
  if (S.ambGlow > 0 && !S.res) badge('TILT!', 640, 340, 20, '#4fd06a', '#fff', 1 + Math.sin(T * 12) * .06, .05);
  if (S.matGlow > 0 && !S.res) badge('TILT!', 60, 360, 20, '#4fd06a', '#fff', 1 + Math.sin(T * 12) * .06, -.05);
}
function drawFighter(S, i, T) {
  const SE = S.SE[i], won = S.res === 'win', lost = S.res === 'lose', hop = won ? Math.abs(Math.sin(T * 9 + i)) * 14 : 0;
  let hx = S.px[i], hy = S.py[i];
  const tip = S.h[i] * 9;
  let hat = null;
  if (won && S.rk > .08) { const k = (S.rk - .08), q = Math.min(k, .8); hat = { x: (i - (S.n - 1) / 2) * 34 * q, y: k < .8 ? -520 * q + 650 * q * q : 0, rot: k < .8 ? (i % 2 ? 1 : -1) * TAU * q / .8 : 0 }; }
  else if (lost && S.rk > .12) { const k = S.rk - .12; hat = { x: (i % 2 ? 1 : -1) * Math.min(26, 60 * k), y: Math.min(9 * SE.u, 700 * k * k), rot: (i % 2 ? 1 : -1) * Math.min(1.6, 5 * k) }; }
  fighter(hx, SE.row - hop - tip * .3, hx, hy - hop, SE.u, S.cols[i], won ? 'happy' : lost ? 'sad' : null, S.tired[i], T, i, hat);
  if (S.tired[i] && !S.res) { sweat(hx + SE.u * 5.5, SE.row - 11 * SE.u, T, i * .3); sweat(hx - SE.u * 5.5, SE.row - 10 * SE.u, T, i * .3 + .5); }
  if (S.bonk && S.bonk[i] > 0) for (let q = 0; q < 3; q++) star(hx + Math.cos(T * 8 + q * 2.1) * 20, SE.row - 15 * SE.u + Math.sin(T * 8 + q * 2.1) * 5, 6, 2.6, 5, T * 3 + q, '#FFE14D', 2);
}
/* the tally sign: six plates, one per victim */
function tally(S) {
  const x0 = 318, y0 = 64, w = 252, h = 40;
  line([[x0 + 30, 58], [x0 + 30, y0 + 2]], 3, '#e6c58c'); line([[x0 + w - 30, 58], [x0 + w - 30, y0 + 2]], 3, '#e6c58c');
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(x0 + 4, y0 + 6, w, h, 12); X.fill();
  rr(x0, y0, w, h, 12); ink('#a5622c', 4); rr(x0 + 3, y0 + 2, w - 6, h - 8, 10); X.fillStyle = '#d9944f'; X.fill(); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x0 + 10, y0 + 5, w - 20, 5, 2.5); X.fill();
  txt('SAVE 3!', x0 + 38, y0 + 19, 13, '#fff', 'center', 56);
  for (let i = 0; i < NITEMS; i++) {
    const it = S.items[i], px = x0 + 82 + i * 28, py = y0 + 18, st = it.st === 4 ? 1 : it.st === 5 ? 2 : 0, pop = st ? outBack(clamp((S.cNow - (st === 1 ? it.savAt : it.splAt)) / .3, 0, 1)) : 1;
    X.save(); X.translate(px, py); X.scale(pop, pop); rr(-11, -12, 22, 24, 6); ink(st === 1 ? '#4fd06a' : st === 2 ? '#ff4d5e' : '#fff6e6', 2.8);
    if (st === 1) { X.fillStyle = '#fff'; X.fillRect(-2.5, -7, 5, 14); X.fillRect(-7, -2.5, 14, 5); }
    else if (st === 2) { line([[-5, -5], [5, 5]], 3.4, '#fff'); line([[5, -5], [-5, 5]], 3.4, '#fff'); }
    else txt(i < NEED ? '' : '', 0, 0, 10, INK);
    X.restore();
  }
}
/* the controls plate (bottom): LIFT + a key cap on desktop */
function plate(S, T, fin, press) {
  const w = 232, h = 34, x = 284, y = 512;
  const word = fin ? (S.res === 'win' ? 'YEAH!' : 'OOPS!') : TOUCH ? 'DRAG' : 'LIFT', dy = press ? 5 : 0;
  rr(x, y + 7, w, h, 20); ink(fin ? '#8f88a6' : '#c99512', 4); rr(x, y + 7 - 7 + dy, w, h, 20); ink(fin ? '#d3cfe0' : '#ffd23f', 4);
  X.fillStyle = 'rgba(255,255,255,.35)'; rr(x + 14, y + 4 + dy, w - 28, 8, 4); X.fill();
  if (TOUCH || fin) txt(word, x + w / 2, y + h / 2 + 2 + dy, 26, INK, 'center', w - 30);
  else { txt(word, x + 58, y + h / 2 + 1 + dy, 24, INK, 'center', 90); keyCap(x + 140, y + h / 2 + 2 + dy, 'MOUSE'); keyCap(x + 200, y + h / 2 + 2 + dy, 'SPACE'); }
}

/* ───────────── the game ───────────── */
function sqBlanket(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles >= 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), SE = SEATS(n), judge = me === 0;
  /* the level: identical on every screen (always the same number of draws) */
  const pianoPos = 2 + Math.floor(R() * 2);
  const pool = ['cat', 'granny', 'pizza', 'walrus', 'fish']; for (let i = 4; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  pool.length = NITEMS - 1; pool.splice(pianoPos, 0, 'piano');
  const cols = [2 + Math.floor(R() * 3)]; for (let i = 1; i < NITEMS; i++) cols.push((cols[i - 1] + 1 + Math.floor(R() * 4)) % 5);
  const rows = Array.from({ length: NITEMS }, () => R() < .5 ? 0 : 1);
  const items = pool.map((type, i) => {
    const P = TYPES[type], tTel = T0 + GAP * i, tDrop = tTel + (P.hv ? TEL_H : TEL), y0 = WROW[rows[i]] + WBOT - 4 + 0;
    return { id: i, type, col: cols[i], row: rows[i], xw: XW[cols[i]], y0: FLOORS_Y[rows[i]] + WBOT - 4, tTel, tDrop, st: 0, x: XW[cols[i]], y: FLOORS_Y[rows[i]] + WBOT - 4, vy: 0, vx: 0, rot: 0, u: 0, vu: 0, impAt: 0, catAt: 0, savAt: 0, splAt: 0, fate: '', passed: false, hopK: 0, heavy: !!P.hv, sx: 0, sy: 0 };
  });
  const colOf = r => (D.byRole[r] || {}).color || PCOL[r], nmOf = r => (D.byRole[r] || {}).name || 'P' + (r + 1);
  /* state. Votes are where each corner wants to be (the corner stands at vote + its seat offset), h how high it is held */
  const vT = Array.from({ length: n }, () => track()), hT = Array.from({ length: n }, () => track()), tiredR = Array(n).fill(0), lastH = Array(n).fill(REST), arr = Array.from({ length: n }, () => []);
  let vote = 400, hMe = REST, tx = 400, th = REST, sta = 1, tired = false, kx = 0, ky = 0, spaceDown = false, sent = -9, lastSent = '', itSent = -9;
  let S = 0, saved = 0, splats = 0, dentA = 0, resAt = -1, bonk = Array(n).fill(0), ambGlow = 0, matGlow = 0;
  const pops = [], bits = [];
  let G = null;
  const vOf = i => i === me ? vote : (vT[i].at() === null ? 400 : vT[i].at()), hOf = i => i === me ? hMe : (hT[i].at() === null ? REST : hT[i].at());
  function geom() {
    const px = [], py = [], h = [];
    for (let i = 0; i < n; i++) { const hh = hOf(i); h.push(hh); px.push(clamp(vOf(i) + SE[i].off, 24, 776)); py.push(SE[i].row - HAND0 - LIFT * hh); }
    let xL = 0, xR = 0, yL = 0, yR = 0, nl = 0, nr = 0, hs = 0;
    for (let i = 0; i < n; i++) { hs += h[i] / n; if (SE[i].side) { xR += px[i]; yR += py[i]; nr++; } else { xL += px[i]; yL += py[i]; nl++; } }
    xL /= nl; yL /= nl; xR /= nr; yR /= nr;
    if (xR - xL < 60) { const m = (xL + xR) / 2; xL = m - 30; xR = m + 30; }
    const cx = (xL + xR) / 2, hw = (xR - xL) / 2, sag = 16 * (1 - hs) + dentA;
    return { px, py, h, xL, xR, yL, yR, cx, hw, sag, slope: (yR - yL) / (xR - xL), hs };
  }
  const surf = (x, gm) => { const u = clamp((x - gm.xL) / (gm.xR - gm.xL), 0, 1); return lerp(gm.yL, gm.yR, u) + gm.sag * Math.sin(Math.PI * u); };
  const groundY = it => GRND + (it.id % 3) * 3;
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 600, vx: 0, vy: 0, r: 4, c: '#fff' }, o)); }

  /* ── my own corner ── */
  function setPtr(p) { tx = clamp(p.x, 24, 776); th = clamp((540 - p.y) / 290, 0, 1); }
  function publish(force) {
    const s = Math.round(vote) + ',' + Math.round(hMe * 100) + ',' + (tired ? 1 : 0);
    if ((s !== lastSent && g.c - sent >= .09) || g.c - sent >= .5 || force) { lastSent = s; sent = g.c; D.send('c', [Math.round(vote), Math.round(hMe * 100), tired ? 1 : 0], true); }
  }
  /* ── the judge's reading of "was every corner up at the landing" ── */
  function tautOK(thr, from) {
    for (let i = 0; i < n; i++) {
      let ok = (i === me ? hMe : lastH[i]) >= thr;
      if (!ok) for (const a of arr[i]) if (a.t >= from && a.h >= thr) { ok = true; break; }
      if (!ok) return false;
    }
    return true;
  }
  /* ── victims ── */
  function impact(it, gm) {
    it.st = 2; it.u = it.x - gm.cx; it.y = surf(it.x, gm); it.impAt = g.c; it.vy = 0; it.fate = '';
    dentA = Math.max(dentA, it.heavy ? 34 : 22); sfx.thud(); snd(it.heavy ? 70 : 150, .18, 'triangle', .1, 0, 60);
    if (it.heavy) { shake(7, .22); noise(.25, .06, 200, 90, 'lowpass'); }
    if (judge) D.send('imp', { id: it.id, u: Math.round(it.u) });
  }
  function toRide(it, u) {
    it.st = 3; it.catAt = g.c; it.hopK = 0; it.vu = 0; if (u !== undefined) it.u = u;
    it.hopStart = g.c; sfx.boing(); sfx.coin(); ring(it.x, it.y, '#fff', 54, .3); pop('CAUGHT!', clamp(it.x, 140, 660), it.y - 90, 26, '#4fd06a', '#fff');
  }
  function sag(it) { it.st = 1; it.passed = true; it.vy = 160; it.vx = 0; it.fate = ''; sfx.miss(); pop('TOO LOW!', clamp(it.x, 140, 660), it.y - 90, 24, '#ff4d5e', '#fff'); snd(200, .3, 'sawtooth', .05, 0, 70); }
  function decide(it, gm) {
    const thr = it.heavy ? THR_H : THR, ok = tautOK(thr, it.impAt - .12) && Math.abs(it.u) <= gm.hw + 8;
    if (ok) { toRide(it, it.u); D.send('cat', { id: it.id, u: Math.round(it.u) }); } else { sag(it); D.send('mis', { id: it.id, x: Math.round(it.x) }); }
  }
  function saveIt(it, left) {
    it.st = 4; it.dir = left ? 1 : 0; it.savAt = g.c; it.sx = it.x; it.sy = it.y; saved++; sfx.coin(); sfx.sparkle(); snd(420, .5, 'sine', .05, 0, 840); ambGlow = 0;
    pop('SAVED!', clamp(it.x, 140, 660), it.y - 90, 28, '#4fd06a', '#fff'); heart(left ? MXL : MX, left ? MYL - 40 : MY - 40, 1.4);
    D.send('sav', { id: it.id, n: saved, d: left ? 1 : 0 }); if (judge && saved >= NEED) g.finish('win');
  }
  function toGround(it) {
    it.st = 5; it.splAt = g.c; it.y = groundY(it); it.vx = 0; splats++; sfx.splat(); sfx.boing(); shake(4, .15); burst(it.x, it.y - 8, '#fff', 8, 180);
    pop(it.vu && it.fate === 'plop' ? 'PLOP!' : 'SPLAT!', clamp(it.x, 140, 660), it.y - 110, 26, '#ff9a4d', '#fff');
    let bi = -1, bd = 36; for (let i = 0; i < n; i++) { const d = Math.abs(S_px(i) - it.x); if (d < bd) { bd = d; bi = i; } } if (bi >= 0) bonk[bi] = 1;
    if (judge) { D.send('spl', { id: it.id, x: Math.round(it.x), n: splats }); if (splats > SPLAT_MAX) g.finish('lose'); }
  }
  const S_px = i => clamp(vOf(i) + SE[i].off, 24, 776);
  const pick = a => a[Math.floor(cr() * a.length)];
  function stepItem(it, dt, gm) {
    const P = TYPES[it.type];
    if (it.st === 0) { if (S >= it.tDrop) { it.st = 1; it.x = it.xw; it.y = it.y0; it.vy = 40; it.vx = 0; sfx.whoosh(false); snd(it.type === 'piano' ? 90 : 520, .35, 'triangle', .05, 0, it.type === 'piano' ? 50 : 200); } return; }
    if (it.st === 1) {
      it.vy += P.g * dt; if (P.vmax && !it.passed) it.vy = Math.min(it.vy, P.vmax); it.y += it.vy * dt; it.x += it.vx * dt; it.rot += (it.vx ? Math.sign(it.vx) : (it.id % 2 ? 1 : -1)) * dt * ROT[it.type];
      if (!it.passed && it.vy > 0 && it.y >= surf(it.x, gm) && it.x > gm.xL - 8 && it.x < gm.xR + 8) impact(it, gm);
      else if (it.y >= groundY(it)) toGround(it);
      return;
    }
    if (it.st === 2) {
      it.x = gm.cx + it.u; it.y = surf(it.x, gm);
      if (judge) { if (g.c - it.impAt >= DEC) decide(it, gm); }
      else if (it.fate === 'cat') toRide(it); else if (it.fate === 'mis') sag(it); else if (g.c - it.impAt > 1.4) sag(it);
      return;
    }
    if (it.st === 3) {
      it.vu += GR * Math.sign(gm.slope) * Math.max(0, Math.abs(gm.slope) - DEAD) * P.m * dt; it.vu *= Math.exp(-FR * dt); it.u += it.vu * dt; it.x = gm.cx + it.u; it.y = surf(it.x, gm);
      it.hopK = clamp((g.c - it.hopStart) / .38, 0, 1); if (it.hopK >= 1) it.hopK = 0;
      if (it.u > gm.hw + 3) {
        if (judge) { if (gm.xR >= XM0) saveIt(it); else { it.st = 1; it.passed = true; it.vx = Math.max(60, it.vu); it.vy = -90; it.fate = 'plop'; it.vu = 1; } }
        else if (it.u > gm.hw + 40) { it.st = 1; it.passed = true; it.vx = Math.max(60, it.vu); it.vy = -90; }
      } else if (it.u < -gm.hw - 3) { if (judge && gm.xL <= XL0) saveIt(it, true); else if (judge || it.u < -gm.hw - 40) { it.st = 1; it.passed = true; it.vx = Math.min(-60, it.vu); it.vy = -90; it.fate = 'plop'; } }
      return;
    }
  }

  const g = {
    c: 0, dur: 16, pts: 0,
    cmd: 'CATCH!', roleLabel: SE[me].name,
    hint: 'MOVE THE MOUSE (OR ◄ ► ▲ ▼) TO MOVE AND LIFT YOUR CORNER - EVERYBODY UP TO CATCH, THEN CARRY AND TILT TO THE AMBULANCE',
    thint: 'DRAG TO MOVE AND LIFT YOUR CORNER - EVERYBODY UP TO CATCH, THEN CARRY AND TILT TO THE AMBULANCE',
    update(dt) {
      g.c += dt; const T = g.c; S += dt * TS; const done = !!g.result;
      if (done && resAt < 0) { resAt = T; if (g.result === 'win') { sfx.coin(); snd(300, .5, 'sawtooth', .05, 0, 900); } else snd(300, .5, 'sawtooth', .06, 0, 80); }
      // my corner chases the pointer / keys
      if (kx || ky || spaceDown) { if (kx) tx = clamp(tx + kx * KEYX * dt, 24, 776); if (spaceDown) th = 1; else if (ky) th = clamp(th + ky * KEYH * dt, 0, 1); }
      if (!done) {
        vote += clamp(tx - vote, -VSPD * dt, VSPD * dt);
        const want = tired ? Math.min(th, TIRED_CAP) : th;
        hMe += clamp(want - hMe, -HSPD * dt, HSPD * dt);
        if (hMe > .55) sta = Math.max(0, sta - DRAIN * dt); else sta = Math.min(1, sta + RECOV * dt);
        if (!tired && sta <= 0) { tired = true; sfx.buzz(); pop('TIRED!', S_px(me), SE[me].row - 80, 22, '#ff9a4d', '#fff'); }
        else if (tired && sta >= .45) tired = false;
        if (tired && hMe > TIRED_CAP + .05) hMe += clamp(TIRED_CAP - hMe, -HSPD * dt, 0);
        publish(false);
      }
      arr[me].push({ t: T, h: hMe }); while (arr[me].length && arr[me][0].t < T - 1.2) arr[me].shift(); lastH[me] = hMe;
      G = geom();
      dentA *= Math.exp(-5 * dt); ambGlow = Math.max(0, ambGlow - dt * 3); matGlow = Math.max(0, matGlow - dt * 3);
      for (let i = 0; i < n; i++) bonk[i] = Math.max(0, bonk[i] - dt * 1.2);
      if (!done || resAt >= 0) {
        for (const it of items) if (!done || it.st === 1) stepItem(it, dt, G);
      }
      // the ambulance lights up while a victim rides and the right edge is in range
      if (items.some(it => it.st === 3)) { if (G.xR >= XM0) ambGlow = 1; if (G.xL <= XL0) matGlow = 1; }
      if (judge && !done) {
        const rides = items.filter(it => it.st === 3);
        if (rides.length && T - itSent >= .1) { itSent = T; D.send('it', rides.map(it => [it.id, Math.round(it.u), Math.round(it.vu)]), true); }
        if (T >= g.limit) g.finish('lose');
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (T - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && T - pops[0].t0 > 1) pops.length = 0;
    },
    msg(type, d, from) {
      if (type === 'c' && Array.isArray(d) && from >= 0 && from < n && from !== me) {
        vT[from].push(d[0]); hT[from].push(d[1] / 100); tiredR[from] = d[2] | 0; lastH[from] = d[1] / 100;
        arr[from].push({ t: g.c, h: d[1] / 100 }); while (arr[from].length > 1 && arr[from][0].t < g.c - 1.2) arr[from].shift();
      } else if (type === 'it' && Array.isArray(d)) { for (const q of d) { const it = items[q[0]]; if (it && it.st === 3) { it.u += (q[1] - it.u) * .5; it.vu = q[2]; } } }
      else if (type === 'imp') { const it = items[d.id]; if (it && it.st <= 1) { it.st = 2; it.u = d.u; it.impAt = g.c; it.fate = ''; dentA = Math.max(dentA, it.heavy ? 34 : 22); sfx.thud(); if (it.heavy) shake(7, .22); } }
      else if (type === 'cat') { const it = items[d.id]; if (it) { it.fate = 'cat'; if (it.st === 2) toRide(it, d.u); else if (it.st <= 1) { it.st = 2; it.u = d.u; toRide(it, d.u); } } }
      else if (type === 'mis') { const it = items[d.id]; if (it) { it.fate = 'mis'; if (it.st === 2) sag(it); } }
      else if (type === 'sav') { const it = items[d.id]; saved = Math.max(saved, d.n); if (it && it.st < 4) { it.st = 4; it.dir = d.d | 0; it.savAt = g.c; it.sx = it.x; it.sy = it.y; sfx.coin(); sfx.sparkle(); ambGlow = 0; matGlow = 0; pop('SAVED!', clamp(it.x, 140, 660), it.y - 90, 28, '#4fd06a', '#fff'); heart(it.dir ? MXL : MX, MY - 40, 1.4); } }
      else if (type === 'spl') { const it = items[d.id]; splats = Math.max(splats, d.n); if (it && it.st < 4) { it.passed = true; if (it.st !== 1) { it.st = 1; it.vy = 0; } it.vx = (d.x - it.x) * 3; it.fate = ''; } }
    },
    draw(T) {
      X = ctx; const gm = G || geom(), res = g.result, rk = resAt >= 0 ? g.c - resAt : -1;
      const px = gm.px.slice(), py = gm.py.slice(), hh = gm.h.slice();
      if (res) for (let i = 0; i < n; i++) { const hv = res === 'win' ? 1 : .08; hh[i] = hv; py[i] = SE[i].row - HAND0 - LIFT * hv; }
      const nextIt = items.filter(it => it.st <= 2 && !it.passed).sort((a, b) => a.tDrop - b.tDrop)[0];
      let eta = 9, thr = THR;
      if (nextIt) { thr = nextIt.heavy ? THR_H : THR; eta = nextIt.st === 2 ? 0 : etaOf(nextIt, gm); }
      const nlow = hh.filter(v => v < thr).length;
      const sc = { n, SE, px, py, h: hh, tired: Array.from({ length: n }, (_, i) => i === me ? tired : !!tiredR[i]), cols: SE.map((_, i) => colOf(i)), names: SE.map((_, i) => nmOf(i)), me, T,
        sag: res ? 18 : gm.sag, items, saved, splats, res, rk, sNow: S, cNow: g.c, thr, armed: !!nextIt && eta < 1.3 && !res, nlow, eta, cx: gm.cx, cyL: Math.min(...py), slope: gm.slope, ambGlow, matGlow, landY: gm.cy, bonk };
      sc.landY = surf(nextIt ? nextIt.xw : gm.cx, gm);
      drawScene(sc);
      // fx bits
      for (const b of bits) { const a = T - b.t0, fade = clamp(1 - a / b.life, 0, 1); X.globalAlpha = fade; X.fillStyle = b.c; X.beginPath(); X.arc(b.x, b.y, b.r, 0, TAU); X.fill(); X.globalAlpha = 1; }
      // my stamina
      if (!res && sta < .995) {                                   // my arm stamina: a ring round my corner that empties while I hold it up
        X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = 'rgba(20,16,28,.55)'; X.beginPath(); X.arc(sc.px[me], sc.py[me], 22, 0, TAU); X.stroke();
        X.lineWidth = 4.5; X.strokeStyle = tired ? '#ff9a4d' : sta < .35 ? '#ffd23f' : '#5CFF7A'; X.beginPath(); X.arc(sc.px[me], sc.py[me], 22, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.02, sta)); X.stroke();
      }
      tally(sc);
      if (rk >= 0) endFx(sc, rk, T);
      plate(sc, T, !!res, hMe > .6 && !res);
      if (g.c < 1.5 && !res) badge('TOGETHER!', 400, 330, 30, '#ffd23f', INK, outBack(g.c / .3) * (1 - clamp((g.c - 1.2) / .3, 0, 1)), -.05);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x, 120, 680), clamp(q.y - Math.min(a, .6) * 14, 176, 520), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      vignette(.14);
    },
    down(p) { setPtr(p); },
    move(p) { setPtr(p); },
    up() {},
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') kx = -1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') kx = 1;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') ky = 1; else if (e.code === 'ArrowDown' || e.code === 'KeyS') ky = -1;
      else if (e.code === 'Space' || e.code === 'Enter') spaceDown = true;
    },
    keyup(e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (kx < 0) kx = 0; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (kx > 0) kx = 0; }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { if (ky > 0) ky = 0; } else if (e.code === 'ArrowDown' || e.code === 'KeyS') { if (ky < 0) ky = 0; }
      else if (e.code === 'Space' || e.code === 'Enter') { if (spaceDown) { spaceDown = false; th = Math.min(th, REST); } }
    },
  };
  /* seconds until a falling victim reaches the blanket (what the countdown ring draws) */
  function etaOf(it, gm) {
    const P = TYPES[it.type]; if (it.st === 0) { const w = Math.max(0, it.tDrop - S) / TS; let y = it.y0, vy = 40, tt = 0; while (tt < 3) { vy += P.g * .02; if (P.vmax) vy = Math.min(vy, P.vmax); y += vy * .02; tt += .02; if (y >= surf(it.xw, gm)) break; } return w + tt / TS; }
    let y = it.y, vy = it.vy, tt = 0; while (tt < 3) { vy += P.g * .02; if (P.vmax) vy = Math.min(vy, P.vmax); y += vy * .02; tt += .02; if (y >= surf(it.x, gm)) break; } return tt / TS;
  }
  /* the win / lose payoff on top of the scene */
  function endFx(sc, rk, T) {
    const win = sc.res === 'win';
    if (win) {
      for (let i = 0; i < 6; i++) { const q = (rk * .9 + i / 6) % 1; X.globalAlpha = 1 - q; heart(MX - 10 + Math.sin(q * 6 + i) * 26 + i * 9, MY - 40 - q * 120, 1.1 + (i % 2) * .4); } X.globalAlpha = 1;
      if (rk > .15) badge(['RESCUED!', 'HEROES!', 'WOOHOO!'][Math.floor(resAt * 7) % 3], 470, 196, 38, '#4fd06a', '#fff', outBack((rk - .15) / .2), -.06);
    } else {
      if (rk > .1) badge(['OOPS!', 'SPLAT!', 'WHOOPS!'][Math.floor(resAt * 7) % 3], 470, 196, 38, '#ff9a4d', '#fff', outBack((rk - .1) / .2), -.06);
      for (let i = 0; i < 4; i++) { const q = (rk * 1.2 + i / 4) % 1; puffC(250 + i * 50, 150 - q * 60, 14 + q * 16, .6 - q * .6); }
    }
  }
  function puffC(x, y, r, a) { X.globalAlpha = Math.max(0, a); X.fillStyle = '#5b5873'; X.strokeStyle = '#3a374d'; X.lineWidth = 3; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); X.stroke(); X.globalAlpha = 1; }
  G = geom();
  g.dbg = {
    /* what this screen shows (the bots only read their own view) */
    view: () => {
      const gm = G || geom(), its = items.filter(it => it.st <= 3).map(it => ({ id: it.id, st: it.st, x: it.x, xw: it.xw, y: it.y, u: it.u, vu: it.vu, heavy: it.heavy, eta: it.st <= 1 && !it.passed ? etaOf(it, gm) : it.st === 2 ? 0 : 9, tel: it.st === 0 && S >= it.tTel, type: it.type }));
      return { n, me, side: SE[me].side, off: SE[me].off, cx: gm.cx, xL: gm.xL, xR: gm.xR, hw: gm.hw, vote, h: hMe, tired, sta, items: its, slope: gm.slope, XM0, XL0, THR, THR_H, REST, saved, splats, ambGlow: ambGlow > 0 };
    },
    fake: (i, v, h) => { if (i === me) return; vT[i].push(v); hT[i].push(h); lastH[i] = h; arr[i].push({ t: g.c, h }); },
    ptr: p => setPtr(p), items,
  };
  wire(g, D, 0, sp, 'sq_blanket');
  return g;
}
reg('sq_blanket', sqBlanket, 'FIRE RESCUE'); REGMAP.sq_blanket.duo = true; REGMAP.sq_blanket.squad = true;

/* ───────────── intro card: the real scene, a 5.6 s loop, cropped around the blanket and the ambulance (520x240) ───────────── */
function demoScene(n, t) {
  const SE = SEATS(n), u = t % 5.6, T = t, k01 = (a, b) => clamp((u - a) / (b - a), 0, 1);
  const up = lerp(REST, 1, ease(k01(.5, 1.2))) * (u < 3.9 ? 1 : 1) , relax = ease(k01(3.9, 4.6)), tiltK = ease(k01(2.6, 3.1)), carry = ease(k01(1.9, 2.8)), back = ease(k01(4.6, 5.5));
  const cxV = lerp(300, 460, carry) - back * 160, px = [], py = [], h = [];
  for (let i = 0; i < n; i++) { const hv = lerp(SE[i].side ? lerp(up, .1, tiltK) : up, REST, relax); h.push(hv); px.push(cxV + SE[i].off); py.push(SE[i].row - HAND0 - LIFT * hv); }
  const L = SE.map((s, i) => s.side ? -1 : i).filter(i => i >= 0), Rr = SE.map((s, i) => s.side ? i : -1).filter(i => i >= 0), av = (a, f) => a.reduce((q, i) => q + f(i), 0) / a.length;
  const xL = av(L, i => px[i]), xR = av(Rr, i => px[i]), yL = av(L, i => py[i]), yR = av(Rr, i => py[i]), cx = (xL + xR) / 2, hw = (xR - xL) / 2;
  const sag = 16 * (1 - av([...Array(n).keys()], i => h[i])) + (u > 1.5 && u < 1.9 ? 22 * (1 - k01(1.5, 1.9)) : 0), surfY = x => { const q = clamp((x - xL) / (xR - xL), 0, 1); return lerp(yL, yR, q) + sag * Math.sin(Math.PI * q); };
  const it = { id: 0, type: 'cat', col: 3, row: 1, xw: 319, y0: FLOORS_Y[1] + WBOT - 4, tTel: 0, tDrop: .5, st: 0, x: 319, y: 0, rot: 0, u: 0, hopK: 0, impAt: 1.5, catAt: 1.9, savAt: 3.4, splAt: 0, passed: false, sx: 0, sy: 0 };
  if (u >= .5 && u < 1.5) { const k = k01(.5, 1.5); it.st = 1; it.x = 319; it.y = lerp(it.y0, surfY(319), k * k); it.rot = k * 2.5; }
  else if (u >= 1.5 && u < 1.9) { it.st = 2; it.u = 319 - cx; it.x = cx + it.u; it.y = surfY(it.x); }
  else if (u >= 1.9 && u < 3.4) { it.st = 3; it.u = (319 - 300) * (1 - carry) * 0 + 19 + ease(k01(2.9, 3.4)) * (hw - 15); it.x = cx + it.u; it.y = surfY(it.x); it.hopK = clamp((u - 1.9) / .38, 0, 1); if (it.hopK >= 1) it.hopK = 0; it.hopStart = 0; }
  else if (u >= 3.4 && u < 4) { it.st = 4; it.sx = cx + hw; it.sy = surfY(cx + hw); }
  else if (u >= 4) it.st = 6;
  const items = [it, ...Array.from({ length: NITEMS - 1 }, (_, i) => ({ id: i + 1, st: 0, tTel: 99, tDrop: 99, col: 0, row: 0, savAt: 0, splAt: 0, type: 'cat' }))];
  if (u >= 3.4) items[0].savAt = 3.4;
  const amb = u > 2.6 && u < 3.4 && xR >= XM0 ? 1 : 0;
  return { n, SE, px, py, h, tired: Array(n).fill(false), cols: PCOL.slice(0, n), names: SE.map((s, i) => 'P' + (i + 1)), me: -1, T, sag, items, saved: u > 3.4 ? 1 : 0, splats: 0, res: null, rk: -1, sNow: u, cNow: u, thr: THR, armed: u > .6 && u < 1.6, nlow: 0, eta: 9, cx, cyL: Math.min(...py), slope: (yR - yL) / (xR - xL), ambGlow: amb, landY: surfY(319), bonk: null };
}
function demoRole(role, n, t) {
  X = ctx; const S = demoScene(n, t), u = t % 5.6, SE = S.SE, ox = 118, oy = 214;
  S.me = role; S.cols[role] = PCOL[role]; S.names[role] = 'YOU'; S.cNow = u;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip(); X.translate(-ox, -oy);
  S.items.forEach(it => { if (it.st === 4) it.savAt = it.savAt; });
  const sNowFix = S.sNow; drawScene(Object.assign(S, { sNow: sNowFix, cNow: u }));
  // the role's own corner: a big ring, the hand cue
  const i = role, hx = S.px[i], hy = S.py[i], pulse = 1 + Math.sin(t * 8) * .08;
  X.lineWidth = 4; X.strokeStyle = '#fff'; X.setLineDash([6, 6]); X.beginPath(); X.arc(hx, hy, 20 * pulse, 0, TAU); X.stroke(); X.setLineDash([]);
  X.restore();
  const word = u < .5 ? 'WAIT...' : u < 1.5 ? 'ALL UP!' : u < 2.4 ? 'CARRY!' : u < 3.4 ? (SE[role].side ? 'DOWN!' : 'STAY UP!') : 'SAVED!';
  badge(word, 400, 24, 20, u < 3.4 ? '#ffd23f' : '#4fd06a', INK, 1, -.03);
  demoFinger(clamp(hx - ox + (SE[role].side ? 38 : -38), 30, 490), clamp(hy - oy - 14, 20, 230), u > .5 && u < 3.6, (u * 2) % 1);
}
DUO.INFO.sq_blanket = n => SEATS(n).map(s => [s.name, 'HOLD YOUR CORNER OF THE BLANKET', 'MOUSE X / Y OR ARROWS + SPACE']);
DUO.DEMOS.sq_blanket = n => SEATS(n).map((s, r) => t => demoRole(r, n, t));

})();
