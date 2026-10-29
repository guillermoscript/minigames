'use strict';
/* ═════════ SQUAD · LLEGÓ EL AGUA (sq_agua), 3-4 players, one role each ═════════
   The water truck (la cisterna) is parked at the kerb and the whole building waits for it. The truck fills the ROOFTOP tank, the rooftop tank feeds
   every floor by gravity through one riser pipe. Nobody can see the whole building but the roof.
   n = 4:  AZOTEA (0, JUDGE)  sees every tank (and the green LINE each one must reach) and the truck's pressure. Taps the MAIN VALVE (on / off) and,
                              by tapping a floor's pad, switches that floor's SIGNAL LAMP between OPEN IT! and SHUT IT!.
           FLOOR 1 / 2 / 3 (1-3)  see ONLY their own tank (no line marked: only the brim and the dry mark) and the pipe pressure. HOLD to open their valve.
                              The lamp on their wall is the only thing that tells them how full the tank must be. Dry tank = open anyway; brim = close anyway.
   n = 3:  the same with two floors.
   The water: the truck pours into the rooftop tank A while the main valve is open (it arrives after ~1.5 s and sputters twice). The pipe pressure is
   sqrt(A). An open floor valve fills its tank at FLOW * HF * pressure (higher floors have less head) and drains A; every tank also leaks (neighbours'
   showers). Win = every tank (roof too) inside its green BAND (from its line up BW) for HOLD s. Lose = a tank overflows, a tap runs dry, or the time runs out.
   Netcode: every role owns its variables, the others render them:
     FLOOR  'v' 0|1 (my valve), 'lv' level*1000 (coalesced), 'sp' (my tank overflowed), 'dr' (my tap ran dry)
     AZOTEA 'st' [A*1000, pressure*1000, main 0|1, truck*1000] (coalesced), 'sig' [floor, 0|1|2] (lamp), 'cz' [cause, floor] just before the verdict
   The judge (role 0) decides the verdict ('end', via wire). The level (lines, start levels, leaks, truck timing) comes from the seeded mkR(), identical
   on every screen whatever n / role (always the same 16 draws). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic only

const FLOW = .12, MAINQ = .3, DRAWQ = .1, ADR = .004, HOLD = .7, BW = .17, BWA = .22;   // BW: how far above its line a tank may be and still count (the green band)
const HF = [1, .9, .8];                                       // head of each floor
const GY = 440, RH = 86;                                      // street level, height of a floor
const AX = 470, WHX = 405, CHX = 470, FWX = 560, LAX = 650;   // roof character / main wheel, floor character / floor wheel / lamp
const TX0 = 296, TW = 86;                                      // floor tank x, width
const RTX = 600, RTW = 130;                                    // roof tank x, width
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const WATER = '#4fc3f7', WATER2 = '#1f93d0';
const NAMES = ['AZOTEA', 'FLOOR 1', 'FLOOR 2', 'FLOOR 3'];
const rowBot = k => GY - 6 - k * RH;
const roofY = nf => rowBot(nf - 1) - RH - 12;

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context while the background is baked) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(120, X.measureText(t(label)).width + 22);
  rr(x - w / 2, y - 12, w, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 9, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 15, INK, 'center', w - 10);
}
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(300, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
  X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 300);
  X.restore();
}
function plate(x, y, w, h, col, dk, down, label, cap, off) {
  const d = down ? 3 : 9;
  rr(x, y + 9, w, h, 16); ink(off ? '#8f88a6' : dk, 4);
  rr(x, y + 9 - d, w, h, 16); ink(off ? '#d3cfe0' : col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, 8, 4); X.fill();
  rr(x, y + 9 - d, w, h, 16); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  const kc = cap && !TOUCH;
  txt(label, x + w / 2 - (kc ? 16 : 0), y + 9 - d + h / 2, 21, '#fff', 'center', w - (kc ? 78 : 24));
  if (kc) { X.font = '700 13px Fredoka, Arial, sans-serif'; const cw = Math.max(24, X.measureText(t(cap)).width + 12); rr(x + w - cw - 8, y + 9 - d + h / 2 - 10, cw, 20, 6); ink('#fff', 2.5); txt(cap, x + w - cw / 2 - 8, y + 9 - d + h / 2 + 1, 12, INK, 'center', cw - 4); }
}
/* a pipe; flowing = water dashes travelling along it */
function pipe(pts, w, flowing, T, rev) {
  line(pts, w, '#c9ced6');
  if (flowing) { X.save(); X.setLineDash([7, 13]); X.lineDashOffset = (rev ? 1 : -1) * T * 60; X.lineCap = 'butt'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = WATER; X.lineWidth = Math.max(2, w - 6); X.stroke(); X.setLineDash([]); X.restore(); }
}
function wheel(x, y, ang, r, col) {
  X.beginPath(); X.arc(x, y, r, 0, TAU); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = col; X.stroke();
  X.save(); X.translate(x, y); X.rotate(ang); for (let i = 0; i < 3; i++) { X.rotate(TAU / 3); line([[0, 0], [r, 0]], 3, col); } X.restore();
  X.beginPath(); X.arc(x, y, 4, 0, TAU); ink('#ffd23f', 2);
}
function gauge(x, y, r, v, T, jit) {                          // the pipe pressure dial
  X.beginPath(); X.arc(x, y, r, 0, TAU); ink('#fff', 3.5);
  X.lineWidth = 4; X.lineCap = 'butt'; for (const [a0, a1, c] of [[-2.4, -1.4, '#ff6b6b'], [-1.4, -.4, '#ffd23f'], [-.4, .7, '#3ddc5f']]) { X.beginPath(); X.arc(x, y, r * .62, a0, a1); X.strokeStyle = c; X.stroke(); }
  const a = lerp(-2.4, .7, clamp(v, 0, 1)) + (jit ? Math.sin(T * 40) * .08 : 0); X.lineCap = 'round'; X.lineWidth = 3; X.strokeStyle = INK; X.beginPath(); X.moveTo(x, y); X.lineTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); X.stroke();
  X.beginPath(); X.arc(x, y, 2.5, 0, TAU); ink(INK, 0);
}
/* a see-through tank. o: line (judge only), hidden (tarp), geyser, T */
function tank(x, y, w, h, L, o) {
  if (o.hidden) {
    rr(x, y, w, h, 10); ink('#8d93ad', 4); X.save(); rr(x, y, w, h, 10); X.clip(); X.strokeStyle = 'rgba(255,255,255,.22)'; X.lineWidth = 5; for (let i = -h; i < w; i += 16) { X.beginPath(); X.moveTo(x + i, y + h); X.lineTo(x + i + h, y); X.stroke(); } X.restore();
    line([[x + 8, y + 3], [x + w - 8, y + 3]], 3, '#5d6385'); txt('?', x + w / 2, y + h / 2 + 1, Math.min(34, h * .6), '#fff'); return;
  }
  const T = o.T, k = clamp(L, 0, 1.02);
  rr(x, y, w, h, 10); ink('#dff3ff', 4);
  X.save(); rr(x + 2, y + 2, w - 4, h - 4, 8); X.clip();
  const wy = y + h - 3 - (h - 6) * Math.min(1, k), wv = Math.sin(T * 6 + x) * 1.6;
  if (k > .01) {
    X.beginPath(); X.moveTo(x, y + h); X.lineTo(x, wy + wv); X.quadraticCurveTo(x + w / 2, wy - wv * 1.8, x + w, wy + wv); X.lineTo(x + w, y + h); X.closePath(); X.fillStyle = WATER; X.fill();
    X.fillStyle = WATER2; X.fillRect(x + w * .66, wy + 2, w, h); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x + 8, wy + wv + 1, w * .3, 3);
  }
  X.restore();
  glint(x + 9, y + h * .3, 3, h * .2, 0, .5);
  // brim (red) and dry mark (hatched red)
  X.fillStyle = '#ff4d5e'; X.fillRect(x + 4, y + 3, w - 8, 5); X.fillStyle = 'rgba(255,77,94,.55)'; X.fillRect(x + 4, y + h - 9, w - 8, 6);
  for (let q = 1; q < 4; q++) { X.strokeStyle = 'rgba(20,16,28,.28)'; X.lineWidth = 1.5; X.beginPath(); X.moveTo(x + w - 14, y + 3 + (h - 6) * q / 4); X.lineTo(x + w - 4, y + 3 + (h - 6) * q / 4); X.stroke(); }
  if (o.line != null) {                                       // the green BAND (Azotea only): from the LINE up to line + band
    const ly = y + h - 3 - (h - 6) * o.line, ty = y + h - 3 - (h - 6) * Math.min(1, o.line + o.band), ok = k >= o.line && k <= o.line + o.band;
    X.save(); X.beginPath(); X.rect(x + 2, ty, w - 4, ly - ty); X.clip(); X.fillStyle = ok ? 'rgba(34,196,85,.45)' : 'rgba(255,225,77,.4)'; X.fillRect(x, ty, w, ly - ty); X.restore();
    X.save(); X.setLineDash([6, 4]); X.lineWidth = 3.5; X.strokeStyle = INK; X.beginPath(); X.moveTo(x - 4, ly); X.lineTo(x + w + 4, ly); X.moveTo(x - 4, ty); X.lineTo(x + w + 4, ty); X.stroke(); X.lineWidth = 2; X.strokeStyle = ok ? '#22c455' : '#ffe14d'; X.stroke(); X.setLineDash([]); X.restore();
    tri(x - 12, ly - 7, x - 12, ly + 7, x - 2, ly, ok ? '#22c455' : '#ffe14d', 2.5);
  }
  if (o.geyser) { for (let q = 0; q < 6; q++) { const u = (T * 1.7 + q * .19) % 1, gx = x + w / 2 + (q - 2.5) * 6 * (1 + u); el(gx, y - u * 48 + u * u * 60, 4, 6); ink(WATER, 2); } }
}

/* ───────────── the street and the building, painted once per floor count ───────────── */
const BGC = {};
function buildBg(nf) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const old = X; X = cv.getContext('2d');
  const RY = roofY(nf), top = rowBot(nf - 1) - RH;
  let gr = X.createLinearGradient(0, 0, 0, 330); gr.addColorStop(0, '#36b0ea'); gr.addColorStop(.55, '#86d8fb'); gr.addColorStop(1, '#d6f7ff'); X.fillStyle = gr; X.fillRect(0, 0, W, H);
  // hillside barrio behind
  X.beginPath(); X.moveTo(0, 300); [[70, 200], [160, 250], [270, 150], [380, 230], [520, 160], [650, 240], [740, 190], [800, 240]].forEach(p => X.lineTo(p[0], p[1])); X.lineTo(800, 460); X.lineTo(0, 460); X.closePath();
  X.fillStyle = '#c9d0fb'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#7b80c6'; X.stroke();
  const HC = ['#ffb347', '#ff7a8a', '#7fd3ff', '#ffe066', '#b6e388', '#f49ac2', '#c9b6ff'];
  for (let i = 0; i < 26; i++) { const hx = 8 + i * 31 + hash(i) * 8, hy = 250 + hash(i + 40) * 70 - Math.abs(Math.sin(i * .7)) * 50; rr(hx, hy, 22, 18, 3); ink(HC[i % 7], 2.5); X.fillStyle = INK; X.fillRect(hx + 8, hy + 8, 6, 10); }
  // the street
  X.fillStyle = '#d8cfc0'; X.fillRect(0, GY, W, 22); X.fillStyle = INK; X.fillRect(0, GY - 2, W, 5);
  X.fillStyle = '#6a6779'; X.fillRect(0, GY + 22, W, 80); X.fillStyle = '#ffd23f'; for (let x = 10; x < W; x += 70) X.fillRect(x, GY + 56, 38, 5);
  X.fillStyle = INK; X.fillRect(0, GY + 20, W, 4);
  gr = X.createLinearGradient(0, GY + 100, 0, H); gr.addColorStop(0, '#d8cfc0'); gr.addColorStop(1, '#bfb4a0'); X.fillStyle = gr; X.fillRect(0, GY + 102, W, H);
  X.fillStyle = INK; X.fillRect(0, GY + 100, W, 4);
  // the neighbour on the left: a lower block with tenants at the windows
  const NT = RY + 30;
  rr(8, NT, 222, GY - NT, 6); ink('#ffb69a', 4);
  X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(14, NT + 8, 8, GY - NT - 14);
  rr(2, NT - 10, 234, 14, 4); ink('#c9ced6', 3.5);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const wx = 24 + c * 66, wy = NT + 22 + r * 62; if (wy + 40 > GY - 6) continue;
    rr(wx, wy, 44, 40, 5); ink('#bfeaff', 3); X.strokeStyle = '#d9944f'; X.lineWidth = 3; X.beginPath(); X.moveTo(wx + 22, wy); X.lineTo(wx + 22, wy + 40); X.stroke();
    if ((r + c) % 3 === 1) { X.beginPath(); X.arc(wx + 14, wy + 26, 8, 0, TAU); ink(['#ffd2a8', '#e8b48a', '#f6c9a0'][(r + c) % 3], 2); X.fillStyle = INK; X.fillRect(wx + 10, wy + 24, 2.5, 3); X.fillRect(wx + 16, wy + 24, 2.5, 3); }
  }
  // the apartment building
  rr(268, top - 12, 508, GY - top + 12 + 6, 6); ink('#ffe0a8', 5);
  for (let k = 0; k < nf; k++) {
    const rb = rowBot(k), rt = rb - RH;
    X.fillStyle = k % 2 ? '#ffe9bf' : '#ffe0a8'; X.fillRect(274, rt, 496, RH);
    X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 278; x < 768; x += 26) X.fillRect(x, rt, 8, RH);
    X.fillStyle = 'rgba(255,120,150,.4)'; for (let y = rt + 14; y < rb - 6; y += 30) for (let x = 292 + (((y - rt) / 30) & 1) * 13; x < 768; x += 26) { X.beginPath(); X.arc(x, y, 2.4, 0, TAU); X.fill(); }
    X.fillStyle = '#e6c68a'; X.fillRect(274, rb - 8, 496, 8); X.fillStyle = INK; X.fillRect(274, rb - 1, 496, 4);
  }
  rr(262, RY - 2, 518, 18, 4); ink('#ff7a8a', 4);                     // roof slab
  X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(270, RY + 2, 500, 3);
  // parapet and antenna
  rr(262, RY - 14, 18, 14, 3); ink('#c9ced6', 3); rr(762, RY - 14, 18, 14, 3); ink('#c9ced6', 3);
  line([[300, RY - 2], [300, RY - 40]], 3, '#8f9cb3'); line([[288, RY - 32], [312, RY - 32]], 3, '#8f9cb3'); line([[292, RY - 24], [308, RY - 24]], 3, '#8f9cb3');
  // the truck's connection pipe up the left wall, and the roof run to the tank
  X.fillStyle = INK; X.fillRect(256, GY - 24, 14, 24);
  // the riser behind the rooms
  X = old; return cv;
}

/* ═════════ the game ═════════ */
function sqAgua(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, nf = n - 1, me = D.role, TS = Math.sqrt(sp), judge = me === 0, fl = me - 1;
  /* the level: identical on every screen whatever n / role (always the same 16 draws) */
  const LINE = [0, 1, 2].map(() => .44 + R() * .2), LINEA = .5 + R() * .14;
  const L0 = [0, 1, 2].map(() => .2 + R() * .14), A0 = .28 + R() * .1;
  const LEAK = [0, 1, 2].map(() => .013 + R() * .009), ARR = 1.2 + R() * .5;
  const DIP = [0, 1].map(k => ({ at: 4.2 + k * 3.6 + R() * 2.2, d: .25 + R() * .2 })), RY = roofY(nf);
  const truckP = s => { if (s < ARR) return 0; let v = Math.min(1, (s - ARR) / .5); for (const d of DIP) v *= 1 - (1 - d.d) * Math.exp(-Math.pow((s - d.at) / .55, 2)); return v; };
  /* state */
  let S = 0, L = L0[Math.max(0, fl)], open = false, ptrOn = false, keyOn = false, spilled = false, dryD = false, lvAt = -9, stAt = -9, tapAt = -9, ringAt = -9, wheelA = 0;
  let A = A0, pr = Math.sqrt(A0), mainOn = false, tp = 0, holdT = 0, resAt = -1, endFx = false, cause = [1, 0], mainAt = -9, snd0 = -9;
  const sig = [0, 0, 0], vOpen = [0, 0, 0], sigAt = [-9, -9, -9], dispL = [L0[0], L0[1], L0[2]];
  const lvT = [track(), track(), track()], PT = track(), TPT = track();
  const pops = [];
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  function pop(s, x, y, size, bgc) { pops.push({ s, x, y, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const prNow = () => judge ? pr : (PT.at() === null ? .35 : PT.at());
  const lvOf = i => lvT[i].at() === null ? L0[i] : lvT[i].at();
  function toggleMain() {
    if (!judge || g.result) return; mainOn = !mainOn; mainAt = g.c; snd(mainOn ? 330 : 240, .1, 'triangle', .06, 0, mainOn ? 520 : 160); noise(.18, .05, 600, 1800, 'bandpass'); publishSt(true);
  }
  function callFloor(k) {
    if (!judge || g.result || k < 0 || k >= nf) return; sig[k] = sig[k] === 1 ? 2 : 1; sigAt[k] = g.c; D.send('sig', [k, sig[k]]);
    snd(sig[k] === 1 ? 760 : 420, .1, 'triangle', .06); snd(sig[k] === 1 ? 990 : 330, .1, 'triangle', .05, .07);
  }
  function publishSt(force) {
    if (!force && g.c - stAt < .1) return; stAt = g.c;
    D.send('st', [Math.round(A * 1000), Math.round(pr * 1000), mainOn ? 1 : 0, Math.round(tp * 1000)], !force);
  }
  function setOpen(v) {
    if (judge || g.result || v === open) return; open = v; D.send('v', v ? 1 : 0);
    if (v) { snd(300, .1, 'triangle', .06, 0, 480); noise(.3, .05, 500, 1500, 'bandpass'); } else snd(260, .08, 'triangle', .05, 0, 150);
  }
  function lose(code, f) { if (g.result) return; cause = [code, f]; D.send('cz', cause); g.finish('lose'); }
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: judge ? 'WATER TRUCK!' : 'OPEN UP!', roleLabel: NAMES[me],
    hint: judge ? 'SPACE = MAIN VALVE ON / OFF - 1 / 2 / 3 = SWITCH A FLOOR LAMP OPEN / CLOSE - KEEP EVERY TANK INSIDE ITS GREEN BAND, NEVER OVERFLOW'
      : 'HOLD SPACE (OR CLICK) TO OPEN YOUR VALVE WHEN THE LAMP SAYS OPEN - DRY TANK: OPEN ANYWAY - BRIM: CLOSE ANYWAY',
    thint: judge ? 'TAP THE MAIN VALVE, TAP A FLOOR TO SWITCH ITS LAMP OPEN / CLOSE - KEEP EVERY TANK INSIDE ITS GREEN BAND, NEVER OVERFLOW'
      : 'HOLD THE BUTTON TO OPEN YOUR VALVE WHEN THE LAMP SAYS OPEN - DRY TANK: OPEN ANYWAY - BRIM: CLOSE ANYWAY',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      for (let i = 0; i < 3; i++) dispL[i] += (lvOf(i) - dispL[i]) * Math.min(1, dt * 8);
      if (!g.result) {
        const ds = dt * TS; S += ds;
        if (judge) {
          tp = truckP(S);
          const draw = (vOpen[0] + vOpen[1] + vOpen[2]) * DRAWQ * pr;
          A = clamp(A + ((mainOn ? MAINQ * tp : 0) - draw - ADR) * ds, 0, 1.2);
          pr = Math.sqrt(clamp(A, 0, 1));
          publishSt(false);
          if (A >= 1) lose(4, 0);
          else {
            let ok = A >= LINEA && A <= LINEA + BWA; for (let i = 0; i < nf; i++) { const l = lvT[i].at(0), q = l === null ? L0[i] : l; if (q < LINE[i] || q > LINE[i] + BW) ok = false; }
            holdT = ok ? holdT + ds : 0; if (holdT >= HOLD) g.finish('win');
            else if (g.c >= g.limit) lose(1, 0);
          }
        } else {
          const gain = open ? FLOW * HF[fl] * prNow() : 0;
          L = clamp(L + (gain - LEAK[fl]) * ds, 0, 1);
          if (open && gain > .004 && g.c - snd0 > .3) { snd0 = g.c; noise(.12, .025, 700, 2000, 'bandpass'); }
          if (open) wheelA += dt * 9;
          if (g.c - lvAt >= .1) { lvAt = g.c; D.send('lv', Math.round(L * 1000), true); }
          if (L >= .999 && !spilled) { spilled = true; D.send('sp', 1); pop('OVERFLOW!', 400, 150, 22, '#e8343d'); sfx.miss(); }
          if (L <= .001 && S > .4 && !dryD) { dryD = true; D.send('dr', 1); pop('DRY TAP!', 400, 150, 22, '#e8343d'); sfx.miss(); }
        }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); noise(.7, .08, 800, 3000, 'bandpass'); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(330, .5, 'sawtooth', .05, 0, 110); noise(.6, .09, 600, 2400, 'bandpass', .35); shake(5, .2); }
      while (pops.length && g.c - pops[0].t0 > 1.1) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'v' && judge && from >= 1 && from <= 3) vOpen[from - 1] = d ? 1 : 0;
      else if (type === 'lv' && judge && from >= 1 && from <= 3) lvT[from - 1].push(d / 1000);
      else if (type === 'sp' && judge && from >= 1 && from <= 3) lose(2, from - 1);
      else if (type === 'dr' && judge && from >= 1 && from <= 3) lose(3, from - 1);
      else if (type === 'st' && from === 0 && !judge && Array.isArray(d)) { PT.push(d[1] / 1000); TPT.push(d[3] / 1000); }
      else if (type === 'sig' && from === 0 && !judge && Array.isArray(d)) { sig[d[0]] = d[1]; sigAt[d[0]] = g.c; if (d[0] === fl) { snd(d[1] === 1 ? 760 : 420, .1, 'triangle', .06); snd(d[1] === 1 ? 990 : 330, .1, 'triangle', .05, .07); } }
      else if (type === 'cz' && from === 0 && !judge && Array.isArray(d)) cause = d;
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (!BGC[nf]) BGC[nf] = buildBg(nf);
      const top = rowBot(nf - 1) - RH;
      // sky life: the sun, clouds
      X.drawImage(BGC[nf], 0, 0);
      // sun and clouds live above the building (the sky is baked, so they are painted over it, clipped to the sky above the roof)
      X.save(); X.beginPath(); X.rect(-OX, 0, W + OX * 2, top - 14); X.clip();
      X.save(); X.translate(350, 84); X.rotate(T * .25); X.fillStyle = 'rgba(255,240,150,.45)';
      for (let i = 0; i < 10; i++) { X.rotate(TAU / 10); X.beginPath(); X.moveTo(-7, 30); X.lineTo(7, 30); X.lineTo(0, 52); X.fill(); }
      X.restore();
      X.beginPath(); X.arc(350, 84, 24, 0, TAU); ink('#ffe14d', 4); glint(343, 77, 8, 5, -.6, .7);
      for (const [sx, sy, sc, spd] of [[40, 120, .8, 9], [330, 100, .6, 5], [640, 70, .65, 7]]) {
        const cx = ((T * spd + sx) % 1000) - 140;
        X.save(); X.translate(cx, sy); X.scale(sc, sc); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
        for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
        for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
        for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
      }
      X.restore();
      drawLive(T, won, lost, rk);
    },
    down(p) {
      if (g.result) return;
      if (judge) {
        if (p.y >= 494) { const m = nf + 1, pw = (760 - (m - 1) * 12) / m, idx = clamp(Math.floor((p.x - 20) / (pw + 12)), 0, m - 1); if (idx === 0) toggleMain(); else callFloor(idx - 1); }
        else if (Math.hypot(p.x - WHX, p.y - (RY - 22)) < 56) toggleMain();
      } else { ptrOn = true; setOpen(true); }
    },
    move() {},
    up() { ptrOn = false; if (!keyOn) setOpen(false); },
    key(e) {
      if (g.result) return;
      if (judge) {
        if (e.repeat) return;
        const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2, KeyA: 0, KeyS: 1, KeyD: 2 }[e.code];
        if (e.code === 'Space' || e.code === 'Enter') toggleMain(); else if (k !== undefined) callFloor(k);
      } else if (!e.repeat) { keyOn = true; setOpen(true); }
    },
    keyup() { if (judge) return; keyOn = false; if (!ptrOn) setOpen(false); },
  };

  /* ── drawing ── */
  function seesFloor(i) { return judge || i === fl; }
  function floorL(i) { return judge ? dispL[i] : L; }
  function drawLive(T, won, lost, rk) {
    const pw = prNow(), flowMain = judge && mainOn && tp > .05, ARRk = clamp(S / ARR, 0, 1);
    // truck, parked at the kerb (drives in during the first second), with the hose to the building
    const txo = -270 * (1 - ease(ARRk)), tb = Math.sin(T * 20) * (ARRk < 1 ? 1.4 : .6), tx = 24 + txo;
    X.save(); X.translate(0, tb);
    rr(tx + 84, GY - 56, 142, 66, 20); ink('#2d7fe6', 4);
    X.save(); rr(tx + 84, GY - 56, 142, 66, 20); X.clip(); X.fillStyle = '#1f5fb8'; X.fillRect(tx + 84, GY - 14, 142, 30); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(tx + 92, GY - 50, 6, 50); X.fillStyle = '#ffd23f'; X.fillRect(tx + 84, GY - 36, 142, 6); X.restore();
    txt('CISTERNA', tx + 155, GY - 22, 17, '#fff', 'center', 112);
    rr(tx + 14, GY - 44, 74, 54, 12); ink('#e8434f', 4); rr(tx + 22, GY - 38, 34, 22, 5); ink('#bfeaff', 3);
    caos(tx + 40, GY - 20, 1.6, { col: '#ffb347' }); X.fillStyle = '#e8343d'; X.beginPath(); X.moveTo(tx + 31, GY - 33); X.lineTo(tx + 49, GY - 33); X.lineTo(tx + 40, GY - 42); X.fill();
    for (const wx of [tx + 40, tx + 118, tx + 190]) { X.beginPath(); X.arc(wx, GY + 12, 15, 0, TAU); ink('#3b3550', 3.5); X.beginPath(); X.arc(wx, GY + 12, 6, 0, TAU); ink('#c9ced6', 2); }
    X.restore();
    if (ARRk < 1 && Math.floor(T * 6) % 2 === 0) { X.fillStyle = 'rgba(120,110,130,.6)'; for (let q = 0; q < 3; q++) { const k = (T * 1.3 + q * .33) % 1; X.beginPath(); X.arc(tx + 230 + k * 10, GY - 20 - k * 22, 4 + k * 5, 0, TAU); X.fill(); } }
    // hose truck -> pipe, riser along the wall, run along the roof to the rooftop tank
    const mainPts = [[266, GY - 6], [266, RY - 22], [RTX, RY - 22]];
    if (ARRk >= 1) line([[tx + 226, GY - 10], [tx + 244, GY + 4], [266, GY - 2]], 8, '#3fa64a');
    pipe(mainPts, 12, flowMain, T);
    // rooftop: tank, main wheel, clothesline, neighbours' dripping hose, Azotea
    const roofTank = () => {
      const geys = lost && rk >= 0 && cause[0] === 4 || (judge && A >= .985);
      tank(RTX, RY - 92, RTW, 90, judge ? A : 0, { line: judge ? LINEA : null, band: BWA, hidden: !judge, T, geyser: geys });
      if (judge) txt('AZOTEA', RTX + RTW / 2, RY - 104, 15, '#fff', 'center', 110);
    };
    roofTank();
    const mAng = T * (mainOn && judge ? 6 : 0) + (mainAt > 0 ? (g.c - mainAt < .3 ? (g.c - mainAt) * 8 : 2.4) : 0);
    line([[WHX, RY - 22], [WHX, RY - 6]], 8, '#c9ced6'); wheel(WHX, RY - 30, mAng, 15, '#e8434f');
    line([[512, RY - 4], [512, RY - 42]], 3, '#8f9cb3'); line([[512, RY - 40], [590, RY - 34]], 2, '#8f9cb3');
    for (let q = 0; q < 3; q++) { const cx = 526 + q * 22, sw = Math.sin(T * 2.4 + q) * 2; rr(cx - 7 + sw, RY - 38 + q * 1.5, 14, 20, 3); ink(['#ff7ab6', '#ffe14d', '#7fd8ff'][q], 2); }
    // the building: rooms
    for (let k = 0; k < nf; k++) drawRoom(k, T, won, lost, rk);
    // riser from the roof tank down behind the rooms (drawn over the rooms' right edge)
    const flowRiser = pw > .08 && !g.result; pipe([[716, RY - 4], [716, rowBot(0) - 32]], 10, flowRiser, T);
    for (let k = 0; k < nf; k++) drawBranch(k, T);
    // Azotea (the lead)
    drawAzotea(T, won, lost, rk);
    // neighbour's hose (the gag) and the neighbour
    drawNeighbour(T, won, lost, rk);
    // gauge near the truck connection (Azotea only): the truck's pressure
    if (judge) { gauge(250, GY - 90, 18, tp, T, tp < .5 && S > ARR); txt('TRUCK', 250, GY - 62, 13, '#fff', 'center', 56); }
    // controls
    if (!g.result) {
      if (judge) {
        const m = nf + 1, pw2 = (760 - (m - 1) * 12) / m;
        plate(20, 494, pw2, 40, mainOn ? '#4fd06a' : '#ff4d5e', mainOn ? '#24803a' : '#b8283a', g.c - mainAt < .12, mainOn ? 'MAIN: ON' : 'MAIN: OFF', 'SPACE');
        for (let k = 0; k < nf; k++) { const st = sig[k]; plate(20 + (k + 1) * (pw2 + 12), 494, pw2, 40, st === 1 ? '#4fd06a' : st === 2 ? '#ff4d5e' : '#6EA8FE', st === 1 ? '#24803a' : st === 2 ? '#b8283a' : '#3f6fc0', g.c - sigAt[k] < .12, ['FLOOR 1', 'FLOOR 2', 'FLOOR 3'][k], String(k + 1)); }
      } else plate(190, 494, 420, 40, open ? '#5CFF7A' : '#ffd23f', open ? '#23a046' : '#c99512', open, open ? 'OPEN IT!' : 'HOLD TO OPEN', 'SPACE');
    }
    // payoffs
    if (won && rk >= 0) {
      const k = ease(rk / .6);
      for (let q = 0; q < 6; q++) { X.beginPath(); X.arc(500, RY + 20, 280 - q * 11, Math.PI, Math.PI + Math.PI * k); X.lineWidth = 11; X.strokeStyle = ['#ff4d5e', '#ff9a2e', '#ffe14d', '#5CFF7A', '#4fc3f7', '#b18cff'][q]; X.globalAlpha = .75; X.stroke(); X.globalAlpha = 1; }
      if (rk > .2) badge('THE WATER IS HERE!', 470, 92, 28, '#22a447', '#fff', outBack((rk - .2) / .25), -.03);
    }
    if (lost && rk > .35) badge(cause[0] === 2 || cause[0] === 4 ? 'OVERFLOW!' : cause[0] === 3 ? 'DRY TAP!' : 'NO WATER!', 470, 92, 28, '#e8343d', '#fff', outBack((rk - .35) / .25), .04);
    if (!g.result && g.c < 2.6) badge(judge ? 'FILL EVERY TANK!' : 'FOLLOW THE LAMP!', 470, 92, 22, '#2b9ee6', '#fff', outBack(g.c / .3), -.03);
    for (const q of pops) { const aa = g.c - q.t0; badge(q.s, q.x, q.y - aa * 18, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
    vignette(.14);
  }
  function drawRoom(k, T, won, lost, rk) {
    const rb = rowBot(k), rt = rb - RH, see = seesFloor(k), x = CHX, feet = rb - 8, hero = k === fl, isOpen = judge ? !!vOpen[k] : (hero ? open : false);
    const Lk = see ? floorL(k) : 0, culprit = lost && rk >= 0 && (cause[0] === 2 || cause[0] === 3) && cause[1] === k;
    // tank (left)
    tank(TX0, rb - 74, TW, 62, Lk, { line: judge ? LINE[k] : null, band: BW, hidden: !see, T, geyser: see && (Lk >= .985 || culprit && cause[0] === 2) });
    if (see) pill(TX0 + TW / 2, rt + 10, NAMES[k + 1], cols(k + 1));
    // the character, holding the wheel
    const bob = won ? Math.abs(Math.sin(T * 9 + k)) * 8 : 0, wy = rb - 34;
    shadow(x, feet + 3, 22, 5, .25);
    if (isOpen && !g.result) line([[x + 20, feet - 24], [FWX - 12, wy - 2]], 5, cols(k + 1));
    caos(x, feet - bob, 3, { col: cols(k + 1), mood: won ? 'happy' : lost ? 'sad' : null });
    if (k === fl) pill(x, rt + 20, 'YOU', cols(k + 1)); else if (!see) pill(x, rt + 20, name(k + 1), cols(k + 1));
    // the wheel (on the branch) and the lamp
    const st = see ? sig[k] : 0, fl2 = g.c - sigAt[k] < .7 && Math.sin(T * 30) > 0;
    rr(LAX - 40, rt + 10, 80, 30, 8); ink(!see ? '#6d6785' : st === 1 ? '#4fd06a' : st === 2 ? '#ff4d5e' : '#d3cfe0', 4);
    if (see && fl2) { X.fillStyle = 'rgba(255,255,255,.6)'; rr(LAX - 36, rt + 14, 72, 22, 5); X.fill(); }
    if (see) { if (st) txt(st === 1 ? 'OPEN IT!' : 'SHUT IT!', LAX, rt + 26, 16, '#fff', 'center', 72); else { X.fillStyle = '#8f88a6'; for (let q = 0; q < 3; q++) { X.beginPath(); X.arc(LAX - 14 + q * 14, rt + 26, 3.2, 0, TAU); X.fill(); } } }
    if (see && st && !g.result) { X.save(); X.globalAlpha = .35 + .25 * Math.sin(T * 8); el(LAX, rt + 25, 50, 22); X.fillStyle = st === 1 ? '#5CFF7A' : '#ff4d5e'; X.fill(); X.restore(); }
    // the pipe pressure gauge (every floor sees it; Azotea sees it too)
    if (see) { gauge(752, rb - 52, 16, prNow(), T, prNow() < .1); }
    if (see && !g.result && Lk <= .1 && hero) badge('DRY!', TX0 + TW / 2, rt - 6, 14, '#e8343d', '#fff', 1, 0);
    if (see && won) { for (let q = 0; q < 3; q++) { const kk = (T * 1.4 + q * .33) % 1; el(TX0 + TW + 14 + q * 4, rb - 40 + kk * 24, 2.6, 4); ink(WATER, 1.5); } }
    if (culprit && cause[0] === 3) { txt('pfft...', TX0 + TW / 2, rb - 86 - ((T * 30) % 14), 13, '#fff'); }
  }
  function drawBranch(k, T) {
    const rb = rowBot(k), wy = rb - 34, see = seesFloor(k), isOpen = judge ? !!vOpen[k] : (k === fl ? open : false), flowing = see && isOpen && prNow() > .06;
    pipe([[716, wy], [TX0 + TW, wy]], 8, flowing, T, true);
    wheel(FWX, wy, k === fl ? wheelA : (isOpen ? T * 9 : 0), 13, isOpen ? '#5CFF7A' : '#e8434f');
  }
  function drawAzotea(T, won, lost, rk) {
    const x = AX, feet = RY - 2, bob = won ? Math.abs(Math.sin(T * 9)) * 9 : 0;
    shadow(x, feet + 3, 24, 5, .25);
    const mood = won ? 'happy' : lost ? 'sad' : null;
    if (judge && mainOn && !g.result) line([[x - 20, feet - 26], [WHX + 14, RY - 30]], 5, cols(0));
    caos(x, feet - bob, 3.4, { col: cols(0), mood });
    // hard hat
    X.beginPath(); X.arc(x, feet - bob - 12.2 * 3.4, 3.2 * 3.4, Math.PI, 0); X.closePath(); ink('#ffd23f', 3); rr(x - 4.2 * 3.4, feet - bob - 12.2 * 3.4 - 2, 8.4 * 3.4, 5, 2.5); ink('#e8a812', 2.5);
    pill(x, feet - 62, judge ? 'YOU' : name(0), cols(0));
    if (lost && rk > .5) {                                    // drenched: drips and dark hair
      for (let q = 0; q < 6; q++) { const k = (T * 1.8 + q * .17) % 1; el(x - 18 + q * 7, feet - 30 + k * 30, 2.4, 4); ink(WATER, 1.5); }
      txt('BLUB!', x + 38, feet - 50 - (T * 14) % 10, 14, '#9fe3ff');
    }
  }
  function drawNeighbour(T, won, lost, rk) {
    const NT = RY + 30, hx0 = 150, hy0 = NT - 4;
    const jump = lost && rk > .45 ? ease((rk - .45) / .25) : 0, wob = Math.sin(T * 30) * 3 * jump;
    const nx = lerp(206, 252, jump) + wob, ny = lerp(NT - 8, RY - 52, jump);
    // the neighbour with a cup of coffee, looking the other way
    const dx = 112, df = NT;
    shadow(dx, df + 2, 18, 4, .25);
    caos(dx, df, 2.8, { col: '#9ed6a3', mood: lost ? 'happy' : null });
    X.beginPath(); X.arc(dx, df - 12.2 * 2.8, 3 * 2.8, Math.PI, 0); X.closePath(); ink('#3f5fa0', 3); rr(dx - 4 * 2.8, df - 12.2 * 2.8 - 2, 8 * 2.8, 5, 2.5); ink('#3f5fa0', 2.5);
    rr(dx + 24, df - 26, 12, 14, 3); ink('#fff', 2.5); if (!lost) { X.globalAlpha = .6; el(dx + 30 + Math.sin(T * 3) * 3, df - 34 - (T * 10) % 10, 3, 5); ink('#fff', 1); X.globalAlpha = 1; }
    // the hose: coil on the roof, the nozzle droops and drips, jumps when the game is lost
    const c = [hx0, hy0 + 10], mid = [lerp(hx0 + 30, 224, jump), lerp(NT + 6, RY - 6, jump) - Math.sin(T * 5) * 3 * jump];
    line([c, [hx0 + 14, hy0 + 18], mid, [nx - 6, ny + 10]], 8, '#3fa64a');
    rr(nx - 7, ny - 3, 18, 12, 4); ink('#ffd23f', 3);
    if (!lost && (Math.floor(T * 2) % 2 === 0)) { el(nx + 4, ny + 14 + (T * 40) % 18, 2.4, 3.6); ink(WATER, 1.5); }
    if (jump > .5) {                                           // the jet, straight at the lead
      const tx2 = AX + 6, ty2 = RY - 44, pts = [];
      for (let q = 0; q <= 10; q++) { const u = q / 10; pts.push([lerp(nx + 10, tx2, u), lerp(ny, ty2, u) - Math.sin(u * Math.PI) * 26 + Math.sin(T * 40 + q) * 1.5]); }
      line(pts, 9, WATER);
      for (let q = 0; q < 7; q++) { const u = (T * 3 + q * .14) % 1; el(lerp(nx + 10, tx2 + 18, u) + Math.sin(q) * 6, lerp(ny, ty2 - 8, u) - Math.sin(u * Math.PI) * 26 + (q % 3) * 6, 3.4, 3.4); ink('#fff', 1.5); }
    }
    if (lost && rk > .7) badge('SORRY!', dx, df - 78, 15, '#ff7a1a', '#fff', outBack((rk - .7) / .25), -.05);
  }
  g.dbg = {
    /* what a role can honestly see */
    view: () => judge
      ? { me, n, nf, judge: true, S, A, pr, main: mainOn, tp, lineA: LINEA, floors: Array.from({ length: nf }, (_, i) => ({ L: dispL[i], line: LINE[i], band: BW, sig: sig[i] })), bandA: BWA, holdT }
      : { me, n, judge: false, S, L, pr: prNow(), lamp: sig[fl], open, dry: L < .1 },
    L0, LINE, LINEA, LEAK, DIP, ARR, truckP,
  };
  wire(g, D, 0, sp, 'sq_agua');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx;
  const u = t % 4;
  X.fillStyle = '#86d8fb'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#d8cfc0'; X.fillRect(0, 208, 520, 32); X.fillStyle = INK; X.fillRect(0, 206, 520, 4);
  rr(150, 40, 340, 168, 6); ink('#ffe0a8', 4);
  if (role === 0) {
    const lv = .3 + .4 * ease(clamp(u / 3, 0, 1));
    rr(330, 14, 120, 66, 8); ink('#dff3ff', 4); X.save(); rr(332, 16, 116, 62, 6); X.clip(); X.fillStyle = WATER; X.fillRect(330, 78 - 62 * lv, 120, 70); X.restore();
    X.fillStyle = 'rgba(34,196,85,.45)'; X.fillRect(332, 78 - 62 * .8, 116, 62 * .2); X.save(); X.setLineDash([6, 4]); X.lineWidth = 3; X.strokeStyle = '#22c455'; X.beginPath(); X.moveTo(326, 78 - 62 * .6); X.lineTo(454, 78 - 62 * .6); X.stroke(); X.setLineDash([]); X.restore();
    line([[40, 70], [330, 70]], 10, '#c9ced6'); wheel(120, 48, u * 4, 14, '#e8434f');
    caos(250, 40, 2.6, { col: COLS[0] });
    for (let k = 0; k < 3; k++) {
      const on = Math.floor(u) % 3 === k, st = on && u % 1 > .4 ? 1 : 0;
      rr(60 + k * 150, 150, 130, 44 - (on && u % 1 < .5 ? 4 : 0), 14); ink(on ? '#4fd06a' : '#6EA8FE', 4); txt(['FLOOR 1', 'FLOOR 2', 'FLOOR 3'][k], 125 + k * 150, 172, 16, '#fff', 'center', 112);
      if (on && u % 1 < .5) demoFinger(125 + k * 150, 186, true, (u % 1) * 2);
    }
    badge('FILL EVERY TANK!', 260, 112, 17, '#2b9ee6', '#fff', 1, -.03);
  } else {
    const open = u > .5 && u < 2.6, lv = u < .5 ? .3 : u < 2.6 ? .3 + .4 * (u - .5) / 2.1 : .7;
    rr(180, 90, 90, 80, 10); ink('#dff3ff', 4); X.save(); rr(182, 92, 86, 76, 8); X.clip(); X.fillStyle = WATER; X.fillRect(180, 168 - 76 * lv, 90, 80); X.restore();
    X.fillStyle = '#ff4d5e'; X.fillRect(184, 94, 82, 5);
    line([[270, 150], [440, 150]], 8, '#c9ced6'); wheel(400, 150, open ? t * 9 : 0, 14, open ? '#5CFF7A' : '#e8434f');
    caos(340, 190, 3, { col: COLS[role] });
    const st = u < .5 ? 0 : open ? 1 : 2;
    rr(380, 60, 90, 34, 8); ink(st === 1 ? '#4fd06a' : st === 2 ? '#ff4d5e' : '#d3cfe0', 4); if (st) txt(st === 1 ? 'OPEN IT!' : 'SHUT IT!', 425, 78, 18, '#fff', 'center', 80);
    demoFinger(420, 196, open, open ? (u % 1) : 0);
    badge('FOLLOW THE LAMP!', 260, 24, 17, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_agua', sqAgua, 'LLEGÓ EL AGUA'); REGMAP.sq_agua.duo = true; REGMAP.sq_agua.squad = true;
DUO.INFO.sq_agua = n => [
  ['AZOTEA', 'MAIN VALVE, CALL EVERY FLOOR', 'SPACE = VALVE, 1 / 2 / 3 = LAMP'],
  ['FLOOR 1', 'OBEY THE LAMP, HOLD TO OPEN', 'HOLD SPACE / CLICK / TAP'],
  ['FLOOR 2', 'OBEY THE LAMP, HOLD TO OPEN', 'HOLD SPACE / CLICK / TAP'],
  ['FLOOR 3', 'OBEY THE LAMP, HOLD TO OPEN', 'HOLD SPACE / CLICK / TAP'],
].slice(0, n);
DUO.DEMOS.sq_agua = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
