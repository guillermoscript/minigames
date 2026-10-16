'use strict';
/* ═════════ SQUAD · DIABLOS DE YARE (sq_diablos), 3-4 players, one role each ═════════
   Corpus Christi in the plaza of San Francisco de Yare: the devil dancers (diablos danzantes) have to go out with a freshly painted mask while the drums beat.
   n = 4:  MASK MASTER / MAESTRO MÁSCARA (0, JUDGE)  sees the pattern the mask must wear (a shape on the forehead, another on the chin) and DICTATES it with two
                               buttons (or just says it out loud). The devil has no picture of it.
           PAINTER / PINTOR (1)  sees a blank mask and TRACES the pattern with a finger: free strokes, graded against the template with a generous tolerance.
           DRUMMER / TAMBOR (2)  taps on the beat of the music (a lane of notes slides to the drum). A missed or stray beat costs the devil his step.
           BELLRINGER / CAMPANERO (3)  sees when the devil has to spin (giro) and shakes the bells on time. A giro without bells = the cape tangles.
   n = 3:  the same without the Bellringer (no spins).
   The dance is a fixed clock: beat i at S0 + i*BP (sim seconds, S advances g.c * sqrt(sp)). Win = at the end of the dance (SEND) the mask looks enough like
   the template (q >= PASS) and the devil never lost his step (hp > 0) nor tangled twice. Painting is frozen shortly before the end.
   Everything random comes from mkR() in the constructor (two shape ids), always the same number of draws, identical on every screen.
   Netcode: every role owns its variables, the others render them:
     MASTER (judge)  'say' [slot, shape] (I dictate that slot), 'st' [hp*10, tangles, q%] (the verdict state), 'gj' [giro, ok], 'why' cause, 'end' via wire
     PAINTER         'ink' [[x,y,x,y...], ...] the ABSOLUTE list of simplified strokes (mask coords), resent every .5 s while it changes
     DRUMMER         'ok' [beat, 1] (I hit it), 'drum' 1 (cosmetic), 'sx' 1 (a stray tap)
     BELLRINGER      'bell' [giro] (I rang it on time), 'rg' 1 (cosmetic), 'sx' 1 (a stray ring)
   The Master decides the verdict from what it receives (late reports get GRACE seconds). */
(function () {
const { clamp, mkR, wire, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const S0 = 2, BP = .6, NBEAT = 20, WIN = .2, WINB = .3, GRACE = .8, SEND = 14.5, FREEZE = SEND - 1.3, HP0 = 3, PASS = .7, TOL = 18, MAXS = 10;
const MCX = 400, MCY = 268, MRX = 120, MRY = 148, PXS = 150, HITX = 130, LY = 496, LH = 86;
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const NAMES = ['MASK MASTER', 'MASK PAINTER', 'DRUMMER', 'BELLRINGER'];
const PAL = ['#e8343d', '#2b9ee6', '#ffd23f', '#22c455', '#ff7ab6', '#8a5cf5'];
const CREAM = '#fff3d6', CREAM2 = '#e5cfa0', WOOD = '#b9773f', WOOD2 = '#8f5427', GOLD = '#ffcf33', RED = '#e8343d', RED2 = '#b8283a';

/* the shapes of the mask (relative to a slot centre cy, mask coords), as polylines; a 1-point polyline is a dot */
const SHAPES = [
  { n: 'MASK STRIPES', f: cy => [[[-60, cy - 32], [-60, cy + 32]], [[0, cy - 34], [0, cy + 34]], [[60, cy - 32], [60, cy + 32]]] },
  { n: 'MASK CIRCLE', f: cy => [[[0, cy - 26], [13, cy - 23], [23, cy - 16], [29, cy - 6], [29, cy + 6], [23, cy + 16], [13, cy + 23], [0, cy + 26], [-13, cy + 23], [-23, cy + 16], [-29, cy + 6], [-29, cy - 6], [-23, cy - 16], [-13, cy - 23], [0, cy - 26]]] },
  { n: 'MASK DOTS', f: cy => [[[-56, cy - 14]], [[0, cy + 16]], [[56, cy - 14]]] },
  { n: 'MASK CROSS', f: cy => [[[-54, cy - 33], [54, cy + 33]], [[54, cy - 33], [-54, cy + 33]]] },
];
const SLOTY = [-66, 66], SLOTN = ['MASK TOP', 'MASK BOTTOM'];
function tplLines(tp) { return SHAPES[tp[0]].f(SLOTY[0]).concat(SHAPES[tp[1]].f(SLOTY[1])); }
function samplePts(lines, step) {
  const out = [];
  for (const l of lines) {
    if (l.length === 1) { out.push([l[0][0], l[0][1]]); continue; }
    for (let i = 0; i + 1 < l.length; i++) { const a = l[i], b = l[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / step)); for (let j = 0; j < k; j++) out.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]); }
    out.push([l[l.length - 1][0], l[l.length - 1][1]]);
  }
  return out;
}
function flatToPts(f) { const o = []; for (let i = 0; i + 1 < f.length; i += 2) o.push([f[i], f[i + 1]]); return o; }
function quality(strokes, tplP) {                                  // { cov, prec, q }: how much of the template is covered / how much of the ink lies on it
  const dp = [];
  for (const s of strokes) {
    const p = flatToPts(s); if (p.length === 1) { dp.push(p[0]); continue; }
    for (let i = 0; i + 1 < p.length; i++) { const a = p[i], b = p[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / 8)); for (let j = 0; j < k; j++) dp.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]); }
    if (p.length) dp.push(p[p.length - 1]);
  }
  const near = (a, list) => { for (const b of list) if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= TOL) return true; return false; };
  let qq = 1, cv = 1, pc = 1;                                       // forehead and chin are graded apart: both must look right
  for (const top of [true, false]) {
    const D2 = dp.filter(d => (d[1] < 0) === top), T2 = tplP.filter(d => (d[1] < 0) === top);
    if (!D2.length || !T2.length) return { cov: 0, prec: 0, q: 0 };
    let c = 0; for (const tp of T2) if (near(tp, D2)) c++;
    let pr = 0; for (const d of D2) if (near(d, T2)) pr++;
    const cov = c / T2.length, prec = pr / D2.length; cv = Math.min(cv, cov); pc = Math.min(pc, prec); qq = Math.min(qq, cov, prec);
  }
  return { cov: cv, prec: pc, q: qq };
}
function simplify(pts, eps) {                                       // Douglas-Peucker on [[x,y],...]
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const rec = (a, b) => {
    let md = 0, mi = -1; const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; rec(a, mi); rec(mi, b); }
  };
  rec(0, pts.length - 1); return pts.filter((_, i) => keep[i]);
}
function packStroke(raw) {                                          // raw [[x,y]...] -> flat ints, at most 40 points
  let eps = 3, p = simplify(raw, eps); while (p.length > 40 && eps < 60) { eps *= 1.6; p = simplify(raw, eps); }
  if (p.length === 1 || (p.length === 2 && Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) < 5)) p = [p[0]];
  const f = []; for (const q of p) f.push(Math.round(q[0]), Math.round(q[1])); return f;
}
function cleanInk(d) {                                              // validate a network 'ink' list
  if (!Array.isArray(d)) return null; const out = [];
  for (const s of d.slice(0, 14)) { if (!Array.isArray(s) || !s.length) continue; const f = []; for (let i = 0; i + 1 < s.length && f.length < 100; i += 2) { const x = +s[i], y = +s[i + 1]; if (isFinite(x) && isFinite(y)) f.push(clamp(Math.round(x), -200, 200), clamp(Math.round(y), -200, 200)); } if (f.length) out.push(f); }
  return out;
}

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); build(); X.fillStyle = base; X.fill(); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w + 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 16px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(150, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 13, w, 26, 13); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 10, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 16, INK, 'center', w - 12);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(330, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 330);
  X.restore();
}
function bellIcon(x, y, s, sw, col) {
  X.save(); X.translate(x, y); X.rotate(sw || 0); X.scale(s, s);
  X.beginPath(); X.moveTo(-15, 11); X.quadraticCurveTo(-15, -15, 0, -17); X.quadraticCurveTo(15, -15, 15, 11); X.closePath(); ink(col || GOLD, 3);
  X.fillStyle = 'rgba(255,255,255,.5)'; el(-6, -5, 3, 7, .3); X.fill(); X.beginPath(); X.arc(0, 12, 4.5, 0, TAU); ink('#b8791c', 2); X.restore();
}
function drawShape(id, cx, cy, sc, col, w) {                        // a tiny preview of a shape
  for (const l of SHAPES[id].f(0)) {
    if (l.length === 1) { X.beginPath(); X.arc(cx + l[0][0] * sc, cy + l[0][1] * sc, w * .8, 0, TAU); ink(col, 2); }
    else line(l.map(([a, b]) => [cx + a * sc, cy + b * sc]), w, col);
  }
}
function strokeList(list, col0) {                                   // the painted strokes, in the current (mask) coordinates
  list.forEach((f, i) => {
    const c = PAL[(i + (col0 || 0)) % PAL.length], p = flatToPts(f);
    if (p.length === 1) { X.beginPath(); X.arc(p[0][0], p[0][1], 9, 0, TAU); ink(c, 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(p[0][0] - 3, p[0][1] - 3, 3, 2); X.fill(); }
    else line(p, 9, c);
  });
}
function mask(cx, cy, sc, rot, list, o) {                           // the devil mask with its horns; strokes on top. o.crooked draws it sliding off
  o = o || {}; const ol = clamp(4.5 / sc, 3, 15);
  X.save(); X.translate(cx, cy); X.rotate(rot || 0); X.scale(sc, sc);
  for (const sx of [-1, 1]) {
    X.beginPath(); X.moveTo(sx * 30, -128); X.quadraticCurveTo(sx * 104, -150, sx * 84, -196); X.quadraticCurveTo(sx * 62, -160, sx * 82, -100); X.closePath(); ink(GOLD, ol);
    X.beginPath(); X.moveTo(sx * 74, -138); X.quadraticCurveTo(sx * 126, -118, sx * 122, -158); X.quadraticCurveTo(sx * 106, -128, sx * 90, -112); X.closePath(); ink('#ff8fb1', ol);
  }
  cel(() => el(0, 0, MRX, MRY), CREAM, CREAM2, 10, 16, ol);
  for (const sx of [-1, 1]) { line([[sx * 78, -50], [sx * 18, -30]], 10, '#3a2352'); el(sx * 46, -14, 24, 14, sx * .25); ink('#2b1d3a', ol * .7); X.fillStyle = '#fff'; el(sx * 46 + 5, -17, 6, 4); X.fill(); }
  tri(-12, 8, 12, 8, 0, 26, '#ffb37a', ol * .7);
  rr(-62, 110, 124, 26, 10); ink(RED, ol * .7); X.fillStyle = '#fff'; rr(-54, 114, 108, 15, 5); X.fill();
  for (let i = -3; i <= 3; i++) line([[i * 15, 114], [i * 15, 129]], 2, INK);
  X.save(); el(0, 0, MRX + 6, MRY + 6); X.clip(); strokeList(list || [], 0); X.restore();
  X.restore();
}

/* ───────────── the plaza, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, '#8fd0f0'); g.addColorStop(1, '#ffe3b8'); X.fillStyle = g; X.fillRect(0, 0, W, 260);
  for (const [cx, cy, s] of [[470, 60, 1], [610, 34, .7]]) { X.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, r] of [[-30, 20], [0, 28], [32, 20]]) { X.beginPath(); X.arc(cx + dx * s, cy, r * s, 0, TAU); X.fill(); } }
  // colonial houses on the right
  for (const [hx, hw, hy, c1, c2] of [[520, 110, 120, '#ff9ab0', '#e0708a'], [624, 100, 100, '#ffe14d', '#e5b92e'], [716, 100, 126, '#7ad0ff', '#4a9fd6']]) {
    rr(hx, hy, hw, 260 - hy, 4); ink(c1, 5); X.fillStyle = c2; X.fillRect(hx + hw - 14, hy + 4, 10, 260 - hy - 8);
    X.beginPath(); X.moveTo(hx - 8, hy + 4); X.lineTo(hx + hw + 8, hy + 4); X.lineTo(hx + hw - 4, hy - 26); X.lineTo(hx + 4, hy - 26); X.closePath(); ink('#c45a3a', 4);
    for (let k = 0; k < 4; k++) line([[hx + 8 + k * (hw / 4), hy - 20], [hx + 8 + k * (hw / 4) - 2, hy + 2]], 2, '#a24526');
    for (let w2 = 0; w2 < 2; w2++) { rr(hx + 14 + w2 * (hw - 56), hy + 28, 30, 44, 4); ink('#fff7e6', 3); rr(hx + 19 + w2 * (hw - 56), hy + 33, 20, 34, 3); ink('#3d5a80', 2); }
    rr(hx + hw / 2 - 16, 200, 32, 60, 4); ink('#8a5a3c', 3);
  }
  // the church of San Francisco: nave, pediment, door, bell tower
  rr(30, 92, 220, 168, 4); ink('#fbf0d4', 5); X.fillStyle = '#eadcb4'; X.fillRect(240, 96, 8, 160);
  X.beginPath(); X.moveTo(20, 96); X.lineTo(140, 28); X.lineTo(260, 96); X.closePath(); ink('#fbf0d4', 5);
  X.beginPath(); X.arc(140, 70, 15, 0, TAU); ink('#bfe8ff', 3); line([[140, 55], [140, 85]], 2, INK); line([[125, 70], [155, 70]], 2, INK);
  X.beginPath(); X.moveTo(98, 260); X.lineTo(98, 160); X.arc(140, 160, 42, Math.PI, 0); X.lineTo(182, 260); X.closePath(); ink('#8a3b2b', 5);
  line([[140, 118], [140, 260]], 3, '#5e2418'); X.beginPath(); X.arc(130, 200, 3, 0, TAU); ink(GOLD, 1.5); X.beginPath(); X.arc(150, 200, 3, 0, TAU); ink(GOLD, 1.5);
  for (const wx of [58, 222]) { X.beginPath(); X.moveTo(wx - 14, 150); X.lineTo(wx - 14, 126); X.arc(wx, 126, 14, Math.PI, 0); X.lineTo(wx + 14, 150); X.closePath(); ink('#3d5a80', 3); }
  rr(262, 40, 66, 220, 4); ink('#fbf0d4', 5); rr(272, 62, 46, 66, 3); ink('#2b2d5c', 3);
  X.beginPath(); X.moveTo(272, 128); X.lineTo(272, 78); X.arc(295, 78, 23, Math.PI, 0); X.lineTo(318, 128); X.closePath(); ink('#2b2d5c', 3);
  X.beginPath(); X.moveTo(254, 44); X.lineTo(295, 6); X.lineTo(336, 44); X.closePath(); ink('#c45a3a', 4); line([[295, 6], [295, -8]], 3, INK); line([[287, -2], [303, -2]], 3, INK);
  rr(282, 150, 26, 36, 13); ink('#bfe8ff', 3);
  // plaza floor: cobbles, a stone curb, shade
  X.fillStyle = INK; X.fillRect(0, 252, W, 8);
  g = X.createLinearGradient(0, 260, 0, H); g.addColorStop(0, '#e9d4a8'); g.addColorStop(1, '#c9ab78'); X.fillStyle = g; X.fillRect(0, 260, W, H - 260);
  X.strokeStyle = 'rgba(120,80,40,.3)'; X.lineWidth = 3;
  for (let r = 0; r < 9; r++) { const y = 268 + r * r * 2 + r * 22; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); for (let c = 0; c < 14; c++) { const x = c * 64 + (r % 2) * 32; X.beginPath(); X.moveTo(x, y); X.lineTo(x - (r + 1) * 2, y + 22 + r * 3); X.stroke(); } }
  X.fillStyle = 'rgba(20,16,28,.2)'; el(400, 440, 190, 24); X.fill(); el(640, 404, 90, 14); X.fill();
  // bunting between tower and houses
  for (const [y0, y1, sag] of [[38, 112, 34], [60, 128, 28]]) {
    X.beginPath(); for (let i = 0; i <= 30; i++) { const k = i / 30, x = lerp(330, 520, k), y = lerp(y0, y1, k) + Math.sin(k * Math.PI) * sag; i ? X.lineTo(x, y) : X.moveTo(x, y); } X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
    for (let i = 1; i < 12; i++) { const k = i / 12, x = lerp(330, 520, k), y = lerp(y0, y1, k) + Math.sin(k * Math.PI) * sag; tri(x - 9, y, x + 9, y, x, y + 20, ['#ff4d6d', '#ffe14d', '#4db8ff', '#7ce08a', '#fff'][i % 5], 2); }
  }
  // the wooden bench with the controls
  rr(14, 484, 772, 110, 22); ink(WOOD, 5); X.fillStyle = WOOD2; rr(22, 494, 756, 92, 16); X.fill();
  X.strokeStyle = 'rgba(40,20,5,.35)'; X.lineWidth = 2; for (let i = 1; i < 4; i++) { X.beginPath(); X.moveTo(24, 484 + i * 24); X.lineTo(776, 484 + i * 24); X.stroke(); }
  X.fillStyle = 'rgba(255,255,255,.25)'; rr(30, 490, 740, 8, 4); X.fill();
  X = old; return cv2;
}

function spectator(x, y, T, k, mood, col) {                         // a neighbour watching the dance
  const bob = mood === 'laugh' ? Math.sin(T * 26 + k * 2) * 4 : mood === 'cheer' ? -Math.abs(Math.sin(T * 9 + k)) * 12 : Math.sin(T * 3 + k) * 1.5;
  rr(x - 18, y - 50 + bob, 36, 50, 12); ink(col, 3);
  X.beginPath(); X.arc(x, y - 66 + bob, 17, 0, TAU); ink('#ffd2a8', 3);
  X.beginPath(); X.arc(x, y - 72 + bob, 17, Math.PI, 0); ink(['#3a2352', '#8a5a3c', '#c0392b'][k % 3], 3);
  X.fillStyle = INK; X.beginPath(); X.arc(x - 6, y - 66 + bob, 2.4, 0, TAU); X.arc(x + 6, y - 66 + bob, 2.4, 0, TAU); X.fill();
  if (mood === 'laugh') { X.beginPath(); X.arc(x, y - 58 + bob, 8, 0, Math.PI); ink('#7a1f2e', 1.5); } else if (mood === 'cheer') { X.beginPath(); X.arc(x, y - 59 + bob, 6, 0, Math.PI); ink('#7a1f2e', 1.5); } else line([[x - 5, y - 59 + bob], [x + 5, y - 59 + bob]], 2, INK);
  if (mood === 'cheer') { line([[x - 18, y - 40 + bob], [x - 28, y - 70 + bob]], 6, '#ffd2a8'); line([[x + 18, y - 40 + bob], [x + 28, y - 70 + bob]], 6, '#ffd2a8'); }
}
function kid(x, y, T, hit, k) {                                     // the distracted boy with the popcorn: the whip's victim
  X.save(); X.translate(x, y); if (hit) X.rotate(-clamp(k, 0, 1) * .5 + Math.sin(T * 30) * .05);
  rr(-13, -44, 26, 44, 9); ink('#4db8ff', 3); X.beginPath(); X.arc(0, -58, 15, 0, TAU); ink('#ffd2a8', 3);
  X.beginPath(); X.arc(0, -63, 15, Math.PI, 0); ink('#3a2352', 3);
  if (hit) { line([[-9, -62], [-3, -56]], 2, INK); line([[-3, -62], [-9, -56]], 2, INK); line([[3, -62], [9, -56]], 2, INK); line([[9, -62], [3, -56]], 2, INK); el(0, -48, 4, 6); ink('#7a1f2e', 1.5); }
  else { X.fillStyle = INK; X.beginPath(); X.arc(-5, -61 - 2, 2.4, 0, TAU); X.arc(5, -61 - 2, 2.4, 0, TAU); X.fill(); el(0, -50, 3, 4); ink('#7a1f2e', 1.2); }
  tri(14, -34, 30, -34, 22, -8, '#fff7e6', 2.5); line([[16, -34], [26, -34]], 3, RED);
  X.restore();
  if (hit && k > 0) for (let i = 0; i < 5; i++) { const a = clamp(k, 0, 2) * 1.2, px = x + 22 + (hash(i) - .2) * 60 * a, py = y - 40 - a * 50 + 70 * a * a * hash(i + 3); X.fillStyle = '#fff'; X.beginPath(); X.arc(px, py, 4, 0, TAU); X.fill(); X.lineWidth = 2; X.strokeStyle = INK; X.stroke(); }
}
/* the dancing devil: feet at (x, y); st = { bob, lean, spin (0..1 or -1), tang (0..1 or -1), whip (0..1), fall (0..1), joy }; the head wears the mask being painted */
function devil(x, y, T, st, list, crooked) {
  X.save(); X.translate(x, y + st.bob); X.rotate(st.lean + (st.fall > 0 ? st.fall * 1.25 : 0) + (st.tang > 0 ? Math.sin(st.tang * 9) * .22 * (1 - st.tang * .4) : 0));
  const sx = st.spin >= 0 ? Math.cos(st.spin * TAU) : 1; X.scale(Math.abs(sx) < .06 ? .06 : sx, 1);
  // cape behind
  X.beginPath(); X.moveTo(-34, -118); X.quadraticCurveTo(-96, -62, -76, 0); X.lineTo(76, 0); X.quadraticCurveTo(96, -62, 34, -118); X.closePath(); ink('#d1273a', 5);
  X.save(); X.beginPath(); X.moveTo(-34, -118); X.quadraticCurveTo(-96, -62, -76, 0); X.lineTo(76, 0); X.quadraticCurveTo(96, -62, 34, -118); X.closePath(); X.clip(); X.fillStyle = '#ffd23f'; for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(i * 24 - 5, -4); X.lineTo(i * 24 + 5, -4); X.lineTo(i * 24, -26); X.closePath(); X.fill(); } X.restore();
  line([[0, -100], [0, -60]], 5, '#fff'); line([[-14, -86], [14, -86]], 5, '#fff');
  // legs (striped), boots
  for (const sx2 of [-1, 1]) { const kick = Math.sin(T * 8 + sx2) * 3 * (st.joy || 0); rr(sx2 * 13 - 8, -38, 16, 34 + kick, 6); ink(sx2 > 0 ? '#ffd23f' : '#fff', 3); line([[sx2 * 13 - 8, -22], [sx2 * 13 + 8, -22]], 3, RED); rr(sx2 * 13 - 10, -8 + kick, 20, 10, 5); ink('#2b2d5c', 3); }
  // torso, belt with little bells (cascabeles)
  rr(-30, -122, 60, 90, 16); ink('#e8343d', 4); X.fillStyle = 'rgba(255,255,255,.28)'; rr(-22, -116, 10, 62, 5); X.fill();
  line([[0, -112], [0, -68]], 5, '#fff'); line([[-13, -98], [13, -98]], 5, '#fff');
  line([[-30, -46], [30, -46]], 7, GOLD); for (let i = -2; i <= 2; i++) { X.beginPath(); X.arc(i * 13, -38 + Math.sin(T * 14 + i) * (st.joy ? 2 : .6), 5, 0, TAU); ink(GOLD, 2); }
  // arms: maraca on the left, the whip on the right
  const sw = Math.sin(T * 7) * (st.joy ? 10 : 4);
  line([[-28, -108], [-52, -86 + sw]], 8, '#e8343d'); line([[-52, -86 + sw], [-58, -112 + sw]], 5, '#8a5a3c'); X.beginPath(); X.arc(-58, -122 + sw, 12, 0, TAU); ink('#ffb020', 3); X.fillStyle = 'rgba(255,255,255,.45)'; el(-62, -126 + sw, 3, 5); X.fill();
  const ax = 46, ay = -88 - (st.whip > 0 ? 18 * st.whip : sw * .3); line([[28, -108], [ax, ay]], 8, '#e8343d');
  const restX = 66, restY = -18 + Math.sin(T * 5) * 4, tx = lerp(restX, st.whipX || 110, ease(st.whip)), ty = lerp(restY, (st.whipY || -40), ease(st.whip));
  X.beginPath(); X.moveTo(ax, ay); X.quadraticCurveTo((ax + tx) / 2 + 10, Math.min(ay, ty) - 26 * (1 - st.whip) - 8, tx, ty); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3.5; X.strokeStyle = '#8a5a3c'; X.stroke();
  // head: the mask
  mask(0, -150, .29, crooked ? .55 + Math.sin(T * 6) * .05 : 0, list, {});
  if (st.tang > 0) { for (let i = 0; i < 3; i++) { const a = T * 6 + i * 2.1; X.save(); X.translate(Math.cos(a) * 34, -204 + Math.sin(a) * 8); X.rotate(a); tri(-6, 6, 6, 6, 0, -8, '#ffe14d', 2); X.restore(); } }
  X.restore();
  if (st.tang > 0) { X.save(); X.translate(x, y + st.bob); el(0, -22, 52, 24, st.lean); ink('#d1273a', 4); line([[-40, -30], [40, -14]], 5, '#ffd23f'); line([[-36, -12], [36, -30]], 5, '#ffd23f'); X.restore(); }   // the cape wound round his legs
}

/* ═════════ the game ═════════ */
function sqDiablos(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0, painter = me === 1, drummer = me === 2, belle = me === 3;
  /* the level: identical on every screen (always the same four draws) */
  const t0 = Math.floor(R() * 4), t1 = (t0 + 1 + Math.floor(R() * 3)) % 4, TP = [t0, t1], gj0 = Math.floor(R() * 2), gj1 = Math.floor(R() * 2), gj2 = Math.floor(R() * 2);
  const GT = n === 4 ? [S0 + (4 + gj0) * BP, S0 + (9 + gj1) * BP, S0 + (14 + gj2) * BP] : [];
  const BT = i => S0 + i * BP, tplP = samplePts(tplLines(TP), 10);
  /* state */
  let S = 0, beatI = -1, strokes = [], cur = null, drawing = false, dirty = false, lastInk = -9, inkR = [];
  let hp = HP0, tg = 0, qv = 0, qd = 0, jb = 0, jg = 0, stSig = '', qAt = -9, evalB = 0, cause = 0, resAt = -1, endFx = false;
  const okB = Array(NBEAT).fill(null), beatUsed = Array(NBEAT).fill(false), ringed = GT.map(() => false), gUsed = GT.map(() => false), gjRes = GT.map(() => null);
  const said = [-1, -1], saidAt = [-9, -9], sayBtn = [-9, -9];
  let lastDrum = -9, lastRing = -9, strayAt = -9, hpHit = -9, undoAt = -9;
  const pops = [];
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const shown = () => painter ? (cur && cur.length ? strokes.concat([packStroke(cur)]) : strokes) : inkR;
  /* ── master ── */
  function say(k) {
    if (!judge || g.result) return; saidAt[k] = g.c; said[k] = TP[k]; sayBtn[k] = g.c; D.send('say', [k, TP[k]]);
    snd(520 + k * 160, .09, 'triangle', .07); snd(780 + k * 160, .09, 'triangle', .05, .06);
  }
  /* ── painter ── */
  function inMask(lx, ly) { return lx * lx / ((MRX + 8) * (MRX + 8)) + ly * ly / ((MRY + 8) * (MRY + 8)) <= 1; }
  function endStroke() {
    if (!cur) return; const raw = cur; cur = null; drawing = false;
    if (raw.length && strokes.length < MAXS) strokes.push(packStroke(raw));
    dirty = true; if (g.c - lastInk >= .25) sendInk();
  }
  function sendInk() { lastInk = g.c; dirty = false; D.send('ink', shown()); }
  function undo() { if (!painter || g.result || S >= FREEZE) return; if (cur) { cur = null; drawing = false; } else if (strokes.length) strokes.pop(); else return; undoAt = g.c; dirty = true; snd(300, .06, 'square', .05, 0, 200); }
  /* ── drummer ── */
  function drumTap() {
    if (!drummer || g.result || S < 0) return; lastDrum = g.c; D.send('drum', 1); snd(120, .14, 'sine', .14, 0, 52); noise(.05, .06, 900, 2400, 'bandpass');
    let bi = -1, bd = WIN + 1e-9; for (let i = 0; i < NBEAT; i++) { if (beatUsed[i]) continue; const d = Math.abs(BT(i) - S); if (d < bd) { bd = d; bi = i; } }
    if (bi >= 0) { beatUsed[bi] = true; okB[bi] = true; D.send('ok', [bi, 1]); burst(HITX, LY + LH / 2, '#fff', 4, 120); }
    else { D.send('sx', 1); strayAt = g.c; sfx.miss(); pop('DIABLO OFF THE BEAT!', 400, 450, 20, '#e8343d'); }
  }
  /* ── bellringer ── */
  function ring() {
    if (!belle || g.result || S < 0) return; lastRing = g.c; D.send('rg', 1); snd(1320, .3, 'triangle', .05); snd(1760, .25, 'sine', .04, .04); noise(.12, .05, 3000, 6000, 'highpass');
    let bi = -1, bd = WINB + 1e-9; for (let i = 0; i < GT.length; i++) { if (gUsed[i]) continue; const d = Math.abs(GT[i] - S); if (d < bd) { bd = d; bi = i; } }
    if (bi >= 0) { gUsed[bi] = true; ringed[bi] = true; D.send('bell', [bi]); burst(HITX, LY + LH / 2, GOLD, 6, 160); }
    else { D.send('sx', 1); strayAt = g.c; sfx.miss(); pop('TOO SOON!', 400, 450, 20, '#e8343d'); }
  }
  function judgeSt() {
    const s = Math.round(hp * 10) + ',' + tg + ',' + Math.round(qv * 100); if (s !== stSig) { stSig = s; D.send('st', [Math.round(hp * 10), tg, Math.round(qv * 100)]); }
  }

  const hearTxt = k => said[k] >= 0 ? t(SLOTN[k]) + ' ' + t(SHAPES[said[k]].n) : t(SLOTN[k]) + ' ?';
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['DICTATE!', 'PAINT!', 'DRUM!', 'JINGLE!'][me], roleLabel: NAMES[me],
    hint: judge ? 'TAP (OR PRESS 1 / 2) TO DICTATE THE TWO SHAPES OF THE MASK TO THE PAINTER - THE DEVIL CANNOT SEE THEM'
      : painter ? 'DRAW WITH THE MOUSE THE SHAPES THE MASTER DICTATES - ONE ON THE FOREHEAD, ONE ON THE CHIN (Z = UNDO)'
      : drummer ? 'PRESS ANY KEY / CLICK ON EVERY NOTE THAT REACHES THE DRUM - KEEP THE BEAT OR THE DEVIL LOSES HIS STEP'
      : 'SHAKE THE BELLS (SPACE / CLICK) WHEN A BELL REACHES THE RING - THAT IS THE SPIN',
    thint: judge ? 'TAP THE TWO BUTTONS TO DICTATE THE SHAPES OF THE MASK - THE DEVIL CANNOT SEE THEM'
      : painter ? 'DRAW WITH YOUR FINGER THE SHAPES THE MASTER DICTATES - ONE ON THE FOREHEAD, ONE ON THE CHIN'
      : drummer ? 'TAP ON EVERY NOTE THAT REACHES THE DRUM - KEEP THE BEAT OR THE DEVIL LOSES HIS STEP'
      : 'TAP TO SHAKE THE BELLS WHEN A BELL REACHES THE RING - THAT IS THE SPIN',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      qd += (qv - qd) * Math.min(1, dt * 6);
      if (!g.result) {
        S += dt * TS;
        const bi = Math.floor((S - S0) / BP); if (bi !== beatI) { beatI = bi; if (bi >= 0 && bi < NBEAT) { snd(bi % 2 ? 150 : 110, .09, 'sine', .05, 0, 70); noise(.04, .025, 3500, 6500, 'highpass', .3); } }
        if (painter) {
          if (S >= FREEZE && (cur || drawing)) endStroke();
          if (dirty && g.c - lastInk >= .5) sendInk();
        }
        if (drummer) while (evalB < NBEAT && S >= BT(evalB) + WIN) { const i = evalB++; if (!beatUsed[i]) { okB[i] = false; D.send('ok', [i, 0]); sfx.miss(); pop('MISSED BEAT!', 400, 450, 20, '#e8343d'); } }
        if (judge) {
          let ch = false;
          while (jb < NBEAT && S >= BT(jb) + WIN + GRACE) { if (okB[jb] === true) hp = Math.min(HP0, hp + .25); else { hp -= 1; hpHit = g.c; } jb++; ch = true; }
          while (jg < GT.length && S >= GT[jg] + WINB + GRACE) { const ok = ringed[jg]; if (!ok) tg++; gjRes[jg] = ok; D.send('gj', [jg, ok ? 1 : 0]); jg++; ch = true; }
          if (g.c - qAt > .25) { qAt = g.c; qv = quality(inkR, tplP).q; }
          judgeSt();
          if (hp <= .001) { cause = 1; D.send('why', 1); g.finish('lose'); }
          else if (tg >= 2) { cause = 2; D.send('why', 2); g.finish('lose'); }
          else if (S >= SEND) { qv = quality(inkR, tplP).q; judgeSt(); if (qv >= PASS) g.finish('win'); else { cause = 3; D.send('why', 3); g.finish('lose'); } }
          else if (g.c >= g.limit) { cause = 3; D.send('why', 3); g.finish('lose'); }
        }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); for (let i = 0; i < 5; i++) { snd(1500 + i * 90, .12, 'triangle', .04, .1 + i * .07); noise(.06, .08, 3000, 6000, 'highpass', i * .08); } }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(300, .5, 'sawtooth', .06, 0, 90); noise(.3, .1, 300, 900, 'lowpass'); shake(6, .25); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'say' && Array.isArray(d)) { const k = d[0] | 0, s = d[1] | 0; if (k >= 0 && k < 2 && s >= 0 && s < SHAPES.length) { said[k] = s; saidAt[k] = g.c; snd(520 + k * 160, .09, 'triangle', .06); } }
      else if (type === 'ink') { if (from === 1 && !painter) { const c = cleanInk(d); if (c) inkR = c; } }
      else if (type === 'ok') { if (judge && from === 2 && Array.isArray(d) && d[1] === 1) { const i = d[0] | 0; if (i >= 0 && i < NBEAT) okB[i] = true; } }
      else if (type === 'sx') { if (judge && (from === 2 || from === 3) && !g.result) { hp -= .5; hpHit = g.c; } }
      else if (type === 'bell') { if (Array.isArray(d)) { const j = d[0] | 0; if (from === 3 && j >= 0 && j < ringed.length) { ringed[j] = true; } } }
      else if (type === 'rg') lastRing = g.c;
      else if (type === 'drum') lastDrum = g.c;
      else if (type === 'st') { if (!judge && Array.isArray(d)) { const h2 = d[0] / 10; if (h2 < hp) hpHit = g.c; hp = h2; tg = d[1] | 0; qv = d[2] / 100; } }
      else if (type === 'gj') { if (!judge && Array.isArray(d)) gjRes[d[0] | 0] = !!d[1]; }
      else if (type === 'why') cause = d | 0;
    },
    draw(t0_) {
      X = ctx; const T = g.c, won = g.result === 'win', over = !!g.result, lostG = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
      const list = shown(), ph = (S - S0) / BP, bphase = ph - Math.floor(ph);
      // the church bell (rings with the bellringer)
      { const rg = Math.exp(-(T - lastRing) / .5); bellIcon(295, 94, 1.5, Math.sin(T * 14) * .5 * rg, GOLD); }
      // spectators (left): they laugh when the mask is crooked, cheer when the devil wins
      { const mood = lostG && cause === 3 ? 'laugh' : won ? 'cheer' : null; [[46, 396, '#ff8fb1'], [108, 402, '#7ce08a'], [172, 398, '#c9b6ff']].forEach(([sx, sy, c], i) => spectator(sx, sy, T, i, mood, c)); }
      // the devil
      const gi = GT.findIndex((gt, j) => S >= gt && S < gt + 1.7), dev = { bob: 0, lean: 0, spin: -1, tang: -1, whip: 0, fall: 0, joy: 0, whipX: 110, whipY: -44 };
      let hitKid = -1;
      if (S > 0 && !over) { dev.bob = -Math.abs(Math.sin(Math.PI * (ph < 0 ? 0 : bphase))) * (ph < 0 ? 0 : 9); dev.lean = Math.sin(ph * Math.PI) * .07; }
      if (gi >= 0 && !over) {
        const a = S - GT[gi], good = ringed[gi] || (gjRes[gi] === true), bad = gjRes[gi] === false || (!ringed[gi] && a > WINB + .5);
        if (good || a < WINB + .5) { dev.spin = a < .7 ? clamp(a / .7, 0, 1) : -1; if (good && a >= 0 && a < .7) { dev.joy = 1; } }
        if (bad && !good) { dev.tang = clamp((a - WINB - .5) / .9, 0, 1) || .001; dev.whip = a > WINB + .8 ? 1 : 0; hitKid = a - WINB - .8; }
      }
      if (over) { if (won) { dev.joy = 1; dev.bob = -Math.abs(Math.sin(T * 9)) * 16; dev.spin = (T * 1.6) % 1; } else if (cause === 1) { dev.fall = clamp(rk / .5, 0, 1); } else if (cause === 2) { dev.tang = clamp(rk / .8, 0, 1) || .001; dev.whip = rk > .3 ? 1 : 0; hitKid = rk - .3; } }
      kid(748, 404, T, hitKid > 0, hitKid);
      devil(640, 402, T, dev, list, lostG && cause === 3 && rk > .1);
      // the crew
      const xs = n === 4 ? [95, 215, 585, 705] : [110, 230, 585], mood = won ? 'happy' : lostG ? 'sad' : null;
      for (let r = 0; r < n; r++) {
        const jig = won ? -Math.abs(Math.sin(T * 9 + r)) * 10 : 0, x = xs[r], hk = r === 2 ? Math.exp(-(T - lastDrum) / .1) : r === 3 ? Math.exp(-(T - lastRing) / .15) : 0;
        shadow(x, 454, 26, 6, .22); caos(x, 452 + jig - hk * 3, 2.6, { col: cols(r), mood });
        if (r === 2) { el(x + 30, 436 + hk * 2, 18, 8); ink('#e8d0a0', 3); rr(x + 12, 436, 36, 22, 4); ink('#c98a4b', 3); el(x + 30, 436 + hk * 2, 18, 8); ink('#fff3d6', 3); }
        if (r === 3) bellIcon(x + 26, 432 - hk * 6, .9, Math.sin(T * 40) * .6 * hk);
        if (r === 1) { line([[x + 12, 436], [x + 28, 420]], 5, '#8a5a3c'); X.beginPath(); X.arc(x + 31, 417, 6, 0, TAU); ink(PAL[0], 2); }
        pill(x, 474, r === me ? 'YOU' : name(r), cols(r));
      }
      // the easel and the mask being painted
      rr(MCX - 18, MCY + 110, 36, 130, 6); ink(WOOD, 4); line([[MCX - 70, 440], [MCX + 70, 440]], 8, WOOD);
      mask(MCX, MCY, 1, lostG && cause === 3 ? .12 : 0, list, {});
      // guide line (forehead / chin), the master's ghost template, the painter's cursor
      { X.save(); el(MCX, MCY, MRX - 6, MRY - 6); X.clip(); X.setLineDash([8, 8]); X.strokeStyle = 'rgba(90,60,120,.35)'; X.lineWidth = 2; X.beginPath(); X.moveTo(MCX - MRX, MCY); X.lineTo(MCX + MRX, MCY); X.stroke(); X.setLineDash([]); X.restore(); }
      if (judge && !over) {
        X.save(); X.globalAlpha = .55 + .15 * Math.sin(T * 4); X.translate(MCX, MCY);
        for (const l of tplLines(TP)) { if (l.length === 1) { X.beginPath(); X.arc(l[0][0], l[0][1], 11, 0, TAU); X.lineWidth = 4; X.strokeStyle = '#8a5cf5'; X.setLineDash([5, 5]); X.stroke(); X.setLineDash([]); } else { X.beginPath(); l.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 11; X.lineJoin = 'round'; X.lineCap = 'round'; X.strokeStyle = 'rgba(138,92,245,.75)'; X.stroke(); } }
        X.restore();
      }
      // speech bubbles with what the master said
      for (let k = 0; k < 2; k++) if (said[k] >= 0 && !over && T - saidAt[k] < 3.2) badge(hearTxt(k), 160, 150 + k * 40, 15, '#8a5cf5', '#fff', outBack((T - saidAt[k]) / .2), k ? .03 : -.03);
      // ───── HUD on the houses: resemblance + the devil's steps ─────
      { const hx = 562, hy = 14; rr(hx, hy, 226, 74, 12); ink('#fff7e6', 4);
        txt('LIKENESS', hx + 62, hy + 17, 14, RED2, 'center', 100);
        rr(hx + 12, hy + 28, 202, 16, 8); ink('#3a3550', 2); const fw = (202 - 6) * clamp(qd, 0, 1); if (fw > 3) { rr(hx + 15, hy + 31, fw, 10, 5); X.fillStyle = qd >= PASS ? '#22c455' : '#ffb020'; X.fill(); }
        line([[hx + 12 + 202 * PASS, hy + 24], [hx + 12 + 202 * PASS, hy + 48]], 2, RED2);
        txt(painter ? '???' : Math.round(qd * 100) + '%', hx + 172, hy + 17, 14, INK, 'center', 60);
        txt('STEP', hx + 36, hy + 58, 13, RED2, 'center', 60);
        for (let i = 0; i < HP0; i++) { const on = hp > i + .001, full = hp >= i + 1 - .001; X.globalAlpha = on ? 1 : .3; el(hx + 82 + i * 26, hy + 59, 10, 7); ink(full ? '#e8d0a0' : '#f7c9a0', 2); X.globalAlpha = 1; }
        if (n === 4) for (let i = 0; i < 2; i++) { X.globalAlpha = tg > i ? 1 : .35; bellIcon(hx + 176 + i * 26, hy + 58, .55, 0, tg > i ? '#e8343d' : GOLD); X.globalAlpha = 1; } }
      // ───── the role's own controls on the bench ─────
      if (!over) {
        if (judge) {
          for (let k = 0; k < 2; k++) {
            const r0 = mBtn(k), dn = Math.exp(-(T - sayBtn[k]) / .15), d = dn > .4 ? 3 : 8;
            rr(r0.x, r0.y + 8, r0.w, r0.h, 16); ink('#3a3550', 4); rr(r0.x, r0.y + 8 - d, r0.w, r0.h, 16); ink(said[k] >= 0 && T - saidAt[k] < 1.5 ? '#ffe14d' : '#fff7e6', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(r0.x + 10, r0.y + 12 - d, r0.w - 20, 8, 4); X.fill();
            drawShape(TP[k], r0.x + 52, r0.y + r0.h / 2 + 6 - d, .5, PAL[k * 2], 5);
            txt(SLOTN[k], r0.x + 214, r0.y + 24 - d, 16, INK, 'center', 220); txt(SHAPES[TP[k]].n, r0.x + 214, r0.y + 52 - d, 22, RED2, 'center', 220);
            if (!TOUCH) { rr(r0.x + 8, r0.y + 12 - d, 22, 24, 6); ink('#fff', 2); txt(String(k + 1), r0.x + 19, r0.y + 25 - d, 15, INK); }
          }
        } else if (painter) {
          for (let k = 0; k < 2; k++) {
            const r0 = mBtn(k, 1); rr(r0.x, r0.y, r0.w, r0.h, 16); ink('#fff7e6', 4);
            if (said[k] >= 0) { drawShape(said[k], r0.x + 40, r0.y + r0.h / 2, .42, PAL[k * 2], 4); txt(SLOTN[k], r0.x + 150, r0.y + 19, 13, INK, 'center', 170); txt(SHAPES[said[k]].n, r0.x + 150, r0.y + 44, 20, RED2, 'center', 170); }
            else { txt(SLOTN[k], r0.x + r0.w / 2, r0.y + 21, 14, INK, 'center', 190); txt('LISTEN TO THE MASTER...', r0.x + r0.w / 2, r0.y + 46, 14, '#6c6785', 'center', 200); }
          }
          const u = undoRect(), dn = Math.exp(-(T - undoAt) / .15), d = dn > .4 ? 3 : 7;
          rr(u.x, u.y + 7, u.w, u.h, 16); ink('#3a3550', 4); rr(u.x, u.y + 7 - d, u.w, u.h, 16); ink(strokes.length || cur ? '#ffd23f' : '#d3cfe0', 4); txt('UNDO', u.x + u.w / 2 + 10, u.y + u.h / 2 + 5 - d, 20, INK, 'center', u.w - 50);
          X.beginPath(); X.moveTo(u.x + 22, u.y + 26 - d); X.lineTo(u.x + 22, u.y + 40 - d); X.lineTo(u.x + 36, u.y + 33 - d); X.closePath(); ink('#fff', 2);
          if (S >= FREEZE) badge('PAINT TIME IS OVER!', MCX, MCY + 10, 22, '#e8343d', '#fff', 1, -.03);
        } else lane(T);
      }
      if (!over && T < 2.4) badge(judge ? 'DICTATE THE MASK!' : painter ? 'PAINT WHAT THE MASTER SAYS!' : drummer ? 'KEEP THE BEAT!' : 'RING THE BELLS ON THE SPIN!', 400, 168, 20, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .25), -.03);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      // drawn payoffs
      if (over && rk >= 0) {
        if (won) {
          for (let i = 0; i < 40; i++) { const d = rk - hash(i + 2) * .8; if (d < 0) continue; const fx = 30 + hash(i) * 740 + Math.sin(d * 4 + i) * 14, fy = -20 + d * (190 + hash(i + 7) * 120); if (fy < 600) { X.save(); X.translate(fx, fy); X.rotate(d * 5 + i); X.fillStyle = PAL[i % PAL.length]; X.fillRect(-5, -3, 10, 6); X.lineWidth = 1.5; X.strokeStyle = INK; X.strokeRect(-5, -3, 10, 6); X.restore(); } }
          if (rk > .25) badge('DANCING DEVILS!', 400, 150, 36, '#22a447', '#fff', outBack((rk - .25) / .25), -.04);
        } else {
          const msg = cause === 1 ? 'LOST THE STEP!' : cause === 2 ? 'TANGLED IN HIS CAPE!' : 'WHAT A CROOKED MASK!';
          if (rk > .3) badge(msg, 400, 150, 30, '#e8343d', '#fff', outBack((rk - .3) / .25), .04);
          if (rk > .8 && cause === 3) { badge('HA HA HA!', 110, 300, 22, '#ffb020', '#fff', outBack((rk - .8) / .25), -.08); badge('HA HA HA!', 300, 480, 18, '#ffb020', '#fff', outBack((rk - 1.0) / .25), .06); }
          if (rk > .8 && cause === 2) badge('OUCH!', 700, 330, 26, '#e8343d', '#fff', outBack((rk - .8) / .25), .07);
          if (rk > .8 && cause === 1) badge('OOPS!', 640, 250, 26, '#ffb020', '#fff', outBack((rk - .8) / .25), -.07);
        }
      }
      vignette(.14);
    },
    down(p) {
      if (g.result) return;
      if (judge) { for (let k = 0; k < 2; k++) { const r0 = mBtn(k); if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h + 10) { say(k); return; } } }
      else if (painter) {
        const u = undoRect(); if (p.x >= u.x && p.x <= u.x + u.w && p.y >= u.y && p.y <= u.y + u.h + 8) { undo(); return; }
        if (S >= FREEZE || strokes.length >= MAXS) return; const lx = p.x - MCX, ly = p.y - MCY;
        if (inMask(lx, ly)) { cur = [[Math.round(lx), Math.round(ly)]]; drawing = true; dirty = true; }
      } else if (drummer) drumTap(); else if (belle) ring();
    },
    move(p) {
      if (!painter || !drawing || !cur || g.result) return; const lx = p.x - MCX, ly = p.y - MCY;
      if (!inMask(lx, ly)) { endStroke(); return; } const l = cur[cur.length - 1]; if (Math.hypot(lx - l[0], ly - l[1]) >= 4 && cur.length < 400) { cur.push([Math.round(lx), Math.round(ly)]); dirty = true; }
    },
    up() { if (painter && cur) endStroke(); },
    key(e) {
      if (g.result) return; const c = e.code;
      if (judge) { const v = { Digit1: 0, Numpad1: 0, KeyA: 0, Digit2: 1, Numpad2: 1, KeyS: 1 }[c]; if (v !== undefined) say(v); }
      else if (painter) { if (c === 'KeyZ' || c === 'Backspace') undo(); }
      else if (!e.repeat) { if (drummer) drumTap(); else if (belle) ring(); }
    },
    keyup() {},
  };

  /* ── layout helpers ── */
  function mBtn(k, tight) { return tight ? { x: 30 + k * 262, y: 504, w: 250, h: 66 } : { x: 30 + k * 380, y: 502, w: 360, h: 66 }; }
  function undoRect() { return { x: 580, y: 504, w: 190, h: 66 }; }
  function lane(T) {
    const bell = belle, items = bell ? GT : BT_ALL(), col = cols(me);
    rr(26, LY, 748, LH, 14); ink('#f3e2bf', 4);
    X.save(); rr(26, LY, 748, LH, 14); X.clip(); X.fillStyle = 'rgba(138,90,40,.18)'; for (let q = 0; q < 8; q++) X.fillRect(26, LY + q * 12 + 4, 748, 5);
    const cy = LY + LH / 2;
    items.forEach((tt, i) => {
      const nx = HITX + (tt - S) * PXS; if (nx < 40 || nx > 800) return;
      const usedI = bell ? ringed[i] : beatUsed[i], miss = bell ? gjRes[i] === false : okB[i] === false;
      X.globalAlpha = miss ? .3 : 1;
      if (bell) bellIcon(nx, cy, usedI ? 1.5 : 1.2, usedI ? Math.sin(T * 30) * .3 : 0, usedI ? '#fff' : GOLD);
      else { X.beginPath(); X.arc(nx, cy, usedI ? 20 : 14, 0, TAU); ink(usedI ? '#fff' : RED, 3); if (!usedI) { X.fillStyle = 'rgba(255,255,255,.5)'; el(nx - 4, cy - 5, 4, 3); X.fill(); } }
      X.globalAlpha = 1;
    });
    X.restore();
    const pk = Math.exp(-(T - (bell ? lastRing : lastDrum)) / .15), r = (bell ? 34 : 30) + pk * 8;
    X.beginPath(); X.arc(HITX, cy, r, 0, TAU); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = pk > .3 ? '#fff' : col; X.stroke();
    if (S < S0 + 1.5 && T < 5) badge(bell ? 'SHAKE WHEN THE BELL ARRIVES!' : 'TAP WHEN THE NOTE ARRIVES!', 470, LY - 14, 17, '#22a447', '#fff', 1, -.02);
    if (T - strayAt < .4) { X.globalAlpha = 1 - (T - strayAt) / .4; rr(26, LY, 748, LH, 14); X.fillStyle = 'rgba(232,52,61,.35)'; X.fill(); X.globalAlpha = 1; }
  }
  const BTS = Array.from({ length: NBEAT }, (_, i) => BT(i)); function BT_ALL() { return BTS; }

  g.dbg = {
    view: () => {
      const base = { S, n, me, hp, tg, q: qv };
      if (judge) return Object.assign(base, { tpl: TP.slice(), said: said.map(v => v >= 0) });
      if (painter) return Object.assign(base, { hints: said.slice(), strokes: strokes.length, frozen: S >= FREEZE });
      if (drummer) return Object.assign(base, { notes: BTS.filter((_, i) => !beatUsed[i]) });
      return Object.assign(base, { giros: GT.filter((_, i) => !gUsed[i]) });
    },
    TP, tplP, quality, SHAPES, tplLines, inkR: () => inkR, strokes: () => strokes, MCX, MCY, PASS, getHp: () => hp, getTg: () => tg,
  };
  wire(g, D, 0, sp, 'sq_diablos');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, tm) {
  X = ctx;
  let g2 = X.createLinearGradient(0, 0, 0, 120); g2.addColorStop(0, '#8fd0f0'); g2.addColorStop(1, '#ffe3b8'); X.fillStyle = g2; X.fillRect(0, 0, 520, 120);
  X.fillStyle = '#e9d4a8'; X.fillRect(0, 120, 520, 120); X.fillStyle = INK; X.fillRect(0, 116, 520, 6);
  for (let i = 1; i < 9; i++) tri(i * 56 - 10, 8 + Math.sin(i * .8) * 6, i * 56 + 10, 8 + Math.sin(i * .8) * 6, i * 56, 28 + Math.sin(i * .8) * 6, ['#ff4d6d', '#ffe14d', '#4db8ff', '#7ce08a', '#fff'][i % 5], 2);
  const u = tm % 4, id = Math.floor(tm / 4) % 4;
  if (role === 0) {
    mask(110, 130, .46, 0, [], {}); X.save(); X.translate(110, 130); X.scale(.46, .46); for (const l of SHAPES[id].f(-66)) { if (l.length === 1) { X.beginPath(); X.arc(l[0][0], l[0][1], 11, 0, TAU); X.lineWidth = 5; X.strokeStyle = '#8a5cf5'; X.stroke(); } else { X.beginPath(); l.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineWidth = 12; X.lineCap = 'round'; X.lineJoin = 'round'; X.strokeStyle = 'rgba(138,92,245,.8)'; X.stroke(); } } X.restore();
    const on = u % 2 < 1; rr(250, 150, 240, 60, 16); ink(on ? '#ffe14d' : '#fff7e6', 4); drawShape(id, 290, 182, .5, PAL[0], 5); txt(SLOTN[0], 405, 168, 15, INK, 'center', 160); txt(SHAPES[id].n, 405, 194, 20, RED2, 'center', 160);
    demoFinger(400, 200, u % 1 < .5, (u % 1) * 2); badge('DICTATE THE MASK!', 330, 62, 17, '#22a447', '#fff', 1, -.03);
  } else if (role === 1) {
    const k = clamp((u % 4) / 2.6, 0, 1), lines = SHAPES[id].f(-66), part = []; let tot = 0; for (const l of lines) tot += Math.max(1, l.length - 1);
    let acc = 0; for (const l of lines) { const seg = Math.max(1, l.length - 1), have = clamp(k * tot - acc, 0, seg); acc += seg; if (have > 0) { if (l.length === 1) part.push(flatToPts([l[0][0], l[0][1]]).length ? [l[0][0], l[0][1]] : []); else { const pts = []; for (let i = 0; i < l.length; i++) { if (i <= have) pts.push(l[i]); else if (i - 1 < have) { const f = have - (i - 1); pts.push([lerp(l[i - 1][0], l[i][0], f), lerp(l[i - 1][1], l[i][1], f)]); break; } } part.push(pts.flat()); } } }
    mask(130, 130, .5, 0, part.filter(q => q.length), {});
    const fx = 130 + (part.length && part[part.length - 1].length >= 2 ? part[part.length - 1][part[part.length - 1].length - 2] * .5 : 0), fy = 130 + (part.length && part[part.length - 1].length >= 2 ? part[part.length - 1][part[part.length - 1].length - 1] * .5 : -33);
    demoFinger(fx, fy + 10, true, 1); badge('PAINT WHAT THE MASTER SAYS!', 340, 62, 15, '#2b9ee6', '#fff', 1, -.03);
    rr(270, 140, 230, 58, 14); ink('#fff7e6', 3); drawShape(id, 310, 170, .45, PAL[0], 4); txt(SLOTN[0], 410, 158, 13, INK, 'center', 150); txt(SHAPES[id].n, 410, 182, 19, RED2, 'center', 150);
  } else {
    const bell = role === 3, col = COLS[role];
    rr(14, 140, 492, 88, 14); ink('#f3e2bf', 4); const cy = 184;
    for (let i = 0; i < 8; i++) { const nx = 70 + i * 90 - ((tm * 90) % 90); if (bell) bellIcon(nx, cy, 1.2, 0, GOLD); else { X.beginPath(); X.arc(nx, cy, 14, 0, TAU); ink(RED, 3); } }
    X.beginPath(); X.arc(70, cy, bell ? 32 : 28, 0, TAU); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = col; X.stroke();
    const ph2 = tm % 1; demoFinger(70, 214, ph2 < .2, ph2 * 5);
    caos(450, 108, 2.4, { col }); badge(bell ? 'SHAKE WHEN THE BELL ARRIVES!' : 'TAP WHEN THE NOTE ARRIVES!', 270, 62, 16, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_diablos', sqDiablos, 'DIABLOS DE YARE'); REGMAP.sq_diablos.duo = true; REGMAP.sq_diablos.squad = true;
DUO.INFO.sq_diablos = n => [
  ['MASK MASTER', 'DICTATE THE SHAPES OF THE MASK', 'PRESS 1 / 2 OR TAP A BUTTON'],
  ['MASK PAINTER', 'TRACE THE SHAPES ON THE MASK', 'DRAG / DRAW WITH THE MOUSE OR FINGER'],
  ['DRUMMER', 'KEEP THE BEAT OF THE DANCE', 'TAP / CLICK / ANY KEY ON THE NOTES'],
  ['BELLRINGER', 'SHAKE THE BELLS ON EVERY SPIN', 'TAP / CLICK / SPACE ON THE BELLS'],
].slice(0, n);
DUO.DEMOS.sq_diablos = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
