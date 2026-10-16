'use strict';
/* ═════════ SQUAD · PAPAGAYO EN ENERO (sq_papagayo), 3-4 players, one role each ═════════
   January on a Caracas plaza: the Ávila is clear, the Parque Central towers shine and the kids fly a papagayo (kite). Between the mango tree and the
   tendido eléctrico (a drooping cable somebody never cut) there is a corridor of safe sky, and the wind keeps pushing the kite out of it.
   The January sun is in everybody's eyes: only the lookout, with his sunglasses, can see the sky.
   n = 4:  OJO DE VIENTO (0, JUDGE)  sees the kite lean, the safe corridor, the gust arrows (they blow the kite AWAY from the gap that is about to open)
                                      and the windsock forecast. He steers nothing: he CALLS the steering (LEFT / CENTRE / RIGHT) and the tail
                                      (LIGHT / HEAVY). The calls show up as big cues on the others' screens.
           CARRETE IZQ (1), CARRETE DER (2)  each hold their own reel (drag up/down anywhere, or W/S, arrows) and see ONLY their own line's tension
                                      needle. HALA (pull in) = needle into the orange band, SUELTA (pay out) = needle into the light-blue band,
                                      CENTRA = needle in the green. Yank it past the red and the line snaps.
           COLA (3)                   chooses the tail weight (drag / W S). Right weight for the wind = a calm kite and weak gusts; wrong = it wobbles.
   n = 3:  the COLA merges into the OJO (he calls the reels and moves the tail slider himself).
   The kite is a pure function of what the three owners do: lateral target = -(r1 - r2) (the reel that is reeled in pulls that side), plus the gust,
   minus the damping that a well-matched tail gives. The corridor moves between three lanes on a seeded schedule (mkR(), identical on every screen).
   Win = the kite survives until the end of the round. Lose = it spends too long touching the tree or the cable (tz), or a line snaps.
   Netcode: every role owns its variables, the others render them:
     OJO      'call' [steer -1|0|1, tail 0|1|-1] (the call), 'k' [x, jitter, tz, vx, flags, wobble] (the kite is the judge's: coalesced)
     CARRETE  'r' [reel*1000, tension*1000]     (coalesced)
     COLA     'tl' tail*1000                    (coalesced)
   The judge (role 0) decides the verdict ('end', via wire): wires/tree contact meter and the reels' reported tension. ═════════ */
(function () {
const { clamp, mkR, wire, track, demoFinger, LAG } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ───────────── the physics (sim seconds S) ───────────── */
const KP = 4.2, DP = 3.4, GP = .65, KH = .09, HW = .45, JA = .7;      // spring, damping, gust offset, kite half width, corridor half width, wobble amplitude (all in kite units: 1 = 270 px)
const KT = .88, CQ = .05, AM = 1.3, SNAP = 1.02;                               // tension gain, how much the kite's side loosens each line, snap threshold
const TG = { 1: .72, 0: .5, '-1': .28 };                            // needle target for pull / centre / pay out
const LANE = [-.7, 0, .7], LV = [.25, .8];                          // corridor lanes, ideal tail weights (light, heavy)
const NSH = 5, GUST = 1.7, SHIFT = 2.6, WARN = 2.4, RSP = 3, KSP = 1.8;
const SXC = 400, SXS = 270, KY = 172;
const sx = x => SXC + SXS * x;
const COLS = ['#FFC93C', '#6EA8FE', '#ff8fb1', '#7CE08A'];
const NAMES = ['WIND EYE', 'LEFT REEL', 'RIGHT REEL', 'KITE TAIL'];
const SKY0 = '#38a6ee', SKY1 = '#b4e9ff', LEAF = '#3fae5a', LEAF2 = '#2c8f49', LEAF3 = '#6fd27a', MANGO = '#ffb02e', CABLE = '#2a2436';
const XS = { 3: [92, 236, 380], 4: [70, 200, 330, 460] };

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.strokeStyle = INK; X.lineWidth = w + 5; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); }
function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.lineTo(x3, y3); X.closePath(); ink(fill, o); }
function pill(x, y, label, col) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(130, X.measureText(t(label)).width + 24);
  rr(x - w / 2, y - 12, w, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 9, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 15, INK, 'center', w - 12);
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
function cloud(x, y, s) {
  X.save(); X.translate(x, y); X.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); ink(null, 3); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a, b, r, 0, TAU); X.fillStyle = '#e4f5ff'; X.fill(); }
  for (const [a, b, r] of c) { X.beginPath(); X.arc(a - 3, b - 5, r * .8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } X.restore();
}
function leaves(x, y, r, col) {                                                  // a leafy blob with a cel shade and a glint
  X.beginPath(); X.arc(x, y, r, 0, TAU); ink(col, 3.5);
  X.save(); X.beginPath(); X.arc(x, y, r, 0, TAU); X.clip(); X.fillStyle = LEAF3; X.beginPath(); X.arc(x - r * .22, y - r * .26, r * .78, 0, TAU); X.fill(); X.restore();
  glint(x - r * .35, y - r * .5, r * .2, r * .1, -.6, .5);
}
function mango(x, y, s) { el(x, y, 8 * s, 10.5 * s, .5); ink(MANGO, 2.5); X.fillStyle = '#ff6b3d'; X.beginPath(); X.ellipse(x + 3 * s, y + 3 * s, 4 * s, 5 * s, .5, 0, TAU); X.fill(); glint(x - 3 * s, y - 4 * s, 2 * s, 3.4 * s, .5, .7); line([[x - 3 * s, y - 10 * s], [x - 5 * s, y - 17 * s]], 2, '#2c8f49'); }

/* ───────────── the plaza, painted once ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 350); g.addColorStop(0, SKY0); g.addColorStop(1, SKY1); X.fillStyle = g; X.fillRect(0, 0, W, 350);
  // the Ávila, long and green
  X.beginPath(); X.moveTo(0, 350); [[0, 270], [70, 236], [150, 252], [240, 208], [330, 236], [420, 222], [510, 248], [610, 214], [710, 244], [800, 226], [800, 350]].forEach(p => X.lineTo(p[0], p[1])); X.closePath();
  X.fillStyle = '#6fb0a0'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#2f6f64'; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.18)'; X.beginPath(); X.moveTo(240, 208); X.lineTo(210, 262); X.lineTo(330, 236); X.closePath(); X.fill();
  X.beginPath(); X.moveTo(0, 350); [[0, 300], [90, 280], [200, 296], [320, 276], [450, 298], [580, 280], [700, 296], [800, 284], [800, 350]].forEach(p => X.lineTo(p[0], p[1])); X.closePath(); X.fillStyle = '#4f9a73'; X.fill(); X.lineWidth = 3; X.strokeStyle = '#2f6f64'; X.stroke();
  // the city: low blocks and the twin towers of Parque Central
  const HC = ['#ff9a8a', '#ffd166', '#8fd3ff', '#c9b6ff', '#b6e388', '#f49ac2'];
  for (let i = 0; i < 13; i++) { const hx = 8 + i * 62 + (i % 3) * 7, hh = 20 + (i * 37 % 34), hy = 346 - hh; rr(hx, hy, 46, hh, 3); ink(HC[i % 6], 2.5); X.fillStyle = 'rgba(20,16,28,.5)'; for (let q = 0; q < 2; q++) X.fillRect(hx + 8 + q * 20, hy + 7, 8, 8); }
  for (const tx of [588, 628]) { rr(tx, 192, 30, 156, 3); ink('#c9d6ee', 3.5); X.fillStyle = '#9fb1d6'; X.fillRect(tx + 20, 194, 9, 152); X.fillStyle = 'rgba(40,60,110,.55)'; for (let yy = 202; yy < 340; yy += 11) for (let xx = 0; xx < 3; xx++) X.fillRect(tx + 5 + xx * 8, yy, 5, 6); X.fillStyle = INK; X.fillRect(tx + 13, 180, 4, 14); }
  // the plaza floor, with a low wall, tiles and a lamp
  g = X.createLinearGradient(0, 346, 0, H); g.addColorStop(0, '#ead7a4'); g.addColorStop(1, '#d4bc86'); X.fillStyle = g; X.fillRect(0, 346, W, H - 346);
  X.strokeStyle = 'rgba(120,90,50,.22)'; X.lineWidth = 2; for (let y = 372; y < H; y += 44) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let y = 372, r = 0; y < H; y += 44, r++) for (let x = (r % 2) * 55; x < W; x += 110) { X.beginPath(); X.moveTo(x, y); X.lineTo(x, y + 44); X.stroke(); }
  rr(-10, 336, W + 20, 20, 4); ink('#f4eedd', 3.5); X.fillStyle = 'rgba(20,16,28,.14)'; X.fillRect(0, 346, W, 8);
  X.fillStyle = INK; X.fillRect(0, 354, W, 4);
  // a bench and a lamp on the far side
  rr(520, 380, 96, 14, 5); ink('#b8743a', 3); rr(524, 360, 88, 14, 5); ink('#d9944f', 3); line([[530, 394], [530, 410]], 5, '#6d6785'); line([[606, 394], [606, 410]], 5, '#6d6785');
  line([[708, 410], [708, 300]], 6, '#6d6785'); X.beginPath(); X.arc(708, 292, 14, 0, TAU); ink('#fff3a0', 3);
  X = old; return cv2;
}

/* ═════════ the game ═════════ */
function sqPapagayo(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0;
  const isL = me === 1, isR = me === 2, isReel = isL || isR, isTail = n === 4 ? me === 3 : me === 0, split = n === 4;
  /* the level: identical on every screen whatever n / role (same number of draws) */
  const shifts = []; { let prev = 1; for (let k = 0; k < NSH; k++) { const tk = 2.3 + k * 2.7 + R() * .4; let o = [0, 1, 2].filter(q => q !== prev); const lane = o[Math.floor(R() * 2)]; shifts.push({ t: tk, from: prev, to: lane, pd: lane > prev ? -1 : lane < prev ? 1 : 0, mag: Math.abs(lane - prev) }); prev = lane; } }
  const wt = [0, 4.4 + R() * .6, 9.0 + R() * .6, 13.4 + R() * .5], w0 = R() < .5 ? 0 : 1, wl = wt.map((_, i) => (w0 + i) % 2);
  const cOf = S => { let c = LANE[1]; for (const s of shifts) if (S >= s.t) c = lerp(LANE[s.from], LANE[s.to], ease((S - s.t) / SHIFT)); return c; };
  const gOf = S => { let v = 0; for (const s of shifts) { const u = (S - (s.t - .2)) / GUST; if (u > 0 && u < 1) v += s.pd * Math.pow(Math.sin(Math.PI * u), 2); } return v; };
  const tlOf = S => { let v = LV[wl[0]]; for (let i = 1; i < wt.length; i++) if (S >= wt[i] - .75) v = lerp(LV[wl[i - 1]], LV[wl[i]], ease((S - wt[i] + .75) / .9)); return v; };
  const fcOf = S => { let v = LV[wl[0]]; for (let i = 1; i < wt.length; i++) if (S + 1.2 >= wt[i]) v = LV[wl[i]]; return v; };   // the windsock shows the next wind 1.2 s before it arrives
  const segOf = S => { let i = 0; for (let k = 1; k < wt.length; k++) if (S >= wt[k]) i = k; return i; };
  const idealsOf = S => { const i = segOf(S), o = [LV[wl[i]]]; if (i + 1 < wt.length && wt[i + 1] - S < .9) o.push(LV[wl[i + 1]]); if (i > 0 && S - wt[i] < .7) o.push(LV[wl[i - 1]]); return o; };   // around a change of wind both the old and the new weight pass
  const tfitOf = (tl, S) => { let f = 0; for (const q of idealsOf(S)) f = Math.max(f, clamp(1 - Math.max(0, Math.abs(tl - q) - .09) / .25, 0, 1)); return f; };
  const omegaOf = (tl, S) => 1 - tfitOf(tl, S);
  const jitOf = (om, S) => JA * om * clamp((S - 1.6) / 1.2, 0, 1) * Math.sin(S * 5.6) * (.7 + .3 * Math.sin(S * 2.3));
  const tens = (i, r, xs, om, S) => { const q = .5 + (i === 1 ? -CQ : CQ) * clamp(xs, -1, 1), gt = gOf(S), gg = i === 1 ? Math.max(0, gt) : Math.max(0, -gt); return .5 + KT * (r - q) + .15 * gg + .1 * om * Math.sin(S * 8.3 + i * 1.7); };
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  /* owned variables */
  let S = 0, resAt = -1, endFx = false, ptrDown = false;
  let val = .5, tgt = .5, ptrY0 = 0, ptrV0 = 0, keyDir = 0;                     // my handle (reel or tail): value, where the finger wants it, drag anchor
  let myT = .5, lastSent = -9, sentAt = -9;
  let cs = 0, cw = -1, callAt = -9, cwAt = -9, lastBtn = -1;                    // calls (judge's variables; the others render them)
  let x = 0, vx = 0, jit = 0, om = 0, tz = 0, snap = [0, 0], touching = false, flags = 0, sparkAt = -9;
  const rIn = [.5, .5], tIn = [.5, .5], tails = { v: .5 }, rSeen = [.5, .5];     // the judge's copy of what the reels / the tail report
  let tlIn = .5, kSent = -9, lastK = -9;
  const kx = track(), kj = track(); let kTz = 0, kVx = 0, kOm = 0, kFl = 0;
  const pops = []; function pop(s, px, py, size, bgc) { pops.push({ s, x: px, y: py, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  const tailVal = () => (isTail ? val : tlIn);
  const xSeen = () => judge ? x : (kx.at(0) === null ? 0 : kx.at(0));
  function setCall(a, b) { if (!judge || g.result) return; if (a !== null && a !== cs) { cs = a; callAt = g.c; snd(500 + (a + 1) * 160, .08, 'triangle', .06); } if (b !== null && b !== cw) { cw = b; cwAt = g.c; snd(260 + b * 120, .1, 'square', .04); } D.send('call', [cs, cw]); }
  function sendMine() {
    const v = Math.round(val * 1000);
    if (isReel) { if (v !== lastSent || g.c - sentAt > .25) { if (g.c - sentAt >= .06 || v !== lastSent) { lastSent = v; sentAt = g.c; D.send('r', [v, Math.round(myT * 1000)], true); } } }
    else if (isTail) { if (v !== lastSent || g.c - sentAt > .25) { if (g.c - sentAt >= .06) { lastSent = v; sentAt = g.c; D.send('tl', v, true); } } }
  }
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['CALL THE SKY!', 'REEL!', 'REEL!', 'WEIGH IT!'][me], roleLabel: NAMES[me] + (n === 3 && me === 0 ? ' + TAIL' : ''),
    hint: me === 0 ? (split ? 'LEFT / DOWN / RIGHT (OR 1 2 3) = STEERING, Q / E = TAIL LIGHT / HEAVY. YOU ALONE SEE THE SKY' : 'LEFT / DOWN / RIGHT = STEERING CALL, Q / E = MOVE THE TAIL. YOU ALONE SEE THE SKY')
      : isReel ? 'HOLD W / S (OR DRAG UP / DOWN) TO MOVE YOUR REEL: PUT THE NEEDLE WHERE THE WIND EYE CALLS' : 'HOLD W / S (OR DRAG UP / DOWN) TO MOVE THE TAIL WEIGHT: LISTEN TO THE WIND EYE',
    thint: me === 0 ? (split ? 'TAP THE STEERING AND TAIL CUES. YOU ALONE SEE THE SKY' : 'TAP THE STEERING CUES, DRAG THE TAIL SLIDER. YOU ALONE SEE THE SKY')
      : isReel ? 'DRAG UP / DOWN TO MOVE YOUR REEL: PUT THE NEEDLE WHERE THE WIND EYE CALLS' : 'DRAG UP / DOWN TO MOVE THE TAIL WEIGHT: LISTEN TO THE WIND EYE',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      if (!g.result) {
        const ds = dt * TS; S += ds;
        // my handle
        if (isReel || isTail) {
          if (keyDir) { val = clamp(val + keyDir * KSP * ds, 0, 1); tgt = val; }
          else { const step = RSP * ds; val += clamp(tgt - val, -step, step); }
          if (!ptrDown && !keyDir) tgt = val;
        }
        if (isReel) { myT = tens(me, val, xSeen(), judge ? om : kOm, S); sendMine(); }
        if (isTail) sendMine();
        if (judge) {
          const tl = split ? tlIn : val; om = omegaOf(tl, S); jit = jitOf(om, S);
          const xt = clamp(-AM * (rIn[0] - rIn[1]), -1, 1), gg = gOf(S);
          vx += (KP * (xt - x) - DP * vx + KP * GP * (1 - .75 * tfitOf(tl, S)) * gg) * ds; x += vx * ds; x = clamp(x, -1.3, 1.3);
          const c = cOf(S), xe = x + jit;
          touching = S > .8 && Math.abs(xe - c) > HW - KH;
          if (touching) { tz += ds * 2.4; if (g.c - sparkAt > .2) { sparkAt = g.c; sfx.zap(); shake(3, .1); } } else tz = Math.max(0, tz - ds * .45);
          for (let i = 0; i < 2; i++) snap[i] = tIn[i] > SNAP ? snap[i] + ds / .7 : Math.max(0, snap[i] - ds * 1.2);
          flags = (touching ? 1 : 0) | (snap[0] > .01 ? 2 : 0) | (snap[1] > .01 ? 4 : 0);
          if (g.c - kSent >= .066) { kSent = g.c; D.send('k', [Math.round(x * 1000), Math.round(jit * 1000), Math.round(tz * 100), Math.round(vx * 100), flags, Math.round(om * 100)], true); }
          if (tz >= 1 || snap[0] >= 1 || snap[1] >= 1) { flags |= (tz >= 1 ? 8 : 16); D.send('k', [Math.round(x * 1000), Math.round(jit * 1000), Math.round(Math.min(1, tz) * 100), Math.round(vx * 100), flags, Math.round(om * 100)]); g.finish('lose'); }
          else if (g.c >= g.limit) g.finish('win');
        } else if (!g.result && (kFl & 2) && isL || (kFl & 4) && isR) { if (g.c - sparkAt > .3) { sparkAt = g.c; sfx.buzz(); } }
      }
      if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); sfx.whoosh(true); }
      else if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); sfx.zap(); snd(330, .5, 'sawtooth', .06, 0, 110); shake(6, .25); }
      while (pops.length && g.c - pops[0].t0 > 1.0) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'call' && Array.isArray(d)) { if (d[0] !== cs) callAt = g.c; if (d[1] !== cw) cwAt = g.c; cs = d[0] | 0; cw = d[1] | 0; if (!judge) snd(500 + (cs + 1) * 160, .06, 'triangle', .04); }
      else if (type === 'k' && Array.isArray(d)) { kx.push(d[0] / 1000); kj.push(d[1] / 1000); kTz = d[2] / 100; kVx = d[3] / 100; kFl = d[4] | 0; kOm = d[5] / 100; lastK = g.c; }
      else if (type === 'r' && judge && Array.isArray(d) && (from === 1 || from === 2)) { rIn[from - 1] = d[0] / 1000; tIn[from - 1] = d[1] / 1000; }
      else if (type === 'r' && Array.isArray(d) && (from === 1 || from === 2)) { rSeen[from - 1] = d[0] / 1000; }
      else if (type === 'tl' && typeof d === 'number' && from === (split ? 3 : 0)) tlIn = d / 1000;
    },
    draw(t) { drawFrame(); },
    down(p) {
      if (g.result) return; ptrDown = true;
      if (judge) { const k = padAt(p.x, p.y); if (k !== null) { lastBtn = k; padPress(k); if (!split && k === 3) { ptrY0 = p.x; ptrV0 = val; } } if (!split) sliderHit(p); return; }
      ptrY0 = p.y; ptrV0 = val;
    },
    move(p) {
      if (g.result || !ptrDown) return;
      if (judge) { if (!split) sliderHit(p); return; }
      tgt = clamp(ptrV0 - (p.y - ptrY0) / 150, 0, 1);
    },
    up() { ptrDown = false; tgt = val; },
    key(e) {
      if (g.result) return; const c = e.code;
      if (judge) {
        const k = { Digit1: 0, Numpad1: 0, ArrowLeft: 0, KeyA: 0, Digit2: 1, Numpad2: 1, ArrowDown: 1, KeyS: 1, Digit3: 2, Numpad3: 2, ArrowRight: 2, KeyD: 2 }[c];
        if (k !== undefined) { padPress(k); return; }
        if (split) { if (c === 'KeyQ' || c === 'Digit4') padPress(3); else if (c === 'KeyE' || c === 'Digit5') padPress(4); }
        else if (c === 'KeyQ' || c === 'Digit4') keyDir = -1; else if (c === 'KeyE' || c === 'Digit5') keyDir = 1;
        return;
      }
      if (c === 'ArrowUp' || c === 'KeyW') keyDir = 1; else if (c === 'ArrowDown' || c === 'KeyS') keyDir = -1;
    },
    keyup(e) {
      const c = e.code;
      if (judge ? (!split && (c === 'KeyQ' || c === 'KeyE' || c === 'Digit4' || c === 'Digit5')) : (c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowDown' || c === 'KeyS')) {
        const want = judge ? (c === 'KeyQ' || c === 'Digit4' ? -1 : 1) : (c === 'ArrowUp' || c === 'KeyW' ? 1 : -1); if (keyDir === want) keyDir = 0;
      }
    },
  };
  /* judge's pads: steering ◄ ● ► (0 1 2) then tail LIGHT / HEAVY (3 4) with 4 seats, or a tail slider (3 seats) */
  function padRect(k) { if (split) return [14 + k * 152, 528, 146, 58]; return k < 3 ? [14 + k * 122, 528, 116, 58] : [388, 528, 398, 58]; }
  function padAt(px, py) { for (let k = 0; k < (split ? 5 : 4); k++) { const [a, b, w, h] = padRect(k); if (px >= a && px <= a + w && py >= b - 8 && py <= b + h + 10) return k; } return null; }
  function padPress(k) { if (k < 3) setCall(k - 1, null); else if (split) setCall(null, k === 3 ? 0 : 1); lastBtn = k; padFx[k] = g.c; }
  function sliderHit(p) { const [a, b, w, h] = padRect(3); if (p.x >= a && p.x <= a + w && p.y >= b - 10) { tgt = clamp((p.x - (a + 40)) / (w - 80), 0, 1); } }
  const padFx = [-9, -9, -9, -9, -9];

  /* ───────────── drawing ───────────── */
  function kiteAt(T) {                                                         // the kite as the judge simulates / as the others received it
    if (judge) return { x, j: jit, vx, om, tz };
    const xx = kx.at(LAG * .6), jj = kj.at(LAG * .6); return { x: xx === null ? 0 : xx, j: jj === null ? 0 : jj, vx: kVx, om: kOm, tz: kTz };
  }
  function kiteDraw(cx, cy, rot, s, tlv, T, o) {                              // a papagayo: rhombus, cross sticks, bridle and a tail of bows (more bows = heavier tail)
    o = o || {}; const nb = 3 + Math.round(tlv * 4), tailLen = 40 + tlv * 70, wag = Math.sin(T * 7) * (o.wag || 0);
    X.save(); X.translate(cx, cy); X.rotate(rot); X.scale(s, s);
    // tail first (behind)
    let tx = 0, ty = 38; const pts = [[0, 32]];
    for (let i = 1; i <= 8; i++) { const k = i / 8; pts.push([Math.sin(T * 4 + k * 5) * (6 + 14 * (o.wag || 0)) * k + wag * k * 8, 32 + tailLen * k]); }
    line(pts, 3, '#f5f0e6');
    for (let i = 0; i < nb; i++) { const k = (i + 1) / (nb + 1), p = pts[Math.min(8, Math.round(k * 8))], c = ['#ff4d6d', '#ffe14d', '#4dc6ff', '#7CE08A', '#c98bff'][i % 5]; tri(p[0], p[1], p[0] - 10, p[1] - 6 - tlv * 3, p[0] - 10, p[1] + 6 + tlv * 3, c, 2); tri(p[0], p[1], p[0] + 10, p[1] - 6 - tlv * 3, p[0] + 10, p[1] + 6 + tlv * 3, c, 2); }
    // the body
    const body = () => { X.beginPath(); X.moveTo(0, -42); X.lineTo(30, -4); X.lineTo(0, 36); X.lineTo(-30, -4); X.closePath(); };
    body(); ink('#fff', 3.5);
    X.save(); body(); X.clip(); X.fillStyle = '#e8434f'; X.fillRect(-40, -50, 40, 100); X.fillStyle = '#ffd23f'; X.fillRect(0, -50, 40, 46); X.fillStyle = '#2f7bd6'; X.fillRect(0, -4, 40, 50);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.moveTo(-4, -34); X.lineTo(-22, -4); X.lineTo(-12, -4); X.lineTo(-2, -22); X.closePath(); X.fill(); X.restore();
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, -42); X.lineTo(0, 36); X.moveTo(-30, -4); X.lineTo(30, -4); X.stroke();
    X.beginPath(); X.moveTo(0, -42); X.lineTo(30, -4); X.lineTo(0, 36); X.lineTo(-30, -4); X.closePath(); X.lineWidth = 6; X.stroke();
    X.restore();
  }
  function lineTo(fromx, fromy, tox, toy, Tn, col) {                           // a kite line; Tn = tension (0 slack .. 1 taut)
    const slack = clamp(1 - Tn * 1.15, 0, 1), sag = 6 + slack * 54, mx = (fromx + tox) / 2, my = (fromy + toy) / 2 + sag;
    X.lineCap = 'round'; X.beginPath(); X.moveTo(fromx, fromy); X.quadraticCurveTo(mx, my, tox, toy); X.strokeStyle = INK; X.lineWidth = 5.5; X.stroke(); X.strokeStyle = col || '#fff3d6'; X.lineWidth = 2.5; X.stroke();
  }
  function reelProp(px, py, val2, T, lit, side) {                              // the wooden carrete
    X.save(); X.translate(px, py);
    rr(-22, -16, 44, 32, 7); ink('#b8743a', 3.5); X.fillStyle = '#d9944f'; X.fillRect(-16, -11, 32, 22);
    X.save(); X.rotate(val2 * 6 + T * 0); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-14, 0); X.lineTo(14, 0); X.moveTo(0, -9); X.lineTo(0, 9); X.stroke(); X.restore();
    X.beginPath(); X.arc(0, 0, 4, 0, TAU); ink(lit ? '#ffe14d' : '#fff', 2.5);
    X.fillStyle = '#fff3d6'; for (let q = 0; q < 2; q++) { rr(-18 + q * 22, -14, 6 + val2 * 2, 4, 2); X.fill(); }
    X.restore();
  }
  function tree(cs2, T) {                                                      // left obstacle: the mango bough reaches to the corridor edge
    const edge = sx(cs2 - HW), tipY = 150 + Math.sin(T * 1.3) * 5;
    rr(10, 130, 54, 230, 10); ink('#8a5a34', 3.5); X.fillStyle = '#6d4426'; X.fillRect(44, 134, 14, 224);
    line([[40, 210], [lerp(40, edge - 70, .5), 176 + Math.sin(T * 1.1) * 3], [edge - 60, tipY + 20]], 14, '#8a5a34');
    const nL = Math.max(5, Math.round((edge + 30) / 38));
    for (let i = 0; i < nL; i++) { const k = i / Math.max(1, nL - 1), px = lerp(30, edge - 66, k), py = lerp(110, tipY + 8, ease(k)) + Math.sin(T * 1.7 + i) * 3.5, r = i === nL - 1 ? 40 : 54 - k * 16; leaves(px, py, r, i % 2 ? LEAF : LEAF2); }
    for (let i = 0; i < nL; i++) { const k = i / Math.max(1, nL - 1), px = lerp(30, edge - 66, k) + 6, py = lerp(110, tipY + 8, ease(k)) + 44 - k * 14; if (i % 2 === 0 || i === nL - 1) mango(px, py + Math.sin(T * 2 + i) * 2, 1); }
    leaves(edge - 36, tipY + 10, 34, LEAF); mango(edge - 40, tipY + 48 + Math.sin(T * 2.3) * 2, 1.1);
  }
  function cables(cs2, T) {                                                    // right obstacle: the cable somebody never cut, swinging with the wind
    const edge = sx(cs2 + HW), sw = Math.sin(T * 1.5) * 4;
    line([[772, 360], [772, 40]], 12, '#8f9cb3'); rr(704, 70, 100, 12, 4); ink('#6d6785', 3); rr(718, 104, 86, 10, 4); ink('#6d6785', 3);
    for (const ix of [716, 750]) { X.beginPath(); X.arc(ix, 70, 5, 0, TAU); ink('#e8e4f2', 2.5); }
    X.beginPath(); X.arc(780, 100, 10, 0, TAU); ink('#9fb1d6', 2.5);
    for (let i = 0; i < 4; i++) {
      const ex = edge + i * 13 + sw * (1 + i * .15), ey = 128 + i * 38 + Math.sin(T * 2 + i) * 4, sx0 = 718 + (i % 2) * 32, sy0 = 72 + (i % 2) * 34;
      X.lineCap = 'round'; X.beginPath(); X.moveTo(sx0, sy0); X.quadraticCurveTo(lerp(sx0, ex, .5), Math.max(sy0, ey) + 36, ex, ey); X.strokeStyle = INK; X.lineWidth = 9; X.stroke(); X.strokeStyle = i % 2 ? '#3b3550' : '#5d4a7a'; X.lineWidth = 4.5; X.stroke();
      rr(ex - 5, ey - 2, 10, 14, 3); ink('#e8434f', 2);
    }
    // old sneakers and a dead kite hanging on the wire
    for (const [ox, oy, rot] of [[edge + 44, 156, .2], [edge + 52, 196, -.1]]) { X.save(); X.translate(ox, oy); X.rotate(rot + Math.sin(T * 2 + ox) * .1); line([[0, -26], [0, -4]], 2.5, '#fff3d6'); rr(-11, -6, 22, 12, 5); ink('#4dc6ff', 2.5); rr(-12, 3, 24, 5, 2); ink('#fff', 2); X.restore(); }
    // the iguana up on the crossarm, taking it all in
    const ix = 748, iy = 64, hd = Math.sin(T * .8) * 3;
    X.save(); X.translate(ix, iy); el(0, -4, 22, 9); ink('#7ccf5a', 3); for (let q = 0; q < 6; q++) tri(-14 + q * 5, -12, -11 + q * 5, -17, -8 + q * 5, -12, '#4f9d3a', 1.5);
    line([[-18, -4], [-34, 0], [-44, 6]], 6, '#7ccf5a'); el(24 + hd, -8, 10, 7); ink('#7ccf5a', 3); X.fillStyle = INK; X.beginPath(); X.arc(27 + hd, -10, 2, 0, TAU); X.fill(); X.restore();
  }
  function drawSky(T, K, c) {
    for (const [cx, cy, sc, spd] of [[40, 90, .8, 7], [300, 140, .6, 5], [580, 40, .7, 6]]) cloud(((T * spd + cx) % 1000) - 140, cy, sc);
    tree(c, T); cables(c, T);
  }
  function drawKite(T, K, c, won, lost, rk) {
    const kxp = sx(clamp(K.x, -1.3, 1.3) + K.j), lean = clamp(K.vx * .09, -.45, .45) + K.j * .6;
    let kyp = KY + Math.sin(T * 2.1) * 3 - (won ? ease(rk / 1.1) * 190 : 0);
    const tlv = judge || !split ? tailVal() : (isTail ? val : tailVal());
    const tlShown = (split && !isTail && !judge) ? tlIn : tlv;
    if (lost) { kyp += clamp(rk * 30, 0, 24); }
    const wob = K.om || 0;
    // lines from the two kids to the bridle
    const xs = XS[n], hx = [xs[1] + 14, xs[2] + 14], hy = 444;
    for (let i = 0; i < 2; i++) {
      const own = (isReel && me === i + 1), Tn = own ? clamp(myT, 0, 1.1) : .7, snapped = (flags & (i ? 4 : 2)) && lost || (lost && rk > 0 && (kFl & 16) && (kFl & (i ? 4 : 2)));
      if (snapped) { lineTo(hx[i], hy - 10, lerp(hx[i], kxp, .4), lerp(hy, kyp + 40, .5), .6, '#fff3d6'); continue; }
      lineTo(hx[i], hy - 10, kxp, kyp + 34, Tn, own && myT > .92 ? '#ff8a8a' : '#fff3d6');
    }
    if (!judge && !g.result) X.globalAlpha = .3;                                  // in the glare the others only guess a silhouette
    kiteDraw(kxp, kyp, lean, 1, tlShown, T, { wag: clamp(wob * 1.2, 0, 1) }); X.globalAlpha = 1;
    return { kxp, kyp };
  }
  function kid(i, T, won, lost, mood) {
    const xs = XS[n], px = xs[i], by = 478, bob = won ? -Math.abs(Math.sin(T * 9 + i)) * 12 : 0, h = Math.exp(-(g.c - (i === 0 ? callAt : -9)) / .2);
    shadow(px, by + 4, 28, 7, .25);
    caos(px, by + bob, 3.4, { col: cols(i), mood });
    if (i === 0) {                                                             // sunglasses and a hand over the brow
      rr(px - 17, by + bob - 36, 34, 9, 4); ink('#14101c', 2.5); glint(px - 9, by + bob - 34, 5, 1.8, 0, .5);
      line([[px + 17, by + bob - 24], [px + 28, by + bob - 36 - h * 6]], 5, cols(i));
    } else if (i === 1 || i === 2) {
      const val2 = i === me ? val : rSeen[i - 1];
      reelProp(px + 14, by + bob - 36, val2, T, i === me, i);
      line([[px + 6, by + bob - 22], [px + 14, by + bob - 36]], 5, cols(i));
    } else {
      rr(px - 28, by + bob - 24, 26, 24, 5); ink('#b8743a', 3); X.fillStyle = '#d9944f'; X.fillRect(px - 24, by + bob - 20, 18, 10);
      for (let q = 0; q < 3; q++) { X.beginPath(); X.arc(px - 22 + q * 7, by + bob - 24, 4, 0, TAU); ink('#c9ced6', 1.8); }
      line([[px + 6, by + bob - 22], [px + 18, by + bob - 34]], 5, cols(i));
    }
    pill(px, by + 28, i === me ? 'YOU' : name(i), cols(i));
  }
  /* the judge's overlay: safe corridor, arrows, windsock */
  function judgeOverlay(T, c) {
    const a = sx(c - HW), b = sx(c + HW), pul = .5 + .5 * Math.sin(T * 4);
    X.save(); X.globalAlpha = .22; X.fillStyle = '#7CE08A'; X.fillRect(a, 44, b - a, 300); X.globalAlpha = 1;
    X.setLineDash([10, 8]); X.lineWidth = 4; X.strokeStyle = '#fff'; for (const lx of [a, b]) { X.beginPath(); X.moveTo(lx, 44); X.lineTo(lx, 342); X.stroke(); } X.setLineDash([]); X.restore();
    // gust arrows (they point where the wind will shove the kite)
    for (const s of shifts) {
      const ph = S - (s.t - WARN); if (ph < 0 || ph > WARN + .5 || !s.pd) continue;
      const k = clamp(ph / (WARN + .5), 0, 1), al = clamp(Math.min(ph / .3, (WARN + .5 - ph) / .4), 0, 1), dir = s.pd, ny = s.mag;
      X.globalAlpha = al;
      for (let q = 0; q < ny * 2 + 1; q++) { const ax = SXC + dir * (-150 + ((ph * 120 + q * 70) % 300)), ay = 96 + (q % 2) * 30; X.save(); X.translate(ax, ay); X.scale(dir, 1); tri(-16, -14, 16, 0, -16, 14, '#fff', 3.5); tri(-16, -8, 8, 0, -16, 8, '#4dc6ff', 0); X.restore(); }
      X.globalAlpha = 1;
      if (ph > .3 && ph < WARN) badge(ny > 1 ? 'GUST!!' : 'GUST!', SXC + s.pd * 190, 62, 17, '#2b9ee6', '#fff', 1, -.03 * s.pd);
    }
    // windsock on a pole by the bench: the forecast
    const wx = 468, wy = 286, fc = (fcOf(S) - LV[0]) / (LV[1] - LV[0]);
    line([[wx, 346], [wx, wy - 6]], 5, '#6d6785'); X.beginPath(); X.arc(wx, wy - 6, 5, 0, TAU); ink('#fff', 2);
    for (let q = 0; q < 4; q++) { const wq = 30 - q * 6, ang = lerp(1.25, .08, fc) + Math.sin(T * 8 + q) * .04 * fc, x0 = wx + q * 15 * Math.cos(ang), y0 = wy + q * 15 * Math.sin(ang); rr(x0, y0 - wq / 2 * .7, 15, wq * .7, 4); ink(q % 2 ? '#fff' : '#ff6b3d', 2.5); }
    pill(wx + 14, 372, fc > .5 ? 'STRONG WIND' : 'LIGHT WIND', fc > .5 ? '#ff9f43' : '#9fe3ff');
  }
  function drawFrame() {
    X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    if (!BG) BG = buildBg(); X.drawImage(BG, 0, 0);
    const c = judge ? cOf(S) : cOf(S);
    drawSky(T, null, c);
    const K = kiteAt(T);
    if (judge && !g.result) judgeOverlay(T, c);
    if (!judge) { /* glare: the January sun blinds everybody but the lookout */
      const gl = X.createRadialGradient(150, 60, 10, 400, 180, 520); gl.addColorStop(0, 'rgba(255,252,220,.97)'); gl.addColorStop(.5, 'rgba(255,246,200,.93)'); gl.addColorStop(1, 'rgba(255,238,170,.88)');
      X.fillStyle = gl; X.fillRect(0, 0, W, 350); X.fillStyle = INK; X.fillRect(0, 350, W, 3);
      X.beginPath(); X.arc(150, 60, 34, 0, TAU); X.fillStyle = 'rgba(255,255,255,.95)'; X.fill();
      X.save(); X.translate(150, 60); X.rotate(T * .3); X.fillStyle = 'rgba(255,200,60,.5)'; for (let i = 0; i < 12; i++) { X.rotate(TAU / 12); X.beginPath(); X.moveTo(-8, 44); X.lineTo(8, 44); X.lineTo(0, 78); X.fill(); } X.restore();
      if (!g.result) { txt('SUN IN YOUR EYES!', 400, 96, 30, '#ffb020', 'center', 420); txt('LISTEN TO THE WIND EYE', 400, 130, 20, '#fff', 'center', 420); }
    }
    const kp = drawKite(T, K, c, won, lost, rk);
    if (!judge) { X.globalAlpha = 0; } else X.globalAlpha = 1; X.globalAlpha = 1;
    if (K.tz > .05 || (flags & 1) && judge) {                                      // contact sparks
      const spx = kp.kxp + (K.x + K.j > c ? 26 : -26), n2 = 5; for (let i = 0; i < n2; i++) { const a2 = T * 18 + i * 1.3; star(spx + Math.cos(a2) * 14, kp.kyp + Math.sin(a2 * 1.3) * 18, 9, 4, 5, a2, '#ffe14d', 2); }
    }
    // the kids
    for (let i = 0; i < n; i++) kid(i, T, won, lost, won ? 'happy' : lost ? 'sad' : null);
    // tension of the other lines is secret: my own line has its gauge in my panel. The danger meter of the corridor is the judge's
    if (judge && !g.result) {
      rr(300, 8, 200, 20, 8); ink('#fff', 3); X.save(); rr(300, 8, 200, 20, 8); X.clip(); X.fillStyle = tz > .6 ? '#e8343d' : '#ffb020'; X.fillRect(300, 8, 200 * clamp(tz, 0, 1), 20); X.restore(); txt('TANGLE', 400, 19, 13, tz > .5 ? '#fff' : INK, 'center', 120);
    }
    if (!g.result) uiPanel(T, c);
    // payoffs
    if (won) {
      for (let i = 0; i < 18; i++) { const d = rk - hash(i + 3) * .8; if (d < 0) continue; const fx = 40 + hash(i) * 720 + Math.sin(d * 4 + i) * 16, fy = -10 + d * (170 + hash(i + 9) * 70); if (fy < 560) { X.save(); X.translate(fx, fy); X.rotate(d * 3 + i); rr(-6, -3, 12, 6, 2); ink(['#ff4d6d', '#ffe14d', '#4dc6ff', '#fff'][i % 4], 2); X.restore(); } }
      if (rk > .3) badge('PAPAGAYO ALTO!', 400, 270, 32, '#22a447', '#fff', outBack((rk - .3) / .25), -.04);
    }
    if (lost) {
      for (let i = 0; i < 6; i++) { const a2 = rk * 6 + i * 1.1, rad = 8 + rk * 40; X.globalAlpha = clamp(1 - rk / 1.2, 0, 1); X.beginPath(); X.arc(kp.kxp + Math.cos(a2) * rad, kp.kyp - 20 - rk * 20 + Math.sin(a2) * rad * .6, 9 + rk * 5, 0, TAU); ink('#6d6785', 2); X.globalAlpha = 1; }
      if (rk > .4) badge((kFl & 16) || (flags & 16) ? 'THE LINE SNAPPED!' : 'TANGLED UP!', 400, 290, 26, '#e8343d', '#fff', outBack((rk - .4) / .25), .04);
    }
    for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 24, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
    if (!g.result && T < 2.6) badge(judge ? 'CALL THE STEERING!' : isReel ? 'FOLLOW THE CALL!' : 'FOLLOW THE CALL!', 400, 318, 21, judge ? '#22a447' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
    vignette(.14);
  }
  /* controls drawn in the world: pads (judge), or the reel board with its needle (reels), the tail board (tail) */
  const CUE = ['LEFT', 'CENTRE', 'RIGHT'], ZC = ['#2b9ee6', '#3fae5a', '#ff9f43'];
  function uiPanel(T, c) {
    if (judge) {
      const labels = ['◄ LEFT', '● CENTRE', 'RIGHT ►'];
      for (let k = 0; k < 3; k++) {
        const [a, b, w, h] = padRect(k), on = cs === k - 1, d = Math.exp(-(T - padFx[k]) / .15) > .4 ? 3 : 8, col = ['#2b9ee6', '#3fae5a', '#ff9f43'][k];
        rr(a, b + 8, w, h - 6, 16); ink('#3a3550', 4); rr(a, b + 8 - d, w, h - 6, 16); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(a + 10, b + 12 - d, w - 20, 8, 4); X.fill();
        if (on) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(T * 10); rr(a + 5, b + 14 - d, w - 10, h - 18, 12); X.stroke(); X.globalAlpha = 1; }
        txt(labels[k], a + w / 2, b + 30 - d, 20, '#fff', 'center', w - 20);
      }
      if (split) {
        for (let k = 3; k < 5; k++) {
          const [a, b, w, h] = padRect(k), on = cw === k - 3, d = Math.exp(-(T - padFx[k]) / .15) > .4 ? 3 : 8, col = k === 3 ? '#8f7bd6' : '#a5622c';
          rr(a, b + 8, w, h - 6, 16); ink('#3a3550', 4); rr(a, b + 8 - d, w, h - 6, 16); ink(col, 4); X.fillStyle = 'rgba(255,255,255,.3)'; rr(a + 10, b + 12 - d, w - 20, 8, 4); X.fill();
          if (on) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(T * 10); rr(a + 5, b + 14 - d, w - 10, h - 18, 12); X.stroke(); X.globalAlpha = 1; }
          txt(k === 3 ? 'TAIL LIGHT' : 'TAIL HEAVY', a + w / 2, b + 30 - d, 18, '#fff', 'center', w - 20);
        }
      } else {
        const [a, b, w, h] = padRect(3); rr(a, b + 4, w, h, 14); ink('#d9944f', 4);
        txt('TAIL', a + 26, b + 4 + h / 2, 15, '#fff', 'center', 44); const tx0 = a + 52, tw = w - 80; line([[tx0, b + 4 + h / 2], [tx0 + tw, b + 4 + h / 2]], 7, '#8a5a34');
        for (let q = 0; q < 6; q++) { X.beginPath(); X.arc(tx0 + tw * q / 5, b + 4 + h / 2 + 14, 3, 0, TAU); X.fillStyle = INK; X.fill(); }
        const hx = tx0 + tw * val; X.beginPath(); X.arc(hx, b + 4 + h / 2, 15, 0, TAU); ink('#c9ced6', 3.5); txt('◂▸', hx, b + 4 + h / 2 + 1, 12, INK);
      }
      return;
    }
    // reel / tail board on the right
    const bx = 612, by = 360, bw = 180, bh = 232;
    rr(bx, by, bw, bh, 16); ink('#d9944f', 4); X.fillStyle = 'rgba(255,255,255,.2)'; rr(bx + 10, by + 6, bw - 20, 8, 4); X.fill();
    const railX = bx + 134, top = by + 52, len = 150, bot = top + len, hy = bot - len * val, ts = (isReel ? myT : 0);
    // rail
    rr(railX - 7, top - 8, 14, len + 16, 7); ink('#6d4426', 3); line([[railX, top], [railX, bot]], 4, '#3b2a18');
    txt(isReel ? 'REEL IN' : 'HEAVY', railX, top - 22, 12, INK, 'center', 62); txt(isReel ? 'PAY OUT' : 'LIGHT', railX, bot + 22, 12, INK, 'center', 62);
    // handle (a reel spool or a bag of bottle caps)
    if (isReel) { X.beginPath(); X.arc(railX, hy, 17, 0, TAU); ink('#fff3d6', 3.5); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(railX - 11, hy); X.lineTo(railX + 11, hy); X.moveTo(railX, hy - 11); X.lineTo(railX, hy + 11); X.stroke(); }
    else { rr(railX - 18, hy - 15, 36, 30, 8); ink('#c9ced6', 3.5); for (let q = 0; q < 3; q++) { X.beginPath(); X.arc(railX - 9 + q * 9, hy + (q % 2) * 4 - 2, 5, 0, TAU); ink(['#ff4d6d', '#ffe14d', '#4dc6ff'][q], 1.8); } }
    if (isReel) {
      // tension gauge: zones + target band + needle
      const gx = bx + 50, gw = 28, VM = 1.1, yv = v => bot - len * clamp(v, 0, VM) / VM * 1;
      rr(gx - 6, top - 8, gw + 12, len + 16, 8); ink('#fff', 3.5);
      const zones = [[0, .12, '#7fb6e8'], [.12, .36, '#bfe3ff'], [.36, .64, '#9be29b'], [.64, .88, '#ffc66b'], [.88, 1.02, '#ff9f43'], [1.02, VM, '#e8343d']];
      for (const [a, b, col] of zones) { X.fillStyle = col; X.fillRect(gx, yv(b), gw, yv(a) - yv(b)); }
      X.strokeStyle = INK; X.lineWidth = 2; for (const q of [.12, .36, .64, .88, 1.02]) { X.beginPath(); X.moveTo(gx, yv(q)); X.lineTo(gx + gw, yv(q)); X.stroke(); }
      const tg = cs2call();                                                  // the target band for the call
      if (tg !== null) { const t0 = tg, ya = yv(t0 + .07), yb = yv(t0 - .07); X.globalAlpha = .75 + .25 * Math.sin(T * 10); rr(gx - 4, ya, gw + 8, yb - ya, 5); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#fff'; X.stroke(); X.globalAlpha = 1; }
      const ny = yv(ts); X.beginPath(); X.moveTo(gx + gw + 4, ny); X.lineTo(gx + gw + 20, ny - 9); X.lineTo(gx + gw + 20, ny + 9); X.closePath(); ink(INK, 0); tri(gx + gw + 2, ny, gx + gw + 17, ny - 8, gx + gw + 17, ny + 8, ts > 1.02 ? '#e8343d' : '#fff', 2.5);
      txt('YOUR LINE', gx + gw / 2, by + 26, 14, INK, 'center', 80);
      if (ts > .9) { X.globalAlpha = .6 + .4 * Math.sin(T * 24); txt('LINE SNAPS!', bx + 58, by + bh - 14, 15, '#e8343d', 'center', 84); X.globalAlpha = 1; }
      else if (ts < .1) txt('SLACK', bx + 58, by + bh - 14, 16, '#2b6fd0', 'center', 84);
    } else {
      const om2 = omegaOf(val, S), gx = bx + 54, gw = 28;
      rr(gx - 6, top - 8, gw + 12, len + 16, 8); ink('#fff', 3.5); X.fillStyle = '#e4f5ff'; X.fillRect(gx, top, gw, len);
      const h2 = len * clamp(om2 * 1.15, 0, 1); X.fillStyle = om2 > .5 ? '#e8343d' : om2 > .15 ? '#ffb020' : '#3fae5a'; X.fillRect(gx, bot - h2, gw, h2);
      txt('WOBBLE', gx + gw / 2, by + 26, 14, INK, 'center', 70);
      txt(om2 < .12 ? 'CALM' : 'SWAYS!', bx + 58, by + bh - 14, 16, om2 < .12 ? '#22a447' : '#e8343d', 'center', 84);
    }
    // the call cue (what the wind eye wants), painted on the board
    const cueY = by - 28;
    if (isReel) {
      const call = cs, word = call === 0 ? 'CENTRE' : ((call < 0) === isL ? 'REEL IN' : 'PAY OUT'), col = call === 0 ? '#3fae5a' : ((call < 0) === isL ? '#ff9f43' : '#2b9ee6');
      const hot = Math.exp(-(g.c - callAt) / .35); badge(word, bx + bw / 2 - 20, cueY, 22 + hot * 5, col, '#fff', 1, -.03);
    } else {
      const word = cw < 0 ? 'WAITING FOR THE CALL' : cw === 0 ? 'LIGHT TAIL' : 'HEAVY TAIL', col = cw < 0 ? '#8f8aa3' : cw === 0 ? '#8f7bd6' : '#a5622c';
      badge(word, bx + bw / 2 - 10, cueY, 18 + Math.exp(-(g.c - cwAt) / .35) * 5, col, '#fff', 1, -.03);
    }
  }
  function cs2call() { return isReel && g.c - callAt >= 0 ? TG[(cs === 0) ? 0 : ((cs < 0) === isL ? 1 : -1)] : null; }

  g.dbg = {
    view: () => ({
      S, n, me, x, c: cOf(S), cs, cw, T: myT, val, tl: tailVal(), tlStar: tlOf(S), wl: tlOf(S), fc: fcOf(S), ready: shifts.map(s => ({ t: s.t, pd: s.pd, mag: s.mag, from: s.from, to: s.to })), wt, kx: xSeen(), tz, snap: snap.slice(), om,
      arrows: shifts.filter(s => S >= s.t - WARN && S < s.t + 1.4).map(s => ({ t: s.t, pd: s.pd, mag: s.mag, to: s.to })), nextShift: shifts.find(s => s.t > S - .05),
    }),
    shifts, wt, wl, cOf, gOf, tlOf, HW, KH, tens: (i, r, xs, om2, S2) => tens(i, r, xs, om2, S2),
  };
  wire(g, D, 0, sp, 'sq_papagayo');
  return g;
}

/* ───────────── intro card (520×240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  X = ctx; const u = t % 4, split = n === 4;
  let g = X.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, SKY0); g.addColorStop(1, SKY1); X.fillStyle = g; X.fillRect(0, 0, 520, 150);
  X.fillStyle = '#ead7a4'; X.fillRect(0, 150, 520, 90); X.fillStyle = INK; X.fillRect(0, 148, 520, 4);
  const c = u < 2 ? -.4 : .4, kxp = 260 + 90 * Math.sin(t * 1.5) * (role === 0 ? 0.3 : 1) * .6 + (u < 2 ? -60 : 60) * (role === 1 || role === 2 ? .8 : .5);
  for (const [lx, w] of [[0, 60 + (u < 2 ? 120 : 20)]]) { X.fillStyle = LEAF; for (let q = 0; q < 4; q++) { X.beginPath(); X.arc(10 + q * (w / 3.5), 50 + q % 2 * 14, 28, 0, TAU); ink(q % 2 ? LEAF : LEAF2, 3); } }
  const rx = 440 - (u < 2 ? 0 : 90) * .5; for (let i = 0; i < 3; i++) { X.beginPath(); X.moveTo(500, 30); X.quadraticCurveTo(rx, 80 + i * 20, rx + i * 8, 70 + i * 26); X.strokeStyle = INK; X.lineWidth = 6; X.stroke(); X.strokeStyle = '#5d4a7a'; X.lineWidth = 3; X.stroke(); }
  const kk = ease(clamp((u % 2) / 1.2, 0, 1)), kxx = lerp(u < 2 ? 330 : 200, u < 2 ? 200 : 330, kk) * 0 + (u < 2 ? lerp(300, 200, kk) : lerp(200, 300, kk));
  X.save(); X.translate(kxx, 82); X.beginPath(); X.moveTo(0, -26); X.lineTo(18, -2); X.lineTo(0, 22); X.lineTo(-18, -2); X.closePath(); ink('#e8434f', 3); X.restore();
  for (let q = 0; q < 4; q++) { X.beginPath(); X.arc(kxx + Math.sin(t * 5 + q) * 4, 108 + q * 9, 4, 0, TAU); ink(['#ffe14d', '#4dc6ff', '#ff4d6d', '#7CE08A'][q], 1.5); }
  if (role === 0) {
    X.fillStyle = 'rgba(124,224,138,.3)'; X.fillRect(kxx - 62, 20, 124, 126);
    for (let q = 0; q < 3; q++) { const ax = 380 + ((t * 70 + q * 40) % 120) * (u < 2 ? 1 : -1) * .5; tri(ax - 8, 36, ax + 8, 44, ax - 8, 52, '#fff', 2.5); }
    caos(70, 205, 2.6, { col: COLS[0] }); rr(54, 177, 32, 7, 3); ink('#14101c', 2);
    for (let k = 0; k < 3; k++) { const on = (u < 2 ? 0 : 2) === k, d = on && u % 2 > .3 && u % 2 < .6; rr(130 + k * 120, 190 - (d ? 0 : 4), 110, 40, 12); ink(['#2b9ee6', '#3fae5a', '#ff9f43'][k], 3.5); txt(['◄ LEFT', '● CENTRE', 'RIGHT ►'][k], 185 + k * 120, 208 - (d ? 0 : 4), 17, '#fff', 'center', 90); if (on && u % 2 > .3) demoFinger(185 + k * 120, 214, d, (u % 1)); }
    badge('CALL THE SKY!', 270, 24, 17, '#22a447', '#fff', 1, -.03);
  } else if (role === 3 || (role === 0 && n === 3)) {
    rr(430, 160, 60, 70, 8); ink('#d9944f', 3); const hy = 175 + 40 * (.5 + .5 * Math.sin(t * 1.6));
    rr(446, hy - 8, 28, 18, 5); ink('#c9ced6', 3); demoFinger(460, hy + 22, true, 0); caos(70, 215, 2.6, { col: COLS[3] });
    badge('WEIGH IT!', 270, 24, 17, '#8f7bd6', '#fff', 1, -.03);
  } else {
    const rx2 = 450, top = 160, len = 62, hv = .5 + .35 * (role === 1 ? (u < 2 ? 1 : -1) : (u < 2 ? -1 : 1)) * ease(clamp((u % 2) / .6, 0, 1));
    rr(rx2 - 40, 156, 80, 78, 10); ink('#d9944f', 3); rr(rx2 - 24, top - 2, 14, len + 8, 5); ink('#fff', 2.5);
    const yy = top + len - len * hv * 1; X.fillStyle = '#ffc66b'; X.fillRect(rx2 - 22, top + 8, 10, 14); X.fillStyle = '#9be29b'; X.fillRect(rx2 - 22, top + 24, 10, 14); X.fillStyle = '#bfe3ff'; X.fillRect(rx2 - 22, top + 40, 10, 18);
    tri(rx2 - 8, yy, rx2 + 2, yy - 6, rx2 + 2, yy + 6, '#fff', 2); X.beginPath(); X.arc(rx2 + 18, yy, 11, 0, TAU); ink('#fff3d6', 2.5); demoFinger(rx2 + 18, yy + 20, true, 0);
    caos(80, 212, 2.6, { col: COLS[role] }); badge(role === 1 ? 'LEFT LINE' : 'RIGHT LINE', 270, 24, 17, '#2b9ee6', '#fff', 1, -.03);
  }
}
reg('sq_papagayo', sqPapagayo, 'PAPAGAYO'); REGMAP.sq_papagayo.duo = true; REGMAP.sq_papagayo.squad = true;
DUO.INFO.sq_papagayo = n => [
  ['WIND EYE', n === 4 ? 'SEE THE SKY, CALL STEERING AND TAIL' : 'SEE THE SKY, CALL STEERING, SET THE TAIL', n === 4 ? 'LEFT / CENTRE / RIGHT, Q / E' : 'LEFT / CENTRE / RIGHT, Q / E + SLIDER'],
  ['LEFT REEL', 'PULL OR PAY OUT YOUR LINE', 'DRAG / W S, KEEP THE NEEDLE'],
  ['RIGHT REEL', 'PULL OR PAY OUT YOUR LINE', 'DRAG / W S, KEEP THE NEEDLE'],
  ['KITE TAIL', 'WEIGH THE TAIL FOR THE WIND', 'DRAG / W S'],
].filter((_, i) => n === 4 || i !== 3);
DUO.DEMOS.sq_papagayo = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
